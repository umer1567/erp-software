
import { NextResponse } from "next/server";
import pool from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { hasPermission } from "@/lib/permissions";

export const dynamic = "force-dynamic";

function errorResponse(error, fallback = "Unable to process Delivery Challans.") {
    console.error("DELIVERY CHALLANS API ERROR:", error);

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

async function checkPermission(context, action) {
    if (!(await hasPermission(context.roleId, "delivery_challans", action))) {
        throw new Error("FORBIDDEN");
    }
}

function numberValue(value, fallback = 0) {
    if (value === "" || value === null || value === undefined) {
        return fallback;
    }

    const result = Number(value);
    return Number.isFinite(result) ? result : NaN;
}

function calculateItems(items) {
    if (!Array.isArray(items) || items.length === 0) {
        throw new Error("Add at least one transaction line.");
    }

    let totalAmount = 0;
    let totalTax = 0;

    const normalizedItems = items.map((item, index) => {
        const quantity = numberValue(item.quantity);
        const unitPrice = numberValue(item.unit_price);
        const taxRate = numberValue(item.tax_rate);

        const productId =
            item.product_id === "" || item.product_id == null
                ? null
                : Number(item.product_id);

        const sourceOrderItemId =
            item.source_order_item_id === "" ||
            item.source_order_item_id == null
                ? null
                : Number(item.source_order_item_id);

        const itemName = String(item.item_name || "").trim();

        if (!itemName) {
            throw new Error(`Enter an item name on line ${index + 1}.`);
        }

        if (
            !Number.isFinite(quantity) ||
            quantity <= 0 ||
            !Number.isFinite(unitPrice) ||
            unitPrice < 0 ||
            !Number.isFinite(taxRate) ||
            taxRate < 0
        ) {
            throw new Error(
                `Enter a valid quantity, unit price, and tax rate on line ${index + 1}.`
            );
        }

        if (
            productId !== null &&
            (!Number.isSafeInteger(productId) || productId <= 0)
        ) {
            throw new Error(`Invalid product on line ${index + 1}.`);
        }

        if (
            sourceOrderItemId !== null &&
            (!Number.isSafeInteger(sourceOrderItemId) ||
                sourceOrderItemId <= 0)
        ) {
            throw new Error(`Invalid Sales Order line on line ${index + 1}.`);
        }

        const amount = Math.round(quantity * unitPrice * 100) / 100;
        const taxAmount = Math.round((amount * taxRate) / 100 * 100) / 100;
        const grossAmount = Math.round((amount + taxAmount) * 100) / 100;

        totalAmount += amount;
        totalTax += taxAmount;

        return {
            source_order_item_id: sourceOrderItemId,
            product_id: productId,
            item_name: itemName,
            item_description: item.item_description || null,
            item_balance: numberValue(item.item_balance),
            uom: item.uom || null,
            quantity,
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

    totalAmount = Math.round(totalAmount * 100) / 100;
    totalTax = Math.round(totalTax * 100) / 100;

    return {
        items: normalizedItems,
        totalAmount,
        taxAmount: totalTax,
        grossAmount: Math.round((totalAmount + totalTax) * 100) / 100,
    };
}

// GET /api/delivery-challans
export async function GET() {
    try {
        const context = await getContext();
        await checkPermission(context, "view");

        const [challansResult, customersResult, warehousesResult, companyResult] =
            await Promise.all([
                pool.query(
                    `
                    SELECT
                        dc.delivery_challan_id,
                        dc.transaction_number,
                        dc.transaction_date,
                        dc.customer_id,
                        dc.warehouse_id,
                        dc.source_order_id,
                        dc.status,
                        dc.document_status,
                        dc.subsidiary_name,
                        dc.department,
                        dc.challan_class,
                        dc.driver_name,
                        dc.driver_mobile_no,
                        dc.vehicle_no,
                        dc.project,
                        dc.reference_no,
                        dc.memo,
                        dc.currency,
                        dc.exchange_rate,
                        dc.total_amount,
                        dc.tax_amount,
                        dc.gross_amount,
                        dc.created_at,
                        dc.updated_at,
                        c.customer_name,
                        c.customer_code,
                        w.warehouse_name,
                        so.order_number AS source_order_number
                    FROM delivery_challans dc
                    LEFT JOIN customers c
                        ON c.customer_id = dc.customer_id
                    LEFT JOIN warehouses w
                        ON w.warehouse_id = dc.warehouse_id
                    LEFT JOIN sales_orders so
                        ON so.order_id = dc.source_order_id
                    WHERE dc.company_id = $1
                    ORDER BY dc.transaction_date DESC,
                             dc.delivery_challan_id DESC
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
                    SELECT warehouse_id, warehouse_code, warehouse_name, location
                    FROM warehouses
                    WHERE is_active = TRUE
                    ORDER BY warehouse_name
                    `
                ),
                pool.query(
                    `
                    SELECT company_id, company_name, currency, address,
                           phone, email, logo_url
                    FROM companies
                    WHERE company_id = $1
                    `,
                    [context.companyId]
                ),
            ]);

        return NextResponse.json({
            success: true,
            challans: challansResult.rows,
            customers: customersResult.rows,
            warehouses: warehousesResult.rows,
            company: companyResult.rows[0] || null,
            permissions: {
                canView: true,
                canCreate: await hasPermission(
                    context.roleId,
                    "delivery_challans",
                    "create"
                ),
                canUpdate: await hasPermission(
                    context.roleId,
                    "delivery_challans",
                    "update"
                ),
                canDelete: await hasPermission(
                    context.roleId,
                    "delivery_challans",
                    "delete"
                ),
            },
        });
    } catch (error) {
        return errorResponse(error, "Could not load Delivery Challans.");
    }
}

// POST /api/delivery-challans
export async function POST(request) {
    const client = await pool.connect();

    try {
        const context = await getContext();
        await checkPermission(context, "create");

        const body = await request.json();
        const calculated = calculateItems(body.items);

        const customerId = Number(body.customer_id);
        const warehouseId = Number(body.warehouse_id);
        const sourceOrderId =
            body.source_order_id === "" ||
            body.source_order_id == null
                ? null
                : Number(body.source_order_id);

        const transactionDate = String(body.transaction_date || "");
        const status = String(body.status || "APPROVED").toUpperCase();

        if (!Number.isSafeInteger(customerId) || customerId <= 0) {
            return NextResponse.json(
                { success: false, message: "Select a customer." },
                { status: 400 }
            );
        }

        if (!Number.isSafeInteger(warehouseId) || warehouseId <= 0) {
            return NextResponse.json(
                { success: false, message: "Select a location." },
                { status: 400 }
            );
        }

        if (!/^\d{4}-\d{2}-\d{2}$/.test(transactionDate)) {
            return NextResponse.json(
                { success: false, message: "Enter a valid transaction date." },
                { status: 400 }
            );
        }

        if (!["DRAFT", "APPROVED"].includes(status)) {
            return NextResponse.json(
                { success: false, message: "Invalid Delivery Challan status." },
                { status: 400 }
            );
        }

        if (
            sourceOrderId !== null &&
            (!Number.isSafeInteger(sourceOrderId) || sourceOrderId <= 0)
        ) {
            return NextResponse.json(
                { success: false, message: "Invalid source Sales Order." },
                { status: 400 }
            );
        }

        await client.query("BEGIN");

        const customerResult = await client.query(
            `
            SELECT customer_id
            FROM customers
            WHERE customer_id = $1 AND is_active = TRUE
            `,
            [customerId]
        );

        const warehouseResult = await client.query(
            `
            SELECT warehouse_id
            FROM warehouses
            WHERE warehouse_id = $1 AND is_active = TRUE
            `,
            [warehouseId]
        );

        if (!customerResult.rows.length || !warehouseResult.rows.length) {
            await client.query("ROLLBACK");

            return NextResponse.json(
                {
                    success: false,
                    message: "Select a valid active customer and location.",
                },
                { status: 400 }
            );
        }

        let sourceOrder = null;

        if (sourceOrderId !== null) {
            // Lock the order header so two concurrent requests cannot
            // deliver the same remaining quantity.
            const orderResult = await client.query(
                `
                SELECT order_id, customer_id, warehouse_id, order_number,
                       status, document_status
                FROM sales_orders
                WHERE order_id = $1 AND company_id = $2
                FOR UPDATE
                `,
                [sourceOrderId, context.companyId]
            );

            if (!orderResult.rows.length) {
                await client.query("ROLLBACK");

                return NextResponse.json(
                    { success: false, message: "Source Sales Order not found." },
                    { status: 404 }
                );
            }

            sourceOrder = orderResult.rows[0];

            if (String(sourceOrder.status).toUpperCase() !== "APPROVED") {
                await client.query("ROLLBACK");

                return NextResponse.json(
                    {
                        success: false,
                        message: "Only an approved Sales Order can be delivered.",
                    },
                    { status: 400 }
                );
            }

            if (
                Number(sourceOrder.customer_id) !== customerId ||
                Number(sourceOrder.warehouse_id) !== warehouseId
            ) {
                await client.query("ROLLBACK");

                return NextResponse.json(
                    {
                        success: false,
                        message:
                            "The customer and location must match the source Sales Order.",
                    },
                    { status: 400 }
                );
            }

            if (
                String(sourceOrder.document_status || "").toLowerCase() ===
                "fully invoiced"
            ) {
                await client.query("ROLLBACK");

                return NextResponse.json(
                    {
                        success: false,
                        message: "This Sales Order has already been fully invoiced.",
                    },
                    { status: 409 }
                );
            }

            for (const item of calculated.items) {
                if (!item.source_order_item_id) {
                    await client.query("ROLLBACK");

                    return NextResponse.json(
                        {
                            success: false,
                            message:
                                "Every line from a Sales Order must reference its source order line.",
                        },
                        { status: 400 }
                    );
                }

                const orderLineResult = await client.query(
                    `
                    SELECT order_item_id, order_id, product_id, item_name,
                           item_description, item_balance, uom, quantity
                    FROM sales_order_items
                    WHERE order_item_id = $1 AND order_id = $2
                    FOR UPDATE
                    `,
                    [item.source_order_item_id, sourceOrderId]
                );

                if (!orderLineResult.rows.length) {
                    await client.query("ROLLBACK");

                    return NextResponse.json(
                        {
                            success: false,
                            message: `Sales Order line for "${item.item_name}" was not found.`,
                        },
                        { status: 400 }
                    );
                }

                const orderLine = orderLineResult.rows[0];

                if (
                    orderLine.product_id != null &&
                    item.product_id != null &&
                    Number(orderLine.product_id) !== Number(item.product_id)
                ) {
                    await client.query("ROLLBACK");

                    return NextResponse.json(
                        {
                            success: false,
                            message: `Product mismatch on line "${item.item_name}".`,
                        },
                        { status: 400 }
                    );
                }

                const deliveredResult = await client.query(
                    `
                    SELECT COALESCE(SUM(dci.quantity), 0) AS delivered_quantity
                    FROM delivery_challan_items dci
                    JOIN delivery_challans dc
                      ON dc.delivery_challan_id = dci.delivery_challan_id
                    WHERE dci.source_order_item_id = $1
                      AND dc.company_id = $2
                      AND dc.status <> 'VOID'
                    `,
                    [item.source_order_item_id, context.companyId]
                );

                const orderedQuantity = Number(orderLine.quantity || 0);
                const previouslyDelivered = Number(
                    deliveredResult.rows[0].delivered_quantity || 0
                );
                const pendingQuantity = Math.max(
                    0,
                    orderedQuantity - previouslyDelivered
                );

                if (item.quantity > pendingQuantity + 0.000001) {
                    await client.query("ROLLBACK");

                    return NextResponse.json(
                        {
                            success: false,
                            message:
                                `"${orderLine.item_name}" has only ${pendingQuantity} ` +
                                "remaining quantity available for delivery.",
                        },
                        { status: 409 }
                    );
                }

                // Use the authoritative Sales Order line values for
                // product identity and descriptive fields.
                item.product_id = orderLine.product_id;
                item.item_name = orderLine.item_name;
                item.item_description = orderLine.item_description;
                item.item_balance = Number(orderLine.item_balance || 0);
                item.uom = orderLine.uom;
            }
        } else if (
            calculated.items.some((item) => item.source_order_item_id !== null)
        ) {
            await client.query("ROLLBACK");

            return NextResponse.json(
                {
                    success: false,
                    message:
                        "Source order lines can only be used when a Sales Order is selected.",
                },
                { status: 400 }
            );
        }

        const companyResult = await client.query(
            `SELECT currency, company_name FROM companies WHERE company_id = $1`,
            [context.companyId]
        );

        const currency = String(
            body.currency || companyResult.rows[0]?.currency || "PKR"
        )
            .trim()
            .toUpperCase();

        const exchangeRate = numberValue(body.exchange_rate, 1);

        if (!Number.isFinite(exchangeRate) || exchangeRate <= 0) {
            await client.query("ROLLBACK");

            return NextResponse.json(
                {
                    success: false,
                    message: "Exchange rate must be greater than zero.",
                },
                { status: 400 }
            );
        }

        const sequenceResult = await client.query(
            `
            SELECT nextval(
                pg_get_serial_sequence('delivery_challans', 'delivery_challan_id')
            ) AS delivery_challan_id
            `
        );

        const challanId = Number(
            sequenceResult.rows[0].delivery_challan_id
        );
        const transactionNumber = `DC-${String(challanId).padStart(6, "0")}`;

        const insertResult = await client.query(
            `
            INSERT INTO delivery_challans (
                delivery_challan_id,
                company_id,
                transaction_number,
                transaction_date,
                customer_id,
                warehouse_id,
                source_order_id,
                status,
                document_status,
                subsidiary_name,
                department,
                challan_class,
                driver_name,
                driver_mobile_no,
                vehicle_no,
                project,
                reference_no,
                memo,
                currency,
                exchange_rate,
                total_amount,
                tax_amount,
                gross_amount,
                created_by,
                updated_by
            )
            VALUES (
                $1, $2, $3, $4, $5, $6, $7, $8,
                'Pending Invoice',
                $9, $10, $11, $12, $13, $14, $15,
                $16, $17, $18, $19, $20, $21, $22, $23, $23
            )
            RETURNING *
            `,
            [
                challanId,
                context.companyId,
                transactionNumber,
                transactionDate,
                customerId,
                warehouseId,
                sourceOrderId,
                status,
                body.subsidiary_name ||
                    companyResult.rows[0]?.company_name ||
                    null,
                body.department || null,
                body.challan_class || "Outbound Shipment",
                body.driver_name || null,
                body.driver_mobile_no || null,
                body.vehicle_no || null,
                body.project || null,
                body.reference_no || null,
                body.memo || null,
                currency,
                exchangeRate,
                calculated.totalAmount,
                calculated.taxAmount,
                calculated.grossAmount,
                context.userId,
            ]
        );

        for (const item of calculated.items) {
            await client.query(
                `
                INSERT INTO delivery_challan_items (
                    delivery_challan_id,
                    source_order_item_id,
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
                    $1, $2, $3, $4, $5, $6, $7, $8, $9,
                    $10, $11, $12, $13, $14, $15, $16
                )
                `,
                [
                    challanId,
                    item.source_order_item_id,
                    item.product_id,
                    item.item_name,
                    item.item_description,
                    item.item_balance,
                    item.uom,
                    item.quantity,
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

        if (sourceOrderId !== null) {
            const pendingResult = await client.query(
                `
                SELECT COUNT(*) AS pending_lines
                FROM sales_order_items soi
                WHERE soi.order_id = $1
                  AND soi.quantity > (
                      SELECT COALESCE(SUM(dci.quantity), 0)
                      FROM delivery_challan_items dci
                      JOIN delivery_challans dc
                        ON dc.delivery_challan_id = dci.delivery_challan_id
                      WHERE dci.source_order_item_id = soi.order_item_id
                        AND dc.company_id = $2
                        AND dc.status <> 'VOID'
                  )
                `,
                [sourceOrderId, context.companyId]
            );

            const pendingLines = Number(pendingResult.rows[0].pending_lines || 0);

            await client.query(
                `
                UPDATE sales_orders
                SET document_status = $1,
                    updated_by = $2,
                    updated_at = CURRENT_TIMESTAMP
                WHERE order_id = $3 AND company_id = $4
                `,
                [
                    pendingLines === 0
                        ? "Fully Delivered"
                        : "Partially Delivered",
                    context.userId,
                    sourceOrderId,
                    context.companyId,
                ]
            );
        }

        await client.query("COMMIT");

        return NextResponse.json(
            {
                success: true,
                message: "Delivery Challan saved successfully.",
                challan: insertResult.rows[0],
            },
            { status: 201 }
        );
    } catch (error) {
        try {
            await client.query("ROLLBACK");
        } catch {}

        if (error.message === "UNAUTHORIZED" || error.message === "FORBIDDEN") {
            return errorResponse(error);
        }

        if (
            error.message?.startsWith("Add at least") ||
            error.message?.startsWith("Enter an item") ||
            error.message?.startsWith("Enter a valid") ||
            error.message?.startsWith("Invalid") ||
            error.message?.startsWith("Every line") ||
            error.message?.startsWith("Source order") ||
            error.message?.startsWith("Product mismatch")
        ) {
            return NextResponse.json(
                { success: false, message: error.message },
                { status: 400 }
            );
        }

        if (
            error.message?.includes("remaining quantity") ||
            error.message?.includes("Sales Order")
        ) {
            return NextResponse.json(
                { success: false, message: error.message },
                { status: 409 }
            );
        }

        return errorResponse(error, "Could not save the Delivery Challan.");
    } finally {
        client.release();
    }
}
