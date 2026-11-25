
import { NextResponse } from "next/server";
import { getTenantDb } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { requirePermission } from "@/lib/permissions";
import { archiveAndSoftDelete } from "@/lib/recycle-bin";
import {
    BOM_PERMISSION,
    NO_STORE_HEADERS,
    bomError,
    prepareBomBody,
    positiveId,
    validationError,
} from "@/lib/bom";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

async function getRouteId(context) {
    const params = await context.params;
    return positiveId(params.id, "BOM ID");
}

async function loadBom(client, bomId, companyId) {
    const headerResult = await client.query(
        `
        SELECT
            b.*,
            p.sku AS assembly_product_sku,
            p.product_name AS assembly_product_name,
            p.item_size AS assembly_product_size,
            sp.sku AS assembly_sub_product_sku,
            sp.sub_product_name AS assembly_sub_product_name,
            sp.size AS assembly_sub_product_size
        FROM bill_of_materials b
        LEFT JOIN products p
            ON p.product_id = b.assembly_product_id
        LEFT JOIN sub_products sp
            ON sp.sub_product_id = b.assembly_sub_product_id
        WHERE b.bom_id = $1
          AND b.company_id = $2
          AND b.deleted_at IS NULL
        `,
        [bomId, companyId]
    );

    if (!headerResult.rowCount) {
        throw validationError("Bill of Materials not found.", 404);
    }

    const revisionsResult = await client.query(
        `
        SELECT *
        FROM bom_revisions
        WHERE bom_id = $1
        ORDER BY revision_id
        `,
        [bomId]
    );

    const revisions = [];

    for (const revision of revisionsResult.rows) {
        const componentsResult = await client.query(
            `
            SELECT
                c.*,
                p.sku AS product_sku,
                p.product_name,
                sp.sku AS sub_product_sku,
                sp.sub_product_name
            FROM bom_revision_components c
            LEFT JOIN products p
                ON p.product_id = c.product_id
            LEFT JOIN sub_products sp
                ON sp.sub_product_id = c.sub_product_id
            WHERE c.revision_id = $1
            ORDER BY c.component_id
            `,
            [revision.revision_id]
        );

        const processResult = await client.query(
            `
            SELECT *
            FROM bom_processes
            WHERE revision_id = $1
            LIMIT 1
            `,
            [revision.revision_id]
        );

        let process = null;

        if (processResult.rowCount) {
            const processHeader = processResult.rows[0];

            const stepsResult = await client.query(
                `
                SELECT *
                FROM bom_process_steps
                WHERE process_id = $1
                ORDER BY sequence, process_step_id
                `,
                [processHeader.process_id]
            );

            process = {
                ...processHeader,
                steps: stepsResult.rows,
            };
        }

        revisions.push({
            ...revision,
            components: componentsResult.rows,
            process,
        });
    }

    return {
        ...headerResult.rows[0],
        revisions,
    };
}

async function validateItems(client, data) {
    if (data.assemblyProductId) {
        const result = await client.query(
            `
            SELECT product_id
            FROM products
            WHERE product_id = $1
              AND is_active = TRUE
              AND deleted_at IS NULL
            `,
            [data.assemblyProductId]
        );

        if (!result.rowCount) {
            throw validationError(
                "Selected assembly product was not found or is inactive."
            );
        }
    } else {
        const result = await client.query(
            `
            SELECT sub_product_id
            FROM sub_products
            WHERE sub_product_id = $1
            `,
            [data.assemblySubProductId]
        );

        if (!result.rowCount) {
            throw validationError(
                "Selected assembly sub-product was not found."
            );
        }
    }

    for (const revision of data.revisions) {
        for (const component of revision.components) {
            const result = component.productId
                ? await client.query(
                    `
                    SELECT product_id
                    FROM products
                    WHERE product_id = $1
                      AND is_active = TRUE
                      AND deleted_at IS NULL
                    `,
                    [component.productId]
                )
                : await client.query(
                    `
                    SELECT sub_product_id
                    FROM sub_products
                    WHERE sub_product_id = $1
                    `,
                    [component.subProductId]
                );

            if (!result.rowCount) {
                throw validationError(
                    "One of the selected BOM components was not found or is inactive."
                );
            }
        }
    }
}

async function saveComponents(client, revisionId, components) {
    await client.query(
        `DELETE FROM bom_revision_components WHERE revision_id = $1`,
        [revisionId]
    );

    for (const component of components) {
        await client.query(
            `
            INSERT INTO bom_revision_components (
                revision_id,
                product_id,
                sub_product_id,
                item_description,
                uom,
                bom_quantity,
                quantity_type,
                item_source
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            `,
            [
                revisionId,
                component.productId,
                component.subProductId,
                component.itemDescription,
                component.uom,
                component.bomQuantity,
                component.quantityType,
                component.itemSource,
            ]
        );
    }
}

async function saveProcess(client, revisionId, revision) {
    const existingResult = await client.query(
        `
        SELECT process_id
        FROM bom_processes
        WHERE revision_id = $1
        FOR UPDATE
        `,
        [revisionId]
    );

    if (!revision.hasProcess || !revision.process) {
        if (existingResult.rowCount) {
            await client.query(
                `DELETE FROM bom_processes WHERE revision_id = $1`,
                [revisionId]
            );
        }

        return;
    }

    const process = revision.process;
    let processId;

    if (existingResult.rowCount) {
        processId = existingResult.rows[0].process_id;

        await client.query(
            `
            UPDATE bom_processes
            SET
                process_name = $1,
                location = $2,
                process_description = $3,
                process_memo = $4,
                updated_at = CURRENT_TIMESTAMP
            WHERE process_id = $5
            `,
            [
                process.processName,
                process.location,
                process.processDescription,
                process.processMemo,
                processId,
            ]
        );

        await client.query(
            `DELETE FROM bom_process_steps WHERE process_id = $1`,
            [processId]
        );
    } else {
        const inserted = await client.query(
            `
            INSERT INTO bom_processes (
                revision_id,
                process_name,
                location,
                process_description,
                process_memo
            )
            VALUES ($1, $2, $3, $4, $5)
            RETURNING process_id
            `,
            [
                revisionId,
                process.processName,
                process.location,
                process.processDescription,
                process.processMemo,
            ]
        );

        processId = inserted.rows[0].process_id;
    }

    for (const step of process.steps) {
        await client.query(
            `
            INSERT INTO bom_process_steps (
                process_id,
                sequence,
                operation_name,
                work_center,
                operation_description
            )
            VALUES ($1, $2, $3, $4, $5)
            `,
            [
                processId,
                step.sequence,
                step.operationName,
                step.workCenter,
                step.operationDescription,
            ]
        );
    }
}

export async function GET(request, context) {
    try {
        const user = await getCurrentUser();
        await requirePermission(user, BOM_PERMISSION, "view");

        const bomId = await getRouteId(context);
        const companyId = positiveId(user.companyId, "Company");

        const db = await getTenantDb(user);
        const result = await loadBom(db, bomId, companyId);

        return NextResponse.json(
            { success: true, bom: result },
            { headers: NO_STORE_HEADERS }
        );
    } catch (error) {
        return bomError(error);
    }
}

export async function PUT(request, context) {
    let client;

    try {
        const user = await getCurrentUser();
        await requirePermission(user, BOM_PERMISSION, "update");

        const bomId = await getRouteId(context);
        const companyId = positiveId(user.companyId, "Company");
        const userId = positiveId(user.userId, "User");

        let body;

        try {
            body = await request.json();
        } catch {
            throw validationError("Invalid JSON request body.");
        }

        const data = prepareBomBody(body);
        const db = await getTenantDb(user);

        client = await db.connect();
        await client.query("BEGIN");

        const existingBom = await client.query(
            `
            SELECT bom_id
            FROM bill_of_materials
            WHERE bom_id = $1
              AND company_id = $2
              AND deleted_at IS NULL
            FOR UPDATE
            `,
            [bomId, companyId]
        );

        if (!existingBom.rowCount) {
            throw validationError("Bill of Materials not found.", 404);
        }

        await validateItems(client, data);

        const existingRevisionsResult = await client.query(
            `
            SELECT revision_id
            FROM bom_revisions
            WHERE bom_id = $1
            FOR UPDATE
            `,
            [bomId]
        );

        const existingRevisionIds = new Set(
            existingRevisionsResult.rows.map((row) =>
                Number(row.revision_id)
            )
        );

        const submittedRevisionIds = new Set();

        for (const revision of data.revisions) {
            if (!revision.revisionId) continue;

            if (!existingRevisionIds.has(revision.revisionId)) {
                throw validationError(
                    `Revision ID ${revision.revisionId} does not belong to this BOM.`
                );
            }

            if (submittedRevisionIds.has(revision.revisionId)) {
                throw validationError(
                    "A revision cannot be submitted more than once."
                );
            }

            submittedRevisionIds.add(revision.revisionId);
        }

        await client.query(
            `
            UPDATE bill_of_materials
            SET
                bom_name = $1,
                assembly_product_id = $2,
                assembly_sub_product_id = $3,
                memo = $4,
                unit_of_measure = $5,
                updated_by = $6,
                updated_at = CURRENT_TIMESTAMP
            WHERE bom_id = $7
              AND company_id = $8
              AND deleted_at IS NULL
            `,
            [
                data.bomName,
                data.assemblyProductId,
                data.assemblySubProductId,
                data.memo,
                data.unitOfMeasure,
                userId,
                bomId,
                companyId,
            ]
        );

        for (const revision of data.revisions) {
            let revisionId = revision.revisionId;

            if (revisionId) {
                await client.query(
                    `
                    UPDATE bom_revisions
                    SET
                        revision_name = $1,
                        run_rate = $2,
                        has_process = $3,
                        is_active = TRUE,
                        updated_at = CURRENT_TIMESTAMP
                    WHERE revision_id = $4
                      AND bom_id = $5
                    `,
                    [
                        revision.revisionName,
                        revision.runRate,
                        revision.hasProcess,
                        revisionId,
                        bomId,
                    ]
                );
            } else {
                const inserted = await client.query(
                    `
                    INSERT INTO bom_revisions (
                        bom_id,
                        revision_name,
                        run_rate,
                        has_process,
                        is_active
                    )
                    VALUES ($1, $2, $3, $4, TRUE)
                    RETURNING revision_id
                    `,
                    [
                        bomId,
                        revision.revisionName,
                        revision.runRate,
                        revision.hasProcess,
                    ]
                );

                revisionId = inserted.rows[0].revision_id;
            }

            await saveComponents(client, revisionId, revision.components);
            await saveProcess(client, revisionId, revision);
        }

        const retainedIds = data.revisions
            .filter((revision) => revision.revisionId)
            .map((revision) => revision.revisionId);

        if (retainedIds.length) {
            await client.query(
                `
                DELETE FROM bom_revisions
                WHERE bom_id = $1
                  AND NOT (revision_id = ANY($2::bigint[]))
                `,
                [bomId, retainedIds]
            );
        } else {
            await client.query(
                `DELETE FROM bom_revisions WHERE bom_id = $1`,
                [bomId]
            );
        }

        await client.query("COMMIT");

        return NextResponse.json(
            {
                success: true,
                message: "Bill of Materials updated successfully.",
                bomId,
            },
            { headers: NO_STORE_HEADERS }
        );
    } catch (error) {
        if (client) {
            try {
                await client.query("ROLLBACK");
            } catch (rollbackError) {
                console.error("BOM UPDATE ROLLBACK ERROR:", rollbackError);
            }
        }

        return bomError(error);
    } finally {
        client?.release();
    }
}

export async function DELETE(request, context) {
    try {
        const user = await getCurrentUser();
        await requirePermission(user, BOM_PERMISSION, "delete");

        const bomId = await getRouteId(context);
        const companyId = positiveId(user.companyId, "Company");

        const db = await getTenantDb(user);

        const result = await archiveAndSoftDelete(
            { user, db, companyId },
            {
                moduleKey: "bill_of_materials",
                recordId: bomId,

                validateRecord: async (client, record) => {
                    if (record.deleted_at) {
                        return {
                            status: 404,
                            message: "Bill of Materials not found.",
                        };
                    }

                    // BOMs used by manufacturing transactions must not be archived.
                    const buildsResult = await client.query(
                        `
                        SELECT COUNT(*)::INTEGER AS count
                        FROM assembly_builds
                        WHERE company_id = $1
                          AND bom_id = $2
                        `,
                        [companyId, bomId]
                    );

                    if (Number(buildsResult.rows[0]?.count || 0) > 0) {
                        return {
                            status: 409,
                            message:
                                "This BOM is used by Assembly Builds and cannot be archived.",
                        };
                    }

                    const unbuildsResult = await client.query(
                        `
                        SELECT COUNT(*)::INTEGER AS count
                        FROM assembly_unbuilds
                        WHERE company_id = $1
                          AND bom_id = $2
                        `,
                        [companyId, bomId]
                    );

                    if (Number(unbuildsResult.rows[0]?.count || 0) > 0) {
                        return {
                            status: 409,
                            message:
                                "This BOM is used by Assembly Unbuilds and cannot be archived.",
                        };
                    }

                    return null;
                },
            }
        );

        if (!result.success) {
            throw validationError(
                result.message || "Unable to archive Bill of Materials.",
                result.status || 400
            );
        }

        return NextResponse.json(
            {
                success: true,
                message: "Bill of Materials moved to Recycle Bin.",
                deleted: result.record,
                archiveId: result.archiveId,
            },
            { headers: NO_STORE_HEADERS }
        );
    } catch (error) {
        return bomError(error);
    }
}
