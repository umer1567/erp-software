
import { NextResponse } from "next/server";
import {
  getTenantContext,
  unauthorizedResponse,
} from "@/lib/tenant";

export const dynamic = "force-dynamic";

// Update an existing customer
export async function PUT(request, { params }) {
  let client;

  try {
    const tenant = await getTenantContext();
    if (!tenant) return unauthorizedResponse();

    const { db } = tenant;
    client = await db.connect();

    const { id } = await params;
    const customerId = Number(id);

    if (!Number.isInteger(customerId) || customerId <= 0) {
      return NextResponse.json(
        { success: false, message: "Invalid customer ID." },
        { status: 400 }
      );
    }

    const body = await request.json();

    const {
      customerCode,
      customerName,
      phone,
      email,
      address,
      openingBalance,
      creditLimit,
      isActive,
    } = body;

    if (!customerCode?.trim() || !customerName?.trim()) {
      return NextResponse.json(
        {
          success: false,
          message: "Customer code and customer name are required.",
        },
        { status: 400 }
      );
    }

    const result = await client.query(
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
        phone?.trim() || null,
        email?.trim() || null,
        address?.trim() || null,
        Number(openingBalance) || 0,
        Number(creditLimit) || 0,
        isActive !== false,
        customerId,
      ]
    );

    if (result.rowCount === 0) {
      return NextResponse.json(
        { success: false, message: "Customer not found." },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Customer updated successfully.",
      customer: result.rows[0],
    });
  } catch (error) {
    console.error("CUSTOMERS PUT ERROR:", error);

    if (error.code === "23505") {
      return NextResponse.json(
        {
          success: false,
          message: "Customer code already exists.",
        },
        { status: 409 }
      );
    }

    return NextResponse.json(
      {
        success: false,
        message: "Failed to update customer.",
        error: error.message,
      },
      { status: 500 }
    );
  } finally {
    client?.release();
  }
}

// Soft-delete customer and archive it in Recycle Bin
export async function DELETE(request, { params }) {
  let client;
  let transactionStarted = false;

  try {
    const tenant = await getTenantContext();

    if (!tenant) return unauthorizedResponse();

    const { db, companyId, user } = tenant;

    client = await db.connect();

    const { id } = await params;
    const customerId = Number(id);

    if (!Number.isInteger(customerId) || customerId <= 0) {
      return NextResponse.json(
        { success: false, message: "Invalid customer ID." },
        { status: 400 }
      );
    }

    const deletedBy =
      user?.userId ??
      user?.user_id ??
      user?.id ??
      null;

    await client.query("BEGIN");
    transactionStarted = true;

    // Lock the active customer before archiving.
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
      transactionStarted = false;

      return NextResponse.json(
        {
          success: false,
          message: "Customer not found or already deleted.",
        },
        { status: 404 }
      );
    }

    const customer = customerResult.rows[0];

    const recordLabel =
      customer.customer_name || `Customer ${customerId}`;

    // Save the complete original customer record.
    const archiveResult = await client.query(
      `
      INSERT INTO recycle_bin_items (
        company_id,
        module_key,
        source_table,
        source_record_id,
        record_label,
        deleted_by,
        deleted_at,
        deletion_reason,
        record_snapshot,
        relationship_snapshot
      )
      VALUES (
        $1,
        'customers',
        'customers',
        $2,
        $3,
        $4,
        CURRENT_TIMESTAMP,
        $5,
        $6::jsonb,
        '[]'::jsonb
      )
      RETURNING recycle_bin_id
      `,
      [
        companyId,
        String(customerId),
        recordLabel,
        deletedBy,
        "Customer deleted from Customers module",
        JSON.stringify(customer),
      ]
    );

    // Only mark the customer deleted after successful archiving.
    await client.query(
      `
      UPDATE customers
      SET
        deleted_at = CURRENT_TIMESTAMP,
        deleted_by = $1,
        updated_at = CURRENT_TIMESTAMP
      WHERE customer_id = $2
        AND deleted_at IS NULL
      `,
      [deletedBy, customerId]
    );

    await client.query("COMMIT");
    transactionStarted = false;

    return NextResponse.json({
      success: true,
      message: "Customer moved to Recycle Bin successfully.",
      customer: {
        customer_id: customer.customer_id,
        customer_name: customer.customer_name,
        customer_code: customer.customer_code,
      },
      recycleBinId: archiveResult.rows[0].recycle_bin_id,
    });
  } catch (error) {
    if (client && transactionStarted) {
      try {
        await client.query("ROLLBACK");
      } catch (rollbackError) {
        console.error("CUSTOMER DELETE ROLLBACK ERROR:", rollbackError);
      }
    }

    console.error("CUSTOMERS DELETE ERROR:", error);

    if (error.code === "23505") {
      return NextResponse.json(
        {
          success: false,
          message: "This customer already has an archive entry.",
          error: error.message,
        },
        { status: 409 }
      );
    }

    if (error.code === "23503") {
      return NextResponse.json(
        {
          success: false,
          message: "Customer is linked to existing records.",
          error: error.message,
        },
        { status: 409 }
      );
    }

    return NextResponse.json(
      {
        success: false,
        message: "Failed to move customer to Recycle Bin.",
        error: error.message,
      },
      { status: 500 }
    );
  } finally {
    client?.release();
  }
}
