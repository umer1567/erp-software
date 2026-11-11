"use client";

import { useEffect, useMemo, useState } from "react";
import {
  BookOpenCheck,
  Search,
  RefreshCw,
  Wallet,
  TrendingUp,
  CreditCard,
  ShoppingCart,
  CalendarDays,
  Building2,
  ArrowDownLeft,
  ArrowUpRight,
  CircleDollarSign,
  Filter,
  X,
  CheckCircle2,
  AlertCircle,
  ReceiptText,
  Download,
  Printer,
  ShieldAlert,
  LockKeyhole,
} from "lucide-react";

const PERMISSION_KEY = "vendors_ledger";
const PERMISSIONS_URL = "/api/permissions/current";

const DEFAULT_PERMISSIONS = {
  can_view: false,
  can_create: false,
  can_update: false,
  can_delete: false,
};

const money = (value) =>
  new Intl.NumberFormat("en-PK", {
    style: "currency",
    currency: "PKR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(value || 0));

const dateLabel = (value) => {
  if (!value) return "-";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "-";

  return date.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
};

const inputClass =
  "w-full rounded-xl border border-slate-200 bg-white px-3.5 py-3 text-sm text-slate-800 outline-none transition placeholder:text-slate-400 hover:border-slate-300 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:placeholder:text-slate-500 dark:hover:border-slate-600 dark:focus:border-blue-400 dark:focus:ring-blue-400/10";

const labelClass =
  "mb-2 block text-sm font-semibold text-slate-700 dark:text-slate-300";

// --------------------------------------------------
// PERMISSION HELPERS
// --------------------------------------------------

function normalizePermissionKey(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_");
}

function toBoolean(value) {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value === 1;

  return ["true", "1", "yes", "on", "t"].includes(
    String(value || "").trim().toLowerCase()
  );
}

function extractPermissionList(data) {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.permissions)) return data.permissions;
  if (Array.isArray(data?.data?.permissions)) {
    return data.data.permissions;
  }
  if (Array.isArray(data?.data)) return data.data;
  if (Array.isArray(data?.result?.permissions)) {
    return data.result.permissions;
  }

  return [];
}

function normalizePermissions(permission) {
  if (!permission) return { ...DEFAULT_PERMISSIONS };

  return {
    can_view: toBoolean(
      permission.can_view ?? permission.canView
    ),
    can_create: toBoolean(
      permission.can_create ?? permission.canCreate
    ),
    can_update: toBoolean(
      permission.can_update ?? permission.canUpdate
    ),
    can_delete: toBoolean(
      permission.can_delete ?? permission.canDelete
    ),
  };
}

export default function SupplierLedgerPage() {
  // --------------------------------------------------
  // ALL STATE DECLARATIONS
  // Keep these before effects and callbacks.
  // --------------------------------------------------

  const [permissions, setPermissions] = useState({
    ...DEFAULT_PERMISSIONS,
  });

  const [permissionsLoading, setPermissionsLoading] =
    useState(true);

  const [permissionsError, setPermissionsError] =
    useState(false);

  const [permissionRetry, setPermissionRetry] = useState(0);

  const [suppliers, setSuppliers] = useState([]);
  const [supplierId, setSupplierId] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [ledger, setLedger] = useState(null);

  const [loadingSuppliers, setLoadingSuppliers] =
    useState(true);

  const [loadingLedger, setLoadingLedger] = useState(false);

  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const [transactionSearch, setTransactionSearch] =
    useState("");

  const [transactionType, setTransactionType] =
    useState("all");

  const canView = permissions.can_view;

  // --------------------------------------------------
  // PERMISSION LOADING
  // --------------------------------------------------

  useEffect(() => {
    let active = true;

    async function refreshPermissions() {
      try {
        const response = await fetch(PERMISSIONS_URL, {
          method: "GET",
          credentials: "same-origin",
          cache: "no-store",
          headers: {
            Accept: "application/json",
          },
        });

        const data = await response.json().catch(() => ({}));

        if (!response.ok) {
          throw new Error(
            data.message || "Unable to load user permissions."
          );
        }

        const permissionList = extractPermissionList(data);

        const matchedPermission = permissionList.find(
          (permission) =>
            normalizePermissionKey(
              permission.permission_key ??
                permission.permission_name ??
                permission.key ??
                permission.name
            ) === PERMISSION_KEY
        );

        const nextPermissions =
          normalizePermissions(matchedPermission);

        console.log("[VENDORS LEDGER PERMISSIONS]", {
          expectedKey: PERMISSION_KEY,
          matchedPermission: matchedPermission || null,
          permissions: nextPermissions,
        });

        if (active) {
          setPermissions(nextPermissions);
          setPermissionsError(false);
          setPermissionsLoading(false);
        }
      } catch (err) {
        console.error(
          "Vendors Ledger permission loading failed:",
          err
        );

        if (active) {
          setPermissions({ ...DEFAULT_PERMISSIONS });
          setPermissionsError(true);
          setPermissionsLoading(false);
        }
      }
    }

    // The async function awaits the request before updating state.
    void refreshPermissions();

    function handlePermissionUpdate() {
      setPermissionsLoading(true);
      setPermissionRetry((current) => current + 1);
    }

    function handleFocus() {
      if (document.visibilityState === "visible") {
        setPermissionsLoading(true);
        setPermissionRetry((current) => current + 1);
      }
    }

    window.addEventListener(
      "erp-permissions-updated",
      handlePermissionUpdate
    );

    window.addEventListener("focus", handleFocus);

    document.addEventListener(
      "visibilitychange",
      handleFocus
    );

    return () => {
      active = false;

      window.removeEventListener(
        "erp-permissions-updated",
        handlePermissionUpdate
      );

      window.removeEventListener("focus", handleFocus);

      document.removeEventListener(
        "visibilitychange",
        handleFocus
      );
    };
  }, [permissionRetry]);

  // --------------------------------------------------
  // LOAD SUPPLIERS
  // Only fetch when View permission is granted.
  // --------------------------------------------------

  useEffect(() => {
    if (permissionsLoading || !canView) return;

    const controller = new AbortController();

    async function loadSuppliers() {
      try {
        const response = await fetch("/api/supplier-ledger", {
          method: "GET",
          credentials: "same-origin",
          cache: "no-store",
          signal: controller.signal,
        });

        const data = await response.json();

        if (!response.ok || !data.success) {
          throw new Error(
            data.message || "Could not load suppliers."
          );
        }

        if (!controller.signal.aborted) {
          setSuppliers(data.suppliers || []);
          setError("");
        }
      } catch (err) {
        if (
          err.name === "AbortError" ||
          controller.signal.aborted
        ) {
          return;
        }

        setError(err.message || "Could not load suppliers.");
      } finally {
        if (!controller.signal.aborted) {
          setLoadingSuppliers(false);
        }
      }
    }

    void loadSuppliers();

    return () => {
      controller.abort();
    };
  }, [canView, permissionsLoading]);

  // --------------------------------------------------
  // LEDGER SEARCH
  // --------------------------------------------------

  async function searchLedger(event) {
    event?.preventDefault();

    if (!canView) {
      setError(
        "You do not have permission to view the Vendors Ledger."
      );
      return;
    }

    if (!supplierId) {
      setError(
        "Please select a supplier before viewing the ledger."
      );
      setLedger(null);
      return;
    }

    if (startDate && endDate && startDate > endDate) {
      setError("Start date cannot be after end date.");
      return;
    }

    try {
      setLoadingLedger(true);
      setError("");
      setNotice("");

      const params = new URLSearchParams({ supplierId });

      if (startDate) params.set("startDate", startDate);
      if (endDate) params.set("endDate", endDate);

      const response = await fetch(
        `/api/supplier-ledger?${params.toString()}`,
        {
          method: "GET",
          credentials: "same-origin",
          cache: "no-store",
        }
      );

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(
          data.message || "Could not load supplier ledger."
        );
      }

      setLedger(data);
      setTransactionSearch("");
      setTransactionType("all");
      setNotice("Supplier ledger loaded successfully.");
    } catch (err) {
      setError(
        err.message || "Could not load supplier ledger."
      );
      setLedger(null);
    } finally {
      setLoadingLedger(false);
    }
  }

  // --------------------------------------------------
  // RESET FILTERS
  // --------------------------------------------------

  function resetFilters() {
    setSupplierId("");
    setStartDate("");
    setEndDate("");
    setLedger(null);
    setError("");
    setNotice("");
    setTransactionSearch("");
    setTransactionType("all");
  }

  // --------------------------------------------------
  // QUICK DATE RANGES
  // --------------------------------------------------

  function setDateRange(range) {
    const now = new Date();
    const end = new Date(now);
    const start = new Date(now);

    if (range === "month") {
      start.setDate(1);
    } else if (range === "7days") {
      start.setDate(start.getDate() - 6);
    } else if (range === "30days") {
      start.setDate(start.getDate() - 29);
    }

    const toInputDate = (date) => {
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, "0");
      const day = String(date.getDate()).padStart(2, "0");

      return `${year}-${month}-${day}`;
    };

    setStartDate(toInputDate(start));
    setEndDate(toInputDate(end));
    setLedger(null);
    setNotice("");
    setError("");
  }

  // --------------------------------------------------
  // FILTER TRANSACTIONS
  // --------------------------------------------------

  const summary = ledger?.summary;

  const transactions = useMemo(() => {
    const rows = ledger?.transactions || [];
    const query = transactionSearch.trim().toLowerCase();

    return rows.filter((transaction) => {
      const matchesType =
        transactionType === "all" ||
        String(transaction.transaction_type || "").toLowerCase() ===
          transactionType.toLowerCase();

      const searchableText = [
        transaction.reference,
        transaction.transaction_type,
        transaction.transaction_id,
        transaction.transaction_date,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return matchesType && (!query || searchableText.includes(query));
    });
  }, [ledger, transactionSearch, transactionType]);

  // --------------------------------------------------
  // EXPORT CSV
  // --------------------------------------------------

  function exportCSV() {
    if (!canView || !ledger) return;

    const rows = [
      [
        "Date",
        "Reference",
        "Transaction Type",
        "Debit (PKR)",
        "Credit (PKR)",
        "Balance (PKR)",
      ],
      [
        "",
        "OPENING",
        "Opening Balance",
        "",
        "",
        Number(ledger.openingBalance || 0).toFixed(2),
      ],
      ...transactions.map((transaction) => [
        dateLabel(transaction.transaction_date),
        transaction.reference || "-",
        transaction.transaction_type || "-",
        Number(transaction.debit || 0).toFixed(2),
        Number(transaction.credit || 0).toFixed(2),
        Number(transaction.balance || 0).toFixed(2),
      ]),
    ];

    const csv = rows
      .map((row) =>
        row
          .map((value) =>
            `"${String(value ?? "").replace(/"/g, '""')}"`
          )
          .join(",")
      )
      .join("\r\n");

    const blob = new Blob(["\uFEFF", csv], {
      type: "text/csv;charset=utf-8;",
    });

    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = `supplier-ledger-${supplierId}.csv`;

    document.body.appendChild(link);
    link.click();
    link.remove();

    URL.revokeObjectURL(url);
  }

  // --------------------------------------------------
  // PRINT
  // --------------------------------------------------

  function printLedger() {
    if (!canView || !ledger) return;

    window.print();
  }

  // --------------------------------------------------
  // PERMISSION LOADING SCREEN
  // --------------------------------------------------

  if (permissionsLoading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-100 px-4 dark:bg-[#080f1d]">
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-slate-200 bg-white px-8 py-8 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <RefreshCw
            size={30}
            className="animate-spin text-blue-600"
          />

          <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">
            Checking Vendors Ledger permissions...
          </p>
        </div>
      </main>
    );
  }

  // --------------------------------------------------
  // ACCESS DENIED
  // --------------------------------------------------

  if (!canView) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-100 px-4 py-8 dark:bg-[#080f1d]">
        <section className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-xl dark:border-slate-800 dark:bg-slate-900">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-red-50 text-red-600 dark:bg-red-950/40 dark:text-red-400">
            {permissionsError ? (
              <ShieldAlert size={32} />
            ) : (
              <LockKeyhole size={32} />
            )}
          </div>

          <h1 className="mt-5 text-xl font-bold text-slate-900 dark:text-white">
            {permissionsError
              ? "Unable to Verify Permissions"
              : "Access Denied"}
          </h1>

          <p className="mt-2 text-sm leading-6 text-slate-500 dark:text-slate-400">
            {permissionsError
              ? "The system could not load your permissions. Please try again."
              : "You do not have View permission for the Vendors Ledger. Contact your administrator to request access."}
          </p>

          <button
            type="button"
            onClick={() => {
              setPermissionsLoading(true);
              setPermissionRetry((current) => current + 1);
            }}
            className="mt-6 inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-blue-700"
          >
            <RefreshCw size={16} />
            Retry Permission Check
          </button>
        </section>
      </main>
    );
  }

  // --------------------------------------------------
  // MAIN PAGE
  // --------------------------------------------------

  return (
    <main className="min-h-screen bg-slate-100 px-3 py-5 transition-colors sm:px-5 sm:py-7 lg:px-8 dark:bg-[#080f1d]">
      <div className="mx-auto max-w-[1600px] space-y-6">
        {/* PAGE HEADER */}
        <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#0f172a] via-[#122b49] to-[#075b52] p-6 text-white shadow-xl shadow-slate-900/10 sm:p-8">
          <div className="pointer-events-none absolute -right-12 -top-20 h-64 w-64 rounded-full bg-sky-400/10 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-24 right-1/3 h-52 w-52 rounded-full bg-emerald-400/10 blur-3xl" />

          <div className="relative flex flex-col gap-6 xl:flex-row xl:items-center xl:justify-between">
            <div className="flex items-start gap-4">
              <div className="rounded-2xl border border-white/15 bg-white/10 p-3.5 shadow-lg backdrop-blur-sm">
                <BookOpenCheck size={30} strokeWidth={1.8} />
              </div>

              <div>
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <span className="rounded-full border border-emerald-300/25 bg-emerald-400/10 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.16em] text-emerald-200">
                    Accounting
                  </span>

                  <span className="rounded-full border border-sky-300/25 bg-sky-400/10 px-3 py-1 text-[11px] font-semibold text-sky-100">
                    Supplier Management
                  </span>
                </div>

                <h1 className="text-2xl font-bold tracking-tight sm:text-3xl lg:text-4xl">
                  Supplier Ledger
                </h1>

                <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-300 sm:text-base">
                  Track supplier purchases, payments, and outstanding
                  balances in one organized financial statement.
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              {ledger && (
                <>
                  <button
                    type="button"
                    onClick={exportCSV}
                    className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/15 bg-white/10 px-4 py-3 text-sm font-semibold text-white transition hover:bg-white/20"
                  >
                    <Download size={17} />
                    Export CSV
                  </button>

                  <button
                    type="button"
                    onClick={printLedger}
                    className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-400 px-4 py-3 text-sm font-bold text-emerald-950 shadow-lg shadow-emerald-950/10 transition hover:bg-emerald-300"
                  >
                    <Printer size={17} />
                    Print Ledger
                  </button>
                </>
              )}

              <button
                type="button"
                onClick={resetFilters}
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/20 bg-white/5 px-4 py-3 text-sm font-semibold text-white transition hover:bg-white/15"
              >
                <RefreshCw size={16} />
                Reset
              </button>
            </div>
          </div>

          <div className="relative mt-7 grid grid-cols-1 gap-3 border-t border-white/10 pt-5 sm:grid-cols-3">
            <HeaderDetail
              icon={Building2}
              label="Suppliers Available"
              value={loadingSuppliers ? "Loading..." : suppliers.length}
            />

            <HeaderDetail
              icon={CalendarDays}
              label="Reporting Period"
              value={
                startDate || endDate
                  ? `${startDate || "Beginning"} → ${endDate || "Today"}`
                  : "All dates"
              }
            />

            <HeaderDetail
              icon={ReceiptText}
              label="Statement Status"
              value={ledger ? "Generated" : "Awaiting filters"}
            />
          </div>
        </section>

        {/* NOTIFICATIONS */}
        {error && (
          <div
            role="alert"
            className="flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 px-4 py-4 text-sm text-red-800 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-200"
          >
            <AlertCircle className="mt-0.5 shrink-0" size={19} />

            <span>{error}</span>

            <button
              type="button"
              onClick={() => setError("")}
              aria-label="Dismiss error"
              className="ml-auto rounded-lg p-1 transition hover:bg-red-100 dark:hover:bg-red-900/40"
            >
              <X size={16} />
            </button>
          </div>
        )}

        {notice && !error && (
          <div
            role="status"
            className="flex items-center gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800 dark:border-emerald-900/60 dark:bg-emerald-950/30 dark:text-emerald-200"
          >
            <CheckCircle2 size={18} />
            {notice}
          </div>
        )}

        {/* FILTER PANEL */}
        <section className="overflow-hidden rounded-3xl border border-slate-200/80 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center gap-3 border-b border-slate-100 px-5 py-5 sm:px-6 dark:border-slate-800">
            <div className="rounded-xl bg-sky-50 p-2.5 text-sky-700 dark:bg-sky-400/10 dark:text-sky-300">
              <Filter size={21} />
            </div>

            <div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                Ledger Filters
              </h2>

              <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">
                Choose a supplier and reporting period to generate a
                statement.
              </p>
            </div>
          </div>

          <form onSubmit={searchLedger} className="space-y-5 p-5 sm:p-6">
            <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-4">
              <div>
                <label htmlFor="supplier" className={labelClass}>
                  Select Supplier <span className="text-red-500">*</span>
                </label>

                <select
                  id="supplier"
                  value={supplierId}
                  onChange={(event) => {
                    setSupplierId(event.target.value);
                    setLedger(null);
                    setError("");
                    setNotice("");
                  }}
                  required
                  disabled={loadingSuppliers}
                  className={inputClass}
                >
                  <option value="">
                    {loadingSuppliers
                      ? "Loading suppliers..."
                      : "Choose a supplier"}
                  </option>

                  {suppliers.map((supplier) => (
                    <option
                      key={supplier.supplier_id}
                      value={supplier.supplier_id}
                    >
                      {supplier.supplier_code
                        ? `${supplier.supplier_code} - ${supplier.supplier_name}`
                        : supplier.supplier_name}
                    </option>
                  ))}
                </select>

                <p className="mt-1.5 text-xs text-slate-500 dark:text-slate-400">
                  Select the supplier whose transactions you want to review.
                </p>
              </div>

              <div>
                <label htmlFor="startDate" className={labelClass}>
                  From Date
                </label>

                <div className="relative">
                  <CalendarDays
                    size={17}
                    className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
                  />

                  <input
                    id="startDate"
                    type="date"
                    value={startDate}
                    max={endDate || undefined}
                    onChange={(event) => {
                      setStartDate(event.target.value);
                      setLedger(null);
                      setError("");
                    }}
                    className={`${inputClass} pl-10`}
                  />
                </div>
              </div>

              <div>
                <label htmlFor="endDate" className={labelClass}>
                  To Date
                </label>

                <div className="relative">
                  <CalendarDays
                    size={17}
                    className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
                  />

                  <input
                    id="endDate"
                    type="date"
                    value={endDate}
                    min={startDate || undefined}
                    onChange={(event) => {
                      setEndDate(event.target.value);
                      setLedger(null);
                      setError("");
                    }}
                    className={`${inputClass} pl-10`}
                  />
                </div>
              </div>

              <div className="flex items-end">
                <button
                  type="submit"
                  disabled={loadingLedger || loadingSuppliers}
                  className="inline-flex min-h-[46px] w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-sky-500 px-5 py-3 text-sm font-bold text-white shadow-lg shadow-blue-600/20 transition hover:from-blue-700 hover:to-sky-600 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {loadingLedger ? (
                    <RefreshCw size={18} className="animate-spin" />
                  ) : (
                    <Search size={18} />
                  )}

                  {loadingLedger ? "Generating..." : "View Ledger"}
                </button>
              </div>
            </div>

            <div className="flex flex-col gap-3 border-t border-slate-100 pt-4 sm:flex-row sm:items-center sm:justify-between dark:border-slate-800">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Quick date ranges
              </p>

              <div className="flex flex-wrap gap-2">
                <QuickDateButton onClick={() => setDateRange("7days")}>
                  Last 7 days
                </QuickDateButton>

                <QuickDateButton onClick={() => setDateRange("month")}>
                  This month
                </QuickDateButton>

                <QuickDateButton onClick={() => setDateRange("30days")}>
                  Last 30 days
                </QuickDateButton>

                <QuickDateButton
                  onClick={() => {
                    setStartDate("");
                    setEndDate("");
                    setLedger(null);
                    setError("");
                    setNotice("");
                  }}
                >
                  All dates
                </QuickDateButton>
              </div>
            </div>
          </form>
        </section>

        {/* LEDGER CONTENT */}
        {ledger && (
          <>
            {/* SELECTED SUPPLIER */}
            <section className="relative overflow-hidden rounded-3xl border border-emerald-200 bg-gradient-to-r from-white via-emerald-50/70 to-sky-50 p-5 shadow-sm sm:p-6 dark:border-emerald-900/50 dark:from-slate-900 dark:via-emerald-950/30 dark:to-sky-950/30">
              <div className="pointer-events-none absolute -right-8 -top-16 h-48 w-48 rounded-full bg-emerald-400/10 blur-3xl" />

              <div className="relative flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-start gap-4">
                  <div className="rounded-2xl bg-emerald-100 p-3.5 text-emerald-700 dark:bg-emerald-400/10 dark:text-emerald-300">
                    <Building2 size={27} />
                  </div>

                  <div>
                    <p className="text-xs font-bold uppercase tracking-[0.16em] text-emerald-700 dark:text-emerald-300">
                      Selected Supplier
                    </p>

                    <h2 className="mt-1 text-xl font-bold text-slate-900 sm:text-2xl dark:text-white">
                      {ledger.supplier?.supplier_name || "Supplier"}
                    </h2>

                    <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
                      <span className="rounded-lg border border-slate-200 bg-white/80 px-2.5 py-1 font-medium dark:border-slate-700 dark:bg-slate-800">
                        Code: {ledger.supplier?.supplier_code || "-"}
                      </span>

                      <span className="rounded-lg border border-slate-200 bg-white/80 px-2.5 py-1 dark:border-slate-700 dark:bg-slate-800">
                        {ledger.transactions?.length || 0} transactions
                      </span>
                    </div>
                  </div>
                </div>

                <div className="min-w-0 rounded-2xl border border-emerald-200/80 bg-white/80 p-4 sm:min-w-[230px] dark:border-emerald-800/50 dark:bg-slate-900/70">
                  <div className="flex items-center gap-2 text-sm font-medium text-slate-500 dark:text-slate-400">
                    <CircleDollarSign size={17} />
                    Closing Balance
                  </div>

                  <p className="mt-2 break-words text-2xl font-extrabold tracking-tight text-emerald-700 sm:text-3xl dark:text-emerald-300">
                    {money(summary?.closingBalance)}
                  </p>

                  <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                    Reporting currency: PKR
                  </p>
                </div>
              </div>
            </section>

            {/* SUMMARY CARDS */}
            <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <SummaryCard
                title="Opening Balance"
                value={money(ledger.openingBalance)}
                subtitle="Balance at the start"
                icon={Wallet}
                theme="blue"
              />

              <SummaryCard
                title="Total Purchases"
                value={money(summary?.totalPurchases)}
                subtitle="Purchases recorded"
                icon={ShoppingCart}
                theme="sky"
              />

              <SummaryCard
                title="Total Payments"
                value={money(summary?.totalPayments)}
                subtitle="Payments recorded"
                icon={CreditCard}
                theme="green"
              />

              <SummaryCard
                title="Closing Balance"
                value={money(summary?.closingBalance)}
                subtitle="Balance at period end"
                icon={TrendingUp}
                theme="dark"
              />
            </section>

            {/* TRANSACTIONS TABLE */}
            <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <div className="flex flex-col gap-4 border-b border-slate-100 p-5 sm:flex-row sm:items-center sm:justify-between sm:px-6 dark:border-slate-800">
                <div className="flex items-start gap-3">
                  <div className="rounded-xl bg-blue-50 p-2.5 text-blue-700 dark:bg-blue-400/10 dark:text-blue-300">
                    <ReceiptText size={21} />
                  </div>

                  <div>
                    <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                      Ledger Transactions
                    </h2>

                    <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                      Showing {transactions.length} of{" "}
                      {ledger.transactions?.length || 0} transactions
                    </p>
                  </div>
                </div>

                <div className="flex flex-col gap-2 sm:flex-row">
                  <div className="relative min-w-0 sm:w-64">
                    <Search
                      size={17}
                      className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
                    />

                    <input
                      type="search"
                      value={transactionSearch}
                      onChange={(event) =>
                        setTransactionSearch(event.target.value)
                      }
                      placeholder="Search reference..."
                      aria-label="Search ledger transactions"
                      className={`${inputClass} pl-10`}
                    />
                  </div>

                  <select
                    value={transactionType}
                    onChange={(event) =>
                      setTransactionType(event.target.value)
                    }
                    aria-label="Filter transaction type"
                    className={`${inputClass} sm:w-44`}
                  >
                    <option value="all">All transactions</option>
                    <option value="purchase">Purchases</option>
                    <option value="payment">Payments</option>
                  </select>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full min-w-[900px] text-left text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50/90 text-[11px] uppercase tracking-[0.12em] text-slate-500 dark:border-slate-800 dark:bg-slate-950/70 dark:text-slate-400">
                      <th className="px-5 py-4 font-bold">Date</th>
                      <th className="px-5 py-4 font-bold">Reference</th>
                      <th className="px-5 py-4 font-bold">Transaction</th>
                      <th className="px-5 py-4 text-right font-bold">Debit</th>
                      <th className="px-5 py-4 text-right font-bold">Credit</th>
                      <th className="px-5 py-4 text-right font-bold">Balance</th>
                    </tr>
                  </thead>

                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    <tr className="bg-sky-50/70 dark:bg-sky-950/20">
                      <td className="whitespace-nowrap px-5 py-4 text-slate-500 dark:text-slate-400">
                        -
                      </td>

                      <td className="px-5 py-4">
                        <span className="inline-flex items-center gap-2 font-bold text-blue-700 dark:text-blue-300">
                          <span className="h-2 w-2 rounded-full bg-blue-500" />
                          OPENING
                        </span>
                      </td>

                      <td className="px-5 py-4 font-medium text-slate-800 dark:text-slate-200">
                        Opening Balance
                      </td>

                      <td className="px-5 py-4 text-right text-slate-400">
                        -
                      </td>

                      <td className="px-5 py-4 text-right text-slate-400">
                        -
                      </td>

                      <td className="whitespace-nowrap px-5 py-4 text-right font-bold tabular-nums text-blue-700 dark:text-blue-300">
                        {money(ledger.openingBalance)}
                      </td>
                    </tr>

                    {transactions.map((transaction, index) => {
                      const isPurchase =
                        String(
                          transaction.transaction_type || ""
                        ).toLowerCase() === "purchase";

                      return (
                        <tr
                          key={`${transaction.transaction_type}-${transaction.transaction_id}-${index}`}
                          className="transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/50"
                        >
                          <td className="whitespace-nowrap px-5 py-4 text-slate-600 dark:text-slate-300">
                            {dateLabel(transaction.transaction_date)}
                          </td>

                          <td className="whitespace-nowrap px-5 py-4">
                            <span className="font-semibold text-slate-800 dark:text-slate-200">
                              {transaction.reference || "-"}
                            </span>
                          </td>

                          <td className="px-5 py-4">
                            <span
                              className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-bold ${
                                isPurchase
                                  ? "border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-900 dark:bg-sky-950/50 dark:text-sky-300"
                                  : "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300"
                              }`}
                            >
                              {isPurchase ? (
                                <ArrowDownLeft size={13} />
                              ) : (
                                <ArrowUpRight size={13} />
                              )}

                              {transaction.transaction_type || "Transaction"}
                            </span>
                          </td>

                          <td className="whitespace-nowrap px-5 py-4 text-right font-medium tabular-nums text-slate-700 dark:text-slate-300">
                            {Number(transaction.debit || 0) !== 0 ? (
                              money(transaction.debit)
                            ) : (
                              <span className="text-slate-400">-</span>
                            )}
                          </td>

                          <td className="whitespace-nowrap px-5 py-4 text-right font-medium tabular-nums text-slate-700 dark:text-slate-300">
                            {Number(transaction.credit || 0) !== 0 ? (
                              money(transaction.credit)
                            ) : (
                              <span className="text-slate-400">-</span>
                            )}
                          </td>

                          <td className="whitespace-nowrap px-5 py-4 text-right font-bold tabular-nums text-slate-900 dark:text-white">
                            {money(transaction.balance)}
                          </td>
                        </tr>
                      );
                    })}

                    {transactions.length === 0 && (
                      <tr>
                        <td colSpan={6} className="px-5 py-14 text-center">
                          <div className="mx-auto flex max-w-sm flex-col items-center">
                            <div className="rounded-2xl bg-slate-100 p-4 text-slate-400 dark:bg-slate-800">
                              <Search size={27} />
                            </div>

                            <p className="mt-3 font-semibold text-slate-800 dark:text-slate-200">
                              No matching transactions
                            </p>

                            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                              Try another search term or change the transaction
                              filter.
                            </p>
                          </div>
                        </td>
                      </tr>
                    )}
                  </tbody>

                  <tfoot>
                    <tr className="border-t-2 border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-950/70">
                      <td
                        colSpan={3}
                        className="px-5 py-4 font-bold text-slate-800 dark:text-slate-100"
                      >
                        Period Totals
                      </td>

                      <td className="whitespace-nowrap px-5 py-4 text-right font-bold tabular-nums text-sky-700 dark:text-sky-300">
                        {money(summary?.totalPurchases)}
                      </td>

                      <td className="whitespace-nowrap px-5 py-4 text-right font-bold tabular-nums text-emerald-700 dark:text-emerald-300">
                        {money(summary?.totalPayments)}
                      </td>

                      <td className="whitespace-nowrap px-5 py-4 text-right font-extrabold tabular-nums text-slate-900 dark:text-white">
                        {money(summary?.closingBalance)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>

              <div className="flex flex-col gap-2 border-t border-slate-100 px-5 py-4 text-xs text-slate-500 sm:flex-row sm:items-center sm:justify-between dark:border-slate-800 dark:text-slate-400">
                <span>
                  All amounts are displayed in Pakistani Rupees (PKR).
                </span>

                <span>
                  {startDate || endDate
                    ? `Period: ${startDate || "Beginning"} to ${endDate || "Today"}`
                    : "Period: All available dates"}
                </span>
              </div>
            </section>
          </>
        )}

        {/* EMPTY STATE */}
        {!ledger && !loadingLedger && (
          <section className="relative overflow-hidden rounded-3xl border border-dashed border-slate-300 bg-white px-5 py-14 text-center shadow-sm dark:border-slate-700 dark:bg-slate-900 sm:py-20">
            <div className="pointer-events-none absolute left-1/2 top-0 h-40 w-72 -translate-x-1/2 rounded-full bg-sky-100/70 blur-3xl dark:bg-sky-500/5" />

            <div className="relative mx-auto flex max-w-lg flex-col items-center">
              <div className="rounded-3xl border border-sky-100 bg-gradient-to-br from-sky-50 to-emerald-50 p-5 text-sky-700 shadow-sm dark:border-slate-700 dark:from-sky-950/60 dark:to-emerald-950/30 dark:text-sky-300">
                <BookOpenCheck size={39} strokeWidth={1.6} />
              </div>

              <h3 className="mt-5 text-xl font-bold text-slate-900 dark:text-white">
                Your supplier ledger is ready
              </h3>

              <p className="mt-2 max-w-md text-sm leading-6 text-slate-500 dark:text-slate-400">
                Select a supplier, choose an optional date range, and
                generate a detailed statement of purchases, payments, and
                balances.
              </p>

              <div className="mt-6 flex flex-wrap justify-center gap-2">
                <span className="inline-flex items-center gap-2 rounded-full border border-sky-100 bg-sky-50 px-3 py-2 text-xs font-semibold text-sky-700 dark:border-sky-900/60 dark:bg-sky-950/40 dark:text-sky-300">
                  <ShoppingCart size={14} />
                  Purchase history
                </span>

                <span className="inline-flex items-center gap-2 rounded-full border border-emerald-100 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-300">
                  <CreditCard size={14} />
                  Supplier payments
                </span>

                <span className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
                  <TrendingUp size={14} />
                  Running balances
                </span>
              </div>
            </div>
          </section>
        )}

        {/* LOADING OVERLAY */}
        {loadingLedger && (
          <div className="flex items-center justify-center gap-3 rounded-2xl border border-blue-100 bg-blue-50 px-5 py-5 text-sm font-semibold text-blue-800 dark:border-blue-900/50 dark:bg-blue-950/30 dark:text-blue-200">
            <RefreshCw size={19} className="animate-spin" />
            Generating supplier ledger...
          </div>
        )}

        {/* PRINT STYLES */}
        <style jsx global>{`
          @media print {
            body {
              background: #ffffff !important;
              color: #000000 !important;
            }

            body * {
              visibility: hidden !important;
            }

            table,
            table * {
              visibility: visible !important;
            }

            main {
              min-height: 0 !important;
              padding: 0 !important;
              background: #ffffff !important;
            }

            main > div {
              max-width: none !important;
              margin: 0 !important;
            }

            main section {
              box-shadow: none !important;
            }

            button,
            input,
            select,
            form,
            svg,
            .no-print {
              display: none !important;
            }

            table {
              width: 100% !important;
              min-width: 0 !important;
              border-collapse: collapse !important;
            }

            th,
            td {
              padding: 7px !important;
              color: #000000 !important;
              border: 1px solid #d1d5db !important;
              font-size: 10px !important;
              background: #ffffff !important;
            }

            thead {
              display: table-header-group !important;
            }

            tr {
              break-inside: avoid !important;
            }

            @page {
              size: landscape;
              margin: 12mm;
            }
          }
        `}</style>
      </div>
    </main>
  );
}

// --------------------------------------------------
// REUSABLE COMPONENTS
// --------------------------------------------------

function HeaderDetail({ icon: Icon, label, value }) {
  return (
    <div className="flex items-center gap-3">
      <div className="rounded-xl border border-white/10 bg-white/5 p-2.5 text-sky-200">
        <Icon size={18} />
      </div>

      <div className="min-w-0">
        <p className="text-xs font-medium text-slate-400">
          {label}
        </p>

        <p className="mt-0.5 break-words text-sm font-semibold text-white">
          {value}
        </p>
      </div>
    </div>
  );
}

function SummaryCard({
  title,
  value,
  subtitle,
  icon: Icon,
  theme = "blue",
}) {
  const themes = {
    blue: {
      iconBg: "bg-blue-50 dark:bg-blue-400/10",
      iconText: "text-blue-700 dark:text-blue-300",
      accent: "bg-blue-500",
      value: "text-slate-900 dark:text-white",
    },
    sky: {
      iconBg: "bg-sky-50 dark:bg-sky-400/10",
      iconText: "text-sky-700 dark:text-sky-300",
      accent: "bg-sky-500",
      value: "text-slate-900 dark:text-white",
    },
    green: {
      iconBg: "bg-emerald-50 dark:bg-emerald-400/10",
      iconText: "text-emerald-700 dark:text-emerald-300",
      accent: "bg-emerald-500",
      value: "text-emerald-700 dark:text-emerald-300",
    },
    dark: {
      iconBg: "bg-slate-100 dark:bg-slate-700",
      iconText: "text-slate-700 dark:text-slate-200",
      accent: "bg-slate-800 dark:bg-slate-500",
      value: "text-slate-900 dark:text-white",
    },
  };

  const colors = themes[theme] || themes.blue;

  return (
    <div className="group relative overflow-hidden rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm transition duration-200 hover:-translate-y-0.5 hover:shadow-md dark:border-slate-800 dark:bg-slate-900">
      <div
        className={`absolute inset-x-0 top-0 h-1 ${colors.accent}`}
      />

      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
            {title}
          </p>

          <p
            className={`mt-3 break-words text-xl font-extrabold tracking-tight sm:text-2xl ${colors.value}`}
          >
            {value}
          </p>

          <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
            {subtitle}
          </p>
        </div>

        <div
          className={`rounded-xl p-3 ${colors.iconBg} ${colors.iconText}`}
        >
          <Icon size={23} strokeWidth={1.8} />
        </div>
      </div>
    </div>
  );
}

function QuickDateButton({ onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 transition hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:border-blue-700 dark:hover:bg-blue-950/40 dark:hover:text-blue-300"
    >
      {children}
    </button>
  );
}