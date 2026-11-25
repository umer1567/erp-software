
import { NextResponse } from "next/server";
import { getTenantDb } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { requirePermission } from "@/lib/permissions";
import { archiveAndSoftDelete } from "@/lib/recycle-bin";

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

function validationError(message, status = 400) {
    const error = new Error(message);
    error.status = status;
    return error;
}

function validDate(value, fieldName, required = false) {
    if (
        value === null ||
        value === undefined ||
        String(value).trim() === ""
    ) {
        if (required) {
            throw validationError(`${fieldName} is required.`);
        }

        return null;
    }

    const date = String(value).trim();

    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        throw validationError(`Invalid ${fieldName}.`);
    }

    const [year, month, day] = date.split("-").map(Number);
    const parsed = new Date(Date.UTC(year, month - 1, day));

    if (
        parsed.getUTCFullYear() !== year ||
        parsed.getUTCMonth() !== month - 1 ||
        parsed.getUTCDate() !== day
    ) {
        throw validationError(`Invalid ${fieldName}.`);
    }

    return date;
}

function dateToInputValue(value) {
    if (!value) return null;

    if (value instanceof Date) {
        return value.toISOString().slice(0, 10);
    }

    return String(value).slice(0, 10);
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
/* GET: Get one active pending item receipt                                   */
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

        const db = await getTenantDb(user);

        const companyId = positiveId(
            user.companyId || user.company_id,
            "company"
        );

        const { id } = await params;
        const receiptId = positiveId(id, "receipt ID");

        const receiptResult = await db.query(
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
                AND s.company_id = pir.company_id
            LEFT JOIN purchase_orders po
                ON po.purchase_order_id = pir.purchase_order_id
                AND po.company_id = pir.company_id
            WHERE pir.pending_item_receipt_id = $1
              AND pir.company_id = $2
              AND pir.deleted_at IS NULL
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

        const itemsResult = await db.query(
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
/* PATCH: Update pending item receipt                                         */
/* -------------------------------------------------------------------------- */

export async function PATCH(request, { params }) {
    let client;

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

        const companyId = positiveId(
            user.companyId || user.company_id,
            "company"
        );

        const userId = positiveId(
            user.userId || user.user_id,
            "user"
        );

        const { id } = await params;
        const receiptId = positiveId(id, "receipt ID");
        const body = await request.json();

        const db = await getTenantDb(user);
        client = await db.connect();

        await client.query("BEGIN");

        const existingResult = await client.query(
            `
            SELECT *
            FROM pending_item_receipts
            WHERE pending_item_receipt_id = $1
              AND company_id = $2
              AND deleted_at IS NULL
            FOR UPDATE
            `,
            [receiptId, companyId]
        );

        if (existingResult.rowCount === 0) {
            throw validationError(
                "Pending Item Receipt not found.",
                404
            );
        }

        const existing = existingResult.rows[0];

        if (existing.status === "CANCELLED") {
            throw validationError(
                "A cancelled Pending Item Receipt cannot be edited."
            );
        }

        /*
         * Once an Item Receipt is created from this Pending Item Receipt,
         * its source document and child lines must remain unchanged.
         */
        const linkedReceiptResult = await client.query(
            `
            SELECT item_receipt_id
            FROM item_receipts
            WHERE pending_item_receipt_id = $1
              AND company_id = $2
            LIMIT 1
            `,
            [receiptId, companyId]
        );

        if (linkedReceiptResult.rowCount > 0) {
            throw validationError(
                "This Pending Item Receipt cannot be edited because an Item Receipt is already linked to it.",
                409
            );
        }

        const sourceType = String(
            body.sourceType || existing.source_type
        ).toUpperCase();

        if (!["MANUAL", "PURCHASE_ORDER"].includes(sourceType)) {
            throw validationError("Invalid receipt source.");
        }

        const documentDate = validDate(
            body.documentDate === undefined
                ? dateToInputValue(existing.document_date)
                : body.documentDate,
            "Document date",
            true
        );

        const expectedReceiptDate = validDate(
            body.expectedReceiptDate === undefined
                ? dateToInputValue(existing.expected_receipt_date)
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
                    po.purchase_order_id,
                    po.supplier_id,
                    po.status,
                    po.expected_delivery_date
                FROM purchase_orders po
                INNER JOIN suppliers s
                    ON s.supplier_id = po.supplier_id
                    AND s.company_id = po.company_id
                WHERE po.purchase_order_id = $1
                  AND po.company_id = $2
                  AND po.deleted_at IS NULL
                  AND COALESCE(s.is_active, TRUE) = TRUE
                  AND s.deleted_at IS NULL
                FOR UPDATE OF po
                `,
                [purchaseOrderId, companyId]
            );

            if (poResult.rowCount === 0) {
                throw validationError(
                    "Purchase Order not found, archived, or its supplier is inactive."
                );
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
                  AND company_id = $2
                  AND COALESCE(is_active, TRUE) = TRUE
                  AND deleted_at IS NULL
                `,
                [supplierId, companyId]
            );

            if (supplierResult.rowCount === 0) {
                throw validationError(
                    "Supplier not found, archived, or inactive."
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
                      AND COALESCE(is_active, TRUE) = TRUE
                      AND deleted_at IS NULL
                    `,
                    [productIds]
                );

                if (productResult.rowCount !== productIds.length) {
                    throw validationError(
                        "One or more selected products do not exist, are archived, or are inactive."
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
              AND deleted_at IS NULL
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

        if (updateResult.rowCount === 0) {
            throw validationError(
                "Pending Item Receipt was not found or is archived.",
                404
            );
        }

        /* ------------------------------------------------------------------ */
        /* Replace receipt items when requested or source changes             */
        /* ------------------------------------------------------------------ */

        const shouldReplaceItems =
            body.items !== undefined ||
            sourceType !== existing.source_type;

        if (shouldReplaceItems) {
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
        await client?.query("ROLLBACK").catch(() => {});
        return apiError(error);
    } finally {
        client?.release();
    }
}

/* -------------------------------------------------------------------------- */
/* DELETE: Archive pending item receipt                                       */
/* -------------------------------------------------------------------------- */

export async function DELETE(request, { params }) {
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

        const companyId = positiveId(
            user.companyId || user.company_id,
            "company"
        );

        const { id } = await params;
        const receiptId = positiveId(id, "receipt ID");

        const db = await getTenantDb(user);

        const result = await archiveAndSoftDelete(
            { user, db, companyId },
            {
                moduleKey: "pending_item_receipts",
                recordId: receiptId,
                deletionReason:
                    "Pending Item Receipt archived by user",

                validateRecord: async (client, record) => {
                    if (record.status === "CANCELLED") {
                        return {
                            status: 409,
                            message:
                                "This Pending Item Receipt is already cancelled and cannot be archived.",
                        };
                    }

                    const linkedReceiptResult = await client.query(
                        `
                        SELECT item_receipt_id
                        FROM item_receipts
                        WHERE pending_item_receipt_id = $1
                          AND company_id = $2
                        LIMIT 1
                        `,
                        [receiptId, companyId]
                    );

                    if (linkedReceiptResult.rowCount > 0) {
                        return {
                            status: 409,
                            message:
                                "This Pending Item Receipt cannot be archived because an Item Receipt is linked to it. Preserve the receiving history.",
                        };
                    }

                    return null;
                },
            }
        );

        if (!result.success) {
            return NextResponse.json(
                {
                    success: false,
                    message:
                        result.message ||
                        "Unable to archive Pending Item Receipt.",
                },
                { status: result.status || 400 }
            );
        }

        return NextResponse.json({
            success: true,
            message:
                "Pending Item Receipt moved to Recycle Bin successfully.",
            archiveId: result.archiveId,
            receipt: result.record,
        });
    } catch (error) {
        return apiError(error);
    }
}
