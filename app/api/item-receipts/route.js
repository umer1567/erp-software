import { NextResponse } from "next/server";
import pool from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { requirePermission } from "@/lib/permissions";

export const dynamic = "force-dynamic";

// ============================================================
// HELPERS
// ============================================================

function positiveId(value) {
    const number = Number(value);

    if (!Number.isInteger(number) || number <= 0) {
        return null;
    }

    return number;
}

function validDate(value) {
    if (!value) return false;
    return /^\d{4}-\d{2}-\d{2}$/.test(String(value));
}

function validQuantity(value) {
    const number = Number(value);
    return Number.isFinite(number) && number > 0;
}

function validCost(value) {
    const number = Number(value);
    return Number.isFinite(number) && number >= 0;
}

function apiError(error) {
    console.error("ITEM RECEIPTS API ERROR:", error);

    if (error.message === "UNAUTHORIZED") {
        return NextResponse.json(
            { message: "You are not authorized. Please log in." },
            { status: 401 }
        );
    }

    if (error.message === "FORBIDDEN") {
        return NextResponse.json(
            { message: "You do not have permission to perform this action." },
            { status: 403 }
        );
    }

    return NextResponse.json(
        { message: error.message || "Internal server error." },
        { status: 500 }
    );
}

function validationError(message, status = 400) {
    return NextResponse.json(
        { message },
        { status }
    );
}

// ============================================================
// GET: LIST ITEM RECEIPTS AND DROPDOWN DATA
// ============================================================

export async function GET() {
    try {
        const user = await getCurrentUser();

        if (!user) {
            return validationError("Unauthorized.", 401);
        }

        await requirePermission(
            user,
            "item_receipts",
            "view"
        );

        const companyId = positiveId(user.companyId);

        if (!companyId) {
            return validationError(
                "Your account is not assigned to a valid company.",
                400
            );
        }

        const [
            receiptsResult,
            suppliersResult,
            warehousesResult,
            purchaseOrdersResult,
            pendingReceiptsResult,
        ] = await Promise.all([

            // ------------------------------------------------
            // 1. ITEM RECEIPTS
            // ------------------------------------------------

            pool.query(
    `
    SELECT
        ir.*,
        s.supplier_name,
        w.warehouse_name,
        po.purchase_order_number,

        COALESCE(receipt_totals.item_count, 0)::INTEGER
            AS item_count,

        COALESCE(receipt_totals.total_quantity, 0)
            AS total_quantity

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

    ORDER BY
        ir.item_receipt_id DESC
    `,
    [companyId]
),

            // ------------------------------------------------
            // 2. ACTIVE SUPPLIERS
            // Suppliers are shared in the current schema.
            // ------------------------------------------------

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

                WHERE COALESCE(is_active, TRUE) = TRUE

                ORDER BY supplier_name
                `
            ),

            // ------------------------------------------------
            // 3. ACTIVE WAREHOUSES
            // Warehouses are shared in the current schema.
            // ------------------------------------------------

            pool.query(
                `
                SELECT
                    warehouse_id,
                    warehouse_code,
                    warehouse_name,
                    location

                FROM warehouses

                WHERE COALESCE(is_active, TRUE) = TRUE

                ORDER BY warehouse_name
                `
            ),

            // ------------------------------------------------
            // 4. APPROVED PURCHASE ORDERS
            // IMPORTANT: The correct column is currency_code.
            // There is no po.currency column.
            // ------------------------------------------------

            pool.query(
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

                ORDER BY
                    po.purchase_order_id DESC
                `,
                [companyId]
            ),

            // ------------------------------------------------
            // 5. PENDING ITEM RECEIPTS
            // ------------------------------------------------

            pool.query(
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
                  AND UPPER(COALESCE(pir.status, '')) NOT IN (
                      'CANCELLED',
                      'CLOSED'
                  )

                ORDER BY
                    pir.pending_item_receipt_id DESC
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

// ============================================================
// POST: CREATE ITEM RECEIPT
// ============================================================

export async function POST(request) {
    const client = await pool.connect();

    let transactionStarted = false;

    try {
        const user = await getCurrentUser();

        if (!user) {
            return validationError("Unauthorized.", 401);
        }

        await requirePermission(
            user,
            "item_receipts",
            "create"
        );

        const companyId = positiveId(user.companyId);
        const userId = positiveId(user.userId);

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

        // ----------------------------------------------------
        // BASIC VALIDATION
        // ----------------------------------------------------

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

        // ----------------------------------------------------
        // NORMALIZE ITEM VALUES
        // ----------------------------------------------------

        const normalizedItems = [];

        for (let index = 0; index < items.length; index++) {
            const item = items[index];

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

        // ----------------------------------------------------
        // PREVENT DUPLICATE SOURCE ITEM REFERENCES
        // ----------------------------------------------------

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

        // ----------------------------------------------------
        // START DATABASE TRANSACTION
        // ----------------------------------------------------

        await client.query("BEGIN");
        transactionStarted = true;

        // ----------------------------------------------------
        // LOCK COMPANY FOR RECEIPT NUMBER GENERATION
        // ----------------------------------------------------

        const companyResult = await client.query(
            `
            SELECT company_id
            FROM companies
            WHERE company_id = $1
            FOR UPDATE
            `,
            [companyId]
        );

        if (companyResult.rows.length === 0) {
            throw new Error("Company not found.");
        }

        // ----------------------------------------------------
        // VALIDATE SUPPLIER
        // ----------------------------------------------------

        const supplierResult = await client.query(
            `
            SELECT
                supplier_id,
                supplier_name
            FROM suppliers
            WHERE supplier_id = $1
              AND COALESCE(is_active, TRUE) = TRUE
            `,
            [supplierId]
        );

        if (supplierResult.rows.length === 0) {
            throw new Error(
                "Selected supplier does not exist or is inactive."
            );
        }

        // ----------------------------------------------------
        // VALIDATE WAREHOUSE
        // ----------------------------------------------------

        const warehouseResult = await client.query(
            `
            SELECT
                warehouse_id,
                warehouse_name
            FROM warehouses
            WHERE warehouse_id = $1
              AND COALESCE(is_active, TRUE) = TRUE
            `,
            [warehouseId]
        );

        if (warehouseResult.rows.length === 0) {
            throw new Error(
                "Selected warehouse does not exist or is inactive."
            );
        }

        // ----------------------------------------------------
        // SOURCE DOCUMENT VALIDATION
        // ----------------------------------------------------

        let finalPurchaseOrderId = purchaseOrderId;
        let pendingHeader = null;

        // ----------------------------------------------------
        // DIRECT PURCHASE ORDER
        // ----------------------------------------------------

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
                FOR UPDATE
                `,
                [purchaseOrderId, companyId]
            );

            if (poResult.rows.length === 0) {
                throw new Error("Purchase Order not found.");
            }

            const po = poResult.rows[0];

            if (
                String(po.status || "").toUpperCase() !== "APPROVED"
            ) {
                throw new Error(
                    "Only approved Purchase Orders can be received."
                );
            }

            if (Number(po.supplier_id) !== supplierId) {
                throw new Error(
                    "The selected supplier does not match the Purchase Order."
                );
            }
        }

        // ----------------------------------------------------
        // PENDING ITEM RECEIPT
        // ----------------------------------------------------

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
                FOR UPDATE
                `,
                [pendingItemReceiptId, companyId]
            );

            if (pendingResult.rows.length === 0) {
                throw new Error(
                    "Pending Item Receipt not found."
                );
            }

            pendingHeader = pendingResult.rows[0];

            if (
                ["CANCELLED", "CLOSED"].includes(
                    String(pendingHeader.status || "").toUpperCase()
                )
            ) {
                throw new Error(
                    "This Pending Item Receipt cannot be converted."
                );
            }

            if (Number(pendingHeader.supplier_id) !== supplierId) {
                throw new Error(
                    "The selected supplier does not match the Pending Item Receipt."
                );
            }

            finalPurchaseOrderId =
                pendingHeader.purchase_order_id
                    ? positiveId(pendingHeader.purchase_order_id)
                    : null;

            // Validate linked Purchase Order.
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
                    FOR UPDATE
                    `,
                    [finalPurchaseOrderId, companyId]
                );

                if (poResult.rows.length === 0) {
                    throw new Error(
                        "The Purchase Order linked to this Pending Item Receipt was not found."
                    );
                }

                const po = poResult.rows[0];

                if (
                    String(po.status || "").toUpperCase() !== "APPROVED"
                ) {
                    throw new Error(
                        "The linked Purchase Order is no longer approved."
                    );
                }

                if (Number(po.supplier_id) !== supplierId) {
                    throw new Error(
                        "The supplier does not match the linked Purchase Order."
                    );
                }
            }
        }

        // ----------------------------------------------------
        // VALIDATE SOURCE ITEMS AND OUTSTANDING QUANTITIES
        // ----------------------------------------------------

        for (const item of normalizedItems) {

            // ------------------------------------------------
            // VALIDATE PRODUCT
            // ------------------------------------------------

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
                    `,
                    [item.productId]
                );

                if (productResult.rows.length === 0) {
                    throw new Error(
                        `Product not found: ${item.description}`
                    );
                }

                if (productResult.rows[0].is_active === false) {
                    throw new Error(
                        `Product is inactive: ${item.description}`
                    );
                }
            }

            // ------------------------------------------------
            // PURCHASE ORDER ITEM VALIDATION
            // ------------------------------------------------

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
                    `,
                    [
                        item.purchaseOrderItemId,
                        finalPurchaseOrderId,
                    ]
                );

                if (poItemResult.rows.length === 0) {
                    throw new Error(
                        `Purchase Order item not found: ${item.description}`
                    );
                }

                const poItem = poItemResult.rows[0];

                if (
                    item.productId &&
                    Number(poItem.product_id) !== item.productId
                ) {
                    throw new Error(
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
                      AND UPPER(ir.status) = 'APPROVED'
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

                if (
                    item.quantity >
                    remainingQuantity + 0.000001
                ) {
                    throw new Error(
                        `${item.description}: only ${Math.max(0, remainingQuantity)} units remain to be received.`
                    );
                }

                // Use PO unit price when submitted cost is zero.
                if (
                    item.unitCost === 0 &&
                    Number(poItem.unit_price) > 0
                ) {
                    item.unitCost = Number(poItem.unit_price);
                }
            }

            // ------------------------------------------------
            // PENDING ITEM RECEIPT ITEM VALIDATION
            // ------------------------------------------------

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
                    `,
                    [
                        item.pendingItemReceiptItemId,
                        pendingItemReceiptId,
                    ]
                );

                if (pendingItemResult.rows.length === 0) {
                    throw new Error(
                        `Pending receipt item not found: ${item.description}`
                    );
                }

                const pendingItem = pendingItemResult.rows[0];

                if (
                    item.productId &&
                    Number(pendingItem.product_id) !== item.productId
                ) {
                    throw new Error(
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
                      AND UPPER(ir.status) = 'APPROVED'
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

                if (
                    item.quantity >
                    remainingQuantity + 0.000001
                ) {
                    throw new Error(
                        `${item.description}: only ${Math.max(0, remainingQuantity)} units remain on the Pending Item Receipt.`
                    );
                }

                // --------------------------------------------
                // VALIDATE LINKED PURCHASE ORDER ITEM
                // --------------------------------------------

                if (
                    pendingItem.purchase_order_item_id &&
                    finalPurchaseOrderId
                ) {
                    const poItemResult = await client.query(
                        `
                        SELECT quantity
                        FROM purchase_order_items
                        WHERE purchase_order_item_id = $1
                          AND purchase_order_id = $2
                        `,
                        [
                            pendingItem.purchase_order_item_id,
                            finalPurchaseOrderId,
                        ]
                    );

                    if (poItemResult.rows.length === 0) {
                        throw new Error(
                            `Linked Purchase Order item not found: ${item.description}`
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
                          AND UPPER(ir.status) = 'APPROVED'
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

                    if (
                        item.quantity >
                        poRemaining + 0.000001
                    ) {
                        throw new Error(
                            `${item.description}: the Purchase Order has only ${Math.max(0, poRemaining)} units remaining.`
                        );
                    }
                }

                // Keep the actual source reference from the
                // Pending Item Receipt.
                item.purchaseOrderItemId =
                    pendingItem.purchase_order_item_id
                        ? positiveId(
                            pendingItem.purchase_order_item_id
                        )
                        : null;
            }
        }

        // ----------------------------------------------------
        // GENERATE RECEIPT NUMBER
        // Example: IR-2026-000001
        // ----------------------------------------------------

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

        // ----------------------------------------------------
        // CREATE ITEM RECEIPT HEADER
        // ----------------------------------------------------

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

        // ----------------------------------------------------
        // CREATE ITEM RECEIPT ITEMS
        // ----------------------------------------------------

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

        // ----------------------------------------------------
        // COMMIT
        // ----------------------------------------------------

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
        if (transactionStarted) {
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
        client.release();
    }
}