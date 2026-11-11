
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

    return Number.isInteger(number) && number > 0
        ? number
        : null;
}

function apiError(error) {
    console.error("ITEM RECEIPT APPROVAL ERROR:", error);

    if (error.message === "UNAUTHORIZED") {
        return NextResponse.json(
            { message: "You are not authorized. Please log in." },
            { status: 401 }
        );
    }

    if (error.message === "FORBIDDEN") {
        return NextResponse.json(
            { message: "You do not have permission to approve Item Receipts." },
            { status: 403 }
        );
    }

    return NextResponse.json(
        { message: error.message || "Internal server error." },
        { status: error.status || 500 }
    );
}

function fail(message, status = 400) {
    const error = new Error(message);
    error.status = status;
    throw error;
}

async function getReceiptId(context) {
    const params = await context.params;
    return positiveId(params?.id);
}

// ============================================================
// POST: APPROVE ITEM RECEIPT
// ============================================================

export async function POST(request, context) {
    const client = await pool.connect();

    let transactionStarted = false;

    try {
        // ----------------------------------------------------
        // AUTHENTICATION AND PERMISSION
        // ----------------------------------------------------

        const user = await getCurrentUser();

        if (!user) {
            return NextResponse.json(
                { message: "Unauthorized." },
                { status: 401 }
            );
        }

        await requirePermission(
            user,
            "item_receipts",
            "update"
        );

        const companyId = positiveId(user.companyId);
        const userId = positiveId(user.userId);
        const receiptId = await getReceiptId(context);

        if (!companyId || !userId || !receiptId) {
            return NextResponse.json(
                { message: "Invalid company, user or receipt ID." },
                { status: 400 }
            );
        }

        // ----------------------------------------------------
        // BEGIN TRANSACTION
        // ----------------------------------------------------

        await client.query("BEGIN");
        transactionStarted = true;

        // ----------------------------------------------------
        // LOCK ITEM RECEIPT
        // Prevent two users approving the same receipt.
        // ----------------------------------------------------

        const receiptResult = await client.query(
            `
            SELECT
                ir.*,
                s.supplier_name,
                w.warehouse_name

            FROM item_receipts ir

            INNER JOIN suppliers s
                ON s.supplier_id = ir.supplier_id

            INNER JOIN warehouses w
                ON w.warehouse_id = ir.warehouse_id

            WHERE ir.item_receipt_id = $1
              AND ir.company_id = $2

            FOR UPDATE OF ir
            `,
            [receiptId, companyId]
        );

        if (receiptResult.rows.length === 0) {
            fail("Item Receipt not found.", 404);
        }

        const receipt = receiptResult.rows[0];

        if (String(receipt.status).toUpperCase() !== "DRAFT") {
            fail(
                "Only draft Item Receipts can be approved. This receipt may already have been posted.",
                409
            );
        }

        if (receipt.posted_at) {
            fail(
                "This Item Receipt has already been posted.",
                409
            );
        }

        // ----------------------------------------------------
        // LOCK WAREHOUSE
        // ----------------------------------------------------

        const warehouseResult = await client.query(
            `
            SELECT
                warehouse_id,
                warehouse_name,
                is_active
            FROM warehouses
            WHERE warehouse_id = $1
            FOR UPDATE
            `,
            [receipt.warehouse_id]
        );

        if (warehouseResult.rows.length === 0) {
            fail("Receipt warehouse not found.");
        }

        const warehouse = warehouseResult.rows[0];

        if (warehouse.is_active === false) {
            fail("The receipt warehouse is inactive.");
        }

        // ----------------------------------------------------
        // LOCK AND VALIDATE SOURCE DOCUMENT
        // ----------------------------------------------------

        const sourceType = String(
            receipt.source_type || "MANUAL"
        ).toUpperCase();

        let purchaseOrderId = receipt.purchase_order_id
            ? positiveId(receipt.purchase_order_id)
            : null;

        let pendingHeader = null;

        if (sourceType === "PURCHASE_ORDER") {
            if (!purchaseOrderId) {
                fail("Purchase Order reference is missing.");
            }

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
                fail("Linked Purchase Order not found.");
            }

            const po = poResult.rows[0];

            if (String(po.status).toUpperCase() !== "APPROVED") {
                fail("Only approved Purchase Orders can be received.");
            }

            if (Number(po.supplier_id) !== Number(receipt.supplier_id)) {
                fail("Receipt supplier does not match the Purchase Order.");
            }
        } else if (sourceType === "PENDING_ITEM_RECEIPT") {
            const pendingId = positiveId(
                receipt.pending_item_receipt_id
            );

            if (!pendingId) {
                fail("Pending Item Receipt reference is missing.");
            }

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
                [pendingId, companyId]
            );

            if (pendingResult.rows.length === 0) {
                fail("Linked Pending Item Receipt not found.");
            }

            pendingHeader = pendingResult.rows[0];

            if (
                ["CANCELLED", "CLOSED"].includes(
                    String(pendingHeader.status || "").toUpperCase()
                )
            ) {
                fail("The linked Pending Item Receipt is closed or cancelled.");
            }

            if (
                Number(pendingHeader.supplier_id) !==
                Number(receipt.supplier_id)
            ) {
                fail("Receipt supplier does not match the Pending Item Receipt.");
            }

            const pendingPurchaseOrderId =
                pendingHeader.purchase_order_id
                    ? positiveId(pendingHeader.purchase_order_id)
                    : null;

            if (
                pendingPurchaseOrderId !== purchaseOrderId
            ) {
                fail(
                    "The linked Purchase Order reference does not match the Pending Item Receipt."
                );
            }

            if (purchaseOrderId) {
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
                    fail("Linked Purchase Order not found.");
                }

                const po = poResult.rows[0];

                if (String(po.status).toUpperCase() !== "APPROVED") {
                    fail("Linked Purchase Order is not approved.");
                }

                if (
                    Number(po.supplier_id) !==
                    Number(receipt.supplier_id)
                ) {
                    fail("Purchase Order supplier does not match.");
                }
            }
        } else if (sourceType !== "MANUAL") {
            fail("Unsupported Item Receipt source type.");
        }

        // ----------------------------------------------------
        // LOAD RECEIPT ITEMS
        // ----------------------------------------------------

        const itemsResult = await client.query(
            `
            SELECT
                iri.*,
                p.product_name,
                p.item_type

            FROM item_receipt_items iri

            LEFT JOIN products p
                ON p.product_id = iri.product_id

            WHERE iri.item_receipt_id = $1

            ORDER BY iri.item_receipt_item_id
            `,
            [receiptId]
        );

        const items = itemsResult.rows;

        if (items.length === 0) {
            fail("Cannot approve an Item Receipt without items.");
        }

        // ----------------------------------------------------
        // VERIFY QUANTITIES AGAIN WHILE HOLDING SOURCE LOCKS
        // ----------------------------------------------------

        for (const item of items) {
            const quantity = Number(item.quantity_received);
            const unitCost = Number(item.unit_cost);

            if (!Number.isFinite(quantity) || quantity <= 0) {
                fail(
                    `Invalid received quantity for ${item.item_description}.`
                );
            }

            if (!Number.isFinite(unitCost) || unitCost < 0) {
                fail(
                    `Invalid unit cost for ${item.item_description}.`
                );
            }

            if (item.product_id && !item.product_name) {
                fail(
                    `Product not found for ${item.item_description}.`
                );
            }

            // -----------------------------------------------
            // PURCHASE ORDER SOURCE
            // -----------------------------------------------

            if (sourceType === "PURCHASE_ORDER") {
                if (!item.purchase_order_item_id) {
                    fail(
                        `Purchase Order item reference is missing for ${item.item_description}.`
                    );
                }

                const poItemResult = await client.query(
                    `
                    SELECT
                        purchase_order_item_id,
                        product_id,
                        quantity
                    FROM purchase_order_items
                    WHERE purchase_order_item_id = $1
                      AND purchase_order_id = $2
                    `,
                    [
                        item.purchase_order_item_id,
                        purchaseOrderId,
                    ]
                );

                if (poItemResult.rows.length === 0) {
                    fail(
                        `Purchase Order item not found: ${item.item_description}.`
                    );
                }

                const poItem = poItemResult.rows[0];

                if (
                    Number(poItem.product_id || 0) !==
                    Number(item.product_id || 0)
                ) {
                    fail(
                        `Product does not match Purchase Order item: ${item.item_description}.`
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
                        ON ir.item_receipt_id =
                            iri.item_receipt_id

                    WHERE iri.purchase_order_item_id = $1
                      AND ir.company_id = $2
                      AND UPPER(ir.status) = 'APPROVED'
                      AND ir.item_receipt_id <> $3
                    `,
                    [
                        item.purchase_order_item_id,
                        companyId,
                        receiptId,
                    ]
                );

                const alreadyReceived = Number(
                    receivedResult.rows[0].received_quantity
                ) || 0;

                const remaining =
                    Number(poItem.quantity) - alreadyReceived;

                if (quantity > remaining + 0.000001) {
                    fail(
                        `${item.item_description}: only ${Math.max(0, remaining)} units remain on the Purchase Order.`
                    );
                }
            }

            // -----------------------------------------------
            // PENDING ITEM RECEIPT SOURCE
            // -----------------------------------------------

            if (sourceType === "PENDING_ITEM_RECEIPT") {
                if (!item.pending_item_receipt_item_id) {
                    fail(
                        `Pending Item Receipt item reference is missing for ${item.item_description}.`
                    );
                }

                const pendingItemResult = await client.query(
                    `
                    SELECT
                        pending_item_receipt_item_id,
                        product_id,
                        purchase_order_item_id,
                        quantity_expected

                    FROM pending_item_receipt_items

                    WHERE pending_item_receipt_item_id = $1
                      AND pending_item_receipt_id = $2
                    `,
                    [
                        item.pending_item_receipt_item_id,
                        receipt.pending_item_receipt_id,
                    ]
                );

                if (pendingItemResult.rows.length === 0) {
                    fail(
                        `Pending Item Receipt item not found: ${item.item_description}.`
                    );
                }

                const pendingItem = pendingItemResult.rows[0];

                if (
                    Number(pendingItem.product_id || 0) !==
                    Number(item.product_id || 0)
                ) {
                    fail(
                        `Product does not match Pending Item Receipt item: ${item.item_description}.`
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
                        ON ir.item_receipt_id =
                            iri.item_receipt_id

                    WHERE iri.pending_item_receipt_item_id = $1
                      AND ir.company_id = $2
                      AND UPPER(ir.status) = 'APPROVED'
                      AND ir.item_receipt_id <> $3
                    `,
                    [
                        item.pending_item_receipt_item_id,
                        companyId,
                        receiptId,
                    ]
                );

                const pendingAlreadyReceived = Number(
                    pendingReceivedResult.rows[0].received_quantity
                ) || 0;

                const pendingRemaining =
                    Number(pendingItem.quantity_expected) -
                    pendingAlreadyReceived;

                if (quantity > pendingRemaining + 0.000001) {
                    fail(
                        `${item.item_description}: only ${Math.max(0, pendingRemaining)} units remain on the Pending Item Receipt.`
                    );
                }

                // -------------------------------------------
                // ALSO CHECK PURCHASE ORDER OUTSTANDING QTY
                // -------------------------------------------

                if (pendingItem.purchase_order_item_id) {
                    if (!purchaseOrderId) {
                        fail(
                            "A linked Purchase Order item exists, but its Purchase Order reference is missing."
                        );
                    }

                    if (
                        Number(item.purchase_order_item_id || 0) !==
                        Number(pendingItem.purchase_order_item_id)
                    ) {
                        fail(
                            `Purchase Order item reference does not match: ${item.item_description}.`
                        );
                    }

                    const poItemResult = await client.query(
                        `
                        SELECT
                            purchase_order_item_id,
                            product_id,
                            quantity

                        FROM purchase_order_items

                        WHERE purchase_order_item_id = $1
                          AND purchase_order_id = $2
                        `,
                        [
                            pendingItem.purchase_order_item_id,
                            purchaseOrderId,
                        ]
                    );

                    if (poItemResult.rows.length === 0) {
                        fail(
                            `Linked Purchase Order item not found: ${item.item_description}.`
                        );
                    }

                    const poItem = poItemResult.rows[0];

                    if (
                        Number(poItem.product_id || 0) !==
                        Number(item.product_id || 0)
                    ) {
                        fail(
                            `Product does not match linked Purchase Order item: ${item.item_description}.`
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
                            ON ir.item_receipt_id =
                                iri.item_receipt_id

                        WHERE iri.purchase_order_item_id = $1
                          AND ir.company_id = $2
                          AND UPPER(ir.status) = 'APPROVED'
                          AND ir.item_receipt_id <> $3
                        `,
                        [
                            pendingItem.purchase_order_item_id,
                            companyId,
                            receiptId,
                        ]
                    );

                    const poAlreadyReceived = Number(
                        poReceivedResult.rows[0].received_quantity
                    ) || 0;

                    const poRemaining =
                        Number(poItem.quantity) - poAlreadyReceived;

                    if (quantity > poRemaining + 0.000001) {
                        fail(
                            `${item.item_description}: only ${Math.max(0, poRemaining)} units remain on the Purchase Order.`
                        );
                    }
                }
            }
        }

        // ----------------------------------------------------
        // POST STOCK AND INVENTORY LEDGER
        // ----------------------------------------------------

        let postedItemCount = 0;
        let postedQuantity = 0;
        let postedAmount = 0;

        for (const item of items) {
            const productId = positiveId(item.product_id);

            // A receipt line without a product is a descriptive
            // line and cannot update inventory.
            if (!productId) {
                continue;
            }

            const itemType = String(
                item.item_type || ""
            ).trim().toUpperCase();

            // Services and non-inventory items must not increase stock.
            if (
                itemType === "SERVICE" ||
                itemType === "NON-STOCK" ||
                itemType === "NON STOCK" ||
                itemType === "NON_STOCK" ||
                itemType === "NON-INVENTORY" ||
                itemType === "NON INVENTORY" ||
                itemType === "NON_INVENTORY"
            ) {
                continue;
            }

            const quantity = Number(item.quantity_received);
            const unitCost = Number(item.unit_cost || 0);
            const receiveAmount = quantity * unitCost;

            // -----------------------------------------------
            // UPDATE STOCK
            // ON CONFLICT handles products with no existing
            // stock row.
            // -----------------------------------------------

            await client.query(
                `
                INSERT INTO stock (
                    product_id,
                    warehouse_id,
                    quantity,
                    updated_at
                )
                VALUES ($1, $2, $3, CURRENT_TIMESTAMP)

                ON CONFLICT (product_id, warehouse_id)

                DO UPDATE SET
                    quantity =
                        COALESCE(stock.quantity, 0)
                        + EXCLUDED.quantity,

                    updated_at = CURRENT_TIMESTAMP
                `,
                [
                    productId,
                    receipt.warehouse_id,
                    quantity,
                ]
            );

            // -----------------------------------------------
            // CALCULATE RUNNING INVENTORY
            // Same formula as Purchase API.
            // -----------------------------------------------

            const runningResult = await client.query(
                `
                SELECT
                    COALESCE(
                        SUM(
                            COALESCE(receive_quantity, 0)
                            -
                            COALESCE(issue_quantity, 0)
                        ),
                        0
                    ) AS running_quantity

                FROM inventory_transactions

                WHERE product_id = $1
                  AND location = $2
                `,
                [
                    productId,
                    warehouse.warehouse_name,
                ]
            );

            const oldQuantity =
                Number(runningResult.rows[0].running_quantity) || 0;

            const newQuantity =
                oldQuantity + quantity;

            // -----------------------------------------------
            // INSERT INVENTORY TRANSACTION
            // -----------------------------------------------

            await client.query(
                `
                INSERT INTO inventory_transactions (
                    product_id,
                    transaction_date,
                    transaction_type,
                    transaction_number,
                    location,
                    uom,
                    memo,
                    transaction_rate,
                    old_rate,
                    actual_rate,
                    new_rate,
                    receive_quantity,
                    receive_rate,
                    receive_amount,
                    issue_quantity,
                    issue_rate,
                    issue_amount,
                    running_quantity
                )
                VALUES (
                    $1,
                    COALESCE($2::DATE, CURRENT_DATE),
                    'ITEM RECEIPT',
                    $3,
                    $4,
                    $5,
                    $6,
                    $7,
                    $7,
                    $7,
                    $7,
                    $8,
                    $7,
                    $9,
                    0,
                    0,
                    0,
                    $10
                )
                `,
                [
                    productId,
                    receipt.receipt_date,
                    receipt.receipt_number,
                    warehouse.warehouse_name,
                    item.uom,
                    `Item Receipt from ${receipt.supplier_name}`,
                    unitCost,
                    quantity,
                    receiveAmount,
                    newQuantity,
                ]
            );

            postedItemCount++;
            postedQuantity += quantity;
            postedAmount += receiveAmount;
        }

        // ----------------------------------------------------
        // UPDATE RECEIPT STATUS
        // ----------------------------------------------------

        const approvalResult = await client.query(
            `
            UPDATE item_receipts

            SET
                status = 'APPROVED',
                posted_at = CURRENT_TIMESTAMP,
                posted_by = $1,
                updated_by = $1,
                updated_at = CURRENT_TIMESTAMP

            WHERE item_receipt_id = $2
              AND company_id = $3
              AND UPPER(status) = 'DRAFT'
              AND posted_at IS NULL

            RETURNING *
            `,
            [
                userId,
                receiptId,
                companyId,
            ]
        );

        if (approvalResult.rows.length === 0) {
            fail(
                "The receipt could not be approved. It may already have been posted.",
                409
            );
        }

        // ----------------------------------------------------
        // COMMIT
        // ----------------------------------------------------

        await client.query("COMMIT");
        transactionStarted = false;

        return NextResponse.json({
            success: true,
            message: "Item Receipt approved and inventory posted successfully.",

            receipt: approvalResult.rows[0],

            inventory: {
                postedItemCount,
                postedQuantity,
                postedAmount,
                warehouse: warehouse.warehouse_name,
            },
        });

    } catch (error) {
        if (transactionStarted) {
            await client.query("ROLLBACK");
            transactionStarted = false;
        }

        return apiError(error);

    } finally {
        client.release();
    }
}
