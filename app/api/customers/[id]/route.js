
import { NextResponse } from "next/server";
import pool from "@/lib/db";

export const dynamic = "force-dynamic";

// Update an existing customer
export async function PUT(request, { params }) {
  const client = await pool.connect();

  try {
    const { id } = await params;
    const customerId = Number(id);

    if (!Number.isInteger(customerId) || customerId <= 0) {
      return NextResponse.json(
        {
          success: false,
          message: "Invalid customer ID.",
        },
        { status: 400 }
      );
    }

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

    if (!customerCode?.trim() || !customerName?.trim()) {
      return NextResponse.json(
        {
          success: false,
          message: "Customer code and customer name are required.",
        },
        { status: 400 }
      );
    }

    const result = await client.query(
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
        customerCode.trim(),
        customerName.trim(),
        phone?.trim() || null,
        email?.trim() || null,
        address?.trim() || null,
        Number(openingBalance) || 0,
        Number(creditLimit) || 0,
        isActive !== false,
        customerId,
      ]
    );

    if (result.rowCount === 0) {
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
    console.error("CUSTOMERS PUT ERROR:", error);

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
  } finally {
    client.release();
  }
}

// Delete an existing customer
export async function DELETE(request, { params }) {
  const client = await pool.connect();

  try {
    const { id } = await params;
    const customerId = Number(id);

    if (!Number.isInteger(customerId) || customerId <= 0) {
      return NextResponse.json(
        {
          success: false,
          message: "Invalid customer ID.",
        },
        { status: 400 }
      );
    }

    const result = await client.query(
      `
      DELETE FROM customers
      WHERE customer_id = $1
      RETURNING customer_id, customer_name, customer_code
      `,
      [customerId]
    );

    if (result.rowCount === 0) {
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
      customer: result.rows[0],
    });
  } catch (error) {
    console.error("CUSTOMERS DELETE ERROR:", error);

    if (error.code === "23503") {
      return NextResponse.json(
        {
          success: false,
          message:
            "This customer is linked to existing invoices or payments and cannot be deleted.",
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
  } finally {
    client.release();
  }
}
