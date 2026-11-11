import { NextResponse } from "next/server";
import pool from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { hasPermission } from "@/lib/permissions";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const PERMISSION_KEY = "products";

const NO_STORE_HEADERS = {
  "Cache-Control": "private, no-cache, no-store, must-revalidate",
};

function jsonError(message, status) {
  return NextResponse.json(
    {
      success: false,
      message,
    },
    {
      status,
      headers: NO_STORE_HEADERS,
    }
  );
}

function normalizeBarcode(value) {
  return value == null ? "" : String(value).trim();
}

function normalizeProduct(product, subProducts = []) {
  return {
    ...product,
    barcode: normalizeBarcode(product.barcode),
    sub_products: subProducts.map((subProduct) => ({
      ...subProduct,
      barcode: normalizeBarcode(subProduct.barcode),
    })),
  };
}

function logPoolStats(label) {
  console.info(`[PRODUCTS] ${label}`, {
    totalConnections: pool.totalCount,
    idleConnections: pool.idleCount,
    waitingRequests: pool.waitingCount,
  });
}

/**
 * Resolve the user's role.
 *
 * Prefer the role already supplied by getCurrentUser().
 * Otherwise, resolve an active company membership.
 */
async function getUserRoleId(user) {
  const existingRoleId = user?.roleId ?? user?.role_id ?? null;

  if (existingRoleId) {
    return existingRoleId;
  }

  const result = await pool.query(
    `SELECT uc.role_id
     FROM user_companies uc
     JOIN companies c
       ON c.company_id = uc.company_id
     JOIN roles r
       ON r.role_id = uc.role_id
     WHERE uc.user_id = $1
       AND c.is_active = TRUE
       AND (r.company_id IS NULL OR r.company_id = uc.company_id)
     ORDER BY c.company_id
     LIMIT 1`,
    [user.userId]
  );

  return result.rows[0]?.role_id ?? null;
}

/**
 * Authenticate the user and enforce the requested permission.
 *
 * Supported actions:
 * view, create, update, delete
 */
async function authorizeProductAction(action) {
  const user = await getCurrentUser();

  if (!user?.userId) {
    return {
      user: null,
      denied: jsonError("Please log in first.", 401),
    };
  }

  let roleId;

  try {
    roleId = await getUserRoleId(user);
  } catch (error) {
    console.error("PRODUCTS ROLE LOOKUP ERROR:", error);

    return {
      user,
      denied: jsonError("Unable to verify your user role.", 500),
    };
  }

  if (!roleId) {
    return {
      user,
      denied: jsonError(
        "Your account does not have an assigned role.",
        403
      ),
    };
  }

  let allowed;

  try {
    allowed = await hasPermission(roleId, PERMISSION_KEY, action);
  } catch (error) {
    console.error("PRODUCTS PERMISSION CHECK ERROR:", error);

    return {
      user,
      denied: jsonError(
        "Unable to verify product permissions.",
        500
      ),
    };
  }

  if (!allowed) {
    const actionLabels = {
      view: "view",
      create: "create",
      update: "edit",
      delete: "delete",
    };

    return {
      user,
      denied: jsonError(
        `You do not have permission to ${actionLabels[action] || action} products.`,
        403
      ),
    };
  }

  return {
    user,
    denied: null,
    roleId,
  };
}

/**
 * Get all four product permissions for the current role.
 *
 * The update permission is exposed to the frontend as canUpdate.
 * You can label this permission "Edit" in the UI.
 */
async function getProductPermissions(roleId) {
  const [canView, canCreate, canUpdate, canDelete] = await Promise.all([
    hasPermission(roleId, PERMISSION_KEY, "view"),
    hasPermission(roleId, PERMISSION_KEY, "create"),
    hasPermission(roleId, PERMISSION_KEY, "update"),
    hasPermission(roleId, PERMISSION_KEY, "delete"),
  ]);

  return {
    canView: Boolean(canView),
    canCreate: Boolean(canCreate),
    canUpdate: Boolean(canUpdate),
    canDelete: Boolean(canDelete),
  };
}

async function runTimedQuery(label, sql) {
  const acquireStartedAt = performance.now();
  let client;

  try {
    client = await pool.connect();

    const acquireMs = Math.round(
      performance.now() - acquireStartedAt
    );

    const queryStartedAt = performance.now();
    const result = await client.query(sql);

    const queryMs = Math.round(
      performance.now() - queryStartedAt
    );

    console.info(`[PRODUCTS] ${label}`, {
      acquireMs,
      queryMs,
      rows: result.rowCount,
    });

    return result;
  } finally {
    if (client) {
      client.release();
    }
  }
}

/**
 * Validate and normalize product fields.
 *
 * Used by both POST and PUT.
 */
function getProductValues(body) {
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
    return {
      error: "SKU and product name are required.",
    };
  }

  const normalizedSalePrice = Number(salePrice ?? 0);
  const normalizedCostPrice = Number(costPrice ?? 0);
  const normalizedMinimumStock = Number(minimumStock ?? 0);

  if (
    !Number.isFinite(normalizedSalePrice) ||
    !Number.isFinite(normalizedCostPrice) ||
    !Number.isFinite(normalizedMinimumStock)
  ) {
    return {
      error: "Prices and minimum stock must be valid numbers.",
    };
  }

  if (
    normalizedSalePrice < 0 ||
    normalizedCostPrice < 0 ||
    normalizedMinimumStock < 0
  ) {
    return {
      error: "Prices and minimum stock cannot be negative.",
    };
  }

  const normalizedBannerSequence = Number(bannerSequence ?? 0);

  if (
    !Number.isSafeInteger(normalizedBannerSequence) ||
    normalizedBannerSequence < 0
  ) {
    return {
      error: "Banner sequence must be a non-negative integer.",
    };
  }

  function normalizeAccountId(value, fieldName) {
    if (value === "" || value == null) {
      return {
        value: null,
      };
    }

    const accountId = Number(value);

    if (!Number.isSafeInteger(accountId) || accountId < 1) {
      return {
        error: `${fieldName} must be a valid accounting account.`,
      };
    }

    return {
      value: accountId,
    };
  }

  const salesAccountResult = normalizeAccountId(
    salesAccount,
    "Sales account"
  );

  const receivableAccountResult = normalizeAccountId(
    receivableAccount,
    "Receivable account"
  );

  const purchaseAccountResult = normalizeAccountId(
    purchaseAccount,
    "Purchase account"
  );

  const inventoryAccountResult = normalizeAccountId(
    inventoryAccount,
    "Inventory account"
  );

  const cogsAccountResult = normalizeAccountId(
    cogsAccount,
    "Cost of goods sold account"
  );

  const accountResults = [
    salesAccountResult,
    receivableAccountResult,
    purchaseAccountResult,
    inventoryAccountResult,
    cogsAccountResult,
  ];

  const invalidAccount = accountResults.find(
    (result) => result.error
  );

  if (invalidAccount) {
    return {
      error: invalidAccount.error,
    };
  }

  return {
    values: [
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
      normalizedSalePrice,
      salesDescription || null,
      salesAccountResult.value,
      receivableAccountResult.value,
      image || null,
      normalizedBannerSequence,
      purchaseUnit || unit || "PCS",
      normalizedCostPrice,
      purchaseDescription || null,
      purchaseAccountResult.value,
      inventoryAccountResult.value,
      cogsAccountResult.value,
      normalizedMinimumStock,
      isActive !== false,
    ],
  };
}

/**
 * GET /api/products
 *
 * Requires View permission.
 *
 * Returns:
 * {
 *   success: true,
 *   products: [],
 *   permissions: {
 *     canView: true,
 *     canCreate: false,
 *     canUpdate: false,
 *     canDelete: false
 *   }
 * }
 */
export async function GET() {
  const startedAt = performance.now();

  try {
    const authorization = await authorizeProductAction("view");

    if (authorization.denied) {
      return authorization.denied;
    }

    logPoolStats("Pool before queries");

    const dbStartedAt = performance.now();

    const productsSQL = `
      SELECT
        p.*,
        sa.account_code AS sales_account_code,
        sa.account_name AS sales_account_name,
        ra.account_code AS receivable_account_code,
        ra.account_name AS receivable_account_name,
        pa.account_code AS purchase_account_code,
        pa.account_name AS purchase_account_name,
        ia.account_code AS inventory_account_code,
        ia.account_name AS inventory_account_name,
        ca.account_code AS cogs_account_code,
        ca.account_name AS cogs_account_name
      FROM products p
      LEFT JOIN chart_of_accounts sa
        ON sa.account_id = p.sales_account_id
      LEFT JOIN chart_of_accounts ra
        ON ra.account_id = p.receivable_account_id
      LEFT JOIN chart_of_accounts pa
        ON pa.account_id = p.purchase_account_id
      LEFT JOIN chart_of_accounts ia
        ON ia.account_id = p.inventory_account_id
      LEFT JOIN chart_of_accounts ca
        ON ca.account_id = p.cogs_account_id
      ORDER BY p.product_id DESC
    `;

    const subProductsSQL = `
      SELECT
        sp.sub_product_id,
        sp.product_id,
        sp.sku,
        sp.sub_product_name,
        sp.description,
        sp.unit,
        sp.cost_price,
        sp.sale_price,
        sp.is_active,
        sp.color,
        sp.size,
        sp.design,
        sp.barcode,
        sp.units_per_parent
      FROM sub_products sp
      ORDER BY sp.product_id, sp.sub_product_id
    `;

    /*
     * Load product data and the role's permissions in parallel.
     */
    const [
      productsResult,
      subProductsResult,
      permissions,
    ] = await Promise.all([
      runTimedQuery("Products query", productsSQL),
      runTimedQuery("Sub-products query", subProductsSQL),
      getProductPermissions(authorization.roleId),
    ]);

    const databaseFinishedAt = performance.now();

    logPoolStats("Pool after queries");

    console.info("[PRODUCTS] Combined database time:", {
      milliseconds: Math.round(databaseFinishedAt - dbStartedAt),
    });

    const subProductsByProduct = new Map();

    for (const subProduct of subProductsResult.rows) {
      const productId = Number(subProduct.product_id);

      if (!subProductsByProduct.has(productId)) {
        subProductsByProduct.set(productId, []);
      }

      subProductsByProduct.get(productId).push(subProduct);
    }

    const products = productsResult.rows.map((product) =>
      normalizeProduct(
        product,
        subProductsByProduct.get(Number(product.product_id)) || []
      )
    );

    /*
     * IMPORTANT:
     * Include permissions in the response so the frontend can
     * conditionally display Add, Edit and Delete actions.
     */
    const payload = {
      success: true,
      products,
      permissions,
    };

    const json = JSON.stringify(payload);
    const payloadBytes = Buffer.byteLength(json, "utf8");
    const finishedAt = performance.now();

    console.info("[PRODUCTS GET PERFORMANCE]", {
      totalMs: Math.round(finishedAt - startedAt),
      databaseMs: Math.round(databaseFinishedAt - dbStartedAt),
      processingMs: Math.round(finishedAt - databaseFinishedAt),
      productCount: productsResult.rowCount,
      subProductCount: subProductsResult.rowCount,
      responseKB: Math.round(payloadBytes / 1024),
    });

    return new Response(json, {
      status: 200,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        ...NO_STORE_HEADERS,
      },
    });
  } catch (error) {
    console.error("PRODUCTS GET ERROR:", {
      message: error.message,
      code: error.code,
      detail: error.detail,
    });

    logPoolStats("Pool after error");

    return jsonError("Failed to load products.", 500);
  }
}

/**
 * POST /api/products
 *
 * Requires Create permission.
 */
export async function POST(request) {
  try {
    const authorization = await authorizeProductAction("create");

    if (authorization.denied) {
      return authorization.denied;
    }

    let body;

    try {
      body = await request.json();
    } catch {
      return jsonError("Invalid request body.", 400);
    }

    const normalized = getProductValues(body);

    if (normalized.error) {
      return jsonError(normalized.error, 400);
    }

    const result = await pool.query(
      `
      INSERT INTO products (
        sku,
        barcode,
        product_name,
        description,
        category,
        unit,
        item_type,
        brand_name,
        model,
        item_color,
        item_size,
        item_design,
        sales_unit,
        sale_price,
        sales_description,
        sales_account_id,
        receivable_account_id,
        image,
        banner_sequence,
        purchase_unit,
        cost_price,
        purchase_description,
        purchase_account_id,
        inventory_account_id,
        cogs_account_id,
        minimum_stock,
        is_active
      )
      VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9,
        $10, $11, $12, $13, $14, $15, $16, $17,
        $18, $19, $20, $21, $22, $23, $24, $25,
        $26, $27
      )
      RETURNING *
      `,
      normalized.values
    );

    return NextResponse.json(
      {
        success: true,
        message: "Product created successfully.",
        product: normalizeProduct(result.rows[0]),
      },
      {
        status: 201,
        headers: NO_STORE_HEADERS,
      }
    );
  } catch (error) {
    console.error("PRODUCTS POST ERROR:", error);

    if (error.code === "23505") {
      return jsonError(
        "This SKU or barcode already exists.",
        409
      );
    }

    if (error.code === "23503") {
      return jsonError(
        "Select valid accounting accounts.",
        400
      );
    }

    if (error.code === "23514") {
      return jsonError(
        "One or more product values violate a database constraint.",
        400
      );
    }

    return jsonError("Failed to create product.", 500);
  }
}

/**
 * PUT /api/products
 *
 * Requires Edit/Update permission.
 *
 * Accepts productId, product_id, or id in the JSON body.
 */
export async function PUT(request) {
  try {
    const authorization = await authorizeProductAction("update");

    if (authorization.denied) {
      return authorization.denied;
    }

    let body;

    try {
      body = await request.json();
    } catch {
      return jsonError("Invalid request body.", 400);
    }

    const productId = Number(
      body.productId ?? body.product_id ?? body.id
    );

    if (!Number.isSafeInteger(productId) || productId < 1) {
      return jsonError("A valid product ID is required.", 400);
    }

    const normalized = getProductValues(body);

    if (normalized.error) {
      return jsonError(normalized.error, 400);
    }

    const values = normalized.values;

    const result = await pool.query(
      `
      UPDATE products
      SET
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
        is_active = $27
      WHERE product_id = $28
      RETURNING *
      `,
      [...values, productId]
    );

    if (result.rowCount === 0) {
      return jsonError("Product not found.", 404);
    }

    return NextResponse.json(
      {
        success: true,
        message: "Product updated successfully.",
        product: normalizeProduct(result.rows[0]),
      },
      {
        status: 200,
        headers: NO_STORE_HEADERS,
      }
    );
  } catch (error) {
    console.error("PRODUCTS PUT ERROR:", error);

    if (error.code === "23505") {
      return jsonError(
        "This SKU or barcode already exists.",
        409
      );
    }

    if (error.code === "23503") {
      return jsonError(
        "Select valid accounting accounts.",
        400
      );
    }

    if (error.code === "23514") {
      return jsonError(
        "One or more product values violate a database constraint.",
        400
      );
    }

    return jsonError("Failed to update product.", 500);
  }
}

/**
 * DELETE /api/products?id=123
 *
 * Requires Delete permission.
 *
 * The frontend should send:
 * DELETE /api/products?id=123
 */
export async function DELETE(request) {
  try {
    const authorization = await authorizeProductAction("delete");

    if (authorization.denied) {
      return authorization.denied;
    }

    const { searchParams } = new URL(request.url);

    const productId = Number(searchParams.get("id"));

    if (!Number.isSafeInteger(productId) || productId < 1) {
      return jsonError(
        "A valid product ID is required in the id query parameter.",
        400
      );
    }

    const result = await pool.query(
      `
      DELETE FROM products
      WHERE product_id = $1
      RETURNING product_id, sku, product_name
      `,
      [productId]
    );

    if (result.rowCount === 0) {
      return jsonError("Product not found.", 404);
    }

    return NextResponse.json(
      {
        success: true,
        message: "Product deleted successfully.",
        product: result.rows[0],
      },
      {
        status: 200,
        headers: NO_STORE_HEADERS,
      }
    );
  } catch (error) {
    console.error("PRODUCTS DELETE ERROR:", error);

    if (error.code === "23503") {
      return jsonError(
        "This product is referenced by other ERP records and cannot be deleted. Deactivate it instead if appropriate.",
        409
      );
    }

    return jsonError("Failed to delete product.", 500);
  }
}