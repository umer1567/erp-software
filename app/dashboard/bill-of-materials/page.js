
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
    Layers,
    Workflow,
    Filter,
    FileSpreadsheet,
} from "lucide-react";

const PERMISSION_KEY = "bill_of_materials";

const DEFAULT_COLUMNS = {
    report: true,
    edit: true,
    bomId: true,
    bomName: true,
    assemblyItem: true,
    memo: true,
    itemSize: true,
    revisions: true,
    created: true,
    delete: true,
};

// ---------------------------------------------------------
// HELPERS
// ---------------------------------------------------------

function normalizePermissions(data) {
    const permissionList = Array.isArray(data)
        ? data
        : Array.isArray(data?.permissions)
            ? data.permissions
            : Array.isArray(data?.data)
                ? data.data
                : [];

    let source = null;

    // API returns an array of permissions.
    if (permissionList.length > 0) {
        source = permissionList.find(
            (item) =>
                item?.permission_key === PERMISSION_KEY ||
                item?.permissionKey === PERMISSION_KEY
        );
    }

    // API returns a permission object.
    if (!source && data?.permission && !Array.isArray(data.permission)) {
        source = data.permission;
    }

    // API returns permissions as an object keyed by permission name.
    if (!source && data?.permissions && !Array.isArray(data.permissions)) {
        source =
            data.permissions[PERMISSION_KEY] ||
            (
                data.permissions.permission_key === PERMISSION_KEY
                    ? data.permissions
                    : null
            );
    }

    // API returns the permission directly.
    if (!source && (
        data?.permission_key === PERMISSION_KEY ||
        data?.permissionKey === PERMISSION_KEY
    )) {
        source = data;
    }

    // Support a nested data object.
    if (!source && data?.data && !Array.isArray(data.data)) {
        source = normalizePermissions(data.data);
        return source;
    }

    if (!source) {
        return {
            canView: false,
            canCreate: false,
            canUpdate: false,
            canDelete: false,
        };
    }

    return {
        canView: source.canView === true || source.can_view === true,
        canCreate: source.canCreate === true || source.can_create === true,
        canUpdate: source.canUpdate === true || source.can_update === true,
        canDelete: source.canDelete === true || source.can_delete === true,
    };
}

function formatDate(value) {
    if (!value) return "-";

    const date = new Date(value);

    return Number.isNaN(date.getTime())
        ? "-"
        : date.toLocaleDateString();
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
        record.assembly_product_name ||
        record.assembly_sub_product_name ||
        "-"
    );
}

function getAssemblySku(record) {
    return (
        record.assembly_product_sku ||
        record.assembly_sub_product_sku ||
        ""
    );
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
// MAIN PAGE
// ---------------------------------------------------------

export default function BillOfMaterialsHistoryPage() {
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
    // LOAD BOM HISTORY
    // Used by Refresh and Delete actions.
    // ---------------------------------------------------------

    const loadHistory = useCallback(async () => {
        if (!permissions.canView) return;

        setLoading(true);
        setError("");

        try {
            const response = await fetch("/api/bill-of-materials", {
                method: "GET",
                cache: "no-store",
            });

            const data = await response.json();

            if (!response.ok || data.success === false) {
                throw new Error(
                    data.message ||
                    data.error ||
                    "Unable to load BOM history."
                );
            }

            const rows = Array.isArray(data.billOfMaterials)
                ? data.billOfMaterials
                : Array.isArray(data.records)
                    ? data.records
                    : Array.isArray(data.data)
                        ? data.data
                        : Array.isArray(data)
                            ? data
                            : [];

            setRecords(rows);
        } catch (err) {
            setError(err.message || "Unable to load BOM history.");
        } finally {
            setLoading(false);
        }
    }, [permissions.canView]);

    // ---------------------------------------------------------
    // PERMISSION-FIRST INITIALIZATION
    //
    // Permission is checked first.
    // BOM history is fetched only when canView is true.
    // No synchronous setState calls are made in the effect.
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
                    "Unable to verify BOM permissions."
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

            const historyResponse = await fetch(
                "/api/bill-of-materials",
                {
                    method: "GET",
                    cache: "no-store",
                }
            );

            const historyData = await historyResponse.json();

            if (!historyResponse.ok || historyData.success === false) {
                throw new Error(
                    historyData.message ||
                    historyData.error ||
                    "Unable to load BOM history."
                );
            }

            const rows = Array.isArray(historyData.billOfMaterials)
                ? historyData.billOfMaterials
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

            console.error("BOM initialization error:", err);

            setError(
                err.message ||
                "Unable to initialize BOM history."
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
                record.bom_id,
                record.bom_name,
                getAssemblyName(record),
                getAssemblySku(record),
                record.memo,
                record.assembly_item_size,
                record.unit_of_measure,
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
        const revisionCount = records.reduce(
            (total, record) =>
                total + Number(record.revision_count || 0),
            0
        );

        const processCount = records.filter(
            (record) =>
                Number(record.process_count || 0) > 0 ||
                Boolean(record.has_process)
        ).length;

        return {
            total: records.length,
            revisions: revisionCount,
            withProcess: processCount,
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
            "BOM ID",
            "BOM Name",
            "Assembly Item",
            "Assembly SKU",
            "Memo",
            "Item Size",
            "Unit of Measure",
            "Revisions",
            "Created",
        ];

        const rows = filteredRecords.map((record) => [
            record.bom_id,
            record.bom_name,
            getAssemblyName(record),
            getAssemblySku(record),
            record.memo,
            record.assembly_item_size,
            record.unit_of_measure,
            record.revision_count,
            formatDate(record.created_at),
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
        anchor.download = "bill-of-materials.csv";

        document.body.appendChild(anchor);
        anchor.click();
        anchor.remove();

        URL.revokeObjectURL(url);
    }

    // ---------------------------------------------------------
    // PRINT BOM REPORT
    // ---------------------------------------------------------

    function printReport(record) {
        const assemblyName = getAssemblyName(record);
        const assemblySku = getAssemblySku(record);

        const html = `
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="utf-8" />
                <title>BOM Report - ${escapeHtml(record.bom_name)}</title>
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
                        background: #ffffff;
                        padding: 12px;
                        border-radius: 6px;
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
                <h1>Bill of Materials</h1>
                <div class="muted">Golden Lake ERP — BOM Report</div>

                <div class="details">
                    <div class="field">
                        <strong>BOM ID:</strong>
                        ${escapeHtml(record.bom_id)}
                    </div>
                    <div class="field">
                        <strong>BOM Name:</strong>
                        ${escapeHtml(record.bom_name)}
                    </div>
                    <div class="field">
                        <strong>Assembly Item:</strong>
                        ${escapeHtml(assemblyName)}
                    </div>
                    <div class="field">
                        <strong>Item SKU:</strong>
                        ${escapeHtml(assemblySku || "-")}
                    </div>
                    <div class="field">
                        <strong>Item Size:</strong>
                        ${escapeHtml(record.assembly_item_size || "-")}
                    </div>
                    <div class="field">
                        <strong>Unit of Measure:</strong>
                        ${escapeHtml(record.unit_of_measure || "-")}
                    </div>
                    <div class="field">
                        <strong>Created:</strong>
                        ${escapeHtml(formatDate(record.created_at))}
                    </div>
                    <div class="field">
                        <strong>Revisions:</strong>
                        ${escapeHtml(record.revision_count ?? 0)}
                    </div>
                </div>

                <div class="field memo">
                    <strong>Memo:</strong><br />
                    ${escapeHtml(record.memo || "-")}
                </div>

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
    // DELETE BOM
    // ---------------------------------------------------------

    async function deleteBom(record) {
        if (!permissions.canDelete) return;

        const confirmed = window.confirm(
            `Delete BOM "${record.bom_name}" (BOM ID ${record.bom_id})? Its revisions, components, and process steps may also be deleted.`
        );

        if (!confirmed) return;

        setDeletingId(record.bom_id);
        setError("");

        try {
            const response = await fetch(
                `/api/bill-of-materials/${record.bom_id}`,
                {
                    method: "DELETE",
                }
            );

            const data = await response.json();

            if (!response.ok || data.success === false) {
                throw new Error(
                    data.message ||
                    data.error ||
                    "Unable to delete BOM."
                );
            }

            await loadHistory();
        } catch (err) {
            setError(err.message || "Unable to delete BOM.");
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
                    Checking BOM permissions...
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
                        You do not have permission to view Bill of Materials.
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
                        Bill of Materials
                    </h1>

                    <p className="mt-1 text-sm text-slate-500">
                        Manage BOM records, assembly items, revisions, and reports.
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
                            href="/dashboard/bill-of-materials/new"
                            className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-800 shadow-sm transition hover:bg-slate-100"
                        >
                            <Plus size={17} />
                            Create BOM
                        </Link>
                    )}
                </div>
            </div>

            {/* ERROR */}

            {error && (
                <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                    {error}
                </div>
            )}

            {/* SUMMARY CARDS */}

            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <StatCard
                    title="Total BOMs"
                    value={summary.total}
                    description="All registered BOM records"
                    icon={Package}
                />

                <StatCard
                    title="Total Revisions"
                    value={summary.revisions}
                    description="Revisions across all BOMs"
                    icon={Layers}
                />

                <StatCard
                    title="BOMs with Process"
                    value={summary.withProcess}
                    description="BOMs containing process information"
                    icon={Workflow}
                />

                <StatCard
                    title="Filtered Records"
                    value={summary.filtered}
                    description="Records matching your search"
                    icon={Filter}
                />
            </div>

            {/* BOM HISTORY */}

            <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">

                {/* TOOLBAR */}

                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-white p-4">
                    <div>
                        <h2 className="font-bold text-slate-900">
                            BOM History
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
                                placeholder="Search BOM, assembly item..."
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
                                <div className="absolute right-0 z-30 mt-2 w-56 rounded-xl border border-slate-200 bg-white p-3 shadow-xl">
                                    <p className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-500">
                                        Visible Columns
                                    </p>

                                    {Object.entries({
                                        report: "Report",
                                        edit: "Edit",
                                        bomId: "BOM ID",
                                        bomName: "BOM Name",
                                        assemblyItem: "Assembly Item",
                                        memo: "Memo",
                                        itemSize: "Item Size",
                                        revisions: "Revisions",
                                        created: "Created",
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
                            <FileSpreadsheet size={27} />
                        </div>

                        <h3 className="mt-3 font-semibold text-slate-800">
                            No BOM records found
                        </h3>

                        <p className="mt-1 text-sm text-slate-500">
                            Try another search or create a new Bill of Materials.
                        </p>
                    </div>
                ) : (

                    /* TABLE */

                    <div className="overflow-x-auto">
                        <table className="w-full min-w-[1150px] border-collapse text-left text-xs">

                            {/* WHITE TABLE HEADER */}

                            <thead>
                                <tr className="border-b border-slate-200 bg-white text-slate-600">

                                    {columns.report && (
                                        <th className="px-4 py-4 font-bold">
                                            Report
                                        </th>
                                    )}

                                    {columns.edit && (
                                        <th className="px-4 py-4 font-bold">
                                            Edit
                                        </th>
                                    )}

                                    {columns.bomId && (
                                        <th className="px-4 py-4 font-bold">
                                            BOM ID
                                        </th>
                                    )}

                                    {columns.bomName && (
                                        <th className="px-4 py-4 font-bold">
                                            BOM Name
                                        </th>
                                    )}

                                    {columns.assemblyItem && (
                                        <th className="px-4 py-4 font-bold">
                                            Assembly Item
                                        </th>
                                    )}

                                    {columns.memo && (
                                        <th className="px-4 py-4 font-bold">
                                            Memo
                                        </th>
                                    )}

                                    {columns.itemSize && (
                                        <th className="px-4 py-4 font-bold">
                                            Item Size
                                        </th>
                                    )}

                                    {columns.revisions && (
                                        <th className="px-4 py-4 text-center font-bold">
                                            Revisions
                                        </th>
                                    )}

                                    {columns.created && (
                                        <th className="px-4 py-4 font-bold">
                                            Created
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
                                {filteredRecords.map((record) => (
                                    <tr
                                        key={record.bom_id}
                                        className="border-b border-slate-100 bg-white text-slate-700 transition hover:bg-slate-50"
                                    >

                                        {/* REPORT */}

                                        {columns.report && (
                                            <td className="px-4 py-3">
                                                <button
                                                    type="button"
                                                    onClick={() => printReport(record)}
                                                    title="Print BOM Report"
                                                    className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 transition hover:border-slate-400 hover:bg-slate-50 hover:text-slate-900"
                                                >
                                                    <FileText size={16} />
                                                </button>
                                            </td>
                                        )}

                                        {/* EDIT */}

                                        {columns.edit && (
                                            <td className="px-4 py-3">
                                                {permissions.canUpdate ? (
                                                    <Link
                                                        href={`/dashboard/bill-of-materials/${record.bom_id}`}
                                                        title="Edit BOM"
                                                        className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 transition hover:border-slate-400 hover:bg-slate-50 hover:text-slate-900"
                                                    >
                                                        <Pencil size={15} />
                                                    </Link>
                                                ) : (
                                                    <span className="text-slate-300">
                                                        —
                                                    </span>
                                                )}
                                            </td>
                                        )}

                                        {/* BOM ID */}

                                        {columns.bomId && (
                                            <td className="px-4 py-3 font-semibold text-slate-900">
                                                {record.bom_id}
                                            </td>
                                        )}

                                        {/* BOM NAME */}

                                        {columns.bomName && (
                                            <td className="px-4 py-3 font-semibold text-slate-900">
                                                {record.bom_name || "-"}
                                            </td>
                                        )}

                                        {/* ASSEMBLY ITEM */}

                                        {columns.assemblyItem && (
                                            <td className="px-4 py-3">
                                                <div className="font-medium text-slate-800">
                                                    {getAssemblyName(record)}
                                                </div>

                                                {getAssemblySku(record) && (
                                                    <div className="mt-0.5 text-[11px] text-slate-400">
                                                        {getAssemblySku(record)}
                                                    </div>
                                                )}
                                            </td>
                                        )}

                                        {/* MEMO */}

                                        {columns.memo && (
                                            <td className="max-w-[220px] truncate px-4 py-3">
                                                {record.memo || "-"}
                                            </td>
                                        )}

                                        {/* ITEM SIZE */}

                                        {columns.itemSize && (
                                            <td className="px-4 py-3">
                                                {record.assembly_item_size || "-"}
                                            </td>
                                        )}

                                        {/* REVISIONS */}

                                        {columns.revisions && (
                                            <td className="px-4 py-3 text-center">
                                                <span className="inline-flex min-w-8 items-center justify-center rounded-lg border border-slate-200 bg-white px-2.5 py-1 font-semibold text-slate-700">
                                                    {record.revision_count ?? 0}
                                                </span>
                                            </td>
                                        )}

                                        {/* CREATED */}

                                        {columns.created && (
                                            <td className="whitespace-nowrap px-4 py-3 text-slate-500">
                                                {formatDate(record.created_at)}
                                            </td>
                                        )}

                                        {/* DELETE */}

                                        {columns.delete && permissions.canDelete && (
                                            <td className="px-4 py-3 text-center">
                                                <div className="flex justify-center">
                                                    <ActionButton
                                                        danger
                                                        disabled={
                                                            deletingId === record.bom_id
                                                        }
                                                        onClick={() => deleteBom(record)}
                                                        title="Delete BOM"
                                                    >
                                                        {deletingId === record.bom_id ? (
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
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </section>
        </div>
    );
}
