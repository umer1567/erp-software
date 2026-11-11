import { NextResponse } from "next/server";
import pool from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { requirePermission } from "@/lib/permissions";

export const dynamic = "force-dynamic";

/* -------------------------------------------------------------------------- */
/* Helpers                                                                    */
/* -------------------------------------------------------------------------- */

function validationError(message, status = 400) {
    const error = new Error(message);
    error.status = status;
    return error;
}

function apiError(error) {
    console.error("RFQ supplier quotation API error:", error);

    if (error.message === "UNAUTHORIZED") {
        return NextResponse.json(
            {
                success: false,
                message: "Please log in again.",
            },
            { status: 401 }
        );
    }

    if (error.message === "FORBIDDEN") {
        return NextResponse.json(
            {
                success: false,
                message: "You do not have permission to perform this action.",
            },
            { status: 403 }
        );
    }

    const status =
        error.status ||
        (
            error.code === "23505" ? 409 :
            error.code === "23503" ? 400 :
            error.code === "23514" ? 400 :
            500
        );

    return NextResponse.json(
        {
            success: false,
            message: error.message || "Supplier quotation operation failed.",
        },
        { status }
    );
}

async function getRfqId(context) {
    const params = await context.params;
    const id = Number(params.id);

    if (!Number.isSafeInteger(id) || id <= 0) {
        throw validationError("Invalid RFQ ID.");
    }

    return id;
}

function normalizeDate(value, fieldName) {
    if (
        value === undefined ||
        value === null ||
        value === ""
    ) {
        return null;
    }

    const dateString = String(value).trim().slice(0, 10);

    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateString)) {
        throw validationError(
            `Please provide a valid ${fieldName}.`
        );
    }

    const date = new Date(
        `${dateString}T00:00:00.000Z`
    );

    if (
        Number.isNaN(date.getTime()) ||
        date.toISOString().slice(0, 10) !== dateString
    ) {
        throw validationError(
            `Please provide a valid ${fieldName}.`
        );
    }

    return dateString;
}
function normalizeNumber(value, fieldName, options = {}) {
    const { min = 0, allowZero = true } = options;

    if (
        value === undefined ||
        value === null ||
        value === ""
    ) {
        throw validationError(`${fieldName} is required.`);
    }

    const number = Number(value);

    if (
        !Number.isFinite(number) ||
        number < min ||
        (!allowZero && number === 0)
    ) {
        throw validationError(`Please provide a valid ${fieldName}.`);
    }

    return number;
}

function normalizeQuotationItems(items) {
    if (!Array.isArray(items) || items.length === 0) {
        throw validationError(
            "Please enter at least one supplier quotation item."
        );
    }

    const seen = new Set();

    return items.map((item, index) => {
        const rfqItemId = Number(
            item.rfqItemId ??
            item.rfq_item_id
        );

        if (
            !Number.isSafeInteger(rfqItemId) ||
            rfqItemId <= 0
        ) {
            throw validationError(
                `Invalid RFQ item on quotation line ${index + 1}.`
            );
        }

        if (seen.has(rfqItemId)) {
            throw validationError(
                "The same RFQ item cannot appear more than once in a supplier quotation."
            );
        }

        seen.add(rfqItemId);

        const quotedQuantity = normalizeNumber(
            item.quotedQuantity ?? item.quoted_quantity,
            `quoted quantity on line ${index + 1}`,
            { min: 0, allowZero: false }
        );

        const unitPrice = normalizeNumber(
            item.unitPrice ?? item.unit_price,
            `unit price on line ${index + 1}`
        );

        const taxRate = normalizeNumber(
            item.taxRate ?? item.tax_rate ?? 0,
            `tax rate on line ${index + 1}`
        );

        const discountAmount = normalizeNumber(
            item.discountAmount ?? item.discount_amount ?? 0,
            `discount amount on line ${index + 1}`
        );

        const currencyCode = String(
            item.currencyCode ??
            item.currency_code ??
            "PKR"
        ).trim().toUpperCase();

        if (!currencyCode || currencyCode.length > 20) {
            throw validationError(
                `Invalid currency code on line ${index + 1}.`
            );
        }

        return {
            rfqItemId,
            quotedQuantity,
            unitPrice,
            taxRate,
            discountAmount,
            currencyCode,
            remarks: String(item.remarks || "").trim() || null,
        };
    });
}

/* -------------------------------------------------------------------------- */
/* GET: Retrieve supplier quotations and comparison data                     */
/* -------------------------------------------------------------------------- */

export async function GET(request, context) {
    try {
        const user = await getCurrentUser();

        await requirePermission(user, "rfqs", "view");

        if (!user.companyId) {
            throw validationError("Company information is missing.");
        }

        const rfqId = await getRfqId(context);

        const rfqResult = await pool.query(
            `
            SELECT
                rfq_id,
                transaction_number,
                transaction_date,
                status

            FROM rfqs

            WHERE
                rfq_id = $1
                AND company_id = $2

            LIMIT 1
            `,
            [rfqId, user.companyId]
        );

        if (!rfqResult.rows.length) {
            throw validationError("RFQ not found.", 404);
        }

        const [itemsResult, vendorsResult, quotesResult] =
            await Promise.all([
                /* RFQ items */
                pool.query(
                    `
                    SELECT
                        i.rfq_item_id,
                        i.product_id,
                        i.item_description,
                        i.uom,
                        i.quantity,

                        COALESCE(
                            p.product_name,
                            i.item_description,
                            ''
                        ) AS product_name,

                        p.sku

                    FROM rfq_items i

                    LEFT JOIN products p
                        ON p.product_id = i.product_id

                    WHERE i.rfq_id = $1

                    ORDER BY i.rfq_item_id
                    `,
                    [rfqId]
                ),

                /* Invited suppliers */
                pool.query(
                    `
                    SELECT
                        v.rfq_vendor_id,
                        v.supplier_id,
                        v.status,
                        v.response_date,
                        v.validity_date,
                        v.delivery_days,
                        v.payment_terms,
                        v.notes,

                        s.supplier_code,
                        s.supplier_name,
                        s.phone,
                        s.email,
                        s.address

                    FROM rfq_vendors v

                    INNER JOIN suppliers s
                        ON s.supplier_id = v.supplier_id

                    WHERE v.rfq_id = $1

                    ORDER BY s.supplier_name
                    `,
                    [rfqId]
                ),

                /* All quotation lines */
                pool.query(
                    `
                    SELECT
                        q.rfq_vendor_quote_id,
                        q.rfq_vendor_id,
                        q.rfq_item_id,
                        q.quoted_quantity,
                        q.unit_price,
                        q.tax_rate,
                        q.discount_amount,
                        q.currency_code,
                        q.remarks,
                        q.created_at,
                        q.updated_at

                    FROM rfq_vendor_quotes q

                    INNER JOIN rfq_vendors v
                        ON v.rfq_vendor_id = q.rfq_vendor_id

                    WHERE v.rfq_id = $1

                    ORDER BY
                        q.rfq_vendor_id,
                        q.rfq_item_id
                    `,
                    [rfqId]
                ),
            ]);

        const quotesByVendor = new Map();

        for (const quote of quotesResult.rows) {
            const vendorId = Number(quote.rfq_vendor_id);

            if (!quotesByVendor.has(vendorId)) {
                quotesByVendor.set(vendorId, []);
            }

            quotesByVendor.get(vendorId).push(quote);
        }

        const vendors = vendorsResult.rows.map((vendor) => {
            const vendorQuotes =
                quotesByVendor.get(Number(vendor.rfq_vendor_id)) || [];

            const quotedSubtotal = vendorQuotes.reduce(
                (total, quote) => {
                    const quantity = Number(quote.quoted_quantity || 0);
                    const price = Number(quote.unit_price || 0);
                    const discount = Number(quote.discount_amount || 0);

                    return total + Math.max(
                        0,
                        quantity * price - discount
                    );
                },
                0
            );

            const taxTotal = vendorQuotes.reduce(
                (total, quote) => {
                    const quantity = Number(quote.quoted_quantity || 0);
                    const price = Number(quote.unit_price || 0);
                    const discount = Number(quote.discount_amount || 0);
                    const taxRate = Number(quote.tax_rate || 0);

                    const taxableAmount = Math.max(
                        0,
                        quantity * price - discount
                    );

                    return total + taxableAmount * taxRate / 100;
                },
                0
            );

            return {
                ...vendor,
                quotes: vendorQuotes,
                quote_count: vendorQuotes.length,
                quoted_subtotal: quotedSubtotal.toFixed(2),
                tax_total: taxTotal.toFixed(2),
                quoted_total: (quotedSubtotal + taxTotal).toFixed(2),
            };
        });

        return NextResponse.json({
            success: true,
            rfq: rfqResult.rows[0],
            items: itemsResult.rows,
            vendors,
        });
    } catch (error) {
        return apiError(error);
    }
}

/* -------------------------------------------------------------------------- */
/* POST: Record or update a supplier quotation                                */
/* -------------------------------------------------------------------------- */

export async function POST(request, context) {
    let client;
    let transactionStarted = false;

    try {
        const user = await getCurrentUser();

        /*
         * Recording a supplier quotation changes RFQ records.
         * Therefore, the user must have RFQ update permission.
         */
        await requirePermission(user, "rfqs", "update");

        if (!user.companyId) {
            throw validationError("Company information is missing.");
        }

        const rfqId = await getRfqId(context);
        const body = await request.json();

        const rfqVendorId = Number(
            body.rfqVendorId ??
            body.rfq_vendor_id
        );

        if (
            !Number.isSafeInteger(rfqVendorId) ||
            rfqVendorId <= 0
        ) {
            throw validationError("Please select an invited supplier.");
        }

        const items = normalizeQuotationItems(body.items);

        const validityDate = normalizeDate(
            body.validityDate ?? body.validity_date,
            "quotation validity date"
        );

        const deliveryDaysValue =
            body.deliveryDays ?? body.delivery_days;

        let deliveryDays = null;

        if (
            deliveryDaysValue !== undefined &&
            deliveryDaysValue !== null &&
            deliveryDaysValue !== ""
        ) {
            deliveryDays = Number(deliveryDaysValue);

            if (
                !Number.isSafeInteger(deliveryDays) ||
                deliveryDays < 0
            ) {
                throw validationError(
                    "Delivery days must be a whole number greater than or equal to zero."
                );
            }
        }

        const paymentTerms = String(
            body.paymentTerms ??
            body.payment_terms ??
            ""
        ).trim() || null;

        const notes = String(
            body.notes ??
            body.remarks ??
            ""
        ).trim() || null;

        const responseDate = normalizeDate(
            body.responseDate ?? body.response_date,
            "response date"
        );

        client = await pool.connect();

        await client.query("BEGIN");
        transactionStarted = true;

        /* ------------------------------------------------------------------ */
        /* Verify RFQ ownership and status                                    */
        /* ------------------------------------------------------------------ */

        const rfqResult = await client.query(
            `
            SELECT
                rfq_id,
                status

            FROM rfqs

            WHERE
                rfq_id = $1
                AND company_id = $2

            FOR UPDATE
            `,
            [rfqId, user.companyId]
        );

        if (!rfqResult.rows.length) {
            throw validationError("RFQ not found.", 404);
        }

        const rfqStatus = String(
            rfqResult.rows[0].status || ""
        ).toUpperCase();

        if (["CLOSED", "CANCELLED"].includes(rfqStatus)) {
            throw validationError(
                "Supplier quotations cannot be entered for a closed or cancelled RFQ."
            );
        }

        /* ------------------------------------------------------------------ */
        /* Verify supplier invitation                                         */
        /* ------------------------------------------------------------------ */

        const vendorResult = await client.query(
            `
            SELECT
                v.rfq_vendor_id,
                v.rfq_id,
                v.supplier_id,
                v.status

            FROM rfq_vendors v

            WHERE
                v.rfq_vendor_id = $1
                AND v.rfq_id = $2

            FOR UPDATE
            `,
            [rfqVendorId, rfqId]
        );

        if (!vendorResult.rows.length) {
            throw validationError(
                "The selected supplier is not invited to this RFQ.",
                404
            );
        }

        const vendor = vendorResult.rows[0];

        if (vendor.status === "DECLINED") {
            throw validationError(
                "A quotation cannot be entered for a supplier marked as DECLINED."
            );
        }

        /* ------------------------------------------------------------------ */
        /* Verify that all selected items belong to this RFQ                  */
        /* ------------------------------------------------------------------ */

        const rfqItemIds = items.map((item) => item.rfqItemId);

        const validItemsResult = await client.query(
            `
            SELECT rfq_item_id

            FROM rfq_items

            WHERE
                rfq_id = $1
                AND rfq_item_id = ANY($2::INTEGER[])

            FOR UPDATE
            `,
            [rfqId, rfqItemIds]
        );

        if (validItemsResult.rows.length !== rfqItemIds.length) {
            throw validationError(
                "One or more selected quotation items do not belong to this RFQ. Refresh the page and try again."
            );
        }

        /* ------------------------------------------------------------------ */
        /* Save supplier quotation lines                                      */
        /* ------------------------------------------------------------------ */

        for (const item of items) {
            await client.query(
                `
                INSERT INTO rfq_vendor_quotes (
                    rfq_vendor_id,
                    rfq_item_id,
                    quoted_quantity,
                    unit_price,
                    tax_rate,
                    discount_amount,
                    currency_code,
                    remarks,
                    created_at,
                    updated_at
                )
                VALUES (
                    $1, $2, $3, $4, $5,
                    $6, $7, $8, NOW(), NOW()
                )

                ON CONFLICT (
                    rfq_vendor_id,
                    rfq_item_id
                )

                DO UPDATE SET
                    quoted_quantity = EXCLUDED.quoted_quantity,
                    unit_price = EXCLUDED.unit_price,
                    tax_rate = EXCLUDED.tax_rate,
                    discount_amount = EXCLUDED.discount_amount,
                    currency_code = EXCLUDED.currency_code,
                    remarks = EXCLUDED.remarks,
                    updated_at = NOW()
                `,
                [
                    rfqVendorId,
                    item.rfqItemId,
                    item.quotedQuantity,
                    item.unitPrice,
                    item.taxRate,
                    item.discountAmount,
                    item.currencyCode,
                    item.remarks,
                ]
            );
        }

        /* ------------------------------------------------------------------ */
        /* Update supplier response information                               */
        /* ------------------------------------------------------------------ */

        await client.query(
            `
            UPDATE rfq_vendors

            SET
                status = 'RESPONDED',
                response_date = COALESCE($1::DATE, CURRENT_DATE),
                validity_date = $2,
                delivery_days = $3,
                payment_terms = $4,
                notes = $5

            WHERE
                rfq_vendor_id = $6
                AND rfq_id = $7
            `,
            [
                responseDate,
                validityDate,
                deliveryDays,
                paymentTerms,
                notes,
                rfqVendorId,
                rfqId,
            ]
        );

        await client.query("COMMIT");
        transactionStarted = false;

        return NextResponse.json({
            success: true,
            message: "Supplier quotation saved successfully.",
            rfqId,
            rfqVendorId,
            quoteLinesSaved: items.length,
            status: "RESPONDED",
        });
    } catch (error) {
        if (transactionStarted && client) {
            await client.query("ROLLBACK").catch(() => {});
        }

        return apiError(error);
    } finally {
        client?.release();
    }
}