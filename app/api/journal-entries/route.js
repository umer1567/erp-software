import { NextResponse } from "next/server";
import pool from "@/lib/db";

// =====================================================
// GET JOURNAL ENTRIES
//
// GET /api/journal-entries
// GET /api/journal-entries?id=1
// =====================================================

export async function GET(request) {
  try {
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

      const journalResult = await pool.query(
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

          COALESCE(
            SUM(ji.debit),
            0
          ) AS total_debit,

          COALESCE(
            SUM(ji.credit),
            0
          ) AS total_credit

        FROM journal_entries j

        LEFT JOIN journal_entry_lines ji
          ON ji.journal_id = j.journal_id

        WHERE j.journal_id = $1

        GROUP BY
          j.journal_id
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

      // =================================================
      // GET JOURNAL LINES
      // =================================================

      const linesResult = await pool.query(
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

        ORDER BY
          ji.journal_line_id ASC
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

    const result = await pool.query(`
      SELECT
        j.journal_id,
        j.journal_number,
        j.journal_date,
        j.description,
        j.reference_type,
        j.reference_id,
        j.status,
        j.created_at,

        COALESCE(
          SUM(ji.debit),
          0
        ) AS total_debit,

        COALESCE(
          SUM(ji.credit),
          0
        ) AS total_credit

      FROM journal_entries j

      LEFT JOIN journal_entry_lines ji
        ON ji.journal_id = j.journal_id

      GROUP BY
        j.journal_id

      ORDER BY
        j.journal_id DESC
    `);

    return NextResponse.json({
      success: true,
      journals: result.rows,
    });
  } catch (error) {
    console.error(
      "JOURNAL GET ERROR:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        message:
          "Failed to load journal entries.",
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
  const client = await pool.connect();

  try {
    const body = await request.json();

    const {
      journalNumber,
      journalDate,
      description,
      referenceType,
      referenceId,
      items,
    } = body;

    // ===================================================
    // VALIDATE LINES
    // ===================================================

    if (
      !items ||
      !Array.isArray(items) ||
      items.length < 2
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "At least two journal lines are required.",
        },
        { status: 400 }
      );
    }

    let totalDebit = 0;
    let totalCredit = 0;

    for (const item of items) {
      const debit =
        Number(item.debit) || 0;

      const credit =
        Number(item.credit) || 0;

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

    // ===================================================
    // CHECK BALANCE
    // ===================================================

    if (
      Math.abs(
        totalDebit - totalCredit
      ) > 0.01
    ) {
      throw new Error(
        `Journal is not balanced. Debit: ${totalDebit.toFixed(
          2
        )}, Credit: ${totalCredit.toFixed(
          2
        )}`
      );
    }

    await client.query("BEGIN");

    // ===================================================
    // JOURNAL NUMBER
    // ===================================================

    let finalJournalNumber =
      journalNumber?.trim();

    if (!finalJournalNumber) {
      finalJournalNumber =
        `JV-${Date.now()}`;
    }

    // ===================================================
    // CHECK DUPLICATE NUMBER
    // ===================================================

    const existing =
      await client.query(
        `
        SELECT journal_id
        FROM journal_entries
        WHERE journal_number = $1
        `,
        [finalJournalNumber]
      );

    if (existing.rows.length > 0) {
      throw new Error(
        "Journal number already exists."
      );
    }

    // ===================================================
    // CREATE JOURNAL
    // ===================================================

    const journalResult =
      await client.query(
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

    const journal =
      journalResult.rows[0];

    // ===================================================
    // INSERT JOURNAL LINES
    // ===================================================

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
        VALUES (
          $1,
          $2,
          $3,
          $4,
          $5,
          $6
        )
        `,
        [
          journal.journal_id,

          // ENTITY NAME
          item.entityName?.trim() || null,

          item.accountId,

          item.description?.trim() || null,

          Number(item.debit) || 0,

          Number(item.credit) || 0,
        ]
      );
    }

    // ===================================================
    // RECALCULATE ACCOUNT BALANCES
    // ===================================================

    await client.query(
      `
      UPDATE chart_of_accounts a
      SET
        current_balance =
          a.opening_balance +
          COALESCE(
            (
              SELECT
                SUM(
                  ji.debit - ji.credit
                )
              FROM journal_entry_lines ji

              INNER JOIN journal_entries j
                ON j.journal_id =
                   ji.journal_id

              WHERE
                ji.account_id =
                  a.account_id

                AND j.status =
                  'POSTED'
            ),
            0
          ),

        updated_at =
          CURRENT_TIMESTAMP
      `
    );

    await client.query("COMMIT");

    return NextResponse.json(
      {
        success: true,
        message:
          "Journal entry created successfully.",
        journal,
      },
      { status: 201 }
    );
  } catch (error) {
    try {
      await client.query("ROLLBACK");
    } catch {}

    console.error(
      "JOURNAL POST ERROR:",
      error
    );

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
    client.release();
  }
}

// =====================================================
// UPDATE JOURNAL
// PUT /api/journal-entries
// =====================================================

export async function PUT(request) {
  const client = await pool.connect();

  try {
    const body = await request.json();

    const journalId =
      Number(body.journalId);

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
    // VALIDATE ITEMS
    // ===================================================

    if (
      !items ||
      !Array.isArray(items) ||
      items.length < 2
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "At least two journal lines are required.",
        },
        { status: 400 }
      );
    }

    let totalDebit = 0;
    let totalCredit = 0;

    for (const item of items) {
      const debit =
        Number(item.debit) || 0;

      const credit =
        Number(item.credit) || 0;

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

    // ===================================================
    // CHECK BALANCE
    // ===================================================

    if (
      Math.abs(
        totalDebit - totalCredit
      ) > 0.01
    ) {
      throw new Error(
        `Journal is not balanced. Debit: ${totalDebit.toFixed(
          2
        )}, Credit: ${totalCredit.toFixed(
          2
        )}`
      );
    }

    await client.query("BEGIN");

    // ===================================================
    // CHECK JOURNAL
    // ===================================================

    const existingJournal =
      await client.query(
        `
        SELECT *
        FROM journal_entries
        WHERE journal_id = $1
        FOR UPDATE
        `,
        [journalId]
      );

    if (
      existingJournal.rows.length === 0
    ) {
      await client.query("ROLLBACK");

      return NextResponse.json(
        {
          success: false,
          message:
            "Journal entry not found.",
        },
        { status: 404 }
      );
    }

    // ===================================================
    // CHECK DUPLICATE JOURNAL NUMBER
    // ===================================================

    const finalJournalNumber =
      journalNumber?.trim() ||
      `JV-${Date.now()}`;

    const duplicate =
      await client.query(
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

    // ===================================================
    // UPDATE JOURNAL HEADER
    // ===================================================

    const journalResult =
      await client.query(
        `
        UPDATE journal_entries
        SET
          journal_number = $1,

          journal_date =
            COALESCE(
              $2::DATE,
              CURRENT_DATE
            ),

          description = $3,

          reference_type = $4,

          reference_id = $5,

          status = 'POSTED'

        WHERE journal_id = $6

        RETURNING *
        `,
        [
          finalJournalNumber,
          journalDate || null,
          description || null,
          referenceType || null,
          referenceId || null,
          journalId,
        ]
      );

    const journal =
      journalResult.rows[0];

    // ===================================================
    // DELETE OLD LINES
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
        VALUES (
          $1,
          $2,
          $3,
          $4,
          $5,
          $6
        )
        `,
        [
          journalId,

          // ENTITY NAME
          item.entityName?.trim() || null,

          item.accountId,

          item.description?.trim() || null,

          Number(item.debit) || 0,

          Number(item.credit) || 0,
        ]
      );
    }

    // ===================================================
    // RECALCULATE ALL ACCOUNT BALANCES
    // ===================================================

    await client.query(
      `
      UPDATE chart_of_accounts a
      SET
        current_balance =
          a.opening_balance +
          COALESCE(
            (
              SELECT
                SUM(
                  ji.debit - ji.credit
                )
              FROM journal_entry_lines ji

              INNER JOIN journal_entries j
                ON j.journal_id =
                   ji.journal_id

              WHERE
                ji.account_id =
                  a.account_id

                AND j.status =
                  'POSTED'
            ),
            0
          ),

        updated_at =
          CURRENT_TIMESTAMP
      `
    );

    await client.query("COMMIT");

    return NextResponse.json({
      success: true,
      message:
        "Journal entry updated successfully.",
      journal,
    });
  } catch (error) {
    try {
      await client.query("ROLLBACK");
    } catch {}

    console.error(
      "JOURNAL PUT ERROR:",
      error
    );

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
    client.release();
  }
}