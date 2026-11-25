
const ROLE_ARCHIVE_ID_OFFSET = 1_000_000_000_000;

/**
 * Encode role archive IDs into a separate negative-ID range.
 * Membership archive IDs continue using ordinary negative IDs.
 */
export function encodeRoleRecycleBinId(archiveId) {
  const id = Number(archiveId);

  if (!Number.isSafeInteger(id) || id <= 0) {
    throw new Error("INVALID_ROLE_ARCHIVE_ID");
  }

  return -(ROLE_ARCHIVE_ID_OFFSET + id);
}

export function decodeRoleRecycleBinId(value) {
  const id = Number(value);

  if (
    !Number.isSafeInteger(id) ||
    id >= -ROLE_ARCHIVE_ID_OFFSET
  ) {
    return null;
  }

  const archiveId = Math.abs(id) - ROLE_ARCHIVE_ID_OFFSET;

  return Number.isSafeInteger(archiveId) && archiveId > 0
    ? archiveId
    : null;
}

/**
 * Archive a custom company role.
 *
 * The caller owns the transaction.
 * A role cannot be archived while users or memberships reference it.
 */
export async function archiveRole(
  client,
  {
    roleId,
    companyId,
    deletedBy,
    deletionReason = null,
  }
) {
  const id = Number(roleId);
  const company = Number(companyId);
  const actor = Number(deletedBy);

  if (
    !Number.isInteger(id) || id <= 0 ||
    !Number.isInteger(company) || company <= 0 ||
    !Number.isInteger(actor) || actor <= 0
  ) {
    throw new Error("INVALID_ROLE_ARCHIVE_INPUT");
  }

  const roleResult = await client.query(
    `
      SELECT
        role_id,
        role_name,
        description,
        is_system_role,
        company_id,
        created_at,
        updated_at,
        deleted_at,
        deleted_by
      FROM public.roles
      WHERE role_id = $1
        AND company_id = $2
      FOR UPDATE;
    `,
    [id, company]
  );

  if (roleResult.rows.length === 0) {
    const error = new Error("ROLE_NOT_FOUND");
    error.status = 404;
    throw error;
  }

  const role = roleResult.rows[0];

  if (role.is_system_role === true) {
    const error = new Error("SYSTEM_ROLE_CANNOT_BE_ARCHIVED");
    error.status = 403;
    throw error;
  }

  if (role.deleted_at) {
    const error = new Error("ROLE_ALREADY_ARCHIVED");
    error.status = 409;
    throw error;
  }

  // Check both active and archived memberships. Keeping references
  // would make restoring or permanently deleting the role unsafe.
  const references = await client.query(
    `
      SELECT
        (SELECT COUNT(*)::INTEGER
         FROM public.users
         WHERE role_id = $1) AS user_count,
        (SELECT COUNT(*)::INTEGER
         FROM public.user_companies
         WHERE role_id = $1) AS membership_count;
    `,
    [id]
  );

  const userCount = Number(references.rows[0]?.user_count || 0);
  const membershipCount = Number(
    references.rows[0]?.membership_count || 0
  );

  if (userCount > 0 || membershipCount > 0) {
    const error = new Error(
      "ROLE_IN_USE: Reassign users and company memberships before archiving this role."
    );
    error.status = 409;
    error.details = {
      userCount,
      membershipCount,
    };
    throw error;
  }

  const permissionsResult = await client.query(
    `
      SELECT
        permission_id,
        can_view,
        can_create,
        can_update,
        can_delete
      FROM public.role_permissions
      WHERE role_id = $1
      ORDER BY permission_id;
    `,
    [id]
  );

  const snapshot = {
    ...role,
    permissions: permissionsResult.rows,
  };

  const archiveResult = await client.query(
    `
      INSERT INTO public.role_recycle_bin_items (
        company_id,
        role_id,
        module_key,
        source_table,
        record_label,
        deleted_by,
        deletion_reason,
        record_snapshot,
        relationship_snapshot
      )
      VALUES (
        $1,
        $2,
        'roles',
        'roles',
        $3,
        $4,
        $5,
        $6::JSONB,
        $7::JSONB
      )
      RETURNING recycle_bin_id;
    `,
    [
      company,
      id,
      role.role_name,
      actor,
      deletionReason,
      JSON.stringify(snapshot),
      JSON.stringify({
        rolePermissions: permissionsResult.rows,
      }),
    ]
  );

  await client.query(
    `
      UPDATE public.roles
      SET
        deleted_at = CURRENT_TIMESTAMP,
        deleted_by = $3,
        updated_at = CURRENT_TIMESTAMP
      WHERE role_id = $1
        AND company_id = $2
        AND deleted_at IS NULL;
    `,
    [id, company, actor]
  );

  return Number(archiveResult.rows[0].recycle_bin_id);
}

/**
 * Restore an archived custom role.
 * The caller owns the transaction.
 */
export async function restoreRole(
  client,
  {
    archiveId,
    companyId,
  }
) {
  const archive = await client.query(
    `
      SELECT
        recycle_bin_id,
        role_id,
        company_id
      FROM public.role_recycle_bin_items
      WHERE recycle_bin_id = $1
        AND company_id = $2
      FOR UPDATE;
    `,
    [Number(archiveId), Number(companyId)]
  );

  if (archive.rows.length === 0) {
    const error = new Error("ROLE_ARCHIVE_NOT_FOUND");
    error.status = 404;
    throw error;
  }

  const roleId = Number(archive.rows[0].role_id);

  const role = await client.query(
    `
      SELECT role_id, deleted_at
      FROM public.roles
      WHERE role_id = $1
        AND company_id = $2
      FOR UPDATE;
    `,
    [roleId, Number(companyId)]
  );

  if (role.rows.length === 0 || !role.rows[0].deleted_at) {
    const error = new Error("ARCHIVED_ROLE_RECORD_NOT_FOUND");
    error.status = 409;
    throw error;
  }

  await client.query(
    `
      UPDATE public.roles
      SET
        deleted_at = NULL,
        deleted_by = NULL,
        updated_at = CURRENT_TIMESTAMP
      WHERE role_id = $1
        AND company_id = $2;
    `,
    [roleId, Number(companyId)]
  );

  await client.query(
    `
      DELETE FROM public.role_recycle_bin_items
      WHERE recycle_bin_id = $1
        AND company_id = $2;
    `,
    [Number(archiveId), Number(companyId)]
  );

  return roleId;
}

/**
 * Permanently delete an archived custom role.
 * The caller owns the transaction.
 */
export async function permanentlyDeleteRole(
  client,
  {
    archiveId,
    companyId,
  }
) {
  const archive = await client.query(
    `
      SELECT role_id
      FROM public.role_recycle_bin_items
      WHERE recycle_bin_id = $1
        AND company_id = $2
      FOR UPDATE;
    `,
    [Number(archiveId), Number(companyId)]
  );

  if (archive.rows.length === 0) {
    const error = new Error("ROLE_ARCHIVE_NOT_FOUND");
    error.status = 404;
    throw error;
  }

  const roleId = Number(archive.rows[0].role_id);

  const role = await client.query(
    `
      SELECT role_id
      FROM public.roles
      WHERE role_id = $1
        AND company_id = $2
        AND deleted_at IS NOT NULL
      FOR UPDATE;
    `,
    [roleId, Number(companyId)]
  );

  if (role.rows.length === 0) {
    const error = new Error("ARCHIVED_ROLE_RECORD_NOT_FOUND");
    error.status = 409;
    throw error;
  }

  const references = await client.query(
    `
      SELECT
        (SELECT COUNT(*)::INTEGER
         FROM public.users
         WHERE role_id = $1) AS user_count,
        (SELECT COUNT(*)::INTEGER
         FROM public.user_companies
         WHERE role_id = $1) AS membership_count;
    `,
    [roleId]
  );

  const userCount = Number(references.rows[0]?.user_count || 0);
  const membershipCount = Number(
    references.rows[0]?.membership_count || 0
  );

  if (userCount > 0 || membershipCount > 0) {
    const error = new Error(
      "ROLE_IN_USE: This role is still referenced and cannot be permanently deleted."
    );
    error.status = 409;
    error.details = {
      userCount,
      membershipCount,
    };
    throw error;
  }

  await client.query(
    `
      DELETE FROM public.roles
      WHERE role_id = $1
        AND company_id = $2
        AND deleted_at IS NOT NULL;
    `,
    [roleId, Number(companyId)]
  );

  await client.query(
    `
      DELETE FROM public.role_recycle_bin_items
      WHERE recycle_bin_id = $1
        AND company_id = $2;
    `,
    [Number(archiveId), Number(companyId)]
  );

  return roleId;
}
