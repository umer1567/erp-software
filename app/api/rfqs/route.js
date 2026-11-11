import { NextResponse } from "next/server";
import pool from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { requirePermission, hasPermission } from "@/lib/permissions";

export const dynamic = "force-dynamic";

const SOURCE_PURCHASE = "PURCHASE_REQUISITION";
const SOURCE_PROCUREMENT = "PROCUREMENT_REQUISITION";
const SOURCE_DIRECT = "DIRECT";

const ALLOWED_SOURCE_TYPES = [
    SOURCE_PURCHASE,
    SOURCE_PROCUREMENT,
    SOURCE_DIRECT,
];

const ALLOWED_STATUSES = [
    "DRAFT",
    "APPROVED",
    "SENT",
    "PARTIALLY_RECEIVED",
    "RECEIVED",
    "CLOSED",
    "CANCELLED",
];

/* -------------------------------------------------------------------------- */
/* Error handling                                                             */
/* -------------------------------------------------------------------------- */

function getErrorStatus(error) {
    if (error.message === "UNAUTHORIZED") return 401;
    if (error.message === "FORBIDDEN") return 403;

    if (error.statusCode) return error.statusCode;

    if (error.code === "23505") return 409;
    if (error.code === "23503") return 400;
    if (error.code === "23514") return 400;

    return 500;
}

function getErrorMessage(error) {
    if (error.message === "UNAUTHORIZED") {
        return "Please log in.";
    }

    if (error.message === "FORBIDDEN") {
        return "You do not have permission to perform this action.";
    }

    if (error.code === "23505") {
        return "One or more selected items have already been converted into an RFQ.";
    }

    if (error.code === "23503") {
        return "A selected source record, product, or supplier no longer exists.";
    }

    if (error.code === "23514") {
        return "One or more RFQ items contain invalid data.";
    }

    return error.message || "An unexpected error occurred.";
}

function validationError(message) {
    const error = new Error(message);
    error.statusCode = 400;
    return error;
}

/* -------------------------------------------------------------------------- */
/* Normalize frontend selections                                              */
/* -------------------------------------------------------------------------- */

function normalizeSelectedItems(body) {
    if (Array.isArray(body.selectedItems)) {
        return body.selectedItems.map((item) => {
            const sourceType = String(
                item.sourceType ||
                item.source_type ||
                SOURCE_PURCHASE
            ).toUpperCase();

            if (sourceType === SOURCE_DIRECT) {
                return {
                    sourceType,
                    itemId: Number(
                        item.productId ||
                        item.product_id ||
                        item.sourceItemId ||
                        item.itemId ||
                        item.id
                    ),
                    quantity: Number(item.quantity),
                };
            }

            return {
                sourceType,
                itemId: Number(
                    item.sourceItemId ||
                    item.itemId ||
                    item.source_requisition_item_id ||
                    item.seq_id ||
                    item.id
                ),
                quantity: null,
            };
        });
    }

    /* Backward compatibility with the older frontend. */
    if (Array.isArray(body.selectedItemIds)) {
        return body.selectedItemIds.map((id) => ({
            sourceType: SOURCE_PURCHASE,
            itemId: Number(id),
            quantity: null,
        }));
    }

    return [];
}

function validateSelections(items) {
    if (!items.length) {
        throw validationError(
            "Please select at least one RFQ item."
        );
    }

    const seen = new Set();

    for (const item of items) {
        if (!ALLOWED_SOURCE_TYPES.includes(item.sourceType)) {
            throw validationError("Invalid RFQ source type.");
        }

        if (
            !Number.isSafeInteger(item.itemId) ||
            item.itemId <= 0
        ) {
            throw validationError("Invalid selected item.");
        }

        if (item.sourceType === SOURCE_DIRECT) {
            if (
                !Number.isFinite(item.quantity) ||
                item.quantity <= 0
            ) {
                throw validationError(
                    "Please enter a valid quantity greater than zero for every direct purchase item."
                );
            }
        }

        const key = `${item.sourceType}:${item.itemId}`;

        if (seen.has(key)) {
            throw validationError(
                "A selected item appears more than once."
            );
        }

        seen.add(key);
    }

    /*
     * The same original PR item cannot be selected through both
     * the Purchase Requisition and Procurement workflows.
     *
     * Direct product IDs are intentionally excluded from this check.
     */
    const requisitionItems = items.filter(
        (item) => item.sourceType !== SOURCE_DIRECT
    );

    const originalIds = requisitionItems.map(
        (item) => item.itemId
    );

    if (new Set(originalIds).size !== originalIds.length) {
        throw validationError(
            "The same original Purchase Requisition item cannot be selected more than once."
        );
    }

    return items;
}

/* -------------------------------------------------------------------------- */
/* GET: RFQ history, suppliers, and available items                           */
/* -------------------------------------------------------------------------- */

export async function GET() {
    try {
        const user = await getCurrentUser();

        await requirePermission(user, "rfqs", "view");

        if (!user.companyId) {
            return NextResponse.json(
                {
                    message: "No company is assigned to your account.",
                },
                { status: 400 }
            );
        }

        const companyId = Number(user.companyId);

        const [
            historyResult,
            suppliersResult,
            directItemsResult,
            procurementItemsResult,
            productsResult,
            companyResult,
        ] = await Promise.all([
            /* ---------------------------------------------------------------- */
            /* RFQ history                                                      */
            /* ---------------------------------------------------------------- */

            pool.query(
                `
                SELECT
                    r.rfq_id,
                    r.transaction_number,
                    r.transaction_date,
                    r.status,
                    r.project,
                    r.reference_number,
                    r.memo,
                    r.created_at,

                    COUNT(DISTINCT i.rfq_item_id)::INTEGER
                        AS item_count,

                    COUNT(DISTINCT v.rfq_vendor_id)::INTEGER
                        AS vendor_count,

                    COALESCE(
                        STRING_AGG(
                            DISTINCT w.warehouse_name,
                            ', '
                        ),
                        ''
                    ) AS location,

                    CASE
                        WHEN COUNT(DISTINCT i.source_type) > 1
                            THEN 'Multiple Sources'

                        WHEN COUNT(DISTINCT i.source_type) FILTER (
                            WHERE i.source_type = '${SOURCE_DIRECT}'
                        ) > 0
                            THEN 'Direct Purchase'

                        WHEN COUNT(DISTINCT i.source_type) FILTER (
                            WHERE i.source_type = '${SOURCE_PROCUREMENT}'
                        ) > 0
                            THEN 'Requisition for Procurement'

                        WHEN COUNT(DISTINCT i.source_type) FILTER (
                            WHERE i.source_type = '${SOURCE_PURCHASE}'
                        ) > 0
                            THEN 'Purchase Requisition'

                        ELSE '—'
                    END AS created_from,

                    COALESCE(
                        JSON_AGG(
                            DISTINCT JSONB_BUILD_OBJECT(
                                'supplier_id', s.supplier_id,
                                'supplier_name', s.supplier_name,
                                'supplier_code', s.supplier_code
                            )
                        ) FILTER (
                            WHERE s.supplier_id IS NOT NULL
                        ),
                        '[]'::json
                    ) AS vendors

                FROM rfqs r

                LEFT JOIN rfq_items i
                    ON i.rfq_id = r.rfq_id

                LEFT JOIN warehouses w
                    ON w.warehouse_id = i.warehouse_id

                LEFT JOIN rfq_vendors v
                    ON v.rfq_id = r.rfq_id

                LEFT JOIN suppliers s
                    ON s.supplier_id = v.supplier_id

                WHERE r.company_id = $1

                GROUP BY r.rfq_id

                ORDER BY r.rfq_id DESC
                `,
                [companyId]
            ),

            /* ---------------------------------------------------------------- */
            /* Active suppliers                                                 */
            /* ---------------------------------------------------------------- */

            pool.query(
                `
                SELECT
                    supplier_id,
                    supplier_code,
                    supplier_name,
                    phone,
                    email,
                    address
                FROM suppliers
                WHERE is_active = TRUE
                ORDER BY supplier_name
                `
            ),

            /* ---------------------------------------------------------------- */
            /* Purchase Requisition items                                       */
            /* ---------------------------------------------------------------- */

            pool.query(
                `
                SELECT
                    '${SOURCE_PURCHASE}'::VARCHAR AS source_type,

                    ri.requisition_item_id AS seq_id,

                    pr.requisition_id,

                    ri.requisition_item_id
                        AS source_requisition_item_id,

                    NULL::INTEGER
                        AS procurement_requisition_id,

                    NULL::INTEGER
                        AS procurement_requisition_item_id,

                    pr.transaction_number AS req_number,
                    pr.transaction_date AS req_date,

                    p.product_name AS item,

                    ri.item_description,
                    ri.item_balance,
                    ri.uom,
                    ri.quantity,

                    pr.department AS department,
                    pr.class_name AS class_name,
                    pr.project AS project,
                    pr.reference_number AS reference_number,
                    pr.warehouse_id AS warehouse_id,

                    w.warehouse_name AS location

                FROM purchase_requisition_items ri

                INNER JOIN purchase_requisitions pr
                    ON pr.requisition_id = ri.requisition_id

                LEFT JOIN products p
                    ON p.product_id = ri.product_id

                LEFT JOIN warehouses w
                    ON w.warehouse_id = pr.warehouse_id

                WHERE
                    pr.company_id = $1
                    AND pr.status = 'APPROVED'

                    AND NOT EXISTS (
                        SELECT 1
                        FROM procurement_requisition_items pri
                        WHERE pri.source_requisition_item_id =
                            ri.requisition_item_id
                    )

                    AND NOT EXISTS (
                        SELECT 1
                        FROM rfq_items rfi
                        WHERE rfi.source_requisition_item_id =
                            ri.requisition_item_id
                    )

                ORDER BY
                    pr.transaction_date DESC,
                    ri.requisition_item_id
                `,
                [companyId]
            ),

            /* ---------------------------------------------------------------- */
            /* Procurement Requisition items                                   */
            /* ---------------------------------------------------------------- */

            pool.query(
                `
                SELECT
                    '${SOURCE_PROCUREMENT}'::VARCHAR AS source_type,

                    pri.source_requisition_item_id AS seq_id,

                    pri.source_requisition_id AS requisition_id,

                    pri.source_requisition_item_id,

                    pro.procurement_requisition_id,

                    pri.procurement_requisition_item_id,

                    pr.transaction_number AS req_number,
                    pr.transaction_date AS req_date,

                    pro.transaction_number
                        AS source_transaction_number,

                    pro.transaction_date
                        AS source_transaction_date,

                    p.product_name AS item,

                    COALESCE(
                        pri.item_description,
                        ori.item_description
                    ) AS item_description,

                    ori.item_balance,

                    pri.uom,
                    pri.quantity,

                    COALESCE(
                        pri.department,
                        pr.department
                    ) AS department,

                    COALESCE(
                        pri.class_name,
                        pr.class_name
                    ) AS class_name,

                    pr.project,
                    pr.reference_number,

                    COALESCE(
                        pri.warehouse_id,
                        pr.warehouse_id
                    ) AS warehouse_id,

                    w.warehouse_name AS location

                FROM procurement_requisition_items pri

                INNER JOIN procurement_requisitions pro
                    ON pro.procurement_requisition_id =
                        pri.procurement_requisition_id

                INNER JOIN purchase_requisitions pr
                    ON pr.requisition_id =
                        pri.source_requisition_id

                INNER JOIN purchase_requisition_items ori
                    ON ori.requisition_item_id =
                        pri.source_requisition_item_id

                LEFT JOIN products p
                    ON p.product_id = pri.product_id

                LEFT JOIN warehouses w
                    ON w.warehouse_id = COALESCE(
                        pri.warehouse_id,
                        pr.warehouse_id
                    )

                WHERE
                    pro.company_id = $1
                    AND pro.status = 'CREATED'
                    AND pr.status = 'APPROVED'

                    AND NOT EXISTS (
                        SELECT 1
                        FROM rfq_items rfi
                        WHERE
                            rfi.source_requisition_item_id =
                                pri.source_requisition_item_id
                            OR
                            rfi.procurement_requisition_item_id =
                                pri.procurement_requisition_item_id
                    )

                ORDER BY
                    pro.transaction_date DESC,
                    pri.procurement_requisition_item_id
                `,
                [companyId]
            ),

            /* ---------------------------------------------------------------- */
            /* Direct Purchase: active product master                          */
            /* ---------------------------------------------------------------- */

            pool.query(
                `
                SELECT
                    '${SOURCE_DIRECT}'::VARCHAR AS source_type,

                    p.product_id,

                    p.product_id AS seq_id,

                    p.sku,
                    p.barcode,

                    p.product_name AS item,
                    p.product_name,

                    COALESCE(
                        p.purchase_description,
                        p.description,
                        ''
                    ) AS item_description,

                    COALESCE(
                        NULLIF(p.purchase_unit, ''),
                        NULLIF(p.unit, ''),
                        'PCS'
                    ) AS uom,

                    1::NUMERIC AS quantity,

                    p.category,
                    p.brand_name,
                    p.model,

                    p.cost_price,
                    p.is_active

                FROM products p

                WHERE p.is_active = TRUE

                ORDER BY p.product_name
                `
            ),

            /* ---------------------------------------------------------------- */
            /* Company details                                                 */
            /* ---------------------------------------------------------------- */

            pool.query(
                `
                SELECT *
                FROM companies
                WHERE company_id = $1
                LIMIT 1
                `,
                [companyId]
            ),
        ]);

        /* ------------------------------------------------------------------ */
        /* Format Purchase Requisition items                                  */
        /* ------------------------------------------------------------------ */

        const availableItems = directItemsResult.rows.map((item) => ({
            ...item,
            source_type: SOURCE_PURCHASE,
            source_label: "Purchase Requisition",
            source_document_number: item.req_number,
            source_document_date: item.req_date,
            source_item_id: item.source_requisition_item_id,
        }));

        /* ------------------------------------------------------------------ */
        /* Format Procurement Requisition items                               */
        /* ------------------------------------------------------------------ */

        const procurementItems = procurementItemsResult.rows.map(
            (item) => ({
                ...item,
                source_type: SOURCE_PROCUREMENT,
                source_label: "Requisition for Procurement",
                source_document_number:
                    item.source_transaction_number,
                source_document_date:
                    item.source_transaction_date,
                source_item_id: item.source_requisition_item_id,
            })
        );

        /* ------------------------------------------------------------------ */
        /* Format Direct Purchase products                                    */
        /* ------------------------------------------------------------------ */

        const directProducts = productsResult.rows.map((product) => ({
            ...product,
            source_type: SOURCE_DIRECT,
            source_label: "Direct Purchase",
            source_document_number: "Direct Purchase",
            source_document_date: null,
            source_item_id: product.product_id,
        }));

        const companyRow = companyResult.rows[0] || {};

        const companyData = {
            ...companyRow,
            companyName: companyRow.company_name || "",
        };

        /* ------------------------------------------------------------------ */
        /* Permission flags                                                   */
        /* ------------------------------------------------------------------ */

        const [
            canCreate,
            canUpdate,
            canDelete,
        ] = await Promise.all([
            hasPermission(user.roleId, "rfqs", "create"),
            hasPermission(user.roleId, "rfqs", "update"),
            hasPermission(user.roleId, "rfqs", "delete"),
        ]);

        return NextResponse.json({
            rfqs: historyResult.rows,

            suppliers: suppliersResult.rows,

            availableItems,

            procurementItems,

            // Active products for Direct Purchase Quotation.
            directProducts,

            company: companyData,

            permissions: {
                canCreate,
                canUpdate,
                canDelete,
            },
        });
    } catch (error) {
        console.error("GET /api/rfqs error:", error);

        return NextResponse.json(
            {
                message: getErrorMessage(error),
            },
            {
                status: getErrorStatus(error),
            }
        );
    }
}

/* -------------------------------------------------------------------------- */
/* POST: Create RFQ from PR, Procurement, Direct Purchase, or a combination   */
/* -------------------------------------------------------------------------- */

export async function POST(request) {
    let client;

    let transactionStarted = false;

    try {
        const user = await getCurrentUser();

        await requirePermission(user, "rfqs", "create");

        if (!user.companyId) {
            return NextResponse.json(
                {
                    message: "No company is assigned to your account.",
                },
                { status: 400 }
            );
        }

        const body = await request.json();

        const companyId = Number(user.companyId);
        const userId = Number(user.userId);

        const transactionDate = body.transactionDate;

        const status = String(
            body.status || "DRAFT"
        ).toUpperCase();

        const project = String(
            body.project || ""
        ).trim();

        const referenceNumber = String(
            body.referenceNumber || ""
        ).trim();

        const memo = String(
            body.memo || ""
        ).trim();

        const selectedItems = validateSelections(
            normalizeSelectedItems(body)
        );

        const supplierIds = [
            ...new Set(
                (
                    Array.isArray(body.supplierIds)
                        ? body.supplierIds
                        : []
                )
                    .map(Number)
                    .filter(
                        (id) =>
                            Number.isSafeInteger(id) &&
                            id > 0
                    )
            ),
        ];

        if (!transactionDate) {
            throw validationError(
                "Please select a transaction date."
            );
        }

        if (!ALLOWED_STATUSES.includes(status)) {
            throw validationError("Invalid RFQ status.");
        }

        if (!supplierIds.length) {
            throw validationError(
                "Please select at least one supplier."
            );
        }

        client = await pool.connect();

        await client.query("BEGIN");
        transactionStarted = true;

        /* ------------------------------------------------------------------ */
        /* Serialize RFQ number generation for this company                   */
        /* ------------------------------------------------------------------ */

        await client.query(
            `
            SELECT pg_advisory_xact_lock(
                $1::INTEGER,
                $2::INTEGER
            )
            `,
            [companyId, 741205]
        );

        /* ------------------------------------------------------------------ */
        /* Validate suppliers                                                 */
        /* ------------------------------------------------------------------ */

        const supplierCheck = await client.query(
            `
            SELECT supplier_id
            FROM suppliers
            WHERE
                supplier_id = ANY($1::INTEGER[])
                AND is_active = TRUE
            `,
            [supplierIds]
        );

        if (supplierCheck.rows.length !== supplierIds.length) {
            throw validationError(
                "One or more selected suppliers are invalid or inactive."
            );
        }

        /* ------------------------------------------------------------------ */
        /* Separate source selections                                         */
        /* ------------------------------------------------------------------ */

        const purchaseSelections = selectedItems.filter(
            (item) => item.sourceType === SOURCE_PURCHASE
        );

        const procurementSelections = selectedItems.filter(
            (item) => item.sourceType === SOURCE_PROCUREMENT
        );

        const directSelections = selectedItems.filter(
            (item) => item.sourceType === SOURCE_DIRECT
        );

        const lockedLines = [];

        /* ------------------------------------------------------------------ */
        /* 1. Purchase Requisition items                                      */
        /* ------------------------------------------------------------------ */

        if (purchaseSelections.length) {
            const ids = purchaseSelections.map(
                (item) => item.itemId
            );

            const result = await client.query(
                `
                SELECT
                    ri.requisition_item_id
                        AS source_requisition_item_id,

                    ri.requisition_id
                        AS source_requisition_id,

                    ri.product_id,
                    ri.item_description,
                    ri.uom,
                    ri.quantity,

                    pr.department AS department,
                    pr.class_name AS class_name,
                    pr.warehouse_id AS warehouse_id

                FROM purchase_requisition_items ri

                INNER JOIN purchase_requisitions pr
                    ON pr.requisition_id = ri.requisition_id

                WHERE
                    ri.requisition_item_id =
                        ANY($1::INTEGER[])

                    AND pr.company_id = $2
                    AND pr.status = 'APPROVED'

                    AND NOT EXISTS (
                        SELECT 1
                        FROM procurement_requisition_items pri
                        WHERE pri.source_requisition_item_id =
                            ri.requisition_item_id
                    )

                    AND NOT EXISTS (
                        SELECT 1
                        FROM rfq_items rfi
                        WHERE rfi.source_requisition_item_id =
                            ri.requisition_item_id
                    )

                FOR UPDATE OF ri, pr
                `,
                [ids, companyId]
            );

            if (result.rows.length !== ids.length) {
                throw validationError(
                    "One or more Purchase Requisition items are no longer available. Refresh the page and try again."
                );
            }

            lockedLines.push(
                ...result.rows.map((line) => ({
                    ...line,
                    source_type: SOURCE_PURCHASE,
                    procurement_requisition_id: null,
                    procurement_requisition_item_id: null,
                }))
            );
        }

        /* ------------------------------------------------------------------ */
        /* 2. Procurement Requisition items                                   */
        /* ------------------------------------------------------------------ */

        if (procurementSelections.length) {
            /*
             * The frontend sends the original PR item ID as sourceItemId.
             * Therefore, search by pri.source_requisition_item_id,
             * NOT pri.procurement_requisition_item_id.
             */

            const ids = procurementSelections.map(
                (item) => item.itemId
            );

            const result = await client.query(
                `
                SELECT
                    pri.procurement_requisition_item_id,

                    pri.procurement_requisition_id,

                    pri.source_requisition_id,

                    pri.source_requisition_item_id,

                    pri.product_id,

                    COALESCE(
                        pri.item_description,
                        ori.item_description
                    ) AS item_description,

                    pri.uom,
                    pri.quantity,

                    COALESCE(
                        pri.department,
                        pr.department
                    ) AS department,

                    COALESCE(
                        pri.class_name,
                        pr.class_name
                    ) AS class_name,

                    COALESCE(
                        pri.warehouse_id,
                        pr.warehouse_id
                    ) AS warehouse_id

                FROM procurement_requisition_items pri

                INNER JOIN procurement_requisitions pro
                    ON pro.procurement_requisition_id =
                        pri.procurement_requisition_id

                INNER JOIN purchase_requisitions pr
                    ON pr.requisition_id =
                        pri.source_requisition_id

                INNER JOIN purchase_requisition_items ori
                    ON ori.requisition_item_id =
                        pri.source_requisition_item_id

                WHERE
                    pri.source_requisition_item_id =
                        ANY($1::INTEGER[])

                    AND pro.company_id = $2
                    AND pro.status = 'CREATED'
                    AND pr.status = 'APPROVED'

                    AND NOT EXISTS (
                        SELECT 1
                        FROM rfq_items rfi
                        WHERE
                            rfi.source_requisition_item_id =
                                pri.source_requisition_item_id
                            OR
                            rfi.procurement_requisition_item_id =
                                pri.procurement_requisition_item_id
                    )

                FOR UPDATE OF pri, pro, pr, ori
                `,
                [ids, companyId]
            );

            if (result.rows.length !== ids.length) {
                throw validationError(
                    "One or more Procurement Requisition items are no longer available. Refresh the page and try again."
                );
            }

            lockedLines.push(
                ...result.rows.map((line) => ({
                    ...line,
                    source_type: SOURCE_PROCUREMENT,
                }))
            );
        }

        /* ------------------------------------------------------------------ */
        /* 3. Direct Purchase products                                        */
        /* ------------------------------------------------------------------ */

        if (directSelections.length) {
            const productIds = directSelections.map(
                (item) => item.itemId
            );

            const result = await client.query(
                `
                SELECT
                    p.product_id,

                    p.product_name,

                    COALESCE(
                        p.purchase_description,
                        p.description,
                        ''
                    ) AS item_description,

                    COALESCE(
                        NULLIF(p.purchase_unit, ''),
                        NULLIF(p.unit, ''),
                        'PCS'
                    ) AS uom,

                    p.is_active

                FROM products p

                WHERE
                    p.product_id = ANY($1::INTEGER[])
                    AND p.is_active = TRUE

                FOR UPDATE OF p
                `,
                [productIds]
            );

            if (result.rows.length !== productIds.length) {
                throw validationError(
                    "One or more selected products are invalid or inactive. Refresh the page and try again."
                );
            }

            const selectedQuantityByProduct = new Map(
                directSelections.map((item) => [
                    item.itemId,
                    item.quantity,
                ])
            );

            lockedLines.push(
                ...result.rows.map((product) => ({
                    source_type: SOURCE_DIRECT,

                    // Direct lines must not reference requisitions.
                    source_requisition_id: null,
                    source_requisition_item_id: null,
                    procurement_requisition_id: null,
                    procurement_requisition_item_id: null,

                    product_id: product.product_id,

                    item_description: product.item_description,

                    uom: product.uom,

                    quantity: selectedQuantityByProduct.get(
                        product.product_id
                    ),

                    department: null,
                    class_name: null,
                    warehouse_id: null,
                }))
            );
        }

        /* ------------------------------------------------------------------ */
        /* Final duplicate validation                                         */
        /* ------------------------------------------------------------------ */

        const originalSourceIds = lockedLines
            .filter(
                (line) =>
                    line.source_requisition_item_id !== null &&
                    line.source_requisition_item_id !== undefined
            )
            .map((line) =>
                Number(line.source_requisition_item_id)
            );

        if (
            new Set(originalSourceIds).size !==
            originalSourceIds.length
        ) {
            throw validationError(
                "The same original Purchase Requisition item cannot be added twice to one RFQ."
            );
        }

        if (originalSourceIds.length) {
            const duplicateCheck = await client.query(
                `
                SELECT source_requisition_item_id
                FROM rfq_items
                WHERE source_requisition_item_id =
                    ANY($1::INTEGER[])
                `,
                [originalSourceIds]
            );

            if (duplicateCheck.rows.length) {
                throw validationError(
                    "One or more original Purchase Requisition items have already been added to an RFQ."
                );
            }
        }

        /* ------------------------------------------------------------------ */
        /* Generate RFQ transaction number                                    */
        /* ------------------------------------------------------------------ */

        const numberResult = await client.query(
            `
            SELECT
                COALESCE(
                    MAX(
                        NULLIF(
                            REGEXP_REPLACE(
                                transaction_number,
                                '[^0-9]',
                                '',
                                'g'
                            ),
                            ''
                        )::BIGINT
                    ),
                    0
                ) + 1 AS next_number
            FROM rfqs
            WHERE company_id = $1
            `,
            [companyId]
        );

        const nextNumber = Number(
            numberResult.rows[0].next_number
        );

        const transactionNumber =
            `RFQ-${String(nextNumber).padStart(6, "0")}`;

        /* ------------------------------------------------------------------ */
        /* Insert RFQ header                                                   */
        /* ------------------------------------------------------------------ */

        const headerResult = await client.query(
            `
            INSERT INTO rfqs (
                company_id,
                transaction_number,
                transaction_date,
                status,
                project,
                reference_number,
                memo,
                created_by
            )
            VALUES (
                $1, $2, $3, $4, $5, $6, $7, $8
            )
            RETURNING *
            `,
            [
                companyId,
                transactionNumber,
                transactionDate,
                status,
                project || null,
                referenceNumber || null,
                memo || null,
                userId,
            ]
        );

        const rfq = headerResult.rows[0];

        /* ------------------------------------------------------------------ */
        /* Insert invited suppliers                                            */
        /* ------------------------------------------------------------------ */

        for (const supplierId of supplierIds) {
            await client.query(
                `
                INSERT INTO rfq_vendors (
                    rfq_id,
                    supplier_id,
                    status
                )
                VALUES ($1, $2, 'INVITED')
                `,
                [
                    rfq.rfq_id,
                    supplierId,
                ]
            );
        }

        /* ------------------------------------------------------------------ */
        /* Insert RFQ transaction lines                                       */
        /* ------------------------------------------------------------------ */

        for (const line of lockedLines) {
            await client.query(
                `
                INSERT INTO rfq_items (
                    rfq_id,
                    source_requisition_id,
                    source_requisition_item_id,
                    product_id,
                    item_description,
                    uom,
                    quantity,
                    department,
                    class_name,
                    warehouse_id,
                    source_type,
                    procurement_requisition_id,
                    procurement_requisition_item_id
                )
                VALUES (
                    $1, $2, $3, $4, $5, $6, $7,
                    $8, $9, $10, $11, $12, $13
                )
                `,
                [
                    rfq.rfq_id,

                    line.source_requisition_id,

                    line.source_requisition_item_id,

                    line.product_id,

                    line.item_description,

                    line.uom,

                    line.quantity,

                    line.department,

                    line.class_name,

                    line.warehouse_id,

                    line.source_type,

                    line.procurement_requisition_id,

                    line.procurement_requisition_item_id,
                ]
            );
        }

        await client.query("COMMIT");
        transactionStarted = false;

        return NextResponse.json(
            {
                message: "RFQ created successfully.",
                rfq: {
                    rfqId: rfq.rfq_id,
                    transactionNumber: rfq.transaction_number,
                },
            },
            { status: 201 }
        );
    } catch (error) {
        if (transactionStarted && client) {
            await client.query("ROLLBACK").catch(() => {});
        }

        console.error("POST /api/rfqs error:", error);

        return NextResponse.json(
            {
                message: getErrorMessage(error),
            },
            {
                status: getErrorStatus(error),
            }
        );
    } finally {
        if (client) {
            client.release();
        }
    }
}
