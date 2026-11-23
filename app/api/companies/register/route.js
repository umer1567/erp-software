
import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import pool, { CENTRAL_DATABASE_NAME, provisionCompanyDatabase } from "@/lib/db";
import {
    companyDatabaseName,
    companyDatabaseNameError,
} from "@/lib/tenant-tables";
import { getCurrentUser } from "@/lib/auth";
import { hasPermission } from "@/lib/permissions";

import {
    mkdir,
    writeFile,
    unlink,
} from "node:fs/promises";

import path from "node:path";
import { randomUUID } from "node:crypto";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// --------------------------------------------------
// COMMON HELPERS
// --------------------------------------------------

function jsonError(message, status = 400, error = null) {
    const response = {
        success: false,
        message,
    };

    if (process.env.NODE_ENV === "development" && error) {
        response.error = error.message || String(error);
        response.code = error.code || null;
        response.detail = error.detail || null;
        response.constraint = error.constraint || null;
        response.stack = error.stack || null;
    }

    return NextResponse.json(response, { status });
}

function getFormString(formData, key, fallback = "") {
    const value = formData.get(key);

    return typeof value === "string"
        ? value.trim()
        : fallback;
}

function validEmail(value) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function parsePositiveId(value) {
    const id = Number(value);

    return Number.isSafeInteger(id) && id > 0
        ? id
        : null;
}

// --------------------------------------------------
// COMPANY LOGO UPLOAD
// --------------------------------------------------

async function saveCompanyLogo(file) {
    if (
        !file ||
        typeof file.arrayBuffer !== "function" ||
        file.size === 0
    ) {
        return null;
    }

    const allowedTypes = {
        "image/png": ".png",
        "image/jpeg": ".jpg",
        "image/webp": ".webp",
    };

    if (!allowedTypes[file.type]) {
        const error = new Error(
            "Choose a PNG, JPG, or WebP company logo."
        );

        error.status = 400;
        throw error;
    }

    if (file.size > 2 * 1024 * 1024) {
        const error = new Error(
            "Company logo must be 2 MB or smaller."
        );

        error.status = 400;
        throw error;
    }

    const uploadDirectory = path.join(
        process.cwd(),
        "public",
        "uploads",
        "companies"
    );

    await mkdir(uploadDirectory, {
        recursive: true,
    });

    const fileName = `${randomUUID()}${allowedTypes[file.type]}`;

    const filePath = path.join(
        uploadDirectory,
        fileName
    );

    try {
        await writeFile(
            filePath,
            Buffer.from(await file.arrayBuffer()),
            { flag: "wx" }
        );

        return {
            url: `/uploads/companies/${fileName}`,
            filePath,
        };
    } catch (error) {
        await unlink(filePath).catch(() => {});
        throw error;
    }
}

// --------------------------------------------------
// CREATOR PERMISSION CHECK
// --------------------------------------------------

/**
 * Registration is permitted only when at least one active
 * company membership has BOTH register_company:view
 * and register_company:create permissions.
 *
 * ADMIN status does not bypass the permission matrix.
 */

async function getCreatorAccess(userId) {
    const result = await pool.query(
        `
        SELECT
            uc.company_id,
            uc.role_id,
            r.role_name
        FROM user_companies uc
        INNER JOIN companies c
            ON c.company_id = uc.company_id
        INNER JOIN roles r
            ON r.role_id = uc.role_id
        WHERE uc.user_id = $1
          AND c.is_active = TRUE
        ORDER BY uc.company_id;
        `,
        [userId]
    );

    const memberships = result.rows;

    if (!memberships.length) {
        return {
            memberships: [],
            allowed: false,
            isAdmin: false,
            creatorRoleName: null,
        };
    }

    const permittedMemberships = [];

    for (const membership of memberships) {
        const [canView, canCreate] = await Promise.all([
            hasPermission(
                membership.role_id,
                "register_company",
                "view"
            ),
            hasPermission(
                membership.role_id,
                "register_company",
                "create"
            ),
        ]);

        if (canView && canCreate) {
            permittedMemberships.push(membership);
        }
    }

    if (!permittedMemberships.length) {
        return {
            memberships,
            allowed: false,
            isAdmin: false,
            creatorRoleName: null,
        };
    }

    const allowedMembership =
        permittedMemberships.find(
            (membership) =>
                String(membership.role_name).toUpperCase() === "ADMIN"
        ) || permittedMemberships[0];

    return {
        memberships,
        allowed: true,
        isAdmin:
            String(allowedMembership.role_name).toUpperCase() === "ADMIN",
        creatorRoleName: allowedMembership.role_name,
    };
}

// --------------------------------------------------
// GLOBAL SYSTEM ROLES
// --------------------------------------------------

async function getGlobalSystemRoles() {
    const result = await pool.query(
        `
        SELECT
            role_id,
            role_name
        FROM roles
        WHERE is_system_role = TRUE
          AND company_id IS NULL
        ORDER BY
            CASE UPPER(role_name)
                WHEN 'USER' THEN 1
                WHEN 'SUB_ADMIN' THEN 2
                WHEN 'ADMIN' THEN 3
                ELSE 4
            END,
            role_name;
        `
    );

    return result.rows;
}

// --------------------------------------------------
// MEMBERSHIP HELPER
// --------------------------------------------------

/**
 * Create or update a company membership.
 *
 * company_password_hash is copied from the existing
 * central users.password_hash.
 *
 * This is required by the current company login route.
 */

async function createCompanyMembership({
    client,
    userId,
    companyId,
    roleId,
}) {
    const result = await client.query(
        `
        INSERT INTO user_companies (
            user_id,
            company_id,
            role_id,
            company_password_hash
        )
        SELECT
            user_id,
            $2,
            $3,
            password_hash
        FROM users
        WHERE user_id = $1
          AND password_hash IS NOT NULL
        ON CONFLICT (user_id, company_id)
        DO UPDATE SET
            role_id = EXCLUDED.role_id,
            company_password_hash = EXCLUDED.company_password_hash
        RETURNING
            user_id,
            company_id,
            role_id;
        `,
        [
            userId,
            companyId,
            roleId,
        ]
    );

    if (!result.rows.length) {
        throw new Error(
            `Could not create company membership for user ${userId}. The user's password hash may be missing.`
        );
    }

    return result.rows[0];
}

/**
 * Create or update a membership for a newly created administrator.
 *
 * The already-generated password hash is supplied directly.
 */

async function createNewAdminMembership({
    client,
    userId,
    companyId,
    roleId,
    passwordHash,
}) {
    const result = await client.query(
        `
        INSERT INTO user_companies (
            user_id,
            company_id,
            role_id,
            company_password_hash
        )
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (user_id, company_id)
        DO UPDATE SET
            role_id = EXCLUDED.role_id,
            company_password_hash = EXCLUDED.company_password_hash
        RETURNING
            user_id,
            company_id,
            role_id;
        `,
        [
            userId,
            companyId,
            roleId,
            passwordHash,
        ]
    );

    if (!result.rows.length) {
        throw new Error(
            "Could not create the new administrator's company membership."
        );
    }

    return result.rows[0];
}

// --------------------------------------------------
// SUPER ADMIN NOTIFICATION
// --------------------------------------------------

async function notifySuperAdminCompanyRegistration({
    company,
    requesterUserId,
}) {
    const baseUrl = process.env.SUPER_ADMIN_API_URL?.trim();

    const clientId = parsePositiveId(
        process.env.LICENSE_CLIENT_ID
    );

    const secret = process.env.CLIENT_DATA_API_SECRET;

    if (!baseUrl || !clientId || !secret) {
        console.error(
            "Super Admin notification is not configured. Check SUPER_ADMIN_API_URL, LICENSE_CLIENT_ID, and CLIENT_DATA_API_SECRET."
        );

        return {
            sent: false,
            message: "Super Admin notification is not configured.",
        };
    }

    let endpoint;

    try {
        endpoint = new URL(
            "/api/support-requests",
            `${baseUrl.replace(/\/+$/, "")}/`
        );
    } catch {
        return {
            sent: false,
            message: "The Super Admin API URL is invalid.",
        };
    }

    if (
        endpoint.protocol !== "http:" &&
        endpoint.protocol !== "https:"
    ) {
        return {
            sent: false,
            message: "The Super Admin API URL must use HTTP or HTTPS.",
        };
    }

    if (
        process.env.NODE_ENV === "production" &&
        endpoint.protocol !== "https:"
    ) {
        return {
            sent: false,
            message: "HTTPS is required for production integration.",
        };
    }

    try {
        const requesterResult = await pool.query(
            `
            SELECT
                full_name,
                email
            FROM users
            WHERE user_id = $1
            LIMIT 1;
            `,
            [requesterUserId]
        );

        const requester = requesterResult.rows[0] || {};

        const response = await fetch(endpoint, {
            method: "POST",

            headers: {
                "Content-Type": "application/json",
                "x-client-data-secret": secret,
            },

            body: JSON.stringify({
                clientId,
                companyId: company.company_id,
                companyName: company.company_name,
                requesterUserId,
                requesterName: requester.full_name || "",
                requesterEmail: requester.email || "",
            }),

            signal: AbortSignal.timeout(5000),
            cache: "no-store",
        });

        const result = await response.json().catch(() => ({}));

        if (!response.ok || result.success !== true) {
            console.error("Super Admin notification rejected:", {
                status: response.status,
                message: result.message || "Unknown integration error",
            });

            return {
                sent: false,
                message:
                    result.message ||
                    "Super Admin did not accept the registration notification.",
            };
        }

        return {
            sent: true,
            duplicate: Boolean(result.duplicate),
            message:
                result.message || "Registration notification sent.",
        };
    } catch (error) {
        console.error("Super Admin notification error:", {
            message: error.message,
        });

        return {
            sent: false,
            message:
                "The company was created, but Super Admin could not be reached.",
        };
    }
}

// --------------------------------------------------
// GET: REGISTRATION OPTIONS
// --------------------------------------------------

export async function GET() {
    try {
        const currentUser = await getCurrentUser();

        if (!currentUser?.userId) {
            return NextResponse.json(
                {
                    success: false,
                    users: [],
                    roles: [],
                    requiresLogin: true,
                    message: "Please log in to register a company.",
                },
                { status: 401 }
            );
        }

        const userId = parsePositiveId(currentUser.userId);

        if (!userId) {
            return jsonError(
                "Invalid logged-in user.",
                401
            );
        }

        const access = await getCreatorAccess(userId);

        if (!access.allowed) {
            return NextResponse.json(
                {
                    success: false,
                    users: [],
                    roles: [],
                    requiresLogin: false,
                    accessDenied: true,
                    message:
                        "Your role does not have View and Create permissions for Company Management. Ask your administrator to enable both permissions in the user-rights matrix.",
                },
                { status: 403 }
            );
        }

        const companyIds = [
            ...new Set(
                access.memberships.map(
                    (membership) => Number(membership.company_id)
                )
            ),
        ];

        const usersResult = companyIds.length
            ? await pool.query(
                `
                SELECT DISTINCT
                    u.user_id,
                    u.full_name,
                    u.username,
                    u.email
                FROM users u
                INNER JOIN user_companies uc
                    ON uc.user_id = u.user_id
                WHERE uc.company_id = ANY($1::int[])
                  AND u.is_active = TRUE
                ORDER BY
                    u.full_name,
                    u.username;
                `,
                [companyIds]
            )
            : { rows: [] };

        const allRoles = await getGlobalSystemRoles();

        // Only a qualifying ADMIN membership may offer elevated roles.
        const roles = access.isAdmin
            ? allRoles
            : allRoles.filter(
                (role) =>
                    String(role.role_name || "").toUpperCase() === "USER"
            );

        return NextResponse.json({
            success: true,
            users: usersResult.rows,
            roles,
            requiresLogin: false,
        });
    } catch (error) {
        console.error("COMPANY REGISTRATION OPTIONS ERROR:", {
            message: error?.message,
            code: error?.code,
        });

        return jsonError(
            "Unable to load company registration options.",
            500,
            error
        );
    }
}

// --------------------------------------------------
// POST: REGISTER COMPANY
// --------------------------------------------------

export async function POST(request) {
    let currentUser;

    // --------------------------------------------------
    // AUTHENTICATION
    // --------------------------------------------------

    try {
        currentUser = await getCurrentUser();
    } catch (error) {
        console.error("COMPANY AUTHENTICATION ERROR:", error);

        return jsonError(
            "Unable to verify your login session.",
            500,
            error
        );
    }

    if (!currentUser?.userId) {
        return jsonError(
            "Please log in to register a company.",
            401
        );
    }

    const userId = parsePositiveId(currentUser.userId);

    if (!userId) {
        return jsonError(
            "Invalid logged-in user.",
            401
        );
    }

    // --------------------------------------------------
    // PERMISSION CHECK
    // --------------------------------------------------

    let access;

    try {
        access = await getCreatorAccess(userId);
    } catch (error) {
        console.error("COMPANY ACCESS CHECK ERROR:", {
            message: error?.message,
            code: error?.code,
        });

        return jsonError(
            "Unable to verify your company permissions.",
            500,
            error
        );
    }

    if (!access.allowed) {
        return jsonError(
            "Your role does not have View and Create permissions for Company Management. Ask your administrator to enable both permissions in the user-rights matrix.",
            403
        );
    }

    // --------------------------------------------------
    // FORM DATA
    // --------------------------------------------------

    let formData;

    try {
        formData = await request.formData();
    } catch (error) {
        console.error("COMPANY FORM DATA ERROR:", error);

        return jsonError(
            "Unable to read company registration form data.",
            400,
            error
        );
    }

    const companyName = getFormString(
        formData,
        "companyName"
    );

    const phone = getFormString(
        formData,
        "phone"
    );

    const companyEmail = getFormString(
        formData,
        "companyEmail"
    ).toLowerCase();

    const address = getFormString(
        formData,
        "address"
    );

    const city = getFormString(
        formData,
        "city"
    );

    const province = getFormString(
        formData,
        "province"
    );

    const country = getFormString(
        formData,
        "country",
        "Pakistan"
    );

    const postalCode = getFormString(
        formData,
        "postalCode"
    );

    const currency = getFormString(
        formData,
        "currency",
        "PKR"
    ).toUpperCase();

    const assignmentMode = getFormString(
        formData,
        "assignmentMode",
        "newAdmin"
    );

    const logoFile = formData.get("companyLogo");

    const location = [
        city,
        province,
        country,
        postalCode,
    ]
        .filter(Boolean)
        .join(", ");

    // --------------------------------------------------
    // COMPANY VALIDATION
    // --------------------------------------------------

    if (!companyName) {
        return jsonError(
            "Company name is required."
        );
    }

    if (companyName.length > 150) {
        return jsonError(
            "Company name cannot exceed 150 characters."
        );
    }

    // The company's database is named after it (erp_<name>).
    const companyNameError = companyDatabaseNameError(
        companyName,
        CENTRAL_DATABASE_NAME
    );

    if (companyNameError) {
        return jsonError(companyNameError);
    }

    if (
        phone.length > 50 ||
        address.length > 500 ||
        city.length > 100 ||
        province.length > 100 ||
        country.length > 100 ||
        postalCode.length > 30
    ) {
        return jsonError(
            "One or more company details exceed the allowed length."
        );
    }

    if (companyEmail && !validEmail(companyEmail)) {
        return jsonError(
            "Enter a valid company email address."
        );
    }

    if (!/^[A-Z]{3}$/.test(currency)) {
        return jsonError(
            "Currency must be a three-letter code, such as PKR or USD."
        );
    }

    if (!["newAdmin", "existingUser"].includes(assignmentMode)) {
        return jsonError(
            "Select a valid company access option."
        );
    }

    // --------------------------------------------------
    // ADMIN / EXISTING USER FORM VALUES
    // --------------------------------------------------

    let fullName = "";
    let username = "";
    let adminEmail = "";
    let password = "";
    let confirmPassword = "";

    let existingUserId = null;
    let existingRoleId = null;

    if (assignmentMode === "newAdmin") {
        fullName = getFormString(
            formData,
            "fullName"
        );

        username = getFormString(
            formData,
            "username"
        );

        adminEmail = getFormString(
            formData,
            "adminEmail"
        ).toLowerCase();

        const passwordValue = formData.get("password");

        const confirmPasswordValue = formData.get(
            "confirmPassword"
        );

        password =
            typeof passwordValue === "string"
                ? passwordValue
                : "";

        confirmPassword =
            typeof confirmPasswordValue === "string"
                ? confirmPasswordValue
                : "";

        if (
            !fullName ||
            !username ||
            !adminEmail ||
            !password ||
            !confirmPassword
        ) {
            return jsonError(
                "Complete all required administrator fields."
            );
        }

        if (
            fullName.length > 150 ||
            username.length > 100
        ) {
            return jsonError(
                "Administrator name or username exceeds the allowed length."
            );
        }

        if (!/^[a-zA-Z0-9_.-]{3,100}$/.test(username)) {
            return jsonError(
                "Username must be 3–100 characters and contain only letters, numbers, dots, underscores, or hyphens."
            );
        }

        if (!validEmail(adminEmail)) {
            return jsonError(
                "Enter a valid administrator email."
            );
        }

        if (password.length < 8) {
            return jsonError(
                "Password must be at least 8 characters long."
            );
        }

        if (password !== confirmPassword) {
            return jsonError(
                "Passwords do not match."
            );
        }
    } else {
        existingUserId = parsePositiveId(
            getFormString(formData, "existingUserId")
        );

        existingRoleId = parsePositiveId(
            getFormString(formData, "existingRoleId")
        );

        if (!existingUserId || !existingRoleId) {
            return jsonError(
                "Select an existing user and a valid role."
            );
        }
    }

    // --------------------------------------------------
    // TRANSACTION VARIABLES
    // --------------------------------------------------

    let client = null;
    let transactionStarted = false;
    let savedLogo = null;

    try {
        client = await pool.connect();

        await client.query("BEGIN");

        transactionStarted = true;

        // --------------------------------------------------
        // GET CREATOR ROLE
        // --------------------------------------------------

        const creatorRoleResult = await client.query(
            `
            SELECT role_id
            FROM roles
            WHERE company_id IS NULL
              AND is_system_role = TRUE
              AND UPPER(role_name) = UPPER($1)
            LIMIT 1;
            `,
            [access.creatorRoleName]
        );

        let creatorRoleId =
            creatorRoleResult.rows[0]?.role_id;

        if (!creatorRoleId) {
            const userRoleResult = await client.query(
                `
                SELECT role_id
                FROM roles
                WHERE company_id IS NULL
                  AND is_system_role = TRUE
                  AND UPPER(role_name) = 'USER'
                LIMIT 1;
                `
            );

            if (!userRoleResult.rows.length) {
                throw new Error(
                    "The global USER system role was not found."
                );
            }

            creatorRoleId =
                userRoleResult.rows[0].role_id;
        }

        // --------------------------------------------------
        // VALIDATE NEW ADMIN OR EXISTING USER
        // --------------------------------------------------

        let adminRoleId = null;

        if (assignmentMode === "newAdmin") {
            const duplicate = await client.query(
                `
                SELECT user_id
                FROM users
                WHERE LOWER(username) = LOWER($1)
                   OR LOWER(email) = LOWER($2)
                LIMIT 1;
                `,
                [
                    username,
                    adminEmail,
                ]
            );

            if (duplicate.rows.length) {
                await client.query("ROLLBACK");

                transactionStarted = false;

                return jsonError(
                    "That username or administrator email is already registered. Use different login details.",
                    409
                );
            }

            const adminRoleResult = await client.query(
                `
                SELECT role_id
                FROM roles
                WHERE UPPER(role_name) = 'ADMIN'
                  AND is_system_role = TRUE
                  AND company_id IS NULL
                LIMIT 1;
                `
            );

            if (!adminRoleResult.rows.length) {
                throw new Error(
                    "The global ADMIN system role was not found."
                );
            }

            adminRoleId =
                adminRoleResult.rows[0].role_id;
        } else {
            const selectedUserResult = await client.query(
                `
                SELECT
                    user_id,
                    is_active,
                    password_hash
                FROM users
                WHERE user_id = $1
                FOR UPDATE;
                `,
                [existingUserId]
            );

            if (!selectedUserResult.rows.length) {
                await client.query("ROLLBACK");

                transactionStarted = false;

                return jsonError(
                    "The selected user does not exist.",
                    404
                );
            }

            const selectedUser =
                selectedUserResult.rows[0];

            if (!selectedUser.is_active) {
                await client.query("ROLLBACK");

                transactionStarted = false;

                return jsonError(
                    "You cannot assign an inactive user."
                );
            }

            if (!selectedUser.password_hash) {
                await client.query("ROLLBACK");

                transactionStarted = false;

                return jsonError(
                    "The selected user does not have a valid login password. Update the user's login credentials first."
                );
            }

            const sharedCompany = await client.query(
                `
                SELECT 1
                FROM user_companies target_membership
                INNER JOIN user_companies creator_membership
                    ON creator_membership.company_id =
                       target_membership.company_id
                INNER JOIN companies c
                    ON c.company_id = creator_membership.company_id
                WHERE target_membership.user_id = $1
                  AND creator_membership.user_id = $2
                  AND c.is_active = TRUE
                LIMIT 1;
                `,
                [
                    existingUserId,
                    userId,
                ]
            );

            if (!sharedCompany.rows.length) {
                await client.query("ROLLBACK");

                transactionStarted = false;

                return jsonError(
                    "You can assign only users who share at least one of your existing companies.",
                    403
                );
            }

            const selectedRoleResult = await client.query(
                `
                SELECT
                    role_id,
                    role_name
                FROM roles
                WHERE role_id = $1
                  AND company_id IS NULL
                  AND is_system_role = TRUE
                LIMIT 1;
                `,
                [existingRoleId]
            );

            if (!selectedRoleResult.rows.length) {
                await client.query("ROLLBACK");

                transactionStarted = false;

                return jsonError(
                    "The selected role is not an assignable global system role."
                );
            }

            const selectedRoleName = String(
                selectedRoleResult.rows[0].role_name
            ).toUpperCase();

            if (
                !access.isAdmin &&
                selectedRoleName !== "USER"
            ) {
                await client.query("ROLLBACK");

                transactionStarted = false;

                return jsonError(
                    "Only a user with an authorized ADMIN membership can assign ADMIN or SUB_ADMIN roles.",
                    403
                );
            }

            existingRoleId =
                selectedRoleResult.rows[0].role_id;
        }

        // --------------------------------------------------
        // SAVE COMPANY LOGO
        // --------------------------------------------------

        savedLogo = await saveCompanyLogo(logoFile);

        // --------------------------------------------------
        // CREATE COMPANY IN CENTRAL DATABASE
        // --------------------------------------------------

        const companyResult = await client.query(
            `
            INSERT INTO companies (
                company_name,
                phone,
                email,
                address,
                location,
                logo_url,
                currency,
                is_active,
                created_at,
                updated_at
            )
            VALUES (
                $1, $2, $3, $4, $5, $6, $7,
                TRUE, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
            )
            RETURNING
                company_id,
                company_name,
                phone,
                email,
                address,
                location,
                logo_url,
                currency;
            `,
            [
                companyName,
                phone || null,
                companyEmail || null,
                address || null,
                location || null,
                savedLogo?.url || null,
                currency,
            ]
        );

        const company = companyResult.rows[0];

        // --------------------------------------------------
        // DETERMINE CREATOR MEMBERSHIP ROLE
        // --------------------------------------------------

        const creatorMembershipRoleId =
            assignmentMode === "existingUser" &&
            existingUserId === userId
                ? existingRoleId
                : creatorRoleId;

        // --------------------------------------------------
        // CREATE / ASSIGN COMPANY USERS
        // --------------------------------------------------

        let assignedUser = null;

        if (assignmentMode === "newAdmin") {
            // ----------------------------------------------
            // HASH NEW ADMIN PASSWORD
            // ----------------------------------------------

            const passwordHash = await bcrypt.hash(
                password,
                12
            );

            // ----------------------------------------------
            // CREATE NEW CENTRAL USER
            // ----------------------------------------------

            const adminResult = await client.query(
                `
                INSERT INTO users (
                    full_name,
                    username,
                    email,
                    password_hash,
                    role_id,
                    company_id,
                    is_active,
                    created_at,
                    updated_at
                )
                VALUES (
                    $1, $2, $3, $4, $5, $6,
                    TRUE, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
                )
                RETURNING
                    user_id,
                    full_name,
                    username,
                    email,
                    company_id,
                    role_id;
                `,
                [
                    fullName,
                    username,
                    adminEmail,
                    passwordHash,
                    adminRoleId,
                    company.company_id,
                ]
            );

            assignedUser = adminResult.rows[0];

            // ----------------------------------------------
            // CREATE CREATOR MEMBERSHIP
            // ----------------------------------------------

            await createCompanyMembership({
                client,
                userId,
                companyId: company.company_id,
                roleId: creatorMembershipRoleId,
            });

            // ----------------------------------------------
            // CREATE NEW ADMIN MEMBERSHIP
            // ----------------------------------------------

            await createNewAdminMembership({
                client,
                userId: assignedUser.user_id,
                companyId: company.company_id,
                roleId: adminRoleId,
                passwordHash,
            });
        } else {
            // ----------------------------------------------
            // EXISTING USER ASSIGNMENT
            // ----------------------------------------------

            if (existingUserId === userId) {
                // The creator is also the selected user.
                // Create only one membership.

                await createCompanyMembership({
                    client,
                    userId,
                    companyId: company.company_id,
                    roleId: existingRoleId,
                });
            } else {
                // ------------------------------------------
                // CREATOR MEMBERSHIP
                // ------------------------------------------

                await createCompanyMembership({
                    client,
                    userId,
                    companyId: company.company_id,
                    roleId: creatorRoleId,
                });

                // ------------------------------------------
                // SELECTED USER MEMBERSHIP
                // ------------------------------------------

                await createCompanyMembership({
                    client,
                    userId: existingUserId,
                    companyId: company.company_id,
                    roleId: existingRoleId,
                });
            }

            // ----------------------------------------------
            // GET ASSIGNED USER DETAILS
            // ----------------------------------------------

            const assignedResult = await client.query(
                `
                SELECT
                    user_id,
                    full_name,
                    username,
                    email
                FROM users
                WHERE user_id = $1
                LIMIT 1;
                `,
                [existingUserId]
            );

            assignedUser =
                assignedResult.rows[0] || null;

            if (!assignedUser) {
                throw new Error(
                    "The assigned company user could not be found."
                );
            }
        }

        // --------------------------------------------------
        // COMMIT CENTRAL DATABASE TRANSACTION
        // --------------------------------------------------

        await client.query("COMMIT");

        transactionStarted = false;

        console.info(
            "[COMPANY REGISTRATION] Central company created:",
            {
                companyId: company.company_id,
                companyName: company.company_name,
            }
        );

        // --------------------------------------------------
        // AUTOMATICALLY CREATE SEPARATE COMPANY DATABASE
        // --------------------------------------------------

        let companyDatabase;

        try {
            console.info(
                "[COMPANY REGISTRATION] Starting database provisioning:",
                {
                    companyId: company.company_id,
                }
            );

            companyDatabase = await provisionCompanyDatabase(
                company.company_id
            );

            console.info(
                "[COMPANY REGISTRATION] Company database created:",
                {
                    companyId: company.company_id,
                    databaseName: companyDatabase.databaseName,
                    status: companyDatabase.status,
                }
            );
        } catch (databaseError) {
            console.error(
                "COMPANY DATABASE PROVISIONING ERROR:",
                {
                    companyId: company.company_id,
                    message: databaseError.message,
                    code: databaseError.code,
                    detail: databaseError.detail,
                    constraint: databaseError.constraint,
                    table: databaseError.table,
                    schema: databaseError.schema,
                }
            );

            // The central company transaction has already committed.
            // Do not pretend the company was rolled back.
            // Do not ask the user to register the company again.

            return NextResponse.json(
                {
                    success: false,
                    message:
                        "The company record was created, but its separate PostgreSQL database could not be created. Do not register this company again. Database provisioning must be retried.",
                    company,
                    assignedUser,
                    companyDatabase: {
                        databaseName: companyDatabaseName(
                            company.company_name,
                            company.company_id
                        ),
                        status: "FAILED",
                    },
                },
                { status: 500 }
            );
        }

        // --------------------------------------------------
        // NOTIFY SUPER ADMIN
        // --------------------------------------------------

        const notification =
            await notifySuperAdminCompanyRegistration({
                company,
                requesterUserId: userId,
            });

        // --------------------------------------------------
        // SUCCESS RESPONSE
        // --------------------------------------------------

        const registrationMessage =
            assignmentMode === "newAdmin"
                ? "Company created successfully. The new administrator can log in with their new account."
                : "Company created successfully. The existing user has been assigned without creating another login.";

        return NextResponse.json(
            {
                success: true,
                message: registrationMessage,

                company,

                assignedUser,

                companyDatabase,

                superAdminNotification: {
                    sent: notification.sent,
                    message: notification.message,
                },
            },
            { status: 201 }
        );
    } catch (error) {
        console.error("COMPANY REGISTRATION ERROR:", {
            message: error?.message,
            code: error?.code,
            detail: error?.detail,
            constraint: error?.constraint,
            stack: error?.stack,
        });

        // --------------------------------------------------
        // ROLLBACK CENTRAL TRANSACTION
        // --------------------------------------------------

        if (client && transactionStarted) {
            try {
                await client.query("ROLLBACK");
            } catch (rollbackError) {
                console.error(
                    "COMPANY ROLLBACK ERROR:",
                    rollbackError
                );
            }

            transactionStarted = false;
        }

        // --------------------------------------------------
        // REMOVE LOGO IF REGISTRATION TRANSACTION FAILED
        // --------------------------------------------------

        if (savedLogo?.filePath) {
            try {
                await unlink(savedLogo.filePath);
            } catch (cleanupError) {
                console.error(
                    "COMPANY LOGO CLEANUP ERROR:",
                    cleanupError
                );
            }
        }

        // --------------------------------------------------
        // ERROR RESPONSES
        // --------------------------------------------------

        if (error?.status === 400) {
            return jsonError(
                error.message,
                400,
                error
            );
        }

        if (
            error?.code === "23505" &&
            (error.constraint === "companies_company_name_unique_idx" ||
                error.constraint === "companies_database_slug_unique_idx")
        ) {
            return jsonError(
                "A company with this name (or a very similar one) is already registered.",
                409,
                error
            );
        }

        if (error?.code === "23505") {
            return jsonError(
                "A database record conflicts with an existing record.",
                409,
                error
            );
        }

        return jsonError(
            "Company registration failed.",
            500,
            error
        );
    } finally {
        client?.release();
    }
}
