import { NextResponse } from "next/server";
import pool from "@/lib/db";

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);

    const from = searchParams.get("from");
    const to = searchParams.get("to");

    const params = [];
    let dateCondition = "";

    if (from) {
      params.push(from);
      dateCondition += ` AND purchase_date >= $${params.length}`;
    }

    if (to) {
      params.push(to);
      dateCondition += ` AND purchase_date <= $${params.length}`;
    }

    const summary = await pool.query(
      `
      SELECT
        COUNT(*)::int AS invoice_count,
        COALESCE(SUM(subtotal), 0) AS subtotal,
        COALESCE(SUM(discount), 0) AS discount,
        COALESCE(SUM(tax), 0) AS tax,
        COALESCE(SUM(total_amount), 0) AS total_purchase,
        COALESCE(SUM(paid_amount), 0) AS paid_amount,
        COALESCE(SUM(balance_amount), 0) AS balance_amount
      FROM purchase_invoices
      WHERE 1=1
      ${dateCondition}
      `,
      params
    );

    const suppliers = await pool.query(
      `
      SELECT
        s.supplier_id,
        s.supplier_code,
        s.supplier_name,
        COUNT(p.purchase_id)::int AS invoice_count,
        COALESCE(SUM(p.total_amount), 0) AS total_purchase,
        COALESCE(SUM(p.paid_amount), 0) AS paid_amount,
        COALESCE(SUM(p.balance_amount), 0) AS balance_amount
      FROM suppliers s
      INNER JOIN purchase_invoices p
        ON p.supplier_id = s.supplier_id
      WHERE 1=1
      ${dateCondition}
      GROUP BY
        s.supplier_id,
        s.supplier_code,
        s.supplier_name
      ORDER BY total_purchase DESC
      LIMIT 10
      `,
      params
    );

    return NextResponse.json({
      success: true,
      summary: summary.rows[0],
      topSuppliers: suppliers.rows,
    });
  } catch (error) {
    console.error("PURCHASE REPORT ERROR:", error);

    return NextResponse.json(
      {
        success: false,
        message: "Failed to load purchase dashboard.",
        error: error.message,
      },
      { status: 500 }
    );
  }
}