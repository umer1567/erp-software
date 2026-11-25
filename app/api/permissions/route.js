
// import { NextResponse } from "next/server";

// import pool from "@/lib/db";
// import { getCurrentUser } from "@/lib/auth";

// import {
//   hasPermission,
//   invalidateRolePermissions,
// } from "@/lib/permissions";

// export const dynamic = "force-dynamic";
// export const revalidate = 0;

// const noCacheHeaders = {
//   "Cache-Control": "no-store, no-cache, must-revalidate",
// };

// function json(data, options = {}) {
//   return NextResponse.json(data, {
//     ...options,
//     headers: {
//       ...noCacheHeaders,
//       ...(options.headers || {}),
//     },
//   });
// }

// async function getAuthenticatedUser() {
//   const user = await getCurrentUser();

//   if (!user) {
//     return {
//       error: json(
//         {
//           success: false,
//           message: "Unauthorized. Please log in again.",
//         },
//         { status: 401 }
//       ),
//     };
//   }

//   if (
//     !user.userId ||
//     !user.companyId ||
//     !user.roleId
//   ) {
//     return {
//       error: json(
//         {
//           success: false,
//           message:
//             "Your session is missing required account information. Please log in again.",
//         },
//         { status: 401 }
//       ),
//     };
//   }

//   return { user };
// }

// /**
//  * Verify the acting user's role is the global system ADMIN.
//  */
// async function isSystemAdmin(roleId) {
//   const result = await pool.query(
//     `
//       SELECT 1
//       FROM roles
//       WHERE role_id = $1
//         AND role_name = 'ADMIN'
//         AND is_system_role = TRUE
//         AND company_id IS NULL
//       LIMIT 1;
//     `,
//     [roleId]
//   );

//   return result.rowCount > 0;
// }

// /**
//  * Find a global role or a role belonging to this company.
//  */
// async function getTargetRole(roleId, companyId) {
//   const result = await pool.query(
//     `
//       SELECT
//         role_id,
//         role_name,
//         is_system_role,
//         company_id
//       FROM roles
//       WHERE role_id = $1
//         AND (
//           company_id IS NULL
//           OR company_id = $2
//         )
//       LIMIT 1;
//     `,
//     [roleId, companyId]
//   );

//   return result.rows[0] || null;
// }

// /**
//  * Global system ADMIN can manage user rights.
//  * Other users need user_rights permission.
//  */
// async function canManageUserRights(user) {
//   if (await isSystemAdmin(user.roleId)) {
//     return true;
//   }

//   return hasPermission(
//     user.roleId,
//     "user_rights",
//     "view"
//   );
// }

// // =========================================================
// // GET PERMISSIONS FOR A ROLE
// // =========================================================

// export async function GET(request) {
//   try {
//     const auth = await getAuthenticatedUser();

//     if (auth.error) {
//       return auth.error;
//     }

//     const { user } = auth;

//     const allowed = await canManageUserRights(user);

//     if (!allowed) {
//       return json(
//         {
//           success: false,
//           message:
//             "You do not have permission to view user rights.",
//         },
//         { status: 403 }
//       );
//     }

//     const { searchParams } = new URL(request.url);

//     const roleId = searchParams.get("roleId");

//     if (
//       !roleId ||
//       !/^\d+$/.test(roleId) ||
//       Number(roleId) <= 0
//     ) {
//       return json(
//         {
//           success: false,
//           message: "A valid roleId is required.",
//         },
//         { status: 400 }
//       );
//     }

//     const targetRole = await getTargetRole(
//       Number(roleId),
//       user.companyId
//     );

//     if (!targetRole) {
//       return json(
//         {
//           success: false,
//           message:
//             "The selected role was not found for your company.",
//         },
//         { status: 404 }
//       );
//     }

//     const roleIsAdmin =
//       targetRole.role_name === "ADMIN" &&
//       targetRole.is_system_role === true &&
//       targetRole.company_id === null;

//     const result = await pool.query(
//       `
//         SELECT
//           p.permission_id,
//           p.permission_key,
//           p.permission_name,
//           p.module,
//           p.description,

//           COALESCE(rp.can_view, FALSE) AS can_view,
//           COALESCE(rp.can_create, FALSE) AS can_create,
//           COALESCE(rp.can_update, FALSE) AS can_update,
//           COALESCE(rp.can_delete, FALSE) AS can_delete

//         FROM permissions p

//         LEFT JOIN role_permissions rp
//           ON rp.permission_id = p.permission_id
//          AND rp.role_id = $1

//         ORDER BY
//           p.module,
//           p.permission_id;
//       `,
//       [targetRole.role_id]
//     );

//     return json({
//       success: true,
//       role: targetRole,
//       roleIsAdmin,
//       permissions: result.rows,
//     });
//   } catch (error) {
//     console.error(
//       "GET ROLE PERMISSIONS ERROR:",
//       error
//     );

//     return json(
//       {
//         success: false,
//         message: "Failed to load permissions.",
//       },
//       { status: 500 }
//     );
//   }
// }

// // =========================================================
// // UPDATE PERMISSION FOR A ROLE
// // =========================================================

// export async function PUT(request) {
//   try {
//     const auth = await getAuthenticatedUser();

//     if (auth.error) {
//       return auth.error;
//     }

//     const { user } = auth;

//     const actingUserIsAdmin = await isSystemAdmin(
//       user.roleId
//     );

//     // Only the global system ADMIN bypasses this check.
//     if (!actingUserIsAdmin) {
//       const allowed = await hasPermission(
//         user.roleId,
//         "user_rights",
//         "update"
//       );

//       if (!allowed) {
//         return json(
//           {
//             success: false,
//             message:
//               "You do not have permission to update user rights.",
//           },
//           { status: 403 }
//         );
//       }
//     }

//     let body;

//     try {
//       body = await request.json();
//     } catch {
//       return json(
//         {
//           success: false,
//           message: "Invalid request body.",
//         },
//         { status: 400 }
//       );
//     }

//     const {
//       roleId,
//       permissionId,
//       canView,
//       canCreate,
//       canUpdate,
//       canDelete,
//     } = body || {};

//     const targetRoleId = Number(roleId);
//     const targetPermissionId = Number(permissionId);

//     if (
//       !Number.isInteger(targetRoleId) ||
//       targetRoleId <= 0 ||
//       !Number.isInteger(targetPermissionId) ||
//       targetPermissionId <= 0
//     ) {
//       return json(
//         {
//           success: false,
//           message:
//             "A valid role and permission are required.",
//         },
//         { status: 400 }
//       );
//     }

//     // All four permission values must be explicit booleans.
//     const permissionValues = [
//       canView,
//       canCreate,
//       canUpdate,
//       canDelete,
//     ];

//     if (
//       permissionValues.some(
//         (value) => typeof value !== "boolean"
//       )
//     ) {
//       return json(
//         {
//           success: false,
//           message:
//             "All permission values must be true or false.",
//         },
//         { status: 400 }
//       );
//     }

//     // Validate target role and company ownership.
//     const targetRole = await getTargetRole(
//       targetRoleId,
//       user.companyId
//     );

//     if (!targetRole) {
//       return json(
//         {
//           success: false,
//           message:
//             "The selected role was not found for your company.",
//         },
//         { status: 404 }
//       );
//     }

//     // Insert or update only if the requested permission exists.
//     const result = await pool.query(
//       `
//         INSERT INTO role_permissions (
//           role_id,
//           permission_id,
//           can_view,
//           can_create,
//           can_update,
//           can_delete
//         )
//         SELECT
//           $1,
//           p.permission_id,
//           $3,
//           $4,
//           $5,
//           $6
//         FROM permissions p
//         WHERE p.permission_id = $2

//         ON CONFLICT (role_id, permission_id)
//         DO UPDATE SET
//           can_view = EXCLUDED.can_view,
//           can_create = EXCLUDED.can_create,
//           can_update = EXCLUDED.can_update,
//           can_delete = EXCLUDED.can_delete,
//           updated_at = CURRENT_TIMESTAMP

//         RETURNING
//           role_id,
//           permission_id,
//           can_view,
//           can_create,
//           can_update,
//           can_delete;
//       `,
//       [
//         targetRoleId,
//         targetPermissionId,
//         canView,
//         canCreate,
//         canUpdate,
//         canDelete,
//       ]
//     );

//     if (result.rowCount === 0) {
//       return json(
//         {
//           success: false,
//           message: "The selected permission was not found.",
//         },
//         { status: 404 }
//       );
//     }

//     // Immediately invalidate the updated role's cache.
//     invalidateRolePermissions(targetRoleId);

//     return json({
//       success: true,
//       message: "Permission updated successfully.",
//       permission: result.rows[0],
//     });
//   } catch (error) {
//     console.error(
//       "UPDATE ROLE PERMISSION ERROR:",
//       error
//     );

//     if (error.code === "23503") {
//       return json(
//         {
//           success: false,
//           message:
//             "The selected role or permission does not exist.",
//         },
//         { status: 400 }
//       );
//     }

//     if (error.code === "42P10") {
//       return json(
//         {
//           success: false,
//           message:
//             "The database needs a unique constraint on (role_id, permission_id) for permission updates.",
//         },
//         { status: 500 }
//       );
//     }

//     return json(
//       {
//         success: false,
//         message: "Failed to update permission.",
//       },
//       { status: 500 }
//     );
//   }
// }


import { NextResponse } from "next/server";
import pool from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import {
  hasPermission,
  invalidateRolePermissions,
} from "@/lib/permissions";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function json(data, status = 200) {
  return NextResponse.json(data, {
    status,
    headers: {
      "Cache-Control": "private, no-store, no-cache, must-revalidate",
    },
  });
}

function positiveId(value) {
  const id = Number(value);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
}

async function getActor(requestAction) {
  const user = await getCurrentUser();

  if (!user) {
    return {
      response: json({ success: false, message: "Unauthorized." }, 401),
    };
  }

  const userId = positiveId(user.userId ?? user.user_id);
  const companyId = positiveId(user.companyId ?? user.company_id);
  const actorRoleId = positiveId(user.roleId ?? user.role_id);

  if (!userId || !companyId || !actorRoleId) {
    return {
      response: json(
        { success: false, message: "Invalid user session." },
        401
      ),
    };
  }

  const membership = await pool.query(
    `
      SELECT 1
      FROM public.user_companies uc
      INNER JOIN public.users u
        ON u.user_id = uc.user_id
      INNER JOIN public.companies c
        ON c.company_id = uc.company_id
      INNER JOIN public.roles r
        ON r.role_id = uc.role_id
      WHERE uc.user_id = $1
        AND uc.company_id = $2
        AND uc.role_id = $3
        AND uc.deleted_at IS NULL
        AND u.is_active = TRUE
        AND c.is_active = TRUE
        AND r.deleted_at IS NULL
        AND (
          r.company_id IS NULL
          OR r.company_id = uc.company_id
        )
      LIMIT 1;
    `,
    [userId, companyId, actorRoleId]
  );

  if (membership.rowCount === 0) {
    return {
      response: json(
        { success: false, message: "Your active company membership was not found." },
        403
      ),
    };
  }

  const adminResult = await pool.query(
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
    [actorRoleId]
  );

  const isSystemAdmin = adminResult.rowCount > 0;

  if (
    !isSystemAdmin &&
    !(await hasPermission(actorRoleId, "user_rights", requestAction))
  ) {
    return {
      response: json(
        { success: false, message: "You do not have permission to manage user rights." },
        403
      ),
    };
  }

  return {
    user: {
      ...user,
      userId,
      companyId,
      roleId: actorRoleId,
    },
    isSystemAdmin,
  };
}

async function getTargetRole(roleId, companyId, client = pool) {
  const result = await client.query(
    `
      SELECT
        role_id,
        role_name,
        is_system_role,
        company_id
      FROM public.roles
      WHERE role_id = $1
        AND deleted_at IS NULL
        AND (
          company_id IS NULL
          OR company_id = $2
        )
      LIMIT 1;
    `,
    [roleId, companyId]
  );

  return result.rows[0] || null;
}

/* -------------------------------------------------------------------------- */
/* GET ROLE PERMISSIONS                                                       */
/* -------------------------------------------------------------------------- */

export async function GET(request) {
  try {
    const auth = await getActor("view");
    if (auth.response) return auth.response;

    const { user, isSystemAdmin } = auth;
    const { searchParams } = new URL(request.url);
    const roleId = positiveId(searchParams.get("roleId"));

    if (!roleId) {
      return json(
        { success: false, message: "A valid roleId is required." },
        400
      );
    }

    const role = await getTargetRole(roleId, user.companyId);

    if (!role) {
      return json(
        {
          success: false,
          message: "Role not found, archived, or unavailable to your company.",
        },
        404
      );
    }

    const result = await pool.query(
      `
        SELECT
          p.permission_id,
          p.permission_key,
          p.permission_name,
          COALESCE(rp.can_view, FALSE) AS can_view,
          COALESCE(rp.can_create, FALSE) AS can_create,
          COALESCE(rp.can_update, FALSE) AS can_update,
          COALESCE(rp.can_delete, FALSE) AS can_delete
        FROM public.permissions p
        LEFT JOIN public.role_permissions rp
          ON rp.permission_id = p.permission_id
         AND rp.role_id = $1
        ORDER BY p.permission_id;
      `,
      [roleId]
    );

    return json({
      success: true,
      role,
      roleIsAdmin: role.is_system_role && role.role_name === "ADMIN",
      isSystemAdmin,
      permissions: result.rows,
    });
  } catch (error) {
    console.error("GET ROLE PERMISSIONS ERROR:", error);

    return json(
      { success: false, message: "Failed to load role permissions." },
      500
    );
  }
}

/* -------------------------------------------------------------------------- */
/* UPDATE ROLE PERMISSIONS                                                    */
/* -------------------------------------------------------------------------- */

export async function PUT(request) {
  let client;

  try {
    const auth = await getActor("update");
    if (auth.response) return auth.response;

    const { user, isSystemAdmin } = auth;

    let body;

    try {
      body = await request.json();
    } catch {
      return json(
        { success: false, message: "Invalid request body." },
        400
      );
    }

    const roleId = positiveId(body?.roleId);
    const permissions = body?.permissions;

    if (!roleId) {
      return json(
        { success: false, message: "A valid roleId is required." },
        400
      );
    }

    if (!Array.isArray(permissions)) {
      return json(
        { success: false, message: "Permissions must be an array." },
        400
      );
    }

    if (permissions.length > 1000) {
      return json(
        { success: false, message: "Too many permission records." },
        400
      );
    }

    const seenPermissionIds = new Set();

    for (const item of permissions) {
      const permissionId = positiveId(item?.permissionId);

      if (
        !permissionId ||
        seenPermissionIds.has(permissionId) ||
        typeof item?.canView !== "boolean" ||
        typeof item?.canCreate !== "boolean" ||
        typeof item?.canUpdate !== "boolean" ||
        typeof item?.canDelete !== "boolean"
      ) {
        return json(
          {
            success: false,
            message: "Each permission must have a unique valid permissionId and boolean canView, canCreate, canUpdate, and canDelete values.",
          },
          400
        );
      }

      seenPermissionIds.add(permissionId);
    }

    client = await pool.connect();
    await client.query("BEGIN");

    const role = await getTargetRole(roleId, user.companyId, client);

    if (!role) {
      await client.query("ROLLBACK");

      return json(
        {
          success: false,
          message: "Role not found, archived, or unavailable to your company.",
        },
        404
      );
    }

    if (role.is_system_role && !isSystemAdmin) {
      await client.query("ROLLBACK");

      return json(
        {
          success: false,
          message: "Only the system administrator can update system role permissions.",
        },
        403
      );
    }

    const validPermissions = await client.query(
      `
        SELECT permission_id
        FROM public.permissions
        WHERE permission_id = ANY($1::INTEGER[]);
      `,
      [Array.from(seenPermissionIds)]
    );

    if (validPermissions.rowCount !== seenPermissionIds.size) {
      await client.query("ROLLBACK");

      return json(
        {
          success: false,
          message: "One or more permission IDs are invalid.",
        },
        400
      );
    }

    for (const item of permissions) {
      await client.query(
        `
          INSERT INTO public.role_permissions (
            role_id,
            permission_id,
            can_view,
            can_create,
            can_update,
            can_delete,
            updated_at
          )
          VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP)
          ON CONFLICT (role_id, permission_id)
          DO UPDATE SET
            can_view = EXCLUDED.can_view,
            can_create = EXCLUDED.can_create,
            can_update = EXCLUDED.can_update,
            can_delete = EXCLUDED.can_delete,
            updated_at = CURRENT_TIMESTAMP;
        `,
        [
          roleId,
          Number(item.permissionId),
          item.canView,
          item.canCreate,
          item.canUpdate,
          item.canDelete,
        ]
      );
    }

    // Recheck that the role has not been archived before committing.
    const activeRole = await client.query(
      `
        SELECT 1
        FROM public.roles
        WHERE role_id = $1
          AND deleted_at IS NULL
        FOR UPDATE;
      `,
      [roleId]
    );

    if (activeRole.rowCount === 0) {
      await client.query("ROLLBACK");

      return json(
        { success: false, message: "This role was archived during the update." },
        409
      );
    }

    await client.query("COMMIT");
    invalidateRolePermissions(roleId);

    return json({
      success: true,
      message: "Role permissions updated successfully.",
      roleId,
      updatedCount: permissions.length,
    });
  } catch (error) {
    if (client) {
      await client.query("ROLLBACK").catch(() => {});
    }

    console.error("UPDATE ROLE PERMISSIONS ERROR:", error);

    return json(
      { success: false, message: "Failed to update role permissions." },
      500
    );
  } finally {
    client?.release();
  }
}
