
"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Building2,
  Headphones,
  FileText,
  CircleHelp,
  CheckCircle2,
  AlertCircle,
  Send,
  RotateCcw,
  LoaderCircle,
  ShieldCheck,
  LockKeyhole,
  RefreshCw,
  Plus,
} from "lucide-react";

const CATEGORIES = [
  { value: "password_reset", label: "Password Reset" },
  { value: "account_unlock", label: "Account Unlock" },
  { value: "company_access", label: "Company Access" },
  { value: "new_company", label: "Register Another Company" },
  { value: "technical_support", label: "Technical Support" },
  { value: "data_recovery", label: "Data Recovery" },
  { value: "license_renewal", label: "License Renewal" },
  { value: "feature_request", label: "Feature Request" },
  { value: "other", label: "Other" },
];

const inputClass =
  "w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-800 outline-none transition placeholder:text-slate-400 hover:border-slate-300 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10";

const labelClass = "mb-2 block text-sm font-semibold text-slate-700";

const DEFAULT_PERMISSIONS = {
  canView: false,
  canCreate: false,
  canUpdate: false,
  canDelete: false,
};

function getUniqueCompanies(companies) {
  const uniqueCompanies = new Map();

  for (const company of companies) {
    const companyId = String(company?.companyId ?? "").trim();
    const companyName = String(company?.companyName ?? "")
      .trim()
      .replace(/\s+/g, " ");

    if (!companyId || !companyName) continue;

    const normalizedName = companyName.toLocaleLowerCase();

    if (!uniqueCompanies.has(normalizedName)) {
      uniqueCompanies.set(normalizedName, {
        ...company,
        companyId,
        companyName,
      });
    }
  }

  return Array.from(uniqueCompanies.values()).sort((a, b) =>
    a.companyName.localeCompare(b.companyName)
  );
}

function normalizePermissions(value) {
  if (!value || typeof value !== "object") {
    return DEFAULT_PERMISSIONS;
  }

  return {
    canView: value.canView === true,
    canCreate: value.canCreate === true,
    canUpdate: value.canUpdate === true,
    canDelete: value.canDelete === true,
  };
}

function getErrorMessage(data, fallback) {
  return typeof data?.error === "string" && data.error.trim()
    ? data.error
    : fallback;
}

export default function HelpSupportPage() {
  const [companies, setCompanies] = useState([]);
  const [companyId, setCompanyId] = useState("");
  const [category, setCategory] = useState("technical_support");
  const [subject, setSubject] = useState("");
  const [description, setDescription] = useState("");

  const [permissions, setPermissions] = useState(DEFAULT_PERMISSIONS);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [accessDenied, setAccessDenied] = useState(false);

  const loadCompanies = useCallback(async () => {
    setLoading(true);
    setError("");
    setAccessDenied(false);
    setPermissions(DEFAULT_PERMISSIONS);

    try {
      const response = await fetch("/api/support-requests", {
        method: "GET",
        credentials: "same-origin",
        cache: "no-store",
        headers: {
          Accept: "application/json",
        },
      });

      const data = await response.json().catch(() => ({}));

      if (response.status === 401) {
        throw new Error(
          getErrorMessage(data, "Your session has expired. Please log in again.")
        );
      }

      if (response.status === 403) {
        setAccessDenied(true);
        setCompanies([]);
        setCompanyId("");
        setPermissions(DEFAULT_PERMISSIONS);
        setError(
          getErrorMessage(
            data,
            "You do not have permission to view Help & Support."
          )
        );
        return;
      }

      if (!response.ok) {
        throw new Error(
          getErrorMessage(data, "Unable to load your companies.")
        );
      }

      const nextPermissions = normalizePermissions(data.permissions);

      // Fail closed if the API does not explicitly confirm View.
      if (!nextPermissions.canView) {
        setAccessDenied(true);
        setCompanies([]);
        setCompanyId("");
        setPermissions(nextPermissions);
        setError("You do not have permission to view Help & Support.");
        return;
      }

      const availableCompanies = Array.isArray(data.companies)
        ? data.companies
        : [];

      const uniqueCompanies = getUniqueCompanies(availableCompanies);

      setPermissions(nextPermissions);
      setCompanies(uniqueCompanies);

      setCompanyId((currentCompanyId) => {
        const currentStillExists = uniqueCompanies.some(
          (company) => company.companyId === currentCompanyId
        );

        if (currentStillExists) return currentCompanyId;

        return uniqueCompanies[0]?.companyId ?? "";
      });
    } catch (err) {
      setCompanies([]);
      setCompanyId("");
      setPermissions(DEFAULT_PERMISSIONS);
      setError(err.message || "Unable to load Help & Support.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function initialLoad() {
      // Keep the initial request inside the effect's cancellation guard.
      try {
        const response = await fetch("/api/support-requests", {
          method: "GET",
          credentials: "same-origin",
          cache: "no-store",
          headers: {
            Accept: "application/json",
          },
        });

        const data = await response.json().catch(() => ({}));

        if (cancelled) return;

        if (response.status === 401) {
          setError(
            getErrorMessage(
              data,
              "Your session has expired. Please log in again."
            )
          );
          setCompanies([]);
          setPermissions(DEFAULT_PERMISSIONS);
          return;
        }

        if (response.status === 403) {
          setAccessDenied(true);
          setError(
            getErrorMessage(
              data,
              "You do not have permission to view Help & Support."
            )
          );
          setCompanies([]);
          setCompanyId("");
          setPermissions(DEFAULT_PERMISSIONS);
          return;
        }

        if (!response.ok) {
          throw new Error(
            getErrorMessage(data, "Unable to load your companies.")
          );
        }

        const nextPermissions = normalizePermissions(data.permissions);

        if (!nextPermissions.canView) {
          setAccessDenied(true);
          setError("You do not have permission to view Help & Support.");
          setCompanies([]);
          setCompanyId("");
          setPermissions(nextPermissions);
          return;
        }

        const availableCompanies = Array.isArray(data.companies)
          ? data.companies
          : [];

        const uniqueCompanies = getUniqueCompanies(availableCompanies);

        setPermissions(nextPermissions);
        setCompanies(uniqueCompanies);
        setCompanyId(uniqueCompanies[0]?.companyId ?? "");
      } catch (err) {
        if (!cancelled) {
          setError(err.message || "Unable to load your companies.");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    initialLoad();

    return () => {
      cancelled = true;
    };
  }, []);

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setSuccess("");

    if (!permissions.canView) {
      setError("You do not have permission to view Help & Support.");
      return;
    }

    if (!permissions.canCreate) {
      setError("You do not have permission to create support requests.");
      return;
    }

    if (submitting) return;

    if (!companyId) {
      setError("Please select a company.");
      return;
    }

    if (!companies.some((company) => company.companyId === companyId)) {
      setError("The selected company is invalid. Please select again.");
      return;
    }

    if (!CATEGORIES.some((item) => item.value === category)) {
      setError("Please select a valid request type.");
      return;
    }

    if (!subject.trim() || subject.trim().length > 200) {
      setError("Enter a subject of no more than 200 characters.");
      return;
    }

    if (!description.trim() || description.trim().length > 10000) {
      setError("Enter a description of no more than 10,000 characters.");
      return;
    }

    setSubmitting(true);

    try {
      const response = await fetch("/api/support-requests", {
        method: "POST",
        credentials: "same-origin",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        cache: "no-store",
        body: JSON.stringify({
          companyId: Number(companyId),
          category,
          subject: subject.trim(),
          description: description.trim(),
        }),
      });

      const data = await response.json().catch(() => ({}));

      if (response.status === 401) {
        throw new Error(
          getErrorMessage(data, "Your session has expired. Please log in again.")
        );
      }

      if (response.status === 403) {
        // Permissions may have been changed after the page loaded.
        if (
          /view help|view.*permission/i.test(String(data.error || ""))
        ) {
          setAccessDenied(true);
          setPermissions(DEFAULT_PERMISSIONS);
        } else {
          setPermissions((current) => ({
            ...current,
            canCreate: false,
          }));
        }

        throw new Error(
          getErrorMessage(
            data,
            "You do not have permission to create support requests."
          )
        );
      }

      if (!response.ok) {
        throw new Error(
          getErrorMessage(data, "Unable to submit your request.")
        );
      }

      const requestId =
        data?.request?.request_id ??
        data?.request?.id ??
        data?.requestId ??
        null;

      setSuccess(
        requestId
          ? `Support request #${requestId} was submitted successfully.`
          : "Your support request was submitted successfully."
      );

      setSubject("");
      setDescription("");
      setCategory("technical_support");
    } catch (err) {
      setError(err.message || "Unable to submit your request.");
    } finally {
      setSubmitting(false);
    }
  }

  function clearForm() {
    setSubject("");
    setDescription("");
    setCategory("technical_support");
    setError("");
    setSuccess("");
  }

  const selectedCompany = companies.find(
    (company) => company.companyId === companyId
  );

  const canShowPage = permissions.canView && !accessDenied;

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      {/* Header */}
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto max-w-6xl px-4 py-5 sm:px-6 lg:px-8">
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-2 rounded-lg text-sm font-medium text-slate-500 transition hover:text-blue-700"
          >
            <ArrowLeft size={17} />
            Back to Dashboard
          </Link>

          <div className="mt-6 flex items-center gap-4">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-blue-600 text-white shadow-lg shadow-blue-600/20">
              <Headphones size={28} />
            </div>

            <div>
              <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
                Help & Support
              </h1>
              <p className="mt-1 text-sm text-slate-500 sm:text-base">
                We&apos;re here to help you resolve your ERP issues.
              </p>
            </div>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        {loading ? (
          <section className="flex min-h-80 flex-col items-center justify-center rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
            <LoaderCircle
              size={34}
              className="animate-spin text-blue-600"
            />
            <h2 className="mt-4 font-semibold text-slate-900">
              Checking your access
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              Loading your companies and permissions...
            </p>
          </section>
        ) : accessDenied ? (
          <section
            role="alert"
            className="mx-auto max-w-xl rounded-2xl border border-amber-200 bg-white p-8 text-center shadow-sm sm:p-10"
          >
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-amber-50 text-amber-600">
              <LockKeyhole size={30} />
            </div>

            <h2 className="mt-5 text-xl font-bold text-slate-900">
              Access denied
            </h2>

            <p className="mt-2 text-sm leading-6 text-slate-600">
              {error ||
                "Your role does not have permission to view Help & Support."}
            </p>

            <div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row">
              <button
                type="button"
                onClick={loadCompanies}
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
              >
                <RefreshCw size={16} />
                Check Again
              </button>

              <Link
                href="/dashboard"
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-blue-700"
              >
                <ArrowLeft size={16} />
                Back to Dashboard
              </Link>
            </div>
          </section>
        ) : (
          <>
            {!permissions.canCreate && (
              <div
                role="status"
                className="mb-6 flex items-start gap-3 rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900"
              >
                <ShieldCheck size={20} className="mt-0.5 shrink-0" />
                <div>
                  <p className="font-semibold">View-only access</p>
                  <p className="mt-1 leading-5">
                    You can access this page, but your role does not have
                    permission to create support requests. Contact your
                    administrator if you need this permission.
                  </p>
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
              {/* Main content */}
              <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                <div className="border-b border-slate-100 px-5 py-6 sm:px-8">
                  <div className="flex items-start gap-3">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-700">
                      {permissions.canCreate ? (
                        <FileText size={22} />
                      ) : (
                        <ShieldCheck size={22} />
                      )}
                    </div>

                    <div>
                      <h2 className="text-lg font-bold text-slate-900">
                        {permissions.canCreate
                          ? "Create a support request"
                          : "Help & Support"}
                      </h2>
                      <p className="mt-1 text-sm leading-6 text-slate-500">
                        {permissions.canCreate
                          ? "Describe your issue so your ERP administrator can review your request."
                          : "Your current role allows you to view this page, but not submit a new request."}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="p-5 sm:p-8">
                  {error && (
                    <div
                      role="alert"
                      className="mb-6 flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800"
                    >
                      <AlertCircle
                        size={19}
                        className="mt-0.5 shrink-0"
                      />
                      <p>{error}</p>
                    </div>
                  )}

                  {success && (
                    <div
                      role="status"
                      className="mb-6 flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800"
                    >
                      <CheckCircle2
                        size={19}
                        className="mt-0.5 shrink-0"
                      />
                      <p>{success}</p>
                    </div>
                  )}

                  {!permissions.canCreate ? (
                    <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-5 py-12 text-center">
                      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-white text-slate-400 shadow-sm">
                        <LockKeyhole size={27} />
                      </div>
                      <h3 className="mt-4 font-semibold text-slate-900">
                        Request creation is restricted
                      </h3>
                      <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-slate-500">
                        The Create permission for Help & Support is disabled
                        for your assigned role. An administrator can change
                        this under User Rights.
                      </p>
                    </div>
                  ) : companies.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-5 py-12 text-center">
                      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-white text-slate-400 shadow-sm">
                        <Building2 size={28} />
                      </div>

                      <h3 className="mt-4 font-semibold text-slate-900">
                        No companies available
                      </h3>

                      <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-slate-500">
                        No active company assignments were returned for your
                        account. Contact your administrator if you believe
                        this is incorrect.
                      </p>

                      <button
                        type="button"
                        onClick={loadCompanies}
                        className="mt-5 inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
                      >
                        <RotateCcw size={16} />
                        Try Again
                      </button>
                    </div>
                  ) : (
                    <form onSubmit={handleSubmit} className="space-y-6">
                      {/* Company */}
                      <div>
                        <label
                          htmlFor="companyId"
                          className={labelClass}
                        >
                          Company <span className="text-red-500">*</span>
                        </label>

                        <div className="relative">
                          <Building2
                            size={19}
                            className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"
                          />

                          <select
                            id="companyId"
                            value={companyId}
                            onChange={(event) =>
                              setCompanyId(event.target.value)
                            }
                            required
                            disabled={submitting}
                            className={`${inputClass} pl-11 disabled:cursor-not-allowed disabled:bg-slate-100`}
                          >
                            <option value="">Select a company</option>

                            {companies.map((company) => (
                              <option
                                key={company.companyId}
                                value={company.companyId}
                              >
                                {company.companyName}
                              </option>
                            ))}
                          </select>
                        </div>

                        {selectedCompany && (
                          <p className="mt-2 flex items-center gap-1.5 text-xs text-slate-500">
                            <CheckCircle2
                              size={14}
                              className="text-emerald-600"
                            />
                            Request will be associated with{" "}
                            {selectedCompany.companyName}.
                          </p>
                        )}
                      </div>

                      {/* Category */}
                      <div>
                        <label
                          htmlFor="category"
                          className={labelClass}
                        >
                          Request Type{" "}
                          <span className="text-red-500">*</span>
                        </label>

                        <div className="relative">
                          <CircleHelp
                            size={19}
                            className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"
                          />

                          <select
                            id="category"
                            value={category}
                            onChange={(event) =>
                              setCategory(event.target.value)
                            }
                            required
                            disabled={submitting}
                            className={`${inputClass} pl-11 disabled:cursor-not-allowed disabled:bg-slate-100`}
                          >
                            {CATEGORIES.map((item) => (
                              <option
                                key={item.value}
                                value={item.value}
                              >
                                {item.label}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>

                      {/* Subject */}
                      <div>
                        <div className="mb-2 flex items-center justify-between gap-3">
                          <label
                            htmlFor="subject"
                            className="text-sm font-semibold text-slate-700"
                          >
                            Subject{" "}
                            <span className="text-red-500">*</span>
                          </label>

                          <span className="text-xs text-slate-400">
                            {subject.length}/200
                          </span>
                        </div>

                        <input
                          id="subject"
                          type="text"
                          value={subject}
                          onChange={(event) =>
                            setSubject(event.target.value)
                          }
                          maxLength={200}
                          required
                          disabled={submitting}
                          placeholder="e.g. Unable to save a sales invoice"
                          className={`${inputClass} disabled:cursor-not-allowed disabled:bg-slate-100`}
                        />
                      </div>

                      {/* Description */}
                      <div>
                        <div className="mb-2 flex items-center justify-between gap-3">
                          <label
                            htmlFor="description"
                            className="text-sm font-semibold text-slate-700"
                          >
                            Description{" "}
                            <span className="text-red-500">*</span>
                          </label>

                          <span className="text-xs text-slate-400">
                            {description.length.toLocaleString()}/10,000
                          </span>
                        </div>

                        <textarea
                          id="description"
                          value={description}
                          onChange={(event) =>
                            setDescription(event.target.value)
                          }
                          maxLength={10000}
                          rows={6}
                          required
                          disabled={submitting}
                          placeholder="Explain what happened, what you expected, and any error message you received. Never include your password."
                          className={`${inputClass} min-h-36 resize-y leading-6 disabled:cursor-not-allowed disabled:bg-slate-100`}
                        />

                        <p className="mt-2 text-xs leading-5 text-slate-500">
                          Include relevant details to help the administrator
                          understand and investigate the issue.
                        </p>
                      </div>

                      {/* Actions */}
                      <div className="flex flex-col-reverse gap-3 border-t border-slate-100 pt-6 sm:flex-row sm:items-center">
                        <button
                          type="button"
                          onClick={clearForm}
                          disabled={submitting}
                          className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          <RotateCcw size={17} />
                          Clear Form
                        </button>

                        <button
                          type="submit"
                          disabled={
                            submitting ||
                            !permissions.canCreate ||
                            !companyId
                          }
                          className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-blue-600 px-6 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 focus:outline-none focus:ring-4 focus:ring-blue-500/20 disabled:cursor-not-allowed disabled:opacity-60 sm:flex-none"
                        >
                          {submitting ? (
                            <>
                              <LoaderCircle
                                size={18}
                                className="animate-spin"
                              />
                              Submitting...
                            </>
                          ) : (
                            <>
                              <Send size={17} />
                              Submit Request
                            </>
                          )}
                        </button>
                      </div>
                    </form>
                  )}
                </div>
              </section>

              {/* Information panel */}
              <aside className="space-y-5">
                <div className="rounded-2xl bg-slate-900 p-6 text-white shadow-sm">
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/10">
                    <Headphones size={23} />
                  </div>

                  <h2 className="mt-4 text-lg font-bold">
                    How can we help?
                  </h2>

                  <p className="mt-2 text-sm leading-6 text-slate-300">
                    Submit a clear support request so your administrator
                    can understand your problem and assist you.
                  </p>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                  <h3 className="font-bold text-slate-900">
                    Tips for faster support
                  </h3>

                  <ul className="mt-4 space-y-4">
                    <li className="flex items-start gap-3">
                      <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-700">
                        <FileText size={17} />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-slate-800">
                          Use a clear subject
                        </p>
                        <p className="mt-1 text-xs leading-5 text-slate-500">
                          Summarize the problem in one sentence.
                        </p>
                      </div>
                    </li>

                    <li className="flex items-start gap-3">
                      <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-violet-50 text-violet-700">
                        <CircleHelp size={17} />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-slate-800">
                          Explain the issue
                        </p>
                        <p className="mt-1 text-xs leading-5 text-slate-500">
                          Describe the steps and any error messages.
                        </p>
                      </div>
                    </li>

                    <li className="flex items-start gap-3">
                      <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700">
                        <ShieldCheck size={17} />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-slate-800">
                          Keep credentials private
                        </p>
                        <p className="mt-1 text-xs leading-5 text-slate-500">
                          Never include passwords or sensitive login details.
                        </p>
                      </div>
                    </li>
                  </ul>
                </div>

                <div className="rounded-xl border border-blue-100 bg-blue-50/70 p-4">
                  <p className="text-sm font-semibold text-blue-900">
                    Company-specific issue?
                  </p>
                  <p className="mt-1 text-xs leading-5 text-blue-800">
                    Select the correct company so your request is associated
                    with the intended company.
                  </p>
                </div>

                <div className="rounded-xl border border-slate-200 bg-white p-4">
                  <div className="flex items-center gap-2">
                    <ShieldCheck size={17} className="text-blue-600" />
                    <h3 className="text-sm font-bold text-slate-900">
                      Your permissions
                    </h3>
                  </div>

                  <div className="mt-4 space-y-3">
                    {[
                      {
                        label: "View",
                        allowed: permissions.canView,
                      },
                      {
                        label: "Create",
                        allowed: permissions.canCreate,
                      },
                      {
                        label: "Edit",
                        allowed: permissions.canUpdate,
                      },
                      {
                        label: "Delete",
                        allowed: permissions.canDelete,
                      },
                    ].map((permission) => (
                      <div
                        key={permission.label}
                        className="flex items-center justify-between gap-3"
                      >
                        <span className="text-sm text-slate-600">
                          {permission.label}
                        </span>
                        <span
                          className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${
                            permission.allowed
                              ? "bg-emerald-50 text-emerald-700"
                              : "bg-slate-100 text-slate-500"
                          }`}
                        >
                          {permission.allowed ? (
                            <CheckCircle2 size={13} />
                          ) : (
                            <LockKeyhole size={13} />
                          )}
                          {permission.allowed ? "Allowed" : "Denied"}
                        </span>
                      </div>
                    ))}
                  </div>

                  <p className="mt-3 text-xs leading-5 text-slate-400">
                    Edit and Delete permissions apply when corresponding
                    request-management features are implemented.
                  </p>
                </div>
              </aside>
            </div>
          </>
        )}

        <footer className="mt-8 flex flex-col items-center justify-between gap-2 border-t border-slate-200 py-5 text-xs text-slate-400 sm:flex-row">
          <p>ERP Help & Support</p>
          <p>Never share your password in a support request.</p>
        </footer>
      </div>
    </main>
  );
}
