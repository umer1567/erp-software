"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

/* =========================================================
   CONSTANTS
========================================================= */

const PERMISSION_KEY = "purchase_dashboard";

const DEFAULT_PERMISSIONS = {
    can_view: false,
    can_create: false,
    can_update: false,
    can_delete: false,
};

const today = () => {
    const date = new Date();
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
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

/* =========================================================
   STYLES
========================================================= */

const inputClass =
    "w-full rounded-xl border border-slate-200 bg-white px-3.5 py-3 text-sm text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-sky-500 focus:ring-4 focus:ring-sky-500/10 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:border-sky-400 dark:focus:ring-sky-400/10";

const labelClass =
    "mb-2 block text-sm font-semibold text-slate-700 dark:text-slate-300";

const panelClass =
    "rounded-2xl border border-slate-200/80 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-950";

const buttonPrimary =
    "inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-700 to-teal-600 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-emerald-900/10 transition hover:-translate-y-0.5 hover:from-emerald-800 hover:to-teal-700 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0";

const buttonSecondary =
    "inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:border-sky-300 hover:bg-sky-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:border-sky-700 dark:hover:bg-slate-800";

/* =========================================================
   HELPERS
========================================================= */

function toBoolean(value) {
    if (typeof value === "boolean") return value;
    if (typeof value === "number") return value === 1;

    if (typeof value === "string") {
        return ["true", "1", "yes", "on"].includes(
            value.trim().toLowerCase()
        );
    }

    return false;
}

function normalizePermissionKey(value) {
    return String(value || "")
        .trim()
        .toLowerCase()
        .replace(/[\s-]+/g, "_");
}

function normalizePermissions(permission) {
    if (!permission) return { ...DEFAULT_PERMISSIONS };

    return {
        can_view: toBoolean(
            permission.can_view ?? permission.canView
        ),
        can_create: toBoolean(
            permission.can_create ?? permission.canCreate
        ),
        can_update: toBoolean(
            permission.can_update ?? permission.canUpdate
        ),
        can_delete: toBoolean(
            permission.can_delete ?? permission.canDelete
        ),
    };
}

function extractPermissionList(data) {
    if (Array.isArray(data)) return data;
    if (Array.isArray(data?.permissions)) return data.permissions;
    if (Array.isArray(data?.data?.permissions)) return data.data.permissions;
    if (Array.isArray(data?.data)) return data.data;
    if (Array.isArray(data?.result?.permissions)) {
        return data.result.permissions;
    }

    return [];
}

function formatAmount(value) {
    return Number(value ?? 0).toLocaleString("en-PK", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    });
}

function formatDate(value) {
    if (!value) return "-";
    const normalized = String(value).split("T")[0];
    return normalized === "Invalid Date" ? "-" : normalized;
}

function safeNumber(value) {
    const number = Number(value);
    return Number.isFinite(number) ? number : 0;
}

function getPurchaseTotal(purchase) {
    return safeNumber(purchase?.total_amount);
}

function getPurchasePaid(purchase) {
    return safeNumber(purchase?.paid_amount);
}

function getPurchaseBalance(purchase) {
    return safeNumber(purchase?.balance_amount);
}

function getStatusStyle(status) {
    const normalized = String(status || "").toLowerCase();

    if (
        normalized.includes("paid") &&
        !normalized.includes("unpaid") &&
        !normalized.includes("partial")
    ) {
        return "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/50 dark:text-emerald-300";
    }

    if (normalized.includes("partial")) {
        return "border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-900 dark:bg-sky-950/50 dark:text-sky-300";
    }

    if (
        normalized.includes("pending") ||
        normalized.includes("unpaid") ||
        normalized.includes("due")
    ) {
        return "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950/50 dark:text-amber-300";
    }

    if (normalized.includes("cancel")) {
        return "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-900 dark:bg-rose-950/50 dark:text-rose-300";
    }

    return "border-slate-200 bg-slate-100 text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300";
}

/* =========================================================
   ICONS
========================================================= */

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
        shopping: (
            <>
                <path d="M3 3h2l2.4 12.1a2 2 0 0 0 2 1.6h8.8a2 2 0 0 0 2-1.6L22 8H6" />
                <circle cx="10" cy="21" r="1" />
                <circle cx="19" cy="21" r="1" />
            </>
        ),
        plus: <path d="M12 5v14M5 12h14" />,
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
                <path d="M5.6 9a7 7 0 0 1 11.6-2L20 12" />
                <path d="M4 12l2.8 5a7 7 0 0 0 11.6-2" />
            </>
        ),
        close: <path d="m18 6-12 12M6 6l12 12" />,
        calendar: (
            <>
                <rect x="3" y="5" width="18" height="16" rx="2" />
                <path d="M16 3v4M8 3v4M3 11h18" />
            </>
        ),
        package: (
            <>
                <path d="m12 3 9 5-9 5-9-5 9-5Z" />
                <path d="m3 8 9 5 9-5M3 8v9l9 5 9-5V8M12 13v9" />
            </>
        ),
        money: (
            <>
                <rect x="2" y="5" width="20" height="14" rx="2" />
                <circle cx="12" cy="12" r="3" />
                <path d="M6 9h.01M18 15h.01" />
            </>
        ),
        chart: (
            <>
                <path d="M3 3v18h18" />
                <path d="m7 14 4-4 4 4 6-7" />
            </>
        ),
        eye: (
            <>
                <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12Z" />
                <circle cx="12" cy="12" r="3" />
            </>
        ),
        edit: (
            <>
                <path d="M12 20h9" />
                <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L9 17l-4 1 1-4Z" />
            </>
        ),
        download: (
            <>
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <path d="m7 10 5 5 5-5M12 15V3" />
            </>
        ),
        print: (
            <>
                <path d="M6 9V3h12v6" />
                <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
                <path d="M6 14h12v7H6z" />
            </>
        ),
        file: (
            <>
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z" />
                <path d="M14 2v6h6M8 13h8M8 17h8" />
            </>
        ),
        check: <path d="m5 12 4 4L19 6" />,
        alert: (
            <>
                <path d="M10.3 3.9 2.4 18a2 2 0 0 0 1.7 3h15.8a2 2 0 0 0 1.7-3l-7.9-14.1a2 2 0 0 0-3.4 0Z" />
                <path d="M12 9v4M12 17h.01" />
            </>
        ),
        filter: <path d="M4 6h16M7 12h10M10 18h4" />,
        closeCircle: (
            <>
                <circle cx="12" cy="12" r="10" />
                <path d="m15 9-6 6m0-6 6 6" />
            </>
        ),
        lock: (
            <>
                <rect x="4" y="10" width="16" height="11" rx="2" />
                <path d="M8 10V7a4 4 0 1 1 8 0v3" />
            </>
        ),
    };

    return <svg {...common}>{paths[name] || paths.file}</svg>;
}

/* =========================================================
   SUMMARY CARD
========================================================= */

function SummaryCard({ title, value, description, icon, tone }) {
    const tones = {
        green: {
            icon: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
            accent: "from-emerald-500 to-teal-500",
        },
        blue: {
            icon: "bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-300",
            accent: "from-sky-500 to-blue-600",
        },
        cyan: {
            icon: "bg-cyan-100 text-cyan-700 dark:bg-cyan-950 dark:text-cyan-300",
            accent: "from-cyan-500 to-teal-500",
        },
        amber: {
            icon: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
            accent: "from-amber-400 to-orange-500",
        },
    };

    const style = tones[tone] || tones.green;

    return (
        <div className="group relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition duration-200 hover:-translate-y-1 hover:shadow-lg dark:border-slate-800 dark:bg-slate-950">
            <div className={`absolute inset-x-0 top-0 h-1 bg-gradient-to-r ${style.accent}`} />

            <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                    <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
                        {title}
                    </p>

                    <p className="mt-3 break-words text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
                        {value}
                    </p>

                    <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                        {description}
                    </p>
                </div>

                <div className={`rounded-xl p-3 ${style.icon}`}>
                    <Icon name={icon} size={22} />
                </div>
            </div>
        </div>
    );
}

function StatusBadge({ status }) {
    return (
        <span className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-3 py-1 text-xs font-semibold ${getStatusStyle(status)}`}>
            <span className="h-1.5 w-1.5 rounded-full bg-current" />
            {status || "Unknown"}
        </span>
    );
}

/* =========================================================
   MAIN PAGE
========================================================= */

export default function PurchasesPage() {
    const [purchases, setPurchases] = useState([]);
    const [suppliers, setSuppliers] = useState([]);
    const [warehouses, setWarehouses] = useState([]);
    const [products, setProducts] = useState([]);

    const [form, setForm] = useState(emptyForm());
    const [items, setItems] = useState([emptyItem()]);

    const [loading, setLoading] = useState(true);
    const [permissionLoading, setPermissionLoading] = useState(true);
    const [permissions, setPermissions] = useState(DEFAULT_PERMISSIONS);

    const [saving, setSaving] = useState(false);
    const [refreshing, setRefreshing] = useState(false);
    const [error, setError] = useState("");
    const [message, setMessage] = useState("");
    const [showForm, setShowForm] = useState(false);

    const [selectedPurchase, setSelectedPurchase] = useState(null);
    const [editingPurchaseId, setEditingPurchaseId] = useState(null);
    const [search, setSearch] = useState("");
    const [statusFilter, setStatusFilter] = useState("all");
    const [viewLoadingId, setViewLoadingId] = useState(null);

    const canView = permissions.can_view;
    const canCreate = permissions.can_create;
    const canUpdate = permissions.can_update;
    const canDelete = permissions.can_delete;

    /* =====================================================
       PERMISSION FETCHING
    ===================================================== */

    const fetchPurchasePermissions = useCallback(async () => {
  try {
    const response = await fetch("/api/permissions/current", {
      method: "GET",
      credentials: "same-origin",
      cache: "no-store",
      headers: {
        Accept: "application/json",
      },
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(
        data.message || "Unable to load purchase dashboard permissions."
      );
    }

    const permissionList = extractPermissionList(data);

    const permission = permissionList.find((item) => {
      const key = normalizePermissionKey(item.permission_key);

      return key === PERMISSION_KEY;
    });

    console.log("[PURCHASE DASHBOARD PERMISSION]", {
      expectedKey: PERMISSION_KEY,
      matchedPermission: permission || null,
      availableKeys: permissionList.map(
        (item) => item.permission_key
      ),
    });

    if (!permission) {
      return {
        can_view: false,
        can_create: false,
        can_update: false,
        can_delete: false,
      };
    }

    return normalizePermissions(permission);
  } catch (error) {
    console.error(
      "Failed to load purchase dashboard permissions:",
      error
    );

    return {
      can_view: false,
      can_create: false,
      can_update: false,
      can_delete: false,
    };
  }
}, []);

    /* =====================================================
       LOAD PURCHASE DATA
    ===================================================== */

    const clearPurchaseData = useCallback(() => {
        setPurchases([]);
        setSuppliers([]);
        setWarehouses([]);
        setProducts([]);
        setSelectedPurchase(null);
        setShowForm(false);
        setEditingPurchaseId(null);
        setForm(emptyForm());
        setItems([emptyItem()]);
    }, []);

    const loadPurchaseData = useCallback(async () => {
        const endpoints = [
            "/api/purchases",
            "/api/suppliers",
            "/api/warehouses",
            "/api/products",
        ];

        const responses = await Promise.all(
            endpoints.map((url) =>
                fetch(url, {
                    cache: "no-store",
                    credentials: "same-origin",
                })
            )
        );

        const results = await Promise.all(
            responses.map(async (response) => ({
                response,
                data: await response.json().catch(() => ({})),
            }))
        );

        const failed = results.find((result) => !result.response.ok);

        if (failed) {
            throw new Error(
                failed.data.message || "Failed to load purchase data."
            );
        }

        setPurchases(results[0].data.purchases || []);
        setSuppliers(results[1].data.suppliers || []);
        setWarehouses(results[2].data.warehouses || []);
        setProducts(results[3].data.products || []);
    }, []);

    const loadPurchases = useCallback(async () => {
        if (!permissions.can_view) {
            throw new Error("You do not have permission to view purchases.");
        }

        const response = await fetch("/api/purchases", {
            cache: "no-store",
            credentials: "same-origin",
        });

        const data = await response.json().catch(() => ({}));

        if (!response.ok) {
            throw new Error(data.message || "Failed to load purchases.");
        }

        setPurchases(data.purchases || []);
    }, [permissions.can_view]);

    const refreshAll = useCallback(
        async (showSpinner = true) => {
            // Always verify the latest permission before loading protected data.
            if (showSpinner) setRefreshing(true);
            setError("");

            try {
                const latestPermissions = await fetchPurchasePermissions();

                setPermissions(latestPermissions);

                if (!latestPermissions.can_view) {
                    clearPurchaseData();
                    setError("You do not have permission to view purchases.");
                    return;
                }

                await loadPurchaseData();
            } catch (err) {
                setError(err.message || "Failed to refresh purchase data.");
            } finally {
                setLoading(false);
                setRefreshing(false);
            }
        },
        [fetchPurchasePermissions, loadPurchaseData, clearPurchaseData]
    );

    /* =====================================================
       INITIAL PERMISSION CHECK
    ===================================================== */

    useEffect(() => {
        let cancelled = false;

        async function initializePage() {
            try {
                const currentPermissions =
                    await fetchPurchasePermissions();

                if (cancelled) return;

                setPermissions(currentPermissions);
                setPermissionLoading(false);

                if (!currentPermissions.can_view) {
                    clearPurchaseData();
                    return;
                }

                await loadPurchaseData();
            } catch (err) {
                if (!cancelled) {
                    setPermissions(DEFAULT_PERMISSIONS);
                    clearPurchaseData();
                    setError(
                        err.message || "Unable to initialize purchase page."
                    );
                }
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
        };
    }, [
        fetchPurchasePermissions,
        loadPurchaseData,
        clearPurchaseData,
    ]);

    /* =====================================================
       LIVE PERMISSION UPDATES
       User Rights page should dispatch:
       window.dispatchEvent(new Event("erp-permissions-updated"))
    ===================================================== */

    useEffect(() => {
        let cancelled = false;
        let updating = false;

        async function handlePermissionUpdate() {
            if (updating) return;
            updating = true;

            try {
                const updatedPermissions =
                    await fetchPurchasePermissions();

                if (cancelled) return;

                setPermissions(updatedPermissions);

                if (!updatedPermissions.can_view) {
                    clearPurchaseData();
                    setError(
                        "You do not have permission to view purchases."
                    );
                    return;
                }

                // Close the form if its required permission has been revoked.
                if (showForm) {
                    const formPermissionAllowed = editingPurchaseId
                        ? updatedPermissions.can_update
                        : updatedPermissions.can_create;

                    if (!formPermissionAllowed) {
                        setShowForm(false);
                        setEditingPurchaseId(null);
                        setForm(emptyForm());
                        setItems([emptyItem()]);
                        setError(
                            "Your permission to modify this purchase has been removed."
                        );
                    }
                }

                // Load directly using the freshly checked permission.
                await loadPurchaseData();
            } catch (err) {
                if (cancelled) return;

                setPermissions(DEFAULT_PERMISSIONS);
                clearPurchaseData();
                setError(
                    err.message ||
                    "Unable to refresh purchase permissions."
                );
            } finally {
                updating = false;
            }
        }

        window.addEventListener(
            "erp-permissions-updated",
            handlePermissionUpdate
        );

        window.addEventListener("focus", handlePermissionUpdate);

        return () => {
            cancelled = true;

            window.removeEventListener(
                "erp-permissions-updated",
                handlePermissionUpdate
            );

            window.removeEventListener("focus", handlePermissionUpdate);
        };
    }, [
        fetchPurchasePermissions,
        loadPurchaseData,
        clearPurchaseData,
        showForm,
        editingPurchaseId,
    ]);

    /* =====================================================
       FORM ACTIONS
    ===================================================== */

    function openAddForm() {
        if (!canView || !canCreate) {
            setError("You do not have permission to create purchases.");
            return;
        }

        setForm(emptyForm());
        setItems([emptyItem()]);
        setEditingPurchaseId(null);
        setSelectedPurchase(null);
        setError("");
        setMessage("");
        setShowForm(true);

        window.scrollTo({ top: 0, behavior: "smooth" });
    }

    function closeForm() {
        setShowForm(false);
        setForm(emptyForm());
        setItems([emptyItem()]);
        setEditingPurchaseId(null);
        setError("");
    }

    function updateForm(name, value) {
        setForm((previous) => ({
            ...previous,
            [name]: value,
        }));
    }

    function updateItem(index, name, value) {
        const itemPermissionAllowed = editingPurchaseId
            ? canUpdate
            : canCreate;

        if (!itemPermissionAllowed) {
            setError("You do not have permission to modify purchase items.");
            return;
        }

        setItems((previous) => {
            const updated = previous.map((item) => ({ ...item }));
            updated[index][name] = value;

            if (name === "productId" && value) {
                const product = products.find(
                    (p) => Number(p.product_id) === Number(value)
                );

                if (product) {
                    updated[index].unitCost = product.cost_price ?? 0;
                }
            }

            return updated;
        });
    }

    function addItem() {
        const allowed = editingPurchaseId ? canUpdate : canCreate;

        if (!allowed) {
            setError("You do not have permission to modify purchase items.");
            return;
        }

        setItems((previous) => [...previous, emptyItem()]);
    }

    function removeItem(index) {
        const allowed = editingPurchaseId ? canUpdate : canCreate;

        if (!allowed) {
            setError("You do not have permission to modify purchase items.");
            return;
        }

        setItems((previous) =>
            previous.length === 1
                ? previous
                : previous.filter((_, itemIndex) => itemIndex !== index)
        );
    }

    function calculateLine(item) {
        return (
            (Number(item.quantity) || 0) *
            (Number(item.unitCost) || 0) -
            (Number(item.discount) || 0) +
            (Number(item.tax) || 0)
        );
    }

    const subtotal = useMemo(
        () => items.reduce((sum, item) => sum + calculateLine(item), 0),
        [items]
    );

    const total = useMemo(
        () =>
            subtotal -
            (Number(form.discount) || 0) +
            (Number(form.tax) || 0),
        [subtotal, form.discount, form.tax]
    );

    /* =====================================================
       SAVE PURCHASE
    ===================================================== */

    async function savePurchase(event) {
        event.preventDefault();

        const wasEditing = Boolean(editingPurchaseId);

        if (wasEditing && !canUpdate) {
            setError("You do not have permission to edit purchases.");
            return;
        }

        if (!wasEditing && !canCreate) {
            setError("You do not have permission to create purchases.");
            return;
        }

        setSaving(true);
        setError("");
        setMessage("");

        try {
            if (!form.supplierId || !form.warehouseId) {
                throw new Error("Select a supplier and warehouse.");
            }

            if (!form.purchaseDate) {
                throw new Error("Select a purchase date.");
            }

            const validItems = items.filter(
                (item) =>
                    item.productId &&
                    Number(item.quantity) > 0 &&
                    Number(item.unitCost) >= 0
            );

            if (validItems.length === 0) {
                throw new Error("Add at least one valid product.");
            }

            const requestBody = {
                ...form,
                supplierId: Number(form.supplierId),
                warehouseId: Number(form.warehouseId),
                discount: Number(form.discount) || 0,
                tax: Number(form.tax) || 0,
                items: validItems.map((item) => ({
                    productId: Number(item.productId),
                    quantity: Number(item.quantity),
                    unitCost: Number(item.unitCost) || 0,
                    discount: Number(item.discount) || 0,
                    tax: Number(item.tax) || 0,
                })),
            };

            const response = await fetch("/api/purchases", {
                method: wasEditing ? "PUT" : "POST",
                headers: { "Content-Type": "application/json" },
                credentials: "same-origin",
                body: JSON.stringify(
                    wasEditing
                        ? {
                            ...requestBody,
                            purchaseId: editingPurchaseId,
                        }
                        : requestBody
                ),
            });

            const data = await response.json().catch(() => ({}));

            if (!response.ok) {
                throw new Error(data.message || "Failed to save purchase.");
            }

            await loadPurchases();

            setForm(emptyForm());
            setItems([emptyItem()]);
            setEditingPurchaseId(null);
            setShowForm(false);
            setSelectedPurchase(null);

            setMessage(
                wasEditing
                    ? "Purchase updated successfully."
                    : "Purchase created successfully. Warehouse stock has been increased."
            );
        } catch (err) {
            setError(err.message || "Failed to save purchase.");
        } finally {
            setSaving(false);
        }
    }

    /* =====================================================
       VIEW PURCHASE
    ===================================================== */

    async function fetchPurchaseDetails(purchase) {
        if (!canView) {
            throw new Error("You do not have permission to view purchases.");
        }

        const response = await fetch(
            `/api/purchases?id=${purchase.purchase_id}`,
            {
                cache: "no-store",
                credentials: "same-origin",
            }
        );

        const data = await response.json().catch(() => ({}));

        if (!response.ok) {
            throw new Error(data.message || "Failed to load purchase.");
        }

        return data.purchase;
    }

    async function viewPurchase(purchase) {
        if (!canView) {
            setError("You do not have permission to view purchases.");
            return;
        }

        try {
            setError("");
            setViewLoadingId(purchase.purchase_id);

            const completePurchase = await fetchPurchaseDetails(purchase);

            setSelectedPurchase(completePurchase);
        } catch (err) {
            setError(err.message || "Failed to load purchase.");
        } finally {
            setViewLoadingId(null);
        }
    }

    /* =====================================================
       EDIT PURCHASE
    ===================================================== */

    async function editPurchase(purchase) {
        if (!canUpdate) {
            setError("You do not have permission to edit purchases.");
            return;
        }

        try {
            setError("");
            setMessage("");

            const completePurchase = await fetchPurchaseDetails(purchase);

            setEditingPurchaseId(completePurchase.purchase_id);

            setForm({
                purchaseNumber: completePurchase.purchase_number || "",
                supplierId: completePurchase.supplier_id
                    ? String(completePurchase.supplier_id)
                    : "",
                warehouseId: completePurchase.warehouse_id
                    ? String(completePurchase.warehouse_id)
                    : "",
                purchaseDate:
                    formatDate(completePurchase.purchase_date) === "-"
                        ? today()
                        : formatDate(completePurchase.purchase_date),
                discount: completePurchase.discount ?? "",
                tax: completePurchase.tax ?? "",
                notes: completePurchase.notes || "",
            });

            if (
                Array.isArray(completePurchase.items) &&
                completePurchase.items.length > 0
            ) {
                setItems(
                    completePurchase.items.map((item) => ({
                        productId: String(item.product_id),
                        quantity: Number(item.quantity) || 0,
                        unitCost: Number(item.unit_cost) || 0,
                        discount: Number(item.discount) || 0,
                        tax: Number(item.tax) || 0,
                    }))
                );
            } else {
                setItems([emptyItem()]);
            }

            setSelectedPurchase(null);
            setShowForm(true);

            window.scrollTo({ top: 0, behavior: "smooth" });
        } catch (err) {
            setError(err.message || "Failed to load purchase for editing.");
        }
    }

    function cancelEdit() {
        closeForm();
        setMessage("");
    }

    /* =====================================================
       PRINT AND PDF
    ===================================================== */

    function printPurchase() {
        if (!canView || !selectedPurchase) return;
        window.print();
    }

    function downloadPurchasePDF() {
        if (!canView || !selectedPurchase) return;

        const purchase = selectedPurchase;
        const doc = new jsPDF();

        doc.setFillColor(6, 78, 59);
        doc.rect(0, 0, 210, 30, "F");

        doc.setTextColor(255, 255, 255);
        doc.setFontSize(19);
        doc.text("Purchase Report", 14, 19);

        doc.setTextColor(30, 41, 59);
        doc.setFontSize(10);

        doc.text(
            `Purchase Number: ${purchase.purchase_number || purchase.purchase_id || "-"}`,
            14,
            41
        );

        doc.text(
            `Purchase Date: ${formatDate(purchase.purchase_date)}`,
            14,
            48
        );

        doc.text(
            `Supplier: ${purchase.supplier_code || ""} - ${purchase.supplier_name || "-"}`,
            14,
            55
        );

        doc.text(
            `Warehouse: ${purchase.warehouse_code || ""} - ${purchase.warehouse_name || "-"}`,
            14,
            62
        );

        doc.text(`Status: ${purchase.status || "-"}`, 14, 69);

        autoTable(doc, {
            startY: 77,
            head: [["Product", "Qty", "Unit Cost", "Discount", "Tax", "Total"]],
            body: (purchase.items || []).map((item) => [
                `${item.sku || ""} - ${item.product_name || ""}`,
                Number(item.quantity || 0).toFixed(2),
                Number(item.unit_cost || 0).toFixed(2),
                Number(item.discount || 0).toFixed(2),
                Number(item.tax || 0).toFixed(2),
                Number(item.line_total || 0).toFixed(2),
            ]),
            headStyles: { fillColor: [6, 78, 59] },
            styles: { fontSize: 8, cellPadding: 3 },
            alternateRowStyles: { fillColor: [240, 249, 255] },
        });

        const summaryStart = (doc.lastAutoTable?.finalY || 80) + 10;

        autoTable(doc, {
            startY: summaryStart,
            head: [["Description", "Amount"]],
            body: [
                ["Subtotal", Number(purchase.subtotal || 0).toFixed(2)],
                ["Discount", Number(purchase.discount || 0).toFixed(2)],
                ["Tax", Number(purchase.tax || 0).toFixed(2)],
                ["Total", Number(purchase.total_amount || 0).toFixed(2)],
                ["Paid", Number(purchase.paid_amount || 0).toFixed(2)],
                ["Balance", Number(purchase.balance_amount || 0).toFixed(2)],
            ],
            headStyles: { fillColor: [14, 116, 144] },
            styles: { fontSize: 9, cellPadding: 3 },
        });

        const notesY = (doc.lastAutoTable?.finalY || summaryStart + 40) + 10;

        if (notesY > 270) doc.addPage();

        doc.setTextColor(51, 65, 85);

        const finalNotesY = notesY > 270 ? 20 : notesY;

        const notes = doc.splitTextToSize(
            `Notes: ${purchase.notes || "-"}`,
            180
        );

        doc.text(notes, 14, finalNotesY);

        doc.save(
            `Purchase-${purchase.purchase_number || purchase.purchase_id}.pdf`
        );
    }

    /* =====================================================
       FILTERED PURCHASES
    ===================================================== */

    const filteredPurchases = useMemo(() => {
        const query = search.trim().toLowerCase();

        return purchases.filter((purchase) => {
            const matchesSearch =
                !query ||
                [
                    purchase.purchase_number,
                    purchase.supplier_name,
                    purchase.supplier_code,
                    purchase.warehouse_name,
                    purchase.status,
                ]
                    .filter(Boolean)
                    .join(" ")
                    .toLowerCase()
                    .includes(query);

            const normalizedStatus = String(
                purchase.status || ""
            ).toLowerCase();

            const matchesStatus =
                statusFilter === "all" ||
                (statusFilter === "paid" &&
                    normalizedStatus.includes("paid") &&
                    !normalizedStatus.includes("unpaid") &&
                    !normalizedStatus.includes("partial")) ||
                (statusFilter === "partial" &&
                    normalizedStatus.includes("partial")) ||
                (statusFilter === "unpaid" &&
                    (normalizedStatus.includes("unpaid") ||
                        normalizedStatus.includes("pending") ||
                        normalizedStatus.includes("due")));

            return matchesSearch && matchesStatus;
        });
    }, [purchases, search, statusFilter]);

    const summary = useMemo(
        () =>
            filteredPurchases.reduce(
                (result, purchase) => {
                    result.count += 1;
                    result.total += getPurchaseTotal(purchase);
                    result.paid += getPurchasePaid(purchase);
                    result.balance += getPurchaseBalance(purchase);
                    return result;
                },
                { count: 0, total: 0, paid: 0, balance: 0 }
            ),
        [filteredPurchases]
    );

    const activeSuppliers = useMemo(
        () => suppliers.filter((supplier) => toBoolean(supplier.is_active)),
        [suppliers]
    );

    const activeWarehouses = useMemo(
        () => warehouses.filter((warehouse) => toBoolean(warehouse.is_active)),
        [warehouses]
    );

    const activeProducts = useMemo(
        () => products.filter((product) => toBoolean(product.is_active)),
        [products]
    );

    const canModifyCurrentForm = editingPurchaseId
        ? canUpdate
        : canCreate;

    /* =====================================================
       LOADING SCREEN
    ===================================================== */

    if (permissionLoading || loading) {
        return (
            <div className="min-h-[70vh] bg-slate-50 p-5 dark:bg-slate-950 sm:p-8">
                <div className="mx-auto max-w-[1600px] space-y-6">
                    <div className="h-40 animate-pulse rounded-3xl bg-slate-200 dark:bg-slate-800" />

                    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                        {[1, 2, 3, 4].map((item) => (
                            <div
                                key={item}
                                className="h-32 animate-pulse rounded-2xl bg-slate-200 dark:bg-slate-800"
                            />
                        ))}
                    </div>

                    <div className="h-80 animate-pulse rounded-2xl bg-slate-200 dark:bg-slate-800" />

                    <p className="text-center text-sm text-slate-500 dark:text-slate-400">
                        Checking permissions and loading purchase management...
                    </p>
                </div>
            </div>
        );
    }

    /* =====================================================
       ACCESS DENIED
    ===================================================== */

    if (!canView) {
        return (
            <div className="flex min-h-[75vh] items-center justify-center bg-slate-50 p-5 dark:bg-slate-950">
                <div className="w-full max-w-lg rounded-3xl border border-rose-200 bg-white p-8 text-center shadow-xl dark:border-rose-900 dark:bg-slate-900 sm:p-10">
                    <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-2xl bg-rose-100 text-rose-600 dark:bg-rose-950 dark:text-rose-300">
                        <Icon name="lock" size={36} />
                    </div>

                    <h1 className="mt-6 text-2xl font-bold text-slate-900 dark:text-white">
                        Access Denied
                    </h1>

                    <p className="mt-3 text-sm leading-7 text-slate-600 dark:text-slate-400">
                        You do not have permission to view the Purchase
                        Management page. Please contact your administrator
                        to request access.
                    </p>

                    {error && (
                        <p className="mt-3 rounded-xl bg-rose-50 p-3 text-xs text-rose-700 dark:bg-rose-950/40 dark:text-rose-300">
                            {error}
                        </p>
                    )}

                    <div className="mt-6 rounded-xl border border-slate-200 bg-slate-50 p-4 text-left dark:border-slate-700 dark:bg-slate-950">
                        <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                            Required permission
                        </p>

                        <p className="mt-2 font-bold text-slate-800 dark:text-slate-200">
                            Purchase — View
                        </p>
                    </div>
                </div>
            </div>
        );
    }

    /* =====================================================
       MAIN UI
    ===================================================== */

    return (
        <div className="min-h-screen bg-slate-50 p-4 text-slate-800 dark:bg-slate-950 dark:text-slate-100 sm:p-6 lg:p-8">
            <div className="mx-auto max-w-[1600px] space-y-6">

                {/* HEADER */}

                <section className="relative isolate overflow-hidden rounded-3xl bg-gradient-to-br from-emerald-950 via-emerald-800 to-sky-800 p-6 text-white shadow-xl shadow-emerald-950/10 sm:p-8">
                    <div className="pointer-events-none absolute -right-12 -top-24 h-72 w-72 rounded-full border-[36px] border-white/5" />
                    <div className="pointer-events-none absolute -bottom-36 right-1/4 h-64 w-64 rounded-full bg-sky-400/10 blur-3xl" />

                    <div className="relative flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
                        <div className="max-w-2xl">
                            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.16em] text-emerald-100">
                                <Icon name="chart" size={15} />
                                Procurement analytics
                            </div>

                            <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
                                Purchase Management
                            </h1>

                            <p className="mt-3 max-w-xl text-sm leading-6 text-emerald-50/85 sm:text-base">
                                Review purchase transactions, monitor supplier
                                balances, manage stock receipts, and generate
                                detailed purchase reports.
                            </p>
                        </div>

                        <div className="flex flex-wrap items-center gap-3">
                            <button
                                type="button"
                                onClick={() => refreshAll(true)}
                                disabled={refreshing}
                                className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/20 bg-white/10 px-4 py-3 text-sm font-semibold text-white transition hover:bg-white/20 disabled:opacity-50"
                            >
                                <Icon
                                    name="refresh"
                                    size={18}
                                    className={refreshing ? "animate-spin" : ""}
                                />
                                {refreshing ? "Refreshing..." : "Refresh"}
                            </button>

                            {!showForm && canCreate && (
                                <button
                                    type="button"
                                    onClick={openAddForm}
                                    className="inline-flex items-center justify-center gap-2 rounded-xl bg-white px-5 py-3 text-sm font-bold text-emerald-900 shadow-lg transition hover:-translate-y-0.5 hover:bg-sky-50"
                                >
                                    <Icon name="plus" size={19} />
                                    Add Purchase
                                </button>
                            )}
                        </div>
                    </div>

                    <div className="relative mt-7 grid grid-cols-2 gap-3 border-t border-white/15 pt-5 sm:grid-cols-4">
                        <div>
                            <p className="text-xs font-medium text-emerald-100/75">
                                Total records
                            </p>
                            <p className="mt-1 text-2xl font-bold">
                                {purchases.length}
                            </p>
                        </div>

                        <div>
                            <p className="text-xs font-medium text-emerald-100/75">
                                Active suppliers
                            </p>
                            <p className="mt-1 text-2xl font-bold">
                                {activeSuppliers.length}
                            </p>
                        </div>

                        <div>
                            <p className="text-xs font-medium text-emerald-100/75">
                                Warehouses
                            </p>
                            <p className="mt-1 text-2xl font-bold">
                                {activeWarehouses.length}
                            </p>
                        </div>

                        <div>
                            <p className="text-xs font-medium text-emerald-100/75">
                                Products available
                            </p>
                            <p className="mt-1 text-2xl font-bold">
                                {activeProducts.length}
                            </p>
                        </div>
                    </div>
                </section>

                {/* FEEDBACK */}

                {message && (
                    <div
                        role="status"
                        className="flex items-start gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3.5 text-sm text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200"
                    >
                        <Icon name="check" size={19} className="mt-0.5 shrink-0" />
                        <span className="flex-1">{message}</span>

                        <button
                            type="button"
                            onClick={() => setMessage("")}
                            aria-label="Dismiss success message"
                            className="rounded-lg p-1 hover:bg-emerald-100 dark:hover:bg-emerald-900"
                        >
                            <Icon name="close" size={16} />
                        </button>
                    </div>
                )}

                {error && !showForm && (
                    <div
                        role="alert"
                        className="flex items-start gap-3 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3.5 text-sm text-rose-800 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-200"
                    >
                        <Icon name="alert" size={19} className="mt-0.5 shrink-0" />
                        <span className="flex-1">{error}</span>

                        <button
                            type="button"
                            onClick={() => setError("")}
                            aria-label="Dismiss error message"
                            className="rounded-lg p-1 hover:bg-rose-100 dark:hover:bg-rose-900"
                        >
                            <Icon name="close" size={16} />
                        </button>
                    </div>
                )}

                {/* KPI CARDS */}

                {!showForm && (
                    <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
                        <SummaryCard
                            title="Purchase value"
                            value={formatAmount(summary.total)}
                            description="Total value of filtered purchases"
                            icon="shopping"
                            tone="green"
                        />

                        <SummaryCard
                            title="Amount paid"
                            value={formatAmount(summary.paid)}
                            description="Payments recorded against purchases"
                            icon="check"
                            tone="blue"
                        />

                        <SummaryCard
                            title="Outstanding balance"
                            value={formatAmount(summary.balance)}
                            description="Remaining amount payable"
                            icon="money"
                            tone="amber"
                        />

                        <SummaryCard
                            title="Matching purchases"
                            value={summary.count.toLocaleString("en-PK")}
                            description="Transactions matching your filters"
                            icon="file"
                            tone="cyan"
                        />
                    </section>
                )}

                {/* PURCHASE FORM */}

                {showForm ? (
                    <form onSubmit={savePurchase} className="space-y-6">
                        <section className={`${panelClass} overflow-hidden`}>
                            <div className="flex flex-col gap-4 border-b border-slate-200 bg-gradient-to-r from-emerald-50 to-sky-50 p-5 dark:border-slate-800 dark:from-emerald-950/30 dark:to-sky-950/30 sm:flex-row sm:items-center sm:justify-between sm:p-6">
                                <div className="flex items-center gap-3">
                                    <div className="rounded-2xl bg-emerald-100 p-3 text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-200">
                                        <Icon name="shopping" size={23} />
                                    </div>

                                    <div>
                                        <h2 className="text-xl font-bold text-slate-900 dark:text-white">
                                            {editingPurchaseId
                                                ? "Edit purchase"
                                                : "Create purchase"}
                                        </h2>

                                        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                                            Complete the purchase details and add
                                            the items received.
                                        </p>
                                    </div>
                                </div>

                                <button
                                    type="button"
                                    onClick={cancelEdit}
                                    disabled={saving}
                                    className={buttonSecondary}
                                >
                                    <Icon name="close" size={17} />
                                    Cancel
                                </button>
                            </div>

                            {error && (
                                <div
                                    role="alert"
                                    className="mx-5 mt-5 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-200 sm:mx-6"
                                >
                                    {error}
                                </div>
                            )}

                            <div className="p-5 sm:p-6">
                                <div className="mb-5 flex items-center gap-2">
                                    <span className="h-6 w-1 rounded-full bg-emerald-600" />
                                    <h3 className="font-bold text-slate-900 dark:text-white">
                                        Purchase information
                                    </h3>
                                </div>

                                <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-4">
                                    <div>
                                        <label className={labelClass}>
                                            Purchase number
                                        </label>

                                        <input
                                            value={form.purchaseNumber}
                                            onChange={(e) =>
                                                updateForm("purchaseNumber", e.target.value)
                                            }
                                            placeholder="Auto-generated or enter number"
                                            className={inputClass}
                                        />
                                    </div>

                                    <div>
                                        <label className={labelClass}>
                                            Purchase date{" "}
                                            <span className="text-rose-500">*</span>
                                        </label>

                                        <input
                                            type="date"
                                            value={form.purchaseDate}
                                            onChange={(e) =>
                                                updateForm("purchaseDate", e.target.value)
                                            }
                                            className={inputClass}
                                            required
                                        />
                                    </div>

                                    <div>
                                        <label className={labelClass}>
                                            Supplier{" "}
                                            <span className="text-rose-500">*</span>
                                        </label>

                                        <select
                                            value={form.supplierId}
                                            onChange={(e) =>
                                                updateForm("supplierId", e.target.value)
                                            }
                                            className={inputClass}
                                            required
                                        >
                                            <option value="">Select supplier</option>

                                            {activeSuppliers.map((supplier) => (
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
                                            Warehouse{" "}
                                            <span className="text-rose-500">*</span>
                                        </label>

                                        <select
                                            value={form.warehouseId}
                                            onChange={(e) =>
                                                updateForm("warehouseId", e.target.value)
                                            }
                                            className={inputClass}
                                            required
                                        >
                                            <option value="">Select warehouse</option>

                                            {activeWarehouses.map((warehouse) => (
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
                            </div>
                        </section>

                        {/* PURCHASE ITEMS */}

                        <section className={`${panelClass} overflow-hidden`}>
                            <div className="flex flex-col gap-4 border-b border-slate-200 p-5 dark:border-slate-800 sm:flex-row sm:items-center sm:justify-between sm:p-6">
                                <div className="flex items-center gap-3">
                                    <div className="rounded-xl bg-sky-100 p-3 text-sky-700 dark:bg-sky-950 dark:text-sky-300">
                                        <Icon name="package" size={22} />
                                    </div>

                                    <div>
                                        <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                                            Purchase items
                                        </h3>

                                        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                                            {items.length} item line
                                            {items.length === 1 ? "" : "s"}
                                        </p>
                                    </div>
                                </div>

                                {canModifyCurrentForm && (
                                    <button
                                        type="button"
                                        onClick={addItem}
                                        className={buttonPrimary}
                                    >
                                        <Icon name="plus" size={18} />
                                        Add product
                                    </button>
                                )}
                            </div>

                            <div className="overflow-x-auto">
                                <table className="w-full min-w-[1000px] text-left text-sm">
                                    <thead className="bg-slate-50 text-xs uppercase tracking-wider text-slate-500 dark:bg-slate-900 dark:text-slate-400">
                                        <tr>
                                            <th className="px-4 py-4 font-semibold">Product</th>
                                            <th className="px-4 py-4 font-semibold">Quantity</th>
                                            <th className="px-4 py-4 font-semibold">Unit cost</th>
                                            <th className="px-4 py-4 font-semibold">Discount</th>
                                            <th className="px-4 py-4 font-semibold">Tax</th>
                                            <th className="px-4 py-4 text-right font-semibold">Line total</th>

                                            {canModifyCurrentForm && (
                                                <th className="px-4 py-4 text-center font-semibold">
                                                    Action
                                                </th>
                                            )}
                                        </tr>
                                    </thead>

                                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                        {items.map((item, index) => (
                                            <tr
                                                key={index}
                                                className="align-top transition hover:bg-sky-50/50 dark:hover:bg-slate-900/60"
                                            >
                                                <td className="p-3">
                                                    <select
                                                        value={item.productId}
                                                        onChange={(e) =>
                                                            updateItem(index, "productId", e.target.value)
                                                        }
                                                        className={`${inputClass} min-w-56`}
                                                        required
                                                        disabled={!canModifyCurrentForm}
                                                    >
                                                        <option value="">Select product</option>

                                                        {activeProducts.map((product) => (
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

                                                <td className="p-3">
                                                    <input
                                                        type="number"
                                                        min="0.001"
                                                        step="0.001"
                                                        value={item.quantity}
                                                        onChange={(e) =>
                                                            updateItem(index, "quantity", e.target.value)
                                                        }
                                                        className={`${inputClass} min-w-24`}
                                                        required
                                                        disabled={!canModifyCurrentForm}
                                                    />
                                                </td>

                                                <td className="p-3">
                                                    <input
                                                        type="number"
                                                        min="0"
                                                        step="0.01"
                                                        value={item.unitCost}
                                                        onChange={(e) =>
                                                            updateItem(index, "unitCost", e.target.value)
                                                        }
                                                        className={`${inputClass} min-w-28`}
                                                        required
                                                        disabled={!canModifyCurrentForm}
                                                    />
                                                </td>

                                                <td className="p-3">
                                                    <input
                                                        type="number"
                                                        min="0"
                                                        step="0.01"
                                                        value={item.discount}
                                                        onChange={(e) =>
                                                            updateItem(index, "discount", e.target.value)
                                                        }
                                                        className={`${inputClass} min-w-24`}
                                                        disabled={!canModifyCurrentForm}
                                                    />
                                                </td>

                                                <td className="p-3">
                                                    <input
                                                        type="number"
                                                        min="0"
                                                        step="0.01"
                                                        value={item.tax}
                                                        onChange={(e) =>
                                                            updateItem(index, "tax", e.target.value)
                                                        }
                                                        className={`${inputClass} min-w-24`}
                                                        disabled={!canModifyCurrentForm}
                                                    />
                                                </td>

                                                <td className="whitespace-nowrap p-4 text-right font-bold tabular-nums text-emerald-700 dark:text-emerald-300">
                                                    {formatAmount(calculateLine(item))}
                                                </td>

                                                {canModifyCurrentForm && (
                                                    <td className="p-3 text-center">
                                                        <button
                                                            type="button"
                                                            onClick={() => removeItem(index)}
                                                            disabled={items.length === 1}
                                                            aria-label={`Remove item ${index + 1}`}
                                                            className="inline-flex items-center justify-center rounded-xl border border-rose-200 bg-rose-50 p-2.5 text-rose-600 transition hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-40 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-300 dark:hover:bg-rose-950"
                                                        >
                                                            <Icon name="close" size={17} />
                                                        </button>
                                                    </td>
                                                )}
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>

                            {/* TOTALS */}

                            <div className="border-t border-slate-200 bg-slate-50/70 p-4 dark:border-slate-800 dark:bg-slate-900/40 sm:p-6">
                                <div className="ml-auto max-w-md space-y-3">
                                    <div className="flex items-center justify-between gap-4 text-sm">
                                        <span className="text-slate-500 dark:text-slate-400">
                                            Items subtotal
                                        </span>

                                        <span className="font-semibold text-slate-800 dark:text-slate-200">
                                            {formatAmount(subtotal)}
                                        </span>
                                    </div>

                                    <div className="flex items-center justify-between gap-4">
                                        <label
                                            htmlFor="purchaseDiscount"
                                            className="text-sm text-slate-600 dark:text-slate-300"
                                        >
                                            Overall discount
                                        </label>

                                        <input
                                            id="purchaseDiscount"
                                            type="number"
                                            min="0"
                                            step="0.01"
                                            value={form.discount}
                                            onChange={(e) =>
                                                updateForm("discount", e.target.value)
                                            }
                                            className={`${inputClass} max-w-40`}
                                            disabled={!canModifyCurrentForm}
                                        />
                                    </div>

                                    <div className="flex items-center justify-between gap-4">
                                        <label
                                            htmlFor="purchaseTax"
                                            className="text-sm text-slate-600 dark:text-slate-300"
                                        >
                                            Overall tax
                                        </label>

                                        <input
                                            id="purchaseTax"
                                            type="number"
                                            min="0"
                                            step="0.01"
                                            value={form.tax}
                                            onChange={(e) =>
                                                updateForm("tax", e.target.value)
                                            }
                                            className={`${inputClass} max-w-40`}
                                            disabled={!canModifyCurrentForm}
                                        />
                                    </div>

                                    <div className="flex items-center justify-between gap-4 border-t border-slate-200 pt-4 dark:border-slate-700">
                                        <span className="text-base font-bold text-slate-900 dark:text-white">
                                            Purchase total
                                        </span>

                                        <span className="text-2xl font-extrabold tabular-nums text-emerald-700 dark:text-emerald-300">
                                            {formatAmount(total)}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </section>

                        {/* NOTES AND SAVE */}

                        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                            <section className={`${panelClass} p-5 sm:p-6`}>
                                <div className="mb-4 flex items-center gap-3">
                                    <div className="rounded-xl bg-sky-100 p-2.5 text-sky-700 dark:bg-sky-950 dark:text-sky-300">
                                        <Icon name="file" size={20} />
                                    </div>

                                    <div>
                                        <h3 className="font-bold text-slate-900 dark:text-white">
                                            Purchase notes
                                        </h3>

                                        <p className="text-xs text-slate-500 dark:text-slate-400">
                                            Optional information about this purchase
                                        </p>
                                    </div>
                                </div>

                                <textarea
                                    value={form.notes}
                                    onChange={(e) =>
                                        updateForm("notes", e.target.value)
                                    }
                                    rows={5}
                                    className={inputClass}
                                    placeholder="Enter supplier reference, delivery details, or other notes..."
                                    disabled={!canModifyCurrentForm}
                                />
                            </section>

                            <section className={`${panelClass} flex flex-col justify-between p-5 sm:p-6`}>
                                <div>
                                    <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                                        Ready to save?
                                    </h3>

                                    <p className="mt-2 text-sm leading-6 text-slate-500 dark:text-slate-400">
                                        Review the supplier, warehouse, items, and
                                        amounts before saving this purchase.
                                    </p>

                                    <div className="mt-5 rounded-xl border border-emerald-200 bg-emerald-50 p-4 dark:border-emerald-900 dark:bg-emerald-950/30">
                                        <div className="flex items-center justify-between gap-4">
                                            <span className="text-sm font-medium text-emerald-800 dark:text-emerald-200">
                                                Final total
                                            </span>

                                            <span className="text-xl font-extrabold text-emerald-800 dark:text-emerald-200">
                                                {formatAmount(total)}
                                            </span>
                                        </div>
                                    </div>
                                </div>

                                <div className="mt-6 flex flex-col gap-3 sm:flex-row">
                                    <button
                                        type="submit"
                                        disabled={saving || !canModifyCurrentForm}
                                        className={`${buttonPrimary} flex-1`}
                                    >
                                        {saving ? (
                                            <>
                                                <Icon
                                                    name="refresh"
                                                    size={18}
                                                    className="animate-spin"
                                                />
                                                Saving purchase...
                                            </>
                                        ) : (
                                            <>
                                                <Icon name="check" size={18} />
                                                {editingPurchaseId
                                                    ? "Update purchase"
                                                    : "Save purchase"}
                                            </>
                                        )}
                                    </button>

                                    <button
                                        type="button"
                                        onClick={cancelEdit}
                                        disabled={saving}
                                        className={buttonSecondary}
                                    >
                                        Cancel
                                    </button>
                                </div>
                            </section>
                        </div>
                    </form>
                ) : (
                    <>
                        {/* PURCHASE HISTORY */}

                        <section className={`${panelClass} overflow-hidden`}>
                            <div className="border-b border-slate-200 p-5 dark:border-slate-800 sm:p-6">
                                <div className="flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
                                    <div>
                                        <div className="flex items-center gap-3">
                                            <div className="rounded-xl bg-emerald-100 p-3 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                                                <Icon name="chart" size={22} />
                                            </div>

                                            <div>
                                                <h2 className="text-xl font-bold text-slate-900 dark:text-white">
                                                    Purchase history
                                                </h2>

                                                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                                                    Search, review, and manage your purchase transactions.
                                                </p>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-[minmax(220px,1fr)_180px] xl:w-[520px]">
                                        <div className="relative">
                                            <Icon
                                                name="search"
                                                size={18}
                                                className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
                                            />

                                            <input
                                                type="search"
                                                value={search}
                                                onChange={(e) =>
                                                    setSearch(e.target.value)
                                                }
                                                placeholder="Search purchases..."
                                                aria-label="Search purchase history"
                                                className={`${inputClass} pl-10`}
                                            />
                                        </div>

                                        <div className="relative">
                                            <Icon
                                                name="filter"
                                                size={18}
                                                className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
                                            />

                                            <select
                                                value={statusFilter}
                                                onChange={(e) =>
                                                    setStatusFilter(e.target.value)
                                                }
                                                aria-label="Filter purchases by status"
                                                className={`${inputClass} pl-10`}
                                            >
                                                <option value="all">All statuses</option>
                                                <option value="paid">Paid</option>
                                                <option value="partial">Partially paid</option>
                                                <option value="unpaid">Unpaid / pending</option>
                                            </select>
                                        </div>
                                    </div>
                                </div>

                                <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
                                    <p className="text-sm text-slate-500 dark:text-slate-400">
                                        Showing{" "}
                                        <span className="font-bold text-slate-800 dark:text-slate-200">
                                            {filteredPurchases.length}
                                        </span>{" "}
                                        of{" "}
                                        <span className="font-bold text-slate-800 dark:text-slate-200">
                                            {purchases.length}
                                        </span>{" "}
                                        purchases
                                    </p>

                                    {(search || statusFilter !== "all") && (
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setSearch("");
                                                setStatusFilter("all");
                                            }}
                                            className="inline-flex items-center gap-1.5 text-sm font-semibold text-sky-700 hover:text-sky-800 dark:text-sky-300 dark:hover:text-sky-200"
                                        >
                                            <Icon name="closeCircle" size={16} />
                                            Clear filters
                                        </button>
                                    )}
                                </div>
                            </div>

                            {/* PURCHASE TABLE */}

                            <div className="overflow-x-auto">
                                <table className="w-full min-w-[1050px] text-left text-sm">
                                    <thead className="bg-slate-50 text-xs uppercase tracking-wider text-slate-500 dark:bg-slate-900 dark:text-slate-400">
                                        <tr>
                                            <th className="px-5 py-4 font-semibold">Purchase</th>
                                            <th className="px-5 py-4 font-semibold">Supplier</th>
                                            <th className="px-5 py-4 font-semibold">Warehouse</th>
                                            <th className="px-5 py-4 font-semibold">Date</th>
                                            <th className="px-5 py-4 text-right font-semibold">Total</th>
                                            <th className="px-5 py-4 text-right font-semibold">Paid</th>
                                            <th className="px-5 py-4 text-right font-semibold">Balance</th>
                                            <th className="px-5 py-4 text-center font-semibold">Status</th>
                                            <th className="px-5 py-4 text-center font-semibold">Actions</th>
                                        </tr>
                                    </thead>

                                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                        {filteredPurchases.map((purchase) => (
                                            <tr
                                                key={purchase.purchase_id}
                                                className="transition hover:bg-sky-50/60 dark:hover:bg-slate-900/70"
                                            >
                                                <td className="px-5 py-4">
                                                    <button
                                                        type="button"
                                                        onClick={() =>
                                                            viewPurchase(purchase)
                                                        }
                                                        className="font-bold text-emerald-700 transition hover:text-sky-700 hover:underline dark:text-emerald-300 dark:hover:text-sky-300"
                                                    >
                                                        {purchase.purchase_number ||
                                                            `PUR-${purchase.purchase_id}`}
                                                    </button>

                                                    <p className="mt-1 text-xs text-slate-400">
                                                        ID: {purchase.purchase_id}
                                                    </p>
                                                </td>

                                                <td className="px-5 py-4">
                                                    <p className="font-semibold text-slate-800 dark:text-slate-200">
                                                        {purchase.supplier_name || "-"}
                                                    </p>

                                                    {purchase.supplier_code && (
                                                        <p className="mt-1 text-xs text-slate-400">
                                                            {purchase.supplier_code}
                                                        </p>
                                                    )}
                                                </td>

                                                <td className="px-5 py-4 text-slate-600 dark:text-slate-300">
                                                    {purchase.warehouse_name || "-"}
                                                </td>

                                                <td className="whitespace-nowrap px-5 py-4 text-slate-600 dark:text-slate-300">
                                                    <span className="inline-flex items-center gap-2">
                                                        <Icon
                                                            name="calendar"
                                                            size={15}
                                                            className="text-slate-400"
                                                        />
                                                        {formatDate(purchase.purchase_date)}
                                                    </span>
                                                </td>

                                                <td className="whitespace-nowrap px-5 py-4 text-right font-semibold tabular-nums text-slate-800 dark:text-slate-200">
                                                    {formatAmount(purchase.total_amount)}
                                                </td>

                                                <td className="whitespace-nowrap px-5 py-4 text-right tabular-nums text-emerald-700 dark:text-emerald-300">
                                                    {formatAmount(purchase.paid_amount)}
                                                </td>

                                                <td className="whitespace-nowrap px-5 py-4 text-right font-semibold tabular-nums text-slate-800 dark:text-slate-200">
                                                    {formatAmount(purchase.balance_amount)}
                                                </td>

                                                <td className="px-5 py-4 text-center">
                                                    <StatusBadge status={purchase.status} />
                                                </td>

                                                <td className="px-5 py-4">
                                                    <div className="flex items-center justify-center gap-2">
                                                        {canView && (
                                                            <button
                                                                type="button"
                                                                onClick={() =>
                                                                    viewPurchase(purchase)
                                                                }
                                                                disabled={
                                                                    viewLoadingId ===
                                                                    purchase.purchase_id
                                                                }
                                                                title="View purchase"
                                                                className="inline-flex items-center gap-1.5 rounded-lg border border-sky-200 bg-sky-50 px-3 py-2 text-xs font-bold text-sky-700 transition hover:bg-sky-100 disabled:opacity-50 dark:border-sky-900 dark:bg-sky-950/50 dark:text-sky-300 dark:hover:bg-sky-950"
                                                            >
                                                                <Icon
                                                                    name="eye"
                                                                    size={15}
                                                                    className={
                                                                        viewLoadingId ===
                                                                            purchase.purchase_id
                                                                            ? "animate-pulse"
                                                                            : ""
                                                                    }
                                                                />

                                                                {viewLoadingId ===
                                                                    purchase.purchase_id
                                                                    ? "Loading"
                                                                    : "View"}
                                                            </button>
                                                        )}

                                                        {canUpdate && (
                                                            <button
                                                                type="button"
                                                                onClick={() =>
                                                                    editPurchase(purchase)
                                                                }
                                                                title="Edit purchase"
                                                                className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-700 transition hover:bg-emerald-100 dark:border-emerald-900 dark:bg-emerald-950/50 dark:text-emerald-300 dark:hover:bg-emerald-950"
                                                            >
                                                                <Icon name="edit" size={15} />
                                                                Edit
                                                            </button>
                                                        )}
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}

                                        {filteredPurchases.length === 0 && (
                                            <tr>
                                                <td
                                                    colSpan={9}
                                                    className="px-6 py-16 text-center"
                                                >
                                                    <div className="mx-auto flex max-w-md flex-col items-center">
                                                        <div className="rounded-2xl bg-sky-50 p-4 text-sky-600 dark:bg-slate-900 dark:text-sky-300">
                                                            <Icon name="shopping" size={30} />
                                                        </div>

                                                        <h3 className="mt-4 text-base font-bold text-slate-800 dark:text-white">
                                                            {search || statusFilter !== "all"
                                                                ? "No matching purchases"
                                                                : "No purchase records yet"}
                                                        </h3>

                                                        <p className="mt-2 text-sm leading-6 text-slate-500 dark:text-slate-400">
                                                            {search || statusFilter !== "all"
                                                                ? "Try changing your search terms or status filter."
                                                                : "Create your first purchase to begin tracking supplier transactions and stock receipts."}
                                                        </p>

                                                        {!search &&
                                                            statusFilter === "all" &&
                                                            canCreate && (
                                                                <button
                                                                    type="button"
                                                                    onClick={openAddForm}
                                                                    className={`${buttonPrimary} mt-5`}
                                                                >
                                                                    <Icon name="plus" size={17} />
                                                                    Add first purchase
                                                                </button>
                                                            )}
                                                    </div>
                                                </td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>

                            <div className="flex flex-col gap-2 border-t border-slate-200 bg-slate-50/70 px-5 py-4 text-xs text-slate-500 dark:border-slate-800 dark:bg-slate-900/40 dark:text-slate-400 sm:flex-row sm:items-center sm:justify-between">
                                <span>
                                    Purchase records are loaded from your ERP database.
                                </span>

                                <span className="font-medium">
                                    {filteredPurchases.length} record
                                    {filteredPurchases.length === 1 ? "" : "s"} displayed
                                </span>
                            </div>
                        </section>
                    </>
                )}

                {/* PURCHASE DETAILS MODAL */}

                {selectedPurchase && canView && (
                    <div
                        className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-3 backdrop-blur-sm sm:p-6"
                        onMouseDown={(event) => {
                            if (event.target === event.currentTarget) {
                                setSelectedPurchase(null);
                            }
                        }}
                    >
                        <div
                            role="dialog"
                            aria-modal="true"
                            aria-labelledby="purchase-modal-title"
                            className="max-h-[94vh] w-full max-w-5xl overflow-y-auto rounded-3xl border border-slate-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-950"
                        >
                            {/* MODAL HEADER */}

                            <div className="sticky top-0 z-10 flex items-center justify-between gap-4 border-b border-white/10 bg-gradient-to-r from-emerald-950 via-emerald-800 to-sky-800 px-5 py-5 text-white sm:px-7">
                                <div className="flex items-center gap-3">
                                    <div className="rounded-xl border border-white/15 bg-white/10 p-3">
                                        <Icon name="file" size={23} />
                                    </div>

                                    <div>
                                        <h2
                                            id="purchase-modal-title"
                                            className="text-xl font-bold sm:text-2xl"
                                        >
                                            Purchase report
                                        </h2>

                                        <p className="mt-1 text-sm text-emerald-50/80">
                                            {selectedPurchase.purchase_number ||
                                                `PUR-${selectedPurchase.purchase_id}`}
                                        </p>
                                    </div>
                                </div>

                                <button
                                    type="button"
                                    onClick={() => setSelectedPurchase(null)}
                                    aria-label="Close purchase report"
                                    className="rounded-xl border border-white/20 bg-white/10 p-2.5 text-white transition hover:bg-white/20"
                                >
                                    <Icon name="close" size={20} />
                                </button>
                            </div>

                            {/* MODAL CONTENT */}

                            <div id="purchase-report" className="space-y-6 p-5 sm:p-7">
                                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                                    {[
                                        [
                                            "Purchase number",
                                            selectedPurchase.purchase_number,
                                        ],
                                        [
                                            "Purchase date",
                                            formatDate(selectedPurchase.purchase_date),
                                        ],
                                        [
                                            "Supplier",
                                            `${selectedPurchase.supplier_code || ""}${selectedPurchase.supplier_code ? " - " : ""}${selectedPurchase.supplier_name || "-"}`,
                                        ],
                                        [
                                            "Warehouse",
                                            `${selectedPurchase.warehouse_code || ""}${selectedPurchase.warehouse_code ? " - " : ""}${selectedPurchase.warehouse_name || "-"}`,
                                        ],
                                        ["Status", selectedPurchase.status],
                                    ].map(([label, value]) => (
                                        <div
                                            key={label}
                                            className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-900"
                                        >
                                            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                                                {label}
                                            </p>

                                            <p className="mt-2 break-words font-bold text-slate-900 dark:text-white">
                                                {value || "-"}
                                            </p>
                                        </div>
                                    ))}
                                </div>

                                {/* ITEMS TABLE */}

                                <section className="overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-800">
                                    <div className="flex items-center gap-3 border-b border-slate-200 bg-sky-50 px-4 py-4 dark:border-slate-800 dark:bg-sky-950/30 sm:px-5">
                                        <Icon
                                            name="package"
                                            size={20}
                                            className="text-sky-700 dark:text-sky-300"
                                        />

                                        <h3 className="font-bold text-slate-900 dark:text-white">
                                            Purchase items
                                        </h3>
                                    </div>

                                    <div className="overflow-x-auto">
                                        <table className="w-full min-w-[700px] text-left text-sm">
                                            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500 dark:bg-slate-900 dark:text-slate-400">
                                                <tr>
                                                    <th className="p-3">Product</th>
                                                    <th className="p-3 text-right">Quantity</th>
                                                    <th className="p-3 text-right">Unit cost</th>
                                                    <th className="p-3 text-right">Discount</th>
                                                    <th className="p-3 text-right">Tax</th>
                                                    <th className="p-3 text-right">Total</th>
                                                </tr>
                                            </thead>

                                            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                                {(selectedPurchase.items || []).map(
                                                    (item, index) => (
                                                        <tr
                                                            key={
                                                                item.purchase_item_id ??
                                                                index
                                                            }
                                                        >
                                                            <td className="p-3 font-medium text-slate-800 dark:text-slate-200">
                                                                {item.sku
                                                                    ? `${item.sku} - `
                                                                    : ""}
                                                                {item.product_name || "-"}
                                                            </td>

                                                            <td className="p-3 text-right tabular-nums text-slate-600 dark:text-slate-300">
                                                                {formatAmount(item.quantity)}
                                                            </td>

                                                            <td className="p-3 text-right tabular-nums text-slate-600 dark:text-slate-300">
                                                                {formatAmount(item.unit_cost)}
                                                            </td>

                                                            <td className="p-3 text-right tabular-nums text-slate-600 dark:text-slate-300">
                                                                {formatAmount(item.discount)}
                                                            </td>

                                                            <td className="p-3 text-right tabular-nums text-slate-600 dark:text-slate-300">
                                                                {formatAmount(item.tax)}
                                                            </td>

                                                            <td className="p-3 text-right font-bold tabular-nums text-emerald-700 dark:text-emerald-300">
                                                                {formatAmount(item.line_total)}
                                                            </td>
                                                        </tr>
                                                    )
                                                )}

                                                {(!selectedPurchase.items ||
                                                    selectedPurchase.items.length === 0) && (
                                                        <tr>
                                                            <td
                                                                colSpan={6}
                                                                className="p-8 text-center text-slate-500 dark:text-slate-400"
                                                            >
                                                                No purchase items found.
                                                            </td>
                                                        </tr>
                                                    )}
                                            </tbody>
                                        </table>
                                    </div>
                                </section>

                                {/* NOTES AND FINANCIAL SUMMARY */}

                                <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
                                    <section className="rounded-2xl border border-slate-200 p-5 dark:border-slate-800">
                                        <h3 className="font-bold text-slate-900 dark:text-white">
                                            Purchase notes
                                        </h3>

                                        <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-slate-600 dark:text-slate-300">
                                            {selectedPurchase.notes ||
                                                "No notes were added to this purchase."}
                                        </p>
                                    </section>

                                    <section className="overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-800">
                                        <div className="border-b border-slate-200 bg-slate-50 px-4 py-3 font-bold text-slate-900 dark:border-slate-800 dark:bg-slate-900 dark:text-white">
                                            Financial summary
                                        </div>

                                        <div className="divide-y divide-slate-100 dark:divide-slate-800">
                                            {[
                                                ["Subtotal", selectedPurchase.subtotal],
                                                ["Discount", selectedPurchase.discount],
                                                ["Tax", selectedPurchase.tax],
                                                ["Total", selectedPurchase.total_amount],
                                                ["Paid", selectedPurchase.paid_amount],
                                                ["Balance", selectedPurchase.balance_amount],
                                            ].map(([label, value]) => (
                                                <div
                                                    key={label}
                                                    className={`flex items-center justify-between gap-4 px-4 py-3 ${label === "Total"
                                                            ? "bg-sky-50 font-bold text-sky-900 dark:bg-sky-950/40 dark:text-sky-200"
                                                            : label === "Balance"
                                                                ? "font-bold text-emerald-800 dark:text-emerald-300"
                                                                : "text-slate-600 dark:text-slate-300"
                                                        }`}
                                                >
                                                    <span>{label}</span>

                                                    <span className="tabular-nums">
                                                        {formatAmount(value)}
                                                    </span>
                                                </div>
                                            ))}
                                        </div>
                                    </section>
                                </div>
                            </div>

                            {/* MODAL FOOTER */}

                            <div className="sticky bottom-0 flex flex-wrap justify-end gap-3 border-t border-slate-200 bg-white/95 px-5 py-4 backdrop-blur dark:border-slate-800 dark:bg-slate-950/95 sm:px-7">
                                <button
                                    type="button"
                                    onClick={printPurchase}
                                    className={buttonSecondary}
                                >
                                    <Icon name="print" size={17} />
                                    Print
                                </button>

                                <button
                                    type="button"
                                    onClick={downloadPurchasePDF}
                                    className={buttonPrimary}
                                >
                                    <Icon name="download" size={17} />
                                    Download PDF
                                </button>

                                <button
                                    type="button"
                                    onClick={() => setSelectedPurchase(null)}
                                    className={buttonSecondary}
                                >
                                    Close
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* PRINT STYLES */}

                <style jsx global>{`
                    @media print {
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
                            padding: 16px !important;
                            background: white !important;
                            color: #0f172a !important;
                        }

                        #purchase-report table,
                        #purchase-report tr,
                        #purchase-report td,
                        #purchase-report th {
                            color: #0f172a !important;
                            border-color: #cbd5e1 !important;
                        }

                        #purchase-report section,
                        #purchase-report div {
                            background: white !important;
                            box-shadow: none !important;
                        }
                    }
                `}</style>
            </div>
        </div>
    );
}