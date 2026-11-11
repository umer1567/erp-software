import { NextResponse } from "next/server";
import pool from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { hasPermission } from "@/lib/permissions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MODULE = "product_categories";

function jsonError(message, status) {
  return NextResponse.json(
    { success: false, error: message, message },
    {
      status,
      headers: { "Cache-Control": "no-store" },
    }
  );
}

async function authorize(action) {
  const user = await getCurrentUser();

  if (!user?.userId || !user?.roleId) {
    return {
      user: null,
      response: jsonError("Please sign in to continue.", 401),
    };
  }

  const allowed = await hasPermission(user.roleId, MODULE, action);

  if (!allowed) {
    return {
      user,
      response: jsonError(
        `You do not have permission to ${action} product categories.`,
        403
      ),
    };
  }

  return { user, response: null };
}

export async function GET() {
  try {
    const access = await authorize("view");
    if (access.response) return access.response;

    const result = await pool.query(`
      SELECT
        category_id,
        category_name,
        description,
        is_active,
        created_at,
        updated_at
      FROM product_categories
      ORDER BY category_name ASC
    `);

    return NextResponse.json(result.rows, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    console.error("GET product categories:", error);

    return jsonError(
      "Failed to load product categories.",
      error.message === "UNAUTHORIZED" ? 401 : 500
    );
  }
}

export async function POST(request) {
  try {
    const access = await authorize("create");
    if (access.response) return access.response;

    let body;

    try {
      body = await request.json();
    } catch {
      return jsonError("Invalid JSON request body.", 400);
    }

    const name = String(body.category_name ?? "").trim();
    const description = String(body.description ?? "").trim();
    const isActive = body.is_active ?? true;

    if (!name) {
      return jsonError("Category name is required.", 400);
    }

    if (name.length > 100) {
      return jsonError(
        "Category name cannot exceed 100 characters.",
        400
      );
    }

    if (typeof isActive !== "boolean") {
      return jsonError("Invalid active status.", 400);
    }

    const result = await pool.query(
      `INSERT INTO product_categories
        (category_name, description, is_active)
       VALUES ($1, $2, $3)
       RETURNING
        category_id,
        category_name,
        description,
        is_active,
        created_at,
        updated_at`,
      [name, description || null, isActive]
    );

    return NextResponse.json(
      {
        success: true,
        category: result.rows[0],
        message: "Category created successfully.",
      },
      { status: 201 }
    );
  } catch (error) {
    if (error.code === "23505") {
      return jsonError("This category already exists.", 409);
    }

    console.error("POST product categories:", error);

    return jsonError("Failed to create category.", 500);
  }
}