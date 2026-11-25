
const ARCHIVABLE_MODULES = Object.freeze({
  customers: {
    table: "customers",
    idColumn: "customer_id",
    labelColumn: "customer_name",
  },
  product_categories: {
    table: "product_categories",
    idColumn: "category_id",
    labelColumn: "category_name",
  },
  products: {
    table: "products",
    idColumn: "product_id",
    labelColumn: "product_name",
  },
  product_units: {
    table: "product_units",
    idColumn: "unit_id",
    labelColumn: "unit_name",
  },
  suppliers: {
    table: "suppliers",
    idColumn: "supplier_id",
    labelColumn: "supplier_name",
  },
  units_of_measure: {
    table: "units_of_measure",
    idColumn: "unit_id",
    labelColumn: "unit_name",
  },
  warehouses: {
    table: "warehouses",
    idColumn: "warehouse_id",
    labelColumn: "warehouse_name",
  },

  // Batch 2: Sales
  sales_quotations: {
    table: "sales_quotations",
    idColumn: "quotation_id",
    labelColumn: "quotation_number",
  },
  sales_orders: {
    table: "sales_orders",
    idColumn: "order_id",
    labelColumn: "order_number",
  },
  delivery_challans: {
    table: "delivery_challans",
    idColumn: "delivery_challan_id",
    labelColumn: "transaction_number",
  },
  sales_returns: {
    table: "sales_returns",
    idColumn: "return_id",
    labelColumn: "return_number",
  },

  // Batch 3: Procurement & Purchasing
  purchase_requisitions: {
    table: "purchase_requisitions",
    idColumn: "requisition_id",
    labelColumn: "transaction_number",
  },

   purchase_quotations: {
  table: "purchase_quotations",
  idColumn: "purchase_quotation_id",
  labelColumn: "quotation_number",
},

  procurement_requisitions: {
    table: "procurement_requisitions",
    idColumn: "procurement_requisition_id",
    labelColumn: "transaction_number",
  },
    rfqs: {
    table: "rfqs",
    idColumn: "rfq_id",
    labelColumn: "transaction_number",
  },

  purchase_orders: {
    table: "purchase_orders",
    idColumn: "purchase_order_id",
    labelColumn: "purchase_order_number",
},
pending_item_receipts: {
    table: "pending_item_receipts",
    idColumn: "pending_item_receipt_id",
    labelColumn: "receipt_number",
},

item_receipts: {
    table: "item_receipts",
    idColumn: "item_receipt_id",
    labelColumn: "receipt_number",
},

assembly_build: {
    table: "assembly_builds",
    idColumn: "assembly_build_id",
    labelColumn: "transaction_number",
},

assembly_unbuild: {
    table: "assembly_unbuilds",
    idColumn: "assembly_unbuild_id",
    labelColumn: "transaction_number",
},

bill_of_materials: {
    table: "bill_of_materials",
    idColumn: "bom_id",
    labelColumn: "bom_name",
},

});

export async function archiveRecord(
  client,
  {
    companyId,
    moduleKey,
    sourceTable,
    sourceRecordId,
    recordLabel,
    deletedBy,
    recordSnapshot,
    deletionReason = null,
    relationshipSnapshot = [],
  }
) {
  if (!companyId || !moduleKey || !sourceTable || !sourceRecordId) {
    throw new Error("Missing required Recycle Bin archive information.");
  }

  const result = await client.query(
    `
      INSERT INTO public.recycle_bin_items (
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
        $1, $2, $3, $4, $5, $6,
        CURRENT_TIMESTAMP, $7, $8::jsonb, $9::jsonb
      )
      RETURNING recycle_bin_id
    `,
    [
      companyId,
      moduleKey,
      sourceTable,
      String(sourceRecordId),
      recordLabel || String(sourceRecordId),
      deletedBy || null,
      deletionReason,
      JSON.stringify(recordSnapshot || {}),
      JSON.stringify(relationshipSnapshot || []),
    ]
  );

  return result.rows[0].recycle_bin_id;
}

export async function archiveAndSoftDelete(
  tenant,
  {
    moduleKey,
    recordId,
    validateRecord = null,
    deletionReason = null,
    relationshipSnapshot = [],
  }
) {
  const config = ARCHIVABLE_MODULES[moduleKey];

  if (!config) {
    throw new Error("Unsupported Recycle Bin module.");
  }

  const id = Number(recordId);

  if (!Number.isSafeInteger(id) || id <= 0) {
    return {
      success: false,
      status: 400,
      message: "Invalid record ID.",
    };
  }

  const companyId = Number(tenant?.companyId);

  if (!Number.isSafeInteger(companyId) || companyId <= 0) {
    throw new Error("A valid tenant company ID is required.");
  }

  const user = tenant.user || {};
  const deletedBy =
    user.userId ??
    user.user_id ??
    user.id ??
    null;

  const client = await tenant.db.connect();

  try {
    await client.query("BEGIN");

    const selected = await client.query(
      `
        SELECT *
        FROM public.${config.table}
        WHERE ${config.idColumn} = $1
          AND company_id = $2
        FOR UPDATE
      `,
      [id, companyId]
    );

    if (selected.rowCount === 0) {
      await client.query("ROLLBACK");

      return {
        success: false,
        status: 404,
        message: "Record not found.",
      };
    }

    const record = selected.rows[0];

    if (record.deleted_at) {
      await client.query("ROLLBACK");

      return {
        success: false,
        status: 409,
        message: "This record is already in the Recycle Bin.",
      };
    }

    if (validateRecord) {
      const validation = await validateRecord(client, record);

      if (validation) {
        await client.query("ROLLBACK");

        return {
          success: false,
          status: validation.status || 409,
          message:
            validation.message || "This record cannot be deleted.",
        };
      }
    }

    const archiveId = await archiveRecord(client, {
      companyId,
      moduleKey,
      sourceTable: config.table,
      sourceRecordId: id,
      recordLabel: record[config.labelColumn],
      deletedBy,
      recordSnapshot: record,
      deletionReason,
      relationshipSnapshot,
    });

    const updated = await client.query(
      `
        UPDATE public.${config.table}
        SET
          deleted_at = CURRENT_TIMESTAMP,
          deleted_by = $1,
          updated_at = CURRENT_TIMESTAMP
        WHERE ${config.idColumn} = $2
          AND company_id = $3
          AND deleted_at IS NULL
        RETURNING *
      `,
      [deletedBy, id, companyId]
    );

    if (updated.rowCount === 0) {
      throw new Error("The record could not be archived.");
    }

    await client.query("COMMIT");

    return {
      success: true,
      archiveId,
      record: updated.rows[0],
    };
  } catch (error) {
    try {
      await client.query("ROLLBACK");
    } catch (rollbackError) {
      console.error("RECYCLE BIN ROLLBACK ERROR:", rollbackError);
    }

    throw error;
  } finally {
    client.release();
  }
}
