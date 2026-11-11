
import { NextResponse } from "next/server";
import pool from "@/lib/db";

export const runtime = "nodejs";

export async function GET() {
  try {
    const result = await pool.query(
      `SELECT company_id, company_name
       FROM companies
       WHERE is_active = TRUE
       ORDER BY company_name ASC`
    );

    return NextResponse.json({
      companies: result.rows,
    });
  } catch (error) {
    console.error("Load companies API error:", error);

    return NextResponse.json(
      { message: "Unable to load companies." },
      { status: 500 }
    );
  }
}
