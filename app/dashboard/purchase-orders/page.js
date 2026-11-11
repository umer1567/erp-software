"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
    ArrowLeft,
    Plus,
    Search,
    RefreshCw,
    Save,
    FileText,
    Eye,
    Pencil,
    Trash2,
    ShoppingCart,
    X,
    PlusCircle,
    Package,
    ClipboardList,
    FilePlus2,
} from "lucide-react";

const API_URL = "/api/purchase-orders";
const QUOTATIONS_API = "/api/purchase-quotations";
const SUPPLIERS_API = "/api/suppliers";
const PRODUCTS_API = "/api/products";

const STATUS_OPTIONS = [
    "DRAFT",
    "PENDING",
    "APPROVED",
    "REJECTED",
    "CLOSED",
    "CANCELLED",
];

const today = () => {
    const date = new Date();
    const localDate = new Date(
        date.getTime() - date.getTimezoneOffset() * 60000
    );
    return localDate.toISOString().slice(0, 10);
};

const emptyItem = () => ({
    productId: "",
    itemDescription: "",
    uom: "PCS",
    quantity: "1",
    retailPrice: "0",
    discountPercent: "0",
    unitPrice: "0",
    discountAmount: "0",
    taxRate: "0",
    taxAmount: "0",
    lineTotal: "0",
    remarks: "",
    itemBalance: "",
    taxCode: "",
    itemWeight: "",
});

const emptyForm = () => ({
    sourceType: "MANUAL",
    purchaseQuotationId: "",
    supplierId: "",
    orderDate: today(),
    expectedDeliveryDate: "",
    status: "APPROVED",
    currencyCode: "PKR",
    exchangeRate: "1",
    paymentTerms: "",
    referenceNo: "",
    locationName: "Finish Goods Store",
    department: "",
    className: "Inbound Shipment",
    project: "",
    memo: "",
    termsConditions: "",
    remarks: "",
    items: [emptyItem()],
});

function money(value) {
    return Number(value || 0).toLocaleString("en-PK", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    });
}

function number(value) {
    const result = Number(value);
    return Number.isFinite(result) ? result : 0;
}

function dateValue(value) {
    if (!value) return "";
    return String(value).slice(0, 10);
}

function displayDate(value) {
    if (!value) return "-";

    const date = new Date(`${dateValue(value)}T00:00:00`);

    if (Number.isNaN(date.getTime())) return value;

    return date
        .toLocaleDateString("en-GB", {
            day: "2-digit",
            month: "short",
            year: "numeric",
        })
        .toUpperCase();
}

function statusStyle(status) {
    switch (String(status || "").toUpperCase()) {
        case "APPROVED":
            return "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300";
        case "PENDING":
            return "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300";
        case "REJECTED":
            return "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300";
        case "CLOSED":
            return "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300";
        case "CANCELLED":
            return "bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300";
        default:
            return "bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-300";
    }
}

function getDocumentStatus(order) {
    const explicitStatus =
        order.document_status || order.documentStatus;

    if (explicitStatus) return explicitStatus;

    if (String(order.status).toUpperCase() === "CLOSED") {
        return "Closed";
    }

    if (String(order.status).toUpperCase() === "CANCELLED") {
        return "Cancelled";
    }

    if (number(order.billed_amount) > 0 && number(order.balance_amount) > 0) {
        return "Partially Billed";
    }

    if (number(order.billed_amount) > 0) {
        return "Fully Billed";
    }

    return "Pending Item Receipt";
}

function normalizeItem(item = {}) {
    return {
        productId: String(
            item.product_id ?? item.productId ?? ""
        ),
        itemDescription:
            item.item_description ??
            item.itemDescription ??
            item.product_name ??
            "",
        uom: item.uom || "PCS",
        quantity: String(item.quantity ?? 1),
        retailPrice: String(item.retail_price ?? item.retailPrice ?? 0),
        discountPercent: String(
            item.discount_percent ?? item.discountPercent ?? 0
        ),
        unitPrice: String(item.unit_price ?? item.unitPrice ?? 0),
        discountAmount: String(
            item.discount_amount ?? item.discountAmount ?? 0
        ),
        taxRate: String(item.tax_rate ?? item.taxRate ?? 0),
        taxAmount: String(item.tax_amount ?? item.taxAmount ?? 0),
        lineTotal: String(item.line_total ?? item.lineTotal ?? 0),
        remarks: item.remarks || "",
        itemBalance: String(item.item_balance ?? ""),
        taxCode: item.tax_code || "",
        itemWeight: String(item.item_weight ?? ""),
    };
}

function normalizeOrder(order = {}) {
    return {
        ...order,
        purchaseOrderId:
            order.purchase_order_id ?? order.purchaseOrderId,
        purchaseOrderNumber:
            order.purchase_order_number ??
            order.purchaseOrderNumber ??
            "",
        supplierId: String(order.supplier_id ?? order.supplierId ?? ""),
        supplierName:
            order.supplier_name ??
            order.supplierName ??
            "",
        orderDate: dateValue(
            order.order_date ?? order.orderDate
        ),
        expectedDeliveryDate: dateValue(
            order.expected_delivery_date ??
            order.expectedDeliveryDate
        ),
        currencyCode:
            order.currency_code ?? order.currencyCode ?? "PKR",
        exchangeRate: String(
            order.exchange_rate ?? order.exchangeRate ?? 1
        ),
        status: order.status || "DRAFT",
        termsConditions:
            order.terms_conditions ??
            order.termsConditions ??
            "",
        remarks: order.remarks || "",
        memo: order.memo || order.remarks || "",
        referenceNo: order.reference_no || "",
        paymentTerms: order.payment_terms || "",
        locationName:
            order.location_name || "Finish Goods Store",
        department: order.department || "",
        className: order.class_name || "Inbound Shipment",
        project: order.project || "",
        quotationNumber:
            order.quotation_number ??
            order.quotationNumber ??
            order.created_from ??
            "",
        items: (order.items || []).map(normalizeItem),
    };
}

function calculateItem(item) {
    const quantity = number(item.quantity);
    const unitPrice = number(item.unitPrice);
    const discountAmount = number(item.discountAmount);
    const taxRate = number(item.taxRate);

    const baseAmount = quantity * unitPrice;

    const calculatedDiscount =
        discountAmount > 0
            ? discountAmount
            : (baseAmount * number(item.discountPercent)) / 100;

    const taxableAmount = Math.max(
        0,
        baseAmount - calculatedDiscount
    );

    const taxAmount =
        number(item.taxAmount) > 0
            ? number(item.taxAmount)
            : (taxableAmount * taxRate) / 100;

    const lineTotal = Math.max(
        0,
        taxableAmount + taxAmount
    );

    return {
        ...item,
        discountAmount: calculatedDiscount.toFixed(2),
        taxAmount: taxAmount.toFixed(2),
        lineTotal: lineTotal.toFixed(2),
    };
}

function getErrorMessage(data, fallback) {
    return data?.message || data?.error || fallback;
}

export default function PurchaseOrdersPage() {
    const [screen, setScreen] = useState("list");
    const [mode, setMode] = useState("view");

    const [orders, setOrders] = useState([]);
    const [suppliers, setSuppliers] = useState([]);
    const [quotations, setQuotations] = useState([]);
    const [products, setProducts] = useState([]);

    const [selectedOrder, setSelectedOrder] = useState(null);
    const [form, setForm] = useState(emptyForm());

    const [search, setSearch] = useState("");
    const [statusFilter, setStatusFilter] = useState("ALL");

    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [detailLoading, setDetailLoading] = useState(false);

    const [error, setError] = useState("");
    const [success, setSuccess] = useState("");

    // --------------------------------------------------
    // USER RIGHTS PERMISSIONS
    // --------------------------------------------------

    const [pagePermissions, setPagePermissions] = useState(null);
    const [permissionsLoading, setPermissionsLoading] = useState(true);

    const canView = pagePermissions?.can_view === true;
    const canCreate = pagePermissions?.can_create === true;
    const canUpdate = pagePermissions?.can_update === true;
    const canDelete = pagePermissions?.can_delete === true;

    // --------------------------------------------------
    // FORM CALCULATIONS
    // --------------------------------------------------

    const calculatedItems = useMemo(
        () => form.items.map(calculateItem),
        [form.items]
    );

    const totals = useMemo(() => {
        const subtotal = calculatedItems.reduce(
            (sum, item) =>
                sum +
                number(item.quantity) * number(item.unitPrice),
            0
        );

        const discountAmount = calculatedItems.reduce(
            (sum, item) => sum + number(item.discountAmount),
            0
        );

        const taxAmount = calculatedItems.reduce(
            (sum, item) => sum + number(item.taxAmount),
            0
        );

        const grandTotal =
            subtotal - discountAmount + taxAmount;

        return {
            subtotal,
            discountAmount,
            taxAmount,
            grandTotal,
        };
    }, [calculatedItems]);

    // --------------------------------------------------
    // LOAD PURCHASE ORDERS
    // --------------------------------------------------

    const loadOrders = useCallback(async () => {
        setLoading(true);
        setError("");

        try {
            const response = await fetch(API_URL, {
                cache: "no-store",
            });

            const data = await response.json();

            if (!response.ok || data.success === false) {
                throw new Error(
                    getErrorMessage(
                        data,
                        "Unable to load purchase orders."
                    )
                );
            }

            setOrders(
                data.purchaseOrders ||
                data.orders ||
                data.data ||
                []
            );

            if (Array.isArray(data.suppliers)) {
                setSuppliers(data.suppliers);
            }

            if (Array.isArray(data.quotations)) {
                setQuotations(data.quotations);
            }
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }, []);

    // --------------------------------------------------
    // LOAD DROPDOWN DATA
    // --------------------------------------------------

    const loadDropdownData = useCallback(async () => {
        const requests = await Promise.allSettled([
            fetch(SUPPLIERS_API, { cache: "no-store" }),
            fetch(QUOTATIONS_API, { cache: "no-store" }),
            fetch(PRODUCTS_API, { cache: "no-store" }),
        ]);

        if (requests[0].status === "fulfilled") {
            try {
                const data = await requests[0].value.json();

                if (requests[0].value.ok) {
                    setSuppliers(
                        data.suppliers ||
                        data.data ||
                        data ||
                        []
                    );
                }
            } catch { }
        }

        if (requests[1].status === "fulfilled") {
            try {
                const data = await requests[1].value.json();

                if (requests[1].value.ok) {
                    setQuotations(
                        data.quotations ||
                        data.purchaseQuotations ||
                        data.data ||
                        []
                    );
                }
            } catch { }
        }

        if (requests[2].status === "fulfilled") {
            try {
                const data = await requests[2].value.json();

                if (requests[2].value.ok) {
                    setProducts(
                        data.products ||
                        data.data ||
                        data ||
                        []
                    );
                }
            } catch { }
        }
    }, []);

    // --------------------------------------------------
    // PERMISSION INITIALIZATION
    // --------------------------------------------------

    useEffect(() => {
        let isMounted = true;

        const initializePage = async () => {
            setPermissionsLoading(true);

            try {
                const response = await fetch(
                    "/api/auth/my-permissions",
                    {
                        cache: "no-store",
                    }
                );

                const data = await response.json();

                if (!response.ok) {
                    throw new Error(
                        data.message ||
                        "Unable to load user permissions."
                    );
                }

                const purchaseOrderPermission = (
                    Array.isArray(data.permissions)
                        ? data.permissions
                        : []
                ).find(
                    (permission) =>
                        permission.permission_key === "purchase_orders"
                );

                const permissions = {
                    can_view:
                        purchaseOrderPermission?.can_view === true,
                    can_create:
                        purchaseOrderPermission?.can_create === true,
                    can_update:
                        purchaseOrderPermission?.can_update === true,
                    can_delete:
                        purchaseOrderPermission?.can_delete === true,
                };

                if (!isMounted) return;

                setPagePermissions(permissions);

                // Do not load purchase-order data without view permission.
                if (!permissions.can_view) {
                    return;
                }

                await Promise.all([
                    loadOrders(),
                    loadDropdownData(),
                ]);
            } catch (error) {
                if (isMounted) {
                    setPagePermissions(null);
                    setError(error.message);
                }
            } finally {
                if (isMounted) {
                    setPermissionsLoading(false);
                }
            }
        };

        initializePage();

        return () => {
            isMounted = false;
        };
    }, [loadOrders, loadDropdownData]);

    // --------------------------------------------------
    // FILTER PURCHASE ORDERS
    // --------------------------------------------------

    const filteredOrders = useMemo(() => {
        const searchText = search.trim().toLowerCase();

        return orders.filter((order) => {
            const matchesStatus =
                statusFilter === "ALL" ||
                String(order.status).toUpperCase() === statusFilter;

            const searchable = [
                order.purchase_order_number,
                order.purchaseOrderNumber,
                order.supplier_name,
                order.supplierName,
                order.quotation_number,
                order.quotationNumber,
                order.status,
            ]
                .filter(Boolean)
                .join(" ")
                .toLowerCase();

            return (
                matchesStatus &&
                (!searchText || searchable.includes(searchText))
            );
        });
    }, [orders, search, statusFilter]);

    // --------------------------------------------------
    // FORM UPDATE FUNCTIONS
    // --------------------------------------------------

    const updateForm = (field, value) => {
        setForm((current) => ({
            ...current,
            [field]: value,
        }));
    };

    const updateItem = (index, field, value) => {
        setForm((current) => ({
            ...current,
            items: current.items.map((item, itemIndex) =>
                itemIndex === index
                    ? { ...item, [field]: value }
                    : item
            ),
        }));
    };

    // --------------------------------------------------
    // ADD ITEM
    // --------------------------------------------------

    const addItem = () => {
        const allowed =
            mode === "create" ? canCreate : canUpdate;

        if (!allowed) {
            setError(
                mode === "create"
                    ? "You do not have permission to create Purchase Orders."
                    : "You do not have permission to update Purchase Orders."
            );
            return;
        }

        setForm((current) => ({
            ...current,
            items: [...current.items, emptyItem()],
        }));
    };

    // --------------------------------------------------
    // REMOVE ITEM
    // --------------------------------------------------

    const removeItem = (index) => {
        const allowed =
            mode === "create" ? canCreate : canUpdate;

        if (!allowed) {
            setError(
                mode === "create"
                    ? "You do not have permission to create Purchase Orders."
                    : "You do not have permission to update Purchase Orders."
            );
            return;
        }

        setForm((current) => ({
            ...current,
            items:
                current.items.length > 1
                    ? current.items.filter(
                        (_, itemIndex) => itemIndex !== index
                    )
                    : [emptyItem()],
        }));
    };

    // --------------------------------------------------
    // SELECT PRODUCT
    // --------------------------------------------------

    const selectProduct = (index, productId) => {
        const allowed =
            mode === "create" ? canCreate : canUpdate;

        if (!allowed) {
            setError("You do not have permission to modify this Purchase Order.");
            return;
        }

        const product = products.find(
            (item) =>
                String(item.product_id ?? item.id) ===
                String(productId)
        );

        setForm((current) => ({
            ...current,
            items: current.items.map((item, itemIndex) =>
                itemIndex === index
                    ? {
                        ...item,
                        productId,
                        itemDescription:
                            product?.product_name ||
                            product?.name ||
                            item.itemDescription,
                        uom:
                            product?.unit ||
                            product?.uom ||
                            item.uom,
                    }
                    : item
            ),
        }));
    };

    // --------------------------------------------------
    // START CREATE
    // --------------------------------------------------

    const startCreate = () => {
        if (!canCreate) {
            setError(
                "You do not have permission to create Purchase Orders."
            );
            return;
        }

        setError("");
        setSuccess("");
        setSelectedOrder(null);
        setForm(emptyForm());
        setMode("create");
        setScreen("form");
    };

    // --------------------------------------------------
    // OPEN PURCHASE ORDER
    // --------------------------------------------------

    const openOrder = async (id, requestedMode = "view") => {
        if (requestedMode === "edit" && !canUpdate) {
            setError(
                "You do not have permission to edit Purchase Orders."
            );
            return;
        }

        if (!canView) {
            setError(
                "You do not have permission to view Purchase Orders."
            );
            return;
        }

        setError("");
        setSuccess("");
        setDetailLoading(true);

        try {
            const response = await fetch(`${API_URL}/${id}`, {
                cache: "no-store",
            });

            const data = await response.json();

            if (!response.ok || data.success === false) {
                throw new Error(
                    getErrorMessage(
                        data,
                        "Unable to load purchase order."
                    )
                );
            }

            const rawOrder =
                data.purchaseOrder ||
                data.order ||
                data.data;

            if (!rawOrder) {
                throw new Error(
                    "Purchase order details were not returned by the API."
                );
            }

            const order = normalizeOrder(rawOrder);

            setSelectedOrder(order);

            setForm({
                sourceType: order.purchase_quotation_id
                    ? "QUOTATION"
                    : "MANUAL",
                purchaseQuotationId: String(
                    order.purchase_quotation_id || ""
                ),
                supplierId: order.supplierId,
                orderDate: order.orderDate || today(),
                expectedDeliveryDate:
                    order.expectedDeliveryDate,
                status: order.status,
                currencyCode: order.currencyCode,
                exchangeRate: order.exchangeRate,
                paymentTerms: order.paymentTerms,
                referenceNo: order.referenceNo,
                locationName: order.locationName,
                department: order.department,
                className: order.className,
                project: order.project,
                memo: order.memo,
                termsConditions: order.termsConditions,
                remarks: order.remarks,
                items:
                    order.items.length > 0
                        ? order.items
                        : [emptyItem()],
            });

            setMode(requestedMode);
            setScreen("form");
        } catch (err) {
            setError(err.message);
        } finally {
            setDetailLoading(false);
        }
    };

    // --------------------------------------------------
    // START EDIT
    // --------------------------------------------------

    const startEdit = (order) => {
        if (!canUpdate) {
            setError(
                "You do not have permission to edit Purchase Orders."
            );
            return;
        }

        openOrder(
            order.purchase_order_id ??
            order.purchaseOrderId,
            "edit"
        );
    };

    // --------------------------------------------------
    // START VIEW
    // --------------------------------------------------

    const startView = (order) => {
        if (!canView) {
            setError(
                "You do not have permission to view Purchase Orders."
            );
            return;
        }

        openOrder(
            order.purchase_order_id ??
            order.purchaseOrderId,
            "view"
        );
    };

    // --------------------------------------------------
    // BACK TO LIST
    // --------------------------------------------------

    const backToList = () => {
        setScreen("list");
        setMode("view");
        setSelectedOrder(null);
        setError("");
        setSuccess("");
        loadOrders();
    };

    // --------------------------------------------------
    // LOAD PURCHASE QUOTATION
    // --------------------------------------------------

    const loadQuotation = async (quotationId) => {
        if (!canCreate) {
            setError(
                "You do not have permission to create Purchase Orders."
            );
            return;
        }

        if (!quotationId) return;

        setError("");

        try {
            const response = await fetch(
                `${QUOTATIONS_API}/${quotationId}`,
                { cache: "no-store" }
            );

            const data = await response.json();

            if (!response.ok || data.success === false) {
                throw new Error(
                    getErrorMessage(
                        data,
                        "Unable to load purchase quotation."
                    )
                );
            }

            const quotation = data.quotation;

            if (!quotation) {
                throw new Error(
                    "Quotation details were not returned."
                );
            }

            if (
                String(quotation.status).toUpperCase() !==
                "APPROVED"
            ) {
                throw new Error(
                    "Only APPROVED purchase quotations can be converted."
                );
            }

            setForm((current) => ({
                ...current,
                sourceType: "QUOTATION",
                purchaseQuotationId: String(
                    quotation.purchase_quotation_id
                ),
                supplierId: String(quotation.supplier_id || ""),
                currencyCode:
                    quotation.currency_code || "PKR",
                exchangeRate: String(
                    quotation.exchange_rate || 1
                ),
                termsConditions:
                    quotation.terms_conditions || "",
                remarks: quotation.remarks || "",
                items: (quotation.items || []).map((item) => ({
                    ...normalizeItem(item),
                })),
            }));
        } catch (err) {
            setError(err.message);
        }
    };

    // --------------------------------------------------
    // VALIDATE FORM
    // --------------------------------------------------

    const validateForm = () => {
        if (form.sourceType === "MANUAL" && !form.supplierId) {
            return "Please select a vendor.";
        }

        if (
            form.sourceType === "QUOTATION" &&
            !form.purchaseQuotationId
        ) {
            return "Please select a purchase quotation.";
        }

        if (!form.orderDate) {
            return "Please select the transaction date.";
        }

        if (number(form.exchangeRate) <= 0) {
            return "Exchange rate must be greater than zero.";
        }

        if (!form.items.length) {
            return "Please add at least one transaction line.";
        }

        for (let index = 0; index < form.items.length; index++) {
            const item = form.items[index];

            if (!item.itemDescription.trim()) {
                return `Please enter the item description in row ${index + 1}.`;
            }

            if (number(item.quantity) <= 0) {
                return `Quantity must be greater than zero in row ${index + 1}.`;
            }

            if (number(item.unitPrice) < 0) {
                return `Unit price cannot be negative in row ${index + 1}.`;
            }
        }

        return "";
    };

    // --------------------------------------------------
    // SAVE PURCHASE ORDER
    // --------------------------------------------------

    const saveOrder = async () => {
        setError("");
        setSuccess("");

        const isCreating = mode === "create";
        const isEditing = mode === "edit" && selectedOrder;

        // Permission validation.
        if (isCreating && !canCreate) {
            setError(
                "You do not have permission to create Purchase Orders."
            );
            return;
        }

        if (mode === "edit" && !canUpdate) {
            setError(
                "You do not have permission to update Purchase Orders."
            );
            return;
        }

        if (!isCreating && !isEditing) {
            setError(
                "Invalid Purchase Order operation. Please reopen the order."
            );
            return;
        }

        const validationMessage = validateForm();

        if (validationMessage) {
            setError(validationMessage);
            return;
        }

        setSaving(true);

        try {
            const items = calculatedItems.map((item) => ({
                productId: item.productId
                    ? Number(item.productId)
                    : null,
                itemDescription: item.itemDescription,
                uom: item.uom,
                quantity: number(item.quantity),
                unitPrice: number(item.unitPrice),
                discountAmount: number(item.discountAmount),
                taxRate: number(item.taxRate),
                taxAmount: number(item.taxAmount),
                lineTotal: number(item.lineTotal),
                remarks: item.remarks,
            }));

            const payload = {
                sourceType: form.sourceType,
                supplierId: form.supplierId
                    ? Number(form.supplierId)
                    : null,
                purchaseQuotationId:
                    form.purchaseQuotationId
                        ? Number(form.purchaseQuotationId)
                        : null,
                orderDate: form.orderDate,
                expectedDeliveryDate:
                    form.expectedDeliveryDate || null,
                status: form.status,
                currencyCode: form.currencyCode,
                exchangeRate: number(form.exchangeRate),
                subtotal: totals.subtotal,
                discountAmount: totals.discountAmount,
                taxAmount: totals.taxAmount,
                grandTotal: totals.grandTotal,
                termsConditions: form.termsConditions,
                remarks: form.remarks || form.memo,
                items,
            };

            const url = isEditing
                ? `${API_URL}/${selectedOrder.purchaseOrderId}`
                : API_URL;

            const response = await fetch(url, {
                method: isEditing ? "PATCH" : "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify(payload),
            });

            const data = await response.json();

            if (!response.ok || data.success === false) {
                throw new Error(
                    getErrorMessage(
                        data,
                        "Unable to save purchase order."
                    )
                );
            }

            const savedId =
                data.purchaseOrder?.purchase_order_id ??
                data.purchaseOrder?.purchaseOrderId ??
                data.purchase_order_id ??
                data.purchaseOrderId ??
                data.id ??
                selectedOrder?.purchaseOrderId;

            setSuccess(
                isEditing
                    ? "Purchase Order updated successfully."
                    : "Purchase Order created successfully."
            );

            await loadOrders();

            if (savedId) {
                await openOrder(savedId, "view");
            } else {
                backToList();
            }
        } catch (err) {
            setError(err.message);
        } finally {
            setSaving(false);
        }
    };

    // --------------------------------------------------
    // DELETE PURCHASE ORDER
    // --------------------------------------------------

    const deleteOrder = async (order) => {
        if (!canDelete) {
            setError(
                "You do not have permission to delete Purchase Orders."
            );
            return;
        }

        const id =
            order.purchase_order_id ??
            order.purchaseOrderId;

        if (
            !window.confirm(
                `Are you sure you want to delete Purchase Order ${order.purchase_order_number || order.purchaseOrderNumber}?`
            )
        ) {
            return;
        }

        setError("");
        setSuccess("");

        try {
            const response = await fetch(`${API_URL}/${id}`, {
                method: "DELETE",
            });

            const data = await response.json();

            if (!response.ok || data.success === false) {
                throw new Error(
                    getErrorMessage(
                        data,
                        "Unable to delete purchase order."
                    )
                );
            }

            setSuccess("Purchase Order deleted successfully.");
            await loadOrders();
        } catch (err) {
            setError(err.message);
        }
    };

    // --------------------------------------------------
    // PRINT PURCHASE ORDER REPORT
    // --------------------------------------------------

    const printReport = (order = null) => {
        const currentOrder = order || selectedOrder;

        if (!currentOrder) {
            setError("Please select a Purchase Order first.");
            return;
        }

        const items = currentOrder.items || [];

        const escapeHtml = (value) =>
            String(value ?? "").replace(/[&<>"']/g, (character) => ({
                "&": "&amp;",
                "<": "&lt;",
                ">": "&gt;",
                '"': "&quot;",
                "'": "&#039;",
            })[character]);

        const rows = items.map((item, index) => `
            <tr>
                <td>${index + 1}</td>
                <td>${escapeHtml(item.itemDescription || item.item_description || "")}</td>
                <td>${escapeHtml(item.uom || "")}</td>
                <td class="right">${number(item.quantity)}</td>
                <td class="right">${money(item.unitPrice ?? item.unit_price)}</td>
                <td class="right">${money(item.discountAmount ?? item.discount_amount)}</td>
                <td class="right">${money(item.taxAmount ?? item.tax_amount)}</td>
                <td class="right">${money(item.lineTotal ?? item.line_total)}</td>
            </tr>
        `).join("");

        const orderNumber = escapeHtml(
            currentOrder.purchaseOrderNumber ||
            currentOrder.purchase_order_number ||
            ""
        );

        const vendor = escapeHtml(
            currentOrder.supplierName ||
            currentOrder.supplier_name ||
            ""
        );

        const orderDate = escapeHtml(
            displayDate(currentOrder.orderDate || currentOrder.order_date)
        );

        const html = `
            <!DOCTYPE html>
            <html>
            <head>
                <title>Purchase Order ${orderNumber}</title>
                <meta charset="UTF-8">

                <style>
                    body {
                        font-family: Arial, sans-serif;
                        color: #222;
                        padding: 30px;
                        font-size: 13px;
                    }

                    h1 {
                        margin-bottom: 5px;
                    }

                    .muted {
                        color: #666;
                    }

                    .header {
                        display: flex;
                        justify-content: space-between;
                        border-bottom: 2px solid #222;
                        padding-bottom: 18px;
                        margin-bottom: 20px;
                    }

                    .details {
                        display: grid;
                        grid-template-columns: 1fr 1fr;
                        gap: 12px;
                        margin-bottom: 25px;
                    }

                    table {
                        width: 100%;
                        border-collapse: collapse;
                        margin-top: 20px;
                    }

                    th, td {
                        border: 1px solid #ccc;
                        padding: 9px;
                        font-size: 12px;
                    }

                    th {
                        background: #eee;
                        text-align: left;
                    }

                    .right {
                        text-align: right;
                    }

                    .totals {
                        margin: 20px 0 0 auto;
                        width: 300px;
                    }

                    .totals div {
                        display: flex;
                        justify-content: space-between;
                        padding: 7px;
                        border-bottom: 1px solid #ddd;
                    }

                    .grand {
                        font-weight: bold;
                        font-size: 16px;
                    }

                    @media print {
                        body {
                            padding: 0;
                        }

                        thead {
                            display: table-header-group;
                        }

                        tr {
                            page-break-inside: avoid;
                        }
                    }
                </style>
            </head>

            <body>
                <div class="header">
                    <div>
                        <h1>Purchase Order</h1>
                        <div class="muted">Purchase Order Report</div>
                    </div>

                    <div>
                        <strong>${orderNumber}</strong><br>
                        <span>${orderDate}</span>
                    </div>
                </div>

                <div class="details">
                    <div><strong>Vendor:</strong> ${vendor}</div>
                    <div><strong>Status:</strong> ${escapeHtml(currentOrder.status || "")}</div>
                    <div><strong>Location:</strong> ${escapeHtml(currentOrder.locationName || currentOrder.location_name || "Finish Goods Store")}</div>
                    <div><strong>Currency:</strong> ${escapeHtml(currentOrder.currencyCode || currentOrder.currency_code || "PKR")}</div>
                    <div><strong>Expected Delivery:</strong> ${escapeHtml(displayDate(currentOrder.expectedDeliveryDate || currentOrder.expected_delivery_date))}</div>
                    <div><strong>Created From:</strong> ${escapeHtml(currentOrder.quotationNumber || currentOrder.quotation_number || "-")}</div>
                </div>

                <table>
                    <thead>
                        <tr>
                            <th>#</th>
                            <th>Item Description</th>
                            <th>UOM</th>
                            <th>Quantity</th>
                            <th>Unit Price</th>
                            <th>Discount</th>
                            <th>Tax</th>
                            <th>Gross Amount</th>
                        </tr>
                    </thead>

                    <tbody>
                        ${rows}
                    </tbody>
                </table>

                <div class="totals">
                    <div>
                        <span>Subtotal</span>
                        <strong>${money(currentOrder.subtotal)}</strong>
                    </div>

                    <div>
                        <span>Discount</span>
                        <strong>${money(currentOrder.discount_amount)}</strong>
                    </div>

                    <div>
                        <span>Tax Amount</span>
                        <strong>${money(currentOrder.tax_amount)}</strong>
                    </div>

                    <div class="grand">
                        <span>Gross Amount</span>
                        <strong>${money(currentOrder.grand_total)}</strong>
                    </div>
                </div>

                <p style="margin-top:35px">
                    <strong>Terms & Conditions</strong>
                </p>

                <p>${escapeHtml(currentOrder.termsConditions || currentOrder.terms_conditions || "")}</p>

                <p style="margin-top:35px">
                    <strong>Remarks</strong>
                </p>

                <p>${escapeHtml(currentOrder.remarks || "")}</p>
            </body>
            </html>
        `;

        const iframe = document.createElement("iframe");

        iframe.style.position = "fixed";
        iframe.style.width = "0";
        iframe.style.height = "0";
        iframe.style.border = "0";
        iframe.style.right = "0";
        iframe.style.bottom = "0";

        document.body.appendChild(iframe);

        const printDocument = iframe.contentWindow.document;

        printDocument.open();
        printDocument.write(html);
        printDocument.close();

        iframe.onload = () => {
            iframe.contentWindow.focus();
            iframe.contentWindow.print();

            setTimeout(() => {
                iframe.remove();
            }, 1000);
        };
    };

    // --------------------------------------------------
    // FORM DISPLAY VALUES
    // --------------------------------------------------

    const isReadOnly = mode === "view";
    const isNew = mode === "create";

    // A create-only user must also be allowed to add/remove
    // transaction lines while creating a new Purchase Order.
    const canModifyCurrentForm =
        isNew ? canCreate : canUpdate;

    const orderNumber =
        selectedOrder?.purchaseOrderNumber || "TO BE GENERATE";

    const selectedSupplier = suppliers.find(
        (supplier) =>
            String(
                supplier.supplier_id ?? supplier.id
            ) === String(form.supplierId)
    );

    const eligibleQuotations = quotations.filter((quotation) => {
        const status = String(quotation.status || "").toUpperCase();

        return (
            status === "APPROVED" &&
            !quotation.converted_to_order &&
            !quotation.purchase_order_id
        );
    });

    // --------------------------------------------------
    // PERMISSION LOADING
    // --------------------------------------------------

    if (permissionsLoading) {
        return (
            <div className="flex min-h-[400px] items-center justify-center">
                <div className="text-sm text-gray-500 dark:text-gray-400">
                    Loading Purchase Orders permissions...
                </div>
            </div>
        );
    }

    // --------------------------------------------------
    // ACCESS DENIED
    // --------------------------------------------------

    if (!canView) {
        return (
            <div className="flex min-h-[400px] items-center justify-center p-6">
                <div className="max-w-md rounded-xl border border-red-200 bg-white p-8 text-center shadow-sm dark:border-red-900 dark:bg-gray-900">
                    <div className="mb-3 text-lg font-semibold text-red-600">
                        Access Denied
                    </div>

                    <p className="text-sm text-gray-600 dark:text-gray-400">
                        {error ||
                            "You do not have permission to view Purchase Orders. Please contact your administrator."}
                    </p>
                </div>
            </div>
        );
    }

    // --------------------------------------------------
    // MAIN PAGE
    // --------------------------------------------------

    return (
        <div className="min-h-screen bg-slate-50 p-4 text-slate-800 dark:bg-slate-950 dark:text-slate-100 md:p-6">

            {/* PAGE HEADER */}
            <div className="mb-6 flex flex-col justify-between gap-4 md:flex-row md:items-center">
                <div>
                    <div className="flex items-center gap-3">
                        <div className="rounded-xl bg-blue-600 p-3 text-white shadow-sm">
                            <ShoppingCart size={23} />
                        </div>

                        <div>
                            <h1 className="text-2xl font-bold">
                                Purchase Order
                            </h1>

                            <p className="text-sm text-slate-500 dark:text-slate-400">
                                Manage purchase orders and supplier commitments
                            </p>
                        </div>
                    </div>
                </div>

                {screen === "list" ? (
                    <div className="flex flex-wrap gap-2">
                        <button
                            onClick={loadOrders}
                            className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:hover:bg-slate-800"
                        >
                            <RefreshCw size={16} />
                            Refresh
                        </button>

                        {canCreate && (
                            <button
                                onClick={startCreate}
                                className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-700"
                            >
                                <Plus size={18} />
                                Create Purchase Order
                            </button>
                        )}
                    </div>
                ) : (
                    <div className="flex flex-wrap gap-2">
                        <button
                            onClick={backToList}
                            className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:hover:bg-slate-800"
                        >
                            <ArrowLeft size={16} />
                            Back
                        </button>

                        {mode === "view" && canUpdate && (
                            <button
                                onClick={() => setMode("edit")}
                                className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700"
                            >
                                <Pencil size={16} />
                                Edit
                            </button>
                        )}

                        {mode === "edit" && canUpdate && (
                            <button
                                onClick={saveOrder}
                                disabled={saving}
                                className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
                            >
                                <Save size={16} />
                                {saving ? "Saving..." : "Save"}
                            </button>
                        )}

                        {mode === "create" && canCreate && (
                            <button
                                onClick={saveOrder}
                                disabled={saving}
                                className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
                            >
                                <Save size={16} />
                                {saving ? "Saving..." : "Save Purchase Order"}
                            </button>
                        )}

                        {!isNew && (
                            <button
                                type="button"
                                onClick={printReport}
                                className="rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
                            >
                                Report
                            </button>
                        )}
                    </div>
                )}
            </div>

            {/* ALERTS */}
            {error && (
                <div className="mb-4 flex items-start justify-between gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
                    <span>{error}</span>

                    <button onClick={() => setError("")}>
                        <X size={17} />
                    </button>
                </div>
            )}

            {success && (
                <div className="mb-4 flex items-start justify-between gap-3 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700 dark:border-green-900 dark:bg-green-950/40 dark:text-green-300">
                    <span>{success}</span>

                    <button onClick={() => setSuccess("")}>
                        <X size={17} />
                    </button>
                </div>
            )}

            {/* HISTORY SCREEN */}
            {screen === "list" && (
                <>
                    <div className="mb-5 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                            <p className="text-sm text-slate-500">
                                Total Orders
                            </p>

                            <p className="mt-1 text-2xl font-bold">
                                {orders.length}
                            </p>
                        </div>

                        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                            <p className="text-sm text-slate-500">
                                Draft
                            </p>

                            <p className="mt-1 text-2xl font-bold text-slate-700 dark:text-slate-200">
                                {orders.filter(
                                    (order) => order.status === "DRAFT"
                                ).length}
                            </p>
                        </div>

                        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                            <p className="text-sm text-slate-500">
                                Approved
                            </p>

                            <p className="mt-1 text-2xl font-bold text-green-600">
                                {orders.filter(
                                    (order) => order.status === "APPROVED"
                                ).length}
                            </p>
                        </div>

                        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                            <p className="text-sm text-slate-500">
                                Closed
                            </p>

                            <p className="mt-1 text-2xl font-bold text-blue-600">
                                {orders.filter(
                                    (order) => order.status === "CLOSED"
                                ).length}
                            </p>
                        </div>
                    </div>

                    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
                        <div className="flex flex-col justify-between gap-3 border-b border-slate-200 p-4 dark:border-slate-800 md:flex-row md:items-center">
                            <div>
                                <h2 className="font-semibold">
                                    Purchase Order History
                                </h2>

                                <p className="text-xs text-slate-500">
                                    View, edit and print purchase orders
                                </p>
                            </div>

                            <div className="flex flex-col gap-2 sm:flex-row">
                                <div className="relative">
                                    <Search
                                        size={17}
                                        className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                                    />

                                    <input
                                        value={search}
                                        onChange={(event) =>
                                            setSearch(event.target.value)
                                        }
                                        placeholder="Search orders..."
                                        className="w-full rounded-lg border border-slate-300 bg-white py-2 pl-9 pr-3 text-sm outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-950 sm:w-64"
                                    />
                                </div>

                                <select
                                    value={statusFilter}
                                    onChange={(event) =>
                                        setStatusFilter(event.target.value)
                                    }
                                    className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-950"
                                >
                                    <option value="ALL">
                                        All Statuses
                                    </option>

                                    {STATUS_OPTIONS.map((status) => (
                                        <option key={status} value={status}>
                                            {status}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        {loading ? (
                            <div className="flex items-center justify-center gap-2 p-12 text-sm text-slate-500">
                                <RefreshCw
                                    className="animate-spin"
                                    size={18}
                                />
                                Loading purchase orders...
                            </div>
                        ) : filteredOrders.length === 0 ? (
                            <div className="flex flex-col items-center justify-center px-5 py-16 text-center">
                                <div className="mb-3 rounded-full bg-slate-100 p-4 dark:bg-slate-800">
                                    <ClipboardList
                                        size={30}
                                        className="text-slate-400"
                                    />
                                </div>

                                <h3 className="font-semibold">
                                    No Purchase Orders Found
                                </h3>

                                <p className="mt-1 max-w-md text-sm text-slate-500">
                                    Create a Purchase Order manually or convert an approved Purchase Quotation.
                                </p>

                                {canCreate && (
                                    <button
                                        onClick={startCreate}
                                        className="mt-4 inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
                                    >
                                        <Plus size={16} />
                                        Create Purchase Order
                                    </button>
                                )}
                            </div>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full min-w-[1250px] text-left text-sm">
                                    <thead className="bg-slate-100 text-xs uppercase text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                                        <tr>
                                            {canUpdate && (
                                                <th className="px-3 py-3">
                                                    Edit
                                                </th>
                                            )}

                                            <th className="px-3 py-3">
                                                View
                                            </th>

                                            <th className="px-3 py-3">
                                                Report
                                            </th>

                                            <th className="px-3 py-3">
                                                Trandate
                                            </th>

                                            <th className="px-3 py-3">
                                                Vendor
                                            </th>

                                            <th className="px-3 py-3">
                                                Transaction Number
                                            </th>

                                            <th className="px-3 py-3">
                                                Location Name
                                            </th>

                                            <th className="px-3 py-3">
                                                Status
                                            </th>

                                            <th className="px-3 py-3">
                                                Created From
                                            </th>

                                            <th className="px-3 py-3">
                                                Document Status
                                            </th>
                                        </tr>
                                    </thead>

                                    <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                                        {filteredOrders.map((order) => {
                                            const id =
                                                order.purchase_order_id ??
                                                order.purchaseOrderId;

                                            const transactionNumber =
                                                order.purchase_order_number ||
                                                order.purchaseOrderNumber ||
                                                "-";

                                            return (
                                                <tr
                                                    key={id}
                                                    className="hover:bg-slate-50 dark:hover:bg-slate-800/50"
                                                >
                                                    {canUpdate && (
                                                        <td className="px-3 py-3">
                                                            <button
                                                                onClick={() =>
                                                                    startEdit(order)
                                                                }
                                                                title="Edit"
                                                                className="rounded-md p-2 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/40"
                                                            >
                                                                <Pencil size={16} />
                                                            </button>
                                                        </td>
                                                    )}

                                                    <td className="px-3 py-3">
                                                        <button
                                                            onClick={() =>
                                                                startView(order)
                                                            }
                                                            title="View"
                                                            className="rounded-md p-2 text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-700"
                                                        >
                                                            <Eye size={16} />
                                                        </button>
                                                    </td>

                                                    <td className="px-3 py-3">
                                                        <button
                                                            onClick={() =>
                                                                openOrder(id, "view")
                                                            }
                                                            title="Open report details"
                                                            className="rounded-md p-2 text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/40"
                                                        >
                                                            <FileText size={16} />
                                                        </button>
                                                    </td>

                                                    <td className="whitespace-nowrap px-3 py-3">
                                                        {displayDate(
                                                            order.order_date ||
                                                            order.orderDate
                                                        )}
                                                    </td>

                                                    <td className="px-3 py-3 font-medium">
                                                        {order.supplier_name ||
                                                            order.supplierName ||
                                                            "-"}
                                                    </td>

                                                    <td className="whitespace-nowrap px-3 py-3 font-semibold text-blue-700 dark:text-blue-400">
                                                        {transactionNumber}
                                                    </td>

                                                    <td className="px-3 py-3">
                                                        {order.location_name ||
                                                            order.locationName ||
                                                            "Finish Goods Store"}
                                                    </td>

                                                    <td className="px-3 py-3">
                                                        <span
                                                            className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${statusStyle(order.status)}`}
                                                        >
                                                            {order.status}
                                                        </span>
                                                    </td>

                                                    <td className="px-3 py-3">
                                                        {order.quotation_number ||
                                                            order.quotationNumber ||
                                                            order.rfq_number ||
                                                            "-"}
                                                    </td>

                                                    <td className="px-3 py-3">
                                                        {getDocumentStatus(order)}
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        )}

                        <div className="border-t border-slate-200 px-4 py-3 text-xs text-slate-500 dark:border-slate-800">
                            Showing {filteredOrders.length} of {orders.length} purchase orders
                        </div>
                    </div>
                </>
            )}

            {/* CREATE / EDIT / VIEW SCREEN */}
            {screen === "form" && (
                <div className="space-y-5">

                    {/* DOCUMENT TITLE */}
                    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                        <div className="flex flex-col justify-between gap-3 md:flex-row md:items-center">
                            <div>
                                <div className="flex items-center gap-2">
                                    <Package
                                        size={20}
                                        className="text-blue-600"
                                    />

                                    <h2 className="text-lg font-bold">
                                        Purchase Order -{" "}
                                        {isNew
                                            ? ""
                                            : getDocumentStatus(selectedOrder || {})}
                                    </h2>
                                </div>

                                <p className="mt-1 text-sm text-slate-500">
                                    {isNew
                                        ? "Create a new purchase order"
                                        : `${orderNumber} · ${isReadOnly ? "View Mode" : "Edit Mode"}`}
                                </p>
                            </div>

                            {!isNew && (
                                <span
                                    className={`w-fit rounded-full px-3 py-1.5 text-xs font-semibold ${statusStyle(form.status)}`}
                                >
                                    {form.status}
                                </span>
                            )}
                        </div>

                        <div className="mt-5 grid grid-cols-1 gap-x-6 gap-y-4 md:grid-cols-2 lg:grid-cols-3">

                            <div>
                                <label className="mb-1 block text-xs font-semibold text-slate-500">
                                    Transaction No
                                </label>

                                <input
                                    value={orderNumber}
                                    readOnly
                                    className="w-full rounded-lg border border-slate-200 bg-slate-100 px-3 py-2.5 text-sm font-semibold dark:border-slate-700 dark:bg-slate-800"
                                />
                            </div>

                            <div>
                                <label className="mb-1 block text-xs font-semibold text-slate-500">
                                    Status
                                </label>

                                <select
                                    disabled={isReadOnly || !canModifyCurrentForm}
                                    value={form.status}
                                    onChange={(event) =>
                                        updateForm("status", event.target.value)
                                    }
                                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm disabled:bg-slate-100 dark:border-slate-700 dark:bg-slate-950 dark:disabled:bg-slate-800"
                                >
                                    {STATUS_OPTIONS.map((status) => (
                                        <option key={status} value={status}>
                                            {status}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label className="mb-1 block text-xs font-semibold text-slate-500">
                                    Transaction Date
                                </label>

                                <input
                                    type="date"
                                    disabled={isReadOnly || !canModifyCurrentForm}
                                    value={form.orderDate}
                                    onChange={(event) =>
                                        updateForm("orderDate", event.target.value)
                                    }
                                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm disabled:bg-slate-100 dark:border-slate-700 dark:bg-slate-950 dark:disabled:bg-slate-800"
                                />
                            </div>

                            <div>
                                <label className="mb-1 block text-xs font-semibold text-slate-500">
                                    Vendor
                                </label>

                                <select
                                    disabled={
                                        isReadOnly ||
                                        !canModifyCurrentForm ||
                                        form.sourceType === "QUOTATION"
                                    }
                                    value={form.supplierId}
                                    onChange={(event) =>
                                        updateForm("supplierId", event.target.value)
                                    }
                                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm disabled:bg-slate-100 dark:border-slate-700 dark:bg-slate-950 dark:disabled:bg-slate-800"
                                >
                                    <option value="">Select Vendor</option>

                                    {suppliers.map((supplier) => {
                                        const id =
                                            supplier.supplier_id ??
                                            supplier.id;

                                        return (
                                            <option key={id} value={id}>
                                                {supplier.supplier_name ||
                                                    supplier.name ||
                                                    supplier.supplier_code ||
                                                    `Supplier ${id}`}
                                            </option>
                                        );
                                    })}
                                </select>
                            </div>

                            <div>
                                <label className="mb-1 block text-xs font-semibold text-slate-500">
                                    Subsidiary
                                </label>

                                <input
                                    value="Goldenlake Integrated Solutions"
                                    readOnly
                                    className="w-full rounded-lg border border-slate-200 bg-slate-100 px-3 py-2.5 text-sm dark:border-slate-700 dark:bg-slate-800"
                                />
                            </div>

                            <div>
                                <label className="mb-1 block text-xs font-semibold text-slate-500">
                                    Department
                                </label>

                                <input
                                    disabled={isReadOnly || !canModifyCurrentForm}
                                    value={form.department}
                                    onChange={(event) =>
                                        updateForm("department", event.target.value)
                                    }
                                    placeholder="Department"
                                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm disabled:bg-slate-100 dark:border-slate-700 dark:bg-slate-950 dark:disabled:bg-slate-800"
                                />
                            </div>

                            <div>
                                <label className="mb-1 block text-xs font-semibold text-slate-500">
                                    Location
                                </label>

                                <input
                                    value={form.locationName}
                                    readOnly
                                    className="w-full rounded-lg border border-slate-200 bg-slate-100 px-3 py-2.5 text-sm dark:border-slate-700 dark:bg-slate-800"
                                />
                            </div>

                            <div>
                                <label className="mb-1 block text-xs font-semibold text-slate-500">
                                    Class
                                </label>

                                <input
                                    disabled={isReadOnly || !canModifyCurrentForm}
                                    value={form.className}
                                    onChange={(event) =>
                                        updateForm("className", event.target.value)
                                    }
                                    placeholder="Class"
                                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm disabled:bg-slate-100 dark:border-slate-700 dark:bg-slate-950 dark:disabled:bg-slate-800"
                                />
                            </div>

                            <div>
                                <label className="mb-1 block text-xs font-semibold text-slate-500">
                                    Payment Terms
                                </label>

                                <input
                                    disabled={isReadOnly || !canModifyCurrentForm}
                                    value={form.paymentTerms}
                                    onChange={(event) =>
                                        updateForm("paymentTerms", event.target.value)
                                    }
                                    placeholder="e.g. 7 days, 30 days"
                                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm disabled:bg-slate-100 dark:border-slate-700 dark:bg-slate-950 dark:disabled:bg-slate-800"
                                />
                            </div>

                            <div>
                                <label className="mb-1 block text-xs font-semibold text-slate-500">
                                    Expected Delivery Date
                                </label>

                                <input
                                    type="date"
                                    disabled={isReadOnly || !canModifyCurrentForm}
                                    value={form.expectedDeliveryDate || ""}
                                    onChange={(event) =>
                                        updateForm(
                                            "expectedDeliveryDate",
                                            event.target.value
                                        )
                                    }
                                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm disabled:bg-slate-100 dark:border-slate-700 dark:bg-slate-950 dark:disabled:bg-slate-800"
                                />
                            </div>

                            <div>
                                <label className="mb-1 block text-xs font-semibold text-slate-500">
                                    Reference No
                                </label>

                                <input
                                    disabled={isReadOnly || !canModifyCurrentForm}
                                    value={form.referenceNo}
                                    onChange={(event) =>
                                        updateForm("referenceNo", event.target.value)
                                    }
                                    placeholder="Reference number"
                                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm disabled:bg-slate-100 dark:border-slate-700 dark:bg-slate-950 dark:disabled:bg-slate-800"
                                />
                            </div>

                            <div>
                                <label className="mb-1 block text-xs font-semibold text-slate-500">
                                    Project
                                </label>

                                <input
                                    disabled={isReadOnly || !canModifyCurrentForm}
                                    value={form.project}
                                    onChange={(event) =>
                                        updateForm("project", event.target.value)
                                    }
                                    placeholder="Project"
                                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm disabled:bg-slate-100 dark:border-slate-700 dark:bg-slate-950 dark:disabled:bg-slate-800"
                                />
                            </div>
                        </div>

                        {/* QUOTATION CONVERSION */}
                        {isNew && canCreate && (
                            <div className="mt-6 rounded-lg border border-blue-200 bg-blue-50/70 p-4 dark:border-blue-900 dark:bg-blue-950/20">
                                <div className="mb-3 flex items-center gap-2 font-semibold text-blue-800 dark:text-blue-300">
                                    <FilePlus2 size={18} />
                                    Create Purchase Order From
                                </div>

                                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                                    <div>
                                        <label className="mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-300">
                                            Source
                                        </label>

                                        <select
                                            value={form.sourceType}
                                            onChange={(event) => {
                                                const value = event.target.value;

                                                setForm((current) => ({
                                                    ...current,
                                                    sourceType: value,
                                                    purchaseQuotationId: "",
                                                    supplierId: "",
                                                    items: [emptyItem()],
                                                }));
                                            }}
                                            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm dark:border-slate-700 dark:bg-slate-950"
                                        >
                                            <option value="MANUAL">
                                                Manual Purchase Order
                                            </option>

                                            <option value="QUOTATION">
                                                Purchase Quotation
                                            </option>
                                        </select>
                                    </div>

                                    {form.sourceType === "QUOTATION" && (
                                        <div>
                                            <label className="mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-300">
                                                Approved Purchase Quotation
                                            </label>

                                            <select
                                                value={form.purchaseQuotationId}
                                                onChange={(event) => {
                                                    const id = event.target.value;

                                                    updateForm(
                                                        "purchaseQuotationId",
                                                        id
                                                    );

                                                    if (id) {
                                                        loadQuotation(id);
                                                    }
                                                }}
                                                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm dark:border-slate-700 dark:bg-slate-950"
                                            >
                                                <option value="">
                                                    Select Purchase Quotation
                                                </option>

                                                {eligibleQuotations.map((quotation) => {
                                                    const id =
                                                        quotation.purchase_quotation_id ??
                                                        quotation.id;

                                                    return (
                                                        <option key={id} value={id}>
                                                            {quotation.quotation_number ||
                                                                quotation.transaction_number ||
                                                                `Quotation ${id}`}
                                                            {" — "}
                                                            {quotation.supplier_name || ""}
                                                        </option>
                                                    );
                                                })}
                                            </select>
                                        </div>
                                    )}
                                </div>

                                {form.sourceType === "QUOTATION" && (
                                    <p className="mt-2 text-xs text-blue-700 dark:text-blue-300">
                                        Selecting an approved quotation imports its vendor, items, quantities, prices, discounts and taxes.
                                    </p>
                                )}
                            </div>
                        )}

                        {/* CURRENCY */}
                        <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-3">
                            <div>
                                <label className="mb-1 block text-xs font-semibold text-slate-500">
                                    Currency
                                </label>

                                <select
                                    disabled={
                                        isReadOnly ||
                                        !canModifyCurrentForm ||
                                        form.sourceType === "QUOTATION"
                                    }
                                    value={form.currencyCode}
                                    onChange={(event) =>
                                        updateForm("currencyCode", event.target.value)
                                    }
                                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm disabled:bg-slate-100 dark:border-slate-700 dark:bg-slate-950 dark:disabled:bg-slate-800"
                                >
                                    <option value="PKR">
                                        PKR - Pakistani Rupee
                                    </option>

                                    <option value="USD">
                                        USD - US Dollar
                                    </option>

                                    <option value="EUR">
                                        EUR - Euro
                                    </option>

                                    <option value="GBP">
                                        GBP - British Pound
                                    </option>
                                </select>
                            </div>

                            <div>
                                <label className="mb-1 block text-xs font-semibold text-slate-500">
                                    Exchange Rate
                                </label>

                                <input
                                    type="number"
                                    min="0.000001"
                                    step="0.000001"
                                    disabled={
                                        isReadOnly ||
                                        !canModifyCurrentForm ||
                                        form.sourceType === "QUOTATION"
                                    }
                                    value={form.exchangeRate}
                                    onChange={(event) =>
                                        updateForm("exchangeRate", event.target.value)
                                    }
                                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm disabled:bg-slate-100 dark:border-slate-700 dark:bg-slate-950 dark:disabled:bg-slate-800"
                                />
                            </div>

                            <div>
                                <label className="mb-1 block text-xs font-semibold text-slate-500">
                                    Vendor
                                </label>

                                <input
                                    value={
                                        selectedSupplier?.supplier_name ||
                                        selectedSupplier?.name ||
                                        selectedSupplier?.supplier_code ||
                                        ""
                                    }
                                    readOnly
                                    placeholder="Selected vendor"
                                    className="w-full rounded-lg border border-slate-200 bg-slate-100 px-3 py-2.5 text-sm dark:border-slate-700 dark:bg-slate-800"
                                />
                            </div>
                        </div>
                    </div>

                    {/* SUMMARY */}
                    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                        <div className="mb-4 flex items-center gap-2">
                            <ClipboardList
                                size={19}
                                className="text-blue-600"
                            />

                            <h3 className="font-semibold">
                                Summary
                            </h3>
                        </div>

                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                            <div className="rounded-lg bg-slate-50 p-4 dark:bg-slate-800">
                                <p className="text-xs text-slate-500">
                                    Total Amount
                                </p>

                                <p className="mt-1 text-xl font-bold">
                                    {form.currencyCode}{" "}
                                    {money(totals.subtotal - totals.discountAmount)}
                                </p>
                            </div>

                            <div className="rounded-lg bg-slate-50 p-4 dark:bg-slate-800">
                                <p className="text-xs text-slate-500">
                                    Tax Amount
                                </p>

                                <p className="mt-1 text-xl font-bold">
                                    {form.currencyCode} {money(totals.taxAmount)}
                                </p>
                            </div>

                            <div className="rounded-lg bg-blue-50 p-4 dark:bg-blue-950/30">
                                <p className="text-xs text-blue-700 dark:text-blue-300">
                                    Gross Amount
                                </p>

                                <p className="mt-1 text-xl font-bold text-blue-700 dark:text-blue-300">
                                    {form.currencyCode} {money(totals.grandTotal)}
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* TRANSACTION LINES */}
                    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
                        <div className="flex flex-col justify-between gap-3 border-b border-slate-200 p-5 dark:border-slate-800 md:flex-row md:items-center">
                            <div>
                                <h3 className="font-semibold">
                                    Transaction Lines
                                </h3>

                                <p className="text-xs text-slate-500">
                                    Items, quantities, unit prices, discounts and taxes
                                </p>
                            </div>

                            {!isReadOnly && canModifyCurrentForm && (
                                <button
                                    onClick={addItem}
                                    className="inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
                                >
                                    <PlusCircle size={16} />
                                    Add Item
                                </button>
                            )}
                        </div>

                        <div className="overflow-x-auto">
                            <table className="w-full min-w-[1550px] text-left text-xs">
                                <thead className="bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                                    <tr>
                                        <th className="px-3 py-3">Item Name</th>
                                        <th className="px-3 py-3">Item Description</th>
                                        <th className="px-3 py-3">Item Balance</th>
                                        <th className="px-3 py-3">UOM</th>
                                        <th className="px-3 py-3">Quantity</th>
                                        <th className="px-3 py-3">Retail Price</th>
                                        <th className="px-3 py-3">Discount %</th>
                                        <th className="px-3 py-3">Unit Price</th>
                                        <th className="px-3 py-3">Amount</th>
                                        <th className="px-3 py-3">Tax Code</th>
                                        <th className="px-3 py-3">Tax Amount</th>
                                        <th className="px-3 py-3">Gross Amount</th>
                                        <th className="px-3 py-3">Memo</th>
                                        <th className="px-3 py-3">Item Weight</th>

                                        {!isReadOnly && canModifyCurrentForm && (
                                            <th className="px-3 py-3">
                                                Action
                                            </th>
                                        )}
                                    </tr>
                                </thead>

                                <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                                    {calculatedItems.map((item, index) => {
                                        const amount =
                                            number(item.quantity) *
                                            number(item.unitPrice);

                                        return (
                                            <tr key={index}>
                                                <td className="min-w-[190px] px-2 py-2">
                                                    {isReadOnly ? (
                                                        <span>
                                                            {item.itemDescription}
                                                        </span>
                                                    ) : (
                                                        <select
                                                            disabled={!canModifyCurrentForm}
                                                            value={item.productId}
                                                            onChange={(event) =>
                                                                selectProduct(
                                                                    index,
                                                                    event.target.value
                                                                )
                                                            }
                                                            className="w-full rounded border border-slate-300 bg-white px-2 py-2 disabled:bg-slate-100 dark:border-slate-700 dark:bg-slate-950 dark:disabled:bg-slate-800"
                                                        >
                                                            <option value="">
                                                                Select Item
                                                            </option>

                                                            {products.map((product) => {
                                                                const id =
                                                                    product.product_id ??
                                                                    product.id;

                                                                return (
                                                                    <option
                                                                        key={id}
                                                                        value={id}
                                                                    >
                                                                        {product.product_name ||
                                                                            product.name ||
                                                                            product.sku ||
                                                                            `Product ${id}`}
                                                                    </option>
                                                                );
                                                            })}
                                                        </select>
                                                    )}
                                                </td>

                                                <td className="min-w-[190px] px-2 py-2">
                                                    <input
                                                        disabled={isReadOnly || !canModifyCurrentForm}
                                                        value={item.itemDescription}
                                                        onChange={(event) =>
                                                            updateItem(
                                                                index,
                                                                "itemDescription",
                                                                event.target.value
                                                            )
                                                        }
                                                        placeholder="Description"
                                                        className="w-full rounded border border-slate-300 bg-white px-2 py-2 disabled:border-transparent disabled:bg-transparent dark:border-slate-700 dark:bg-slate-950"
                                                    />
                                                </td>

                                                <td className="px-2 py-2">
                                                    <input
                                                        disabled
                                                        value={item.itemBalance}
                                                        placeholder="-"
                                                        className="w-20 rounded border border-slate-200 bg-slate-100 px-2 py-2 dark:border-slate-700 dark:bg-slate-800"
                                                    />
                                                </td>

                                                <td className="px-2 py-2">
                                                    <input
                                                        disabled={isReadOnly || !canModifyCurrentForm}
                                                        value={item.uom}
                                                        onChange={(event) =>
                                                            updateItem(
                                                                index,
                                                                "uom",
                                                                event.target.value
                                                            )
                                                        }
                                                        className="w-20 rounded border border-slate-300 bg-white px-2 py-2 disabled:border-transparent disabled:bg-transparent dark:border-slate-700 dark:bg-slate-950"
                                                    />
                                                </td>

                                                <td className="px-2 py-2">
                                                    <input
                                                        type="number"
                                                        min="0.0001"
                                                        step="0.0001"
                                                        disabled={isReadOnly || !canModifyCurrentForm}
                                                        value={item.quantity}
                                                        onChange={(event) =>
                                                            updateItem(
                                                                index,
                                                                "quantity",
                                                                event.target.value
                                                            )
                                                        }
                                                        className="w-24 rounded border border-slate-300 bg-white px-2 py-2 disabled:border-transparent disabled:bg-transparent dark:border-slate-700 dark:bg-slate-950"
                                                    />
                                                </td>

                                                <td className="px-2 py-2">
                                                    <input
                                                        type="number"
                                                        disabled
                                                        value={item.retailPrice}
                                                        className="w-24 rounded border border-slate-200 bg-slate-100 px-2 py-2 dark:border-slate-700 dark:bg-slate-800"
                                                    />
                                                </td>

                                                <td className="px-2 py-2">
                                                    <input
                                                        type="number"
                                                        min="0"
                                                        disabled={isReadOnly || !canModifyCurrentForm}
                                                        value={item.discountPercent}
                                                        onChange={(event) =>
                                                            updateItem(
                                                                index,
                                                                "discountPercent",
                                                                event.target.value
                                                            )
                                                        }
                                                        className="w-20 rounded border border-slate-300 bg-white px-2 py-2 disabled:border-transparent disabled:bg-transparent dark:border-slate-700 dark:bg-slate-950"
                                                    />
                                                </td>

                                                <td className="px-2 py-2">
                                                    <input
                                                        type="number"
                                                        min="0"
                                                        step="0.0001"
                                                        disabled={isReadOnly || !canModifyCurrentForm}
                                                        value={item.unitPrice}
                                                        onChange={(event) =>
                                                            updateItem(
                                                                index,
                                                                "unitPrice",
                                                                event.target.value
                                                            )
                                                        }
                                                        className="w-28 rounded border border-slate-300 bg-white px-2 py-2 disabled:border-transparent disabled:bg-transparent dark:border-slate-700 dark:bg-slate-950"
                                                    />
                                                </td>

                                                <td className="whitespace-nowrap px-3 py-2 text-right font-medium">
                                                    {money(amount)}
                                                </td>

                                                <td className="px-2 py-2">
                                                    <input
                                                        disabled
                                                        value={item.taxCode}
                                                        placeholder="-"
                                                        className="w-20 rounded border border-slate-200 bg-slate-100 px-2 py-2 dark:border-slate-700 dark:bg-slate-800"
                                                    />
                                                </td>

                                                <td className="whitespace-nowrap px-3 py-2 text-right">
                                                    {money(item.taxAmount)}
                                                </td>

                                                <td className="whitespace-nowrap px-3 py-2 text-right font-semibold">
                                                    {money(item.lineTotal)}
                                                </td>

                                                <td className="px-2 py-2">
                                                    <input
                                                        disabled={isReadOnly || !canModifyCurrentForm}
                                                        value={item.remarks}
                                                        onChange={(event) =>
                                                            updateItem(
                                                                index,
                                                                "remarks",
                                                                event.target.value
                                                            )
                                                        }
                                                        className="w-28 rounded border border-slate-300 bg-white px-2 py-2 disabled:border-transparent disabled:bg-transparent dark:border-slate-700 dark:bg-slate-950"
                                                    />
                                                </td>

                                                <td className="px-2 py-2">
                                                    <input
                                                        disabled
                                                        value={item.itemWeight}
                                                        placeholder="-"
                                                        className="w-20 rounded border border-slate-200 bg-slate-100 px-2 py-2 dark:border-slate-700 dark:bg-slate-800"
                                                    />
                                                </td>

                                                {!isReadOnly && canModifyCurrentForm && (
                                                    <td className="px-2 py-2">
                                                        <button
                                                            onClick={() =>
                                                                removeItem(index)
                                                            }
                                                            title="Remove item"
                                                            className="rounded p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30"
                                                        >
                                                            <Trash2 size={15} />
                                                        </button>
                                                    </td>
                                                )}
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>

                        <div className="border-t border-slate-200 p-4 dark:border-slate-800">
                            <div className="ml-auto max-w-sm space-y-2 text-sm">
                                <div className="flex justify-between">
                                    <span className="text-slate-500">
                                        Subtotal
                                    </span>

                                    <strong>{money(totals.subtotal)}</strong>
                                </div>

                                <div className="flex justify-between">
                                    <span className="text-slate-500">
                                        Discount
                                    </span>

                                    <strong>{money(totals.discountAmount)}</strong>
                                </div>

                                <div className="flex justify-between">
                                    <span className="text-slate-500">
                                        Tax Amount
                                    </span>

                                    <strong>{money(totals.taxAmount)}</strong>
                                </div>

                                <div className="flex justify-between border-t border-slate-200 pt-3 text-base dark:border-slate-700">
                                    <span className="font-semibold">
                                        Gross Amount
                                    </span>

                                    <strong className="text-blue-700 dark:text-blue-400">
                                        {form.currencyCode} {money(totals.grandTotal)}
                                    </strong>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* RELATED TRANSACTIONS */}
                    {!isNew && (
                        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                            <h3 className="mb-2 font-semibold">
                                Related Transactions
                            </h3>

                            <p className="text-sm text-slate-500">
                                {selectedOrder?.quotationNumber
                                    ? `Created from Purchase Quotation ${selectedOrder.quotationNumber}.`
                                    : "No related purchase quotation is linked to this order."}
                            </p>
                        </div>
                    )}

                    {/* SYSTEM INFORMATION */}
                    {!isNew && (
                        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                            <h3 className="mb-3 font-semibold">
                                System Information
                            </h3>

                            <div className="grid grid-cols-1 gap-3 text-sm md:grid-cols-3">
                                <div>
                                    <span className="text-slate-500">
                                        Created At
                                    </span>

                                    <p className="mt-1">
                                        {selectedOrder?.created_at
                                            ? new Date(
                                                selectedOrder.created_at
                                            ).toLocaleString()
                                            : "-"}
                                    </p>
                                </div>

                                <div>
                                    <span className="text-slate-500">
                                        Updated At
                                    </span>

                                    <p className="mt-1">
                                        {selectedOrder?.updated_at
                                            ? new Date(
                                                selectedOrder.updated_at
                                            ).toLocaleString()
                                            : "-"}
                                    </p>
                                </div>

                                <div>
                                    <span className="text-slate-500">
                                        Created From
                                    </span>

                                    <p className="mt-1">
                                        {selectedOrder?.quotationNumber || "-"}
                                    </p>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* TERMS AND CONDITIONS */}
                    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                        <h3 className="mb-3 font-semibold">
                            Terms & Conditions
                        </h3>

                        <textarea
                            disabled={isReadOnly || !canModifyCurrentForm}
                            rows={3}
                            value={form.termsConditions}
                            onChange={(event) =>
                                updateForm(
                                    "termsConditions",
                                    event.target.value
                                )
                            }
                            placeholder="Enter terms and conditions..."
                            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm disabled:bg-slate-100 dark:border-slate-700 dark:bg-slate-950 dark:disabled:bg-slate-800"
                        />

                        <h3 className="mb-3 mt-5 font-semibold">
                            Memo / Remarks
                        </h3>

                        <textarea
                            disabled={isReadOnly || !canModifyCurrentForm}
                            rows={3}
                            value={form.remarks}
                            onChange={(event) =>
                                updateForm("remarks", event.target.value)
                            }
                            placeholder="Enter memo or remarks..."
                            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm disabled:bg-slate-100 dark:border-slate-700 dark:bg-slate-950 dark:disabled:bg-slate-800"
                        />
                    </div>

                    {/* BOTTOM ACTIONS */}
                    <div className="flex flex-wrap justify-end gap-2 rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
                        <button
                            onClick={backToList}
                            className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-5 py-2.5 text-sm font-medium hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800"
                        >
                            <ArrowLeft size={16} />
                            Back
                        </button>

                        {!isReadOnly && canModifyCurrentForm && (
                            <button
                                onClick={saveOrder}
                                disabled={saving}
                                className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
                            >
                                <Save size={16} />

                                {saving
                                    ? "Saving..."
                                    : isNew
                                        ? "Create Purchase Order"
                                        : "Save"}
                            </button>
                        )}

                        {!isNew && (
                            <button
                                type="button"
                                onClick={printReport}
                                className="rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
                            >
                                Report
                            </button>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}