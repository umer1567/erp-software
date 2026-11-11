
import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";

import pool from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { hasPermission } from "@/lib/permissions";

export const dynamic = "force-dynamic";

const noCacheHeaders = {
    "Cache-Control": "no-store, no-cache, must-revalidate",
};

function json(data, options = {}) {
    return NextResponse.json(data, {
        ...options,
        headers: {
            ...noCacheHeaders,
            ...(options.headers || {}),
        },
    });
}

// =========================================================
// AUTHENTICATION
// =========================================================

async function getAuthenticatedUser() {
    const user = await getCurrentUser();

    if (!user) {
        return {
            error: json(
                {
                    success: false,
                    message: "Unauthorized. Please log in again.",
                },
                { status: 401 }
            ),
        };
    }

    if (!user.userId || !user.companyId || !user.roleId) {
        return {
            error: json(
                {
                    success: false,
                    message:
                        "Your session is missing required account information. Please log in again.",
                },
                { status: 401 }
            ),
        };
    }

    return { user };
}

// =========================================================
// VERIFY SYSTEM ADMIN THROUGH THE DATABASE
// Only the protected global ADMIN role receives this bypass.
// =========================================================

async function isSystemAdmin(roleId) {
    const result = await pool.query(
        `
        SELECT role_id
        FROM roles
        WHERE role_id = $1
          AND role_name = 'ADMIN'
          AND is_system_role = TRUE
          AND company_id IS NULL
        LIMIT 1;
        `,
        [roleId]
    );

    return result.rows.length > 0;
}

// =========================================================
// GET ROLE PERMISSIONS
// ADMIN receives full permissions.
// Other roles use their assigned permissions.
// =========================================================

async function getRolePermissions(roleId, isAdmin = false) {
    if (isAdmin) {
        return {
            view: true,
            create: true,
            update: true,
            delete: true,
        };
    }

    const [view, create, update, remove] = await Promise.all([
        hasPermission(roleId, "roles", "view"),
        hasPermission(roleId, "roles", "create"),
        hasPermission(roleId, "roles", "update"),
        hasPermission(roleId, "roles", "delete"),
    ]);

    return {
        view: Boolean(view),
        create: Boolean(create),
        update: Boolean(update),
        delete: Boolean(remove),
    };
}

// =========================================================
// GET ROLES
// ADMIN: always allowed.
// Other roles: require roles:view.
// =========================================================

export async function GET() {
    try {
        const auth = await getAuthenticatedUser();

        if (auth.error) {
            return auth.error;
        }

        const { user } = auth;

        const isAdmin = await isSystemAdmin(user.roleId);

        const permissions = await getRolePermissions(
            user.roleId,
            isAdmin
        );

        if (!permissions.view) {
            return json(
                {
                    success: false,
                    accessDenied: true,
                    message: "You do not have permission to view roles.",
                    permissions,
                },
                { status: 403 }
            );
        }

        const result = await pool.query(
            `
            SELECT
                r.role_id,
                r.role_name,
                r.description,
                r.is_system_role,
                r.created_at,
                COUNT(DISTINCT uc.user_id)::INTEGER AS user_count
            FROM roles r
            LEFT JOIN user_companies uc
                ON uc.role_id = r.role_id
                AND uc.company_id = $1
            WHERE r.company_id IS NULL
               OR r.company_id = $1
            GROUP BY
                r.role_id,
                r.role_name,
                r.description,
                r.is_system_role,
                r.created_at
            ORDER BY r.role_id;
            `,
            [user.companyId]
        );

        return json({
            success: true,
            roles: result.rows,
            permissions,
            isAdmin,
        });
    } catch (error) {
        console.error("GET ROLES ERROR:", error);

        return json(
            {
                success: false,
                message: "Failed to load roles.",
            },
            { status: 500 }
        );
    }
}

// =========================================================
// CREATE ROLE
// ADMIN: allowed without roles:create permission.
// Other roles: require roles:create.
// Current account password is still required.
// =========================================================

export async function POST(request) {
    try {
        const auth = await getAuthenticatedUser();

        if (auth.error) {
            return auth.error;
        }

        const { user } = auth;

        const isAdmin = await isSystemAdmin(user.roleId);

        if (!isAdmin) {
            const allowed = await hasPermission(
                user.roleId,
                "roles",
                "create"
            );

            if (!allowed) {
                return json(
                    {
                        success: false,
                        accessDenied: true,
                        message: "You do not have permission to create roles.",
                    },
                    { status: 403 }
                );
            }
        }

        let body;

        try {
            body = await request.json();
        } catch {
            return json(
                {
                    success: false,
                    message: "Invalid request body.",
                },
                { status: 400 }
            );
        }

        const roleName =
            typeof body.roleName === "string"
                ? body.roleName.trim()
                : "";

        const description =
            typeof body.description === "string" &&
            body.description.trim()
                ? body.description.trim()
                : null;

        const authPassword = body.authPassword;

        if (!roleName) {
            return json(
                {
                    success: false,
                    message: "Role name is required.",
                },
                { status: 400 }
            );
        }

        if (roleName.length > 100) {
            return json(
                {
                    success: false,
                    message: "Role name cannot exceed 100 characters.",
                },
                { status: 400 }
            );
        }

        if (description && description.length > 1000) {
            return json(
                {
                    success: false,
                    message: "Description cannot exceed 1000 characters.",
                },
                { status: 400 }
            );
        }

        // Do not allow creating another protected system role.
        const normalizedRoleName = roleName.toUpperCase();

        if (["ADMIN", "SUB_ADMIN", "USER"].includes(normalizedRoleName)) {
            return json(
                {
                    success: false,
                    message:
                        "ADMIN, SUB_ADMIN, and USER are protected system roles. Choose another role name.",
                },
                { status: 400 }
            );
        }

        if (
            typeof authPassword !== "string" ||
            authPassword.length === 0
        ) {
            return json(
                {
                    success: false,
                    message: "Your current account password is required.",
                },
                { status: 400 }
            );
        }

        // Verify the current user's password for this company account.
        const passwordResult = await pool.query(
            `
            SELECT company_password_hash
            FROM user_companies
            WHERE user_id = $1
              AND company_id = $2
              AND role_id = $3
            LIMIT 1;
            `,
            [user.userId, user.companyId, user.roleId]
        );

        if (passwordResult.rows.length === 0) {
            return json(
                {
                    success: false,
                    message:
                        "Your company account could not be verified. Please log in again.",
                },
                { status: 401 }
            );
        }

        const passwordHash =
            passwordResult.rows[0].company_password_hash;

        if (
            typeof passwordHash !== "string" ||
            passwordHash.length === 0
        ) {
            return json(
                {
                    success: false,
                    message:
                        "No company password hash was found for your account.",
                },
                { status: 401 }
            );
        }

        const passwordMatches = await bcrypt.compare(
            authPassword,
            passwordHash
        );

        if (!passwordMatches) {
            return json(
                {
                    success: false,
                    message: "Incorrect account password.",
                },
                { status: 401 }
            );
        }

        const result = await pool.query(
            `
            INSERT INTO roles (
                role_name,
                description,
                is_system_role,
                company_id
            )
            VALUES ($1, $2, FALSE, $3)
            RETURNING
                role_id,
                role_name,
                description,
                is_system_role,
                company_id,
                created_at;
            `,
            [
                normalizedRoleName,
                description,
                user.companyId,
            ]
        );

        return json(
            {
                success: true,
                message: "Role created successfully.",
                role: result.rows[0],
            },
            { status: 201 }
        );
    } catch (error) {
        console.error("CREATE ROLE ERROR:", error);

        if (error.code === "23505") {
            return json(
                {
                    success: false,
                    message:
                        "A role with this name already exists. Try another name.",
                },
                { status: 409 }
            );
        }

        if (error.code === "42703") {
            return json(
                {
                    success: false,
                    message:
                        "A required database column was not found. Check the roles and user_companies table schemas.",
                },
                { status: 500 }
            );
        }

        return json(
            {
                success: false,
                message: "Failed to create role.",
            },
            { status: 500 }
        );
    }
}
