import { NextResponse } from "next/server";
import pool from "@/lib/db";

/*
  GET
  /api/sales-payments
      -> return all payments

  /api/sales-payments?paymentId=1
      -> return one payment
*/
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const paymentId = searchParams.get("paymentId");

    let query = `
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
        sp.reference_number,
        sp.notes,
        sp.created_at
      FROM sales_payments sp
      INNER JOIN sales_invoices si
        ON si.invoice_id = sp.invoice_id
      INNER JOIN customers c
        ON c.customer_id = sp.customer_id
    `;

    const values = [];

    if (paymentId) {
      query += `
        WHERE sp.payment_id = $1
      `;

      values.push(paymentId);
    }

    query += `
      ORDER BY sp.payment_id DESC
    `;

    const result = await pool.query(query, values);

    if (paymentId) {
      if (result.rows.length === 0) {
        return NextResponse.json(
          {
            success: false,
            message: "Payment not found.",
          },
          { status: 404 }
        );
      }

      return NextResponse.json({
        success: true,
        payment: result.rows[0],
      });
    }

    return NextResponse.json({
      success: true,
      payments: result.rows,
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


/*
  POST
  Create new sales payment
*/
export async function POST(request) {
  const client = await pool.connect();

  try {
    const body = await request.json();

    const {
      paymentNumber,
      invoiceId,
      paymentDate,
      amount,
      paymentMethod,
      referenceNumber,
      notes,
    } = body;

    if (!invoiceId) {
      return NextResponse.json(
        {
          success: false,
          message: "Invoice is required.",
        },
        { status: 400 }
      );
    }

    const paymentAmount = Number(amount);

    if (!paymentAmount || paymentAmount <= 0) {
      return NextResponse.json(
        {
          success: false,
          message: "Payment amount must be greater than zero.",
        },
        { status: 400 }
      );
    }

    await client.query("BEGIN");

    // Lock invoice
    const invoiceResult = await client.query(
      `
      SELECT
        invoice_id,
        customer_id,
        total_amount,
        paid_amount,
        balance_amount
      FROM sales_invoices
      WHERE invoice_id = $1
      FOR UPDATE
      `,
      [invoiceId]
    );

    if (invoiceResult.rows.length === 0) {
      throw new Error("Sales invoice not found.");
    }

    const invoice = invoiceResult.rows[0];

    const balanceAmount = Number(invoice.balance_amount);

    if (paymentAmount > balanceAmount) {
      throw new Error(
        `Payment cannot be greater than invoice balance. Remaining balance: ${balanceAmount.toFixed(
          2
        )}`
      );
    }

    let finalPaymentNumber = paymentNumber?.trim();

    if (!finalPaymentNumber) {
      finalPaymentNumber = `PAY-${Date.now()}`;
    }

    const existingPayment = await client.query(
      `
      SELECT payment_id
      FROM sales_payments
      WHERE payment_number = $1
      `,
      [finalPaymentNumber]
    );

    if (existingPayment.rows.length > 0) {
      throw new Error("Payment number already exists.");
    }

    // Insert payment
    const paymentResult = await client.query(
      `
      INSERT INTO sales_payments (
        payment_number,
        invoice_id,
        customer_id,
        payment_date,
        amount,
        payment_method,
        reference_number,
        notes
      )
      VALUES (
        $1,
        $2,
        $3,
        COALESCE($4::DATE, CURRENT_DATE),
        $5,
        $6,
        $7,
        $8
      )
      RETURNING *
      `,
      [
        finalPaymentNumber,
        invoiceId,
        invoice.customer_id,
        paymentDate || null,
        paymentAmount,
        paymentMethod || "CASH",
        referenceNumber || null,
        notes || null,
      ]
    );

    const newPaidAmount =
      Number(invoice.paid_amount) + paymentAmount;

    const newBalance =
      Number(invoice.total_amount) - newPaidAmount;

    let status = "PARTIAL";

    if (newBalance <= 0) {
      status = "PAID";
    } else if (newPaidAmount <= 0) {
      status = "UNPAID";
    }

    await client.query(
      `
      UPDATE sales_invoices
      SET
        paid_amount = $1,
        balance_amount = $2,
        status = $3,
        updated_at = CURRENT_TIMESTAMP
      WHERE invoice_id = $4
      `,
      [
        newPaidAmount,
        Math.max(newBalance, 0),
        status,
        invoiceId,
      ]
    );

    await client.query("COMMIT");

    return NextResponse.json(
      {
        success: true,
        message: "Sales payment recorded successfully.",
        payment: paymentResult.rows[0],
      },
      { status: 201 }
    );
  } catch (error) {
    await client.query("ROLLBACK");

    console.error("SALES PAYMENTS POST ERROR:", error);

    if (error.code === "23505") {
      return NextResponse.json(
        {
          success: false,
          message: "Payment number already exists.",
        },
        { status: 409 }
      );
    }

    return NextResponse.json(
      {
        success: false,
        message:
          error.message || "Failed to record sales payment.",
      },
      { status: 500 }
    );
  } finally {
    client.release();
  }
}


/*
  PUT
  Edit existing sales payment
*/
export async function PUT(request) {
  const client = await pool.connect();

  try {
    const body = await request.json();

    const {
      paymentId,
      paymentNumber,
      invoiceId,
      paymentDate,
      amount,
      paymentMethod,
      referenceNumber,
      notes,
    } = body;

    if (!paymentId) {
      return NextResponse.json(
        {
          success: false,
          message: "Payment ID is required.",
        },
        { status: 400 }
      );
    }

    if (!invoiceId) {
      return NextResponse.json(
        {
          success: false,
          message: "Invoice is required.",
        },
        { status: 400 }
      );
    }

    const newPaymentAmount = Number(amount);

    if (!newPaymentAmount || newPaymentAmount <= 0) {
      return NextResponse.json(
        {
          success: false,
          message: "Payment amount must be greater than zero.",
        },
        { status: 400 }
      );
    }

    await client.query("BEGIN");

    /*
      Get the existing payment.
      Lock it so another transaction cannot modify it
      at the same time.
    */
    const oldPaymentResult = await client.query(
      `
      SELECT
        payment_id,
        payment_number,
        invoice_id,
        customer_id,
        payment_date,
        amount,
        payment_method,
        reference_number,
        notes
      FROM sales_payments
      WHERE payment_id = $1
      FOR UPDATE
      `,
      [paymentId]
    );

    if (oldPaymentResult.rows.length === 0) {
      throw new Error("Sales payment not found.");
    }

    const oldPayment = oldPaymentResult.rows[0];

    /*
      For this ERP, editing a payment to another invoice
      is allowed, but both old and new invoices are recalculated.
    */

    const oldInvoiceId = oldPayment.invoice_id;

    /*
      Lock the old invoice.
    */
    const oldInvoiceResult = await client.query(
      `
      SELECT
        invoice_id,
        customer_id,
        total_amount,
        paid_amount,
        balance_amount
      FROM sales_invoices
      WHERE invoice_id = $1
      FOR UPDATE
      `,
      [oldInvoiceId]
    );

    if (oldInvoiceResult.rows.length === 0) {
      throw new Error("Original sales invoice not found.");
    }

    const oldInvoice = oldInvoiceResult.rows[0];

    /*
      Lock the new invoice.
      If the invoice is the same, use the already locked invoice.
    */
    let newInvoice = oldInvoice;

    if (Number(invoiceId) !== Number(oldInvoiceId)) {
      const newInvoiceResult = await client.query(
        `
        SELECT
          invoice_id,
          customer_id,
          total_amount,
          paid_amount,
          balance_amount
        FROM sales_invoices
        WHERE invoice_id = $1
        FOR UPDATE
        `,
        [invoiceId]
      );

      if (newInvoiceResult.rows.length === 0) {
        throw new Error("New sales invoice not found.");
      }

      newInvoice = newInvoiceResult.rows[0];
    }

    /*
      Check payment number uniqueness.
      Ignore the current payment itself.
    */
    let finalPaymentNumber = paymentNumber?.trim();

    if (!finalPaymentNumber) {
      finalPaymentNumber = oldPayment.payment_number;
    }

    const duplicatePayment = await client.query(
      `
      SELECT payment_id
      FROM sales_payments
      WHERE payment_number = $1
        AND payment_id <> $2
      `,
      [finalPaymentNumber, paymentId]
    );

    if (duplicatePayment.rows.length > 0) {
      throw new Error("Payment number already exists.");
    }

    /*
      Calculate available balance for the NEW invoice.

      If editing the same invoice:
        Available balance =
        current balance + old payment amount

      Example:
        Invoice = 1000
        Existing payment = 300
        Current balance = 700

        While editing that 300 payment,
        available balance becomes 700 + 300 = 1000.
    */
    if (Number(invoiceId) === Number(oldInvoiceId)) {
      const availableBalance =
        Number(oldInvoice.balance_amount) +
        Number(oldPayment.amount);

      if (newPaymentAmount > availableBalance) {
        throw new Error(
          `Payment cannot be greater than invoice balance. Maximum allowed: ${availableBalance.toFixed(
            2
          )}`
        );
      }
    } else {
      /*
        If moving payment to another invoice,
        the old payment is removed from the old invoice,
        so the full current balance of the new invoice
        is available.
      */
      const availableBalance =
        Number(newInvoice.balance_amount);

      if (newPaymentAmount > availableBalance) {
        throw new Error(
          `Payment cannot be greater than new invoice balance. Remaining balance: ${availableBalance.toFixed(
            2
          )}`
        );
      }
    }

    /*
      Update payment.
    */
    const updatedPaymentResult = await client.query(
      `
      UPDATE sales_payments
      SET
        payment_number = $1,
        invoice_id = $2,
        customer_id = $3,
        payment_date = COALESCE($4::DATE, CURRENT_DATE),
        amount = $5,
        payment_method = $6,
        reference_number = $7,
        notes = $8
      WHERE payment_id = $9
      RETURNING *
      `,
      [
        finalPaymentNumber,
        invoiceId,
        newInvoice.customer_id,
        paymentDate || null,
        newPaymentAmount,
        paymentMethod || "CASH",
        referenceNumber || null,
        notes || null,
        paymentId,
      ]
    );

    /*
      Recalculate OLD invoice.
    */
    const oldInvoicePaymentsResult = await client.query(
      `
      SELECT COALESCE(SUM(amount), 0) AS total_paid
      FROM sales_payments
      WHERE invoice_id = $1
      `,
      [oldInvoiceId]
    );

    const oldPaidAmount = Number(
      oldInvoicePaymentsResult.rows[0].total_paid
    );

    const oldBalance =
      Number(oldInvoice.total_amount) - oldPaidAmount;

    let oldStatus = "PARTIAL";

    if (oldBalance <= 0) {
      oldStatus = "PAID";
    } else if (oldPaidAmount <= 0) {
      oldStatus = "UNPAID";
    }

    await client.query(
      `
      UPDATE sales_invoices
      SET
        paid_amount = $1,
        balance_amount = $2,
        status = $3,
        updated_at = CURRENT_TIMESTAMP
      WHERE invoice_id = $4
      `,
      [
        oldPaidAmount,
        Math.max(oldBalance, 0),
        oldStatus,
        oldInvoiceId,
      ]
    );

    /*
      If payment was moved to another invoice,
      recalculate the NEW invoice too.
    */
    if (Number(invoiceId) !== Number(oldInvoiceId)) {
      const newInvoicePaymentsResult = await client.query(
        `
        SELECT COALESCE(SUM(amount), 0) AS total_paid
        FROM sales_payments
        WHERE invoice_id = $1
        `,
        [invoiceId]
      );

      const newPaidAmount = Number(
        newInvoicePaymentsResult.rows[0].total_paid
      );

      const newBalance =
        Number(newInvoice.total_amount) - newPaidAmount;

      let newStatus = "PARTIAL";

      if (newBalance <= 0) {
        newStatus = "PAID";
      } else if (newPaidAmount <= 0) {
        newStatus = "UNPAID";
      }

      await client.query(
        `
        UPDATE sales_invoices
        SET
          paid_amount = $1,
          balance_amount = $2,
          status = $3,
          updated_at = CURRENT_TIMESTAMP
        WHERE invoice_id = $4
        `,
        [
          newPaidAmount,
          Math.max(newBalance, 0),
          newStatus,
          invoiceId,
        ]
      );
    }

    await client.query("COMMIT");

    /*
      Return the updated payment with invoice/customer information,
      so the frontend can immediately display the receipt.
    */
    const finalPaymentResult = await pool.query(
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
        sp.reference_number,
        sp.notes,
        sp.created_at
      FROM sales_payments sp
      INNER JOIN sales_invoices si
        ON si.invoice_id = sp.invoice_id
      INNER JOIN customers c
        ON c.customer_id = sp.customer_id
      WHERE sp.payment_id = $1
      `,
      [paymentId]
    );

    return NextResponse.json({
      success: true,
      message: "Sales payment updated successfully.",
      payment: finalPaymentResult.rows[0],
    });
  } catch (error) {
    await client.query("ROLLBACK");

    console.error("SALES PAYMENTS PUT ERROR:", error);

    if (error.code === "23505") {
      return NextResponse.json(
        {
          success: false,
          message: "Payment number already exists.",
        },
        { status: 409 }
      );
    }

    return NextResponse.json(
      {
        success: false,
        message:
          error.message || "Failed to update sales payment.",
      },
      { status: 500 }
    );
  } finally {
    client.release();
  }
}