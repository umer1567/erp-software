
import { NextResponse } from "next/server";
import pool, { getTenantDb } from "@/lib/db";
import { attachUserNames } from "@/lib/tenant";
import { getCurrentUser } from "@/lib/auth";
import { requirePermission } from "@/lib/permissions";

export const dynamic = "force-dynamic";

function permissionError(error) {
    if (error.message === "UNAUTHORIZED") {
        return NextResponse.json(
            { success: false, message: "Please log in." },
            { status: 401 }
        );
    }

    if (error.message === "FORBIDDEN") {
        return NextResponse.json(
            { success: false, message: "You do not have permission." },
            { status: 403 }
        );
    }

    return null;
}

async function getNextPurchaseRequisitionNumber(
    companyId,
    tenantClient
) {
    const numericCompanyId = Number(companyId);

    if (
        !Number.isSafeInteger(numericCompanyId) ||
        numericCompanyId <= 0
    ) {
        throw new Error(
            "Invalid company ID for Purchase Requisition numbering."
        );
    }

    const sequenceName =
        `purchase_requisition_company_${numericCompanyId}_seq`;

    // Create the company-specific sequence in central erp_system.
    await pool.query(`
        CREATE SEQUENCE IF NOT EXISTS public."${sequenceName}"
        START WITH 1
        INCREMENT BY 1
    `);

    for (let attempt = 0; attempt < 1000; attempt++) {
        const result = await pool.query(
            `
            SELECT nextval($1::regclass)::TEXT AS sequence_value
            `,
            [`public.${sequenceName}`]
        );

        const sequenceValue = result.rows[0].sequence_value;

        const transactionNumber =
            `RQ${String(sequenceValue).padStart(6, "0")}`;

        // Check all existing requisitions, including archived records.
        const existing = await tenantClient.query(
            `
            SELECT 1
            FROM purchase_requisitions
            WHERE transaction_number = $1
            LIMIT 1
            `,
            [transactionNumber]
        );

        if (existing.rowCount === 0) {
            return transactionNumber;
        }
    }

    throw new Error(
        "Could not generate a unique Purchase Requisition number."
    );
}

export async function GET(request) {
    try {
        const user = await getCurrentUser();

        await requirePermission(user, "purchase_requisitions", "view");

        if (!user.companyId) {
            return NextResponse.json(
                {
                    success: false,
                    message: "Company information is missing.",
                },
                { status: 400 }
            );
        }

        const db = await getTenantDb(user);
        const { searchParams } = new URL(request.url);
        const id = searchParams.get("id");

        /*
         * Get a specific active requisition.
         * Archived requisitions must only be accessed through Recycle Bin.
         */
        if (id) {
            if (!/^\d+$/.test(id) || Number(id) <= 0) {
                return NextResponse.json(
                    { success: false, message: "Invalid requisition ID." },
                    { status: 400 }
                );
            }

            const result = await db.query(
                `
                SELECT
                    pr.*,
                    w.warehouse_name,
                    w.warehouse_code
                FROM purchase_requisitions pr
                LEFT JOIN warehouses w
                    ON w.warehouse_id = pr.warehouse_id
                WHERE pr.requisition_id = $1
                  AND pr.company_id = $2
                  AND pr.deleted_at IS NULL
                `,
                [Number(id), user.companyId]
            );

            if (!result.rows.length) {
                return NextResponse.json(
                    {
                        success: false,
                        message: "Requisition not found.",
                    },
                    { status: 404 }
                );
            }

            const requisition = result.rows[0];

            await attachUserNames(requisition, {
                created_by: "created_by_name",
                updated_by: "updated_by_name",
            });

            /*
             * Keep historical product information visible in the
             * requisition detail, even if a product is later archived.
             */
            const [items, related, attachments] = await Promise.all([
                db.query(
                    `
                    SELECT
                        ri.*,
                        p.sku,
                        p.product_name
                    FROM purchase_requisition_items ri
                    LEFT JOIN products p
                        ON p.product_id = ri.product_id
                    WHERE ri.requisition_id = $1
                    ORDER BY ri.requisition_item_id
                    `,
                    [Number(id)]
                ),

                db.query(
                    `
                    SELECT *
                    FROM purchase_requisition_related_transactions
                    WHERE requisition_id = $1
                    ORDER BY related_transaction_id
                    `,
                    [Number(id)]
                ),

                db.query(
                    `
                    SELECT *
                    FROM purchase_requisition_attachments
                    WHERE requisition_id = $1
                    ORDER BY attachment_id
                    `,
                    [Number(id)]
                ),
            ]);

            return NextResponse.json({
                success: true,
                requisition: {
                    ...requisition,
                    items: items.rows,
                    relatedTransactions: related.rows,
                    attachments: attachments.rows,
                },
            });
        }

        /*
         * Main history list.
         *
         * An item is converted into an RFQ when an rfq_items record
         * references its original requisition item.
         *
         * Keep partially converted requisitions visible.
         * Hide a requisition only when ALL its items have RFQs.
         * Requisitions without items remain visible.
         */
        const result = await db.query(
            `
            WITH item_summary AS (
                SELECT
                    ri.requisition_id,

                    COUNT(ri.requisition_item_id)::INTEGER
                        AS total_item_count,

                    COALESCE(
                        SUM(ri.quantity),
                        0
                    ) AS total_quantity,

                    COUNT(ri.requisition_item_id)
                    FILTER (
                        WHERE EXISTS (
                            SELECT 1
                            FROM rfq_items rfi
                            WHERE rfi.source_requisition_item_id =
                                ri.requisition_item_id
                        )
                    )::INTEGER AS rfq_item_count,

                    COUNT(ri.requisition_item_id)
                    FILTER (
                        WHERE NOT EXISTS (
                            SELECT 1
                            FROM rfq_items rfi
                            WHERE rfi.source_requisition_item_id =
                                ri.requisition_item_id
                        )
                    )::INTEGER AS remaining_item_count

                FROM purchase_requisition_items ri
                GROUP BY ri.requisition_id
            )

            SELECT
                pr.*,

                w.warehouse_name,
                w.warehouse_code,

                COALESCE(
                    item_summary.total_item_count,
                    0
                ) AS item_count,

                COALESCE(
                    item_summary.total_quantity,
                    0
                ) AS total_quantity,

                COALESCE(
                    item_summary.rfq_item_count,
                    0
                ) AS rfq_item_count,

                COALESCE(
                    item_summary.remaining_item_count,
                    0
                ) AS remaining_item_count,

                CASE
                    WHEN COALESCE(
                        item_summary.total_item_count,
                        0
                    ) = 0
                        THEN 'NO ITEMS'

                    WHEN COALESCE(
                        item_summary.rfq_item_count,
                        0
                    ) > 0
                        AND COALESCE(
                            item_summary.remaining_item_count,
                            0
                        ) > 0
                        THEN 'PARTIALLY CONVERTED TO RFQ'

                    WHEN COALESCE(
                        item_summary.rfq_item_count,
                        0
                    ) = 0
                        THEN 'NOT CONVERTED'

                    ELSE 'RFQ CREATED'
                END AS conversion_status

            FROM purchase_requisitions pr

            LEFT JOIN warehouses w
                ON w.warehouse_id = pr.warehouse_id

            LEFT JOIN item_summary
                ON item_summary.requisition_id =
                    pr.requisition_id

            WHERE pr.company_id = $1
              AND pr.deleted_at IS NULL
              AND (
                    item_summary.requisition_id IS NULL
                    OR item_summary.remaining_item_count > 0
              )

            ORDER BY
                pr.transaction_date DESC,
                pr.requisition_id DESC
            `,
            [user.companyId]
        );

        await attachUserNames(result.rows, {
            created_by: "created_by_name",
        });

        return NextResponse.json({
            success: true,
            requisitions: result.rows,
        });

    } catch (error) {
        const response = permissionError(error);

        if (response) return response;

        console.error("GET purchase requisitions:", error);

        return NextResponse.json(
            {
                success: false,
                message: "Failed to load requisitions.",
            },
            { status: 500 }
        );
    }
}

export async function POST(request) {
    let client;
    let transactionStarted = false;

    try {
        const user = await getCurrentUser();

        await requirePermission(user, "purchase_requisitions", "create");

        const body = await request.json();

        const {
            transactionDate,
            status = "DRAFT",
            warehouseId,
            department,
            className,
            project,
            memo,
            referenceNumber,
            items = [],
        } = body;

        if (!user.companyId || !user.userId) {
            return NextResponse.json(
                {
                    success: false,
                    message: "Invalid user company or account.",
                },
                { status: 400 }
            );
        }

        if (!transactionDate || !warehouseId) {
            return NextResponse.json(
                {
                    success: false,
                    message: "Date and location are required.",
                },
                { status: 400 }
            );
        }

        const allowedStatuses = [
            "DRAFT",
            "SUBMITTED",
            "APPROVED",
            "REJECTED",
        ];

        if (!allowedStatuses.includes(status)) {
            return NextResponse.json(
                {
                    success: false,
                    message: "Invalid requisition status.",
                },
                { status: 400 }
            );
        }

        if (!Array.isArray(items) || items.length === 0) {
            return NextResponse.json(
                {
                    success: false,
                    message: "Add at least one item.",
                },
                { status: 400 }
            );
        }

        for (const item of items) {
            if (
                !item.productId ||
                !Number.isFinite(Number(item.quantity)) ||
                Number(item.quantity) <= 0
            ) {
                return NextResponse.json(
                    {
                        success: false,
                        message:
                            "Every line needs a product and a quantity greater than zero.",
                    },
                    { status: 400 }
                );
            }
        }

        const db = await getTenantDb(user);
        client = await db.connect();

        await client.query("BEGIN");
        transactionStarted = true;

        /*
         * Archived warehouses cannot be selected for new requisitions.
         */
        const warehouse = await client.query(
            `
            SELECT warehouse_id
            FROM warehouses
            WHERE warehouse_id = $1
              AND is_active = TRUE
              AND deleted_at IS NULL
            `,
            [warehouseId]
        );

        if (!warehouse.rows.length) {
            throw new Error("Selected location is unavailable.");
        }

                const transactionNumber =
            await getNextPurchaseRequisitionNumber(
                user.companyId,
                client
            );

        const header = await client.query(
            `
            INSERT INTO purchase_requisitions (
                company_id,
                transaction_number,
                transaction_date,
                status,
                warehouse_id,
                department,
                class_name,
                project,
                memo,
                reference_number,
                created_by,
                updated_by
            )
            VALUES (
                $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $11
            )
            RETURNING *
            `,
            [
                user.companyId,
                transactionNumber,
                transactionDate,
                status,
                warehouseId,
                department || null,
                className || null,
                project || null,
                memo || null,
                referenceNumber || null,
                user.userId,
            ]
        );

        const requisition = header.rows[0];

        for (const item of items) {
            /*
             * Archived products cannot be added to new requisitions.
             */
            const product = await client.query(
                `
                SELECT product_id, product_name, unit
                FROM products
                WHERE product_id = $1
                  AND is_active = TRUE
                  AND deleted_at IS NULL
                `,
                [item.productId]
            );

            if (!product.rows.length) {
                throw new Error(
                    `Invalid, inactive, or archived product: ${item.productId}`
                );
            }

            const productData = product.rows[0];

            await client.query(
                `
                INSERT INTO purchase_requisition_items (
                    requisition_id,
                    product_id,
                    item_description,
                    item_balance,
                    uom,
                    quantity,
                    memo
                )
                VALUES ($1, $2, $3, $4, $5, $6, $7)
                `,
                [
                    requisition.requisition_id,
                    item.productId,
                    item.description || productData.product_name,
                    Number(item.itemBalance) || 0,
                    item.uom || productData.unit || "PCS",
                    Number(item.quantity),
                    item.memo || null,
                ]
            );
        }

        await client.query("COMMIT");
        transactionStarted = false;

        return NextResponse.json(
            {
                success: true,
                message: "Purchase requisition created successfully.",
                requisition,
            },
            { status: 201 }
        );

    } catch (error) {
        if (client && transactionStarted) {
            try {
                await client.query("ROLLBACK");
            } catch (rollbackError) {
                console.error(
                    "Purchase requisition rollback failed:",
                    rollbackError
                );
            }
        }

        const response = permissionError(error);

        if (response) return response;

        console.error("POST purchase requisition:", error);

        const isClientError =
            error.message === "Selected location is unavailable." ||
            error.message.startsWith(
                "Invalid, inactive, or archived product:"
            );

        return NextResponse.json(
            {
                success: false,
                message: error.message || "Failed to create requisition.",
            },
            { status: isClientError ? 400 : 500 }
        );

    } finally {
        if (client) client.release();
    }
}
