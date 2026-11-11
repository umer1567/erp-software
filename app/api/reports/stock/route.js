import { NextResponse } from "next/server";
import pool from "@/lib/db";

export async function GET() {
  try {
    const result = await pool.query(`
      SELECT
        s.stock_id,
        p.product_id,
        p.sku,
        p.product_name,
        p.category,
        p.unit,
        p.cost_price,
        p.sale_price,
        p.minimum_stock,

        w.warehouse_id,
        w.warehouse_code,
        w.warehouse_name,

        s.quantity,

        (s.quantity * p.cost_price) AS stock_cost_value,
        (s.quantity * p.sale_price) AS stock_sale_value,

        CASE
          WHEN s.quantity <= 0 THEN 'OUT OF STOCK'
          WHEN s.quantity <= p.minimum_stock THEN 'LOW STOCK'
          ELSE 'IN STOCK'
        END AS stock_status

      FROM stock s

      INNER JOIN products p
        ON p.product_id = s.product_id

      INNER JOIN warehouses w
        ON w.warehouse_id = s.warehouse_id

      ORDER BY
        p.product_name,
        w.warehouse_name
    `);

    const summary = await pool.query(`
      SELECT
        COUNT(DISTINCT product_id)::int AS product_count,
        COALESCE(SUM(quantity), 0) AS total_quantity
      FROM stock
    `);

    return NextResponse.json({
      success: true,
      summary: summary.rows[0],
      stock: result.rows,
    });
  } catch (error) {
    console.error("STOCK REPORT ERROR:", error);

    return NextResponse.json(
      {
        success: false,
        message: "Failed to load stock report.",
        error: error.message,
      },
      { status: 500 }
    );
  }
}