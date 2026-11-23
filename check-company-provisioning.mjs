import pg from "pg";

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
});

try {
  const result = await pool.query(`
    SELECT
      c.company_id,
      c.company_name,
      cd.database_name,
      cd.status,
      cd.schema_version
    FROM companies c
    LEFT JOIN company_databases cd
      ON cd.company_id = c.company_id
    ORDER BY c.company_id DESC
    LIMIT 10
  `);

  console.table(result.rows);
} catch (error) {
  console.error(error);
} finally {
  await pool.end();
}
