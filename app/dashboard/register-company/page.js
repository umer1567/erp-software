
"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import {
    Building2,
    UserRound,
    LoaderCircle,
    Upload,
    MapPin,
    X,
    ArrowLeft,
    Plus,
    RefreshCw,
    LogIn,
    Pencil,
    Mail,
    Phone,
    Globe,
    Wallet,
    ShieldCheck,
    CheckCircle2,
    ImagePlus,
    Sparkles,
    LockKeyhole,
} from "lucide-react";

const initialForm = {
    companyName: "",
    phone: "",
    companyEmail: "",
    address: "",
    city: "",
    province: "",
    country: "Pakistan",
    postalCode: "",
    currency: "PKR",
    assignmentMode: "newAdmin",
    fullName: "",
    username: "",
    adminEmail: "",
    password: "",
    confirmPassword: "",
    existingUserId: "",
    existingRoleId: "",
    companyPassword: "",
    confirmCompanyPassword: "",
};

const defaultPermissions = {
    view: false,
    create: false,
    update: false,
    delete: false,
};

const inputClass =
    "w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 shadow-sm outline-none transition placeholder:text-slate-400 hover:border-slate-300 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10";

const labelClass = "mb-2 block text-sm font-semibold text-slate-700";

const MAX_LOGO_SIZE = 2 * 1024 * 1024;
const allowedLogoTypes = ["image/png", "image/jpeg", "image/webp"];

async function readResponse(response) {
    const text = await response.text();
    let data = {};

    if (text) {
        try {
            data = JSON.parse(text);
        } catch {
            const error = new Error(
                `Invalid server response (HTTP ${response.status}). Check the API route.`
            );
            error.status = response.status;
            throw error;
        }
    }

    if (!response.ok) {
        const error = new Error(
            data.message || `Request failed (HTTP ${response.status}).`
        );
        error.status = response.status;
        error.data = data;
        throw error;
    }

    return data;
}

function normalizePermissions(value) {
    return {
        view: value?.view === true,
        create: value?.create === true,
        update: value?.update === true,
        delete: value?.delete === true,
    };
}

function getCompanyLogo(company) {
    const rawLogo =
        company?.logo_url ||
        company?.logoUrl ||
        company?.company_logo_url ||
        company?.companyLogoUrl ||
        company?.company_logo ||
        company?.logo_path ||
        company?.logoPath ||
        company?.logo ||
        "";

    if (typeof rawLogo !== "string" || !rawLogo.trim()) {
        return "";
    }

    const logo = rawLogo.trim();

    if (/^(data:image\/|blob:)/i.test(logo)) return logo;
    if (/^https?:\/\//i.test(logo)) return logo;

    if (logo.startsWith("//")) {
        return `${window.location.protocol}${logo}`;
    }

    return `/${logo.replace(/\\/g, "/").replace(/^\/+/, "")}`;
}

function SectionHeading({ icon: Icon, title, description }) {
    return (
        <div className="mb-6 flex items-start gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-700 ring-1 ring-blue-100">
                <Icon size={21} />
            </div>
            <div>
                <h2 className="text-lg font-bold tracking-tight text-slate-900">
                    {title}
                </h2>
                {description && (
                    <p className="mt-1 text-sm leading-6 text-slate-500">
                        {description}
                    </p>
                )}
            </div>
        </div>
    );
}

function Alert({ type = "error", children }) {
    const styles =
        type === "success"
            ? "border-emerald-200 bg-emerald-50 text-emerald-800"
            : "border-red-200 bg-red-50 text-red-800";

    return (
        <div
            role={type === "success" ? "status" : "alert"}
            className={`flex items-start gap-3 rounded-xl border p-4 text-sm ${styles}`}
        >
            {type === "success" ? (
                <CheckCircle2 size={19} className="mt-0.5 shrink-0" />
            ) : (
                <X size={19} className="mt-0.5 shrink-0" />
            )}
            <div className="min-w-0 flex-1">{children}</div>
        </div>
    );
}

function AccessDenied({
    message = "You do not have permission to view companies.",
}) {
    return (
        <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-12 text-slate-900">
            <div className="w-full max-w-lg rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-xl shadow-slate-200/50 sm:p-10">
                <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-2xl bg-amber-50 text-amber-600 ring-1 ring-amber-100">
                    <LockKeyhole size={36} />
                </div>
                <h1 className="mt-6 text-2xl font-extrabold tracking-tight text-slate-950">
                    Access Restricted
                </h1>
                <p className="mx-auto mt-3 max-w-sm text-sm leading-6 text-slate-600">
                    {message}
                </p>
                <p className="mt-5 text-xs leading-5 text-slate-500">
                    If you need access, contact your administrator to update
                    your user rights.
                </p>
                <Link
                    href="/dashboard"
                    className="mt-7 inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-3 text-sm font-bold text-white transition hover:bg-blue-700"
                >
                    <ArrowLeft size={16} />
                    Back to Dashboard
                </Link>
            </div>
        </main>
    );
}

function CompanyLogo({ company }) {
    const logoUrl = getCompanyLogo(company);
    const [failedUrl, setFailedUrl] = useState("");

    const failed = Boolean(logoUrl && failedUrl === logoUrl);

    return (
        <div className="relative h-full w-full overflow-hidden bg-white">
            {logoUrl && !failed ? (
                <Image
                    key={logoUrl}
                    src={logoUrl}
                    alt={`${company.company_name || "Company"} logo`}
                    fill
                    unoptimized
                    sizes="(max-width: 640px) 100vw, 400px"
                    className="object-cover"
                    onError={() => setFailedUrl(logoUrl)}
                />
            ) : (
                <div className="flex h-full w-full flex-col items-center justify-center bg-gradient-to-br from-slate-50 to-blue-50 text-blue-600">
                    <Building2 size={48} strokeWidth={1.4} />
                    <span className="mt-2 text-xs font-medium text-slate-500">
                        {failed ? "Logo unavailable" : "No company logo"}
                    </span>
                </div>
            )}
        </div>
    );
}

function CompanySelectionView({
    onRegister,
    onPermissionsChange,
    permissions,
}) {
    const [companies, setCompanies] = useState([]);
    const [loadingCompanies, setLoadingCompanies] = useState(true);
    const [companyError, setCompanyError] = useState(false);
    const [companyErrorMessage, setCompanyErrorMessage] = useState("");
    const [accessDenied, setAccessDenied] = useState(false);

    const requestControllerRef = useRef(null);

    const loadCompanies = useCallback(
        async (signal) => {
            try {
                const response = await fetch("/api/settings/list", {
                    method: "GET",
                    cache: "no-store",
                    headers: { Accept: "application/json" },
                    signal,
                });

                const data = await readResponse(response);

                if (signal?.aborted) return;

                const nextPermissions = normalizePermissions(
                    data.permissions
                );

                onPermissionsChange(nextPermissions);

                if (!nextPermissions.view) {
                    setCompanies([]);
                    setAccessDenied(true);
                    setCompanyError(false);
                    setCompanyErrorMessage("");
                    return;
                }

                setAccessDenied(false);
                setCompanies(
                    Array.isArray(data.companies) ? data.companies : []
                );
                setCompanyError(false);
                setCompanyErrorMessage("");
            } catch (error) {
                if (error.name === "AbortError" || signal?.aborted) {
                    return;
                }

                if (error.status === 401 || error.status === 403) {
                    onPermissionsChange(defaultPermissions);
                    setCompanies([]);
                    setAccessDenied(true);
                    setCompanyError(false);
                    setCompanyErrorMessage("");
                    return;
                }

                setCompanyError(true);
                setCompanyErrorMessage(
                    error.message || "Unable to load companies."
                );
            } finally {
                if (!signal?.aborted) {
                    setLoadingCompanies(false);
                }
            }
        },
        [onPermissionsChange]
    );

    const retryLoadingCompanies = useCallback(() => {
        requestControllerRef.current?.abort();

        const controller = new AbortController();
        requestControllerRef.current = controller;

        setLoadingCompanies(true);
        setCompanyError(false);
        setCompanyErrorMessage("");
        setAccessDenied(false);

        void loadCompanies(controller.signal);
    }, [loadCompanies]);

    /*
     * Defer the initial request to a microtask. This avoids synchronously
     * invoking a state-updating loader from the effect body.
     */
    useEffect(() => {
        const controller = new AbortController();
        requestControllerRef.current = controller;

        Promise.resolve().then(() => {
            if (!controller.signal.aborted) {
                void loadCompanies(controller.signal);
            }
        });

        return () => {
            controller.abort();

            if (requestControllerRef.current === controller) {
                requestControllerRef.current = null;
            }
        };
    }, [loadCompanies]);

    /*
     * Refresh the company list when the browser tab regains focus.
     */
    useEffect(() => {
        function handleVisibilityChange() {
            if (document.visibilityState === "visible") {
                retryLoadingCompanies();
            }
        }

        window.addEventListener("focus", retryLoadingCompanies);
        document.addEventListener(
            "visibilitychange",
            handleVisibilityChange
        );

        return () => {
            window.removeEventListener("focus", retryLoadingCompanies);
            document.removeEventListener(
                "visibilitychange",
                handleVisibilityChange
            );
            requestControllerRef.current?.abort();
        };
    }, [retryLoadingCompanies]);

    if (loadingCompanies) {
        return (
            <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4 text-slate-900">
                <div className="flex w-full max-w-lg flex-col items-center justify-center rounded-3xl border border-slate-200 bg-white px-6 py-14 text-center shadow-sm">
                    <LoaderCircle
                        size={36}
                        className="animate-spin text-blue-600"
                    />
                    <h1 className="mt-5 text-xl font-extrabold">
                        Checking company permissions
                    </h1>
                    <p className="mt-2 text-sm text-slate-500">
                        Please wait while we verify your access rights.
                    </p>
                </div>
            </main>
        );
    }

    if (accessDenied || !permissions.view) {
        return (
            <AccessDenied message="Your role does not have View permission for Company Management. Ask your administrator to enable View in the user-rights matrix." />
        );
    }

    return (
        <main className="relative min-h-screen bg-slate-50 text-slate-900">
            <div className="pointer-events-none absolute inset-x-0 top-0 h-72 bg-gradient-to-b from-blue-100/70 via-indigo-50/40 to-transparent" />

            <div className="relative mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 lg:py-12">
                <header className="mb-9 flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
                    <div>
                        <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-blue-100 bg-white/90 px-3 py-1.5 text-xs font-bold uppercase tracking-wider text-blue-700 shadow-sm">
                            <Sparkles size={14} />
                            ERP Company Portal
                        </div>

                        <h1 className="text-3xl font-extrabold tracking-tight text-slate-950 sm:text-4xl">
                            Your Companies
                        </h1>
                        <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600 sm:text-base">
                            View your company profiles and access your ERP
                            workspace from one place.
                        </p>

                        <div className="mt-4 flex flex-wrap gap-2">
                            <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700">
                                <CheckCircle2 size={14} />
                                View enabled
                            </span>

                            {!permissions.create && (
                                <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600">
                                    <LockKeyhole size={14} />
                                    Read-only access
                                </span>
                            )}
                        </div>
                    </div>

                    {permissions.create && (
                        <button
                            type="button"
                            onClick={onRegister}
                            className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-3 text-sm font-bold text-white shadow-lg shadow-blue-600/20 transition hover:-translate-y-0.5 hover:bg-blue-700 focus:outline-none focus:ring-4 focus:ring-blue-500/20"
                        >
                            <Plus size={19} />
                            Register New Company
                        </button>
                    )}
                </header>

                {companyError && (
                    <div className="mb-6">
                        <Alert>{companyErrorMessage}</Alert>
                        <button
                            type="button"
                            onClick={retryLoadingCompanies}
                            className="mt-3 inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                        >
                            <RefreshCw size={15} />
                            Try again
                        </button>
                    </div>
                )}

                <div className="mb-7 grid gap-4 sm:grid-cols-2">
                    <div className="flex items-center gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-50 text-blue-700">
                            <Building2 size={23} />
                        </div>
                        <div>
                            <p className="text-sm text-slate-500">
                                Registered companies
                            </p>
                            <p className="mt-1 text-2xl font-extrabold text-slate-900">
                                {companyError ? "—" : companies.length}
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700">
                            <ShieldCheck size={23} />
                        </div>
                        <div>
                            <p className="text-sm font-semibold text-slate-800">
                                Company access
                            </p>
                            <p className="mt-1 text-sm text-slate-500">
                                {permissions.create
                                    ? "You can view and register companies."
                                    : "You can view companies without registering new ones."}
                            </p>
                        </div>
                    </div>
                </div>

                {companyError ? (
                    <div className="rounded-2xl border border-slate-200 bg-white px-6 py-12 text-center shadow-sm">
                        <Building2
                            size={38}
                            className="mx-auto text-slate-400"
                        />
                        <h2 className="mt-4 text-xl font-bold text-slate-900">
                            Companies could not be loaded
                        </h2>
                        <p className="mt-2 text-sm text-slate-500">
                            Try again to retrieve the company list.
                        </p>
                    </div>
                ) : companies.length === 0 ? (
                    <div className="rounded-3xl border border-dashed border-slate-300 bg-white px-6 py-16 text-center shadow-sm">
                        <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-100 to-indigo-100 text-blue-700">
                            <Building2 size={36} />
                        </div>
                        <h2 className="mt-6 text-2xl font-extrabold text-slate-900">
                            No companies available
                        </h2>
                        <p className="mx-auto mt-3 max-w-lg text-sm leading-6 text-slate-500">
                            There are currently no companies available to
                            display for your account.
                        </p>
                        {permissions.create && (
                            <button
                                type="button"
                                onClick={onRegister}
                                className="mt-7 inline-flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-3 font-bold text-white shadow-lg shadow-blue-600/20 hover:bg-blue-700"
                            >
                                <Plus size={18} />
                                Register Your First Company
                            </button>
                        )}
                    </div>
                ) : (
                    <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-3">
                        {companies.map((company) => (
                            <article
                                key={company.company_id}
                                className="group overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition duration-200 hover:-translate-y-1 hover:border-blue-200 hover:shadow-xl hover:shadow-slate-200/60"
                            >
                                <div className="relative h-44 w-full overflow-hidden border-b border-slate-100">
                                    <CompanyLogo company={company} />
                                    <div className="absolute left-3 top-3 z-10 rounded-full border border-white/70 bg-white/90 px-3 py-1 text-xs font-bold text-slate-700 shadow-sm backdrop-blur">
                                        Company #{company.company_id}
                                    </div>
                                </div>

                                <div className="p-5">
                                    <h2
                                        title={company.company_name}
                                        className="truncate text-xl font-extrabold tracking-tight text-slate-900"
                                    >
                                        {company.company_name}
                                    </h2>

                                    <div className="mt-4 space-y-3 text-sm text-slate-600">
                                        {(company.address ||
                                            company.city ||
                                            company.location) && (
                                            <div className="flex items-start gap-2.5">
                                                <MapPin
                                                    size={17}
                                                    className="mt-0.5 shrink-0 text-blue-600"
                                                />
                                                <span className="leading-5">
                                                    {[
                                                        company.address,
                                                        company.city,
                                                        company.location,
                                                    ]
                                                        .filter(Boolean)
                                                        .filter(
                                                            (value, index, array) =>
                                                                array.indexOf(value) === index
                                                        )
                                                        .join(", ")}
                                                </span>
                                            </div>
                                        )}

                                        {company.phone && (
                                            <div className="flex items-start gap-2.5">
                                                <Phone
                                                    size={16}
                                                    className="mt-0.5 shrink-0 text-slate-400"
                                                />
                                                <span className="break-words">
                                                    {company.phone}
                                                </span>
                                            </div>
                                        )}

                                        {(company.email ||
                                            company.company_email) && (
                                            <div className="flex items-start gap-2.5">
                                                <Mail
                                                    size={16}
                                                    className="mt-0.5 shrink-0 text-slate-400"
                                                />
                                                <span className="break-all">
                                                    {company.email ||
                                                        company.company_email}
                                                </span>
                                            </div>
                                        )}

                                        {company.currency && (
                                            <div className="flex items-center gap-2.5">
                                                <Wallet
                                                    size={16}
                                                    className="shrink-0 text-slate-400"
                                                />
                                                <span>
                                                    Currency:{" "}
                                                    <strong className="text-slate-800">
                                                        {company.currency}
                                                    </strong>
                                                </span>
                                            </div>
                                        )}
                                    </div>

                                    <div className="mt-6 grid grid-cols-2 gap-2.5">
                                        <Link
                                            href={`/login?companyId=${encodeURIComponent(
                                                company.company_id
                                            )}&companyName=${encodeURIComponent(
                                                company.company_name || ""
                                            )}`}
                                            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-blue-600 px-3 py-2.5 text-sm font-bold text-white transition hover:bg-blue-700"
                                        >
                                            <LogIn size={16} />
                                            Login
                                        </Link>

                                        <Link
                                            href={`/forgot-password?companyId=${encodeURIComponent(
                                                company.company_id
                                            )}&companyName=${encodeURIComponent(
                                                company.company_name || ""
                                            )}`}
                                            className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-xl border border-blue-100 bg-blue-50 px-2 py-2.5 text-sm font-semibold text-blue-700 transition hover:bg-blue-100"
                                        >
                                            <RefreshCw size={15} />
                                            Reset Password
                                        </Link>

                                        {permissions.update && (
                                            <Link
                                                href={`/dashboard/companies/edit/${encodeURIComponent(
                                                    company.company_id
                                                )}`}
                                                className="col-span-2 inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-bold text-slate-700 transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700"
                                            >
                                                <Pencil size={16} />
                                                Edit Company
                                            </Link>
                                        )}
                                    </div>
                                </div>
                            </article>
                        ))}
                    </div>
                )}

                <footer className="mt-10 border-t border-slate-200 py-5 text-center text-xs text-slate-500">
                    Company Management Portal
                </footer>
            </div>
        </main>
    );
}

export default function RegisterCompanyPage() {
    const [showRegistrationForm, setShowRegistrationForm] = useState(false);
    const [permissions, setPermissions] = useState(defaultPermissions);
    const [form, setForm] = useState(initialForm);
    const [users, setUsers] = useState([]);
    const [roles, setRoles] = useState([]);
    const [logoFile, setLogoFile] = useState(null);
    const [logoPreview, setLogoPreview] = useState("");
    const [loadingOptions, setLoadingOptions] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [success, setSuccess] = useState("");

    const canView = permissions.view === true;
    const canCreate = permissions.create === true;

    const handlePermissionsChange = useCallback((nextPermissions) => {
        setPermissions(normalizePermissions(nextPermissions));
    }, []);

    /*
     * Load registration options only when View and Create are enabled.
     * The early-return branch deliberately does not call setState.
     */
    useEffect(() => {
        if (!showRegistrationForm || !canView || !canCreate) {
            return undefined;
        }

        const controller = new AbortController();

        async function fetchOptions() {
            try {
                const response = await fetch("/api/companies/register", {
                    method: "GET",
                    cache: "no-store",
                    headers: { Accept: "application/json" },
                    signal: controller.signal,
                });

                const data = await readResponse(response);

                if (controller.signal.aborted) return;

                setUsers(Array.isArray(data.users) ? data.users : []);

                const availableRoles = Array.isArray(data.roles)
                    ? data.roles
                    : [];

                setRoles(availableRoles);

                setForm((current) => {
                    const currentRoleExists = availableRoles.some(
                        (role) =>
                            String(role.role_id) === current.existingRoleId
                    );

                    const defaultRole =
                        availableRoles.find(
                            (role) =>
                                role.role_name?.toUpperCase() === "USER"
                        ) || availableRoles[0];

                    return {
                        ...current,
                        existingRoleId: currentRoleExists
                            ? current.existingRoleId
                            : String(defaultRole?.role_id ?? ""),
                    };
                });
            } catch (err) {
                if (
                    err.name !== "AbortError" &&
                    !controller.signal.aborted
                ) {
                    if (err.status === 401 || err.status === 403) {
                        setPermissions(defaultPermissions);
                        setShowRegistrationForm(false);
                        setError(
                            "You are not authorized to register a company. Check your company permissions."
                        );
                    } else {
                        setError(
                            err.message ||
                                "Unable to load existing users and roles."
                        );
                    }
                }
            } finally {
                if (!controller.signal.aborted) {
                    setLoadingOptions(false);
                }
            }
        }

        /*
         * Defer the request start so the effect itself does not synchronously
         * execute state updates from the asynchronous request function.
         */
        Promise.resolve().then(() => {
            if (!controller.signal.aborted) {
                void fetchOptions();
            }
        });

        return () => controller.abort();
    }, [showRegistrationForm, canView, canCreate]);

    function updateField(event) {
        const { name, value } = event.target;

        setForm((current) => ({
            ...current,
            [name]: value,
        }));

        setError("");
        setSuccess("");
    }

    function changeAssignmentMode(mode) {
        if (!canView || !canCreate) {
            setError("You do not have permission to register a company.");
            return;
        }

        setForm((current) => ({
            ...current,
            assignmentMode: mode,
        }));

        setError("");
        setSuccess("");
    }

    function handleLogoChange(event) {
        if (!canView || !canCreate) {
            setError("You do not have permission to register a company.");
            event.currentTarget.value = "";
            return;
        }

        const input = event.currentTarget;
        const file = input.files?.[0];

        if (!file) return;

        if (!allowedLogoTypes.includes(file.type)) {
            setError("Choose a PNG, JPG, or WebP image.");
            input.value = "";
            return;
        }

        if (file.size > MAX_LOGO_SIZE) {
            setError("Company logo must be 2 MB or smaller.");
            input.value = "";
            return;
        }

        const reader = new FileReader();

        reader.onload = () => {
            if (typeof reader.result === "string") {
                setLogoFile(file);
                setLogoPreview(reader.result);
                setError("");
                setSuccess("");
            }
        };

        reader.onerror = () => {
            setError("Unable to read this image. Please try another file.");
            input.value = "";
        };

        reader.readAsDataURL(file);
    }

    function removeLogo() {
        if (!canView || !canCreate) {
            setError("You do not have permission to register a company.");
            return;
        }

        setLogoFile(null);
        setLogoPreview("");

        const input = document.getElementById("companyLogo");

        if (input) input.value = "";

        setError("");
        setSuccess("");
    }

    function validateForm() {
        if (!canView || !canCreate) {
            return "You do not have permission to register a company.";
        }

        if (!form.companyName.trim()) {
            return "Company name is required.";
        }

        if (form.assignmentMode === "existingUser") {
            if (!form.existingUserId || !form.existingRoleId) {
                return "Select an existing user and their role.";
            }

            if (!form.companyPassword || !form.confirmCompanyPassword) {
                return "Enter and confirm the password for this company.";
            }

            if (form.companyPassword.length < 8) {
                return "Company password must be at least 8 characters long.";
            }

            if (form.companyPassword !== form.confirmCompanyPassword) {
                return "Company passwords do not match.";
            }
        } else {
            if (
                !form.fullName.trim() ||
                !form.username.trim() ||
                !form.adminEmail.trim() ||
                !form.password ||
                !form.confirmPassword
            ) {
                return "Complete all required administrator fields.";
            }

            if (form.password.length < 8) {
                return "Password must be at least 8 characters long.";
            }

            if (form.password !== form.confirmPassword) {
                return "Passwords do not match.";
            }
        }

        return "";
    }

    async function handleSubmit(event) {
        event.preventDefault();

        setError("");
        setSuccess("");

        if (!canView || !canCreate) {
            setError("You do not have permission to register a company.");
            setShowRegistrationForm(false);
            return;
        }

        const validationError = validateForm();

        if (validationError) {
            setError(validationError);
            return;
        }

        setLoading(true);

        try {
            const body = new FormData();

            Object.entries(form).forEach(([key, value]) => {
                body.append(key, value);
            });

            body.set(
                "existingUserId",
                form.assignmentMode === "existingUser"
                    ? form.existingUserId
                    : ""
            );

            body.set(
                "existingRoleId",
                form.assignmentMode === "existingUser"
                    ? form.existingRoleId
                    : ""
            );

            if (form.assignmentMode !== "existingUser") {
                body.set("companyPassword", "");
                body.set("confirmCompanyPassword", "");
            }

            if (logoFile) {
                body.append("companyLogo", logoFile, logoFile.name);
            }

            const response = await fetch("/api/companies/register", {
                method: "POST",
                headers: { Accept: "application/json" },
                body,
            });

            const data = await readResponse(response);

            setSuccess(data.message || "Company registered successfully.");

            setForm({
                ...initialForm,
                assignmentMode: form.assignmentMode,
                existingRoleId: form.existingRoleId,
            });

            setLogoFile(null);
            setLogoPreview("");

            const logoInput = document.getElementById("companyLogo");

            if (logoInput) logoInput.value = "";
        } catch (err) {
            if (err.status === 401 || err.status === 403) {
                setError(
                    "Registration was denied. Your administrator may have changed your permissions."
                );
            } else {
                setError(err.message || "Company registration failed.");
            }
        } finally {
            setLoading(false);
        }
    }

    const selectedRole = roles.find(
        (role) => String(role.role_id) === form.existingRoleId
    );

    if (!showRegistrationForm || !canView || !canCreate) {
        return (
            <CompanySelectionView
                permissions={permissions}
                onPermissionsChange={handlePermissionsChange}
                onRegister={() => {
                    if (!canView || !canCreate) {
                        setError(
                            "You need View and Create permissions to register a company."
                        );
                        return;
                    }

                    setError("");
                    setSuccess("");
                    setLoadingOptions(true);
                    setShowRegistrationForm(true);
                }}
            />
        );
    }

    return (
        <main className="relative min-h-screen bg-slate-50 text-slate-900">
            <div className="pointer-events-none absolute inset-x-0 top-0 h-80 bg-gradient-to-b from-blue-100/70 via-indigo-50/40 to-transparent" />

            <div className="relative mx-auto max-w-5xl px-4 py-7 sm:px-6 lg:px-8 lg:py-10">
                <button
                    type="button"
                    onClick={() => {
                        setShowRegistrationForm(false);
                        setError("");
                        setSuccess("");
                    }}
                    className="mb-7 inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700"
                >
                    <ArrowLeft size={17} />
                    Back to Companies
                </button>

                <header className="mb-8">
                    <div className="flex items-start gap-4">
                        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-600 text-white shadow-lg shadow-blue-600/20">
                            <Building2 size={29} />
                        </div>
                        <div>
                            <div className="mb-1 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-blue-700">
                                <Sparkles size={14} />
                                Company setup
                            </div>
                            <h1 className="text-3xl font-extrabold tracking-tight text-slate-950 sm:text-4xl">
                                Register Your Company
                            </h1>
                            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600 sm:text-base">
                                Create your company profile, upload its logo,
                                and configure initial access to your ERP.
                            </p>
                        </div>
                    </div>
                </header>

                {error && <Alert>{error}</Alert>}

                {success && (
                    <div className="mt-6">
                        <Alert type="success">
                            <p>{success}</p>
                            <button
                                type="button"
                                onClick={() => {
                                    setShowRegistrationForm(false);
                                    setSuccess("");
                                }}
                                className="mt-2 font-bold underline underline-offset-4"
                            >
                                Return to company list
                            </button>
                        </Alert>
                    </div>
                )}

                <form
                    onSubmit={handleSubmit}
                    encType="multipart/form-data"
                    className="mt-6 overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-xl shadow-slate-200/50"
                >
                    <div className="space-y-9 p-5 sm:p-8 lg:p-10">
                        <section>
                            <SectionHeading
                                icon={Building2}
                                title="Company Information"
                                description="Add your company's identity and primary contact details."
                            />

                            <div className="mb-7 overflow-hidden rounded-2xl border border-blue-100 bg-gradient-to-br from-blue-50/80 via-white to-indigo-50/70 p-5 sm:p-6">
                                <div className="mb-5 flex items-center gap-3">
                                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white text-blue-700 shadow-sm ring-1 ring-blue-100">
                                        <ImagePlus size={20} />
                                    </div>
                                    <div>
                                        <h3 className="font-bold text-slate-900">
                                            Company logo
                                        </h3>
                                        <p className="mt-1 text-xs text-slate-500">
                                            PNG, JPG, or WebP · Maximum 2 MB
                                        </p>
                                    </div>
                                </div>

                                <div className="grid gap-5 md:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)] md:items-center">
                                    <div className="relative h-48 w-full overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-inner sm:h-56">
                                        {logoPreview ? (
                                            <Image
                                                key={logoPreview}
                                                src={logoPreview}
                                                alt="Company logo preview"
                                                fill
                                                unoptimized
                                                sizes="(max-width: 768px) 100vw, 500px"
                                                className="object-cover"
                                                onError={() =>
                                                    setError(
                                                        "The selected image could not be displayed."
                                                    )
                                                }
                                            />
                                        ) : (
                                            <div className="flex h-full w-full flex-col items-center justify-center text-slate-400">
                                                <Building2
                                                    size={44}
                                                    strokeWidth={1.3}
                                                />
                                                <span className="mt-3 text-xs font-semibold">
                                                    Logo preview
                                                </span>
                                            </div>
                                        )}

                                        {logoPreview && (
                                            <div className="absolute bottom-3 left-3 z-10 rounded-full border border-slate-200 bg-white/95 px-3 py-1 text-xs font-bold text-emerald-700 shadow-sm">
                                                Preview ready
                                            </div>
                                        )}
                                    </div>

                                    <div>
                                        <p className="text-sm leading-6 text-slate-600">
                                            Choose your company logo. The image
                                            will immediately appear in the
                                            preview and will be submitted when
                                            you register the company.
                                        </p>
                                        <div className="mt-5 flex flex-wrap gap-3">
                                            <label
                                                htmlFor="companyLogo"
                                                className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-3 text-sm font-bold text-white shadow-md shadow-blue-600/20 transition hover:bg-blue-700"
                                            >
                                                <Upload size={17} />
                                                Choose Logo
                                            </label>

                                            {logoFile && (
                                                <button
                                                    type="button"
                                                    onClick={removeLogo}
                                                    className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                                                >
                                                    <X size={16} />
                                                    Remove
                                                </button>
                                            )}
                                        </div>

                                        {logoFile && (
                                            <div className="mt-4 rounded-xl border border-emerald-100 bg-emerald-50 p-3">
                                                <p className="break-all text-sm font-semibold text-emerald-900">
                                                    {logoFile.name}
                                                </p>
                                                <p className="mt-1 text-xs text-emerald-700">
                                                    {(logoFile.size / 1024).toFixed(1)}{" "}
                                                    KB · Ready to upload
                                                </p>
                                            </div>
                                        )}

                                        <input
                                            id="companyLogo"
                                            type="file"
                                            accept="image/png,image/jpeg,image/webp"
                                            onChange={handleLogoChange}
                                            className="sr-only"
                                        />
                                    </div>
                                </div>
                            </div>

                            <div className="grid gap-5 sm:grid-cols-2">
                                <div className="sm:col-span-2">
                                    <label htmlFor="companyName" className={labelClass}>
                                        Company Name *
                                    </label>
                                    <input
                                        id="companyName"
                                        name="companyName"
                                        value={form.companyName}
                                        onChange={updateField}
                                        className={inputClass}
                                        placeholder="ABC Traders"
                                        maxLength={150}
                                        required
                                    />
                                </div>

                                <div>
                                    <label htmlFor="phone" className={labelClass}>
                                        Phone Number
                                    </label>
                                    <div className="relative">
                                        <Phone
                                            size={17}
                                            className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
                                        />
                                        <input
                                            id="phone"
                                            name="phone"
                                            type="tel"
                                            value={form.phone}
                                            onChange={updateField}
                                            className={`${inputClass} pl-10`}
                                            placeholder="+92 300 1234567"
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label htmlFor="companyEmail" className={labelClass}>
                                        Company Email
                                    </label>
                                    <div className="relative">
                                        <Mail
                                            size={17}
                                            className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
                                        />
                                        <input
                                            id="companyEmail"
                                            type="email"
                                            name="companyEmail"
                                            value={form.companyEmail}
                                            onChange={updateField}
                                            className={`${inputClass} pl-10`}
                                            placeholder="info@example.com"
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label htmlFor="currency" className={labelClass}>
                                        Currency *
                                    </label>
                                    <div className="relative">
                                        <Wallet
                                            size={17}
                                            className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
                                        />
                                        <select
                                            id="currency"
                                            name="currency"
                                            value={form.currency}
                                            onChange={updateField}
                                            className={`${inputClass} pl-10`}
                                            required
                                        >
                                            <option value="PKR">PKR - Pakistani Rupee</option>
                                            <option value="USD">USD - US Dollar</option>
                                            <option value="EUR">EUR - Euro</option>
                                            <option value="GBP">GBP - British Pound</option>
                                            <option value="AED">AED - UAE Dirham</option>
                                            <option value="SAR">SAR - Saudi Riyal</option>
                                            <option value="INR">INR - Indian Rupee</option>
                                        </select>
                                    </div>
                                </div>
                            </div>
                        </section>

                        <div className="border-t border-slate-100" />

                        <section>
                            <SectionHeading
                                icon={MapPin}
                                title="Company Location"
                                description="Enter the registered address and location of your business."
                            />

                            <div className="grid gap-5 sm:grid-cols-2">
                                <div className="sm:col-span-2">
                                    <label htmlFor="address" className={labelClass}>
                                        Street Address
                                    </label>
                                    <textarea
                                        id="address"
                                        name="address"
                                        value={form.address}
                                        onChange={updateField}
                                        className={`${inputClass} min-h-28 resize-y`}
                                        placeholder="Street, building, plaza, or area"
                                        maxLength={500}
                                        rows={3}
                                    />
                                </div>

                                <div>
                                    <label htmlFor="city" className={labelClass}>
                                        City
                                    </label>
                                    <input
                                        id="city"
                                        name="city"
                                        value={form.city}
                                        onChange={updateField}
                                        className={inputClass}
                                        placeholder="Faisalabad"
                                        maxLength={100}
                                    />
                                </div>

                                <div>
                                    <label htmlFor="province" className={labelClass}>
                                        Province / State
                                    </label>
                                    <input
                                        id="province"
                                        name="province"
                                        value={form.province}
                                        onChange={updateField}
                                        className={inputClass}
                                        placeholder="Punjab"
                                        maxLength={100}
                                    />
                                </div>

                                <div>
                                    <label htmlFor="country" className={labelClass}>
                                        Country
                                    </label>
                                    <div className="relative">
                                        <Globe
                                            size={17}
                                            className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
                                        />
                                        <input
                                            id="country"
                                            name="country"
                                            value={form.country}
                                            onChange={updateField}
                                            className={`${inputClass} pl-10`}
                                            placeholder="Pakistan"
                                            maxLength={100}
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label htmlFor="postalCode" className={labelClass}>
                                        Postal Code
                                    </label>
                                    <input
                                        id="postalCode"
                                        name="postalCode"
                                        value={form.postalCode}
                                        onChange={updateField}
                                        className={inputClass}
                                        placeholder="38000"
                                        maxLength={30}
                                    />
                                </div>
                            </div>
                        </section>

                        <div className="border-t border-slate-100" />

                        <section>
                            <SectionHeading
                                icon={UserRound}
                                title="Initial Company Access"
                                description="Choose how the first user will access the new company's ERP workspace."
                            />

                            <div className="mb-5 grid gap-4 sm:grid-cols-2">
                                <button
                                    type="button"
                                    onClick={() => changeAssignmentMode("newAdmin")}
                                    aria-pressed={form.assignmentMode === "newAdmin"}
                                    className={`rounded-2xl border p-5 text-left transition ${
                                        form.assignmentMode === "newAdmin"
                                            ? "border-blue-500 bg-blue-50/70 ring-2 ring-blue-500/15"
                                            : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50"
                                    }`}
                                >
                                    <div className="flex items-start justify-between gap-3">
                                        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-white text-blue-700 shadow-sm ring-1 ring-slate-200">
                                            <Plus size={21} />
                                        </div>
                                        {form.assignmentMode === "newAdmin" && (
                                            <CheckCircle2 size={20} className="text-blue-600" />
                                        )}
                                    </div>
                                    <span className="mt-4 block font-bold text-slate-900">
                                        Create New Administrator
                                    </span>
                                    <span className="mt-2 block text-sm leading-6 text-slate-500">
                                        Create a separate login account with the built-in ADMIN role.
                                    </span>
                                </button>

                                <button
                                    type="button"
                                    onClick={() => changeAssignmentMode("existingUser")}
                                    aria-pressed={form.assignmentMode === "existingUser"}
                                    className={`rounded-2xl border p-5 text-left transition ${
                                        form.assignmentMode === "existingUser"
                                            ? "border-blue-500 bg-blue-50/70 ring-2 ring-blue-500/15"
                                            : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50"
                                    }`}
                                >
                                    <div className="flex items-start justify-between gap-3">
                                        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-white text-indigo-700 shadow-sm ring-1 ring-slate-200">
                                            <UserRound size={21} />
                                        </div>
                                        {form.assignmentMode === "existingUser" && (
                                            <CheckCircle2 size={20} className="text-blue-600" />
                                        )}
                                    </div>
                                    <span className="mt-4 block font-bold text-slate-900">
                                        Assign Existing User
                                    </span>
                                    <span className="mt-2 block text-sm leading-6 text-slate-500">
                                        Assign an existing account and select its role for this company.
                                    </span>
                                </button>
                            </div>

                            {form.assignmentMode === "newAdmin" ? (
                                <div className="space-y-5 rounded-2xl border border-slate-200 bg-slate-50/70 p-5 sm:p-6">
                                    <div className="flex items-start gap-3 rounded-xl border border-blue-100 bg-blue-50 p-4 text-sm leading-6 text-blue-900">
                                        <ShieldCheck size={20} className="mt-0.5 shrink-0 text-blue-700" />
                                        <p>
                                            A separate administrator account will be created for this company.
                                            Usernames and email addresses must be unique.
                                        </p>
                                    </div>

                                    <div className="grid gap-5 sm:grid-cols-2">
                                        <div>
                                            <label htmlFor="fullName" className={labelClass}>
                                                Full Name *
                                            </label>
                                            <input
                                                id="fullName"
                                                name="fullName"
                                                value={form.fullName}
                                                onChange={updateField}
                                                className={inputClass}
                                                maxLength={150}
                                                autoComplete="name"
                                                placeholder="Administrator name"
                                                required
                                            />
                                        </div>

                                        <div>
                                            <label htmlFor="username" className={labelClass}>
                                                Username *
                                            </label>
                                            <input
                                                id="username"
                                                name="username"
                                                value={form.username}
                                                onChange={updateField}
                                                className={inputClass}
                                                minLength={3}
                                                maxLength={100}
                                                autoComplete="username"
                                                placeholder="admin_user"
                                                required
                                            />
                                        </div>

                                        <div className="sm:col-span-2">
                                            <label htmlFor="adminEmail" className={labelClass}>
                                                Administrator Email *
                                            </label>
                                            <input
                                                id="adminEmail"
                                                type="email"
                                                name="adminEmail"
                                                value={form.adminEmail}
                                                onChange={updateField}
                                                className={inputClass}
                                                autoComplete="email"
                                                placeholder="admin@example.com"
                                                required
                                            />
                                        </div>

                                        <div>
                                            <label htmlFor="password" className={labelClass}>
                                                Password *
                                            </label>
                                            <input
                                                id="password"
                                                type="password"
                                                name="password"
                                                value={form.password}
                                                onChange={updateField}
                                                className={inputClass}
                                                minLength={8}
                                                autoComplete="new-password"
                                                placeholder="At least 8 characters"
                                                required
                                            />
                                        </div>

                                        <div>
                                            <label htmlFor="confirmPassword" className={labelClass}>
                                                Confirm Password *
                                            </label>
                                            <input
                                                id="confirmPassword"
                                                type="password"
                                                name="confirmPassword"
                                                value={form.confirmPassword}
                                                onChange={updateField}
                                                className={inputClass}
                                                minLength={8}
                                                autoComplete="new-password"
                                                placeholder="Re-enter password"
                                                required
                                            />
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <div className="space-y-5 rounded-2xl border border-slate-200 bg-slate-50/70 p-5 sm:p-6">
                                    <div>
                                        <label htmlFor="existingUserId" className={labelClass}>
                                            Select Existing User *
                                        </label>
                                        <select
                                            id="existingUserId"
                                            name="existingUserId"
                                            value={form.existingUserId}
                                            onChange={updateField}
                                            className={inputClass}
                                            required
                                            disabled={loadingOptions || users.length === 0}
                                        >
                                            <option value="">
                                                {loadingOptions
                                                    ? "Loading users..."
                                                    : "Select an existing user"}
                                            </option>
                                            {users.map((user) => (
                                                <option
                                                    key={user.user_id}
                                                    value={String(user.user_id)}
                                                >
                                                    {user.full_name} (@{user.username})
                                                    {user.email ? ` — ${user.email}` : ""}
                                                </option>
                                            ))}
                                        </select>

                                        {!loadingOptions && users.length === 0 && (
                                            <p className="mt-2 text-sm text-amber-700">
                                                No existing users are available for assignment.
                                            </p>
                                        )}
                                    </div>

                                    <div>
                                        <label htmlFor="existingRoleId" className={labelClass}>
                                            Role in New Company *
                                        </label>
                                        <select
                                            id="existingRoleId"
                                            name="existingRoleId"
                                            value={form.existingRoleId}
                                            onChange={updateField}
                                            className={inputClass}
                                            required
                                            disabled={loadingOptions || roles.length === 0}
                                        >
                                            <option value="">Select a role</option>
                                            {roles.map((role) => (
                                                <option
                                                    key={role.role_id}
                                                    value={String(role.role_id)}
                                                >
                                                    {role.role_name}
                                                </option>
                                            ))}
                                        </select>

                                        {selectedRole && (
                                            <p className="mt-2 text-xs text-slate-500">
                                                Selected role:{" "}
                                                <strong className="text-slate-700">
                                                    {selectedRole.role_name}
                                                </strong>
                                            </p>
                                        )}
                                    </div>

                                    <div className="grid gap-5 sm:grid-cols-2">
                                        <div>
                                            <label htmlFor="companyPassword" className={labelClass}>
                                                Password for This Company *
                                            </label>
                                            <input
                                                id="companyPassword"
                                                type="password"
                                                name="companyPassword"
                                                value={form.companyPassword}
                                                onChange={updateField}
                                                className={inputClass}
                                                minLength={8}
                                                autoComplete="new-password"
                                                required
                                            />
                                        </div>

                                        <div>
                                            <label htmlFor="confirmCompanyPassword" className={labelClass}>
                                                Confirm Company Password *
                                            </label>
                                            <input
                                                id="confirmCompanyPassword"
                                                type="password"
                                                name="confirmCompanyPassword"
                                                value={form.confirmCompanyPassword}
                                                onChange={updateField}
                                                className={inputClass}
                                                minLength={8}
                                                autoComplete="new-password"
                                                required
                                            />
                                        </div>
                                    </div>

                                    <div className="flex items-start gap-3 rounded-xl border border-blue-100 bg-blue-50 p-4 text-sm leading-6 text-blue-900">
                                        <ShieldCheck size={20} className="mt-0.5 shrink-0 text-blue-700" />
                                        <p>
                                            The registration API must explicitly support a separate company
                                            password for this option. The current API code you shared does not
                                            implement that behavior.
                                        </p>
                                    </div>
                                </div>
                            )}
                        </section>
                    </div>

                    <div className="border-t border-slate-200 bg-slate-50/80 px-5 py-5 sm:px-8 lg:px-10">
                        <button
                            type="submit"
                            disabled={
                                !canView ||
                                !canCreate ||
                                loading ||
                                loadingOptions ||
                                (form.assignmentMode === "existingUser" &&
                                    (!form.existingUserId ||
                                        !form.existingRoleId ||
                                        !form.companyPassword ||
                                        !form.confirmCompanyPassword))
                            }
                            className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-3 text-sm font-bold text-white shadow-lg shadow-blue-600/20 transition hover:bg-blue-700 focus:outline-none focus:ring-4 focus:ring-blue-500/20 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                            {loading ? (
                                <>
                                    <LoaderCircle size={19} className="animate-spin" />
                                    Registering Company...
                                </>
                            ) : (
                                <>
                                    <Building2 size={18} />
                                    Register Company
                                </>
                            )}
                        </button>

                        <p className="mt-4 text-center text-xs leading-5 text-slate-500">
                            Review your company information before submitting.
                        </p>
                    </div>
                </form>

                <footer className="py-6 text-center text-xs text-slate-500">
                    Company Management Portal
                </footer>
            </div>
        </main>
    );
}
