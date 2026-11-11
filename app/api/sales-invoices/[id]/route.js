
import { NextResponse } from "next/server";
import pool from "@/lib/db";
import {
  required,
  positiveNumber,
  nonNegativeNumber,
  integerId,
  validateDate,
  maxLength,
} from "@/lib/validation";

export const dynamic = "force-dynamic";

const ACCOUNTS = {
  INVENTORY: 7,
  ACCOUNTS_RECEIVABLE: 6,
  SALES: 13,
  COGS: 15,
};

function errorResponse(message, status = 400) {
  return NextResponse.json(
    { success: false, message },
    { status }
  );
}

// =====================================================
// GET: Fetch one invoice and its items
// =====================================================

export async function GET(request, { params }) {
  try {
    const { id } = await params;
    const invoiceId = Number(id);

    if (!Number.isInteger(invoiceId) || invoiceId <= 0) {
      return errorResponse("Invalid invoice ID.", 400);
    }

    const invoiceResult = await pool.query(
      `
      SELECT
        si.invoice_id,
        si.invoice_number,
        si.customer_id,
        c.customer_code,
        c.customer_name,
        c.phone AS customer_phone,
        c.email AS customer_email,
        c.address AS customer_address,
        si.warehouse_id,
        w.warehouse_code,
        w.warehouse_name,
        si.invoice_date,
        si.subtotal,
        si.discount,
        si.tax,
        si.total_amount,
        si.paid_amount,
        si.balance_amount,
        si.status,
        si.notes,
        si.created_at,
        si.updated_at
      FROM sales_invoices si
      INNER JOIN customers c
        ON c.customer_id = si.customer_id
      INNER JOIN warehouses w
        ON w.warehouse_id = si.warehouse_id
      WHERE si.invoice_id = $1
      `,
      [invoiceId]
    );

    if (invoiceResult.rows.length === 0) {
      return errorResponse("Sales invoice not found.", 404);
    }

    const itemsResult = await pool.query(
      `
      SELECT
        sii.invoice_item_id,
        sii.product_id,
        sii.sub_product_id,
        p.sku,
        p.product_name,
        p.unit,
        sii.quantity,
        sii.unit_price,
        sii.discount,
        sii.tax,
        sii.line_total
      FROM sales_invoice_items sii
      INNER JOIN products p
        ON p.product_id = sii.product_id
      WHERE sii.invoice_id = $1
      ORDER BY sii.invoice_item_id ASC
      `,
      [invoiceId]
    );

    return NextResponse.json({
      success: true,
      invoice: invoiceResult.rows[0],
      items: itemsResult.rows,
    });
  } catch (error) {
    console.error("SALES INVOICE DETAIL ERROR:", error);
    return NextResponse.json(
      {
        success: false,
        message: "Failed to load sales invoice.",
      },
      { status: 500 }
    );
  }
}

// =====================================================
// PUT: Update an existing unpaid invoice
// =====================================================

export async function PUT(request, { params }) {
  const client = await pool.connect();
  let transactionStarted = false;

  try {
    const { id } = await params;
    const invoiceId = Number(id);

    if (!Number.isInteger(invoiceId) || invoiceId <= 0) {
      return errorResponse("Invalid invoice ID.", 400);
    }

    const body = await request.json();

    const {
      invoiceNumber,
      customerId,
      warehouseId,
      invoiceDate,
      discount,
      tax,
      notes,
      items,
    } = body;

    const validCustomerId = integerId(
      customerId,
      "Customer"
    );
    const validWarehouseId = integerId(
      warehouseId,
      "Warehouse"
    );

    const invoiceDiscount = nonNegativeNumber(
      discount ?? 0,
      "Invoice discount"
    );

    const invoiceTax = nonNegativeNumber(
      tax ?? 0,
      "Invoice tax"
    );

    const validInvoiceDate = invoiceDate
      ? validateDate(invoiceDate, "Invoice date")
      : null;

    if (notes !== null && notes !== undefined) {
      maxLength(String(notes), 2000, "Notes");
    }

    if (!Array.isArray(items) || items.length === 0) {
      return errorResponse(
        "At least one invoice item is required."
      );
    }

    if (items.length > 500) {
      return errorResponse(
        "An invoice cannot contain more than 500 items."
      );
    }

    await client.query("BEGIN");
    transactionStarted = true;

    // 1. Lock the existing invoice.
    const oldResult = await client.query(
      `
      SELECT
        si.*,
        w.warehouse_name
      FROM sales_invoices si
      INNER JOIN warehouses w
        ON w.warehouse_id = si.warehouse_id
      WHERE si.invoice_id = $1
      FOR UPDATE OF si
      `,
      [invoiceId]
    );

    if (oldResult.rows.length === 0) {
      throw Object.assign(
        new Error("Sales invoice not found."),
        { statusCode: 404 }
      );
    }

    const oldInvoice = oldResult.rows[0];
    const oldInvoiceNumber = oldInvoice.invoice_number;

    // Do not silently rewrite payments or payment journals.
    const paymentCheck = await client.query(
      `
      SELECT payment_id
      FROM sales_payments
      WHERE invoice_id = $1
      LIMIT 1
      `,
      [invoiceId]
    );

    if (
      paymentCheck.rows.length > 0 ||
      Number(oldInvoice.paid_amount || 0) > 0
    ) {
      throw Object.assign(
        new Error(
          "This invoice has recorded payments. Editing it is blocked to protect payment and accounting balances."
        ),
        { statusCode: 409 }
      );
    }

    // Preserve the existing invoice number unless a new one
    // was explicitly supplied.
    const finalInvoiceNumber =
      invoiceNumber === undefined ||
      invoiceNumber === null ||
      String(invoiceNumber).trim() === ""
        ? oldInvoiceNumber
        : String(invoiceNumber).trim();

    required(finalInvoiceNumber, "Invoice number");
    maxLength(finalInvoiceNumber, 50, "Invoice number");

    const duplicateCheck = await client.query(
      `
      SELECT invoice_id
      FROM sales_invoices
      WHERE invoice_number = $1
        AND invoice_id <> $2
      `,
      [finalInvoiceNumber, invoiceId]
    );

    if (duplicateCheck.rows.length > 0) {
      throw Object.assign(
        new Error("Invoice number already exists."),
        { statusCode: 409 }
      );
    }

    // 2. Validate customer and warehouse.
    const customerResult = await client.query(
      `
      SELECT customer_id, customer_name
      FROM customers
      WHERE customer_id = $1
        AND is_active = TRUE
      `,
      [validCustomerId]
    );

    if (customerResult.rows.length === 0) {
      throw new Error("Customer not found or inactive.");
    }

    const customer = customerResult.rows[0];

    const warehouseResult = await client.query(
      `
      SELECT warehouse_id, warehouse_name
      FROM warehouses
      WHERE warehouse_id = $1
        AND is_active = TRUE
      `,
      [validWarehouseId]
    );

    if (warehouseResult.rows.length === 0) {
      throw new Error("Warehouse not found or inactive.");
    }

    const warehouse = warehouseResult.rows[0];

    // 3. Prepare and validate all replacement invoice lines.
    let subtotal = 0;
    const preparedItems = [];

    for (const item of items) {
      const productId = integerId(
        item.productId,
        "Product"
      );

      const quantity = positiveNumber(
        item.quantity,
        "Quantity"
      );

      const unitPrice = nonNegativeNumber(
        item.unitPrice ?? 0,
        "Unit price"
      );

      const itemDiscount = nonNegativeNumber(
        item.discount ?? 0,
        "Item discount"
      );

      const itemTax = nonNegativeNumber(
        item.tax ?? 0,
        "Item tax"
      );

      const subProductId =
        item.subProductId === null ||
        item.subProductId === undefined ||
        item.subProductId === ""
          ? null
          : integerId(item.subProductId, "Sub-product");

      const productResult = await client.query(
        `
        SELECT
          product_id,
          product_name,
          unit,
          cost_price,
          sales_account_id,
          receivable_account_id,
          is_active
        FROM products
        WHERE product_id = $1
        `,
        [productId]
      );

      if (productResult.rows.length === 0) {
        throw new Error(`Product ${productId} not found.`);
      }

      const product = productResult.rows[0];

      if (!product.is_active) {
        throw new Error(
          `Product "${product.product_name}" is inactive.`
        );
      }

      let subProduct = null;
      let unitsPerParent = 1;

      if (subProductId !== null) {
        const subResult = await client.query(
          `
          SELECT
            sub_product_id,
            product_id,
            sub_product_name,
            unit,
            units_per_parent,
            is_active
          FROM sub_products
          WHERE sub_product_id = $1
            AND product_id = $2
          `,
          [subProductId, productId]
        );

        if (subResult.rows.length === 0) {
          throw new Error(
            `Sub-product ${subProductId} does not belong to "${product.product_name}".`
          );
        }

        subProduct = subResult.rows[0];

        if (!subProduct.is_active) {
          throw new Error(
            `Sub-product "${subProduct.sub_product_name}" is inactive.`
          );
        }

        unitsPerParent = Number(
          subProduct.units_per_parent
        );

        if (
          !Number.isFinite(unitsPerParent) ||
          unitsPerParent <= 0
        ) {
          throw new Error(
            `Invalid units-per-parent conversion for "${subProduct.sub_product_name}".`
          );
        }
      }

      // Inventory is maintained in the parent product's unit.
      const stockQuantity = subProduct
        ? quantity / unitsPerParent
        : quantity;

      const lineTotal =
        quantity * unitPrice - itemDiscount + itemTax;

      if (!Number.isFinite(lineTotal) || lineTotal < 0) {
        throw new Error(
          `Invalid line total for "${product.product_name}".`
        );
      }

      const costPrice = Number(product.cost_price) || 0;
      const cogsAmount = stockQuantity * costPrice;

      subtotal += lineTotal;

      preparedItems.push({
        productId,
        subProductId,
        productName: product.product_name,
        subProductName:
          subProduct?.sub_product_name || null,
        unit: subProduct?.unit || product.unit || "PCS",
        inventoryUnit: product.unit || "PCS",
        quantity,
        stockQuantity,
        unitPrice,
        discount: itemDiscount,
        tax: itemTax,
        lineTotal,
        costPrice,
        cogsAmount,
        salesAccountId: product.sales_account_id
          ? Number(product.sales_account_id)
          : ACCOUNTS.SALES,
        receivableAccountId: product.receivable_account_id
          ? Number(product.receivable_account_id)
          : ACCOUNTS.ACCOUNTS_RECEIVABLE,
      });
    }

    const totalAmount =
      subtotal - invoiceDiscount + invoiceTax;

    if (!Number.isFinite(totalAmount) || totalAmount <= 0) {
      throw new Error(
        "Invoice total must be greater than zero."
      );
    }

    // 4. Reverse the original stock deduction using the
    // original inventory transaction quantities.
    const oldStockResult = await client.query(
      `
      SELECT
        product_id,
        SUM(COALESCE(issue_quantity, 0)) AS quantity
      FROM inventory_transactions
      WHERE transaction_type = 'SALES INVOICE'
        AND transaction_number = $1
        AND location = $2
      GROUP BY product_id
      `,
      [oldInvoiceNumber, oldInvoice.warehouse_name]
    );

    for (const row of oldStockResult.rows) {
      const quantity = Number(row.quantity) || 0;

      if (quantity <= 0) continue;

      const restored = await client.query(
        `
        UPDATE stock
        SET
          quantity = quantity + $1,
          updated_at = CURRENT_TIMESTAMP
        WHERE product_id = $2
          AND warehouse_id = $3
        RETURNING stock_id
        `,
        [
          quantity,
          row.product_id,
          oldInvoice.warehouse_id,
        ]
      );

      if (restored.rows.length === 0) {
        throw new Error(
          `Cannot restore original stock for product ${row.product_id}. Its stock record is missing.`
        );
      }
    }

    // 5. Reverse the old invoice's posted accounting balances.
    const oldJournals = await client.query(
      `
      SELECT
        je.journal_id,
        je.reference_type,
        jel.account_id,
        jel.debit,
        jel.credit
      FROM journal_entries je
      INNER JOIN journal_entry_lines jel
        ON jel.journal_id = je.journal_id
      WHERE je.reference_id = $1
        AND je.reference_type IN (
          'SALES_INVOICE',
          'SALES_COGS'
        )
      `,
      [invoiceId]
    );

    for (const line of oldJournals.rows) {
      const debit = Number(line.debit) || 0;
      const credit = Number(line.credit) || 0;

      if (line.reference_type === "SALES_INVOICE") {
        // Reverse the original receivable debit or revenue credit.
        await client.query(
          `
          UPDATE chart_of_accounts
          SET
            current_balance = current_balance - $1,
            updated_at = CURRENT_TIMESTAMP
          WHERE account_id = $2
          `,
          [debit + credit, line.account_id]
        );
      } else if (line.reference_type === "SALES_COGS") {
        // Reverse COGS debit; restore inventory credit.
        const adjustment = debit > 0 ? -debit : credit;

        await client.query(
          `
          UPDATE chart_of_accounts
          SET
            current_balance = current_balance + $1,
            updated_at = CURRENT_TIMESTAMP
          WHERE account_id = $2
          `,
          [adjustment, line.account_id]
        );
      }
    }

    // Remove only this invoice's original inventory movements
    // and journal entries. Delete journal lines first.
    await client.query(
      `
      DELETE FROM inventory_transactions
      WHERE transaction_type = 'SALES INVOICE'
        AND transaction_number = $1
        AND location = $2
      `,
      [oldInvoiceNumber, oldInvoice.warehouse_name]
    );

    await client.query(
      `
      DELETE FROM journal_entry_lines
      WHERE journal_id IN (
        SELECT journal_id
        FROM journal_entries
        WHERE reference_id = $1
          AND reference_type IN (
            'SALES_INVOICE',
            'SALES_COGS'
          )
      )
      `,
      [invoiceId]
    );

    await client.query(
      `
      DELETE FROM journal_entries
      WHERE reference_id = $1
        AND reference_type IN (
          'SALES_INVOICE',
          'SALES_COGS'
        )
      `,
      [invoiceId]
    );

    await client.query(
      `DELETE FROM sales_invoice_items WHERE invoice_id = $1`,
      [invoiceId]
    );

    // 6. Lock and validate stock for the replacement lines.
    const stockRequirements = new Map();

    for (const item of preparedItems) {
      stockRequirements.set(
        item.productId,
        (stockRequirements.get(item.productId) || 0) +
          item.stockQuantity
      );
    }

    for (const [productId, requiredQuantity] of stockRequirements) {
      const stockResult = await client.query(
        `
        SELECT quantity
        FROM stock
        WHERE product_id = $1
          AND warehouse_id = $2
        FOR UPDATE
        `,
        [productId, validWarehouseId]
      );

      const available =
        stockResult.rows.length > 0
          ? Number(stockResult.rows[0].quantity)
          : 0;

      if (available + 1e-9 < requiredQuantity) {
        const item = preparedItems.find(
          (entry) => entry.productId === productId
        );

        throw new Error(
          `Insufficient stock for "${item?.productName || productId}". Available: ${available}, required: ${requiredQuantity}.`
        );
      }
    }

    // 7. Update the invoice header.
    const updatedResult = await client.query(
      `
      UPDATE sales_invoices
      SET
        invoice_number = $1,
        customer_id = $2,
        warehouse_id = $3,
        invoice_date = COALESCE($4::DATE, invoice_date),
        subtotal = $5,
        discount = $6,
        tax = $7,
        total_amount = $8,
        paid_amount = 0,
        balance_amount = $8,
        status = 'UNPAID',
        notes = $9,
        updated_at = CURRENT_TIMESTAMP
      WHERE invoice_id = $10
      RETURNING *
      `,
      [
        finalInvoiceNumber,
        validCustomerId,
        validWarehouseId,
        validInvoiceDate,
        subtotal,
        invoiceDiscount,
        invoiceTax,
        totalAmount,
        notes || null,
        invoiceId,
      ]
    );

    const invoice = updatedResult.rows[0];

    // 8. Insert new invoice items, deduct stock and record
    // replacement inventory transactions.
    for (const item of preparedItems) {
      await client.query(
        `
        INSERT INTO sales_invoice_items (
          invoice_id,
          product_id,
          sub_product_id,
          quantity,
          unit_price,
          discount,
          tax,
          line_total
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        `,
        [
          invoiceId,
          item.productId,
          item.subProductId,
          item.quantity,
          item.unitPrice,
          item.discount,
          item.tax,
          item.lineTotal,
        ]
      );

      const stockUpdate = await client.query(
        `
        UPDATE stock
        SET
          quantity = quantity - $1,
          updated_at = CURRENT_TIMESTAMP
        WHERE product_id = $2
          AND warehouse_id = $3
          AND quantity + 1e-9 >= $1
        RETURNING quantity
        `,
        [
          item.stockQuantity,
          item.productId,
          validWarehouseId,
        ]
      );

      if (stockUpdate.rows.length === 0) {
        throw new Error(
          `Stock changed while updating "${item.productName}". Please retry.`
        );
      }

      const runningResult = await client.query(
        `
        SELECT COALESCE(
          SUM(
            COALESCE(receive_quantity, 0) -
            COALESCE(issue_quantity, 0)
          ),
          0
        ) AS running_quantity
        FROM inventory_transactions
        WHERE product_id = $1
          AND location = $2
        `,
        [item.productId, warehouse.warehouse_name]
      );

      const oldQuantity =
        Number(runningResult.rows[0].running_quantity) || 0;

      const newQuantity = oldQuantity - item.stockQuantity;
      const issueAmount = item.stockQuantity * item.costPrice;

      await client.query(
        `
        INSERT INTO inventory_transactions (
          product_id,
          sub_product_id,
          transaction_date,
          transaction_type,
          transaction_number,
          location,
          uom,
          memo,
          transaction_rate,
          old_rate,
          actual_rate,
          new_rate,
          receive_quantity,
          receive_rate,
          receive_amount,
          issue_quantity,
          issue_rate,
          issue_amount,
          running_quantity
        )
        VALUES (
          $1, $2, COALESCE($3::DATE, CURRENT_DATE),
          'SALES INVOICE', $4, $5, $6, $7,
          $8, $8, $8, $8, 0, 0, 0, $9, $8, $10, $11
        )
        `,
        [
          item.productId,
          item.subProductId,
          validInvoiceDate,
          finalInvoiceNumber,
          warehouse.warehouse_name,
          item.inventoryUnit,
          item.subProductName
            ? `Updated sale of ${item.subProductName} to ${customer.customer_name}`
            : `Updated sale to ${customer.customer_name}`,
          item.costPrice,
          item.stockQuantity,
          issueAmount,
          newQuantity,
        ]
      );
    }

    // 9. Create the replacement sales journal.
    const receivableIds = [
      ...new Set(
        preparedItems.map((item) => item.receivableAccountId)
      ),
    ];

    const receivableAccountId =
      receivableIds.length === 1
        ? receivableIds[0]
        : ACCOUNTS.ACCOUNTS_RECEIVABLE;

    const salesJournalResult = await client.query(
      `
      INSERT INTO journal_entries (
        journal_number,
        journal_date,
        reference_type,
        reference_id,
        description,
        status
      )
      VALUES ($1, COALESCE($2::DATE, CURRENT_DATE),
        'SALES_INVOICE', $3, $4, 'POSTED')
      RETURNING journal_id
      `,
      [
        `SAL-JRN-${invoiceId}`,
        validInvoiceDate,
        invoiceId,
        `Updated sales invoice ${finalInvoiceNumber} to ${customer.customer_name}`,
      ]
    );

    const salesJournalId =
      salesJournalResult.rows[0].journal_id;

    await client.query(
      `
      INSERT INTO journal_entry_lines (
        journal_id,
        account_id,
        description,
        debit,
        credit,
        party_type,
        party_id
      )
      VALUES ($1, $2, $3, $4, 0, 'CUSTOMER', $5)
      `,
      [
        salesJournalId,
        receivableAccountId,
        `Receivable from ${customer.customer_name}`,
        totalAmount,
        validCustomerId,
      ]
    );

    const salesTotals = {};

    for (const item of preparedItems) {
      salesTotals[item.salesAccountId] =
        (salesTotals[item.salesAccountId] || 0) +
        item.lineTotal;
    }

    for (const [accountId, amount] of Object.entries(salesTotals)) {
      if (amount <= 0) continue;

      await client.query(
        `
        INSERT INTO journal_entry_lines (
          journal_id,
          account_id,
          description,
          debit,
          credit,
          party_type,
          party_id
        )
        VALUES ($1, $2, $3, 0, $4, NULL, NULL)
        `,
        [
          salesJournalId,
          Number(accountId),
          `Sales revenue - ${finalInvoiceNumber}`,
          amount,
        ]
      );
    }

    await client.query(
      `
      UPDATE chart_of_accounts
      SET current_balance = current_balance + $1,
          updated_at = CURRENT_TIMESTAMP
      WHERE account_id = $2
      `,
      [totalAmount, receivableAccountId]
    );

    for (const [accountId, amount] of Object.entries(salesTotals)) {
      if (amount <= 0) continue;

      await client.query(
        `
        UPDATE chart_of_accounts
        SET current_balance = current_balance + $1,
            updated_at = CURRENT_TIMESTAMP
        WHERE account_id = $2
        `,
        [amount, Number(accountId)]
      );
    }

    // 10. Create the replacement COGS journal.
    const totalCogs = preparedItems.reduce(
      (sum, item) => sum + item.cogsAmount,
      0
    );

    if (totalCogs > 0) {
      const cogsResult = await client.query(
        `
        INSERT INTO journal_entries (
          journal_number,
          journal_date,
          reference_type,
          reference_id,
          description,
          status
        )
        VALUES ($1, COALESCE($2::DATE, CURRENT_DATE),
          'SALES_COGS', $3, $4, 'POSTED')
        RETURNING journal_id
        `,
        [
          `COGS-JRN-${invoiceId}`,
          validInvoiceDate,
          invoiceId,
          `COGS for sales invoice ${finalInvoiceNumber}`,
        ]
      );

      const cogsJournalId = cogsResult.rows[0].journal_id;

      await client.query(
        `
        INSERT INTO journal_entry_lines (
          journal_id, account_id, description, debit, credit
        )
        VALUES ($1, $2, $3, $4, 0)
        `,
        [
          cogsJournalId,
          ACCOUNTS.COGS,
          `Cost of goods sold - ${finalInvoiceNumber}`,
          totalCogs,
        ]
      );

      await client.query(
        `
        INSERT INTO journal_entry_lines (
          journal_id, account_id, description, debit, credit
        )
        VALUES ($1, $2, $3, 0, $4)
        `,
        [
          cogsJournalId,
          ACCOUNTS.INVENTORY,
          `Inventory issued - ${finalInvoiceNumber}`,
          totalCogs,
        ]
      );

      await client.query(
        `
        UPDATE chart_of_accounts
        SET current_balance = current_balance + $1,
            updated_at = CURRENT_TIMESTAMP
        WHERE account_id = $2
        `,
        [totalCogs, ACCOUNTS.COGS]
      );

      await client.query(
        `
        UPDATE chart_of_accounts
        SET current_balance = current_balance - $1,
            updated_at = CURRENT_TIMESTAMP
        WHERE account_id = $2
        `,
        [totalCogs, ACCOUNTS.INVENTORY]
      );
    }

    await client.query("COMMIT");
    transactionStarted = false;

    return NextResponse.json({
      success: true,
      message:
        "Sales invoice updated successfully. Stock, inventory transactions, and accounting were updated.",
      invoice,
    });
  } catch (error) {
    if (transactionStarted) {
      try {
        await client.query("ROLLBACK");
      } catch (rollbackError) {
        console.error(
          "SALES INVOICE UPDATE ROLLBACK ERROR:",
          rollbackError
        );
      }
    }

    console.error("SALES INVOICE UPDATE ERROR:", error);

    return NextResponse.json(
      {
        success: false,
        message: error.message || "Failed to update sales invoice.",
      },
      { status: error.statusCode || 400 }
    );
  } finally {
    client.release();
  }
}
