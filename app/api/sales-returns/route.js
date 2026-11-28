
import { NextResponse } from "next/server";
import pool, { getOperationalPool } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { requirePermission } from "@/lib/permissions";

export const dynamic = "force-dynamic";

/* =========================================================
   HELPERS
========================================================= */

function num(value) {
    const n = Number(value);
    return Number.isFinite(n) ? n : 0;
}

function money(value) {
    return Math.round((num(value) + Number.EPSILON) * 100) / 100;
}

function companyIdOf(user) {
    return Number(
        user?.company_id ??
        user?.companyId ??
        user?.company?.id ??
        0
    );
}

function userIdOf(user) {
    return Number(
        user?.user_id ??
        user?.userId ??
        user?.id ??
        0
    );
}

function errorResponse(message, status = 400, extra = {}) {
    return NextResponse.json(
        {
            success: false,
            message,
            ...extra,
        },
        {
            status,
            headers: { "Cache-Control": "no-store" },
        }
    );
}

async function getNextSalesReturnNumber(companyId, tenantClient) {
    const numericCompanyId = Number(companyId);

    if (
        !Number.isSafeInteger(numericCompanyId) ||
        numericCompanyId <= 0
    ) {
        throw new Error(
            "Invalid company ID for Sales Return numbering."
        );
    }

    const sequenceName =
        `sales_return_company_${numericCompanyId}_seq`;

    // Create the company's sequence in the central ERP database.
    await pool.query(`
        CREATE SEQUENCE IF NOT EXISTS public."${sequenceName}"
        START WITH 1
        INCREMENT BY 1
    `);

    for (let attempt = 0; attempt < 1000; attempt++) {
        const result = await pool.query(
            `
            SELECT nextval($1::regclass)::TEXT AS sequence_value
            `,
            [`public.${sequenceName}`]
        );

        const sequenceValue = result.rows[0].sequence_value;

        const returnNumber =
            `SR-${String(sequenceValue).padStart(6, "0")}`;

        // Check archived and active records to avoid reusing old numbers.
        const existing = await tenantClient.query(
            `
            SELECT 1
            FROM sales_returns
            WHERE return_number = $1
            LIMIT 1
            `,
            [returnNumber]
        );

        if (existing.rowCount === 0) {
            return returnNumber;
        }
    }

    throw new Error(
        "Could not generate a unique Sales Return number."
    );
}

function errorStatus(error) {
    if (error?.message === "FORBIDDEN") return 403;
    if (
        error?.message === "UNAUTHORIZED" ||
        error?.message === "Authentication required"
    ) {
        return 401;
    }

    return 500;
}

async function authorize(action = "view") {
    const user = await getCurrentUser();

    if (!user) {
        return {
            response: errorResponse(
                "Authentication required.",
                401
            ),
        };
    }

    await requirePermission(user, "sales_returns", action);

    const companyId = companyIdOf(user);

    if (!companyId) {
        return {
            response: errorResponse(
                "Your account has no valid company.",
                403
            ),
        };
    }

    return {
        user,
        companyId,
        userId: userIdOf(user),
    };
}

function logError(label, error) {
    console.error(`[SALES RETURNS] ${label}`, {
        message: error?.message,
        code: error?.code,
        detail: error?.detail,
        hint: error?.hint,
        constraint: error?.constraint,
        table: error?.table,
        column: error?.column,
        stack: error?.stack,
    });
}

/* =========================================================
   GET: SALES RETURN HISTORY
========================================================= */

export async function GET(request) {
    console.log("[SALES RETURNS] GET started");

    try {
        const auth = await authorize("view");

        if (auth.response) {
            return auth.response;
        }

        const db = await getOperationalPool(auth.companyId);

        const { searchParams } = new URL(request.url);

        const status = searchParams.get("status");
        const search = searchParams.get("search");

        const values = [auth.companyId];

        let conditions = "WHERE sr.company_id = $1";

        if (status && status !== "ALL") {
            values.push(status);
            conditions += ` AND sr.status = $${values.length}`;
        }

        if (search) {
            values.push(`%${search}%`);

            conditions += `
                AND (
                    COALESCE(sr.return_number, '') ILIKE $${values.length}
                    OR COALESCE(si.invoice_number, '') ILIKE $${values.length}
                    OR CAST(sr.return_id AS TEXT) ILIKE $${values.length}
                    OR CAST(sr.customer_id AS TEXT) ILIKE $${values.length}
                )
            `;
        }

        const result = await db.query(
            `
            SELECT
                sr.*,
                si.invoice_number,
                c.customer_name,
                c.customer_code,
                w.warehouse_name
            FROM sales_returns sr
            LEFT JOIN sales_invoices si
                ON si.invoice_id = sr.invoice_id
            LEFT JOIN customers c
                ON c.customer_id = sr.customer_id
            LEFT JOIN warehouses w
                ON w.warehouse_id = sr.warehouse_id
            ${conditions}
            ORDER BY sr.return_id DESC
            `,
            values
        );

        return NextResponse.json(
            {
                success: true,
                salesReturns: result.rows,
                returns: result.rows,
                data: result.rows,
            },
            {
                status: 200,
                headers: { "Cache-Control": "no-store" },
            }
        );
    } catch (error) {
        logError("GET FAILED", error);

        return errorResponse(
            error?.message || "Unable to load sales returns.",
            errorStatus(error),
            {
                code: error?.code || null,
                detail: error?.detail || null,
            }
        );
    }
}

/* =========================================================
   POST: CREATE SALES RETURN
========================================================= */

export async function POST(request) {
    let client;

    try {
        console.log("[SALES RETURNS] POST started");

        const auth = await authorize("create");

        if (auth.response) {
            return auth.response;
        }

        const db = await getOperationalPool(auth.companyId);

        const body = await request.json();

        const invoiceId =
            body.invoiceId ??
            body.invoice_id ??
            null;

        const customerId = Number(
            body.customerId ??
            body.customer_id
        );

        const warehouseId = Number(
            body.warehouseId ??
            body.warehouse_id
        );

        const returnDate =
            body.returnDate ??
            body.return_date;

        const refundMethod = String(
            body.refundMethod ??
            body.refund_method ??
            "CUSTOMER_CREDIT"
        ).toUpperCase();

        const notes =
            body.notes ??
            body.memo ??
            body.reference ??
            null;

        const items = body.items;

        if (!returnDate || Number.isNaN(Date.parse(returnDate))) {
            return errorResponse("A valid return date is required.");
        }

        if (!customerId || !warehouseId) {
            return errorResponse(
                "Please select a customer and warehouse."
            );
        }

        if (!Array.isArray(items) || items.length === 0) {
            return errorResponse(
                "Please add at least one item to the sales return."
            );
        }

        const allowedRefundMethods = [
            "CUSTOMER_CREDIT",
            "CASH",
            "BANK",
        ];

        if (!allowedRefundMethods.includes(refundMethod)) {
            return errorResponse("Invalid refund method.");
        }

        client = await db.connect();

        await client.query("BEGIN");

        /* -------------------------------------------------
           1. VERIFY CUSTOMER
        ------------------------------------------------- */

        const customerResult = await client.query(
            `
            SELECT customer_id, customer_name
            FROM customers
            WHERE customer_id = $1
            LIMIT 1
            `,
            [customerId]
        );

        if (!customerResult.rowCount) {
            throw new Error("Selected customer does not exist.");
        }

        /* -------------------------------------------------
           2. VERIFY WAREHOUSE
        ------------------------------------------------- */

        const warehouseResult = await client.query(
            `
            SELECT warehouse_id, warehouse_name
            FROM warehouses
            WHERE warehouse_id = $1
            LIMIT 1
            `,
            [warehouseId]
        );

        if (!warehouseResult.rowCount) {
            throw new Error("Selected warehouse does not exist.");
        }

        /* -------------------------------------------------
           3. VERIFY INVOICE IF PROVIDED
        ------------------------------------------------- */

        let invoice = null;

        if (invoiceId) {
            const invoiceResult = await client.query(
                `
                SELECT
                    invoice_id,
                    invoice_number,
                    customer_id,
                    warehouse_id
                FROM sales_invoices
                WHERE invoice_id = $1
                FOR UPDATE
                `,
                [invoiceId]
            );

            if (!invoiceResult.rowCount) {
                throw new Error("Selected sales invoice does not exist.");
            }

            invoice = invoiceResult.rows[0];

            if (Number(invoice.customer_id) !== customerId) {
                throw new Error(
                    "The selected customer does not match the invoice customer."
                );
            }
        }

        /* -------------------------------------------------
           4. VALIDATE ITEMS AND CALCULATE TOTALS
        ------------------------------------------------- */

        const normalizedItems = [];

        let subtotal = 0;
        let totalDiscount = 0;
        let totalTax = 0;

        for (const item of items) {
            const productId = Number(
                item.productId ??
                item.product_id
            );

            const subProductId = item.subProductId ??
                item.sub_product_id ??
                null;

            const invoiceItemId = item.invoiceItemId ??
                item.invoice_item_id ??
                null;

            const quantity = num(
                item.quantity ??
                item.returnQuantity ??
                item.return_quantity
            );

            const unitPrice = num(
                item.unitPrice ??
                item.unit_price ??
                item.rate
            );

            const discountInput = num(
                item.discount ??
                item.discountAmount ??
                item.discount_amount
            );

            const taxInput = num(
                item.tax ??
                item.taxAmount ??
                item.tax_amount
            );

            if (!productId || quantity <= 0) {
                throw new Error(
                    "Every return line must have a product and quantity greater than zero."
                );
            }

            if (
                unitPrice < 0 ||
                discountInput < 0 ||
                taxInput < 0
            ) {
                throw new Error(
                    "Price, discount and tax cannot be negative."
                );
            }

            const productResult = await client.query(
                `
                SELECT product_id, product_name
                FROM products
                WHERE product_id = $1
                LIMIT 1
                `,
                [productId]
            );

            if (!productResult.rowCount) {
                throw new Error(
                    `Product ID ${productId} does not exist.`
                );
            }

            if (subProductId) {
                const subProductResult = await client.query(
                    `
                    SELECT sub_product_id
                    FROM sub_products
                    WHERE sub_product_id = $1
                    LIMIT 1
                    `,
                    [subProductId]
                );

                if (!subProductResult.rowCount) {
                    throw new Error(
                        `Sub-product ID ${subProductId} does not exist.`
                    );
                }
            }

            let actualInvoiceItemId = invoiceItemId;

            /* Invoice-based return validation */

            if (invoice) {
                if (!invoiceItemId) {
                    throw new Error(
                        "An invoice item reference is required for invoice-based returns."
                    );
                }

                const invoiceItemResult = await client.query(
                    `
                    SELECT
                        invoice_item_id,
                        invoice_id,
                        product_id,
                        sub_product_id,
                        quantity,
                        unit_price,
                        discount,
                        tax
                    FROM sales_invoice_items
                    WHERE invoice_item_id = $1
                      AND invoice_id = $2
                    LIMIT 1
                    `,
                    [invoiceItemId, invoice.invoice_id]
                );

                if (!invoiceItemResult.rowCount) {
                    throw new Error(
                        "The selected item does not belong to this invoice."
                    );
                }

                const invoiceItem = invoiceItemResult.rows[0];

                if (Number(invoiceItem.product_id) !== productId) {
                    throw new Error(
                        "The selected return product does not match the invoice item."
                    );
                }

                const returnedResult = await client.query(
                    `
                    SELECT COALESCE(SUM(sri.quantity), 0) AS returned_quantity
                    FROM sales_return_items sri
                    INNER JOIN sales_returns sr
                        ON sr.return_id = sri.return_id
                    WHERE sri.invoice_item_id = $1
                      AND sr.company_id = $2
                      AND sr.status NOT IN ('REJECTED', 'CANCELLED')
                    `,
                    [invoiceItemId, auth.companyId]
                );

                const previouslyReturned = num(
                    returnedResult.rows[0]?.returned_quantity
                );

                const invoiceQuantity = num(invoiceItem.quantity);

                if (
                    quantity >
                    invoiceQuantity - previouslyReturned
                ) {
                    throw new Error(
                        `Return quantity exceeds the remaining invoice quantity for ${productResult.rows[0].product_name}.`
                    );
                }

                // Preserve invoice pricing if the page omitted the price.
                if (
                    item.unitPrice === undefined &&
                    item.unit_price === undefined &&
                    item.rate === undefined
                ) {
                    // The price is set below from the invoice item.
                }

                if (
                    item.unitPrice === undefined &&
                    item.unit_price === undefined &&
                    item.rate === undefined
                ) {
                    normalizedItems.push({
                        productId,
                        subProductId,
                        invoiceItemId: actualInvoiceItemId,
                        description:
                            item.description ||
                            productResult.rows[0].product_name,
                        quantity,
                        unitPrice: num(invoiceItem.unit_price),
                        discount: money(discountInput),
                        tax: money(taxInput),
                    });

                    continue;
                }
            } else if (invoiceItemId) {
                throw new Error(
                    "Invoice item references cannot be used for manual returns."
                );
            }

            normalizedItems.push({
                productId,
                subProductId,
                invoiceItemId: actualInvoiceItemId,
                description:
                    item.description ||
                    productResult.rows[0].product_name,
                quantity,
                unitPrice: money(unitPrice),
                discount: money(discountInput),
                tax: money(taxInput),
            });
        }

        for (const item of normalizedItems) {
            const gross = money(item.quantity * item.unitPrice);

            if (item.discount > gross) {
                throw new Error(
                    "An item's discount cannot exceed its gross amount."
                );
            }

            const lineTotal = money(
                gross - item.discount + item.tax
            );

            if (lineTotal < 0) {
                throw new Error("Invalid return line total.");
            }

            item.lineTotal = lineTotal;

            subtotal += gross;
            totalDiscount += item.discount;
            totalTax += item.tax;
        }

        subtotal = money(subtotal);
        totalDiscount = money(totalDiscount);
        totalTax = money(totalTax);

        const totalAmount = money(
            subtotal - totalDiscount + totalTax
        );

        if (totalAmount < 0) {
            throw new Error("Return total cannot be negative.");
        }

        const rawRefundAmount =
    body.refundAmount ??
    body.refund_amount;

const refundAmount =
    rawRefundAmount === undefined ||
    rawRefundAmount === null ||
    rawRefundAmount === ""
        ? totalAmount
        : money(rawRefundAmount);

        if (
            refundAmount < 0 ||
            refundAmount > totalAmount
        ) {
            throw new Error(
                "Refund amount must be between zero and the return total."
            );
        }

        /* -------------------------------------------------
   5. GENERATE RETURN NUMBER
------------------------------------------------- */

const returnNumber = await getNextSalesReturnNumber(
    auth.companyId,
    client
);

                /* -------------------------------------------------
           6. INSERT SALES RETURN HEADER
        ------------------------------------------------- */

        const headerResult = await client.query(
            `
            INSERT INTO sales_returns (
                return_number,
                company_id,
                invoice_id,
                customer_id,
                warehouse_id,
                return_date,
                status,
                subtotal,
                discount,
                tax,
                total_amount,
                refund_method,
                refund_amount,
                notes,
                created_by
            )
            VALUES (
                $1, $2, $3, $4, $5,
                $6, 'DRAFT', $7, $8, $9,
                $10, $11, $12, $13, $14
            )
            RETURNING *
            `,
            [
                returnNumber,
                auth.companyId,
                invoiceId || null,
                customerId,
                warehouseId,
                returnDate,
                subtotal,
                totalDiscount,
                totalTax,
                totalAmount,
                refundMethod,
                refundAmount,
                notes,
                auth.userId || null,
            ]
        );

        const salesReturn = headerResult.rows[0];

        /* -------------------------------------------------
           7. INSERT SALES RETURN ITEMS
        ------------------------------------------------- */

        for (const item of normalizedItems) {
            await client.query(
                `
                INSERT INTO sales_return_items (
                    return_id,
                    invoice_item_id,
                    product_id,
                    sub_product_id,
                    description,
                    quantity,
                    unit_price,
                    discount,
                    tax,
                    line_total
                )
                VALUES (
                    $1, $2, $3, $4, $5,
                    $6, $7, $8, $9, $10
                )
                `,
                [
                    salesReturn.return_id,
                    item.invoiceItemId,
                    item.productId,
                    item.subProductId,
                    item.description,
                    item.quantity,
                    item.unitPrice,
                    item.discount,
                    item.tax,
                    item.lineTotal,
                ]
            );
        }

        await client.query("COMMIT");

        console.log(
            "[SALES RETURNS] Created successfully:",
            returnNumber
        );

        return NextResponse.json(
            {
                success: true,
                message: "Sales return created successfully.",
                salesReturn,
                data: salesReturn,
            },
            { status: 201 }
        );
    } catch (error) {
        if (client) {
            await client.query("ROLLBACK").catch(() => {});
        }

        logError("POST FAILED", error);

        return errorResponse(
            error?.message || "Unable to create sales return.",
            errorStatus(error),
            {
                code: error?.code || null,
                detail: error?.detail || null,
                constraint: error?.constraint || null,
            }
        );
    } finally {
        if (client) {
            client.release();
        }
    }
}
