import { Pool } from "pg";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error(
    "DATABASE_URL is missing. Check your .env.local file."
  );
}

const globalForPostgres = globalThis;

const pool =
  globalForPostgres.pgPool ||
  new Pool({
    connectionString,
    max: 10,
    idleTimeoutMillis: 120000,
    connectionTimeoutMillis: 5000,
    allowExitOnIdle: false,
    keepAlive: true,
    keepAliveInitialDelayMillis: 10000,
  });

if (process.env.NODE_ENV !== "production") {
  globalForPostgres.pgPool = pool;
}

pool.on("connect", () => {
  console.info("[DATABASE] New PostgreSQL connection established.");
});

pool.on("error", (error) => {
  console.error("[DATABASE] Unexpected idle client error:", error);
});

export default pool;
