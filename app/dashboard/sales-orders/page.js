"use client";

import {
    useCallback,
    useEffect,
    useMemo,
    useRef,
    useState,
    useSyncExternalStore,
} from "react";

const inputClass =
    "w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100";
const labelClass =
    "mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400";

/* =========================================================
   TRANSACTION LINE COLUMNS
========================================================= */

const LINE_COLUMNS = [
    { key: "rowNumber", label: "#", width: 56 },
    { key: "itemName", label: "Item Name", width: 240 },
    { key: "itemDescription", label: "Item Description", width: 190 },
    { key: "itemBalance", label: "Item Balance", width: 120 },
    { key: "uom", label: "UOM", width: 100 },
    { key: "quantity", label: "Quantity", width: 120 },
    { key: "retailPrice", label: "Retail Price", width: 130 },
    { key: "discount", label: "Discount %", width: 120 },
    { key: "unitPrice", label: "Unit Price", width: 110 },
    { key: "amount", label: "Amount", width: 110 },
    { key: "taxCode", label: "Tax Code", width: 120 },
    { key: "taxRate", label: "Tax %", width: 100 },
    { key: "taxAmount", label: "Tax Amount", width: 110 },
    { key: "gross", label: "Gross Amount", width: 130 },
    { key: "memo", label: "Memo", width: 160 },
    { key: "action", label: "Action", width: 90 },
];

const LINE_COLUMNS_STORAGE_KEY = "sales-orders.line-columns";

const EMPTY_QUICK = {
    search: "",
    quantity: 1,
    retail_price: 0,
    discount_percent: 0,
    tax_rate: 0,
};

/* =========================================================
   COLUMN VISIBILITY (localStorage via useSyncExternalStore)
========================================================= */

const columnListeners = new Set();

function subscribeColumns(callback) {
    columnListeners.add(callback);
    window.addEventListener("storage", callback);

    return () => {
        columnListeners.delete(callback);
        window.removeEventListener("storage", callback);
    };
}

function readColumns() {
    try {
        return localStorage.getItem(LINE_COLUMNS_STORAGE_KEY) ?? "";
    } catch {
        return "";
    }
}

function writeColumns(value) {
    try {
        localStorage.setItem(LINE_COLUMNS_STORAGE_KEY, JSON.stringify(value));
    } catch (error) {
        console.error("Unable to save column preferences:", error);
    }

    columnListeners.forEach((listener) => listener());
}

function parseColumns(raw) {
    let parsed = {};

    if (raw) {
        try {
            const result = JSON.parse(raw);
            if (result && typeof result === "object" && !Array.isArray(result)) {
                parsed = result;
            }
        } catch {
            parsed = {};
        }
    }

    const visible = Object.fromEntries(
        LINE_COLUMNS.map(({ key }) => [key, parsed[key] !== false])
    );

    // At least one column always stays selected
    if (!LINE_COLUMNS.some(({ key }) => visible[key])) {
        visible[LINE_COLUMNS[0].key] = true;
    }

    return visible;
}

function useLineColumns() {
    const raw = useSyncExternalStore(subscribeColumns, readColumns, () => "");

    const visible = useMemo(() => parseColumns(raw), [raw]);

    const visibleCount = LINE_COLUMNS.filter(
        (column) => visible[column.key]
    ).length;

    const toggle = useCallback((key) => {
        const current = parseColumns(readColumns());
        const count = LINE_COLUMNS.filter((c) => current[c.key]).length;

        // The last selected column can't be unselected
        if (current[key] && count <= 1) return;

        writeColumns({ ...current, [key]: !current[key] });
    }, []);

    const showAll = useCallback(() => {
        writeColumns(
            Object.fromEntries(LINE_COLUMNS.map(({ key }) => [key, true]))
        );
    }, []);

    const hideAll = useCallback(() => {
        const updated = Object.fromEntries(
            LINE_COLUMNS.map(({ key }) => [key, false])
        );

        // Keep the first column visible so at least one remains selected.
        if (LINE_COLUMNS.length > 0) {
            updated[LINE_COLUMNS[0].key] = true;
        }

        writeColumns(updated);
    }, []);

    return { visible, visibleCount, toggle, showAll, hideAll };

    return { visible, visibleCount, toggle, showAll };
}

/* =========================================================
   HELPERS
========================================================= */

function today() {
    const date = new Date();
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function money(value, currency = "PKR") {
    const number = Number(value || 0);

    try {
        return new Intl.NumberFormat("en-PK", {
            style: "currency",
            currency,
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
        }).format(Number.isFinite(number) ? number : 0);
    } catch {
        return `${currency} ${Number.isFinite(number) ? number.toFixed(2) : "0.00"}`;
    }
}

function dateLabel(value) {
    if (!value) return "—";

    const date = new Date(`${String(value).slice(0, 10)}T00:00:00`);

    if (Number.isNaN(date.getTime())) return String(value);

    return date.toLocaleDateString("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric",
    }).toUpperCase();
}

function toBoolean(value) {
    return (
        value === true ||
        value === 1 ||
        value === "1" ||
        String(value).toLowerCase() === "true"
    );
}

function normalizePermissions(permission) {
    return {
        canView: toBoolean(permission?.can_view ?? permission?.canView),
        canCreate: toBoolean(permission?.can_create ?? permission?.canCreate),
        canUpdate: toBoolean(permission?.can_update ?? permission?.canUpdate),
        canDelete: toBoolean(permission?.can_delete ?? permission?.canDelete),
    };
}

// Recalculates unit price, amount, tax and gross for one line
function recalcLine(item) {
    const quantity = Number(item.quantity || 0);
    const retailPrice = Number(item.retail_price || 0);
    const discount = Number(item.discount_percent || 0);
    const taxRate = Number(item.tax_rate || 0);

    const unitPrice = retailPrice * (1 - discount / 100);
    const amount = quantity * unitPrice;
    const taxAmount = (amount * taxRate) / 100;

    return {
        ...item,
        unit_price: unitPrice,
        amount,
        tax_amount: taxAmount,
        gross_amount: amount + taxAmount,
    };
}

function productLabel(product) {
    const sku = product.sku ?? "";
    const name = product.product_name ?? "";
    return sku ? `${sku} - ${name}` : name;
}

function blankForm(company = null) {
    return {
        order_id: null,
        order_number: "TO BE GENERATED",
        source_quotation_id: "",
        transaction_date: today(),
        status: "APPROVED",
        customer_id: "",
        warehouse_id: "",
        department: "",
        project: "",
        order_class: "",
        sales_rep: "",
        payment_term: "",
        memo: "",
        terms_conditions: "",
        currency: company?.currency || "PKR",
        exchange_rate: 1,
        customer_credit_limit: 0,
        customer_balance: 0,
        available_credit_limit: 0,
        items: [],
    };
}

function normalizeOrderItem(item) {
    const retailPrice = Number(item.retail_price ?? item.unit_price ?? 0);
    const discount = Number(item.discount_percent || 0);
    const quantity = Number(item.quantity || 0);
    const unitPrice = Number(
        item.unit_price ?? retailPrice * (1 - discount / 100)
    );
    const amount = Number(item.amount ?? quantity * unitPrice);
    const taxAmount = Number(item.tax_amount || 0);

    return {
        product_id: item.product_id ? String(item.product_id) : "",
        item_name: item.item_name || "",
        item_description: item.item_description || "",
        item_balance: Number(item.item_balance || 0),
        uom: item.uom || "",
        quantity,
        retail_price: retailPrice,
        discount_percent: discount,
        unit_price: unitPrice,
        amount,
        tax_code: item.tax_code || "",
        tax_rate: Number(item.tax_rate || 0),
        tax_amount: taxAmount,
        gross_amount: Number(item.gross_amount ?? amount + taxAmount),
        memo: item.memo || "",
    };
}

/* =========================================================
   SALES ORDER HISTORY COLUMNS
========================================================= */

const HISTORY_COLUMNS = [
    { key: "edit", label: "Edit", fixed: true },
    { key: "view", label: "View", fixed: true },
    { key: "report", label: "Report", fixed: true },
    { key: "customer", label: "Customer" },
    { key: "transactionNumber", label: "Transaction Number" },
    { key: "locationName", label: "Location Name" },
    { key: "status", label: "Status" },
    { key: "trandate", label: "Trandate" },
    { key: "transactionType", label: "Transaction Type" },
    { key: "createdFrom", label: "Created From" },
    { key: "documentStatus", label: "Document Status" },
    { key: "grossAmount", label: "Gross Amount" },
];

/* =========================================================
   UI COMPONENTS
========================================================= */

function Button({
    children,
    onClick,
    variant = "secondary",
    disabled = false,
    title,
    type = "button",
}) {
    const styles = {
        primary:
            "bg-blue-600 text-white shadow-sm hover:bg-blue-700 focus:ring-blue-500/30",
        secondary:
            "border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800",
        success:
            "bg-emerald-600 text-white hover:bg-emerald-700 focus:ring-emerald-500/30",
        danger:
            "border border-red-200 bg-red-50 text-red-700 hover:bg-red-100 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300",
    };

    return (
        <button
            type={type}
            title={title}
            disabled={disabled}
            onClick={onClick}
            className={`inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition focus:outline-none focus:ring-4 disabled:cursor-not-allowed disabled:opacity-50 ${styles[variant]}`}
        >
            {children}
        </button>
    );
}

function Field({ label, children, className = "" }) {
    return (
        <div className={className}>
            <label className={labelClass}>{label}</label>
            {children}
        </div>
    );
}

// No overflow-hidden here, so the Columns dropdown is never clipped
function Section({ title, description, children, action }) {
    return (
        <section className="rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-950">
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-t-2xl border-b border-slate-200 px-5 py-4 dark:border-slate-800">
                <div>
                    <h3 className="font-bold text-slate-900 dark:text-slate-100">
                        {title}
                    </h3>

                    {description ? (
                        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                            {description}
                        </p>
                    ) : null}
                </div>

                {action}
            </div>

            <div className="p-5">{children}</div>
        </section>
    );
}

function StatusBadge({ status }) {
    const value = String(status || "DRAFT").toUpperCase();

    const styles =
        value === "APPROVED"
            ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
            : value === "CANCELLED"
                ? "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300"
                : "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300";

    return (
        <span
            className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-bold ${styles}`}
        >
            {value}
        </span>
    );
}

function SummaryCard({ label, value, accent = "blue" }) {
    const accents = {
        blue: "from-blue-600 to-indigo-600",
        green: "from-emerald-600 to-teal-600",
        purple: "from-violet-600 to-fuchsia-600",
    };

    return (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-950">
            <div className={`h-1 bg-gradient-to-r ${accents[accent]}`} />

            <div className="p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                    {label}
                </p>

                <p className="mt-2 break-words text-xl font-extrabold text-slate-900 dark:text-white">
                    {value}
                </p>
            </div>
        </div>
    );
}

function AccessDenied({ message }) {
    return (
        <main className="flex min-h-[65vh] items-center justify-center bg-slate-50 p-6 dark:bg-slate-900">
            <div className="w-full max-w-lg rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-sm dark:border-slate-800 dark:bg-slate-950">
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-red-100 text-3xl dark:bg-red-950">
                    🔒
                </div>

                <h2 className="mt-5 text-2xl font-black text-slate-900 dark:text-white">
                    Access Restricted
                </h2>

                <p className="mt-3 text-sm leading-6 text-slate-500 dark:text-slate-400">
                    {message ||
                        "You do not have View permission for Sales Orders. Please contact your administrator."}
                </p>

                <p className="mt-5 text-xs text-slate-400">
                    Permission required: sales_orders → View
                </p>
            </div>
        </main>
    );
}

function ColumnsMenu({ columns, state }) {
    const [open, setOpen] = useState(false);
    const ref = useRef(null);



    useEffect(() => {
        if (!open) return undefined;

        const onPointer = (event) => {
            if (ref.current && !ref.current.contains(event.target)) {
                setOpen(false);
            }
        };
        const onKey = (event) => {
            if (event.key === "Escape") setOpen(false);
        };

        document.addEventListener("mousedown", onPointer);
        document.addEventListener("touchstart", onPointer);
        document.addEventListener("keydown", onKey);

        return () => {
            document.removeEventListener("mousedown", onPointer);
            document.removeEventListener("touchstart", onPointer);
            document.removeEventListener("keydown", onKey);
        };
    }, [open]);

    return (
        <div ref={ref} className="relative">
            <button
                type="button"
                onClick={() => setOpen((previous) => !previous)}
                aria-expanded={open}
                aria-label="Choose visible columns"
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
            >
                <svg
                    viewBox="0 0 24 24"
                    className="h-4 w-4"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                >
                    <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" />
                    <circle cx="12" cy="12" r="3" />
                </svg>
                Columns
                <span className="rounded-md bg-slate-100 px-1.5 py-0.5 text-[10px] font-bold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                    {state.visibleCount}/{columns.length}
                </span>
                <svg
                    viewBox="0 0 24 24"
                    className={`h-4 w-4 transition-transform ${open ? "rotate-180" : ""}`}
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                >
                    <path d="m6 9 6 6 6-6" />
                </svg>
            </button>

            {open && (
                <div className="absolute right-0 top-full z-[100] mt-2 w-72 max-w-[calc(100vw-2rem)] rounded-2xl border border-slate-200 bg-white p-3 shadow-2xl ring-1 ring-black/5 dark:border-slate-700 dark:bg-slate-900">
                    <div className="mb-2 flex items-center justify-between gap-2 px-1 pb-2">
                        <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                            Show columns
                        </p>

                        <button
                            type="button"
                            onClick={state.showAll}
                            className="shrink-0 rounded-lg px-2 py-1 text-sm font-semibold text-blue-600 transition hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-500/10"
                        >
                            Show all
                        </button>
                    </div>

                    <div className="max-h-72 space-y-1 overflow-y-auto overscroll-contain pr-1">
                        {columns.map((column) => {
                            const checked = Boolean(state.visible[column.key]);
                            const isLastVisible =
                                checked && state.visibleCount === 1;

                            return (
                                <label
                                    key={column.key}
                                    aria-disabled={isLastVisible}
                                    title={
                                        isLastVisible
                                            ? "At least one column must stay selected"
                                            : undefined
                                    }
                                    className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition ${isLastVisible
                                            ? "cursor-default bg-blue-50 hover:bg-blue-100 dark:bg-blue-500/10 dark:hover:bg-blue-500/20"
                                            : "cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800"
                                        }`}
                                >
                                    <input
                                        type="checkbox"
                                        checked={checked}
                                        onChange={() => {
                                            if (!isLastVisible) {
                                                state.toggle(column.key);
                                            }
                                        }}
                                        className="h-4 w-4 cursor-pointer accent-blue-600"
                                    />

                                    <span
                                        className={`font-medium ${isLastVisible
                                                ? "text-blue-700 dark:text-blue-400"
                                                : "text-slate-700 dark:text-slate-200"
                                            }`}
                                    >
                                        {column.label}
                                    </span>
                                </label>
                            );
                        })}
                    </div>
                </div>
            )}
        </div>
    );
}

/* =========================================================
   PAGE
========================================================= */

export default function SalesOrdersPage() {
    const [orders, setOrders] = useState([]);
    const [customers, setCustomers] = useState([]);
    const [products, setProducts] = useState([]);
    const [warehouses, setWarehouses] = useState([]);
    const [company, setCompany] = useState(null);

    const [permissions, setPermissions] = useState({
        canView: false,
        canCreate: false,
        canUpdate: false,
        canDelete: false,
    });

    const [permissionsLoading, setPermissionsLoading] = useState(true);
    const [permissionsError, setPermissionsError] = useState("");

    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [search, setSearch] = useState("");
    const [statusFilter, setStatusFilter] = useState("ALL");
    const [view, setView] = useState("list");
    const [mode, setMode] = useState("edit");
    const [activeTab, setActiveTab] = useState("lines");
    const [form, setForm] = useState(null);
    const [message, setMessage] = useState("");
    const [error, setError] = useState("");

    // Quick-add line bar
    const [quick, setQuick] = useState(EMPTY_QUICK);
    const [quickError, setQuickError] = useState("");
    const quickInputRef = useRef(null);

    // Column visibility (must stay above the early returns below)
    const lineCols = useLineColumns();
    // Sales Order History column dropdown
    const [historyColumnsOpen, setHistoryColumnsOpen] = useState(false);

    const historyColumnsRef = useRef(null);

    const [historyVisibleColumns, setHistoryVisibleColumns] = useState(
        Object.fromEntries(
            HISTORY_COLUMNS.map((column) => [column.key, true])
        )
    );

    // Show all Sales Order History columns
    const showAllHistoryColumns = useCallback(() => {
        setHistoryVisibleColumns(
            Object.fromEntries(
                HISTORY_COLUMNS.map((column) => [column.key, true])
            )
        );
    }, []);

    // Hide all optional columns but keep Edit, View and Report
    const hideAllHistoryColumns = useCallback(() => {
        setHistoryVisibleColumns(
            Object.fromEntries(
                HISTORY_COLUMNS.map((column) => [
                    column.key,
                    Boolean(column.fixed),
                ])
            )
        );
    }, []);

    // Toggle an individual column
    const toggleHistoryColumn = useCallback((key) => {
        const column = HISTORY_COLUMNS.find((item) => item.key === key);

        if (!column || column.fixed) return;

        setHistoryVisibleColumns((previous) => {
            const visibleCount = HISTORY_COLUMNS.filter(
                (item) => !item.fixed && previous[item.key]
            ).length;

            if (previous[key] && visibleCount <= 1) {
                return previous;
            }

            return {
                ...previous,
                [key]: !previous[key],
            };
        });
    }, []);

    const currency = form?.currency || company?.currency || "PKR";
    const isReadOnly = mode === "view";

    const notifyError = useCallback((text) => {
        setError(text);
        setMessage("");
    }, []);

    const notifySuccess = useCallback((text) => {
        setMessage(text);
        setError("");
    }, []);

    // ---------------------------------------------------------
    // USER RIGHTS: LOAD SALES ORDERS PERMISSIONS
    // Permission key must be: sales_orders
    // ---------------------------------------------------------

    useEffect(() => {
        if (!historyColumnsOpen) return;

        function handleOutsideClick(event) {
            if (
                historyColumnsRef.current &&
                !historyColumnsRef.current.contains(event.target)
            ) {
                setHistoryColumnsOpen(false);
            }
        }

        function handleEscape(event) {
            if (event.key === "Escape") {
                setHistoryColumnsOpen(false);
            }
        }

        document.addEventListener("mousedown", handleOutsideClick);
        document.addEventListener("touchstart", handleOutsideClick);
        document.addEventListener("keydown", handleEscape);

        return () => {
            document.removeEventListener("mousedown", handleOutsideClick);
            document.removeEventListener("touchstart", handleOutsideClick);
            document.removeEventListener("keydown", handleEscape);
        };
    }, [historyColumnsOpen]);

    useEffect(() => {
        let active = true;
        let controller = null;

        async function loadUserPermissions() {
            if (controller) {
                controller.abort();
            }

            const requestController = new AbortController();
            controller = requestController;

            setPermissionsLoading(true);
            setPermissionsError("");

            try {
                const response = await fetch("/api/permissions/current", {
                    method: "GET",
                    credentials: "same-origin",
                    cache: "no-store",
                    signal: requestController.signal,
                    headers: {
                        Accept: "application/json",
                    },
                });

                const data = await response.json();

                if (!response.ok || !Array.isArray(data.permissions)) {
                    throw new Error(
                        data.message || "Unable to load your user rights."
                    );
                }

                const salesOrderPermission = data.permissions.find(
                    (permission) =>
                        String(permission.permission_key || "")
                            .trim()
                            .toLowerCase() === "sales_orders"
                );

                const nextPermissions = normalizePermissions(
                    salesOrderPermission
                );

                if (active && !requestController.signal.aborted) {
                    setPermissions(nextPermissions);
                }
            } catch (err) {
                if (err.name !== "AbortError" && active) {
                    setPermissions({
                        canView: false,
                        canCreate: false,
                        canUpdate: false,
                        canDelete: false,
                    });

                    setPermissionsError(
                        err.message || "Unable to verify your user rights."
                    );
                }
            } finally {
                if (active && !requestController.signal.aborted) {
                    setPermissionsLoading(false);
                }
            }
        }

        loadUserPermissions();

        // User Rights page should dispatch this event after saving changes.
        const handlePermissionsUpdated = () => {
            loadUserPermissions();
        };

        window.addEventListener(
            "erp-permissions-updated",
            handlePermissionsUpdated
        );

        return () => {
            active = false;

            if (controller) {
                controller.abort();
            }

            window.removeEventListener(
                "erp-permissions-updated",
                handlePermissionsUpdated
            );
        };
    }, []);

    // ---------------------------------------------------------
    // LOAD SALES ORDER DATA
    // Data is loaded only after View permission is confirmed.
    // ---------------------------------------------------------

    const loadData = useCallback(async () => {
        if (!permissions.canView) return;

        setLoading(true);
        setError("");

        try {
            const response = await fetch("/api/sales-orders", {
                method: "GET",
                credentials: "same-origin",
                cache: "no-store",
                headers: {
                    Accept: "application/json",
                },
            });

            const data = await response.json();

            if (!response.ok || !data.success) {
                throw new Error(
                    data.message || "Unable to load Sales Orders."
                );
            }

            setOrders(data.orders || []);
            setCustomers(data.customers || []);
            setProducts(data.products || []);
            setWarehouses(data.warehouses || []);
            setCompany(data.company || null);
        } catch (err) {
            notifyError(err.message || "Unable to load Sales Orders.");
        } finally {
            setLoading(false);
        }
    }, [permissions.canView, notifyError]);

    useEffect(() => {
        if (permissionsLoading || !permissions.canView) return;

        const timer = setTimeout(() => {
            loadData();
        }, 0);

        return () => clearTimeout(timer);
    }, [permissionsLoading, permissions.canView, loadData]);

    // ---------------------------------------------------------
    // TOTALS
    // ---------------------------------------------------------

    const totals = useMemo(() => {
        const items = form?.items || [];

        let subtotal = 0;
        let taxAmount = 0;

        for (const item of items) {
            const line = recalcLine(item);

            subtotal += line.amount;
            taxAmount += line.tax_amount;
        }

        subtotal = Math.round(subtotal * 100) / 100;
        taxAmount = Math.round(taxAmount * 100) / 100;

        return {
            subtotal,
            taxAmount,
            grossAmount: Math.round((subtotal + taxAmount) * 100) / 100,
        };
    }, [form?.items]);

    // ---------------------------------------------------------
    // FILTER ORDERS
    // ---------------------------------------------------------

    const filteredOrders = useMemo(() => {
        const term = search.trim().toLowerCase();

        return orders.filter((order) => {
            const statusMatches =
                statusFilter === "ALL" ||
                String(order.status || "").toUpperCase() === statusFilter;

            const text = [
                order.order_number,
                order.customer_name,
                order.warehouse_name,
                order.status,
                order.document_status,
                order.source_quotation_number,
                order.department,
                order.project,
                order.sales_rep,
            ]
                .filter(Boolean)
                .join(" ")
                .toLowerCase();

            return statusMatches && (!term || text.includes(term));
        });
    }, [orders, search, statusFilter]);

    // ---------------------------------------------------------
    // FORM HANDLERS
    // ---------------------------------------------------------

    function updateForm(field, value) {
        if (isReadOnly || (!permissions.canUpdate && form?.order_id)) return;

        setForm((current) => ({
            ...current,
            [field]: value,
        }));
    }

    function updateLine(index, field, value) {
        if (isReadOnly) return;

        if (form?.order_id && !permissions.canUpdate) {
            notifyError("You do not have permission to edit this Sales Order.");
            return;
        }

        setForm((current) => {
            const items = [...current.items];
            let item = { ...items[index], [field]: value };

            if (field === "product_id") {
                const product = products.find(
                    (entry) => String(entry.product_id) === String(value)
                );

                if (product) {
                    item.item_name = product.product_name || "";
                    item.item_description = product.description || "";
                    item.uom = product.sales_unit || product.unit || "";
                    item.retail_price = Number(product.sale_price || 0);
                }
            }

            item = recalcLine(item);
            items[index] = item;

            return {
                ...current,
                items,
            };
        });
    }

    function removeLine(index) {
        if (isReadOnly) return;

        if (form?.order_id && !permissions.canUpdate) {
            notifyError("You do not have permission to edit this Sales Order.");
            return;
        }

        setForm((current) => ({
            ...current,
            items: current.items.filter((_, i) => i !== index),
        }));
    }

    // ---------------------------------------------------------
    // QUICK ADD LINE
    // ---------------------------------------------------------

    function resetQuick() {
        setQuick({ ...EMPTY_QUICK });
        setQuickError("");
    }

    function findProductByInput(text, exactOnly = false) {
        const query = String(text || "").trim().toLowerCase();
        if (!query) return null;

        const exact = products.find((product) =>
            [
                productLabel(product),
                product.sku,
                product.barcode,
                product.product_name,
            ].some((value) => String(value || "").toLowerCase() === query)
        );

        if (exact || exactOnly) return exact || null;

        // Otherwise accept a partial match only if exactly one product matches
        const matches = products.filter((product) =>
            [product.sku, product.barcode, product.product_name].some(
                (value) => String(value || "").toLowerCase().includes(query)
            )
        );

        return matches.length === 1 ? matches[0] : null;
    }

    function setQuickField(field, value) {
        setQuick((current) => ({ ...current, [field]: value }));
        setQuickError("");
    }

    function handleQuickProductChange(value) {
        setQuickError("");

        setQuick((current) => {
            const next = { ...current, search: value };

            // When the text exactly matches a product, fill its sale price
            const product = findProductByInput(value, true);
            if (product) {
                next.retail_price = Number(product.sale_price || 0);
            }

            return next;
        });
    }

    function addQuickItem() {
        setQuickError("");

        if (form?.order_id && !permissions.canUpdate) {
            notifyError("You do not have permission to edit this Sales Order.");
            return;
        }

        if (!form?.order_id && !permissions.canCreate) {
            notifyError("You do not have permission to create Sales Orders.");
            return;
        }

        const text = quick.search.trim();

        if (!text) {
            setQuickError("Enter or select a product first.");
            return;
        }

        const quantity = Number(quick.quantity);
        const retailPrice = Number(quick.retail_price);
        const discount = Number(quick.discount_percent) || 0;
        const taxRate = Number(quick.tax_rate) || 0;

        if (!Number.isFinite(quantity) || quantity <= 0) {
            setQuickError("Quantity must be greater than zero.");
            return;
        }

        if (!Number.isFinite(retailPrice) || retailPrice < 0) {
            setQuickError("Retail price cannot be negative.");
            return;
        }

        if (discount < 0 || discount > 100) {
            setQuickError("Discount must be between 0 and 100.");
            return;
        }

        if (taxRate < 0) {
            setQuickError("Tax % cannot be negative.");
            return;
        }

        // A catalogue product if one matches; otherwise a custom item name.
        const product = findProductByInput(text);

        const line = recalcLine({
            product_id: product ? String(product.product_id) : "",
            item_name: product ? product.product_name || "" : text,
            item_description: product ? product.description || "" : "",
            item_balance: 0,
            uom: product ? product.sales_unit || product.unit || "" : "",
            quantity,
            retail_price: retailPrice,
            discount_percent: discount,
            tax_code: "",
            tax_rate: taxRate,
            memo: "",
        });

        setForm((current) => ({
            ...current,
            items: [...current.items, line],
        }));

        resetQuick();
        quickInputRef.current?.focus();
    }

    function handleQuickKeyDown(event) {
        if (event.key === "Enter") {
            event.preventDefault();
            addQuickItem();
        }
    }

    // ---------------------------------------------------------
    // CREATE ORDER
    // ---------------------------------------------------------

    function openCreate() {
        if (!permissions.canCreate) {
            notifyError("You do not have permission to create Sales Orders.");
            return;
        }

        setForm(blankForm(company));
        setMode("edit");
        setActiveTab("lines");
        setView("form");
        resetQuick();
        setMessage("");
        setError("");
    }

    // ---------------------------------------------------------
    // OPEN ORDER
    // ---------------------------------------------------------

    async function openOrder(order, nextMode = "view") {
        if (!permissions.canView) {
            notifyError("You do not have permission to view Sales Orders.");
            return null;
        }

        if (nextMode === "edit" && !permissions.canUpdate) {
            notifyError("You do not have permission to edit Sales Orders.");
            return null;
        }

        setLoading(true);
        setError("");
        setMessage("");

        try {
            const response = await fetch(
                `/api/sales-orders/${order.order_id}`,
                {
                    method: "GET",
                    credentials: "same-origin",
                    cache: "no-store",
                    headers: {
                        Accept: "application/json",
                    },
                }
            );

            const data = await response.json();

            if (!response.ok || !data.success) {
                throw new Error(
                    data.message || "Unable to open the Sales Order."
                );
            }

            const record = data.order;

            const normalizedForm = {
                ...record,
                order_id: record.order_id,
                order_number: record.order_number,
                transaction_date: String(
                    record.transaction_date || today()
                ).slice(0, 10),
                customer_id: record.customer_id
                    ? String(record.customer_id)
                    : "",
                warehouse_id: record.warehouse_id
                    ? String(record.warehouse_id)
                    : "",
                currency: record.currency || company?.currency || "PKR",
                exchange_rate: Number(record.exchange_rate || 1),
                items: (data.items || []).map(normalizeOrderItem),
            };

            setForm(normalizedForm);
            setMode(nextMode);
            setActiveTab("lines");
            setView("form");
            resetQuick();

            return normalizedForm;
        } catch (err) {
            notifyError(err.message || "Unable to open the Sales Order.");
            return null;
        } finally {
            setLoading(false);
        }
    }

    // ---------------------------------------------------------
    // BACK TO LIST
    // ---------------------------------------------------------

    function goBack() {
        setView("list");
        setForm(null);
        setMessage("");
        setError("");
        loadData();
    }

    // ---------------------------------------------------------
    // SAVE ORDER
    // ---------------------------------------------------------

    async function saveOrder() {
        if (!form) return;

        if (mode === "view") {
            if (!permissions.canUpdate) {
                notifyError("You do not have permission to edit Sales Orders.");
                return;
            }

            setMode("edit");
            return;
        }

        const isExistingOrder = Boolean(form.order_id);

        if (isExistingOrder && !permissions.canUpdate) {
            notifyError("You do not have permission to update Sales Orders.");
            return;
        }

        if (!isExistingOrder && !permissions.canCreate) {
            notifyError("You do not have permission to create Sales Orders.");
            return;
        }

        if (!form.customer_id) {
            notifyError("Please select a customer.");
            return;
        }

        if (!form.warehouse_id) {
            notifyError("Please select a From Location.");
            return;
        }

        if (
            !form.items?.length ||
            !form.items.some((item) => String(item.item_name || "").trim())
        ) {
            notifyError("Add at least one transaction line.");
            setActiveTab("lines");
            return;
        }

        for (const [index, item] of form.items.entries()) {
            if (!String(item.item_name || "").trim()) {
                notifyError(`Enter an item name on line ${index + 1}.`);
                return;
            }

            if (Number(item.quantity) <= 0) {
                notifyError(
                    `Quantity must be greater than zero on line ${index + 1}.`
                );
                return;
            }

            if (
                Number(item.discount_percent) < 0 ||
                Number(item.discount_percent) > 100
            ) {
                notifyError(
                    `Discount must be between 0 and 100 on line ${index + 1}.`
                );
                return;
            }

            if (Number(item.retail_price) < 0) {
                notifyError(
                    `Retail price cannot be negative on line ${index + 1}.`
                );
                return;
            }

            if (Number(item.tax_rate) < 0) {
                notifyError(
                    `Tax rate cannot be negative on line ${index + 1}.`
                );
                return;
            }
        }

        if (Number(form.exchange_rate) <= 0) {
            notifyError("Exchange Rate must be greater than zero.");
            return;
        }

        setSaving(true);
        setError("");
        setMessage("");

        try {
            const payload = {
                ...form,
                customer_id: Number(form.customer_id),
                warehouse_id: Number(form.warehouse_id),
                exchange_rate: Number(form.exchange_rate || 1),
                subtotal: totals.subtotal,
                tax_amount: totals.taxAmount,
                gross_amount: totals.grossAmount,
                items: form.items
                    .filter((item) => String(item.item_name || "").trim())
                    .map((item) => ({
                        ...item,
                        product_id: item.product_id
                            ? Number(item.product_id)
                            : null,
                        quantity: Number(item.quantity || 0),
                        retail_price: Number(item.retail_price || 0),
                        discount_percent: Number(item.discount_percent || 0),
                        unit_price: Number(item.unit_price || 0),
                        amount: Number(item.amount || 0),
                        tax_rate: Number(item.tax_rate || 0),
                        tax_amount: Number(item.tax_amount || 0),
                        gross_amount: Number(item.gross_amount || 0),
                        item_balance: Number(item.item_balance || 0),
                    })),
            };

            const url = form.order_id
                ? `/api/sales-orders/${form.order_id}`
                : "/api/sales-orders";

            const method = form.order_id ? "PUT" : "POST";

            const response = await fetch(url, {
                method,
                credentials: "same-origin",
                headers: {
                    "Content-Type": "application/json",
                    Accept: "application/json",
                },
                body: JSON.stringify(payload),
            });

            const data = await response.json();

            if (!response.ok || !data.success) {
                throw new Error(
                    data.message || "Unable to save Sales Order."
                );
            }

            notifySuccess(
                data.message || "Sales Order saved successfully."
            );

            await loadData();

            if (data.order?.order_id) {
                await openOrder(data.order, "edit");
            } else if (form.order_id) {
                await openOrder(
                    {
                        order_id: form.order_id,
                    },
                    "edit"
                );
            } else {
                setView("list");
                setForm(null);
            }
        } catch (err) {
            notifyError(err.message || "Unable to save Sales Order.");
        } finally {
            setSaving(false);
        }
    }

    // ---------------------------------------------------------
    // DELETE ORDER
    // ---------------------------------------------------------

    async function deleteOrder() {
        if (!permissions.canDelete) {
            notifyError("You do not have permission to delete Sales Orders.");
            return;
        }

        if (!form?.order_id) return;

        const confirmed = window.confirm(
            `Delete Sales Order ${form.order_number}? This cannot be undone.`
        );

        if (!confirmed) return;

        try {
            setSaving(true);
            setError("");
            setMessage("");

            const response = await fetch(
                `/api/sales-orders/${form.order_id}`,
                {
                    method: "DELETE",
                    credentials: "same-origin",
                    headers: {
                        Accept: "application/json",
                    },
                }
            );

            const data = await response.json();

            if (!response.ok || !data.success) {
                throw new Error(
                    data.message || "Unable to delete the order."
                );
            }

            notifySuccess(data.message || "Sales Order deleted.");

            setView("list");
            setForm(null);

            await loadData();
        } catch (err) {
            notifyError(err.message || "Unable to delete the order.");
        } finally {
            setSaving(false);
        }
    }

    // ---------------------------------------------------------
    // CONVERT QUOTATION
    // ---------------------------------------------------------

    async function convertQuotation() {
        if (!permissions.canCreate) {
            notifyError("You do not have permission to create Sales Orders.");
            return;
        }

        const rawId = window.prompt(
            "Enter the ID of the approved Sales Quotation to convert:"
        );

        if (rawId === null) return;

        const quotationId = Number(rawId.trim());

        if (!Number.isSafeInteger(quotationId) || quotationId <= 0) {
            notifyError("Enter a valid quotation ID.");
            return;
        }

        try {
            setSaving(true);
            setError("");
            setMessage("");

            const response = await fetch(
                `/api/sales-orders/from-quotation/${quotationId}`,
                {
                    method: "POST",
                    credentials: "same-origin",
                    headers: {
                        Accept: "application/json",
                    },
                }
            );

            const data = await response.json();

            if (!response.ok || !data.success) {
                throw new Error(
                    data.message || "Could not convert the quotation."
                );
            }

            await loadData();

            if (data.order?.order_id) {
                await openOrder(
                    {
                        order_id: data.order.order_id,
                    },
                    "view"
                );
            } else {
                notifySuccess(data.message || "Quotation converted.");
            }
        } catch (err) {
            notifyError(err.message || "Could not convert the quotation.");
        } finally {
            setSaving(false);
        }
    }

    // ---------------------------------------------------------
    // REPORT / PRINT
    // ---------------------------------------------------------

    function escapeHtml(value) {
        return String(value ?? "").replace(/[&<>"']/g, (char) => ({
            "&": "&amp;",
            "<": "&lt;",
            ">": "&gt;",
            '"': "&quot;",
            "'": "&#39;",
        })[char]);
    }

    function printReport(orderForm = form) {
        if (!permissions.canView) {
            notifyError("You do not have permission to view Sales Orders.");
            return;
        }

        if (!orderForm) return;

        const reportCurrency =
            orderForm.currency || company?.currency || "PKR";

        const customer = customers.find(
            (item) =>
                String(item.customer_id) === String(orderForm.customer_id)
        );

        const warehouse = warehouses.find(
            (item) =>
                String(item.warehouse_id) === String(orderForm.warehouse_id)
        );

        const reportItems = (orderForm.items || [])
            .map((item, index) => {
                const quantity = Number(item.quantity || 0);
                const price = Number(item.unit_price || 0);
                const amount = Number(item.amount ?? quantity * price);
                const tax = Number(item.tax_amount || 0);
                const gross = Number(item.gross_amount ?? amount + tax);

                return `
                    <tr>
                        <td>${index + 1}</td>
                        <td>${escapeHtml(item.item_name)}</td>
                        <td>${escapeHtml(item.item_description || "")}</td>
                        <td>${escapeHtml(item.uom || "")}</td>
                        <td class="num">${quantity.toFixed(3)}</td>
                        <td class="num">${price.toFixed(2)}</td>
                        <td class="num">${amount.toFixed(2)}</td>
                        <td class="num">${tax.toFixed(2)}</td>
                        <td class="num">${gross.toFixed(2)}</td>
                    </tr>
                `;
            })
            .join("");

        const reportSubtotal = Number(orderForm.subtotal ?? totals.subtotal);

        const reportTax = Number(orderForm.tax_amount ?? totals.taxAmount);

        const reportGross = Number(
            orderForm.gross_amount ?? reportSubtotal + reportTax
        );

        const html = `
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="utf-8" />
                <title>${escapeHtml(orderForm.order_number || "Sales Order")}</title>
                <style>
                    * { box-sizing: border-box; }
                    body {
                        font-family: Arial, sans-serif;
                        color: #172033;
                        padding: 24px;
                    }
                    h1 {
                        margin: 0 0 6px;
                        font-size: 25px;
                    }
                    .muted {
                        color: #64748b;
                        font-size: 12px;
                    }
                    .header {
                        display: flex;
                        justify-content: space-between;
                        border-bottom: 2px solid #1d4ed8;
                        padding-bottom: 18px;
                    }
                    .meta {
                        display: grid;
                        grid-template-columns: 1fr 1fr 1fr;
                        gap: 14px;
                        margin: 22px 0;
                    }
                    .field {
                        border: 1px solid #e2e8f0;
                        border-radius: 7px;
                        padding: 10px;
                    }
                    .label {
                        color: #64748b;
                        text-transform: uppercase;
                        font-size: 10px;
                        margin-bottom: 6px;
                    }
                    .value {
                        font-size: 13px;
                        font-weight: 700;
                        overflow-wrap: anywhere;
                    }
                    table {
                        width: 100%;
                        border-collapse: collapse;
                        font-size: 11px;
                        margin-top: 16px;
                    }
                    th {
                        background: #eff6ff;
                        text-align: left;
                    }
                    th, td {
                        padding: 9px 7px;
                        border: 1px solid #dbe3ee;
                        vertical-align: top;
                    }
                    .num {
                        text-align: right;
                        white-space: nowrap;
                    }
                    .totals {
                        margin: 18px 0 0 auto;
                        width: 280px;
                    }
                    .total-row {
                        display: flex;
                        justify-content: space-between;
                        padding: 8px 0;
                        border-bottom: 1px solid #e2e8f0;
                    }
                    .grand {
                        font-size: 17px;
                        font-weight: 800;
                        color: #1d4ed8;
                    }
                    .memo {
                        margin-top: 24px;
                        white-space: pre-wrap;
                    }
                    @media print {
                        body { padding: 0; }
                    }
                </style>
            </head>
            <body>
                <div class="header">
                    <div>
                        <h1>${escapeHtml(company?.company_name || "Company")}</h1>
                        <div class="muted">${escapeHtml(company?.address || "")}</div>
                        <div class="muted">
                            ${escapeHtml(company?.phone || "")}
                            ${escapeHtml(company?.email || "")}
                        </div>
                    </div>

                    <div style="text-align:right">
                        <h1>SALES ORDER</h1>
                        <div>
                            <strong>${escapeHtml(orderForm.order_number || "TO BE GENERATED")}</strong>
                        </div>
                        <div class="muted">
                            ${dateLabel(orderForm.transaction_date)}
                        </div>
                    </div>
                </div>

                <div class="meta">
                    <div class="field">
                        <div class="label">Customer</div>
                        <div class="value">
                            ${escapeHtml(customer?.customer_name || orderForm.customer_name || "—")}
                        </div>
                    </div>

                    <div class="field">
                        <div class="label">From Location</div>
                        <div class="value">
                            ${escapeHtml(warehouse?.warehouse_name || orderForm.warehouse_name || "—")}
                        </div>
                    </div>

                    <div class="field">
                        <div class="label">Status</div>
                        <div class="value">
                            ${escapeHtml(orderForm.status || "DRAFT")}
                        </div>
                    </div>

                    <div class="field">
                        <div class="label">Department</div>
                        <div class="value">
                            ${escapeHtml(orderForm.department || "—")}
                        </div>
                    </div>

                    <div class="field">
                        <div class="label">Project</div>
                        <div class="value">
                            ${escapeHtml(orderForm.project || "—")}
                        </div>
                    </div>

                    <div class="field">
                        <div class="label">Payment Terms</div>
                        <div class="value">
                            ${escapeHtml(orderForm.payment_term || "—")}
                        </div>
                    </div>
                </div>

                <h3>Transaction Lines</h3>

                <table>
                    <thead>
                        <tr>
                            <th>#</th>
                            <th>Item Name</th>
                            <th>Description</th>
                            <th>UOM</th>
                            <th>Qty</th>
                            <th>Unit Price</th>
                            <th>Amount</th>
                            <th>Tax</th>
                            <th>Gross Amount</th>
                        </tr>
                    </thead>
                    <tbody>${reportItems}</tbody>
                </table>

                <div class="totals">
                    <div class="total-row">
                        <span>Total Amount</span>
                        <strong>${money(reportSubtotal, reportCurrency)}</strong>
                    </div>

                    <div class="total-row">
                        <span>Tax Amount</span>
                        <strong>${money(reportTax, reportCurrency)}</strong>
                    </div>

                    <div class="total-row grand">
                        <span>Gross Amount</span>
                        <span>${money(reportGross, reportCurrency)}</span>
                    </div>
                </div>

                <div class="memo">
                    <strong>Memo</strong><br/>
                    ${escapeHtml(orderForm.memo || "—")}
                </div>

                <p class="muted" style="margin-top:32px">
                    Generated from ERP Sales Orders.
                </p>

                <script>
                    window.onload = () => window.print();
                <\/script>
            </body>
            </html>
        `;

        const reportWindow = window.open(
            "",
            "_blank",
            "width=1100,height=800"
        );

        if (!reportWindow) {
            notifyError(
                "Your browser blocked the report window. Allow pop-ups and try again."
            );
            return;
        }

        reportWindow.document.open();
        reportWindow.document.write(html);
        reportWindow.document.close();
    }

    // ---------------------------------------------------------
    // TABS
    // ---------------------------------------------------------

    const tabs = [
        { id: "lines", label: "Transaction Lines" },
        { id: "accounting", label: "Accounting Lines" },
        { id: "related", label: "Related Transactions" },
        { id: "system", label: "System Information" },
        { id: "attachments", label: "Attachments" },
        { id: "terms", label: "Terms & Conditions" },
    ];

    // ---------------------------------------------------------
    // TRANSACTION LINE TABLE HELPERS
    // ---------------------------------------------------------

    // Columns actually drawn. The Action column only exists in edit mode.
    const displayedColumns = LINE_COLUMNS.filter(
        (column) =>
            lineCols.visible[column.key] &&
            !(isReadOnly && column.key === "action")
    );

    const lineTableMinWidth = displayedColumns.reduce(
        (total, column) => total + column.width,
        0
    );

    function renderLineCell(key, item, index) {
        switch (key) {
            case "rowNumber":
                return (
                    <td key={key} className="px-3 py-3 font-bold">
                        {index + 1}
                    </td>
                );

            case "itemName":
                return (
                    <td key={key} className="min-w-[190px] px-2 py-2">
                        <select
                            className={inputClass}
                            disabled={isReadOnly}
                            value={item.product_id || ""}
                            onChange={(event) =>
                                updateLine(index, "product_id", event.target.value)
                            }
                        >
                            <option value="">Custom item / select product</option>

                            {products.map((product) => (
                                <option
                                    key={product.product_id}
                                    value={product.product_id}
                                >
                                    {product.product_name} ({product.sku})
                                </option>
                            ))}
                        </select>

                        <input
                            className={`${inputClass} mt-2`}
                            disabled={isReadOnly}
                            value={item.item_name || ""}
                            onChange={(event) =>
                                updateLine(index, "item_name", event.target.value)
                            }
                            placeholder="Item name"
                        />
                    </td>
                );

            case "itemDescription":
                return (
                    <td key={key} className="min-w-[170px] px-2 py-2">
                        <input
                            className={inputClass}
                            disabled={isReadOnly}
                            value={item.item_description || ""}
                            onChange={(event) =>
                                updateLine(
                                    index,
                                    "item_description",
                                    event.target.value
                                )
                            }
                        />
                    </td>
                );

            case "itemBalance":
                return (
                    <td key={key} className="min-w-[100px] px-2 py-2">
                        <input
                            className={inputClass}
                            type="number"
                            disabled={isReadOnly}
                            value={item.item_balance ?? 0}
                            onChange={(event) =>
                                updateLine(index, "item_balance", event.target.value)
                            }
                        />
                    </td>
                );

            case "uom":
                return (
                    <td key={key} className="min-w-[90px] px-2 py-2">
                        <input
                            className={inputClass}
                            disabled={isReadOnly}
                            value={item.uom || ""}
                            onChange={(event) =>
                                updateLine(index, "uom", event.target.value)
                            }
                        />
                    </td>
                );

            case "quantity":
                return (
                    <td key={key} className="min-w-[100px] px-2 py-2">
                        <input
                            className={inputClass}
                            type="number"
                            min="0.001"
                            step="0.001"
                            disabled={isReadOnly}
                            value={item.quantity ?? 1}
                            onChange={(event) =>
                                updateLine(index, "quantity", event.target.value)
                            }
                        />
                    </td>
                );

            case "retailPrice":
                return (
                    <td key={key} className="min-w-[115px] px-2 py-2">
                        <input
                            className={inputClass}
                            type="number"
                            min="0"
                            step="0.01"
                            disabled={isReadOnly}
                            value={item.retail_price ?? 0}
                            onChange={(event) =>
                                updateLine(index, "retail_price", event.target.value)
                            }
                        />
                    </td>
                );

            case "discount":
                return (
                    <td key={key} className="min-w-[100px] px-2 py-2">
                        <input
                            className={inputClass}
                            type="number"
                            min="0"
                            max="100"
                            step="0.001"
                            disabled={isReadOnly}
                            value={item.discount_percent ?? 0}
                            onChange={(event) =>
                                updateLine(
                                    index,
                                    "discount_percent",
                                    event.target.value
                                )
                            }
                        />
                    </td>
                );

            case "unitPrice":
                return (
                    <td key={key} className="whitespace-nowrap px-3 py-4 font-semibold">
                        {Number(item.unit_price || 0).toFixed(2)}
                    </td>
                );

            case "amount":
                return (
                    <td key={key} className="whitespace-nowrap px-3 py-4 font-semibold">
                        {Number(item.amount || 0).toFixed(2)}
                    </td>
                );

            case "taxCode":
                return (
                    <td key={key} className="min-w-[100px] px-2 py-2">
                        <input
                            className={inputClass}
                            disabled={isReadOnly}
                            value={item.tax_code || ""}
                            onChange={(event) =>
                                updateLine(index, "tax_code", event.target.value)
                            }
                        />
                    </td>
                );

            case "taxRate":
                return (
                    <td key={key} className="min-w-[90px] px-2 py-2">
                        <input
                            className={inputClass}
                            type="number"
                            min="0"
                            step="0.001"
                            disabled={isReadOnly}
                            value={item.tax_rate ?? 0}
                            onChange={(event) =>
                                updateLine(index, "tax_rate", event.target.value)
                            }
                        />
                    </td>
                );

            case "taxAmount":
                return (
                    <td key={key} className="whitespace-nowrap px-3 py-4">
                        {Number(item.tax_amount || 0).toFixed(2)}
                    </td>
                );

            case "gross":
                return (
                    <td
                        key={key}
                        className="whitespace-nowrap px-3 py-4 font-bold text-emerald-700 dark:text-emerald-400"
                    >
                        {Number(item.gross_amount || 0).toFixed(2)}
                    </td>
                );

            case "memo":
                return (
                    <td key={key} className="min-w-[140px] px-2 py-2">
                        <input
                            className={inputClass}
                            disabled={isReadOnly}
                            value={item.memo || ""}
                            onChange={(event) =>
                                updateLine(index, "memo", event.target.value)
                            }
                        />
                    </td>
                );

            case "action":
                return (
                    <td key={key} className="px-2 py-3">
                        <button
                            type="button"
                            className="rounded-lg px-2 py-1 text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950"
                            onClick={() => removeLine(index)}
                            title="Remove line"
                        >
                            Remove
                        </button>
                    </td>
                );

            default:
                return null;
        }
    }

    // ---------------------------------------------------------
    // PERMISSION LOADING
    // ---------------------------------------------------------

    if (permissionsLoading) {
        return (
            <div className="flex min-h-[60vh] items-center justify-center bg-slate-50 dark:bg-slate-900">
                <div className="text-center">
                    <div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" />

                    <p className="mt-4 text-sm font-medium text-slate-600 dark:text-slate-300">
                        Verifying Sales Orders user rights…
                    </p>
                </div>
            </div>
        );
    }

    // ---------------------------------------------------------
    // ACCESS DENIED
    // ---------------------------------------------------------

    if (!permissions.canView) {
        return (
            <AccessDenied
                message={
                    permissionsError ||
                    "Your account does not have View permission for Sales Orders. Please contact your administrator."
                }
            />
        );
    }

    // ---------------------------------------------------------
    // DATA LOADING
    // ---------------------------------------------------------

    if (loading && view === "list" && !orders.length) {
        return (
            <div className="flex min-h-[50vh] items-center justify-center">
                <div className="text-center">
                    <div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" />

                    <p className="mt-4 text-sm text-slate-500">
                        Loading Sales Orders…
                    </p>
                </div>
            </div>
        );
    }

    // ---------------------------------------------------------
    // MAIN PAGE
    // ---------------------------------------------------------

    return (
        <main className="min-h-screen bg-slate-50 p-4 text-slate-900 dark:bg-slate-900 dark:text-slate-100 sm:p-6 lg:p-8">
            <div className="mx-auto max-w-[1800px] space-y-6">

                {/* PAGE HEADER */}

                <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
                    <div>
                        <div className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.2em] text-blue-600 dark:text-blue-400">
                            <span className="h-2 w-2 rounded-full bg-emerald-500" />
                            Sales Management
                        </div>

                        <h1 className="text-3xl font-black tracking-tight sm:text-4xl">
                            {view === "form"
                                ? `Sales Order — ${form?.order_number || "New Order"}`
                                : "Sales Orders"}
                        </h1>

                        <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
                            Manage order history, customer commitments, and delivery workflow.
                        </p>
                    </div>

                    {view === "list" ? (
                        <div className="flex flex-wrap gap-2">
                            {permissions.canCreate ? (
                                <Button
                                    onClick={convertQuotation}
                                    disabled={saving}
                                >
                                    Convert Quotation
                                </Button>
                            ) : null}

                            {permissions.canCreate ? (
                                <Button
                                    variant="primary"
                                    onClick={openCreate}
                                >
                                    <span className="text-lg leading-none">+</span>
                                    Create Sales Order
                                </Button>
                            ) : null}
                        </div>
                    ) : (
                        <div className="flex flex-wrap gap-2">
                            {mode === "edit" &&
                                form?.order_id &&
                                permissions.canDelete ? (
                                <Button
                                    variant="danger"
                                    onClick={deleteOrder}
                                    disabled={saving}
                                >
                                    Delete
                                </Button>
                            ) : null}

                            {mode === "view" && permissions.canUpdate ? (
                                <Button
                                    onClick={() => {
                                        if (!permissions.canUpdate) return;
                                        setMode("edit");
                                    }}
                                >
                                    Edit
                                </Button>
                            ) : null}

                            {mode === "edit" ? (
                                <Button
                                    variant="primary"
                                    onClick={saveOrder}
                                    disabled={saving}
                                >
                                    {saving ? "Saving…" : "Save"}
                                </Button>
                            ) : null}

                            <Button
                                onClick={() => printReport()}
                                disabled={!form}
                            >
                                Report / Print PDF
                            </Button>

                            <Button onClick={goBack}>
                                Back
                            </Button>
                        </div>
                    )}
                </div>

                {/* NOTIFICATIONS */}

                {error ? (
                    <div
                        role="alert"
                        className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300"
                    >
                        {error}
                    </div>
                ) : null}

                {message ? (
                    <div
                        role="status"
                        className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300"
                    >
                        {message}
                    </div>
                ) : null}

                {/* LIST VIEW */}

                {view === "list" ? (
                    <>
                        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                            <SummaryCard
                                label="Total Sales Orders"
                                value={orders.length}
                            />

                            <SummaryCard
                                label="Approved Orders"
                                value={orders.filter(
                                    (order) => order.status === "APPROVED"
                                ).length}
                                accent="green"
                            />

                            <SummaryCard
                                label="Pending Delivery Challan"
                                value={orders.filter((order) =>
                                    String(order.document_status || "")
                                        .toLowerCase()
                                        .includes("pending delivery")
                                ).length}
                                accent="purple"
                            />

                            <SummaryCard
                                label="Gross Order Value"
                                value={money(
                                    orders.reduce(
                                        (sum, order) =>
                                            sum +
                                            Number(order.gross_amount || 0),
                                        0
                                    ),
                                    company?.currency || "PKR"
                                )}
                            />
                        </div>

                        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-950">
                            <div className="flex flex-col gap-4 border-b border-slate-200 p-5 dark:border-slate-800 lg:flex-row lg:items-center lg:justify-between">
                                <div>
                                    <h2 className="text-lg font-bold">
                                        Sales Order History
                                    </h2>

                                    <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                                        Search and manage your saved orders.
                                    </p>
                                </div>

                                <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">

                                    {/* Search */}
                                    <input
                                        className={`${inputClass} min-w-0 sm:min-w-[280px]`}
                                        placeholder="Search order, customer, location…"
                                        value={search}
                                        onChange={(event) =>
                                            setSearch(event.target.value)
                                        }
                                    />

                                    {/* Status Filter */}
                                    <select
                                        className={inputClass}
                                        value={statusFilter}
                                        onChange={(event) =>
                                            setStatusFilter(event.target.value)
                                        }
                                    >
                                        <option value="ALL">All Statuses</option>
                                        <option value="DRAFT">Draft</option>
                                        <option value="APPROVED">Approved</option>
                                        <option value="CANCELLED">Cancelled</option>
                                    </select>

                                    {/* Columns Dropdown */}
                                    <div
                                        className="relative"
                                        ref={historyColumnsRef}
                                    >
                                        <button
                                            type="button"
                                            onClick={() =>
                                                setHistoryColumnsOpen((previous) => !previous)
                                            }
                                            aria-expanded={historyColumnsOpen}
                                            aria-haspopup="true"
                                            className="flex w-full items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-blue-400 hover:bg-blue-50 focus:outline-none focus:ring-4 focus:ring-blue-500/10 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800 sm:min-w-[150px]"
                                        >
                                            <span className="flex items-center gap-2">
                                                <span>☷</span>
                                                Columns

                                                <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-bold text-blue-700 dark:bg-blue-950 dark:text-blue-300">
                                                    {HISTORY_COLUMNS.filter(
                                                        (column) =>
                                                            historyVisibleColumns[column.key] &&
                                                            (!column.fixed ||
                                                                (column.key !== "edit" ||
                                                                    permissions.canUpdate))
                                                    ).length}
                                                    /{HISTORY_COLUMNS.filter(
                                                        (column) =>
                                                            !column.fixed ||
                                                            (column.key !== "edit" ||
                                                                permissions.canUpdate)
                                                    ).length}
                                                </span>
                                            </span>

                                            <span
                                                className={`transition-transform duration-200 ${historyColumnsOpen ? "rotate-180" : ""
                                                    }`}
                                            >
                                                ▼
                                            </span>
                                        </button>

                                        {historyColumnsOpen && (
                                            <div
                                                className="absolute right-0 top-full z-[100] mt-2 w-[300px] max-w-[calc(100vw-2rem)] overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-900"
                                                role="dialog"
                                                aria-label="Customize history columns"
                                            >
                                                {/* Dropdown Header */}
                                                <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3 dark:border-slate-700">
                                                    <div>
                                                        <p className="text-sm font-bold text-slate-800 dark:text-white">
                                                            Customize Columns
                                                        </p>

                                                        <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                                                            Choose columns to display
                                                        </p>
                                                    </div>

                                                    <button
                                                        type="button"
                                                        onClick={() =>
                                                            setHistoryColumnsOpen(false)
                                                        }
                                                        className="grid h-8 w-8 place-items-center rounded-lg text-xl text-slate-500 transition hover:bg-slate-100 dark:hover:bg-slate-800"
                                                        title="Close"
                                                    >
                                                        ×
                                                    </button>
                                                </div>

                                                {/* Show All / Hide All */}
                                                <div className="flex gap-2 border-b border-slate-200 p-3 dark:border-slate-700">
                                                    <button
                                                        type="button"
                                                        onClick={showAllHistoryColumns}
                                                        className="flex-1 rounded-lg bg-blue-50 px-3 py-2 text-xs font-bold text-blue-700 transition hover:bg-blue-100 dark:bg-blue-950/50 dark:text-blue-300"
                                                    >
                                                        Show All
                                                    </button>

                                                    <button
                                                        type="button"
                                                        onClick={hideAllHistoryColumns}
                                                        className="flex-1 rounded-lg bg-slate-100 px-3 py-2 text-xs font-bold text-slate-700 transition hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300"
                                                    >
                                                        Hide All
                                                    </button>
                                                </div>

                                                {/* Scrollable Columns List */}
                                                <div
                                                    className="max-h-80 overflow-y-auto overscroll-contain p-2"
                                                    style={{
                                                        scrollbarWidth: "thin",
                                                        scrollbarColor: "#94a3b8 #f1f5f9",
                                                    }}
                                                >
                                                    {HISTORY_COLUMNS.map((column) => {
                                                        if (
                                                            column.key === "edit" &&
                                                            !permissions.canUpdate
                                                        ) {
                                                            return null;
                                                        }

                                                        const checked =
                                                            !!historyVisibleColumns[column.key];

                                                        return (
                                                            <label
                                                                key={column.key}
                                                                className={`flex items-center gap-3 rounded-lg px-3 py-3 text-sm transition ${column.fixed
                                                                        ? "cursor-not-allowed opacity-70"
                                                                        : "cursor-pointer hover:bg-blue-50 dark:hover:bg-slate-800"
                                                                    }`}
                                                            >
                                                                <input
                                                                    type="checkbox"
                                                                    checked={checked}
                                                                    disabled={!!column.fixed}
                                                                    onChange={() =>
                                                                        toggleHistoryColumn(column.key)
                                                                    }
                                                                    className="h-4 w-4 rounded border-slate-300 accent-blue-600 focus:ring-blue-500 disabled:cursor-not-allowed"
                                                                />

                                                                <span className="flex-1 font-medium text-slate-700 dark:text-slate-200">
                                                                    {column.label}
                                                                </span>

                                                                {column.fixed ? (
                                                                    <span className="text-[10px] font-bold uppercase text-slate-400">
                                                                        Fixed
                                                                    </span>
                                                                ) : checked ? (
                                                                    <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400">
                                                                        Visible
                                                                    </span>
                                                                ) : null}
                                                            </label>
                                                        );
                                                    })}
                                                </div>

                                                {/* Dropdown Footer */}
                                                <div className="border-t border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-700 dark:bg-slate-950">
                                                    <p className="text-xs text-slate-500 dark:text-slate-400">
                                                        {HISTORY_COLUMNS.filter(
                                                            (column) =>
                                                                historyVisibleColumns[column.key] &&
                                                                (!column.fixed ||
                                                                    (column.key !== "edit" ||
                                                                        permissions.canUpdate))
                                                        ).length}{" "}
                                                        columns currently visible
                                                    </p>
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    {/* Refresh */}
                                    <Button
                                        onClick={loadData}
                                        disabled={loading}
                                    >
                                        {loading ? "Refreshing…" : "Refresh"}
                                    </Button>
                                </div>
                            </div>

                            <div className="overflow-x-auto">
                                <table className="w-full min-w-[1100px] text-left text-sm">

                                    {/* Table Header */}
                                    <thead className="bg-slate-100 text-[11px] uppercase tracking-wide text-slate-600 dark:bg-slate-900 dark:text-slate-400">
                                        <tr>
                                            {permissions.canUpdate &&
                                                historyVisibleColumns.edit && (
                                                    <th className="whitespace-nowrap px-4 py-4">
                                                        Edit
                                                    </th>
                                                )}

                                            {historyVisibleColumns.view && (
                                                <th className="whitespace-nowrap px-4 py-4">
                                                    View
                                                </th>
                                            )}

                                            {historyVisibleColumns.report && (
                                                <th className="whitespace-nowrap px-4 py-4">
                                                    Report
                                                </th>
                                            )}

                                            {historyVisibleColumns.customer && (
                                                <th className="whitespace-nowrap px-4 py-4">
                                                    Customer
                                                </th>
                                            )}

                                            {historyVisibleColumns.transactionNumber && (
                                                <th className="whitespace-nowrap px-4 py-4">
                                                    Transaction Number
                                                </th>
                                            )}

                                            {historyVisibleColumns.locationName && (
                                                <th className="whitespace-nowrap px-4 py-4">
                                                    Location Name
                                                </th>
                                            )}

                                            {historyVisibleColumns.status && (
                                                <th className="whitespace-nowrap px-4 py-4">
                                                    Status
                                                </th>
                                            )}

                                            {historyVisibleColumns.trandate && (
                                                <th className="whitespace-nowrap px-4 py-4">
                                                    Trandate
                                                </th>
                                            )}

                                            {historyVisibleColumns.transactionType && (
                                                <th className="whitespace-nowrap px-4 py-4">
                                                    Transaction Type
                                                </th>
                                            )}

                                            {historyVisibleColumns.createdFrom && (
                                                <th className="whitespace-nowrap px-4 py-4">
                                                    Created From
                                                </th>
                                            )}

                                            {historyVisibleColumns.documentStatus && (
                                                <th className="whitespace-nowrap px-4 py-4">
                                                    Document Status
                                                </th>
                                            )}

                                            {historyVisibleColumns.grossAmount && (
                                                <th className="whitespace-nowrap px-4 py-4 text-right">
                                                    Gross Amount
                                                </th>
                                            )}
                                        </tr>
                                    </thead>

                                    {/* Table Body */}
                                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                        {filteredOrders.map((order) => (
                                            <tr
                                                key={order.order_id}
                                                className="transition hover:bg-blue-50/60 dark:hover:bg-slate-900"
                                            >
                                                {/* Edit */}
                                                {permissions.canUpdate &&
                                                    historyVisibleColumns.edit && (
                                                        <td className="whitespace-nowrap px-4 py-3">
                                                            <button
                                                                type="button"
                                                                className="font-semibold text-blue-600 hover:underline disabled:opacity-40 dark:text-blue-400"
                                                                onClick={() =>
                                                                    openOrder(order, "edit")
                                                                }
                                                                disabled={!permissions.canUpdate}
                                                            >
                                                                Edit
                                                            </button>
                                                        </td>
                                                    )}

                                                {/* View */}
                                                {historyVisibleColumns.view && (
                                                    <td className="whitespace-nowrap px-4 py-3">
                                                        <button
                                                            type="button"
                                                            className="font-semibold text-slate-700 hover:underline dark:text-slate-200"
                                                            onClick={() =>
                                                                openOrder(order, "view")
                                                            }
                                                        >
                                                            View
                                                        </button>
                                                    </td>
                                                )}

                                                {/* Report */}
                                                {historyVisibleColumns.report && (
                                                    <td className="whitespace-nowrap px-4 py-3">
                                                        <button
                                                            type="button"
                                                            className="font-semibold text-emerald-700 hover:underline dark:text-emerald-400"
                                                            onClick={async () => {
                                                                const reportForm = await openOrder(
                                                                    order,
                                                                    "view"
                                                                );

                                                                if (reportForm) {
                                                                    printReport(reportForm);
                                                                }
                                                            }}
                                                        >
                                                            Report
                                                        </button>
                                                    </td>
                                                )}

                                                {/* Customer */}
                                                {historyVisibleColumns.customer && (
                                                    <td className="whitespace-nowrap px-4 py-3 font-semibold">
                                                        {order.customer_name || "—"}
                                                    </td>
                                                )}

                                                {/* Transaction Number */}
                                                {historyVisibleColumns.transactionNumber && (
                                                    <td className="whitespace-nowrap px-4 py-3 font-bold text-blue-700 dark:text-blue-300">
                                                        {order.order_number || "—"}
                                                    </td>
                                                )}

                                                {/* Location Name */}
                                                {historyVisibleColumns.locationName && (
                                                    <td className="whitespace-nowrap px-4 py-3">
                                                        {order.warehouse_name || "—"}
                                                    </td>
                                                )}

                                                {/* Status */}
                                                {historyVisibleColumns.status && (
                                                    <td className="whitespace-nowrap px-4 py-3">
                                                        <StatusBadge status={order.status} />
                                                    </td>
                                                )}

                                                {/* Trandate */}
                                                {historyVisibleColumns.trandate && (
                                                    <td className="whitespace-nowrap px-4 py-3">
                                                        {dateLabel(order.transaction_date)}
                                                    </td>
                                                )}

                                                {/* Transaction Type */}
                                                {historyVisibleColumns.transactionType && (
                                                    <td className="whitespace-nowrap px-4 py-3 text-xs font-semibold text-slate-500">
                                                        SALESORDER
                                                    </td>
                                                )}

                                                {/* Created From */}
                                                {historyVisibleColumns.createdFrom && (
                                                    <td className="whitespace-nowrap px-4 py-3">
                                                        {order.source_quotation_number || "—"}
                                                    </td>
                                                )}

                                                {/* Document Status */}
                                                {historyVisibleColumns.documentStatus && (
                                                    <td className="whitespace-nowrap px-4 py-3">
                                                        <span className="text-xs font-medium text-slate-600 dark:text-slate-300">
                                                            {order.document_status ||
                                                                "Pending Delivery Challan"}
                                                        </span>
                                                    </td>
                                                )}

                                                {/* Gross Amount */}
                                                {historyVisibleColumns.grossAmount && (
                                                    <td className="whitespace-nowrap px-4 py-3 text-right font-bold">
                                                        {money(
                                                            order.gross_amount,
                                                            order.currency ||
                                                            company?.currency ||
                                                            "PKR"
                                                        )}
                                                    </td>
                                                )}
                                            </tr>
                                        ))}

                                        {/* Empty State */}
                                        {!filteredOrders.length && (
                                            <tr>
                                                <td
                                                    colSpan={
                                                        (permissions.canUpdate &&
                                                            historyVisibleColumns.edit
                                                            ? 1
                                                            : 0) +
                                                        HISTORY_COLUMNS.filter(
                                                            (column) =>
                                                                column.key !== "edit" &&
                                                                historyVisibleColumns[column.key]
                                                        ).length
                                                    }
                                                    className="px-6 py-16 text-center"
                                                >
                                                    <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-50 text-2xl dark:bg-blue-950">
                                                        📄
                                                    </div>

                                                    <h3 className="mt-4 font-bold">
                                                        No Sales Orders found
                                                    </h3>

                                                    <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                                                        Create a new order or adjust your search
                                                        filters.
                                                    </p>

                                                    {permissions.canCreate ? (
                                                        <div className="mt-4">
                                                            <Button
                                                                variant="primary"
                                                                onClick={openCreate}
                                                            >
                                                                Create Sales Order
                                                            </Button>
                                                        </div>
                                                    ) : null}
                                                </td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>

                            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-200 px-5 py-4 text-xs text-slate-500 dark:border-slate-800 dark:text-slate-400">
                                <span>
                                    Showing {filteredOrders.length} of{" "}
                                    {orders.length} orders
                                </span>

                                <span>
                                    Amounts are displayed in the order
                                    currency.
                                </span>
                            </div>
                        </section>
                    </>
                ) : null}

                {/* FORM VIEW */}

                {view === "form" && form ? (
                    <>
                        <div className="grid gap-4 sm:grid-cols-3">
                            <SummaryCard
                                label="Total Amount"
                                value={money(totals.subtotal, currency)}
                            />

                            <SummaryCard
                                label="Tax Amount"
                                value={money(totals.taxAmount, currency)}
                                accent="purple"
                            />

                            <SummaryCard
                                label="Gross Amount"
                                value={money(totals.grossAmount, currency)}
                                accent="green"
                            />
                        </div>

                        <Section
                            title="Sales Order Details"
                            description="Enter the transaction header information."
                            action={<StatusBadge status={form.status} />}
                        >
                            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                                <Field label="Transaction Number">
                                    <input
                                        className={`${inputClass} bg-slate-100 dark:bg-slate-800`}
                                        readOnly
                                        value={
                                            form.order_number ||
                                            "TO BE GENERATED"
                                        }
                                    />
                                </Field>

                                <Field label="Transaction Date">
                                    <input
                                        className={inputClass}
                                        type="date"
                                        disabled={isReadOnly}
                                        value={String(
                                            form.transaction_date || today()
                                        ).slice(0, 10)}
                                        onChange={(event) =>
                                            updateForm(
                                                "transaction_date",
                                                event.target.value
                                            )
                                        }
                                    />
                                </Field>

                                <Field label="Status">
                                    <select
                                        className={inputClass}
                                        disabled={isReadOnly}
                                        value={form.status || "DRAFT"}
                                        onChange={(event) =>
                                            updateForm(
                                                "status",
                                                event.target.value
                                            )
                                        }
                                    >
                                        <option value="DRAFT">DRAFT</option>
                                        <option value="APPROVED">APPROVED</option>
                                        <option value="CANCELLED">
                                            CANCELLED
                                        </option>
                                    </select>
                                </Field>

                                <Field label="Subsidiary / Company">
                                    <input
                                        className={`${inputClass} bg-slate-100 dark:bg-slate-800`}
                                        readOnly
                                        value={
                                            company?.company_name ||
                                            "Current Company"
                                        }
                                    />
                                </Field>

                                <Field label="Customer">
                                    <select
                                        className={inputClass}
                                        disabled={isReadOnly}
                                        value={form.customer_id || ""}
                                        onChange={(event) => {
                                            const customerId =
                                                event.target.value;

                                            const customer = customers.find(
                                                (item) =>
                                                    String(item.customer_id) ===
                                                    customerId
                                            );

                                            setForm((current) => ({
                                                ...current,
                                                customer_id: customerId,
                                                customer_credit_limit: Number(
                                                    customer?.credit_limit || 0
                                                ),
                                            }));
                                        }}
                                    >
                                        <option value="">
                                            Select Customer
                                        </option>

                                        {customers.map((customer) => (
                                            <option
                                                key={customer.customer_id}
                                                value={customer.customer_id}
                                            >
                                                {customer.customer_name} (
                                                {customer.customer_code})
                                            </option>
                                        ))}
                                    </select>
                                </Field>

                                <Field label="From Location">
                                    <select
                                        className={inputClass}
                                        disabled={isReadOnly}
                                        value={form.warehouse_id || ""}
                                        onChange={(event) =>
                                            updateForm(
                                                "warehouse_id",
                                                event.target.value
                                            )
                                        }
                                    >
                                        <option value="">
                                            Select Location
                                        </option>

                                        {warehouses.map((warehouse) => (
                                            <option
                                                key={warehouse.warehouse_id}
                                                value={warehouse.warehouse_id}
                                            >
                                                {warehouse.warehouse_name}
                                            </option>
                                        ))}
                                    </select>
                                </Field>

                                <Field label="Project">
                                    <input
                                        className={inputClass}
                                        disabled={isReadOnly}
                                        value={form.project || ""}
                                        onChange={(event) =>
                                            updateForm(
                                                "project",
                                                event.target.value
                                            )
                                        }
                                        placeholder="Project name"
                                    />
                                </Field>

                                <Field label="Department">
                                    <input
                                        className={inputClass}
                                        disabled={isReadOnly}
                                        value={form.department || ""}
                                        onChange={(event) =>
                                            updateForm(
                                                "department",
                                                event.target.value
                                            )
                                        }
                                        placeholder="Department"
                                    />
                                </Field>

                                <Field label="Sales Rep">
                                    <input
                                        className={inputClass}
                                        disabled={isReadOnly}
                                        value={form.sales_rep || ""}
                                        onChange={(event) =>
                                            updateForm(
                                                "sales_rep",
                                                event.target.value
                                            )
                                        }
                                        placeholder="Sales representative"
                                    />
                                </Field>

                                <Field label="Class">
                                    <input
                                        className={inputClass}
                                        disabled={isReadOnly}
                                        value={form.order_class || ""}
                                        onChange={(event) =>
                                            updateForm(
                                                "order_class",
                                                event.target.value
                                            )
                                        }
                                        placeholder="Class"
                                    />
                                </Field>

                                <Field label="Payment Terms">
                                    <input
                                        className={inputClass}
                                        disabled={isReadOnly}
                                        value={form.payment_term || ""}
                                        onChange={(event) =>
                                            updateForm(
                                                "payment_term",
                                                event.target.value
                                            )
                                        }
                                        placeholder="e.g. 60 DAYS"
                                    />
                                </Field>

                                <Field label="Currency">
                                    <select
                                        className={inputClass}
                                        disabled={isReadOnly}
                                        value={form.currency || "PKR"}
                                        onChange={(event) =>
                                            updateForm(
                                                "currency",
                                                event.target.value
                                            )
                                        }
                                    >
                                        <option value="PKR">
                                            Rupees (PKR)
                                        </option>
                                        <option value="USD">
                                            US Dollar (USD)
                                        </option>
                                        <option value="AED">
                                            UAE Dirham (AED)
                                        </option>
                                        <option value="SAR">
                                            Saudi Riyal (SAR)
                                        </option>
                                        <option value="GBP">
                                            British Pound (GBP)
                                        </option>
                                        <option value="EUR">
                                            Euro (EUR)
                                        </option>
                                    </select>
                                </Field>

                                <Field label="Exchange Rate">
                                    <input
                                        className={inputClass}
                                        type="number"
                                        min="0.000001"
                                        step="0.000001"
                                        disabled={isReadOnly}
                                        value={form.exchange_rate ?? 1}
                                        onChange={(event) =>
                                            updateForm(
                                                "exchange_rate",
                                                event.target.value
                                            )
                                        }
                                    />
                                </Field>

                                <Field label="Customer Credit Limit">
                                    <input
                                        className={`${inputClass} bg-slate-100 dark:bg-slate-800`}
                                        readOnly
                                        value={money(
                                            form.customer_credit_limit,
                                            currency
                                        )}
                                    />
                                </Field>

                                <Field label="Customer Balance">
                                    <input
                                        className={`${inputClass} bg-slate-100 dark:bg-slate-800`}
                                        readOnly
                                        value={money(
                                            form.customer_balance || 0,
                                            currency
                                        )}
                                    />
                                </Field>

                                <Field label="Available Credit Limit">
                                    <input
                                        className={`${inputClass} bg-slate-100 dark:bg-slate-800`}
                                        readOnly
                                        value={money(
                                            Number(
                                                form.customer_credit_limit || 0
                                            ) -
                                            Number(
                                                form.customer_balance || 0
                                            ),
                                            currency
                                        )}
                                    />
                                </Field>

                                <Field
                                    label="Memo"
                                    className="sm:col-span-2 xl:col-span-4"
                                >
                                    <textarea
                                        className={inputClass}
                                        rows={2}
                                        disabled={isReadOnly}
                                        value={form.memo || ""}
                                        onChange={(event) =>
                                            updateForm(
                                                "memo",
                                                event.target.value
                                            )
                                        }
                                        placeholder="Enter transaction notes…"
                                    />
                                </Field>
                            </div>
                        </Section>

                        {/* TRANSACTION WORKSPACE */}

                        <Section
                            title="Transaction Workspace"
                            description="Manage transaction lines, related transactions, and supporting information."
                            action={
                                <span className="text-xs text-slate-500">
                                    {isReadOnly ? "View mode" : "Edit mode"}
                                </span>
                            }
                        >
                            <div className="mb-5 flex gap-2 overflow-x-auto border-b border-slate-200 pb-3 dark:border-slate-800">
                                {tabs.map((tab) => (
                                    <button
                                        key={tab.id}
                                        type="button"
                                        onClick={() =>
                                            setActiveTab(tab.id)
                                        }
                                        className={`whitespace-nowrap rounded-lg px-3 py-2 text-xs font-bold transition ${activeTab === tab.id
                                                ? "bg-blue-600 text-white"
                                                : "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
                                            }`}
                                    >
                                        {tab.label}
                                    </button>
                                ))}
                            </div>

                            {/* TRANSACTION LINES */}

                            {activeTab === "lines" ? (
                                <>
                                    <div className="mb-4">
                                        <h4 className="font-bold">
                                            Transaction Lines
                                        </h4>

                                        <p className="mt-1 text-xs text-slate-500">
                                            {isReadOnly
                                                ? "Line amounts and taxes are calculated automatically."
                                                : "Type or scan a product, then press Enter or click Add. Amounts and taxes are calculated automatically."}
                                        </p>
                                    </div>

                                    {/* QUICK ADD BAR */}
                                    {!isReadOnly ? (
                                        <div className="mb-4 rounded-2xl border border-indigo-100 bg-indigo-50/50 p-4 dark:border-indigo-900/60 dark:bg-indigo-950/20">
                                            <div className="grid grid-cols-2 gap-3 lg:grid-cols-[minmax(200px,2.2fr)_repeat(4,minmax(90px,1fr))_minmax(120px,1fr)_auto] lg:items-end">
                                                <div className="col-span-2 lg:col-span-1">
                                                    <label className={labelClass}>
                                                        Product
                                                    </label>
                                                    <input
                                                        ref={quickInputRef}
                                                        list="quick-product-list"
                                                        className={inputClass}
                                                        value={quick.search}
                                                        onChange={(event) =>
                                                            handleQuickProductChange(
                                                                event.target.value
                                                            )
                                                        }
                                                        onKeyDown={handleQuickKeyDown}
                                                        placeholder="Search or scan SKU, barcode or name..."
                                                        autoComplete="off"
                                                    />

                                                    <datalist id="quick-product-list">
                                                        {products.map((product) => (
                                                            <option
                                                                key={product.product_id}
                                                                value={productLabel(
                                                                    product
                                                                )}
                                                            />
                                                        ))}
                                                    </datalist>
                                                </div>

                                                <div>
                                                    <label className={labelClass}>
                                                        Quantity
                                                    </label>
                                                    <input
                                                        className={inputClass}
                                                        type="number"
                                                        min="0.001"
                                                        step="0.001"
                                                        value={quick.quantity}
                                                        onChange={(event) =>
                                                            setQuickField(
                                                                "quantity",
                                                                event.target.value
                                                            )
                                                        }
                                                        onKeyDown={handleQuickKeyDown}
                                                    />
                                                </div>

                                                <div>
                                                    <label className={labelClass}>
                                                        Retail Price
                                                    </label>
                                                    <input
                                                        className={inputClass}
                                                        type="number"
                                                        min="0"
                                                        step="0.01"
                                                        value={quick.retail_price}
                                                        onChange={(event) =>
                                                            setQuickField(
                                                                "retail_price",
                                                                event.target.value
                                                            )
                                                        }
                                                        onKeyDown={handleQuickKeyDown}
                                                    />
                                                </div>

                                                <div>
                                                    <label className={labelClass}>
                                                        Discount %
                                                    </label>
                                                    <input
                                                        className={inputClass}
                                                        type="number"
                                                        min="0"
                                                        max="100"
                                                        step="0.001"
                                                        value={
                                                            quick.discount_percent
                                                        }
                                                        onChange={(event) =>
                                                            setQuickField(
                                                                "discount_percent",
                                                                event.target.value
                                                            )
                                                        }
                                                        onKeyDown={handleQuickKeyDown}
                                                    />
                                                </div>

                                                <div>
                                                    <label className={labelClass}>
                                                        Tax %
                                                    </label>
                                                    <input
                                                        className={inputClass}
                                                        type="number"
                                                        min="0"
                                                        step="0.001"
                                                        value={quick.tax_rate}
                                                        onChange={(event) =>
                                                            setQuickField(
                                                                "tax_rate",
                                                                event.target.value
                                                            )
                                                        }
                                                        onKeyDown={handleQuickKeyDown}
                                                    />
                                                </div>

                                                <div>
                                                    <label className={labelClass}>
                                                        Line Total
                                                    </label>
                                                    <div className="flex h-[42px] items-center justify-end rounded-xl border border-slate-200 bg-slate-100 px-3 text-sm font-bold tabular-nums text-slate-800 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100">
                                                        {recalcLine({
                                                            quantity:
                                                                quick.quantity,
                                                            retail_price:
                                                                quick.retail_price,
                                                            discount_percent:
                                                                quick.discount_percent,
                                                            tax_rate:
                                                                quick.tax_rate,
                                                        }).gross_amount.toFixed(2)}
                                                    </div>
                                                </div>

                                                <button
                                                    type="button"
                                                    onClick={addQuickItem}
                                                    className="col-span-2 inline-flex h-[42px] items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 lg:col-span-1"
                                                >
                                                    <span className="text-lg leading-none">
                                                        +
                                                    </span>
                                                    Add
                                                </button>
                                            </div>

                                            {quickError ? (
                                                <p className="mt-3 text-sm font-medium text-red-600 dark:text-red-400">
                                                    {quickError}
                                                </p>
                                            ) : null}
                                        </div>
                                    ) : null}

                                    {/* LINES TOOLBAR */}
                                    <div className="mb-3 flex items-center justify-between gap-3">
                                        <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                                            {form.items.length} line
                                            {form.items.length === 1 ? "" : "s"}{" "}
                                            added
                                        </p>

                                        <ColumnsMenu
                                            columns={LINE_COLUMNS}
                                            state={lineCols}
                                        />
                                    </div>

                                    {/* The scrollbar appears only when the visible
                                        columns are wider than the container. */}
                                    {displayedColumns.length === 0 ? (
                                        <div className="rounded-xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
                                            Only the Action column is selected, and
                                            it is not available in view mode.
                                            Choose another column from the Columns
                                            menu.
                                        </div>
                                    ) : (
                                        <div className="w-full overflow-x-auto rounded-xl border border-slate-200 [scrollbar-width:thin] dark:border-slate-800">
                                            <table
                                                style={{
                                                    minWidth: `${lineTableMinWidth}px`,
                                                }}
                                                className="w-full text-left text-xs"
                                            >
                                                <thead className="bg-slate-100 text-[10px] uppercase tracking-wide text-slate-600 dark:bg-slate-900 dark:text-slate-400">
                                                    <tr>
                                                        {displayedColumns.map(
                                                            (column) => (
                                                                <th
                                                                    key={column.key}
                                                                    className="whitespace-nowrap px-3 py-3"
                                                                >
                                                                    {column.label}
                                                                </th>
                                                            )
                                                        )}
                                                    </tr>
                                                </thead>

                                                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                                    {form.items.map(
                                                        (item, index) => (
                                                            <tr
                                                                key={index}
                                                                className="align-top"
                                                            >
                                                                {displayedColumns.map(
                                                                    (column) =>
                                                                        renderLineCell(
                                                                            column.key,
                                                                            item,
                                                                            index
                                                                        )
                                                                )}
                                                            </tr>
                                                        )
                                                    )}

                                                    {form.items.length === 0 ? (
                                                        <tr>
                                                            <td
                                                                colSpan={
                                                                    displayedColumns.length
                                                                }
                                                                className="px-4 py-12 text-center"
                                                            >
                                                                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-2xl text-slate-400 dark:bg-slate-800 dark:text-slate-500">
                                                                    +
                                                                </div>

                                                                <p className="mt-3 text-sm font-semibold text-slate-700 dark:text-slate-200">
                                                                    No lines added
                                                                </p>

                                                                <p className="mt-1 text-sm text-slate-400 dark:text-slate-500">
                                                                    {isReadOnly
                                                                        ? "This order has no transaction lines."
                                                                        : "Use the Product field above to add your first line."}
                                                                </p>
                                                            </td>
                                                        </tr>
                                                    ) : null}
                                                </tbody>
                                            </table>
                                        </div>
                                    )}

                                    <div className="mt-5 flex flex-wrap items-start justify-between gap-5">
                                        <div className="max-w-xl text-xs leading-5 text-slate-500 dark:text-slate-400">
                                            Saving a Sales Order records the
                                            order and its lines only. It does
                                            not deduct inventory or create
                                            accounting journals.
                                        </div>

                                        <div className="w-full max-w-sm rounded-xl bg-slate-50 p-4 dark:bg-slate-900">
                                            <div className="flex justify-between py-2 text-sm">
                                                <span className="text-slate-500">
                                                    Total Amount
                                                </span>

                                                <strong>
                                                    {money(
                                                        totals.subtotal,
                                                        currency
                                                    )}
                                                </strong>
                                            </div>

                                            <div className="flex justify-between py-2 text-sm">
                                                <span className="text-slate-500">
                                                    Tax Amount
                                                </span>

                                                <strong>
                                                    {money(
                                                        totals.taxAmount,
                                                        currency
                                                    )}
                                                </strong>
                                            </div>

                                            <div className="mt-2 flex justify-between border-t border-slate-200 pt-3 text-base dark:border-slate-700">
                                                <span className="font-bold">
                                                    Gross Amount
                                                </span>

                                                <strong className="text-emerald-700 dark:text-emerald-400">
                                                    {money(
                                                        totals.grossAmount,
                                                        currency
                                                    )}
                                                </strong>
                                            </div>
                                        </div>
                                    </div>
                                </>
                            ) : null}

                            {/* ACCOUNTING */}

                            {activeTab === "accounting" ? (
                                <div className="rounded-xl border border-dashed border-slate-300 p-8 text-center dark:border-slate-700">
                                    <h4 className="font-bold">
                                        Accounting Lines
                                    </h4>

                                    <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
                                        Sales Orders do not post accounting
                                        entries. Accounting entries should be
                                        generated by your configured invoicing
                                        workflow.
                                    </p>
                                </div>
                            ) : null}

                            {/* RELATED TRANSACTIONS */}

                            {activeTab === "related" ? (
                                <div className="space-y-3">
                                    <div className="rounded-xl bg-slate-50 p-4 dark:bg-slate-900">
                                        <p className="text-xs font-bold uppercase text-slate-500">
                                            Created From
                                        </p>

                                        <p className="mt-1 font-semibold">
                                            {form.source_quotation_number ||
                                                (form.source_quotation_id
                                                    ? `Quotation ID ${form.source_quotation_id}`
                                                    : "Direct Sales Order")}
                                        </p>
                                    </div>

                                    <div className="rounded-xl bg-slate-50 p-4 dark:bg-slate-900">
                                        <p className="text-xs font-bold uppercase text-slate-500">
                                            Document Status
                                        </p>

                                        <p className="mt-1 font-semibold">
                                            {form.document_status ||
                                                "Pending Delivery Challan"}
                                        </p>
                                    </div>

                                    {form.order_id &&
                                        form.status === "APPROVED" ? (
                                        <Button
                                            variant="success"
                                            onClick={() =>
                                                notifyError(
                                                    "Delivery Challan creation has not been implemented yet. The order has not been changed."
                                                )
                                            }
                                        >
                                            Create Delivery Challan
                                        </Button>
                                    ) : null}
                                </div>
                            ) : null}

                            {/* SYSTEM INFORMATION */}

                            {activeTab === "system" ? (
                                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                                    <Field label="Internal Order ID">
                                        <input
                                            className={inputClass}
                                            readOnly
                                            value={
                                                form.order_id ||
                                                "Assigned when saved"
                                            }
                                        />
                                    </Field>

                                    <Field label="Created At">
                                        <input
                                            className={inputClass}
                                            readOnly
                                            value={
                                                form.created_at
                                                    ? new Date(
                                                        form.created_at
                                                    ).toLocaleString()
                                                    : "Assigned when saved"
                                            }
                                        />
                                    </Field>

                                    <Field label="Updated At">
                                        <input
                                            className={inputClass}
                                            readOnly
                                            value={
                                                form.updated_at
                                                    ? new Date(
                                                        form.updated_at
                                                    ).toLocaleString()
                                                    : "—"
                                            }
                                        />
                                    </Field>

                                    <Field label="Created From">
                                        <input
                                            className={inputClass}
                                            readOnly
                                            value={
                                                form.source_quotation_number ||
                                                (form.source_quotation_id
                                                    ? `Quotation ${form.source_quotation_id}`
                                                    : "Direct entry")
                                            }
                                        />
                                    </Field>
                                </div>
                            ) : null}

                            {/* ATTACHMENTS */}

                            {activeTab === "attachments" ? (
                                <div className="space-y-3">
                                    <p className="text-sm text-slate-500 dark:text-slate-400">
                                        Attachment storage has not been wired
                                        to this page yet.
                                    </p>

                                    {form.attachment_url ? (
                                        <a
                                            href={form.attachment_url}
                                            target="_blank"
                                            rel="noreferrer"
                                            className="font-semibold text-blue-600 underline"
                                        >
                                            {form.attachment_name ||
                                                "Open attachment"}
                                        </a>
                                    ) : (
                                        <p className="text-sm">
                                            No attachment saved.
                                        </p>
                                    )}
                                </div>
                            ) : null}

                            {/* TERMS AND CONDITIONS */}

                            {activeTab === "terms" ? (
                                <Field label="Terms & Conditions">
                                    <textarea
                                        className={inputClass}
                                        rows={7}
                                        disabled={isReadOnly}
                                        value={form.terms_conditions || ""}
                                        onChange={(event) =>
                                            updateForm(
                                                "terms_conditions",
                                                event.target.value
                                            )
                                        }
                                        placeholder="Enter the terms and conditions for this Sales Order…"
                                    />
                                </Field>
                            ) : null}
                        </Section>

                        {/* FORM FOOTER */}

                        <div className="flex flex-wrap justify-end gap-2 rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-950">
                            {mode === "edit" ? (
                                <Button
                                    variant="primary"
                                    onClick={saveOrder}
                                    disabled={
                                        saving ||
                                        (form.order_id
                                            ? !permissions.canUpdate
                                            : !permissions.canCreate)
                                    }
                                >
                                    {saving
                                        ? "Saving…"
                                        : "Save Sales Order"}
                                </Button>
                            ) : permissions.canUpdate ? (
                                <Button
                                    variant="primary"
                                    onClick={() => setMode("edit")}
                                >
                                    Edit Sales Order
                                </Button>
                            ) : null}

                            <Button onClick={() => printReport()}>
                                Report / Print / Save PDF
                            </Button>

                            <Button onClick={goBack}>
                                Back to History
                            </Button>
                        </div>
                    </>
                ) : null}
            </div>
        </main>
    );
}