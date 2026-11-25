
import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import pool from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { hasPermission } from "@/lib/permissions";
import {
    archiveUserCompanyMembership,
} from "@/lib/user-company-recycle-bin";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function parseUserId(value) {
    const id = Number(value);
    return Number.isSafeInteger(id) && id > 0 ? id : null;
}

function parseCompanyId(value) {
    if (value === null || value === undefined || value === "") {
        return null;
    }

    const id = Number(value);
    return Number.isSafeInteger(id) && id > 0 ? id : null;
}

async function getCurrentCompany(userId, companyId = null) {
    const values = [userId];
    let companyCondition = "";

    if (companyId !== null) {
        values.push(companyId);
        companyCondition = "AND uc.company_id = $2";
    }

    const result = await pool.query(
        `
        SELECT
            uc.company_id,
            uc.role_id,
            r.role_name
        FROM user_companies uc
        INNER JOIN users u
            ON u.user_id = uc.user_id
        INNER JOIN companies c
            ON c.company_id = uc.company_id
        INNER JOIN roles r
            ON r.role_id = uc.role_id
        WHERE uc.user_id = $1
          AND uc.deleted_at IS NULL
          AND u.is_active = TRUE
          AND c.is_active = TRUE
          ${companyCondition}
        ORDER BY uc.assigned_at NULLS LAST, uc.company_id
        LIMIT 1
        `,
        values
    );

    return result.rows[0] || null;
}

async function canManageUsers(membership, action) {
    if (!membership) return false;

    return (
        String(membership.role_name).toUpperCase() === "ADMIN" ||
        await hasPermission(membership.role_id, "users", action)
    );
}

async function getParamsId(params) {
    const { id } = await params;
    return parseUserId(id);
}

function jsonError(message, status) {
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

function getRequestedCompanyId(request, body = null) {
    const url = new URL(request.url);
    const queryValue = url.searchParams.get("companyId");

    if (queryValue !== null) {
        return parseCompanyId(queryValue);
    }

    return parseCompanyId(body?.companyId);
}

async function resolveMembership(request, currentUser, companyId) {
    return getCurrentCompany(currentUser.userId, companyId);
}

// =====================================================
// PUT /api/users/:id
// =====================================================

export async function PUT(request, { params }) {
    let client;
    let transactionStarted = false;

    try {
        const currentUser = await getCurrentUser();

        if (!currentUser?.userId) {
            return jsonError("Unauthorized.", 401);
        }

        const userId = await getParamsId(params);

        if (!userId) {
            return jsonError("Invalid user ID.", 400);
        }

        let body;

        try {
            body = await request.json();
        } catch {
            return jsonError("Invalid request body.", 400);
        }

        const requestedCompanyId = getRequestedCompanyId(request, body);
        const urlCompanyId = new URL(request.url).searchParams.get("companyId");

        if (
            (urlCompanyId !== null && requestedCompanyId === null) ||
            (
                body.companyId !== undefined &&
                body.companyId !== null &&
                body.companyId !== "" &&
                parseCompanyId(body.companyId) === null
            )
        ) {
            return jsonError("Invalid company ID.", 400);
        }

        const membership = await resolveMembership(
            request,
            currentUser,
            requestedCompanyId
        );

        if (!membership) {
            return jsonError(
                requestedCompanyId
                    ? "You do not have an active membership in the selected company."
                    : "No active company is assigned to your account.",
                403
            );
        }

        if (!(await canManageUsers(membership, "update"))) {
            return jsonError(
                "You do not have permission to update users in this company.",
                403
            );
        }

        const companyId = Number(membership.company_id);

        const fullName =
            typeof body.fullName === "string"
                ? body.fullName.trim()
                : "";

        const username =
            typeof body.username === "string"
                ? body.username.trim()
                : "";

        const email =
            typeof body.email === "string"
                ? body.email.trim().toLowerCase()
                : "";

        const location =
            typeof body.location === "string"
                ? body.location.trim()
                : "";

        const roleId = parseUserId(body.roleId);
        const password = body.password;
        const isActive = body.isActive;

        if (!fullName || fullName.length > 150) {
            return jsonError(
                "Please enter a full name of no more than 150 characters.",
                400
            );
        }

        if (!/^[a-zA-Z0-9_.-]{3,100}$/.test(username)) {
            return jsonError(
                "Username must be 3–100 characters and contain only letters, numbers, underscores, dots, or hyphens.",
                400
            );
        }

        if (
            email &&
            (
                email.length > 254 ||
                !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
            )
        ) {
            return jsonError("Please enter a valid email address.", 400);
        }

        if (location.length > 255) {
            return jsonError(
                "Location must be no more than 255 characters.",
                400
            );
        }

        if (!roleId) {
            return jsonError("Please select a valid role.", 400);
        }

        if (typeof isActive !== "boolean") {
            return jsonError("Please specify the user's status.", 400);
        }

        if (
            password !== undefined &&
            password !== null &&
            password !== "" &&
            (typeof password !== "string" || password.length < 8)
        ) {
            return jsonError(
                "A new password must be at least 8 characters.",
                400
            );
        }

        const targetMembership = await pool.query(
            `
            SELECT
                uc.user_id,
                uc.role_id
            FROM user_companies uc
            INNER JOIN companies c
                ON c.company_id = uc.company_id
            WHERE uc.user_id = $1
              AND uc.company_id = $2
              AND uc.deleted_at IS NULL
              AND c.is_active = TRUE
            LIMIT 1
            `,
            [userId, companyId]
        );

        if (!targetMembership.rows.length) {
            return jsonError(
                "User does not have an active membership in the selected company.",
                404
            );
        }

        if (Number(currentUser.userId) === userId) {
            const ownMembership = targetMembership.rows[0];

            if (
                Number(ownMembership.role_id) !== roleId ||
                !isActive
            ) {
                return jsonError(
                    "You cannot change your own role or deactivate your own account.",
                    400
                );
            }
        }

        const roleResult = await pool.query(
            `
            SELECT role_id, role_name
            FROM roles
            WHERE role_id = $1
              AND (company_id IS NULL OR company_id = $2)
            LIMIT 1
            `,
            [roleId, companyId]
        );

        if (!roleResult.rows.length) {
            return jsonError(
                "Selected role is not available for this company.",
                400
            );
        }

        const selectedRoleName = String(
            roleResult.rows[0].role_name
        ).toUpperCase();

        if (
            String(membership.role_name).toUpperCase() !== "ADMIN" &&
            ["ADMIN", "SUB_ADMIN"].includes(selectedRoleName)
        ) {
            return jsonError(
                "Only an ADMIN can assign ADMIN or SUB_ADMIN roles.",
                403
            );
        }

        const duplicate = await pool.query(
            `
            SELECT user_id
            FROM users
            WHERE (
                LOWER(username) = LOWER($1)
                OR (
                    $2::text IS NOT NULL
                    AND LOWER(email) = LOWER($2)
                )
            )
              AND user_id <> $3
            LIMIT 1
            `,
            [username, email || null, userId]
        );

        if (duplicate.rows.length) {
            return jsonError(
                "Username or email already exists.",
                409
            );
        }

        client = await pool.connect();

        await client.query("BEGIN");
        transactionStarted = true;

        // Lock and re-check the selected active membership.
        const lockedMembership = await client.query(
            `
            SELECT user_id, company_id, role_id
            FROM user_companies
            WHERE user_id = $1
              AND company_id = $2
              AND deleted_at IS NULL
            FOR UPDATE
            `,
            [userId, companyId]
        );

        if (!lockedMembership.rows.length) {
            await client.query("ROLLBACK");
            transactionStarted = false;

            return jsonError(
                "This company membership is no longer active.",
                409
            );
        }

        let result;

        if (password) {
            const passwordHash = await bcrypt.hash(password, 12);

            result = await client.query(
                `
                UPDATE users
                SET
                    full_name = $1,
                    username = $2,
                    email = $3,
                    location = $4,
                    password_hash = $5,
                    is_active = $6,
                    updated_at = CURRENT_TIMESTAMP
                WHERE user_id = $7
                RETURNING
                    user_id,
                    full_name,
                    username,
                    email,
                    location,
                    is_active,
                    created_at
                `,
                [
                    fullName,
                    username,
                    email || null,
                    location || null,
                    passwordHash,
                    isActive,
                    userId,
                ]
            );
        } else {
            result = await client.query(
                `
                UPDATE users
                SET
                    full_name = $1,
                    username = $2,
                    email = $3,
                    location = $4,
                    is_active = $5,
                    updated_at = CURRENT_TIMESTAMP
                WHERE user_id = $6
                RETURNING
                    user_id,
                    full_name,
                    username,
                    email,
                    location,
                    is_active,
                    created_at
                `,
                [
                    fullName,
                    username,
                    email || null,
                    location || null,
                    isActive,
                    userId,
                ]
            );
        }

        if (!result.rows.length) {
            throw new Error("User account no longer exists.");
        }

        const membershipUpdate = await client.query(
            `
            UPDATE user_companies
            SET role_id = $1
            WHERE user_id = $2
              AND company_id = $3
              AND deleted_at IS NULL
            RETURNING user_id
            `,
            [roleId, userId, companyId]
        );

        if (!membershipUpdate.rows.length) {
            throw new Error(
                "The selected company membership is no longer active."
            );
        }

        // Keep legacy fields aligned when this is the user's primary company.
        await client.query(
            `
            UPDATE users
            SET role_id = $1
            WHERE user_id = $2
              AND company_id = $3
            `,
            [roleId, userId, companyId]
        );

        await client.query("COMMIT");
        transactionStarted = false;

        return NextResponse.json({
            success: true,
            message: "User updated successfully.",
            user: {
                ...result.rows[0],
                role_id: roleId,
                company_id: companyId,
            },
        });
    } catch (error) {
        if (client && transactionStarted) {
            await client.query("ROLLBACK").catch(() => {});
            transactionStarted = false;
        }

        console.error("UPDATE USER ERROR:", error);

        if (error.code === "23505") {
            return jsonError(
                "Username or email already exists.",
                409
            );
        }

        if (
            error.message === "User account no longer exists." ||
            error.message ===
                "The selected company membership is no longer active."
        ) {
            return jsonError(error.message, 409);
        }

        if (error.status) {
            return jsonError(error.message, error.status);
        }

        return jsonError("Failed to update user.", 500);
    } finally {
        client?.release();
    }
}

// =====================================================
// DELETE /api/users/:id?companyId=123
// Archives access to the selected company.
// Does not delete the global login account.
// =====================================================

export async function DELETE(request, { params }) {
    let client;
    let transactionStarted = false;

    try {
        const currentUser = await getCurrentUser();

        if (!currentUser?.userId) {
            return jsonError("Unauthorized.", 401);
        }

        const userId = await getParamsId(params);

        if (!userId) {
            return jsonError("Invalid user ID.", 400);
        }

        if (Number(currentUser.userId) === userId) {
            return jsonError(
                "You cannot remove your own company access.",
                400
            );
        }

        const url = new URL(request.url);
        const rawCompanyId = url.searchParams.get("companyId");
        const requestedCompanyId = parseCompanyId(rawCompanyId);

        if (rawCompanyId !== null && requestedCompanyId === null) {
            return jsonError("Invalid company ID.", 400);
        }

        const membership = await resolveMembership(
            request,
            currentUser,
            requestedCompanyId
        );

        if (!membership) {
            return jsonError(
                requestedCompanyId
                    ? "You do not have an active membership in the selected company."
                    : "No active company is assigned to your account.",
                403
            );
        }

        if (!(await canManageUsers(membership, "delete"))) {
            return jsonError(
                "You do not have permission to remove users from this company.",
                403
            );
        }

        const companyId = Number(membership.company_id);

        client = await pool.connect();

        await client.query("BEGIN");
        transactionStarted = true;

        const archiveId = await archiveUserCompanyMembership(client, {
    userId,
    companyId,
    deletedBy: Number(currentUser.userId),
    deletionReason:
        "Company access removed through User Management.",
});

        await client.query("COMMIT");
        transactionStarted = false;

        return NextResponse.json({
            success: true,
            message:
                "User access archived successfully. It can be restored from the Recycle Bin.",
            user: {
                user_id: userId,
                company_id: companyId,
            },
            recycleBinId: -Number(archiveId),
        });
    } catch (error) {
        if (client && transactionStarted) {
            await client.query("ROLLBACK").catch(() => {});
            transactionStarted = false;
        }

        console.error("DELETE USER ERROR:", error);

        if (error.status) {
            return jsonError(error.message, error.status);
        }

        if (error.code === "23503") {
            return jsonError(
                "This membership cannot be archived because it is referenced by another record.",
                409
            );
        }

        return jsonError(
            error.message || "Failed to archive user access.",
            500
        );
    } finally {
        client?.release();
    }
}
