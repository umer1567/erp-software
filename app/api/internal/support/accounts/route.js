
import { NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import pool from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function reply(data, status = 200) {
  return NextResponse.json(data, {
    status,
    headers: {
      "Cache-Control": "no-store",
      Pragma: "no-cache",
    },
  });
}

function secretsMatch(expected, supplied) {
  if (
    typeof expected !== "string" ||
    typeof supplied !== "string" ||
    !expected ||
    !supplied
  ) return false;

  const a = Buffer.from(expected, "utf8");
  const b = Buffer.from(supplied, "utf8");

  return a.length === b.length && timingSafeEqual(a, b);
}

export async function GET(request) {
  if (!secretsMatch(
    process.env.CLIENT_DATA_API_SECRET,
    request.headers.get("x-client-data-secret")
  )) {
    return reply({ success: false, message: "Unauthorized." }, 401);
  }

  try {
    const params = new URL(request.url).searchParams;
    const rawCompanyId = params.get("companyId");

    if (rawCompanyId === null) {
      const result = await pool.query(
        `SELECT company_id, company_name
         FROM companies
         WHERE is_active = TRUE
         ORDER BY company_name`
      );

      return reply({ success: true, companies: result.rows });
    }

    if (!/^[1-9]\d*$/.test(rawCompanyId)) {
      return reply({ success: false, message: "Invalid company ID." }, 400);
    }

    const companyId = Number(rawCompanyId);

    if (!Number.isSafeInteger(companyId)) {
      return reply({ success: false, message: "Invalid company ID." }, 400);
    }

    const companyResult = await pool.query(
      `SELECT company_id
       FROM companies
       WHERE company_id = $1 AND is_active = TRUE
       LIMIT 1`,
      [companyId]
    );

    if (!companyResult.rowCount) {
      return reply({ success: false, message: "Active company not found." }, 404);
    }

    const usersResult = await pool.query(
      `SELECT
         u.user_id,
         u.full_name,
         u.username,
         u.email,
         uc.role_id,
         r.role_name
       FROM user_companies uc
       INNER JOIN users u ON u.user_id = uc.user_id
       INNER JOIN roles r ON r.role_id = uc.role_id
       WHERE uc.company_id = $1
         AND u.is_active = TRUE
         AND (r.company_id IS NULL OR r.company_id = uc.company_id)
       ORDER BY u.full_name, u.username`,
      [companyId]
    );

    return reply({ success: true, users: usersResult.rows });
  } catch (error) {
    console.error("Internal account listing failed:", {
      message: error.message,
      code: error.code,
    });

    return reply({ success: false, message: "Unable to load client accounts." }, 500);
  }
}
