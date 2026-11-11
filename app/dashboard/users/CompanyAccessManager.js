
"use client";

import { useEffect, useState } from "react";

function getUniqueCompanies(companies) {
    const unique = new Map();

    for (const company of companies) {
        if (company.company_id == null) continue;

        const id = String(company.company_id);

        if (!unique.has(id)) {
            unique.set(id, company);
        }
    }

    return Array.from(unique.values()).sort(
        (a, b) =>
            String(a.company_name || "").localeCompare(
                String(b.company_name || "")
            ) ||
            Number(a.company_id) - Number(b.company_id)
    );
}

export default function CompanyAccessManager() {
    const [companies, setCompanies] = useState([]);
    const [companyId, setCompanyId] = useState("");
    const [roleId, setRoleId] = useState("");
    const [identifier, setIdentifier] = useState("");
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState("");
    const [error, setError] = useState("");

    useEffect(() => {
        const controller = new AbortController();

        async function loadCompanies() {
            try {
                const response = await fetch(
                    "/api/users/company-access",
                    {
                        cache: "no-store",
                        signal: controller.signal,
                    }
                );

                const data = await response.json();

                if (!response.ok) {
                    throw new Error(
                        data.message || "Unable to load companies."
                    );
                }

                const available = getUniqueCompanies(
                    Array.isArray(data.companies) ? data.companies : []
                );

                setCompanies(available);

                if (available.length > 0) {
                    const firstCompany = available[0];

                    setCompanyId(
                        String(firstCompany.company_id)
                    );

                    const roles = firstCompany.roles || [];

                    setRoleId(
                        roles.length
                            ? String(roles[0].role_id)
                            : ""
                    );
                }
            } catch (err) {
                if (err.name !== "AbortError") {
                    setError(
                        err.message || "Unable to load companies."
                    );
                }
            } finally {
                if (!controller.signal.aborted) {
                    setLoading(false);
                }
            }
        }

        loadCompanies();

        return () => {
            controller.abort();
        };
    }, []);

    const selectedCompany = companies.find(
        (company) => String(company.company_id) === companyId
    );

    const availableRoles = selectedCompany?.roles || [];

    function handleCompanyChange(value) {
        const nextCompany = companies.find(
            (company) => String(company.company_id) === value
        );

        const nextRoles = nextCompany?.roles || [];

        setCompanyId(value);
        setRoleId(
            nextRoles.length
                ? String(nextRoles[0].role_id)
                : ""
        );
    }

    async function submitAssignment(event) {
        event.preventDefault();

        setMessage("");
        setError("");

        if (!identifier.trim() || !companyId || !roleId) {
            setError(
                "Enter a username or email, company, and role."
            );
            return;
        }

        setSaving(true);

        try {
            const response = await fetch(
                "/api/users/company-access",
                {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        Accept: "application/json",
                    },
                    body: JSON.stringify({
                        identifier: identifier.trim(),
                        companyId: Number(companyId),
                        roleId: Number(roleId),
                    }),
                }
            );

            const data = await response.json();

            if (!response.ok) {
                throw new Error(
                    data.message || "Assignment failed."
                );
            }

            setMessage(
                data.message || "User assigned successfully."
            );

            setIdentifier("");
        } catch (err) {
            setError(err.message || "Assignment failed.");
        } finally {
            setSaving(false);
        }
    }



    function locationLabel(company) {
    const parts = [
        company.location,
        company.city,
        company.state_province,
        company.province,
        company.country,
    ]
        .map((value) => String(value ?? "").trim())
        .filter(Boolean);

    const uniqueParts = [...new Set(parts)];

    return (
        uniqueParts.join(", ") ||
        String(company.address ?? "").trim() ||
        "Location not provided"
    );
}


    return (
        <section className="mb-8 space-y-5">
            <div>
                <h2 className="text-2xl font-bold text-slate-900">
                    Multi-Company User Access
                </h2>

                <p className="mt-1 text-sm text-slate-500">
                    Assign an existing login account to another
                    company. Each company can have its own role
                    for that user.
                </p>
            </div>

            {message && (
                <div
                    role="status"
                    className="rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-800"
                >
                    {message}
                </div>
            )}

            {error && (
                <div
                    role="alert"
                    className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800"
                >
                    {error}
                </div>
            )}

            <form
                onSubmit={submitAssignment}
                className="grid grid-cols-1 gap-4 rounded-xl border border-slate-200 bg-white p-5 md:grid-cols-2"
            >
                <div className="md:col-span-2">
                    <h3 className="text-lg font-semibold text-slate-900">
                        Assign Existing User
                    </h3>

                    <p className="mt-1 text-sm text-slate-500">
                        Enter the existing username or email.
                        No new password is required.
                    </p>
                </div>

                <div>
                    <label
                        htmlFor="existing-user-identifier"
                        className="mb-2 block text-sm font-medium"
                    >
                        Existing Username or Email
                    </label>

                    <input
                        id="existing-user-identifier"
                        value={identifier}
                        onChange={(event) =>
                            setIdentifier(event.target.value)
                        }
                        className="w-full rounded-lg border border-slate-300 px-4 py-3"
                        placeholder="umer or umer@example.com"
                        autoComplete="off"
                        required
                    />
                </div>

                <div>
                    <label
                        htmlFor="access-company"
                        className="mb-2 block text-sm font-medium"
                    >
                        Company
                    </label>

                    <select
                        id="access-company"
                        value={companyId}
                        onChange={(event) =>
                            handleCompanyChange(event.target.value)
                        }
                        className="w-full rounded-lg border border-slate-300 px-4 py-3"
                        required
                        disabled={!companies.length || loading}
                    >
                        <option value="" disabled>
                            Select a company
                        </option>

                        {companies.map((company, index) => (
                            <option
                                key={company.company_id}
                                value={String(company.company_id)}
                            >
                                {index + 1}. Company ID: {company.company_id} —{" "}
                                {company.company_name} — {locationLabel(company)}
                            </option>
                        ))}
                    </select>

                    {selectedCompany && (
                        <p className="mt-2 text-xs text-slate-500">
                            Your role: {selectedCompany.your_role}
                        </p>
                    )}
                </div>

                <div>
                    <label
                        htmlFor="access-role"
                        className="mb-2 block text-sm font-medium"
                    >
                        Role in Selected Company
                    </label>

                    <select
                        id="access-role"
                        value={roleId}
                        onChange={(event) =>
                            setRoleId(event.target.value)
                        }
                        className="w-full rounded-lg border border-slate-300 px-4 py-3"
                        required
                        disabled={!availableRoles.length || loading}
                    >
                        <option value="" disabled>
                            Select a role
                        </option>

                        {availableRoles.map((role) => (
                            <option
                                key={role.role_id}
                                value={String(role.role_id)}
                            >
                                {role.role_name}
                                {role.company_id == null
                                    ? " (Global role)"
                                    : " (Company role)"}
                            </option>
                        ))}
                    </select>
                </div>

                <div className="flex items-end">
                    <button
                        type="submit"
                        disabled={
                            saving ||
                            loading ||
                            !companyId ||
                            !roleId ||
                            !companies.length
                        }
                        className="w-full rounded-lg bg-slate-900 px-5 py-3 font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                        {saving
                            ? "Assigning..."
                            : "Assign User to Company"}
                    </button>
                </div>

                {!companies.length && !loading && (
                    <p className="text-sm text-amber-700 md:col-span-2">
                        No company is available to you for user
                        management. You must belong to a company
                        and have Users view permission.
                    </p>
                )}
            </form>
        </section>
    );
}
