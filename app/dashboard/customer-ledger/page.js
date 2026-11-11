"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Activity,
  ArrowDownLeft,
  ArrowLeftRight,
  ArrowUpRight,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  CircleDollarSign,
  ClipboardList,
  FileSearch,
  FileText,
  Filter,
  RefreshCw,
  RotateCcw,
  Search,
  UserRound,
  Wallet,
  AlertCircle,
  TrendingUp,
  ShieldAlert,
  LockKeyhole,
} from "lucide-react";

// =========================================================
// CONFIGURATION
// =========================================================

const PERMISSION_KEY = "customer_ledger";
const CUSTOMER_API = "/api/customers";
const LEDGER_API = "/api/reports/customer-ledger";
const PERMISSION_API = "/api/permissions/current";

const inputClass =
  "w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-800 outline-none transition placeholder:text-slate-400 hover:border-slate-300 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:hover:border-slate-600 dark:focus:border-blue-500";

const labelClass =
  "mb-2 flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-300";

const cardClass =
  "rounded-2xl border border-slate-200/80 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900";

// =========================================================
// DATE HELPERS
// =========================================================

function getToday() {
  const date = new Date();

  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");
}

function getFirstDayOfMonth() {
  const date = new Date();

  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    "01",
  ].join("-");
}

// =========================================================
// FORMAT HELPERS
// =========================================================

function formatAmount(value) {
  const amount = Number(value ?? 0);

  return (Number.isFinite(amount) ? amount : 0).toLocaleString("en-PK", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function formatDate(value) {
  if (!value) return "-";

  const dateOnly = String(value).match(/^(\d{4})-(\d{2})-(\d{2})$/);

  const date = dateOnly
    ? new Date(
        Number(dateOnly[1]),
        Number(dateOnly[2]) - 1,
        Number(dateOnly[3])
      )
    : new Date(value);

  if (Number.isNaN(date.getTime())) return String(value);

  return date.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function getInitials(name) {
  return String(name || "Customer")
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

function toNumber(value) {
  const number = Number(value ?? 0);
  return Number.isFinite(number) ? number : 0;
}

async function readJson(response) {
  return response.json().catch(() => ({}));
}

// =========================================================
// PERMISSION HELPERS
// Supports { permission: {...} }, { permissions: [...] },
// and a direct permission object.
// =========================================================

function getPermissionObject(data) {
  if (data?.permission && typeof data.permission === "object") {
    return data.permission;
  }

  if (Array.isArray(data?.permissions)) {
    return (
      data.permissions.find(
        (item) =>
          item.permission_key === PERMISSION_KEY ||
          item.permissionKey === PERMISSION_KEY
      ) || null
    );
  }

  if (Array.isArray(data)) {
    return (
      data.find(
        (item) =>
          item.permission_key === PERMISSION_KEY ||
          item.permissionKey === PERMISSION_KEY
      ) || null
    );
  }

  if (
    data &&
    (data.permission_key === PERMISSION_KEY ||
      data.permissionKey === PERMISSION_KEY ||
      "can_view" in data ||
      "canView" in data)
  ) {
    return data;
  }

  return null;
}

function hasViewPermission(permission) {
  if (!permission) return false;

  const value = permission.can_view ?? permission.canView;

  return value === true || value === 1 || value === "true";
}

// =========================================================
// SUMMARY CARD
// =========================================================

function SummaryCard({
  title,
  value,
  description,
  icon: Icon,
  iconColor,
  iconBg,
  valueColor,
}) {
  return (
    <div className="group relative overflow-hidden rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm transition duration-300 hover:-translate-y-1 hover:shadow-lg dark:border-slate-700 dark:bg-slate-900">
      <div className="absolute -right-7 -top-7 h-24 w-24 rounded-full bg-slate-100/70 transition-transform duration-300 group-hover:scale-125 dark:bg-slate-800/60" />

      <div className="relative flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
            {title}
          </p>

          <p
            className={`mt-3 break-words text-xl font-bold tracking-tight sm:text-2xl ${
              valueColor || "text-slate-900 dark:text-white"
            }`}
          >
            {formatAmount(value)}
          </p>

          <p className="mt-2 text-xs text-slate-400 dark:text-slate-500">
            {description}
          </p>
        </div>

        <div
          className={`relative flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${iconBg}`}
        >
          {Icon && <Icon className={`h-5 w-5 ${iconColor}`} />}
        </div>
      </div>
    </div>
  );
}

// =========================================================
// ACCESS DENIED
// =========================================================

function AccessMessage({ title, message, icon: Icon = ShieldAlert }) {
  return (
    <div className="flex min-h-[60vh] items-center justify-center p-4">
      <div className={`${cardClass} w-full max-w-lg p-8 text-center`}>
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:text-amber-400">
          <Icon className="h-8 w-8" />
        </div>

        <h1 className="mt-5 text-2xl font-bold text-slate-900 dark:text-white">
          {title}
        </h1>

        <p className="mt-3 text-sm leading-6 text-slate-500 dark:text-slate-400">
          {message}
        </p>
      </div>
    </div>
  );
}

// =========================================================
// MAIN PAGE
// =========================================================

export default function CustomerLedgerPage() {
  // Permission
  const [permissionStatus, setPermissionStatus] = useState("loading");

  // Filters
  const [fromDate, setFromDate] = useState(getFirstDayOfMonth);
  const [toDate, setToDate] = useState(getToday);
  const [customerId, setCustomerId] = useState("");
  const [subsidiary, setSubsidiary] = useState("");

  // Customers
  const [customers, setCustomers] = useState([]);
  const [loadingCustomers, setLoadingCustomers] = useState(false);
  const [customerLoadError, setCustomerLoadError] = useState("");

  // Report
  const [customer, setCustomer] = useState(null);
  const [ledger, setLedger] = useState([]);
  const [openingBalance, setOpeningBalance] = useState(0);
  const [totalDebit, setTotalDebit] = useState(0);
  const [totalCredit, setTotalCredit] = useState(0);
  const [closingBalance, setClosingBalance] = useState(0);
  const [loadingReport, setLoadingReport] = useState(false);
  const [error, setError] = useState("");
  const [hasGeneratedReport, setHasGeneratedReport] = useState(false);

  // Prevent older requests from replacing newer results.
  const reportRequestId = useRef(0);

  // =========================================================
  // LOAD AND VERIFY VIEW PERMISSION
  // =========================================================

  useEffect(() => {
    const controller = new AbortController();

    async function checkPermission() {
      try {
        const response = await fetch(
          `${PERMISSION_API}?permissionKey=${encodeURIComponent(PERMISSION_KEY)}`,
          {
            cache: "no-store",
            credentials: "same-origin",
            signal: controller.signal,
          }
        );

        const data = await readJson(response);

        if (!response.ok) {
          throw new Error(
            data.message ||
              data.error ||
              "Unable to verify Customer Ledger permission."
          );
        }

        const permission = getPermissionObject(data);

        if (!permission) {
          setPermissionStatus("denied");
          return;
        }

        setPermissionStatus(
          hasViewPermission(permission) ? "allowed" : "denied"
        );
      } catch (err) {
        if (err.name !== "AbortError") {
          setPermissionStatus("error");
        }
      }
    }

    checkPermission();

    return () => controller.abort();
  }, []);

  // =========================================================
  // LOAD CUSTOMERS AFTER PERMISSION IS GRANTED
  // =========================================================

  useEffect(() => {
    if (permissionStatus !== "allowed") return undefined;

    const controller = new AbortController();

    async function loadCustomers() {
      setLoadingCustomers(true);
      setCustomerLoadError("");

      try {
        const response = await fetch(CUSTOMER_API, {
          cache: "no-store",
          credentials: "same-origin",
          signal: controller.signal,
        });

        const data = await readJson(response);

        if (!response.ok) {
          throw new Error(
            data.message || data.error || "Failed to load customers."
          );
        }

        const customerList = Array.isArray(data)
          ? data
          : Array.isArray(data.customers)
            ? data.customers
            : [];

        setCustomers(customerList);
      } catch (err) {
        if (err.name !== "AbortError") {
          setCustomerLoadError(
            err.message || "Failed to load customers."
          );
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoadingCustomers(false);
        }
      }
    }

    loadCustomers();

    return () => controller.abort();
  }, [permissionStatus]);

  // =========================================================
  // RESET REPORT DATA
  // =========================================================

  const resetReportData = useCallback(() => {
    setCustomer(null);
    setLedger([]);
    setOpeningBalance(0);
    setTotalDebit(0);
    setTotalCredit(0);
    setClosingBalance(0);
  }, []);

  // =========================================================
  // GENERATE REPORT
  // =========================================================

  async function generateReport(event) {
    event.preventDefault();
    setError("");

    if (permissionStatus !== "allowed") {
      setError("You do not have permission to view the Customer Ledger.");
      return;
    }

    if (!fromDate) {
      setError("Please select a From Date.");
      return;
    }

    if (!toDate) {
      setError("Please select a To Date.");
      return;
    }

    if (fromDate > toDate) {
      setError("From Date cannot be greater than To Date.");
      return;
    }

    if (!customerId) {
      setError("Please select a customer.");
      return;
    }

    const selectedCustomer = customers.find(
      (item) => String(item.customer_id) === String(customerId)
    );

    const requestId = ++reportRequestId.current;

    setLoadingReport(true);
    setHasGeneratedReport(false);
    resetReportData();

    try {
      const params = new URLSearchParams({
        fromDate,
        toDate,
        customerId,
      });

      // Keep the existing report API.
      // The subsidiary filter is sent only if selected, but the API
      // must explicitly support this parameter to filter by subsidiary.
      if (subsidiary) {
        params.set("subsidiary", subsidiary);
      }

      const response = await fetch(
        `${LEDGER_API}?${params.toString()}`,
        {
          cache: "no-store",
          credentials: "same-origin",
        }
      );

      const data = await readJson(response);

      if (!response.ok) {
        throw new Error(
          data.message ||
            data.error ||
            "Failed to generate customer ledger."
        );
      }

      if (requestId !== reportRequestId.current) return;

      setCustomer(
        data.customer ||
          (selectedCustomer
            ? {
                customer_id: selectedCustomer.customer_id,
                customer_name: selectedCustomer.customer_name,
                customer_code: selectedCustomer.customer_code,
              }
            : null)
      );

      setLedger(Array.isArray(data.ledger) ? data.ledger : []);
      setOpeningBalance(toNumber(data.opening_balance));
      setTotalDebit(toNumber(data.total_debit));
      setTotalCredit(toNumber(data.total_credit));
      setClosingBalance(toNumber(data.closing_balance));
      setHasGeneratedReport(true);
    } catch (err) {
      if (requestId !== reportRequestId.current) return;

      setError(
        err.message || "Failed to generate customer ledger."
      );

      resetReportData();
      setHasGeneratedReport(false);
    } finally {
      if (requestId === reportRequestId.current) {
        setLoadingReport(false);
      }
    }
  }

  // =========================================================
  // CLEAR REPORT
  // =========================================================

  function clearReport() {
    // Invalidate any report request already in progress.
    reportRequestId.current += 1;

    setCustomerId("");
    setFromDate(getFirstDayOfMonth());
    setToDate(getToday());
    setSubsidiary("");
    setError("");
    setLoadingReport(false);
    setHasGeneratedReport(false);
    resetReportData();
  }

  // =========================================================
  // PERMISSION STATES
  // =========================================================

  if (permissionStatus === "loading") {
    return (
      <div className="flex min-h-[60vh] items-center justify-center bg-slate-50 p-6 dark:bg-slate-950">
        <div className="text-center">
          <RefreshCw className="mx-auto h-9 w-9 animate-spin text-blue-600 dark:text-blue-400" />
          <p className="mt-4 font-semibold text-slate-700 dark:text-slate-200">
            Checking permissions...
          </p>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Verifying access to Customer Ledger.
          </p>
        </div>
      </div>
    );
  }

  if (permissionStatus === "denied") {
    return (
      <AccessMessage
        title="Access Denied"
        message="You do not have View permission for Customer Ledger. Please contact your administrator to request access."
      />
    );
  }

  if (permissionStatus === "error") {
    return (
      <AccessMessage
        title="Permission Check Failed"
        message="Customer Ledger is hidden because your permissions could not be verified. Refresh the page or contact your administrator if this problem continues."
        icon={LockKeyhole}
      />
    );
  }

  // =========================================================
  // RENDER
  // =========================================================

  return (
    <div className="min-h-screen space-y-6 bg-slate-50/70 pb-8 dark:bg-slate-950">
      {/* HERO HEADER */}

      <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-950 via-blue-950 to-indigo-900 p-6 text-white shadow-xl shadow-blue-950/10 sm:p-8">
        <div className="pointer-events-none absolute -right-16 -top-24 h-72 w-72 rounded-full border border-white/10" />
        <div className="pointer-events-none absolute -right-4 -top-12 h-52 w-52 rounded-full border border-white/10" />
        <div className="pointer-events-none absolute -bottom-28 left-1/3 h-64 w-64 rounded-full bg-blue-500/10 blur-3xl" />

        <div className="relative flex flex-col justify-between gap-6 lg:flex-row lg:items-center">
          <div className="max-w-2xl">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-blue-300/20 bg-white/10 px-3 py-1.5 text-xs font-semibold tracking-wide text-blue-100">
              <Activity className="h-3.5 w-3.5" />
              FINANCIAL REPORTING
            </div>

            <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
              Customer Ledger
            </h1>

            <p className="mt-3 max-w-xl text-sm leading-6 text-blue-100/80 sm:text-base">
              Track customer invoices, payments, debit, credit and running
              balances in one clear financial statement.
            </p>

            <div className="mt-5 flex flex-wrap items-center gap-3 text-xs text-blue-100/80 sm:text-sm">
              <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-2">
                <CalendarDays className="h-4 w-4" />
                {formatDate(fromDate)} – {formatDate(toDate)}
              </span>

              <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-2">
                <FileText className="h-4 w-4" />
                Detailed transaction history
              </span>
            </div>
          </div>

          <div className="hidden shrink-0 items-center justify-center lg:flex">
            <div className="flex h-28 w-28 items-center justify-center rounded-3xl border border-white/15 bg-white/10 shadow-2xl backdrop-blur">
              <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-white text-blue-950 shadow-lg">
                <ClipboardList className="h-10 w-10" />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* FILTER PANEL */}

      <section className={`${cardClass} overflow-hidden`}>
        <div className="flex flex-col gap-3 border-b border-slate-100 px-5 py-5 dark:border-slate-800 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-400">
              <Filter className="h-5 w-5" />
            </div>

            <div>
              <h2 className="font-bold text-slate-900 dark:text-white">
                Report Filters
              </h2>
              <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                Choose a customer and reporting period
              </p>
            </div>
          </div>

          <span className="inline-flex w-fit items-center gap-2 rounded-full bg-slate-100 px-3 py-1.5 text-xs font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-300">
            <span className="h-2 w-2 rounded-full bg-emerald-500" />
            {customers.length} customer{customers.length === 1 ? "" : "s"}{" "}
            available
          </span>
        </div>

        <form onSubmit={generateReport} className="p-5 sm:p-6">
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-4">
            <div>
              <label className={labelClass}>
                <CalendarDays className="h-4 w-4 text-blue-500" />
                From Date
              </label>

              <input
                type="date"
                value={fromDate}
                max={toDate || undefined}
                onChange={(event) => setFromDate(event.target.value)}
                className={inputClass}
                required
                disabled={loadingReport}
              />
            </div>

            <div>
              <label className={labelClass}>
                <CalendarDays className="h-4 w-4 text-violet-500" />
                To Date
              </label>

              <input
                type="date"
                value={toDate}
                min={fromDate || undefined}
                onChange={(event) => setToDate(event.target.value)}
                className={inputClass}
                required
                disabled={loadingReport}
              />
            </div>

            <div>
              <label className={labelClass}>
                <UserRound className="h-4 w-4 text-emerald-500" />
                Customer
              </label>

              <div className="relative">
                <select
                  value={customerId}
                  onChange={(event) => setCustomerId(event.target.value)}
                  className={`${inputClass} appearance-none pr-10`}
                  required
                  disabled={loadingCustomers || loadingReport}
                >
                  <option value="">Select a customer</option>

                  {customers.map((item) => (
                    <option
                      key={item.customer_id}
                      value={item.customer_id}
                    >
                      {item.customer_code
                        ? `${item.customer_code} - `
                        : ""}
                      {item.customer_name}
                    </option>
                  ))}
                </select>

                <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              </div>

              {loadingCustomers && (
                <p className="mt-2 flex items-center gap-2 text-xs text-blue-600 dark:text-blue-400">
                  <RefreshCw className="h-3 w-3 animate-spin" />
                  Loading customers...
                </p>
              )}

              {!loadingCustomers && customerLoadError && (
                <p className="mt-2 text-xs text-red-600 dark:text-red-400">
                  {customerLoadError}
                </p>
              )}

              {!loadingCustomers &&
                !customerLoadError &&
                customers.length === 0 && (
                  <p className="mt-2 text-xs text-amber-600 dark:text-amber-400">
                    No customers found. Check your customer records.
                  </p>
                )}
            </div>

            <div>
              <label className={labelClass}>
                <ArrowLeftRight className="h-4 w-4 text-orange-500" />
                Subsidiary
              </label>

              <div className="relative">
                <select
                  value={subsidiary}
                  onChange={(event) => setSubsidiary(event.target.value)}
                  className={`${inputClass} appearance-none pr-10`}
                  disabled={loadingReport}
                >
                  <option value="">All Subsidiaries</option>
                  <option value="main">Main Subsidiary</option>
                </select>

                <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              </div>

              <p className="mt-2 text-xs text-slate-400 dark:text-slate-500">
                The API must support subsidiary filtering.
              </p>
            </div>
          </div>

          <div className="mt-6 flex flex-col gap-3 border-t border-slate-100 pt-5 dark:border-slate-800 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs leading-5 text-slate-500 dark:text-slate-400">
              <span className="font-semibold text-slate-700 dark:text-slate-300">
                Tip:
              </span>{" "}
              Select a customer and date range to view the ledger statement.
            </p>

            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={clearReport}
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-600 transition hover:border-slate-300 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
              >
                <RotateCcw className="h-4 w-4" />
                Clear Report
              </button>

              <button
                type="submit"
                disabled={
                  loadingReport ||
                  loadingCustomers ||
                  customers.length === 0
                }
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-blue-600/20 transition hover:from-blue-700 hover:to-indigo-700 hover:shadow-blue-600/30 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loadingReport ? (
                  <>
                    <RefreshCw className="h-4 w-4 animate-spin" />
                    Generating Report...
                  </>
                ) : (
                  <>
                    <Search className="h-4 w-4" />
                    Generate Report
                  </>
                )}
              </button>
            </div>
          </div>
        </form>
      </section>

      {/* ERROR MESSAGE */}

      {error && (
        <div
          role="alert"
          className="flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 p-4 text-red-800 dark:border-red-900/70 dark:bg-red-950/30 dark:text-red-300"
        >
          <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />

          <div className="min-w-0 flex-1">
            <p className="font-semibold">Unable to complete request</p>
            <p className="mt-1 break-words text-sm">{error}</p>
          </div>

          <button
            type="button"
            onClick={() => setError("")}
            aria-label="Dismiss error"
            className="rounded-lg p-1 transition hover:bg-red-100 dark:hover:bg-red-900/50"
          >
            <span className="text-lg leading-none">×</span>
          </button>
        </div>
      )}

      {/* LOADING STATE */}

      {loadingReport && (
        <div
          className={`${cardClass} flex flex-col items-center justify-center px-6 py-14 text-center`}
        >
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-50 dark:bg-blue-500/10">
            <RefreshCw className="h-7 w-7 animate-spin text-blue-600 dark:text-blue-400" />
          </div>

          <h3 className="mt-4 font-bold text-slate-900 dark:text-white">
            Preparing your ledger
          </h3>

          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
            Retrieving customer transactions and balances...
          </p>
        </div>
      )}

      {/* REPORT */}

      {!loadingReport && customer && (
        <section className="space-y-5">
          <div className={`${cardClass} overflow-hidden`}>
            <div className="border-b border-slate-100 p-5 dark:border-slate-800 sm:p-6">
              <div className="flex flex-col justify-between gap-5 lg:flex-row lg:items-center">
                <div className="flex items-center gap-4">
                  <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-600 text-lg font-bold text-white shadow-lg shadow-blue-600/20">
                    {getInitials(customer.customer_name)}
                  </div>

                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white sm:text-2xl">
                        Customer Ledger Report
                      </h2>

                      <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400">
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        Generated
                      </span>
                    </div>

                    <p className="mt-1.5 break-words text-sm text-slate-500 dark:text-slate-400">
                      <span className="font-semibold text-slate-800 dark:text-slate-200">
                        {customer.customer_name || "Customer"}
                      </span>

                      {customer.customer_code && (
                        <span className="ml-2 inline-flex rounded-md bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                          {customer.customer_code}
                        </span>
                      )}
                    </p>
                  </div>
                </div>

                <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-700 dark:bg-slate-800/70">
                  <p className="text-xs font-medium uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    Reporting Period
                  </p>

                  <p className="mt-1.5 flex flex-wrap items-center gap-2 text-sm font-semibold text-slate-900 dark:text-white">
                    <CalendarDays className="h-4 w-4 text-blue-500" />
                    {formatDate(fromDate)}
                    <span className="text-slate-400">to</span>
                    {formatDate(toDate)}
                  </p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 bg-slate-50/70 p-4 dark:bg-slate-950/30 sm:grid-cols-2 xl:grid-cols-4 sm:p-5">
              <SummaryCard
                title="Opening Balance"
                value={openingBalance}
                description="Balance brought forward"
                icon={Wallet}
                iconColor="text-blue-600 dark:text-blue-400"
                iconBg="bg-blue-50 dark:bg-blue-500/10"
              />

              <SummaryCard
                title="Total Debit"
                value={totalDebit}
                description="Debit transactions"
                icon={ArrowDownLeft}
                iconColor="text-emerald-600 dark:text-emerald-400"
                iconBg="bg-emerald-50 dark:bg-emerald-500/10"
                valueColor="text-emerald-700 dark:text-emerald-400"
              />

              <SummaryCard
                title="Total Credit"
                value={totalCredit}
                description="Credit transactions"
                icon={ArrowUpRight}
                iconColor="text-rose-600 dark:text-rose-400"
                iconBg="bg-rose-50 dark:bg-rose-500/10"
                valueColor="text-rose-700 dark:text-rose-400"
              />

              <SummaryCard
                title="Closing Balance"
                value={closingBalance}
                description="Balance at period end"
                icon={TrendingUp}
                iconColor="text-violet-600 dark:text-violet-400"
                iconBg="bg-violet-50 dark:bg-violet-500/10"
                valueColor="text-violet-700 dark:text-violet-400"
              />
            </div>
          </div>

          {/* TRANSACTION TABLE */}

          <div className={`${cardClass} overflow-hidden`}>
            <div className="flex flex-col gap-3 border-b border-slate-100 p-5 dark:border-slate-800 sm:flex-row sm:items-center sm:justify-between sm:px-6">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-400">
                  <FileSearch className="h-5 w-5" />
                </div>

                <div>
                  <h3 className="font-bold text-slate-900 dark:text-white">
                    Transaction Details
                  </h3>

                  <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                    Opening balance and all ledger entries
                  </p>
                </div>
              </div>

              <span className="inline-flex w-fit items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
                <span className="h-2 w-2 rounded-full bg-blue-500" />
                {ledger.length} transaction{ledger.length === 1 ? "" : "s"}
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[1050px] border-collapse text-sm">
                <thead>
                  <tr className="bg-slate-50 dark:bg-slate-800/80">
                    <th className="whitespace-nowrap px-5 py-4 text-left text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                      Trans. Date
                    </th>
                    <th className="whitespace-nowrap px-5 py-4 text-left text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                      Transaction Number
                    </th>
                    <th className="whitespace-nowrap px-5 py-4 text-left text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                      Reference No.
                    </th>
                    <th className="whitespace-nowrap px-5 py-4 text-left text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                      Memo
                    </th>
                    <th className="whitespace-nowrap px-5 py-4 text-right text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                      Debit
                    </th>
                    <th className="whitespace-nowrap px-5 py-4 text-right text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                      Credit
                    </th>
                    <th className="whitespace-nowrap px-5 py-4 text-right text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                      Running Total
                    </th>
                  </tr>
                </thead>

                <tbody>
                  <tr className="border-b border-blue-100 bg-blue-50/70 dark:border-blue-900/40 dark:bg-blue-500/5">
                    <td className="whitespace-nowrap px-5 py-4 text-slate-600 dark:text-slate-400">
                      {formatDate(fromDate)}
                    </td>

                    <td className="px-5 py-4">
                      <span className="inline-flex items-center gap-2 font-semibold text-blue-700 dark:text-blue-400">
                        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-100 dark:bg-blue-500/15">
                          <Wallet className="h-4 w-4" />
                        </span>
                        Opening Balance
                      </span>
                    </td>

                    <td className="px-5 py-4 text-slate-400">—</td>

                    <td className="px-5 py-4 text-slate-500 dark:text-slate-400">
                      Balance brought forward
                    </td>

                    <td className="px-5 py-4 text-right font-medium tabular-nums text-slate-700 dark:text-slate-300">
                      {openingBalance > 0
                        ? formatAmount(openingBalance)
                        : "—"}
                    </td>

                    <td className="px-5 py-4 text-right text-slate-400">—</td>

                    <td className="px-5 py-4 text-right font-bold tabular-nums text-slate-900 dark:text-white">
                      {formatAmount(openingBalance)}
                    </td>
                  </tr>

                  {ledger.map((row, index) => {
                    const isInvoice =
                      String(row.transaction_type || "").toUpperCase() ===
                      "INVOICE";

                    return (
                      <tr
                        key={`${row.transaction_type || "transaction"}-${row.transaction_id ?? index}-${index}`}
                        className="border-b border-slate-100 transition-colors hover:bg-blue-50/40 dark:border-slate-800 dark:hover:bg-slate-800/60"
                      >
                        <td className="whitespace-nowrap px-5 py-4 text-slate-600 dark:text-slate-400">
                          {formatDate(row.transaction_date)}
                        </td>

                        <td className="px-5 py-4">
                          <div className="flex items-center gap-2.5">
                            <span
                              className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${
                                isInvoice
                                  ? "bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-400"
                                  : "bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400"
                              }`}
                            >
                              {isInvoice ? (
                                <FileText className="h-4 w-4" />
                              ) : (
                                <CircleDollarSign className="h-4 w-4" />
                              )}
                            </span>

                            <div className="min-w-0">
                              <p className="whitespace-nowrap font-semibold text-slate-800 dark:text-slate-200">
                                {row.transaction_number || "—"}
                              </p>

                              <span
                                className={`mt-1 inline-flex rounded-md px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
                                  isInvoice
                                    ? "bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-400"
                                    : "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400"
                                }`}
                              >
                                {row.transaction_type || "Transaction"}
                              </span>
                            </div>
                          </div>
                        </td>

                        <td className="px-5 py-4 text-slate-500 dark:text-slate-400">
                          {row.reference_no || "—"}
                        </td>

                        <td className="max-w-[260px] px-5 py-4 text-slate-600 dark:text-slate-400">
                          <span className="line-clamp-2">
                            {row.memo || "—"}
                          </span>
                        </td>

                        <td className="whitespace-nowrap px-5 py-4 text-right font-medium tabular-nums text-slate-700 dark:text-slate-300">
                          {toNumber(row.debit) > 0
                            ? formatAmount(row.debit)
                            : "—"}
                        </td>

                        <td className="whitespace-nowrap px-5 py-4 text-right font-medium tabular-nums text-slate-700 dark:text-slate-300">
                          {toNumber(row.credit) > 0
                            ? formatAmount(row.credit)
                            : "—"}
                        </td>

                        <td className="whitespace-nowrap px-5 py-4 text-right font-bold tabular-nums text-slate-900 dark:text-white">
                          {formatAmount(row.running_total)}
                        </td>
                      </tr>
                    );
                  })}

                  {ledger.length === 0 && (
                    <tr>
                      <td colSpan={7} className="px-5 py-14 text-center">
                        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 dark:bg-slate-800">
                          <FileSearch className="h-7 w-7 text-slate-400" />
                        </div>

                        <p className="mt-4 font-semibold text-slate-700 dark:text-slate-200">
                          No transactions found
                        </p>

                        <p className="mx-auto mt-1 max-w-sm text-sm text-slate-500 dark:text-slate-400">
                          There are no transactions for this customer within
                          the selected reporting period.
                        </p>
                      </td>
                    </tr>
                  )}
                </tbody>

                <tfoot>
                  <tr className="border-t-2 border-slate-200 bg-slate-100/80 dark:border-slate-700 dark:bg-slate-800">
                    <td
                      colSpan={4}
                      className="px-5 py-5 text-right font-bold uppercase tracking-wide text-slate-700 dark:text-slate-200"
                    >
                      Period Total
                    </td>

                    <td className="whitespace-nowrap px-5 py-5 text-right font-bold tabular-nums text-emerald-700 dark:text-emerald-400">
                      {formatAmount(totalDebit)}
                    </td>

                    <td className="whitespace-nowrap px-5 py-5 text-right font-bold tabular-nums text-rose-700 dark:text-rose-400">
                      {formatAmount(totalCredit)}
                    </td>

                    <td className="whitespace-nowrap px-5 py-5 text-right font-bold tabular-nums text-slate-900 dark:text-white">
                      {formatAmount(closingBalance)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>

            <div className="flex flex-col gap-2 border-t border-slate-100 px-5 py-4 text-xs text-slate-500 dark:border-slate-800 dark:text-slate-400 sm:flex-row sm:items-center sm:justify-between sm:px-6">
              <span>
                Showing {ledger.length} ledger transaction
                {ledger.length === 1 ? "" : "s"}
              </span>

              <span className="inline-flex items-center gap-1.5">
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                Report generated successfully
              </span>
            </div>
          </div>
        </section>
      )}

      {/* INITIAL EMPTY STATE */}

      {!customer &&
        !loadingReport &&
        !error &&
        !hasGeneratedReport && (
          <section className={`${cardClass} overflow-hidden`}>
            <div className="flex flex-col items-center px-6 py-14 text-center sm:py-16">
              <div className="relative flex h-20 w-20 items-center justify-center rounded-3xl bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-blue-500/10 dark:to-indigo-500/10">
                <ClipboardList className="h-10 w-10 text-blue-600 dark:text-blue-400" />

                <span className="absolute -right-2 -top-2 flex h-7 w-7 items-center justify-center rounded-full border-4 border-white bg-emerald-500 text-white dark:border-slate-900">
                  <Search className="h-3 w-3" />
                </span>
              </div>

              <h3 className="mt-6 text-xl font-bold text-slate-900 dark:text-white">
                Your customer ledger starts here
              </h3>

              <p className="mt-2 max-w-md text-sm leading-6 text-slate-500 dark:text-slate-400">
                Select a customer and choose the reporting dates above.
                Generate a report to view the opening balance, transactions,
                debit, credit and closing balance.
              </p>

              <div className="mt-6 flex flex-wrap justify-center gap-2">
                <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
                  Opening balance
                </span>

                <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
                  Debit &amp; credit
                </span>

                <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
                  Running balance
                </span>
              </div>
            </div>
          </section>
        )}

      {/* EMPTY RESULT AFTER REPORT */}

      {!customer &&
        !loadingReport &&
        hasGeneratedReport &&
        !error && (
          <section
            className={`${cardClass} flex flex-col items-center px-6 py-12 text-center`}
          >
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-50 dark:bg-amber-500/10">
              <FileSearch className="h-7 w-7 text-amber-600 dark:text-amber-400" />
            </div>

            <h3 className="mt-4 font-bold text-slate-900 dark:text-white">
              No report data available
            </h3>

            <p className="mt-2 max-w-md text-sm text-slate-500 dark:text-slate-400">
              The request completed, but no customer information was returned.
              Please verify the customer and try again.
            </p>
          </section>
        )}
    </div>
  );
}
