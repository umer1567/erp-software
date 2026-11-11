
// import { NextResponse } from "next/server";
// import bcrypt from "bcryptjs";
// import { createHash } from "node:crypto";
// import pool from "@/lib/db";

// export const dynamic = "force-dynamic";

// function jsonError(message, status = 400) {
//   return NextResponse.json(
//     { success: false, message },
//     {
//       status,
//       headers: { "Cache-Control": "no-store" },
//     }
//   );
// }

// export async function POST(request) {
//   let client;

//   try {
//     const body = await request.json();

//     const token =
//       typeof body.token === "string" ? body.token : "";
//     const password =
//       typeof body.password === "string" ? body.password : "";

//     if (!/^[a-f0-9]{64}$/.test(token)) {
//       return jsonError("This reset link is invalid or expired.");
//     }

//     if (password.length < 12 || password.length > 128) {
//       return jsonError(
//         "Your new password must be between 12 and 128 characters."
//       );
//     }

//     const tokenHash = createHash("sha256")
//       .update(token)
//       .digest("hex");

//     const passwordHash = await bcrypt.hash(password, 12);

//     client = await pool.connect();
//     await client.query("BEGIN");

//     // Lock the token so it cannot be used twice concurrently.
//     const tokenResult = await client.query(
//       `SELECT reset_id, user_id, company_id
//        FROM password_reset_tokens
//        WHERE token_hash = $1
//          AND company_id IS NOT NULL
//          AND used_at IS NULL
//          AND expires_at > CURRENT_TIMESTAMP
//        FOR UPDATE`,
//       [tokenHash]
//     );

//     if (tokenResult.rowCount === 0) {
//       await client.query("ROLLBACK");
//       return jsonError("This reset link is invalid or expired.");
//     }

//     const reset = tokenResult.rows[0];

//     // Update only the password for this user's selected company.
//     // Do NOT update users.password_hash here.
//     const updateResult = await client.query(
//       `UPDATE user_companies AS uc
//        SET company_password_hash = $1
//        FROM users AS u, companies AS c
//        WHERE uc.user_id = $2
//          AND uc.company_id = $3
//          AND u.user_id = uc.user_id
//          AND u.is_active = TRUE
//          AND c.company_id = uc.company_id
//          AND c.is_active = TRUE
//        RETURNING uc.user_id`,
//       [passwordHash, reset.user_id, reset.company_id]
//     );

//     if (updateResult.rowCount === 0) {
//       await client.query("ROLLBACK");
//       return jsonError(
//         "The account or company is no longer active or could not be found.",
//         404
//       );
//     }

//     // Consume every outstanding reset token for this same
//     // user and company, leaving other companies unaffected.
//     await client.query(
//       `UPDATE password_reset_tokens
//        SET used_at = CURRENT_TIMESTAMP
//        WHERE user_id = $1
//          AND company_id = $2
//          AND used_at IS NULL`,
//       [reset.user_id, reset.company_id]
//     );

//     await client.query("COMMIT");

//     return NextResponse.json(
//       {
//         success: true,
//         message:
//           "Password changed successfully. Please sign in with your new password.",
//       },
//       {
//         headers: { "Cache-Control": "no-store" },
//       }
//     );
//   } catch (error) {
//     if (client) {
//       try {
//         await client.query("ROLLBACK");
//       } catch {}
//     }

//     console.error("Password reset completion error:", {
//       message: error.message,
//       code: error.code,
//     });

//     return jsonError("Unable to reset your password.", 500);
//   } finally {
//     client?.release();
//   }
// }

import { NextResponse } from "next/server";
import { createHash } from "crypto";
import bcrypt from "bcryptjs";
import pool from "@/lib/db";

export const runtime = "nodejs";

export async function POST(request) {
  let db;

  try {
    const body = await request.json();
    const token = typeof body.token === "string" ? body.token : "";
    const newPassword =
      typeof body.newPassword === "string" ? body.newPassword : "";

    if (!/^[a-f0-9]{64}$/i.test(token)) {
      return NextResponse.json(
        { message: "This reset link is invalid or expired." },
        { status: 400 }
      );
    }

    if (newPassword.length < 12 || newPassword.length > 128) {
      return NextResponse.json(
        { message: "Your new password must be between 12 and 128 characters." },
        { status: 400 }
      );
    }

    const tokenHash = createHash("sha256").update(token).digest("hex");
    const passwordHash = await bcrypt.hash(newPassword, 12);

    db = await pool.connect();
    await db.query("BEGIN");

    const tokenResult = await db.query(
      `SELECT reset_id, user_id, company_id
       FROM password_reset_tokens
       WHERE token_hash = $1
         AND company_id IS NOT NULL
         AND used_at IS NULL
         AND expires_at > NOW()
       FOR UPDATE`,
      [tokenHash]
    );

    if (tokenResult.rowCount === 0) {
      await db.query("ROLLBACK");

      return NextResponse.json(
        { message: "This reset link is invalid, expired, or already used." },
        { status: 400 }
      );
    }

    const reset = tokenResult.rows[0];

    const updateResult = await db.query(
      `UPDATE user_companies uc
       SET company_password_hash = $1
       FROM users u, companies c
       WHERE uc.user_id = $2
         AND uc.company_id = $3
         AND u.user_id = uc.user_id
         AND c.company_id = uc.company_id
         AND u.is_active = TRUE
         AND c.is_active = TRUE
       RETURNING uc.user_id`,
      [passwordHash, reset.user_id, reset.company_id]
    );

    if (updateResult.rowCount === 0) {
      await db.query("ROLLBACK");

      return NextResponse.json(
        { message: "This account or company is no longer active." },
        { status: 400 }
      );
    }

    // Consume every outstanding reset link for this user/company pair.
    await db.query(
      `UPDATE password_reset_tokens
       SET used_at = NOW()
       WHERE user_id = $1
         AND company_id = $2
         AND used_at IS NULL`,
      [reset.user_id, reset.company_id]
    );

    await db.query("COMMIT");

    return NextResponse.json({
      message: "Your company password has been changed. You can now log in.",
    });
  } catch (error) {
    if (db) {
      await db.query("ROLLBACK").catch(() => {});
    }

    console.error("Password reset completion failed:", error);

    return NextResponse.json(
      { message: "Unable to reset the password. Please try again." },
      { status: 500 }
    );
  } finally {
    db?.release();
  }
}