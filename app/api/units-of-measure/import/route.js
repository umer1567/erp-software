
import { NextResponse } from "next/server";
import * as XLSX from "xlsx";
import pool from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_FILE_SIZE = 5 * 1024 * 1024;

function normalizeHeader(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ");
}

function parseBoolean(value) {
  if (value === undefined || value === null || value === "") {
    return true;
  }

  if (typeof value === "boolean") {
    return value;
  }

  const normalized = String(value).trim().toLowerCase();

  if (["true", "1", "yes", "active"].includes(normalized)) {
    return true;
  }

  if (["false", "0", "no", "inactive"].includes(normalized)) {
    return false;
  }

  throw new Error(`Invalid Is Active value: ${value}`);
}

export async function POST(request) {
  let client;
  let transactionStarted = false;

  try {
    const formData = await request.formData();
    const file = formData.get("file");

    if (!file || typeof file.arrayBuffer !== "function") {
      return NextResponse.json(
        { error: "Please select an Excel or CSV file." },
        { status: 400 }
      );
    }

    const extension = String(file.name ?? "")
      .split(".")
      .pop()
      ?.toLowerCase();

    if (!["xlsx", "csv"].includes(extension)) {
      return NextResponse.json(
        { error: "Only .xlsx and .csv files are supported." },
        { status: 400 }
      );
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: "File size must not exceed 5 MB." },
        { status: 400 }
      );
    }

    if (file.size === 0) {
      return NextResponse.json(
        { error: "The selected file is empty." },
        { status: 400 }
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const workbook = XLSX.read(buffer, { type: "buffer" });
    const sheetName = workbook.SheetNames[0];

    if (!sheetName) {
      return NextResponse.json(
        { error: "No worksheet found in the uploaded file." },
        { status: 400 }
      );
    }

    const rows = XLSX.utils.sheet_to_json(
      workbook.Sheets[sheetName],
      {
        defval: "",
        raw: false,
      }
    );

    if (!rows.length) {
      return NextResponse.json(
        { error: "The spreadsheet contains no data rows." },
        { status: 400 }
      );
    }

    const errors = [];
    const seenCodes = new Set();

    let imported = 0;
    let skipped = 0;

    client = await pool.connect();
    await client.query("BEGIN");
    transactionStarted = true;

    for (let index = 0; index < rows.length; index++) {
      const rowNumber = index + 2;
      const row = {};

      for (const [key, value] of Object.entries(rows[index])) {
        row[normalizeHeader(key)] = value;
      }

      const unitCode = String(
        row["unit code"] ?? row.code ?? ""
      ).trim().toUpperCase();

      const unitName = String(
        row["unit name"] ?? row.name ?? ""
      ).trim();

      const description = String(
        row.description ?? ""
      ).trim();

      try {
        if (!unitCode) {
          throw new Error("Unit Code is required.");
        }

        if (!unitName) {
          throw new Error("Unit Name is required.");
        }

        if (unitCode.length > 30) {
          throw new Error("Unit Code cannot exceed 30 characters.");
        }

        if (unitName.length > 100) {
          throw new Error("Unit Name cannot exceed 100 characters.");
        }

        if (description.length > 5000) {
          throw new Error("Description cannot exceed 5000 characters.");
        }

        const normalizedCode = unitCode.toLowerCase();

        if (seenCodes.has(normalizedCode)) {
          throw new Error(
            `Duplicate Unit Code "${unitCode}" in the spreadsheet.`
          );
        }

        seenCodes.add(normalizedCode);

        const isActive = parseBoolean(
          row["is active"] ?? row.active ?? ""
        );

        await client.query("SAVEPOINT unit_row");

        const existing = await client.query(
          `SELECT unit_id
           FROM units_of_measure
           WHERE LOWER(unit_code) = LOWER($1)
           LIMIT 1`,
          [unitCode]
        );

        if (existing.rowCount > 0) {
          await client.query("ROLLBACK TO SAVEPOINT unit_row");
          await client.query("RELEASE SAVEPOINT unit_row");

          errors.push(
            `Row ${rowNumber}: Unit Code "${unitCode}" already exists.`
          );
          skipped++;
          continue;
        }

        await client.query(
          `INSERT INTO units_of_measure
             (unit_code, unit_name, description, is_active)
           VALUES ($1, $2, $3, $4)`,
          [unitCode, unitName, description || null, isActive]
        );

        await client.query("RELEASE SAVEPOINT unit_row");
        imported++;
      } catch (error) {
        try {
          await client.query("ROLLBACK TO SAVEPOINT unit_row");
          await client.query("RELEASE SAVEPOINT unit_row");
        } catch {
          // The savepoint might not exist if validation failed first.
        }

        errors.push(`Row ${rowNumber}: ${error.message}`);
        skipped++;
      }
    }

    await client.query("COMMIT");
    transactionStarted = false;

    return NextResponse.json({
      success: true,
      message: `Imported ${imported} units. Skipped ${skipped}.`,
      imported,
      skipped,
      errors,
    });
  } catch (error) {
    if (client && transactionStarted) {
      try {
        await client.query("ROLLBACK");
      } catch {
        // Ignore rollback errors.
      }
    }

    console.error("POST /api/units-of-measure/import:", error);

    return NextResponse.json(
      {
        error:
          "Unit import failed. Check the server terminal and database schema.",
      },
      { status: 500 }
    );
  } finally {
    client?.release();
  }
}
