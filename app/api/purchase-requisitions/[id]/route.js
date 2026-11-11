
import { NextResponse } from "next/server";
import pool from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { requirePermission } from "@/lib/permissions";

export const dynamic = "force-dynamic";

function apiError(error) {
    console.error("Purchase requisition API:", error);

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

    const status =
        error.status ||
        (error.code === "23505" ? 409 :
         error.code === "23503" ? 400 :
         error.code === "23514" ? 400 : 500);

    return NextResponse.json(
        {
            success: false,
            message: error.message || "Purchase requisition operation failed.",
        },
        { status }
    );
}

function validationError(message, status = 400) {
    const error = new Error(message);
    error.status = status;
    return error;
}

function normalizeItemId(item) {
    const value =
        item.requisitionItemId ??
        item.requisition_item_id ??
        item.requisitionItemID ??
        item.id ??
        null;

    if (value === null || value === "") return null;

    const id = Number(value);

    if (!Number.isSafeInteger(id) || id <= 0) {
        throw validationError("Invalid requisition item ID.");
    }

    return id;
}

function validateDate(value) {
    const dateString = String(value || "").slice(0, 10);

    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateString)) {
        return false;
    }

    const date = new Date(`${dateString}T00:00:00`);

    return (
        !Number.isNaN(date.getTime()) &&
        date.toISOString().slice(0, 10) === dateString
    );
}

/* -------------------------------------------------------------------------- */
/* PUT: Update purchase requisition while preserving RFQ-linked item IDs       */
/* -------------------------------------------------------------------------- */

export async function PUT(request, { params }) {
    let client;
    let transactionStarted = false;

    try {
        const user = await getCurrentUser();
        await requirePermission(user, "purchase_requisitions", "update");

        if (!user.companyId) {
            throw validationError("Company information is missing.");
        }

        const { id } = await params;
        const requisitionId = Number(id);

        if (!Number.isSafeInteger(requisitionId) || requisitionId <= 0) {
            throw validationError("Invalid requisition ID.");
        }

        const body = await request.json();

const {
    transactionDate,
    transaction_date,
} = body;

// Accept both camelCase and snake_case
const rawTransactionDate = transactionDate ?? transaction_date;

const normalizedTransactionDate = rawTransactionDate
    ? String(rawTransactionDate).trim().slice(0, 10)
    : "";

const isValidDate = /^\d{4}-\d{2}-\d{2}$/.test(
    normalizedTransactionDate
);

if (!isValidDate) {
    throw validationError("Please provide a valid transaction date.");
}

const [year, month, day] = normalizedTransactionDate
    .split("-")
    .map(Number);

const parsedDate = new Date(Date.UTC(year, month - 1, day));

if (
    parsedDate.getUTCFullYear() !== year ||
    parsedDate.getUTCMonth() !== month - 1 ||
    parsedDate.getUTCDate() !== day
) {
    throw validationError("Please provide a valid transaction date.");
}
        if (
            !selectedWarehouse ||
            !Number.isSafeInteger(Number(selectedWarehouse)) ||
            !allowedStatuses.includes(String(status || "").toUpperCase())
        ) {
            throw validationError(
                "Date, location, and a valid status are required."
            );
        }

        if (!Array.isArray(items) || items.length === 0) {
            throw validationError(
                "At least one requisition line is required."
            );
        }

        const normalizedItems = items.map((item) => {
            const productId = Number(item.productId ?? item.product_id);
            const quantity = Number(item.quantity);

            if (
                !Number.isSafeInteger(productId) ||
                productId <= 0 ||
                !Number.isFinite(quantity) ||
                quantity <= 0
            ) {
                throw validationError(
                    "Every line needs a valid product and a quantity greater than zero."
                );
            }

            return {
                requisitionItemId: normalizeItemId(item),
                productId,
                description: String(
                    item.description ??
                    item.item_description ??
                    ""
                ).trim(),
                itemBalance: Number(
                    item.itemBalance ?? item.item_balance ?? 0
                ) || 0,
                uom: String(
                    item.uom || ""
                ).trim(),
                quantity,
                memo: String(item.memo || "").trim(),
            };
        });

        const submittedIds = normalizedItems
            .map((item) => item.requisitionItemId)
            .filter(Boolean);

        if (new Set(submittedIds).size !== submittedIds.length) {
            throw validationError(
                "The same requisition item has been submitted more than once."
            );
        }

        client = await pool.connect();

        await client.query("BEGIN");
        transactionStarted = true;

        /* Lock the requisition header. */
        const existingResult = await client.query(
            `
            SELECT requisition_id, status
            FROM purchase_requisitions
            WHERE requisition_id = $1
              AND company_id = $2
            FOR UPDATE
            `,
            [requisitionId, user.companyId]
        );

        if (!existingResult.rows.length) {
            throw validationError("Requisition not found.", 404);
        }

        /* Validate warehouse. */
        const warehouseResult = await client.query(
            `
            SELECT warehouse_id
            FROM warehouses
            WHERE warehouse_id = $1
              AND is_active = TRUE
            `,
            [selectedWarehouse]
        );

        if (!warehouseResult.rows.length) {
            throw validationError(
                "Selected location is unavailable."
            );
        }

        /* Lock all existing lines belonging to this requisition. */
        const existingItemsResult = await client.query(
            `
            SELECT
                requisition_item_id,
                requisition_id,
                product_id
            FROM purchase_requisition_items
            WHERE requisition_id = $1
            ORDER BY requisition_item_id
            FOR UPDATE
            `,
            [requisitionId]
        );

        const existingItems = existingItemsResult.rows;
        const existingIdSet = new Set(
            existingItems.map((item) => Number(item.requisition_item_id))
        );

        /* Prevent IDs from another requisition being updated. */
        for (const item of normalizedItems) {
            if (
                item.requisitionItemId &&
                !existingIdSet.has(item.requisitionItemId)
            ) {
                throw validationError(
                    `Requisition item ${item.requisitionItemId} does not belong to this requisition.`
                );
            }
        }

        const submittedIdSet = new Set(submittedIds);

        /* Determine which old items are being removed. */
        const removedItems = existingItems.filter(
            (item) =>
                !submittedIdSet.has(Number(item.requisition_item_id))
        );

        const removedIds = removedItems.map(
            (item) => Number(item.requisition_item_id)
        );

        /*
         * A requisition line referenced by an RFQ cannot be removed.
         * It can still be updated while preserving its original ID.
         */
        if (removedIds.length) {
            const linkedResult = await client.query(
                `
                SELECT
                    ri.source_requisition_item_id,
                    ri.rfq_id,
                    rfq.transaction_number AS rfq_number
                FROM rfq_items ri
                INNER JOIN rfqs rfq
                    ON rfq.rfq_id = ri.rfq_id
                WHERE ri.source_requisition_item_id =
                    ANY($1::INTEGER[])
                `,
                [removedIds]
            );

            if (linkedResult.rows.length) {
                const references = linkedResult.rows
                    .map(
                        (row) =>
                            `item ${row.source_requisition_item_id} (${row.rfq_number})`
                    )
                    .join(", ");

                throw validationError(
                    `You cannot remove requisition lines already used in an RFQ: ${references}. Keep those lines in the requisition to preserve procurement history.`
                );
            }
        }

        /* Validate all products before modifying the lines. */
        const productIds = [
            ...new Set(normalizedItems.map((item) => item.productId)),
        ];

        const productsResult = await client.query(
            `
            SELECT product_id, product_name, unit
            FROM products
            WHERE product_id = ANY($1::INTEGER[])
              AND is_active = TRUE
            `,
            [productIds]
        );

        const productsById = new Map(
            productsResult.rows.map((product) => [
                Number(product.product_id),
                product,
            ])
        );

        for (const item of normalizedItems) {
            if (!productsById.has(item.productId)) {
                throw validationError(
                    `Product ${item.productId} is invalid or inactive.`
                );
            }
        }

        /* Update requisition header. */
        await client.query(
            `
            UPDATE purchase_requisitions
            SET
                transaction_date = $1,
                status = $2,
                warehouse_id = $3,
                department = $4,
                class_name = $5,
                project = $6,
                memo = $7,
                reference_number = $8,
                updated_by = $9,
                updated_at = NOW()
            WHERE requisition_id = $10
              AND company_id = $11
            `,
            [
                String(date).slice(0, 10),
                String(status).toUpperCase(),
                selectedWarehouse,
                selectedDepartment || null,
                selectedClass || null,
                project || null,
                memo || null,
                selectedReference || null,
                user.userId,
                requisitionId,
                user.companyId,
            ]
        );

        /* Update existing lines; insert new lines. */
        for (const item of normalizedItems) {
            const product = productsById.get(item.productId);

            const description =
                item.description || product.product_name;

            const uom = item.uom || product.unit || "PCS";

            if (item.requisitionItemId) {
                await client.query(
                    `
                    UPDATE purchase_requisition_items
                    SET
                        product_id = $1,
                        item_description = $2,
                        item_balance = $3,
                        uom = $4,
                        quantity = $5,
                        memo = $6
                    WHERE requisition_item_id = $7
                      AND requisition_id = $8
                    `,
                    [
                        item.productId,
                        description,
                        item.itemBalance,
                        uom,
                        item.quantity,
                        item.memo || null,
                        item.requisitionItemId,
                        requisitionId,
                    ]
                );
            } else {
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
                        requisitionId,
                        item.productId,
                        description,
                        item.itemBalance,
                        uom,
                        item.quantity,
                        item.memo || null,
                    ]
                );
            }
        }

        /* Delete only removed, unreferenced items. */
        if (removedIds.length) {
            await client.query(
                `
                DELETE FROM purchase_requisition_items
                WHERE requisition_id = $1
                  AND requisition_item_id = ANY($2::INTEGER[])
                `,
                [requisitionId, removedIds]
            );
        }

        await client.query("COMMIT");
        transactionStarted = false;

        return NextResponse.json({
            success: true,
            message: "Purchase requisition updated successfully.",
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
/* DELETE: Prevent deletion when the requisition is used by an RFQ             */
/* -------------------------------------------------------------------------- */

export async function DELETE(request, { params }) {
    let client;
    let transactionStarted = false;

    try {
        const user = await getCurrentUser();
        await requirePermission(user, "purchase_requisitions", "delete");

        if (!user.companyId) {
            throw validationError("Company information is missing.");
        }

        const { id } = await params;
        const requisitionId = Number(id);

        if (!Number.isSafeInteger(requisitionId) || requisitionId <= 0) {
            throw validationError("Invalid requisition ID.");
        }

        client = await pool.connect();

        await client.query("BEGIN");
        transactionStarted = true;

        const existingResult = await client.query(
            `
            SELECT requisition_id, transaction_number
            FROM purchase_requisitions
            WHERE requisition_id = $1
              AND company_id = $2
            FOR UPDATE
            `,
            [requisitionId, user.companyId]
        );

        if (!existingResult.rows.length) {
            throw validationError("Requisition not found.", 404);
        }

        const linkedResult = await client.query(
            `
            SELECT
                COUNT(*)::INTEGER AS linked_items,
                COUNT(DISTINCT ri.rfq_id)::INTEGER AS linked_rfqs,
                ARRAY_AGG(DISTINCT rfq.transaction_number)
                    FILTER (WHERE rfq.transaction_number IS NOT NULL)
                    AS rfq_numbers
            FROM rfq_items ri
            INNER JOIN rfqs rfq
                ON rfq.rfq_id = ri.rfq_id
            WHERE ri.source_requisition_id = $1
            `,
            [requisitionId]
        );

        const linked = linkedResult.rows[0];

        if (Number(linked.linked_items) > 0) {
            const rfqNumbers = (linked.rfq_numbers || []).join(", ");

            throw validationError(
                `This Purchase Requisition cannot be deleted because it is linked to ${linked.linked_rfqs} RFQ(s): ${rfqNumbers}. Preserve the requisition to maintain procurement history.`
            );
        }

        /*
         * No RFQ references exist, so delete its lines and then its header.
         */
        await client.query(
            `
            DELETE FROM purchase_requisition_items
            WHERE requisition_id = $1
            `,
            [requisitionId]
        );

        await client.query(
            `
            DELETE FROM purchase_requisitions
            WHERE requisition_id = $1
              AND company_id = $2
            `,
            [requisitionId, user.companyId]
        );

        await client.query("COMMIT");
        transactionStarted = false;

        return NextResponse.json({
            success: true,
            message: "Purchase requisition deleted successfully.",
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
