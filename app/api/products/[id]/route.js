
// import { NextResponse } from "next/server";
// import pool from "@/lib/db";

// export async function PUT(request, { params }) {
//   try {
//     const { id } = await params;
//     const body = await request.json();

//     console.log("PRODUCT UPDATE BODY:", body);
// console.log("BARCODE RECEIVED:", JSON.stringify(body.barcode));

//     const {
//       sku,
//       barcode,
//       productName,
//       description,
//       category,
//       unit,
//       itemType,
//       brandName,
//       model,
//       itemColor,
//       itemSize,
//       itemDesign,
//       salesUnit,
//       salePrice,
//       salesDescription,
//       salesAccount,
//       receivableAccount,
//       image,
//       bannerSequence,
//       purchaseUnit,
//       costPrice,
//       purchaseDescription,
//       purchaseAccount,
//       inventoryAccount,
//       cogsAccount,
//       minimumStock,
//       isActive,
//     } = body;

//     if (!sku?.trim() || !productName?.trim()) {
//       return NextResponse.json(
//         { message: "SKU and product name are required." },
//         { status: 400 }
//       );
//     }

//     const result = await pool.query(
//       `
//       UPDATE products SET
//   sku = $1,
//   barcode = $2,
//   product_name = $3,
//   description = $4,
//   category = $5,
//   unit = $6,
//   item_type = $7,
//   brand_name = $8,
//   model = $9,
//   item_color = $10,
//   item_size = $11,
//   item_design = $12,
//   sales_unit = $13,
//   sale_price = $14,
//   sales_description = $15,
//   sales_account_id = $16,
//   receivable_account_id = $17,
//   image = $18,
//   banner_sequence = $19,
//   purchase_unit = $20,
//   cost_price = $21,
//   purchase_description = $22,
//   purchase_account_id = $23,
//   inventory_account_id = $24,
//   cogs_account_id = $25,
//   minimum_stock = $26,
//   is_active = $27,
//   updated_at = CURRENT_TIMESTAMP
// WHERE product_id = $28
// RETURNING *
//       `,
//       [
//   sku.trim(),
//   barcode ? String(barcode).trim() : null,
//   productName.trim(),
//   description || null,
//   category || null,
//   unit || "PCS",
//   itemType || "Stock Item",
//   brandName || null,
//   model || null,
//   itemColor || null,
//   itemSize || null,
//   itemDesign || null,
//   salesUnit || unit || "PCS",
//   Number(salePrice) || 0,
//   salesDescription || null,
//   salesAccount ? Number(salesAccount) : null,
//   receivableAccount ? Number(receivableAccount) : null,
//   image || null,
//   Math.max(0, parseInt(bannerSequence, 10) || 0),
//   purchaseUnit || unit || "PCS",
//   Number(costPrice) || 0,
//   purchaseDescription || null,
//   purchaseAccount ? Number(purchaseAccount) : null,
//   inventoryAccount ? Number(inventoryAccount) : null,
//   cogsAccount ? Number(cogsAccount) : null,
//   Number(minimumStock) || 0,
//   isActive !== false,
//   id,
// ]
//     );

//     if (result.rows.length === 0) {
//       return NextResponse.json(
//         { message: "Product not found." },
//         { status: 404 }
//       );
//     }

//     return NextResponse.json({
//       success: true,
//       message: "Product updated successfully.",
//       product: result.rows[0],
//     });
//   } catch (error) {
//     console.error("PRODUCT UPDATE ERROR:", error);

//     if (error.code === "23505") {
//       return NextResponse.json(
//         { message: "This SKU already exists." },
//         { status: 409 }
//       );
//     }

//     if (error.code === "23503") {
//       return NextResponse.json(
//         { message: "Select valid accounting accounts." },
//         { status: 400 }
//       );
//     }

//     return NextResponse.json(
//       {
//         message: "Failed to update product.",
//         error: error.message,
//       },
//       { status: 500 }
//     );
//   }
// }

// export async function DELETE(request, { params }) {
//   try {
//     const { id } = await params;

//     const result = await pool.query(
//       `
//       DELETE FROM products
//       WHERE product_id = $1
//       RETURNING product_id
//       `,
//       [id]
//     );

//     if (result.rows.length === 0) {
//       return NextResponse.json(
//         { message: "Product not found." },
//         { status: 404 }
//       );
//     }

//     return NextResponse.json({
//       success: true,
//       message: "Product deleted successfully.",
//     });
//   } catch (error) {
//     console.error("PRODUCT DELETE ERROR:", error);

//     if (error.code === "23503") {
//       return NextResponse.json(
//         {
//           message:
//             "This product is linked to stock or transaction records. Remove or archive dependent records safely before deleting it.",
//         },
//         { status: 409 }
//       );
//     }

//     return NextResponse.json(
//       {
//         message: "Failed to delete product.",
//         error: error.message,
//       },
//       { status: 500 }
//     );
//   }
// }


import { NextResponse } from "next/server";
import pool from "@/lib/db";

export const runtime = "nodejs";

function normalizeBarcode(value) {
  return value == null ? "" : String(value).trim();
}

export async function PUT(request, { params }) {
  try {
    const { id } = await params;
    const productId = Number(id);

    if (!Number.isInteger(productId) || productId <= 0) {
      return NextResponse.json(
        { success: false, message: "Invalid product ID." },
        { status: 400 }
      );
    }

    const body = await request.json();

    const {
      sku,
      barcode,
      productName,
      description,
      category,
      unit,
      itemType,
      brandName,
      model,
      itemColor,
      itemSize,
      itemDesign,
      salesUnit,
      salePrice,
      salesDescription,
      salesAccount,
      receivableAccount,
      image,
      bannerSequence,
      purchaseUnit,
      costPrice,
      purchaseDescription,
      purchaseAccount,
      inventoryAccount,
      cogsAccount,
      minimumStock,
      isActive,
    } = body;

    if (
      typeof sku !== "string" ||
      !sku.trim() ||
      typeof productName !== "string" ||
      !productName.trim()
    ) {
      return NextResponse.json(
        {
          success: false,
          message: "SKU and product name are required.",
        },
        { status: 400 }
      );
    }

    const result = await pool.query(
      `
      UPDATE products SET
        sku = $1,
        barcode = $2,
        product_name = $3,
        description = $4,
        category = $5,
        unit = $6,
        item_type = $7,
        brand_name = $8,
        model = $9,
        item_color = $10,
        item_size = $11,
        item_design = $12,
        sales_unit = $13,
        sale_price = $14,
        sales_description = $15,
        sales_account_id = $16,
        receivable_account_id = $17,
        image = $18,
        banner_sequence = $19,
        purchase_unit = $20,
        cost_price = $21,
        purchase_description = $22,
        purchase_account_id = $23,
        inventory_account_id = $24,
        cogs_account_id = $25,
        minimum_stock = $26,
        is_active = $27,
        updated_at = CURRENT_TIMESTAMP
      WHERE product_id = $28
      RETURNING *
      `,
      [
        sku.trim(),
        normalizeBarcode(barcode) || null,
        productName.trim(),
        description || null,
        category || null,
        unit || "PCS",
        itemType || "Stock Item",
        brandName || null,
        model || null,
        itemColor || null,
        itemSize || null,
        itemDesign || null,
        salesUnit || unit || "PCS",
        Number(salePrice) || 0,
        salesDescription || null,
        salesAccount ? Number(salesAccount) : null,
        receivableAccount ? Number(receivableAccount) : null,
        image || null,
        Math.max(0, parseInt(bannerSequence, 10) || 0),
        purchaseUnit || unit || "PCS",
        Number(costPrice) || 0,
        purchaseDescription || null,
        purchaseAccount ? Number(purchaseAccount) : null,
        inventoryAccount ? Number(inventoryAccount) : null,
        cogsAccount ? Number(cogsAccount) : null,
        Number(minimumStock) || 0,
        isActive !== false,
        productId,
      ]
    );

    if (result.rows.length === 0) {
      return NextResponse.json(
        { success: false, message: "Product not found." },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Product updated successfully.",
      product: {
        ...result.rows[0],
        barcode: normalizeBarcode(result.rows[0].barcode),
      },
    });
  } catch (error) {
    console.error("PRODUCT UPDATE ERROR:", error);

    if (error.code === "23505") {
      return NextResponse.json(
        {
          success: false,
          message: "This SKU or barcode already exists.",
        },
        { status: 409 }
      );
    }

    if (error.code === "23503") {
      return NextResponse.json(
        {
          success: false,
          message: "Select valid accounting accounts.",
        },
        { status: 400 }
      );
    }

    return NextResponse.json(
      {
        success: false,
        message: "Failed to update product.",
      },
      { status: 500 }
    );
  }
}

export async function DELETE(request, { params }) {
  try {
    const { id } = await params;
    const productId = Number(id);

    if (!Number.isInteger(productId) || productId <= 0) {
      return NextResponse.json(
        { success: false, message: "Invalid product ID." },
        { status: 400 }
      );
    }

    const result = await pool.query(
      `
      DELETE FROM products
      WHERE product_id = $1
      RETURNING product_id
      `,
      [productId]
    );

    if (result.rows.length === 0) {
      return NextResponse.json(
        { success: false, message: "Product not found." },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Product deleted successfully.",
    });
  } catch (error) {
    console.error("PRODUCT DELETE ERROR:", error);

    if (error.code === "23503") {
      return NextResponse.json(
        {
          success: false,
          message:
            "This product is linked to stock or transaction records. Remove or archive dependent records safely before deleting it.",
        },
        { status: 409 }
      );
    }

    return NextResponse.json(
      {
        success: false,
        message: "Failed to delete product.",
      },
      { status: 500 }
    );
  }
}
