import { NextResponse } from "next/server";
import pool from "@/lib/db";

export const runtime = "nodejs";

export async function POST(request) {
  try {
    const body = await request.json();
    const username =
      typeof body.username === "string" ? body.username.trim() : "";
    const companyId = Number(body.companyId);

    if (!username || !Number.isInteger(companyId) || companyId < 1) {
      return NextResponse.json(
        { message: "Enter a username and select a valid company." },
        { status: 400 }
      );
    }

    // Check that this active user belongs to the selected active company.
    const accountResult = await pool.query(
      `SELECT
         u.user_id,
         u.username,
         u.full_name,
         u.email,
         uc.company_id,
         c.company_name
       FROM users u
       INNER JOIN user_companies uc
         ON uc.user_id = u.user_id
       INNER JOIN companies c
         ON c.company_id = uc.company_id
       WHERE LOWER(u.username) = LOWER($1)
         AND uc.company_id = $2
         AND u.is_active = TRUE
         AND c.is_active = TRUE
       LIMIT 1`,
      [username, companyId]
    );

    // Use the same public response for unknown accounts to reduce
    // account enumeration. Do not disclose whether a username exists.
    const genericMessage =
      "If the account matches this company, the reset request will be reviewed by the administrator.";

    if (accountResult.rowCount === 0) {
      return NextResponse.json({ message: genericMessage });
    }

    const account = accountResult.rows[0];

    const superAdminUrl = process.env.SUPER_ADMIN_API_URL?.replace(/\/+$/, "");
    const sharedSecret = process.env.CLIENT_DATA_API_SECRET;
    const clientId = Number(process.env.LICENSE_CLIENT_ID);

    if (
      !superAdminUrl ||
      !sharedSecret ||
      !Number.isInteger(clientId) ||
      clientId < 1
    ) {
      console.error("Password reset request integration is not configured.");
      return NextResponse.json(
        { message: "Password reset requests are temporarily unavailable." },
        { status: 503 }
      );
    }

    const description = [
      "Password reset requested from the company login page.",
      `Username: ${account.username}`,
      `Company: ${account.company_name}`,
      `Company ID: ${account.company_id}`,
      `User ID: ${account.user_id}`,
      "No email address was provided. Verify the requester's identity before approval.",
    ].join("\n");

    const superAdminResponse = await fetch(
      `${superAdminUrl}/api/public/support-requests`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-client-data-secret": sharedSecret,
        },
        body: JSON.stringify({
          clientId,
          companyId: account.company_id,
          requesterUserId: account.user_id,
          category: "password_reset",
          companyName: account.company_name,
          requesterName: account.full_name || account.username,
          requesterEmail: account.email || null,
          subject: "Company password reset request",
          description,
        }),
        cache: "no-store",
      }
    );

    if (!superAdminResponse.ok) {
      const errorText = await superAdminResponse.text().catch(() => "");
      console.error(
        "Super Admin rejected password reset request:",
        superAdminResponse.status,
        errorText.slice(0, 500)
      );

      return NextResponse.json(
        { message: "The request could not be forwarded. Please try again later." },
        { status: 502 }
      );
    }

    return NextResponse.json({ message: genericMessage });
  } catch (error) {
    console.error("Password reset request API failed:", error);
    return NextResponse.json(
      { message: "An unexpected error occurred. Please try again later." },
      { status: 500 }
    );
  }
}