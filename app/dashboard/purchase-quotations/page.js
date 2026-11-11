"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Plus,
  RefreshCw,
  Search,
  FileText,
  Pencil,
  Trash2,
  Eye,
  X,
  Save,
  ShoppingCart,
  ClipboardList,
  AlertCircle,
  CheckCircle2,
  Package,
  ArrowLeft,
  Download,
  Building2,
  CircleDollarSign,
} from "lucide-react";

const API_URL = "/api/purchase-quotations";

const STATUS_OPTIONS = [
  "DRAFT",
  "PENDING",
  "APPROVED",
  "REJECTED",
  "CONVERTED",
  "CANCELLED",
];

const CURRENCIES = [
  { value: "PKR", label: "PKR - Pakistani Rupee" },
  { value: "USD", label: "USD - US Dollar" },
  { value: "EUR", label: "EUR - Euro" },
  { value: "GBP", label: "GBP - British Pound" },
  { value: "AED", label: "AED - UAE Dirham" },
  { value: "SAR", label: "SAR - Saudi Riyal" },
];

const inputClass =
  "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-500 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:disabled:bg-slate-800/60";

const labelClass =
  "mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-300";

function today() {
  const date = new Date();
  const localDate = new Date(
    date.getTime() - date.getTimezoneOffset() * 60000
  );

  return localDate.toISOString().slice(0, 10);
}

function formatDate(value) {
  if (!value) return "—";

  const raw = String(value).slice(0, 10);
  const parts = raw.split("-");

  if (parts.length === 3) {
    const [year, month, day] = parts.map(Number);

    if (year && month && day) {
      return new Date(year, month - 1, day).toLocaleDateString(
        "en-PK",
        {
          day: "2-digit",
          month: "short",
          year: "numeric",
        }
      );
    }
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return raw;

  return date.toLocaleDateString("en-PK", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function formatMoney(value, currency = "PKR") {
  const amount = Number(value || 0);

  try {
    return new Intl.NumberFormat("en-PK", {
      style: "currency",
      currency: currency || "PKR",
      maximumFractionDigits: 2,
    }).format(Number.isFinite(amount) ? amount : 0);
  } catch {
    return `${currency || "PKR"} ${
      Number.isFinite(amount) ? amount.toFixed(2) : "0.00"
    }`;
  }
}

function calculateLine(item) {
  const quantity = Number(item.quantity || 0);
  const price = Number(item.unitPrice || 0);
  const discount = Number(item.discountAmount || 0);
  const taxRate = Number(item.taxRate || 0);

  const gross = quantity * price;
  const taxable = Math.max(0, gross - discount);
  const tax = taxable * (taxRate / 100);

  return {
    ...item,
    gross,
    taxable,
    taxAmount: tax,
    lineTotal: taxable + tax,
  };
}

function statusClass(status) {
  switch (status) {
    case "APPROVED":
      return "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300";

    case "REJECTED":
    case "CANCELLED":
      return "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300";

    case "CONVERTED":
      return "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300";

    case "PENDING":
      return "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300";

    default:
      return "bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-200";
  }
}

function emptyForm(sourceType = "MANUAL") {
  return {
    sourceType,
    supplierId: "",
    rfqId: "",
    rfqVendorId: "",
    quotationDate: today(),
    validUntil: "",
    status: "DRAFT",
    currencyCode: "PKR",
    exchangeRate: "1",
    termsConditions: "",
    remarks: "",
    items: [],
  };
}

function normalizeQuotationItem(item) {
  return {
    purchaseQuotationItemId:
      item.purchase_quotation_item_id || null,
    productId: item.product_id || null,
    rfqItemId: item.rfq_item_id || null,
    sku: item.sku || "",
    productName: item.product_name || "",
    itemDescription: item.item_description || "",
    uom: item.uom || "",
    quantity: Number(item.quantity || 0),
    unitPrice: Number(item.unit_price || 0),
    discountAmount: Number(item.discount_amount || 0),
    taxRate: Number(item.tax_rate || 0),
    taxAmount: Number(item.tax_amount || 0),
    lineTotal: Number(item.line_total || 0),
    remarks: item.remarks || "",
  };
}

function getErrorMessage(data, fallback) {
  return (
    data?.message ||
    data?.error ||
    data?.details ||
    fallback
  );
}

export default function PurchaseQuotationsPage() {
  const [quotations, setQuotations] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [products, setProducts] = useState([]);
  const [rfqOptions, setRfqOptions] = useState([]);

  const [permissions, setPermissions] = useState({
    canView: false,
    canCreate: false,
    canUpdate: false,
    canDelete: false,
  });

  const [permissionLoaded, setPermissionLoaded] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState(null);

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");

  const [formOpen, setFormOpen] = useState(false);
  const [viewOnly, setViewOnly] = useState(false);
  const [editingId, setEditingId] = useState(null);

  const [form, setForm] = useState(emptyForm());

  const [selectedProductId, setSelectedProductId] = useState("");
  const [newQuantity, setNewQuantity] = useState("1");
  const [newPrice, setNewPrice] = useState("0");

  const loadData = useCallback(async (showLoader = true) => {
    if (showLoader) setLoading(true);

    setError("");

    try {
      const response = await fetch(API_URL, {
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
          getErrorMessage(
            data,
            "Could not load purchase quotations."
          )
        );
      }

      setQuotations(
        Array.isArray(data.quotations) ? data.quotations : []
      );

      setSuppliers(
        Array.isArray(data.suppliers) ? data.suppliers : []
      );

      setProducts(
        Array.isArray(data.products) ? data.products : []
      );

      setRfqOptions(
        Array.isArray(data.rfqOptions) ? data.rfqOptions : []
      );

      setPermissions({
  // A successful API response means requirePermission()
  // has already approved access to this page.
  canView: response.ok && data.success === true,

  canCreate: Boolean(data.permissions?.canCreate),
  canUpdate: Boolean(data.permissions?.canUpdate),
  canDelete: Boolean(data.permissions?.canDelete),
});

      setPermissionLoaded(true);
    } catch (err) {
      setError(err.message || "Could not load data.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
        void loadData();
    }, 0);

    return () => clearTimeout(timer);
}, [loadData]);

  const filteredQuotations = useMemo(() => {
    const term = search.trim().toLowerCase();

    return quotations.filter((quotation) => {
      const matchesSearch =
        !term ||
        String(quotation.quotation_number || "")
          .toLowerCase()
          .includes(term) ||
        String(quotation.supplier_name || "")
          .toLowerCase()
          .includes(term) ||
        String(quotation.rfq_number || "")
          .toLowerCase()
          .includes(term);

      const matchesStatus =
        statusFilter === "ALL" ||
        quotation.status === statusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [quotations, search, statusFilter]);

  const totals = useMemo(
    () => ({
      count: quotations.length,
      draft: quotations.filter((q) => q.status === "DRAFT").length,
      approved: quotations.filter((q) => q.status === "APPROVED").length,
      amount: quotations.reduce(
        (sum, quotation) =>
          sum + Number(quotation.grand_total || 0),
        0
      ),
    }),
    [quotations]
  );

  const selectedRfqOption = useMemo(
    () =>
      rfqOptions.find(
        (item) =>
          String(item.rfq_vendor_id) ===
          String(form.rfqVendorId)
      ) || null,
    [rfqOptions, form.rfqVendorId]
  );

  const selectedSupplier = useMemo(
    () =>
      suppliers.find(
        (supplier) =>
          String(supplier.supplier_id) ===
          String(form.supplierId)
      ) || null,
    [suppliers, form.supplierId]
  );

  const calculatedItems = useMemo(
    () => form.items.map(calculateLine),
    [form.items]
  );

  const subtotal = calculatedItems.reduce(
    (sum, item) => sum + item.gross,
    0
  );

  const discountTotal = calculatedItems.reduce(
    (sum, item) =>
      sum + Number(item.discountAmount || 0),
    0
  );

  const taxTotal = calculatedItems.reduce(
    (sum, item) => sum + item.taxAmount,
    0
  );

  const grandTotal = calculatedItems.reduce(
    (sum, item) => sum + item.lineTotal,
    0
  );

  const availableRfqOptions = useMemo(
    () =>
      rfqOptions.filter(
        (item) => Number(item.quote_count || 0) > 0
      ),
    [rfqOptions]
  );

  function updateForm(field, value) {
    setForm((current) => ({
      ...current,
      [field]: value,
    }));
  }

  function updateItem(index, field, value) {
    setForm((current) => ({
      ...current,
      items: current.items.map((item, itemIndex) =>
        itemIndex === index
          ? {
              ...item,
              [field]: value,
            }
          : item
      ),
    }));
  }

  function openCreate(sourceType) {
    if (!permissions.canCreate) {
      setError(
        "You do not have permission to create quotations."
      );
      return;
    }

    setError("");
    setSuccess("");

    setEditingId(null);
    setViewOnly(false);

    setForm(emptyForm(sourceType));

    setSelectedProductId("");
    setNewQuantity("1");
    setNewPrice("0");

    setFormOpen(true);
  }

  function addManualProduct() {
    if (viewOnly) return;

    const product = products.find(
      (item) =>
        String(item.product_id) ===
        String(selectedProductId)
    );

    if (!product) {
      setError("Select a product first.");
      return;
    }

    if (
      form.items.some(
        (item) =>
          Number(item.productId) ===
          Number(product.product_id)
      )
    ) {
      setError("This product is already in the quotation.");
      return;
    }

    const quantity = Number(newQuantity);
    const price = Number(newPrice);

    if (!Number.isFinite(quantity) || quantity <= 0) {
      setError("Enter a valid quantity greater than zero.");
      return;
    }

    if (!Number.isFinite(price) || price < 0) {
      setError("Enter a valid unit price.");
      return;
    }

    setForm((current) => ({
      ...current,
      items: [
        ...current.items,
        {
          productId: product.product_id,
          sku: product.sku || "",
          productName: product.product_name || "",
          itemDescription:
            product.description ||
            product.product_name ||
            "",
          uom: product.uom || "PCS",
          quantity,
          unitPrice: price,
          discountAmount: 0,
          taxRate: 0,
          remarks: "",
        },
      ],
    }));

    setSelectedProductId("");
    setNewQuantity("1");
    setNewPrice("0");
    setError("");
  }

  function removeItem(index) {
    if (viewOnly) return;

    setForm((current) => ({
      ...current,
      items: current.items.filter(
        (_, itemIndex) => itemIndex !== index
      ),
    }));
  }

  async function openExisting(id, mode = "edit") {
    setError("");
    setSuccess("");

    if (mode === "edit" && !permissions.canUpdate) {
      setError(
        "You do not have permission to edit quotations."
      );
      return;
    }

    try {
      const response = await fetch(`${API_URL}/${id}`, {
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
          getErrorMessage(data, "Could not load quotation.")
        );
      }

      const quotation = data.quotation;

      if (!quotation) {
        throw new Error(
          "Quotation details were not returned."
        );
      }

      const items = (quotation.items || []).map(
        normalizeQuotationItem
      );

      setForm({
        sourceType: quotation.source_type || "MANUAL",
        supplierId: String(quotation.supplier_id || ""),
        rfqId: quotation.rfq_id
          ? String(quotation.rfq_id)
          : "",
        rfqVendorId: quotation.rfq_vendor_id
          ? String(quotation.rfq_vendor_id)
          : "",
        quotationDate: String(
          quotation.quotation_date || today()
        ).slice(0, 10),
        validUntil: quotation.valid_until
          ? String(quotation.valid_until).slice(0, 10)
          : "",
        status: quotation.status || "DRAFT",
        currencyCode: quotation.currency_code || "PKR",
        exchangeRate: String(
          quotation.exchange_rate || 1
        ),
        termsConditions: quotation.terms_conditions || "",
        remarks: quotation.remarks || "",
        items,
      });

      setEditingId(id);
      setViewOnly(mode === "view");
      setFormOpen(true);
    } catch (err) {
      setError(
        err.message || "Could not open quotation."
      );
    }
  }

  function closeForm() {
    if (saving) return;

    setFormOpen(false);
    setEditingId(null);
    setViewOnly(false);
    setForm(emptyForm());
    setError("");
  }

  function selectRfqSupplier(value) {
    const option = rfqOptions.find(
      (item) =>
        String(item.rfq_vendor_id) === String(value)
    );

    setForm((current) => ({
      ...current,
      rfqVendorId: value,
      rfqId: option ? String(option.rfq_id) : "",
      supplierId: option
        ? String(option.supplier_id)
        : "",
      currencyCode:
        option?.currency_code || current.currencyCode || "PKR",
      validUntil: option?.validity_date
        ? String(option.validity_date).slice(0, 10)
        : current.validUntil,
      termsConditions:
        option?.payment_terms || current.termsConditions,
      remarks: option?.notes || current.remarks,
    }));
  }

  async function handleSave(event) {
    event.preventDefault();

    if (viewOnly) return;

    if (editingId && !permissions.canUpdate) {
      setError(
        "You do not have permission to update quotations."
      );
      return;
    }

    if (!editingId && !permissions.canCreate) {
      setError(
        "You do not have permission to create quotations."
      );
      return;
    }

    setError("");
    setSuccess("");

    if (!form.supplierId) {
      setError("Select a supplier.");
      return;
    }

    if (!form.quotationDate) {
      setError("Select a quotation date.");
      return;
    }

    if (
      form.validUntil &&
      form.validUntil < form.quotationDate
    ) {
      setError(
        "Valid Until cannot be earlier than the quotation date."
      );
      return;
    }

    if (!form.currencyCode) {
      setError("Select a currency.");
      return;
    }

    const exchangeRate = Number(form.exchangeRate);

    if (
      !Number.isFinite(exchangeRate) ||
      exchangeRate <= 0
    ) {
      setError(
        "Exchange rate must be greater than zero."
      );
      return;
    }

    if (
      form.sourceType === "MANUAL" &&
      !form.items.length
    ) {
      setError("Add at least one product.");
      return;
    }

    if (form.sourceType === "RFQ") {
      if (!form.rfqId || !form.rfqVendorId) {
        setError(
          "Select an RFQ and its supplier submission."
        );
        return;
      }

      if (!selectedRfqOption && !editingId) {
        setError(
          "The selected RFQ supplier submission is unavailable. Refresh and try again."
        );
        return;
      }

      if (
        selectedRfqOption &&
        Number(selectedRfqOption.quote_count || 0) <= 0 &&
        !editingId
      ) {
        setError(
          "The selected supplier has no submitted quotation lines."
        );
        return;
      }
    }

    const items = form.items.map((item) => ({
      productId: item.productId,
      purchaseQuotationItemId:
        item.purchaseQuotationItemId,
      quantity: Number(item.quantity),
      unitPrice: Number(item.unitPrice),
      discountAmount: Number(
        item.discountAmount || 0
      ),
      taxRate: Number(item.taxRate || 0),
      remarks: item.remarks || "",
    }));

    if (form.sourceType === "MANUAL") {
      for (const item of items) {
        if (
          !item.productId ||
          !Number.isFinite(item.quantity) ||
          item.quantity <= 0 ||
          !Number.isFinite(item.unitPrice) ||
          item.unitPrice < 0 ||
          !Number.isFinite(item.discountAmount) ||
          item.discountAmount < 0 ||
          !Number.isFinite(item.taxRate) ||
          item.taxRate < 0 ||
          item.taxRate > 100
        ) {
          setError(
            "Check product, quantity, price, discount and tax values."
          );
          return;
        }

        if (
          item.discountAmount >
          item.quantity * item.unitPrice
        ) {
          setError(
            "An item discount cannot exceed its gross amount."
          );
          return;
        }
      }
    } else if (editingId) {
      for (const item of items) {
        if (
          !item.purchaseQuotationItemId ||
          !Number.isFinite(item.quantity) ||
          item.quantity <= 0 ||
          !Number.isFinite(item.unitPrice) ||
          item.unitPrice < 0 ||
          !Number.isFinite(item.discountAmount) ||
          item.discountAmount < 0 ||
          !Number.isFinite(item.taxRate) ||
          item.taxRate < 0 ||
          item.taxRate > 100
        ) {
          setError(
            "Check the imported RFQ item values."
          );
          return;
        }

        if (
          item.discountAmount >
          item.quantity * item.unitPrice
        ) {
          setError(
            "An item discount cannot exceed its gross amount."
          );
          return;
        }
      }
    }

    const payload = {
      sourceType: form.sourceType,
      supplierId: Number(form.supplierId),
      rfqId:
        form.sourceType === "RFQ"
          ? Number(form.rfqId)
          : null,
      rfqVendorId:
        form.sourceType === "RFQ"
          ? Number(form.rfqVendorId)
          : null,
      quotationDate: form.quotationDate,
      validUntil: form.validUntil || null,
      status: form.status,
      currencyCode: form.currencyCode,
      exchangeRate,
      termsConditions: form.termsConditions,
      remarks: form.remarks,
      items,
    };

    setSaving(true);

    try {
      const response = await fetch(
        editingId
          ? `${API_URL}/${editingId}`
          : API_URL,
        {
          method: editingId ? "PATCH" : "POST",
          credentials: "same-origin",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          body: JSON.stringify(payload),
        }
      );

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(
          getErrorMessage(
            data,
            "Could not save quotation."
          )
        );
      }

      setSuccess(
        data.message ||
          "Purchase quotation saved successfully."
      );

      setFormOpen(false);
      setEditingId(null);
      setViewOnly(false);

      await loadData(false);
    } catch (err) {
      setError(
        err.message || "Could not save quotation."
      );
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(quotation) {
    if (!permissions.canDelete) {
      setError(
        "You do not have permission to delete quotations."
      );
      return;
    }

    const confirmed = window.confirm(
      `Delete purchase quotation ${quotation.quotation_number}? Only DRAFT quotations can be deleted.`
    );

    if (!confirmed) return;

    setError("");
    setSuccess("");

    const id = quotation.purchase_quotation_id;

    setDeletingId(id);

    try {
      const response = await fetch(`${API_URL}/${id}`, {
        method: "DELETE",
        credentials: "same-origin",
        headers: {
          Accept: "application/json",
        },
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(
          getErrorMessage(
            data,
            "Could not delete quotation."
          )
        );
      }

      setSuccess(
        data.message || "Quotation deleted successfully."
      );

      await loadData(false);
    } catch (err) {
      setError(
        err.message || "Could not delete quotation."
      );
    } finally {
      setDeletingId(null);
    }
  }

  function printQuotation() {
    window.print();
  }

  if (loading && !permissionLoaded) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center gap-2 text-sm text-slate-500">
        <RefreshCw size={18} className="animate-spin" />
        Loading purchase quotations...
      </div>
    );
  }

  if (
    permissionLoaded &&
    !permissions.canView
  ) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center p-5">
        <div className="max-w-md rounded-2xl border border-red-200 bg-white p-8 text-center shadow-sm dark:border-red-900 dark:bg-slate-900">
          <AlertCircle
            size={38}
            className="mx-auto text-red-500"
          />

          <h2 className="mt-4 text-lg font-bold">
            Access Restricted
          </h2>

          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
            You do not have permission to view Purchase
            Quotations. Contact your administrator to request
            access.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen space-y-5 bg-slate-50 p-3 text-slate-800 dark:bg-slate-950 dark:text-slate-100 sm:p-5">
      <style jsx global>{`
        @media print {
          body * {
            visibility: hidden !important;
          }

          [data-print-area],
          [data-print-area] * {
            visibility: visible !important;
          }

          [data-print-area] {
            position: absolute !important;
            inset: 0 !important;
            width: 100% !important;
            padding: 24px !important;
            background: white !important;
            color: black !important;
            box-shadow: none !important;
          }

          .no-print {
            display: none !important;
          }

          input,
          textarea,
          select {
            border: none !important;
            background: transparent !important;
            color: black !important;
          }

          table {
            page-break-inside: auto;
          }

          tr {
            page-break-inside: avoid;
          }
        }
      `}</style>

      {/* Header */}
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-blue-600 p-2.5 text-white shadow-sm">
            <ShoppingCart size={23} />
          </div>

          <div>
            <h1 className="text-xl font-bold sm:text-2xl">
              Purchase Quotations
            </h1>

            <p className="text-xs text-slate-500 dark:text-slate-400">
              Manage supplier quotations manually or import
              submitted RFQ quotations.
            </p>
          </div>
        </div>

        <div className="no-print flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => loadData()}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium hover:bg-slate-100 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900 dark:hover:bg-slate-800"
          >
            <RefreshCw
              size={15}
              className={loading ? "animate-spin" : ""}
            />
            Refresh
          </button>

          {permissions.canCreate && (
            <>
              <button
                type="button"
                onClick={() => openCreate("MANUAL")}
                className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-700"
              >
                <Plus size={16} />
                Manual Quotation
              </button>

              <button
                type="button"
                onClick={() => openCreate("RFQ")}
                className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-3 py-2 text-sm font-semibold text-white hover:bg-indigo-700"
              >
                <ClipboardList size={16} />
                From RFQ
              </button>
            </>
          )}
        </div>
      </div>

      {/* Alerts */}
      {error && !formOpen && (
        <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300">
          <AlertCircle
            size={17}
            className="mt-0.5 shrink-0"
          />

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
        <div className="flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-700 dark:border-green-900 dark:bg-green-950/30 dark:text-green-300">
          <CheckCircle2 size={17} />

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

      {/* Summary */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          {
            label: "Total Quotations",
            value: totals.count,
            Icon: FileText,
          },
          {
            label: "Draft",
            value: totals.draft,
            Icon: ClipboardList,
          },
          {
            label: "Approved",
            value: totals.approved,
            Icon: CheckCircle2,
          },
          {
            label: "Total Quotation Value",
            value: formatMoney(totals.amount),
            Icon: CircleDollarSign,
          },
        ].map(({ label, value, Icon }) => (
          <div
            key={label}
            className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900"
          >
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {label}
              </p>

              <Icon
                size={17}
                className="text-blue-500"
              />
            </div>

            <p className="mt-2 break-words text-xl font-bold">
              {value}
            </p>
          </div>
        ))}
      </div>

      {/* Search */}
      <div className="no-print rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-col gap-2 sm:flex-row">
          <div className="relative flex-1">
            <Search
              size={16}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
            />

            <input
              value={search}
              onChange={(event) =>
                setSearch(event.target.value)
              }
              placeholder="Search quotation number, supplier, or RFQ..."
              className={`${inputClass} pl-9`}
            />
          </div>

          <select
            value={statusFilter}
            onChange={(event) =>
              setStatusFilter(event.target.value)
            }
            className={`${inputClass} sm:w-48`}
          >
            <option value="ALL">All statuses</option>

            {STATUS_OPTIONS.map((status) => (
              <option key={status} value={status}>
                {status.replaceAll("_", " ")}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* History */}
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3 dark:border-slate-800">
          <h2 className="font-semibold">
            Quotation History
          </h2>

          <span className="text-xs text-slate-500">
            {filteredQuotations.length} record(s)
          </span>
        </div>

        {loading ? (
          <div className="flex items-center justify-center gap-2 p-12 text-sm text-slate-500">
            <RefreshCw
              size={17}
              className="animate-spin"
            />
            Loading quotations...
          </div>
        ) : filteredQuotations.length === 0 ? (
          <div className="p-12 text-center">
            <Package
              size={35}
              className="mx-auto text-slate-300"
            />

            <p className="mt-3 font-medium">
              No purchase quotations found
            </p>

            <p className="mt-1 text-xs text-slate-500">
              Create a manual quotation or import one from
              an RFQ.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[950px] text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase text-slate-500 dark:bg-slate-800/70 dark:text-slate-400">
                <tr>
                  <th className="px-4 py-3">
                    Quotation No.
                  </th>
                  <th className="px-4 py-3">Supplier</th>
                  <th className="px-4 py-3">Source</th>
                  <th className="px-4 py-3">RFQ No.</th>
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3">Valid Until</th>
                  <th className="px-4 py-3 text-right">
                    Total
                  </th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">
                    Actions
                  </th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {filteredQuotations.map((quotation) => (
                  <tr
                    key={quotation.purchase_quotation_id}
                    className="hover:bg-slate-50 dark:hover:bg-slate-800/40"
                  >
                    <td className="px-4 py-3 font-semibold text-blue-600 dark:text-blue-400">
                      {quotation.quotation_number}
                    </td>

                    <td className="px-4 py-3">
                      <div className="font-medium">
                        {quotation.supplier_name}
                      </div>

                      <div className="text-xs text-slate-500">
                        {quotation.supplier_code || ""}
                      </div>
                    </td>

                    <td className="px-4 py-3">
                      <span className="rounded-md bg-slate-100 px-2 py-1 text-xs dark:bg-slate-800">
                        {quotation.source_type === "RFQ"
                          ? "From RFQ"
                          : "Manual"}
                      </span>
                    </td>

                    <td className="px-4 py-3">
                      {quotation.rfq_number || "—"}
                    </td>

                    <td className="px-4 py-3">
                      {formatDate(
                        quotation.quotation_date
                      )}
                    </td>

                    <td className="px-4 py-3">
                      {formatDate(quotation.valid_until)}
                    </td>

                    <td className="px-4 py-3 text-right font-semibold">
                      {formatMoney(
                        quotation.grand_total,
                        quotation.currency_code
                      )}
                    </td>

                    <td className="px-4 py-3">
                      <span
                        className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${statusClass(
                          quotation.status
                        )}`}
                      >
                        {quotation.status}
                      </span>
                    </td>

                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-1">
                        <button
                          type="button"
                          title="View"
                          onClick={() =>
                            openExisting(
                              quotation.purchase_quotation_id,
                              "view"
                            )
                          }
                          className="rounded-md p-2 text-slate-500 hover:bg-blue-50 hover:text-blue-600 dark:hover:bg-slate-800"
                        >
                          <Eye size={16} />
                        </button>

                        {permissions.canUpdate &&
                          quotation.status === "DRAFT" && (
                            <button
                              type="button"
                              title="Edit"
                              onClick={() =>
                                openExisting(
                                  quotation.purchase_quotation_id,
                                  "edit"
                                )
                              }
                              className="rounded-md p-2 text-slate-500 hover:bg-amber-50 hover:text-amber-600 dark:hover:bg-slate-800"
                            >
                              <Pencil size={16} />
                            </button>
                          )}

                        {permissions.canDelete &&
                          quotation.status === "DRAFT" && (
                            <button
                              type="button"
                              title="Delete"
                              disabled={
                                deletingId ===
                                quotation.purchase_quotation_id
                              }
                              onClick={() =>
                                handleDelete(quotation)
                              }
                              className="rounded-md p-2 text-slate-500 hover:bg-red-50 hover:text-red-600 disabled:opacity-50 dark:hover:bg-slate-800"
                            >
                              {deletingId ===
                              quotation.purchase_quotation_id ? (
                                <RefreshCw
                                  size={16}
                                  className="animate-spin"
                                />
                              ) : (
                                <Trash2 size={16} />
                              )}
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
      </div>

      {/* Create / Edit / View Modal */}
      {formOpen && (
        <div className="fixed inset-0 z-[100] overflow-y-auto bg-slate-950/60 p-2 backdrop-blur-sm sm:p-5">
          <div
            data-print-area
            className="mx-auto my-2 max-w-7xl rounded-2xl bg-white shadow-2xl dark:bg-slate-900"
          >
            {/* Modal Header */}
            <div className="no-print flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-4 py-4 dark:border-slate-800 sm:px-6">
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={closeForm}
                  disabled={saving}
                  className="rounded-lg border border-slate-300 p-2 hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800"
                >
                  <ArrowLeft size={17} />
                </button>

                <div>
                  <h2 className="text-lg font-bold">
                    {viewOnly
                      ? "View Purchase Quotation"
                      : editingId
                        ? "Edit Purchase Quotation"
                        : "Create Purchase Quotation"}
                  </h2>

                  <p className="text-xs text-slate-500">
                    {form.sourceType === "RFQ"
                      ? "Imported from supplier quotation in RFQ"
                      : "Manual supplier quotation"}
                  </p>
                </div>
              </div>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={printQuotation}
                  className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-sm hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800"
                >
                  <Download size={15} />
                  Print / PDF
                </button>

                <button
                  type="button"
                  onClick={closeForm}
                  className="rounded-lg p-2 hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  <X size={19} />
                </button>
              </div>
            </div>

            <form
              onSubmit={handleSave}
              className="space-y-5 p-4 sm:p-6"
            >
              {error && (
                <div className="no-print flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300">
                  <AlertCircle
                    size={17}
                    className="mt-0.5 shrink-0"
                  />

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

              {/* Header Information */}
              <div className="grid gap-4 rounded-xl border border-slate-200 p-4 dark:border-slate-700 md:grid-cols-3">
                <div>
                  <label className={labelClass}>
                    Quotation Source
                  </label>

                  <input
                    readOnly
                    value={
                      form.sourceType === "RFQ"
                        ? "From RFQ"
                        : "Manual"
                    }
                    className={inputClass}
                  />
                </div>

                <div>
                  <label className={labelClass}>
                    Supplier *
                  </label>

                  <select
                    required
                    disabled={
                      viewOnly ||
                      form.sourceType === "RFQ"
                    }
                    value={form.supplierId}
                    onChange={(event) =>
                      updateForm(
                        "supplierId",
                        event.target.value
                      )
                    }
                    className={inputClass}
                  >
                    <option value="">
                      Select supplier
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
                </div>

                <div>
                  <label className={labelClass}>
                    Quotation Date *
                  </label>

                  <input
                    type="date"
                    required
                    disabled={viewOnly}
                    value={form.quotationDate}
                    onChange={(event) =>
                      updateForm(
                        "quotationDate",
                        event.target.value
                      )
                    }
                    className={inputClass}
                  />
                </div>

                <div>
                  <label className={labelClass}>
                    Valid Until
                  </label>

                  <input
                    type="date"
                    disabled={viewOnly}
                    min={form.quotationDate}
                    value={form.validUntil}
                    onChange={(event) =>
                      updateForm(
                        "validUntil",
                        event.target.value
                      )
                    }
                    className={inputClass}
                  />
                </div>

                <div>
                  <label className={labelClass}>
                    Currency
                  </label>

                  <select
                    disabled={viewOnly}
                    value={form.currencyCode}
                    onChange={(event) =>
                      updateForm(
                        "currencyCode",
                        event.target.value
                      )
                    }
                    className={inputClass}
                  >
                    {CURRENCIES.map((currency) => (
                      <option
                        key={currency.value}
                        value={currency.value}
                      >
                        {currency.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className={labelClass}>
                    Exchange Rate
                  </label>

                  <input
                    type="number"
                    min="0.000001"
                    step="0.000001"
                    required
                    disabled={viewOnly}
                    value={form.exchangeRate}
                    onChange={(event) =>
                      updateForm(
                        "exchangeRate",
                        event.target.value
                      )
                    }
                    className={inputClass}
                  />
                </div>

                <div>
                  <label className={labelClass}>
                    Status
                  </label>

                  <select
                    disabled={viewOnly}
                    value={form.status}
                    onChange={(event) =>
                      updateForm(
                        "status",
                        event.target.value
                      )
                    }
                    className={inputClass}
                  >
                    {STATUS_OPTIONS.map((status) => (
                      <option key={status} value={status}>
                        {status.replaceAll("_", " ")}
                      </option>
                    ))}
                  </select>
                </div>

                {form.sourceType === "RFQ" && (
                  <div className="md:col-span-2">
                    <label className={labelClass}>
                      RFQ and Supplier Submission *
                    </label>

                    <select
                      required
                      disabled={
                        viewOnly || Boolean(editingId)
                      }
                      value={form.rfqVendorId}
                      onChange={(event) =>
                        selectRfqSupplier(event.target.value)
                      }
                      className={inputClass}
                    >
                      <option value="">
                        Select RFQ supplier submission
                      </option>

                      {availableRfqOptions.map((item) => (
                        <option
                          key={item.rfq_vendor_id}
                          value={item.rfq_vendor_id}
                        >
                          {item.transaction_number} —{" "}
                          {item.supplier_name}
                          {" · "}
                          {item.quote_count} quoted line(s)
                        </option>
                      ))}

                      {editingId &&
                        form.rfqVendorId &&
                        !availableRfqOptions.some(
                          (item) =>
                            String(item.rfq_vendor_id) ===
                            String(form.rfqVendorId)
                        ) && (
                          <option value={form.rfqVendorId}>
                            Original RFQ supplier submission
                          </option>
                        )}
                    </select>

                    {editingId && (
                      <p className="mt-1 text-[11px] text-slate-500">
                        The original RFQ supplier source is locked.
                      </p>
                    )}

                    {!editingId &&
                      availableRfqOptions.length === 0 && (
                        <p className="mt-1 text-xs text-amber-600 dark:text-amber-400">
                          No supplier quotations are available.
                          Enter supplier prices in the RFQ response
                          screen first.
                        </p>
                      )}
                  </div>
                )}
              </div>

              {/* RFQ Information */}
              {form.sourceType === "RFQ" && !editingId && (
                <div className="rounded-lg border border-indigo-200 bg-indigo-50 p-3 text-sm text-indigo-800 dark:border-indigo-900 dark:bg-indigo-950/30 dark:text-indigo-200">
                  <div className="flex items-start gap-2">
                    <ClipboardList
                      size={18}
                      className="mt-0.5 shrink-0"
                    />

                    <div className="min-w-0 flex-1">
                      <p className="font-semibold">
                        Import supplier quotation
                      </p>

                      <p className="mt-1 text-xs">
                        Select a supplier submission. Its saved
                        quantities, prices, discounts, taxes and
                        remarks will be copied into this purchase
                        quotation when you save.
                      </p>

                      {selectedRfqOption && (
                        <div className="mt-3 grid gap-2 border-t border-indigo-200 pt-3 text-xs dark:border-indigo-800 sm:grid-cols-3">
                          <div>
                            <span className="opacity-70">
                              RFQ Number
                            </span>
                            <p className="font-semibold">
                              {selectedRfqOption.transaction_number ||
                                "—"}
                            </p>
                          </div>

                          <div>
                            <span className="opacity-70">
                              Quoted Lines
                            </span>
                            <p className="font-semibold">
                              {selectedRfqOption.quote_count || 0}
                            </p>
                          </div>

                          <div>
                            <span className="opacity-70">
                              Quoted Subtotal
                            </span>
                            <p className="font-semibold">
                              {formatMoney(
                                selectedRfqOption.quoted_subtotal,
                                selectedRfqOption.currency_code ||
                                  form.currencyCode
                              )}
                            </p>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Manual Product Entry */}
              {form.sourceType === "MANUAL" && (
                <div className="no-print rounded-xl border border-slate-200 p-4 dark:border-slate-700">
                  <div className="mb-3 flex items-center gap-2">
                    <Package
                      size={18}
                      className="text-blue-600"
                    />

                    <h3 className="font-semibold">
                      Add Products
                    </h3>
                  </div>

                  <div className="grid gap-3 md:grid-cols-4">
                    <div className="md:col-span-2">
                      <label className={labelClass}>
                        Product
                      </label>

                      <select
                        disabled={viewOnly}
                        value={selectedProductId}
                        onChange={(event) =>
                          setSelectedProductId(
                            event.target.value
                          )
                        }
                        className={inputClass}
                      >
                        <option value="">
                          Select product
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
                    </div>

                    <div>
                      <label className={labelClass}>
                        Quantity
                      </label>

                      <input
                        type="number"
                        min="0.0001"
                        step="0.0001"
                        disabled={viewOnly}
                        value={newQuantity}
                        onChange={(event) =>
                          setNewQuantity(event.target.value)
                        }
                        className={inputClass}
                      />
                    </div>

                    <div>
                      <label className={labelClass}>
                        Unit Price
                      </label>

                      <input
                        type="number"
                        min="0"
                        step="0.0001"
                        disabled={viewOnly}
                        value={newPrice}
                        onChange={(event) =>
                          setNewPrice(event.target.value)
                        }
                        className={inputClass}
                      />
                    </div>
                  </div>

                  {!viewOnly && (
                    <button
                      type="button"
                      onClick={addManualProduct}
                      className="mt-3 inline-flex items-center gap-2 rounded-lg bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-700"
                    >
                      <Plus size={15} />
                      Add Product
                    </button>
                  )}
                </div>
              )}

              {/* Items Table */}
              <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700">
                <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3 dark:border-slate-700">
                  <h3 className="font-semibold">
                    Quotation Items
                  </h3>

                  <span className="text-xs text-slate-500">
                    {form.sourceType === "RFQ" && !editingId
                      ? selectedRfqOption
                        ? `${selectedRfqOption.quote_count} imported line(s) when saved`
                        : "Select an RFQ supplier submission"
                      : `${form.items.length} item(s)`}
                  </span>
                </div>

                {form.sourceType === "RFQ" && !editingId ? (
                  <div className="p-8 text-center text-sm text-slate-500">
                    {selectedRfqOption
                      ? "Supplier quotation lines will be imported from the selected RFQ when you save."
                      : "Select an RFQ supplier submission to import its quoted items."}
                  </div>
                ) : form.items.length === 0 ? (
                  <div className="p-8 text-center text-sm text-slate-500">
                    No items added.
                  </div>
                ) : (
                  <table className="w-full min-w-[1000px] text-left text-xs">
                    <thead className="bg-slate-50 text-slate-500 dark:bg-slate-800">
                      <tr>
                        <th className="px-3 py-3">#</th>
                        <th className="px-3 py-3">Item</th>
                        <th className="px-3 py-3">
                          Description
                        </th>
                        <th className="px-3 py-3">UOM</th>
                        <th className="px-3 py-3">Quantity</th>
                        <th className="px-3 py-3">Unit Price</th>
                        <th className="px-3 py-3">Discount</th>
                        <th className="px-3 py-3">Tax %</th>
                        <th className="px-3 py-3 text-right">
                          Line Total
                        </th>

                        {!viewOnly && (
                          <th className="px-3 py-3 text-center">
                            Action
                          </th>
                        )}
                      </tr>
                    </thead>

                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {calculatedItems.map((item, index) => (
                        <tr
                          key={`${
                            item.productId ||
                            item.purchaseQuotationItemId ||
                            "item"
                          }-${index}`}
                        >
                          <td className="px-3 py-3">
                            {index + 1}
                          </td>

                          <td className="px-3 py-3 font-medium">
                            {item.productName ||
                              item.sku ||
                              item.productId ||
                              "RFQ Item"}
                          </td>

                          <td className="px-3 py-3">
                            {item.itemDescription}
                          </td>

                          <td className="px-3 py-3">
                            {item.uom}
                          </td>

                          <td className="px-3 py-3">
                            <input
                              type="number"
                              min="0.0001"
                              step="0.0001"
                              disabled={viewOnly}
                              value={item.quantity}
                              onChange={(event) =>
                                updateItem(
                                  index,
                                  "quantity",
                                  event.target.value
                                )
                              }
                              className={`${inputClass} min-w-24`}
                            />
                          </td>

                          <td className="px-3 py-3">
                            <input
                              type="number"
                              min="0"
                              step="0.0001"
                              disabled={viewOnly}
                              value={item.unitPrice}
                              onChange={(event) =>
                                updateItem(
                                  index,
                                  "unitPrice",
                                  event.target.value
                                )
                              }
                              className={`${inputClass} min-w-28`}
                            />
                          </td>

                          <td className="px-3 py-3">
                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              disabled={viewOnly}
                              value={item.discountAmount}
                              onChange={(event) =>
                                updateItem(
                                  index,
                                  "discountAmount",
                                  event.target.value
                                )
                              }
                              className={`${inputClass} min-w-24`}
                            />
                          </td>

                          <td className="px-3 py-3">
                            <input
                              type="number"
                              min="0"
                              max="100"
                              step="0.01"
                              disabled={viewOnly}
                              value={item.taxRate}
                              onChange={(event) =>
                                updateItem(
                                  index,
                                  "taxRate",
                                  event.target.value
                                )
                              }
                              className={`${inputClass} min-w-20`}
                            />
                          </td>

                          <td className="px-3 py-3 text-right font-semibold">
                            {formatMoney(
                              item.lineTotal,
                              form.currencyCode
                            )}
                          </td>

                          {!viewOnly && (
                            <td className="px-3 py-3 text-center">
                              {form.sourceType === "MANUAL" ? (
                                <button
                                  type="button"
                                  onClick={() =>
                                    removeItem(index)
                                  }
                                  className="rounded-md p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30"
                                  title="Remove item"
                                >
                                  <Trash2 size={15} />
                                </button>
                              ) : (
                                <span className="text-slate-400">
                                  Locked
                                </span>
                              )}
                            </td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>

              {/* Terms and Summary */}
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-3">
                  <div>
                    <label className={labelClass}>
                      Terms and Conditions
                    </label>

                    <textarea
                      rows={3}
                      disabled={viewOnly}
                      value={form.termsConditions}
                      onChange={(event) =>
                        updateForm(
                          "termsConditions",
                          event.target.value
                        )
                      }
                      className={inputClass}
                      placeholder="Enter payment, delivery, warranty, and other terms..."
                    />
                  </div>

                  <div>
                    <label className={labelClass}>
                      Remarks
                    </label>

                    <textarea
                      rows={2}
                      disabled={viewOnly}
                      value={form.remarks}
                      onChange={(event) =>
                        updateForm(
                          "remarks",
                          event.target.value
                        )
                      }
                      className={inputClass}
                      placeholder="Additional notes..."
                    />
                  </div>
                </div>

                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800/50">
                  <h3 className="mb-3 font-semibold">
                    Quotation Summary
                  </h3>

                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between gap-3">
                      <span className="text-slate-500">
                        Subtotal
                      </span>

                      <span>
                        {formatMoney(
                          subtotal,
                          form.currencyCode
                        )}
                      </span>
                    </div>

                    <div className="flex justify-between gap-3">
                      <span className="text-slate-500">
                        Discount
                      </span>

                      <span>
                        {formatMoney(
                          discountTotal,
                          form.currencyCode
                        )}
                      </span>
                    </div>

                    <div className="flex justify-between gap-3">
                      <span className="text-slate-500">
                        Tax
                      </span>

                      <span>
                        {formatMoney(
                          taxTotal,
                          form.currencyCode
                        )}
                      </span>
                    </div>

                    <div className="border-t border-slate-200 pt-3 dark:border-slate-700">
                      <div className="flex justify-between gap-3 text-base font-bold">
                        <span>Grand Total</span>

                        <span className="text-blue-600 dark:text-blue-400">
                          {formatMoney(
                            grandTotal,
                            form.currencyCode
                          )}
                        </span>
                      </div>
                    </div>
                  </div>

                  <p className="mt-3 text-[11px] text-slate-500">
                    Exchange rate: {form.exchangeRate || "1"}
                  </p>
                </div>
              </div>

              {/* Supplier Information */}
              {selectedSupplier && (
                <div className="rounded-lg border border-slate-200 p-3 text-xs dark:border-slate-700">
                  <div className="flex items-center gap-2">
                    <Building2
                      size={16}
                      className="text-blue-500"
                    />

                    <p className="font-semibold">
                      {selectedSupplier.supplier_name}
                    </p>
                  </div>

                  <p className="mt-1 text-slate-500">
                    {selectedSupplier.phone || ""}
                    {selectedSupplier.email
                      ? ` · ${selectedSupplier.email}`
                      : ""}
                  </p>

                  {selectedSupplier.address && (
                    <p className="mt-1 text-slate-500">
                      {selectedSupplier.address}
                    </p>
                  )}
                </div>
              )}

              {/* Actions */}
              <div className="no-print flex flex-wrap justify-end gap-2 border-t border-slate-200 pt-4 dark:border-slate-700">
                <button
                  type="button"
                  onClick={closeForm}
                  disabled={saving}
                  className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800"
                >
                  Close
                </button>

                {!viewOnly && (
                  <button
                    type="submit"
                    disabled={saving}
                    className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-5 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {saving ? (
                      <RefreshCw
                        size={16}
                        className="animate-spin"
                      />
                    ) : (
                      <Save size={16} />
                    )}

                    {saving
                      ? "Saving..."
                      : editingId
                        ? "Update Quotation"
                        : "Save Quotation"}
                  </button>
                )}
              </div>

              {/* Print Heading */}
              <div className="hidden print:block">
                <h2 className="text-center text-xl font-bold">
                  PURCHASE QUOTATION
                </h2>

                <p className="mt-2 text-center text-sm">
                  {selectedSupplier?.supplier_name || ""}
                </p>

                <p className="mt-1 text-center text-xs">
                  Date: {formatDate(form.quotationDate)}
                </p>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}