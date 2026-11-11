
import { NextResponse } from "next/server";
import pool from "@/lib/db";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(request) {
    try {
        const { searchParams } = new URL(request.url);
        const warehouseParam = searchParams.get("warehouseId");

        if (
            warehouseParam !== null &&
            (!/^\d+$/.test(warehouseParam) ||
                Number(warehouseParam) <= 0)
        ) {
            return NextResponse.json(
                {
                    success: false,
                    message: "Invalid warehouse ID.",
                },
                { status: 400 }
            );
        }

        const values = [];
        let stockJoin;

        if (warehouseParam !== null) {
            const warehouseId = Number(warehouseParam);

            values.push(warehouseId);

            stockJoin = `
                LEFT JOIN stock s
                    ON s.product_id = p.product_id
                    AND s.warehouse_id = $1
            `;
        } else {
            // Without a warehouse filter, show stock records
            // from all warehouses, including products without stock.
            stockJoin = `
                LEFT JOIN stock s
                    ON s.product_id = p.product_id
            `;
        }

        const query = `
    WITH product_totals AS (
        SELECT
            product_id,
            SUM(quantity) AS total_available_stock
        FROM stock
        GROUP BY product_id
    )
    SELECT
        s.stock_id,
        p.product_id,
        s.warehouse_id,
        p.sku,
        p.product_name,
        p.category,
        p.unit,
        p.cost_price,
        p.sale_price,
        p.minimum_stock,
        w.warehouse_name,

        COALESCE(s.quantity, 0) AS quantity,
        COALESCE(s.quantity, 0) AS warehouse_stock,
        COALESCE(pt.total_available_stock, 0)
            AS available_stock,

        CASE
            WHEN COALESCE(pt.total_available_stock, 0)
                 <= COALESCE(p.minimum_stock, 0)
            THEN TRUE
            ELSE FALSE
        END AS low_stock

    FROM products p

    ${stockJoin}

    LEFT JOIN warehouses w
        ON w.warehouse_id = s.warehouse_id

    LEFT JOIN product_totals pt
        ON pt.product_id = p.product_id

    ORDER BY p.product_name ASC
`;

        const queryStartedAt = performance.now();

const result = await pool.query(query, values);

const queryDurationMs = Number(
    (performance.now() - queryStartedAt).toFixed(2)
);

console.info("[STOCK API PERFORMANCE]", {
    queryDurationMs,
    rowsReturned: result.rowCount,
    warehouseId: warehouseParam
        ? Number(warehouseParam)
        : null,
    pool: {
        totalConnections: pool.totalCount,
        idleConnections: pool.idleCount,
        waitingRequests: pool.waitingCount,
    },
});

        return NextResponse.json(
            {
                success: true,
                stock: result.rows,
            },
            {
                headers: {
                    "Cache-Control": "no-store",
                },
            }
        );
    } catch (error) {
        console.error("GET /api/stock failed:", error);

        return NextResponse.json(
            {
                success: false,
                message: "Failed to load stock.",
                ...(process.env.NODE_ENV !== "production"
                    ? { detail: error.message }
                    : {}),
            },
            { status: 500 }
        );
    }
}
