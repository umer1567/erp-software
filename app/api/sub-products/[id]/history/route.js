// import { NextResponse } from "next/server";
// import pool from "@/lib/db";

// export async function GET(request, context) {
//     try {
//         const params = await context.params;
//         const subProductId = Number(params.id);

//         if (
//             !Number.isInteger(subProductId) ||
//             subProductId <= 0
//         ) {
//             return NextResponse.json(
//                 {
//                     success: false,
//                     message: "Invalid sub-product ID.",
//                 },
//                 { status: 400 }
//             );
//         }

//         // Get sub-product information.
//         const subProductResult = await pool.query(
//             `SELECT
//                 sub_product_id,
//                 product_id,
//                 sku,
//                 sub_product_name,
//                 description,
//                 unit,
//                 cost_price,
//                 sale_price,
//                 is_active
//              FROM sub_products
//              WHERE sub_product_id = $1`,
//             [subProductId]
//         );

//         if (subProductResult.rows.length === 0) {
//             return NextResponse.json(
//                 {
//                     success: false,
//                     message: "Sub-product not found.",
//                 },
//                 { status: 404 }
//             );
//         }

//         // Get transactions recorded for this sub-product.
//         const transactionsResult = await pool.query(
//             `SELECT
//                 inventory_transaction_id,
//                 product_id,
//                 sub_product_id,
//                 transaction_date,
//                 transaction_type,
//                 transaction_number,
//                 location,
//                 uom,
//                 memo,
//                 transaction_rate,
//                 old_rate,
//                 actual_rate,
//                 new_rate,
//                 receive_quantity,
//                 receive_rate,
//                 receive_amount,
//                 issue_quantity,
//                 issue_rate,
//                 issue_amount,
//                 running_quantity,
//                 created_at
//              FROM inventory_transactions
//              WHERE sub_product_id = $1
//              ORDER BY
//                 transaction_date DESC,
//                 inventory_transaction_id DESC`,
//             [subProductId]
//         );

//         return NextResponse.json({
//             success: true,
//             subProduct: subProductResult.rows[0],
//             transactions: transactionsResult.rows,
//         });
//     } catch (error) {
//         console.error("Sub-product history API error:", error);

//         return NextResponse.json(
//             {
//                 success: false,
//                 message: "Failed to load transaction history.",
//             },
//             { status: 500 }
//         );
//     }
// }
