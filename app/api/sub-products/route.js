
// import { NextResponse } from "next/server";
// import pool from "@/lib/db";

// export const dynamic = "force-dynamic";

// export async function GET() {
//   try {
//     const result = await pool.query(`
//       SELECT
//         sp.sub_product_id,
//         sp.product_id,
//         p.sku AS parent_sku,
//         p.product_name AS parent_product_name,
//         sp.sku,
//         sp.sub_product_name,
//         sp.description,
//         sp.unit,
//         sp.cost_price,
//         sp.sale_price,
//         sp.is_active,
//         sp.created_at,
//         sp.updated_at
//       FROM sub_products sp
//       JOIN products p
//         ON p.product_id = sp.product_id
//       ORDER BY sp.sub_product_id DESC
//     `);

//     const parents = await pool.query(`
//       SELECT product_id, sku, product_name
//       FROM products
//       WHERE is_active = TRUE
//       ORDER BY product_name ASC
//     `);

//     return NextResponse.json({
//       success: true,
//       subProducts: result.rows,
//       parentProducts: parents.rows,
//     });
//   } catch (error) {
//     console.error("SUB PRODUCTS GET ERROR:", error);

//     return NextResponse.json(
//       {
//         success: false,
//         message: "Failed to load sub-products.",
//       },
//       { status: 500 }
//     );
//   }
// }

// export async function POST(request) {
//   try {
//     const body = await request.json();

//     const {
//       productId,
//       sku,
//       subProductName,
//       description,
//       unit,
//       costPrice,
//       salePrice,
//       isActive,
//     } = body;

//     const parentId = Number(productId);
//     const cost = Number(costPrice ?? 0);
//     const sale = Number(salePrice ?? 0);

//     if (
//       !Number.isInteger(parentId) ||
//       parentId <= 0 ||
//       !String(sku || "").trim() ||
//       !String(subProductName || "").trim()
//     ) {
//       return NextResponse.json(
//         {
//           success: false,
//           message:
//             "Parent product, SKU, and sub-product name are required.",
//         },
//         { status: 400 }
//       );
//     }

//     if (
//       !Number.isFinite(cost) ||
//       !Number.isFinite(sale) ||
//       cost < 0 ||
//       sale < 0
//     ) {
//       return NextResponse.json(
//         {
//           success: false,
//           message: "Prices must be valid non-negative numbers.",
//         },
//         { status: 400 }
//       );
//     }

//     const result = await pool.query(
//       `
//       INSERT INTO sub_products (
//         product_id,
//         sku,
//         sub_product_name,
//         description,
//         unit,
//         cost_price,
//         sale_price,
//         is_active
//       )
//       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
//       RETURNING *
//       `,
//       [
//         parentId,
//         String(sku).trim(),
//         String(subProductName).trim(),
//         String(description || "").trim() || null,
//         String(unit || "PCS").trim(),
//         cost,
//         sale,
//         isActive !== false,
//       ]
//     );

//     return NextResponse.json(
//       {
//         success: true,
//         message: "Sub-product created successfully.",
//         subProduct: result.rows[0],
//       },
//       { status: 201 }
//     );
//   } catch (error) {
//     console.error("SUB PRODUCTS POST ERROR:", error);

//     if (error.code === "23505") {
//       return NextResponse.json(
//         {
//           success: false,
//           message: "This SKU already exists.",
//         },
//         { status: 409 }
//       );
//     }

//     if (error.code === "23503") {
//       return NextResponse.json(
//         {
//           success: false,
//           message: "The selected parent product does not exist.",
//         },
//         { status: 400 }
//       );
//     }

//     return NextResponse.json(
//       {
//         success: false,
//         message: "Failed to create sub-product.",
//       },
//       { status: 500 }
//     );
//   }
// }
