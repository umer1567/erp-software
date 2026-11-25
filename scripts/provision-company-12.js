import pool, { provisionCompanyDatabase } from "../lib/db.js";

try {
    const result = await provisionCompanyDatabase(12);

    console.log("\nCompany 12 provisioning result:");
    console.log(JSON.stringify(result, null, 2));
} catch (error) {
    console.error("\nProvisioning failed:");
    console.error(error.message);
    process.exitCode = 1;
} finally {
    await pool.end();
}
