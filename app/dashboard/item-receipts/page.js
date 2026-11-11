
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
    AlertCircle,
    ArrowLeft,
    Check,
    CheckCircle2,
    ClipboardList,
    Eye,
    FileText,
    Filter,
    LoaderCircle,
    Package,
    Plus,
    Printer,
    RefreshCw,
    Search,
    Save,
    Trash2,
    Truck,
    Warehouse,
    X,
    Pencil,
    CalendarDays,
    Boxes,
    CircleDollarSign,
    ClipboardCheck,
    Download,
} from "lucide-react";

// ============================================================
// CONSTANTS
// ============================================================

const API_URL = "/api/item-receipts";
const PERMISSION_KEY = "item_receipts";

const EMPTY_FORM = {
    sourceType: "MANUAL",
    supplierId: "",
    warehouseId: "",
    purchaseOrderId: "",
    pendingItemReceiptId: "",
    receiptDate: getToday(),
    remarks: "",
};

function getToday() {
    const date = new Date();

    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");

    return `${year}-${month}-${day}`;
}

function createEmptyItem() {
    return {
        productId: "",
        purchaseOrderItemId: "",
        pendingItemReceiptItemId: "",
        itemDescription: "",
        uom: "PCS",
        quantityReceived: "1",
        unitCost: "0",
        remarks: "",
    };
}

const INPUT_CLASS =
    "w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 disabled:cursor-not-allowed disabled:bg-slate-100 dark:border-slate-700 dark:bg-slate-950 dark:text-white dark:disabled:bg-slate-800";

const LABEL_CLASS =
    "mb-1.5 block text-sm font-semibold text-slate-700 dark:text-slate-300";

const CARD_CLASS =
    "rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900";

const PRIMARY_BUTTON =
    "inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50";

const SECONDARY_BUTTON =
    "inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800";

// ============================================================
// HELPERS
// ============================================================

async function readResponse(response) {
    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
        throw new Error(
            data.message ||
            data.error ||
            "The request could not be completed."
        );
    }

    return data;
}

function formatDate(value) {
    if (!value) return "-";

    const date = String(value).slice(0, 10);

    const [year, month, day] = date.split("-");

    if (!year || !month || !day) return date;

    return `${day}-${month}-${year}`;
}

function formatNumber(value) {
    return Number(value || 0).toLocaleString("en-PK", {
        maximumFractionDigits: 3,
    });
}

function formatCurrency(value) {
    return `PKR ${Number(value || 0).toLocaleString("en-PK", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    })}`;
}

function getStatusClass(status) {
    const value = String(status || "").toUpperCase();

    if (value === "APPROVED") {
        return "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300";
    }

    if (value === "CANCELLED") {
        return "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300";
    }

    return "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300";
}

function getSourceLabel(source) {
    const value = String(source || "").toUpperCase();

    if (value === "PURCHASE_ORDER") return "Purchase Order";

    if (value === "PENDING_ITEM_RECEIPT") {
        return "Pending Item Receipt";
    }

    return "Manual";
}

function getProductId(product) {
    return product.product_id ?? product.productId ?? product.id;
}

function getProductName(product) {
    return (
        product.product_name ||
        product.productName ||
        product.name ||
        ""
    );
}

function getProductUnit(product) {
    return (
        product.unit ||
        product.purchase_unit ||
        product.uom ||
        "PCS"
    );
}

function normalizeProducts(data) {
    const products = Array.isArray(data)
        ? data
        : data.products ||
        data.data ||
        data.items ||
        [];

    return products.filter((product) => getProductId(product));
}

function normalizeReceiptItem(item) {
    return {
        productId: item.product_id
            ? String(item.product_id)
            : "",

        purchaseOrderItemId: item.purchase_order_item_id
            ? String(item.purchase_order_item_id)
            : "",

        pendingItemReceiptItemId:
            item.pending_item_receipt_item_id
                ? String(item.pending_item_receipt_item_id)
                : "",

        itemDescription:
            item.item_description ||
            item.product_name ||
            "",

        uom:
            item.uom ||
            item.product_unit ||
            "PCS",

        quantityReceived: String(
            item.quantity_received ?? item.quantityReceived ?? 1
        ),

        unitCost: String(
            item.unit_cost ?? item.unitCost ?? 0
        ),

        remarks: item.remarks || "",
    };
}

// ============================================================
// SMALL COMPONENTS
// ============================================================

function Field({ label, required, children, hint }) {
    return (
        <div className="min-w-0">
            <label className={LABEL_CLASS}>
                {label}
                {required && (
                    <span className="ml-1 text-red-500">*</span>
                )}
            </label>

            {children}

            {hint && (
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                    {hint}
                </p>
            )}
        </div>
    );
}

function StatusBadge({ status }) {
    return (
        <span
            className={`inline-flex rounded-full px-3 py-1 text-xs font-bold ${getStatusClass(status)}`}
        >
            {status || "DRAFT"}
        </span>
    );
}

function SummaryCard({
    title,
    value,
    description,
    icon: Icon,
    color = "blue",
}) {
    const colors = {
        blue: "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300",
        emerald: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
        amber: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
        violet: "bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-300",
    };

    return (
        <div className={`${CARD_CLASS} p-5`}>
            <div className="flex items-start justify-between gap-3">
                <div>
                    <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
                        {title}
                    </p>

                    <p className="mt-2 text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
                        {value}
                    </p>
                </div>

                <div
                    className={`flex h-11 w-11 items-center justify-center rounded-xl ${colors[color]}`}
                >
                    <Icon size={22} />
                </div>
            </div>

            <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">
                {description}
            </p>
        </div>
    );
}

// ============================================================
// MAIN PAGE
// ============================================================

export default function ItemReceiptsPage() {
    // --------------------------------------------------------
    // STATE
    // --------------------------------------------------------

    const [receipts, setReceipts] = useState([]);
    const [suppliers, setSuppliers] = useState([]);
    const [warehouses, setWarehouses] = useState([]);
    const [purchaseOrders, setPurchaseOrders] = useState([]);
    const [pendingReceipts, setPendingReceipts] = useState([]);
    const [products, setProducts] = useState([]);

    const [form, setForm] = useState(EMPTY_FORM);
    const [items, setItems] = useState([createEmptyItem()]);

    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [processing, setProcessing] = useState(false);

    const [error, setError] = useState("");
    const [message, setMessage] = useState("");

    const [search, setSearch] = useState("");
    const [statusFilter, setStatusFilter] = useState("ALL");
    const [sourceFilter, setSourceFilter] = useState("ALL");

    const [mode, setMode] = useState("LIST");
    const [currentReceipt, setCurrentReceipt] = useState(null);
    const [editingId, setEditingId] = useState(null);

    const [permissions, setPermissions] = useState({
        canView: true,
        canCreate: false,
        canUpdate: false,
        canDelete: false,
    });

    // --------------------------------------------------------
    // PERMISSION HELPERS
    // --------------------------------------------------------

    const loadPermissions = useCallback(async () => {
        try {
            const response = await fetch(
                "/api/auth/my-permissions",
                { cache: "no-store" }
            );

            if (!response.ok) return;

            const data = await response.json();

            const permissionRows =
                Array.isArray(data)
                    ? data
                    : data.permissions || data.data || [];

            const permission = permissionRows.find(
                (item) =>
                    item.permission_key === PERMISSION_KEY ||
                    item.permissionKey === PERMISSION_KEY
            );

            if (permission) {
                setPermissions({
                    canView:
                        permission.can_view ??
                        permission.canView ??
                        false,

                    canCreate:
                        permission.can_create ??
                        permission.canCreate ??
                        false,

                    canUpdate:
                        permission.can_update ??
                        permission.canUpdate ??
                        false,

                    canDelete:
                        permission.can_delete ??
                        permission.canDelete ??
                        false,
                });
            }
        } catch (err) {
            console.error("Permission loading error:", err);
        }
    }, []);

    // --------------------------------------------------------
    // LOAD DATA
    // --------------------------------------------------------

    const fetchData = useCallback(async () => {
        setLoading(true);
        setError("");

        try {
            const [receiptResponse, productResponse] =
                await Promise.all([
                    fetch(API_URL, { cache: "no-store" }),
                    fetch("/api/products", { cache: "no-store" }),
                ]);

            const data = await readResponse(receiptResponse);

            console.log("ITEM RECEIPTS API RESPONSE:", data);

            console.log("SUPPLIERS:", data.suppliers);
            console.log("WAREHOUSES:", data.warehouses);
            console.log("PURCHASE ORDERS:", data.purchaseOrders);
            console.log("PENDING RECEIPTS:", data.pendingReceipts);

            const productData = productResponse.ok
                ? await productResponse.json().catch(() => ({}))
                : {};

            setReceipts(data.receipts || []);
            setSuppliers(data.suppliers || []);
            setWarehouses(data.warehouses || []);
            setPurchaseOrders(data.purchaseOrders || []);
            setPendingReceipts(data.pendingReceipts || []);
            setProducts(normalizeProducts(productData));

        } catch (err) {
            setError(err.message || "Failed to load Item Receipts.");
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        let cancelled = false;

        const initializePage = async () => {
            try {
                await Promise.all([
                    loadPermissions(),
                    fetchData(),
                ]);
            } catch (error) {
                if (!cancelled) {
                    console.error(
                        "Item Receipt page initialization error:",
                        error
                    );
                }
            }
        };

        initializePage();

        return () => {
            cancelled = true;
        };
    }, [loadPermissions, fetchData]);

    // --------------------------------------------------------
    // FORM HELPERS
    // --------------------------------------------------------

    function updateForm(field, value) {
        setForm((previous) => ({
            ...previous,
            [field]: value,
        }));
    }

    function updateItem(index, field, value) {
        setItems((previous) =>
            previous.map((item, itemIndex) =>
                itemIndex === index
                    ? { ...item, [field]: value }
                    : item
            )
        );
    }

    function selectProduct(index, productId) {
        const product = products.find(
            (item) =>
                String(getProductId(item)) === String(productId)
        );

        setItems((previous) =>
            previous.map((item, itemIndex) => {
                if (itemIndex !== index) return item;

                if (!product) {
                    return {
                        ...item,
                        productId: "",
                    };
                }

                return {
                    ...item,
                    productId: String(getProductId(product)),
                    itemDescription: getProductName(product),
                    uom: getProductUnit(product),
                    unitCost: String(
                        product.cost_price ??
                        product.purchase_price ??
                        item.unitCost ??
                        0
                    ),
                };
            })
        );
    }

    function addItem() {
        setItems((previous) => [
            ...previous,
            createEmptyItem(),
        ]);
    }

    function removeItem(index) {
        setItems((previous) => {
            if (previous.length <= 1) return previous;

            return previous.filter(
                (_, itemIndex) => itemIndex !== index
            );
        });
    }

    function resetForm() {
        setForm({
            ...EMPTY_FORM,
            receiptDate: getToday(),
        });

        setItems([createEmptyItem()]);
        setEditingId(null);
        setCurrentReceipt(null);
        setMode("LIST");
    }

    // --------------------------------------------------------
    // LOAD PENDING ITEM RECEIPT
    // --------------------------------------------------------

    async function loadPendingReceipt(pendingId) {
        if (!pendingId) return;

        setProcessing(true);
        setError("");

        try {
            const response = await fetch(
                `/api/pending-item-receipts/${pendingId}`,
                { cache: "no-store" }
            );

            const data = await readResponse(response);

            const receipt =
                data.receipt ||
                data.pendingReceipt ||
                data.data;

            const sourceItems =
                data.items ||
                receipt?.items ||
                [];

            if (!receipt) {
                throw new Error(
                    "Pending Item Receipt details were not returned."
                );
            }

            setForm((previous) => ({
                ...previous,
                sourceType: "PENDING_ITEM_RECEIPT",
                pendingItemReceiptId: String(pendingId),
                purchaseOrderId: "",
                supplierId: String(receipt.supplier_id || ""),
                receiptDate: getToday(),
                remarks: receipt.remarks || "",
            }));

            setItems(
                sourceItems.map((item) => ({
                    productId: item.product_id
                        ? String(item.product_id)
                        : "",

                    purchaseOrderItemId:
                        item.purchase_order_item_id
                            ? String(item.purchase_order_item_id)
                            : "",

                    pendingItemReceiptItemId: String(
                        item.pending_item_receipt_item_id ||
                        item.id ||
                        ""
                    ),

                    itemDescription:
                        item.item_description ||
                        item.product_name ||
                        "",

                    uom: item.uom || "PCS",

                    quantityReceived: String(
                        item.quantity_expected ?? 1
                    ),

                    unitCost: String(
                        item.unit_cost ??
                        item.unit_price ??
                        0
                    ),

                    remarks: item.remarks || "",
                }))
            );

            setMessage(
                "Pending Item Receipt loaded. Review the actual received quantities before saving."
            );

        } catch (err) {
            setError(err.message || "Unable to load Pending Item Receipt.");
        } finally {
            setProcessing(false);
        }
    }

    // --------------------------------------------------------
    // FORM MODES
    // --------------------------------------------------------

    function openCreate() {
        if (!permissions.canCreate) {
            setError("You do not have permission to create Item Receipts.");
            return;
        }

        setError("");
        setMessage("");
        setEditingId(null);
        setCurrentReceipt(null);
        setForm({
            ...EMPTY_FORM,
            receiptDate: getToday(),
        });
        setItems([createEmptyItem()]);
        setMode("CREATE");
    }

    async function openEdit(receipt) {
        if (!permissions.canUpdate) {
            setError("You do not have permission to edit Item Receipts.");
            return;
        }

        setProcessing(true);
        setError("");
        setMessage("");

        try {
            const response = await fetch(
                `${API_URL}/${receipt.item_receipt_id}`,
                { cache: "no-store" }
            );

            const data = await readResponse(response);

            const detail = data.receipt;

            if (!detail) {
                throw new Error("Receipt details not found.");
            }

            if (String(detail.status).toUpperCase() !== "DRAFT") {
                throw new Error("Only draft receipts can be edited.");
            }

            setEditingId(detail.item_receipt_id);
            setCurrentReceipt(detail);

            setForm({
                sourceType: detail.source_type || "MANUAL",
                supplierId: String(detail.supplier_id || ""),
                warehouseId: String(detail.warehouse_id || ""),
                purchaseOrderId: String(detail.purchase_order_id || ""),
                pendingItemReceiptId: String(
                    detail.pending_item_receipt_id || ""
                ),
                receiptDate: String(detail.receipt_date).slice(0, 10),
                remarks: detail.remarks || "",
            });

            setItems(
                (data.items || []).map(normalizeReceiptItem)
            );

            setMode("EDIT");

        } catch (err) {
            setError(err.message || "Failed to load receipt.");
        } finally {
            setProcessing(false);
        }
    }

    async function openView(receipt) {
        setProcessing(true);
        setError("");
        setMessage("");

        try {
            const response = await fetch(
                `${API_URL}/${receipt.item_receipt_id}`,
                { cache: "no-store" }
            );

            const data = await readResponse(response);

            setCurrentReceipt({
                ...data.receipt,
                items: data.items || [],
                summary: data.summary || {},
            });

            setMode("VIEW");

        } catch (err) {
            setError(err.message || "Failed to load receipt.");
        } finally {
            setProcessing(false);
        }
    }

    // --------------------------------------------------------
    // SAVE RECEIPT
    // --------------------------------------------------------

    async function saveReceipt(event) {
        event.preventDefault();

        if (saving) return;

        setSaving(true);
        setError("");
        setMessage("");

        try {
            if (!form.supplierId) {
                throw new Error("Please select a supplier.");
            }

            if (!form.warehouseId) {
                throw new Error("Please select a warehouse.");
            }

            if (!form.receiptDate) {
                throw new Error("Receipt date is required.");
            }

            if (form.sourceType === "PENDING_ITEM_RECEIPT" &&
                !form.pendingItemReceiptId) {
                throw new Error("Please select a Pending Item Receipt.");
            }

            const validItems = items.filter(
                (item) =>
                    item.itemDescription.trim() &&
                    Number(item.quantityReceived) > 0
            );

            if (validItems.length === 0) {
                throw new Error("Please add at least one valid item.");
            }

            const payload = {
                sourceType: form.sourceType,
                supplierId: Number(form.supplierId),
                warehouseId: Number(form.warehouseId),
                receiptDate: form.receiptDate,
                remarks: form.remarks,

                ...(form.sourceType === "PURCHASE_ORDER" && {
                    purchaseOrderId: Number(form.purchaseOrderId),
                }),

                ...(form.sourceType === "PENDING_ITEM_RECEIPT" && {
                    pendingItemReceiptId: Number(
                        form.pendingItemReceiptId
                    ),
                }),

                items: validItems.map((item) => ({
                    productId: item.productId
                        ? Number(item.productId)
                        : null,

                    purchaseOrderItemId:
                        item.purchaseOrderItemId
                            ? Number(item.purchaseOrderItemId)
                            : null,

                    pendingItemReceiptItemId:
                        item.pendingItemReceiptItemId
                            ? Number(item.pendingItemReceiptItemId)
                            : null,

                    itemDescription: item.itemDescription.trim(),
                    uom: item.uom,
                    quantityReceived: Number(item.quantityReceived),
                    unitCost: Number(item.unitCost || 0),
                    remarks: item.remarks,
                })),
            };

            const isEditing = Boolean(editingId);

            const response = await fetch(
                isEditing
                    ? `${API_URL}/${editingId}`
                    : API_URL,
                {
                    method: isEditing ? "PATCH" : "POST",
                    headers: {
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify(payload),
                }
            );

            const data = await readResponse(response);

            await fetchData();

            resetForm();

            setMessage(
                isEditing
                    ? "Item Receipt updated successfully."
                    : `Item Receipt ${data.receipt?.receipt_number || ""} created successfully as a draft.`
            );

        } catch (err) {
            setError(err.message || "Unable to save Item Receipt.");
        } finally {
            setSaving(false);
        }
    }

    // --------------------------------------------------------
    // APPROVE RECEIPT
    // --------------------------------------------------------

    async function approveReceipt(receipt) {
        if (!permissions.canUpdate) {
            setError("You do not have permission to approve Item Receipts.");
            return;
        }

        const confirmed = window.confirm(
            `Approve ${receipt.receipt_number}?\n\nThis will increase warehouse stock and create inventory ledger transactions.`
        );

        if (!confirmed) return;

        setProcessing(true);
        setError("");
        setMessage("");

        try {
            const response = await fetch(
                `${API_URL}/${receipt.item_receipt_id}/approve`,
                {
                    method: "POST",
                }
            );

            const data = await readResponse(response);

            await fetchData();

            setCurrentReceipt(null);
            setMode("LIST");

            setMessage(
                `${receipt.receipt_number} approved successfully. Inventory has been updated.`
            );

        } catch (err) {
            setError(err.message || "Unable to approve receipt.");
        } finally {
            setProcessing(false);
        }
    }

    // --------------------------------------------------------
    // DELETE RECEIPT
    // --------------------------------------------------------

    async function deleteReceipt(receipt) {
        if (!permissions.canDelete) {
            setError("You do not have permission to delete Item Receipts.");
            return;
        }

        if (String(receipt.status).toUpperCase() !== "DRAFT") {
            setError("Only draft receipts can be deleted.");
            return;
        }

        const confirmed = window.confirm(
            `Delete Item Receipt ${receipt.receipt_number}?\n\nThis action cannot be undone.`
        );

        if (!confirmed) return;

        setProcessing(true);
        setError("");
        setMessage("");

        try {
            const response = await fetch(
                `${API_URL}/${receipt.item_receipt_id}`,
                {
                    method: "DELETE",
                }
            );

            await readResponse(response);

            await fetchData();

            setMessage(
                `${receipt.receipt_number} deleted successfully.`
            );

        } catch (err) {
            setError(err.message || "Unable to delete receipt.");
        } finally {
            setProcessing(false);
        }
    }

    // --------------------------------------------------------
    // PRINT RECEIPT
    // --------------------------------------------------------

    function printReceipt(receipt) {
        if (!receipt) return;
        window.print();
    }

    // --------------------------------------------------------
    // FILTERED RECEIPTS
    // --------------------------------------------------------

    const filteredReceipts = useMemo(() => {
        const searchValue = search.toLowerCase().trim();

        return receipts.filter((receipt) => {
            const matchesSearch =
                !searchValue ||
                [
                    receipt.receipt_number,
                    receipt.supplier_name,
                    receipt.warehouse_name,
                    receipt.purchase_order_number,
                    receipt.pending_receipt_number,
                ].some((value) =>
                    String(value || "")
                        .toLowerCase()
                        .includes(searchValue)
                );

            const matchesStatus =
                statusFilter === "ALL" ||
                String(receipt.status).toUpperCase() === statusFilter;

            const matchesSource =
                sourceFilter === "ALL" ||
                String(receipt.source_type).toUpperCase() === sourceFilter;

            return matchesSearch && matchesStatus && matchesSource;
        });
    }, [receipts, search, statusFilter, sourceFilter]);

    // --------------------------------------------------------
    // SUMMARY
    // --------------------------------------------------------

    const summary = useMemo(() => {
        return {
            total: receipts.length,

            draft: receipts.filter(
                (item) =>
                    String(item.status).toUpperCase() === "DRAFT"
            ).length,

            approved: receipts.filter(
                (item) =>
                    String(item.status).toUpperCase() === "APPROVED"
            ).length,

            totalQuantity: receipts.reduce(
                (total, item) =>
                    total + Number(item.total_quantity || 0),
                0
            ),
        };
    }, [receipts]);

    const formTotal = items.reduce(
        (total, item) =>
            total +
            Number(item.quantityReceived || 0) *
            Number(item.unitCost || 0),
        0
    );

    // --------------------------------------------------------
    // ACCESS CONTROL
    // --------------------------------------------------------

    if (!loading && !permissions.canView) {
        return (
            <div className="flex min-h-[60vh] items-center justify-center p-6">
                <div className={`${CARD_CLASS} max-w-md p-8 text-center`}>
                    <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-red-100 text-red-600 dark:bg-red-950 dark:text-red-300">
                        <AlertCircle size={28} />
                    </div>

                    <h2 className="mt-4 text-xl font-bold text-slate-900 dark:text-white">
                        Access Restricted
                    </h2>

                    <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
                        You do not have permission to view Item Receipts.
                        Please contact your administrator.
                    </p>
                </div>
            </div>
        );
    }

    // ========================================================
    // RECEIPT FORM
    // ========================================================

    if (mode === "CREATE" || mode === "EDIT") {
        return (
            <main className="min-h-screen space-y-6 p-4 sm:p-6 lg:p-8">

                {/* HEADER */}

                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-start gap-3">
                        <button
                            type="button"
                            onClick={resetForm}
                            className="mt-1 rounded-xl border border-slate-200 p-2.5 text-slate-600 transition hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                        >
                            <ArrowLeft size={19} />
                        </button>

                        <div>
                            <div className="flex items-center gap-2">
                                <Package
                                    className="text-blue-600"
                                    size={23}
                                />

                                <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
                                    {mode === "EDIT"
                                        ? "Edit Item Receipt"
                                        : "Create Item Receipt"}
                                </h1>
                            </div>

                            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                                Record goods physically received from your supplier.
                            </p>
                        </div>
                    </div>

                    {editingId && currentReceipt && (
                        <div className="flex items-center gap-2">
                            <span className="text-sm font-semibold text-slate-500">
                                {currentReceipt.receipt_number}
                            </span>

                            <StatusBadge status={currentReceipt.status} />
                        </div>
                    )}
                </div>

                {/* ALERTS */}

                {error && (
                    <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
                        <AlertCircle size={19} className="mt-0.5 shrink-0" />
                        {error}
                    </div>
                )}

                {message && (
                    <div className="flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300">
                        <CheckCircle2 size={19} className="mt-0.5 shrink-0" />
                        {message}
                    </div>
                )}

                <form onSubmit={saveReceipt} className="space-y-6">

                    {/* GENERAL INFORMATION */}

                    <section className={`${CARD_CLASS} p-5 sm:p-6`}>
                        <div className="mb-5 flex items-center gap-3">
                            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300">
                                <ClipboardList size={21} />
                            </div>

                            <div>
                                <h2 className="font-bold text-slate-900 dark:text-white">
                                    Receipt Information
                                </h2>

                                <p className="text-xs text-slate-500 dark:text-slate-400">
                                    General supplier and warehouse details
                                </p>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">

                            <Field label="Receipt Number">
                                <input
                                    className={INPUT_CLASS}
                                    value={
                                        currentReceipt?.receipt_number ||
                                        "AUTO GENERATED ON SAVE"
                                    }
                                    readOnly
                                />
                            </Field>

                            <Field label="Receipt Date" required>
                                <input
                                    type="date"
                                    className={INPUT_CLASS}
                                    value={form.receiptDate}
                                    onChange={(event) =>
                                        updateForm(
                                            "receiptDate",
                                            event.target.value
                                        )
                                    }
                                    required
                                />
                            </Field>


                            <Field label="Source Type" required>
                                <select
                                    className={INPUT_CLASS}
                                    value={form.sourceType}
                                    onChange={(event) => {
                                        const sourceType = event.target.value;

                                        setForm((previous) => ({
                                            ...previous,
                                            sourceType,
                                            purchaseOrderId: "",
                                            pendingItemReceiptId: "",
                                            supplierId: "",
                                        }));

                                        setItems([createEmptyItem()]);
                                        setError("");
                                        setMessage("");
                                    }}
                                    required
                                >
                                    <option value="MANUAL">Manual</option>

                                    <option value="PURCHASE_ORDER">
                                        Purchase Order
                                    </option>

                                    <option value="PENDING_ITEM_RECEIPT">
                                        Pending Item Receipt
                                    </option>
                                </select>
                            </Field>


                            <Field label="Supplier" required>
                                <select
                                    className={INPUT_CLASS}
                                    value={form.supplierId}
                                    onChange={(event) =>
                                        updateForm(
                                            "supplierId",
                                            event.target.value
                                        )
                                    }
                                    required
                                >
                                    <option value="">
                                        Select Supplier
                                    </option>

                                    {suppliers.map((supplier) => (
                                        <option
                                            key={supplier.supplier_id}
                                            value={supplier.supplier_id}
                                        >
                                            {supplier.supplier_code
                                                ? `${supplier.supplier_code} - `
                                                : ""}
                                            {supplier.supplier_name}
                                        </option>
                                    ))}
                                </select>
                            </Field>

                            <Field label="Warehouse / Location" required>
                                <select
                                    className={INPUT_CLASS}
                                    value={form.warehouseId}
                                    onChange={(event) =>
                                        updateForm(
                                            "warehouseId",
                                            event.target.value
                                        )
                                    }
                                    required
                                >
                                    <option value="">
                                        Select Warehouse
                                    </option>

                                    {warehouses.map((warehouse) => (
                                        <option
                                            key={warehouse.warehouse_id}
                                            value={warehouse.warehouse_id}
                                        >
                                            {warehouse.warehouse_code
                                                ? `${warehouse.warehouse_code} - `
                                                : ""}
                                            {warehouse.warehouse_name}
                                        </option>
                                    ))}
                                </select>
                            </Field>

                            {form.sourceType === "PENDING_ITEM_RECEIPT" && (
                                <Field
                                    label="Pending Item Receipt"
                                    required
                                >
                                    <select
                                        className={INPUT_CLASS}
                                        value={form.pendingItemReceiptId}
                                        disabled={mode === "EDIT"}
                                        onChange={(event) => {
                                            const id = event.target.value;

                                            updateForm(
                                                "pendingItemReceiptId",
                                                id
                                            );

                                            if (id) {
                                                loadPendingReceipt(id);
                                            }
                                        }}
                                        required
                                    >
                                        <option value="">
                                            Select Pending Receipt
                                        </option>

                                        {pendingReceipts.map((receipt) => (
                                            <option
                                                key={receipt.pending_item_receipt_id}
                                                value={receipt.pending_item_receipt_id}
                                            >
                                                {receipt.receipt_number}
                                                {" - "}
                                                {receipt.supplier_name}
                                            </option>
                                        ))}
                                    </select>
                                </Field>
                            )}

                            {form.sourceType === "PURCHASE_ORDER" && (
                                <Field
                                    label="Purchase Order"
                                    required
                                    hint="Select an approved Purchase Order to load its remaining items."
                                >
                                    <select
                                        className={INPUT_CLASS}
                                        value={form.purchaseOrderId}
                                        onChange={async (event) => {
                                            const purchaseOrderId = event.target.value;

                                            const selected = purchaseOrders.find(
                                                (po) =>
                                                    String(po.purchase_order_id) ===
                                                    purchaseOrderId
                                            );

                                            updateForm("purchaseOrderId", purchaseOrderId);

                                            setError("");
                                            setMessage("");

                                            if (!purchaseOrderId) {
                                                setItems([createEmptyItem()]);
                                                updateForm("supplierId", "");
                                                return;
                                            }

                                            if (selected?.supplier_id) {
                                                updateForm(
                                                    "supplierId",
                                                    String(selected.supplier_id)
                                                );
                                            }

                                            setItems([createEmptyItem()]);

                                            try {
                                                const response = await fetch(
                                                    `/api/purchase-orders/${encodeURIComponent(
                                                        purchaseOrderId
                                                    )}`,
                                                    {
                                                        method: "GET",
                                                        cache: "no-store",
                                                    }
                                                );

                                                const data = await response.json();

                                                if (!response.ok || !data.success) {
                                                    throw new Error(
                                                        data.message ||
                                                        "Failed to load Purchase Order details."
                                                    );
                                                }

                                                const purchaseOrder = data.purchaseOrder;

                                                if (!purchaseOrder) {
                                                    throw new Error(
                                                        "Purchase Order details were not found."
                                                    );
                                                }

                                                if (purchaseOrder.supplier_id) {
                                                    updateForm(
                                                        "supplierId",
                                                        String(purchaseOrder.supplier_id)
                                                    );
                                                }

                                                const orderItems = Array.isArray(
                                                    purchaseOrder.items
                                                )
                                                    ? purchaseOrder.items
                                                    : [];

                                                if (orderItems.length === 0) {
                                                    throw new Error(
                                                        "This Purchase Order does not contain any items."
                                                    );
                                                }

                                                const populatedItems = orderItems
                                                    .map((item) => {
                                                        const remainingQuantity = Math.max(
                                                            0,
                                                            Number(
                                                                item.remaining_quantity ??
                                                                item.quantity ??
                                                                0
                                                            )
                                                        );

                                                        return {
                                                            productId: item.product_id
                                                                ? String(item.product_id)
                                                                : "",

                                                            purchaseOrderItemId: String(
                                                                item.purchase_order_item_id
                                                            ),

                                                            pendingItemReceiptItemId: "",

                                                            itemDescription:
                                                                item.item_description ||
                                                                item.product_name ||
                                                                "",

                                                            uom: item.uom || "PCS",

                                                            quantityReceived: String(
                                                                remainingQuantity
                                                            ),

                                                            unitCost: String(
                                                                item.unit_price ?? 0
                                                            ),

                                                            remarks: item.remarks || "",
                                                        };
                                                    })
                                                    .filter(
                                                        (item) =>
                                                            Number(item.quantityReceived) > 0
                                                    );

                                                if (populatedItems.length === 0) {
                                                    throw new Error(
                                                        "All items in this Purchase Order have already been received."
                                                    );
                                                }

                                                setItems(populatedItems);

                                                setMessage(
                                                    `${purchaseOrder.purchase_order_number} loaded successfully. ${populatedItems.length} remaining item(s) added.`
                                                );
                                            } catch (error) {
                                                console.error(
                                                    "Purchase Order item loading error:",
                                                    error
                                                );

                                                setItems([createEmptyItem()]);

                                                setError(
                                                    error.message ||
                                                    "Unable to load Purchase Order items."
                                                );
                                            }
                                        }}
                                        required
                                    >
                                        <option value="">Select Purchase Order</option>

                                        {purchaseOrders.map((po) => (
                                            <option
                                                key={po.purchase_order_id}
                                                value={po.purchase_order_id}
                                            >
                                                {po.purchase_order_number}
                                                {" - "}
                                                {po.supplier_name}
                                            </option>
                                        ))}
                                    </select>
                                </Field>
                            )}

                        </div>

                        <div className="mt-5">
                            <Field label="Remarks">
                                <textarea
                                    rows={3}
                                    className={INPUT_CLASS}
                                    placeholder="Enter receipt notes or comments..."
                                    value={form.remarks}
                                    onChange={(event) =>
                                        updateForm(
                                            "remarks",
                                            event.target.value
                                        )
                                    }
                                />
                            </Field>
                        </div>
                    </section>

                    {/* ITEMS */}

                    <section className={`${CARD_CLASS} overflow-hidden`}>
                        <div className="flex flex-col gap-3 border-b border-slate-200 p-5 sm:flex-row sm:items-center sm:justify-between dark:border-slate-800">
                            <div className="flex items-center gap-3">
                                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-300">
                                    <Boxes size={21} />
                                </div>

                                <div>
                                    <h2 className="font-bold text-slate-900 dark:text-white">
                                        Received Items
                                    </h2>

                                    <p className="text-xs text-slate-500 dark:text-slate-400">
                                        Enter the actual quantities physically received.
                                    </p>
                                </div>
                            </div>

                            <button
                                type="button"
                                onClick={addItem}
                                className={SECONDARY_BUTTON}
                            >
                                <Plus size={17} />
                                Add Item
                            </button>
                        </div>

                        <div className="space-y-4 p-5">

                            {items.map((item, index) => (
                                <div
                                    key={index}
                                    className="rounded-xl border border-slate-200 p-4 dark:border-slate-700"
                                >
                                    <div className="mb-4 flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-100 text-xs font-bold text-blue-700 dark:bg-blue-950 dark:text-blue-300">
                                                {index + 1}
                                            </span>

                                            <h3 className="text-sm font-bold text-slate-800 dark:text-white">
                                                Item {index + 1}
                                            </h3>
                                        </div>

                                        <button
                                            type="button"
                                            onClick={() => removeItem(index)}
                                            disabled={items.length <= 1}
                                            className="rounded-lg p-2 text-red-500 transition hover:bg-red-50 disabled:opacity-30 dark:hover:bg-red-950/30"
                                            title="Remove item"
                                        >
                                            <Trash2 size={17} />
                                        </button>
                                    </div>

                                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">

                                        <div className="md:col-span-2">
                                            <Field label="Product">
                                                <select
                                                    className={INPUT_CLASS}
                                                    value={item.productId}
                                                    onChange={(event) =>
                                                        selectProduct(
                                                            index,
                                                            event.target.value
                                                        )
                                                    }
                                                >
                                                    <option value="">
                                                        Select Product
                                                    </option>

                                                    {products.map((product) => (
                                                        <option
                                                            key={getProductId(product)}
                                                            value={getProductId(product)}
                                                        >
                                                            {product.sku
                                                                ? `${product.sku} - `
                                                                : ""}
                                                            {getProductName(product)}
                                                        </option>
                                                    ))}
                                                </select>
                                            </Field>
                                        </div>

                                        <Field label="UOM">
                                            <input
                                                className={INPUT_CLASS}
                                                value={item.uom}
                                                onChange={(event) =>
                                                    updateItem(
                                                        index,
                                                        "uom",
                                                        event.target.value
                                                    )
                                                }
                                                placeholder="PCS"
                                            />
                                        </Field>

                                        <Field
                                            label="Received Quantity"
                                            required
                                        >
                                            <input
                                                type="number"
                                                min="0.001"
                                                step="0.001"
                                                className={INPUT_CLASS}
                                                value={item.quantityReceived}
                                                onChange={(event) =>
                                                    updateItem(
                                                        index,
                                                        "quantityReceived",
                                                        event.target.value
                                                    )
                                                }
                                                required
                                            />
                                        </Field>

                                        <div className="md:col-span-2">
                                            <Field
                                                label="Item Description"
                                                required
                                            >
                                                <input
                                                    className={INPUT_CLASS}
                                                    value={item.itemDescription}
                                                    onChange={(event) =>
                                                        updateItem(
                                                            index,
                                                            "itemDescription",
                                                            event.target.value
                                                        )
                                                    }
                                                    placeholder="Product description"
                                                    required
                                                />
                                            </Field>
                                        </div>

                                        <Field label="Unit Cost">
                                            <input
                                                type="number"
                                                min="0"
                                                step="0.01"
                                                className={INPUT_CLASS}
                                                value={item.unitCost}
                                                onChange={(event) =>
                                                    updateItem(
                                                        index,
                                                        "unitCost",
                                                        event.target.value
                                                    )
                                                }
                                            />
                                        </Field>

                                        <Field label="Line Total">
                                            <input
                                                readOnly
                                                className={`${INPUT_CLASS} bg-slate-50 font-bold dark:bg-slate-800`}
                                                value={formatCurrency(
                                                    Number(item.quantityReceived || 0) *
                                                    Number(item.unitCost || 0)
                                                )}
                                            />
                                        </Field>

                                        <div className="md:col-span-4">
                                            <Field label="Item Remarks">
                                                <input
                                                    className={INPUT_CLASS}
                                                    value={item.remarks}
                                                    onChange={(event) =>
                                                        updateItem(
                                                            index,
                                                            "remarks",
                                                            event.target.value
                                                        )
                                                    }
                                                    placeholder="Optional item remarks"
                                                />
                                            </Field>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* TOTAL */}

                        <div className="border-t border-slate-200 bg-slate-50 p-5 dark:border-slate-800 dark:bg-slate-950">
                            <div className="ml-auto max-w-sm space-y-3">
                                <div className="flex justify-between text-sm text-slate-500 dark:text-slate-400">
                                    <span>Total Items</span>
                                    <span className="font-semibold text-slate-800 dark:text-white">
                                        {items.length}
                                    </span>
                                </div>

                                <div className="flex justify-between text-sm text-slate-500 dark:text-slate-400">
                                    <span>Total Quantity</span>
                                    <span className="font-semibold text-slate-800 dark:text-white">
                                        {formatNumber(
                                            items.reduce(
                                                (total, item) =>
                                                    total +
                                                    Number(item.quantityReceived || 0),
                                                0
                                            )
                                        )}
                                    </span>
                                </div>

                                <div className="flex justify-between border-t border-slate-200 pt-3 dark:border-slate-700">
                                    <span className="font-bold text-slate-900 dark:text-white">
                                        Total Amount
                                    </span>

                                    <span className="text-xl font-bold text-blue-700 dark:text-blue-300">
                                        {formatCurrency(formTotal)}
                                    </span>
                                </div>
                            </div>
                        </div>
                    </section>

                    {/* FOOTER */}

                    <div className="sticky bottom-3 z-20 flex flex-col-reverse gap-3 rounded-2xl border border-slate-200 bg-white/95 p-4 shadow-lg backdrop-blur sm:flex-row sm:items-center sm:justify-between dark:border-slate-700 dark:bg-slate-900/95">
                        <div>
                            <p className="text-sm font-bold text-slate-900 dark:text-white">
                                {mode === "EDIT"
                                    ? "Update draft receipt"
                                    : "Save Item Receipt"}
                            </p>

                            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                                Saving creates a draft. Stock changes only after approval.
                            </p>
                        </div>

                        <div className="flex flex-col-reverse gap-2 sm:flex-row">
                            <button
                                type="button"
                                onClick={resetForm}
                                disabled={saving}
                                className={SECONDARY_BUTTON}
                            >
                                Cancel
                            </button>

                            <button
                                type="submit"
                                disabled={saving || processing}
                                className={PRIMARY_BUTTON}
                            >
                                {saving ? (
                                    <LoaderCircle
                                        size={17}
                                        className="animate-spin"
                                    />
                                ) : (
                                    <Save size={17} />
                                )}

                                {saving
                                    ? "Saving..."
                                    : mode === "EDIT"
                                        ? "Update Receipt"
                                        : "Save as Draft"}
                            </button>
                        </div>
                    </div>
                </form>
            </main>
        );
    }

    // ========================================================
    // VIEW RECEIPT
    // ========================================================

    if (mode === "VIEW" && currentReceipt) {
        const viewItems = currentReceipt.items || [];

        return (
            <main className="min-h-screen space-y-6 p-4 sm:p-6 lg:p-8 print:bg-white print:p-0">

                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between print:hidden">
                    <div className="flex items-center gap-3">
                        <button
                            type="button"
                            onClick={() => {
                                setCurrentReceipt(null);
                                setMode("LIST");
                            }}
                            className={SECONDARY_BUTTON}
                        >
                            <ArrowLeft size={17} />
                            Back
                        </button>

                        <div>
                            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
                                Item Receipt Details
                            </h1>

                            <p className="text-sm text-slate-500 dark:text-slate-400">
                                {currentReceipt.receipt_number}
                            </p>
                        </div>
                    </div>

                    <div className="flex flex-wrap gap-2">
                        <button
                            type="button"
                            onClick={() => printReceipt(currentReceipt)}
                            className={SECONDARY_BUTTON}
                        >
                            <Printer size={17} />
                            Print
                        </button>

                        {String(currentReceipt.status).toUpperCase() === "DRAFT" &&
                            permissions.canUpdate && (
                                <button
                                    type="button"
                                    onClick={() => openEdit(currentReceipt)}
                                    className={PRIMARY_BUTTON}
                                >
                                    <Pencil size={17} />
                                    Edit
                                </button>
                            )}

                        {String(currentReceipt.status).toUpperCase() === "DRAFT" &&
                            permissions.canUpdate && (
                                <button
                                    type="button"
                                    onClick={() => approveReceipt(currentReceipt)}
                                    disabled={processing}
                                    className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
                                >
                                    <Check size={17} />
                                    Approve
                                </button>
                            )}
                    </div>
                </div>

                {error && (
                    <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 print:hidden">
                        {error}
                    </div>
                )}

                <section className={`${CARD_CLASS} p-6 print:rounded-none print:border-0 print:shadow-none`}>
                    <div className="flex flex-col gap-4 border-b border-slate-200 pb-5 sm:flex-row sm:items-start sm:justify-between dark:border-slate-700">
                        <div>
                            <div className="flex items-center gap-2">
                                <Package className="text-blue-600" size={25} />

                                <h2 className="text-xl font-bold text-slate-900 dark:text-white">
                                    ITEM RECEIPT
                                </h2>
                            </div>

                            <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
                                Goods Receiving Document
                            </p>
                        </div>

                        <div className="sm:text-right">
                            <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                                {currentReceipt.receipt_number}
                            </h3>

                            <div className="mt-2">
                                <StatusBadge status={currentReceipt.status} />
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 gap-6 py-6 sm:grid-cols-2 lg:grid-cols-3">
                        <div>
                            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                                Supplier
                            </p>

                            <p className="mt-2 font-bold text-slate-900 dark:text-white">
                                {currentReceipt.supplier_name || "-"}
                            </p>
                        </div>

                        <div>
                            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                                Warehouse
                            </p>

                            <p className="mt-2 font-bold text-slate-900 dark:text-white">
                                {currentReceipt.warehouse_name || "-"}
                            </p>
                        </div>

                        <div>
                            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                                Receipt Date
                            </p>

                            <p className="mt-2 font-bold text-slate-900 dark:text-white">
                                {formatDate(currentReceipt.receipt_date)}
                            </p>
                        </div>

                        <div>
                            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                                Source
                            </p>

                            <p className="mt-2 font-bold text-slate-900 dark:text-white">
                                {getSourceLabel(currentReceipt.source_type)}
                            </p>
                        </div>

                        <div>
                            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                                Purchase Order
                            </p>

                            <p className="mt-2 font-bold text-slate-900 dark:text-white">
                                {currentReceipt.purchase_order_number || "-"}
                            </p>
                        </div>

                        <div>
                            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                                Pending Receipt
                            </p>

                            <p className="mt-2 font-bold text-slate-900 dark:text-white">
                                {currentReceipt.pending_receipt_number || "-"}
                            </p>
                        </div>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full min-w-[700px] text-left text-sm">
                            <thead>
                                <tr className="border-y border-slate-200 bg-slate-50 text-xs uppercase text-slate-500 dark:border-slate-700 dark:bg-slate-950">
                                    <th className="px-4 py-3">#</th>
                                    <th className="px-4 py-3">Description</th>
                                    <th className="px-4 py-3">UOM</th>
                                    <th className="px-4 py-3 text-right">Received</th>
                                    <th className="px-4 py-3 text-right">Unit Cost</th>
                                    <th className="px-4 py-3 text-right">Total</th>
                                </tr>
                            </thead>

                            <tbody>
                                {viewItems.map((item, index) => (
                                    <tr
                                        key={item.item_receipt_item_id || index}
                                        className="border-b border-slate-100 dark:border-slate-800"
                                    >
                                        <td className="px-4 py-4 text-slate-500">
                                            {index + 1}
                                        </td>

                                        <td className="px-4 py-4 font-semibold text-slate-900 dark:text-white">
                                            {item.item_description ||
                                                item.product_name ||
                                                "-"}
                                        </td>

                                        <td className="px-4 py-4 text-slate-600 dark:text-slate-300">
                                            {item.uom || "-"}
                                        </td>

                                        <td className="px-4 py-4 text-right font-semibold">
                                            {formatNumber(item.quantity_received)}
                                        </td>

                                        <td className="px-4 py-4 text-right">
                                            {formatCurrency(item.unit_cost)}
                                        </td>

                                        <td className="px-4 py-4 text-right font-bold text-slate-900 dark:text-white">
                                            {formatCurrency(item.line_total)}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    <div className="ml-auto mt-6 max-w-sm space-y-3">
                        <div className="flex justify-between text-sm text-slate-500">
                            <span>Total Quantity</span>

                            <span className="font-semibold text-slate-900 dark:text-white">
                                {formatNumber(
                                    currentReceipt.summary?.totalQuantity ??
                                    viewItems.reduce(
                                        (total, item) =>
                                            total + Number(item.quantity_received || 0),
                                        0
                                    )
                                )}
                            </span>
                        </div>

                        <div className="flex justify-between border-t border-slate-200 pt-3 dark:border-slate-700">
                            <span className="font-bold text-slate-900 dark:text-white">
                                Total Amount
                            </span>

                            <span className="text-xl font-bold text-blue-700 dark:text-blue-300">
                                {formatCurrency(
                                    currentReceipt.summary?.totalAmount ??
                                    viewItems.reduce(
                                        (total, item) =>
                                            total + Number(item.line_total || 0),
                                        0
                                    )
                                )}
                            </span>
                        </div>
                    </div>

                    {currentReceipt.remarks && (
                        <div className="mt-8 border-t border-slate-200 pt-5 dark:border-slate-700">
                            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                                Remarks
                            </p>

                            <p className="mt-2 text-sm text-slate-700 dark:text-slate-300">
                                {currentReceipt.remarks}
                            </p>
                        </div>
                    )}

                    {currentReceipt.posted_at && (
                        <div className="mt-5 rounded-xl bg-emerald-50 p-4 text-sm text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300">
                            <div className="flex items-center gap-2 font-bold">
                                <CheckCircle2 size={18} />
                                Inventory Posted
                            </div>

                            <p className="mt-1 text-xs">
                                Posted on {formatDate(currentReceipt.posted_at)}
                            </p>
                        </div>
                    )}
                </section>
            </main>
        );
    }

    // ========================================================
    // RECEIPT LIST
    // ========================================================

    return (
        <main className="min-h-screen space-y-6 p-4 sm:p-6 lg:p-8">

            {/* PAGE HEADER */}

            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div>
                    <div className="flex items-center gap-3">
                        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300">
                            <Package size={25} />
                        </div>

                        <div>
                            <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
                                Item Receipts
                            </h1>

                            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                                Manage physical goods received from suppliers.
                            </p>
                        </div>
                    </div>
                </div>

                <div className="flex flex-wrap gap-2">
                    <button
                        type="button"
                        onClick={fetchData}
                        disabled={loading}
                        className={SECONDARY_BUTTON}
                    >
                        <RefreshCw
                            size={17}
                            className={loading ? "animate-spin" : ""}
                        />
                        Refresh
                    </button>

                    {permissions.canCreate && (
                        <button
                            type="button"
                            onClick={openCreate}
                            className={PRIMARY_BUTTON}
                        >
                            <Plus size={18} />
                            Create Item Receipt
                        </button>
                    )}
                </div>
            </div>

            {/* ALERTS */}

            {error && (
                <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
                    <AlertCircle size={19} className="mt-0.5 shrink-0" />
                    <span>{error}</span>

                    <button
                        type="button"
                        onClick={() => setError("")}
                        className="ml-auto"
                    >
                        <X size={17} />
                    </button>
                </div>
            )}

            {message && (
                <div className="flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300">
                    <CheckCircle2 size={19} className="mt-0.5 shrink-0" />
                    <span>{message}</span>

                    <button
                        type="button"
                        onClick={() => setMessage("")}
                        className="ml-auto"
                    >
                        <X size={17} />
                    </button>
                </div>
            )}

            {/* SUMMARY CARDS */}

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <SummaryCard
                    title="Total Receipts"
                    value={summary.total}
                    description="All recorded Item Receipts"
                    icon={ClipboardList}
                    color="blue"
                />

                <SummaryCard
                    title="Draft Receipts"
                    value={summary.draft}
                    description="Awaiting approval"
                    icon={FileText}
                    color="amber"
                />

                <SummaryCard
                    title="Approved Receipts"
                    value={summary.approved}
                    description="Inventory posted"
                    icon={CheckCircle2}
                    color="emerald"
                />

                <SummaryCard
                    title="Total Received Quantity"
                    value={formatNumber(summary.totalQuantity)}
                    description="Quantity across all receipts"
                    icon={Boxes}
                    color="violet"
                />
            </div>

            {/* FILTERS */}

            <section className={`${CARD_CLASS} p-5`}>
                <div className="mb-4 flex items-center gap-2">
                    <Filter
                        size={19}
                        className="text-slate-500"
                    />

                    <h2 className="font-bold text-slate-900 dark:text-white">
                        Search and Filters
                    </h2>
                </div>

                <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                    <div className="relative">
                        <Search
                            size={18}
                            className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                        />

                        <input
                            className={`${INPUT_CLASS} pl-10`}
                            placeholder="Search receipt, supplier, warehouse..."
                            value={search}
                            onChange={(event) =>
                                setSearch(event.target.value)
                            }
                        />
                    </div>

                    <select
                        className={INPUT_CLASS}
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

                    <select
                        className={INPUT_CLASS}
                        value={sourceFilter}
                        onChange={(event) =>
                            setSourceFilter(event.target.value)
                        }
                    >
                        <option value="ALL">All Sources</option>
                        <option value="MANUAL">Manual</option>
                        <option value="PURCHASE_ORDER">Purchase Order</option>
                        <option value="PENDING_ITEM_RECEIPT">
                            Pending Item Receipt
                        </option>
                    </select>
                </div>
            </section>

            {/* RECEIPTS TABLE */}

            <section className={`${CARD_CLASS} overflow-hidden`}>
                <div className="flex flex-col gap-2 border-b border-slate-200 p-5 sm:flex-row sm:items-center sm:justify-between dark:border-slate-800">
                    <div>
                        <h2 className="font-bold text-slate-900 dark:text-white">
                            Item Receipt History
                        </h2>

                        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                            Showing {filteredReceipts.length} of {receipts.length} receipts
                        </p>
                    </div>

                    <span className="text-xs font-semibold text-slate-500">
                        {formatDate(getToday())}
                    </span>
                </div>

                {loading ? (
                    <div className="flex min-h-64 items-center justify-center gap-3 text-sm text-slate-500">
                        <LoaderCircle
                            size={22}
                            className="animate-spin text-blue-600"
                        />
                        Loading Item Receipts...
                    </div>
                ) : filteredReceipts.length === 0 ? (
                    <div className="flex min-h-72 flex-col items-center justify-center px-5 text-center">
                        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-100 text-slate-400 dark:bg-slate-800">
                            <Package size={30} />
                        </div>

                        <h3 className="mt-4 font-bold text-slate-900 dark:text-white">
                            No Item Receipts Found
                        </h3>

                        <p className="mt-2 max-w-sm text-sm text-slate-500 dark:text-slate-400">
                            No receipts match your current filters. Create a manual receipt or convert a Pending Item Receipt.
                        </p>

                        {permissions.canCreate && (
                            <button
                                type="button"
                                onClick={openCreate}
                                className={`${PRIMARY_BUTTON} mt-5`}
                            >
                                <Plus size={17} />
                                Create Item Receipt
                            </button>
                        )}
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full min-w-[1050px] text-left text-sm">
                            <thead>
                                <tr className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500 dark:border-slate-800 dark:bg-slate-950">
                                    <th className="px-5 py-4">Receipt Number</th>
                                    <th className="px-5 py-4">Supplier</th>
                                    <th className="px-5 py-4">Warehouse</th>
                                    <th className="px-5 py-4">Source</th>
                                    <th className="px-5 py-4">Receipt Date</th>
                                    <th className="px-5 py-4 text-right">Quantity</th>
                                    <th className="px-5 py-4">Status</th>
                                    <th className="px-5 py-4 text-right">Actions</th>
                                </tr>
                            </thead>

                            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                {filteredReceipts.map((receipt) => (
                                    <tr
                                        key={receipt.item_receipt_id}
                                        className="transition hover:bg-slate-50 dark:hover:bg-slate-800/40"
                                    >
                                        <td className="px-5 py-4">
                                            <button
                                                type="button"
                                                onClick={() => openView(receipt)}
                                                className="font-bold text-blue-700 hover:underline dark:text-blue-300"
                                            >
                                                {receipt.receipt_number}
                                            </button>

                                            <p className="mt-1 text-xs text-slate-400">
                                                {receipt.item_count || 0} items
                                            </p>
                                        </td>

                                        <td className="px-5 py-4">
                                            <span className="font-semibold text-slate-800 dark:text-slate-200">
                                                {receipt.supplier_name || "-"}
                                            </span>
                                        </td>

                                        <td className="px-5 py-4 text-slate-600 dark:text-slate-300">
                                            <div className="flex items-center gap-2">
                                                <Warehouse
                                                    size={15}
                                                    className="text-slate-400"
                                                />
                                                {receipt.warehouse_name || "-"}
                                            </div>
                                        </td>

                                        <td className="px-5 py-4">
                                            <span className="rounded-lg bg-slate-100 px-2.5 py-1.5 text-xs font-semibold text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                                                {getSourceLabel(receipt.source_type)}
                                            </span>

                                            {receipt.purchase_order_number && (
                                                <p className="mt-1 text-xs text-slate-500">
                                                    {receipt.purchase_order_number}
                                                </p>
                                            )}

                                            {receipt.pending_receipt_number && (
                                                <p className="mt-1 text-xs text-slate-500">
                                                    {receipt.pending_receipt_number}
                                                </p>
                                            )}
                                        </td>

                                        <td className="px-5 py-4 text-slate-600 dark:text-slate-300">
                                            {formatDate(receipt.receipt_date)}
                                        </td>

                                        <td className="px-5 py-4 text-right font-semibold text-slate-800 dark:text-white">
                                            {formatNumber(receipt.total_quantity)}
                                        </td>

                                        <td className="px-5 py-4">
                                            <StatusBadge status={receipt.status} />
                                        </td>

                                        <td className="px-5 py-4">
                                            <div className="flex items-center justify-end gap-1">
                                                <button
                                                    type="button"
                                                    onClick={() => openView(receipt)}
                                                    title="View"
                                                    className="rounded-lg p-2 text-blue-600 transition hover:bg-blue-50 dark:hover:bg-blue-950"
                                                >
                                                    <Eye size={17} />
                                                </button>

                                                {String(receipt.status).toUpperCase() === "DRAFT" &&
                                                    permissions.canUpdate && (
                                                        <>
                                                            <button
                                                                type="button"
                                                                onClick={() => openEdit(receipt)}
                                                                title="Edit"
                                                                className="rounded-lg p-2 text-amber-600 transition hover:bg-amber-50 dark:hover:bg-amber-950"
                                                            >
                                                                <Pencil size={17} />
                                                            </button>

                                                            <button
                                                                type="button"
                                                                onClick={() => approveReceipt(receipt)}
                                                                title="Approve and post inventory"
                                                                className="rounded-lg p-2 text-emerald-600 transition hover:bg-emerald-50 dark:hover:bg-emerald-950"
                                                            >
                                                                <CheckCircle2 size={18} />
                                                            </button>
                                                        </>
                                                    )}

                                                {String(receipt.status).toUpperCase() === "DRAFT" &&
                                                    permissions.canDelete && (
                                                        <button
                                                            type="button"
                                                            onClick={() => deleteReceipt(receipt)}
                                                            title="Delete"
                                                            className="rounded-lg p-2 text-red-600 transition hover:bg-red-50 dark:hover:bg-red-950"
                                                        >
                                                            <Trash2 size={17} />
                                                        </button>
                                                    )}
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </section>

            {/* FOOTER NOTE */}

            <div className="flex items-start gap-3 rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-800 dark:border-blue-900 dark:bg-blue-950/30 dark:text-blue-300">
                <ClipboardCheck size={20} className="mt-0.5 shrink-0" />

                <div>
                    <p className="font-bold">
                        Inventory posting policy
                    </p>

                    <p className="mt-1 text-xs leading-5">
                        Draft Item Receipts do not affect stock. When a receipt is approved, received quantities are added to the selected warehouse and recorded in the inventory ledger.
                    </p>
                </div>
            </div>

            {processing && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-[2px]">
                    <div className="flex items-center gap-3 rounded-2xl bg-white px-6 py-4 shadow-xl dark:bg-slate-900">
                        <LoaderCircle
                            size={22}
                            className="animate-spin text-blue-600"
                        />

                        <span className="text-sm font-semibold text-slate-800 dark:text-white">
                            Processing...
                        </span>
                    </div>
                </div>
            )}
        </main>
    );
}
