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

      LEFT JOIN journal_entry_lines l
        ON l.account_id = a.account_id

      LEFT JOIN journal_entries j
        ON j.journal_id = l.journal_id
        AND j.status = 'POSTED'

      WHERE a.account_type IN (
        'ASSET',
        'LIABILITY',
        'EQUITY'
      )

      GROUP BY
        a.account_id,
        a.account_code,
        a.account_name,
        a.account_type

      ORDER BY
        a.account_type,
        a.account_code
    `);

    const assets = [];
    const liabilities = [];
    const equity = [];

    let totalAssets = 0;
    let totalLiabilities = 0;
    let totalEquity = 0;

    for (const row of result.rows) {
      const debit = Number(row.debit);
      const credit = Number(row.credit);

      let balance = 0;

      if (row.account_type === "ASSET") {
        balance = debit - credit;

        assets.push({
          ...row,
          balance,
        });

        totalAssets += balance;
      }

      if (row.account_type === "LIABILITY") {
        balance = credit - debit;

        liabilities.push({
          ...row,
          balance,
        });

        totalLiabilities += balance;
      }

      if (row.account_type === "EQUITY") {
        balance = credit - debit;

        equity.push({
          ...row,
          balance,
        });

        totalEquity += balance;
      }
    }

    // Calculate current period profit.
    const profitResult = await pool.query(`
      SELECT
        COALESCE(
          SUM(
            CASE
              WHEN a.account_type = 'REVENUE'
                THEN l.credit - l.debit
              WHEN a.account_type = 'EXPENSE'
                THEN -(l.debit - l.credit)
              ELSE 0
            END
          ),
          0
        ) AS net_profit

      FROM journal_entry_lines l

      INNER JOIN journal_entries j
        ON j.journal_id = l.journal_id

      INNER JOIN chart_of_accounts a
        ON a.account_id = l.account_id

      WHERE j.status = 'POSTED'
    `);

    const netProfit =
      Number(profitResult.rows[0]?.net_profit) || 0;

    const totalEquityWithProfit =
      totalEquity + netProfit;

    const liabilitiesAndEquity =
      totalLiabilities + totalEquityWithProfit;

    return NextResponse.json({
      success: true,

      assets,
      liabilities,
      equity,

      totals: {
        totalAssets,
        totalLiabilities,
        totalEquity,
        netProfit,
        totalEquityWithProfit,
        liabilitiesAndEquity,
        difference:
          totalAssets - liabilitiesAndEquity,
      },
    });
  } catch (error) {
    console.error("BALANCE SHEET ERROR:", error);

    return NextResponse.json(
      {
        success: false,
        message: "Failed to load Balance Sheet.",
        error: error.message,
      },
      { status: 500 }
    );
  }
}