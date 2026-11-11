import { NextResponse } from "next/server";
import pool from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { hasPermission } from "@/lib/permissions";

export const dynamic = "force-dynamic";

export async function POST(request, { params }) {
    const client = await pool.connect();

    try {
        const user = await getCurrentUser();

        if (!user?.userId || !user?.companyId) {
            return NextResponse.json(
                { success: false, message: "Please sign in to continue." },
                { status: 401 }
            );
        }

        const membership = await client.query(
            `
            SELECT uc.company_id, uc.role_id
            FROM user_companies uc
            JOIN users u ON u.user_id = uc.user_id
            JOIN companies c ON c.company_id = uc.company_id
            WHERE uc.user_id = $1
              AND uc.company_id = $2
              AND u.is_active = TRUE
              AND c.is_active = TRUE
            LIMIT 1
            `,
            [user.userId, user.companyId]
        );

        if (!membership.rows.length) {
            return NextResponse.json(
                { success: false, message: "Your company access could not be verified." },
                { status: 403 }
            );
        }

        const companyId = Number(membership.rows[0].company_id);
        const roleId = Number(membership.rows[0].role_id);

        if (!(await hasPermission(roleId, "sales_orders", "create"))) {
            return NextResponse.json(
                { success: false, message: "You do not have permission to create Sales Orders." },
                { status: 403 }
            );
        }

        const { id } = await params;
        const quotationId = Number(id);

        if (!Number.isSafeInteger(quotationId) || quotationId <= 0) {
            return NextResponse.json(
                { success: false, message: "Invalid quotation ID." },
                { status: 400 }
            );
        }

        await client.query("BEGIN");

        const quotationResult = await client.query(
            `
            SELECT *
            FROM sales_quotations
            WHERE quotation_id = $1
              AND company_id = $2
            FOR UPDATE
            `,
            [quotationId, companyId]
        );

        if (!quotationResult.rows.length) {
            await client.query("ROLLBACK");

            return NextResponse.json(
                { success: false, message: "Sales Quotation not found." },
                { status: 404 }
            );
        }

        const quotation = quotationResult.rows[0];

        if (String(quotation.status).toUpperCase() !== "APPROVED") {
            await client.query("ROLLBACK");

            return NextResponse.json(
                { success: false, message: "Only an approved Sales Quotation can be converted." },
                { status: 400 }
            );
        }

        const existingOrder = await client.query(
            `
            SELECT order_id, order_number
            FROM sales_orders
            WHERE source_quotation_id = $1
            `,
            [quotationId]
        );

        if (existingOrder.rows.length) {
            await client.query("ROLLBACK");

            return NextResponse.json(
                {
                    success: false,
                    message: `This quotation has already been converted into ${existingOrder.rows[0].order_number}.`,
                    order: existingOrder.rows[0],
                },
                { status: 409 }
            );
        }

        if (!quotation.customer_id || !quotation.warehouse_id) {
            await client.query("ROLLBACK");

            return NextResponse.json(
                {
                    success: false,
                    message: "The quotation must have a customer and From Location before conversion.",
                },
                { status: 400 }
            );
        }

        const quotationItems = await client.query(
            `
            SELECT *
            FROM sales_quotation_items
            WHERE quotation_id = $1
            ORDER BY line_number, quotation_item_id
            `,
            [quotationId]
        );

        if (!quotationItems.rows.length) {
            await client.query("ROLLBACK");

            return NextResponse.json(
                { success: false, message: "The quotation has no transaction lines." },
                { status: 400 }
            );
        }

        const sequenceResult = await client.query(
            `SELECT nextval(pg_get_serial_sequence('sales_orders', 'order_id')) AS order_id`
        );

        const orderId = Number(sequenceResult.rows[0].order_id);
        const orderNumber = `SO-${String(orderId).padStart(6, "0")}`;

        const companyResult = await client.query(
            `SELECT currency FROM companies WHERE company_id = $1`,
            [companyId]
        );

        await client.query(
            `
            INSERT INTO sales_orders (
                order_id,
                company_id,
                order_number,
                source_quotation_id,
                customer_id,
                warehouse_id,
                transaction_date,
                status,
                document_status,
                department,
                project,
                order_class,
                sales_rep,
                payment_term,
                memo,
                terms_conditions,
                currency,
                exchange_rate,
                subtotal,
                tax_amount,
                gross_amount,
                customer_credit_limit,
                created_by,
                updated_by
            )
            VALUES (
                $1, $2, $3, $4, $5, $6, CURRENT_DATE, 'APPROVED',
                'Pending Delivery Challan',
                $7, $8, $9, $10, $11, $12, $13,
                $14, 1, $15, $16, $17, 0, $18, $18
            )
            `,
            [
                orderId,
                companyId,
                orderNumber,
                quotationId,
                quotation.customer_id,
                quotation.warehouse_id,
                quotation.department,
                quotation.project,
                quotation.quotation_class,
                quotation.sales_rep,
                quotation.payment_term,
                quotation.memo,
                quotation.terms_conditions,
                companyResult.rows[0]?.currency || "PKR",
                Number(quotation.subtotal || 0),
                Number(quotation.tax_amount || 0),
                Number(quotation.gross_amount || 0),
                Number(user.userId),
            ]
        );

        for (const item of quotationItems.rows) {
            await client.query(
                `
                INSERT INTO sales_order_items (
                    order_id,
                    product_id,
                    item_name,
                    item_description,
                    item_balance,
                    uom,
                    quantity,
                    retail_price,
                    discount_percent,
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
                    $1, $2, $3, $4, $5, $6, $7, $8, 0,
                    $8, $9, $10, $11, $12, $13, $14, $15
                )
                `,
                [
                    orderId,
                    item.product_id,
                    item.item_name,
                    item.item_description,
                    item.item_balance,
                    item.uom,
                    item.quantity,
                    Number(item.unit_price || 0),
                    Number(item.amount || 0),
                    item.tax_code,
                    Number(item.tax_rate || 0),
                    Number(item.tax_amount || 0),
                    Number(item.gross_amount || 0),
                    item.memo,
                    item.line_number,
                ]
            );
        }

        await client.query("COMMIT");

        return NextResponse.json(
            {
                success: true,
                message: "Approved quotation converted into a Sales Order.",
                order: {
                    order_id: orderId,
                    order_number: orderNumber,
                },
            },
            { status: 201 }
        );
    } catch (error) {
        try {
            await client.query("ROLLBACK");
        } catch {}

        console.error("QUOTATION CONVERSION ERROR:", error);

        if (error.code === "23505") {
            return NextResponse.json(
                { success: false, message: "This quotation has already been converted." },
                { status: 409 }
            );
        }

        return NextResponse.json(
            { success: false, message: "Could not convert the quotation into a Sales Order." },
            { status: 500 }
        );
    } finally {
        client.release();
    }
}