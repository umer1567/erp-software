import { NextResponse } from "next/server";
import pool from "@/lib/db";

export async function GET() {
  try {
    const result = await pool.query(`
      SELECT
        a.account_id,
        a.account_code,
        a.account_name,
        a.account_type,

        COALESCE(SUM(l.debit), 0) AS debit,
        COALESCE(SUM(l.credit), 0) AS credit

      FROM chart_of_accounts a

      INNER JOIN journal_entry_lines l
        ON l.account_id = a.account_id

      INNER JOIN journal_entries j
        ON j.journal_id = l.journal_id

      WHERE j.status = 'POSTED'
        AND a.account_type IN ('REVENUE', 'EXPENSE')

      GROUP BY
        a.account_id,
        a.account_code,
        a.account_name,
        a.account_type

      ORDER BY
        a.account_type,
        a.account_code
    `);

    const revenue = [];
    const expenses = [];

    let totalRevenue = 0;
    let totalExpenses = 0;

    for (const row of result.rows) {
      const debit = Number(row.debit);
      const credit = Number(row.credit);

      let amount;

      if (row.account_type === "REVENUE") {
        amount = credit - debit;

        revenue.push({
          ...row,
          amount,
        });

        totalRevenue += amount;
      } else {
        amount = debit - credit;

        expenses.push({
          ...row,
          amount,
        });

        totalExpenses += amount;
      }
    }

    const netProfit = totalRevenue - totalExpenses;

    return NextResponse.json({
      success: true,
      revenue,
      expenses,
      totals: {
        totalRevenue,
        totalExpenses,
        netProfit,
      },
    });
  } catch (error) {
    console.error("PROFIT LOSS ERROR:", error);

    return NextResponse.json(
      {
        success: false,
        message: "Failed to load Profit & Loss.",
        error: error.message,
      },
      { status: 500 }
    );
  }
}