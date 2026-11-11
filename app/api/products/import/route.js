
import { NextResponse } from "next/server";
import * as XLSX from "xlsx";
import pool from "@/lib/db";

export const runtime = "nodejs";

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB
const MAX_ROWS = 10000;

function normalizeHeader(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

function clean(value) {
  if (value === undefined || value === null) return "";
  return String(value).trim();
}

function numberValue(value, fallback = 0) {
  if (value === "" || value === null || value === undefined) {
    return fallback;
  }

  const number = Number(String(value).replace(/,/g, ""));

  return Number.isFinite(number) ? number : NaN;
}

function booleanValue(value, fallback = true) {
  if (value === "" || value === null || value === undefined) {
    return fallback;
  }

  const normalized = String(value).trim().toLowerCase();

  if (["true", "1", "yes", "active"].includes(normalized)) return true;
  if (["false", "0", "no", "inactive"].includes(normalized)) return false;

  return null;
}

function getValue(row, aliases) {
  for (const alias of aliases) {
    const key = normalizeHeader(alias);

    if (Object.prototype.hasOwnProperty.call(row, key)) {
      return clean(row[key]);
    }
  }

  return "";
}

function resolveAccount(value, accounts) {
  const text = clean(value);

  if (!text) return null;

  // Accept an account ID, account code, account name,
  // or a value such as "4100 - Sales".
  const possibleValues = [text];

  if (text.includes(" - ")) {
    possibleValues.push(text.split(" - ")[0].trim());
  }

  for (const possible of possibleValues) {
    const key = possible.toLowerCase();

    if (accounts.byId.has(key)) return accounts.byId.get(key);
    if (accounts.byCode.has(key)) return accounts.byCode.get(key);
    if (accounts.byName.has(key)) return accounts.byName.get(key);
  }

  return undefined;
}

export async function POST(request) {
  let client;

  try {
    const formData = await request.formData();
    const file = formData.get("file");

    if (!file || typeof file.arrayBuffer !== "function") {
      return NextResponse.json(
        { success: false, message: "Please select an Excel or CSV file." },
        { status: 400 }
      );
    }

    if (file.size === 0) {
      return NextResponse.json(
        { success: false, message: "The selected file is empty." },
        { status: 400 }
      );
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        {
          success: false,
          message: "The file exceeds the 10 MB limit.",
        },
        { status: 413 }
      );
    }

    const filename = file.name.toLowerCase();

    if (!filename.endsWith(".xlsx") && !filename.endsWith(".csv")) {
      return NextResponse.json(
        {
          success: false,
          message: "Only .xlsx and .csv files are supported.",
        },
        { status: 400 }
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());

    const workbook = XLSX.read(buffer, {
      type: "buffer",
      cellDates: false,
    });

    const firstSheet = workbook.Sheets[workbook.SheetNames[0]];

    if (!firstSheet) {
      return NextResponse.json(
        { success: false, message: "No worksheet was found." },
        { status: 400 }
      );
    }

    const rawRows = XLSX.utils.sheet_to_json(firstSheet, {
      defval: "",
      raw: false,
    });

    if (rawRows.length === 0) {
      return NextResponse.json(
        { success: false, message: "The file contains no product rows." },
        { status: 400 }
      );
    }

    if (rawRows.length > MAX_ROWS) {
      return NextResponse.json(
        {
          success: false,
          message: `The file has ${rawRows.length} rows. The maximum is ${MAX_ROWS}.`,
        },
        { status: 400 }
      );
    }

    // Normalize spreadsheet headers so "Product Name",
    // "product_name", and "ProductName" are treated alike.
    const rows = rawRows.map((rawRow) => {
      const normalizedRow = {};

      for (const [key, value] of Object.entries(rawRow)) {
        normalizedRow[normalizeHeader(key)] = value;
      }

      return normalizedRow;
    });

    const clientHeaders = Object.keys(rows[0] ?? {});

    const hasSku = clientHeaders.some((header) =>
      ["sku", "productcode", "itemcode"].includes(header)
    );

    const hasProductName = clientHeaders.some((header) =>
      ["productname", "name", "itemname"].includes(header)
    );

    if (!hasSku || !hasProductName) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Required columns are missing. Your file must contain SKU and Product Name columns.",
        },
        { status: 400 }
      );
    }

    client = await pool.connect();

    // Load accounting accounts once, rather than querying each row.
    const accountResult = await client.query(`
      SELECT account_id, account_code, account_name
      FROM chart_of_accounts
    `);

    const accounts = {
      byId: new Map(),
      byCode: new Map(),
      byName: new Map(),
    };

    for (const account of accountResult.rows) {
      accounts.byId.set(
        String(account.account_id).toLowerCase(),
        account.account_id
      );

      if (account.account_code) {
        accounts.byCode.set(
          String(account.account_code).trim().toLowerCase(),
          account.account_id
        );
      }

      if (account.account_name) {
        accounts.byName.set(
          String(account.account_name).trim().toLowerCase(),
          account.account_id
        );
      }
    }

    const existingResult = await client.query(
      `SELECT sku FROM products`
    );

    const existingSkus = new Set(
      existingResult.rows.map((row) => String(row.sku).trim().toLowerCase())
    );

    const seenSkus = new Set();
    const products = [];
    const errors = [];

    for (let index = 0; index < rows.length; index++) {
      const row = rows[index];
      const excelRow = index + 2;

      const sku = getValue(row, ["sku", "product code", "item code"]);
      const productName = getValue(row, [
        "product name",
        "name",
        "item name",
      ]);

      if (!sku || !productName) {
        errors.push(
          `Row ${excelRow}: SKU and Product Name are required.`
        );
        continue;
      }

      const normalizedSku = sku.toLowerCase();

      if (seenSkus.has(normalizedSku)) {
        errors.push(`Row ${excelRow}: SKU "${sku}" is duplicated in the file.`);
        continue;
      }

      if (existingSkus.has(normalizedSku)) {
        errors.push(
          `Row ${excelRow}: SKU "${sku}" already exists in the database.`
        );
        continue;
      }

      seenSkus.add(normalizedSku);

      const salePrice = numberValue(
        getValue(row, ["sale price", "sales price", "saleprice"])
      );

      const costPrice = numberValue(
        getValue(row, ["cost price", "purchase price", "costprice"])
      );

      const minimumStock = numberValue(
        getValue(row, ["minimum stock", "minimumstock", "reorder level"])
      );

      const bannerSequence = numberValue(
        getValue(row, ["banner sequence", "bannersequence"])
      );

      if (
        !Number.isFinite(salePrice) ||
        salePrice < 0 ||
        !Number.isFinite(costPrice) ||
        costPrice < 0 ||
        !Number.isFinite(minimumStock) ||
        minimumStock < 0 ||
        !Number.isFinite(bannerSequence) ||
        bannerSequence < 0 ||
        !Number.isInteger(bannerSequence)
      ) {
        errors.push(
          `Row ${excelRow}: prices, minimum stock, and banner sequence must be valid non-negative numbers; banner sequence must be a whole number.`
        );
        continue;
      }

      const isActive = booleanValue(
        getValue(row, ["is active", "active", "status"]),
        true
      );

      if (isActive === null) {
        errors.push(
          `Row ${excelRow}: Is Active must be Yes/No, True/False, or 1/0.`
        );
        continue;
      }

      const unit =
        getValue(row, ["unit", "stock unit", "units type"]) || "PCS";

      const salesUnit =
        getValue(row, ["sales unit", "salesunit"]) || unit;

      const purchaseUnit =
        getValue(row, ["purchase unit", "purchaseunit"]) || unit;

      const salesAccount = resolveAccount(
        getValue(row, ["sales account", "salesaccount"]),
        accounts
      );

      const receivableAccount = resolveAccount(
        getValue(row, [
          "receivable account",
          "receivableaccount",
          "ar account",
        ]),
        accounts
      );

      const purchaseAccount = resolveAccount(
        getValue(row, ["purchase account", "purchaseaccount"]),
        accounts
      );

      const inventoryAccount = resolveAccount(
        getValue(row, ["inventory account", "inventoryaccount"]),
        accounts
      );

      const cogsAccount = resolveAccount(
        getValue(row, [
          "cogs account",
          "cogsaccount",
          "cost of goods sold account",
        ]),
        accounts
      );

      const invalidAccount = [
        ["Sales Account", salesAccount],
        ["Receivable Account", receivableAccount],
        ["Purchase Account", purchaseAccount],
        ["Inventory Account", inventoryAccount],
        ["COGS Account", cogsAccount],
      ].find(([, accountId]) => accountId === undefined);

      if (invalidAccount) {
        errors.push(
          `Row ${excelRow}: "${invalidAccount[0]}" does not match an account ID, code, or name in your chart of accounts.`
        );
        continue;
      }

      products.push({
        sku,
        productName,
        description: getValue(row, ["description"]),
        category: getValue(row, ["category", "item category"]),
        unit,
        itemType:
          getValue(row, ["item type", "itemtype"]) || "Stock Item",
        brandName: getValue(row, ["brand name", "brand"]),
        model: getValue(row, ["model"]),
        itemColor: getValue(row, ["item color", "color"]),
        itemSize: getValue(row, ["item size", "size"]),
        itemDesign: getValue(row, ["item design", "design"]),
        salesUnit,
        salePrice,
        salesDescription: getValue(row, ["sales description"]),
        salesAccount,
        receivableAccount,
        image: getValue(row, ["image", "image url"]),
        bannerSequence,
        purchaseUnit,
        costPrice,
        purchaseDescription: getValue(row, ["purchase description"]),
        purchaseAccount,
        inventoryAccount,
        cogsAccount,
        minimumStock,
        isActive,
      });
    }

    // Validate the entire spreadsheet before inserting anything.
    if (errors.length > 0) {
      return NextResponse.json(
        {
          success: false,
          message: `Import stopped. ${errors.length} issue(s) found; no products were imported.`,
          errors: errors.slice(0, 100),
          totalErrors: errors.length,
        },
        { status: 400 }
      );
    }

    await client.query("BEGIN");

    for (const product of products) {
      await client.query(
        `
        INSERT INTO products (
          sku,
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
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
          $11, $12, $13, $14, $15, $16, $17, $18,
          $19, $20, $21, $22, $23, $24, $25, $26
        )
        `,
        [
          product.sku,
          product.productName,
          product.description || null,
          product.category || null,
          product.unit,
          product.itemType,
          product.brandName || null,
          product.model || null,
          product.itemColor || null,
          product.itemSize || null,
          product.itemDesign || null,
          product.salesUnit,
          product.salePrice,
          product.salesDescription || null,
          product.salesAccount,
          product.receivableAccount,
          product.image || null,
          product.bannerSequence,
          product.purchaseUnit,
          product.costPrice,
          product.purchaseDescription || null,
          product.purchaseAccount,
          product.inventoryAccount,
          product.cogsAccount,
          product.minimumStock,
          product.isActive,
        ]
      );
    }

    await client.query("COMMIT");

    return NextResponse.json({
      success: true,
      message: `Successfully imported ${products.length} product(s).`,
      imported: products.length,
      errors: [],
    });
  } catch (error) {
    if (client) {
      try {
        await client.query("ROLLBACK");
      } catch (rollbackError) {
        console.error("PRODUCT IMPORT ROLLBACK ERROR:", rollbackError);
      }
    }

    console.error("PRODUCT IMPORT ERROR:", error);

    if (error.code === "23505") {
      return NextResponse.json(
        {
          success: false,
          message:
            "Import stopped because a duplicate SKU was detected. No products from this batch were saved.",
        },
        { status: 409 }
      );
    }

    if (error.code === "23503") {
      return NextResponse.json(
        {
          success: false,
          message:
            "Import stopped because an accounting account reference is invalid. Check the account columns in your file.",
        },
        { status: 400 }
      );
    }

    return NextResponse.json(
      {
        success: false,
        message: "Failed to import products.",
        error: error.message,
      },
      { status: 500 }
    );
  } finally {
    if (client) client.release();
  }
}
