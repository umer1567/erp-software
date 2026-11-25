
import { NextResponse } from "next/server";

import pool from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { hasPermission } from "@/lib/permissions";
import {
    archiveUserCompanyMembership,
} from "@/lib/user-company-recycle-bin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/* -------------------------------------------------------------------------- */
/* Helpers                                                                    */
/* -------------------------------------------------------------------------- */

function parseId(value) {
    const id = Number(value);
    return Number.isSafeInteger(id) && id > 0 ? id : null;
}

function jsonError(message, status = 400) {
    return NextResponse.json(
        { success: false, message },
        {
            status,
            headers: {
                "Cache-Control": "no-store",
            },
        }
    );
}

function jsonSuccess(data, status = 200) {
    return NextResponse.json(data, {
        status,
        headers: {
            "Cache-Control": "no-store",
        },
    });
}

async function readJson(request) {
    try {
        return await request.json();
    } catch {
        return null;
    }
}

async function rollback(client, transactionStarted) {
    if (client && transactionStarted) {
        await client.query("ROLLBACK").catch(() => {});
    }
}

/**
 * Return active companies accessible to a user.
 *
 * Archived memberships are deliberately excluded.
 */
async function getAllowedCompanies(client, userId) {
    const result = await client.query(
        `
        SELECT
            c.company_id,
            c.company_name,
            c.location,
            c.city,
            c.state_province,
            c.province,
            c.country,
            c.address,
            c.postal_code,
            COALESCE(
                NULLIF(BTRIM(c.location), ''),
                NULLIF(BTRIM(c.city), ''),
                NULLIF(BTRIM(c.address), '')
            ) AS company_city,
            c.is_active,
            actor_role.role_name AS your_role
        FROM public.user_companies uc
        INNER JOIN public.companies c
            ON c.company_id = uc.company_id
        LEFT JOIN public.roles actor_role
            ON actor_role.role_id = uc.role_id
        WHERE uc.user_id = $1
          AND uc.deleted_at IS NULL
          AND c.is_active = TRUE
        ORDER BY c.company_name ASC, c.company_id ASC
        `,
        [userId]
    );

    return result.rows;
}

async function getAvailableRoles(client, companyIds) {
    if (!companyIds.length) {
        return [];
    }

    const result = await client.query(
        `
        SELECT
            role_id,
            role_name,
            description,
            is_system_role,
            company_id
        FROM public.roles
        WHERE company_id IS NULL
           OR company_id = ANY($1::int[])
        ORDER BY role_name ASC, role_id ASC
        `,
        [companyIds]
    );

    return result.rows;
}

async function getTargetUserInAccessibleCompanies(
    client,
    targetUserId,
    actorUserId
) {
    return client.query(
        `
        SELECT
            u.user_id,
            u.username,
            u.full_name,
            u.is_active
        FROM public.users u
        WHERE u.user_id = $1
          AND EXISTS (
              SELECT 1
              FROM public.user_companies target_uc
              INNER JOIN public.user_companies actor_uc
                  ON actor_uc.company_id = target_uc.company_id
                 AND actor_uc.user_id = $2
                 AND actor_uc.deleted_at IS NULL
              WHERE target_uc.user_id = u.user_id
                AND target_uc.deleted_at IS NULL
          )
        LIMIT 1
        FOR UPDATE OF u
        `,
        [targetUserId, actorUserId]
    );
}

async function validateCompanyRole(client, roleId, companyId) {
    const result = await client.query(
        `
        SELECT
            role_id,
            role_name,
            is_system_role,
            company_id
        FROM public.roles
        WHERE role_id = $1
          AND (
              company_id IS NULL
              OR company_id = $2
          )
        LIMIT 1
        `,
        [roleId, companyId]
    );

    return result.rows[0] || null;
}

/* -------------------------------------------------------------------------- */
/* GET /api/users/company-access                                              */
/* -------------------------------------------------------------------------- */

/**
 * Optional query parameter:
 * /api/users/company-access?userId=123
 *
 * Returns only active company memberships.
 */
export async function GET(request) {
    try {
        const currentUser = await getCurrentUser();

        if (!currentUser) {
            return jsonError("Unauthorized.", 401);
        }

        const allowed = await hasPermission(
            currentUser.roleId,
            "users",
            "view"
        );

        if (!allowed) {
            return jsonError(
                "You do not have permission to view user access.",
                403
            );
        }

        const url = new URL(request.url);
        const rawUserId = url.searchParams.get("userId");

        let targetUserId = null;

        if (rawUserId !== null) {
            targetUserId = parseId(rawUserId);

            if (!targetUserId) {
                return jsonError("Invalid user ID.");
            }
        }

        const companies = await getAllowedCompanies(
            pool,
            currentUser.userId
        );

        const companyIds = companies.map((company) =>
            Number(company.company_id)
        );

        if (companyIds.length === 0) {
            return jsonSuccess({
                success: true,
                companies: [],
                assignments: [],
            });
        }

        const roles = await getAvailableRoles(pool, companyIds);

        const companiesWithRoles = companies.map((company) => ({
            ...company,
            roles: roles.filter(
                (role) =>
                    role.company_id == null ||
                    Number(role.company_id) ===
                        Number(company.company_id)
            ),
        }));

        let assignments = [];

        if (targetUserId !== null) {
            const targetResult = await pool.query(
                `
                SELECT u.user_id
                FROM public.users u
                WHERE u.user_id = $1
                  AND EXISTS (
                      SELECT 1
                      FROM public.user_companies target_uc
                      INNER JOIN public.user_companies actor_uc
                          ON actor_uc.company_id =
                             target_uc.company_id
                         AND actor_uc.user_id = $2
                         AND actor_uc.deleted_at IS NULL
                      WHERE target_uc.user_id = u.user_id
                        AND target_uc.deleted_at IS NULL
                  )
                LIMIT 1
                `,
                [targetUserId, currentUser.userId]
            );

            if (targetResult.rows.length === 0) {
                return jsonError(
                    "User not found in your accessible companies.",
                    404
                );
            }

            const assignmentResult = await pool.query(
                `
                SELECT
                    uc.user_id,
                    uc.company_id,
                    uc.role_id,
                    r.role_name
                FROM public.user_companies uc
                INNER JOIN public.roles r
                    ON r.role_id = uc.role_id
                INNER JOIN public.user_companies actor_uc
                    ON actor_uc.company_id = uc.company_id
                   AND actor_uc.user_id = $2
                   AND actor_uc.deleted_at IS NULL
                WHERE uc.user_id = $1
                  AND uc.deleted_at IS NULL
                ORDER BY uc.company_id ASC
                `,
                [targetUserId, currentUser.userId]
            );

            assignments = assignmentResult.rows;
        }

        return jsonSuccess({
            success: true,
            companies: companiesWithRoles,
            assignments,
        });
    } catch (error) {
        console.error("GET COMPANY ACCESS ERROR:", error);

        return jsonError("Failed to load company access.", 500);
    }
}

/* -------------------------------------------------------------------------- */
/* POST /api/users/company-access                                             */
/* -------------------------------------------------------------------------- */

/**
 * Assign an existing user to a company.
 *
 * Existing active membership:
 *   Updates its role.
 *
 * Existing archived membership:
 *   Returns 409. Restore it through Recycle Bin first.
 *
 * New membership:
 *   Inserts a new assignment.
 */
export async function POST(request) {
    let client;
    let transactionStarted = false;

    try {
        const currentUser = await getCurrentUser();

        if (!currentUser) {
            return jsonError("Unauthorized.", 401);
        }

        const allowed = await hasPermission(
            currentUser.roleId,
            "users",
            "update"
        );

        if (!allowed) {
            return jsonError(
                "You do not have permission to assign company access.",
                403
            );
        }

        const body = await readJson(request);

        if (!body) {
            return jsonError("Request body must contain valid JSON.");
        }

        const identifier =
            typeof body.identifier === "string"
                ? body.identifier.trim()
                : "";

        const companyId = parseId(body.companyId);
        const roleId = parseId(body.roleId);

        if (!identifier || !companyId || !roleId) {
            return jsonError(
                "Username or email, company, and role are required."
            );
        }

        client = await pool.connect();

        await client.query("BEGIN");
        transactionStarted = true;

        const actorCompanies = await getAllowedCompanies(
            client,
            currentUser.userId
        );

        const allowedCompanyIds = new Set(
            actorCompanies.map((company) =>
                Number(company.company_id)
            )
        );

        if (!allowedCompanyIds.has(companyId)) {
            await rollback(client, transactionStarted);
            transactionStarted = false;

            return jsonError(
                "You can assign users only to active companies you belong to.",
                403
            );
        }

        const userResult = await client.query(
            `
            SELECT
                user_id,
                username,
                full_name,
                is_active
            FROM public.users
            WHERE LOWER(username) = LOWER($1)
               OR (
                    email IS NOT NULL
                    AND LOWER(email) = LOWER($1)
               )
            LIMIT 1
            FOR UPDATE
            `,
            [identifier]
        );

        if (userResult.rows.length === 0) {
            await rollback(client, transactionStarted);
            transactionStarted = false;

            return jsonError(
                "No existing user was found with that username or email.",
                404
            );
        }

        const targetUser = userResult.rows[0];
        const targetUserId = Number(targetUser.user_id);

        if (targetUserId === Number(currentUser.userId)) {
            await rollback(client, transactionStarted);
            transactionStarted = false;

            return jsonError(
                "You cannot assign company access to your own account.",
                400
            );
        }

        if (!targetUser.is_active) {
            await rollback(client, transactionStarted);
            transactionStarted = false;

            return jsonError(
                "This user is inactive. Activate the account first.",
                400
            );
        }

        const role = await validateCompanyRole(
            client,
            roleId,
            companyId
        );

        if (!role) {
            await rollback(client, transactionStarted);
            transactionStarted = false;

            return jsonError(
                "The selected role is not available for this company.",
                400
            );
        }

        const assignmentResult = await client.query(
            `
            INSERT INTO public.user_companies (
                user_id,
                company_id,
                role_id
            )
            VALUES ($1, $2, $3)
            ON CONFLICT (user_id, company_id)
            DO UPDATE SET
                role_id = EXCLUDED.role_id
            WHERE public.user_companies.deleted_at IS NULL
            RETURNING
                user_id,
                company_id,
                role_id
            `,
            [targetUserId, companyId, roleId]
        );

        if (assignmentResult.rowCount === 0) {
            await rollback(client, transactionStarted);
            transactionStarted = false;

            return jsonError(
                "This user's membership in the selected company is archived. Restore it from Recycle Bin before assigning access again.",
                409
            );
        }

        await client.query("COMMIT");
        transactionStarted = false;

        const companyResult = await pool.query(
            `
            SELECT
                company_id,
                company_name,
                location,
                city,
                state_province,
                province,
                country,
                address,
                postal_code,
                COALESCE(
                    NULLIF(BTRIM(location), ''),
                    NULLIF(BTRIM(city), ''),
                    NULLIF(BTRIM(address), '')
                ) AS company_city
            FROM public.companies
            WHERE company_id = $1
            `,
            [companyId]
        );

        return jsonSuccess({
            success: true,
            message: "User assigned to the company successfully.",
            assignment: {
                user_id: targetUserId,
                username: targetUser.username,
                ...companyResult.rows[0],
                role_id: roleId,
                role_name: role.role_name,
            },
        });
    } catch (error) {
        await rollback(client, transactionStarted);

        console.error("POST COMPANY ACCESS ERROR:", error);

        if (error.code === "23503") {
            return jsonError(
                "The selected company, user, or role does not exist.",
                400
            );
        }

        if (error.status) {
            return jsonError(error.message, error.status);
        }

        return jsonError(
            "Failed to assign user to the company.",
            500
        );
    } finally {
        client?.release();
    }
}

/* -------------------------------------------------------------------------- */
/* PUT /api/users/company-access                                              */
/* -------------------------------------------------------------------------- */

/**
 * Replace assignments only within the acting user's active companies.
 *
 * Omitted active memberships are archived, not physically deleted.
 * Memberships in other companies are preserved.
 *
 * An already archived membership cannot be silently reactivated here.
 * It must first be restored from Recycle Bin.
 */
export async function PUT(request) {
    let client;
    let transactionStarted = false;

    try {
        const currentUser = await getCurrentUser();

        if (!currentUser) {
            return jsonError("Unauthorized.", 401);
        }

        const allowed = await hasPermission(
            currentUser.roleId,
            "users",
            "update"
        );

        if (!allowed) {
            return jsonError(
                "You do not have permission to update user access.",
                403
            );
        }

        const body = await readJson(request);

        if (!body) {
            return jsonError("Request body must contain valid JSON.");
        }

        const targetUserId = parseId(body.userId);
        const assignments = body.assignments;

        if (!targetUserId) {
            return jsonError("A valid user ID is required.");
        }

        if (Number(currentUser.userId) === targetUserId) {
            return jsonError(
                "You cannot change your own company access.",
                400
            );
        }

        if (!Array.isArray(assignments)) {
            return jsonError("Assignments must be an array.");
        }

        const normalizedAssignments = [];
        const seenCompanyIds = new Set();

        for (const item of assignments) {
            if (!item || typeof item !== "object") {
                return jsonError(
                    "Each assignment must include a company and role."
                );
            }

            const companyId = parseId(item.companyId);
            const roleId = parseId(item.roleId);

            if (!companyId || !roleId) {
                return jsonError(
                    "Every assignment needs a valid company ID and role ID."
                );
            }

            if (seenCompanyIds.has(companyId)) {
                return jsonError(
                    "A company can only appear once in the assignments."
                );
            }

            seenCompanyIds.add(companyId);

            normalizedAssignments.push({
                companyId,
                roleId,
            });
        }

        client = await pool.connect();

        await client.query("BEGIN");
        transactionStarted = true;

        const actorCompanies = await getAllowedCompanies(
            client,
            currentUser.userId
        );

        const manageableCompanyIds = actorCompanies.map((company) =>
            Number(company.company_id)
        );

        const actorCompanyIds = new Set(manageableCompanyIds);

        if (actorCompanyIds.size === 0) {
            await rollback(client, transactionStarted);
            transactionStarted = false;

            return jsonError(
                "You do not belong to any active company.",
                403
            );
        }

        for (const assignment of normalizedAssignments) {
            if (!actorCompanyIds.has(assignment.companyId)) {
                await rollback(client, transactionStarted);
                transactionStarted = false;

                return jsonError(
                    "You can assign users only to active companies you belong to.",
                    403
                );
            }
        }

        const targetResult = await getTargetUserInAccessibleCompanies(
            client,
            targetUserId,
            currentUser.userId
        );

        if (targetResult.rows.length === 0) {
            await rollback(client, transactionStarted);
            transactionStarted = false;

            return jsonError(
                "User not found in your accessible companies.",
                404
            );
        }

        if (!targetResult.rows[0].is_active) {
            await rollback(client, transactionStarted);
            transactionStarted = false;

            return jsonError(
                "This user is inactive. Activate the account first.",
                400
            );
        }

        /* ------------------------------------------------------------------ */
        /* Validate every requested role before changing memberships.         */
        /* ------------------------------------------------------------------ */

        for (const assignment of normalizedAssignments) {
            const role = await validateCompanyRole(
                client,
                assignment.roleId,
                assignment.companyId
            );

            if (!role) {
                await rollback(client, transactionStarted);
                transactionStarted = false;

                return jsonError(
                    `The selected role is not available for company ID ${assignment.companyId}.`,
                    400
                );
            }
        }

        const submittedCompanyIds = normalizedAssignments.map(
            (item) => item.companyId
        );

        /* ------------------------------------------------------------------ */
        /* Archive memberships omitted from the submitted assignments.        */
        /* ------------------------------------------------------------------ */

        const omittedResult = await client.query(
            `
            SELECT
                user_id,
                company_id
            FROM public.user_companies
            WHERE user_id = $1
              AND company_id = ANY($2::int[])
              AND deleted_at IS NULL
              AND NOT (
                  company_id = ANY($3::int[])
              )
            ORDER BY company_id ASC
            FOR UPDATE
            `,
            [
                targetUserId,
                manageableCompanyIds,
                submittedCompanyIds,
            ]
        );

        for (const membership of omittedResult.rows) {
            await archiveUserCompanyMembership(client, {
                userId: Number(membership.user_id),
                companyId: Number(membership.company_id),
                deletedBy: Number(currentUser.userId),
                deletionReason:
                    "Company access removed through User Company Access.",
            });
        }

        /* ------------------------------------------------------------------ */
        /* Insert new memberships or update existing active memberships.     */
        /* Archived memberships are not silently restored.                    */
        /* ------------------------------------------------------------------ */

        for (const assignment of normalizedAssignments) {
            const saveResult = await client.query(
                `
                INSERT INTO public.user_companies (
                    user_id,
                    company_id,
                    role_id
                )
                VALUES ($1, $2, $3)
                ON CONFLICT (user_id, company_id)
                DO UPDATE SET
                    role_id = EXCLUDED.role_id
                WHERE public.user_companies.deleted_at IS NULL
                RETURNING
                    user_id,
                    company_id,
                    role_id
                `,
                [
                    targetUserId,
                    assignment.companyId,
                    assignment.roleId,
                ]
            );

            if (saveResult.rowCount === 0) {
                await rollback(client, transactionStarted);
                transactionStarted = false;

                return jsonError(
                    `Membership for company ID ${assignment.companyId} is archived. Restore it from Recycle Bin before assigning access again.`,
                    409
                );
            }
        }

        await client.query("COMMIT");
        transactionStarted = false;

        /* ------------------------------------------------------------------ */
        /* Return the active assignments within manageable companies.         */
        /* ------------------------------------------------------------------ */

        const savedResult = await pool.query(
            `
            SELECT
                uc.user_id,
                uc.company_id,
                c.company_name,
                c.location,
                c.city,
                c.state_province,
                c.province,
                c.country,
                c.address,
                c.postal_code,
                COALESCE(
                    NULLIF(BTRIM(c.location), ''),
                    NULLIF(BTRIM(c.city), ''),
                    NULLIF(BTRIM(c.address), '')
                ) AS company_city,
                uc.role_id,
                r.role_name
            FROM public.user_companies uc
            INNER JOIN public.companies c
                ON c.company_id = uc.company_id
            INNER JOIN public.roles r
                ON r.role_id = uc.role_id
            WHERE uc.user_id = $1
              AND uc.company_id = ANY($2::int[])
              AND uc.deleted_at IS NULL
            ORDER BY c.company_name ASC, c.company_id ASC
            `,
            [targetUserId, manageableCompanyIds]
        );

        return jsonSuccess({
            success: true,
            message: "Company access updated successfully.",
            assignments: savedResult.rows,
        });
    } catch (error) {
        await rollback(client, transactionStarted);

        console.error("PUT COMPANY ACCESS ERROR:", error);

        if (error.code === "23503") {
            return jsonError(
                "A selected company, user, or role no longer exists.",
                400
            );
        }

        if (error.status) {
            return jsonError(error.message, error.status);
        }

        return jsonError(
            "Failed to update user access.",
            500
        );
    } finally {
        client?.release();
    }
}
