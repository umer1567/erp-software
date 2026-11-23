import pg from "pg";

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
});

try {
  console.log("CONSTRAINT:");
  const constraint = await pool.query(`
    SELECT
      conname,
      pg_get_constraintdef(oid) AS rule
    FROM pg_constraint
    WHERE conname = 'company_databases_name_check'
  `);
  console.table(constraint.rows);

  console.log("COMPANY MAPPING:");
  const mapping = await pool.query(`
    SELECT *
    FROM company_databases
    WHERE company_id = 14
  `);
  console.table(mapping.rows);
} catch (error) {
  console.error(error.message);
} finally {
  await pool.end();
}
