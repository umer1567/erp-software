import { NextResponse } from "next/server";
import pool from "@/lib/db";

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);

    const supplierId = searchParams.get("supplierId");
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");

    // Load suppliers for the dropdown.
    const suppliersResult = await pool.query(`
      SELECT supplier_id, supplier_code, supplier_name, opening_balance
      FROM suppliers
      ORDER BY supplier_name ASC
    `);

    if (!supplierId) {
      return NextResponse.json({
        success: true,
        suppliers: suppliersResult.rows,
        transactions: [],
        summary: null,
      });
    }

    if (!/^\d+$/.test(supplierId)) {
      return NextResponse.json(
        { success: false, message: "Invalid supplier selected." },
        { status: 400 }
      );
    }

    const supplierResult = await pool.query(
      `SELECT supplier_id, supplier_code, supplier_name, opening_balance
       FROM suppliers
       WHERE supplier_id = $1`,
      [Number(supplierId)]
    );

    if (supplierResult.rows.length === 0) {
      return NextResponse.json(
        { success: false, message: "Supplier not found." },
        { status: 404 }
      );
    }

    if (
      (startDate && !/^\d{4}-\d{2}-\d{2}$/.test(startDate)) ||
      (endDate && !/^\d{4}-\d{2}-\d{2}$/.test(endDate))
    ) {
      return NextResponse.json(
        { success: false, message: "Invalid date format." },
        { status: 400 }
      );
    }

    if (startDate && endDate && startDate > endDate) {
      return NextResponse.json(
        { success: false, message: "Start date cannot be after end date." },
        { status: 400 }
      );
    }

    const supplier = supplierResult.rows[0];

    // Opening balance for the selected period:
    // supplier opening balance + earlier purchases - earlier payments.
    const openingResult = await pool.query(
      `
      SELECT
        COALESCE((
          SELECT SUM(p.total_amount)
          FROM purchases p
          WHERE p.supplier_id = $1
            AND ($2::date IS NULL OR p.purchase_date < $2::date)
        ), 0) AS previous_purchases,

        COALESCE((
          SELECT SUM(pp.amount)
          FROM purchase_payments pp
          WHERE pp.supplier_id = $1
            AND ($2::date IS NULL OR pp.payment_date < $2::date)
        ), 0) AS previous_payments
      `,
      [Number(supplierId), startDate || null]
    );

    const previousPurchases = Number(
      openingResult.rows[0].previous_purchases || 0
    );
    const previousPayments = Number(
      openingResult.rows[0].previous_payments || 0
    );

    const openingBalance =
      Number(supplier.opening_balance || 0) +
      previousPurchases -
      previousPayments;

    // Get purchases and payments for the selected date range.
    const transactionsResult = await pool.query(
      `
      SELECT *
      FROM (
        SELECT
          p.purchase_date AS transaction_date,
          p.purchase_number AS reference,
          'Purchase' AS transaction_type,
          COALESCE(p.total_amount, 0)::numeric AS debit,
          0::numeric AS credit,
          p.purchase_id AS transaction_id,
          1 AS sort_order
        FROM purchases p
        WHERE p.supplier_id = $1
          AND ($2::date IS NULL OR p.purchase_date >= $2::date)
          AND ($3::date IS NULL OR p.purchase_date <= $3::date)

        UNION ALL

        SELECT
          pp.payment_date AS transaction_date,
          pp.payment_number AS reference,
          'Payment' AS transaction_type,
          0::numeric AS debit,
          COALESCE(pp.amount, 0)::numeric AS credit,
          pp.payment_id AS transaction_id,
          2 AS sort_order
        FROM purchase_payments pp
        WHERE pp.supplier_id = $1
          AND ($2::date IS NULL OR pp.payment_date >= $2::date)
          AND ($3::date IS NULL OR pp.payment_date <= $3::date)
      ) ledger
      ORDER BY transaction_date ASC, sort_order ASC, transaction_id ASC
      `,
      [Number(supplierId), startDate || null, endDate || null]
    );

    let runningBalance = openingBalance;

    const transactions = transactionsResult.rows.map((row) => {
      const debit = Number(row.debit || 0);
      const credit = Number(row.credit || 0);

      runningBalance += debit - credit;

      return {
        ...row,
        debit,
        credit,
        balance: runningBalance,
      };
    });

    const totalPurchases = transactions.reduce(
      (sum, row) => sum + row.debit,
      0
    );

    const totalPayments = transactions.reduce(
      (sum, row) => sum + row.credit,
      0
    );

    return NextResponse.json({
      success: true,
      suppliers: suppliersResult.rows,
      supplier,
      openingBalance,
      transactions,
      summary: {
        totalPurchases,
        totalPayments,
        closingBalance: runningBalance,
      },
    });
  } catch (error) {
    console.error("SUPPLIER LEDGER API ERROR:", error);

    return NextResponse.json(
      { success: false, message: "Failed to load supplier ledger." },
      { status: 500 }
    );
  }
}