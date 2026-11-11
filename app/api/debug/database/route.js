import { NextResponse } from "next/server";
import pool from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const result = await pool.query(`
      SELECT
        current_database() AS database_name,
        current_schema() AS schema_name,
        current_setting('search_path') AS search_path,
        rp.role_id,
        rp.permission_id,
        p.permission_key,
        rp.can_view,
        rp.can_create,
        rp.can_update,
        rp.can_delete
      FROM role_permissions rp
      JOIN permissions p
        ON p.permission_id = rp.permission_id
      WHERE rp.role_id = 1
        AND rp.permission_id = 38
    `);

    return NextResponse.json({
      database: result.rows[0] ?? null,
    });
  } catch (error) {
    console.error("Database diagnostic error:", error);

    return NextResponse.json(
      { message: "Database diagnostic failed" },
      { status: 500 }
    );
  }
}