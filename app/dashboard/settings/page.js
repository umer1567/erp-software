
"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
    ArrowLeft,
    Building2,
    MapPin,
    Wallet,
    LoaderCircle,
    Save,
    AlertCircle,
    CheckCircle2,
    Upload,
    X,
    Mail,
    Phone,
    Globe2,
    MapPinned,
    ImagePlus,
    Sparkles,
    ShieldCheck,
    ChevronRight,
    Eye,
    Pencil,
    LockKeyhole,
} from "lucide-react";

const MAX_LOGO_SIZE = 2 * 1024 * 1024;

const ALLOWED_LOGO_TYPES = [
    "image/png",
    "image/jpeg",
    "image/webp",
];

const INITIAL_FORM = {
    companyName: "",
    phone: "",
    email: "",
    country: "Pakistan",
    stateProvince: "",
    city: "",
    address: "",
    currency: "PKR",
};

const INITIAL_PERMISSIONS = {
    canView: false,
    canCreate: false,
    canUpdate: false,
    canDelete: false,
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

function normalizeSettings(settings = {}) {
    return {
        companyName: settings.company_name || "",
        phone: settings.phone || "",
        email: settings.email || "",
        country: settings.country || "Pakistan",
        stateProvince:
            settings.state_province || settings.province || "",
        city: settings.city || "",
        address: settings.address || "",
        currency: settings.currency || "PKR",
    };
}

function normalizePermissions(permissions = {}) {
    return {
        canView: permissions.canView === true,
        canCreate: permissions.canCreate === true,
        canUpdate: permissions.canUpdate === true,
        canDelete: permissions.canDelete === true,
    };
}

function SectionHeading({ icon: Icon, title, description }) {
    return (
        <div className="mb-6 flex items-start gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border erp-border bg-[var(--erp-blue-light)] text-[var(--erp-primary)]">
                <Icon size={21} />
            </div>

            <div className="min-w-0">
                <h2 className="text-base font-bold tracking-tight text-[var(--erp-text)] sm:text-lg">
                    {title}
                </h2>

                {description && (
                    <p className="mt-1 text-sm leading-6 text-[var(--erp-muted)]">
                        {description}
                    </p>
                )}
            </div>
        </div>
    );
}

function Field({
    label,
    id,
    icon: Icon,
    hint,
    className = "",
    children,
}) {
    return (
        <div className={className}>
            <label
                htmlFor={id}
                className="mb-2 flex items-center gap-2 text-sm font-semibold text-[var(--erp-text)]"
            >
                {Icon && (
                    <Icon
                        size={15}
                        className="text-[var(--erp-muted)]"
                    />
                )}

                {label}
            </label>

            {children}

            {hint && (
                <p className="mt-1.5 text-xs leading-5 text-[var(--erp-muted)]">
                    {hint}
                </p>
            )}
        </div>
    );
}

const inputClass =
    "erp-input w-full min-w-0 rounded-xl px-3.5 py-3 text-sm transition disabled:cursor-not-allowed disabled:opacity-70";

function Notice({ type, children, onDismiss }) {
    const success = type === "success";
    const Icon = success ? CheckCircle2 : AlertCircle;

    return (
        <div
            role={success ? "status" : "alert"}
            className={`flex items-start gap-3 rounded-xl border p-4 ${
                success
                    ? "border-green-300 bg-green-50 text-green-800"
                    : "border-red-300 bg-red-50 text-red-800"
            }`}
        >
            <Icon size={19} className="mt-0.5 shrink-0" />

            <p className="flex-1 text-sm leading-6">{children}</p>

            {onDismiss && (
                <button
                    type="button"
                    onClick={onDismiss}
                    className="rounded-lg p-1 opacity-70 transition hover:bg-black/5 hover:opacity-100"
                    aria-label="Dismiss notification"
                >
                    <X size={16} />
                </button>
            )}
        </div>
    );
}

function PermissionStatus({ permissions }) {
    const items = [
        {
            label: "View",
            allowed: permissions.canView,
            icon: Eye,
        },
        {
            label: "Edit",
            allowed: permissions.canUpdate,
            icon: Pencil,
        },
        {
            label: "Delete logo",
            allowed: permissions.canDelete,
            icon: LockKeyhole,
        },
    ];

    return (
        <div className="flex flex-wrap gap-2">
            {items.map(({ label, allowed, icon: Icon }) => (
                <span
                    key={label}
                    className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold ${
                        allowed
                            ? "border-green-200 bg-green-50 text-green-800"
                            : "border-[var(--erp-border)] bg-[var(--erp-page)] text-[var(--erp-muted)]"
                    }`}
                >
                    <Icon size={13} />
                    {label}: {allowed ? "Allowed" : "Denied"}
                </span>
            ))}
        </div>
    );
}

export default function SettingsPage() {
    const fileInputRef = useRef(null);
    const previewUrlRef = useRef("");

    const [form, setForm] = useState(INITIAL_FORM);
    const [permissions, setPermissions] = useState(INITIAL_PERMISSIONS);

    const [logoFile, setLogoFile] = useState(null);
    const [logoPreview, setLogoPreview] = useState("");
    const [originalLogo, setOriginalLogo] = useState("");
    const [logoLoadError, setLogoLoadError] = useState(false);

    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [removingLogo, setRemovingLogo] = useState(false);

    const [error, setError] = useState("");
    const [message, setMessage] = useState("");

    const canView = permissions.canView;
    const canUpdate = permissions.canUpdate;
    const canDelete = permissions.canDelete;

    const busy = saving || removingLogo;

    const releasePreviewUrl = useCallback(() => {
        if (previewUrlRef.current) {
            URL.revokeObjectURL(previewUrlRef.current);
            previewUrlRef.current = "";
        }
    }, []);

    const applySettings = useCallback(
        (settings = {}) => {
            setForm(normalizeSettings(settings));

            const savedLogo = settings.logo_url || "";

            releasePreviewUrl();

            setOriginalLogo(savedLogo);
            setLogoPreview(savedLogo);
            setLogoFile(null);
            setLogoLoadError(false);

            if (fileInputRef.current) {
                fileInputRef.current.value = "";
            }
        },
        [releasePreviewUrl]
    );

    const applyPermissions = useCallback((nextPermissions) => {
        setPermissions(
            normalizePermissions(nextPermissions)
        );
    }, []);

    const loadSettings = useCallback(async (signal) => {
        const response = await fetch("/api/settings", {
            method: "GET",
            cache: "no-store",
            signal,
        });

        const data = await readResponse(response);

        if (!response.ok || !data.success) {
            if (data.permissions) {
                applyPermissions(data.permissions);
            }

            throw new Error(
                data.message || "Failed to load company settings."
            );
        }

        applyPermissions(data.permissions || {});
        applySettings(data.settings || {});
    }, [applyPermissions, applySettings]);

    useEffect(() => {
        const controller = new AbortController();

        async function initializeSettings() {
            try {
                await loadSettings(controller.signal);
            } catch (err) {
                if (err?.name === "AbortError") {
                    return;
                }

                setError(
                    getErrorMessage(
                        err,
                        "Unable to load company settings."
                    )
                );
            } finally {
                if (!controller.signal.aborted) {
                    setLoading(false);
                }
            }
        }

        initializeSettings();

        return () => {
            controller.abort();
            releasePreviewUrl();
        };
    }, [loadSettings, releasePreviewUrl]);

    function updateField(field, value) {
        if (!canUpdate || busy) {
            return;
        }

        setForm((previous) => ({
            ...previous,
            [field]: value,
        }));

        setError("");
        setMessage("");
    }

    function handleLogoChange(event) {
        if (!canUpdate || busy) {
            event.target.value = "";
            return;
        }

        const file = event.target.files?.[0];

        if (!file) {
            return;
        }

        setError("");
        setMessage("");

        if (!ALLOWED_LOGO_TYPES.includes(file.type)) {
            setError("Choose a PNG, JPG, or WebP company logo.");
            event.target.value = "";
            return;
        }

        if (file.size === 0) {
            setError("The selected image is empty.");
            event.target.value = "";
            return;
        }

        if (file.size > MAX_LOGO_SIZE) {
            setError("Company logo must be 2 MB or smaller.");
            event.target.value = "";
            return;
        }

        releasePreviewUrl();

        const previewUrl = URL.createObjectURL(file);
        previewUrlRef.current = previewUrl;

        setLogoFile(file);
        setLogoPreview(previewUrl);
        setLogoLoadError(false);
    }

    async function removeLogo() {
        if (!canDelete || busy || !logoPreview) {
            return;
        }

        const confirmed = window.confirm(
            "Are you sure you want to remove the company logo?"
        );

        if (!confirmed) {
            return;
        }

        setError("");
        setMessage("");
        setRemovingLogo(true);

        try {
            const response = await fetch("/api/settings", {
                method: "DELETE",
                cache: "no-store",
            });

            const data = await readResponse(response);

            if (data.permissions) {
                applyPermissions(data.permissions);
            }

            if (!response.ok || !data.success) {
                throw new Error(
                    data.message || "Failed to remove company logo."
                );
            }

            releasePreviewUrl();

            setLogoFile(null);
            setLogoPreview("");
            setOriginalLogo("");
            setLogoLoadError(false);

            if (fileInputRef.current) {
                fileInputRef.current.value = "";
            }

            setMessage(
                data.message || "Company logo removed successfully."
            );
        } catch (err) {
            setError(
                getErrorMessage(
                    err,
                    "Unable to remove company logo."
                )
            );
        } finally {
            setRemovingLogo(false);
        }
    }

    async function saveSettings(event) {
        event.preventDefault();

        if (!canUpdate) {
            setError(
                "You do not have permission to edit company settings."
            );
            return;
        }

        if (busy) {
            return;
        }

        setError("");
        setMessage("");

        if (!form.companyName.trim()) {
            setError("Company name is required.");
            return;
        }

        if (
            form.email.trim() &&
            !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
                form.email.trim()
            )
        ) {
            setError(
                "Please enter a valid company email address."
            );
            return;
        }

        const body = new FormData();

        body.append("companyName", form.companyName.trim());
        body.append("phone", form.phone.trim());
        body.append("email", form.email.trim());
        body.append("country", form.country.trim());
        body.append("stateProvince", form.stateProvince.trim());
        body.append("city", form.city.trim());
        body.append("address", form.address.trim());
        body.append("currency", form.currency);

        if (logoFile) {
            body.append(
                "companyLogo",
                logoFile,
                logoFile.name
            );
        }

        setSaving(true);

        try {
            const response = await fetch("/api/settings", {
                method: "PUT",
                body,
                cache: "no-store",
            });

            const data = await readResponse(response);

            if (data.permissions) {
                applyPermissions(data.permissions);
            }

            if (!response.ok || !data.success) {
                throw new Error(
                    data.message || "Failed to save company settings."
                );
            }

            applySettings(data.settings || {});

            setMessage(
                data.settings?.logo_url
                    ? "Company information and logo saved successfully."
                    : "Company settings saved successfully."
            );
        } catch (err) {
            setError(
                getErrorMessage(
                    err,
                    "Unable to save company settings."
                )
            );
        } finally {
            setSaving(false);
        }
    }

    if (loading) {
        return (
            <div className="erp-page-gradient flex min-h-[55vh] items-center justify-center p-6">
                <div className="erp-card flex items-center gap-3 px-6 py-5">
                    <LoaderCircle
                        size={22}
                        className="animate-spin text-[var(--erp-primary)]"
                    />

                    <span className="text-sm font-medium text-[var(--erp-text)]">
                        Loading company settings...
                    </span>
                </div>
            </div>
        );
    }

    if (!canView) {
        return (
            <main className="erp-page-gradient min-h-full">
                <div className="mx-auto flex w-full max-w-4xl flex-col justify-center p-4 sm:p-6 lg:p-8">
                    <div className="erp-card overflow-hidden">
                        <div className="h-1.5 bg-red-500" />

                        <div className="p-6 text-center sm:p-10">
                            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl border border-red-200 bg-red-50 text-red-600">
                                <LockKeyhole size={30} />
                            </div>

                            <h1 className="mt-5 text-2xl font-extrabold text-[var(--erp-text)]">
                                Access denied
                            </h1>

                            <p className="mx-auto mt-3 max-w-lg text-sm leading-6 text-[var(--erp-muted)]">
                                You do not have permission to view Company
                                Settings. Contact your administrator to
                                request the required View permission.
                            </p>

                            {error && (
                                <div className="mt-5 text-left">
                                    <Notice type="error">
                                        {error}
                                    </Notice>
                                </div>
                            )}

                            <div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row">
                                <Link
                                    href="/dashboard"
                                    className="erp-button justify-center"
                                >
                                    <ArrowLeft size={17} />
                                    Back to Dashboard
                                </Link>

                                <button
                                    type="button"
                                    onClick={() => window.location.reload()}
                                    className="inline-flex items-center justify-center gap-2 rounded-xl border erp-border px-4 py-3 text-sm font-semibold text-[var(--erp-text)] transition hover:bg-[var(--erp-page)]"
                                >
                                    <LoaderCircle size={16} />
                                    Refresh permissions
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </main>
        );
    }

    return (
        <main className="erp-page-gradient min-h-full">
            <div className="mx-auto w-full max-w-6xl space-y-6 p-4 sm:p-6 lg:p-8">
                {/* Page heading */}
                <div className="relative overflow-hidden rounded-2xl border erp-border bg-[var(--erp-surface)] p-5 shadow-[var(--erp-shadow)] sm:p-7">
                    <div className="pointer-events-none absolute -right-12 -top-16 h-48 w-48 rounded-full bg-[var(--erp-blue-light)] opacity-70 blur-3xl" />

                    <div className="relative">
                        <Link
                            href="/dashboard"
                            className="mb-5 inline-flex items-center gap-2 text-sm font-medium text-[var(--erp-muted)] transition hover:text-[var(--erp-primary)]"
                        >
                            <ArrowLeft size={16} />
                            Back to Dashboard
                        </Link>

                        <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
                            <div className="flex items-start gap-4">
                                <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-[var(--erp-primary)] text-white shadow-lg">
                                    <Building2 size={27} />
                                </div>

                                <div className="min-w-0">
                                    <div className="mb-2 flex flex-wrap items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-[var(--erp-muted)]">
                                        <span>Administration</span>
                                        <ChevronRight size={13} />
                                        <span className="text-[var(--erp-primary)]">
                                            Settings
                                        </span>
                                    </div>

                                    <h1 className="text-2xl font-extrabold tracking-tight text-[var(--erp-text)] sm:text-3xl">
                                        Company Settings
                                    </h1>

                                    <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--erp-muted)] sm:text-base">
                                        Manage your company identity, contact details,
                                        business location, and financial preferences.
                                    </p>
                                </div>
                            </div>

                            <div className="flex w-fit items-center gap-2 rounded-full border erp-border bg-[var(--erp-page)] px-3.5 py-2 text-xs font-semibold text-[var(--erp-muted)]">
                                <ShieldCheck
                                    size={16}
                                    className="text-[var(--erp-green)]"
                                />
                                Company profile
                            </div>
                        </div>

                        {/* User Rights status */}
                        <div className="mt-6 border-t erp-border pt-5">
                            <div className="mb-3 flex items-center gap-2 text-sm font-bold text-[var(--erp-text)]">
                                <ShieldCheck
                                    size={17}
                                    className="text-[var(--erp-primary)]"
                                />
                                Your User Rights
                            </div>

                            <PermissionStatus permissions={permissions} />

                            {!canUpdate && (
                                <p className="mt-3 text-xs leading-5 text-[var(--erp-muted)]">
                                    You can view company information, but editing
                                    and saving are disabled for your role.
                                </p>
                            )}
                        </div>
                    </div>
                </div>

                {/* Notifications */}
                {error && (
                    <Notice
                        type="error"
                        onDismiss={() => setError("")}
                    >
                        {error}
                    </Notice>
                )}

                {message && (
                    <Notice
                        type="success"
                        onDismiss={() => setMessage("")}
                    >
                        {message}
                    </Notice>
                )}

                <form onSubmit={saveSettings} className="space-y-6">
                    {/* Logo */}
                    <section className="erp-card overflow-hidden">
                        <div className="erp-card-header">
                            <SectionHeading
                                icon={ImagePlus}
                                title="Company branding"
                                description="Upload the logo that represents your business throughout the ERP."
                            />
                        </div>

                        <div className="erp-card-body">
                            <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
                                {/* Logo preview */}
                                <div className="flex min-w-0 flex-col">
                                    <div
                                        className="relative isolate h-64 w-full overflow-hidden rounded-xl border erp-border sm:h-80"
                                        style={{
                                            padding: 0,
                                            margin: 0,
                                            background: "#ffffff",
                                        }}
                                    >
                                        {logoPreview && !logoLoadError ? (
                                            <img
                                                key={logoPreview}
                                                src={logoPreview}
                                                alt="Company logo preview"
                                                onError={() =>
                                                    setLogoLoadError(true)
                                                }
                                                onLoad={() =>
                                                    setLogoLoadError(false)
                                                }
                                                className="absolute inset-0 block h-full w-full"
                                                style={{
                                                    maxWidth: "none",
                                                    maxHeight: "none",
                                                    objectFit: "fill",
                                                    objectPosition: "center",
                                                }}
                                            />
                                        ) : (
                                            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-gray-500">
                                                <Building2
                                                    size={42}
                                                    strokeWidth={1.4}
                                                />
                                                <span className="text-xs font-medium">
                                                    {logoLoadError
                                                        ? "Image unavailable"
                                                        : "No logo uploaded"}
                                                </span>
                                            </div>
                                        )}

                                        {logoPreview && canDelete && (
                                            <button
                                                type="button"
                                                onClick={removeLogo}
                                                disabled={busy}
                                                title="Remove company logo"
                                                aria-label="Remove company logo"
                                                className="absolute right-3 top-3 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-red-600 text-white shadow-md transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
                                            >
                                                {removingLogo ? (
                                                    <LoaderCircle
                                                        size={17}
                                                        className="animate-spin"
                                                    />
                                                ) : (
                                                    <X size={17} />
                                                )}
                                            </button>
                                        )}
                                    </div>

                                    <p className="mt-3 break-words text-center text-sm font-semibold text-[var(--erp-text)]">
                                        {form.companyName || "Your company"}
                                    </p>

                                    <p className="mt-1 text-center text-xs text-[var(--erp-muted)]">
                                        Logo preview
                                    </p>
                                </div>

                                {/* Upload controls */}
                                <div className="flex min-w-0 flex-col justify-center">
                                    <div className="rounded-2xl border border-dashed erp-border bg-[var(--erp-page)] p-5 sm:p-6">
                                        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[var(--erp-blue-light)] text-[var(--erp-primary)]">
                                            <Upload size={23} />
                                        </div>

                                        <h3 className="mt-4 text-base font-bold text-[var(--erp-text)]">
                                            Upload your company logo
                                        </h3>

                                        <p className="mt-2 max-w-xl text-sm leading-6 text-[var(--erp-muted)]">
                                            Choose a PNG, JPG, or WebP image
                                            from your computer. The preview
                                            fills the available display area.
                                        </p>

                                        {canUpdate ? (
                                            <div className="mt-4 flex flex-wrap items-center gap-3">
                                                <button
                                                    type="button"
                                                    onClick={() =>
                                                        fileInputRef.current?.click()
                                                    }
                                                    disabled={busy}
                                                    className="erp-button disabled:cursor-not-allowed disabled:opacity-60"
                                                >
                                                    <Upload size={17} />
                                                    {logoFile
                                                        ? "Change logo"
                                                        : "Choose image"}
                                                </button>
                                            </div>
                                        ) : (
                                            <p className="mt-4 rounded-xl border erp-border bg-[var(--erp-surface)] p-3 text-sm text-[var(--erp-muted)]">
                                                You do not have Edit permission
                                                to upload or replace the logo.
                                            </p>
                                        )}

                                        <input
                                            ref={fileInputRef}
                                            type="file"
                                            accept="image/png,image/jpeg,image/webp"
                                            onChange={handleLogoChange}
                                            disabled={!canUpdate || busy}
                                            className="hidden"
                                        />

                                        {logoFile && (
                                            <div className="mt-4 flex items-start gap-3 rounded-xl border erp-border bg-[var(--erp-surface)] p-3">
                                                <ImagePlus
                                                    size={18}
                                                    className="mt-0.5 shrink-0 text-[var(--erp-primary)]"
                                                />

                                                <div className="min-w-0 flex-1">
                                                    <p className="break-all text-sm font-semibold text-[var(--erp-text)]">
                                                        {logoFile.name}
                                                    </p>

                                                    <p className="mt-1 text-xs text-[var(--erp-muted)]">
                                                        {(logoFile.size / 1024).toFixed(1)} KB
                                                    </p>
                                                </div>
                                            </div>
                                        )}

                                        <div className="mt-5 flex flex-wrap gap-2">
                                            {["PNG", "JPG", "WebP"].map((type) => (
                                                <span
                                                    key={type}
                                                    className="rounded-md border erp-border bg-[var(--erp-surface)] px-2.5 py-1 text-[11px] font-bold text-[var(--erp-muted)]"
                                                >
                                                    {type}
                                                </span>
                                            ))}

                                            <span className="rounded-md border erp-border bg-[var(--erp-surface)] px-2.5 py-1 text-[11px] font-semibold text-[var(--erp-muted)]">
                                                Maximum 2 MB
                                            </span>
                                        </div>
                                    </div>

                                    {logoPreview && canDelete && (
                                        <p className="mt-3 text-xs leading-5 text-[var(--erp-muted)]">
                                            Use the X button on the preview to
                                            remove the saved logo.
                                        </p>
                                    )}

                                    {logoLoadError &&
                                        originalLogo &&
                                        !logoFile && (
                                            <p className="mt-3 text-sm text-red-600">
                                                The saved logo could not be
                                                loaded. Check that the image
                                                exists at its saved URL.
                                            </p>
                                        )}
                                </div>
                            </div>
                        </div>
                    </section>

                    {/* Company details */}
                    <section className="erp-card">
                        <div className="erp-card-header">
                            <SectionHeading
                                icon={Building2}
                                title="Company information"
                                description="The primary details used to identify your business."
                            />
                        </div>

                        <div className="erp-card-body">
                            <div className="grid gap-5 md:grid-cols-2">
                                <Field
                                    id="companyName"
                                    label="Company name *"
                                    icon={Building2}
                                    className="md:col-span-2"
                                >
                                    <input
                                        id="companyName"
                                        value={form.companyName}
                                        onChange={(e) =>
                                            updateField(
                                                "companyName",
                                                e.target.value
                                            )
                                        }
                                        disabled={!canUpdate || busy}
                                        className={inputClass}
                                        placeholder="Enter your registered company name"
                                        maxLength={150}
                                        autoComplete="organization"
                                        required
                                    />
                                </Field>

                                <Field
                                    id="phone"
                                    label="Phone number"
                                    icon={Phone}
                                    hint="Include your country code when applicable."
                                >
                                    <input
                                        id="phone"
                                        type="tel"
                                        value={form.phone}
                                        onChange={(e) =>
                                            updateField(
                                                "phone",
                                                e.target.value
                                            )
                                        }
                                        disabled={!canUpdate || busy}
                                        className={inputClass}
                                        placeholder="+92 300 1234567"
                                        maxLength={50}
                                        autoComplete="tel"
                                    />
                                </Field>

                                <Field
                                    id="email"
                                    label="Company email"
                                    icon={Mail}
                                    hint="Used as your company's contact email."
                                >
                                    <input
                                        id="email"
                                        type="email"
                                        value={form.email}
                                        onChange={(e) =>
                                            updateField(
                                                "email",
                                                e.target.value
                                            )
                                        }
                                        disabled={!canUpdate || busy}
                                        className={inputClass}
                                        placeholder="company@example.com"
                                        maxLength={254}
                                        autoComplete="email"
                                    />
                                </Field>
                            </div>
                        </div>
                    </section>

                    {/* Location */}
                    <section className="erp-card">
                        <div className="erp-card-header">
                            <SectionHeading
                                icon={MapPinned}
                                title="Business location"
                                description="Specify where your company operates."
                            />
                        </div>

                        <div className="erp-card-body">
                            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                                <Field
                                    id="country"
                                    label="Country"
                                    icon={Globe2}
                                >
                                    <input
                                        id="country"
                                        value={form.country}
                                        onChange={(e) =>
                                            updateField(
                                                "country",
                                                e.target.value
                                            )
                                        }
                                        disabled={!canUpdate || busy}
                                        className={inputClass}
                                        placeholder="Pakistan"
                                        maxLength={100}
                                        autoComplete="country-name"
                                    />
                                </Field>

                                <Field
                                    id="stateProvince"
                                    label="State / Province"
                                    icon={MapPin}
                                >
                                    <input
                                        id="stateProvince"
                                        value={form.stateProvince}
                                        onChange={(e) =>
                                            updateField(
                                                "stateProvince",
                                                e.target.value
                                            )
                                        }
                                        disabled={!canUpdate || busy}
                                        className={inputClass}
                                        placeholder="Punjab"
                                        maxLength={100}
                                        autoComplete="address-level1"
                                    />
                                </Field>

                                <Field
                                    id="city"
                                    label="City"
                                    icon={MapPin}
                                >
                                    <input
                                        id="city"
                                        value={form.city}
                                        onChange={(e) =>
                                            updateField(
                                                "city",
                                                e.target.value
                                            )
                                        }
                                        disabled={!canUpdate || busy}
                                        className={inputClass}
                                        placeholder="Enter city"
                                        maxLength={100}
                                        autoComplete="address-level2"
                                    />
                                </Field>
                            </div>

                            <div className="mt-6 border-t erp-border pt-6">
                                <Field
                                    id="address"
                                    label="Complete business address"
                                    icon={MapPin}
                                    hint="Street, building, area, and postal code, if applicable."
                                >
                                    <textarea
                                        id="address"
                                        value={form.address}
                                        onChange={(e) =>
                                            updateField(
                                                "address",
                                                e.target.value
                                            )
                                        }
                                        disabled={!canUpdate || busy}
                                        rows={4}
                                        className={`${inputClass} min-h-28 resize-y`}
                                        placeholder="Enter the full business address..."
                                        maxLength={500}
                                        autoComplete="street-address"
                                    />
                                </Field>
                            </div>
                        </div>
                    </section>

                    {/* Financial preferences */}
                    <section className="erp-card">
                        <div className="erp-card-header">
                            <SectionHeading
                                icon={Wallet}
                                title="Financial preferences"
                                description="Choose the base currency for your company."
                            />
                        </div>

                        <div className="erp-card-body">
                            <div className="max-w-xl">
                                <Field
                                    id="currency"
                                    label="Company currency"
                                    icon={Wallet}
                                    hint="Changing this setting does not automatically convert existing transaction amounts."
                                >
                                    <select
                                        id="currency"
                                        value={form.currency}
                                        onChange={(e) =>
                                            updateField(
                                                "currency",
                                                e.target.value
                                            )
                                        }
                                        disabled={!canUpdate || busy}
                                        className={inputClass}
                                    >
                                        <option value="PKR">
                                            PKR — Pakistani Rupee
                                        </option>
                                        <option value="USD">
                                            USD — US Dollar
                                        </option>
                                        <option value="EUR">
                                            EUR — Euro
                                        </option>
                                        <option value="GBP">
                                            GBP — British Pound
                                        </option>
                                        <option value="AED">
                                            AED — UAE Dirham
                                        </option>
                                    </select>
                                </Field>

                                <div className="mt-5 flex items-start gap-3 rounded-xl border erp-border bg-[var(--erp-page)] p-4">
                                    <Sparkles
                                        size={18}
                                        className="mt-0.5 shrink-0 text-[var(--erp-primary)]"
                                    />

                                    <div>
                                        <p className="text-sm font-semibold text-[var(--erp-text)]">
                                            Company-wide preference
                                        </p>

                                        <p className="mt-1 text-xs leading-5 text-[var(--erp-muted)]">
                                            Use a currency consistent with your
                                            accounting setup. Review existing
                                            accounting records before changing
                                            the company&apos;s base currency.
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </section>

                    {/* Save bar */}
                    <div className="sticky bottom-3 z-20">
                        <div className="flex flex-col gap-3 rounded-2xl border erp-border bg-[var(--erp-surface)]/95 p-4 shadow-[var(--erp-shadow-hover)] backdrop-blur-xl sm:flex-row sm:items-center sm:justify-between sm:px-5">
                            <div className="flex items-center gap-2 text-xs text-[var(--erp-muted)]">
                                <ShieldCheck
                                    size={17}
                                    className="shrink-0 text-[var(--erp-green)]"
                                />

                                <span>
                                    {canUpdate
                                        ? "Review your changes before saving."
                                        : "Read-only access: you cannot save changes."}
                                </span>
                            </div>

                            {canUpdate && (
                                <button
                                    type="submit"
                                    disabled={busy}
                                    className="erp-button w-full disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
                                >
                                    {saving ? (
                                        <LoaderCircle
                                            size={18}
                                            className="animate-spin"
                                        />
                                    ) : (
                                        <Save size={18} />
                                    )}

                                    {saving
                                        ? "Saving settings..."
                                        : "Save company settings"}
                                </button>
                            )}
                        </div>
                    </div>
                </form>
            </div>
        </main>
    );
}
