import { NextResponse } from "next/server";
import pool from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { hasPermission } from "@/lib/permissions";

export const dynamic = "force-dynamic";

// Validate role ID from URL
function parseRoleId(value) {
    const id = Number(value);

    if (!Number.isSafeInteger(id) || id <= 0) {
        return null;
    }

    return id;
}

// =========================================================
// UPDATE ROLE
// PUT /api/roles/:id
// =========================================================

export async function PUT(request, { params }) {
    try {
        const user = await getCurrentUser();

        if (!user) {
            return NextResponse.json(
                { message: "Unauthorized. Please log in again." },
                { status: 401 }
            );
        }

        const allowed = await hasPermission(
            user.roleId,
            "roles",
            "update"
        );

        if (!allowed) {
            return NextResponse.json(
                { message: "You do not have permission to update roles." },
                { status: 403 }
            );
        }

        const { id: rawId } = await params;
        const roleId = parseRoleId(rawId);

        if (!roleId) {
            return NextResponse.json(
                { message: "Invalid role ID." },
                { status: 400 }
            );
        }

        let body;

        try {
            body = await request.json();
        } catch {
            return NextResponse.json(
                { message: "Invalid request body." },
                { status: 400 }
            );
        }

        const { roleName, description } = body;

        if (typeof roleName !== "string" || !roleName.trim()) {
            return NextResponse.json(
                { message: "Role name is required." },
                { status: 400 }
            );
        }

        if (roleName.trim().length > 100) {
            return NextResponse.json(
                { message: "Role name cannot exceed 100 characters." },
                { status: 400 }
            );
        }

        if (
            description !== undefined &&
            description !== null &&
            typeof description !== "string"
        ) {
            return NextResponse.json(
                { message: "Description must be text." },
                { status: 400 }
            );
        }

        const normalizedName = roleName.trim().toUpperCase();
        const normalizedDescription =
            typeof description === "string" && description.trim()
                ? description.trim()
                : null;

        const result = await pool.query(
            `
            UPDATE roles
            SET
                role_name = $1,
                description = $2
            WHERE role_id = $3
              AND is_system_role = FALSE
            RETURNING
                role_id,
                role_name,
                description,
                is_system_role,
                created_at;
            `,
            [normalizedName, normalizedDescription, roleId]
        );

        if (result.rows.length === 0) {
            const existing = await pool.query(
                `
                SELECT role_id, is_system_role
                FROM roles
                WHERE role_id = $1;
                `,
                [roleId]
            );

            if (existing.rows.length === 0) {
                return NextResponse.json(
                    { message: "Role not found." },
                    { status: 404 }
                );
            }

            return NextResponse.json(
                { message: "System roles cannot be modified." },
                { status: 403 }
            );
        }

        return NextResponse.json({
            success: true,
            message: "Role updated successfully.",
            role: result.rows[0],
        });
    } catch (error) {
        console.error("UPDATE ROLE ERROR:", error);

        if (error.code === "23505") {
            return NextResponse.json(
                { message: "A role with this name already exists." },
                { status: 409 }
            );
        }

        return NextResponse.json(
            { message: "Failed to update role." },
            { status: 500 }
        );
    }
}

// =========================================================
// DELETE ROLE
// DELETE /api/roles/:id
// =========================================================

export async function DELETE(request, { params }) {
    const client = await pool.connect();

    try {
        const user = await getCurrentUser();

        if (!user) {
            return NextResponse.json(
                { message: "Unauthorized. Please log in again." },
                { status: 401 }
            );
        }

        const allowed = await hasPermission(
            user.roleId,
            "roles",
            "delete"
        );

        if (!allowed) {
            return NextResponse.json(
                { message: "You do not have permission to delete roles." },
                { status: 403 }
            );
        }

        const { id: rawId } = await params;
        const roleId = parseRoleId(rawId);

        if (!roleId) {
            return NextResponse.json(
                { message: "Invalid role ID." },
                { status: 400 }
            );
        }

        await client.query("BEGIN");

        // Lock the role while checking whether it can be deleted.
        const roleResult = await client.query(
            `
            SELECT role_id, role_name, is_system_role
            FROM roles
            WHERE role_id = $1
            FOR UPDATE;
            `,
            [roleId]
        );

        if (roleResult.rows.length === 0) {
            await client.query("ROLLBACK");

            return NextResponse.json(
                { message: "Role not found." },
                { status: 404 }
            );
        }

        const role = roleResult.rows[0];

        // System roles must never be deleted.
        if (role.is_system_role) {
            await client.query("ROLLBACK");

            return NextResponse.json(
                { message: "System roles cannot be deleted." },
                { status: 403 }
            );
        }

        // Do not delete a role assigned to existing users.
        const usersResult = await client.query(
            `
            SELECT COUNT(*)::INTEGER AS user_count
            FROM users
            WHERE role_id = $1;
            `,
            [roleId]
        );

        const userCount = usersResult.rows[0].user_count;

        if (userCount > 0) {
            await client.query("ROLLBACK");

            return NextResponse.json(
                {
                    message:
                        `Cannot delete "${role.role_name}" because ` +
                        `${userCount} user(s) are assigned to it. ` +
                        "Reassign those users first.",
                    userCount,
                },
                { status: 409 }
            );
        }

        await client.query(
            `
            DELETE FROM roles
            WHERE role_id = $1
              AND is_system_role = FALSE;
            `,
            [roleId]
        );

        await client.query("COMMIT");

        return NextResponse.json({
            success: true,
            message: "Role deleted successfully.",
            roleId,
        });
    } catch (error) {
        await client.query("ROLLBACK").catch(() => {});

        console.error("DELETE ROLE ERROR:", error);

        if (error.code === "23503") {
            return NextResponse.json(
                {
                    message:
                        "This role is referenced by other records and cannot be deleted.",
                },
                { status: 409 }
            );
        }

        return NextResponse.json(
            { message: "Failed to delete role." },
            { status: 500 }
        );
    } finally {
        client.release();
    }
}
