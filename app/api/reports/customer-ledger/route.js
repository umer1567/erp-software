import { NextResponse } from "next/server";
import pool from "@/lib/db";

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);

    const fromDate = searchParams.get("fromDate");
    const toDate = searchParams.get("toDate");
    const customerId = searchParams.get("customerId");

    // ---------------------------------------------------------
    // VALIDATION
    // ---------------------------------------------------------

    if (!fromDate) {
      return NextResponse.json(
        {
          success: false,
          message: "From Date is required.",
        },
        { status: 400 }
      );
    }

    if (!toDate) {
      return NextResponse.json(
        {
          success: false,
          message: "To Date is required.",
        },
        { status: 400 }
      );
    }

    if (!customerId) {
      return NextResponse.json(
        {
          success: false,
          message: "Please select a customer.",
        },
        { status: 400 }
      );
    }

    if (fromDate > toDate) {
      return NextResponse.json(
        {
          success: false,
          message: "From Date cannot be greater than To Date.",
        },
        { status: 400 }
      );
    }

    // ---------------------------------------------------------
    // GET CUSTOMER
    // ---------------------------------------------------------

    const customerResult = await pool.query(
      `
      SELECT
        customer_id,
        customer_code,
        customer_name,
        opening_balance
      FROM customers
      WHERE customer_id = $1
      `,
      [customerId]
    );

    if (customerResult.rows.length === 0) {
      return NextResponse.json(
        {
          success: false,
          message: "Customer not found.",
        },
        { status: 404 }
      );
    }

    const customer = customerResult.rows[0];

    // ---------------------------------------------------------
    // OPENING BALANCE BEFORE FROM DATE
    //
    // Opening Balance
    // + Previous Invoices
    // - Previous Payments
    // ---------------------------------------------------------

    const openingResult = await pool.query(
      `
      SELECT
        COALESCE(c.opening_balance, 0)
        +
        COALESCE(
          (
            SELECT SUM(si.total_amount)
            FROM sales_invoices si
            WHERE si.customer_id = c.customer_id
              AND si.invoice_date < $1
          ),
          0
        )
        -
        COALESCE(
          (
            SELECT SUM(sp.amount)
            FROM sales_payments sp
            WHERE sp.customer_id = c.customer_id
              AND sp.payment_date < $1
          ),
          0
        ) AS opening_balance
      FROM customers c
      WHERE c.customer_id = $2
      `,
      [fromDate, customerId]
    );

    let runningBalance = Number(
      openingResult.rows[0]?.opening_balance || 0
    );

    // ---------------------------------------------------------
    // GET INVOICES
    // ---------------------------------------------------------

    const invoiceResult = await pool.query(
      `
      SELECT
        invoice_id,
        invoice_number,
        invoice_date,
        total_amount,
        notes
      FROM sales_invoices
      WHERE customer_id = $1
        AND invoice_date >= $2
        AND invoice_date <= $3
      ORDER BY
        invoice_date ASC,
        invoice_id ASC
      `,
      [customerId, fromDate, toDate]
    );

    // ---------------------------------------------------------
    // GET PAYMENTS
    // ---------------------------------------------------------

    const paymentResult = await pool.query(
      `
      SELECT
        payment_id,
        payment_number,
        payment_date,
        amount,
        payment_method,
        reference_number,
        notes
      FROM sales_payments
      WHERE customer_id = $1
        AND payment_date >= $2
        AND payment_date <= $3
      ORDER BY
        payment_date ASC,
        payment_id ASC
      `,
      [customerId, fromDate, toDate]
    );

    // ---------------------------------------------------------
    // COMBINE TRANSACTIONS
    // ---------------------------------------------------------

    const transactions = [];

    // Invoices = DEBIT

    invoiceResult.rows.forEach((invoice) => {
      transactions.push({
        transaction_date: invoice.invoice_date,
        transaction_number: invoice.invoice_number,
        reference_no: "",
        memo: invoice.notes || "Sales Invoice",
        debit: Number(invoice.total_amount || 0),
        credit: 0,
        transaction_type: "INVOICE",
        transaction_id: invoice.invoice_id,
      });
    });

    // Payments = CREDIT

    paymentResult.rows.forEach((payment) => {
      transactions.push({
        transaction_date: payment.payment_date,
        transaction_number: payment.payment_number,
        reference_no: payment.reference_number || "",
        memo:
          payment.notes ||
          payment.payment_method ||
          "Customer Payment",
        debit: 0,
        credit: Number(payment.amount || 0),
        transaction_type: "PAYMENT",
        transaction_id: payment.payment_id,
      });
    });

    // ---------------------------------------------------------
    // SORT TRANSACTIONS
    // ---------------------------------------------------------

    transactions.sort((a, b) => {
      const dateA = new Date(a.transaction_date);
      const dateB = new Date(b.transaction_date);

      if (dateA.getTime() !== dateB.getTime()) {
        return dateA.getTime() - dateB.getTime();
      }

      return Number(a.transaction_id) - Number(b.transaction_id);
    });

    // ---------------------------------------------------------
    // RUNNING BALANCE
    //
    // Debit  = +
    // Credit = -
    // ---------------------------------------------------------

    const ledger = transactions.map((transaction) => {
      runningBalance =
        runningBalance +
        Number(transaction.debit || 0) -
        Number(transaction.credit || 0);

      return {
        ...transaction,
        running_total: runningBalance,
      };
    });

    // ---------------------------------------------------------
    // TOTALS
    // ---------------------------------------------------------

    const totalDebit = ledger.reduce(
      (sum, row) => sum + Number(row.debit || 0),
      0
    );

    const totalCredit = ledger.reduce(
      (sum, row) => sum + Number(row.credit || 0),
      0
    );

    // ---------------------------------------------------------
    // RESPONSE
    // ---------------------------------------------------------

    return NextResponse.json({
      success: true,

      customer: {
        customer_id: customer.customer_id,
        customer_code: customer.customer_code,
        customer_name: customer.customer_name,
      },

      from_date: fromDate,
      to_date: toDate,

      opening_balance: Number(
        openingResult.rows[0]?.opening_balance || 0
      ),

      total_debit: totalDebit,
      total_credit: totalCredit,

      closing_balance: runningBalance,

      ledger,
    });
  } catch (error) {
    console.error("CUSTOMER LEDGER ERROR:", error);

    return NextResponse.json(
      {
        success: false,
        message: "Failed to generate customer ledger.",
        error: error.message,
      },
      { status: 500 }
    );
  }
}