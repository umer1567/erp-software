import pool from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { hasPermission } from "@/lib/permissions";

export async function authorizeSalesQuotations(action = "view") {
    const user = await getCurrentUser();

    if (!user?.userId || !user?.companyId) {
        return {
            ok: false,
            status: 401,
            message: "Please log in to continue.",
        };
    }

    const result = await pool.query(
        `
        SELECT
            u.user_id,
            u.is_active,
            uc.company_id,
            uc.role_id,
            r.role_name,
            c.is_active AS company_is_active
        FROM users u
        INNER JOIN user_companies uc
            ON uc.user_id = u.user_id
        INNER JOIN roles r
            ON r.role_id = uc.role_id
        INNER JOIN companies c
            ON c.company_id = uc.company_id
        WHERE u.user_id = $1
          AND uc.company_id = $2
        LIMIT 1
        `,
        [user.userId, user.companyId]
    );

    const membership = result.rows[0];

    if (
        !membership ||
        membership.is_active !== true ||
        membership.company_is_active !== true
    ) {
        return {
            ok: false,
            status: 403,
            message: "You do not have access to this company.",
        };
    }

    const roleName = String(membership.role_name || "").toUpperCase();

    // ADMIN can manage quotations without individual permission entries.
    if (roleName !== "ADMIN") {
        const allowed = await hasPermission(
            membership.role_id,
            "sales_quotations",
            action
        );

        if (!allowed) {
            return {
                ok: false,
                status: 403,
                message: `You do not have permission to ${action} sales quotations.`,
            };
        }
    }

    return {
        ok: true,
        user: {
            userId: Number(membership.user_id),
            companyId: Number(membership.company_id),
            roleId: Number(membership.role_id),
            roleName,
        },
    };
}