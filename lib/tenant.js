// import { NextResponse } from "next/server";
// import pool, { getCompanyPool } from "@/lib/db";
// import { getCurrentUser } from "@/lib/auth";

// /**
//  * Resolve the logged-in user and their company's own database.
//  *
//  *   const tenant = await getTenantContext();
//  *   if (!tenant) return unauthorizedResponse();
//  *   const { db, user } = tenant;
//  *
//  * `db` is the company pool (erp_<company name>): use it for ALL operational
//  * tables. Auth/users/roles/permissions/companies/audit stay on the central
//  * `pool` from "@/lib/db".
//  *
//  * Returns null when there is no valid session. Throws when the company
//  * database is missing or not ACTIVE.
//  */
// export async function getTenantContext() {
//   const user = await getCurrentUser();

//   if (!user?.companyId) {
//     return null;
//   }

//   const db = await getCompanyPool(user.companyId);

//   return { user, db, companyId: Number(user.companyId) };
// }

// export function unauthorizedResponse() {
//   return NextResponse.json(
//     { success: false, message: "Authentication required." },
//     { status: 401 }
//   );
// }

// /**
//  * Company row from the central database (name, address, logo, tax info),
//  * for document headers that used to JOIN companies inside operational SQL.
//  */
// export async function getCompanyProfile(companyId) {
//   const result = await pool.query(
//     "SELECT * FROM companies WHERE company_id = $1 LIMIT 1",
//     [companyId]
//   );

//   return result.rows[0] || null;
// }

// /**
//  * Add user names to rows whose *_by columns hold central user IDs
//  * (replaces `LEFT JOIN users` inside operational queries).
//  *
//  *   await attachUserNames(rows, {
//  *     created_by: "created_by_name",
//  *     updated_by: "updated_by_name",
//  *   });
//  *
//  * Sets row[target] = users.full_name (or null). Mutates and returns rows.
//  */
// export async function attachUserNames(rows, fields, column = "full_name") {
//   const list = Array.isArray(rows) ? rows : rows ? [rows] : [];
//   const allowedColumns = new Set(["full_name", "username", "email"]);

//   if (!allowedColumns.has(column)) {
//     throw new Error("Invalid user column.");
//   }

//   const ids = new Set();

//   for (const row of list) {
//     for (const source of Object.keys(fields)) {
//       const id = Number(row?.[source]);
//       if (Number.isSafeInteger(id) && id > 0) ids.add(id);
//     }
//   }

//   const names = new Map();

//   if (ids.size) {
//     const result = await pool.query(
//       `SELECT user_id, ${column} AS value FROM users WHERE user_id = ANY($1::int[])`,
//       [[...ids]]
//     );

//     for (const user of result.rows) {
//       names.set(Number(user.user_id), user.value);
//     }
//   }

//   for (const row of list) {
//     for (const [source, target] of Object.entries(fields)) {
//       row[target] = names.get(Number(row?.[source])) ?? null;
//     }
//   }

//   return rows;
// }



import { NextResponse } from "next/server";
import pool, { getTenantDb } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

/**
 * Resolve the logged-in user and central database.
 *
 * All companies share the central database.
 * Operational queries must enforce company_id.
 */
export async function getTenantContext() {
    const user = await getCurrentUser();

    const companyId = Number(
        user?.companyId ?? user?.company_id
    );

    if (!Number.isSafeInteger(companyId) || companyId <= 0) {
        return null;
    }

    const db = await getTenantDb(user);

    return {
        user,
        db,
        companyId,
    };
}

export function unauthorizedResponse() {
    return NextResponse.json(
        {
            success: false,
            message: "Authentication required.",
        },
        { status: 401 }
    );
}

/**
 * Get company information from the central database.
 */
export async function getCompanyProfile(companyId) {
    const result = await pool.query(
        `
        SELECT *
        FROM companies
        WHERE company_id = $1
        LIMIT 1;
        `,
        [companyId]
    );

    return result.rows[0] || null;
}

/**
 * Attach central user names to operational records.
 */
export async function attachUserNames(
    rows,
    fields,
    column = "full_name"
) {
    const list = Array.isArray(rows)
        ? rows
        : rows
            ? [rows]
            : [];

    const allowedColumns = new Set([
        "full_name",
        "username",
        "email",
    ]);

    if (!allowedColumns.has(column)) {
        throw new Error("Invalid user column.");
    }

    const ids = new Set();

    for (const row of list) {
        for (const source of Object.keys(fields)) {
            const id = Number(row?.[source]);

            if (
                Number.isSafeInteger(id) &&
                id > 0
            ) {
                ids.add(id);
            }
        }
    }

    const names = new Map();

    if (ids.size) {
        const result = await pool.query(
            `
            SELECT
                user_id,
                ${column} AS value
            FROM users
            WHERE user_id = ANY($1::int[]);
            `,
            [[...ids]]
        );

        for (const user of result.rows) {
            names.set(
                Number(user.user_id),
                user.value
            );
        }
    }

    for (const row of list) {
        for (const [source, target] of Object.entries(fields)) {
            row[target] =
                names.get(Number(row?.[source])) ?? null;
        }
    }

    return rows;
}
