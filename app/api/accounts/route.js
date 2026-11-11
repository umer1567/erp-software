
import { NextResponse } from "next/server";
import pool from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { hasPermission } from "@/lib/permissions";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const PERMISSION_KEY = "chart_of_accounts";

const ALLOWED_ACCOUNT_TYPES = [
  "ASSET",
  "LIABILITY",
  "EQUITY",
  "REVENUE",
  "EXPENSE",
];

const ACCOUNT_SELECT = `
  account_id,
  account_code,
  account_name,
  account_type,
  parent_account_id,
  opening_balance,
  current_balance,
  is_active,
  is_group,
  is_cash_bank,
  created_at,
  updated_at
`;

// =====================================================
// RESPONSE HELPERS
// =====================================================

function errorResponse(message, status) {
  return NextResponse.json(
    {
      success: false,
      message,
    },
    {
      status,
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate",
      },
    }
  );
}

function successResponse(data, status = 200) {
  return NextResponse.json(data, {
    status,
    headers: {
      "Cache-Control": "no-store, no-cache, must-revalidate",
    },
  });
}

function handleDatabaseError(error, operation) {
  console.error(`${operation} ERROR:`, error);

  if (error.code === "23505") {
    return errorResponse("Account code already exists.", 409);
  }

  if (error.code === "23503") {
    return errorResponse(
      "Selected parent account does not exist.",
      400
    );
  }

  if (error.code === "23514") {
    return errorResponse(
      "Account data violates a database constraint.",
      400
    );
  }

  return errorResponse(
    "An unexpected error occurred while processing the account.",
    500
  );
}

// =====================================================
// AUTHENTICATION AND PERMISSION CHECK
// ADMIN IS ALSO SUBJECT TO ROLE PERMISSIONS
// =====================================================

async function authorizeAccountPermission(action) {
  let user;

  try {
    user = await getCurrentUser();
  } catch (error) {
    console.error("Authentication lookup failed:", error);

    return {
      allowed: false,
      response: errorResponse(
        "Unable to verify your login session.",
        500
      ),
    };
  }

  if (!user) {
    return {
      allowed: false,
      response: errorResponse(
        "Authentication required. Please log in.",
        401
      ),
    };
  }

  const roleId = user.roleId ?? user.role_id;

  if (
    roleId === null ||
    roleId === undefined ||
    !Number.isInteger(Number(roleId)) ||
    Number(roleId) <= 0
  ) {
    return {
      allowed: false,
      response: errorResponse(
        "Your account does not have a valid role.",
        403
      ),
    };
  }

  try {
    const allowed = await hasPermission(
      Number(roleId),
      PERMISSION_KEY,
      action
    );

    console.log("[CHART OF ACCOUNTS PERMISSION CHECK]", {
      roleId: Number(roleId),
      roleName: user.roleName ?? user.role_name ?? null,
      permissionKey: PERMISSION_KEY,
      action,
      allowed,
    });

    if (allowed !== true) {
      return {
        allowed: false,
        response: errorResponse(
          `Permission denied. You do not have ${action} access to the Chart of Accounts.`,
          403
        ),
      };
    }

    return {
      allowed: true,
      user,
    };
  } catch (error) {
    console.error(
      "Chart of Accounts permission check failed:",
      error
    );

    return {
      allowed: false,
      response: errorResponse(
        "Unable to verify your permissions.",
        500
      ),
    };
  }
}

// =====================================================
// INPUT HELPERS
// =====================================================

function parseParentId(value) {
  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return null;
  }

  const id = Number(value);

  if (!Number.isInteger(id) || id <= 0) {
    return null;
  }

  return id;
}

function parseNumber(value, defaultValue = 0) {
  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return defaultValue;
  }

  return Number(value);
}

function parseBoolean(value, defaultValue = false) {
  if (value === undefined || value === null) {
    return defaultValue;
  }

  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value === "string") {
    const normalized = value.toLowerCase().trim();

    if (normalized === "true") return true;
    if (normalized === "false") return false;

    return defaultValue;
  }

  if (typeof value === "number") {
    return value === 1;
  }

  return defaultValue;
}

function validateAccountBody(body) {
  if (
    !body ||
    typeof body !== "object" ||
    Array.isArray(body)
  ) {
    return {
      error: "Invalid account data.",
    };
  }

  const accountCode = String(
    body.account_code ?? ""
  ).trim();

  const accountName = String(
    body.account_name ?? ""
  ).trim();

  const accountType = String(
    body.account_type ?? ""
  )
    .trim()
    .toUpperCase();

  const parentAccountId = parseParentId(
    body.parent_account_id
  );

  const openingBalance = parseNumber(
    body.opening_balance,
    0
  );

  const isActive = parseBoolean(
    body.is_active,
    true
  );

  const isGroup = parseBoolean(
    body.is_group,
    false
  );

  const isCashBank = parseBoolean(
    body.is_cash_bank,
    false
  );

  if (!accountCode) {
    return {
      error: "Account code is required.",
    };
  }

  if (!accountName) {
    return {
      error: "Account name is required.",
    };
  }

  if (!ALLOWED_ACCOUNT_TYPES.includes(accountType)) {
    return {
      error:
        "Invalid account type. Allowed values: ASSET, LIABILITY, EQUITY, REVENUE, EXPENSE.",
    };
  }

  if (!Number.isFinite(openingBalance)) {
    return {
      error: "Opening balance must be a valid number.",
    };
  }

  if (
    body.parent_account_id !== null &&
    body.parent_account_id !== undefined &&
    body.parent_account_id !== "" &&
    parentAccountId === null
  ) {
    return {
      error: "Invalid parent account.",
    };
  }

  return {
    data: {
      accountCode,
      accountName,
      accountType,
      parentAccountId,
      openingBalance,
      isActive,
      isGroup,
      isCashBank,
    },
  };
}

// =====================================================
// VALIDATE PARENT ACCOUNT
// =====================================================

async function validateParentAccount(
  client,
  parentAccountId
) {
  if (parentAccountId === null) {
    return null;
  }

  const result = await client.query(
    `
      SELECT
        account_id,
        account_code,
        account_name,
        is_group
      FROM chart_of_accounts
      WHERE account_id = $1
      LIMIT 1
    `,
    [parentAccountId]
  );

  if (result.rows.length === 0) {
    return "Selected parent account does not exist.";
  }

  if (!result.rows[0].is_group) {
    return "Parent account must be a Summary Account.";
  }

  return null;
}

// =====================================================
// GET ALL ACCOUNTS
// Requires: chart_of_accounts -> can_view
// =====================================================

export async function GET() {
  const authorization =
    await authorizeAccountPermission("view");

  if (!authorization.allowed) {
    return authorization.response;
  }

  const roleId = Number(
    authorization.user.roleId ??
      authorization.user.role_id
  );

  try {
    // Fetch the accounts and the remaining permissions.
    // ADMIN is not granted implicit access here.
    const [accountsResult, createAllowed, updateAllowed, deleteAllowed] =
      await Promise.all([
        pool.query(`
          SELECT
            ${ACCOUNT_SELECT}
          FROM chart_of_accounts
          ORDER BY account_code ASC
        `),
        hasPermission(roleId, PERMISSION_KEY, "create"),
        hasPermission(roleId, PERMISSION_KEY, "update"),
        hasPermission(roleId, PERMISSION_KEY, "delete"),
      ]);

    return successResponse({
      success: true,
      accounts: accountsResult.rows,
      permissions: {
        canView: true,
        canCreate: createAllowed === true,
        canUpdate: updateAllowed === true,
        canDelete: deleteAllowed === true,
      },
    });
  } catch (error) {
    return handleDatabaseError(
      error,
      "GET /api/accounts"
    );
  }
}

// =====================================================
// CREATE ACCOUNT
// Requires: chart_of_accounts -> can_create
// =====================================================

export async function POST(request) {
  const authorization =
    await authorizeAccountPermission("create");

  if (!authorization.allowed) {
    return authorization.response;
  }

  let body;

  try {
    body = await request.json();
  } catch {
    return errorResponse(
      "Invalid JSON request body.",
      400
    );
  }

  const validation = validateAccountBody(body);

  if (validation.error) {
    return errorResponse(validation.error, 400);
  }

  const {
    accountCode,
    accountName,
    accountType,
    parentAccountId,
    openingBalance,
    isActive,
    isGroup,
    isCashBank,
  } = validation.data;

  let client;

  try {
    client = await pool.connect();

    await client.query("BEGIN");

    const duplicateResult = await client.query(
      `
        SELECT account_id
        FROM chart_of_accounts
        WHERE account_code = $1
        LIMIT 1
      `,
      [accountCode]
    );

    if (duplicateResult.rows.length > 0) {
      await client.query("ROLLBACK");

      return errorResponse(
        `Account code ${accountCode} already exists.`,
        409
      );
    }

    const parentError = await validateParentAccount(
      client,
      parentAccountId
    );

    if (parentError) {
      await client.query("ROLLBACK");

      return errorResponse(parentError, 400);
    }

    const result = await client.query(
      `
        INSERT INTO chart_of_accounts (
          account_code,
          account_name,
          account_type,
          parent_account_id,
          opening_balance,
          current_balance,
          is_active,
          is_group,
          is_cash_bank,
          created_at,
          updated_at
        )
        VALUES (
          $1, $2, $3, $4, $5, $5, $6, $7, $8,
          CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
        )
        RETURNING ${ACCOUNT_SELECT}
      `,
      [
        accountCode,
        accountName,
        accountType,
        parentAccountId,
        openingBalance,
        isActive,
        isGroup,
        isCashBank,
      ]
    );

    await client.query("COMMIT");

    return successResponse(
      {
        success: true,
        message: "Account created successfully.",
        account: result.rows[0],
      },
      201
    );
  } catch (error) {
    if (client) {
      try {
        await client.query("ROLLBACK");
      } catch (rollbackError) {
        console.error(
          "Account creation rollback failed:",
          rollbackError
        );
      }
    }

    return handleDatabaseError(
      error,
      "POST /api/accounts"
    );
  } finally {
    if (client) {
      client.release();
    }
  }
}

// =====================================================
// UPDATE ACCOUNT
// Requires: chart_of_accounts -> can_update
// =====================================================

export async function PUT(request) {
  const authorization =
    await authorizeAccountPermission("update");

  if (!authorization.allowed) {
    return authorization.response;
  }

  let body;

  try {
    body = await request.json();
  } catch {
    return errorResponse(
      "Invalid JSON request body.",
      400
    );
  }

  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return errorResponse(
      "Invalid account data.",
      400
    );
  }

  const accountId = Number(body.account_id);

  if (
    !Number.isInteger(accountId) ||
    accountId <= 0
  ) {
    return errorResponse(
      "Invalid account ID.",
      400
    );
  }

  const validation = validateAccountBody(body);

  if (validation.error) {
    return errorResponse(validation.error, 400);
  }

  const {
    accountCode,
    accountName,
    accountType,
    parentAccountId,
    openingBalance,
    isActive,
    isGroup,
    isCashBank,
  } = validation.data;

  let client;

  try {
    client = await pool.connect();

    await client.query("BEGIN");

    const existingResult = await client.query(
      `
        SELECT
          account_id,
          account_code,
          account_name,
          account_type,
          parent_account_id,
          opening_balance,
          current_balance,
          is_active,
          is_group,
          is_cash_bank
        FROM chart_of_accounts
        WHERE account_id = $1
        FOR UPDATE
      `,
      [accountId]
    );

    if (existingResult.rows.length === 0) {
      await client.query("ROLLBACK");

      return errorResponse(
        "Account not found.",
        404
      );
    }

    const existing = existingResult.rows[0];

    if (
      parentAccountId !== null &&
      parentAccountId === accountId
    ) {
      await client.query("ROLLBACK");

      return errorResponse(
        "An account cannot be its own parent.",
        400
      );
    }

    const childrenResult = await client.query(
      `
        SELECT COUNT(*)::int AS child_count
        FROM chart_of_accounts
        WHERE parent_account_id = $1
      `,
      [accountId]
    );

    const childCount = Number(
      childrenResult.rows[0]?.child_count ?? 0
    );

    if (!isGroup && childCount > 0) {
      await client.query("ROLLBACK");

      return errorResponse(
        "This account has child accounts. It must remain a Summary Account until all child accounts are moved.",
        400
      );
    }

    const duplicateResult = await client.query(
      `
        SELECT account_id
        FROM chart_of_accounts
        WHERE account_code = $1
          AND account_id <> $2
        LIMIT 1
      `,
      [accountCode, accountId]
    );

    if (duplicateResult.rows.length > 0) {
      await client.query("ROLLBACK");

      return errorResponse(
        `Account code ${accountCode} already exists.`,
        409
      );
    }

    const parentError = await validateParentAccount(
      client,
      parentAccountId
    );

    if (parentError) {
      await client.query("ROLLBACK");

      return errorResponse(parentError, 400);
    }

    // Prevent circular account hierarchies.
    let checkParentId = parentAccountId;
    const visitedParents = new Set();

    while (checkParentId !== null) {
      if (visitedParents.has(checkParentId)) {
        await client.query("ROLLBACK");

        return errorResponse(
          "Circular account hierarchy detected.",
          400
        );
      }

      visitedParents.add(checkParentId);

      if (checkParentId === accountId) {
        await client.query("ROLLBACK");

        return errorResponse(
          "You cannot move an account under one of its own children.",
          400
        );
      }

      const parentChainResult = await client.query(
        `
          SELECT parent_account_id
          FROM chart_of_accounts
          WHERE account_id = $1
          LIMIT 1
        `,
        [checkParentId]
      );

      if (parentChainResult.rows.length === 0) {
        break;
      }

      const nextParent =
        parentChainResult.rows[0].parent_account_id;

      checkParentId =
        nextParent === null
          ? null
          : Number(nextParent);
    }

    // Preserve the current balance while adjusting for
    // any change in opening balance.
    const oldOpeningBalance = Number(
      existing.opening_balance ?? 0
    );

    const oldCurrentBalance = Number(
      existing.current_balance ?? 0
    );

    const openingDifference =
      openingBalance - oldOpeningBalance;

    const newCurrentBalance =
      oldCurrentBalance + openingDifference;

    const updateResult = await client.query(
      `
        UPDATE chart_of_accounts
        SET
          account_code = $1,
          account_name = $2,
          account_type = $3,
          parent_account_id = $4,
          opening_balance = $5,
          current_balance = $6,
          is_active = $7,
          is_group = $8,
          is_cash_bank = $9,
          updated_at = CURRENT_TIMESTAMP
        WHERE account_id = $10
        RETURNING ${ACCOUNT_SELECT}
      `,
      [
        accountCode,
        accountName,
        accountType,
        parentAccountId,
        openingBalance,
        newCurrentBalance,
        isActive,
        isGroup,
        isCashBank,
        accountId,
      ]
    );

    await client.query("COMMIT");

    return successResponse({
      success: true,
      message: "Account updated successfully.",
      account: updateResult.rows[0],
    });
  } catch (error) {
    if (client) {
      try {
        await client.query("ROLLBACK");
      } catch (rollbackError) {
        console.error(
          "Account update rollback failed:",
          rollbackError
        );
      }
    }

    return handleDatabaseError(
      error,
      "PUT /api/accounts"
    );
  } finally {
    if (client) {
      client.release();
    }
  }
}
