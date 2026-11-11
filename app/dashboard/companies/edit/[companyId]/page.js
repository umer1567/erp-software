
"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
    ArrowLeft,
    Building2,
    LoaderCircle,
    Save,
    AlertCircle,
    CheckCircle2,
    Upload,
    X,
    Mail,
    Phone,
    MapPin,
    Globe,
    Hash,
    Coins,
    ImagePlus,
    ShieldCheck,
    RefreshCw,
    FileImage,
    Sparkles,
    Check,
    ChevronRight,
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
    companyEmail: "",
    address: "",
    city: "",
    province: "",
    country: "Pakistan",
    postalCode: "",
    currency: "PKR",
};

const CURRENCIES = [
    { value: "PKR", label: "Pakistani Rupee" },
    { value: "USD", label: "US Dollar" },
    { value: "GBP", label: "British Pound" },
    { value: "EUR", label: "Euro" },
    { value: "AED", label: "UAE Dirham" },
    { value: "SAR", label: "Saudi Riyal" },
    { value: "INR", label: "Indian Rupee" },
];

function SectionHeader({ icon: Icon, title, description, step }) {
    return (
        <div className="mb-7 flex items-start gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-blue-100 bg-gradient-to-br from-blue-50 to-indigo-100 text-blue-700 dark:border-blue-900 dark:from-blue-950 dark:to-indigo-950 dark:text-blue-300">
                <Icon size={22} strokeWidth={1.8} />
            </div>

            <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-base font-bold text-gray-900 dark:text-white sm:text-lg">
                        {title}
                    </h2>

                    <span className="rounded-md bg-gray-100 px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-gray-600 dark:bg-gray-800 dark:text-gray-300">
                        {step}
                    </span>
                </div>

                <p className="mt-1 text-sm leading-6 text-gray-600 dark:text-gray-300">
                    {description}
                </p>
            </div>
        </div>
    );
}

function FormSection({ children, className = "" }) {
    return (
        <section
            className={`rounded-2xl border border-gray-200 bg-white p-5 shadow-sm shadow-gray-200/30 dark:border-gray-700 dark:bg-gray-900 dark:shadow-none sm:p-7 ${className}`}
        >
            {children}
        </section>
    );
}

function FormField({
    label,
    name,
    value,
    onChange,
    icon: Icon,
    placeholder,
    type = "text",
    maxLength,
    required = false,
    hint,
    autoComplete,
}) {
    return (
        <div className="min-w-0">
            <label
                htmlFor={name}
                className="mb-2 block text-sm font-semibold text-gray-700 dark:text-gray-100"
            >
                {label}
                {required && <span className="ml-1 text-red-500">*</span>}
            </label>

            <div className="group relative">
                {Icon && (
                    <Icon
                        size={17}
                        className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-500 transition-colors group-focus-within:text-blue-600 dark:text-gray-400"
                    />
                )}

                <input
                    id={name}
                    name={name}
                    type={type}
                    value={value}
                    onChange={onChange}
                    placeholder={placeholder}
                    maxLength={maxLength}
                    required={required}
                    autoComplete={autoComplete}
                    className={`w-full rounded-xl border border-gray-300 bg-gray-50 py-3 text-sm text-gray-900 outline-none transition-all placeholder:text-gray-500 hover:border-gray-400 focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-500/10 dark:border-gray-600 dark:bg-gray-800 dark:text-white dark:placeholder:text-gray-400 dark:hover:border-gray-500 dark:focus:border-blue-400 dark:focus:bg-gray-800 ${Icon ? "pl-10 pr-4" : "px-4"
                        }`}
                />
            </div>

            {hint && (
                <p className="mt-1.5 text-xs leading-5 text-gray-600 dark:text-gray-300">
                    {hint}
                </p>
            )}
        </div>
    );
}

function LoadingSkeleton() {
    return (
        <div className="mx-auto w-full max-w-6xl space-y-6 p-4 sm:p-6 lg:p-8">
            <div className="h-48 animate-pulse rounded-3xl bg-gray-200 dark:bg-gray-800" />

            <div className="space-y-5 rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-900">
                <div className="h-6 w-48 rounded-lg bg-gray-200 dark:bg-gray-700" />

                <div className="grid gap-5 sm:grid-cols-2">
                    {Array.from({ length: 6 }).map((_, index) => (
                        <div key={index} className="space-y-3">
                            <div className="h-4 w-28 rounded bg-gray-200 dark:bg-gray-700" />
                            <div className="h-12 rounded-xl bg-gray-200 dark:bg-gray-700" />
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}

export default function EditCompanyPage() {
    const params = useParams();

    const companyId = Array.isArray(params.companyId)
        ? params.companyId[0]
        : params.companyId;

    const fileInputRef = useRef(null);
    const objectUrlRef = useRef(null);
    const originalLogoRef = useRef("");
    const requestControllerRef = useRef(null);

    const [form, setForm] = useState(INITIAL_FORM);
    const [savedLogoName, setSavedLogoName] = useState("");
    const [logoFile, setLogoFile] = useState(null);
    const [logoPreview, setLogoPreview] = useState("");
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [dragging, setDragging] = useState(false);
    const [error, setError] = useState("");
    const [success, setSuccess] = useState("");
    const [logoLoadError, setLogoLoadError] = useState(false);
    const [hasOriginalLogo, setHasOriginalLogo] = useState(false);

    const releaseObjectUrl = useCallback(() => {
        if (objectUrlRef.current) {
            URL.revokeObjectURL(objectUrlRef.current);
            objectUrlRef.current = null;
        }
    }, []);

    const loadCompany = useCallback(
        async (signal) => {
            if (!companyId) {
                setError("A valid company ID is required.");
                setLoading(false);
                return;
            }

            setError("");

            try {
                const response = await fetch(
                    `/api/companies/${encodeURIComponent(companyId)}`,
                    {
                        cache: "no-store",
                        signal,
                    }
                );

                const data = await response.json();

                if (!response.ok || !data.success || !data.company) {
                    throw new Error(
                        data.message || "Unable to load company details."
                    );
                }

                const company = data.company;

                const logoUrl = company.logo_url || "";

                setSavedLogoName(
                    logoUrl ? logoUrl.split("/").pop().split("?")[0] : ""
                );

                const locationParts = String(company.location || "")
                    .split(",")
                    .map((part) => part.trim());

                setForm({
                    companyName: company.company_name || "",
                    phone: company.phone || "",
                    companyEmail: company.email || "",
                    address: company.address || "",
                    city: locationParts[0] || "",
                    province: locationParts[1] || "",
                    country: locationParts[2] || "Pakistan",
                    postalCode: locationParts[3] || "",
                    currency: company.currency || "PKR",
                });

                releaseObjectUrl();
                setLogoFile(null);

                originalLogoRef.current = company.logo_url || "";
                setHasOriginalLogo(Boolean(company.logo_url));
                setLogoPreview(company.logo_url || "");
                setLogoLoadError(false);

                if (fileInputRef.current) {
                    fileInputRef.current.value = "";
                }
            } catch (err) {
                if (err.name !== "AbortError") {
                    setError(
                        err.message || "Unable to load company details."
                    );
                }
            } finally {
                if (!signal?.aborted) {
                    setLoading(false);
                }
            }
        },
        [companyId, releaseObjectUrl]
    );

    useEffect(() => {
        const controller = new AbortController();
        requestControllerRef.current = controller;

        const timeoutId = setTimeout(() => {
            if (!controller.signal.aborted) {
                loadCompany(controller.signal);
            }
        }, 0);

        return () => {
            clearTimeout(timeoutId);
            controller.abort();
        };
    }, [loadCompany]);

    useEffect(() => {
        return () => {
            releaseObjectUrl();
            requestControllerRef.current?.abort();
        };
    }, [releaseObjectUrl]);

    function handleChange(event) {
        const { name, value } = event.target;

        setForm((previous) => ({
            ...previous,
            [name]: value,
        }));

        setError("");
        setSuccess("");
    }

    function processLogoFile(file) {
        if (!file) return;

        if (!ALLOWED_LOGO_TYPES.includes(file.type)) {
            setError("Choose a PNG, JPG, or WebP company logo.");

            if (fileInputRef.current) {
                fileInputRef.current.value = "";
            }

            return;
        }

        if (file.size > MAX_LOGO_SIZE) {
            setError("Company logo must be 2 MB or smaller.");

            if (fileInputRef.current) {
                fileInputRef.current.value = "";
            }

            return;
        }

        releaseObjectUrl();

        const previewUrl = URL.createObjectURL(file);
        objectUrlRef.current = previewUrl;

        setLogoFile(file);
        setLogoPreview(previewUrl);
        setLogoLoadError(false);
        setError("");
        setSuccess("");
    }

    function handleLogoChange(event) {
        processLogoFile(event.target.files?.[0]);
    }

    function handleDrop(event) {
        event.preventDefault();
        setDragging(false);

        const file = event.dataTransfer.files?.[0];

        if (file) {
            processLogoFile(file);
        }
    }

    function removeSelectedLogo() {
        releaseObjectUrl();

        setLogoFile(null);
        setLogoPreview("");
        setLogoLoadError(false);
        setError("");
        setSuccess("");

        if (fileInputRef.current) {
            fileInputRef.current.value = "";
        }
    }

    function restoreOriginalLogo() {
        releaseObjectUrl();

        setLogoFile(null);
        setLogoPreview(originalLogoRef.current);
        setLogoLoadError(false);
        setError("");
        setSuccess("");

        if (fileInputRef.current) {
            fileInputRef.current.value = "";
        }
    }

    async function handleSubmit(event) {
        event.preventDefault();

        setError("");
        setSuccess("");

        if (!companyId) {
            setError("A valid company ID is required.");
            return;
        }

        if (!form.companyName.trim()) {
            setError("Company name is required.");
            return;
        }

        if (
            form.companyEmail.trim() &&
            !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
                form.companyEmail.trim()
            )
        ) {
            setError("Enter a valid company email address.");
            return;
        }

        if (!/^[A-Za-z]{3}$/.test(form.currency.trim())) {
            setError("Currency must be a three-letter code.");
            return;
        }

        setSaving(true);

        try {
            const body = new FormData();

            body.append("companyName", form.companyName.trim());
            body.append("phone", form.phone.trim());
            body.append("companyEmail", form.companyEmail.trim());
            body.append("address", form.address.trim());
            body.append("city", form.city.trim());
            body.append("province", form.province.trim());
            body.append("country", form.country.trim());
            body.append("postalCode", form.postalCode.trim());
            body.append("currency", form.currency.trim());

            if (logoFile) {
                body.append("companyLogo", logoFile);
            }

            if (!logoPreview && !logoFile) {
                body.append("removeLogo", "true");
            }

            const response = await fetch(
                `/api/companies/${encodeURIComponent(companyId)}`,
                {
                    method: "PATCH",
                    body,
                }
            );

            const data = await response.json();

            if (!response.ok || !data.success) {
                throw new Error(
                    data.message || "Unable to update company."
                );
            }

            setSuccess("Company information saved successfully.");

            await loadCompany();
        } catch (err) {
            setError(
                err.message || "An error occurred while saving."
            );
        } finally {
            setSaving(false);
        }
    }

    if (loading) {
        return <LoadingSkeleton />;
    }

    return (
        <div className="min-h-full bg-gray-50 px-4 py-6 text-gray-900 sm:px-6 sm:py-8 lg:px-8 dark:bg-gray-950 dark:text-gray-100">
            <div className="mx-auto w-full max-w-6xl space-y-6">
                {/* Breadcrumb */}
                <div className="flex flex-wrap items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
                    <Link
                        href="/dashboard"
                        className="transition hover:text-blue-600 dark:hover:text-blue-400"
                    >
                        Dashboard
                    </Link>

                    <ChevronRight size={15} />

                    <Link
                        href="/dashboard/register-company"
                        className="transition hover:text-blue-600 dark:hover:text-blue-400"
                    >
                        Companies
                    </Link>

                    <ChevronRight size={15} />

                    <span className="font-semibold text-gray-900 dark:text-white">
                        Edit Company
                    </span>
                </div>

                {/* Page hero */}
                <header className="relative isolate overflow-hidden rounded-3xl bg-gradient-to-br from-slate-950 via-blue-950 to-indigo-900 p-6 text-white shadow-xl shadow-blue-950/10 sm:p-8 lg:p-10">
                    <div className="pointer-events-none absolute -right-16 -top-28 -z-10 h-80 w-80 rounded-full bg-blue-400/20 blur-3xl" />
                    <div className="pointer-events-none absolute -bottom-36 left-1/3 -z-10 h-72 w-72 rounded-full bg-indigo-400/20 blur-3xl" />

                    <div className="relative flex flex-col justify-between gap-7 md:flex-row md:items-center">
                        <div className="min-w-0">
                            <Link
                                href="/dashboard/register-company"
                                className="mb-6 inline-flex items-center gap-2 rounded-xl border border-white/20 bg-white/10 px-3.5 py-2 text-sm font-medium text-white backdrop-blur transition hover:bg-white/20"
                            >
                                <ArrowLeft size={16} />
                                Back to Companies
                            </Link>

                            <div className="flex items-center gap-3">
                                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-white/20 bg-white/10 shadow-lg backdrop-blur">
                                    <Building2 size={25} />
                                </div>

                                <div>
                                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-blue-200">
                                        Company Administration
                                    </p>

                                    <h1 className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl lg:text-4xl">
                                        Edit Company
                                    </h1>
                                </div>
                            </div>

                            <p className="mt-4 max-w-2xl text-sm leading-6 text-blue-100 sm:text-base">
                                Manage your organization profile, contact
                                details, location and branding from one
                                place.
                            </p>
                        </div>

                        <div className="flex shrink-0 items-center gap-3 self-start rounded-2xl border border-white/20 bg-white/10 p-4 backdrop-blur md:self-center">
                            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-white text-blue-800">
                                <ShieldCheck size={23} />
                            </div>

                            <div>
                                <p className="text-xs text-blue-100">
                                    Company reference
                                </p>
                                <p className="mt-1 text-sm font-bold text-white">
                                    ID #{companyId}
                                </p>
                                <p className="mt-1 text-xs text-emerald-300">
                                    Editing company profile
                                </p>
                            </div>
                        </div>
                    </div>

                    <div className="mt-8 grid grid-cols-1 gap-3 border-t border-white/20 pt-6 sm:grid-cols-3">
                        <div className="flex items-center gap-3">
                            <div className="rounded-xl bg-white/10 p-2.5">
                                <Building2 size={18} />
                            </div>
                            <div>
                                <p className="text-xs text-blue-100">Profile</p>
                                <p className="mt-0.5 text-sm font-semibold text-white">
                                    Company information
                                </p>
                            </div>
                        </div>

                        <div className="flex items-center gap-3">
                            <div className="rounded-xl bg-white/10 p-2.5">
                                <ImagePlus size={18} />
                            </div>
                            <div>
                                <p className="text-xs text-blue-100">Branding</p>
                                <p className="mt-0.5 text-sm font-semibold text-white">
                                    Logo management
                                </p>
                            </div>
                        </div>

                        <div className="flex items-center gap-3">
                            <div className="rounded-xl bg-white/10 p-2.5">
                                <ShieldCheck size={18} />
                            </div>
                            <div>
                                <p className="text-xs text-blue-100">Access</p>
                                <p className="mt-0.5 text-sm font-semibold text-white">
                                    Authorized company settings
                                </p>
                            </div>
                        </div>
                    </div>
                </header>

                {/* Alerts */}
                {error && (
                    <div
                        role="alert"
                        className="flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-900 shadow-sm dark:border-red-800 dark:bg-red-950 dark:text-red-200"
                    >
                        <AlertCircle size={20} className="mt-0.5 shrink-0" />

                        <div className="min-w-0 flex-1">
                            <p className="font-bold">Unable to continue</p>
                            <p className="mt-1 leading-5">{error}</p>
                        </div>

                        <button
                            type="button"
                            onClick={() => setError("")}
                            aria-label="Dismiss error"
                            className="rounded-lg p-1 transition hover:bg-red-100 dark:hover:bg-red-900"
                        >
                            <X size={17} />
                        </button>
                    </div>
                )}

                {success && (
                    <div
                        role="status"
                        className="flex items-start gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900 shadow-sm dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-200"
                    >
                        <CheckCircle2 size={20} className="mt-0.5 shrink-0" />

                        <div className="min-w-0 flex-1">
                            <p className="font-bold">Changes saved</p>
                            <p className="mt-1 leading-5">{success}</p>
                        </div>

                        <button
                            type="button"
                            onClick={() => setSuccess("")}
                            aria-label="Dismiss success message"
                            className="rounded-lg p-1 transition hover:bg-emerald-100 dark:hover:bg-emerald-900"
                        >
                            <X size={17} />
                        </button>
                    </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-6">
                    {/* Company information */}
                    <FormSection>
                        <SectionHeader
                            icon={Building2}
                            title="Company Information"
                            description="Maintain the official name and primary contact information for your organization."
                            step="01 / Profile"
                        />

                        <div className="grid grid-cols-1 gap-x-6 gap-y-5 sm:grid-cols-2">
                            <div className="sm:col-span-2">
                                <FormField
                                    label="Company Name"
                                    name="companyName"
                                    value={form.companyName}
                                    onChange={handleChange}
                                    icon={Building2}
                                    placeholder="Enter your registered company name"
                                    maxLength={150}
                                    required
                                    autoComplete="organization"
                                />
                            </div>

                            <FormField
                                label="Company Email"
                                name="companyEmail"
                                value={form.companyEmail}
                                onChange={handleChange}
                                icon={Mail}
                                type="email"
                                placeholder="company@example.com"
                                maxLength={254}
                                autoComplete="email"
                            />

                            <FormField
                                label="Phone Number"
                                name="phone"
                                value={form.phone}
                                onChange={handleChange}
                                icon={Phone}
                                type="tel"
                                placeholder="Enter contact number"
                                maxLength={50}
                                autoComplete="tel"
                            />

                            <div className="sm:col-span-2">
                                <label
                                    htmlFor="address"
                                    className="mb-2 block text-sm font-semibold text-gray-700 dark:text-gray-100"
                                >
                                    Business Address
                                </label>

                                <div className="relative">
                                    <MapPin
                                        size={17}
                                        className="pointer-events-none absolute left-3.5 top-4 text-gray-500 dark:text-gray-400"
                                    />

                                    <textarea
                                        id="address"
                                        name="address"
                                        value={form.address}
                                        onChange={handleChange}
                                        placeholder="Street, building, office or business address"
                                        rows={3}
                                        maxLength={500}
                                        className="w-full resize-y rounded-xl border border-gray-300 bg-gray-50 py-3 pl-10 pr-4 text-sm text-gray-900 outline-none transition-all placeholder:text-gray-500 hover:border-gray-400 focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-500/10 dark:border-gray-600 dark:bg-gray-800 dark:text-white dark:placeholder:text-gray-400 dark:hover:border-gray-500 dark:focus:border-blue-400 dark:focus:bg-gray-800"
                                    />
                                </div>

                                <p className="mt-1.5 text-right text-xs text-gray-600 dark:text-gray-300">
                                    {form.address.length}/500 characters
                                </p>
                            </div>
                        </div>
                    </FormSection>

                    {/* Location */}
                    <FormSection>
                        <SectionHeader
                            icon={Globe}
                            title="Location & Regional Settings"
                            description="Specify the location associated with this company and its default reporting currency."
                            step="02 / Location"
                        />

                        <div className="grid grid-cols-1 gap-x-6 gap-y-5 sm:grid-cols-2">
                            <FormField
                                label="City"
                                name="city"
                                value={form.city}
                                onChange={handleChange}
                                icon={MapPin}
                                placeholder="e.g. Lahore"
                                maxLength={100}
                            />

                            <FormField
                                label="Province / State"
                                name="province"
                                value={form.province}
                                onChange={handleChange}
                                icon={Globe}
                                placeholder="e.g. Punjab"
                                maxLength={100}
                            />

                            <FormField
                                label="Country"
                                name="country"
                                value={form.country}
                                onChange={handleChange}
                                icon={Globe}
                                placeholder="Enter country"
                                maxLength={100}
                            />

                            <FormField
                                label="Postal Code"
                                name="postalCode"
                                value={form.postalCode}
                                onChange={handleChange}
                                icon={Hash}
                                placeholder="Enter postal code"
                                maxLength={30}
                            />

                            <div className="sm:col-span-2">
                                <label
                                    htmlFor="currency"
                                    className="mb-2 block text-sm font-semibold text-gray-700 dark:text-gray-100"
                                >
                                    Default Currency
                                </label>

                                <div className="relative">
                                    <Coins
                                        size={18}
                                        className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-500 dark:text-gray-400"
                                    />

                                    <select
                                        id="currency"
                                        name="currency"
                                        value={form.currency}
                                        onChange={handleChange}
                                        className="w-full appearance-none rounded-xl border border-gray-300 bg-gray-50 py-3 pl-10 pr-10 text-sm text-gray-900 outline-none transition-all hover:border-gray-400 focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-500/10 dark:border-gray-600 dark:bg-gray-800 dark:text-white dark:hover:border-gray-500 dark:focus:border-blue-400 dark:focus:bg-gray-800"
                                    >
                                        {CURRENCIES.map((currency) => (
                                            <option
                                                key={currency.value}
                                                value={currency.value}
                                                className="bg-white text-gray-900 dark:bg-gray-800 dark:text-white"
                                            >
                                                {currency.value} — {currency.label}
                                            </option>
                                        ))}
                                    </select>

                                    <ChevronRight
                                        size={17}
                                        className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 rotate-90 text-gray-500 dark:text-gray-400"
                                    />
                                </div>

                                <p className="mt-2 text-xs leading-5 text-gray-600 dark:text-gray-300">
                                    This value is saved as the company&apos;s
                                    default currency. Ensure it matches
                                    your accounting requirements.
                                </p>
                            </div>
                        </div>
                    </FormSection>

                    {/* Logo and branding */}
                    <FormSection>
                        <SectionHeader
                            icon={ImagePlus}
                            title="Company Branding"
                            description="Upload a company logo to personalize your organization's identity across supported screens."
                            step="03 / Branding"
                        />

                        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(300px,0.85fr)]">
                            {/* Upload area */}
                            <div className="min-w-0">
                                <div
                                    onDragOver={(event) => {
                                        event.preventDefault();
                                        setDragging(true);
                                    }}
                                    onDragLeave={(event) => {
                                        if (
                                            !event.currentTarget.contains(
                                                event.relatedTarget
                                            )
                                        ) {
                                            setDragging(false);
                                        }
                                    }}
                                    onDrop={handleDrop}
                                    className={`relative flex min-h-64 flex-col items-center justify-center rounded-2xl border-2 border-dashed p-6 text-center transition-all sm:p-8 ${dragging
                                        ? "border-blue-500 bg-blue-50 dark:bg-blue-950"
                                        : "border-gray-300 bg-gray-50 hover:border-blue-400 hover:bg-blue-50/50 dark:border-gray-600 dark:bg-gray-800 dark:hover:border-blue-500 dark:hover:bg-blue-950/40"
                                        }`}
                                >
                                    <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-white text-blue-600 shadow-sm ring-1 ring-gray-200 dark:bg-gray-700 dark:text-blue-300 dark:ring-gray-600">
                                        <Upload size={25} />
                                    </div>

                                    <h3 className="text-sm font-bold text-gray-900 dark:text-white">
                                        Drop your logo here
                                    </h3>

                                    <p className="mt-2 max-w-sm text-sm leading-6 text-gray-600 dark:text-gray-300">
                                        Drag and drop an image, or select
                                        a file from your computer.
                                    </p>

                                    <button
                                        type="button"
                                        onClick={() =>
                                            fileInputRef.current?.click()
                                        }
                                        className="mt-5 inline-flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-blue-600/20 transition hover:-translate-y-0.5 hover:bg-blue-700 hover:shadow-blue-600/30 focus:outline-none focus:ring-4 focus:ring-blue-500/20"
                                    >
                                        <ImagePlus size={17} />
                                        Choose an Image
                                    </button>

                                    <input
                                        ref={fileInputRef}
                                        type="file"
                                        accept="image/png,image/jpeg,image/webp"
                                        onChange={handleLogoChange}
                                        className="hidden"
                                    />

                                    <div className="mt-5 flex flex-wrap items-center justify-center gap-2 text-[11px] font-medium text-gray-600 dark:text-gray-300">
                                        {["PNG", "JPG", "WebP"].map((type) => (
                                            <span
                                                key={type}
                                                className="rounded-md border border-gray-300 bg-white px-2 py-1 text-gray-700 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
                                            >
                                                {type}
                                            </span>
                                        ))}
                                        <span>Maximum 2 MB</span>
                                    </div>
                                </div>

                                {/* Selected file status: improved light/dark contrast */}

                                {/* Logo file status */}
                                {/* Logo file status — visible in every theme */}
{(logoFile || savedLogoName) && (
    <div
        className="mt-4 flex min-w-0 items-start gap-3 rounded-xl border p-4 shadow-sm"
        style={{
            backgroundColor: "#0f172a",
            borderColor: "#475569",
            color: "#f8fafc",
            colorScheme: "dark",
        }}
    >
        <div
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg"
            style={{
                backgroundColor: "#1e293b",
                color: "#93c5fd",
                border: "1px solid #475569",
            }}
        >
            <FileImage size={21} />
        </div>

        <div className="min-w-0 flex-1">
            <p
                className="break-all text-sm font-bold leading-5"
                style={{
                    color: "#ffffff",
                    WebkitTextFillColor: "#ffffff",
                }}
                title={logoFile?.name || savedLogoName}
            >
                {logoFile?.name || savedLogoName}
            </p>

            {logoFile ? (
                <>
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                        <span
                            className="text-xs font-semibold"
                            style={{ color: "#e2e8f0" }}
                        >
                            {(logoFile.size / 1024).toFixed(1)} KB
                        </span>

                        <span style={{ color: "#94a3b8" }}>·</span>

                        <span
                            className="inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-bold"
                            style={{
                                backgroundColor: "#064e3b",
                                borderColor: "#059669",
                                color: "#d1fae5",
                                WebkitTextFillColor: "#d1fae5",
                            }}
                        >
                            <Check size={13} strokeWidth={2.5} />
                            Ready to upload
                        </span>
                    </div>

                    <p
                        className="mt-2 text-xs leading-5"
                        style={{ color: "#cbd5e1" }}
                    >
                        This new logo will be uploaded when you save your
                        changes.
                    </p>
                </>
            ) : (
                <div className="mt-2">
                    <span
                        className="inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-bold"
                        style={{
                            backgroundColor: "#172554",
                            borderColor: "#3b82f6",
                            color: "#dbeafe",
                            WebkitTextFillColor: "#dbeafe",
                        }}
                    >
                        <CheckCircle2 size={13} />
                        Saved logo from API
                    </span>

                    <p
                        className="mt-2 text-xs leading-5"
                        style={{ color: "#cbd5e1" }}
                    >
                        This is the logo currently associated with the
                        company.
                    </p>
                </div>
            )}
        </div>

        <CheckCircle2
            size={21}
            className="mt-1 shrink-0"
            style={{ color: "#34d399" }}
        />
    </div>
)}

                            </div>

                            {/* Logo preview */}
                            <aside className="flex min-w-0 flex-col rounded-2xl border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-800 sm:p-5">
                                <div className="mb-4 flex items-center justify-between gap-2">
                                    <h3 className="text-sm font-bold text-gray-900 dark:text-white">
                                        Logo Preview
                                    </h3>

                                    <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                                        Live
                                    </span>
                                </div>

                                <div className="relative h-[220px] w-full overflow-hidden rounded-2xl border border-gray-300 bg-white dark:border-slate-600 dark:bg-slate-900 sm:h-[260px] lg:h-[300px]">
                                    <div className="pointer-events-none absolute inset-0 opacity-50 [background-image:linear-gradient(45deg,#e5e7eb_25%,transparent_25%),linear-gradient(-45deg,#e5e7eb_25%,transparent_25%),linear-gradient(45deg,transparent_75%,#e5e7eb_75%),linear-gradient(-45deg,transparent_75%,#e5e7eb_75%)] [background-position:0_0,0_6px,6px_-6px,-6px_0] [background-size:12px_12px] dark:opacity-20" />

                                    {logoPreview && !logoLoadError ? (
                                        <>
                                            {/* eslint-disable-next-line @next/next/no-img-element */}
                                            <img
                                                src={logoPreview}
                                                alt="Company logo preview"
                                                onError={() => setLogoLoadError(true)}
                                                onLoad={() => setLogoLoadError(false)}
                                                className="absolute inset-0 z-10 h-full w-full object-fill"
                                            />

                                            <button
                                                type="button"
                                                onClick={removeSelectedLogo}
                                                aria-label="Remove company logo"
                                                title="Remove logo"
                                                className="absolute right-2 top-2 z-20 flex h-9 w-9 items-center justify-center rounded-lg border border-red-200 bg-white text-red-600 shadow-md transition hover:bg-red-50 dark:border-red-700 dark:bg-gray-800 dark:text-red-300 dark:hover:bg-red-950"
                                            >
                                                <X size={17} />
                                            </button>
                                        </>
                                    ) : (
                                        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center px-4 py-8 text-center">
                                            <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-gray-300 bg-gray-50 text-gray-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300">
                                                {logoLoadError ? (
                                                    <AlertCircle size={28} />
                                                ) : (
                                                    <Building2 size={30} />
                                                )}
                                            </div>

                                            <p className="mt-3 text-sm font-semibold text-gray-800 dark:text-gray-100">
                                                {logoLoadError
                                                    ? "Unable to display logo"
                                                    : "No logo selected"}
                                            </p>

                                            <p className="mt-1 text-xs text-gray-600 dark:text-gray-300">
                                                Your logo appears here
                                            </p>

                                            {logoLoadError && (
                                                <button
                                                    type="button"
                                                    onClick={() =>
                                                        setLogoLoadError(false)
                                                    }
                                                    className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-blue-700 hover:underline dark:text-blue-300"
                                                >
                                                    <RefreshCw size={12} />
                                                    Retry preview
                                                </button>
                                            )}
                                        </div>
                                    )}
                                </div>

                                <div className="mt-4 flex items-start gap-2 text-xs leading-5 text-gray-600 dark:text-gray-300">
                                    <Sparkles
                                        size={15}
                                        className="mt-0.5 shrink-0 text-blue-600 dark:text-blue-400"
                                    />
                                    <p>
                                        The image fills the complete preview
                                        area. Its width and height may be
                                        stretched to fit the preview.
                                    </p>
                                </div>

                                {logoFile && hasOriginalLogo && (
                                    <button
                                        type="button"
                                        onClick={restoreOriginalLogo}
                                        className="mt-3 inline-flex items-center justify-center gap-2 rounded-lg border border-gray-300 px-3 py-2 text-xs font-semibold text-gray-700 transition hover:bg-gray-100 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-700"
                                    >
                                        <RefreshCw size={13} />
                                        Restore saved logo
                                    </button>
                                )}
                            </aside>
                        </div>
                    </FormSection>

                    {/* Footer actions */}
                    <div className="sticky bottom-3 z-30 rounded-2xl border border-gray-200 bg-white p-4 text-gray-900 shadow-lg shadow-gray-900/10 dark:border-gray-700 dark:bg-gray-900 dark:text-white sm:p-5">
                        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                            <div className="flex items-start gap-3">
                                <div className="hidden h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200 sm:flex">
                                    <ShieldCheck size={21} />
                                </div>

                                <div>
                                    <p className="text-sm font-bold text-gray-900 dark:text-white">
                                        Ready to save your changes?
                                    </p>
                                    <p className="mt-1 text-xs leading-5 text-gray-700 dark:text-gray-300">
                                        Your company information will be
                                        updated in the database.
                                    </p>
                                </div>
                            </div>

                            <div className="flex flex-col-reverse gap-3 sm:flex-row">
                                <Link
                                    href="/dashboard/register-company"
                                    className="inline-flex items-center justify-center gap-2 rounded-xl border border-gray-300 bg-white px-5 py-3 text-sm font-semibold text-gray-800 transition hover:bg-gray-100 dark:border-gray-600 dark:bg-gray-800 dark:text-white dark:hover:bg-gray-700"
                                >
                                    <ArrowLeft size={16} />
                                    Cancel
                                </Link>

                                <button
                                    type="submit"
                                    disabled={saving}
                                    className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-6 py-3 text-sm font-bold text-white shadow-lg shadow-blue-600/20 transition hover:bg-blue-700 focus:outline-none focus:ring-4 focus:ring-blue-500/30 disabled:cursor-not-allowed disabled:opacity-60"
                                >
                                    {saving ? (
                                        <LoaderCircle
                                            size={18}
                                            className="animate-spin"
                                        />
                                    ) : (
                                        <Save size={18} />
                                    )}

                                    {saving ? "Saving Changes..." : "Save Changes"}
                                </button>
                            </div>
                        </div>
                    </div>
                </form>

                <footer className="flex flex-wrap items-center justify-center gap-x-2 gap-y-1 pb-4 text-center text-xs text-gray-600 dark:text-gray-300">
                    <ShieldCheck size={14} />
                    <span>Company Administration</span>
                    <span>·</span>
                    <span>Company ID: {companyId}</span>
                </footer>
            </div>
        </div>
    );
}
