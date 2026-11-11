"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Activity,
  AlertCircle,
  ArrowRight,
  CalendarDays,
  Clock3,
  FileText,
  Info,
  LoaderCircle,
  LockKeyhole,
  RefreshCw,
  ShieldAlert,
  TrendingUp,
  Users,
  Wallet,
  X,
} from "lucide-react";

const PERMISSIONS_URL = "/api/permissions/current";
const REPORT_URL = "/api/reports/sales";
const PERMISSION_KEY = "sales_dashboard";

const styles = {
  panel:
    "overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm transition-colors dark:border-slate-800 dark:bg-slate-900",

  label:
    "mb-2 block text-sm font-semibold text-slate-700 dark:text-slate-300",

  input:
    "w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:placeholder:text-slate-500",

  primaryButton:
    "inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-blue-700 px-5 py-3 text-sm font-bold text-white shadow-md shadow-blue-600/20 transition hover:-translate-y-0.5 hover:from-blue-500 hover:to-blue-600 focus:outline-none focus:ring-4 focus:ring-blue-500/20 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0",

  secondaryButton:
    "inline-flex items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 focus:outline-none focus:ring-4 focus:ring-slate-500/10 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800",
};

const INITIAL_PERMISSIONS = {
  canView: false,
  canCreate: false,
  canUpdate: false,
  canDelete: false,
};

function toBoolean(value) {
  return (
    value === true ||
    value === 1 ||
    value === "1" ||
    String(value).toLowerCase() === "true"
  );
}

function normalizePermission(permission) {
  if (!permission) {
    return { ...INITIAL_PERMISSIONS };
  }

  return {
    canView: toBoolean(permission.can_view),
    canCreate: toBoolean(permission.can_create),
    canUpdate: toBoolean(permission.can_update),
    canDelete: toBoolean(permission.can_delete),
  };
}

async function readJson(response) {
  const result = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(
      result.message ||
        result.error ||
        `Request failed with status ${response.status}.`
    );
  }

  return result;
}

export default function SalesReportPage() {
  const [data, setData] = useState(null);

  const [loading, setLoading] = useState(true);
  const [permissionsLoading, setPermissionsLoading] = useState(true);
  const [reportLoading, setReportLoading] = useState(false);

  const [permissionsError, setPermissionsError] = useState(false);

  const [permissions, setPermissions] = useState({
    ...INITIAL_PERMISSIONS,
  });

  const [error, setError] = useState("");
  const [showReportForm, setShowReportForm] = useState(false);

  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  // Prevent older permission requests from overriding newer requests.
  const permissionRequestId = useRef(0);

  // Prevent outdated report requests from overwriting newer results.
  const reportRequestId = useRef(0);

  // Prevent report requests after access has been revoked.
  const canViewRef = useRef(false);
  const canCreateRef = useRef(false);

  /*
   * Load current user permissions.
   * Permission checks fail closed.
   */
  const loadPermissions = useCallback(async () => {
    const requestId = ++permissionRequestId.current;

    // Lock report access while rechecking permissions.
    canViewRef.current = false;
    canCreateRef.current = false;

    // Invalidate pending report requests.
    reportRequestId.current += 1;

    setPermissionsLoading(true);
    setPermissionsError(false);
    setReportLoading(false);
    setShowReportForm(false);
    setData(null);
    setLoading(true);
    setError("");

    try {
      const response = await fetch(PERMISSIONS_URL, {
        method: "GET",
        credentials: "same-origin",
        cache: "no-store",
        headers: {
          Accept: "application/json",
        },
      });

      const result = await readJson(response);

      if (!Array.isArray(result.permissions)) {
        throw new Error(
          "The permissions API did not return a permissions array."
        );
      }

      // Ignore stale responses.
      if (requestId !== permissionRequestId.current) {
        return;
      }

      const salesPermission = result.permissions.find(
        (permission) =>
          String(permission.permission_key || "")
            .trim()
            .toLowerCase() === PERMISSION_KEY
      );

      const normalized = normalizePermission(salesPermission);

      canViewRef.current = normalized.canView;
      canCreateRef.current = normalized.canCreate;

      setPermissions(normalized);
      setPermissionsError(false);
    } catch (err) {
      if (requestId !== permissionRequestId.current) {
        return;
      }

      console.error("SALES DASHBOARD PERMISSIONS ERROR:", err);

      canViewRef.current = false;
      canCreateRef.current = false;

      setPermissions({ ...INITIAL_PERMISSIONS });
      setPermissionsError(true);
      setData(null);
      setError(
        err.message || "Unable to verify Sales Dashboard permissions."
      );
      setLoading(false);
    } finally {
      if (requestId === permissionRequestId.current) {
        setPermissionsLoading(false);
      }
    }
  }, []);

  /*
   * Fetch report data.
   * The permission ref is checked before every request.
   */
  const fetchSalesReport = useCallback(async (options = {}) => {
    if (!canViewRef.current) {
      setData(null);
      setLoading(false);
      setReportLoading(false);
      return;
    }

    const requestId = ++reportRequestId.current;

    const {
      fromDate = "",
      toDate = "",
      showLoader = false,
    } = options;

    if (showLoader) {
      setReportLoading(true);
    } else {
      setLoading(true);
    }

    setError("");

    try {
      const params = new URLSearchParams();

      if (fromDate) {
        params.set("from", fromDate);
      }

      if (toDate) {
        params.set("to", toDate);
      }

      const query = params.toString();

      const response = await fetch(
        `${REPORT_URL}${query ? `?${query}` : ""}`,
        {
          method: "GET",
          credentials: "same-origin",
          cache: "no-store",
          headers: {
            Accept: "application/json",
          },
        }
      );

      const result = await readJson(response);

      // Ignore results from outdated requests or revoked access.
      if (
        requestId !== reportRequestId.current ||
        !canViewRef.current
      ) {
        return;
      }

      setData(result);
      setError("");
    } catch (err) {
      if (
        requestId !== reportRequestId.current ||
        !canViewRef.current
      ) {
        return;
      }

      console.error("SALES REPORT ERROR:", err);

      setError(err.message || "Failed to load the Sales Dashboard.");
    } finally {
      if (requestId === reportRequestId.current) {
        setLoading(false);
        setReportLoading(false);
      }
    }
  }, []);

  /*
   * Initial permission check.
   *
   * Deferring the call prevents synchronous state updates directly
   * inside the effect and fixes react-hooks/set-state-in-effect.
   */
  useEffect(() => {
    const timer = setTimeout(() => {
      void loadPermissions();
    }, 0);

    return () => {
      clearTimeout(timer);

      // Invalidate outstanding requests on unmount.
      permissionRequestId.current += 1;
      reportRequestId.current += 1;
    };
  }, [loadPermissions]);

  /*
   * Load the dashboard only after permission verification succeeds.
   */
  useEffect(() => {
    if (permissionsLoading || permissionsError) {
      return;
    }

    if (!permissions.canView) {
      return;
    }

    const timer = setTimeout(() => {
      void fetchSalesReport();
    }, 0);

    return () => {
      clearTimeout(timer);
    };
  }, [
    permissionsLoading,
    permissionsError,
    permissions.canView,
    fetchSalesReport,
  ]);

  /*
   * Refresh permissions when User Rights are updated.
   */
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

  /*
   * Refresh permissions when the browser tab becomes active.
   */
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

  /*
   * Permission-controlled report generation.
   */
  function openReportForm() {
    if (!canViewRef.current || !canCreateRef.current) {
      return;
    }

    setError("");
    setShowReportForm(true);
  }

  function cancelReportForm() {
    setError("");
    setShowReportForm(false);
  }

  async function loadReport(event) {
    event.preventDefault();

    if (!canViewRef.current) {
      setError(
        "You do not have permission to view the Sales Dashboard."
      );
      return;
    }

    if (!canCreateRef.current) {
      setError("You do not have permission to generate sales reports.");
      return;
    }

    if (from && to && from > to) {
      setError("The From date cannot be later than the To date.");
      return;
    }

    await fetchSalesReport({
      fromDate: from,
      toDate: to,
      showLoader: true,
    });

    setShowReportForm(false);
  }

  function resetFilters() {
    setFrom("");
    setTo("");
    setError("");
  }

  function formatMoney(value) {
    return Number(value || 0).toLocaleString("en-PK", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  }

  const summary = data?.summary || {};

  const topCustomers = Array.isArray(data?.topCustomers)
    ? data.topCustomers
    : [];

  /*
   * Permission loading screen.
   */
  if (permissionsLoading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50 p-6 text-slate-900 dark:bg-slate-950 dark:text-white">
        <div className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-xl dark:border-slate-800 dark:bg-slate-900">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300">
            <LoaderCircle className="h-7 w-7 animate-spin" />
          </div>

          <h1 className="mt-5 text-xl font-extrabold">
            Checking your access
          </h1>

          <p className="mt-2 text-sm leading-6 text-slate-500 dark:text-slate-400">
            Verifying your Sales Dashboard permissions.
          </p>
        </div>
      </main>
    );
  }

  /*
   * Permission verification failure screen.
   */
  if (permissionsError) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50 p-6 text-slate-900 dark:bg-slate-950 dark:text-white">
        <div className="w-full max-w-lg rounded-3xl border border-amber-200 bg-white p-8 text-center shadow-xl dark:border-amber-900/60 dark:bg-slate-900">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300">
            <ShieldAlert className="h-7 w-7" />
          </div>

          <h1 className="mt-5 text-xl font-extrabold">
            Unable to verify permissions
          </h1>

          <p className="mt-2 text-sm leading-6 text-slate-500 dark:text-slate-400">
            Your Sales Dashboard remains locked because your permissions
            could not be verified. Please retry.
          </p>

          <button
            type="button"
            onClick={() => void loadPermissions()}
            className={`${styles.primaryButton} mt-6`}
          >
            <RefreshCw className="h-4 w-4" />
            Retry
          </button>
        </div>
      </main>
    );
  }

  /*
   * View permission denied screen.
   */
  if (!permissions.canView) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50 p-6 text-slate-900 transition-colors dark:bg-slate-950 dark:text-white">
        <div className="w-full max-w-lg overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-xl dark:border-slate-800 dark:bg-slate-900">
          <div className="h-2 bg-gradient-to-r from-blue-600 via-indigo-500 to-emerald-500" />

          <div className="p-8 text-center sm:p-10">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-red-100 text-red-700 dark:bg-red-950/50 dark:text-red-300">
              <LockKeyhole className="h-8 w-8" />
            </div>

            <span className="mt-5 inline-flex items-center gap-2 rounded-full border border-red-200 bg-red-50 px-3 py-1 text-xs font-bold text-red-700 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-300">
              <ShieldAlert className="h-3.5 w-3.5" />
              ACCESS RESTRICTED
            </span>

            <h1 className="mt-4 text-2xl font-extrabold tracking-tight">
              Sales Dashboard
            </h1>

            <p className="mx-auto mt-3 max-w-sm text-sm leading-6 text-slate-500 dark:text-slate-400">
              Your account does not have View permission for the Sales
              Dashboard. Contact your administrator if you need access.
            </p>

            <div className="mt-6 rounded-xl border border-slate-200 bg-slate-50 p-4 text-left dark:border-slate-800 dark:bg-slate-950">
              <p className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Required permission
              </p>

              <p className="mt-2 font-mono text-sm font-semibold text-blue-700 dark:text-blue-300">
                {PERMISSION_KEY}
              </p>

              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                User Rights → Sales → Sales Dashboard → View
              </p>
            </div>
          </div>
        </div>
      </main>
    );
  }

  /*
   * Dashboard.
   */
  return (
    <main className="min-h-screen bg-slate-50/80 p-4 text-slate-900 transition-colors duration-300 dark:bg-slate-950 dark:text-slate-100 sm:p-6 xl:p-8">
      <div className="mx-auto max-w-[1600px] space-y-7">
        {/* PAGE HEADER */}
        <section className="relative overflow-hidden rounded-3xl border border-slate-200/80 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-8">
          <div className="pointer-events-none absolute -right-12 -top-20 h-64 w-64 rounded-full bg-blue-500/10 blur-3xl" />

          <div className="pointer-events-none absolute -bottom-24 right-1/3 h-48 w-48 rounded-full bg-emerald-500/10 blur-3xl" />

          <div className="relative flex flex-col justify-between gap-6 lg:flex-row lg:items-center">
            <div className="flex items-start gap-4">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-600 to-emerald-500 text-white shadow-lg shadow-blue-600/20">
                <TrendingUp className="h-7 w-7" />
              </div>

              <div>
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <span className="rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.15em] text-blue-700 dark:border-blue-900 dark:bg-blue-950/60 dark:text-blue-300">
                    Reports &amp; Analytics
                  </span>

                  <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                    Sales overview
                  </span>
                </div>

                <h1 className="text-2xl font-extrabold tracking-tight text-slate-950 dark:text-white sm:text-3xl">
                  Sales Dashboard
                </h1>

                <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500 dark:text-slate-400 sm:text-base">
                  Monitor invoice activity, revenue, collected payments,
                  and customer receivables in one place.
                </p>
              </div>
            </div>

            {permissions.canCreate && !showReportForm && (
              <button
                type="button"
                onClick={openReportForm}
                className={styles.primaryButton}
              >
                <CalendarDays className="h-4 w-4" />
                Generate Report
                <ArrowRight className="h-4 w-4" />
              </button>
            )}
          </div>

          <div className="relative mt-7 grid grid-cols-1 gap-3 border-t border-slate-100 pt-5 dark:border-slate-800 sm:grid-cols-3">
            <HeaderInfo
              icon={<FileText className="h-4 w-4" />}
              title="Invoice insights"
              subtitle="Review sales volume"
            />

            <HeaderInfo
              icon={<Wallet className="h-4 w-4" />}
              title="Payment tracking"
              subtitle="Monitor collected amounts"
            />

            <HeaderInfo
              icon={<Users className="h-4 w-4" />}
              title="Customer performance"
              subtitle="Understand outstanding balances"
            />
          </div>
        </section>

        {/* ERROR MESSAGE */}
        {error && (
          <div
            role="alert"
            className="flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 p-4 text-red-800 dark:border-red-900/70 dark:bg-red-950/30 dark:text-red-300"
          >
            <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />

            <div className="min-w-0 flex-1">
              <p className="font-bold">Something went wrong</p>
              <p className="mt-1 break-words text-sm">{error}</p>
            </div>

            <button
              type="button"
              onClick={() => setError("")}
              aria-label="Dismiss error"
              className="rounded-lg p-1 transition hover:bg-red-100 dark:hover:bg-red-900/40"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        {/* REPORT FILTER FORM */}
        {showReportForm && permissions.canCreate && (
          <form
            onSubmit={loadReport}
            className={`${styles.panel} animate-in fade-in slide-in-from-top-2 duration-300`}
          >
            <div className="flex items-start gap-4 border-b border-slate-200 bg-gradient-to-r from-blue-50 via-white to-emerald-50 p-5 dark:border-slate-800 dark:from-blue-950/40 dark:via-slate-900 dark:to-emerald-950/20 sm:p-6">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300">
                <CalendarDays className="h-6 w-6" />
              </div>

              <div>
                <h2 className="text-lg font-extrabold text-slate-900 dark:text-white sm:text-xl">
                  Generate Sales Report
                </h2>

                <p className="mt-1 text-sm leading-6 text-slate-500 dark:text-slate-400">
                  Choose a date range to update the sales summary and
                  customer performance.
                </p>
              </div>
            </div>

            <div className="space-y-5 p-5 sm:p-6">
              <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                <div>
                  <label htmlFor="report-from" className={styles.label}>
                    From Date
                  </label>

                  <input
                    id="report-from"
                    type="date"
                    value={from}
                    max={to || undefined}
                    onChange={(event) => setFrom(event.target.value)}
                    className={styles.input}
                  />

                  <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                    Start of the reporting period
                  </p>
                </div>

                <div>
                  <label htmlFor="report-to" className={styles.label}>
                    To Date
                  </label>

                  <input
                    id="report-to"
                    type="date"
                    value={to}
                    min={from || undefined}
                    onChange={(event) => setTo(event.target.value)}
                    className={styles.input}
                  />

                  <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                    End of the reporting period
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3 rounded-xl border border-blue-100 bg-blue-50/70 p-4 dark:border-blue-900/60 dark:bg-blue-950/30">
                <Info className="mt-0.5 h-5 w-5 shrink-0 text-blue-600 dark:text-blue-400" />

                <p className="text-sm leading-6 text-blue-800 dark:text-blue-200">
                  Leave both dates empty to use the API&apos;s default
                  reporting date range.
                </p>
              </div>

              <div className="flex flex-col-reverse gap-3 border-t border-slate-200 pt-5 dark:border-slate-800 sm:flex-row sm:items-center sm:justify-between">
                <button
                  type="button"
                  disabled={reportLoading}
                  onClick={resetFilters}
                  className={styles.secondaryButton}
                >
                  <RefreshCw className="h-4 w-4" />
                  Clear Dates
                </button>

                <div className="flex flex-col-reverse gap-3 sm:flex-row">
                  <button
                    type="button"
                    disabled={reportLoading}
                    onClick={cancelReportForm}
                    className={styles.secondaryButton}
                  >
                    Cancel
                  </button>

                  <button
                    type="submit"
                    disabled={reportLoading}
                    className={styles.primaryButton}
                  >
                    {reportLoading ? (
                      <LoaderCircle className="h-4 w-4 animate-spin" />
                    ) : (
                      <TrendingUp className="h-4 w-4" />
                    )}

                    {reportLoading
                      ? "Generating Report..."
                      : "Generate Report"}
                  </button>
                </div>
              </div>
            </div>
          </form>
        )}

        {/* DASHBOARD CONTENT */}
        {!showReportForm && (
          <>
            <section>
              <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <h2 className="text-lg font-extrabold text-slate-900 dark:text-white">
                    Sales at a glance
                  </h2>

                  <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                    Key figures from your current report
                  </p>
                </div>

                <span className="inline-flex w-fit items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300">
                  <span className="h-2 w-2 rounded-full bg-emerald-500" />
                  {loading ? "Updating figures" : "Report summary"}
                </span>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <Stat
                  title="Invoices"
                  value={summary.invoice_count ?? 0}
                  description="Total sales invoices"
                  icon={<FileText className="h-5 w-5" />}
                  color="blue"
                  loading={loading}
                />

                <Stat
                  title="Total Sales"
                  value={`Rs. ${formatMoney(summary.total_sales)}`}
                  description="Total invoiced sales"
                  icon={<TrendingUp className="h-5 w-5" />}
                  color="green"
                  loading={loading}
                />

                <Stat
                  title="Paid"
                  value={`Rs. ${formatMoney(summary.paid_amount)}`}
                  description="Payments received"
                  icon={<Wallet className="h-5 w-5" />}
                  color="emerald"
                  loading={loading}
                />

                <Stat
                  title="Receivable"
                  value={`Rs. ${formatMoney(summary.balance_amount)}`}
                  description="Outstanding customer balance"
                  icon={<Clock3 className="h-5 w-5" />}
                  color="sky"
                  loading={loading}
                />
              </div>
            </section>

            {/* CUSTOMERS TABLE */}
            <section className={styles.panel}>
              <div className="flex flex-col gap-4 border-b border-slate-200 p-5 dark:border-slate-800 sm:flex-row sm:items-center sm:justify-between sm:p-6">
                <div className="flex items-start gap-3">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">
                    <Users className="h-5 w-5" />
                  </div>

                  <div>
                    <h2 className="text-lg font-extrabold text-slate-900 dark:text-white">
                      Top Customers
                    </h2>

                    <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                      Customer sales, payments, and outstanding balances
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
                    {loading
                      ? "Loading..."
                      : `${topCustomers.length} Customers`}
                  </span>

                  {permissions.canCreate && (
                    <button
                      type="button"
                      onClick={openReportForm}
                      className="inline-flex items-center gap-2 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-xs font-bold text-blue-700 transition hover:bg-blue-100 dark:border-blue-900 dark:bg-blue-950/50 dark:text-blue-300 dark:hover:bg-blue-900/50"
                    >
                      <CalendarDays className="h-4 w-4" />
                      Filter Dates
                    </button>
                  )}
                </div>
              </div>

              {loading ? (
                <div className="grid grid-cols-1 gap-4 p-5 sm:grid-cols-2 xl:grid-cols-4">
                  {[1, 2, 3, 4].map((item) => (
                    <div
                      key={item}
                      className="h-24 animate-pulse rounded-xl bg-slate-100 dark:bg-slate-800"
                    />
                  ))}

                  <p className="col-span-full py-5 text-center text-sm text-slate-500 dark:text-slate-400">
                    Loading customer sales data...
                  </p>
                </div>
              ) : !data ? (
                <div className="px-5 py-14 text-center sm:px-8">
                  <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-50 text-blue-600 dark:bg-blue-950/50 dark:text-blue-300">
                    <Activity className="h-7 w-7" />
                  </div>

                  <h3 className="mt-4 font-bold text-slate-900 dark:text-white">
                    Sales data unavailable
                  </h3>

                  <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-500 dark:text-slate-400">
                    Check your connection or report API, then try again.
                  </p>

                  <button
                    type="button"
                    onClick={() => void fetchSalesReport()}
                    className={`${styles.primaryButton} mt-5`}
                  >
                    <RefreshCw className="h-4 w-4" />
                    Retry
                  </button>
                </div>
              ) : topCustomers.length === 0 ? (
                <div className="px-5 py-14 text-center sm:px-8">
                  <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300">
                    <Users className="h-7 w-7" />
                  </div>

                  <h3 className="mt-4 font-bold text-slate-900 dark:text-white">
                    No customer sales found
                  </h3>

                  <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-500 dark:text-slate-400">
                    There are no customers with sales in this report.
                    Try a different date range.
                  </p>

                  {permissions.canCreate && (
                    <button
                      type="button"
                      onClick={openReportForm}
                      className={`${styles.primaryButton} mt-5`}
                    >
                      Generate Report
                    </button>
                  )}
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[900px] text-sm">
                    <thead className="bg-slate-50/90 dark:bg-slate-950/70">
                      <tr>
                        {[
                          ["Code", "left"],
                          ["Customer", "left"],
                          ["Invoices", "right"],
                          ["Sales (PKR)", "right"],
                          ["Paid (PKR)", "right"],
                          ["Balance (PKR)", "right"],
                        ].map(([heading, alignment]) => (
                          <th
                            key={heading}
                            className={`px-5 py-4 text-${alignment} text-[11px] font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400`}
                          >
                            {heading}
                          </th>
                        ))}
                      </tr>
                    </thead>

                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {topCustomers.map((customer, index) => (
                        <tr
                          key={
                            customer.customer_id ??
                            `${customer.customer_code || "customer"}-${index}`
                          }
                          className="group transition-colors hover:bg-blue-50/50 dark:hover:bg-blue-950/20"
                        >
                          <td className="whitespace-nowrap px-5 py-4">
                            <span className="rounded-md bg-slate-100 px-2.5 py-1 font-mono text-xs font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                              {customer.customer_code || "-"}
                            </span>
                          </td>

                          <td className="px-5 py-4">
                            <div className="flex items-center gap-3">
                              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-blue-100 to-emerald-100 text-xs font-extrabold text-blue-800 dark:from-blue-950 dark:to-emerald-950 dark:text-emerald-300">
                                {getInitials(customer.customer_name)}
                              </div>

                              <span className="font-bold text-slate-800 dark:text-slate-100">
                                {customer.customer_name || "-"}
                              </span>
                            </div>
                          </td>

                          <td className="px-5 py-4 text-right tabular-nums text-slate-600 dark:text-slate-300">
                            {customer.invoice_count ?? 0}
                          </td>

                          <td className="px-5 py-4 text-right font-semibold tabular-nums text-slate-900 dark:text-white">
                            {formatMoney(customer.total_sales)}
                          </td>

                          <td className="px-5 py-4 text-right font-semibold tabular-nums text-emerald-700 dark:text-emerald-400">
                            {formatMoney(customer.paid_amount)}
                          </td>

                          <td className="px-5 py-4 text-right font-semibold tabular-nums text-blue-700 dark:text-blue-300">
                            {formatMoney(customer.balance_amount)}
                          </td>
                        </tr>
                      ))}
                    </tbody>

                    <tfoot className="border-t border-slate-200 bg-slate-50/80 dark:border-slate-800 dark:bg-slate-950/70">
                      <tr>
                        <td
                          colSpan={2}
                          className="px-5 py-4 font-extrabold text-slate-800 dark:text-slate-100"
                        >
                          Customers shown: {topCustomers.length}
                        </td>

                        <td className="px-5 py-4 text-right font-bold text-slate-600 dark:text-slate-300">
                          {topCustomers.reduce(
                            (total, customer) =>
                              total +
                              Number(customer.invoice_count || 0),
                            0
                          )}
                        </td>

                        <td className="px-5 py-4 text-right font-extrabold text-slate-900 dark:text-white">
                          {formatMoney(
                            topCustomers.reduce(
                              (total, customer) =>
                                total + Number(customer.total_sales || 0),
                              0
                            )
                          )}
                        </td>

                        <td className="px-5 py-4 text-right font-extrabold text-emerald-700 dark:text-emerald-400">
                          {formatMoney(
                            topCustomers.reduce(
                              (total, customer) =>
                                total + Number(customer.paid_amount || 0),
                              0
                            )
                          )}
                        </td>

                        <td className="px-5 py-4 text-right font-extrabold text-blue-700 dark:text-blue-300">
                          {formatMoney(
                            topCustomers.reduce(
                              (total, customer) =>
                                total + Number(customer.balance_amount || 0),
                              0
                            )
                          )}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}

              {data && topCustomers.length > 0 && (
                <div className="flex flex-col gap-2 border-t border-slate-200 bg-slate-50/70 px-5 py-3 text-xs text-slate-500 dark:border-slate-800 dark:bg-slate-950/40 dark:text-slate-400 sm:flex-row sm:items-center sm:justify-between">
                  <span>
                    Showing {topCustomers.length} customer
                    {topCustomers.length === 1 ? "" : "s"}
                  </span>

                  <span className="inline-flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full bg-emerald-500" />
                    Values are displayed in PKR
                  </span>
                </div>
              )}
            </section>
          </>
        )}

        <footer className="flex flex-col gap-2 pb-2 text-xs text-slate-400 dark:text-slate-500 sm:flex-row sm:items-center sm:justify-between">
          <span>Sales &amp; Analytics</span>
          <span>Amounts are formatted in Pakistani Rupees (PKR).</span>
        </footer>
      </div>
    </main>
  );
}

function Stat({
  title,
  value,
  description,
  icon,
  color,
  loading,
}) {
  const colors = {
    blue: {
      icon: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
      glow: "from-blue-500/10",
      bar: "bg-blue-500",
    },

    green: {
      icon: "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300",
      glow: "from-green-500/10",
      bar: "bg-green-500",
    },

    emerald: {
      icon: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
      glow: "from-emerald-500/10",
      bar: "bg-emerald-500",
    },

    sky: {
      icon: "bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300",
      glow: "from-sky-500/10",
      bar: "bg-sky-500",
    },
  };

  const theme = colors[color] || colors.blue;

  return (
    <article className="group relative overflow-hidden rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:border-blue-200 hover:shadow-lg dark:border-slate-800 dark:bg-slate-900 dark:hover:border-slate-700 sm:p-6">
      <div
        className={`pointer-events-none absolute inset-0 bg-gradient-to-br ${theme.glow} via-transparent to-transparent opacity-70`}
      />

      <div className="relative">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-slate-500 dark:text-slate-400">
              {title}
            </p>

            <div className="mt-3 min-h-9 break-words text-xl font-extrabold tracking-tight text-slate-950 dark:text-white sm:text-2xl">
              {loading ? (
                <span className="inline-block h-7 w-28 animate-pulse rounded-lg bg-slate-200 dark:bg-slate-700" />
              ) : (
                value ?? 0
              )}
            </div>
          </div>

          <div
            className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${theme.icon} transition-transform duration-300 group-hover:scale-110`}
          >
            {icon}
          </div>
        </div>

        <div className="mt-5 flex items-center justify-between gap-2 border-t border-slate-100 pt-4 dark:border-slate-800">
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
            {description}
          </p>

          <span className={`h-1.5 w-7 shrink-0 rounded-full ${theme.bar}`} />
        </div>
      </div>
    </article>
  );
}

function HeaderInfo({ icon, title, subtitle }) {
  return (
    <div className="flex items-center gap-3 rounded-xl px-2 py-2">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300">
        {icon}
      </div>

      <div>
        <p className="text-sm font-bold text-slate-800 dark:text-slate-200">
          {title}
        </p>

        <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
          {subtitle}
        </p>
      </div>
    </div>
  );
}

function getInitials(name) {
  const words = String(name || "Customer")
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  return words
    .slice(0, 2)
    .map((word) => word[0].toUpperCase())
    .join("");
}