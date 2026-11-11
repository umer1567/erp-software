import { NextResponse } from "next/server";
import pool from "@/lib/db";

export async function PUT(request, { params }) {
  try {
    const { id } = await params;
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
      UPDATE customers
      SET
        customer_code = $1,
        customer_name = $2,
        phone = $3,
        email = $4,
        address = $5,
        opening_balance = $6,
        credit_limit = $7,
        is_active = $8,
        updated_at = CURRENT_TIMESTAMP
      WHERE customer_id = $9
      RETURNING *
      `,
      [
        customerCode,
        customerName,
        phone || null,
        email || null,
        address || null,
        Number(openingBalance) || 0,
        Number(creditLimit) || 0,
        isActive !== false,
        id,
      ]
    );

    if (result.rows.length === 0) {
      return NextResponse.json(
        {
          success: false,
          message: "Customer not found.",
        },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Customer updated successfully.",
      customer: result.rows[0],
    });
  } catch (error) {
    console.error("CUSTOMER UPDATE ERROR:", error);

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
        message: "Failed to update customer.",
        error: error.message,
      },
      { status: 500 }
    );
  }
}

export async function DELETE(request, { params }) {
  try {
    const { id } = await params;

    const result = await pool.query(
      `
      DELETE FROM customers
      WHERE customer_id = $1
      RETURNING customer_id
      `,
      [id]
    );

    if (result.rows.length === 0) {
      return NextResponse.json(
        {
          success: false,
          message: "Customer not found.",
        },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Customer deleted successfully.",
    });
  } catch (error) {
    console.error("CUSTOMER DELETE ERROR:", error);

    if (error.code === "23503") {
      return NextResponse.json(
        {
          success: false,
          message:
            "This customer cannot be deleted because sales records already exist.",
        },
        { status: 409 }
      );
    }

    return NextResponse.json(
      {
        success: false,
        message: "Failed to delete customer.",
        error: error.message,
      },
      { status: 500 }
    );
  }
}