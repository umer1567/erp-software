
import { NextResponse } from "next/server";
import pool from "@/lib/db";

function validId(value) {
  return /^\d+$/.test(String(value)) && Number(value) > 0;
}

function errorResponse(error, fallback) {
  console.error(fallback, error);

  if (error.code === "23505") {
    return NextResponse.json(
      { error: "This SKU or barcode already exists." },
      { status: 409 }
    );
  }

  if (error.code === "23503") {
    return NextResponse.json(
      { error: "The referenced product or record does not exist." },
      { status: 400 }
    );
  }

  return NextResponse.json(
    { error: fallback },
    { status: 500 }
  );
}

function parseVariant(body) {
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
    return {
      error: "Sub-product code and name are required.",
    };
  }

  if (
    !Number.isFinite(costPrice) ||
    !Number.isFinite(salePrice) ||
    costPrice < 0 ||
    salePrice < 0
  ) {
    return {
      error: "Prices must be valid non-negative numbers.",
    };
  }

  if (
    !Number.isFinite(unitsPerParent) ||
    unitsPerParent <= 0
  ) {
    return {
      error:
        "Units per main product must be greater than zero.",
    };
  }

  return {
    values: {
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
    },
  };
}

export async function GET(request, { params }) {
  const { id } = await params;

  if (!validId(id)) {
    return NextResponse.json(
      { error: "Invalid product ID." },
      { status: 400 }
    );
  }

  try {
    const result = await pool.query(
  `
  SELECT
    sp.sub_product_id AS variant_id,
    sp.product_id,
    sp.sku AS variant_sku,
    sp.sub_product_name AS variant_name,
    sp.description,
    sp.unit,
    sp.units_per_parent,
    sp.color,
    sp.size,
    sp.design,
    sp.barcode,
    sp.cost_price,
    sp.sale_price,
    sp.is_active,

    COALESCE(ps.available_stock, 0)
      AS parent_available_stock,

    COALESCE(ps.available_stock, 0)
      * COALESCE(sp.units_per_parent, 1)
      AS available_stock,

    'conversion' AS stock_source

  FROM sub_products sp

  LEFT JOIN (
    SELECT
      product_id,
      SUM(quantity) AS available_stock
    FROM stock
    GROUP BY product_id
  ) ps
    ON ps.product_id = sp.product_id

  WHERE sp.product_id = $1

  ORDER BY sp.sub_product_id
  `,
  [Number(id)]
);

    return NextResponse.json({
      variants: result.rows,
    });
  } catch (error) {
    return errorResponse(
      error,
      "Unable to load sub-products and stock."
    );
  }
}

export async function POST(request, { params }) {
  const { id } = await params;

  if (!validId(id)) {
    return NextResponse.json(
      { error: "Invalid product ID." },
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

  const parsed = parseVariant(body);

  if (parsed.error) {
    return NextResponse.json(
      { error: parsed.error },
      { status: 400 }
    );
  }

  const {
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
  } = parsed.values;

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const parent = await client.query(
      `SELECT product_id
       FROM products
       WHERE product_id = $1
       FOR UPDATE`,
      [Number(id)]
    );

    if (parent.rowCount === 0) {
      await client.query("ROLLBACK");

      return NextResponse.json(
        { error: "Parent product was not found." },
        { status: 404 }
      );
    }

    const inserted = await client.query(
      `INSERT INTO sub_products (
         product_id,
         sku,
         sub_product_name,
         description,
         unit,
         color,
         size,
         design,
         barcode,
         cost_price,
         sale_price,
         units_per_parent
       )
       VALUES (
         $1, $2, $3, $4, $5, $6,
         $7, $8, $9, $10, $11, $12
       )
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
        Number(id),
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
      ]
    );

    await client.query("COMMIT");

    return NextResponse.json(
      {
        message: "Sub-product created successfully.",
        variant: {
          ...inserted.rows[0],
          parent_available_stock: 0,
          available_stock: 0,
          stock_source: "conversion",
        },
      },
      { status: 201 }
    );
  } catch (error) {
    try {
      await client.query("ROLLBACK");
    } catch (rollbackError) {
      console.error("Rollback error:", rollbackError);
    }

    return errorResponse(
      error,
      "Unable to create sub-product."
    );
  } finally {
    client.release();
  }
}

export async function PUT(request, { params }) {
  const { id } = await params;
  const { searchParams } = new URL(request.url);
  const variantId = searchParams.get("variantId");

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

  const parsed = parseVariant(body);

  if (parsed.error) {
    return NextResponse.json(
      { error: parsed.error },
      { status: 400 }
    );
  }

  const {
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
  } = parsed.values;

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
    return errorResponse(
      error,
      "Unable to update sub-product."
    );
  }
}

export async function DELETE(request, { params }) {
  const { id } = await params;
  const { searchParams } = new URL(request.url);
  const variantId = searchParams.get("variantId");

  if (!validId(id) || !validId(variantId)) {
    return NextResponse.json(
      {
        error:
          "A valid product ID and variantId query parameter are required.",
      },
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
    if (error.code === "23503") {
      return NextResponse.json(
        {
          error:
            "This sub-product has related records and cannot be deleted. Deactivate it instead.",
        },
        { status: 409 }
      );
    }

    return errorResponse(
      error,
      "Unable to delete sub-product."
    );
  }
}
