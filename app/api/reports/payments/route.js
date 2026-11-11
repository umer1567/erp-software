import { NextResponse } from "next/server";
import pool from "@/lib/db";

export async function GET() {
  try {
    const sales = await pool.query(`
      SELECT
        p.payment_id,
        p.payment_number,
        p.payment_date,
        'RECEIPT' AS transaction_type,
        c.customer_name AS party_name,
        p.amount,
        p.payment_method,
        p.reference_number,
        p.notes
      FROM sales_payments p
      INNER JOIN customers c
        ON c.customer_id = p.customer_id
      ORDER BY p.payment_date DESC, p.payment_id DESC
    `);

    const purchases = await pool.query(`
      SELECT
        p.payment_id,
        p.payment_number,
        p.payment_date,
        'PAYMENT' AS transaction_type,
        s.supplier_name AS party_name,
        p.amount,
        p.payment_method,
        p.reference_number,
        p.notes
      FROM purchase_payments p
      INNER JOIN suppliers s
        ON s.supplier_id = p.supplier_id
      ORDER BY p.payment_date DESC, p.payment_id DESC
    `);

    const payments = [
      ...sales.rows,
      ...purchases.rows,
    ].sort(
      (a, b) =>
        new Date(b.payment_date) -
        new Date(a.payment_date)
    );

    const summary = {
      totalReceipts: sales.rows.reduce(
        (sum, row) => sum + Number(row.amount),
        0
      ),

      totalPayments: purchases.rows.reduce(
        (sum, row) => sum + Number(row.amount),
        0
      ),
    };

    return NextResponse.json({
      success: true,
      summary,
      payments,
    });
  } catch (error) {
    console.error("PAYMENT REPORT ERROR:", error);

    return NextResponse.json(
      {
        success: false,
        message: "Failed to load payment report.",
        error: error.message,
      },
      { status: 500 }
    );
  }
}