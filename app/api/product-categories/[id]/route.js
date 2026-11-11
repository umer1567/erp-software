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
    return jsonError("Please sign in to continue.", 401);
  }

  const allowed = await hasPermission(user.roleId, MODULE, action);

  if (!allowed) {
    return jsonError(
      `You do not have permission to ${action} product categories.`,
      403
    );
  }

  return null;
}

export async function PUT(request, { params }) {
  try {
    const denied = await authorize("update");
    if (denied) return denied;

    const { id } = await params;
    const categoryId = Number(id);

    if (!Number.isSafeInteger(categoryId) || categoryId <= 0) {
      return jsonError("Invalid category ID.", 400);
    }

    let body;

    try {
      body = await request.json();
    } catch {
      return jsonError("Invalid JSON request body.", 400);
    }

    const name = String(body.category_name ?? "").trim();
    const description = String(body.description ?? "").trim();
    const isActive = body.is_active;

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
      `UPDATE product_categories
       SET
         category_name = $1,
         description = $2,
         is_active = $3,
         updated_at = CURRENT_TIMESTAMP
       WHERE category_id = $4
       RETURNING
         category_id,
         category_name,
         description,
         is_active,
         created_at,
         updated_at`,
      [name, description || null, isActive, categoryId]
    );

    if (result.rowCount === 0) {
      return jsonError("Category not found.", 404);
    }

    return NextResponse.json({
      success: true,
      category: result.rows[0],
      message: "Category updated successfully.",
    });
  } catch (error) {
    if (error.code === "23505") {
      return jsonError("This category already exists.", 409);
    }

    console.error("PUT product category:", error);
    return jsonError("Failed to update category.", 500);
  }
}

export async function DELETE(request, { params }) {
  try {
    const denied = await authorize("delete");
    if (denied) return denied;

    const { id } = await params;
    const categoryId = Number(id);

    if (!Number.isSafeInteger(categoryId) || categoryId <= 0) {
      return jsonError("Invalid category ID.", 400);
    }

    const result = await pool.query(
      `DELETE FROM product_categories
       WHERE category_id = $1
       RETURNING category_id, category_name`,
      [categoryId]
    );

    if (result.rowCount === 0) {
      return jsonError("Category not found.", 404);
    }

    return NextResponse.json({
      success: true,
      message: "Category deleted successfully.",
      category: result.rows[0],
    });
  } catch (error) {
    console.error("DELETE product category:", error);

    if (error.code === "23503") {
      return jsonError(
        "This category is being used by products and cannot be deleted.",
        409
      );
    }

    return jsonError("Failed to delete category.", 500);
  }
}