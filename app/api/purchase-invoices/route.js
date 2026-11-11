import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
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

function positiveNumber(value, defaultValue = 0) {
    const number = Number(value ?? defaultValue);

    return Number.isFinite(number) && number >= 0
        ? number
        : null;
}

function invoiceNumber() {
    const date = new Date()
        .toISOString()
        .slice(0, 10)
        .replaceAll("-", "");

    return `PI-${date}-${randomUUID().slice(0, 8).toUpperCase()}`;
}

function errorResponse(error) {
    if (error.message === "UNAUTHORIZED") {
        return NextResponse.json(
            { message: "Authentication required." },
            { status: 401 }
        );
    }

    if (error.message === "FORBIDDEN") {
        return NextResponse.json(
            { message: "You do not have permission to perform this action." },
            { status: 403 }
        );
    }

    console.error("PURCHASE INVOICE API ERROR:", error);

    return NextResponse.json(
        {
            message: error.message || "Internal server error.",
        },
        {
            status: error.code ? 500 : 400,
        }
    );
}

async function getAuthorizedUser(action = "view") {
    const user = await getCurrentUser();

    if (!user) {
        throw new Error("UNAUTHORIZED");
    }

    if (!user.companyId) {
        throw new Error("User is not assigned to a company.");
    }

    await requirePermission(user, "purchase_invoices", action);

    return user;
}

function normalizeItems(items) {
    if (!Array.isArray(items) || items.length === 0) {
        throw new Error("Add at least one invoice item.");
    }

    return items.map((item, index) => {
        const productId = positiveId(
            item.productId ?? item.product_id
        );

        const quantity = Number(
            item.quantity
        );

        const unitCost = positiveNumber(
            item.unitCost ?? item.unit_cost
        );

        const discount = positiveNumber(
            item.discount
        );

        const tax = positiveNumber(
            item.tax
        );

        if (!productId) {
            throw new Error(`Invalid product on line ${index + 1}.`);
        }

        if (!Number.isFinite(quantity) || quantity <= 0) {
            throw new Error(`Invalid quantity on line ${index + 1}.`);
        }

        if (
            unitCost === null ||
            discount === null ||
            tax === null
        ) {
            throw new Error(`Invalid cost, discount or tax on line ${index + 1}.`);
        }

        const gross = quantity * unitCost;

        if (discount > gross) {
            throw new Error(
                `Discount cannot exceed the item amount on line ${index + 1}.`
            );
        }

        const lineTotal = gross - discount + tax;

        return {
            productId,
            quantity,
            unitCost,
            discount,
            tax,
            lineTotal,
            itemDescription:
                String(
                    item.itemDescription ??
                    item.item_description ??
                    ""
                ).trim(),
            uom: String(item.uom ?? "").trim(),
            itemReceiptItemId: positiveId(
                item.itemReceiptItemId ??
                item.item_receipt_item_id
            ),
        };
    });
}

async function validateSupplierAndWarehouse(
    client,
    supplierId,
    warehouseId
) {
    const supplier = await client.query(
        `
        SELECT supplier_id, supplier_name
        FROM suppliers
        WHERE supplier_id = $1
          AND is_active = TRUE
        `,
        [supplierId]
    );

    if (!supplier.rows.length) {
        throw new Error("Supplier does not exist or is inactive.");
    }

    const warehouse = await client.query(
        `
        SELECT warehouse_id, warehouse_name
        FROM warehouses
        WHERE warehouse_id = $1
          AND is_active = TRUE
        `,
        [warehouseId]
    );

    if (!warehouse.rows.length) {
        throw new Error("Warehouse does not exist or is inactive.");
    }

    return {
        supplier: supplier.rows[0],
        warehouse: warehouse.rows[0],
    };
}

// ============================================================
// ITEM RECEIPT VALIDATION
// Draft invoice quantities are reserved against the receipt.
// This prevents multiple drafts from invoicing the same quantity.
// ============================================================

async function validateReceiptItems(
    client,
    {
        companyId,
        receiptId,
        supplierId,
        warehouseId,
        items,
        excludePurchaseId = null,
    }
) {
    if (!receiptId) {
        throw new Error("Select an Item Receipt.");
    }

    const receiptResult = await client.query(
        `
        SELECT
            item_receipt_id,
            receipt_number,
            supplier_id,
            warehouse_id,
            company_id,
            status
        FROM item_receipts
        WHERE item_receipt_id = $1
          AND company_id = $2
        FOR UPDATE
        `,
        [receiptId, companyId]
    );

    const receipt = receiptResult.rows[0];

    if (!receipt) {
        throw new Error("Item Receipt was not found for this company.");
    }

    if (receipt.status !== "APPROVED") {
        throw new Error("Only approved Item Receipts can be invoiced.");
    }

    if (
        Number(receipt.supplier_id) !== supplierId ||
        Number(receipt.warehouse_id) !== warehouseId
    ) {
        throw new Error(
            "Supplier and warehouse must match the selected Item Receipt."
        );
    }

    for (const item of items) {
        if (!item.itemReceiptItemId) {
            throw new Error(
                "Every Item Receipt invoice line must reference a receipt item."
            );
        }
    }

    const receiptItemIds = [
        ...new Set(items.map((item) => item.itemReceiptItemId)),
    ].sort((a, b) => a - b);

    for (const receiptItemId of receiptItemIds) {
        const receiptItemResult = await client.query(
            `
            SELECT
                item_receipt_item_id,
                item_receipt_id,
                product_id,
                quantity_received,
                unit_cost,
                item_description,
                uom
            FROM item_receipt_items
            WHERE item_receipt_item_id = $1
              AND item_receipt_id = $2
            FOR UPDATE
            `,
            [receiptItemId, receiptId]
        );

        if (!receiptItemResult.rows.length) {
            throw new Error(
                "An invoice line does not belong to the selected Item Receipt."
            );
        }

        const receiptItem = receiptItemResult.rows[0];

        const requestedQuantity = items
            .filter(
                (item) =>
                    item.itemReceiptItemId === receiptItemId
            )
            .reduce(
                (total, item) => total + item.quantity,
                0
            );

        const invoicedResult = await client.query(
            `
            SELECT COALESCE(SUM(pi.quantity), 0) AS invoiced_quantity
            FROM purchase_items pi
            INNER JOIN purchases p
                ON p.purchase_id = pi.purchase_id
            WHERE pi.item_receipt_item_id = $1
              AND p.document_status <> 'CANCELLED'
              AND (
                    $2::INTEGER IS NULL
                    OR p.purchase_id <> $2
              )
            `,
            [receiptItemId, excludePurchaseId]
        );

        const alreadyInvoiced = Number(
            invoicedResult.rows[0].invoiced_quantity
        );

        const receivedQuantity = Number(
            receiptItem.quantity_received
        );

        const remainingQuantity =
            receivedQuantity - alreadyInvoiced;

        if (requestedQuantity > remainingQuantity + 0.000001) {
            throw new Error(
                `Cannot invoice ${requestedQuantity} units. ` +
                `Only ${Math.max(0, remainingQuantity)} units remain uninvoiced ` +
                `for receipt item ${receiptItemId}.`
            );
        }

        const matchingLines = items.filter(
            (item) =>
                item.itemReceiptItemId === receiptItemId
        );

        for (const line of matchingLines) {
            if (
                Number(line.productId) !==
                Number(receiptItem.product_id)
            ) {
                throw new Error(
                    "Invoice product does not match its Item Receipt product."
                );
            }
        }
    }
}

// ============================================================
// VALIDATE PRODUCTS
// ============================================================

async function validateProducts(client, items) {
    const productIds = [
        ...new Set(items.map((item) => item.productId)),
    ];

    const result = await client.query(
        `
        SELECT
            product_id,
            product_name,
            unit,
            purchase_unit,
            is_active
        FROM products
        WHERE product_id = ANY($1::INTEGER[])
        `,
        [productIds]
    );

    const productMap = new Map(
        result.rows.map((product) => [
            Number(product.product_id),
            product,
        ])
    );

    if (productMap.size !== productIds.length) {
        throw new Error("One or more products do not exist.");
    }

    for (const item of items) {
        const product = productMap.get(item.productId);

        if (!product.is_active) {
            throw new Error(
                `Product "${product.product_name}" is inactive.`
            );
        }

        if (!item.itemDescription) {
            item.itemDescription = product.product_name;
        }

        if (!item.uom) {
            item.uom =
                product.purchase_unit ||
                product.unit ||
                "PCS";
        }
    }
}

// ============================================================
// INSERT INVOICE ITEMS
// ============================================================

async function insertInvoiceItems(
    client,
    purchaseId,
    items
) {
    for (const item of items) {
        await client.query(
            `
            INSERT INTO purchase_items (
                purchase_id,
                product_id,
                quantity,
                unit_cost,
                discount,
                tax,
                line_total,
                item_receipt_item_id,
                item_description,
                uom
            )
            VALUES (
                $1, $2, $3, $4, $5,
                $6, $7, $8, $9, $10
            )
            `,
            [
                purchaseId,
                item.productId,
                item.quantity,
                item.unitCost,
                item.discount,
                item.tax,
                item.lineTotal,
                item.itemReceiptItemId,
                item.itemDescription,
                item.uom,
            ]
        );
    }
}

// ============================================================
// GET — LIST OR VIEW PURCHASE INVOICES
// ============================================================

export async function GET(request) {
    try {
        const user = await getAuthorizedUser("view");

        const { searchParams } = new URL(request.url);

        const purchaseId = positiveId(
            searchParams.get("id")
        );

        if (purchaseId) {
            const result = await pool.query(
                `
                SELECT
                    p.*,
                    s.supplier_name,
                    s.supplier_code,
                    w.warehouse_name,
                    ir.receipt_number
                FROM purchases p
                LEFT JOIN suppliers s
                    ON s.supplier_id = p.supplier_id
                LEFT JOIN warehouses w
                    ON w.warehouse_id = p.warehouse_id
                LEFT JOIN item_receipts ir
                    ON ir.item_receipt_id = p.item_receipt_id
                WHERE p.purchase_id = $1
                  AND p.company_id = $2
                `,
                [purchaseId, user.companyId]
            );

            if (!result.rows.length) {
                return NextResponse.json(
                    { message: "Purchase Invoice not found." },
                    { status: 404 }
                );
            }

            const itemsResult = await pool.query(
                `
                SELECT
                    pi.*,
                    pr.product_name,
                    pr.sku
                FROM purchase_items pi
                LEFT JOIN products pr
                    ON pr.product_id = pi.product_id
                WHERE pi.purchase_id = $1
                ORDER BY pi.purchase_item_id
                `,
                [purchaseId]
            );

            return NextResponse.json({
                invoice: result.rows[0],
                items: itemsResult.rows,
            });
        }

        const result = await pool.query(
            `
            SELECT
                p.*,
                s.supplier_name,
                s.supplier_code,
                w.warehouse_name,
                ir.receipt_number
            FROM purchases p
            LEFT JOIN suppliers s
                ON s.supplier_id = p.supplier_id
            LEFT JOIN warehouses w
                ON w.warehouse_id = p.warehouse_id
            LEFT JOIN item_receipts ir
                ON ir.item_receipt_id = p.item_receipt_id
            WHERE p.company_id = $1
            ORDER BY p.purchase_id DESC
            `,
            [user.companyId]
        );

        return NextResponse.json({
            invoices: result.rows,
        });
    } catch (error) {
        return errorResponse(error);
    }
}

// ============================================================
// POST — CREATE DRAFT PURCHASE INVOICE
// ============================================================

export async function POST(request) {
    const client = await pool.connect();

    try {
        const user = await getAuthorizedUser("create");
        const body = await request.json();

        const supplierId = positiveId(body.supplierId);
        const warehouseId = positiveId(body.warehouseId);

        const sourceType = String(
            body.sourceType || "MANUAL"
        ).toUpperCase();

        const receiptId = positiveId(body.itemReceiptId);

        const purchaseDate =
            body.purchaseDate || body.purchase_date;

        const purchaseDiscount = positiveNumber(
            body.discount ?? body.purchaseDiscount
        );

        const purchaseTax = positiveNumber(
            body.tax ?? body.purchaseTax
        );

        if (!supplierId || !warehouseId) {
            throw new Error("Select a supplier and warehouse.");
        }

        if (!["MANUAL", "ITEM_RECEIPT"].includes(sourceType)) {
            throw new Error("Invalid invoice source type.");
        }

        if (
            sourceType === "ITEM_RECEIPT" &&
            !receiptId
        ) {
            throw new Error("Select an Item Receipt.");
        }

        if (
            sourceType === "MANUAL" &&
            receiptId
        ) {
            throw new Error(
                "Manual invoices cannot be linked to an Item Receipt."
            );
        }

        if (purchaseDiscount === null || purchaseTax === null) {
            throw new Error("Invalid invoice discount or tax.");
        }

        const items = normalizeItems(body.items);

        if (
            items.some(
                (item) =>
                    sourceType === "ITEM_RECEIPT"
                        ? !item.itemReceiptItemId
                        : Boolean(item.itemReceiptItemId)
            )
        ) {
            throw new Error(
                "Invoice lines do not match the selected source type."
            );
        }

        await client.query("BEGIN");

        await validateSupplierAndWarehouse(
            client,
            supplierId,
            warehouseId
        );

        await validateProducts(client, items);

        if (sourceType === "ITEM_RECEIPT") {
            await validateReceiptItems(client, {
                companyId: user.companyId,
                receiptId,
                supplierId,
                warehouseId,
                items,
            });
        }

        const subtotal = items.reduce(
            (total, item) => total + item.lineTotal,
            0
        );

        const totalAmount =
            subtotal - purchaseDiscount + purchaseTax;

        if (totalAmount < 0) {
            throw new Error("Invoice total cannot be negative.");
        }

        const number = invoiceNumber();

        const purchaseResult = await client.query(
            `
            INSERT INTO purchases (
                purchase_number,
                supplier_id,
                warehouse_id,
                purchase_date,
                subtotal,
                discount,
                tax,
                total_amount,
                paid_amount,
                balance_amount,
                status,
                notes,
                document_status,
                source_type,
                item_receipt_id,
                company_id
            )
            VALUES (
                $1, $2, $3,
                COALESCE($4::DATE, CURRENT_DATE),
                $5, $6, $7, $8,
                0, $8, 'UNPAID',
                $9, 'DRAFT', $10, $11, $12
            )
            RETURNING *
            `,
            [
                number,
                supplierId,
                warehouseId,
                purchaseDate || null,
                subtotal,
                purchaseDiscount,
                purchaseTax,
                totalAmount,
                body.notes || null,
                sourceType,
                sourceType === "ITEM_RECEIPT"
                    ? receiptId
                    : null,
                user.companyId,
            ]
        );

        const purchase = purchaseResult.rows[0];

        await insertInvoiceItems(
            client,
            purchase.purchase_id,
            items
        );

        await client.query("COMMIT");

        return NextResponse.json(
            {
                message: "Purchase Invoice draft created successfully.",
                invoice: purchase,
                items,
            },
            { status: 201 }
        );
    } catch (error) {
        await client.query("ROLLBACK").catch(() => {});
        return errorResponse(error);
    } finally {
        client.release();
    }
}

// ============================================================
// PUT — UPDATE DRAFT PURCHASE INVOICE
// ============================================================

export async function PUT(request) {
    const client = await pool.connect();

    try {
        const user = await getAuthorizedUser("update");
        const body = await request.json();

        const purchaseId = positiveId(
            body.purchaseId ?? body.purchase_id
        );

        const supplierId = positiveId(body.supplierId);
        const warehouseId = positiveId(body.warehouseId);

        const sourceType = String(
            body.sourceType || "MANUAL"
        ).toUpperCase();

        const receiptId = positiveId(body.itemReceiptId);

        const purchaseDate =
            body.purchaseDate || body.purchase_date;

        const purchaseDiscount = positiveNumber(
            body.discount ?? body.purchaseDiscount
        );

        const purchaseTax = positiveNumber(
            body.tax ?? body.purchaseTax
        );

        if (!purchaseId) {
            throw new Error("Invalid Purchase Invoice ID.");
        }

        if (!supplierId || !warehouseId) {
            throw new Error("Select a supplier and warehouse.");
        }

        if (!["MANUAL", "ITEM_RECEIPT"].includes(sourceType)) {
            throw new Error("Invalid invoice source type.");
        }

        if (
            sourceType === "ITEM_RECEIPT" &&
            !receiptId
        ) {
            throw new Error("Select an Item Receipt.");
        }

        if (
            sourceType === "MANUAL" &&
            receiptId
        ) {
            throw new Error(
                "Manual invoices cannot be linked to an Item Receipt."
            );
        }

        if (purchaseDiscount === null || purchaseTax === null) {
            throw new Error("Invalid invoice discount or tax.");
        }

        const items = normalizeItems(body.items);

        if (
            items.some(
                (item) =>
                    sourceType === "ITEM_RECEIPT"
                        ? !item.itemReceiptItemId
                        : Boolean(item.itemReceiptItemId)
            )
        ) {
            throw new Error(
                "Invoice lines do not match the selected source type."
            );
        }

        await client.query("BEGIN");

        const existingResult = await client.query(
            `
            SELECT *
            FROM purchases
            WHERE purchase_id = $1
              AND company_id = $2
            FOR UPDATE
            `,
            [purchaseId, user.companyId]
        );

        const existing = existingResult.rows[0];

        if (!existing) {
            throw new Error("Purchase Invoice not found.");
        }

        if (existing.document_status !== "DRAFT") {
            throw new Error(
                "Only draft Purchase Invoices can be edited."
            );
        }

        await validateSupplierAndWarehouse(
            client,
            supplierId,
            warehouseId
        );

        await validateProducts(client, items);

        if (sourceType === "ITEM_RECEIPT") {
            await validateReceiptItems(client, {
                companyId: user.companyId,
                receiptId,
                supplierId,
                warehouseId,
                items,
                excludePurchaseId: purchaseId,
            });
        }

        const subtotal = items.reduce(
            (total, item) => total + item.lineTotal,
            0
        );

        const totalAmount =
            subtotal - purchaseDiscount + purchaseTax;

        if (totalAmount < 0) {
            throw new Error("Invoice total cannot be negative.");
        }

        await client.query(
            `
            DELETE FROM purchase_items
            WHERE purchase_id = $1
            `,
            [purchaseId]
        );

        const updatedResult = await client.query(
            `
            UPDATE purchases
            SET
                supplier_id = $1,
                warehouse_id = $2,
                purchase_date = COALESCE($3::DATE, purchase_date),
                subtotal = $4,
                discount = $5,
                tax = $6,
                total_amount = $7,
                balance_amount = $7 - paid_amount,
                status = CASE
                    WHEN paid_amount >= $7 THEN 'PAID'
                    WHEN paid_amount > 0 THEN 'PARTIAL'
                    ELSE 'UNPAID'
                END,
                notes = $8,
                source_type = $9,
                item_receipt_id = $10,
                updated_at = CURRENT_TIMESTAMP
            WHERE purchase_id = $11
              AND company_id = $12
            RETURNING *
            `,
            [
                supplierId,
                warehouseId,
                purchaseDate || null,
                subtotal,
                purchaseDiscount,
                purchaseTax,
                totalAmount,
                body.notes || null,
                sourceType,
                sourceType === "ITEM_RECEIPT"
                    ? receiptId
                    : null,
                purchaseId,
                user.companyId,
            ]
        );

        await insertInvoiceItems(
            client,
            purchaseId,
            items
        );

        await client.query("COMMIT");

        return NextResponse.json({
            message: "Purchase Invoice draft updated successfully.",
            invoice: updatedResult.rows[0],
            items,
        });
    } catch (error) {
        await client.query("ROLLBACK").catch(() => {});
        return errorResponse(error);
    } finally {
        client.release();
    }
}

// ============================================================
// DELETE — DELETE DRAFT PURCHASE INVOICE
// ============================================================

export async function DELETE(request) {
    const client = await pool.connect();

    try {
        const user = await getAuthorizedUser("delete");

        const { searchParams } = new URL(request.url);

        const purchaseId = positiveId(
            searchParams.get("id")
        );

        if (!purchaseId) {
            throw new Error("Invalid Purchase Invoice ID.");
        }

        await client.query("BEGIN");

        const result = await client.query(
            `
            SELECT purchase_id, document_status
            FROM purchases
            WHERE purchase_id = $1
              AND company_id = $2
            FOR UPDATE
            `,
            [purchaseId, user.companyId]
        );

        const invoice = result.rows[0];

        if (!invoice) {
            throw new Error("Purchase Invoice not found.");
        }

        if (invoice.document_status !== "DRAFT") {
            throw new Error(
                "Only draft Purchase Invoices can be deleted."
            );
        }

        await client.query(
            `
            DELETE FROM purchase_items
            WHERE purchase_id = $1
            `,
            [purchaseId]
        );

        await client.query(
            `
            DELETE FROM purchases
            WHERE purchase_id = $1
              AND company_id = $2
            `,
            [purchaseId, user.companyId]
        );

        await client.query("COMMIT");

        return NextResponse.json({
            message: "Purchase Invoice draft deleted successfully.",
        });
    } catch (error) {
        await client.query("ROLLBACK").catch(() => {});
        return errorResponse(error);
    } finally {
        client.release();
    }
}