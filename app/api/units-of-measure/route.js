import { NextResponse } from "next/server";
import pool from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { hasPermission } from "@/lib/permissions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PERMISSION_KEY = "units_of_measure";

function errorResponse(message, status = 500) {
  return NextResponse.json({ error: message }, { status });
}

async function authorize(action) {
  const user = await getCurrentUser();

  if (!user) {
    return { response: errorResponse("Authentication required.", 401) };
  }

  const allowed = await hasPermission(
    user.roleId ?? user.role_id,
    PERMISSION_KEY,
    action
  );

  if (!allowed) {
    return {
      response: errorResponse("You do not have permission.", 403),
    };
  }

  return { user };
}

function handleDatabaseError(error, operation) {
  console.error(`${operation} units of measure:`, error);

  if (error.code === "23505") {
    return errorResponse("This unit code already exists.", 409);
  }

  if (error.code === "23503") {
    return errorResponse(
      "This unit is referenced by another record and cannot be changed or deleted.",
      409
    );
  }

  if (["23514", "22P02", "22001"].includes(error.code)) {
    return errorResponse("The provided unit data is invalid.", 400);
  }

  return errorResponse(`Failed to ${operation} unit.`, 500);
}

function validateUnit(body) {
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

// GET: View units and return the current user's permissions.
export async function GET() {
  try {
    const authorization = await authorize("view");

    if (authorization.response) return authorization.response;

    const roleId =
      authorization.user.roleId ?? authorization.user.role_id;

    const [result, canCreate, canUpdate, canDelete] = await Promise.all([
      pool.query(`
        SELECT
          unit_id,
          unit_code,
          unit_name,
          description,
          is_active,
          created_at,
          updated_at
        FROM units_of_measure
        ORDER BY unit_code ASC
      `),
      hasPermission(roleId, PERMISSION_KEY, "create"),
      hasPermission(roleId, PERMISSION_KEY, "update"),
      hasPermission(roleId, PERMISSION_KEY, "delete"),
    ]);

    return NextResponse.json(
      {
        success: true,
        units: result.rows,
        permissions: {
          canView: true,
          canCreate,
          canUpdate,
          canDelete,
        },
      },
      {
        status: 200,
        headers: { "Cache-Control": "no-store" },
      }
    );
  } catch (error) {
    return handleDatabaseError(error, "load");
  }
}

// POST: Create a unit.
export async function POST(request) {
  try {
    const authorization = await authorize("create");

    if (authorization.response) return authorization.response;

    let body;

    try {
      body = await request.json();
    } catch {
      return errorResponse("The request body must contain valid JSON.", 400);
    }

    const validationError = validateUnit(body);

    if (validationError) {
      return errorResponse(validationError, 400);
    }

    const result = await pool.query(
      `
        INSERT INTO units_of_measure (
          unit_code, unit_name, description, is_active
        )
        VALUES ($1, $2, $3, $4)
        RETURNING
          unit_id, unit_code, unit_name, description,
          is_active, created_at, updated_at
      `,
      [
        String(body.unit_code).trim().toUpperCase(),
        String(body.unit_name).trim(),
        String(body.description ?? "").trim() || null,
        body.is_active ?? true,
      ]
    );

    return NextResponse.json(result.rows[0], {
      status: 201,
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    return handleDatabaseError(error, "create");
  }
}