
import { NextResponse } from "next/server";
import pool from "@/lib/db";

export const dynamic = "force-dynamic";

function getPurchaseStatus(paidAmount, totalAmount) {
    if (paidAmount <= 0) return "UNPAID";
    if (paidAmount >= totalAmount) return "PAID";
    return "PARTIAL";
}

function errorResponse(message, status = 500) {
    return NextResponse.json(
        { success: false, message },
        { status }
    );
}

// =====================================================
// GET: LOAD PURCHASE PAYMENT HISTORY
// =====================================================
export async function GET() {
    try {
        const result = await pool.query(`
            SELECT
                pp.payment_id,
                pp.payment_number,
                pp.purchase_id,
                p.purchase_number,
                pp.supplier_id,
                s.supplier_code,
                s.supplier_name,
                pp.payment_date,
                pp.amount,
                pp.payment_method,
                pp.reference_number,
                pp.notes,
                pp.created_at
            FROM purchase_payments pp
            INNER JOIN purchases p
                ON p.purchase_id = pp.purchase_id
            INNER JOIN suppliers s
                ON s.supplier_id = pp.supplier_id
            ORDER BY pp.payment_id DESC
        `);

        return NextResponse.json({
            success: true,
            payments: result.rows,
        });
    } catch (error) {
        console.error("PURCHASE PAYMENTS GET ERROR:", error);

        return errorResponse(
            "Failed to load purchase payments.",
            500
        );
    }
}

// =====================================================
// POST: CREATE PURCHASE PAYMENT
// =====================================================
export async function POST(request) {
    let client;

    try {
        const body = await request.json();

        const {
            paymentNumber,
            purchaseId,
            paymentDate,
            amount,
            paymentMethod,
            referenceNumber,
            notes,
        } = body;

        if (!purchaseId) {
            return errorResponse(
                "Purchase is required.",
                400
            );
        }

        const paymentAmount = Number(amount);

        if (
            !Number.isFinite(paymentAmount) ||
            paymentAmount <= 0
        ) {
            return errorResponse(
                "Payment amount must be greater than zero.",
                400
            );
        }

        client = await pool.connect();

        await client.query("BEGIN");

        const purchaseResult = await client.query(
            `
                SELECT
                    purchase_id,
                    supplier_id,
                    total_amount,
                    paid_amount,
                    balance_amount
                FROM purchases
                WHERE purchase_id = $1
                FOR UPDATE
            `,
            [purchaseId]
        );

        if (purchaseResult.rows.length === 0) {
            throw new Error("Purchase not found.");
        }

        const purchase = purchaseResult.rows[0];
        const balanceAmount = Number(purchase.balance_amount);

        if (paymentAmount > balanceAmount) {
            throw new Error(
                `Payment cannot exceed the remaining purchase balance of ${balanceAmount.toFixed(2)}.`
            );
        }

        const finalPaymentNumber =
            paymentNumber?.trim() || `PPAY-${Date.now()}`;

        const paymentResult = await client.query(
            `
                INSERT INTO purchase_payments (
                    payment_number,
                    purchase_id,
                    supplier_id,
                    payment_date,
                    amount,
                    payment_method,
                    reference_number,
                    notes
                )
                VALUES (
                    $1,
                    $2,
                    $3,
                    COALESCE($4::DATE, CURRENT_DATE),
                    $5,
                    $6,
                    $7,
                    $8
                )
                RETURNING *
            `,
            [
                finalPaymentNumber,
                purchase.purchase_id,
                purchase.supplier_id,
                paymentDate || null,
                paymentAmount,
                paymentMethod || "CASH",
                referenceNumber || null,
                notes || null,
            ]
        );

        const newPaidAmount =
            Number(purchase.paid_amount || 0) + paymentAmount;

        const newBalance = Math.max(
            Number(purchase.total_amount) - newPaidAmount,
            0
        );

        await client.query(
            `
                UPDATE purchases
                SET
                    paid_amount = $1,
                    balance_amount = $2,
                    status = $3,
                    updated_at = CURRENT_TIMESTAMP
                WHERE purchase_id = $4
            `,
            [
                newPaidAmount,
                newBalance,
                getPurchaseStatus(
                    newPaidAmount,
                    Number(purchase.total_amount)
                ),
                purchase.purchase_id,
            ]
        );

        await client.query("COMMIT");

        return NextResponse.json(
            {
                success: true,
                message: "Purchase payment recorded successfully.",
                payment: paymentResult.rows[0],
            },
            { status: 201 }
        );
    } catch (error) {
        if (client) {
            await client.query("ROLLBACK").catch(() => {});
        }

        console.error("PURCHASE PAYMENT POST ERROR:", error);

        if (error.code === "23505") {
            return errorResponse(
                "Payment number already exists.",
                409
            );
        }

        return errorResponse(
            error.message || "Failed to record purchase payment.",
            500
        );
    } finally {
        client?.release();
    }
}

// =====================================================
// PUT: EDIT EXISTING PURCHASE PAYMENT
// =====================================================
export async function PUT(request) {
    let client;

    try {
        const body = await request.json();

        // Accept common ID field names used by edit forms.
        const paymentId =
            body.paymentId ??
            body.payment_id ??
            body.id;

        const {
            paymentNumber,
            purchaseId,
            paymentDate,
            amount,
            paymentMethod,
            referenceNumber,
            notes,
        } = body;

        if (!paymentId) {
            return errorResponse(
                "Payment ID is required to edit a payment.",
                400
            );
        }

        if (!purchaseId) {
            return errorResponse(
                "Purchase is required.",
                400
            );
        }

        const paymentAmount = Number(amount);

        if (
            !Number.isFinite(paymentAmount) ||
            paymentAmount <= 0
        ) {
            return errorResponse(
                "Payment amount must be greater than zero.",
                400
            );
        }

        const finalPaymentNumber = paymentNumber?.trim();

        if (!finalPaymentNumber) {
            return errorResponse(
                "Payment number is required.",
                400
            );
        }

        client = await pool.connect();

        await client.query("BEGIN");

        // Lock the payment so two edits cannot modify it simultaneously.
        const existingResult = await client.query(
            `
                SELECT *
                FROM purchase_payments
                WHERE payment_id = $1
                FOR UPDATE
            `,
            [paymentId]
        );

        if (existingResult.rows.length === 0) {
            throw new Error("Purchase payment not found.");
        }

        const oldPayment = existingResult.rows[0];
        const oldPurchaseId = Number(oldPayment.purchase_id);
        const newPurchaseId = Number(purchaseId);
        const oldAmount = Number(oldPayment.amount);

        // Lock both purchases in consistent ID order.
        const purchaseIds = [
            ...new Set([oldPurchaseId, newPurchaseId]),
        ].sort((a, b) => a - b);

        const purchasesResult = await client.query(
            `
                SELECT
                    purchase_id,
                    supplier_id,
                    total_amount,
                    paid_amount,
                    balance_amount
                FROM purchases
                WHERE purchase_id = ANY($1::int[])
                ORDER BY purchase_id
                FOR UPDATE
            `,
            [purchaseIds]
        );

        const purchases = new Map(
            purchasesResult.rows.map((purchase) => [
                Number(purchase.purchase_id),
                purchase,
            ])
        );

        const oldPurchase = purchases.get(oldPurchaseId);
        const newPurchase = purchases.get(newPurchaseId);

        if (!oldPurchase) {
            throw new Error("Original purchase not found.");
        }

        if (!newPurchase) {
            throw new Error("Selected purchase not found.");
        }

        // Check for a duplicate payment number, excluding this payment.
        const duplicateResult = await client.query(
            `
                SELECT payment_id
                FROM purchase_payments
                WHERE payment_number = $1
                  AND payment_id <> $2
                LIMIT 1
            `,
            [finalPaymentNumber, paymentId]
        );

        if (duplicateResult.rows.length > 0) {
            await client.query("ROLLBACK");

            return errorResponse(
                "Payment number already exists.",
                409
            );
        }

        const samePurchase =
            oldPurchaseId === newPurchaseId;

        // When editing the same purchase, add back the old payment
        // before checking whether the new amount fits its balance.
        const availableBalance =
            Number(newPurchase.balance_amount) +
            (samePurchase ? oldAmount : 0);

        if (paymentAmount > availableBalance) {
            throw new Error(
                `Payment cannot exceed the available purchase balance of ${availableBalance.toFixed(2)}.`
            );
        }

        // Update the payment details.
        const updatedPaymentResult = await client.query(
            `
                UPDATE purchase_payments
                SET
                    payment_number = $1,
                    purchase_id = $2,
                    supplier_id = $3,
                    payment_date = COALESCE($4::DATE, CURRENT_DATE),
                    amount = $5,
                    payment_method = $6,
                    reference_number = $7,
                    notes = $8
                WHERE payment_id = $9
                RETURNING *
            `,
            [
                finalPaymentNumber,
                newPurchaseId,
                newPurchase.supplier_id,
                paymentDate || null,
                paymentAmount,
                paymentMethod || "CASH",
                referenceNumber || null,
                notes || null,
                paymentId,
            ]
        );

        if (samePurchase) {
            // Recalculate using the original paid amount, replacing
            // the old payment amount with the edited amount.
            const updatedPaidAmount =
                Number(oldPurchase.paid_amount || 0) -
                oldAmount +
                paymentAmount;

            const totalAmount = Number(oldPurchase.total_amount);
            const updatedBalance = Math.max(
                totalAmount - updatedPaidAmount,
                0
            );

            await client.query(
                `
                    UPDATE purchases
                    SET
                        paid_amount = $1,
                        balance_amount = $2,
                        status = $3,
                        updated_at = CURRENT_TIMESTAMP
                    WHERE purchase_id = $4
                `,
                [
                    updatedPaidAmount,
                    updatedBalance,
                    getPurchaseStatus(
                        updatedPaidAmount,
                        totalAmount
                    ),
                    oldPurchaseId,
                ]
            );
        } else {
            // Remove the old payment amount from the original purchase.
            const oldPaidAmount = Math.max(
                Number(oldPurchase.paid_amount || 0) - oldAmount,
                0
            );

            const oldTotal = Number(oldPurchase.total_amount);
            const oldBalance = Math.max(
                oldTotal - oldPaidAmount,
                0
            );

            await client.query(
                `
                    UPDATE purchases
                    SET
                        paid_amount = $1,
                        balance_amount = $2,
                        status = $3,
                        updated_at = CURRENT_TIMESTAMP
                    WHERE purchase_id = $4
                `,
                [
                    oldPaidAmount,
                    oldBalance,
                    getPurchaseStatus(oldPaidAmount, oldTotal),
                    oldPurchaseId,
                ]
            );

            // Apply the edited payment to the newly selected purchase.
            const newPaidAmount =
                Number(newPurchase.paid_amount || 0) +
                paymentAmount;

            const newTotal = Number(newPurchase.total_amount);
            const newBalance = Math.max(
                newTotal - newPaidAmount,
                0
            );

            await client.query(
                `
                    UPDATE purchases
                    SET
                        paid_amount = $1,
                        balance_amount = $2,
                        status = $3,
                        updated_at = CURRENT_TIMESTAMP
                    WHERE purchase_id = $4
                `,
                [
                    newPaidAmount,
                    newBalance,
                    getPurchaseStatus(newPaidAmount, newTotal),
                    newPurchaseId,
                ]
            );
        }

        await client.query("COMMIT");

        return NextResponse.json({
            success: true,
            message: "Purchase payment updated successfully.",
            payment: updatedPaymentResult.rows[0],
        });
    } catch (error) {
        if (client) {
            await client.query("ROLLBACK").catch(() => {});
        }

        console.error("PURCHASE PAYMENT PUT ERROR:", error);

        if (error.code === "23505") {
            return errorResponse(
                "Payment number already exists.",
                409
            );
        }

        return errorResponse(
            error.message || "Failed to update purchase payment.",
            500
        );
    } finally {
        client?.release();
    }
}
