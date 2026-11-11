
import { NextResponse } from "next/server";
import pool from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { hasPermission } from "@/lib/permissions";

import path from "node:path";
import {
    mkdir,
    writeFile,
    unlink,
} from "node:fs/promises";
import { randomUUID } from "node:crypto";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_LOGO_SIZE = 2 * 1024 * 1024;

const LOGO_TYPES = {
    "image/png": "png",
    "image/jpeg": "jpg",
    "image/webp": "webp",
};

const SETTINGS_PERMISSION_KEY = "settings";

const ALLOWED_CURRENCIES = [
    "PKR",
    "USD",
    "EUR",
    "GBP",
    "AED",
];

function jsonError(message, status = 400) {
    return NextResponse.json(
        {
            success: false,
            message,
        },
        { status }
    );
}

function getUserId(user) {
    return user?.userId ?? user?.user_id ?? null;
}

function getActiveCompanyId(user) {
    const value =
        user?.activeCompanyId ??
        user?.active_company_id ??
        user?.companyId ??
        user?.company_id ??
        null;

    if (value === null || value === undefined || value === "") {
        return null;
    }

    const id = Number(value);

    return Number.isInteger(id) && id > 0 ? id : null;
}

function mapSettings(company) {
    return {
        ...company,
        country: company.country || "Pakistan",
        state_province:
            company.state_province || company.province || "",
        city: company.city || "",
        logo_url: company.logo_url || null,
    };
}

function getPermissionFlags(flags) {
    return {
        canView: flags.view,
        canCreate: flags.create,
        canUpdate: flags.update,
        canDelete: flags.delete,
    };
}

/**
 * Resolve the company belonging to the logged-in user's active
 * company membership.
 *
 * The active company is taken from the session when available.
 * If no active company is supplied, users.company_id is used.
 * If neither is available, a single company membership may be used.
 *
 * For users with multiple memberships, the active company must
 * be identifiable; this function does not arbitrarily select one.
 */
async function getAuthorizedCompany(user) {
    const userId = getUserId(user);

    if (!userId) {
        return {
            company: null,
            error: "User ID is missing from the current session.",
            status: 401,
        };
    }

    let companyId = getActiveCompanyId(user);

    if (!companyId) {
        const userResult = await pool.query(
            `
            SELECT company_id
            FROM users
            WHERE user_id = $1
            LIMIT 1
            `,
            [userId]
        );

        const storedCompanyId = userResult.rows[0]?.company_id;

        if (storedCompanyId !== null &&
            storedCompanyId !== undefined &&
            storedCompanyId !== "") {
            const parsedId = Number(storedCompanyId);

            if (Number.isInteger(parsedId) && parsedId > 0) {
                companyId = parsedId;
            }
        }
    }

    if (companyId) {
        const result = await pool.query(
            `
            SELECT
                c.company_id,
                c.company_name,
                c.phone,
                c.email,
                c.address,
                c.country,
                c.state_province,
                c.province,
                c.city,
                c.location,
                c.currency,
                c.logo_url,
                c.logo_path,
                c.created_at,
                c.updated_at,
                uc.role_id
            FROM user_companies uc
            INNER JOIN companies c
                ON c.company_id = uc.company_id
            WHERE uc.user_id = $1
              AND uc.company_id = $2
              AND c.is_active = TRUE
            LIMIT 1
            `,
            [userId, companyId]
        );

        if (!result.rows[0]) {
            return {
                company: null,
                error:
                    "You do not have access to this company, or the company is inactive.",
                status: 403,
            };
        }

        return {
            company: result.rows[0],
            error: null,
            status: 200,
        };
    }

    const memberships = await pool.query(
        `
        SELECT
            c.company_id,
            c.company_name,
            c.phone,
            c.email,
            c.address,
            c.country,
            c.state_province,
            c.province,
            c.city,
            c.location,
            c.currency,
            c.logo_url,
            c.logo_path,
            c.created_at,
            c.updated_at,
            uc.role_id
        FROM user_companies uc
        INNER JOIN companies c
            ON c.company_id = uc.company_id
        WHERE uc.user_id = $1
          AND c.is_active = TRUE
        ORDER BY c.company_id
        `,
        [userId]
    );

    if (memberships.rows.length === 0) {
        return {
            company: null,
            error: "No active company membership was found.",
            status: 404,
        };
    }

    if (memberships.rows.length > 1) {
        return {
            company: null,
            error:
                "Multiple company memberships were found. Select an active company before opening Company Settings.",
            status: 409,
        };
    }

    return {
        company: memberships.rows[0],
        error: null,
        status: 200,
    };
}

/**
 * Read permissions from the existing User Rights matrix.
 *
 * Important: use the role assigned to the user for the resolved
 * company, not a role from another company.
 */
async function checkPermission(roleId, action) {
    if (!roleId) {
        return false;
    }

    try {
        return (
            await hasPermission(
                roleId,
                SETTINGS_PERMISSION_KEY,
                action
            )
        ) === true;
    } catch (error) {
        console.error(
            `SETTINGS ${action.toUpperCase()} PERMISSION ERROR:`,
            error
        );

        return false;
    }
}

async function getSettingsAccess(user) {
    const resolved = await getAuthorizedCompany(user);

    if (!resolved.company) {
        return resolved;
    }

    const roleId = resolved.company.role_id;

    const [canView, canCreate, canUpdate, canDelete] =
        await Promise.all([
            checkPermission(roleId, "view"),
            checkPermission(roleId, "create"),
            checkPermission(roleId, "update"),
            checkPermission(roleId, "delete"),
        ]);

    return {
        ...resolved,
        roleId,
        permissions: {
            view: canView,
            create: canCreate,
            update: canUpdate,
            delete: canDelete,
        },
    };
}

function safeLogoFilename(logoUrl) {
    if (
        typeof logoUrl !== "string" ||
        !logoUrl.startsWith("/uploads/companies/")
    ) {
        return null;
    }

    const filename = path.basename(logoUrl);

    if (!filename || filename === "." || filename === "..") {
        return null;
    }

    return filename;
}

async function deleteStoredLogoFile(logoUrl) {
    const filename = safeLogoFilename(logoUrl);

    if (!filename) {
        return;
    }

    const uploadDirectory = path.resolve(
        process.cwd(),
        "public",
        "uploads",
        "companies"
    );

    const filePath = path.resolve(
        uploadDirectory,
        filename
    );

    if (path.dirname(filePath) !== uploadDirectory) {
        return;
    }

    try {
        await unlink(filePath);
    } catch (error) {
        if (error.code !== "ENOENT") {
            console.error(
                "COMPANY LOGO FILE CLEANUP ERROR:",
                error
            );
        }
    }
}

function getPermissionsResponse(permissions) {
    return getPermissionFlags(permissions);
}

// ------------------------------------------------------------
// GET /api/settings
// Requires: settings:view
// ------------------------------------------------------------
export async function GET() {
    try {
        const user = await getCurrentUser();

        if (!user) {
            return jsonError("Unauthorized.", 401);
        }

        const access = await getSettingsAccess(user);

        if (!access.company) {
            return jsonError(
                access.error || "Company not found.",
                access.status || 404
            );
        }

        if (!access.permissions.view) {
            return NextResponse.json(
                {
                    success: false,
                    message:
                        "You do not have permission to view company settings.",
                    permissions: getPermissionsResponse(
                        access.permissions
                    ),
                },
                { status: 403 }
            );
        }

        return NextResponse.json({
            success: true,
            settings: mapSettings(access.company),
            permissions: getPermissionsResponse(
                access.permissions
            ),
        });
    } catch (error) {
        console.error("GET COMPANY SETTINGS ERROR:", error);

        return jsonError(
            "Failed to load company settings.",
            500
        );
    }
}

// ------------------------------------------------------------
// PUT /api/settings
// Requires: settings:update
// Updates company information and/or uploads/removes a logo.
// ------------------------------------------------------------
export async function PUT(request) {
    let uploadedPath = null;

    try {
        const user = await getCurrentUser();

        if (!user) {
            return jsonError("Unauthorized.", 401);
        }

        const access = await getSettingsAccess(user);

        if (!access.company) {
            return jsonError(
                access.error || "Company not found.",
                access.status || 404
            );
        }

        if (!access.permissions.update) {
            return jsonError(
                "You do not have permission to edit company settings.",
                403
            );
        }

        const company = access.company;

        const contentType =
            request.headers.get("content-type") || "";

        let body;
        let logoFile = null;
        let removeLogo = false;

        if (contentType.includes("multipart/form-data")) {
            const formData = await request.formData();

            body = {
                companyName: formData.get("companyName"),
                phone: formData.get("phone"),
                email: formData.get("email"),
                address: formData.get("address"),
                city: formData.get("city"),
                stateProvince: formData.get("stateProvince"),
                country: formData.get("country"),
                currency: formData.get("currency"),
            };

            const submittedLogo =
                formData.get("companyLogo") ||
                formData.get("logo");

            if (
                submittedLogo &&
                typeof submittedLogo !== "string" &&
                typeof submittedLogo.arrayBuffer === "function" &&
                submittedLogo.size > 0
            ) {
                logoFile = submittedLogo;
            }

            removeLogo =
                formData.get("removeLogo") === "true";
        } else {
            try {
                body = await request.json();
            } catch {
                return jsonError("Invalid request body.");
            }
        }

        const {
            companyName,
            phone,
            email,
            address,
            city,
            stateProvince,
            country,
            currency,
        } = body || {};

        if (
            typeof companyName !== "string" ||
            !companyName.trim()
        ) {
            return jsonError("Company name is required.");
        }

        if (companyName.trim().length > 150) {
            return jsonError(
                "Company name must be 150 characters or fewer."
            );
        }

        for (const [field, value] of Object.entries({
            phone,
            email,
            address,
            city,
            stateProvince,
            country,
        })) {
            if (
                value != null &&
                typeof value !== "string"
            ) {
                return jsonError(
                    `Invalid ${field} value.`
                );
            }
        }

        const safePhone = phone?.trim() || "";
        const safeEmail = email?.trim() || "";
        const safeAddress = address?.trim() || "";
        const safeCity = city?.trim() || "";
        const safeStateProvince =
            stateProvince?.trim() || "";
        const safeCountry =
            country?.trim() || "Pakistan";

        if (
            safeEmail &&
            (
                safeEmail.length > 254 ||
                !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
                    safeEmail
                )
            )
        ) {
            return jsonError(
                "Please enter a valid company email."
            );
        }

        if (
            safePhone.length > 50 ||
            safeAddress.length > 500 ||
            safeCity.length > 100 ||
            safeStateProvince.length > 100 ||
            safeCountry.length > 100
        ) {
            return jsonError(
                "One or more company fields exceed the allowed length."
            );
        }

        const selectedCurrency =
            typeof currency === "string"
                ? currency.toUpperCase()
                : "PKR";

        if (
            !ALLOWED_CURRENCIES.includes(
                selectedCurrency
            )
        ) {
            return jsonError("Invalid currency.");
        }

        if (logoFile && removeLogo) {
            return jsonError(
                "Choose a logo to upload or remove the current logo, not both."
            );
        }

        let logoUrl = company.logo_url || null;

        if (removeLogo) {
            logoUrl = null;
        }

        if (logoFile) {
            const extension = LOGO_TYPES[logoFile.type];

            if (!extension) {
                return jsonError(
                    "Choose a PNG, JPG, or WebP company logo."
                );
            }

            if (logoFile.size > MAX_LOGO_SIZE) {
                return jsonError(
                    "Company logo must be 2 MB or smaller."
                );
            }

            const bytes = Buffer.from(
                await logoFile.arrayBuffer()
            );

            const isPng =
                extension === "png" &&
                bytes.length >= 8 &&
                bytes.subarray(0, 8).equals(
                    Buffer.from([
                        0x89, 0x50, 0x4e, 0x47,
                        0x0d, 0x0a, 0x1a, 0x0a,
                    ])
                );

            const isJpeg =
                extension === "jpg" &&
                bytes.length >= 3 &&
                bytes[0] === 0xff &&
                bytes[1] === 0xd8 &&
                bytes[2] === 0xff;

            const isWebp =
                extension === "webp" &&
                bytes.length >= 12 &&
                bytes.toString("ascii", 0, 4) === "RIFF" &&
                bytes.toString("ascii", 8, 12) === "WEBP";

            if (!isPng && !isJpeg && !isWebp) {
                return jsonError(
                    "The selected file is not a valid PNG, JPG, or WebP image."
                );
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

            const filename =
                `${randomUUID()}.${extension}`;

            uploadedPath = path.join(
                uploadDirectory,
                filename
            );

            await writeFile(uploadedPath, bytes, {
                flag: "wx",
            });

            logoUrl = `/uploads/companies/${filename}`;
        }

        const oldLogoUrl = company.logo_url || null;

        const updated = await pool.query(
            `
            UPDATE companies
            SET
                company_name = $1,
                phone = $2,
                email = $3,
                address = $4,
                country = $5,
                state_province = $6,
                province = $6,
                city = $7,
                location = $8,
                currency = $9,
                logo_url = $10,
                logo_path = $11,
                updated_at = CURRENT_TIMESTAMP
            WHERE company_id = $12
            RETURNING
                company_id,
                company_name,
                phone,
                email,
                address,
                country,
                state_province,
                province,
                city,
                location,
                currency,
                logo_url,
                logo_path,
                created_at,
                updated_at
            `,
            [
                companyName.trim(),
                safePhone,
                safeEmail,
                safeAddress,
                safeCountry,
                safeStateProvince,
                safeCity,
                [
                    safeCity,
                    safeStateProvince,
                    safeCountry,
                ].filter(Boolean).join(", "),
                selectedCurrency,
                logoUrl,
                logoUrl,
                company.company_id,
            ]
        );

        if (updated.rows.length === 0) {
            return jsonError("Company not found.", 404);
        }

        // The database now references the new logo, if uploaded.
        uploadedPath = null;

        // Remove the old file only after the database update succeeds.
        if (
            (logoFile || removeLogo) &&
            oldLogoUrl &&
            oldLogoUrl !== logoUrl
        ) {
            await deleteStoredLogoFile(oldLogoUrl);
        }

        return NextResponse.json({
            success: true,
            message: "Company settings saved successfully.",
            settings: mapSettings(updated.rows[0]),
            permissions: getPermissionsResponse(
                access.permissions
            ),
        });
    } catch (error) {
        if (uploadedPath) {
            try {
                await unlink(uploadedPath);
            } catch (cleanupError) {
                console.error(
                    "UPLOADED LOGO CLEANUP ERROR:",
                    cleanupError
                );
            }
        }

        console.error(
            "UPDATE COMPANY SETTINGS ERROR:",
            error
        );

        return jsonError(
            "Failed to save company settings.",
            500
        );
    }
}

// ------------------------------------------------------------
// DELETE /api/settings
// Requires: settings:delete
// Removes the saved company logo.
// ------------------------------------------------------------
export async function DELETE() {
    try {
        const user = await getCurrentUser();

        if (!user) {
            return jsonError("Unauthorized.", 401);
        }

        const access = await getSettingsAccess(user);

        if (!access.company) {
            return jsonError(
                access.error || "Company not found.",
                access.status || 404
            );
        }

        if (!access.permissions.delete) {
            return jsonError(
                "You do not have permission to delete the company logo.",
                403
            );
        }

        const company = access.company;
        const oldLogoUrl = company.logo_url || null;

        const result = await pool.query(
            `
            UPDATE companies
            SET
                logo_url = NULL,
                logo_path = NULL,
                updated_at = CURRENT_TIMESTAMP
            WHERE company_id = $1
            RETURNING company_id
            `,
            [company.company_id]
        );

        if (result.rowCount === 0) {
            return jsonError("Company not found.", 404);
        }

        if (oldLogoUrl) {
            await deleteStoredLogoFile(oldLogoUrl);
        }

        return NextResponse.json({
            success: true,
            message: "Company logo removed successfully.",
            permissions: getPermissionsResponse(
                access.permissions
            ),
        });
    } catch (error) {
        console.error(
            "DELETE COMPANY LOGO ERROR:",
            error
        );

        return jsonError(
            "Failed to remove company logo.",
            500
        );
    }
}
