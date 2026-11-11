
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";

const INITIAL_DATA = {
    challans: [],
    company: null,
};

const INITIAL_PERMISSIONS = {
    canView: false,
    canCreate: false,
    canUpdate: false,
    canDelete: false,
    canViewPending: false,
};

const toBoolean = (value) =>
    value === true ||
    value === 1 ||
    value === "1" ||
    String(value).toLowerCase() === "true";

const money = (value, currency = "PKR") => {
    try {
        return new Intl.NumberFormat("en-PK", {
            style: "currency",
            currency: currency || "PKR",
            maximumFractionDigits: 2,
        }).format(Number(value || 0));
    } catch {
        return `PKR ${Number(value || 0).toLocaleString("en-PK", {
            maximumFractionDigits: 2,
        })}`;
    }
};

const dateText = (value) => {
    if (!value) return "—";

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
        return String(value).slice(0, 10);
    }

    return date.toLocaleDateString("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric",
    });
};

function normalizeData(result) {
    return {
        challans: Array.isArray(result?.challans)
            ? result.challans
            : [],
        company: result?.company || null,
    };
}

function normalizePermissions(result) {
    const rows = Array.isArray(result?.permissions)
        ? result.permissions
        : [];

    const delivery = rows.find(
        (item) => item.permission_key === "delivery_challans"
    );

    const pending = rows.find(
        (item) =>
            item.permission_key === "pending_delivery_challans"
    );

    return {
        canView: toBoolean(delivery?.can_view),
        canCreate: toBoolean(delivery?.can_create),
        canUpdate: toBoolean(delivery?.can_update),
        canDelete: toBoolean(delivery?.can_delete),
        canViewPending: toBoolean(pending?.can_view),
    };
}

export default function DeliveryChallansPage() {
    const [data, setData] = useState(INITIAL_DATA);
    const [permissions, setPermissions] = useState(INITIAL_PERMISSIONS);

    const [loading, setLoading] = useState(true);
    const [permissionsLoading, setPermissionsLoading] = useState(true);
    const [error, setError] = useState("");
    const [search, setSearch] = useState("");
    const [statusFilter, setStatusFilter] = useState("ALL");
    const [view, setView] = useState("table");
    const [requesting, setRequesting] = useState(false);

    /*
     * Load the current user's permissions.
     *
     * The API should return:
     * {
     *   permissions: [
     *     {
     *       permission_key: "delivery_challans",
     *       can_view: true,
     *       can_create: true,
     *       can_update: true,
     *       can_delete: true
     *     }
     *   ]
     * }
     */
    const loadPermissions = useCallback(async () => {
        try {
            const response = await fetch(
                "/api/permissions/current",
                {
                    credentials: "same-origin",
                    cache: "no-store",
                }
            );

            const result = await response.json();

            if (!response.ok) {
                throw new Error(
                    result.message ||
                        "Could not load user permissions."
                );
            }

            setPermissions(normalizePermissions(result));
        } catch (err) {
            console.error("Delivery Challans permission error:", err);

            // Fail closed: do not grant access if rights cannot be checked.
            setPermissions(INITIAL_PERMISSIONS);
        } finally {
            setPermissionsLoading(false);
        }
    }, []);

    /*
     * Load Delivery Challans.
     */
    const loadChallans = useCallback(async (showLoader = false) => {
        if (showLoader) {
            setRequesting(true);
        }

        setError("");

        try {
            const response = await fetch(
                "/api/delivery-challans",
                {
                    credentials: "same-origin",
                    cache: "no-store",
                }
            );

            const result = await response.json();

            if (!response.ok || !result.success) {
                throw new Error(
                    result.message ||
                        "Could not load Delivery Challans."
                );
            }

            setData(normalizeData(result));
        } catch (err) {
            setError(
                err.message ||
                    "Could not load Delivery Challans."
            );
        } finally {
            setLoading(false);
            setRequesting(false);
        }
    }, []);

    /*
     * Initial data loading.
     */
    /*
 * Initial data loading.
 * Defer the request to avoid synchronous state updates inside the effect.
 */
useEffect(() => {
    const timer = setTimeout(() => {
        void loadChallans();
    }, 0);

    return () => {
        clearTimeout(timer);
    };
}, [loadChallans]);

    /*
     * Initial permission loading.
     *
     * Deferred to avoid synchronous state updates inside the effect.
     */
    useEffect(() => {
        const timer = setTimeout(() => {
            void loadPermissions();
        }, 0);

        return () => clearTimeout(timer);
    }, [loadPermissions]);

    /*
     * Refresh permissions when User Rights are updated.
     */
    useEffect(() => {
        const handlePermissionsUpdated = () => {
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

        window.addEventListener("focus", handlePermissionsUpdated);

        document.addEventListener(
            "visibilitychange",
            handleVisibilityChange
        );

        return () => {
            window.removeEventListener(
                "erp-permissions-updated",
                handlePermissionsUpdated
            );

            window.removeEventListener(
                "focus",
                handlePermissionsUpdated
            );

            document.removeEventListener(
                "visibilitychange",
                handleVisibilityChange
            );
        };
    }, [loadPermissions]);

    /*
     * Refresh both records and permissions.
     */
    const handleRefresh = useCallback(async () => {
        await Promise.all([
            loadChallans(true),
            loadPermissions(),
        ]);
    }, [loadChallans, loadPermissions]);

    const filtered = useMemo(() => {
        const query = search.trim().toLowerCase();

        return (data.challans || []).filter((row) => {
            const matchesStatus =
                statusFilter === "ALL" ||
                String(row.status || "").toUpperCase() === statusFilter;

            const searchable = [
                row.transaction_number,
                row.customer_name,
                row.warehouse_name,
                row.source_order_number,
                row.status,
                row.document_status,
                row.driver_name,
                row.vehicle_no,
            ]
                .filter(Boolean)
                .join(" ")
                .toLowerCase();

            return (
                matchesStatus &&
                (!query || searchable.includes(query))
            );
        });
    }, [data.challans, search, statusFilter]);

    const totals = useMemo(() => {
        const challans = data.challans || [];

        return {
            count: challans.length,
            pending: challans.filter(
                (row) =>
                    String(row.document_status || "").toLowerCase() ===
                    "pending invoice"
            ).length,
            approved: challans.filter(
                (row) =>
                    String(row.status || "").toUpperCase() === "APPROVED"
            ).length,
            amount: challans.reduce(
                (sum, row) =>
                    sum + Number(row.gross_amount || 0),
                0
            ),
        };
    }, [data.challans]);

    function printReport(row) {
        window.open(
            `/dashboard/delivery-challans/${row.delivery_challan_id}?print=1`,
            "_blank",
            "noopener,noreferrer"
        );
    }

    async function deleteDraft(row) {
        if (!permissions.canDelete) {
            window.alert(
                "You do not have permission to delete Delivery Challans."
            );
            return;
        }

        const confirmed = window.confirm(
            `Are you sure you want to delete ${row.transaction_number}?`
        );

        if (!confirmed) return;

        try {
            const response = await fetch(
                `/api/delivery-challans/${row.delivery_challan_id}`,
                {
                    method: "DELETE",
                    credentials: "same-origin",
                }
            );

            const result = await response.json();

            if (!response.ok || !result.success) {
                throw new Error(
                    result.message ||
                        "Could not delete the challan."
                );
            }

            await loadChallans();
        } catch (err) {
            window.alert(
                err.message ||
                    "Could not delete the challan."
            );
        }
    }

    const inputClass =
        "w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:placeholder:text-slate-500";

    const statusClass = (status) => {
        const normalized = String(status || "").toUpperCase();

        if (normalized === "APPROVED") {
            return "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300";
        }

        if (normalized === "VOID") {
            return "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300";
        }

        return "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300";
    };

    const summaryCards = [
        {
            label: "Total Challans",
            value: totals.count,
            icon: "▤",
            style: "from-blue-500 to-indigo-600",
        },
        {
            label: "Pending Invoice",
            value: totals.pending,
            icon: "◷",
            style: "from-amber-400 to-orange-500",
        },
        {
            label: "Approved",
            value: totals.approved,
            icon: "✓",
            style: "from-emerald-500 to-green-600",
        },
        {
            label: "Gross Amount",
            value: money(totals.amount, data.company?.currency),
            icon: "₨",
            style: "from-violet-500 to-purple-600",
        },
    ];

    /*
     * Do not render protected content until permissions are checked.
     */
    if (permissionsLoading) {
        return (
            <main className="grid min-h-screen place-items-center bg-slate-50 p-6 dark:bg-slate-950">
                <div className="text-center">
                    <div className="mx-auto h-12 w-12 animate-spin rounded-full border-4 border-slate-200 border-t-blue-600 dark:border-slate-700 dark:border-t-blue-400" />
                    <p className="mt-4 font-semibold text-slate-700 dark:text-slate-200">
                        Checking user permissions...
                    </p>
                </div>
            </main>
        );
    }

    /*
     * VIEW permission denied.
     */
    if (!permissions.canView) {
        return (
            <main className="grid min-h-screen place-items-center bg-slate-50 p-6 dark:bg-slate-950">
                <section className="w-full max-w-lg rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-xl dark:border-slate-800 dark:bg-slate-900">
                    <div className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-red-100 text-3xl text-red-600 dark:bg-red-950/50 dark:text-red-400">
                        🔒
                    </div>

                    <h1 className="mt-5 text-2xl font-black text-slate-900 dark:text-white">
                        Access Restricted
                    </h1>

                    <p className="mt-2 text-sm leading-6 text-slate-500 dark:text-slate-400">
                        You do not have View permission for Delivery
                        Challans. Please contact your administrator
                        to request access.
                    </p>

                    <button
                        type="button"
                        onClick={loadPermissions}
                        className="mt-6 rounded-xl bg-blue-600 px-5 py-3 text-sm font-bold text-white transition hover:bg-blue-700"
                    >
                        Recheck Permissions
                    </button>
                </section>
            </main>
        );
    }

    return (
        <main className="min-h-screen bg-slate-50 p-4 text-slate-800 dark:bg-slate-950 dark:text-slate-100 sm:p-6 lg:p-8">
            <div className="mx-auto max-w-[1600px] space-y-6">

                {/* Page header */}
                <header className="overflow-hidden rounded-3xl bg-gradient-to-r from-blue-700 via-blue-600 to-emerald-600 p-6 text-white shadow-xl sm:p-8">
                    <div className="flex flex-col justify-between gap-6 lg:flex-row lg:items-center">
                        <div>
                            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-blue-100">
                                Sales · Logistics
                            </p>

                            <h1 className="mt-2 text-3xl font-black tracking-tight sm:text-4xl">
                                Delivery Challans
                            </h1>

                            <p className="mt-2 max-w-2xl text-sm text-blue-50 sm:text-base">
                                Manage outbound deliveries, track pending
                                invoices, and print delivery documents.
                            </p>
                        </div>

                        <div className="flex flex-wrap gap-3">
                            {permissions.canCreate && (
                                <Link
                                    href="/dashboard/delivery-challans/new"
                                    className="rounded-xl bg-white px-5 py-3 text-sm font-bold text-blue-700 shadow transition hover:-translate-y-0.5 hover:bg-blue-50"
                                >
                                    + Create Manually
                                </Link>
                            )}

                            {permissions.canViewPending && (
                                <Link
                                    href="/dashboard/delivery-challans/pending"
                                    className="rounded-xl border border-white/40 bg-white/10 px-5 py-3 text-sm font-bold text-white backdrop-blur transition hover:bg-white/20"
                                >
                                    Pending Delivery Challans →
                                </Link>
                            )}
                        </div>
                    </div>
                </header>

                {/* Summary cards */}
                <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                    {summaryCards.map((card) => (
                        <div
                            key={card.label}
                            className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-1 hover:shadow-md dark:border-slate-800 dark:bg-slate-900"
                        >
                            <div className="flex items-center justify-between gap-3">
                                <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
                                    {card.label}
                                </p>

                                <span
                                    className={`grid h-11 w-11 place-items-center rounded-xl bg-gradient-to-br ${card.style} text-xl font-bold text-white shadow-sm`}
                                >
                                    {card.icon}
                                </span>
                            </div>

                            <p className="mt-4 break-words text-2xl font-black tracking-tight">
                                {card.value}
                            </p>
                        </div>
                    ))}
                </section>

                {/* Delivery Challan Register */}
                <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
                    <div className="flex flex-col gap-4 border-b border-slate-200 p-5 dark:border-slate-800 lg:flex-row lg:items-center lg:justify-between">
                        <div>
                            <h2 className="text-xl font-bold">
                                Delivery Challan Register
                            </h2>

                            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                                {filtered.length} record(s) found
                            </p>
                        </div>

                        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                            <input
                                className={inputClass}
                                value={search}
                                onChange={(event) =>
                                    setSearch(event.target.value)
                                }
                                placeholder="Search challan, customer, location..."
                                aria-label="Search delivery challans"
                            />

                            <select
                                className={inputClass}
                                value={statusFilter}
                                onChange={(event) =>
                                    setStatusFilter(event.target.value)
                                }
                                aria-label="Filter by status"
                            >
                                <option value="ALL">All statuses</option>
                                <option value="DRAFT">Draft</option>
                                <option value="APPROVED">Approved</option>
                                <option value="VOID">Void</option>
                            </select>

                            <div className="flex gap-2">
                                <button
                                    type="button"
                                    onClick={() => setView("table")}
                                    aria-pressed={view === "table"}
                                    className={`flex-1 rounded-xl px-4 py-3 text-sm font-semibold transition ${
                                        view === "table"
                                            ? "bg-blue-600 text-white shadow-sm"
                                            : "bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
                                    }`}
                                >
                                    Table
                                </button>

                                <button
                                    type="button"
                                    onClick={() => setView("cards")}
                                    aria-pressed={view === "cards"}
                                    className={`flex-1 rounded-xl px-4 py-3 text-sm font-semibold transition ${
                                        view === "cards"
                                            ? "bg-blue-600 text-white shadow-sm"
                                            : "bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
                                    }`}
                                >
                                    Cards
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Error */}
                    {error && (
                        <div
                            role="alert"
                            className="m-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300"
                        >
                            <p className="font-semibold">
                                Could not load Delivery Challans
                            </p>

                            <p className="mt-1">{error}</p>

                            <button
                                type="button"
                                onClick={handleRefresh}
                                className="mt-3 rounded-lg bg-red-600 px-4 py-2 font-semibold text-white transition hover:bg-red-700"
                            >
                                Retry loading
                            </button>
                        </div>
                    )}

                    {/* Loading */}
                    {loading ? (
                        <div className="p-12 text-center">
                            <div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-slate-200 border-t-blue-600 dark:border-slate-700 dark:border-t-blue-400" />

                            <p className="mt-4 font-semibold">
                                Loading Delivery Challans…
                            </p>

                            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                                Please wait while records are retrieved.
                            </p>
                        </div>
                    ) : filtered.length === 0 ? (
                        <div className="p-12 text-center">
                            <div className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-blue-50 text-3xl text-blue-600 dark:bg-blue-950/40 dark:text-blue-300">
                                ▤
                            </div>

                            <h3 className="mt-4 text-lg font-bold">
                                No Delivery Challans found
                            </h3>

                            <p className="mx-auto mt-1 max-w-lg text-sm text-slate-500 dark:text-slate-400">
                                {data.challans.length === 0
                                    ? "No delivery challans were returned by the API."
                                    : "No challans match your current search or status filter. Try changing your search or selecting All statuses."}
                            </p>

                            <div className="mt-5 flex flex-wrap justify-center gap-3">
                                {(search || statusFilter !== "ALL") && (
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setSearch("");
                                            setStatusFilter("ALL");
                                        }}
                                        className="rounded-xl border border-slate-200 px-4 py-3 text-sm font-semibold hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800"
                                    >
                                        Clear filters
                                    </button>
                                )}

                                {permissions.canCreate && (
                                    <Link
                                        href="/dashboard/delivery-challans/new"
                                        className="rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-blue-700"
                                    >
                                        + Create Challan
                                    </Link>
                                )}
                            </div>
                        </div>
                    ) : view === "cards" ? (
                        /* Card view */
                        <div className="grid gap-4 p-5 md:grid-cols-2 xl:grid-cols-3">
                            {filtered.map((row) => (
                                <article
                                    key={row.delivery_challan_id}
                                    className="rounded-2xl border border-slate-200 bg-white p-5 transition hover:border-blue-300 hover:shadow-md dark:border-slate-700 dark:bg-slate-900 dark:hover:border-blue-700"
                                >
                                    <div className="flex items-start justify-between gap-3">
                                        <div className="min-w-0">
                                            <p className="break-words font-black text-blue-700 dark:text-blue-400">
                                                {row.transaction_number || "Unnumbered"}
                                            </p>

                                            <h3 className="mt-1 break-words text-lg font-bold">
                                                {row.customer_name || "No customer"}
                                            </h3>
                                        </div>

                                        <span
                                            className={`shrink-0 rounded-full px-3 py-1 text-xs font-bold ${statusClass(row.status)}`}
                                        >
                                            {row.status || "UNKNOWN"}
                                        </span>
                                    </div>

                                    <div className="mt-4 space-y-2 text-sm text-slate-500 dark:text-slate-400">
                                        <p>
                                            Date:{" "}
                                            <span className="font-medium text-slate-800 dark:text-slate-200">
                                                {dateText(row.transaction_date)}
                                            </span>
                                        </p>

                                        <p>
                                            Location:{" "}
                                            <span className="font-medium text-slate-800 dark:text-slate-200">
                                                {row.warehouse_name || "—"}
                                            </span>
                                        </p>

                                        <p>
                                            Created from:{" "}
                                            <span className="font-medium text-slate-800 dark:text-slate-200">
                                                {row.source_order_number || "Manual"}
                                            </span>
                                        </p>

                                        <p>
                                            Document:{" "}
                                            <span className="font-medium text-slate-800 dark:text-slate-200">
                                                {row.document_status || "—"}
                                            </span>
                                        </p>
                                    </div>

                                    <p className="mt-4 text-xl font-black">
                                        {money(row.gross_amount, row.currency)}
                                    </p>

                                    <div className="mt-4 flex flex-wrap gap-2">
                                        <Link
                                            className="rounded-lg bg-blue-600 px-3 py-2 text-xs font-bold text-white transition hover:bg-blue-700"
                                            href={`/dashboard/delivery-challans/${row.delivery_challan_id}`}
                                        >
                                            View
                                        </Link>

                                        {row.status === "DRAFT" &&
                                            permissions.canUpdate && (
                                                <Link
                                                    className="rounded-lg bg-emerald-600 px-3 py-2 text-xs font-bold text-white transition hover:bg-emerald-700"
                                                    href={`/dashboard/delivery-challans/${row.delivery_challan_id}?edit=1`}
                                                >
                                                    Edit
                                                </Link>
                                            )}

                                        <button
                                            type="button"
                                            onClick={() => printReport(row)}
                                            className="rounded-lg bg-slate-100 px-3 py-2 text-xs font-bold text-slate-700 transition hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
                                        >
                                            Report / Print
                                        </button>

                                        {row.status === "DRAFT" &&
                                            permissions.canDelete &&
                                            !row.source_order_id && (
                                                <button
                                                    type="button"
                                                    onClick={() => deleteDraft(row)}
                                                    className="rounded-lg bg-red-50 px-3 py-2 text-xs font-bold text-red-700 dark:bg-red-950/40 dark:text-red-300"
                                                >
                                                    Delete
                                                </button>
                                            )}
                                    </div>
                                </article>
                            ))}
                        </div>
                    ) : (
                        /* Table view */
                        <div className="overflow-x-auto">
                            <table className="w-full min-w-[1100px] text-left text-sm">
                                <thead className="bg-slate-50 text-xs uppercase tracking-wider text-slate-500 dark:bg-slate-950 dark:text-slate-400">
                                    <tr>
                                        <th className="px-5 py-4">Actions</th>
                                        <th className="px-5 py-4">Tran Date</th>
                                        <th className="px-5 py-4">
                                            Transaction Number
                                        </th>
                                        <th className="px-5 py-4">Customer</th>
                                        <th className="px-5 py-4">Location Name</th>
                                        <th className="px-5 py-4">Created From</th>
                                        <th className="px-5 py-4">Status</th>
                                        <th className="px-5 py-4">
                                            Document Status
                                        </th>
                                        <th className="px-5 py-4 text-right">
                                            Gross Amount
                                        </th>
                                    </tr>
                                </thead>

                                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                    {filtered.map((row) => (
                                        <tr
                                            key={row.delivery_challan_id}
                                            className="transition hover:bg-blue-50/60 dark:hover:bg-slate-800/50"
                                        >
                                            <td className="px-5 py-4">
                                                <div className="flex gap-2">
                                                    <Link
                                                        title="View challan"
                                                        className="rounded-lg bg-blue-50 px-3 py-2 font-bold text-blue-700 dark:bg-blue-950/50 dark:text-blue-300"
                                                        href={`/dashboard/delivery-challans/${row.delivery_challan_id}`}
                                                    >
                                                        View
                                                    </Link>

                                                    {row.status === "DRAFT" &&
                                                        permissions.canUpdate && (
                                                            <Link
                                                                title="Edit challan"
                                                                className="rounded-lg bg-emerald-50 px-3 py-2 font-bold text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300"
                                                                href={`/dashboard/delivery-challans/${row.delivery_challan_id}?edit=1`}
                                                            >
                                                                Edit
                                                            </Link>
                                                        )}

                                                    <button
                                                        type="button"
                                                        title="Print challan"
                                                        onClick={() => printReport(row)}
                                                        className="rounded-lg bg-slate-100 px-3 py-2 font-bold text-slate-700 dark:bg-slate-800 dark:text-slate-200"
                                                    >
                                                        Print
                                                    </button>

                                                    {row.status === "DRAFT" &&
                                                        permissions.canDelete &&
                                                        !row.source_order_id && (
                                                            <button
                                                                type="button"
                                                                onClick={() => deleteDraft(row)}
                                                                className="rounded-lg bg-red-50 px-3 py-2 font-bold text-red-700 dark:bg-red-950/40 dark:text-red-300"
                                                            >
                                                                Delete
                                                            </button>
                                                        )}
                                                </div>
                                            </td>

                                            <td className="whitespace-nowrap px-5 py-4">
                                                {dateText(row.transaction_date)}
                                            </td>

                                            <td className="whitespace-nowrap px-5 py-4 font-bold text-blue-700 dark:text-blue-400">
                                                {row.transaction_number || "—"}
                                            </td>

                                            <td className="px-5 py-4 font-semibold">
                                                {row.customer_name || "—"}
                                            </td>

                                            <td className="px-5 py-4">
                                                {row.warehouse_name || "—"}
                                            </td>

                                            <td className="px-5 py-4">
                                                {row.source_order_number || "Manual"}
                                            </td>

                                            <td className="px-5 py-4">
                                                <span
                                                    className={`rounded-full px-3 py-1 text-xs font-bold ${statusClass(row.status)}`}
                                                >
                                                    {row.status || "UNKNOWN"}
                                                </span>
                                            </td>

                                            <td className="px-5 py-4">
                                                {row.document_status || "—"}
                                            </td>

                                            <td className="whitespace-nowrap px-5 py-4 text-right font-bold">
                                                {money(row.gross_amount, row.currency)}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}

                    {/* Footer */}
                    <div className="flex flex-col justify-between gap-3 border-t border-slate-200 p-5 text-sm text-slate-500 dark:border-slate-800 dark:text-slate-400 sm:flex-row sm:items-center">
                        <span>
                            Showing {filtered.length} of{" "}
                            {data.challans.length} challans
                        </span>

                        <button
                            type="button"
                            onClick={handleRefresh}
                            disabled={requesting}
                            className="rounded-xl border border-slate-200 px-4 py-2 font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                        >
                            {requesting ? "Refreshing…" : "↻ Refresh"}
                        </button>
                    </div>
                </section>
            </div>
        </main>
    );
}
