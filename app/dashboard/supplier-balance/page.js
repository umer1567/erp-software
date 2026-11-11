
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

const PERMISSION_KEY = "supplier_balance";

const formatAmount = (value) =>
    Number(value ?? 0).toLocaleString("en-PK", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    });

function toBoolean(value) {
    return (
        value === true ||
        value === 1 ||
        value === "1" ||
        String(value).toLowerCase() === "true"
    );
}

function Icon({ name, size = 20, className = "" }) {
    const paths = {
        wallet: (
            <>
                <rect x="3" y="5" width="18" height="15" rx="2" />
                <path d="M3 9h18" />
                <path d="M16 14h2" />
                <path d="M7 5V3h10l2 2" />
            </>
        ),
        users: (
            <>
                <path d="M16 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                <circle cx="10" cy="7" r="4" />
                <path d="M20 21v-2a4 4 0 0 0-3-3.87" />
                <path d="M16 3.13a4 4 0 0 1 0 7.75" />
            </>
        ),
        trending: (
            <>
                <path d="m3 17 6-6 4 4 8-9" />
                <path d="M15 6h6v6" />
            </>
        ),
        check: (
            <>
                <path d="m5 12 4 4L19 6" />
                <circle cx="12" cy="12" r="9" />
            </>
        ),
        search: (
            <>
                <circle cx="11" cy="11" r="7" />
                <path d="m20 20-4-4" />
            </>
        ),
        refresh: (
            <>
                <path d="M20 7v5h-5" />
                <path d="M4 17v-5h5" />
                <path d="M5.6 9A7 7 0 0 1 17.3 6L20 12" />
                <path d="M18.4 15A7 7 0 0 1 6.7 18L4 12" />
            </>
        ),
        building: (
            <>
                <rect x="4" y="3" width="16" height="18" rx="2" />
                <path d="M9 7h2M9 11h2M9 15h2M15 7h.01M15 11h.01M15 15h.01M9 21v-3h6v3" />
            </>
        ),
        alert: (
            <>
                <path d="m10.3 3.9-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.7-3.1l-8-14a2 2 0 0 0-3.4 0Z" />
                <path d="M12 9v4" />
                <path d="M12 17h.01" />
            </>
        ),
        close: (
            <>
                <path d="m18 6-12 12" />
                <path d="m6 6 12 12" />
            </>
        ),
        file: (
            <>
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z" />
                <path d="M14 2v6h6M8 13h8M8 17h8" />
            </>
        ),
        lock: (
            <>
                <rect x="3" y="10" width="18" height="11" rx="2" />
                <path d="M7 10V7a5 5 0 0 1 10 0v3" />
                <path d="M12 14v3" />
            </>
        ),
    };

    return (
        <svg
            xmlns="http://www.w3.org/2000/svg"
            width={size}
            height={size}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
            className={className}
            aria-hidden="true"
        >
            {paths[name] || paths.file}
        </svg>
    );
}

function SummaryCard({
    title,
    value,
    description,
    icon,
    color = "blue",
}) {
    const colors = {
        blue: {
            icon: "bg-sky-100 text-sky-700 dark:bg-sky-400/15 dark:text-sky-300",
            border: "border-sky-200/70 dark:border-sky-900/70",
            glow: "from-sky-500/10",
        },
        green: {
            icon: "bg-emerald-100 text-emerald-700 dark:bg-emerald-400/15 dark:text-emerald-300",
            border: "border-emerald-200/70 dark:border-emerald-900/70",
            glow: "from-emerald-500/10",
        },
        teal: {
            icon: "bg-teal-100 text-teal-700 dark:bg-teal-400/15 dark:text-teal-300",
            border: "border-teal-200/70 dark:border-teal-900/70",
            glow: "from-teal-500/10",
        },
        slate: {
            icon: "bg-slate-100 text-slate-700 dark:bg-slate-700/70 dark:text-slate-200",
            border: "border-slate-200 dark:border-slate-700",
            glow: "from-slate-500/5",
        },
    };

    const theme = colors[color] || colors.blue;

    return (
        <div
            className={`relative overflow-hidden rounded-2xl border ${theme.border} bg-gradient-to-br ${theme.glow} to-white p-5 shadow-sm transition duration-200 hover:-translate-y-0.5 hover:shadow-md dark:to-slate-900`}
        >
            <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                    <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
                        {title}
                    </p>

                    <p className="mt-3 break-words text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
                        {value}
                    </p>

                    <p className="mt-2 text-xs leading-5 text-slate-500 dark:text-slate-400">
                        {description}
                    </p>
                </div>

                <div
                    className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${theme.icon}`}
                >
                    <Icon name={icon} size={22} />
                </div>
            </div>
        </div>
    );
}

function StatusBadge({ active }) {
    return (
        <span
            className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold ${active
                    ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300"
                    : "border-slate-200 bg-slate-100 text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
                }`}
        >
            <span
                className={`h-1.5 w-1.5 rounded-full ${active ? "bg-emerald-500" : "bg-slate-400"
                    }`}
            />
            {active ? "Active" : "Inactive"}
        </span>
    );
}

function AccessDenied() {
    return (
        <main className="flex min-h-screen items-center justify-center bg-slate-50 p-5 dark:bg-slate-950">
            <div className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-xl dark:border-slate-800 dark:bg-slate-900">
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-rose-100 text-rose-600 dark:bg-rose-950/50 dark:text-rose-400">
                    <Icon name="lock" size={30} />
                </div>

                <h1 className="mt-6 text-2xl font-bold text-slate-900 dark:text-white">
                    Access Denied
                </h1>

                <p className="mt-3 text-sm leading-6 text-slate-500 dark:text-slate-400">
                    You do not have permission to view Supplier Balance.
                    Please contact your administrator if you need access.
                </p>

                <button
                    type="button"
                    onClick={() => window.history.back()}
                    className="mt-6 rounded-xl bg-sky-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-sky-700"
                >
                    Go Back
                </button>
            </div>
        </main>
    );
}

function PermissionError({ message, onRetry }) {
    return (
        <main className="flex min-h-screen items-center justify-center bg-slate-50 p-5 dark:bg-slate-950">
            <div className="w-full max-w-md rounded-2xl border border-red-200 bg-white p-7 text-center shadow-sm dark:border-red-900 dark:bg-slate-900">
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-red-100 text-red-600 dark:bg-red-950/50 dark:text-red-400">
                    <Icon name="alert" size={26} />
                </div>

                <h2 className="mt-5 text-xl font-bold text-slate-900 dark:text-white">
                    Unable to verify permissions
                </h2>

                <p className="mt-2 text-sm leading-6 text-slate-500 dark:text-slate-400">
                    {message}
                </p>

                <button
                    type="button"
                    onClick={onRetry}
                    className="mt-5 rounded-xl bg-sky-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-sky-700"
                >
                    Retry
                </button>
            </div>
        </main>
    );
}

const inputClass =
    "w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-sky-500 focus:ring-4 focus:ring-sky-500/10 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:border-sky-400";

export default function SupplierBalancePage() {
    const [balances, setBalances] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [error, setError] = useState("");

    const [search, setSearch] = useState("");
    const [statusFilter, setStatusFilter] = useState("all");
    const [sortBy, setSortBy] = useState("balance-desc");

    // Permission states
    const [permissionLoading, setPermissionLoading] = useState(true);
    const [canView, setCanView] = useState(false);
    const [permissionError, setPermissionError] = useState("");

    const checkPermission = useCallback(async () => {
        setPermissionLoading(true);
        setPermissionError("");

        try {
            const response = await fetch("/api/permissions/current", {
                method: "GET",
                credentials: "same-origin",
                cache: "no-store",
            });

            const data = await response.json().catch(() => ({}));

            if (!response.ok) {
                throw new Error(
                    data.message ||
                    data.error ||
                    "Could not verify your permissions."
                );
            }

            const permissions = Array.isArray(data.permissions)
                ? data.permissions
                : [];

            const permission = permissions.find(
                (item) =>
                    String(item.permission_key || "").toLowerCase() ===
                    PERMISSION_KEY
            );

            setCanView(toBoolean(permission?.can_view));
        } catch (err) {
            setCanView(false);
            setPermissionError(
                err.message || "Could not verify your permissions."
            );
        } finally {
            setPermissionLoading(false);
        }
    }, []);

    const fetchBalances = useCallback(async ({ showLoader = true } = {}) => {
        if (showLoader) {
            setLoading(true);
        } else {
            setRefreshing(true);
        }

        setError("");

        try {
            const response = await fetch("/api/suppliers/balance", {
                method: "GET",
                credentials: "same-origin",
                cache: "no-store",
            });

            const data = await response.json().catch(() => ({}));

            if (!response.ok) {
                throw new Error(
                    data.message ||
                    data.error ||
                    "Failed to load supplier balances."
                );
            }

            setBalances(
                Array.isArray(data.balances) ? data.balances : []
            );
        } catch (err) {
            setError(
                err.message || "Failed to load supplier balances."
            );
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, []);

    // Verify permission first. Only load balances after access is granted.
    // Verify permission and load balances sequentially.
    useEffect(() => {
        let cancelled = false;

        async function initializePage() {
            try {
                const permissionResponse = await fetch(
                    "/api/permissions/current",
                    {
                        method: "GET",
                        credentials: "same-origin",
                        cache: "no-store",
                    }
                );

                const permissionData = await permissionResponse
                    .json()
                    .catch(() => ({}));

                if (!permissionResponse.ok) {
                    throw new Error(
                        permissionData.message ||
                        permissionData.error ||
                        "Could not verify your permissions."
                    );
                }

                const permissions = Array.isArray(
                    permissionData.permissions
                )
                    ? permissionData.permissions
                    : [];

                const permission = permissions.find(
                    (item) =>
                        String(item.permission_key || "").toLowerCase() ===
                        PERMISSION_KEY
                );

                const allowed = toBoolean(permission?.can_view);

                if (cancelled) return;

                setCanView(allowed);
                setPermissionError("");

                if (!allowed) {
                    setLoading(false);
                    return;
                }

                const balanceResponse = await fetch(
                    "/api/suppliers/balance",
                    {
                        method: "GET",
                        credentials: "same-origin",
                        cache: "no-store",
                    }
                );

                const balanceData = await balanceResponse
                    .json()
                    .catch(() => ({}));

                if (!balanceResponse.ok) {
                    throw new Error(
                        balanceData.message ||
                        balanceData.error ||
                        "Failed to load supplier balances."
                    );
                }

                if (!cancelled) {
                    setBalances(
                        Array.isArray(balanceData.balances)
                            ? balanceData.balances
                            : []
                    );

                    setError("");
                }
            } catch (err) {
                if (!cancelled) {
                    setPermissionError(
                        err.message || "Could not verify your permissions."
                    );
                    setCanView(false);
                }
            } finally {
                if (!cancelled) {
                    setPermissionLoading(false);
                    setLoading(false);
                }
            }
        }

        initializePage();

        return () => {
            cancelled = true;
        };
    }, []);

    // Re-check permission after User Rights changes.
    useEffect(() => {
        const handlePermissionUpdate = async () => {
            try {
                const response = await fetch(
                    "/api/permissions/current",
                    {
                        credentials: "same-origin",
                        cache: "no-store",
                    }
                );

                const data = await response.json().catch(() => ({}));

                if (!response.ok) {
                    throw new Error(
                        data.message ||
                        data.error ||
                        "Could not verify your permissions."
                    );
                }

                const permissions = Array.isArray(data.permissions)
                    ? data.permissions
                    : [];

                const permission = permissions.find(
                    (item) =>
                        String(item.permission_key || "").toLowerCase() ===
                        PERMISSION_KEY
                );

                const allowed = toBoolean(permission?.can_view);

                setCanView(allowed);
                setPermissionError("");

                if (allowed) {
                    fetchBalances({ showLoader: false });
                } else {
                    setBalances([]);
                }
            } catch (err) {
                setCanView(false);
                setBalances([]);
                setPermissionError(
                    err.message || "Could not verify your permissions."
                );
            }
        };

        window.addEventListener(
            "erp-permissions-updated",
            handlePermissionUpdate
        );

        return () => {
            window.removeEventListener(
                "erp-permissions-updated",
                handlePermissionUpdate
            );
        };
    }, [fetchBalances]);

    

const filteredBalances = useMemo(() => {
    const query = search.trim().toLowerCase();

    const result = balances.filter((supplier) => {
        const supplierText =
            `${supplier.supplier_code || ""} ${supplier.supplier_name || ""}`
                .toLowerCase();

        const matchesSearch = supplierText.includes(query);

        const matchesStatus =
            statusFilter === "all" ||
            (statusFilter === "active" &&
                toBoolean(supplier.is_active)) ||
            (statusFilter === "inactive" &&
                !toBoolean(supplier.is_active));

        return matchesSearch && matchesStatus;
    });

    result.sort((a, b) => {
        if (sortBy === "balance-desc") {
            return Number(b.balance || 0) - Number(a.balance || 0);
        }

        if (sortBy === "balance-asc") {
            return Number(a.balance || 0) - Number(b.balance || 0);
        }

        if (sortBy === "name-asc") {
            return String(a.supplier_name || "").localeCompare(
                String(b.supplier_name || "")
            );
        }

        return String(a.supplier_code || "").localeCompare(
            String(b.supplier_code || "")
        );
    });

    return result;
}, [balances, search, statusFilter, sortBy]);

const summary = useMemo(() => {
    return balances.reduce(
        (totals, supplier) => {
            totals.opening += Number(supplier.opening_balance || 0);
            totals.purchases += Number(supplier.total_purchases || 0);
            totals.paid += Number(supplier.total_paid || 0);
            totals.balance += Number(supplier.balance || 0);
            totals.creditLimit += Number(supplier.credit_limit || 0);

            if (toBoolean(supplier.is_active)) {
                totals.activeSuppliers += 1;
            }

            return totals;
        },
        {
            opening: 0,
            purchases: 0,
            paid: 0,
            balance: 0,
            creditLimit: 0,
            activeSuppliers: 0,
        }
    );
}, [balances]);

// Permission verification screen
if (permissionLoading) {
    return (
        <main className="flex min-h-screen items-center justify-center bg-slate-50 dark:bg-slate-950">
            <div className="text-center">
                <div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-sky-200 border-t-sky-600 dark:border-slate-700 dark:border-t-sky-400" />
                <p className="mt-4 text-sm font-medium text-slate-600 dark:text-slate-300">
                    Verifying your access...
                </p>
            </div>
        </main>
    );
}

if (permissionError) {
    return (
        <PermissionError
            message={permissionError}
            onRetry={checkPermission}
        />
    );
}

if (!canView) {
    return <AccessDenied />;
}

// Loading screen for supplier data
if (loading) {
    return (
        <main className="min-h-screen bg-slate-50 p-4 dark:bg-slate-950 sm:p-6 lg:p-8">
            <div className="mx-auto max-w-[1600px] animate-pulse space-y-6">
                <div className="h-36 rounded-2xl bg-slate-200 dark:bg-slate-800" />

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
                    {Array.from({ length: 4 }).map((_, index) => (
                        <div
                            key={index}
                            className="h-32 rounded-2xl bg-slate-200 dark:bg-slate-800"
                        />
                    ))}
                </div>

                <div className="h-96 rounded-2xl bg-slate-200 dark:bg-slate-800" />

                <p className="text-center text-sm text-slate-500 dark:text-slate-400">
                    Loading supplier balances...
                </p>
            </div>
        </main>
    );
}

return (
    <main className="min-h-screen bg-slate-50 p-4 text-slate-800 dark:bg-slate-950 dark:text-slate-100 sm:p-6 lg:p-8">
        <div className="mx-auto max-w-[1600px] space-y-6">
            {/* Header */}
            <section className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-emerald-950 via-emerald-900 to-sky-900 p-6 text-white shadow-lg shadow-emerald-950/10 sm:p-8">
                <div className="pointer-events-none absolute -right-12 -top-24 h-72 w-72 rounded-full border border-white/10" />
                <div className="pointer-events-none absolute -right-2 -top-12 h-52 w-52 rounded-full border border-white/10" />
                <div className="pointer-events-none absolute -bottom-24 right-1/3 h-48 w-48 rounded-full bg-sky-400/10 blur-3xl" />

                <div className="relative flex flex-col justify-between gap-6 lg:flex-row lg:items-center">
                    <div className="max-w-2xl">
                        <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-emerald-300/20 bg-white/10 px-3 py-1.5 text-xs font-semibold tracking-wide text-emerald-100">
                            <Icon name="building" size={15} />
                            ACCOUNTS PAYABLE
                        </div>

                        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
                            Supplier Balance
                        </h1>

                        <p className="mt-3 max-w-xl text-sm leading-6 text-emerald-50/80 sm:text-base">
                            Monitor supplier accounts, review outstanding
                            balances, and keep track of your purchase
                            payments in one place.
                        </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-3">
                        <div className="rounded-xl border border-white/15 bg-white/10 px-4 py-3 backdrop-blur-sm">
                            <p className="text-xs text-emerald-100/75">
                                Total suppliers
                            </p>
                            <p className="mt-1 text-2xl font-bold">
                                {balances.length}
                            </p>
                        </div>

                        <button
                            type="button"
                            onClick={() =>
                                fetchBalances({ showLoader: false })
                            }
                            disabled={refreshing}
                            className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/20 bg-white/10 px-4 py-3 text-sm font-semibold text-white transition hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                            <Icon
                                name="refresh"
                                size={17}
                                className={refreshing ? "animate-spin" : ""}
                            />
                            {refreshing ? "Refreshing..." : "Refresh"}
                        </button>
                    </div>
                </div>
            </section>

            {/* Error message */}
            {error && (
                <div
                    role="alert"
                    className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300"
                >
                    <Icon
                        name="alert"
                        size={20}
                        className="mt-0.5 shrink-0"
                    />

                    <div className="min-w-0 flex-1">
                        <p className="font-semibold">
                            Unable to load supplier balances
                        </p>
                        <p className="mt-1">{error}</p>
                    </div>

                    <button
                        type="button"
                        onClick={() =>
                            fetchBalances({ showLoader: false })
                        }
                        className="shrink-0 rounded-lg border border-red-200 px-3 py-1.5 font-semibold transition hover:bg-red-100 dark:border-red-800 dark:hover:bg-red-900/50"
                    >
                        Retry
                    </button>
                </div>
            )}

            {/* Summary cards */}
            <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <SummaryCard
                    title="Total Outstanding"
                    value={formatAmount(summary.balance)}
                    description="Combined balance payable to suppliers"
                    icon="wallet"
                    color="green"
                />

                <SummaryCard
                    title="Total Purchases"
                    value={formatAmount(summary.purchases)}
                    description="Total purchases recorded"
                    icon="trending"
                    color="blue"
                />

                <SummaryCard
                    title="Total Paid"
                    value={formatAmount(summary.paid)}
                    description="Payments recorded against purchases"
                    icon="check"
                    color="teal"
                />

                <SummaryCard
                    title="Active Suppliers"
                    value={`${summary.activeSuppliers} / ${balances.length}`}
                    description="Suppliers currently marked active"
                    icon="users"
                    color="slate"
                />
            </section>

            {/* Supplier accounts */}
            <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
                <div className="border-b border-slate-200 p-5 dark:border-slate-800 sm:p-6">
                    <div className="flex flex-col justify-between gap-4 xl:flex-row xl:items-center">
                        <div>
                            <h2 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">
                                Supplier Accounts
                            </h2>

                            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                                Search and review each supplier&apos;s
                                financial position.
                            </p>
                        </div>

                        <div className="flex flex-col gap-3 sm:flex-row">
                            <div className="relative min-w-0 sm:w-72">
                                <Icon
                                    name="search"
                                    size={18}
                                    className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
                                />

                                <input
                                    value={search}
                                    onChange={(e) =>
                                        setSearch(e.target.value)
                                    }
                                    placeholder="Search code or supplier..."
                                    aria-label="Search suppliers"
                                    className={`${inputClass} pl-10 pr-10`}
                                />

                                {search && (
                                    <button
                                        type="button"
                                        onClick={() => setSearch("")}
                                        aria-label="Clear search"
                                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 transition hover:text-slate-700 dark:hover:text-white"
                                    >
                                        <Icon name="close" size={16} />
                                    </button>
                                )}
                            </div>

                            <select
                                value={statusFilter}
                                onChange={(e) =>
                                    setStatusFilter(e.target.value)
                                }
                                aria-label="Filter supplier status"
                                className={`${inputClass} sm:w-36`}
                            >
                                <option value="all">All statuses</option>
                                <option value="active">Active only</option>
                                <option value="inactive">Inactive only</option>
                            </select>

                            <select
                                value={sortBy}
                                onChange={(e) => setSortBy(e.target.value)}
                                aria-label="Sort supplier balances"
                                className={`${inputClass} sm:w-44`}
                            >
                                <option value="balance-desc">
                                    Balance: highest
                                </option>
                                <option value="balance-asc">
                                    Balance: lowest
                                </option>
                                <option value="name-asc">
                                    Supplier: A–Z
                                </option>
                                <option value="code-asc">
                                    Code: A–Z
                                </option>
                            </select>
                        </div>
                    </div>

                    <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
                        <div className="flex flex-wrap items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
                            <span className="inline-flex items-center gap-2 rounded-lg bg-slate-100 px-3 py-2 dark:bg-slate-800">
                                <Icon name="users" size={15} />
                                {filteredBalances.length} results
                            </span>

                            {search && (
                                <span className="rounded-lg bg-sky-50 px-3 py-2 text-sky-700 dark:bg-sky-950/50 dark:text-sky-300">
                                    Search: {search}
                                </span>
                            )}
                        </div>

                        <p className="text-xs text-slate-400 dark:text-slate-500">
                            Amounts shown to 2 decimal places
                        </p>
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full min-w-[1050px] text-left text-sm">
                        <thead className="bg-slate-50 text-xs uppercase tracking-wider text-slate-500 dark:bg-slate-800/70 dark:text-slate-400">
                            <tr>
                                <th className="px-5 py-4 font-semibold">
                                    Supplier Code
                                </th>
                                <th className="px-5 py-4 font-semibold">
                                    Supplier
                                </th>
                                <th className="px-5 py-4 text-right font-semibold">
                                    Opening
                                </th>
                                <th className="px-5 py-4 text-right font-semibold">
                                    Purchases
                                </th>
                                <th className="px-5 py-4 text-right font-semibold">
                                    Paid
                                </th>
                                <th className="px-5 py-4 text-right font-semibold">
                                    Balance
                                </th>
                                <th className="px-5 py-4 text-right font-semibold">
                                    Credit Limit
                                </th>
                                <th className="px-5 py-4 text-center font-semibold">
                                    Status
                                </th>
                            </tr>
                        </thead>

                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                            {filteredBalances.map((supplier) => {
                                const balance = Number(
                                    supplier.balance || 0
                                );

                                const creditLimit = Number(
                                    supplier.credit_limit || 0
                                );

                                const limitReached =
                                    creditLimit > 0 &&
                                    balance >= creditLimit;

                                return (
                                    <tr
                                        key={supplier.supplier_id}
                                        className="transition-colors hover:bg-sky-50/60 dark:hover:bg-slate-800/60"
                                    >
                                        <td className="whitespace-nowrap px-5 py-4">
                                            <span className="inline-flex rounded-lg border border-sky-100 bg-sky-50 px-2.5 py-1.5 font-mono text-xs font-semibold text-sky-800 dark:border-sky-900 dark:bg-sky-950/60 dark:text-sky-300">
                                                {supplier.supplier_code || "-"}
                                            </span>
                                        </td>

                                        <td className="px-5 py-4">
                                            <div className="flex items-center gap-3">
                                                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-100 to-sky-100 text-sm font-bold text-emerald-800 dark:from-emerald-950 dark:to-sky-950 dark:text-emerald-300">
                                                    {String(
                                                        supplier.supplier_name || "S"
                                                    )
                                                        .trim()
                                                        .charAt(0)
                                                        .toUpperCase()}
                                                </div>

                                                <div className="min-w-0">
                                                    <p className="font-semibold text-slate-800 dark:text-slate-100">
                                                        {supplier.supplier_name || "-"}
                                                    </p>

                                                    {limitReached && (
                                                        <p className="mt-1 text-xs font-medium text-amber-600 dark:text-amber-400">
                                                            Credit limit reached
                                                        </p>
                                                    )}
                                                </div>
                                            </div>
                                        </td>

                                        <td className="whitespace-nowrap px-5 py-4 text-right tabular-nums text-slate-600 dark:text-slate-300">
                                            {formatAmount(
                                                supplier.opening_balance
                                            )}
                                        </td>

                                        <td className="whitespace-nowrap px-5 py-4 text-right tabular-nums font-medium text-slate-700 dark:text-slate-200">
                                            {formatAmount(
                                                supplier.total_purchases
                                            )}
                                        </td>

                                        <td className="whitespace-nowrap px-5 py-4 text-right tabular-nums font-medium text-emerald-700 dark:text-emerald-400">
                                            {formatAmount(
                                                supplier.total_paid
                                            )}
                                        </td>

                                        <td className="whitespace-nowrap px-5 py-4 text-right">
                                            <span
                                                className={`font-bold tabular-nums ${balance > 0
                                                        ? "text-emerald-800 dark:text-emerald-300"
                                                        : balance < 0
                                                            ? "text-rose-600 dark:text-rose-400"
                                                            : "text-slate-500 dark:text-slate-400"
                                                    }`}
                                            >
                                                {formatAmount(balance)}
                                            </span>
                                        </td>

                                        <td className="whitespace-nowrap px-5 py-4 text-right tabular-nums text-slate-600 dark:text-slate-300">
                                            {formatAmount(
                                                supplier.credit_limit
                                            )}
                                        </td>

                                        <td className="whitespace-nowrap px-5 py-4 text-center">
                                            <StatusBadge
                                                active={toBoolean(
                                                    supplier.is_active
                                                )}
                                            />
                                        </td>
                                    </tr>
                                );
                            })}

                            {filteredBalances.length === 0 && (
                                <tr>
                                    <td colSpan={8} className="px-6 py-16">
                                        <div className="mx-auto flex max-w-sm flex-col items-center text-center">
                                            <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-500">
                                                <Icon name="search" size={26} />
                                            </div>

                                            <h3 className="font-semibold text-slate-800 dark:text-white">
                                                No suppliers found
                                            </h3>

                                            <p className="mt-2 text-sm leading-6 text-slate-500 dark:text-slate-400">
                                                {balances.length === 0
                                                    ? "There are currently no supplier balances to display."
                                                    : "Try changing your search term or status filter."}
                                            </p>

                                            {(search || statusFilter !== "all") && (
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        setSearch("");
                                                        setStatusFilter("all");
                                                    }}
                                                    className="mt-4 rounded-lg bg-sky-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-sky-700"
                                                >
                                                    Clear filters
                                                </button>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            )}
                        </tbody>

                        {filteredBalances.length > 0 && (
                            <tfoot className="border-t-2 border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-800/70">
                                <tr>
                                    <td
                                        colSpan={2}
                                        className="px-5 py-4 font-bold text-slate-800 dark:text-white"
                                    >
                                        Filtered totals
                                    </td>

                                    <td className="whitespace-nowrap px-5 py-4 text-right font-bold tabular-nums text-slate-700 dark:text-slate-200">
                                        {formatAmount(
                                            filteredBalances.reduce(
                                                (sum, supplier) =>
                                                    sum +
                                                    Number(
                                                        supplier.opening_balance || 0
                                                    ),
                                                0
                                            )
                                        )}
                                    </td>

                                    <td className="whitespace-nowrap px-5 py-4 text-right font-bold tabular-nums text-slate-700 dark:text-slate-200">
                                        {formatAmount(
                                            filteredBalances.reduce(
                                                (sum, supplier) =>
                                                    sum +
                                                    Number(
                                                        supplier.total_purchases || 0
                                                    ),
                                                0
                                            )
                                        )}
                                    </td>

                                    <td className="whitespace-nowrap px-5 py-4 text-right font-bold tabular-nums text-emerald-700 dark:text-emerald-400">
                                        {formatAmount(
                                            filteredBalances.reduce(
                                                (sum, supplier) =>
                                                    sum +
                                                    Number(
                                                        supplier.total_paid || 0
                                                    ),
                                                0
                                            )
                                        )}
                                    </td>

                                    <td className="whitespace-nowrap px-5 py-4 text-right font-bold tabular-nums text-emerald-800 dark:text-emerald-300">
                                        {formatAmount(
                                            filteredBalances.reduce(
                                                (sum, supplier) =>
                                                    sum +
                                                    Number(supplier.balance || 0),
                                                0
                                            )
                                        )}
                                    </td>

                                    <td className="whitespace-nowrap px-5 py-4 text-right font-bold tabular-nums text-slate-700 dark:text-slate-200">
                                        {formatAmount(
                                            filteredBalances.reduce(
                                                (sum, supplier) =>
                                                    sum +
                                                    Number(supplier.credit_limit || 0),
                                                0
                                            )
                                        )}
                                    </td>

                                    <td className="px-5 py-4" />
                                </tr>
                            </tfoot>
                        )}
                    </table>
                </div>

                <div className="flex flex-col justify-between gap-2 border-t border-slate-200 px-5 py-4 text-xs text-slate-500 dark:border-slate-800 dark:text-slate-400 sm:flex-row sm:items-center">
                    <p>
                        Showing{" "}
                        <span className="font-semibold text-slate-700 dark:text-slate-200">
                            {filteredBalances.length}
                        </span>{" "}
                        of{" "}
                        <span className="font-semibold text-slate-700 dark:text-slate-200">
                            {balances.length}
                        </span>{" "}
                        suppliers
                    </p>

                    <p className="inline-flex items-center gap-1.5">
                        <Icon
                            name="check"
                            size={14}
                            className="text-emerald-600 dark:text-emerald-400"
                        />
                        Supplier balance overview
                    </p>
                </div>
            </section>
        </div>
    </main>
);
}
