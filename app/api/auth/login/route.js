
import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import pool from "@/lib/db";
import {
  createSession,
  createToken,
  revokeSession,
} from "@/lib/auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function jsonResponse(data, status = 200) {
  return NextResponse.json(data, {
    status,
    headers: {
      "Cache-Control": "no-store, no-cache, must-revalidate",
      Pragma: "no-cache",
      Expires: "0",
    },
  });
}

function normalizeCompanyName(name) {
  return String(name || "")
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();
}


function getUniqueCompanies(users) {
  const companies = new Map();

  for (const user of users) {
    const companyId = Number(user.company_id);

    const companyName = String(user.company_name || "")
      .trim()
      .replace(/\s+/g, " ");

    if (
      !Number.isSafeInteger(companyId) ||
      companyId <= 0 ||
      !companyName
    ) {
      continue;
    }

    // Company ID is unique. Company names are not.
    if (!companies.has(companyId)) {
      companies.set(companyId, {
        company_id: companyId,
        company_name: companyName,
      });
    }
  }

  return Array.from(companies.values());
}


function roundTimings(timings) {
  return Object.fromEntries(
    Object.entries(timings).map(([key, value]) => [
      key,
      typeof value === "number"
        ? Number(value.toFixed(2))
        : value,
    ])
  );
}

export async function POST(request) {
  const startedAt = performance.now();

  const timings = {};
  const bcryptTimings = [];

  let sessionId = null;
  let responseStatus = 500;

  try {
    // 1. Parse request.

    let body;

    try {
      body = await request.json();
    } catch {
      responseStatus = 400;

      return jsonResponse(
        {
          success: false,
          message: "Invalid request data.",
        },
        400
      );
    }

    // 2. Validate input.

    // Users sign in with their email address.
    const email =
      typeof body.email === "string"
        ? body.email.trim().toLowerCase()
        : "";

    const password = body.password;

    const companyId =
      body.companyId === undefined ||
      body.companyId === null ||
      body.companyId === ""
        ? null
        : Number(body.companyId);

    if (
      !email ||
      email.length > 150 ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
      typeof password !== "string" ||
      !password ||
      (companyId !== null &&
        (!Number.isSafeInteger(companyId) || companyId <= 0))
    ) {
      responseStatus = 400;

      return jsonResponse(
        {
          success: false,
          message: "Enter a valid email and password.",
        },
        400
      );
    }

    // 3. Retrieve the user's company memberships.

    let phase = performance.now();

    const result = await pool.query(
      `
        SELECT
          u.user_id,
          u.full_name,
          u.username,
          u.email,
          u.is_active AS user_is_active,

          uc.company_id,
          uc.role_id,
          uc.company_password_hash,

          c.company_name,
          c.is_active AS company_is_active,

          r.role_name

        FROM users u

        INNER JOIN user_companies uc
          ON uc.user_id = u.user_id

        INNER JOIN companies c
          ON c.company_id = uc.company_id

        INNER JOIN roles r
          ON r.role_id = uc.role_id

        WHERE LOWER(u.email) = $1

          AND (
            $2::integer IS NULL
            OR uc.company_id = $2
          )

          AND (
            r.company_id IS NULL
            OR r.company_id = uc.company_id
          )

        ORDER BY uc.company_id
      `,
      [email, companyId]
    );

    timings.membershipLookup =
      performance.now() - phase;

    // 4. Verify company-specific passwords.

    phase = performance.now();

    const matchingUsers = [];

    for (const user of result.rows) {
      if (
        user.user_is_active !== true ||
        user.company_is_active !== true ||
        !user.company_password_hash
      ) {
        continue;
      }

      const bcryptStartedAt = performance.now();

      const passwordMatches = await bcrypt.compare(
        password,
        user.company_password_hash
      );

      const durationMs =
        performance.now() - bcryptStartedAt;

      bcryptTimings.push({
        companyId: Number(user.company_id),
        durationMs: Number(durationMs.toFixed(2)),
      });

      if (passwordMatches) {
        matchingUsers.push(user);
      }
    }

    timings.passwordVerification =
      performance.now() - phase;

    timings.bcryptComparisons = bcryptTimings.length;

    // 5. Reject invalid credentials.

    if (matchingUsers.length === 0) {
      responseStatus = 401;

      return jsonResponse(
        {
          success: false,
          message: "Invalid email, password, or company access.",
        },
        401
      );
    }

    // 6. Require company selection when no company was supplied.

    // 6. Automatically select company when the user has only one company.

let finalSelectedCompanyId = companyId;

if (finalSelectedCompanyId === null) {
  const companies = getUniqueCompanies(matchingUsers);

  if (companies.length === 0) {
    responseStatus = 403;

    return jsonResponse(
      {
        success: false,
        message: "No valid company is available for this account.",
      },
      403
    );
  }

  // Only one company: automatically select it.
  if (companies.length === 1) {
    finalSelectedCompanyId = Number(
      companies[0].company_id
    );
  }

  // Multiple companies: ask user to select one.
  else {
    responseStatus = 409;

    return jsonResponse(
      {
        success: false,
        code: "COMPANY_SELECTION_REQUIRED",
        message: "Select the company you want to access.",
        companies,
      },
      409
    );
  }
}

// 7. Find the selected company with a matching password.

const user = matchingUsers.find(
  (item) =>
    Number(item.company_id) === finalSelectedCompanyId
);

    if (!user) {
      responseStatus = 403;

      return jsonResponse(
        {
          success: false,
          message: "You do not have access to the selected company.",
        },
        403
      );
    }

    // 8. Validate authenticated company and role.

    const finalCompanyId = Number(user.company_id);
    const finalRoleId = Number(user.role_id);

    const finalCompanyName = String(user.company_name || "")
      .trim()
      .replace(/\s+/g, " ");

    const finalRoleName = String(user.role_name || "").trim();

    if (
      !Number.isSafeInteger(finalCompanyId) ||
      finalCompanyId <= 0 ||
      !Number.isSafeInteger(finalRoleId) ||
      finalRoleId <= 0 ||
      !finalCompanyName ||
      !finalRoleName
    ) {
      throw new Error(
        "Authenticated user is missing valid company or role information."
      );
    }

    // 8b. The company's own database must be ready before login.

    // const companyDatabaseResult = await pool.query(
    //   `
    //     SELECT status
    //     FROM company_databases
    //     WHERE company_id = $1
    //     LIMIT 1
    //   `,
    //   [finalCompanyId]
    // );

    // const companyDatabaseStatus =
    //   companyDatabaseResult.rows[0]?.status || null;

    // if (companyDatabaseStatus !== "ACTIVE") {
    //   responseStatus = 503;

    //   return jsonResponse(
    //     {
    //       success: false,
    //       code: "COMPANY_DATABASE_NOT_READY",
    //       message:
    //         companyDatabaseStatus === "PROVISIONING"
    //           ? "This company's database is still being set up. Please try again shortly."
    //           : "This company's database is not available. Please contact support.",
    //     },
    //     503
    //   );
    // }

    console.info("[AUTH] Company authenticated using central database:", {
  companyId: finalCompanyId,
  database: CENTRAL_DATABASE_NAME,
});

    // 9. Update last login and insert login history.

    phase = performance.now();

    await pool.query(
      `
        WITH updated_user AS (
          UPDATE users
          SET
            last_login = CURRENT_TIMESTAMP,
            updated_at = CURRENT_TIMESTAMP
          WHERE user_id = $1
            AND is_active = TRUE
          RETURNING user_id
        )

        INSERT INTO user_login_history (
          user_id,
          company_id
        )

        SELECT
          user_id,
          $2

        FROM updated_user
      `,
      [user.user_id, finalCompanyId]
    );

    timings.loginHistory =
      performance.now() - phase;

    // 10. Create PostgreSQL session.
    // createSession() in lib/auth.js returns result.rows[0].

    phase = performance.now();

    const session = await createSession(user, request);

    // Diagnostic information only. Never log passwords or tokens.

    console.info("[LOGIN SESSION DEBUG]", {
      returnedType: typeof session,
      isArray: Array.isArray(session),
      returnedKeys:
        session && typeof session === "object"
          ? Object.keys(session)
          : [],
      hasSessionId: Boolean(session?.session_id),
      companyId: Number(user.company_id),
      userId: Number(user.user_id),
    });

    if (
      !session ||
      typeof session !== "object" ||
      Array.isArray(session) ||
      !session.session_id
    ) {
      throw new Error(
        "createSession() did not return the expected session object. Check the LOGIN SESSION DEBUG output."
      );
    }

    sessionId = session.session_id;

    timings.sessionCreation =
      performance.now() - phase;

    // 11. Validate session membership.

    const authenticatedUserId = Number(session.user_id);
    const authenticatedCompanyId = Number(session.company_id);
    const authenticatedRoleId = Number(session.role_id);

    const authenticatedRoleName = String(
      session.role_name || ""
    ).trim();

    if (
      authenticatedUserId !== Number(user.user_id) ||
      authenticatedCompanyId !== finalCompanyId ||
      authenticatedRoleId !== finalRoleId ||
      !authenticatedRoleName
    ) {
      throw new Error(
        "Created session does not match the authenticated user, company, or role."
      );
    }

    // 12. Generate authentication JWT.

    phase = performance.now();

    const token = await createToken(user, session);

    if (
      typeof token !== "string" ||
      !token
    ) {
      throw new Error("Token generation failed.");
    }

    timings.tokenCreation =
      performance.now() - phase;

    // 13. Prepare successful response.

    const response = jsonResponse(
      {
        success: true,
        message: "Login successful.",

        user: {
          userId: authenticatedUserId,
          fullName: user.full_name,
          username: user.username,
          email: user.email,

          roleId: authenticatedRoleId,
          roleName: authenticatedRoleName,

          companyId: authenticatedCompanyId,
          companyName: finalCompanyName,
        },
      },
      200
    );

    // 14. Set HTTP-only authentication cookie.

    response.cookies.set("erp_token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 10,
      path: "/",
    });

    responseStatus = 200;

    return response;
  } catch (error) {
    // 15. Revoke session if a later operation failed.

    if (sessionId) {
      try {
        await revokeSession(sessionId);
      } catch (revokeError) {
        console.error(
          "Failed to revoke incomplete login session:",
          revokeError.message
        );
      }
    }

    console.error("Login error:", error);

    responseStatus = 500;

    return jsonResponse(
      {
        success: false,
        message: "Server error during login.",
      },
      500
    );
  } finally {
    // 16. Record request performance.

    timings.total = performance.now() - startedAt;

    console.info("[LOGIN PERFORMANCE]", {
      status: responseStatus,
      timings: roundTimings(timings),
      bcryptDetails: bcryptTimings,
    });
  }
}
