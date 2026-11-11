import pool from "@/lib/db";

export async function hasPermission(
  roleId,
  permissionKey,
  action = "view"
) {
  const result = await pool.query(
    `
    SELECT
      CASE
        WHEN $2 = 'view' THEN rp.can_view
        WHEN $2 = 'create' THEN rp.can_create
        WHEN $2 = 'update' THEN rp.can_update
        WHEN $2 = 'delete' THEN rp.can_delete
        ELSE FALSE
      END AS allowed

    FROM role_permissions rp

    INNER JOIN permissions p
      ON p.permission_id = rp.permission_id

    WHERE rp.role_id = $1
      AND p.permission_key = $3
    `,
    [
      roleId,
      action,
      permissionKey,
    ]
  );

  return result.rows[0]?.allowed === true;
}


export async function requirePermission(
  user,
  permissionKey,
  action = "view"
) {
  if (!user) {
    throw new Error("UNAUTHORIZED");
  }

  const allowed = await hasPermission(
    user.roleId,
    permissionKey,
    action
  );

  if (!allowed) {
    throw new Error("FORBIDDEN");
  }

  return true;
}