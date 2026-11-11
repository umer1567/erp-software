
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
        { message: "Enter your username and select your company." },
        { status: 400 }
      );
    }

    // Find the active user in the selected company.
    // Email is intentionally not required.
    const result = await pool.query(
      `SELECT
         u.user_id,
         u.username,
         u.full_name,
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

    // Do not reveal whether a username exists.
    const genericMessage =
      "If the account matches this company, your request has been sent for administrator review.";

    if (result.rowCount === 0) {
      return NextResponse.json({ message: genericMessage });
    }

    const account = result.rows[0];

    const superAdminUrl = process.env.SUPER_ADMIN_API_URL?.replace(/\/+$/, "");
    const sharedSecret = process.env.CLIENT_DATA_API_SECRET;
    const clientId = Number(process.env.LICENSE_CLIENT_ID);

    if (
      !superAdminUrl ||
      !sharedSecret ||
      !Number.isInteger(clientId) ||
      clientId < 1
    ) {
      console.error(
        "Password reset integration requires SUPER_ADMIN_API_URL, CLIENT_DATA_API_SECRET and LICENSE_CLIENT_ID."
      );

      return NextResponse.json(
        { message: "Password reset requests are not configured yet." },
        { status: 503 }
      );
    }

    const description = [
      "Manual password reset request from the company login page.",
      `Username: ${account.username}`,
      `User ID: ${account.user_id}`,
      `Company: ${account.company_name}`,
      `Company ID: ${account.company_id}`,
      "No email address was supplied.",
      "Verify the user's identity before approving this request.",
    ].join("\n");

    const response = await fetch(
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
          requesterEmail: null,
          subject: "Company password reset request",
          description,
        }),
        cache: "no-store",
      }
    );

    if (!response.ok) {
      const errorDetails = await response.text().catch(() => "");

      console.error(
        "Super Admin password reset request failed:",
        response.status,
        errorDetails.slice(0, 300)
      );

      return NextResponse.json(
        { message: "The request could not be forwarded. Please try again." },
        { status: 502 }
      );
    }

    return NextResponse.json({ message: genericMessage });
  } catch (error) {
    console.error("Password reset request error:", error);

    return NextResponse.json(
      { message: "An unexpected error occurred. Please try again." },
      { status: 500 }
    );
  }
}
