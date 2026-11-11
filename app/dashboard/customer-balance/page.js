
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Activity,
  AlertCircle,
  ArrowDownLeft,
  ArrowUpRight,
  CheckCircle2,
  ChevronDown,
  CircleDollarSign,
  Clock3,
  Download,
  FileSearch,
  LockKeyhole,
  RefreshCw,
  Search,
  TrendingUp,
  Users,
  Wallet,
  X,
} from "lucide-react";

// =========================================================
// CONFIGURATION
// =========================================================

const PERMISSION_KEY = "customer_balance";

const cardClass =
  "rounded-2xl border border-slate-200/80 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900";

const inputClass =
  "w-full rounded-xl border border-slate-200 bg-white py-3 pl-11 pr-4 text-sm text-slate-800 outline-none transition placeholder:text-slate-400 hover:border-slate-300 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:hover:border-slate-600";

const headingClass = "text-sm font-medium text-slate-500 dark:text-slate-400";

// =========================================================
// HELPERS
// =========================================================

function formatAmount(value) {
  const amount = Number(value ?? 0);

  return (Number.isFinite(amount) ? amount : 0).toLocaleString("en-PK", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function formatInteger(value) {
  return Number(value || 0).toLocaleString("en-PK");
}

function getInitials(name) {
  return String(name || "Customer")
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

function getBalanceStatus(balance) {
  if (balance > 0) {
    return {
      label: "Receivable",
      className:
        "bg-rose-50 text-rose-700 ring-1 ring-inset ring-rose-200 dark:bg-rose-500/10 dark:text-rose-400 dark:ring-rose-500/20",
      dotClass: "bg-rose-500",
    };
  }

  if (balance < 0) {
    return {
      label: "Advance",
      className:
        "bg-blue-50 text-blue-700 ring-1 ring-inset ring-blue-200 dark:bg-blue-500/10 dark:text-blue-400 dark:ring-blue-500/20",
      dotClass: "bg-blue-500",
    };
  }

  return {
    label: "Settled",
    className:
      "bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-400 dark:ring-emerald-500/20",
    dotClass: "bg-emerald-500",
  };
}

async function readResponse(response) {
  const text = await response.text();
  let data = {};

  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      throw new Error("The server returned an invalid response.");
    }
  }

  if (!response.ok) {
    throw new Error(
      data?.message ||
        data?.error ||
        `Request failed with status ${response.status}.`
    );
  }

  return data;
}

function normalizePermission(data) {
  const permission =
    data?.permission ||
    data?.permissions?.find(
      (item) =>
        item.permission_key === PERMISSION_KEY ||
        item.permissionKey === PERMISSION_KEY
    ) ||
    data;

  if (
    !permission ||
    typeof permission !== "object" ||
    Array.isArray(permission)
  ) {
    return null;
  }

  const canView = permission.can_view ?? permission.canView;

  // Fail closed if the permission is missing or malformed.
  if (typeof canView !== "boolean") {
    return null;
  }

  return {
    can_view: canView,
    can_create: Boolean(
      permission.can_create ?? permission.canCreate ?? false
    ),
    can_update: Boolean(
      permission.can_update ?? permission.canUpdate ?? false
    ),
    can_delete: Boolean(
      permission.can_delete ?? permission.canDelete ?? false
    ),
  };
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
  isCount = false,
}) {
  return (
    <div className="group relative overflow-hidden rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm transition duration-300 hover:-translate-y-1 hover:shadow-lg dark:border-slate-700 dark:bg-slate-900">
      <div className="absolute -right-8 -top-8 h-28 w-28 rounded-full bg-slate-100/70 transition-transform duration-500 group-hover:scale-125 dark:bg-slate-800/60" />

      <div className="relative flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className={headingClass}>{title}</p>

          <p
            className={`mt-3 break-words text-2xl font-bold tracking-tight sm:text-3xl ${
              valueColor || "text-slate-900 dark:text-white"
            }`}
          >
            {isCount ? formatInteger(value) : formatAmount(value)}
          </p>

          <p className="mt-2 text-xs leading-5 text-slate-400 dark:text-slate-500">
            {description}
          </p>
        </div>

        <div
          className={`relative flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl ${iconBg}`}
        >
          <Icon className={`h-6 w-6 ${iconColor}`} />
        </div>
      </div>
    </div>
  );
}

// =========================================================
// LOADING SKELETON
// =========================================================

function LoadingSkeleton() {
  return (
    <div
      className="animate-pulse space-y-3 p-5"
      aria-label="Loading customer balances"
    >
      {Array.from({ length: 6 }, (_, index) => (
        <div
          key={index}
          className="grid grid-cols-4 gap-4 sm:grid-cols-7"
        >
          {Array.from({ length: 7 }, (__, cellIndex) => (
            <div
              key={cellIndex}
              className="h-10 rounded-lg bg-slate-100 dark:bg-slate-800"
            />
          ))}
        </div>
      ))}
    </div>
  );
}

// =========================================================
// ACCESS DENIED
// =========================================================

function AccessDenied({ message }) {
  return (
    <div className="flex min-h-[60vh] items-center justify-center bg-slate-50/70 px-4 py-10 dark:bg-slate-950">
      <div className="w-full max-w-lg rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-xl dark:border-slate-700 dark:bg-slate-900">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-rose-50 text-rose-600 dark:bg-rose-500/10 dark:text-rose-400">
          <LockKeyhole className="h-8 w-8" />
        </div>

        <h1 className="mt-5 text-2xl font-bold text-slate-900 dark:text-white">
          Access Restricted
        </h1>

        <p className="mt-3 text-sm leading-6 text-slate-600 dark:text-slate-400">
          {message ||
            "You do not have permission to view Customer Balance. Contact your administrator to request access."}
        </p>
      </div>
    </div>
  );
}

// =========================================================
// MAIN PAGE
// =========================================================

export default function CustomerBalancePage() {
  const [balances, setBalances] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [error, setError] = useState("");
  const [lastUpdated, setLastUpdated] = useState(null);

  // Permission state
  const [permission, setPermission] = useState(null);
  const [permissionLoading, setPermissionLoading] = useState(true);
  const [permissionError, setPermissionError] = useState("");

  const canView = permission?.can_view === true;

  // =======================================================
  // LOAD USER RIGHTS
  // =======================================================

  useEffect(() => {
    const controller = new AbortController();

    async function fetchPermission() {
      try {
        const response = await fetch(
          `/api/permissions/current?permissionKey=${encodeURIComponent(
            PERMISSION_KEY
          )}`,
          {
            method: "GET",
            cache: "no-store",
            headers: { Accept: "application/json" },
            signal: controller.signal,
          }
        );

        const data = await readResponse(response);

        if (controller.signal.aborted) return;

        const normalized = normalizePermission(data);

        if (!normalized) {
          throw new Error(
            "Customer Balance permission was not found. Ask your administrator to configure User Rights."
          );
        }

        setPermission(normalized);
        setPermissionError("");
      } catch (err) {
        if (controller.signal.aborted) return;

        setPermission(null);
        setPermissionError(
          err instanceof Error
            ? err.message
            : "Unable to verify Customer Balance permissions."
        );
      } finally {
        if (!controller.signal.aborted) {
          setPermissionLoading(false);
        }
      }
    }

    // Defer starting the request; state updates occur after async work.
    Promise.resolve().then(() => {
      if (!controller.signal.aborted) {
        fetchPermission();
      }
    });

    return () => controller.abort();
  }, []);

  // =======================================================
  // LOAD CUSTOMER BALANCES
  // =======================================================

  const loadBalances = useCallback(async (options = {}) => {
    const { signal, silent = false } = options;

    if (silent) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    setError("");

    try {
      const response = await fetch("/api/customers/balance", {
        method: "GET",
        cache: "no-store",
        headers: { Accept: "application/json" },
        signal,
      });

      const data = await readResponse(response);

      if (signal?.aborted) return;

      setBalances(Array.isArray(data.balances) ? data.balances : []);
      setLastUpdated(new Date());
    } catch (err) {
      if (err.name !== "AbortError") {
        console.error("Customer balance loading failed:", err);
        setError(err.message || "Unable to load customer balances.");
      }
    } finally {
      if (!signal?.aborted) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, []);

  // Fetch balances only after view permission has been confirmed.
  useEffect(() => {
    if (permissionLoading || !canView) return undefined;

    const controller = new AbortController();

    Promise.resolve().then(() => {
      if (!controller.signal.aborted) {
        loadBalances({ signal: controller.signal });
      }
    });

    return () => controller.abort();
  }, [permissionLoading, canView, loadBalances]);

  // =======================================================
  // SEARCH AND FILTER
  // =======================================================

  const filteredBalances = useMemo(() => {
    const query = search.trim().toLowerCase();

    return balances.filter((customer) => {
      const matchesSearch =
        !query ||
        String(customer.customer_name || "")
          .toLowerCase()
          .includes(query) ||
        String(customer.customer_code || "")
          .toLowerCase()
          .includes(query) ||
        String(customer.phone || "")
          .toLowerCase()
          .includes(query);

      const balance = Number(customer.balance || 0);

      const matchesStatus =
        statusFilter === "ALL" ||
        (statusFilter === "RECEIVABLE" && balance > 0) ||
        (statusFilter === "ADVANCE" && balance < 0) ||
        (statusFilter === "SETTLED" && balance === 0);

      return matchesSearch && matchesStatus;
    });
  }, [balances, search, statusFilter]);

  // =======================================================
  // SUMMARY TOTALS
  // =======================================================

  const summary = useMemo(
    () =>
      balances.reduce(
        (totals, customer) => {
          const opening = Number(customer.opening_balance || 0);
          const sales = Number(customer.total_sales || 0);
          const paid = Number(customer.total_paid || 0);
          const balance = Number(customer.balance || 0);

          totals.opening += Number.isFinite(opening) ? opening : 0;
          totals.sales += Number.isFinite(sales) ? sales : 0;
          totals.paid += Number.isFinite(paid) ? paid : 0;
          totals.balance += Number.isFinite(balance) ? balance : 0;

          if (balance > 0) totals.receivableCount += 1;
          else if (balance < 0) totals.advanceCount += 1;
          else totals.settledCount += 1;

          return totals;
        },
        {
          opening: 0,
          sales: 0,
          paid: 0,
          balance: 0,
          receivableCount: 0,
          advanceCount: 0,
          settledCount: 0,
        }
      ),
    [balances]
  );

  const filteredTotals = useMemo(
    () =>
      filteredBalances.reduce(
        (totals, customer) => {
          totals.opening += Number(customer.opening_balance || 0);
          totals.sales += Number(customer.total_sales || 0);
          totals.paid += Number(customer.total_paid || 0);
          totals.balance += Number(customer.balance || 0);
          return totals;
        },
        { opening: 0, sales: 0, paid: 0, balance: 0 }
      ),
    [filteredBalances]
  );

  // =======================================================
  // EXPORT CSV
  // =======================================================

  const exportCSV = useCallback(() => {
    if (!canView) {
      setError("You do not have permission to export customer balances.");
      return;
    }

    if (filteredBalances.length === 0) {
      setError("There are no customer balances to export.");
      return;
    }

    const headers = [
      "Customer Code",
      "Customer Name",
      "Phone",
      "Opening Balance",
      "Total Sales",
      "Total Paid",
      "Balance",
      "Status",
    ];

    const rows = filteredBalances.map((customer) => {
      const balance = Number(customer.balance || 0);

      return [
        customer.customer_code || "",
        customer.customer_name || "",
        customer.phone || "",
        Number(customer.opening_balance || 0).toFixed(2),
        Number(customer.total_sales || 0).toFixed(2),
        Number(customer.total_paid || 0).toFixed(2),
        balance.toFixed(2),
        getBalanceStatus(balance).label,
      ];
    });

    const escapeCSV = (value) =>
      `"${String(value ?? "").replace(/"/g, '""')}"`;

    const csvContent = [headers, ...rows]
      .map((row) => row.map(escapeCSV).join(","))
      .join("\r\n");

    const blob = new Blob(["\uFEFF", csvContent], {
      type: "text/csv;charset=utf-8;",
    });

    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = `customer-balances-${new Date()
      .toISOString()
      .slice(0, 10)}.csv`;

    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }, [canView, filteredBalances]);

  // =======================================================
  // PERMISSION LOADING / DENIAL
  // =======================================================

  if (permissionLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center bg-slate-50 dark:bg-slate-950">
        <div className="flex flex-col items-center gap-3 text-center">
          <RefreshCw className="h-8 w-8 animate-spin text-blue-600" />
          <p className="text-sm font-medium text-slate-600 dark:text-slate-300">
            Verifying Customer Balance access...
          </p>
        </div>
      </div>
    );
  }

  if (permissionError || !canView) {
    return (
      <AccessDenied
        message={
          permissionError ||
          "You do not have permission to view Customer Balance. Contact your administrator to request access."
        }
      />
    );
  }

  // =======================================================
  // RENDER
  // =======================================================

  return (
    <div className="min-h-screen space-y-6 bg-slate-50/70 pb-8 dark:bg-slate-950">
      <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-950 via-blue-950 to-indigo-900 p-6 text-white shadow-xl shadow-blue-950/10 sm:p-8">
        <div className="pointer-events-none absolute -right-16 -top-24 h-72 w-72 rounded-full border border-white/10" />
        <div className="pointer-events-none absolute -right-4 -top-12 h-52 w-52 rounded-full border border-white/10" />
        <div className="pointer-events-none absolute -bottom-28 left-1/3 h-64 w-64 rounded-full bg-blue-500/10 blur-3xl" />

        <div className="relative flex flex-col justify-between gap-6 lg:flex-row lg:items-center">
          <div className="max-w-2xl">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-blue-300/20 bg-white/10 px-3 py-1.5 text-xs font-semibold tracking-wide text-blue-100">
              <Activity className="h-3.5 w-3.5" />
              CUSTOMER FINANCIALS
            </div>

            <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
              Customer Balance
            </h1>

            <p className="mt-3 max-w-xl text-sm leading-6 text-blue-100/80 sm:text-base">
              Monitor customer receivables, sales, payments and outstanding
              balances from one organized financial dashboard.
            </p>

            <div className="mt-5 flex flex-wrap gap-3 text-xs text-blue-100/90 sm:text-sm">
              <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-2">
                <Users className="h-4 w-4" />
                {formatInteger(balances.length)} customers
              </span>

              <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-2">
                <Clock3 className="h-4 w-4" />
                {lastUpdated
                  ? `Updated ${lastUpdated.toLocaleTimeString("en-PK", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}`
                  : "Waiting for data"}
              </span>
            </div>
          </div>

          <div className="flex flex-wrap gap-3 lg:max-w-xs lg:justify-end">
            <button
              type="button"
              onClick={exportCSV}
              disabled={loading || filteredBalances.length === 0}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/20 bg-white/10 px-4 py-3 text-sm font-semibold text-white backdrop-blur transition hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Download className="h-4 w-4" />
              Export CSV
            </button>

            <button
              type="button"
              onClick={() => loadBalances({ silent: true })}
              disabled={loading || refreshing}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-white px-4 py-3 text-sm font-semibold text-blue-950 shadow-lg transition hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <RefreshCw
                className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`}
              />
              Refresh
            </button>
          </div>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryCard
          title="Total Customers"
          value={balances.length}
          isCount
          description="Customers in this report"
          icon={Users}
          iconColor="text-blue-600 dark:text-blue-400"
          iconBg="bg-blue-50 dark:bg-blue-500/10"
        />

        <SummaryCard
          title="Total Sales"
          value={summary.sales}
          description="Combined customer sales"
          icon={TrendingUp}
          iconColor="text-emerald-600 dark:text-emerald-400"
          iconBg="bg-emerald-50 dark:bg-emerald-500/10"
          valueColor="text-emerald-700 dark:text-emerald-400"
        />

        <SummaryCard
          title="Total Payments"
          value={summary.paid}
          description="Payments received from customers"
          icon={ArrowDownLeft}
          iconColor="text-blue-600 dark:text-blue-400"
          iconBg="bg-blue-50 dark:bg-blue-500/10"
          valueColor="text-blue-700 dark:text-blue-400"
        />

        <SummaryCard
          title="Outstanding Balance"
          value={summary.balance}
          description="Net balance from the API records"
          icon={Wallet}
          iconColor="text-rose-600 dark:text-rose-400"
          iconBg="bg-rose-50 dark:bg-rose-500/10"
          valueColor="text-rose-700 dark:text-rose-400"
        />
      </section>

      <section className={`${cardClass} p-4 sm:p-5`}>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="flex items-center gap-3 rounded-xl bg-rose-50/80 p-4 dark:bg-rose-500/5">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-rose-100 text-rose-600 dark:bg-rose-500/10 dark:text-rose-400">
              <TrendingUp className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs font-medium text-rose-600 dark:text-rose-400">
                Customers with Receivables
              </p>
              <p className="mt-1 text-2xl font-bold text-rose-800 dark:text-rose-300">
                {formatInteger(summary.receivableCount)}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 rounded-xl bg-blue-50/80 p-4 dark:bg-blue-500/5">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-100 text-blue-600 dark:bg-blue-500/10 dark:text-blue-400">
              <ArrowUpRight className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs font-medium text-blue-600 dark:text-blue-400">
                Customers with Advances
              </p>
              <p className="mt-1 text-2xl font-bold text-blue-800 dark:text-blue-300">
                {formatInteger(summary.advanceCount)}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 rounded-xl bg-emerald-50/80 p-4 dark:bg-emerald-500/5">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-100 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400">
              <CheckCircle2 className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs font-medium text-emerald-600 dark:text-emerald-400">
                Settled Customers
              </p>
              <p className="mt-1 text-2xl font-bold text-emerald-800 dark:text-emerald-300">
                {formatInteger(summary.settledCount)}
              </p>
            </div>
          </div>
        </div>
      </section>

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
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      <section className={`${cardClass} overflow-hidden`}>
        <div className="flex flex-col gap-4 border-b border-slate-100 p-5 dark:border-slate-800 sm:p-6">
          <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-400">
                <FileSearch className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                  Customer Balances
                </h2>
                <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                  Search and review individual customer accounts
                </p>
              </div>
            </div>

            <span className="inline-flex w-fit items-center gap-2 rounded-full bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
              <span className="h-2 w-2 rounded-full bg-emerald-500" />
              {filteredBalances.length} result
              {filteredBalances.length === 1 ? "" : "s"}
            </span>
          </div>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-[minmax(0,1fr)_220px_auto]">
            <div className="relative">
              <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search by customer name, code or phone..."
                className={inputClass}
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch("")}
                  aria-label="Clear search"
                  className="absolute right-3 top-1/2 -translate-y-1/2 rounded-md p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-700 dark:hover:text-white"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>

            <div className="relative">
              <select
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value)}
                className={`${inputClass} appearance-none pr-10`}
                aria-label="Filter customers by balance status"
              >
                <option value="ALL">All balances</option>
                <option value="RECEIVABLE">Receivables only</option>
                <option value="ADVANCE">Advances only</option>
                <option value="SETTLED">Settled only</option>
              </select>
              <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            </div>

            <button
              type="button"
              onClick={() => {
                setSearch("");
                setStatusFilter("ALL");
              }}
              disabled={!search && statusFilter === "ALL"}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
            >
              <X className="h-4 w-4" />
              Clear filters
            </button>
          </div>
        </div>

        {loading ? (
          <LoadingSkeleton />
        ) : error && balances.length === 0 ? (
          <div className="flex flex-col items-center px-6 py-14 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-red-50 dark:bg-red-500/10">
              <AlertCircle className="h-7 w-7 text-red-500" />
            </div>
            <h3 className="mt-4 font-bold text-slate-900 dark:text-white">
              Could not load customer balances
            </h3>
            <p className="mt-2 max-w-md text-sm text-slate-500 dark:text-slate-400">
              Check your connection and try loading the customer balance report
              again.
            </p>
            <button
              type="button"
              onClick={() => loadBalances()}
              className="mt-5 inline-flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-blue-700"
            >
              <RefreshCw className="h-4 w-4" />
              Try again
            </button>
          </div>
        ) : filteredBalances.length === 0 ? (
          <div className="flex flex-col items-center px-6 py-14 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 dark:bg-slate-800">
              <Search className="h-7 w-7 text-slate-400" />
            </div>
            <h3 className="mt-4 font-bold text-slate-900 dark:text-white">
              No customers found
            </h3>
            <p className="mt-2 max-w-md text-sm text-slate-500 dark:text-slate-400">
              {balances.length === 0
                ? "No customer balance records are available yet."
                : "Try another search term or change the balance status filter."}
            </p>
            {(search || statusFilter !== "ALL") && (
              <button
                type="button"
                onClick={() => {
                  setSearch("");
                  setStatusFilter("ALL");
                }}
                className="mt-4 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700"
              >
                Show all customers
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1050px] border-collapse text-sm">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-800/80">
                  {[
                    ["Customer", "left"],
                    ["Phone", "left"],
                    ["Opening", "right"],
                    ["Sales", "right"],
                    ["Paid", "right"],
                    ["Balance", "right"],
                    ["Status", "left"],
                  ].map(([label, align]) => (
                    <th
                      key={label}
                      className={`px-5 py-4 text-${align} text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400`}
                    >
                      {label}
                    </th>
                  ))}
                </tr>
              </thead>

              <tbody>
                {filteredBalances.map((customer) => {
                  const opening = Number(customer.opening_balance || 0);
                  const sales = Number(customer.total_sales || 0);
                  const paid = Number(customer.total_paid || 0);
                  const balance = Number(customer.balance || 0);
                  const status = getBalanceStatus(balance);

                  return (
                    <tr
                      key={customer.customer_id}
                      className="border-t border-slate-100 transition-colors hover:bg-blue-50/40 dark:border-slate-800 dark:hover:bg-slate-800/50"
                    >
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 text-xs font-bold text-white shadow-sm">
                            {getInitials(customer.customer_name)}
                          </div>
                          <div className="min-w-0">
                            <p className="font-semibold text-slate-800 dark:text-slate-100">
                              {customer.customer_name || "Unnamed customer"}
                            </p>
                            <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">
                              {customer.customer_code || "No customer code"}
                            </p>
                          </div>
                        </div>
                      </td>

                      <td className="whitespace-nowrap px-5 py-4 text-slate-600 dark:text-slate-300">
                        {customer.phone || "—"}
                      </td>
                      <td className="whitespace-nowrap px-5 py-4 text-right tabular-nums text-slate-600 dark:text-slate-300">
                        {formatAmount(opening)}
                      </td>
                      <td className="whitespace-nowrap px-5 py-4 text-right font-medium tabular-nums text-slate-800 dark:text-slate-200">
                        {formatAmount(sales)}
                      </td>
                      <td className="whitespace-nowrap px-5 py-4 text-right font-medium tabular-nums text-emerald-700 dark:text-emerald-400">
                        {formatAmount(paid)}
                      </td>
                      <td className="whitespace-nowrap px-5 py-4 text-right">
                        <span
                          className={`font-bold tabular-nums ${
                            balance > 0
                              ? "text-rose-700 dark:text-rose-400"
                              : balance < 0
                                ? "text-blue-700 dark:text-blue-400"
                                : "text-emerald-700 dark:text-emerald-400"
                          }`}
                        >
                          {formatAmount(balance)}
                        </span>
                      </td>
                      <td className="px-5 py-4">
                        <span
                          className={`inline-flex items-center gap-2 whitespace-nowrap rounded-full px-2.5 py-1.5 text-xs font-semibold ${status.className}`}
                        >
                          <span
                            className={`h-1.5 w-1.5 rounded-full ${status.dotClass}`}
                          />
                          {status.label}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>

              <tfoot>
                <tr className="border-t-2 border-slate-200 bg-slate-100/80 dark:border-slate-700 dark:bg-slate-800">
                  <td
                    colSpan={2}
                    className="px-5 py-5 text-right font-bold uppercase tracking-wide text-slate-700 dark:text-slate-200"
                  >
                    Filtered Total
                  </td>
                  <td className="whitespace-nowrap px-5 py-5 text-right font-bold tabular-nums text-slate-700 dark:text-slate-200">
                    {formatAmount(filteredTotals.opening)}
                  </td>
                  <td className="whitespace-nowrap px-5 py-5 text-right font-bold tabular-nums text-slate-800 dark:text-white">
                    {formatAmount(filteredTotals.sales)}
                  </td>
                  <td className="whitespace-nowrap px-5 py-5 text-right font-bold tabular-nums text-emerald-700 dark:text-emerald-400">
                    {formatAmount(filteredTotals.paid)}
                  </td>
                  <td className="whitespace-nowrap px-5 py-5 text-right font-bold tabular-nums text-rose-700 dark:text-rose-400">
                    {formatAmount(filteredTotals.balance)}
                  </td>
                  <td className="px-5 py-5 text-xs font-medium text-slate-500 dark:text-slate-400">
                    {filteredBalances.length} customers
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}

        {!loading && !error && balances.length > 0 && (
          <div className="flex flex-col gap-2 border-t border-slate-100 px-5 py-4 text-xs text-slate-500 dark:border-slate-800 dark:text-slate-400 sm:flex-row sm:items-center sm:justify-between sm:px-6">
            <span>
              Showing {filteredBalances.length} of {balances.length} customers
            </span>
            <span className="inline-flex items-center gap-1.5">
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
              Customer balances loaded
            </span>
          </div>
        )}
      </section>

      <div className="flex items-start gap-2 rounded-xl border border-blue-100 bg-blue-50/70 px-4 py-3 text-xs leading-5 text-blue-800 dark:border-blue-900/40 dark:bg-blue-500/5 dark:text-blue-300">
        <CircleDollarSign className="mt-0.5 h-4 w-4 shrink-0" />
        <p>
          <span className="font-semibold">Balance guide:</span> A positive
          balance is shown as receivable, a negative balance as an advance, and
          zero as settled. Figures are displayed using the values returned by
          your existing customer balance API.
        </p>
      </div>
    </div>
  );
}
