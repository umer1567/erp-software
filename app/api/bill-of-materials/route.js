
import { NextResponse } from "next/server";
import pool, { getTenantDb } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { requirePermission, hasPermission } from "@/lib/permissions";
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

async function getNextBomNumber(companyId, tenantClient) {
    const numericCompanyId = Number(companyId);

    if (
        !Number.isSafeInteger(numericCompanyId) ||
        numericCompanyId <= 0
    ) {
        throw validationError("Invalid company ID for BOM numbering.");
    }

    const sequenceName = `bom_company_${numericCompanyId}_seq`;

    await pool.query(`
        CREATE SEQUENCE IF NOT EXISTS public."${sequenceName}"
        START WITH 1
        INCREMENT BY 1
    `);

    for (let attempt = 0; attempt < 1000; attempt++) {
        const sequenceResult = await pool.query(
            `SELECT nextval($1::regclass)::TEXT AS sequence_value`,
            [`public.${sequenceName}`]
        );

        const bomNumber =
            `BOM-${String(sequenceResult.rows[0].sequence_value).padStart(6, "0")}`;

        // Include soft-deleted BOMs so their numbers are never reused.
        const existingResult = await tenantClient.query(
            `
            SELECT 1
            FROM bill_of_materials
            WHERE company_id = $1
              AND bom_number = $2
            LIMIT 1
            `,
            [numericCompanyId, bomNumber]
        );

        if (existingResult.rowCount === 0) {
            return bomNumber;
        }
    }

    throw new Error("Could not generate a unique BOM number.");
}
async function insertRevision(client, bomId, revision) {
    const revisionResult = await client.query(
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
        [bomId, revision.revisionName, revision.runRate, revision.hasProcess]
    );

    const revisionId = revisionResult.rows[0].revision_id;

    for (const component of revision.components) {
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

    if (revision.hasProcess && revision.process) {
        const process = revision.process;

        const processResult = await client.query(
            `
            INSERT INTO bom_processes (
                revision_id,
                process_name,
                location,
                process_description,
                process_memo,
                created_at,
                updated_at
            )
            VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
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

        const processId = processResult.rows[0].process_id;

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
}

export async function GET() {
    try {
        const user = await getCurrentUser();
        await requirePermission(user, BOM_PERMISSION, "view");

        if (!user?.companyId) {
            throw validationError("Company information is missing.");
        }

        const companyId = positiveId(user.companyId, "Company");
        const db = await getTenantDb(user);

        const [result, canCreate, canUpdate, canDelete] = await Promise.all([
            db.query(
                `
                SELECT
                    b.bom_id,
                    b.bom_number,
                    b.bom_name,
                    b.memo,
                    b.unit_of_measure,
                    b.created_at,
                    b.updated_at,
                    b.assembly_product_id,
                    b.assembly_sub_product_id,
                    p.sku AS assembly_product_sku,
                    p.product_name AS assembly_product_name,
                    p.item_size AS assembly_product_size,
                    sp.sku AS assembly_sub_product_sku,
                    sp.sub_product_name AS assembly_sub_product_name,
                    sp.size AS assembly_sub_product_size,
                    COALESCE(p.item_size, sp.size) AS assembly_item_size,
                    COALESCE(rc.revision_count, 0)::INTEGER AS revision_count,
                    COALESCE(cc.component_count, 0)::INTEGER AS component_count
                FROM bill_of_materials b
                LEFT JOIN products p
                    ON p.product_id = b.assembly_product_id
                LEFT JOIN sub_products sp
                    ON sp.sub_product_id = b.assembly_sub_product_id
                LEFT JOIN (
                    SELECT bom_id, COUNT(*) AS revision_count
                    FROM bom_revisions
                    GROUP BY bom_id
                ) rc ON rc.bom_id = b.bom_id
                LEFT JOIN (
                    SELECT br.bom_id, COUNT(brc.component_id) AS component_count
                    FROM bom_revisions br
                    LEFT JOIN bom_revision_components brc
                        ON brc.revision_id = br.revision_id
                    GROUP BY br.bom_id
                ) cc ON cc.bom_id = b.bom_id
                WHERE b.company_id = $1
                  AND b.deleted_at IS NULL
                ORDER BY b.bom_id DESC
                `,
                [companyId]
            ),
            hasPermission(user.roleId, BOM_PERMISSION, "create"),
            hasPermission(user.roleId, BOM_PERMISSION, "update"),
            hasPermission(user.roleId, BOM_PERMISSION, "delete"),
        ]);

        return NextResponse.json(
            {
                success: true,
                billOfMaterials: result.rows,
                permissions: {
                    canView: true,
                    canCreate: Boolean(canCreate),
                    canUpdate: Boolean(canUpdate),
                    canDelete: Boolean(canDelete),
                },
            },
            { headers: NO_STORE_HEADERS }
        );
    } catch (error) {
        return bomError(error);
    }
}

export async function POST(request) {
    let client;

    try {
        const user = await getCurrentUser();
        await requirePermission(user, BOM_PERMISSION, "create");

        if (!user?.companyId || !user?.userId) {
            throw validationError("User or company information is missing.");
        }

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

        await validateItems(client, data);

const bomNumber = await getNextBomNumber(companyId, client);

const headerResult = await client.query(
    `
    INSERT INTO bill_of_materials (
        company_id,
        bom_number,
        bom_name,
        assembly_product_id,
        assembly_sub_product_id,
        memo,
        unit_of_measure,
        created_by,
        updated_by
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $8)
    RETURNING bom_id, bom_number
    `,
    [
        companyId,
        bomNumber,
        data.bomName,
        data.assemblyProductId,
        data.assemblySubProductId,
        data.memo,
        data.unitOfMeasure,
        userId,
    ]
);

const bomId = headerResult.rows[0].bom_id;
const generatedBomNumber = headerResult.rows[0].bom_number;

        for (const revision of data.revisions) {
            await insertRevision(client, bomId, revision);
        }

        await client.query("COMMIT");

        return NextResponse.json(
    {
        success: true,
        message: "Bill of Materials created successfully.",
        bomId,
        bomNumber: generatedBomNumber,
    },
    {
        status: 201,
        headers: NO_STORE_HEADERS,
    }
);
    } catch (error) {
        if (client) {
            try {
                await client.query("ROLLBACK");
            } catch (rollbackError) {
                console.error("BOM CREATE ROLLBACK ERROR:", rollbackError);
            }
        }

        return bomError(error);
    } finally {
        client?.release();
    }
}
