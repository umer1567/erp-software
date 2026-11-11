import { NextResponse } from "next/server";
import pool from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { hasPermission } from "@/lib/permissions";

const MODULE = "warehouses";

async function checkAccess(request, action) {
  const user = await getCurrentUser(request);

  if (!user) {
    return {
      allowed: false,
      status: 401,
      message: "Please log in to continue.",
    };
  }

  const roleId = user.roleId ?? user.role_id;
  const roleName = String(user.roleName ?? user.role_name ?? "").toUpperCase();

  if (roleName === "ADMIN") {
    return { allowed: true, user };
  }

  if (!roleId) {
    return {
      allowed: false,
      status: 403,
      message: "Your role could not be verified.",
    };
  }

  const allowed = await hasPermission(roleId, MODULE, action);

  if (!allowed) {
    return {
      allowed: false,
      status: 403,
      message: `You do not have permission to ${action} warehouses.`,
    };
  }

  return { allowed: true, user };
}

export async function GET(request) {
  try {
    const access = await checkAccess(request, "view");

    if (!access.allowed) {
      return NextResponse.json(
        { success: false, message: access.message },
        { status: access.status }
      );
    }

    const result = await pool.query(`
      SELECT
        warehouse_id,
        warehouse_code,
        warehouse_name,
        location,
        description,
        is_active,
        created_at,
        updated_at
      FROM warehouses
      ORDER BY warehouse_id DESC
    `);

    return NextResponse.json({
      success: true,
      warehouses: result.rows,
    });
  } catch (error) {
    console.error("WAREHOUSE GET ERROR:", error);

    return NextResponse.json(
      {
        success: false,
        message: "Failed to load warehouses.",
      },
      { status: 500 }
    );
  }
}

export async function POST(request) {
  try {
    const access = await checkAccess(request, "create");

    if (!access.allowed) {
      return NextResponse.json(
        { success: false, message: access.message },
        { status: access.status }
      );
    }

    const body = await request.json();

    const warehouseName = String(body.warehouseName ?? "").trim();
    const warehouseCode = String(body.warehouseCode ?? "").trim();
    const location = String(body.location ?? "").trim();
    const description = String(body.description ?? "").trim();
    const isActive = body.isActive !== false;

    if (!warehouseName || !warehouseCode) {
      return NextResponse.json(
        {
          success: false,
          message: "Warehouse name and code are required.",
        },
        { status: 400 }
      );
    }

    const result = await pool.query(
      `
      INSERT INTO warehouses (
        warehouse_name,
        warehouse_code,
        location,
        description,
        is_active
      )
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *
      `,
      [
        warehouseName,
        warehouseCode,
        location || null,
        description || null,
        isActive,
      ]
    );

    return NextResponse.json(
      {
        success: true,
        message: "Warehouse created successfully.",
        warehouse: result.rows[0],
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("WAREHOUSE POST ERROR:", error);

    if (error.code === "23505") {
      return NextResponse.json(
        {
          success: false,
          message: "Warehouse code already exists.",
        },
        { status: 409 }
      );
    }

    return NextResponse.json(
      {
        success: false,
        message: "Failed to create warehouse.",
      },
      { status: 500 }
    );
  }
}