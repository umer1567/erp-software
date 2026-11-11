
import { NextResponse } from "next/server";
import pool from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(request, { params }) {
  try {
    const { id } = await params;
    const productId = Number(id);

    if (!Number.isSafeInteger(productId) || productId <= 0) {
      return NextResponse.json(
        { success: false, message: "Invalid product ID." },
        { status: 400 }
      );
    }

    const productResult = await pool.query(
      `SELECT product_id, sku, product_name, unit
       FROM products
       WHERE product_id = $1`,
      [productId]
    );

    if (productResult.rows.length === 0) {
      return NextResponse.json(
        { success: false, message: "Product not found." },
        { status: 404 }
      );
    }

    const transactionResult = await pool.query(
      `SELECT
         inventory_transaction_id,
         transaction_date,
         transaction_type,
         transaction_number,
         location,
         uom,
         memo,
         receive_quantity,
         issue_quantity,
         running_quantity,
         receive_rate,
         issue_rate,
         receive_amount,
         issue_amount
       FROM inventory_transactions
       WHERE product_id = $1
       ORDER BY transaction_date DESC,
                created_at DESC,
                inventory_transaction_id DESC`,
      [productId]
    );

    return NextResponse.json({
      success: true,
      product: productResult.rows[0],
      transactions: transactionResult.rows,
    });
  } catch (error) {
    console.error("PRODUCT HISTORY API ERROR:", error);

    return NextResponse.json(
      {
        success: false,
        message: "Failed to load product transaction history.",
      },
      { status: 500 }
    );
  }
}
