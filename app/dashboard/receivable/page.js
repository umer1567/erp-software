"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Activity,
  AlertCircle,
  ArrowDownRight,
  ArrowUpRight,
  CheckCircle2,
  CircleDollarSign,
  Clock,
  Download,
  RefreshCw,
  Search,
  SlidersHorizontal,
  Users,
  Wallet,
  X,
  RotateCcw,
  FileText,
  UserRound,
  TrendingUp,
  Landmark,
  ShieldAlert,
  Eye,
} from "lucide-react";

const PERMISSIONS_URL = "/api/permissions/current";
const RECEIVABLES_URL = "/api/receivable";
const PERMISSION_KEY = "receivable";

const cardClass =
  "rounded-2xl border border-slate-200 bg-white shadow-sm transition-colors dark:border-slate-800 dark:bg-slate-900";

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

function formatAmount(value) {
  const amount = Number(value ?? 0);

  return (Number.isFinite(amount) ? amount : 0).toLocaleString("en-PK", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function formatCount(value) {
  return Number(value || 0).toLocaleString("en-PK");
}

function StatCard({ title, value, subtitle, icon: Icon, tone }) {
  const tones = {
    blue: {
      icon: "bg-blue-50 text-blue-600 ring-blue-100 dark:bg-blue-500/10 dark:text-blue-400 dark:ring-blue-500/20",
      bar: "from-blue-600 to-cyan-400",
      glow: "bg-blue-500/5 dark:bg-blue-400/5",
    },
    green: {
      icon: "bg-emerald-50 text-emerald-600 ring-emerald-100 dark:bg-emerald-500/10 dark:text-emerald-400 dark:ring-emerald-500/20",
      bar: "from-emerald-500 to-green-400",
      glow: "bg-emerald-500/5 dark:bg-emerald-400/5",
    },
    violet: {
      icon: "bg-violet-50 text-violet-600 ring-violet-100 dark:bg-violet-500/10 dark:text-violet-400 dark:ring-violet-500/20",
      bar: "from-violet-500 to-blue-400",
      glow: "bg-violet-500/5 dark:bg-violet-400/5",
    },
    amber: {
      icon: "bg-amber-50 text-amber-600 ring-amber-100 dark:bg-amber-500/10 dark:text-amber-400 dark:ring-amber-500/20",
      bar: "from-amber-500 to-orange-400",
      glow: "bg-amber-500/5 dark:bg-amber-400/5",
    },
  };

  const style = tones[tone] || tones.blue;

  return (
    <div className="group relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition duration-300 hover:-translate-y-0.5 hover:shadow-lg dark:border-slate-800 dark:bg-slate-900 sm:p-6">
      <div
        className={`pointer-events-none absolute -right-8 -top-8 h-28 w-28 rounded-full blur-2xl ${style.glow}`}
      />

      <div
        className={`absolute inset-x-0 top-0 h-1 bg-gradient-to-r ${style.bar}`}
      />

      <div className="relative flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
            {title}
          </p>

          <p className="mt-3 break-words text-2xl font-bold tracking-tight text-slate-900 dark:text-white sm:text-3xl">
            {value}
          </p>

          <p className="mt-2 text-xs leading-5 text-slate-500 dark:text-slate-400">
            {subtitle}
          </p>
        </div>

        <div
          className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl ring-1 ${style.icon}`}
        >
          <Icon size={23} strokeWidth={2} />
        </div>
      </div>
    </div>
  );
}

function Notice({ type, message, onDismiss, onRetry }) {
  if (!message) return null;

  const success = type === "success";

  return (
    <div
      role={success ? "status" : "alert"}
      className={`flex items-start gap-3 rounded-2xl border p-4 ${
        success
          ? "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900/70 dark:bg-emerald-950/30 dark:text-emerald-300"
          : "border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-900/70 dark:bg-rose-950/30 dark:text-rose-300"
      }`}
    >
      <div className="mt-0.5 shrink-0">
        {success ? (
          <CheckCircle2 size={19} />
        ) : (
          <AlertCircle size={19} />
        )}
      </div>

      <p className="flex-1 text-sm font-medium leading-6">{message}</p>

      {!success && onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="rounded-lg px-2 py-1 text-xs font-bold underline underline-offset-2"
        >
          Retry
        </button>
      )}

      <button
        type="button"
        onClick={onDismiss}
        aria-label="Dismiss notification"
        className="rounded-lg p-1 transition hover:bg-black/5 dark:hover:bg-white/10"
      >
        <X size={17} />
      </button>
    </div>
  );
}

function AccessDenied({ loading, error, onRetry }) {
  return (
    <div className="flex min-h-[70vh] items-center justify-center bg-slate-50 p-4 dark:bg-slate-950">
      <div className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-xl dark:border-slate-800 dark:bg-slate-900">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-rose-50 text-rose-600 dark:bg-rose-500/10 dark:text-rose-400">
          {loading ? (
            <RefreshCw size={30} className="animate-spin" />
          ) : (
            <ShieldAlert size={30} />
          )}
        </div>

        <h1 className="mt-5 text-xl font-bold text-slate-900 dark:text-white">
          {loading
            ? "Checking permissions"
            : error
              ? "Unable to verify permissions"
              : "Access Denied"}
        </h1>

        <p className="mt-3 text-sm leading-6 text-slate-500 dark:text-slate-400">
          {loading
            ? "Please wait while we verify your Receivable access."
            : error
              ? "Your Receivable permissions could not be loaded. Retry before accessing this page."
              : "You do not have permission to view Receivables. Contact your administrator if you need access."}
        </p>

        {(error || !loading) && (
          <button
            type="button"
            onClick={onRetry}
            disabled={loading}
            className="mt-6 inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <RefreshCw
              size={16}
              className={loading ? "animate-spin" : ""}
            />
            Retry Permissions
          </button>
        )}
      </div>
    </div>
  );
}

export default function ReceivablePage() {
  const [receivables, setReceivables] = useState([]);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const [search, setSearch] = useState("");
  const [balanceFilter, setBalanceFilter] = useState("OUTSTANDING");

  const [permissionLoading, setPermissionLoading] = useState(true);
  const [permissionError, setPermissionError] = useState(false);

  const [permissions, setPermissions] = useState({
    can_view: false,
    can_create: false,
    can_update: false,
    can_delete: false,
  });

  const permissionControllerRef = useRef(null);
  const dataControllerRef = useRef(null);

  const canView = permissions.can_view;

  /*
   * Load the current user's Receivable permissions.
   *
   * The API is expected to return:
   * {
   *   permissions: [
   *     {
   *       permission_key: "receivable",
   *       can_view: true,
   *       can_create: true,
   *       can_update: true,
   *       can_delete: true
   *     }
   *   ]
   * }
   */
  const loadPermissions = useCallback(async () => {
    permissionControllerRef.current?.abort();

    const controller = new AbortController();
    permissionControllerRef.current = controller;

    setPermissionLoading(true);
    setPermissionError(false);

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

      if (!response.ok) {
        throw new Error(
          `Permission request failed (${response.status}).`
        );
      }

      const data = await response.json();

      if (!Array.isArray(data?.permissions)) {
        throw new Error(
          "Invalid permissions response. Expected a permissions array."
        );
      }

      const permission = data.permissions.find(
        (item) =>
          normalizePermissionKey(item.permission_key) ===
          PERMISSION_KEY
      );

      const nextPermissions = permission
        ? {
            can_view: toBoolean(permission.can_view),
            can_create: toBoolean(permission.can_create),
            can_update: toBoolean(permission.can_update),
            can_delete: toBoolean(permission.can_delete),
          }
        : {
            can_view: false,
            can_create: false,
            can_update: false,
            can_delete: false,
          };

      if (controller.signal.aborted) return;

      setPermissions(nextPermissions);
      setPermissionError(false);
      setPermissionLoading(false);

      if (!nextPermissions.can_view) {
        dataControllerRef.current?.abort();
        setReceivables([]);
        setLoading(false);
        setError("");
      }
    } catch (err) {
      if (
        err.name === "AbortError" ||
        controller.signal.aborted
      ) {
        return;
      }

      console.error("Could not load Receivable permissions:", err);

      setPermissions({
        can_view: false,
        can_create: false,
        can_update: false,
        can_delete: false,
      });

      setPermissionError(true);
      setPermissionLoading(false);
      setLoading(false);
    }
  }, []);

  /*
   * Load receivables only when the user has View permission.
   */
  const loadReceivables = useCallback(async () => {
    if (permissionLoading || permissionError || !canView) {
      return [];
    }

    dataControllerRef.current?.abort();

    const controller = new AbortController();
    dataControllerRef.current = controller;

    const response = await fetch(RECEIVABLES_URL, {
      method: "GET",
      credentials: "same-origin",
      cache: "no-store",
      signal: controller.signal,
      headers: {
        Accept: "application/json",
      },
    });

    const data = await response.json();

    if (!response.ok || data?.success === false) {
      throw new Error(
        data?.message || "Failed to load receivables."
      );
    }

    if (controller.signal.aborted) return [];

    const list = Array.isArray(data)
      ? data
      : Array.isArray(data?.receivables)
        ? data.receivables
        : [];

    setReceivables(list);

    return list;
  }, [permissionLoading, permissionError, canView]);

  /*
   * Initial permission check.
   */
  useEffect(() => {
  let active = true;

  const initializePermissions = async () => {
    if (!active) return;

    await loadPermissions();
  };

  const handlePermissionsUpdated = () => {
    if (active) {
      void initializePermissions();
    }
  };

  const handleVisibilityChange = () => {
    if (document.visibilityState === "visible" && active) {
      void initializePermissions();
    }
  };

  // Defer initial loading until after the effect has completed.
  const timer = window.setTimeout(() => {
    void initializePermissions();
  }, 0);

  window.addEventListener(
    "erp-permissions-updated",
    handlePermissionsUpdated
  );

  window.addEventListener("focus", handlePermissionsUpdated);

  document.addEventListener(
    "visibilitychange",
    handleVisibilityChange
  );

  return () => {
    active = false;
    window.clearTimeout(timer);

    window.removeEventListener(
      "erp-permissions-updated",
      handlePermissionsUpdated
    );

    window.removeEventListener("focus", handlePermissionsUpdated);

    document.removeEventListener(
      "visibilitychange",
      handleVisibilityChange
    );

    permissionControllerRef.current?.abort();
  };
}, [loadPermissions]);

  /*
   * Load data after permission verification.
   */
  useEffect(() => {
    if (permissionLoading || permissionError) return;

    if (permissionLoading) {
  return (
    <div className="flex min-h-[50vh] items-center justify-center">
      <div className="flex items-center gap-3 text-sm text-slate-600 dark:text-slate-300">
        <RefreshCw className="h-5 w-5 animate-spin" />
        Checking your permissions...
      </div>
    </div>
  );
}

if (!permissions.can_view) {
  return (
    <div className="flex min-h-[50vh] items-center justify-center p-6">
      <div className="w-full max-w-md rounded-2xl border border-rose-200 bg-white p-8 text-center shadow-sm dark:border-rose-900 dark:bg-slate-900">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-rose-100 text-rose-600 dark:bg-rose-950 dark:text-rose-400">
          <AlertCircle className="h-7 w-7" />
        </div>

        <h2 className="text-xl font-bold text-slate-900 dark:text-white">
          Access Denied
        </h2>

        <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-400">
          You do not have permission to view the Receivables page.
          Please contact your administrator if you need access.
        </p>
      </div>
    </div>
  );
}

    let cancelled = false;

    async function initialize() {
      setLoading(true);
      setError("");

      try {
        await loadReceivables();
      } catch (err) {
        if (
          !cancelled &&
          err.name !== "AbortError"
        ) {
          setError(err.message || "Unable to load receivables.");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void initialize();

    return () => {
      cancelled = true;
    };
  }, [
    permissionLoading,
    permissionError,
    canView,
    loadReceivables,
  ]);

  /*
   * Refresh permissions immediately after the User Rights page
   * dispatches the erp-permissions-updated event.
   */
  useEffect(() => {
    function handlePermissionsUpdated() {
      void loadPermissions();
    }

    function handleFocus() {
      void loadPermissions();
    }

    function handleVisibilityChange() {
      if (document.visibilityState === "visible") {
        void loadPermissions();
      }
    }

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

  const summary = useMemo(() => {
    return receivables.reduce(
      (result, customer) => {
        const opening = Number(customer.opening_balance || 0);
        const sales = Number(customer.total_sales || 0);
        const paid = Number(customer.total_paid || 0);
        const outstanding = Math.max(
          Number(customer.receivable) || 0,
          0
        );

        result.opening += Number.isFinite(opening) ? opening : 0;
        result.sales += Number.isFinite(sales) ? sales : 0;
        result.paid += Number.isFinite(paid) ? paid : 0;
        result.outstanding += outstanding;

        if (outstanding > 0) {
          result.outstandingCustomers += 1;
        } else {
          result.settledCustomers += 1;
        }

        return result;
      },
      {
        opening: 0,
        sales: 0,
        paid: 0,
        outstanding: 0,
        outstandingCustomers: 0,
        settledCustomers: 0,
      }
    );
  }, [receivables]);

  const filteredReceivables = useMemo(() => {
    const query = search.trim().toLowerCase();

    return receivables.filter((customer) => {
      const balance = Number(customer.receivable) || 0;

      const matchesBalance =
        balanceFilter === "ALL" ||
        (balanceFilter === "OUTSTANDING" && balance > 0) ||
        (balanceFilter === "SETTLED" && balance <= 0);

      const searchableText = [
        customer.customer_code,
        customer.customer_name,
        customer.customer_id,
      ]
        .filter((value) => value !== null && value !== undefined)
        .join(" ")
        .toLowerCase();

      return matchesBalance && (!query || searchableText.includes(query));
    });
  }, [receivables, search, balanceFilter]);

  const handleRefresh = useCallback(async () => {
    if (permissionLoading || permissionError || !canView) {
      await loadPermissions();
      return;
    }

    setRefreshing(true);
    setError("");

    try {
      await loadReceivables();
    } catch (err) {
      if (err.name !== "AbortError") {
        setError(err.message || "Unable to refresh receivables.");
      }
    } finally {
      setRefreshing(false);
      setLoading(false);
    }
  }, [
    permissionLoading,
    permissionError,
    canView,
    loadPermissions,
    loadReceivables,
  ]);

  function resetFilters() {
    setSearch("");
    setBalanceFilter("OUTSTANDING");
  }

  function exportCsv() {
    /*
     * Export is a read/download operation. Require View permission.
     */
    if (!canView || permissionLoading || permissionError) {
      return;
    }

    const headers = [
      "Customer Code",
      "Customer Name",
      "Opening Balance",
      "Total Sales",
      "Total Paid",
      "Receivable",
    ];

    const escapeCsv = (value) => {
      const text = String(value ?? "");
      return `"${text.replace(/"/g, '""')}"`;
    };

    const rows = filteredReceivables.map((customer) => [
      customer.customer_code,
      customer.customer_name,
      Number(customer.opening_balance || 0).toFixed(2),
      Number(customer.total_sales || 0).toFixed(2),
      Number(customer.total_paid || 0).toFixed(2),
      Number(customer.receivable || 0).toFixed(2),
    ]);

    const csv = [headers, ...rows]
      .map((row) => row.map(escapeCsv).join(","))
      .join("\r\n");

    const blob = new Blob(["\uFEFF" + csv], {
      type: "text/csv;charset=utf-8;",
    });

    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = `receivables-${new Date()
      .toISOString()
      .slice(0, 10)}.csv`;

    document.body.appendChild(link);
    link.click();
    link.remove();

    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  const hasFilters =
    search.trim() !== "" || balanceFilter !== "OUTSTANDING";

  /*
   * Do not render customer information until View permission
   * has been successfully checked.
   */
  if (permissionLoading || permissionError || !canView) {
    return (
      <AccessDenied
        loading={permissionLoading}
        error={permissionError}
        onRetry={loadPermissions}
      />
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 p-4 text-slate-900 transition-colors dark:bg-slate-950 dark:text-slate-100 sm:p-6 lg:p-8">
      <div className="mx-auto max-w-[1600px] space-y-6">
        {/* HERO HEADER */}
        <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-blue-700 via-blue-600 to-emerald-600 p-6 text-white shadow-xl shadow-blue-900/10 sm:p-8">
          <div className="pointer-events-none absolute -right-12 -top-20 h-64 w-64 rounded-full border-[32px] border-white/10" />
          <div className="pointer-events-none absolute -bottom-24 right-1/3 h-52 w-52 rounded-full bg-emerald-300/10 blur-3xl" />

          <div className="relative flex flex-col justify-between gap-6 lg:flex-row lg:items-center">
            <div className="flex items-start gap-4">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-white/20 bg-white/15 shadow-inner backdrop-blur-sm sm:h-16 sm:w-16">
                <Wallet size={30} strokeWidth={1.8} />
              </div>

              <div>
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <span className="rounded-full border border-white/20 bg-white/15 px-3 py-1 text-xs font-semibold tracking-wide">
                    ACCOUNTING
                  </span>

                  <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-300/20 px-3 py-1 text-xs font-semibold text-emerald-50">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-300" />
                    Customer Balances
                  </span>
                </div>

                <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
                  Receivables
                </h1>

                <p className="mt-2 max-w-xl text-sm leading-6 text-blue-50 sm:text-base">
                  Monitor outstanding customer balances, review sales and
                  payments, and keep track of money owed to your business.
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={handleRefresh}
                disabled={refreshing || loading}
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/25 bg-white/10 px-4 py-3 text-sm font-semibold text-white backdrop-blur-sm transition hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <RefreshCw
                  size={17}
                  className={refreshing ? "animate-spin" : ""}
                />
                Refresh
              </button>

              <button
                type="button"
                onClick={exportCsv}
                disabled={filteredReceivables.length === 0 || loading}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-white px-5 py-3 text-sm font-bold text-blue-700 shadow-lg transition hover:-translate-y-0.5 hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <Download size={17} />
                Export CSV
              </button>
            </div>
          </div>

          <div className="relative mt-7 flex flex-wrap items-center gap-x-6 gap-y-3 border-t border-white/20 pt-5 text-sm text-blue-50">
            <div className="flex items-center gap-2">
              <Users size={17} />
              <span>{formatCount(receivables.length)} customers</span>
            </div>

            <div className="flex items-center gap-2">
              <Clock size={17} />
              <span>
                {formatCount(summary.outstandingCustomers)} with outstanding
                balances
              </span>
            </div>

            <div className="flex items-center gap-2">
              <Activity size={17} />
              <span>Customer receivables overview</span>
            </div>
          </div>
        </section>

        {/* ERROR MESSAGE */}
        <Notice
          type="error"
          message={error}
          onDismiss={() => setError("")}
          onRetry={handleRefresh}
        />

        {/* SUMMARY CARDS */}
        <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            title="Total Receivable"
            value={`PKR ${formatAmount(summary.outstanding)}`}
            subtitle="Outstanding balances above zero"
            icon={CircleDollarSign}
            tone="blue"
          />

          <StatCard
            title="Total Customer Sales"
            value={`PKR ${formatAmount(summary.sales)}`}
            subtitle="Sales recorded for listed customers"
            icon={TrendingUp}
            tone="green"
          />

          <StatCard
            title="Total Paid"
            value={`PKR ${formatAmount(summary.paid)}`}
            subtitle="Payments recorded for listed customers"
            icon={ArrowDownRight}
            tone="violet"
          />

          <StatCard
            title="Outstanding Customers"
            value={formatCount(summary.outstandingCustomers)}
            subtitle={`${formatCount(summary.settledCustomers)} customers with zero or negative balances`}
            icon={Users}
            tone="amber"
          />
        </section>

        {/* MAIN TABLE CARD */}
        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
          {/* TABLE TITLE */}
          <div className="flex flex-col justify-between gap-4 border-b border-slate-200 p-5 dark:border-slate-800 sm:p-6 lg:flex-row lg:items-center">
            <div className="flex items-start gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-400">
                <Landmark size={23} />
              </div>

              <div>
                <h2 className="text-lg font-bold text-slate-900 dark:text-white sm:text-xl">
                  Customer Receivables
                </h2>

                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                  Review opening balances, sales, payments, and amounts due.
                </p>
              </div>
            </div>

            <div className="inline-flex w-fit items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm dark:border-slate-700 dark:bg-slate-950">
              <FileText size={16} className="text-slate-500" />

              <span className="text-slate-500 dark:text-slate-400">
                Showing
              </span>

              <span className="font-bold text-slate-900 dark:text-white">
                {filteredReceivables.length}
              </span>
            </div>
          </div>

          {/* SEARCH AND FILTERS */}
          <div className="border-b border-slate-200 bg-slate-50/70 p-5 dark:border-slate-800 dark:bg-slate-950/40 sm:px-6">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
              <div className="relative flex-1">
                <Search
                  size={18}
                  className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
                />

                <input
                  type="search"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search customer code or name..."
                  aria-label="Search customers"
                  className="w-full rounded-xl border border-slate-200 bg-white py-3 pl-10 pr-4 text-sm text-slate-800 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:border-blue-400"
                />
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <span className="mr-1 inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 dark:text-slate-400">
                  <SlidersHorizontal size={15} />
                  Filter
                </span>

                {[
                  { value: "OUTSTANDING", label: "Outstanding" },
                  { value: "ALL", label: "All Customers" },
                  { value: "SETTLED", label: "Settled" },
                ].map((filter) => (
                  <button
                    key={filter.value}
                    type="button"
                    onClick={() => setBalanceFilter(filter.value)}
                    className={`rounded-xl px-4 py-3 text-sm font-semibold transition ${
                      balanceFilter === filter.value
                        ? "bg-blue-600 text-white shadow-sm shadow-blue-600/20"
                        : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
                    }`}
                  >
                    {filter.label}
                  </button>
                ))}

                {hasFilters && (
                  <button
                    type="button"
                    onClick={resetFilters}
                    className="inline-flex items-center gap-1.5 rounded-xl px-3 py-3 text-sm font-semibold text-slate-500 transition hover:bg-slate-200 hover:text-slate-800 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white"
                  >
                    <RotateCcw size={15} />
                    Reset
                  </button>
                )}
              </div>
            </div>

            <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500 dark:text-slate-400">
              <span>
                Showing{" "}
                <strong className="text-slate-700 dark:text-slate-200">
                  {filteredReceivables.length}
                </strong>{" "}
                of{" "}
                <strong className="text-slate-700 dark:text-slate-200">
                  {receivables.length}
                </strong>{" "}
                customers
              </span>

              {hasFilters && (
                <span className="inline-flex items-center gap-1.5">
                  <Search size={13} />
                  Filters applied
                </span>
              )}
            </div>
          </div>

          {/* LOADING STATE */}
          {loading ? (
            <div className="flex min-h-[300px] flex-col items-center justify-center p-10">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-50 dark:bg-blue-500/10">
                <RefreshCw
                  size={25}
                  className="animate-spin text-blue-600 dark:text-blue-400"
                />
              </div>

              <p className="mt-4 font-semibold text-slate-800 dark:text-slate-200">
                Loading receivables
              </p>

              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                Retrieving customer balance information...
              </p>
            </div>
          ) : filteredReceivables.length === 0 ? (
            /* EMPTY STATE */
            <div className="flex min-h-[300px] flex-col items-center justify-center p-8 text-center sm:p-12">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-50 to-emerald-50 text-blue-600 ring-1 ring-blue-100 dark:from-blue-950/50 dark:to-emerald-950/40 dark:text-blue-400 dark:ring-slate-700">
                {hasFilters ? <Search size={28} /> : <Users size={28} />}
              </div>

              <h3 className="mt-5 text-lg font-bold text-slate-900 dark:text-white">
                {hasFilters
                  ? "No matching customers"
                  : "No receivables found"}
              </h3>

              <p className="mt-2 max-w-md text-sm leading-6 text-slate-500 dark:text-slate-400">
                {hasFilters
                  ? "Try another customer name or code, or change the balance filter."
                  : "Customer receivable records will appear here when returned by your API."}
              </p>

              {hasFilters && (
                <button
                  type="button"
                  onClick={resetFilters}
                  className="mt-5 inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
                >
                  <RotateCcw size={16} />
                  Clear Filters
                </button>
              )}

              {!hasFilters && error && (
                <button
                  type="button"
                  onClick={handleRefresh}
                  disabled={refreshing}
                  className="mt-5 inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:opacity-50"
                >
                  <RefreshCw
                    size={16}
                    className={refreshing ? "animate-spin" : ""}
                  />
                  Try Again
                </button>
              )}
            </div>
          ) : (
            /* RECEIVABLES TABLE */
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1000px] text-left text-sm">
                <thead className="bg-slate-100/80 dark:bg-slate-800/70">
                  <tr>
                    <th className="px-5 py-4 text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                      Customer Code
                    </th>

                    <th className="px-5 py-4 text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                      Customer
                    </th>

                    <th className="px-5 py-4 text-right text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                      Opening
                    </th>

                    <th className="px-5 py-4 text-right text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                      Sales
                    </th>

                    <th className="px-5 py-4 text-right text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                      Paid
                    </th>

                    <th className="px-5 py-4 text-right text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                      Receivable
                    </th>

                    <th className="px-5 py-4 text-center text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                      Status
                    </th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {filteredReceivables.map((customer, index) => {
                    const opening = Number(customer.opening_balance || 0);
                    const sales = Number(customer.total_sales || 0);
                    const paid = Number(customer.total_paid || 0);
                    const receivable = Number(customer.receivable || 0);
                    const outstanding = receivable > 0;

                    return (
                      <tr
                        key={
                          customer.customer_id ??
                          `${customer.customer_code}-${index}`
                        }
                        className="group transition-colors hover:bg-blue-50/50 dark:hover:bg-blue-950/20"
                      >
                        <td className="whitespace-nowrap px-5 py-4">
                          <span className="inline-flex items-center rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 font-semibold text-slate-700 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-300">
                            {customer.customer_code || "-"}
                          </span>
                        </td>

                        <td className="px-5 py-4">
                          <div className="flex items-center gap-3">
                            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-blue-100 to-emerald-100 text-blue-700 dark:from-blue-500/20 dark:to-emerald-500/20 dark:text-blue-300">
                              <UserRound size={19} />
                            </div>

                            <div className="min-w-0">
                              <p className="font-bold text-slate-800 dark:text-slate-100">
                                {customer.customer_name || "Unnamed Customer"}
                              </p>

                              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                                Customer ID: {customer.customer_id ?? "-"}
                              </p>
                            </div>
                          </div>
                        </td>

                        <td className="whitespace-nowrap px-5 py-4 text-right">
                          <span className="font-medium tabular-nums text-slate-600 dark:text-slate-300">
                            {formatAmount(opening)}
                          </span>
                        </td>

                        <td className="whitespace-nowrap px-5 py-4 text-right">
                          <span className="font-semibold tabular-nums text-blue-700 dark:text-blue-400">
                            {formatAmount(sales)}
                          </span>
                        </td>

                        <td className="whitespace-nowrap px-5 py-4 text-right">
                          <span className="font-semibold tabular-nums text-emerald-700 dark:text-emerald-400">
                            {formatAmount(paid)}
                          </span>
                        </td>

                        <td className="whitespace-nowrap px-5 py-4 text-right">
                          <span
                            className={`font-bold tabular-nums ${
                              outstanding
                                ? "text-rose-600 dark:text-rose-400"
                                : "text-emerald-700 dark:text-emerald-400"
                            }`}
                          >
                            {formatAmount(receivable)}
                          </span>
                        </td>

                        <td className="whitespace-nowrap px-5 py-4 text-center">
                          <span
                            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold ring-1 ${
                              outstanding
                                ? "bg-amber-50 text-amber-700 ring-amber-200 dark:bg-amber-500/10 dark:text-amber-400 dark:ring-amber-500/20"
                                : "bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-400 dark:ring-emerald-500/20"
                            }`}
                          >
                            {outstanding ? (
                              <ArrowUpRight size={13} />
                            ) : (
                              <CheckCircle2 size={13} />
                            )}

                            {outstanding ? "Outstanding" : "Settled"}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>

                <tfoot className="border-t-2 border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-800/60">
                  <tr>
                    <td
                      colSpan={2}
                      className="px-5 py-4 text-sm font-bold text-slate-800 dark:text-slate-100"
                    >
                      Totals for displayed customers
                    </td>

                    <td className="whitespace-nowrap px-5 py-4 text-right font-bold tabular-nums text-slate-700 dark:text-slate-200">
                      {formatAmount(
                        filteredReceivables.reduce(
                          (sum, item) =>
                            sum + (Number(item.opening_balance) || 0),
                          0
                        )
                      )}
                    </td>

                    <td className="whitespace-nowrap px-5 py-4 text-right font-bold tabular-nums text-blue-700 dark:text-blue-400">
                      {formatAmount(
                        filteredReceivables.reduce(
                          (sum, item) =>
                            sum + (Number(item.total_sales) || 0),
                          0
                        )
                      )}
                    </td>

                    <td className="whitespace-nowrap px-5 py-4 text-right font-bold tabular-nums text-emerald-700 dark:text-emerald-400">
                      {formatAmount(
                        filteredReceivables.reduce(
                          (sum, item) =>
                            sum + (Number(item.total_paid) || 0),
                          0
                        )
                      )}
                    </td>

                    <td className="whitespace-nowrap px-5 py-4 text-right font-bold tabular-nums text-rose-600 dark:text-rose-400">
                      {formatAmount(
                        filteredReceivables.reduce(
                          (sum, item) =>
                            sum + Math.max(Number(item.receivable) || 0, 0),
                          0
                        )
                      )}
                    </td>

                    <td className="px-5 py-4 text-center text-xs font-semibold text-slate-500 dark:text-slate-400">
                      {filteredReceivables.length} shown
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}

          {!loading && filteredReceivables.length > 0 && (
            <div className="flex flex-col justify-between gap-2 border-t border-slate-200 bg-white px-5 py-4 text-xs text-slate-500 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400 sm:flex-row sm:items-center sm:px-6">
              <p>
                Displaying {filteredReceivables.length} of{" "}
                {receivables.length} customers.
              </p>

              <p className="inline-flex items-center gap-1.5">
                <CheckCircle2
                  size={14}
                  className="text-emerald-600 dark:text-emerald-400"
                />
                Customer balances are based on the API response.
              </p>
            </div>
          )}
        </section>

        {!loading && receivables.length > 0 && (
          <section className="flex flex-col gap-4 rounded-2xl border border-blue-100 bg-gradient-to-r from-blue-50 to-emerald-50 p-5 dark:border-slate-800 dark:from-blue-950/30 dark:to-emerald-950/20 sm:flex-row sm:items-center">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-white text-blue-600 shadow-sm dark:bg-slate-900 dark:text-blue-400">
              <CircleDollarSign size={24} />
            </div>

            <div className="flex-1">
              <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100">
                Keep track of customer outstanding balances
              </h3>

              <p className="mt-1 text-sm leading-6 text-slate-500 dark:text-slate-400">
                Search by customer name or code, filter settled and
                outstanding accounts, and export the displayed results to CSV
                for further analysis.
              </p>
            </div>

            <button
              type="button"
              onClick={exportCsv}
              disabled={filteredReceivables.length === 0}
              className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Download size={16} />
              Export Results
            </button>
          </section>
        )}
      </div>
    </div>
  );
}