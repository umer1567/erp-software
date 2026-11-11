
import { NextResponse } from "next/server";
import pool from "@/lib/db";

export async function PUT(request, { params }) {
  try {
    const { id } = await params;
    const body = await request.json();

    const unitName = String(body.unitName || "").trim();
    const barcode = String(body.barcode || "").trim() || null;
    const conversionFactor = Number(body.conversionFactor);

    if (
      !unitName ||
      !Number.isFinite(conversionFactor) ||
      conversionFactor <= 0
    ) {
      return NextResponse.json(
        { success: false, message: "Unit name and a positive conversion factor are required." },
        { status: 400 }
      );
    }

    const result = await pool.query(
      `
      UPDATE product_units
      SET unit_name = $1,
          barcode = $2,
          conversion_factor = $3,
          updated_at = CURRENT_TIMESTAMP
      WHERE unit_id = $4
      RETURNING *
      `,
      [unitName, barcode, conversionFactor, id]
    );

    if (result.rowCount === 0) {
      return NextResponse.json(
        { success: false, message: "Packaging unit not found." },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Packaging unit updated.",
      unit: result.rows[0],
    });
  } catch (error) {
    console.error("PRODUCT UNIT UPDATE ERROR:", error);

    if (error.code === "23505") {
      return NextResponse.json(
        { success: false, message: "Barcode or unit name already exists." },
        { status: 409 }
      );
    }

    return NextResponse.json(
      { success: false, message: "Failed to update packaging unit." },
      { status: 500 }
    );
  }
}

export async function DELETE(request, { params }) {
  const client = await pool.connect();

  try {
    const { id } = await params;
    await client.query("BEGIN");

    const result = await client.query(
      "SELECT unit_id, is_base_unit FROM product_units WHERE unit_id = $1 FOR UPDATE",
      [id]
    );

    if (result.rowCount === 0) {
      await client.query("ROLLBACK");
      return NextResponse.json(
        { success: false, message: "Packaging unit not found." },
        { status: 404 }
      );
    }

    if (result.rows[0].is_base_unit) {
      await client.query("ROLLBACK");
      return NextResponse.json(
        { success: false, message: "The base unit cannot be deleted." },
        { status: 400 }
      );
    }

    const stock = await client.query(
      "SELECT COALESCE(SUM(quantity), 0) AS quantity FROM unit_stock WHERE unit_id = $1",
      [id]
    );

    if (Number(stock.rows[0].quantity) !== 0) {
      await client.query("ROLLBACK");
      return NextResponse.json(
        { success: false, message: "This unit still has stock. Convert or remove its stock before deleting it." },
        { status: 409 }
      );
    }

    await client.query("DELETE FROM product_units WHERE unit_id = $1", [id]);
    await client.query("COMMIT");

    return NextResponse.json({
      success: true,
      message: "Packaging unit deleted.",
    });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("PRODUCT UNIT DELETE ERROR:", error);

    return NextResponse.json(
      { success: false, message: "Failed to delete packaging unit." },
      { status: 500 }
    );
  } finally {
    client.release();
  }
}
