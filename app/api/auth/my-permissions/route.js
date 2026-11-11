
import { NextResponse } from "next/server";
import pool from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json(
        { message: "Unauthorized" },
        { status: 401 }
      );
    }

    const result = await pool.query(
      `
      SELECT
        p.permission_key,
        rp.can_view,
        rp.can_create,
        rp.can_update,
        rp.can_delete
      FROM permissions p
      LEFT JOIN role_permissions rp
        ON rp.permission_id = p.permission_id
       AND rp.role_id = $1
      ORDER BY p.permission_key
      `,
      [user.roleId]
    );

    return NextResponse.json(
      {
        permissions: result.rows.map((row) => ({
          permission_key: row.permission_key,
          can_view: row.can_view === true,
          can_create: row.can_create === true,
          can_update: row.can_update === true,
          can_delete: row.can_delete === true,
        })),
      },
      {
        headers: {
          "Cache-Control": "no-store",
        },
      }
    );
  } catch (error) {
    console.error("My permissions API error:", error);

    return NextResponse.json(
      { message: "Unable to load permissions" },
      { status: 500 }
    );
  }
}
