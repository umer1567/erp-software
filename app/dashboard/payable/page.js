
"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Activity,
  AlertCircle,
  ArrowDownToLine,
  ArrowDownUp,
  Banknote,
  Building2,
  CheckCircle2,
  Clock3,
  FileSpreadsheet,
  LockKeyhole,
  RefreshCw,
  Search,
  TrendingUp,
  Users,
  Wallet,
  ShieldAlert,
} from "lucide-react";

const PERMISSION_URL = "/api/permissions/current";
const PERMISSION_KEY = "payable";

const formatCurrency = (value) =>
  new Intl.NumberFormat("en-PK", {
    style: "currency",
    currency: "PKR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(value) || 0);

const formatNumber = (value) =>
  new Intl.NumberFormat("en-PK", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(value) || 0);

const getPayable = (supplier) =>
  Math.max(Number(supplier.payable) || 0, 0);

const toBoolean = (value) =>
  value === true ||
  value === 1 ||
  value === "1" ||
  String(value).toLowerCase() === "true";

const cardClass =
  "rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md dark:border-slate-700/80 dark:bg-slate-900";

const inputClass =
  "w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-10 pr-4 text-sm text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:border-blue-400";

const buttonClass =
  "inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:border-blue-500/50 dark:hover:bg-blue-500/10 dark:hover:text-blue-300";

function SortableHeader({
  field,
  children,
  align = "left",
  sortBy,
  sortDirection,
  onSort,
}) {
  return (
    <th
      scope="col"
      className={`whitespace-nowrap px-5 py-4 text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 ${
        align === "right" ? "text-right" : "text-left"
      }`}
    >
      <button
        type="button"
        onClick={() => onSort(field)}
        aria-label={`Sort by ${String(children)}`}
        className={`inline-flex items-center gap-1.5 transition hover:text-blue-600 dark:hover:text-blue-400 ${
          align === "right" ? "ml-auto" : ""
        }`}
      >
        {children}
        <ArrowDownUp
          size={13}
          className={
            sortBy === field
              ? "text-blue-600 dark:text-blue-400"
              : "text-slate-400"
          }
        />
        {sortBy === field && (
          <span className="sr-only">
            {sortDirection === "asc"
              ? "Sorted ascending"
              : "Sorted descending"}
          </span>
        )}
      </button>
    </th>
  );
}

function LoadingScreen({ message = "Loading supplier payable balances..." }) {
  return (
    <main className="min-h-[70vh] bg-slate-50 p-4 dark:bg-slate-950 sm:p-6 lg:p-8">
      <div className="mx-auto max-w-[1600px] space-y-6">
        <div className="h-36 animate-pulse rounded-3xl bg-slate-200 dark:bg-slate-800" />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {[1, 2, 3, 4].map((item) => (
            <div
              key={item}
              className="h-32 animate-pulse rounded-2xl bg-slate-200 dark:bg-slate-800"
            />
          ))}
        </div>
        <div className="h-72 animate-pulse rounded-2xl bg-slate-200 dark:bg-slate-800" />
        <p className="text-center text-sm font-medium text-slate-500 dark:text-slate-400">
          {message}
        </p>
      </div>
    </main>
  );
}

function AccessDenied({ onRetry, loading, error }) {
  return (
    <main className="flex min-h-[70vh] items-center justify-center bg-slate-50 p-6 dark:bg-slate-950">
      <div className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-sm dark:border-slate-700 dark:bg-slate-900">
        <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-rose-100 text-rose-600 dark:bg-rose-500/10 dark:text-rose-400">
          {error ? (
            <ShieldAlert size={30} />
          ) : (
            <LockKeyhole size={30} />
          )}
        </div>

        <h2 className="text-xl font-extrabold text-slate-900 dark:text-white">
          {error ? "Unable to verify permissions" : "Access Denied"}
        </h2>

        <p className="mt-3 text-sm leading-6 text-slate-500 dark:text-slate-400">
          {error
            ? error
            : "You do not have permission to view Supplier Payables. Please contact your administrator to request access."}
        </p>

        <button
          type="button"
          onClick={onRetry}
          disabled={loading}
          className="mt-6 inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-3 text-sm font-bold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <RefreshCw
            size={16}
            className={loading ? "animate-spin" : ""}
          />
          {loading ? "Checking..." : "Check Permissions Again"}
        </button>
      </div>
    </main>
  );
}

export default function PayablePage() {
  const [payables, setPayables] = useState([]);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  // User Rights
  const [permissions, setPermissions] = useState({
    can_view: false,
    can_create: false,
    can_update: false,
    can_delete: false,
  });

  const [permissionLoading, setPermissionLoading] = useState(true);
  const [permissionError, setPermissionError] = useState("");

  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState("payable");
  const [sortDirection, setSortDirection] = useState("desc");

  const permissionControllerRef = useRef(null);
  const dataControllerRef = useRef(null);
  const mountedRef = useRef(false);

  // Load supplier payable data.
  const loadPayables = useCallback(async (showRefresh = false) => {
    if (showRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    setError("");

    dataControllerRef.current?.abort();

    const controller = new AbortController();
    dataControllerRef.current = controller;

    try {
      const response = await fetch("/api/payable", {
        method: "GET",
        credentials: "same-origin",
        headers: {
          Accept: "application/json",
        },
        cache: "no-store",
        signal: controller.signal,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.message ||
            data.error ||
            "Failed to load supplier payables."
        );
      }

      if (data.success === false) {
        throw new Error(
          data.message || data.error || "Failed to load payables."
        );
      }

      const records = Array.isArray(data)
        ? data
        : Array.isArray(data.payables)
          ? data.payables
          : [];

      if (!controller.signal.aborted && mountedRef.current) {
        setPayables(records);
      }
    } catch (err) {
      if (
        err.name === "AbortError" ||
        controller.signal.aborted
      ) {
        return;
      }

      if (mountedRef.current) {
        setError(
          err instanceof Error
            ? err.message
            : "Something went wrong while loading payables."
        );
      }
    } finally {
      if (!controller.signal.aborted && mountedRef.current) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, []);

  // Load current user's permissions.
  const loadPermissions = useCallback(async () => {
    permissionControllerRef.current?.abort();

    const controller = new AbortController();
    permissionControllerRef.current = controller;

    if (mountedRef.current) {
      setPermissionLoading(true);
      setPermissionError("");
    }

    try {
      const response = await fetch(PERMISSION_URL, {
        method: "GET",
        credentials: "same-origin",
        cache: "no-store",
        headers: {
          Accept: "application/json",
        },
        signal: controller.signal,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.message ||
            data.error ||
            "Could not verify your permissions."
        );
      }

      if (!Array.isArray(data.permissions)) {
        throw new Error(
          "Invalid permissions response. Expected a permissions array."
        );
      }

      const permission = data.permissions.find(
        (item) =>
          String(item.permission_key || "")
            .trim()
            .toLowerCase() === PERMISSION_KEY
      );

      const nextPermissions = {
        can_view: toBoolean(permission?.can_view),
        can_create: toBoolean(permission?.can_create),
        can_update: toBoolean(permission?.can_update),
        can_delete: toBoolean(permission?.can_delete),
      };

      if (controller.signal.aborted || !mountedRef.current) {
        return;
      }

      setPermissions(nextPermissions);
      setPermissionError("");
      setPermissionLoading(false);

      if (nextPermissions.can_view) {
        await loadPayables();
      } else {
        // Clear data after permission has been verified as denied.
        dataControllerRef.current?.abort();
        setPayables([]);
        setError("");
        setLoading(false);
        setRefreshing(false);
      }
    } catch (err) {
      if (
        err.name === "AbortError" ||
        controller.signal.aborted
      ) {
        return;
      }

      if (mountedRef.current) {
        console.error("Payable permission error:", err);

        // Fail closed: do not display protected data.
        dataControllerRef.current?.abort();
        setPermissions({
          can_view: false,
          can_create: false,
          can_update: false,
          can_delete: false,
        });
        setPayables([]);
        setLoading(false);
        setRefreshing(false);
        setPermissionError(
          err instanceof Error
            ? err.message
            : "Unable to verify your permissions."
        );
        setPermissionLoading(false);
      }
    }
  }, [loadPayables]);

  // Initial permission check and event subscriptions.
  useEffect(() => {
    mountedRef.current = true;

    const timer = window.setTimeout(() => {
      void loadPermissions();
    }, 0);

    const handlePermissionsUpdated = () => {
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
      handlePermissionsUpdated
    );

    window.addEventListener("focus", handleFocus);

    document.addEventListener(
      "visibilitychange",
      handleVisibilityChange
    );

    return () => {
      mountedRef.current = false;
      window.clearTimeout(timer);

      window.removeEventListener(
        "erp-permissions-updated",
        handlePermissionsUpdated
      );

      window.removeEventListener("focus", handleFocus);

      document.removeEventListener(
        "visibilitychange",
        handleVisibilityChange
      );

      permissionControllerRef.current?.abort();
      dataControllerRef.current?.abort();
    };
  }, [loadPermissions]);

  const totals = useMemo(
    () =>
      payables.reduce(
        (result, supplier) => {
          const opening = Number(supplier.opening_balance) || 0;
          const purchases = Number(supplier.total_purchases) || 0;
          const paid = Number(supplier.total_paid) || 0;
          const payable = getPayable(supplier);

          result.opening += opening;
          result.purchases += purchases;
          result.paid += paid;
          result.payable += payable;

          if (payable > 0) {
            result.outstandingSuppliers += 1;
          } else {
            result.settledSuppliers += 1;
          }

          return result;
        },
        {
          opening: 0,
          purchases: 0,
          paid: 0,
          payable: 0,
          outstandingSuppliers: 0,
          settledSuppliers: 0,
        }
      ),
    [payables]
  );

  const filteredPayables = useMemo(() => {
    const query = search.trim().toLowerCase();

    const filtered = payables.filter((supplier) => {
      if (!query) return true;

      return [
        supplier.supplier_code,
        supplier.supplier_name,
        supplier.supplier_id,
      ].some((value) =>
        String(value ?? "").toLowerCase().includes(query)
      );
    });

    return [...filtered].sort((a, b) => {
      if (
        sortBy === "supplier_name" ||
        sortBy === "supplier_code"
      ) {
        const first = String(a[sortBy] ?? "").toLowerCase();
        const second = String(b[sortBy] ?? "").toLowerCase();

        return sortDirection === "asc"
          ? first.localeCompare(second)
          : second.localeCompare(first);
      }

      const first = Number(a[sortBy]) || 0;
      const second = Number(b[sortBy]) || 0;

      return sortDirection === "asc"
        ? first - second
        : second - first;
    });
  }, [payables, search, sortBy, sortDirection]);

  const handleSort = useCallback(
    (field) => {
      if (sortBy === field) {
        setSortDirection((current) =>
          current === "asc" ? "desc" : "asc"
        );
      } else {
        setSortBy(field);
        setSortDirection(
          field === "supplier_name" || field === "supplier_code"
            ? "asc"
            : "desc"
        );
      }
    },
    [sortBy]
  );

  // Export is a read-only operation, so it requires can_view,
  // not can_create, can_update, or can_delete.
  const exportCSV = useCallback(() => {
    if (!permissions.can_view || filteredPayables.length === 0) {
      return;
    }

    const headers = [
      "Supplier Code",
      "Supplier",
      "Opening Balance",
      "Purchases",
      "Paid",
      "Payable",
    ];

    const rows = filteredPayables.map((supplier) => [
      supplier.supplier_code ?? "",
      supplier.supplier_name ?? "",
      Number(supplier.opening_balance) || 0,
      Number(supplier.total_purchases) || 0,
      Number(supplier.total_paid) || 0,
      Number(supplier.payable) || 0,
    ]);

    const escapeCSV = (value) => {
      const text = String(value ?? "");
      return `"${text.replace(/"/g, '""')}"`;
    };

    const csv = [headers, ...rows]
      .map((row) => row.map(escapeCSV).join(","))
      .join("\r\n");

    const blob = new Blob(["\uFEFF" + csv], {
      type: "text/csv;charset=utf-8;",
    });

    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = `supplier-payables-${new Date()
      .toISOString()
      .slice(0, 10)}.csv`;

    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }, [filteredPayables, permissions.can_view]);

  const filteredTotals = useMemo(
    () =>
      filteredPayables.reduce(
        (result, supplier) => {
          result.opening += Number(supplier.opening_balance) || 0;
          result.purchases += Number(supplier.total_purchases) || 0;
          result.paid += Number(supplier.total_paid) || 0;
          result.payable += Number(supplier.payable) || 0;
          return result;
        },
        { opening: 0, purchases: 0, paid: 0, payable: 0 }
      ),
    [filteredPayables]
  );

  // Do not render the protected page until permission verification finishes.
  if (permissionLoading) {
    return <LoadingScreen message="Checking your payable permissions..." />;
  }

  if (permissionError || !permissions.can_view) {
    return (
      <AccessDenied
        error={permissionError}
        loading={permissionLoading}
        onRetry={() => void loadPermissions()}
      />
    );
  }

  if (loading) {
    return <LoadingScreen />;
  }

  return (
    <main className="min-h-screen bg-slate-50/80 p-4 text-slate-800 transition-colors duration-200 dark:bg-slate-950 dark:text-slate-100 sm:p-6 lg:p-8">
      <div className="mx-auto max-w-[1600px] space-y-6">
        {/* Page header */}
        <section className="relative isolate overflow-hidden rounded-3xl bg-gradient-to-br from-blue-700 via-blue-600 to-emerald-600 p-6 text-white shadow-xl shadow-blue-900/10 sm:p-8">
          <div className="pointer-events-none absolute -right-16 -top-24 -z-10 h-72 w-72 rounded-full bg-white/10 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-28 right-1/4 -z-10 h-64 w-64 rounded-full bg-emerald-300/20 blur-3xl" />

          <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-xs font-semibold text-blue-50 backdrop-blur-sm">
                <Activity size={14} />
                ACCOUNTS PAYABLE
              </div>

              <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl">
                Supplier Payables
              </h1>

              <p className="mt-2 max-w-2xl text-sm leading-6 text-blue-50 sm:text-base">
                Monitor outstanding supplier balances, review purchases,
                and track payments from one clear dashboard.
              </p>

              <div className="mt-5 flex flex-wrap items-center gap-3 text-xs font-medium text-white/90 sm:text-sm">
                <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-2">
                  <Building2 size={15} />
                  Supplier account overview
                </span>
                <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-2">
                  <CheckCircle2 size={15} />
                  Live API data
                </span>
              </div>
            </div>

            <div className="flex shrink-0 flex-wrap gap-3">
              <button
                type="button"
                onClick={() => void loadPayables(true)}
                disabled={refreshing}
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/25 bg-white/10 px-4 py-3 text-sm font-bold text-white backdrop-blur-sm transition hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <RefreshCw
                  size={17}
                  className={refreshing ? "animate-spin" : ""}
                />
                {refreshing ? "Refreshing..." : "Refresh"}
              </button>

              <button
                type="button"
                onClick={exportCSV}
                disabled={filteredPayables.length === 0}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-white px-4 py-3 text-sm font-bold text-blue-700 shadow-sm transition hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <ArrowDownToLine size={17} />
                Export CSV
              </button>
            </div>
          </div>
        </section>

        {/* Error notification */}
        {error && (
          <div
            role="alert"
            className="flex flex-col gap-3 rounded-2xl border border-red-200 bg-red-50 p-4 text-red-800 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-300 sm:flex-row sm:items-start sm:justify-between"
          >
            <div className="flex items-start gap-3">
              <AlertCircle className="mt-0.5 shrink-0" size={20} />
              <div>
                <p className="font-bold">Unable to load payables</p>
                <p className="mt-1 text-sm">{error}</p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => void loadPayables()}
              className="inline-flex shrink-0 items-center gap-2 self-start rounded-lg border border-red-200 px-3 py-2 text-sm font-semibold transition hover:bg-red-100 dark:border-red-800 dark:hover:bg-red-900/40"
            >
              <RefreshCw size={14} />
              Try again
            </button>
          </div>
        )}

        {/* Summary cards */}
        <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <div className={cardClass}>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-slate-500 dark:text-slate-400">
                  Total Payable
                </p>
                <p className="mt-3 break-words text-2xl font-extrabold tracking-tight text-slate-900 dark:text-white sm:text-3xl">
                  {formatCurrency(totals.payable)}
                </p>
                <p className="mt-2 flex items-center gap-1.5 text-xs font-medium text-blue-700 dark:text-blue-400">
                  <Wallet size={14} />
                  Outstanding supplier balance
                </p>
              </div>
              <div className="rounded-2xl bg-blue-50 p-3 text-blue-600 dark:bg-blue-500/10 dark:text-blue-400">
                <Banknote size={24} />
              </div>
            </div>
            <div className="mt-5 h-1.5 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
              <div className="h-full w-full rounded-full bg-gradient-to-r from-blue-600 to-blue-400" />
            </div>
          </div>

          <div className={cardClass}>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-slate-500 dark:text-slate-400">
                  Total Purchases
                </p>
                <p className="mt-3 break-words text-2xl font-extrabold tracking-tight text-slate-900 dark:text-white sm:text-3xl">
                  {formatCurrency(totals.purchases)}
                </p>
                <p className="mt-2 flex items-center gap-1.5 text-xs font-medium text-emerald-700 dark:text-emerald-400">
                  <TrendingUp size={14} />
                  Recorded supplier purchases
                </p>
              </div>
              <div className="rounded-2xl bg-emerald-50 p-3 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400">
                <FileSpreadsheet size={24} />
              </div>
            </div>
            <div className="mt-5 h-1.5 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
              <div className="h-full w-full rounded-full bg-gradient-to-r from-emerald-600 to-green-400" />
            </div>
          </div>

          <div className={cardClass}>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-slate-500 dark:text-slate-400">
                  Total Paid
                </p>
                <p className="mt-3 break-words text-2xl font-extrabold tracking-tight text-slate-900 dark:text-white sm:text-3xl">
                  {formatCurrency(totals.paid)}
                </p>
                <p className="mt-2 flex items-center gap-1.5 text-xs font-medium text-emerald-700 dark:text-emerald-400">
                  <CheckCircle2 size={14} />
                  Payments recorded
                </p>
              </div>
              <div className="rounded-2xl bg-green-50 p-3 text-green-600 dark:bg-green-500/10 dark:text-green-400">
                <CheckCircle2 size={24} />
              </div>
            </div>
            <div className="mt-5 h-1.5 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
              <div
                className="h-full rounded-full bg-gradient-to-r from-green-600 to-emerald-400"
                style={{
                  width: `${
                    totals.purchases > 0
                      ? Math.min(
                          100,
                          (totals.paid / totals.purchases) * 100
                        )
                      : 0
                  }%`,
                }}
              />
            </div>
          </div>

          <div className={cardClass}>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-slate-500 dark:text-slate-400">
                  Outstanding Suppliers
                </p>
                <p className="mt-3 text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white">
                  {totals.outstandingSuppliers}
                </p>
                <p className="mt-2 flex items-center gap-1.5 text-xs font-medium text-amber-700 dark:text-amber-400">
                  <Clock3 size={14} />
                  Suppliers with a balance due
                </p>
              </div>
              <div className="rounded-2xl bg-amber-50 p-3 text-amber-600 dark:bg-amber-500/10 dark:text-amber-400">
                <Users size={24} />
              </div>
            </div>
            <div className="mt-5 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
              <span>{totals.settledSuppliers} settled</span>
              <span>{payables.length} total suppliers</span>
            </div>
          </div>
        </section>

        {/* Secondary overview */}
        <section className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <div className="rounded-2xl border border-slate-200/80 bg-white p-5 dark:border-slate-700/80 dark:bg-slate-900">
            <div className="flex items-center gap-3">
              <div className="rounded-xl bg-slate-100 p-2.5 text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                <Banknote size={20} />
              </div>
              <div>
                <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
                  Opening Balance
                </p>
                <p className="mt-1 text-xl font-bold text-slate-900 dark:text-white">
                  {formatCurrency(totals.opening)}
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200/80 bg-white p-5 dark:border-slate-700/80 dark:bg-slate-900">
            <div className="flex items-center gap-3">
              <div className="rounded-xl bg-blue-50 p-2.5 text-blue-600 dark:bg-blue-500/10 dark:text-blue-400">
                <Building2 size={20} />
              </div>
              <div>
                <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
                  Suppliers Listed
                </p>
                <p className="mt-1 text-xl font-bold text-slate-900 dark:text-white">
                  {payables.length}
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200/80 bg-white p-5 dark:border-slate-700/80 dark:bg-slate-900">
            <div className="flex items-center gap-3">
              <div className="rounded-xl bg-emerald-50 p-2.5 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400">
                <CheckCircle2 size={20} />
              </div>
              <div>
                <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
                  Settled Suppliers
                </p>
                <p className="mt-1 text-xl font-bold text-slate-900 dark:text-white">
                  {totals.settledSuppliers}
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Supplier table */}
        <section className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm dark:border-slate-700/80 dark:bg-slate-900">
          <div className="flex flex-col gap-4 border-b border-slate-200 p-5 dark:border-slate-700 sm:p-6 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">
                  Supplier Ledger
                </h2>
                <span className="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-bold text-blue-700 dark:bg-blue-500/10 dark:text-blue-300">
                  {filteredPayables.length} records
                </span>
              </div>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                Review opening balances, purchases, payments, and amounts due.
              </p>
            </div>

            <div className="flex w-full flex-col gap-3 sm:flex-row lg:w-auto">
              <div className="relative min-w-0 flex-1 sm:min-w-[280px]">
                <Search
                  size={18}
                  className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
                />
                <input
                  type="search"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search supplier or code..."
                  aria-label="Search suppliers"
                  className={inputClass}
                />
              </div>

              <button
                type="button"
                onClick={exportCSV}
                disabled={filteredPayables.length === 0}
                className={buttonClass}
              >
                <ArrowDownToLine size={16} />
                Export
              </button>
            </div>
          </div>

          {filteredPayables.length === 0 ? (
            <div className="flex min-h-[300px] flex-col items-center justify-center px-5 py-12 text-center">
              <div className="mb-4 rounded-2xl bg-slate-100 p-4 dark:bg-slate-800">
                {search ? (
                  <Search size={30} className="text-slate-400 dark:text-slate-500" />
                ) : (
                  <Building2 size={30} className="text-slate-400 dark:text-slate-500" />
                )}
              </div>

              <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100">
                {search ? "No matching suppliers" : "No payable records"}
              </h3>

              <p className="mt-2 max-w-md text-sm leading-6 text-slate-500 dark:text-slate-400">
                {search
                  ? "Try a different supplier name, code, or ID."
                  : "Supplier payable information will appear here when records are available."}
              </p>

              {search && (
                <button
                  type="button"
                  onClick={() => setSearch("")}
                  className="mt-4 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700"
                >
                  Clear search
                </button>
              )}
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[950px] border-collapse text-sm">
                  <thead className="bg-slate-50/90 dark:bg-slate-800/60">
                    <tr>
                      <SortableHeader
                        field="supplier_code"
                        sortBy={sortBy}
                        sortDirection={sortDirection}
                        onSort={handleSort}
                      >
                        Supplier Code
                      </SortableHeader>

                      <SortableHeader
                        field="supplier_name"
                        sortBy={sortBy}
                        sortDirection={sortDirection}
                        onSort={handleSort}
                      >
                        Supplier
                      </SortableHeader>

                      <SortableHeader
                        field="opening_balance"
                        align="right"
                        sortBy={sortBy}
                        sortDirection={sortDirection}
                        onSort={handleSort}
                      >
                        Opening
                      </SortableHeader>

                      <SortableHeader
                        field="total_purchases"
                        align="right"
                        sortBy={sortBy}
                        sortDirection={sortDirection}
                        onSort={handleSort}
                      >
                        Purchases
                      </SortableHeader>

                      <SortableHeader
                        field="total_paid"
                        align="right"
                        sortBy={sortBy}
                        sortDirection={sortDirection}
                        onSort={handleSort}
                      >
                        Paid
                      </SortableHeader>

                      <SortableHeader
                        field="payable"
                        align="right"
                        sortBy={sortBy}
                        sortDirection={sortDirection}
                        onSort={handleSort}
                      >
                        Payable
                      </SortableHeader>
                    </tr>
                  </thead>

                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {filteredPayables.map((supplier, index) => {
                      const outstanding = getPayable(supplier) > 0;

                      return (
                        <tr
                          key={
                            supplier.supplier_id ??
                            `${supplier.supplier_code}-${index}`
                          }
                          className="group transition-colors hover:bg-blue-50/50 dark:hover:bg-blue-500/[0.04]"
                        >
                          <td className="whitespace-nowrap px-5 py-4">
                            <span className="inline-flex items-center rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 font-mono text-xs font-bold text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
                              {supplier.supplier_code || "—"}
                            </span>
                          </td>

                          <td className="px-5 py-4">
                            <div className="flex min-w-[190px] items-center gap-3">
                              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-blue-100 to-emerald-100 text-sm font-extrabold text-blue-700 dark:from-blue-500/20 dark:to-emerald-500/20 dark:text-blue-300">
                                {String(supplier.supplier_name || "S")
                                  .trim()
                                  .charAt(0)
                                  .toUpperCase()}
                              </div>

                              <div className="min-w-0">
                                <p className="truncate font-bold text-slate-800 dark:text-slate-100">
                                  {supplier.supplier_name || "Unnamed supplier"}
                                </p>
                                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                                  ID: {supplier.supplier_id ?? "—"}
                                </p>
                              </div>
                            </div>
                          </td>

                          <td className="whitespace-nowrap px-5 py-4 text-right tabular-nums text-slate-600 dark:text-slate-300">
                            {formatNumber(supplier.opening_balance)}
                          </td>

                          <td className="whitespace-nowrap px-5 py-4 text-right font-medium tabular-nums text-slate-700 dark:text-slate-200">
                            {formatNumber(supplier.total_purchases)}
                          </td>

                          <td className="whitespace-nowrap px-5 py-4 text-right font-medium tabular-nums text-emerald-700 dark:text-emerald-400">
                            {formatNumber(supplier.total_paid)}
                          </td>

                          <td className="whitespace-nowrap px-5 py-4 text-right">
                            <div className="flex flex-col items-end gap-1.5">
                              <span
                                className={`font-extrabold tabular-nums ${
                                  outstanding
                                    ? "text-blue-700 dark:text-blue-300"
                                    : "text-emerald-700 dark:text-emerald-400"
                                }`}
                              >
                                {formatNumber(supplier.payable)}
                              </span>

                              <span
                                className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-[10px] font-bold uppercase tracking-wide ${
                                  outstanding
                                    ? "bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300"
                                    : "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300"
                                }`}
                              >
                                {outstanding ? (
                                  <Clock3 size={11} />
                                ) : (
                                  <CheckCircle2 size={11} />
                                )}
                                {outstanding ? "Due" : "Settled"}
                              </span>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>

                  <tfoot className="border-t-2 border-slate-200 bg-slate-50/90 dark:border-slate-700 dark:bg-slate-800/70">
                    <tr>
                      <td
                        colSpan={2}
                        className="px-5 py-4 font-extrabold text-slate-900 dark:text-white"
                      >
                        Total ({filteredPayables.length} suppliers)
                      </td>

                      <td className="whitespace-nowrap px-5 py-4 text-right font-bold tabular-nums text-slate-700 dark:text-slate-200">
                        {formatNumber(filteredTotals.opening)}
                      </td>

                      <td className="whitespace-nowrap px-5 py-4 text-right font-bold tabular-nums text-slate-700 dark:text-slate-200">
                        {formatNumber(filteredTotals.purchases)}
                      </td>

                      <td className="whitespace-nowrap px-5 py-4 text-right font-bold tabular-nums text-emerald-700 dark:text-emerald-400">
                        {formatNumber(filteredTotals.paid)}
                      </td>

                      <td className="whitespace-nowrap px-5 py-4 text-right font-extrabold tabular-nums text-blue-700 dark:text-blue-300">
                        {formatNumber(filteredTotals.payable)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>

              <div className="flex flex-col gap-2 border-t border-slate-200 px-5 py-4 text-xs text-slate-500 dark:border-slate-700 dark:text-slate-400 sm:flex-row sm:items-center sm:justify-between">
                <p>
                  Showing{" "}
                  <span className="font-bold text-slate-700 dark:text-slate-200">
                    {filteredPayables.length}
                  </span>{" "}
                  of{" "}
                  <span className="font-bold text-slate-700 dark:text-slate-200">
                    {payables.length}
                  </span>{" "}
                  supplier records
                </p>

                <p className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-emerald-500" />
                  Amounts displayed in PKR
                </p>
              </div>
            </>
          )}
        </section>

        {/* Footer */}
        <div className="flex flex-col gap-2 px-1 pb-3 text-xs text-slate-500 dark:text-slate-400 sm:flex-row sm:items-center sm:justify-between">
          <p>Accounts Payable · Supplier Balance Overview</p>
          <p className="flex items-center gap-1.5">
            <Activity size={13} />
            Balance information retrieved from your ERP API
          </p>
        </div>
      </div>
    </main>
  );
}
