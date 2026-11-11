
import { NextResponse } from "next/server";
import pool from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { requirePermission } from "@/lib/permissions";

export const dynamic = "force-dynamic";

const ALLOWED_STATUSES = [
    "DRAFT",
    "APPROVED",
    "SENT",
    "PARTIALLY_RECEIVED",
    "RECEIVED",
    "CLOSED",
    "CANCELLED",
];

const SOURCE_PURCHASE = "PURCHASE_REQUISITION";
const SOURCE_PROCUREMENT = "PROCUREMENT_REQUISITION";
const SOURCE_DIRECT = "DIRECT";

const ALLOWED_SOURCE_TYPES = [
    SOURCE_PURCHASE,
    SOURCE_PROCUREMENT,
    SOURCE_DIRECT,
];

/* -------------------------------------------------------------------------- */
/* Helpers                                                                    */
/* -------------------------------------------------------------------------- */

function validationError(message, status = 400) {
    const error = new Error(message);
    error.status = status;
    return error;
}

function apiError(error) {
    console.error("RFQ detail API error:", error);

    if (error.message === "UNAUTHORIZED") {
        return NextResponse.json(
            {
                success: false,
                message: "Please log in again.",
            },
            { status: 401 }
        );
    }

    if (error.message === "FORBIDDEN") {
        return NextResponse.json(
            {
                success: false,
                message: "You do not have permission to perform this action.",
            },
            { status: 403 }
        );
    }

    const status =
        error.status ||
        (
            error.code === "23505" ? 409 :
            error.code === "23503" ? 400 :
            error.code === "23514" ? 400 :
            500
        );

    return NextResponse.json(
        {
            success: false,
            message: error.message || "RFQ operation failed.",
        },
        { status }
    );
}

/* -------------------------------------------------------------------------- */
/* Normalize date                                                             */
/* -------------------------------------------------------------------------- */

function normalizeDate(value) {
    if (value === undefined || value === null || value === "") {
        return null;
    }

    const dateString = String(value).trim().slice(0, 10);

    // Require YYYY-MM-DD format.
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateString)) {
        return null;
    }

    // Use UTC to prevent timezone-related date changes.
    const date = new Date(`${dateString}T00:00:00.000Z`);

    if (Number.isNaN(date.getTime())) {
        return null;
    }

    // Validate the actual calendar date.
    if (date.toISOString().slice(0, 10) !== dateString) {
        return null;
    }

    return dateString;
}
/* -------------------------------------------------------------------------- */
/* Normalize IDs                                                              */
/* -------------------------------------------------------------------------- */

function normalizeIds(values) {
    if (!Array.isArray(values)) return [];

    const ids = values.map(Number);

    if (ids.some((id) => !Number.isSafeInteger(id) || id <= 0)) {
        throw validationError("Invalid item or supplier selection.");
    }

    return [...new Set(ids)];
}

/* -------------------------------------------------------------------------- */
/* Normalize selected RFQ items                                               */
/* -------------------------------------------------------------------------- */

function normalizeSelectedItems(body) {
    let selections = [];

    if (Array.isArray(body.selectedItems)) {
        selections = body.selectedItems.map((item) => {
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
                        item.itemId ||
                        item.sourceItemId ||
                        item.seq_id ||
                        item.id
                    ),

                    quantity: Number(item.quantity),
                };
            }

            return {
                sourceType,

                itemId: Number(
                    item.itemId ||
                    item.sourceItemId ||
                    item.source_requisition_item_id ||
                    item.seq_id ||
                    item.id
                ),

                quantity: null,
            };
        });
    } else if (Array.isArray(body.selectedItemIds)) {
        selections = body.selectedItemIds.map((id) => ({
            sourceType: SOURCE_PURCHASE,
            itemId: Number(id),
            quantity: null,
        }));
    }

    if (!selections.length) {
        throw validationError(
            "Please select at least one RFQ item."
        );
    }

    const seen = new Set();

    for (const item of selections) {
        if (!ALLOWED_SOURCE_TYPES.includes(item.sourceType)) {
            throw validationError("Invalid RFQ source type.");
        }

        if (!Number.isSafeInteger(item.itemId) || item.itemId <= 0) {
            throw validationError("Invalid selected item.");
        }

        if (item.sourceType === SOURCE_DIRECT) {
            if (
                !Number.isFinite(item.quantity) ||
                item.quantity <= 0
            ) {
                throw validationError(
                    "Enter a valid quantity greater than zero for every Direct Purchase item."
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
     * A PR item cannot be selected through both requisition workflows.
     * Direct product IDs are independent.
     */

    const requisitionSelections = selections.filter(
        (item) => item.sourceType !== SOURCE_DIRECT
    );

    const originalIds = requisitionSelections.map(
        (item) => item.itemId
    );

    if (new Set(originalIds).size !== originalIds.length) {
        throw validationError(
            "The same original Purchase Requisition item cannot be selected more than once."
        );
    }

    return selections;
}

/* -------------------------------------------------------------------------- */
/* Route parameters                                                            */
/* -------------------------------------------------------------------------- */

async function getParams(context) {
    const params = await context.params;
    const id = Number(params.id);

    if (!Number.isSafeInteger(id) || id <= 0) {
        throw validationError("Invalid RFQ ID.");
    }

    return id;
}

/* -------------------------------------------------------------------------- */
/* Source labels                                                              */
/* -------------------------------------------------------------------------- */

function getSourceLabel(sourceType) {
    switch (sourceType) {
        case SOURCE_PURCHASE:
            return "Purchase Requisition";

        case SOURCE_PROCUREMENT:
            return "Requisition for Procurement";

        case SOURCE_DIRECT:
            return "Direct Purchase";

        default:
            return "Unknown Source";
    }
}

function getCreatedFromLabel(sourceTypes) {
    if (!sourceTypes.length) return "—";

    if (sourceTypes.length > 1) {
        return "Multiple Sources";
    }

    return getSourceLabel(sourceTypes[0]);
}

/* -------------------------------------------------------------------------- */
/* GET: Load one RFQ for edit, view, and report                               */
/* -------------------------------------------------------------------------- */

export async function GET(request, context) {
    try {
        const user = await getCurrentUser();

        await requirePermission(user, "rfqs", "view");

        if (!user.companyId) {
            throw validationError("Company information is missing.");
        }

        const id = await getParams(context);

        const headerResult = await pool.query(
            `
            SELECT
                r.*,
                c.company_name

            FROM rfqs r

            LEFT JOIN companies c
                ON c.company_id = r.company_id

            WHERE
                r.rfq_id = $1
                AND r.company_id = $2

            LIMIT 1
            `,
            [id, user.companyId]
        );

        if (!headerResult.rows.length) {
            return NextResponse.json(
                {
                    success: false,
                    message: "RFQ not found.",
                },
                { status: 404 }
            );
        }

        const [itemsResult, vendorsResult] = await Promise.all([
            /* RFQ items */
            pool.query(
                `
                SELECT
                    i.rfq_item_id,

                    COALESCE(
                        i.source_type,
                        '${SOURCE_PURCHASE}'
                    ) AS source_type,

                    i.source_requisition_id,
                    i.source_requisition_item_id,

                    i.procurement_requisition_id,
                    i.procurement_requisition_item_id,

                    CASE
                        WHEN i.source_type = '${SOURCE_PROCUREMENT}'
                            THEN i.procurement_requisition_item_id

                        WHEN i.source_type = '${SOURCE_DIRECT}'
                            THEN i.product_id

                        ELSE i.source_requisition_item_id
                    END AS seq_id,

                    i.product_id,

                    i.item_description,
                    i.uom,
                    i.quantity,
                    i.department,
                    i.class_name,
                    i.warehouse_id,

                    pr.transaction_number AS req_number,
                    pr.transaction_date AS req_date,
                    pr.project AS source_project,
                    pr.reference_number AS source_reference,

                    pro.transaction_number
                        AS procurement_transaction_number,

                    pro.transaction_date
                        AS procurement_transaction_date,

                    COALESCE(
                        p.sku,
                        p.product_name,
                        ''
                    ) AS item,

                    COALESCE(
                        ori.item_balance,
                        i.quantity
                    ) AS item_balance,

                    w.warehouse_name AS location,

                    p.product_name,
                    p.sku,
                    p.barcode

                FROM rfq_items i

                LEFT JOIN purchase_requisitions pr
                    ON pr.requisition_id =
                        i.source_requisition_id

                LEFT JOIN purchase_requisition_items ori
                    ON ori.requisition_item_id =
                        i.source_requisition_item_id

                LEFT JOIN procurement_requisitions pro
                    ON pro.procurement_requisition_id =
                        i.procurement_requisition_id

                LEFT JOIN products p
                    ON p.product_id = i.product_id

                LEFT JOIN warehouses w
                    ON w.warehouse_id = i.warehouse_id

                WHERE i.rfq_id = $1

                ORDER BY i.rfq_item_id
                `,
                [id]
            ),

            /* RFQ suppliers */
            pool.query(
                `
                SELECT
                    v.rfq_vendor_id,
                    v.supplier_id,
                    v.status,
                    v.response_date,
                    v.validity_date,
                    v.delivery_days,
                    v.payment_terms,
                    v.notes,

                    s.supplier_code,
                    s.supplier_name,
                    s.phone,
                    s.email,
                    s.address

                FROM rfq_vendors v

                INNER JOIN suppliers s
                    ON s.supplier_id = v.supplier_id

                WHERE v.rfq_id = $1

                ORDER BY s.supplier_name
                `,
                [id]
            ),
        ]);

        const header = headerResult.rows[0];

        const items = itemsResult.rows.map((item) => {
            const sourceType =
                item.source_type || SOURCE_PURCHASE;

            let sourceDocumentNumber = item.req_number;
            let sourceDocumentDate = item.req_date;

            if (sourceType === SOURCE_PROCUREMENT) {
                sourceDocumentNumber =
                    item.procurement_transaction_number;

                sourceDocumentDate =
                    item.procurement_transaction_date;
            }

            if (sourceType === SOURCE_DIRECT) {
                sourceDocumentNumber = "Direct Purchase";
                sourceDocumentDate = null;
            }

            return {
                ...item,

                source_type: sourceType,

                source_label: getSourceLabel(sourceType),

                source_document_number: sourceDocumentNumber,

                source_document_date: sourceDocumentDate,

                source_item_id:
                    sourceType === SOURCE_DIRECT
                        ? item.product_id
                        : sourceType === SOURCE_PROCUREMENT
                            ? item.procurement_requisition_item_id
                            : item.source_requisition_item_id,
            };
        });

        const sourceTypes = [
            ...new Set(items.map((item) => item.source_type)),
        ];

        const createdFrom = getCreatedFromLabel(sourceTypes);

        return NextResponse.json({
            success: true,

            rfq: {
                rfq_id: header.rfq_id,
                transaction_number: header.transaction_number,
                transaction_date: header.transaction_date,
                status: header.status,
                memo: header.memo,
                project: header.project,
                reference_number: header.reference_number,

                created_from: createdFrom,

                company_name: header.company_name || "",

                items,
                vendors: vendorsResult.rows,
            },
        });
    } catch (error) {
        return apiError(error);
    }
}

/* -------------------------------------------------------------------------- */
/* PATCH: Update an existing DRAFT RFQ                                        */
/* -------------------------------------------------------------------------- */

export async function PATCH(request, context) {
    let client;
    let transactionStarted = false;

    try {
        const user = await getCurrentUser();

        await requirePermission(user, "rfqs", "update");

        if (!user.companyId) {
            throw validationError("Company information is missing.");
        }

        const id = await getParams(context);
        const body = await request.json();

        /*
         * FIX:
         * Accept both transactionDate and transaction_date.
         */
        const transactionDate = normalizeDate(
            body.transactionDate ??
            body.transaction_date
        );

        if (!transactionDate) {
            throw validationError(
                "Please provide a valid transaction date."
            );
        }

        const selectedItems = normalizeSelectedItems(body);
        const supplierIds = normalizeIds(body.supplierIds);

        if (!supplierIds.length) {
            throw validationError("Select at least one supplier.");
        }

        const status = String(
            body.status || "DRAFT"
        ).toUpperCase();

        if (!ALLOWED_STATUSES.includes(status)) {
            throw validationError("Invalid RFQ status.");
        }

        const purchaseSelections = selectedItems.filter(
            (item) => item.sourceType === SOURCE_PURCHASE
        );

        const procurementSelections = selectedItems.filter(
            (item) => item.sourceType === SOURCE_PROCUREMENT
        );

        const directSelections = selectedItems.filter(
            (item) => item.sourceType === SOURCE_DIRECT
        );

        client = await pool.connect();

        await client.query("BEGIN");
        transactionStarted = true;

        /* Lock RFQ and verify company ownership. */
        const currentResult = await client.query(
            `
            SELECT rfq_id, status
            FROM rfqs
            WHERE
                rfq_id = $1
                AND company_id = $2
            FOR UPDATE
            `,
            [id, user.companyId]
        );

        if (!currentResult.rows.length) {
            throw validationError("RFQ not found.", 404);
        }

        if (currentResult.rows[0].status !== "DRAFT") {
            throw validationError(
                "Only DRAFT RFQs can be edited."
            );
        }

        /* Protect existing supplier quotations. */
        const quotationCheck = await client.query(
            `
            SELECT COUNT(*)::INTEGER AS quotation_count

            FROM rfq_vendor_quotes q

            INNER JOIN rfq_vendors v
                ON v.rfq_vendor_id = q.rfq_vendor_id

            WHERE v.rfq_id = $1
            `,
            [id]
        );

        if (Number(quotationCheck.rows[0].quotation_count) > 0) {
            throw validationError(
                "This RFQ already has supplier quotation records. Its items and invited suppliers cannot be replaced. Preserve the existing quotation records before making changes."
            );
        }

        /* Validate suppliers. */
        const supplierResult = await client.query(
            `
            SELECT supplier_id
            FROM suppliers
            WHERE
                supplier_id = ANY($1::INTEGER[])
                AND COALESCE(is_active, TRUE) = TRUE
            FOR SHARE
            `,
            [supplierIds]
        );

        if (supplierResult.rows.length !== supplierIds.length) {
            throw validationError(
                "One or more suppliers are inactive or unavailable."
            );
        }

        const sourceLines = [];

        /* ------------------------------------------------------------------ */
        /* 1. Purchase Requisition items                                       */
        /* ------------------------------------------------------------------ */

        if (purchaseSelections.length) {
            const directIds = purchaseSelections.map(
                (item) => item.itemId
            );

            const directResult = await client.query(
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
                    ri.requisition_item_id = ANY($1::INTEGER[])
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
                        FROM rfq_items other
                        WHERE
                            other.source_requisition_item_id =
                                ri.requisition_item_id
                            AND other.rfq_id <> $3
                    )

                ORDER BY ri.requisition_item_id

                FOR UPDATE OF ri, pr
                `,
                [directIds, user.companyId, id]
            );

            if (directResult.rows.length !== directIds.length) {
                throw validationError(
                    "Some selected Purchase Requisition items are no longer available. Refresh and try again."
                );
            }

            sourceLines.push(
                ...directResult.rows.map((item) => ({
                    ...item,
                    source_type: SOURCE_PURCHASE,
                    procurement_requisition_id: null,
                    procurement_requisition_item_id: null,
                }))
            );
        }

        /* ------------------------------------------------------------------ */
        /* 2. Procurement Requisition items                                    */
        /* ------------------------------------------------------------------ */

        if (procurementSelections.length) {
            const procurementIds = procurementSelections.map(
                (item) => item.itemId
            );

            const procurementResult = await client.query(
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
                    pri.procurement_requisition_item_id =
                        ANY($1::INTEGER[])

                    AND pro.company_id = $2
                    AND pro.status = 'CREATED'

                    AND pr.company_id = $2
                    AND pr.status = 'APPROVED'

                    AND NOT EXISTS (
                        SELECT 1
                        FROM rfq_items other
                        WHERE
                            (
                                other.source_requisition_item_id =
                                    pri.source_requisition_item_id
                                OR
                                other.procurement_requisition_item_id =
                                    pri.procurement_requisition_item_id
                            )
                            AND other.rfq_id <> $3
                    )

                ORDER BY pri.procurement_requisition_item_id

                FOR UPDATE OF pri, pro, pr, ori
                `,
                [procurementIds, user.companyId, id]
            );

            if (
                procurementResult.rows.length !==
                procurementIds.length
            ) {
                throw validationError(
                    "Some selected Procurement Requisition items are no longer available. Refresh and try again."
                );
            }

            sourceLines.push(
                ...procurementResult.rows.map((item) => ({
                    ...item,
                    source_type: SOURCE_PROCUREMENT,
                }))
            );
        }

        /* ------------------------------------------------------------------ */
        /* 3. Direct Purchase products                                         */
        /* ------------------------------------------------------------------ */

        if (directSelections.length) {
            const productIds = directSelections.map(
                (item) => item.itemId
            );

            const productResult = await client.query(
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

                ORDER BY p.product_id

                FOR UPDATE OF p
                `,
                [productIds]
            );

            if (productResult.rows.length !== productIds.length) {
                throw validationError(
                    "One or more selected products are inactive or unavailable. Refresh and try again."
                );
            }

            const quantityByProduct = new Map(
                directSelections.map((item) => [
                    item.itemId,
                    item.quantity,
                ])
            );

            sourceLines.push(
                ...productResult.rows.map((product) => ({
                    source_type: SOURCE_DIRECT,

                    source_requisition_id: null,
                    source_requisition_item_id: null,
                    procurement_requisition_id: null,
                    procurement_requisition_item_id: null,

                    product_id: product.product_id,

                    item_description: product.item_description,

                    uom: product.uom,

                    quantity: quantityByProduct.get(
                        product.product_id
                    ),

                    department: null,
                    class_name: null,
                    warehouse_id: null,
                }))
            );
        }

        /* ------------------------------------------------------------------ */
        /* Validate duplicate original PR items                                */
        /* ------------------------------------------------------------------ */

        const originalSourceIds = sourceLines
            .filter(
                (item) =>
                    item.source_requisition_item_id !== null &&
                    item.source_requisition_item_id !== undefined
            )
            .map((item) =>
                Number(item.source_requisition_item_id)
            );

        if (
            new Set(originalSourceIds).size !==
            originalSourceIds.length
        ) {
            throw validationError(
                "The same original Purchase Requisition item cannot be added twice."
            );
        }

        if (originalSourceIds.length) {
            const duplicateResult = await client.query(
                `
                SELECT source_requisition_item_id
                FROM rfq_items
                WHERE
                    source_requisition_item_id = ANY($1::INTEGER[])
                    AND rfq_id <> $2
                `,
                [originalSourceIds, id]
            );

            if (duplicateResult.rows.length) {
                throw validationError(
                    "One or more selected items have already been assigned to another RFQ."
                );
            }
        }

        /* ------------------------------------------------------------------ */
        /* Update RFQ header                                                   */
        /* ------------------------------------------------------------------ */

        await client.query(
            `
            UPDATE rfqs
            SET
                transaction_date = $1,
                status = $2,
                memo = $3,
                project = $4,
                reference_number = $5,
                updated_at = NOW()

            WHERE
                rfq_id = $6
                AND company_id = $7
            `,
            [
                transactionDate,
                status,
                String(body.memo || "").trim() || null,
                String(body.project || "").trim() || null,
                String(
                    body.referenceNumber ??
                    body.reference_number ??
                    ""
                ).trim() || null,
                id,
                user.companyId,
            ]
        );

        /* ------------------------------------------------------------------ */
        /* Replace existing RFQ lines                                         */
        /* ------------------------------------------------------------------ */

        await client.query(
            `
            DELETE FROM rfq_items
            WHERE rfq_id = $1
            `,
            [id]
        );

        /* ------------------------------------------------------------------ */
        /* Replace invited suppliers                                           */
        /* ------------------------------------------------------------------ */

        await client.query(
            `
            DELETE FROM rfq_vendors
            WHERE rfq_id = $1
            `,
            [id]
        );

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
                [id, supplierId]
            );
        }

        /* ------------------------------------------------------------------ */
        /* Insert updated RFQ lines                                           */
        /* ------------------------------------------------------------------ */

        for (const item of sourceLines) {
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
                    id,

                    item.source_requisition_id,
                    item.source_requisition_item_id,

                    item.product_id,
                    item.item_description,
                    item.uom,
                    item.quantity,

                    item.department,
                    item.class_name,
                    item.warehouse_id,

                    item.source_type,
                    item.procurement_requisition_id,
                    item.procurement_requisition_item_id,
                ]
            );
        }

        await client.query("COMMIT");
        transactionStarted = false;

        return NextResponse.json({
            success: true,
            message: "RFQ updated successfully.",
        });
    } catch (error) {
        if (transactionStarted && client) {
            await client.query("ROLLBACK").catch(() => {});
        }

        return apiError(error);
    } finally {
        client?.release();
    }
}

/* -------------------------------------------------------------------------- */
/* DELETE: Delete a DRAFT RFQ                                                 */
/* -------------------------------------------------------------------------- */

export async function DELETE(request, context) {
    let client;
    let transactionStarted = false;

    try {
        const user = await getCurrentUser();

        await requirePermission(user, "rfqs", "delete");

        if (!user.companyId) {
            throw validationError("Company information is missing.");
        }

        const id = await getParams(context);

        client = await pool.connect();

        await client.query("BEGIN");
        transactionStarted = true;

        const currentResult = await client.query(
            `
            SELECT rfq_id, status
            FROM rfqs
            WHERE
                rfq_id = $1
                AND company_id = $2
            FOR UPDATE
            `,
            [id, user.companyId]
        );

        if (!currentResult.rows.length) {
            throw validationError("RFQ not found.", 404);
        }

        if (currentResult.rows[0].status !== "DRAFT") {
            throw validationError(
                "Only DRAFT RFQs can be deleted."
            );
        }

        /*
         * Protect supplier quotation records.
         * The RFQ must not be deleted if supplier quotes exist.
         */

        const quotationCheck = await client.query(
            `
            SELECT COUNT(*)::INTEGER AS quotation_count
            FROM rfq_vendor_quotes q
            INNER JOIN rfq_vendors v
                ON v.rfq_vendor_id = q.rfq_vendor_id
            WHERE v.rfq_id = $1
            `,
            [id]
        );

        if (Number(quotationCheck.rows[0].quotation_count) > 0) {
            throw validationError(
                "This RFQ cannot be deleted because supplier quotation records already exist."
            );
        }

        /*
         * Delete RFQ lines and invited suppliers first.
         * This avoids relying on cascade behavior for these records.
         */

        await client.query(
            `
            DELETE FROM rfq_items
            WHERE rfq_id = $1
            `,
            [id]
        );

        await client.query(
            `
            DELETE FROM rfq_vendors
            WHERE rfq_id = $1
            `,
            [id]
        );

        await client.query(
            `
            DELETE FROM rfqs
            WHERE
                rfq_id = $1
                AND company_id = $2
            `,
            [id, user.companyId]
        );

        await client.query("COMMIT");
        transactionStarted = false;

        return NextResponse.json({
            success: true,
            message: "RFQ deleted successfully.",
        });
    } catch (error) {
        if (transactionStarted && client) {
            await client.query("ROLLBACK").catch(() => {});
        }

        return apiError(error);
    } finally {
        client?.release();
    }
}