import { NextResponse } from "next/server";
import pool from "@/lib/db";
import { authorizeSalesQuotations } from "@/lib/sales-quotations-auth";

export const runtime = "nodejs";

function errorResponse(message, status = 400) {
    return NextResponse.json(
        { success: false, message },
        { status }
    );
}

function textValue(value, maxLength = 5000) {
    if (value === undefined || value === null) return null;

    const result = String(value).trim();

    return result ? result.slice(0, maxLength) : null;
}

function validDate(value) {
    if (!value) return null;

    const text = String(value);

    if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return null;

    const date = new Date(`${text}T00:00:00Z`);

    if (
        Number.isNaN(date.getTime()) ||
        date.toISOString().slice(0, 10) !== text
    ) {
        return null;
    }

    return text;
}

function num(value, fallback = 0) {
    const result = Number(value);

    return Number.isFinite(result) ? result : fallback;
}

function money(value) {
    return Math.round((value + Number.EPSILON) * 100) / 100;
}

function calculateItems(items) {
    if (!Array.isArray(items) || items.length === 0) {
        throw new Error("Add at least one transaction line.");
    }

    if (items.length > 500) {
        throw new Error("Too many transaction lines.");
    }

    let subtotal = 0;
    let taxAmount = 0;

    const cleaned = items.map((item, index) => {
        const itemName = textValue(item.itemName, 255);
        const quantity = num(item.quantity, NaN);
        const unitPrice = num(item.unitPrice, NaN);
        const taxRate = num(item.taxRate, 0);

        if (!itemName) {
            throw new Error(`Item name is required on line ${index + 1}.`);
        }

        if (!Number.isFinite(quantity) || quantity <= 0) {
            throw new Error(`Invalid quantity on line ${index + 1}.`);
        }

        if (!Number.isFinite(unitPrice) || unitPrice < 0) {
            throw new Error(`Invalid unit price on line ${index + 1}.`);
        }

        if (!Number.isFinite(taxRate) || taxRate < 0 || taxRate > 100) {
            throw new Error(`Invalid tax rate on line ${index + 1}.`);
        }

        const amount = money(quantity * unitPrice);
        const lineTax = money(amount * taxRate / 100);
        const gross = money(amount + lineTax);

        subtotal += amount;
        taxAmount += lineTax;

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
            itemDescription: textValue(item.itemDescription),
            itemBalance: Math.max(0, num(item.itemBalance)),
            uom: textValue(item.uom, 50),
            quantity,
            unitPrice,
            amount,
            taxCode: textValue(item.taxCode, 100),
            taxRate,
            taxAmount: lineTax,
            grossAmount: gross,
            memo: textValue(item.memo, 2000),
            lineNumber: index + 1,
        };
    });

    return {
        items: cleaned,
        subtotal: money(subtotal),
        taxAmount: money(taxAmount),
        grossAmount: money(subtotal + taxAmount),
    };
}

async function getQuotation(client, quotationId, companyId) {
    const header = await client.query(
        `
        SELECT
            q.*,
            c.customer_name,
            c.customer_code,
            c.phone AS customer_phone,
            c.email AS customer_email,
            c.address AS customer_address,
            w.warehouse_name,
            co.company_name,
            creator.full_name AS created_by_name,
            updater.full_name AS updated_by_name
        FROM sales_quotations q
        LEFT JOIN customers c
            ON c.customer_id = q.customer_id
        LEFT JOIN warehouses w
            ON w.warehouse_id = q.warehouse_id
        INNER JOIN companies co
            ON co.company_id = q.company_id
        LEFT JOIN users creator
            ON creator.user_id = q.created_by
        LEFT JOIN users updater
            ON updater.user_id = q.updated_by
        WHERE q.quotation_id = $1
          AND q.company_id = $2
        `,
        [quotationId, companyId]
    );

    if (header.rowCount === 0) return null;

    const lines = await client.query(
        `
        SELECT *
        FROM sales_quotation_items
        WHERE quotation_id = $1
        ORDER BY line_number, quotation_item_id
        `,
        [quotationId]
    );

    return {
        ...header.rows[0],
        items: lines.rows,
    };
}

export async function GET(request, context) {
    try {
        const authorization = await authorizeSalesQuotations("view");

        if (!authorization.ok) {
            return errorResponse(
                authorization.message,
                authorization.status
            );
        }

        const params = await context.params;
        const quotationId = Number(params.id);

        if (!Number.isInteger(quotationId) || quotationId <= 0) {
            return errorResponse("Invalid quotation ID.");
        }

        const quotation = await getQuotation(
            pool,
            quotationId,
            authorization.user.companyId
        );

        if (!quotation) {
            return errorResponse("Quotation not found.", 404);
        }

        return NextResponse.json({
            success: true,
            quotation,
        });
    } catch (error) {
        console.error("GET quotation detail error:", error);

        return errorResponse(
            "Unable to load quotation details.",
            500
        );
    }
}

export async function PUT(request, context) {
    const client = await pool.connect();

    try {
        const authorization = await authorizeSalesQuotations("update");

        if (!authorization.ok) {
            return errorResponse(
                authorization.message,
                authorization.status
            );
        }

        const params = await context.params;
        const quotationId = Number(params.id);

        if (!Number.isInteger(quotationId) || quotationId <= 0) {
            return errorResponse("Invalid quotation ID.");
        }

        const { companyId, userId } = authorization.user;
        const body = await request.json();

        const quotationDate = validDate(body.quotationDate);
        const expiryDate = body.expiryDate
            ? validDate(body.expiryDate)
            : null;

        if (!quotationDate) {
            return errorResponse("Enter a valid quotation date.");
        }

        if (body.expiryDate && !expiryDate) {
            return errorResponse("Enter a valid expiry date.");
        }

        if (expiryDate && expiryDate < quotationDate) {
            return errorResponse(
                "The expiry date cannot be earlier than the quotation date."
            );
        }

        const status = body.status || "Draft";

        if (
            !["Draft", "Approved", "Rejected", "Expired", "Converted"].includes(
                status
            )
        ) {
            return errorResponse("Invalid quotation status.");
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
            return errorResponse("Select a valid customer.");
        }

        if (
            warehouseId !== null &&
            (!Number.isInteger(warehouseId) || warehouseId <= 0)
        ) {
            return errorResponse("Select a valid warehouse.");
        }

        const totals = calculateItems(body.items);

        await client.query("BEGIN");

        const existing = await client.query(
            `
            SELECT quotation_id, status
            FROM sales_quotations
            WHERE quotation_id = $1
              AND company_id = $2
            FOR UPDATE
            `,
            [quotationId, companyId]
        );

        if (existing.rowCount === 0) {
            await client.query("ROLLBACK");

            return errorResponse("Quotation not found.", 404);
        }

        if (existing.rows[0].status === "Converted") {
            await client.query("ROLLBACK");

            return errorResponse(
                "A converted quotation cannot be edited.",
                400
            );
        }

        if (customerId !== null) {
            const result = await client.query(
                `SELECT customer_id
                 FROM customers
                 WHERE customer_id = $1
                   AND is_active = TRUE`,
                [customerId]
            );

            if (result.rowCount === 0) {
                throw new Error("The selected customer is not active or does not exist.");
            }
        }

        if (warehouseId !== null) {
            const result = await client.query(
                `SELECT warehouse_id
                 FROM warehouses
                 WHERE warehouse_id = $1
                   AND is_active = TRUE`,
                [warehouseId]
            );

            if (result.rowCount === 0) {
                throw new Error("The selected warehouse is not active or does not exist.");
            }
        }

        await client.query(
            `
            UPDATE sales_quotations
            SET
                customer_id = $1,
                warehouse_id = $2,
                quotation_date = $3,
                expiry_date = $4,
                status = $5,
                department = $6,
                project = $7,
                quotation_class = $8,
                sales_rep = $9,
                payment_term = $10,
                memo = $11,
                terms_conditions = $12,
                related_transaction = $13,
                attachment_name = $14,
                attachment_url = $15,
                subtotal = $16,
                tax_amount = $17,
                gross_amount = $18,
                updated_by = $19,
                updated_at = CURRENT_TIMESTAMP
            WHERE quotation_id = $20
              AND company_id = $21
            `,
            [
                customerId,
                warehouseId,
                quotationDate,
                expiryDate,
                status,
                textValue(body.department, 150),
                textValue(body.project, 150),
                textValue(body.quotationClass, 150),
                textValue(body.salesRep, 150),
                textValue(body.paymentTerm, 100),
                textValue(body.memo),
                textValue(body.termsConditions),
                textValue(body.relatedTransaction, 2000),
                textValue(body.attachmentName, 255),
                textValue(body.attachmentUrl, 2000),
                totals.subtotal,
                totals.taxAmount,
                totals.grossAmount,
                userId,
                quotationId,
                companyId,
            ]
        );

        await client.query(
            `DELETE FROM sales_quotation_items
             WHERE quotation_id = $1`,
            [quotationId]
        );

        for (const item of totals.items) {
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

        await client.query("COMMIT");

        return NextResponse.json({
            success: true,
            message: "Quotation updated successfully.",
            quotationId,
        });
    } catch (error) {
        await client.query("ROLLBACK");

        console.error("PUT quotation error:", error);

        const clientError = [
            "Add at least one transaction line.",
            "Item name is required",
            "Invalid quantity",
            "Invalid unit price",
            "Invalid tax rate",
            "Enter a valid quotation date",
            "Enter a valid expiry date",
            "The expiry date cannot be earlier",
            "Invalid quotation status",
            "The selected customer is not active",
            "The selected warehouse is not active",
        ].some((message) => error.message?.includes(message));

        return errorResponse(
            clientError
                ? error.message
                : "Unable to update quotation.",
            clientError ? 400 : 500
        );
    } finally {
        client.release();
    }
}