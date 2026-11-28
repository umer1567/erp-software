
import { NextResponse } from "next/server";

import pool from "@/lib/db";
import {
    getTenantContext,
    unauthorizedResponse,
} from "@/lib/tenant";
import {
    hasPermission,
    invalidateRolePermissions,
} from "@/lib/permissions";
import {
    restoreUserCompanyMembership,
} from "@/lib/user-company-recycle-bin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const PERMISSION_KEY = "recycle_bin";
const ROLE_ID_OFFSET = 1_000_000_000_000;

/* -------------------------------------------------------------------------- */
/* Tenant restore whitelist                                                   */
/* -------------------------------------------------------------------------- */

const RESTORABLE_MODULES = Object.freeze({
    customers: {
        table: "customers",
        idColumn: "customer_id",
    },
    product_categories: {
        table: "product_categories",
        idColumn: "category_id",
    },
    products: {
        table: "products",
        idColumn: "product_id",
    },
    product_units: {
        table: "product_units",
        idColumn: "unit_id",
    },
    suppliers: {
        table: "suppliers",
        idColumn: "supplier_id",
    },
    units_of_measure: {
        table: "units_of_measure",
        idColumn: "unit_id",
    },
    warehouses: {
        table: "warehouses",
        idColumn: "warehouse_id",
    },
    sales_quotations: {
        table: "sales_quotations",
        idColumn: "quotation_id",
    },
    sales_orders: {
        table: "sales_orders",
        idColumn: "order_id",
    },
    delivery_challans: {
        table: "delivery_challans",
        idColumn: "delivery_challan_id",
    },
    sales_returns: {
        table: "sales_returns",
        idColumn: "return_id",
    },
    purchase_requisitions: {
        table: "purchase_requisitions",
        idColumn: "requisition_id",
    },
    procurement_requisitions: {
        table: "procurement_requisitions",
        idColumn: "procurement_requisition_id",
    },
    purchase_quotations: {
        table: "purchase_quotations",
        idColumn: "purchase_quotation_id",
    },
    rfqs: {
        table: "rfqs",
        idColumn: "rfq_id",
    },
    purchase_orders: {
        table: "purchase_orders",
        idColumn: "purchase_order_id",
    },
    pending_item_receipts: {
        table: "pending_item_receipts",
        idColumn: "pending_item_receipt_id",
    },
    item_receipts: {
        table: "item_receipts",
        idColumn: "item_receipt_id",
    },
    assembly_build: {
        table: "assembly_builds",
        idColumn: "assembly_build_id",
    },
    assembly_unbuild: {
        table: "assembly_unbuilds",
        idColumn: "assembly_unbuild_id",
    },
    bill_of_materials: {
        table: "bill_of_materials",
        idColumn: "bom_id",
    },
});

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

async function authorizeRestore() {
    let tenant;

    try {
        tenant = await getTenantContext();
    } catch (error) {
        console.error("RECYCLE BIN RESTORE AUTH ERROR:", error);

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
            "update"
        );

        if (!allowed) {
            return {
                tenant: null,
                response: errorResponse(
                    "You do not have permission to restore archived records.",
                    403
                ),
            };
        }

        const globalAdminResult = await pool.query(
    `
    SELECT 1
    FROM public.roles
    WHERE role_id = $1
      AND company_id IS NULL
      AND is_system_role = TRUE
      AND deleted_at IS NULL
    LIMIT 1
    `,
    [Number(roleId)]
);

return {
    tenant,
    isGlobalSystemAdmin: globalAdminResult.rowCount === 1,
    response: null,
};
    } catch (error) {
        console.error(
            "RECYCLE BIN RESTORE PERMISSION ERROR:",
            error
        );

        return {
            tenant: null,
            response: errorResponse(
                "Unable to verify Recycle Bin permissions.",
                500
            ),
        };
    }
}

/* -------------------------------------------------------------------------- */
/* Route ID and central archive ID decoding                                   */
/* -------------------------------------------------------------------------- */

async function getRecycleBinId(context) {
    const params = await context.params;
    const id = Number(params?.id);

    if (!Number.isSafeInteger(id) || id === 0) {
        return null;
    }

    return id;
}

function decodeCentralArchiveId(recycleBinId) {
    if (!Number.isSafeInteger(recycleBinId) || recycleBinId >= 0) {
        return null;
    }

    const absoluteId = Math.abs(recycleBinId);

    if (absoluteId > ROLE_ID_OFFSET) {
        const archiveId = absoluteId - ROLE_ID_OFFSET;

        if (!Number.isSafeInteger(archiveId) || archiveId <= 0) {
            return null;
        }

        return {
            type: "role",
            archiveId,
        };
    }

    if (!Number.isSafeInteger(absoluteId) || absoluteId <= 0) {
        return null;
    }

    return {
        type: "membership",
        archiveId: absoluteId,
    };
}

/* -------------------------------------------------------------------------- */
/* Central user-company membership restore                                   */
/* -------------------------------------------------------------------------- */

async function restoreCentralMembership(
    archiveId,
    companyId,
    isGlobalSystemAdmin = false
) {
    let client;
    let transactionStarted = false;

    try {
        client = await pool.connect();

        await client.query("BEGIN");
        transactionStarted = true;

        // Global ADMIN can locate the archive across companies.
        // Other administrators remain restricted to their own company.
        const companyScope = isGlobalSystemAdmin
            ? null
            : companyId;

        const archiveResult = await client.query(
            `
            SELECT
                recycle_bin_id,
                company_id,
                user_id,
                module_key,
                source_table,
                record_label
            FROM public.user_company_recycle_bin_items
            WHERE recycle_bin_id = $1
              AND (
                    $2::BIGINT IS NULL
                    OR company_id = $2
              )
              AND module_key = 'user_company_memberships'
              AND source_table = 'user_companies'
            FOR UPDATE
            `,
            [archiveId, companyScope]
        );

        if (archiveResult.rowCount !== 1) {
            await client.query("ROLLBACK");
            transactionStarted = false;

            return errorResponse(
                "Archived company membership not found or you are not authorized to restore it.",
                404
            );
        }

        const archived = archiveResult.rows[0];
        const archivedCompanyId = Number(archived.company_id);

        if (
            !Number.isSafeInteger(archivedCompanyId) ||
            archivedCompanyId <= 0
        ) {
            throw new Error(
                "The archived membership has an invalid company reference."
            );
        }

        // Restore using the actual company ID from the locked archive row.
        const result = await restoreUserCompanyMembership(
            client,
            {
                archiveId,
                companyId: archivedCompanyId,
            }
        );

        await client.query("COMMIT");
        transactionStarted = false;

        return successResponse({
            success: true,
            message: "User company membership restored successfully.",
            recycleBinId: -archiveId,
            module: "user_company_memberships",
            recordId: Number(archived.user_id),
            companyId: archivedCompanyId,
            recordLabel: archived.record_label,
            ...result,
        });
    } catch (error) {
        if (client && transactionStarted) {
            await client.query("ROLLBACK").catch((rollbackError) => {
                console.error(
                    "CENTRAL MEMBERSHIP RESTORE ROLLBACK ERROR:",
                    rollbackError
                );
            });
        }

        console.error(
            "CENTRAL MEMBERSHIP RESTORE ERROR:",
            error
        );

        if (error.code === "23505") {
            return errorResponse(
                "An active company membership already exists. The archive entry has been preserved.",
                409
            );
        }

        if (error.code === "23503") {
            return errorResponse(
                "The original user, company, or role no longer exists. The membership cannot be restored.",
                409
            );
        }

        if (error.status) {
            return errorResponse(error.message, error.status);
        }

        if (error.code === "42P01") {
            return errorResponse(
                "The central membership Recycle Bin table is missing. Apply its migration first.",
                503
            );
        }

        return errorResponse(
            "An unexpected error occurred while restoring the company membership.",
            500
        );
    } finally {
        client?.release();
    }
}
/* -------------------------------------------------------------------------- */
/* Central role restore                                                       */
/* -------------------------------------------------------------------------- */

async function restoreCentralRole(archiveId, companyId) {
    let client;
    let transactionStarted = false;
    let roleId = null;

    try {
        client = await pool.connect();

        await client.query("BEGIN");
        transactionStarted = true;

        const archiveResult = await client.query(
            `
            SELECT
                recycle_bin_id,
                company_id,
                role_id,
                record_label
            FROM public.role_recycle_bin_items
            WHERE recycle_bin_id = $1
              AND company_id = $2
              AND module_key = 'roles'
              AND source_table = 'roles'
            FOR UPDATE
            `,
            [archiveId, companyId]
        );

        if (archiveResult.rowCount !== 1) {
            await client.query("ROLLBACK");
            transactionStarted = false;

            return errorResponse("Archived role not found.", 404);
        }

        const archived = archiveResult.rows[0];
        roleId = Number(archived.role_id);

        if (!Number.isSafeInteger(roleId) || roleId <= 0) {
            throw new Error("The archived role reference is invalid.");
        }

        const roleResult = await client.query(
            `
            SELECT
                role_id,
                role_name,
                company_id,
                is_system_role,
                deleted_at
            FROM public.roles
            WHERE role_id = $1
              AND company_id = $2
              AND is_system_role = FALSE
            FOR UPDATE
            `,
            [roleId, companyId]
        );

        if (roleResult.rowCount !== 1) {
            await client.query("ROLLBACK");
            transactionStarted = false;

            return errorResponse(
                "The original company role no longer exists. The archive entry has been preserved.",
                409
            );
        }

        if (roleResult.rows[0].deleted_at == null) {
            await client.query("ROLLBACK");
            transactionStarted = false;

            return errorResponse("This role is already active.", 409);
        }

        const restoreResult = await client.query(
            `
            UPDATE public.roles
            SET
                deleted_at = NULL,
                deleted_by = NULL,
                updated_at = CURRENT_TIMESTAMP
            WHERE role_id = $1
              AND company_id = $2
              AND is_system_role = FALSE
              AND deleted_at IS NOT NULL
            RETURNING role_id
            `,
            [roleId, companyId]
        );

        if (restoreResult.rowCount !== 1) {
            throw new Error("The role could not be restored.");
        }

        const archiveDelete = await client.query(
            `
            DELETE FROM public.role_recycle_bin_items
            WHERE recycle_bin_id = $1
              AND company_id = $2
            RETURNING recycle_bin_id
            `,
            [archiveId, companyId]
        );

        if (archiveDelete.rowCount !== 1) {
            throw new Error(
                "The role archive entry could not be removed."
            );
        }

        await client.query("COMMIT");
        transactionStarted = false;

        invalidateRolePermissions(roleId);

        return successResponse({
            success: true,
            message: "Role restored successfully.",
            recycleBinId: -(ROLE_ID_OFFSET + archiveId),
            module: "roles",
            recordId: roleId,
            recordLabel: archived.record_label,
        });
    } catch (error) {
        if (client && transactionStarted) {
            await client.query("ROLLBACK").catch((rollbackError) => {
                console.error(
                    "ROLE RESTORE ROLLBACK ERROR:",
                    rollbackError
                );
            });
        }

        console.error("CENTRAL ROLE RESTORE ERROR:", error);

        if (error.code === "23505") {
            return errorResponse(
                "A role with the same name already exists. The archive entry has been preserved.",
                409
            );
        }

        if (error.code === "23503") {
            return errorResponse(
                "A required related record no longer exists. The archive entry has been preserved.",
                409
            );
        }

        if (error.code === "42P01") {
            return errorResponse(
                "The role Recycle Bin table is missing. Apply the role archive migration first.",
                503
            );
        }

        return errorResponse(
            "An unexpected error occurred while restoring the role.",
            500
        );
    } finally {
        client?.release();
    }
}

/* -------------------------------------------------------------------------- */
/* Tenant record restore                                                      */
/* -------------------------------------------------------------------------- */



async function restoreTenantRecord(tenant, recycleBinId, companyId) {
    let client;
    let transactionStarted = false;

    try {
        // All operational records and Recycle Bin archives use central erp_system.
        client = await tenant.db.connect();

        await client.query("BEGIN");
        transactionStarted = true;

        const archiveResult = await client.query(
            `
            SELECT
                recycle_bin_id,
                company_id,
                module_key,
                source_table,
                source_record_id,
                record_label
            FROM public.recycle_bin_items
            WHERE recycle_bin_id = $1
              AND company_id = $2
            FOR UPDATE
            `,
            [recycleBinId, companyId]
        );

        if (archiveResult.rowCount !== 1) {
            await client.query("ROLLBACK");
            transactionStarted = false;
            return errorResponse("Archived record not found.", 404);
        }

        const archived = archiveResult.rows[0];
        const config = RESTORABLE_MODULES[archived.module_key];

        if (!config || archived.source_table !== config.table) {
            await client.query("ROLLBACK");
            transactionStarted = false;

            return errorResponse(
                "Restoration is not supported for this module.",
                400
            );
        }

        const recordId = Number(archived.source_record_id);

        if (!Number.isSafeInteger(recordId) || recordId <= 0) {
            await client.query("ROLLBACK");
            transactionStarted = false;

            return errorResponse(
                "The archived record reference is invalid.",
                400
            );
        }

        const originalResult = await client.query(
            `
            SELECT *
            FROM public.${config.table}
            WHERE ${config.idColumn} = $1
            FOR UPDATE
            `,
            [recordId]
        );

        if (originalResult.rowCount !== 1) {
            await client.query("ROLLBACK");
            transactionStarted = false;

            return errorResponse(
                "The original record no longer exists. The archive entry has been preserved.",
                409
            );
        }

        let restoreResult;

        // Products use is_active, not deleted_at/deleted_by.
        if (archived.module_key === "products") {
            if (originalResult.rows[0].is_active === true) {
                await client.query("ROLLBACK");
                transactionStarted = false;

                return errorResponse("This product is already active.", 409);
            }

            restoreResult = await client.query(
                `
                UPDATE public.products
SET
    is_active = TRUE,
    deleted_at = NULL,
    deleted_by = NULL
WHERE product_id = $1
  AND deleted_at IS NOT NULL;
                `,
                [recordId]
            );
        } else {
            if (originalResult.rows[0].deleted_at == null) {
                await client.query("ROLLBACK");
                transactionStarted = false;

                return errorResponse("This record is already active.", 409);
            }

            restoreResult = await client.query(
                `
                UPDATE public.${config.table}
                SET
                    deleted_at = NULL,
                    deleted_by = NULL
                WHERE ${config.idColumn} = $1
                  AND deleted_at IS NOT NULL
                RETURNING ${config.idColumn}
                `,
                [recordId]
            );
        }

        if (restoreResult.rowCount !== 1) {
            throw new Error("The original record could not be restored.");
        }

        const archiveDelete = await client.query(
            `
            DELETE FROM public.recycle_bin_items
            WHERE recycle_bin_id = $1
              AND company_id = $2
            RETURNING recycle_bin_id
            `,
            [recycleBinId, companyId]
        );

        if (archiveDelete.rowCount !== 1) {
            throw new Error(
                "The Recycle Bin entry could not be removed after restoration."
            );
        }

        await client.query("COMMIT");
        transactionStarted = false;

        return successResponse({
            success: true,
            message: `${archived.record_label || config.table} restored successfully.`,
            recycleBinId,
            module: archived.module_key,
            recordId,
            recordLabel: archived.record_label,
        });
    } catch (error) {
        if (client && transactionStarted) {
            await client.query("ROLLBACK").catch((rollbackError) => {
                console.error(
                    "CENTRAL RESTORE ROLLBACK ERROR:",
                    rollbackError
                );
            });
        }

        console.error("RECYCLE BIN RESTORE ERROR:", error);

        if (error.code === "23505") {
            return errorResponse(
                "A conflicting record already exists. Resolve the conflict before restoring this record. The archive entry has been preserved.",
                409
            );
        }

        if (error.code === "23503") {
            return errorResponse(
                "A required related record no longer exists. Restore the related record first. The archive entry has been preserved.",
                409
            );
        }

        if (error.code === "42P01") {
            return errorResponse(
                "A required central database table is missing.",
                503
            );
        }

        return errorResponse(
            "An unexpected error occurred while restoring the archived record.",
            500
        );
    } finally {
        client?.release();
    }
}

/* -------------------------------------------------------------------------- */
/* POST /api/recycle-bin/[id]/restore                                         */
/* -------------------------------------------------------------------------- */

export async function POST(request, context) {
    const {
    tenant,
    response,
    isGlobalSystemAdmin,
} = await authorizeRestore();

    if (response) return response;

    const recycleBinId = await getRecycleBinId(context);

    if (recycleBinId === null) {
        return errorResponse("Invalid Recycle Bin record ID.", 400);
    }

    const companyId = Number(tenant.companyId);

    console.log("========== RESTORE DIAGNOSTICS ==========");
console.log("Requested Recycle Bin ID:", recycleBinId);
console.log("Decoded archive:", recycleBinId < 0
    ? decodeCentralArchiveId(recycleBinId)
    : "Tenant archive");
console.log("Current tenant company ID:", companyId);
console.log("Current user ID:", tenant.user?.userId ?? tenant.user?.user_id);
console.log("Current role ID:", tenant.user?.roleId ?? tenant.user?.role_id);
console.log("=========================================");

    if (!Number.isSafeInteger(companyId) || companyId <= 0) {
        return errorResponse("Invalid company context.", 403);
    }

    if (recycleBinId < 0) {
        const centralArchive = decodeCentralArchiveId(recycleBinId);

        if (!centralArchive) {
            return errorResponse(
                "Invalid central Recycle Bin record ID.",
                400
            );
        }

        if (centralArchive.type === "role") {
            return restoreCentralRole(
                centralArchive.archiveId,
                companyId
            );
        }

        return restoreCentralMembership(
    centralArchive.archiveId,
    companyId,
    isGlobalSystemAdmin
);
    }

    return restoreTenantRecord(
        tenant,
        recycleBinId,
        companyId
    );
}
