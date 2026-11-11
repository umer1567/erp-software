
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
    Plus,
    Search,
    RefreshCw,
    FileText,
    Eye,
    Pencil,
    Trash2,
    Printer,
    Download,
    ArrowLeft,
    Save,
    Package,
    Users,
    AlertCircle,
    CheckCircle2,
    Building2,
    ClipboardList,
    Calculator,
    Send,
    X,
    CalendarDays,
    Clock,
} from "lucide-react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

const inputClass =
    "w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-800 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100";

const primaryButton =
    "inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50";

const secondaryButton =
    "inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200";

const SOURCE_PURCHASE = "PURCHASE_REQUISITION";
const SOURCE_PROCUREMENT = "PROCUREMENT_REQUISITION";

function formatDate(value) {
    if (!value) return "—";

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) return "—";

    return date.toLocaleDateString("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric",
    });
}

function today() {
    const date = new Date();
    const offset = date.getTimezoneOffset();

    return new Date(date.getTime() - offset * 60000)
        .toISOString()
        .slice(0, 10);
}

function formatQuantity(value) {
    return Number(value || 0).toLocaleString(undefined, {
        maximumFractionDigits: 3,
    });
}

function formatMoney(value, currency = "PKR") {
    return `${currency} ${Number(value || 0).toLocaleString(undefined, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    })}`;
}

function statusClass(status) {
    const value = String(status || "DRAFT").toUpperCase();

    if (
        ["APPROVED", "RECEIVED", "RESPONDED", "ACCEPTED"].includes(value)
    ) {
        return "border-green-200 bg-green-50 text-green-700 dark:border-green-900 dark:bg-green-950/40 dark:text-green-300";
    }

    if (["CANCELLED", "REJECTED", "DECLINED"].includes(value)) {
        return "border-red-200 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300";
    }

    if (
        ["SENT", "PARTIALLY_RECEIVED", "INVITED", "PENDING"].includes(value)
    ) {
        return "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300";
    }

    return "border-slate-200 bg-slate-100 text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300";
}

function normalizeSourceType(value) {
    return value === SOURCE_PROCUREMENT
        ? SOURCE_PROCUREMENT
        : SOURCE_PURCHASE;
}

function sourceLabel(value) {
    if (value === SOURCE_PROCUREMENT) {
        return "Requisition for Procurement";
    }

    if (value === "MULTIPLE") {
        return "Multiple Sources";
    }

    return "Purchase Requisition";
}

function itemId(item) {
    return Number(
        item?.source_requisition_item_id ||
            item?.seq_id ||
            item?.requisition_item_id
    );
}

function itemSource(item) {
    return normalizeSourceType(item?.source_type);
}

function itemKey(item) {
    return `${itemSource(item)}:${itemId(item)}`;
}

function isValidId(value) {
    return Number.isSafeInteger(Number(value)) && Number(value) > 0;
}

function numberValue(value) {
    const result = Number(value);
    return Number.isFinite(result) ? result : 0;
}

function getQuoteLines(vendor) {
    return (
        vendor?.quote_lines ||
        vendor?.quotation_items ||
        vendor?.items ||
        vendor?.quotes ||
        []
    );
}

function getQuoteAmount(line) {
    const quantity = numberValue(
        line.quoted_quantity ?? line.quantity
    );
    const unitPrice = numberValue(
        line.unit_price ?? line.unitPrice
    );
    const discount = numberValue(
        line.discount_amount ?? line.discountAmount
    );
    const taxRate = numberValue(
        line.tax_rate ?? line.taxRate
    );

    const gross = quantity * unitPrice;
    const taxable = Math.max(0, gross - discount);
    const tax = taxable * taxRate / 100;

    return {
        gross,
        discount,
        tax,
        total: taxable + tax,
    };
}

function makeEmptyQuoteLine(item) {
    return {
        rfqItemId: Number(
            item.rfq_item_id ||
                item.rfqItemId ||
                item.id
        ),
        item: item.item || item.item_name || "",
        description: item.item_description || item.description || "",
        uom: item.uom || "",
        requestedQuantity: numberValue(
            item.quantity ?? item.requested_quantity
        ),
        quotedQuantity: numberValue(
            item.quantity ?? item.requested_quantity
        ),
        unitPrice: "",
        taxRate: 0,
        discountAmount: 0,
    };
}

function normalizeQuoteLine(line, item) {
    const quantity = line.quoted_quantity ?? line.quotedQuantity;
    const unitPrice = line.unit_price ?? line.unitPrice;
    const taxRate = line.tax_rate ?? line.taxRate;
    const discount = line.discount_amount ?? line.discountAmount;

    return {
        rfqItemId: Number(
            line.rfq_item_id ??
                line.rfqItemId ??
                item?.rfq_item_id
        ),
        item:
            line.item ||
            line.item_name ||
            item?.item ||
            "",
        description:
            line.item_description ||
            line.description ||
            item?.item_description ||
            "",
        uom: line.uom || item?.uom || "",
        requestedQuantity: numberValue(
            item?.quantity ?? item?.requested_quantity
        ),
        quotedQuantity: numberValue(quantity),
        unitPrice: numberValue(unitPrice),
        taxRate: numberValue(taxRate),
        discountAmount: numberValue(discount),
    };
}

export default function RFQsPage() {
    const [rfqs, setRfqs] = useState([]);
    const [suppliers, setSuppliers] = useState([]);
    const [availableItems, setAvailableItems] = useState([]);
    const [procurementItems, setProcurementItems] = useState([]);
    const [company, setCompany] = useState({});

    const [permissions, setPermissions] = useState({
        canCreate: false,
        canUpdate: false,
        canDelete: false,
    });

    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [refreshing, setRefreshing] = useState(false);

    const [error, setError] = useState("");
    const [success, setSuccess] = useState("");
    const [search, setSearch] = useState("");

    // list | create | edit | view
    const [screen, setScreen] = useState("list");
    const [activeTab, setActiveTab] = useState("lines");

    const [currentId, setCurrentId] = useState(null);
    const [currentItems, setCurrentItems] = useState([]);

    const [transactionNumber, setTransactionNumber] =
        useState("TO BE GENERATED");

    const [transactionDate, setTransactionDate] = useState(today());
    const [status, setStatus] = useState("DRAFT");
    const [project, setProject] = useState("");
    const [referenceNumber, setReferenceNumber] = useState("");
    const [memo, setMemo] = useState("");

    const [selectedItemIds, setSelectedItemIds] = useState([]);
    const [selectedSupplierIds, setSelectedSupplierIds] = useState([]);

    const [itemSearch, setItemSearch] = useState("");
    const [supplierSearch, setSupplierSearch] = useState("");
    const [sourceFilter, setSourceFilter] = useState("ALL");

    // Supplier quotation states
    const [quoteLoading, setQuoteLoading] = useState(false);
    const [quoteSaving, setQuoteSaving] = useState(false);
    const [quoteData, setQuoteData] = useState(null);
    const [quoteItems, setQuoteItems] = useState([]);
    const [quoteVendors, setQuoteVendors] = useState([]);
    const [quoteVendorId, setQuoteVendorId] = useState(null);
    const [quoteVendor, setQuoteVendor] = useState(null);
    const [quoteModalOpen, setQuoteModalOpen] = useState(false);
    const [quoteMode, setQuoteMode] = useState("edit");
    const [quoteValidityDate, setQuoteValidityDate] = useState("");
    const [quoteDeliveryDays, setQuoteDeliveryDays] = useState("");
    const [quotePaymentTerms, setQuotePaymentTerms] = useState("");
    const [quoteNotes, setQuoteNotes] = useState("");
    const [quoteResponseDate, setQuoteResponseDate] = useState(today());
    const [quoteCurrency, setQuoteCurrency] = useState("PKR");

    const readOnly = screen === "view";

    const loadData = useCallback(async (refresh = false) => {
        if (refresh) {
            setRefreshing(true);
        } else {
            setLoading(true);
        }

        setError("");

        try {
            const response = await fetch("/api/rfqs", {
                method: "GET",
                cache: "no-store",
                credentials: "same-origin",
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(
                    data.message || "Unable to load RFQ records."
                );
            }

            setRfqs(Array.isArray(data.rfqs) ? data.rfqs : []);
            setSuppliers(
                Array.isArray(data.suppliers) ? data.suppliers : []
            );

            setAvailableItems(
                Array.isArray(data.availableItems)
                    ? data.availableItems.map((item) => ({
                          ...item,
                          source_type: SOURCE_PURCHASE,
                      }))
                    : []
            );

            setProcurementItems(
                Array.isArray(data.procurementItems)
                    ? data.procurementItems.map((item) => ({
                          ...item,
                          source_type: SOURCE_PROCUREMENT,
                      }))
                    : []
            );

            setCompany(data.company || {});
            setPermissions(data.permissions || {});
        } catch (err) {
            setError(err.message || "Unable to load RFQ records.");
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, []);

    useEffect(() => {
        const timer = setTimeout(() => {
            void loadData();
        }, 0);

        return () => clearTimeout(timer);
    }, [loadData]);

    const filteredRfqs = useMemo(() => {
        const value = search.trim().toLowerCase();

        if (!value) return rfqs;

        return rfqs.filter((rfq) =>
            [
                rfq.transaction_number,
                rfq.status,
                rfq.location,
                rfq.memo,
                rfq.project,
                rfq.created_from,
            ]
                .filter(Boolean)
                .some((item) =>
                    String(item).toLowerCase().includes(value)
                )
        );
    }, [rfqs, search]);

    const allItems = useMemo(() => {
        const combined = [
            ...currentItems,
            ...availableItems,
            ...procurementItems,
        ];

        const unique = new Map();

        combined.forEach((item) => {
            const id = itemId(item);

            if (isValidId(id)) {
                const normalized = {
                    ...item,
                    source_type: itemSource(item),
                };

                unique.set(Number(id), normalized);
            }
        });

        return [...unique.values()];
    }, [currentItems, availableItems, procurementItems]);

    const selectableItems = useMemo(() => {
        const searchValue = itemSearch.trim().toLowerCase();

        return allItems.filter((item) => {
            const source = itemSource(item);

            if (
                sourceFilter !== "ALL" &&
                source !== sourceFilter
            ) {
                return false;
            }

            if (!searchValue) return true;

            return [
                item.item,
                item.item_description,
                item.req_number,
                item.source_transaction_number,
                item.procurement_transaction_number,
                item.uom,
                item.department,
                item.class_name,
                item.location,
            ]
                .filter(Boolean)
                .some((value) =>
                    String(value).toLowerCase().includes(searchValue)
                );
        });
    }, [allItems, itemSearch, sourceFilter]);

    const filteredSuppliers = useMemo(() => {
        const value = supplierSearch.trim().toLowerCase();

        return suppliers.filter((supplier) =>
            [
                supplier.supplier_name,
                supplier.supplier_code,
                supplier.phone,
                supplier.email,
            ]
                .filter(Boolean)
                .some((text) =>
                    String(text).toLowerCase().includes(value)
                )
        );
    }, [suppliers, supplierSearch]);

    const selectedItems = useMemo(() => {
        const selected = new Set(selectedItemIds.map(Number));

        return allItems.filter((item) =>
            selected.has(itemId(item))
        );
    }, [allItems, selectedItemIds]);

    const selectedSuppliers = useMemo(() => {
        const selected = new Set(selectedSupplierIds.map(Number));

        return suppliers.filter((supplier) =>
            selected.has(Number(supplier.supplier_id))
        );
    }, [suppliers, selectedSupplierIds]);

    const totalQuantity = selectedItems.reduce(
        (total, item) => total + numberValue(item.quantity),
        0
    );

    const selectedPurchaseCount = selectedItems.filter(
        (item) => itemSource(item) === SOURCE_PURCHASE
    ).length;

    const selectedProcurementCount = selectedItems.filter(
        (item) => itemSource(item) === SOURCE_PROCUREMENT
    ).length;

    const createdFromLabel = useMemo(() => {
        if (!selectedItems.length) return "—";

        if (selectedPurchaseCount && selectedProcurementCount) {
            return "Multiple Sources";
        }

        if (selectedProcurementCount) {
            return "Requisition for Procurement";
        }

        return "Purchase Requisition";
    }, [
        selectedItems.length,
        selectedPurchaseCount,
        selectedProcurementCount,
    ]);

    const quoteTotals = useMemo(() => {
        return quoteItems.reduce(
            (totals, line) => {
                const amount = getQuoteAmount(line);

                totals.gross += amount.gross;
                totals.discount += amount.discount;
                totals.tax += amount.tax;
                totals.total += amount.total;

                return totals;
            },
            {
                gross: 0,
                discount: 0,
                tax: 0,
                total: 0,
            }
        );
    }, [quoteItems]);

    const comparisonRows = useMemo(() => {
        const rows = [];

        quoteVendors.forEach((vendor) => {
            const lines = getQuoteLines(vendor);

            if (!lines.length) return;

            const total = lines.reduce(
                (sum, line) => sum + getQuoteAmount(line).total,
                0
            );

            rows.push({
                vendor,
                total,
                count: lines.length,
            });
        });

        return rows.sort((a, b) => a.total - b.total);
    }, [quoteVendors]);

    function resetForm() {
        setCurrentId(null);
        setCurrentItems([]);

        setTransactionNumber("TO BE GENERATED");
        setTransactionDate(today());
        setStatus("DRAFT");
        setProject("");
        setReferenceNumber("");
        setMemo("");

        setSelectedItemIds([]);
        setSelectedSupplierIds([]);

        setItemSearch("");
        setSupplierSearch("");
        setSourceFilter("ALL");
        setActiveTab("lines");

        setQuoteData(null);
        setQuoteItems([]);
        setQuoteVendors([]);
        setQuoteVendorId(null);
        setQuoteVendor(null);
        setQuoteModalOpen(false);
    }

    function openCreate() {
        if (!permissions.canCreate) return;

        resetForm();
        setError("");
        setSuccess("");
        setScreen("create");
    }

    async function openExisting(rfq, mode) {
        setError("");
        setSuccess("");

        try {
            const response = await fetch(`/api/rfqs/${rfq.rfq_id}`, {
                cache: "no-store",
                credentials: "same-origin",
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.message || "Unable to load RFQ.");
            }

            const record = data.rfq;

            const items = Array.isArray(record.items)
                ? record.items.map((item) => ({
                      ...item,
                      source_type: itemSource(item),
                  }))
                : [];

            const vendors = Array.isArray(record.vendors)
                ? record.vendors
                : [];

            setCurrentId(record.rfq_id);
            setTransactionNumber(
                record.transaction_number || "TO BE GENERATED"
            );

            setTransactionDate(
                record.transaction_date
                    ? String(record.transaction_date).slice(0, 10)
                    : today()
            );

            setStatus(record.status || "DRAFT");
            setProject(record.project || "");
            setReferenceNumber(record.reference_number || "");
            setMemo(record.memo || "");

            setCurrentItems(items);

            setSelectedItemIds(
                [
                    ...new Set(
                        items
                            .map(itemId)
                            .filter(isValidId)
                            .map(Number)
                    ),
                ]
            );

            setSelectedSupplierIds(
                vendors
                    .map((vendor) => Number(vendor.supplier_id))
                    .filter(isValidId)
            );

            setScreen(mode);
            setActiveTab("lines");
            setSourceFilter("ALL");

            // Load supplier quotation responses when opening an RFQ.
            if (isValidId(record.rfq_id)) {
                await loadQuoteResponses(record.rfq_id);
            }
        } catch (err) {
            setError(err.message || "Unable to open RFQ.");
        }
    }

    async function loadQuoteResponses(rfqId, showLoading = true) {
        if (!isValidId(rfqId)) return;

        if (showLoading) setQuoteLoading(true);

        try {
            const response = await fetch(
                `/api/rfqs/${rfqId}/quotes`,
                {
                    method: "GET",
                    cache: "no-store",
                    credentials: "same-origin",
                }
            );

            const data = await response.json();

            if (!response.ok) {
                throw new Error(
                    data.message || "Unable to load supplier quotations."
                );
            }

            setQuoteData(data);

            setQuoteItems(
                Array.isArray(data.items) ? data.items : []
            );

            setQuoteVendors(
                Array.isArray(data.vendors) ? data.vendors : []
            );

            return data;
        } catch (err) {
            setError(
                err.message || "Unable to load supplier quotations."
            );
            return null;
        } finally {
            if (showLoading) setQuoteLoading(false);
        }
    }

    function toggleItem(id) {
        if (readOnly || !isValidId(id)) return;

        const numericId = Number(id);

        setSelectedItemIds((current) =>
            current.includes(numericId)
                ? current.filter((value) => value !== numericId)
                : [...current, numericId]
        );
    }

    function toggleSupplier(id) {
        if (readOnly || !isValidId(id)) return;

        const numericId = Number(id);

        setSelectedSupplierIds((current) =>
            current.includes(numericId)
                ? current.filter((value) => value !== numericId)
                : [...current, numericId]
        );
    }

    async function handleSave() {
        setError("");
        setSuccess("");

        if (!transactionDate) {
            setError("Please select a transaction date.");
            return;
        }

        if (!selectedItemIds.length) {
            setError("Please select at least one transaction line.");
            setActiveTab("lines");
            return;
        }

        if (!selectedSupplierIds.length) {
            setError("Please select at least one supplier.");
            setActiveTab("vendors");
            return;
        }

        const selectedItemsPayload = selectedItemIds.map((id) => {
            const item = allItems.find(
                (entry) => itemId(entry) === Number(id)
            );

            return {
                sourceType: item
                    ? itemSource(item)
                    : SOURCE_PURCHASE,
                sourceItemId: Number(id),
            };
        });

        if (
            selectedItemsPayload.some(
                (item) =>
                    !isValidId(item.sourceItemId) ||
                    ![
                        SOURCE_PURCHASE,
                        SOURCE_PROCUREMENT,
                    ].includes(item.sourceType)
            )
        ) {
            setError(
                "One or more selected items have invalid source information. Refresh the page and try again."
            );
            return;
        }

        setSaving(true);

        try {
            const payload = {
                transactionDate,
                status,
                project,
                referenceNumber,
                memo,
                selectedItems: selectedItemsPayload,
                selectedItemIds,
                supplierIds: selectedSupplierIds,
            };

            const response = await fetch(
                screen === "edit"
                    ? `/api/rfqs/${currentId}`
                    : "/api/rfqs",
                {
                    method: screen === "edit" ? "PATCH" : "POST",
                    credentials: "same-origin",
                    headers: {
                        "Content-Type": "application/json",
                        Accept: "application/json",
                    },
                    body: JSON.stringify(payload),
                }
            );

            const data = await response.json();

            if (!response.ok) {
                throw new Error(
                    data.message || "Unable to save RFQ."
                );
            }

            setSuccess(data.message || "RFQ saved successfully.");

            await loadData(true);

            if (screen === "create" && data.rfq?.rfqId) {
                await openExisting(
                    {
                        rfq_id: data.rfq.rfqId,
                        transaction_number:
                            data.rfq.transactionNumber,
                    },
                    "edit"
                );
            } else {
                setScreen("edit");

                if (currentId) {
                    await loadQuoteResponses(currentId);
                }
            }
        } catch (err) {
            setError(err.message || "Unable to save RFQ.");
        } finally {
            setSaving(false);
        }
    }

    async function handleDelete() {
        if (!currentId || !permissions.canDelete) return;

        const confirmed = window.confirm(
            `Delete ${transactionNumber}? This action cannot be undone.`
        );

        if (!confirmed) return;

        setSaving(true);
        setError("");

        try {
            const response = await fetch(`/api/rfqs/${currentId}`, {
                method: "DELETE",
                credentials: "same-origin",
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(
                    data.message || "Unable to delete RFQ."
                );
            }

            resetForm();
            setScreen("list");
            setSuccess(data.message || "RFQ deleted successfully.");

            await loadData(true);
        } catch (err) {
            setError(err.message || "Unable to delete RFQ.");
        } finally {
            setSaving(false);
        }
    }

    // ---------------- SUPPLIER QUOTATION FUNCTIONS ----------------

    function findVendorQuote(vendor) {
        const lines = getQuoteLines(vendor);
        return lines.length > 0 ? lines : [];
    }

    function openQuoteEntry(vendor) {
        if (!permissions.canUpdate) {
            setError("You do not have permission to enter supplier quotations.");
            return;
        }

        if (!currentId) {
            setError("Save the RFQ before entering supplier quotations.");
            return;
        }

        if (["CLOSED", "CANCELLED"].includes(String(status).toUpperCase())) {
            setError("Supplier quotations cannot be entered for a closed or cancelled RFQ.");
            return;
        }

        const vendorId = Number(
            vendor.rfq_vendor_id ?? vendor.rfqVendorId
        );

        if (!isValidId(vendorId)) {
            setError("This supplier does not have a valid RFQ vendor record.");
            return;
        }

        const existingLines = findVendorQuote(vendor);

        const mappedItems = quoteItems.map((item) => {
            const rfqItemId = Number(item.rfq_item_id);

            const existing = existingLines.find(
                (line) =>
                    Number(
                        line.rfq_item_id ??
                            line.rfqItemId
                    ) === rfqItemId
            );

            return existing
                ? normalizeQuoteLine(existing, item)
                : makeEmptyQuoteLine(item);
        });

        setQuoteVendorId(vendorId);
        setQuoteVendor(vendor);

        setQuoteItems(mappedItems);

        setQuoteValidityDate(
            vendor.validity_date
                ? String(vendor.validity_date).slice(0, 10)
                : ""
        );

        setQuoteDeliveryDays(
            vendor.delivery_days ?? ""
        );

        setQuotePaymentTerms(vendor.payment_terms || "");
        setQuoteNotes(vendor.notes || "");

        setQuoteResponseDate(
            vendor.response_date
                ? String(vendor.response_date).slice(0, 10)
                : today()
        );

        setQuoteCurrency(vendor.currency || "PKR");

        setQuoteMode(existingLines.length ? "edit" : "create");
        setQuoteModalOpen(true);
        setError("");
        setSuccess("");
    }

    function updateQuoteLine(index, field, value) {
        setQuoteItems((current) =>
            current.map((line, lineIndex) =>
                lineIndex === index
                    ? {
                          ...line,
                          [field]: value,
                      }
                    : line
            )
        );
    }

    async function saveSupplierQuote() {
        setError("");
        setSuccess("");

        if (!currentId || !quoteVendorId) {
            setError("RFQ or supplier information is missing.");
            return;
        }

        if (!permissions.canUpdate) {
            setError("You do not have permission to submit supplier quotations.");
            return;
        }

        if (!quoteItems.length) {
            setError("There are no RFQ items available for quotation.");
            return;
        }

        if (!quoteResponseDate) {
            setError("Please select the quotation response date.");
            return;
        }

        if (
            quoteDeliveryDays !== "" &&
            (
                !Number.isFinite(Number(quoteDeliveryDays)) ||
                Number(quoteDeliveryDays) < 0
            )
        ) {
            setError("Delivery days must be zero or greater.");
            return;
        }

        for (let index = 0; index < quoteItems.length; index++) {
            const line = quoteItems[index];

            if (!isValidId(line.rfqItemId)) {
                setError(`Invalid RFQ item on line ${index + 1}.`);
                return;
            }

            if (
                !Number.isFinite(Number(line.quotedQuantity)) ||
                Number(line.quotedQuantity) <= 0
            ) {
                setError(
                    `Enter a quoted quantity greater than zero for ${line.item || `line ${index + 1}`}.`
                );
                return;
            }

            if (
                !Number.isFinite(Number(line.unitPrice)) ||
                Number(line.unitPrice) < 0
            ) {
                setError(
                    `Enter a valid unit price for ${line.item || `line ${index + 1}`}.`
                );
                return;
            }

            if (
                !Number.isFinite(Number(line.taxRate)) ||
                Number(line.taxRate) < 0
            ) {
                setError(
                    `Enter a valid tax rate for ${line.item || `line ${index + 1}`}.`
                );
                return;
            }

            if (
                !Number.isFinite(Number(line.discountAmount)) ||
                Number(line.discountAmount) < 0
            ) {
                setError(
                    `Enter a valid discount for ${line.item || `line ${index + 1}`}.`
                );
                return;
            }

            const gross =
                Number(line.quotedQuantity) *
                Number(line.unitPrice);

            if (Number(line.discountAmount) > gross) {
                setError(
                    `Discount cannot exceed the gross amount for ${line.item || `line ${index + 1}`}.`
                );
                return;
            }
        }

        setQuoteSaving(true);

        try {
            const payload = {
                rfqVendorId: Number(quoteVendorId),
                responseDate: quoteResponseDate,
                validityDate: quoteValidityDate || null,
                deliveryDays:
                    quoteDeliveryDays === ""
                        ? null
                        : Number(quoteDeliveryDays),
                paymentTerms: quotePaymentTerms,
                notes: quoteNotes,
                items: quoteItems.map((line) => ({
                    rfqItemId: Number(line.rfqItemId),
                    quotedQuantity: Number(line.quotedQuantity),
                    unitPrice: Number(line.unitPrice),
                    taxRate: Number(line.taxRate),
                    discountAmount: Number(line.discountAmount),
                    currency: quoteCurrency,
                })),
            };

            const response = await fetch(
                `/api/rfqs/${currentId}/quotes`,
                {
                    method: "POST",
                    credentials: "same-origin",
                    headers: {
                        "Content-Type": "application/json",
                        Accept: "application/json",
                    },
                    body: JSON.stringify(payload),
                }
            );

            const data = await response.json();

            if (!response.ok) {
                throw new Error(
                    data.message || "Unable to save supplier quotation."
                );
            }

            setQuoteModalOpen(false);

            await loadQuoteResponses(currentId, false);

            setSuccess(
                data.message ||
                    "Supplier quotation saved successfully."
            );
        } catch (err) {
            setError(
                err.message || "Unable to save supplier quotation."
            );
        } finally {
            setQuoteSaving(false);
        }
    }

    function closeQuoteModal() {
        if (quoteSaving) return;

        setQuoteModalOpen(false);
        setQuoteVendorId(null);
        setQuoteVendor(null);
        setQuoteItems([]);
    }

    // ---------------- REPORTING ----------------

    function reportRows(rfq) {
        const lines = rfq.items || [];

        const doc = new jsPDF({
            orientation: "landscape",
            unit: "mm",
            format: "a4",
        });

        doc.setFontSize(18);
        doc.text("REQUEST FOR QUOTATION", 14, 18);

        doc.setFontSize(10);
        doc.text(
            `Transaction Number: ${rfq.transaction_number || ""}`,
            14,
            29
        );
        doc.text(
            `Transaction Date: ${formatDate(rfq.transaction_date)}`,
            14,
            36
        );
        doc.text(`Status: ${rfq.status || "DRAFT"}`, 14, 43);
        doc.text(
            `Subsidiary: ${company.companyName || rfq.company_name || "—"}`,
            14,
            50
        );
        doc.text(`Project: ${rfq.project || "—"}`, 14, 57);
        doc.text(`Reference: ${rfq.reference_number || "—"}`, 14, 64);
        doc.text(
            `Created From: ${rfq.created_from || "—"}`,
            14,
            71
        );

        autoTable(doc, {
            startY: 78,
            head: [[
                "Seq. ID",
                "Created From",
                "Source Requisition",
                "Item",
                "Description",
                "UOM",
                "Quantity",
                "Department",
                "Class",
                "Location",
            ]],
            body: lines.map((item) => [
                item.source_requisition_item_id ||
                    item.seq_id ||
                    "",
                sourceLabel(itemSource(item)),
                item.procurement_transaction_number ||
                    item.source_transaction_number ||
                    item.req_number ||
                    "",
                item.item || "",
                item.item_description || "",
                item.uom || "",
                formatQuantity(item.quantity),
                item.department || "",
                item.class_name || "",
                item.location || "",
            ]),
            styles: {
                fontSize: 7,
                cellPadding: 2,
            },
            headStyles: {
                fillColor: [37, 99, 235],
            },
        });

        const vendorStart = (doc.lastAutoTable?.finalY || 90) + 10;

        doc.setFontSize(12);
        doc.text("Vendors", 14, vendorStart);

        autoTable(doc, {
            startY: vendorStart + 4,
            head: [["Supplier", "Code", "Phone", "Email", "Status"]],
            body: (rfq.vendors || []).map((vendor) => [
                vendor.supplier_name || "",
                vendor.supplier_code || "",
                vendor.phone || "",
                vendor.email || "",
                vendor.status || "INVITED",
            ]),
            styles: {
                fontSize: 8,
            },
            headStyles: {
                fillColor: [5, 150, 105],
            },
        });

        if (rfq.memo) {
            const y =
                (doc.lastAutoTable?.finalY || vendorStart + 15) + 10;

            doc.setFontSize(9);
            doc.text(
                `Remarks: ${rfq.memo}`,
                14,
                y,
                { maxWidth: 260 }
            );
        }

        return doc;
    }

    async function handleReport(rfq) {
        try {
            const response = await fetch(
                `/api/rfqs/${rfq.rfq_id}`,
                {
                    cache: "no-store",
                    credentials: "same-origin",
                }
            );

            const data = await response.json();

            if (!response.ok) {
                throw new Error(
                    data.message || "Unable to load report."
                );
            }

            return reportRows(data.rfq);
        } catch (err) {
            setError(err.message || "Unable to generate report.");
            return null;
        }
    }

    async function downloadReport(rfq) {
        const doc = await handleReport(rfq);

        if (!doc) return;

        doc.save(
            `${rfq.transaction_number || "RFQ"}.pdf`
        );
    }

    async function printReport(rfq) {
        const doc = await handleReport(rfq);

        if (!doc) return;

        doc.autoPrint();

        const blobUrl = doc.output("bloburl");
        window.open(blobUrl, "_blank");
    }

    const selectedRecord = {
        rfq_id: currentId,
        transaction_number: transactionNumber,
        transaction_date: transactionDate,
        status,
        project,
        reference_number: referenceNumber,
        memo,
        created_from: createdFromLabel,
        items: selectedItems,
        vendors: selectedSuppliers,
    };

    return (
        <div className="min-h-screen bg-slate-50 px-3 py-5 text-slate-800 dark:bg-slate-950 dark:text-slate-100 sm:px-5 lg:px-7">
            <div className="mx-auto max-w-[1600px] space-y-5">

                {error && (
                    <div className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300">
                        <AlertCircle size={18} className="mt-0.5 shrink-0" />
                        <span>{error}</span>
                        <button
                            type="button"
                            onClick={() => setError("")}
                            className="ml-auto"
                        >
                            <X size={16} />
                        </button>
                    </div>
                )}

                {success && (
                    <div className="flex items-start gap-2 rounded-xl border border-green-200 bg-green-50 p-3 text-sm text-green-700 dark:border-green-900 dark:bg-green-950/30 dark:text-green-300">
                        <CheckCircle2 size={18} className="mt-0.5 shrink-0" />
                        <span>{success}</span>
                        <button
                            type="button"
                            onClick={() => setSuccess("")}
                            className="ml-auto"
                        >
                            <X size={16} />
                        </button>
                    </div>
                )}

                {screen === "list" ? (
                    <>
                        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                            <div className="flex items-center gap-3">
                                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-600 text-white">
                                    <FileText size={23} />
                                </div>

                                <div>
                                    <h1 className="text-xl font-bold text-slate-900 dark:text-white sm:text-2xl">
                                        Request for Quotation
                                    </h1>

                                    <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                                        RFQ transaction history and supplier requests
                                    </p>
                                </div>
                            </div>

                            <div className="flex flex-wrap gap-2">
                                <button
                                    type="button"
                                    onClick={() => loadData(true)}
                                    disabled={refreshing || loading}
                                    className={secondaryButton}
                                >
                                    <RefreshCw
                                        size={16}
                                        className={refreshing ? "animate-spin" : ""}
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
                                        Create
                                    </button>
                                )}
                            </div>
                        </div>

                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
                            <SummaryCard
                                title="Total RFQs"
                                value={rfqs.length}
                                icon={FileText}
                            />
                            <SummaryCard
                                title="Purchase Requisition Items"
                                value={availableItems.length}
                                icon={Package}
                            />
                            <SummaryCard
                                title="Procurement Requisition Items"
                                value={procurementItems.length}
                                icon={ClipboardList}
                            />
                            <SummaryCard
                                title="Active Suppliers"
                                value={suppliers.length}
                                icon={Users}
                            />
                        </div>

                        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
                            <div className="flex flex-col gap-3 border-b border-slate-200 p-4 dark:border-slate-800 sm:flex-row sm:items-center sm:justify-between">
                                <div>
                                    <h2 className="font-semibold text-slate-900 dark:text-white">
                                        RFQ History
                                    </h2>
                                    <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                                        Edit, view and print saved Request for Quotation documents.
                                    </p>
                                </div>

                                <div className="relative w-full sm:max-w-xs">
                                    <Search
                                        size={16}
                                        className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                                    />
                                    <input
                                        value={search}
                                        onChange={(event) =>
                                            setSearch(event.target.value)
                                        }
                                        placeholder="Search RFQ history..."
                                        className={`${inputClass} pl-9`}
                                    />
                                </div>
                            </div>

                            {loading ? (
                                <div className="flex min-h-48 items-center justify-center gap-2 text-sm text-slate-500">
                                    <RefreshCw size={18} className="animate-spin" />
                                    Loading RFQ history...
                                </div>
                            ) : filteredRfqs.length === 0 ? (
                                <div className="flex min-h-56 flex-col items-center justify-center px-4 text-center">
                                    <FileText size={34} className="mb-3 text-slate-300" />
                                    <h3 className="font-semibold text-slate-800 dark:text-white">
                                        {search ? "No matching RFQs" : "No RFQs created yet"}
                                    </h3>
                                    <p className="mt-1 max-w-lg text-sm text-slate-500">
                                        Create an RFQ using approved Purchase Requisition items or items from a Requisition for Procurement.
                                    </p>
                                </div>
                            ) : (
                                <div className="overflow-x-auto">
                                    <table className="w-full min-w-[1150px] text-left text-sm">
                                        <thead className="bg-slate-50 text-xs uppercase text-slate-500 dark:bg-slate-950/70 dark:text-slate-400">
                                            <tr>
                                                <th className="px-3 py-3">Edit</th>
                                                <th className="px-3 py-3">View</th>
                                                <th className="px-3 py-3">Report</th>
                                                <th className="px-3 py-3">Transaction Number</th>
                                                <th className="px-3 py-3">Created From</th>
                                                <th className="px-3 py-3">Trandate</th>
                                                <th className="px-3 py-3">Location</th>
                                                <th className="px-3 py-3">Transaction Status</th>
                                            </tr>
                                        </thead>

                                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                            {filteredRfqs.map((rfq) => (
                                                <tr
                                                    key={rfq.rfq_id}
                                                    className="hover:bg-slate-50 dark:hover:bg-slate-800/50"
                                                >
                                                    <td className="px-3 py-3">
                                                        {permissions.canUpdate &&
                                                        rfq.status === "DRAFT" ? (
                                                            <button
                                                                type="button"
                                                                title="Edit"
                                                                onClick={() =>
                                                                    openExisting(rfq, "edit")
                                                                }
                                                                className="rounded-lg p-2 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/40"
                                                            >
                                                                <Pencil size={17} />
                                                            </button>
                                                        ) : "—"}
                                                    </td>

                                                    <td className="px-3 py-3">
                                                        <button
                                                            type="button"
                                                            title="View"
                                                            onClick={() =>
                                                                openExisting(rfq, "view")
                                                            }
                                                            className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
                                                        >
                                                            <Eye size={17} />
                                                        </button>
                                                    </td>

                                                    <td className="px-3 py-3">
                                                        <div className="flex gap-1">
                                                            <button
                                                                type="button"
                                                                title="Download PDF"
                                                                onClick={() => downloadReport(rfq)}
                                                                className="rounded-lg p-2 text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/40"
                                                            >
                                                                <Download size={17} />
                                                            </button>
                                                            <button
                                                                type="button"
                                                                title="Print"
                                                                onClick={() => printReport(rfq)}
                                                                className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
                                                            >
                                                                <Printer size={17} />
                                                            </button>
                                                        </div>
                                                    </td>

                                                    <td className="whitespace-nowrap px-3 py-3 font-semibold text-blue-700 dark:text-blue-300">
                                                        {rfq.transaction_number}
                                                    </td>

                                                    <td className="px-3 py-3">
                                                        {sourceLabel(
                                                            rfq.created_from === "Multiple Sources"
                                                                ? "MULTIPLE"
                                                                : rfq.created_from === "Requisition for Procurement"
                                                                  ? SOURCE_PROCUREMENT
                                                                  : SOURCE_PURCHASE
                                                        )}
                                                    </td>

                                                    <td className="whitespace-nowrap px-3 py-3">
                                                        {formatDate(rfq.transaction_date)}
                                                    </td>

                                                    <td className="px-3 py-3">
                                                        {rfq.location || "—"}
                                                    </td>

                                                    <td className="px-3 py-3">
                                                        <span
                                                            className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${statusClass(rfq.status)}`}
                                                        >
                                                            {rfq.status || "DRAFT"}
                                                        </span>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}

                            <div className="border-t border-slate-200 px-4 py-3 text-xs text-slate-500 dark:border-slate-800">
                                Showing {filteredRfqs.length} of {rfqs.length} RFQ records
                            </div>
                        </section>
                    </>
                ) : (
                    <>
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                            <div className="flex items-center gap-3">
                                <button
                                    type="button"
                                    onClick={() => {
                                        setError("");
                                        setScreen("list");
                                        resetForm();
                                    }}
                                    className={secondaryButton}
                                >
                                    <ArrowLeft size={17} />
                                    Back
                                </button>

                                <div>
                                    <h1 className="text-xl font-bold text-slate-900 dark:text-white">
                                        Request for Quotation
                                    </h1>
                                    <p className="mt-1 text-sm text-slate-500">
                                        {screen === "create"
                                            ? "New RFQ transaction"
                                            : screen === "edit"
                                              ? "Edit RFQ transaction"
                                              : "View RFQ transaction"}
                                    </p>
                                </div>
                            </div>

                            <div className="flex flex-wrap gap-2">
                                {screen === "edit" &&
                                    permissions.canDelete &&
                                    status === "DRAFT" && (
                                        <button
                                            type="button"
                                            onClick={handleDelete}
                                            disabled={saving}
                                            className="inline-flex items-center gap-2 rounded-xl border border-red-200 bg-white px-4 py-2.5 text-sm font-semibold text-red-600 hover:bg-red-50 dark:border-red-900 dark:bg-slate-900"
                                        >
                                            <Trash2 size={16} />
                                            Delete
                                        </button>
                                    )}

                                {!readOnly && (
                                    <button
                                        type="button"
                                        onClick={handleSave}
                                        disabled={saving}
                                        className={primaryButton}
                                    >
                                        {saving ? (
                                            <RefreshCw size={16} className="animate-spin" />
                                        ) : (
                                            <Save size={16} />
                                        )}
                                        {saving ? "Saving..." : "Save"}
                                    </button>
                                )}

                                {screen !== "create" && (
                                    <>
                                        <button
                                            type="button"
                                            onClick={() => downloadReport(selectedRecord)}
                                            className={secondaryButton}
                                        >
                                            <Download size={16} />
                                            Download PDF
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => printReport(selectedRecord)}
                                            className={secondaryButton}
                                        >
                                            <Printer size={16} />
                                            Print
                                        </button>
                                    </>
                                )}
                            </div>
                        </div>

                        <section className="space-y-5 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-6">
                            <div className="flex flex-col gap-3 border-b border-slate-100 pb-4 dark:border-slate-800 sm:flex-row sm:items-center sm:justify-between">
                                <div>
                                    <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                                        RFQ Details
                                    </h2>
                                    <p className="text-xs text-slate-500">
                                        General transaction information
                                    </p>
                                </div>
                                <span
                                    className={`inline-flex w-fit rounded-full border px-3 py-1 text-xs font-semibold ${statusClass(status)}`}
                                >
                                    {status}
                                </span>
                            </div>

                            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                                <Field label="Transaction Number">
                                    <input
                                        value={transactionNumber}
                                        readOnly
                                        className={`${inputClass} bg-slate-50 dark:bg-slate-800`}
                                    />
                                </Field>

                                <Field label="Status">
                                    <select
                                        value={status}
                                        disabled={readOnly}
                                        onChange={(event) => setStatus(event.target.value)}
                                        className={inputClass}
                                    >
                                        {[
                                            "DRAFT",
                                            "APPROVED",
                                            "SENT",
                                            "PARTIALLY_RECEIVED",
                                            "RECEIVED",
                                            "CLOSED",
                                            "CANCELLED",
                                        ].map((value) => (
                                            <option key={value} value={value}>
                                                {value}
                                            </option>
                                        ))}
                                    </select>
                                </Field>

                                <Field label="Transaction Date">
                                    <input
                                        type="date"
                                        value={transactionDate}
                                        disabled={readOnly}
                                        onChange={(event) =>
                                            setTransactionDate(event.target.value)
                                        }
                                        className={inputClass}
                                    />
                                </Field>

                                <Field label="Subsidiary">
                                    <input
                                        value={company.companyName || ""}
                                        readOnly
                                        className={`${inputClass} bg-slate-50 dark:bg-slate-800`}
                                    />
                                </Field>

                                <Field label="Department">
                                    <input
                                        value={[
                                            ...new Set(
                                                selectedItems
                                                    .map((item) => item.department)
                                                    .filter(Boolean)
                                            ),
                                        ].join(", ")}
                                        readOnly
                                        className={`${inputClass} bg-slate-50 dark:bg-slate-800`}
                                        placeholder="Derived from transaction lines"
                                    />
                                </Field>

                                <Field label="Project">
                                    <input
                                        value={project}
                                        disabled={readOnly}
                                        onChange={(event) => setProject(event.target.value)}
                                        className={inputClass}
                                        placeholder="Enter project"
                                    />
                                </Field>

                                <Field label="Class">
                                    <input
                                        value={[
                                            ...new Set(
                                                selectedItems
                                                    .map((item) => item.class_name)
                                                    .filter(Boolean)
                                            ),
                                        ].join(", ")}
                                        readOnly
                                        className={`${inputClass} bg-slate-50 dark:bg-slate-800`}
                                        placeholder="Derived from transaction lines"
                                    />
                                </Field>

                                <Field label="Location">
                                    <input
                                        value={[
                                            ...new Set(
                                                selectedItems
                                                    .map((item) => item.location)
                                                    .filter(Boolean)
                                            ),
                                        ].join(", ")}
                                        readOnly
                                        className={`${inputClass} bg-slate-50 dark:bg-slate-800`}
                                        placeholder="Derived from transaction lines"
                                    />
                                </Field>

                                <Field label="Reference">
                                    <input
                                        value={referenceNumber}
                                        disabled={readOnly}
                                        onChange={(event) =>
                                            setReferenceNumber(event.target.value)
                                        }
                                        className={inputClass}
                                        placeholder="Enter reference"
                                    />
                                </Field>
                            </div>
                        </section>

                        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
                            <div className="flex flex-wrap gap-1 border-b border-slate-200 p-2 dark:border-slate-800">
                                {[
                                    ["lines", "Transaction Lines", Package],
                                    ["vendors", "Vendors", Users],
                                    ["comparison", "Comparison Statement", ClipboardList],
                                    ["related", "Related Transactions", FileText],
                                    ["system", "System Information", Building2],
                                ].map(([key, label, Icon]) => (
                                    <button
                                        key={key}
                                        type="button"
                                        onClick={() => setActiveTab(key)}
                                        className={`inline-flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold transition ${
                                            activeTab === key
                                                ? "bg-blue-600 text-white"
                                                : "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
                                        }`}
                                    >
                                        <Icon size={15} />
                                        {label}
                                    </button>
                                ))}
                            </div>

                            {/* TRANSACTION LINES */}
                            {activeTab === "lines" && (
                                <div className="space-y-4 p-4">
                                    <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
                                        <div>
                                            <h3 className="font-semibold text-slate-900 dark:text-white">
                                                Transaction Lines
                                            </h3>
                                            <p className="text-xs text-slate-500">
                                                Select items from approved Purchase Requisitions or Requisitions for Procurement.
                                            </p>
                                        </div>

                                        <div className="relative w-full xl:max-w-xs">
                                            <Search
                                                size={15}
                                                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                                            />
                                            <input
                                                value={itemSearch}
                                                onChange={(event) =>
                                                    setItemSearch(event.target.value)
                                                }
                                                className={`${inputClass} pl-9`}
                                                placeholder="Search transaction items..."
                                            />
                                        </div>
                                    </div>

                                    <div className="flex flex-wrap items-center gap-2">
                                        <span className="mr-1 text-xs font-semibold text-slate-500">
                                            Item Source:
                                        </span>

                                        {[
                                            { value: "ALL", label: "All Sources" },
                                            {
                                                value: SOURCE_PURCHASE,
                                                label: "Purchase Requisition",
                                            },
                                            {
                                                value: SOURCE_PROCUREMENT,
                                                label: "Requisition for Procurement",
                                            },
                                        ].map((option) => (
                                            <button
                                                key={option.value}
                                                type="button"
                                                onClick={() =>
                                                    setSourceFilter(option.value)
                                                }
                                                className={`rounded-lg border px-3 py-2 text-xs font-semibold transition ${
                                                    sourceFilter === option.value
                                                        ? "border-blue-600 bg-blue-600 text-white"
                                                        : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
                                                }`}
                                            >
                                                {option.label}
                                            </button>
                                        ))}
                                    </div>

                                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                                        <CountCard
                                            title="Available Purchase Requisition Items"
                                            value={availableItems.length}
                                        />
                                        <CountCard
                                            title="Available Procurement Requisition Items"
                                            value={procurementItems.length}
                                        />
                                        <CountCard
                                            title="Selected Transaction Lines"
                                            value={selectedItemIds.length}
                                            highlight
                                        />
                                    </div>

                                    <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700">
                                        <table className="w-full min-w-[1250px] text-left text-xs">
                                            <thead className="bg-slate-50 text-slate-500 dark:bg-slate-950 dark:text-slate-400">
                                                <tr>
                                                    <th className="px-3 py-3">Select</th>
                                                    <th className="px-3 py-3">Seq. ID</th>
                                                    <th className="px-3 py-3">Created From</th>
                                                    <th className="px-3 py-3">Req Number</th>
                                                    <th className="px-3 py-3">Item Name</th>
                                                    <th className="px-3 py-3">Item Description</th>
                                                    <th className="px-3 py-3">Item Balance</th>
                                                    <th className="px-3 py-3">UOM</th>
                                                    <th className="px-3 py-3 text-right">Enter Quantity</th>
                                                    <th className="px-3 py-3">Department</th>
                                                    <th className="px-3 py-3">Class</th>
                                                    <th className="px-3 py-3">Location</th>
                                                </tr>
                                            </thead>

                                            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                                {selectableItems.map((item) => {
                                                    const id = itemId(item);
                                                    const checked =
                                                        selectedItemIds.includes(id);
                                                    const source = itemSource(item);

                                                    return (
                                                        <tr
                                                            key={`${source}-${id}`}
                                                            className={
                                                                checked
                                                                    ? "bg-blue-50/60 dark:bg-blue-950/20"
                                                                    : ""
                                                            }
                                                        >
                                                            <td className="px-3 py-3">
                                                                <input
                                                                    type="checkbox"
                                                                    checked={checked}
                                                                    disabled={readOnly}
                                                                    onChange={() => toggleItem(id)}
                                                                    className="h-4 w-4 rounded text-blue-600"
                                                                />
                                                            </td>
                                                            <td className="px-3 py-3">{id}</td>
                                                            <td className="px-3 py-3">
                                                                <span className="inline-flex rounded-full border border-blue-200 bg-blue-50 px-2 py-1 text-[10px] font-semibold text-blue-700 dark:border-blue-900 dark:bg-blue-950/30 dark:text-blue-300">
                                                                    {sourceLabel(source)}
                                                                </span>
                                                            </td>
                                                            <td className="px-3 py-3">
                                                                {item.procurement_transaction_number ||
                                                                    item.req_number ||
                                                                    item.source_transaction_number ||
                                                                    "—"}
                                                            </td>
                                                            <td className="px-3 py-3 font-medium">
                                                                {item.item || "—"}
                                                            </td>
                                                            <td className="max-w-[220px] px-3 py-3">
                                                                {item.item_description || "—"}
                                                            </td>
                                                            <td className="px-3 py-3">
                                                                {formatQuantity(
                                                                    item.item_balance ?? item.quantity
                                                                )}
                                                            </td>
                                                            <td className="px-3 py-3">
                                                                {item.uom || "—"}
                                                            </td>
                                                            <td className="px-3 py-3 text-right font-semibold">
                                                                {formatQuantity(item.quantity)}
                                                            </td>
                                                            <td className="px-3 py-3">
                                                                {item.department || "—"}
                                                            </td>
                                                            <td className="px-3 py-3">
                                                                {item.class_name || "—"}
                                                            </td>
                                                            <td className="px-3 py-3">
                                                                {item.location || "—"}
                                                            </td>
                                                        </tr>
                                                    );
                                                })}

                                                {selectableItems.length === 0 && (
                                                    <tr>
                                                        <td
                                                            colSpan={12}
                                                            className="px-4 py-10 text-center text-slate-500"
                                                        >
                                                            No available items found for this source.
                                                        </td>
                                                    </tr>
                                                )}
                                            </tbody>
                                        </table>
                                    </div>

                                    <div className="flex flex-col gap-2 rounded-xl bg-slate-50 p-3 text-xs dark:bg-slate-950 sm:flex-row sm:items-center sm:justify-between">
                                        <div className="flex flex-wrap gap-x-4 gap-y-2 text-slate-500">
                                            <span>
                                                <strong className="text-slate-900 dark:text-white">
                                                    {selectedItemIds.length}
                                                </strong>{" "}
                                                selected line(s)
                                            </span>
                                            <span>
                                                Purchase Requisition:{" "}
                                                <strong className="text-slate-900 dark:text-white">
                                                    {selectedPurchaseCount}
                                                </strong>
                                            </span>
                                            <span>
                                                Requisition for Procurement:{" "}
                                                <strong className="text-slate-900 dark:text-white">
                                                    {selectedProcurementCount}
                                                </strong>
                                            </span>
                                        </div>
                                        <span className="text-slate-500">
                                            Total quantity:{" "}
                                            <strong className="text-slate-900 dark:text-white">
                                                {formatQuantity(totalQuantity)}
                                            </strong>
                                        </span>
                                    </div>
                                </div>
                            )}

                            {/* VENDORS AND SUPPLIER QUOTATIONS */}
                            {activeTab === "vendors" && (
                                <div className="space-y-5 p-4">
                                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                                        <div>
                                            <h3 className="font-semibold text-slate-900 dark:text-white">
                                                Vendors
                                            </h3>
                                            <p className="text-xs text-slate-500">
                                                Invite suppliers and record the quotations received from them.
                                            </p>
                                        </div>

                                        <div className="relative w-full sm:max-w-xs">
                                            <Search
                                                size={15}
                                                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                                            />
                                            <input
                                                value={supplierSearch}
                                                onChange={(event) =>
                                                    setSupplierSearch(event.target.value)
                                                }
                                                className={`${inputClass} pl-9`}
                                                placeholder="Search suppliers..."
                                            />
                                        </div>
                                    </div>

                                    {screen !== "create" && currentId && (
                                        <div className="flex flex-col gap-2 rounded-xl border border-blue-200 bg-blue-50 p-3 text-sm text-blue-800 dark:border-blue-900 dark:bg-blue-950/30 dark:text-blue-200 sm:flex-row sm:items-center sm:justify-between">
                                            <div className="flex items-center gap-2">
                                                <ClipboardList size={18} />
                                                <span>
                                                    Record the supplier&apos;s received quotation against this RFQ.
                                                </span>
                                            </div>
                                            <button
                                                type="button"
                                                onClick={() =>
                                                    loadQuoteResponses(currentId)
                                                }
                                                disabled={quoteLoading}
                                                className="inline-flex items-center gap-2 text-xs font-semibold"
                                            >
                                                <RefreshCw
                                                    size={14}
                                                    className={quoteLoading ? "animate-spin" : ""}
                                                />
                                                Refresh responses
                                            </button>
                                        </div>
                                    )}

                                    <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
                                        {filteredSuppliers.map((supplier) => {
                                            const id = Number(supplier.supplier_id);
                                            const checked =
                                                selectedSupplierIds.includes(id);

                                            const vendorRecord = quoteVendors.find(
                                                (vendor) =>
                                                    Number(vendor.supplier_id) === id
                                            );

                                            const quoteLines = vendorRecord
                                                ? getQuoteLines(vendorRecord)
                                                : [];

                                            const hasQuote = quoteLines.length > 0;

                                            const vendorStatus =
                                                vendorRecord?.status ||
                                                (checked ? "INVITED" : "NOT SELECTED");

                                            const vendorId =
                                                vendorRecord?.rfq_vendor_id ??
                                                vendorRecord?.rfqVendorId;

                                            return (
                                                <div
                                                    key={id}
                                                    className={`rounded-xl border p-3 ${
                                                        checked
                                                            ? "border-emerald-400 bg-emerald-50/60 dark:border-emerald-800 dark:bg-emerald-950/20"
                                                            : "border-slate-200 dark:border-slate-700"
                                                    }`}
                                                >
                                                    <div className="flex items-start gap-3">
                                                        <input
                                                            type="checkbox"
                                                            checked={checked}
                                                            disabled={readOnly}
                                                            onChange={() => toggleSupplier(id)}
                                                            className="mt-1 h-4 w-4 rounded text-emerald-600"
                                                        />

                                                        <div className="min-w-0 flex-1">
                                                            <div className="flex flex-wrap items-center justify-between gap-2">
                                                                <p className="text-sm font-semibold">
                                                                    {supplier.supplier_name}
                                                                </p>

                                                                <span
                                                                    className={`inline-flex rounded-full border px-2 py-1 text-[10px] font-semibold ${statusClass(vendorStatus)}`}
                                                                >
                                                                    {vendorStatus}
                                                                </span>
                                                            </div>

                                                            <p className="mt-1 text-xs text-slate-500">
                                                                {supplier.supplier_code ||
                                                                    `Supplier #${id}`}
                                                            </p>

                                                            <p className="mt-1 text-xs text-slate-500">
                                                                {supplier.phone ||
                                                                    supplier.email ||
                                                                    ""}
                                                            </p>

                                                            {vendorRecord && (
                                                                <div className="mt-2 text-xs text-slate-500">
                                                                    {hasQuote ? (
                                                                        <>
                                                                            <span>
                                                                                {quoteLines.length} quoted line(s)
                                                                            </span>
                                                                            <span className="mx-1">•</span>
                                                                            <span>
                                                                                {formatMoney(
                                                                                    quoteLines.reduce(
                                                                                        (sum, line) =>
                                                                                            sum +
                                                                                            getQuoteAmount(line).total,
                                                                                        0
                                                                                    ),
                                                                                    vendorRecord.currency || "PKR"
                                                                                )}
                                                                            </span>
                                                                        </>
                                                                    ) : (
                                                                        "Quotation not received yet"
                                                                    )}
                                                                </div>
                                                            )}

                                                            {checked && currentId && (
                                                                <div className="mt-3 flex flex-wrap gap-2">
                                                                    <button
                                                                        type="button"
                                                                        onClick={() =>
                                                                            openQuoteEntry({
                                                                                ...vendorRecord,
                                                                                supplier_id: id,
                                                                                supplier_name:
                                                                                    supplier.supplier_name,
                                                                                rfq_vendor_id:
                                                                                    vendorId,
                                                                            })
                                                                        }
                                                                        disabled={
                                                                            !permissions.canUpdate ||
                                                                            !vendorId ||
                                                                            ["CLOSED", "CANCELLED"].includes(
                                                                                String(status).toUpperCase()
                                                                            )
                                                                        }
                                                                        className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-2 text-xs font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
                                                                    >
                                                                        {hasQuote ? (
                                                                            <Pencil size={13} />
                                                                        ) : (
                                                                            <Plus size={13} />
                                                                        )}
                                                                        {hasQuote
                                                                            ? "Edit Quotation"
                                                                            : "Enter Quotation"}
                                                                    </button>

                                                                    {hasQuote && (
                                                                        <button
                                                                            type="button"
                                                                            onClick={() =>
                                                                                openQuoteEntry({
                                                                                    ...vendorRecord,
                                                                                    supplier_id: id,
                                                                                    supplier_name:
                                                                                        supplier.supplier_name,
                                                                                    rfq_vendor_id:
                                                                                        vendorId,
                                                                                })
                                                                            }
                                                                            className={secondaryButton}
                                                                        >
                                                                            <Eye size={13} />
                                                                            View
                                                                        </button>
                                                                    )}
                                                                </div>
                                                            )}

                                                            {checked && !currentId && (
                                                                <p className="mt-2 text-xs text-amber-600 dark:text-amber-400">
                                                                    Save this RFQ before entering quotations.
                                                                </p>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>

                                    {filteredSuppliers.length === 0 && (
                                        <p className="py-8 text-center text-sm text-slate-500">
                                            No active suppliers found.
                                        </p>
                                    )}

                                    <div className="rounded-xl bg-slate-50 p-3 text-xs text-slate-500 dark:bg-slate-950">
                                        {selectedSupplierIds.length} supplier(s) selected
                                    </div>

                                    {/* SUPPLIER RESPONSE SUMMARY */}
                                    {currentId && (
                                        <div className="space-y-3 border-t border-slate-200 pt-5 dark:border-slate-800">
                                            <div className="flex items-center justify-between gap-3">
                                                <div>
                                                    <h3 className="font-semibold text-slate-900 dark:text-white">
                                                        Supplier Response Summary
                                                    </h3>
                                                    <p className="mt-1 text-xs text-slate-500">
                                                        Responses received for this RFQ.
                                                    </p>
                                                </div>

                                                <span className="rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                                                    {quoteVendors.filter(
                                                        (vendor) =>
                                                            getQuoteLines(vendor).length > 0
                                                    ).length}{" "}
                                                    responses
                                                </span>
                                            </div>

                                            {quoteLoading ? (
                                                <div className="flex items-center justify-center gap-2 py-8 text-sm text-slate-500">
                                                    <RefreshCw size={16} className="animate-spin" />
                                                    Loading supplier responses...
                                                </div>
                                            ) : quoteVendors.length === 0 ? (
                                                <div className="rounded-xl border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500 dark:border-slate-700">
                                                    No supplier quotation responses have been recorded yet.
                                                </div>
                                            ) : (
                                                <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700">
                                                    <table className="w-full min-w-[800px] text-left text-xs">
                                                        <thead className="bg-slate-50 text-slate-500 dark:bg-slate-950">
                                                            <tr>
                                                                <th className="px-3 py-3">Supplier</th>
                                                                <th className="px-3 py-3">Response Date</th>
                                                                <th className="px-3 py-3">Validity</th>
                                                                <th className="px-3 py-3">Delivery Days</th>
                                                                <th className="px-3 py-3">Quoted Lines</th>
                                                                <th className="px-3 py-3 text-right">Quotation Total</th>
                                                                <th className="px-3 py-3">Status</th>
                                                            </tr>
                                                        </thead>

                                                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                                            {quoteVendors.map((vendor) => {
                                                                const lines = getQuoteLines(vendor);
                                                                const total = lines.reduce(
                                                                    (sum, line) =>
                                                                        sum + getQuoteAmount(line).total,
                                                                    0
                                                                );

                                                                return (
                                                                    <tr key={vendor.rfq_vendor_id}>
                                                                        <td className="px-3 py-3 font-semibold">
                                                                            {vendor.supplier_name || "Supplier"}
                                                                        </td>
                                                                        <td className="px-3 py-3">
                                                                            {formatDate(vendor.response_date)}
                                                                        </td>
                                                                        <td className="px-3 py-3">
                                                                            {formatDate(vendor.validity_date)}
                                                                        </td>
                                                                        <td className="px-3 py-3">
                                                                            {vendor.delivery_days ?? "—"}
                                                                        </td>
                                                                        <td className="px-3 py-3">
                                                                            {lines.length}
                                                                        </td>
                                                                        <td className="px-3 py-3 text-right font-semibold">
                                                                            {formatMoney(
                                                                                total,
                                                                                vendor.currency || "PKR"
                                                                            )}
                                                                        </td>
                                                                        <td className="px-3 py-3">
                                                                            <span
                                                                                className={`rounded-full border px-2 py-1 text-[10px] font-semibold ${statusClass(vendor.status)}`}
                                                                            >
                                                                                {vendor.status || "INVITED"}
                                                                            </span>
                                                                        </td>
                                                                    </tr>
                                                                );
                                                            })}
                                                        </tbody>
                                                    </table>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* COMPARISON STATEMENT */}
                            {activeTab === "comparison" && (
                                <div className="space-y-4 p-4">
                                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                                        <div>
                                            <h3 className="font-semibold text-slate-900 dark:text-white">
                                                Supplier Comparison Statement
                                            </h3>
                                            <p className="mt-1 text-xs text-slate-500">
                                                Compare submitted quotations by total quoted amount.
                                            </p>
                                        </div>

                                        {currentId && (
                                            <button
                                                type="button"
                                                onClick={() =>
                                                    loadQuoteResponses(currentId)
                                                }
                                                disabled={quoteLoading}
                                                className={secondaryButton}
                                            >
                                                <RefreshCw
                                                    size={15}
                                                    className={quoteLoading ? "animate-spin" : ""}
                                                />
                                                Refresh Comparison
                                            </button>
                                        )}
                                    </div>

                                    {!currentId ? (
                                        <div className="rounded-xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500 dark:border-slate-700">
                                            Save the RFQ first to view supplier quotation comparisons.
                                        </div>
                                    ) : quoteLoading ? (
                                        <div className="flex items-center justify-center gap-2 py-10 text-sm text-slate-500">
                                            <RefreshCw size={17} className="animate-spin" />
                                            Loading comparison...
                                        </div>
                                    ) : comparisonRows.length === 0 ? (
                                        <div className="rounded-xl border border-dashed border-slate-300 p-8 text-center dark:border-slate-700">
                                            <ClipboardList
                                                size={30}
                                                className="mx-auto mb-3 text-slate-300"
                                            />
                                            <p className="font-semibold text-slate-700 dark:text-slate-200">
                                                No supplier quotations available
                                            </p>
                                            <p className="mt-1 text-sm text-slate-500">
                                                Enter quotations in the Vendors tab to generate the comparison statement.
                                            </p>
                                        </div>
                                    ) : (
                                        <>
                                            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                                                <CountCard
                                                    title="Supplier Responses"
                                                    value={comparisonRows.length}
                                                />
                                                <CountCard
                                                    title="Lowest Quotation"
                                                    value={formatMoney(
                                                        comparisonRows[0].total,
                                                        "PKR"
                                                    )}
                                                    highlight
                                                />
                                                <CountCard
                                                    title="RFQ Items"
                                                    value={quoteItems.length}
                                                />
                                            </div>

                                            <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700">
                                                <table className="w-full min-w-[900px] text-left text-xs">
                                                    <thead className="bg-slate-50 text-slate-500 dark:bg-slate-950">
                                                        <tr>
                                                            <th className="px-3 py-3">Rank</th>
                                                            <th className="px-3 py-3">Supplier</th>
                                                            <th className="px-3 py-3">Quoted Lines</th>
                                                            <th className="px-3 py-3">Response Date</th>
                                                            <th className="px-3 py-3">Delivery Days</th>
                                                            <th className="px-3 py-3">Payment Terms</th>
                                                            <th className="px-3 py-3 text-right">Quotation Total</th>
                                                        </tr>
                                                    </thead>

                                                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                                        {comparisonRows.map((row, index) => (
                                                            <tr
                                                                key={row.vendor.rfq_vendor_id}
                                                                className={
                                                                    index === 0
                                                                        ? "bg-emerald-50/60 dark:bg-emerald-950/20"
                                                                        : ""
                                                                }
                                                            >
                                                                <td className="px-3 py-3 font-bold">
                                                                    #{index + 1}
                                                                    {index === 0 && (
                                                                        <span className="ml-2 text-[10px] text-emerald-600">
                                                                            Lowest
                                                                        </span>
                                                                    )}
                                                                </td>
                                                                <td className="px-3 py-3 font-semibold">
                                                                    {row.vendor.supplier_name}
                                                                </td>
                                                                <td className="px-3 py-3">
                                                                    {row.count}
                                                                </td>
                                                                <td className="px-3 py-3">
                                                                    {formatDate(row.vendor.response_date)}
                                                                </td>
                                                                <td className="px-3 py-3">
                                                                    {row.vendor.delivery_days ?? "—"}
                                                                </td>
                                                                <td className="px-3 py-3">
                                                                    {row.vendor.payment_terms || "—"}
                                                                </td>
                                                                <td className="px-3 py-3 text-right font-bold">
                                                                    {formatMoney(
                                                                        row.total,
                                                                        row.vendor.currency || "PKR"
                                                                    )}
                                                                </td>
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                            </div>

                                            <p className="text-xs text-slate-500">
                                                Lowest quotation is ranked by the sum of submitted quotation line totals. Compare delivery, validity and payment terms before selecting a supplier.
                                            </p>
                                        </>
                                    )}
                                </div>
                            )}

                            {/* RELATED TRANSACTIONS */}
                            {activeTab === "related" && (
                                <div className="space-y-3 p-6">
                                    <h3 className="font-semibold text-slate-900 dark:text-white">
                                        Related Transactions
                                    </h3>

                                    {selectedItems.length === 0 ? (
                                        <p className="text-sm text-slate-500">
                                            Select transaction lines to view their source transactions.
                                        </p>
                                    ) : (
                                        <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700">
                                            <table className="w-full min-w-[650px] text-left text-sm">
                                                <thead className="bg-slate-50 text-xs text-slate-500 dark:bg-slate-950">
                                                    <tr>
                                                        <th className="px-3 py-3">Source Type</th>
                                                        <th className="px-3 py-3">Source Transaction</th>
                                                        <th className="px-3 py-3">Item ID</th>
                                                        <th className="px-3 py-3">Item</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                                    {selectedItems.map((item) => (
                                                        <tr key={itemKey(item)}>
                                                            <td className="px-3 py-3">
                                                                {sourceLabel(itemSource(item))}
                                                            </td>
                                                            <td className="px-3 py-3">
                                                                {item.procurement_transaction_number ||
                                                                    item.req_number ||
                                                                    item.source_transaction_number ||
                                                                    "—"}
                                                            </td>
                                                            <td className="px-3 py-3">
                                                                {itemId(item)}
                                                            </td>
                                                            <td className="px-3 py-3">
                                                                {item.item ||
                                                                    item.item_description ||
                                                                    "—"}
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* SYSTEM INFORMATION */}
                            {activeTab === "system" && (
                                <div className="grid grid-cols-1 gap-4 p-6 md:grid-cols-2">
                                    <Field label="RFQ ID">
                                        <input
                                            value={currentId || "Not saved"}
                                            readOnly
                                            className={inputClass}
                                        />
                                    </Field>
                                    <Field label="Transaction Number">
                                        <input
                                            value={transactionNumber}
                                            readOnly
                                            className={inputClass}
                                        />
                                    </Field>
                                    <Field label="Subsidiary">
                                        <input
                                            value={company.companyName || "—"}
                                            readOnly
                                            className={inputClass}
                                        />
                                    </Field>
                                    <Field label="Created From">
                                        <input
                                            value={createdFromLabel}
                                            readOnly
                                            className={inputClass}
                                        />
                                    </Field>
                                </div>
                            )}
                        </section>

                        <section className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
                            <Field label="Memo / Remarks">
                                <textarea
                                    rows={3}
                                    value={memo}
                                    disabled={readOnly}
                                    onChange={(event) => setMemo(event.target.value)}
                                    className={inputClass}
                                    placeholder="Enter additional information..."
                                />
                            </Field>

                            <div className="mt-4 flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-between">
                                <button
                                    type="button"
                                    onClick={() => {
                                        setError("");
                                        setScreen("list");
                                        resetForm();
                                    }}
                                    className={secondaryButton}
                                >
                                    <ArrowLeft size={16} />
                                    Back to History
                                </button>

                                <div className="flex flex-wrap gap-2">
                                    {screen === "edit" &&
                                        permissions.canDelete &&
                                        status === "DRAFT" && (
                                            <button
                                                type="button"
                                                onClick={handleDelete}
                                                disabled={saving}
                                                className="inline-flex items-center gap-2 rounded-xl border border-red-200 px-4 py-2.5 text-sm font-semibold text-red-600 hover:bg-red-50 dark:border-red-900"
                                            >
                                                <Trash2 size={16} />
                                                Delete
                                            </button>
                                        )}

                                    {!readOnly && (
                                        <button
                                            type="button"
                                            onClick={handleSave}
                                            disabled={saving}
                                            className={primaryButton}
                                        >
                                            {saving ? (
                                                <RefreshCw size={16} className="animate-spin" />
                                            ) : (
                                                <Save size={16} />
                                            )}
                                            {saving ? "Saving..." : "Save"}
                                        </button>
                                    )}
                                </div>
                            </div>
                        </section>
                    </>
                )}
            </div>

            {/* SUPPLIER QUOTATION MODAL */}
            {quoteModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-950/60 p-3 backdrop-blur-sm sm:p-6">
                    <div className="my-auto w-full max-w-6xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-900">
                        <div className="flex flex-col gap-3 border-b border-slate-200 p-4 dark:border-slate-800 sm:flex-row sm:items-center sm:justify-between sm:p-5">
                            <div className="flex items-center gap-3">
                                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-950/40 dark:text-blue-300">
                                    <FileText size={21} />
                                </div>
                                <div>
                                    <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                                        Supplier Quotation
                                    </h2>
                                    <p className="mt-1 text-xs text-slate-500">
                                        {quoteVendor?.supplier_name || "Supplier"} •{" "}
                                        {transactionNumber}
                                    </p>
                                </div>
                            </div>

                            <div className="flex items-center gap-2">
                                <span
                                    className={`rounded-full border px-3 py-1 text-xs font-semibold ${statusClass(
                                        quoteMode === "edit" ? "RESPONDED" : "INVITED"
                                    )}`}
                                >
                                    {quoteMode === "edit" ? "EDIT RESPONSE" : "NEW RESPONSE"}
                                </span>
                                <button
                                    type="button"
                                    onClick={closeQuoteModal}
                                    disabled={quoteSaving}
                                    className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
                                >
                                    <X size={19} />
                                </button>
                            </div>
                        </div>

                        <div className="max-h-[75vh] space-y-5 overflow-y-auto p-4 sm:p-5">
                            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                                <Field label="Supplier">
                                    <input
                                        value={quoteVendor?.supplier_name || ""}
                                        readOnly
                                        className={`${inputClass} bg-slate-50 dark:bg-slate-800`}
                                    />
                                </Field>

                                <Field label="Response Date">
                                    <input
                                        type="date"
                                        value={quoteResponseDate}
                                        onChange={(event) =>
                                            setQuoteResponseDate(event.target.value)
                                        }
                                        className={inputClass}
                                    />
                                </Field>

                                <Field label="Quotation Valid Until">
                                    <input
                                        type="date"
                                        value={quoteValidityDate}
                                        min={quoteResponseDate || today()}
                                        onChange={(event) =>
                                            setQuoteValidityDate(event.target.value)
                                        }
                                        className={inputClass}
                                    />
                                </Field>

                                <Field label="Delivery Days">
                                    <input
                                        type="number"
                                        min="0"
                                        step="1"
                                        value={quoteDeliveryDays}
                                        onChange={(event) =>
                                            setQuoteDeliveryDays(event.target.value)
                                        }
                                        className={inputClass}
                                        placeholder="e.g. 15"
                                    />
                                </Field>

                                <Field label="Currency">
                                    <select
                                        value={quoteCurrency}
                                        onChange={(event) =>
                                            setQuoteCurrency(event.target.value)
                                        }
                                        className={inputClass}
                                    >
                                        <option value="PKR">PKR</option>
                                        <option value="USD">USD</option>
                                        <option value="EUR">EUR</option>
                                        <option value="GBP">GBP</option>
                                        <option value="AED">AED</option>
                                        <option value="SAR">SAR</option>
                                    </select>
                                </Field>

                                <Field label="Payment Terms">
                                    <input
                                        value={quotePaymentTerms}
                                        onChange={(event) =>
                                            setQuotePaymentTerms(event.target.value)
                                        }
                                        className={inputClass}
                                        placeholder="e.g. 30 Days"
                                    />
                                </Field>
                            </div>

                            <div className="space-y-3">
                                <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                                    <div>
                                        <h3 className="font-semibold text-slate-900 dark:text-white">
                                            Quotation Items
                                        </h3>
                                        <p className="text-xs text-slate-500">
                                            Enter the supplier&apos;s offered quantity and prices.
                                        </p>
                                    </div>
                                    <span className="text-xs text-slate-500">
                                        {quoteItems.length} RFQ item(s)
                                    </span>
                                </div>

                                <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700">
                                    <table className="w-full min-w-[1150px] text-left text-xs">
                                        <thead className="bg-slate-50 text-slate-500 dark:bg-slate-950 dark:text-slate-400">
                                            <tr>
                                                <th className="px-3 py-3">Item</th>
                                                <th className="px-3 py-3">Description</th>
                                                <th className="px-3 py-3">UOM</th>
                                                <th className="px-3 py-3 text-right">Requested Qty</th>
                                                <th className="px-3 py-3 text-right">Quoted Qty</th>
                                                <th className="px-3 py-3 text-right">Unit Price</th>
                                                <th className="px-3 py-3 text-right">Discount</th>
                                                <th className="px-3 py-3 text-right">Tax %</th>
                                                <th className="px-3 py-3 text-right">Line Total</th>
                                            </tr>
                                        </thead>

                                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                            {quoteItems.map((line, index) => {
                                                const amount = getQuoteAmount(line);

                                                return (
                                                    <tr key={line.rfqItemId}>
                                                        <td className="px-3 py-3 font-semibold">
                                                            {line.item || `Item ${index + 1}`}
                                                        </td>
                                                        <td className="max-w-[180px] px-3 py-3">
                                                            {line.description || "—"}
                                                        </td>
                                                        <td className="px-3 py-3">
                                                            {line.uom || "—"}
                                                        </td>
                                                        <td className="px-3 py-3 text-right">
                                                            {formatQuantity(line.requestedQuantity)}
                                                        </td>
                                                        <td className="w-32 px-2 py-3">
                                                            <input
                                                                type="number"
                                                                min="0.001"
                                                                step="0.001"
                                                                value={line.quotedQuantity}
                                                                onChange={(event) =>
                                                                    updateQuoteLine(
                                                                        index,
                                                                        "quotedQuantity",
                                                                        event.target.value
                                                                    )
                                                                }
                                                                className={`${inputClass} min-w-[105px] text-right`}
                                                            />
                                                        </td>
                                                        <td className="w-36 px-2 py-3">
                                                            <input
                                                                type="number"
                                                                min="0"
                                                                step="0.01"
                                                                value={line.unitPrice}
                                                                onChange={(event) =>
                                                                    updateQuoteLine(
                                                                        index,
                                                                        "unitPrice",
                                                                        event.target.value
                                                                    )
                                                                }
                                                                className={`${inputClass} min-w-[115px] text-right`}
                                                                placeholder="0.00"
                                                            />
                                                        </td>
                                                        <td className="w-32 px-2 py-3">
                                                            <input
                                                                type="number"
                                                                min="0"
                                                                step="0.01"
                                                                value={line.discountAmount}
                                                                onChange={(event) =>
                                                                    updateQuoteLine(
                                                                        index,
                                                                        "discountAmount",
                                                                        event.target.value
                                                                    )
                                                                }
                                                                className={`${inputClass} min-w-[105px] text-right`}
                                                            />
                                                        </td>
                                                        <td className="w-28 px-2 py-3">
                                                            <input
                                                                type="number"
                                                                min="0"
                                                                step="0.01"
                                                                value={line.taxRate}
                                                                onChange={(event) =>
                                                                    updateQuoteLine(
                                                                        index,
                                                                        "taxRate",
                                                                        event.target.value
                                                                    )
                                                                }
                                                                className={`${inputClass} min-w-[90px] text-right`}
                                                            />
                                                        </td>
                                                        <td className="whitespace-nowrap px-3 py-3 text-right font-semibold">
                                                            {formatMoney(amount.total, quoteCurrency)}
                                                        </td>
                                                    </tr>
                                                );
                                            })}

                                            {quoteItems.length === 0 && (
                                                <tr>
                                                    <td
                                                        colSpan={9}
                                                        className="px-4 py-10 text-center text-slate-500"
                                                    >
                                                        No RFQ items are available for quotation.
                                                    </td>
                                                </tr>
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_340px]">
                                <Field label="Supplier Remarks">
                                    <textarea
                                        rows={4}
                                        value={quoteNotes}
                                        onChange={(event) =>
                                            setQuoteNotes(event.target.value)
                                        }
                                        className={inputClass}
                                        placeholder="Enter supplier remarks, delivery conditions or other quotation details..."
                                    />
                                </Field>

                                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-950">
                                    <h3 className="mb-3 flex items-center gap-2 font-semibold">
                                        <Calculator size={17} />
                                        Quotation Summary
                                    </h3>

                                    <div className="space-y-2 text-sm">
                                        <SummaryLine
                                            label="Gross Amount"
                                            value={formatMoney(quoteTotals.gross, quoteCurrency)}
                                        />
                                        <SummaryLine
                                            label="Discount"
                                            value={formatMoney(quoteTotals.discount, quoteCurrency)}
                                        />
                                        <SummaryLine
                                            label="Tax"
                                            value={formatMoney(quoteTotals.tax, quoteCurrency)}
                                        />
                                        <div className="border-t border-slate-200 pt-3 dark:border-slate-700">
                                            <SummaryLine
                                                label="Total Quotation"
                                                value={formatMoney(quoteTotals.total, quoteCurrency)}
                                                strong
                                            />
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="rounded-xl border border-blue-200 bg-blue-50 p-3 text-xs text-blue-800 dark:border-blue-900 dark:bg-blue-950/30 dark:text-blue-200">
                                <div className="flex items-start gap-2">
                                    <AlertCircle size={16} className="mt-0.5 shrink-0" />
                                    <p>
                                        Saving this response changes the supplier status to RESPONDED and makes the quotation available for import into Purchase Quotations.
                                    </p>
                                </div>
                            </div>
                        </div>

                        <div className="flex flex-col-reverse gap-2 border-t border-slate-200 p-4 dark:border-slate-800 sm:flex-row sm:items-center sm:justify-between">
                            <button
                                type="button"
                                onClick={closeQuoteModal}
                                disabled={quoteSaving}
                                className={secondaryButton}
                            >
                                Cancel
                            </button>

                            <button
                                type="button"
                                onClick={saveSupplierQuote}
                                disabled={quoteSaving || quoteItems.length === 0}
                                className={primaryButton}
                            >
                                {quoteSaving ? (
                                    <RefreshCw size={16} className="animate-spin" />
                                ) : (
                                    <Send size={16} />
                                )}
                                {quoteSaving ? "Saving Response..." : "Save Supplier Quotation"}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

function Field({ label, children }) {
    return (
        <label className="block">
            <span className="mb-1.5 block text-xs font-semibold text-slate-600 dark:text-slate-300">
                {label}
            </span>
            {children}
        </label>
    );
}

function SummaryCard({ title, value, icon: Icon }) {
    return (
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-center justify-between gap-3">
                <div>
                    <p className="text-xs font-medium text-slate-500">
                        {title}
                    </p>
                    <p className="mt-2 text-2xl font-bold text-slate-900 dark:text-white">
                        {value}
                    </p>
                </div>
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-950/50 dark:text-blue-300">
                    <Icon size={21} />
                </div>
            </div>
        </div>
    );
}

function CountCard({ title, value, highlight = false }) {
    return (
        <div
            className={`rounded-xl border p-3 ${
                highlight
                    ? "border-blue-200 bg-blue-50/60 dark:border-blue-900 dark:bg-blue-950/20"
                    : "border-slate-200 dark:border-slate-700"
            }`}
        >
            <p
                className={`text-xs ${
                    highlight
                        ? "text-blue-700 dark:text-blue-300"
                        : "text-slate-500"
                }`}
            >
                {title}
            </p>
            <p
                className={`mt-1 text-xl font-bold ${
                    highlight
                        ? "text-blue-700 dark:text-blue-300"
                        : "text-slate-900 dark:text-white"
                }`}
            >
                {value}
            </p>
        </div>
    );
}

function SummaryLine({ label, value, strong = false }) {
    return (
        <div className="flex items-center justify-between gap-3">
            <span
                className={
                    strong
                        ? "font-bold text-slate-900 dark:text-white"
                        : "text-slate-500"
                }
            >
                {label}
            </span>
            <span
                className={
                    strong
                        ? "text-base font-bold text-blue-700 dark:text-blue-300"
                        : "font-medium text-slate-800 dark:text-slate-200"
                }
            >
                {value}
            </span>
        </div>
    );
}
