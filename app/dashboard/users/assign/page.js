
"use client";

import Link from "next/link";
import CompanyAccessManager from "../CompanyAccessManager";

export default function AssignUserPage() {
    return (
        <div className="mx-auto max-w-5xl space-y-6">
            <div>
                <Link
                    href="/dashboard/users"
                    className="text-sm font-medium text-blue-700 hover:underline"
                >
                    ← Back to Users
                </Link>

                <h1 className="mt-3 text-3xl font-bold text-slate-900">
                    Assign User to Company
                </h1>

                <p className="mt-1 text-slate-500">
                    Give an existing user access to another company
                    and select their role in that company.
                </p>
            </div>

            <CompanyAccessManager />
        </div>
    );
}
