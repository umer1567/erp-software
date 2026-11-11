import { NextResponse } from "next/server";
import pool from "@/lib/db";

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const accountId = searchParams.get("accountId");

    if (!accountId) {
      return NextResponse.json(
        {
          success: false,
          message: "Account ID is required.",
        },
        { status: 400 }
      );
    }

    const result = await pool.query(
      `
      SELECT
        j.journal_id,
        j.journal_number,
        j.journal_date,
        j.description AS journal_description,

        l.journal_line_id,
        l.account_id,
        l.description AS line_description,
        l.debit,
        l.credit,

        a.account_code,
        a.account_name,
        a.account_type

      FROM journal_entry_lines l

      INNER JOIN journal_entries j
        ON j.journal_id = l.journal_id

      INNER JOIN chart_of_accounts a
        ON a.account_id = l.account_id

      WHERE l.account_id = $1

      ORDER BY
        j.journal_date ASC,
        j.journal_id ASC,
        l.journal_line_id ASC
      `,
      [accountId]
    );

    let runningBalance = 0;

    const transactions = result.rows.map((row) => {
      const debit = Number(row.debit) || 0;
      const credit = Number(row.credit) || 0;

      // Display running balance using debit - credit.
      runningBalance += debit - credit;

      return {
        ...row,
        debit,
        credit,
        balance: runningBalance,
      };
    });

    const account = result.rows[0]
      ? {
          account_id: result.rows[0].account_id,
          account_code: result.rows[0].account_code,
          account_name: result.rows[0].account_name,
          account_type: result.rows[0].account_type,
        }
      : null;

    return NextResponse.json({
      success: true,
      account,
      transactions,
      totals: {
        debit: transactions.reduce(
          (sum, row) => sum + row.debit,
          0
        ),
        credit: transactions.reduce(
          (sum, row) => sum + row.credit,
          0
        ),
      },
    });
  } catch (error) {
    console.error("LEDGER GET ERROR:", error);

    return NextResponse.json(
      {
        success: false,
        message: "Failed to load ledger.",
        error: error.message,
      },
      { status: 500 }
    );
  }
}