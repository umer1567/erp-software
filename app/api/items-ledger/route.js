
import { NextResponse } from "next/server";
import pool from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { requirePermission } from "@/lib/permissions";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function isValidDate(value) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value || "")) {
        return false;
    }

    const date = new Date(`${value}T00:00:00.000Z`);

    return (
        !Number.isNaN(date.getTime()) &&
        date.toISOString().slice(0, 10) === value
    );
}

export async function GET(request) {
    try {
        // --------------------------------------------------
        // AUTHENTICATION
        // --------------------------------------------------

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

        // --------------------------------------------------
        // PERMISSION
        // --------------------------------------------------

        await requirePermission(user, "items_ledger", "view");

        // --------------------------------------------------
        // REQUEST PARAMETERS
        // --------------------------------------------------

        const { searchParams } = new URL(request.url);

        const productId = Number(searchParams.get("productId"));
        const fromDate = searchParams.get("fromDate");
        const toDate = searchParams.get("toDate");
        const locationParam = searchParams.get("location");

        const location =
            locationParam &&
            locationParam.trim() !== "" &&
            locationParam.trim().toLowerCase() !== "all locations"
                ? locationParam.trim()
                : "";

        // --------------------------------------------------
        // VALIDATION
        // --------------------------------------------------

        if (
            !Number.isInteger(productId) ||
            productId <= 0
        ) {
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

        const productResult = await pool.query(
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
        // TRANSACTIONS WITHIN SELECTED PERIOD
        // --------------------------------------------------

        let transactionQuery = `
            SELECT
                inventory_transaction_id,
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
                issue_amount
            FROM inventory_transactions
            WHERE product_id = $1
              AND transaction_date >= $2::DATE
              AND transaction_date <= $3::DATE
        `;

        const transactionParams = [
            productId,
            fromDate,
            toDate,
        ];

        if (location) {
            transactionQuery += `
                AND TRIM(location) = TRIM($4)
            `;

            transactionParams.push(location);
        }

        transactionQuery += `
            ORDER BY
                transaction_date ASC,
                inventory_transaction_id ASC
        `;

        const transactionsResult = await pool.query(
            transactionQuery,
            transactionParams
        );

        // --------------------------------------------------
        // OPENING BALANCE BEFORE FROM DATE
        // --------------------------------------------------

        let openingQuery = `
            SELECT
                COALESCE(
                    SUM(
                        COALESCE(receive_quantity, 0)
                        -
                        COALESCE(issue_quantity, 0)
                    ),
                    0
                ) AS opening_quantity
            FROM inventory_transactions
            WHERE product_id = $1
              AND transaction_date < $2::DATE
        `;

        const openingParams = [
            productId,
            fromDate,
        ];

        if (location) {
            openingQuery += `
                AND TRIM(location) = TRIM($3)
            `;

            openingParams.push(location);
        }

        const openingResult = await pool.query(
            openingQuery,
            openingParams
        );

        let openingQuantity =
            Number(openingResult.rows[0]?.opening_quantity) || 0;

        // --------------------------------------------------
        // PERIOD TRANSACTIONS
        // --------------------------------------------------

        const periodRows = transactionsResult.rows;

        // Opening balance transactions occurring on the
        // From Date are included in opening stock.
        // They must not be counted again as period receipts.
        const openingBalanceRows = periodRows.filter(
            (row) =>
                String(row.transaction_type || "")
                    .trim()
                    .toUpperCase() === "OPENING BALANCE"
        );

        if (openingBalanceRows.length > 0) {
            const openingBalanceQuantity =
                openingBalanceRows.reduce((sum, row) => {
                    const receive =
                        Number(row.receive_quantity) || 0;

                    const issue =
                        Number(row.issue_quantity) || 0;

                    return sum + receive - issue;
                }, 0);

            openingQuantity += openingBalanceQuantity;
        }

        // --------------------------------------------------
        // RUNNING TOTALS
        // --------------------------------------------------

        let runningTotal = openingQuantity;

        let receivedQuantity = 0;
        let issuedQuantity = 0;

        let receiveAmount = 0;
        let issueAmount = 0;

        const transactions = [];

        for (const row of periodRows) {
            const transactionType =
                String(row.transaction_type || "")
                    .trim()
                    .toUpperCase();

            const isOpeningBalance =
                transactionType === "OPENING BALANCE";

            const receiveQuantity =
                Number(row.receive_quantity) || 0;

            const issueQuantity =
                Number(row.issue_quantity) || 0;

            const rowReceiveAmount =
                Number(row.receive_amount) || 0;

            const rowIssueAmount =
                Number(row.issue_amount) || 0;

            if (!isOpeningBalance) {
                receivedQuantity += receiveQuantity;
                issuedQuantity += issueQuantity;

                receiveAmount += rowReceiveAmount;
                issueAmount += rowIssueAmount;

                runningTotal +=
                    receiveQuantity - issueQuantity;
            }

            transactions.push({
                inventory_transaction_id:
                    row.inventory_transaction_id,

                product_id:
                    row.product_id,

                transaction_date:
                    row.transaction_date,

                transaction_type:
                    row.transaction_type,

                transaction_number:
                    row.transaction_number,

                location:
                    row.location,

                uom:
                    row.uom,

                memo:
                    row.memo,

                transaction_rate:
                    Number(row.transaction_rate) || 0,

                old_rate:
                    Number(row.old_rate) || 0,

                actual_rate:
                    Number(row.actual_rate) || 0,

                new_rate:
                    Number(row.new_rate) || 0,

                receive_quantity:
                    receiveQuantity,

                receive_rate:
                    Number(row.receive_rate) || 0,

                receive_amount:
                    rowReceiveAmount,

                issue_quantity:
                    issueQuantity,

                issue_rate:
                    Number(row.issue_rate) || 0,

                issue_amount:
                    rowIssueAmount,

                running_total:
                    runningTotal,
            });
        }

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

                closing_quantity: runningTotal,

                transactions,

                totals: {
                    opening_quantity: openingQuantity,
                    received_quantity: receivedQuantity,
                    issued_quantity: issuedQuantity,
                    receive_amount: receiveAmount,
                    issue_amount: issueAmount,
                    current_stock: runningTotal,
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
        console.error(
            "ITEMS LEDGER GET ERROR:",
            error
        );

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
