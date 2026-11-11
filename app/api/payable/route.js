import { NextResponse } from "next/server";
import pool from "@/lib/db";

export async function GET() {
  try {
    const result = await pool.query(`
      SELECT
        s.supplier_id,
        s.supplier_code,
        s.supplier_name,
        s.phone,

        s.opening_balance,

        COALESCE(
          SUM(p.total_amount),
          0
        ) AS total_purchases,

        COALESCE(
          SUM(pp.amount),
          0
        ) AS total_paid,

        (
          s.opening_balance
          +
          COALESCE(
            SUM(p.total_amount),
            0
          )
          -
          COALESCE(
            SUM(pp.amount),
            0
          )
        ) AS payable

      FROM suppliers s

      LEFT JOIN purchases p
        ON p.supplier_id = s.supplier_id

      LEFT JOIN purchase_payments pp
        ON pp.supplier_id = s.supplier_id

      GROUP BY
        s.supplier_id

      ORDER BY
        s.supplier_name
    `);

    return NextResponse.json({
      success: true,
      payables: result.rows,
    });
  } catch (error) {
    console.error(
      "PAYABLE GET ERROR:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        message:
          "Failed to load payables.",
        error: error.message,
      },
      { status: 500 }
    );
  }
}