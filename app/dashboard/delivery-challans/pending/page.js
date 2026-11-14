
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
    Columns3,
    ChevronDown,
    Eye,
    EyeOff,
} from "lucide-react";

const PERMISSION_KEY = "pending_delivery_challans";

const inputClass =
    "w-full min-w-0 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-800 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100";

const EMPTY_PERMISSIONS = {
    canView: false,
    canCreate: false,
    canUpdate: false,
    canDelete: false,
};

const TABLE_COLUMNS = [
    { key: "sequence_id", label: "Seq. ID" },
    { key: "transaction_date", label: "Transaction Date" },
    { key: "order_number", label: "Transaction Number" },
    { key: "customer_name", label: "Customer" },
    { key: "warehouse_name", label: "Location" },
    { key: "item_name", label: "Item Name" },
    { key: "item_description", label: "Item Description" },
    { key: "uom", label: "UOM" },
    { key: "item_balance", label: "Item Balance" },
    { key: "line_quantity", label: "Line Quantity" },
    { key: "pending_quantity", label: "Pending Quantity" },
];

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

function getRowKey(row) {
    return String(
        row.order_item_id ??
            row.invoice_item_id ??
            row.sales_invoice_item_id ??
            row.id
    );
}

function getTransactionId(row) {
    return Number(
        row.order_id ??
            row.invoice_id ??
            row.sales_invoice_id ??
            0
    );
}

function getTransactionNumber(row) {
    return (
        row.order_number ??
        row.invoice_number ??
        row.transaction_number ??
        "—"
    );
}

function uniqueOptions(rows, getter) {
    return [
        ...new Set(
            rows
                .map((row) => String(getter(row) || "").trim())
                .filter((value) => value && value !== "—")
        ),
    ].sort((a, b) => a.localeCompare(b));
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
                    className="rounded-lg px-2 py-0.5 text-lg leading-none opacity-70 hover:opacity-100"
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
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-start justify-between gap-3">
                <div>
                    <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
                        {label}
                    </p>
                    <p className="mt-3 text-3xl font-extrabold text-slate-950 dark:text-white">
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
    const [type, setType] = useState("SALES_ORDER");
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

    // Column visibility
    const [visibleColumns, setVisibleColumns] = useState(
        Object.fromEntries(
            TABLE_COLUMNS.map((column) => [column.key, true])
        )
    );

    const [columnsOpen, setColumnsOpen] = useState(false);
    const columnsRef = useRef(null);

    useEffect(() => {
        function handleOutsideClick(event) {
            if (
                columnsRef.current &&
                !columnsRef.current.contains(event.target)
            ) {
                setColumnsOpen(false);
            }
        }

        document.addEventListener("mousedown", handleOutsideClick);

        return () => {
            document.removeEventListener("mousedown", handleOutsideClick);
        };
    }, []);

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
                    type,
                    entity: entity.trim(),
                    transactionNumber: transactionNumber.trim(),
                    items: items.trim(),
                });

                const response = await fetch(
                    `/api/delivery-challans/pending?${params.toString()}`,
                    { cache: "no-store" }
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
                            getRowKey(row),
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
        [type, entity, transactionNumber, items]
    );

    const loadRef = useRef(load);

useEffect(() => {
    loadRef.current = load;
}, [load]);

    useEffect(() => {
        let cancelled = false;

        async function initialize() {
            const access = await loadPermissions();

            if (cancelled || !access) return;

            if (access.canView) {
                await loadRef.current(access);
            }
        }

        initialize();

        return () => {
            cancelled = true;
        };
    }, [loadPermissions]);

    useEffect(() => {
        let cancelled = false;

        async function handlePermissionsUpdated() {
            const access = await loadPermissions();

            if (cancelled || !access) return;

            if (access.canView) {
                await loadRef.current(access);
            } else {
                setRows([]);
                setSelected({});
                setQuantities({});
            }
        }

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
    }, [loadPermissions]);

    // Dropdown options are generated from the currently loaded rows.
    const entityOptions = useMemo(
        () => uniqueOptions(rows, (row) => row.customer_name),
        [rows]
    );

    const transactionOptions = useMemo(
        () => uniqueOptions(rows, getTransactionNumber),
        [rows]
    );

    const itemOptions = useMemo(
        () => uniqueOptions(rows, (row) => row.item_name),
        [rows]
    );

    const filtered = useMemo(() => {
        const query = search.trim().toLowerCase();

        if (!query) return rows;

        return rows.filter((row) =>
            [
                getTransactionNumber(row),
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
        () => filtered.filter((row) => selected[getRowKey(row)]),
        [filtered, selected]
    );

    const selectedTransactionIds = useMemo(
        () => [
            ...new Set(selectedRows.map((row) => getTransactionId(row))),
        ],
        [selectedRows]
    );

    const totalQuantity = useMemo(
        () =>
            selectedRows.reduce(
                (sum, row) =>
                    sum + Number(quantities[getRowKey(row)] || 0),
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

    const visibleColumnCount = TABLE_COLUMNS.filter(
        (column) => visibleColumns[column.key]
    ).length;

    function toggleColumn(key) {
        setVisibleColumns((previous) => {
            const currentlyVisible = TABLE_COLUMNS.filter(
                (column) => previous[column.key]
            ).length;

            if (previous[key] && currentlyVisible <= 1) {
                // setError("At least one table column must remain visible.");
                return previous;
            }

            setError("");

            return {
                ...previous,
                [key]: !previous[key],
            };
        });
    }

    function showAllColumns() {
        setVisibleColumns(
            Object.fromEntries(
                TABLE_COLUMNS.map((column) => [column.key, true])
            )
        );
        setError("");
    }

    function toggleRow(row) {
        if (!permissionsRef.current.canCreate) {
            setError("You do not have permission to create delivery challans.");
            return;
        }

        const key = getRowKey(row);

        if (selected[key]) {
            setSelected((previous) => {
                const next = { ...previous };
                delete next[key];
                return next;
            });

            setError("");
            return;
        }

        const currentlySelected = rows.filter(
            (item) => selected[getRowKey(item)]
        );

        if (
            currentlySelected.length > 0 &&
            getTransactionId(currentlySelected[0]) !== getTransactionId(row)
        ) {
            setError(
                "Select lines from one transaction at a time. Create the challan, then select another transaction."
            );
            return;
        }

        setError("");

        setSelected((previous) => ({
            ...previous,
            [key]: true,
        }));
    }

    function toggleAll() {
        if (!permissionsRef.current.canCreate || filtered.length === 0) {
            return;
        }

        const allVisibleSelected = filtered.every(
            (row) => selected[getRowKey(row)]
        );

        if (allVisibleSelected) {
            setSelected((previous) => {
                const next = { ...previous };

                filtered.forEach((row) => {
                    delete next[getRowKey(row)];
                });

                return next;
            });

            setError("");
            return;
        }

        const firstSelected = rows.find(
            (row) => selected[getRowKey(row)]
        );

        const transactionId = firstSelected
            ? getTransactionId(firstSelected)
            : getTransactionId(filtered[0]);

        const sameTransactionRows = filtered.filter(
            (row) => getTransactionId(row) === transactionId
        );

        setSelected((previous) => {
            const next = { ...previous };

            sameTransactionRows.forEach((row) => {
                next[getRowKey(row)] = true;
            });

            return next;
        });

        if (
            filtered.some(
                (row) => getTransactionId(row) !== transactionId
            )
        ) {
            setError(
                "Select All selects lines from the same transaction only."
            );
        } else {
            setError("");
        }
    }

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
            [getRowKey(row)]: number,
        }));
    }

    async function createChallan() {
        setError("");
        setSuccess("");

        if (!permissionsRef.current.canCreate) {
            setError("You do not have permission to create delivery challans.");
            return;
        }

        if (!selectedRows.length) {
            setError("Select at least one transaction line.");
            return;
        }

        if (selectedTransactionIds.length !== 1) {
            setError("Select lines from one transaction at a time.");
            return;
        }

        if (type !== "SALES_ORDER") {
            setError(
                "Sales Invoice selection requires the Delivery Challan API to support invoice source references. The current creation flow supports Sales Orders only."
            );
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
            quantity: Number(quantities[getRowKey(row)]),
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
                item.quantity > Number(original?.pending_quantity)
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
                    transaction_date: new Date()
                        .toISOString()
                        .slice(0, 10),
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

            router.push(
                `/dashboard/delivery-challans/${challanId}`
            );

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

    function renderColumnValue(row, key) {
        switch (key) {
            case "sequence_id":
                return row.sequence_id ?? "—";
            case "transaction_date":
                return formatDate(row.transaction_date);
            case "order_number":
                return getTransactionNumber(row);
            case "customer_name":
                return row.customer_name || "—";
            case "warehouse_name":
                return row.warehouse_name || "—";
            case "item_name":
                return row.item_name || "—";
            case "item_description":
                return row.item_description || "—";
            case "uom":
                return row.uom || "—";
            case "item_balance":
                return formatNumber(row.item_balance);
            case "line_quantity":
                return formatNumber(row.line_quantity);
            case "pending_quantity":
                return formatNumber(row.pending_quantity);
            default:
                return "—";
        }
    }

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
                        className="mt-6 inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-3 text-sm font-bold text-white hover:bg-blue-700"
                    >
                        <ArrowLeft size={16} />
                        Back to Dashboard
                    </Link>
                </div>
            </main>
        );
    }

    const activeColumns = TABLE_COLUMNS.filter(
        (column) => visibleColumns[column.key]
    );

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
                            className="inline-flex items-center gap-2 text-sm font-semibold text-blue-100 hover:text-white"
                        >
                            <ArrowLeft size={16} />
                            Delivery Challans
                        </Link>

                        <div className="mt-6 flex flex-col justify-between gap-5 lg:flex-row lg:items-end">
                            <div>
                                <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-xs font-bold uppercase tracking-wider">
                                    <PackageCheck size={14} />
                                    Sales Fulfillment
                                </div>

                                <h1 className="text-3xl font-black tracking-tight sm:text-4xl">
                                    Pending Delivery Challans
                                </h1>

                                <p className="mt-2 max-w-3xl text-sm leading-6 text-blue-50 sm:text-base">
                                    Select approved transaction lines, confirm
                                    pending quantities, and create an outbound
                                    delivery document.
                                </p>
                            </div>

                            <button
                                type="button"
                                onClick={() => load()}
                                disabled={loading || saving}
                                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-white/30 bg-white/10 px-5 py-3 text-sm font-bold hover:bg-white/20 disabled:opacity-60"
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
                        label="Pending Transaction Lines"
                        value={loading ? "—" : rows.length}
                        description="Lines awaiting delivery"
                        color="blue"
                    />

                    <StatCard
                        icon={PackageCheck}
                        label="Pending Quantity"
                        value={
                            loading ? "—" : formatNumber(totalPendingQuantity)
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
                                Filter Pending Transactions
                            </h2>
                            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                                Filter by transaction type, customer,
                                transaction number, or item.
                            </p>
                        </div>
                    </div>

                    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                        <label className="block text-sm font-semibold text-slate-700 dark:text-slate-200">
                            Type
                            <select
                                className={`${inputClass} mt-2`}
                                value={type}
                                onChange={(event) => {
                                    setType(event.target.value);
                                    setEntity("");
                                    setTransactionNumber("");
                                    setItems("");
                                    setSelected({});
                                }}
                            >
                                <option value="SALES_ORDER">Sales Order</option>
                                <option value="SALES_INVOICE">Sales Invoice</option>
                            </select>
                        </label>

                        <label className="block text-sm font-semibold text-slate-700 dark:text-slate-200">
                            Entity / Customer
                            <select
                                className={`${inputClass} mt-2`}
                                value={entity}
                                onChange={(event) => setEntity(event.target.value)}
                            >
                                <option value="">All Entities</option>
                                {entityOptions.map((option) => (
                                    <option key={option} value={option}>
                                        {option}
                                    </option>
                                ))}
                            </select>
                        </label>

                        <label className="block text-sm font-semibold text-slate-700 dark:text-slate-200">
                            Transaction Number
                            <select
                                className={`${inputClass} mt-2`}
                                value={transactionNumber}
                                onChange={(event) =>
                                    setTransactionNumber(event.target.value)
                                }
                            >
                                <option value="">All Transactions</option>
                                {transactionOptions.map((option) => (
                                    <option key={option} value={option}>
                                        {option}
                                    </option>
                                ))}
                            </select>
                        </label>

                        <label className="block text-sm font-semibold text-slate-700 dark:text-slate-200">
                            Items
                            <select
                                className={`${inputClass} mt-2`}
                                value={items}
                                onChange={(event) => setItems(event.target.value)}
                            >
                                <option value="">All Items</option>
                                {itemOptions.map((option) => (
                                    <option key={option} value={option}>
                                        {option}
                                    </option>
                                ))}
                            </select>
                        </label>
                    </div>

                    <div className="mt-5 flex flex-wrap gap-3">
                        <button
                            type="button"
                            onClick={() => load()}
                            disabled={loading}
                            className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-3 text-sm font-bold text-white hover:bg-blue-700 disabled:opacity-60"
                        >
                            <Search size={16} />
                            {loading ? "Applying..." : "Apply Filters"}
                        </button>

                        <button
                            type="button"
                            onClick={() => {
                                setType("SALES_ORDER");
                                setEntity("");
                                setTransactionNumber("");
                                setItems("");
                                setSearch("");
                                setSelected({});
                                setError("");

                                setTimeout(() => {
                                    loadRef.current?.();
                                }, 0);
                            }}
                            className="rounded-xl border border-slate-200 bg-white px-5 py-3 text-sm font-bold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200 dark:hover:bg-slate-800"
                        >
                            Clear Filters
                        </button>
                    </div>
                </section>

                {/* MAIN TABLE */}
                <section className="rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
                    <div className="flex flex-col gap-4 border-b border-slate-200 p-5 dark:border-slate-800 lg:flex-row lg:items-center lg:justify-between sm:p-6">
                        <div>
                            <h2 className="text-xl font-extrabold text-slate-950 dark:text-white">
                                Pending{" "}
                                {type === "SALES_INVOICE"
                                    ? "Sales Invoice"
                                    : "Sales Order"}{" "}
                                Lines
                            </h2>
                            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                                Select lines from the same transaction for each
                                delivery challan.
                            </p>
                        </div>

                        <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:flex-wrap">
                            <div className="relative min-w-0">
                                <Search
                                    size={17}
                                    className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
                                />
                                <input
                                    className={`${inputClass} pl-10 sm:w-64`}
                                    value={search}
                                    onChange={(event) =>
                                        setSearch(event.target.value)
                                    }
                                    placeholder="Search displayed rows..."
                                    aria-label="Search displayed rows"
                                />
                            </div>

                            {/* COLUMN DROPDOWN */}
                            <div
                                className="relative z-30"
                                ref={columnsRef}
                            >
                                <button
                                    type="button"
                                    onClick={() =>
                                        setColumnsOpen((previous) => !previous)
                                    }
                                    aria-expanded={columnsOpen}
                                    className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200 dark:hover:bg-slate-800 sm:w-auto"
                                >
                                    <Columns3 size={17} />
                                    Columns

                                    <span className="rounded-md bg-blue-100 px-2 py-0.5 text-xs text-blue-700 dark:bg-blue-900 dark:text-blue-200">
                                        {visibleColumnCount}/{TABLE_COLUMNS.length}
                                    </span>

                                    <ChevronDown
                                        size={16}
                                        className={`transition ${
                                            columnsOpen ? "rotate-180" : ""
                                        }`}
                                    />
                                </button>

                                {columnsOpen && (
                                    <div className="absolute right-0 top-full z-[100] mt-2 w-72 max-w-[calc(100vw-2rem)] rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-900">
                                        <div className="flex items-center justify-between border-b border-slate-200 p-3 dark:border-slate-700">
                                            <div>
                                                <p className="text-sm font-bold text-slate-900 dark:text-white">
                                                    Table Columns
                                                </p>
                                                <p className="text-xs text-slate-500 dark:text-slate-400">
                                                    Choose visible columns
                                                </p>
                                            </div>

                                            <button
                                                type="button"
                                                onClick={() =>
                                                    setColumnsOpen(false)
                                                }
                                                className="rounded-lg px-2 py-1 text-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
                                                aria-label="Close columns menu"
                                            >
                                                ×
                                            </button>
                                        </div>

                                        <div className="border-b border-slate-200 p-3 dark:border-slate-700">
                                            <button
                                                type="button"
                                                onClick={showAllColumns}
                                                className="w-full rounded-lg bg-blue-600 px-3 py-2.5 text-xs font-bold text-white hover:bg-blue-700"
                                            >
                                                Show All Columns
                                            </button>
                                        </div>

                                        <div className="max-h-72 space-y-1 overflow-y-auto overscroll-contain p-3">
                                            {TABLE_COLUMNS.map((column) => (
                                                <label
                                                    key={column.key}
                                                    className="flex cursor-pointer items-center gap-3 rounded-lg px-2 py-2.5 text-sm text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800"
                                                >
                                                    <input
                                                        type="checkbox"
                                                        checked={Boolean(
                                                            visibleColumns[column.key]
                                                        )}
                                                        onChange={() =>
                                                            toggleColumn(column.key)
                                                        }
                                                        className="h-4 w-4 shrink-0 accent-blue-600"
                                                    />

                                                    <span className="min-w-0 flex-1">
                                                        {column.label}
                                                    </span>

                                                    {visibleColumns[column.key] ? (
                                                        <Eye
                                                            size={15}
                                                            className="shrink-0 text-emerald-600"
                                                        />
                                                    ) : (
                                                        <EyeOff
                                                            size={15}
                                                            className="shrink-0 text-slate-400"
                                                        />
                                                    )}
                                                </label>
                                            ))}
                                        </div>

                                        <div className="border-t border-slate-200 p-3 text-xs text-slate-500 dark:border-slate-700 dark:text-slate-400">
                                            At least one column must remain visible.
                                        </div>
                                    </div>
                                )}
                            </div>

                            {permissions.canCreate && (
                                <button
                                    type="button"
                                    onClick={toggleAll}
                                    disabled={filtered.length === 0 || loading}
                                    className="rounded-xl border border-slate-200 px-4 py-3 text-sm font-bold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                                >
                                    {filtered.length > 0 &&
                                    filtered.every(
                                        (row) => selected[getRowKey(row)]
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
                                Retrieving approved transaction lines.
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
                                Matching approved transaction quantities may
                                already have been delivered, or no records
                                match your filters.
                            </p>
                        </div>
                    ) : (
                        <div className="max-h-[650px] overflow-auto">
                            <table className="w-full min-w-max text-left text-sm">
                                <thead className="sticky top-0 z-10 bg-slate-100 text-xs uppercase tracking-wider text-slate-600 dark:bg-slate-950 dark:text-slate-300">
                                    <tr>
                                        {permissions.canCreate && (
                                            <th className="whitespace-nowrap px-4 py-4">
                                                Select
                                            </th>
                                        )}

                                        {activeColumns.map((column) => (
                                            <th
                                                key={column.key}
                                                className="whitespace-nowrap px-4 py-4"
                                            >
                                                {column.label}
                                            </th>
                                        ))}

                                        {permissions.canCreate && (
                                            <th className="whitespace-nowrap px-4 py-4">
                                                Do Qty.
                                            </th>
                                        )}
                                    </tr>
                                </thead>

                                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                    {filtered.map((row) => {
                                        const key = getRowKey(row);
                                        const isSelected = Boolean(selected[key]);

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

                                                {activeColumns.map((column) => (
                                                    <td
                                                        key={column.key}
                                                        className={`whitespace-nowrap px-4 py-4 ${
                                                            column.key === "order_number"
                                                                ? "font-bold text-blue-700 dark:text-blue-400"
                                                                : column.key === "customer_name"
                                                                  ? "font-semibold text-slate-800 dark:text-slate-200"
                                                                  : column.key === "item_name"
                                                                    ? "font-semibold"
                                                                    : column.key === "pending_quantity"
                                                                      ? "font-extrabold text-emerald-700 dark:text-emerald-400"
                                                                      : column.key === "sequence_id"
                                                                        ? "text-slate-500 dark:text-slate-400"
                                                                        : ""
                                                        } ${
                                                            [
                                                                "item_balance",
                                                                "line_quantity",
                                                                "pending_quantity",
                                                            ].includes(column.key)
                                                                ? "text-right tabular-nums"
                                                                : ""
                                                        }`}
                                                    >
                                                        {renderColumnValue(
                                                            row,
                                                            column.key
                                                        )}
                                                    </td>
                                                ))}

                                                {permissions.canCreate && (
                                                    <td className="px-4 py-4">
                                                        <input
                                                            type="number"
                                                            min="0"
                                                            max={row.pending_quantity}
                                                            step="0.001"
                                                            value={
                                                                quantities[key] ?? ""
                                                            }
                                                            onChange={(event) =>
                                                                updateQuantity(
                                                                    row,
                                                                    event.target.value
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
                                className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-5 py-3 text-sm font-bold text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
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
                                    className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-emerald-600 px-6 py-3 text-sm font-bold text-white shadow-lg shadow-blue-600/20 hover:-translate-y-0.5 hover:shadow-xl disabled:cursor-not-allowed disabled:opacity-50"
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
