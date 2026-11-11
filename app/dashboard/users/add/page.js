
"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";

const emptyForm = {
    fullName: "",
    username: "",
    email: "",
    password: "",
    location: "",
    roleId: "",
    isActive: true,
};

const inputClass =
    "w-full rounded-lg border border-slate-300 px-4 py-3 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100";

export default function AddUserPage() {
    const router = useRouter();
    const searchParams = useSearchParams();

    const userId = searchParams.get("id");
    const companyId = searchParams.get("companyId");

    const [form, setForm] = useState(emptyForm);
    const [roles, setRoles] = useState([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState("");

    const loadFormData = useCallback(
        async (signal) => {
            try {
                setLoading(true);
                setError("");

                if (userId && !companyId) {
                    throw new Error(
                        "Company ID is missing. Return to Users and click Edit for the required company."
                    );
                }

                const requests = [
                    fetch("/api/roles", {
                        cache: "no-store",
                        signal,
                    }),
                ];

                if (userId) {
                    requests.push(
                        fetch("/api/users", {
                            cache: "no-store",
                            signal,
                        })
                    );
                }

                const responses = await Promise.all(requests);

                const results = await Promise.all(
                    responses.map(async (response) => {
                        try {
                            return await response.json();
                        } catch {
                            return {};
                        }
                    })
                );

                if (signal.aborted) return;

                if (!responses[0].ok) {
                    throw new Error(
                        results[0].message || "Failed to load roles."
                    );
                }

                setRoles(
                    Array.isArray(results[0].roles)
                        ? results[0].roles
                        : []
                );

                if (userId) {
                    if (!responses[1].ok) {
                        throw new Error(
                            results[1].message ||
                                "Failed to load the user list."
                        );
                    }

                    const users = Array.isArray(results[1].users)
                        ? results[1].users
                        : [];

                    // Find the exact user-company membership.
                    const user = users.find(
                        (item) =>
                            String(item.user_id) === String(userId) &&
                            String(item.company_id) === String(companyId)
                    );

                    if (!user) {
                        throw new Error(
                            `User ${userId} was not found in company ${companyId}, or you do not have permission to view that membership.`
                        );
                    }

                    setForm({
                        fullName: user.full_name || "",
                        username: user.username || "",
                        email: user.email || "",
                        password: "",
                        location:
                            user.user_location ??
                            user.location ??
                            "",
                        roleId:
                            user.role_id != null
                                ? String(user.role_id)
                                : "",
                        isActive: Boolean(user.is_active),
                    });
                } else {
                    setForm(emptyForm);
                }
            } catch (err) {
                if (
                    err.name !== "AbortError" &&
                    !signal.aborted
                ) {
                    setError(
                        err.message || "Unable to load the user form."
                    );
                }
            } finally {
                if (!signal.aborted) {
                    setLoading(false);
                }
            }
        },
        [userId, companyId]
    );

    useEffect(() => {
        const controller = new AbortController();

        Promise.resolve().then(() => {
            if (!controller.signal.aborted) {
                loadFormData(controller.signal);
            }
        });

        return () => controller.abort();
    }, [loadFormData]);

    function updateField(event) {
        const { name, value, type, checked } = event.target;

        setForm((current) => ({
            ...current,
            [name]: type === "checkbox" ? checked : value,
        }));
    }

    async function submitForm(event) {
        event.preventDefault();
        setError("");

        if (userId && !companyId) {
            setError("Company ID is missing. Please return to Users.");
            return;
        }

        if (!Number.isSafeInteger(Number(form.roleId)) ||
            Number(form.roleId) <= 0) {
            setError("Please select a valid role.");
            return;
        }

        setSaving(true);

        try {
            const isEditing = Boolean(userId);

            const url = isEditing
                ? `/api/users/${encodeURIComponent(userId)}?companyId=${encodeURIComponent(companyId)}`
                : "/api/users";

            const payload = {
                ...form,
                location: form.location.trim(),
                roleId: Number(form.roleId),
            };

            // Tell the API which company's membership is being edited.
            if (isEditing) {
                payload.companyId = Number(companyId);
            }

            const response = await fetch(url, {
                method: isEditing ? "PUT" : "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify(payload),
            });

            let data = {};

            try {
                data = await response.json();
            } catch {
                // Handle non-JSON server responses below.
            }

            if (!response.ok) {
                throw new Error(
                    data.message ||
                        (isEditing
                            ? "Failed to update user."
                            : "Failed to create user.")
                );
            }

            router.push("/dashboard/users");
            router.refresh();
        } catch (err) {
            setError(err.message || "User operation failed.");
        } finally {
            setSaving(false);
        }
    }

    return (
        <div className="mx-auto max-w-4xl space-y-6">
            <div>
                <Link
                    href="/dashboard/users"
                    className="text-sm font-medium text-blue-700 hover:underline"
                >
                    ← Back to Users
                </Link>

                <h1 className="mt-3 text-3xl font-bold text-slate-900">
                    {userId ? "Edit User" : "Add User"}
                </h1>

                <p className="mt-1 text-slate-500">
                    {userId
                        ? `Update the user account for company ${companyId || ""}.`
                        : "Create a new user account."}
                </p>
            </div>

            {error && (
                <div
                    role="alert"
                    className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-800"
                >
                    {error}
                </div>
            )}

            {loading ? (
                <div className="rounded-xl border bg-white p-6 text-slate-500">
                    Loading user form...
                </div>
            ) : (
                <form
                    onSubmit={submitForm}
                    className="grid grid-cols-1 gap-5 rounded-xl border border-slate-200 bg-white p-6 md:grid-cols-2"
                >
                    <div className="md:col-span-2">
                        <h2 className="text-lg font-semibold text-slate-900">
                            User Information
                        </h2>
                    </div>

                    <div>
                        <label
                            htmlFor="fullName"
                            className="mb-2 block text-sm font-medium"
                        >
                            Full Name
                        </label>
                        <input
                            id="fullName"
                            name="fullName"
                            value={form.fullName}
                            onChange={updateField}
                            className={inputClass}
                            maxLength={150}
                            required
                        />
                    </div>

                    <div>
                        <label
                            htmlFor="username"
                            className="mb-2 block text-sm font-medium"
                        >
                            Username
                        </label>
                        <input
                            id="username"
                            name="username"
                            value={form.username}
                            onChange={updateField}
                            className={inputClass}
                            minLength={3}
                            maxLength={100}
                            required
                        />
                    </div>

                    <div>
                        <label
                            htmlFor="email"
                            className="mb-2 block text-sm font-medium"
                        >
                            Email
                        </label>
                        <input
                            id="email"
                            type="email"
                            name="email"
                            value={form.email}
                            onChange={updateField}
                            className={inputClass}
                            maxLength={150}
                        />
                    </div>

                    <div>
                        <label
                            htmlFor="location"
                            className="mb-2 block text-sm font-medium"
                        >
                            Location
                        </label>
                        <input
                            id="location"
                            name="location"
                            type="text"
                            value={form.location}
                            onChange={updateField}
                            className={inputClass}
                            maxLength={255}
                            placeholder="City, State/Province, Country"
                        />
                    </div>

                    <div>
                        <label
                            htmlFor="password"
                            className="mb-2 block text-sm font-medium"
                        >
                            {userId
                                ? "New Password (optional)"
                                : "Password"}
                        </label>
                        <input
                            id="password"
                            type="password"
                            name="password"
                            value={form.password}
                            onChange={updateField}
                            className={inputClass}
                            placeholder={
                                userId
                                    ? "Leave blank to keep current password"
                                    : "At least 8 characters"
                            }
                            minLength={8}
                            autoComplete="new-password"
                            required={!userId}
                        />
                    </div>

                    <div>
                        <label
                            htmlFor="roleId"
                            className="mb-2 block text-sm font-medium"
                        >
                            Role in Selected Company
                        </label>
                        <select
                            id="roleId"
                            name="roleId"
                            value={form.roleId}
                            onChange={updateField}
                            className={inputClass}
                            required
                        >
                            <option value="">Select Role</option>

                            {roles.map((role) => (
                                <option
                                    key={role.role_id}
                                    value={String(role.role_id)}
                                >
                                    {role.role_name}
                                </option>
                            ))}
                        </select>
                    </div>

                    <label className="flex items-center gap-3 self-center">
                        <input
                            type="checkbox"
                            name="isActive"
                            checked={form.isActive}
                            onChange={updateField}
                            className="h-5 w-5"
                        />
                        <span className="text-sm font-medium">
                            Active User
                        </span>
                    </label>

                    <div className="flex flex-wrap gap-3 md:col-span-2">
                        <button
                            type="submit"
                            disabled={saving}
                            className="rounded-lg bg-slate-900 px-6 py-3 font-medium text-white hover:bg-slate-800 disabled:opacity-50"
                        >
                            {saving
                                ? "Saving..."
                                : userId
                                  ? "Update User"
                                  : "Create User"}
                        </button>

                        <Link
                            href="/dashboard/users"
                            className="rounded-lg border border-slate-300 px-6 py-3 text-center hover:bg-slate-50"
                        >
                            Cancel
                        </Link>
                    </div>
                </form>
            )}
        </div>
    );
}