"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
    ClipboardList,
    RefreshCw,
    Plus,
    Search,
    CheckCircle2,
    AlertCircle,
    LoaderCircle,
    Package,
    CalendarDays,
    MapPin,
    Building2,
    Layers3,
    FileText,
    Check,
    X,
    Users,
    Send,
    FilePlus2,
} from "lucide-react";

const cardClass =
    "rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900";

const buttonPrimary =
    "inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50";

const buttonSecondary =
    "inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700";

const checkboxClass =
    "h-4 w-4 cursor-pointer rounded border-slate-300 text-blue-600 accent-blue-600 focus:ring-2 focus:ring-blue-500 disabled:cursor-not-allowed disabled:opacity-50";

const inputClass =
    "w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-800 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 dark:border-slate-600 dark:bg-slate-800 dark:text-white";

function formatDate(value) {
    if (!value) return "-";

    const datePart = String(value).slice(0, 10);
    const [year, month, day] = datePart.split("-");

    if (!year || !month || !day) return String(value);

    const months = [
        "JAN", "FEB", "MAR", "APR", "MAY", "JUN",
        "JUL", "AUG", "SEP", "OCT", "NOV", "DEC",
    ];

    return `${day}-${months[Number(month) - 1] || month}-${year}`;
}

function getTodayDate() {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const day = String(now.getDate()).padStart(2, "0");

    return `${year}-${month}-${day}`;
}

function formatQuantity(value) {
    const number = Number(value);

    if (!Number.isFinite(number)) return value ?? "-";

    return number.toLocaleString("en-US", {
        maximumFractionDigits: 3,
    });
}

function getItemId(row) {
    const id = Number(row?.seq_id);

    return Number.isSafeInteger(id) && id > 0 ? id : null;
}

export default function RequisitionForProcurementPage() {
    const [rows, setRows] = useState([]);
    const [selectedIds, setSelectedIds] = useState([]);

    // Permissions
    const [canCreate, setCanCreate] = useState(false);
    const [canCreateRFQ, setCanCreateRFQ] = useState(false);
    const [permissionLoading, setPermissionLoading] = useState(true);

    // Page loading
    const [loading, setLoading] = useState(true);
    const [creating, setCreating] = useState(false);
    const [creatingType, setCreatingType] = useState("");

    // Messages and search
    const [error, setError] = useState("");
    const [success, setSuccess] = useState("");
    const [search, setSearch] = useState("");

    // RFQ dialog
    const [showRFQModal, setShowRFQModal] = useState(false);
    const [rfqDate, setRfqDate] = useState(getTodayDate);
    const [rfqStatus, setRfqStatus] = useState("DRAFT");

    // Supplier selection
    const [suppliers, setSuppliers] = useState([]);
    const [selectedSupplierIds, setSelectedSupplierIds] = useState([]);
    const [suppliersLoading, setSuppliersLoading] = useState(false);

    const canSelectItems = canCreate || canCreateRFQ;

    // --------------------------------------------------
    // LOAD APPROVED PURCHASE REQUISITION ITEMS
    // AND USER PERMISSIONS
    // --------------------------------------------------

    const loadRows = useCallback(async (signal) => {
        setLoading(true);
        setPermissionLoading(true);
        setError("");

        try {
            const response = await fetch(
                "/api/procurement-requisitions",
                {
                    method: "GET",
                    cache: "no-store",
                    signal,
                }
            );

            const data = await response.json();

            if (!response.ok) {
                throw new Error(
                    data.message ||
                    "Failed to load requisition items."
                );
            }

            setRows(
                Array.isArray(data.rows) ? data.rows : []
            );

            setCanCreate(
                data.permissions?.canCreate === true
            );

            setCanCreateRFQ(
                data.permissions?.canCreateRFQ === true
            );

            setSelectedIds([]);
        } catch (err) {
            if (err.name !== "AbortError") {
                setCanCreate(false);
                setCanCreateRFQ(false);

                setError(
                    err.message ||
                    "Unable to load Procurement Requisition items."
                );
            }
        } finally {
            if (!signal?.aborted) {
                setLoading(false);
                setPermissionLoading(false);
            }
        }
    }, []);

    // --------------------------------------------------
    // INITIAL PAGE LOAD
    // --------------------------------------------------

    useEffect(() => {
        const controller = new AbortController();

        const startLoading = () => {
            if (!controller.signal.aborted) {
                loadRows(controller.signal);
            }
        };

        queueMicrotask(startLoading);

        return () => {
            controller.abort();
        };
    }, [loadRows]);

    // --------------------------------------------------
    // SEARCH
    // --------------------------------------------------

    const filteredRows = useMemo(() => {
        const value = search.trim().toLowerCase();

        if (!value) return rows;

        return rows.filter((row) => {
            const searchable = [
                row.seq_id,
                row.req_date,
                row.req_number,
                row.item,
                row.item_description,
                row.uom,
                row.quantity_enter,
                row.department,
                row.class_name,
                row.location,
            ]
                .map((item) => String(item ?? ""))
                .join(" ")
                .toLowerCase();

            return searchable.includes(value);
        });
    }, [rows, search]);

    // --------------------------------------------------
    // VISIBLE ITEM IDS
    // --------------------------------------------------

    const visibleIds = useMemo(() => {
        return filteredRows
            .map(getItemId)
            .filter((id) => id !== null);
    }, [filteredRows]);

    const allVisibleSelected =
        visibleIds.length > 0 &&
        visibleIds.every((id) => selectedIds.includes(id));

    const someVisibleSelected =
        visibleIds.some((id) => selectedIds.includes(id));

    // --------------------------------------------------
    // SELECTED QUANTITY
    // --------------------------------------------------

    const totalQuantity = useMemo(() => {
        return selectedIds.reduce((total, id) => {
            const row = rows.find(
                (item) => getItemId(item) === id
            );

            return total + Number(row?.quantity_enter || 0);
        }, 0);
    }, [rows, selectedIds]);

    // --------------------------------------------------
    // SELECT / DESELECT ONE ITEM
    // --------------------------------------------------

    const toggleRow = useCallback((rawId) => {
        if (!canSelectItems || creating) return;

        const id = Number(rawId);

        if (!Number.isSafeInteger(id) || id <= 0) return;

        setSelectedIds((previous) => {
            if (previous.includes(id)) {
                return previous.filter(
                    (selectedId) => selectedId !== id
                );
            }

            return [...previous, id];
        });

        setError("");
        setSuccess("");
    }, [canSelectItems, creating]);

    // --------------------------------------------------
    // SELECT / DESELECT ALL VISIBLE ITEMS
    // --------------------------------------------------

    const toggleAll = useCallback(() => {
        if (!canSelectItems || creating) return;

        setSelectedIds((previous) => {
            const everySelected =
                visibleIds.length > 0 &&
                visibleIds.every((id) => previous.includes(id));

            if (everySelected) {
                return previous.filter(
                    (id) => !visibleIds.includes(id)
                );
            }

            return [
                ...new Set([...previous, ...visibleIds]),
            ];
        });

        setError("");
        setSuccess("");
    }, [visibleIds, canSelectItems, creating]);

    // --------------------------------------------------
    // CREATE PROCUREMENT REQUISITION
    // --------------------------------------------------

    const handleCreate = async () => {
        if (permissionLoading || !canCreate) {
            setError(
                "You do not have permission to create Procurement Requisitions."
            );
            return;
        }

        if (creating) return;

        if (selectedIds.length === 0) {
            setError("Please select at least one item.");
            return;
        }

        const confirmed = window.confirm(
            `Create one Procurement Requisition for ${selectedIds.length} selected item(s)?`
        );

        if (!confirmed) return;

        setCreating(true);
        setCreatingType("procurement");
        setError("");
        setSuccess("");

        try {
            const response = await fetch(
                "/api/procurement-requisitions",
                {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({
                        selectedItemIds: selectedIds,
                    }),
                }
            );

            const data = await response.json();

            if (!response.ok) {
                throw new Error(
                    data.message ||
                    "Failed to create Procurement Requisition."
                );
            }

            const transactionNumber =
                data.procurement?.transactionNumber || "-";

            setSelectedIds([]);

            setSuccess(
                `${data.message || "Procurement Requisition created successfully."} Transaction Number: ${transactionNumber}`
            );

            await loadRows();
        } catch (err) {
            setError(
                err.message ||
                "Unable to create Procurement Requisition."
            );
        } finally {
            setCreating(false);
            setCreatingType("");
        }
    };

    // --------------------------------------------------
    // LOAD SUPPLIERS FOR RFQ
    // --------------------------------------------------

    const loadSuppliers = async () => {
        setSuppliersLoading(true);
        setError("");

        try {
            /*
             * The existing RFQ GET endpoint returns active suppliers.
             * It also requires rfqs:view permission.
             */
            const response = await fetch(
                "/api/rfqs",
                {
                    method: "GET",
                    cache: "no-store",
                }
            );

            const data = await response.json();

            if (!response.ok) {
                throw new Error(
                    data.message ||
                    "Unable to load suppliers. Check your RFQ view permission."
                );
            }

            const supplierRows = Array.isArray(data.suppliers)
                ? data.suppliers
                : [];

            setSuppliers(supplierRows);

            if (supplierRows.length === 0) {
                setSelectedSupplierIds([]);
                setError(
                    "No active suppliers are available. Add or activate a supplier before creating an RFQ."
                );
            }
        } catch (err) {
            setSuppliers([]);
            setSelectedSupplierIds([]);

            setError(
                err.message ||
                "Unable to load suppliers."
            );
        } finally {
            setSuppliersLoading(false);
        }
    };

    // --------------------------------------------------
    // OPEN RFQ DIALOG
    // --------------------------------------------------

    const handleOpenRFQ = async () => {
        if (permissionLoading || !canCreateRFQ) {
            setError(
                "You do not have permission to create RFQs."
            );
            return;
        }

        if (creating) return;

        if (selectedIds.length === 0) {
            setError("Please select at least one item.");
            return;
        }

        setError("");
        setSuccess("");

        setRfqDate(getTodayDate());
        setRfqStatus("DRAFT");
        setSelectedSupplierIds([]);
        setShowRFQModal(true);

        await loadSuppliers();
    };

    // --------------------------------------------------
    // SELECT / DESELECT SUPPLIER
    // --------------------------------------------------

    const toggleSupplier = (supplierId) => {
        const id = Number(supplierId);

        if (!Number.isSafeInteger(id) || id <= 0) return;

        setSelectedSupplierIds((previous) => {
            if (previous.includes(id)) {
                return previous.filter(
                    (selectedId) => selectedId !== id
                );
            }

            return [...previous, id];
        });

        setError("");
    };

    const toggleAllSuppliers = () => {
        if (selectedSupplierIds.length === suppliers.length) {
            setSelectedSupplierIds([]);
        } else {
            setSelectedSupplierIds(
                suppliers
                    .map((supplier) => Number(supplier.supplier_id))
                    .filter(
                        (id) =>
                            Number.isSafeInteger(id) && id > 0
                    )
            );
        }
    };

    // --------------------------------------------------
    // CREATE RFQ
    // --------------------------------------------------

    const handleCreateRFQ = async (event) => {
        event.preventDefault();

        if (!canCreateRFQ) {
            setError("You do not have permission to create RFQs.");
            return;
        }

        if (creating) return;

        if (selectedIds.length === 0) {
            setError("Please select at least one Purchase Requisition item.");
            return;
        }

        if (!rfqDate) {
            setError("Please select an RFQ transaction date.");
            return;
        }

        if (selectedSupplierIds.length === 0) {
            setError("Please select at least one supplier.");
            return;
        }

        const confirmed = window.confirm(
            `Create an RFQ for ${selectedIds.length} selected Purchase Requisition item(s) and ${selectedSupplierIds.length} supplier(s)?`
        );

        if (!confirmed) return;

        setCreating(true);
        setCreatingType("rfq");
        setError("");
        setSuccess("");

        try {
            const response = await fetch(
                "/api/rfqs",
                {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({
                        transactionDate: rfqDate,
                        status: rfqStatus,
                        selectedItems: selectedIds.map((id) => ({
                            sourceType: "PURCHASE_REQUISITION",
                            sourceItemId: id,
                        })),
                        supplierIds: selectedSupplierIds,
                    }),
                }
            );

            const data = await response.json();

            if (!response.ok) {
                throw new Error(
                    data.message ||
                    "Failed to create RFQ."
                );
            }

            const transactionNumber =
                data.rfq?.transactionNumber || "-";

            setSelectedIds([]);
            setShowRFQModal(false);

            setSuccess(
                `${data.message || "RFQ created successfully."} RFQ Number: ${transactionNumber}. The selected items have been removed from this available list.`
            );

            /*
             * Refresh the source list.
             * The API excludes items already linked to RFQs.
             * Original Purchase Requisition records are not deleted.
             */
            await loadRows();
        } catch (err) {
            setError(
                err.message ||
                "Unable to create RFQ."
            );
        } finally {
            setCreating(false);
            setCreatingType("");
        }
    };

    // --------------------------------------------------
    // CLOSE RFQ DIALOG
    // --------------------------------------------------

    const handleCloseRFQ = () => {
        if (creating) return;

        setShowRFQModal(false);
        setError("");
    };

    // --------------------------------------------------
    // REFRESH
    // --------------------------------------------------

    const handleRefresh = () => {
        if (creating) return;

        setError("");
        setSuccess("");
        setSearch("");
        loadRows();
    };

    const selectedCount = selectedIds.length;

    return (
        <div className="min-h-screen space-y-6 bg-slate-50 p-4 text-slate-800 dark:bg-slate-950 dark:text-slate-100 sm:p-6 lg:p-8">

            {/* HEADER */}
            <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
                <div className="flex items-start gap-3">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-400">
                        <ClipboardList size={25} />
                    </div>

                    <div>
                        <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white sm:text-3xl">
                            Requisition for Procurement
                        </h1>

                        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                            Select approved Purchase Requisition items
                            and create a Procurement Requisition or RFQ.
                        </p>
                    </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                    <button
                        type="button"
                        onClick={handleRefresh}
                        disabled={loading || creating}
                        className={buttonSecondary}
                    >
                        <RefreshCw
                            size={16}
                            className={loading ? "animate-spin" : ""}
                        />
                        Refresh
                    </button>

                    {!permissionLoading && canCreate && (
                        <button
                            type="button"
                            onClick={handleCreate}
                            disabled={
                                creating ||
                                loading ||
                                selectedCount === 0
                            }
                            className={buttonPrimary}
                        >
                            {creating && creatingType === "procurement" ? (
                                <LoaderCircle
                                    size={17}
                                    className="animate-spin"
                                />
                            ) : (
                                <Plus size={17} />
                            )}

                            {creating && creatingType === "procurement"
                                ? "Creating..."
                                : "Create Procurement Requisition"}

                            {selectedCount > 0 && (
                                <span className="rounded-lg bg-white/20 px-2 py-0.5 text-xs">
                                    {selectedCount}
                                </span>
                            )}
                        </button>
                    )}

                    {!permissionLoading && canCreateRFQ && (
                        <button
                            type="button"
                            onClick={handleOpenRFQ}
                            disabled={
                                creating ||
                                loading ||
                                selectedCount === 0
                            }
                            className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                            <FilePlus2 size={17} />
                            Create RFQ

                            {selectedCount > 0 && (
                                <span className="rounded-lg bg-white/20 px-2 py-0.5 text-xs">
                                    {selectedCount}
                                </span>
                            )}
                        </button>
                    )}
                </div>
            </div>

            {/* ERROR */}
            {error && (
                <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-300">
                    <AlertCircle
                        size={19}
                        className="mt-0.5 shrink-0"
                    />
                    <span>{error}</span>

                    <button
                        type="button"
                        onClick={() => setError("")}
                        className="ml-auto shrink-0 rounded-lg p-1 hover:bg-red-100 dark:hover:bg-red-900/40"
                        aria-label="Dismiss error"
                    >
                        <X size={16} />
                    </button>
                </div>
            )}

            {/* SUCCESS */}
            {success && (
                <div className="flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/30 dark:text-emerald-300">
                    <CheckCircle2
                        size={19}
                        className="mt-0.5 shrink-0"
                    />
                    <span>{success}</span>

                    <button
                        type="button"
                        onClick={() => setSuccess("")}
                        className="ml-auto shrink-0 rounded-lg p-1 hover:bg-emerald-100 dark:hover:bg-emerald-900/40"
                        aria-label="Dismiss success"
                    >
                        <X size={16} />
                    </button>
                </div>
            )}

            {/* SUMMARY CARDS */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <div className={`${cardClass} p-5`}>
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
                                Available Items
                            </p>
                            <p className="mt-2 text-2xl font-bold tabular-nums">
                                {rows.length}
                            </p>
                        </div>

                        <div className="rounded-xl bg-blue-100 p-3 text-blue-700 dark:bg-blue-500/15 dark:text-blue-400">
                            <Package size={21} />
                        </div>
                    </div>
                </div>

                <div className={`${cardClass} p-5`}>
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
                                Selected Items
                            </p>
                            <p className="mt-2 text-2xl font-bold tabular-nums">
                                {selectedCount}
                            </p>
                        </div>

                        <div className="rounded-xl bg-indigo-100 p-3 text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-400">
                            <Check size={21} />
                        </div>
                    </div>
                </div>

                <div className={`${cardClass} p-5`}>
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
                                Selected Quantity
                            </p>
                            <p className="mt-2 text-2xl font-bold tabular-nums">
                                {formatQuantity(totalQuantity)}
                            </p>
                        </div>

                        <div className="rounded-xl bg-emerald-100 p-3 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400">
                            <Layers3 size={21} />
                        </div>
                    </div>
                </div>
            </div>

            {/* APPROVED REQUISITIONS TABLE */}
            <div className={`${cardClass} overflow-hidden`}>
                <div className="flex flex-col justify-between gap-3 border-b border-slate-200 p-4 dark:border-slate-700 sm:flex-row sm:items-center sm:p-5">
                    <div>
                        <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                            Approved Purchase Requisitions
                        </h2>

                        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                            Only items not previously converted into a Procurement Requisition or RFQ are displayed.
                        </p>
                    </div>

                    <div className="relative w-full sm:max-w-xs">
                        <Search
                            size={17}
                            className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                        />

                        <input
                            type="text"
                            value={search}
                            onChange={(event) =>
                                setSearch(event.target.value)
                            }
                            placeholder="Search requisitions..."
                            className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-10 pr-4 text-sm outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 dark:border-slate-600 dark:bg-slate-800 dark:text-white"
                        />
                    </div>
                </div>

                {/* SELECTION TOOLBAR */}
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-700 dark:bg-slate-800/50">
                    <label className="flex cursor-pointer items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-200">
                        <input
                            type="checkbox"
                            checked={allVisibleSelected}
                            onChange={toggleAll}
                            disabled={
                                !canSelectItems ||
                                permissionLoading ||
                                loading ||
                                creating ||
                                visibleIds.length === 0
                            }
                            className={checkboxClass}
                        />

                        Select all visible items
                    </label>

                    <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                        {selectedCount} selected
                        {someVisibleSelected && !allVisibleSelected
                            ? " (partially selected)"
                            : ""}
                    </span>
                </div>

                {/* TABLE */}
                <div className="overflow-x-auto">
                    <table className="w-full min-w-[1250px] border-collapse text-left text-sm">
                        <thead>
                            <tr className="bg-slate-100 text-xs uppercase tracking-wide text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                                <th className="w-14 px-4 py-4 text-center">
                                    Select
                                </th>
                                <th className="px-4 py-4">Seq. Id</th>
                                <th className="px-4 py-4">Req Date</th>
                                <th className="px-4 py-4">Req Number</th>
                                <th className="px-4 py-4">Item</th>
                                <th className="px-4 py-4">Item Description</th>
                                <th className="px-4 py-4">UOM</th>
                                <th className="px-4 py-4 text-right">
                                    Quantity Enter
                                </th>
                                <th className="px-4 py-4">Department</th>
                                <th className="px-4 py-4">Class</th>
                                <th className="px-4 py-4">Location</th>
                            </tr>
                        </thead>

                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                            {loading ? (
                                <tr>
                                    <td
                                        colSpan={11}
                                        className="px-4 py-16 text-center"
                                    >
                                        <LoaderCircle
                                            size={28}
                                            className="mx-auto animate-spin text-blue-600"
                                        />
                                        <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">
                                            Loading approved requisitions...
                                        </p>
                                    </td>
                                </tr>
                            ) : filteredRows.length === 0 ? (
                                <tr>
                                    <td
                                        colSpan={11}
                                        className="px-4 py-16 text-center"
                                    >
                                        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-400 dark:bg-slate-800">
                                            <ClipboardList size={27} />
                                        </div>

                                        <p className="mt-4 font-semibold text-slate-700 dark:text-slate-200">
                                            No available requisition items
                                        </p>

                                        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                                            Approved items will appear here until they are converted into a Procurement Requisition or RFQ.
                                        </p>
                                    </td>
                                </tr>
                            ) : (
                                filteredRows.map((row, index) => {
                                    const id = getItemId(row);

                                    const checked =
                                        id !== null &&
                                        selectedIds.includes(id);

                                    return (
                                        <tr
                                            key={id ?? `row-${index}`}
                                            className={`transition ${
                                                checked
                                                    ? "bg-blue-50/70 dark:bg-blue-950/20"
                                                    : "hover:bg-slate-50 dark:hover:bg-slate-800/50"
                                            }`}
                                        >
                                            <td className="px-4 py-4 text-center">
                                                <input
                                                    type="checkbox"
                                                    checked={checked}
                                                    onChange={() => {
                                                        if (id !== null) {
                                                            toggleRow(id);
                                                        }
                                                    }}
                                                    disabled={
                                                        !canSelectItems ||
                                                        permissionLoading ||
                                                        id === null ||
                                                        loading ||
                                                        creating
                                                    }
                                                    className={checkboxClass}
                                                    aria-label={`Select requisition item ${row.seq_id}`}
                                                />
                                            </td>

                                            <td className="px-4 py-4 font-semibold tabular-nums text-slate-700 dark:text-slate-200">
                                                {row.seq_id ?? "-"}
                                            </td>

                                            <td className="whitespace-nowrap px-4 py-4 text-slate-600 dark:text-slate-300">
                                                <span className="inline-flex items-center gap-2">
                                                    <CalendarDays
                                                        size={14}
                                                        className="text-slate-400"
                                                    />
                                                    {formatDate(row.req_date)}
                                                </span>
                                            </td>

                                            <td className="px-4 py-4">
                                                <span className="rounded-lg bg-blue-50 px-2.5 py-1.5 font-semibold text-blue-700 dark:bg-blue-500/10 dark:text-blue-300">
                                                    {row.req_number || "-"}
                                                </span>
                                            </td>

                                            <td className="px-4 py-4 font-medium text-slate-800 dark:text-slate-100">
                                                {row.item || "-"}
                                            </td>

                                            <td className="max-w-xs px-4 py-4 text-slate-600 dark:text-slate-300">
                                                <span className="block truncate">
                                                    {row.item_description || "-"}
                                                </span>
                                            </td>

                                            <td className="px-4 py-4">
                                                <span className="rounded-md bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                                                    {row.uom || "-"}
                                                </span>
                                            </td>

                                            <td className="px-4 py-4 text-right font-semibold tabular-nums text-slate-800 dark:text-slate-100">
                                                {formatQuantity(
                                                    row.quantity_enter
                                                )}
                                            </td>

                                            <td className="px-4 py-4 text-slate-600 dark:text-slate-300">
                                                <span className="inline-flex items-center gap-2">
                                                    <Building2
                                                        size={14}
                                                        className="text-slate-400"
                                                    />
                                                    {row.department || "-"}
                                                </span>
                                            </td>

                                            <td className="px-4 py-4 text-slate-600 dark:text-slate-300">
                                                {row.class_name || "-"}
                                            </td>

                                            <td className="px-4 py-4 text-slate-600 dark:text-slate-300">
                                                <span className="inline-flex items-center gap-2">
                                                    <MapPin
                                                        size={14}
                                                        className="text-slate-400"
                                                    />
                                                    {row.location || "-"}
                                                </span>
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>

                {/* TABLE FOOTER */}
                <div className="flex flex-col justify-between gap-3 border-t border-slate-200 bg-slate-50 px-4 py-4 dark:border-slate-700 dark:bg-slate-800/50 sm:flex-row sm:items-center">
                    <p className="text-sm text-slate-500 dark:text-slate-400">
                        Showing{" "}
                        <strong className="text-slate-700 dark:text-slate-200">
                            {filteredRows.length}
                        </strong>{" "}
                        of{" "}
                        <strong className="text-slate-700 dark:text-slate-200">
                            {rows.length}
                        </strong>{" "}
                        available items
                    </p>

                    <div className="flex flex-wrap items-center gap-2">
                        {canCreate && (
                            <button
                                type="button"
                                onClick={handleCreate}
                                disabled={
                                    creating ||
                                    loading ||
                                    selectedCount === 0
                                }
                                className={buttonPrimary}
                            >
                                {creating && creatingType === "procurement" ? (
                                    <LoaderCircle
                                        size={17}
                                        className="animate-spin"
                                    />
                                ) : (
                                    <Plus size={17} />
                                )}

                                {creating && creatingType === "procurement"
                                    ? "Creating..."
                                    : "Create Procurement Requisition"}

                                {selectedCount > 0 &&
                                    ` (${selectedCount})`}
                            </button>
                        )}

                        {canCreateRFQ && (
                            <button
                                type="button"
                                onClick={handleOpenRFQ}
                                disabled={
                                    creating ||
                                    loading ||
                                    selectedCount === 0
                                }
                                className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                                <FilePlus2 size={17} />
                                Create RFQ
                                {selectedCount > 0 &&
                                    ` (${selectedCount})`}
                            </button>
                        )}
                    </div>
                </div>
            </div>

            {/* WORKFLOW INFORMATION */}
            <div className="flex items-start gap-3 rounded-2xl border border-blue-100 bg-blue-50/70 p-4 dark:border-blue-900/50 dark:bg-blue-950/20">
                <FileText
                    size={20}
                    className="mt-0.5 shrink-0 text-blue-600 dark:text-blue-400"
                />

                <div>
                    <p className="text-sm font-semibold text-blue-900 dark:text-blue-200">
                        Procurement workflow
                    </p>

                    <p className="mt-1 text-sm leading-6 text-blue-800/80 dark:text-blue-300/80">
                        Select approved Purchase Requisition items and either create a Procurement Requisition or send them directly to an RFQ. Once converted, those items are removed from this available list. Original Purchase Requisition records are preserved, and no inventory balances are changed by these actions.
                    </p>
                </div>
            </div>

            {/* CREATE RFQ MODAL */}
            {showRFQModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-950/60 p-3 backdrop-blur-sm sm:p-6">
                    <div className="my-auto w-full max-w-2xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-900">

                        {/* MODAL HEADER */}
                        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4 dark:border-slate-700 sm:px-6">
                            <div className="flex items-center gap-3">
                                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400">
                                    <FilePlus2 size={22} />
                                </div>

                                <div>
                                    <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                                        Create Request for Quotation
                                    </h2>

                                    <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">
                                        Create an RFQ from selected Purchase Requisition items.
                                    </p>
                                </div>
                            </div>

                            <button
                                type="button"
                                onClick={handleCloseRFQ}
                                disabled={creating}
                                className="rounded-lg p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-800 disabled:opacity-50 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white"
                                aria-label="Close RFQ dialog"
                            >
                                <X size={20} />
                            </button>
                        </div>

                        {/* MODAL BODY */}
                        <form onSubmit={handleCreateRFQ}>
                            <div className="max-h-[70vh] space-y-5 overflow-y-auto p-5 sm:p-6">

                                {/* SELECTED ITEMS SUMMARY */}
                                <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 dark:border-emerald-900/60 dark:bg-emerald-950/20">
                                    <div className="flex items-center justify-between gap-3">
                                        <div>
                                            <p className="text-sm font-semibold text-emerald-900 dark:text-emerald-200">
                                                Selected Purchase Requisition items
                                            </p>

                                            <p className="mt-1 text-xs text-emerald-800/80 dark:text-emerald-300/80">
                                                These items will be linked directly to the new RFQ.
                                            </p>
                                        </div>

                                        <div className="rounded-xl bg-white px-4 py-2 text-center dark:bg-slate-900">
                                            <p className="text-2xl font-bold tabular-nums text-emerald-700 dark:text-emerald-300">
                                                {selectedCount}
                                            </p>
                                            <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                                                Items
                                            </p>
                                        </div>
                                    </div>
                                </div>

                                {/* DATE AND STATUS */}
                                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                                    <div>
                                        <label className="mb-2 block text-sm font-semibold text-slate-700 dark:text-slate-200">
                                            <span className="inline-flex items-center gap-2">
                                                <CalendarDays size={15} />
                                                Transaction Date
                                            </span>
                                        </label>

                                        <input
                                            type="date"
                                            value={rfqDate}
                                            onChange={(event) =>
                                                setRfqDate(event.target.value)
                                            }
                                            required
                                            disabled={creating}
                                            className={inputClass}
                                        />
                                    </div>

                                    <div>
                                        <label className="mb-2 block text-sm font-semibold text-slate-700 dark:text-slate-200">
                                            RFQ Status
                                        </label>

                                        <select
                                            value={rfqStatus}
                                            onChange={(event) =>
                                                setRfqStatus(event.target.value)
                                            }
                                            disabled={creating}
                                            className={inputClass}
                                        >
                                            {[
    "DRAFT",
    "APPROVED",
    "SENT",
    "PARTIALLY_RECEIVED",
    "RECEIVED",
    "CLOSED",
    "CANCELLED",
].map((value) => (
    <option key={value} value={value}>
        {value}
    </option>
))}
                                        </select>
                                    </div>
                                </div>

                                {/* SUPPLIERS */}
                                <div>
                                    <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                                        <div>
                                            <label className="flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-200">
                                                <Users size={16} />
                                                Select Suppliers
                                                <span className="text-red-500">*</span>
                                            </label>

                                            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                                                Select one or more suppliers to invite for quotation.
                                            </p>
                                        </div>

                                        {suppliers.length > 0 && (
                                            <button
                                                type="button"
                                                onClick={toggleAllSuppliers}
                                                disabled={
                                                    suppliersLoading ||
                                                    creating
                                                }
                                                className="text-xs font-semibold text-blue-600 hover:text-blue-700 disabled:opacity-50 dark:text-blue-400"
                                            >
                                                {selectedSupplierIds.length === suppliers.length
                                                    ? "Deselect All"
                                                    : "Select All"}
                                            </button>
                                        )}
                                    </div>

                                    <div className="overflow-hidden rounded-xl border border-slate-200 dark:border-slate-700">
                                        {suppliersLoading ? (
                                            <div className="flex items-center justify-center gap-2 p-8 text-sm text-slate-500 dark:text-slate-400">
                                                <LoaderCircle
                                                    size={19}
                                                    className="animate-spin text-blue-600"
                                                />
                                                Loading active suppliers...
                                            </div>
                                        ) : suppliers.length === 0 ? (
                                            <div className="p-8 text-center">
                                                <Users
                                                    size={28}
                                                    className="mx-auto text-slate-400"
                                                />

                                                <p className="mt-3 text-sm font-semibold text-slate-700 dark:text-slate-200">
                                                    No active suppliers found
                                                </p>

                                                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                                                    Add or activate suppliers before creating an RFQ.
                                                </p>
                                            </div>
                                        ) : (
                                            <div className="max-h-64 divide-y divide-slate-100 overflow-y-auto dark:divide-slate-800">
                                                {suppliers.map((supplier) => {
                                                    const id = Number(
                                                        supplier.supplier_id
                                                    );

                                                    const checked =
                                                        selectedSupplierIds.includes(id);

                                                    return (
                                                        <label
                                                            key={id}
                                                            className={`flex cursor-pointer items-center gap-3 px-4 py-3 transition ${
                                                                checked
                                                                    ? "bg-blue-50 dark:bg-blue-950/30"
                                                                    : "hover:bg-slate-50 dark:hover:bg-slate-800/60"
                                                            }`}
                                                        >
                                                            <input
                                                                type="checkbox"
                                                                checked={checked}
                                                                onChange={() =>
                                                                    toggleSupplier(id)
                                                                }
                                                                disabled={creating}
                                                                className={checkboxClass}
                                                            />

                                                            <div className="min-w-0 flex-1">
                                                                <p className="truncate text-sm font-semibold text-slate-800 dark:text-slate-100">
                                                                    {supplier.supplier_name || "Unnamed Supplier"}
                                                                </p>

                                                                <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                                                                    {supplier.supplier_code || "No supplier code"}
                                                                    {supplier.phone
                                                                        ? ` • ${supplier.phone}`
                                                                        : ""}
                                                                </p>
                                                            </div>

                                                            {checked && (
                                                                <Check
                                                                    size={17}
                                                                    className="shrink-0 text-blue-600 dark:text-blue-400"
                                                                />
                                                            )}
                                                        </label>
                                                    );
                                                })}
                                            </div>
                                        )}
                                    </div>

                                    <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                                        {selectedSupplierIds.length} supplier(s) selected
                                    </p>
                                </div>

                                {/* RFQ INFORMATION */}
                                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800/50">
                                    <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                                        RFQ creation information
                                    </p>

                                    <ul className="mt-2 space-y-1.5 text-xs leading-5 text-slate-600 dark:text-slate-400">
                                        <li>• The RFQ number will be generated automatically.</li>
                                        <li>• Selected items will retain their original Purchase Requisition linkage.</li>
                                        <li>• Successfully linked items will no longer appear in this selection list.</li>
                                        <li>• Original Purchase Requisition records will not be deleted.</li>
                                    </ul>
                                </div>
                            </div>

                            {/* MODAL FOOTER */}
                            <div className="flex flex-col-reverse justify-end gap-2 border-t border-slate-200 bg-slate-50 px-5 py-4 dark:border-slate-700 dark:bg-slate-800/50 sm:flex-row sm:px-6">
                                <button
                                    type="button"
                                    onClick={handleCloseRFQ}
                                    disabled={creating}
                                    className={buttonSecondary}
                                >
                                    Cancel
                                </button>

                                <button
                                    type="submit"
                                    disabled={
                                        creating ||
                                        suppliersLoading ||
                                        suppliers.length === 0 ||
                                        selectedSupplierIds.length === 0 ||
                                        !rfqDate ||
                                        selectedCount === 0
                                    }
                                    className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
                                >
                                    {creating && creatingType === "rfq" ? (
                                        <LoaderCircle
                                            size={17}
                                            className="animate-spin"
                                        />
                                    ) : (
                                        <Send size={17} />
                                    )}

                                    {creating && creatingType === "rfq"
                                        ? "Creating RFQ..."
                                        : "Create RFQ"}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}