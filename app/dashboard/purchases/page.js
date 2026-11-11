"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

/* =========================================================
   SVG ICONS — NO EMOJI ICONS OR EXTRA ICON LIBRARIES
========================================================= */

function Icon({ name, size = 20, className = "" }) {
    const paths = {
        package: (
            <>
                <path d="m12 3 9 5-9 5-9-5 9-5Z" />
                <path d="m3 8 9 5 9-5" />
                <path d="M3 8v9l9 5 9-5V8" />
                <path d="M12 13v9" />
            </>
        ),
        plus: <path d="M12 5v14M5 12h14" />,
        edit: (
            <>
                <path d="M12 20h9" />
                <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L8 18l-4 1 1-4Z" />
            </>
        ),
        file: (
            <>
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z" />
                <path d="M14 2v6h6M8 13h8M8 17h8" />
            </>
        ),
        clipboard: (
            <>
                <rect x="5" y="4" width="14" height="17" rx="2" />
                <path d="M9 4.5V3h6v1.5M9 10h6M9 14h6M9 18h3" />
            </>
        ),
        layers: (
            <>
                <path d="m12 3 9 5-9 5-9-5 9-5Z" />
                <path d="m3 12 9 5 9-5M3 16l9 5 9-5" />
            </>
        ),
        receipt: (
            <>
                <path d="M4 3v18l4-2 4 2 4-2 4 2V3l-4 2-4-2-4 2-4-2Z" />
                <path d="M8 9h8M8 13h8M8 17h4" />
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
                <path d="M5.6 9a7 7 0 0 1 11.6-2L20 12M4 12l2.8 5a7 7 0 0 0 11.6-2" />
            </>
        ),
        close: <path d="m18 6-12 12M6 6l12 12" />,
        check: <path d="m5 12 4 4L19 6" />,
        alert: (
            <>
                <path d="m10.3 3.9-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.7-3.1l-8-14a2 2 0 0 0-3.4 0Z" />
                <path d="M12 9v4M12 17h.01" />
            </>
        ),
        arrowLeft: (
            <>
                <path d="m12 19-7-7 7-7" />
                <path d="M19 12H5" />
            </>
        ),
        arrowRight: (
            <>
                <path d="M5 12h14" />
                <path d="m12 5 7 7-7 7" />
            </>
        ),
        printer: (
            <>
                <path d="M6 9V3h12v6M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
                <path d="M6 14h12v7H6zM18 12h.01" />
            </>
        ),
        download: (
            <>
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <path d="m7 10 5 5 5-5M12 15V3" />
            </>
        ),
        eye: (
            <>
                <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" />
                <circle cx="12" cy="12" r="3" />
            </>
        ),
        clock: (
            <>
                <circle cx="12" cy="12" r="10" />
                <path d="M12 6v6l4 2" />
            </>
        ),
        wallet: (
            <>
                <rect x="3" y="5" width="18" height="15" rx="2" />
                <path d="M3 9h18M16 14h2" />
                <path d="M6 5V3h12v2" />
            </>
        ),
        warehouse: (
            <>
                <path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1Z" />
                <path d="M9 21v-8h6v8M3 10h18" />
            </>
        ),
        calendar: (
            <>
                <rect x="3" y="5" width="18" height="16" rx="2" />
                <path d="M16 3v4M8 3v4M3 11h18" />
            </>
        ),
        truck: (
            <>
                <path d="M3 6h11v12H3zM14 10h4l3 4v4h-7" />
                <circle cx="7.5" cy="18.5" r="2.5" />
                <circle cx="17.5" cy="18.5" r="2.5" />
            </>
        ),
        searchFile: (
            <>
                <path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h7" />
                <path d="M13 2v6h6M8 13h5M8 17h3" />
                <circle cx="18" cy="18" r="3" />
                <path d="m20.2 20.2 1.8 1.8" />
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
            {paths[name] || paths.file}
        </svg>
    );
}

/* =========================================================
   CONSTANTS AND HELPERS
========================================================= */

const today = () => {
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");

    return `${year}-${month}-${day}`;
};

const emptyForm = () => ({
    purchaseNumber: "",
    supplierId: "",
    warehouseId: "",
    purchaseDate: today(),
    discount: "",
    tax: "",
    notes: "",
});

const emptyItem = () => ({
    productId: "",
    quantity: 1,
    unitCost: 0,
    discount: 0,
    tax: 0,
});

const cardClass =
    "rounded-2xl border border-slate-200/90 bg-white shadow-sm shadow-slate-200/40 transition-colors dark:border-slate-800 dark:bg-slate-900 dark:shadow-none";

const labelClass =
    "mb-2 block text-sm font-semibold text-slate-700 dark:text-slate-300";

const inputClass =
    "w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-800 outline-none transition placeholder:text-slate-400 hover:border-slate-300 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:placeholder:text-slate-500 dark:hover:border-slate-600 dark:focus:border-sky-500 dark:focus:ring-sky-500/10";

const smallInputClass =
    "w-full min-w-[88px] rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-800 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:focus:border-sky-500";

const primaryButton =
    "inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-emerald-600 px-5 py-3 text-sm font-semibold text-white shadow-md shadow-blue-600/15 transition hover:-translate-y-0.5 hover:from-blue-700 hover:to-emerald-700 hover:shadow-lg disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0";

const secondaryButton =
    "inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:border-blue-200 hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:border-slate-600 dark:hover:bg-slate-800";

const tableHeadClass =
    "whitespace-nowrap border-b border-slate-200 bg-slate-50/90 px-4 py-4 text-left text-xs font-bold uppercase tracking-wider text-slate-500 dark:border-slate-700 dark:bg-slate-800/80 dark:text-slate-300";

const tableCellClass =
    "border-b border-slate-100 px-4 py-4 text-sm text-slate-600 dark:border-slate-800 dark:text-slate-300";

function formatAmount(value) {
    return new Intl.NumberFormat("en-PK", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    }).format(Number(value) || 0);
}

function formatDate(value) {
    if (!value) return "-";
    return String(value).split("T")[0];
}

function getStatusClass(status) {
    const normalized = String(status || "").toLowerCase();

    if (
        normalized.includes("paid") ||
        normalized.includes("complete") ||
        normalized.includes("received")
    ) {
        return "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300";
    }

    if (
        normalized.includes("pending") ||
        normalized.includes("draft") ||
        normalized.includes("partial")
    ) {
        return "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-300";
    }

    if (
        normalized.includes("cancel") ||
        normalized.includes("reject")
    ) {
        return "border-red-200 bg-red-50 text-red-700 dark:border-red-800 dark:bg-red-950/40 dark:text-red-300";
    }

    return "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-800 dark:bg-blue-950/40 dark:text-blue-300";
}

/* =========================================================
   REUSABLE UI COMPONENTS
========================================================= */

function SectionHeading({ icon, title, description, action }) {
    return (
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-sky-100 bg-gradient-to-br from-sky-50 to-emerald-50 text-blue-700 dark:border-slate-700 dark:from-slate-800 dark:to-slate-800 dark:text-sky-300">
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

function SummaryCard({ icon, label, value, accent, description }) {
    const accents = {
        blue: "from-sky-500 to-blue-600 shadow-blue-500/20",
        green: "from-emerald-400 to-green-600 shadow-emerald-500/20",
        cyan: "from-cyan-400 to-sky-600 shadow-cyan-500/20",
    };

    return (
        <div className={`${cardClass} group relative overflow-hidden p-5 sm:p-6`}>
            <div className="absolute -right-8 -top-8 h-28 w-28 rounded-full bg-slate-100/80 transition-transform group-hover:scale-125 dark:bg-slate-800/50" />

            <div className="relative flex items-start justify-between gap-3">
                <div className="min-w-0">
                    <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
                        {label}
                    </p>

                    <p className="mt-3 break-words text-2xl font-extrabold tracking-tight text-slate-900 dark:text-white sm:text-3xl">
                        {value}
                    </p>

                    {description && (
                        <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                            {description}
                        </p>
                    )}
                </div>

                <div
                    className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br text-white shadow-lg ${accents[accent] || accents.blue
                        }`}
                >
                    <Icon name={icon} size={24} />
                </div>
            </div>
        </div>
    );
}

function EmptyState({ onAdd, canCreate }) {
    return (
        <div className="px-6 py-16 text-center">
            <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-3xl border border-sky-100 bg-gradient-to-br from-sky-50 to-emerald-50 text-blue-600 dark:border-slate-700 dark:from-slate-800 dark:to-slate-800 dark:text-sky-300">
                <Icon name="package" size={36} />
            </div>

            <h3 className="mt-5 text-lg font-bold text-slate-900 dark:text-white">
                No purchases found
            </h3>

            <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-500 dark:text-slate-400">
                Your purchase records will appear here. Create your first
                purchase to start managing supplier transactions and stock.
            </p>

            {canCreate && (
                <button
                    type="button"
                    onClick={onAdd}
                    className={`${primaryButton} mt-6`}
                >
                    <Icon name="plus" size={18} />
                    Add Your First Purchase
                </button>
            )}
        </div>
    );
}

/* =========================================================
   PURCHASES PAGE
========================================================= */

export default function PurchasesPage() {
    const [purchases, setPurchases] = useState([]);
    const [suppliers, setSuppliers] = useState([]);
    const [warehouses, setWarehouses] = useState([]);
    const [products, setProducts] = useState([]);
    const [rights, setRights] = useState({
        canView: false,
        canCreate: false,
        canUpdate: false,
        canDelete: false,
    });

    const [permissionLoading, setPermissionLoading] = useState(true);

    const [form, setForm] = useState(emptyForm);
    const [items, setItems] = useState([emptyItem()]);

    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [popupLoading, setPopupLoading] = useState(false);

    const [error, setError] = useState("");
    const [message, setMessage] = useState("");

    const [selectedPurchase, setSelectedPurchase] = useState(null);
    const [editingPurchaseId, setEditingPurchaseId] = useState(null);
    const [showForm, setShowForm] = useState(false);
    const [search, setSearch] = useState("");

    /* ---------------------------------------------------------
       FETCH DATA
    --------------------------------------------------------- */

    const fetchData = useCallback(async () => {
        try {
            setLoading(true);
            setError("");

            const [
                purchasesResponse,
                suppliersResponse,
                warehousesResponse,
                productsResponse,
            ] = await Promise.all([
                fetch("/api/purchases"),
                fetch("/api/suppliers"),
                fetch("/api/warehouses"),
                fetch("/api/products"),
            ]);

            const [
                purchasesData,
                suppliersData,
                warehousesData,
                productsData,
            ] = await Promise.all([
                purchasesResponse.json(),
                suppliersResponse.json(),
                warehousesResponse.json(),
                productsResponse.json(),
            ]);

            if (!purchasesResponse.ok) {
                throw new Error(
                    purchasesData.message ||
                    purchasesData.error ||
                    "Failed to load purchases."
                );
            }

            if (!suppliersResponse.ok) {
                throw new Error(
                    suppliersData.message ||
                    suppliersData.error ||
                    "Failed to load suppliers."
                );
            }

            if (!warehousesResponse.ok) {
                throw new Error(
                    warehousesData.message ||
                    warehousesData.error ||
                    "Failed to load warehouses."
                );
            }

            if (!productsResponse.ok) {
                throw new Error(
                    productsData.message ||
                    productsData.error ||
                    "Failed to load products."
                );
            }

            setPurchases(purchasesData.purchases || []);
            setSuppliers(suppliersData.suppliers || []);
            setWarehouses(warehousesData.warehouses || []);
            setProducts(productsData.products || []);
        } catch (err) {
            setError(err.message || "Failed to load data.");
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        let cancelled = false;

        async function loadPurchases() {
            try {
                await fetchData({ isCancelled: () => cancelled });
            } catch (error) {
                if (!cancelled) {
                    console.error("Failed to load purchases:", error);
                }
            }
        }

        loadPurchases();

        return () => {
            cancelled = true;
        };
    }, [fetchData]);

    useEffect(() => {
        let cancelled = false;

        async function loadPermissions() {
            try {
                setPermissionLoading(true);

                const response = await fetch("/api/permissions/current", {
                    method: "GET",
                    credentials: "same-origin",
                    cache: "no-store",
                });

                const data = await response.json();

                if (!response.ok) {
                    throw new Error(
                        data.message || "Failed to load permissions."
                    );
                }

                const purchasePermission = (
                    data.permissions || []
                ).find(
                    (permission) =>
                        String(permission.permission_key || "").toLowerCase() ===
                        "purchase"
                );

                const userRights = {
                    canView: purchasePermission?.can_view === true,
                    canCreate: purchasePermission?.can_create === true,
                    canUpdate: purchasePermission?.can_update === true,
                    canDelete: purchasePermission?.can_delete === true,
                };

                if (cancelled) return;

                setRights(userRights);

                if (userRights.canView) {
                    await fetchData();
                } else {
                    setLoading(false);
                }
            } catch (error) {
                if (!cancelled) {
                    setError(error.message || "Failed to load permissions.");
                    setLoading(false);
                }
            } finally {
                if (!cancelled) {
                    setPermissionLoading(false);
                }
            }
        }

        loadPermissions();

        return () => {
            cancelled = true;
        };
    }, [fetchData]);

    /* ---------------------------------------------------------
       FORM HELPERS
    --------------------------------------------------------- */

    function updateForm(name, value) {
        setForm((previous) => ({
            ...previous,
            [name]: value,
        }));
    }

    function updateItem(index, name, value) {
        setItems((previous) => {
            const updated = [...previous];

            updated[index] = {
                ...updated[index],
                [name]: value,
            };

            if (name === "productId" && value) {
                const product = products.find(
                    (entry) =>
                        Number(entry.product_id) === Number(value)
                );

                if (product) {
                    updated[index].unitCost =
                        Number(product.cost_price) || 0;
                }
            }

            return updated;
        });
    }

    function addItem() {
        setItems((previous) => [...previous, emptyItem()]);
    }

    function removeItem(index) {
        setItems((previous) => {
            if (previous.length === 1) return previous;

            return previous.filter(
                (_, itemIndex) => itemIndex !== index
            );
        });
    }

    function calculateLine(item) {
        const quantity = Number(item.quantity) || 0;
        const unitCost = Number(item.unitCost) || 0;
        const discount = Number(item.discount) || 0;
        const tax = Number(item.tax) || 0;

        return quantity * unitCost - discount + tax;
    }

    const subtotal = useMemo(
        () =>
            items.reduce(
                (sum, item) => sum + calculateLine(item),
                0
            ),
        [items]
    );

    const total = useMemo(
        () =>
            subtotal -
            (Number(form.discount) || 0) +
            (Number(form.tax) || 0),
        [subtotal, form.discount, form.tax]
    );

    const totalPurchaseValue = useMemo(
        () =>
            purchases.reduce(
                (sum, purchase) =>
                    sum + (Number(purchase.total_amount) || 0),
                0
            ),
        [purchases]
    );

    const totalOutstanding = useMemo(
        () =>
            purchases.reduce(
                (sum, purchase) =>
                    sum + (Number(purchase.balance_amount) || 0),
                0
            ),
        [purchases]
    );

    const filteredPurchases = useMemo(() => {
        const query = search.trim().toLowerCase();

        if (!query) return purchases;

        return purchases.filter((purchase) =>
            [
                purchase.purchase_number,
                purchase.supplier_name,
                purchase.supplier_code,
                purchase.warehouse_name,
                purchase.status,
                formatDate(purchase.purchase_date),
            ].some((value) =>
                String(value || "").toLowerCase().includes(query)
            )
        );
    }, [purchases, search]);

    function resetForm() {
        setForm(emptyForm());
        setItems([emptyItem()]);
        setEditingPurchaseId(null);
    }

    function openNewPurchaseForm() {
        if (!rights.canCreate) {
            setError("You do not have permission to create purchases.");
            return;
        }
        resetForm();
        setError("");
        setMessage("");
        setSelectedPurchase(null);
        setShowForm(true);

        window.scrollTo({ top: 0, behavior: "smooth" });
    }

    function cancelPurchaseForm() {
        resetForm();
        setShowForm(false);
        setError("");
        setMessage("");
    }

    /* ---------------------------------------------------------
       SAVE PURCHASE
    --------------------------------------------------------- */

    async function savePurchase(event) {
        event.preventDefault();
        if (editingPurchaseId && !rights.canUpdate) {
            setError("You do not have permission to update purchases.");
            return;
        }

        if (!editingPurchaseId && !rights.canCreate) {
            setError("You do not have permission to create purchases.");
            return;
        }

        setSaving(true);
        setError("");
        setMessage("");

        try {
            if (!form.purchaseNumber.trim()) {
                throw new Error("Purchase number is required.");
            }

            if (!form.supplierId) {
                throw new Error("Supplier is required.");
            }

            if (!form.warehouseId) {
                throw new Error("Warehouse is required.");
            }

            const validItems = items.filter(
                (item) =>
                    item.productId && Number(item.quantity) > 0
            );

            if (validItems.length === 0) {
                throw new Error("Add at least one valid product.");
            }

            const payload = {
                ...form,
                supplierId: Number(form.supplierId),
                warehouseId: Number(form.warehouseId),
                items: validItems.map((item) => ({
                    productId: Number(item.productId),
                    quantity: Number(item.quantity),
                    unitCost: Number(item.unitCost) || 0,
                    discount: Number(item.discount) || 0,
                    tax: Number(item.tax) || 0,
                })),
            };

            const isEditing = Boolean(editingPurchaseId);

            if (isEditing) {
                payload.purchaseId = Number(editingPurchaseId);
            }

            const response = await fetch("/api/purchases", {
                method: isEditing ? "PUT" : "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify(payload),
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(
                    data.message ||
                    data.error ||
                    "Failed to save purchase."
                );
            }

            await fetchData();

            resetForm();
            setShowForm(false);
            setSelectedPurchase(null);

            setMessage(
                isEditing
                    ? "Purchase updated successfully. Stock, Items Ledger and Accounting Ledger have been updated."
                    : "Purchase created successfully. Warehouse stock has been increased."
            );

            window.scrollTo({ top: 0, behavior: "smooth" });
        } catch (err) {
            setError(err.message || "Something went wrong.");
        } finally {
            setSaving(false);
        }
    }

    /* ---------------------------------------------------------
       VIEW PURCHASE
    --------------------------------------------------------- */

    async function viewPurchase(purchase) {
        try {
            setError("");
            setMessage("");
            setPopupLoading(true);

            const response = await fetch(
                `/api/purchases?id=${purchase.purchase_id}`
            );

            const data = await response.json();

            if (!response.ok) {
                throw new Error(
                    data.message ||
                    data.error ||
                    "Failed to load purchase."
                );
            }

            setSelectedPurchase(data.purchase);
        } catch (err) {
            setError(err.message || "Failed to load purchase.");
        } finally {
            setPopupLoading(false);
        }
    }

    /* ---------------------------------------------------------
       EDIT PURCHASE
    --------------------------------------------------------- */

    async function editPurchase(purchase) {
        if (!rights.canUpdate) {
            setError("You do not have permission to edit purchases.");
            return;
        }
        try {
            setError("");
            setMessage("");
            setPopupLoading(true);

            const response = await fetch(
                `/api/purchases?id=${purchase.purchase_id}`
            );

            const data = await response.json();

            if (!response.ok) {
                throw new Error(
                    data.message ||
                    data.error ||
                    "Failed to load purchase."
                );
            }

            const detail = data.purchase;

            if (!detail) {
                throw new Error("Purchase details were not returned.");
            }

            setSelectedPurchase(null);
            setEditingPurchaseId(detail.purchase_id);

            setForm({
                purchaseNumber: detail.purchase_number || "",
                supplierId: detail.supplier_id
                    ? String(detail.supplier_id)
                    : "",
                warehouseId: detail.warehouse_id
                    ? String(detail.warehouse_id)
                    : "",
                purchaseDate: detail.purchase_date
                    ? formatDate(detail.purchase_date)
                    : today(),
                discount: detail.discount ?? "",
                tax: detail.tax ?? "",
                notes: detail.notes || "",
            });

            const loadedItems = (detail.items || []).map((item) => ({
                productId: String(item.product_id),
                quantity: Number(item.quantity) || 1,
                unitCost: Number(item.unit_cost) || 0,
                discount: Number(item.discount) || 0,
                tax: Number(item.tax) || 0,
            }));

            setItems(
                loadedItems.length ? loadedItems : [emptyItem()]
            );

            setShowForm(true);

            setMessage(
                `Editing Purchase ${detail.purchase_number || ""}`
            );

            window.scrollTo({ top: 0, behavior: "smooth" });
        } catch (err) {
            setError(err.message || "Failed to load purchase.");
        } finally {
            setPopupLoading(false);
        }
    }

    function closePurchasePopup() {
        setSelectedPurchase(null);
    }

    /* ---------------------------------------------------------
       PRINT AND PDF
    --------------------------------------------------------- */

    function printPurchase() {
        window.print();
    }

    function downloadPurchasePDF() {
        if (!selectedPurchase) return;

        const purchase = selectedPurchase;
        const doc = new jsPDF();

        doc.setFontSize(20);
        doc.setTextColor(30, 64, 175);
        doc.text("Purchase Report", 14, 20);

        doc.setFontSize(10);
        doc.setTextColor(80, 90, 105);

        doc.text(
            `Purchase Number: ${purchase.purchase_number || "-"}`,
            14,
            32
        );

        doc.text(
            `Purchase Date: ${formatDate(purchase.purchase_date)}`,
            14,
            40
        );

        doc.text(
            `Supplier: ${purchase.supplier_code || ""} - ${purchase.supplier_name || "-"}`,
            14,
            48
        );

        doc.text(
            `Warehouse: ${purchase.warehouse_code || ""} - ${purchase.warehouse_name || "-"}`,
            14,
            56
        );

        doc.text(`Status: ${purchase.status || "-"}`, 14, 64);

        const tableRows = (purchase.items || []).map((item) => [
            item.sku || "-",
            item.product_name || "-",
            Number(item.quantity || 0).toFixed(2),
            Number(item.unit_cost || 0).toFixed(2),
            Number(item.discount || 0).toFixed(2),
            Number(item.tax || 0).toFixed(2),
            Number(item.line_total || 0).toFixed(2),
        ]);

        autoTable(doc, {
            startY: 75,
            head: [[
                "SKU",
                "Product",
                "Qty",
                "Unit Cost",
                "Discount",
                "Tax",
                "Total",
            ]],
            body: tableRows,
            theme: "striped",
            headStyles: {
                fillColor: [37, 99, 235],
                textColor: [255, 255, 255],
            },
            styles: {
                fontSize: 8,
                cellPadding: 3,
            },
        });

        const finalY = doc.lastAutoTable
            ? doc.lastAutoTable.finalY + 10
            : 100;

        autoTable(doc, {
            startY: finalY,
            head: [["Description", "Amount"]],
            body: [
                ["Subtotal", formatAmount(purchase.subtotal)],
                ["Discount", formatAmount(purchase.discount)],
                ["Tax", formatAmount(purchase.tax)],
                ["Total", formatAmount(purchase.total_amount)],
                ["Paid", formatAmount(purchase.paid_amount)],
                ["Balance", formatAmount(purchase.balance_amount)],
            ],
            theme: "grid",
            headStyles: {
                fillColor: [5, 150, 105],
                textColor: [255, 255, 255],
            },
            styles: {
                fontSize: 9,
                cellPadding: 3,
            },
        });

        const notesY = doc.lastAutoTable
            ? doc.lastAutoTable.finalY + 15
            : finalY + 15;

        const notesLines = doc.splitTextToSize(
            `Notes: ${purchase.notes || "-"}`,
            180
        );

        if (notesY + notesLines.length * 6 > 280) {
            doc.addPage();
            doc.text(notesLines, 14, 20);
        } else {
            doc.text(notesLines, 14, notesY);
        }

        doc.save(
            `Purchase-${purchase.purchase_number || purchase.purchase_id}.pdf`
        );
    }

    /* ---------------------------------------------------------
       LOADING STATE
    --------------------------------------------------------- */

    if (loading || permissionLoading) {

        if (!rights.canView) {
            return (
                <div className="flex min-h-[60vh] items-center justify-center bg-slate-50 p-6 dark:bg-slate-950">
                    <div className="max-w-md rounded-2xl border border-red-200 bg-white p-8 text-center shadow-sm dark:border-red-900 dark:bg-slate-900">
                        <Icon
                            name="alert"
                            size={40}
                            className="mx-auto text-red-500"
                        />

                        <h2 className="mt-4 text-xl font-bold text-slate-900 dark:text-white">
                            Access Denied
                        </h2>

                        <p className="mt-2 text-sm leading-6 text-slate-500 dark:text-slate-400">
                            You do not have permission to view the Purchases module.
                            Please contact your administrator.
                        </p>
                    </div>
                </div>
            );
        }
        return (
            <div className="min-h-[60vh] bg-slate-50 p-4 dark:bg-slate-950 sm:p-8">
                <div className="mx-auto max-w-7xl space-y-6">
                    <div className="h-10 w-56 animate-pulse rounded-xl bg-slate-200 dark:bg-slate-800" />

                    <div className="grid gap-5 md:grid-cols-3">
                        {[1, 2, 3].map((item) => (
                            <div
                                key={item}
                                className="h-32 animate-pulse rounded-2xl bg-white shadow-sm dark:bg-slate-900"
                            />
                        ))}
                    </div>

                    <div className="h-72 animate-pulse rounded-2xl bg-white shadow-sm dark:bg-slate-900" />

                    <p className="text-sm text-slate-500 dark:text-slate-400">
                        Loading your purchase workspace...
                    </p>
                </div>
            </div>
        );
    }

    /* =========================================================
       PAGE UI
    ========================================================= */

    return (
        <div className="min-h-full bg-slate-50/80 p-4 text-slate-900 dark:bg-slate-950 dark:text-slate-100 sm:p-6 lg:p-8">
            <div className="mx-auto max-w-[1600px] space-y-6">

                {/* PAGE HEADER */}

                <header className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-blue-700 via-blue-600 to-emerald-600 p-6 text-white shadow-xl shadow-blue-900/10 sm:p-8">
                    <div className="absolute -right-12 -top-20 h-64 w-64 rounded-full border-[35px] border-white/10" />
                    <div className="absolute -bottom-24 right-40 h-56 w-56 rounded-full bg-emerald-400/15 blur-2xl" />

                    <div className="relative flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                            <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-xs font-semibold tracking-wide text-white/90 backdrop-blur">
                                <span className="h-2 w-2 rounded-full bg-emerald-300" />
                                INVENTORY MANAGEMENT
                            </div>

                            <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl">
                                Purchases
                            </h1>

                            <p className="mt-2 max-w-2xl text-sm leading-6 text-blue-50 sm:text-base">
                                Manage supplier purchases, track expenses,
                                and keep your warehouse stock organized.
                            </p>
                        </div>

                        {!showForm && rights.canCreate && (
                            <button
                                type="button"
                                onClick={openNewPurchaseForm}
                                className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-white px-5 py-3.5 text-sm font-bold text-blue-700 shadow-lg transition hover:-translate-y-0.5 hover:bg-emerald-50"
                            >
                                <Icon name="plus" size={19} />
                                New Purchase
                            </button>
                        )}
                    </div>
                </header>

                {/* SUCCESS MESSAGE */}

                {message && (
                    <div
                        role="status"
                        className="flex items-start justify-between gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-4 text-sm text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300"
                    >
                        <div className="flex gap-3">
                            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-900">
                                <Icon name="check" size={17} />
                            </span>

                            <span className="leading-6">{message}</span>
                        </div>

                        <button
                            type="button"
                            onClick={() => setMessage("")}
                            className="rounded-lg p-1 opacity-70 transition hover:bg-emerald-100 hover:opacity-100 dark:hover:bg-emerald-900"
                            aria-label="Dismiss message"
                        >
                            <Icon name="close" size={18} />
                        </button>
                    </div>
                )}

                {/* ERROR MESSAGE */}

                {error && (
                    <div
                        role="alert"
                        className="flex items-start justify-between gap-3 rounded-2xl border border-red-200 bg-red-50 px-4 py-4 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300"
                    >
                        <div className="flex gap-3">
                            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-red-100 dark:bg-red-900">
                                <Icon name="alert" size={17} />
                            </span>

                            <span className="leading-6">{error}</span>
                        </div>

                        <button
                            type="button"
                            onClick={() => setError("")}
                            className="rounded-lg p-1 opacity-70 transition hover:bg-red-100 hover:opacity-100 dark:hover:bg-red-900"
                            aria-label="Dismiss error"
                        >
                            <Icon name="close" size={18} />
                        </button>
                    </div>
                )}

                {/* =================================================
                    PURCHASE FORM
                ================================================= */}

                {showForm && (
                    <div className="space-y-6">
                        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                            <div className="flex items-center gap-3">
                                <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-sky-100 bg-gradient-to-br from-sky-50 to-emerald-50 text-blue-700 dark:border-slate-700 dark:from-slate-800 dark:to-slate-800 dark:text-sky-300">
                                    <Icon
                                        name={editingPurchaseId ? "edit" : "plus"}
                                        size={22}
                                    />
                                </div>

                                <div>
                                    <h2 className="text-xl font-extrabold text-slate-900 dark:text-white sm:text-2xl">
                                        {editingPurchaseId
                                            ? "Edit Purchase"
                                            : "Create Purchase"}
                                    </h2>

                                    <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                                        {editingPurchaseId
                                            ? "Update the purchase information and items."
                                            : "Fill in the details below to record a new purchase."}
                                    </p>
                                </div>
                            </div>

                            <button
                                type="button"
                                onClick={cancelPurchaseForm}
                                disabled={saving}
                                className={secondaryButton}
                            >
                                <Icon name="arrowLeft" size={17} />
                                Back to History
                            </button>
                        </div>

                        {editingPurchaseId && (
                            <div className="flex flex-col gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-300 sm:flex-row sm:items-center sm:justify-between">
                                <p>
                                    You are editing purchase ID{" "}
                                    <strong>{editingPurchaseId}</strong>.
                                    Please review the information before saving.
                                </p>

                                <button
                                    type="button"
                                    onClick={cancelPurchaseForm}
                                    disabled={saving}
                                    className="self-start font-semibold underline underline-offset-4 sm:self-auto"
                                >
                                    Cancel Edit
                                </button>
                            </div>
                        )}

                        <form onSubmit={savePurchase} className="space-y-6">

                            {/* PURCHASE INFORMATION */}

                            <section className={`${cardClass} p-5 sm:p-7`}>
                                <SectionHeading
                                    icon="clipboard"
                                    title="Purchase Information"
                                    description="Enter the purchase reference, supplier, destination warehouse, and date."
                                />

                                <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                                    <div>
                                        <label className={labelClass}>
                                            Purchase Number
                                            <span className="ml-1 text-red-500">*</span>
                                        </label>

                                        <input
                                            value={form.purchaseNumber}
                                            onChange={(event) =>
                                                updateForm(
                                                    "purchaseNumber",
                                                    event.target.value
                                                )
                                            }
                                            placeholder="e.g. PUR-001"
                                            className={inputClass}
                                            required
                                        />

                                        <p className="mt-1.5 text-xs text-slate-400 dark:text-slate-500">
                                            Enter a unique purchase reference.
                                        </p>
                                    </div>

                                    <div>
                                        <label className={labelClass}>
                                            Purchase Date
                                            <span className="ml-1 text-red-500">*</span>
                                        </label>

                                        <div className="relative">
                                            <input
                                                type="date"
                                                value={form.purchaseDate}
                                                onChange={(event) =>
                                                    updateForm(
                                                        "purchaseDate",
                                                        event.target.value
                                                    )
                                                }
                                                className={inputClass}
                                                required
                                            />
                                        </div>
                                    </div>

                                    <div>
                                        <label className={labelClass}>
                                            Supplier
                                            <span className="ml-1 text-red-500">*</span>
                                        </label>

                                        <select
                                            value={form.supplierId}
                                            onChange={(event) =>
                                                updateForm(
                                                    "supplierId",
                                                    event.target.value
                                                )
                                            }
                                            className={inputClass}
                                            required
                                        >
                                            <option value="">
                                                Select a supplier
                                            </option>

                                            {suppliers
                                                .filter((supplier) => supplier.is_active)
                                                .map((supplier) => (
                                                    <option
                                                        key={supplier.supplier_id}
                                                        value={supplier.supplier_id}
                                                    >
                                                        {supplier.supplier_code} -{" "}
                                                        {supplier.supplier_name}
                                                    </option>
                                                ))}
                                        </select>
                                    </div>

                                    <div>
                                        <label className={labelClass}>
                                            Warehouse
                                            <span className="ml-1 text-red-500">*</span>
                                        </label>

                                        <select
                                            value={form.warehouseId}
                                            onChange={(event) =>
                                                updateForm(
                                                    "warehouseId",
                                                    event.target.value
                                                )
                                            }
                                            className={inputClass}
                                            required
                                        >
                                            <option value="">
                                                Select a warehouse
                                            </option>

                                            {warehouses
                                                .filter((warehouse) => warehouse.is_active)
                                                .map((warehouse) => (
                                                    <option
                                                        key={warehouse.warehouse_id}
                                                        value={warehouse.warehouse_id}
                                                    >
                                                        {warehouse.warehouse_code} -{" "}
                                                        {warehouse.warehouse_name}
                                                    </option>
                                                ))}
                                        </select>
                                    </div>
                                </div>
                            </section>

                            {/* PURCHASE ITEMS */}

                            <section className={`${cardClass} overflow-hidden`}>
                                <div className="p-5 sm:p-7">
                                    <SectionHeading
                                        icon="package"
                                        title="Purchase Items"
                                        description="Choose products and enter quantities, unit costs, discounts, and tax."
                                        action={
                                            (editingPurchaseId ? rights.canUpdate : rights.canCreate) ? (
                                                <button
                                                    type="button"
                                                    onClick={addItem}
                                                    className={primaryButton}
                                                >
                                                    <Icon name="plus" size={18} />
                                                    Add Product
                                                </button>
                                            ) : null
                                        }
                                    />

                                    <div className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
                                        <div className="rounded-xl border border-sky-100 bg-sky-50/80 p-4 dark:border-sky-900/60 dark:bg-sky-950/30">
                                            <p className="text-xs font-semibold text-sky-700 dark:text-sky-300">
                                                Product Lines
                                            </p>

                                            <p className="mt-2 text-2xl font-extrabold text-sky-800 dark:text-sky-200">
                                                {items.length}
                                            </p>
                                        </div>

                                        <div className="rounded-xl border border-emerald-100 bg-emerald-50/80 p-4 dark:border-emerald-900/60 dark:bg-emerald-950/30">
                                            <p className="text-xs font-semibold text-emerald-700 dark:text-emerald-300">
                                                Total Quantity
                                            </p>

                                            <p className="mt-2 text-2xl font-extrabold text-emerald-800 dark:text-emerald-200">
                                                {formatAmount(
                                                    items.reduce(
                                                        (sum, item) =>
                                                            sum +
                                                            (Number(item.quantity) || 0),
                                                        0
                                                    )
                                                )}
                                            </p>
                                        </div>

                                        <div className="rounded-xl border border-blue-100 bg-blue-50/80 p-4 dark:border-blue-900/60 dark:bg-blue-950/30">
                                            <p className="text-xs font-semibold text-blue-700 dark:text-blue-300">
                                                Items Subtotal
                                            </p>

                                            <p className="mt-2 break-words text-2xl font-extrabold text-blue-800 dark:text-blue-200">
                                                {formatAmount(subtotal)}
                                            </p>
                                        </div>
                                    </div>
                                </div>

                                <div className="overflow-x-auto border-t border-slate-100 dark:border-slate-800">
                                    <table className="w-full min-w-[1050px] border-collapse text-left">
                                        <thead>
                                            <tr>
                                                <th className={tableHeadClass}>Product</th>
                                                <th className={tableHeadClass}>Quantity</th>
                                                <th className={tableHeadClass}>Unit Cost</th>
                                                <th className={tableHeadClass}>Discount</th>
                                                <th className={tableHeadClass}>Tax</th>
                                                <th className={`${tableHeadClass} text-right`}>Line Total</th>
                                                <th className={`${tableHeadClass} text-center`}>Action</th>
                                            </tr>
                                        </thead>

                                        <tbody>
                                            {items.map((item, index) => (
                                                <tr
                                                    key={index}
                                                    className="transition hover:bg-sky-50/50 dark:hover:bg-slate-800/50"
                                                >
                                                    <td className={`${tableCellClass} min-w-[280px]`}>
                                                        <select
                                                            value={item.productId}
                                                            onChange={(event) =>
                                                                updateItem(
                                                                    index,
                                                                    "productId",
                                                                    event.target.value
                                                                )
                                                            }
                                                            className={inputClass}
                                                            required
                                                        >
                                                            <option value="">
                                                                Select product
                                                            </option>

                                                            {products
                                                                .filter((product) => product.is_active)
                                                                .map((product) => (
                                                                    <option
                                                                        key={product.product_id}
                                                                        value={product.product_id}
                                                                    >
                                                                        {product.sku} -{" "}
                                                                        {product.product_name}
                                                                    </option>
                                                                ))}
                                                        </select>
                                                    </td>

                                                    <td className={tableCellClass}>
                                                        <input
                                                            type="number"
                                                            min="0.001"
                                                            step="0.001"
                                                            value={item.quantity}
                                                            onChange={(event) =>
                                                                updateItem(
                                                                    index,
                                                                    "quantity",
                                                                    event.target.value
                                                                )
                                                            }
                                                            className={smallInputClass}
                                                            required
                                                        />
                                                    </td>

                                                    <td className={tableCellClass}>
                                                        <input
                                                            type="number"
                                                            min="0"
                                                            step="0.01"
                                                            value={item.unitCost}
                                                            onChange={(event) =>
                                                                updateItem(
                                                                    index,
                                                                    "unitCost",
                                                                    event.target.value
                                                                )
                                                            }
                                                            className={smallInputClass}
                                                            required
                                                        />
                                                    </td>

                                                    <td className={tableCellClass}>
                                                        <input
                                                            type="number"
                                                            min="0"
                                                            step="0.01"
                                                            value={item.discount}
                                                            onChange={(event) =>
                                                                updateItem(
                                                                    index,
                                                                    "discount",
                                                                    event.target.value
                                                                )
                                                            }
                                                            className={smallInputClass}
                                                        />
                                                    </td>

                                                    <td className={tableCellClass}>
                                                        <input
                                                            type="number"
                                                            min="0"
                                                            step="0.01"
                                                            value={item.tax}
                                                            onChange={(event) =>
                                                                updateItem(
                                                                    index,
                                                                    "tax",
                                                                    event.target.value
                                                                )
                                                            }
                                                            className={smallInputClass}
                                                        />
                                                    </td>

                                                    <td className={`${tableCellClass} text-right`}>
                                                        <span className="font-bold tabular-nums text-slate-900 dark:text-white">
                                                            {formatAmount(calculateLine(item))}
                                                        </span>
                                                    </td>

                                                    <td className={`${tableCellClass} text-center`}>
                                                        {(editingPurchaseId ? rights.canUpdate : rights.canCreate) && (
                                                            <button
                                                                type="button"
                                                                onClick={() => removeItem(index)}
                                                                disabled={items.length === 1}
                                                                className="inline-flex items-center justify-center gap-2 rounded-lg border border-red-100 bg-red-50 px-3 py-2 text-xs font-bold text-red-600 transition hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-40 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-300 dark:hover:bg-red-950/70"
                                                                aria-label={`Remove product row ${index + 1}`}
                                                            >
                                                                <Icon name="close" size={14} />
                                                                Remove
                                                            </button>
                                                        )}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>

                                <div className="border-t border-slate-100 bg-slate-50/70 px-5 py-4 dark:border-slate-800 dark:bg-slate-950/50 sm:px-7">
                                    <p className="text-xs leading-5 text-slate-500 dark:text-slate-400">
                                        Line total = quantity × unit cost − item discount + item tax.
                                        General discount and tax are applied in the purchase summary below.
                                    </p>
                                </div>
                            </section>

                            {/* NOTES AND TOTALS */}

                            <div className="grid grid-cols-1 gap-6 xl:grid-cols-5">
                                <section className={`${cardClass} p-5 sm:p-7 xl:col-span-3`}>
                                    <SectionHeading
                                        icon="file"
                                        title="Additional Notes"
                                        description="Keep any supplier, delivery, or internal purchase notes."
                                    />

                                    <label className={labelClass}>
                                        Purchase Notes
                                    </label>

                                    <textarea
                                        value={form.notes}
                                        onChange={(event) =>
                                            updateForm("notes", event.target.value)
                                        }
                                        rows={7}
                                        placeholder="Enter additional information about this purchase..."
                                        className={`${inputClass} min-h-[170px] resize-y`}
                                    />

                                    <p className="mt-2 text-xs text-slate-400 dark:text-slate-500">
                                        Notes will also appear in the purchase report.
                                    </p>
                                </section>

                                <section className={`${cardClass} relative overflow-hidden p-5 sm:p-7 xl:col-span-2`}>
                                    <div className="absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r from-blue-500 via-sky-400 to-emerald-500" />

                                    <SectionHeading
                                        icon="receipt"
                                        title="Purchase Summary"
                                        description="Review the final purchase amount."
                                    />

                                    <div className="space-y-4">
                                        <div className="flex items-center justify-between gap-4">
                                            <span className="text-sm text-slate-500 dark:text-slate-400">
                                                Items Subtotal
                                            </span>

                                            <span className="font-semibold tabular-nums text-slate-800 dark:text-slate-100">
                                                {formatAmount(subtotal)}
                                            </span>
                                        </div>

                                        <div className="flex items-center justify-between gap-4">
                                            <label
                                                htmlFor="purchase-discount"
                                                className="text-sm text-slate-500 dark:text-slate-400"
                                            >
                                                Overall Discount
                                            </label>

                                            <input
                                                id="purchase-discount"
                                                type="number"
                                                min="0"
                                                step="0.01"
                                                value={form.discount}
                                                onChange={(event) =>
                                                    updateForm("discount", event.target.value)
                                                }
                                                className={`${smallInputClass} max-w-[145px] text-right`}
                                            />
                                        </div>

                                        <div className="flex items-center justify-between gap-4">
                                            <label
                                                htmlFor="purchase-tax"
                                                className="text-sm text-slate-500 dark:text-slate-400"
                                            >
                                                Overall Tax
                                            </label>

                                            <input
                                                id="purchase-tax"
                                                type="number"
                                                min="0"
                                                step="0.01"
                                                value={form.tax}
                                                onChange={(event) =>
                                                    updateForm("tax", event.target.value)
                                                }
                                                className={`${smallInputClass} max-w-[145px] text-right`}
                                            />
                                        </div>

                                        <div className="border-t border-dashed border-slate-200 pt-4 dark:border-slate-700">
                                            <div className="flex items-center justify-between gap-3">
                                                <div>
                                                    <p className="text-sm font-semibold text-slate-600 dark:text-slate-300">
                                                        Grand Total
                                                    </p>

                                                    <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">
                                                        Final purchase amount
                                                    </p>
                                                </div>

                                                <p className="break-words text-right text-2xl font-extrabold tracking-tight text-emerald-700 dark:text-emerald-400 sm:text-3xl">
                                                    {formatAmount(total)}
                                                </p>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="mt-7 grid grid-cols-1 gap-3 sm:grid-cols-2">
                                        <button
                                            type="button"
                                            onClick={cancelPurchaseForm}
                                            disabled={saving}
                                            className={secondaryButton}
                                        >
                                            Cancel
                                        </button>

                                        <button
                                            type="submit"
                                            disabled={saving}
                                            className={primaryButton}
                                        >
                                            {saving ? (
                                                <>
                                                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                                                    Saving...
                                                </>
                                            ) : (
                                                <>
                                                    <Icon name="check" size={17} />
                                                    {editingPurchaseId
                                                        ? "Save Changes"
                                                        : "Save Purchase"}
                                                </>
                                            )}
                                        </button>
                                    </div>
                                </section>
                            </div>
                        </form>
                    </div>
                )}

                {/* =================================================
                    PURCHASE HISTORY
                ================================================= */}

                {!showForm && (
                    <>
                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
                            <SummaryCard
                                icon="package"
                                label="Total Purchases"
                                value={purchases.length.toLocaleString("en-PK")}
                                description="Purchase records in your system"
                                accent="blue"
                            />

                            <SummaryCard
                                icon="wallet"
                                label="Total Purchase Value"
                                value={formatAmount(totalPurchaseValue)}
                                description="Combined value of recorded purchases"
                                accent="green"
                            />

                            <SummaryCard
                                icon="clock"
                                label="Outstanding Balance"
                                value={formatAmount(totalOutstanding)}
                                description="Remaining balance across purchases"
                                accent="cyan"
                            />
                        </div>

                        <section className={`${cardClass} overflow-hidden`}>
                            <div className="p-5 sm:p-7">
                                <SectionHeading
                                    icon="layers"
                                    title="Purchase History"
                                    description="Search, review, and edit your saved purchase records."
                                    action={
                                        <span className="inline-flex w-fit items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3.5 py-2 text-xs font-bold text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300">
                                            <span className="h-2 w-2 rounded-full bg-emerald-500" />
                                            {filteredPurchases.length}{" "}
                                            {filteredPurchases.length === 1
                                                ? "record"
                                                : "records"}
                                        </span>
                                    }
                                />

                                <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                                    <div className="relative flex-1">
                                        <Icon
                                            name="search"
                                            size={19}
                                            className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"
                                        />

                                        <input
                                            type="search"
                                            value={search}
                                            onChange={(event) =>
                                                setSearch(event.target.value)
                                            }
                                            placeholder="Search purchase number, supplier, warehouse, status..."
                                            className={`${inputClass} pl-11`}
                                        />
                                    </div>

                                    {search && (
                                        <button
                                            type="button"
                                            onClick={() => setSearch("")}
                                            className={secondaryButton}
                                        >
                                            <Icon name="close" size={16} />
                                            Clear Search
                                        </button>
                                    )}

                                    <button
                                        type="button"
                                        onClick={fetchData}
                                        className={secondaryButton}
                                    >
                                        <Icon name="refresh" size={17} />
                                        Refresh
                                    </button>
                                </div>
                            </div>

                            <div className="overflow-x-auto">
                                <table className="w-full min-w-[1100px] border-collapse text-left">
                                    <thead>
                                        <tr>
                                            <th className={tableHeadClass}>Purchase</th>
                                            <th className={tableHeadClass}>Supplier</th>
                                            <th className={tableHeadClass}>Warehouse</th>
                                            <th className={tableHeadClass}>Date</th>
                                            <th className={`${tableHeadClass} text-right`}>Total</th>
                                            <th className={`${tableHeadClass} text-right`}>Paid</th>
                                            <th className={`${tableHeadClass} text-right`}>Balance</th>
                                            <th className={tableHeadClass}>Status</th>
                                            <th className={tableHeadClass}>Actions</th>
                                        </tr>
                                    </thead>

                                    <tbody>
                                        {filteredPurchases.map((purchase) => (
                                            <tr
                                                key={purchase.purchase_id}
                                                className="group transition-colors hover:bg-sky-50/60 dark:hover:bg-slate-800/60"
                                            >
                                                <td className={tableCellClass}>
                                                    <button
                                                        type="button"
                                                        onClick={() => viewPurchase(purchase)}
                                                        className="text-left font-bold text-blue-700 decoration-blue-500 underline-offset-4 hover:underline dark:text-sky-300"
                                                    >
                                                        {purchase.purchase_number || "-"}
                                                    </button>

                                                    <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">
                                                        ID: {purchase.purchase_id}
                                                    </p>
                                                </td>

                                                <td className={tableCellClass}>
                                                    <p className="font-semibold text-slate-800 dark:text-slate-200">
                                                        {purchase.supplier_name || "-"}
                                                    </p>

                                                    {purchase.supplier_code && (
                                                        <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">
                                                            {purchase.supplier_code}
                                                        </p>
                                                    )}
                                                </td>

                                                <td className={tableCellClass}>
                                                    {purchase.warehouse_name || "-"}
                                                </td>

                                                <td className={tableCellClass}>
                                                    <span className="whitespace-nowrap">
                                                        {formatDate(purchase.purchase_date)}
                                                    </span>
                                                </td>

                                                <td className={`${tableCellClass} text-right`}>
                                                    <span className="font-bold tabular-nums text-slate-900 dark:text-white">
                                                        {formatAmount(purchase.total_amount)}
                                                    </span>
                                                </td>

                                                <td className={`${tableCellClass} text-right tabular-nums`}>
                                                    {formatAmount(purchase.paid_amount)}
                                                </td>

                                                <td className={`${tableCellClass} text-right`}>
                                                    <span className="font-semibold tabular-nums text-emerald-700 dark:text-emerald-400">
                                                        {formatAmount(purchase.balance_amount)}
                                                    </span>
                                                </td>

                                                <td className={tableCellClass}>
                                                    <span
                                                        className={`inline-flex items-center whitespace-nowrap rounded-full border px-2.5 py-1 text-xs font-bold ${getStatusClass(
                                                            purchase.status
                                                        )}`}
                                                    >
                                                        {purchase.status || "Unknown"}
                                                    </span>
                                                </td>

                                                <td className={tableCellClass}>
                                                    <div className="flex items-center gap-2">
                                                        <button
                                                            type="button"
                                                            onClick={() => viewPurchase(purchase)}
                                                            className="inline-flex items-center gap-1.5 rounded-lg border border-sky-200 bg-sky-50 px-3 py-2 text-xs font-bold text-sky-700 transition hover:bg-sky-100 dark:border-sky-900 dark:bg-sky-950/50 dark:text-sky-300 dark:hover:bg-sky-950"
                                                        >
                                                            <Icon name="eye" size={14} />
                                                            View
                                                        </button>

                                                        {rights.canUpdate && (
                                                            <button
                                                                type="button"
                                                                onClick={() => editPurchase(purchase)}
                                                                className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-700 transition hover:bg-emerald-100 dark:border-emerald-900 dark:bg-emerald-950/50 dark:text-emerald-300 dark:hover:bg-emerald-950"
                                                            >
                                                                <Icon name="edit" size={14} />
                                                                Edit
                                                            </button>
                                                        )}
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}

                                        {filteredPurchases.length === 0 && (
                                            <tr>
                                                <td colSpan={9} className="p-0">
                                                    {search ? (
                                                        <div className="px-6 py-16 text-center">
                                                            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-300">
                                                                <Icon name="searchFile" size={30} />
                                                            </div>

                                                            <h3 className="mt-4 font-bold text-slate-800 dark:text-white">
                                                                No matching purchases
                                                            </h3>

                                                            <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
                                                                Try a different purchase number, supplier, or search term.
                                                            </p>

                                                            <button
                                                                type="button"
                                                                onClick={() => setSearch("")}
                                                                className={`${secondaryButton} mt-4`}
                                                            >
                                                                <Icon name="close" size={16} />
                                                                Clear Search
                                                            </button>
                                                        </div>
                                                    ) : (
                                                        <EmptyState
                                                            onAdd={openNewPurchaseForm}
                                                            canCreate={rights.canCreate}
                                                        />
                                                    )}
                                                </td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>

                            <div className="flex flex-col gap-2 border-t border-slate-100 bg-slate-50/70 px-5 py-4 text-xs text-slate-500 dark:border-slate-800 dark:bg-slate-950/50 dark:text-slate-400 sm:flex-row sm:items-center sm:justify-between">
                                <span>
                                    Showing {filteredPurchases.length} of{" "}
                                    {purchases.length} purchase records
                                </span>

                                <span>Purchase Management · Inventory</span>
                            </div>
                        </section>
                    </>
                )}

                {/* =================================================
                    LOADING OVERLAY
                ================================================= */}

                {popupLoading && (
                    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm">
                        <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-2xl dark:border-slate-700 dark:bg-slate-900">
                            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-sky-50 text-blue-600 dark:bg-slate-800 dark:text-sky-300">
                                <span className="h-8 w-8 animate-spin rounded-full border-4 border-sky-100 border-t-blue-600 dark:border-slate-700 dark:border-t-sky-400" />
                            </div>

                            <h3 className="mt-5 font-bold text-slate-900 dark:text-white">
                                Loading purchase
                            </h3>

                            <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
                                Please wait while the details are retrieved.
                            </p>
                        </div>
                    </div>
                )}

                {/* =================================================
                    PURCHASE REPORT MODAL
                ================================================= */}

                {selectedPurchase && (
                    <div
                        className="fixed inset-0 z-[9998] flex items-center justify-center bg-slate-950/70 p-2 backdrop-blur-sm sm:p-5"
                        onMouseDown={(event) => {
                            if (event.target === event.currentTarget) {
                                closePurchasePopup();
                            }
                        }}
                    >
                        <div className="flex max-h-[95vh] w-full max-w-6xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-900 sm:rounded-3xl">

                            {/* MODAL HEADER */}

                            <div className="flex shrink-0 items-center justify-between gap-4 border-b border-slate-200 bg-gradient-to-r from-sky-50 to-emerald-50 p-4 dark:border-slate-800 dark:from-slate-900 dark:to-slate-800 sm:p-6">
                                <div className="flex min-w-0 items-center gap-3">
                                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-600 to-emerald-500 text-white shadow-lg shadow-blue-600/20">
                                        <Icon name="receipt" size={25} />
                                    </div>

                                    <div className="min-w-0">
                                        <h2 className="text-lg font-extrabold text-slate-900 dark:text-white sm:text-2xl">
                                            Purchase Report
                                        </h2>

                                        <p className="mt-1 truncate text-sm text-slate-500 dark:text-slate-400">
                                            Purchase #{selectedPurchase.purchase_number || "-"}
                                        </p>
                                    </div>
                                </div>

                                <button
                                    type="button"
                                    onClick={closePurchasePopup}
                                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500 transition hover:border-red-200 hover:bg-red-50 hover:text-red-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:border-red-900 dark:hover:bg-red-950/50 dark:hover:text-red-300"
                                    aria-label="Close purchase report"
                                >
                                    <Icon name="close" size={21} />
                                </button>
                            </div>

                            {/* REPORT BODY */}

                            <div className="overflow-y-auto">
                                <div
                                    id="purchase-report"
                                    className="bg-white p-4 text-slate-900 dark:bg-white dark:text-slate-900 sm:p-7"
                                >
                                    <div className="mb-7 flex flex-col gap-4 border-b-2 border-blue-600 pb-5 sm:flex-row sm:items-center sm:justify-between">
                                        <div>
                                            <p className="text-xs font-bold uppercase tracking-[0.2em] text-emerald-600">
                                                Purchase Document
                                            </p>

                                            <h1 className="mt-2 text-2xl font-extrabold tracking-tight text-slate-900 sm:text-3xl">
                                                Purchase Report
                                            </h1>

                                            <p className="mt-1 text-sm text-slate-500">
                                                Purchase details and itemized summary
                                            </p>
                                        </div>

                                        <div className="sm:text-right">
                                            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                                                Purchase Number
                                            </p>

                                            <p className="mt-1 break-words text-xl font-extrabold text-blue-700">
                                                {selectedPurchase.purchase_number || "-"}
                                            </p>

                                            <p className="mt-1 text-sm text-slate-500">
                                                {formatDate(selectedPurchase.purchase_date)}
                                            </p>
                                        </div>
                                    </div>

                                    {/* PURCHASE DETAILS */}

                                    <div className="mb-7 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                                        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                                            <p className="text-xs font-bold uppercase tracking-wider text-slate-500">
                                                Supplier
                                            </p>

                                            <p className="mt-2 break-words font-bold text-slate-900">
                                                {selectedPurchase.supplier_name || "-"}
                                            </p>

                                            <p className="mt-1 text-sm text-slate-500">
                                                {selectedPurchase.supplier_code || ""}
                                            </p>
                                        </div>

                                        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                                            <p className="text-xs font-bold uppercase tracking-wider text-slate-500">
                                                Warehouse
                                            </p>

                                            <p className="mt-2 break-words font-bold text-slate-900">
                                                {selectedPurchase.warehouse_name || "-"}
                                            </p>

                                            <p className="mt-1 text-sm text-slate-500">
                                                {selectedPurchase.warehouse_code || ""}
                                            </p>
                                        </div>

                                        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                                            <p className="text-xs font-bold uppercase tracking-wider text-slate-500">
                                                Purchase Status
                                            </p>

                                            <p className="mt-2">
                                                <span
                                                    className={`inline-flex rounded-full border px-3 py-1 text-xs font-bold ${getStatusClass(
                                                        selectedPurchase.status
                                                    )}`}
                                                >
                                                    {selectedPurchase.status || "Unknown"}
                                                </span>
                                            </p>
                                        </div>
                                    </div>

                                    {/* PURCHASE ITEMS TABLE */}

                                    <div className="mb-7 overflow-hidden rounded-xl border border-slate-200">
                                        <div className="flex items-center gap-2 border-b border-slate-200 bg-sky-50 px-4 py-3">
                                            <Icon
                                                name="package"
                                                size={18}
                                                className="text-blue-700"
                                            />

                                            <h3 className="font-bold text-slate-900">
                                                Purchase Items
                                            </h3>
                                        </div>

                                        <div className="overflow-x-auto">
                                            <table className="w-full min-w-[750px] border-collapse text-sm">
                                                <thead>
                                                    <tr className="bg-slate-100">
                                                        <th className="border-b border-slate-200 p-3 text-left text-xs font-bold uppercase tracking-wider text-slate-600">
                                                            SKU
                                                        </th>

                                                        <th className="border-b border-slate-200 p-3 text-left text-xs font-bold uppercase tracking-wider text-slate-600">
                                                            Product
                                                        </th>

                                                        <th className="border-b border-slate-200 p-3 text-right text-xs font-bold uppercase tracking-wider text-slate-600">
                                                            Quantity
                                                        </th>

                                                        <th className="border-b border-slate-200 p-3 text-right text-xs font-bold uppercase tracking-wider text-slate-600">
                                                            Unit Cost
                                                        </th>

                                                        <th className="border-b border-slate-200 p-3 text-right text-xs font-bold uppercase tracking-wider text-slate-600">
                                                            Discount
                                                        </th>

                                                        <th className="border-b border-slate-200 p-3 text-right text-xs font-bold uppercase tracking-wider text-slate-600">
                                                            Tax
                                                        </th>

                                                        <th className="border-b border-slate-200 p-3 text-right text-xs font-bold uppercase tracking-wider text-slate-600">
                                                            Total
                                                        </th>
                                                    </tr>
                                                </thead>

                                                <tbody>
                                                    {(selectedPurchase.items || []).map((item, index) => (
                                                        <tr
                                                            key={
                                                                item.purchase_item_id ||
                                                                `${item.product_id}-${index}`
                                                            }
                                                            className="even:bg-slate-50"
                                                        >
                                                            <td className="border-b border-slate-100 p-3 text-slate-600">
                                                                {item.sku || "-"}
                                                            </td>

                                                            <td className="border-b border-slate-100 p-3 font-semibold text-slate-900">
                                                                {item.product_name || "-"}
                                                            </td>

                                                            <td className="border-b border-slate-100 p-3 text-right tabular-nums text-slate-600">
                                                                {formatAmount(item.quantity)}
                                                            </td>

                                                            <td className="border-b border-slate-100 p-3 text-right tabular-nums text-slate-600">
                                                                {formatAmount(item.unit_cost)}
                                                            </td>

                                                            <td className="border-b border-slate-100 p-3 text-right tabular-nums text-slate-600">
                                                                {formatAmount(item.discount)}
                                                            </td>

                                                            <td className="border-b border-slate-100 p-3 text-right tabular-nums text-slate-600">
                                                                {formatAmount(item.tax)}
                                                            </td>

                                                            <td className="border-b border-slate-100 p-3 text-right font-bold tabular-nums text-slate-900">
                                                                {formatAmount(item.line_total)}
                                                            </td>
                                                        </tr>
                                                    ))}

                                                    {(selectedPurchase.items || []).length === 0 && (
                                                        <tr>
                                                            <td
                                                                colSpan={7}
                                                                className="p-8 text-center text-slate-500"
                                                            >
                                                                No purchase items found.
                                                            </td>
                                                        </tr>
                                                    )}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>

                                    {/* PURCHASE SUMMARY */}

                                    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                                        <div>
                                            {selectedPurchase.notes && (
                                                <div className="rounded-xl border border-slate-200 p-4">
                                                    <div className="flex items-center gap-2">
                                                        <Icon
                                                            name="file"
                                                            size={18}
                                                            className="text-blue-700"
                                                        />

                                                        <h3 className="font-bold text-slate-900">
                                                            Notes
                                                        </h3>
                                                    </div>

                                                    <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-600">
                                                        {selectedPurchase.notes}
                                                    </p>
                                                </div>
                                            )}
                                        </div>

                                        <div className="overflow-hidden rounded-xl border border-slate-200">
                                            <div className="flex items-center gap-2 border-b border-slate-200 bg-emerald-50 px-4 py-3">
                                                <Icon
                                                    name="receipt"
                                                    size={18}
                                                    className="text-emerald-700"
                                                />

                                                <h3 className="font-bold text-slate-900">
                                                    Purchase Summary
                                                </h3>
                                            </div>

                                            <div className="divide-y divide-slate-100">
                                                <div className="flex justify-between gap-4 px-4 py-3 text-sm">
                                                    <span className="text-slate-500">
                                                        Subtotal
                                                    </span>

                                                    <span className="font-semibold tabular-nums text-slate-800">
                                                        {formatAmount(selectedPurchase.subtotal)}
                                                    </span>
                                                </div>

                                                <div className="flex justify-between gap-4 px-4 py-3 text-sm">
                                                    <span className="text-slate-500">
                                                        Discount
                                                    </span>

                                                    <span className="font-semibold tabular-nums text-slate-800">
                                                        {formatAmount(selectedPurchase.discount)}
                                                    </span>
                                                </div>

                                                <div className="flex justify-between gap-4 px-4 py-3 text-sm">
                                                    <span className="text-slate-500">
                                                        Tax
                                                    </span>

                                                    <span className="font-semibold tabular-nums text-slate-800">
                                                        {formatAmount(selectedPurchase.tax)}
                                                    </span>
                                                </div>

                                                <div className="flex justify-between gap-4 bg-blue-50 px-4 py-4">
                                                    <span className="font-bold text-slate-900">
                                                        Grand Total
                                                    </span>

                                                    <span className="font-extrabold tabular-nums text-blue-700">
                                                        {formatAmount(selectedPurchase.total_amount)}
                                                    </span>
                                                </div>

                                                <div className="flex justify-between gap-4 px-4 py-3 text-sm">
                                                    <span className="text-slate-500">
                                                        Paid Amount
                                                    </span>

                                                    <span className="font-semibold tabular-nums text-emerald-700">
                                                        {formatAmount(selectedPurchase.paid_amount)}
                                                    </span>
                                                </div>

                                                <div className="flex justify-between gap-4 px-4 py-3 text-sm">
                                                    <span className="font-semibold text-slate-700">
                                                        Outstanding Balance
                                                    </span>

                                                    <span className="font-bold tabular-nums text-rose-600">
                                                        {formatAmount(selectedPurchase.balance_amount)}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="mt-8 border-t border-slate-200 pt-4 text-center text-xs text-slate-400">
                                        Generated from the Purchase Management System
                                    </div>
                                </div>
                            </div>

                            {/* MODAL FOOTER */}

                            <div className="flex shrink-0 flex-wrap justify-end gap-3 border-t border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-900 sm:p-5">
                                <button
                                    type="button"
                                    onClick={printPurchase}
                                    className={secondaryButton}
                                >
                                    <Icon name="printer" size={17} />
                                    Print
                                </button>

                                <button
                                    type="button"
                                    onClick={downloadPurchasePDF}
                                    className={primaryButton}
                                >
                                    <Icon name="download" size={17} />
                                    Download PDF
                                </button>

                                <button
                                    type="button"
                                    onClick={closePurchasePopup}
                                    className={secondaryButton}
                                >
                                    <Icon name="close" size={17} />
                                    Close
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* =================================================
                    PRINT STYLES
                ================================================= */}

                <style jsx global>{`
                    @media print {
                        @page {
                            size: A4;
                            margin: 10mm;
                        }

                        body * {
                            visibility: hidden !important;
                        }

                        #purchase-report,
                        #purchase-report * {
                            visibility: visible !important;
                        }

                        #purchase-report {
                            position: absolute !important;
                            left: 0 !important;
                            top: 0 !important;
                            width: 100% !important;
                            margin: 0 !important;
                            padding: 0 !important;
                            background: white !important;
                            color: black !important;
                            box-shadow: none !important;
                        }

                        #purchase-report table {
                            width: 100% !important;
                            border-collapse: collapse !important;
                        }

                        #purchase-report th,
                        #purchase-report td {
                            color: black !important;
                            -webkit-print-color-adjust: exact;
                            print-color-adjust: exact;
                        }

                        #purchase-report tr {
                            break-inside: avoid;
                        }
                    }
                `}</style>
            </div>
        </div>
    );
}