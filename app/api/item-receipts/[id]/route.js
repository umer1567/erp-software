
import { NextResponse } from "next/server";
import { getTenantDb } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { requirePermission } from "@/lib/permissions";
import { archiveAndSoftDelete } from "@/lib/recycle-bin";

export const dynamic = "force-dynamic";

/* -------------------------------------------------------------------------- */
/* Helpers                                                                    */
/* -------------------------------------------------------------------------- */

function positiveId(value) {
    const number = Number(value);
    return Number.isInteger(number) && number > 0 ? number : null;
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

function validationError(message, status = 400) {
    return NextResponse.json({ message }, { status });
}

function apiError(error) {
    console.error("ITEM RECEIPT DETAIL API ERROR:", error);

    if (error.message === "UNAUTHORIZED") {
        return validationError(
            "You are not authorized. Please log in.",
            401
        );
    }

    if (error.message === "FORBIDDEN") {
        return validationError(
            "You do not have permission to perform this action.",
            403
        );
    }

    if (error.status) {
        return validationError(error.message, error.status);
    }

    return validationError(
        error.message || "Internal server error.",
        500
    );
}

function throwHttpError(message, status = 400) {
    const error = new Error(message);
    error.status = status;
    throw error;
}

async function getReceiptId(context) {
    const params = await context.params;
    return positiveId(params?.id);
}

function getCompanyId(user) {
    return positiveId(user?.companyId || user?.company_id);
}

function getUserId(user) {
    return positiveId(user?.userId || user?.user_id);
}

/* -------------------------------------------------------------------------- */
/* GET: SINGLE ITEM RECEIPT                                                   */
/* -------------------------------------------------------------------------- */

export async function GET(request, context) {
    try {
        const user = await getCurrentUser();

        if (!user) {
            return validationError("Unauthorized.", 401);
        }

        await requirePermission(user, "item_receipts", "view");

        const db = await getTenantDb(user);
        const companyId = getCompanyId(user);
        const receiptId = await getReceiptId(context);

        if (!companyId) {
            return validationError("Invalid company.", 400);
        }

        if (!receiptId) {
            return validationError("Invalid Item Receipt ID.");
        }

        const receiptResult = await db.query(
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
                ON po.purchase_order_id = ir.purchase_order_id

            LEFT JOIN pending_item_receipts pir
                ON pir.pending_item_receipt_id =
                    ir.pending_item_receipt_id

            WHERE ir.item_receipt_id = $1
              AND ir.company_id = $2
              AND ir.deleted_at IS NULL
            `,
            [receiptId, companyId]
        );

        if (receiptResult.rows.length === 0) {
            return validationError("Item Receipt not found.", 404);
        }

        const itemsResult = await db.query(
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
            receipt: receiptResult.rows[0],
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

/* -------------------------------------------------------------------------- */
/* PATCH: UPDATE DRAFT ITEM RECEIPT                                           */
/* -------------------------------------------------------------------------- */

export async function PATCH(request, context) {
    let client;
    let transactionStarted = false;

    try {
        const user = await getCurrentUser();

        if (!user) {
            return validationError("Unauthorized.", 401);
        }

        await requirePermission(user, "item_receipts", "update");

        const companyId = getCompanyId(user);
        const userId = getUserId(user);
        const receiptId = await getReceiptId(context);

        if (!companyId || !userId || !receiptId) {
            return validationError(
                "Invalid company, user or Item Receipt ID."
            );
        }

        const body = await request.json();
        const db = await getTenantDb(user);

        client = await db.connect();

        await client.query("BEGIN");
        transactionStarted = true;

        /* Lock active receipt belonging to this company. */

        const receiptResult = await client.query(
            `
            SELECT *
            FROM item_receipts
            WHERE item_receipt_id = $1
              AND company_id = $2
              AND deleted_at IS NULL
            FOR UPDATE
            `,
            [receiptId, companyId]
        );

        if (receiptResult.rows.length === 0) {
            throwHttpError("Item Receipt not found.", 404);
        }

        const receipt = receiptResult.rows[0];

        if (String(receipt.status || "").toUpperCase() !== "DRAFT") {
            throwHttpError(
                "Only draft Item Receipts can be edited.",
                409
            );
        }

        /* Keep the source document fixed. */

        const sourceType = String(
            receipt.source_type || "MANUAL"
        ).toUpperCase();

        const purchaseOrderId = receipt.purchase_order_id
            ? positiveId(receipt.purchase_order_id)
            : null;

        const pendingItemReceiptId = receipt.pending_item_receipt_id
            ? positiveId(receipt.pending_item_receipt_id)
            : null;

        if (
            body.sourceType &&
            String(body.sourceType).toUpperCase() !== sourceType
        ) {
            throwHttpError(
                "The source type cannot be changed after creating an Item Receipt."
            );
        }

        if (
            body.purchaseOrderId &&
            positiveId(body.purchaseOrderId) !== purchaseOrderId
        ) {
            throwHttpError(
                "The linked Purchase Order cannot be changed."
            );
        }

        if (
            body.pendingItemReceiptId &&
            positiveId(body.pendingItemReceiptId) !== pendingItemReceiptId
        ) {
            throwHttpError(
                "The linked Pending Item Receipt cannot be changed."
            );
        }

        /* Header values. */

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
            throwHttpError("Please select a valid supplier.");
        }

        if (!warehouseId) {
            throwHttpError("Please select a valid warehouse.");
        }

        if (!validDate(receiptDate)) {
            throwHttpError("Please provide a valid receipt date.");
        }

        /* Validate active supplier. */

        const supplierResult = await client.query(
            `
            SELECT supplier_id, supplier_name
            FROM suppliers
            WHERE supplier_id = $1
              AND COALESCE(is_active, TRUE) = TRUE
              AND deleted_at IS NULL
            `,
            [supplierId]
        );

        if (supplierResult.rows.length === 0) {
            throwHttpError(
                "Supplier does not exist, is inactive, or has been archived.",
                404
            );
        }

        /* Validate active warehouse. */

        const warehouseResult = await client.query(
            `
            SELECT warehouse_id, warehouse_name
            FROM warehouses
            WHERE warehouse_id = $1
              AND COALESCE(is_active, TRUE) = TRUE
              AND deleted_at IS NULL
            `,
            [warehouseId]
        );

        if (warehouseResult.rows.length === 0) {
            throwHttpError(
                "Warehouse does not exist, is inactive, or has been archived.",
                404
            );
        }

        /* Validate and lock source document. */

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
                  AND deleted_at IS NULL
                FOR UPDATE
                `,
                [purchaseOrderId, companyId]
            );

            if (poResult.rows.length === 0) {
                throwHttpError(
                    "Linked Purchase Order not found or archived.",
                    404
                );
            }

            const po = poResult.rows[0];

            if (String(po.status || "").toUpperCase() !== "APPROVED") {
                throwHttpError(
                    "Only approved Purchase Orders can be received.",
                    409
                );
            }

            if (Number(po.supplier_id) !== supplierId) {
                throwHttpError(
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
                  AND deleted_at IS NULL
                FOR UPDATE
                `,
                [pendingItemReceiptId, companyId]
            );

            if (pendingResult.rows.length === 0) {
                throwHttpError(
                    "Pending Item Receipt not found or archived.",
                    404
                );
            }

            const pending = pendingResult.rows[0];

            if (
                ["CANCELLED", "CLOSED"].includes(
                    String(pending.status || "").toUpperCase()
                )
            ) {
                throwHttpError(
                    "This Pending Item Receipt cannot be received.",
                    409
                );
            }

            if (Number(pending.supplier_id) !== supplierId) {
                throwHttpError(
                    "Supplier does not match the Pending Item Receipt."
                );
            }

            /* Validate linked PO, if this pending receipt has one. */

            if (pending.purchase_order_id) {
                const linkedPoId = positiveId(
                    pending.purchase_order_id
                );

                if (!linkedPoId) {
                    throwHttpError(
                        "The linked Purchase Order reference is invalid.",
                        409
                    );
                }

                const linkedPoResult = await client.query(
                    `
                    SELECT
                        purchase_order_id,
                        supplier_id,
                        status
                    FROM purchase_orders
                    WHERE purchase_order_id = $1
                      AND company_id = $2
                      AND deleted_at IS NULL
                    FOR UPDATE
                    `,
                    [linkedPoId, companyId]
                );

                if (linkedPoResult.rows.length === 0) {
                    throwHttpError(
                        "The Purchase Order linked to this Pending Item Receipt was not found or has been archived.",
                        404
                    );
                }

                const linkedPo = linkedPoResult.rows[0];

                if (
                    String(linkedPo.status || "").toUpperCase() !==
                    "APPROVED"
                ) {
                    throwHttpError(
                        "The linked Purchase Order is no longer approved.",
                        409
                    );
                }

                if (Number(linkedPo.supplier_id) !== supplierId) {
                    throwHttpError(
                        "Supplier does not match the linked Purchase Order."
                    );
                }
            }
        }

        /* Get submitted items or preserve existing draft items. */

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
            throwHttpError("Please add at least one receipt item.");
        }

        const normalizedItems = [];

        for (let index = 0; index < submittedItems.length; index++) {
            const item = submittedItems[index] || {};

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
                throwHttpError(
                    `Item ${index + 1}: description is required.`
                );
            }

            if (!validQuantity(quantity)) {
                throwHttpError(
                    `Item ${index + 1}: quantity must be greater than zero.`
                );
            }

            if (!validCost(unitCost)) {
                throwHttpError(
                    `Item ${index + 1}: unit cost cannot be negative.`
                );
            }

            if (item.productId && !productId) {
                throwHttpError(
                    `Item ${index + 1}: invalid product reference.`
                );
            }

            if (
                sourceType === "PURCHASE_ORDER" &&
                !purchaseOrderItemId
            ) {
                throwHttpError(
                    `Item ${index + 1}: Purchase Order item reference is required.`
                );
            }

            if (
                sourceType === "PENDING_ITEM_RECEIPT" &&
                !pendingItemReceiptItemId
            ) {
                throwHttpError(
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

        /* Prevent duplicate source item references. */

        const referenceIds = normalizedItems
            .map((item) => {
                if (sourceType === "PURCHASE_ORDER") {
                    return item.purchaseOrderItemId;
                }

                if (sourceType === "PENDING_ITEM_RECEIPT") {
                    return item.pendingItemReceiptItemId;
                }

                return null;
            })
            .filter(Boolean);

        if (new Set(referenceIds).size !== referenceIds.length) {
            throwHttpError(
                "The same source item cannot be added more than once."
            );
        }

        /* Validate products and source quantities. */

        for (const item of normalizedItems) {
            if (item.productId) {
                const productResult = await client.query(
                    `
                    SELECT product_id, is_active
                    FROM products
                    WHERE product_id = $1
                      AND COALESCE(is_active, TRUE) = TRUE
                      AND deleted_at IS NULL
                    `,
                    [item.productId]
                );

                if (productResult.rows.length === 0) {
                    throwHttpError(
                        `Product does not exist, is inactive, or has been archived: ${item.description}`,
                        404
                    );
                }
            }

            /* Purchase Order item validation. */

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
                    throwHttpError(
                        `Purchase Order item not found: ${item.description}`,
                        404
                    );
                }

                const poItem = poItemResult.rows[0];

                if (
                    item.productId &&
                    Number(poItem.product_id) !== item.productId
                ) {
                    throwHttpError(
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
                      AND ir.deleted_at IS NULL
                      AND UPPER(COALESCE(ir.status, '')) = 'APPROVED'
                    `,
                    [item.purchaseOrderItemId, companyId]
                );

                const alreadyReceived = Number(
                    receivedResult.rows[0].received_quantity
                ) || 0;

                const remaining =
                    Number(poItem.quantity) - alreadyReceived;

                if (item.quantity > remaining + 1) {
                    throwHttpError(
                        `${item.description}: only ${Math.max(0, remaining)} units remain on the Purchase Order.`,
                        409
                    );
                }

                if (
                    item.unitCost === 0 &&
                    Number(poItem.unit_price) > 0
                ) {
                    item.unitCost = Number(poItem.unit_price);
                }
            }

            /* Pending Item Receipt item validation. */

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
                    throwHttpError(
                        `Pending receipt item not found: ${item.description}`,
                        404
                    );
                }

                const pendingItem = pendingItemResult.rows[0];

                if (
                    item.productId &&
                    Number(pendingItem.product_id) !== item.productId
                ) {
                    throwHttpError(
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
                      AND ir.deleted_at IS NULL
                      AND UPPER(COALESCE(ir.status, '')) = 'APPROVED'
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

                if (item.quantity > pendingRemaining + 1) {
                    throwHttpError(
                        `${item.description}: only ${Math.max(0, pendingRemaining)} units remain on the Pending Item Receipt.`,
                        409
                    );
                }

                /* Validate linked PO quantity, if applicable. */

                if (
                    pendingItem.purchase_order_item_id &&
                    purchaseOrderId
                ) {
                    const poItemResult = await client.query(
                        `
                        SELECT quantity, unit_price
                        FROM purchase_order_items
                        WHERE purchase_order_item_id = $1
                          AND purchase_order_id = $2
                        `,
                        [
                            pendingItem.purchase_order_item_id,
                            purchaseOrderId,
                        ]
                    );

                    if (poItemResult.rows.length === 0) {
                        throwHttpError(
                            `Linked Purchase Order item not found: ${item.description}`,
                            404
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
                          AND ir.deleted_at IS NULL
                          AND UPPER(COALESCE(ir.status, '')) = 'APPROVED'
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

                    if (item.quantity > poRemaining + 1) {
                        throwHttpError(
                            `${item.description}: only ${Math.max(0, poRemaining)} units remain on the Purchase Order.`,
                            409
                        );
                    }

                    if (
                        item.unitCost === 0 &&
                        Number(poItemResult.rows[0].unit_price) > 0
                    ) {
                        item.unitCost = Number(
                            poItemResult.rows[0].unit_price
                        );
                    }
                }

                item.purchaseOrderItemId =
                    pendingItem.purchase_order_item_id
                        ? positiveId(pendingItem.purchase_order_item_id)
                        : null;
            }
        }

        /* Update draft header. */

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
              AND deleted_at IS NULL
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

        /* Replace draft items only. Preserve source references. */

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
              AND deleted_at IS NULL
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
        if (transactionStarted && client) {
            try {
                await client.query("ROLLBACK");
            } catch (rollbackError) {
                console.error(
                    "ITEM RECEIPT UPDATE ROLLBACK ERROR:",
                    rollbackError
                );
            }
            transactionStarted = false;
        }

        return apiError(error);
    } finally {
        client?.release();
    }
}

/* -------------------------------------------------------------------------- */
/* DELETE: ARCHIVE DRAFT ITEM RECEIPT                                         */
/* -------------------------------------------------------------------------- */

export async function DELETE(request, context) {
    try {
        const user = await getCurrentUser();

        if (!user) {
            return validationError("Unauthorized.", 401);
        }

        await requirePermission(user, "item_receipts", "delete");

        const companyId = getCompanyId(user);
        const receiptId = await getReceiptId(context);

        if (!companyId || !receiptId) {
            return validationError(
                "Invalid company or Item Receipt ID."
            );
        }

        const db = await getTenantDb(user);

        const result = await archiveAndSoftDelete(
            { user, db, companyId },
            {
                moduleKey: "item_receipts",
                recordId: receiptId,
                deletionReason: "Item Receipt archived by user",

                validateRecord: async (client, record) => {
                    /* Only draft receipts can be archived. */

                    if (
                        String(record.status || "").toUpperCase() !==
                        "DRAFT"
                    ) {
                        return {
                            status: 409,
                            message:
                                "Only draft Item Receipts can be archived. Approved receipts must remain because they may have affected inventory and accounting history.",
                        };
                    }

                    /*
                     * The FK check confirmed:
                     * purchases.item_receipt_id references
                     * item_receipts.item_receipt_id with RESTRICT.
                     *
                     * Protect this relationship before archiving.
                     */

                    const linkedPurchaseResult = await client.query(
                        `
                        SELECT 1
                        FROM purchases
                        WHERE item_receipt_id = $1
                        LIMIT 1
                        `,
                        [record.item_receipt_id]
                    );

                    if (linkedPurchaseResult.rows.length > 0) {
                        return {
                            status: 409,
                            message:
                                "This Item Receipt cannot be archived because it is linked to a Purchase transaction.",
                        };
                    }

                    /*
                     * item_receipt_items has ON DELETE CASCADE.
                     * The archive helper performs a soft delete only,
                     * so these child lines remain untouched.
                     *
                     * No stock or accounting changes are performed here.
                     */

                    return null;
                },
            }
        );

        if (!result.success) {
            return validationError(
                result.message || "Unable to archive Item Receipt.",
                result.status || 400
            );
        }

        return NextResponse.json({
            success: true,
            message: "Item Receipt moved to Recycle Bin successfully.",
            archiveId: result.archiveId,
            receipt: result.record,
        });
    } catch (error) {
        return apiError(error);
    }
}
