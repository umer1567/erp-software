
import { NextResponse } from "next/server";
import pool from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { requirePermission } from "@/lib/permissions";

/* -------------------------------------------------------------------------- */
/* Constants                                                                  */
/* -------------------------------------------------------------------------- */

const ALLOWED_STATUSES = [
    "DRAFT",
    "PENDING",
    "APPROVED",
    "REJECTED",
    "CLOSED",
    "CANCELLED",
];

/* -------------------------------------------------------------------------- */
/* Helpers                                                                    */
/* -------------------------------------------------------------------------- */

function apiError(error) {
    console.error("Purchase Order Detail API Error:", error);

    const status =
        Number(error?.status || error?.statusCode) >= 400 &&
            Number(error?.status || error?.statusCode) < 600
            ? Number(error.status || error.statusCode)
            : 500;

    return NextResponse.json(
        {
            success: false,
            message:
                error?.message ||
                "An unexpected error occurred.",
        },
        { status }
    );
}

function validationError(message, status = 400) {
    const error = new Error(message);
    error.status = status;
    return error;
}

function positiveId(value, fieldName) {
    const id = Number(value);

    if (!Number.isInteger(id) || id <= 0) {
        throw validationError(`Invalid ${fieldName}.`);
    }

    return id;
}

function decimal(value, fieldName, options = {}) {
    const {
        allowZero = true,
        defaultValue = null,
    } = options;

    if (
        value === undefined ||
        value === null ||
        value === ""
    ) {
        if (defaultValue !== null) {
            return defaultValue;
        }

        throw validationError(`${fieldName} is required.`);
    }

    const number = Number(value);

    if (!Number.isFinite(number)) {
        throw validationError(`${fieldName} must be a valid number.`);
    }

    if (allowZero ? number < 0 : number <= 0) {
        throw validationError(
            allowZero
                ? `${fieldName} cannot be negative.`
                : `${fieldName} must be greater than zero.`
        );
    }

    return number;
}

function validDate(value, fieldName, required = false) {
    if (!value) {
        if (required) {
            throw validationError(`${fieldName} is required.`);
        }

        return null;
    }

    const date = String(value).slice(0, 10);

    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        throw validationError(
            `${fieldName} must use YYYY-MM-DD format.`
        );
    }

    const parsed = new Date(`${date}T00:00:00.000Z`);

    if (
        Number.isNaN(parsed.getTime()) ||
        parsed.toISOString().slice(0, 10) !== date
    ) {
        throw validationError(`${fieldName} is not a valid date.`);
    }

    return date;
}

function validStatus(value, defaultValue = "DRAFT") {
    const status = String(value || defaultValue)
        .trim()
        .toUpperCase();

    if (!ALLOWED_STATUSES.includes(status)) {
        throw validationError(
            `Invalid purchase order status: ${status}.`
        );
    }

    return status;
}

function roundMoney(value) {
    return Math.round(
        (Number(value) + Number.EPSILON) * 100
    ) / 100;
}

/* -------------------------------------------------------------------------- */
/* Prepare Items                                                              */
/* -------------------------------------------------------------------------- */

function prepareItems(items) {
    if (!Array.isArray(items) || items.length === 0) {
        throw validationError(
            "At least one purchase order item is required."
        );
    }

    if (items.length > 500) {
        throw validationError(
            "A maximum of 500 items is allowed."
        );
    }

    return items.map((item, index) => {
        const itemNumber = index + 1;

        const productId =
            item.productId === null ||
                item.productId === undefined ||
                item.productId === ""
                ? null
                : positiveId(
                    item.productId,
                    `Product ID on item ${itemNumber}`
                );

        const itemDescription = String(
            item.itemDescription || ""
        ).trim();

        if (!itemDescription) {
            throw validationError(
                `Item description is required on item ${itemNumber}.`
            );
        }

        const quantity = decimal(
            item.quantity,
            `Quantity on item ${itemNumber}`,
            { allowZero: false }
        );

        const unitPrice = decimal(
            item.unitPrice,
            `Unit price on item ${itemNumber}`
        );

        const discountAmount = roundMoney(
            decimal(
                item.discountAmount,
                `Discount on item ${itemNumber}`,
                { defaultValue: 0 }
            )
        );

        const baseAmount = roundMoney(
            quantity * unitPrice
        );

        if (discountAmount > baseAmount) {
            throw validationError(
                `Discount cannot exceed the amount on item ${itemNumber}.`
            );
        }

        const taxRate = decimal(
            item.taxRate,
            `Tax rate on item ${itemNumber}`,
            { defaultValue: 0 }
        );

        const taxableAmount = roundMoney(
            baseAmount - discountAmount
        );

        const taxAmount =
            item.taxAmount !== undefined &&
                item.taxAmount !== null &&
                item.taxAmount !== ""
                ? roundMoney(
                    decimal(
                        item.taxAmount,
                        `Tax amount on item ${itemNumber}`
                    )
                )
                : roundMoney(
                    taxableAmount * taxRate / 100
                );

        const lineTotal = roundMoney(
            taxableAmount + taxAmount
        );

        return {
            productId,
            itemDescription,
            uom: item.uom
                ? String(item.uom).trim()
                : null,
            quantity,
            unitPrice,
            discountAmount,
            taxRate,
            taxAmount,
            lineTotal,
            remarks: item.remarks
                ? String(item.remarks).trim()
                : null,
        };
    });
}

/* -------------------------------------------------------------------------- */
/* Calculate Header Totals                                                    */
/* -------------------------------------------------------------------------- */

function calculateTotals(items) {
    const subtotal = roundMoney(
        items.reduce(
            (total, item) =>
                total + item.quantity * item.unitPrice,
            0
        )
    );

    const discountAmount = roundMoney(
        items.reduce(
            (total, item) =>
                total + item.discountAmount,
            0
        )
    );

    const taxAmount = roundMoney(
        items.reduce(
            (total, item) =>
                total + item.taxAmount,
            0
        )
    );

    const grandTotal = roundMoney(
        subtotal - discountAmount + taxAmount
    );

    return {
        subtotal,
        discountAmount,
        taxAmount,
        grandTotal,
    };
}

/* -------------------------------------------------------------------------- */
/* Load Purchase Order                                                        */
/* -------------------------------------------------------------------------- */

async function getPurchaseOrder(client, id, companyId) {
    const headerResult = await client.query(
        `
        SELECT
            po.*,

            s.supplier_name,
            s.supplier_code,
            s.phone AS supplier_phone,
            s.email AS supplier_email,
            s.address AS supplier_address,

            pq.quotation_number,

            c.company_name

        FROM purchase_orders po

        INNER JOIN suppliers s
            ON s.supplier_id = po.supplier_id

        LEFT JOIN purchase_quotations pq
            ON pq.purchase_quotation_id =
               po.purchase_quotation_id

        LEFT JOIN companies c
            ON c.company_id = po.company_id

        WHERE
            po.purchase_order_id = $1
            AND po.company_id = $2

        LIMIT 1
        `,
        [id, companyId]
    );

    if (!headerResult.rowCount) {
        return null;
    }

        const itemsResult = await client.query(
        `
        SELECT
            i.*,

            p.sku,
            p.barcode,
            p.product_name,

            received.previously_received_quantity,

            GREATEST(
                i.quantity - received.previously_received_quantity,
                0
            ) AS remaining_quantity

        FROM purchase_order_items i

        LEFT JOIN products p
            ON p.product_id = i.product_id

        LEFT JOIN LATERAL (
            SELECT
                COALESCE(
                    SUM(iri.quantity_received),
                    0
                ) AS previously_received_quantity

            FROM item_receipt_items iri

            INNER JOIN item_receipts ir
                ON ir.item_receipt_id = iri.item_receipt_id

            WHERE
                iri.purchase_order_item_id =
                    i.purchase_order_item_id

                AND ir.company_id = $2
                AND ir.status = 'APPROVED'

        ) received ON TRUE

        WHERE
            i.purchase_order_id = $1

        ORDER BY
            i.purchase_order_item_id ASC
        `,
        [id, companyId]
    );

    return {
        ...headerResult.rows[0],
        items: itemsResult.rows,
    };
}

/* -------------------------------------------------------------------------- */
/* GET: View Purchase Order                                                   */
/* -------------------------------------------------------------------------- */

export async function GET(request, context) {
    try {
        const user = await getCurrentUser();

        await requirePermission(
            user,
            "purchase_orders",
            "view"
        );

        if (!user.companyId) {
            throw validationError(
                "Company information is missing."
            );
        }

        const companyId = positiveId(
            user.companyId,
            "company"
        );

        const params = await context.params;

        const id = positiveId(
            params.id,
            "purchase order ID"
        );

        const purchaseOrder = await getPurchaseOrder(
            pool,
            id,
            companyId
        );

        if (!purchaseOrder) {
            return NextResponse.json(
                {
                    success: false,
                    message: "Purchase Order not found.",
                },
                { status: 404 }
            );
        }

        return NextResponse.json({
            success: true,
            purchaseOrder,
        });
    } catch (error) {
        return apiError(error);
    }
}

/* -------------------------------------------------------------------------- */
/* PATCH: Update DRAFT Purchase Order                                         */
/* -------------------------------------------------------------------------- */

export async function PATCH(request, context) {
    let client;
    let transactionStarted = false;

    try {
        const user = await getCurrentUser();

        await requirePermission(
            user,
            "purchase_orders",
            "update"
        );

        if (!user.companyId || !user.userId) {
            throw validationError(
                "User or company information is missing."
            );
        }

        const companyId = positiveId(
            user.companyId,
            "company"
        );

        const userId = positiveId(
            user.userId,
            "user"
        );

        const params = await context.params;

        const id = positiveId(
            params.id,
            "purchase order ID"
        );

        let body;

        try {
            body = await request.json();
        } catch {
            throw validationError(
                "Invalid request body. Please send valid JSON."
            );
        }

        if (
            !body ||
            typeof body !== "object" ||
            Array.isArray(body)
        ) {
            throw validationError("Invalid request body.");
        }

        client = await pool.connect();

        await client.query("BEGIN");
        transactionStarted = true;

        /* -------------------------------------------------------------- */
        /* Lock Existing Purchase Order                                   */
        /* -------------------------------------------------------------- */

        const currentResult = await client.query(
            `
            SELECT *
            FROM purchase_orders

            WHERE
                purchase_order_id = $1
                AND company_id = $2

            FOR UPDATE
            `,
            [id, companyId]
        );

        if (!currentResult.rowCount) {
            throw validationError(
                "Purchase Order not found.",
                404
            );
        }

        const current = currentResult.rows[0];

        if (current.status !== "DRAFT") {
            throw validationError(
                "Only DRAFT Purchase Orders can be edited."
            );
        }

        /* -------------------------------------------------------------- */
        /* Supplier                                                        */
        /* -------------------------------------------------------------- */

        const supplierId = positiveId(
            body.supplierId ?? current.supplier_id,
            "supplier"
        );

        const supplierResult = await client.query(
            `
            SELECT supplier_id
            FROM suppliers

            WHERE
                supplier_id = $1
                AND COALESCE(is_active, TRUE) = TRUE

            LIMIT 1
            `,
            [supplierId]
        );

        if (!supplierResult.rowCount) {
            throw validationError(
                "Selected supplier does not exist or is inactive."
            );
        }

        /* -------------------------------------------------------------- */
        /* Dates                                                           */
        /* -------------------------------------------------------------- */

        const orderDate = validDate(
            body.orderDate !== undefined
                ? body.orderDate
                : current.order_date,
            "Order date",
            true
        );

        const expectedDeliveryDate = validDate(
            body.expectedDeliveryDate !== undefined
                ? body.expectedDeliveryDate
                : current.expected_delivery_date,
            "Expected delivery date"
        );

        // if (
        //     expectedDeliveryDate &&
        //     expectedDeliveryDate < orderDate
        // ) {
        //     throw validationError(
        //         "Expected delivery date cannot be earlier than the order date."
        //     );
        // }

        /* -------------------------------------------------------------- */
        /* Status and Currency                                             */
        /* -------------------------------------------------------------- */

        const status = validStatus(
            body.status !== undefined
                ? body.status
                : current.status
        );

        const currencyCode = String(
            body.currencyCode !== undefined
                ? body.currencyCode
                : current.currency_code
        )
            .trim()
            .toUpperCase();

        if (!currencyCode || currencyCode.length > 10) {
            throw validationError("Invalid currency code.");
        }

        const exchangeRate = decimal(
            body.exchangeRate !== undefined
                ? body.exchangeRate
                : current.exchange_rate,
            "Exchange rate",
            { allowZero: false }
        );

        /* -------------------------------------------------------------- */
        /* Items and Totals                                                */
        /* -------------------------------------------------------------- */

        const items = prepareItems(body.items);

        for (const item of items) {
            if (item.productId) {
                const productResult = await client.query(
                    `
                    SELECT product_id
                    FROM products
                    WHERE product_id = $1
                    LIMIT 1
                    `,
                    [item.productId]
                );

                if (!productResult.rowCount) {
                    throw validationError(
                        `Product ID ${item.productId} does not exist.`
                    );
                }
            }
        }

        const totals = calculateTotals(items);

        const termsConditions =
            body.termsConditions !== undefined
                ? body.termsConditions
                    ? String(body.termsConditions).trim()
                    : null
                : current.terms_conditions;

        const remarks =
            body.remarks !== undefined
                ? body.remarks
                    ? String(body.remarks).trim()
                    : null
                : current.remarks;

        /* -------------------------------------------------------------- */
        /* Update Header                                                   */
        /* -------------------------------------------------------------- */

        await client.query(
            `
            UPDATE purchase_orders

            SET
                supplier_id = $1,
                order_date = $2,
                expected_delivery_date = $3,
                status = $4,
                currency_code = $5,
                exchange_rate = $6,

                subtotal = $7,
                discount_amount = $8,
                tax_amount = $9,
                grand_total = $10,

                terms_conditions = $11,
                remarks = $12,

                updated_by = $13,
                updated_at = NOW()

            WHERE
                purchase_order_id = $14
                AND company_id = $15
            `,
            [
                supplierId,
                orderDate,
                expectedDeliveryDate,
                status,
                currencyCode,
                exchangeRate,
                totals.subtotal,
                totals.discountAmount,
                totals.taxAmount,
                totals.grandTotal,
                termsConditions,
                remarks,
                userId,
                id,
                companyId,
            ]
        );

        /* -------------------------------------------------------------- */
        /* Replace Existing Items                                          */
        /* -------------------------------------------------------------- */

        await client.query(
            `
            DELETE FROM purchase_order_items
            WHERE purchase_order_id = $1
            `,
            [id]
        );

        for (const item of items) {
            await client.query(
                `
                INSERT INTO purchase_order_items (
                    purchase_order_id,
                    product_id,
                    item_description,
                    uom,
                    quantity,
                    unit_price,
                    discount_amount,
                    tax_rate,
                    tax_amount,
                    line_total,
                    remarks
                )
                VALUES (
                    $1, $2, $3, $4, $5, $6,
                    $7, $8, $9, $10, $11
                )
                `,
                [
                    id,
                    item.productId,
                    item.itemDescription,
                    item.uom,
                    item.quantity,
                    item.unitPrice,
                    item.discountAmount,
                    item.taxRate,
                    item.taxAmount,
                    item.lineTotal,
                    item.remarks,
                ]
            );
        }

        /* -------------------------------------------------------------- */
        /* Commit                                                          */
        /* -------------------------------------------------------------- */

        await client.query("COMMIT");
        transactionStarted = false;

        const updatedOrder = await getPurchaseOrder(
            pool,
            id,
            companyId
        );

        return NextResponse.json({
            success: true,
            message: "Purchase Order updated successfully.",
            purchaseOrder: updatedOrder,
        });
    } catch (error) {
        if (client && transactionStarted) {
            try {
                await client.query("ROLLBACK");
            } catch (rollbackError) {
                console.error(
                    "Purchase Order update rollback error:",
                    rollbackError
                );
            }
        }

        return apiError(error);
    } finally {
        if (client) {
            client.release();
        }
    }
}

/* -------------------------------------------------------------------------- */
/* DELETE: Delete DRAFT Purchase Order                                        */
/* -------------------------------------------------------------------------- */

export async function DELETE(request, context) {
    let client;
    let transactionStarted = false;

    try {
        const user = await getCurrentUser();

        await requirePermission(
            user,
            "purchase_orders",
            "delete"
        );

        if (!user.companyId) {
            throw validationError(
                "Company information is missing."
            );
        }

        const companyId = positiveId(
            user.companyId,
            "company"
        );

        const params = await context.params;

        const id = positiveId(
            params.id,
            "purchase order ID"
        );

        client = await pool.connect();

        await client.query("BEGIN");
        transactionStarted = true;

        const currentResult = await client.query(
            `
            SELECT
                purchase_order_id,
                purchase_order_number,
                status

            FROM purchase_orders

            WHERE
                purchase_order_id = $1
                AND company_id = $2

            FOR UPDATE
            `,
            [id, companyId]
        );

        if (!currentResult.rowCount) {
            throw validationError(
                "Purchase Order not found.",
                404
            );
        }

        const current = currentResult.rows[0];

        if (current.status !== "DRAFT") {
            throw validationError(
                "Only DRAFT Purchase Orders can be deleted."
            );
        }

        await client.query(
            `
            DELETE FROM purchase_orders

            WHERE
                purchase_order_id = $1
                AND company_id = $2
            `,
            [id, companyId]
        );

        await client.query("COMMIT");
        transactionStarted = false;

        return NextResponse.json({
            success: true,
            message: `Purchase Order ${current.purchase_order_number} deleted successfully.`,
        });
    } catch (error) {
        if (client && transactionStarted) {
            try {
                await client.query("ROLLBACK");
            } catch (rollbackError) {
                console.error(
                    "Purchase Order delete rollback error:",
                    rollbackError
                );
            }
        }

        return apiError(error);
    } finally {
        if (client) {
            client.release();
        }
    }
}
