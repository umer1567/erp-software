// Tables that live in the central erp_system database.
// Every other table lives in the company's own database (erp_company_NNN).
export const CENTRAL_TABLES = [
  "companies",
  "company_databases",
  "company_settings",
  "users",
  "user_companies",
  "roles",
  "role_permissions",
  "permissions",
  "user_sessions",
  "user_login_history",
  "password_reset_tokens",
  "audit_logs",
];

// ---------- company database names ----------
//
// Each company's database is named after the company:
//   "Alpha Traders"  -> erp_alpha_traders
// The same slug rule is enforced in SQL by the unique index
// companies_database_slug_unique_idx (sql/central/004_*), so two companies
// can never map to the same database. Keep both in sync.

export const DATABASE_SLUG_MAX = 50;

export function companyDatabaseSlug(companyName) {
  return String(companyName ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, DATABASE_SLUG_MAX)
    .replace(/_+$/g, "");
}

// erp_ + slug, or erp_company_NNN when the name has no Latin letters/digits
// (e.g. an Urdu-only name).
export function companyDatabaseName(companyName, companyId) {
  const slug = companyDatabaseSlug(companyName);

  return slug
    ? `erp_${slug}`
    : `erp_company_${String(companyId).padStart(3, "0")}`;
}

// Valid company database identifier (also blocks SQL injection in
// CREATE DATABASE "...", which cannot take a bind parameter).
export const COMPANY_DATABASE_PATTERN = /^erp_[a-z0-9_]{1,55}$/;

// Database names a company may never get.
export const RESERVED_DATABASE_NAMES = new Set([
  "erp_system",
  "erp_postgres",
  "erp_template0",
  "erp_template1",
]);

/**
 * Returns an error message when a company name cannot be used to name its
 * database, or null when it is fine. `centralDatabaseName` is the database
 * in DATABASE_URL (normally erp_system).
 */
export function companyDatabaseNameError(companyName, centralDatabaseName = "erp_system") {
  const slug = companyDatabaseSlug(companyName);

  // Reserved for companies whose name has no Latin letters or digits.
  if (/^company_[0-9]+$/.test(slug)) {
    return "This company name is reserved. Please choose a different name.";
  }

  const databaseName = `erp_${slug}`;

  if (
    slug &&
    (RESERVED_DATABASE_NAMES.has(databaseName) ||
      databaseName === String(centralDatabaseName).toLowerCase())
  ) {
    return "This company name is reserved. Please choose a different name.";
  }

  return null;
}
