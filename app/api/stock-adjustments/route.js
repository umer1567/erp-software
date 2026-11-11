import { NextResponse } from "next/server";
import pool from "@/lib/db";

export async function POST(request) {
  const client = await pool.connect();

  try {
    const body = await request.json();

    const {
      warehouseId,
      adjustmentType,
      referenceNumber,
      reason,
      notes,
      items,
    } = body;

    if (!warehouseId) {
      return NextResponse.json(
        {
          success: false,
          message: "Warehouse is required.",
        },
        { status: 400 }
      );
    }

    if (!adjustmentType) {
      return NextResponse.json(
        {
          success: false,
          message: "Adjustment type is required.",
        },
        { status: 400 }
      );
    }

    if (!["INCREASE", "DECREASE"].includes(adjustmentType)) {
      return NextResponse.json(
        {
          success: false,
          message: "Invalid adjustment type.",
        },
        { status: 400 }
      );
    }

    if (!items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json(
        {
          success: false,
          message: "At least one product is required.",
        },
        { status: 400 }
      );
    }

    for (const item of items) {
      if (!item.productId) {
        return NextResponse.json(
          {
            success: false,
            message: "Every adjustment item must have a product.",
          },
          { status: 400 }
        );
      }

      if (!item.quantity || Number(item.quantity) <= 0) {
        return NextResponse.json(
          {
            success: false,
            message: "Every product must have a quantity greater than zero.",
          },
          { status: 400 }
        );
      }
    }

    await client.query("BEGIN");

    /*
      1. Create adjustment header
    */
    const adjustmentResult = await client.query(
      `
      INSERT INTO stock_adjustments (
        warehouse_id,
        adjustment_type,
        reference_number,
        reason,
        notes,
        created_at
      )
      VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP)
      RETURNING adjustment_id
      `,
      [
        warehouseId,
        adjustmentType,
        referenceNumber || null,
        reason || null,
        notes || null,
      ]
    );

    const adjustmentId =
      adjustmentResult.rows[0].adjustment_id;

    /*
      2. Process every product
    */
    for (const item of items) {
      const productId = Number(item.productId);
      const quantity = Number(item.quantity);

      /*
        Check whether product exists
      */
      const productResult = await client.query(
        `
        SELECT product_id
        FROM products
        WHERE product_id = $1
        `,
        [productId]
      );

      if (productResult.rows.length === 0) {
        throw new Error(
          `Product with ID ${productId} does not exist.`
        );
      }

      /*
        Check current stock
      */
      const stockResult = await client.query(
        `
        SELECT stock_id, quantity
        FROM stock
        WHERE product_id = $1
          AND warehouse_id = $2
        FOR UPDATE
        `,
        [productId, warehouseId]
      );

      if (adjustmentType === "DECREASE") {
        const currentQuantity =
          stockResult.rows[0]?.quantity
            ? Number(stockResult.rows[0].quantity)
            : 0;

        if (currentQuantity < quantity) {
          throw new Error(
            `Insufficient stock for product ID ${productId}. Available: ${currentQuantity}, requested: ${quantity}.`
          );
        }
      }

      /*
        3. Insert adjustment item
      */
      await client.query(
        `
        INSERT INTO stock_adjustment_items (
          adjustment_id,
          product_id,
          quantity
        )
        VALUES ($1, $2, $3)
        `,
        [
          adjustmentId,
          productId,
          quantity,
        ]
      );

      /*
        4. Increase/decrease stock
      */
      if (stockResult.rows.length === 0) {
        if (adjustmentType === "DECREASE") {
          throw new Error(
            `No stock exists for product ID ${productId} in the selected warehouse.`
          );
        }

        await client.query(
          `
          INSERT INTO stock (
            product_id,
            warehouse_id,
            quantity,
            updated_at
          )
          VALUES ($1, $2, $3, CURRENT_TIMESTAMP)
          `,
          [
            productId,
            warehouseId,
            quantity,
          ]
        );
      } else {
        const stockId =
          stockResult.rows[0].stock_id;

        const operator =
          adjustmentType === "INCREASE"
            ? "+"
            : "-";

        await client.query(
          `
          UPDATE stock
          SET
            quantity = quantity ${operator} $1,
            updated_at = CURRENT_TIMESTAMP
          WHERE stock_id = $2
          `,
          [
            quantity,
            stockId,
          ]
        );
      }
    }

    await client.query("COMMIT");

    return NextResponse.json(
      {
        success: true,
        message: "Stock adjustment saved successfully.",
        adjustmentId,
      },
      { status: 201 }
    );
  } catch (error) {
    await client.query("ROLLBACK");

    console.error(
      "STOCK ADJUSTMENT ERROR:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        message:
          error.message ||
          "Failed to save stock adjustment.",
      },
      { status: 500 }
    );
  } finally {
    client.release();
  }
}