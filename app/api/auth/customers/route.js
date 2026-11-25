
import { NextResponse } from "next/server";
import { getTenantContext, unauthorizedResponse } from "@/lib/tenant";
import { hasPermission } from "@/lib/permissions";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const PERMISSION_KEY = "customers";

function errorResponse(message, status) {
  return NextResponse.json(
    { success: false, message },
    {
      status,
      headers: { "Cache-Control": "no-store" },
    }
  );
}

async function authorize(action) {
  const tenant = await getTenantContext();

  if (!tenant) {
    return {
      tenant: null,
      response: unauthorizedResponse(),
    };
  }

  const roleId = tenant.user?.roleId ?? tenant.user?.role_id;

  if (!Number.isInteger(Number(roleId)) || Number(roleId) <= 0) {
    return {
      tenant: null,
      response: errorResponse("Your account does not have a valid role.", 403),
    };
  }

  const allowed = await hasPermission(
    Number(roleId),
    PERMISSION_KEY,
    action
  );

  if (!allowed) {
    return {
      tenant: null,
      response: errorResponse(
        `You do not have permission to ${action} customers.`,
        403
      ),
    };
  }

  return { tenant, response: null };
}

// GET: Active customers only
export async function GET() {
  try {
    const { tenant, response } = await authorize("view");
    if (response) return response;

    const result = await tenant.db.query(`
      SELECT
        c.customer_id,
        c.customer_code,
        c.customer_name,
        c.phone,
        c.email,
        c.address,
        c.opening_balance,
        c.credit_limit,
        c.is_active,
        c.created_at,
        c.updated_at,

        COALESCE((
          SELECT SUM(si.total_amount)
          FROM sales_invoices si
          WHERE si.customer_id = c.customer_id
        ), 0) AS total_sales,

        COALESCE((
          SELECT SUM(sp.amount)
          FROM sales_payments sp
          WHERE sp.customer_id = c.customer_id
        ), 0) AS total_paid,

        (
          COALESCE(c.opening_balance, 0)
          + COALESCE((
              SELECT SUM(si.total_amount)
              FROM sales_invoices si
              WHERE si.customer_id = c.customer_id
            ), 0)
          - COALESCE((
              SELECT SUM(sp.amount)
              FROM sales_payments sp
              WHERE sp.customer_id = c.customer_id
            ), 0)
        ) AS customer_balance

      FROM customers c
      WHERE c.deleted_at IS NULL
      ORDER BY c.customer_id DESC
    `);

    return NextResponse.json(result.rows, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    console.error("GET CUSTOMERS ERROR:", error);
    return errorResponse(
      "An unexpected error occurred while loading customers.",
      500
    );
  }
}

// POST: Create customer
export async function POST(request) {
  try {
    const { tenant, response } = await authorize("create");
    if (response) return response;

    const body = await request.json();

    const {
      customerCode,
      customerName,
      phone,
      email,
      address,
      openingBalance = 0,
      creditLimit = 0,
      isActive = true,
    } = body;

    if (!customerCode?.trim() || !customerName?.trim()) {
      return errorResponse(
        "Customer code and customer name are required.",
        400
      );
    }

    const result = await tenant.db.query(
      `
        INSERT INTO customers (
          customer_code,
          customer_name,
          phone,
          email,
          address,
          opening_balance,
          credit_limit,
          is_active
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING *
      `,
      [
        customerCode.trim(),
        customerName.trim(),
        phone || null,
        email || null,
        address || null,
        Number(openingBalance) || 0,
        Number(creditLimit) || 0,
        isActive !== false,
      ]
    );

    return NextResponse.json(
      {
        success: true,
        customer: result.rows[0],
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("POST CUSTOMERS ERROR:", error);

    if (error.code === "23505") {
      return errorResponse("Customer code already exists.", 409);
    }

    return errorResponse(
      "An unexpected error occurred while creating the customer.",
      500
    );
  }
}
