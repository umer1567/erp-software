"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Activity,
  ArrowDownLeft,
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  Banknote,
  CalendarDays,
  CheckCircle2,
  CircleDollarSign,
  Clock3,
  FileText,
  Landmark,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
  Wallet,
  X,
  AlertCircle,
  ArrowDownToLine,
  RotateCcw,
  LockKeyhole,
} from "lucide-react";

const PERMISSION_KEY = "cash_bank";
const PERMISSIONS_URL = "/api/permissions/current";

const emptyForm = {
  accountId: "",
  transactionType: "RECEIPT",
  date: "",
  amount: "",
  referenceNumber: "",
  description: "",
};

const inputClass =
  "w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-800 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:border-blue-400 dark:focus:ring-blue-400/10";

const labelClass =
  "mb-2 block text-sm font-semibold text-slate-700 dark:text-slate-300";

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

function getLocalDate() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function formatAmount(value) {
  const amount = Number(value || 0);

  return (Number.isFinite(amount) ? amount : 0).toLocaleString("en-PK", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function formatDate(value) {
  if (!value) return "-";

  const dateString = String(value).substring(0, 10);

  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateString)) {
    return dateString;
  }

  const [year, month, day] = dateString.split("-").map(Number);
  const date = new Date(year, month - 1, day);

  if (Number.isNaN(date.getTime())) return dateString;

  return date.toLocaleDateString("en-PK", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function normalizeList(data, propertyName) {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.[propertyName])) return data[propertyName];

  return [];
}

function PermissionMessage({
  title,
  message,
  onRetry,
  loading = false,
}) {
  return (
    <div className="flex min-h-[70vh] items-center justify-center bg-slate-50 p-4 dark:bg-slate-950">
      <div className="w-full max-w-lg rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-xl dark:border-slate-800 dark:bg-slate-900">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:text-amber-400">
          {loading ? (
            <RefreshCw size={30} className="animate-spin" />
          ) : (
            <LockKeyhole size={30} />
          )}
        </div>

        <h1 className="mt-5 text-2xl font-bold text-slate-900 dark:text-white">
          {title}
        </h1>

        <p className="mt-3 text-sm leading-6 text-slate-600 dark:text-slate-400">
          {message}
        </p>

        {onRetry && (
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
            Retry
          </button>
        )}
      </div>
    </div>
  );
}

function StatCard({ title, value, subtitle, icon: Icon, tone }) {
  const tones = {
    blue: {
      icon: "bg-blue-50 text-blue-600 ring-blue-100 dark:bg-blue-500/10 dark:text-blue-400 dark:ring-blue-500/20",
      accent: "from-blue-500 to-cyan-400",
      glow: "bg-blue-500/5 dark:bg-blue-400/5",
    },
    green: {
      icon: "bg-emerald-50 text-emerald-600 ring-emerald-100 dark:bg-emerald-500/10 dark:text-emerald-400 dark:ring-emerald-500/20",
      accent: "from-emerald-500 to-green-400",
      glow: "bg-emerald-500/5 dark:bg-emerald-400/5",
    },
    red: {
      icon: "bg-rose-50 text-rose-600 ring-rose-100 dark:bg-rose-500/10 dark:text-rose-400 dark:ring-rose-500/20",
      accent: "from-rose-500 to-orange-400",
      glow: "bg-rose-500/5 dark:bg-rose-400/5",
    },
    violet: {
      icon: "bg-violet-50 text-violet-600 ring-violet-100 dark:bg-violet-500/10 dark:text-violet-400 dark:ring-violet-500/20",
      accent: "from-violet-500 to-blue-400",
      glow: "bg-violet-500/5 dark:bg-violet-400/5",
    },
  };

  const style = tones[tone] || tones.blue;

  return (
    <div className="group relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition duration-300 hover:-translate-y-0.5 hover:shadow-lg dark:border-slate-800 dark:bg-slate-900 sm:p-6">
      <div
        className={`pointer-events-none absolute -right-8 -top-8 h-28 w-28 rounded-full blur-2xl ${style.glow}`}
      />

      <div
        className={`absolute inset-x-0 top-0 h-1 bg-gradient-to-r ${style.accent}`}
      />

      <div className="relative flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
            {title}
          </p>

          <p className="mt-3 break-words text-2xl font-bold tracking-tight text-slate-900 dark:text-white sm:text-3xl">
            {value}
          </p>

          <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
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

function MessageBanner({ type, message, onDismiss }) {
  if (!message) return null;

  const isSuccess = type === "success";

  return (
    <div
      role={isSuccess ? "status" : "alert"}
      className={`mb-5 flex items-start gap-3 rounded-2xl border p-4 shadow-sm ${
        isSuccess
          ? "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900/70 dark:bg-emerald-950/40 dark:text-emerald-300"
          : "border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-900/70 dark:bg-rose-950/40 dark:text-rose-300"
      }`}
    >
      <div className="mt-0.5 shrink-0">
        {isSuccess ? (
          <CheckCircle2 size={19} />
        ) : (
          <AlertCircle size={19} />
        )}
      </div>

      <p className="flex-1 text-sm font-medium leading-6">{message}</p>

      <button
        type="button"
        onClick={onDismiss}
        aria-label="Dismiss message"
        className="rounded-lg p-1 transition hover:bg-black/5 dark:hover:bg-white/10"
      >
        <X size={17} />
      </button>
    </div>
  );
}

export default function CashBankPage() {
  const [permissions, setPermissions] = useState({
    can_view: false,
    can_create: false,
    can_update: false,
    can_delete: false,
  });

  const [permissionLoading, setPermissionLoading] = useState(true);
  const [permissionError, setPermissionError] = useState("");

  const [accounts, setAccounts] = useState([]);
  const [transactions, setTransactions] = useState([]);

  const [form, setForm] = useState({ ...emptyForm });
  const [showForm, setShowForm] = useState(false);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);

  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("ALL");

  const canView = permissions.can_view;
  const canCreate = permissions.can_create;
  const canUpdate = permissions.can_update;
  const canDelete = permissions.can_delete;

  /*
   * Load permissions for the current user.
   * The endpoint should return:
   * { permissions: [{ permission_key, can_view, can_create, can_update, can_delete }] }
   */
  const loadPermissions = useCallback(async (signal) => {
    const response = await fetch(PERMISSIONS_URL, {
      method: "GET",
      credentials: "same-origin",
      cache: "no-store",
      signal,
      headers: {
        Accept: "application/json",
      },
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(
        data?.message || "Unable to load your permissions."
      );
    }

    if (!Array.isArray(data.permissions)) {
      throw new Error("The permissions response is invalid.");
    }

    const permission = data.permissions.find(
      (item) =>
        normalizePermissionKey(item.permission_key) === PERMISSION_KEY
    );

    const nextPermissions = {
      can_view: toBoolean(permission?.can_view),
      can_create: toBoolean(permission?.can_create),
      can_update: toBoolean(permission?.can_update),
      can_delete: toBoolean(permission?.can_delete),
    };

    if (signal?.aborted) return;

    setPermissions(nextPermissions);
    setPermissionError("");
    setPermissionLoading(false);

    if (!nextPermissions.can_view) {
      setShowForm(false);
    }
  }, []);

  const refreshPermissions = useCallback(async () => {
    const controller = new AbortController();

    setPermissionLoading(true);
    setPermissionError("");

    try {
      await loadPermissions(controller.signal);
    } catch (err) {
      if (err.name === "AbortError") return;

      setPermissionError(
        err.message || "Unable to load your permissions."
      );
      setPermissionLoading(false);
    }

    return () => controller.abort();
  }, [loadPermissions]);

  useEffect(() => {
    let active = true;
    const controller = new AbortController();

    async function initializePermissions() {
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

        const data = await response.json();

        if (!response.ok) {
          throw new Error(
            data?.message || "Unable to load your permissions."
          );
        }

        if (!Array.isArray(data.permissions)) {
          throw new Error("The permissions response is invalid.");
        }

        const permission = data.permissions.find(
          (item) =>
            normalizePermissionKey(item.permission_key) ===
            PERMISSION_KEY
        );

        const nextPermissions = {
          can_view: toBoolean(permission?.can_view),
          can_create: toBoolean(permission?.can_create),
          can_update: toBoolean(permission?.can_update),
          can_delete: toBoolean(permission?.can_delete),
        };

        if (!active) return;

        setPermissions(nextPermissions);
        setPermissionError("");
        setPermissionLoading(false);
      } catch (err) {
        if (!active || err.name === "AbortError") return;

        setPermissionError(
          err.message || "Unable to load your permissions."
        );
        setPermissionLoading(false);
      }
    }

    void initializePermissions();

    return () => {
      active = false;
      controller.abort();
    };
  }, []);

  // Reload permissions when User Rights are updated.
  useEffect(() => {
    let active = true;
    let controller = null;

    async function refreshFromServer() {
      controller?.abort();
      controller = new AbortController();

      setPermissionLoading(true);
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

        const data = await response.json();

        if (!response.ok) {
          throw new Error(
            data?.message || "Unable to refresh permissions."
          );
        }

        if (!Array.isArray(data.permissions)) {
          throw new Error("The permissions response is invalid.");
        }

        const permission = data.permissions.find(
          (item) =>
            normalizePermissionKey(item.permission_key) ===
            PERMISSION_KEY
        );

        const nextPermissions = {
          can_view: toBoolean(permission?.can_view),
          can_create: toBoolean(permission?.can_create),
          can_update: toBoolean(permission?.can_update),
          can_delete: toBoolean(permission?.can_delete),
        };

        if (!active) return;

        setPermissions(nextPermissions);
        setPermissionError("");
        setPermissionLoading(false);

        if (!nextPermissions.can_view) {
          setShowForm(false);
        }
      } catch (err) {
        if (!active || err.name === "AbortError") return;

        setPermissionError(
          err.message || "Unable to refresh permissions."
        );
        setPermissionLoading(false);
      }
    }

    function handlePermissionsUpdated() {
      void refreshFromServer();
    }

    function handleWindowFocus() {
      if (document.visibilityState === "visible") {
        void refreshFromServer();
      }
    }

    window.addEventListener(
      "erp-permissions-updated",
      handlePermissionsUpdated
    );

    window.addEventListener("focus", handleWindowFocus);

    document.addEventListener(
      "visibilitychange",
      handleWindowFocus
    );

    return () => {
      active = false;
      controller?.abort();

      window.removeEventListener(
        "erp-permissions-updated",
        handlePermissionsUpdated
      );

      window.removeEventListener("focus", handleWindowFocus);

      document.removeEventListener(
        "visibilitychange",
        handleWindowFocus
      );
    };
  }, []);

  const loadData = useCallback(async () => {
    const [accountsResponse, transactionsResponse] = await Promise.all([
      fetch("/api/accounts?postingOnly=true", {
        credentials: "same-origin",
        cache: "no-store",
      }),
      fetch("/api/cash-bank", {
        credentials: "same-origin",
        cache: "no-store",
      }),
    ]);

    const [accountsData, transactionsData] = await Promise.all([
      accountsResponse.json(),
      transactionsResponse.json(),
    ]);

    if (!accountsResponse.ok || accountsData?.success === false) {
      throw new Error(
        accountsData?.message || "Failed to load accounts."
      );
    }

    if (
      !transactionsResponse.ok ||
      transactionsData?.success === false
    ) {
      throw new Error(
        transactionsData?.message ||
          "Failed to load cash/bank transactions."
      );
    }

    const accountList = normalizeList(accountsData, "accounts");
    const transactionList = normalizeList(
      transactionsData,
      "transactions"
    );

    setAccounts(
      accountList.filter(
        (account) =>
          toBoolean(account.is_cash_bank) ||
          toBoolean(account.isCashBank)
      )
    );

    setTransactions(transactionList);
  }, []);

  // Load Cash / Bank data only after view permission has been granted.
  useEffect(() => {
    if (permissionLoading || permissionError || !canView) {
      return;
    }

    let active = true;

    async function fetchPageData() {
      try {
        const [accountsResponse, transactionsResponse] =
          await Promise.all([
            fetch("/api/accounts?postingOnly=true", {
              credentials: "same-origin",
              cache: "no-store",
            }),
            fetch("/api/cash-bank", {
              credentials: "same-origin",
              cache: "no-store",
            }),
          ]);

        const [accountsData, transactionsData] = await Promise.all([
          accountsResponse.json(),
          transactionsResponse.json(),
        ]);

        if (!accountsResponse.ok || accountsData?.success === false) {
          throw new Error(
            accountsData?.message || "Failed to load accounts."
          );
        }

        if (
          !transactionsResponse.ok ||
          transactionsData?.success === false
        ) {
          throw new Error(
            transactionsData?.message ||
              "Failed to load cash/bank transactions."
          );
        }

        if (!active) return;

        const accountList = normalizeList(accountsData, "accounts");
        const transactionList = normalizeList(
          transactionsData,
          "transactions"
        );

        setAccounts(
          accountList.filter(
            (account) =>
              toBoolean(account.is_cash_bank) ||
              toBoolean(account.isCashBank)
          )
        );

        setTransactions(transactionList);
        setError("");
      } catch (err) {
        if (active) {
          setError(err.message || "Unable to load Cash / Bank data.");
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    void fetchPageData();

    return () => {
      active = false;
    };
  }, [permissionLoading, permissionError, canView]);

  const totals = useMemo(() => {
    return transactions.reduce(
      (result, transaction) => {
        result.debit += Number(transaction.debit || 0);
        result.credit += Number(transaction.credit || 0);
        return result;
      },
      { debit: 0, credit: 0 }
    );
  }, [transactions]);

  const latestBalance = useMemo(() => {
    if (transactions.length === 0) return 0;

    const transactionWithBalance = transactions.find(
      (transaction) =>
        transaction.balance !== null &&
        transaction.balance !== undefined &&
        transaction.balance !== ""
    );

    return Number(transactionWithBalance?.balance || 0);
  }, [transactions]);

  const filteredTransactions = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();

    return transactions.filter((transaction) => {
      const debit = Number(transaction.debit || 0);
      const credit = Number(transaction.credit || 0);

      const type =
        debit > 0 ? "RECEIPT" : credit > 0 ? "PAYMENT" : "OTHER";

      const matchesType =
        typeFilter === "ALL" || type === typeFilter;

      const searchableText = [
        transaction.account_code,
        transaction.account_name,
        transaction.description,
        transaction.reference_number,
        transaction.journal_date,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      const matchesSearch =
        !normalizedSearch || searchableText.includes(normalizedSearch);

      return matchesType && matchesSearch;
    });
  }, [transactions, search, typeFilter]);

  function openAddForm() {
    if (!canCreate) {
      setError("You do not have permission to create Cash / Bank transactions.");
      return;
    }

    setForm({
      ...emptyForm,
      date: getLocalDate(),
    });

    setMessage("");
    setError("");
    setShowForm(true);
  }

  function cancelForm() {
    if (saving) return;

    setForm({ ...emptyForm });
    setShowForm(false);
    setError("");
  }

  function handleChange(event) {
    const { name, value } = event.target;

    setForm((previous) => ({
      ...previous,
      [name]: value,
    }));
  }

  async function handleRefresh() {
    setRefreshing(true);
    setError("");
    setMessage("");

    try {
      await loadData();
    } catch (err) {
      setError(err.message || "Unable to refresh transactions.");
    } finally {
      setRefreshing(false);
    }
  }

  async function handleSubmit(event) {
    event.preventDefault();

    setMessage("");
    setError("");

    if (!canView) {
      setError("You do not have permission to view Cash / Bank.");
      return;
    }

    if (!canCreate) {
      setError("You do not have permission to create transactions.");
      return;
    }

    if (!form.accountId) {
      setError("Please select a Cash / Bank account.");
      return;
    }

    if (!form.date) {
      setError("Please select a transaction date.");
      return;
    }

    const amount = Number(form.amount);

    if (!form.amount || !Number.isFinite(amount) || amount <= 0) {
      setError("Please enter a valid amount greater than zero.");
      return;
    }

    setSaving(true);

    try {
      const response = await fetch("/api/cash-bank", {
        method: "POST",
        credentials: "same-origin",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          accountId: Number(form.accountId),
          transactionType: form.transactionType,
          date: form.date,
          amount,
          referenceNumber: form.referenceNumber.trim(),
          description: form.description.trim(),
        }),
      });

      const data = await response.json();

      if (!response.ok || data?.success === false) {
        throw new Error(data?.message || "Failed to save transaction.");
      }

      await loadData();

      setForm({ ...emptyForm });
      setShowForm(false);
      setMessage("Cash / Bank transaction saved successfully.");
      setError("");
    } catch (err) {
      setError(err.message || "Failed to save transaction.");
    } finally {
      setSaving(false);
    }
  }

  function resetSearch() {
    setSearch("");
    setTypeFilter("ALL");
  }

  const hasActiveFilters =
    search.trim() !== "" || typeFilter !== "ALL";

  if (permissionLoading) {
    return (
      <PermissionMessage
        loading
        title="Checking permissions"
        message="Please wait while we verify your Cash / Bank access."
      />
    );
  }

  if (permissionError) {
    return (
      <PermissionMessage
        title="Unable to verify permissions"
        message={permissionError}
        onRetry={refreshPermissions}
      />
    );
  }

  if (!canView) {
    return (
      <PermissionMessage
        title="Access denied"
        message="You do not have View permission for Cash / Bank. Contact your administrator or ask them to enable View in User Rights."
      />
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 p-4 text-slate-900 transition-colors dark:bg-slate-950 dark:text-slate-100 sm:p-6 lg:p-8">
      <div className="mx-auto max-w-[1600px] space-y-6">
        {/* PAGE HEADER */}
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-blue-700 via-blue-600 to-emerald-600 p-6 text-white shadow-xl shadow-blue-900/10 sm:p-8">
          <div className="pointer-events-none absolute -right-16 -top-24 h-72 w-72 rounded-full border-[35px] border-white/10" />
          <div className="pointer-events-none absolute -bottom-24 right-1/4 h-56 w-56 rounded-full bg-emerald-300/10 blur-3xl" />

          <div className="relative flex flex-col justify-between gap-6 lg:flex-row lg:items-center">
            <div className="flex items-start gap-4">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-white/20 bg-white/15 shadow-inner backdrop-blur-sm sm:h-16 sm:w-16">
                <Landmark size={30} strokeWidth={1.8} />
              </div>

              <div>
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <span className="rounded-full border border-white/20 bg-white/15 px-3 py-1 text-xs font-semibold tracking-wide text-white/95">
                    FINANCE MANAGEMENT
                  </span>

                  <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-300/20 px-3 py-1 text-xs font-semibold text-emerald-50">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-300" />
                    Cash & Bank
                  </span>
                </div>

                <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
                  Cash / Bank
                </h1>

                <p className="mt-2 max-w-xl text-sm leading-6 text-blue-50 sm:text-base">
                  Manage receipts, payments, and cash or bank transaction
                  history from one place.
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              {!showForm ? (
                <>
                  <button
                    type="button"
                    onClick={handleRefresh}
                    disabled={refreshing || loading}
                    className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/25 bg-white/10 px-4 py-3 text-sm font-semibold text-white shadow-sm backdrop-blur-sm transition hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <RefreshCw
                      size={17}
                      className={refreshing ? "animate-spin" : ""}
                    />
                    Refresh
                  </button>

                  {canCreate && (
                    <button
                      type="button"
                      onClick={openAddForm}
                      className="inline-flex items-center justify-center gap-2 rounded-xl bg-white px-5 py-3 text-sm font-bold text-blue-700 shadow-lg shadow-blue-950/10 transition hover:-translate-y-0.5 hover:bg-blue-50"
                    >
                      <Plus size={19} />
                      Add Transaction
                    </button>
                  )}
                </>
              ) : (
                <button
                  type="button"
                  onClick={cancelForm}
                  disabled={saving}
                  className="inline-flex items-center gap-2 rounded-xl border border-white/25 bg-white/10 px-5 py-3 text-sm font-semibold text-white transition hover:bg-white/20 disabled:opacity-50"
                >
                  <ArrowLeft size={17} />
                  Back to Transactions
                </button>
              )}
            </div>
          </div>

          <div className="relative mt-7 flex flex-wrap items-center gap-x-6 gap-y-3 border-t border-white/20 pt-5 text-sm text-blue-50">
            <div className="flex items-center gap-2">
              <ShieldCheck size={17} />
              <span>Financial transaction records</span>
            </div>

            <div className="flex items-center gap-2">
              <Clock3 size={17} />
              <span>Transaction history and balances</span>
            </div>

            <div className="flex items-center gap-2">
              <Activity size={17} />
              <span>{transactions.length} recorded transactions</span>
            </div>
          </div>
        </div>

        {/* NOTIFICATIONS */}
        <MessageBanner
          type="success"
          message={message}
          onDismiss={() => setMessage("")}
        />

        <MessageBanner
          type="error"
          message={error}
          onDismiss={() => setError("")}
        />

        {/* SUMMARY CARDS */}
        {!showForm && (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard
              title="Total Transactions"
              value={transactions.length.toLocaleString("en-PK")}
              subtitle="Recorded cash and bank entries"
              icon={FileText}
              tone="blue"
            />

            <StatCard
              title="Total Receipts"
              value={formatAmount(totals.debit)}
              subtitle="Total debit entries in history"
              icon={ArrowDownLeft}
              tone="green"
            />

            <StatCard
              title="Total Payments"
              value={formatAmount(totals.credit)}
              subtitle="Total credit entries in history"
              icon={ArrowUpRight}
              tone="red"
            />

            <StatCard
              title="Latest Balance"
              value={formatAmount(latestBalance)}
              subtitle="Balance from the latest available entry"
              icon={Wallet}
              tone="violet"
            />
          </div>
        )}

        {/* ADD TRANSACTION FORM */}
        {showForm && canCreate && (
          <section className={`${cardClass} overflow-hidden`}>
            <div className="relative overflow-hidden border-b border-slate-200 bg-gradient-to-r from-blue-50 via-white to-emerald-50 px-5 py-6 dark:border-slate-800 dark:from-blue-950/40 dark:via-slate-900 dark:to-emerald-950/30 sm:px-7">
              <div className="flex items-start gap-4">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-600 to-emerald-500 text-white shadow-lg shadow-blue-500/20">
                  <CircleDollarSign size={25} />
                </div>

                <div>
                  <h2 className="text-xl font-bold text-slate-900 dark:text-white sm:text-2xl">
                    Add Cash / Bank Transaction
                  </h2>

                  <p className="mt-1 text-sm leading-6 text-slate-500 dark:text-slate-400">
                    Enter the transaction details below. Fields marked with{" "}
                    <span className="font-semibold text-rose-500">*</span>{" "}
                    are required.
                  </p>
                </div>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="p-5 sm:p-7">
              <div className="mb-7">
                <label className={labelClass}>Transaction Type *</label>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {[
                    {
                      type: "RECEIPT",
                      title: "Receipt",
                      description: "Money received into your account",
                      icon: ArrowDownLeft,
                      selectedClass:
                        "border-emerald-400 bg-emerald-50 ring-2 ring-emerald-500/10 dark:border-emerald-500/60 dark:bg-emerald-950/30",
                      iconClass: "bg-emerald-600 text-white",
                    },
                    {
                      type: "PAYMENT",
                      title: "Payment",
                      description: "Money paid out from your account",
                      icon: ArrowUpRight,
                      selectedClass:
                        "border-blue-400 bg-blue-50 ring-2 ring-blue-500/10 dark:border-blue-500/60 dark:bg-blue-950/30",
                      iconClass: "bg-blue-600 text-white",
                    },
                  ].map((option) => {
                    const OptionIcon = option.icon;
                    const selected =
                      form.transactionType === option.type;

                    return (
                      <button
                        key={option.type}
                        type="button"
                        onClick={() =>
                          setForm((previous) => ({
                            ...previous,
                            transactionType: option.type,
                          }))
                        }
                        className={`flex items-center gap-4 rounded-2xl border p-4 text-left transition ${
                          selected
                            ? option.selectedClass
                            : "border-slate-200 bg-white hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-950 dark:hover:bg-slate-800"
                        }`}
                      >
                        <span
                          className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${
                            selected
                              ? option.iconClass
                              : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300"
                          }`}
                        >
                          <OptionIcon size={23} />
                        </span>

                        <span className="flex-1">
                          <span className="block font-bold text-slate-900 dark:text-white">
                            {option.title}
                          </span>
                          <span className="mt-1 block text-xs text-slate-500 dark:text-slate-400">
                            {option.description}
                          </span>
                        </span>

                        <span
                          className={`h-4 w-4 rounded-full border-2 ${
                            selected
                              ? "border-blue-600 bg-blue-600 ring-2 ring-blue-500/20"
                              : "border-slate-300 dark:border-slate-600"
                          }`}
                        />
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="grid grid-cols-1 gap-x-6 gap-y-5 md:grid-cols-2">
                <div>
                  <label htmlFor="accountId" className={labelClass}>
                    Cash / Bank Account{" "}
                    <span className="text-rose-500">*</span>
                  </label>

                  <div className="relative">
                    <Landmark
                      size={18}
                      className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
                    />

                    <select
                      id="accountId"
                      name="accountId"
                      value={form.accountId}
                      onChange={handleChange}
                      required
                      className={`${inputClass} pl-10`}
                    >
                      <option value="">Select Cash / Bank Account</option>

                      {accounts.map((account) => (
                        <option
                          key={account.account_id}
                          value={account.account_id}
                        >
                          {account.account_code} - {account.account_name}
                        </option>
                      ))}
                    </select>
                  </div>

                  {accounts.length === 0 && (
                    <p className="mt-2 flex items-start gap-2 text-xs leading-5 text-amber-700 dark:text-amber-300">
                      <AlertCircle size={15} className="mt-0.5 shrink-0" />
                      No Cash / Bank accounts are available. Check your Chart
                      of Accounts and ensure the Cash / Bank flag is enabled.
                    </p>
                  )}
                </div>

                <div>
                  <label htmlFor="date" className={labelClass}>
                    Transaction Date{" "}
                    <span className="text-rose-500">*</span>
                  </label>

                  <div className="relative">
                    <CalendarDays
                      size={18}
                      className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
                    />

                    <input
                      id="date"
                      type="date"
                      name="date"
                      value={form.date}
                      onChange={handleChange}
                      required
                      className={`${inputClass} pl-10`}
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="amount" className={labelClass}>
                    Transaction Amount{" "}
                    <span className="text-rose-500">*</span>
                  </label>

                  <div className="relative">
                    <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-sm font-bold text-slate-400">
                      Rs.
                    </span>

                    <input
                      id="amount"
                      type="number"
                      name="amount"
                      value={form.amount}
                      onChange={handleChange}
                      min="0.01"
                      step="0.01"
                      required
                      placeholder="0.00"
                      className={`${inputClass} pl-12`}
                    />
                  </div>

                  <p className="mt-1.5 text-xs text-slate-500 dark:text-slate-400">
                    Enter an amount greater than zero.
                  </p>
                </div>

                <div>
                  <label htmlFor="referenceNumber" className={labelClass}>
                    Reference Number
                  </label>

                  <div className="relative">
                    <FileText
                      size={18}
                      className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
                    />

                    <input
                      id="referenceNumber"
                      type="text"
                      name="referenceNumber"
                      value={form.referenceNumber}
                      onChange={handleChange}
                      placeholder="Invoice, cheque, or reference no."
                      className={`${inputClass} pl-10`}
                    />
                  </div>
                </div>

                <div className="md:col-span-2">
                  <label htmlFor="description" className={labelClass}>
                    Description
                  </label>

                  <textarea
                    id="description"
                    name="description"
                    value={form.description}
                    onChange={handleChange}
                    rows={3}
                    placeholder="Enter the purpose or details of this transaction..."
                    className={`${inputClass} resize-y`}
                  />
                </div>
              </div>

              <div className="mt-7 flex flex-col-reverse gap-3 border-t border-slate-200 pt-6 dark:border-slate-800 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-xs leading-5 text-slate-500 dark:text-slate-400">
                  Please verify the account, date, and amount before saving.
                </p>

                <div className="flex flex-wrap justify-end gap-3">
                  <button
                    type="button"
                    onClick={cancelForm}
                    disabled={saving}
                    className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
                  >
                    <X size={17} />
                    Cancel
                  </button>

                  <button
                    type="submit"
                    disabled={saving || accounts.length === 0 || !canCreate}
                    className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-emerald-600 px-6 py-3 text-sm font-bold text-white shadow-lg shadow-blue-600/20 transition hover:-translate-y-0.5 hover:from-blue-700 hover:to-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {saving ? (
                      <>
                        <RefreshCw size={17} className="animate-spin" />
                        Saving Transaction...
                      </>
                    ) : (
                      <>
                        <CheckCircle2 size={18} />
                        Save Transaction
                      </>
                    )}
                  </button>
                </div>
              </div>
            </form>
          </section>
        )}

        {/* TRANSACTION HISTORY */}
        {!showForm && (
          <section className={`${cardClass} overflow-hidden`}>
            <div className="flex flex-col justify-between gap-4 border-b border-slate-200 p-5 dark:border-slate-800 sm:p-6 lg:flex-row lg:items-center">
              <div className="flex items-start gap-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-400">
                  <Banknote size={23} />
                </div>

                <div>
                  <h2 className="text-lg font-bold text-slate-900 dark:text-white sm:text-xl">
                    Transaction History
                  </h2>

                  <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                    Review recorded cash receipts and payments.
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <div className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm dark:border-slate-700 dark:bg-slate-950">
                  <FileText
                    size={16}
                    className="text-slate-500 dark:text-slate-400"
                  />

                  <span className="text-slate-500 dark:text-slate-400">
                    Total
                  </span>

                  <span className="font-bold text-slate-900 dark:text-white">
                    {transactions.length}
                  </span>
                </div>

                <button
                  type="button"
                  onClick={handleRefresh}
                  disabled={refreshing || loading}
                  className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:border-blue-700 dark:hover:bg-blue-950/40 dark:hover:text-blue-300"
                >
                  <RefreshCw
                    size={16}
                    className={refreshing ? "animate-spin" : ""}
                  />
                  Refresh
                </button>
              </div>
            </div>

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
                    placeholder="Search account, description, reference..."
                    aria-label="Search transactions"
                    className={`${inputClass} pl-10`}
                  />
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {[
                    { value: "ALL", label: "All" },
                    { value: "RECEIPT", label: "Receipts" },
                    { value: "PAYMENT", label: "Payments" },
                  ].map((filter) => (
                    <button
                      key={filter.value}
                      type="button"
                      onClick={() => setTypeFilter(filter.value)}
                      className={`rounded-xl px-4 py-3 text-sm font-semibold transition ${
                        typeFilter === filter.value
                          ? filter.value === "RECEIPT"
                            ? "bg-emerald-600 text-white shadow-sm"
                            : filter.value === "PAYMENT"
                            ? "bg-blue-600 text-white shadow-sm"
                            : "bg-slate-900 text-white shadow-sm dark:bg-white dark:text-slate-900"
                          : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
                      }`}
                    >
                      {filter.value === "RECEIPT" && (
                        <ArrowDownLeft
                          size={15}
                          className="mr-1 inline"
                        />
                      )}
                      {filter.value === "PAYMENT" && (
                        <ArrowUpRight
                          size={15}
                          className="mr-1 inline"
                        />
                      )}
                      {filter.label}
                    </button>
                  ))}

                  {hasActiveFilters && (
                    <button
                      type="button"
                      onClick={resetSearch}
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
                    {filteredTransactions.length}
                  </strong>{" "}
                  of{" "}
                  <strong className="text-slate-700 dark:text-slate-200">
                    {transactions.length}
                  </strong>{" "}
                  transactions
                </span>

                {hasActiveFilters && (
                  <span className="inline-flex items-center gap-1.5">
                    <Search size={13} />
                    Filters applied
                  </span>
                )}
              </div>
            </div>

            {loading ? (
              <div className="flex min-h-[280px] flex-col items-center justify-center p-10">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-50 dark:bg-blue-500/10">
                  <RefreshCw
                    size={25}
                    className="animate-spin text-blue-600 dark:text-blue-400"
                  />
                </div>

                <p className="mt-4 font-semibold text-slate-800 dark:text-slate-200">
                  Loading transactions
                </p>

                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                  Please wait while we retrieve your records.
                </p>
              </div>
            ) : filteredTransactions.length === 0 ? (
              <div className="flex min-h-[300px] flex-col items-center justify-center p-8 text-center sm:p-12">
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-50 to-emerald-50 text-blue-600 ring-1 ring-blue-100 dark:from-blue-950/50 dark:to-emerald-950/40 dark:text-blue-400 dark:ring-slate-700">
                  {hasActiveFilters ? (
                    <Search size={28} />
                  ) : (
                    <Wallet size={28} />
                  )}
                </div>

                <h3 className="mt-5 text-lg font-bold text-slate-900 dark:text-white">
                  {hasActiveFilters
                    ? "No matching transactions"
                    : "No transactions found"}
                </h3>

                <p className="mt-2 max-w-md text-sm leading-6 text-slate-500 dark:text-slate-400">
                  {hasActiveFilters
                    ? "Try another search term or change the transaction type filter."
                    : "Your cash and bank transaction history will appear here after you record your first transaction."}
                </p>

                {hasActiveFilters ? (
                  <button
                    type="button"
                    onClick={resetSearch}
                    className="mt-5 inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
                  >
                    <RotateCcw size={16} />
                    Clear Filters
                  </button>
                ) : canCreate ? (
                  <button
                    type="button"
                    onClick={openAddForm}
                    className="mt-5 inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-emerald-600 px-5 py-3 text-sm font-bold text-white shadow-lg shadow-blue-600/20 transition hover:-translate-y-0.5 hover:from-blue-700 hover:to-emerald-700"
                  >
                    <Plus size={18} />
                    Add First Transaction
                  </button>
                ) : null}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[1000px] text-left text-sm">
                  <thead className="bg-slate-100/80 dark:bg-slate-800/70">
                    <tr>
                      {[
                        "Date",
                        "Account",
                        "Type",
                        "Description",
                        "Debit",
                        "Credit",
                        "Balance",
                      ].map((heading, index) => (
                        <th
                          key={heading}
                          className={`px-5 py-4 text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 ${
                            index >= 4 ? "text-right" : ""
                          }`}
                        >
                          {heading}
                        </th>
                      ))}
                    </tr>
                  </thead>

                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {filteredTransactions.map((transaction, index) => {
                      const debit = Number(transaction.debit || 0);
                      const credit = Number(transaction.credit || 0);

                      const type =
                        debit > 0
                          ? "Receipt"
                          : credit > 0
                          ? "Payment"
                          : "-";

                      const receipt = type === "Receipt";
                      const payment = type === "Payment";

                      return (
                        <tr
                          key={
                            transaction.journal_line_id ??
                            `${transaction.journal_date}-${transaction.account_code}-${index}`
                          }
                          className="group transition-colors hover:bg-blue-50/50 dark:hover:bg-blue-950/20"
                        >
                          <td className="whitespace-nowrap px-5 py-4">
                            <div className="flex items-center gap-2.5">
                              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                                <CalendarDays size={16} />
                              </div>

                              <span className="font-medium text-slate-700 dark:text-slate-300">
                                {formatDate(transaction.journal_date)}
                              </span>
                            </div>
                          </td>

                          <td className="px-5 py-4">
                            <div className="flex items-center gap-3">
                              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-400">
                                <Landmark size={17} />
                              </div>

                              <div className="min-w-0">
                                <p className="font-bold text-slate-800 dark:text-slate-100">
                                  {transaction.account_code || "-"}
                                </p>

                                <p className="mt-0.5 max-w-[220px] truncate text-xs text-slate-500 dark:text-slate-400">
                                  {transaction.account_name || "-"}
                                </p>
                              </div>
                            </div>
                          </td>

                          <td className="whitespace-nowrap px-5 py-4">
                            <span
                              className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold ${
                                receipt
                                  ? "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-400 dark:ring-emerald-500/20"
                                  : payment
                                  ? "bg-blue-50 text-blue-700 ring-1 ring-blue-200 dark:bg-blue-500/10 dark:text-blue-400 dark:ring-blue-500/20"
                                  : "bg-slate-100 text-slate-600 ring-1 ring-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:ring-slate-700"
                              }`}
                            >
                              {receipt ? (
                                <ArrowDownLeft size={13} />
                              ) : payment ? (
                                <ArrowUpRight size={13} />
                              ) : (
                                <Activity size={13} />
                              )}

                              {type}
                            </span>
                          </td>

                          <td className="max-w-[300px] px-5 py-4">
                            <p
                              className="truncate text-slate-600 dark:text-slate-300"
                              title={transaction.description || ""}
                            >
                              {transaction.description || "-"}
                            </p>

                            {transaction.reference_number && (
                              <p className="mt-1 truncate text-xs text-slate-400 dark:text-slate-500">
                                Ref: {transaction.reference_number}
                              </p>
                            )}
                          </td>

                          <td className="whitespace-nowrap px-5 py-4 text-right">
                            <span
                              className={`font-semibold tabular-nums ${
                                debit > 0
                                  ? "text-emerald-700 dark:text-emerald-400"
                                  : "text-slate-400 dark:text-slate-500"
                              }`}
                            >
                              {formatAmount(debit)}
                            </span>
                          </td>

                          <td className="whitespace-nowrap px-5 py-4 text-right">
                            <span
                              className={`font-semibold tabular-nums ${
                                credit > 0
                                  ? "text-blue-700 dark:text-blue-400"
                                  : "text-slate-400 dark:text-slate-500"
                              }`}
                            >
                              {formatAmount(credit)}
                            </span>
                          </td>

                          <td className="whitespace-nowrap px-5 py-4 text-right">
                            <span className="font-bold tabular-nums text-slate-900 dark:text-white">
                              {formatAmount(transaction.balance)}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>

                  <tfoot className="border-t-2 border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-800/60">
                    <tr>
                      <td
                        colSpan={4}
                        className="px-5 py-4 text-sm font-bold text-slate-700 dark:text-slate-200"
                      >
                        Totals for all transactions
                      </td>

                      <td className="whitespace-nowrap px-5 py-4 text-right font-bold tabular-nums text-emerald-700 dark:text-emerald-400">
                        {formatAmount(totals.debit)}
                      </td>

                      <td className="whitespace-nowrap px-5 py-4 text-right font-bold tabular-nums text-blue-700 dark:text-blue-400">
                        {formatAmount(totals.credit)}
                      </td>

                      <td className="px-5 py-4 text-right text-xs font-semibold text-slate-500 dark:text-slate-400">
                        {filteredTransactions.length} shown
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}

            {!loading && filteredTransactions.length > 0 && (
              <div className="flex flex-col justify-between gap-2 border-t border-slate-200 bg-white px-5 py-4 text-xs text-slate-500 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400 sm:flex-row sm:items-center sm:px-6">
                <p>
                  Showing {filteredTransactions.length} transaction
                  {filteredTransactions.length === 1 ? "" : "s"}.
                </p>

                <p className="inline-flex items-center gap-1.5">
                  <ShieldCheck
                    size={14}
                    className="text-emerald-600 dark:text-emerald-400"
                  />
                  Financial records are displayed from your transaction history.
                </p>
              </div>
            )}
          </section>
        )}

        {!showForm && !loading && transactions.length > 0 && (
          <div className="flex flex-col gap-3 rounded-2xl border border-blue-100 bg-gradient-to-r from-blue-50 to-emerald-50 p-4 dark:border-slate-800 dark:from-blue-950/30 dark:to-emerald-950/20 sm:flex-row sm:items-center">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white text-blue-600 shadow-sm dark:bg-slate-900 dark:text-blue-400">
              <ArrowDownToLine size={19} />
            </div>

            <div>
              <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                Keep your cash and bank records up to date
              </p>

              <p className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400">
                Use Add Transaction to record a receipt or payment. Use the
                search and type filters to locate existing entries.
              </p>
            </div>

            {canCreate && (
              <div className="sm:ml-auto">
                <button
                  type="button"
                  onClick={openAddForm}
                  className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700"
                >
                  <Plus size={16} />
                  New Transaction
                  <ArrowRight size={15} />
                </button>
              </div>
            )}
          </div>
        )}

        {/* Permissions are available for future Edit/Delete functionality. */}
        <div className="sr-only" aria-hidden="true">
          {String(canUpdate)}
          {String(canDelete)}
        </div>
      </div>
    </div>
  );
}