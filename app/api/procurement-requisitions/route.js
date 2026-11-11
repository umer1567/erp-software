import { NextResponse } from "next/server";
import pool from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import {
    requirePermission,
    hasPermission,
} from "@/lib/permissions";

export const dynamic = "force-dynamic";

function permissionError(error) {
    if (error?.message === "UNAUTHORIZED") {
        return NextResponse.json(
            {
                success: false,
                message: "Please log in.",
            },
            { status: 401 }
        );
    }

    if (error?.message === "FORBIDDEN") {
        return NextResponse.json(
            {
                success: false,
                message: "You do not have permission.",
            },
            { status: 403 }
        );
    }

    return null;
}

// ======================================================
// GET
// Load approved Purchase Requisition items that have
// not already been converted into Procurement Requisitions.
// ======================================================

export async function GET() {
    try {
        const user = await getCurrentUser();

        await requirePermission(
            user,
            "procurement_requisitions",
            "view"
        );

        if (!user.companyId) {
            return NextResponse.json(
                {
                    success: false,
                    message: "Your account is not linked to a company.",
                },
                { status: 400 }
            );
        }

        // Correct argument order:
        // hasPermission(roleId, permissionKey, action)
        const [canCreate, canCreateRFQ] = await Promise.all([
    hasPermission(
        user.roleId,
        "procurement_requisitions",
        "create"
    ),
    hasPermission(
        user.roleId,
        "rfqs",
        "create"
    ),
]);

        const result = await pool.query(
            `
            SELECT
                ri.requisition_item_id AS seq_id,

                pr.transaction_date AS req_date,

                pr.transaction_number AS req_number,

                COALESCE(p.sku, '') AS item,

                COALESCE(
                    NULLIF(ri.item_description, ''),
                    p.product_name,
                    ''
                ) AS item_description,

                COALESCE(
                    NULLIF(ri.uom, ''),
                    p.unit,
                    ''
                ) AS uom,

                ri.quantity AS quantity_enter,

                COALESCE(pr.department, '') AS department,

                COALESCE(pr.class_name, '') AS class_name,

                COALESCE(w.warehouse_name, '') AS location,

                pr.requisition_id,

                ri.product_id,

                pr.warehouse_id

            FROM purchase_requisition_items ri

            INNER JOIN purchase_requisitions pr
                ON pr.requisition_id = ri.requisition_id

            LEFT JOIN products p
                ON p.product_id = ri.product_id

            LEFT JOIN warehouses w
                ON w.warehouse_id = pr.warehouse_id

            WHERE pr.company_id = $1
              AND pr.status = 'APPROVED'

              AND NOT EXISTS (
    SELECT 1
    FROM procurement_requisition_items pri
    WHERE pri.source_requisition_item_id =
          ri.requisition_item_id
)

AND NOT EXISTS (
    SELECT 1
    FROM rfq_items rfi
    WHERE rfi.source_requisition_item_id =
          ri.requisition_item_id
)

            ORDER BY
                pr.transaction_date DESC,
                pr.requisition_id DESC,
                ri.requisition_item_id DESC
            `,
            [user.companyId]
        );

        return NextResponse.json({
            success: true,
            rows: result.rows,
            permissions: {
    canCreate,
    canCreateRFQ,
},
        });
    } catch (error) {
        const response = permissionError(error);

        if (response) return response;

        console.error(
            "GET procurement requisitions:",
            error
        );

        return NextResponse.json(
            {
                success: false,
                message: "Failed to load procurement requisitions.",
            },
            { status: 500 }
        );
    }
}

// ======================================================
// POST
// Convert multiple approved Purchase Requisition items
// into ONE Procurement Requisition.
// ======================================================

export async function POST(request) {
    let client = null;
    let transactionStarted = false;

    try {
        const user = await getCurrentUser();

        await requirePermission(
            user,
            "procurement_requisitions",
            "create"
        );

        if (!user.companyId || !user.userId) {
            return NextResponse.json(
                {
                    success: false,
                    message: "Invalid user company or account.",
                },
                { status: 400 }
            );
        }

        // Parse request body.
        let body;

        try {
            body = await request.json();
        } catch {
            return NextResponse.json(
                {
                    success: false,
                    message: "Invalid request body.",
                },
                { status: 400 }
            );
        }

        const selectedItemIds = body?.selectedItemIds;

        if (
            !Array.isArray(selectedItemIds) ||
            selectedItemIds.length === 0
        ) {
            return NextResponse.json(
                {
                    success: false,
                    message: "Please select at least one item.",
                },
                { status: 400 }
            );
        }

        // Normalize IDs and remove duplicates.
        const ids = [
            ...new Set(selectedItemIds.map(Number)),
        ];

        if (
            ids.some(
                (id) =>
                    !Number.isSafeInteger(id) ||
                    id <= 0
            )
        ) {
            return NextResponse.json(
                {
                    success: false,
                    message: "Invalid selected item IDs.",
                },
                { status: 400 }
            );
        }

        // Acquire database connection after validation.
        client = await pool.connect();

        await client.query("BEGIN");
        transactionStarted = true;

        // Lock the selected source rows and requisition headers.
        // Check the Procurement Requisition items table to prevent
        // converting an item that has already been converted.
        const sourceResult = await client.query(
            `
            SELECT
                ri.requisition_item_id,
                ri.requisition_id,
                ri.product_id,
                ri.item_description,
                ri.uom,
                ri.quantity,

                pr.department,
                pr.class_name,
                pr.warehouse_id,
                pr.transaction_number,
                pr.company_id,
                pr.status

            FROM purchase_requisition_items ri

            INNER JOIN purchase_requisitions pr
                ON pr.requisition_id = ri.requisition_id

            WHERE ri.requisition_item_id = ANY($1::INTEGER[])
              AND pr.company_id = $2
              AND pr.status = 'APPROVED'

              AND NOT EXISTS (
    SELECT 1
    FROM procurement_requisition_items pri
    WHERE pri.source_requisition_item_id =
          ri.requisition_item_id
)

AND NOT EXISTS (
    SELECT 1
    FROM rfq_items rfi
    WHERE rfi.source_requisition_item_id =
          ri.requisition_item_id
)

            ORDER BY ri.requisition_item_id

            FOR UPDATE OF ri, pr
            `,
            [ids, user.companyId]
        );

        // Every selected item must still be available.
        if (sourceResult.rows.length !== ids.length) {
            await client.query("ROLLBACK");
            transactionStarted = false;

            return NextResponse.json(
                {
                    success: false,
                    message:
                        "Some selected items are unavailable, not approved, or already converted. Refresh the list and try again.",
                },
                { status: 409 }
            );
        }

        // Generate Procurement Requisition number.
        const numberResult = await client.query(
            `
            SELECT
                'PRQ' ||
                LPAD(
                    nextval(
                        'procurement_requisition_number_seq'
                    )::TEXT,
                    6,
                    '0'
                ) AS transaction_number
            `
        );

        const transactionNumber =
            numberResult.rows[0].transaction_number;

        // Create ONE Procurement Requisition header.
        const headerResult = await client.query(
            `
            INSERT INTO procurement_requisitions (
                company_id,
                transaction_number,
                transaction_date,
                status,
                created_by
            )
            VALUES (
                $1,
                $2,
                CURRENT_DATE,
                'CREATED',
                $3
            )
            RETURNING
                procurement_requisition_id,
                transaction_number
            `,
            [
                user.companyId,
                transactionNumber,
                user.userId,
            ]
        );

        const procurement = headerResult.rows[0];

        // Insert every selected source item into the same header.
        for (const item of sourceResult.rows) {
            await client.query(
                `
                INSERT INTO procurement_requisition_items (
                    procurement_requisition_id,
                    source_requisition_id,
                    source_requisition_item_id,
                    product_id,
                    item_description,
                    uom,
                    quantity,
                    department,
                    class_name,
                    warehouse_id
                )
                VALUES (
                    $1, $2, $3, $4, $5,
                    $6, $7, $8, $9, $10
                )
                `,
                [
                    procurement.procurement_requisition_id,
                    item.requisition_id,
                    item.requisition_item_id,
                    item.product_id,
                    item.item_description,
                    item.uom,
                    item.quantity,
                    item.department,
                    item.class_name,
                    item.warehouse_id,
                ]
            );
        }

        // Commit only after the header and all items are inserted.
        await client.query("COMMIT");
        transactionStarted = false;

        return NextResponse.json(
            {
                success: true,
                message:
                    "Procurement Requisition created successfully.",
                procurement: {
                    procurementRequisitionId:
                        procurement.procurement_requisition_id,
                    transactionNumber:
                        procurement.transaction_number,
                    itemCount: sourceResult.rows.length,
                },
            },
            { status: 201 }
        );
    } catch (error) {
        if (client && transactionStarted) {
            try {
                await client.query("ROLLBACK");
            } catch (rollbackError) {
                console.error(
                    "Procurement transaction rollback failed:",
                    rollbackError
                );
            }

            transactionStarted = false;
        }

        const response = permissionError(error);

        if (response) return response;

        console.error(
            "POST procurement requisition:",
            error
        );

        if (error.code === "23505") {
            return NextResponse.json(
                {
                    success: false,
                    message:
                        "One or more selected items have already been converted, or the transaction number already exists. Refresh the list and try again.",
                },
                { status: 409 }
            );
        }

        if (error.code === "23503") {
            return NextResponse.json(
                {
                    success: false,
                    message:
                        "A related company, user, product, warehouse, or requisition record could not be found.",
                },
                { status: 400 }
            );
        }

        if (
            error.code === "42P01" ||
            error.code === "42703" ||
            error.code === "42P sequence"
        ) {
            return NextResponse.json(
                {
                    success: false,
                    message:
                        "A required Procurement Requisition database table, column, or sequence is missing. Check your database schema.",
                },
                { status: 500 }
            );
        }

        return NextResponse.json(
            {
                success: false,
                message:
                    error.message ||
                    "Failed to create Procurement Requisition.",
            },
            { status: 500 }
        );
    } finally {
        if (client) {
            client.release();
        }
    }
}