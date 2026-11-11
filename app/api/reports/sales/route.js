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
      dateCondition += ` AND invoice_date >= $${params.length}`;
    }

    if (to) {
      params.push(to);
      dateCondition += ` AND invoice_date <= $${params.length}`;
    }

    const summaryResult = await pool.query(
      `
      SELECT
        COUNT(*)::int AS invoice_count,
        COALESCE(SUM(subtotal), 0) AS subtotal,
        COALESCE(SUM(discount), 0) AS discount,
        COALESCE(SUM(tax), 0) AS tax,
        COALESCE(SUM(total_amount), 0) AS total_sales,
        COALESCE(SUM(paid_amount), 0) AS paid_amount,
        COALESCE(SUM(balance_amount), 0) AS balance_amount
      FROM sales_invoices
      WHERE 1=1
      ${dateCondition}
      `,
      params
    );

    const statusResult = await pool.query(
      `
      SELECT
        status,
        COUNT(*)::int AS count,
        COALESCE(SUM(total_amount), 0) AS amount
      FROM sales_invoices
      WHERE 1=1
      ${dateCondition}
      GROUP BY status
      ORDER BY status
      `,
      params
    );

    const customerResult = await pool.query(
      `
      SELECT
        c.customer_id,
        c.customer_code,
        c.customer_name,
        COUNT(i.invoice_id)::int AS invoice_count,
        COALESCE(SUM(i.total_amount), 0) AS total_sales,
        COALESCE(SUM(i.paid_amount), 0) AS paid_amount,
        COALESCE(SUM(i.balance_amount), 0) AS balance_amount
      FROM customers c
      INNER JOIN sales_invoices i
        ON i.customer_id = c.customer_id
      WHERE 1=1
      ${dateCondition}
      GROUP BY
        c.customer_id,
        c.customer_code,
        c.customer_name
      ORDER BY total_sales DESC
      LIMIT 10
      `,
      params
    );

    return NextResponse.json({
      success: true,
      summary: summaryResult.rows[0],
      status: statusResult.rows,
      topCustomers: customerResult.rows,
    });
  } catch (error) {
    console.error("SALES REPORT ERROR:", error);

    return NextResponse.json(
      {
        success: false,
        message: "Failed to load sales dashboard.",
        error: error.message,
      },
      { status: 500 }
    );
  }
}