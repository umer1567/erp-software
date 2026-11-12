
// import { SignJWT, jwtVerify } from "jose";
// import { cookies } from "next/headers";

// const secretValue = process.env.JWT_SECRET;

// if (!secretValue) {
//     throw new Error("JWT_SECRET is not configured.");
// }

// const secret = new TextEncoder().encode(secretValue);

// /**
//  * Create an authentication token.
//  * Accepts camelCase properties and legacy snake_case properties.
//  */
// export async function createToken(user) {
//     const userId = user.userId ?? user.user_id;
//     const username = user.username;
//     const roleId = user.roleId ?? user.role_id;
//     const roleName = user.roleName ?? user.role_name;
//     const companyId = user.companyId ?? user.company_id;

//     if (
//         userId === undefined ||
//         userId === null ||
//         !username ||
//         roleId === undefined ||
//         roleId === null ||
//         companyId === undefined ||
//         companyId === null
//     ) {
//         throw new Error(
//             "Cannot create authentication token: required user information is missing."
//         );
//     }

//     return await new SignJWT({
//         userId,
//         username,
//         roleId,
//         roleName: roleName ?? null,
//         companyId,
//     })
//         .setProtectedHeader({ alg: "HS256" })
//         .setIssuedAt()
//         .setExpirationTime("1d")
//         .sign(secret);
// }

// /**
//  * Verify an authentication token.
//  */
// export async function verifyToken(token) {
//     if (!token || typeof token !== "string") {
//         return null;
//     }

//     try {
//         const { payload } = await jwtVerify(token, secret, {
//             algorithms: ["HS256"],
//         });

//         // Reject tokens missing essential authentication claims.
//         if (
//             payload.userId === undefined ||
//             payload.userId === null ||
//             !payload.username ||
//             payload.roleId === undefined ||
//             payload.roleId === null ||
//             payload.companyId === undefined ||
//             payload.companyId === null
//         ) {
//             return null;
//         }

//         return payload;
//     } catch {
//         return null;
//     }
// }

// /**
//  * Get the currently authenticated user from the HTTP-only cookie.
//  */
// export async function getCurrentUser() {
//     try {
//         const cookieStore = await cookies();
//         const token = cookieStore.get("erp_token")?.value;

//         if (!token) {
//             return null;
//         }

//         return await verifyToken(token);
//     } catch (error) {
//         console.error("Failed to read authentication cookie:", error);
//         return null;
//     }
// }

import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { randomUUID } from "crypto";
import pool from "@/lib/db";

const secretValue = process.env.JWT_SECRET;

if (!secretValue) {
  throw new Error("JWT_SECRET is not configured.");
}

const secret = new TextEncoder().encode(secretValue);

export const IDLE_TIMEOUT_MINUTES = 25;
export const MAX_SESSION_HOURS = 10;

const IDLE_TIMEOUT_MS = IDLE_TIMEOUT_MINUTES * 60 * 1000;
const MAX_SESSION_MS = MAX_SESSION_HOURS * 60 * 60 * 1000;

/**
 * Create a PostgreSQL session.
 */
export async function createSession(user, request) {
  const sessionId = randomUUID();

  const userId = user.userId ?? user.user_id;
  const companyId = user.companyId ?? user.company_id;

  if (!userId || !companyId) {
    throw new Error("Cannot create session: user or company ID missing.");
  }

  const forwardedFor = request?.headers?.get("x-forwarded-for");
  const ipAddress = forwardedFor
    ? forwardedFor.split(",")[0].trim()
    : null;

  const userAgent = request?.headers?.get("user-agent") || null;

  await pool.query(
    `
      INSERT INTO user_sessions (
        session_id,
        user_id,
        company_id,
        created_at,
        last_activity_at,
        expires_at,
        ip_address,
        user_agent
      )
      VALUES (
        $1,
        $2,
        $3,
        CURRENT_TIMESTAMP,
        CURRENT_TIMESTAMP,
        CURRENT_TIMESTAMP + INTERVAL '10 hours',
        $4,
        $5
      )
    `,
    [sessionId, userId, companyId, ipAddress, userAgent]
  );

  return sessionId;
}

/**
 * Create authentication JWT.
 * Existing user claims are preserved.
 */
export async function createToken(user, sessionId) {
  const userId = user.userId ?? user.user_id;
  const username = user.username;
  const roleId = user.roleId ?? user.role_id;
  const roleName = user.roleName ?? user.role_name;
  const companyId = user.companyId ?? user.company_id;

  if (
    userId === undefined ||
    userId === null ||
    !username ||
    roleId === undefined ||
    roleId === null ||
    companyId === undefined ||
    companyId === null ||
    !sessionId
  ) {
    throw new Error(
      "Cannot create authentication token: required user or session information is missing."
    );
  }

  return new SignJWT({
    userId,
    username,
    roleId,
    roleName: roleName ?? null,
    companyId,
    sessionId,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("10h")
    .sign(secret);
}

/**
 * Verify JWT and its essential claims.
 */
export async function verifyToken(token) {
  if (!token || typeof token !== "string") {
    return null;
  }

  try {
    const { payload } = await jwtVerify(token, secret, {
      algorithms: ["HS256"],
    });

    if (
      payload.userId === undefined ||
      payload.userId === null ||
      !payload.username ||
      payload.roleId === undefined ||
      payload.roleId === null ||
      payload.companyId === undefined ||
      payload.companyId === null ||
      !payload.sessionId ||
      !payload.iat ||
      !payload.exp
    ) {
      return null;
    }

    return payload;
  } catch {
    return null;
  }
}

/**
 * Check the authoritative session record in PostgreSQL.
 * This function never renews activity.
 */
export async function isSessionActive(payload) {
  if (
    !payload?.sessionId ||
    !payload?.userId ||
    !payload?.companyId
  ) {
    return false;
  }

  const result = await pool.query(
    `
      SELECT
        session_id,
        user_id,
        company_id,
        created_at,
        last_activity_at,
        expires_at,
        revoked_at,
        (
          revoked_at IS NULL
          AND expires_at > CURRENT_TIMESTAMP
          AND created_at > CURRENT_TIMESTAMP - INTERVAL '10 hours'
          AND last_activity_at > CURRENT_TIMESTAMP - INTERVAL '25 minutes'
        ) AS is_active
      FROM user_sessions
      WHERE session_id = $1
        AND user_id = $2
        AND company_id = $3
      LIMIT 1
    `,
    [payload.sessionId, payload.userId, payload.companyId]
  );

  if (!result.rows.length) {
    return false;
  }

  return result.rows[0].is_active === true;
}

/**
 * Read and validate the current authenticated user.
 *
 * Important: This does not renew activity.
 * Only genuine interaction through /api/auth/activity renews it.
 */
export async function getCurrentUser() {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("erp_token")?.value;

    if (!token) {
      return null;
    }

    const user = await verifyToken(token);

    if (!user) {
      return null;
    }

    const active = await isSessionActive(user);

    if (!active) {
      return null;
    }

    return user;
  } catch (error) {
    console.error("Failed to validate authentication session:", error);
    return null;
  }
}

/**
 * Revoke one session.
 */
export async function revokeSession(sessionId) {
  if (!sessionId) return;

  await pool.query(
    `
      UPDATE user_sessions
      SET revoked_at = COALESCE(revoked_at, CURRENT_TIMESTAMP)
      WHERE session_id = $1
    `,
    [sessionId]
  );
}

/**
 * Get user from a supplied token.
 * Useful in proxy.js, where request cookies are already available.
 */
export async function getActiveUserFromToken(token) {
  const user = await verifyToken(token);

  if (!user) {
    return null;
  }

  const active = await isSessionActive(user);

  return active ? user : null;
}

/**
 * Read the current token payload without requiring an active session.
 * Useful for revoking a session during logout.
 */
export async function getTokenPayload() {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("erp_token")?.value;

    return await verifyToken(token);
  } catch {
    return null;
  }
}