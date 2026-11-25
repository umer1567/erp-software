
import { NextResponse } from "next/server";
import { getTenantDb } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { requirePermission } from "@/lib/permissions";
import { archiveAndSoftDelete } from "@/lib/recycle-bin";

export const dynamic = "force-dynamic";

const PERMISSION = "assembly_unbuild";
const MAX_UNBUILD_QUANTITY = 1000000000;

class ApiError extends Error {
    constructor(message, status = 400) {
        super(message);
        this.name = "ApiError";
        this.status = status;
    }
}

function jsonError(message, status = 500) {
    return NextResponse.json({ success: false, message }, { status });
}

function getErrorStatus(error) {
    if (error?.message === "UNAUTHORIZED") return 401;
    if (error?.message === "FORBIDDEN") return 403;
    if (error instanceof ApiError) return error.status;
    return 500;
}

function isValidDate(value) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value || ""))) {
        return false;
    }

    const date = new Date(`${value}T00:00:00.000Z`);

    return (
        !Number.isNaN(date.getTime()) &&
        date.toISOString().slice(0, 10) === value
    );
}

function isValidPositiveNumber(value) {
    const number = Number(value);

    return (
        Number.isFinite(number) &&
        number > 0 &&
        number <= MAX_UNBUILD_QUANTITY
    );
}

function calculateComponentQuantity(
    bomQuantity,
    quantityType,
    unbuildQuantity
) {
    const quantity = Number(bomQuantity || 0);

    if (!Number.isFinite(quantity) || quantity < 0) {
        throw new ApiError("Invalid saved BOM component quantity.");
    }

    const type = String(quantityType || "QUANTITY")
        .trim()
        .toUpperCase();

    if (type === "PERCENTAGE") {
        return (quantity / 100) * unbuildQuantity;
    }

    if (type === "QUANTITY") {
        return quantity * unbuildQuantity;
    }

    throw new ApiError(
        `Unsupported saved BOM quantity type: ${type}.`
    );
}

async function getId(context) {
    const params = await context.params;
    const id = Number(params?.id);

    if (!Number.isInteger(id) || id <= 0) {
        throw new ApiError("Invalid Assembly Unbuild ID.", 400);
    }

    return id;
}

async function getCurrentRecord(client, id, companyId, lock = false) {
    const result = await client.query(
        `
        SELECT
            au.*,
            w.warehouse_name,
            b.bom_name,
            br.revision_name,
            p.product_name AS assembly_product_name,
            p.sku AS assembly_product_sku,
            sp.sub_product_name AS assembly_sub_product_name,
            sp.sku AS assembly_sub_product_sku
        FROM assembly_unbuilds au
        LEFT JOIN warehouses w
            ON w.warehouse_id = au.warehouse_id
        LEFT JOIN bill_of_materials b
            ON b.bom_id = au.bom_id
           AND b.company_id = au.company_id
        LEFT JOIN bom_revisions br
            ON br.revision_id = au.revision_id
           AND br.bom_id = au.bom_id
        LEFT JOIN products p
            ON p.product_id = au.assembly_product_id
        LEFT JOIN sub_products sp
            ON sp.sub_product_id = au.assembly_sub_product_id
        WHERE au.assembly_unbuild_id = $1
          AND au.company_id = $2
          AND au.deleted_at IS NULL
        ${lock ? "FOR UPDATE OF au" : ""}
        `,
        [id, companyId]
    );

    return result.rows[0] || null;
}

async function getComponents(client, id) {
    const result = await client.query(
        `
        SELECT
            assembly_unbuild_component_id,
            assembly_unbuild_id,
            component_id,
            product_id,
            sub_product_id,
            item_description,
            uom,
            item_balance,
            bom_quantity,
            quantity_type,
            item_source,
            required_quantity,
            returned_quantity,
            unit_cost,
            amount,
            details
        FROM assembly_unbuild_components
        WHERE assembly_unbuild_id = $1
        ORDER BY assembly_unbuild_component_id
        `,
        [id]
    );

    return result.rows;
}

// =========================================================
// GET: ASSEMBLY UNBUILD DETAIL
// =========================================================

export async function GET(request, context) {
    try {
        const user = await getCurrentUser();

        if (!user) {
            return jsonError("Unauthorized.", 401);
        }

        await requirePermission(user, PERMISSION, "view");

        const companyId = Number(user.companyId);

        if (!Number.isInteger(companyId) || companyId <= 0) {
            return jsonError("Invalid company information.", 400);
        }

        const id = await getId(context);
        const db = await getTenantDb(user);

        const record = await getCurrentRecord(db, id, companyId);

        if (!record) {
            return jsonError(
                "Assembly Unbuild transaction was not found.",
                404
            );
        }

        const components = await getComponents(db, id);

        return NextResponse.json({
            success: true,
            data: {
                ...record,
                components,
            },
        });
    } catch (error) {
        console.error("ASSEMBLY UNBUILD DETAIL GET ERROR:", error);

        return jsonError(
            error.message || "Unable to load Assembly Unbuild detail.",
            getErrorStatus(error)
        );
    }
}

// =========================================================
// PATCH: UPDATE ACTIVE DRAFT ONLY
// =========================================================

export async function PATCH(request, context) {
    let client;
    let transactionStarted = false;

    try {
        const user = await getCurrentUser();

        if (!user) {
            return jsonError("Unauthorized.", 401);
        }

        await requirePermission(user, PERMISSION, "update");

        const companyId = Number(user.companyId);
        const userId = user.userId || null;

        if (!Number.isInteger(companyId) || companyId <= 0) {
            return jsonError("Invalid company information.", 400);
        }

        const id = await getId(context);
        const body = await request.json();
        const db = await getTenantDb(user);

        client = await db.connect();

        await client.query("BEGIN");
        transactionStarted = true;

        const record = await getCurrentRecord(
            client,
            id,
            companyId,
            true
        );

        if (!record) {
            throw new ApiError(
                "Assembly Unbuild transaction was not found.",
                404
            );
        }

        if (
            String(record.status).toUpperCase() !== "DRAFT" ||
            record.posted_at
        ) {
            throw new ApiError(
                "Only unapproved Assembly Unbuild drafts can be edited.",
                409
            );
        }

        const transactionDate =
            body.transactionDate !== undefined
                ? body.transactionDate
                : String(record.transaction_date).slice(0, 10);

        const unbuildQuantity =
            body.unbuildQuantity !== undefined
                ? Number(body.unbuildQuantity)
                : Number(record.unbuild_quantity);

        const memo =
            body.memo !== undefined
                ? (
                    typeof body.memo === "string"
                        ? body.memo.trim() || null
                        : null
                )
                : record.memo;

        const details =
            body.details !== undefined
                ? (
                    typeof body.details === "string"
                        ? body.details.trim() || null
                        : null
                )
                : record.details;

        if (!isValidDate(transactionDate)) {
            throw new ApiError("Invalid transaction date.");
        }

        if (!isValidPositiveNumber(unbuildQuantity)) {
            throw new ApiError(
                "Unbuild quantity must be greater than zero and within the allowed limit."
            );
        }

        const components = await client.query(
            `
            SELECT
                assembly_unbuild_component_id,
                bom_quantity,
                quantity_type,
                unit_cost
            FROM assembly_unbuild_components
            WHERE assembly_unbuild_id = $1
            ORDER BY assembly_unbuild_component_id
            FOR UPDATE
            `,
            [id]
        );

        if (components.rows.length === 0) {
            throw new ApiError(
                "This Assembly Unbuild draft has no saved BOM components."
            );
        }

        // Recalculate using the saved BOM component snapshots.
        // Do not reload a newer BOM revision.

        let componentAmount = 0;

        for (const component of components.rows) {
            const returnedQuantity = calculateComponentQuantity(
                component.bom_quantity,
                component.quantity_type,
                unbuildQuantity
            );

            const unitCost = Number(component.unit_cost || 0);

            if (!Number.isFinite(unitCost) || unitCost < 0) {
                throw new ApiError(
                    "Invalid saved component unit cost."
                );
            }

            const amount = returnedQuantity * unitCost;
            componentAmount += amount;

            await client.query(
                `
                UPDATE assembly_unbuild_components
                SET
                    required_quantity = $1,
                    returned_quantity = $1,
                    amount = $2
                WHERE assembly_unbuild_component_id = $3
                  AND assembly_unbuild_id = $4
                `,
                [
                    returnedQuantity,
                    amount,
                    component.assembly_unbuild_component_id,
                    id,
                ]
            );
        }

        const updatedResult = await client.query(
            `
            UPDATE assembly_unbuilds
            SET
                transaction_date = $1,
                unbuild_quantity = $2,
                memo = $3,
                details = $4,
                component_amount = $5,
                updated_by = $6,
                updated_at = CURRENT_TIMESTAMP
            WHERE assembly_unbuild_id = $7
              AND company_id = $8
              AND deleted_at IS NULL
              AND UPPER(status) = 'DRAFT'
              AND posted_at IS NULL
            RETURNING *
            `,
            [
                transactionDate,
                unbuildQuantity,
                memo,
                details,
                componentAmount,
                userId,
                id,
                companyId,
            ]
        );

        if (updatedResult.rows.length === 0) {
            throw new ApiError(
                "Assembly Unbuild draft could not be updated.",
                409
            );
        }

        const updatedComponents = await getComponents(client, id);

        await client.query("COMMIT");
        transactionStarted = false;

        return NextResponse.json({
            success: true,
            message: "Assembly Unbuild draft updated successfully.",
            data: {
                ...updatedResult.rows[0],
                components: updatedComponents,
            },
        });
    } catch (error) {
        if (client && transactionStarted) {
            try {
                await client.query("ROLLBACK");
            } catch (rollbackError) {
                console.error(
                    "ASSEMBLY UNBUILD PATCH ROLLBACK ERROR:",
                    rollbackError
                );
            }
        }

        console.error("ASSEMBLY UNBUILD PATCH ERROR:", error);

        return jsonError(
            error.message || "Unable to update Assembly Unbuild draft.",
            getErrorStatus(error)
        );
    } finally {
        if (client) {
            client.release();
        }
    }
}

// =========================================================
// DELETE: ARCHIVE DRAFT ONLY
// Preserve all component snapshots.
// =========================================================

export async function DELETE(request, context) {
    try {
        const user = await getCurrentUser();

        if (!user) {
            return jsonError("Unauthorized.", 401);
        }

        await requirePermission(user, PERMISSION, "delete");

        const companyId = Number(user.companyId);

        if (!Number.isInteger(companyId) || companyId <= 0) {
            return jsonError("Invalid company information.", 400);
        }

        const id = await getId(context);
        const db = await getTenantDb(user);

        const result = await archiveAndSoftDelete(
            { user, db, companyId },
            {
                moduleKey: "assembly_unbuild",
                recordId: id,
                deletionReason: "Assembly Unbuild archived by user.",
                validateRecord: async (client, record) => {
                    if (
                        String(record.status).toUpperCase() !== "DRAFT" ||
                        record.posted_at
                    ) {
                        return {
                            status: 409,
                            message:
                                "Only unapproved, unposted Assembly Unbuild drafts can be archived.",
                        };
                    }

                    return null;
                },
            }
        );

        return NextResponse.json({
            success: true,
            message:
                result.message ||
                "Assembly Unbuild draft archived successfully.",
            archiveId: result.archiveId,
        });
    } catch (error) {
        console.error("ASSEMBLY UNBUILD ARCHIVE ERROR:", error);

        return jsonError(
            error.message || "Unable to archive Assembly Unbuild draft.",
            getErrorStatus(error)
        );
    }
}
