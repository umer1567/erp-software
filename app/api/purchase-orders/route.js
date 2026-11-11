
import { NextResponse } from "next/server";
import pool from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { requirePermission } from "@/lib/permissions";

/* -------------------------------------------------------------------------- */
/* Constants                                                                  */
/* -------------------------------------------------------------------------- */

const ALLOWED_STATUSES = [
    "DRAFT",
    "PENDING",
    "APPROVED",
    "REJECTED",
    "CLOSED",
    "CANCELLED",
];

const MAX_ITEMS = 500;

/* -------------------------------------------------------------------------- */
/* Helpers                                                                    */
/* -------------------------------------------------------------------------- */

function apiError(error) {
    console.error("Purchase Orders API Error:", error);

    const status =
        Number(error?.status || error?.statusCode) >= 400 &&
        Number(error?.status || error?.statusCode) < 600
            ? Number(error.status || error.statusCode)
            : 500;

    return NextResponse.json(
        {
            success: false,
            message:
                error?.message ||
                "An unexpected error occurred while processing the purchase order.",
        },
        { status }
    );
}

function validationError(message, status = 400) {
    const error = new Error(message);
    error.status = status;
    return error;
}

function positiveId(value, fieldName) {
    const id = Number(value);

    if (!Number.isInteger(id) || id <= 0) {
        throw validationError(`Invalid ${fieldName}.`);
    }

    return id;
}

function decimal(value, fieldName, options = {}) {
    const { allowZero = true, defaultValue = null } = options;

    if (
        value === undefined ||
        value === null ||
        value === ""
    ) {
        if (defaultValue !== null) {
            return defaultValue;
        }

        throw validationError(`${fieldName} is required.`);
    }

    const number = Number(value);

    if (!Number.isFinite(number)) {
        throw validationError(`${fieldName} must be a valid number.`);
    }

    if (allowZero ? number < 0 : number <= 0) {
        throw validationError(
            allowZero
                ? `${fieldName} cannot be negative.`
                : `${fieldName} must be greater than zero.`
        );
    }

    return number;
}

function validDate(value, fieldName, required = false) {
    if (!value) {
        if (required) {
            throw validationError(`${fieldName} is required.`);
        }

        return null;
    }

    const date = String(value).slice(0, 10);

    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        throw validationError(`${fieldName} must use YYYY-MM-DD format.`);
    }

    const parsed = new Date(`${date}T00:00:00.000Z`);

    if (
        Number.isNaN(parsed.getTime()) ||
        parsed.toISOString().slice(0, 10) !== date
    ) {
        throw validationError(`${fieldName} is not a valid date.`);
    }

    return date;
}

function validStatus(value, defaultValue = "DRAFT") {
    const status = String(value || defaultValue)
        .trim()
        .toUpperCase();

    if (!ALLOWED_STATUSES.includes(status)) {
        throw validationError(`Invalid purchase order status: ${status}.`);
    }

    return status;
}

function roundMoney(value) {
    return Math.round((Number(value) + Number.EPSILON) * 100) / 100;
}

function getOrderNumberYear(orderDate) {
    return orderDate
        ? String(orderDate).slice(0, 4)
        : String(new Date().getFullYear());
}

/* -------------------------------------------------------------------------- */
/* Generate Purchase Order Number                                             */
/* -------------------------------------------------------------------------- */

async function generatePurchaseOrderNumber(client, companyId, orderDate) {
    const year = getOrderNumberYear(orderDate);

    // Serialize number generation for this company.
    await client.query(
        "SELECT pg_advisory_xact_lock($1::integer, $2::integer)",
        [companyId, 7142026]
    );

    const result = await client.query(
        `
        SELECT
            COALESCE(
                MAX(
                    NULLIF(
                        regexp_replace(
                            purchase_order_number,
                            '^PO-[0-9]{4}-',
                            ''
                        ),
                        ''
                    )::INTEGER
                ),
                0
            ) AS last_number
        FROM purchase_orders
        WHERE company_id = $1
          AND purchase_order_number ~ $2
        `,
        [
            companyId,
            `^PO-${year}-[0-9]+$`,
        ]
    );

    const nextNumber = Number(result.rows[0]?.last_number || 0) + 1;

    return `PO-${year}-${String(nextNumber).padStart(6, "0")}`;
}

/* -------------------------------------------------------------------------- */
/* Validate Manual Purchase Order Items                                        */
/* -------------------------------------------------------------------------- */

function prepareManualItems(items) {
    if (!Array.isArray(items) || items.length === 0) {
        throw validationError("At least one purchase order item is required.");
    }

    if (items.length > MAX_ITEMS) {
        throw validationError(`A maximum of ${MAX_ITEMS} items is allowed.`);
    }

    return items.map((item, index) => {
        const itemNumber = index + 1;

        const productId =
            item.productId === null ||
            item.productId === undefined ||
            item.productId === ""
                ? null
                : positiveId(item.productId, `Product ID on item ${itemNumber}`);

        const itemDescription = String(
            item.itemDescription || ""
        ).trim();

        if (!itemDescription) {
            throw validationError(
                `Item description is required on item ${itemNumber}.`
            );
        }

        const quantity = decimal(
            item.quantity,
            `Quantity on item ${itemNumber}`,
            { allowZero: false }
        );

        const unitPrice = decimal(
            item.unitPrice,
            `Unit price on item ${itemNumber}`
        );

        const discountAmount = roundMoney(
            decimal(
                item.discountAmount,
                `Discount on item ${itemNumber}`,
                { defaultValue: 0 }
            )
        );

        const baseAmount = roundMoney(quantity * unitPrice);

        if (discountAmount > baseAmount) {
            throw validationError(
                `Discount cannot exceed the item amount on item ${itemNumber}.`
            );
        }

        const taxRate = decimal(
            item.taxRate,
            `Tax rate on item ${itemNumber}`,
            { defaultValue: 0 }
        );

        const taxableAmount = roundMoney(baseAmount - discountAmount);

        const taxAmount =
            item.taxAmount !== undefined &&
            item.taxAmount !== null &&
            item.taxAmount !== ""
                ? roundMoney(
                    decimal(
                        item.taxAmount,
                        `Tax amount on item ${itemNumber}`
                    )
                )
                : roundMoney((taxableAmount * taxRate) / 100);

        const lineTotal = roundMoney(taxableAmount + taxAmount);

        return {
            productId,
            itemDescription,
            uom: item.uom ? String(item.uom).trim() : null,
            quantity,
            unitPrice,
            discountAmount,
            taxRate,
            taxAmount,
            lineTotal,
            remarks: item.remarks
                ? String(item.remarks).trim()
                : null,
        };
    });
}

/* -------------------------------------------------------------------------- */
/* Insert Purchase Order Items                                                 */
/* -------------------------------------------------------------------------- */

async function insertPurchaseOrderItems(
    client,
    purchaseOrderId,
    items
) {
    for (const item of items) {
        if (item.productId) {
            const productResult = await client.query(
                `
                SELECT product_id
                FROM products
                WHERE product_id = $1
                LIMIT 1
                `,
                [item.productId]
            );

            if (!productResult.rowCount) {
                throw validationError(
                    `Product ID ${item.productId} does not exist.`
                );
            }
        }

        await client.query(
            `
            INSERT INTO purchase_order_items (
                purchase_order_id,
                product_id,
                item_description,
                uom,
                quantity,
                unit_price,
                discount_amount,
                tax_rate,
                tax_amount,
                line_total,
                remarks
            )
            VALUES (
                $1, $2, $3, $4, $5, $6,
                $7, $8, $9, $10, $11
            )
            `,
            [
                purchaseOrderId,
                item.productId,
                item.itemDescription,
                item.uom,
                item.quantity,
                item.unitPrice,
                item.discountAmount,
                item.taxRate,
                item.taxAmount,
                item.lineTotal,
                item.remarks,
            ]
        );
    }
}

/* -------------------------------------------------------------------------- */
/* GET: Purchase Order History + Dropdown Data                                 */
/* -------------------------------------------------------------------------- */

export async function GET() {
    try {
        const user = await getCurrentUser();

        await requirePermission(
            user,
            "purchase_orders",
            "view"
        );

        if (!user.companyId) {
            throw validationError("Company information is missing.");
        }

        const companyId = positiveId(
            user.companyId,
            "company"
        );

        const [ordersResult, suppliersResult, quotationsResult] =
            await Promise.all([
                pool.query(
                    `
                    SELECT
                        po.*,

                        s.supplier_name,
                        s.supplier_code,

                        pq.quotation_number,

                        COALESCE(item_counts.item_count, 0)::INTEGER
                            AS item_count

                    FROM purchase_orders po

                    INNER JOIN suppliers s
                        ON s.supplier_id = po.supplier_id

                    LEFT JOIN purchase_quotations pq
                        ON pq.purchase_quotation_id =
                           po.purchase_quotation_id

                    LEFT JOIN (
                        SELECT
                            purchase_order_id,
                            COUNT(*) AS item_count
                        FROM purchase_order_items
                        GROUP BY purchase_order_id
                    ) item_counts
                        ON item_counts.purchase_order_id =
                           po.purchase_order_id

                    WHERE po.company_id = $1

                    ORDER BY
                        po.order_date DESC,
                        po.purchase_order_id DESC
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
                        email,
                        address

                    FROM suppliers

                    WHERE COALESCE(is_active, TRUE) = TRUE

                    ORDER BY supplier_name ASC
                    `
                ),

                pool.query(
                    `
                    SELECT
                        pq.purchase_quotation_id,
                        pq.quotation_number,
                        pq.supplier_id,
                        pq.quotation_date,
                        pq.valid_until,
                        pq.currency_code,
                        pq.exchange_rate,
                        pq.subtotal,
                        pq.discount_amount,
                        pq.tax_amount,
                        pq.grand_total,
                        pq.status,

                        s.supplier_name,
                        s.supplier_code

                    FROM purchase_quotations pq

                    INNER JOIN suppliers s
                        ON s.supplier_id = pq.supplier_id

                    LEFT JOIN purchase_orders po
                        ON po.purchase_quotation_id =
                           pq.purchase_quotation_id

                    WHERE
                        pq.company_id = $1
                        AND pq.status = 'APPROVED'
                        AND po.purchase_order_id IS NULL

                    ORDER BY
                        pq.quotation_date DESC,
                        pq.purchase_quotation_id DESC
                    `,
                    [companyId]
                ),
            ]);

        return NextResponse.json({
            success: true,
            orders: ordersResult.rows,
            suppliers: suppliersResult.rows,
            quotations: quotationsResult.rows,
        });
    } catch (error) {
        return apiError(error);
    }
}

/* -------------------------------------------------------------------------- */
/* POST: Create Manual Purchase Order OR Convert Purchase Quotation            */
/* -------------------------------------------------------------------------- */

export async function POST(request) {
    let client;
    let transactionStarted = false;

    try {
        const user = await getCurrentUser();

        await requirePermission(
            user,
            "purchase_orders",
            "create"
        );

        if (!user.companyId) {
            throw validationError("Company information is missing.");
        }

        if (!user.userId) {
            throw validationError("User information is missing.");
        }

        const companyId = positiveId(
            user.companyId,
            "company"
        );

        const userId = positiveId(
            user.userId,
            "user"
        );

        let body;

        try {
            body = await request.json();
        } catch {
            throw validationError("Invalid request body. Please send valid JSON.");
        }

        if (
            !body ||
            typeof body !== "object" ||
            Array.isArray(body)
        ) {
            throw validationError("Invalid request body.");
        }

        const sourceType = String(
            body.sourceType || "MANUAL"
        )
            .trim()
            .toUpperCase();

        if (
            !["MANUAL", "QUOTATION", "PURCHASE_QUOTATION"].includes(
                sourceType
            )
        ) {
            throw validationError(
                "Invalid source type. Use MANUAL or QUOTATION."
            );
        }

        const orderDate = validDate(
            body.orderDate,
            "Order date",
            false
        ) || new Date().toISOString().slice(0, 10);

        const expectedDeliveryDate = validDate(
            body.expectedDeliveryDate,
            "Expected delivery date"
        );

        // if (
        //     expectedDeliveryDate &&
        //     expectedDeliveryDate < orderDate
        // ) {
        //     throw validationError(
        //         "Expected delivery date cannot be earlier than the order date."
        //     );
        // }

        const status = validStatus(body.status, "DRAFT");

        client = await pool.connect();

        await client.query("BEGIN");
        transactionStarted = true;

        let supplierId;
        let quotationId = null;

        let currencyCode = "PKR";
        let exchangeRate = 1;

        let subtotal = 0;
        let discountAmount = 0;
        let taxAmount = 0;
        let grandTotal = 0;

        let termsConditions = null;
        let remarks = null;

        let items = [];

        /* ------------------------------------------------------------------ */
        /* CASE 1: Convert an Approved Purchase Quotation                     */
        /* ------------------------------------------------------------------ */

        if (
            sourceType === "QUOTATION" ||
            sourceType === "PURCHASE_QUOTATION"
        ) {
            quotationId = positiveId(
                body.purchaseQuotationId || body.quotationId,
                "purchase quotation"
            );

            const quotationResult = await client.query(
                `
                SELECT *
                FROM purchase_quotations

                WHERE
                    purchase_quotation_id = $1
                    AND company_id = $2

                FOR UPDATE
                `,
                [quotationId, companyId]
            );

            if (!quotationResult.rowCount) {
                throw validationError(
                    "Purchase quotation not found.",
                    404
                );
            }

            const quotation = quotationResult.rows[0];

            if (quotation.status !== "APPROVED") {
                throw validationError(
                    "Only APPROVED purchase quotations can be converted into Purchase Orders."
                );
            }

            const existingOrder = await client.query(
                `
                SELECT purchase_order_id, purchase_order_number
                FROM purchase_orders

                WHERE purchase_quotation_id = $1
                LIMIT 1
                `,
                [quotationId]
            );

            if (existingOrder.rowCount) {
                throw validationError(
                    `This quotation has already been converted into Purchase Order ${existingOrder.rows[0].purchase_order_number}.`,
                    409
                );
            }

            supplierId = positiveId(
                quotation.supplier_id,
                "supplier"
            );

            currencyCode = quotation.currency_code || "PKR";

            exchangeRate = decimal(
                quotation.exchange_rate,
                "Quotation exchange rate",
                { allowZero: false }
            );

            subtotal = roundMoney(quotation.subtotal || 0);
            discountAmount = roundMoney(
                quotation.discount_amount || 0
            );
            taxAmount = roundMoney(quotation.tax_amount || 0);
            grandTotal = roundMoney(quotation.grand_total || 0);

            termsConditions = quotation.terms_conditions || null;
            remarks = quotation.remarks || null;

            const quotationItemsResult = await client.query(
                `
                SELECT
                    product_id,
                    item_description,
                    uom,
                    quantity,
                    unit_price,
                    discount_amount,
                    tax_rate,
                    tax_amount,
                    line_total,
                    remarks

                FROM purchase_quotation_items

                WHERE purchase_quotation_id = $1

                ORDER BY purchase_quotation_item_id ASC
                `,
                [quotationId]
            );

            if (!quotationItemsResult.rowCount) {
                throw validationError(
                    "This purchase quotation does not contain any items."
                );
            }

            items = quotationItemsResult.rows.map((item, index) => ({
                productId: item.product_id
                    ? positiveId(item.product_id, `Product on item ${index + 1}`)
                    : null,

                itemDescription: item.item_description,
                uom: item.uom || null,

                quantity: decimal(
                    item.quantity,
                    `Quantity on item ${index + 1}`,
                    { allowZero: false }
                ),

                unitPrice: decimal(
                    item.unit_price,
                    `Unit price on item ${index + 1}`
                ),

                discountAmount: decimal(
                    item.discount_amount,
                    `Discount on item ${index + 1}`,
                    { defaultValue: 0 }
                ),

                taxRate: decimal(
                    item.tax_rate,
                    `Tax rate on item ${index + 1}`,
                    { defaultValue: 0 }
                ),

                taxAmount: decimal(
                    item.tax_amount,
                    `Tax amount on item ${index + 1}`,
                    { defaultValue: 0 }
                ),

                lineTotal: decimal(
                    item.line_total,
                    `Line total on item ${index + 1}`,
                    { defaultValue: 0 }
                ),

                remarks: item.remarks || null,
            }));

            // Keep quotation values unchanged during conversion.
        } else {
            /* -------------------------------------------------------------- */
            /* CASE 2: Manual Purchase Order                                  */
            /* -------------------------------------------------------------- */

            supplierId = positiveId(
                body.supplierId,
                "supplier"
            );

            const supplierResult = await client.query(
                `
                SELECT supplier_id
                FROM suppliers

                WHERE
                    supplier_id = $1
                    AND COALESCE(is_active, TRUE) = TRUE

                LIMIT 1
                `,
                [supplierId]
            );

            if (!supplierResult.rowCount) {
                throw validationError(
                    "Selected supplier does not exist or is inactive."
                );
            }

            currencyCode = String(
                body.currencyCode || "PKR"
            ).trim().toUpperCase();

            if (
                !currencyCode ||
                currencyCode.length > 10
            ) {
                throw validationError("Invalid currency code.");
            }

            exchangeRate = decimal(
                body.exchangeRate,
                "Exchange rate",
                {
                    allowZero: false,
                    defaultValue: 1,
                }
            );

            termsConditions = body.termsConditions
                ? String(body.termsConditions).trim()
                : null;

            remarks = body.remarks
                ? String(body.remarks).trim()
                : null;

            items = prepareManualItems(body.items);

            subtotal = roundMoney(
                items.reduce(
                    (total, item) =>
                        total + item.quantity * item.unitPrice,
                    0
                )
            );

            discountAmount = roundMoney(
                items.reduce(
                    (total, item) =>
                        total + item.discountAmount,
                    0
                )
            );

            taxAmount = roundMoney(
                items.reduce(
                    (total, item) =>
                        total + item.taxAmount,
                    0
                )
            );

            grandTotal = roundMoney(
                subtotal - discountAmount + taxAmount
            );
        }

        /* ------------------------------------------------------------------ */
        /* Generate Purchase Order Number                                    */
        /* ------------------------------------------------------------------ */

        const purchaseOrderNumber =
            await generatePurchaseOrderNumber(
                client,
                companyId,
                orderDate
            );

        /* ------------------------------------------------------------------ */
        /* Insert Purchase Order Header                                       */
        /* ------------------------------------------------------------------ */

        const orderResult = await client.query(
            `
            INSERT INTO purchase_orders (
                purchase_order_number,
                company_id,
                supplier_id,
                purchase_quotation_id,
                order_date,
                expected_delivery_date,
                status,
                currency_code,
                exchange_rate,
                subtotal,
                discount_amount,
                tax_amount,
                grand_total,
                terms_conditions,
                remarks,
                created_by,
                updated_by
            )
            VALUES (
                $1, $2, $3, $4, $5, $6, $7,
                $8, $9, $10, $11, $12, $13,
                $14, $15, $16, $17
            )
            RETURNING *
            `,
            [
                purchaseOrderNumber,
                companyId,
                supplierId,
                quotationId,
                orderDate,
                expectedDeliveryDate,
                status,
                currencyCode,
                exchangeRate,
                subtotal,
                discountAmount,
                taxAmount,
                grandTotal,
                termsConditions,
                remarks,
                userId,
                userId,
            ]
        );

        const purchaseOrder = orderResult.rows[0];

        /* ------------------------------------------------------------------ */
        /* Insert Purchase Order Items                                        */
        /* ------------------------------------------------------------------ */

        await insertPurchaseOrderItems(
            client,
            purchaseOrder.purchase_order_id,
            items
        );

        /* ------------------------------------------------------------------ */
        /* Commit                                                              */
        /* ------------------------------------------------------------------ */

        await client.query("COMMIT");
        transactionStarted = false;

        return NextResponse.json(
            {
                success: true,
                message:
                    quotationId
                        ? "Purchase Order successfully created from Purchase Quotation."
                        : "Purchase Order successfully created.",

                purchaseOrder: {
                    ...purchaseOrder,
                    items,
                },
            },
            { status: 201 }
        );
    } catch (error) {
        if (client && transactionStarted) {
            try {
                await client.query("ROLLBACK");
            } catch (rollbackError) {
                console.error(
                    "Purchase Order rollback error:",
                    rollbackError
                );
            }
        }

        return apiError(error);
    } finally {
        if (client) {
            client.release();
        }
    }
}
