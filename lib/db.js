import { Pool } from "pg";
import { applyTenantMigrations, pinCompanyId } from "./tenant-migrations.js";
import {
  COMPANY_DATABASE_PATTERN,
  companyDatabaseName,
  companyDatabaseNameError,
} from "./tenant-tables.js";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error(
    "DATABASE_URL is missing. Configure it in your deployment environment."
  );
}

// Server (host, port, credentials) that holds the per-company databases.
// Defaults to the central server. Only the database name in it is replaced.
const tenantServerUrl =
  process.env.TENANT_DATABASE_URL || connectionString;

const globalForPostgres = globalThis;

const configuredPoolMax = Number(process.env.PG_POOL_MAX || 5);

const poolMax =
  Number.isInteger(configuredPoolMax) &&
  configuredPoolMax >= 1 &&
  configuredPoolMax <= 30
    ? configuredPoolMax
    : 5;

const ssl =
  process.env.NODE_ENV === "production"
    ? { rejectUnauthorized: false }
    : false;

// --------------------------------------------------
// CENTRAL DATABASE: erp_system
// Existing ERP APIs continue using this pool.
// --------------------------------------------------

const pool =
  globalForPostgres.pgPool ||
  new Pool({
    connectionString,
    ssl,
    max: poolMax,
    min: 0,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000,
    allowExitOnIdle: false,
    keepAlive: true,
    keepAliveInitialDelayMillis: 10000,
    application_name: "GoldenLakeERP",
  });

globalForPostgres.pgPool = pool;

// --------------------------------------------------
// COMPANY DATABASE POOLS
// --------------------------------------------------

const companyPools =
  globalForPostgres.pgCompanyPools ||
  new Map();

globalForPostgres.pgCompanyPools = companyPools;

// company_id -> database_name for ACTIVE companies (avoids a central
// lookup on every request). Cleared by forgetCompanyDatabase().
const activeDatabaseNames =
  globalForPostgres.pgActiveCompanyDatabases ||
  new Map();

globalForPostgres.pgActiveCompanyDatabases = activeDatabaseNames;

// Name of the central database (normally erp_system); no company may use it.
export const CENTRAL_DATABASE_NAME = decodeURIComponent(
  new URL(connectionString).pathname.replace(/^\//, "")
);

function companyDatabaseUrl(databaseName) {
  if (!COMPANY_DATABASE_PATTERN.test(databaseName)) {
    throw new Error("Invalid company database name.");
  }

  // Tenant server and credentials; only the database changes.
  const companyUrl = new URL(tenantServerUrl);
  companyUrl.pathname = `/${databaseName}`;

  return companyUrl.toString();
}

function poolForDatabase(databaseName, companyId) {
  if (companyPools.has(databaseName)) {
    return companyPools.get(databaseName);
  }

  const companyPool = new Pool({
    connectionString: companyDatabaseUrl(databaseName),
    ssl,
    max: poolMax,
    min: 0,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000,
    allowExitOnIdle: false,
    keepAlive: true,
    keepAliveInitialDelayMillis: 10000,
    application_name: `GoldenLakeERP-Company-${companyId}`,
  });

  companyPool.on("error", (error) => {
    console.error(
      `[DATABASE] Company ${companyId} pool error:`,
      error.message
    );
  });

  companyPools.set(databaseName, companyPool);

  return companyPool;
}

export function forgetCompanyDatabase(companyId) {
  activeDatabaseNames.delete(Number(companyId));
}

/**
 * Get the PostgreSQL connection pool for a company.
 *
 * The company database name is retrieved from the central
 * erp_system.company_databases table. Only ACTIVE databases are
 * returned; anything else throws. There is NO fallback to erp_system.
 */
export async function getCompanyPool(companyId) {
  const id = Number(companyId);

  if (!Number.isSafeInteger(id) || id <= 0) {
    throw new Error("Invalid company ID.");
  }

  let databaseName = activeDatabaseNames.get(id);

  if (!databaseName) {
    const result = await pool.query(
      `SELECT database_name, status
       FROM company_databases
       WHERE company_id = $1
       LIMIT 1`,
      [id]
    );

    if (result.rows.length === 0) {
      throw new Error(`No database is configured for company ${id}.`);
    }

    if (result.rows[0].status !== "ACTIVE") {
      throw new Error(
        `Company database is not ready. Current status: ${result.rows[0].status}.`
      );
    }

    databaseName = result.rows[0].database_name;
    activeDatabaseNames.set(id, databaseName);
  }

  return poolForDatabase(databaseName, id);
}

// --------------------------------------------------
// DATABASE CONNECTION EVENTS
// --------------------------------------------------

pool.on("connect", () => {
  console.info(
    "[DATABASE] Central PostgreSQL connection established."
  );
});

pool.on("error", (error) => {
  console.error(
    "[DATABASE] Unexpected central pool error:",
    error.message
  );
});


/**
 * Create an empty PostgreSQL database for a newly registered company.
 * The company record must already be committed in erp_system.
 */

export async function provisionCompanyDatabase(companyId) {
  const id = Number(companyId);

  if (!Number.isSafeInteger(id) || id <= 0) {
    throw new Error("Invalid company ID for database provisioning.");
  }

  let databaseName = null;

  forgetCompanyDatabase(id);

  try {
    const companyResult = await pool.query(
      `SELECT company_id, company_name FROM companies WHERE company_id = $1`,
      [id]
    );

    if (!companyResult.rows.length) {
      throw new Error(`Company ${id} does not exist.`);
    }

    const existingMapping = await pool.query(
      `
      SELECT database_name, status
      FROM company_databases
      WHERE company_id = $1
      `,
      [id]
    );

    // A company keeps its database name for life (a later rename of the
    // company must not point it at a different database).
    const alreadyMapped = existingMapping.rows.length > 0;

    if (alreadyMapped) {
      databaseName = existingMapping.rows[0].database_name;
    } else {
      const { company_name: companyName } = companyResult.rows[0];
      const nameError = companyDatabaseNameError(companyName, CENTRAL_DATABASE_NAME);

      if (nameError) {
        throw new Error(nameError);
      }

      // "Alpha Traders" -> erp_alpha_traders
      databaseName = companyDatabaseName(companyName, id);
    }

    if (
      !COMPANY_DATABASE_PATTERN.test(databaseName) ||
      databaseName === CENTRAL_DATABASE_NAME
    ) {
      throw new Error(`Invalid company database name: ${databaseName}`);
    }

    // Save or refresh the central database mapping.
    await pool.query(
      `
      INSERT INTO company_databases (
        company_id,
        database_name,
        status,
        schema_version,
        created_at,
        updated_at
      )
      VALUES (
        $1, $2, 'PROVISIONING', 0,
        CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
      )
      ON CONFLICT (company_id)
      DO UPDATE SET
        status = 'PROVISIONING',
        updated_at = CURRENT_TIMESTAMP
      `,
      [id, databaseName]
    );

    // Create the database on the tenant server (it may differ from the
    // central server), using its maintenance database.
    const adminUrl = new URL(tenantServerUrl);
    adminUrl.pathname = "/postgres";

    const adminPool = new Pool({
      connectionString: adminUrl.toString(),
      ssl,
      max: 1,
      application_name: `GoldenLakeERP-CreateDB-${id}`,
    });

    try {
      const existingDatabase = await adminPool.query(
        "SELECT 1 FROM pg_database WHERE datname = $1",
        [databaseName]
      );

      // Never take over a database this company did not create (for
      // example one left behind by a deleted company with the same name).
      if (existingDatabase.rows.length && !alreadyMapped) {
        throw new Error(
          `Database ${databaseName} already exists and does not belong to company ${id}.`
        );
      }

      if (!existingDatabase.rows.length) {
        try {
          // databaseName is validated against COMPANY_DATABASE_PATTERN.
          await adminPool.query(`CREATE DATABASE "${databaseName}"`);
        } catch (error) {
          // Another simultaneous registration/retry may have created it.
          if (error.code !== "42P04") {
            throw error;
          }
        }
      }

      const verification = await adminPool.query(
        "SELECT 1 FROM pg_database WHERE datname = $1",
        [databaseName]
      );

      if (!verification.rows.length) {
        throw new Error(
          `Database ${databaseName} was not found after creation.`
        );
      }
    } finally {
      await adminPool.end();
    }

    // Create tables and starter data inside the company database.
    const migrationPool = new Pool({
      connectionString: companyDatabaseUrl(databaseName),
      ssl,
      max: 1,
      application_name: `GoldenLakeERP-Provision-${id}`,
    });

    let migration;

    try {
      const client = await migrationPool.connect();

      try {
        migration = await applyTenantMigrations(client);
        await pinCompanyId(client, id);
      } finally {
        client.release();
      }
    } finally {
      await migrationPool.end();
    }

    // Mark the mapping ACTIVE only after verification.
    const activation = await pool.query(
      `
      UPDATE company_databases
      SET status = 'ACTIVE',
          schema_version = $3,
          updated_at = CURRENT_TIMESTAMP
      WHERE company_id = $1
        AND database_name = $2
      RETURNING company_id, database_name, status, schema_version
      `,
      [id, databaseName, migration.toVersion]
    );

    if (!activation.rows.length) {
      throw new Error(
        "Database exists, but its central mapping could not be activated."
      );
    }

    console.info("[DATABASE PROVISIONING] Successful:", {
      companyId: id,
      databaseName,
      status: "ACTIVE",
      schemaVersion: migration.toVersion,
      applied: migration.applied,
    });

    return {
      databaseName,
      status: "ACTIVE",
      schemaVersion: migration.toVersion,
    };
  } catch (error) {
    console.error("[DATABASE PROVISIONING] Failed:", {
      companyId: id,
      databaseName,
      message: error.message,
      code: error.code,
      detail: error.detail,
      constraint: error.constraint,
      table: error.table,
      schema: error.schema,
      where: error.where,
    });

    await pool.query(
      `
      UPDATE company_databases
      SET status = 'FAILED',
          updated_at = CURRENT_TIMESTAMP
      WHERE company_id = $1
        AND database_name = $2
      `,
      [id, databaseName]
    ).catch((updateError) => {
      console.error(
        "[DATABASE PROVISIONING] Failed to update mapping:",
        updateError.message
      );
    });

    throw error;
  }
}

/**
 * Get the operational (per-company) database for an authenticated company.
 * Throws unless the company has an ACTIVE database. Never returns erp_system.
 */
export async function getOperationalPool(companyId) {
  return getCompanyPool(companyId);
}

/**
 * Operational database for the user returned by getCurrentUser().
 */
export async function getTenantDb(user) {
  const companyId = user?.companyId ?? user?.company_id;

  if (!companyId) {
    throw new Error("Authenticated user has no company.");
  }

  return getCompanyPool(companyId);
}

export default pool;
