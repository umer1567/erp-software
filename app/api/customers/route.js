import { NextResponse } from "next/server";
import pool from "@/lib/db";

export async function GET() {
  try {
    const result = await pool.query(`
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

        COALESCE(
          (
            SELECT SUM(si.total_amount)
            FROM sales_invoices si
            WHERE si.customer_id = c.customer_id
          ),
          0
        ) AS total_sales,

        COALESCE(
          (
            SELECT SUM(sp.amount)
            FROM sales_payments sp
            WHERE sp.customer_id = c.customer_id
          ),
          0
        ) AS total_paid,

        (
          c.opening_balance
          +
          COALESCE(
            (
              SELECT SUM(si.total_amount)
              FROM sales_invoices si
              WHERE si.customer_id = c.customer_id
            ),
            0
          )
          -
          COALESCE(
            (
              SELECT SUM(sp.amount)
              FROM sales_payments sp
              WHERE sp.customer_id = c.customer_id
            ),
            0
          )
        ) AS customer_balance

      FROM customers c
      ORDER BY c.customer_id DESC
    `);

    return NextResponse.json({
      success: true,
      customers: result.rows,
    });
  } catch (error) {
    console.error("CUSTOMERS GET ERROR:", error);

    return NextResponse.json(
      {
        success: false,
        message: "Failed to load customers.",
        error: error.message,
      },
      { status: 500 }
    );
  }
}

export async function POST(request) {
  try {
    const body = await request.json();

    const {
      customerCode,
      customerName,
      phone,
      email,
      address,
      openingBalance,
      creditLimit,
      isActive,
    } = body;

    if (!customerCode || !customerName) {
      return NextResponse.json(
        {
          success: false,
          message: "Customer code and customer name are required.",
        },
        { status: 400 }
      );
    }

    const result = await pool.query(
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
        phone?.trim() || null,
        email?.trim() || null,
        address?.trim() || null,
        Number(openingBalance) || 0,
        Number(creditLimit) || 0,
        isActive !== false,
      ]
    );

    return NextResponse.json(
      {
        success: true,
        message: "Customer created successfully.",
        customer: result.rows[0],
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("CUSTOMERS POST ERROR:", error);

    if (error.code === "23505") {
      return NextResponse.json(
        {
          success: false,
          message: "Customer code already exists.",
        },
        { status: 409 }
      );
    }

    return NextResponse.json(
      {
        success: false,
        message: "Failed to create customer.",
        error: error.message,
      },
      { status: 500 }
    );
  }
}