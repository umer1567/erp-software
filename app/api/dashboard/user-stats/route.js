
import { NextResponse } from "next/server";
import pool from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { hasPermission } from "@/lib/permissions";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const runtime = "nodejs";

function jsonResponse(data, status = 200) {
  return NextResponse.json(data, {
    status,
    headers: {
      "Cache-Control": "no-store, no-cache, must-revalidate",
    },
  });
}

export async function GET() {
  try {
    const currentUser = await getCurrentUser();

    if (!currentUser) {
      return jsonResponse(
        { success: false, message: "Unauthorized." },
        401
      );
    }

    const userId = currentUser.userId ?? currentUser.user_id;

    if (!userId) {
      return jsonResponse(
        { success: false, message: "Invalid user session." },
        401
      );
    }

    const memberships = await pool.query(
      `
        SELECT
          uc.company_id,
          uc.role_id,
          r.role_name
        FROM user_companies uc
        JOIN users u ON u.user_id = uc.user_id
        JOIN companies c ON c.company_id = uc.company_id
        JOIN roles r ON r.role_id = uc.role_id
        WHERE uc.user_id = $1
          AND u.is_active = TRUE
          AND c.is_active = TRUE
        ORDER BY uc.assigned_at, uc.company_id
      `,
      [userId]
    );

    const allowedCompanyIds = [];

    for (const membership of memberships.rows) {
      const canViewUsers = await hasPermission(
        membership.role_id,
        "users",
        "view"
      );

      if (canViewUsers === true) {
        allowedCompanyIds.push(membership.company_id);
      }
    }

    if (allowedCompanyIds.length === 0) {
      return jsonResponse(
        {
          success: false,
          message: "You do not have permission to view user statistics.",
        },
        403
      );
    }

    const result = await pool.query(
      `
        WITH company_users AS (
          SELECT DISTINCT
            u.user_id,
            u.is_active,
            u.last_login
          FROM user_companies uc
          JOIN users u ON u.user_id = uc.user_id
          JOIN companies c ON c.company_id = uc.company_id
          WHERE uc.company_id = ANY($1::int[])
            AND c.is_active = TRUE
            AND u.is_active IN (TRUE, FALSE)
        ),
        login_counts AS (
          SELECT COUNT(*)::int AS total_login_events
          FROM user_login_history
          WHERE company_id = ANY($1::int[])
        )
        SELECT
          COUNT(*)::int AS total_users,
          COUNT(*) FILTER (
            WHERE is_active = TRUE
          )::int AS active_users,
          COUNT(*) FILTER (
            WHERE last_login IS NOT NULL
          )::int AS users_who_have_logged_in,
          (SELECT total_login_events FROM login_counts)
            AS total_login_events
        FROM company_users
      `,
      [allowedCompanyIds]
    );

    const stats = result.rows[0];

    return jsonResponse({
      success: true,
      companyIds: allowedCompanyIds,
      stats: {
        totalUsers: Number(stats.total_users ?? 0),
        activeUsers: Number(stats.active_users ?? 0),
        usersWhoHaveLoggedIn: Number(
          stats.users_who_have_logged_in ?? 0
        ),
        totalLoginEvents: Number(
          stats.total_login_events ?? 0
        ),
      },
    });
  } catch (error) {
    console.error("DASHBOARD USER STATS ERROR:", error);

    return jsonResponse(
      {
        success: false,
        message: "Failed to load user statistics.",
      },
      500
    );
  }
}
