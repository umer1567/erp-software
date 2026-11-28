import { NextResponse } from "next/server";
import { getTenantContext } from "@/lib/tenant";
import { requirePermission } from "@/lib/permissions";

export const dynamic = "force-dynamic";

const PERMISSION_KEY = "transaction_auto_number";

const TRANSACTION_TYPES = [
    { type: "POS", name: "POS", prefix: "POS-" },
    { type: "SALES_INVOICE", name: "Sales Invoice", prefix: "SI-" },
    { type: "SALES_PAYMENT", name: "Sales Payment", prefix: "SP-" },
    { type: "SALES_QUOTATION", name: "Sales Quotation", prefix: "SQ-" },
    { type: "SALES_ORDER", name: "Sales Order", prefix: "SO-" },
    { type: "DELIVERY_CHALLAN", name: "Delivery Challan", prefix: "DC-" },
    { type: "SALES_RETURN", name: "Sales Return", prefix: "SR-" },
    { type: "PURCHASE_REQUISITION", name: "Purchase Requisition", prefix: "PR-" },
    { type: "PROCUREMENT_REQUISITION", name: "Procurement Requisition", prefix: "PRQ-" },
    { type: "RFQ", name: "Request for Quotation", prefix: "RFQ-" },
    { type: "PURCHASE_QUOTATION", name: "Purchase Quotation", prefix: "PQ-" },
    { type: "PURCHASE_ORDER", name: "Purchase Order", prefix: "PO-" },
    { type: "ITEM_RECEIPT", name: "Item Receipt", prefix: "IR-" },
    { type: "PURCHASE_INVOICE", name: "Purchase Invoice", prefix: "PI-" },
    { type: "SUPPLIER_PAYMENT", name: "Supplier Payment", prefix: "SPY-" },
    { type: "BILL_OF_MATERIALS", name: "Bill of Materials", prefix: "BOM-" },
    { type: "ASSEMBLY_BUILD", name: "Assembly Build", prefix: "AB-" },
    { type: "ASSEMBLY_UNBUILD", name: "Assembly Unbuild", prefix: "AU-" },
    { type: "JOURNAL_ENTRY", name: "Journal Entry", prefix: "JV-" },
    { type: "MAKE_PAYMENT", name: "Make Payment", prefix: "PAY-" },
    { type: "MAKE_RECEIPT", name: "Make Receipt", prefix: "REC-" },
    { type: "VENDORCREDIT", name: "Vendor Credit", prefix: "VC-" },
    { type: "GATE_PASS_IN", name: "Gate Pass In", prefix: "GPI-", startingNumber: 1000 },
    { type: "GATE_PASS_OUT", name: "Gate Pass Out", prefix: "GPO-", startingNumber: 100 },
];

function jsonError(message, status = 400) {
    return NextResponse.json(
        { success: false, message },
        { status }
    );
}

async function getAccess(action) {
    const context = await getTenantContext();

    if (!context?.user || !context?.db || !context?.companyId) {
        return {
            error: "Authentication or active company is required.",
            status: 401,
        };
    }

    await requirePermission(
        context.user,
        PERMISSION_KEY,
        action
    );

    return { context };
}

function normalizeConfig(config) {
    const numberLength = Number(config.number_length);
    const startingNumber =
        config.starting_number === "" ||
        config.starting_number === null ||
        config.starting_number === undefined
            ? null
            : Number(config.starting_number);

    if (
        !Number.isInteger(numberLength) ||
        numberLength < 1 ||
        numberLength > 20
    ) {
        throw new Error(
            "Number Length must be between 1 and 20."
        );
    }

    if (
        startingNumber !== null &&
        (
            !Number.isSafeInteger(startingNumber) ||
            startingNumber < 0
        )
    ) {
        throw new Error(
            "Starting Number must be a valid non-negative integer."
        );
    }

    const prefix = String(config.prefix ?? "");
    const subsidiary = String(config.subsidiary ?? "");
    const location = String(config.location ?? "");
    const department = String(config.department ?? "");
    const format = String(
        config.auto_number_format || "#PREFIX##NUMBER#"
    );

    if (prefix.length > 50) {
        throw new Error("Prefix cannot exceed 50 characters.");
    }

    if (
        subsidiary.length > 255 ||
        location.length > 255 ||
        department.length > 255
    ) {
        throw new Error(
            "Subsidiary, Location and Department cannot exceed 255 characters."
        );
    }

    if (!format.trim() || format.length > 255) {
        throw new Error(
            "Auto Number Format is required and cannot exceed 255 characters."
        );
    }

    return {
        transaction_type: config.transaction_type,
        form_type: config.form_type || "STANDARD",
        prefix,
        number_length: numberLength,
        starting_number: startingNumber,
        subsidiary,
        location,
        department,
        year_wise: config.year_wise === true,
        month_wise: config.month_wise === true,
        auto_number_format: format,
    };
}

async function seedDefaultConfigurations(db, companyId) {
    for (const item of TRANSACTION_TYPES) {
        await db.query(
            `
                INSERT INTO public.transaction_auto_number_configs (
                    company_id,
                    transaction_type,
                    form_type,
                    prefix,
                    number_length,
                    starting_number,
                    auto_number_format
                )
                VALUES ($1, $2, 'STANDARD', $3, 6, $4, '#PREFIX##NUMBER#')
                ON CONFLICT (
                    company_id,
                    transaction_type,
                    form_type
                )
                DO NOTHING
            `,
            [
                companyId,
                item.type,
                item.prefix,
                item.startingNumber ?? null,
            ]
        );
    }
}

// ------------------------------------------------------------
// GET /api/transaction-auto-number
// Requires transaction_auto_number:view
// ------------------------------------------------------------
export async function GET() {
    try {
        const { context } = await getAccess("view");

        const { db, companyId } = context;

        await seedDefaultConfigurations(db, companyId);

        const result = await db.query(
            `
                SELECT
                    config_id,
                    transaction_type,
                    form_type,
                    prefix,
                    number_length,
                    starting_number,
                    subsidiary,
                    location,
                    department,
                    year_wise,
                    month_wise,
                    auto_number_format,
                    is_active,
                    updated_at
                FROM public.transaction_auto_number_configs
                WHERE company_id = $1
                ORDER BY config_id
            `,
            [companyId]
        );

        return NextResponse.json({
            success: true,
            configs: result.rows,
            permissions: {
                canView: true,
                canUpdate: true,
            },
        });
    } catch (error) {
        console.error(
            "TRANSACTION AUTO NUMBER GET ERROR:",
            error
        );

        if (error.message === "UNAUTHORIZED") {
            return jsonError("Unauthorized.", 401);
        }

        if (error.message === "FORBIDDEN") {
            return jsonError(
                "You do not have permission to view Transaction Auto Number.",
                403
            );
        }

        return jsonError(
            "Unable to load transaction numbering configurations.",
            500
        );
    }
}

// ------------------------------------------------------------
// PUT /api/transaction-auto-number
// Requires transaction_auto_number:update
// Saves the configuration grid.
// ------------------------------------------------------------
export async function PUT(request) {
    let client;

    try {
        const { context } = await getAccess("update");

        const { db, companyId } = context;

        let body;

        try {
            body = await request.json();
        } catch {
            return jsonError("Invalid request body.");
        }

        if (
            !Array.isArray(body?.configs) ||
            body.configs.length === 0
        ) {
            return jsonError(
                "No numbering configurations were provided."
            );
        }

        const allowedTypes = new Set(
            TRANSACTION_TYPES.map((item) => item.type)
        );

        const seenTypes = new Set();
        const configs = [];

        for (const item of body.configs) {
            if (
                !item ||
                !allowedTypes.has(item.transaction_type)
            ) {
                return jsonError(
                    "An unsupported transaction type was submitted."
                );
            }

            if (seenTypes.has(item.transaction_type)) {
                return jsonError(
                    "Duplicate transaction type found in the submitted configurations."
                );
            }

            seenTypes.add(item.transaction_type);
            configs.push(normalizeConfig(item));
        }

        client = await db.connect();

        await client.query("BEGIN");

        for (const config of configs) {
            await client.query(
                `
                    INSERT INTO public.transaction_auto_number_configs (
                        company_id,
                        transaction_type,
                        form_type,
                        prefix,
                        number_length,
                        starting_number,
                        subsidiary,
                        location,
                        department,
                        year_wise,
                        month_wise,
                        auto_number_format,
                        updated_at
                    )
                    VALUES (
                        $1, $2, $3, $4, $5, $6,
                        $7, $8, $9, $10, $11, $12,
                        CURRENT_TIMESTAMP
                    )
                    ON CONFLICT (
                        company_id,
                        transaction_type,
                        form_type
                    )
                    DO UPDATE SET
                        prefix = EXCLUDED.prefix,
                        number_length = EXCLUDED.number_length,
                        starting_number = EXCLUDED.starting_number,
                        subsidiary = EXCLUDED.subsidiary,
                        location = EXCLUDED.location,
                        department = EXCLUDED.department,
                        year_wise = EXCLUDED.year_wise,
                        month_wise = EXCLUDED.month_wise,
                        auto_number_format = EXCLUDED.auto_number_format,
                        updated_at = CURRENT_TIMESTAMP
                `,
                [
                    companyId,
                    config.transaction_type,
                    config.form_type,
                    config.prefix,
                    config.number_length,
                    config.starting_number,
                    config.subsidiary,
                    config.location,
                    config.department,
                    config.year_wise,
                    config.month_wise,
                    config.auto_number_format,
                ]
            );
        }

        await client.query("COMMIT");

        const result = await db.query(
            `
                SELECT
                    config_id,
                    transaction_type,
                    form_type,
                    prefix,
                    number_length,
                    starting_number,
                    subsidiary,
                    location,
                    department,
                    year_wise,
                    month_wise,
                    auto_number_format,
                    is_active,
                    updated_at
                FROM public.transaction_auto_number_configs
                WHERE company_id = $1
                ORDER BY config_id
            `,
            [companyId]
        );

        return NextResponse.json({
            success: true,
            message: "Transaction numbering configurations saved successfully.",
            configs: result.rows,
        });
    } catch (error) {
        if (client) {
            try {
                await client.query("ROLLBACK");
            } catch {}
        }

        console.error(
            "TRANSACTION AUTO NUMBER SAVE ERROR:",
            error
        );

        if (error.message === "UNAUTHORIZED") {
            return jsonError("Unauthorized.", 401);
        }

        if (error.message === "FORBIDDEN") {
            return jsonError(
                "You do not have permission to update Transaction Auto Number.",
                403
            );
        }

        if (
            error.message?.includes("Number Length") ||
            error.message?.includes("Starting Number") ||
            error.message?.includes("Prefix") ||
            error.message?.includes("Subsidiary") ||
            error.message?.includes("Auto Number Format") ||
            error.message?.includes("Department")
        ) {
            return jsonError(error.message);
        }

        return jsonError(
            "Unable to save transaction numbering configurations.",
            500
        );
    } finally {
        client?.release();
    }
}