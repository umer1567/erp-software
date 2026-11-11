import { NextResponse } from "next/server";
import pool from "@/lib/db";

export async function GET() {
    try {
        const result = await pool.query(`
            SELECT
                s.supplier_id,
                s.supplier_code,
                s.supplier_name,
                s.phone,
                s.email,
                s.opening_balance,
                s.credit_limit,
                s.is_active,

                COALESCE(
                    (
                        SELECT SUM(p.total_amount)
                        FROM purchases p
                        WHERE p.supplier_id =
                              s.supplier_id
                    ),
                    0
                ) AS total_purchases,

                COALESCE(
                    (
                        SELECT SUM(pp.amount)
                        FROM purchase_payments pp
                        WHERE pp.supplier_id =
                              s.supplier_id
                    ),
                    0
                ) AS total_paid,

                (
                    s.opening_balance
                    +
                    COALESCE(
                        (
                            SELECT SUM(
                                p.total_amount
                            )
                            FROM purchases p
                            WHERE p.supplier_id =
                                  s.supplier_id
                        ),
                        0
                    )
                    -
                    COALESCE(
                        (
                            SELECT SUM(
                                pp.amount
                            )
                            FROM purchase_payments pp
                            WHERE pp.supplier_id =
                                  s.supplier_id
                        ),
                        0
                    )
                ) AS balance

            FROM suppliers s

            ORDER BY s.supplier_id DESC
        `);

        return NextResponse.json({
            success: true,
            balances: result.rows,
        });

    } catch (error) {
        console.error(
            "SUPPLIER BALANCE GET ERROR:",
            error
        );

        return NextResponse.json(
            {
                success: false,
                message:
                    "Failed to load supplier balances.",
                error: error.message,
            },
            { status: 500 }
        );
    }
}