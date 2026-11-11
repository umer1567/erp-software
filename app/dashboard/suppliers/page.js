
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

const emptyForm = {
    supplierCode: "",
    supplierName: "",
    phone: "",
    email: "",
    address: "",
    openingBalance: "0",
    creditLimit: "0",
    isActive: true,
};

const PERMISSIONS_URL = "/api/permissions/current";
const SUPPLIERS_URL = "/api/suppliers";
const PERMISSION_KEY = "vendors";

const inputClass =
    "w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 hover:border-slate-300 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:placeholder:text-slate-500 dark:hover:border-slate-600 dark:focus:border-blue-400 dark:focus:ring-blue-400/10";

const labelClass =
    "mb-2 block text-sm font-semibold text-slate-700 dark:text-slate-300";

const panelClass =
    "rounded-2xl border border-slate-200/80 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900";

function toBoolean(value) {
    return (
        value === true ||
        value === 1 ||
        value === "1" ||
        String(value).toLowerCase() === "true"
    );
}

function formatAmount(value) {
    const amount = Number(value ?? 0);

    return (Number.isFinite(amount) ? amount : 0).toLocaleString(
        "en-PK",
        {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
        }
    );
}

function getInitials(name = "") {
    return (
        name
            .trim()
            .split(/\s+/)
            .filter(Boolean)
            .slice(0, 2)
            .map((part) => part[0]?.toUpperCase())
            .join("") || "V"
    );
}

function Icon({ name, size = 20, className = "" }) {
    const common = {
        width: size,
        height: size,
        viewBox: "0 0 24 24",
        fill: "none",
        stroke: "currentColor",
        strokeWidth: 1.8,
        strokeLinecap: "round",
        strokeLinejoin: "round",
        className,
        "aria-hidden": true,
    };

    const paths = {
        building: (
            <>
                <rect x="3" y="4" width="18" height="16" rx="2" />
                <path d="M9 20V8h6v12M7 8h.01M7 12h.01M7 16h.01M17 8h.01M17 12h.01M17 16h.01" />
            </>
        ),
        users: (
            <>
                <path d="M16 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                <circle cx="10" cy="7" r="4" />
                <path d="M20 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
            </>
        ),
        wallet: (
            <>
                <rect x="3" y="5" width="18" height="15" rx="2" />
                <path d="M3 9h18M16 14h.01M7 5V3h11v2" />
            </>
        ),
        search: (
            <>
                <circle cx="11" cy="11" r="7" />
                <path d="m20 20-4-4" />
            </>
        ),
        plus: <path d="M12 5v14M5 12h14" />,
        refresh: (
            <>
                <path d="M20 7v5h-5M4 17v-5h5" />
                <path d="M5.5 9a7 7 0 0 1 11.6-2L20 12M4 12l2.9 5a7 7 0 0 0 11.6-2" />
            </>
        ),
        edit: (
            <>
                <path d="M12 20h9" />
                <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L8 18l-4 1 1-4Z" />
            </>
        ),
        trash: (
            <>
                <path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" />
                <path d="M10 11v5M14 11v5" />
            </>
        ),
        close: <path d="m18 6-12 12M6 6l12 12" />,
        check: <path d="m5 12 4 4L19 6" />,
        mail: (
            <>
                <rect x="3" y="5" width="18" height="14" rx="2" />
                <path d="m3 7 9 6 9-6" />
            </>
        ),
        phone: (
            <path d="M22 16.9v3a2 2 0 0 1-2.2 2A19.8 19.8 0 0 1 11.2 19a19.4 19.4 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 2 .7 2.9a2 2 0 0 1-.5 2.1L8 9.9a16 16 0 0 0 6 6l1.2-1.3a2 2 0 0 1 2.1-.5c.9.3 1.9.6 2.9.7a2 2 0 0 1 1.8 2.1Z" />
        ),
        filter: <path d="M4 7h16M7 12h10M10 17h4" />,
        alert: (
            <>
                <path d="M12 9v4M12 17h.01" />
                <path d="M10.3 3.9 2.5 17.4A2 2 0 0 0 4.2 20h15.6a2 2 0 0 0 1.7-2.6L13.7 3.9a2 2 0 0 0-3.4 0Z" />
            </>
        ),
        shield: (
            <>
                <path d="M12 22s8-4 8-11V5l-8-3-8 3v6c0 7 8 11 8 11Z" />
                <path d="m9 12 2 2 4-4" />
            </>
        ),
        lock: (
            <>
                <rect x="4" y="10" width="16" height="11" rx="2" />
                <path d="M8 10V7a4 4 0 1 1 8 0v3" />
            </>
        ),
    };

    return <svg {...common}>{paths[name] || paths.building}</svg>;
}

function SummaryCard({
    title,
    value,
    description,
    icon,
    accent,
    loading,
}) {
    const styles = {
        blue: {
            icon: "bg-blue-100 text-blue-700 dark:bg-blue-400/10 dark:text-blue-300",
            glow: "from-blue-500/10",
            line: "bg-blue-500",
        },
        green: {
            icon: "bg-emerald-100 text-emerald-700 dark:bg-emerald-400/10 dark:text-emerald-300",
            glow: "from-emerald-500/10",
            line: "bg-emerald-500",
        },
        teal: {
            icon: "bg-teal-100 text-teal-700 dark:bg-teal-400/10 dark:text-teal-300",
            glow: "from-teal-500/10",
            line: "bg-teal-500",
        },
    };

    const style = styles[accent] || styles.blue;

    return (
        <div
            className={`relative overflow-hidden rounded-2xl border border-slate-200/80 bg-gradient-to-br ${style.glow} via-white to-white p-5 shadow-sm transition duration-200 hover:-translate-y-0.5 hover:shadow-md dark:border-slate-800 dark:via-slate-900 dark:to-slate-900 sm:p-6`}
        >
            <div className={`absolute inset-x-0 top-0 h-1 ${style.line}`} />

            <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                    <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
                        {title}
                    </p>

                    {loading ? (
                        <div className="mt-3 h-8 w-24 animate-pulse rounded-lg bg-slate-200 dark:bg-slate-700" />
                    ) : (
                        <p className="mt-2 break-words text-2xl font-bold tracking-tight text-slate-900 dark:text-white sm:text-3xl">
                            {value}
                        </p>
                    )}

                    <p className="mt-2 text-xs leading-5 text-slate-500 dark:text-slate-400">
                        {description}
                    </p>
                </div>

                <div
                    className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl ${style.icon}`}
                >
                    <Icon name={icon} size={23} />
                </div>
            </div>
        </div>
    );
}

function StatusBadge({ active }) {
    return (
        <span
            className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold ${
                active
                    ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-400/10 dark:text-emerald-300"
                    : "border-slate-200 bg-slate-100 text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
            }`}
        >
            <span
                className={`h-1.5 w-1.5 rounded-full ${
                    active ? "bg-emerald-500" : "bg-slate-400"
                }`}
            />
            {active ? "Active" : "Inactive"}
        </span>
    );
}

function FormField({ label, htmlFor, children, hint }) {
    return (
        <div className="min-w-0">
            <label htmlFor={htmlFor} className={labelClass}>
                {label}
            </label>
            {children}
            {hint && (
                <p className="mt-1.5 text-xs text-slate-500 dark:text-slate-400">
                    {hint}
                </p>
            )}
        </div>
    );
}

function AccessDenied({ message, onRetry, retrying }) {
    return (
        <div className="flex min-h-[65vh] items-center justify-center p-5">
            <div className="w-full max-w-lg rounded-3xl border border-red-200 bg-white p-8 text-center shadow-xl dark:border-red-900/60 dark:bg-slate-900">
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-red-100 text-red-600 dark:bg-red-400/10 dark:text-red-300">
                    <Icon name="shield" size={32} />
                </div>

                <h1 className="mt-5 text-2xl font-bold text-slate-900 dark:text-white">
                    Access Restricted
                </h1>

                <p className="mt-3 text-sm leading-6 text-slate-600 dark:text-slate-400">
                    {message ||
                        "You do not have permission to view supplier accounts. Contact your administrator to request access."}
                </p>

                <div className="mt-5 flex flex-wrap justify-center gap-3">
                    <button
                        type="button"
                        onClick={onRetry}
                        disabled={retrying}
                        className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:opacity-60"
                    >
                        <Icon
                            name="refresh"
                            size={16}
                            className={retrying ? "animate-spin" : ""}
                        />
                        {retrying ? "Checking..." : "Check Permission Again"}
                    </button>
                </div>
            </div>
        </div>
    );
}

export default function SuppliersPage() {
    const [form, setForm] = useState({ ...emptyForm });
    const [suppliers, setSuppliers] = useState([]);

    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [saving, setSaving] = useState(false);
    const [deletingId, setDeletingId] = useState(null);

    const [error, setError] = useState("");
    const [message, setMessage] = useState("");
    const [search, setSearch] = useState("");
    const [statusFilter, setStatusFilter] = useState("all");

    const [editingId, setEditingId] = useState(null);
    const [showForm, setShowForm] = useState(false);

    // User Rights
    const [permissions, setPermissions] = useState({
        can_view: false,
        can_create: false,
        can_update: false,
        can_delete: false,
    });

    const [permissionLoading, setPermissionLoading] = useState(true);
    const [permissionError, setPermissionError] = useState("");

    const canView = permissions.can_view;
    const canCreate = permissions.can_create;
    const canUpdate = permissions.can_update;
    const canDelete = permissions.can_delete;

    // Load supplier records.
    const loadSuppliers = useCallback(async () => {
        const response = await fetch(SUPPLIERS_URL, {
            method: "GET",
            credentials: "same-origin",
            cache: "no-store",
            headers: {
                Accept: "application/json",
            },
        });

        const data = await response.json();

        if (!response.ok) {
            if (response.status === 403) {
                throw new Error(
                    "You are not authorized to view supplier records."
                );
            }

            throw new Error(data.message || "Failed to load suppliers.");
        }

        setSuppliers(data.suppliers || []);
    }, []);

    // Load current user's Vendors permissions.
    const checkPermissions = useCallback(async (signal) => {
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
                data.message || "Unable to load user permissions."
            );
        }

        if (!Array.isArray(data.permissions)) {
            throw new Error(
                "Invalid permissions response. Expected a permissions array."
            );
        }

        const permission = data.permissions.find(
            (item) =>
                String(item.permission_key || "")
                    .trim()
                    .toLowerCase() === PERMISSION_KEY
        );

        const nextPermissions = {
            can_view: toBoolean(permission?.can_view),
            can_create: toBoolean(permission?.can_create),
            can_update: toBoolean(permission?.can_update),
            can_delete: toBoolean(permission?.can_delete),
        };

        setPermissions(nextPermissions);
        setPermissionError("");

        return nextPermissions;
    }, []);

    // Check permission first; load suppliers only after View is granted.
    useEffect(() => {
        const controller = new AbortController();
        let cancelled = false;

        async function initializePage() {
            setPermissionLoading(true);

            try {
                const rights = await checkPermissions(
                    controller.signal
                );

                if (cancelled) return;

                if (!rights.can_view) {
                    setSuppliers([]);
                    setLoading(false);
                    return;
                }

                const response = await fetch(SUPPLIERS_URL, {
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
                    if (response.status === 403) {
                        throw new Error(
                            "The server denied access to supplier records."
                        );
                    }

                    throw new Error(
                        data.message || "Failed to load suppliers."
                    );
                }

                if (!cancelled) {
                    setSuppliers(data.suppliers || []);
                    setError("");
                }
            } catch (err) {
                if (
                    cancelled ||
                    err.name === "AbortError"
                ) {
                    return;
                }

                setSuppliers([]);
                setPermissionError(
                    err.message || "Unable to verify your permissions."
                );
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
            controller.abort();
        };
    }, [checkPermissions]);

    // Re-check permissions when User Rights are changed elsewhere.
    useEffect(() => {
        let active = true;
        let controller = null;

        async function refreshPermissions() {
            controller?.abort();
            controller = new AbortController();

            try {
                const rights = await checkPermissions(
                    controller.signal
                );

                if (!active) return;

                if (!rights.can_view) {
                    setSuppliers([]);
                    setShowForm(false);
                    setEditingId(null);
                    setLoading(false);
                    return;
                }

                const response = await fetch(SUPPLIERS_URL, {
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
                        data.message || "Failed to load suppliers."
                    );
                }

                if (active) {
                    setSuppliers(data.suppliers || []);
                    setError("");
                }
            } catch (err) {
                if (
                    !active ||
                    err.name === "AbortError"
                ) {
                    return;
                }

                setPermissionError(
                    err.message || "Unable to refresh permissions."
                );
            }
        }

        function handlePermissionsUpdated() {
            void refreshPermissions();
        }

        window.addEventListener(
            "erp-permissions-updated",
            handlePermissionsUpdated
        );

        return () => {
            active = false;
            controller?.abort();

            window.removeEventListener(
                "erp-permissions-updated",
                handlePermissionsUpdated
            );
        };
    }, [checkPermissions]);

    async function retryPermissionCheck() {
        setPermissionLoading(true);
        setPermissionError("");
        setError("");

        const controller = new AbortController();

        try {
            const rights = await checkPermissions(
                controller.signal
            );

            if (!rights.can_view) {
                setSuppliers([]);
                setShowForm(false);
                setEditingId(null);
                return;
            }

            await loadSuppliers();
        } catch (err) {
            setPermissionError(
                err.message || "Unable to verify permissions."
            );
        } finally {
            setPermissionLoading(false);
            setLoading(false);
        }
    }

    async function refreshSuppliers() {
        if (!canView) return;

        setRefreshing(true);
        setError("");

        try {
            await loadSuppliers();
        } catch (err) {
            setError(err.message || "Failed to refresh suppliers.");
        } finally {
            setRefreshing(false);
            setLoading(false);
        }
    }

    function handleChange(event) {
        const { name, value, type, checked } = event.target;

        setForm((previous) => ({
            ...previous,
            [name]: type === "checkbox" ? checked : value,
        }));
    }

    function closeForm() {
        if (saving) return;

        setForm({ ...emptyForm });
        setEditingId(null);
        setShowForm(false);
        setError("");
    }

    function openAddForm() {
        if (!canCreate) {
            setError("You do not have permission to create suppliers.");
            return;
        }

        setForm({ ...emptyForm });
        setEditingId(null);
        setError("");
        setMessage("");
        setShowForm(true);
    }

    function editSupplier(supplier) {
        if (!canUpdate) {
            setError("You do not have permission to edit suppliers.");
            return;
        }

        setEditingId(supplier.supplier_id);

        setForm({
            supplierCode: supplier.supplier_code || "",
            supplierName: supplier.supplier_name || "",
            phone: supplier.phone || "",
            email: supplier.email || "",
            address: supplier.address || "",
            openingBalance: String(supplier.opening_balance ?? 0),
            creditLimit: String(supplier.credit_limit ?? 0),
            isActive: supplier.is_active !== false,
        });

        setError("");
        setMessage("");
        setShowForm(true);

        window.scrollTo({
            top: 0,
            behavior: "smooth",
        });
    }

    async function saveSupplier(event) {
        event.preventDefault();

        const wasEditing = Boolean(editingId);

        if (!canView) {
            setError("You do not have permission to access suppliers.");
            return;
        }

        if (wasEditing && !canUpdate) {
            setError("You do not have permission to edit suppliers.");
            return;
        }

        if (!wasEditing && !canCreate) {
            setError("You do not have permission to create suppliers.");
            return;
        }

        const openingBalance = Number(form.openingBalance || 0);
        const creditLimit = Number(form.creditLimit || 0);

        if (
            !Number.isFinite(openingBalance) ||
            openingBalance < 0 ||
            !Number.isFinite(creditLimit) ||
            creditLimit < 0
        ) {
            setError(
                "Opening balance and credit limit must be valid non-negative numbers."
            );
            return;
        }

        setSaving(true);
        setError("");
        setMessage("");

        try {
            const url = wasEditing
                ? `${SUPPLIERS_URL}/${editingId}`
                : SUPPLIERS_URL;

            const response = await fetch(url, {
                method: wasEditing ? "PUT" : "POST",
                credentials: "same-origin",
                headers: {
                    "Content-Type": "application/json",
                    Accept: "application/json",
                },
                body: JSON.stringify({
                    ...form,
                    openingBalance,
                    creditLimit,
                }),
            });

            const data = await response.json();

            if (!response.ok) {
                if (response.status === 403) {
                    throw new Error(
                        "The server denied this action. Your supplier permissions may have changed."
                    );
                }

                throw new Error(
                    data.message || "Failed to save supplier."
                );
            }

            await loadSuppliers();

            setForm({ ...emptyForm });
            setEditingId(null);
            setShowForm(false);

            setMessage(
                wasEditing
                    ? "Supplier updated successfully."
                    : "Supplier added successfully."
            );
        } catch (err) {
            setError(err.message || "Failed to save supplier.");
        } finally {
            setSaving(false);
        }
    }

    async function deleteSupplier(id) {
        if (!canDelete) {
            setError("You do not have permission to delete suppliers.");
            return;
        }

        const supplier = suppliers.find(
            (item) => String(item.supplier_id) === String(id)
        );

        const confirmed = window.confirm(
            `Delete supplier "${supplier?.supplier_name || ""}"? This action cannot be undone.`
        );

        if (!confirmed) return;

        setDeletingId(id);
        setError("");
        setMessage("");

        try {
            const response = await fetch(`${SUPPLIERS_URL}/${id}`, {
                method: "DELETE",
                credentials: "same-origin",
                headers: {
                    Accept: "application/json",
                },
            });

            const data = await response.json();

            if (!response.ok) {
                if (response.status === 403) {
                    throw new Error(
                        "The server denied this action. You do not have delete permission."
                    );
                }

                throw new Error(
                    data.message || "Failed to delete supplier."
                );
            }

            if (String(editingId) === String(id)) {
                setForm({ ...emptyForm });
                setEditingId(null);
                setShowForm(false);
            }

            await loadSuppliers();
            setMessage("Supplier deleted successfully.");
        } catch (err) {
            setError(err.message || "Failed to delete supplier.");
        } finally {
            setDeletingId(null);
        }
    }

    const filteredSuppliers = useMemo(() => {
        const normalizedSearch = search.trim().toLowerCase();

        return suppliers.filter((supplier) => {
            const searchableText = [
                supplier.supplier_code,
                supplier.supplier_name,
                supplier.phone,
                supplier.email,
                supplier.address,
            ]
                .filter(Boolean)
                .join(" ")
                .toLowerCase();

            const matchesSearch =
                !normalizedSearch ||
                searchableText.includes(normalizedSearch);

            const matchesStatus =
                statusFilter === "all" ||
                (statusFilter === "active" && supplier.is_active) ||
                (statusFilter === "inactive" && !supplier.is_active);

            return matchesSearch && matchesStatus;
        });
    }, [suppliers, search, statusFilter]);

    const activeCount = suppliers.filter(
        (supplier) => supplier.is_active
    ).length;

    const inactiveCount = suppliers.length - activeCount;

    const totalBalance = suppliers.reduce(
        (total, supplier) => total + Number(supplier.balance || 0),
        0
    );

    // Permission loading screen.
    if (permissionLoading || loading && !permissionError && !canView) {
        return (
            <div className="flex min-h-[60vh] items-center justify-center bg-slate-50 dark:bg-slate-950">
                <div className="text-center">
                    <div className="mx-auto h-12 w-12 animate-spin rounded-full border-4 border-blue-200 border-t-blue-600 dark:border-slate-700 dark:border-t-blue-400" />
                    <p className="mt-4 text-sm font-medium text-slate-600 dark:text-slate-300">
                        Verifying supplier permissions...
                    </p>
                </div>
            </div>
        );
    }

    // Do not render supplier data without View permission.
    if (!canView || permissionError) {
        return (
            <AccessDenied
                message={
                    permissionError ||
                    "You do not have View permission for Vendors. Contact your administrator to request access."
                }
                onRetry={retryPermissionCheck}
                retrying={permissionLoading}
            />
        );
    }

    return (
        <div className="min-h-screen space-y-6 bg-slate-50/50 pb-8 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
            {/* Page header */}
            <section className="relative isolate overflow-hidden rounded-3xl bg-gradient-to-br from-slate-950 via-blue-950 to-emerald-950 px-5 py-7 shadow-xl shadow-blue-950/10 sm:px-8 sm:py-9">
                <div className="pointer-events-none absolute -right-16 -top-20 h-64 w-64 rounded-full bg-emerald-400/15 blur-3xl" />
                <div className="pointer-events-none absolute -bottom-24 left-1/3 h-64 w-64 rounded-full bg-blue-400/15 blur-3xl" />

                <div className="relative flex flex-col justify-between gap-6 lg:flex-row lg:items-center">
                    <div className="max-w-2xl">
                        <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-xs font-semibold tracking-wide text-emerald-200 backdrop-blur">
                            <span className="h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_12px_rgba(52,211,153,0.8)]" />
                            PROCUREMENT MANAGEMENT
                        </div>

                        <h1 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
                            Supplier Accounts
                        </h1>

                        <p className="mt-3 max-w-xl text-sm leading-6 text-blue-100/80 sm:text-base">
                            Manage supplier information, credit limits,
                            purchase activity, and outstanding balances
                            from one organized workspace.
                        </p>

                        <div className="mt-5 flex flex-wrap items-center gap-3 text-xs text-blue-100/80">
                            <span className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-2">
                                <Icon name="users" size={15} />
                                {suppliers.length} total suppliers
                            </span>

                            <span className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-2">
                                <Icon name="check" size={15} />
                                {activeCount} active accounts
                            </span>
                        </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-3">
                        <button
                            type="button"
                            onClick={refreshSuppliers}
                            disabled={refreshing}
                            className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/20 bg-white/10 px-4 py-3 text-sm font-semibold text-white backdrop-blur transition hover:bg-white/15 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                            <span className={refreshing ? "animate-spin" : ""}>
                                <Icon name="refresh" size={17} />
                            </span>
                            {refreshing ? "Refreshing..." : "Refresh"}
                        </button>

                        {!showForm && canCreate && (
                            <button
                                type="button"
                                onClick={openAddForm}
                                className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-400 px-5 py-3 text-sm font-bold text-emerald-950 shadow-lg shadow-emerald-950/20 transition hover:bg-emerald-300 focus:outline-none focus:ring-4 focus:ring-emerald-300/30"
                            >
                                <Icon name="plus" size={18} />
                                Add Supplier
                            </button>
                        )}
                    </div>
                </div>
            </section>

            {/* Permission summary */}
            <div className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 dark:border-slate-800 dark:bg-slate-900">
                <Icon name="shield" size={17} className="text-blue-600 dark:text-blue-400" />
                <span className="mr-2 text-xs font-semibold text-slate-600 dark:text-slate-300">
                    Your access:
                </span>

                {[
                    ["View", canView],
                    ["Create", canCreate],
                    ["Edit", canUpdate],
                    ["Delete", canDelete],
                ].map(([label, allowed]) => (
                    <span
                        key={label}
                        className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${
                            allowed
                                ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-400/10 dark:text-emerald-300"
                                : "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400"
                        }`}
                    >
                        {label}: {allowed ? "Allowed" : "Not allowed"}
                    </span>
                ))}
            </div>

            {/* Notifications */}
            {message && (
                <div
                    role="status"
                    className="flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3.5 text-sm text-emerald-800 dark:border-emerald-800 dark:bg-emerald-400/10 dark:text-emerald-300"
                >
                    <Icon name="check" size={19} className="mt-0.5 shrink-0" />
                    <p className="flex-1">{message}</p>
                    <button
                        type="button"
                        onClick={() => setMessage("")}
                        aria-label="Dismiss success message"
                        className="rounded-lg p-1 hover:bg-emerald-100 dark:hover:bg-emerald-400/10"
                    >
                        <Icon name="close" size={16} />
                    </button>
                </div>
            )}

            {error && !showForm && (
                <div
                    role="alert"
                    className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3.5 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300"
                >
                    <Icon name="alert" size={19} className="mt-0.5 shrink-0" />
                    <p className="flex-1">{error}</p>
                    <button
                        type="button"
                        onClick={() => setError("")}
                        aria-label="Dismiss error message"
                        className="rounded-lg p-1 hover:bg-red-100 dark:hover:bg-red-900/40"
                    >
                        <Icon name="close" size={16} />
                    </button>
                </div>
            )}

            {/* Summary cards */}
            {!showForm && (
                <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
                    <SummaryCard
                        title="Total Suppliers"
                        value={suppliers.length.toLocaleString("en-PK")}
                        description="All supplier accounts in your system"
                        icon="building"
                        accent="blue"
                        loading={loading}
                    />

                    <SummaryCard
                        title="Active Suppliers"
                        value={activeCount.toLocaleString("en-PK")}
                        description={`${inactiveCount} inactive account${inactiveCount === 1 ? "" : "s"}`}
                        icon="users"
                        accent="green"
                        loading={loading}
                    />

                    <SummaryCard
                        title="Outstanding Balance"
                        value={formatAmount(totalBalance)}
                        description="Combined balance across all suppliers"
                        icon="wallet"
                        accent="teal"
                        loading={loading}
                    />
                </section>
            )}

            {/* Add/Edit supplier form */}
            {showForm ? (
                <section className={`${panelClass} overflow-hidden`}>
                    <div className="border-b border-slate-200 bg-gradient-to-r from-blue-50 via-white to-emerald-50 px-5 py-5 dark:border-slate-800 dark:from-blue-950/40 dark:via-slate-900 dark:to-emerald-950/30 sm:px-7">
                        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
                            <div className="flex items-start gap-3">
                                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-blue-100 text-blue-700 dark:bg-blue-400/10 dark:text-blue-300">
                                    <Icon
                                        name={editingId ? "edit" : "building"}
                                        size={23}
                                    />
                                </div>

                                <div>
                                    <h2 className="text-xl font-bold text-slate-900 dark:text-white">
                                        {editingId ? "Edit Supplier" : "Create Supplier"}
                                    </h2>

                                    <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                                        {editingId
                                            ? "Update this supplier's account information."
                                            : "Add a new supplier to your procurement records."}
                                    </p>
                                </div>
                            </div>

                            <button
                                type="button"
                                onClick={closeForm}
                                disabled={saving}
                                className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
                            >
                                <Icon name="close" size={16} />
                                Cancel
                            </button>
                        </div>
                    </div>

                    <form onSubmit={saveSupplier} className="p-5 sm:p-7">
                        {error && (
                            <div
                                role="alert"
                                className="mb-6 flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300"
                            >
                                <Icon name="alert" size={18} className="mt-0.5 shrink-0" />
                                <p>{error}</p>
                            </div>
                        )}

                        <div className="space-y-8">
                            {/* Basic details */}
                            <div>
                                <div className="mb-5 flex items-center gap-3">
                                    <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-100 text-blue-700 dark:bg-blue-400/10 dark:text-blue-300">
                                        <Icon name="building" size={18} />
                                    </div>

                                    <div>
                                        <h3 className="font-bold text-slate-900 dark:text-white">
                                            Basic Information
                                        </h3>
                                        <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                                            Supplier identity and contact details
                                        </p>
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
                                    <FormField label="Supplier Code *" htmlFor="supplierCode">
                                        <input
                                            id="supplierCode"
                                            name="supplierCode"
                                            value={form.supplierCode}
                                            onChange={handleChange}
                                            className={inputClass}
                                            placeholder="e.g. SUP-001"
                                            required
                                            maxLength={50}
                                        />
                                    </FormField>

                                    <FormField label="Supplier Name *" htmlFor="supplierName">
                                        <input
                                            id="supplierName"
                                            name="supplierName"
                                            value={form.supplierName}
                                            onChange={handleChange}
                                            className={inputClass}
                                            placeholder="Enter supplier name"
                                            required
                                            maxLength={150}
                                        />
                                    </FormField>

                                    <FormField label="Phone Number" htmlFor="phone">
                                        <div className="relative">
                                            <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-400">
                                                <Icon name="phone" size={17} />
                                            </span>
                                            <input
                                                id="phone"
                                                name="phone"
                                                value={form.phone}
                                                onChange={handleChange}
                                                className={`${inputClass} pl-10`}
                                                placeholder="Enter phone number"
                                            />
                                        </div>
                                    </FormField>

                                    <FormField label="Email Address" htmlFor="email">
                                        <div className="relative">
                                            <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-400">
                                                <Icon name="mail" size={17} />
                                            </span>
                                            <input
                                                id="email"
                                                type="email"
                                                name="email"
                                                value={form.email}
                                                onChange={handleChange}
                                                className={`${inputClass} pl-10`}
                                                placeholder="supplier@example.com"
                                            />
                                        </div>
                                    </FormField>

                                    <div className="md:col-span-2 xl:col-span-2">
                                        <FormField label="Address" htmlFor="address">
                                            <textarea
                                                id="address"
                                                name="address"
                                                value={form.address}
                                                onChange={handleChange}
                                                className={`${inputClass} resize-y`}
                                                rows={3}
                                                placeholder="Enter supplier's complete address"
                                            />
                                        </FormField>
                                    </div>
                                </div>
                            </div>

                            <div className="border-t border-slate-100 dark:border-slate-800" />

                            {/* Financial details */}
                            <div>
                                <div className="mb-5 flex items-center gap-3">
                                    <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700 dark:bg-emerald-400/10 dark:text-emerald-300">
                                        <Icon name="wallet" size={18} />
                                    </div>

                                    <div>
                                        <h3 className="font-bold text-slate-900 dark:text-white">
                                            Financial Information
                                        </h3>
                                        <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                                            Opening balance and credit terms
                                        </p>
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
                                    <FormField
                                        label="Opening Balance"
                                        htmlFor="openingBalance"
                                        hint="Initial balance recorded for this supplier."
                                    >
                                        <input
                                            id="openingBalance"
                                            type="number"
                                            min="0"
                                            step="0.01"
                                            name="openingBalance"
                                            value={form.openingBalance}
                                            onChange={handleChange}
                                            className={inputClass}
                                            required
                                        />
                                    </FormField>

                                    <FormField
                                        label="Credit Limit"
                                        htmlFor="creditLimit"
                                        hint="Maximum credit allowed for this supplier."
                                    >
                                        <input
                                            id="creditLimit"
                                            type="number"
                                            min="0"
                                            step="0.01"
                                            name="creditLimit"
                                            value={form.creditLimit}
                                            onChange={handleChange}
                                            className={inputClass}
                                            required
                                        />
                                    </FormField>

                                    <div className="flex items-center">
                                        <label className="flex w-full cursor-pointer items-center justify-between gap-4 rounded-xl border border-emerald-200 bg-emerald-50/70 px-4 py-4 transition hover:bg-emerald-50 dark:border-emerald-900 dark:bg-emerald-950/30 dark:hover:bg-emerald-950/50">
                                            <span>
                                                <span className="block text-sm font-bold text-slate-800 dark:text-slate-100">
                                                    Active Supplier
                                                </span>
                                                <span className="mt-1 block text-xs text-slate-500 dark:text-slate-400">
                                                    Allow this account to be active
                                                </span>
                                            </span>

                                            <input
                                                type="checkbox"
                                                name="isActive"
                                                checked={form.isActive}
                                                onChange={handleChange}
                                                className="h-5 w-5 shrink-0 cursor-pointer rounded accent-emerald-600"
                                            />
                                        </label>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="mt-8 flex flex-col-reverse gap-3 border-t border-slate-100 pt-6 dark:border-slate-800 sm:flex-row sm:items-center sm:justify-between">
                            <p className="text-xs text-slate-500 dark:text-slate-400">
                                Fields marked with * are required.
                            </p>

                            <div className="flex flex-wrap gap-3">
                                <button
                                    type="button"
                                    onClick={() => {
                                        setForm({ ...emptyForm });
                                        setError("");
                                    }}
                                    disabled={saving}
                                    className="rounded-xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                                >
                                    Clear Fields
                                </button>

                                <button
                                    type="button"
                                    onClick={closeForm}
                                    disabled={saving}
                                    className="rounded-xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                                >
                                    Cancel
                                </button>

                                <button
                                    type="submit"
                                    disabled={saving || (editingId ? !canUpdate : !canCreate)}
                                    className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-blue-700 to-emerald-600 px-6 py-3 text-sm font-bold text-white shadow-lg shadow-emerald-900/10 transition hover:from-blue-600 hover:to-emerald-500 focus:outline-none focus:ring-4 focus:ring-emerald-500/20 disabled:cursor-not-allowed disabled:opacity-60"
                                >
                                    {saving ? (
                                        <>
                                            <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                                            Saving...
                                        </>
                                    ) : (
                                        <>
                                            <Icon name="check" size={17} />
                                            {editingId ? "Update Supplier" : "Save Supplier"}
                                        </>
                                    )}
                                </button>
                            </div>
                        </div>
                    </form>
                </section>
            ) : (
                /* Supplier list */
                <section className={`${panelClass} overflow-hidden`}>
                    <div className="border-b border-slate-200 px-5 py-5 dark:border-slate-800 sm:px-6">
                        <div className="flex flex-col justify-between gap-4 xl:flex-row xl:items-center">
                            <div>
                                <div className="flex flex-wrap items-center gap-3">
                                    <h2 className="text-xl font-bold text-slate-900 dark:text-white">
                                        Supplier Directory
                                    </h2>

                                    <span className="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-bold text-blue-700 dark:bg-blue-400/10 dark:text-blue-300">
                                        {filteredSuppliers.length} records
                                    </span>
                                </div>

                                <p className="mt-1.5 text-sm text-slate-500 dark:text-slate-400">
                                    Search, review, and maintain supplier accounts.
                                </p>
                            </div>

                            <div className="flex flex-col gap-3 sm:flex-row">
                                <div className="relative min-w-0 sm:min-w-[260px]">
                                    <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-400">
                                        <Icon name="search" size={18} />
                                    </span>

                                    <input
                                        type="search"
                                        value={search}
                                        onChange={(event) => setSearch(event.target.value)}
                                        placeholder="Search suppliers..."
                                        aria-label="Search supplier accounts"
                                        className={`${inputClass} pl-10 pr-10`}
                                    />

                                    {search && (
                                        <button
                                            type="button"
                                            onClick={() => setSearch("")}
                                            aria-label="Clear search"
                                            className="absolute inset-y-0 right-0 flex items-center pr-3 text-slate-400 hover:text-slate-700 dark:hover:text-white"
                                        >
                                            <Icon name="close" size={16} />
                                        </button>
                                    )}
                                </div>

                                <div className="relative">
                                    <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
                                        <Icon name="filter" size={17} />
                                    </span>

                                    <select
                                        value={statusFilter}
                                        onChange={(event) => setStatusFilter(event.target.value)}
                                        aria-label="Filter suppliers by status"
                                        className={`${inputClass} min-w-[165px] cursor-pointer pl-10`}
                                    >
                                        <option value="all">All statuses</option>
                                        <option value="active">Active only</option>
                                        <option value="inactive">Inactive only</option>
                                    </select>
                                </div>
                            </div>
                        </div>
                    </div>

                    {loading ? (
                        <div className="space-y-3 p-6">
                            {[1, 2, 3, 4, 5].map((item) => (
                                <div
                                    key={item}
                                    className="h-14 animate-pulse rounded-xl bg-slate-100 dark:bg-slate-800"
                                />
                            ))}
                        </div>
                    ) : (
                        <>
                            <div className="overflow-x-auto">
                                <table className="w-full min-w-[1000px] text-left text-sm">
                                    <thead>
                                        <tr className="border-b border-slate-200 bg-slate-50/80 text-xs uppercase tracking-wider text-slate-500 dark:border-slate-800 dark:bg-slate-950/60 dark:text-slate-400">
                                            <th className="px-5 py-4 font-bold">Supplier</th>
                                            <th className="px-4 py-4 font-bold">Contact</th>
                                            <th className="px-4 py-4 text-right font-bold">Purchases</th>
                                            <th className="px-4 py-4 text-right font-bold">Paid</th>
                                            <th className="px-4 py-4 text-right font-bold">Balance</th>
                                            <th className="px-4 py-4 text-center font-bold">Status</th>
                                            <th className="px-5 py-4 text-center font-bold">Actions</th>
                                        </tr>
                                    </thead>

                                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                        {filteredSuppliers.map((supplier) => (
                                            <tr
                                                key={supplier.supplier_id}
                                                className="group transition hover:bg-blue-50/40 dark:hover:bg-blue-400/[0.04]"
                                            >
                                                <td className="px-5 py-4">
                                                    <div className="flex items-center gap-3">
                                                        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-blue-100 to-emerald-100 text-sm font-bold text-blue-800 ring-1 ring-blue-200/60 dark:from-blue-400/15 dark:to-emerald-400/15 dark:text-emerald-200 dark:ring-blue-300/10">
                                                            {getInitials(supplier.supplier_name)}
                                                        </div>

                                                        <div className="min-w-0">
                                                            <p className="max-w-[220px] truncate font-bold text-slate-900 dark:text-slate-100">
                                                                {supplier.supplier_name || "Unnamed supplier"}
                                                            </p>

                                                            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                                                                Code:{" "}
                                                                <span className="font-semibold text-blue-700 dark:text-blue-300">
                                                                    {supplier.supplier_code || "—"}
                                                                </span>
                                                            </p>

                                                            {supplier.email && (
                                                                <p className="mt-1 max-w-[220px] truncate text-xs text-slate-500 dark:text-slate-400">
                                                                    {supplier.email}
                                                                </p>
                                                            )}
                                                        </div>
                                                    </div>
                                                </td>

                                                <td className="px-4 py-4">
                                                    {supplier.phone ? (
                                                        <div className="flex items-center gap-2 text-slate-600 dark:text-slate-300">
                                                            <Icon name="phone" size={15} className="shrink-0 text-slate-400" />
                                                            <span className="whitespace-nowrap">
                                                                {supplier.phone}
                                                            </span>
                                                        </div>
                                                    ) : (
                                                        <span className="text-slate-400 dark:text-slate-500">
                                                            No phone
                                                        </span>
                                                    )}

                                                    {supplier.address && (
                                                        <p className="mt-1 max-w-[180px] truncate text-xs text-slate-500 dark:text-slate-400">
                                                            {supplier.address}
                                                        </p>
                                                    )}
                                                </td>

                                                <td className="whitespace-nowrap px-4 py-4 text-right font-medium tabular-nums text-slate-700 dark:text-slate-300">
                                                    {formatAmount(supplier.total_purchases)}
                                                </td>

                                                <td className="whitespace-nowrap px-4 py-4 text-right font-medium tabular-nums text-slate-700 dark:text-slate-300">
                                                    {formatAmount(supplier.total_paid)}
                                                </td>

                                                <td className="whitespace-nowrap px-4 py-4 text-right">
                                                    <span className="font-bold tabular-nums text-slate-900 dark:text-white">
                                                        {formatAmount(supplier.balance)}
                                                    </span>
                                                </td>

                                                <td className="px-4 py-4 text-center">
                                                    <StatusBadge active={Boolean(supplier.is_active)} />
                                                </td>

                                                <td className="px-5 py-4">
                                                    <div className="flex items-center justify-center gap-2">
                                                        {canUpdate && (
                                                            <button
                                                                type="button"
                                                                onClick={() => editSupplier(supplier)}
                                                                aria-label={`Edit ${supplier.supplier_name}`}
                                                                title="Edit supplier"
                                                                className="inline-flex items-center gap-1.5 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-xs font-bold text-blue-700 transition hover:border-blue-300 hover:bg-blue-100 dark:border-blue-900 dark:bg-blue-400/10 dark:text-blue-300 dark:hover:bg-blue-400/20"
                                                            >
                                                                <Icon name="edit" size={14} />
                                                                Edit
                                                            </button>
                                                        )}

                                                        {canDelete && (
                                                            <button
                                                                type="button"
                                                                onClick={() => deleteSupplier(supplier.supplier_id)}
                                                                disabled={deletingId === supplier.supplier_id}
                                                                aria-label={`Delete ${supplier.supplier_name}`}
                                                                title="Delete supplier"
                                                                className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-bold text-red-700 transition hover:border-red-300 hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-red-900 dark:bg-red-400/10 dark:text-red-300 dark:hover:bg-red-400/20"
                                                            >
                                                                {deletingId === supplier.supplier_id ? (
                                                                    <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-red-300 border-t-red-700 dark:border-red-700 dark:border-t-red-200" />
                                                                ) : (
                                                                    <Icon name="trash" size={14} />
                                                                )}
                                                                {deletingId === supplier.supplier_id ? "Deleting" : "Delete"}
                                                            </button>
                                                        )}

                                                        {!canUpdate && !canDelete && (
                                                            <span className="text-xs text-slate-400 dark:text-slate-500">
                                                                No actions
                                                            </span>
                                                        )}
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}

                                        {filteredSuppliers.length === 0 && (
                                            <tr>
                                                <td colSpan={7} className="px-6 py-16 text-center">
                                                    <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-500">
                                                        <Icon name="search" size={25} />
                                                    </div>

                                                    <h3 className="mt-4 text-base font-bold text-slate-800 dark:text-slate-100">
                                                        {search || statusFilter !== "all"
                                                            ? "No matching suppliers"
                                                            : "No suppliers yet"}
                                                    </h3>

                                                    <p className="mx-auto mt-1 max-w-sm text-sm leading-6 text-slate-500 dark:text-slate-400">
                                                        {search || statusFilter !== "all"
                                                            ? "Try changing your search text or status filter."
                                                            : "Add your first supplier to start managing procurement accounts."}
                                                    </p>

                                                    {!search &&
                                                        statusFilter === "all" &&
                                                        canCreate && (
                                                            <button
                                                                type="button"
                                                                onClick={openAddForm}
                                                                className="mt-4 inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-blue-700 to-emerald-600 px-4 py-2.5 text-sm font-bold text-white transition hover:from-blue-600 hover:to-emerald-500"
                                                            >
                                                                <Icon name="plus" size={16} />
                                                                Add First Supplier
                                                            </button>
                                                        )}
                                                </td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>

                            <div className="flex flex-col gap-2 border-t border-slate-200 bg-slate-50/60 px-5 py-4 text-xs text-slate-500 dark:border-slate-800 dark:bg-slate-950/40 dark:text-slate-400 sm:flex-row sm:items-center sm:justify-between">
                                <p>
                                    Showing{" "}
                                    <span className="font-bold text-slate-800 dark:text-slate-200">
                                        {filteredSuppliers.length}
                                    </span>{" "}
                                    of{" "}
                                    <span className="font-bold text-slate-800 dark:text-slate-200">
                                        {suppliers.length}
                                    </span>{" "}
                                    suppliers
                                </p>

                                <p className="flex items-center gap-2">
                                    <span className="h-2 w-2 rounded-full bg-emerald-500" />
                                    Supplier information is up to date after refresh
                                </p>
                            </div>
                        </>
                    )}
                </section>
            )}
        </div>
    );
}
