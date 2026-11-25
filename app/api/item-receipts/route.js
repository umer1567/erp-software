
import { NextResponse } from "next/server";
import pool, { getTenantDb } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { requirePermission } from "@/lib/permissions";

export const dynamic = "force-dynamic";

/* -------------------------------------------------------------------------- */
/* Helpers                                                                    */
/* -------------------------------------------------------------------------- */

function positiveId(value) {
    const number = Number(value);
    return Number.isInteger(number) && number > 0 ? number : null;
}

function validDate(value) {
    return /^\d{4}-\d{2}-\d{2}$/.test(String(value || ""));
}

function validQuantity(value) {
    const number = Number(value);
    return Number.isFinite(number) && number > 0;
}

function validCost(value) {
    const number = Number(value);
    return Number.isFinite(number) && number >= 0;
}

function validationError(message, status = 400) {
    return NextResponse.json({ message }, { status });
}

function apiError(error) {
    console.error("ITEM RECEIPTS API ERROR:", error);

    if (error.message === "UNAUTHORIZED") {
        return validationError(
            "You are not authorized. Please log in.",
            401
        );
    }

    if (error.message === "FORBIDDEN") {
        return validationError(
            "You do not have permission to perform this action.",
            403
        );
    }

    if (error.status) {
        return validationError(error.message, error.status);
    }

    return validationError(
        error.message || "Internal server error.",
        500
    );
}

function throwHttpError(message, status = 400) {
    const error = new Error(message);
    error.status = status;
    throw error;
}

/* -------------------------------------------------------------------------- */
/* GET: LIST ITEM RECEIPTS AND DROPDOWN DATA                                  */
/* -------------------------------------------------------------------------- */

export async function GET() {
    try {
        const user = await getCurrentUser();

        if (!user) {
            return validationError("Unauthorized.", 401);
        }

        await requirePermission(user, "item_receipts", "view");

        const companyId = positiveId(
            user.companyId || user.company_id
        );

        if (!companyId) {
            return validationError(
                "Your account is not assigned to a valid company.",
                400
            );
        }

        const db = await getTenantDb(user);

        const [
            receiptsResult,
            suppliersResult,
            warehousesResult,
            purchaseOrdersResult,
            pendingReceiptsResult,
        ] = await Promise.all([
            /* ------------------------------------------------------------ */
            /* 1. Item Receipt history: hide archived receipts              */
            /* ------------------------------------------------------------ */

            db.query(
                `
                SELECT
                    ir.*,
                    s.supplier_name,
                    w.warehouse_name,
                    po.purchase_order_number,

                    COALESCE(
                        receipt_totals.item_count,
                        0
                    )::INTEGER AS item_count,

                    COALESCE(
                        receipt_totals.total_quantity,
                        0
                    ) AS total_quantity

                FROM item_receipts ir

                LEFT JOIN suppliers s
                    ON s.supplier_id = ir.supplier_id

                LEFT JOIN warehouses w
                    ON w.warehouse_id = ir.warehouse_id

                LEFT JOIN purchase_orders po
                    ON po.purchase_order_id = ir.purchase_order_id

                LEFT JOIN LATERAL (
                    SELECT
                        COUNT(*) AS item_count,
                        COALESCE(
                            SUM(iri.quantity_received),
                            0
                        ) AS total_quantity
                    FROM item_receipt_items iri
                    WHERE iri.item_receipt_id = ir.item_receipt_id
                ) receipt_totals ON TRUE

                WHERE ir.company_id = $1
                  AND ir.deleted_at IS NULL

                ORDER BY ir.item_receipt_id DESC
                `,
                [companyId]
            ),

            /* ------------------------------------------------------------ */
            /* 2. Active suppliers only                                      */
            /* ------------------------------------------------------------ */

            db.query(
                `
                SELECT
                    supplier_id,
                    supplier_code,
                    supplier_name,
                    phone,
                    email,
                    address

                FROM suppliers

                WHERE COALESCE(is_active, TRUE) = TRUE
                  AND deleted_at IS NULL

                ORDER BY supplier_name
                `
            ),

            /* ------------------------------------------------------------ */
            /* 3. Active warehouses only                                     */
            /* ------------------------------------------------------------ */

            db.query(
                `
                SELECT
                    warehouse_id,
                    warehouse_code,
                    warehouse_name,
                    location

                FROM warehouses

                WHERE COALESCE(is_active, TRUE) = TRUE
                  AND deleted_at IS NULL

                ORDER BY warehouse_name
                `
            ),

            /* ------------------------------------------------------------ */
            /* 4. Approved, active Purchase Orders only                     */
            /* ------------------------------------------------------------ */

            db.query(
                `
                SELECT
                    po.purchase_order_id,
                    po.purchase_order_number,
                    po.supplier_id,
                    s.supplier_name,
                    po.order_date,
                    po.expected_delivery_date,
                    po.status,
                    po.currency_code,
                    po.exchange_rate,
                    po.grand_total

                FROM purchase_orders po

                LEFT JOIN suppliers s
                    ON s.supplier_id = po.supplier_id

                WHERE po.company_id = $1
                  AND UPPER(COALESCE(po.status, '')) = 'APPROVED'
                  AND po.deleted_at IS NULL
                  AND COALESCE(s.is_active, TRUE) = TRUE
                  AND s.deleted_at IS NULL

                ORDER BY po.purchase_order_id DESC
                `,
                [companyId]
            ),

            /* ------------------------------------------------------------ */
            /* 5. Active Pending Item Receipts only                          */
            /* ------------------------------------------------------------ */

            db.query(
                `
                SELECT
                    pir.pending_item_receipt_id,
                    pir.receipt_number,
                    pir.supplier_id,
                    s.supplier_name,
                    pir.purchase_order_id,
                    po.purchase_order_number,
                    pir.document_date,
                    pir.expected_receipt_date,
                    pir.status

                FROM pending_item_receipts pir

                LEFT JOIN suppliers s
                    ON s.supplier_id = pir.supplier_id

                LEFT JOIN purchase_orders po
                    ON po.purchase_order_id = pir.purchase_order_id

                WHERE pir.company_id = $1
                  AND pir.deleted_at IS NULL
                  AND UPPER(COALESCE(pir.status, '')) NOT IN (
                      'CANCELLED',
                      'CLOSED'
                  )
                  AND COALESCE(s.is_active, TRUE) = TRUE
                  AND s.deleted_at IS NULL
                  AND (
                      pir.purchase_order_id IS NULL
                      OR (
                          po.deleted_at IS NULL
                          AND UPPER(COALESCE(po.status, '')) = 'APPROVED'
                      )
                  )

                ORDER BY pir.pending_item_receipt_id DESC
                `,
                [companyId]
            ),
        ]);

        return NextResponse.json({
            success: true,
            receipts: receiptsResult.rows,
            suppliers: suppliersResult.rows,
            warehouses: warehousesResult.rows,
            purchaseOrders: purchaseOrdersResult.rows,
            pendingReceipts: pendingReceiptsResult.rows,
        });
    } catch (error) {
        return apiError(error);
    }
}

/* -------------------------------------------------------------------------- */
/* POST: CREATE ITEM RECEIPT                                                  */
/* -------------------------------------------------------------------------- */

export async function POST(request) {
    let client;
    let transactionStarted = false;

    try {
        const user = await getCurrentUser();

        if (!user) {
            return validationError("Unauthorized.", 401);
        }

        await requirePermission(user, "item_receipts", "create");

        const companyId = positiveId(
            user.companyId || user.company_id
        );

        const userId = positiveId(
            user.userId || user.user_id
        );

        if (!companyId || !userId) {
            return validationError(
                "Invalid company or user information.",
                400
            );
        }

        const body = await request.json();

        const supplierId = positiveId(body.supplierId);
        const warehouseId = positiveId(body.warehouseId);

        const sourceType = String(
            body.sourceType || "MANUAL"
        ).trim().toUpperCase();

        const purchaseOrderId = body.purchaseOrderId
            ? positiveId(body.purchaseOrderId)
            : null;

        const pendingItemReceiptId = body.pendingItemReceiptId
            ? positiveId(body.pendingItemReceiptId)
            : null;

        const receiptDate = body.receiptDate;

        const remarks = String(
            body.remarks || ""
        ).trim();

        const items = body.items;

        /* ---------------------------------------------------------------- */
        /* Basic validation                                                  */
        /* ---------------------------------------------------------------- */

        if (
            ![
                "MANUAL",
                "PURCHASE_ORDER",
                "PENDING_ITEM_RECEIPT",
            ].includes(sourceType)
        ) {
            return validationError("Invalid receipt source type.");
        }

        if (!supplierId) {
            return validationError("Please select a supplier.");
        }

        if (!warehouseId) {
            return validationError("Please select a warehouse.");
        }

        if (!validDate(receiptDate)) {
            return validationError(
                "Please provide a valid receipt date."
            );
        }

        if (!Array.isArray(items) || items.length === 0) {
            return validationError(
                "Please add at least one item."
            );
        }

        if (
            sourceType === "PURCHASE_ORDER" &&
            !purchaseOrderId
        ) {
            return validationError(
                "Please select a Purchase Order."
            );
        }

        if (
            sourceType === "PENDING_ITEM_RECEIPT" &&
            !pendingItemReceiptId
        ) {
            return validationError(
                "Please select a Pending Item Receipt."
            );
        }

        if (
            sourceType === "MANUAL" &&
            (purchaseOrderId || pendingItemReceiptId)
        ) {
            return validationError(
                "Manual receipts cannot reference another source document."
            );
        }

        if (
            sourceType === "PURCHASE_ORDER" &&
            pendingItemReceiptId
        ) {
            return validationError(
                "A direct Purchase Order receipt cannot reference a Pending Item Receipt."
            );
        }

        if (
            sourceType === "PENDING_ITEM_RECEIPT" &&
            purchaseOrderId
        ) {
            return validationError(
                "Select the Pending Item Receipt as the source. Its Purchase Order will be determined automatically."
            );
        }

        /* ---------------------------------------------------------------- */
        /* Normalize item values                                             */
        /* ---------------------------------------------------------------- */

        const normalizedItems = [];

        for (let index = 0; index < items.length; index++) {
            const item = items[index] || {};

            const productId = item.productId
                ? positiveId(item.productId)
                : null;

            const purchaseOrderItemId = item.purchaseOrderItemId
                ? positiveId(item.purchaseOrderItemId)
                : null;

            const pendingItemReceiptItemId =
                item.pendingItemReceiptItemId
                    ? positiveId(item.pendingItemReceiptItemId)
                    : null;

            const quantity = Number(item.quantityReceived);
            const unitCost = Number(item.unitCost ?? 0);

            const description = String(
                item.itemDescription || ""
            ).trim();

            const uom = String(item.uom || "").trim();

            if (!description) {
                return validationError(
                    `Item ${index + 1}: item description is required.`
                );
            }

            if (!validQuantity(quantity)) {
                return validationError(
                    `Item ${index + 1}: received quantity must be greater than zero.`
                );
            }

            if (!validCost(unitCost)) {
                return validationError(
                    `Item ${index + 1}: unit cost cannot be negative.`
                );
            }

            if (
                item.productId &&
                !productId
            ) {
                return validationError(
                    `Item ${index + 1}: invalid product reference.`
                );
            }

            if (
                sourceType === "PURCHASE_ORDER" &&
                !purchaseOrderItemId
            ) {
                return validationError(
                    `Item ${index + 1}: Purchase Order item reference is required.`
                );
            }

            if (
                sourceType === "PENDING_ITEM_RECEIPT" &&
                !pendingItemReceiptItemId
            ) {
                return validationError(
                    `Item ${index + 1}: Pending Item Receipt item reference is required.`
                );
            }

            normalizedItems.push({
                productId,
                purchaseOrderItemId,
                pendingItemReceiptItemId,
                description,
                uom,
                quantity,
                unitCost,
                remarks: String(item.remarks || "").trim(),
            });
        }

        /* ---------------------------------------------------------------- */
        /* Prevent duplicate source item references                         */
        /* ---------------------------------------------------------------- */

        const referenceIds = normalizedItems
            .map((item) => {
                if (sourceType === "PURCHASE_ORDER") {
                    return item.purchaseOrderItemId;
                }

                if (sourceType === "PENDING_ITEM_RECEIPT") {
                    return item.pendingItemReceiptItemId;
                }

                return null;
            })
            .filter(Boolean);

        if (new Set(referenceIds).size !== referenceIds.length) {
            return validationError(
                "The same source item cannot be added more than once."
            );
        }

        /* ---------------------------------------------------------------- */
        /* Validate company in central database                             */
        /* ---------------------------------------------------------------- */

        const companyResult = await pool.query(
            `
            SELECT company_id
            FROM companies
            WHERE company_id = $1
            `,
            [companyId]
        );

        if (companyResult.rows.length === 0) {
            throwHttpError("Company not found.", 404);
        }

        /* ---------------------------------------------------------------- */
        /* Connect to company operational database                          */
        /* ---------------------------------------------------------------- */

        const db = await getTenantDb(user);
        client = await db.connect();

        await client.query("BEGIN");
        transactionStarted = true;

        /* Serialize receipt number generation for this company. */

        await client.query(
            "SELECT pg_advisory_xact_lock($1::integer, $2::integer)",
            [companyId, 741207]
        );

        /* ---------------------------------------------------------------- */
        /* Validate active supplier                                          */
        /* ---------------------------------------------------------------- */

        const supplierResult = await client.query(
            `
            SELECT
                supplier_id,
                supplier_name
            FROM suppliers
            WHERE supplier_id = $1
              AND COALESCE(is_active, TRUE) = TRUE
              AND deleted_at IS NULL
            FOR SHARE
            `,
            [supplierId]
        );

        if (supplierResult.rows.length === 0) {
            throwHttpError(
                "Selected supplier does not exist, is inactive, or has been archived.",
                404
            );
        }

        /* ---------------------------------------------------------------- */
        /* Validate active warehouse                                         */
        /* ---------------------------------------------------------------- */

        const warehouseResult = await client.query(
            `
            SELECT
                warehouse_id,
                warehouse_name
            FROM warehouses
            WHERE warehouse_id = $1
              AND COALESCE(is_active, TRUE) = TRUE
              AND deleted_at IS NULL
            FOR SHARE
            `,
            [warehouseId]
        );

        if (warehouseResult.rows.length === 0) {
            throwHttpError(
                "Selected warehouse does not exist, is inactive, or has been archived.",
                404
            );
        }

        /* ---------------------------------------------------------------- */
        /* Validate source document                                          */
        /* ---------------------------------------------------------------- */

        let finalPurchaseOrderId = purchaseOrderId;

        /* Direct Purchase Order source. */

        if (sourceType === "PURCHASE_ORDER") {
            const poResult = await client.query(
                `
                SELECT
                    purchase_order_id,
                    supplier_id,
                    status
                FROM purchase_orders
                WHERE purchase_order_id = $1
                  AND company_id = $2
                  AND deleted_at IS NULL
                FOR UPDATE
                `,
                [purchaseOrderId, companyId]
            );

            if (poResult.rows.length === 0) {
                throwHttpError(
                    "Purchase Order not found or archived.",
                    404
                );
            }

            const po = poResult.rows[0];

            if (
                String(po.status || "").toUpperCase() !== "APPROVED"
            ) {
                throwHttpError(
                    "Only approved Purchase Orders can be received.",
                    409
                );
            }

            if (Number(po.supplier_id) !== supplierId) {
                throwHttpError(
                    "The selected supplier does not match the Purchase Order."
                );
            }
        }

        /* Pending Item Receipt source. */

        if (sourceType === "PENDING_ITEM_RECEIPT") {
            const pendingResult = await client.query(
                `
                SELECT
                    pending_item_receipt_id,
                    supplier_id,
                    purchase_order_id,
                    status
                FROM pending_item_receipts
                WHERE pending_item_receipt_id = $1
                  AND company_id = $2
                  AND deleted_at IS NULL
                FOR UPDATE
                `,
                [pendingItemReceiptId, companyId]
            );

            if (pendingResult.rows.length === 0) {
                throwHttpError(
                    "Pending Item Receipt not found or archived.",
                    404
                );
            }

            const pendingHeader = pendingResult.rows[0];

            if (
                ["CANCELLED", "CLOSED"].includes(
                    String(pendingHeader.status || "").toUpperCase()
                )
            ) {
                throwHttpError(
                    "This Pending Item Receipt cannot be converted.",
                    409
                );
            }

            if (Number(pendingHeader.supplier_id) !== supplierId) {
                throwHttpError(
                    "The selected supplier does not match the Pending Item Receipt."
                );
            }

            finalPurchaseOrderId =
                pendingHeader.purchase_order_id
                    ? positiveId(pendingHeader.purchase_order_id)
                    : null;

            if (pendingHeader.purchase_order_id && !finalPurchaseOrderId) {
                throwHttpError(
                    "The linked Purchase Order reference is invalid.",
                    409
                );
            }

            /* Validate linked Purchase Order, if present. */

            if (finalPurchaseOrderId) {
                const poResult = await client.query(
                    `
                    SELECT
                        purchase_order_id,
                        supplier_id,
                        status
                    FROM purchase_orders
                    WHERE purchase_order_id = $1
                      AND company_id = $2
                      AND deleted_at IS NULL
                    FOR UPDATE
                    `,
                    [finalPurchaseOrderId, companyId]
                );

                if (poResult.rows.length === 0) {
                    throwHttpError(
                        "The Purchase Order linked to this Pending Item Receipt was not found or has been archived.",
                        404
                    );
                }

                const po = poResult.rows[0];

                if (
                    String(po.status || "").toUpperCase() !== "APPROVED"
                ) {
                    throwHttpError(
                        "The linked Purchase Order is no longer approved.",
                        409
                    );
                }

                if (Number(po.supplier_id) !== supplierId) {
                    throwHttpError(
                        "The supplier does not match the linked Purchase Order."
                    );
                }
            }
        }

        /* ---------------------------------------------------------------- */
        /* Validate products and source item quantities                     */
        /* ---------------------------------------------------------------- */

        for (const item of normalizedItems) {
            /* Validate product if supplied. */

            if (item.productId) {
                const productResult = await client.query(
                    `
                    SELECT
                        product_id,
                        product_name,
                        unit,
                        is_active
                    FROM products
                    WHERE product_id = $1
                      AND COALESCE(is_active, TRUE) = TRUE
                      AND deleted_at IS NULL
                    FOR SHARE
                    `,
                    [item.productId]
                );

                if (productResult.rows.length === 0) {
                    throwHttpError(
                        `Product does not exist, is inactive, or has been archived: ${item.description}`,
                        404
                    );
                }
            }

            /* ------------------------------------------------------------ */
            /* Purchase Order item validation                               */
            /* ------------------------------------------------------------ */

            if (sourceType === "PURCHASE_ORDER") {
                const poItemResult = await client.query(
                    `
                    SELECT
                        purchase_order_item_id,
                        purchase_order_id,
                        product_id,
                        item_description,
                        uom,
                        quantity,
                        unit_price
                    FROM purchase_order_items
                    WHERE purchase_order_item_id = $1
                      AND purchase_order_id = $2
                    FOR SHARE
                    `,
                    [
                        item.purchaseOrderItemId,
                        finalPurchaseOrderId,
                    ]
                );

                if (poItemResult.rows.length === 0) {
                    throwHttpError(
                        `Purchase Order item not found: ${item.description}`,
                        404
                    );
                }

                const poItem = poItemResult.rows[0];

                if (
                    item.productId &&
                    Number(poItem.product_id) !== item.productId
                ) {
                    throwHttpError(
                        `Product does not match Purchase Order item: ${item.description}`
                    );
                }

                const receivedResult = await client.query(
                    `
                    SELECT
                        COALESCE(
                            SUM(iri.quantity_received),
                            0
                        ) AS received_quantity
                    FROM item_receipt_items iri
                    INNER JOIN item_receipts ir
                        ON ir.item_receipt_id = iri.item_receipt_id
                    WHERE iri.purchase_order_item_id = $1
                      AND ir.company_id = $2
                      AND ir.deleted_at IS NULL
                      AND UPPER(COALESCE(ir.status, '')) = 'APPROVED'
                    `,
                    [
                        item.purchaseOrderItemId,
                        companyId,
                    ]
                );

                const alreadyReceived =
                    Number(receivedResult.rows[0].received_quantity) || 0;

                const orderedQuantity =
                    Number(poItem.quantity) || 0;

                const remainingQuantity =
                    orderedQuantity - alreadyReceived;

                if (item.quantity > remainingQuantity + 1) {
                    throwHttpError(
                        `${item.description}: only ${Math.max(0, remainingQuantity)} units remain to be received.`,
                        409
                    );
                }

                /* Use PO unit price when submitted cost is zero. */

                if (
                    item.unitCost === 0 &&
                    Number(poItem.unit_price) > 0
                ) {
                    item.unitCost = Number(poItem.unit_price);
                }
            }

            /* ------------------------------------------------------------ */
            /* Pending Item Receipt item validation                         */
            /* ------------------------------------------------------------ */

            if (sourceType === "PENDING_ITEM_RECEIPT") {
                const pendingItemResult = await client.query(
                    `
                    SELECT
                        pending_item_receipt_item_id,
                        pending_item_receipt_id,
                        purchase_order_item_id,
                        product_id,
                        item_description,
                        uom,
                        quantity_expected
                    FROM pending_item_receipt_items
                    WHERE pending_item_receipt_item_id = $1
                      AND pending_item_receipt_id = $2
                    FOR SHARE
                    `,
                    [
                        item.pendingItemReceiptItemId,
                        pendingItemReceiptId,
                    ]
                );

                if (pendingItemResult.rows.length === 0) {
                    throwHttpError(
                        `Pending receipt item not found: ${item.description}`,
                        404
                    );
                }

                const pendingItem = pendingItemResult.rows[0];

                if (
                    item.productId &&
                    Number(pendingItem.product_id) !== item.productId
                ) {
                    throwHttpError(
                        `Product does not match Pending Item Receipt: ${item.description}`
                    );
                }

                const pendingReceivedResult = await client.query(
                    `
                    SELECT
                        COALESCE(
                            SUM(iri.quantity_received),
                            0
                        ) AS received_quantity
                    FROM item_receipt_items iri
                    INNER JOIN item_receipts ir
                        ON ir.item_receipt_id = iri.item_receipt_id
                    WHERE iri.pending_item_receipt_item_id = $1
                      AND ir.company_id = $2
                      AND ir.deleted_at IS NULL
                      AND UPPER(COALESCE(ir.status, '')) = 'APPROVED'
                    `,
                    [
                        item.pendingItemReceiptItemId,
                        companyId,
                    ]
                );

                const alreadyReceived =
                    Number(pendingReceivedResult.rows[0].received_quantity) || 0;

                const expectedQuantity =
                    Number(pendingItem.quantity_expected) || 0;

                const remainingQuantity =
                    expectedQuantity - alreadyReceived;

                if (item.quantity > remainingQuantity + 1) {
                    throwHttpError(
                        `${item.description}: only ${Math.max(0, remainingQuantity)} units remain on the Pending Item Receipt.`,
                        409
                    );
                }

                /* Validate linked Purchase Order item, if applicable. */

                if (
                    pendingItem.purchase_order_item_id &&
                    finalPurchaseOrderId
                ) {
                    const poItemResult = await client.query(
                        `
                        SELECT
                            purchase_order_item_id,
                            quantity,
                            unit_price
                        FROM purchase_order_items
                        WHERE purchase_order_item_id = $1
                          AND purchase_order_id = $2
                        FOR SHARE
                        `,
                        [
                            pendingItem.purchase_order_item_id,
                            finalPurchaseOrderId,
                        ]
                    );

                    if (poItemResult.rows.length === 0) {
                        throwHttpError(
                            `Linked Purchase Order item not found: ${item.description}`,
                            404
                        );
                    }

                    const poReceivedResult = await client.query(
                        `
                        SELECT
                            COALESCE(
                                SUM(iri.quantity_received),
                                0
                            ) AS received_quantity
                        FROM item_receipt_items iri
                        INNER JOIN item_receipts ir
                            ON ir.item_receipt_id = iri.item_receipt_id
                        WHERE iri.purchase_order_item_id = $1
                          AND ir.company_id = $2
                          AND ir.deleted_at IS NULL
                          AND UPPER(COALESCE(ir.status, '')) = 'APPROVED'
                        `,
                        [
                            pendingItem.purchase_order_item_id,
                            companyId,
                        ]
                    );

                    const poAlreadyReceived =
                        Number(poReceivedResult.rows[0].received_quantity) || 0;

                    const poRemaining =
                        Number(poItemResult.rows[0].quantity) -
                        poAlreadyReceived;

                    if (item.quantity > poRemaining + 1) {
                        throwHttpError(
                            `${item.description}: the Purchase Order has only ${Math.max(0, poRemaining)} units remaining.`,
                            409
                        );
                    }

                    if (
                        item.unitCost === 0 &&
                        Number(poItemResult.rows[0].unit_price) > 0
                    ) {
                        item.unitCost = Number(
                            poItemResult.rows[0].unit_price
                        );
                    }
                }

                /* Preserve the actual source PO item reference. */

                item.purchaseOrderItemId =
                    pendingItem.purchase_order_item_id
                        ? positiveId(
                            pendingItem.purchase_order_item_id
                        )
                        : null;
            }
        }

        /* ---------------------------------------------------------------- */
        /* Generate receipt number                                           */
        /* ---------------------------------------------------------------- */

        const year = String(receiptDate).slice(0, 4);

        const numberResult = await client.query(
            `
            SELECT COUNT(*)::INTEGER AS total
            FROM item_receipts
            WHERE company_id = $1
              AND receipt_number LIKE $2
            `,
            [
                companyId,
                `IR-${year}-%`,
            ]
        );

        const nextNumber =
            Number(numberResult.rows[0].total || 0) + 1;

        const receiptNumber =
            `IR-${year}-${String(nextNumber).padStart(6, "0")}`;

        /* ---------------------------------------------------------------- */
        /* Insert Item Receipt header                                        */
        /* ---------------------------------------------------------------- */

        const headerResult = await client.query(
            `
            INSERT INTO item_receipts (
                receipt_number,
                company_id,
                supplier_id,
                warehouse_id,
                purchase_order_id,
                pending_item_receipt_id,
                source_type,
                receipt_date,
                status,
                remarks,
                created_by,
                updated_by,
                created_at,
                updated_at
            )
            VALUES (
                $1, $2, $3, $4, $5, $6,
                $7, $8, 'DRAFT', $9, $10, $10,
                CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
            )
            RETURNING *
            `,
            [
                receiptNumber,
                companyId,
                supplierId,
                warehouseId,
                finalPurchaseOrderId,
                pendingItemReceiptId,
                sourceType,
                receiptDate,
                remarks,
                userId,
            ]
        );

        const receipt = headerResult.rows[0];

        /* ---------------------------------------------------------------- */
        /* Insert Item Receipt lines                                         */
        /* ---------------------------------------------------------------- */

        for (const item of normalizedItems) {
            const lineTotal =
                item.quantity * item.unitCost;

            await client.query(
                `
                INSERT INTO item_receipt_items (
                    item_receipt_id,
                    purchase_order_item_id,
                    pending_item_receipt_item_id,
                    product_id,
                    item_description,
                    uom,
                    quantity_received,
                    unit_cost,
                    line_total,
                    remarks,
                    created_at
                )
                VALUES (
                    $1, $2, $3, $4, $5,
                    $6, $7, $8, $9, $10,
                    CURRENT_TIMESTAMP
                )
                `,
                [
                    receipt.item_receipt_id,
                    item.purchaseOrderItemId,
                    item.pendingItemReceiptItemId,
                    item.productId,
                    item.description,
                    item.uom,
                    item.quantity,
                    item.unitCost,
                    lineTotal,
                    item.remarks,
                ]
            );
        }

        /* ---------------------------------------------------------------- */
        /* Commit                                                            */
        /* ---------------------------------------------------------------- */

        await client.query("COMMIT");
        transactionStarted = false;

        return NextResponse.json(
            {
                success: true,
                message: "Item Receipt created successfully as a draft.",
                receipt,
            },
            { status: 201 }
        );
    } catch (error) {
        if (transactionStarted && client) {
            try {
                await client.query("ROLLBACK");
            } catch (rollbackError) {
                console.error(
                    "ITEM RECEIPT ROLLBACK ERROR:",
                    rollbackError
                );
            }
        }

        return apiError(error);
    } finally {
        client?.release();
    }
}
