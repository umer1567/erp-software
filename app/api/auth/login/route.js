
import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import pool from "@/lib/db";
import { createToken } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function POST(request) {
  try {
    const body = await request.json();

    const username =
      typeof body.username === "string" ? body.username.trim() : "";
    const password = body.password;
    const companyId =
      body.companyId === undefined ||
        body.companyId === null ||
        body.companyId === ""
        ? null
        : Number(body.companyId);

    if (
      !username ||
      typeof password !== "string" ||
      !password ||
      (companyId !== null &&
        (!Number.isSafeInteger(companyId) || companyId <= 0))
    ) {
      return NextResponse.json(
        {
          success: false,
          message: "Enter a valid username and password.",
        },
        { status: 400 }
      );
    }

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
      JOIN user_companies uc
        ON uc.user_id = u.user_id
      JOIN companies c
        ON c.company_id = uc.company_id
      JOIN roles r
        ON r.role_id = uc.role_id
      WHERE LOWER(u.username) = LOWER($1)
        AND ($2::integer IS NULL OR uc.company_id = $2)
        AND (
          r.company_id IS NULL
          OR r.company_id = uc.company_id
        )
      ORDER BY uc.company_id
      `,
      [username, companyId]
    );

    const matchingUsers = [];

    for (const user of result.rows) {
      if (
        !user.user_is_active ||
        !user.company_is_active ||
        !user.company_password_hash
      ) {
        continue;
      }

      const passwordMatches = await bcrypt.compare(
        password,
        user.company_password_hash
      );

      if (passwordMatches) {
        matchingUsers.push(user);
      }
    }

    if (matchingUsers.length === 0) {
      return NextResponse.json(
        {
          success: false,
          message: "Invalid username, password, or company access.",
        },
        { status: 401 }
      );
    }

    if (companyId === null) {
      return NextResponse.json(
        {
          success: false,
          code: "COMPANY_SELECTION_REQUIRED",
          message: "Select the company you want to access.",
          companies: matchingUsers.map((user) => ({
            company_id: user.company_id,
            company_name: user.company_name,
          })),
        },
        { status: 409 }
      );
    }

    const user = matchingUsers[0];

    const loginClient = await pool.connect();

    try {
      await loginClient.query("BEGIN");

      await loginClient.query(
        `
    UPDATE users
    SET last_login = CURRENT_TIMESTAMP,
        updated_at = CURRENT_TIMESTAMP
    WHERE user_id = $1
    `,
        [user.user_id]
      );

      await loginClient.query(
        `
    INSERT INTO user_login_history (user_id, company_id)
    VALUES ($1, $2)
    `,
        [user.user_id, user.company_id]
      );

      await loginClient.query("COMMIT");
    } catch (error) {
      await loginClient.query("ROLLBACK");
      throw error;
    } finally {
      loginClient.release();
    }

    // const token = await createToken({
    //   user_id: user.user_id,
    //   username: user.username,
    //   role_id: user.role_id,
    //   role_name: user.role_name,
    //   company_id: user.company_id,
    // });

    const token = await createToken({
      userId: user.user_id,
      username: user.username,
      roleId: user.role_id,
      roleName: user.role_name,
      companyId: user.company_id,
    });

    const response = NextResponse.json({
      success: true,
      message: "Login successful.",
      user: {
        userId: user.user_id,
        fullName: user.full_name,
        username: user.username,
        roleName: user.role_name,
        companyId: user.company_id,
        companyName: user.company_name,
      },
    });

    response.cookies.set("erp_token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24,
      path: "/",
    });

    return response;
  } catch (error) {
    console.error("Login error:", error);

    return NextResponse.json(
      {
        success: false,
        message: "Server error during login.",
      },
      { status: 500 }
    );
  }
}
