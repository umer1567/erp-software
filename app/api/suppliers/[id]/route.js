import { NextResponse } from "next/server";
import pool from "@/lib/db";

export async function PUT(request, { params }) {
    try {
        const { id } = await params;

        const body = await request.json();

        const {
            supplierCode,
            supplierName,
            phone,
            email,
            address,
            openingBalance,
            creditLimit,
            isActive,
        } = body;

        if (!supplierCode || !supplierName) {
            return NextResponse.json(
                {
                    success: false,
                    message:
                        "Supplier code and supplier name are required.",
                },
                { status: 400 }
            );
        }

        const result = await pool.query(
            `
            UPDATE suppliers
            SET
                supplier_code = $1,
                supplier_name = $2,
                phone = $3,
                email = $4,
                address = $5,
                opening_balance = $6,
                credit_limit = $7,
                is_active = $8,
                updated_at = CURRENT_TIMESTAMP
            WHERE supplier_id = $9
            RETURNING *
            `,
            [
                supplierCode.trim(),
                supplierName.trim(),
                phone || null,
                email || null,
                address || null,
                Number(openingBalance) || 0,
                Number(creditLimit) || 0,
                isActive !== false,
                id,
            ]
        );

        if (result.rows.length === 0) {
            return NextResponse.json(
                {
                    success: false,
                    message: "Supplier not found.",
                },
                { status: 404 }
            );
        }

        return NextResponse.json({
            success: true,
            message: "Supplier updated successfully.",
            supplier: result.rows[0],
        });

    } catch (error) {
        console.error("SUPPLIER PUT ERROR:", error);

        if (error.code === "23505") {
            return NextResponse.json(
                {
                    success: false,
                    message: "Supplier code already exists.",
                },
                { status: 409 }
            );
        }

        return NextResponse.json(
            {
                success: false,
                message: "Failed to update supplier.",
                error: error.message,
            },
            { status: 500 }
        );
    }
}


export async function DELETE(request, { params }) {
    try {
        const { id } = await params;

        const result = await pool.query(
            `
            DELETE FROM suppliers
            WHERE supplier_id = $1
            RETURNING supplier_id
            `,
            [id]
        );

        if (result.rows.length === 0) {
            return NextResponse.json(
                {
                    success: false,
                    message: "Supplier not found.",
                },
                { status: 404 }
            );
        }

        return NextResponse.json({
            success: true,
            message: "Supplier deleted successfully.",
        });

    } catch (error) {
        console.error("SUPPLIER DELETE ERROR:", error);

        if (error.code === "23503") {
            return NextResponse.json(
                {
                    success: false,
                    message:
                        "Supplier cannot be deleted because purchase records exist.",
                },
                { status: 409 }
            );
        }

        return NextResponse.json(
            {
                success: false,
                message: "Failed to delete supplier.",
                error: error.message,
            },
            { status: 500 }
        );
    }
}