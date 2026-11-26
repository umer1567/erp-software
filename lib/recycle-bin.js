
// const ARCHIVABLE_MODULES = Object.freeze({
//   customers: {
//     table: "customers",
//     idColumn: "customer_id",
//     labelColumn: "customer_name",
//   },
//   product_categories: {
//     table: "product_categories",
//     idColumn: "category_id",
//     labelColumn: "category_name",
//   },
//   products: {
//     table: "products",
//     idColumn: "product_id",
//     labelColumn: "product_name",
//   },
//   product_units: {
//     table: "product_units",
//     idColumn: "unit_id",
//     labelColumn: "unit_name",
//   },
//   suppliers: {
//     table: "suppliers",
//     idColumn: "supplier_id",
//     labelColumn: "supplier_name",
//   },
//   units_of_measure: {
//     table: "units_of_measure",
//     idColumn: "unit_id",
//     labelColumn: "unit_name",
//   },
//   warehouses: {
//     table: "warehouses",
//     idColumn: "warehouse_id",
//     labelColumn: "warehouse_name",
//   },

//   // Sales
//   sales_quotations: {
//     table: "sales_quotations",
//     idColumn: "quotation_id",
//     labelColumn: "quotation_number",
//   },
//   sales_orders: {
//     table: "sales_orders",
//     idColumn: "order_id",
//     labelColumn: "order_number",
//   },
//   delivery_challans: {
//     table: "delivery_challans",
//     idColumn: "delivery_challan_id",
//     labelColumn: "transaction_number",
//   },
//   sales_returns: {
//     table: "sales_returns",
//     idColumn: "return_id",
//     labelColumn: "return_number",
//   },

//   // Procurement and purchasing
//   purchase_requisitions: {
//     table: "purchase_requisitions",
//     idColumn: "requisition_id",
//     labelColumn: "transaction_number",
//   },
//   purchase_quotations: {
//     table: "purchase_quotations",
//     idColumn: "purchase_quotation_id",
//     labelColumn: "quotation_number",
//   },
//   procurement_requisitions: {
//     table: "procurement_requisitions",
//     idColumn: "procurement_requisition_id",
//     labelColumn: "transaction_number",
//   },
//   rfqs: {
//     table: "rfqs",
//     idColumn: "rfq_id",
//     labelColumn: "transaction_number",
//   },
//   purchase_orders: {
//     table: "purchase_orders",
//     idColumn: "purchase_order_id",
//     labelColumn: "purchase_order_number",
//   },
//   pending_item_receipts: {
//     table: "pending_item_receipts",
//     idColumn: "pending_item_receipt_id",
//     labelColumn: "receipt_number",
//   },
//   item_receipts: {
//     table: "item_receipts",
//     idColumn: "item_receipt_id",
//     labelColumn: "receipt_number",
//   },

//   // Assembly
//   assembly_build: {
//     table: "assembly_builds",
//     idColumn: "assembly_build_id",
//     labelColumn: "transaction_number",
//   },
//   assembly_unbuild: {
//     table: "assembly_unbuilds",
//     idColumn: "assembly_unbuild_id",
//     labelColumn: "transaction_number",
//   },
//   bill_of_materials: {
//     table: "bill_of_materials",
//     idColumn: "bom_id",
//     labelColumn: "bom_name",
//   },
// });

// export async function archiveRecord(
//   client,
//   {
//     companyId,
//     moduleKey,
//     sourceTable,
//     sourceRecordId,
//     recordLabel,
//     deletedBy,
//     recordSnapshot,
//     deletionReason = null,
//     relationshipSnapshot = [],
//   }
// ) {
//   if (!companyId || !moduleKey || !sourceTable || !sourceRecordId) {
//     throw new Error("Missing required Recycle Bin archive information.");
//   }

//   const result = await client.query(
//     `
//       INSERT INTO public.recycle_bin_items (
//         company_id,
//         module_key,
//         source_table,
//         source_record_id,
//         record_label,
//         deleted_by,
//         deleted_at,
//         deletion_reason,
//         record_snapshot,
//         relationship_snapshot
//       )
//       VALUES (
//         $1, $2, $3, $4, $5, $6,
//         CURRENT_TIMESTAMP, $7, $8::jsonb, $9::jsonb
//       )
//       RETURNING recycle_bin_id
//     `,
//     [
//       companyId,
//       moduleKey,
//       sourceTable,
//       String(sourceRecordId),
//       recordLabel || String(sourceRecordId),
//       deletedBy || null,
//       deletionReason,
//       JSON.stringify(recordSnapshot || {}),
//       JSON.stringify(relationshipSnapshot || []),
//     ]
//   );

//   return result.rows[0].recycle_bin_id;
// }

// export async function archiveAndSoftDelete(
//   tenant,
//   {
//     moduleKey,
//     recordId,
//     validateRecord = null,
//     deletionReason = null,
//     relationshipSnapshot = [],
//   }
// ) {
//   const config = ARCHIVABLE_MODULES[moduleKey];

//   if (!config) {
//     throw new Error("Unsupported Recycle Bin module.");
//   }

//   const id = Number(recordId);

//   if (!Number.isSafeInteger(id) || id <= 0) {
//     return {
//       success: false,
//       status: 400,
//       message: "Invalid record ID.",
//     };
//   }

//   const companyId = Number(tenant?.companyId);

//   if (!Number.isSafeInteger(companyId) || companyId <= 0) {
//     throw new Error("A valid tenant company ID is required.");
//   }

//   if (!tenant?.db || typeof tenant.db.connect !== "function") {
//     throw new Error("Tenant database connection is unavailable.");
//   }

//   const user = tenant.user || {};

//   const deletedBy =
//     user.userId ??
//     user.user_id ??
//     user.id ??
//     null;

//   const client = await tenant.db.connect();

//   try {
//     await client.query("BEGIN");

//     // Tenant database isolation is already enforced by getTenantContext().
//     // Do not filter tenant operational tables by company_id.
//     const selected = await client.query(
//       `
//         SELECT *
//         FROM public.${config.table}
//         WHERE ${config.idColumn} = $1
//         FOR UPDATE
//       `,
//       [id]
//     );

//     if (selected.rowCount === 0) {
//       await client.query("ROLLBACK");

//       return {
//         success: false,
//         status: 404,
//         message: "Record not found.",
//       };
//     }

//     const record = selected.rows[0];

//     if (record.deleted_at) {
//       await client.query("ROLLBACK");

//       return {
//         success: false,
//         status: 409,
//         message: "This record is already in the Recycle Bin.",
//       };
//     }

//     if (validateRecord) {
//       const validation = await validateRecord(client, record);

//       if (validation) {
//         await client.query("ROLLBACK");

//         return {
//           success: false,
//           status: validation.status || 409,
//           message:
//             validation.message || "This record cannot be deleted.",
//         };
//       }
//     }

//     // company_id is retained in the archive record for company ownership.
//     const archiveId = await archiveRecord(client, {
//       companyId,
//       moduleKey,
//       sourceTable: config.table,
//       sourceRecordId: id,
//       recordLabel: record[config.labelColumn],
//       deletedBy,
//       recordSnapshot: record,
//       deletionReason,
//       relationshipSnapshot,
//     });

//     // The tenant table does not need a company_id column.
//     const updated = await client.query(
//       `
//         UPDATE public.${config.table}
//         SET
//           deleted_at = CURRENT_TIMESTAMP,
//           deleted_by = $1,
//           updated_at = CURRENT_TIMESTAMP
//         WHERE ${config.idColumn} = $2
//           AND deleted_at IS NULL
//         RETURNING *
//       `,
//       [deletedBy, id]
//     );

//     if (updated.rowCount === 0) {
//       throw new Error("The record could not be archived.");
//     }

//     await client.query("COMMIT");

//     return {
//       success: true,
//       archiveId,
//       record: updated.rows[0],
//     };
//   } catch (error) {
//     try {
//       await client.query("ROLLBACK");
//     } catch (rollbackError) {
//       console.error("RECYCLE BIN ROLLBACK ERROR:", rollbackError);
//     }

//     throw error;
//   } finally {
//     client.release();
//   }
// }



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

  // Sales
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

  // Procurement and purchasing
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

  // Assembly
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

  const companyId = Number(
    tenant?.companyId ??
    tenant?.user?.companyId ??
    tenant?.user?.company_id
  );

  if (!Number.isSafeInteger(companyId) || companyId <= 0) {
    throw new Error("A valid tenant company ID is required.");
  }

  // Operational records and their archive must use the same company DB.
  const db = tenant?.db;

  if (!db || typeof db.connect !== "function") {
    throw new Error("Tenant database connection is unavailable.");
  }

  const user = tenant.user || {};

  const deletedBy =
    user.userId ??
    user.user_id ??
    user.id ??
    null;

  const client = await db.connect();

  try {
    await client.query("BEGIN");

    // Discover the actual source table columns.
    const columnResult = await client.query(
      `
        SELECT column_name
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = $1
      `,
      [config.table]
    );

    const columns = new Set(
      columnResult.rows.map((row) => row.column_name)
    );

    if (!columns.has(config.idColumn)) {
      throw new Error(
        `Recycle Bin configuration error: ${config.idColumn} does not exist in ${config.table}.`
      );
    }

    if (!columns.has("deleted_at")) {
      throw new Error(
        `Cannot archive ${config.table}: deleted_at column is missing. Apply the Recycle Bin database migration first.`
      );
    }

    // Include company ownership when the source table supports it.
    const ownershipCondition = columns.has("company_id")
      ? `AND company_id = $2`
      : "";

    const selectValues = columns.has("company_id")
      ? [id, companyId]
      : [id];

    // Lock the correct company's source record.
    const selected = await client.query(
      `
        SELECT *
        FROM public.${config.table}
        WHERE ${config.idColumn} = $1
          ${ownershipCondition}
        FOR UPDATE
      `,
      selectValues
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

    // Check for an existing archive entry.
    const existingArchive = await client.query(
      `
        SELECT recycle_bin_id
        FROM public.recycle_bin_items
        WHERE company_id = $1
          AND module_key = $2
          AND source_table = $3
          AND source_record_id = $4
        LIMIT 1
      `,
      [
        companyId,
        moduleKey,
        config.table,
        String(id),
      ]
    );

    if (existingArchive.rowCount > 0) {
      await client.query("ROLLBACK");

      return {
        success: false,
        status: 409,
        message: "This record already has a Recycle Bin entry.",
      };
    }

    // Run module-specific validation before archiving.
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

    // Create the archive in the SAME company database.
    const archiveId = await archiveRecord(client, {
      companyId,
      moduleKey,
      sourceTable: config.table,
      sourceRecordId: id,
      recordLabel: record[config.labelColumn] || String(id),
      deletedBy,
      recordSnapshot: record,
      deletionReason,
      relationshipSnapshot,
    });

    // Update only columns that exist in the source table.
    // Update only columns that exist in the source table.
const updates = [
    "deleted_at = CURRENT_TIMESTAMP",
];

// IMPORTANT: Products must also become inactive when archived.
if (config.table === "products" && columns.has("is_active")) {
    updates.push("is_active = FALSE");
}

const updateValues = [];

    if (columns.has("deleted_by")) {
      updateValues.push(deletedBy);
      updates.push(`deleted_by = $${updateValues.length}`);
    }

    if (columns.has("updated_at")) {
      updates.push("updated_at = CURRENT_TIMESTAMP");
    }

    updateValues.push(id);
    const idParameter = updateValues.length;

    let companyCondition = "";

    if (columns.has("company_id")) {
      updateValues.push(companyId);
      companyCondition = `AND company_id = $${updateValues.length}`;
    }

    const updated = await client.query(
      `
        UPDATE public.${config.table}
        SET ${updates.join(", ")}
        WHERE ${config.idColumn} = $${idParameter}
          AND deleted_at IS NULL
          ${companyCondition}
        RETURNING *
      `,
      updateValues
    );

    if (updated.rowCount !== 1) {
      throw new Error("The source record could not be archived.");
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

    console.error("RECYCLE BIN ARCHIVE ERROR:", error);
    throw error;
  } finally {
    client.release();
  }
}
