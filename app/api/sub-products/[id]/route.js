
// import { NextResponse } from "next/server";
// import pool from "@/lib/db";

// export async function PUT(request, { params }) {
//   try {
//     const { id } = await params;
//     const subProductId = Number(id);
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
//       !Number.isInteger(subProductId) ||
//       subProductId <= 0 ||
//       !Number.isInteger(parentId) ||
//       parentId <= 0 ||
//       !String(sku || "").trim() ||
//       !String(subProductName || "").trim()
//     ) {
//       return NextResponse.json(
//         {
//           success: false,
//           message:
//             "Valid parent product, SKU, and sub-product name are required.",
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
//       UPDATE sub_products
//       SET
//         product_id = $1,
//         sku = $2,
//         sub_product_name = $3,
//         description = $4,
//         unit = $5,
//         cost_price = $6,
//         sale_price = $7,
//         is_active = $8,
//         updated_at = CURRENT_TIMESTAMP
//       WHERE sub_product_id = $9
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
//         subProductId,
//       ]
//     );

//     if (result.rows.length === 0) {
//       return NextResponse.json(
//         {
//           success: false,
//           message: "Sub-product not found.",
//         },
//         { status: 404 }
//       );
//     }

//     return NextResponse.json({
//       success: true,
//       message: "Sub-product updated successfully.",
//       subProduct: result.rows[0],
//     });
//   } catch (error) {
//     console.error("SUB PRODUCTS PUT ERROR:", error);

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
//         message: "Failed to update sub-product.",
//       },
//       { status: 500 }
//     );
//   }
// }

// export async function DELETE(request, { params }) {
//   try {
//     const { id } = await params;
//     const subProductId = Number(id);

//     if (!Number.isInteger(subProductId) || subProductId <= 0) {
//       return NextResponse.json(
//         {
//           success: false,
//           message: "Invalid sub-product ID.",
//         },
//         { status: 400 }
//       );
//     }

//     const result = await pool.query(
//       `
//       DELETE FROM sub_products
//       WHERE sub_product_id = $1
//       RETURNING sub_product_id
//       `,
//       [subProductId]
//     );

//     if (result.rows.length === 0) {
//       return NextResponse.json(
//         {
//           success: false,
//           message: "Sub-product not found.",
//         },
//         { status: 404 }
//       );
//     }

//     return NextResponse.json({
//       success: true,
//       message: "Sub-product deleted successfully.",
//     });
//   } catch (error) {
//     console.error("SUB PRODUCTS DELETE ERROR:", error);

//     return NextResponse.json(
//       {
//         success: false,
//         message: "Failed to delete sub-product.",
//       },
//       { status: 500 }
//     );
//   }
// }
