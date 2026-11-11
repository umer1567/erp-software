import { NextResponse } from "next/server";
import pool from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { hasPermission } from "@/lib/permissions";

export const dynamic = "force-dynamic";

function errorResponse(error, fallback = "Unable to process the request.") {
    console.error("SALES ORDERS API ERROR:", error);

    if (error.message === "UNAUTHORIZED") {
        return NextResponse.json(
            { success: false, message: "Please sign in to continue." },
            { status: 401 }
        );
    }

    if (error.message === "FORBIDDEN") {
        return NextResponse.json(
            { success: false, message: "You do not have permission to perform this action." },
            { status: 403 }
        );
    }

    return NextResponse.json(
        { success: false, message: fallback },
        { status: 500 }
    );
}

async function getOrderContext() {
    const user = await getCurrentUser();

    if (!user?.userId || !user?.companyId) {
        throw new Error("UNAUTHORIZED");
    }

    const membership = await pool.query(
        `
        SELECT
            uc.company_id,
            uc.role_id,
            r.role_name
        FROM user_companies uc
        JOIN users u ON u.user_id = uc.user_id
        JOIN companies c ON c.company_id = uc.company_id
        JOIN roles r ON r.role_id = uc.role_id
        WHERE uc.user_id = $1
          AND uc.company_id = $2
          AND u.is_active = TRUE
          AND c.is_active = TRUE
        LIMIT 1
        `,
        [user.userId, user.companyId]
    );

    if (!membership.rows.length) {
        throw new Error("UNAUTHORIZED");
    }

    return {
        userId: Number(user.userId),
        companyId: Number(membership.rows[0].company_id),
        roleId: Number(membership.rows[0].role_id),
        roleName: membership.rows[0].role_name,
    };
}

async function checkPermission(context, action) {
    const allowed = await hasPermission(
        context.roleId,
        "sales_orders",
        action
    );

    if (!allowed) {
        throw new Error("FORBIDDEN");
    }
}

function toNumber(value, fallback = 0) {
    if (value === null || value === undefined || value === "") {
        return fallback;
    }

    const number = Number(value);
    return Number.isFinite(number) ? number : NaN;
}

function calculateItems(items) {
    if (!Array.isArray(items) || items.length === 0) {
        throw new Error("Add at least one transaction line.");
    }

    let subtotal = 0;
    let taxTotal = 0;

    const normalizedItems = items.map((item, index) => {
        const quantity = toNumber(item.quantity);
        const retailPrice = toNumber(item.retail_price);
        const discountPercent = toNumber(item.discount_percent);
        const taxRate = toNumber(item.tax_rate);

        const productId =
            item.product_id === "" || item.product_id == null
                ? null
                : Number(item.product_id);

        const itemName =
            typeof item.item_name === "string"
                ? item.item_name.trim()
                : "";

        if (!itemName) {
            throw new Error(`Enter an item name for line ${index + 1}.`);
        }

        if (
            !Number.isFinite(quantity) ||
            quantity <= 0 ||
            !Number.isFinite(retailPrice) ||
            retailPrice < 0 ||
            !Number.isFinite(discountPercent) ||
            discountPercent < 0 ||
            discountPercent > 100 ||
            !Number.isFinite(taxRate) ||
            taxRate < 0
        ) {
            throw new Error(`Invalid quantity, price, discount, or tax on line ${index + 1}.`);
        }

        if (
            productId !== null &&
            (!Number.isSafeInteger(productId) || productId <= 0)
        ) {
            throw new Error(`Invalid product on line ${index + 1}.`);
        }

        const unitPrice = retailPrice * (1 - discountPercent / 100);
        const amount = Math.round(quantity * unitPrice * 100) / 100;
        const taxAmount = Math.round(amount * taxRate) / 100;
        const grossAmount =
            Math.round((amount + taxAmount) * 100) / 100;

        subtotal += amount;
        taxTotal += taxAmount;

        return {
            product_id: productId,
            item_name: itemName,
            item_description: item.item_description || null,
            item_balance: toNumber(item.item_balance),
            uom: item.uom || null,
            quantity,
            retail_price: retailPrice,
            discount_percent: discountPercent,
            unit_price: Math.round(unitPrice * 100) / 100,
            amount,
            tax_code: item.tax_code || null,
            tax_rate: taxRate,
            tax_amount: taxAmount,
            gross_amount: grossAmount,
            memo: item.memo || null,
            line_number: index + 1,
        };
    });

    subtotal = Math.round(subtotal * 100) / 100;
    taxTotal = Math.round(taxTotal * 100) / 100;

    return {
        items: normalizedItems,
        subtotal,
        taxAmount: taxTotal,
        grossAmount: Math.round((subtotal + taxTotal) * 100) / 100,
    };
}

// GET /api/sales-orders
export async function GET() {
    try {
        const context = await getOrderContext();
        await checkPermission(context, "view");

        const [ordersResult, customersResult, productsResult, warehousesResult, companyResult] =
            await Promise.all([
                pool.query(
                    `
                    SELECT
                        so.order_id,
                        so.order_number,
                        so.source_quotation_id,
                        so.transaction_date,
                        so.status,
                        so.document_status,
                        so.department,
                        so.project,
                        so.order_class,
                        so.sales_rep,
                        so.payment_term,
                        so.currency,
                        so.exchange_rate,
                        so.subtotal,
                        so.tax_amount,
                        so.gross_amount,
                        so.memo,
                        so.created_at,
                        so.updated_at,
                        c.customer_id,
                        c.customer_name,
                        c.customer_code,
                        c.credit_limit AS current_credit_limit,
                        w.warehouse_id,
                        w.warehouse_name,
                        q.quotation_number AS source_quotation_number
                    FROM sales_orders so
                    LEFT JOIN customers c
                        ON c.customer_id = so.customer_id
                    LEFT JOIN warehouses w
                        ON w.warehouse_id = so.warehouse_id
                    LEFT JOIN sales_quotations q
                        ON q.quotation_id = so.source_quotation_id
                    WHERE so.company_id = $1
                    ORDER BY so.transaction_date DESC, so.order_id DESC
                    `,
                    [context.companyId]
                ),
                pool.query(
                    `
                    SELECT customer_id, customer_code, customer_name,
                           phone, email, address, credit_limit, opening_balance
                    FROM customers
                    WHERE is_active = TRUE
                    ORDER BY customer_name
                    `
                ),
                pool.query(
                    `
                    SELECT product_id, sku, product_name, description,
                           unit, sales_unit, sale_price, minimum_stock,
                           barcode, is_active
                    FROM products
                    WHERE is_active = TRUE
                    ORDER BY product_name
                    `
                ),
                pool.query(
                    `
                    SELECT warehouse_id, warehouse_code, warehouse_name, location
                    FROM warehouses
                    WHERE is_active = TRUE
                    ORDER BY warehouse_name
                    `
                ),
                pool.query(
                    `
                    SELECT company_id, company_name, currency, address, phone, email, logo_url
                    FROM companies
                    WHERE company_id = $1
                    `,
                    [context.companyId]
                ),
            ]);

        return NextResponse.json({
            success: true,
            orders: ordersResult.rows,
            customers: customersResult.rows,
            products: productsResult.rows,
            warehouses: warehousesResult.rows,
            company: companyResult.rows[0] || null,
            permissions: {
                canView: true,
                canCreate: await hasPermission(context.roleId, "sales_orders", "create"),
                canUpdate: await hasPermission(context.roleId, "sales_orders", "update"),
                canDelete: await hasPermission(context.roleId, "sales_orders", "delete"),
            },
        });
    } catch (error) {
        return errorResponse(error, "Could not load Sales Orders.");
    }
}

// POST /api/sales-orders
export async function POST(request) {
    const client = await pool.connect();

    try {
        const context = await getOrderContext();
        await checkPermission(context, "create");

        const body = await request.json();
        const itemsResult = calculateItems(body.items);

        const customerId = body.customer_id ? Number(body.customer_id) : null;
        const warehouseId = body.warehouse_id ? Number(body.warehouse_id) : null;
        const sourceQuotationId = body.source_quotation_id
            ? Number(body.source_quotation_id)
            : null;

        if (!customerId || !Number.isSafeInteger(customerId) || customerId <= 0) {
            return NextResponse.json(
                { success: false, message: "Select a customer." },
                { status: 400 }
            );
        }

        if (!warehouseId || !Number.isSafeInteger(warehouseId) || warehouseId <= 0) {
            return NextResponse.json(
                { success: false, message: "Select a From Location." },
                { status: 400 }
            );
        }

        const transactionDate =
            /^\d{4}-\d{2}-\d{2}$/.test(body.transaction_date || "")
                ? body.transaction_date
                : null;

        if (!transactionDate) {
            return NextResponse.json(
                { success: false, message: "Enter a valid transaction date." },
                { status: 400 }
            );
        }

        const status = String(body.status || "APPROVED").toUpperCase();

        if (!["DRAFT", "APPROVED", "CANCELLED"].includes(status)) {
            return NextResponse.json(
                { success: false, message: "Invalid Sales Order status." },
                { status: 400 }
            );
        }

        await client.query("BEGIN");

        const customer = await client.query(
            `
            SELECT customer_id, credit_limit
            FROM customers
            WHERE customer_id = $1 AND is_active = TRUE
            `,
            [customerId]
        );

        if (!customer.rows.length) {
            await client.query("ROLLBACK");

            return NextResponse.json(
                { success: false, message: "The selected customer is unavailable." },
                { status: 400 }
            );
        }

        const warehouse = await client.query(
            `
            SELECT warehouse_id
            FROM warehouses
            WHERE warehouse_id = $1 AND is_active = TRUE
            `,
            [warehouseId]
        );

        if (!warehouse.rows.length) {
            await client.query("ROLLBACK");

            return NextResponse.json(
                { success: false, message: "The selected location is unavailable." },
                { status: 400 }
            );
        }

        const company = await client.query(
            `SELECT currency FROM companies WHERE company_id = $1`,
            [context.companyId]
        );

        const currency = String(
            body.currency || company.rows[0]?.currency || "PKR"
        ).trim().toUpperCase();

        const exchangeRate = toNumber(body.exchange_rate, 1);

        if (!Number.isFinite(exchangeRate) || exchangeRate <= 0) {
            await client.query("ROLLBACK");

            return NextResponse.json(
                { success: false, message: "Exchange rate must be greater than zero." },
                { status: 400 }
            );
        }

        if (sourceQuotationId !== null) {
            const quotation = await client.query(
                `
                SELECT quotation_id, status, company_id
                FROM sales_quotations
                WHERE quotation_id = $1
                FOR UPDATE
                `,
                [sourceQuotationId]
            );

            if (
                !quotation.rows.length ||
                Number(quotation.rows[0].company_id) !== context.companyId
            ) {
                await client.query("ROLLBACK");

                return NextResponse.json(
                    { success: false, message: "The source quotation was not found." },
                    { status: 404 }
                );
            }

            if (String(quotation.rows[0].status).toUpperCase() !== "APPROVED") {
                await client.query("ROLLBACK");

                return NextResponse.json(
                    { success: false, message: "Only an approved quotation can be converted into a Sales Order." },
                    { status: 400 }
                );
            }
        }

        const sequenceResult = await client.query(
            `SELECT nextval(pg_get_serial_sequence('sales_orders', 'order_id')) AS order_id`
        );

        const orderId = Number(sequenceResult.rows[0].order_id);
        const orderNumber = `SO-${String(orderId).padStart(6, "0")}`;

        const insertResult = await client.query(
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
                $1, $2, $3, $4, $5, $6, $7, $8,
                'Pending Delivery Challan',
                $9, $10, $11, $12, $13, $14, $15,
                $16, $17, $18, $19, $20, $21, $22, $22
            )
            RETURNING *
            `,
            [
                orderId,
                context.companyId,
                orderNumber,
                sourceQuotationId,
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
                currency,
                exchangeRate,
                itemsResult.subtotal,
                itemsResult.taxAmount,
                itemsResult.grossAmount,
                Number(customer.rows[0].credit_limit || 0),
                context.userId,
            ]
        );

        for (const item of itemsResult.items) {
            if (item.product_id !== null) {
                const product = await client.query(
                    `SELECT product_id FROM products WHERE product_id = $1 AND is_active = TRUE`,
                    [item.product_id]
                );

                if (!product.rows.length) {
                    throw new Error(`Product "${item.item_name}" is unavailable.`);
                }
            }

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

        return NextResponse.json(
            {
                success: true,
                message: "Sales Order saved successfully.",
                order: insertResult.rows[0],
            },
            { status: 201 }
        );
    } catch (error) {
        try {
            await client.query("ROLLBACK");
        } catch {}

        if (error.code === "23505") {
            return NextResponse.json(
                { success: false, message: "This quotation has already been converted, or the order number already exists." },
                { status: 409 }
            );
        }

        if (error.message === "FORBIDDEN" || error.message === "UNAUTHORIZED") {
            return errorResponse(error);
        }

        if (
            error.message?.startsWith("Add at least") ||
            error.message?.startsWith("Enter an item") ||
            error.message?.startsWith("Invalid quantity") ||
            error.message?.startsWith("Invalid product") ||
            error.message?.startsWith("Product ")
        ) {
            return NextResponse.json(
                { success: false, message: error.message },
                { status: 400 }
            );
        }

        return errorResponse(error, "Could not save the Sales Order.");
    } finally {
        client.release();
    }
}