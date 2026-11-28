"use client";

import { useCallback, useEffect, useState } from "react";
import {
    RefreshCw,
    Save,
    Settings2,
    Hash,
    AlertCircle,
    CheckCircle2,
} from "lucide-react";

const DEFAULT_FORMAT = "#PREFIX##NUMBER#";

const TRANSACTION_NAMES = {
    POS: "POS",
    SALES_INVOICE: "Sales Invoice",
    SALES_PAYMENT: "Sales Payment",
    SALES_QUOTATION: "Sales Quotation",
    SALES_ORDER: "Sales Order",
    DELIVERY_CHALLAN: "Delivery Challan",
    SALES_RETURN: "Sales Return",
    PURCHASE_REQUISITION: "Purchase Requisition",
    PROCUREMENT_REQUISITION: "Procurement Requisition",
    RFQ: "Request for Quotation",
    PURCHASE_QUOTATION: "Purchase Quotation",
    PURCHASE_ORDER: "Purchase Order",
    ITEM_RECEIPT: "Item Receipt",
    PURCHASE_INVOICE: "Purchase Invoice",
    SUPPLIER_PAYMENT: "Supplier Payment",
    BILL_OF_MATERIALS: "Bill of Materials",
    ASSEMBLY_BUILD: "Assembly Build",
    ASSEMBLY_UNBUILD: "Assembly Unbuild",
    JOURNAL_ENTRY: "Journal Entry",
    MAKE_PAYMENT: "Make Payment",
    MAKE_RECEIPT: "Make Receipt",
    VENDORCREDIT: "Vendor Credit",
    GATE_PASS_IN: "Gate Pass In",
    GATE_PASS_OUT: "Gate Pass Out",
};

function formatPreview(config) {
    const number = String(
        config.starting_number ?? 1
    ).padStart(
        Number(config.number_length) || 6,
        "0"
    );

    return String(
        config.auto_number_format || DEFAULT_FORMAT
    )
        .replaceAll("#PREFIX#", config.prefix || "")
        .replaceAll("#NUMBER#", number)
        .replaceAll("#YEAR#", "2026")
        .replaceAll("#MONTH#", "11")
        .replaceAll("#SUBSIDIARY#", config.subsidiary || "")
        .replaceAll("#LOCATION#", config.location || "")
        .replaceAll("#DEPARTMENT#", config.department || "");
}

function Notice({ type = "success", children }) {
    if (!children) return null;

    const success = type === "success";

    return (
        <div
            className={`flex items-start gap-2 rounded-lg border px-4 py-3 text-sm ${
                success
                    ? "border-green-200 bg-green-50 text-green-800"
                    : "border-red-200 bg-red-50 text-red-700"
            }`}
        >
            {success ? (
                <CheckCircle2 size={18} />
            ) : (
                <AlertCircle size={18} />
            )}
            <span>{children}</span>
        </div>
    );
}

export default function TransactionAutoNumberPage() {
    const [configs, setConfigs] = useState([]);
    const [permissions, setPermissions] = useState({
        canView: false,
        canUpdate: false,
    });

    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState("");
    const [message, setMessage] = useState("");

    const loadConfigurations = useCallback(async () => {
        setLoading(true);
        setError("");
        setMessage("");

        try {
            const response = await fetch(
                "/api/transaction-auto-number",
                {
                    method: "GET",
                    cache: "no-store",
                }
            );

            const data = await response.json();

            if (!response.ok || !data.success) {
                throw new Error(
                    data.message || "Unable to load configurations."
                );
            }

            setConfigs(data.configs || []);
            setPermissions(
                data.permissions || {
                    canView: true,
                    canUpdate: false,
                }
            );
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
    let cancelled = false;

    async function fetchConfigurations() {
        try {
            const response = await fetch(
                "/api/transaction-auto-number",
                {
                    method: "GET",
                    cache: "no-store",
                }
            );

            const data = await response.json();

            if (!response.ok || !data.success) {
                throw new Error(
                    data.message || "Unable to load configurations."
                );
            }

            if (cancelled) return;

            setConfigs(data.configs || []);
            setPermissions(
                data.permissions || {
                    canView: true,
                    canUpdate: false,
                }
            );
        } catch (err) {
            if (!cancelled) {
                setError(err.message);
            }
        } finally {
            if (!cancelled) {
                setLoading(false);
            }
        }
    }

    fetchConfigurations();

    return () => {
        cancelled = true;
    };
}, []);

    const updateConfig = (transactionType, field, value) => {
        setConfigs((current) =>
            current.map((config) =>
                config.transaction_type === transactionType
                    ? {
                        ...config,
                        [field]: value,
                    }
                    : config
            )
        );
    };

    const saveConfigurations = async () => {
        setSaving(true);
        setError("");
        setMessage("");

        try {
            const response = await fetch(
                "/api/transaction-auto-number",
                {
                    method: "PUT",
                    headers: {
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({ configs }),
                }
            );

            const data = await response.json();

            if (!response.ok || !data.success) {
                throw new Error(
                    data.message || "Unable to save configurations."
                );
            }

            setConfigs(data.configs || []);
            setMessage(data.message || "Configurations saved successfully.");
        } catch (err) {
            setError(err.message);
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="erp-page-gradient min-h-screen space-y-5 p-4 md:p-6">
            <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
                <div>
                    <div className="mb-1 flex items-center gap-2">
                        <Settings2
                            size={22}
                            className="text-[var(--erp-primary)]"
                        />
                        <h1 className="text-2xl font-bold text-[var(--erp-text)]">
                            Transaction Auto Number
                        </h1>
                    </div>

                    <p className="text-sm text-[var(--erp-muted)]">
                        Configure automatic numbering formats for company transactions.
                    </p>
                </div>

                <div className="flex gap-2">
                    <button
                        type="button"
                        onClick={loadConfigurations}
                        disabled={loading || saving}
                        className="erp-button inline-flex items-center justify-center gap-2"
                    >
                        <RefreshCw
                            size={16}
                            className={loading ? "animate-spin" : ""}
                        />
                        Refresh
                    </button>

                    {permissions.canUpdate && (
                        <button
                            type="button"
                            onClick={saveConfigurations}
                            disabled={loading || saving}
                            className="erp-button inline-flex items-center justify-center gap-2"
                        >
                            <Save size={16} />
                            {saving ? "Saving..." : "Save Changes"}
                        </button>
                    )}
                </div>
            </div>

            {error && <Notice type="error">{error}</Notice>}
            {message && <Notice>{message}</Notice>}

            <div className="erp-card overflow-hidden">
                <div className="erp-card-header flex items-center gap-2">
                    <Hash
                        size={18}
                        className="text-[var(--erp-primary)]"
                    />
                    <div>
                        <h2 className="font-semibold text-[var(--erp-text)]">
                            Numbering Configuration
                        </h2>
                        <p className="text-xs text-[var(--erp-muted)]">
                            Configure prefixes, sequence lengths and numbering dimensions.
                        </p>
                    </div>
                </div>

                {loading ? (
                    <div className="flex min-h-48 items-center justify-center gap-2 text-sm text-[var(--erp-muted)]">
                        <RefreshCw size={18} className="animate-spin" />
                        Loading numbering configurations...
                    </div>
                ) : (
                    <div className="erp-card-body p-0">
                        <div className="overflow-x-auto">
                            <table className="w-full min-w-[1650px] border-collapse text-left text-sm">
                                <thead className="bg-slate-100 text-xs uppercase text-slate-600">
                                    <tr>
                                        <th className="whitespace-nowrap px-3 py-3">
                                            Transaction Type
                                        </th>
                                        <th className="px-3 py-3">
                                            Form Type
                                        </th>
                                        <th className="px-3 py-3">
                                            Prefix
                                        </th>
                                        <th className="px-3 py-3">
                                            Number Length
                                        </th>
                                        <th className="px-3 py-3">
                                            Starting Number
                                        </th>
                                        <th className="px-3 py-3">
                                            Subsidiary
                                        </th>
                                        <th className="px-3 py-3">
                                            Location
                                        </th>
                                        <th className="px-3 py-3">
                                            Department
                                        </th>
                                        <th className="px-3 py-3 text-center">
                                            Year Wise
                                        </th>
                                        <th className="px-3 py-3 text-center">
                                            Month Wise
                                        </th>
                                        <th className="px-3 py-3">
                                            Auto Number Format
                                        </th>
                                        <th className="px-3 py-3">
                                            Preview
                                        </th>
                                    </tr>
                                </thead>

                                <tbody>
                                    {configs.map((config) => {
                                        const disabled = !permissions.canUpdate;

                                        return (
                                            <tr
                                                key={config.transaction_type}
                                                className="border-b border-slate-100 hover:bg-slate-50"
                                            >
                                                <td className="whitespace-nowrap px-3 py-3 font-medium text-slate-800">
                                                    {TRANSACTION_NAMES[config.transaction_type] ||
                                                        config.transaction_type}
                                                </td>

                                                <td className="px-3 py-3">
                                                    <span className="rounded-md bg-slate-100 px-2 py-1 text-xs font-medium text-slate-600">
                                                        {config.form_type}
                                                    </span>
                                                </td>

                                                <td className="px-3 py-3">
                                                    <input
                                                        value={config.prefix ?? ""}
                                                        disabled={disabled}
                                                        onChange={(e) =>
                                                            updateConfig(
                                                                config.transaction_type,
                                                                "prefix",
                                                                e.target.value
                                                            )
                                                        }
                                                        className="erp-input w-24"
                                                        maxLength={50}
                                                    />
                                                </td>

                                                <td className="px-3 py-3">
                                                    <input
                                                        type="number"
                                                        min="1"
                                                        max="20"
                                                        value={config.number_length ?? 6}
                                                        disabled={disabled}
                                                        onChange={(e) =>
                                                            updateConfig(
                                                                config.transaction_type,
                                                                "number_length",
                                                                e.target.value
                                                            )
                                                        }
                                                        className="erp-input w-20"
                                                    />
                                                </td>

                                                <td className="px-3 py-3">
                                                    <input
                                                        type="number"
                                                        min="0"
                                                        value={config.starting_number ?? ""}
                                                        disabled={disabled}
                                                        placeholder="1"
                                                        onChange={(e) =>
                                                            updateConfig(
                                                                config.transaction_type,
                                                                "starting_number",
                                                                e.target.value
                                                            )
                                                        }
                                                        className="erp-input w-28"
                                                    />
                                                </td>

                                                {[
                                                    "subsidiary",
                                                    "location",
                                                    "department",
                                                ].map((field) => (
                                                    <td
                                                        key={field}
                                                        className="px-3 py-3"
                                                    >
                                                        <input
                                                            value={config[field] ?? ""}
                                                            disabled={disabled}
                                                            onChange={(e) =>
                                                                updateConfig(
                                                                    config.transaction_type,
                                                                    field,
                                                                    e.target.value
                                                                )
                                                            }
                                                            className="erp-input w-32"
                                                            maxLength={255}
                                                        />
                                                    </td>
                                                ))}

                                                <td className="px-3 py-3 text-center">
                                                    <input
                                                        type="checkbox"
                                                        checked={config.year_wise === true}
                                                        disabled={disabled}
                                                        onChange={(e) =>
                                                            updateConfig(
                                                                config.transaction_type,
                                                                "year_wise",
                                                                e.target.checked
                                                            )
                                                        }
                                                        className="h-4 w-4 accent-blue-600"
                                                    />
                                                </td>

                                                <td className="px-3 py-3 text-center">
                                                    <input
                                                        type="checkbox"
                                                        checked={config.month_wise === true}
                                                        disabled={disabled}
                                                        onChange={(e) =>
                                                            updateConfig(
                                                                config.transaction_type,
                                                                "month_wise",
                                                                e.target.checked
                                                            )
                                                        }
                                                        className="h-4 w-4 accent-blue-600"
                                                    />
                                                </td>

                                                <td className="px-3 py-3">
                                                    <input
                                                        value={
                                                            config.auto_number_format ||
                                                            DEFAULT_FORMAT
                                                        }
                                                        disabled={disabled}
                                                        onChange={(e) =>
                                                            updateConfig(
                                                                config.transaction_type,
                                                                "auto_number_format",
                                                                e.target.value
                                                            )
                                                        }
                                                        className="erp-input w-52"
                                                        maxLength={255}
                                                    />
                                                </td>

                                                <td className="px-3 py-3">
                                                    <span className="whitespace-nowrap rounded-md bg-blue-50 px-2 py-1 font-mono text-xs font-semibold text-blue-700">
                                                        {formatPreview(config)}
                                                    </span>
                                                </td>
                                            </tr>
                                        );
                                    })}

                                    {configs.length === 0 && (
                                        <tr>
                                            <td
                                                colSpan={12}
                                                className="px-4 py-12 text-center text-slate-500"
                                            >
                                                No numbering configurations found.
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>

                        <div className="border-t border-slate-200 bg-slate-50 px-4 py-3 text-xs text-slate-500">
                            Supported format tokens:{" "}
                            <code>#PREFIX#</code>,{" "}
                            <code>#NUMBER#</code>,{" "}
                            <code>#YEAR#</code>,{" "}
                            <code>#MONTH#</code>,{" "}
                            <code>#SUBSIDIARY#</code>,{" "}
                            <code>#LOCATION#</code>,{" "}
                            <code>#DEPARTMENT#</code>.
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}