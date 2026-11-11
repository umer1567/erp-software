
import { NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import bcrypt from "bcryptjs";
import pool from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function jsonResponse(data, status = 200) {
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
  ) {
    return false;
  }

  const a = Buffer.from(expected, "utf8");
  const b = Buffer.from(supplied, "utf8");

  return a.length === b.length && timingSafeEqual(a, b);
}

export async function POST(request) {
  // Only an authorized server-to-server request may reset passwords.
  if (
    !secretsMatch(
      process.env.CLIENT_DATA_API_SECRET,
      request.headers.get("x-client-data-secret")
    )
  ) {
    return jsonResponse(
      { success: false, message: "Unauthorized." },
      401
    );
  }

  let body;

  try {
    body = await request.json();
  } catch {
    return jsonResponse(
      { success: false, message: "Invalid JSON request." },
      400
    );
  }

  const userId = Number(body?.userId);
  const companyId = Number(body?.companyId);
  const newPassword = body?.newPassword;

  if (
    !Number.isSafeInteger(userId) ||
    userId < 1 ||
    !Number.isSafeInteger(companyId) ||
    companyId < 1
  ) {
    return jsonResponse(
      { success: false, message: "Valid user and company IDs are required." },
      400
    );
  }

  if (
    typeof newPassword !== "string" ||
    newPassword.length < 12 ||
    newPassword.length > 128
  ) {
    return jsonResponse(
      {
        success: false,
        message: "The new password must be 12–128 characters long.",
      },
      400
    );
  }

  let db;

  try {
    // Hash the password on the server; never store it as plain text.
    const passwordHash = await bcrypt.hash(newPassword, 12);

    db = await pool.connect();
    await db.query("BEGIN");

    // Lock the company-specific membership row while changing credentials.
    const account = await db.query(
      `SELECT
         u.user_id,
         uc.company_id
       FROM users u
       INNER JOIN user_companies uc
         ON uc.user_id = u.user_id
       INNER JOIN companies c
         ON c.company_id = uc.company_id
       WHERE u.user_id = $1
         AND uc.company_id = $2
         AND u.is_active = TRUE
         AND c.is_active = TRUE
       FOR UPDATE OF uc`,
      [userId, companyId]
    );

    if (account.rowCount === 0) {
      await db.query("ROLLBACK");

      return jsonResponse(
        {
          success: false,
          message: "The user does not belong to this active company.",
        },
        404
      );
    }

    // This is the password field checked by the existing company login.
    const updated = await db.query(
      `UPDATE user_companies
       SET company_password_hash = $1
       WHERE user_id = $2
         AND company_id = $3
       RETURNING user_id`,
      [passwordHash, userId, companyId]
    );

    if (updated.rowCount !== 1) {
      throw new Error("Company password update did not affect one row.");
    }

    // Invalidate outstanding reset links for this same account/company.
    await db.query(
      `UPDATE password_reset_tokens
       SET used_at = NOW()
       WHERE user_id = $1
         AND company_id = $2
         AND used_at IS NULL`,
      [userId, companyId]
    );

    await db.query("COMMIT");

    console.info("Support password reset completed", {
      userId,
      companyId,
      timestamp: new Date().toISOString(),
    });

    return jsonResponse({
      success: true,
      message: "Password updated successfully.",
    });
  } catch (error) {
    if (db) {
      try {
        await db.query("ROLLBACK");
      } catch {}
    }

    console.error("Direct support password reset failed:", {
      message: error.message,
      code: error.code,
    });

    return jsonResponse(
      { success: false, message: "Unable to reset the password." },
      500
    );
  } finally {
    db?.release();
  }
}
