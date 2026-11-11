
import { NextResponse } from "next/server";
import pool from "@/lib/db";

export async function POST(request) {
  const client = await pool.connect();

  try {
    const body = await request.json();
    const unitId = Number(body.unitId);
    const warehouseId = Number(body.warehouseId);
    const quantity = Number(body.quantity);
    const type = body.type;

    if (
      !Number.isInteger(unitId) ||
      !Number.isInteger(warehouseId) ||
      !Number.isFinite(quantity) ||
      quantity <= 0 ||
      !["INCREASE", "DECREASE"].includes(type)
    ) {
      return NextResponse.json(
        { success: false, message: "Provide a unit, warehouse, positive quantity, and valid adjustment type." },
        { status: 400 }
      );
    }

    await client.query("BEGIN");

    const result = await client.query(
      `
      SELECT quantity
      FROM unit_stock
      WHERE unit_id = $1 AND warehouse_id = $2
      FOR UPDATE
      `,
      [unitId, warehouseId]
    );

    if (result.rowCount === 0) {
      await client.query("ROLLBACK");
      return NextResponse.json(
        { success: false, message: "Stock record not found." },
        { status: 404 }
      );
    }

    const currentQuantity = Number(result.rows[0].quantity);

    if (type === "DECREASE" && currentQuantity < quantity) {
      await client.query("ROLLBACK");
      return NextResponse.json(
        { success: false, message: "The adjustment exceeds available stock." },
        { status: 400 }
      );
    }

    const operator = type === "INCREASE" ? "+" : "-";

    const updated = await client.query(
      `
      UPDATE unit_stock
      SET quantity = quantity ${operator} $1,
          updated_at = CURRENT_TIMESTAMP
      WHERE unit_id = $2 AND warehouse_id = $3
      RETURNING quantity
      `,
      [quantity, unitId, warehouseId]
    );

    await client.query("COMMIT");

    return NextResponse.json({
      success: true,
      message: "Packaging stock adjusted successfully.",
      quantity: updated.rows[0].quantity,
    });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("UNIT STOCK ADJUSTMENT ERROR:", error);

    return NextResponse.json(
      { success: false, message: "Failed to adjust packaging stock." },
      { status: 500 }
    );
  } finally {
    client.release();
  }
}
