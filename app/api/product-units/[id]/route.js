
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

    const unitName = String(body.unitName || "").trim();
    const barcode = String(body.barcode || "").trim() || null;
    const conversionFactor = Number(body.conversionFactor);

    if (
      !unitName ||
      !Number.isFinite(conversionFactor) ||
      conversionFactor <= 0
    ) {
      return NextResponse.json(
        { success: false, message: "Unit name and a positive conversion factor are required." },
        { status: 400 }
      );
    }

    const result = await db.query(
      `
      UPDATE product_units
      SET unit_name = $1,
          barcode = $2,
          conversion_factor = $3,
          updated_at = CURRENT_TIMESTAMP
      WHERE unit_id = $4
      AND deleted_at IS NULL
      RETURNING *
      `,
      [unitName, barcode, conversionFactor, id]
    );

    if (result.rowCount === 0) {
      return NextResponse.json(
        { success: false, message: "Packaging unit not found." },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Packaging unit updated.",
      unit: result.rows[0],
    });
  } catch (error) {
    console.error("PRODUCT UNIT UPDATE ERROR:", error);

    if (error.code === "23505") {
      return NextResponse.json(
        { success: false, message: "Barcode or unit name already exists." },
        { status: 409 }
      );
    }

    return NextResponse.json(
      { success: false, message: "Failed to update packaging unit." },
      { status: 500 }
    );
  }
}


export async function DELETE(request, { params }) {
  try {
    const tenant = await getTenantContext();
    if (!tenant) return unauthorizedResponse();

    const { id } = await params;
    const unitId = Number(id);

    if (!Number.isSafeInteger(unitId) || unitId <= 0) {
      return NextResponse.json(
        { success: false, message: "Invalid packaging unit ID." },
        { status: 400 }
      );
    }

    const result = await archiveAndSoftDelete(tenant, {
      moduleKey: "product_units",
      recordId: unitId,

      validateRecord: async (client, record) => {
        if (record.is_base_unit) {
          return {
            status: 400,
            message: "The base unit cannot be deleted.",
          };
        }

        const stock = await client.query(
          `
            SELECT COALESCE(SUM(quantity), 0) AS quantity
            FROM unit_stock
            WHERE unit_id = $1
          `,
          [unitId]
        );

        if (Number(stock.rows[0].quantity) !== 0) {
          return {
            status: 409,
            message: "This unit still has stock. Convert or remove its stock before archiving it.",
          };
        }

        return null;
      },
    });

    if (!result.success) {
      return NextResponse.json(
        { success: false, message: result.message },
        { status: result.status }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Packaging unit moved to Recycle Bin successfully.",
      recycleBinId: result.archiveId,
      unit: result.record,
    });
  } catch (error) {
    console.error("PRODUCT UNIT DELETE ERROR:", error);

    return NextResponse.json(
      { success: false, message: "Failed to archive packaging unit." },
      { status: 500 }
    );
  }
}
