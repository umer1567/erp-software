
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
    ArrowLeft,
    Save,
    RefreshCw,
    CheckCircle2,
    AlertCircle,
    Package,
    Factory,
    Warehouse,
    CalendarDays,
    ClipboardList,
    Pencil,
    X,
    ShieldCheck,
    Layers,
} from "lucide-react";

const API_URL = "/api/assembly-unbuild";
const PERMISSION_KEY = "assembly_unbuild";
const EPSILON = 1e-9;

const EMPTY_PERMISSIONS = {
    canView: false,
    canUpdate: false,
};

function numberValue(value, fallback = 0) {
    const number = Number(value);
    return Number.isFinite(number) ? number : fallback;
}

function formatQuantity(value) {
    return numberValue(value).toLocaleString(undefined, {
        maximumFractionDigits: 6,
    });
}

function formatAmount(value) {
    return numberValue(value).toLocaleString(undefined, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    });
}

function formatDate(value) {
    if (!value) return "—";

    const datePart = String(value).slice(0, 10);
    const parts = datePart.split("-");

    if (parts.length === 3) {
        return `${parts[2]}-${parts[1]}-${parts[0]}`;
    }

    return datePart;
}

function getPermission(payload) {
    if (payload?.permission) return payload.permission;

    if (payload?.data && !Array.isArray(payload.data)) {
        return payload.data;
    }

    if (Array.isArray(payload?.permissions)) {
        return payload.permissions.find(
            (item) =>
                item.permission_key === PERMISSION_KEY ||
                item.permissionKey === PERMISSION_KEY
        );
    }

    return payload;
}

function getRecord(payload) {
    return (
        payload?.data?.assemblyUnbuild ||
        payload?.data?.unbuild ||
        payload?.data?.record ||
        payload?.assemblyUnbuild ||
        payload?.unbuild ||
        payload?.record ||
        payload?.data ||
        null
    );
}

function getComponents(record, payload) {
    if (Array.isArray(record?.components)) {
        return record.components;
    }

    if (Array.isArray(record?.items)) {
        return record.items;
    }

    if (Array.isArray(payload?.components)) {
        return payload.components;
    }

    if (Array.isArray(payload?.data?.components)) {
        return payload.data.components;
    }

    return [];
}

function getStatusStyle(status) {
    switch (String(status || "DRAFT").toUpperCase()) {
        case "APPROVED":
        case "POSTED":
            return "border-green-200 bg-green-100 text-green-700";

        case "REJECTED":
        case "CANCELLED":
            return "border-red-200 bg-red-100 text-red-700";

        default:
            return "border-amber-200 bg-amber-100 text-amber-700";
    }
}

export default function AssemblyUnbuildDetailPage() {
    const params = useParams();
    const router = useRouter();

    const unbuildId = params?.id;

    const [permissions, setPermissions] = useState(EMPTY_PERMISSIONS);
    const [permissionLoading, setPermissionLoading] = useState(true);

    const [record, setRecord] = useState(null);
    const [components, setComponents] = useState([]);

    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [saving, setSaving] = useState(false);
    const [approving, setApproving] = useState(false);

    const [editing, setEditing] = useState(false);
    const [error, setError] = useState("");
    const [success, setSuccess] = useState("");

    const [form, setForm] = useState({
        transactionDate: "",
        unbuildQuantity: "",
        memo: "",
        details: "",
    });

    const status = String(record?.status || "DRAFT").toUpperCase();
    const isDraft = status === "DRAFT" && !record?.posted_at;
    const canEdit = permissions.canUpdate && isDraft;

    const loadPermissions = useCallback(async () => {
        setPermissionLoading(true);

        try {
            const response = await fetch(
                `/api/permissions/current?permissionKey=${PERMISSION_KEY}`,
                { cache: "no-store" }
            );

            const payload = await response.json();

            if (!response.ok) {
                throw new Error(
                    payload.message || "Unable to load permissions."
                );
            }

            const permission = getPermission(payload);

            const nextPermissions = {
                canView: Boolean(
                    permission?.can_view ??
                    permission?.canView ??
                    false
                ),
                canUpdate: Boolean(
                    permission?.can_update ??
                    permission?.canUpdate ??
                    false
                ),
            };

            setPermissions(nextPermissions);
            return nextPermissions.canView;
        } catch (err) {
            console.error("ASSEMBLY UNBUILD PERMISSION ERROR:", err);
            setPermissions(EMPTY_PERMISSIONS);
            setError(err.message || "Unable to verify permissions.");
            return false;
        } finally {
            setPermissionLoading(false);
        }
    }, []);

    const loadRecord = useCallback(async (showRefresh = false) => {
        if (!unbuildId) return;

        if (showRefresh) {
            setRefreshing(true);
        } else {
            setLoading(true);
        }

        setError("");
        setSuccess("");

        try {
            const response = await fetch(
                `${API_URL}/${encodeURIComponent(unbuildId)}`,
                { cache: "no-store" }
            );

            const payload = await response.json();

            if (!response.ok) {
                throw new Error(
                    payload.message ||
                    "Unable to load Assembly Unbuild transaction."
                );
            }

            const header = getRecord(payload);

            if (!header) {
                throw new Error(
                    "Assembly Unbuild transaction was not returned by the API."
                );
            }

            const lines = getComponents(header, payload);

            setRecord(header);
            setComponents(lines);

            setForm({
                transactionDate: String(
                    header.transaction_date ||
                    header.transactionDate ||
                    ""
                ).slice(0, 10),

                unbuildQuantity: String(
                    header.unbuild_quantity ??
                    header.unbuildQuantity ??
                    ""
                ),

                memo: header.memo || "",
                details: header.details || "",
            });

            setEditing(false);
        } catch (err) {
            console.error("ASSEMBLY UNBUILD DETAIL ERROR:", err);
            setError(
                err.message || "Failed to load transaction."
            );
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [unbuildId]);

    useEffect(() => {
        let mounted = true;

        async function initialize() {
            const canView = await loadPermissions();

            if (!mounted) return;

            if (canView) {
                await loadRecord();
            } else {
                setLoading(false);
            }
        }

        initialize();

        return () => {
            mounted = false;
        };
    }, [loadPermissions, loadRecord]);

    const updateForm = (field, value) => {
        setForm((previous) => ({
            ...previous,
            [field]: value,
        }));
    };

    const handleSave = async (event) => {
        event.preventDefault();

        if (!canEdit) {
            setError("This transaction cannot be edited.");
            return;
        }

        const quantity = numberValue(form.unbuildQuantity);

        if (!form.transactionDate) {
            setError("Transaction date is required.");
            return;
        }

        if (quantity <= 0) {
            setError("Unbuild quantity must be greater than zero.");
            return;
        }

        setSaving(true);
        setError("");
        setSuccess("");

        try {
            const response = await fetch(
                `${API_URL}/${encodeURIComponent(unbuildId)}`,
                {
                    method: "PATCH",
                    headers: {
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({
                        transactionDate: form.transactionDate,
                        unbuildQuantity: quantity,
                        memo: form.memo.trim(),
                        details: form.details.trim(),
                    }),
                }
            );

            const payload = await response.json();

            if (!response.ok) {
                throw new Error(
                    payload.message ||
                    "Unable to update Assembly Unbuild."
                );
            }

            setSuccess(
                payload.message ||
                "Assembly Unbuild draft updated successfully."
            );

            await loadRecord(true);
        } catch (err) {
            console.error("ASSEMBLY UNBUILD UPDATE ERROR:", err);
            setError(err.message || "Failed to update transaction.");
        } finally {
            setSaving(false);
        }
    };

    const handleApprove = async () => {
        if (!canEdit) {
            setError("You do not have permission to approve this transaction.");
            return;
        }

        const confirmed = window.confirm(
            "Approve this Assembly Unbuild?\n\n" +
            "The finished assembly quantity will be deducted from the selected warehouse, " +
            "and the saved BOM component quantities will be returned to inventory.\n\n" +
            "This action cannot be reversed by editing the draft."
        );

        if (!confirmed) return;

        setApproving(true);
        setError("");
        setSuccess("");

        try {
            const response = await fetch(
                `${API_URL}/${encodeURIComponent(unbuildId)}/approve`,
                {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                    },
                }
            );

            const payload = await response.json();

            if (!response.ok) {
                throw new Error(
                    payload.message ||
                    "Unable to approve Assembly Unbuild."
                );
            }

            setSuccess(
                payload.message ||
                "Assembly Unbuild approved successfully."
            );

            await loadRecord(true);
            router.refresh();
        } catch (err) {
            console.error("ASSEMBLY UNBUILD APPROVAL ERROR:", err);
            setError(
                err.message || "Failed to approve Assembly Unbuild."
            );
        } finally {
            setApproving(false);
        }
    };

    const componentTotal = useMemo(() => {
        return components.reduce(
            (total, component) =>
                total + numberValue(
                    component.returned_quantity ??
                    component.returnedQuantity
                ),
            0
        );
    }, [components]);

    const componentAmount = useMemo(() => {
        return components.reduce(
            (total, component) =>
                total + numberValue(
                    component.amount
                ),
            0
        );
    }, [components]);

    if (permissionLoading || loading) {
        return (
            <div className="flex min-h-[60vh] items-center justify-center">
                <div className="flex items-center gap-3 text-gray-600">
                    <RefreshCw className="h-5 w-5 animate-spin" />
                    <span className="text-sm font-medium">
                        Loading Assembly Unbuild...
                    </span>
                </div>
            </div>
        );
    }

    if (!permissions.canView) {
        return (
            <div className="mx-auto mt-10 max-w-xl rounded-xl border border-red-200 bg-red-50 p-8 text-center">
                <AlertCircle className="mx-auto mb-3 h-10 w-10 text-red-600" />
                <h2 className="text-lg font-bold text-red-800">
                    Access Denied
                </h2>
                <p className="mt-2 text-sm text-red-700">
                    You do not have permission to view Assembly Unbuild.
                </p>
            </div>
        );
    }

    if (!record) {
        return (
            <div className="space-y-4 p-4 md:p-6">
                <Link
                    href="/dashboard/assembly-unbuild"
                    className="inline-flex items-center gap-2 text-sm font-medium text-gray-600 hover:text-orange-700"
                >
                    <ArrowLeft className="h-4 w-4" />
                    Back to Assembly Unbuild
                </Link>

                <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-sm text-red-700">
                    {error || "Assembly Unbuild transaction could not be loaded."}
                </div>
            </div>
        );
    }

    const transactionNumber =
        record.transaction_number ||
        record.transactionNumber ||
        `AU-${unbuildId}`;

    const assemblyName =
        record.assembly_name ||
        record.assembly_product_name ||
        record.assembly_sub_product_name ||
        "—";

    const bomName =
        record.bom_name ||
        record.bomName ||
        "—";

    const revisionName =
        record.revision_name ||
        record.revision_number ||
        record.revisionName ||
        "—";

    const warehouseName =
        record.warehouse_name ||
        record.warehouseName ||
        "—";

    const unbuildQuantity = numberValue(
        record.unbuild_quantity ??
        record.unbuildQuantity
    );

    return (
        <div className="space-y-6 p-4 md:p-6">
            {/* HEADER */}
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div>
                    <Link
                        href="/dashboard/assembly-unbuild"
                        className="mb-3 inline-flex items-center gap-2 text-sm font-medium text-gray-500 hover:text-orange-700"
                    >
                        <ArrowLeft className="h-4 w-4" />
                        Back to Assembly Unbuild
                    </Link>

                    <div className="flex flex-wrap items-center gap-3">
                        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-orange-100">
                            <Factory className="h-6 w-6 text-orange-700" />
                        </div>

                        <div>
                            <h1 className="text-2xl font-bold text-gray-900">
                                {transactionNumber}
                            </h1>
                            <p className="mt-1 text-sm text-gray-500">
                                Assembly Unbuild transaction
                            </p>
                        </div>

                        <span
                            className={`rounded-full border px-3 py-1 text-xs font-semibold ${getStatusStyle(status)}`}
                        >
                            {status.replaceAll("_", " ")}
                        </span>
                    </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                    <button
                        type="button"
                        onClick={() => loadRecord(true)}
                        disabled={refreshing}
                        className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-60"
                    >
                        <RefreshCw
                            className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`}
                        />
                        Refresh
                    </button>

                    {canEdit && !editing && (
                        <button
                            type="button"
                            onClick={() => {
                                setError("");
                                setEditing(true);
                            }}
                            className="inline-flex items-center gap-2 rounded-lg border border-orange-300 bg-orange-50 px-4 py-2.5 text-sm font-semibold text-orange-700 hover:bg-orange-100"
                        >
                            <Pencil className="h-4 w-4" />
                            Edit Draft
                        </button>
                    )}

                    {canEdit && (
                        <button
                            type="button"
                            onClick={handleApprove}
                            disabled={approving || saving || editing}
                            className="inline-flex items-center gap-2 rounded-lg bg-green-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                            {approving ? (
                                <RefreshCw className="h-4 w-4 animate-spin" />
                            ) : (
                                <ShieldCheck className="h-4 w-4" />
                            )}
                            {approving ? "Approving..." : "Approve"}
                        </button>
                    )}
                </div>
            </div>

            {/* MESSAGES */}
            {error && (
                <div className="flex items-start justify-between gap-3 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
                    <div className="flex items-start gap-2">
                        <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
                        <span>{error}</span>
                    </div>
                    <button
                        type="button"
                        onClick={() => setError("")}
                        className="rounded p-1 hover:bg-red-100"
                        aria-label="Dismiss error"
                    >
                        <X className="h-4 w-4" />
                    </button>
                </div>
            )}

            {success && (
                <div className="flex items-start gap-2 rounded-lg border border-green-200 bg-green-50 p-4 text-sm text-green-700">
                    <CheckCircle2 className="h-5 w-5 shrink-0" />
                    <span>{success}</span>
                </div>
            )}

            {/* SUMMARY */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
                    <div className="flex items-center gap-3">
                        <CalendarDays className="h-5 w-5 text-orange-600" />
                        <span className="text-sm text-gray-500">
                            Transaction Date
                        </span>
                    </div>
                    <p className="mt-3 font-semibold text-gray-900">
                        {formatDate(record.transaction_date)}
                    </p>
                </div>

                <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
                    <div className="flex items-center gap-3">
                        <Package className="h-5 w-5 text-orange-600" />
                        <span className="text-sm text-gray-500">
                            Assembly Quantity
                        </span>
                    </div>
                    <p className="mt-3 font-semibold text-gray-900">
                        {formatQuantity(unbuildQuantity)} {record.uom || ""}
                    </p>
                </div>

                <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
                    <div className="flex items-center gap-3">
                        <Warehouse className="h-5 w-5 text-orange-600" />
                        <span className="text-sm text-gray-500">
                            Warehouse
                        </span>
                    </div>
                    <p className="mt-3 font-semibold text-gray-900">
                        {warehouseName}
                    </p>
                </div>

                <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
                    <div className="flex items-center gap-3">
                        <Layers className="h-5 w-5 text-orange-600" />
                        <span className="text-sm text-gray-500">
                            Components
                        </span>
                    </div>
                    <p className="mt-3 font-semibold text-gray-900">
                        {components.length}
                    </p>
                </div>
            </div>

            {/* EDIT FORM */}
            {editing && canEdit && (
                <form
                    onSubmit={handleSave}
                    className="space-y-5 rounded-xl border border-orange-200 bg-white p-5 shadow-sm"
                >
                    <div className="flex items-center justify-between">
                        <div>
                            <h2 className="font-semibold text-gray-900">
                                Edit Draft
                            </h2>
                            <p className="mt-1 text-xs text-gray-500">
                                Only draft header details can be changed here.
                            </p>
                        </div>

                        <button
                            type="button"
                            onClick={() => {
                                setEditing(false);
                                setForm({
                                    transactionDate: String(
                                        record.transaction_date || ""
                                    ).slice(0, 10),
                                    unbuildQuantity: String(
                                        record.unbuild_quantity ?? ""
                                    ),
                                    memo: record.memo || "",
                                    details: record.details || "",
                                });
                            }}
                            className="rounded-lg p-2 text-gray-500 hover:bg-gray-100"
                            aria-label="Cancel editing"
                        >
                            <X className="h-5 w-5" />
                        </button>
                    </div>

                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                        <div>
                            <label className="mb-1.5 block text-sm font-medium text-gray-700">
                                Transaction Date
                            </label>
                            <input
                                type="date"
                                value={form.transactionDate}
                                onChange={(event) =>
                                    updateForm(
                                        "transactionDate",
                                        event.target.value
                                    )
                                }
                                required
                                className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-100"
                            />
                        </div>

                        <div>
                            <label className="mb-1.5 block text-sm font-medium text-gray-700">
                                Unbuild Quantity
                            </label>
                            <input
                                type="number"
                                min="1"
                                step="any"
                                value={form.unbuildQuantity}
                                onChange={(event) =>
                                    updateForm(
                                        "unbuildQuantity",
                                        event.target.value
                                    )
                                }
                                required
                                className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-100"
                            />
                        </div>

                        <div>
                            <label className="mb-1.5 block text-sm font-medium text-gray-700">
                                Memo
                            </label>
                            <input
                                type="text"
                                value={form.memo}
                                onChange={(event) =>
                                    updateForm("memo", event.target.value)
                                }
                                className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-100"
                            />
                        </div>

                        <div>
                            <label className="mb-1.5 block text-sm font-medium text-gray-700">
                                Details
                            </label>
                            <textarea
                                rows={3}
                                value={form.details}
                                onChange={(event) =>
                                    updateForm("details", event.target.value)
                                }
                                className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-100"
                            />
                        </div>
                    </div>

                    <div className="flex flex-wrap justify-end gap-2">
                        <button
                            type="button"
                            onClick={() => setEditing(false)}
                            className="rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50"
                        >
                            Cancel
                        </button>

                        <button
                            type="submit"
                            disabled={saving}
                            className="inline-flex items-center gap-2 rounded-lg bg-orange-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-orange-700 disabled:opacity-50"
                        >
                            {saving ? (
                                <RefreshCw className="h-4 w-4 animate-spin" />
                            ) : (
                                <Save className="h-4 w-4" />
                            )}
                            {saving ? "Saving..." : "Save Changes"}
                        </button>
                    </div>
                </form>
            )}

            {/* TRANSACTION INFORMATION */}
            <section className="rounded-xl border border-gray-200 bg-white shadow-sm">
                <div className="flex items-center gap-3 border-b border-gray-200 px-5 py-4">
                    <ClipboardList className="h-5 w-5 text-orange-600" />
                    <h2 className="font-semibold text-gray-900">
                        Transaction Information
                    </h2>
                </div>

                <div className="grid grid-cols-1 gap-x-8 gap-y-5 p-5 sm:grid-cols-2 lg:grid-cols-3">
                    <div>
                        <p className="text-xs font-medium uppercase text-gray-500">
                            Transaction Number
                        </p>
                        <p className="mt-1 font-semibold text-gray-900">
                            {transactionNumber}
                        </p>
                    </div>

                    <div>
                        <p className="text-xs font-medium uppercase text-gray-500">
                            Bill of Materials
                        </p>
                        <p className="mt-1 font-semibold text-gray-900">
                            {bomName}
                        </p>
                    </div>

                    <div>
                        <p className="text-xs font-medium uppercase text-gray-500">
                            BOM Revision
                        </p>
                        <p className="mt-1 font-semibold text-gray-900">
                            {revisionName}
                        </p>
                    </div>

                    <div>
                        <p className="text-xs font-medium uppercase text-gray-500">
                            Finished Assembly
                        </p>
                        <p className="mt-1 font-semibold text-gray-900">
                            {assemblyName}
                        </p>
                    </div>

                    <div>
                        <p className="text-xs font-medium uppercase text-gray-500">
                            Warehouse
                        </p>
                        <p className="mt-1 font-semibold text-gray-900">
                            {warehouseName}
                        </p>
                    </div>

                    <div>
                        <p className="text-xs font-medium uppercase text-gray-500">
                            Status
                        </p>
                        <span
                            className={`mt-1 inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${getStatusStyle(status)}`}
                        >
                            {status}
                        </span>
                    </div>

                    <div>
                        <p className="text-xs font-medium uppercase text-gray-500">
                            Created At
                        </p>
                        <p className="mt-1 font-medium text-gray-800">
                            {record.created_at
                                ? new Date(record.created_at).toLocaleString()
                                : "—"}
                        </p>
                    </div>

                    <div>
                        <p className="text-xs font-medium uppercase text-gray-500">
                            Posted At
                        </p>
                        <p className="mt-1 font-medium text-gray-800">
                            {record.posted_at
                                ? new Date(record.posted_at).toLocaleString()
                                : "Not posted"}
                        </p>
                    </div>

                    <div>
                        <p className="text-xs font-medium uppercase text-gray-500">
                            Finished Unit Cost
                        </p>
                        <p className="mt-1 font-medium text-gray-800">
                            {formatAmount(record.finished_unit_cost)}
                        </p>
                    </div>
                </div>

                {(record.memo || record.details) && (
                    <div className="grid grid-cols-1 gap-5 border-t border-gray-100 p-5 md:grid-cols-2">
                        <div>
                            <p className="text-xs font-medium uppercase text-gray-500">
                                Memo
                            </p>
                            <p className="mt-1 whitespace-pre-wrap text-sm text-gray-800">
                                {record.memo || "—"}
                            </p>
                        </div>

                        <div>
                            <p className="text-xs font-medium uppercase text-gray-500">
                                Details
                            </p>
                            <p className="mt-1 whitespace-pre-wrap text-sm text-gray-800">
                                {record.details || "—"}
                            </p>
                        </div>
                    </div>
                )}
            </section>

            {/* SAVED COMPONENT SNAPSHOT */}
            <section className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
                <div className="flex flex-col gap-2 border-b border-gray-200 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-center gap-3">
                        <Layers className="h-5 w-5 text-orange-600" />
                        <div>
                            <h2 className="font-semibold text-gray-900">
                                Saved BOM Component Snapshot
                            </h2>
                            <p className="text-xs text-gray-500">
                                These are the component quantities saved with this transaction.
                            </p>
                        </div>
                    </div>

                    <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-semibold text-gray-700">
                        {components.length} Components
                    </span>
                </div>

                {components.length === 0 ? (
                    <div className="p-10 text-center text-sm text-gray-500">
                        No saved component rows were returned by the API.
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full min-w-[850px] text-left text-sm">
                            <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
                                <tr>
                                    <th className="px-5 py-3 font-semibold">
                                        Component
                                    </th>
                                    <th className="px-5 py-3 font-semibold">
                                        UOM
                                    </th>
                                    <th className="px-5 py-3 text-right font-semibold">
                                        Required Qty
                                    </th>
                                    <th className="px-5 py-3 text-right font-semibold">
                                        Returned Qty
                                    </th>
                                    <th className="px-5 py-3 text-right font-semibold">
                                        Unit Cost
                                    </th>
                                    <th className="px-5 py-3 text-right font-semibold">
                                        Amount
                                    </th>
                                </tr>
                            </thead>

                            <tbody className="divide-y divide-gray-100">
                                {components.map((component, index) => {
                                    const componentId =
                                        component.assembly_unbuild_component_id ||
                                        component.assemblyUnbuildComponentId ||
                                        component.component_id ||
                                        index;

                                    const name =
                                        component.item_description ||
                                        component.itemDescription ||
                                        component.description ||
                                        component.product_name ||
                                        component.sub_product_name ||
                                        "Component";

                                    return (
                                        <tr
                                            key={componentId}
                                            className="hover:bg-gray-50"
                                        >
                                            <td className="px-5 py-4">
                                                <p className="font-medium text-gray-900">
                                                    {name}
                                                </p>
                                                <p className="mt-1 text-xs text-gray-400">
                                                    {component.sub_product_id
                                                        ? `Sub-product #${component.sub_product_id}`
                                                        : component.product_id
                                                            ? `Product #${component.product_id}`
                                                            : ""}
                                                </p>
                                            </td>

                                            <td className="px-5 py-4 text-gray-600">
                                                {component.uom || "—"}
                                            </td>

                                            <td className="px-5 py-4 text-right tabular-nums text-gray-700">
                                                {formatQuantity(
                                                    component.required_quantity ??
                                                    component.requiredQuantity
                                                )}
                                            </td>

                                            <td className="px-5 py-4 text-right font-semibold tabular-nums text-green-700">
                                                +{formatQuantity(
                                                    component.returned_quantity ??
                                                    component.returnedQuantity
                                                )}
                                            </td>

                                            <td className="px-5 py-4 text-right tabular-nums text-gray-700">
                                                {formatAmount(component.unit_cost)}
                                            </td>

                                            <td className="px-5 py-4 text-right tabular-nums text-gray-700">
                                                {formatAmount(component.amount)}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>

                            <tfoot className="border-t border-gray-200 bg-gray-50">
                                <tr>
                                    <td
                                        colSpan={3}
                                        className="px-5 py-4 text-right font-semibold text-gray-700"
                                    >
                                        Total Component Return
                                    </td>
                                    <td className="px-5 py-4 text-right font-bold text-green-700">
                                        +{formatQuantity(componentTotal)}
                                    </td>
                                    <td className="px-5 py-4" />
                                    <td className="px-5 py-4 text-right font-bold text-gray-900">
                                        {formatAmount(componentAmount)}
                                    </td>
                                </tr>
                            </tfoot>
                        </table>
                    </div>
                )}
            </section>

            {/* STOCK POSTING INFORMATION */}
            <section className="rounded-xl border border-blue-200 bg-blue-50 p-5">
                <div className="flex items-start gap-3">
                    <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-blue-700" />

                    <div>
                        <h3 className="font-semibold text-blue-900">
                            Inventory Posting
                        </h3>

                        <p className="mt-1 text-sm leading-6 text-blue-800">
                            When approved, the system deducts{" "}
                            <strong>
                                {formatQuantity(unbuildQuantity)} {record.uom || ""}
                            </strong>{" "}
                            of {assemblyName} from {warehouseName}, then receives
                            the saved component quantities shown above.
                        </p>

                        <p className="mt-2 text-xs leading-5 text-blue-700">
                            Approval is processed in one database transaction.
                            If finished assembly stock is insufficient or any
                            inventory movement fails, all changes are rolled back.
                        </p>
                    </div>
                </div>
            </section>

            {/* BOTTOM ACTIONS */}
            <div className="flex flex-wrap justify-between gap-3">
                <Link
                    href="/dashboard/assembly-unbuild"
                    className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50"
                >
                    <ArrowLeft className="h-4 w-4" />
                    Back to List
                </Link>

                {canEdit && (
                    <button
                        type="button"
                        onClick={handleApprove}
                        disabled={approving || saving || editing}
                        className="inline-flex items-center gap-2 rounded-lg bg-green-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                        {approving ? (
                            <RefreshCw className="h-4 w-4 animate-spin" />
                        ) : (
                            <CheckCircle2 className="h-4 w-4" />
                        )}
                        {approving ? "Approving..." : "Approve Assembly Unbuild"}
                    </button>
                )}
            </div>
        </div>
    );
}
