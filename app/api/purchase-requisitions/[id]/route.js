
import { NextResponse } from "next/server";
import { getTenantDb } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { requirePermission } from "@/lib/permissions";
import { archiveAndSoftDelete } from "@/lib/recycle-bin";

export const dynamic = "force-dynamic";

const ALLOWED_STATUSES = [
    "DRAFT",
    "SUBMITTED",
    "APPROVED",
    "REJECTED",
];

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

function normalizeDate(value) {
    const dateString = String(value || "").trim().slice(0, 10);

    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateString)) {
        throw validationError("Please provide a valid transaction date.");
    }

    const [year, month, day] = dateString.split("-").map(Number);
    const parsed = new Date(Date.UTC(year, month - 1, day));

    if (
        parsed.getUTCFullYear() !== year ||
        parsed.getUTCMonth() !== month - 1 ||
        parsed.getUTCDate() !== day
    ) {
        throw validationError("Please provide a valid transaction date.");
    }

    return dateString;
}

/* -------------------------------------------------------------------------- */
/* PUT: Update purchase requisition                                            */
/* -------------------------------------------------------------------------- */

export async function PUT(request, { params }) {
    let client;
    let transactionStarted = false;

    try {
        const user = await getCurrentUser();
        await requirePermission(user, "purchase_requisitions", "update");

        if (!user?.companyId) {
            throw validationError("Company information is missing.");
        }

        const { id } = await params;
        const requisitionId = Number(id);

        if (!Number.isSafeInteger(requisitionId) || requisitionId <= 0) {
            throw validationError("Invalid requisition ID.");
        }

        const body = await request.json();

        const rawDate =
            body.transactionDate ??
            body.transaction_date;

        const transactionDate = normalizeDate(rawDate);

        const selectedWarehouse = Number(
            body.warehouseId ??
            body.warehouse_id ??
            body.locationId ??
            body.location_id
        );

        const status = String(body.status || "DRAFT").trim().toUpperCase();

        const selectedDepartment =
            body.department ?? body.departmentName ?? null;

        const selectedClass =
            body.className ?? body.class_name ?? body.class ?? null;

        const project = body.project ?? null;
        const memo = body.memo ?? null;

        const selectedReference =
            body.referenceNumber ??
            body.reference_number ??
            body.reference ??
            null;

        const items = body.items;

        if (
            !Number.isSafeInteger(selectedWarehouse) ||
            selectedWarehouse <= 0 ||
            !ALLOWED_STATUSES.includes(status)
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
            const productId = Number(
                item.productId ?? item.product_id
            );

            const quantity = Number(item.quantity);
            const itemBalance = Number(
                item.itemBalance ?? item.item_balance ?? 0
            );

            if (
                !Number.isSafeInteger(productId) ||
                productId <= 0 ||
                !Number.isFinite(quantity) ||
                quantity <= 0 ||
                !Number.isFinite(itemBalance) ||
                itemBalance < 0
            ) {
                throw validationError(
                    "Every line needs a valid product, non-negative item balance, and quantity greater than zero."
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
                itemBalance,
                uom: String(item.uom || "").trim(),
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

        const db = await getTenantDb(user);
        client = await db.connect();

        await client.query("BEGIN");
        transactionStarted = true;

        /* Lock only an active requisition belonging to this company. */
        const existingResult = await client.query(
            `
            SELECT requisition_id, status
            FROM purchase_requisitions
            WHERE requisition_id = $1
              AND company_id = $2
              AND deleted_at IS NULL
            FOR UPDATE
            `,
            [requisitionId, user.companyId]
        );

        if (!existingResult.rows.length) {
            throw validationError("Purchase requisition not found.", 404);
        }

        /* Validate active warehouse. */
        const warehouseResult = await client.query(
            `
            SELECT warehouse_id
            FROM warehouses
            WHERE warehouse_id = $1
              AND is_active = TRUE
              AND deleted_at IS NULL
            `,
            [selectedWarehouse]
        );

        if (!warehouseResult.rows.length) {
            throw validationError("Selected location is unavailable.");
        }

        /* Lock existing requisition lines. */
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
            existingItems.map((item) =>
                Number(item.requisition_item_id)
            )
        );

        /* Reject item IDs belonging to another requisition. */
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

        const removedItems = existingItems.filter(
            (item) =>
                !submittedIdSet.has(Number(item.requisition_item_id))
        );

        const removedIds = removedItems.map(
            (item) => Number(item.requisition_item_id)
        );

        /*
         * A line already referenced by an RFQ cannot be removed.
         * Its original requisition_item_id must be preserved.
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
                    .map((row) =>
                        `item ${row.source_requisition_item_id} (${row.rfq_number || `RFQ ${row.rfq_id}`})`
                    )
                    .join(", ");

                throw validationError(
                    `You cannot remove requisition lines already used in an RFQ: ${references}. Keep those lines to preserve procurement history.`
                );
            }
        }

        /* Validate active products. */
        const productIds = [
            ...new Set(normalizedItems.map((item) => item.productId)),
        ];

        const productsResult = await client.query(
            `
            SELECT product_id, product_name, unit
            FROM products
            WHERE product_id = ANY($1::INTEGER[])
              AND is_active = TRUE
              AND deleted_at IS NULL
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
                    `Product ${item.productId} is invalid, inactive, or archived.`
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
              AND deleted_at IS NULL
            `,
            [
                transactionDate,
                status,
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

        /* Update existing lines and insert new lines. */
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

        /* Delete only removed, unreferenced lines. */
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
/* DELETE: Archive requisition while preserving its child records              */
/* -------------------------------------------------------------------------- */

export async function DELETE(request, { params }) {
    try {
        const user = await getCurrentUser();
        await requirePermission(user, "purchase_requisitions", "delete");

        if (!user?.companyId) {
            throw validationError("Company information is missing.");
        }

        const { id } = await params;
        const requisitionId = Number(id);

        if (!Number.isSafeInteger(requisitionId) || requisitionId <= 0) {
            throw validationError("Invalid requisition ID.");
        }

        const db = await getTenantDb(user);

        const result = await archiveAndSoftDelete(
            {
                db,
                companyId: user.companyId,
                user,
            },
            {
                moduleKey: "purchase_requisitions",
                recordId: requisitionId,

                validateRecord: async (client, record) => {
                    /*
                     * Check both requisition-level RFQ references and
                     * item-level RFQ references. Do not remove or alter
                     * either relationship.
                     */
                    const linkedResult = await client.query(
                        `
                        SELECT
                            COUNT(DISTINCT ri.rfq_id)::INTEGER
                                AS linked_rfqs,
                            ARRAY_AGG(DISTINCT rfq.transaction_number)
                                FILTER (
                                    WHERE rfq.transaction_number IS NOT NULL
                                ) AS rfq_numbers
                        FROM rfq_items ri
                        INNER JOIN rfqs rfq
                            ON rfq.rfq_id = ri.rfq_id
                        WHERE
                            ri.source_requisition_id = $1
                            OR ri.source_requisition_item_id IN (
                                SELECT requisition_item_id
                                FROM purchase_requisition_items
                                WHERE requisition_id = $1
                            )
                        `,
                        [record.requisition_id]
                    );

                    const linked = linkedResult.rows[0] || {};
                    const linkedCount = Number(linked.linked_rfqs || 0);

                    if (linkedCount > 0) {
                        const rfqNumbers =
                            (linked.rfq_numbers || []).join(", ");

                        return {
                            status: 409,
                            message:
                                `This Purchase Requisition cannot be archived because it is linked to ${linkedCount} RFQ(s): ${rfqNumbers || "RFQ records"}. Preserve the requisition to maintain procurement history.`,
                        };
                    }

                    return null;
                },
            }
        );

        if (!result.success) {
            return NextResponse.json(
                {
                    success: false,
                    message: result.message,
                },
                { status: result.status || 400 }
            );
        }

        return NextResponse.json({
            success: true,
            message: "Purchase requisition moved to the Recycle Bin.",
            archiveId: result.archiveId,
            requisition: result.record,
        });
    } catch (error) {
        return apiError(error);
    }
}
