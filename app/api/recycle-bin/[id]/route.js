
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
    permanentlyDeleteUserCompanyMembership,
} from "@/lib/user-company-recycle-bin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const PERMISSION_KEY = "recycle_bin";
const ROLE_ID_OFFSET = 1_000_000_000_000;

/* -------------------------------------------------------------------------- */
/* Tenant module whitelist                                                    */
/* -------------------------------------------------------------------------- */

const PERMANENT_DELETE_MODULES = Object.freeze({
    customers: {
        table: "customers",
        idColumn: "customer_id",
        label: "Customer",
    },
    product_categories: {
        table: "product_categories",
        idColumn: "category_id",
        label: "Product category",
    },
    products: {
        table: "products",
        idColumn: "product_id",
        label: "Product",
    },
    product_units: {
        table: "product_units",
        idColumn: "unit_id",
        label: "Packaging unit",
    },
    suppliers: {
        table: "suppliers",
        idColumn: "supplier_id",
        label: "Supplier",
    },
    units_of_measure: {
        table: "units_of_measure",
        idColumn: "unit_id",
        label: "Unit of measure",
    },
    warehouses: {
        table: "warehouses",
        idColumn: "warehouse_id",
        label: "Warehouse",
    },
    sales_quotations: {
        table: "sales_quotations",
        idColumn: "quotation_id",
        label: "Sales quotation",
    },
    sales_orders: {
        table: "sales_orders",
        idColumn: "order_id",
        label: "Sales order",
    },
    delivery_challans: {
        table: "delivery_challans",
        idColumn: "delivery_challan_id",
        label: "Delivery challan",
    },
    sales_returns: {
        table: "sales_returns",
        idColumn: "return_id",
        label: "Sales return",
    },
    purchase_requisitions: {
        table: "purchase_requisitions",
        idColumn: "requisition_id",
        label: "Purchase requisition",
    },
    procurement_requisitions: {
        table: "procurement_requisitions",
        idColumn: "procurement_requisition_id",
        label: "Procurement requisition",
    },
    purchase_quotations: {
        table: "purchase_quotations",
        idColumn: "purchase_quotation_id",
        label: "Purchase quotation",
    },
    rfqs: {
        table: "rfqs",
        idColumn: "rfq_id",
        label: "RFQ",
    },
    purchase_orders: {
        table: "purchase_orders",
        idColumn: "purchase_order_id",
        label: "Purchase order",
    },
    pending_item_receipts: {
        table: "pending_item_receipts",
        idColumn: "pending_item_receipt_id",
        label: "Pending Item Receipt",
    },
    item_receipts: {
        table: "item_receipts",
        idColumn: "item_receipt_id",
        label: "Item Receipt",
    },
    assembly_build: {
        table: "assembly_builds",
        idColumn: "assembly_build_id",
        label: "Assembly Build",
    },
    assembly_unbuild: {
        table: "assembly_unbuilds",
        idColumn: "assembly_unbuild_id",
        label: "Assembly Unbuild",
    },
    bill_of_materials: {
        table: "bill_of_materials",
        idColumn: "bom_id",
        label: "Bill of Materials",
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

async function authorizePermanentDelete() {
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
            "delete"
        );

        if (!allowed) {
            return {
                tenant: null,
                response: errorResponse(
                    "You do not have permission to permanently delete archived records.",
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
/* Central user-company membership permanent deletion                        */
/* -------------------------------------------------------------------------- */

async function permanentlyDeleteCentralMembership(
    archiveId,
    companyId
) {
    let client;
    let transactionStarted = false;

    try {
        client = await pool.connect();

        await client.query("BEGIN");
        transactionStarted = true;

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
              AND company_id = $2
              AND module_key = 'user_company_memberships'
              AND source_table = 'user_companies'
            FOR UPDATE
            `,
            [archiveId, companyId]
        );

        if (archiveResult.rowCount !== 1) {
            await client.query("ROLLBACK");
            transactionStarted = false;

            return errorResponse(
                "Archived company membership not found.",
                404
            );
        }

        const archived = archiveResult.rows[0];

        const membershipResult = await client.query(
            `
            SELECT
                user_id,
                company_id,
                deleted_at
            FROM public.user_companies
            WHERE user_id = $1
              AND company_id = $2
            FOR UPDATE
            `,
            [archived.user_id, archived.company_id]
        );

        if (membershipResult.rowCount !== 1) {
            await client.query("ROLLBACK");
            transactionStarted = false;

            return errorResponse(
                "The original company membership no longer exists. The archive entry has been preserved.",
                409
            );
        }

        if (membershipResult.rows[0].deleted_at == null) {
            await client.query("ROLLBACK");
            transactionStarted = false;

            return errorResponse(
                "This company membership is active. Archive it before permanent deletion.",
                409
            );
        }

        const result = await permanentlyDeleteUserCompanyMembership(
            client,
            {
                archiveId,
                companyId,
            }
        );

        await client.query("COMMIT");
        transactionStarted = false;

        return successResponse({
            success: true,
            message: "User company membership permanently deleted.",
            recycleBinId: -archiveId,
            module: "user_company_memberships",
            recordId: Number(archived.user_id),
            companyId: Number(archived.company_id),
            recordLabel: archived.record_label,
            ...result,
        });
    } catch (error) {
        if (client && transactionStarted) {
            await client.query("ROLLBACK").catch((rollbackError) => {
                console.error(
                    "CENTRAL MEMBERSHIP DELETE ROLLBACK ERROR:",
                    rollbackError
                );
            });
        }

        console.error(
            "CENTRAL MEMBERSHIP PERMANENT DELETE ERROR:",
            error
        );

        if (error.code === "23503") {
            return errorResponse(
                "This membership is linked to existing records. Resolve the dependent records first. The archive entry has been preserved.",
                409
            );
        }

        if (error.code === "42P01") {
            return errorResponse(
                "The central membership Recycle Bin table is missing. Apply its migration first.",
                503
            );
        }

        if (error.status) {
            return errorResponse(error.message, error.status);
        }

        return errorResponse(
            "An unexpected error occurred while permanently deleting the company membership.",
            500
        );
    } finally {
        client?.release();
    }
}

/* -------------------------------------------------------------------------- */
/* Central role permanent deletion                                            */
/* -------------------------------------------------------------------------- */

async function permanentlyDeleteCentralRole(archiveId, companyId) {
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
                "The original role no longer exists. The archive entry has been preserved.",
                409
            );
        }

        if (roleResult.rows[0].deleted_at == null) {
            await client.query("ROLLBACK");
            transactionStarted = false;

            return errorResponse(
                "This role is active. Archive it before permanent deletion.",
                409
            );
        }

        /*
         * Both active and archived memberships are checked.
         * A role cannot be permanently deleted while referenced.
         */
        const referenceResult = await client.query(
            `
            SELECT
                (
                    SELECT COUNT(*)
                    FROM public.user_companies
                    WHERE role_id = $1
                ) AS membership_count,
                (
                    SELECT COUNT(*)
                    FROM public.users
                    WHERE role_id = $1
                ) AS user_count
            `,
            [roleId]
        );

        const membershipCount = Number(
            referenceResult.rows[0].membership_count
        );

        const userCount = Number(
            referenceResult.rows[0].user_count
        );

        if (membershipCount > 0 || userCount > 0) {
            await client.query("ROLLBACK");
            transactionStarted = false;

            return errorResponse(
                "This role is still assigned to users or company memberships. Reassign those references before permanently deleting the role.",
                409
            );
        }

        const deleteRoleResult = await client.query(
            `
            DELETE FROM public.roles
            WHERE role_id = $1
              AND company_id = $2
              AND is_system_role = FALSE
              AND deleted_at IS NOT NULL
            RETURNING role_id
            `,
            [roleId, companyId]
        );

        if (deleteRoleResult.rowCount !== 1) {
            throw new Error("The archived role could not be deleted.");
        }

        const deleteArchiveResult = await client.query(
            `
            DELETE FROM public.role_recycle_bin_items
            WHERE recycle_bin_id = $1
              AND company_id = $2
            RETURNING recycle_bin_id
            `,
            [archiveId, companyId]
        );

        if (deleteArchiveResult.rowCount !== 1) {
            throw new Error(
                "The role archive entry could not be removed."
            );
        }

        await client.query("COMMIT");
        transactionStarted = false;

        invalidateRolePermissions(roleId);

        return successResponse({
            success: true,
            message: "Role permanently deleted.",
            recycleBinId: -(ROLE_ID_OFFSET + archiveId),
            module: "roles",
            recordId: roleId,
            recordLabel: archived.record_label,
        });
    } catch (error) {
        if (client && transactionStarted) {
            await client.query("ROLLBACK").catch((rollbackError) => {
                console.error(
                    "ROLE DELETE ROLLBACK ERROR:",
                    rollbackError
                );
            });
        }

        console.error(
            "CENTRAL ROLE PERMANENT DELETE ERROR:",
            error
        );

        if (error.code === "23503") {
            return errorResponse(
                "This role is linked to existing records. Resolve the dependencies first. The archive entry has been preserved.",
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
            "An unexpected error occurred while permanently deleting the role.",
            500
        );
    } finally {
        client?.release();
    }
}

/* -------------------------------------------------------------------------- */
/* Tenant permanent deletion                                                  */
/* -------------------------------------------------------------------------- */

async function permanentlyDeleteTenantRecord(
    tenant,
    recycleBinId,
    companyId
) {
    let client;
    let transactionStarted = false;

    try {
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
        const config = PERMANENT_DELETE_MODULES[archived.module_key];

        if (!config || archived.source_table !== config.table) {
            await client.query("ROLLBACK");
            transactionStarted = false;

            return errorResponse(
                "Permanent deletion is not supported for this module.",
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
              AND company_id = $2
            FOR UPDATE
            `,
            [recordId, companyId]
        );

        if (originalResult.rowCount !== 1) {
            await client.query("ROLLBACK");
            transactionStarted = false;

            return errorResponse(
                "The original record no longer exists in this company. The archive entry has been preserved.",
                409
            );
        }

        if (originalResult.rows[0].deleted_at == null) {
            await client.query("ROLLBACK");
            transactionStarted = false;

            return errorResponse(
                "This record is active. Archive it correctly before permanent deletion.",
                409
            );
        }

        const deleteResult = await client.query(
            `
            DELETE FROM public.${config.table}
            WHERE ${config.idColumn} = $1
              AND company_id = $2
              AND deleted_at IS NOT NULL
            RETURNING ${config.idColumn}
            `,
            [recordId, companyId]
        );

        if (deleteResult.rowCount !== 1) {
            await client.query("ROLLBACK");
            transactionStarted = false;

            return errorResponse(
                "The original record could not be permanently deleted.",
                409
            );
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
                "The Recycle Bin entry could not be removed."
            );
        }

        await client.query("COMMIT");
        transactionStarted = false;

        return successResponse({
            success: true,
            message: `${config.label} permanently deleted.`,
            recycleBinId,
            module: archived.module_key,
            recordId,
            recordLabel: archived.record_label,
        });
    } catch (error) {
        if (client && transactionStarted) {
            await client.query("ROLLBACK").catch((rollbackError) => {
                console.error(
                    "PERMANENT DELETE ROLLBACK ERROR:",
                    rollbackError
                );
            });
        }

        console.error(
            "RECYCLE BIN PERMANENT DELETE ERROR:",
            error
        );

        if (error.code === "23503") {
            return errorResponse(
                "This record is linked to existing business records. Resolve the dependent records before permanently deleting it. The archive entry has been preserved.",
                409
            );
        }

        if (error.code === "23505") {
            return errorResponse(
                "A database constraint prevents this permanent deletion. The archive entry has been preserved.",
                409
            );
        }

        if (error.code === "42P01") {
            return errorResponse(
                "The tenant Recycle Bin table is missing. Apply the required tenant migrations first.",
                503
            );
        }

        return errorResponse(
            "An unexpected error occurred while permanently deleting the archived record.",
            500
        );
    } finally {
        client?.release();
    }
}

/* -------------------------------------------------------------------------- */
/* DELETE /api/recycle-bin/[id]                                               */
/* -------------------------------------------------------------------------- */

export async function DELETE(request, context) {
    const { tenant, response } =
        await authorizePermanentDelete();

    if (response) return response;

    const recycleBinId = await getRecycleBinId(context);

    if (recycleBinId === null) {
        return errorResponse("Invalid Recycle Bin record ID.", 400);
    }

    const companyId = Number(tenant.companyId);

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
            return permanentlyDeleteCentralRole(
                centralArchive.archiveId,
                companyId
            );
        }

        return permanentlyDeleteCentralMembership(
            centralArchive.archiveId,
            companyId
        );
    }

    return permanentlyDeleteTenantRecord(
        tenant,
        recycleBinId,
        companyId
    );
}
