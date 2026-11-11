
import { NextResponse } from "next/server";
import pool from "@/lib/db";

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const productId = searchParams.get("productId");
    const warehouseId = searchParams.get("warehouseId");
    const barcode = searchParams.get("barcode");

    const values = [];
    const conditions = [];

    if (productId) {
      values.push(productId);
      conditions.push(`pu.product_id = $${values.length}`);
    }

    if (warehouseId) {
      values.push(warehouseId);
      conditions.push(`w.warehouse_id = $${values.length}`);
    }

    if (barcode) {
      values.push(barcode.trim());
      conditions.push(`pu.barcode = $${values.length}`);
    }

    const where = conditions.length
      ? `WHERE ${conditions.join(" AND ")}`
      : "";

    const result = await pool.query(
      `
      SELECT
        pu.unit_id,
        pu.product_id,
        pu.unit_name,
        pu.barcode,
        pu.conversion_factor,
        pu.is_base_unit,
        p.sku,
        p.product_name,
        w.warehouse_id,
        w.warehouse_name,
        COALESCE(us.quantity, 0) AS quantity
      FROM product_units pu
      JOIN products p ON p.product_id = pu.product_id
      CROSS JOIN warehouses w
      LEFT JOIN unit_stock us
        ON us.unit_id = pu.unit_id
       AND us.warehouse_id = w.warehouse_id
      ${where}
      ORDER BY p.product_name, pu.is_base_unit DESC, pu.unit_name, w.warehouse_name
      `,
      values
    );

    return NextResponse.json({
      success: true,
      units: result.rows,
    });
  } catch (error) {
    console.error("PRODUCT UNITS GET ERROR:", error);
    return NextResponse.json(
      { success: false, message: "Failed to load packaging units." },
      { status: 500 }
    );
  }
}

export async function POST(request) {
  const client = await pool.connect();

  try {
    const body = await request.json();
    const productId = Number(body.productId);
    const unitName = String(body.unitName || "").trim();
    const barcode = String(body.barcode || "").trim() || null;
    const conversionFactor = Number(body.conversionFactor);

    if (
      !Number.isInteger(productId) ||
      !unitName ||
      !Number.isFinite(conversionFactor) ||
      conversionFactor <= 0
    ) {
      return NextResponse.json(
        {
          success: false,
          message: "Select a product, enter a unit name, and use a conversion factor greater than zero.",
        },
        { status: 400 }
      );
    }

    await client.query("BEGIN");

    const product = await client.query(
      "SELECT product_id FROM products WHERE product_id = $1",
      [productId]
    );

    if (product.rowCount === 0) {
      await client.query("ROLLBACK");
      return NextResponse.json(
        { success: false, message: "Product not found." },
        { status: 404 }
      );
    }

    const result = await client.query(
      `
      INSERT INTO product_units
        (product_id, unit_name, barcode, conversion_factor, is_base_unit)
      VALUES ($1, $2, $3, $4, FALSE)
      RETURNING *
      `,
      [productId, unitName, barcode, conversionFactor]
    );

    await client.query(
      `
      INSERT INTO unit_stock (unit_id, warehouse_id, quantity)
      SELECT $1, warehouse_id, 0
      FROM warehouses
      ON CONFLICT (unit_id, warehouse_id) DO NOTHING
      `,
      [result.rows[0].unit_id]
    );

    await client.query("COMMIT");

    return NextResponse.json(
      {
        success: true,
        message: "Packaging unit created.",
        unit: result.rows[0],
      },
      { status: 201 }
    );
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("PRODUCT UNIT CREATE ERROR:", error);

    if (error.code === "23505") {
      return NextResponse.json(
        {
          success: false,
          message: "This barcode or unit name already exists for the product.",
        },
        { status: 409 }
      );
    }

    return NextResponse.json(
      { success: false, message: "Failed to create packaging unit." },
      { status: 500 }
    );
  } finally {
    client.release();
  }
}
