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
      warehouseName,
      warehouseCode,
      location,
      description,
      isActive,
    } = body;

    if (!warehouseName || !warehouseCode) {
      return NextResponse.json(
        {
          message:
            "Warehouse name and code are required.",
        },
        { status: 400 }
      );
    }

    const result = await db.query(
      `
      UPDATE warehouses
      SET
        warehouse_name = $1,
        warehouse_code = $2,
        location = $3,
        description = $4,
        is_active = $5,
        updated_at = CURRENT_TIMESTAMP
      WHERE warehouse_id = $6
      AND deleted_at IS NULL
      RETURNING *
      `,
      [
        warehouseName,
        warehouseCode,
        location || null,
        description || null,
        isActive !== false,
        id,
      ]
    );

    if (result.rows.length === 0) {
      return NextResponse.json(
        {
          message: "Warehouse not found.",
        },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Warehouse updated successfully.",
      warehouse: result.rows[0],
    });
  } catch (error) {
    console.error("WAREHOUSE UPDATE ERROR:", error);

    if (error.code === "23505") {
      return NextResponse.json(
        {
          message: "Warehouse code already exists.",
        },
        { status: 409 }
      );
    }

    return NextResponse.json(
      {
        message: "Failed to update warehouse.",
        error: error.message,
      },
      { status: 500 }
    );
  }
}



export async function DELETE(request, { params }) {
  try {
    const access = await checkAccess(request, "delete");

    if (!access.allowed) {
      return NextResponse.json(
        { success: false, message: access.message },
        { status: access.status }
      );
    }

    const tenant = await getTenantContext();
    if (!tenant) return unauthorizedResponse();

    const { id } = await params;

    const result = await archiveAndSoftDelete(tenant, {
      moduleKey: "warehouses",
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
      message: "Warehouse moved to Recycle Bin successfully.",
      recycleBinId: result.archiveId,
      warehouse: result.record,
    });
  } catch (error) {
    console.error("WAREHOUSE DELETE ERROR:", error);

    return NextResponse.json(
      { success: false, message: "Failed to archive warehouse." },
      { status: 500 }
    );
  }
}
