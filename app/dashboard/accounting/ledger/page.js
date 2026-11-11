
"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Search,
  RefreshCw,
  Download,
  BookOpen,
  Scale,
  CalendarDays,
  FileSpreadsheet,
  Wallet,
  ArrowDownLeft,
  ArrowUpRight,
  SlidersHorizontal,
  X,
  CheckCircle2,
  AlertCircle,
  Landmark,
  Activity,
  Filter,
  ShieldAlert,
} from "lucide-react";

const PERMISSION_KEY = "financial_ledger";

const money = (value) =>
  new Intl.NumberFormat("en-PK", {
    style: "currency",
    currency: "PKR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(value || 0));

const dateText = (value) => {
  if (!value) return "—";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return String(value);
  }

  return date.toLocaleDateString("en-PK", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

const toBoolean = (value) =>
  value === true ||
  value === 1 ||
  value === "1" ||
  String(value).toLowerCase() === "true";

const inputClass =
  "w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:border-blue-400 dark:focus:ring-blue-400/10";

const labelClass =
  "mb-2 block text-sm font-semibold text-slate-700 dark:text-slate-300";

const panelClass =
  "rounded-2xl border border-slate-200/80 bg-white shadow-sm shadow-slate-200/40 dark:border-slate-800 dark:bg-slate-900 dark:shadow-none";

const buttonSecondary =
  "inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:border-blue-800 dark:hover:bg-blue-950/40 dark:hover:text-blue-300";

const transactionTypes = [
  { value: "SALES_INVOICE", label: "Sales Invoice" },
  { value: "SALES_COGS", label: "Cost of Goods Sold" },
  { value: "PURCHASE", label: "Purchase" },
  { value: "SALES_PAYMENT", label: "Customer Receipt" },
  { value: "PURCHASE_PAYMENT", label: "Supplier Payment" },
  { value: "JOURNAL", label: "General Journal" },
];

function SummaryCard({
  title,
  value,
  subtitle,
  icon: Icon,
  accent = "blue",
}) {
  const accents = {
    blue: {
      icon: "bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300",
      glow: "from-blue-500/10",
      line: "bg-blue-500",
      label: "text-blue-700 dark:text-blue-300",
    },
    green: {
      icon: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300",
      glow: "from-emerald-500/10",
      line: "bg-emerald-500",
      label: "text-emerald-700 dark:text-emerald-300",
    },
    violet: {
      icon: "bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300",
      glow: "from-violet-500/10",
      line: "bg-violet-500",
      label: "text-violet-700 dark:text-violet-300",
    },
  };

  const colors = accents[accent] || accents.blue;

  return (
    <div
      className={`group relative overflow-hidden rounded-2xl border border-slate-200/80 bg-gradient-to-br ${colors.glow} via-white to-white p-5 shadow-sm transition duration-300 hover:-translate-y-1 hover:shadow-lg hover:shadow-slate-200/50 dark:border-slate-800 dark:via-slate-900 dark:to-slate-900 dark:hover:shadow-black/20`}
    >
      <div
        className={`absolute left-0 top-0 h-full w-1 ${colors.line} opacity-80`}
      />

      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
            {title}
          </p>

          <p className="mt-3 break-words text-xl font-bold tracking-tight text-slate-900 sm:text-2xl dark:text-white">
            {money(value)}
          </p>

          <p className={`mt-2 text-xs font-medium ${colors.label}`}>
            {subtitle}
          </p>
        </div>

        <div
          className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl transition duration-300 group-hover:scale-110 ${colors.icon}`}
        >
          <Icon size={21} />
        </div>
      </div>
    </div>
  );
}

function FilterField({ label, htmlFor, children }) {
  return (
    <div className="min-w-0">
      <label htmlFor={htmlFor} className={labelClass}>
        {label}
      </label>
      {children}
    </div>
  );
}

function PermissionMessage({
  title,
  description,
  icon: Icon = ShieldAlert,
  error = false,
}) {
  return (
    <div className="flex min-h-[65vh] items-center justify-center p-5">
      <div className="w-full max-w-lg rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div
          className={`mx-auto flex h-16 w-16 items-center justify-center rounded-2xl ${error
            ? "bg-amber-100 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300"
            : "bg-rose-100 text-rose-700 dark:bg-rose-500/10 dark:text-rose-300"
            }`}
        >
          <Icon size={30} />
        </div>

        <h2 className="mt-5 text-xl font-bold text-slate-900 dark:text-white">
          {title}
        </h2>

        <p className="mt-2 text-sm leading-6 text-slate-500 dark:text-slate-400">
          {description}
        </p>

        <a
          href="/dashboard"
          className="mt-6 inline-flex items-center justify-center rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700"
        >
          Back to Dashboard
        </a>
      </div>
    </div>
  );
}

export default function FinancialLedgerPage() {
  const [accounts, setAccounts] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [totals, setTotals] = useState({
    debit: 0,
    credit: 0,
  });

  const [filters, setFilters] = useState({
    from: "",
    to: "",
    accountId: "",
    type: "",
    search: "",
  });

  // Financial Ledger permissions
  const [permissionLoading, setPermissionLoading] = useState(true);
  const [permissionError, setPermissionError] = useState(false);

  const [permissions, setPermissions] = useState({
    can_view: false,
    can_create: false,
    can_update: false,
    can_delete: false,
  });

  const canView = permissions.can_view;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [lastUpdated, setLastUpdated] = useState(null);
  const [showFilters, setShowFilters] = useState(true);

  // --------------------------------------------------
  // LOAD CURRENT USER PERMISSIONS
  // --------------------------------------------------

  const loadPermissions = useCallback(async (signal) => {
    try {
      const response = await fetch("/api/permissions/current", {
        method: "GET",
        credentials: "same-origin",
        cache: "no-store",
        signal,
        headers: {
          Accept: "application/json",
        },
      });

      if (!response.ok) {
        throw new Error(
          `Permission request failed (${response.status})`
        );
      }

      const data = await response.json();

      if (!Array.isArray(data.permissions)) {
        throw new Error("Invalid permissions response.");
      }

      const permission = data.permissions.find(
        (item) =>
          String(item.permission_key || "")
            .trim()
            .toLowerCase() === PERMISSION_KEY
      );

      setPermissions({
        can_view: toBoolean(permission?.can_view),
        can_create: toBoolean(permission?.can_create),
        can_update: toBoolean(permission?.can_update),
        can_delete: toBoolean(permission?.can_delete),
      });

      setPermissionError(false);
    } catch (err) {
      if (err.name === "AbortError") return;

      console.error(
        "Financial Ledger permission error:",
        err
      );

      setPermissions({
        can_view: false,
        can_create: false,
        can_update: false,
        can_delete: false,
      });

      setPermissionError(true);
    } finally {
      if (!signal?.aborted) {
        setPermissionLoading(false);
      }
    }
  }, []);

  // --------------------------------------------------
  // INITIAL PERMISSION CHECK + REFRESH LISTENERS
  // --------------------------------------------------

  useEffect(() => {
    let active = true;
    let controller = new AbortController();

    async function checkPermissions() {
      try {
        const response = await fetch("/api/permissions/current", {
          method: "GET",
          credentials: "same-origin",
          cache: "no-store",
          signal: controller.signal,
          headers: {
            Accept: "application/json",
          },
        });

        if (!response.ok) {
          throw new Error(
            `Permission request failed (${response.status})`
          );
        }

        const data = await response.json();

        if (!Array.isArray(data.permissions)) {
          throw new Error("Invalid permissions response.");
        }

        const permission = data.permissions.find(
          (item) =>
            String(item.permission_key || "")
              .trim()
              .toLowerCase() === PERMISSION_KEY
        );

        if (!active) return;

        setPermissions({
          can_view: toBoolean(permission?.can_view),
          can_create: toBoolean(permission?.can_create),
          can_update: toBoolean(permission?.can_update),
          can_delete: toBoolean(permission?.can_delete),
        });

        setPermissionError(false);
      } catch (err) {
        if (!active || err.name === "AbortError") return;

        console.error("Financial Ledger permission error:", err);

        setPermissions({
          can_view: false,
          can_create: false,
          can_update: false,
          can_delete: false,
        });

        setPermissionError(true);
      } finally {
        if (active) {
          setPermissionLoading(false);
        }
      }
    }

    const refreshPermissions = () => {
      if (!active) return;

      controller.abort();
      controller = new AbortController();

      setPermissionLoading(true);

      void loadPermissions(controller.signal);
    };

    void checkPermissions();

    const handlePermissionsUpdated = () => {
      refreshPermissions();
    };

    const handleFocus = () => {
      refreshPermissions();
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        refreshPermissions();
      }
    };

    window.addEventListener(
      "erp-permissions-updated",
      handlePermissionsUpdated
    );

    window.addEventListener("focus", handleFocus);

    document.addEventListener(
      "visibilitychange",
      handleVisibilityChange
    );

    return () => {
      active = false;
      controller.abort();

      window.removeEventListener(
        "erp-permissions-updated",
        handlePermissionsUpdated
      );

      window.removeEventListener("focus", handleFocus);

      document.removeEventListener(
        "visibilitychange",
        handleVisibilityChange
      );
    };
  }, [loadPermissions]);

  // --------------------------------------------------
  // LOAD FINANCIAL LEDGER
  // --------------------------------------------------

  const loadLedger = useCallback(async () => {
    if (!canView || permissionLoading || permissionError) {
      return;
    }

    setLoading(true);
    setError("");

    try {
      const query = new URLSearchParams();

      Object.entries(filters).forEach(([key, value]) => {
        if (value) {
          query.set(key, value);
        }
      });

      const response = await fetch(
        `/api/accounting/ledger?${query.toString()}`,
        {
          method: "GET",
          credentials: "same-origin",
          cache: "no-store",
          headers: {
            Accept: "application/json",
          },
        }
      );

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(
          data.message || "Unable to load ledger."
        );
      }

      setAccounts(
        Array.isArray(data.accounts) ? data.accounts : []
      );

      setTransactions(
        Array.isArray(data.transactions)
          ? data.transactions
          : []
      );

      setTotals(
        data.totals || {
          debit: 0,
          credit: 0,
        }
      );

      setLastUpdated(new Date());
    } catch (err) {
      setError(err.message || "Unable to load ledger.");
    } finally {
      setLoading(false);
    }
  }, [
    canView,
    permissionLoading,
    permissionError,
    filters,
  ]);

  // --------------------------------------------------
  // AUTOMATIC LEDGER LOAD
  // --------------------------------------------------

  useEffect(() => {
    if (permissionLoading || !canView || permissionError) {
      return;
    }

    let active = true;

    async function fetchLedger() {
      try {
        const query = new URLSearchParams();

        Object.entries(filters).forEach(([key, value]) => {
          if (value) {
            query.set(key, value);
          }
        });

        const response = await fetch(
          `/api/accounting/ledger?${query.toString()}`,
          {
            method: "GET",
            credentials: "same-origin",
            cache: "no-store",
            headers: {
              Accept: "application/json",
            },
          }
        );

        const data = await response.json();

        if (!response.ok || !data.success) {
          throw new Error(
            data.message || "Unable to load ledger."
          );
        }

        if (!active) return;

        setAccounts(
          Array.isArray(data.accounts) ? data.accounts : []
        );

        setTransactions(
          Array.isArray(data.transactions)
            ? data.transactions
            : []
        );

        setTotals(
          data.totals || {
            debit: 0,
            credit: 0,
          }
        );

        setLastUpdated(new Date());
        setError("");
      } catch (err) {
        if (!active) return;

        setError(err.message || "Unable to load ledger.");
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    void fetchLedger();

    return () => {
      active = false;
    };
  }, [
    permissionLoading,
    canView,
    permissionError,
    filters,
  ]);

  // --------------------------------------------------
  // FILTER HANDLERS
  // --------------------------------------------------

  function updateFilter(event) {
    const { name, value } = event.target;

    setFilters((previous) => ({
      ...previous,
      [name]: value,
    }));
  }

  function clearFilters() {
    setFilters({
      from: "",
      to: "",
      accountId: "",
      type: "",
      search: "",
    });
  }

  const activeFilterCount =
    Object.values(filters).filter(Boolean).length;

  // --------------------------------------------------
  // CSV EXPORT
  // --------------------------------------------------

  function exportCsv() {
    if (!canView || !transactions.length || loading) {
      return;
    }

    const headers = [
      "Date",
      "Journal Number",
      "Reference Type",
      "Account Code",
      "Account Name",
      "Description",
      "Debit",
      "Credit",
      "Running Balance",
    ];

    const values = transactions.map((row) => [
      dateText(row.journal_date),
      row.journal_number || "",
      row.reference_type || "",
      row.account_code || "",
      row.account_name || "",
      row.line_description || row.journal_description || "",
      row.debit || 0,
      row.credit || 0,
      row.running_balance || 0,
    ]);

    const escapeCsv = (value) =>
      `"${String(value ?? "").replace(/"/g, '""')}"`;

    const csv = [headers, ...values]
      .map((row) => row.map(escapeCsv).join(","))
      .join("\r\n");

    const blob = new Blob(["\uFEFF", csv], {
      type: "text/csv;charset=utf-8;",
    });

    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = "financial-ledger.csv";

    document.body.appendChild(link);
    link.click();
    link.remove();

    URL.revokeObjectURL(url);
  }

  // --------------------------------------------------
  // SUMMARY VALUES
  // --------------------------------------------------

  const debit = Number(totals.debit || 0);
  const credit = Number(totals.credit || 0);
  const difference = debit - credit;

  // --------------------------------------------------
  // PERMISSION LOADING SCREEN
  // --------------------------------------------------

  if (permissionLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 p-6 dark:bg-slate-950">
        <div className="text-center">
          <RefreshCw
            size={34}
            className="mx-auto animate-spin text-blue-600 dark:text-blue-400"
          />

          <p className="mt-4 font-semibold text-slate-800 dark:text-slate-200">
            Checking Financial Ledger permissions...
          </p>

          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Please wait.
          </p>
        </div>
      </div>
    );
  }

  // --------------------------------------------------
  // PERMISSION ERROR
  // --------------------------------------------------

  if (permissionError) {
    return (
      <PermissionMessage
        title="Permissions unavailable"
        description="Your Financial Ledger permissions could not be verified. Please refresh the page or contact your administrator."
        error
      />
    );
  }

  // --------------------------------------------------
  // ACCESS DENIED
  // --------------------------------------------------

  if (!canView) {
    return (
      <PermissionMessage
        title="Access denied"
        description="You do not have permission to view the Financial Ledger. Please contact your administrator to request access."
      />
    );
  }

  // --------------------------------------------------
  // MAIN FINANCIAL LEDGER PAGE
  // --------------------------------------------------

  return (
    <div className="min-h-screen space-y-6 bg-slate-50/70 p-4 text-slate-900 sm:p-6 lg:p-8 dark:bg-slate-950 dark:text-slate-100">
      {/* PAGE HEADING */}

      <section className="relative isolate overflow-hidden rounded-3xl bg-gradient-to-br from-blue-700 via-blue-600 to-emerald-600 p-6 text-white shadow-xl shadow-blue-900/10 sm:p-8">
        <div className="pointer-events-none absolute -right-12 -top-24 -z-10 h-72 w-72 rounded-full bg-white/10 blur-3xl" />

        <div className="pointer-events-none absolute -bottom-28 left-1/3 -z-10 h-64 w-64 rounded-full bg-emerald-300/20 blur-3xl" />

        <div className="flex flex-col justify-between gap-6 lg:flex-row lg:items-center">
          <div className="flex items-start gap-4">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-white/20 bg-white/15 shadow-inner backdrop-blur-sm">
              <BookOpen size={28} />
            </div>

            <div>
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <span className="rounded-full border border-white/25 bg-white/15 px-3 py-1 text-xs font-semibold uppercase tracking-wider">
                  Accounting
                </span>

                <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-400/20 px-3 py-1 text-xs font-medium text-emerald-50">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-300" />
                  Financial overview
                </span>
              </div>

              <h1 className="text-2xl font-bold tracking-tight sm:text-3xl lg:text-4xl">
                Financial Ledger
              </h1>

              <p className="mt-2 max-w-2xl text-sm leading-6 text-blue-50 sm:text-base">
                Explore posted transactions, monitor debits and credits,
                and review your accounting activity in one place.
              </p>

              {lastUpdated && (
                <p className="mt-3 text-xs text-blue-100">
                  Last updated:{" "}
                  {lastUpdated.toLocaleTimeString("en-PK", {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </p>
              )}
            </div>
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={loadLedger}
              disabled={loading}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/25 bg-white/10 px-4 py-3 text-sm font-semibold text-white backdrop-blur-sm transition hover:bg-white/20 disabled:cursor-wait disabled:opacity-60"
            >
              <RefreshCw
                size={17}
                className={loading ? "animate-spin" : ""}
              />
              Refresh
            </button>

            <button
              type="button"
              onClick={exportCsv}
              disabled={!transactions.length || loading}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-white px-4 py-3 text-sm font-bold text-blue-700 shadow-lg shadow-blue-950/10 transition hover:-translate-y-0.5 hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Download size={17} />
              Export CSV
            </button>
          </div>
        </div>

        <div className="mt-7 grid grid-cols-1 gap-3 border-t border-white/20 pt-5 sm:grid-cols-3">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-white/15 p-2.5">
              <FileSpreadsheet size={19} />
            </div>

            <div>
              <p className="text-xs text-blue-100">
                Transactions returned
              </p>

              <p className="mt-0.5 text-lg font-bold">
                {transactions.length.toLocaleString("en-PK")}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-white/15 p-2.5">
              <Landmark size={19} />
            </div>

            <div>
              <p className="text-xs text-blue-100">
                Accounts available
              </p>

              <p className="mt-0.5 text-lg font-bold">
                {accounts.length.toLocaleString("en-PK")}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-white/15 p-2.5">
              <Activity size={19} />
            </div>

            <div>
              <p className="text-xs text-blue-100">
                Current view
              </p>

              <p className="mt-0.5 text-lg font-bold">
                {activeFilterCount
                  ? "Filtered results"
                  : "All transactions"}
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* SUMMARY CARDS */}

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <SummaryCard
          title="Total Debits"
          value={debit}
          subtitle="Debit movements in this view"
          icon={ArrowDownLeft}
          accent="blue"
        />

        <SummaryCard
          title="Total Credits"
          value={credit}
          subtitle="Credit movements in this view"
          icon={ArrowUpRight}
          accent="green"
        />

        <SummaryCard
          title="Debit − Credit"
          value={difference}
          subtitle={
            Math.abs(difference) < 0.01
              ? "Totals are balanced"
              : "Net difference in this view"
          }
          icon={Scale}
          accent="violet"
        />
      </section>

      {/* FILTERS */}

      <section className={panelClass}>
        <div className="flex flex-col justify-between gap-3 border-b border-slate-200 px-5 py-4 sm:flex-row sm:items-center sm:px-6 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-300">
              <SlidersHorizontal size={19} />
            </div>

            <div>
              <h2 className="font-bold text-slate-900 dark:text-white">
                Transaction filters
              </h2>

              <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                Narrow down the ledger to find specific activity.
              </p>
            </div>

            {activeFilterCount > 0 && (
              <span className="rounded-full bg-blue-100 px-2.5 py-1 text-xs font-bold text-blue-700 dark:bg-blue-500/15 dark:text-blue-300">
                {activeFilterCount} active
              </span>
            )}
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() =>
                setShowFilters((current) => !current)
              }
              className={buttonSecondary}
            >
              <Filter size={16} />
              {showFilters ? "Hide filters" : "Show filters"}
            </button>

            {activeFilterCount > 0 && (
              <button
                type="button"
                onClick={clearFilters}
                className="inline-flex items-center justify-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold text-rose-600 transition hover:bg-rose-50 dark:text-rose-300 dark:hover:bg-rose-500/10"
              >
                <X size={16} />
                Clear
              </button>
            )}
          </div>
        </div>

        {showFilters && (
          <div className="grid gap-5 p-5 sm:grid-cols-2 xl:grid-cols-5 sm:p-6">
            <FilterField
              label="From date"
              htmlFor="ledger-from"
            >
              <div className="relative">
                <CalendarDays
                  size={16}
                  className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                />

                <input
                  id="ledger-from"
                  type="date"
                  name="from"
                  value={filters.from}
                  onChange={updateFilter}
                  max={filters.to || undefined}
                  className={`${inputClass} pl-9`}
                />
              </div>
            </FilterField>

            <FilterField
              label="To date"
              htmlFor="ledger-to"
            >
              <div className="relative">
                <CalendarDays
                  size={16}
                  className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                />

                <input
                  id="ledger-to"
                  type="date"
                  name="to"
                  value={filters.to}
                  onChange={updateFilter}
                  min={filters.from || undefined}
                  className={`${inputClass} pl-9`}
                />
              </div>
            </FilterField>

            <FilterField
              label="Account"
              htmlFor="ledger-account"
            >
              <select
                id="ledger-account"
                name="accountId"
                value={filters.accountId}
                onChange={updateFilter}
                className={inputClass}
              >
                <option value="">All accounts</option>

                {accounts
                  .filter(
                    (account) =>
                      !account.is_group &&
                      account.is_active !== false &&
                      account.is_summary !== true
                  )
                  .map((account) => (
                    <option
                      key={account.account_id}
                      value={account.account_id}
                    >
                      {account.account_code} - {account.account_name}
                    </option>
                  ))}
              </select>
            </FilterField>

            <FilterField
              label="Transaction type"
              htmlFor="ledger-type"
            >
              <select
                id="ledger-type"
                name="type"
                value={filters.type}
                onChange={updateFilter}
                className={inputClass}
              >
                <option value="">All types</option>

                {transactionTypes.map((type) => (
                  <option
                    key={type.value}
                    value={type.value}
                  >
                    {type.label}
                  </option>
                ))}
              </select>
            </FilterField>

            <FilterField
              label="Search"
              htmlFor="ledger-search"
            >
              <div className="relative">
                <Search
                  size={17}
                  className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                />

                <input
                  id="ledger-search"
                  type="search"
                  name="search"
                  value={filters.search}
                  onChange={updateFilter}
                  placeholder="Journal, account..."
                  className={`${inputClass} pl-9`}
                />
              </div>
            </FilterField>
          </div>
        )}
      </section>

      {/* ERROR MESSAGE */}

      {error && (
        <div
          role="alert"
          className="flex items-start gap-3 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800 dark:border-rose-900/60 dark:bg-rose-950/30 dark:text-rose-200"
        >
          <AlertCircle
            size={20}
            className="mt-0.5 shrink-0"
          />

          <div className="flex-1">
            <p className="font-bold">
              Unable to load ledger
            </p>

            <p className="mt-1">{error}</p>
          </div>

          <button
            type="button"
            onClick={() => setError("")}
            className="rounded-lg p-1 transition hover:bg-rose-100 dark:hover:bg-rose-900/40"
            aria-label="Dismiss error"
          >
            <X size={17} />
          </button>
        </div>
      )}

      {/* LEDGER TABLE */}

      <section className={`${panelClass} overflow-hidden`}>
        <div className="flex flex-col justify-between gap-4 border-b border-slate-200 p-5 sm:flex-row sm:items-center sm:px-6 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300">
              <Wallet size={21} />
            </div>

            <div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                Ledger transactions
              </h2>

              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                {loading
                  ? "Retrieving accounting records..."
                  : `${transactions.length.toLocaleString("en-PK")} rows returned · Maximum 2,000 per request`}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-start rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700 sm:self-auto dark:border-emerald-900/60 dark:bg-emerald-950/30 dark:text-emerald-300">
            <CheckCircle2 size={15} />
            Posted transactions
          </div>
        </div>

        {loading ? (
          <div className="flex min-h-72 flex-col items-center justify-center p-10 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-300">
              <RefreshCw
                size={25}
                className="animate-spin"
              />
            </div>

            <p className="mt-4 font-semibold text-slate-800 dark:text-slate-200">
              Loading ledger transactions
            </p>

            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              Please wait while accounting records are retrieved.
            </p>
          </div>
        ) : transactions.length === 0 ? (
          <div className="flex min-h-72 flex-col items-center justify-center p-10 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400">
              <BookOpen size={30} />
            </div>

            <h3 className="mt-4 text-lg font-bold text-slate-900 dark:text-white">
              No posted transactions found
            </h3>

            <p className="mt-2 max-w-md text-sm leading-6 text-slate-500 dark:text-slate-400">
              No transactions match your current filters. Try another
              date range, select a different account, or clear the filters.
            </p>

            {activeFilterCount > 0 && (
              <button
                type="button"
                onClick={clearFilters}
                className="mt-5 inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700"
              >
                <X size={16} />
                Clear all filters
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1150px] border-collapse text-left">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-950/70">
                  <th className="whitespace-nowrap border-b border-slate-200 px-5 py-4 text-xs font-bold uppercase tracking-wider text-slate-500 dark:border-slate-800 dark:text-slate-400">
                    Date
                  </th>

                  <th className="whitespace-nowrap border-b border-slate-200 px-5 py-4 text-xs font-bold uppercase tracking-wider text-slate-500 dark:border-slate-800 dark:text-slate-400">
                    Journal No.
                  </th>

                  <th className="whitespace-nowrap border-b border-slate-200 px-5 py-4 text-xs font-bold uppercase tracking-wider text-slate-500 dark:border-slate-800 dark:text-slate-400">
                    Source
                  </th>

                  <th className="border-b border-slate-200 px-5 py-4 text-xs font-bold uppercase tracking-wider text-slate-500 dark:border-slate-800 dark:text-slate-400">
                    Account
                  </th>

                  <th className="border-b border-slate-200 px-5 py-4 text-xs font-bold uppercase tracking-wider text-slate-500 dark:border-slate-800 dark:text-slate-400">
                    Description
                  </th>

                  <th className="whitespace-nowrap border-b border-slate-200 px-5 py-4 text-right text-xs font-bold uppercase tracking-wider text-slate-500 dark:border-slate-800 dark:text-slate-400">
                    Debit (PKR)
                  </th>

                  <th className="whitespace-nowrap border-b border-slate-200 px-5 py-4 text-right text-xs font-bold uppercase tracking-wider text-slate-500 dark:border-slate-800 dark:text-slate-400">
                    Credit (PKR)
                  </th>

                  <th className="whitespace-nowrap border-b border-slate-200 px-5 py-4 text-right text-xs font-bold uppercase tracking-wider text-slate-500 dark:border-slate-800 dark:text-slate-400">
                    Running Balance
                  </th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {transactions.map((row, index) => (
                  <tr
                    key={
                      row.journal_line_id ??
                      `${row.journal_number || "journal"}-${row.account_id || row.account_code || "account"}-${index}`
                    }
                    className="group transition-colors hover:bg-blue-50/60 dark:hover:bg-blue-950/20"
                  >
                    <td className="whitespace-nowrap px-5 py-4 text-sm text-slate-600 dark:text-slate-300">
                      {dateText(row.journal_date)}
                    </td>

                    <td className="whitespace-nowrap px-5 py-4">
                      <span className="inline-flex rounded-lg border border-blue-100 bg-blue-50 px-2.5 py-1.5 text-xs font-bold text-blue-700 dark:border-blue-900/50 dark:bg-blue-950/40 dark:text-blue-300">
                        {row.journal_number || "—"}
                      </span>
                    </td>

                    <td className="px-5 py-4">
                      <span className="inline-flex max-w-40 items-center rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-semibold text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
                        <span className="truncate">
                          {row.reference_type || "Journal"}
                        </span>
                      </span>
                    </td>

                    <td className="px-5 py-4">
                      <div className="font-semibold text-slate-800 dark:text-slate-200">
                        {row.account_name || "—"}
                      </div>

                      <div className="mt-1 text-xs font-medium text-slate-500 dark:text-slate-400">
                        Code: {row.account_code || "—"}
                      </div>
                    </td>

                    <td className="max-w-xs px-5 py-4 text-sm text-slate-600 dark:text-slate-300">
                      <p className="line-clamp-2">
                        {row.line_description ||
                          row.journal_description ||
                          "—"}
                      </p>
                    </td>

                    <td className="whitespace-nowrap px-5 py-4 text-right text-sm font-semibold tabular-nums text-blue-700 dark:text-blue-300">
                      {Number(row.debit)
                        ? money(row.debit)
                        : "—"}
                    </td>

                    <td className="whitespace-nowrap px-5 py-4 text-right text-sm font-semibold tabular-nums text-emerald-700 dark:text-emerald-300">
                      {Number(row.credit)
                        ? money(row.credit)
                        : "—"}
                    </td>

                    <td className="whitespace-nowrap px-5 py-4 text-right text-sm font-bold tabular-nums text-slate-800 dark:text-slate-100">
                      {money(row.running_balance)}
                    </td>
                  </tr>
                ))}
              </tbody>

              <tfoot>
                <tr className="border-t-2 border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-950/70">
                  <td
                    colSpan={5}
                    className="px-5 py-5 text-right text-sm font-bold text-slate-800 dark:text-slate-200"
                  >
                    Filtered totals
                  </td>

                  <td className="whitespace-nowrap px-5 py-5 text-right text-sm font-bold tabular-nums text-blue-700 dark:text-blue-300">
                    {money(debit)}
                  </td>

                  <td className="whitespace-nowrap px-5 py-5 text-right text-sm font-bold tabular-nums text-emerald-700 dark:text-emerald-300">
                    {money(credit)}
                  </td>

                  <td className="px-5 py-5" />
                </tr>
              </tfoot>
            </table>
          </div>
        )}

        {!loading && transactions.length > 0 && (
          <div className="flex flex-col justify-between gap-2 border-t border-slate-200 bg-slate-50/70 px-5 py-4 text-xs text-slate-500 sm:flex-row sm:items-center dark:border-slate-800 dark:bg-slate-950/40 dark:text-slate-400">
            <p>
              Showing{" "}
              {transactions.length.toLocaleString("en-PK")}{" "}
              transaction
              {transactions.length === 1 ? "" : "s"}
            </p>

            <p className="inline-flex items-center gap-1.5">
              <CheckCircle2
                size={14}
                className="text-emerald-600 dark:text-emerald-400"
              />
              Data retrieved from your accounting ledger
            </p>
          </div>
        )}
      </section>
    </div>
  );
}
