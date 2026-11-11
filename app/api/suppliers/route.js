import { NextResponse } from "next/server";
import pool from "@/lib/db";

export async function GET() {
  try {
    const result = await pool.query(`
      SELECT
        s.supplier_id,
        s.supplier_code,
        s.supplier_name,
        s.phone,
        s.email,
        s.address,
        s.opening_balance,
        s.credit_limit,
        s.is_active,
        COALESCE(p.total_purchases, 0) AS total_purchases,
        COALESCE(pay.total_paid, 0) AS total_paid,
        (
          COALESCE(s.opening_balance, 0)
          + COALESCE(p.total_purchases, 0)
          - COALESCE(pay.total_paid, 0)
        ) AS balance
      FROM suppliers s
      LEFT JOIN (
        SELECT supplier_id, SUM(total_amount) AS total_purchases
        FROM purchases
        GROUP BY supplier_id
      ) p ON p.supplier_id = s.supplier_id
      LEFT JOIN (
        SELECT supplier_id, SUM(amount) AS total_paid
        FROM purchase_payments
        GROUP BY supplier_id
      ) pay ON pay.supplier_id = s.supplier_id
      ORDER BY s.supplier_id DESC
    `);

    return NextResponse.json({
      success: true,
      suppliers: result.rows,
    });
  } catch (error) {
    console.error("SUPPLIERS GET ERROR:", error);

    return NextResponse.json(
      {
        success: false,
        message: "Failed to load vendors.",
      },
      { status: 500 }
    );
  }
}

export async function POST(request) {
  try {
    const body = await request.json();

    const {
      supplierCode,
      supplierName,
      phone,
      email,
      address,
      openingBalance,
      creditLimit,
      isActive,
    } = body;

    if (!supplierCode?.trim() || !supplierName?.trim()) {
      return NextResponse.json(
        {
          success: false,
          message: "Vendor code and vendor name are required.",
        },
        { status: 400 }
      );
    }

    const opening = Number(openingBalance ?? 0);
    const credit = Number(creditLimit ?? 0);

    if (
      !Number.isFinite(opening) ||
      !Number.isFinite(credit) ||
      opening < 0 ||
      credit < 0
    ) {
      return NextResponse.json(
        {
          success: false,
          message: "Opening balance and credit limit must be valid non-negative amounts.",
        },
        { status: 400 }
      );
    }

    const result = await pool.query(
      `
        INSERT INTO suppliers (
          supplier_code,
          supplier_name,
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
        supplierCode.trim(),
        supplierName.trim(),
        phone?.trim() || null,
        email?.trim() || null,
        address?.trim() || null,
        opening,
        credit,
        isActive !== false,
      ]
    );

    return NextResponse.json(
      {
        success: true,
        message: "Vendor created successfully.",
        supplier: result.rows[0],
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("SUPPLIERS POST ERROR:", error);

    if (error.code === "23505") {
      return NextResponse.json(
        {
          success: false,
          message: "This vendor code already exists.",
        },
        { status: 409 }
      );
    }

    return NextResponse.json(
      {
        success: false,
        message: "Failed to create vendor.",
      },
      { status: 500 }
    );
  }
}
