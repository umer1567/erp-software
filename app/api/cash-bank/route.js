import { NextResponse } from "next/server";
import pool from "@/lib/db";

export async function GET() {
  try {
    const result = await pool.query(`
      SELECT
        j.journal_id,
        j.journal_number,
        j.journal_date,
        j.description,
        l.journal_line_id,
        l.account_id,
        a.account_code,
        a.account_name,
        l.debit,
        l.credit
      FROM journal_entries j
      INNER JOIN journal_entry_lines l
        ON l.journal_id = j.journal_id
      INNER JOIN chart_of_accounts a
        ON a.account_id = l.account_id
      WHERE a.is_cash_bank = TRUE
      ORDER BY
        j.journal_date DESC,
        j.journal_id DESC,
        l.journal_line_id DESC
    `);

    let balance = 0;

    const transactions = result.rows.map((row) => {
      const debit = Number(row.debit) || 0;
      const credit = Number(row.credit) || 0;

      balance += debit - credit;

      return {
        ...row,
        debit,
        credit,
        balance,
      };
    });

    return NextResponse.json({
      success: true,
      transactions,
    });
  } catch (error) {
    console.error("CASH BANK GET ERROR:", error);

    return NextResponse.json(
      {
        success: false,
        message: "Failed to load cash/bank transactions.",
        error: error.message,
      },
      { status: 500 }
    );
  }
}

export async function POST(request) {
  const client = await pool.connect();

  try {
    const body = await request.json();

    const {
      accountId,
      transactionType,
      date,
      amount,
      referenceNumber,
      description,
    } = body;

    if (!accountId) {
      return NextResponse.json(
        { success: false, message: "Cash/Bank account is required." },
        { status: 400 }
      );
    }

    if (!["RECEIPT", "PAYMENT"].includes(transactionType)) {
      return NextResponse.json(
        { success: false, message: "Invalid transaction type." },
        { status: 400 }
      );
    }

    if (!date) {
      return NextResponse.json(
        { success: false, message: "Date is required." },
        { status: 400 }
      );
    }

    const transactionAmount = Number(amount);

    if (!Number.isFinite(transactionAmount) || transactionAmount <= 0) {
      return NextResponse.json(
        { success: false, message: "Amount must be greater than zero." },
        { status: 400 }
      );
    }

    await client.query("BEGIN");

    // Make sure selected account exists and is a cash/bank account.
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
      WHERE account_id = $1
      `,
      [accountId]
    );

    const account = accountResult.rows[0];

    if (!account) {
      throw new Error("Selected account does not exist.");
    }

    if (!account.is_active) {
      throw new Error("Selected account is inactive.");
    }

    if (account.is_group) {
      throw new Error(
        `"${account.account_name}" is a group account. Please select a posting account.`
      );
    }

    if (!account.is_cash_bank) {
      throw new Error(
        `"${account.account_name}" is not configured as a Cash/Bank account.`
      );
    }

    /*
      Receipt:
        Cash/Bank  DEBIT
        Other      CREDIT

      Payment:
        Other      DEBIT
        Cash/Bank  CREDIT

      For the Cash/Bank transaction itself, we create the
      corresponding journal entry with a temporary
      "General Expenses" / "General Income" counterpart.

      This is suitable for basic standalone cash/bank
      transactions. Later we can connect receipts/payments
      directly to customers, suppliers and invoices.
    */

    let counterpartResult;

    if (transactionType === "RECEIPT") {
      counterpartResult = await client.query(
        `
        SELECT account_id, account_name
        FROM chart_of_accounts
        WHERE account_code = '4100'
          AND is_active = TRUE
        LIMIT 1
        `
      );
    } else {
      counterpartResult = await client.query(
        `
        SELECT account_id, account_name
        FROM chart_of_accounts
        WHERE account_code = '5200'
          AND is_active = TRUE
        LIMIT 1
        `
      );
    }

    const counterpart = counterpartResult.rows[0];

    if (!counterpart) {
      throw new Error(
        transactionType === "RECEIPT"
          ? "Sales Revenue account (4100) was not found."
          : "General Expenses account (5200) was not found."
      );
    }

    const journalNumber = `CB-${Date.now()}`;

    const journalResult = await client.query(
      `
      INSERT INTO journal_entries
      (
        journal_number,
        journal_date,
        reference_type,
        description,
        status
      )
      VALUES ($1, $2, 'CASH_BANK', $3, 'POSTED')
      RETURNING *
      `,
      [
        journalNumber,
        date,
        description?.trim() ||
          `${transactionType === "RECEIPT" ? "Cash receipt" : "Cash payment"}${
            referenceNumber ? ` - ${referenceNumber}` : ""
          }`,
      ]
    );

    const journal = journalResult.rows[0];

    if (transactionType === "RECEIPT") {
      // Cash/Bank Debit
      await client.query(
        `
        INSERT INTO journal_entry_lines
        (
          journal_id,
          account_id,
          description,
          debit,
          credit
        )
        VALUES ($1, $2, $3, $4, 0)
        `,
        [
          journal.journal_id,
          account.account_id,
          description?.trim() || "Cash receipt",
          transactionAmount,
        ]
      );

      // Revenue Credit
      await client.query(
        `
        INSERT INTO journal_entry_lines
        (
          journal_id,
          account_id,
          description,
          debit,
          credit
        )
        VALUES ($1, $2, $3, 0, $4)
        `,
        [
          journal.journal_id,
          counterpart.account_id,
          description?.trim() || "Cash receipt",
          transactionAmount,
        ]
      );
    } else {
      // Expense Debit
      await client.query(
        `
        INSERT INTO journal_entry_lines
        (
          journal_id,
          account_id,
          description,
          debit,
          credit
        )
        VALUES ($1, $2, $3, $4, 0)
        `,
        [
          journal.journal_id,
          counterpart.account_id,
          description?.trim() || "Cash payment",
          transactionAmount,
        ]
      );

      // Cash/Bank Credit
      await client.query(
        `
        INSERT INTO journal_entry_lines
        (
          journal_id,
          account_id,
          description,
          debit,
          credit
        )
        VALUES ($1, $2, $3, 0, $4)
        `,
        [
          journal.journal_id,
          account.account_id,
          description?.trim() || "Cash payment",
          transactionAmount,
        ]
      );
    }

    await client.query("COMMIT");

    return NextResponse.json(
      {
        success: true,
        message: "Cash/Bank transaction saved successfully.",
        journal,
      },
      { status: 201 }
    );
  } catch (error) {
    await client.query("ROLLBACK");

    console.error("CASH BANK POST ERROR:", error);

    return NextResponse.json(
      {
        success: false,
        message:
          error.message || "Failed to save cash/bank transaction.",
      },
      { status: 500 }
    );
  } finally {
    client.release();
  }
}