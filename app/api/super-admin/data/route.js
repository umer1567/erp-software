
import { createHash, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import pool from "@/lib/db";
import { verifyClientLicense } from "@/lib/license";

const MODULES = {
  companies: ["companies", "company_settings"],
  users: ["users", "roles", "permissions", "role_permissions", "user_companies"],
  inventory: [
    "products",
    "product_categories",
    "product_units",
    "sub_products",
    "warehouses",
    "stock",
    "unit_stock",
    "units_of_measure",
    "stock_adjustments",
    "stock_adjustment_items",
    "inventory_transactions",
  ],
  sales: [
    "customers",
    "sales_invoices",
    "sales_invoice_items",
    "sales_payments",
  ],
  purchases: [
    "suppliers",
    "purchases",
    "purchase_items",
    "purchase_payments",
  ],
  accounting: [
    "chart_of_accounts",
    "journal_entries",
    "journal_entry_lines",
  ],
  audit: ["audit_logs"],
};

const ALL_TABLES = [...new Set(Object.values(MODULES).flat())];

// Explicit primary/sort columns from your supplied database schema.
const SORT_COLUMNS = {
  companies: "company_id",
  company_settings: "setting_id",
  users: "user_id",
  roles: "role_id",
  permissions: "permission_id",
  role_permissions: "role_permission_id",
  user_companies: "assigned_at",
  products: "product_id",
  product_categories: "category_id",
  product_units: "unit_id",
  sub_products: "sub_product_id",
  warehouses: "warehouse_id",
  stock: "stock_id",
  unit_stock: "unit_stock_id",
  units_of_measure: "unit_id",
  stock_adjustments: "adjustment_id",
  stock_adjustment_items: "adjustment_item_id",
  inventory_transactions: "inventory_transaction_id",
  customers: "customer_id",
  sales_invoices: "invoice_id",
  sales_invoice_items: "invoice_item_id",
  sales_payments: "payment_id",
  suppliers: "supplier_id",
  purchases: "purchase_id",
  purchase_items: "purchase_item_id",
  purchase_payments: "payment_id",
  chart_of_accounts: "account_id",
  journal_entries: "journal_id",
  journal_entry_lines: "journal_line_id",
  audit_logs: "audit_id",
};

function isAuthorized(request) {
  const expected = process.env.CLIENT_DATA_API_SECRET;
  const provided = request.headers.get("x-client-data-secret");

  if (!expected || !provided) return false;

  const expectedHash = createHash("sha256").update(expected).digest();
  const providedHash = createHash("sha256").update(provided).digest();

  return timingSafeEqual(expectedHash, providedHash);
}

export async function GET(request) {
  if (!isAuthorized(request)) {
    return NextResponse.json(
      { success: false, message: "Unauthorized." },
      { status: 401 }
    );
  }

  try {
    const license = await verifyClientLicense();

    if (!license.valid) {
      return NextResponse.json(
        { success: false, message: "Client license is not valid." },
        { status: 403 }
      );
    }

    const requestedModule =
      new URL(request.url).searchParams.get("module") || "companies";

    if (!Object.hasOwn(MODULES, requestedModule)) {
      return NextResponse.json(
        { success: false, message: "Invalid module." },
        { status: 400 }
      );
    }

    // Discover columns only from the fixed allowlist of tables.
    const schemaResult = await pool.query(
      `SELECT table_name, column_name, ordinal_position
       FROM information_schema.columns
       WHERE table_schema = 'public'
         AND table_name = ANY($1::text[])
       ORDER BY table_name, ordinal_position`,
      [MODULES[requestedModule]]
    );

    const columnsByTable = {};

    for (const item of schemaResult.rows) {
      // Never return password hashes, secrets, tokens, or raw audit payloads.
      if (
        /password|secret|token|credential|private_key|api_key|hash/i.test(
          item.column_name
        ) ||
        ["old_data", "new_data", "user_agent", "ip_address"].includes(
          item.column_name
        )
      ) {
        continue;
      }

      if (!columnsByTable[item.table_name]) {
        columnsByTable[item.table_name] = [];
      }

      columnsByTable[item.table_name].push(item.column_name);
    }

    const tableEntries = await Promise.all(
      MODULES[requestedModule].map(async (tableName) => {
        const columns = columnsByTable[tableName] || [];

        if (!columns.length || !ALL_TABLES.includes(tableName)) {
          return [
            tableName,
            { count: 0, columns: [], rows: [], error: "No readable columns." },
          ];
        }

        // All table/column identifiers come from our allowlist/schema query.
        const quotedColumns = columns
          .map((column) => `"${column}"`)
          .join(", ");

        const countResult = await pool.query(
          `SELECT COUNT(*)::int AS count FROM public."${tableName}"`
        );

        const sortColumn = SORT_COLUMNS[tableName];
        const safeSortColumn = columns.includes(sortColumn)
          ? sortColumn
          : columns[0];

        const rowsResult = await pool.query(
          `SELECT ${quotedColumns}
           FROM public."${tableName}"
           ORDER BY "${safeSortColumn}" DESC NULLS LAST
           LIMIT 50`
        );

        return [
          tableName,
          {
            count: countResult.rows[0].count,
            columns,
            rows: rowsResult.rows,
          },
        ];
      })
    );

    const tables = Object.fromEntries(tableEntries);

    return NextResponse.json(
      {
        success: true,
        license: { valid: true, clientId: license.clientId },
        module: requestedModule,
        modules: Object.keys(MODULES),
        tables,
      },
      {
        headers: {
          "Cache-Control": "no-store, max-age=0",
        },
      }
    );
  } catch (error) {
    console.error("Super Admin client-data API error:", error.message);

    return NextResponse.json(
      { success: false, message: "Unable to load client ERP data." },
      { status: 500 }
    );
  }
}
