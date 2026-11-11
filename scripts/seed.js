import pg from "pg";
import bcrypt from "bcryptjs";

const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function seed() {
  try {
    console.log("Creating admin user...");

    const roleResult = await pool.query(
      `
      SELECT role_id
      FROM roles
      WHERE role_name = 'ADMIN'
      `
    );

    if (roleResult.rows.length === 0) {
      throw new Error(
        "ADMIN role does not exist. Run schema.sql first."
      );
    }

    const adminRoleId =
      roleResult.rows[0].role_id;

    const existingUser = await pool.query(
      `
      SELECT user_id
      FROM users
      WHERE username = $1
      `,
      ["admin"]
    );

    if (existingUser.rows.length > 0) {
      console.log("Admin user already exists.");
      return;
    }

    const passwordHash = await bcrypt.hash(
      "admin123",
      12
    );

    await pool.query(
      `
      INSERT INTO users
      (
        full_name,
        username,
        email,
        password_hash,
        role_id
      )
      VALUES
      (
        $1,
        $2,
        $3,
        $4,
        $5
      )
      `,
      [
        "System Administrator",
        "admin",
        "admin@erp.local",
        passwordHash,
        adminRoleId,
      ]
    );

    console.log("");
    console.log("================================");
    console.log("Admin user created successfully");
    console.log("Username: admin");
    console.log("Password: admin123");
    console.log("================================");
    console.log("");
  } catch (error) {
    console.error(
      "Seed error:",
      error
    );
  } finally {
    await pool.end();
  }
}

seed();