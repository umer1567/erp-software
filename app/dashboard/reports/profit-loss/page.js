
"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Activity,
  ArrowDownRight,
  ArrowUpRight,
  BarChart3,
  CheckCircle2,
  CircleDollarSign,
  Download,
  FileSpreadsheet,
  Layers3,
  RefreshCw,
  Search,
  TrendingDown,
  TrendingUp,
  Wallet,
  X,
  AlertCircle,
  Landmark,
  ReceiptText,
  ShieldAlert,
  LockKeyhole,
} from "lucide-react";

const PERMISSIONS_URL = "/api/permissions/current";
const REPORT_URL = "/api/reports/profit-loss";
const PERMISSION_KEY = "profit_loss";

const currencyFormatter = new Intl.NumberFormat("en-PK", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

function formatAmount(value) {
  const amount = Number(value ?? 0);
  return currencyFormatter.format(Number.isFinite(amount) ? amount : 0);
}

function formatCurrency(value) {
  return `PKR ${formatAmount(value)}`;
}

function safeNumber(value) {
  const number = Number(value ?? 0);
  return Number.isFinite(number) ? number : 0;
}

function getAccountKey(account, index) {
  return (
    account.account_id ??
    account.account_code ??
    `${account.account_name ?? "account"}-${index}`
  );
}

function normalizeAccounts(accounts) {
  return Array.isArray(accounts) ? accounts : [];
}

function getErrorMessage(error) {
  return error instanceof Error
    ? error.message
    : "Something went wrong while loading the report.";
}

function toBoolean(value) {
  return (
    value === true ||
    value === 1 ||
    value === "1" ||
    String(value).toLowerCase() === "true"
  );
}

function normalizePermissionKey(value) {
  return String(value || "").trim().toLowerCase();
}

function downloadCSV(filename, rows) {
  const csvValue = (value) => {
    const text = String(value ?? "");
    return `"${text.replace(/"/g, '""')}"`;
  };

  const content = rows
    .map((row) => row.map(csvValue).join(","))
    .join("\r\n");

  const blob = new Blob(["\uFEFF", content], {
    type: "text/csv;charset=utf-8;",
  });

  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();

  URL.revokeObjectURL(url);
}

function SummaryCard({
  title,
  value,
  description,
  icon: Icon,
  color = "blue",
  loading,
}) {
  const themes = {
    blue: {
      icon: "bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300",
      glow: "from-blue-500/10",
      border: "hover:border-blue-300 dark:hover:border-blue-500/40",
      indicator: "bg-blue-500",
    },
    green: {
      icon: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300",
      glow: "from-emerald-500/10",
      border: "hover:border-emerald-300 dark:hover:border-emerald-500/40",
      indicator: "bg-emerald-500",
    },
    red: {
      icon: "bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300",
      glow: "from-rose-500/10",
      border: "hover:border-rose-300 dark:hover:border-rose-500/40",
      indicator: "bg-rose-500",
    },
    violet: {
      icon: "bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300",
      glow: "from-violet-500/10",
      border: "hover:border-violet-300 dark:hover:border-violet-500/40",
      indicator: "bg-violet-500",
    },
  };

  const theme = themes[color] || themes.blue;

  return (
    <div
      className={`group relative overflow-hidden rounded-2xl border border-slate-200 bg-gradient-to-br ${theme.glow} via-white to-white p-5 shadow-sm transition duration-300 hover:-translate-y-1 hover:shadow-lg dark:border-slate-700 dark:via-slate-900 dark:to-slate-900 ${theme.border}`}
    >
      <div className="absolute -right-7 -top-7 h-24 w-24 rounded-full bg-current opacity-[0.025] transition-transform duration-300 group-hover:scale-125" />

      <div className="relative flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-slate-600 dark:text-slate-300">
            {title}
          </p>

          {loading ? (
            <div className="mt-4 h-7 w-36 animate-pulse rounded-lg bg-slate-200 dark:bg-slate-700" />
          ) : (
            <p className="mt-3 break-words text-2xl font-extrabold tracking-tight text-slate-900 dark:text-white sm:text-3xl">
              {formatAmount(value)}
            </p>
          )}

          <p className="mt-2 text-xs leading-5 text-slate-500 dark:text-slate-400">
            {description}
          </p>
        </div>

        <div
          className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl ${theme.icon} transition-transform duration-300 group-hover:scale-110`}
        >
          <Icon size={23} strokeWidth={2.1} />
        </div>
      </div>

      <div className="mt-5 h-1 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
        <div className={`h-full w-2/3 rounded-full ${theme.indicator}`} />
      </div>
    </div>
  );
}

function AccountSection({
  title,
  subtitle,
  accounts,
  type,
  search,
}) {
  const isRevenue = type === "revenue";

  const accent = isRevenue
    ? {
        icon: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300",
        badge:
          "bg-emerald-50 text-emerald-700 ring-emerald-600/20 dark:bg-emerald-500/10 dark:text-emerald-300 dark:ring-emerald-400/20",
        amount: "text-emerald-700 dark:text-emerald-300",
        bar: "bg-emerald-500",
      }
    : {
        icon: "bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300",
        badge:
          "bg-blue-50 text-blue-700 ring-blue-600/20 dark:bg-blue-500/10 dark:text-blue-300 dark:ring-blue-400/20",
        amount: "text-blue-700 dark:text-blue-300",
        bar: "bg-blue-500",
      };

  const normalizedSearch = search.trim().toLowerCase();

  const filteredAccounts = accounts.filter((account) => {
    const code = String(account.account_code ?? "").toLowerCase();
    const name = String(account.account_name ?? "").toLowerCase();

    return (
      !normalizedSearch ||
      code.includes(normalizedSearch) ||
      name.includes(normalizedSearch)
    );
  });

  const total = filteredAccounts.reduce(
    (sum, account) => sum + safeNumber(account.amount),
    0
  );

  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition-shadow duration-300 hover:shadow-md dark:border-slate-700 dark:bg-slate-900">
      <div className="flex flex-col gap-4 border-b border-slate-200 p-5 dark:border-slate-700 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div
            className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${accent.icon}`}
          >
            {isRevenue ? (
              <TrendingUp size={22} />
            ) : (
              <ReceiptText size={22} />
            )}
          </div>

          <div>
            <h2 className="text-base font-bold text-slate-900 dark:text-white sm:text-lg">
              {title}
            </h2>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              {subtitle}
            </p>
          </div>
        </div>

        <div className="flex items-center justify-between gap-4 sm:justify-end">
          <span
            className={`inline-flex items-center rounded-full px-3 py-1.5 text-xs font-bold ring-1 ring-inset ${accent.badge}`}
          >
            {filteredAccounts.length}{" "}
            {filteredAccounts.length === 1 ? "account" : "accounts"}
          </span>

          <div className="text-right">
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Section total
            </p>
            <p
              className={`mt-1 text-sm font-extrabold tabular-nums ${accent.amount}`}
            >
              {formatAmount(total)}
            </p>
          </div>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[560px] border-collapse text-sm">
          <thead>
            <tr className="bg-slate-50 text-xs uppercase tracking-wider text-slate-500 dark:bg-slate-800/80 dark:text-slate-400">
              <th className="px-5 py-4 text-left font-bold">
                Account code
              </th>
              <th className="px-5 py-4 text-left font-bold">
                Account name
              </th>
              <th className="px-5 py-4 text-right font-bold">
                Amount (PKR)
              </th>
            </tr>
          </thead>

          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {filteredAccounts.map((account, index) => (
              <tr
                key={getAccountKey(account, index)}
                className="group transition-colors hover:bg-blue-50/50 dark:hover:bg-slate-800/60"
              >
                <td className="px-5 py-4">
                  <span className="inline-flex rounded-lg bg-slate-100 px-2.5 py-1 font-mono text-xs font-semibold text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                    {account.account_code || "—"}
                  </span>
                </td>

                <td className="px-5 py-4">
                  <div className="flex items-center gap-3">
                    <div
                      className={`h-2 w-2 shrink-0 rounded-full ${accent.bar}`}
                    />
                    <span className="font-semibold text-slate-800 dark:text-slate-200">
                      {account.account_name || "Unnamed account"}
                    </span>
                  </div>
                </td>

                <td
                  className={`px-5 py-4 text-right font-bold tabular-nums ${accent.amount}`}
                >
                  {formatAmount(account.amount)}
                </td>
              </tr>
            ))}

            {filteredAccounts.length === 0 && (
              <tr>
                <td colSpan={3} className="px-5 py-12 text-center">
                  <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-500">
                    <Search size={22} />
                  </div>
                  <p className="mt-3 font-semibold text-slate-700 dark:text-slate-200">
                    No accounts found
                  </p>
                  <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                    Try another search term.
                  </p>
                </td>
              </tr>
            )}
          </tbody>

          {filteredAccounts.length > 0 && (
            <tfoot>
              <tr className="border-t-2 border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-800/70">
                <td
                  colSpan={2}
                  className="px-5 py-4 font-bold text-slate-700 dark:text-slate-200"
                >
                  Total {title}
                </td>
                <td
                  className={`px-5 py-4 text-right font-extrabold tabular-nums ${accent.amount}`}
                >
                  {formatAmount(total)}
                </td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </section>
  );
}

function AccessMessage({
  title,
  message,
  icon: Icon = ShieldAlert,
  onRetry,
  retryLabel = "Try again",
  loading = false,
}) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 p-4 dark:bg-slate-950">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-7 text-center shadow-sm dark:border-slate-700 dark:bg-slate-900">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-amber-100 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300">
          <Icon size={30} />
        </div>

        <h1 className="mt-5 text-xl font-bold text-slate-900 dark:text-white">
          {title}
        </h1>

        <p className="mt-2 text-sm leading-6 text-slate-500 dark:text-slate-400">
          {message}
        </p>

        {onRetry && (
          <button
            type="button"
            onClick={onRetry}
            disabled={loading}
            className="mt-6 inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <RefreshCw
              size={16}
              className={loading ? "animate-spin" : ""}
            />
            {loading ? "Checking..." : retryLabel}
          </button>
        )}
      </div>
    </main>
  );
}

export default function ProfitLossPage() {
  // Permission state
  const [permissions, setPermissions] = useState({
    canView: false,
    canCreate: false,
    canUpdate: false,
    canDelete: false,
  });

  const [permissionLoading, setPermissionLoading] = useState(true);
  const [permissionError, setPermissionError] = useState("");

  // Report state
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [lastUpdated, setLastUpdated] = useState(null);

  const permissionControllerRef = useRef(null);
  const reportControllerRef = useRef(null);
  const permissionRequestIdRef = useRef(0);

  const loadData = useCallback(async ({ silent = false } = {}) => {
    reportControllerRef.current?.abort();

    const controller = new AbortController();
    reportControllerRef.current = controller;

    if (silent) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    try {
      const response = await fetch(REPORT_URL, {
        method: "GET",
        credentials: "same-origin",
        cache: "no-store",
        signal: controller.signal,
        headers: {
          Accept: "application/json",
        },
      });

      let result;

      try {
        result = await response.json();
      } catch {
        throw new Error("The server returned an invalid response.");
      }

      if (!response.ok || result?.success === false) {
        throw new Error(
          result?.message ||
            result?.error ||
            "Failed to load the Profit & Loss report."
        );
      }

      if (controller.signal.aborted) return;

      setData(result);
      setError("");
      setLastUpdated(new Date());
    } catch (err) {
      if (
        err.name === "AbortError" ||
        controller.signal.aborted
      ) {
        return;
      }

      setError(getErrorMessage(err));
    } finally {
      if (!controller.signal.aborted) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, []);

  const loadPermissions = useCallback(
    async ({ refreshReport = false } = {}) => {
      permissionControllerRef.current?.abort();

      const controller = new AbortController();
      permissionControllerRef.current = controller;

      const requestId = ++permissionRequestIdRef.current;

      setPermissionError("");

      try {
        const response = await fetch(PERMISSIONS_URL, {
          method: "GET",
          credentials: "same-origin",
          cache: "no-store",
          signal: controller.signal,
          headers: {
            Accept: "application/json",
          },
        });

        let result;

        try {
          result = await response.json();
        } catch {
          throw new Error("Invalid permissions response.");
        }

        if (!response.ok) {
          throw new Error(
            result?.message ||
              result?.error ||
              `Permission request failed (${response.status}).`
          );
        }

        if (!Array.isArray(result?.permissions)) {
          throw new Error(
            "Invalid permissions response: expected a permissions array."
          );
        }

        const permission = result.permissions.find(
          (item) =>
            normalizePermissionKey(item.permission_key) ===
            PERMISSION_KEY
        );

        // Deny access when the permission does not exist.
        const nextPermissions = {
          canView: toBoolean(permission?.can_view),
          canCreate: toBoolean(permission?.can_create),
          canUpdate: toBoolean(permission?.can_update),
          canDelete: toBoolean(permission?.can_delete),
        };

        if (
          controller.signal.aborted ||
          requestId !== permissionRequestIdRef.current
        ) {
          return;
        }

        setPermissions(nextPermissions);
        setPermissionError("");
        setPermissionLoading(false);

        if (!nextPermissions.canView) {
          // Stop any report request if access has been revoked.
          reportControllerRef.current?.abort();
          setData(null);
          setError("");
          setLoading(false);
          setRefreshing(false);
          return;
        }

        // Fetch report only after view permission is confirmed.
        if (refreshReport) {
          await loadData({ silent: true });
        } else {
          await loadData({ silent: false });
        }
      } catch (err) {
        if (
          err.name === "AbortError" ||
          controller.signal.aborted
        ) {
          return;
        }

        console.error("Profit & Loss permission error:", err);

        if (requestId !== permissionRequestIdRef.current) {
          return;
        }

        reportControllerRef.current?.abort();

        setPermissions({
          canView: false,
          canCreate: false,
          canUpdate: false,
          canDelete: false,
        });

        setData(null);
        setLoading(false);
        setRefreshing(false);
        setPermissionError(getErrorMessage(err));
        setPermissionLoading(false);
      }
    },
    [loadData]
  );

  // Initial permission check.
  // Initial permission check and event listeners.
useEffect(() => {
  let active = true;

  Promise.resolve().then(() => {
    if (active) {
      void loadPermissions();
    }
  });

  const handlePermissionUpdate = () => {
    void loadPermissions();
  };

  const handleFocus = () => {
    void loadPermissions();
  };

  const handleVisibilityChange = () => {
    if (document.visibilityState === "visible") {
      void loadPermissions();
    }
  };

  window.addEventListener(
    "erp-permissions-updated",
    handlePermissionUpdate
  );

  window.addEventListener("focus", handleFocus);

  document.addEventListener(
    "visibilitychange",
    handleVisibilityChange
  );

  return () => {
    active = false;

    permissionControllerRef.current?.abort();
    reportControllerRef.current?.abort();

    window.removeEventListener(
      "erp-permissions-updated",
      handlePermissionUpdate
    );

    window.removeEventListener("focus", handleFocus);

    document.removeEventListener(
      "visibilitychange",
      handleVisibilityChange
    );
  };
}, [loadPermissions]);

  // Refresh permissions when User Rights are updated.
  useEffect(() => {
    function handlePermissionsUpdated() {
      setPermissionLoading(true);
      void loadPermissions({ refreshReport: true });
    }

    window.addEventListener(
      "erp-permissions-updated",
      handlePermissionsUpdated
    );

    return () => {
      window.removeEventListener(
        "erp-permissions-updated",
        handlePermissionsUpdated
      );
    };
  }, [loadPermissions]);

  // Recheck permissions when the user returns to the page/tab.
  useEffect(() => {
    function handleVisibilityChange() {
      if (document.visibilityState === "visible") {
        setPermissionLoading(true);
        void loadPermissions({ refreshReport: true });
      }
    }

    function handleFocus() {
      setPermissionLoading(true);
      void loadPermissions({ refreshReport: true });
    }

    window.addEventListener("focus", handleFocus);

    document.addEventListener(
      "visibilitychange",
      handleVisibilityChange
    );

    return () => {
      window.removeEventListener("focus", handleFocus);

      document.removeEventListener(
        "visibilitychange",
        handleVisibilityChange
      );
    };
  }, [loadPermissions]);

  const revenue = useMemo(
    () => normalizeAccounts(data?.revenue),
    [data]
  );

  const expenses = useMemo(
    () => normalizeAccounts(data?.expenses),
    [data]
  );

  const totals = data?.totals || {};

  const revenueTotal = safeNumber(totals.totalRevenue);
  const expensesTotal = safeNumber(totals.totalExpenses);
  const netProfit = safeNumber(totals.netProfit);

  const isProfitable = netProfit >= 0;

  const profitMargin =
    revenueTotal !== 0
      ? (netProfit / revenueTotal) * 100
      : 0;

  const visibleRevenue = useMemo(
    () => {
      const term = search.trim().toLowerCase();

      return revenue.filter((account) => {
        return (
          !term ||
          String(account.account_code ?? "").toLowerCase().includes(term) ||
          String(account.account_name ?? "").toLowerCase().includes(term)
        );
      });
    },
    [revenue, search]
  );

  const visibleExpenses = useMemo(
    () => {
      const term = search.trim().toLowerCase();

      return expenses.filter((account) => {
        return (
          !term ||
          String(account.account_code ?? "").toLowerCase().includes(term) ||
          String(account.account_name ?? "").toLowerCase().includes(term)
        );
      });
    },
    [expenses, search]
  );

  const handleExport = () => {
    // Export is a read/report action. It requires can_view,
    // not can_create, can_update, or can_delete.
    if (!permissions.canView || !data) return;

    const rows = [
      ["Profit & Loss Report"],
      ["Generated at", new Date().toLocaleString("en-PK")],
      [],
      ["Summary"],
      ["Metric", "Amount (PKR)"],
      ["Total Revenue", formatAmount(revenueTotal)],
      ["Total Expenses", formatAmount(expensesTotal)],
      ["Net Profit / Loss", formatAmount(netProfit)],
      ["Profit Margin (%)", profitMargin.toFixed(2)],
      [],
      ["Revenue Accounts"],
      ["Account Code", "Account Name", "Amount (PKR)"],
      ...revenue.map((account) => [
        account.account_code ?? "",
        account.account_name ?? "",
        formatAmount(account.amount),
      ]),
      ["", "Total Revenue", formatAmount(revenueTotal)],
      [],
      ["Expense Accounts"],
      ["Account Code", "Account Name", "Amount (PKR)"],
      ...expenses.map((account) => [
        account.account_code ?? "",
        account.account_name ?? "",
        formatAmount(account.amount),
      ]),
      ["", "Total Expenses", formatAmount(expensesTotal)],
      [],
      ["Net Profit / Loss", formatAmount(netProfit)],
    ];

    downloadCSV("profit-loss-report.csv", rows);
  };

  const handleRefresh = () => {
    if (!permissions.canView || refreshing || loading) return;
    void loadData({ silent: true });
  };

  // Permission verification screen.
  if (permissionLoading) {
    return (
      <AccessMessage
        title="Checking access permissions"
        message="Please wait while we verify your permission to view the Profit & Loss report."
        icon={RefreshCw}
        loading
      />
    );
  }

  // Permission API failure: fail closed.
  if (permissionError) {
    return (
      <AccessMessage
        title="Unable to verify permissions"
        message={`${permissionError} Access to this report is blocked until your permissions can be verified.`}
        icon={ShieldAlert}
        onRetry={() => {
          setPermissionLoading(true);
          void loadPermissions();
        }}
      />
    );
  }

  // User does not have can_view permission.
  if (!permissions.canView) {
    return (
      <AccessMessage
        title="Access denied"
        message="You do not have permission to view the Profit & Loss report. Please contact your administrator if you need access."
        icon={LockKeyhole}
        onRetry={() => {
          setPermissionLoading(true);
          void loadPermissions();
        }}
        retryLabel="Check permissions again"
      />
    );
  }

  return (
    <main className="min-h-screen bg-slate-50 p-4 text-slate-900 transition-colors duration-300 dark:bg-slate-950 dark:text-slate-100 sm:p-6 lg:p-8">
      <div className="mx-auto max-w-[1600px] space-y-6">
        {/* Header */}
        <section className="relative isolate overflow-hidden rounded-3xl bg-gradient-to-br from-blue-700 via-blue-600 to-emerald-600 p-6 text-white shadow-xl shadow-blue-900/10 sm:p-8">
          <div className="absolute -right-16 -top-20 -z-10 h-64 w-64 rounded-full border-[36px] border-white/10" />
          <div className="absolute -bottom-24 right-1/3 -z-10 h-64 w-64 rounded-full bg-emerald-300/10 blur-3xl" />
          <div className="absolute right-10 top-10 -z-10 hidden rotate-12 opacity-10 sm:block">
            <BarChart3 size={150} strokeWidth={1} />
          </div>

          <div className="relative flex flex-col gap-6 xl:flex-row xl:items-center xl:justify-between">
            <div className="max-w-2xl">
              <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-xs font-semibold text-blue-50 backdrop-blur">
                <Activity size={14} />
                Financial reporting
              </div>

              <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl">
                Profit &amp; Loss
              </h1>

              <p className="mt-3 max-w-xl text-sm leading-6 text-blue-50 sm:text-base">
                Understand your business performance with a clear overview
                of revenue, expenses, and net profit.
              </p>

              <div className="mt-5 flex flex-wrap items-center gap-3 text-xs font-medium text-white/90">
                <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-2">
                  <Landmark size={14} />
                  Financial overview
                </span>
                <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-2">
                  <CheckCircle2 size={14} />
                  {loading ? "Loading report..." : "Report summary"}
                </span>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={handleRefresh}
                disabled={loading || refreshing}
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-white/25 bg-white/10 px-4 py-2.5 text-sm font-semibold text-white shadow-sm backdrop-blur transition hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <RefreshCw
                  size={17}
                  className={refreshing ? "animate-spin" : ""}
                />
                {refreshing ? "Refreshing..." : "Refresh"}
              </button>

              <button
                type="button"
                onClick={handleExport}
                disabled={!data || loading}
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-white px-4 py-2.5 text-sm font-bold text-blue-700 shadow-lg transition hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <Download size={17} />
                Export CSV
              </button>
            </div>
          </div>
        </section>

        {/* Error banner */}
        {error && (
          <div
            role="alert"
            className="flex flex-col gap-4 rounded-2xl border border-rose-200 bg-rose-50 p-4 dark:border-rose-500/30 dark:bg-rose-500/10 sm:flex-row sm:items-center sm:justify-between"
          >
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300">
                <AlertCircle size={21} />
              </div>
              <div>
                <p className="font-bold text-rose-800 dark:text-rose-200">
                  Unable to load the report
                </p>
                <p className="mt-1 text-sm text-rose-700 dark:text-rose-300">
                  {error}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={handleRefresh}
              disabled={refreshing}
              className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl border border-rose-200 bg-white px-4 py-2.5 text-sm font-semibold text-rose-700 transition hover:bg-rose-100 disabled:opacity-60 dark:border-rose-500/30 dark:bg-slate-900 dark:text-rose-300 dark:hover:bg-rose-500/10"
            >
              <RefreshCw
                size={16}
                className={refreshing ? "animate-spin" : ""}
              />
              Try again
            </button>
          </div>
        )}

        {/* Summary cards */}
        <section>
          <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                Financial summary
              </h2>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                Key figures returned by your Profit &amp; Loss report.
              </p>
            </div>

            {lastUpdated && (
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Updated {lastUpdated.toLocaleTimeString("en-PK")}
              </p>
            )}
          </div>

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <SummaryCard
              title="Total Revenue"
              value={revenueTotal}
              description="Income earned from business activities"
              icon={TrendingUp}
              color="green"
              loading={loading}
            />

            <SummaryCard
              title="Total Expenses"
              value={expensesTotal}
              description="Expenses recorded in the report"
              icon={TrendingDown}
              color="blue"
              loading={loading}
            />

            <SummaryCard
              title={isProfitable ? "Net Profit" : "Net Loss"}
              value={Math.abs(netProfit)}
              description={
                isProfitable
                  ? "Revenue exceeds expenses"
                  : "Expenses exceed revenue"
              }
              icon={isProfitable ? ArrowUpRight : ArrowDownRight}
              color={isProfitable ? "green" : "red"}
              loading={loading}
            />

            <SummaryCard
              title="Profit Margin"
              value={profitMargin}
              description="Net profit as a percentage of revenue"
              icon={CircleDollarSign}
              color="violet"
              loading={loading}
            />
          </div>
        </section>

        {/* Performance panel */}
        <section className="grid gap-4 lg:grid-cols-3">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900 lg:col-span-2">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="font-bold text-slate-900 dark:text-white">
                  Profitability overview
                </h2>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                  Comparison of revenue and expenses
                </p>
              </div>
              <div className="rounded-xl bg-blue-50 p-2.5 text-blue-700 dark:bg-blue-500/10 dark:text-blue-300">
                <BarChart3 size={21} />
              </div>
            </div>

            <div className="mt-6 space-y-5">
              <div>
                <div className="mb-2 flex items-center justify-between gap-3 text-sm">
                  <span className="font-semibold text-slate-700 dark:text-slate-200">
                    Revenue
                  </span>
                  <span className="font-bold tabular-nums text-emerald-700 dark:text-emerald-300">
                    {formatAmount(revenueTotal)}
                  </span>
                </div>
                <div className="h-3 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                  <div className="h-full w-full rounded-full bg-gradient-to-r from-emerald-500 to-green-400" />
                </div>
              </div>

              <div>
                <div className="mb-2 flex items-center justify-between gap-3 text-sm">
                  <span className="font-semibold text-slate-700 dark:text-slate-200">
                    Expenses
                  </span>
                  <span className="font-bold tabular-nums text-blue-700 dark:text-blue-300">
                    {formatAmount(expensesTotal)}
                  </span>
                </div>
                <div className="h-3 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-blue-600 to-sky-400 transition-all duration-700"
                    style={{
                      width: `${
                        revenueTotal > 0
                          ? Math.min(
                              100,
                              (expensesTotal / revenueTotal) * 100
                            )
                          : expensesTotal > 0
                            ? 100
                            : 0
                      }%`,
                    }}
                  />
                </div>
              </div>
            </div>

            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              <div className="rounded-xl bg-slate-50 p-4 dark:bg-slate-800/70">
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Revenue less expenses
                </p>
                <p
                  className={`mt-2 text-xl font-extrabold tabular-nums ${
                    isProfitable
                      ? "text-emerald-700 dark:text-emerald-300"
                      : "text-rose-700 dark:text-rose-300"
                  }`}
                >
                  {netProfit < 0 ? "−" : ""}
                  {formatAmount(Math.abs(netProfit))}
                </p>
              </div>

              <div className="rounded-xl bg-slate-50 p-4 dark:bg-slate-800/70">
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Profit margin
                </p>
                <p
                  className={`mt-2 text-xl font-extrabold tabular-nums ${
                    isProfitable
                      ? "text-emerald-700 dark:text-emerald-300"
                      : "text-rose-700 dark:text-rose-300"
                  }`}
                >
                  {profitMargin.toFixed(2)}%
                </p>
              </div>
            </div>
          </div>

          <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-emerald-600 via-emerald-600 to-teal-700 p-6 text-white shadow-lg shadow-emerald-900/10">
            <div className="absolute -right-8 -top-8 h-36 w-36 rounded-full border-[22px] border-white/10" />
            <div className="absolute -bottom-12 -left-10 h-40 w-40 rounded-full bg-white/5 blur-xl" />

            <div className="relative">
              <div className="flex items-center justify-between gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-white/20 bg-white/10">
                  <Wallet size={24} />
                </div>
                <span className="rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-xs font-bold">
                  {isProfitable ? "Positive result" : "Negative result"}
                </span>
              </div>

              <p className="mt-6 text-sm font-medium text-emerald-50">
                Bottom line
              </p>

              <h2 className="mt-2 text-2xl font-extrabold tracking-tight">
                {isProfitable
                  ? "You're profitable"
                  : "Operating at a loss"}
              </h2>

              <p className="mt-3 text-sm leading-6 text-emerald-50">
                {isProfitable
                  ? "Your reported revenue is greater than your expenses. Review the account breakdown below for more detail."
                  : "Your reported expenses are greater than your revenue. Review the account breakdown below to understand the result."}
              </p>

              <div className="mt-6 rounded-xl border border-white/15 bg-white/10 p-4 backdrop-blur">
                <p className="text-xs font-semibold text-emerald-50">
                  Net {isProfitable ? "profit" : "loss"}
                </p>
                <p className="mt-1 break-words text-2xl font-extrabold tabular-nums">
                  {formatCurrency(Math.abs(netProfit))}
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Account details */}
        <section className="space-y-4">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="text-xl font-extrabold text-slate-900 dark:text-white">
                Account breakdown
              </h2>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                Detailed revenue and expense accounts from your ledger report.
              </p>
            </div>

            <div className="relative w-full sm:max-w-xs">
              <Search
                size={18}
                className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
              />
              <input
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search code or account..."
                aria-label="Search accounts"
                className="h-11 w-full rounded-xl border border-slate-200 bg-white pl-10 pr-10 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 dark:border-slate-700 dark:bg-slate-900 dark:text-white dark:placeholder:text-slate-500 dark:focus:border-blue-400"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch("")}
                  aria-label="Clear account search"
                  className="absolute right-3 top-1/2 -translate-y-1/2 rounded-md p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200"
                >
                  <X size={15} />
                </button>
              )}
            </div>
          </div>

          {loading ? (
            <div className="grid gap-4 lg:grid-cols-2">
              {[1, 2].map((item) => (
                <div
                  key={item}
                  className="overflow-hidden rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-900"
                >
                  <div className="h-6 w-40 animate-pulse rounded bg-slate-200 dark:bg-slate-700" />
                  <div className="mt-5 space-y-4">
                    {[1, 2, 3, 4].map((row) => (
                      <div
                        key={row}
                        className="h-10 animate-pulse rounded-lg bg-slate-100 dark:bg-slate-800"
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="grid items-start gap-5 xl:grid-cols-2">
              <AccountSection
                title="Revenue accounts"
                subtitle="Income generated by your business"
                accounts={visibleRevenue}
                type="revenue"
                search={search}
              />

              <AccountSection
                title="Expense accounts"
                subtitle="Costs and expenses recorded"
                accounts={visibleExpenses}
                type="expenses"
                search={search}
              />
            </div>
          )}
        </section>

        {/* Footer */}
        <footer className="flex flex-col gap-2 border-t border-slate-200 pt-5 text-xs text-slate-500 dark:border-slate-800 dark:text-slate-400 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-100 text-blue-700 dark:bg-blue-500/10 dark:text-blue-300">
              <FileSpreadsheet size={16} />
            </div>
            <span>
              Profit &amp; Loss Report
              <span className="mx-2 text-slate-300 dark:text-slate-700">
                |
              </span>
              PKR
            </span>
          </div>

          <div className="flex items-center gap-2">
            <Layers3 size={14} />
            <span>
              {revenue.length} revenue accounts · {expenses.length} expense
              accounts
            </span>
          </div>
        </footer>
      </div>
    </main>
  );
}
