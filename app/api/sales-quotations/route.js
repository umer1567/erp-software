import { NextResponse } from "next/server";
import pool from "@/lib/db";
import { authorizeSalesQuotations } from "@/lib/sales-quotations-auth";

export const runtime = "nodejs";

function jsonError(message, status = 400) {
    return NextResponse.json(
        { success: false, message },
        { status }
    );
}

function cleanText(value, maxLength = 5000) {
    if (value === null || value === undefined) {
        return null;
    }

    const text = String(value).trim();

    return text ? text.slice(0, maxLength) : null;
}

function validDate(value) {
    if (!value) return null;

    const text = String(value);

    if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) {
        return null;
    }

    const date = new Date(`${text}T00:00:00Z`);

    if (Number.isNaN(date.getTime())) {
        return null;
    }

    if (date.toISOString().slice(0, 10) !== text) {
        return null;
    }

    return text;
}

function numberValue(value, fallback = 0) {
    const number = Number(value);

    return Number.isFinite(number) ? number : fallback;
}

function roundMoney(value) {
    return Math.round((value + Number.EPSILON) * 100) / 100;
}

function calculateItems(items) {
    if (!Array.isArray(items) || items.length === 0) {
        throw new Error("Add at least one transaction line.");
    }

    if (items.length > 500) {
        throw new Error("A quotation cannot contain more than 500 lines.");
    }

    let subtotal = 0;
    let taxTotal = 0;

    const cleanedItems = items.map((item, index) => {
        const itemName = cleanText(item.itemName, 255);

        if (!itemName) {
            throw new Error(`Item name is required on line ${index + 1}.`);
        }

        const quantity = numberValue(item.quantity, NaN);
        const unitPrice = numberValue(item.unitPrice, NaN);
        const taxRate = numberValue(item.taxRate, 0);

        if (!Number.isFinite(quantity) || quantity <= 0) {
            throw new Error(
                `Quantity must be greater than zero on line ${index + 1}.`
            );
        }

        if (!Number.isFinite(unitPrice) || unitPrice < 0) {
            throw new Error(
                `Unit price cannot be negative on line ${index + 1}.`
            );
        }

        if (!Number.isFinite(taxRate) || taxRate < 0 || taxRate > 100) {
            throw new Error(
                `Tax rate must be between 0 and 100 on line ${index + 1}.`
            );
        }

        const amount = roundMoney(quantity * unitPrice);
        const taxAmount = roundMoney(amount * taxRate / 100);
        const grossAmount = roundMoney(amount + taxAmount);

        subtotal += amount;
        taxTotal += taxAmount;

        const productId = item.productId
            ? Number(item.productId)
            : null;

        if (
            productId !== null &&
            (!Number.isInteger(productId) || productId <= 0)
        ) {
            throw new Error(`Invalid product on line ${index + 1}.`);
        }

        return {
            productId,
            itemName,
            itemDescription: cleanText(item.itemDescription, 5000),
            itemBalance: Math.max(
                0,
                numberValue(item.itemBalance, 0)
            ),
            uom: cleanText(item.uom, 50),
            quantity,
            unitPrice,
            amount,
            taxCode: cleanText(item.taxCode, 100),
            taxRate,
            taxAmount,
            grossAmount,
            memo: cleanText(item.memo, 2000),
            lineNumber: index + 1,
        };
    });

    return {
        items: cleanedItems,
        subtotal: roundMoney(subtotal),
        taxAmount: roundMoney(taxTotal),
        grossAmount: roundMoney(subtotal + taxTotal),
    };
}

async function insertQuotationItems(client, quotationId, items) {
    for (const item of items) {
        await client.query(
            `
            INSERT INTO sales_quotation_items (
                quotation_id,
                product_id,
                item_name,
                item_description,
                item_balance,
                uom,
                quantity,
                unit_price,
                amount,
                tax_code,
                tax_rate,
                tax_amount,
                gross_amount,
                memo,
                line_number
            )
            VALUES (
                $1, $2, $3, $4, $5, $6, $7, $8,
                $9, $10, $11, $12, $13, $14, $15
            )
            `,
            [
                quotationId,
                item.productId,
                item.itemName,
                item.itemDescription,
                item.itemBalance,
                item.uom,
                item.quantity,
                item.unitPrice,
                item.amount,
                item.taxCode,
                item.taxRate,
                item.taxAmount,
                item.grossAmount,
                item.memo,
                item.lineNumber,
            ]
        );
    }
}

export async function GET(request) {
    try {
        const authorization = await authorizeSalesQuotations("view");

        if (!authorization.ok) {
            return jsonError(
                authorization.message,
                authorization.status
            );
        }

        const { companyId } = authorization.user;
        const { searchParams } = new URL(request.url);

        const search = (searchParams.get("search") || "").trim();
        const status = (searchParams.get("status") || "").trim();

        const result = await pool.query(
            `
            SELECT
                q.quotation_id,
                q.quotation_number,
                q.company_id,
                q.customer_id,
                q.warehouse_id,
                q.quotation_date,
                q.expiry_date,
                q.status,
                q.department,
                q.project,
                q.quotation_class,
                q.sales_rep,
                q.payment_term,
                q.memo,
                q.subtotal,
                q.tax_amount,
                q.gross_amount,
                q.created_at,
                q.updated_at,
                c.customer_name,
                w.warehouse_name
            FROM sales_quotations q
            LEFT JOIN customers c
                ON c.customer_id = q.customer_id
            LEFT JOIN warehouses w
                ON w.warehouse_id = q.warehouse_id
            WHERE q.company_id = $1
              AND (
                  $2 = ''
                  OR q.quotation_number ILIKE '%' || $2 || '%'
                  OR COALESCE(c.customer_name, '') ILIKE '%' || $2 || '%'
                  OR COALESCE(q.sales_rep, '') ILIKE '%' || $2 || '%'
              )
              AND ($3 = '' OR q.status = $3)
            ORDER BY q.quotation_id DESC
            LIMIT 500
            `,
            [companyId, search, status]
        );

        return NextResponse.json({
            success: true,
            quotations: result.rows,
        });
    } catch (error) {
        console.error("GET sales quotations error:", error);

        return jsonError(
            "Unable to load sales quotations.",
            500
        );
    }
}

export async function POST(request) {
    const client = await pool.connect();

    try {
        const authorization = await authorizeSalesQuotations("create");

        if (!authorization.ok) {
            return jsonError(
                authorization.message,
                authorization.status
            );
        }

        const { userId, companyId } = authorization.user;
        const body = await request.json();

        const quotationDate = validDate(body.quotationDate);
        const expiryDate = body.expiryDate
            ? validDate(body.expiryDate)
            : null;

        if (!quotationDate) {
            return jsonError("Enter a valid quotation date.");
        }

        if (body.expiryDate && !expiryDate) {
            return jsonError("Enter a valid quotation expiry date.");
        }

        if (expiryDate && expiryDate < quotationDate) {
            return jsonError(
                "The expiry date cannot be earlier than the quotation date."
            );
        }

        const status = body.status || "Draft";

        if (!["Draft", "Approved", "Rejected", "Expired"].includes(status)) {
            return jsonError("Invalid status for a new quotation.");
        }

        const customerId = body.customerId
            ? Number(body.customerId)
            : null;

        const warehouseId = body.warehouseId
            ? Number(body.warehouseId)
            : null;

        if (
            customerId !== null &&
            (!Number.isInteger(customerId) || customerId <= 0)
        ) {
            return jsonError("Select a valid customer.");
        }

        if (
            warehouseId !== null &&
            (!Number.isInteger(warehouseId) || warehouseId <= 0)
        ) {
            return jsonError("Select a valid warehouse.");
        }

        const totals = calculateItems(body.items);

        await client.query("BEGIN");

        // Verify referenced records exist before saving.
        if (customerId !== null) {
            const customer = await client.query(
                `SELECT customer_id
                 FROM customers
                 WHERE customer_id = $1
                   AND is_active = TRUE`,
                [customerId]
            );

            if (customer.rowCount === 0) {
                throw new Error("The selected customer is not active or does not exist.");
            }
        }

        if (warehouseId !== null) {
            const warehouse = await client.query(
                `SELECT warehouse_id
                 FROM warehouses
                 WHERE warehouse_id = $1
                   AND is_active = TRUE`,
                [warehouseId]
            );

            if (warehouse.rowCount === 0) {
                throw new Error("The selected warehouse is not active or does not exist.");
            }
        }

        // Atomically reserve the next quotation number for this company.
        const counter = await client.query(
            `
            INSERT INTO sales_quotation_counters (
                company_id,
                last_number
            )
            VALUES ($1, 1)
            ON CONFLICT (company_id)
            DO UPDATE SET
                last_number = sales_quotation_counters.last_number + 1
            RETURNING last_number
            `,
            [companyId]
        );

        const quotationNumber = `QO-${String(
            counter.rows[0].last_number
        ).padStart(6, "0")}`;

        const inserted = await client.query(
            `
            INSERT INTO sales_quotations (
                company_id,
                quotation_number,
                customer_id,
                warehouse_id,
                quotation_date,
                expiry_date,
                status,
                department,
                project,
                quotation_class,
                sales_rep,
                payment_term,
                memo,
                terms_conditions,
                related_transaction,
                attachment_name,
                attachment_url,
                subtotal,
                tax_amount,
                gross_amount,
                created_by,
                updated_by
            )
            VALUES (
                $1, $2, $3, $4, $5, $6, $7,
                $8, $9, $10, $11, $12, $13, $14,
                $15, $16, $17, $18, $19, $20, $21, $21
            )
            RETURNING quotation_id, quotation_number
            `,
            [
                companyId,
                quotationNumber,
                customerId,
                warehouseId,
                quotationDate,
                expiryDate,
                status,
                cleanText(body.department, 150),
                cleanText(body.project, 150),
                cleanText(body.quotationClass, 150),
                cleanText(body.salesRep, 150),
                cleanText(body.paymentTerm, 100),
                cleanText(body.memo),
                cleanText(body.termsConditions),
                cleanText(body.relatedTransaction, 2000),
                cleanText(body.attachmentName, 255),
                cleanText(body.attachmentUrl, 2000),
                totals.subtotal,
                totals.taxAmount,
                totals.grossAmount,
                userId,
            ]
        );

        const quotationId = inserted.rows[0].quotation_id;

        await insertQuotationItems(
            client,
            quotationId,
            totals.items
        );

        await client.query("COMMIT");

        return NextResponse.json(
            {
                success: true,
                message: "Sales quotation saved successfully.",
                quotation: {
                    quotationId,
                    quotationNumber,
                },
            },
            { status: 201 }
        );
    } catch (error) {
        await client.query("ROLLBACK");

        console.error("POST sales quotation error:", error);

        const clientError = [
            "Add at least one transaction line.",
            "Quantity must be greater than zero",
            "Unit price cannot be negative",
            "Tax rate must be between 0 and 100",
            "Item name is required",
            "Enter a valid quotation date",
            "Enter a valid quotation expiry date",
            "The expiry date cannot be earlier",
            "Invalid status",
            "Select a valid customer",
            "Select a valid warehouse",
            "The selected customer is not active",
            "The selected warehouse is not active",
        ].some((message) => error.message?.includes(message));

        return jsonError(
            clientError
                ? error.message
                : "Unable to save the quotation. Please check the data and try again.",
            clientError ? 400 : 500
        );
    } finally {
        client.release();
    }
}