import { NextResponse } from "next/server";
import pool from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(request, { params }) {
  try {
    const { id } = await params;
    const invoiceId = Number(id);

    if (!Number.isInteger(invoiceId) || invoiceId <= 0) {
      return NextResponse.json(
        { success: false, message: "Invalid invoice ID." },
        { status: 400 }
      );
    }

    // Confirm that the invoice exists.
    const invoiceResult = await pool.query(
      `SELECT invoice_id, invoice_number
       FROM sales_invoices
       WHERE invoice_id = $1`,
      [invoiceId]
    );

    if (invoiceResult.rows.length === 0) {
      return NextResponse.json(
        { success: false, message: "Sales invoice not found." },
        { status: 404 }
      );
    }

    // Retrieve the actual posted accounting lines.
    // Include both the sales journal and COGS journal.
    const result = await pool.query(
      `SELECT
         je.journal_id,
         je.journal_number,
         je.journal_date,
         je.reference_type,
         je.description AS journal_description,
         jel.account_id,
         coa.account_code,
         coa.account_name,
         jel.description AS line_description,
         jel.debit,
         jel.credit
       FROM journal_entries je
       INNER JOIN journal_entry_lines jel
         ON jel.journal_id = je.journal_id
       LEFT JOIN chart_of_accounts coa
         ON coa.account_id = jel.account_id
       WHERE je.reference_id = $1
         AND je.reference_type IN ('SALES_INVOICE', 'SALES_COGS')
       ORDER BY je.journal_id ASC, jel.account_id ASC`,
      [invoiceId]
    );

    const lines = result.rows;

    const totalDebit = lines.reduce(
      (sum, line) => sum + Number(line.debit || 0),
      0
    );

    const totalCredit = lines.reduce(
      (sum, line) => sum + Number(line.credit || 0),
      0
    );

    return NextResponse.json({
      success: true,
      invoice: invoiceResult.rows[0],
      lines,
      totalDebit,
      totalCredit,
      balanced: Math.abs(totalDebit - totalCredit) < 0.01,
    });
  } catch (error) {
    console.error("SALES INVOICE ACCOUNTING ERROR:", error);

    return NextResponse.json(
      {
        success: false,
        message: "Failed to load invoice accounting lines.",
        error: error.message,
      },
      { status: 500 }
    );
  }
}