
import { NextResponse } from "next/server";
import pool from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(request) {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json(
        { success: false, message: "Unauthorized", permissions: [] },
        {
          status: 401,
          headers: { "Cache-Control": "no-store" },
        }
      );
    }

    if (!user.roleId) {
      return NextResponse.json(
        {
          success: false,
          message: "User role not found",
          permissions: [],
        },
        {
          status: 403,
          headers: { "Cache-Control": "no-store" },
        }
      );
    }

    const { searchParams } = new URL(request.url);
    const permissionKey = searchParams.get("permissionKey");

    // If permissionKey is provided, return that permission only.
    if (permissionKey) {
      const result = await pool.query(
        `
          SELECT
            p.permission_id,
            p.permission_key,
            COALESCE(rp.can_view, FALSE) AS can_view,
            COALESCE(rp.can_create, FALSE) AS can_create,
            COALESCE(rp.can_update, FALSE) AS can_update,
            COALESCE(rp.can_delete, FALSE) AS can_delete
          FROM permissions p
          LEFT JOIN role_permissions rp
            ON rp.permission_id = p.permission_id
            AND rp.role_id = $1
          WHERE p.permission_key = $2
          LIMIT 1
        `,
        [user.roleId, permissionKey]
      );

      if (result.rows.length === 0) {
        return NextResponse.json(
          {
            success: true,
            permission: {
              permission_key: permissionKey,
              can_view: false,
              can_create: false,
              can_update: false,
              can_delete: false,
            },
          },
          {
            status: 200,
            headers: { "Cache-Control": "no-store" },
          }
        );
      }

      return NextResponse.json(
        {
          success: true,
          permission: result.rows[0],
        },
        {
          status: 200,
          headers: { "Cache-Control": "no-store" },
        }
      );
    }

    // Without permissionKey, return the complete permission matrix.
    const result = await pool.query(
      `
        SELECT
          p.permission_id,
          p.permission_key,
          COALESCE(rp.can_view, FALSE) AS can_view,
          COALESCE(rp.can_create, FALSE) AS can_create,
          COALESCE(rp.can_update, FALSE) AS can_update,
          COALESCE(rp.can_delete, FALSE) AS can_delete
        FROM permissions p
        LEFT JOIN role_permissions rp
          ON rp.permission_id = p.permission_id
          AND rp.role_id = $1
        ORDER BY p.permission_id
      `,
      [user.roleId]
    );

    return NextResponse.json(
      {
        success: true,
        permissions: result.rows,
      },
      {
        status: 200,
        headers: { "Cache-Control": "no-store" },
      }
    );
  } catch (error) {
    console.error("GET /api/permissions/current error:", error);

    return NextResponse.json(
      {
        success: false,
        message: "Unable to load current user permissions",
        permissions: [],
      },
      {
        status: 500,
        headers: { "Cache-Control": "no-store" },
      }
    );
  }
}
