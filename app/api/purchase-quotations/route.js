
import { NextResponse } from "next/server";
import pool from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { requirePermission, hasPermission } from "@/lib/permissions";

export const dynamic = "force-dynamic";

const SOURCE_MANUAL = "MANUAL";
const SOURCE_RFQ = "RFQ";

const ALLOWED_STATUSES = [
  "DRAFT",
  "PENDING",
  "APPROVED",
  "REJECTED",
  "CONVERTED",
  "CANCELLED",
];

/* -------------------------------------------------------------------------- */
/* Helpers                                                                     */
/* -------------------------------------------------------------------------- */

function validationError(message) {
  const error = new Error(message);
  error.statusCode = 400;
  return error;
}

function errorResponse(error) {
  console.error("Purchase Quotations API:", error);

  const status =
    error.message === "UNAUTHORIZED"
      ? 401
      : error.message === "FORBIDDEN"
        ? 403
        : error.statusCode ||
        (error.code === "23505"
          ? 409
          : error.code === "23503"
            ? 400
            : error.code === "23514"
              ? 400
              : 500);

  let message = error.message || "An unexpected error occurred.";

  if (error.message === "UNAUTHORIZED") {
    message = "Please log in again.";
  } else if (error.message === "FORBIDDEN") {
    message = "You do not have permission to perform this action.";
  } else if (error.code === "23505") {
    message =
      "A purchase quotation already exists with this quotation number or RFQ supplier.";
  } else if (error.code === "23503") {
    message =
      "A selected supplier, product, or RFQ record no longer exists.";
  } else if (error.code === "23514") {
    message = "One or more quotation values are invalid.";
  }

  return NextResponse.json(
    {
      success: false,
      message,
    },
    { status }
  );
}

function positiveId(value, label) {
  const id = Number(value);

  if (!Number.isSafeInteger(id) || id <= 0) {
    throw validationError(`Invalid ${label}.`);
  }

  return id;
}

function money(value, label, allowZero = true) {
  const number = Number(value ?? 0);

  if (
    !Number.isFinite(number) ||
    number < 0 ||
    (!allowZero && number === 0)
  ) {
    throw validationError(`Invalid ${label}.`);
  }

  return number;
}

function validDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value || ""))) {
    return false;
  }

  const date = new Date(`${value}T00:00:00.000Z`);

  return (
    !Number.isNaN(date.getTime()) &&
    date.toISOString().slice(0, 10) === value
  );
}

function normalizeCurrency(value) {
  const currency = String(value || "PKR")
    .trim()
    .toUpperCase();

  if (!/^[A-Z]{3}$/.test(currency)) {
    throw validationError("Invalid currency code.");
  }

  return currency;
}

function normalizeManualItems(items) {
  if (!Array.isArray(items) || !items.length) {
    throw validationError(
      "Add at least one product to the quotation."
    );
  }

  const seen = new Set();

  return items.map((item) => {
    const productId = positiveId(
      item.productId ?? item.product_id,
      "product"
    );

    if (seen.has(productId)) {
      throw validationError(
        "A product cannot appear more than once."
      );
    }

    seen.add(productId);

    const quantity = money(
      item.quantity,
      "quantity",
      false
    );

    const unitPrice = money(
      item.unitPrice ?? item.unit_price,
      "unit price"
    );

    const discountAmount = money(
      item.discountAmount ?? item.discount_amount,
      "discount amount"
    );

    const taxRate = money(
      item.taxRate ?? item.tax_rate,
      "tax rate"
    );

    if (taxRate > 100) {
      throw validationError(
        "Tax rate cannot exceed 100%."
      );
    }

    return {
      productId,
      quantity,
      unitPrice,
      discountAmount,
      taxRate,
      remarks:
        String(item.remarks || "").trim() || null,
    };
  });
}

function calculateLine(item) {
  const gross = item.quantity * item.unitPrice;

  if (!Number.isFinite(gross)) {
    throw validationError(
      "The quotation line amount is too large."
    );
  }

  if (item.discountAmount > gross) {
    throw validationError(
      "A line discount cannot exceed the line's gross amount."
    );
  }

  const taxableAmount = gross - item.discountAmount;
  const taxAmount = taxableAmount * (item.taxRate / 100);
  const lineTotal = taxableAmount + taxAmount;

  if (
    !Number.isFinite(taxAmount) ||
    !Number.isFinite(lineTotal)
  ) {
    throw validationError(
      "Invalid quotation line calculation."
    );
  }

  return {
    ...item,
    taxAmount,
    lineTotal,
  };
}

function calculateTotals(lines) {
  const subtotal = lines.reduce(
    (sum, line) =>
      sum + line.quantity * line.unitPrice,
    0
  );

  const discountTotal = lines.reduce(
    (sum, line) => sum + line.discountAmount,
    0
  );

  const taxTotal = lines.reduce(
    (sum, line) => sum + line.taxAmount,
    0
  );

  const grandTotal = lines.reduce(
    (sum, line) => sum + line.lineTotal,
    0
  );

  if (
    ![
      subtotal,
      discountTotal,
      taxTotal,
      grandTotal,
    ].every(Number.isFinite)
  ) {
    throw validationError(
      "The quotation totals exceed the supported numeric range."
    );
  }

  return {
    subtotal,
    discountTotal,
    taxTotal,
    grandTotal,
  };
}

async function getNextQuotationNumber(client, companyId) {
  await client.query(
    "SELECT pg_advisory_xact_lock($1::INTEGER, $2::INTEGER)",
    [companyId, 741206]
  );

  const result = await client.query(
    `
    SELECT
      COALESCE(
        MAX(
          NULLIF(
            REGEXP_REPLACE(
              quotation_number,
              '[^0-9]',
              '',
              'g'
            ),
            ''
          )::BIGINT
        ),
        0
      ) + 1 AS next_number
    FROM purchase_quotations
    WHERE company_id = $1
    `,
    [companyId]
  );

  return `PQ-${String(
    result.rows[0].next_number
  ).padStart(6, "0")}`;
}

/* -------------------------------------------------------------------------- */
/* GET: Purchase quotation history and dropdown data                           */
/* -------------------------------------------------------------------------- */

export async function GET() {
  try {
    const user = await getCurrentUser();

    await requirePermission(
      user,
      "purchase_quotations",
      "view"
    );

    if (!user.companyId) {
      throw validationError(
        "No company is assigned to your account."
      );
    }

    const companyId = positiveId(
      user.companyId,
      "company"
    );

    const [
      historyResult,
      suppliersResult,
      productsResult,
      rfqOptionsResult,
      companyResult,
    ] = await Promise.all([
      /* Purchase quotation history */
      pool.query(
        `
        SELECT
          pq.*,
          s.supplier_name,
          s.supplier_code,
          r.transaction_number AS rfq_number,

          COUNT(
            DISTINCT i.purchase_quotation_item_id
          )::INTEGER AS item_count

        FROM purchase_quotations pq

        INNER JOIN suppliers s
          ON s.supplier_id = pq.supplier_id

        LEFT JOIN rfqs r
          ON r.rfq_id = pq.rfq_id

        LEFT JOIN purchase_quotation_items i
          ON i.purchase_quotation_id =
             pq.purchase_quotation_id

        WHERE pq.company_id = $1

        GROUP BY
          pq.purchase_quotation_id,
          s.supplier_name,
          s.supplier_code,
          r.transaction_number

        ORDER BY
          pq.purchase_quotation_id DESC
        `,
        [companyId]
      ),

      /* Active suppliers */
      pool.query(
        `
        SELECT
          supplier_id,
          supplier_code,
          supplier_name,
          phone,
          email,
          address

        FROM suppliers

        WHERE is_active = TRUE

        ORDER BY supplier_name
        `
      ),

      /* Active products */
      pool.query(
        `
        SELECT
          product_id,
          sku,
          barcode,
          product_name,

          COALESCE(
            purchase_description,
            description,
            ''
          ) AS description,

          COALESCE(
            NULLIF(purchase_unit, ''),
            NULLIF(unit, ''),
            'PCS'
          ) AS uom,

          cost_price,
          purchase_account_id,
          is_active

        FROM products

        WHERE is_active = TRUE

        ORDER BY product_name
        `
      ),

      /* One row per RFQ supplier */
      pool.query(
        `
        SELECT
          r.rfq_id,
          r.transaction_number,
          r.transaction_date,
          r.status AS rfq_status,

          v.rfq_vendor_id,
          v.supplier_id,
          v.status AS supplier_status,
          v.response_date,
          v.validity_date,
          v.delivery_days,
          v.payment_terms,
          v.notes AS supplier_notes,

          s.supplier_name,
          s.supplier_code,

          COUNT(q.rfq_item_id)::INTEGER
            AS quote_count,

          COALESCE(
            SUM(
              q.quoted_quantity * q.unit_price
            ),
            0
          )::NUMERIC(18,2) AS quoted_subtotal,

          MAX(q.currency_code) AS currency_code

        FROM rfqs r

        INNER JOIN rfq_vendors v
          ON v.rfq_id = r.rfq_id

        INNER JOIN suppliers s
          ON s.supplier_id = v.supplier_id

        LEFT JOIN rfq_vendor_quotes q
          ON q.rfq_vendor_id = v.rfq_vendor_id

        WHERE r.company_id = $1

        GROUP BY
          r.rfq_id,
          r.transaction_number,
          r.transaction_date,
          r.status,

          v.rfq_vendor_id,
          v.supplier_id,
          v.status,
          v.response_date,
          v.validity_date,
          v.delivery_days,
          v.payment_terms,
          v.notes,

          s.supplier_name,
          s.supplier_code

        ORDER BY
          r.rfq_id DESC,
          s.supplier_name
        `,
        [companyId]
      ),

      /* Company information */
      pool.query(
        `
        SELECT *
        FROM companies
        WHERE company_id = $1
        LIMIT 1
        `,
        [companyId]
      ),
    ]);

    const [
      canCreate,
      canUpdate,
      canDelete,
    ] = await Promise.all([
      hasPermission(
        user.roleId,
        "purchase_quotations",
        "create"
      ),

      hasPermission(
        user.roleId,
        "purchase_quotations",
        "update"
      ),

      hasPermission(
        user.roleId,
        "purchase_quotations",
        "delete"
      ),
    ]);

    return NextResponse.json({
      success: true,

      quotations: historyResult.rows,

      suppliers: suppliersResult.rows,

      products: productsResult.rows,

      rfqOptions: rfqOptionsResult.rows,

      company: companyResult.rows[0] || {},

      permissions: {
        canView: true,
        canCreate,
        canUpdate,
        canDelete,
      },
    });
  } catch (error) {
    return errorResponse(error);
  }
}

/* -------------------------------------------------------------------------- */
/* POST: Create manual quotation or import RFQ supplier quotation              */
/* -------------------------------------------------------------------------- */

export async function POST(request) {
  let client;
  let transactionStarted = false;

  try {
    const user = await getCurrentUser();

    await requirePermission(
      user,
      "purchase_quotations",
      "create"
    );

    if (!user.companyId) {
      throw validationError(
        "No company is assigned to your account."
      );
    }

    const companyId = positiveId(
      user.companyId,
      "company"
    );

    const userId = positiveId(
      user.userId,
      "user"
    );

    let body;

    try {
      body = await request.json();
    } catch {
      throw validationError(
        "Invalid request body. Please send valid JSON."
      );
    }

    const sourceType = String(
      body.sourceType || SOURCE_MANUAL
    ).trim().toUpperCase();

    if (
      ![SOURCE_MANUAL, SOURCE_RFQ].includes(sourceType)
    ) {
      throw validationError(
        "Invalid purchase quotation source."
      );
    }

    const supplierId = positiveId(
      body.supplierId,
      "supplier"
    );

    const quotationDate = String(
      body.quotationDate || ""
    );

    const validUntil = body.validUntil
      ? String(body.validUntil)
      : null;

    const status = String(
      body.status || "DRAFT"
    ).trim().toUpperCase();

    if (!validDate(quotationDate)) {
      throw validationError(
        "Please select a valid quotation date."
      );
    }

    if (validUntil && !validDate(validUntil)) {
      throw validationError(
        "Please select a valid validity date."
      );
    }

    if (!ALLOWED_STATUSES.includes(status)) {
      throw validationError(
        "Invalid quotation status."
      );
    }

    if (
      validUntil &&
      validUntil < quotationDate
    ) {
      throw validationError(
        "The validity date cannot be earlier than the quotation date."
      );
    }

    const currencyCode = normalizeCurrency(
      body.currencyCode
    );

    const exchangeRate = money(
      body.exchangeRate ?? 1,
      "exchange rate",
      false
    );

    const termsConditions =
      String(body.termsConditions || "").trim() ||
      null;

    const remarks =
      String(body.remarks || "").trim() || null;

    client = await pool.connect();

    await client.query("BEGIN");
    transactionStarted = true;

    /* ---------------------------------------------------------------------- */
    /* Validate supplier                                                       */
    /* ---------------------------------------------------------------------- */

    const supplierResult = await client.query(
      `
      SELECT
        supplier_id,
        supplier_name

      FROM suppliers

      WHERE supplier_id = $1
        AND is_active = TRUE

      FOR SHARE
      `,
      [supplierId]
    );

    if (!supplierResult.rowCount) {
      throw validationError(
        "Selected supplier is inactive or unavailable."
      );
    }

    let lines = [];

    let rfqId = null;
    let rfqVendorId = null;

    let finalCurrency = currencyCode;

    /* ---------------------------------------------------------------------- */
    /* MANUAL PURCHASE QUOTATION                                               */
    /* ---------------------------------------------------------------------- */

    if (sourceType === SOURCE_MANUAL) {
      const selections = normalizeManualItems(
        body.items
      );

      const productIds = selections.map(
        (item) => item.productId
      );

      const productResult = await client.query(
        `
        SELECT
          product_id,
          product_name,

          COALESCE(
            purchase_description,
            description,
            ''
          ) AS description,

          COALESCE(
            NULLIF(purchase_unit, ''),
            NULLIF(unit, ''),
            'PCS'
          ) AS uom

        FROM products

        WHERE product_id = ANY($1::INTEGER[])
          AND is_active = TRUE

        FOR UPDATE
        `,
        [productIds]
      );

      if (
        productResult.rows.length !==
        productIds.length
      ) {
        throw validationError(
          "One or more selected products are inactive or unavailable."
        );
      }

      const productMap = new Map(
        productResult.rows.map((product) => [
          Number(product.product_id),
          product,
        ])
      );

      lines = selections.map((selection) => {
        const product = productMap.get(
          selection.productId
        );

        return calculateLine({
          productId: product.product_id,

          rfqItemId: null,

          itemDescription:
            product.description ||
            product.product_name,

          uom: product.uom,

          ...selection,
        });
      });
    } else {
      /* -------------------------------------------------------------------- */
      /* RFQ PURCHASE QUOTATION                                                */
      /* -------------------------------------------------------------------- */

      rfqId = positiveId(
        body.rfqId,
        "RFQ"
      );

      rfqVendorId = positiveId(
        body.rfqVendorId,
        "RFQ supplier"
      );

      const rfqVendorResult = await client.query(
        `
        SELECT
          v.rfq_vendor_id,
          v.rfq_id,
          v.supplier_id,
          v.status AS supplier_status,

          r.transaction_number,
          r.status AS rfq_status

        FROM rfq_vendors v

        INNER JOIN rfqs r
          ON r.rfq_id = v.rfq_id

        WHERE v.rfq_vendor_id = $1
          AND v.supplier_id = $2
          AND r.rfq_id = $3
          AND r.company_id = $4

        FOR UPDATE OF v, r
        `,
        [
          rfqVendorId,
          supplierId,
          rfqId,
          companyId,
        ]
      );

      if (!rfqVendorResult.rowCount) {
        throw validationError(
          "The selected supplier does not belong to this RFQ or company."
        );
      }

      /* Prevent duplicate import of the same supplier RFQ. */

      const existingQuotationResult =
        await client.query(
          `
          SELECT
            purchase_quotation_id,
            quotation_number

          FROM purchase_quotations

          WHERE company_id = $1
            AND rfq_vendor_id = $2

          LIMIT 1
          `,
          [companyId, rfqVendorId]
        );

      if (existingQuotationResult.rowCount) {
        throw validationError(
          `A purchase quotation already exists for this RFQ supplier (${existingQuotationResult.rows[0].quotation_number}).`
        );
      }

      /* Get the supplier's submitted RFQ prices. */

      const quoteResult = await client.query(
        `
        SELECT
          q.rfq_item_id,
          q.quoted_quantity,
          q.unit_price,
          q.tax_rate,
          q.discount_amount,
          q.currency_code,
          q.remarks,

          i.product_id,
          i.item_description,
          i.uom,
          i.quantity AS requested_quantity,

          p.product_name

        FROM rfq_vendor_quotes q

        INNER JOIN rfq_items i
          ON i.rfq_item_id = q.rfq_item_id
         AND i.rfq_id = $2

        LEFT JOIN products p
          ON p.product_id = i.product_id

        WHERE q.rfq_vendor_id = $1

        ORDER BY q.rfq_item_id

        FOR UPDATE OF q
        `,
        [rfqVendorId, rfqId]
      );

      if (!quoteResult.rowCount) {
        throw validationError(
          "The selected supplier has not submitted any priced quotation lines for this RFQ."
        );
      }

      /* Ensure all quote lines use the same currency. */

      const quoteCurrencies = [
        ...new Set(
          quoteResult.rows
            .map((row) =>
              String(row.currency_code || "")
                .trim()
                .toUpperCase()
            )
            .filter(Boolean)
        ),
      ];

      if (quoteCurrencies.length > 1) {
        throw validationError(
          "The selected RFQ supplier has quotation lines in multiple currencies. Please correct the RFQ supplier quotes before importing."
        );
      }

      if (quoteCurrencies.length === 1) {
        finalCurrency = normalizeCurrency(
          quoteCurrencies[0]
        );
      }

      lines = quoteResult.rows.map((quote) => {
        const quantity = money(
          quote.quoted_quantity,
          "quoted quantity",
          false
        );

        const unitPrice = money(
          quote.unit_price,
          "unit price"
        );

        const discountAmount = money(
          quote.discount_amount,
          "discount amount"
        );

        const taxRate = money(
          quote.tax_rate,
          "tax rate"
        );

        if (taxRate > 100) {
          throw validationError(
            "An RFQ tax rate exceeds 100%."
          );
        }

        return calculateLine({
          productId: quote.product_id,

          rfqItemId: quote.rfq_item_id,

          quantity,

          unitPrice,

          discountAmount,

          taxRate,

          itemDescription:
            quote.item_description ||
            quote.product_name ||
            "RFQ Item",

          uom: quote.uom || "",

          remarks: quote.remarks || null,
        });
      });
    }

    /* ---------------------------------------------------------------------- */
    /* Calculate totals                                                        */
    /* ---------------------------------------------------------------------- */

    const {
      subtotal,
      discountTotal,
      taxTotal,
      grandTotal,
    } = calculateTotals(lines);

    /* ---------------------------------------------------------------------- */
    /* Generate quotation number                                               */
    /* ---------------------------------------------------------------------- */

    const quotationNumber =
      await getNextQuotationNumber(
        client,
        companyId
      );

    /* ---------------------------------------------------------------------- */
    /* Insert quotation header                                                 */
    /* ---------------------------------------------------------------------- */

    const headerResult = await client.query(
      `
      INSERT INTO purchase_quotations (
        quotation_number,
        company_id,
        supplier_id,
        source_type,
        rfq_id,
        rfq_vendor_id,
        quotation_date,
        valid_until,
        status,
        currency_code,
        exchange_rate,
        subtotal,
        discount_amount,
        tax_amount,
        grand_total,
        terms_conditions,
        remarks,
        created_by,
        updated_by
      )

      VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9,
        $10, $11, $12, $13, $14, $15, $16, $17,
        $18, $18
      )

      RETURNING *
      `,
      [
        quotationNumber,
        companyId,
        supplierId,
        sourceType,
        rfqId,
        rfqVendorId,
        quotationDate,
        validUntil,
        status,
        finalCurrency,
        exchangeRate,
        subtotal,
        discountTotal,
        taxTotal,
        grandTotal,
        termsConditions,
        remarks,
        userId,
      ]
    );

    const quotation = headerResult.rows[0];

    /* ---------------------------------------------------------------------- */
    /* Insert quotation items                                                  */
    /* ---------------------------------------------------------------------- */

    for (const line of lines) {
      await client.query(
        `
        INSERT INTO purchase_quotation_items (
          purchase_quotation_id,
          product_id,
          rfq_item_id,
          item_description,
          uom,
          quantity,
          unit_price,
          discount_amount,
          tax_rate,
          tax_amount,
          line_total,
          remarks
        )

        VALUES (
          $1, $2, $3, $4, $5, $6,
          $7, $8, $9, $10, $11, $12
        )
        `,
        [
          quotation.purchase_quotation_id,
          line.productId || null,
          line.rfqItemId || null,
          line.itemDescription,
          line.uom,
          line.quantity,
          line.unitPrice,
          line.discountAmount,
          line.taxRate,
          line.taxAmount,
          line.lineTotal,
          line.remarks,
        ]
      );
    }

    /* ---------------------------------------------------------------------- */
    /* Commit transaction                                                      */
    /* ---------------------------------------------------------------------- */

    await client.query("COMMIT");
    transactionStarted = false;

    return NextResponse.json(
      {
        success: true,

        message:
          "Purchase quotation created successfully.",

        quotation: {
          purchaseQuotationId:
            quotation.purchase_quotation_id,

          quotationNumber:
            quotation.quotation_number,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    if (transactionStarted && client) {
      await client.query("ROLLBACK").catch(() => { });
    }

    return errorResponse(error);
  } finally {
    client?.release();
  }
}
