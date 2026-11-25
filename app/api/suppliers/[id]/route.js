import { NextResponse } from "next/server";
import { getTenantContext, unauthorizedResponse } from "@/lib/tenant";
import { archiveAndSoftDelete } from "@/lib/recycle-bin";

export async function PUT(request, { params }) {
    try {
        const tenant = await getTenantContext();
        if (!tenant) return unauthorizedResponse();
        const { db } = tenant;

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

        const result = await db.query(
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
            AND deleted_at IS NULL
            
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
    const tenant = await getTenantContext();
    if (!tenant) return unauthorizedResponse();

    const { id } = await params;

    const result = await archiveAndSoftDelete(tenant, {
      moduleKey: "suppliers",
      recordId: id,
    });

    if (!result.success) {
      return NextResponse.json(
        { success: false, message: result.message },
        { status: result.status }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Supplier moved to Recycle Bin successfully.",
      recycleBinId: result.archiveId,
      supplier: result.record,
    });
  } catch (error) {
    console.error("SUPPLIER DELETE ERROR:", error);

    return NextResponse.json(
      { success: false, message: "Failed to archive supplier." },
      { status: 500 }
    );
  }
}
