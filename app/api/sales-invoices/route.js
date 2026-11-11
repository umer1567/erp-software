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

const ACCOUNTS = {
  INVENTORY: 7,
  ACCOUNTS_RECEIVABLE: 6,
  SALES: 13,
  COGS: 15,
};

export const dynamic = "force-dynamic";

// =========================================================
// GET: Fetch sales invoices, including Delivery Challan data.
// Manual invoices return delivery_challan_id = null.
// =========================================================

export async function GET() {
  try {
    const result = await pool.query(`
      SELECT
        si.invoice_id,
        si.invoice_number,
        si.delivery_challan_id,
        dc.transaction_number AS delivery_challan_number,
        si.customer_id,
        c.customer_code,
        c.customer_name,
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
      LEFT JOIN delivery_challans dc
        ON dc.delivery_challan_id = si.delivery_challan_id
      ORDER BY si.invoice_id DESC
    `);

    return NextResponse.json({
      success: true,
      invoices: result.rows,
    });
  } catch (error) {
    console.error("SALES INVOICES GET ERROR:", error);

    return NextResponse.json(
      {
        success: false,
        message: "Failed to load sales invoices.",
        error: error.message,
      },
      { status: 500 }
    );
  }
}

// =========================================================
// POST: Create a Sales Invoice.
//
// Manual invoice:
//   deliveryChallanId = null
//
// Invoice from Delivery Challan:
//   deliveryChallanId = existing approved challan ID
//
// Both workflows:
//   - Validate customer, warehouse and products.
//   - Deduct inventory.
//   - Create inventory transactions.
//   - Create sales and COGS journal entries.
//   - Optionally record a POS payment.
//   - Commit all changes in one transaction.
// =========================================================

export async function POST(request) {
  let client;
  let transactionStarted = false;

  try {
    client = await pool.connect();

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
      deliveryChallanId = null,
      receivedAmount = 0,
      accountId = null,
      paymentMethod = "CASH",
      referenceNumber = null,
    } = body;

    // -----------------------------------------------------
    // 1. Validate request fields.
    // -----------------------------------------------------

    const validCustomerId = integerId(
      customerId,
      "Customer"
    );

    const validWarehouseId = integerId(
      warehouseId,
      "Warehouse"
    );

    const parsedReceivedAmount = nonNegativeNumber(
      receivedAmount ?? 0,
      "Received amount"
    );

    let paymentAccountId = null;

    if (
      accountId !== null &&
      accountId !== undefined &&
      accountId !== ""
    ) {
      paymentAccountId = integerId(
        accountId,
        "Payment account"
      );
    }

    const normalizedPaymentMethod = String(
      paymentMethod || "CASH"
    )
      .trim()
      .toUpperCase();

    if (normalizedPaymentMethod.length > 50) {
      throw new Error("Payment method is too long.");
    }

    const normalizedReferenceNumber =
      referenceNumber === null ||
      referenceNumber === undefined ||
      String(referenceNumber).trim() === ""
        ? null
        : String(referenceNumber).trim();

    if (
      normalizedReferenceNumber &&
      normalizedReferenceNumber.length > 100
    ) {
      throw new Error(
        "Payment reference number is too long."
      );
    }

    if (
      parsedReceivedAmount > 0 &&
      !paymentAccountId
    ) {
      throw new Error(
        "Select a cash/bank account to record the received payment."
      );
    }

    let finalInvoiceNumber = invoiceNumber
      ? String(invoiceNumber).trim()
      : "";

    if (finalInvoiceNumber) {
      required(finalInvoiceNumber, "Invoice number");

      maxLength(
        finalInvoiceNumber,
        50,
        "Invoice number"
      );
    }

    const validInvoiceDate = invoiceDate
      ? validateDate(invoiceDate, "Invoice date")
      : null;

    if (!Array.isArray(items) || items.length === 0) {
      throw new Error(
        "At least one invoice item is required."
      );
    }

    if (items.length > 500) {
      throw new Error(
        "An invoice cannot contain more than 500 items."
      );
    }

    const invoiceDiscount = nonNegativeNumber(
      discount ?? 0,
      "Invoice discount"
    );

    const invoiceTax = nonNegativeNumber(
      tax ?? 0,
      "Invoice tax"
    );

    if (notes !== null && notes !== undefined) {
      maxLength(String(notes), 2000, "Notes");
    }

    let validDeliveryChallanId = null;

    if (
      deliveryChallanId !== null &&
      deliveryChallanId !== undefined &&
      deliveryChallanId !== ""
    ) {
      validDeliveryChallanId = integerId(
        deliveryChallanId,
        "Delivery Challan"
      );
    }

    // -----------------------------------------------------
    // 2. Begin database transaction.
    // -----------------------------------------------------

    await client.query("BEGIN");
    transactionStarted = true;

    // -----------------------------------------------------
    // 3. Validate and lock the Delivery Challan, if supplied.
    // -----------------------------------------------------

    let deliveryChallan = null;

    if (validDeliveryChallanId !== null) {
      const challanResult = await client.query(
        `
        SELECT
          dc.delivery_challan_id,
          dc.transaction_number,
          dc.customer_id,
          dc.warehouse_id,
          dc.status,
          dc.document_status
        FROM delivery_challans dc
        WHERE dc.delivery_challan_id = $1
        FOR UPDATE
        `,
        [validDeliveryChallanId]
      );

      if (challanResult.rows.length === 0) {
        throw new Error("Delivery Challan not found.");
      }

      deliveryChallan = challanResult.rows[0];

      if (
        String(deliveryChallan.status || "")
          .trim()
          .toUpperCase() !== "APPROVED"
      ) {
        throw new Error(
          "Only an approved Delivery Challan can be invoiced."
        );
      }

      if (
        Number(deliveryChallan.customer_id) !==
          validCustomerId ||
        Number(deliveryChallan.warehouse_id) !==
          validWarehouseId
      ) {
        throw new Error(
          "The Delivery Challan customer and warehouse must match the invoice."
        );
      }

      const documentStatus = String(
        deliveryChallan.document_status || ""
      )
        .trim()
        .toUpperCase();

      if (documentStatus === "INVOICED") {
        throw new Error(
          `Delivery Challan ${deliveryChallan.transaction_number} has already been invoiced.`
        );
      }

      const linkedInvoiceResult = await client.query(
        `
        SELECT
          invoice_id,
          invoice_number
        FROM sales_invoices
        WHERE delivery_challan_id = $1
        LIMIT 1
        `,
        [validDeliveryChallanId]
      );

      if (linkedInvoiceResult.rows.length > 0) {
        throw new Error(
          `Delivery Challan ${deliveryChallan.transaction_number} is already linked to invoice ${linkedInvoiceResult.rows[0].invoice_number}.`
        );
      }
    }

    // -----------------------------------------------------
    // 4. Validate customer.
    // -----------------------------------------------------

    const customerResult = await client.query(
      `
      SELECT
        customer_id,
        customer_name
      FROM customers
      WHERE customer_id = $1
        AND is_active = TRUE
      `,
      [validCustomerId]
    );

    if (customerResult.rows.length === 0) {
      throw new Error(
        "Customer not found or inactive."
      );
    }

    const customer = customerResult.rows[0];

    // -----------------------------------------------------
    // 5. Validate warehouse.
    // -----------------------------------------------------

    const warehouseResult = await client.query(
      `
      SELECT
        warehouse_id,
        warehouse_code,
        warehouse_name
      FROM warehouses
      WHERE warehouse_id = $1
        AND is_active = TRUE
      `,
      [validWarehouseId]
    );

    if (warehouseResult.rows.length === 0) {
      throw new Error(
        "Warehouse not found or inactive."
      );
    }

    const warehouse = warehouseResult.rows[0];

    // -----------------------------------------------------
    // 6. Validate products and prepare invoice lines.
    // -----------------------------------------------------

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

      const rawSubProductId = item.subProductId;

      const subProductId =
        rawSubProductId === null ||
        rawSubProductId === undefined ||
        rawSubProductId === ""
          ? null
          : integerId(
              rawSubProductId,
              "Sub-product"
            );

      const productResult = await client.query(
        `
        SELECT
          product_id,
          product_name,
          unit,
          cost_price,
          sale_price,
          sales_account_id,
          receivable_account_id,
          is_active
        FROM products
        WHERE product_id = $1
        `,
        [productId]
      );

      if (productResult.rows.length === 0) {
        throw new Error(
          `Product ${productId} not found.`
        );
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
        const subProductResult = await client.query(
          `
          SELECT
            sub_product_id,
            product_id,
            sub_product_name,
            unit,
            cost_price,
            sale_price,
            is_active,
            units_per_parent
          FROM sub_products
          WHERE sub_product_id = $1
            AND product_id = $2
          `,
          [subProductId, productId]
        );

        if (subProductResult.rows.length === 0) {
          throw new Error(
            `Sub-product ${subProductId} does not belong to "${product.product_name}".`
          );
        }

        subProduct = subProductResult.rows[0];

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
            `Configure a valid units-per-parent conversion for "${subProduct.sub_product_name}" before selling it.`
          );
        }
      }

      // Inventory quantities are stored in the parent product unit.
      const stockQuantity =
        subProduct !== null
          ? quantity / unitsPerParent
          : quantity;

      // Use the same line-total convention as the submitted invoice.
      const lineTotal =
        quantity * unitPrice -
        itemDiscount +
        itemTax;

      if (
        !Number.isFinite(lineTotal) ||
        lineTotal < 0
      ) {
        throw new Error(
          `Invalid total for "${subProduct?.sub_product_name || product.product_name}".`
        );
      }

      const costPrice =
        Number(product.cost_price) || 0;

      const cogsAmount =
        stockQuantity * costPrice;

      subtotal += lineTotal;

      preparedItems.push({
        productId,
        subProductId,
        productName: product.product_name,
        subProductName:
          subProduct?.sub_product_name || null,
        unit:
          subProduct?.unit ||
          product.unit ||
          "PCS",
        inventoryUnit: product.unit || "PCS",
        quantity,
        stockQuantity,
        unitsPerParent,
        unitPrice,
        costPrice,
        cogsAmount,
        discount: itemDiscount,
        tax: itemTax,
        lineTotal,
        salesAccountId: product.sales_account_id
          ? Number(product.sales_account_id)
          : ACCOUNTS.SALES,
        receivableAccountId:
          product.receivable_account_id
            ? Number(product.receivable_account_id)
            : ACCOUNTS.ACCOUNTS_RECEIVABLE,
      });
    }

    const totalAmount =
      subtotal -
      invoiceDiscount +
      invoiceTax;

    if (
      !Number.isFinite(totalAmount) ||
      totalAmount <= 0
    ) {
      throw new Error(
        "Invoice total must be greater than zero. Please check the prices, discounts, and tax."
      );
    }

    const paymentAmount = Math.min(
      parsedReceivedAmount,
      totalAmount
    );

    if (paymentAmount > 0 && !paymentAccountId) {
      throw new Error(
        "Select a cash/bank account to record the received payment."
      );
    }

    if (!finalInvoiceNumber) {
      finalInvoiceNumber = `INV-${Date.now()}`;
    }

    const existingInvoice = await client.query(
      `
      SELECT invoice_id
      FROM sales_invoices
      WHERE invoice_number = $1
      `,
      [finalInvoiceNumber]
    );

    if (existingInvoice.rows.length > 0) {
      throw new Error(
        "Invoice number already exists."
      );
    }

    // -----------------------------------------------------
    // 7. Aggregate stock requirements and lock stock rows.
    // -----------------------------------------------------

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
        SELECT
          stock_id,
          quantity
        FROM stock
        WHERE product_id = $1
          AND warehouse_id = $2
        FOR UPDATE
        `,
        [productId, validWarehouseId]
      );

      const availableStock =
        stockResult.rows.length > 0
          ? Number(stockResult.rows[0].quantity)
          : 0;

      if (
        !Number.isFinite(availableStock) ||
        availableStock + 1e-9 < requiredQuantity
      ) {
        const item = preparedItems.find(
          (prepared) => prepared.productId === productId
        );

        throw new Error(
          `Insufficient stock for "${item?.productName || productId}". Available: ${availableStock}, Required: ${requiredQuantity}.`
        );
      }
    }

    // -----------------------------------------------------
    // 8. Create invoice header.
    // -----------------------------------------------------

    const invoiceResult = await client.query(
      `
      INSERT INTO sales_invoices (
        invoice_number,
        customer_id,
        warehouse_id,
        invoice_date,
        subtotal,
        discount,
        tax,
        total_amount,
        paid_amount,
        balance_amount,
        status,
        notes,
        delivery_challan_id
      )
      VALUES (
        $1,
        $2,
        $3,
        COALESCE($4::DATE, CURRENT_DATE),
        $5,
        $6,
        $7,
        $8,
        0,
        $8,
        'UNPAID',
        $9,
        $10
      )
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
        validDeliveryChallanId,
      ]
    );

    const invoice = invoiceResult.rows[0];

    // -----------------------------------------------------
    // 9. Insert invoice items, deduct stock, and record
    //    inventory transactions.
    // -----------------------------------------------------

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
          invoice.invoice_id,
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
          `Stock changed while processing "${item.productName}". Please retry the sale.`
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
        [
          item.productId,
          warehouse.warehouse_name,
        ]
      );

      const oldQuantity =
        Number(runningResult.rows[0].running_quantity) || 0;

      const newQuantity =
        oldQuantity - item.stockQuantity;

      const issueAmount =
        item.stockQuantity * item.costPrice;

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
          $1,
          $2,
          COALESCE($3::DATE, CURRENT_DATE),
          'SALES INVOICE',
          $4,
          $5,
          $6,
          $7,
          $8,
          $8,
          $8,
          $8,
          0,
          0,
          0,
          $9,
          $8,
          $10,
          $11
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
            ? `Sale of ${item.subProductName} to ${customer.customer_name}`
            : `Sale to ${customer.customer_name}`,
          item.costPrice,
          item.stockQuantity,
          issueAmount,
          newQuantity,
        ]
      );
    }

    // -----------------------------------------------------
    // 10. Sales journal entry.
    //     Debit receivables; credit sales revenue.
    // -----------------------------------------------------

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
      VALUES (
        $1,
        COALESCE($2::DATE, CURRENT_DATE),
        'SALES_INVOICE',
        $3,
        $4,
        'POSTED'
      )
      RETURNING journal_id
      `,
      [
        `SAL-JRN-${invoice.invoice_id}`,
        validInvoiceDate,
        invoice.invoice_id,
        `Sales invoice ${finalInvoiceNumber} to ${customer.customer_name}`,
      ]
    );

    const salesJournalId =
      salesJournalResult.rows[0].journal_id;

    const receivableAccountIds = [
      ...new Set(
        preparedItems.map(
          (item) => item.receivableAccountId
        )
      ),
    ];

    const receivableAccountId =
      receivableAccountIds.length === 1
        ? receivableAccountIds[0]
        : ACCOUNTS.ACCOUNTS_RECEIVABLE;

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
      const salesAccountId = item.salesAccountId;

      salesTotals[salesAccountId] =
        (salesTotals[salesAccountId] || 0) +
        item.lineTotal;
    }

    for (const [salesAccountId, amount] of Object.entries(salesTotals)) {
      if (amount <= 0) {
        delete salesTotals[salesAccountId];
      }
    }

    if (Object.keys(salesTotals).length === 0) {
      throw new Error(
        "No positive sales revenue amount is available for accounting."
      );
    }

    for (const [salesAccountId, amount] of Object.entries(salesTotals)) {
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
          Number(salesAccountId),
          `Sales revenue - ${finalInvoiceNumber}`,
          amount,
        ]
      );
    }

    await client.query(
      `
      UPDATE chart_of_accounts
      SET
        current_balance = current_balance + $1,
        updated_at = CURRENT_TIMESTAMP
      WHERE account_id = $2
      `,
      [
        totalAmount,
        receivableAccountId,
      ]
    );

    for (const [salesAccountId, amount] of Object.entries(salesTotals)) {
      await client.query(
        `
        UPDATE chart_of_accounts
        SET
          current_balance = current_balance + $1,
          updated_at = CURRENT_TIMESTAMP
        WHERE account_id = $2
        `,
        [
          amount,
          Number(salesAccountId),
        ]
      );
    }

    // -----------------------------------------------------
    // 11. COGS journal entry.
    //     Debit COGS; credit inventory.
    // -----------------------------------------------------

    const totalCogs = preparedItems.reduce(
      (sum, item) => sum + item.cogsAmount,
      0
    );

    if (totalCogs > 0) {
      const cogsJournalResult = await client.query(
        `
        INSERT INTO journal_entries (
          journal_number,
          journal_date,
          reference_type,
          reference_id,
          description,
          status
        )
        VALUES (
          $1,
          COALESCE($2::DATE, CURRENT_DATE),
          'SALES_COGS',
          $3,
          $4,
          'POSTED'
        )
        RETURNING journal_id
        `,
        [
          `COGS-JRN-${invoice.invoice_id}`,
          validInvoiceDate,
          invoice.invoice_id,
          `COGS for sales invoice ${finalInvoiceNumber}`,
        ]
      );

      const cogsJournalId =
        cogsJournalResult.rows[0].journal_id;

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
        VALUES ($1, $2, $3, $4, 0, NULL, NULL)
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
          cogsJournalId,
          ACCOUNTS.INVENTORY,
          `Inventory issued - ${finalInvoiceNumber}`,
          totalCogs,
        ]
      );

      await client.query(
        `
        UPDATE chart_of_accounts
        SET
          current_balance = current_balance + $1,
          updated_at = CURRENT_TIMESTAMP
        WHERE account_id = $2
        `,
        [
          totalCogs,
          ACCOUNTS.COGS,
        ]
      );

      await client.query(
        `
        UPDATE chart_of_accounts
        SET
          current_balance = current_balance - $1,
          updated_at = CURRENT_TIMESTAMP
        WHERE account_id = $2
        `,
        [
          totalCogs,
          ACCOUNTS.INVENTORY,
        ]
      );
    }

    // -----------------------------------------------------
    // 12. Record optional POS payment.
    // -----------------------------------------------------

    let recordedPayment = null;
    let changeAmount = 0;

    if (paymentAmount > 0) {
      const paymentAccountResult = await client.query(
        `
        SELECT
          account_id,
          account_code,
          account_name
        FROM chart_of_accounts
        WHERE account_id = $1
          AND is_active = TRUE
          AND is_cash_bank = TRUE
          AND is_group = FALSE
        FOR UPDATE
        `,
        [paymentAccountId]
      );

      if (paymentAccountResult.rows.length === 0) {
        throw new Error(
          "The selected account must be an active, non-group cash/bank ledger account."
        );
      }

      const paymentAccount =
        paymentAccountResult.rows[0];

      const paymentNumber =
        `POS-PAY-${invoice.invoice_id}`;

      const paymentResult = await client.query(
        `
        INSERT INTO sales_payments (
          payment_number,
          invoice_id,
          customer_id,
          payment_date,
          amount,
          payment_method,
          reference_number,
          notes
        )
        VALUES (
          $1,
          $2,
          $3,
          COALESCE($4::DATE, CURRENT_DATE),
          $5,
          $6,
          $7,
          $8
        )
        RETURNING *
        `,
        [
          paymentNumber,
          invoice.invoice_id,
          validCustomerId,
          validInvoiceDate,
          paymentAmount,
          normalizedPaymentMethod,
          normalizedReferenceNumber,
          `POS payment for invoice ${finalInvoiceNumber}`,
        ]
      );

      const payment = paymentResult.rows[0];

      const paymentJournalResult = await client.query(
        `
        INSERT INTO journal_entries (
          journal_number,
          journal_date,
          reference_type,
          reference_id,
          description,
          status
        )
        VALUES (
          $1,
          COALESCE($2::DATE, CURRENT_DATE),
          'SALES_PAYMENT',
          $3,
          $4,
          'POSTED'
        )
        RETURNING journal_id
        `,
        [
          `PAY-JRN-${payment.payment_id}`,
          validInvoiceDate,
          payment.payment_id,
          `POS payment for sales invoice ${finalInvoiceNumber}`,
        ]
      );

      const paymentJournalId =
        paymentJournalResult.rows[0].journal_id;

      // Debit cash/bank.
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
          paymentJournalId,
          paymentAccount.account_id,
          `POS receipt - ${finalInvoiceNumber}`,
          paymentAmount,
          validCustomerId,
        ]
      );

      // Credit accounts receivable.
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
        VALUES ($1, $2, $3, 0, $4, 'CUSTOMER', $5)
        `,
        [
          paymentJournalId,
          receivableAccountId,
          `Receivable settled - ${finalInvoiceNumber}`,
          paymentAmount,
          validCustomerId,
        ]
      );

      await client.query(
        `
        UPDATE chart_of_accounts
        SET
          current_balance = current_balance + $1,
          updated_at = CURRENT_TIMESTAMP
        WHERE account_id = $2
        `,
        [
          paymentAmount,
          paymentAccount.account_id,
        ]
      );

      await client.query(
        `
        UPDATE chart_of_accounts
        SET
          current_balance = current_balance - $1,
          updated_at = CURRENT_TIMESTAMP
        WHERE account_id = $2
        `,
        [
          paymentAmount,
          receivableAccountId,
        ]
      );

      const newPaidAmount = paymentAmount;

      const newBalanceAmount = Math.max(
        0,
        totalAmount - newPaidAmount
      );

      const newInvoiceStatus =
        newBalanceAmount <= 0.000001
          ? "PAID"
          : "PARTIAL";

      const updatedInvoiceResult = await client.query(
        `
        UPDATE sales_invoices
        SET
          paid_amount = $1,
          balance_amount = $2,
          status = $3,
          updated_at = CURRENT_TIMESTAMP
        WHERE invoice_id = $4
        RETURNING *
        `,
        [
          newPaidAmount,
          newBalanceAmount,
          newInvoiceStatus,
          invoice.invoice_id,
        ]
      );

      Object.assign(invoice, updatedInvoiceResult.rows[0]);

      changeAmount = Math.max(
        0,
        parsedReceivedAmount - paymentAmount
      );

      recordedPayment = {
        paymentId: payment.payment_id,
        paymentNumber: payment.payment_number,
        amount: Number(payment.amount),
        paymentMethod: payment.payment_method,
        accountId: paymentAccount.account_id,
        accountCode: paymentAccount.account_code,
        accountName: paymentAccount.account_name,
        referenceNumber: payment.reference_number,
      };
    }

    // -----------------------------------------------------
    // 13. Mark linked Delivery Challan as Invoiced.
    // -----------------------------------------------------

    if (validDeliveryChallanId !== null) {
      const updatedChallanResult = await client.query(
        `
        UPDATE delivery_challans
        SET document_status = 'Invoiced'
        WHERE delivery_challan_id = $1
          AND UPPER(COALESCE(document_status, '')) <> 'INVOICED'
        RETURNING
          delivery_challan_id,
          transaction_number,
          document_status
        `,
        [validDeliveryChallanId]
      );

      if (updatedChallanResult.rows.length === 0) {
        throw new Error(
          "The Delivery Challan could not be marked as invoiced. It may already have been invoiced."
        );
      }

      invoice.delivery_challan_id =
        updatedChallanResult.rows[0].delivery_challan_id;

      invoice.delivery_challan_number =
        updatedChallanResult.rows[0].transaction_number;
    } else {
      invoice.delivery_challan_id = null;
      invoice.delivery_challan_number = null;
    }

    // -----------------------------------------------------
    // 14. Commit transaction.
    // -----------------------------------------------------

    await client.query("COMMIT");
    transactionStarted = false;

    return NextResponse.json(
      {
        success: true,
        message:
          paymentAmount > 0
            ? "Sales invoice created successfully. Stock, inventory transactions, accounting, and POS payment were recorded."
            : "Sales invoice created successfully. Stock, inventory transactions, and accounting were updated.",
        invoice,
        payment: recordedPayment,
        receivedAmount: parsedReceivedAmount,
        changeAmount,
      },
      { status: 201 }
    );
  } catch (error) {
    if (client && transactionStarted) {
      try {
        await client.query("ROLLBACK");
      } catch (rollbackError) {
        console.error(
          "SALES INVOICE ROLLBACK ERROR:",
          rollbackError
        );
      }
    }

    console.error("SALES INVOICES POST ERROR:", error);

    if (error.code === "23505") {
      return NextResponse.json(
        {
          success: false,
          message:
            "Invoice number, payment number, or Delivery Challan link already exists.",
        },
        { status: 409 }
      );
    }

    return NextResponse.json(
      {
        success: false,
        message:
          error.message ||
          "Failed to create sales invoice.",
      },
      { status: 400 }
    );
  } finally {
    if (client) {
      client.release();
    }
  }
}