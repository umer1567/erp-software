"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

const panelClass =
  "overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm shadow-slate-200/40 transition-colors dark:border-slate-800 dark:bg-slate-900 dark:shadow-black/10";

const buttonClass =
  "inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-blue-700 px-4 py-2.5 text-sm font-bold text-white shadow-md shadow-blue-600/20 transition hover:-translate-y-0.5 hover:from-blue-500 hover:to-blue-600 focus:outline-none focus:ring-4 focus:ring-blue-500/20";

const PERMISSION_KEY = "payment_report";
const PERMISSIONS_URL = "/api/permissions/current";

export default function PaymentReportPage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("ALL");
  const [methodFilter, setMethodFilter] = useState("ALL");
  const [sortOrder, setSortOrder] = useState("newest");

  // Permission states
  const [permissionLoading, setPermissionLoading] = useState(true);
  const [permissionError, setPermissionError] = useState("");
  const [canView, setCanView] = useState(false);

  // --------------------------------------------------
  // USER RIGHTS
  // --------------------------------------------------

  const checkPermission = useCallback(async () => {
  try {
    setPermissionLoading(true);
    setPermissionError("");

    const response = await fetch(PERMISSIONS_URL, {
      method: "GET",
      cache: "no-store",
      credentials: "include",
    });

    const result = await response.json();

    if (!response.ok) {
      throw new Error(
        result.message || "Unable to verify your permissions."
      );
    }

    const permissionData =
      result.permissions ??
      result.data ??
      result;

    let permission = null;

    if (Array.isArray(permissionData)) {
      permission = permissionData.find((item) => {
        const key =
          item.permission_key ||
          item.permissionKey ||
          item.key ||
          item.name;

        return (
          String(key || "").toLowerCase() ===
          PERMISSION_KEY.toLowerCase()
        );
      });
    } else if (
      permissionData &&
      typeof permissionData === "object"
    ) {
      permission = permissionData[PERMISSION_KEY];
    }

    if (
      !permission &&
      result &&
      typeof result === "object" &&
      !Array.isArray(result)
    ) {
      permission = result[PERMISSION_KEY];
    }

    let allowed = false;

    if (typeof permission === "boolean") {
      allowed = permission;
    } else if (permission && typeof permission === "object") {
      allowed =
        permission.can_view === true ||
        permission.canView === true ||
        permission.view === true;
    }

    setCanView(allowed);
    setPermissionError("");
  } catch (err) {
    console.error("PAYMENT REPORT PERMISSION ERROR:", err);

    setCanView(false);
    setPermissionError(
      err.message || "Unable to verify your permissions."
    );
  } finally {
    setPermissionLoading(false);
  }
}, []);

useEffect(() => {
  let cancelled = false;

  const verifyPermission = async () => {
    try {
      const response = await fetch(PERMISSIONS_URL, {
        method: "GET",
        cache: "no-store",
        credentials: "include",
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(
          result.message || "Unable to verify your permissions."
        );
      }

      const permissionData =
        result.permissions ??
        result.data ??
        result;

      let permission = null;

      if (Array.isArray(permissionData)) {
        permission = permissionData.find((item) => {
          const key =
            item.permission_key ||
            item.permissionKey ||
            item.key ||
            item.name;

          return (
            String(key || "").toLowerCase() ===
            PERMISSION_KEY.toLowerCase()
          );
        });
      } else if (
        permissionData &&
        typeof permissionData === "object"
      ) {
        permission = permissionData[PERMISSION_KEY];
      }

      if (
        !permission &&
        result &&
        typeof result === "object" &&
        !Array.isArray(result)
      ) {
        permission = result[PERMISSION_KEY];
      }

      let allowed = false;

      if (typeof permission === "boolean") {
        allowed = permission;
      } else if (permission && typeof permission === "object") {
        allowed =
          permission.can_view === true ||
          permission.canView === true ||
          permission.view === true;
      }

      if (!cancelled) {
        setCanView(allowed);
        setPermissionError("");
      }
    } catch (err) {
      console.error("PAYMENT REPORT PERMISSION ERROR:", err);

      if (!cancelled) {
        setCanView(false);
        setPermissionError(
          err.message || "Unable to verify your permissions."
        );
      }
    } finally {
      if (!cancelled) {
        setPermissionLoading(false);
      }
    }
  };

  verifyPermission();

  const handlePermissionRefresh = () => {
    checkPermission();
  };

  const handleVisibilityChange = () => {
    if (document.visibilityState === "visible") {
      checkPermission();
    }
  };

  window.addEventListener(
    "permissions-updated",
    handlePermissionRefresh
  );

  window.addEventListener(
    "focus",
    handlePermissionRefresh
  );

  document.addEventListener(
    "visibilitychange",
    handleVisibilityChange
  );

  return () => {
    cancelled = true;

    window.removeEventListener(
      "permissions-updated",
      handlePermissionRefresh
    );

    window.removeEventListener(
      "focus",
      handlePermissionRefresh
    );

    document.removeEventListener(
      "visibilitychange",
      handleVisibilityChange
    );
  };
}, [checkPermission]);

  // --------------------------------------------------
  // LOAD REPORT
  // --------------------------------------------------

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setError("");

      const response = await fetch("/api/reports/payments", {
        method: "GET",
        cache: "no-store",
        credentials: "include",
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(
          result.message || "Failed to load payment report."
        );
      }

      setData(result);
    } catch (err) {
      console.error("PAYMENT REPORT ERROR:", err);
      setError(err.message || "Failed to load payment report.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
  if (permissionLoading || !canView) return;

  let cancelled = false;

  async function fetchReport() {
    try {
      setLoading(true);
      setError("");

      const response = await fetch("/api/reports/payments", {
        method: "GET",
        cache: "no-store",
        credentials: "include",
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(
          result.message || "Failed to load payment report."
        );
      }

      if (!cancelled) {
        setData(result);
      }
    } catch (err) {
      console.error("PAYMENT REPORT ERROR:", err);

      if (!cancelled) {
        setError(
          err.message || "Failed to load payment report."
        );
      }
    } finally {
      if (!cancelled) {
        setLoading(false);
      }
    }
  }

  fetchReport();

  return () => {
    cancelled = true;
  };
}, [permissionLoading, canView]);

  // --------------------------------------------------
  // REPORT DATA
  // --------------------------------------------------

  const payments = Array.isArray(data?.payments)
    ? data.payments
    : [];

  const summary = data?.summary || {};

  const methods = useMemo(() => {
    return [
      ...new Set(
        payments
          .map((payment) =>
            String(payment.payment_method || "").trim()
          )
          .filter(Boolean)
      ),
    ].sort((a, b) => a.localeCompare(b));
  }, [payments]);

  const filteredPayments = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();

    const result = payments.filter((payment) => {
      const searchable = [
        payment.payment_number,
        payment.transaction_type,
        payment.party_name,
        payment.payment_method,
        payment.reference_number,
        payment.payment_date,
      ]
        .map((value) => String(value ?? ""))
        .join(" ")
        .toLowerCase();

      const matchesSearch =
        !normalizedSearch ||
        searchable.includes(normalizedSearch);

      const matchesType =
        typeFilter === "ALL" ||
        String(payment.transaction_type || "").toUpperCase() ===
          typeFilter;

      const matchesMethod =
        methodFilter === "ALL" ||
        String(payment.payment_method || "").trim() ===
          methodFilter;

      return matchesSearch && matchesType && matchesMethod;
    });

    return result.sort((a, b) => {
      if (sortOrder === "amount-high") {
        return Number(b.amount || 0) - Number(a.amount || 0);
      }

      if (sortOrder === "amount-low") {
        return Number(a.amount || 0) - Number(b.amount || 0);
      }

      const dateA = new Date(a.payment_date || 0).getTime();
      const dateB = new Date(b.payment_date || 0).getTime();

      if (sortOrder === "oldest") {
        return dateA - dateB;
      }

      return dateB - dateA;
    });
  }, [
    payments,
    search,
    typeFilter,
    methodFilter,
    sortOrder,
  ]);

  const filteredTotal = useMemo(
    () =>
      filteredPayments.reduce(
        (total, payment) =>
          total + Number(payment.amount || 0),
        0
      ),
    [filteredPayments]
  );

  // --------------------------------------------------
  // HELPERS
  // --------------------------------------------------

  function formatMoney(value) {
    return Number(value || 0).toLocaleString("en-PK", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  }

  function formatDate(value) {
    if (!value) return "-";

    const dateText = String(value);

    const match = dateText.match(
      /^(\d{4})-(\d{2})-(\d{2})$/
    );

    if (match) {
      return new Date(
        Number(match[1]),
        Number(match[2]) - 1,
        Number(match[3])
      ).toLocaleDateString("en-PK", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      });
    }

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) return dateText;

    return date.toLocaleDateString("en-PK", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  }

  function clearFilters() {
    setSearch("");
    setTypeFilter("ALL");
    setMethodFilter("ALL");
    setSortOrder("newest");
  }

  const totalReceipts = Number(summary.totalReceipts || 0);
  const totalPayments = Number(summary.totalPayments || 0);
  const netMovement = totalReceipts - totalPayments;

  // --------------------------------------------------
  // PERMISSION LOADING
  // --------------------------------------------------

  if (permissionLoading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50 p-6 dark:bg-slate-950">
        <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-blue-100 border-t-blue-600 dark:border-slate-700 dark:border-t-blue-400" />

          <h2 className="mt-5 text-lg font-extrabold text-slate-900 dark:text-white">
            Checking User Rights
          </h2>

          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
            Verifying your access to Payment Report...
          </p>
        </div>
      </main>
    );
  }

  // --------------------------------------------------
  // PERMISSION ERROR
  // --------------------------------------------------

  if (permissionError) {
    return (
      <AccessDenied
        title="Permission verification failed"
        description={permissionError}
        onRetry={checkPermission}
        retrying={permissionLoading}
      />
    );
  }

  // --------------------------------------------------
  // ACCESS DENIED
  // --------------------------------------------------

  if (!canView) {
    return (
      <AccessDenied
        title="Access Denied"
        description="You do not have permission to view Payment Report. Please contact your administrator to request access."
        onRetry={checkPermission}
        retrying={permissionLoading}
      />
    );
  }

  // --------------------------------------------------
  // PAGE
  // --------------------------------------------------

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
                <PaymentIcon className="h-7 w-7" />
              </div>

              <div>
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <span className="rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.15em] text-blue-700 dark:border-blue-900 dark:bg-blue-950/60 dark:text-blue-300">
                    Financial Reports
                  </span>

                  <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                    Payment overview
                  </span>
                </div>

                <h1 className="text-2xl font-extrabold tracking-tight text-slate-950 dark:text-white sm:text-3xl">
                  Payment Report
                </h1>

                <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500 dark:text-slate-400 sm:text-base">
                  Review sales receipts and purchase payments, monitor cash
                  movement, and find individual transactions quickly.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={loadData}
              disabled={loading}
              className={`${buttonClass} disabled:cursor-not-allowed disabled:opacity-50`}
            >
              <RefreshIcon
                className={`h-4 w-4 ${
                  loading ? "animate-spin" : ""
                }`}
              />
              Refresh Report
            </button>
          </div>

          <div className="relative mt-7 grid grid-cols-1 gap-3 border-t border-slate-100 pt-5 dark:border-slate-800 sm:grid-cols-3">
            <HeaderInfo
              icon={<ArrowDownIcon className="h-4 w-4" />}
              title="Sales receipts"
              subtitle="Money received from customers"
            />

            <HeaderInfo
              icon={<ArrowUpIcon className="h-4 w-4" />}
              title="Purchase payments"
              subtitle="Payments made to suppliers"
            />

            <HeaderInfo
              icon={<SearchIcon className="h-4 w-4" />}
              title="Transaction lookup"
              subtitle="Search and filter payment records"
            />
          </div>
        </section>

        {/* ERROR */}

        {error && (
          <div
            role="alert"
            className="flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 p-4 text-red-800 dark:border-red-900/70 dark:bg-red-950/30 dark:text-red-300"
          >
            <AlertIcon className="mt-0.5 h-5 w-5 shrink-0" />

            <div className="min-w-0 flex-1">
              <p className="font-bold">
                Unable to load payment report
              </p>

              <p className="mt-1 break-words text-sm">
                {error}
              </p>
            </div>

            <button
              type="button"
              onClick={() => setError("")}
              aria-label="Dismiss error"
              className="rounded-lg p-1 text-lg leading-none transition hover:bg-red-100 dark:hover:bg-red-900/40"
            >
              ×
            </button>
          </div>
        )}

        {/* SUMMARY CARDS */}

        <section>
          <div className="mb-4">
            <h2 className="text-lg font-extrabold text-slate-900 dark:text-white">
              Payment summary
            </h2>

            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              Overview of receipts, payments, and net movement
            </p>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
            <Stat
              title="Total Receipts"
              value={
                loading
                  ? "..."
                  : `Rs. ${formatMoney(totalReceipts)}`
              }
              description="Sales receipts recorded"
              icon={<ArrowDownIcon className="h-5 w-5" />}
              color="green"
              loading={loading}
            />

            <Stat
              title="Total Payments"
              value={
                loading
                  ? "..."
                  : `Rs. ${formatMoney(totalPayments)}`
              }
              description="Purchase payments recorded"
              icon={<ArrowUpIcon className="h-5 w-5" />}
              color="blue"
              loading={loading}
            />

            <Stat
              title="Net Movement"
              value={
                loading
                  ? "..."
                  : `${netMovement < 0 ? "-" : ""}Rs. ${formatMoney(
                      Math.abs(netMovement)
                    )}`
              }
              description="Receipts minus payments"
              icon={<BalanceIcon className="h-5 w-5" />}
              color={netMovement < 0 ? "blue" : "emerald"}
              loading={loading}
            />
          </div>
        </section>

        {/* TRANSACTION TABLE */}

        <section className={panelClass}>
          <div className="flex flex-col gap-4 border-b border-slate-200 p-5 dark:border-slate-800 sm:p-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-start gap-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300">
                  <DocumentIcon className="h-5 w-5" />
                </div>

                <div>
                  <h2 className="text-lg font-extrabold text-slate-900 dark:text-white">
                    Payment Transactions
                  </h2>

                  <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                    Detailed sales receipts and purchase payments
                  </p>
                </div>
              </div>

              <span className="w-fit rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
                {loading
                  ? "Loading records..."
                  : `${filteredPayments.length} of ${payments.length} records`}
              </span>
            </div>

            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
              <div className="relative xl:col-span-1">
                <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />

                <input
                  type="search"
                  aria-label="Search payment transactions"
                  placeholder="Search transactions..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 bg-white py-3 pl-10 pr-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:placeholder:text-slate-500"
                />
              </div>

              <select
                aria-label="Filter by transaction type"
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
                className="rounded-xl border border-slate-300 bg-white px-3 py-3 text-sm text-slate-700 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200"
              >
                <option value="ALL">All transaction types</option>
                <option value="RECEIPT">Receipts</option>
                <option value="PAYMENT">Payments</option>
              </select>

              <select
                aria-label="Filter by payment method"
                value={methodFilter}
                onChange={(e) => setMethodFilter(e.target.value)}
                className="rounded-xl border border-slate-300 bg-white px-3 py-3 text-sm text-slate-700 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200"
              >
                <option value="ALL">All payment methods</option>

                {methods.map((method) => (
                  <option key={method} value={method}>
                    {method}
                  </option>
                ))}
              </select>

              <select
                aria-label="Sort payment transactions"
                value={sortOrder}
                onChange={(e) => setSortOrder(e.target.value)}
                className="rounded-xl border border-slate-300 bg-white px-3 py-3 text-sm text-slate-700 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200"
              >
                <option value="newest">Newest first</option>
                <option value="oldest">Oldest first</option>
                <option value="amount-high">Highest amount</option>
                <option value="amount-low">Lowest amount</option>
              </select>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Search by number, party, method, reference, date, or type.
              </p>

              <button
                type="button"
                onClick={clearFilters}
                className="inline-flex w-fit items-center gap-2 rounded-lg px-3 py-2 text-xs font-bold text-blue-700 transition hover:bg-blue-50 dark:text-blue-300 dark:hover:bg-blue-950/50"
              >
                <RefreshIcon className="h-3.5 w-3.5" />
                Reset filters
              </button>
            </div>
          </div>

          {loading ? (
            <div className="space-y-3 p-5 sm:p-6">
              {[1, 2, 3, 4, 5].map((item) => (
                <div
                  key={item}
                  className="h-12 animate-pulse rounded-xl bg-slate-100 dark:bg-slate-800"
                />
              ))}

              <p className="py-3 text-center text-sm text-slate-500 dark:text-slate-400">
                Loading payment transactions...
              </p>
            </div>
          ) : !data ? (
            <EmptyState
              title="Payment data unavailable"
              description="Check your connection and API, then refresh the report."
              icon={<AlertIcon className="h-7 w-7" />}
            />
          ) : filteredPayments.length === 0 ? (
            <EmptyState
              title={
                payments.length === 0
                  ? "No payment transactions found"
                  : "No matching transactions"
              }
              description={
                payments.length === 0
                  ? "There are no payment records available in this report."
                  : "Try changing your search text or filters to see more records."
              }
              icon={<SearchIcon className="h-7 w-7" />}
            />
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[1050px] text-sm">
                  <thead className="bg-slate-50/90 dark:bg-slate-950/70">
                    <tr>
                      <TableHeader>Date</TableHeader>
                      <TableHeader>Payment Number</TableHeader>
                      <TableHeader>Transaction Type</TableHeader>
                      <TableHeader>Party</TableHeader>
                      <TableHeader align="right">
                        Amount (PKR)
                      </TableHeader>
                      <TableHeader>Method</TableHeader>
                      <TableHeader>Reference</TableHeader>
                    </tr>
                  </thead>

                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {filteredPayments.map((payment, index) => {
                      const isReceipt =
                        String(
                          payment.transaction_type || ""
                        ).toUpperCase() === "RECEIPT";

                      return (
                        <tr
                          key={`${payment.transaction_type}-${payment.payment_id ?? payment.payment_number ?? index}`}
                          className="group transition-colors hover:bg-blue-50/50 dark:hover:bg-blue-950/20"
                        >
                          <td className="whitespace-nowrap px-5 py-4 text-slate-600 dark:text-slate-300">
                            {formatDate(payment.payment_date)}
                          </td>

                          <td className="whitespace-nowrap px-5 py-4">
                            <span className="font-mono text-xs font-bold text-slate-800 dark:text-slate-100">
                              {payment.payment_number || "-"}
                            </span>
                          </td>

                          <td className="px-5 py-4">
                            <span
                              className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-bold ${
                                isReceipt
                                  ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/50 dark:text-emerald-300"
                                  : "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-900 dark:bg-blue-950/50 dark:text-blue-300"
                              }`}
                            >
                              {isReceipt ? (
                                <ArrowDownIcon className="h-3.5 w-3.5" />
                              ) : (
                                <ArrowUpIcon className="h-3.5 w-3.5" />
                              )}

                              {payment.transaction_type || "-"}
                            </span>
                          </td>

                          <td className="px-5 py-4">
                            <div className="flex items-center gap-3">
                              <div
                                className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-xs font-extrabold ${
                                  isReceipt
                                    ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300"
                                    : "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300"
                                }`}
                              >
                                {getInitials(payment.party_name)}
                              </div>

                              <span className="font-semibold text-slate-800 dark:text-slate-100">
                                {payment.party_name || "-"}
                              </span>
                            </div>
                          </td>

                          <td className="whitespace-nowrap px-5 py-4 text-right font-extrabold tabular-nums text-slate-900 dark:text-white">
                            {formatMoney(payment.amount)}
                          </td>

                          <td className="px-5 py-4">
                            <span className="inline-flex items-center gap-2 text-slate-600 dark:text-slate-300">
                              <span className="h-2 w-2 rounded-full bg-blue-500" />
                              {payment.payment_method || "-"}
                            </span>
                          </td>

                          <td className="px-5 py-4 text-slate-500 dark:text-slate-400">
                            {payment.reference_number ? (
                              <span className="rounded-md bg-slate-100 px-2 py-1 font-mono text-xs dark:bg-slate-800">
                                {payment.reference_number}
                              </span>
                            ) : (
                              "-"
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>

                  <tfoot className="border-t border-slate-200 bg-slate-50/80 dark:border-slate-800 dark:bg-slate-950/70">
                    <tr>
                      <td
                        colSpan={4}
                        className="px-5 py-4 font-extrabold text-slate-800 dark:text-slate-100"
                      >
                        Filtered total
                      </td>

                      <td className="whitespace-nowrap px-5 py-4 text-right font-extrabold tabular-nums text-emerald-700 dark:text-emerald-400">
                        {formatMoney(filteredTotal)}
                      </td>

                      <td colSpan={2} className="px-5 py-4 text-right">
                        <span className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">
                          {filteredPayments.length} records
                        </span>
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>

              <div className="flex flex-col gap-2 border-t border-slate-200 bg-slate-50/70 px-5 py-3 text-xs text-slate-500 dark:border-slate-800 dark:bg-slate-950/40 dark:text-slate-400 sm:flex-row sm:items-center sm:justify-between">
                <span>
                  Showing {filteredPayments.length} of {payments.length} records
                </span>

                <span className="inline-flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-emerald-500" />
                  Amounts are displayed in PKR
                </span>
              </div>
            </>
          )}
        </section>

        <footer className="flex flex-col gap-2 pb-2 text-xs text-slate-400 dark:text-slate-500 sm:flex-row sm:items-center sm:justify-between">
          <span>Payments &amp; Financial Analytics</span>
          <span>Receipts and payments are shown separately.</span>
        </footer>
      </div>
    </main>
  );
}

// --------------------------------------------------
// ACCESS DENIED COMPONENT
// --------------------------------------------------

function AccessDenied({
  title,
  description,
  onRetry,
  retrying,
}) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 p-5 dark:bg-slate-950">
      <section className="w-full max-w-lg rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-xl shadow-slate-200/40 dark:border-slate-800 dark:bg-slate-900 dark:shadow-black/20 sm:p-10">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-red-50 text-red-600 dark:bg-red-950/40 dark:text-red-400">
          <LockIcon className="h-8 w-8" />
        </div>

        <h1 className="mt-6 text-2xl font-extrabold text-slate-950 dark:text-white">
          {title}
        </h1>

        <p className="mt-3 text-sm leading-6 text-slate-500 dark:text-slate-400">
          {description}
        </p>

        <button
          type="button"
          onClick={onRetry}
          disabled={retrying}
          className={`${buttonClass} mt-7 disabled:cursor-not-allowed disabled:opacity-50`}
        >
          <RefreshIcon
            className={`h-4 w-4 ${
              retrying ? "animate-spin" : ""
            }`}
          />
          Retry Permission Check
        </button>
      </section>
    </main>
  );
}

// --------------------------------------------------
// SUMMARY CARD
// --------------------------------------------------

function Stat({
  title,
  value,
  description,
  icon,
  color,
  loading,
}) {
  const colors = {
    green: {
      icon: "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300",
      glow: "from-green-500/10",
      bar: "bg-green-500",
    },
    blue: {
      icon: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
      glow: "from-blue-500/10",
      bar: "bg-blue-500",
    },
    emerald: {
      icon: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
      glow: "from-emerald-500/10",
      bar: "bg-emerald-500",
    },
  };

  const theme = colors[color] || colors.blue;

  return (
    <article className="group relative overflow-hidden rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm shadow-slate-200/30 transition-all duration-300 hover:-translate-y-1 hover:border-blue-200 hover:shadow-lg dark:border-slate-800 dark:bg-slate-900 dark:shadow-black/10 dark:hover:border-slate-700 sm:p-6">
      <div
        className={`pointer-events-none absolute inset-0 bg-gradient-to-br ${theme.glow} via-transparent to-transparent`}
      />

      <div className="relative">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-slate-500 dark:text-slate-400">
              {title}
            </p>

            <div className="mt-3 break-words text-xl font-extrabold tracking-tight text-slate-950 dark:text-white sm:text-2xl">
              {loading ? (
                <span className="inline-block h-7 w-28 animate-pulse rounded-lg bg-slate-200 dark:bg-slate-700" />
              ) : (
                value
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

// --------------------------------------------------
// HEADER INFO
// --------------------------------------------------

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

// --------------------------------------------------
// EMPTY STATE
// --------------------------------------------------

function EmptyState({ title, description, icon }) {
  return (
    <div className="px-5 py-14 text-center sm:px-8">
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-50 text-blue-600 dark:bg-blue-950/50 dark:text-blue-300">
        {icon}
      </div>

      <h3 className="mt-4 font-bold text-slate-900 dark:text-white">
        {title}
      </h3>

      <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-500 dark:text-slate-400">
        {description}
      </p>
    </div>
  );
}

// --------------------------------------------------
// TABLE HEADER
// --------------------------------------------------

function TableHeader({ children, align = "left" }) {
  return (
    <th
      className={`whitespace-nowrap px-5 py-4 text-${align} text-[11px] font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400`}
    >
      {children}
    </th>
  );
}

// --------------------------------------------------
// HELPERS
// --------------------------------------------------

function getInitials(name) {
  const words = String(name || "Party")
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  return words
    .slice(0, 2)
    .map((word) => word[0].toUpperCase())
    .join("");
}

// --------------------------------------------------
// INLINE SVG ICONS
// --------------------------------------------------

function PaymentIcon({ className = "h-5 w-5" }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="2.5" y="5" width="19" height="14" rx="2.5" />
      <path d="M2.5 10h19M7 15h3M16 15h.01" />
    </svg>
  );
}

function ArrowDownIcon({ className = "h-5 w-5" }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M12 3v18M5 14l7 7 7-7" />
    </svg>
  );
}

function ArrowUpIcon({ className = "h-5 w-5" }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M12 21V3M5 10l7-7 7 7" />
    </svg>
  );
}

function BalanceIcon({ className = "h-5 w-5" }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
    </svg>
  );
}

function DocumentIcon({ className = "h-5 w-5" }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <path d="M14 2v6h6M8 13h8M8 17h8M8 9h2" />
    </svg>
  );
}

function SearchIcon({ className = "h-5 w-5" }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-4-4" />
    </svg>
  );
}

function RefreshIcon({ className = "h-5 w-5" }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M20 7v5h-5M4 17v-5h5" />
      <path d="M5.6 9a7 7 0 0 1 11.6-2L20 12M4 12l2.8 5a7 7 0 0 0 11.6-2" />
    </svg>
  );
}

function AlertIcon({ className = "h-5 w-5" }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="m10.3 3.9-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.7-3.1l-8-14a2 2 0 0 0-3.4 0Z" />
      <path d="M12 9v4M12 17h.01" />
    </svg>
  );
}

function LockIcon({ className = "h-5 w-5" }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="3" y="11" width="18" height="10" rx="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  );
}