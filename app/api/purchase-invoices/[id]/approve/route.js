
import { NextResponse } from "next/server";
import pool from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { requirePermission } from "@/lib/permissions";

export const dynamic = "force-dynamic";

// ============================================================
// HELPERS
// ============================================================

function errorResponse(error) {
    if (error.message === "UNAUTHORIZED") {
        return NextResponse.json(
            { message: "Authentication required." },
            { status: 401 }
        );
    }

    if (error.message === "FORBIDDEN") {
        return NextResponse.json(
            { message: "You do not have permission to approve invoices." },
            { status: 403 }
        );
    }

    console.error("PURCHASE INVOICE APPROVAL ERROR:", error);

    return NextResponse.json(
        { message: error.message || "Internal server error." },
        { status: error.status || 500 }
    );
}

async function getAccount(client, accountId, accountCode) {
    let result;

    if (accountId) {
        result = await client.query(
            `
            SELECT account_id, account_code, account_name, account_type
            FROM chart_of_accounts
            WHERE account_id = $1
              AND is_active = TRUE
              AND is_group = FALSE
            `,
            [accountId]
        );
    } else {
        result = await client.query(
            `
            SELECT account_id, account_code, account_name, account_type
            FROM chart_of_accounts
            WHERE account_code = $1
              AND is_active = TRUE
              AND is_group = FALSE
            `,
            [accountCode]
        );
    }

    if (!result.rows.length) {
        throw new Error(
            `Required accounting account ${accountCode || accountId} was not found or is inactive.`
        );
    }

    return result.rows[0];
}

function isStockItem(itemType) {
    const value = String(itemType || "")
        .trim()
        .toLowerCase();

    return (
        value !== "service" &&
        value !== "non-stock item" &&
        value !== "non stock item" &&
        value !== "non-stock" &&
        value !== "non stock"
    );
}

// ============================================================
// POST — APPROVE PURCHASE INVOICE
// ============================================================

export async function POST(request, { params }) {
    const client = await pool.connect();

    let transactionStarted = false;

    try {
        const user = await getCurrentUser();

        if (!user) {
            throw new Error("UNAUTHORIZED");
        }

        if (!user.companyId) {
            throw new Error("User is not assigned to a company.");
        }

        await requirePermission(
            user,
            "purchase_invoices",
            "update"
        );

        const resolvedParams = await params;
        const purchaseId = Number(resolvedParams.id);

        if (!Number.isInteger(purchaseId) || purchaseId <= 0) {
            const error = new Error("Invalid Purchase Invoice ID.");
            error.status = 400;
            throw error;
        }

        await client.query("BEGIN");
        transactionStarted = true;

        // ----------------------------------------------------
        // 1. LOCK PURCHASE INVOICE
        // ----------------------------------------------------

        const purchaseResult = await client.query(
            `
            SELECT
                p.*,
                s.supplier_name,
                w.warehouse_name
            FROM purchases p
            INNER JOIN suppliers s
                ON s.supplier_id = p.supplier_id
            INNER JOIN warehouses w
                ON w.warehouse_id = p.warehouse_id
            WHERE p.purchase_id = $1
              AND p.company_id = $2
            FOR UPDATE OF p
            `,
            [purchaseId, user.companyId]
        );

        const purchase = purchaseResult.rows[0];

        if (!purchase) {
            const error = new Error("Purchase Invoice not found.");
            error.status = 404;
            throw error;
        }

        if (purchase.document_status !== "DRAFT") {
            const error = new Error(
                `Cannot approve an invoice with status ${purchase.document_status}.`
            );
            error.status = 400;
            throw error;
        }

        if (
            !["MANUAL", "ITEM_RECEIPT"].includes(
                purchase.source_type
            )
        ) {
            throw new Error("Invalid Purchase Invoice source type.");
        }

        // ----------------------------------------------------
        // 2. LOAD AND LOCK INVOICE ITEMS
        // ----------------------------------------------------

        const itemsResult = await client.query(
            `
            SELECT
                pi.*,
                pr.product_name,
                pr.item_type,
                pr.inventory_account_id,
                pr.purchase_account_id
            FROM purchase_items pi
            INNER JOIN products pr
                ON pr.product_id = pi.product_id
            WHERE pi.purchase_id = $1
            ORDER BY pi.purchase_item_id
            FOR UPDATE OF pi
            `,
            [purchaseId]
        );

        const items = itemsResult.rows;

        if (!items.length) {
            throw new Error("Purchase Invoice has no items.");
        }

        // ----------------------------------------------------
        // 3. VALIDATE ITEM RECEIPT
        // ----------------------------------------------------

        if (purchase.source_type === "ITEM_RECEIPT") {
            if (!purchase.item_receipt_id) {
                throw new Error(
                    "This invoice has no linked Item Receipt."
                );
            }

            const receiptResult = await client.query(
                `
                SELECT
                    item_receipt_id,
                    supplier_id,
                    warehouse_id,
                    company_id,
                    status
                FROM item_receipts
                WHERE item_receipt_id = $1
                  AND company_id = $2
                FOR UPDATE
                `,
                [
                    purchase.item_receipt_id,
                    user.companyId,
                ]
            );

            const receipt = receiptResult.rows[0];

            if (!receipt || receipt.status !== "APPROVED") {
                throw new Error(
                    "The linked Item Receipt is not approved."
                );
            }

            if (
                Number(receipt.supplier_id) !==
                    Number(purchase.supplier_id) ||
                Number(receipt.warehouse_id) !==
                    Number(purchase.warehouse_id)
            ) {
                throw new Error(
                    "Item Receipt supplier or warehouse does not match the invoice."
                );
            }

            const receiptItemIds = [
                ...new Set(
                    items.map((item) =>
                        Number(item.item_receipt_item_id)
                    )
                ),
            ].sort((a, b) => a - b);

            if (
                items.some(
                    (item) => !item.item_receipt_item_id
                )
            ) {
                throw new Error(
                    "Every invoice line must be linked to a receipt line."
                );
            }

            for (const receiptItemId of receiptItemIds) {
                const receiptItemResult = await client.query(
                    `
                    SELECT
                        item_receipt_item_id,
                        product_id,
                        quantity_received
                    FROM item_receipt_items
                    WHERE item_receipt_item_id = $1
                      AND item_receipt_id = $2
                    FOR UPDATE
                    `,
                    [
                        receiptItemId,
                        purchase.item_receipt_id,
                    ]
                );

                const receiptItem = receiptItemResult.rows[0];

                if (!receiptItem) {
                    throw new Error(
                        "An invoice line references an invalid receipt item."
                    );
                }

                const invoiceQuantity = items
                    .filter(
                        (item) =>
                            Number(item.item_receipt_item_id) ===
                            receiptItemId
                    )
                    .reduce(
                        (total, item) =>
                            total + Number(item.quantity),
                        0
                    );

                const otherInvoicesResult = await client.query(
                    `
                    SELECT COALESCE(SUM(pi.quantity), 0)
                        AS invoiced_quantity
                    FROM purchase_items pi
                    INNER JOIN purchases p
                        ON p.purchase_id = pi.purchase_id
                    WHERE pi.item_receipt_item_id = $1
                      AND p.document_status <> 'CANCELLED'
                      AND p.purchase_id <> $2
                    `,
                    [receiptItemId, purchaseId]
                );

                const alreadyInvoiced = Number(
                    otherInvoicesResult.rows[0].invoiced_quantity
                );

                const remaining =
                    Number(receiptItem.quantity_received) -
                    alreadyInvoiced;

                if (invoiceQuantity > remaining + 0.000001) {
                    throw new Error(
                        `Receipt item ${receiptItemId} has only ${Math.max(0, remaining)} uninvoiced units remaining.`
                    );
                }

                for (const item of items.filter(
                    (row) =>
                        Number(row.item_receipt_item_id) ===
                        receiptItemId
                )) {
                    if (
                        Number(item.product_id) !==
                        Number(receiptItem.product_id)
                    ) {
                        throw new Error(
                            "Invoice product does not match the receipt product."
                        );
                    }
                }
            }
        } else {
            if (
                purchase.item_receipt_id ||
                items.some((item) => item.item_receipt_item_id)
            ) {
                throw new Error(
                    "Manual invoices cannot contain Item Receipt links."
                );
            }
        }

        // ----------------------------------------------------
        // 4. VALIDATE TOTALS
        // ----------------------------------------------------

        const subtotal = items.reduce(
            (sum, item) => sum + Number(item.line_total || 0),
            0
        );

        const calculatedTotal =
            subtotal -
            Number(purchase.discount || 0) +
            Number(purchase.tax || 0);

        const storedTotal = Number(purchase.total_amount);

        if (
            Math.abs(calculatedTotal - storedTotal) > 0.01
        ) {
            throw new Error(
                "Invoice total does not match its item totals."
            );
        }

        if (calculatedTotal < 0) {
            throw new Error("Invoice total cannot be negative.");
        }

        // ----------------------------------------------------
        // 5. GET ACCOUNTS
        // ----------------------------------------------------

        const payableAccount = await getAccount(
            client,
            null,
            "2100"
        );

        const debitAccounts = new Map();

        for (const item of items) {
            const stockable = isStockItem(item.item_type);

            const account = stockable
                ? await getAccount(
                    client,
                    item.inventory_account_id,
                    "1400"
                )
                : await getAccount(
                    client,
                    item.purchase_account_id,
                    "5200"
                );

            const amount = Number(item.line_total || 0);

            if (amount < 0) {
                throw new Error(
                    `Invalid line total for ${item.product_name}.`
                );
            }

            const key = Number(account.account_id);

            if (!debitAccounts.has(key)) {
                debitAccounts.set(key, {
                    account,
                    amount: 0,
                });
            }

            debitAccounts.get(key).amount += amount;
        }

        // ----------------------------------------------------
        // 6. UPDATE STOCK FOR MANUAL INVOICES ONLY
        // ----------------------------------------------------

        if (purchase.source_type === "MANUAL") {
            for (const item of items) {
                if (!isStockItem(item.item_type)) {
                    continue;
                }

                const quantity = Number(item.quantity);
                const unitCost = Number(item.unit_cost);
                const amount = Number(item.line_total);

                if (quantity <= 0 || unitCost < 0) {
                    throw new Error(
                        `Invalid stock quantity or cost for ${item.product_name}.`
                    );
                }

                const stockResult = await client.query(
                    `
                    INSERT INTO stock (
                        product_id,
                        warehouse_id,
                        quantity
                    )
                    VALUES ($1, $2, $3)
                    ON CONFLICT (product_id, warehouse_id)
                    DO UPDATE SET
                        quantity = stock.quantity + EXCLUDED.quantity
                    RETURNING quantity
                    `,
                    [
                        item.product_id,
                        purchase.warehouse_id,
                        quantity,
                    ]
                );

                const runningQuantity = Number(
                    stockResult.rows[0].quantity
                );

                // Correct database column: transaction_number
                await client.query(
                    `
                    INSERT INTO inventory_transactions (
                        product_id,
                        transaction_type,
                        transaction_number,
                        location,
                        receive_quantity,
                        receive_rate,
                        receive_amount,
                        running_quantity
                    )
                    VALUES ($1, 'VENDOR BILL', $2, $3, $4, $5, $6, $7)
                    `,
                    [
                        item.product_id,
                        purchase.purchase_number,
                        purchase.warehouse_name,
                        quantity,
                        unitCost,
                        amount,
                        runningQuantity,
                    ]
                );
            }
        }

        // ----------------------------------------------------
        // 7. CREATE JOURNAL ENTRY
        // ----------------------------------------------------

        const journalNumber =
            `PI-JE-${purchase.purchase_number}`;

        const journalResult = await client.query(
            `
            INSERT INTO journal_entries (
                journal_number,
                journal_date,
                reference_type,
                reference_id,
                description,
                status,
                created_by
            )
            VALUES (
                $1, $2, 'PURCHASE', $3,
                $4, 'POSTED', $5
            )
            RETURNING journal_id
            `,
            [
                journalNumber,
                purchase.purchase_date,
                purchaseId,
                `Purchase Invoice ${purchase.purchase_number} - ${purchase.supplier_name}`,
                user.userId,
            ]
        );

        const journalId = journalResult.rows[0].journal_id;

        // Debit inventory or purchase expense accounts.

        for (const { account, amount } of debitAccounts.values()) {
            if (amount <= 0) {
                continue;
            }

            await client.query(
                `
                INSERT INTO journal_entry_lines (
                    journal_id,
                    account_id,
                    description,
                    debit,
                    credit,
                    party_type,
                    party_id,
                    entity_name
                )
                VALUES ($1, $2, $3, $4, 0, 'SUPPLIER', $5, $6)
                `,
                [
                    journalId,
                    account.account_id,
                    `Purchase Invoice ${purchase.purchase_number}`,
                    amount,
                    purchase.supplier_id,
                    purchase.supplier_name,
                ]
            );

            await client.query(
                `
                UPDATE chart_of_accounts
                SET current_balance =
                    COALESCE(current_balance, 0) + $1,
                    updated_at = CURRENT_TIMESTAMP
                WHERE account_id = $2
                `,
                [amount, account.account_id]
            );
        }

        // Credit Accounts Payable.

        if (calculatedTotal > 0) {
            await client.query(
                `
                INSERT INTO journal_entry_lines (
                    journal_id,
                    account_id,
                    description,
                    debit,
                    credit,
                    party_type,
                    party_id,
                    entity_name
                )
                VALUES ($1, $2, $3, 0, $4, 'SUPPLIER', $5, $6)
                `,
                [
                    journalId,
                    payableAccount.account_id,
                    `Accounts Payable - ${purchase.purchase_number}`,
                    calculatedTotal,
                    purchase.supplier_id,
                    purchase.supplier_name,
                ]
            );

            await client.query(
                `
                UPDATE chart_of_accounts
                SET current_balance =
                    COALESCE(current_balance, 0) + $1,
                    updated_at = CURRENT_TIMESTAMP
                WHERE account_id = $2
                `,
                [
                    calculatedTotal,
                    payableAccount.account_id,
                ]
            );
        }

        // ----------------------------------------------------
        // 8. APPROVE INVOICE
        // ----------------------------------------------------

        const approvedResult = await client.query(
            `
            UPDATE purchases
            SET
                document_status = 'APPROVED',
                approved_at = CURRENT_TIMESTAMP,
                approved_by = $1,
                updated_at = CURRENT_TIMESTAMP
            WHERE purchase_id = $2
              AND company_id = $3
              AND document_status = 'DRAFT'
            RETURNING *
            `,
            [
                user.userId,
                purchaseId,
                user.companyId,
            ]
        );

        if (!approvedResult.rows.length) {
            throw new Error(
                "Invoice approval failed. Its status may have changed."
            );
        }

        await client.query("COMMIT");
        transactionStarted = false;

        return NextResponse.json({
            message: "Purchase Invoice approved successfully.",
            invoice: approvedResult.rows[0],
            journalId,
            journalNumber,
            stockUpdated:
                purchase.source_type === "MANUAL",
        });
    } catch (error) {
        if (transactionStarted) {
            await client.query("ROLLBACK").catch(() => {});
        }

        return errorResponse(error);
    } finally {
        client.release();
    }
}
