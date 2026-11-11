
import { NextResponse } from "next/server";
import pool from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { requirePermission } from "@/lib/permissions";

export const dynamic = "force-dynamic";

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

function apiError(error) {
  console.error("Purchase quotation detail API:", error);

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

  let message =
    error.message || "Purchase quotation operation failed.";

  if (error.message === "UNAUTHORIZED") {
    message = "Please log in again.";
  } else if (error.message === "FORBIDDEN") {
    message = "You do not have permission to perform this action.";
  } else if (error.code === "23505") {
    message = "A record with these details already exists.";
  } else if (error.code === "23503") {
    message =
      "A referenced supplier, product, or RFQ record no longer exists.";
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

async function getId(context) {
  const params = await context.params;
  const id = Number(params?.id);

  if (!Number.isSafeInteger(id) || id <= 0) {
    throw validationError("Invalid purchase quotation ID.");
  }

  return id;
}

function positiveId(value, label) {
  const id = Number(value);

  if (!Number.isSafeInteger(id) || id <= 0) {
    throw validationError(`Invalid ${label}.`);
  }

  return id;
}

function numberValue(value, label, allowZero = true) {
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

function calculateLine(item) {
  const gross = item.quantity * item.unitPrice;

  if (!Number.isFinite(gross)) {
    throw validationError(
      "The quotation line amount is too large."
    );
  }

  if (item.discountAmount > gross) {
    throw validationError(
      "A line discount cannot exceed its gross amount."
    );
  }

  const taxable = gross - item.discountAmount;
  const taxAmount = taxable * (item.taxRate / 100);
  const lineTotal = taxable + taxAmount;

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
      sum +
      Number(line.quantity) *
        Number(line.unitPrice ?? line.unit_price),
    0
  );

  const discountTotal = lines.reduce(
    (sum, line) =>
      sum +
      Number(line.discountAmount ?? line.discount_amount),
    0
  );

  const taxTotal = lines.reduce(
    (sum, line) =>
      sum +
      Number(line.taxAmount ?? line.tax_amount),
    0
  );

  const grandTotal = lines.reduce(
    (sum, line) =>
      sum +
      Number(line.lineTotal ?? line.line_total),
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

function getItemValue(item, camelCase, snakeCase) {
  return item[camelCase] ?? item[snakeCase];
}

/* -------------------------------------------------------------------------- */
/* GET: Load one purchase quotation                                            */
/* -------------------------------------------------------------------------- */

export async function GET(request, context) {
  try {
    const user = await getCurrentUser();

    await requirePermission(
      user,
      "purchase_quotations",
      "view"
    );

    if (!user.companyId) {
      throw validationError(
        "Company information is missing."
      );
    }

    const companyId = positiveId(
      user.companyId,
      "company"
    );

    const id = await getId(context);

    const headerResult = await pool.query(
      `
      SELECT
        pq.*,

        s.supplier_name,
        s.supplier_code,
        s.phone AS supplier_phone,
        s.email AS supplier_email,
        s.address AS supplier_address,

        r.transaction_number AS rfq_number,
        r.transaction_date AS rfq_date,

        c.company_name

      FROM purchase_quotations pq

      INNER JOIN suppliers s
        ON s.supplier_id = pq.supplier_id

      LEFT JOIN rfqs r
        ON r.rfq_id = pq.rfq_id

      LEFT JOIN companies c
        ON c.company_id = pq.company_id

      WHERE
        pq.purchase_quotation_id = $1
        AND pq.company_id = $2

      LIMIT 1
      `,
      [id, companyId]
    );

    if (!headerResult.rowCount) {
      return NextResponse.json(
        {
          success: false,
          message: "Purchase quotation not found.",
        },
        { status: 404 }
      );
    }

    const itemsResult = await pool.query(
      `
      SELECT
        i.*,

        p.sku,
        p.barcode,
        p.product_name

      FROM purchase_quotation_items i

      LEFT JOIN products p
        ON p.product_id = i.product_id

      WHERE
        i.purchase_quotation_id = $1

      ORDER BY
        i.purchase_quotation_item_id
      `,
      [id]
    );

    return NextResponse.json({
      success: true,

      quotation: {
        ...headerResult.rows[0],
        items: itemsResult.rows,
      },
    });
  } catch (error) {
    return apiError(error);
  }
}

/* -------------------------------------------------------------------------- */
/* PATCH: Update a DRAFT purchase quotation                                    */
/* -------------------------------------------------------------------------- */

export async function PATCH(request, context) {
  let client;
  let transactionStarted = false;

  try {
    const user = await getCurrentUser();

    await requirePermission(
      user,
      "purchase_quotations",
      "update"
    );

    if (!user.companyId) {
      throw validationError(
        "Company information is missing."
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

    const id = await getId(context);

    let body;

    try {
      body = await request.json();
    } catch {
      throw validationError(
        "Invalid request body. Please send valid JSON."
      );
    }

    if (
      !body ||
      typeof body !== "object" ||
      Array.isArray(body)
    ) {
      throw validationError("Invalid request body.");
    }

    client = await pool.connect();

    await client.query("BEGIN");
    transactionStarted = true;

    /* ---------------------------------------------------------------------- */
    /* Load and lock existing quotation                                        */
    /* ---------------------------------------------------------------------- */

    const currentResult = await client.query(
      `
      SELECT *
      FROM purchase_quotations

      WHERE
        purchase_quotation_id = $1
        AND company_id = $2

      FOR UPDATE
      `,
      [id, companyId]
    );

    if (!currentResult.rowCount) {
      throw validationError(
        "Purchase quotation not found."
      );
    }

    const current = currentResult.rows[0];

    if (current.status !== "DRAFT") {
      throw validationError(
        "Only DRAFT purchase quotations can be edited."
      );
    }

    const isRfqQuotation =
      String(current.source_type || "").toUpperCase() === "RFQ";

    /* ---------------------------------------------------------------------- */
    /* Validate header values                                                  */
    /* ---------------------------------------------------------------------- */

    const quotationDate =
      body.quotationDate !== undefined
        ? String(body.quotationDate)
        : String(current.quotation_date).slice(0, 10);

    const validUntil =
      body.validUntil !== undefined
        ? body.validUntil
          ? String(body.validUntil)
          : null
        : current.valid_until
          ? String(current.valid_until).slice(0, 10)
          : null;

    const status = String(
      body.status ?? current.status ?? "DRAFT"
    )
      .trim()
      .toUpperCase();

    if (!validDate(quotationDate)) {
      throw validationError(
        "Please provide a valid quotation date."
      );
    }

    if (validUntil && !validDate(validUntil)) {
      throw validationError(
        "Please provide a valid validity date."
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

    if (!ALLOWED_STATUSES.includes(status)) {
      throw validationError(
        "Invalid quotation status."
      );
    }

    const exchangeRate = numberValue(
      body.exchangeRate ??
        current.exchange_rate ??
        1,
      "exchange rate",
      false
    );

    /*
     * RFQ-origin quotations retain the original imported currency.
     * Manual quotations can change their currency.
     */

    const currencyCode = isRfqQuotation
      ? normalizeCurrency(current.currency_code)
      : normalizeCurrency(
          body.currencyCode ??
            current.currency_code ??
            "PKR"
        );

    const termsConditions =
      body.termsConditions !== undefined
        ? String(body.termsConditions || "").trim() || null
        : current.terms_conditions;

    const remarks =
      body.remarks !== undefined
        ? String(body.remarks || "").trim() || null
        : current.remarks;

    /* ---------------------------------------------------------------------- */
    /* Validate supplier                                                      */
    /* ---------------------------------------------------------------------- */

    let supplierId = Number(current.supplier_id);

    if (body.supplierId !== undefined) {
      const requestedSupplierId = positiveId(
        body.supplierId,
        "supplier"
      );

      /*
       * The supplier is part of the RFQ source relationship.
       * It cannot be changed after importing an RFQ quotation.
       */

      if (
        isRfqQuotation &&
        requestedSupplierId !== Number(current.supplier_id)
      ) {
        throw validationError(
          "The supplier of an RFQ-origin quotation cannot be changed."
        );
      }

      supplierId = requestedSupplierId;
    }

    const supplierResult = await client.query(
      `
      SELECT supplier_id

      FROM suppliers

      WHERE
        supplier_id = $1
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

    /* ---------------------------------------------------------------------- */
    /* Load existing items                                                     */
    /* ---------------------------------------------------------------------- */

    const existingItemsResult = await client.query(
      `
      SELECT *
      FROM purchase_quotation_items

      WHERE purchase_quotation_id = $1

      ORDER BY purchase_quotation_item_id

      FOR UPDATE
      `,
      [id]
    );

    if (!existingItemsResult.rowCount) {
      throw validationError(
        "This quotation has no items. Add at least one item."
      );
    }

    let lines = [];

    /* ---------------------------------------------------------------------- */
    /* Update items only when items are provided                               */
    /* ---------------------------------------------------------------------- */

    if (body.items !== undefined) {
      if (
        !Array.isArray(body.items) ||
        !body.items.length
      ) {
        throw validationError(
          "A quotation must contain at least one item."
        );
      }

      /* ==================================================================== */
      /* RFQ-ORIGIN QUOTATION                                                  */
      /* ==================================================================== */

      if (isRfqQuotation) {
        const existingById = new Map(
          existingItemsResult.rows.map((item) => [
            Number(item.purchase_quotation_item_id),
            item,
          ])
        );

        const submittedIds = body.items.map((item) =>
          Number(
            item.purchaseQuotationItemId ??
              item.purchase_quotation_item_id
          )
        );

        if (
          submittedIds.some(
            (itemId) =>
              !Number.isSafeInteger(itemId) ||
              !existingById.has(itemId)
          ) ||
          new Set(submittedIds).size !==
            submittedIds.length ||
          submittedIds.length !== existingById.size
        ) {
          throw validationError(
            "RFQ-origin quotation items cannot be added or removed. You can update the imported quantities and prices."
          );
        }

        lines = body.items.map((item) => {
          const itemId = Number(
            item.purchaseQuotationItemId ??
              item.purchase_quotation_item_id
          );

          const existingItem = existingById.get(itemId);

          const quantity = numberValue(
            item.quantity,
            "quantity",
            false
          );

          const unitPrice = numberValue(
            getItemValue(
              item,
              "unitPrice",
              "unit_price"
            ),
            "unit price"
          );

          const discountAmount = numberValue(
            getItemValue(
              item,
              "discountAmount",
              "discount_amount"
            ),
            "discount amount"
          );

          const taxRate = numberValue(
            getItemValue(
              item,
              "taxRate",
              "tax_rate"
            ),
            "tax rate"
          );

          if (taxRate > 100) {
            throw validationError(
              "Tax rate cannot exceed 100%."
            );
          }

          const remarksValue =
            item.remarks !== undefined
              ? String(item.remarks || "").trim() || null
              : existingItem.remarks;

          return calculateLine({
            itemId,
            quantity,
            unitPrice,
            discountAmount,
            taxRate,
            remarks: remarksValue,
          });
        });

        for (const line of lines) {
          await client.query(
            `
            UPDATE purchase_quotation_items

            SET
              quantity = $1,
              unit_price = $2,
              discount_amount = $3,
              tax_rate = $4,
              tax_amount = $5,
              line_total = $6,
              remarks = $7

            WHERE
              purchase_quotation_item_id = $8
              AND purchase_quotation_id = $9
            `,
            [
              line.quantity,
              line.unitPrice,
              line.discountAmount,
              line.taxRate,
              line.taxAmount,
              line.lineTotal,
              line.remarks,
              line.itemId,
              id,
            ]
          );
        }
      } else {
        /* ================================================================ */
        /* MANUAL QUOTATION                                                   */
        /* ================================================================ */

        const seen = new Set();

        const selections = body.items.map((item) => {
          const productId = positiveId(
            getItemValue(
              item,
              "productId",
              "product_id"
            ),
            "product"
          );

          if (seen.has(productId)) {
            throw validationError(
              "A product cannot appear more than once."
            );
          }

          seen.add(productId);

          const quantity = numberValue(
            item.quantity,
            "quantity",
            false
          );

          const unitPrice = numberValue(
            getItemValue(
              item,
              "unitPrice",
              "unit_price"
            ),
            "unit price"
          );

          const discountAmount = numberValue(
            getItemValue(
              item,
              "discountAmount",
              "discount_amount"
            ),
            "discount amount"
          );

          const taxRate = numberValue(
            getItemValue(
              item,
              "taxRate",
              "tax_rate"
            ),
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

          WHERE
            product_id = ANY($1::INTEGER[])
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
            "One or more products are inactive or unavailable."
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
            ...selection,

            rfqItemId: null,

            itemDescription:
              product.description ||
              product.product_name,

            uom: product.uom,
          });
        });

        await client.query(
          `
          DELETE FROM purchase_quotation_items

          WHERE purchase_quotation_id = $1
          `,
          [id]
        );

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
              $1, $2, NULL, $3, $4, $5,
              $6, $7, $8, $9, $10, $11
            )
            `,
            [
              id,
              line.productId,
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
      }
    }

    /* ---------------------------------------------------------------------- */
    /* Calculate final totals                                                  */
    /* ---------------------------------------------------------------------- */

    if (body.items === undefined) {
      lines = existingItemsResult.rows;
    }

    if (!lines.length) {
      throw validationError(
        "A quotation must contain at least one item."
      );
    }

    const {
      subtotal,
      discountTotal,
      taxTotal,
      grandTotal,
    } = calculateTotals(lines);

    /* ---------------------------------------------------------------------- */
    /* Update quotation header                                                 */
    /* ---------------------------------------------------------------------- */

    await client.query(
      `
      UPDATE purchase_quotations

      SET
        supplier_id = $1,
        quotation_date = $2,
        valid_until = $3,
        status = $4,
        currency_code = $5,
        exchange_rate = $6,

        subtotal = $7,
        discount_amount = $8,
        tax_amount = $9,
        grand_total = $10,

        terms_conditions = $11,
        remarks = $12,

        updated_by = $13,
        updated_at = NOW()

      WHERE
        purchase_quotation_id = $14
        AND company_id = $15
      `,
      [
        supplierId,
        quotationDate,
        validUntil,
        status,
        currencyCode,
        exchangeRate,
        subtotal,
        discountTotal,
        taxTotal,
        grandTotal,
        termsConditions,
        remarks,
        userId,
        id,
        companyId,
      ]
    );

    /* ---------------------------------------------------------------------- */
    /* Commit                                                                   */
    /* ---------------------------------------------------------------------- */

    await client.query("COMMIT");
    transactionStarted = false;

    return NextResponse.json({
      success: true,
      message:
        "Purchase quotation updated successfully.",
    });
  } catch (error) {
    if (transactionStarted && client) {
      await client.query("ROLLBACK").catch(() => {});
    }

    return apiError(error);
  } finally {
    client?.release();
  }
}

/* -------------------------------------------------------------------------- */
/* DELETE: Delete a DRAFT purchase quotation                                   */
/* -------------------------------------------------------------------------- */

export async function DELETE(request, context) {
  let client;
  let transactionStarted = false;

  try {
    const user = await getCurrentUser();

    await requirePermission(
      user,
      "purchase_quotations",
      "delete"
    );

    if (!user.companyId) {
      throw validationError(
        "Company information is missing."
      );
    }

    const companyId = positiveId(
      user.companyId,
      "company"
    );

    const id = await getId(context);

    client = await pool.connect();

    await client.query("BEGIN");
    transactionStarted = true;

    const result = await client.query(
      `
      DELETE FROM purchase_quotations

      WHERE
        purchase_quotation_id = $1
        AND company_id = $2
        AND status = 'DRAFT'

      RETURNING purchase_quotation_id
      `,
      [id, companyId]
    );

    if (!result.rowCount) {
      const existsResult = await client.query(
        `
        SELECT status
        FROM purchase_quotations

        WHERE
          purchase_quotation_id = $1
          AND company_id = $2

        LIMIT 1
        `,
        [id, companyId]
      );

      if (!existsResult.rowCount) {
        throw validationError(
          "Purchase quotation not found."
        );
      }

      throw validationError(
        "Only DRAFT purchase quotations can be deleted."
      );
    }

    await client.query("COMMIT");
    transactionStarted = false;

    return NextResponse.json({
      success: true,
      message:
        "Purchase quotation deleted successfully.",
    });
  } catch (error) {
    if (transactionStarted && client) {
      await client.query("ROLLBACK").catch(() => {});
    }

    return apiError(error);
  } finally {
    client?.release();
  }
}
