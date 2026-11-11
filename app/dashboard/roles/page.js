
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
    ShieldCheck,
    Shield,
    Users,
    Plus,
    Search,
    RefreshCw,
    Pencil,
    Trash2,
    X,
    CheckCircle2,
    AlertCircle,
    LoaderCircle,
    LockKeyhole,
    KeyRound,
    FileText,
    Sparkles,
    ChevronRight,
    Fingerprint,
    UserRoundCog,
    Info,
    ShieldAlert,
    RotateCcw,
    ArrowUpRight,
    Eye,
    Ban,
} from "lucide-react";

const inputClass =
    "w-full rounded-xl border border-[var(--erp-border)] bg-[var(--erp-input)] px-4 py-3 text-sm text-[var(--erp-text)] outline-none transition placeholder:text-[var(--erp-muted)] hover:border-blue-400 focus:border-[var(--erp-primary)] focus:ring-4 focus:ring-blue-500/10";

const panelClass =
    "rounded-2xl border border-[var(--erp-border)] bg-[var(--erp-surface)] shadow-sm";

const mutedText = "text-[var(--erp-muted)]";
const headingText = "text-[var(--erp-text)]";

const buttonBase =
    "inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition duration-200 focus:outline-none focus:ring-4 disabled:cursor-not-allowed disabled:opacity-50";

const primaryButton =
    `${buttonBase} bg-[var(--erp-primary)] text-white shadow-sm hover:bg-[var(--erp-primary-hover)] hover:shadow-md focus:ring-blue-500/20 active:scale-[0.98]`;

const outlineButton =
    `${buttonBase} border border-[var(--erp-border)] bg-[var(--erp-surface)] text-[var(--erp-text)] hover:border-blue-300 hover:bg-blue-50/60 focus:ring-blue-500/10 dark:hover:bg-blue-400/10`;

const defaultPermissions = {
    view: false,
    create: false,
    update: false,
    delete: false,
};

function getErrorMessage(error, fallback) {
    return error instanceof Error && error.message
        ? error.message
        : fallback;
}

async function readResponse(response) {
    try {
        return await response.json();
    } catch {
        throw new Error("The server returned an invalid response.");
    }
}

function normalizePermissions(value) {
    if (!value || typeof value !== "object") {
        return { ...defaultPermissions };
    }

    return {
        view: value.view === true,
        create: value.create === true,
        update: value.update === true,
        delete: value.delete === true,
    };
}

function Notice({ type, children, onDismiss }) {
    const success = type === "success";
    const Icon = success ? CheckCircle2 : AlertCircle;

    return (
        <div
            role={success ? "status" : "alert"}
            className={`flex items-start gap-3 rounded-2xl border p-4 ${
                success
                    ? "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-500/30 dark:bg-emerald-950/30 dark:text-emerald-200"
                    : "border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-500/30 dark:bg-rose-950/30 dark:text-rose-200"
            }`}
        >
            <div
                className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
                    success
                        ? "bg-emerald-100 dark:bg-emerald-500/15"
                        : "bg-rose-100 dark:bg-rose-500/15"
                }`}
            >
                <Icon size={19} />
            </div>

            <div className="min-w-0 flex-1 pt-1">
                <p className="text-sm font-bold">
                    {success ? "Success" : "Something went wrong"}
                </p>
                <div className="mt-1 text-sm leading-6">{children}</div>
            </div>

            <button
                type="button"
                onClick={onDismiss}
                aria-label="Dismiss notification"
                className="rounded-lg p-1.5 transition hover:bg-black/5 dark:hover:bg-white/10"
            >
                <X size={17} />
            </button>
        </div>
    );
}

function StatCard({ icon: Icon, label, value, description, accent }) {
    const accents = {
        blue: {
            icon: "bg-blue-50 text-blue-700 ring-blue-100 dark:bg-blue-400/10 dark:text-blue-300 dark:ring-blue-400/20",
            bar: "bg-blue-500",
        },
        green: {
            icon: "bg-emerald-50 text-emerald-700 ring-emerald-100 dark:bg-emerald-400/10 dark:text-emerald-300 dark:ring-emerald-400/20",
            bar: "bg-emerald-500",
        },
        teal: {
            icon: "bg-teal-50 text-teal-700 ring-teal-100 dark:bg-teal-400/10 dark:text-teal-300 dark:ring-teal-400/20",
            bar: "bg-teal-500",
        },
        sky: {
            icon: "bg-sky-50 text-sky-700 ring-sky-100 dark:bg-sky-400/10 dark:text-sky-300 dark:ring-sky-400/20",
            bar: "bg-sky-500",
        },
    };

    const style = accents[accent] || accents.blue;

    return (
        <div className="group relative overflow-hidden rounded-2xl border border-[var(--erp-border)] bg-[var(--erp-surface)] p-5 shadow-sm transition duration-200 hover:-translate-y-0.5 hover:shadow-md sm:p-6">
            <div
                className={`absolute inset-x-0 top-0 h-1 ${style.bar} opacity-80 transition group-hover:opacity-100`}
            />

            <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                    <p className={`text-sm font-semibold ${mutedText}`}>
                        {label}
                    </p>

                    <p className={`mt-3 text-3xl font-extrabold tracking-tight ${headingText}`}>
                        {value}
                    </p>

                    <p className={`mt-2 text-xs leading-5 ${mutedText}`}>
                        {description}
                    </p>
                </div>

                <div
                    className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl ring-1 transition duration-200 group-hover:scale-105 ${style.icon}`}
                >
                    <Icon size={23} />
                </div>
            </div>
        </div>
    );
}

function RoleBadge({ system }) {
    return (
        <span
            className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-bold ${
                system
                    ? "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-400/30 dark:bg-blue-400/10 dark:text-blue-300"
                    : "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-400/30 dark:bg-emerald-400/10 dark:text-emerald-300"
            }`}
        >
            {system ? <ShieldCheck size={13} /> : <Shield size={13} />}
            {system ? "System role" : "Custom role"}
        </span>
    );
}

function FieldLabel({ htmlFor, children, required = false }) {
    return (
        <label
            htmlFor={htmlFor}
            className={`mb-2 block text-sm font-semibold ${headingText}`}
        >
            {children}
            {required && <span className="ml-1 text-rose-500">*</span>}
        </label>
    );
}

function LoadingRows() {
    return (
        <>
            {[1, 2, 3, 4].map((item) => (
                <tr key={item} className="animate-pulse">
                    {[1, 2, 3, 4, 5].map((cell) => (
                        <td key={cell} className="px-5 py-5">
                            <div className="h-4 rounded-lg bg-slate-200/70 dark:bg-slate-700/70" />
                        </td>
                    ))}
                </tr>
            ))}
        </>
    );
}

const filterOptions = [
    { value: "all", label: "All roles" },
    { value: "system", label: "System roles" },
    { value: "custom", label: "Custom roles" },
];

function AccessDenied({ onRetry, loading }) {
    return (
        <div className="erp-page min-h-full p-3 sm:p-5 lg:p-6">
            <div className="mx-auto max-w-3xl">
                <div className={`${panelClass} overflow-hidden`}>
                    <div className="h-1.5 bg-rose-500" />

                    <div className="p-7 text-center sm:p-10">
                        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-rose-50 text-rose-600 ring-1 ring-rose-100 dark:bg-rose-400/10 dark:text-rose-300 dark:ring-rose-400/20">
                            <Ban size={30} />
                        </div>

                        <h1 className={`mt-5 text-2xl font-extrabold ${headingText}`}>
                            Access denied
                        </h1>

                        <p className={`mx-auto mt-3 max-w-lg text-sm leading-7 ${mutedText}`}>
                            You do not have permission to view role management.
                            Contact your administrator if you believe you need
                            access to this page.
                        </p>

                        <button
                            type="button"
                            onClick={onRetry}
                            disabled={loading}
                            className={`${outlineButton} mt-6`}
                        >
                            <RefreshCw
                                size={16}
                                className={loading ? "animate-spin" : ""}
                            />
                            Check permissions again
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default function RolesPage() {
    const [roles, setRoles] = useState([]);
    const [permissions, setPermissions] = useState({
        ...defaultPermissions,
    });

    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [accessDenied, setAccessDenied] = useState(false);
    const [error, setError] = useState("");
    const [showForm, setShowForm] = useState(false);
    const [editingRole, setEditingRole] = useState(null);
    const [roleName, setRoleName] = useState("");
    const [description, setDescription] = useState("");
    const [authPassword, setAuthPassword] = useState("");
    const [message, setMessage] = useState("");
    const [saving, setSaving] = useState(false);
    const [deletingId, setDeletingId] = useState(null);
    const [search, setSearch] = useState("");
    const [filter, setFilter] = useState("all");
    const [deleteTarget, setDeleteTarget] = useState(null);

    const canView = permissions.view;
    const canCreate = permissions.create;
    const canEdit = permissions.update;
    const canDelete = permissions.delete;

    const loadRoles = useCallback(async (showRefresh = false) => {
        if (showRefresh) {
            setRefreshing(true);
        }

        try {
            const response = await fetch("/api/roles", {
                method: "GET",
                cache: "no-store",
            });

            const data = await readResponse(response);

            if (response.status === 401) {
                setRoles([]);
                setPermissions({ ...defaultPermissions });
                setAccessDenied(true);
                setShowForm(false);
                setDeleteTarget(null);
                setError(data.message || "Your session has expired. Please log in again.");
                return;
            }

            if (response.status === 403 || data.accessDenied === true) {
                setRoles([]);
                setPermissions({ ...defaultPermissions });
                setAccessDenied(true);
                setShowForm(false);
                setDeleteTarget(null);
                setError("");
                return;
            }

            if (!response.ok) {
                throw new Error(data.message || "Failed to load roles.");
            }

            const nextPermissions = normalizePermissions(data.permissions);

            setPermissions(nextPermissions);
            setAccessDenied(!nextPermissions.view);

            if (!nextPermissions.view) {
                setRoles([]);
                setShowForm(false);
                setDeleteTarget(null);
                setError("");
                return;
            }

            setRoles(Array.isArray(data.roles) ? data.roles : []);
            setError("");
        } catch (err) {
            setError(
                getErrorMessage(err, "Could not connect to the server.")
            );
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, []);

    useEffect(() => {
    let cancelled = false;

    const load = async () => {
        if (cancelled) return;
        await loadRoles();
    };

    const timer = setTimeout(load, 0);

    return () => {
        cancelled = true;
        clearTimeout(timer);
    };
}, [loadRoles]);

    const stats = useMemo(() => {
        const systemRoles = roles.filter(
            (role) => role.is_system_role
        ).length;

        const customRoles = roles.length - systemRoles;

        const assignedUsers = roles.reduce(
            (total, role) => total + (Number(role.user_count) || 0),
            0
        );

        return {
            total: roles.length,
            system: systemRoles,
            custom: customRoles,
            users: assignedUsers,
        };
    }, [roles]);

    const filteredRoles = useMemo(() => {
        const term = search.trim().toLowerCase();

        return roles.filter((role) => {
            const matchesSearch =
                !term ||
                String(role.role_name || "").toLowerCase().includes(term) ||
                String(role.description || "").toLowerCase().includes(term);

            const matchesFilter =
                filter === "all" ||
                (filter === "system" && role.is_system_role) ||
                (filter === "custom" && !role.is_system_role);

            return matchesSearch && matchesFilter;
        });
    }, [roles, search, filter]);

    function clearForm() {
        setShowForm(false);
        setEditingRole(null);
        setRoleName("");
        setDescription("");
        setAuthPassword("");
    }

    function openCreate() {
        if (!canView || !canCreate || accessDenied) {
            setError("You do not have permission to create roles.");
            return;
        }

        setEditingRole(null);
        setRoleName("");
        setDescription("");
        setAuthPassword("");
        setError("");
        setMessage("");
        setShowForm(true);
    }

    function openEdit(role) {
        if (!canView || !canEdit || accessDenied) {
            setError("You do not have permission to edit roles.");
            return;
        }

        if (role.is_system_role) {
            setError("System roles cannot be modified.");
            return;
        }

        setEditingRole(role);
        setRoleName(role.role_name || "");
        setDescription(role.description || "");
        setAuthPassword("");
        setError("");
        setMessage("");
        setShowForm(true);
    }

    function closeForm() {
        if (saving) return;
        clearForm();
        setError("");
    }

    async function submitForm(event) {
        event.preventDefault();

        if (saving) return;

        if (accessDenied || !canView) {
            setError("You do not have permission to view roles.");
            return;
        }

        if (editingRole ? !canEdit : !canCreate) {
            setError(
                editingRole
                    ? "You do not have permission to edit roles."
                    : "You do not have permission to create roles."
            );
            return;
        }

        if (editingRole?.is_system_role) {
            setError("System roles cannot be modified.");
            return;
        }

        setError("");
        setMessage("");

        const trimmedName = roleName.trim();

        if (!trimmedName) {
            setError("Role name is required.");
            return;
        }

        if (!editingRole && !authPassword) {
            setError("Enter your current account password to create a role.");
            return;
        }

        setSaving(true);

        try {
            const response = await fetch(
                editingRole
                    ? `/api/roles/${editingRole.role_id}`
                    : "/api/roles",
                {
                    method: editingRole ? "PUT" : "POST",
                    headers: {
                        "Content-Type": "application/json",
                    },
                    cache: "no-store",
                    body: JSON.stringify({
                        roleName: trimmedName,
                        description: description.trim(),
                        ...(editingRole ? {} : { authPassword }),
                    }),
                }
            );

            const data = await readResponse(response);

            if (response.status === 401) {
                setAccessDenied(true);
                throw new Error(data.message || "Your session has expired.");
            }

            if (response.status === 403) {
                await loadRoles();
                throw new Error(data.message || "You do not have permission to perform this action.");
            }

            if (!response.ok) {
                throw new Error(data.message || "Role operation failed.");
            }

            const wasEditing = Boolean(editingRole);

            clearForm();

            setMessage(
                wasEditing
                    ? "Role updated successfully."
                    : "Role created successfully. You can now assign it to a user."
            );

            await loadRoles();
        } catch (err) {
            setError(
                getErrorMessage(err, "Could not connect to the server.")
            );
        } finally {
            setSaving(false);
        }
    }

    async function deleteRole() {
        if (!deleteTarget || deletingId !== null) return;

        if (accessDenied || !canView || !canDelete) {
            setDeleteTarget(null);
            setError("You do not have permission to delete roles.");
            return;
        }

        if (deleteTarget.is_system_role) {
            setDeleteTarget(null);
            setError("System roles cannot be deleted.");
            return;
        }

        const id = deleteTarget.role_id;

        setError("");
        setMessage("");
        setDeletingId(id);

        try {
            const response = await fetch(`/api/roles/${id}`, {
                method: "DELETE",
                cache: "no-store",
            });

            const data = await readResponse(response);

            if (response.status === 401) {
                setAccessDenied(true);
                throw new Error(data.message || "Your session has expired.");
            }

            if (response.status === 403) {
                await loadRoles();
                throw new Error(data.message || "You do not have permission to delete roles.");
            }

            if (!response.ok) {
                throw new Error(data.message || "Failed to delete role.");
            }

            setDeleteTarget(null);
            setMessage("Role deleted successfully.");
            await loadRoles();
        } catch (err) {
            setError(
                getErrorMessage(err, "Could not connect to the server.")
            );
        } finally {
            setDeletingId(null);
        }
    }

    function clearFilters() {
        setSearch("");
        setFilter("all");
    }

    const refreshButtonClass = `${outlineButton} shadow-sm`;

    if (loading && !accessDenied) {
        return (
            <div className="erp-page min-h-full p-3 sm:p-5 lg:p-6">
                <div className="mx-auto max-w-[1800px]">
                    <div className={`${panelClass} p-8`}>
                        <div className="flex items-center gap-3">
                            <LoaderCircle
                                size={22}
                                className="animate-spin text-[var(--erp-primary)]"
                            />
                            <div>
                                <h1 className={`font-bold ${headingText}`}>
                                    Loading role management
                                </h1>
                                <p className={`mt-1 text-sm ${mutedText}`}>
                                    Checking your role permissions...
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    if (accessDenied) {
        return (
            <AccessDenied
                loading={refreshing}
                onRetry={() => loadRoles(true)}
            />
        );
    }

    return (
        <div className="erp-page min-h-full p-3 sm:p-5 lg:p-6">
            <div className="mx-auto max-w-[1800px] space-y-6">
                {/* Page header */}
                <section className="relative isolate overflow-hidden rounded-2xl border border-[var(--erp-border)] bg-[var(--erp-surface)] shadow-sm">
                    <div className="pointer-events-none absolute inset-y-0 right-0 w-1/2 bg-gradient-to-l from-blue-500/[0.07] to-transparent" />
                    <div className="pointer-events-none absolute -right-12 -top-20 h-56 w-56 rounded-full bg-emerald-400/[0.10] blur-3xl" />

                    <div className="relative flex flex-col justify-between gap-6 p-5 sm:p-7 lg:flex-row lg:items-center lg:p-8">
                        <div className="min-w-0">
                            <div className="mb-4 flex flex-wrap items-center gap-2 text-xs font-bold uppercase tracking-[0.12em] text-[var(--erp-primary)]">
                                <ShieldCheck size={15} />
                                Administration
                                <ChevronRight size={13} />
                                <span className={mutedText}>
                                    Role management
                                </span>
                            </div>

                            <div className="flex items-start gap-4">
                                <div className="hidden h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-blue-50 text-blue-700 ring-1 ring-blue-100 dark:bg-blue-400/10 dark:text-blue-300 dark:ring-blue-400/20 sm:flex">
                                    <UserRoundCog size={28} />
                                </div>

                                <div>
                                    <h1 className={`text-2xl font-extrabold tracking-tight sm:text-3xl ${headingText}`}>
                                        Roles &amp; Access
                                    </h1>

                                    <p className={`mt-2 max-w-2xl text-sm leading-6 sm:text-base ${mutedText}`}>
                                        Organize your team, define user roles,
                                        and manage access across your ERP.
                                    </p>
                                </div>
                            </div>

                            <div className="mt-5 flex flex-wrap gap-2">
                                <span className="inline-flex items-center gap-2 rounded-full border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-800 dark:border-blue-400/25 dark:bg-blue-400/10 dark:text-blue-300">
                                    <LockKeyhole size={13} />
                                    Protected system roles
                                </span>

                                <span className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-800 dark:border-emerald-400/25 dark:bg-emerald-400/10 dark:text-emerald-300">
                                    <Fingerprint size={13} />
                                    Role administration
                                </span>
                            </div>
                        </div>

                        <div className="flex shrink-0 flex-col gap-3 sm:flex-row">
                            <button
                                type="button"
                                onClick={() => loadRoles(true)}
                                disabled={loading || refreshing}
                                className={refreshButtonClass}
                            >
                                <RefreshCw
                                    size={17}
                                    className={refreshing ? "animate-spin" : ""}
                                />
                                Refresh
                            </button>

                            {!showForm && canCreate && (
                                <button
                                    type="button"
                                    onClick={openCreate}
                                    className={`${primaryButton} px-5 py-3`}
                                >
                                    <Plus size={19} />
                                    Create new role
                                    <ArrowUpRight size={16} />
                                </button>
                            )}
                        </div>
                    </div>
                </section>

                {/* Notifications */}
                {message && (
                    <Notice
                        type="success"
                        onDismiss={() => setMessage("")}
                    >
                        {message}
                    </Notice>
                )}

                {error && (
                    <Notice type="error" onDismiss={() => setError("")}>
                        <div className="flex flex-wrap items-center justify-between gap-3">
                            <span>{error}</span>

                            {!showForm && (
                                <button
                                    type="button"
                                    onClick={() => loadRoles(true)}
                                    className="inline-flex items-center gap-1 font-bold underline underline-offset-2"
                                >
                                    <RotateCcw size={14} />
                                    Try again
                                </button>
                            )}
                        </div>
                    </Notice>
                )}

                {/* Statistics */}
                <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                    <StatCard
                        icon={ShieldCheck}
                        label="Total roles"
                        value={loading ? "—" : stats.total}
                        description="All available role definitions"
                        accent="blue"
                    />

                    <StatCard
                        icon={Shield}
                        label="System roles"
                        value={loading ? "—" : stats.system}
                        description="Built-in protected roles"
                        accent="sky"
                    />

                    <StatCard
                        icon={Sparkles}
                        label="Custom roles"
                        value={loading ? "—" : stats.custom}
                        description="Roles created for your workflow"
                        accent="green"
                    />

                    <StatCard
                        icon={Users}
                        label="Role assignments"
                        value={loading ? "—" : stats.users}
                        description="Sum of users assigned across roles"
                        accent="teal"
                    />
                </section>

                {/* Permission summary */}
                <section className={`${panelClass} p-4 sm:p-5`}>
                    <div className="mb-4 flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-700 dark:bg-blue-400/10 dark:text-blue-300">
                            <LockKeyhole size={19} />
                        </div>

                        <div>
                            <h2 className={`font-bold ${headingText}`}>
                                Your role permissions
                            </h2>
                            <p className={`mt-1 text-xs ${mutedText}`}>
                                Available actions for role management
                            </p>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                        {[
                            { key: "view", label: "View", allowed: canView },
                            { key: "create", label: "Create", allowed: canCreate },
                            { key: "update", label: "Edit", allowed: canEdit },
                            { key: "delete", label: "Delete", allowed: canDelete },
                        ].map((item) => (
                            <div
                                key={item.key}
                                className={`flex items-center gap-2 rounded-xl border p-3 ${
                                    item.allowed
                                        ? "border-emerald-200 bg-emerald-50/70 dark:border-emerald-400/20 dark:bg-emerald-400/[0.06]"
                                        : "border-[var(--erp-border)] bg-[var(--erp-page)]/60"
                                }`}
                            >
                                {item.allowed ? (
                                    <CheckCircle2
                                        size={17}
                                        className="shrink-0 text-emerald-600 dark:text-emerald-400"
                                    />
                                ) : (
                                    <Ban
                                        size={17}
                                        className="shrink-0 text-[var(--erp-muted)]"
                                    />
                                )}

                                <span className={`text-sm font-semibold ${
                                    item.allowed
                                        ? "text-emerald-800 dark:text-emerald-300"
                                        : mutedText
                                }`}>
                                    {item.label}
                                </span>
                            </div>
                        ))}
                    </div>
                </section>

                {/* Create / Edit form */}
                {showForm && (
                    <section className={`${panelClass} overflow-hidden`}>
                        <div className="flex items-start justify-between gap-4 border-b border-[var(--erp-border)] bg-blue-50/60 px-5 py-5 dark:bg-blue-400/[0.05] sm:px-7">
                            <div className="flex items-start gap-3">
                                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-blue-100 text-blue-700 dark:bg-blue-400/10 dark:text-blue-300">
                                    {editingRole ? (
                                        <Pencil size={22} />
                                    ) : (
                                        <Plus size={23} />
                                    )}
                                </div>

                                <div>
                                    <h2 className={`text-xl font-bold ${headingText}`}>
                                        {editingRole
                                            ? "Edit role"
                                            : "Create a new role"}
                                    </h2>

                                    <p className={`mt-1 text-sm leading-6 ${mutedText}`}>
                                        {editingRole
                                            ? "Update the name or description of this custom role."
                                            : "Create a custom role for your team's responsibilities."}
                                    </p>
                                </div>
                            </div>

                            <button
                                type="button"
                                onClick={closeForm}
                                disabled={saving}
                                aria-label="Close form"
                                className="rounded-xl border border-[var(--erp-border)] bg-[var(--erp-surface)] p-2.5 text-[var(--erp-muted)] transition hover:border-blue-300 hover:text-blue-700 disabled:opacity-50"
                            >
                                <X size={19} />
                            </button>
                        </div>

                        <form onSubmit={submitForm}>
                            <div className="grid gap-6 p-5 sm:p-7 lg:grid-cols-[minmax(0,1fr)_280px]">
                                <div className="space-y-5">
                                    <div>
                                        <FieldLabel htmlFor="roleName" required>
                                            Role name
                                        </FieldLabel>

                                        <div className="relative">
                                            <Shield
                                                size={18}
                                                className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[var(--erp-muted)]"
                                            />

                                            <input
                                                id="roleName"
                                                type="text"
                                                value={roleName}
                                                onChange={(event) =>
                                                    setRoleName(event.target.value)
                                                }
                                                placeholder="e.g. SALES_MANAGER"
                                                maxLength={100}
                                                className={`${inputClass} pl-11`}
                                                autoComplete="off"
                                                required
                                            />
                                        </div>

                                        <p className={`mt-2 text-xs leading-5 ${mutedText}`}>
                                            Use a clear name that reflects this role&apos;s responsibilities.
                                        </p>
                                    </div>

                                    <div>
                                        <FieldLabel htmlFor="description">
                                            Description
                                        </FieldLabel>

                                        <div className="relative">
                                            <FileText
                                                size={18}
                                                className="pointer-events-none absolute left-4 top-4 text-[var(--erp-muted)]"
                                            />

                                            <textarea
                                                id="description"
                                                value={description}
                                                onChange={(event) =>
                                                    setDescription(event.target.value)
                                                }
                                                placeholder="Describe what this role is responsible for..."
                                                maxLength={1000}
                                                rows={5}
                                                className={`${inputClass} resize-y pl-11`}
                                            />
                                        </div>

                                        <p className={`mt-2 text-right text-xs ${mutedText}`}>
                                            {description.length}/1000 characters
                                        </p>
                                    </div>

                                    {!editingRole && (
                                        <div>
                                            <FieldLabel
                                                htmlFor="authPassword"
                                                required
                                            >
                                                Confirm your password
                                            </FieldLabel>

                                            <div className="relative">
                                                <KeyRound
                                                    size={18}
                                                    className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[var(--erp-muted)]"
                                                />

                                                <input
                                                    id="authPassword"
                                                    type="password"
                                                    value={authPassword}
                                                    onChange={(event) =>
                                                        setAuthPassword(event.target.value)
                                                    }
                                                    autoComplete="current-password"
                                                    placeholder="Enter your current account password"
                                                    className={`${inputClass} pl-11`}
                                                    required
                                                />
                                            </div>

                                            <p className={`mt-2 flex items-start gap-2 text-xs leading-5 ${mutedText}`}>
                                                <LockKeyhole
                                                    size={14}
                                                    className="mt-0.5 shrink-0"
                                                />
                                                Confirm your identity before creating a new role.
                                            </p>
                                        </div>
                                    )}
                                </div>

                                <aside className="h-fit rounded-2xl border border-blue-200/80 bg-blue-50/60 p-5 dark:border-blue-400/20 dark:bg-blue-400/[0.05]">
                                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--erp-surface)] text-blue-700 shadow-sm dark:text-blue-300">
                                        <ShieldAlert size={21} />
                                    </div>

                                    <h3 className={`mt-4 font-bold ${headingText}`}>
                                        Role management tips
                                    </h3>

                                    <ul className={`mt-4 space-y-3 text-sm leading-6 ${mutedText}`}>
                                        <li className="flex items-start gap-2">
                                            <CheckCircle2 size={16} className="mt-1 shrink-0 text-emerald-600 dark:text-emerald-400" />
                                            Choose a descriptive role name.
                                        </li>

                                        <li className="flex items-start gap-2">
                                            <CheckCircle2 size={16} className="mt-1 shrink-0 text-emerald-600 dark:text-emerald-400" />
                                            Explain the role&apos;s responsibilities.
                                        </li>

                                        <li className="flex items-start gap-2">
                                            <CheckCircle2 size={16} className="mt-1 shrink-0 text-emerald-600 dark:text-emerald-400" />
                                            Assign appropriate user rights separately.
                                        </li>
                                    </ul>

                                    <div className="mt-5 flex items-start gap-2 rounded-xl border border-blue-200/70 bg-[var(--erp-surface)] p-3 text-xs leading-5 text-[var(--erp-muted)]">
                                        <Info size={15} className="mt-0.5 shrink-0 text-blue-600 dark:text-blue-300" />
                                        Creating a role does not automatically configure its permissions.
                                    </div>
                                </aside>
                            </div>

                            <div className="flex flex-col-reverse gap-3 border-t border-[var(--erp-border)] bg-[var(--erp-page)]/50 px-5 py-4 dark:bg-white/[0.02] sm:flex-row sm:justify-end sm:px-7">
                                <button
                                    type="button"
                                    onClick={closeForm}
                                    disabled={saving}
                                    className={outlineButton}
                                >
                                    Cancel
                                </button>

                                <button
                                    type="submit"
                                    disabled={saving || (editingRole ? !canEdit : !canCreate)}
                                    className={`${primaryButton} px-6`}
                                >
                                    {saving ? (
                                        <LoaderCircle size={18} className="animate-spin" />
                                    ) : editingRole ? (
                                        <CheckCircle2 size={18} />
                                    ) : (
                                        <Plus size={19} />
                                    )}

                                    {saving
                                        ? "Saving role..."
                                        : editingRole
                                          ? "Save changes"
                                          : "Create role"}
                                </button>
                            </div>
                        </form>
                    </section>
                )}

                {/* Roles table */}
                {!showForm && (
                    <section className={`${panelClass} overflow-hidden`}>
                        <div className="flex flex-col gap-5 border-b border-[var(--erp-border)] p-5 sm:p-6 lg:flex-row lg:items-center lg:justify-between">
                            <div className="flex items-center gap-3">
                                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-700 dark:bg-blue-400/10 dark:text-blue-300">
                                    <ShieldCheck size={21} />
                                </div>

                                <div>
                                    <h2 className={`text-lg font-bold ${headingText}`}>
                                        All roles
                                    </h2>

                                    <p className={`mt-0.5 text-sm ${mutedText}`}>
                                        {loading
                                            ? "Loading your role directory..."
                                            : `${filteredRoles.length} of ${roles.length} roles shown`}
                                    </p>
                                </div>
                            </div>

                            <div className="flex flex-col gap-3 sm:flex-row">
                                <div className="relative min-w-0 sm:min-w-[240px]">
                                    <Search
                                        size={18}
                                        className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--erp-muted)]"
                                    />

                                    <input
                                        type="search"
                                        value={search}
                                        onChange={(event) => setSearch(event.target.value)}
                                        placeholder="Search roles..."
                                        aria-label="Search roles"
                                        className={`${inputClass} py-2.5 pl-10`}
                                    />
                                </div>

                                <button
                                    type="button"
                                    onClick={() => loadRoles(true)}
                                    disabled={loading || refreshing}
                                    className={refreshButtonClass}
                                >
                                    <RefreshCw
                                        size={16}
                                        className={refreshing ? "animate-spin" : ""}
                                    />
                                    Refresh
                                </button>
                            </div>
                        </div>

                        <div className="flex flex-wrap gap-2 border-b border-[var(--erp-border)] px-5 py-3 sm:px-6">
                            {filterOptions.map((option) => (
                                <button
                                    key={option.value}
                                    type="button"
                                    onClick={() => setFilter(option.value)}
                                    aria-pressed={filter === option.value}
                                    className={`rounded-xl px-4 py-2 text-sm font-semibold transition duration-200 ${
                                        filter === option.value
                                            ? "bg-[var(--erp-primary)] text-white shadow-sm"
                                            : "text-[var(--erp-muted)] hover:bg-blue-50 hover:text-blue-800 dark:hover:bg-blue-400/10 dark:hover:text-blue-300"
                                    }`}
                                >
                                    {option.label}
                                    {filter === option.value && (
                                        <span className="ml-2 rounded-full bg-white/20 px-1.5 py-0.5 text-xs">
                                            {filteredRoles.length}
                                        </span>
                                    )}
                                </button>
                            ))}
                        </div>

                        <div className="overflow-x-auto">
                            <table className="w-full min-w-[850px] text-left text-sm">
                                <thead className="bg-[var(--erp-page)]/70 text-xs uppercase tracking-wider text-[var(--erp-muted)]">
                                    <tr>
                                        <th className="px-5 py-4 font-bold">Role</th>
                                        <th className="px-5 py-4 font-bold">Description</th>
                                        <th className="px-5 py-4 font-bold">Users</th>
                                        <th className="px-5 py-4 font-bold">Type</th>
                                        <th className="px-5 py-4 text-right font-bold">Actions</th>
                                    </tr>
                                </thead>

                                <tbody className="divide-y divide-[var(--erp-border)]">
                                    {loading ? (
                                        <LoadingRows />
                                    ) : filteredRoles.length === 0 ? (
                                        <tr>
                                            <td colSpan={5} className="px-6 py-16">
                                                <div className="mx-auto flex max-w-sm flex-col items-center text-center">
                                                    <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-blue-50 text-blue-600 dark:bg-blue-400/10 dark:text-blue-300">
                                                        <Search size={28} />
                                                    </div>

                                                    <h3 className={`mt-4 text-base font-bold ${headingText}`}>
                                                        {roles.length === 0
                                                            ? "No roles created yet"
                                                            : "No matching roles"}
                                                    </h3>

                                                    <p className={`mt-2 text-sm leading-6 ${mutedText}`}>
                                                        {roles.length === 0
                                                            ? "There are no roles to display."
                                                            : "Try another search term or change the selected filter."}
                                                    </p>

                                                    {roles.length === 0 && canCreate ? (
                                                        <button
                                                            type="button"
                                                            onClick={openCreate}
                                                            className={`${primaryButton} mt-5`}
                                                        >
                                                            <Plus size={17} />
                                                            Create first role
                                                        </button>
                                                    ) : (
                                                        roles.length > 0 && (
                                                            <button
                                                                type="button"
                                                                onClick={clearFilters}
                                                                className={`${outlineButton} mt-5`}
                                                            >
                                                                <RotateCcw size={15} />
                                                                Clear filters
                                                            </button>
                                                        )
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    ) : (
                                        filteredRoles.map((role) => {
                                            const system = Boolean(role.is_system_role);
                                            const userCount = Number(role.user_count) || 0;

                                            return (
                                                <tr
                                                    key={role.role_id}
                                                    className="group transition-colors hover:bg-blue-50/50 dark:hover:bg-blue-400/[0.04]"
                                                >
                                                    <td className="px-5 py-5">
                                                        <div className="flex items-center gap-3">
                                                            <div
                                                                className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${
                                                                    system
                                                                        ? "bg-blue-50 text-blue-700 dark:bg-blue-400/10 dark:text-blue-300"
                                                                        : "bg-emerald-50 text-emerald-700 dark:bg-emerald-400/10 dark:text-emerald-300"
                                                                }`}
                                                            >
                                                                {system ? (
                                                                    <ShieldCheck size={21} />
                                                                ) : (
                                                                    <Shield size={21} />
                                                                )}
                                                            </div>

                                                            <div className="min-w-0">
                                                                <p className={`font-bold ${headingText}`}>
                                                                    {role.role_name}
                                                                </p>

                                                                <p className={`mt-1 text-xs ${mutedText}`}>
                                                                    Role ID: {role.role_id}
                                                                </p>
                                                            </div>
                                                        </div>
                                                    </td>

                                                    <td className="max-w-[300px] px-5 py-5">
                                                        <p className="line-clamp-2 leading-6 text-[var(--erp-muted)]">
                                                            {role.description || "No description provided"}
                                                        </p>
                                                    </td>

                                                    <td className="px-5 py-5">
                                                        <div className="inline-flex items-center gap-2 rounded-xl border border-[var(--erp-border)] bg-[var(--erp-page)]/60 px-3 py-2">
                                                            <Users size={16} className="text-[var(--erp-muted)]" />
                                                            <span className={`font-bold tabular-nums ${headingText}`}>
                                                                {userCount}
                                                            </span>
                                                        </div>
                                                    </td>

                                                    <td className="px-5 py-5">
                                                        <RoleBadge system={system} />
                                                    </td>

                                                    <td className="px-5 py-5">
                                                        <div className="flex justify-end gap-2">
                                                            {system ? (
                                                                <span className="inline-flex items-center gap-1.5 rounded-xl border border-[var(--erp-border)] bg-[var(--erp-page)]/70 px-3 py-2 text-xs font-semibold text-[var(--erp-muted)]">
                                                                    <LockKeyhole size={14} />
                                                                    Protected
                                                                </span>
                                                            ) : (
                                                                <>
                                                                    {canEdit && (
                                                                        <button
                                                                            type="button"
                                                                            onClick={() => openEdit(role)}
                                                                            title={`Edit ${role.role_name}`}
                                                                            aria-label={`Edit ${role.role_name}`}
                                                                            className="inline-flex items-center gap-1.5 rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 text-xs font-bold text-blue-700 transition hover:-translate-y-0.5 hover:border-blue-300 hover:bg-blue-100 hover:shadow-sm dark:border-blue-400/25 dark:bg-blue-400/10 dark:text-blue-300 dark:hover:bg-blue-400/20"
                                                                        >
                                                                            <Pencil size={14} />
                                                                            Edit
                                                                        </button>
                                                                    )}

                                                                    {canDelete && (
                                                                        <button
                                                                            type="button"
                                                                            onClick={() => setDeleteTarget(role)}
                                                                            disabled={deletingId !== null}
                                                                            title={`Delete ${role.role_name}`}
                                                                            aria-label={`Delete ${role.role_name}`}
                                                                            className="inline-flex items-center gap-1.5 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-bold text-rose-700 transition hover:-translate-y-0.5 hover:border-rose-300 hover:bg-rose-100 hover:shadow-sm disabled:opacity-50 dark:border-rose-400/25 dark:bg-rose-400/10 dark:text-rose-300 dark:hover:bg-rose-400/20"
                                                                        >
                                                                            <Trash2 size={14} />
                                                                            Delete
                                                                        </button>
                                                                    )}

                                                                    {!canEdit && !canDelete && (
                                                                        <span className="inline-flex items-center gap-1.5 rounded-xl border border-[var(--erp-border)] bg-[var(--erp-page)]/70 px-3 py-2 text-xs font-semibold text-[var(--erp-muted)]">
                                                                            <Eye size={14} />
                                                                            View only
                                                                        </span>
                                                                    )}
                                                                </>
                                                            )}
                                                        </div>
                                                    </td>
                                                </tr>
                                            );
                                        })
                                    )}
                                </tbody>
                            </table>
                        </div>

                        {!loading && roles.length > 0 && (
                            <div className="flex flex-col gap-2 border-t border-[var(--erp-border)] bg-[var(--erp-page)]/50 px-5 py-4 text-xs text-[var(--erp-muted)] sm:flex-row sm:items-center sm:justify-between sm:px-6">
                                <span>
                                    Showing {filteredRoles.length} of {roles.length} roles
                                </span>

                                <span className="inline-flex items-center gap-1.5">
                                    <LockKeyhole size={13} className="text-blue-600 dark:text-blue-300" />
                                    System roles are protected.
                                </span>
                            </div>
                        )}
                    </section>
                )}

                {/* Delete confirmation dialog */}
                {deleteTarget && canDelete && (
                    <div
                        className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-sm dark:bg-black/70"
                        onMouseDown={(event) => {
                            if (
                                event.target === event.currentTarget &&
                                deletingId === null
                            ) {
                                setDeleteTarget(null);
                            }
                        }}
                    >
                        <div
                            role="dialog"
                            aria-modal="true"
                            aria-labelledby="delete-role-title"
                            className="w-full max-w-md overflow-hidden rounded-2xl border border-[var(--erp-border)] bg-[var(--erp-surface)] shadow-2xl"
                        >
                            <div className="p-6 sm:p-7">
                                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-rose-50 text-rose-600 ring-1 ring-rose-100 dark:bg-rose-400/10 dark:text-rose-300 dark:ring-rose-400/20">
                                    <Trash2 size={25} />
                                </div>

                                <h2
                                    id="delete-role-title"
                                    className={`mt-5 text-xl font-extrabold ${headingText}`}
                                >
                                    Delete this role?
                                </h2>

                                <p className={`mt-2 text-sm leading-6 ${mutedText}`}>
                                    You are about to delete{" "}
                                    <strong className={headingText}>
                                        {deleteTarget.role_name}
                                    </strong>
                                    . This action may be blocked if the role is
                                    still assigned to users or protected by
                                    server rules.
                                </p>

                                <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs leading-5 text-amber-800 dark:border-amber-400/25 dark:bg-amber-400/10 dark:text-amber-200">
                                    Check user assignments and permissions
                                    before continuing. This operation may not
                                    be reversible.
                                </div>
                            </div>

                            <div className="flex flex-col-reverse gap-3 border-t border-[var(--erp-border)] bg-[var(--erp-page)]/50 p-5 sm:flex-row sm:justify-end">
                                <button
                                    type="button"
                                    onClick={() => setDeleteTarget(null)}
                                    disabled={deletingId !== null}
                                    className={outlineButton}
                                >
                                    Cancel
                                </button>

                                <button
                                    type="button"
                                    onClick={deleteRole}
                                    disabled={deletingId !== null}
                                    className={`${buttonBase} bg-rose-600 text-white shadow-sm hover:bg-rose-700 hover:shadow-md focus:ring-rose-500/20`}
                                >
                                    {deletingId !== null ? (
                                        <LoaderCircle size={17} className="animate-spin" />
                                    ) : (
                                        <Trash2 size={17} />
                                    )}

                                    {deletingId !== null
                                        ? "Deleting..."
                                        : "Delete role"}
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
