
import { NextResponse } from "next/server";
import { getTenantContext, unauthorizedResponse } from "@/lib/tenant";
import { archiveAndSoftDelete } from "@/lib/recycle-bin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function errorResponse(message, status = 500) {
  return NextResponse.json({ error: message }, { status });
}

function handleDatabaseError(error, operation) {
  console.error(`${operation} unit of measure:`, error);

  if (error.code === "23505") {
    return errorResponse(
      "This unit code already exists. Please use a different code.",
      409
    );
  }

  if (error.code === "23503") {
    return errorResponse(
      "This unit is being used by another record and cannot be deleted or changed in this way.",
      409
    );
  }

  if (["23514", "22P02", "22001"].includes(error.code)) {
    return errorResponse(
      "The provided unit data is invalid.",
      400
    );
  }

  return errorResponse(
    `Failed to ${operation} unit. Check the server terminal for details.`,
    500
  );
}

async function getUnitId(params) {
  const resolvedParams = await params;
  const id = String(resolvedParams?.id ?? "");

  if (!/^[1-9]\d*$/.test(id)) {
    return null;
  }

  const numericId = Number(id);

  if (!Number.isSafeInteger(numericId)) {
    return null;
  }

  return numericId;
}

function validateBody(body) {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return "Invalid request body.";
  }

  const code = String(body.unit_code ?? "").trim();
  const name = String(body.unit_name ?? "").trim();
  const description = String(body.description ?? "").trim();

  if (!code || code.length > 30) {
    return "Unit Code is required and must not exceed 30 characters.";
  }

  if (!name || name.length > 100) {
    return "Unit Name is required and must not exceed 100 characters.";
  }

  if (description.length > 5000) {
    return "Description must not exceed 5000 characters.";
  }

  if (
    body.is_active !== undefined &&
    typeof body.is_active !== "boolean"
  ) {
    return "Invalid active status.";
  }

  return null;
}

// PUT: Update an existing unit
export async function PUT(request, { params }) {
  try {
    const tenant = await getTenantContext();
    if (!tenant) return unauthorizedResponse();
    const { db } = tenant;

    const unitId = await getUnitId(params);

    if (!unitId) {
      return errorResponse("Invalid unit ID.", 400);
    }

    let body;

    try {
      body = await request.json();
    } catch {
      return errorResponse(
        "The request body must contain valid JSON.",
        400
      );
    }

    const validationError = validateBody(body);

    if (validationError) {
      return errorResponse(validationError, 400);
    }

    const code = String(body.unit_code).trim().toUpperCase();
    const name = String(body.unit_name).trim();
    const description = String(body.description ?? "").trim();
    const isActive = body.is_active ?? true;

    const result = await db.query(
      `
        UPDATE units_of_measure
        SET
          unit_code = $1,
          unit_name = $2,
          description = $3,
          is_active = $4,
          updated_at = NOW()
        WHERE unit_id = $5
        WHERE deleted_at IS NULL
        RETURNING
          unit_id,
          unit_code,
          unit_name,
          description,
          is_active,
          created_at,
          updated_at
      `,
      [
        code,
        name,
        description || null,
        isActive,
        unitId,
      ]
    );

    if (result.rowCount === 0) {
      return errorResponse("Unit not found.", 404);
    }

    return NextResponse.json(result.rows[0], {
      status: 200,
      headers: {
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    return handleDatabaseError(error, "update");
  }
}

// DELETE: Delete an existing unit

export async function DELETE(request, { params }) {
  try {
    const tenant = await getTenantContext();
    if (!tenant) return unauthorizedResponse();

    const unitId = await getUnitId(params);

    if (!unitId) {
      return errorResponse("Invalid unit ID.", 400);
    }

    const result = await archiveAndSoftDelete(tenant, {
      moduleKey: "units_of_measure",
      recordId: unitId,
    });

    if (!result.success) {
      return errorResponse(result.message, result.status);
    }

    return NextResponse.json(
      {
        success: true,
        message: "Unit moved to Recycle Bin successfully.",
        recycleBinId: result.archiveId,
        unit: result.record,
      },
      {
        status: 200,
        headers: { "Cache-Control": "no-store" },
      }
    );
  } catch (error) {
    return handleDatabaseError(error, "delete");
  }
}
