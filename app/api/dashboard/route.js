
import { NextResponse } from "next/server";
import pool from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { hasPermission } from "@/lib/permissions";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const runtime = "nodejs";

function jsonResponse(data, status = 200) {
  return NextResponse.json(data, {
    status,
    headers: {
      "Cache-Control": "no-store, no-cache, must-revalidate",
    },
  });
}

export async function GET() {
  let client;

  try {
    const user = await getCurrentUser();

    if (!user) {
      return jsonResponse(
        { success: false, message: "Authentication required." },
        401
      );
    }

    const roleId = Number(user.roleId ?? user.role_id);

    if (!Number.isInteger(roleId) || roleId <= 0) {
      return jsonResponse(
        { success: false, message: "Your account does not have a valid role." },
        403
      );
    }

    // ADMIN must also have dashboard -> View enabled.
    const canViewDashboard = await hasPermission(
      roleId,
      "dashboard",
      "view"
    );

    if (canViewDashboard !== true) {
      return jsonResponse(
        {
          success: false,
          message: "You do not have permission to view dashboard analytics.",
        },
        403
      );
    }

    client = await pool.connect();

    const [
      salesResult,
      purchasesResult,
      salesPaymentsResult,
      purchasePaymentsResult,
      invoiceStatusResult,
      monthlyResult,
    ] = await Promise.all([
      client.query(`
        SELECT
          COUNT(*)::int AS total_invoices,
          COALESCE(SUM(total_amount), 0)::numeric AS total_sales,
          COALESCE(SUM(paid_amount), 0)::numeric AS sales_received,
          COALESCE(SUM(balance_amount), 0)::numeric AS sales_outstanding
        FROM sales_invoices
      `),

      client.query(`
        SELECT
          COUNT(*)::int AS total_purchases,
          COALESCE(SUM(total_amount), 0)::numeric AS total_purchases_amount,
          COALESCE(SUM(paid_amount), 0)::numeric AS purchases_paid,
          COALESCE(SUM(balance_amount), 0)::numeric AS purchases_outstanding
        FROM purchases
      `),

      client.query(`
        SELECT COALESCE(SUM(amount), 0)::numeric AS total
        FROM sales_payments
      `),

      client.query(`
        SELECT COALESCE(SUM(amount), 0)::numeric AS total
        FROM purchase_payments
      `),

      client.query(`
        SELECT
          CASE
            WHEN COALESCE(balance_amount, 0) <= 0 THEN 'Paid'
            WHEN COALESCE(paid_amount, 0) > 0 THEN 'Partial'
            ELSE 'Unpaid'
          END AS payment_status,
          COUNT(*)::int AS count
        FROM sales_invoices
        GROUP BY 1
      `),

      client.query(`
        WITH months AS (
          SELECT generate_series(
            date_trunc('month', CURRENT_DATE) - INTERVAL '5 months',
            date_trunc('month', CURRENT_DATE),
            INTERVAL '1 month'
          ) AS month_start
        ),
        sales AS (
          SELECT
            date_trunc('month', invoice_date) AS month_start,
            SUM(total_amount) AS amount
          FROM sales_invoices
          WHERE invoice_date >=
            date_trunc('month', CURRENT_DATE) - INTERVAL '5 months'
          GROUP BY 1
        ),
        purchases AS (
          SELECT
            date_trunc('month', purchase_date) AS month_start,
            SUM(total_amount) AS amount
          FROM purchases
          WHERE purchase_date >=
            date_trunc('month', CURRENT_DATE) - INTERVAL '5 months'
          GROUP BY 1
        )
        SELECT
          TO_CHAR(months.month_start, 'Mon') AS month,
          COALESCE(sales.amount, 0)::numeric AS sales,
          COALESCE(purchases.amount, 0)::numeric AS purchases
        FROM months
        LEFT JOIN sales USING (month_start)
        LEFT JOIN purchases USING (month_start)
        ORDER BY months.month_start
      `),
    ]);

    return jsonResponse({
      success: true,
      summary: {
        ...salesResult.rows[0],
        ...purchasesResult.rows[0],
        sales_payments: salesPaymentsResult.rows[0].total,
        purchase_payments: purchasePaymentsResult.rows[0].total,
      },
      invoiceStatus: invoiceStatusResult.rows,
      monthly: monthlyResult.rows,
    });
  } catch (error) {
    console.error("DASHBOARD API ERROR:", error);

    return jsonResponse(
      {
        success: false,
        message: "Unable to load dashboard data. Check the server logs.",
      },
      500
    );
  } finally {
    client?.release();
  }
}
