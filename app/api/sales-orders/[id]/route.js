import { NextResponse } from "next/server";
import pool from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { hasPermission } from "@/lib/permissions";

export const dynamic = "force-dynamic";

async function getContext() {
    const user = await getCurrentUser();

    if (!user?.userId || !user?.companyId) {
        throw new Error("UNAUTHORIZED");
    }

    const result = await pool.query(
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

    if (!result.rows.length) {
        throw new Error("UNAUTHORIZED");
    }

    return {
        userId: Number(user.userId),
        companyId: Number(result.rows[0].company_id),
        roleId: Number(result.rows[0].role_id),
    };
}

function errorResponse(error, fallback = "Unable to process the request.") {
    console.error("SALES ORDER DETAIL API:", error);

    if (error.message === "UNAUTHORIZED") {
        return NextResponse.json(
            { success: false, message: "Please sign in to continue." },
            { status: 401 }
        );
    }

    if (error.message === "FORBIDDEN") {
        return NextResponse.json(
            { success: false, message: "You do not have permission for this action." },
            { status: 403 }
        );
    }

    return NextResponse.json(
        { success: false, message: fallback },
        { status: 500 }
    );
}

function calculateItems(items) {
    if (!Array.isArray(items) || items.length === 0) {
        throw new Error("Add at least one transaction line.");
    }

    let subtotal = 0;
    let taxTotal = 0;

    const normalized = items.map((item, index) => {
        const quantity = Number(item.quantity);
        const retailPrice = Number(item.retail_price ?? item.unit_price);
        const discount = Number(item.discount_percent || 0);
        const taxRate = Number(item.tax_rate || 0);
        const productId =
            item.product_id === "" || item.product_id == null
                ? null
                : Number(item.product_id);

        if (!String(item.item_name || "").trim()) {
            throw new Error(`Enter an item name on line ${index + 1}.`);
        }

        if (
            !Number.isFinite(quantity) || quantity <= 0 ||
            !Number.isFinite(retailPrice) || retailPrice < 0 ||
            !Number.isFinite(discount) || discount < 0 || discount > 100 ||
            !Number.isFinite(taxRate) || taxRate < 0 ||
            (productId !== null && (!Number.isSafeInteger(productId) || productId <= 0))
        ) {
            throw new Error(`Invalid values on line ${index + 1}.`);
        }

        const unitPrice = Math.round(retailPrice * (1 - discount / 100) * 100) / 100;
        const amount = Math.round(quantity * unitPrice * 100) / 100;
        const taxAmount = Math.round(amount * taxRate) / 100;
        const grossAmount = Math.round((amount + taxAmount) * 100) / 100;

        subtotal += amount;
        taxTotal += taxAmount;

        return {
            product_id: productId,
            item_name: String(item.item_name).trim(),
            item_description: item.item_description || null,
            item_balance: Number(item.item_balance || 0),
            uom: item.uom || null,
            quantity,
            retail_price: retailPrice,
            discount_percent: discount,
            unit_price: unitPrice,
            amount,
            tax_code: item.tax_code || null,
            tax_rate: taxRate,
            tax_amount: taxAmount,
            gross_amount: grossAmount,
            memo: item.memo || null,
            line_number: index + 1,
        };
    });

    return {
        items: normalized,
        subtotal: Math.round(subtotal * 100) / 100,
        taxAmount: Math.round(taxTotal * 100) / 100,
        grossAmount: Math.round((subtotal + taxTotal) * 100) / 100,
    };
}

async function findOrder(orderId, companyId) {
    const result = await pool.query(
        `
        SELECT *
        FROM sales_orders
        WHERE order_id = $1 AND company_id = $2
        `,
        [orderId, companyId]
    );

    return result.rows[0] || null;
}

async function loadItems(orderId) {
    const result = await pool.query(
        `
        SELECT *
        FROM sales_order_items
        WHERE order_id = $1
        ORDER BY line_number, order_item_id
        `,
        [orderId]
    );

    return result.rows;
}

// GET /api/sales-orders/:id
export async function GET(request, { params }) {
    try {
        const context = await getContext();

        if (!(await hasPermission(context.roleId, "sales_orders", "view"))) {
            throw new Error("FORBIDDEN");
        }

        const { id } = await params;
        const orderId = Number(id);

        if (!Number.isSafeInteger(orderId) || orderId <= 0) {
            return NextResponse.json(
                { success: false, message: "Invalid Sales Order ID." },
                { status: 400 }
            );
        }

        const order = await pool.query(
            `
            SELECT
                so.*,
                c.customer_name,
                c.customer_code,
                c.phone AS customer_phone,
                c.email AS customer_email,
                c.address AS customer_address,
                c.credit_limit AS current_credit_limit,
                w.warehouse_name,
                co.company_name,
                co.currency AS company_currency,
                q.quotation_number AS source_quotation_number
            FROM sales_orders so
            LEFT JOIN customers c ON c.customer_id = so.customer_id
            LEFT JOIN warehouses w ON w.warehouse_id = so.warehouse_id
            LEFT JOIN companies co ON co.company_id = so.company_id
            LEFT JOIN sales_quotations q ON q.quotation_id = so.source_quotation_id
            WHERE so.order_id = $1
              AND so.company_id = $2
            `,
            [orderId, context.companyId]
        );

        if (!order.rows.length) {
            return NextResponse.json(
                { success: false, message: "Sales Order not found." },
                { status: 404 }
            );
        }

        return NextResponse.json({
            success: true,
            order: order.rows[0],
            items: await loadItems(orderId),
        });
    } catch (error) {
        return errorResponse(error, "Could not load the Sales Order.");
    }
}

// PUT /api/sales-orders/:id
export async function PUT(request, { params }) {
    const client = await pool.connect();

    try {
        const context = await getContext();

        if (!(await hasPermission(context.roleId, "sales_orders", "update"))) {
            throw new Error("FORBIDDEN");
        }

        const { id } = await params;
        const orderId = Number(id);

        if (!Number.isSafeInteger(orderId) || orderId <= 0) {
            return NextResponse.json(
                { success: false, message: "Invalid Sales Order ID." },
                { status: 400 }
            );
        }

        const body = await request.json();
        const calculated = calculateItems(body.items);

        const customerId = Number(body.customer_id);
        const warehouseId = Number(body.warehouse_id);
        const transactionDate = String(body.transaction_date || "");
        const status = String(body.status || "DRAFT").toUpperCase();
        const exchangeRate = Number(body.exchange_rate || 1);

        if (!Number.isSafeInteger(customerId) || customerId <= 0) {
            return NextResponse.json(
                { success: false, message: "Select a customer." },
                { status: 400 }
            );
        }

        if (!Number.isSafeInteger(warehouseId) || warehouseId <= 0) {
            return NextResponse.json(
                { success: false, message: "Select a From Location." },
                { status: 400 }
            );
        }

        if (!/^\d{4}-\d{2}-\d{2}$/.test(transactionDate)) {
            return NextResponse.json(
                { success: false, message: "Enter a valid transaction date." },
                { status: 400 }
            );
        }

        if (!["DRAFT", "APPROVED", "CANCELLED"].includes(status)) {
            return NextResponse.json(
                { success: false, message: "Invalid status." },
                { status: 400 }
            );
        }

        if (!Number.isFinite(exchangeRate) || exchangeRate <= 0) {
            return NextResponse.json(
                { success: false, message: "Exchange rate must be greater than zero." },
                { status: 400 }
            );
        }

        await client.query("BEGIN");

        const existing = await client.query(
            `
            SELECT order_id, source_quotation_id, document_status
            FROM sales_orders
            WHERE order_id = $1 AND company_id = $2
            FOR UPDATE
            `,
            [orderId, context.companyId]
        );

        if (!existing.rows.length) {
            await client.query("ROLLBACK");
            return NextResponse.json(
                { success: false, message: "Sales Order not found." },
                { status: 404 }
            );
        }

        if (
            String(existing.rows[0].document_status || "").toLowerCase() === "fully invoiced"
        ) {
            await client.query("ROLLBACK");
            return NextResponse.json(
                { success: false, message: "A fully invoiced order cannot be edited." },
                { status: 409 }
            );
        }

        const customer = await client.query(
            `SELECT credit_limit FROM customers WHERE customer_id = $1 AND is_active = TRUE`,
            [customerId]
        );

        const warehouse = await client.query(
            `SELECT warehouse_id FROM warehouses WHERE warehouse_id = $1 AND is_active = TRUE`,
            [warehouseId]
        );

        if (!customer.rows.length || !warehouse.rows.length) {
            await client.query("ROLLBACK");
            return NextResponse.json(
                { success: false, message: "Select a valid active customer and location." },
                { status: 400 }
            );
        }

        for (const item of calculated.items) {
            if (item.product_id !== null) {
                const product = await client.query(
                    `SELECT product_id FROM products WHERE product_id = $1 AND is_active = TRUE`,
                    [item.product_id]
                );

                if (!product.rows.length) {
                    throw new Error(`Product "${item.item_name}" is unavailable.`);
                }
            }
        }

        await client.query(
            `
            UPDATE sales_orders
            SET
                customer_id = $1,
                warehouse_id = $2,
                transaction_date = $3,
                status = $4,
                department = $5,
                project = $6,
                order_class = $7,
                sales_rep = $8,
                payment_term = $9,
                memo = $10,
                terms_conditions = $11,
                currency = $12,
                exchange_rate = $13,
                subtotal = $14,
                tax_amount = $15,
                gross_amount = $16,
                customer_credit_limit = $17,
                updated_by = $18,
                updated_at = CURRENT_TIMESTAMP
            WHERE order_id = $19 AND company_id = $20
            `,
            [
                customerId,
                warehouseId,
                transactionDate,
                status,
                body.department || null,
                body.project || null,
                body.order_class || null,
                body.sales_rep || null,
                body.payment_term || null,
                body.memo || null,
                body.terms_conditions || null,
                String(body.currency || "PKR").toUpperCase(),
                exchangeRate,
                calculated.subtotal,
                calculated.taxAmount,
                calculated.grossAmount,
                Number(customer.rows[0].credit_limit || 0),
                context.userId,
                orderId,
                context.companyId,
            ]
        );

        await client.query(
            `DELETE FROM sales_order_items WHERE order_id = $1`,
            [orderId]
        );

        for (const item of calculated.items) {
            await client.query(
                `
                INSERT INTO sales_order_items (
                    order_id, product_id, item_name, item_description,
                    item_balance, uom, quantity, retail_price,
                    discount_percent, unit_price, amount, tax_code,
                    tax_rate, tax_amount, gross_amount, memo, line_number
                )
                VALUES (
                    $1, $2, $3, $4, $5, $6, $7, $8, $9,
                    $10, $11, $12, $13, $14, $15, $16, $17
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
                    item.retail_price,
                    item.discount_percent,
                    item.unit_price,
                    item.amount,
                    item.tax_code,
                    item.tax_rate,
                    item.tax_amount,
                    item.gross_amount,
                    item.memo,
                    item.line_number,
                ]
            );
        }

        await client.query("COMMIT");

        return NextResponse.json({
            success: true,
            message: "Sales Order updated successfully.",
        });
    } catch (error) {
        try {
            await client.query("ROLLBACK");
        } catch {}

        if (
            error.message?.startsWith("Add at least") ||
            error.message?.startsWith("Enter an item") ||
            error.message?.startsWith("Invalid values") ||
            error.message?.startsWith("Product ")
        ) {
            return NextResponse.json(
                { success: false, message: error.message },
                { status: 400 }
            );
        }

        return errorResponse(error, "Could not update the Sales Order.");
    } finally {
        client.release();
    }
}

// DELETE /api/sales-orders/:id
export async function DELETE(request, { params }) {
    try {
        const context = await getContext();

        if (!(await hasPermission(context.roleId, "sales_orders", "delete"))) {
            throw new Error("FORBIDDEN");
        }

        const { id } = await params;
        const orderId = Number(id);

        if (!Number.isSafeInteger(orderId) || orderId <= 0) {
            return NextResponse.json(
                { success: false, message: "Invalid Sales Order ID." },
                { status: 400 }
            );
        }

        const result = await pool.query(
            `
            DELETE FROM sales_orders
            WHERE order_id = $1
              AND company_id = $2
              AND COALESCE(LOWER(document_status), '') = 'pending delivery challan'
            RETURNING order_id
            `,
            [orderId, context.companyId]
        );

        if (!result.rows.length) {
            return NextResponse.json(
                {
                    success: false,
                    message: "Order not found or cannot be deleted because its document status has progressed.",
                },
                { status: 409 }
            );
        }

        return NextResponse.json({
            success: true,
            message: "Sales Order deleted successfully.",
        });
    } catch (error) {
        return errorResponse(error, "Could not delete the Sales Order.");
    }
}