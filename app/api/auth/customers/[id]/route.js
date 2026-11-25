
import { NextResponse } from "next/server";
import {
  getTenantContext,
  unauthorizedResponse,
} from "@/lib/tenant";
import { hasPermission } from "@/lib/permissions";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const PERMISSION_KEY = "customers";

// =====================================================
// RESPONSE HELPERS
// =====================================================

function errorResponse(message, status) {
  return NextResponse.json(
    {
      success: false,
      message,
    },
    {
      status,
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate",
      },
    }
  );
}

function successResponse(data, status = 200) {
  return NextResponse.json(data, {
    status,
    headers: {
      "Cache-Control": "no-store, no-cache, must-revalidate",
    },
  });
}

// =====================================================
// AUTHENTICATION AND PERMISSION
// =====================================================

async function authorize(action) {
  let tenant;

  try {
    tenant = await getTenantContext();
  } catch (error) {
    console.error("CUSTOMER AUTHENTICATION ERROR:", error);

    return {
      tenant: null,
      response: errorResponse(
        "Unable to verify your login session.",
        500
      ),
    };
  }

  if (!tenant) {
    return {
      tenant: null,
      response: unauthorizedResponse(),
    };
  }

  const roleId = tenant.user?.roleId ?? tenant.user?.role_id;

  if (
    roleId === null ||
    roleId === undefined ||
    !Number.isInteger(Number(roleId)) ||
    Number(roleId) <= 0
  ) {
    return {
      tenant: null,
      response: errorResponse(
        "Your account does not have a valid role.",
        403
      ),
    };
  }

  try {
    const allowed = await hasPermission(
      Number(roleId),
      PERMISSION_KEY,
      action
    );

    if (!allowed) {
      return {
        tenant: null,
        response: errorResponse(
          `You do not have permission to ${action} customers.`,
          403
        ),
      };
    }

    return {
      tenant,
      response: null,
    };
  } catch (error) {
    console.error("CUSTOMER PERMISSION ERROR:", error);

    return {
      tenant: null,
      response: errorResponse(
        "Unable to verify customer permissions.",
        500
      ),
    };
  }
}

// =====================================================
// ROUTE PARAMETER
// =====================================================

async function getCustomerId(context) {
  const params = await context.params;
  const id = Number(params?.id);

  return Number.isInteger(id) && id > 0 ? id : null;
}

// =====================================================
// PUT: UPDATE ACTIVE CUSTOMER
// =====================================================

export async function PUT(request, context) {
  try {
    const { tenant, response } = await authorize("update");

    if (response) return response;

    const customerId = await getCustomerId(context);

    if (!customerId) {
      return errorResponse("Invalid customer ID.", 400);
    }

    const body = await request.json();

    const {
      customerCode,
      customerName,
      phone,
      email,
      address,
      openingBalance = 0,
      creditLimit = 0,
      isActive = true,
    } = body;

    if (
      typeof customerCode !== "string" ||
      !customerCode.trim() ||
      typeof customerName !== "string" ||
      !customerName.trim()
    ) {
      return errorResponse(
        "Customer code and customer name are required.",
        400
      );
    }

    const result = await tenant.db.query(
      `
        UPDATE customers
        SET
          customer_code = $1,
          customer_name = $2,
          phone = $3,
          email = $4,
          address = $5,
          opening_balance = $6,
          credit_limit = $7,
          is_active = $8,
          updated_at = CURRENT_TIMESTAMP
        WHERE customer_id = $9
          AND deleted_at IS NULL
        RETURNING *
      `,
      [
        customerCode.trim(),
        customerName.trim(),
        phone || null,
        email || null,
        address || null,
        Number(openingBalance) || 0,
        Number(creditLimit) || 0,
        isActive !== false,
        customerId,
      ]
    );

    if (result.rowCount === 0) {
      return errorResponse("Active customer not found.", 404);
    }

    return successResponse({
      success: true,
      message: "Customer updated successfully.",
      customer: result.rows[0],
    });
  } catch (error) {
    console.error("PUT CUSTOMER ERROR:", error);

    if (error.code === "23505") {
      return errorResponse(
        "Customer code already exists.",
        409
      );
    }

    if (error.code === "23503") {
      return errorResponse(
        "Customer data is linked to another record.",
        409
      );
    }

    return errorResponse(
      "An unexpected error occurred while updating the customer.",
      500
    );
  }
}

// =====================================================
// DELETE: MOVE CUSTOMER TO RECYCLE BIN
// =====================================================

export async function DELETE(request, context) {
  const { tenant, response } = await authorize("delete");

  if (response) return response;

  const customerId = await getCustomerId(context);

  if (!customerId) {
    return errorResponse("Invalid customer ID.", 400);
  }

  let client;

  try {
    client = await tenant.db.connect();

    await client.query("BEGIN");

    // Lock the customer to prevent concurrent deletion.
    const customerResult = await client.query(
      `
        SELECT *
        FROM customers
        WHERE customer_id = $1
          AND deleted_at IS NULL
        FOR UPDATE
      `,
      [customerId]
    );

    if (customerResult.rowCount === 0) {
      await client.query("ROLLBACK");

      return errorResponse(
        "Active customer not found.",
        404
      );
    }

    const customer = customerResult.rows[0];

    const userId =
      tenant.user?.userId ??
      tenant.user?.user_id ??
      tenant.user?.id ??
      null;

    const recordLabel = [
      customer.customer_name,
      customer.customer_code
        ? `(${customer.customer_code})`
        : null,
    ]
      .filter(Boolean)
      .join(" ");

    // Save a complete snapshot before archiving.
    const archiveResult = await client.query(
      `
        INSERT INTO recycle_bin_items (
          company_id,
          module_key,
          source_table,
          source_record_id,
          record_label,
          deleted_by,
          deletion_reason,
          record_snapshot,
          relationship_snapshot
        )
        VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9::jsonb
        )
        RETURNING recycle_bin_id
      `,
      [
        tenant.companyId,
        "customers",
        "customers",
        String(customer.customer_id),
        recordLabel,
        userId,
        "Customer deleted from Customers module",
        JSON.stringify(customer),
        JSON.stringify([]),
      ]
    );

    // Soft delete: preserve the original customer row.
    await client.query(
      `
        UPDATE customers
        SET
          deleted_at = CURRENT_TIMESTAMP,
          deleted_by = $1
        WHERE customer_id = $2
          AND deleted_at IS NULL
      `,
      [userId, customerId]
    );

    await client.query("COMMIT");

    return successResponse({
      success: true,
      message: "Customer moved to Recycle Bin successfully.",
      recycleBinId: archiveResult.rows[0].recycle_bin_id,
    });
  } catch (error) {
    if (client) {
      try {
        await client.query("ROLLBACK");
      } catch (rollbackError) {
        console.error(
          "CUSTOMER DELETE ROLLBACK ERROR:",
          rollbackError
        );
      }
    }

    console.error(
      "DELETE CUSTOMER / RECYCLE BIN ERROR:",
      error
    );

    if (error.code === "23505") {
      return errorResponse(
        "This customer already has an entry in the Recycle Bin.",
        409
      );
    }

    if (error.code === "23503") {
      return errorResponse(
        "Customer archive references an invalid company or user.",
        409
      );
    }

    return errorResponse(
      "An unexpected error occurred while moving the customer to the Recycle Bin.",
      500
    );
  } finally {
    client?.release();
  }
}
