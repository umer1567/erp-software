
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

const emptyForm = {
    purchaseId: null,
    supplierId: "",
    warehouseId: "",
    purchaseDate: new Date().toISOString().slice(0, 10),
    sourceType: "MANUAL",
    itemReceiptId: "",
    discount: "0",
    tax: "0",
    notes: "",
    items: [],
};

const emptyItem = {
    productId: "",
    itemReceiptItemId: "",
    description: "",
    uom: "PCS",
    quantity: "1",
    unitCost: "0",
    discount: "0",
    tax: "0",
};

const inputClass =
    "w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:cursor-not-allowed disabled:bg-gray-100 disabled:opacity-70 dark:border-gray-700 dark:bg-gray-900 dark:text-white dark:focus:border-blue-500 dark:disabled:bg-gray-800";

const labelClass =
    "mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300";

const buttonClass =
    "inline-flex items-center justify-center rounded-lg px-4 py-2.5 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-50";

function money(value) {
    return Number(value || 0).toLocaleString("en-PK", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    });
}

function getArray(data, keys) {
    if (Array.isArray(data)) return data;

    for (const key of keys) {
        if (Array.isArray(data?.[key])) return data[key];
    }

    return [];
}

function getId(item, ...keys) {
    for (const key of keys) {
        if (item?.[key] !== undefined && item?.[key] !== null) {
            return String(item[key]);
        }
    }

    return "";
}

function normalizeProduct(product) {
    return {
        id: getId(product, "product_id", "id"),
        name: product.product_name || product.name || "Unnamed Product",
        sku: product.sku || "",
        unit: product.purchase_unit || product.unit || "PCS",
        cost: Number(
            product.cost_price ??
            product.purchase_price ??
            product.unit_cost ??
            0
        ),
        itemType: product.item_type || "Stock Item",
        active: product.is_active !== false,
    };
}

function normalizeReceiptItem(item) {
    return {
        productId: getId(item, "product_id"),
        itemReceiptItemId: getId(item, "item_receipt_item_id"),
        description:
            item.item_description ||
            item.product_name ||
            "",
        uom: item.uom || item.unit || "PCS",
        quantity: String(
            item.quantity_received ??
            item.quantity ??
            0
        ),
        unitCost: String(
            item.unit_cost ??
            item.unit_price ??
            0
        ),
        discount: "0",
        tax: "0",
    };
}

function normalizeInvoiceItem(item) {
    return {
        productId: getId(item, "product_id"),
        itemReceiptItemId: getId(item, "item_receipt_item_id"),
        description:
            item.item_description ||
            item.product_name ||
            "",
        uom: item.uom || "PCS",
        quantity: String(item.quantity ?? 1),
        unitCost: String(item.unit_cost ?? 0),
        discount: String(item.discount ?? 0),
        tax: String(item.tax ?? 0),
    };
}

function StatusBadge({ status }) {
    const value = String(status || "UNKNOWN").toUpperCase();

    const styles = {
        DRAFT:
            "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300",
        APPROVED:
            "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
        CANCELLED:
            "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300",
        UNPAID:
            "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300",
        PARTIAL:
            "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300",
        PAID:
            "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
    };

    return (
        <span
            className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${styles[value] ||
                "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300"
                }`}
        >
            {value}
        </span>
    );
}

export default function PurchaseInvoicesPage() {
    const [invoices, setInvoices] = useState([]);
    const [suppliers, setSuppliers] = useState([]);
    const [warehouses, setWarehouses] = useState([]);
    const [products, setProducts] = useState([]);
    const [receipts, setReceipts] = useState([]);

    const [form, setForm] = useState(emptyForm);
    const [search, setSearch] = useState("");
    const [statusFilter, setStatusFilter] = useState("ALL");

    const [loading, setLoading] = useState(true);
    const [permissionsLoading, setPermissionsLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [loadingReceipt, setLoadingReceipt] = useState(false);

    const [message, setMessage] = useState("");
    const [error, setError] = useState("");

    const [showForm, setShowForm] = useState(false);
    const [viewingInvoice, setViewingInvoice] = useState(null);
    const [isEditing, setIsEditing] = useState(false);

    // ========================================================
    // PURCHASE INVOICE USER RIGHTS
    // ========================================================

    const [permissions, setPermissions] = useState({
        can_view: false,
        can_create: false,
        can_update: false,
        can_delete: false,
    });

    const canView = permissions.can_view === true;
    const canCreate = permissions.can_create === true;
    const canUpdate = permissions.can_update === true;
    const canDelete = permissions.can_delete === true;

    // A new draft requires CREATE.
    // Updating an existing draft requires UPDATE.
    const canSaveForm = isEditing ? canUpdate : canCreate;

    // ========================================================
    // API HELPER
    // ========================================================

    const api = useCallback(async (url, options = {}) => {
        const response = await fetch(url, {
            ...options,
            cache: "no-store",
            headers: {
                "Content-Type": "application/json",
                ...(options.headers || {}),
            },
        });

        const data = await response.json().catch(() => ({}));

        if (!response.ok) {
            throw new Error(
                data.message ||
                data.error ||
                `Request failed (${response.status})`
            );
        }

        return data;
    }, []);

    // ========================================================
    // LOAD CURRENT USER'S PERMISSIONS AND PAGE DATA
    // ========================================================

    const loadData = useCallback(async () => {
        setLoading(true);
        setPermissionsLoading(true);
        setError("");
        setMessage("");

        try {
            // This endpoint returns permissions for the currently
            // authenticated user's role. No roleId is supplied here.
            const permissionData = await api(
                "/api/auth/my-permissions"
            );

            const permissionRows = getArray(
                permissionData,
                ["permissions"]
            );

            const purchasePermission = permissionRows.find(
                (item) =>
                    String(item.permission_key || "")
                        .trim()
                        .toLowerCase() === "purchase_invoices"
            );

            const currentPermissions = {
                can_view: purchasePermission?.can_view === true,
                can_create: purchasePermission?.can_create === true,
                can_update: purchasePermission?.can_update === true,
                can_delete: purchasePermission?.can_delete === true,
            };

            setPermissions(currentPermissions);
            setPermissionsLoading(false);

            // Do not load invoice data if the role cannot view this module.
            if (!currentPermissions.can_view) {
                setInvoices([]);
                setSuppliers([]);
                setWarehouses([]);
                setProducts([]);
                setReceipts([]);
                setLoading(false);
                setShowForm(false);
                setViewingInvoice(null);
                return;
            }

            const requests = await Promise.allSettled([
                api("/api/purchase-invoices"),
                api("/api/suppliers"),
                api("/api/warehouses"),
                api("/api/products"),
                api("/api/item-receipts"),
            ]);

            const [
                invoiceResult,
                supplierResult,
                warehouseResult,
                productResult,
                receiptResult,
            ] = requests;

            const getResponse = (result, endpoint) => {
                if (result.status === "fulfilled") {
                    return result.value;
                }

                console.error(
                    `Failed to load ${endpoint}:`,
                    result.reason
                );

                return null;
            };

            // PURCHASE INVOICES
            const invoiceData = getResponse(
                invoiceResult,
                "purchase invoices"
            );

            if (invoiceData) {
                setInvoices(
                    getArray(invoiceData, [
                        "invoices",
                        "purchases",
                    ])
                );
            } else {
                setInvoices([]);
            }

            // SUPPLIERS
            const supplierData = getResponse(
                supplierResult,
                "suppliers"
            );

            if (supplierData) {
                const supplierList = getArray(
                    supplierData,
                    ["suppliers"]
                );

                setSuppliers(
                    supplierList.filter(
                        (supplier) => supplier.is_active !== false
                    )
                );
            } else {
                setSuppliers([]);
            }

            // WAREHOUSES
            const warehouseData = getResponse(
                warehouseResult,
                "warehouses"
            );

            if (warehouseData) {
                const warehouseList = getArray(
                    warehouseData,
                    ["warehouses"]
                );

                setWarehouses(
                    warehouseList.filter(
                        (warehouse) => warehouse.is_active !== false
                    )
                );
            } else {
                setWarehouses([]);
            }

            // PRODUCTS
            const productData = getResponse(
                productResult,
                "products"
            );

            if (productData) {
                const productList = getArray(
                    productData,
                    ["products"]
                );

                setProducts(
                    productList
                        .map(normalizeProduct)
                        .filter((product) => product.active)
                );
            } else {
                setProducts([]);
            }

            // APPROVED ITEM RECEIPTS
            const receiptData = getResponse(
                receiptResult,
                "item receipts"
            );

            if (receiptData) {
                const receiptList = getArray(receiptData, [
                    "receipts",
                    "itemReceipts",
                    "item_receipts",
                ]);

                setReceipts(
                    receiptList.filter(
                        (receipt) =>
                            String(
                                receipt.status ??
                                receipt.document_status ??
                                ""
                            )
                                .trim()
                                .toUpperCase() === "APPROVED"
                    )
                );
            } else {
                setReceipts([]);
            }

            const failedEndpoints = requests
                .map((result, index) => {
                    if (result.status === "fulfilled") {
                        return null;
                    }

                    return [
                        "Purchase Invoices",
                        "Suppliers",
                        "Warehouses",
                        "Products",
                        "Item Receipts",
                    ][index];
                })
                .filter(Boolean);

            if (failedEndpoints.length > 0) {
                setError(
                    `Some data could not be loaded: ${failedEndpoints.join(", ")}. Check the browser console.`
                );
            }
        } catch (err) {
            console.error(
                "PURCHASE INVOICE DATA / PERMISSION ERROR:",
                err
            );

            setPermissions({
                can_view: false,
                can_create: false,
                can_update: false,
                can_delete: false,
            });

            setInvoices([]);
            setSuppliers([]);
            setWarehouses([]);
            setProducts([]);
            setReceipts([]);

            setError(
                err.message ||
                "Failed to load Purchase Invoice permissions."
            );
        } finally {
            setPermissionsLoading(false);
            setLoading(false);
        }
    }, [api]);

    useEffect(() => {
        let isActive = true;

        const loadInitialData = async () => {
            if (!isActive) return;

            await loadData();
        };

        // Defer execution until after the effect has completed.
        const task = Promise.resolve().then(loadInitialData);

        return () => {
            isActive = false;
        };
    }, [loadData]);

    // ========================================================
    // FORM HELPERS
    // ========================================================

    function updateForm(field, value) {
        setForm((previous) => ({
            ...previous,
            [field]: value,
        }));
    }

    function updateItem(index, field, value) {
        if (!canSaveForm) return;

        setForm((previous) => ({
            ...previous,
            items: previous.items.map((item, itemIndex) =>
                itemIndex === index
                    ? { ...item, [field]: value }
                    : item
            ),
        }));
    }

    function addItem() {
        if (!canSaveForm || form.sourceType !== "MANUAL") {
            return;
        }

        setForm((previous) => ({
            ...previous,
            items: [
                ...previous.items,
                { ...emptyItem },
            ],
        }));
    }

    function removeItem(index) {
        if (!canSaveForm || form.sourceType !== "MANUAL") {
            return;
        }

        setForm((previous) => ({
            ...previous,
            items: previous.items.filter(
                (_, itemIndex) => itemIndex !== index
            ),
        }));
    }

    function selectProduct(index, productId) {
        if (!canSaveForm) return;

        const product = products.find(
            (item) => item.id === String(productId)
        );

        if (!product) {
            updateItem(index, "productId", "");
            return;
        }

        setForm((previous) => ({
            ...previous,
            items: previous.items.map((item, itemIndex) =>
                itemIndex === index
                    ? {
                        ...item,
                        productId: product.id,
                        description: product.name,
                        uom: product.unit,
                        unitCost: String(product.cost),
                    }
                    : item
            ),
        }));
    }

    // ========================================================
    // ITEM TOTALS
    // ========================================================

    function getLineTotal(item) {
        const quantity = Number(item.quantity || 0);
        const unitCost = Number(item.unitCost || 0);
        const discount = Number(item.discount || 0);
        const tax = Number(item.tax || 0);

        return quantity * unitCost - discount + tax;
    }

    const subtotal = useMemo(
        () =>
            form.items.reduce(
                (total, item) => total + getLineTotal(item),
                0
            ),
        [form.items]
    );

    const grandTotal =
        subtotal -
        Number(form.discount || 0) +
        Number(form.tax || 0);

    // ========================================================
    // RESET AND OPEN FORM
    // ========================================================

    function openNewInvoice() {
        if (!canCreate) {
            setError(
                "You do not have permission to create Purchase Invoices."
            );
            return;
        }

        setForm({
            ...emptyForm,
            purchaseDate: new Date().toISOString().slice(0, 10),
            items: [{ ...emptyItem }],
        });

        setIsEditing(false);
        setViewingInvoice(null);
        setShowForm(true);
        setMessage("");
        setError("");
    }

    function closeForm() {
        setShowForm(false);
        setIsEditing(false);
        setViewingInvoice(null);
        setForm(emptyForm);
    }

    // ========================================================
    // LOAD ITEM RECEIPT DETAILS
    // ========================================================

    async function selectReceipt(receiptId) {
        if (!canSaveForm) return;

        updateForm("itemReceiptId", receiptId);

        if (!receiptId) {
            setForm((previous) => ({
                ...previous,
                itemReceiptId: "",
                supplierId: "",
                warehouseId: "",
                items: [{ ...emptyItem }],
            }));

            return;
        }

        setLoadingReceipt(true);
        setError("");

        try {
            const receiptData = await api(
                `/api/item-receipts/${receiptId}`
            );

            const receipt =
                receiptData.receipt ||
                receiptData.itemReceipt ||
                receiptData;

            const receiptItems = getArray(receiptData, [
                "items",
                "receiptItems",
                "item_receipt_items",
            ]);

            if (!receiptItems.length) {
                throw new Error(
                    "No receipt items were returned. Check the Item Receipt GET API response."
                );
            }

            const supplierId = getId(
                receipt,
                "supplier_id",
                "supplierId"
            );

            const warehouseId = getId(
                receipt,
                "warehouse_id",
                "warehouseId"
            );

            setForm((previous) => ({
                ...previous,
                sourceType: "ITEM_RECEIPT",
                itemReceiptId: String(receiptId),
                supplierId,
                warehouseId,
                items: receiptItems.map(normalizeReceiptItem),
            }));
        } catch (err) {
            setError(
                `Could not load Item Receipt: ${err.message}`
            );
        } finally {
            setLoadingReceipt(false);
        }
    }

    // ========================================================
    // SAVE DRAFT
    // ========================================================

    async function saveInvoice(event) {
        event.preventDefault();

        if (!canSaveForm) {
            setError(
                isEditing
                    ? "You do not have permission to update Purchase Invoices."
                    : "You do not have permission to create Purchase Invoices."
            );
            return;
        }

        setError("");
        setMessage("");

        if (!form.supplierId || !form.warehouseId) {
            setError("Select a supplier and warehouse.");
            return;
        }

        if (form.items.length === 0) {
            setError("Add at least one invoice item.");
            return;
        }

        for (let index = 0; index < form.items.length; index++) {
            const item = form.items[index];

            if (!item.productId) {
                setError(`Select a product on line ${index + 1}.`);
                return;
            }

            if (Number(item.quantity) <= 0) {
                setError(`Enter a valid quantity on line ${index + 1}.`);
                return;
            }

            if (
                Number(item.unitCost) < 0 ||
                Number(item.discount) < 0 ||
                Number(item.tax) < 0
            ) {
                setError(
                    `Cost, discount and tax cannot be negative on line ${index + 1}.`
                );
                return;
            }

            if (getLineTotal(item) < 0) {
                setError(
                    `Line total cannot be negative on line ${index + 1}.`
                );
                return;
            }

            if (
                form.sourceType === "ITEM_RECEIPT" &&
                !item.itemReceiptItemId
            ) {
                setError(
                    `Receipt reference is missing on line ${index + 1}.`
                );
                return;
            }
        }

        if (
            Number(form.discount) < 0 ||
            Number(form.tax) < 0
        ) {
            setError("Invoice discount and tax cannot be negative.");
            return;
        }

        if (grandTotal < 0) {
            setError("Invoice total cannot be negative.");
            return;
        }

        const payload = {
            purchaseId: form.purchaseId,
            supplierId: Number(form.supplierId),
            warehouseId: Number(form.warehouseId),
            purchaseDate: form.purchaseDate,
            sourceType: form.sourceType,
            itemReceiptId:
                form.sourceType === "ITEM_RECEIPT"
                    ? Number(form.itemReceiptId)
                    : null,
            discount: Number(form.discount || 0),
            tax: Number(form.tax || 0),
            notes: form.notes,
            items: form.items.map((item) => ({
                productId: Number(item.productId),
                itemReceiptItemId:
                    form.sourceType === "ITEM_RECEIPT"
                        ? Number(item.itemReceiptItemId)
                        : null,
                itemDescription: item.description,
                uom: item.uom,
                quantity: Number(item.quantity),
                unitCost: Number(item.unitCost),
                discount: Number(item.discount || 0),
                tax: Number(item.tax || 0),
            })),
        };

        setSaving(true);

        try {
            const result = await api(
                "/api/purchase-invoices",
                {
                    method: isEditing ? "PUT" : "POST",
                    body: JSON.stringify(payload),
                }
            );

            setMessage(
                result.message ||
                "Purchase Invoice saved successfully."
            );

            closeForm();
            await loadData();
        } catch (err) {
            setError(err.message);
        } finally {
            setSaving(false);
        }
    }

    // ========================================================
    // EDIT INVOICE
    // ========================================================

    async function editInvoice(purchaseId) {
        if (!canUpdate) {
            setError(
                "You do not have permission to update Purchase Invoices."
            );
            return;
        }

        setError("");
        setMessage("");

        try {
            const result = await api(
                `/api/purchase-invoices?id=${purchaseId}`
            );

            const invoice = result.invoice;
            const items = result.items || [];

            if (!invoice) {
                throw new Error("Purchase Invoice was not found.");
            }

            if (invoice.document_status !== "DRAFT") {
                throw new Error("Only draft invoices can be edited.");
            }

            setForm({
                purchaseId: invoice.purchase_id,
                supplierId: String(invoice.supplier_id),
                warehouseId: String(invoice.warehouse_id),
                purchaseDate: String(
                    invoice.purchase_date
                ).slice(0, 10),
                sourceType: invoice.source_type || "MANUAL",
                itemReceiptId: invoice.item_receipt_id
                    ? String(invoice.item_receipt_id)
                    : "",
                discount: String(invoice.discount || 0),
                tax: String(invoice.tax || 0),
                notes: invoice.notes || "",
                items: items.map(normalizeInvoiceItem),
            });

            setIsEditing(true);
            setShowForm(true);
            setViewingInvoice(null);
        } catch (err) {
            setError(err.message);
        }
    }

    // ========================================================
    // VIEW INVOICE
    // ========================================================

    async function viewInvoice(purchaseId) {
        if (!canView) {
            setError(
                "You do not have permission to view Purchase Invoices."
            );
            return;
        }

        setError("");

        try {
            const result = await api(
                `/api/purchase-invoices?id=${purchaseId}`
            );

            if (!result.invoice) {
                throw new Error("Purchase Invoice was not found.");
            }

            setViewingInvoice({
                ...result.invoice,
                items: result.items || [],
            });

            setShowForm(false);
        } catch (err) {
            setError(err.message);
        }
    }

    // ========================================================
    // APPROVE INVOICE
    // Approval requires UPDATE permission.
    // ========================================================

    async function approveInvoice(invoice) {
        if (!canUpdate) {
            setError(
                "You do not have permission to approve Purchase Invoices."
            );
            return;
        }

        if (invoice.document_status !== "DRAFT") {
            setError("Only draft invoices can be approved.");
            return;
        }

        const confirmed = window.confirm(
            `Approve Purchase Invoice ${invoice.purchase_number}?\n\n` +
            "This will post accounting entries and, for manual invoices, update stock."
        );

        if (!confirmed) return;

        setError("");
        setMessage("");
        setSaving(true);

        try {
            const result = await api(
                `/api/purchase-invoices/${invoice.purchase_id}/approve`,
                {
                    method: "POST",
                    body: JSON.stringify({}),
                }
            );

            setMessage(
                result.message ||
                "Purchase Invoice approved successfully."
            );

            await loadData();
        } catch (err) {
            setError(err.message);
        } finally {
            setSaving(false);
        }
    }

    // ========================================================
    // DELETE DRAFT
    // ========================================================

    async function deleteInvoice(invoice) {
        if (!canDelete) {
            setError(
                "You do not have permission to delete Purchase Invoices."
            );
            return;
        }

        if (invoice.document_status !== "DRAFT") {
            setError("Only draft invoices can be deleted.");
            return;
        }

        const confirmed = window.confirm(
            `Delete Purchase Invoice ${invoice.purchase_number}?`
        );

        if (!confirmed) return;

        setError("");
        setMessage("");
        setSaving(true);

        try {
            const result = await api(
                `/api/purchase-invoices?id=${invoice.purchase_id}`,
                {
                    method: "DELETE",
                }
            );

            setMessage(
                result.message ||
                "Purchase Invoice deleted successfully."
            );

            await loadData();
        } catch (err) {
            setError(err.message);
        } finally {
            setSaving(false);
        }
    }

    // ========================================================
    // FILTER INVOICES
    // ========================================================

    const filteredInvoices = useMemo(() => {
        return invoices.filter((invoice) => {
            const text = [
                invoice.purchase_number,
                invoice.supplier_name,
                invoice.warehouse_name,
                invoice.receipt_number,
            ]
                .join(" ")
                .toLowerCase();

            const matchesSearch = text.includes(
                search.toLowerCase()
            );

            const matchesStatus =
                statusFilter === "ALL" ||
                invoice.document_status === statusFilter;

            return matchesSearch && matchesStatus;
        });
    }, [invoices, search, statusFilter]);

    const draftCount = invoices.filter(
        (item) => item.document_status === "DRAFT"
    ).length;

    const approvedCount = invoices.filter(
        (item) => item.document_status === "APPROVED"
    ).length;

    const totalValue = invoices
        .filter((item) => item.document_status === "APPROVED")
        .reduce(
            (total, item) =>
                total + Number(item.total_amount || 0),
            0
        );

    // ========================================================
    // PAGE
    // ========================================================

    if (permissionsLoading || loading) {
        return (
            <div className="flex min-h-screen items-center justify-center bg-gray-50 p-6 dark:bg-gray-950">
                <div className="text-center">
                    <div className="mx-auto mb-3 h-9 w-9 animate-spin rounded-full border-4 border-blue-200 border-t-blue-600" />
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                        Loading Purchase Invoice permissions...
                    </p>
                </div>
            </div>
        );
    }

    // A user without VIEW permission cannot access the page.
    if (!canView) {
        return (
            <div className="min-h-screen bg-gray-50 p-6 dark:bg-gray-950">
                <div className="mx-auto max-w-2xl rounded-xl border border-red-200 bg-white p-8 text-center dark:border-red-900 dark:bg-gray-900">
                    <div className="mb-3 text-4xl">🔒</div>

                    <h1 className="text-xl font-bold text-gray-900 dark:text-white">
                        Access Restricted
                    </h1>

                    <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
                        You do not have permission to view Purchase Invoices.
                        Please contact your administrator.
                    </p>

                    {error && (
                        <p className="mt-4 text-sm text-red-600 dark:text-red-400">
                            {error}
                        </p>
                    )}

                    <button
                        type="button"
                        onClick={loadData}
                        className={`${buttonClass} mt-5 bg-blue-600 text-white hover:bg-blue-700`}
                    >
                        Retry
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50 p-4 dark:bg-gray-950 sm:p-6">
            <div className="mx-auto max-w-7xl space-y-6">

                {/* HEADER */}

                <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                            Purchase Invoices
                        </h1>

                        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                            Manage supplier invoices, drafts and approvals.
                        </p>
                    </div>

                    <div className="flex flex-wrap gap-2">
                        <button
                            type="button"
                            onClick={loadData}
                            disabled={loading || saving}
                            className={`${buttonClass} border border-gray-300 bg-white text-gray-700 hover:bg-gray-100 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200`}
                        >
                            ↻ Refresh
                        </button>

                        {canCreate && (
                            <button
                                type="button"
                                onClick={openNewInvoice}
                                className={`${buttonClass} bg-blue-600 text-white hover:bg-blue-700`}
                            >
                                + Create Purchase Invoice
                            </button>
                        )}
                    </div>
                </div>

                {/* ALERTS */}

                {error && (
                    <div className="flex items-start justify-between gap-3 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
                        <span>{error}</span>

                        <button
                            type="button"
                            onClick={() => setError("")}
                            className="font-bold"
                        >
                            ×
                        </button>
                    </div>
                )}

                {message && (
                    <div className="flex items-start justify-between gap-3 rounded-lg border border-green-200 bg-green-50 p-4 text-sm text-green-700 dark:border-green-900 dark:bg-green-950/40 dark:text-green-300">
                        <span>{message}</span>

                        <button
                            type="button"
                            onClick={() => setMessage("")}
                            className="font-bold"
                        >
                            ×
                        </button>
                    </div>
                )}

                {/* SUMMARY */}

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    <div className="rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                            Total Invoices
                        </p>
                        <p className="mt-2 text-2xl font-bold text-gray-900 dark:text-white">
                            {invoices.length}
                        </p>
                    </div>

                    <div className="rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                            Draft Invoices
                        </p>
                        <p className="mt-2 text-2xl font-bold text-yellow-600">
                            {draftCount}
                        </p>
                    </div>

                    <div className="rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                            Approved Invoices
                        </p>
                        <p className="mt-2 text-2xl font-bold text-green-600">
                            {approvedCount}
                        </p>
                    </div>

                    <div className="rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                            Approved Invoice Value
                        </p>
                        <p className="mt-2 text-xl font-bold text-gray-900 dark:text-white">
                            Rs. {money(totalValue)}
                        </p>
                    </div>
                </div>

                {/* INVOICE FORM */}

                {showForm && (
                    <form
                        onSubmit={saveInvoice}
                        className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900"
                    >
                        <div className="flex flex-col justify-between gap-3 border-b border-gray-200 p-5 dark:border-gray-800 sm:flex-row sm:items-center">
                            <div>
                                <h2 className="text-lg font-bold text-gray-900 dark:text-white">
                                    {isEditing
                                        ? "Edit Purchase Invoice"
                                        : "Create Purchase Invoice"}
                                </h2>

                                <p className="mt-1 text-xs text-gray-500">
                                    New invoices are saved as drafts.
                                </p>
                            </div>

                            <StatusBadge status="DRAFT" />
                        </div>

                        <div className="space-y-6 p-5">

                            {/* BASIC DETAILS */}

                            <div>
                                <h3 className="mb-4 text-sm font-semibold text-gray-900 dark:text-white">
                                    Invoice Information
                                </h3>

                                <div className="grid grid-cols-1 gap-4 md:grid-cols-3">

                                    <div>
                                        <label className={labelClass}>
                                            Invoice Number
                                        </label>

                                        <input
                                            value={
                                                isEditing
                                                    ? invoices.find(
                                                        (item) =>
                                                            Number(item.purchase_id) ===
                                                            Number(form.purchaseId)
                                                    )?.purchase_number || "Existing Invoice"
                                                    : "AUTO GENERATED"
                                            }
                                            readOnly
                                            className={`${inputClass} bg-gray-100 dark:bg-gray-800`}
                                        />
                                    </div>

                                    <div>
                                        <label className={labelClass}>
                                            Invoice Date *
                                        </label>

                                        <input
                                            type="date"
                                            required
                                            value={form.purchaseDate}
                                            disabled={!canSaveForm}
                                            onChange={(event) =>
                                                updateForm(
                                                    "purchaseDate",
                                                    event.target.value
                                                )
                                            }
                                            className={inputClass}
                                        />
                                    </div>

                                    <div>
                                        <label className={labelClass}>
                                            Invoice Source *
                                        </label>

                                        <select
                                            value={form.sourceType}
                                            disabled={!canSaveForm || isEditing}
                                            onChange={(event) => {
                                                const sourceType =
                                                    event.target.value;

                                                setForm((previous) => ({
                                                    ...previous,
                                                    sourceType,
                                                    itemReceiptId: "",
                                                    items: [{ ...emptyItem }],
                                                }));
                                            }}
                                            className={inputClass}
                                        >
                                            <option value="MANUAL">
                                                Manual Invoice
                                            </option>

                                            <option value="ITEM_RECEIPT">
                                                From Item Receipt
                                            </option>
                                        </select>
                                    </div>

                                    {form.sourceType === "ITEM_RECEIPT" && (
                                        <div className="md:col-span-3">
                                            <label className={labelClass}>
                                                Approved Item Receipt *
                                            </label>

                                            <select
                                                value={form.itemReceiptId}
                                                onChange={(event) =>
                                                    selectReceipt(event.target.value)
                                                }
                                                disabled={!canSaveForm || isEditing}
                                                required
                                                className={inputClass}
                                            >
                                                <option value="">
                                                    Select Approved Item Receipt
                                                </option>

                                                {receipts.map((receipt) => (
                                                    <option
                                                        key={receipt.item_receipt_id}
                                                        value={receipt.item_receipt_id}
                                                    >
                                                        {receipt.receipt_number ||
                                                            `Receipt #${receipt.item_receipt_id}`}
                                                    </option>
                                                ))}
                                            </select>

                                            <p className="mt-1 text-xs text-gray-500">
                                                Receipt-based invoices do not increase stock again.
                                            </p>
                                        </div>
                                    )}

                                    <div>
                                        <label className={labelClass}>
                                            Supplier *
                                        </label>

                                        <select
                                            required
                                            value={form.supplierId}
                                            onChange={(event) =>
                                                updateForm(
                                                    "supplierId",
                                                    event.target.value
                                                )
                                            }
                                            disabled={
                                                !canSaveForm ||
                                                form.sourceType === "ITEM_RECEIPT"
                                            }
                                            className={inputClass}
                                        >
                                            <option value="">
                                                Select Supplier
                                            </option>

                                            {suppliers.map((supplier) => (
                                                <option
                                                    key={supplier.supplier_id}
                                                    value={supplier.supplier_id}
                                                >
                                                    {supplier.supplier_name}
                                                </option>
                                            ))}
                                        </select>
                                    </div>

                                    <div>
                                        <label className={labelClass}>
                                            Warehouse *
                                        </label>

                                        <select
                                            required
                                            value={form.warehouseId}
                                            onChange={(event) =>
                                                updateForm(
                                                    "warehouseId",
                                                    event.target.value
                                                )
                                            }
                                            disabled={
                                                !canSaveForm ||
                                                form.sourceType === "ITEM_RECEIPT"
                                            }
                                            className={inputClass}
                                        >
                                            <option value="">
                                                Select Warehouse
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
                                    </div>

                                </div>
                            </div>

                            {/* ITEMS */}

                            <div>
                                <div className="mb-4 flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
                                    <div>
                                        <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
                                            Invoice Items
                                        </h3>

                                        <p className="mt-1 text-xs text-gray-500">
                                            Add products and enter purchase quantities and costs.
                                        </p>
                                    </div>

                                    {form.sourceType === "MANUAL" && canSaveForm && (
                                        <button
                                            type="button"
                                            onClick={addItem}
                                            className={`${buttonClass} bg-blue-50 text-blue-700 hover:bg-blue-100 dark:bg-blue-950/40 dark:text-blue-300`}
                                        >
                                            + Add Item
                                        </button>
                                    )}
                                </div>

                                {loadingReceipt && (
                                    <p className="mb-3 text-sm text-blue-600">
                                        Loading receipt items...
                                    </p>
                                )}

                                <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-800">
                                    <table className="w-full min-w-[1050px] text-left text-sm">
                                        <thead className="bg-gray-50 text-xs uppercase text-gray-600 dark:bg-gray-800 dark:text-gray-300">
                                            <tr>
                                                <th className="px-3 py-3">#</th>
                                                <th className="px-3 py-3">Product</th>
                                                <th className="px-3 py-3">Description</th>
                                                <th className="px-3 py-3">UOM</th>
                                                <th className="px-3 py-3">Quantity</th>
                                                <th className="px-3 py-3">Unit Cost</th>
                                                <th className="px-3 py-3">Discount</th>
                                                <th className="px-3 py-3">Tax</th>
                                                <th className="px-3 py-3">Line Total</th>
                                                {form.sourceType === "MANUAL" && canSaveForm && (
                                                    <th className="px-3 py-3">Action</th>
                                                )}
                                            </tr>
                                        </thead>

                                        <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                                            {form.items.map((item, index) => (
                                                <tr key={`${index}-${item.itemReceiptItemId}`}>
                                                    <td className="px-3 py-3 text-gray-500">
                                                        {index + 1}
                                                    </td>

                                                    <td className="px-3 py-3">
                                                        {form.sourceType === "MANUAL" ? (
                                                            <select
                                                                required
                                                                value={item.productId}
                                                                disabled={!canSaveForm}
                                                                onChange={(event) =>
                                                                    selectProduct(
                                                                        index,
                                                                        event.target.value
                                                                    )
                                                                }
                                                                className={`${inputClass} min-w-[180px]`}
                                                            >
                                                                <option value="">
                                                                    Select Product
                                                                </option>

                                                                {products.map((product) => (
                                                                    <option
                                                                        key={product.id}
                                                                        value={product.id}
                                                                    >
                                                                        {product.name}
                                                                        {product.sku
                                                                            ? ` (${product.sku})`
                                                                            : ""}
                                                                    </option>
                                                                ))}
                                                            </select>
                                                        ) : (
                                                            <div className="min-w-[160px] font-medium text-gray-800 dark:text-gray-200">
                                                                {item.description}
                                                            </div>
                                                        )}
                                                    </td>

                                                    <td className="px-3 py-3">
                                                        <input
                                                            value={item.description}
                                                            disabled={!canSaveForm}
                                                            onChange={(event) =>
                                                                updateItem(
                                                                    index,
                                                                    "description",
                                                                    event.target.value
                                                                )
                                                            }
                                                            className={`${inputClass} min-w-[150px]`}
                                                        />
                                                    </td>

                                                    <td className="px-3 py-3">
                                                        <input
                                                            value={item.uom}
                                                            disabled={!canSaveForm}
                                                            onChange={(event) =>
                                                                updateItem(
                                                                    index,
                                                                    "uom",
                                                                    event.target.value
                                                                )
                                                            }
                                                            className={`${inputClass} w-20`}
                                                        />
                                                    </td>

                                                    <td className="px-3 py-3">
                                                        <input
                                                            type="number"
                                                            min="0.000001"
                                                            step="any"
                                                            required
                                                            value={item.quantity}
                                                            disabled={
                                                                !canSaveForm ||
                                                                form.sourceType === "ITEM_RECEIPT"
                                                            }
                                                            onChange={(event) =>
                                                                updateItem(
                                                                    index,
                                                                    "quantity",
                                                                    event.target.value
                                                                )
                                                            }
                                                            className={`${inputClass} w-24`}
                                                        />
                                                    </td>

                                                    <td className="px-3 py-3">
                                                        <input
                                                            type="number"
                                                            min="0"
                                                            step="any"
                                                            value={item.unitCost}
                                                            disabled={!canSaveForm}
                                                            onChange={(event) =>
                                                                updateItem(
                                                                    index,
                                                                    "unitCost",
                                                                    event.target.value
                                                                )
                                                            }
                                                            className={`${inputClass} w-28`}
                                                        />
                                                    </td>

                                                    <td className="px-3 py-3">
                                                        <input
                                                            type="number"
                                                            min="0"
                                                            step="any"
                                                            value={item.discount}
                                                            disabled={!canSaveForm}
                                                            onChange={(event) =>
                                                                updateItem(
                                                                    index,
                                                                    "discount",
                                                                    event.target.value
                                                                )
                                                            }
                                                            className={`${inputClass} w-24`}
                                                        />
                                                    </td>

                                                    <td className="px-3 py-3">
                                                        <input
                                                            type="number"
                                                            min="0"
                                                            step="any"
                                                            value={item.tax}
                                                            disabled={!canSaveForm}
                                                            onChange={(event) =>
                                                                updateItem(
                                                                    index,
                                                                    "tax",
                                                                    event.target.value
                                                                )
                                                            }
                                                            className={`${inputClass} w-24`}
                                                        />
                                                    </td>

                                                    <td className="whitespace-nowrap px-3 py-3 font-semibold text-gray-900 dark:text-white">
                                                        {money(getLineTotal(item))}
                                                    </td>

                                                    {form.sourceType === "MANUAL" && canSaveForm && (
                                                        <td className="px-3 py-3">
                                                            <button
                                                                type="button"
                                                                onClick={() =>
                                                                    removeItem(index)
                                                                }
                                                                className="rounded-md px-3 py-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30"
                                                            >
                                                                Remove
                                                            </button>
                                                        </td>
                                                    )}
                                                </tr>
                                            ))}

                                            {form.items.length === 0 && (
                                                <tr>
                                                    <td
                                                        colSpan={10}
                                                        className="px-4 py-10 text-center text-gray-500"
                                                    >
                                                        No items added.
                                                    </td>
                                                </tr>
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </div>

                            {/* TOTALS */}

                            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">

                                <div>
                                    <label className={labelClass}>
                                        Notes
                                    </label>

                                    <textarea
                                        rows={4}
                                        value={form.notes}
                                        disabled={!canSaveForm}
                                        onChange={(event) =>
                                            updateForm(
                                                "notes",
                                                event.target.value
                                            )
                                        }
                                        placeholder="Enter invoice notes..."
                                        className={inputClass}
                                    />
                                </div>

                                <div className="rounded-xl border border-gray-200 bg-gray-50 p-5 dark:border-gray-800 dark:bg-gray-950">
                                    <div className="space-y-3">
                                        <div className="flex justify-between text-sm">
                                            <span className="text-gray-600 dark:text-gray-400">
                                                Subtotal
                                            </span>

                                            <span className="font-medium text-gray-900 dark:text-white">
                                                Rs. {money(subtotal)}
                                            </span>
                                        </div>

                                        <div className="flex items-center justify-between gap-4">
                                            <label className="text-sm text-gray-600 dark:text-gray-400">
                                                Invoice Discount
                                            </label>

                                            <input
                                                type="number"
                                                min="0"
                                                step="any"
                                                value={form.discount}
                                                disabled={!canSaveForm}
                                                onChange={(event) =>
                                                    updateForm(
                                                        "discount",
                                                        event.target.value
                                                    )
                                                }
                                                className={`${inputClass} max-w-[150px] text-right`}
                                            />
                                        </div>

                                        <div className="flex items-center justify-between gap-4">
                                            <label className="text-sm text-gray-600 dark:text-gray-400">
                                                Additional Tax
                                            </label>

                                            <input
                                                type="number"
                                                min="0"
                                                step="any"
                                                value={form.tax}
                                                disabled={!canSaveForm}
                                                onChange={(event) =>
                                                    updateForm(
                                                        "tax",
                                                        event.target.value
                                                    )
                                                }
                                                className={`${inputClass} max-w-[150px] text-right`}
                                            />
                                        </div>

                                        <div className="border-t border-gray-200 pt-3 dark:border-gray-700">
                                            <div className="flex justify-between">
                                                <span className="font-bold text-gray-900 dark:text-white">
                                                    Grand Total
                                                </span>

                                                <span className="text-xl font-bold text-blue-600">
                                                    Rs. {money(grandTotal)}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* FORM BUTTONS */}

                            <div className="flex flex-wrap justify-end gap-3 border-t border-gray-200 pt-5 dark:border-gray-800">
                                <button
                                    type="button"
                                    onClick={closeForm}
                                    disabled={saving}
                                    className={`${buttonClass} border border-gray-300 bg-white text-gray-700 hover:bg-gray-100 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200`}
                                >
                                    Cancel
                                </button>

                                {canSaveForm && (
                                    <button
                                        type="submit"
                                        disabled={saving || loadingReceipt}
                                        className={`${buttonClass} bg-blue-600 text-white hover:bg-blue-700`}
                                    >
                                        {saving
                                            ? "Saving..."
                                            : isEditing
                                                ? "Update Draft"
                                                : "Save Draft"}
                                    </button>
                                )}
                            </div>

                        </div>
                    </form>
                )}

                {/* VIEW INVOICE */}

                {viewingInvoice && (
                    <div className="rounded-xl border border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900">
                        <div className="flex flex-col justify-between gap-3 border-b border-gray-200 p-5 dark:border-gray-800 sm:flex-row sm:items-center">
                            <div>
                                <h2 className="text-lg font-bold text-gray-900 dark:text-white">
                                    {viewingInvoice.purchase_number}
                                </h2>

                                <p className="text-sm text-gray-500">
                                    Purchase Invoice Details
                                </p>
                            </div>

                            <button
                                type="button"
                                onClick={() => setViewingInvoice(null)}
                                className={`${buttonClass} border border-gray-300 text-gray-700 dark:border-gray-700 dark:text-gray-200`}
                            >
                                Close
                            </button>
                        </div>

                        <div className="grid grid-cols-1 gap-4 p-5 sm:grid-cols-3">
                            <div>
                                <p className="text-xs text-gray-500">
                                    Supplier
                                </p>
                                <p className="mt-1 font-semibold text-gray-900 dark:text-white">
                                    {viewingInvoice.supplier_name}
                                </p>
                            </div>

                            <div>
                                <p className="text-xs text-gray-500">
                                    Warehouse
                                </p>
                                <p className="mt-1 font-semibold text-gray-900 dark:text-white">
                                    {viewingInvoice.warehouse_name}
                                </p>
                            </div>

                            <div>
                                <p className="text-xs text-gray-500">
                                    Invoice Date
                                </p>
                                <p className="mt-1 font-semibold text-gray-900 dark:text-white">
                                    {String(
                                        viewingInvoice.purchase_date
                                    ).slice(0, 10)}
                                </p>
                            </div>

                            <div>
                                <p className="text-xs text-gray-500">
                                    Document Status
                                </p>
                                <div className="mt-1">
                                    <StatusBadge
                                        status={viewingInvoice.document_status}
                                    />
                                </div>
                            </div>

                            <div>
                                <p className="text-xs text-gray-500">
                                    Payment Status
                                </p>
                                <div className="mt-1">
                                    <StatusBadge
                                        status={viewingInvoice.status}
                                    />
                                </div>
                            </div>

                            <div>
                                <p className="text-xs text-gray-500">
                                    Source
                                </p>
                                <p className="mt-1 font-semibold text-gray-900 dark:text-white">
                                    {viewingInvoice.source_type}
                                </p>
                            </div>
                        </div>

                        <div className="overflow-x-auto px-5 pb-5">
                            <table className="w-full min-w-[650px] text-left text-sm">
                                <thead className="bg-gray-50 text-gray-600 dark:bg-gray-800 dark:text-gray-300">
                                    <tr>
                                        <th className="p-3">Product</th>
                                        <th className="p-3">UOM</th>
                                        <th className="p-3">Quantity</th>
                                        <th className="p-3">Unit Cost</th>
                                        <th className="p-3">Discount</th>
                                        <th className="p-3">Tax</th>
                                        <th className="p-3">Total</th>
                                    </tr>
                                </thead>

                                <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                                    {viewingInvoice.items.map((item) => (
                                        <tr key={item.purchase_item_id}>
                                            <td className="p-3 text-gray-900 dark:text-white">
                                                {item.product_name ||
                                                    item.item_description}
                                            </td>
                                            <td className="p-3">{item.uom}</td>
                                            <td className="p-3">{item.quantity}</td>
                                            <td className="p-3">{money(item.unit_cost)}</td>
                                            <td className="p-3">{money(item.discount)}</td>
                                            <td className="p-3">{money(item.tax)}</td>
                                            <td className="p-3 font-semibold">
                                                {money(item.line_total)}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        <div className="flex justify-end border-t border-gray-200 p-5 dark:border-gray-800">
                            <div className="w-full max-w-xs space-y-2 text-sm">
                                <div className="flex justify-between">
                                    <span className="text-gray-500">Subtotal</span>
                                    <span>{money(viewingInvoice.subtotal)}</span>
                                </div>

                                <div className="flex justify-between">
                                    <span className="text-gray-500">Discount</span>
                                    <span>{money(viewingInvoice.discount)}</span>
                                </div>

                                <div className="flex justify-between">
                                    <span className="text-gray-500">Tax</span>
                                    <span>{money(viewingInvoice.tax)}</span>
                                </div>

                                <div className="flex justify-between border-t border-gray-200 pt-3 text-base font-bold dark:border-gray-700">
                                    <span>Grand Total</span>
                                    <span>
                                        Rs. {money(viewingInvoice.total_amount)}
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* INVOICE LIST */}

                {!showForm && !viewingInvoice && (
                    <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900">
                        <div className="flex flex-col justify-between gap-3 border-b border-gray-200 p-5 dark:border-gray-800 sm:flex-row sm:items-center">
                            <div>
                                <h2 className="font-bold text-gray-900 dark:text-white">
                                    Purchase Invoice History
                                </h2>

                                <p className="mt-1 text-xs text-gray-500">
                                    View and manage supplier invoices.
                                </p>
                            </div>

                            <div className="flex flex-col gap-2 sm:flex-row">
                                <input
                                    type="search"
                                    placeholder="Search invoice, supplier..."
                                    value={search}
                                    onChange={(event) =>
                                        setSearch(event.target.value)
                                    }
                                    className={`${inputClass} sm:w-64`}
                                />

                                <select
                                    value={statusFilter}
                                    onChange={(event) =>
                                        setStatusFilter(event.target.value)
                                    }
                                    className={`${inputClass} sm:w-40`}
                                >
                                    <option value="ALL">All Statuses</option>
                                    <option value="DRAFT">Draft</option>
                                    <option value="APPROVED">Approved</option>
                                    <option value="CANCELLED">Cancelled</option>
                                </select>
                            </div>
                        </div>

                        {loading ? (
                            <div className="p-12 text-center text-sm text-gray-500">
                                Loading Purchase Invoices...
                            </div>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full min-w-[1050px] text-left text-sm">
                                    <thead className="bg-gray-50 text-xs uppercase text-gray-600 dark:bg-gray-800 dark:text-gray-300">
                                        <tr>
                                            <th className="px-4 py-4">Invoice Number</th>
                                            <th className="px-4 py-4">Supplier</th>
                                            <th className="px-4 py-4">Warehouse</th>
                                            <th className="px-4 py-4">Date</th>
                                            <th className="px-4 py-4">Source</th>
                                            <th className="px-4 py-4">Total</th>
                                            <th className="px-4 py-4">Document Status</th>
                                            <th className="px-4 py-4">Payment Status</th>
                                            <th className="px-4 py-4">Actions</th>
                                        </tr>
                                    </thead>

                                    <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                                        {filteredInvoices.map((invoice) => (
                                            <tr
                                                key={invoice.purchase_id}
                                                className="transition hover:bg-gray-50 dark:hover:bg-gray-800/50"
                                            >
                                                <td className="whitespace-nowrap px-4 py-4 font-semibold text-blue-600">
                                                    {invoice.purchase_number}
                                                </td>

                                                <td className="px-4 py-4 text-gray-800 dark:text-gray-200">
                                                    {invoice.supplier_name || "-"}
                                                </td>

                                                <td className="px-4 py-4 text-gray-600 dark:text-gray-400">
                                                    {invoice.warehouse_name || "-"}
                                                </td>

                                                <td className="whitespace-nowrap px-4 py-4 text-gray-600 dark:text-gray-400">
                                                    {String(
                                                        invoice.purchase_date
                                                    ).slice(0, 10)}
                                                </td>

                                                <td className="px-4 py-4">
                                                    <span className="text-xs font-medium text-gray-600 dark:text-gray-300">
                                                        {invoice.source_type || "MANUAL"}
                                                    </span>
                                                </td>

                                                <td className="whitespace-nowrap px-4 py-4 font-semibold text-gray-900 dark:text-white">
                                                    Rs. {money(invoice.total_amount)}
                                                </td>

                                                <td className="px-4 py-4">
                                                    <StatusBadge
                                                        status={invoice.document_status}
                                                    />
                                                </td>

                                                <td className="px-4 py-4">
                                                    <StatusBadge
                                                        status={invoice.status}
                                                    />
                                                </td>

                                                <td className="px-4 py-4">
                                                    <div className="flex flex-wrap gap-1.5">
                                                        <button
                                                            type="button"
                                                            onClick={() =>
                                                                viewInvoice(
                                                                    invoice.purchase_id
                                                                )
                                                            }
                                                            className="rounded-md border border-gray-300 px-2.5 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-100 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800"
                                                        >
                                                            View
                                                        </button>

                                                        {invoice.document_status === "DRAFT" && (
                                                            <>
                                                                {canUpdate && (
                                                                    <>
                                                                        <button
                                                                            type="button"
                                                                            onClick={() =>
                                                                                editInvoice(
                                                                                    invoice.purchase_id
                                                                                )
                                                                            }
                                                                            className="rounded-md bg-blue-50 px-2.5 py-1.5 text-xs font-medium text-blue-700 hover:bg-blue-100 dark:bg-blue-950/40 dark:text-blue-300"
                                                                        >
                                                                            Edit
                                                                        </button>

                                                                        <button
                                                                            type="button"
                                                                            onClick={() =>
                                                                                approveInvoice(invoice)
                                                                            }
                                                                            disabled={saving}
                                                                            className="rounded-md bg-green-50 px-2.5 py-1.5 text-xs font-medium text-green-700 hover:bg-green-100 dark:bg-green-950/40 dark:text-green-300"
                                                                        >
                                                                            Approve
                                                                        </button>
                                                                    </>
                                                                )}

                                                                {canDelete && (
                                                                    <button
                                                                        type="button"
                                                                        onClick={() =>
                                                                            deleteInvoice(invoice)
                                                                        }
                                                                        disabled={saving}
                                                                        className="rounded-md bg-red-50 px-2.5 py-1.5 text-xs font-medium text-red-700 hover:bg-red-100 dark:bg-red-950/40 dark:text-red-300"
                                                                    >
                                                                        Delete
                                                                    </button>
                                                                )}
                                                            </>
                                                        )}
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}

                                        {filteredInvoices.length === 0 && (
                                            <tr>
                                                <td
                                                    colSpan={9}
                                                    className="px-4 py-12 text-center"
                                                >
                                                    <p className="font-medium text-gray-700 dark:text-gray-300">
                                                        No Purchase Invoices found.
                                                    </p>

                                                    {canCreate && (
                                                        <p className="mt-1 text-xs text-gray-500">
                                                            Create a Purchase Invoice to get started.
                                                        </p>
                                                    )}
                                                </td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        )}

                        <div className="border-t border-gray-200 px-5 py-3 text-xs text-gray-500 dark:border-gray-800">
                            Showing {filteredInvoices.length} of {invoices.length} invoices
                        </div>
                    </div>
                )}

            </div>
        </div>
    );
}
