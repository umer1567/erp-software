"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Activity,
  AlertCircle,
  ArrowLeftRight,
  BadgeCheck,
  BarChart3,
  CheckCircle2,
  CircleDollarSign,
  Download,
  FileSpreadsheet,
  Landmark,
  Layers3,
  RefreshCw,
  Search,
  ShieldAlert,
  ShieldCheck,
  Wallet,
  X,
} from "lucide-react";

const PERMISSION_KEY = "balance_sheet";
const PERMISSIONS_URL = "/api/permissions/current";
const REPORT_URL = "/api/reports/balance-sheet";

const DENIED_PERMISSIONS = {
  can_view: false,
  can_create: false,
  can_update: false,
  can_delete: false,
};

const moneyFormatter = new Intl.NumberFormat("en-PK", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

function toNumber(value) {
  const number = Number(value ?? 0);
  return Number.isFinite(number) ? number : 0;
}

function toBoolean(value) {
  return (
    value === true ||
    value === 1 ||
    value === "1" ||
    String(value).toLowerCase() === "true"
  );
}

function formatAmount(value) {
  return moneyFormatter.format(toNumber(value));
}

function formatCurrency(value) {
  return `PKR ${formatAmount(value)}`;
}

function getAccountKey(account, index) {
  return (
    account.account_id ??
    account.account_code ??
    `${account.account_name ?? "account"}-${index}`
  );
}

function getErrorMessage(error) {
  return error instanceof Error
    ? error.message
    : "Unable to load the Balance Sheet. Please try again.";
}

function normalizePermission(row) {
  if (!row) return DENIED_PERMISSIONS;

  return {
    can_view: toBoolean(row.can_view),
    can_create: toBoolean(row.can_create),
    can_update: toBoolean(row.can_update),
    can_delete: toBoolean(row.can_delete),
  };
}

function downloadCSV(filename, rows) {
  const escapeCSV = (value) =>
    `"${String(value ?? "").replace(/"/g, '""')}"`;

  const csv = rows
    .map((row) => row.map(escapeCSV).join(","))
    .join("\r\n");

  const blob = new Blob(["\uFEFF", csv], {
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
      gradient: "from-blue-500/10",
      hover: "hover:border-blue-300 dark:hover:border-blue-500/40",
      bar: "bg-blue-500",
    },
    green: {
      icon: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300",
      gradient: "from-emerald-500/10",
      hover: "hover:border-emerald-300 dark:hover:border-emerald-500/40",
      bar: "bg-emerald-500",
    },
    violet: {
      icon: "bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300",
      gradient: "from-violet-500/10",
      hover: "hover:border-violet-300 dark:hover:border-violet-500/40",
      bar: "bg-violet-500",
    },
  };

  const theme = themes[color] || themes.blue;

  return (
    <div
      className={`group relative overflow-hidden rounded-2xl border border-slate-200 bg-gradient-to-br ${theme.gradient} via-white to-white p-5 shadow-sm transition duration-300 hover:-translate-y-1 hover:shadow-lg dark:border-slate-700 dark:via-slate-900 dark:to-slate-900 ${theme.hover}`}
    >
      <div className="absolute -right-7 -top-7 h-24 w-24 rounded-full bg-current opacity-[0.025] transition-transform duration-300 group-hover:scale-125" />

      <div className="relative flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-slate-600 dark:text-slate-300">
            {title}
          </p>

          {loading ? (
            <div className="mt-4 h-8 w-36 animate-pulse rounded-lg bg-slate-200 dark:bg-slate-700" />
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

      <div className="mt-5 h-1 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
        <div className={`h-full w-2/3 rounded-full ${theme.bar}`} />
      </div>
    </div>
  );
}

function AccountSection({
  title,
  subtitle,
  accounts,
  total,
  color = "blue",
  search,
}) {
  const themes = {
    blue: {
      icon: "bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300",
      badge:
        "bg-blue-50 text-blue-700 ring-blue-600/20 dark:bg-blue-500/10 dark:text-blue-300 dark:ring-blue-400/20",
      amount: "text-blue-700 dark:text-blue-300",
      dot: "bg-blue-500",
    },
    green: {
      icon: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300",
      badge:
        "bg-emerald-50 text-emerald-700 ring-emerald-600/20 dark:bg-emerald-500/10 dark:text-emerald-300 dark:ring-emerald-400/20",
      amount: "text-emerald-700 dark:text-emerald-300",
      dot: "bg-emerald-500",
    },
    violet: {
      icon: "bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300",
      badge:
        "bg-violet-50 text-violet-700 ring-violet-600/20 dark:bg-violet-500/10 dark:text-violet-300 dark:ring-violet-400/20",
      amount: "text-violet-700 dark:text-violet-300",
      dot: "bg-violet-500",
    },
  };

  const theme = themes[color] || themes.blue;
  const term = search.trim().toLowerCase();

  const filteredAccounts = accounts.filter((account) => {
    const code = String(account.account_code ?? "").toLowerCase();
    const name = String(account.account_name ?? "").toLowerCase();

    return !term || code.includes(term) || name.includes(term);
  });

  const filteredTotal = filteredAccounts.reduce(
    (sum, account) => sum + toNumber(account.balance),
    0
  );

  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition-shadow duration-300 hover:shadow-md dark:border-slate-700 dark:bg-slate-900">
      <div className="flex flex-col gap-4 border-b border-slate-200 p-5 dark:border-slate-700 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div
            className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${theme.icon}`}
          >
            <Landmark size={22} />
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
            className={`inline-flex items-center rounded-full px-3 py-1.5 text-xs font-bold ring-1 ring-inset ${theme.badge}`}
          >
            {filteredAccounts.length}{" "}
            {filteredAccounts.length === 1 ? "account" : "accounts"}
          </span>

          <div className="text-right">
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Section total
            </p>
            <p
              className={`mt-1 text-sm font-extrabold tabular-nums ${theme.amount}`}
            >
              {formatAmount(filteredTotal)}
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
                Balance (PKR)
              </th>
            </tr>
          </thead>

          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {filteredAccounts.map((account, index) => (
              <tr
                key={getAccountKey(account, index)}
                className="transition-colors hover:bg-blue-50/50 dark:hover:bg-slate-800/60"
              >
                <td className="px-5 py-4">
                  <span className="inline-flex rounded-lg bg-slate-100 px-2.5 py-1 font-mono text-xs font-semibold text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                    {account.account_code || "—"}
                  </span>
                </td>

                <td className="px-5 py-4">
                  <div className="flex items-center gap-3">
                    <div
                      className={`h-2 w-2 shrink-0 rounded-full ${theme.dot}`}
                    />
                    <span className="font-semibold text-slate-800 dark:text-slate-200">
                      {account.account_name || "Unnamed account"}
                    </span>
                  </div>
                </td>

                <td
                  className={`px-5 py-4 text-right font-bold tabular-nums ${theme.amount}`}
                >
                  {formatAmount(account.balance)}
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
                    Try a different account code or name.
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
                  className={`px-5 py-4 text-right font-extrabold tabular-nums ${theme.amount}`}
                >
                  {formatAmount(filteredTotal)}
                </td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      <div className="border-t border-slate-100 px-5 py-3 dark:border-slate-800">
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Full section balance:{" "}
          <span className="font-semibold text-slate-700 dark:text-slate-200">
            {formatAmount(total)}
          </span>
        </p>
      </div>
    </section>
  );
}

function LoadingSection() {
  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-900">
      <div className="h-6 w-40 animate-pulse rounded bg-slate-200 dark:bg-slate-700" />
      <div className="mt-5 space-y-4">
        {[1, 2, 3, 4].map((item) => (
          <div
            key={item}
            className="h-10 animate-pulse rounded-lg bg-slate-100 dark:bg-slate-800"
          />
        ))}
      </div>
    </div>
  );
}

function PermissionLoading() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 p-6 dark:bg-slate-950">
      <div className="text-center">
        <RefreshCw
          size={35}
          className="mx-auto animate-spin text-blue-600"
        />
        <h2 className="mt-4 text-lg font-bold text-slate-900 dark:text-white">
          Checking permissions
        </h2>
        <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
          Please wait while we verify your access.
        </p>
      </div>
    </main>
  );
}

function PermissionMessage({
  title,
  message,
  onRetry,
  buttonText = "Try again",
}) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 p-6 dark:bg-slate-950">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-lg dark:border-slate-700 dark:bg-slate-900">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-rose-100 text-rose-600 dark:bg-rose-500/10 dark:text-rose-300">
          <ShieldAlert size={30} />
        </div>

        <h2 className="mt-5 text-xl font-bold text-slate-900 dark:text-white">
          {title}
        </h2>

        <p className="mt-2 text-sm leading-6 text-slate-500 dark:text-slate-400">
          {message}
        </p>

        {onRetry && (
          <button
            type="button"
            onClick={onRetry}
            className="mt-6 inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700"
          >
            <RefreshCw size={16} />
            {buttonText}
          </button>
        )}

        <button
          type="button"
          onClick={() => window.location.replace("/dashboard")}
          className="mt-3 block w-full rounded-xl border border-slate-200 px-5 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
        >
          Back to Dashboard
        </button>
      </div>
    </main>
  );
}

export default function BalanceSheetPage() {
  // Permission state
  const [permissions, setPermissions] = useState(DENIED_PERMISSIONS);
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

  const dataRef = useRef(null);
  const permissionsRef = useRef(DENIED_PERMISSIONS);

  // Keep refs synchronized with current state.
  useEffect(() => {
    dataRef.current = data;
  }, [data]);

  useEffect(() => {
    permissionsRef.current = permissions;
  }, [permissions]);

  // Load the Balance Sheet report.
  const loadData = useCallback(async ({ silent = false } = {}) => {
    // Do not load a report without view permission.
    if (!permissionsRef.current.can_view) {
      return;
    }

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

      if (!response.ok) {
        throw new Error(
          result?.message ||
            result?.error ||
            "Failed to load the Balance Sheet report."
        );
      }

      if (controller.signal.aborted) return;

      setData(result);
      setError("");
      setLastUpdated(new Date());
    } catch (err) {
      if (err.name === "AbortError" || controller.signal.aborted) {
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

  // Load the current user's permissions.
  const loadPermissions = useCallback(async () => {
    permissionControllerRef.current?.abort();

    const controller = new AbortController();
    permissionControllerRef.current = controller;

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
        throw new Error("The permission server returned an invalid response.");
      }

      if (!response.ok) {
        throw new Error(
          result?.message ||
            result?.error ||
            "Unable to verify your permissions."
        );
      }

      if (!Array.isArray(result.permissions)) {
        throw new Error(
          "Invalid permissions response: expected a permissions array."
        );
      }

      const permissionRow = result.permissions.find(
        (permission) =>
          String(permission.permission_key || "")
            .trim()
            .toLowerCase() === PERMISSION_KEY
      );

      const nextPermissions = normalizePermission(permissionRow);

      if (controller.signal.aborted) return;

      permissionsRef.current = nextPermissions;
      setPermissions(nextPermissions);
      setPermissionError("");

      if (nextPermissions.can_view) {
        // Fetch the report only after view permission is confirmed.
        await loadData({
          silent: Boolean(dataRef.current),
        });
      } else {
        // Immediately stop any pending report request.
        reportControllerRef.current?.abort();

        setData(null);
        dataRef.current = null;
        setError("");
        setLastUpdated(null);
        setLoading(false);
        setRefreshing(false);
      }
    } catch (err) {
      if (err.name === "AbortError" || controller.signal.aborted) {
        return;
      }

      console.error("Balance Sheet permission error:", err);

      reportControllerRef.current?.abort();

      permissionsRef.current = DENIED_PERMISSIONS;
      setPermissions(DENIED_PERMISSIONS);
      setPermissionError(
        err instanceof Error
          ? err.message
          : "Unable to verify your permissions."
      );

      setData(null);
      dataRef.current = null;
      setError("");
      setLoading(false);
      setRefreshing(false);
    } finally {
      if (!controller.signal.aborted) {
        setPermissionLoading(false);
      }
    }
  }, [loadData]);

  // Initial permission check.
  // setTimeout avoids the react-hooks/set-state-in-effect warning.
  useEffect(() => {
    const timer = setTimeout(() => {
      void loadPermissions();
    }, 0);

    return () => {
      clearTimeout(timer);

      permissionControllerRef.current?.abort();
      reportControllerRef.current?.abort();
    };
  }, [loadPermissions]);

  // Refresh permissions when User Rights are updated.
  useEffect(() => {
    function handlePermissionsUpdated() {
      void loadPermissions();
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

  // Refresh permissions when the browser tab becomes active.
  useEffect(() => {
    function handleFocus() {
      void loadPermissions();
    }

    function handleVisibilityChange() {
      if (document.visibilityState === "visible") {
        void loadPermissions();
      }
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

  const assets = useMemo(
    () => (Array.isArray(data?.assets) ? data.assets : []),
    [data]
  );

  const liabilities = useMemo(
    () => (Array.isArray(data?.liabilities) ? data.liabilities : []),
    [data]
  );

  const equity = useMemo(
    () => (Array.isArray(data?.equity) ? data.equity : []),
    [data]
  );

  const totals = data?.totals || {};

  const totalAssets = toNumber(totals.totalAssets);
  const totalLiabilities = toNumber(totals.totalLiabilities);
  const totalEquity = toNumber(totals.totalEquityWithProfit);
  const difference = toNumber(totals.difference);

  const isBalanced = Math.abs(difference) < 0.01;
  const liabilitiesAndEquity = totalLiabilities + totalEquity;

  const assetCoverage =
    totalAssets > 0
      ? Math.min(100, (liabilitiesAndEquity / totalAssets) * 100)
      : liabilitiesAndEquity === 0
        ? 100
        : 0;

  const handleRefresh = () => {
    if (permissions.can_view) {
      void loadData({ silent: true });
    }
  };

  const handleExport = () => {
    // CSV export is a read/export action, not a create action.
    if (!permissions.can_view || !data) return;

    const rows = [
      ["Balance Sheet Report"],
      ["Generated at", new Date().toLocaleString("en-PK")],
      [],
      ["Financial Summary"],
      ["Metric", "Amount (PKR)"],
      ["Total Assets", formatAmount(totalAssets)],
      ["Total Liabilities", formatAmount(totalLiabilities)],
      ["Total Equity", formatAmount(totalEquity)],
      ["Liabilities + Equity", formatAmount(liabilitiesAndEquity)],
      ["Balance Difference", formatAmount(difference)],
      ["Status", isBalanced ? "Balanced" : "Difference detected"],
      [],
      ["Assets"],
      ["Account Code", "Account Name", "Balance (PKR)"],
      ...assets.map((account) => [
        account.account_code ?? "",
        account.account_name ?? "",
        formatAmount(account.balance),
      ]),
      ["", "Total Assets", formatAmount(totalAssets)],
      [],
      ["Liabilities"],
      ["Account Code", "Account Name", "Balance (PKR)"],
      ...liabilities.map((account) => [
        account.account_code ?? "",
        account.account_name ?? "",
        formatAmount(account.balance),
      ]),
      ["", "Total Liabilities", formatAmount(totalLiabilities)],
      [],
      ["Equity"],
      ["Account Code", "Account Name", "Balance (PKR)"],
      ...equity.map((account) => [
        account.account_code ?? "",
        account.account_name ?? "",
        formatAmount(account.balance),
      ]),
      ["", "Total Equity", formatAmount(totalEquity)],
      [],
      ["Liabilities + Equity", formatAmount(liabilitiesAndEquity)],
      ["Balance Difference", formatAmount(difference)],
    ];

    downloadCSV("balance-sheet-report.csv", rows);
  };

  // Permission loading screen.
  if (permissionLoading) {
    return <PermissionLoading />;
  }

  // Permission API error screen.
  if (permissionError) {
    return (
      <PermissionMessage
        title="Unable to verify permissions"
        message={permissionError}
        onRetry={() => {
          setPermissionLoading(true);
          void loadPermissions();
        }}
        buttonText="Retry permission check"
      />
    );
  }

  // Access denied screen.
  if (!permissions.can_view) {
    return (
      <PermissionMessage
        title="Access denied"
        message="You do not have permission to view the Balance Sheet report. Please contact your administrator if you need access."
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
                Balance Sheet
              </h1>

              <p className="mt-3 max-w-xl text-sm leading-6 text-blue-50 sm:text-base">
                View your financial position through assets, liabilities, and
                equity, all in one clear overview.
              </p>

              <div className="mt-5 flex flex-wrap items-center gap-3 text-xs font-medium text-white/90">
                <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-2">
                  <Landmark size={14} />
                  Financial position
                </span>

                <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-2">
                  <ShieldCheck size={14} />
                  Balance verification
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

        {/* Report error */}
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
                  Unable to load the Balance Sheet
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
                An overview of your company&apos;s assets, liabilities, and
                equity.
              </p>
            </div>

            {lastUpdated && (
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Updated {lastUpdated.toLocaleTimeString("en-PK")}
              </p>
            )}
          </div>

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            <SummaryCard
              title="Total Assets"
              value={totalAssets}
              description="Resources owned by the business"
              icon={Wallet}
              color="green"
              loading={loading}
            />

            <SummaryCard
              title="Total Liabilities"
              value={totalLiabilities}
              description="Obligations owed by the business"
              icon={ArrowLeftRight}
              color="blue"
              loading={loading}
            />

            <SummaryCard
              title="Total Equity"
              value={totalEquity}
              description="Equity including reported profit"
              icon={CircleDollarSign}
              color="violet"
              loading={loading}
            />
          </div>
        </section>

        {/* Position comparison */}
        <section className="grid gap-4 lg:grid-cols-3">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900 lg:col-span-2">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="font-bold text-slate-900 dark:text-white">
                  Financial position overview
                </h2>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                  Assets compared with liabilities and equity
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
                    Total assets
                  </span>
                  <span className="font-bold tabular-nums text-emerald-700 dark:text-emerald-300">
                    {formatAmount(totalAssets)}
                  </span>
                </div>

                <div className="h-3 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                  <div className="h-full w-full rounded-full bg-gradient-to-r from-emerald-500 to-green-400" />
                </div>
              </div>

              <div>
                <div className="mb-2 flex items-center justify-between gap-3 text-sm">
                  <span className="font-semibold text-slate-700 dark:text-slate-200">
                    Liabilities + equity
                  </span>
                  <span className="font-bold tabular-nums text-blue-700 dark:text-blue-300">
                    {formatAmount(liabilitiesAndEquity)}
                  </span>
                </div>

                <div className="h-3 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-blue-600 to-sky-400 transition-all duration-700"
                    style={{ width: `${assetCoverage}%` }}
                  />
                </div>
              </div>
            </div>

            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              <div className="rounded-xl bg-slate-50 p-4 dark:bg-slate-800/70">
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Assets
                </p>
                <p className="mt-2 break-words text-xl font-extrabold tabular-nums text-emerald-700 dark:text-emerald-300">
                  {formatAmount(totalAssets)}
                </p>
              </div>

              <div className="rounded-xl bg-slate-50 p-4 dark:bg-slate-800/70">
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Liabilities + equity
                </p>
                <p className="mt-2 break-words text-xl font-extrabold tabular-nums text-blue-700 dark:text-blue-300">
                  {formatAmount(liabilitiesAndEquity)}
                </p>
              </div>
            </div>
          </div>

          <div
            className={`relative overflow-hidden rounded-2xl p-6 text-white shadow-lg ${
              isBalanced
                ? "bg-gradient-to-br from-emerald-600 via-emerald-600 to-teal-700 shadow-emerald-900/10"
                : "bg-gradient-to-br from-rose-600 via-rose-600 to-red-700 shadow-rose-900/10"
            }`}
          >
            <div className="absolute -right-8 -top-8 h-36 w-36 rounded-full border-[22px] border-white/10" />
            <div className="absolute -bottom-12 -left-10 h-40 w-40 rounded-full bg-white/5 blur-xl" />

            <div className="relative">
              <div className="flex items-center justify-between gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-white/20 bg-white/10">
                  {isBalanced ? (
                    <BadgeCheck size={24} />
                  ) : (
                    <AlertCircle size={24} />
                  )}
                </div>

                <span className="rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-xs font-bold">
                  {isBalanced ? "Balanced" : "Review needed"}
                </span>
              </div>

              <p className="mt-6 text-sm font-medium text-white/80">
                Balance verification
              </p>

              <h2 className="mt-2 text-2xl font-extrabold tracking-tight">
                {isBalanced ? "Books are balanced" : "Difference detected"}
              </h2>

              <p className="mt-3 text-sm leading-6 text-white/85">
                {isBalanced
                  ? "Total assets match liabilities plus equity within the configured 0.01 tolerance."
                  : "Assets do not currently match liabilities plus equity. Review the balances and accounting entries."}
              </p>

              <div className="mt-6 rounded-xl border border-white/15 bg-white/10 p-4 backdrop-blur">
                <p className="text-xs font-semibold text-white/80">
                  Balance difference
                </p>
                <p className="mt-1 break-words text-2xl font-extrabold tabular-nums">
                  {formatCurrency(difference)}
                </p>
              </div>

              <div className="mt-4 flex items-center gap-2 text-xs font-semibold text-white/90">
                {isBalanced ? (
                  <CheckCircle2 size={16} />
                ) : (
                  <AlertCircle size={16} />
                )}
                <span>
                  {isBalanced
                    ? "Accounting equation verified"
                    : "Please investigate the discrepancy"}
                </span>
              </div>
            </div>
          </div>
        </section>

        {/* Account search and breakdown */}
        <section className="space-y-4">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="text-xl font-extrabold text-slate-900 dark:text-white">
                Account breakdown
              </h2>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                Browse the balances for each account category.
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
                aria-label="Search Balance Sheet accounts"
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
            <div className="grid gap-5 xl:grid-cols-2">
              <LoadingSection />
              <LoadingSection />
              <LoadingSection />
            </div>
          ) : (
            <div className="grid items-start gap-5 xl:grid-cols-2">
              <AccountSection
                title="Assets"
                subtitle="Resources owned by the business"
                accounts={assets}
                total={totalAssets}
                color="green"
                search={search}
              />

              <AccountSection
                title="Liabilities"
                subtitle="Obligations owed by the business"
                accounts={liabilities}
                total={totalLiabilities}
                color="blue"
                search={search}
              />

              <div className="xl:col-span-2">
                <AccountSection
                  title="Equity"
                  subtitle="Owner's equity and retained earnings, including reported profit"
                  accounts={equity}
                  total={totalEquity}
                  color="violet"
                  search={search}
                />
              </div>
            </div>
          )}
        </section>

        {/* Accounting equation */}
        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900">
          <div className="border-b border-slate-200 p-5 dark:border-slate-700">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300">
                <ArrowLeftRight size={21} />
              </div>

              <div>
                <h2 className="font-bold text-slate-900 dark:text-white">
                  Accounting equation
                </h2>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                  Assets = Liabilities + Equity
                </p>
              </div>
            </div>
          </div>

          <div className="grid gap-4 p-5 md:grid-cols-3 md:items-center">
            <div className="rounded-xl bg-emerald-50 p-4 dark:bg-emerald-500/10">
              <p className="text-xs font-semibold uppercase tracking-wider text-emerald-700 dark:text-emerald-300">
                Assets
              </p>
              <p className="mt-2 break-words text-xl font-extrabold tabular-nums text-emerald-800 dark:text-emerald-200">
                {formatAmount(totalAssets)}
              </p>
            </div>

            <div className="rounded-xl bg-blue-50 p-4 dark:bg-blue-500/10">
              <p className="text-xs font-semibold uppercase tracking-wider text-blue-700 dark:text-blue-300">
                Liabilities + Equity
              </p>
              <p className="mt-2 break-words text-xl font-extrabold tabular-nums text-blue-800 dark:text-blue-200">
                {formatAmount(liabilitiesAndEquity)}
              </p>
            </div>

            <div
              className={`rounded-xl p-4 ${
                isBalanced
                  ? "bg-emerald-50 dark:bg-emerald-500/10"
                  : "bg-rose-50 dark:bg-rose-500/10"
              }`}
            >
              <p
                className={`text-xs font-semibold uppercase tracking-wider ${
                  isBalanced
                    ? "text-emerald-700 dark:text-emerald-300"
                    : "text-rose-700 dark:text-rose-300"
                }`}
              >
                Difference
              </p>
              <p
                className={`mt-2 break-words text-xl font-extrabold tabular-nums ${
                  isBalanced
                    ? "text-emerald-800 dark:text-emerald-200"
                    : "text-rose-800 dark:text-rose-200"
                }`}
              >
                {formatAmount(difference)}
              </p>
            </div>
          </div>
        </section>

        {/* Footer */}
        <footer className="flex flex-col gap-2 border-t border-slate-200 pt-5 text-xs text-slate-500 dark:border-slate-800 dark:text-slate-400 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-100 text-blue-700 dark:bg-blue-500/10 dark:text-blue-300">
              <FileSpreadsheet size={16} />
            </div>

            <span>
              Balance Sheet Report
              <span className="mx-2 text-slate-300 dark:text-slate-700">
                |
              </span>
              PKR
            </span>
          </div>

          <div className="flex items-center gap-2">
            <Layers3 size={14} />
            <span>
              {assets.length} asset accounts · {liabilities.length} liability
              accounts · {equity.length} equity accounts
            </span>
          </div>
        </footer>
      </div>
    </main>
  );
}