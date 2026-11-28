
import { NextResponse } from "next/server";
import pool from "@/lib/db";
import {
  getTenantContext,
  unauthorizedResponse,
} from "@/lib/tenant";

// =====================================================
// HELPERS
// =====================================================

function getCompanyId(tenant) {
  const companyId = Number(
    tenant.companyId ??
    tenant.company_id ??
    tenant.company?.company_id ??
    tenant.company?.companyId
  );

  if (!Number.isInteger(companyId) || companyId <= 0) {
    throw new Error("Unable to determine the current company.");
  }

  return companyId;
}

// =====================================================
// CENTRAL COMPANY-SPECIFIC JOURNAL NUMBER
// =====================================================

async function getNextJournalNumber(companyId, tenantClient) {
  const safeCompanyId = Number(companyId);

  if (
    !Number.isInteger(safeCompanyId) ||
    safeCompanyId <= 0
  ) {
    throw new Error("Invalid company ID for journal numbering.");
  }

  const sequenceName =
    `journal_entries_company_${safeCompanyId}_seq`;

  const sequenceReference = `public.${sequenceName}`;

  // Create the central sequence if it does not exist.
  await pool.query(`
    CREATE SEQUENCE IF NOT EXISTS
    public."${sequenceName}"
    START WITH 1
    INCREMENT BY 1
    MINVALUE 1
    NO CYCLE
  `);

  // Find the highest existing journal number in this tenant.
  // All records are included to prevent reuse of old numbers.
  const existingResult = await tenantClient.query(
    `
    SELECT COALESCE(
      MAX(SUBSTRING(journal_number FROM 4)::BIGINT),
      0
    ) AS last_number
    FROM journal_entries
    WHERE journal_number ~ '^JV-[0-9]+$'
    `
  );

  const existingNumber = Number(
    existingResult.rows[0]?.last_number || 0
  );

  // Read the central sequence position.
  const sequenceResult = await pool.query(
    `
    SELECT last_value, is_called
    FROM public."${sequenceName}"
    `
  );

  const sequenceState = sequenceResult.rows[0];

  const sequenceNumber = sequenceState.is_called
    ? Number(sequenceState.last_value)
    : 0;

  // Synchronize the central sequence with existing tenant records.
  const nextNumber =
    Math.max(existingNumber, sequenceNumber) + 1;

  if (
    !Number.isSafeInteger(nextNumber) ||
    nextNumber <= 0
  ) {
    throw new Error(
      "Unable to generate Journal Entry transaction number."
    );
  }

  await pool.query(
    `
    SELECT setval(
      $1::regclass,
      $2,
      TRUE
    )
    `,
    [sequenceReference, nextNumber]
  );

  return `JV-${String(nextNumber).padStart(6, "0")}`;
}

// =====================================================
// VALIDATE POSTING ACCOUNTS
// =====================================================

async function validatePostingAccounts(client, items) {
  const accountIds = [
    ...new Set(
      items.map((item) => Number(item.accountId))
    ),
  ];

  if (
    accountIds.some(
      (id) => !Number.isInteger(id) || id <= 0
    )
  ) {
    throw new Error("One or more account IDs are invalid.");
  }

  const result = await client.query(
    `
    SELECT
      a.account_id,
      a.account_code,
      a.account_name,
      a.account_type,
      a.is_group,
      a.is_active,
      EXISTS (
        SELECT 1
        FROM chart_of_accounts child
        WHERE child.parent_account_id = a.account_id
      ) AS has_children
    FROM chart_of_accounts a
    WHERE a.account_id = ANY($1::int[])
    `,
    [accountIds]
  );

  const accounts = new Map(
    result.rows.map((account) => [
      Number(account.account_id),
      account,
    ])
  );

  for (const accountId of accountIds) {
    const account = accounts.get(accountId);

    if (!account) {
      throw new Error(
        `Account ID ${accountId} does not exist.`
      );
    }

    if (!account.is_active) {
      throw new Error(
        `Account "${account.account_name}" is inactive and cannot receive transactions.`
      );
    }

    if (account.is_group || account.has_children) {
      throw new Error(
        `Account "${account.account_name}" is a summary account. Select its final-level child account instead.`
      );
    }
  }

  return accounts;
}

// =====================================================
// VALIDATE JOURNAL LINES
// =====================================================

function validateJournalItems(items) {
  if (
    !items ||
    !Array.isArray(items) ||
    items.length < 2
  ) {
    throw new Error(
      "At least two journal lines are required."
    );
  }

  let totalDebit = 0;
  let totalCredit = 0;

  for (const item of items) {
    const debit = Number(item.debit) || 0;
    const credit = Number(item.credit) || 0;

    if (!item.accountId) {
      throw new Error(
        "Every journal line requires an account."
      );
    }

    if (debit > 0 && credit > 0) {
      throw new Error(
        "A journal line cannot contain both debit and credit."
      );
    }

    if (debit <= 0 && credit <= 0) {
      throw new Error(
        "Every journal line must have a debit or credit amount."
      );
    }

    totalDebit += debit;
    totalCredit += credit;
  }

  if (Math.abs(totalDebit - totalCredit) > 1) {
    throw new Error(
      `Journal is not balanced. Debit: ${totalDebit.toFixed(
        2
      )}, Credit: ${totalCredit.toFixed(2)}`
    );
  }

  return { totalDebit, totalCredit };
}

// =====================================================
// RECALCULATE ACCOUNT BALANCES
// =====================================================

async function recalculateAccountBalances(client) {
  await client.query(
    `
    UPDATE chart_of_accounts a
    SET
      current_balance =
        a.opening_balance +
        COALESCE(
          (
            SELECT SUM(ji.debit - ji.credit)
            FROM journal_entry_lines ji
            INNER JOIN journal_entries j
              ON j.journal_id = ji.journal_id
            WHERE ji.account_id = a.account_id
              AND j.status = 'POSTED'
          ),
          0
        ),
      updated_at = CURRENT_TIMESTAMP
    `
  );
}

// =====================================================
// INSERT JOURNAL LINES
// =====================================================

async function insertJournalLines(client, journalId, items) {
  for (const item of items) {
    await client.query(
      `
      INSERT INTO journal_entry_lines (
        journal_id,
        entity_name,
        account_id,
        description,
        debit,
        credit
      )
      VALUES ($1, $2, $3, $4, $5, $6)
      `,
      [
        journalId,
        item.entityName?.trim() || null,
        item.accountId,
        item.description?.trim() || null,
        Number(item.debit) || 0,
        Number(item.credit) || 0,
      ]
    );
  }
}

// =====================================================
// GET JOURNAL ENTRIES
//
// GET /api/journal-entries
// GET /api/journal-entries?id=1
// =====================================================

export async function GET(request) {
  try {
    const tenant = await getTenantContext();

    if (!tenant) return unauthorizedResponse();

    const { db } = tenant;

    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    // ===================================================
    // GET SINGLE JOURNAL
    // ===================================================

    if (id) {
      const journalId = Number(id);

      if (
        !Number.isInteger(journalId) ||
        journalId <= 0
      ) {
        return NextResponse.json(
          {
            success: false,
            message: "Invalid journal ID.",
          },
          { status: 400 }
        );
      }

      const journalResult = await db.query(
        `
        SELECT
          j.journal_id,
          j.journal_number,
          j.journal_date,
          j.description,
          j.reference_type,
          j.reference_id,
          j.status,
          j.created_at,
          COALESCE(SUM(ji.debit), 0) AS total_debit,
          COALESCE(SUM(ji.credit), 0) AS total_credit
        FROM journal_entries j
        LEFT JOIN journal_entry_lines ji
          ON ji.journal_id = j.journal_id
        WHERE j.journal_id = $1
        GROUP BY j.journal_id
        `,
        [journalId]
      );

      if (journalResult.rows.length === 0) {
        return NextResponse.json(
          {
            success: false,
            message: "Journal entry not found.",
          },
          { status: 404 }
        );
      }

      const linesResult = await db.query(
        `
        SELECT
          ji.journal_line_id,
          ji.journal_id,
          ji.entity_name,
          ji.account_id,
          ji.description,
          ji.debit,
          ji.credit,
          a.account_code,
          a.account_name
        FROM journal_entry_lines ji
        INNER JOIN chart_of_accounts a
          ON a.account_id = ji.account_id
        WHERE ji.journal_id = $1
        ORDER BY ji.journal_line_id ASC
        `,
        [journalId]
      );

      return NextResponse.json({
        success: true,
        journal: journalResult.rows[0],
        lines: linesResult.rows,
      });
    }

    // ===================================================
    // GET ALL JOURNALS
    // ===================================================

    const result = await db.query(
      `
      SELECT
        j.journal_id,
        j.journal_number,
        j.journal_date,
        j.description,
        j.reference_type,
        j.reference_id,
        j.status,
        j.created_at,
        COALESCE(SUM(ji.debit), 0) AS total_debit,
        COALESCE(SUM(ji.credit), 0) AS total_credit
      FROM journal_entries j
      LEFT JOIN journal_entry_lines ji
        ON ji.journal_id = j.journal_id
      GROUP BY j.journal_id
      ORDER BY j.journal_id DESC
      `
    );

    return NextResponse.json({
      success: true,
      journals: result.rows,
    });
  } catch (error) {
    console.error("JOURNAL GET ERROR:", error);

    return NextResponse.json(
      {
        success: false,
        message: "Failed to load journal entries.",
        error: error.message,
      },
      { status: 500 }
    );
  }
}

// =====================================================
// CREATE JOURNAL
// POST /api/journal-entries
// =====================================================

export async function POST(request) {
  let client;

  try {
    const tenant = await getTenantContext();

    if (!tenant) return unauthorizedResponse();

    const { db } = tenant;
    const companyId = getCompanyId(tenant);

    client = await db.connect();

    const body = await request.json();

    const {
      journalDate,
      description,
      referenceType,
      referenceId,
      items,
    } = body;

    // ===================================================
    // VALIDATE LINES AND BALANCE
    // ===================================================

    validateJournalItems(items);

    await client.query("BEGIN");

    // ===================================================
    // LOCK JOURNAL NUMBER GENERATION
    // ===================================================

    await client.query(
      `
      SELECT pg_advisory_xact_lock(
        $1::integer,
        hashtext('journal_entries')::integer
      )
      `,
      [companyId]
    );

    // ===================================================
    // GENERATE CENTRAL COMPANY-SPECIFIC NUMBER
    // ===================================================

    const finalJournalNumber =
      await getNextJournalNumber(companyId, client);

    // ===================================================
    // CHECK DUPLICATE NUMBER
    // ===================================================

    const existing = await client.query(
      `
      SELECT journal_id
      FROM journal_entries
      WHERE journal_number = $1
      LIMIT 1
      `,
      [finalJournalNumber]
    );

    if (existing.rows.length > 0) {
      throw new Error(
        "Generated journal number already exists. Please try again."
      );
    }

    // ===================================================
    // CREATE JOURNAL
    // ===================================================

    const journalResult = await client.query(
      `
      INSERT INTO journal_entries (
        journal_number,
        journal_date,
        description,
        reference_type,
        reference_id,
        status
      )
      VALUES (
        $1,
        COALESCE($2::DATE, CURRENT_DATE),
        $3,
        $4,
        $5,
        'POSTED'
      )
      RETURNING *
      `,
      [
        finalJournalNumber,
        journalDate || null,
        description || null,
        referenceType || null,
        referenceId || null,
      ]
    );

    const journal = journalResult.rows[0];

    // ===================================================
    // INSERT JOURNAL LINES
    // ===================================================

    await insertJournalLines(
      client,
      journal.journal_id,
      items
    );

    // ===================================================
    // RECALCULATE ACCOUNT BALANCES
    // ===================================================

    await recalculateAccountBalances(client);

    await client.query("COMMIT");

    return NextResponse.json(
      {
        success: true,
        message: "Journal entry created successfully.",
        journal,
      },
      { status: 201 }
    );
  } catch (error) {
    try {
      await client?.query("ROLLBACK");
    } catch {}

    console.error("JOURNAL POST ERROR:", error);

    return NextResponse.json(
      {
        success: false,
        message:
          error.message ||
          "Failed to create journal entry.",
      },
      { status: 500 }
    );
  } finally {
    client?.release();
  }
}

// =====================================================
// UPDATE JOURNAL
// PUT /api/journal-entries
// =====================================================

export async function PUT(request) {
  let client;

  try {
    const tenant = await getTenantContext();

    if (!tenant) return unauthorizedResponse();

    const { db } = tenant;

    client = await db.connect();

    const body = await request.json();

    const journalId = Number(body.journalId);

    const {
      journalNumber,
      journalDate,
      description,
      referenceType,
      referenceId,
      items,
    } = body;

    // ===================================================
    // VALIDATE JOURNAL ID
    // ===================================================

    if (
      !Number.isInteger(journalId) ||
      journalId <= 0
    ) {
      return NextResponse.json(
        {
          success: false,
          message: "Invalid journal ID.",
        },
        { status: 400 }
      );
    }

    // ===================================================
    // VALIDATE LINES AND BALANCE
    // ===================================================

    validateJournalItems(items);

    await client.query("BEGIN");

    // ===================================================
    // CHECK JOURNAL
    // ===================================================

    const existingJournal = await client.query(
      `
      SELECT *
      FROM journal_entries
      WHERE journal_id = $1
      FOR UPDATE
      `,
      [journalId]
    );

    if (existingJournal.rows.length === 0) {
      await client.query("ROLLBACK");

      return NextResponse.json(
        {
          success: false,
          message: "Journal entry not found.",
        },
        { status: 404 }
      );
    }

    const currentJournal =
      existingJournal.rows[0];

    // ===================================================
    // KEEP EXISTING NUMBER UNLESS EXPLICITLY CHANGED
    // ===================================================

    // =====================================================
// PRESERVE THE ORIGINAL AUTO-GENERATED JOURNAL NUMBER
// =====================================================

const finalJournalNumber = currentJournal.journal_number;

    // ===================================================
    // CHECK DUPLICATE JOURNAL NUMBER
    // ===================================================

    const duplicate = await client.query(
      `
      SELECT journal_id
      FROM journal_entries
      WHERE journal_number = $1
        AND journal_id <> $2
      LIMIT 1
      `,
      [
        finalJournalNumber,
        journalId,
      ]
    );

    if (duplicate.rows.length > 0) {
      throw new Error(
        "Journal number already exists."
      );
    }

    const journalResult = await client.query(
  `
  UPDATE journal_entries
  SET
    journal_date = COALESCE($1::DATE, CURRENT_DATE),
    description = $2,
    reference_type = $3,
    reference_id = $4,
    status = 'POSTED'
  WHERE journal_id = $5
  RETURNING *
  `,
  [
    journalDate || null,
    description || null,
    referenceType || null,
    referenceId || null,
    journalId,
  ]
);

    const journal = journalResult.rows[0];

    // ===================================================
    // DELETE OLD JOURNAL LINES
    // ===================================================

    await client.query(
      `
      DELETE FROM journal_entry_lines
      WHERE journal_id = $1
      `,
      [journalId]
    );

    // ===================================================
    // INSERT UPDATED JOURNAL LINES
    // ===================================================

    await insertJournalLines(
      client,
      journalId,
      items
    );

    // ===================================================
    // RECALCULATE ACCOUNT BALANCES
    // ===================================================

    await recalculateAccountBalances(client);

    await client.query("COMMIT");

    return NextResponse.json({
      success: true,
      message: "Journal entry updated successfully.",
      journal,
    });
  } catch (error) {
    try {
      await client?.query("ROLLBACK");
    } catch {}

    console.error("JOURNAL PUT ERROR:", error);

    return NextResponse.json(
      {
        success: false,
        message:
          error.message ||
          "Failed to update journal entry.",
      },
      { status: 500 }
    );
  } finally {
    client?.release();
  }
}
