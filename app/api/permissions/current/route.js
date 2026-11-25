
// import { NextResponse } from "next/server";

// import { getCurrentUser } from "@/lib/auth";
// import { getRolePermissions } from "@/lib/permissions";

// export const dynamic = "force-dynamic";
// export const revalidate = 0;
// export const runtime = "nodejs";

// const headers = {
//   "Cache-Control": "no-store, no-cache, must-revalidate",
// };

// function json(data, status = 200) {
//   return NextResponse.json(data, {
//     status,
//     headers,
//   });
// }

// function getPositiveInteger(value) {
//   const number = Number(value);

//   return Number.isSafeInteger(number) && number > 0
//     ? number
//     : null;
// }

// export async function GET(request) {
//   try {
//     // Authentication validates JWT, PostgreSQL session,
//     // company membership, and the current database role.
//     const user = await getCurrentUser();

//     if (!user) {
//       return json(
//         {
//           success: false,
//           message: "Unauthorized",
//           permissions: [],
//         },
//         401
//       );
//     }

//     const roleId = getPositiveInteger(
//       user.roleId ?? user.role_id
//     );

//     if (!roleId) {
//       return json(
//         {
//           success: false,
//           message: "User role not found",
//           permissions: [],
//         },
//         403
//       );
//     }

//     // Permission library already caches role permissions
//     // and deduplicates concurrent loads.
//     const permissions = await getRolePermissions(roleId);

//     const { searchParams } = new URL(request.url);

//     const permissionKey = searchParams
//       .get("permissionKey")
//       ?.trim();

//     if (permissionKey) {
//       const permission = permissions.find(
//         (item) =>
//           item.permission_key === permissionKey
//       );

//       return json({
//         success: true,
//         permission: permission || {
//           permission_key: permissionKey,
//           can_view: false,
//           can_create: false,
//           can_update: false,
//           can_delete: false,
//         },
//       });
//     }

//     return json({
//       success: true,
//       permissions,
//     });
//   } catch (error) {
//     console.error(
//       "GET /api/permissions/current ERROR:",
//       error
//     );

//     return json(
//       {
//         success: false,
//         message: "Unable to load current user permissions",
//         permissions: [],
//       },
//       500
//     );
//   }
// }

import { NextResponse } from "next/server";
import pool from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { getRolePermissions } from "@/lib/permissions";

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

export async function GET(request) {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return json(
        { success: false, message: "Unauthorized." },
        401
      );
    }

    const userId = Number(user.userId ?? user.user_id);
    const companyId = Number(user.companyId ?? user.company_id);

    if (
      !Number.isInteger(userId) ||
      userId <= 0 ||
      !Number.isInteger(companyId) ||
      companyId <= 0
    ) {
      return json(
        { success: false, message: "Invalid user or company session." },
        401
      );
    }

    const membership = await pool.query(
      `
        SELECT
          uc.role_id,
          r.role_name,
          r.is_system_role,
          r.company_id
        FROM public.user_companies uc
        INNER JOIN public.users u
          ON u.user_id = uc.user_id
        INNER JOIN public.companies c
          ON c.company_id = uc.company_id
        INNER JOIN public.roles r
          ON r.role_id = uc.role_id
        WHERE uc.user_id = $1
          AND uc.company_id = $2
          AND uc.deleted_at IS NULL
          AND r.deleted_at IS NULL
          AND u.is_active = TRUE
          AND c.is_active = TRUE
          AND (
            r.company_id IS NULL
            OR r.company_id = uc.company_id
          )
        LIMIT 1;
      `,
      [userId, companyId]
    );

    if (membership.rowCount === 0) {
      return json(
        {
          success: false,
          message: "Your active company membership or assigned role was not found.",
          permissions: [],
        },
        403
      );
    }

    const role = membership.rows[0];
    const { searchParams } = new URL(request.url);
    const permissionKey = searchParams.get("permissionKey");

    const allPermissions = await getRolePermissions(role.role_id);

    const permissions = permissionKey
      ? allPermissions.filter(
          (permission) => permission.permission_key === permissionKey
        )
      : allPermissions;

    return json({
      success: true,
      roleId: role.role_id,
      roleName: role.role_name,
      permissions,
    });
  } catch (error) {
    console.error("GET CURRENT PERMISSIONS ERROR:", error);

    return json(
      {
        success: false,
        message: "Failed to load current permissions.",
      },
      500
    );
  }
}
