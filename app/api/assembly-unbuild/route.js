
import { NextResponse } from "next/server";
import pool, { getTenantDb } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { requirePermission } from "@/lib/permissions";

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
    return NextResponse.json(
        {
            success: false,
            message,
        },
        { status }
    );
}

function getErrorStatus(error) {
    if (error?.message === "UNAUTHORIZED") return 401;
    if (error?.message === "FORBIDDEN") return 403;

    if (error instanceof ApiError) {
        return error.status;
    }

    return 500;
}

function isValidPositiveNumber(value) {
    const number = Number(value);

    return Number.isFinite(number) && number > 0;
}

function calculateComponentQuantity(
    bomQuantity,
    quantityType,
    unbuildQuantity
) {
    const quantity = Number(bomQuantity || 0);

    if (!Number.isFinite(quantity) || quantity < 0) {
        throw new ApiError("Invalid BOM component quantity.");
    }

    const type = String(quantityType || "QUANTITY")
        .trim()
        .toUpperCase();

    let result;

    if (type === "PERCENTAGE") {
        result = (quantity / 100) * unbuildQuantity;
    } else if (type === "QUANTITY") {
        result = quantity * unbuildQuantity;
    } else {
        throw new ApiError(
            `Unsupported BOM component quantity type: ${type}.`
        );
    }

    if (!Number.isFinite(result) || result < 0) {
        throw new ApiError("Invalid calculated component quantity.");
    }

    return result;
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

// =========================================================
// CENTRAL COMPANY-SPECIFIC ASSEMBLY UNBUILD NUMBER
// =========================================================

async function getNextAssemblyUnbuildNumber(companyId, tenantClient) {
    const safeCompanyId = Number(companyId);

    if (!Number.isInteger(safeCompanyId) || safeCompanyId <= 0) {
        throw new ApiError("Invalid company ID for transaction numbering.");
    }

    const sequenceName =
        `assembly_unbuild_company_${safeCompanyId}_seq`;

    const sequenceReference = `public.${sequenceName}`;

    // Create the central sequence if it does not exist.
    await pool.query(`
        CREATE SEQUENCE IF NOT EXISTS
        public."${sequenceName}"
        START WITH 1
        INCREMENT BY 1
        MINVALUE 1
        NO CYCLE
    `);

    // Read the highest number already used in this tenant.
    // Archived records are included to prevent number reuse.
    const existingResult = await tenantClient.query(
        `
        SELECT COALESCE(
            MAX(SUBSTRING(transaction_number FROM 4)::BIGINT),
            0
        ) AS last_number
        FROM assembly_unbuilds
        WHERE company_id = $1
          AND transaction_number ~ '^AU-[0-9]+$'
        `,
        [safeCompanyId]
    );

    const existingNumber = Number(
        existingResult.rows[0]?.last_number || 0
    );

    // Read the current central sequence position.
    const sequenceResult = await pool.query(
        `
        SELECT last_value, is_called
        FROM public."${sequenceName}"
        `
    );

    const sequenceState = sequenceResult.rows[0];

    const sequenceNumber = sequenceState.is_called
        ? Number(sequenceState.last_value)
        : 0;

    // Synchronize against both existing tenant records
    // and the central sequence.
    const nextNumber =
        Math.max(existingNumber, sequenceNumber) + 1;

    if (!Number.isSafeInteger(nextNumber) || nextNumber <= 0) {
        throw new ApiError(
            "Unable to generate Assembly Unbuild transaction number.",
            500
        );
    }

    await pool.query(
        `
        SELECT setval(
            $1::regclass,
            $2,
            TRUE
        )
        `,
        [sequenceReference, nextNumber]
    );

    return `AU-${String(nextNumber).padStart(6, "0")}`;
}
// =========================================================
// GET: LIST ACTIVE ASSEMBLY UNBUILD TRANSACTIONS
// =========================================================

export async function GET() {
    try {
        const user = await getCurrentUser();

        if (!user) {
            return jsonError("Unauthorized.", 401);
        }

        await requirePermission(user, PERMISSION, "view");

        const companyId = Number(user.companyId);

        if (!Number.isInteger(companyId) || companyId <= 0) {
            return jsonError("Company information is missing.", 400);
        }

        const db = await getTenantDb(user);

        const result = await db.query(
            `
            SELECT
                au.assembly_unbuild_id,
                au.company_id,
                au.transaction_number,
                au.transaction_date,

                au.warehouse_id,
                w.warehouse_name,

                au.bom_id,
                b.bom_name,

                au.revision_id,
                br.revision_name,

                au.assembly_product_id,
                au.assembly_sub_product_id,

                p.product_name AS assembly_product_name,
                p.sku AS assembly_product_sku,

                sp.sub_product_name AS assembly_sub_product_name,
                sp.sku AS assembly_sub_product_sku,

                au.unbuild_quantity,
                au.uom,
                au.status,
                au.component_amount,
                au.finished_unit_cost,
                au.details,
                au.memo,

                au.created_by,
                au.updated_by,
                au.posted_by,
                au.posted_at,
                au.created_at,
                au.updated_at,

                COALESCE(
                    (
                        SELECT COUNT(*)
                        FROM assembly_unbuild_components auc
                        WHERE auc.assembly_unbuild_id =
                            au.assembly_unbuild_id
                    ),
                    0
                ) AS component_count

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

            WHERE au.company_id = $1
              AND au.deleted_at IS NULL

            ORDER BY
                au.transaction_date DESC,
                au.assembly_unbuild_id DESC
            `,
            [companyId]
        );

        return NextResponse.json({
            success: true,
            data: result.rows,
        });
    } catch (error) {
        console.error("ASSEMBLY UNBUILD GET ERROR:", error);

        return jsonError(
            error.message || "Failed to load Assembly Unbuild transactions.",
            getErrorStatus(error)
        );
    }
}

// =========================================================
// POST: CREATE ASSEMBLY UNBUILD DRAFT
// =========================================================

export async function POST(request) {
    let client;
    let transactionStarted = false;

    try {
        const user = await getCurrentUser();

        if (!user) {
            return jsonError("Unauthorized.", 401);
        }

        await requirePermission(user, PERMISSION, "create");

        const companyId = Number(user.companyId);
        const userId = user.userId || null;

        if (!Number.isInteger(companyId) || companyId <= 0) {
            return jsonError("Invalid company information.", 400);
        }

        const body = await request.json();

        const transactionDate =
            body.transactionDate ||
            new Date().toISOString().slice(0, 10);

        const warehouseId = Number(body.warehouseId);
        const bomId = Number(body.bomId);
        const revisionId = Number(body.revisionId);
        const unbuildQuantity = Number(body.unbuildQuantity);

        const details =
            typeof body.details === "string"
                ? body.details.trim() || null
                : null;

        const memo =
            typeof body.memo === "string"
                ? body.memo.trim() || null
                : null;

        // -------------------------------------------------
        // VALIDATION
        // -------------------------------------------------

        if (!isValidDate(transactionDate)) {
            return jsonError("Invalid transaction date.", 400);
        }

        if (!Number.isInteger(warehouseId) || warehouseId <= 0) {
            return jsonError("Please select a valid warehouse.", 400);
        }

        if (!Number.isInteger(bomId) || bomId <= 0) {
            return jsonError("Please select a Bill of Materials.", 400);
        }

        if (!Number.isInteger(revisionId) || revisionId <= 0) {
            return jsonError("Please select a BOM revision.", 400);
        }

        if (!isValidPositiveNumber(unbuildQuantity)) {
            return jsonError(
                "Unbuild quantity must be greater than zero.",
                400
            );
        }

        if (unbuildQuantity > MAX_UNBUILD_QUANTITY) {
            return jsonError("Unbuild quantity is too large.", 400);
        }

        const db = await getTenantDb(user);

        client = await db.connect();

        await client.query("BEGIN");
        transactionStarted = true;

        // -------------------------------------------------
        // VALIDATE ACTIVE WAREHOUSE
        //
        // warehouses does not have company_id.
        // -------------------------------------------------

        const warehouseResult = await client.query(
            `
            SELECT
                warehouse_id,
                warehouse_name,
                is_active
            FROM warehouses
            WHERE warehouse_id = $1
              AND is_active = TRUE
              AND deleted_at IS NULL
            LIMIT 1
            `,
            [warehouseId]
        );

        if (warehouseResult.rows.length === 0) {
            throw new ApiError(
                "Selected warehouse does not exist, is inactive, or has been archived.",
                400
            );
        }

        const warehouse = warehouseResult.rows[0];

        // -------------------------------------------------
        // VALIDATE ACTIVE BOM AND SELECTED ACTIVE REVISION
        // -------------------------------------------------

        const bomResult = await client.query(
            `
            SELECT
                b.bom_id,
                b.company_id,
                b.bom_name,
                b.assembly_product_id,
                b.assembly_sub_product_id,
                b.unit_of_measure,

                br.revision_id,
                br.revision_name,
                br.is_active

            FROM bill_of_materials b

            INNER JOIN bom_revisions br
                ON br.bom_id = b.bom_id

            WHERE b.bom_id = $1
              AND b.company_id = $2
              AND b.deleted_at IS NULL
              AND br.revision_id = $3
              AND br.is_active = TRUE

            FOR SHARE OF b, br
            `,
            [bomId, companyId, revisionId]
        );

        if (bomResult.rows.length === 0) {
            throw new ApiError(
                "The selected BOM or active revision was not found, or the BOM has been archived.",
                404
            );
        }

        const bom = bomResult.rows[0];

        const assemblyProductId = bom.assembly_product_id
            ? Number(bom.assembly_product_id)
            : null;

        const assemblySubProductId = bom.assembly_sub_product_id
            ? Number(bom.assembly_sub_product_id)
            : null;

        if (
            Boolean(assemblyProductId) ===
            Boolean(assemblySubProductId)
        ) {
            throw new ApiError(
                "The selected BOM must have exactly one assembly product or sub-product."
            );
        }

        // -------------------------------------------------
        // VALIDATE ASSEMBLY ITEM
        //
        // products and sub_products do not have company_id.
        // Their IDs are validated through the company-owned BOM.
        // -------------------------------------------------

        if (assemblyProductId) {
            const productResult = await client.query(
                `
                SELECT product_id
                FROM products
                WHERE product_id = $1
                  AND COALESCE(is_active, TRUE) = TRUE
                  AND deleted_at IS NULL
                LIMIT 1
                `,
                [assemblyProductId]
            );

            if (productResult.rows.length === 0) {
                throw new ApiError(
                    "The assembly product linked to this BOM was not found, is inactive, or has been archived."
                );
            }
        }

        if (assemblySubProductId) {
            const subProductResult = await client.query(
                `
                SELECT sub_product_id, product_id
                FROM sub_products
                WHERE sub_product_id = $1
                LIMIT 1
                `,
                [assemblySubProductId]
            );

            if (subProductResult.rows.length === 0) {
                throw new ApiError(
                    "The assembly sub-product linked to this BOM was not found."
                );
            }
        }

        // -------------------------------------------------
        // LOAD COMPONENTS FROM EXACT SELECTED REVISION
        // -------------------------------------------------

        const componentsResult = await client.query(
            `
            SELECT
                bc.component_id,
                bc.product_id,
                bc.sub_product_id,
                bc.item_description,
                bc.uom,
                bc.bom_quantity,
                bc.quantity_type,
                bc.item_source,

                p.product_name,
                p.sku AS product_sku,

                sp.sub_product_name,
                sp.sku AS sub_product_sku

            FROM bom_revision_components bc

            LEFT JOIN products p
                ON p.product_id = bc.product_id

            LEFT JOIN sub_products sp
                ON sp.sub_product_id = bc.sub_product_id

            WHERE bc.revision_id = $1

            ORDER BY bc.component_id
            `,
            [revisionId]
        );

        if (componentsResult.rows.length === 0) {
            throw new ApiError(
                "The selected BOM revision does not contain any components."
            );
        }

        // -------------------------------------------------
        // PREPARE COMPONENT SNAPSHOTS
        // -------------------------------------------------

        const componentSnapshots = [];
        let componentAmount = 0;

        for (const component of componentsResult.rows) {
            const productId = component.product_id
                ? Number(component.product_id)
                : null;

            const subProductId = component.sub_product_id
                ? Number(component.sub_product_id)
                : null;

            if (
                Boolean(productId) === Boolean(subProductId)
            ) {
                throw new ApiError(
                    `Invalid product configuration for BOM component ${component.component_id}.`
                );
            }

            if (productId) {
                const productResult = await client.query(
                    `
                    SELECT product_id
                    FROM products
                    WHERE product_id = $1
                      AND COALESCE(is_active, TRUE) = TRUE
                      AND deleted_at IS NULL
                    LIMIT 1
                    `,
                    [productId]
                );

                if (productResult.rows.length === 0) {
                    throw new ApiError(
                        `Product for BOM component ${component.component_id} was not found, is inactive, or has been archived.`
                    );
                }
            }

            if (subProductId) {
                const subProductResult = await client.query(
                    `
                    SELECT sub_product_id, product_id
                    FROM sub_products
                    WHERE sub_product_id = $1
                    LIMIT 1
                    `,
                    [subProductId]
                );

                if (subProductResult.rows.length === 0) {
                    throw new ApiError(
                        `Sub-product for BOM component ${component.component_id} was not found.`
                    );
                }
            }

            const bomQuantity = Number(component.bom_quantity || 0);

            if (
                !Number.isFinite(bomQuantity) ||
                bomQuantity < 0
            ) {
                throw new ApiError(
                    `Invalid BOM quantity for component ${component.component_id}.`
                );
            }

            const quantityType = String(
                component.quantity_type || "QUANTITY"
            ).toUpperCase();

            const requiredQuantity = calculateComponentQuantity(
                bomQuantity,
                quantityType,
                unbuildQuantity
            );

            // Company-scoped stock lookup.
            // These stock tables have company_id.
            const itemBalance = await getItemBalance(
                client,
                companyId,
                warehouseId,
                productId,
                subProductId
            );

            const itemDescription =
                component.item_description ||
                component.sub_product_name ||
                component.product_name ||
                "BOM Component";

            // Cost is initially zero.
            // No accounting entries are generated by this draft.
            const unitCost = 0;
            const amount = requiredQuantity * unitCost;

            componentAmount += amount;

            componentSnapshots.push({
                componentId: component.component_id,
                productId,
                subProductId,
                itemDescription,
                uom: component.uom || null,
                itemBalance,
                bomQuantity,
                quantityType,
                itemSource: component.item_source || null,
                requiredQuantity,
                returnedQuantity: requiredQuantity,
                unitCost,
                amount,
            });
        }

        // -------------------------------------------------
        // GENERATE COMPANY-SPECIFIC TRANSACTION NUMBER
        // Include archived records to prevent number reuse.
        // -------------------------------------------------

        // -------------------------------------------------
// GENERATE COMPANY-SPECIFIC TRANSACTION NUMBER
// Central sequence + tenant advisory lock.
// -------------------------------------------------

await client.query(
    `
    SELECT pg_advisory_xact_lock(
        $1::integer,
        hashtext('assembly_unbuild')::integer
    )
    `,
    [companyId]
);

const transactionNumber =
    await getNextAssemblyUnbuildNumber(companyId, client);

        // -------------------------------------------------
        // CREATE DRAFT HEADER
        // -------------------------------------------------

        const headerResult = await client.query(
            `
            INSERT INTO assembly_unbuilds (
                company_id,
                transaction_number,
                transaction_date,
                warehouse_id,
                bom_id,
                revision_id,
                assembly_product_id,
                assembly_sub_product_id,
                unbuild_quantity,
                uom,
                details,
                memo,
                status,
                component_amount,
                finished_unit_cost,
                created_by,
                updated_by
            )
            VALUES (
                $1, $2, $3, $4, $5, $6,
                $7, $8, $9, $10, $11, $12,
                'DRAFT', $13, 0, $14, $14
            )
            RETURNING *
            `,
            [
                companyId,
                transactionNumber,
                transactionDate,
                warehouseId,
                bomId,
                revisionId,
                assemblyProductId,
                assemblySubProductId,
                unbuildQuantity,
                bom.unit_of_measure || null,
                details,
                memo,
                componentAmount,
                userId,
            ]
        );

        const unbuild = headerResult.rows[0];

        // -------------------------------------------------
        // INSERT SAVED BOM COMPONENT SNAPSHOTS
        // -------------------------------------------------

        for (const component of componentSnapshots) {
            await client.query(
                `
                INSERT INTO assembly_unbuild_components (
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
                    amount
                )
                VALUES (
                    $1, $2, $3, $4, $5, $6, $7,
                    $8, $9, $10, $11, $12, $13, $14
                )
                `,
                [
                    unbuild.assembly_unbuild_id,
                    component.componentId,
                    component.productId,
                    component.subProductId,
                    component.itemDescription,
                    component.uom,
                    component.itemBalance,
                    component.bomQuantity,
                    component.quantityType,
                    component.itemSource,
                    component.requiredQuantity,
                    component.returnedQuantity,
                    component.unitCost,
                    component.amount,
                ]
            );
        }

        // -------------------------------------------------
        // COMMIT
        // -------------------------------------------------

        await client.query("COMMIT");
        transactionStarted = false;

        return NextResponse.json(
            {
                success: true,
                message: "Assembly Unbuild draft created successfully.",
                data: {
                    ...unbuild,
                    warehouse_name: warehouse.warehouse_name,
                    bom_name: bom.bom_name,
                    revision_name: bom.revision_name,
                    components: componentSnapshots,
                },
            },
            { status: 201 }
        );
    } catch (error) {
        if (client && transactionStarted) {
            try {
                await client.query("ROLLBACK");
            } catch (rollbackError) {
                console.error(
                    "ASSEMBLY UNBUILD ROLLBACK ERROR:",
                    rollbackError
                );
            }
        }

        console.error("ASSEMBLY UNBUILD POST ERROR:", error);

        return jsonError(
            error.message || "Failed to create Assembly Unbuild draft.",
            getErrorStatus(error)
        );
    } finally {
        if (client) {
            client.release();
        }
    }
}
