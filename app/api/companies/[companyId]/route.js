import { NextResponse } from "next/server";
import pool from "@/lib/db";
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

const MAX_LOGO_SIZE = 2 * 1024 * 1024;

const ALLOWED_LOGO_TYPES = {
    "image/png": ".png",
    "image/jpeg": ".jpg",
    "image/webp": ".webp",
};

function jsonError(message, status = 400) {
    return NextResponse.json(
        { success: false, message },
        {
            status,
            headers: { "Cache-Control": "no-store" },
        }
    );
}

function positiveId(value) {
    const id = Number(value);

    return Number.isSafeInteger(id) && id > 0
        ? id
        : null;
}

function stringValue(value) {
    return typeof value === "string"
        ? value.trim()
        : "";
}

function validEmail(value) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function isUploadFile(value) {
    return (
        value !== null &&
        typeof value === "object" &&
        typeof value.arrayBuffer === "function" &&
        typeof value.size === "number"
    );
}

/**
 * Save a company logo under public/uploads/companies.
 * The generated filename prevents user-supplied path traversal.
 */
async function saveCompanyLogo(file) {
    if (!isUploadFile(file) || file.size === 0) {
        return null;
    }

    if (!Object.prototype.hasOwnProperty.call(
        ALLOWED_LOGO_TYPES,
        file.type
    )) {
        throw new Error(
            "Choose a PNG, JPG, or WebP company logo."
        );
    }

    if (file.size > MAX_LOGO_SIZE) {
        throw new Error(
            "Company logo must be 2 MB or smaller."
        );
    }

    const buffer = Buffer.from(await file.arrayBuffer());

    // Verify the actual file signature instead of trusting MIME alone.
    const validSignature =
        (file.type === "image/png" &&
            buffer.length >= 8 &&
            buffer.subarray(0, 8).equals(
                Buffer.from([
                    0x89, 0x50, 0x4e, 0x47,
                    0x0d, 0x0a, 0x1a, 0x0a,
                ])
            )) ||
        (file.type === "image/jpeg" &&
            buffer.length >= 3 &&
            buffer[0] === 0xff &&
            buffer[1] === 0xd8 &&
            buffer[2] === 0xff) ||
        (file.type === "image/webp" &&
            buffer.length >= 12 &&
            buffer.toString("ascii", 0, 4) === "RIFF" &&
            buffer.toString("ascii", 8, 12) === "WEBP");

    if (!validSignature) {
        throw new Error(
            "The selected file is not a valid PNG, JPG, or WebP image."
        );
    }

    const directory = path.join(
        process.cwd(),
        "public",
        "uploads",
        "companies"
    );

    await mkdir(directory, { recursive: true });

    const fileName =
        `${randomUUID()}${ALLOWED_LOGO_TYPES[file.type]}`;

    const filePath = path.join(directory, fileName);

    await writeFile(filePath, buffer, { flag: "wx" });

    return {
        url: `/uploads/companies/${fileName}`,
        filePath,
    };
}

/**
 * Only delete files inside our company-logo upload directory.
 * External URLs and unrelated paths are never deleted.
 */
async function deleteOldLogo(logoUrl) {
    if (
        typeof logoUrl !== "string" ||
        !logoUrl.startsWith("/uploads/companies/")
    ) {
        return;
    }

    const fileName = logoUrl.slice(
        "/uploads/companies/".length
    );

    if (
        !fileName ||
        fileName !== path.basename(fileName) ||
        !/^[a-f0-9-]+\.(png|jpg|webp)$/i.test(fileName)
    ) {
        return;
    }

    const directory = path.resolve(
        process.cwd(),
        "public",
        "uploads",
        "companies"
    );

    const filePath = path.resolve(directory, fileName);

    if (path.dirname(filePath) !== directory) {
        return;
    }

    await unlink(filePath).catch((error) => {
        if (error.code !== "ENOENT") {
            console.error("DELETE OLD COMPANY LOGO ERROR:", error);
        }
    });
}

/**
 * Check that the current user belongs to this active company
 * and has permission to edit it.
 */
async function authorizeCompany(userId, companyId) {
    const accessResult = await pool.query(
        `
        SELECT
            r.role_id,
            r.role_name
        FROM user_companies uc
        INNER JOIN roles r
            ON r.role_id = uc.role_id
        INNER JOIN companies c
            ON c.company_id = uc.company_id
        WHERE uc.user_id = $1
          AND uc.company_id = $2
          AND c.is_active = TRUE
        LIMIT 1;
        `,
        [userId, companyId]
    );

    if (!accessResult.rows.length) {
        return {
            error: jsonError(
                "You do not have access to this active company.",
                403
            ),
        };
    }

    const membership = accessResult.rows[0];

    const isAdmin =
        String(membership.role_name).toUpperCase() === "ADMIN";

    const permitted =
        isAdmin ||
        await hasPermission(
            membership.role_id,
            "companies",
            "update"
        );

    if (!permitted) {
        return {
            error: jsonError(
                "You do not have permission to edit companies.",
                403
            ),
        };
    }

    return { membership };
}

async function getCompanyById(companyId) {
    return pool.query(
        `
        SELECT
            company_id,
            company_name,
            phone,
            email,
            address,
            location,
            logo_url,
            currency
        FROM companies
        WHERE company_id = $1
        LIMIT 1;
        `,
        [companyId]
    );
}

export async function GET(request, { params }) {
    try {
        const currentUser = await getCurrentUser();

        if (!currentUser?.userId) {
            return jsonError("Please log in first.", 401);
        }

        const userId = positiveId(currentUser.userId);
        const resolvedParams = await params;
        const companyId = positiveId(resolvedParams.companyId);

        if (!userId || !companyId) {
            return jsonError(
                "Invalid user or company ID.",
                400
            );
        }

        const authorization = await authorizeCompany(
            userId,
            companyId
        );

        if (authorization.error) {
            return authorization.error;
        }

        const result = await getCompanyById(companyId);

        if (!result.rows.length) {
            return jsonError("Company not found.", 404);
        }

        return NextResponse.json(
            {
                success: true,
                company: result.rows[0],
            },
            {
                headers: { "Cache-Control": "no-store" },
            }
        );
    } catch (error) {
        console.error("GET COMPANY ERROR:", error);

        return jsonError(
            "Unable to load company details.",
            500
        );
    }
}

export async function PATCH(request, { params }) {
    let uploadedLogo = null;
    let transactionStarted = false;

    try {
        const currentUser = await getCurrentUser();

        if (!currentUser?.userId) {
            return jsonError("Please log in first.", 401);
        }

        const userId = positiveId(currentUser.userId);
        const resolvedParams = await params;
        const companyId = positiveId(resolvedParams.companyId);

        if (!userId || !companyId) {
            return jsonError(
                "Invalid user or company ID.",
                400
            );
        }

        const authorization = await authorizeCompany(
            userId,
            companyId
        );

        if (authorization.error) {
            return authorization.error;
        }

        const existingResult = await getCompanyById(companyId);

        if (!existingResult.rows.length) {
            return jsonError("Company not found.", 404);
        }

        const existing = existingResult.rows[0];

        const contentType =
            request.headers.get("content-type") || "";

        let data = {};
        let logoFile = null;

        if (contentType.includes("multipart/form-data")) {
            const formData = await request.formData();

            for (const [key, value] of formData.entries()) {
                if (key === "companyLogo") {
                    if (isUploadFile(value) && value.size > 0) {
                        logoFile = value;
                    }
                    continue;
                }

                if (typeof value === "string") {
                    data[key] = value;
                }
            }
        } else if (
            contentType.includes("application/json")
        ) {
            try {
                data = await request.json();
            } catch {
                return jsonError(
                    "Invalid JSON request body.",
                    400
                );
            }

            if (
                !data ||
                typeof data !== "object" ||
                Array.isArray(data)
            ) {
                return jsonError(
                    "Invalid request body.",
                    400
                );
            }
        } else {
            return jsonError(
                "Use multipart/form-data for logo uploads or application/json for text-only updates.",
                415
            );
        }

        const companyName = stringValue(
            data.companyName ??
            data.company_name ??
            existing.company_name
        );

        const phone = stringValue(
            data.phone ?? existing.phone ?? ""
        );

        const email = stringValue(
            data.companyEmail ??
            data.email ??
            existing.email ??
            ""
        ).toLowerCase();

        const address = stringValue(
            data.address ?? existing.address ?? ""
        );

        const currency = stringValue(
            data.currency ?? existing.currency ?? "PKR"
        ).toUpperCase();

        if (!companyName) {
            return jsonError("Company name is required.");
        }

        if (companyName.length > 150) {
            return jsonError(
                "Company name cannot exceed 150 characters."
            );
        }

        if (phone.length > 50) {
            return jsonError(
                "Phone number cannot exceed 50 characters."
            );
        }

        if (address.length > 500) {
            return jsonError(
                "Address cannot exceed 500 characters."
            );
        }

        if (email.length > 254) {
            return jsonError(
                "Email cannot exceed 254 characters."
            );
        }

        if (email && !validEmail(email)) {
            return jsonError(
                "Enter a valid company email address."
            );
        }

        if (!/^[A-Z]{3}$/.test(currency)) {
            return jsonError(
                "Currency must be a three-letter code, such as PKR or USD."
            );
        }

        // Preserve the existing location unless location fields
        // were provided by the client.
        let location = existing.location ?? null;

        const locationFieldsProvided = [
            "city",
            "province",
            "country",
            "postalCode",
            "location",
        ].some((key) =>
            Object.prototype.hasOwnProperty.call(data, key)
        );

        if (locationFieldsProvided) {
            if (
                Object.prototype.hasOwnProperty.call(
                    data,
                    "location"
                )
            ) {
                location = stringValue(data.location) || null;
            } else {
                const city = stringValue(data.city);
                const province = stringValue(data.province);
                const country = stringValue(data.country);
                const postalCode = stringValue(data.postalCode);

                if (
                    city.length > 100 ||
                    province.length > 100 ||
                    country.length > 100 ||
                    postalCode.length > 30
                ) {
                    return jsonError(
                        "A location field exceeds its allowed length."
                    );
                }

                location = [
                    city,
                    province,
                    country,
                    postalCode,
                ].filter(Boolean).join(", ") || null;
            }
        }

        const removeLogo =
            String(data.removeLogo || "").toLowerCase() === "true";

        // Validate and save a replacement before changing the database.
        // If validation fails, the current logo remains untouched.
        uploadedLogo = await saveCompanyLogo(logoFile);

        // A newly uploaded logo takes priority over removeLogo.
        const logoUrl = uploadedLogo
            ? uploadedLogo.url
            : removeLogo
                ? null
                : existing.logo_url;

        // Use a transaction and lock the company row during the update.
        // If the update fails, the uploaded file is cleaned up below.
        const client = await pool.connect();

        let updatedCompany;

        try {
            await client.query("BEGIN");
            transactionStarted = true;

            const lockedResult = await client.query(
                `
                SELECT logo_url
                FROM companies
                WHERE company_id = $1
                  AND is_active = TRUE
                FOR UPDATE;
                `,
                [companyId]
            );

            if (!lockedResult.rows.length) {
                await client.query("ROLLBACK");
                transactionStarted = false;

                return jsonError(
                    "Company not found or inactive.",
                    404
                );
            }

            const latestLogoUrl = lockedResult.rows[0].logo_url;

            // Avoid overwriting a logo changed by another request
            // between the initial read and this transaction.
            const finalLogoUrl = uploadedLogo
                ? uploadedLogo.url
                : removeLogo
                    ? null
                    : latestLogoUrl;

            const result = await client.query(
                `
                UPDATE companies
                SET
                    company_name = $1,
                    phone = $2,
                    email = $3,
                    address = $4,
                    location = $5,
                    logo_url = $6,
                    currency = $7,
                    updated_at = CURRENT_TIMESTAMP
                WHERE company_id = $8
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
                    email || null,
                    address || null,
                    location,
                    finalLogoUrl,
                    currency,
                    companyId,
                ]
            );

            updatedCompany = result.rows[0];

            await client.query("COMMIT");
            transactionStarted = false;

            // Delete the previous local logo only after the database
            // transaction has successfully committed.
            if (
                (uploadedLogo || removeLogo) &&
                latestLogoUrl &&
                latestLogoUrl !== finalLogoUrl
            ) {
                await deleteOldLogo(latestLogoUrl);
            }
        } catch (error) {
            if (transactionStarted) {
                await client.query("ROLLBACK").catch(() => {});
                transactionStarted = false;
            }

            throw error;
        } finally {
            client.release();
        }

        // The database now references the new file. Do not delete it
        // in the catch block after a successful commit.
        uploadedLogo = null;

        return NextResponse.json(
            {
                success: true,
                message: removeLogo && !logoFile
                    ? "Company updated and logo removed successfully."
                    : "Company updated successfully.",
                company: updatedCompany,
            },
            {
                headers: { "Cache-Control": "no-store" },
            }
        );
    } catch (error) {
        console.error("UPDATE COMPANY ERROR:", error);

        if (uploadedLogo?.filePath) {
            await unlink(uploadedLogo.filePath).catch(() => {});
        }

        if (
            error?.message ===
                "Choose a PNG, JPG, or WebP company logo." ||
            error?.message ===
                "Company logo must be 2 MB or smaller." ||
            error?.message ===
                "The selected file is not a valid PNG, JPG, or WebP image."
        ) {
            return jsonError(error.message, 400);
        }

        return jsonError(
            "Unable to update company.",
            500
        );
    }
}
