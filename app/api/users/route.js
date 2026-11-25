
import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import pool from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { hasPermission } from "@/lib/permissions";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// =====================================================
// PERMISSIONS
// =====================================================

async function canManageUsers(membership, action) {
    return hasPermission(
        membership.role_id,
        "users",
        action
    );
}

function jsonError(message, status = 400) {
    return NextResponse.json(
        {
            success: false,
            message,
        },
        {
            status,
            headers: {
                "Cache-Control": "no-store",
            },
        }
    );
}

// =====================================================
// GET /api/users
// Returns active user-company memberships only.
// =====================================================

export async function GET() {
    try {
        const currentUser = await getCurrentUser();

        if (!currentUser?.userId) {
            return jsonError("Unauthorized.", 401);
        }

        const membershipsResult = await pool.query(
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
            ORDER BY
                uc.assigned_at NULLS LAST,
                uc.company_id
            `,
            [currentUser.userId]
        );

        const allowedCompanyIds = [];

        for (const membership of membershipsResult.rows) {
            if (await canManageUsers(membership, "view")) {
                allowedCompanyIds.push(
                    Number(membership.company_id)
                );
            }
        }

        if (allowedCompanyIds.length === 0) {
            return jsonError(
                "You do not have permission to view users in your companies.",
                403
            );
        }

        const result = await pool.query(
            `
            SELECT
                u.user_id,
                u.full_name,
                u.username,
                u.email,
                u.location AS user_location,
                u.is_active,
                u.last_login,
                u.created_at,

                uc.role_id,
                r.role_name,

                c.company_id,
                c.company_name,

                COALESCE(
                    NULLIF(BTRIM(c.logo_url), ''),
                    NULLIF(BTRIM(c.logo_path), '')
                ) AS company_logo_url,

                COALESCE(
                    NULLIF(BTRIM(c.location), ''),
                    NULLIF(BTRIM(c.city), ''),
                    NULLIF(BTRIM(c.address), '')
                ) AS company_city

            FROM user_companies uc

            INNER JOIN users u
                ON u.user_id = uc.user_id

            INNER JOIN companies c
                ON c.company_id = uc.company_id

            INNER JOIN roles r
                ON r.role_id = uc.role_id

            WHERE uc.company_id = ANY($1::int[])
              AND uc.deleted_at IS NULL
              AND c.is_active = TRUE

            ORDER BY
                u.user_id DESC,
                c.company_name ASC,
                c.company_id ASC
            `,
            [allowedCompanyIds]
        );

        return NextResponse.json(
            {
                success: true,
                companyId: null,
                companyIds: allowedCompanyIds,
                users: result.rows,
            },
            {
                status: 200,
                headers: {
                    "Cache-Control": "no-store",
                },
            }
        );
    } catch (error) {
        console.error("GET USERS ERROR:", error);

        return jsonError("Failed to load users.", 500);
    }
}

// =====================================================
// POST /api/users
// Creates a new global user and assigns the selected
// first active company membership.
// =====================================================

export async function POST(request) {
    let client;
    let transactionStarted = false;

    try {
        const currentUser = await getCurrentUser();

        if (!currentUser?.userId) {
            return jsonError("Unauthorized.", 401);
        }

        client = await pool.connect();

        await client.query("BEGIN");
        transactionStarted = true;

        const membershipResult = await client.query(
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
            ORDER BY
                uc.assigned_at NULLS LAST,
                uc.company_id
            LIMIT 1
            `,
            [currentUser.userId]
        );

        const membership = membershipResult.rows[0];

        if (!membership) {
            await client.query("ROLLBACK");
            transactionStarted = false;

            return jsonError(
                "No active company is assigned to your account.",
                400
            );
        }

        if (!(await canManageUsers(membership, "create"))) {
            await client.query("ROLLBACK");
            transactionStarted = false;

            return jsonError(
                "You do not have permission to create users.",
                403
            );
        }

        const companyId = Number(membership.company_id);

        let body;

        try {
            body = await request.json();
        } catch {
            await client.query("ROLLBACK");
            transactionStarted = false;

            return jsonError("Invalid request body.", 400);
        }

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

        const password = body.password;
        const roleId = Number(body.roleId);

        if (
            !fullName ||
            fullName.length > 150 ||
            !/^[a-zA-Z0-9_.-]{3,100}$/.test(username) ||
            !email ||
            email.length > 254 ||
            !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
            location.length > 255 ||
            typeof password !== "string" ||
            password.length < 8 ||
            !Number.isSafeInteger(roleId) ||
            roleId <= 0
        ) {
            await client.query("ROLLBACK");
            transactionStarted = false;

            return jsonError(
                "Enter a valid name, username, email, location, password of at least 8 characters, and role.",
                400
            );
        }

        const duplicate = await client.query(
            `
            SELECT user_id
            FROM users
            WHERE LOWER(username) = LOWER($1)
               OR (
                    $2::text IS NOT NULL
                    AND LOWER(email) = LOWER($2)
               )
            LIMIT 1
            `,
            [username, email]
        );

        if (duplicate.rows.length) {
            await client.query("ROLLBACK");
            transactionStarted = false;

            return jsonError(
                "Username or email already exists. Use company access to assign an existing user.",
                409
            );
        }

        const roleResult = await client.query(
            `
            SELECT role_id, role_name
            FROM roles
            WHERE role_id = $1
              AND (
                  company_id IS NULL
                  OR company_id = $2
              )
            LIMIT 1
            `,
            [roleId, companyId]
        );

        if (!roleResult.rows.length) {
            await client.query("ROLLBACK");
            transactionStarted = false;

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
            await client.query("ROLLBACK");
            transactionStarted = false;

            return jsonError(
                "Only an ADMIN can create ADMIN or SUB_ADMIN accounts.",
                403
            );
        }

        const passwordHash = await bcrypt.hash(password, 12);

        const userResult = await client.query(
            `
            INSERT INTO users (
                full_name,
                username,
                email,
                location,
                password_hash,
                role_id,
                company_id,
                is_active,
                created_at,
                updated_at
            )
            VALUES (
                $1, $2, $3, $4, $5, $6, $7,
                TRUE, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
            )
            RETURNING
                user_id,
                full_name,
                username,
                email,
                location,
                role_id,
                company_id,
                is_active,
                created_at
            `,
            [
                fullName,
                username,
                email,
                location || null,
                passwordHash,
                roleId,
                companyId,
            ]
        );

        const user = userResult.rows[0];

        const membershipInsert = await client.query(
            `
            INSERT INTO user_companies (
                user_id,
                company_id,
                role_id
            )
            VALUES ($1, $2, $3)
            ON CONFLICT (user_id, company_id)
            DO UPDATE SET
                role_id = EXCLUDED.role_id
            WHERE user_companies.deleted_at IS NULL
            RETURNING user_id, company_id, role_id
            `,
            [user.user_id, companyId, roleId]
        );

        if (!membershipInsert.rows.length) {
            throw new Error(
                "The company membership already exists in an archived state."
            );
        }

        await client.query("COMMIT");
        transactionStarted = false;

        return NextResponse.json(
            {
                success: true,
                message: "User created successfully.",
                user,
            },
            { status: 201 }
        );
    } catch (error) {
        if (client && transactionStarted) {
            await client.query("ROLLBACK").catch(() => {});
            transactionStarted = false;
        }

        console.error("CREATE USER ERROR:", error);

        if (error.code === "23505") {
            return jsonError(
                "Username or email already exists.",
                409
            );
        }

        if (
            error.message ===
            "The company membership already exists in an archived state."
        ) {
            return jsonError(error.message, 409);
        }

        if (error.status) {
            return jsonError(error.message, error.status);
        }

        return jsonError("Failed to create user.", 500);
    } finally {
        client?.release();
    }
}
