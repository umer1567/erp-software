
import { Pool } from "pg";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error(
    "DATABASE_URL is missing. Configure it in your deployment environment."
  );
}

const globalForPostgres = globalThis;

const pool =
  globalForPostgres.pgPool ||
  new Pool({
    connectionString,

    // Render PostgreSQL requires SSL for external connections.
    ssl:
      process.env.NODE_ENV === "production"
        ? { rejectUnauthorized: false }
        : false,

    max: 5,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000,
    allowExitOnIdle: false,
    keepAlive: true,
    keepAliveInitialDelayMillis: 10000,
  });

// Reuse the pool across requests in the same server instance.
globalForPostgres.pgPool = pool;

pool.on("connect", () => {
  console.info("[DATABASE] PostgreSQL connection established.");
});

pool.on("error", (error) => {
  console.error("[DATABASE] Unexpected PostgreSQL pool error:", error.message);
});

export default pool;
