
import { NextResponse } from "next/server";
import pool from "@/lib/db";

function validId(value) {
  return /^\d+$/.test(String(value)) && Number(value) > 0;
}

export async function PUT(request, { params }) {
  const { id, variantId } = await params;

  if (!validId(id) || !validId(variantId)) {
    return NextResponse.json(
      { error: "Invalid product or sub-product ID." },
      { status: 400 }
    );
  }

  let body;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON request." },
      { status: 400 }
    );
  }

  const sku = String(body.variant_sku ?? "").trim();
  const name = String(body.variant_name ?? "").trim();
  const description =
    String(body.description ?? "").trim() || null;
  const unit = String(body.unit ?? "PCS").trim() || "PCS";
  const color = String(body.color ?? "").trim() || null;
  const size = String(body.size ?? "").trim() || null;
  const design = String(body.design ?? "").trim() || null;
  const barcode = String(body.barcode ?? "").trim() || null;
  const costPrice = Number(body.cost_price ?? 0);
  const salePrice = Number(body.sale_price ?? 0);
  const unitsPerParent = Number(body.units_per_parent ?? 1);

  if (!sku || !name) {
    return NextResponse.json(
      { error: "Sub-product code and name are required." },
      { status: 400 }
    );
  }

  if (
    !Number.isFinite(costPrice) ||
    !Number.isFinite(salePrice) ||
    costPrice < 0 ||
    salePrice < 0
  ) {
    return NextResponse.json(
      { error: "Prices must be valid non-negative numbers." },
      { status: 400 }
    );
  }

  if (
    !Number.isFinite(unitsPerParent) ||
    unitsPerParent <= 0
  ) {
    return NextResponse.json(
      {
        error:
          "Units per main product must be greater than zero.",
      },
      { status: 400 }
    );
  }

  try {
    const result = await pool.query(
      `UPDATE sub_products
       SET
         sku = $1,
         sub_product_name = $2,
         description = $3,
         unit = $4,
         color = $5,
         size = $6,
         design = $7,
         barcode = $8,
         cost_price = $9,
         sale_price = $10,
         units_per_parent = $11
       WHERE sub_product_id = $12
         AND product_id = $13
       RETURNING
         sub_product_id AS variant_id,
         product_id,
         sku AS variant_sku,
         sub_product_name AS variant_name,
         description,
         unit,
         color,
         size,
         design,
         barcode,
         cost_price,
         sale_price,
         units_per_parent,
         is_active`,
      [
        sku,
        name,
        description,
        unit,
        color,
        size,
        design,
        barcode,
        costPrice,
        salePrice,
        unitsPerParent,
        Number(variantId),
        Number(id),
      ]
    );

    if (result.rowCount === 0) {
      return NextResponse.json(
        {
          error:
            "Sub-product not found for this main product.",
        },
        { status: 404 }
      );
    }

    return NextResponse.json({
      message: "Sub-product updated successfully.",
      variant: result.rows[0],
    });
  } catch (error) {
    console.error("Unable to update sub-product:", error);

    if (error.code === "23505") {
      return NextResponse.json(
        { error: "This SKU or barcode already exists." },
        { status: 409 }
      );
    }

    return NextResponse.json(
      { error: "Unable to update sub-product." },
      { status: 500 }
    );
  }
}

export async function DELETE(request, { params }) {
  const { id, variantId } = await params;

  if (!validId(id) || !validId(variantId)) {
    return NextResponse.json(
      { error: "Invalid product or sub-product ID." },
      { status: 400 }
    );
  }

  try {
    const result = await pool.query(
      `DELETE FROM sub_products
       WHERE sub_product_id = $1
         AND product_id = $2
       RETURNING sub_product_id AS variant_id`,
      [Number(variantId), Number(id)]
    );

    if (result.rowCount === 0) {
      return NextResponse.json(
        {
          error:
            "Sub-product not found for this main product.",
        },
        { status: 404 }
      );
    }

    return NextResponse.json({
      message: "Sub-product deleted successfully.",
      variant_id: result.rows[0].variant_id,
    });
  } catch (error) {
    console.error("Unable to delete sub-product:", error);

    if (error.code === "23503") {
      return NextResponse.json(
        {
          error:
            "This sub-product has related records and cannot be deleted. Deactivate it instead.",
        },
        { status: 409 }
      );
    }

    return NextResponse.json(
      { error: "Unable to delete sub-product." },
      { status: 500 }
    );
  }
}
