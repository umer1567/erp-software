import { NextResponse } from "next/server";
import pool from "@/lib/db";

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);

    const from = searchParams.get("from") || "";
    const to = searchParams.get("to") || "";
    const accountId = searchParams.get("accountId") || "";
    const type = searchParams.get("type") || "";
    const search = searchParams.get("search") || "";

    // Validate filters before querying PostgreSQL.
    if (accountId && !/^\d+$/.test(accountId)) {
      return NextResponse.json(
        { success: false, message: "Invalid account ID." },
        { status: 400 }
      );
    }

    if (
      (from && !/^\d{4}-\d{2}-\d{2}$/.test(from)) ||
      (to && !/^\d{4}-\d{2}-\d{2}$/.test(to))
    ) {
      return NextResponse.json(
        { success: false, message: "Invalid date filter." },
        { status: 400 }
      );
    }

    if (from && to && from > to) {
      return NextResponse.json(
        { success: false, message: "Start date must not exceed end date." },
        { status: 400 }
      );
    }

    const accountsResult = await pool.query(`
      SELECT
        account_id,
        account_code,
        account_name,
        account_type,
        opening_balance,
        current_balance,
        is_active,
        is_group
      FROM chart_of_accounts
      WHERE is_active = TRUE
      ORDER BY account_code
    `);

    const result = await pool.query(
      `
      WITH all_posted_lines AS (
        SELECT
          je.journal_id,
          je.journal_number,
          je.journal_date,
          je.reference_type,
          je.reference_id,
          je.description AS journal_description,
          jel.journal_line_id,
          jel.account_id,
          ca.account_code,
          ca.account_name,
          ca.account_type,
          jel.description AS line_description,
          COALESCE(jel.debit, 0)::numeric AS debit,
          COALESCE(jel.credit, 0)::numeric AS credit,

          SUM(
            CASE
              WHEN UPPER(COALESCE(ca.account_type, '')) IN
                ('LIABILITY', 'LIABILITIES', 'EQUITY',
                 'REVENUE', 'INCOME', 'INCOME/REVENUE')
              THEN COALESCE(jel.credit, 0) - COALESCE(jel.debit, 0)
              ELSE COALESCE(jel.debit, 0) - COALESCE(jel.credit, 0)
            END
          ) OVER (
            PARTITION BY jel.account_id
            ORDER BY
              je.journal_date,
              je.journal_id,
              jel.journal_line_id
            ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
          ) AS running_balance

        FROM journal_entries je
        INNER JOIN journal_entry_lines jel
          ON jel.journal_id = je.journal_id
        INNER JOIN chart_of_accounts ca
          ON ca.account_id = jel.account_id
        WHERE UPPER(COALESCE(je.status, '')) = 'POSTED'
      )

      SELECT *
      FROM all_posted_lines
      WHERE ($1 = '' OR journal_date >= $1::date)
        AND ($2 = '' OR journal_date <= $2::date)
        AND ($3 = '' OR account_id = $3::integer)
        AND ($4 = '' OR UPPER(COALESCE(reference_type, '')) = UPPER($4))
        AND (
          $5 = ''
          OR journal_number ILIKE '%' || $5 || '%'
          OR COALESCE(journal_description, '') ILIKE '%' || $5 || '%'
          OR COALESCE(line_description, '') ILIKE '%' || $5 || '%'
          OR account_name ILIKE '%' || $5 || '%'
          OR account_code ILIKE '%' || $5 || '%'
          OR COALESCE(reference_type, '') ILIKE '%' || $5 || '%'
        )
      ORDER BY journal_date DESC, journal_id DESC, journal_line_id DESC
      LIMIT 2000
      `,
      [from, to, accountId, type, search]
    );

    const rows = result.rows;

    const totals = rows.reduce(
      (sum, row) => {
        sum.debit += Number(row.debit || 0);
        sum.credit += Number(row.credit || 0);
        return sum;
      },
      { debit: 0, credit: 0 }
    );

    return NextResponse.json({
      success: true,
      accounts: accountsResult.rows,
      transactions: rows,
      totals,
    });
  } catch (error) {
    console.error("ACCOUNTING LEDGER ERROR:", error);

    return NextResponse.json(
      {
        success: false,
        message: "Failed to load financial ledger.",
      },
      { status: 500 }
    );
  }
}
