"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
    ArrowLeft,
    Building2,
    LoaderCircle,
    CheckCircle2,
    ShieldCheck,
} from "lucide-react";

function ForgotPasswordContent() {
    const searchParams = useSearchParams();

    const companyId = searchParams.get("companyId") || "";
    const companyName =
        searchParams.get("companyName") || "Selected company";

    const [username, setUsername] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [success, setSuccess] = useState("");

    async function handleSubmit(event) {
        event.preventDefault();

        setError("");
        setSuccess("");

        if (!companyId) {
            setError(
                "No company was selected. Return to the company list and try again."
            );
            return;
        }

        if (!username.trim()) {
            setError("Enter your username.");
            return;
        }

        setLoading(true);

        try {
            const response = await fetch("/api/password-reset/request", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Accept: "application/json",
                },
                body: JSON.stringify({
                    username: username.trim(),
                    companyId,
                }),
            });

            const data = await response.json().catch(() => ({}));

            if (!response.ok) {
                throw new Error(
                    data.message ||
                        "Unable to submit the password reset request."
                );
            }

            setSuccess(
                data.message ||
                    "If the account matches this company, your request has been sent for administrator review."
            );

            setUsername("");
        } catch (err) {
            setError(
                err.message ||
                    "Unable to submit the password reset request."
            );
        } finally {
            setLoading(false);
        }
    }

    return (
        <main className="flex min-h-screen items-center justify-center bg-gray-50 px-4 py-10">
            <div className="w-full max-w-md">
                <Link
                    href="/dashboard/register-company"
                    className="mb-6 inline-flex items-center gap-2 text-sm font-medium text-gray-600 hover:text-blue-700"
                >
                    <ArrowLeft size={17} />
                    Back to Companies
                </Link>

                <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm sm:p-8">
                    <div className="mb-6 flex h-14 w-14 items-center justify-center rounded-xl bg-blue-50 text-blue-700">
                        <ShieldCheck size={29} />
                    </div>

                    <h1 className="text-2xl font-bold text-gray-900">
                        Reset Company Password
                    </h1>

                    <p className="mt-2 text-sm leading-6 text-gray-600">
                        Submit a password reset request for the selected
                        company. Its administrator can review the request.
                    </p>

                    <div className="mt-6 flex items-start gap-3 rounded-xl border border-blue-100 bg-blue-50 p-4">
                        <Building2
                            size={20}
                            className="mt-0.5 shrink-0 text-blue-700"
                        />

                        <div className="min-w-0">
                            <p className="text-xs font-medium uppercase tracking-wide text-blue-700">
                                Selected company
                            </p>

                            <p className="mt-1 break-words font-semibold text-gray-900">
                                {companyName}
                            </p>

                            <p className="mt-1 text-xs text-gray-500">
                                Company ID: {companyId || "Not selected"}
                            </p>
                        </div>
                    </div>

                    {error && (
                        <div
                            role="alert"
                            className="mt-5 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700"
                        >
                            {error}
                        </div>
                    )}

                    {success ? (
                        <div
                            role="status"
                            className="mt-5 rounded-xl border border-green-200 bg-green-50 p-4"
                        >
                            <div className="flex items-start gap-2 text-green-800">
                                <CheckCircle2
                                    size={20}
                                    className="mt-0.5 shrink-0"
                                />

                                <p className="text-sm leading-6">
                                    {success}
                                </p>
                            </div>

                            <Link
                                href="/dashboard/register-company"
                                className="mt-4 inline-flex w-full items-center justify-center rounded-lg bg-blue-600 px-4 py-3 text-sm font-semibold text-white hover:bg-blue-700"
                            >
                                Return to Companies
                            </Link>
                        </div>
                    ) : (
                        <form
                            onSubmit={handleSubmit}
                            className="mt-6 space-y-5"
                        >
                            <div>
                                <label
                                    htmlFor="username"
                                    className="mb-1.5 block text-sm font-medium text-gray-700"
                                >
                                    Username
                                </label>

                                <input
                                    id="username"
                                    name="username"
                                    type="text"
                                    value={username}
                                    onChange={(event) => {
                                        setUsername(event.target.value);
                                        setError("");
                                    }}
                                    autoComplete="username"
                                    required
                                    minLength={1}
                                    maxLength={100}
                                    className="w-full rounded-lg border border-gray-300 px-3 py-3 text-sm text-gray-900 outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100"
                                    placeholder="Enter your company username"
                                />
                            </div>

                            <button
                                type="submit"
                                disabled={loading || !companyId}
                                className="flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-3 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
                            >
                                {loading ? (
                                    <>
                                        <LoaderCircle
                                            size={18}
                                            className="animate-spin"
                                        />
                                        Submitting Request...
                                    </>
                                ) : (
                                    "Submit Reset Request"
                                )}
                            </button>
                        </form>
                    )}

                    <p className="mt-6 text-center text-sm text-gray-600">
                        Remember your password?{" "}
                        <Link
                            href={`/login?companyId=${encodeURIComponent(
                                companyId
                            )}&companyName=${encodeURIComponent(
                                companyName
                            )}`}
                            className="font-semibold text-blue-600 hover:underline"
                        >
                            Back to This Company&apos;s Login
                        </Link>
                    </p>
                </div>
            </div>
        </main>
    );
}

export default function ForgotPasswordPage() {
    return (
        <Suspense
            fallback={
                <main className="flex min-h-screen items-center justify-center bg-gray-50">
                    <div className="flex items-center gap-3 text-sm text-gray-600">
                        <LoaderCircle className="animate-spin" size={22} />
                        Loading password recovery...
                    </div>
                </main>
            }
        >
            <ForgotPasswordContent />
        </Suspense>
    );
}