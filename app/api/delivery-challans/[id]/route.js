
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

function errorResponse(error) {
    console.error("DELIVERY CHALLAN DETAIL API ERROR:", error);

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
        { success: false, message: "Could not process the Delivery Challan." },
        { status: 500 }
    );
}

async function getId(params) {
    const { id } = await params;
    const value = Number(id);

    if (!Number.isSafeInteger(value) || value <= 0) {
        throw new Error("INVALID_ID");
    }

    return value;
}

// GET /api/delivery-challans/:id
export async function GET(request, { params }) {
    try {
        const context = await getContext();

        if (!(await hasPermission(context.roleId, "delivery_challans", "view"))) {
            throw new Error("FORBIDDEN");
        }

        const id = await getId(params);

        const challanResult = await pool.query(
            `
            SELECT
                dc.*,
                c.customer_name,
                c.customer_code,
                c.phone AS customer_phone,
                c.email AS customer_email,
                c.address AS customer_address,
                w.warehouse_name,
                w.location AS warehouse_location,
                co.company_name,
                co.address AS company_address,
                co.phone AS company_phone,
                so.order_number AS source_order_number
            FROM delivery_challans dc
            LEFT JOIN customers c ON c.customer_id = dc.customer_id
            LEFT JOIN warehouses w ON w.warehouse_id = dc.warehouse_id
            LEFT JOIN companies co ON co.company_id = dc.company_id
            LEFT JOIN sales_orders so ON so.order_id = dc.source_order_id
            WHERE dc.delivery_challan_id = $1
              AND dc.company_id = $2
            `,
            [id, context.companyId]
        );

        if (!challanResult.rows.length) {
            return NextResponse.json(
                { success: false, message: "Delivery Challan not found." },
                { status: 404 }
            );
        }

        const itemsResult = await pool.query(
            `
            SELECT *
            FROM delivery_challan_items
            WHERE delivery_challan_id = $1
            ORDER BY line_number, delivery_challan_item_id
            `,
            [id]
        );

        return NextResponse.json({
            success: true,
            challan: challanResult.rows[0],
            items: itemsResult.rows,
            permissions: {
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
        if (error.message === "INVALID_ID") {
            return NextResponse.json(
                { success: false, message: "Invalid Delivery Challan ID." },
                { status: 400 }
            );
        }

        return errorResponse(error);
    }
}

// PUT /api/delivery-challans/:id
// Only draft challans can be edited.
export async function PUT(request, { params }) {
    const client = await pool.connect();

    try {
        const context = await getContext();

        if (!(await hasPermission(context.roleId, "delivery_challans", "update"))) {
            throw new Error("FORBIDDEN");
        }

        const id = await getId(params);
        const body = await request.json();

        const date = String(body.transaction_date || "");
        const customerId = Number(body.customer_id);
        const warehouseId = Number(body.warehouse_id);
        const status = String(body.status || "DRAFT").toUpperCase();

        if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
            return NextResponse.json(
                { success: false, message: "Enter a valid transaction date." },
                { status: 400 }
            );
        }

        if (
            !Number.isSafeInteger(customerId) ||
            customerId <= 0 ||
            !Number.isSafeInteger(warehouseId) ||
            warehouseId <= 0
        ) {
            return NextResponse.json(
                { success: false, message: "Select a valid customer and location." },
                { status: 400 }
            );
        }

        if (status !== "DRAFT") {
            return NextResponse.json(
                {
                    success: false,
                    message: "Save the challan as DRAFT while editing.",
                },
                { status: 400 }
            );
        }

        if (!Array.isArray(body.items) || body.items.length === 0) {
            return NextResponse.json(
                { success: false, message: "Add at least one transaction line." },
                { status: 400 }
            );
        }

        const items = body.items.map((item, index) => {
            const name = String(item.item_name || "").trim();
            const quantity = Number(item.quantity);
            const price = Number(item.unit_price || 0);
            const taxRate = Number(item.tax_rate || 0);

            if (
                !name ||
                !Number.isFinite(quantity) ||
                quantity <= 0 ||
                !Number.isFinite(price) ||
                price < 0 ||
                !Number.isFinite(taxRate) ||
                taxRate < 0
            ) {
                throw new Error(`Invalid transaction line ${index + 1}.`);
            }

            const amount = Math.round(quantity * price * 100) / 100;
            const taxAmount = Math.round(amount * taxRate) / 100;
            const grossAmount = Math.round((amount + taxAmount) * 100) / 100;

            return {
                source_order_item_id: item.source_order_item_id || null,
                product_id: item.product_id || null,
                item_name: name,
                item_description: item.item_description || null,
                item_balance: Number(item.item_balance || 0),
                uom: item.uom || null,
                quantity,
                unit_price: price,
                amount,
                tax_code: item.tax_code || null,
                tax_rate: taxRate,
                tax_amount: taxAmount,
                gross_amount: grossAmount,
                memo: item.memo || null,
                line_number: index + 1,
            };
        });

        const totalAmount = items.reduce((sum, item) => sum + item.amount, 0);
        const taxAmount = items.reduce((sum, item) => sum + item.tax_amount, 0);
        const grossAmount = Math.round((totalAmount + taxAmount) * 100) / 100;

        await client.query("BEGIN");

        const existingResult = await client.query(
            `
            SELECT *
            FROM delivery_challans
            WHERE delivery_challan_id = $1
              AND company_id = $2
            FOR UPDATE
            `,
            [id, context.companyId]
        );

        if (!existingResult.rows.length) {
            await client.query("ROLLBACK");
            return NextResponse.json(
                { success: false, message: "Delivery Challan not found." },
                { status: 404 }
            );
        }

        const existing = existingResult.rows[0];

        if (existing.status !== "DRAFT") {
            await client.query("ROLLBACK");
            return NextResponse.json(
                {
                    success: false,
                    message: "Only draft Delivery Challans can be edited.",
                },
                { status: 409 }
            );
        }

        if (existing.source_order_id) {
            await client.query("ROLLBACK");
            return NextResponse.json(
                {
                    success: false,
                    message:
                        "This challan was created from a Sales Order. To preserve delivery quantities, edit it through a dedicated Sales Order delivery workflow.",
                },
                { status: 409 }
            );
        }

        const customer = await client.query(
            "SELECT customer_id FROM customers WHERE customer_id = $1 AND is_active = TRUE",
            [customerId]
        );

        const warehouse = await client.query(
            "SELECT warehouse_id FROM warehouses WHERE warehouse_id = $1 AND is_active = TRUE",
            [warehouseId]
        );

        if (!customer.rows.length || !warehouse.rows.length) {
            await client.query("ROLLBACK");
            return NextResponse.json(
                { success: false, message: "Select an active customer and location." },
                { status: 400 }
            );
        }

        await client.query(
            `
            UPDATE delivery_challans
            SET
                transaction_date = $1,
                customer_id = $2,
                warehouse_id = $3,
                status = 'DRAFT',
                subsidiary_name = $4,
                department = $5,
                challan_class = $6,
                driver_name = $7,
                driver_mobile_no = $8,
                vehicle_no = $9,
                project = $10,
                reference_no = $11,
                memo = $12,
                currency = $13,
                exchange_rate = $14,
                total_amount = $15,
                tax_amount = $16,
                gross_amount = $17,
                updated_by = $18,
                updated_at = CURRENT_TIMESTAMP
            WHERE delivery_challan_id = $19
              AND company_id = $20
            `,
            [
                date,
                customerId,
                warehouseId,
                body.subsidiary_name || null,
                body.department || null,
                body.challan_class || "Outbound Shipment",
                body.driver_name || null,
                body.driver_mobile_no || null,
                body.vehicle_no || null,
                body.project || null,
                body.reference_no || null,
                body.memo || null,
                String(body.currency || existing.currency || "PKR").toUpperCase(),
                Number(body.exchange_rate || 1),
                Math.round(totalAmount * 100) / 100,
                Math.round(taxAmount * 100) / 100,
                grossAmount,
                context.userId,
                id,
                context.companyId,
            ]
        );

        await client.query(
            "DELETE FROM delivery_challan_items WHERE delivery_challan_id = $1",
            [id]
        );

        for (const item of items) {
            await client.query(
                `
                INSERT INTO delivery_challan_items (
                    delivery_challan_id, source_order_item_id, product_id,
                    item_name, item_description, item_balance, uom,
                    quantity, unit_price, amount, tax_code, tax_rate,
                    tax_amount, gross_amount, memo, line_number
                )
                VALUES (
                    $1, $2, $3, $4, $5, $6, $7, $8, $9,
                    $10, $11, $12, $13, $14, $15, $16
                )
                `,
                [
                    id,
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

        await client.query("COMMIT");

        return NextResponse.json({
            success: true,
            message: "Draft Delivery Challan updated successfully.",
        });
    } catch (error) {
        try {
            await client.query("ROLLBACK");
        } catch {}

        if (error.message === "UNAUTHORIZED" || error.message === "FORBIDDEN") {
            return errorResponse(error);
        }

        if (error.message?.startsWith("Invalid transaction line")) {
            return NextResponse.json(
                { success: false, message: error.message },
                { status: 400 }
            );
        }

        return errorResponse(error, "Could not update the Delivery Challan.");
    } finally {
        client.release();
    }
}

// DELETE /api/delivery-challans/:id
export async function DELETE(request, { params }) {
    try {
        const context = await getContext();

        if (!(await hasPermission(context.roleId, "delivery_challans", "delete"))) {
            throw new Error("FORBIDDEN");
        }

        const id = await getId(params);

        const result = await pool.query(
            `
            DELETE FROM delivery_challans
            WHERE delivery_challan_id = $1
              AND company_id = $2
              AND status = 'DRAFT'
              AND source_order_id IS NULL
            RETURNING delivery_challan_id
            `,
            [id, context.companyId]
        );

        if (!result.rows.length) {
            return NextResponse.json(
                {
                    success: false,
                    message:
                        "Only draft, manually created challans can be deleted.",
                },
                { status: 409 }
            );
        }

        return NextResponse.json({
            success: true,
            message: "Draft Delivery Challan deleted successfully.",
        });
    } catch (error) {
        if (error.message === "INVALID_ID") {
            return NextResponse.json(
                { success: false, message: "Invalid Delivery Challan ID." },
                { status: 400 }
            );
        }

        return errorResponse(error);
    }
}
