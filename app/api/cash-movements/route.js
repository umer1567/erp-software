
import { NextResponse } from "next/server";
import pool from "@/lib/db";

export const dynamic = "force-dynamic";

const validTypes = ["RECEIPT", "PAYMENT"];

// Get available cash and bank accounts, plus possible
// counter accounts for the Cash In / Cash Out form.
export async function GET() {
  try {
    const result = await pool.query(`
      SELECT
        account_id,
        account_code,
        account_name,
        account_type,
        is_active,
        is_group,
        is_cash_bank
      FROM chart_of_accounts
      WHERE is_active = TRUE
      ORDER BY account_code
    `);

    const accounts = result.rows;

    return NextResponse.json({
      success: true,
      cashAccounts: accounts.filter(
        (account) =>
          account.is_cash_bank === true &&
          account.is_group === false
      ),
      counterAccounts: accounts.filter(
        (account) =>
          account.is_cash_bank !== true &&
          account.is_group === false
      ),
    });
  } catch (error) {
    console.error("Cash movement accounts error:", error);

    return NextResponse.json(
      { error: "Failed to load accounts." },
      { status: 500 }
    );
  }
}

// Create a Cash In (RECEIPT) or Cash Out (PAYMENT) journal entry.
export async function POST(request) {
  const client = await pool.connect();

  try {
    const body = await request.json();

    const {
      accountId,
      counterAccountId,
      transactionType,
      amount,
      date,
      description,
      referenceNumber,
    } = body;

    const cashAccountId = Number(accountId);
    const otherAccountId = Number(counterAccountId);
    const transactionAmount = Number(amount);

    if (
      !Number.isInteger(cashAccountId) ||
      cashAccountId <= 0 ||
      !Number.isInteger(otherAccountId) ||
      otherAccountId <= 0
    ) {
      return NextResponse.json(
        { error: "Select a valid cash/bank account and counter account." },
        { status: 400 }
      );
    }

    if (cashAccountId === otherAccountId) {
      return NextResponse.json(
        { error: "Cash/bank account and counter account must be different." },
        { status: 400 }
      );
    }

    if (!validTypes.includes(transactionType)) {
      return NextResponse.json(
        { error: "Transaction type must be RECEIPT or PAYMENT." },
        { status: 400 }
      );
    }

    if (
      !Number.isFinite(transactionAmount) ||
      transactionAmount <= 0 ||
      !Number.isFinite(Math.round(transactionAmount * 100) / 100) ||
      Math.round(transactionAmount * 100) / 100 !== transactionAmount
    ) {
      return NextResponse.json(
        { error: "Enter a valid amount with up to two decimal places." },
        { status: 400 }
      );
    }

    if (!date || Number.isNaN(Date.parse(date))) {
      return NextResponse.json(
        { error: "A valid transaction date is required." },
        { status: 400 }
      );
    }

    if (!description || !String(description).trim()) {
      return NextResponse.json(
        { error: "Please enter a description." },
        { status: 400 }
      );
    }

    await client.query("BEGIN");

    // Lock both accounts and verify they are active leaf accounts.
    const accountResult = await client.query(
      `
        SELECT
          account_id,
          account_code,
          account_name,
          account_type,
          is_active,
          is_group,
          is_cash_bank
        FROM chart_of_accounts
        WHERE account_id = ANY($1::integer[])
        ORDER BY account_id
        FOR UPDATE
      `,
      [[cashAccountId, otherAccountId]]
    );

    if (accountResult.rows.length !== 2) {
      throw new Error("One or both selected accounts do not exist.");
    }

    const cashAccount = accountResult.rows.find(
      (account) => account.account_id === cashAccountId
    );

    const counterAccount = accountResult.rows.find(
      (account) => account.account_id === otherAccountId
    );

    if (
      !cashAccount.is_active ||
      cashAccount.is_group ||
      !cashAccount.is_cash_bank
    ) {
      throw new Error("Select an active cash or bank ledger account.");
    }

    if (
      !counterAccount.is_active ||
      counterAccount.is_group ||
      counterAccount.is_cash_bank
    ) {
      throw new Error("Select an active, non-cash/bank counter account.");
    }

    const journalNumber = `CB-${Date.now()}-${Math.floor(
      Math.random() * 1000
    )}`;

    const prefix =
      transactionType === "RECEIPT" ? "Cash In" : "Cash Out";

    const fullDescription = `${prefix}: ${String(description).trim()}`;

    // Create the journal header.
    const journalResult = await client.query(
      `
        INSERT INTO journal_entries (
          journal_number,
          journal_date,
          reference_type,
          description,
          status
        )
        VALUES ($1, $2, 'CASH_BANK', $3, 'POSTED')
        RETURNING journal_id, journal_number
      `,
      [journalNumber, date, fullDescription]
    );

    const journal = journalResult.rows[0];

    // Receipt: debit cash/bank, credit counter account.
    // Payment: debit counter account, credit cash/bank.
    const lines =
      transactionType === "RECEIPT"
        ? [
            {
              accountId: cashAccountId,
              description: fullDescription,
              debit: transactionAmount,
              credit: 0,
            },
            {
              accountId: otherAccountId,
              description: fullDescription,
              debit: 0,
              credit: transactionAmount,
            },
          ]
        : [
            {
              accountId: otherAccountId,
              description: fullDescription,
              debit: transactionAmount,
              credit: 0,
            },
            {
              accountId: cashAccountId,
              description: fullDescription,
              debit: 0,
              credit: transactionAmount,
            },
          ];

    for (const line of lines) {
      await client.query(
        `
          INSERT INTO journal_entry_lines (
            journal_id,
            account_id,
            description,
            debit,
            credit
          )
          VALUES ($1, $2, $3, $4, $5)
        `,
        [
          journal.journal_id,
          line.accountId,
          line.description,
          line.debit,
          line.credit,
        ]
      );

      // Update the account's current balance using its normal balance.
      // Assets/expenses: debit increases the balance.
      // Liabilities/equity/revenue: credit increases the balance.
      const account = accountResult.rows.find(
        (item) => item.account_id === line.accountId
      );

      const debitNormal = ["ASSET", "EXPENSE"].includes(
        String(account.account_type).toUpperCase()
      );

      const balanceChange = debitNormal
        ? line.debit - line.credit
        : line.credit - line.debit;

      await client.query(
        `
          UPDATE chart_of_accounts
          SET
            current_balance = COALESCE(current_balance, 0) + $1,
            updated_at = CURRENT_TIMESTAMP
          WHERE account_id = $2
        `,
        [balanceChange, line.accountId]
      );
    }

    await client.query("COMMIT");

    return NextResponse.json(
      {
        success: true,
        message:
          transactionType === "RECEIPT"
            ? "Cash In recorded successfully."
            : "Cash Out recorded successfully.",
        journalId: journal.journal_id,
        journalNumber: journal.journal_number,
      },
      { status: 201 }
    );
  } catch (error) {
    await client.query("ROLLBACK");

    console.error("Cash movement error:", error);

    return NextResponse.json(
      { error: error.message || "Failed to record cash movement." },
      { status: 500 }
    );
  } finally {
    client.release();
  }
}
