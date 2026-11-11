
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
        throw new Error(`Invalid ${fieldName}.`);
    }

    return number;
}

function validDate(value, fieldName, required = false) {
    if (
        value === null ||
        value === undefined ||
        String(value).trim() === ""
    ) {
        if (required) {
            const error = new Error(`${fieldName} is required.`);
            error.status = 400;
            throw error;
        }

        return null;
    }

    const date = String(value).trim();

    // Require YYYY-MM-DD
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        const error = new Error(
            `Invalid ${fieldName}. Expected format: YYYY-MM-DD.`
        );
        error.status = 400;
        throw error;
    }

    // Validate using UTC to avoid timezone conversion problems.
    const [year, month, day] = date.split("-").map(Number);

    const parsed = new Date(
        Date.UTC(year, month - 1, day)
    );

    if (
        parsed.getUTCFullYear() !== year ||
        parsed.getUTCMonth() !== month - 1 ||
        parsed.getUTCDate() !== day
    ) {
        const error = new Error(`Invalid ${fieldName}.`);
        error.status = 400;
        throw error;
    }

    return date;
}

function validQuantity(value) {
    const quantity = Number(value);

    if (!Number.isFinite(quantity) || quantity <= 0) {
        throw new Error("Item quantity must be greater than zero.");
    }

    return quantity;
}

function apiError(error) {
    console.error("Pending Item Receipt API Error:", error);

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

function validationError(message) {
    const error = new Error(message);
    error.status = 400;
    return error;
}

/* -------------------------------------------------------------------------- */
/* GET: List pending receipts and dropdown data                               */
/* -------------------------------------------------------------------------- */

export async function GET() {
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

        const [
            receiptsResult,
            suppliersResult,
            purchaseOrdersResult,
            productsResult,
        ] = await Promise.all([
            pool.query(
                `
                SELECT
                    pir.*,
                    s.supplier_code,
                    s.supplier_name,
                    po.purchase_order_number,
                    COUNT(piri.pending_item_receipt_item_id)::INTEGER
                        AS item_count
                FROM pending_item_receipts pir
                LEFT JOIN suppliers s
                    ON s.supplier_id = pir.supplier_id
                LEFT JOIN purchase_orders po
                    ON po.purchase_order_id = pir.purchase_order_id
                    AND po.company_id = pir.company_id
                LEFT JOIN pending_item_receipt_items piri
                    ON piri.pending_item_receipt_id =
                       pir.pending_item_receipt_id
                WHERE pir.company_id = $1
                GROUP BY
                    pir.pending_item_receipt_id,
                    s.supplier_code,
                    s.supplier_name,
                    po.purchase_order_number
                ORDER BY
                    pir.created_at DESC,
                    pir.pending_item_receipt_id DESC
                `,
                [companyId]
            ),

            pool.query(
                `
                SELECT
                    supplier_id,
                    supplier_code,
                    supplier_name,
                    phone,
                    email
                FROM suppliers
                WHERE COALESCE(is_active, TRUE) = TRUE
                ORDER BY supplier_name
                `
            ),

            pool.query(
                `
                SELECT
                    po.purchase_order_id,
                    po.purchase_order_number,
                    po.supplier_id,
                    po.order_date,
                    po.expected_delivery_date,
                    po.status,
                    po.currency_code,
                    s.supplier_name
                FROM purchase_orders po
                LEFT JOIN suppliers s
                    ON s.supplier_id = po.supplier_id
                WHERE po.company_id = $1
                  AND po.status = 'APPROVED'
                ORDER BY po.purchase_order_id DESC
                `,
                [companyId]
            ),

            pool.query(
                `
                SELECT
                    product_id,
                    sku,
                    barcode,
                    product_name,
                    unit
                FROM products
                WHERE COALESCE(is_active, TRUE) = TRUE
                ORDER BY product_name
                `
            ),
        ]);

        return NextResponse.json({
            success: true,
            receipts: receiptsResult.rows,
            suppliers: suppliersResult.rows,
            purchaseOrders: purchaseOrdersResult.rows,
            products: productsResult.rows,
        });
    } catch (error) {
        return apiError(error);
    }
}

/* -------------------------------------------------------------------------- */
/* POST: Create pending item receipt                                           */
/* -------------------------------------------------------------------------- */

export async function POST(request) {
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
            "create"
        );

        const companyId = positiveId(user.companyId, "company");
        const userId = positiveId(user.userId, "user");

        const body = await request.json();

        const sourceType = String(
            body.sourceType || "MANUAL"
        ).toUpperCase();

        const documentDate = validDate(
            body.documentDate,
            "Document date",
            true
        );

        const expectedReceiptDate = validDate(
            body.expectedReceiptDate,
            "Expected receipt date"
        );

        const status = String(
            body.status || "PENDING"
        ).toUpperCase();

        if (!["DRAFT", "PENDING"].includes(status)) {
            throw validationError(
                "New receipts can only have DRAFT or PENDING status."
            );
        }

        if (!["MANUAL", "PURCHASE_ORDER"].includes(sourceType)) {
            throw validationError("Invalid receipt source.");
        }

        await client.query("BEGIN");

        // Lock the company row while generating the receipt number.
        // This prevents two simultaneous requests from generating
        // the same receipt number for the same company.
        const companyResult = await client.query(
            `
            SELECT company_id
            FROM companies
            WHERE company_id = $1
            FOR UPDATE
            `,
            [companyId]
        );

        if (companyResult.rowCount === 0) {
            throw validationError("Company not found.");
        }

        let supplierId;
        let purchaseOrderId = null;
        let items = [];

        /* ------------------------------------------------------------------ */
        /* Create from Purchase Order                                         */
        /* ------------------------------------------------------------------ */

        if (sourceType === "PURCHASE_ORDER") {
            purchaseOrderId = positiveId(
                body.purchaseOrderId,
                "Purchase Order"
            );

            const poResult = await client.query(
                `
                SELECT
                    purchase_order_id,
                    purchase_order_number,
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
                throw validationError(
                    "Purchase Order not found."
                );
            }

            const purchaseOrder = poResult.rows[0];

            if (purchaseOrder.status !== "APPROVED") {
                throw validationError(
                    "Only approved Purchase Orders can create Pending Item Receipts."
                );
            }

            supplierId = purchaseOrder.supplier_id;

            if (!expectedReceiptDate && purchaseOrder.expected_delivery_date) {
                body.expectedReceiptDate =
                    purchaseOrder.expected_delivery_date.toISOString
                        ? purchaseOrder.expected_delivery_date
                            .toISOString()
                            .slice(0, 10)
                        : String(purchaseOrder.expected_delivery_date)
                            .slice(0, 10);
            }

            const poItemsResult = await client.query(
                `
                SELECT
                    poi.purchase_order_item_id,
                    poi.product_id,
                    poi.item_description,
                    poi.uom,
                    poi.quantity,
                    p.sku,
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
                    "This Purchase Order does not contain any items."
                );
            }

            const requestedItems = Array.isArray(body.items)
                ? body.items
                : [];

            if (requestedItems.length > 0) {
                items = requestedItems.map((requestedItem) => {
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
            } else {
                items = poItemsResult.rows.map((item) => ({
                    purchaseOrderItemId:
                        item.purchase_order_item_id,
                    productId: item.product_id,
                    description:
                        item.item_description ||
                        item.product_name ||
                        "Purchase Order Item",
                    uom: item.uom,
                    quantity: validQuantity(item.quantity),
                    remarks: null,
                }));
            }
        }

        /* ------------------------------------------------------------------ */
        /* Create manually                                                    */
        /* ------------------------------------------------------------------ */

        else {
            if (body.purchaseOrderId) {
                throw validationError(
                    "A manually created receipt cannot have a Purchase Order reference."
                );
            }

            supplierId = positiveId(
                body.supplierId,
                "Supplier"
            );

            if (!Array.isArray(body.items) || body.items.length === 0) {
                throw validationError(
                    "Please add at least one item."
                );
            }

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
        /* Generate receipt number                                             */
        /* ------------------------------------------------------------------ */

        const year = new Date(`${documentDate}T00:00:00`)
            .getFullYear();

        const prefix = `PIR-${year}-`;

        const numberResult = await client.query(
            `
            SELECT COALESCE(
                MAX(
                    SUBSTRING(
                        receipt_number
                        FROM CHAR_LENGTH($2) + 1
                    )::INTEGER
                ),
                0
            ) AS last_number
            FROM pending_item_receipts
            WHERE company_id = $1
              AND receipt_number LIKE $2 || '%'
            `,
            [companyId, prefix]
        );

        const nextNumber =
            Number(numberResult.rows[0].last_number) + 1;

        const receiptNumber =
            `${prefix}${String(nextNumber).padStart(6, "0")}`;

        /* ------------------------------------------------------------------ */
        /* Insert header                                                       */
        /* ------------------------------------------------------------------ */

        const receiptResult = await client.query(
            `
            INSERT INTO pending_item_receipts (
                receipt_number,
                company_id,
                supplier_id,
                purchase_order_id,
                source_type,
                document_date,
                expected_receipt_date,
                status,
                remarks,
                created_by,
                updated_by
            )
            VALUES (
                $1, $2, $3, $4, $5,
                $6, $7, $8, $9, $10, $10
            )
            RETURNING *
            `,
            [
                receiptNumber,
                companyId,
                supplierId,
                purchaseOrderId,
                sourceType,
                documentDate,
                body.expectedReceiptDate || expectedReceiptDate,
                status,
                body.remarks || null,
                userId,
            ]
        );

        const receipt = receiptResult.rows[0];

        /* ------------------------------------------------------------------ */
        /* Insert items                                                        */
        /* ------------------------------------------------------------------ */

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
                    receipt.pending_item_receipt_id,
                    item.purchaseOrderItemId,
                    item.productId,
                    item.description,
                    item.uom,
                    item.quantity,
                    item.remarks,
                ]
            );
        }

        await client.query("COMMIT");

        return NextResponse.json(
            {
                success: true,
                message: "Pending Item Receipt created successfully.",
                receipt: {
                    ...receipt,
                    items,
                },
            },
            { status: 201 }
        );
    } catch (error) {
        await client.query("ROLLBACK").catch(() => {});
        return apiError(error);
    } finally {
        client.release();
    }
}
