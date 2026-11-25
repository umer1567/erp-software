
import { NextResponse } from "next/server";
import pool from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { hasPermission } from "@/lib/permissions";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function parseRoleId(value) {
  const id = Number(value);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
}

function json(data, status = 200) {
  return NextResponse.json(data, {
    status,
    headers: {
      "Cache-Control": "no-store, no-cache, must-revalidate",
    },
  });
}

async function authorize(action) {
  const user = await getCurrentUser();

  if (!user) {
    return {
      response: json(
        { success: false, message: "Unauthorized. Please log in again." },
        401
      ),
    };
  }

  if (!user.companyId || !user.roleId) {
    return {
      response: json(
        { success: false, message: "Your session is missing company or role information." },
        401
      ),
    };
  }

  const allowed = await hasPermission(user.roleId, "roles", action);

  if (!allowed) {
    return {
      response: json(
        { success: false, message: `You do not have permission to ${action} roles.` },
        403
      ),
    };
  }

  return { user };
}

async function getParamsId(params) {
  const resolved = await params;
  return parseRoleId(resolved?.id);
}

/* -------------------------------------------------------------------------- */
/* UPDATE CUSTOM ROLE                                                         */
/* -------------------------------------------------------------------------- */

export async function PUT(request, { params }) {
  try {
    const auth = await authorize("update");
    if (auth.response) return auth.response;

    const { user } = auth;
    const roleId = await getParamsId(params);

    if (!roleId) {
      return json({ success: false, message: "Invalid role ID." }, 400);
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return json({ success: false, message: "Invalid request body." }, 400);
    }

    const roleName =
      typeof body?.roleName === "string" ? body.roleName.trim() : "";

    const description =
      typeof body?.description === "string" && body.description.trim()
        ? body.description.trim()
        : null;

    if (!roleName) {
      return json({ success: false, message: "Role name is required." }, 400);
    }

    if (roleName.length > 50) {
      return json({ success: false, message: "Role name cannot exceed 100 characters." }, 400);
    }

    if (description && description.length > 255) {
      return json({ success: false, message: "Description cannot exceed 255 characters." }, 400);
    }

    const normalizedName = roleName.toUpperCase();

    if (["ADMIN", "SUB_ADMIN", "USER"].includes(normalizedName)) {
      return json(
        { success: false, message: "ADMIN, SUB_ADMIN, and USER are protected system role names." },
        400
      );
    }

    const result = await pool.query(
      `
        UPDATE public.roles
        SET
          role_name = $1,
          description = $2,
          updated_at = CURRENT_TIMESTAMP
        WHERE role_id = $3
          AND company_id = $4
          AND is_system_role = FALSE
          AND deleted_at IS NULL
        RETURNING
          role_id,
          role_name,
          description,
          is_system_role,
          company_id,
          created_at,
          updated_at;
      `,
      [normalizedName, description, roleId, user.companyId]
    );

    if (result.rowCount === 0) {
      const existing = await pool.query(
        `
          SELECT role_id, is_system_role, company_id, deleted_at
          FROM public.roles
          WHERE role_id = $1
            AND (company_id IS NULL OR company_id = $2)
          LIMIT 1;
        `,
        [roleId, user.companyId]
      );

      if (existing.rowCount === 0) {
        return json({ success: false, message: "Role not found." }, 404);
      }

      const role = existing.rows[0];

      if (role.is_system_role || role.company_id === null) {
        return json({ success: false, message: "System or global roles cannot be modified." }, 403);
      }

      if (role.deleted_at) {
        return json({ success: false, message: "Archived roles cannot be modified. Restore the role first." }, 409);
      }

      return json({ success: false, message: "Role does not belong to your company." }, 403);
    }

    return json({
      success: true,
      message: "Role updated successfully.",
      role: result.rows[0],
    });
  } catch (error) {
    console.error("UPDATE ROLE ERROR:", error);

    if (error.code === "23505") {
      return json({ success: false, message: "A role with this name already exists." }, 409);
    }

    return json({ success: false, message: "Failed to update role." }, 500);
  }
}

/* -------------------------------------------------------------------------- */
/* ARCHIVE CUSTOM ROLE                                                        */
/* -------------------------------------------------------------------------- */


export async function DELETE(request, { params }) {
  let client;

  try {
    const auth = await authorize("delete");
    if (auth.response) return auth.response;

    const { user } = auth;
    const roleId = await getParamsId(params);

    if (!roleId) {
      return json({ success: false, message: "Invalid role ID." }, 400);
    }

    client = await pool.connect();
    await client.query("BEGIN");

    const roleResult = await client.query(
      `
        SELECT
          role_id,
          role_name,
          description,
          is_system_role,
          company_id,
          created_at,
          updated_at
        FROM public.roles
        WHERE role_id = $1
          AND company_id = $2
          AND is_system_role = FALSE
          AND deleted_at IS NULL
        FOR UPDATE;
      `,
      [roleId, user.companyId]
    );

    if (roleResult.rowCount === 0) {
      await client.query("ROLLBACK");
      return json({ success: false, message: "Active custom role not found." }, 404);
    }

    const role = roleResult.rows[0];

    const references = await client.query(
      `
        SELECT
          (SELECT COUNT(*)::INTEGER
           FROM public.user_companies
           WHERE role_id = $1) AS membership_count,
          (SELECT COUNT(*)::INTEGER
           FROM public.users
           WHERE role_id = $1) AS legacy_user_count;
      `,
      [roleId]
    );

    const membershipCount = references.rows[0].membership_count;
    const legacyUserCount = references.rows[0].legacy_user_count;

    if (membershipCount + legacyUserCount > 0) {
      await client.query("ROLLBACK");

      return json(
        {
          success: false,
          message: "This role is still referenced by users or company memberships. Reassign those records before archiving.",
          membershipCount,
          legacyUserCount,
        },
        409
      );
    }

    const permissionSnapshot = await client.query(
      `
        SELECT
          rp.role_permission_id,
          rp.permission_id,
          p.permission_key,
          rp.can_view,
          rp.can_create,
          rp.can_update,
          rp.can_delete
        FROM public.role_permissions rp
        LEFT JOIN public.permissions p
          ON p.permission_id = rp.permission_id
        WHERE rp.role_id = $1
        ORDER BY rp.permission_id;
      `,
      [roleId]
    );

    const archiveResult = await client.query(
      `
        INSERT INTO public.role_recycle_bin_items (
          company_id,
          role_id,
          record_label,
          deleted_by,
          deletion_reason,
          record_snapshot,
          relationship_snapshot
        )
        VALUES ($1, $2, $3, $4, $5, $6::JSONB, $7::JSONB)
        RETURNING recycle_bin_id;
      `,
      [
        user.companyId,
        roleId,
        role.role_name,
        user.userId,
        "Role archived by user",
        JSON.stringify(role),
        JSON.stringify(permissionSnapshot.rows),
      ]
    );

    await client.query(
      `
        UPDATE public.roles
        SET
          deleted_at = CURRENT_TIMESTAMP,
          deleted_by = $1,
          updated_at = CURRENT_TIMESTAMP
        WHERE role_id = $2
          AND company_id = $3
          AND deleted_at IS NULL;
      `,
      [user.userId, roleId, user.companyId]
    );

    await client.query("COMMIT");

    const archiveId = Number(archiveResult.rows[0].recycle_bin_id);
    const recycleBinId = -(1_000_000_000_000 + archiveId);

    return json({
      success: true,
      message: "Role moved to Recycle Bin successfully.",
      roleId,
      recycleBinId,
    });
  } catch (error) {
    if (client) {
      await client.query("ROLLBACK").catch(() => {});
    }

    console.error("ARCHIVE ROLE ERROR:", error);

    if (error.code === "23505") {
      return json(
        { success: false, message: "This role already has a Recycle Bin entry." },
        409
      );
    }

    return json(
      { success: false, message: "Failed to archive role." },
      500
    );
  } finally {
    client?.release();
  }
}
