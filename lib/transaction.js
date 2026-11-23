// import pool from "./db";

// /**
//  * Run `callback(client)` inside BEGIN/COMMIT.
//  * Pass a company pool (from getOperationalPool / getTenantDb) as `db` for
//  * operational data; it defaults to the central erp_system pool.
//  */
// export async function withTransaction(callback, db = pool) {
//   const client = await db.connect();

//   try {
//     await client.query("BEGIN");

//     const result = await callback(client);

//     await client.query("COMMIT");

//     return result;
//   } catch (error) {
//     await client.query("ROLLBACK");
//     throw error;
//   } finally {
//     client.release();
//   }
// }


import pool from "./db";

/**
 * Run a callback inside a database transaction.
 * Defaults to the central ERP database.
 */
export async function withTransaction(callback, db = pool) {
    const client = await db.connect();

    try {
        await client.query("BEGIN");

        const result = await callback(client);

        await client.query("COMMIT");

        return result;
    } catch (error) {
        await client.query("ROLLBACK").catch(() => {});
        throw error;
    } finally {
        client.release();
    }
}
