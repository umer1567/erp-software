
/**
 * Central Recycle Bin helper for user-company memberships.
 *
 * This file operates on the CENTRAL erp_system database.
 * It deliberately does not use tenant.db.
 *
 * IMPORTANT:
 * - Call these functions inside the caller's transaction.
 * - The membership primary key is (user_id, company_id).
 * - The global users account is never deleted by these functions.
 */

function positiveInteger(value, fieldName) {
    const number = Number(value);

    if (!Number.isInteger(number) || number <= 0) {
        const error = new Error(`Invalid ${fieldName}.`);
        error.status = 400;
        throw error;
    }

    return number;
}

function parseSnapshot(value) {
    if (!value) return {};

    if (typeof value === "object") {
        return value;
    }

    try {
        return JSON.parse(value);
    } catch {
        return {};
    }
}

/**
 * Archive one company membership.
 *
 * The caller must have already checked users.delete/users.update
 * permissions and must pass the acting user's ID as deletedBy.
 */
export async function archiveUserCompanyMembership(
    client,
    {
        userId,
        companyId,
        deletedBy,
        deletionReason = "Company access removed",
    }
) {
    const targetUserId = positiveInteger(userId, "user ID");
    const targetCompanyId = positiveInteger(companyId, "company ID");
    const actorId = positiveInteger(deletedBy, "acting user ID");

    const membershipResult = await client.query(
        `
        SELECT
            uc.user_id,
            uc.company_id,
            uc.role_id,
            uc.assigned_at,
            uc.company_password_hash,
            uc.deleted_at,
            u.full_name,
            u.username,
            u.email,
            c.company_name,
            r.role_name,
            r.is_system_role
        FROM public.user_companies uc
        INNER JOIN public.users u
            ON u.user_id = uc.user_id
        INNER JOIN public.companies c
            ON c.company_id = uc.company_id
        INNER JOIN public.roles r
            ON r.role_id = uc.role_id
        WHERE uc.user_id = $1
          AND uc.company_id = $2
        FOR UPDATE OF uc
        `,
        [targetUserId, targetCompanyId]
    );

    if (membershipResult.rowCount === 0) {
        const error = new Error("Company membership was not found.");
        error.status = 404;
        throw error;
    }

    const membership = membershipResult.rows[0];

    if (membership.deleted_at) {
        const error = new Error("This company membership is already archived.");
        error.status = 409;
        throw error;
    }

    // Protect the last active company ADMIN membership.
    if (
        membership.is_system_role &&
        String(membership.role_name).toUpperCase() === "ADMIN"
    ) {
        const adminsResult = await client.query(
            `
            SELECT COUNT(*)::INTEGER AS admin_count
            FROM public.user_companies uc
            INNER JOIN public.roles r
                ON r.role_id = uc.role_id
            INNER JOIN public.users u
                ON u.user_id = uc.user_id
            WHERE uc.company_id = $1
              AND uc.deleted_at IS NULL
              AND u.is_active = TRUE
              AND r.is_system_role = TRUE
              AND UPPER(r.role_name) = 'ADMIN'
            `,
            [targetCompanyId]
        );

        if (Number(adminsResult.rows[0]?.admin_count || 0) <= 1) {
            const error = new Error(
                "The last active company ADMIN membership cannot be removed."
            );
            error.status = 409;
            throw error;
        }
    }

    const recordSnapshot = {
        user_id: membership.user_id,
        company_id: membership.company_id,
        role_id: membership.role_id,
        assigned_at: membership.assigned_at,
        company_password_hash: membership.company_password_hash,
        full_name: membership.full_name,
        username: membership.username,
        email: membership.email,
        company_name: membership.company_name,
        role_name: membership.role_name,
    };

    const recordLabel = `${membership.full_name} (${membership.username}) - ${membership.company_name}`;

    const archiveResult = await client.query(
        `
        INSERT INTO public.user_company_recycle_bin_items (
            company_id,
            user_id,
            module_key,
            source_table,
            record_label,
            deleted_by,
            deleted_at,
            deletion_reason,
            record_snapshot,
            relationship_snapshot
        )
        VALUES (
            $1,
            $2,
            'user_company_memberships',
            'user_companies',
            $3,
            $4,
            CURRENT_TIMESTAMP,
            $5,
            $6::JSONB,
            $7::JSONB
        )
        RETURNING recycle_bin_id
        `,
        [
            targetCompanyId,
            targetUserId,
            recordLabel,
            actorId,
            deletionReason,
            JSON.stringify(recordSnapshot),
            JSON.stringify([
                {
                    type: "user",
                    user_id: targetUserId,
                    username: membership.username,
                },
                {
                    type: "company",
                    company_id: targetCompanyId,
                    company_name: membership.company_name,
                },
                {
                    type: "role",
                    role_id: membership.role_id,
                    role_name: membership.role_name,
                },
            ]),
        ]
    );

    const updateResult = await client.query(
        `
        UPDATE public.user_companies
        SET
            deleted_at = CURRENT_TIMESTAMP,
            deleted_by = $3
        WHERE user_id = $1
          AND company_id = $2
          AND deleted_at IS NULL
        RETURNING user_id, company_id
        `,
        [targetUserId, targetCompanyId, actorId]
    );

    if (updateResult.rowCount !== 1) {
        const error = new Error(
            "Company membership could not be archived."
        );
        error.status = 409;
        throw error;
    }

    return {
        success: true,
        archiveId: Number(archiveResult.rows[0].recycle_bin_id),
        userId: targetUserId,
        companyId: targetCompanyId,
        recordLabel,
    };
}

/**
 * Restore one archived company membership.
 *
 * archiveId is the actual positive ID in the central archive table.
 */
export async function restoreUserCompanyMembership(
    client,
    {
        archiveId,
        companyId,
    }
) {
    const targetArchiveId = positiveInteger(archiveId, "archive ID");
    const targetCompanyId = positiveInteger(companyId, "company ID");

    const archiveResult = await client.query(
        `
        SELECT *
        FROM public.user_company_recycle_bin_items
        WHERE recycle_bin_id = $1
          AND company_id = $2
          AND module_key = 'user_company_memberships'
        FOR UPDATE
        `,
        [targetArchiveId, targetCompanyId]
    );

    if (archiveResult.rowCount === 0) {
        const error = new Error("Archived company membership was not found.");
        error.status = 404;
        throw error;
    }

    const archive = archiveResult.rows[0];
    const snapshot = parseSnapshot(archive.record_snapshot);

    const targetUserId = positiveInteger(
        archive.user_id,
        "archived user ID"
    );

    const roleId = positiveInteger(snapshot.role_id, "archived role ID");

    // Verify the original user and company still exist.
    const ownerResult = await client.query(
        `
        SELECT
            u.user_id,
            c.company_id
        FROM public.users u
        CROSS JOIN public.companies c
        WHERE u.user_id = $1
          AND c.company_id = $2
        `,
        [targetUserId, targetCompanyId]
    );

    if (ownerResult.rowCount === 0) {
        const error = new Error(
            "The original user or company no longer exists. Membership cannot be restored."
        );
        error.status = 409;
        throw error;
    }

    // Verify the original role still exists.
    const roleResult = await client.query(
        `
        SELECT role_id
        FROM public.roles
        WHERE role_id = $1
        `,
        [roleId]
    );

    if (roleResult.rowCount === 0) {
        const error = new Error(
            "The original role no longer exists. Restore or recreate the role first."
        );
        error.status = 409;
        throw error;
    }

    const restoreResult = await client.query(
        `
        INSERT INTO public.user_companies (
            user_id,
            company_id,
            assigned_at,
            role_id,
            company_password_hash,
            deleted_at,
            deleted_by
        )
        VALUES (
            $1,
            $2,
            COALESCE($3::TIMESTAMP, CURRENT_TIMESTAMP),
            $4,
            $5,
            NULL,
            NULL
        )
        ON CONFLICT (user_id, company_id)
        DO UPDATE SET
            assigned_at = EXCLUDED.assigned_at,
            role_id = EXCLUDED.role_id,
            company_password_hash = EXCLUDED.company_password_hash,
            deleted_at = NULL,
            deleted_by = NULL
        WHERE public.user_companies.deleted_at IS NOT NULL
        RETURNING user_id, company_id, role_id
        `,
        [
            targetUserId,
            targetCompanyId,
            snapshot.assigned_at || null,
            roleId,
            snapshot.company_password_hash ?? null,
        ]
    );

    if (restoreResult.rowCount !== 1) {
        const error = new Error(
            "An active membership already exists for this user and company."
        );
        error.status = 409;
        throw error;
    }

    await client.query(
        `
        DELETE FROM public.user_company_recycle_bin_items
        WHERE recycle_bin_id = $1
          AND company_id = $2
        `,
        [targetArchiveId, targetCompanyId]
    );

    return {
        success: true,
        userId: targetUserId,
        companyId: targetCompanyId,
        roleId,
    };
}

/**
 * Permanently delete an archived membership.
 *
 * This never deletes the global users account.
 */
export async function permanentlyDeleteUserCompanyMembership(
    client,
    {
        archiveId,
        companyId,
    }
) {
    const targetArchiveId = positiveInteger(archiveId, "archive ID");
    const targetCompanyId = positiveInteger(companyId, "company ID");

    const archiveResult = await client.query(
        `
        SELECT
            recycle_bin_id,
            user_id,
            company_id
        FROM public.user_company_recycle_bin_items
        WHERE recycle_bin_id = $1
          AND company_id = $2
          AND module_key = 'user_company_memberships'
        FOR UPDATE
        `,
        [targetArchiveId, targetCompanyId]
    );

    if (archiveResult.rowCount === 0) {
        const error = new Error("Archived company membership was not found.");
        error.status = 404;
        throw error;
    }

    const archive = archiveResult.rows[0];

    await client.query(
        `
        DELETE FROM public.user_companies
        WHERE user_id = $1
          AND company_id = $2
          AND deleted_at IS NOT NULL
        `,
        [archive.user_id, archive.company_id]
    );

    await client.query(
        `
        DELETE FROM public.user_company_recycle_bin_items
        WHERE recycle_bin_id = $1
          AND company_id = $2
        `,
        [targetArchiveId, targetCompanyId]
    );

    return {
        success: true,
        userId: Number(archive.user_id),
        companyId: Number(archive.company_id),
    };
}
