import { NextResponse } from "next/server";
import pool from "@/lib/db";

const ACCOUNTS = {
  INVENTORY: 7,
  ACCOUNTS_PAYABLE: 9,
};

// ============================================================
// GET PURCHASES
// ============================================================

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const purchaseId = searchParams.get("id");

    // --------------------------------------------------------
    // SINGLE PURCHASE
    // --------------------------------------------------------

    if (purchaseId) {
      const purchaseResult = await pool.query(
        `
        SELECT
          p.purchase_id,
          p.purchase_number,

          p.supplier_id,
          s.supplier_code,
          s.supplier_name,

          p.warehouse_id,
          w.warehouse_code,
          w.warehouse_name,

          p.purchase_date,
          p.subtotal,
          p.discount,
          p.tax,
          p.total_amount,
          p.paid_amount,
          p.balance_amount,
          p.status,
          p.notes,
          p.created_at,
          p.updated_at

        FROM purchases p

        INNER JOIN suppliers s
          ON s.supplier_id = p.supplier_id

        INNER JOIN warehouses w
          ON w.warehouse_id = p.warehouse_id

        WHERE p.purchase_id = $1
        `,
        [purchaseId]
      );

      if (purchaseResult.rows.length === 0) {
        return NextResponse.json(
          {
            success: false,
            message: "Purchase not found.",
          },
          { status: 404 }
        );
      }

      const purchase = purchaseResult.rows[0];

      const itemsResult = await pool.query(
        `
        SELECT
          pi.purchase_item_id,
          pi.purchase_id,
          pi.product_id,
          pr.sku,
          pr.product_name,
          pi.quantity,
          pi.unit_cost,
          pi.discount,
          pi.tax,
          pi.line_total,
          pr.unit
        FROM purchase_items pi
        INNER JOIN products pr
          ON pr.product_id = pi.product_id
        WHERE pi.purchase_id = $1
        ORDER BY pi.purchase_item_id ASC
        `,
        [purchaseId]
      );

      purchase.items = itemsResult.rows;

      return NextResponse.json({
        success: true,
        purchase,
      });
    }

    // --------------------------------------------------------
    // ALL PURCHASES
    // --------------------------------------------------------

    const result = await pool.query(`
      SELECT
        p.purchase_id,
        p.purchase_number,

        p.supplier_id,
        s.supplier_code,
        s.supplier_name,

        p.warehouse_id,
        w.warehouse_code,
        w.warehouse_name,

        p.purchase_date,
        p.subtotal,
        p.discount,
        p.tax,
        p.total_amount,
        p.paid_amount,
        p.balance_amount,
        p.status,
        p.notes,
        p.created_at,
        p.updated_at

      FROM purchases p

      INNER JOIN suppliers s
        ON s.supplier_id = p.supplier_id

      INNER JOIN warehouses w
        ON w.warehouse_id = p.warehouse_id

      ORDER BY p.purchase_id DESC
    `);

    return NextResponse.json({
      success: true,
      purchases: result.rows,
    });
  } catch (error) {
    console.error("PURCHASES GET ERROR:", error);

    return NextResponse.json(
      {
        success: false,
        message: "Failed to load purchases.",
        error: error.message,
      },
      { status: 500 }
    );
  }
}

// ============================================================
// POST - CREATE PURCHASE
// ============================================================

export async function POST(request) {
  const client = await pool.connect();

  try {
    const body = await request.json();

    const {
      purchaseNumber,
      supplierId,
      warehouseId,
      purchaseDate,
      discount,
      tax,
      notes,
      items,
    } = body;

    // ========================================================
    // BASIC VALIDATION
    // ========================================================

    if (!supplierId) {
      return NextResponse.json(
        {
          success: false,
          message: "Supplier is required.",
        },
        { status: 400 }
      );
    }

    if (!warehouseId) {
      return NextResponse.json(
        {
          success: false,
          message: "Warehouse is required.",
        },
        { status: 400 }
      );
    }

    if (!Array.isArray(items) || items.length === 0) {
      return NextResponse.json(
        {
          success: false,
          message: "At least one purchase item is required.",
        },
        { status: 400 }
      );
    }

    await client.query("BEGIN");

    // ========================================================
    // SUPPLIER
    // ========================================================

    const supplierResult = await client.query(
      `
      SELECT
        supplier_id,
        supplier_code,
        supplier_name
      FROM suppliers
      WHERE supplier_id = $1
        AND is_active = TRUE
      `,
      [supplierId]
    );

    if (supplierResult.rows.length === 0) {
      throw new Error("Supplier not found or inactive.");
    }

    const supplier = supplierResult.rows[0];

    // ========================================================
    // WAREHOUSE
    // ========================================================

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
      [warehouseId]
    );

    if (warehouseResult.rows.length === 0) {
      throw new Error("Warehouse not found or inactive.");
    }

    const warehouse = warehouseResult.rows[0];

    // ========================================================
    // PREPARE ITEMS
    // ========================================================

    let subtotal = 0;

    const preparedItems = [];

    for (const item of items) {
      const productId = Number(item.productId);
      const quantity = Number(item.quantity);
      const unitCost = Number(item.unitCost) || 0;
      const itemDiscount = Number(item.discount) || 0;
      const itemTax = Number(item.tax) || 0;

      if (!productId) {
        throw new Error("Invalid product selected.");
      }

      if (!Number.isFinite(quantity) || quantity <= 0) {
        throw new Error(
          "Product quantity must be greater than zero."
        );
      }

      if (!Number.isFinite(unitCost) || unitCost < 0) {
        throw new Error(
          "Purchase cost cannot be negative."
        );
      }

      if (itemDiscount < 0 || itemTax < 0) {
        throw new Error(
          "Discount and tax cannot be negative."
        );
      }

      const productResult = await client.query(
        `
        SELECT
          product_id,
          product_name,
          unit,
          cost_price,
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

      const lineTotal =
        quantity * unitCost -
        itemDiscount +
        itemTax;

      if (lineTotal < 0) {
        throw new Error(
          `Invalid total for product "${product.product_name}".`
        );
      }

      subtotal += lineTotal;

      preparedItems.push({
        productId,
        productName: product.product_name,
        unit: product.unit || "PCS",
        quantity,
        unitCost,
        discount: itemDiscount,
        tax: itemTax,
        lineTotal,
      });
    }

    // ========================================================
    // TOTAL
    // ========================================================

    const purchaseDiscount =
      Number(discount) || 0;

    const purchaseTax =
      Number(tax) || 0;

    if (
      purchaseDiscount < 0 ||
      purchaseTax < 0
    ) {
      throw new Error(
        "Discount and tax cannot be negative."
      );
    }

    const totalAmount =
      subtotal -
      purchaseDiscount +
      purchaseTax;

    if (totalAmount < 0) {
      throw new Error(
        "Purchase total cannot be negative."
      );
    }

    // ========================================================
    // PURCHASE NUMBER
    // ========================================================

    let finalPurchaseNumber =
      purchaseNumber?.trim();

    if (!finalPurchaseNumber) {
      finalPurchaseNumber =
        `PUR-${Date.now()}`;
    }

    const existingPurchase =
      await client.query(
        `
        SELECT purchase_id
        FROM purchases
        WHERE purchase_number = $1
        `,
        [finalPurchaseNumber]
      );

    if (existingPurchase.rows.length > 0) {
      throw new Error(
        "Purchase number already exists."
      );
    }

    // ========================================================
    // CREATE PURCHASE
    // ========================================================

    const purchaseResult =
      await client.query(
        `
        INSERT INTO purchases (
          purchase_number,
          supplier_id,
          warehouse_id,
          purchase_date,
          subtotal,
          discount,
          tax,
          total_amount,
          paid_amount,
          balance_amount,
          status,
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
          $8,
          0,
          $8,
          'UNPAID',
          $9
        )
        RETURNING *
        `,
        [
          finalPurchaseNumber,
          supplierId,
          warehouseId,
          purchaseDate || null,
          subtotal,
          purchaseDiscount,
          purchaseTax,
          totalAmount,
          notes || null,
        ]
      );

    const purchase =
      purchaseResult.rows[0];

    // ========================================================
    // INSERT ITEMS + STOCK + INVENTORY
    // ========================================================

    for (const item of preparedItems) {
      await client.query(
        `
        INSERT INTO purchase_items (
          purchase_id,
          product_id,
          quantity,
          unit_cost,
          discount,
          tax,
          line_total
        )
        VALUES (
          $1,
          $2,
          $3,
          $4,
          $5,
          $6,
          $7
        )
        `,
        [
          purchase.purchase_id,
          item.productId,
          item.quantity,
          item.unitCost,
          item.discount,
          item.tax,
          item.lineTotal,
        ]
      );

      const stockResult =
        await client.query(
          `
          SELECT
            stock_id,
            quantity
          FROM stock
          WHERE product_id = $1
            AND warehouse_id = $2
          FOR UPDATE
          `,
          [
            item.productId,
            warehouseId,
          ]
        );

      if (stockResult.rows.length > 0) {
        await client.query(
          `
          UPDATE stock
          SET
            quantity = quantity + $1,
            updated_at = CURRENT_TIMESTAMP
          WHERE product_id = $2
            AND warehouse_id = $3
          `,
          [
            item.quantity,
            item.productId,
            warehouseId,
          ]
        );
      } else {
        await client.query(
          `
          INSERT INTO stock (
            product_id,
            warehouse_id,
            quantity
          )
          VALUES ($1, $2, $3)
          `,
          [
            item.productId,
            warehouseId,
            item.quantity,
          ]
        );
      }

      const runningResult =
        await client.query(
          `
          SELECT
            COALESCE(
              SUM(
                COALESCE(receive_quantity, 0)
                -
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
        Number(
          runningResult.rows[0]
            .running_quantity
        ) || 0;

      const newQuantity =
        oldQuantity + item.quantity;

      const receiveAmount =
        item.quantity * item.unitCost;

      await client.query(
        `
        INSERT INTO inventory_transactions (
          product_id,
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
          COALESCE($2::DATE, CURRENT_DATE),
          'VENDOR BILL',
          $3,
          $4,
          $5,
          $6,
          $7,
          $7,
          $7,
          $7,
          $8,
          $7,
          $9,
          0,
          0,
          0,
          $10
        )
        `,
        [
          item.productId,
          purchaseDate || null,
          finalPurchaseNumber,
          warehouse.warehouse_name,
          item.unit,
          `Purchase from ${supplier.supplier_name}`,
          item.unitCost,
          item.quantity,
          receiveAmount,
          newQuantity,
        ]
      );
    }

    // ========================================================
    // ACCOUNTING JOURNAL
    // Dr Inventory
    // Cr Accounts Payable
    // ========================================================

    const journalNumber =
      `PUR-JRN-${purchase.purchase_id}`;

    const journalResult =
      await client.query(
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
          'PURCHASE',
          $3,
          $4,
          'POSTED'
        )
        RETURNING journal_id
        `,
        [
          journalNumber,
          purchaseDate || null,
          purchase.purchase_id,
          `Purchase ${finalPurchaseNumber} from ${supplier.supplier_name}`,
        ]
      );

    const journalId =
      journalResult.rows[0]
        .journal_id;

    // Inventory Debit

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
      VALUES (
        $1,
        $2,
        $3,
        $4,
        0,
        NULL,
        NULL
      )
      `,
      [
        journalId,
        ACCOUNTS.INVENTORY,
        `Inventory received from ${supplier.supplier_name}`,
        totalAmount,
      ]
    );

    // Accounts Payable Credit

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
      VALUES (
        $1,
        $2,
        $3,
        0,
        $4,
        'SUPPLIER',
        $5
      )
      `,
      [
        journalId,
        ACCOUNTS.ACCOUNTS_PAYABLE,
        `Payable to ${supplier.supplier_name}`,
        totalAmount,
        supplierId,
      ]
    );

    // ========================================================
    // ACCOUNT BALANCES
    // ========================================================

    await client.query(
      `
      UPDATE chart_of_accounts
      SET
        current_balance =
          current_balance + $1,
        updated_at = CURRENT_TIMESTAMP
      WHERE account_id = $2
      `,
      [
        totalAmount,
        ACCOUNTS.INVENTORY,
      ]
    );

    await client.query(
      `
      UPDATE chart_of_accounts
      SET
        current_balance =
          current_balance + $1,
        updated_at = CURRENT_TIMESTAMP
      WHERE account_id = $2
      `,
      [
        totalAmount,
        ACCOUNTS.ACCOUNTS_PAYABLE,
      ]
    );

    await client.query("COMMIT");

    // ========================================================
    // RETURN COMPLETE PURCHASE
    // ========================================================

    const completePurchaseResult =
      await pool.query(
        `
        SELECT
          p.purchase_id,
          p.purchase_number,
          p.supplier_id,
          s.supplier_code,
          s.supplier_name,
          p.warehouse_id,
          w.warehouse_code,
          w.warehouse_name,
          p.purchase_date,
          p.subtotal,
          p.discount,
          p.tax,
          p.total_amount,
          p.paid_amount,
          p.balance_amount,
          p.status,
          p.notes,
          p.created_at,
          p.updated_at
        FROM purchases p
        INNER JOIN suppliers s
          ON s.supplier_id = p.supplier_id
        INNER JOIN warehouses w
          ON w.warehouse_id = p.warehouse_id
        WHERE p.purchase_id = $1
        `,
        [purchase.purchase_id]
      );

    const completePurchase =
      completePurchaseResult.rows[0];

    const itemsResult =
      await pool.query(
        `
        SELECT
          pi.purchase_item_id,
          pi.purchase_id,
          pi.product_id,
          pr.sku,
          pr.product_name,
          pi.quantity,
          pi.unit_cost,
          pi.discount,
          pi.tax,
          pi.line_total,
          pr.unit
        FROM purchase_items pi
        INNER JOIN products pr
          ON pr.product_id = pi.product_id
        WHERE pi.purchase_id = $1
        ORDER BY pi.purchase_item_id ASC
        `,
        [purchase.purchase_id]
      );

    completePurchase.items =
      itemsResult.rows;

    return NextResponse.json(
      {
        success: true,
        message:
          "Purchase created successfully. Stock, Items Ledger and Accounting Ledger updated.",
        purchase:
          completePurchase,
      },
      { status: 201 }
    );
  } catch (error) {
    try {
      await client.query("ROLLBACK");
    } catch {}

    console.error(
      "PURCHASE POST ERROR:",
      error
    );

    if (error.code === "23505") {
      return NextResponse.json(
        {
          success: false,
          message:
            "Purchase number already exists.",
        },
        { status: 409 }
      );
    }

    return NextResponse.json(
      {
        success: false,
        message:
          error.message ||
          "Failed to create purchase.",
      },
      { status: 500 }
    );
  } finally {
    client.release();
  }
}

// ============================================================
// PUT - EDIT PURCHASE
// ============================================================

export async function PUT(request) {
  const client = await pool.connect();

  try {
    const body = await request.json();

    const {
      purchaseId,
      purchaseNumber,
      supplierId,
      warehouseId,
      purchaseDate,
      discount,
      tax,
      notes,
      items,
    } = body;

    // ========================================================
    // VALIDATION
    // ========================================================

    if (!purchaseId) {
      return NextResponse.json(
        {
          success: false,
          message: "Purchase ID is required.",
        },
        { status: 400 }
      );
    }

    if (!supplierId) {
      return NextResponse.json(
        {
          success: false,
          message: "Supplier is required.",
        },
        { status: 400 }
      );
    }

    if (!warehouseId) {
      return NextResponse.json(
        {
          success: false,
          message: "Warehouse is required.",
        },
        { status: 400 }
      );
    }

    if (!Array.isArray(items) || items.length === 0) {
      return NextResponse.json(
        {
          success: false,
          message: "At least one purchase item is required.",
        },
        { status: 400 }
      );
    }

    await client.query("BEGIN");

    // ========================================================
    // LOCK OLD PURCHASE
    // ========================================================

    const oldPurchaseResult =
      await client.query(
        `
        SELECT *
        FROM purchases
        WHERE purchase_id = $1
        FOR UPDATE
        `,
        [purchaseId]
      );

    if (oldPurchaseResult.rows.length === 0) {
      throw new Error(
        "Purchase not found."
      );
    }

    const oldPurchase =
      oldPurchaseResult.rows[0];

    // ========================================================
    // PURCHASE NUMBER
    // ========================================================

    let finalPurchaseNumber =
      purchaseNumber?.trim();

    if (!finalPurchaseNumber) {
      finalPurchaseNumber =
        oldPurchase.purchase_number;
    }

    const duplicateResult =
      await client.query(
        `
        SELECT purchase_id
        FROM purchases
        WHERE purchase_number = $1
          AND purchase_id <> $2
        `,
        [
          finalPurchaseNumber,
          purchaseId,
        ]
      );

    if (duplicateResult.rows.length > 0) {
      throw new Error(
        "Purchase number already exists."
      );
    }

    // ========================================================
    // NEW SUPPLIER
    // ========================================================

    const supplierResult =
      await client.query(
        `
        SELECT
          supplier_id,
          supplier_code,
          supplier_name
        FROM suppliers
        WHERE supplier_id = $1
          AND is_active = TRUE
        `,
        [supplierId]
      );

    if (supplierResult.rows.length === 0) {
      throw new Error(
        "Supplier not found or inactive."
      );
    }

    const supplier =
      supplierResult.rows[0];

    // ========================================================
    // NEW WAREHOUSE
    // ========================================================

    const warehouseResult =
      await client.query(
        `
        SELECT
          warehouse_id,
          warehouse_code,
          warehouse_name
        FROM warehouses
        WHERE warehouse_id = $1
          AND is_active = TRUE
        `,
        [warehouseId]
      );

    if (warehouseResult.rows.length === 0) {
      throw new Error(
        "Warehouse not found or inactive."
      );
    }

    const warehouse =
      warehouseResult.rows[0];

    // ========================================================
    // OLD PURCHASE ITEMS
    // ========================================================

    const oldItemsResult =
      await client.query(
        `
        SELECT
          pi.*,
          pr.product_name,
          pr.unit
        FROM purchase_items pi
        INNER JOIN products pr
          ON pr.product_id = pi.product_id
        WHERE pi.purchase_id = $1
        `,
        [purchaseId]
      );

    const oldItems =
      oldItemsResult.rows;

    // ========================================================
    // PREPARE NEW ITEMS
    // ========================================================

    let subtotal = 0;

    const preparedItems = [];

    for (const item of items) {
      const productId =
        Number(item.productId);

      const quantity =
        Number(item.quantity);

      const unitCost =
        Number(item.unitCost) || 0;

      const itemDiscount =
        Number(item.discount) || 0;

      const itemTax =
        Number(item.tax) || 0;

      if (!productId) {
        throw new Error(
          "Invalid product selected."
        );
      }

      if (
        !Number.isFinite(quantity) ||
        quantity <= 0
      ) {
        throw new Error(
          "Product quantity must be greater than zero."
        );
      }

      if (
        !Number.isFinite(unitCost) ||
        unitCost < 0
      ) {
        throw new Error(
          "Purchase cost cannot be negative."
        );
      }

      if (
        itemDiscount < 0 ||
        itemTax < 0
      ) {
        throw new Error(
          "Discount and tax cannot be negative."
        );
      }

      const productResult =
        await client.query(
          `
          SELECT
            product_id,
            product_name,
            unit,
            cost_price,
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

      const product =
        productResult.rows[0];

      if (!product.is_active) {
        throw new Error(
          `Product "${product.product_name}" is inactive.`
        );
      }

      const lineTotal =
        quantity * unitCost -
        itemDiscount +
        itemTax;

      if (lineTotal < 0) {
        throw new Error(
          `Invalid total for product "${product.product_name}".`
        );
      }

      subtotal += lineTotal;

      preparedItems.push({
        productId,
        productName:
          product.product_name,
        unit:
          product.unit || "PCS",
        quantity,
        unitCost,
        discount:
          itemDiscount,
        tax:
          itemTax,
        lineTotal,
      });
    }

    // ========================================================
    // NEW TOTAL
    // ========================================================

    const purchaseDiscount =
      Number(discount) || 0;

    const purchaseTax =
      Number(tax) || 0;

    if (
      purchaseDiscount < 0 ||
      purchaseTax < 0
    ) {
      throw new Error(
        "Discount and tax cannot be negative."
      );
    }

    const totalAmount =
      subtotal -
      purchaseDiscount +
      purchaseTax;

    if (totalAmount < 0) {
      throw new Error(
        "Purchase total cannot be negative."
      );
    }

    // ========================================================
    // PRESERVE PAYMENTS
    // ========================================================

    const paidAmount =
      Number(oldPurchase.paid_amount) || 0;

    const balanceAmount =
      Math.max(
        totalAmount - paidAmount,
        0
      );

    let status = "UNPAID";

    if (paidAmount >= totalAmount) {
      status = "PAID";
    } else if (paidAmount > 0) {
      status = "PARTIAL";
    }

    // ========================================================
    // REVERSE OLD STOCK
    // ========================================================

    for (const oldItem of oldItems) {
      const oldStockResult =
        await client.query(
          `
          SELECT
            stock_id,
            quantity
          FROM stock
          WHERE product_id = $1
            AND warehouse_id = $2
          FOR UPDATE
          `,
          [
            oldItem.product_id,
            oldPurchase.warehouse_id,
          ]
        );

      if (
        oldStockResult.rows.length === 0
      ) {
        throw new Error(
          `Stock record not found for product ${oldItem.product_id}.`
        );
      }

      const oldStock =
        Number(
          oldStockResult.rows[0].quantity
        ) || 0;

      const newStock =
        oldStock -
        Number(oldItem.quantity);

      if (newStock < 0) {
        throw new Error(
          `Cannot edit purchase because stock for "${oldItem.product_name}" has already been used by another transaction.`
        );
      }

      await client.query(
        `
        UPDATE stock
        SET
          quantity = $1,
          updated_at = CURRENT_TIMESTAMP
        WHERE stock_id = $2
        `,
        [
          newStock,
          oldStockResult.rows[0].stock_id,
        ]
      );
    }

    // ========================================================
    // REVERSE OLD ACCOUNTING BALANCES
    // ========================================================

    await client.query(
      `
      UPDATE chart_of_accounts
      SET
        current_balance =
          current_balance - $1,
        updated_at = CURRENT_TIMESTAMP
      WHERE account_id = $2
      `,
      [
        Number(oldPurchase.total_amount) || 0,
        ACCOUNTS.INVENTORY,
      ]
    );

    await client.query(
      `
      UPDATE chart_of_accounts
      SET
        current_balance =
          current_balance - $1,
        updated_at = CURRENT_TIMESTAMP
      WHERE account_id = $2
      `,
      [
        Number(oldPurchase.total_amount) || 0,
        ACCOUNTS.ACCOUNTS_PAYABLE,
      ]
    );

    // ========================================================
    // DELETE OLD INVENTORY TRANSACTIONS
    // ========================================================

    await client.query(
      `
      DELETE FROM inventory_transactions
      WHERE transaction_type = 'VENDOR BILL'
        AND transaction_number = $1
      `,
      [oldPurchase.purchase_number]
    );

    // ========================================================
    // DELETE OLD JOURNAL
    // ========================================================

    const oldJournalResult =
      await client.query(
        `
        SELECT journal_id
        FROM journal_entries
        WHERE reference_type = 'PURCHASE'
          AND reference_id = $1
        `,
        [purchaseId]
      );

    for (
      const journal of
        oldJournalResult.rows
    ) {
      await client.query(
        `
        DELETE FROM journal_entry_lines
        WHERE journal_id = $1
        `,
        [journal.journal_id]
      );

      await client.query(
        `
        DELETE FROM journal_entries
        WHERE journal_id = $1
        `,
        [journal.journal_id]
      );
    }

    // ========================================================
    // DELETE OLD PURCHASE ITEMS
    // ========================================================

    await client.query(
      `
      DELETE FROM purchase_items
      WHERE purchase_id = $1
      `,
      [purchaseId]
    );

    // ========================================================
    // UPDATE PURCHASE HEADER
    // ========================================================

    await client.query(
      `
      UPDATE purchases
      SET
        purchase_number = $1,
        supplier_id = $2,
        warehouse_id = $3,
        purchase_date = COALESCE($4::DATE, CURRENT_DATE),
        subtotal = $5,
        discount = $6,
        tax = $7,
        total_amount = $8,
        paid_amount = $9,
        balance_amount = $10,
        status = $11,
        notes = $12,
        updated_at = CURRENT_TIMESTAMP
      WHERE purchase_id = $13
      `,
      [
        finalPurchaseNumber,
        supplierId,
        warehouseId,
        purchaseDate || null,
        subtotal,
        purchaseDiscount,
        purchaseTax,
        totalAmount,
        paidAmount,
        balanceAmount,
        status,
        notes || null,
        purchaseId,
      ]
    );

    // ========================================================
    // INSERT NEW ITEMS + STOCK + INVENTORY
    // ========================================================

    for (
      const item of preparedItems
    ) {
      await client.query(
        `
        INSERT INTO purchase_items (
          purchase_id,
          product_id,
          quantity,
          unit_cost,
          discount,
          tax,
          line_total
        )
        VALUES (
          $1,
          $2,
          $3,
          $4,
          $5,
          $6,
          $7
        )
        `,
        [
          purchaseId,
          item.productId,
          item.quantity,
          item.unitCost,
          item.discount,
          item.tax,
          item.lineTotal,
        ]
      );

      // ----------------------------------------
      // ADD NEW STOCK
      // ----------------------------------------

      const stockResult =
        await client.query(
          `
          SELECT
            stock_id,
            quantity
          FROM stock
          WHERE product_id = $1
            AND warehouse_id = $2
          FOR UPDATE
          `,
          [
            item.productId,
            warehouseId,
          ]
        );

      if (
        stockResult.rows.length > 0
      ) {
        await client.query(
          `
          UPDATE stock
          SET
            quantity = quantity + $1,
            updated_at = CURRENT_TIMESTAMP
          WHERE product_id = $2
            AND warehouse_id = $3
          `,
          [
            item.quantity,
            item.productId,
            warehouseId,
          ]
        );
      } else {
        await client.query(
          `
          INSERT INTO stock (
            product_id,
            warehouse_id,
            quantity
          )
          VALUES ($1, $2, $3)
          `,
          [
            item.productId,
            warehouseId,
            item.quantity,
          ]
        );
      }

      // ----------------------------------------
      // RUNNING INVENTORY
      // ----------------------------------------

      const runningResult =
        await client.query(
          `
          SELECT
            COALESCE(
              SUM(
                COALESCE(receive_quantity, 0)
                -
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
        Number(
          runningResult.rows[0]
            .running_quantity
        ) || 0;

      const newQuantity =
        oldQuantity +
        item.quantity;

      const receiveAmount =
        item.quantity *
        item.unitCost;

      await client.query(
        `
        INSERT INTO inventory_transactions (
          product_id,
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
          COALESCE($2::DATE, CURRENT_DATE),
          'VENDOR BILL',
          $3,
          $4,
          $5,
          $6,
          $7,
          $7,
          $7,
          $7,
          $8,
          $7,
          $9,
          0,
          0,
          0,
          $10
        )
        `,
        [
          item.productId,
          purchaseDate || null,
          finalPurchaseNumber,
          warehouse.warehouse_name,
          item.unit,
          `Purchase from ${supplier.supplier_name}`,
          item.unitCost,
          item.quantity,
          receiveAmount,
          newQuantity,
        ]
      );
    }

    // ========================================================
    // CREATE NEW JOURNAL
    // ========================================================

    const journalNumber =
      `PUR-JRN-${purchaseId}`;

    const journalResult =
      await client.query(
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
          'PURCHASE',
          $3,
          $4,
          'POSTED'
        )
        RETURNING journal_id
        `,
        [
          journalNumber,
          purchaseDate || null,
          purchaseId,
          `Purchase ${finalPurchaseNumber} from ${supplier.supplier_name}`,
        ]
      );

    const journalId =
      journalResult.rows[0]
        .journal_id;

    // Inventory Debit

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
      VALUES (
        $1,
        $2,
        $3,
        $4,
        0,
        NULL,
        NULL
      )
      `,
      [
        journalId,
        ACCOUNTS.INVENTORY,
        `Inventory received from ${supplier.supplier_name}`,
        totalAmount,
      ]
    );

    // Payable Credit

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
      VALUES (
        $1,
        $2,
        $3,
        0,
        $4,
        'SUPPLIER',
        $5
      )
      `,
      [
        journalId,
        ACCOUNTS.ACCOUNTS_PAYABLE,
        `Payable to ${supplier.supplier_name}`,
        totalAmount,
        supplierId,
      ]
    );

    // ========================================================
    // ADD NEW ACCOUNT BALANCES
    // ========================================================

    await client.query(
      `
      UPDATE chart_of_accounts
      SET
        current_balance =
          current_balance + $1,
        updated_at = CURRENT_TIMESTAMP
      WHERE account_id = $2
      `,
      [
        totalAmount,
        ACCOUNTS.INVENTORY,
      ]
    );

    await client.query(
      `
      UPDATE chart_of_accounts
      SET
        current_balance =
          current_balance + $1,
        updated_at = CURRENT_TIMESTAMP
      WHERE account_id = $2
      `,
      [
        totalAmount,
        ACCOUNTS.ACCOUNTS_PAYABLE,
      ]
    );

    // ========================================================
    // COMMIT
    // ========================================================

    await client.query("COMMIT");

    // ========================================================
    // GET UPDATED PURCHASE
    // ========================================================

    const updatedPurchaseResult =
      await pool.query(
        `
        SELECT
          p.purchase_id,
          p.purchase_number,

          p.supplier_id,
          s.supplier_code,
          s.supplier_name,

          p.warehouse_id,
          w.warehouse_code,
          w.warehouse_name,

          p.purchase_date,
          p.subtotal,
          p.discount,
          p.tax,
          p.total_amount,
          p.paid_amount,
          p.balance_amount,
          p.status,
          p.notes,
          p.created_at,
          p.updated_at

        FROM purchases p

        INNER JOIN suppliers s
          ON s.supplier_id = p.supplier_id

        INNER JOIN warehouses w
          ON w.warehouse_id = p.warehouse_id

        WHERE p.purchase_id = $1
        `,
        [purchaseId]
      );

    const updatedPurchase =
      updatedPurchaseResult.rows[0];

    const updatedItemsResult =
      await pool.query(
        `
        SELECT
          pi.purchase_item_id,
          pi.purchase_id,
          pi.product_id,
          pr.sku,
          pr.product_name,
          pi.quantity,
          pi.unit_cost,
          pi.discount,
          pi.tax,
          pi.line_total,
          pr.unit
        FROM purchase_items pi
        INNER JOIN products pr
          ON pr.product_id = pi.product_id
        WHERE pi.purchase_id = $1
        ORDER BY pi.purchase_item_id ASC
        `,
        [purchaseId]
      );

    updatedPurchase.items =
      updatedItemsResult.rows;

    return NextResponse.json({
      success: true,
      message:
        "Purchase updated successfully. Stock, Items Ledger and Accounting Ledger updated.",
      purchase:
        updatedPurchase,
    });
  } catch (error) {
    try {
      await client.query("ROLLBACK");
    } catch {}

    console.error(
      "PURCHASE PUT ERROR:",
      error
    );

    if (error.code === "23505") {
      return NextResponse.json(
        {
          success: false,
          message:
            "Purchase number already exists.",
        },
        { status: 409 }
      );
    }

    return NextResponse.json(
      {
        success: false,
        message:
          error.message ||
          "Failed to update purchase.",
      },
      { status: 500 }
    );
  } finally {
    client.release();
  }
}