
import { NextResponse } from "next/server";
import pool from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

function unauthorizedResponse() {
  // Do not clear erp_token here.
  // A delayed response from an expired session must never
  // delete a newer cookie issued by a successful login.
  return NextResponse.json(
    {
      success: false,
      code: "SESSION_EXPIRED",
      message: "Your session has expired. Please log in again.",
    },
    {
      status: 401,
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate",
      },
    }
  );
}

export async function POST() {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return unauthorizedResponse();
    }

    const result = await pool.query(
      `
        UPDATE user_sessions
        SET last_activity_at = CURRENT_TIMESTAMP
        WHERE session_id = $1
          AND user_id = $2
          AND company_id = $3
          AND revoked_at IS NULL
          AND expires_at > CURRENT_TIMESTAMP
          AND created_at > CURRENT_TIMESTAMP - INTERVAL '10 hours'
          AND last_activity_at > CURRENT_TIMESTAMP - INTERVAL '25 minutes'
        RETURNING session_id
      `,
      [user.sessionId, user.userId, user.companyId]
    );

    if (result.rowCount === 0) {
      return unauthorizedResponse();
    }

    return NextResponse.json(
      {
        success: true,
        message: "Session activity updated.",
      },
      {
        headers: {
          "Cache-Control": "no-store",
        },
      }
    );
  } catch (error) {
    console.error("Session activity error:", error);

    return NextResponse.json(
      {
        success: false,
        message: "Unable to validate session.",
      },
      {
        status: 500,
        headers: {
          "Cache-Control": "no-store",
        },
      }
    );
  }
}
