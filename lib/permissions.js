
// import pool from "@/lib/db";

// const PERMISSION_COLUMNS = Object.freeze({
//   view: "can_view",
//   create: "can_create",
//   update: "can_update",
//   delete: "can_delete",
// });

// const CACHE_TTL = 5000;

// const globalForPermissions = globalThis;

// const permissionCache =
//   globalForPermissions.__erpPermissionCache ||
//   new Map();

// const pendingLoads =
//   globalForPermissions.__erpPermissionPending ||
//   new Map();

// const cacheVersions =
//   globalForPermissions.__erpPermissionVersions ||
//   new Map();

// globalForPermissions.__erpPermissionCache = permissionCache;
// globalForPermissions.__erpPermissionPending = pendingLoads;
// globalForPermissions.__erpPermissionVersions = cacheVersions;

// function normalizeRoleId(roleId) {
//   const id = Number(roleId);

//   return Number.isInteger(id) && id > 0 ? id : null;
// }

// /**
//  * Load all permissions for a role.
//  * Uses one database query and caches the result.
//  * Concurrent requests for the same role share one query.
//  */
// async function getRolePermissionMap(roleId) {
//   const cached = permissionCache.get(roleId);

//   if (cached && cached.expiresAt > Date.now()) {
//     return cached.permissions;
//   }

//   if (cached) {
//     permissionCache.delete(roleId);
//   }

//   const pending = pendingLoads.get(roleId);

//   if (pending) {
//     return pending;
//   }

//   const version = cacheVersions.get(roleId) || 0;

//   const loadPromise = (async () => {
//     const result = await pool.query(
//       `
//         SELECT
//           p.permission_id,
//           p.permission_key,
//           COALESCE(rp.can_view, FALSE) AS can_view,
//           COALESCE(rp.can_create, FALSE) AS can_create,
//           COALESCE(rp.can_update, FALSE) AS can_update,
//           COALESCE(rp.can_delete, FALSE) AS can_delete
//         FROM permissions p
//         LEFT JOIN role_permissions rp
//           ON rp.permission_id = p.permission_id
//          AND rp.role_id = $1
//         ORDER BY p.permission_id;
//       `,
//       [roleId]
//     );

//     const permissions = Object.create(null);

//     for (const row of result.rows) {
//       permissions[row.permission_key] = {
//         permission_id: row.permission_id,
//         permission_key: row.permission_key,

//         view: row.can_view === true,
//         create: row.can_create === true,
//         update: row.can_update === true,
//         delete: row.can_delete === true,

//         can_view: row.can_view === true,
//         can_create: row.can_create === true,
//         can_update: row.can_update === true,
//         can_delete: row.can_delete === true,
//       };
//     }

//     // Prevent an old in-flight query from restoring
//     // stale data after cache invalidation.
//     if ((cacheVersions.get(roleId) || 0) === version) {
//       permissionCache.set(roleId, {
//         permissions,
//         expiresAt: Date.now() + CACHE_TTL,
//       });
//     }

//     return permissions;
//   })();

//   pendingLoads.set(roleId, loadPromise);

//   try {
//     return await loadPromise;
//   } finally {
//     if (pendingLoads.get(roleId) === loadPromise) {
//       pendingLoads.delete(roleId);
//     }
//   }
// }

// /**
//  * Get all permissions for a role.
//  * Preserves the response structure used by the API.
//  */
// export async function getRolePermissions(roleId) {
//   const id = normalizeRoleId(roleId);

//   if (!id) {
//     return [];
//   }

//   const permissions = await getRolePermissionMap(id);

//   return Object.values(permissions);
// }

// /**
//  * Invalidate permissions immediately after a role's
//  * permission records have been changed.
//  */
// export function invalidateRolePermissions(roleId) {
//   const id = normalizeRoleId(roleId);

//   if (!id) {
//     return;
//   }

//   permissionCache.delete(id);
//   pendingLoads.delete(id);

//   cacheVersions.set(
//     id,
//     (cacheVersions.get(id) || 0) + 1
//   );
// }

// /**
//  * Check a role's permission.
//  *
//  * This checks the role only.
//  * It does not authenticate a user or verify company membership.
//  */
// export async function hasPermission(
//   roleId,
//   permissionKey,
//   action = "view"
// ) {
//   const id = normalizeRoleId(roleId);

//   if (
//     !id ||
//     typeof permissionKey !== "string" ||
//     !permissionKey.trim() ||
//     !PERMISSION_COLUMNS[action]
//   ) {
//     return false;
//   }

//   try {
//     const permissions = await getRolePermissionMap(id);

//     return permissions[permissionKey]?.[action] === true;
//   } catch (error) {
//     console.error(
//       "[PERMISSIONS] Failed to load role permissions:",
//       error.message
//     );

//     // Fail closed.
//     return false;
//   }
// }

// /**
//  * Validate company membership and permission together.
//  *
//  * The role assigned in user_companies is authoritative.
//  * Membership is checked against PostgreSQL on every call.
//  */
// export async function requirePermission(
//   user,
//   permissionKey,
//   action = "view"
// ) {
//   const permissionColumn = PERMISSION_COLUMNS[action];

//   if (
//     !user ||
//     typeof permissionKey !== "string" ||
//     !permissionKey.trim() ||
//     !permissionColumn
//   ) {
//     throw new Error(!user ? "UNAUTHORIZED" : "FORBIDDEN");
//   }

//   const userId = user.userId ?? user.user_id;
//   const companyId = user.companyId ?? user.company_id;

//   if (
//     userId == null ||
//     companyId == null ||
//     !Number.isInteger(Number(userId)) ||
//     !Number.isInteger(Number(companyId)) ||
//     Number(userId) <= 0 ||
//     Number(companyId) <= 0
//   ) {
//     throw new Error("UNAUTHORIZED");
//   }

//   const result = await pool.query(
//   `
//     SELECT
//       uc.role_id,
//       r.role_name,
//       COALESCE(
//         rp.${permissionColumn},
//         FALSE
//       ) AS allowed
//     FROM user_companies uc
//     INNER JOIN users u
//       ON u.user_id = uc.user_id
//     INNER JOIN companies c
//       ON c.company_id = uc.company_id
//     INNER JOIN roles r
//       ON r.role_id = uc.role_id
//     LEFT JOIN permissions p
//       ON p.permission_key = $3
//     LEFT JOIN role_permissions rp
//       ON rp.role_id = uc.role_id
//      AND rp.permission_id = p.permission_id
//     WHERE uc.user_id = $1
//       AND uc.company_id = $2
//       AND u.is_active = TRUE
//       AND c.is_active = TRUE
//       AND (
//         r.company_id IS NULL
//         OR r.company_id = uc.company_id
//       )
//     LIMIT 1;
//   `,
//   [
//     Number(userId),
//     Number(companyId),
//     permissionKey,
//   ]
// );

//   if (result.rows.length === 0) {
//     throw new Error("FORBIDDEN");
//   }

//   if (result.rows[0].allowed !== true) {
//     throw new Error("FORBIDDEN");
//   }

//   return true;
// }


import pool from "@/lib/db";

const PERMISSION_COLUMNS = Object.freeze({
  view: "can_view",
  create: "can_create",
  update: "can_update",
  delete: "can_delete",
});

const CACHE_TTL = 5000;

const globalForPermissions = globalThis;

const permissionCache =
  globalForPermissions.__erpPermissionCache || new Map();

const pendingLoads =
  globalForPermissions.__erpPermissionPending || new Map();

const cacheVersions =
  globalForPermissions.__erpPermissionVersions || new Map();

globalForPermissions.__erpPermissionCache = permissionCache;
globalForPermissions.__erpPermissionPending = pendingLoads;
globalForPermissions.__erpPermissionVersions = cacheVersions;

function normalizeRoleId(roleId) {
  const id = Number(roleId);
  return Number.isInteger(id) && id > 0 ? id : null;
}

async function getRolePermissionMap(roleId) {
  const cached = permissionCache.get(roleId);

  if (cached && cached.expiresAt > Date.now()) {
    return cached.permissions;
  }

  if (cached) permissionCache.delete(roleId);

  const pending = pendingLoads.get(roleId);
  if (pending) return pending;

  const version = cacheVersions.get(roleId) || 0;

  const loadPromise = (async () => {
    const result = await pool.query(
      `
        SELECT
          p.permission_id,
          p.permission_key,
          COALESCE(rp.can_view, FALSE) AS can_view,
          COALESCE(rp.can_create, FALSE) AS can_create,
          COALESCE(rp.can_update, FALSE) AS can_update,
          COALESCE(rp.can_delete, FALSE) AS can_delete
        FROM roles r
        CROSS JOIN permissions p
        LEFT JOIN role_permissions rp
          ON rp.permission_id = p.permission_id
         AND rp.role_id = r.role_id
        WHERE r.role_id = $1
          AND r.deleted_at IS NULL
        ORDER BY p.permission_id;
      `,
      [roleId]
    );

    const permissions = Object.create(null);

    for (const row of result.rows) {
      permissions[row.permission_key] = {
        permission_id: row.permission_id,
        permission_key: row.permission_key,
        view: row.can_view === true,
        create: row.can_create === true,
        update: row.can_update === true,
        delete: row.can_delete === true,
        can_view: row.can_view === true,
        can_create: row.can_create === true,
        can_update: row.can_update === true,
        can_delete: row.can_delete === true,
      };
    }

    if ((cacheVersions.get(roleId) || 0) === version) {
      permissionCache.set(roleId, {
        permissions,
        expiresAt: Date.now() + CACHE_TTL,
      });
    }

    return permissions;
  })();

  pendingLoads.set(roleId, loadPromise);

  try {
    return await loadPromise;
  } finally {
    if (pendingLoads.get(roleId) === loadPromise) {
      pendingLoads.delete(roleId);
    }
  }
}

export async function getRolePermissions(roleId) {
  const id = normalizeRoleId(roleId);
  if (!id) return [];

  const permissions = await getRolePermissionMap(id);
  return Object.values(permissions);
}

export function invalidateRolePermissions(roleId) {
  const id = normalizeRoleId(roleId);
  if (!id) return;

  permissionCache.delete(id);
  pendingLoads.delete(id);

  cacheVersions.set(
    id,
    (cacheVersions.get(id) || 0) + 1
  );
}

export async function hasPermission(
  roleId,
  permissionKey,
  action = "view"
) {
  const id = normalizeRoleId(roleId);

  if (
    !id ||
    typeof permissionKey !== "string" ||
    !permissionKey.trim() ||
    !PERMISSION_COLUMNS[action]
  ) {
    return false;
  }

  try {
    const permissions = await getRolePermissionMap(id);
    return permissions[permissionKey]?.[action] === true;
  } catch (error) {
    console.error(
      "[PERMISSIONS] Failed to load role permissions:",
      error.message
    );
    return false;
  }
}

export async function requirePermission(
  user,
  permissionKey,
  action = "view"
) {
  const permissionColumn = PERMISSION_COLUMNS[action];

  if (
    !user ||
    typeof permissionKey !== "string" ||
    !permissionKey.trim() ||
    !permissionColumn
  ) {
    throw new Error(!user ? "UNAUTHORIZED" : "FORBIDDEN");
  }

  const userId = user.userId ?? user.user_id;
  const companyId = user.companyId ?? user.company_id;

  if (
    userId == null ||
    companyId == null ||
    !Number.isInteger(Number(userId)) ||
    !Number.isInteger(Number(companyId)) ||
    Number(userId) <= 0 ||
    Number(companyId) <= 0
  ) {
    throw new Error("UNAUTHORIZED");
  }

  const result = await pool.query(
    `
      SELECT
        uc.role_id,
        r.role_name,
        COALESCE(rp.${permissionColumn}, FALSE) AS allowed
      FROM user_companies uc
      INNER JOIN users u
        ON u.user_id = uc.user_id
      INNER JOIN companies c
        ON c.company_id = uc.company_id
      INNER JOIN roles r
        ON r.role_id = uc.role_id
      LEFT JOIN permissions p
        ON p.permission_key = $3
      LEFT JOIN role_permissions rp
        ON rp.role_id = uc.role_id
       AND rp.permission_id = p.permission_id
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
    [
      Number(userId),
      Number(companyId),
      permissionKey,
    ]
  );

  if (
    result.rows.length === 0 ||
    result.rows[0].allowed !== true
  ) {
    throw new Error("FORBIDDEN");
  }

  return true;
}
