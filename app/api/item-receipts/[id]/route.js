
import { NextResponse } from "next/server";
import pool from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { requirePermission } from "@/lib/permissions";

export const dynamic = "force-dynamic";

// ============================================================
// HELPERS
// ============================================================

function positiveId(value) {
    const number = Number(value);

    return Number.isInteger(number) && number > 0
        ? number
        : null;
}

function validDate(value) {
    return /^\d{4}-\d{2}-\d{2}$/.test(String(value || ""));
}

function validQuantity(value) {
    const number = Number(value);

    return Number.isFinite(number) && number > 0;
}

function validCost(value) {
    const number = Number(value);

    return Number.isFinite(number) && number >= 0;
}

function apiError(error) {
    console.error("ITEM RECEIPT DETAIL API ERROR:", error);

    if (error.message === "UNAUTHORIZED") {
        return NextResponse.json(
            { message: "You are not authorized. Please log in." },
            { status: 401 }
        );
    }

    if (error.message === "FORBIDDEN") {
        return NextResponse.json(
            { message: "You do not have permission to perform this action." },
            { status: 403 }
        );
    }

    return NextResponse.json(
        { message: error.message || "Internal server error." },
        { status: 500 }
    );
}

function validationError(message, status = 400) {
    return NextResponse.json({ message }, { status });
}

async function getReceiptId(context) {
    const params = await context.params;
    return positiveId(params?.id);
}

// ============================================================
// GET: SINGLE ITEM RECEIPT
// ============================================================

export async function GET(request, context) {
    try {
        const user = await getCurrentUser();

        if (!user) {
            return validationError("Unauthorized.", 401);
        }

        await requirePermission(
            user,
            "item_receipts",
            "view"
        );

        const companyId = positiveId(user.companyId);
        const receiptId = await getReceiptId(context);

        if (!companyId) {
            return validationError("Invalid company.", 400);
        }

        if (!receiptId) {
            return validationError("Invalid Item Receipt ID.");
        }

        const receiptResult = await pool.query(
            `
            SELECT
                ir.*,

                s.supplier_name,
                s.supplier_code,
                s.phone AS supplier_phone,
                s.email AS supplier_email,
                s.address AS supplier_address,

                w.warehouse_name,
                w.warehouse_code,
                w.location AS warehouse_location,

                po.purchase_order_number,

                pir.receipt_number AS pending_receipt_number

            FROM item_receipts ir

            LEFT JOIN suppliers s
                ON s.supplier_id = ir.supplier_id

            LEFT JOIN warehouses w
                ON w.warehouse_id = ir.warehouse_id

            LEFT JOIN purchase_orders po
                ON po.purchase_order_id =
                    ir.purchase_order_id

            LEFT JOIN pending_item_receipts pir
                ON pir.pending_item_receipt_id =
                    ir.pending_item_receipt_id

            WHERE ir.item_receipt_id = $1
              AND ir.company_id = $2
            `,
            [receiptId, companyId]
        );

        if (receiptResult.rows.length === 0) {
            return validationError("Item Receipt not found.", 404);
        }

        const itemsResult = await pool.query(
            `
            SELECT
                iri.*,

                p.product_name,
                p.sku,
                p.unit AS product_unit

            FROM item_receipt_items iri

            LEFT JOIN products p
                ON p.product_id = iri.product_id

            WHERE iri.item_receipt_id = $1

            ORDER BY iri.item_receipt_item_id
            `,
            [receiptId]
        );

        const receipt = receiptResult.rows[0];

        const totalQuantity = itemsResult.rows.reduce(
            (total, item) =>
                total + Number(item.quantity_received || 0),
            0
        );

        const totalAmount = itemsResult.rows.reduce(
            (total, item) =>
                total + Number(item.line_total || 0),
            0
        );

        return NextResponse.json({
            success: true,
            receipt,
            items: itemsResult.rows,
            summary: {
                itemCount: itemsResult.rows.length,
                totalQuantity,
                totalAmount,
            },
        });

    } catch (error) {
        return apiError(error);
    }
}

// ============================================================
// PATCH: UPDATE DRAFT ITEM RECEIPT
// ============================================================

export async function PATCH(request, context) {
    const client = await pool.connect();

    let transactionStarted = false;

    try {
        const user = await getCurrentUser();

        if (!user) {
            return validationError("Unauthorized.", 401);
        }

        await requirePermission(
            user,
            "item_receipts",
            "update"
        );

        const companyId = positiveId(user.companyId);
        const userId = positiveId(user.userId);
        const receiptId = await getReceiptId(context);

        if (!companyId || !userId || !receiptId) {
            return validationError(
                "Invalid company, user or Item Receipt ID."
            );
        }

        const body = await request.json();

        await client.query("BEGIN");
        transactionStarted = true;

        // ----------------------------------------------------
        // LOCK RECEIPT
        // ----------------------------------------------------

        const receiptResult = await client.query(
            `
            SELECT *
            FROM item_receipts
            WHERE item_receipt_id = $1
              AND company_id = $2
            FOR UPDATE
            `,
            [receiptId, companyId]
        );

        if (receiptResult.rows.length === 0) {
            await client.query("ROLLBACK");
            transactionStarted = false;

            return validationError("Item Receipt not found.", 404);
        }

        const receipt = receiptResult.rows[0];

        if (String(receipt.status).toUpperCase() !== "DRAFT") {
            await client.query("ROLLBACK");
            transactionStarted = false;

            return validationError(
                "Only draft Item Receipts can be edited.",
                409
            );
        }

        // ----------------------------------------------------
        // KEEP SOURCE DOCUMENT FIXED
        // ----------------------------------------------------

        const sourceType = String(
            receipt.source_type || "MANUAL"
        ).toUpperCase();

        const purchaseOrderId =
            receipt.purchase_order_id
                ? positiveId(receipt.purchase_order_id)
                : null;

        const pendingItemReceiptId =
            receipt.pending_item_receipt_id
                ? positiveId(receipt.pending_item_receipt_id)
                : null;

        if (
            body.sourceType &&
            String(body.sourceType).toUpperCase() !== sourceType
        ) {
            throw new Error(
                "The source type cannot be changed after creating an Item Receipt."
            );
        }

        if (
            body.purchaseOrderId &&
            positiveId(body.purchaseOrderId) !== purchaseOrderId
        ) {
            throw new Error(
                "The linked Purchase Order cannot be changed."
            );
        }

        if (
            body.pendingItemReceiptId &&
            positiveId(body.pendingItemReceiptId) !== pendingItemReceiptId
        ) {
            throw new Error(
                "The linked Pending Item Receipt cannot be changed."
            );
        }

        // ----------------------------------------------------
        // HEADER VALUES
        // ----------------------------------------------------

        const supplierId =
            body.supplierId !== undefined
                ? positiveId(body.supplierId)
                : positiveId(receipt.supplier_id);

        const warehouseId =
            body.warehouseId !== undefined
                ? positiveId(body.warehouseId)
                : positiveId(receipt.warehouse_id);

        const receiptDate =
            body.receiptDate !== undefined
                ? body.receiptDate
                : String(receipt.receipt_date).slice(0, 10);

        const remarks =
            body.remarks !== undefined
                ? String(body.remarks || "").trim()
                : receipt.remarks || "";

        if (!supplierId) {
            throw new Error("Please select a valid supplier.");
        }

        if (!warehouseId) {
            throw new Error("Please select a valid warehouse.");
        }

        if (!validDate(receiptDate)) {
            throw new Error("Please provide a valid receipt date.");
        }

        // ----------------------------------------------------
        // VALIDATE SUPPLIER
        // ----------------------------------------------------

        const supplierResult = await client.query(
            `
            SELECT supplier_id, supplier_name
            FROM suppliers
            WHERE supplier_id = $1
              AND COALESCE(is_active, TRUE) = TRUE
            `,
            [supplierId]
        );

        if (supplierResult.rows.length === 0) {
            throw new Error("Supplier does not exist or is inactive.");
        }

        const supplier = supplierResult.rows[0];

        // ----------------------------------------------------
        // VALIDATE WAREHOUSE
        // ----------------------------------------------------

        const warehouseResult = await client.query(
            `
            SELECT warehouse_id, warehouse_name
            FROM warehouses
            WHERE warehouse_id = $1
              AND COALESCE(is_active, TRUE) = TRUE
            `,
            [warehouseId]
        );

        if (warehouseResult.rows.length === 0) {
            throw new Error("Warehouse does not exist or is inactive.");
        }

        // ----------------------------------------------------
        // LOCK AND VALIDATE SOURCE DOCUMENT
        // ----------------------------------------------------

        if (sourceType === "PURCHASE_ORDER") {
            const poResult = await client.query(
                `
                SELECT
                    purchase_order_id,
                    supplier_id,
                    status
                FROM purchase_orders
                WHERE purchase_order_id = $1
                  AND company_id = $2
                FOR UPDATE
                `,
                [purchaseOrderId, companyId]
            );

            if (poResult.rows.length === 0) {
                throw new Error("Linked Purchase Order not found.");
            }

            const po = poResult.rows[0];

            if (String(po.status).toUpperCase() !== "APPROVED") {
                throw new Error(
                    "Only approved Purchase Orders can be received."
                );
            }

            if (Number(po.supplier_id) !== supplierId) {
                throw new Error(
                    "Supplier does not match the Purchase Order."
                );
            }
        }

        if (sourceType === "PENDING_ITEM_RECEIPT") {
            const pendingResult = await client.query(
                `
                SELECT
                    pending_item_receipt_id,
                    supplier_id,
                    purchase_order_id,
                    status
                FROM pending_item_receipts
                WHERE pending_item_receipt_id = $1
                  AND company_id = $2
                FOR UPDATE
                `,
                [pendingItemReceiptId, companyId]
            );

            if (pendingResult.rows.length === 0) {
                throw new Error("Pending Item Receipt not found.");
            }

            const pending = pendingResult.rows[0];

            if (
                ["CANCELLED", "CLOSED"].includes(
                    String(pending.status || "").toUpperCase()
                )
            ) {
                throw new Error(
                    "This Pending Item Receipt cannot be received."
                );
            }

            if (Number(pending.supplier_id) !== supplierId) {
                throw new Error(
                    "Supplier does not match the Pending Item Receipt."
                );
            }
        }

        // ----------------------------------------------------
        // GET ITEMS
        // If body.items is omitted, preserve existing items.
        // If supplied, replace all draft items.
        // ----------------------------------------------------

        let submittedItems = body.items;

        if (submittedItems === undefined) {
            const existingItemsResult = await client.query(
                `
                SELECT *
                FROM item_receipt_items
                WHERE item_receipt_id = $1
                ORDER BY item_receipt_item_id
                `,
                [receiptId]
            );

            submittedItems = existingItemsResult.rows.map((item) => ({
                productId: item.product_id,
                purchaseOrderItemId: item.purchase_order_item_id,
                pendingItemReceiptItemId:
                    item.pending_item_receipt_item_id,
                itemDescription: item.item_description,
                uom: item.uom,
                quantityReceived: item.quantity_received,
                unitCost: item.unit_cost,
                remarks: item.remarks,
            }));
        }

        if (!Array.isArray(submittedItems) || submittedItems.length === 0) {
            throw new Error("Please add at least one receipt item.");
        }

        const normalizedItems = [];

        for (let index = 0; index < submittedItems.length; index++) {
            const item = submittedItems[index];

            const productId = item.productId
                ? positiveId(item.productId)
                : null;

            const purchaseOrderItemId = item.purchaseOrderItemId
                ? positiveId(item.purchaseOrderItemId)
                : null;

            const pendingItemReceiptItemId =
                item.pendingItemReceiptItemId
                    ? positiveId(item.pendingItemReceiptItemId)
                    : null;

            const description = String(
                item.itemDescription || ""
            ).trim();

            const uom = String(item.uom || "").trim();

            const quantity = Number(item.quantityReceived);
            const unitCost = Number(item.unitCost ?? 0);

            if (!description) {
                throw new Error(
                    `Item ${index + 1}: description is required.`
                );
            }

            if (!validQuantity(quantity)) {
                throw new Error(
                    `Item ${index + 1}: quantity must be greater than zero.`
                );
            }

            if (!validCost(unitCost)) {
                throw new Error(
                    `Item ${index + 1}: unit cost cannot be negative.`
                );
            }

            if (
                sourceType === "PURCHASE_ORDER" &&
                !purchaseOrderItemId
            ) {
                throw new Error(
                    `Item ${index + 1}: Purchase Order item reference is required.`
                );
            }

            if (
                sourceType === "PENDING_ITEM_RECEIPT" &&
                !pendingItemReceiptItemId
            ) {
                throw new Error(
                    `Item ${index + 1}: Pending Item Receipt item reference is required.`
                );
            }

            normalizedItems.push({
                productId,
                purchaseOrderItemId,
                pendingItemReceiptItemId,
                description,
                uom,
                quantity,
                unitCost,
                remarks: String(item.remarks || "").trim(),
            });
        }

        // ----------------------------------------------------
        // PREVENT DUPLICATE SOURCE ITEM REFERENCES
        // ----------------------------------------------------

        const referenceIds = normalizedItems.map((item) => {
            if (sourceType === "PURCHASE_ORDER") {
                return item.purchaseOrderItemId;
            }

            if (sourceType === "PENDING_ITEM_RECEIPT") {
                return item.pendingItemReceiptItemId;
            }

            return null;
        }).filter(Boolean);

        if (new Set(referenceIds).size !== referenceIds.length) {
            throw new Error(
                "The same source item cannot be added more than once."
            );
        }

        // ----------------------------------------------------
        // VALIDATE PRODUCTS AND SOURCE QUANTITIES
        // ----------------------------------------------------

        for (const item of normalizedItems) {
            if (item.productId) {
                const productResult = await client.query(
                    `
                    SELECT product_id, is_active
                    FROM products
                    WHERE product_id = $1
                    `,
                    [item.productId]
                );

                if (productResult.rows.length === 0) {
                    throw new Error(
                        `Product not found: ${item.description}`
                    );
                }

                if (productResult.rows[0].is_active === false) {
                    throw new Error(
                        `Product is inactive: ${item.description}`
                    );
                }
            }

            if (sourceType === "PURCHASE_ORDER") {
                const poItemResult = await client.query(
                    `
                    SELECT
                        purchase_order_item_id,
                        product_id,
                        quantity,
                        unit_price
                    FROM purchase_order_items
                    WHERE purchase_order_item_id = $1
                      AND purchase_order_id = $2
                    `,
                    [item.purchaseOrderItemId, purchaseOrderId]
                );

                if (poItemResult.rows.length === 0) {
                    throw new Error(
                        `Purchase Order item not found: ${item.description}`
                    );
                }

                const poItem = poItemResult.rows[0];

                if (
                    item.productId &&
                    Number(poItem.product_id) !== item.productId
                ) {
                    throw new Error(
                        `Product does not match Purchase Order item: ${item.description}`
                    );
                }

                const receivedResult = await client.query(
                    `
                    SELECT COALESCE(
                        SUM(iri.quantity_received),
                        0
                    ) AS received_quantity

                    FROM item_receipt_items iri

                    INNER JOIN item_receipts ir
                        ON ir.item_receipt_id = iri.item_receipt_id

                    WHERE iri.purchase_order_item_id = $1
                      AND ir.company_id = $2
                      AND UPPER(ir.status) = 'APPROVED'
                    `,
                    [item.purchaseOrderItemId, companyId]
                );

                const alreadyReceived = Number(
                    receivedResult.rows[0].received_quantity
                ) || 0;

                const remaining =
                    Number(poItem.quantity) - alreadyReceived;

                if (item.quantity > remaining + 0.000001) {
                    throw new Error(
                        `${item.description}: only ${Math.max(0, remaining)} units remain on the Purchase Order.`
                    );
                }

                if (item.unitCost === 0 && Number(poItem.unit_price) > 0) {
                    item.unitCost = Number(poItem.unit_price);
                }
            }

            if (sourceType === "PENDING_ITEM_RECEIPT") {
                const pendingItemResult = await client.query(
                    `
                    SELECT
                        pending_item_receipt_item_id,
                        product_id,
                        purchase_order_item_id,
                        quantity_expected
                    FROM pending_item_receipt_items
                    WHERE pending_item_receipt_item_id = $1
                      AND pending_item_receipt_id = $2
                    `,
                    [
                        item.pendingItemReceiptItemId,
                        pendingItemReceiptId,
                    ]
                );

                if (pendingItemResult.rows.length === 0) {
                    throw new Error(
                        `Pending receipt item not found: ${item.description}`
                    );
                }

                const pendingItem = pendingItemResult.rows[0];

                if (
                    item.productId &&
                    Number(pendingItem.product_id) !== item.productId
                ) {
                    throw new Error(
                        `Product does not match Pending Item Receipt: ${item.description}`
                    );
                }

                const pendingReceivedResult = await client.query(
                    `
                    SELECT COALESCE(
                        SUM(iri.quantity_received),
                        0
                    ) AS received_quantity

                    FROM item_receipt_items iri

                    INNER JOIN item_receipts ir
                        ON ir.item_receipt_id = iri.item_receipt_id

                    WHERE iri.pending_item_receipt_item_id = $1
                      AND ir.company_id = $2
                      AND UPPER(ir.status) = 'APPROVED'
                    `,
                    [
                        item.pendingItemReceiptItemId,
                        companyId,
                    ]
                );

                const pendingAlreadyReceived = Number(
                    pendingReceivedResult.rows[0].received_quantity
                ) || 0;

                const pendingRemaining =
                    Number(pendingItem.quantity_expected) -
                    pendingAlreadyReceived;

                if (item.quantity > pendingRemaining + 0.000001) {
                    throw new Error(
                        `${item.description}: only ${Math.max(0, pendingRemaining)} units remain on the Pending Item Receipt.`
                    );
                }

                // Also check the linked PO quantity, if applicable.
                if (
                    pendingItem.purchase_order_item_id &&
                    receipt.purchase_order_id
                ) {
                    const poItemResult = await client.query(
                        `
                        SELECT quantity
                        FROM purchase_order_items
                        WHERE purchase_order_item_id = $1
                          AND purchase_order_id = $2
                        `,
                        [
                            pendingItem.purchase_order_item_id,
                            receipt.purchase_order_id,
                        ]
                    );

                    if (poItemResult.rows.length === 0) {
                        throw new Error(
                            `Linked Purchase Order item not found: ${item.description}`
                        );
                    }

                    const poReceivedResult = await client.query(
                        `
                        SELECT COALESCE(
                            SUM(iri.quantity_received),
                            0
                        ) AS received_quantity

                        FROM item_receipt_items iri

                        INNER JOIN item_receipts ir
                            ON ir.item_receipt_id =
                                iri.item_receipt_id

                        WHERE iri.purchase_order_item_id = $1
                          AND ir.company_id = $2
                          AND UPPER(ir.status) = 'APPROVED'
                        `,
                        [
                            pendingItem.purchase_order_item_id,
                            companyId,
                        ]
                    );

                    const poAlreadyReceived = Number(
                        poReceivedResult.rows[0].received_quantity
                    ) || 0;

                    const poRemaining =
                        Number(poItemResult.rows[0].quantity) -
                        poAlreadyReceived;

                    if (item.quantity > poRemaining + 0.000001) {
                        throw new Error(
                            `${item.description}: only ${Math.max(0, poRemaining)} units remain on the Purchase Order.`
                        );
                    }
                }

                item.purchaseOrderItemId =
                    pendingItem.purchase_order_item_id
                        ? positiveId(pendingItem.purchase_order_item_id)
                        : null;
            }
        }

        // ----------------------------------------------------
        // UPDATE HEADER
        // ----------------------------------------------------

        await client.query(
            `
            UPDATE item_receipts
            SET
                supplier_id = $1,
                warehouse_id = $2,
                receipt_date = $3,
                remarks = $4,
                updated_by = $5,
                updated_at = CURRENT_TIMESTAMP

            WHERE item_receipt_id = $6
              AND company_id = $7
            `,
            [
                supplierId,
                warehouseId,
                receiptDate,
                remarks,
                userId,
                receiptId,
                companyId,
            ]
        );

        // ----------------------------------------------------
        // REPLACE DRAFT ITEMS
        // ----------------------------------------------------

        await client.query(
            `
            DELETE FROM item_receipt_items
            WHERE item_receipt_id = $1
            `,
            [receiptId]
        );

        for (const item of normalizedItems) {
            const lineTotal =
                item.quantity * item.unitCost;

            await client.query(
                `
                INSERT INTO item_receipt_items (
                    item_receipt_id,
                    purchase_order_item_id,
                    pending_item_receipt_item_id,
                    product_id,
                    item_description,
                    uom,
                    quantity_received,
                    unit_cost,
                    line_total,
                    remarks,
                    created_at
                )
                VALUES (
                    $1, $2, $3, $4, $5,
                    $6, $7, $8, $9, $10,
                    CURRENT_TIMESTAMP
                )
                `,
                [
                    receiptId,
                    item.purchaseOrderItemId,
                    item.pendingItemReceiptItemId,
                    item.productId,
                    item.description,
                    item.uom,
                    item.quantity,
                    item.unitCost,
                    lineTotal,
                    item.remarks,
                ]
            );
        }

        const updatedResult = await client.query(
            `
            SELECT *
            FROM item_receipts
            WHERE item_receipt_id = $1
              AND company_id = $2
            `,
            [receiptId, companyId]
        );

        await client.query("COMMIT");
        transactionStarted = false;

        return NextResponse.json({
            success: true,
            message: "Draft Item Receipt updated successfully.",
            receipt: updatedResult.rows[0],
        });

    } catch (error) {
        if (transactionStarted) {
            await client.query("ROLLBACK");
        }

        return apiError(error);

    } finally {
        client.release();
    }
}

// ============================================================
// DELETE: DELETE DRAFT ITEM RECEIPT
// ============================================================

export async function DELETE(request, context) {
    const client = await pool.connect();

    let transactionStarted = false;

    try {
        const user = await getCurrentUser();

        if (!user) {
            return validationError("Unauthorized.", 401);
        }

        await requirePermission(
            user,
            "item_receipts",
            "delete"
        );

        const companyId = positiveId(user.companyId);
        const receiptId = await getReceiptId(context);

        if (!companyId || !receiptId) {
            return validationError(
                "Invalid company or Item Receipt ID."
            );
        }

        await client.query("BEGIN");
        transactionStarted = true;

        const receiptResult = await client.query(
            `
            SELECT
                item_receipt_id,
                receipt_number,
                status
            FROM item_receipts
            WHERE item_receipt_id = $1
              AND company_id = $2
            FOR UPDATE
            `,
            [receiptId, companyId]
        );

        if (receiptResult.rows.length === 0) {
            await client.query("ROLLBACK");
            transactionStarted = false;

            return validationError("Item Receipt not found.", 404);
        }

        const receipt = receiptResult.rows[0];

        if (String(receipt.status).toUpperCase() !== "DRAFT") {
            await client.query("ROLLBACK");
            transactionStarted = false;

            return validationError(
                "Only draft Item Receipts can be deleted. Approved receipts must not be deleted because they have affected inventory.",
                409
            );
        }

        await client.query(
            `
            DELETE FROM item_receipts
            WHERE item_receipt_id = $1
              AND company_id = $2
            `,
            [receiptId, companyId]
        );

        // item_receipt_items are deleted automatically
        // through the ON DELETE CASCADE foreign key.

        await client.query("COMMIT");
        transactionStarted = false;

        return NextResponse.json({
            success: true,
            message: `Item Receipt ${receipt.receipt_number} deleted successfully.`,
        });

    } catch (error) {
        if (transactionStarted) {
            await client.query("ROLLBACK");
        }

        return apiError(error);

    } finally {
        client.release();
    }
}