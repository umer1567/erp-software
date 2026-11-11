
import { NextResponse } from "next/server";
import pool from "@/lib/db";

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const productId = searchParams.get("productId");
    const warehouseId = searchParams.get("warehouseId");

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
      ORDER BY p.product_name, w.warehouse_name, pu.is_base_unit DESC, pu.unit_name
      `,
      values
    );

    return NextResponse.json({ success: true, stock: result.rows });
  } catch (error) {
    console.error("UNIT STOCK GET ERROR:", error);
    return NextResponse.json(
      { success: false, message: "Failed to load packaging stock." },
      { status: 500 }
    );
  }
}

export async function POST(request) {
  const client = await pool.connect();

  try {
    const body = await request.json();
    const warehouseId = Number(body.warehouseId);
    const fromUnitId = Number(body.fromUnitId);
    const toUnitId = Number(body.toUnitId);
    const quantity = Number(body.quantity);

    if (
      !Number.isInteger(warehouseId) ||
      !Number.isInteger(fromUnitId) ||
      !Number.isInteger(toUnitId) ||
      fromUnitId === toUnitId ||
      !Number.isFinite(quantity) ||
      quantity <= 0
    ) {
      return NextResponse.json(
        { success: false, message: "Select different source and destination units, a warehouse, and a positive quantity." },
        { status: 400 }
      );
    }

    await client.query("BEGIN");

    const units = await client.query(
      `
      SELECT unit_id, product_id, unit_name, conversion_factor
      FROM product_units
      WHERE unit_id = ANY($1::int[])
      ORDER BY unit_id
      FOR UPDATE
      `,
      [[fromUnitId, toUnitId]]
    );

    if (units.rowCount !== 2 || units.rows[0].product_id !== units.rows[1].product_id) {
      await client.query("ROLLBACK");
      return NextResponse.json(
        { success: false, message: "Both units must belong to the same product." },
        { status: 400 }
      );
    }

    const fromUnit = units.rows.find((unit) => unit.unit_id === fromUnitId);
    const toUnit = units.rows.find((unit) => unit.unit_id === toUnitId);

    const fromStock = await client.query(
      `
      SELECT quantity FROM unit_stock
      WHERE unit_id = $1 AND warehouse_id = $2
      FOR UPDATE
      `,
      [fromUnitId, warehouseId]
    );

    const toStock = await client.query(
      `
      SELECT quantity FROM unit_stock
      WHERE unit_id = $1 AND warehouse_id = $2
      FOR UPDATE
      `,
      [toUnitId, warehouseId]
    );

    if (fromStock.rowCount === 0 || toStock.rowCount === 0) {
      await client.query("ROLLBACK");
      return NextResponse.json(
        { success: false, message: "Stock records not found for this warehouse." },
        { status: 404 }
      );
    }

    if (Number(fromStock.rows[0].quantity) < quantity) {
      await client.query("ROLLBACK");
      return NextResponse.json(
        { success: false, message: `Not enough ${fromUnit.unit_name} in this warehouse.` },
        { status: 400 }
      );
    }

    const convertedQuantity =
      quantity *
      Number(fromUnit.conversion_factor) /
      Number(toUnit.conversion_factor);

    await client.query(
      `
      UPDATE unit_stock
      SET quantity = quantity - $1, updated_at = CURRENT_TIMESTAMP
      WHERE unit_id = $2 AND warehouse_id = $3
      `,
      [quantity, fromUnitId, warehouseId]
    );

    await client.query(
      `
      UPDATE unit_stock
      SET quantity = quantity + $1, updated_at = CURRENT_TIMESTAMP
      WHERE unit_id = $2 AND warehouse_id = $3
      `,
      [convertedQuantity, toUnitId, warehouseId]
    );

    await client.query("COMMIT");

    return NextResponse.json({
      success: true,
      message: "Stock converted successfully.",
      sourceQuantity: quantity,
      destinationQuantity: convertedQuantity,
      destinationUnit: toUnit.unit_name,
    });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("UNIT STOCK CONVERSION ERROR:", error);

    return NextResponse.json(
      { success: false, message: "Failed to convert stock." },
      { status: 500 }
    );
  } finally {
    client.release();
  }
}
