import { NextResponse } from "next/server";
import pool from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { hasPermission } from "@/lib/permissions";
import * as XLSX from "xlsx";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MODULE = "product_categories";
const MAX_FILE_SIZE = 5 * 1024 * 1024;

function jsonError(message, status, extra = {}) {
  return NextResponse.json(
    { success: false, error: message, message, ...extra },
    {
      status,
      headers: { "Cache-Control": "no-store" },
    }
  );
}

function normalizeHeader(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ");
}

function parseBoolean(value) {
  if (value === "" || value == null) return true;
  if (typeof value === "boolean") return value;

  const normalized = String(value).trim().toLowerCase();

  if (["true", "yes", "1", "active", "y"].includes(normalized)) {
    return true;
  }

  if (
    ["false", "no", "0", "inactive", "n"].includes(normalized)
  ) {
    return false;
  }

  throw new Error(
    'Invalid active status. Use true/false, yes/no, 1/0, or active/inactive.'
  );
}

export async function POST(request) {
  let client;
  let transactionStarted = false;

  try {
    const user = await getCurrentUser();

    if (!user?.userId || !user?.roleId) {
      return jsonError("Please sign in to continue.", 401);
    }

    const allowed = await hasPermission(
      user.roleId,
      MODULE,
      "create"
    );

    if (!allowed) {
      return jsonError(
        "You do not have permission to import product categories.",
        403
      );
    }

    const formData = await request.formData();
    const file = formData.get("file");

    if (!file || typeof file.arrayBuffer !== "function") {
      return jsonError("Select an Excel or CSV file.", 400);
    }

    const filename = String(file.name ?? "");
    const extension = filename.split(".").pop()?.toLowerCase();

    if (!["xlsx", "csv"].includes(extension)) {
      return jsonError(
        "Choose an Excel (.xlsx) or CSV (.csv) file.",
        400
      );
    }

    if (file.size <= 0) {
      return jsonError("The selected file is empty.", 400);
    }

    if (file.size > MAX_FILE_SIZE) {
      return jsonError("File size cannot exceed 5 MB.", 413);
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const workbook = XLSX.read(buffer, { type: "buffer" });
    const firstSheetName = workbook.SheetNames[0];

    if (!firstSheetName) {
      return jsonError("The spreadsheet contains no worksheet.", 400);
    }

    const rows = XLSX.utils.sheet_to_json(
      workbook.Sheets[firstSheetName],
      {
        defval: "",
        raw: false,
      }
    );

    if (rows.length === 0) {
      return jsonError(
        "The spreadsheet contains no data rows.",
        400
      );
    }

    const errors = [];
    let imported = 0;
    let skipped = 0;
    const seenNames = new Set();

    client = await pool.connect();
    await client.query("BEGIN");
    transactionStarted = true;

    for (let index = 0; index < rows.length; index++) {
      const rowNumber = index + 2;
      const row = {};

      for (const [key, value] of Object.entries(rows[index])) {
        row[normalizeHeader(key)] = value;
      }

      const categoryName = String(
        row["category name"] ??
          row.category ??
          row["category name *"] ??
          ""
      ).trim();

      const description = String(row.description ?? "").trim();

      let isActive;

      try {
        if (!categoryName) {
          throw new Error("Category Name is required.");
        }

        if (categoryName.length > 100) {
          throw new Error(
            "Category Name cannot exceed 100 characters."
          );
        }

        const duplicateKey = categoryName.toLowerCase();

        if (seenNames.has(duplicateKey)) {
          throw new Error(
            "Duplicate category name in the spreadsheet."
          );
        }

        seenNames.add(duplicateKey);
        isActive = parseBoolean(
          row["is active"] ?? row.active ?? ""
        );
      } catch (error) {
        errors.push(`Row ${rowNumber}: ${error.message}`);
        skipped++;
        continue;
      }

      try {
        await client.query("SAVEPOINT category_row");

        const result = await client.query(
          `INSERT INTO product_categories
             (category_name, description, is_active)
           VALUES ($1, $2, $3)
           ON CONFLICT DO NOTHING
           RETURNING category_id`,
          [categoryName, description || null, isActive]
        );

        if (result.rowCount === 0) {
          await client.query("ROLLBACK TO SAVEPOINT category_row");
          errors.push(
            `Row ${rowNumber}: "${categoryName}" already exists or conflicts with a database constraint.`
          );
          skipped++;
        } else {
          imported++;
        }

        await client.query("RELEASE SAVEPOINT category_row");
      } catch (error) {
        await client.query("ROLLBACK TO SAVEPOINT category_row");
        await client.query("RELEASE SAVEPOINT category_row");

        errors.push(`Row ${rowNumber}: ${error.message}`);
        skipped++;
      }
    }

    await client.query("COMMIT");
    transactionStarted = false;

    return NextResponse.json({
      success: true,
      message: `Imported ${imported} categories; skipped ${skipped}.`,
      imported,
      skipped,
      errors,
    });
  } catch (error) {
    if (client && transactionStarted) {
      try {
        await client.query("ROLLBACK");
      } catch (rollbackError) {
        console.error("Product category import rollback:", rollbackError);
      }
    }

    console.error("Product category import error:", error);

    return jsonError("Category import failed.", 500);
  } finally {
    client?.release();
  }
}