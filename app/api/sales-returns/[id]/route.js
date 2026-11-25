
import { NextResponse } from "next/server";
import { getOperationalPool } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { requirePermission } from "@/lib/permissions";
import { archiveAndSoftDelete } from "@/lib/recycle-bin";

export const dynamic = "force-dynamic";

function getCompanyId(user) {
    return Number(user?.company_id || user?.companyId || 0);
}

function roundAmount(value) {
    const number = Number(value);
    return Math.round(
        ((Number.isFinite(number) ? number : 0) + Number.EPSILON) * 100
    ) / 100;
}

function toNumber(value) {
    if (value === null || value === undefined || value === "") return 0;
    const number = Number(value);
    return Number.isFinite(number) ? number : NaN;
}

function errorResponse(message, status = 400) {
    return NextResponse.json(
        { success: false, message },
        {
            status,
            headers: { "Cache-Control": "no-store" },
        }
    );
}

function isValidDate(value) {
    if (
        typeof value !== "string" ||
        !/^\d{4}-\d{2}-\d{2}$/.test(value)
    ) {
        return false;
    }

    const date = new Date(`${value}T00:00:00.000Z`);

    return (
        !Number.isNaN(date.getTime()) &&
        date.toISOString().slice(0, 10) === value
    );
}

function getValue(item, camel, snake, fallback = undefined) {
    return item?.[camel] ?? item?.[snake] ?? fallback;
}

async function getAuthorizedUser(action) {
    const user = await getCurrentUser();

    if (!user) {
        return {
            response: errorResponse("Unauthorized.", 401),
        };
    }

    // requirePermission returns a boolean:
    // true = permission granted, false = permission denied.
    const allowed = await requirePermission(
        user,
        "sales_returns",
        action
    );

    if (allowed !== true) {
        return {
            response: errorResponse(
                `You do not have permission to ${action} Sales Returns.`,
                403
            ),
        };
    }

    const companyId = getCompanyId(user);

    if (!Number.isInteger(companyId) || companyId <= 0) {
        return {
            response: errorResponse(
                "Company information is missing.",
                403
            ),
        };
    }

    return { user, companyId };
}

async function getReturnId(context) {
    const params = await context.params;
    return Number(params?.id);
}

async function calculateManualItems(client, items) {
    if (!Array.isArray(items) || items.length === 0) {
        throw new Error("Add at least one return item.");
    }

    const normalized = [];
    const seen = new Set();

    let subtotal = 0;
    let discount = 0;
    let tax = 0;
    let totalAmount = 0;

    for (const input of items) {
        const productId = Number(
            getValue(input, "productId", "product_id")
        );

        const rawSubProductId = getValue(
            input,
            "subProductId",
            "sub_product_id",
            null
        );

        const subProductId =
            rawSubProductId === null || rawSubProductId === ""
                ? null
                : Number(rawSubProductId);

        const quantity = toNumber(input.quantity);

        const unitPrice = toNumber(
            getValue(input, "unitPrice", "unit_price", 0)
        );

        if (!Number.isInteger(productId) || productId <= 0) {
            throw new Error(
                "Select a valid product for every manual return line."
            );
        }

        if (!Number.isFinite(quantity) || quantity <= 0) {
            throw new Error(
                "Return quantity must be greater than zero."
            );
        }

        if (!Number.isFinite(unitPrice) || unitPrice < 0) {
            throw new Error(
                "Unit price must be a valid non-negative amount."
            );
        }

        if (
            subProductId !== null &&
            (!Number.isInteger(subProductId) || subProductId <= 0)
        ) {
            throw new Error("Invalid sub-product selected.");
        }

        const key = `${productId}:${subProductId || ""}`;

        if (seen.has(key)) {
            throw new Error(
                "Duplicate products are not allowed. Combine their quantities."
            );
        }

        seen.add(key);

        const productResult = await client.query(
            `
            SELECT product_id, product_name, unit
FROM products
WHERE product_id = $1
  AND deleted_at IS NULL
            `,
            [productId]
        );

        if (!productResult.rowCount) {
            throw new Error(`Product ${productId} was not found.`);
        }

        const product = productResult.rows[0];

        const lineSubtotal = roundAmount(quantity * unitPrice);

        const discountRate = getValue(
            input,
            "discountRate",
            "discount_rate"
        );

        const taxRate = getValue(
            input,
            "taxRate",
            "tax_rate"
        );

        const lineDiscount =
            discountRate !== undefined &&
            discountRate !== null &&
            discountRate !== ""
                ? roundAmount(
                    lineSubtotal * toNumber(discountRate) / 100
                )
                : roundAmount(
                    getValue(
                        input,
                        "discountAmount",
                        "discount_amount",
                        getValue(input, "discount", "discount", 0)
                    )
                );

        const lineTax =
            taxRate !== undefined &&
            taxRate !== null &&
            taxRate !== ""
                ? roundAmount(
                    (lineSubtotal - lineDiscount) *
                    toNumber(taxRate) / 100
                )
                : roundAmount(
                    getValue(
                        input,
                        "taxAmount",
                        "tax_amount",
                        getValue(input, "tax", "tax", 0)
                    )
                );

        if (
            !Number.isFinite(lineDiscount) ||
            lineDiscount < 0 ||
            lineDiscount > lineSubtotal
        ) {
            throw new Error(
                `Invalid discount for ${product.product_name}.`
            );
        }

        if (!Number.isFinite(lineTax) || lineTax < 0) {
            throw new Error(
                `Invalid tax for ${product.product_name}.`
            );
        }

        const lineTotal = roundAmount(
            lineSubtotal - lineDiscount + lineTax
        );

        subtotal += lineSubtotal;
        discount += lineDiscount;
        tax += lineTax;
        totalAmount += lineTotal;

        normalized.push({
            invoice_item_id: null,
            product_id: productId,
            sub_product_id: subProductId,
            description: String(
                input.description || product.product_name || ""
            ).trim(),
            quantity,
            unit_price: unitPrice,
            discount: lineDiscount,
            tax: lineTax,
            line_total: lineTotal,
        });
    }

    return {
        items: normalized,
        subtotal: roundAmount(subtotal),
        discount: roundAmount(discount),
        tax: roundAmount(tax),
        totalAmount: roundAmount(totalAmount),
    };
}

async function calculateInvoiceItems(
    client,
    salesReturn,
    items,
    excludeReturnId
) {
    const invoiceId = Number(salesReturn.invoice_id);

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
    throw new Error("Original Sales Invoice not found.");
}

const invoice = invoiceResult.rows[0];

if (
    Number(invoice.customer_id) !== Number(salesReturn.customer_id) ||
    Number(invoice.warehouse_id) !== Number(salesReturn.warehouse_id)
) {
    throw new Error(
        "Original Sales Invoice customer or warehouse does not match the Sales Return."
    );
}

    if (!invoiceResult.rowCount) {
        throw new Error("Original Sales Invoice not found.");
    }

    const invoiceItemsResult = await client.query(
        `
        SELECT
            sii.invoice_item_id,
            sii.invoice_id,
            sii.product_id,
            sii.sub_product_id,
            sii.quantity,
            sii.unit_price,
            sii.discount,
            sii.tax,
            sii.line_total,
            p.product_name,
            p.unit
        FROM sales_invoice_items sii
        INNER JOIN products p
            ON p.product_id = sii.product_id
        WHERE sii.invoice_id = $1
        ORDER BY sii.invoice_item_id
        `,
        [invoiceId]
    );

    if (!invoiceItemsResult.rowCount) {
        throw new Error(
            "The original Sales Invoice has no products."
        );
    }

    const itemMap = new Map(
        invoiceItemsResult.rows.map((item) => [
            Number(item.invoice_item_id),
            item,
        ])
    );

    const previousResult = await client.query(
        `
        SELECT
            sri.invoice_item_id,
            COALESCE(SUM(sri.quantity), 0) AS returned_quantity
        FROM sales_return_items sri
        INNER JOIN sales_returns sr
            ON sr.return_id = sri.return_id
        WHERE sr.invoice_id = $1
          AND sr.company_id = $2
          AND sr.status = 'APPROVED'
          AND sr.return_id <> $3
        GROUP BY sri.invoice_item_id
        `,
        [
            invoiceId,
            salesReturn.company_id,
            excludeReturnId,
        ]
    );

    const previouslyReturned = new Map(
        previousResult.rows.map((row) => [
            Number(row.invoice_item_id),
            toNumber(row.returned_quantity),
        ])
    );

    const normalized = [];
    const seen = new Set();

    let subtotal = 0;
    let discount = 0;
    let tax = 0;
    let totalAmount = 0;

    for (const input of items) {
        const invoiceItemId = Number(
            getValue(input, "invoiceItemId", "invoice_item_id")
        );

        const quantity = toNumber(input.quantity);

        if (!Number.isInteger(invoiceItemId) || invoiceItemId <= 0) {
            throw new Error("Select a valid original invoice item.");
        }

        if (seen.has(invoiceItemId)) {
            throw new Error(
                "Duplicate invoice items are not allowed. Combine their quantities."
            );
        }

        seen.add(invoiceItemId);

        if (!Number.isFinite(quantity) || quantity <= 0) {
            throw new Error(
                "Return quantity must be greater than zero."
            );
        }

        const original = itemMap.get(invoiceItemId);

        if (!original) {
            throw new Error(
                "A selected item does not belong to the original Sales Invoice."
            );
        }

        const originalQuantity = toNumber(original.quantity);
        const alreadyReturned =
            previouslyReturned.get(invoiceItemId) || 0;

        const remaining = originalQuantity - alreadyReturned;

        if (quantity > remaining + 1) {
            throw new Error(
                `Cannot return ${quantity} of ${original.product_name}. Remaining returnable quantity: ${Math.max(0, remaining)}.`
            );
        }

        if (originalQuantity <= 0) {
            throw new Error(
                `Invalid original quantity for ${original.product_name}.`
            );
        }

        const ratio = quantity / originalQuantity;
        const unitPrice = toNumber(original.unit_price);

        const lineSubtotal = roundAmount(
            quantity * unitPrice
        );

        const lineDiscount = roundAmount(
            toNumber(original.discount) * ratio
        );

        const lineTax = roundAmount(
            toNumber(original.tax) * ratio
        );

        const lineTotal = roundAmount(
            lineSubtotal - lineDiscount + lineTax
        );

        if (lineTotal < 0) {
            throw new Error(
                "Calculated return amount cannot be negative."
            );
        }

        subtotal += lineSubtotal;
        discount += lineDiscount;
        tax += lineTax;
        totalAmount += lineTotal;

        normalized.push({
            invoice_item_id: invoiceItemId,
            product_id: Number(original.product_id),
            sub_product_id: original.sub_product_id || null,
            description: String(
                input.description || original.product_name || ""
            ).trim(),
            quantity,
            unit_price: unitPrice,
            discount: lineDiscount,
            tax: lineTax,
            line_total: lineTotal,
        });
    }

    return {
        items: normalized,
        subtotal: roundAmount(subtotal),
        discount: roundAmount(discount),
        tax: roundAmount(tax),
        totalAmount: roundAmount(totalAmount),
    };
}

/**
 * GET /api/sales-returns/[id]
 * Load one Sales Return with its items.
 */
export async function GET(request, context) {
    try {
        const auth = await getAuthorizedUser("view");

        if (auth.response) {
            return auth.response;
        }

        const db = await getOperationalPool(auth.companyId);

        const returnId = await getReturnId(context);

        if (!Number.isInteger(returnId) || returnId <= 0) {
            return errorResponse("Invalid Sales Return ID.");
        }

        const result = await db.query(
            `
            SELECT
                sr.*,
                si.invoice_number,
                si.invoice_date,
                c.customer_name,
                w.warehouse_name
            FROM sales_returns sr
            LEFT JOIN sales_invoices si
                ON si.invoice_id = sr.invoice_id
            LEFT JOIN customers c
    ON c.customer_id = sr.customer_id
   AND c.deleted_at IS NULL

LEFT JOIN warehouses w
    ON w.warehouse_id = sr.warehouse_id
   AND w.deleted_at IS NULL
            WHERE sr.return_id = $1
              AND sr.company_id = $2
              AND sr.deleted_at IS NULL
            `,
            [returnId, auth.companyId]
        );

        if (!result.rowCount) {
            return errorResponse("Sales Return not found.", 404);
        }

        const items = await db.query(
            `
            SELECT
                sri.*,
                si.invoice_number,
                p.product_name,
                p.unit,
                sii.quantity AS original_quantity
            FROM sales_return_items sri
            LEFT JOIN sales_invoice_items sii
                ON sii.invoice_item_id = sri.invoice_item_id
            LEFT JOIN sales_returns sr
                ON sr.return_id = sri.return_id
            LEFT JOIN sales_invoices si
                ON si.invoice_id = sr.invoice_id
            LEFT JOIN products p
                ON p.product_id = sri.product_id
            WHERE sri.return_id = $1
            ORDER BY sri.return_item_id
            `,
            [returnId]
        );

        return NextResponse.json(
            {
                success: true,
                salesReturn: result.rows[0],
                items: items.rows,
            },
            {
                headers: { "Cache-Control": "no-store" },
            }
        );
    } catch (error) {
        console.error("Sales Return GET error:", error);

        return errorResponse(
            process.env.NODE_ENV === "production"
                ? "Failed to load Sales Return."
                : error.message || "Failed to load Sales Return.",
            500
        );
    }
}

/**
 * PUT /api/sales-returns/[id]
 * Update a DRAFT Sales Return.
 * No inventory or accounting posting occurs here.
 */
export async function PUT(request, context) {
    let client = null;
    let transactionStarted = false;

    try {
        const auth = await getAuthorizedUser("update");

        if (auth.response) {
            return auth.response;
        }

        const db = await getOperationalPool(auth.companyId);

        const returnId = await getReturnId(context);

        if (!Number.isInteger(returnId) || returnId <= 0) {
            return errorResponse("Invalid Sales Return ID.");
        }

        let body;

        try {
            body = await request.json();
        } catch {
            return errorResponse("Invalid request body.");
        }

        const returnDate = String(
            body.returnDate || body.return_date || ""
        ).trim();

        if (!isValidDate(returnDate)) {
            return errorResponse("A valid return date is required.");
        }

        const refundMethod = String(
            body.refundMethod ||
            body.refund_method ||
            "CUSTOMER_CREDIT"
        ).trim().toUpperCase();

        if (!["CUSTOMER_CREDIT", "CASH", "BANK"].includes(refundMethod)) {
            return errorResponse("Invalid refund method.");
        }

        const rawRefundAmount =
    body.refundAmount === undefined ||
    body.refundAmount === null ||
    body.refundAmount === ""
        ? Number(
            body.totalAmount ??
            body.total_amount ??
            0
        )
        : body.refundAmount ?? body.refund_amount;

        const refundAmount = roundAmount(rawRefundAmount);

        if (
            !Number.isFinite(Number(rawRefundAmount)) ||
            !Number.isFinite(refundAmount) ||
            refundAmount < 0
        ) {
            return errorResponse(
                "Refund amount must be a valid non-negative amount."
            );
        }

        const items = Array.isArray(body.items) ? body.items : [];

        if (!items.length) {
            return errorResponse("Add at least one return item.");
        }

        client = await db.connect();

        await client.query("BEGIN");
        transactionStarted = true;

        const returnResult = await client.query(
            `
            SELECT *
            FROM sales_returns
            WHERE return_id = $1
              AND company_id = $2
              AND deleted_at IS NULL
            FOR UPDATE
            `,
            [returnId, auth.companyId]
        );

        if (!returnResult.rowCount) {
            throw Object.assign(
                new Error("Sales Return not found."),
                { statusCode: 404 }
            );
        }

        const salesReturn = returnResult.rows[0];

        if (salesReturn.status !== "DRAFT") {
            throw Object.assign(
                new Error("Only DRAFT Sales Returns can be edited."),
                { statusCode: 409 }
            );
        }

        let calculation;

        if (salesReturn.invoice_id !== null) {
            calculation = await calculateInvoiceItems(
                client,
                salesReturn,
                items,
                returnId
            );
        } else {
            calculation = await calculateManualItems(
                client,
                items
            );
        }

        if (refundAmount > calculation.totalAmount) {
            throw new Error(
                "Refund amount cannot exceed the Sales Return total."
            );
        }

        await client.query(
            `
            UPDATE sales_returns
            SET
                return_date = $1,
                subtotal = $2,
                discount = $3,
                tax = $4,
                total_amount = $5,
                refund_method = $6,
                refund_amount = $7,
                notes = $8,
                updated_at = CURRENT_TIMESTAMP
            WHERE return_id = $9
              AND company_id = $10
            `,
            [
                returnDate,
                calculation.subtotal,
                calculation.discount,
                calculation.tax,
                calculation.totalAmount,
                refundMethod,
                refundAmount,
                String(body.notes || "").trim() || null,
                returnId,
                auth.companyId,
            ]
        );

        await client.query(
            `DELETE FROM sales_return_items WHERE return_id = $1`,
            [returnId]
        );

        for (const item of calculation.items) {
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
                VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
                `,
                [
                    returnId,
                    item.invoice_item_id,
                    item.product_id,
                    item.sub_product_id,
                    item.description,
                    item.quantity,
                    item.unit_price,
                    item.discount,
                    item.tax,
                    item.line_total,
                ]
            );
        }

        await client.query("COMMIT");
        transactionStarted = false;

        return NextResponse.json(
            {
                success: true,
                message: "Sales Return updated successfully.",
                returnId,
                totals: {
                    subtotal: calculation.subtotal,
                    discount: calculation.discount,
                    tax: calculation.tax,
                    totalAmount: calculation.totalAmount,
                },
            },
            {
                headers: { "Cache-Control": "no-store" },
            }
        );
    } catch (error) {
        if (transactionStarted && client) {
            try {
                await client.query("ROLLBACK");
            } catch (rollbackError) {
                console.error(
                    "Sales Return PUT rollback error:",
                    rollbackError
                );
            }
        }

        console.error("Sales Return PUT error:", error);

        return errorResponse(
            error.message || "Failed to update Sales Return.",
            error.statusCode || 400
        );
    } finally {
        if (client) client.release();
    }
}

/**
 * DELETE /api/sales-returns/[id]
 * Delete a DRAFT Sales Return only.
 */
/**
 * DELETE /api/sales-returns/[id]
 * Only DRAFT Sales Returns can be archived.
 * Return items remain in place for restoration.
 */
export async function DELETE(request, context) {
    try {
        const auth = await getAuthorizedUser("delete");

        if (auth.response) {
            return auth.response;
        }

        const db = await getOperationalPool(auth.companyId);
        const returnId = await getReturnId(context);

        if (!Number.isInteger(returnId) || returnId <= 0) {
            return errorResponse("Invalid Sales Return ID.");
        }

        const result = await archiveAndSoftDelete(
            {
                db,
                companyId: auth.companyId,
                user: {
                    userId:
                        auth.user?.userId ??
                        auth.user?.user_id ??
                        auth.user?.id,
                },
            },
            {
                moduleKey: "sales_returns",
                recordId: returnId,
                deletionReason: "Draft Sales Return archived",
                validateRecord: async (_client, record) => {
                    if (String(record.status).toUpperCase() !== "DRAFT") {
                        return {
                            status: 409,
                            message: "Only DRAFT Sales Returns can be archived.",
                        };
                    }

                    return null;
                },
            }
        );

        if (!result.success) {
            return errorResponse(result.message, result.status);
        }

        return NextResponse.json(
            {
                success: true,
                message: "Draft Sales Return moved to the Recycle Bin.",
            },
            {
                headers: { "Cache-Control": "no-store" },
            }
        );
    } catch (error) {
        console.error("Sales Return DELETE error:", error);

        return errorResponse(
            error.message || "Failed to archive Sales Return.",
            500
        );
    }
}