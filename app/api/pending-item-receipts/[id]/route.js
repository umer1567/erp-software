
import { NextResponse } from "next/server";
import pool from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { requirePermission } from "@/lib/permissions";

/* -------------------------------------------------------------------------- */
/* Helpers                                                                    */
/* -------------------------------------------------------------------------- */

function positiveId(value, fieldName) {
    const number = Number(value);

    if (!Number.isInteger(number) || number <= 0) {
        const error = new Error(`Invalid ${fieldName}.`);
        error.status = 400;
        throw error;
    }

    return number;
}

function validationError(message) {
    const error = new Error(message);
    error.status = 400;
    return error;
}

function validDate(value, fieldName, required = false) {
    if (!value) {
        if (required) {
            throw validationError(`${fieldName} is required.`);
        }

        return null;
    }

    const date = String(value);

    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        throw validationError(`Invalid ${fieldName}.`);
    }

    const parsed = new Date(`${date}T00:00:00`);

    if (
        Number.isNaN(parsed.getTime()) ||
        parsed.toISOString().slice(0, 10) !== date
    ) {
        throw validationError(`Invalid ${fieldName}.`);
    }

    return date;
}

function validQuantity(value) {
    const quantity = Number(value);

    if (!Number.isFinite(quantity) || quantity <= 0) {
        throw validationError(
            "Item quantity must be greater than zero."
        );
    }

    return quantity;
}

function apiError(error) {
    console.error("Pending Item Receipt Detail API Error:", error);

    return NextResponse.json(
        {
            success: false,
            message: error.message || "Internal server error.",
        },
        {
            status: error.status || error.statusCode || 500,
        }
    );
}

/* -------------------------------------------------------------------------- */
/* GET: Get one pending item receipt                                           */
/* -------------------------------------------------------------------------- */

export async function GET(request, { params }) {
    try {
        const user = await getCurrentUser();

        if (!user) {
            return NextResponse.json(
                { success: false, message: "Unauthorized." },
                { status: 401 }
            );
        }

        await requirePermission(
            user,
            "pending_item_receipts",
            "view"
        );

        const companyId = positiveId(user.companyId, "company");
        const { id } = await params;
        const receiptId = positiveId(id, "receipt ID");

        const receiptResult = await pool.query(
            `
            SELECT
                pir.*,
                s.supplier_code,
                s.supplier_name,
                s.phone AS supplier_phone,
                s.email AS supplier_email,
                s.address AS supplier_address,
                po.purchase_order_number
            FROM pending_item_receipts pir
            LEFT JOIN suppliers s
                ON s.supplier_id = pir.supplier_id
            LEFT JOIN purchase_orders po
                ON po.purchase_order_id = pir.purchase_order_id
                AND po.company_id = pir.company_id
            WHERE pir.pending_item_receipt_id = $1
              AND pir.company_id = $2
            `,
            [receiptId, companyId]
        );

        if (receiptResult.rowCount === 0) {
            return NextResponse.json(
                {
                    success: false,
                    message: "Pending Item Receipt not found.",
                },
                { status: 404 }
            );
        }

        const itemsResult = await pool.query(
            `
            SELECT
                piri.pending_item_receipt_item_id,
                piri.pending_item_receipt_id,
                piri.purchase_order_item_id,
                piri.product_id,
                piri.item_description,
                piri.uom,
                piri.quantity_expected,
                piri.remarks,
                p.sku,
                p.barcode,
                p.product_name
            FROM pending_item_receipt_items piri
            LEFT JOIN products p
                ON p.product_id = piri.product_id
            WHERE piri.pending_item_receipt_id = $1
            ORDER BY piri.pending_item_receipt_item_id
            `,
            [receiptId]
        );

        return NextResponse.json({
            success: true,
            receipt: {
                ...receiptResult.rows[0],
                items: itemsResult.rows,
            },
        });
    } catch (error) {
        return apiError(error);
    }
}

/* -------------------------------------------------------------------------- */
/* PATCH: Update pending item receipt                                          */
/* -------------------------------------------------------------------------- */

export async function PATCH(request, { params }) {
    const client = await pool.connect();

    try {
        const user = await getCurrentUser();

        if (!user) {
            return NextResponse.json(
                { success: false, message: "Unauthorized." },
                { status: 401 }
            );
        }

        await requirePermission(
            user,
            "pending_item_receipts",
            "update"
        );

        const companyId = positiveId(user.companyId, "company");
        const userId = positiveId(user.userId, "user");

        const { id } = await params;
        const receiptId = positiveId(id, "receipt ID");

        const body = await request.json();

        await client.query("BEGIN");

        const existingResult = await client.query(
            `
            SELECT *
            FROM pending_item_receipts
            WHERE pending_item_receipt_id = $1
              AND company_id = $2
            FOR UPDATE
            `,
            [receiptId, companyId]
        );

        if (existingResult.rowCount === 0) {
            throw Object.assign(
                new Error("Pending Item Receipt not found."),
                { status: 404 }
            );
        }

        const existing = existingResult.rows[0];

        if (existing.status === "CANCELLED") {
            throw validationError(
                "A cancelled Pending Item Receipt cannot be edited."
            );
        }

        const sourceType = String(
            body.sourceType || existing.source_type
        ).toUpperCase();

        if (!["MANUAL", "PURCHASE_ORDER"].includes(sourceType)) {
            throw validationError("Invalid receipt source.");
        }

        const documentDate = validDate(
            body.documentDate || existing.document_date.toISOString?.().slice(0, 10) ||
                String(existing.document_date).slice(0, 10),
            "Document date",
            true
        );

        const expectedReceiptDate = validDate(
            body.expectedReceiptDate === undefined
                ? (
                    existing.expected_receipt_date
                        ? String(existing.expected_receipt_date).slice(0, 10)
                        : null
                )
                : body.expectedReceiptDate,
            "Expected receipt date"
        );

        const status = String(
            body.status || existing.status
        ).toUpperCase();

        if (!["DRAFT", "PENDING", "CANCELLED"].includes(status)) {
            throw validationError("Invalid receipt status.");
        }

        let supplierId;
        let purchaseOrderId = null;
        let items = [];

        /* ------------------------------------------------------------------ */
        /* Purchase Order source                                               */
        /* ------------------------------------------------------------------ */

        if (sourceType === "PURCHASE_ORDER") {
            purchaseOrderId = positiveId(
                body.purchaseOrderId || existing.purchase_order_id,
                "Purchase Order"
            );

            const poResult = await client.query(
                `
                SELECT
                    purchase_order_id,
                    supplier_id,
                    status,
                    expected_delivery_date
                FROM purchase_orders
                WHERE purchase_order_id = $1
                  AND company_id = $2
                FOR UPDATE
                `,
                [purchaseOrderId, companyId]
            );

            if (poResult.rowCount === 0) {
                throw validationError("Purchase Order not found.");
            }

            const purchaseOrder = poResult.rows[0];

            if (purchaseOrder.status !== "APPROVED") {
                throw validationError(
                    "Only approved Purchase Orders can be used."
                );
            }

            supplierId = purchaseOrder.supplier_id;

            const poItemsResult = await client.query(
                `
                SELECT
                    poi.purchase_order_item_id,
                    poi.product_id,
                    poi.item_description,
                    poi.uom,
                    poi.quantity,
                    p.product_name
                FROM purchase_order_items poi
                LEFT JOIN products p
                    ON p.product_id = poi.product_id
                WHERE poi.purchase_order_id = $1
                ORDER BY poi.purchase_order_item_id
                `,
                [purchaseOrderId]
            );

            if (poItemsResult.rowCount === 0) {
                throw validationError(
                    "The selected Purchase Order has no items."
                );
            }

            if (body.items === undefined) {
                const existingItemsResult = await client.query(
                    `
                    SELECT
                        purchase_order_item_id,
                        quantity_expected,
                        remarks
                    FROM pending_item_receipt_items
                    WHERE pending_item_receipt_id = $1
                    `,
                    [receiptId]
                );

                items = existingItemsResult.rows.map((oldItem) => {
                    const poItem = poItemsResult.rows.find(
                        (item) =>
                            Number(item.purchase_order_item_id) ===
                            Number(oldItem.purchase_order_item_id)
                    );

                    if (!poItem) {
                        throw validationError(
                            "An existing receipt item no longer belongs to this Purchase Order."
                        );
                    }

                    return {
                        purchaseOrderItemId:
                            poItem.purchase_order_item_id,
                        productId: poItem.product_id,
                        description:
                            poItem.item_description ||
                            poItem.product_name ||
                            "Purchase Order Item",
                        uom: poItem.uom,
                        quantity: validQuantity(
                            oldItem.quantity_expected
                        ),
                        remarks: oldItem.remarks,
                    };
                });
            } else {
                if (
                    !Array.isArray(body.items) ||
                    body.items.length === 0
                ) {
                    throw validationError(
                        "Please add at least one item."
                    );
                }

                items = body.items.map((requestedItem) => {
                    const poItem = poItemsResult.rows.find(
                        (item) =>
                            Number(item.purchase_order_item_id) ===
                            Number(requestedItem.purchaseOrderItemId)
                    );

                    if (!poItem) {
                        throw validationError(
                            "An item does not belong to the selected Purchase Order."
                        );
                    }

                    return {
                        purchaseOrderItemId:
                            poItem.purchase_order_item_id,
                        productId: poItem.product_id,
                        description:
                            poItem.item_description ||
                            poItem.product_name ||
                            "Purchase Order Item",
                        uom: poItem.uom,
                        quantity: validQuantity(
                            requestedItem.quantityExpected
                        ),
                        remarks: requestedItem.remarks || null,
                    };
                });
            }
        }

        /* ------------------------------------------------------------------ */
        /* Manual source                                                       */
        /* ------------------------------------------------------------------ */

        else {
            if (body.purchaseOrderId) {
                throw validationError(
                    "A manual receipt cannot have a Purchase Order reference."
                );
            }

            supplierId = positiveId(
                body.supplierId || existing.supplier_id,
                "Supplier"
            );

            const supplierResult = await client.query(
                `
                SELECT supplier_id
                FROM suppliers
                WHERE supplier_id = $1
                  AND COALESCE(is_active, TRUE) = TRUE
                `,
                [supplierId]
            );

            if (supplierResult.rowCount === 0) {
                throw validationError(
                    "Supplier not found or inactive."
                );
            }

            if (body.items === undefined) {
                const existingItemsResult = await client.query(
                    `
                    SELECT
                        purchase_order_item_id,
                        product_id,
                        item_description,
                        uom,
                        quantity_expected,
                        remarks
                    FROM pending_item_receipt_items
                    WHERE pending_item_receipt_id = $1
                    ORDER BY pending_item_receipt_item_id
                    `,
                    [receiptId]
                );

                items = existingItemsResult.rows.map((item) => ({
                    purchaseOrderItemId: null,
                    productId: item.product_id,
                    description: item.item_description,
                    uom: item.uom,
                    quantity: validQuantity(item.quantity_expected),
                    remarks: item.remarks,
                }));
            } else {
                if (
                    !Array.isArray(body.items) ||
                    body.items.length === 0
                ) {
                    throw validationError(
                        "Please add at least one item."
                    );
                }

                items = body.items.map((item) => ({
                    purchaseOrderItemId: null,
                    productId: item.productId
                        ? positiveId(item.productId, "Product")
                        : null,
                    description: String(
                        item.description || item.itemDescription || ""
                    ).trim(),
                    uom: item.uom
                        ? String(item.uom).trim()
                        : null,
                    quantity: validQuantity(item.quantityExpected),
                    remarks: item.remarks || null,
                }));

                for (const item of items) {
                    if (!item.description) {
                        throw validationError(
                            "Every item must have a description."
                        );
                    }
                }
            }

            const productIds = [
                ...new Set(
                    items
                        .map((item) => item.productId)
                        .filter(Boolean)
                ),
            ];

            if (productIds.length > 0) {
                const productResult = await client.query(
                    `
                    SELECT product_id
                    FROM products
                    WHERE product_id = ANY($1::INTEGER[])
                    `,
                    [productIds]
                );

                if (productResult.rowCount !== productIds.length) {
                    throw validationError(
                        "One or more selected products do not exist."
                    );
                }
            }
        }

        /* ------------------------------------------------------------------ */
        /* Update header                                                       */
        /* ------------------------------------------------------------------ */

        const updateResult = await client.query(
            `
            UPDATE pending_item_receipts
            SET
                supplier_id = $1,
                purchase_order_id = $2,
                source_type = $3,
                document_date = $4,
                expected_receipt_date = $5,
                status = $6,
                remarks = $7,
                updated_by = $8,
                updated_at = CURRENT_TIMESTAMP
            WHERE pending_item_receipt_id = $9
              AND company_id = $10
            RETURNING *
            `,
            [
                supplierId,
                purchaseOrderId,
                sourceType,
                documentDate,
                expectedReceiptDate,
                status,
                body.remarks === undefined
                    ? existing.remarks
                    : body.remarks,
                userId,
                receiptId,
                companyId,
            ]
        );

        /* ------------------------------------------------------------------ */
        /* Replace receipt items                                               */
        /* ------------------------------------------------------------------ */

        if (body.items !== undefined) {
            await client.query(
                `
                DELETE FROM pending_item_receipt_items
                WHERE pending_item_receipt_id = $1
                `,
                [receiptId]
            );

            for (const item of items) {
                await client.query(
                    `
                    INSERT INTO pending_item_receipt_items (
                        pending_item_receipt_id,
                        purchase_order_item_id,
                        product_id,
                        item_description,
                        uom,
                        quantity_expected,
                        remarks
                    )
                    VALUES ($1, $2, $3, $4, $5, $6, $7)
                    `,
                    [
                        receiptId,
                        item.purchaseOrderItemId,
                        item.productId,
                        item.description,
                        item.uom,
                        item.quantity,
                        item.remarks,
                    ]
                );
            }
        }

        // If the source type changed, rebuild the items using the new source.
        if (sourceType !== existing.source_type && body.items === undefined) {
            await client.query(
                `
                DELETE FROM pending_item_receipt_items
                WHERE pending_item_receipt_id = $1
                `,
                [receiptId]
            );

            for (const item of items) {
                await client.query(
                    `
                    INSERT INTO pending_item_receipt_items (
                        pending_item_receipt_id,
                        purchase_order_item_id,
                        product_id,
                        item_description,
                        uom,
                        quantity_expected,
                        remarks
                    )
                    VALUES ($1, $2, $3, $4, $5, $6, $7)
                    `,
                    [
                        receiptId,
                        item.purchaseOrderItemId,
                        item.productId,
                        item.description,
                        item.uom,
                        item.quantity,
                        item.remarks,
                    ]
                );
            }
        }

        await client.query("COMMIT");

        return NextResponse.json({
            success: true,
            message: "Pending Item Receipt updated successfully.",
            receipt: {
                ...updateResult.rows[0],
                items,
            },
        });
    } catch (error) {
        await client.query("ROLLBACK").catch(() => {});
        return apiError(error);
    } finally {
        client.release();
    }
}

/* -------------------------------------------------------------------------- */
/* DELETE: Delete pending item receipt                                         */
/* -------------------------------------------------------------------------- */

export async function DELETE(request, { params }) {
    const client = await pool.connect();

    try {
        const user = await getCurrentUser();

        if (!user) {
            return NextResponse.json(
                { success: false, message: "Unauthorized." },
                { status: 401 }
            );
        }

        await requirePermission(
            user,
            "pending_item_receipts",
            "delete"
        );

        const companyId = positiveId(user.companyId, "company");
        const { id } = await params;
        const receiptId = positiveId(id, "receipt ID");

        await client.query("BEGIN");

        const existingResult = await client.query(
            `
            SELECT
                pending_item_receipt_id,
                receipt_number,
                status
            FROM pending_item_receipts
            WHERE pending_item_receipt_id = $1
              AND company_id = $2
            FOR UPDATE
            `,
            [receiptId, companyId]
        );

        if (existingResult.rowCount === 0) {
            throw Object.assign(
                new Error("Pending Item Receipt not found."),
                { status: 404 }
            );
        }

        const receipt = existingResult.rows[0];

        if (receipt.status === "CANCELLED") {
            throw validationError(
                "This Pending Item Receipt is already cancelled."
            );
        }

        await client.query(
            `
            DELETE FROM pending_item_receipts
            WHERE pending_item_receipt_id = $1
              AND company_id = $2
            `,
            [receiptId, companyId]
        );

        // Child items are deleted automatically through ON DELETE CASCADE.

        await client.query("COMMIT");

        return NextResponse.json({
            success: true,
            message: `Pending Item Receipt ${receipt.receipt_number} deleted successfully.`,
        });
    } catch (error) {
        await client.query("ROLLBACK").catch(() => {});
        return apiError(error);
    } finally {
        client.release();
    }
}
