import { Pool } from "pg";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

try {
  const company = await pool.query(`
    SELECT company_id, company_name, email, is_active, created_at
    FROM companies
    WHERE company_id = 14
  `);

  const mappings = await pool.query(`
    SELECT company_id, database_name, status, schema_version, updated_at
    FROM company_databases
    ORDER BY company_id
  `);

  console.log("\n=== COMPANY 14 ===");
  console.table(company.rows);

  console.log("\n=== ALL DATABASE MAPPINGS ===");
  console.table(mappings.rows);

} catch (error) {
  console.error("Diagnostic error:", error.message);
} finally {
  await pool.end();
}
