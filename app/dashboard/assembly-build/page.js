
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
    FileText,
    Pencil,
    Trash2,
    RefreshCw,
    Plus,
    Search,
    Download,
    Columns3,
    Package,
    CheckCircle2,
    Clock3,
    Filter,
    FileSpreadsheet,
    Eye,
    Factory,
} from "lucide-react";

const PERMISSION_KEY = "assembly_build";
const API_URL = "/api/assembly-build";

const DEFAULT_COLUMNS = {
    report: true,
    edit: true,
    view: true,
    transactionNumber: true,
    transactionDate: true,
    item: true,
    location: true,
    buildQuantity: true,
    status: true,
    workOrder: true,
    delete: true,
};

// ---------------------------------------------------------
// HELPERS
// ---------------------------------------------------------

function normalizePermissions(data) {
    const permissionList = Array.isArray(data?.permissions)
        ? data.permissions
        : Array.isArray(data)
            ? data
            : [];

    const source =
        data?.permission ||
        permissionList.find(
            (item) => item?.permission_key === PERMISSION_KEY
        ) ||
        (
            data?.permissions &&
            !Array.isArray(data.permissions)
                ? data.permissions
                : null
        ) ||
        (
            data?.permission_key === PERMISSION_KEY
                ? data
                : null
        );

    return {
        canView: Boolean(source?.canView ?? source?.can_view),
        canCreate: Boolean(source?.canCreate ?? source?.can_create),
        canUpdate: Boolean(source?.canUpdate ?? source?.can_update),
        canDelete: Boolean(source?.canDelete ?? source?.can_delete),
    };
}
function formatDate(value) {
    if (!value) return "-";

    const date = new Date(value);

    return Number.isNaN(date.getTime())
        ? "-"
        : date.toLocaleDateString();
}

function formatNumber(value) {
    const number = Number(value ?? 0);

    if (!Number.isFinite(number)) return "0";

    return number.toLocaleString(undefined, {
        maximumFractionDigits: 4,
    });
}

function escapeCsv(value) {
    return `"${String(value ?? "").replace(/"/g, '""')}"`;
}

function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>"']/g, (character) => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
    })[character]);
}

function getAssemblyName(record) {
    return (
        record.assembly_item_name ||
        record.assembly_product_name ||
        record.assembly_sub_product_name ||
        record.item_name ||
        "-"
    );
}

function getLocationName(record) {
    return (
        record.warehouse_name ||
        record.location_name ||
        record.production_location ||
        "-"
    );
}

function getTransactionDate(record) {
    return (
        record.transaction_date ||
        record.build_date ||
        record.created_at
    );
}

function getBuildId(record) {
    return (
        record.assembly_build_id ||
        record.id
    );
}

function getStatusClass(status) {
    switch (String(status || "").toUpperCase()) {
        case "APPROVED":
            return "border-emerald-200 bg-emerald-50 text-emerald-700";

        case "CANCELLED":
            return "border-red-200 bg-red-50 text-red-700";

        case "DRAFT":
        default:
            return "border-amber-200 bg-amber-50 text-amber-700";
    }
}

function getStatusLabel(status) {
    return String(status || "DRAFT").replaceAll("_", " ");
}

// ---------------------------------------------------------
// STAT CARD
// ---------------------------------------------------------

function StatCard({ title, value, description, icon: Icon }) {
    return (
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:shadow-md">
            <div className="flex items-start justify-between gap-3">
                <div>
                    <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                        {title}
                    </p>

                    <p className="mt-2 text-2xl font-bold text-slate-900">
                        {value}
                    </p>

                    <p className="mt-1 text-xs text-slate-500">
                        {description}
                    </p>
                </div>

                <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-slate-600">
                    <Icon size={21} strokeWidth={2} />
                </div>
            </div>
        </div>
    );
}

// ---------------------------------------------------------
// ACTION BUTTON
// ---------------------------------------------------------

function ActionButton({
    children,
    onClick,
    danger = false,
    disabled = false,
    title,
}) {
    return (
        <button
            type="button"
            onClick={onClick}
            disabled={disabled}
            title={title}
            className={`inline-flex h-8 w-8 items-center justify-center rounded-lg border transition disabled:cursor-not-allowed disabled:opacity-40 ${
                danger
                    ? "border-red-200 bg-white text-red-600 hover:border-red-300 hover:bg-red-50"
                    : "border-slate-200 bg-white text-slate-600 hover:border-slate-400 hover:bg-slate-50 hover:text-slate-900"
            }`}
        >
            {children}
        </button>
    );
}

// ---------------------------------------------------------
// STATUS BADGE
// ---------------------------------------------------------

function StatusBadge({ status }) {
    return (
        <span
            className={`inline-flex items-center rounded-lg border px-2.5 py-1 text-[11px] font-bold ${getStatusClass(status)}`}
        >
            {getStatusLabel(status)}
        </span>
    );
}

// ---------------------------------------------------------
// MAIN PAGE
// ---------------------------------------------------------

export default function AssemblyBuildHistoryPage() {
    const [records, setRecords] = useState([]);

    const [permissions, setPermissions] = useState({
        canView: false,
        canCreate: false,
        canUpdate: false,
        canDelete: false,
    });

    const [permissionChecked, setPermissionChecked] = useState(false);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [search, setSearch] = useState("");
    const [showColumns, setShowColumns] = useState(false);
    const [columns, setColumns] = useState(DEFAULT_COLUMNS);
    const [deletingId, setDeletingId] = useState(null);

    // ---------------------------------------------------------
    // LOAD ASSEMBLY BUILD HISTORY
    // ---------------------------------------------------------

    const loadHistory = useCallback(async () => {
        if (!permissions.canView) return;

        setLoading(true);
        setError("");

        try {
            const response = await fetch(API_URL, {
                method: "GET",
                cache: "no-store",
            });

            const data = await response.json();

            if (!response.ok || data.success === false) {
                throw new Error(
                    data.message ||
                    data.error ||
                    "Unable to load Assembly Build history."
                );
            }

            const rows = Array.isArray(data.assemblyBuilds)
                ? data.assemblyBuilds
                : Array.isArray(data.records)
                    ? data.records
                    : Array.isArray(data.data)
                        ? data.data
                        : Array.isArray(data)
                            ? data
                            : [];

            setRecords(rows);
        } catch (err) {
            setError(
                err.message ||
                "Unable to load Assembly Build history."
            );
        } finally {
            setLoading(false);
        }
    }, [permissions.canView]);

    // ---------------------------------------------------------
    // PERMISSION-FIRST INITIALIZATION
    // ---------------------------------------------------------

    useEffect(() => {
    let active = true;

    async function initializePage() {
        try {
            const permissionResponse = await fetch(
                `/api/permissions/current?permissionKey=${encodeURIComponent(PERMISSION_KEY)}`,
                {
                    method: "GET",
                    cache: "no-store",
                }
            );

            const permissionData = await permissionResponse.json();

            if (!permissionResponse.ok) {
                throw new Error(
                    permissionData.message ||
                    permissionData.error ||
                    "Unable to verify Assembly Build permissions."
                );
            }

            const result = normalizePermissions(permissionData);

            if (!active) return;

            setPermissions(result);
            setPermissionChecked(true);

            if (!result.canView) {
                setLoading(false);
                return;
            }

            const historyResponse = await fetch(API_URL, {
                method: "GET",
                cache: "no-store",
            });

            const historyData = await historyResponse.json();

            if (!historyResponse.ok || historyData.success === false) {
                throw new Error(
                    historyData.message ||
                    historyData.error ||
                    "Unable to load Assembly Build history."
                );
            }

            const rows = Array.isArray(historyData.assemblyBuilds)
                ? historyData.assemblyBuilds
                : Array.isArray(historyData.records)
                    ? historyData.records
                    : Array.isArray(historyData.data)
                        ? historyData.data
                        : Array.isArray(historyData)
                            ? historyData
                            : [];

            if (!active) return;

            setRecords(rows);

        } catch (err) {
            if (!active) return;

            console.error("Assembly Build initialization error:", err);

            setError(
                err.message ||
                "Unable to initialize Assembly Build history."
            );

            setPermissionChecked(true);

        } finally {
            if (active) {
                setLoading(false);
            }
        }
    }

    initializePage();

    return () => {
        active = false;
    };
}, []);

    // ---------------------------------------------------------
    // FILTERED RECORDS
    // ---------------------------------------------------------

    const filteredRecords = useMemo(() => {
        const term = search.trim().toLowerCase();

        if (!term) return records;

        return records.filter((record) => {
            const values = [
                getBuildId(record),
                record.transaction_number,
                getAssemblyName(record),
                record.assembly_product_sku,
                record.assembly_sub_product_sku,
                getLocationName(record),
                record.status,
                record.work_order_number,
                record.employee,
                record.machine,
                record.shift,
                record.memo,
                record.customer_name,
            ];

            return values
                .join(" ")
                .toLowerCase()
                .includes(term);
        });
    }, [records, search]);

    // ---------------------------------------------------------
    // SUMMARY
    // ---------------------------------------------------------

    const summary = useMemo(() => {
        const approved = records.filter(
            (record) =>
                String(record.status).toUpperCase() === "APPROVED"
        ).length;

        const drafts = records.filter(
            (record) =>
                String(record.status).toUpperCase() === "DRAFT"
        ).length;

        const cancelled = records.filter(
            (record) =>
                String(record.status).toUpperCase() === "CANCELLED"
        ).length;

        return {
            total: records.length,
            approved,
            drafts,
            cancelled,
            filtered: filteredRecords.length,
        };
    }, [records, filteredRecords]);

    // ---------------------------------------------------------
    // COLUMN VISIBILITY
    // ---------------------------------------------------------

    function toggleColumn(key) {
        setColumns((current) => {
            const visibleCount = Object.values(current).filter(Boolean).length;

            if (current[key] && visibleCount === 1) {
                return current;
            }

            return {
                ...current,
                [key]: !current[key],
            };
        });
    }

    // ---------------------------------------------------------
    // CSV EXPORT
    // ---------------------------------------------------------

    function exportCsv() {
        const headings = [
            "Transaction Number",
            "Transaction Date",
            "Assembly Item",
            "Production Location",
            "Build Quantity",
            "UOM",
            "Status",
            "Work Order Number",
            "Employee",
            "Machine",
            "Shift",
            "Memo",
        ];

        const rows = filteredRecords.map((record) => [
            record.transaction_number,
            formatDate(getTransactionDate(record)),
            getAssemblyName(record),
            getLocationName(record),
            record.build_quantity,
            record.uom,
            record.status,
            record.work_order_number,
            record.employee,
            record.machine,
            record.shift,
            record.memo,
        ]);

        const csv = [
            headings.map(escapeCsv).join(","),
            ...rows.map((row) => row.map(escapeCsv).join(",")),
        ].join("\n");

        const blob = new Blob(["\uFEFF" + csv], {
            type: "text/csv;charset=utf-8;",
        });

        const url = URL.createObjectURL(blob);
        const anchor = document.createElement("a");

        anchor.href = url;
        anchor.download = "assembly-build-history.csv";

        document.body.appendChild(anchor);
        anchor.click();
        anchor.remove();

        URL.revokeObjectURL(url);
    }

    // ---------------------------------------------------------
    // PRINT ASSEMBLY BUILD REPORT
    // ---------------------------------------------------------

    function printReport(record) {
        const assemblyName = getAssemblyName(record);
        const locationName = getLocationName(record);

        const html = `
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="utf-8" />
                <title>Assembly Build Report - ${escapeHtml(record.transaction_number)}</title>

                <style>
                    body {
                        font-family: Arial, sans-serif;
                        color: #334155;
                        background: #ffffff;
                        padding: 28px;
                    }

                    h1 {
                        margin-bottom: 4px;
                        color: #334155;
                    }

                    .muted {
                        color: #64748b;
                        font-size: 12px;
                    }

                    .details {
                        margin: 22px 0;
                        display: grid;
                        grid-template-columns: 1fr 1fr;
                        gap: 12px;
                    }

                    .field {
                        border: 1px solid #e2e8f0;
                        padding: 12px;
                        border-radius: 6px;
                        overflow-wrap: anywhere;
                    }

                    .memo {
                        margin-top: 12px;
                    }

                    @media print {
                        body {
                            padding: 0;
                        }
                    }
                </style>
            </head>

            <body>
                <h1>Assembly Build</h1>
                <div class="muted">
                    Golden Lake ERP — Assembly Build Report
                </div>

                <div class="details">
                    <div class="field">
                        <strong>Transaction Number:</strong><br />
                        ${escapeHtml(record.transaction_number || "-")}
                    </div>

                    <div class="field">
                        <strong>Transaction Date:</strong><br />
                        ${escapeHtml(formatDate(getTransactionDate(record)))}
                    </div>

                    <div class="field">
                        <strong>Assembly Item:</strong><br />
                        ${escapeHtml(assemblyName)}
                    </div>

                    <div class="field">
                        <strong>Production Location:</strong><br />
                        ${escapeHtml(locationName)}
                    </div>

                    <div class="field">
                        <strong>Build Quantity:</strong><br />
                        ${escapeHtml(formatNumber(record.build_quantity))}
                        ${escapeHtml(record.uom || "")}
                    </div>

                    <div class="field">
                        <strong>Status:</strong><br />
                        ${escapeHtml(getStatusLabel(record.status))}
                    </div>

                    <div class="field">
                        <strong>Work Order Number:</strong><br />
                        ${escapeHtml(record.work_order_number || "-")}
                    </div>

                    <div class="field">
                        <strong>Revision:</strong><br />
                        ${escapeHtml(record.revision_name || record.revision_id || "-")}
                    </div>

                    <div class="field">
                        <strong>Employee:</strong><br />
                        ${escapeHtml(record.employee || "-")}
                    </div>

                    <div class="field">
                        <strong>Machine:</strong><br />
                        ${escapeHtml(record.machine || "-")}
                    </div>

                    <div class="field">
                        <strong>Shift:</strong><br />
                        ${escapeHtml(record.shift || "-")}
                    </div>

                    <div class="field">
                        <strong>Customer:</strong><br />
                        ${escapeHtml(record.customer_name || "-")}
                    </div>
                </div>

                <div class="field memo">
                    <strong>Details:</strong><br />
                    ${escapeHtml(record.details || "-")}
                </div>

                <div class="field memo">
                    <strong>Memo:</strong><br />
                    ${escapeHtml(record.memo || "-")}
                </div>

                <p class="muted" style="margin-top:30px;">
                    Developed By Golden Lake
                </p>

                <script>
                    window.onload = () => window.print();
                </script>
            </body>
            </html>
        `;

        const printWindow = window.open(
            "",
            "_blank",
            "width=1000,height=750"
        );

        if (!printWindow) {
            setError(
                "Your browser blocked the report window. Allow pop-ups and try again."
            );
            return;
        }

        printWindow.document.open();
        printWindow.document.write(html);
        printWindow.document.close();
    }

    // ---------------------------------------------------------
    // DELETE ASSEMBLY BUILD
    // ---------------------------------------------------------

    async function deleteBuild(record) {
        if (!permissions.canDelete) return;

        const buildId = getBuildId(record);

        if (!buildId) {
            setError("Invalid Assembly Build ID.");
            return;
        }

        if (String(record.status).toUpperCase() !== "DRAFT") {
            setError(
                "Only DRAFT Assembly Builds can be deleted."
            );
            return;
        }

        const confirmed = window.confirm(
            `Delete Assembly Build "${record.transaction_number || buildId}"?`
        );

        if (!confirmed) return;

        setDeletingId(buildId);
        setError("");

        try {
            const response = await fetch(
                `${API_URL}/${buildId}`,
                {
                    method: "DELETE",
                }
            );

            const data = await response.json();

            if (!response.ok || data.success === false) {
                throw new Error(
                    data.message ||
                    data.error ||
                    "Unable to delete Assembly Build."
                );
            }

            await loadHistory();
        } catch (err) {
            setError(
                err.message ||
                "Unable to delete Assembly Build."
            );
        } finally {
            setDeletingId(null);
        }
    }

    // ---------------------------------------------------------
    // PERMISSION CHECK LOADING
    // ---------------------------------------------------------

    if (!permissionChecked && loading) {
        return (
            <div className="min-h-full bg-white p-5">
                <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500 shadow-sm">
                    Checking Assembly Build permissions...
                </div>
            </div>
        );
    }

    // ---------------------------------------------------------
    // ACCESS DENIED
    // ---------------------------------------------------------

    if (permissionChecked && !permissions.canView) {
        return (
            <div className="min-h-full bg-white p-5">
                <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
                    <h2 className="text-lg font-bold text-slate-900">
                        Access Denied
                    </h2>

                    <p className="mt-2 text-sm text-slate-500">
                        You do not have permission to view Assembly Build.
                    </p>
                </div>
            </div>
        );
    }

    // ---------------------------------------------------------
    // MAIN PAGE
    // ---------------------------------------------------------

    return (
        <div className="min-h-full space-y-5 bg-white p-3 md:p-5">

            {/* PAGE HEADER */}

            <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900">
                        Assembly Build
                    </h1>

                    <p className="mt-1 text-sm text-slate-500">
                        Manage production builds, component consumption, finished assemblies, and by-products.
                    </p>
                </div>

                <div className="flex flex-wrap gap-2">
                    <button
                        type="button"
                        onClick={loadHistory}
                        disabled={loading}
                        className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-slate-400 hover:bg-slate-50 disabled:opacity-50"
                    >
                        <RefreshCw
                            size={16}
                            className={loading ? "animate-spin" : ""}
                        />

                        {loading ? "Refreshing..." : "Refresh"}
                    </button>

                    {permissions.canCreate && (
                        <Link
                            href="/dashboard/assembly-build/new"
                            className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-800 shadow-sm transition hover:bg-slate-100"
                        >
                            <Plus size={17} />
                            Create Assembly Build
                        </Link>
                    )}
                </div>
            </div>

            {/* ERROR */}

            {error && (
                <div className="flex items-start justify-between gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                    <span>{error}</span>

                    <button
                        type="button"
                        onClick={() => setError("")}
                        className="font-bold text-red-700 hover:text-red-900"
                    >
                        ×
                    </button>
                </div>
            )}

            {/* SUMMARY CARDS */}

            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <StatCard
                    title="Total Builds"
                    value={summary.total}
                    description="All registered Assembly Builds"
                    icon={Package}
                />

                <StatCard
                    title="Approved Builds"
                    value={summary.approved}
                    description="Successfully posted production builds"
                    icon={CheckCircle2}
                />

                <StatCard
                    title="Draft Builds"
                    value={summary.drafts}
                    description="Builds awaiting approval"
                    icon={Clock3}
                />

                <StatCard
                    title="Filtered Records"
                    value={summary.filtered}
                    description="Records matching your search"
                    icon={Filter}
                />
            </div>

            {/* ASSEMBLY BUILD HISTORY */}

            <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">

                {/* TOOLBAR */}

                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-white p-4">
                    <div>
                        <h2 className="font-bold text-slate-900">
                            Assembly Build History
                        </h2>

                        <p className="mt-1 text-xs text-slate-500">
                            {filteredRecords.length} record(s) found
                        </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">

                        {/* SEARCH */}

                        <div className="relative w-full sm:w-64">
                            <Search
                                size={16}
                                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                            />

                            <input
                                type="search"
                                value={search}
                                onChange={(event) =>
                                    setSearch(event.target.value)
                                }
                                placeholder="Search transaction, item..."
                                className="w-full rounded-xl border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm text-slate-700 outline-none transition placeholder:text-slate-400 focus:border-slate-400 focus:ring-2 focus:ring-slate-200"
                            />
                        </div>

                        {/* COLUMN SELECTOR */}

                        <div className="relative">
                            <button
                                type="button"
                                onClick={() =>
                                    setShowColumns((value) => !value)
                                }
                                className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-400 hover:bg-slate-50"
                            >
                                <Columns3 size={16} />
                                Columns
                            </button>

                            {showColumns && (
                                <div className="absolute right-0 z-30 mt-2 w-60 rounded-xl border border-slate-200 bg-white p-3 shadow-xl">
                                    <p className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-500">
                                        Visible Columns
                                    </p>

                                    {Object.entries({
                                        report: "Report",
                                        edit: "Edit",
                                        view: "View",
                                        transactionNumber: "Transaction Number",
                                        transactionDate: "Transaction Date",
                                        item: "Item",
                                        location: "Location",
                                        buildQuantity: "Build Quantity",
                                        status: "Status",
                                        workOrder: "Work Order No.",
                                        delete: "Delete",
                                    }).map(([key, label]) => (
                                        <label
                                            key={key}
                                            className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
                                        >
                                            <input
                                                type="checkbox"
                                                checked={columns[key]}
                                                onChange={() => toggleColumn(key)}
                                                className="accent-slate-700"
                                            />

                                            {label}
                                        </label>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* CSV EXPORT */}

                        <button
                            type="button"
                            onClick={exportCsv}
                            disabled={!filteredRecords.length}
                            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-400 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                        >
                            <Download size={16} />
                            Export CSV
                        </button>
                    </div>
                </div>

                {/* TABLE LOADING */}

                {loading ? (
                    <div className="space-y-3 p-5">
                        {[1, 2, 3, 4].map((item) => (
                            <div
                                key={item}
                                className="h-12 animate-pulse rounded-lg bg-slate-100"
                            />
                        ))}
                    </div>
                ) : filteredRecords.length === 0 ? (
                    <div className="p-12 text-center">
                        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-slate-200 bg-slate-50 text-slate-400">
                            <Factory size={27} />
                        </div>

                        <h3 className="mt-3 font-semibold text-slate-800">
                            No Assembly Build records found
                        </h3>

                        <p className="mt-1 text-sm text-slate-500">
                            Try another search or create a new Assembly Build.
                        </p>

                        {permissions.canCreate && (
                            <Link
                                href="/dashboard/assembly-build/new"
                                className="mt-4 inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-800 transition hover:bg-slate-100"
                            >
                                <Plus size={16} />
                                Create Assembly Build
                            </Link>
                        )}
                    </div>
                ) : (

                    /* TABLE */

                    <div className="overflow-x-auto">
                        <table className="w-full min-w-[1250px] border-collapse text-left text-xs">

                            {/* TABLE HEADER */}

                            <thead>
                                <tr className="border-b border-slate-200 bg-white text-slate-600">

                                    {columns.report && (
                                        <th className="px-4 py-4 font-bold">
                                            Report
                                        </th>
                                    )}

                                    {columns.edit && permissions.canUpdate && (
                                        <th className="px-4 py-4 font-bold">
                                            Edit
                                        </th>
                                    )}

                                    {columns.view && (
                                        <th className="px-4 py-4 font-bold">
                                            View
                                        </th>
                                    )}

                                    {columns.transactionNumber && (
                                        <th className="px-4 py-4 font-bold">
                                            Transaction Number
                                        </th>
                                    )}

                                    {columns.transactionDate && (
                                        <th className="px-4 py-4 font-bold">
                                            Trandate
                                        </th>
                                    )}

                                    {columns.item && (
                                        <th className="px-4 py-4 font-bold">
                                            Item
                                        </th>
                                    )}

                                    {columns.location && (
                                        <th className="px-4 py-4 font-bold">
                                            Location
                                        </th>
                                    )}

                                    {columns.buildQuantity && (
                                        <th className="px-4 py-4 text-right font-bold">
                                            Build Quantity
                                        </th>
                                    )}

                                    {columns.status && (
                                        <th className="px-4 py-4 font-bold">
                                            Status
                                        </th>
                                    )}

                                    {columns.workOrder && (
                                        <th className="px-4 py-4 font-bold">
                                            Work Order No.
                                        </th>
                                    )}

                                    {columns.delete && permissions.canDelete && (
                                        <th className="px-4 py-4 text-center font-bold">
                                            Delete
                                        </th>
                                    )}
                                </tr>
                            </thead>

                            {/* TABLE BODY */}

                            <tbody>
                                {filteredRecords.map((record) => {
                                    const buildId = getBuildId(record);

                                    const isDraft =
                                        String(record.status).toUpperCase() === "DRAFT";

                                    return (
                                        <tr
                                            key={buildId}
                                            className="border-b border-slate-100 bg-white text-slate-700 transition hover:bg-slate-50"
                                        >

                                            {/* REPORT */}

                                            {columns.report && (
                                                <td className="px-4 py-3">
                                                    <ActionButton
                                                        onClick={() => printReport(record)}
                                                        title="Print Assembly Build Report"
                                                    >
                                                        <FileText size={16} />
                                                    </ActionButton>
                                                </td>
                                            )}

                                            {/* EDIT */}

                                            {columns.edit && permissions.canUpdate && (
                                                <td className="px-4 py-3">
                                                    {isDraft ? (
                                                        <Link
                                                            href={`/dashboard/assembly-build/${buildId}`}
                                                            title="Edit Assembly Build"
                                                            className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 transition hover:border-slate-400 hover:bg-slate-50 hover:text-slate-900"
                                                        >
                                                            <Pencil size={15} />
                                                        </Link>
                                                    ) : (
                                                        <span
                                                            className="text-slate-300"
                                                            title="Only draft builds can be edited"
                                                        >
                                                            —
                                                        </span>
                                                    )}
                                                </td>
                                            )}

                                            {/* VIEW */}

                                            {columns.view && (
                                                <td className="px-4 py-3">
                                                    <Link
                                                        href={`/dashboard/assembly-build/${buildId}?mode=view`}
                                                        title="View Assembly Build"
                                                        className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 transition hover:border-slate-400 hover:bg-slate-50 hover:text-slate-900"
                                                    >
                                                        <Eye size={15} />
                                                    </Link>
                                                </td>
                                            )}

                                            {/* TRANSACTION NUMBER */}

                                            {columns.transactionNumber && (
                                                <td className="px-4 py-3 font-semibold text-slate-900">
                                                    {record.transaction_number || "-"}
                                                </td>
                                            )}

                                            {/* DATE */}

                                            {columns.transactionDate && (
                                                <td className="whitespace-nowrap px-4 py-3 text-slate-500">
                                                    {formatDate(getTransactionDate(record))}
                                                </td>
                                            )}

                                            {/* ITEM */}

                                            {columns.item && (
                                                <td className="px-4 py-3">
                                                    <div className="font-medium text-slate-800">
                                                        {getAssemblyName(record)}
                                                    </div>

                                                    {(record.assembly_product_sku ||
                                                        record.assembly_sub_product_sku) && (
                                                        <div className="mt-0.5 text-[11px] text-slate-400">
                                                            {record.assembly_product_sku ||
                                                                record.assembly_sub_product_sku}
                                                        </div>
                                                    )}
                                                </td>
                                            )}

                                            {/* LOCATION */}

                                            {columns.location && (
                                                <td className="px-4 py-3">
                                                    {getLocationName(record)}
                                                </td>
                                            )}

                                            {/* BUILD QUANTITY */}

                                            {columns.buildQuantity && (
                                                <td className="px-4 py-3 text-right font-semibold text-slate-800">
                                                    {formatNumber(record.build_quantity)}
                                                    {record.uom && (
                                                        <span className="ml-1 font-normal text-slate-400">
                                                            {record.uom}
                                                        </span>
                                                    )}
                                                </td>
                                            )}

                                            {/* STATUS */}

                                            {columns.status && (
                                                <td className="px-4 py-3">
                                                    <StatusBadge status={record.status} />
                                                </td>
                                            )}

                                            {/* WORK ORDER */}

                                            {columns.workOrder && (
                                                <td className="px-4 py-3">
                                                    {record.work_order_number || "-"}
                                                </td>
                                            )}

                                            {/* DELETE */}

                                            {columns.delete && permissions.canDelete && (
                                                <td className="px-4 py-3 text-center">
                                                    <div className="flex justify-center">
                                                        <ActionButton
                                                            danger
                                                            disabled={
                                                                deletingId === buildId ||
                                                                !isDraft
                                                            }
                                                            onClick={() => deleteBuild(record)}
                                                            title={
                                                                isDraft
                                                                    ? "Delete Assembly Build"
                                                                    : "Only draft builds can be deleted"
                                                            }
                                                        >
                                                            {deletingId === buildId ? (
                                                                <RefreshCw
                                                                    size={15}
                                                                    className="animate-spin"
                                                                />
                                                            ) : (
                                                                <Trash2 size={15} />
                                                            )}
                                                        </ActionButton>
                                                    </div>
                                                </td>
                                            )}
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </section>

            {/* FOOTER */}

            <div className="border-t border-slate-200 pt-4 text-center text-xs text-slate-400">
                Developed By Golden Lake
            </div>
        </div>
    );
}
