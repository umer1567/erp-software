import { NextResponse } from "next/server";
import pool from "@/lib/db";

export async function GET() {
  try {
    const result = await pool.query(`
      SELECT
        c.customer_id,
        c.customer_code,
        c.customer_name,
        c.phone,

        c.opening_balance,

        COALESCE(
          SUM(si.total_amount),
          0
        ) AS total_sales,

        COALESCE(
          SUM(si.paid_amount),
          0
        ) AS total_paid,

        (
          c.opening_balance
          +
          COALESCE(
            SUM(si.total_amount),
            0
          )
          -
          COALESCE(
            SUM(si.paid_amount),
            0
          )
        ) AS receivable

      FROM customers c

      LEFT JOIN sales_invoices si
        ON si.customer_id = c.customer_id

      GROUP BY
        c.customer_id

      ORDER BY
        c.customer_name
    `);

    return NextResponse.json({
      success: true,
      receivables: result.rows,
    });
  } catch (error) {
    console.error(
      "RECEIVABLE GET ERROR:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        message:
          "Failed to load receivables.",
        error: error.message,
      },
      { status: 500 }
    );
  }
}