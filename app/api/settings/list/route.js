
import { NextResponse } from "next/server";
import pool from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { hasPermission } from "@/lib/permissions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function jsonError(message, status = 400) {
    return NextResponse.json(
        { success: false, message },
        { status }
    );
}

async function getCompanyPermissions(user) {
    const roleId = Number(user?.roleId);

    if (!Number.isSafeInteger(roleId) || roleId <= 0) {
        return {
            view: false,
            create: false,
            update: false,
            delete: false,
        };
    }

    const permissionKey = "register_company";

    const [view, create, update, deletePermission] =
        await Promise.all([
            hasPermission(roleId, permissionKey, "view"),
            hasPermission(roleId, permissionKey, "create"),
            hasPermission(roleId, permissionKey, "update"),
            hasPermission(roleId, permissionKey, "delete"),
        ]);

    return {
        view,
        create,
        update,
        delete: deletePermission,
    };
}


export async function GET() {
    try {
        const currentUser = await getCurrentUser();

        if (!currentUser?.userId) {
            return jsonError(
                "Please log in to view companies.",
                401
            );
        }

        const permissions = await getCompanyPermissions(currentUser);

        // View OFF means the company list must not be returned.
        // This applies to ADMIN, SUB_ADMIN, and USER equally.
        if (!permissions.view) {
            return NextResponse.json({
                success: true,
                companies: [],
                permissions,
                accessDenied: true,
                message:
                    "Your role does not have View permission for Company Management. Ask your administrator to enable View in the user-rights matrix.",
            });
        }

        const result = await pool.query(
            `
            SELECT
                c.company_id,
                c.company_name,
                c.location,
                c.logo_url,
                c.address,
                c.phone,
                c.email,
                c.currency
            FROM companies c
            WHERE c.is_active = TRUE
            ORDER BY c.company_name ASC;
            `
        );

        return NextResponse.json({
            success: true,
            companies: result.rows,
            permissions,
            accessDenied: false,
        });
    } catch (error) {
        console.error("SETTINGS COMPANY LIST ERROR:", {
            message: error?.message,
            code: error?.code,
        });

        return NextResponse.json(
            {
                success: false,
                message: "Unable to load the company list.",
            },
            { status: 500 }
        );
    }
}
