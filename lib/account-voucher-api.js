
import { NextResponse } from "next/server";
import pool from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { hasPermission } from "@/lib/permissions";
import { randomBytes } from "crypto";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function response(message, status = 400) {
  return NextResponse.json(
    { success: false, message },
    {
      status,
      headers: { "Cache-Control": "no-store" },
    }
  );
}

function success(data, status = 200) {
  return NextResponse.json(data, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

async function authorize(permissionKey, action) {
  const user = await getCurrentUser();

  if (!user) {
    return {
      user: null,
      error: response("Authentication required. Please log in.", 401),
    };
  }

  const roleId = Number(user.roleId ?? user.role_id);

  if (!Number.isInteger(roleId) || roleId <= 0) {
    return {
      user: null,
      error: response("Your account does not have a valid role.", 403),
    };
  }

  const allowed = await hasPermission(roleId, permissionKey, action);

  if (!allowed) {
    return {
      user: null,
      error: response(
        `Permission denied. You do not have ${action} access.`,
        403
      ),
    };
  }

  return { user };
}

function validDate(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }

  const date = new Date(`${value}T00:00:00.000Z`);

  return (
    !Number.isNaN(date.getTime()) &&
    date.toISOString().slice(0, 10) === value
  );
}

function createVoucherNumber(type) {
  const prefix = type === "PAYMENT" ? "PAY" : "REC";
  const date = new Date().toISOString().slice(0, 10).replaceAll("-", "");
  const suffix = randomBytes(4).toString("hex").toUpperCase();

  return `${prefix}-${date}-${suffix}`;
}

export function createVoucherHandlers(type) {
  const permissionKey =
    type === "PAYMENT" ? "make_payment" : "make_receipt";

  const voucherLabel =
    type === "PAYMENT" ? "Payment" : "Receipt";

  async function GET() {
    try {
      const authorization = await authorize(permissionKey, "view");

      if (authorization.error) {
        return authorization.error;
      }

      const [accountsResult, vouchersResult, createAllowed] =
        await Promise.all([
          pool.query(`
            SELECT
              account_id,
              account_code,
              account_name,
              account_type,
              is_cash_bank
            FROM chart_of_accounts
            WHERE is_active = TRUE
              AND is_group = FALSE
            ORDER BY account_code ASC
          `),

          pool.query(
            `
              SELECT
                je.journal_id,
                je.journal_number,
                je.journal_date,
                je.description,
                je.status,
                je.created_at,
                COALESCE(
                  SUM(jel.debit) FILTER (WHERE jel.debit > 0),
                  0
                ) AS amount,
                MAX(
                  CASE
                    WHEN jel.debit > 0 THEN coa.account_name
                  END
                ) AS debit_account,
                MAX(
                  CASE
                    WHEN jel.credit > 0 THEN coa.account_name
                  END
                ) AS credit_account
              FROM journal_entries je
              INNER JOIN journal_entry_lines jel
                ON jel.journal_id = je.journal_id
              LEFT JOIN chart_of_accounts coa
                ON coa.account_id = jel.account_id
              WHERE je.reference_type = $1
              GROUP BY
                je.journal_id,
                je.journal_number,
                je.journal_date,
                je.description,
                je.status,
                je.created_at
              ORDER BY je.journal_id DESC
              LIMIT 200
            `,
            [type === "PAYMENT" ? "MAKE_PAYMENT" : "MAKE_RECEIPT"]
          ),

          hasPermission(
            Number(
              authorization.user.roleId ??
              authorization.user.role_id
            ),
            permissionKey,
            "create"
          ),
        ]);

      const accounts = accountsResult.rows;

      return success({
        success: true,
        type,
        accounts,
        cashAccounts: accounts.filter(
          (account) => account.is_cash_bank === true
        ),
        counterpartAccounts: accounts.filter(
          (account) => account.is_cash_bank !== true
        ),
        vouchers: vouchersResult.rows,
        permissions: {
          canView: true,
          canCreate: createAllowed === true,
        },
      });
    } catch (error) {
      console.error(`GET ${voucherLabel} vouchers error:`, error);
      return response(
        `Unable to load ${voucherLabel.toLowerCase()} vouchers.`,
        500
      );
    }
  }

  async function POST(request) {
    let client;

    try {
      const authorization = await authorize(permissionKey, "create");

      if (authorization.error) {
        return authorization.error;
      }

      const body = await request.json();

      const cashAccountId = Number(body.cashAccountId);
      const counterpartAccountId = Number(body.counterpartAccountId);
      const amount = Number(body.amount);
      const voucherDate = String(body.date ?? "").trim();
      const referenceNumber = String(
        body.referenceNumber ?? ""
      ).trim();
      const description = String(body.description ?? "").trim();

      if (
        !Number.isInteger(cashAccountId) ||
        cashAccountId <= 0 ||
        !Number.isInteger(counterpartAccountId) ||
        counterpartAccountId <= 0
      ) {
        return response("Please select valid accounts.");
      }

      if (cashAccountId === counterpartAccountId) {
        return response("Cash/Bank and posting accounts must be different.");
      }

      if (!Number.isFinite(amount) || amount <= 0) {
        return response("Amount must be greater than zero.");
      }

      if (amount > 999999999999) {
        return response("Amount exceeds the permitted limit.");
      }

      if (!validDate(voucherDate)) {
        return response("Please provide a valid voucher date.");
      }

      if (!description) {
        return response("Description is required.");
      }

      if (referenceNumber.length > 100) {
        return response("Reference number cannot exceed 100 characters.");
      }

      if (description.length > 1000) {
        return response("Description cannot exceed 1000 characters.");
      }

      const userId = Number(
        authorization.user.userId ?? authorization.user.user_id
      );

      client = await pool.connect();
      await client.query("BEGIN");

      const accountResult = await client.query(
        `
          SELECT
            account_id,
            account_code,
            account_name,
            account_type,
            is_active,
            is_group,
            is_cash_bank
          FROM chart_of_accounts
          WHERE account_id = ANY($1::int[])
          ORDER BY account_id
          FOR UPDATE
        `,
        [[cashAccountId, counterpartAccountId]]
      );

      if (accountResult.rows.length !== 2) {
        await client.query("ROLLBACK");
        return response("One or both selected accounts do not exist.", 404);
      }

      const cashAccount = accountResult.rows.find(
        (account) => Number(account.account_id) === cashAccountId
      );

      const counterpartAccount = accountResult.rows.find(
        (account) => Number(account.account_id) === counterpartAccountId
      );

      if (
        !cashAccount ||
        !counterpartAccount ||
        !cashAccount.is_active ||
        !counterpartAccount.is_active ||
        cashAccount.is_group ||
        counterpartAccount.is_group
      ) {
        await client.query("ROLLBACK");
        return response("Both selected accounts must be active posting accounts.");
      }

      if (cashAccount.is_cash_bank !== true) {
        await client.query("ROLLBACK");
        return response("Select a valid Cash/Bank account.");
      }

      if (counterpartAccount.is_cash_bank === true) {
        await client.query("ROLLBACK");
        return response("Select a non-Cash/Bank posting account.");
      }

      const voucherNumber = createVoucherNumber(type);
      const referenceType =
        type === "PAYMENT" ? "MAKE_PAYMENT" : "MAKE_RECEIPT";

      const fullDescription = referenceNumber
        ? `${description} | Reference: ${referenceNumber}`
        : description;

      const journalResult = await client.query(
        `
          INSERT INTO journal_entries (
            journal_number,
            journal_date,
            reference_type,
            reference_id,
            description,
            status,
            created_by,
            created_at,
            updated_at
          )
          VALUES (
            $1, $2, $3, NULL, $4, 'POSTED', $5,
            CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
          )
          RETURNING journal_id, journal_number, journal_date, status
        `,
        [
          voucherNumber,
          voucherDate,
          referenceType,
          fullDescription,
          Number.isInteger(userId) && userId > 0 ? userId : null,
        ]
      );

      const journal = journalResult.rows[0];

      // PAYMENT:
      // Debit counterpart account.
      // Credit Cash/Bank account.
      //
      // RECEIPT:
      // Debit Cash/Bank account.
      // Credit counterpart account.

      if (type === "PAYMENT") {
        await client.query(
          `
            INSERT INTO journal_entry_lines (
              journal_id,
              account_id,
              description,
              debit,
              credit,
              entity_name
            )
            VALUES
              ($1, $2, $3, $4, 0, $5),
              ($1, $6, $3, 0, $4, $5)
          `,
          [
            journal.journal_id,
            counterpartAccountId,
            fullDescription,
            amount,
            referenceNumber || null,
            cashAccountId,
          ]
        );
      } else {
        await client.query(
          `
            INSERT INTO journal_entry_lines (
              journal_id,
              account_id,
              description,
              debit,
              credit,
              entity_name
            )
            VALUES
              ($1, $2, $3, $4, 0, $5),
              ($1, $6, $3, 0, $4, $5)
          `,
          [
            journal.journal_id,
            cashAccountId,
            fullDescription,
            amount,
            referenceNumber || null,
            counterpartAccountId,
          ]
        );
      }

      // Keep account balances consistent with the existing
      // Journal Entries implementation.
      await client.query(
        `
          UPDATE chart_of_accounts account
          SET current_balance =
            COALESCE(account.opening_balance, 0) +
            COALESCE(
              (
                SELECT SUM(line.debit - line.credit)
                FROM journal_entry_lines line
                INNER JOIN journal_entries entry
                  ON entry.journal_id = line.journal_id
                WHERE line.account_id = account.account_id
                  AND entry.status = 'POSTED'
              ),
              0
            ),
            updated_at = CURRENT_TIMESTAMP
          WHERE account.account_id = ANY($1::int[])
        `,
        [[cashAccountId, counterpartAccountId]]
      );

      await client.query("COMMIT");

      return success(
        {
          success: true,
          message: `${voucherLabel} voucher created successfully.`,
          voucher: {
            ...journal,
            amount,
            description: fullDescription,
            cashAccount: cashAccount.account_name,
            counterpartAccount: counterpartAccount.account_name,
          },
        },
        201
      );
    } catch (error) {
      if (client) {
        try {
          await client.query("ROLLBACK");
        } catch (rollbackError) {
          console.error("Voucher rollback error:", rollbackError);
        }
      }

      console.error(`POST ${voucherLabel} voucher error:`, error);

      if (error.code === "23505") {
        return response("Voucher number already exists. Please try again.", 409);
      }

      if (error.code === "23503") {
        return response("A selected account or user reference is invalid.", 400);
      }

      if (error.code === "23514") {
        return response("Voucher data violates a database constraint.", 400);
      }

      return response(
        `Unable to create ${voucherLabel.toLowerCase()} voucher.`,
        500
      );
    } finally {
      if (client) {
        client.release();
      }
    }
  }

  return { GET, POST };
}
