import { NextResponse } from "next/server";

import pool from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { hasPermission } from "@/lib/permissions";

export const dynamic = "force-dynamic";

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
        {
          success: false,
          message: "Unauthorized. Please log in again.",
        },
        { status: 401 }
      ),
    };
  }

  if (!user.userId || !user.companyId || !user.roleId) {
    return {
      error: json(
        {
          success: false,
          message:
            "Your session is missing required account information. Please log in again.",
        },
        { status: 401 }
      ),
    };
  }

  return { user };
}

// Verify that the acting user's role is the global system ADMIN.
async function isSystemAdmin(roleId) {
  const result = await pool.query(
    `
      SELECT role_id
      FROM roles
      WHERE role_id = $1
        AND role_name = 'ADMIN'
        AND is_system_role = TRUE
        AND company_id IS NULL
      LIMIT 1;
    `,
    [roleId]
  );

  return result.rows.length > 0;
}

// Find a role that is global or belongs to the acting user's company.
async function getTargetRole(roleId, companyId) {
  const result = await pool.query(
    `
      SELECT
        role_id,
        role_name,
        is_system_role,
        company_id
      FROM roles
      WHERE role_id = $1
        AND (company_id IS NULL OR company_id = $2)
      LIMIT 1;
    `,
    [roleId, companyId]
  );

  return result.rows[0] || null;
}

// A system ADMIN can manage the matrix.
// Other users need the user_rights view permission to load it.
async function canManageUserRights(user) {
  if (await isSystemAdmin(user.roleId)) {
    return true;
  }

  return Boolean(
    await hasPermission(user.roleId, "user_rights", "view")
  );
}

// =========================================================
// GET PERMISSIONS FOR A ROLE
// =========================================================

export async function GET(request) {
  try {
    const auth = await getAuthenticatedUser();

    if (auth.error) {
      return auth.error;
    }

    const { user } = auth;
    const allowed = await canManageUserRights(user);

    if (!allowed) {
      return json(
        {
          success: false,
          message: "You do not have permission to view user rights.",
        },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const roleId = searchParams.get("roleId");

    if (!roleId || !/^\d+$/.test(roleId) || Number(roleId) <= 0) {
      return json(
        {
          success: false,
          message: "A valid roleId is required.",
        },
        { status: 400 }
      );
    }

    const targetRole = await getTargetRole(
      Number(roleId),
      user.companyId
    );

    if (!targetRole) {
      return json(
        {
          success: false,
          message: "The selected role was not found for your company.",
        },
        { status: 404 }
      );
    }

    const roleIsAdmin =
      targetRole.role_name === "ADMIN" &&
      targetRole.is_system_role === true &&
      targetRole.company_id === null;

    const result = await pool.query(
      `
        SELECT
          p.permission_id,
          p.permission_key,
          p.permission_name,
          p.module,
          p.description,
          COALESCE(rp.can_view, FALSE) AS can_view,
          COALESCE(rp.can_create, FALSE) AS can_create,
          COALESCE(rp.can_update, FALSE) AS can_update,
          COALESCE(rp.can_delete, FALSE) AS can_delete
        FROM permissions p
        LEFT JOIN role_permissions rp
          ON rp.permission_id = p.permission_id
         AND rp.role_id = $1
        ORDER BY p.module, p.permission_id;
      `,
      [targetRole.role_id]
    );

    return json({
      success: true,
      role: targetRole,
      roleIsAdmin,
      permissions: result.rows,
    });
  } catch (error) {
    console.error("GET ROLE PERMISSIONS ERROR:", error);

    return json(
      {
        success: false,
        message: "Failed to load permissions.",
      },
      { status: 500 }
    );
  }
}

// =========================================================
// UPDATE PERMISSION FOR A ROLE
//
// The global system ADMIN may update the permission records
// of the ADMIN role itself, as well as other accessible roles.
//
// System role identity and deletion protection should be
// enforced in the roles API, separately from permission edits.
// =========================================================

export async function PUT(request) {
  try {
    const auth = await getAuthenticatedUser();

    if (auth.error) {
      return auth.error;
    }

    const { user } = auth;
    const actingUserIsAdmin = await isSystemAdmin(user.roleId);

    // Only the acting system ADMIN bypasses the user-rights
    // update permission check.
    if (!actingUserIsAdmin) {
      const allowed = await hasPermission(
        user.roleId,
        "user_rights",
        "update"
      );

      if (!allowed) {
        return json(
          {
            success: false,
            message:
              "You do not have permission to update user rights.",
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
        {
          success: false,
          message: "Invalid request body.",
        },
        { status: 400 }
      );
    }

    const {
      roleId,
      permissionId,
      canView,
      canCreate,
      canUpdate,
      canDelete,
    } = body;

    const targetRoleId = Number(roleId);
    const targetPermissionId = Number(permissionId);

    if (
      !Number.isInteger(targetRoleId) ||
      targetRoleId <= 0 ||
      !Number.isInteger(targetPermissionId) ||
      targetPermissionId <= 0
    ) {
      return json(
        {
          success: false,
          message: "A valid role and permission are required.",
        },
        { status: 400 }
      );
    }

    // Require explicit booleans. Do not silently convert missing
    // or invalid values to false.
    for (const value of [canView, canCreate, canUpdate, canDelete]) {
      if (typeof value !== "boolean") {
        return json(
          {
            success: false,
            message: "All permission values must be true or false.",
          },
          { status: 400 }
        );
      }
    }

    // The target must be a global role or a role in this company.
    // This intentionally does not reject the global ADMIN role.
    const targetRole = await getTargetRole(
      targetRoleId,
      user.companyId
    );

    if (!targetRole) {
      return json(
        {
          success: false,
          message: "The selected role was not found for your company.",
        },
        { status: 404 }
      );
    }

    const permissionExists = await pool.query(
      `
        SELECT permission_id
        FROM permissions
        WHERE permission_id = $1
        LIMIT 1;
      `,
      [targetPermissionId]
    );

    if (permissionExists.rows.length === 0) {
      return json(
        {
          success: false,
          message: "The selected permission was not found.",
        },
        { status: 404 }
      );
    }

    console.log("[PERMISSION UPDATE REQUEST]", {
  targetRoleId,
  targetPermissionId,
  permissionKey: permissionExists.rows[0]?.permission_key ?? null,
  canView,
  canCreate,
  canUpdate,
  canDelete,
});

const result = await pool.query(
  `
    INSERT INTO role_permissions (
      role_id,
      permission_id,
      can_view,
      can_create,
      can_update,
      can_delete
    )
    VALUES ($1, $2, $3, $4, $5, $6)
    ON CONFLICT (role_id, permission_id)
    DO UPDATE SET
      can_view = EXCLUDED.can_view,
      can_create = EXCLUDED.can_create,
      can_update = EXCLUDED.can_update,
      can_delete = EXCLUDED.can_delete,
      updated_at = CURRENT_TIMESTAMP
    RETURNING
      role_id,
      permission_id,
      can_view,
      can_create,
      can_update,
      can_delete;
  `,
  [
    targetRoleId,
    targetPermissionId,
    canView,
    canCreate,
    canUpdate,
    canDelete,
  ]
);

console.log("[PERMISSION UPDATE DATABASE RESULT]", result.rows[0]);

    return json({
      success: true,
      message: "Permission updated successfully.",
      permission: result.rows[0],
    });
  } catch (error) {
    console.error("UPDATE ROLE PERMISSION ERROR:", error);

    if (error.code === "23503") {
      return json(
        {
          success: false,
          message: "The selected role or permission does not exist.",
        },
        { status: 400 }
      );
    }

    if (error.code === "42P10") {
      return json(
        {
          success: false,
          message:
            "The database needs a unique constraint on (role_id, permission_id) for permission updates.",
        },
        { status: 500 }
      );
    }

    return json(
      {
        success: false,
        message: "Failed to update permission.",
      },
      { status: 500 }
    );
  }
}