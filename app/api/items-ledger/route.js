
import { NextResponse } from "next/server";
import { getTenantDb } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { requirePermission } from "@/lib/permissions";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const roundMoney = (value) =>
    Math.round((Number(value) + Number.EPSILON) * 100) / 100;

const roundRate = (value) =>
    Math.round((Number(value) + Number.EPSILON) * 100000000) / 100000000;

function isValidDate(value) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value || "")) return false;

    const date = new Date(`${value}T00:00:00.000Z`);

    return (
        !Number.isNaN(date.getTime()) &&
        date.toISOString().slice(0, 10) === value
    );
}

function getMovementAmount(quantity, storedAmount, storedRate) {
    const amount = Number(storedAmount) || 0;

    if (amount !== 0 || Number(quantity) === 0) {
        return roundMoney(amount);
    }

    return roundMoney(
        Number(quantity) * (Number(storedRate) || 0)
    );
}

export async function GET(request) {
    try {
        const user = await getCurrentUser();

        if (!user) {
            return NextResponse.json(
                {
                    success: false,
                    message: "Unauthorized. Please log in again.",
                },
                { status: 401 }
            );
        }

        await requirePermission(user, "items_ledger", "view");

        const db = await getTenantDb(user);
        const { searchParams } = new URL(request.url);

        const productId = Number(searchParams.get("productId"));
        const fromDate = searchParams.get("fromDate");
        const toDate = searchParams.get("toDate");
        const locationParam = searchParams.get("location");

        const location =
            locationParam?.trim() &&
            locationParam.trim().toLowerCase() !== "all locations"
                ? locationParam.trim()
                : "";

        if (!Number.isInteger(productId) || productId <= 0) {
            return NextResponse.json(
                {
                    success: false,
                    message: "A valid Product ID is required.",
                },
                { status: 400 }
            );
        }

        if (!fromDate || !toDate) {
            return NextResponse.json(
                {
                    success: false,
                    message: "From Date and To Date are required.",
                },
                { status: 400 }
            );
        }

        if (!isValidDate(fromDate) || !isValidDate(toDate)) {
            return NextResponse.json(
                {
                    success: false,
                    message: "Invalid date format. Use YYYY-MM-DD.",
                },
                { status: 400 }
            );
        }

        if (fromDate > toDate) {
            return NextResponse.json(
                {
                    success: false,
                    message: "From Date cannot be greater than To Date.",
                },
                { status: 400 }
            );
        }

        // --------------------------------------------------
        // PRODUCT
        // --------------------------------------------------

        const productResult = await db.query(
            `
            SELECT
                product_id,
                sku,
                product_name,
                unit,
                minimum_stock
            FROM products
            WHERE product_id = $1
            LIMIT 1
            `,
            [productId]
        );

        if (productResult.rows.length === 0) {
            return NextResponse.json(
                {
                    success: false,
                    message: "Product not found.",
                },
                { status: 404 }
            );
        }

        const product = productResult.rows[0];

        // --------------------------------------------------
        // COMPLETE HISTORY THROUGH TO DATE
        // AVCO MUST BE REPLAYED FROM THE BEGINNING
        // --------------------------------------------------

        let historyQuery = `
            SELECT
                it.inventory_transaction_id,
                it.product_id,
                it.transaction_date,
                it.transaction_type,
                it.transaction_number,
                it.location,
                COALESCE(it.warehouse_id, w.warehouse_id) AS warehouse_id,
                it.uom,
                it.memo,
                it.transaction_rate,
                it.old_rate,
                it.actual_rate,
                it.new_rate,
                it.receive_quantity,
                it.receive_rate,
                it.receive_amount,
                it.issue_quantity,
                it.issue_rate,
                it.issue_amount
            FROM inventory_transactions it
            LEFT JOIN warehouses w
                ON w.company_id = it.company_id
                AND LOWER(TRIM(w.warehouse_name)) =
                    LOWER(TRIM(it.location))
                AND w.deleted_at IS NULL
            WHERE it.product_id = $1
              AND it.transaction_date <= $2::DATE
        `;

        const historyParams = [productId, toDate];

        if (location) {
            historyQuery += `
                AND TRIM(it.location) = TRIM($3)
            `;
            historyParams.push(location);
        }

        historyQuery += `
            ORDER BY
                it.transaction_date ASC,
                it.inventory_transaction_id ASC
        `;

        const historyResult = await db.query(
            historyQuery,
            historyParams
        );

        // --------------------------------------------------
        // WAREHOUSE VALUATION STATES
        // --------------------------------------------------

        const warehouses = new Map();

        function getWarehouseState(row) {
            const key = row.warehouse_id != null
                ? String(row.warehouse_id)
                : `location:${String(row.location || "Unknown").trim().toLowerCase()}`;

            if (!warehouses.has(key)) {
                warehouses.set(key, {
                    warehouse_id: row.warehouse_id,
                    location: row.location || "Unknown",
                    quantity: 0,
                    inventory_value: 0,
                    average_cost: 0,
                });
            }

            return warehouses.get(key);
        }

        function recalculateAverage(state) {
            if (state.quantity > 0) {
                state.average_cost =
                    state.inventory_value / state.quantity;
            } else {
                state.average_cost = 0;
            }
        }

        // --------------------------------------------------
        // REPLAY TRANSACTIONS BEFORE FROM DATE
        // TO ESTABLISH OPENING QUANTITY AND VALUE
        // --------------------------------------------------

        const historyRows = historyResult.rows;

        let index = 0;

        while (
            index < historyRows.length &&
            String(historyRows[index].transaction_date).slice(0, 10) < fromDate
        ) {
            const row = historyRows[index];
            const state = getWarehouseState(row);

            const receiveQty = Number(row.receive_quantity) || 0;
            const issueQty = Number(row.issue_quantity) || 0;

            if (receiveQty > 0) {
                const receiptValue = getMovementAmount(
                    receiveQty,
                    row.receive_amount,
                    row.receive_rate
                );

                state.quantity += receiveQty;
                state.inventory_value += receiptValue;

                recalculateAverage(state);
            }

            if (issueQty > 0) {
                const issueRate =
                    state.quantity > 0
                        ? state.average_cost
                        : Number(row.issue_rate) || 0;

                const issueValue = roundMoney(issueQty * issueRate);

                state.quantity -= issueQty;
                state.inventory_value -= issueValue;

                recalculateAverage(state);
            }

            index++;
        }

        // Opening balances are the state immediately before From Date.
        let openingQuantity = 0;
        let openingInventoryValue = 0;

        for (const state of warehouses.values()) {
            openingQuantity += state.quantity;
            openingInventoryValue += state.inventory_value;
        }

        openingInventoryValue = roundMoney(openingInventoryValue);

        // --------------------------------------------------
        // PROCESS SELECTED PERIOD
        // --------------------------------------------------

        let receivedQuantity = 0;
        let issuedQuantity = 0;
        let receiveAmount = 0;
        let issueAmount = 0;

        let valuationWarnings = 0;

        const transactions = [];

        for (; index < historyRows.length; index++) {
            const row = historyRows[index];
            const state = getWarehouseState(row);

            const receiveQty = Number(row.receive_quantity) || 0;
            const issueQty = Number(row.issue_quantity) || 0;

            const oldAverage = state.average_cost;

            let actualRate = 0;
            let newAverage = oldAverage;
            let rowReceiveAmount = 0;
            let rowIssueAmount = 0;
            let issueRate = 0;

            if (receiveQty > 0) {
                rowReceiveAmount = getMovementAmount(
                    receiveQty,
                    row.receive_amount,
                    row.receive_rate
                );

                actualRate = rowReceiveAmount / receiveQty;

                state.quantity += receiveQty;
                state.inventory_value += rowReceiveAmount;

                recalculateAverage(state);
                newAverage = state.average_cost;

                receivedQuantity += receiveQty;
                receiveAmount += rowReceiveAmount;
            }

            if (issueQty > 0) {
                if (state.quantity > 0) {
                    issueRate = state.average_cost;
                } else {
                    // Historical negative-stock fallback.
                    // This is flagged so it can be investigated.
                    issueRate = Number(row.issue_rate) || 0;
                    valuationWarnings++;
                }

                rowIssueAmount = roundMoney(issueQty * issueRate);

                state.quantity -= issueQty;
                state.inventory_value -= rowIssueAmount;

                recalculateAverage(state);
                newAverage = state.average_cost;

                issuedQuantity += issueQty;
                issueAmount += rowIssueAmount;
            }

            transactions.push({
                inventory_transaction_id:
                    row.inventory_transaction_id,

                product_id: row.product_id,
                transaction_date: row.transaction_date,
                transaction_type: row.transaction_type,
                transaction_number: row.transaction_number,
                warehouse_id: row.warehouse_id,
                location: row.location,
                uom: row.uom,
                memo: row.memo,

                transaction_rate: roundRate(
                    receiveQty > 0
                        ? actualRate
                        : issueRate || Number(row.transaction_rate) || 0
                ),

                old_rate: roundRate(oldAverage),
                actual_rate: roundRate(
                    receiveQty > 0
                        ? actualRate
                        : issueRate
                ),
                new_rate: roundRate(newAverage),

                receive_quantity: receiveQty,
                receive_rate: receiveQty > 0
                    ? roundRate(actualRate)
                    : Number(row.receive_rate) || 0,
                receive_amount: rowReceiveAmount,

                issue_quantity: issueQty,
                issue_rate: roundRate(issueRate),
                issue_amount: rowIssueAmount,

                running_total: state.quantity,
                running_inventory_value: roundMoney(
                    state.inventory_value
                ),
                average_cost: roundRate(state.average_cost),
            });
        }

        // --------------------------------------------------
        // CLOSING TOTALS
        // --------------------------------------------------

        let closingQuantity = 0;
        let closingInventoryValue = 0;

        const warehouseBalances = [];

        for (const state of warehouses.values()) {
            closingQuantity += state.quantity;
            closingInventoryValue += state.inventory_value;

            warehouseBalances.push({
                warehouse_id: state.warehouse_id,
                location: state.location,
                quantity: state.quantity,
                inventory_value: roundMoney(state.inventory_value),
                average_cost: roundRate(state.average_cost),
            });
        }

        closingInventoryValue = roundMoney(closingInventoryValue);

        const closingAverageCost =
            closingQuantity > 0
                ? closingInventoryValue / closingQuantity
                : 0;

        // --------------------------------------------------
        // RESPONSE
        // --------------------------------------------------

        return NextResponse.json(
            {
                success: true,

                product: {
                    product_id: product.product_id,
                    sku: product.sku,
                    product_name: product.product_name,
                    unit: product.unit,
                    minimum_stock:
                        Number(product.minimum_stock) || 0,
                },

                opening_quantity: openingQuantity,
                opening_inventory_value: openingInventoryValue,

                closing_quantity: closingQuantity,
                closing_inventory_value: closingInventoryValue,
                closing_average_cost: roundRate(closingAverageCost),

                warehouse_balances: warehouseBalances,
                valuation_warnings: valuationWarnings,

                transactions,

                totals: {
                    opening_quantity: openingQuantity,
                    opening_inventory_value: openingInventoryValue,
                    received_quantity: receivedQuantity,
                    issued_quantity: issuedQuantity,
                    receive_amount: roundMoney(receiveAmount),
                    issue_amount: roundMoney(issueAmount),
                    current_stock: closingQuantity,
                    closing_inventory_value: closingInventoryValue,
                    closing_average_cost: roundRate(closingAverageCost),
                },
            },
            {
                headers: {
                    "Cache-Control":
                        "no-store, no-cache, must-revalidate",
                },
            }
        );
    } catch (error) {
        console.error("ITEMS LEDGER GET ERROR:", error);

        if (error.message === "UNAUTHORIZED") {
            return NextResponse.json(
                {
                    success: false,
                    message: "Unauthorized. Please log in again.",
                },
                { status: 401 }
            );
        }

        if (error.message === "FORBIDDEN") {
            return NextResponse.json(
                {
                    success: false,
                    message: "You do not have permission to view Items Ledger.",
                },
                { status: 403 }
            );
        }

        return NextResponse.json(
            {
                success: false,
                message: "Failed to load Items Ledger.",
                error: error.message,
            },
            { status: 500 }
        );
    }
}
