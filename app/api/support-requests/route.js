import { NextResponse } from "next/server";
import pool from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { hasPermission } from "@/lib/permissions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PERMISSION_KEY = "help_support";

const CATEGORIES = new Set([
  "password_reset",
  "account_unlock",
  "company_access",
  "new_company",
  "technical_support",
  "data_recovery",
  "license_renewal",
  "feature_request",
  "other",
]);

const NO_STORE_HEADERS = {
  "Cache-Control": "no-store, no-cache, must-revalidate",
};

function jsonError(message, status) {
  return NextResponse.json(
    { error: message },
    { status, headers: NO_STORE_HEADERS }
  );
}

function getRoleIdFromUser(user) {
  const roleId = Number(user?.roleId ?? user?.role_id);

  return Number.isSafeInteger(roleId) && roleId > 0
    ? roleId
    : null;
}

/**
 * Resolve a role for the current company context.
 *
 * IMPORTANT:
 * Prefer the role supplied by the authenticated session.
 * If the session has no role, use the selected company context
 * only when it is available and the membership is valid.
 * Do not silently select an arbitrary role from another company.
 */
async function resolveUserRole(user) {
  const sessionRoleId = getRoleIdFromUser(user);

  if (sessionRoleId) {
    return sessionRoleId;
  }

  const companyId = Number(
    user?.companyId ??
    user?.company_id ??
    user?.activeCompanyId ??
    user?.active_company_id
  );

  if (!Number.isSafeInteger(companyId) || companyId < 1) {
    return null;
  }

  const result = await pool.query(
    `SELECT uc.role_id
     FROM user_companies uc
     JOIN companies c
       ON c.company_id = uc.company_id
     JOIN roles r
       ON r.role_id = uc.role_id
     WHERE uc.user_id = $1
       AND uc.company_id = $2
       AND c.is_active = TRUE
       AND (r.company_id IS NULL OR r.company_id = uc.company_id)
     LIMIT 1`,
    [user.userId, companyId]
  );

  return result.rows[0]?.role_id ?? null;
}

async function getPermissionFlags(roleId) {
  const [canView, canCreate, canUpdate, canDelete] =
    await Promise.all([
      hasPermission(roleId, PERMISSION_KEY, "view"),
      hasPermission(roleId, PERMISSION_KEY, "create"),
      hasPermission(roleId, PERMISSION_KEY, "update"),
      hasPermission(roleId, PERMISSION_KEY, "delete"),
    ]);

  return {
    canView,
    canCreate,
    canUpdate,
    canDelete,
  };
}

async function authorize(user, action) {
  if (!user?.userId) {
    return {
      error: jsonError("Please log in first.", 401),
    };
  }

  let roleId;

  try {
    roleId = await resolveUserRole(user);
  } catch (error) {
    console.error("Help & Support role lookup failed:", error);

    return {
      error: jsonError(
        "Unable to resolve your account role.",
        500
      ),
    };
  }

  if (!roleId) {
    return {
      error: jsonError(
        "Your session does not contain a valid role and active company context. Please sign in again.",
        403
      ),
    };
  }

  try {
    const allowed = await hasPermission(
      roleId,
      PERMISSION_KEY,
      action
    );

    if (!allowed) {
      const labels = {
        view: "view",
        create: "create",
        update: "edit",
        delete: "delete",
      };

      return {
        error: jsonError(
          `You do not have permission to ${labels[action] || action} Help & Support.`,
          403
        ),
      };
    }

    return { roleId };
  } catch (error) {
    console.error("Help & Support permission check failed:", error);

    return {
      error: jsonError(
        "Unable to verify Help & Support permissions.",
        500
      ),
    };
  }
}

/**
 * GET /api/support-requests
 * Returns companies and permission flags for the authenticated user.
 */
export async function GET() {
  try {
    const user = await getCurrentUser();

    const authorization = await authorize(user, "view");

    if (authorization.error) {
      return authorization.error;
    }

    const roleId = authorization.roleId;

    const [companiesResult, permissions] = await Promise.all([
      pool.query(
        `SELECT DISTINCT
           c.company_id,
           c.company_name
         FROM user_companies uc
         JOIN companies c
           ON c.company_id = uc.company_id
         JOIN roles r
           ON r.role_id = uc.role_id
         WHERE uc.user_id = $1
           AND c.is_active = TRUE
           AND (r.company_id IS NULL OR r.company_id = uc.company_id)
         ORDER BY c.company_name`,
        [user.userId]
      ),
      getPermissionFlags(roleId),
    ]);

    return NextResponse.json(
      {
        companies: companiesResult.rows.map((row) => ({
          companyId: row.company_id,
          companyName: row.company_name,
        })),
        permissions,
      },
      { headers: NO_STORE_HEADERS }
    );
  } catch (error) {
    console.error("Support requests GET error:", error);

    return jsonError(
      "Unable to load Help & Support. Check the server terminal.",
      500
    );
  }
}

/**
 * POST /api/support-requests
 * Checks Create permission, validates company membership,
 * and forwards the request to the Super Admin service.
 */
export async function POST(request) {
  try {
    const user = await getCurrentUser();

    const authorization = await authorize(user, "create");

    if (authorization.error) {
      return authorization.error;
    }

    let body;

    try {
      body = await request.json();
    } catch {
      return jsonError("Invalid request body.", 400);
    }

    const companyId = Number(body.companyId);
    const category = String(body.category || "").trim();
    const subject = String(body.subject || "").trim();
    const description = String(body.description || "").trim();

    if (!Number.isSafeInteger(companyId) || companyId < 1) {
      return jsonError("Select a valid company.", 400);
    }

    if (!CATEGORIES.has(category)) {
      return jsonError("Select a valid request type.", 400);
    }

    if (!subject || subject.length > 200) {
      return jsonError(
        "Subject is required and must be at most 200 characters.",
        400
      );
    }

    if (!description || description.length > 10000) {
      return jsonError(
        "Description is required and must be at most 10,000 characters.",
        400
      );
    }

    const membershipResult = await pool.query(
      `SELECT
         c.company_id,
         c.company_name,
         u.user_id,
         u.full_name,
         u.email
       FROM user_companies uc
       JOIN companies c
         ON c.company_id = uc.company_id
       JOIN users u
         ON u.user_id = uc.user_id
       JOIN roles r
         ON r.role_id = uc.role_id
       WHERE uc.user_id = $1
         AND uc.company_id = $2
         AND c.is_active = TRUE
         AND u.is_active = TRUE
         AND (r.company_id IS NULL OR r.company_id = uc.company_id)
       LIMIT 1`,
      [user.userId, companyId]
    );

    if (membershipResult.rowCount === 0) {
      return jsonError(
        "You do not have access to this company.",
        403
      );
    }

    const membership = membershipResult.rows[0];

    const clientId = Number(process.env.LICENSE_CLIENT_ID);
    const superAdminUrl = process.env.SUPER_ADMIN_API_URL;
    const secret = process.env.CLIENT_DATA_API_SECRET;

    if (
      !Number.isSafeInteger(clientId) ||
      clientId < 1 ||
      !superAdminUrl ||
      !secret
    ) {
      console.error(
        "Support integration environment variables are missing."
      );

      return jsonError(
        "Support service is not configured.",
        500
      );
    }

    const endpoint =
      `${superAdminUrl.replace(/\/+$/, "")}` +
      "/api/public/support-requests";

    let response;

    try {
      response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-client-data-secret": secret,
        },
        body: JSON.stringify({
          clientId,
          companyId: membership.company_id,
          companyName: membership.company_name,
          requesterUserId: membership.user_id,
          requesterName: membership.full_name,
          requesterEmail: membership.email,
          category,
          subject,
          description,
        }),
        cache: "no-store",
        signal: AbortSignal.timeout(15000),
      });
    } catch (error) {
      console.error("Super Admin support connection error:", error);

      return jsonError(
        "Unable to connect to the support service. Please try again later.",
        502
      );
    }

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      console.error("Super Admin support API error:", {
        status: response.status,
        error: data.error,
      });

      return jsonError(
        data.error || "Super Admin rejected the request.",
        response.status >= 500 ? 502 : response.status
      );
    }

    return NextResponse.json(data, {
      status: 201,
      headers: NO_STORE_HEADERS,
    });
  } catch (error) {
    console.error("Support request POST error:", error);

    return jsonError(
      "Unable to process your request. Check the server terminal.",
      500
    );
  }
}