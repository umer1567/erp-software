
import { NextResponse } from "next/server";

import pool from "@/lib/db";
import {
    getTenantContext,
    unauthorizedResponse,
} from "@/lib/tenant";
import { hasPermission } from "@/lib/permissions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const PERMISSION_KEY = "recycle_bin";
const DEFAULT_LIMIT = 25;
const MAX_LIMIT = 100;

/*
 * Negative ID ranges:
 *
 * Tenant records:
 *   Positive recycle_bin_id
 *
 * User-company memberships:
 *   -recycle_bin_id
 *
 * Roles:
 *   -(ROLE_ID_OFFSET + recycle_bin_id)
 *
 * Keep this offset identical in the restore and permanent-delete APIs.
 */
const ROLE_ID_OFFSET = 1_000_000_000_000;

const CENTRAL_MODULES = new Set([
    "user_company_memberships",
    "roles",
]);

const TENANT_MODULES = new Set([
    "customers",
    "product_categories",
    "products",
    "product_units",
    "suppliers",
    "units_of_measure",
    "warehouses",
    "sales_quotations",
    "sales_orders",
    "delivery_challans",
    "sales_returns",
    "purchase_requisitions",
    "procurement_requisitions",
    "purchase_quotations",
    "rfqs",
    "purchase_orders",
    "pending_item_receipts",
    "item_receipts",
    "assembly_build",
    "assembly_unbuild",
    "bill_of_materials",
]);

/* -------------------------------------------------------------------------- */
/* Response helpers                                                           */
/* -------------------------------------------------------------------------- */

function errorResponse(message, status = 400) {
    return NextResponse.json(
        {
            success: false,
            message,
        },
        {
            status,
            headers: {
                "Cache-Control": "no-store, no-cache, must-revalidate",
            },
        }
    );
}

function successResponse(data) {
    return NextResponse.json(data, {
        headers: {
            "Cache-Control": "no-store, no-cache, must-revalidate",
        },
    });
}

/* -------------------------------------------------------------------------- */
/* Authentication and permission                                             */
/* -------------------------------------------------------------------------- */

async function authorizeRecycleBin() {
    let tenant;

    try {
        tenant = await getTenantContext();
    } catch (error) {
        console.error("RECYCLE BIN AUTHENTICATION ERROR:", error);

        return {
            tenant: null,
            response: errorResponse(
                "Unable to verify your login session.",
                500
            ),
        };
    }

    if (!tenant) {
        return {
            tenant: null,
            response: unauthorizedResponse(),
        };
    }

    const roleId = tenant.user?.roleId ?? tenant.user?.role_id;

    if (
        roleId == null ||
        !Number.isSafeInteger(Number(roleId)) ||
        Number(roleId) <= 0
    ) {
        return {
            tenant: null,
            response: errorResponse(
                "Your account does not have a valid role.",
                403
            ),
        };
    }

    try {
        const allowed = await hasPermission(
            Number(roleId),
            PERMISSION_KEY,
            "view"
        );

        if (!allowed) {
            return {
                tenant: null,
                response: errorResponse(
                    "You do not have permission to view the Recycle Bin.",
                    403
                ),
            };
        }

        return {
            tenant,
            response: null,
        };
    } catch (error) {
        console.error("RECYCLE BIN PERMISSION ERROR:", error);

        return {
            tenant: null,
            response: errorResponse(
                "Unable to verify Recycle Bin permissions.",
                500
            ),
        };
    }
}


/**
 * Only a genuine central system ADMIN gets cross-company visibility.
 * A company-level ADMIN must remain restricted to their own company.
 */
async function isGlobalSystemAdmin(roleId) {
    const result = await pool.query(
        `
        SELECT role_id
        FROM public.roles
        WHERE role_id = $1
          AND company_id IS NULL
          AND is_system_role = TRUE
          AND UPPER(role_name) = 'ADMIN'
        LIMIT 1
        `,
        [roleId]
    );

    return result.rows.length > 0;
}



/* -------------------------------------------------------------------------- */
/* Query helpers                                                              */
/* -------------------------------------------------------------------------- */

function parsePositiveInteger(value, fallback) {
    const number = Number(value);

    return Number.isSafeInteger(number) && number > 0
        ? number
        : fallback;
}

function normalizeSearch(value) {
    return String(value || "").trim().toLowerCase();
}

function matchesSearch(record, search) {
    if (!search) return true;

    return [
        record.record_label,
        record.module_key,
        record.source_table,
        record.source_record_id,
        record.deleted_by_name,
        record.deletion_reason,
    ].some((value) =>
        String(value ?? "").toLowerCase().includes(search)
    );
}

function sortArchiveRecords(records) {
    return records.sort((a, b) => {
        const dateA = new Date(a.deleted_at).getTime();
        const dateB = new Date(b.deleted_at).getTime();

        const validDateA = Number.isFinite(dateA) ? dateA : 0;
        const validDateB = Number.isFinite(dateB) ? dateB : 0;

        if (validDateA !== validDateB) {
            return validDateB - validDateA;
        }

        return (
            Math.abs(Number(b.recycle_bin_id)) -
            Math.abs(Number(a.recycle_bin_id))
        );
    });
}

/* -------------------------------------------------------------------------- */
/* Tenant archive records                                                     */
/* -------------------------------------------------------------------------- */


async function getTenantArchiveRecords(
    tenant,
    companyId,
    moduleKey
) {
    if (moduleKey && CENTRAL_MODULES.has(moduleKey)) {
        return [];
    }

    if (!tenant?.db || typeof tenant.db.query !== "function") {
        throw new Error("Company database connection is unavailable.");
    }

    const values = [companyId];
    let moduleCondition = "";

    if (moduleKey) {
        values.push(moduleKey);
        moduleCondition = `AND module_key = $${values.length}`;
    }

    // Module archive records are stored in the current company database.
    const result = await tenant.db.query(
        `
        SELECT
            recycle_bin_id,
            company_id,
            module_key,
            source_table,
            source_record_id,
            record_label,
            deleted_by,
            deleted_at,
            deletion_reason
        FROM public.recycle_bin_items
        WHERE company_id = $1
          ${moduleCondition}
        ORDER BY deleted_at DESC, recycle_bin_id DESC
        `,
        values
    );

    // User accounts remain central, so resolve their names separately.
    const deletedByIds = [
        ...new Set(
            result.rows
                .map((record) => Number(record.deleted_by))
                .filter((id) => Number.isSafeInteger(id) && id > 0)
        ),
    ];

    const userNames = new Map();

    if (deletedByIds.length > 0) {
        const usersResult = await pool.query(
            `
            SELECT user_id, full_name
            FROM public.users
            WHERE user_id = ANY($1::int[])
            `,
            [deletedByIds]
        );

        for (const user of usersResult.rows) {
            userNames.set(Number(user.user_id), user.full_name);
        }
    }

    return result.rows.map((record) => ({
        ...record,
        recycle_bin_id: Number(record.recycle_bin_id),
        company_id: Number(record.company_id),
        source_record_id: String(record.source_record_id),
        deleted_by: record.deleted_by
            ? Number(record.deleted_by)
            : null,
        deleted_by_name: record.deleted_by
            ? userNames.get(Number(record.deleted_by)) || null
            : null,
        archive_source: "tenant",
    }));
}
/* -------------------------------------------------------------------------- */
/* Central company membership archive records                                 */
/* -------------------------------------------------------------------------- */



async function getCentralMembershipRecords(
    companyId,
    moduleKey,
    globalAdmin = false
) {
    if (
        moduleKey &&
        moduleKey !== "user_company_memberships"
    ) {
        return [];
    }

    const values = [];
    const conditions = [];

    if (!globalAdmin) {
        values.push(companyId);
        conditions.push(`r.company_id = $${values.length}`);
    }

    if (moduleKey) {
        values.push(moduleKey);
        conditions.push(`r.module_key = $${values.length}`);
    }

    const whereClause = conditions.length
        ? `WHERE ${conditions.join(" AND ")}`
        : "";

    const result = await pool.query(
        `
        SELECT
            r.recycle_bin_id,
            r.company_id,
            r.user_id,
            r.module_key,
            r.source_table,
            r.record_label,
            r.deleted_by,
            COALESCE(u.full_name, u.username, 'Unknown')
                AS deleted_by_name,
            r.deleted_at,
            r.deletion_reason
        FROM public.user_company_recycle_bin_items r
        LEFT JOIN public.users u
            ON u.user_id = r.deleted_by
        ${whereClause}
        ORDER BY r.deleted_at DESC, r.recycle_bin_id DESC
        `,
        values
    );

    return result.rows.map((record) => {
        const archiveId = Number(record.recycle_bin_id);

        if (
            !Number.isSafeInteger(archiveId) ||
            archiveId <= 0
        ) {
            throw new Error(
                "Invalid company membership archive ID."
            );
        }

        return {
            recycle_bin_id: -archiveId,
            company_id: Number(record.company_id),
            module_key: record.module_key,
            source_table: record.source_table,
            source_record_id:
                `${record.user_id}:${record.company_id}`,
            record_label: record.record_label,
            deleted_by: record.deleted_by,
            deleted_by_name: record.deleted_by_name,
            deleted_at: record.deleted_at,
            deletion_reason: record.deletion_reason,
            archive_source: "central",
        };
    });
}


/* -------------------------------------------------------------------------- */
/* Central role archive records                                               */
/* -------------------------------------------------------------------------- */


async function getCentralRoleRecords(companyId, moduleKey) {
    if (moduleKey && moduleKey !== "roles") {
        return [];
    }

    const result = await pool.query(
        `
        SELECT
            r.recycle_bin_id,
            r.company_id,
            r.role_id,
            r.record_label,
            r.deleted_by,
            u.full_name AS deleted_by_name,
            r.deleted_at,
            r.deletion_reason
        FROM public.role_recycle_bin_items r
        LEFT JOIN public.users u
            ON u.user_id = r.deleted_by
        WHERE r.company_id = $1
        ORDER BY r.deleted_at DESC, r.recycle_bin_id DESC
        `,
        [companyId]
    );

    return result.rows.map((record) => {
        const archiveId = Number(record.recycle_bin_id);

        if (
            !Number.isSafeInteger(archiveId) ||
            archiveId <= 0 ||
            archiveId > Number.MAX_SAFE_INTEGER - ROLE_ID_OFFSET
        ) {
            throw new Error("Invalid role archive ID.");
        }

        return {
            recycle_bin_id: -(ROLE_ID_OFFSET + archiveId),
            company_id: Number(record.company_id),
            module_key: "roles",
            source_table: "roles",
            source_record_id: String(record.role_id),
            record_label: record.record_label,
            deleted_by: record.deleted_by,
            deleted_by_name: record.deleted_by_name || null,
            deleted_at: record.deleted_at,
            deletion_reason: record.deletion_reason,
            archive_source: "central",
        };
    });
}
/* -------------------------------------------------------------------------- */
/* GET /api/recycle-bin                                                       */
/* -------------------------------------------------------------------------- */

export async function GET(request) {
    try {
        const { tenant, response } = await authorizeRecycleBin();

        if (response) return response;

        const companyId = Number(tenant.companyId);

        const roleId = Number(
    tenant.user?.roleId ?? tenant.user?.role_id
);

const globalAdmin = await isGlobalSystemAdmin(roleId);

        if (!Number.isSafeInteger(companyId) || companyId <= 0) {
            return errorResponse(
                "Invalid company context.",
                403
            );
        }

        const { searchParams } = new URL(request.url);

        const page = parsePositiveInteger(
            searchParams.get("page"),
            1
        );

        const limit = Math.min(
            parsePositiveInteger(
                searchParams.get("limit"),
                DEFAULT_LIMIT
            ),
            MAX_LIMIT
        );

        const moduleKey = String(
            searchParams.get("module") || ""
        ).trim();

        const search = normalizeSearch(
            searchParams.get("search")
        );

        if (
            moduleKey &&
            !TENANT_MODULES.has(moduleKey) &&
            !CENTRAL_MODULES.has(moduleKey)
        ) {
            return errorResponse(
                "Invalid Recycle Bin module filter.",
                400
            );
        }

        /*
         * All three sources are loaded before pagination.
         * This ensures records from central and tenant databases
         * appear in one correctly sorted result set.
         */
        const [
            tenantRecords,
            membershipRecords,
            roleRecords,
        ] = await Promise.all([
            getTenantArchiveRecords(
                tenant,
                companyId,
                moduleKey
            ),
            getCentralMembershipRecords(
    companyId,
    moduleKey,
    globalAdmin
),
            getCentralRoleRecords(
                companyId,
                moduleKey
            ),
        ]);

        const filteredRecords = sortArchiveRecords(
            [
                ...tenantRecords,
                ...membershipRecords,
                ...roleRecords,
            ].filter((record) =>
                matchesSearch(record, search)
            )
        );

        const total = filteredRecords.length;
        const totalPages = Math.ceil(total / limit);
        const offset = (page - 1) * limit;

        return successResponse({
            success: true,
            records: filteredRecords.slice(
                offset,
                offset + limit
            ),
            pagination: {
                page,
                limit,
                total,
                totalPages,
                hasNextPage: page < totalPages,
                hasPreviousPage: page > 1,
            },
            filters: {
                module: moduleKey || null,
                search: search || null,
            },
        });
    } catch (error) {
        console.error("GET RECYCLE BIN ERROR:", error);

        if (error.code === "42P01") {
            return errorResponse(
                "A required central or tenant Recycle Bin table is missing. Apply the required migrations before using the Recycle Bin.",
                503
            );
        }

        return errorResponse(
            "An unexpected error occurred while loading the Recycle Bin.",
            500
        );
    }
}
