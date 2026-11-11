"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, Building2 } from "lucide-react";

const SELECTED_COMPANY_KEY = "erp-selected-company";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const initialCompanyId = searchParams.get("companyId") || "";
  const initialCompanyName =
    searchParams.get("companyName") || "Administrator Login";

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [selectedCompanyId, setSelectedCompanyId] = useState("");
  const [companies, setCompanies] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const forgotPasswordHref = initialCompanyId
    ? `/forgot-password?companyId=${encodeURIComponent(
      initialCompanyId
    )}&companyName=${encodeURIComponent(initialCompanyName)}`
    : "/forgot-password";

  async function handleLogin(event) {
    event.preventDefault();
    setError("");

    if (!username.trim() || !password) {
      setError("Please enter your username and password.");
      return;
    }

    if (companies.length > 0 && !selectedCompanyId) {
      setError("Please select a company to continue.");
      return;
    }

    setLoading(true);

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        credentials: "same-origin",
        cache: "no-store",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          username: username.trim(),
          password,
          companyId: selectedCompanyId || undefined,
        }),
      });

      const data = await response.json().catch(() => ({}));

      if (
        response.status === 409 &&
        data.code === "COMPANY_SELECTION_REQUIRED" &&
        Array.isArray(data.companies)
      ) {
        const uniqueCompanies = [
  ...new Map(
    data.companies
      .filter((company) => company.company_name?.trim())
      .map((company) => [
        company.company_name.trim().replace(/\s+/g, " ").toLowerCase(),
        {
          ...company,
          company_name: company.company_name.trim().replace(/\s+/g, " "),
        },
      ])
  ).values(),
];

setCompanies(uniqueCompanies);
setSelectedCompanyId("");
setError("Please select the company you want to access.");
      }

      if (!response.ok) {
        setError(
          data.message || "Login failed. Please check your credentials."
        );
        return;
      }

      if (!data.user?.companyId) {
        setError(
          "Login succeeded, but company information is missing."
        );
        return;
      }

      const companyId = String(data.user.companyId);
      const companyName = data.user.companyName || "Company";

      // Preserve company context for the logout redirect.
      if (initialCompanyId || selectedCompanyId) {
        localStorage.setItem(
          SELECTED_COMPANY_KEY,
          JSON.stringify({ companyId, companyName })
        );
      } else {
        localStorage.removeItem(SELECTED_COMPANY_KEY);
      }

      // Successful login opens the dashboard.
      window.location.replace("/dashboard");
    } catch (error) {
      console.error("Login failed:", error);
      setError("Unable to connect to the server. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-100 px-4 py-8">
      <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-xl">
        {initialCompanyId && (
          <Link
            href="/dashboard/register-company"
            className="mb-6 inline-flex items-center gap-2 rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100"
          >
            <ArrowLeft size={17} />
            Back to Companies
          </Link>
        )}

        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-900 text-white">
            {initialCompanyId ? (
              <Building2 size={28} />
            ) : (
              <span className="text-2xl font-bold">
                {initialCompanyName.charAt(0).toUpperCase()}
              </span>
            )}
          </div>

          <h1 className="break-words text-3xl font-bold text-slate-900">
            {initialCompanyName}
          </h1>

          <p className="mt-2 text-slate-500">
            Sign in to your company account
          </p>
        </div>

        {error && (
          <div
            role="alert"
            className="mb-5 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
          >
            {error}
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-5">
          <div>
            <label
              htmlFor="username"
              className="mb-2 block text-sm font-medium text-slate-700"
            >
              Username
            </label>

            <input
              id="username"
              type="text"
              autoComplete="username"
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              placeholder="Enter username"
              className="w-full rounded-lg border border-slate-300 px-4 py-3 outline-none focus:border-slate-600 focus:ring-2 focus:ring-slate-200"
              required
            />
          </div>

          <div>
            <label
              htmlFor="password"
              className="mb-2 block text-sm font-medium text-slate-700"
            >
              Password
            </label>

            <input
              id="password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Enter password"
              className="w-full rounded-lg border border-slate-300 px-4 py-3 outline-none focus:border-slate-600 focus:ring-2 focus:ring-slate-200"
              required
            />

            <div className="mt-2 text-right">
              <Link
                href={forgotPasswordHref}
                className="text-sm font-medium text-blue-700 hover:underline"
              >
                Forgot Password?
              </Link>
            </div>
          </div>

          {companies.length > 0 && (
            <div>
              <label
                htmlFor="company"
                className="mb-2 block text-sm font-medium text-slate-700"
              >
                Select Company
              </label>

              <select
                id="company"
                value={selectedCompanyId}
                onChange={(event) =>
                  setSelectedCompanyId(event.target.value)
                }
                required
                className="w-full rounded-lg border border-slate-300 bg-white px-4 py-3 outline-none focus:border-slate-600"
              >
                <option value="">Choose a company</option>

                {companies.map((company) => (
                  <option
                    key={company.company_id}
                    value={String(company.company_id)}
                  >
                    {company.company_name}
                  </option>
                ))}
              </select>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-slate-900 py-3 font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? "Signing in..." : "Sign In"}
          </button>
        </form>

        <div className="mt-6 text-center text-sm text-slate-500">
          Secure Company Login
        </div>

        <div className="mt-4 text-center">
          <button
            type="button"
            onClick={() => router.push("/dashboard/register-company")}
            className="text-sm font-medium text-blue-700 hover:underline"
          >
            Company registration and selection
          </button>
        </div>
      </div>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-screen items-center justify-center bg-slate-100">
          <p className="text-slate-600">Loading login...</p>
        </main>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
