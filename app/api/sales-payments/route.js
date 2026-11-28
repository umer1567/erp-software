
import { NextResponse } from "next/server";
import { getTenantContext, unauthorizedResponse } from "@/lib/tenant";
import centralDb from "@/lib/db";

export const dynamic = "force-dynamic";

const DEFAULT_RECEIVABLE_ACCOUNT_ID = 6;

async function getNextSalesPaymentNumber(companyId, tenantClient) {
  const numericCompanyId = Number(companyId);

  if (
    !Number.isSafeInteger(numericCompanyId) ||
    numericCompanyId <= 0
  ) {
    throw new Error("Invalid company ID for payment numbering.");
  }

  const sequenceName =
    `sales_payment_company_${numericCompanyId}_seq`;

  // Store the sequence in the central erp_system database.
  await centralDb.query(`
    CREATE SEQUENCE IF NOT EXISTS public."${sequenceName}"
    START WITH 1
    INCREMENT BY 1
  `);

  // Skip numbers that already exist in this company's database.
  for (let attempt = 0; attempt < 1000; attempt++) {
    const result = await centralDb.query(
      `
      SELECT nextval($1::regclass)::TEXT AS sequence_value
      `,
      [`public.${sequenceName}`]
    );

    const sequenceValue = result.rows[0].sequence_value;

    const paymentNumber =
      `PAY-${String(sequenceValue).padStart(6, "0")}`;

    const existing = await tenantClient.query(
      `
      SELECT 1
      FROM sales_payments
      WHERE payment_number = $1
      LIMIT 1
      `,
      [paymentNumber]
    );

    if (existing.rows.length === 0) {
      return paymentNumber;
    }
  }

  throw new Error("Could not generate a unique sales payment number.");
}

async function getCashBankAccounts(db) {
  const result = await db.query(`
    SELECT
      account_id,
      account_code,
      account_name,
      account_type
    FROM chart_of_accounts
    WHERE is_active = TRUE
      AND is_group = FALSE
      AND is_cash_bank = TRUE
      AND account_type = 'ASSET'
    ORDER BY account_code
  `);

  return result.rows;
}

async function validateCashBankAccount(db, accountId) {
  const result = await db.query(
    `
    SELECT account_id, account_code, account_name
    FROM chart_of_accounts
    WHERE account_id = $1
      AND is_active = TRUE
      AND is_group = FALSE
      AND is_cash_bank = TRUE
      AND account_type = 'ASSET'
    FOR UPDATE
    `,
    [accountId]
  );

  if (!result.rows.length) {
    throw new Error("Select a valid active Cash/Bank account.");
  }

  return result.rows[0];
}

async function getInvoiceReceivableAccount(db, invoiceId) {
  const result = await db.query(
    `
    SELECT jel.account_id
    FROM journal_entries je
    INNER JOIN journal_entry_lines jel
      ON jel.journal_id = je.journal_id
    WHERE je.reference_type = 'SALES_INVOICE'
      AND je.reference_id = $1
      AND je.status = 'POSTED'
      AND jel.party_type = 'CUSTOMER'
      AND jel.debit > 0
    ORDER BY jel.journal_line_id
    LIMIT 1
    `,
    [invoiceId]
  );

  return result.rows.length
    ? Number(result.rows[0].account_id)
    : DEFAULT_RECEIVABLE_ACCOUNT_ID;
}

/*
  Creates or updates the accounting journal for a payment.

  Existing payment journal lines are reversed in COA balances
  before the new lines are inserted.

  This only modifies SALES_PAYMENT journals.
  CASH_BANK and other journal entries are not touched.
*/
async function postPaymentJournal(
  db,
  {
    paymentId,
    paymentNumber,
    paymentDate,
    paymentAmount,
    paymentAccountId,
    receivableAccountId,
    customerId,
    customerName,
    invoiceNumber,
  }
) {
  const existingJournalResult = await db.query(
    `
    SELECT journal_id
    FROM journal_entries
    WHERE reference_type = 'SALES_PAYMENT'
      AND reference_id = $1
    FOR UPDATE
    `,
    [paymentId]
  );

  let journalId;

  if (existingJournalResult.rows.length) {
    journalId = existingJournalResult.rows[0].journal_id;

    const oldLinesResult = await db.query(
      `
      SELECT account_id, debit, credit
      FROM journal_entry_lines
      WHERE journal_id = $1
      `,
      [journalId]
    );

    // Reverse the previous posting in Chart of Accounts.
    for (const line of oldLinesResult.rows) {
      const debit = Number(line.debit);
      const credit = Number(line.credit);

      await db.query(
        `
        UPDATE chart_of_accounts
        SET
          current_balance = current_balance - $1 + $2,
          updated_at = CURRENT_TIMESTAMP
        WHERE account_id = $3
        `,
        [debit, credit, line.account_id]
      );
    }

    await db.query(
      `DELETE FROM journal_entry_lines WHERE journal_id = $1`,
      [journalId]
    );

    await db.query(
      `
      UPDATE journal_entries
      SET
        journal_date = COALESCE($1::DATE, CURRENT_DATE),
        description = $2,
        status = 'POSTED',
        updated_at = CURRENT_TIMESTAMP
      WHERE journal_id = $3
      `,
      [
        paymentDate || null,
        `Customer payment ${paymentNumber} for invoice ${invoiceNumber}`,
        journalId,
      ]
    );
  } else {
    const journalResult = await db.query(
      `
      INSERT INTO journal_entries (
        journal_number,
        journal_date,
        reference_type,
        reference_id,
        description,
        status
      )
      VALUES (
        $1,
        COALESCE($2::DATE, CURRENT_DATE),
        'SALES_PAYMENT',
        $3,
        $4,
        'POSTED'
      )
      RETURNING journal_id
      `,
      [
        `PAY-JRN-${paymentId}`,
        paymentDate || null,
        paymentId,
        `Customer payment ${paymentNumber} for invoice ${invoiceNumber}`,
      ]
    );

    journalId = journalResult.rows[0].journal_id;
  }

  // Debit selected Cash/Bank account.
  await db.query(
    `
    INSERT INTO journal_entry_lines (
      journal_id,
      account_id,
      description,
      debit,
      credit,
      party_type,
      party_id
    )
    VALUES ($1, $2, $3, $4, 0, NULL, NULL)
    `,
    [
      journalId,
      paymentAccountId,
      `Payment received - ${paymentNumber}`,
      paymentAmount,
    ]
  );

  // Credit the invoice's Accounts Receivable account.
  await db.query(
    `
    INSERT INTO journal_entry_lines (
      journal_id,
      account_id,
      description,
      debit,
      credit,
      party_type,
      party_id
    )
    VALUES ($1, $2, $3, 0, $4, 'CUSTOMER', $5)
    `,
    [
      journalId,
      receivableAccountId,
      `Receivable settled - ${invoiceNumber}`,
      paymentAmount,
      customerId,
    ]
  );

  // Debit increases Cash/Bank asset balance.
  await db.query(
    `
    UPDATE chart_of_accounts
    SET
      current_balance = current_balance + $1,
      updated_at = CURRENT_TIMESTAMP
    WHERE account_id = $2
    `,
    [paymentAmount, paymentAccountId]
  );

  // Credit decreases Accounts Receivable asset balance.
  await db.query(
    `
    UPDATE chart_of_accounts
    SET
      current_balance = current_balance - $1,
      updated_at = CURRENT_TIMESTAMP
    WHERE account_id = $2
    `,
    [paymentAmount, receivableAccountId]
  );
}

async function getPayment(db, paymentId) {
  const result = await db.query(
    `
    SELECT
      sp.payment_id,
      sp.payment_number,
      sp.invoice_id,
      si.invoice_number,
      sp.customer_id,
      c.customer_code,
      c.customer_name,
      sp.payment_date,
      sp.amount,
      sp.payment_method,
      sp.account_id,
      coa.account_code,
      coa.account_name,
      sp.reference_number,
      sp.notes,
      sp.created_at
    FROM sales_payments sp
    INNER JOIN sales_invoices si
      ON si.invoice_id = sp.invoice_id
    INNER JOIN customers c
      ON c.customer_id = sp.customer_id
    LEFT JOIN chart_of_accounts coa
      ON coa.account_id = sp.account_id
    WHERE sp.payment_id = $1
    `,
    [paymentId]
  );

  return result.rows[0] || null;
}

async function recalculateInvoice(db, invoiceId) {
  const invoiceResult = await db.query(
    `
    SELECT invoice_id, total_amount
    FROM sales_invoices
    WHERE invoice_id = $1
    FOR UPDATE
    `,
    [invoiceId]
  );

  if (!invoiceResult.rows.length) {
    throw new Error("Sales invoice not found during recalculation.");
  }

  const paidResult = await db.query(
    `
    SELECT COALESCE(SUM(amount), 0) AS total_paid
    FROM sales_payments
    WHERE invoice_id = $1
    `,
    [invoiceId]
  );

  const total = Number(invoiceResult.rows[0].total_amount);
  const paid = Number(paidResult.rows[0].total_paid);
  const balance = Math.max(total - paid, 0);

  const status =
    balance <= 0
      ? "PAID"
      : paid <= 0
        ? "UNPAID"
        : "PARTIAL";

  await db.query(
    `
    UPDATE sales_invoices
    SET
      paid_amount = $1,
      balance_amount = $2,
      status = $3,
      updated_at = CURRENT_TIMESTAMP
    WHERE invoice_id = $4
    `,
    [paid, balance, status, invoiceId]
  );
}

/* GET payments and eligible Cash/Bank accounts. */
export async function GET(request) {
  try {
    const tenant = await getTenantContext();
    if (!tenant) return unauthorizedResponse();
    const { db } = tenant;

    const { searchParams } = new URL(request.url);
    const paymentId = searchParams.get("paymentId");

    const accounts = await getCashBankAccounts(db);

    if (paymentId) {
      const payment = await getPayment(db, paymentId);

      if (!payment) {
        return NextResponse.json(
          { success: false, message: "Payment not found." },
          { status: 404 }
        );
      }

      return NextResponse.json({
        success: true,
        payment,
        accounts,
      });
    }

    const result = await db.query(`
      SELECT
        sp.payment_id,
        sp.payment_number,
        sp.invoice_id,
        si.invoice_number,
        sp.customer_id,
        c.customer_code,
        c.customer_name,
        sp.payment_date,
        sp.amount,
        sp.payment_method,
        sp.account_id,
        coa.account_code,
        coa.account_name,
        sp.reference_number,
        sp.notes,
        sp.created_at
      FROM sales_payments sp
      INNER JOIN sales_invoices si
        ON si.invoice_id = sp.invoice_id
      INNER JOIN customers c
        ON c.customer_id = sp.customer_id
      LEFT JOIN chart_of_accounts coa
        ON coa.account_id = sp.account_id
      ORDER BY sp.payment_id DESC
    `);

    return NextResponse.json({
      success: true,
      payments: result.rows,
      accounts,
    });
  } catch (error) {
    console.error("SALES PAYMENTS GET ERROR:", error);

    return NextResponse.json(
      {
        success: false,
        message: "Failed to load sales payments.",
        error: error.message,
      },
      { status: 500 }
    );
  }
}

/* POST: Create a sales payment and accounting journal. */
export async function POST(request) {
  let client;
  let transactionStarted = false;

  try {
    const tenant = await getTenantContext();
    if (!tenant) return unauthorizedResponse();
    const { db, companyId } = tenant;
client = await db.connect();

    const body = await request.json();

    const {
  invoiceId,
  paymentDate,
  amount,
  paymentMethod,
  accountId,
  referenceNumber,
  notes,
} = body;

    if (!invoiceId) throw new Error("Invoice is required.");
    if (!accountId) throw new Error("Cash/Bank account is required.");

    const paymentAmount = Number(amount);

    if (!Number.isFinite(paymentAmount) || paymentAmount <= 0) {
      throw new Error("Payment amount must be greater than zero.");
    }

    await client.query("BEGIN");
    transactionStarted = true;

    const account = await validateCashBankAccount(client, accountId);

    const invoiceResult = await client.query(
      `
      SELECT
        si.invoice_id,
        si.invoice_number,
        si.customer_id,
        si.total_amount,
        si.paid_amount,
        si.balance_amount,
        c.customer_name
      FROM sales_invoices si
      INNER JOIN customers c
        ON c.customer_id = si.customer_id
      WHERE si.invoice_id = $1
      FOR UPDATE OF si
      `,
      [invoiceId]
    );

    if (!invoiceResult.rows.length) {
      throw new Error("Sales invoice not found.");
    }

    const invoice = invoiceResult.rows[0];
    const availableBalance = Number(invoice.balance_amount);

    if (paymentAmount > availableBalance) {
      throw new Error(
        `Payment cannot be greater than invoice balance. Remaining balance: ${availableBalance.toFixed(2)}`
      );
    }

    const finalPaymentNumber = await getNextSalesPaymentNumber(
  companyId,
  client
);

    const duplicate = await client.query(
      `
      SELECT payment_id
      FROM sales_payments
      WHERE payment_number = $1
      `,
      [finalPaymentNumber]
    );

    if (duplicate.rows.length) {
      throw new Error("Payment number already exists.");
    }

    const paymentResult = await client.query(
      `
      INSERT INTO sales_payments (
        payment_number,
        invoice_id,
        customer_id,
        payment_date,
        amount,
        payment_method,
        account_id,
        reference_number,
        notes
      )
      VALUES (
        $1, $2, $3,
        COALESCE($4::DATE, CURRENT_DATE),
        $5, $6, $7, $8, $9
      )
      RETURNING payment_id
      `,
      [
        finalPaymentNumber,
        invoiceId,
        invoice.customer_id,
        paymentDate || null,
        paymentAmount,
        paymentMethod || "CASH",
        account.account_id,
        referenceNumber || null,
        notes || null,
      ]
    );

    const paymentId = paymentResult.rows[0].payment_id;

    const receivableAccountId = await getInvoiceReceivableAccount(
      client,
      invoiceId
    );

    await postPaymentJournal(client, {
      paymentId,
      paymentNumber: finalPaymentNumber,
      paymentDate,
      paymentAmount,
      paymentAccountId: Number(account.account_id),
      receivableAccountId,
      customerId: invoice.customer_id,
      customerName: invoice.customer_name,
      invoiceNumber: invoice.invoice_number,
    });

    await recalculateInvoice(client, invoiceId);

    await client.query("COMMIT");
    transactionStarted = false;

    return NextResponse.json(
      {
        success: true,
        message: "Sales payment recorded successfully.",
        payment: await getPayment(db, paymentId),
      },
      { status: 201 }
    );
  } catch (error) {
    if (transactionStarted) {
      await client.query("ROLLBACK");
    }

    console.error("SALES PAYMENTS POST ERROR:", error);

    return NextResponse.json(
      {
        success: false,
        message: error.message || "Failed to record sales payment.",
      },
      { status: error.code === "23505" ? 409 : 400 }
    );
  } finally {
    client?.release();
  }
}

/* PUT: Edit a payment and replace its accounting posting. */
export async function PUT(request) {
  let client;
  let transactionStarted = false;

  try {
    const tenant = await getTenantContext();
    if (!tenant) return unauthorizedResponse();
    const { db } = tenant;
    client = await db.connect();

    const body = await request.json();

    const {
      paymentId,
      paymentNumber,
      invoiceId,
      paymentDate,
      amount,
      paymentMethod,
      accountId,
      referenceNumber,
      notes,
    } = body;

    if (!paymentId) throw new Error("Payment ID is required.");
    if (!invoiceId) throw new Error("Invoice is required.");
    if (!accountId) throw new Error("Cash/Bank account is required.");

    const newAmount = Number(amount);

    if (!Number.isFinite(newAmount) || newAmount <= 0) {
      throw new Error("Payment amount must be greater than zero.");
    }

    await client.query("BEGIN");
    transactionStarted = true;

    const oldPaymentResult = await client.query(
      `
      SELECT *
      FROM sales_payments
      WHERE payment_id = $1
      FOR UPDATE
      `,
      [paymentId]
    );

    if (!oldPaymentResult.rows.length) {
      throw new Error("Sales payment not found.");
    }

    const oldPayment = oldPaymentResult.rows[0];
    const oldInvoiceId = Number(oldPayment.invoice_id);
    const newInvoiceId = Number(invoiceId);

    const account = await validateCashBankAccount(client, accountId);

    // Lock both invoices in consistent ID order.
    const invoiceIds = [...new Set([oldInvoiceId, newInvoiceId])]
      .sort((a, b) => a - b);

    const lockedInvoices = {};

    for (const id of invoiceIds) {
      const result = await client.query(
        `
        SELECT
          si.invoice_id,
          si.invoice_number,
          si.customer_id,
          si.total_amount,
          si.paid_amount,
          si.balance_amount,
          c.customer_name
        FROM sales_invoices si
        INNER JOIN customers c
          ON c.customer_id = si.customer_id
        WHERE si.invoice_id = $1
        FOR UPDATE OF si
        `,
        [id]
      );

      if (!result.rows.length) {
        throw new Error(`Sales invoice ${id} not found.`);
      }

      lockedInvoices[id] = result.rows[0];
    }

    const oldInvoice = lockedInvoices[oldInvoiceId];
    const newInvoice = lockedInvoices[newInvoiceId];

    const finalPaymentNumber = oldPayment.payment_number;

    const duplicate = await client.query(
      `
      SELECT payment_id
      FROM sales_payments
      WHERE payment_number = $1
        AND payment_id <> $2
      `,
      [finalPaymentNumber, paymentId]
    );

    if (duplicate.rows.length) {
      throw new Error("Payment number already exists.");
    }

    const availableBalance =
      Number(newInvoice.balance_amount) +
      (oldInvoiceId === newInvoiceId
        ? Number(oldPayment.amount)
        : 0);

    if (newAmount > availableBalance) {
      throw new Error(
        `Payment cannot be greater than the available invoice balance. Maximum allowed: ${availableBalance.toFixed(2)}`
      );
    }

    await client.query(
      `
      UPDATE sales_payments
      SET
        payment_number = $1,
        invoice_id = $2,
        customer_id = $3,
        payment_date = COALESCE($4::DATE, CURRENT_DATE),
        amount = $5,
        payment_method = $6,
        account_id = $7,
        reference_number = $8,
        notes = $9
      WHERE payment_id = $10
      `,
      [
        finalPaymentNumber,
        newInvoiceId,
        newInvoice.customer_id,
        paymentDate || null,
        newAmount,
        paymentMethod || "CASH",
        account.account_id,
        referenceNumber || null,
        notes || null,
        paymentId,
      ]
    );

    const receivableAccountId = await getInvoiceReceivableAccount(
      client,
      newInvoiceId
    );

    await postPaymentJournal(client, {
      paymentId,
      paymentNumber: finalPaymentNumber,
      paymentDate,
      paymentAmount: newAmount,
      paymentAccountId: Number(account.account_id),
      receivableAccountId,
      customerId: newInvoice.customer_id,
      customerName: newInvoice.customer_name,
      invoiceNumber: newInvoice.invoice_number,
    });

    await recalculateInvoice(client, oldInvoiceId);

    if (newInvoiceId !== oldInvoiceId) {
      await recalculateInvoice(client, newInvoiceId);
    }

    await client.query("COMMIT");
    transactionStarted = false;

    return NextResponse.json({
      success: true,
      message: "Sales payment updated successfully.",
      payment: await getPayment(db, paymentId),
    });
  } catch (error) {
    if (transactionStarted) {
      await client.query("ROLLBACK");
    }

    console.error("SALES PAYMENTS PUT ERROR:", error);

    return NextResponse.json(
      {
        success: false,
        message: error.message || "Failed to update sales payment.",
      },
      { status: error.code === "23505" ? 409 : 400 }
    );
  } finally {
    client?.release();
  }
}
