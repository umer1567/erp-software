import { NextResponse } from "next/server";
import pool from "@/lib/db";

export async function PUT(request, { params }) {
  try {
    const { id } = await params;

    const body = await request.json();

    const {
      warehouseName,
      warehouseCode,
      location,
      description,
      isActive,
    } = body;

    if (!warehouseName || !warehouseCode) {
      return NextResponse.json(
        {
          message:
            "Warehouse name and code are required.",
        },
        { status: 400 }
      );
    }

    const result = await pool.query(
      `
      UPDATE warehouses
      SET
        warehouse_name = $1,
        warehouse_code = $2,
        location = $3,
        description = $4,
        is_active = $5,
        updated_at = CURRENT_TIMESTAMP
      WHERE warehouse_id = $6
      RETURNING *
      `,
      [
        warehouseName,
        warehouseCode,
        location || null,
        description || null,
        isActive !== false,
        id,
      ]
    );

    if (result.rows.length === 0) {
      return NextResponse.json(
        {
          message: "Warehouse not found.",
        },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Warehouse updated successfully.",
      warehouse: result.rows[0],
    });
  } catch (error) {
    console.error("WAREHOUSE UPDATE ERROR:", error);

    if (error.code === "23505") {
      return NextResponse.json(
        {
          message: "Warehouse code already exists.",
        },
        { status: 409 }
      );
    }

    return NextResponse.json(
      {
        message: "Failed to update warehouse.",
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
      DELETE FROM warehouses
      WHERE warehouse_id = $1
      RETURNING warehouse_id
      `,
      [id]
    );

    if (result.rows.length === 0) {
      return NextResponse.json(
        {
          message: "Warehouse not found.",
        },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Warehouse deleted successfully.",
    });
  } catch (error) {
    console.error("WAREHOUSE DELETE ERROR:", error);

    return NextResponse.json(
      {
        message: "Failed to delete warehouse.",
        error: error.message,
      },
      { status: 500 }
    );
  }
}