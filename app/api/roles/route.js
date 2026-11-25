
import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";

import pool from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { hasPermission } from "@/lib/permissions";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const noCacheHeaders = {
  "Cache-Control": "no-store, no-cache, must-revalidate",
};

function json(data, options = {}) {
  return NextResponse.json(data, {
    ...options,
    headers: {
      ...noCacheHeaders,
      ...(options.headers || {}),
    },
  });
}

async function getAuthenticatedUser() {
  const user = await getCurrentUser();

  if (!user) {
    return {
      error: json(
        { success: false, message: "Unauthorized. Please log in again." },
        { status: 401 }
      ),
    };
  }

  if (!user.userId || !user.companyId || !user.roleId) {
    return {
      error: json(
        { success: false, message: "Your session is missing required account information. Please log in again." },
        { status: 401 }
      ),
    };
  }

  return { user };
}

async function isSystemAdmin(roleId) {
  const result = await pool.query(
    `
      SELECT 1
      FROM public.roles
      WHERE role_id = $1
        AND role_name = 'ADMIN'
        AND is_system_role = TRUE
        AND company_id IS NULL
        AND deleted_at IS NULL
      LIMIT 1;
    `,
    [roleId]
  );

  return result.rowCount > 0;
}

async function getRolePermissions(roleId, isAdmin = false) {
  if (isAdmin) {
    return {
      view: true,
      create: true,
      update: true,
      delete: true,
    };
  }

  const [view, create, update, remove] = await Promise.all([
    hasPermission(roleId, "roles", "view"),
    hasPermission(roleId, "roles", "create"),
    hasPermission(roleId, "roles", "update"),
    hasPermission(roleId, "roles", "delete"),
  ]);

  return {
    view: Boolean(view),
    create: Boolean(create),
    update: Boolean(update),
    delete: Boolean(remove),
  };
}

/* -------------------------------------------------------------------------- */
/* GET ACTIVE ROLES                                                           */
/* -------------------------------------------------------------------------- */

export async function GET() {
  try {
    const auth = await getAuthenticatedUser();
    if (auth.error) return auth.error;

    const { user } = auth;
    const isAdmin = await isSystemAdmin(user.roleId);
    const permissions = await getRolePermissions(user.roleId, isAdmin);

    if (!permissions.view) {
      return json(
        {
          success: false,
          accessDenied: true,
          message: "You do not have permission to view roles.",
          permissions,
        },
        { status: 403 }
      );
    }

    const result = await pool.query(
      `
        SELECT
          r.role_id,
          r.role_name,
          r.description,
          r.is_system_role,
          r.company_id,
          r.created_at,
          COUNT(DISTINCT uc.user_id)::INTEGER AS user_count
        FROM public.roles r
        LEFT JOIN public.user_companies uc
          ON uc.role_id = r.role_id
         AND uc.company_id = $1
         AND uc.deleted_at IS NULL
        WHERE r.deleted_at IS NULL
          AND (
            r.company_id IS NULL
            OR r.company_id = $1
          )
        GROUP BY
          r.role_id,
          r.role_name,
          r.description,
          r.is_system_role,
          r.company_id,
          r.created_at
        ORDER BY
          r.is_system_role DESC,
          r.role_id;
      `,
      [user.companyId]
    );

    return json({
      success: true,
      roles: result.rows,
      permissions,
      isAdmin,
    });
  } catch (error) {
    console.error("GET ROLES ERROR:", error);

    return json(
      { success: false, message: "Failed to load roles." },
      { status: 500 }
    );
  }
}

/* -------------------------------------------------------------------------- */
/* CREATE CUSTOM ROLE                                                         */
/* -------------------------------------------------------------------------- */

export async function POST(request) {
  try {
    const auth = await getAuthenticatedUser();
    if (auth.error) return auth.error;

    const { user } = auth;
    const isAdmin = await isSystemAdmin(user.roleId);

    if (!isAdmin) {
      const allowed = await hasPermission(user.roleId, "roles", "create");

      if (!allowed) {
        return json(
          {
            success: false,
            accessDenied: true,
            message: "You do not have permission to create roles.",
          },
          { status: 403 }
        );
      }
    }

    let body;

    try {
      body = await request.json();
    } catch {
      return json(
        { success: false, message: "Invalid request body." },
        { status: 400 }
      );
    }

    const roleName =
      typeof body?.roleName === "string" ? body.roleName.trim() : "";

    const description =
      typeof body?.description === "string" && body.description.trim()
        ? body.description.trim()
        : null;

    const authPassword = body?.authPassword;

    if (!roleName) {
      return json(
        { success: false, message: "Role name is required." },
        { status: 400 }
      );
    }

    if (roleName.length > 50) {
  return json(
    { success: false, message: "Role name cannot exceed 50 characters." },
    { status: 400 }
  );
}

    if (description && description.length > 255) {
      return json(
        { success: false, message: "Description cannot exceed 255 characters." },
        { status: 400 }
      );
    }

    const normalizedRoleName = roleName.toUpperCase();

    if (["ADMIN", "SUB_ADMIN", "USER"].includes(normalizedRoleName)) {
      return json(
        {
          success: false,
          message: "ADMIN, SUB_ADMIN, and USER are protected system roles. Choose another role name.",
        },
        { status: 400 }
      );
    }

    if (typeof authPassword !== "string" || !authPassword.length) {
      return json(
        { success: false, message: "Your current account password is required." },
        { status: 400 }
      );
    }

    const passwordResult = await pool.query(
      `
        SELECT uc.company_password_hash
        FROM public.user_companies uc
        WHERE uc.user_id = $1
          AND uc.company_id = $2
          AND uc.role_id = $3
          AND uc.deleted_at IS NULL
        LIMIT 1;
      `,
      [user.userId, user.companyId, user.roleId]
    );

    if (passwordResult.rowCount === 0) {
      return json(
        {
          success: false,
          message: "Your active company account could not be verified. Please log in again.",
        },
        { status: 401 }
      );
    }

    const passwordHash = passwordResult.rows[0].company_password_hash;

    if (typeof passwordHash !== "string" || !passwordHash.length) {
      return json(
        {
          success: false,
          message: "No company password hash was found for your account.",
        },
        { status: 401 }
      );
    }

    const passwordMatches = await bcrypt.compare(authPassword, passwordHash);

    if (!passwordMatches) {
      return json(
        { success: false, message: "Incorrect account password." },
        { status: 401 }
      );
    }

    const result = await pool.query(
      `
        INSERT INTO public.roles (
          role_name,
          description,
          is_system_role,
          company_id
        )
        VALUES ($1, $2, FALSE, $3)
        RETURNING
          role_id,
          role_name,
          description,
          is_system_role,
          company_id,
          created_at,
          updated_at;
      `,
      [normalizedRoleName, description, user.companyId]
    );

    return json(
      {
        success: true,
        message: "Role created successfully.",
        role: result.rows[0],
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("CREATE ROLE ERROR:", error);

    if (error.code === "23505") {
      return json(
        {
          success: false,
          message: "A role with this name already exists, including any archived role.",
        },
        { status: 409 }
      );
    }

    if (error.code === "42703") {
      return json(
        {
          success: false,
          message: "A required database column was not found. Check the central schema and migrations.",
        },
        { status: 500 }
      );
    }

    return json(
      { success: false, message: "Failed to create role." },
      { status: 500 }
    );
  }
}
