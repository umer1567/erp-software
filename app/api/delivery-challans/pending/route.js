
import { NextResponse } from "next/server";
import pool from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { hasPermission } from "@/lib/permissions";

export const dynamic = "force-dynamic";

export async function GET(request) {
    try {
        const user = await getCurrentUser();

        if (!user?.userId || !user?.companyId) {
            return NextResponse.json(
                { success: false, message: "Please sign in to continue." },
                { status: 401 }
            );
        }

        const membership = await pool.query(
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
                { success: false, message: "Company access could not be verified." },
                { status: 401 }
            );
        }

        const companyId = Number(membership.rows[0].company_id);
        const roleId = Number(membership.rows[0].role_id);

        if (!(await hasPermission(roleId, "delivery_challans", "view"))) {
            return NextResponse.json(
                { success: false, message: "You do not have permission to view pending Delivery Challans." },
                { status: 403 }
            );
        }

        const { searchParams } = new URL(request.url);
        const type = String(searchParams.get("type") || "SALES_ORDER").toUpperCase();
        const entity = String(searchParams.get("entity") || "").trim();
        const transactionNumber = String(
            searchParams.get("transactionNumber") || ""
        ).trim();
        const itemSearch = String(searchParams.get("items") || "").trim();

        if (!["SALES_ORDER", "ALL"].includes(type)) {
            return NextResponse.json(
                { success: false, message: "Unsupported pending transaction type." },
                { status: 400 }
            );
        }

        const result = await pool.query(
            `
            SELECT
                soi.order_item_id,
                so.order_id,
                so.order_number,
                so.transaction_date,
                so.customer_id,
                c.customer_name,
                so.warehouse_id,
                w.warehouse_name,
                soi.product_id,
                soi.item_name,
                soi.item_description,
                soi.uom,
                soi.item_balance,
                soi.quantity AS line_quantity,
                soi.retail_price,
                soi.unit_price,
                soi.tax_code,
                soi.tax_rate,
                soi.memo AS line_memo,
                COALESCE(delivered.delivered_quantity, 0) AS delivered_quantity,
                GREATEST(
                    soi.quantity - COALESCE(delivered.delivered_quantity, 0),
                    0
                ) AS pending_quantity
            FROM sales_orders so
            JOIN sales_order_items soi
              ON soi.order_id = so.order_id
            LEFT JOIN customers c
              ON c.customer_id = so.customer_id
            LEFT JOIN warehouses w
              ON w.warehouse_id = so.warehouse_id
            LEFT JOIN LATERAL (
                SELECT SUM(dci.quantity) AS delivered_quantity
                FROM delivery_challan_items dci
                JOIN delivery_challans dc
                  ON dc.delivery_challan_id = dci.delivery_challan_id
                WHERE dci.source_order_item_id = soi.order_item_id
                  AND dc.company_id = so.company_id
                  AND dc.status <> 'VOID'
            ) delivered ON TRUE
            WHERE so.company_id = $1
              AND UPPER(so.status) = 'APPROVED'
              AND LOWER(COALESCE(so.document_status, '')) NOT IN (
                  'fully invoiced',
                  'cancelled'
              )
              AND soi.quantity > COALESCE(delivered.delivered_quantity, 0)
              AND (
                  $2 = ''
                  OR c.customer_name ILIKE '%' || $2 || '%'
                  OR c.customer_code ILIKE '%' || $2 || '%'
              )
              AND (
                  $3 = ''
                  OR so.order_number ILIKE '%' || $3 || '%'
              )
              AND (
                  $4 = ''
                  OR soi.item_name ILIKE '%' || $4 || '%'
                  OR COALESCE(soi.item_description, '') ILIKE '%' || $4 || '%'
                  OR COALESCE(soi.uom, '') ILIKE '%' || $4 || '%'
              )
            ORDER BY so.transaction_date DESC,
                     so.order_id DESC,
                     soi.line_number,
                     soi.order_item_id
            `,
            [companyId, entity, transactionNumber, itemSearch]
        );

        return NextResponse.json({
            success: true,
            rows: result.rows.map((row, index) => ({
                ...row,
                sequence_id: index + 1,
                do_quantity: Number(row.pending_quantity),
                line_quantity: Number(row.line_quantity),
                delivered_quantity: Number(row.delivered_quantity),
                pending_quantity: Number(row.pending_quantity),
                item_balance: Number(row.item_balance || 0),
            })),
        });
    } catch (error) {
        console.error("PENDING DELIVERY CHALLANS API ERROR:", error);

        return NextResponse.json(
            { success: false, message: "Could not load pending Delivery Challan lines." },
            { status: 500 }
        );
    }
}
