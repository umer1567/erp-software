
import { NextResponse } from "next/server";
import { getTenantDb } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { requirePermission } from "@/lib/permissions";

export const dynamic = "force-dynamic";

const PERMISSION = "assembly_build";

const NO_CACHE = {
    "Cache-Control": "private, no-cache, no-store, must-revalidate",
};

function jsonError(message, status = 500) {
    return NextResponse.json(
        { success: false, message },
        { status, headers: NO_CACHE }
    );
}

function positiveId(value, label) {
    const number = Number(value);

    if (!Number.isSafeInteger(number) || number <= 0) {
        throw new Error(`${label} must be a valid positive ID.`);
    }

    return number;
}

function optionalId(value, label) {
    if (value === undefined || value === null || value === "") {
        return null;
    }

    return positiveId(value, label);
}

function positiveNumber(value, label) {
    const number = Number(value);

    if (!Number.isFinite(number) || number <= 0) {
        throw new Error(`${label} must be greater than zero.`);
    }

    return number;
}

function nonNegativeNumber(value, label, defaultValue = 0) {
    if (value === undefined || value === null || value === "") {
        return defaultValue;
    }

    const number = Number(value);

    if (!Number.isFinite(number) || number < 0) {
        throw new Error(`${label} cannot be negative.`);
    }

    return number;
}

function optionalText(value, maxLength = 5000) {
    const result = String(value ?? "").trim();

    if (result.length > maxLength) {
        throw new Error(`Text cannot exceed ${maxLength} characters.`);
    }

    return result || null;
}

function validDate(value) {
    if (value === undefined || value === null || value === "") {
        return new Date().toISOString().slice(0, 10);
    }

    const date = String(value).trim();
    const match = date.match(/^(\d{4})-(\d{2})-(\d{2})$/);

    if (!match) {
        throw new Error("Transaction date must be in YYYY-MM-DD format.");
    }

    const year = Number(match[1]);
    const month = Number(match[2]);
    const day = Number(match[3]);
    const parsed = new Date(Date.UTC(year, month - 1, day));

    if (
        parsed.getUTCFullYear() !== year ||
        parsed.getUTCMonth() !== month - 1 ||
        parsed.getUTCDate() !== day
    ) {
        throw new Error("Invalid transaction date.");
    }

    return date;
}

function validateItemIdentity(productId, subProductId) {
    if (Boolean(productId) === Boolean(subProductId)) {
        throw new Error(
            "Each item must reference exactly one product or sub-product."
        );
    }
}

function errorStatus(error) {
    const status = Number(error?.status || error?.statusCode);

    if (status >= 400 && status < 600) {
        return status;
    }

    const message = String(error?.message || "").toLowerCase();

    if (
        message.includes("required") ||
        message.includes("invalid") ||
        message.includes("must") ||
        message.includes("cannot") ||
        message.includes("does not") ||
        message.includes("not found") ||
        message.includes("inactive") ||
        message.includes("greater than") ||
        message.includes("negative") ||
        message.includes("exceed") ||
        message.includes("exactly one") ||
        message.includes("belong") ||
        message.includes("date")
    ) {
        return 400;
    }

    return 500;
}

async function readRequestBody(request) {
    try {
        const body = await request.json();

        if (!body || typeof body !== "object" || Array.isArray(body)) {
            throw new Error("Request body must be a valid JSON object.");
        }

        return body;
    } catch (error) {
        if (error instanceof SyntaxError) {
            throw new Error("Request body contains invalid JSON.");
        }

        throw error;
    }
}

async function getItemBalance(client, {
    companyId,
    warehouseId,
    productId,
    subProductId,
}) {
    if (subProductId) {
        const result = await client.query(
            `
            SELECT quantity
            FROM sub_product_stock
            WHERE company_id = $1
              AND warehouse_id = $2
              AND sub_product_id = $3
            LIMIT 1
            `,
            [companyId, warehouseId, subProductId]
        );

        return Number(result.rows[0]?.quantity || 0);
    }

    const result = await client.query(
        `
        SELECT quantity
        FROM stock
        WHERE company_id = $1
          AND product_id = $2
          AND warehouse_id = $3
        LIMIT 1
        `,
        [companyId, productId, warehouseId]
    );

    return Number(result.rows[0]?.quantity || 0);
}

/* =========================================================
   GET: ACTIVE ASSEMBLY BUILD HISTORY
========================================================= */

export async function GET(request) {
    try {
        const user = await getCurrentUser();

        if (!user) {
            return jsonError("Unauthorized. Please log in.", 401);
        }

        await requirePermission(user, PERMISSION, "view");

        const companyId = positiveId(user.companyId, "Company");

        const { searchParams } = new URL(request.url);

        const search = String(
            searchParams.get("search") || ""
        ).trim();

        const status = String(
            searchParams.get("status") || ""
        ).trim().toUpperCase();

        const values = [companyId];

        const conditions = [
            "ab.company_id = $1",
            "ab.deleted_at IS NULL",
        ];

        if (search) {
            values.push(`%${search}%`);
            const index = values.length;

            conditions.push(`
                (
                    ab.transaction_number ILIKE $${index}
                    OR ab.work_order_number ILIKE $${index}
                    OR COALESCE(b.bom_name, '') ILIKE $${index}
                    OR COALESCE(p.product_name, '') ILIKE $${index}
                    OR COALESCE(sp.sub_product_name, '') ILIKE $${index}
                    OR COALESCE(c.customer_name, '') ILIKE $${index}
                )
            `);
        }

        if (
            status &&
            ["DRAFT", "APPROVED", "CANCELLED"].includes(status)
        ) {
            values.push(status);
            conditions.push(`ab.status = $${values.length}`);
        }

        const db = await getTenantDb(user);

        const result = await db.query(
            `
            SELECT
                ab.assembly_build_id,
                ab.transaction_number,
                ab.transaction_date,
                ab.warehouse_id,
                w.warehouse_name AS location,
                ab.customer_id,
                c.customer_name,
                ab.bom_id,
                b.bom_name,
                ab.revision_id,
                br.revision_name,
                ab.assembly_product_id,
                ab.assembly_sub_product_id,
                CASE
                    WHEN ab.assembly_product_id IS NOT NULL
                        THEN p.product_name
                    ELSE sp.sub_product_name
                END AS assembly_name,
                CASE
                    WHEN ab.assembly_product_id IS NOT NULL
                        THEN p.sku
                    ELSE sp.sku
                END AS assembly_sku,
                ab.build_quantity,
                ab.uom,
                ab.employee,
                ab.machine,
                ab.shift,
                ab.work_order_number,
                ab.details,
                ab.memo,
                ab.status,
                ab.component_amount,
                ab.byproduct_amount,
                ab.finished_unit_cost,
                ab.posted_at,
                ab.created_at,
                ab.updated_at
            FROM assembly_builds ab
            LEFT JOIN warehouses w
                ON w.warehouse_id = ab.warehouse_id
            LEFT JOIN customers c
                ON c.customer_id = ab.customer_id
            LEFT JOIN bill_of_materials b
                ON b.bom_id = ab.bom_id
               AND b.company_id = ab.company_id
            LEFT JOIN bom_revisions br
                ON br.revision_id = ab.revision_id
               AND br.bom_id = ab.bom_id
            LEFT JOIN products p
                ON p.product_id = ab.assembly_product_id
            LEFT JOIN sub_products sp
                ON sp.sub_product_id = ab.assembly_sub_product_id
            WHERE ${conditions.join(" AND ")}
            ORDER BY ab.assembly_build_id DESC
            `,
            values
        );

        return NextResponse.json(
            {
                success: true,
                assemblyBuilds: result.rows,
                total: result.rows.length,
            },
            { headers: NO_CACHE }
        );
    } catch (error) {
        console.error("ASSEMBLY BUILD GET ERROR:", error);

        return jsonError(
            error.message || "Failed to load Assembly Build history.",
            errorStatus(error)
        );
    }
}

/* =========================================================
   POST: CREATE ASSEMBLY BUILD
========================================================= */

export async function POST(request) {
    let client;
    let transactionStarted = false;

    try {
        const user = await getCurrentUser();

        if (!user) {
            return jsonError("Unauthorized. Please log in.", 401);
        }

        await requirePermission(user, PERMISSION, "create");

        const companyId = positiveId(user.companyId, "Company");
        const userId = optionalId(user.userId, "User");
        const body = await readRequestBody(request);

        const warehouseId = positiveId(
            body.warehouseId,
            "Production location"
        );

        const bomId = positiveId(
            body.bomId,
            "Bill of Materials"
        );

        const revisionId = positiveId(
            body.revisionId,
            "BOM revision"
        );

        const buildQuantity = positiveNumber(
            body.buildQuantity,
            "Build quantity"
        );

        const transactionDate = validDate(body.transactionDate);
        const customerId = optionalId(body.customerId, "Customer");

        const components = Array.isArray(body.components)
            ? body.components
            : [];

        const byproducts = Array.isArray(body.byproducts)
            ? body.byproducts
            : [];

        const downtime = Array.isArray(body.downtime)
            ? body.downtime
            : [];

        if (!components.length) {
            throw new Error("At least one BOM component is required.");
        }

        const db = await getTenantDb(user);
        client = await db.connect();

        await client.query("BEGIN");
        transactionStarted = true;

        /*
         * Serialize transaction-number generation per company.
         * This prevents duplicate AB numbers from concurrent requests.
         */

        await client.query(
            `
            SELECT pg_advisory_xact_lock(
                $1::integer,
                hashtext('assembly_build')::integer
            )
            `,
            [companyId]
        );

        /* Validate active production location */

        const warehouseResult = await client.query(
            `
            SELECT warehouse_id
            FROM warehouses
            WHERE warehouse_id = $1
              AND is_active = TRUE
              AND deleted_at IS NULL
            LIMIT 1
            `,
            [warehouseId]
        );

        if (!warehouseResult.rows.length) {
            throw new Error(
                "Selected production location is invalid, inactive, or archived."
            );
        }

        /* Validate active customer */

        if (customerId) {
            const customerResult = await client.query(
                `
                SELECT customer_id
                FROM customers
                WHERE customer_id = $1
                  AND is_active = TRUE
                  AND deleted_at IS NULL
                LIMIT 1
                `,
                [customerId]
            );

            if (!customerResult.rows.length) {
                throw new Error(
                    "Selected customer is invalid, inactive, or archived."
                );
            }
        }

        /* Validate company-owned active BOM and revision */

        const bomResult = await client.query(
            `
            SELECT
                b.bom_id,
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
            LIMIT 1
            `,
            [bomId, companyId, revisionId]
        );

        if (!bomResult.rows.length) {
            throw new Error(
                "Selected BOM or revision does not exist, is inactive, archived, or does not belong to your company."
            );
        }

        const bom = bomResult.rows[0];

        const assemblyProductId = bom.assembly_product_id
            ? Number(bom.assembly_product_id)
            : null;

        const assemblySubProductId = bom.assembly_sub_product_id
            ? Number(bom.assembly_sub_product_id)
            : null;

        validateItemIdentity(
            assemblyProductId,
            assemblySubProductId
        );

        /* Validate the finished assembly product if applicable */

        if (assemblyProductId) {
            const assemblyProductResult = await client.query(
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

            if (!assemblyProductResult.rows.length) {
                throw new Error(
                    "The BOM finished product is inactive, archived, or unavailable."
                );
            }
        }

        /* Load actual BOM revision components */

        const bomComponentsResult = await client.query(
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
                p.is_active AS product_is_active,
                p.deleted_at AS product_deleted_at,
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

        if (!bomComponentsResult.rows.length) {
            throw new Error(
                "The selected BOM revision has no components."
            );
        }

        const bomComponentMap = new Map(
            bomComponentsResult.rows.map((item) => [
                Number(item.component_id),
                item,
            ])
        );

        /* Prepare component snapshots */

        const preparedComponents = [];
        const usedComponentIds = new Set();

        for (const row of components) {
            const componentId = positiveId(
                row.componentId,
                "BOM component"
            );

            if (usedComponentIds.has(componentId)) {
                throw new Error(
                    "A BOM component cannot be added more than once."
                );
            }

            usedComponentIds.add(componentId);

            const bomComponent = bomComponentMap.get(componentId);

            if (!bomComponent) {
                throw new Error(
                    `Component ${componentId} does not belong to the selected BOM revision.`
                );
            }

            const requiredQuantity = positiveNumber(
                row.requiredQuantity,
                "Required component quantity"
            );

            const issuedQuantity = positiveNumber(
                row.issuedQuantity ?? row.requiredQuantity,
                "Issued component quantity"
            );

            /*
             * QUANTITY components are calculated from BOM quantity.
             * PERCENTAGE components retain the form-calculated quantity.
             */

            if (
                String(bomComponent.quantity_type).toUpperCase() ===
                "QUANTITY"
            ) {
                const expectedQuantity =
                    Number(bomComponent.bom_quantity) * buildQuantity;

                if (
                    Math.abs(requiredQuantity - expectedQuantity) > 1
                ) {
                    throw new Error(
                        `Required quantity for component ${componentId} does not match its BOM quantity. Expected ${expectedQuantity}.`
                    );
                }
            }

            const productId = bomComponent.product_id
                ? Number(bomComponent.product_id)
                : null;

            const subProductId = bomComponent.sub_product_id
                ? Number(bomComponent.sub_product_id)
                : null;

            validateItemIdentity(productId, subProductId);

            if (
                productId &&
                (
                    !bomComponent.product_name ||
                    bomComponent.product_is_active === false ||
                    bomComponent.product_deleted_at
                )
            ) {
                throw new Error(
                    `The product for BOM component ${componentId} is missing, inactive, or archived.`
                );
            }

            if (subProductId && !bomComponent.sub_product_name) {
                throw new Error(
                    `The sub-product for BOM component ${componentId} could not be found.`
                );
            }

            const itemBalance = await getItemBalance(client, {
                companyId,
                warehouseId,
                productId,
                subProductId,
            });

            const unitCost = nonNegativeNumber(
                row.unitCost,
                "Component unit cost"
            );

            const amount = issuedQuantity * unitCost;

            const itemDescription =
                optionalText(bomComponent.item_description, 2000) ||
                (productId
                    ? bomComponent.product_name
                    : bomComponent.sub_product_name);

            if (!itemDescription) {
                throw new Error(
                    `The description for component ${componentId} could not be determined.`
                );
            }

            preparedComponents.push({
                componentId,
                productId,
                subProductId,
                itemDescription,
                uom: bomComponent.uom || null,
                itemBalance,
                requiredQuantity,
                issuedQuantity,
                unitCost,
                amount,
                details: optionalText(row.details),
            });
        }

        if (usedComponentIds.size !== bomComponentMap.size) {
            throw new Error(
                "All components from the selected BOM revision must be included."
            );
        }

        const componentAmount = preparedComponents.reduce(
            (sum, item) => sum + item.amount,
            0
        );

        /* Prepare byproducts */

        const preparedByproducts = [];

        for (const row of byproducts) {
            const productId = optionalId(
                row.productId,
                "Byproduct product"
            );

            const subProductId = optionalId(
                row.subProductId,
                "Byproduct sub-product"
            );

            validateItemIdentity(productId, subProductId);

            let itemDescription = optionalText(
                row.itemDescription,
                2000
            );

            if (productId) {
                const itemResult = await client.query(
                    `
                    SELECT product_name
                    FROM products
                    WHERE product_id = $1
                      AND COALESCE(is_active, TRUE) = TRUE
                      AND deleted_at IS NULL
                    LIMIT 1
                    `,
                    [productId]
                );

                if (!itemResult.rows.length) {
                    throw new Error(
                        "A selected byproduct product does not exist, is inactive, or is archived."
                    );
                }

                itemDescription =
                    itemDescription || itemResult.rows[0].product_name;
            } else {
                const itemResult = await client.query(
                    `
                    SELECT sub_product_name
                    FROM sub_products
                    WHERE sub_product_id = $1
                    LIMIT 1
                    `,
                    [subProductId]
                );

                if (!itemResult.rows.length) {
                    throw new Error(
                        "A selected byproduct sub-product does not exist."
                    );
                }

                itemDescription =
                    itemDescription ||
                    itemResult.rows[0].sub_product_name;
            }

            const quantity = positiveNumber(
                row.quantity,
                "Byproduct quantity"
            );

            const unitCost = nonNegativeNumber(
                row.unitCost,
                "Byproduct unit cost"
            );

            preparedByproducts.push({
                productId,
                subProductId,
                itemDescription,
                uom: optionalText(row.uom, 100),
                quantity,
                unitCost,
                amount: quantity * unitCost,
                details: optionalText(row.details),
            });
        }

        const byproductAmount = preparedByproducts.reduce(
            (sum, item) => sum + item.amount,
            0
        );

        /* Prepare downtime entries */

        const preparedDowntime = downtime.map((row) => ({
            machine: optionalText(row.machine, 255),
            reason: optionalText(row.reason, 2000),
            startTime: row.startTime || null,
            endTime: row.endTime || null,
            durationMinutes: nonNegativeNumber(
                row.durationMinutes,
                "Downtime duration"
            ),
            remarks: optionalText(row.remarks),
        }));

        /* Generate company-specific transaction number */

        const numberResult = await client.query(
            `
            SELECT COALESCE(
                MAX(SUBSTRING(transaction_number FROM 4)::BIGINT),
                0
            ) AS last_number
            FROM assembly_builds
            WHERE company_id = $1
              AND transaction_number ~ '^AB-[0-9]+$'
            `,
            [companyId]
        );

        const nextNumber =
            Number(numberResult.rows[0]?.last_number || 0) + 1;

        const transactionNumber =
            `AB-${String(nextNumber).padStart(6, "0")}`;

        const finishedUnitCost = componentAmount / buildQuantity;

        /*
         * Create the document as DRAFT.
         *
         * No stock update.
         * No inventory transaction.
         * No journal entry.
         */

        const buildResult = await client.query(
            `
            INSERT INTO assembly_builds (
                company_id,
                transaction_number,
                transaction_date,
                warehouse_id,
                customer_id,
                bom_id,
                revision_id,
                assembly_product_id,
                assembly_sub_product_id,
                build_quantity,
                uom,
                employee,
                machine,
                shift,
                work_order_number,
                details,
                memo,
                status,
                component_amount,
                byproduct_amount,
                finished_unit_cost,
                created_by,
                updated_by
            )
            VALUES (
                $1, $2, $3, $4, $5, $6, $7,
                $8, $9, $10, $11, $12, $13,
                $14, $15, $16, $17, 'DRAFT',
                $18, $19, $20, $21, $21
            )
            RETURNING *
            `,
            [
                companyId,
                transactionNumber,
                transactionDate,
                warehouseId,
                customerId,
                bomId,
                revisionId,
                assemblyProductId,
                assemblySubProductId,
                buildQuantity,
                optionalText(body.uom, 100) ||
                    bom.unit_of_measure ||
                    null,
                optionalText(body.employee, 255),
                optionalText(body.machine, 255),
                optionalText(body.shift, 100),
                optionalText(body.workOrderNumber, 255),
                optionalText(body.details),
                optionalText(body.memo),
                componentAmount,
                byproductAmount,
                finishedUnitCost,
                userId,
            ]
        );

        const build = buildResult.rows[0];
        const buildId = build.assembly_build_id;

        /* Insert component snapshots */

        for (const item of preparedComponents) {
            await client.query(
                `
                INSERT INTO assembly_build_components (
                    assembly_build_id,
                    component_id,
                    product_id,
                    sub_product_id,
                    item_description,
                    uom,
                    item_balance,
                    required_quantity,
                    issued_quantity,
                    unit_cost,
                    amount,
                    details
                )
                VALUES (
                    $1, $2, $3, $4, $5, $6,
                    $7, $8, $9, $10, $11, $12
                )
                `,
                [
                    buildId,
                    item.componentId,
                    item.productId,
                    item.subProductId,
                    item.itemDescription,
                    item.uom,
                    item.itemBalance,
                    item.requiredQuantity,
                    item.issuedQuantity,
                    item.unitCost,
                    item.amount,
                    item.details,
                ]
            );
        }

        /* Insert byproduct snapshots */

        for (const item of preparedByproducts) {
            await client.query(
                `
                INSERT INTO assembly_build_byproducts (
                    assembly_build_id,
                    product_id,
                    sub_product_id,
                    item_description,
                    uom,
                    quantity,
                    unit_cost,
                    amount,
                    details
                )
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
                `,
                [
                    buildId,
                    item.productId,
                    item.subProductId,
                    item.itemDescription,
                    item.uom,
                    item.quantity,
                    item.unitCost,
                    item.amount,
                    item.details,
                ]
            );
        }

        /* Insert downtime snapshots */

        for (const item of preparedDowntime) {
            await client.query(
                `
                INSERT INTO assembly_build_downtime (
                    assembly_build_id,
                    machine,
                    reason,
                    start_time,
                    end_time,
                    duration_minutes,
                    remarks
                )
                VALUES ($1, $2, $3, $4, $5, $6, $7)
                `,
                [
                    buildId,
                    item.machine,
                    item.reason,
                    item.startTime,
                    item.endTime,
                    item.durationMinutes,
                    item.remarks,
                ]
            );
        }

        await client.query("COMMIT");
        transactionStarted = false;

        return NextResponse.json(
            {
                success: true,
                message: "Assembly Build saved successfully as DRAFT.",
                assemblyBuild: {
                    ...build,
                    components: preparedComponents,
                    byproducts: preparedByproducts,
                    downtime: preparedDowntime,
                },
            },
            {
                status: 201,
                headers: NO_CACHE,
            }
        );
    } catch (error) {
        if (client && transactionStarted) {
            try {
                await client.query("ROLLBACK");
            } catch (rollbackError) {
                console.error(
                    "ASSEMBLY BUILD POST ROLLBACK ERROR:",
                    rollbackError
                );
            }
        }

        console.error("ASSEMBLY BUILD POST ERROR:", error);

        return jsonError(
            error.message || "Failed to create Assembly Build.",
            errorStatus(error)
        );
    } finally {
        client?.release();
    }
}
