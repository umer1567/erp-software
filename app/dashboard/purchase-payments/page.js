"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

/* =========================================================
   DATE AND FORM HELPERS
========================================================= */

const getToday = () => {
    const date = new Date();

    return `${date.getFullYear()}-${String(
        date.getMonth() + 1
    ).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
};

const createEmptyForm = () => ({
    paymentNumber: "",
    purchaseId: "",
    paymentDate: getToday(),
    amount: "",
    paymentMethod: "CASH",
    referenceNumber: "",
    notes: "",
});

const formatAmount = (value) =>
    Number(value || 0).toLocaleString("en-PK", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    });

const getPaymentAmount = (payment) => Number(payment?.amount || 0);

const getPurchaseBalance = (purchase) =>
    Number(purchase?.balance_amount || 0);

const getPaymentIdentifier = (payment) =>
    payment?.payment_number || `PAY-${payment?.payment_id ?? "-"}`;

const getPaymentMethodLabel = (method) => {
    const methods = {
        CASH: "Cash",
        BANK: "Bank",
        CHEQUE: "Cheque",
        CARD: "Card",
        OTHER: "Other",
    };

    return methods[String(method || "").toUpperCase()] || method || "—";
};

/* =========================================================
   INLINE SVG ICONS
   No emoji or external icon library required.
========================================================= */

function Icon({ name, size = 20, className = "" }) {
    const icons = {
        plus: (
            <>
                <path d="M12 5v14" />
                <path d="M5 12h14" />
            </>
        ),
        edit: (
            <>
                <path d="M12 20h9" />
                <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L8 18l-4 1 1-4Z" />
            </>
        ),
        eye: (
            <>
                <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12Z" />
                <circle cx="12" cy="12" r="3" />
            </>
        ),
        receipt: (
            <>
                <path d="M4 3v18l3-2 3 2 3-2 3 2 4-2V3l-4 2-3-2-3 2-3-2Z" />
                <path d="M8 9h8M8 13h8" />
            </>
        ),
        calendar: (
            <>
                <rect x="3" y="5" width="18" height="16" rx="2" />
                <path d="M16 3v4M8 3v4M3 10h18" />
            </>
        ),
        wallet: (
            <>
                <rect x="3" y="5" width="18" height="15" rx="2" />
                <path d="M3 9h18" />
                <path d="M16 14h.01" />
                <path d="M3 5l13-2" />
            </>
        ),
        banknote: (
            <>
                <rect x="2" y="5" width="20" height="14" rx="2" />
                <circle cx="12" cy="12" r="3" />
                <path d="M6 9H5v1M18 15h1v-1" />
            </>
        ),
        search: (
            <>
                <circle cx="11" cy="11" r="7" />
                <path d="m20 20-4-4" />
            </>
        ),
        refresh: (
            <>
                <path d="M20 7v5h-5" />
                <path d="M4 17v-5h5" />
                <path d="M5.5 9A7 7 0 0 1 17 5l3 2" />
                <path d="M18.5 15A7 7 0 0 1 7 19l-3-2" />
            </>
        ),
        x: (
            <>
                <path d="m18 6-12 12" />
                <path d="m6 6 12 12" />
            </>
        ),
        check: <path d="m5 12 4 4L19 6" />,
        alert: (
            <>
                <path d="M10.3 3.9 2.4 17.5A2 2 0 0 0 4.1 20h15.8a2 2 0 0 0 1.7-2.5L13.7 3.9a2 2 0 0 0-3.4 0Z" />
                <path d="M12 9v4M12 17h.01" />
            </>
        ),
        file: (
            <>
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z" />
                <path d="M14 2v6h6M8 13h8M8 17h8" />
            </>
        ),
        download: (
            <>
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <path d="m7 10 5 5 5-5M12 15V3" />
            </>
        ),
        printer: (
            <>
                <path d="M6 9V3h12v6" />
                <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
                <path d="M6 14h12v7H6z" />
                <path d="M18 12h.01" />
            </>
        ),
        save: (
            <>
                <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2Z" />
                <path d="M17 21v-8H7v8M7 3v5h8" />
            </>
        ),
        arrowLeft: (
            <>
                <path d="m12 19-7-7 7-7" />
                <path d="M19 12H5" />
            </>
        ),
        chevronDown: <path d="m6 9 6 6 6-6" />,
        building: (
            <>
                <rect x="3" y="3" width="18" height="18" rx="2" />
                <path d="M9 21V9h6v12M7 7h.01M17 7h.01M7 11h.01M17 11h.01M7 15h.01M17 15h.01" />
            </>
        ),
        clock: (
            <>
                <circle cx="12" cy="12" r="9" />
                <path d="M12 7v5l3 2" />
            </>
        ),
        creditCard: (
            <>
                <rect x="2" y="5" width="20" height="14" rx="2" />
                <path d="M2 10h20M6 15h4" />
            </>
        ),
        note: (
            <>
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z" />
                <path d="M14 2v6h6M8 13h8M8 17h6" />
            </>
        ),
    };

    return (
        <svg
            xmlns="http://www.w3.org/2000/svg"
            width={size}
            height={size}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
            className={`shrink-0 ${className}`}
            aria-hidden="true"
        >
            {icons[name] || icons.file}
        </svg>
    );
}

/* =========================================================
   REUSABLE UI COMPONENTS
========================================================= */

const inputClass =
    "block w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:border-blue-400 dark:focus:ring-blue-400/10";

const labelClass =
    "mb-2 block text-sm font-semibold text-slate-700 dark:text-slate-200";

function SectionTitle({ icon, title, description, action }) {
    return (
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-400">
                    <Icon name={icon} size={22} />
                </div>

                <div>
                    <h2 className="text-lg font-bold tracking-tight text-slate-900 dark:text-white sm:text-xl">
                        {title}
                    </h2>

                    {description && (
                        <p className="mt-1 text-sm leading-6 text-slate-500 dark:text-slate-400">
                            {description}
                        </p>
                    )}
                </div>
            </div>

            {action}
        </div>
    );
}

function StatCard({ title, value, description, icon, color }) {
    const colorClasses = {
        blue: {
            icon: "bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-400",
            glow: "from-blue-500/10",
            border: "hover:border-blue-300 dark:hover:border-blue-500/40",
        },
        green: {
            icon: "bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400",
            glow: "from-emerald-500/10",
            border: "hover:border-emerald-300 dark:hover:border-emerald-500/40",
        },
        indigo: {
            icon: "bg-indigo-50 text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-400",
            glow: "from-indigo-500/10",
            border: "hover:border-indigo-300 dark:hover:border-indigo-500/40",
        },
    };

    const selectedColor = colorClasses[color] || colorClasses.blue;

    return (
        <div
            className={`relative overflow-hidden rounded-2xl border border-slate-200 bg-gradient-to-br ${selectedColor.glow} to-white p-5 shadow-sm transition duration-200 hover:-translate-y-0.5 hover:shadow-md dark:border-slate-800 dark:to-slate-900 ${selectedColor.border}`}
        >
            <div className="flex items-start justify-between gap-3">
                <div>
                    <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
                        {title}
                    </p>

                    <p className="mt-3 break-words text-2xl font-bold tracking-tight text-slate-900 dark:text-white sm:text-3xl">
                        {value}
                    </p>

                    <p className="mt-2 text-xs leading-5 text-slate-500 dark:text-slate-400">
                        {description}
                    </p>
                </div>

                <div
                    className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl ${selectedColor.icon}`}
                >
                    <Icon name={icon} size={24} />
                </div>
            </div>
        </div>
    );
}

function Field({ label, children, hint }) {
    return (
        <div className="min-w-0">
            <label className={labelClass}>{label}</label>
            {children}
            {hint && (
                <p className="mt-2 text-xs leading-5 text-slate-500 dark:text-slate-400">
                    {hint}
                </p>
            )}
        </div>
    );
}

function StatusMessage({ type, children, onClose }) {
    const isSuccess = type === "success";

    return (
        <div
            role={isSuccess ? "status" : "alert"}
            className={`mb-5 flex items-start gap-3 rounded-xl border px-4 py-3.5 shadow-sm ${isSuccess
                ? "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300"
                : "border-red-200 bg-red-50 text-red-800 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300"
                }`}
        >
            <Icon
                name={isSuccess ? "check" : "alert"}
                size={20}
                className="mt-0.5"
            />

            <div className="min-w-0 flex-1 text-sm font-medium leading-6">
                {children}
            </div>

            {onClose && (
                <button
                    type="button"
                    onClick={onClose}
                    aria-label="Dismiss message"
                    className="rounded-lg p-1 opacity-70 transition hover:bg-black/5 hover:opacity-100 dark:hover:bg-white/10"
                >
                    <Icon name="x" size={17} />
                </button>
            )}
        </div>
    );
}

function EmptyState({ title, description, action }) {
    return (
        <div className="flex flex-col items-center justify-center px-5 py-14 text-center">
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-400">
                <Icon name="receipt" size={30} />
            </div>

            <h3 className="text-base font-bold text-slate-900 dark:text-white">
                {title}
            </h3>

            <p className="mt-2 max-w-sm text-sm leading-6 text-slate-500 dark:text-slate-400">
                {description}
            </p>

            {action && <div className="mt-5">{action}</div>}
        </div>
    );
}

function ReceiptField({ label, value }) {
    return (
        <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-4 dark:border-slate-800 dark:bg-slate-800/40">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                {label}
            </p>

            <p className="mt-2 break-words text-sm font-semibold text-slate-900 dark:text-white">
                {value || "—"}
            </p>
        </div>
    );
}

function ReceiptAmountRow({
    label,
    value,
    highlight = false,
    last = false,
}) {
    return (
        <div
            className={`grid grid-cols-2 ${!last ? "border-b border-slate-100 dark:border-slate-800" : ""
                } ${highlight
                    ? "bg-emerald-50 dark:bg-emerald-500/10"
                    : "bg-white dark:bg-slate-900"
                }`}
        >
            <div className="p-4 text-sm font-medium text-slate-600 dark:text-slate-300">
                {label}
            </div>

            <div
                className={`p-4 text-right text-sm ${highlight
                    ? "font-bold text-emerald-700 dark:text-emerald-300"
                    : "font-semibold text-slate-800 dark:text-slate-100"
                    }`}
            >
                {formatAmount(value)}
            </div>
        </div>
    );
}

function PaymentMethodBadge({ method }) {
    const value = String(method || "OTHER").toUpperCase();

    const styles = {
        CASH: "bg-emerald-50 text-emerald-700 ring-emerald-600/20 dark:bg-emerald-500/10 dark:text-emerald-300 dark:ring-emerald-500/20",
        BANK: "bg-blue-50 text-blue-700 ring-blue-600/20 dark:bg-blue-500/10 dark:text-blue-300 dark:ring-blue-500/20",
        CHEQUE: "bg-indigo-50 text-indigo-700 ring-indigo-600/20 dark:bg-indigo-500/10 dark:text-indigo-300 dark:ring-indigo-500/20",
        CARD: "bg-violet-50 text-violet-700 ring-violet-600/20 dark:bg-violet-500/10 dark:text-violet-300 dark:ring-violet-500/20",
        OTHER: "bg-slate-100 text-slate-700 ring-slate-500/20 dark:bg-slate-800 dark:text-slate-300 dark:ring-slate-600/30",
    };

    return (
        <span
            className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset ${styles[value] || styles.OTHER
                }`}
        >
            {getPaymentMethodLabel(value)}
        </span>
    );
}

function LoadingScreen() {
    return (
        <div className="min-h-[60vh] bg-slate-50 p-4 dark:bg-slate-950 sm:p-6">
            <div className="mx-auto max-w-7xl animate-pulse space-y-6">
                <div className="h-32 rounded-3xl bg-slate-200 dark:bg-slate-800" />

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                    {Array.from({ length: 3 }).map((_, index) => (
                        <div
                            key={index}
                            className="h-36 rounded-2xl bg-slate-200 dark:bg-slate-800"
                        />
                    ))}
                </div>

                <div className="h-80 rounded-2xl bg-slate-200 dark:bg-slate-800" />
            </div>
        </div>
    );
}

/* =========================================================
   MAIN PAGE
========================================================= */

export default function PurchasePaymentsPage() {
    const [purchases, setPurchases] = useState([]);
    const [payments, setPayments] = useState([]);
    const [rights, setRights] = useState({
        canView: false,
        canCreate: false,
        canUpdate: false,
        canDelete: false,
    });

    const [permissionLoading, setPermissionLoading] = useState(true);

    const [form, setForm] = useState(createEmptyForm);

    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [saving, setSaving] = useState(false);
    const [popupLoading, setPopupLoading] = useState(false);

    const [error, setError] = useState("");
    const [message, setMessage] = useState("");

    const [showForm, setShowForm] = useState(false);
    const [editingPaymentId, setEditingPaymentId] = useState(null);

    const [selectedPayment, setSelectedPayment] = useState(null);
    const [showReceipt, setShowReceipt] = useState(false);

    const [search, setSearch] = useState("");

    /* ---------------------------------------------------------
       API RESPONSE HELPER
    --------------------------------------------------------- */

    const readApiResponse = useCallback(async (response) => {
        const text = await response.text();

        let data = {};

        if (text) {
            try {
                data = JSON.parse(text);
            } catch {
                throw new Error(
                    `Invalid API response (${response.status}). Check the server logs.`
                );
            }
        }

        if (!response.ok || data.success === false) {
            throw new Error(
                data.message ||
                data.error ||
                `Request failed (${response.status})`
            );
        }

        return data;
    }, []);

    /* ---------------------------------------------------------
       FETCH DATA
    --------------------------------------------------------- */

    const fetchData = useCallback(

        async ({ silent = false } = {}) => {
            if (!rights.canView) {
                return;
            }
            if (silent) {
                setRefreshing(true);
            } else {
                setLoading(true);
            }

            try {
                const [purchasesResponse, paymentsResponse] =
                    await Promise.all([
                        fetch("/api/purchases"),
                        fetch("/api/purchase-payments"),
                    ]);

                const [purchasesData, paymentsData] = await Promise.all([
                    readApiResponse(purchasesResponse),
                    readApiResponse(paymentsResponse),
                ]);

                setPurchases(purchasesData.purchases || []);
                setPayments(paymentsData.payments || []);

                if (silent) {
                    setMessage("Payment history refreshed successfully.");
                    setError("");
                }
            } catch (err) {
                setError(err.message || "Failed to load payment data.");
            } finally {
                if (silent) {
                    setRefreshing(false);
                } else {
                    setLoading(false);
                }
            }
        },
        [readApiResponse, rights.canView]
    );

    useEffect(() => {
        let cancelled = false;

        async function loadPermissionsAndData() {
            try {
                setPermissionLoading(true);
                setLoading(true);
                setError("");

                // First load the current user's permissions.
                const permissionResponse = await fetch(
                    "/api/permissions/current",
                    {
                        method: "GET",
                        credentials: "same-origin",
                        cache: "no-store",
                    }
                );

                const permissionData = await readApiResponse(
                    permissionResponse
                );

                const toBoolean = (value) =>
                    value === true ||
                    value === 1 ||
                    value === "1" ||
                    String(value).toLowerCase() === "true";

                const paymentPermission = (
                    permissionData.permissions || []
                ).find(
                    (permission) =>
                        String(
                            permission.permission_key || ""
                        ).toLowerCase() === "purchase_payment"
                );

                const userRights = {
                    canView: toBoolean(paymentPermission?.can_view),
                    canCreate: toBoolean(paymentPermission?.can_create),
                    canUpdate: toBoolean(paymentPermission?.can_update),
                    canDelete: toBoolean(paymentPermission?.can_delete),
                };

                if (cancelled) return;

                setRights(userRights);

                // Do not load payment data when the user cannot view this module.
                if (!userRights.canView) {
                    setLoading(false);
                    return;
                }

                const [purchasesResponse, paymentsResponse] =
                    await Promise.all([
                        fetch("/api/purchases", {
                            credentials: "same-origin",
                            cache: "no-store",
                        }),
                        fetch("/api/purchase-payments", {
                            credentials: "same-origin",
                            cache: "no-store",
                        }),
                    ]);

                const [purchasesData, paymentsData] = await Promise.all([
                    readApiResponse(purchasesResponse),
                    readApiResponse(paymentsResponse),
                ]);

                if (cancelled) return;

                setPurchases(purchasesData.purchases || []);
                setPayments(paymentsData.payments || []);
            } catch (err) {
                if (!cancelled) {
                    setError(
                        err.message || "Failed to load payment data."
                    );
                }
            } finally {
                if (!cancelled) {
                    setLoading(false);
                    setPermissionLoading(false);
                }
            }
        }

        loadPermissionsAndData();

        return () => {
            cancelled = true;
        };
    }, [readApiResponse]);

    /* ---------------------------------------------------------
       DERIVED DATA
    --------------------------------------------------------- */

    const selectedPurchase = useMemo(
        () =>
            purchases.find(
                (purchase) =>
                    Number(purchase.purchase_id) ===
                    Number(form.purchaseId)
            ),
        [purchases, form.purchaseId]
    );

    const totalPayments = useMemo(
        () => payments.reduce((sum, payment) => sum + getPaymentAmount(payment), 0),
        [payments]
    );

    const totalOutstanding = useMemo(
        () =>
            purchases.reduce(
                (sum, purchase) => sum + getPurchaseBalance(purchase),
                0
            ),
        [purchases]
    );

    const filteredPayments = useMemo(() => {
        const query = search.trim().toLowerCase();

        if (!query) return payments;

        return payments.filter((payment) => {
            const searchable = [
                payment.payment_number,
                payment.purchase_number,
                payment.supplier_name,
                payment.supplier_code,
                payment.reference_number,
                payment.payment_method,
                payment.payment_date,
            ]
                .filter(Boolean)
                .join(" ")
                .toLowerCase();

            return searchable.includes(query);
        });
    }, [payments, search]);

    /* ---------------------------------------------------------
       FORM ACTIONS
    --------------------------------------------------------- */

    function updateForm(name, value) {
        setForm((previous) => ({
            ...previous,
            [name]: value,
        }));
    }

    function resetForm() {
        setForm(createEmptyForm());
        setEditingPaymentId(null);
    }

    function openAddForm() {
        if (!rights.canCreate) {
            setError("You do not have permission to create purchase payments.");
            return;
        }

        resetForm();
        setSelectedPayment(null);
        setShowReceipt(false);
        setError("");
        setMessage("");
        setShowForm(true);

        window.scrollTo({
            top: 0,
            behavior: "smooth",
        });
    }

    function cancelForm() {
        resetForm();
        setShowForm(false);
        setError("");
        setMessage("");
    }

    /* ---------------------------------------------------------
       SAVE PAYMENT
    --------------------------------------------------------- */

    async function savePayment(event) {
        event.preventDefault();
        const isEditing = editingPaymentId !== null;

        if (isEditing && !rights.canUpdate) {
            setError("You do not have permission to update purchase payments.");
            return;
        }

        if (!isEditing && !rights.canCreate) {
            setError("You do not have permission to create purchase payments.");
            return;
        }
        setSaving(true);
        setError("");
        setMessage("");

        try {
            if (!form.purchaseId) {
                throw new Error("Please select a purchase.");
            }

            if (!form.paymentDate) {
                throw new Error("Payment date is required.");
            }

            const amount = Number(form.amount);

            if (!Number.isFinite(amount) || amount <= 0) {
                throw new Error(
                    "Payment amount must be greater than zero."
                );
            }

            const isEditing = editingPaymentId !== null;

            const payload = {
                ...form,
                paymentId: editingPaymentId,
                purchaseId: Number(form.purchaseId),
                amount,
            };

            const response = await fetch("/api/purchase-payments", {
                method: isEditing ? "PUT" : "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify(payload),
            });

            await readApiResponse(response);

            await fetchData({ silent: true });

            setMessage(
                isEditing
                    ? "Purchase payment updated successfully."
                    : "Purchase payment recorded successfully."
            );

            resetForm();
            setShowForm(false);
            setSelectedPayment(null);
            setShowReceipt(false);
        } catch (err) {
            setError(err.message || "Something went wrong.");
        } finally {
            setSaving(false);
        }
    }

    /* ---------------------------------------------------------
       VIEW PAYMENT RECEIPT
    --------------------------------------------------------- */

    async function openPayment(payment) {
        try {
            setError("");
            setMessage("");
            setPopupLoading(true);

            const response = await fetch(
                `/api/purchase-payments?id=${payment.payment_id}`
            );

            const data = await readApiResponse(response);

            const detailedPayment =
                data.payment ||
                (data.payments || []).find(
                    (item) =>
                        Number(item.payment_id) ===
                        Number(payment.payment_id)
                );

            setSelectedPayment(detailedPayment || payment);
            setShowReceipt(true);
        } catch {
            setSelectedPayment(payment);
            setShowReceipt(true);

            setError(
                "Could not load additional receipt details. Showing the available payment information."
            );
        } finally {
            setPopupLoading(false);
        }
    }

    /* ---------------------------------------------------------
       EDIT PAYMENT
    --------------------------------------------------------- */

    async function editPayment(payment) {
        if (!rights.canUpdate) {
            setError("You do not have permission to edit purchase payments.");
            return;
        }
        try {
            setError("");
            setMessage("");
            setPopupLoading(true);

            let detail = payment;

            try {
                const response = await fetch(
                    `/api/purchase-payments?id=${payment.payment_id}`
                );

                const data = await readApiResponse(response);

                detail =
                    data.payment ||
                    (data.payments || []).find(
                        (item) =>
                            Number(item.payment_id) ===
                            Number(payment.payment_id)
                    ) ||
                    payment;
            } catch {
                detail = payment;
            }

            setSelectedPayment(null);
            setShowReceipt(false);

            setEditingPaymentId(detail.payment_id);

            setForm({
                paymentNumber: detail.payment_number || "",
                purchaseId: String(detail.purchase_id || ""),
                paymentDate: detail.payment_date
                    ? String(detail.payment_date).split("T")[0]
                    : getToday(),
                amount:
                    detail.amount !== null &&
                        detail.amount !== undefined
                        ? String(detail.amount)
                        : "",
                paymentMethod: detail.payment_method || "CASH",
                referenceNumber: detail.reference_number || "",
                notes: detail.notes || "",
            });

            setShowForm(true);

            setMessage(
                `Editing Payment ${detail.payment_number || detail.payment_id}`
            );

            window.scrollTo({
                top: 0,
                behavior: "smooth",
            });
        } catch (err) {
            setError(err.message || "Failed to open payment for editing.");
        } finally {
            setPopupLoading(false);
        }
    }

    /* ---------------------------------------------------------
       RECEIPT ACTIONS
    --------------------------------------------------------- */

    function closeReceipt() {
        setShowReceipt(false);
        setSelectedPayment(null);
    }

    function printReceipt() {
        window.print();
    }

    function downloadPDF() {
        if (!selectedPayment) return;

        const payment = selectedPayment;
        const doc = new jsPDF();

        const amount = Number(payment.amount || 0).toFixed(2);

        const purchaseTotal = Number(
            payment.purchase_total ?? payment.total_amount ?? 0
        ).toFixed(2);

        const paidAmount = Number(
            payment.paid_amount ??
            payment.purchase_paid_amount ??
            0
        ).toFixed(2);

        const balanceAmount = Number(
            payment.balance_amount ??
            payment.purchase_balance_amount ??
            0
        ).toFixed(2);

        doc.setFillColor(15, 40, 75);
        doc.rect(0, 0, 210, 39, "F");

        doc.setTextColor(255, 255, 255);
        doc.setFontSize(20);
        doc.setFont("helvetica", "bold");
        doc.text("ERP SYSTEM", 105, 16, {
            align: "center",
        });

        doc.setFontSize(12);
        doc.text("PURCHASE PAYMENT RECEIPT", 105, 27, {
            align: "center",
        });

        doc.setFontSize(10);
        doc.setTextColor(60, 70, 85);
        doc.setFont("helvetica", "normal");

        doc.text(
            `Payment #: ${payment.payment_number || "-"}`,
            20,
            51
        );

        doc.text(
            `Date: ${formatDate(payment.payment_date)}`,
            20,
            59
        );

        doc.text(
            `Purchase #: ${payment.purchase_number || "-"}`,
            20,
            67
        );

        doc.text(
            `Supplier: ${payment.supplier_name || "-"}`,
            20,
            75
        );

        doc.text(
            `Supplier Code: ${payment.supplier_code || "-"}`,
            20,
            83
        );

        autoTable(doc, {
            startY: 94,
            head: [["Description", "Amount"]],
            body: [
                ["Purchase Total", purchaseTotal],
                ["Paid Amount", paidAmount],
                ["Payment Made", amount],
                ["Remaining Balance", balanceAmount],
            ],
            theme: "grid",
            styles: {
                fontSize: 10,
                cellPadding: 4,
                textColor: [45, 55, 72],
                lineColor: [226, 232, 240],
            },
            headStyles: {
                fillColor: [30, 64, 110],
                textColor: [255, 255, 255],
                fontStyle: "bold",
            },
            alternateRowStyles: {
                fillColor: [248, 250, 252],
            },
        });

        const finalY = doc.lastAutoTable
            ? doc.lastAutoTable.finalY + 15
            : 130;

        doc.setFont("helvetica", "bold");
        doc.text("Payment Method:", 20, finalY);

        doc.setFont("helvetica", "normal");
        doc.text(getPaymentMethodLabel(payment.payment_method), 65, finalY);

        doc.setFont("helvetica", "bold");
        doc.text("Reference Number:", 20, finalY + 8);

        doc.setFont("helvetica", "normal");
        doc.text(payment.reference_number || "-", 65, finalY + 8);

        doc.setFont("helvetica", "bold");
        doc.text("Notes:", 20, finalY + 20);

        doc.setFont("helvetica", "normal");

        const noteLines = doc.splitTextToSize(payment.notes || "-", 165);

        doc.text(noteLines, 20, finalY + 28);

        doc.setFontSize(9);
        doc.setTextColor(120, 130, 145);
        doc.text("Generated by ERP System", 105, 285, {
            align: "center",
        });

        const filename = String(
            payment.payment_number || "purchase-payment"
        ).replace(/[<>:"/\\|?*]+/g, "-");

        doc.save(`${filename}.pdf`);
    }

    /* ---------------------------------------------------------
       LOADING STATE
    --------------------------------------------------------- */

    if (loading || permissionLoading) {
        return <LoadingScreen />;
    }
    if (!rights.canView) {
        return (
            <div className="flex min-h-[70vh] items-center justify-center bg-slate-50 p-5 dark:bg-slate-950">
                <div className="w-full max-w-md rounded-2xl border border-red-200 bg-white p-8 text-center shadow-lg dark:border-red-500/30 dark:bg-slate-900">
                    <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-red-50 text-red-600 dark:bg-red-500/10 dark:text-red-400">
                        <Icon name="alert" size={32} />
                    </div>

                    <h2 className="mt-5 text-xl font-bold text-slate-900 dark:text-white">
                        Access Denied
                    </h2>

                    <p className="mt-3 text-sm leading-6 text-slate-500 dark:text-slate-400">
                        You do not have permission to view Purchase Payments.
                        Please contact your administrator to request access.
                    </p>

                    <button
                        type="button"
                        onClick={() => window.location.reload()}
                        className="mt-6 rounded-xl bg-blue-600 px-5 py-3 text-sm font-bold text-white transition hover:bg-blue-700"
                    >
                        Refresh Page
                    </button>
                </div>
            </div>
        );
    }

    /* ---------------------------------------------------------
       PAGE UI
    --------------------------------------------------------- */

    return (
        <div className="min-h-screen bg-slate-50/80 p-4 text-slate-900 transition-colors dark:bg-slate-950 dark:text-slate-100 sm:p-6 lg:p-8">
            <div className="mx-auto max-w-[1600px]">
                {/* PAGE HEADER */}

                <div className="relative mb-7 overflow-hidden rounded-3xl bg-gradient-to-br from-blue-700 via-blue-600 to-emerald-600 p-6 text-white shadow-xl shadow-blue-900/10 sm:p-8">
                    <div className="pointer-events-none absolute -right-12 -top-16 h-56 w-56 rounded-full border-[28px] border-white/10" />
                    <div className="pointer-events-none absolute -bottom-24 right-36 h-64 w-64 rounded-full border-[35px] border-white/10" />

                    <div className="relative z-10 flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
                        <div className="max-w-2xl">
                            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-xs font-semibold tracking-wide text-blue-50 backdrop-blur-sm">
                                <span className="h-2 w-2 rounded-full bg-emerald-300" />
                                ACCOUNTS PAYABLE
                            </div>

                            <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
                                Purchase Payments
                            </h1>

                            <p className="mt-3 max-w-xl text-sm leading-6 text-blue-50/90 sm:text-base">
                                Manage supplier payments, track outstanding
                                balances, and generate professional payment
                                receipts from one place.
                            </p>
                        </div>

                        <div className="relative flex flex-wrap items-center gap-3">
                            <button
                                type="button"
                                onClick={() => fetchData({ silent: true })}
                                disabled={refreshing || saving}
                                className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/25 bg-white/10 px-4 py-3 text-sm font-semibold text-white shadow-sm backdrop-blur-sm transition hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-60"
                            >
                                <Icon
                                    name="refresh"
                                    size={18}
                                    className={refreshing ? "animate-spin" : ""}
                                />
                                Refresh
                            </button>

                            {!showForm && rights.canCreate && (
                                <button
                                    type="button"
                                    onClick={openAddForm}
                                    className="inline-flex items-center justify-center gap-2 rounded-xl bg-white px-5 py-3 text-sm font-bold text-blue-700 shadow-lg shadow-blue-950/10 transition hover:-translate-y-0.5 hover:bg-blue-50 focus:outline-none focus:ring-4 focus:ring-white/30"
                                >
                                    <Icon name="plus" size={19} />
                                    Add Payment
                                </button>
                            )}
                        </div>
                    </div>
                </div>

                {/* ALERTS */}

                {message && (
                    <StatusMessage
                        type="success"
                        onClose={() => setMessage("")}
                    >
                        {message}
                    </StatusMessage>
                )}

                {error && (
                    <StatusMessage
                        type="error"
                        onClose={() => setError("")}
                    >
                        {error}
                    </StatusMessage>
                )}

                {/* SUMMARY CARDS */}

                <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
                    <StatCard
                        title="Total Payments Recorded"
                        value={payments.length.toLocaleString("en-PK")}
                        description="Number of supplier payment transactions"
                        icon="receipt"
                        color="blue"
                    />

                    <StatCard
                        title="Total Payment Amount"
                        value={formatAmount(totalPayments)}
                        description="Combined amount of recorded payments"
                        icon="banknote"
                        color="green"
                    />

                    <StatCard
                        title="Outstanding Purchase Balance"
                        value={formatAmount(totalOutstanding)}
                        description="Remaining balance across available purchases"
                        icon="wallet"
                        color="indigo"
                    />
                </div>

                {/* ADD / EDIT FORM */}

                {showForm && (
                    <section className="mb-8 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
                        <div className="border-b border-slate-200 bg-gradient-to-r from-blue-50 to-emerald-50/70 px-5 py-5 dark:border-slate-800 dark:from-blue-950/40 dark:to-emerald-950/20 sm:px-7">
                            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                                <div className="flex items-start gap-3">
                                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-white text-blue-600 shadow-sm dark:bg-slate-800 dark:text-blue-400">
                                        <Icon
                                            name={
                                                editingPaymentId
                                                    ? "edit"
                                                    : "plus"
                                            }
                                            size={24}
                                        />
                                    </div>

                                    <div>
                                        <h2 className="text-xl font-bold text-slate-900 dark:text-white">
                                            {editingPaymentId
                                                ? "Edit Purchase Payment"
                                                : "Record a Payment"}
                                        </h2>

                                        <p className="mt-1 text-sm leading-6 text-slate-500 dark:text-slate-400">
                                            {editingPaymentId
                                                ? "Update the payment information below."
                                                : "Enter the payment details to record a supplier transaction."}
                                        </p>
                                    </div>
                                </div>

                                <button
                                    type="button"
                                    onClick={cancelForm}
                                    disabled={saving}
                                    className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-600 transition hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
                                >
                                    <Icon name="x" size={17} />
                                    Cancel
                                </button>
                            </div>
                        </div>

                        <div className="p-5 sm:p-7">
                            {editingPaymentId && (
                                <div className="mb-6 flex flex-col gap-3 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3.5 dark:border-blue-500/30 dark:bg-blue-500/10 sm:flex-row sm:items-center sm:justify-between">
                                    <div className="flex items-center gap-3 text-sm text-blue-800 dark:text-blue-300">
                                        <Icon name="edit" size={19} />
                                        <span>
                                            You are editing payment{" "}
                                            <strong>
                                                {form.paymentNumber ||
                                                    editingPaymentId}
                                            </strong>
                                        </span>
                                    </div>

                                    <button
                                        type="button"
                                        onClick={cancelForm}
                                        disabled={saving}
                                        className="text-left text-sm font-bold text-blue-700 underline underline-offset-4 hover:text-blue-900 disabled:opacity-50 dark:text-blue-300 dark:hover:text-blue-200 sm:text-right"
                                    >
                                        Cancel editing
                                    </button>
                                </div>
                            )}

                            <form
                                onSubmit={savePayment}
                                className="space-y-8"
                            >
                                {/* PAYMENT DETAILS */}

                                <div>
                                    <div className="mb-5 flex items-center gap-2 border-b border-slate-100 pb-3 dark:border-slate-800">
                                        <Icon
                                            name="file"
                                            size={19}
                                            className="text-blue-600 dark:text-blue-400"
                                        />

                                        <h3 className="font-bold text-slate-800 dark:text-slate-100">
                                            Payment Information
                                        </h3>
                                    </div>

                                    <div className="grid grid-cols-1 gap-x-5 gap-y-5 md:grid-cols-2 xl:grid-cols-3">
                                        <Field label="Payment Number">
                                            <input
                                                value={form.paymentNumber}
                                                onChange={(event) =>
                                                    updateForm(
                                                        "paymentNumber",
                                                        event.target.value
                                                    )
                                                }
                                                placeholder="e.g. PPAY-001"
                                                className={inputClass}
                                            />
                                        </Field>

                                        <Field label="Payment Date">
                                            <div className="relative">
                                                <input
                                                    type="date"
                                                    value={form.paymentDate}
                                                    onChange={(event) =>
                                                        updateForm(
                                                            "paymentDate",
                                                            event.target.value
                                                        )
                                                    }
                                                    className={inputClass}
                                                    required
                                                />
                                            </div>
                                        </Field>

                                        <Field label="Payment Method">
                                            <select
                                                value={form.paymentMethod}
                                                onChange={(event) =>
                                                    updateForm(
                                                        "paymentMethod",
                                                        event.target.value
                                                    )
                                                }
                                                className={inputClass}
                                            >
                                                <option value="CASH">
                                                    Cash
                                                </option>
                                                <option value="BANK">
                                                    Bank
                                                </option>
                                                <option value="CHEQUE">
                                                    Cheque
                                                </option>
                                                <option value="CARD">
                                                    Card
                                                </option>
                                                <option value="OTHER">
                                                    Other
                                                </option>
                                            </select>
                                        </Field>

                                        <Field label="Purchase">
                                            <select
                                                value={form.purchaseId}
                                                onChange={(event) =>
                                                    updateForm(
                                                        "purchaseId",
                                                        event.target.value
                                                    )
                                                }
                                                className={inputClass}
                                                required
                                            >
                                                <option value="">
                                                    Select a purchase
                                                </option>

                                                {purchases
                                                    .filter(
                                                        (purchase) =>
                                                            getPurchaseBalance(
                                                                purchase
                                                            ) > 0 ||
                                                            Number(
                                                                purchase.purchase_id
                                                            ) ===
                                                            Number(
                                                                form.purchaseId
                                                            )
                                                    )
                                                    .map((purchase) => (
                                                        <option
                                                            key={
                                                                purchase.purchase_id
                                                            }
                                                            value={
                                                                purchase.purchase_id
                                                            }
                                                        >
                                                            {purchase.purchase_number ||
                                                                `Purchase ${purchase.purchase_id}`}{" "}
                                                            —{" "}
                                                            {purchase.supplier_name ||
                                                                "Supplier"}{" "}
                                                            — Balance:{" "}
                                                            {formatAmount(
                                                                purchase.balance_amount
                                                            )}
                                                        </option>
                                                    ))}
                                            </select>
                                        </Field>

                                        <Field
                                            label="Payment Amount"
                                            hint="Enter the amount paid to the supplier."
                                        >
                                            <div className="relative">
                                                <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4 text-xs font-bold text-slate-400">
                                                    PKR
                                                </span>

                                                <input
                                                    type="number"
                                                    min="0.01"
                                                    step="0.01"
                                                    value={form.amount}
                                                    onChange={(event) =>
                                                        updateForm(
                                                            "amount",
                                                            event.target.value
                                                        )
                                                    }
                                                    placeholder="0.00"
                                                    className={`${inputClass} pl-14`}
                                                    required
                                                />
                                            </div>

                                            {selectedPurchase && (
                                                <p className="mt-2 text-xs font-medium text-slate-500 dark:text-slate-400">
                                                    Current outstanding:{" "}
                                                    <span className="font-bold text-emerald-700 dark:text-emerald-400">
                                                        {formatAmount(
                                                            selectedPurchase.balance_amount
                                                        )}
                                                    </span>
                                                </p>
                                            )}
                                        </Field>

                                        <Field label="Reference Number">
                                            <input
                                                value={form.referenceNumber}
                                                onChange={(event) =>
                                                    updateForm(
                                                        "referenceNumber",
                                                        event.target.value
                                                    )
                                                }
                                                placeholder="Cheque, bank reference, etc."
                                                className={inputClass}
                                            />
                                        </Field>
                                    </div>
                                </div>

                                {/* PURCHASE SUMMARY */}

                                {selectedPurchase && (
                                    <div className="overflow-hidden rounded-2xl border border-blue-100 bg-gradient-to-br from-blue-50/80 to-emerald-50/70 dark:border-slate-700 dark:from-blue-950/30 dark:to-emerald-950/20">
                                        <div className="flex items-center gap-2 border-b border-blue-100 px-5 py-4 dark:border-slate-700">
                                            <Icon
                                                name="building"
                                                size={19}
                                                className="text-blue-600 dark:text-blue-400"
                                            />

                                            <h3 className="font-bold text-slate-800 dark:text-slate-100">
                                                Selected Purchase Summary
                                            </h3>
                                        </div>

                                        <div className="grid grid-cols-1 gap-4 p-5 sm:grid-cols-2 xl:grid-cols-3">
                                            <div>
                                                <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                                                    Supplier
                                                </p>

                                                <p className="mt-2 break-words font-bold text-slate-900 dark:text-white">
                                                    {selectedPurchase.supplier_name ||
                                                        "—"}
                                                </p>

                                                {selectedPurchase.supplier_code && (
                                                    <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                                                        Code:{" "}
                                                        {
                                                            selectedPurchase.supplier_code
                                                        }
                                                    </p>
                                                )}
                                            </div>

                                            <div>
                                                <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                                                    Purchase Total
                                                </p>

                                                <p className="mt-2 text-xl font-bold text-blue-700 dark:text-blue-300">
                                                    {formatAmount(
                                                        selectedPurchase.total_amount
                                                    )}
                                                </p>
                                            </div>

                                            <div>
                                                <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                                                    Remaining Balance
                                                </p>

                                                <p className="mt-2 text-xl font-bold text-emerald-700 dark:text-emerald-300">
                                                    {formatAmount(
                                                        selectedPurchase.balance_amount
                                                    )}
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* NOTES */}

                                <div>
                                    <div className="mb-4 flex items-center gap-2 border-b border-slate-100 pb-3 dark:border-slate-800">
                                        <Icon
                                            name="note"
                                            size={19}
                                            className="text-blue-600 dark:text-blue-400"
                                        />

                                        <h3 className="font-bold text-slate-800 dark:text-slate-100">
                                            Additional Information
                                        </h3>
                                    </div>

                                    <Field label="Notes">
                                        <textarea
                                            value={form.notes}
                                            onChange={(event) =>
                                                updateForm(
                                                    "notes",
                                                    event.target.value
                                                )
                                            }
                                            rows={4}
                                            placeholder="Add payment notes or any additional details..."
                                            className={`${inputClass} min-h-28 resize-y`}
                                        />
                                    </Field>
                                </div>

                                {/* FORM FOOTER */}

                                <div className="flex flex-col-reverse gap-3 border-t border-slate-200 pt-5 dark:border-slate-800 sm:flex-row sm:items-center sm:justify-between">
                                    <p className="text-xs leading-5 text-slate-500 dark:text-slate-400">
                                        Please verify the purchase and amount
                                        before saving.
                                    </p>

                                    <div className="flex flex-col gap-3 sm:flex-row">
                                        <button
                                            type="button"
                                            onClick={cancelForm}
                                            disabled={saving}
                                            className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
                                        >
                                            Cancel
                                        </button>

                                        <button
                                            type="submit"
                                            disabled={saving}
                                            className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-blue-700 to-blue-600 px-6 py-3 text-sm font-bold text-white shadow-lg shadow-blue-600/20 transition hover:-translate-y-0.5 hover:from-blue-800 hover:to-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
                                        >
                                            {saving ? (
                                                <>
                                                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                                                    Saving Payment...
                                                </>
                                            ) : (
                                                <>
                                                    <Icon
                                                        name="save"
                                                        size={18}
                                                    />
                                                    {editingPaymentId
                                                        ? "Save Changes"
                                                        : "Save Payment"}
                                                </>
                                            )}
                                        </button>
                                    </div>
                                </div>
                            </form>
                        </div>
                    </section>
                )}

                {/* PAYMENT HISTORY */}

                {!showForm && (
                    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
                        <div className="border-b border-slate-200 p-5 dark:border-slate-800 sm:p-7">
                            <SectionTitle
                                icon="receipt"
                                title="Payment History"
                                description="Review supplier payments, update records, and open printable receipts."
                                action={
                                    <span className="inline-flex w-fit items-center gap-2 rounded-full border border-blue-100 bg-blue-50 px-3.5 py-2 text-sm font-bold text-blue-700 dark:border-blue-500/20 dark:bg-blue-500/10 dark:text-blue-300">
                                        <Icon name="receipt" size={16} />
                                        {payments.length}{" "}
                                        {payments.length === 1
                                            ? "Payment"
                                            : "Payments"}
                                    </span>
                                }
                            />

                            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                                <div className="relative w-full md:max-w-md">
                                    <Icon
                                        name="search"
                                        size={19}
                                        className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
                                    />

                                    <input
                                        type="search"
                                        value={search}
                                        onChange={(event) =>
                                            setSearch(event.target.value)
                                        }
                                        placeholder="Search payment, purchase, supplier..."
                                        className={`${inputClass} pl-11`}
                                        aria-label="Search payment history"
                                    />
                                </div>

                                <button
                                    type="button"
                                    onClick={() => fetchData({ silent: true })}
                                    disabled={refreshing}
                                    className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:border-blue-500/40 dark:hover:bg-blue-500/10 dark:hover:text-blue-300"
                                >
                                    <Icon
                                        name="refresh"
                                        size={17}
                                        className={
                                            refreshing ? "animate-spin" : ""
                                        }
                                    />
                                    Refresh History
                                </button>
                            </div>
                        </div>

                        {filteredPayments.length === 0 ? (
                            <EmptyState
                                title={
                                    search
                                        ? "No matching payments"
                                        : "No purchase payments yet"
                                }
                                description={
                                    search
                                        ? "Try another payment number, supplier, purchase, or reference."
                                        : "Record your first supplier payment to start building your payment history."
                                }
                                action={
                                    search ? (
                                        <button
                                            type="button"
                                            onClick={() => setSearch("")}
                                            className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                                        >
                                            Clear Search
                                        </button>
                                    ) : (
                                        rights.canCreate ? (
                                            <button
                                                type="button"
                                                onClick={openAddForm}
                                                className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-3 text-sm font-bold text-white transition hover:bg-blue-700"
                                            >
                                                <Icon name="plus" size={18} />
                                                Add First Payment
                                            </button>
                                        ) : null
                                    )
                                }
                            />
                        ) : (
                            <>
                                <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-5 py-3 dark:border-slate-800">
                                    <p className="text-sm text-slate-500 dark:text-slate-400">
                                        Showing{" "}
                                        <span className="font-bold text-slate-800 dark:text-slate-200">
                                            {filteredPayments.length}
                                        </span>{" "}
                                        of{" "}
                                        <span className="font-bold text-slate-800 dark:text-slate-200">
                                            {payments.length}
                                        </span>{" "}
                                        payments
                                    </p>

                                    {search && (
                                        <button
                                            type="button"
                                            onClick={() => setSearch("")}
                                            className="text-xs font-semibold text-blue-600 hover:underline dark:text-blue-400"
                                        >
                                            Clear search
                                        </button>
                                    )}
                                </div>

                                <div className="overflow-x-auto">
                                    <table className="w-full min-w-[1050px] text-left text-sm">
                                        <thead>
                                            <tr className="border-b border-slate-200 bg-slate-50/80 dark:border-slate-800 dark:bg-slate-950/70">
                                                <th className="px-5 py-4 text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                                                    Payment
                                                </th>

                                                <th className="px-5 py-4 text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                                                    Purchase
                                                </th>

                                                <th className="px-5 py-4 text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                                                    Supplier
                                                </th>

                                                <th className="px-5 py-4 text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                                                    Date
                                                </th>

                                                <th className="px-5 py-4 text-right text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                                                    Amount
                                                </th>

                                                <th className="px-5 py-4 text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                                                    Method
                                                </th>

                                                <th className="px-5 py-4 text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                                                    Reference
                                                </th>

                                                <th className="px-5 py-4 text-right text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                                                    Actions
                                                </th>
                                            </tr>
                                        </thead>

                                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                            {filteredPayments.map((payment) => (
                                                <tr
                                                    key={payment.payment_id}
                                                    className="group transition-colors hover:bg-blue-50/50 dark:hover:bg-blue-500/[0.04]"
                                                >
                                                    <td className="px-5 py-4">
                                                        <button
                                                            type="button"
                                                            onClick={() =>
                                                                openPayment(
                                                                    payment
                                                                )
                                                            }
                                                            className="font-bold text-blue-700 transition hover:text-blue-900 hover:underline dark:text-blue-400 dark:hover:text-blue-300"
                                                        >
                                                            {getPaymentIdentifier(
                                                                payment
                                                            )}
                                                        </button>

                                                        <p className="mt-1 text-xs text-slate-400">
                                                            ID:{" "}
                                                            {payment.payment_id ??
                                                                "—"}
                                                        </p>
                                                    </td>

                                                    <td className="px-5 py-4">
                                                        <span className="font-semibold text-slate-800 dark:text-slate-200">
                                                            {payment.purchase_number ||
                                                                "—"}
                                                        </span>
                                                    </td>

                                                    <td className="px-5 py-4">
                                                        <span className="block max-w-[190px] truncate font-medium text-slate-700 dark:text-slate-300">
                                                            {payment.supplier_name ||
                                                                "—"}
                                                        </span>

                                                        {payment.supplier_code && (
                                                            <span className="mt-1 block text-xs text-slate-400">
                                                                {
                                                                    payment.supplier_code
                                                                }
                                                            </span>
                                                        )}
                                                    </td>

                                                    <td className="whitespace-nowrap px-5 py-4 text-slate-600 dark:text-slate-300">
                                                        {formatDate(
                                                            payment.payment_date
                                                        )}
                                                    </td>

                                                    <td className="whitespace-nowrap px-5 py-4 text-right">
                                                        <span className="font-bold text-emerald-700 dark:text-emerald-400">
                                                            {formatAmount(
                                                                payment.amount
                                                            )}
                                                        </span>
                                                    </td>

                                                    <td className="px-5 py-4">
                                                        <PaymentMethodBadge
                                                            method={
                                                                payment.payment_method
                                                            }
                                                        />
                                                    </td>

                                                    <td className="max-w-[150px] truncate px-5 py-4 text-slate-500 dark:text-slate-400">
                                                        {payment.reference_number ||
                                                            "—"}
                                                    </td>

                                                    <td className="px-5 py-4">
                                                        <div className="flex justify-end gap-2">
                                                            <button
                                                                type="button"
                                                                onClick={() =>
                                                                    openPayment(
                                                                        payment
                                                                    )
                                                                }
                                                                title="View receipt"
                                                                aria-label={`View receipt for ${getPaymentIdentifier(
                                                                    payment
                                                                )}`}
                                                                className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-blue-100 bg-blue-50 text-blue-700 transition hover:border-blue-300 hover:bg-blue-100 dark:border-blue-500/20 dark:bg-blue-500/10 dark:text-blue-300 dark:hover:bg-blue-500/20"
                                                            >
                                                                <Icon
                                                                    name="eye"
                                                                    size={17}
                                                                />
                                                            </button>

                                                            {rights.canUpdate && (
                                                                <button
                                                                    type="button"
                                                                    onClick={() => editPayment(payment)}
                                                                    title="Edit payment"
                                                                    aria-label={`Edit ${getPaymentIdentifier(payment)}`}
                                                                    className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-emerald-100 bg-emerald-50 text-emerald-700 transition hover:border-emerald-300 hover:bg-emerald-100 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-300 dark:hover:bg-emerald-500/20"
                                                                >
                                                                    <Icon name="edit" size={17} />
                                                                </button>
                                                            )}
                                                        </div>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </>
                        )}

                        <div className="flex flex-col gap-2 border-t border-slate-200 bg-slate-50/70 px-5 py-4 text-xs text-slate-500 dark:border-slate-800 dark:bg-slate-950/50 dark:text-slate-400 sm:flex-row sm:items-center sm:justify-between">
                            <span>
                                Purchase Payments Management
                            </span>

                            <span>
                                Amounts displayed in your configured currency
                            </span>
                        </div>
                    </section>
                )}
            </div>

            {/* LOADING OVERLAY */}

            {popupLoading && (
                <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm">
                    <div className="w-full max-w-xs rounded-2xl border border-slate-200 bg-white p-7 text-center shadow-2xl dark:border-slate-700 dark:bg-slate-900">
                        <div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-[3px] border-blue-100 border-t-blue-600 dark:border-slate-700 dark:border-t-blue-400" />

                        <p className="font-bold text-slate-900 dark:text-white">
                            Loading payment
                        </p>

                        <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
                            Please wait while the details are retrieved.
                        </p>
                    </div>
                </div>
            )}

            {/* RECEIPT MODAL */}

            {showReceipt && selectedPayment && (
                <div
                    className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-950/70 p-3 backdrop-blur-sm sm:p-6"
                    onMouseDown={(event) => {
                        if (event.target === event.currentTarget) {
                            closeReceipt();
                        }
                    }}
                >
                    <div className="flex max-h-[94vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-900">
                        {/* MODAL HEADER */}

                        <div className="flex items-center justify-between gap-3 border-b border-slate-200 bg-gradient-to-r from-blue-700 to-emerald-600 px-5 py-4 text-white sm:px-7">
                            <div className="flex min-w-0 items-center gap-3">
                                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-white/20 bg-white/10">
                                    <Icon name="receipt" size={23} />
                                </div>

                                <div className="min-w-0">
                                    <h2 className="truncate text-lg font-bold sm:text-xl">
                                        Payment Receipt
                                    </h2>

                                    <p className="mt-1 truncate text-xs text-blue-50/90 sm:text-sm">
                                        {getPaymentIdentifier(
                                            selectedPayment
                                        )}
                                    </p>
                                </div>
                            </div>

                            <button
                                type="button"
                                onClick={closeReceipt}
                                aria-label="Close receipt"
                                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-white/90 transition hover:bg-white/15 hover:text-white"
                            >
                                <Icon name="x" size={21} />
                            </button>
                        </div>

                        {/* RECEIPT CONTENT */}

                        <div
                            id="payment-receipt"
                            className="overflow-y-auto p-5 sm:p-8"
                        >
                            <div className="mb-7 border-b border-slate-200 pb-6 text-center dark:border-slate-700">
                                <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-600 to-emerald-500 text-white shadow-lg shadow-blue-600/20">
                                    <Icon name="building" size={27} />
                                </div>

                                <h2 className="text-2xl font-extrabold tracking-tight text-slate-900 dark:text-white">
                                    ERP SYSTEM
                                </h2>

                                <p className="mt-2 text-sm font-bold tracking-[0.14em] text-blue-700 dark:text-blue-400">
                                    PURCHASE PAYMENT RECEIPT
                                </p>

                                <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
                                    Payment recorded for supplier purchase
                                </p>
                            </div>

                            <div className="mb-7 grid grid-cols-1 gap-3 sm:grid-cols-2">
                                <ReceiptField
                                    label="Payment Number"
                                    value={selectedPayment.payment_number}
                                />

                                <ReceiptField
                                    label="Payment Date"
                                    value={formatDate(
                                        selectedPayment.payment_date
                                    )}
                                />

                                <ReceiptField
                                    label="Purchase Number"
                                    value={selectedPayment.purchase_number}
                                />

                                <ReceiptField
                                    label="Supplier"
                                    value={selectedPayment.supplier_name}
                                />

                                <ReceiptField
                                    label="Supplier Code"
                                    value={selectedPayment.supplier_code}
                                />

                                <ReceiptField
                                    label="Payment Method"
                                    value={getPaymentMethodLabel(
                                        selectedPayment.payment_method
                                    )}
                                />
                            </div>

                            <div className="mb-7 overflow-hidden rounded-xl border border-slate-200 dark:border-slate-700">
                                <div className="grid grid-cols-2 border-b border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-800">
                                    <div className="p-4 text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-300">
                                        Description
                                    </div>

                                    <div className="p-4 text-right text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-300">
                                        Amount
                                    </div>
                                </div>

                                <ReceiptAmountRow
                                    label="Purchase Total"
                                    value={
                                        selectedPayment.purchase_total ??
                                        selectedPayment.total_amount ??
                                        0
                                    }
                                />

                                <ReceiptAmountRow
                                    label="Paid Amount"
                                    value={
                                        selectedPayment.paid_amount ??
                                        selectedPayment.purchase_paid_amount ??
                                        0
                                    }
                                />

                                <ReceiptAmountRow
                                    label="Payment Made"
                                    value={selectedPayment.amount || 0}
                                    highlight
                                />

                                <ReceiptAmountRow
                                    label="Remaining Balance"
                                    value={
                                        selectedPayment.balance_amount ??
                                        selectedPayment.purchase_balance_amount ??
                                        0
                                    }
                                    last
                                />
                            </div>

                            <div className="mb-5">
                                <p className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                                    Reference Number
                                </p>

                                <p className="break-words text-sm font-semibold text-slate-800 dark:text-slate-200">
                                    {selectedPayment.reference_number || "—"}
                                </p>
                            </div>

                            <div className="mb-7">
                                <p className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                                    Notes
                                </p>

                                <p className="whitespace-pre-wrap break-words text-sm leading-6 text-slate-700 dark:text-slate-300">
                                    {selectedPayment.notes || "—"}
                                </p>
                            </div>

                            <div className="border-t border-slate-200 pt-5 text-center dark:border-slate-700">
                                <p className="text-xs text-slate-500 dark:text-slate-400">
                                    Generated by ERP System
                                </p>
                            </div>
                        </div>

                        {/* RECEIPT ACTIONS */}

                        <div className="flex flex-col gap-3 border-t border-slate-200 bg-slate-50 px-5 py-4 dark:border-slate-800 dark:bg-slate-950/70 sm:flex-row sm:flex-wrap sm:justify-end sm:px-7 print:hidden">
                            {rights.canUpdate && (
                                <button
                                    type="button"
                                    onClick={() => editPayment(selectedPayment)}
                                    className="inline-flex items-center justify-center gap-2 rounded-xl border border-emerald-200 bg-white px-4 py-2.5 text-sm font-bold text-emerald-700 transition hover:bg-emerald-50 dark:border-emerald-500/30 dark:bg-slate-900 dark:text-emerald-300 dark:hover:bg-emerald-500/10"
                                >
                                    <Icon name="edit" size={17} />
                                    Edit
                                </button>
                            )}

                            <button
                                type="button"
                                onClick={printReceipt}
                                className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 transition hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
                            >
                                <Icon name="printer" size={17} />
                                Print
                            </button>

                            <button
                                type="button"
                                onClick={downloadPDF}
                                className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-blue-700 to-blue-600 px-4 py-2.5 text-sm font-bold text-white shadow-md shadow-blue-600/20 transition hover:from-blue-800 hover:to-blue-700"
                            >
                                <Icon name="download" size={17} />
                                Download PDF
                            </button>

                            <button
                                type="button"
                                onClick={closeReceipt}
                                className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-slate-800 dark:bg-slate-700 dark:hover:bg-slate-600"
                            >
                                <Icon name="x" size={17} />
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* PRINT STYLES */}

            <style jsx global>{`
                @media print {
                    @page {
                        size: auto;
                        margin: 12mm;
                    }

                    html,
                    body {
                        background: #ffffff !important;
                        color: #111827 !important;
                    }

                    body * {
                        visibility: hidden !important;
                    }

                    #payment-receipt,
                    #payment-receipt * {
                        visibility: visible !important;
                    }

                    #payment-receipt {
                        position: absolute !important;
                        inset: 0 auto auto 0 !important;
                        width: 100% !important;
                        max-width: none !important;
                        max-height: none !important;
                        height: auto !important;
                        overflow: visible !important;
                        margin: 0 !important;
                        padding: 0 !important;
                        border: 0 !important;
                        border-radius: 0 !important;
                        background: #ffffff !important;
                        color: #111827 !important;
                        box-shadow: none !important;
                    }

                    #payment-receipt * {
                        color: #111827 !important;
                        -webkit-print-color-adjust: exact !important;
                        print-color-adjust: exact !important;
                    }

                    #payment-receipt .bg-emerald-50,
                    #payment-receipt .bg-slate-50,
                    #payment-receipt .bg-blue-50 {
                        -webkit-print-color-adjust: exact !important;
                        print-color-adjust: exact !important;
                    }

                    button,
                    .print\\:hidden {
                        display: none !important;
                    }
                }
            `}</style>
        </div>
    );
}

/* =========================================================
   DATE FORMATTER
========================================================= */

function formatDate(value) {
    if (!value) return "—";

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
        return String(value);
    }

    return date.toLocaleDateString("en-PK", {
        day: "2-digit",
        month: "short",
        year: "numeric",
    });
}