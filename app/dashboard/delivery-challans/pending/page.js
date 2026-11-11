
"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
    ShieldCheck,
    LockKeyhole,
    RefreshCw,
    Search,
    CheckCircle2,
    AlertCircle,
    LoaderCircle,
    PackageCheck,
    Truck,
    ArrowLeft,
    Filter,
    Plus,
} from "lucide-react";

const PERMISSION_KEY = "pending_delivery_challans";

const inputClass =
    "w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:placeholder:text-slate-500";

const EMPTY_PERMISSIONS = {
    canView: false,
    canCreate: false,
    canUpdate: false,
    canDelete: false,
};

async function readResponse(response) {
    const result = await response.json().catch(() => ({}));

    if (!response.ok || result.success === false) {
        const error = new Error(
            result.message ||
                result.error ||
                (response.status === 403
                    ? "You do not have permission to perform this action."
                    : "The request could not be completed.")
        );

        error.status = response.status;
        throw error;
    }

    return result;
}

function toBoolean(value) {
    return (
        value === true ||
        value === 1 ||
        value === "1" ||
        (typeof value === "string" && value.toLowerCase() === "true")
    );
}

function formatNumber(value) {
    return Number(value || 0).toLocaleString("en-PK", {
        maximumFractionDigits: 3,
    });
}

function formatDate(value) {
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
}

function AlertMessage({ type = "error", message, onClose }) {
    if (!message) return null;

    const isSuccess = type === "success";

    return (
        <div
            role={isSuccess ? "status" : "alert"}
            className={`flex items-start gap-3 rounded-xl border p-4 text-sm ${
                isSuccess
                    ? "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300"
                    : "border-red-200 bg-red-50 text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300"
            }`}
        >
            {isSuccess ? (
                <CheckCircle2 size={19} className="mt-0.5 shrink-0" />
            ) : (
                <AlertCircle size={19} className="mt-0.5 shrink-0" />
            )}

            <span className="min-w-0 flex-1 leading-6">{message}</span>

            {onClose && (
                <button
                    type="button"
                    onClick={onClose}
                    aria-label="Dismiss message"
                    className="rounded-lg px-2 py-0.5 text-lg leading-none opacity-70 transition hover:opacity-100"
                >
                    ×
                </button>
            )}
        </div>
    );
}

function StatCard({ icon: Icon, label, value, description, color }) {
    const colors = {
        blue: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-200",
        emerald:
            "bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-200",
        violet:
            "bg-violet-100 text-violet-700 dark:bg-violet-900 dark:text-violet-200",
    };

    return (
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-start justify-between gap-3">
                <div>
                    <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
                        {label}
                    </p>
                    <p className="mt-3 text-3xl font-extrabold tracking-tight text-slate-950 dark:text-white">
                        {value}
                    </p>
                    <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                        {description}
                    </p>
                </div>

                <div
                    className={`flex h-12 w-12 items-center justify-center rounded-xl ${
                        colors[color] || colors.blue
                    }`}
                >
                    <Icon size={23} />
                </div>
            </div>
        </div>
    );
}

export default function PendingDeliveryChallansPage() {
    const router = useRouter();

    const [rows, setRows] = useState([]);
    const [selected, setSelected] = useState({});
    const [quantities, setQuantities] = useState({});

    const [entity, setEntity] = useState("");
    const [transactionNumber, setTransactionNumber] = useState("");
    const [items, setItems] = useState("");
    const [search, setSearch] = useState("");

    const [permissions, setPermissions] = useState(EMPTY_PERMISSIONS);

    const permissionsRef = useRef(EMPTY_PERMISSIONS);

    const [permissionsLoading, setPermissionsLoading] = useState(true);
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);

    const [error, setError] = useState("");
    const [success, setSuccess] = useState("");

    // ---------------------------------------------------------
    // LOAD CURRENT USER PERMISSIONS
    // ---------------------------------------------------------

    const loadPermissions = useCallback(async () => {
        setPermissionsLoading(true);
        setError("");

        try {
            const response = await fetch("/api/permissions/current", {
                cache: "no-store",
            });

            const result = await readResponse(response);

            const permissionList = Array.isArray(result.permissions)
                ? result.permissions
                : [];

            const permission = permissionList.find(
                (item) =>
                    String(item.permission_key || "").trim().toLowerCase() ===
                    PERMISSION_KEY
            );

            const nextPermissions = {
                canView: toBoolean(permission?.can_view),
                canCreate: toBoolean(permission?.can_create),
                canUpdate: toBoolean(permission?.can_update),
                canDelete: toBoolean(permission?.can_delete),
            };

            permissionsRef.current = nextPermissions;
            setPermissions(nextPermissions);

            return nextPermissions;
        } catch (err) {
            permissionsRef.current = EMPTY_PERMISSIONS;
            setPermissions(EMPTY_PERMISSIONS);

            setError(
                err.message || "Unable to verify your delivery challan rights."
            );

            return null;
        } finally {
            setPermissionsLoading(false);
        }
    }, []);

    // ---------------------------------------------------------
    // LOAD PENDING DELIVERY CHALLAN LINES
    // ---------------------------------------------------------

    const load = useCallback(
        async (permissionOverride = null) => {
            const access = permissionOverride || permissionsRef.current;

            if (!access.canView) {
                setRows([]);
                setSelected({});
                setQuantities({});
                return;
            }

            setLoading(true);
            setError("");
            setSuccess("");

            try {
                const params = new URLSearchParams({
                    type: "SALES_ORDER",
                    entity: entity.trim(),
                    transactionNumber: transactionNumber.trim(),
                    items: items.trim(),
                });

                const response = await fetch(
                    `/api/delivery-challans/pending?${params.toString()}`,
                    {
                        cache: "no-store",
                    }
                );

                const result = await readResponse(response);

                const nextRows = Array.isArray(result.rows)
                    ? result.rows
                    : Array.isArray(result.pending)
                      ? result.pending
                      : [];

                setRows(nextRows);
                setSelected({});

                setQuantities(
                    Object.fromEntries(
                        nextRows.map((row) => [
                            String(row.order_item_id),
                            Number(row.pending_quantity || 0),
                        ])
                    )
                );
            } catch (err) {
                setRows([]);
                setSelected({});
                setQuantities({});

                setError(
                    err.message || "Could not load pending delivery challans."
                );

                if (err.status === 403) {
                    const nextPermissions = {
                        ...permissionsRef.current,
                        canView: false,
                    };

                    permissionsRef.current = nextPermissions;
                    setPermissions(nextPermissions);
                }
            } finally {
                setLoading(false);
            }
        },
        [entity, transactionNumber, items]
    );

    // ---------------------------------------------------------
    // INITIAL PERMISSION CHECK AND DATA LOAD
    // ---------------------------------------------------------

    useEffect(() => {
        let cancelled = false;

        const timer = setTimeout(async () => {
            const access = await loadPermissions();

            if (cancelled || !access) return;

            if (access.canView) {
                await load(access);
            }
        }, 0);

        return () => {
            cancelled = true;
            clearTimeout(timer);
        };
    }, [loadPermissions, load]);

    // ---------------------------------------------------------
    // REFRESH RIGHTS WHEN USER RIGHTS ARE UPDATED
    // ---------------------------------------------------------

    useEffect(() => {
        let cancelled = false;

        const handlePermissionsUpdated = async () => {
            const access = await loadPermissions();

            if (cancelled || !access) return;

            if (access.canView) {
                await load(access);
            } else {
                setRows([]);
                setSelected({});
                setQuantities({});
            }
        };

        window.addEventListener(
            "erp-permissions-updated",
            handlePermissionsUpdated
        );

        return () => {
            cancelled = true;
            window.removeEventListener(
                "erp-permissions-updated",
                handlePermissionsUpdated
            );
        };
    }, [loadPermissions, load]);

    // ---------------------------------------------------------
    // FILTERED ROWS
    // ---------------------------------------------------------

    const filtered = useMemo(() => {
        const query = search.trim().toLowerCase();

        if (!query) return rows;

        return rows.filter((row) =>
            [
                row.order_number,
                row.customer_name,
                row.warehouse_name,
                row.item_name,
                row.item_description,
                row.uom,
            ]
                .filter(Boolean)
                .join(" ")
                .toLowerCase()
                .includes(query)
        );
    }, [rows, search]);

    const selectedRows = useMemo(
        () =>
            filtered.filter(
                (row) => selected[String(row.order_item_id)]
            ),
        [filtered, selected]
    );

    const selectedOrderIds = useMemo(
        () => [...new Set(selectedRows.map((row) => Number(row.order_id)))],
        [selectedRows]
    );

    const totalQuantity = useMemo(
        () =>
            selectedRows.reduce(
                (sum, row) =>
                    sum + Number(quantities[String(row.order_item_id)] || 0),
                0
            ),
        [selectedRows, quantities]
    );

    const totalPendingQuantity = useMemo(
        () =>
            rows.reduce(
                (sum, row) => sum + Number(row.pending_quantity || 0),
                0
            ),
        [rows]
    );

    // ---------------------------------------------------------
    // SELECT / DESELECT ROW
    // ---------------------------------------------------------

    function toggleRow(row) {
        if (!permissionsRef.current.canCreate) {
            setError("You do not have permission to create delivery challans.");
            return;
        }

        const key = String(row.order_item_id);
        const isCurrentlySelected = Boolean(selected[key]);

        if (isCurrentlySelected) {
            setSelected((previous) => {
                const next = { ...previous };
                delete next[key];
                return next;
            });
            setError("");
            return;
        }

        const currentlySelected = rows.filter(
            (item) => selected[String(item.order_item_id)]
        );

        if (
            currentlySelected.length > 0 &&
            Number(currentlySelected[0].order_id) !== Number(row.order_id)
        ) {
            setError(
                "Select lines from one Sales Order at a time. Create the challan, then select another order."
            );
            return;
        }

        setError("");
        setSelected((previous) => ({
            ...previous,
            [key]: true,
        }));
    }

    // ---------------------------------------------------------
    // SELECT ALL ROWS FROM THE SAME ORDER
    // ---------------------------------------------------------

    function toggleAll() {
        if (!permissionsRef.current.canCreate || filtered.length === 0) return;

        const allVisibleSelected = filtered.every(
            (row) => selected[String(row.order_item_id)]
        );

        if (allVisibleSelected) {
            setSelected((previous) => {
                const next = { ...previous };

                filtered.forEach((row) => {
                    delete next[String(row.order_item_id)];
                });

                return next;
            });

            setError("");
            return;
        }

        const firstSelected = rows.find(
            (row) => selected[String(row.order_item_id)]
        );

        const orderId = firstSelected
            ? Number(firstSelected.order_id)
            : Number(filtered[0].order_id);

        const sameOrderRows = filtered.filter(
            (row) => Number(row.order_id) === orderId
        );

        setSelected((previous) => {
            const next = { ...previous };

            sameOrderRows.forEach((row) => {
                next[String(row.order_item_id)] = true;
            });

            return next;
        });

        if (filtered.some((row) => Number(row.order_id) !== orderId)) {
            setError(
                "Select All selects lines from the same Sales Order only."
            );
        } else {
            setError("");
        }
    }

    // ---------------------------------------------------------
    // UPDATE DELIVERY QUANTITY
    // ---------------------------------------------------------

    function updateQuantity(row, value) {
        if (!permissionsRef.current.canCreate) return;

        const number = value === "" ? "" : Number(value);
        const pending = Number(row.pending_quantity);

        if (
            number !== "" &&
            (!Number.isFinite(number) || number < 0)
        ) {
            return;
        }

        if (number !== "" && number > pending) {
            setError(
                `Quantity cannot exceed ${formatNumber(pending)} for ${row.item_name}.`
            );
            return;
        }

        setError("");

        setQuantities((previous) => ({
            ...previous,
            [String(row.order_item_id)]: number,
        }));
    }

    // ---------------------------------------------------------
    // CREATE DELIVERY CHALLAN
    // ---------------------------------------------------------

    async function createChallan() {
        setError("");
        setSuccess("");

        if (!permissionsRef.current.canCreate) {
            setError("You do not have permission to create delivery challans.");
            return;
        }

        if (!selectedRows.length) {
            setError("Select at least one Sales Order line.");
            return;
        }

        if (selectedOrderIds.length !== 1) {
            setError("Select lines from one Sales Order at a time.");
            return;
        }

        const order = selectedRows[0];

        const challanItems = selectedRows.map((row) => ({
            source_order_item_id: Number(row.order_item_id),
            product_id: row.product_id ? Number(row.product_id) : null,
            item_name: row.item_name,
            item_description: row.item_description || "",
            item_balance: Number(row.item_balance || 0),
            uom: row.uom || "",
            quantity: Number(quantities[String(row.order_item_id)]),
            unit_price: Number(row.unit_price ?? row.retail_price ?? 0),
            tax_code: row.tax_code || "",
            tax_rate: Number(row.tax_rate || 0),
            memo: row.line_memo || "",
        }));

        for (const item of challanItems) {
            const original = selectedRows.find(
                (row) =>
                    Number(row.order_item_id) === item.source_order_item_id
            );

            if (
                !Number.isFinite(item.quantity) ||
                item.quantity <= 0 ||
                item.quantity > Number(original.pending_quantity)
            ) {
                setError(
                    `Enter a delivery quantity greater than zero and no more than the pending quantity for ${item.item_name}.`
                );
                return;
            }
        }

        if (!order.customer_id || !order.warehouse_id) {
            setError(
                "The selected Sales Order is missing its customer or warehouse."
            );
            return;
        }

        setSaving(true);

        try {
            const response = await fetch("/api/delivery-challans", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                cache: "no-store",
                body: JSON.stringify({
                    source_order_id: Number(order.order_id),
                    customer_id: Number(order.customer_id),
                    warehouse_id: Number(order.warehouse_id),
                    transaction_date: new Date().toISOString().slice(0, 10),
                    status: "APPROVED",
                    challan_class: "Outbound Shipment",
                    items: challanItems,
                }),
            });

            const result = await readResponse(response);

            const challanId =
                result.challan?.delivery_challan_id ??
                result.delivery_challan_id;

            if (!challanId) {
                throw new Error(
                    "The challan was created, but its document ID was not returned by the API."
                );
            }

            setSuccess(result.message || "Delivery Challan created.");

            router.push(`/dashboard/delivery-challans/${challanId}`);
            router.refresh();
        } catch (err) {
            setError(
                err.message || "Could not create Delivery Challan."
            );

            if (err.status === 403) {
                const access = await loadPermissions();

                if (!access?.canCreate) {
                    const nextPermissions = {
                        ...permissionsRef.current,
                        canCreate: false,
                    };

                    permissionsRef.current = nextPermissions;
                    setPermissions(nextPermissions);
                }
            }
        } finally {
            setSaving(false);
        }
    }

    // ---------------------------------------------------------
    // ACCESS CHECKS
    // ---------------------------------------------------------

    if (permissionsLoading) {
        return (
            <main className="flex min-h-screen items-center justify-center bg-slate-50 p-6 dark:bg-slate-950">
                <div className="text-center">
                    <LoaderCircle
                        size={38}
                        className="mx-auto animate-spin text-blue-600"
                    />
                    <p className="mt-4 font-semibold text-slate-700 dark:text-slate-200">
                        Checking your access rights...
                    </p>
                </div>
            </main>
        );
    }

    if (!permissions.canView) {
        return (
            <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-10 dark:bg-slate-950">
                <div className="w-full max-w-lg rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-xl dark:border-slate-800 dark:bg-slate-900">
                    <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300">
                        <LockKeyhole size={30} />
                    </div>

                    <h1 className="mt-5 text-2xl font-extrabold text-slate-950 dark:text-white">
                        Access Denied
                    </h1>

                    <p className="mt-3 text-sm leading-6 text-slate-600 dark:text-slate-400">
                        You do not have View permission for Pending Delivery
                        Challans. Please contact your administrator to request
                        access.
                    </p>

                    {error && (
                        <p className="mt-4 rounded-xl bg-red-50 p-3 text-xs text-red-700 dark:bg-red-950/40 dark:text-red-300">
                            {error}
                        </p>
                    )}

                    <Link
                        href="/dashboard"
                        className="mt-6 inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-3 text-sm font-bold text-white transition hover:bg-blue-700"
                    >
                        <ArrowLeft size={16} />
                        Back to Dashboard
                    </Link>
                </div>
            </main>
        );
    }

    // ---------------------------------------------------------
    // PAGE UI
    // ---------------------------------------------------------

    return (
        <main className="min-h-screen bg-slate-50 p-4 text-slate-800 dark:bg-slate-950 dark:text-slate-100 sm:p-6 lg:p-8">
            <div className="mx-auto max-w-[1700px] space-y-6">
                {/* HEADER */}
                <header className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-blue-800 via-blue-700 to-emerald-600 p-6 text-white shadow-xl sm:p-8">
                    <div className="absolute -right-16 -top-20 h-64 w-64 rounded-full bg-white/10 blur-3xl" />
                    <div className="absolute -bottom-24 right-1/3 h-52 w-52 rounded-full bg-emerald-300/20 blur-3xl" />

                    <div className="relative">
                        <Link
                            href="/dashboard/delivery-challans"
                            className="inline-flex items-center gap-2 text-sm font-semibold text-blue-100 transition hover:text-white"
                        >
                            <ArrowLeft size={16} />
                            Delivery Challans
                        </Link>

                        <div className="mt-6 flex flex-col justify-between gap-5 lg:flex-row lg:items-end">
                            <div>
                                <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-xs font-bold uppercase tracking-wider text-white">
                                    <PackageCheck size={14} />
                                    Sales Fulfillment
                                </div>

                                <h1 className="text-3xl font-black tracking-tight sm:text-4xl">
                                    Pending Delivery Challans
                                </h1>

                                <p className="mt-2 max-w-3xl text-sm leading-6 text-blue-50 sm:text-base">
                                    Select approved Sales Order lines, confirm
                                    pending quantities, and create an outbound
                                    delivery document.
                                </p>
                            </div>

                            <button
                                type="button"
                                onClick={() => load()}
                                disabled={loading || saving}
                                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-white/30 bg-white/10 px-5 py-3 text-sm font-bold text-white transition hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-60"
                            >
                                <RefreshCw
                                    size={16}
                                    className={loading ? "animate-spin" : ""}
                                />
                                Refresh
                            </button>
                        </div>
                    </div>
                </header>

                {/* STATISTICS */}
                <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                    <StatCard
                        icon={Truck}
                        label="Pending Order Lines"
                        value={loading ? "—" : rows.length}
                        description="Sales Order lines awaiting delivery"
                        color="blue"
                    />

                    <StatCard
                        icon={PackageCheck}
                        label="Pending Quantity"
                        value={
                            loading
                                ? "—"
                                : formatNumber(totalPendingQuantity)
                        }
                        description="Total quantity remaining to deliver"
                        color="emerald"
                    />

                    <StatCard
                        icon={CheckCircle2}
                        label="Selected Lines"
                        value={selectedRows.length}
                        description="Lines selected for the new challan"
                        color="violet"
                    />
                </section>

                {/* FILTERS */}
                <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-6">
                    <div className="mb-5 flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-200">
                            <Filter size={19} />
                        </div>
                        <div>
                            <h2 className="font-bold text-slate-950 dark:text-white">
                                Filter Pending Orders
                            </h2>
                            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                                Narrow down pending quantities by customer,
                                transaction, or item.
                            </p>
                        </div>
                    </div>

                    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                        <label className="block text-sm font-semibold text-slate-700 dark:text-slate-200">
                            Type
                            <select
                                className={`${inputClass} mt-2`}
                                value="SALES_ORDER"
                                disabled
                            >
                                <option value="SALES_ORDER">Sales Order</option>
                            </select>
                        </label>

                        <label className="block text-sm font-semibold text-slate-700 dark:text-slate-200">
                            Entity / Customer
                            <input
                                className={`${inputClass} mt-2`}
                                value={entity}
                                onChange={(event) =>
                                    setEntity(event.target.value)
                                }
                                onKeyDown={(event) => {
                                    if (event.key === "Enter") load();
                                }}
                                placeholder="Search customer..."
                            />
                        </label>

                        <label className="block text-sm font-semibold text-slate-700 dark:text-slate-200">
                            Transaction Number
                            <input
                                className={`${inputClass} mt-2`}
                                value={transactionNumber}
                                onChange={(event) =>
                                    setTransactionNumber(event.target.value)
                                }
                                onKeyDown={(event) => {
                                    if (event.key === "Enter") load();
                                }}
                                placeholder="e.g. SO-000030"
                            />
                        </label>

                        <label className="block text-sm font-semibold text-slate-700 dark:text-slate-200">
                            Items
                            <input
                                className={`${inputClass} mt-2`}
                                value={items}
                                onChange={(event) =>
                                    setItems(event.target.value)
                                }
                                onKeyDown={(event) => {
                                    if (event.key === "Enter") load();
                                }}
                                placeholder="Search item name..."
                            />
                        </label>
                    </div>

                    <div className="mt-5 flex flex-wrap gap-3">
                        <button
                            type="button"
                            onClick={() => load()}
                            disabled={loading}
                            className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-3 text-sm font-bold text-white shadow-md shadow-blue-600/20 transition hover:bg-blue-700 disabled:opacity-60"
                        >
                            <Search size={16} />
                            {loading ? "Applying..." : "Apply Filters"}
                        </button>

                        <button
                            type="button"
                            onClick={() => {
                                setEntity("");
                                setTransactionNumber("");
                                setItems("");
                                setSearch("");
                                setSelected({});
                                setError("");
                            }}
                            className="rounded-xl border border-slate-200 bg-white px-5 py-3 text-sm font-bold text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200 dark:hover:bg-slate-800"
                        >
                            Clear Filters
                        </button>
                    </div>
                </section>

                {/* MAIN TABLE */}
                <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
                    <div className="flex flex-col gap-4 border-b border-slate-200 p-5 dark:border-slate-800 lg:flex-row lg:items-center lg:justify-between sm:p-6">
                        <div>
                            <h2 className="text-xl font-extrabold text-slate-950 dark:text-white">
                                Pending Sales Order Lines
                            </h2>
                            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                                Select lines from the same Sales Order for each
                                delivery challan.
                            </p>
                        </div>

                        <div className="flex flex-col gap-3 sm:flex-row">
                            <div className="relative">
                                <Search
                                    size={17}
                                    className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
                                />
                                <input
                                    className={`${inputClass} min-w-0 pl-10 sm:w-64`}
                                    value={search}
                                    onChange={(event) =>
                                        setSearch(event.target.value)
                                    }
                                    placeholder="Search displayed rows..."
                                    aria-label="Search displayed rows"
                                />
                            </div>

                            {permissions.canCreate && (
                                <button
                                    type="button"
                                    onClick={toggleAll}
                                    disabled={filtered.length === 0 || loading}
                                    className="rounded-xl border border-slate-200 px-4 py-3 text-sm font-bold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                                >
                                    {filtered.length > 0 &&
                                    filtered.every(
                                        (row) =>
                                            selected[String(row.order_item_id)]
                                    )
                                        ? "Deselect All"
                                        : "Select All"}
                                </button>
                            )}
                        </div>
                    </div>

                    <div className="space-y-4 p-5 sm:p-6">
                        <AlertMessage
                            message={error}
                            onClose={() => setError("")}
                        />

                        <AlertMessage
                            type="success"
                            message={success}
                            onClose={() => setSuccess("")}
                        />
                    </div>

                    {loading ? (
                        <div className="flex min-h-72 flex-col items-center justify-center gap-3 p-12 text-center">
                            <LoaderCircle
                                size={34}
                                className="animate-spin text-blue-600"
                            />
                            <p className="font-semibold text-slate-700 dark:text-slate-200">
                                Loading pending quantities...
                            </p>
                            <p className="text-sm text-slate-500 dark:text-slate-400">
                                Retrieving approved Sales Order lines.
                            </p>
                        </div>
                    ) : filtered.length === 0 ? (
                        <div className="flex min-h-72 flex-col items-center justify-center p-12 text-center">
                            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-200">
                                <CheckCircle2 size={30} />
                            </div>

                            <h3 className="mt-4 text-lg font-bold text-slate-950 dark:text-white">
                                No pending lines found
                            </h3>

                            <p className="mt-2 max-w-md text-sm leading-6 text-slate-500 dark:text-slate-400">
                                All matching approved Sales Order quantities
                                may already have been delivered, or no records
                                match your filters.
                            </p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full min-w-[1450px] text-left text-sm">
                                <thead className="bg-slate-100 text-xs uppercase tracking-wider text-slate-600 dark:bg-slate-950 dark:text-slate-300">
                                    <tr>
                                        {permissions.canCreate && (
                                            <th className="px-4 py-4">
                                                Select
                                            </th>
                                        )}
                                        <th className="px-4 py-4">Seq. ID</th>
                                        <th className="px-4 py-4">SO Date</th>
                                        <th className="px-4 py-4">
                                            Transaction No
                                        </th>
                                        <th className="px-4 py-4">Customer</th>
                                        <th className="px-4 py-4">Location</th>
                                        <th className="px-4 py-4">Item Name</th>
                                        <th className="px-4 py-4">
                                            Item Description
                                        </th>
                                        <th className="px-4 py-4">UOM</th>
                                        <th className="px-4 py-4 text-right">
                                            Item Balance
                                        </th>
                                        <th className="px-4 py-4 text-right">
                                            Line Qty.
                                        </th>
                                        <th className="px-4 py-4 text-right">
                                            Pending Qty.
                                        </th>
                                        {permissions.canCreate && (
                                            <th className="px-4 py-4">
                                                Do Qty.
                                            </th>
                                        )}
                                    </tr>
                                </thead>

                                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                    {filtered.map((row) => {
                                        const key = String(row.order_item_id);
                                        const isSelected = Boolean(
                                            selected[key]
                                        );

                                        return (
                                            <tr
                                                key={key}
                                                className={`transition ${
                                                    isSelected
                                                        ? "bg-blue-50 dark:bg-blue-950/40"
                                                        : "hover:bg-slate-50 dark:hover:bg-slate-800/50"
                                                }`}
                                            >
                                                {permissions.canCreate && (
                                                    <td className="px-4 py-4">
                                                        <input
                                                            type="checkbox"
                                                            checked={isSelected}
                                                            onChange={() =>
                                                                toggleRow(row)
                                                            }
                                                            className="h-4 w-4 cursor-pointer accent-blue-600"
                                                            aria-label={`Select ${row.item_name}`}
                                                        />
                                                    </td>
                                                )}

                                                <td className="px-4 py-4 text-slate-500 dark:text-slate-400">
                                                    {row.sequence_id ?? "—"}
                                                </td>

                                                <td className="whitespace-nowrap px-4 py-4">
                                                    {formatDate(
                                                        row.transaction_date
                                                    )}
                                                </td>

                                                <td className="whitespace-nowrap px-4 py-4 font-bold text-blue-700 dark:text-blue-400">
                                                    {row.order_number || "—"}
                                                </td>

                                                <td className="px-4 py-4 font-semibold text-slate-800 dark:text-slate-200">
                                                    {row.customer_name || "—"}
                                                </td>

                                                <td className="px-4 py-4">
                                                    {row.warehouse_name || "—"}
                                                </td>

                                                <td className="px-4 py-4 font-semibold">
                                                    {row.item_name || "—"}
                                                </td>

                                                <td className="max-w-56 px-4 py-4 text-slate-600 dark:text-slate-400">
                                                    {row.item_description || "—"}
                                                </td>

                                                <td className="px-4 py-4">
                                                    {row.uom || "—"}
                                                </td>

                                                <td className="px-4 py-4 text-right tabular-nums">
                                                    {formatNumber(
                                                        row.item_balance
                                                    )}
                                                </td>

                                                <td className="px-4 py-4 text-right tabular-nums">
                                                    {formatNumber(
                                                        row.line_quantity
                                                    )}
                                                </td>

                                                <td className="px-4 py-4 text-right font-extrabold tabular-nums text-emerald-700 dark:text-emerald-400">
                                                    {formatNumber(
                                                        row.pending_quantity
                                                    )}
                                                </td>

                                                {permissions.canCreate && (
                                                    <td className="px-4 py-4">
                                                        <input
                                                            type="number"
                                                            min="0"
                                                            max={row.pending_quantity}
                                                            step="0.001"
                                                            value={
                                                                quantities[
                                                                    key
                                                                ] ?? ""
                                                            }
                                                            onChange={(event) =>
                                                                updateQuantity(
                                                                    row,
                                                                    event.target
                                                                        .value
                                                                )
                                                            }
                                                            disabled={saving}
                                                            className="w-28 rounded-lg border border-slate-200 bg-white px-3 py-2 text-right text-sm font-semibold text-slate-800 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 disabled:opacity-60 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                                                            aria-label={`Delivery quantity for ${row.item_name}`}
                                                        />
                                                    </td>
                                                )}
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )}

                    {/* FOOTER */}
                    <footer className="flex flex-col gap-4 border-t border-slate-200 bg-slate-50 p-5 dark:border-slate-800 dark:bg-slate-950 sm:flex-row sm:items-center sm:justify-between sm:px-6">
                        <div className="text-sm text-slate-500 dark:text-slate-400">
                            <span className="font-extrabold text-slate-950 dark:text-white">
                                {selectedRows.length}
                            </span>{" "}
                            line(s) selected
                            <span className="mx-2 text-slate-300 dark:text-slate-700">
                                |
                            </span>
                            Total delivery quantity{" "}
                            <span className="font-extrabold text-slate-950 dark:text-white">
                                {formatNumber(totalQuantity)}
                            </span>
                        </div>

                        <div className="flex flex-wrap gap-3">
                            <Link
                                href="/dashboard/delivery-challans"
                                className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-5 py-3 text-sm font-bold text-slate-700 transition hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
                            >
                                <ArrowLeft size={16} />
                                Back
                            </Link>

                            {permissions.canCreate && (
                                <button
                                    type="button"
                                    disabled={
                                        saving ||
                                        loading ||
                                        selectedRows.length === 0
                                    }
                                    onClick={createChallan}
                                    className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-emerald-600 px-6 py-3 text-sm font-bold text-white shadow-lg shadow-blue-600/20 transition hover:-translate-y-0.5 hover:shadow-xl disabled:cursor-not-allowed disabled:opacity-50"
                                >
                                    {saving ? (
                                        <>
                                            <LoaderCircle
                                                size={17}
                                                className="animate-spin"
                                            />
                                            Creating Challan...
                                        </>
                                    ) : (
                                        <>
                                            <Plus size={17} />
                                            Create Delivery Challan
                                        </>
                                    )}
                                </button>
                            )}
                        </div>
                    </footer>
                </section>

                {/* PERMISSION INFORMATION */}
                {!permissions.canCreate && (
                    <div className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-200">
                        <LockKeyhole
                            size={19}
                            className="mt-0.5 shrink-0"
                        />
                        <p className="leading-6">
                            You have permission to view Pending Delivery
                            Challans, but you do not have Create permission.
                            Contact your administrator if you need to create
                            delivery challans.
                        </p>
                    </div>
                )}

                <div className="flex flex-col gap-2 pb-4 text-center text-xs text-slate-500 sm:flex-row sm:items-center sm:justify-between sm:text-left dark:text-slate-400">
                    <span>ERP · Sales · Pending Delivery Challans</span>
                    <span className="inline-flex items-center justify-center gap-1.5">
                        <ShieldCheck
                            size={14}
                            className="text-emerald-600 dark:text-emerald-400"
                        />
                        Role-based access control
                    </span>
                </div>
            </div>
        </main>
    );
}
