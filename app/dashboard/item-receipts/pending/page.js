"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
    ArrowLeft,
    Plus,
    Search,
    RefreshCw,
    Save,
    Eye,
    Pencil,
    Trash2,
    Printer,
    X,
    Package,
    ClipboardList,
    FileText,
    ShoppingCart,
    Building2,
    AlertCircle,
    CheckCircle2,
} from "lucide-react";

/* -------------------------------------------------------------------------- */
/* Helpers                                                                    */
/* -------------------------------------------------------------------------- */

const today = () => {
    const date = new Date();

    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");

    return `${year}-${month}-${day}`;
};

const toDateInputValue = (value) => {
    if (!value) return "";

    const text = String(value).trim();
    const match = text.match(/^(\d{4}-\d{2}-\d{2})/);

    return match ? match[1] : "";
};

const dateFormat = (value) => {
    const dateValue = toDateInputValue(value);

    if (!dateValue) return "-";

    const [year, month, day] = dateValue.split("-").map(Number);
    const date = new Date(year, month - 1, day);

    if (Number.isNaN(date.getTime())) return dateValue;

    return date.toLocaleDateString("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric",
    });
};

const emptyItem = () => ({
    purchaseOrderItemId: null,
    productId: "",
    description: "",
    uom: "PCS",
    quantityExpected: "1",
    remarks: "",
});

const emptyForm = () => ({
    sourceType: "MANUAL",
    supplierId: "",
    purchaseOrderId: "",
    documentDate: today(),
    expectedReceiptDate: "",
    status: "PENDING",
    remarks: "",
    items: [emptyItem()],
});

const numberFormat = (value) =>
    Number(value || 0).toLocaleString("en-PK", {
        minimumFractionDigits: 0,
        maximumFractionDigits: 4,
    });

const getErrorMessage = (data, fallback) =>
    data?.message || data?.error || fallback;

const statusClass = (status) => {
    switch (String(status || "").toUpperCase()) {
        case "PENDING":
            return "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300";

        case "DRAFT":
            return "bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-200";

        case "CANCELLED":
            return "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300";

        default:
            return "bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-200";
    }
};

const escapeHtml = (value) =>
    String(value ?? "").replace(/[&<>"']/g, (character) => {
        const entities = {
            "&": "&amp;",
            "<": "&lt;",
            ">": "&gt;",
            '"': "&quot;",
            "'": "&#39;",
        };

        return entities[character];
    });

const readJsonResponse = async (response) => {
    const text = await response.text();

    try {
        return text ? JSON.parse(text) : {};
    } catch {
        throw new Error(
            `The server returned an invalid response. HTTP ${response.status}.`
        );
    }
};

/* -------------------------------------------------------------------------- */
/* Component                                                                  */
/* -------------------------------------------------------------------------- */

export default function PendingItemReceiptsPage() {
    /* ---------------------------------------------------------------------- */
    /* State                                                                  */
    /* ---------------------------------------------------------------------- */

    const [receipts, setReceipts] = useState([]);
    const [suppliers, setSuppliers] = useState([]);
    const [purchaseOrders, setPurchaseOrders] = useState([]);
    const [products, setProducts] = useState([]);

    const [loading, setLoading] = useState(true);
    const [permissionsLoading, setPermissionsLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [detailLoading, setDetailLoading] = useState(false);

    const [mode, setMode] = useState("list");

    const [selectedReceipt, setSelectedReceipt] = useState(null);

    const [form, setForm] = useState(emptyForm());

    const [search, setSearch] = useState("");
    const [statusFilter, setStatusFilter] = useState("ALL");
    const [sourceFilter, setSourceFilter] = useState("ALL");

    const [error, setError] = useState("");
    const [success, setSuccess] = useState("");

    // Secure defaults: no access until the permission API confirms access.
    const [permissions, setPermissions] = useState({
        canView: false,
        canCreate: false,
        canUpdate: false,
        canDelete: false,
    });

    const [permissionError, setPermissionError] = useState("");

    /* ---------------------------------------------------------------------- */
    /* Permission loading                                                     */
    /* ---------------------------------------------------------------------- */

    const loadPermissions = useCallback(async () => {
        setPermissionsLoading(true);
        setPermissionError("");

        try {
            const response = await fetch(
                "/api/auth/my-permissions",
                {
                    method: "GET",
                    cache: "no-store",
                }
            );

            const data = await readJsonResponse(response);

            if (!response.ok) {
                throw new Error(
                    getErrorMessage(
                        data,
                        "Unable to load user permissions."
                    )
                );
            }

            const permission = (
                Array.isArray(data.permissions)
                    ? data.permissions
                    : []
            ).find(
                (item) =>
                    item.permission_key === "pending_item_receipts"
            );

            // Missing permission row or role_permissions record means no access.
            const nextPermissions = {
                canView: permission?.can_view === true,
                canCreate: permission?.can_create === true,
                canUpdate: permission?.can_update === true,
                canDelete: permission?.can_delete === true,
            };

            setPermissions(nextPermissions);

            return nextPermissions;
        } catch (err) {
            setPermissions({
                canView: false,
                canCreate: false,
                canUpdate: false,
                canDelete: false,
            });

            setPermissionError(
                err.message || "Unable to load user permissions."
            );

            return null;
        } finally {
            setPermissionsLoading(false);
        }
    }, []);

    /* ---------------------------------------------------------------------- */
    /* Load receipt data                                                      */
    /* ---------------------------------------------------------------------- */

    const loadData = useCallback(async (showLoader = true) => {
        if (showLoader) {
            setLoading(true);
        }

        setError("");

        try {
            const response = await fetch(
                "/api/pending-item-receipts",
                {
                    method: "GET",
                    cache: "no-store",
                }
            );

            const data = await readJsonResponse(response);

            if (!response.ok || !data.success) {
                throw new Error(
                    getErrorMessage(
                        data,
                        "Unable to load Pending Item Receipts."
                    )
                );
            }

            setReceipts(
                Array.isArray(data.receipts)
                    ? data.receipts
                    : []
            );

            setSuppliers(
                Array.isArray(data.suppliers)
                    ? data.suppliers
                    : []
            );

            setPurchaseOrders(
                Array.isArray(data.purchaseOrders)
                    ? data.purchaseOrders
                    : []
            );

            setProducts(
                Array.isArray(data.products)
                    ? data.products
                    : []
            );
        } catch (err) {
            setError(
                err.message || "Unable to load Pending Item Receipts."
            );
        } finally {
            if (showLoader) {
                setLoading(false);
            }
        }
    }, []);

    /* ---------------------------------------------------------------------- */
    /* Initial page loading                                                   */
    /* ---------------------------------------------------------------------- */

    useEffect(() => {
        let isMounted = true;

        const initializePage = async () => {
            const loadedPermissions = await loadPermissions();

            if (!isMounted) return;

            if (!loadedPermissions?.canView) {
                setLoading(false);
                return;
            }

            await loadData(true);
        };

        initializePage();

        return () => {
            isMounted = false;
        };
    }, [loadPermissions, loadData]);

    /* ---------------------------------------------------------------------- */
    /* Form helpers                                                           */
    /* ---------------------------------------------------------------------- */

    const updateForm = (field, value) => {
        setForm((previous) => ({
            ...previous,
            [field]: value,
        }));
    };

    const updateItem = (index, field, value) => {
        setForm((previous) => ({
            ...previous,
            items: previous.items.map((item, itemIndex) =>
                itemIndex === index
                    ? {
                        ...item,
                        [field]: value,
                    }
                    : item
            ),
        }));
    };

    const addItem = () => {
        if (!permissions.canUpdate && mode !== "create") {
            setError("You do not have permission to update receipts.");
            return;
        }

        if (mode === "create" && !permissions.canCreate) {
            setError("You do not have permission to create receipts.");
            return;
        }

        if (mode === "view") return;

        setForm((previous) => ({
            ...previous,
            items: [...previous.items, emptyItem()],
        }));
    };

    const removeItem = (index) => {
        if (mode === "view") return;

        if (mode === "create" && !permissions.canCreate) {
            setError("You do not have permission to create receipts.");
            return;
        }

        if (mode === "edit" && !permissions.canUpdate) {
            setError("You do not have permission to update receipts.");
            return;
        }

        setForm((previous) => {
            const items = previous.items.filter(
                (_, itemIndex) => itemIndex !== index
            );

            return {
                ...previous,
                items: items.length ? items : [emptyItem()],
            };
        });
    };

    /* ---------------------------------------------------------------------- */
    /* Product selection                                                      */
    /* ---------------------------------------------------------------------- */

    const handleProductChange = (index, productId) => {
        if (mode === "view") return;

        const product = products.find(
            (item) =>
                Number(item.product_id) === Number(productId)
        );

        setForm((previous) => ({
            ...previous,
            items: previous.items.map((item, itemIndex) =>
                itemIndex === index
                    ? {
                        ...item,
                        productId: productId || "",
                        description:
                            product?.product_name || item.description,
                        uom: product?.unit || item.uom || "PCS",
                    }
                    : item
            ),
        }));
    };

    /* ---------------------------------------------------------------------- */
    /* Create                                                                 */
    /* ---------------------------------------------------------------------- */

    const openCreate = () => {
        if (!permissions.canCreate) {
            setError("You do not have permission to create receipts.");
            return;
        }

        setError("");
        setSuccess("");
        setSelectedReceipt(null);
        setForm(emptyForm());
        setMode("create");
    };

    /* ---------------------------------------------------------------------- */
    /* Source selection                                                       */
    /* ---------------------------------------------------------------------- */

    const handleSourceChange = (sourceType) => {
        if (mode === "view") return;

        if (mode === "create" && !permissions.canCreate) return;
        if (mode === "edit" && !permissions.canUpdate) return;

        setError("");

        setForm((previous) => ({
            ...previous,
            sourceType,
            supplierId: "",
            purchaseOrderId: "",
            expectedReceiptDate: "",
            items: [emptyItem()],
        }));
    };

    /* ---------------------------------------------------------------------- */
    /* Load Purchase Order items                                              */
    /* ---------------------------------------------------------------------- */

    const handlePurchaseOrderChange = async (purchaseOrderId) => {
        if (mode === "view" || mode === "edit") return;

        if (!permissions.canCreate) {
            setError("You do not have permission to create receipts.");
            return;
        }

        setError("");

        if (!purchaseOrderId) {
            setForm((previous) => ({
                ...previous,
                purchaseOrderId: "",
                supplierId: "",
                expectedReceiptDate: "",
                items: [emptyItem()],
            }));

            return;
        }

        const selectedPO = purchaseOrders.find(
            (po) =>
                Number(po.purchase_order_id) === Number(purchaseOrderId)
        );

        if (!selectedPO) {
            setError("Selected Purchase Order was not found.");
            return;
        }

        try {
            setDetailLoading(true);

            const response = await fetch(
                `/api/purchase-orders/${purchaseOrderId}`,
                {
                    method: "GET",
                    cache: "no-store",
                }
            );

            const data = await readJsonResponse(response);

            if (!response.ok || !data.success) {
                throw new Error(
                    getErrorMessage(
                        data,
                        "Unable to load Purchase Order items."
                    )
                );
            }

            const purchaseOrder = data.purchaseOrder;

            const poItems = Array.isArray(purchaseOrder?.items)
                ? purchaseOrder.items
                : [];

            if (poItems.length === 0) {
                throw new Error(
                    "The selected Purchase Order does not contain any items."
                );
            }

            const mappedItems = poItems.map((item) => ({
                purchaseOrderItemId:
                    item.purchase_order_item_id || null,

                productId: item.product_id
                    ? String(item.product_id)
                    : "",

                description:
                    item.item_description ||
                    item.product_name ||
                    "Purchase Order Item",

                uom: item.uom || "PCS",

                quantityExpected: String(item.quantity || 1),

                remarks: item.remarks || "",
            }));

            setForm((previous) => ({
                ...previous,
                sourceType: "PURCHASE_ORDER",
                purchaseOrderId: String(purchaseOrderId),

                supplierId: String(
                    purchaseOrder.supplier_id ||
                    selectedPO.supplier_id ||
                    ""
                ),

                expectedReceiptDate: toDateInputValue(
                    purchaseOrder.expected_delivery_date
                ),

                items: mappedItems,
            }));
        } catch (err) {
            setError(
                err.message || "Unable to load Purchase Order."
            );
        } finally {
            setDetailLoading(false);
        }
    };

    /* ---------------------------------------------------------------------- */
    /* View / Edit                                                            */
    /* ---------------------------------------------------------------------- */

    const openReceipt = async (receiptId, action = "view") => {
        if (!permissions.canView) {
            setError("You do not have permission to view receipts.");
            return;
        }

        if (action === "edit" && !permissions.canUpdate) {
            setError("You do not have permission to update receipts.");
            return;
        }

        setError("");
        setSuccess("");
        setDetailLoading(true);

        try {
            const response = await fetch(
                `/api/pending-item-receipts/${receiptId}`,
                {
                    method: "GET",
                    cache: "no-store",
                }
            );

            const data = await readJsonResponse(response);

            if (!response.ok || !data.success) {
                throw new Error(
                    getErrorMessage(data, "Unable to load receipt.")
                );
            }

            const receipt = data.receipt;

            if (!receipt) {
                throw new Error("Receipt information was not returned.");
            }

            if (
                action === "edit" &&
                String(receipt.status || "").toUpperCase() === "CANCELLED"
            ) {
                throw new Error("Cancelled receipts cannot be edited.");
            }

            const receiptItems = Array.isArray(receipt.items)
                ? receipt.items
                : [];

            setSelectedReceipt(receipt);

            setForm({
                sourceType: receipt.source_type || "MANUAL",

                supplierId: String(receipt.supplier_id || ""),

                purchaseOrderId: String(
                    receipt.purchase_order_id || ""
                ),

                documentDate: toDateInputValue(
                    receipt.document_date
                ),

                expectedReceiptDate: toDateInputValue(
                    receipt.expected_receipt_date
                ),

                status: receipt.status || "PENDING",

                remarks: receipt.remarks || "",

                items: receiptItems.map((item) => ({
                    purchaseOrderItemId:
                        item.purchase_order_item_id || null,

                    productId: item.product_id
                        ? String(item.product_id)
                        : "",

                    description: item.item_description || "",

                    uom: item.uom || "PCS",

                    quantityExpected: String(
                        item.quantity_expected ?? ""
                    ),

                    remarks: item.remarks || "",
                })),
            });

            setMode(action);
        } catch (err) {
            setError(
                err.message || "Unable to load receipt."
            );
        } finally {
            setDetailLoading(false);
        }
    };

    /* ---------------------------------------------------------------------- */
    /* Save                                                                   */
    /* ---------------------------------------------------------------------- */

    const handleSave = async (event) => {
        event.preventDefault();

        setError("");
        setSuccess("");

        if (mode === "create" && !permissions.canCreate) {
            setError("You do not have permission to create receipts.");
            return;
        }

        if (mode === "edit" && !permissions.canUpdate) {
            setError("You do not have permission to update receipts.");
            return;
        }

        if (mode !== "create" && mode !== "edit") {
            setError("This receipt cannot be saved in the current mode.");
            return;
        }

        const documentDate = String(form.documentDate || "").trim();

        if (!/^\d{4}-\d{2}-\d{2}$/.test(documentDate)) {
            setError("Please select a valid Document Date.");
            return;
        }

        const [year, month, day] = documentDate.split("-").map(Number);

        const parsedDocumentDate = new Date(
            Date.UTC(year, month - 1, day)
        );

        if (
            parsedDocumentDate.getUTCFullYear() !== year ||
            parsedDocumentDate.getUTCMonth() !== month - 1 ||
            parsedDocumentDate.getUTCDate() !== day
        ) {
            setError("Document Date is not a valid calendar date.");
            return;
        }

        if (
            form.expectedReceiptDate &&
            !/^\d{4}-\d{2}-\d{2}$/.test(
                String(form.expectedReceiptDate)
            )
        ) {
            setError("Please select a valid Expected Receipt Date.");
            return;
        }

        if (
            form.sourceType === "MANUAL" &&
            !form.supplierId
        ) {
            setError("Please select a supplier.");
            return;
        }

        if (
            form.sourceType === "PURCHASE_ORDER" &&
            !form.purchaseOrderId
        ) {
            setError("Please select a Purchase Order.");
            return;
        }

        if (!form.items.length) {
            setError("Please add at least one item.");
            return;
        }

        for (let index = 0; index < form.items.length; index += 1) {
            const item = form.items[index];

            if (!String(item.description || "").trim()) {
                setError(
                    `Please enter a description for item ${index + 1}.`
                );
                return;
            }

            const quantity = Number(item.quantityExpected);

            if (!Number.isFinite(quantity) || quantity <= 0) {
                setError(
                    `Please enter a valid quantity for item ${index + 1}.`
                );
                return;
            }

            if (
                form.sourceType === "PURCHASE_ORDER" &&
                !item.purchaseOrderItemId
            ) {
                setError(
                    `Purchase Order reference is missing for item ${index + 1}.`
                );
                return;
            }
        }

        const payload = {
            sourceType: form.sourceType,

            supplierId:
                form.sourceType === "MANUAL"
                    ? Number(form.supplierId)
                    : Number(form.supplierId) || null,

            purchaseOrderId:
                form.sourceType === "PURCHASE_ORDER"
                    ? Number(form.purchaseOrderId)
                    : null,

            documentDate,

            expectedReceiptDate:
                form.expectedReceiptDate || null,

            status: form.status,

            remarks: form.remarks || null,

            items: form.items.map((item) => ({
                purchaseOrderItemId:
                    item.purchaseOrderItemId
                        ? Number(item.purchaseOrderItemId)
                        : null,

                productId: item.productId
                    ? Number(item.productId)
                    : null,

                description: String(
                    item.description || ""
                ).trim(),

                itemDescription: String(
                    item.description || ""
                ).trim(),

                uom: item.uom || "PCS",

                quantityExpected: Number(item.quantityExpected),

                remarks: item.remarks || null,
            })),
        };

        try {
            setSaving(true);

            const isEditing = mode === "edit";

            if (
                isEditing &&
                !selectedReceipt?.pending_item_receipt_id
            ) {
                throw new Error("Receipt ID is missing.");
            }

            const url = isEditing
                ? `/api/pending-item-receipts/${selectedReceipt.pending_item_receipt_id}`
                : "/api/pending-item-receipts";

            const response = await fetch(url, {
                method: isEditing ? "PATCH" : "POST",

                headers: {
                    "Content-Type": "application/json",
                },

                body: JSON.stringify(payload),
            });

            const data = await readJsonResponse(response);

            if (!response.ok || !data.success) {
                throw new Error(
                    getErrorMessage(
                        data,
                        "Unable to save Pending Item Receipt."
                    )
                );
            }

            setSuccess(
                data.message ||
                "Pending Item Receipt saved successfully."
            );

            await loadData(false);

            setMode("list");
            setSelectedReceipt(null);
            setForm(emptyForm());
        } catch (err) {
            setError(
                err.message || "Unable to save receipt."
            );
        } finally {
            setSaving(false);
        }
    };

    /* ---------------------------------------------------------------------- */
    /* Delete                                                                 */
    /* ---------------------------------------------------------------------- */

    const handleDelete = async (receipt) => {
        if (!permissions.canDelete) {
            setError("You do not have permission to delete receipts.");
            return;
        }

        if (!receipt?.pending_item_receipt_id) {
            setError("Receipt ID is missing.");
            return;
        }

        if (
            String(receipt.status || "").toUpperCase() === "CANCELLED"
        ) {
            setError("Cancelled receipts cannot be deleted from this screen.");
            return;
        }

        const confirmed = window.confirm(
            `Delete Pending Item Receipt ${receipt.receipt_number}?\n\nThis will permanently delete this document and its items.`
        );

        if (!confirmed) return;

        setError("");
        setSuccess("");

        try {
            const response = await fetch(
                `/api/pending-item-receipts/${receipt.pending_item_receipt_id}`,
                {
                    method: "DELETE",
                }
            );

            const data = await readJsonResponse(response);

            if (!response.ok || !data.success) {
                throw new Error(
                    getErrorMessage(data, "Unable to delete receipt.")
                );
            }

            setSuccess(
                data.message || "Receipt deleted successfully."
            );

            if (
                selectedReceipt?.pending_item_receipt_id ===
                receipt.pending_item_receipt_id
            ) {
                setSelectedReceipt(null);
            }

            await loadData(false);
        } catch (err) {
            setError(
                err.message || "Unable to delete receipt."
            );
        }
    };

    /* ---------------------------------------------------------------------- */
    /* Print                                                                  */
    /* ---------------------------------------------------------------------- */

    const handlePrint = async (receipt) => {
        if (!permissions.canView) {
            setError("You do not have permission to view receipts.");
            return;
        }

        try {
            let fullReceipt = receipt;

            if (!Array.isArray(receipt.items)) {
                const response = await fetch(
                    `/api/pending-item-receipts/${receipt.pending_item_receipt_id}`,
                    {
                        method: "GET",
                        cache: "no-store",
                    }
                );

                const data = await readJsonResponse(response);

                if (!response.ok || !data.success) {
                    throw new Error(
                        getErrorMessage(
                            data,
                            "Unable to load print report."
                        )
                    );
                }

                fullReceipt = data.receipt;
            }

            const supplierName =
                fullReceipt.supplier_name ||
                suppliers.find(
                    (supplier) =>
                        Number(supplier.supplier_id) ===
                        Number(fullReceipt.supplier_id)
                )?.supplier_name ||
                "-";

            const rows = (fullReceipt.items || [])
                .map(
                    (item, index) => `
                        <tr>
                            <td>${index + 1}</td>
                            <td>${escapeHtml(
                                item.item_description ||
                                item.description ||
                                "-"
                            )}</td>
                            <td>${escapeHtml(item.uom || "-")}</td>
                            <td class="number">${escapeHtml(
                                numberFormat(
                                    item.quantity_expected ??
                                    item.quantityExpected
                                )
                            )}</td>
                            <td>${escapeHtml(item.remarks || "-")}</td>
                        </tr>
                    `
                )
                .join("");

            const printWindow = window.open(
                "",
                "_blank",
                "width=1000,height=750"
            );

            if (!printWindow) {
                throw new Error(
                    "Your browser blocked the print window. Please allow pop-ups."
                );
            }

            printWindow.document.write(`
                <!DOCTYPE html>
                <html>
                <head>
                    <title>${escapeHtml(fullReceipt.receipt_number)}</title>

                    <style>
                        * { box-sizing: border-box; }

                        body {
                            font-family: Arial, sans-serif;
                            color: #222;
                            margin: 35px;
                            font-size: 12px;
                        }

                        .header {
                            display: flex;
                            justify-content: space-between;
                            border-bottom: 2px solid #222;
                            padding-bottom: 15px;
                            margin-bottom: 25px;
                        }

                        h1 {
                            font-size: 22px;
                            margin: 0 0 6px;
                        }

                        h2 {
                            font-size: 15px;
                            margin: 0 0 8px;
                        }

                        .muted { color: #666; }

                        .grid {
                            display: grid;
                            grid-template-columns: 1fr 1fr;
                            gap: 12px 35px;
                            margin-bottom: 25px;
                        }

                        .field { margin-bottom: 8px; }

                        .field strong {
                            display: inline-block;
                            min-width: 135px;
                        }

                        table {
                            width: 100%;
                            border-collapse: collapse;
                            margin-top: 15px;
                        }

                        th, td {
                            border: 1px solid #ccc;
                            padding: 9px;
                            text-align: left;
                        }

                        th { background: #eee; }

                        .number { text-align: right; }

                        .remarks {
                            margin-top: 25px;
                            border: 1px solid #ddd;
                            padding: 12px;
                            min-height: 55px;
                        }

                        .footer {
                            margin-top: 60px;
                            display: flex;
                            justify-content: space-between;
                        }

                        .signature {
                            border-top: 1px solid #555;
                            width: 180px;
                            padding-top: 7px;
                            text-align: center;
                        }

                        @media print {
                            body { margin: 15mm; }
                        }
                    </style>
                </head>

                <body>
                    <div class="header">
                        <div>
                            <h1>Pending Item Receipt</h1>
                            <div class="muted">
                                Expected goods receipt document
                            </div>
                        </div>

                        <div>
                            <h2>${escapeHtml(
                                fullReceipt.receipt_number
                            )}</h2>
                            <div>
                                Status: ${escapeHtml(fullReceipt.status)}
                            </div>
                        </div>
                    </div>

                    <div class="grid">
                        <div>
                            <div class="field">
                                <strong>Supplier:</strong>
                                ${escapeHtml(supplierName)}
                            </div>

                            <div class="field">
                                <strong>Source:</strong>
                                ${escapeHtml(fullReceipt.source_type)}
                            </div>

                            <div class="field">
                                <strong>Purchase Order:</strong>
                                ${escapeHtml(
                                    fullReceipt.purchase_order_number || "-"
                                )}
                            </div>
                        </div>

                        <div>
                            <div class="field">
                                <strong>Document Date:</strong>
                                ${escapeHtml(
                                    dateFormat(fullReceipt.document_date)
                                )}
                            </div>

                            <div class="field">
                                <strong>Expected Receipt:</strong>
                                ${escapeHtml(
                                    dateFormat(
                                        fullReceipt.expected_receipt_date
                                    )
                                )}
                            </div>
                        </div>
                    </div>

                    <h2>Item Details</h2>

                    <table>
                        <thead>
                            <tr>
                                <th style="width:45px">#</th>
                                <th>Description</th>
                                <th style="width:90px">UOM</th>
                                <th style="width:130px">Expected Qty</th>
                                <th>Remarks</th>
                            </tr>
                        </thead>

                        <tbody>${rows}</tbody>
                    </table>

                    <div class="remarks">
                        <strong>Remarks:</strong><br />
                        ${escapeHtml(fullReceipt.remarks || "-")}
                    </div>

                    <div class="footer">
                        <div class="signature">Prepared By</div>
                        <div class="signature">Checked By</div>
                        <div class="signature">Approved By</div>
                    </div>

                    <script>
                        window.onload = function () {
                            window.print();
                        };
                    </script>
                </body>
                </html>
            `);

            printWindow.document.close();
        } catch (err) {
            setError(
                err.message || "Unable to print receipt."
            );
        }
    };

    /* ---------------------------------------------------------------------- */
    /* Filter history                                                         */
    /* ---------------------------------------------------------------------- */

    const filteredReceipts = useMemo(() => {
        const searchText = search.trim().toLowerCase();

        return receipts.filter((receipt) => {
            const matchesSearch =
                !searchText ||
                [
                    receipt.receipt_number,
                    receipt.supplier_name,
                    receipt.supplier_code,
                    receipt.purchase_order_number,
                    receipt.status,
                ].some((value) =>
                    String(value || "")
                        .toLowerCase()
                        .includes(searchText)
                );

            const matchesStatus =
                statusFilter === "ALL" ||
                receipt.status === statusFilter;

            const matchesSource =
                sourceFilter === "ALL" ||
                receipt.source_type === sourceFilter;

            return (
                matchesSearch &&
                matchesStatus &&
                matchesSource
            );
        });
    }, [
        receipts,
        search,
        statusFilter,
        sourceFilter,
    ]);

    /* ---------------------------------------------------------------------- */
    /* Summary                                                                */
    /* ---------------------------------------------------------------------- */

    const summary = useMemo(
        () => ({
            total: receipts.length,

            pending: receipts.filter(
                (item) => item.status === "PENDING"
            ).length,

            draft: receipts.filter(
                (item) => item.status === "DRAFT"
            ).length,

            cancelled: receipts.filter(
                (item) => item.status === "CANCELLED"
            ).length,
        }),
        [receipts]
    );

    /* ---------------------------------------------------------------------- */
    /* Modes and permission-based read-only state                             */
    /* ---------------------------------------------------------------------- */

    const isReadOnly =
        mode === "view" ||
        (mode === "create" && !permissions.canCreate) ||
        (mode === "edit" && !permissions.canUpdate);

    const isFormMode =
        mode === "create" ||
        mode === "edit" ||
        mode === "view";

    /* ---------------------------------------------------------------------- */
    /* CSS classes                                                            */
    /* ---------------------------------------------------------------------- */

    const inputClass =
        "w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:cursor-not-allowed disabled:bg-gray-100 dark:border-gray-700 dark:bg-gray-900 dark:text-white dark:focus:border-blue-500 dark:disabled:bg-gray-800";

    const labelClass =
        "mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300";

    const cardClass =
        "rounded-xl border border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900";

    const primaryButton =
        "inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50";

    const secondaryButton =
        "inline-flex items-center justify-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 transition hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200 dark:hover:bg-gray-800";

    /* ---------------------------------------------------------------------- */
    /* Selected records                                                       */
    /* ---------------------------------------------------------------------- */

    const selectedSupplier = suppliers.find(
        (supplier) =>
            Number(supplier.supplier_id) ===
            Number(form.supplierId)
    );

    const selectedPO = purchaseOrders.find(
        (po) =>
            Number(po.purchase_order_id) ===
            Number(form.purchaseOrderId)
    );

    /* ---------------------------------------------------------------------- */
    /* Permission guards                                                      */
    /* ---------------------------------------------------------------------- */

    if (permissionsLoading) {
        return (
            <div className="flex min-h-[60vh] items-center justify-center p-6">
                <div className="flex items-center gap-3 text-sm text-gray-500 dark:text-gray-400">
                    <RefreshCw
                        size={20}
                        className="animate-spin text-blue-600"
                    />
                    Loading permissions...
                </div>
            </div>
        );
    }

    if (!permissions.canView) {
        return (
            <div className="flex min-h-[60vh] items-center justify-center p-6">
                <div className="max-w-md rounded-2xl border border-red-200 bg-white p-8 text-center shadow-sm dark:border-red-900 dark:bg-gray-900">
                    <AlertCircle className="mx-auto mb-4 h-12 w-12 text-red-500" />

                    <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                        Access Denied
                    </h2>

                    <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
                        {permissionError ||
                            "You do not have permission to view Pending Item Receipts. Contact your administrator."}
                    </p>
                </div>
            </div>
        );
    }

    /* ---------------------------------------------------------------------- */
    /* Render                                                                 */
    /* ---------------------------------------------------------------------- */

    return (
        <div className="min-h-screen space-y-6 bg-gray-50 p-4 dark:bg-gray-950 sm:p-6 lg:p-8">

            {/* Header */}
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-start gap-3">
                    {mode !== "list" && (
                        <button
                            type="button"
                            onClick={() => {
                                setMode("list");
                                setError("");
                                setSuccess("");
                            }}
                            className="mt-1 rounded-lg border border-gray-300 p-2 text-gray-600 hover:bg-gray-100 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
                            title="Back to list"
                        >
                            <ArrowLeft size={18} />
                        </button>
                    )}

                    <div className="flex items-center gap-2">
                        <div className="rounded-xl bg-blue-100 p-2.5 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300">
                            <ClipboardList size={23} />
                        </div>

                        <div>
                            <h1 className="text-xl font-bold text-gray-900 dark:text-white sm:text-2xl">
                                Pending Item Receipt
                            </h1>

                            <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">
                                Manage expected goods receipts from suppliers.
                            </p>
                        </div>
                    </div>
                </div>

                {mode === "list" && (
                    <div className="flex flex-wrap items-center gap-2">
                        <button
                            type="button"
                            onClick={() => loadData(true)}
                            disabled={loading}
                            className={secondaryButton}
                        >
                            <RefreshCw
                                size={16}
                                className={loading ? "animate-spin" : ""}
                            />
                            Refresh
                        </button>

                        {permissions.canCreate && (
                            <button
                                type="button"
                                onClick={openCreate}
                                className={primaryButton}
                            >
                                <Plus size={17} />
                                Create Pending Receipt
                            </button>
                        )}
                    </div>
                )}
            </div>

            {/* Error alert */}
            {error && (
                <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
                    <AlertCircle
                        size={18}
                        className="mt-0.5 shrink-0"
                    />

                    <span className="flex-1">{error}</span>

                    <button
                        type="button"
                        onClick={() => setError("")}
                        aria-label="Close error"
                    >
                        <X size={17} />
                    </button>
                </div>
            )}

            {/* Success alert */}
            {success && (
                <div className="flex items-start gap-2 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700 dark:border-green-900 dark:bg-green-950/40 dark:text-green-300">
                    <CheckCircle2
                        size={18}
                        className="mt-0.5 shrink-0"
                    />

                    <span className="flex-1">{success}</span>

                    <button
                        type="button"
                        onClick={() => setSuccess("")}
                        aria-label="Close success"
                    >
                        <X size={17} />
                    </button>
                </div>
            )}

            {/* ============================================================= */}
            {/* HISTORY LIST                                                  */}
            {/* ============================================================= */}

            {mode === "list" && (
                <>
                    {/* Summary cards */}
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
                        {[
                            {
                                label: "Total Receipts",
                                value: summary.total,
                                icon: ClipboardList,
                                color: "blue",
                            },
                            {
                                label: "Pending",
                                value: summary.pending,
                                icon: Package,
                                color: "amber",
                            },
                            {
                                label: "Draft",
                                value: summary.draft,
                                icon: FileText,
                                color: "slate",
                            },
                            {
                                label: "Cancelled",
                                value: summary.cancelled,
                                icon: X,
                                color: "red",
                            },
                        ].map((item) => {
                            const Icon = item.icon;

                            const colors = {
                                blue: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
                                amber: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
                                slate: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
                                red: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300",
                            };

                            return (
                                <div
                                    key={item.label}
                                    className={`${cardClass} p-5`}
                                >
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <p className="text-sm text-gray-500 dark:text-gray-400">
                                                {item.label}
                                            </p>

                                            <p className="mt-2 text-2xl font-bold text-gray-900 dark:text-white">
                                                {item.value}
                                            </p>
                                        </div>

                                        <div
                                            className={`rounded-xl p-3 ${colors[item.color]}`}
                                        >
                                            <Icon size={22} />
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    {/* History table */}
                    <div className={`${cardClass} overflow-hidden`}>
                        <div className="border-b border-gray-200 p-4 dark:border-gray-800 sm:p-5">
                            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                                <div>
                                    <h2 className="font-semibold text-gray-900 dark:text-white">
                                        Pending Item Receipt History
                                    </h2>

                                    <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                                        View, edit, print, and manage receipt documents.
                                    </p>
                                </div>

                                <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                                    <div className="relative">
                                        <Search
                                            size={17}
                                            className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
                                        />

                                        <input
                                            type="text"
                                            value={search}
                                            onChange={(event) =>
                                                setSearch(event.target.value)
                                            }
                                            placeholder="Search receipts..."
                                            className={`${inputClass} pl-9`}
                                        />
                                    </div>

                                    <select
                                        value={statusFilter}
                                        onChange={(event) =>
                                            setStatusFilter(event.target.value)
                                        }
                                        className={inputClass}
                                    >
                                        <option value="ALL">
                                            All Statuses
                                        </option>

                                        <option value="DRAFT">
                                            Draft
                                        </option>

                                        <option value="PENDING">
                                            Pending
                                        </option>

                                        <option value="CANCELLED">
                                            Cancelled
                                        </option>
                                    </select>

                                    <select
                                        value={sourceFilter}
                                        onChange={(event) =>
                                            setSourceFilter(event.target.value)
                                        }
                                        className={inputClass}
                                    >
                                        <option value="ALL">
                                            All Sources
                                        </option>

                                        <option value="MANUAL">
                                            Manual
                                        </option>

                                        <option value="PURCHASE_ORDER">
                                            From PO
                                        </option>
                                    </select>
                                </div>
                            </div>
                        </div>

                        {loading ? (
                            <div className="flex min-h-64 flex-col items-center justify-center gap-3">
                                <RefreshCw
                                    className="animate-spin text-blue-600"
                                    size={28}
                                />

                                <p className="text-sm text-gray-500">
                                    Loading Pending Item Receipts...
                                </p>
                            </div>
                        ) : filteredReceipts.length === 0 ? (
                            <div className="flex min-h-64 flex-col items-center justify-center px-4 text-center">
                                <div className="rounded-full bg-gray-100 p-4 text-gray-400 dark:bg-gray-800">
                                    <ClipboardList size={30} />
                                </div>

                                <h3 className="mt-4 font-semibold text-gray-900 dark:text-white">
                                    No Pending Item Receipts Found
                                </h3>

                                <p className="mt-1 max-w-md text-sm text-gray-500 dark:text-gray-400">
                                    Create a receipt manually or generate one
                                    from an approved Purchase Order.
                                </p>

                                {permissions.canCreate && (
                                    <button
                                        type="button"
                                        onClick={openCreate}
                                        className={`${primaryButton} mt-4`}
                                    >
                                        <Plus size={16} />
                                        Create First Receipt
                                    </button>
                                )}
                            </div>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full min-w-[1050px] text-left text-sm">
                                    <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500 dark:bg-gray-800/70 dark:text-gray-400">
                                        <tr>
                                            <th className="px-5 py-4">
                                                Receipt Number
                                            </th>

                                            <th className="px-5 py-4">
                                                Date
                                            </th>

                                            <th className="px-5 py-4">
                                                Supplier
                                            </th>

                                            <th className="px-5 py-4">
                                                Purchase Order
                                            </th>

                                            <th className="px-5 py-4">
                                                Expected Receipt
                                            </th>

                                            <th className="px-5 py-4">
                                                Source
                                            </th>

                                            <th className="px-5 py-4">
                                                Items
                                            </th>

                                            <th className="px-5 py-4">
                                                Status
                                            </th>

                                            <th className="px-5 py-4 text-right">
                                                Actions
                                            </th>
                                        </tr>
                                    </thead>

                                    <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                                        {filteredReceipts.map((receipt) => (
                                            <tr
                                                key={receipt.pending_item_receipt_id}
                                                className="transition hover:bg-gray-50 dark:hover:bg-gray-800/40"
                                            >
                                                <td className="px-5 py-4">
                                                    <span className="font-semibold text-blue-700 dark:text-blue-400">
                                                        {receipt.receipt_number}
                                                    </span>
                                                </td>

                                                <td className="whitespace-nowrap px-5 py-4 text-gray-600 dark:text-gray-300">
                                                    {dateFormat(
                                                        receipt.document_date
                                                    )}
                                                </td>

                                                <td className="px-5 py-4">
                                                    <div className="font-medium text-gray-900 dark:text-white">
                                                        {receipt.supplier_name || "-"}
                                                    </div>

                                                    <div className="text-xs text-gray-500">
                                                        {receipt.supplier_code || ""}
                                                    </div>
                                                </td>

                                                <td className="px-5 py-4 text-gray-600 dark:text-gray-300">
                                                    {receipt.purchase_order_number || "-"}
                                                </td>

                                                <td className="whitespace-nowrap px-5 py-4 text-gray-600 dark:text-gray-300">
                                                    {dateFormat(
                                                        receipt.expected_receipt_date
                                                    )}
                                                </td>

                                                <td className="px-5 py-4">
                                                    <span className="inline-flex items-center gap-1.5 rounded-full bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-700 dark:bg-gray-800 dark:text-gray-300">
                                                        {receipt.source_type === "PURCHASE_ORDER" ? (
                                                            <ShoppingCart size={13} />
                                                        ) : (
                                                            <FileText size={13} />
                                                        )}

                                                        {receipt.source_type === "PURCHASE_ORDER"
                                                            ? "From PO"
                                                            : "Manual"}
                                                    </span>
                                                </td>

                                                <td className="px-5 py-4 text-gray-600 dark:text-gray-300">
                                                    {receipt.item_count || 0}
                                                </td>

                                                <td className="px-5 py-4">
                                                    <span
                                                        className={`rounded-full px-2.5 py-1 text-xs font-semibold ${statusClass(
                                                            receipt.status
                                                        )}`}
                                                    >
                                                        {receipt.status}
                                                    </span>
                                                </td>

                                                <td className="px-5 py-4">
                                                    <div className="flex items-center justify-end gap-1.5">
                                                        {/* View is allowed when can_view is true */}
                                                        <button
                                                            type="button"
                                                            onClick={() =>
                                                                openReceipt(
                                                                    receipt.pending_item_receipt_id,
                                                                    "view"
                                                                )
                                                            }
                                                            title="View"
                                                            className="rounded-lg p-2 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30"
                                                        >
                                                            <Eye size={17} />
                                                        </button>

                                                        {/* Edit requires can_update */}
                                                        {permissions.canUpdate &&
                                                            receipt.status !== "CANCELLED" && (
                                                                <button
                                                                    type="button"
                                                                    onClick={() =>
                                                                        openReceipt(
                                                                            receipt.pending_item_receipt_id,
                                                                            "edit"
                                                                        )
                                                                    }
                                                                    title="Edit"
                                                                    className="rounded-lg p-2 text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-900/30"
                                                                >
                                                                    <Pencil size={17} />
                                                                </button>
                                                            )}

                                                        {/* Print requires only can_view */}
                                                        <button
                                                            type="button"
                                                            onClick={() =>
                                                                handlePrint(receipt)
                                                            }
                                                            title="Print / Save PDF"
                                                            className="rounded-lg p-2 text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800"
                                                        >
                                                            <Printer size={17} />
                                                        </button>

                                                        {/* Delete requires can_delete */}
                                                        {permissions.canDelete &&
                                                            receipt.status !== "CANCELLED" && (
                                                                <button
                                                                    type="button"
                                                                    onClick={() =>
                                                                        handleDelete(receipt)
                                                                    }
                                                                    title="Delete"
                                                                    className="rounded-lg p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30"
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

                        <div className="border-t border-gray-200 px-5 py-3 text-xs text-gray-500 dark:border-gray-800 dark:text-gray-400">
                            Showing {filteredReceipts.length} of {receipts.length} receipts
                        </div>
                    </div>
                </>
            )}

            {/* ============================================================= */}
            {/* CREATE / EDIT / VIEW FORM                                     */}
            {/* ============================================================= */}

            {isFormMode && (
                <form
                    onSubmit={handleSave}
                    className="space-y-5"
                >
                    {/* Document heading */}
                    <div className={`${cardClass} p-5`}>
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                            <div>
                                <h2 className="text-lg font-bold text-gray-900 dark:text-white">
                                    {mode === "create"
                                        ? "Create Pending Item Receipt"
                                        : mode === "edit"
                                            ? "Edit Pending Item Receipt"
                                            : "View Pending Item Receipt"}
                                </h2>

                                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                                    {mode === "view"
                                        ? "Review the pending receipt document and its items."
                                        : "Enter supplier, source, expected date, and item details."}
                                </p>
                            </div>

                            {selectedReceipt && (
                                <div className="rounded-lg bg-blue-50 px-4 py-2 dark:bg-blue-900/30">
                                    <p className="text-xs text-blue-600 dark:text-blue-300">
                                        Receipt Number
                                    </p>

                                    <p className="font-bold text-blue-800 dark:text-blue-200">
                                        {selectedReceipt.receipt_number}
                                    </p>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Document information */}
                    <div className={`${cardClass} p-5`}>
                        <div className="mb-5 flex items-center gap-2 border-b border-gray-100 pb-3 dark:border-gray-800">
                            <FileText
                                size={18}
                                className="text-blue-600"
                            />

                            <h3 className="font-semibold text-gray-900 dark:text-white">
                                Document Information
                            </h3>
                        </div>

                        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                            <div>
                                <label className={labelClass}>
                                    Receipt Number
                                </label>

                                <input
                                    type="text"
                                    value={
                                        selectedReceipt?.receipt_number ||
                                        "AUTO GENERATED"
                                    }
                                    disabled
                                    className={`${inputClass} font-semibold`}
                                />

                                <p className="mt-1 text-xs text-gray-400">
                                    Generated automatically when saved.
                                </p>
                            </div>

                            <div>
                                <label className={labelClass}>
                                    Document Date{" "}
                                    <span className="text-red-500">*</span>
                                </label>

                                <input
                                    type="date"
                                    value={form.documentDate}
                                    onChange={(event) =>
                                        updateForm(
                                            "documentDate",
                                            event.target.value
                                        )
                                    }
                                    disabled={isReadOnly}
                                    required
                                    className={inputClass}
                                />
                            </div>

                            <div>
                                <label className={labelClass}>
                                    Status
                                </label>

                                <select
                                    value={form.status}
                                    onChange={(event) =>
                                        updateForm(
                                            "status",
                                            event.target.value
                                        )
                                    }
                                    disabled={isReadOnly}
                                    className={inputClass}
                                >
                                    <option value="DRAFT">DRAFT</option>
                                    <option value="PENDING">PENDING</option>
                                    <option value="CANCELLED">CANCELLED</option>
                                </select>
                            </div>

                            <div>
                                <label className={labelClass}>
                                    Receipt Source{" "}
                                    <span className="text-red-500">*</span>
                                </label>

                                <select
                                    value={form.sourceType}
                                    onChange={(event) =>
                                        handleSourceChange(
                                            event.target.value
                                        )
                                    }
                                    disabled={
                                        isReadOnly ||
                                        mode === "edit"
                                    }
                                    className={inputClass}
                                >
                                    <option value="MANUAL">
                                        Manual
                                    </option>

                                    <option value="PURCHASE_ORDER">
                                        Purchase Order
                                    </option>
                                </select>

                                {mode === "edit" && (
                                    <p className="mt-1 text-xs text-gray-400">
                                        Source cannot be changed after creation.
                                    </p>
                                )}
                            </div>

                            <div>
                                <label className={labelClass}>
                                    Expected Receipt Date
                                </label>

                                <input
                                    type="date"
                                    value={form.expectedReceiptDate}
                                    onChange={(event) =>
                                        updateForm(
                                            "expectedReceiptDate",
                                            event.target.value
                                        )
                                    }
                                    disabled={isReadOnly}
                                    className={inputClass}
                                />
                            </div>
                        </div>
                    </div>

                    {/* Supplier and PO */}
                    <div className={`${cardClass} p-5`}>
                        <div className="mb-5 flex items-center gap-2 border-b border-gray-100 pb-3 dark:border-gray-800">
                            <Building2
                                size={18}
                                className="text-blue-600"
                            />

                            <h3 className="font-semibold text-gray-900 dark:text-white">
                                Supplier & Source Reference
                            </h3>
                        </div>

                        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                            {form.sourceType === "MANUAL" ? (
                                <div>
                                    <label className={labelClass}>
                                        Supplier{" "}
                                        <span className="text-red-500">*</span>
                                    </label>

                                    <select
                                        value={form.supplierId}
                                        onChange={(event) =>
                                            updateForm(
                                                "supplierId",
                                                event.target.value
                                            )
                                        }
                                        disabled={isReadOnly}
                                        required
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

                                                {supplier.supplier_code
                                                    ? ` (${supplier.supplier_code})`
                                                    : ""}
                                            </option>
                                        ))}
                                    </select>

                                    {selectedSupplier && (
                                        <p className="mt-1 text-xs text-gray-500">
                                            {selectedSupplier.phone || ""}

                                            {selectedSupplier.email
                                                ? ` • ${selectedSupplier.email}`
                                                : ""}
                                        </p>
                                    )}
                                </div>
                            ) : (
                                <div>
                                    <label className={labelClass}>
                                        Approved Purchase Order{" "}
                                        <span className="text-red-500">*</span>
                                    </label>

                                    <select
                                        value={form.purchaseOrderId}
                                        onChange={(event) =>
                                            handlePurchaseOrderChange(
                                                event.target.value
                                            )
                                        }
                                        disabled={
                                            isReadOnly ||
                                            mode === "edit"
                                        }
                                        required
                                        className={inputClass}
                                    >
                                        <option value="">
                                            Select Approved Purchase Order
                                        </option>

                                        {purchaseOrders.map((po) => (
                                            <option
                                                key={po.purchase_order_id}
                                                value={po.purchase_order_id}
                                            >
                                                {po.purchase_order_number}
                                                {" — "}
                                                {po.supplier_name}
                                            </option>
                                        ))}
                                    </select>

                                    <p className="mt-1 text-xs text-gray-500">
                                        Only approved Purchase Orders are available.
                                    </p>
                                </div>
                            )}

                            {form.sourceType === "PURCHASE_ORDER" && (
                                <div>
                                    <label className={labelClass}>
                                        Supplier
                                    </label>

                                    <input
                                        type="text"
                                        value={
                                            selectedPO?.supplier_name ||
                                            selectedSupplier?.supplier_name ||
                                            ""
                                        }
                                        disabled
                                        placeholder="Supplier will load from Purchase Order"
                                        className={inputClass}
                                    />
                                </div>
                            )}

                            {form.sourceType === "PURCHASE_ORDER" && (
                                <div className="md:col-span-2">
                                    <div className="flex items-start gap-2 rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm text-blue-800 dark:border-blue-900 dark:bg-blue-950/30 dark:text-blue-300">
                                        <ShoppingCart
                                            size={18}
                                            className="mt-0.5 shrink-0"
                                        />

                                        <p>
                                            Purchase Order items are loaded
                                            automatically. You can adjust the
                                            expected quantities for this pending
                                            receipt.
                                        </p>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Item details */}
                    <div className={`${cardClass} overflow-hidden`}>
                        <div className="flex flex-col gap-3 border-b border-gray-200 p-5 dark:border-gray-800 sm:flex-row sm:items-center sm:justify-between">
                            <div className="flex items-center gap-2">
                                <Package
                                    size={19}
                                    className="text-blue-600"
                                />

                                <div>
                                    <h3 className="font-semibold text-gray-900 dark:text-white">
                                        Item Details
                                    </h3>

                                    <p className="text-xs text-gray-500 dark:text-gray-400">
                                        {form.items.length} item row(s)
                                    </p>
                                </div>
                            </div>

                            {!isReadOnly &&
                                form.sourceType === "MANUAL" && (
                                    <button
                                        type="button"
                                        onClick={addItem}
                                        className={secondaryButton}
                                    >
                                        <Plus size={16} />
                                        Add Item
                                    </button>
                                )}
                        </div>

                        {detailLoading && (
                            <div className="flex items-center gap-2 border-b border-gray-100 px-5 py-3 text-sm text-blue-600 dark:border-gray-800">
                                <RefreshCw
                                    size={16}
                                    className="animate-spin"
                                />

                                Loading Purchase Order items...
                            </div>
                        )}

                        <div className="overflow-x-auto">
                            <table className="w-full min-w-[850px] text-left text-sm">
                                <thead className="bg-gray-50 text-xs uppercase text-gray-500 dark:bg-gray-800/70 dark:text-gray-400">
                                    <tr>
                                        <th className="w-12 px-4 py-3">
                                            #
                                        </th>

                                        <th className="min-w-[230px] px-4 py-3">
                                            Product / Description
                                        </th>

                                        <th className="w-28 px-4 py-3">
                                            UOM
                                        </th>

                                        <th className="w-36 px-4 py-3">
                                            Expected Quantity
                                        </th>

                                        <th className="min-w-[170px] px-4 py-3">
                                            Remarks
                                        </th>

                                        {!isReadOnly &&
                                            form.sourceType === "MANUAL" && (
                                                <th className="w-16 px-4 py-3 text-center">
                                                    Action
                                                </th>
                                            )}
                                    </tr>
                                </thead>

                                <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                                    {form.items.map((item, index) => (
                                        <tr
                                            key={`${item.purchaseOrderItemId || "manual"}-${index}`}
                                        >
                                            <td className="px-4 py-3 text-gray-500">
                                                {index + 1}
                                            </td>

                                            <td className="px-4 py-3">
                                                {form.sourceType === "MANUAL" ? (
                                                    <div className="space-y-2">
                                                        <select
                                                            value={item.productId}
                                                            onChange={(event) =>
                                                                handleProductChange(
                                                                    index,
                                                                    event.target.value
                                                                )
                                                            }
                                                            disabled={isReadOnly}
                                                            className={inputClass}
                                                        >
                                                            <option value="">
                                                                Select Product (Optional)
                                                            </option>

                                                            {products.map((product) => (
                                                                <option
                                                                    key={product.product_id}
                                                                    value={product.product_id}
                                                                >
                                                                    {product.product_name}

                                                                    {product.sku
                                                                        ? ` (${product.sku})`
                                                                        : ""}
                                                                </option>
                                                            ))}
                                                        </select>

                                                        <input
                                                            type="text"
                                                            value={item.description}
                                                            onChange={(event) =>
                                                                updateItem(
                                                                    index,
                                                                    "description",
                                                                    event.target.value
                                                                )
                                                            }
                                                            disabled={isReadOnly}
                                                            placeholder="Item description"
                                                            className={inputClass}
                                                        />
                                                    </div>
                                                ) : (
                                                    <div>
                                                        <p className="font-medium text-gray-900 dark:text-white">
                                                            {item.description}
                                                        </p>

                                                        <p className="mt-1 text-xs text-gray-500">
                                                            {item.productId
                                                                ? products.find(
                                                                    (product) =>
                                                                        Number(product.product_id) ===
                                                                        Number(item.productId)
                                                                )?.sku || ""
                                                                : ""}
                                                        </p>
                                                    </div>
                                                )}
                                            </td>

                                            <td className="px-4 py-3">
                                                <input
                                                    type="text"
                                                    value={item.uom}
                                                    onChange={(event) =>
                                                        updateItem(
                                                            index,
                                                            "uom",
                                                            event.target.value
                                                        )
                                                    }
                                                    disabled={
                                                        isReadOnly ||
                                                        form.sourceType === "PURCHASE_ORDER"
                                                    }
                                                    className={inputClass}
                                                    placeholder="PCS"
                                                />
                                            </td>

                                            <td className="px-4 py-3">
                                                <input
                                                    type="number"
                                                    min="0.0001"
                                                    step="0.0001"
                                                    value={item.quantityExpected}
                                                    onChange={(event) =>
                                                        updateItem(
                                                            index,
                                                            "quantityExpected",
                                                            event.target.value
                                                        )
                                                    }
                                                    disabled={isReadOnly}
                                                    required
                                                    className={`${inputClass} text-right`}
                                                />
                                            </td>

                                            <td className="px-4 py-3">
                                                <input
                                                    type="text"
                                                    value={item.remarks}
                                                    onChange={(event) =>
                                                        updateItem(
                                                            index,
                                                            "remarks",
                                                            event.target.value
                                                        )
                                                    }
                                                    disabled={isReadOnly}
                                                    placeholder="Optional remarks"
                                                    className={inputClass}
                                                />
                                            </td>

                                            {!isReadOnly &&
                                                form.sourceType === "MANUAL" && (
                                                    <td className="px-4 py-3 text-center">
                                                        <button
                                                            type="button"
                                                            onClick={() =>
                                                                removeItem(index)
                                                            }
                                                            title="Remove item"
                                                            className="rounded-lg p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30"
                                                        >
                                                            <Trash2 size={17} />
                                                        </button>
                                                    </td>
                                                )}
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        {form.sourceType === "MANUAL" &&
                            !isReadOnly && (
                                <div className="border-t border-gray-100 px-5 py-3 dark:border-gray-800">
                                    <button
                                        type="button"
                                        onClick={addItem}
                                        className="inline-flex items-center gap-2 text-sm font-semibold text-blue-600 hover:text-blue-700 dark:text-blue-400"
                                    >
                                        <Plus size={16} />
                                        Add another item
                                    </button>
                                </div>
                            )}
                    </div>

                    {/* Remarks */}
                    <div className={`${cardClass} p-5`}>
                        <label className={labelClass}>
                            Document Remarks
                        </label>

                        <textarea
                            rows={3}
                            value={form.remarks}
                            onChange={(event) =>
                                updateForm(
                                    "remarks",
                                    event.target.value
                                )
                            }
                            disabled={isReadOnly}
                            placeholder="Enter any additional information..."
                            className={inputClass}
                        />
                    </div>

                    {/* Footer actions */}
                    <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <button
                            type="button"
                            onClick={() => {
                                setMode("list");
                                setError("");
                                setSuccess("");
                            }}
                            className={secondaryButton}
                        >
                            <ArrowLeft size={16} />
                            Back to History
                        </button>

                        <div className="flex flex-wrap justify-end gap-2">
                            {mode === "view" && selectedReceipt && (
                                <>
                                    <button
                                        type="button"
                                        onClick={() =>
                                            handlePrint(selectedReceipt)
                                        }
                                        className={secondaryButton}
                                    >
                                        <Printer size={16} />
                                        Print / Save PDF
                                    </button>

                                    {permissions.canUpdate &&
                                        selectedReceipt.status !== "CANCELLED" && (
                                            <button
                                                type="button"
                                                onClick={() =>
                                                    setMode("edit")
                                                }
                                                className={primaryButton}
                                            >
                                                <Pencil size={16} />
                                                Edit Receipt
                                            </button>
                                        )}
                                </>
                            )}

                            {!isReadOnly &&
                                ((mode === "create" && permissions.canCreate) ||
                                    (mode === "edit" && permissions.canUpdate)) && (
                                    <button
                                        type="submit"
                                        disabled={saving || detailLoading}
                                        className={primaryButton}
                                    >
                                        {saving ? (
                                            <>
                                                <RefreshCw
                                                    size={16}
                                                    className="animate-spin"
                                                />
                                                Saving...
                                            </>
                                        ) : (
                                            <>
                                                <Save size={16} />

                                                {mode === "edit"
                                                    ? "Update Receipt"
                                                    : "Save Pending Receipt"}
                                            </>
                                        )}
                                    </button>
                                )}
                        </div>
                    </div>
                </form>
            )}
        </div>
    );
}