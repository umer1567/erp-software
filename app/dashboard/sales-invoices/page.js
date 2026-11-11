"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

const inputClass =
  "w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:placeholder:text-slate-400 dark:focus:border-blue-400 dark:focus:ring-blue-400/10";

const labelClass =
  "mb-1.5 block text-sm font-semibold text-slate-700 dark:text-slate-200";

const primaryButton =
  "inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50";

const secondaryButton =
  "inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700";

// Column picker definitions
const INVOICE_COLUMNS = [
  { key: "invoice", label: "Invoice" },
  { key: "challan", label: "Delivery Challan" },
  { key: "customer", label: "Customer" },
  { key: "warehouse", label: "Warehouse" },
  { key: "date", label: "Date" },
  { key: "total", label: "Total" },
  { key: "paid", label: "Paid" },
  { key: "balance", label: "Balance" },
  { key: "status", label: "Status" },
  { key: "accounting", label: "Accounting" },
  { key: "actions", label: "Actions" },
];

const ITEM_COLUMNS = [
  { key: "product", label: "Product" },
  { key: "quantity", label: "Quantity" },
  { key: "unitPrice", label: "Unit Price" },
  { key: "discount", label: "Discount" },
  { key: "tax", label: "Tax" },
  { key: "lineTotal", label: "Line Total" },
  { key: "action", label: "Action" },
];

function formatMoney(value) {
  return Number(value || 0).toLocaleString("en-PK", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function formatDate(value) {
  if (!value) return "-";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return value;

  return date.toLocaleDateString("en-GB");
}

/* =========================================================
   COLUMN VISIBILITY HOOK
   (localStorage via useSyncExternalStore: no effects, no
   setState-in-effect, no hydration mismatch)
========================================================= */

const columnListeners = new Set();

function subscribeColumnPrefs(callback) {
  columnListeners.add(callback);
  window.addEventListener("storage", callback);

  return () => {
    columnListeners.delete(callback);
    window.removeEventListener("storage", callback);
  };
}

function readColumnPrefs(storageKey) {
  try {
    return localStorage.getItem(storageKey) ?? "";
  } catch {
    return "";
  }
}

function writeColumnPrefs(storageKey, value) {
  try {
    localStorage.setItem(storageKey, value);
  } catch (error) {
    console.error("Unable to save column preferences:", error);
  }

  // Notify every hook instance in this tab
  columnListeners.forEach((listener) => listener());
}

function useColumnVisibility(storageKey, columns) {
  const defaults = useMemo(
    () => Object.fromEntries(columns.map((c) => [c.key, true])),
    [columns]
  );

  // Server snapshot is "" so the first render matches the server.
  const raw = useSyncExternalStore(
    subscribeColumnPrefs,
    () => readColumnPrefs(storageKey),
    () => ""
  );

  const visible = useMemo(() => {
    if (!raw) return defaults;

    try {
      const parsed = JSON.parse(raw);

      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        return { ...defaults, ...parsed };
      }
    } catch {
      // ignore corrupted data and fall back to defaults
    }

    return defaults;
  }, [raw, defaults]);

  const toggle = (key) => {
    const next = { ...visible, [key]: !visible[key] };

    // Always keep at least one column visible
    if (!Object.values(next).some(Boolean)) return;

    writeColumnPrefs(storageKey, JSON.stringify(next));
  };

  const showAll = () => {
    writeColumnPrefs(storageKey, JSON.stringify(defaults));
  };

  const count = columns.filter((c) => visible[c.key]).length;

  return { visible, toggle, showAll, count };
}

/* =========================================================
   UI COMPONENTS
========================================================= */

function ColumnToggle({ columns, state }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;

    const onClick = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    const onKey = (e) => e.key === "Escape" && setOpen(false);

    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);

    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-600 transition hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
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
        <span className="rounded-md bg-slate-100 px-1.5 py-0.5 text-[10px] font-bold text-slate-600 dark:bg-slate-700 dark:text-slate-200">
          {state.count}/{columns.length}
        </span>
        <svg
          viewBox="0 0 24 24"
          className={`h-3.5 w-3.5 transition ${open ? "rotate-180" : ""}`}
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
        <div className="absolute right-0 z-30 mt-2 w-60 rounded-2xl border border-slate-200 bg-white p-2 shadow-xl dark:border-slate-700 dark:bg-slate-900">
          <div className="flex items-center justify-between px-2 pb-2 pt-1">
            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Show columns
            </p>

            <button
              type="button"
              onClick={state.showAll}
              className="text-xs font-semibold text-blue-600 hover:text-blue-800 dark:text-blue-300 dark:hover:text-blue-200"
            >
              Show all
            </button>
          </div>

          <div className="max-h-72 overflow-y-auto">
            {columns.map((col) => (
              <label
                key={col.key}
                className="flex cursor-pointer items-center gap-3 rounded-lg px-2.5 py-2 text-sm text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                <input
                  type="checkbox"
                  checked={state.visible[col.key]}
                  onChange={() => state.toggle(col.key)}
                  className="h-4 w-4 rounded border-slate-300 accent-blue-600"
                />
                {col.label}
              </label>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function StatusBadge({ status }) {
  const normalized = String(status || "").toLowerCase();

  let colors =
    "bg-slate-100 text-slate-700 ring-slate-600/20 dark:bg-slate-700 dark:text-slate-200 dark:ring-slate-500/30";

  if (normalized.includes("paid") || normalized.includes("complete")) {
    colors =
      "bg-emerald-50 text-emerald-700 ring-emerald-600/20 dark:bg-emerald-950/60 dark:text-emerald-300 dark:ring-emerald-500/30";
  } else if (
    normalized.includes("partial") ||
    normalized.includes("pending")
  ) {
    colors =
      "bg-amber-50 text-amber-700 ring-amber-600/20 dark:bg-amber-950/60 dark:text-amber-300 dark:ring-amber-500/30";
  } else if (
    normalized.includes("overdue") ||
    normalized.includes("cancel")
  ) {
    colors =
      "bg-red-50 text-red-700 ring-red-600/20 dark:bg-red-950/60 dark:text-red-300 dark:ring-red-500/30";
  }

  return (
    <span
      className={`inline-flex items-center whitespace-nowrap rounded-full px-3 py-1 text-xs font-bold ring-1 ring-inset ${colors}`}
    >
      <span className="mr-1.5 h-1.5 w-1.5 rounded-full bg-current" />
      {status || "Unknown"}
    </span>
  );
}

function Modal({ children, onClose, wide = false }) {
  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/65 p-3 backdrop-blur-sm sm:p-6"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        className={`max-h-[94vh] w-full ${wide ? "max-w-6xl" : "max-w-xl"
          } overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-900`}
      >
        {children}
      </div>
    </div>
  );
}

function ModalHeader({ title, subtitle, onClose }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-slate-100 bg-white px-5 py-4 dark:border-slate-700 dark:bg-slate-900 sm:px-7">
      <div>
        <h2 className="text-lg font-extrabold tracking-tight text-slate-900 dark:text-white">
          {title}
        </h2>

        {subtitle && (
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            {subtitle}
          </p>
        )}
      </div>

      <button
        type="button"
        onClick={onClose}
        aria-label="Close dialog"
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-xl text-slate-500 transition hover:bg-slate-200 hover:text-slate-900 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700 dark:hover:text-white"
      >
        ×
      </button>
    </div>
  );
}

/* =========================================================
   PAGE
========================================================= */

export default function SalesInvoicesPage() {
  const [invoices, setInvoices] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [products, setProducts] = useState([]);
  const [deliveryChallans, setDeliveryChallans] = useState([]);
  const [deliveryChallanId, setDeliveryChallanId] = useState("");
  const [loadingChallan, setLoadingChallan] = useState(false);

  // Quick-add item bar
  const [quick, setQuick] = useState({
    search: "",
    quantity: 1,
    unitPrice: 0,
    discount: 0,
    tax: 0,
  });
  const [quickError, setQuickError] = useState("");
  const quickInputRef = useRef(null);

  const [loading, setLoading] = useState(true);

  const [permissionLoading, setPermissionLoading] = useState(true);

  const [permissions, setPermissions] = useState({
    can_view: false,
    can_create: false,
    can_update: false,
    can_delete: false,
  });
  const [showInvoiceForm, setShowInvoiceForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const [customerId, setCustomerId] = useState("");
  const [warehouseId, setWarehouseId] = useState("");
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [invoiceDate, setInvoiceDate] = useState(
    new Date().toISOString().split("T")[0]
  );

  const [discount, setDiscount] = useState(0);
  const [tax, setTax] = useState(0);
  const [notes, setNotes] = useState("");
  const [items, setItems] = useState([]);
  const [editingInvoiceId, setEditingInvoiceId] = useState(null);

  const [selectedInvoice, setSelectedInvoice] = useState(null);
  const [invoiceLoading, setInvoiceLoading] = useState(false);

  const [accountingInvoice, setAccountingInvoice] = useState(null);
  const [accountingLines, setAccountingLines] = useState([]);
  const [accountingLoading, setAccountingLoading] = useState(false);
  const [accountingError, setAccountingError] = useState("");

  // Column visibility (must stay above the early returns below)
  const invoiceCols = useColumnVisibility(
    "sales-invoices.columns",
    INVOICE_COLUMNS
  );
  const itemCols = useColumnVisibility(
    "sales-invoice-items.columns",
    ITEM_COLUMNS
  );

  useEffect(() => {
    let cancelled = false;

    async function loadPermissions() {
      try {
        setPermissionLoading(true);

        const response = await fetch(
          "/api/permissions/current?permissionKey=sales_invoices",
          { cache: "no-store" }
        );

        const data = await response.json();

        if (!response.ok || data.success === false) {
          throw new Error(data.message || "Failed to load permissions.");
        }

        const permission = data.permission || data.permissions || data;

        if (!cancelled) {
          setPermissions({
            can_view:
              permission.can_view === true || permission.can_view === "true",

            can_create:
              permission.can_create === true ||
              permission.can_create === "true",

            can_update:
              permission.can_update === true ||
              permission.can_update === "true",

            can_delete:
              permission.can_delete === true ||
              permission.can_delete === "true",
          });
        }
      } catch (error) {
        console.error("Sales Invoices permissions:", error);

        if (!cancelled) {
          setPermissions({
            can_view: false,
            can_create: false,
            can_update: false,
            can_delete: false,
          });
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
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadData() {
      setLoading(true);
      setError("");

      try {
        const [
          invoiceRes,
          customerRes,
          warehouseRes,
          productRes,
          challanRes,
        ] = await Promise.all([
          fetch("/api/sales-invoices", { cache: "no-store" }),
          fetch("/api/customers", { cache: "no-store" }),
          fetch("/api/warehouses", { cache: "no-store" }),
          fetch("/api/products", { cache: "no-store" }),
          fetch("/api/delivery-challans", { cache: "no-store" }),
        ]);

        const [
          invoiceData,
          customerData,
          warehouseData,
          productData,
          challanData,
        ] = await Promise.all([
          invoiceRes.json(),
          customerRes.json(),
          warehouseRes.json(),
          productRes.json(),
          challanRes.json().catch(() => ({})),
        ]);

        if (!invoiceRes.ok) {
          throw new Error(invoiceData.message || "Failed to load invoices.");
        }

        if (!customerRes.ok) {
          throw new Error(
            customerData.message || "Failed to load customers."
          );
        }

        if (!warehouseRes.ok) {
          throw new Error(
            warehouseData.message || "Failed to load warehouses."
          );
        }

        if (!productRes.ok) {
          throw new Error(productData.message || "Failed to load products.");
        }

        if (!cancelled) {
          setInvoices(invoiceData.invoices || []);
          setCustomers(customerData.customers || []);
          setWarehouses(warehouseData.warehouses || []);
          setProducts(productData.products || []);
          setDeliveryChallans(challanData.challans || []);
        }
      } catch (err) {
        if (!cancelled) {
          console.error(err);
          setError(err.message || "Failed to load page data.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadData();

    return () => {
      cancelled = true;
    };
  }, []);

  const accountingJournals = Object.values(
    accountingLines.reduce((groups, line) => {
      const key = String(line.journal_id);

      if (!groups[key]) {
        groups[key] = {
          journal_id: line.journal_id,
          journal_number: line.journal_number,
          journal_date: line.journal_date,
          reference_type: line.reference_type,
          journal_description: line.journal_description,
          lines: [],
          debit: 0,
          credit: 0,
        };
      }

      groups[key].lines.push(line);
      groups[key].debit += Number(line.debit || 0);
      groups[key].credit += Number(line.credit || 0);

      return groups;
    }, {})
  );

  const accountingTotalDebit = accountingLines.reduce(
    (sum, line) => sum + Number(line.debit || 0),
    0
  );

  const accountingTotalCredit = accountingLines.reduce(
    (sum, line) => sum + Number(line.credit || 0),
    0
  );

  const subtotal = items.reduce((sum, item) => {
    return sum + calculateLineTotal(item);
  }, 0);

  const total = subtotal - (Number(discount) || 0) + (Number(tax) || 0);

  async function openAccountingLines(invoice) {
    setAccountingInvoice(invoice);
    setAccountingLines([]);
    setAccountingError("");
    setAccountingLoading(true);

    try {
      const response = await fetch(
        `/api/sales-invoices/${invoice.invoice_id}/accounting`,
        { cache: "no-store" }
      );

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.message || "Failed to load accounting lines.");
      }

      setAccountingLines(data.lines || []);
    } catch (err) {
      console.error(err);
      setAccountingError(err.message || "Failed to load accounting lines.");
    } finally {
      setAccountingLoading(false);
    }
  }

  function removeItem(index) {
    setItems((current) =>
      current.filter((_, itemIndex) => itemIndex !== index)
    );
  }

  function updateItem(index, field, value) {
    setItems((current) => {
      const updated = current.map((item) => ({ ...item }));
      updated[index][field] = value;

      if (field === "productId") {
        const product = products.find(
          (entry) => String(entry.product_id) === String(value)
        );

        if (product) {
          updated[index].unitPrice = Number(product.sale_price) || 0;
        }
      }

      return updated;
    });
  }

  /* -------------------------------------------------------
     QUICK ADD ITEM
  ------------------------------------------------------- */

  function findProductByInput(text, exactOnly = false) {
    const query = String(text || "").trim().toLowerCase();
    if (!query) return null;

    const activeProducts = products.filter((product) => product.is_active);

    // Exact match on "SKU - Name", SKU, barcode or name
    const exact = activeProducts.find((product) =>
      [
        `${product.sku} - ${product.product_name}`,
        product.sku,
        product.barcode,
        product.product_name,
      ].some((value) => String(value || "").toLowerCase() === query)
    );

    if (exact || exactOnly) return exact || null;

    // Otherwise accept a partial match only if exactly one product matches
    const matches = activeProducts.filter((product) =>
      [product.sku, product.barcode, product.product_name].some((value) =>
        String(value || "").toLowerCase().includes(query)
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
        next.unitPrice = Number(product.sale_price) || 0;
      }

      return next;
    });
  }

  function addQuickItem() {
    setQuickError("");

    if (!quick.search.trim()) {
      setQuickError("Enter or select a product first.");
      return;
    }

    const product = findProductByInput(quick.search);

    if (!product) {
      setQuickError(
        "No single matching product found. Pick one from the suggestions."
      );
      return;
    }

    const quantity = Number(quick.quantity);
    const unitPrice = Number(quick.unitPrice);
    const itemDiscount = Number(quick.discount) || 0;
    const itemTax = Number(quick.tax) || 0;

    if (!Number.isFinite(quantity) || quantity <= 0) {
      setQuickError("Quantity must be greater than zero.");
      return;
    }

    if (!Number.isFinite(unitPrice) || unitPrice < 0) {
      setQuickError("Unit price cannot be negative.");
      return;
    }

    if (itemDiscount < 0 || itemTax < 0) {
      setQuickError("Discount and tax cannot be negative.");
      return;
    }

    if (itemDiscount > quantity * unitPrice) {
      setQuickError("Discount cannot be greater than the line amount.");
      return;
    }

    setItems((current) => [
      ...current,
      {
        productId: String(product.product_id),
        quantity,
        unitPrice,
        discount: itemDiscount,
        tax: itemTax,
      },
    ]);

    setQuick({ search: "", quantity: 1, unitPrice: 0, discount: 0, tax: 0 });
    quickInputRef.current?.focus();
  }

  function handleQuickKeyDown(event) {
    if (event.key === "Enter") {
      event.preventDefault(); // stop Enter from submitting the invoice form
      addQuickItem();
    }
  }

  function calculateLineTotal(item) {
    const quantity = Number(item.quantity) || 0;
    const unitPrice = Number(item.unitPrice) || 0;
    const itemDiscount = Number(item.discount) || 0;
    const itemTax = Number(item.tax) || 0;

    return quantity * unitPrice - itemDiscount + itemTax;
  }

  function resetForm() {
    setEditingInvoiceId(null);
    setDeliveryChallanId("");
    setInvoiceNumber("");
    setCustomerId("");
    setWarehouseId("");
    setInvoiceDate(new Date().toISOString().split("T")[0]);
    setDiscount(0);
    setTax(0);
    setNotes("");
    setItems([]);
    setQuick({ search: "", quantity: 1, unitPrice: 0, discount: 0, tax: 0 });
setQuickError("");
    setShowInvoiceForm(false);
  }

  async function openInvoice(invoiceId) {
    try {
      setInvoiceLoading(true);
      setError("");

      const response = await fetch(`/api/sales-invoices/${invoiceId}`, {
        cache: "no-store",
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Failed to load invoice.");
      }

      const invoiceFromRegister = invoices.find(
        (entry) => String(entry.invoice_id) === String(invoiceId)
      );

      setSelectedInvoice({
        invoice: {
          ...data.invoice,
          delivery_challan_number:
            data.invoice?.delivery_challan_number ||
            invoiceFromRegister?.delivery_challan_number ||
            null,
        },
        items: data.items || [],
      });
    } catch (err) {
      console.error(err);
      setError(err.message || "Failed to load invoice.");
    } finally {
      setInvoiceLoading(false);
    }
  }

  async function editInvoice(invoiceId) {
    if (!permissions.can_update) {
      setError("You do not have permission to edit sales invoices.");
      return;
    }
    try {
      setInvoiceLoading(true);
      setError("");

      const response = await fetch(`/api/sales-invoices/${invoiceId}`, {
        cache: "no-store",
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Failed to load invoice.");
      }

      const invoice = data.invoice;
      const invoiceItems = data.items || [];

      setEditingInvoiceId(invoice.invoice_id);
      setDeliveryChallanId(
        invoice.delivery_challan_id ? String(invoice.delivery_challan_id) : ""
      );
      setInvoiceNumber(invoice.invoice_number || "");
      setCustomerId(String(invoice.customer_id || ""));
      setWarehouseId(String(invoice.warehouse_id || ""));

      setInvoiceDate(
        invoice.invoice_date
          ? String(invoice.invoice_date).slice(0, 10)
          : new Date().toISOString().split("T")[0]
      );

      setDiscount(Number(invoice.discount) || 0);
      setTax(Number(invoice.tax) || 0);
      setNotes(invoice.notes || "");

      setItems(
        invoiceItems.map((item) => ({
          productId: String(item.product_id),
          quantity: Number(item.quantity) || 1,
          unitPrice: Number(item.unit_price) || 0,
          discount: Number(item.discount) || 0,
          tax: Number(item.tax) || 0,
        }))
      );

      setSelectedInvoice(null);
      setShowInvoiceForm(true);

      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (err) {
      console.error(err);
      setError(err.message || "Failed to edit invoice.");
    } finally {
      setInvoiceLoading(false);
    }
  }

  async function loadDeliveryChallan(challanId) {
    setDeliveryChallanId(challanId);
    if (!challanId) return;

    setLoadingChallan(true);
    setError("");

    try {
      const response = await fetch(`/api/delivery-challans/${challanId}`, {
        cache: "no-store",
      });
      const data = await response.json();

      if (!response.ok || data.success === false) {
        throw new Error(data.message || "Failed to load Delivery Challan.");
      }

      const challan = data.challan || data.deliveryChallan || data;
      const challanItems = data.items || challan.items || [];
      const status = String(challan.status || "").trim().toUpperCase();
      const documentStatus = String(challan.document_status || "")
        .trim()
        .toUpperCase();

      if (status !== "APPROVED") {
        throw new Error(
          "Only approved Delivery Challans can be converted to invoices."
        );
      }
      if (documentStatus === "INVOICED") {
        throw new Error("This Delivery Challan has already been invoiced.");
      }

      setCustomerId(String(challan.customer_id || ""));
      setWarehouseId(String(challan.warehouse_id || ""));
      setInvoiceDate(
        challan.transaction_date
          ? String(challan.transaction_date).slice(0, 10)
          : new Date().toISOString().split("T")[0]
      );
      setNotes(
        challan.memo || challan.notes
          ? `Converted from Delivery Challan ${challan.transaction_number || ""}. ${challan.memo || challan.notes || ""}`.trim()
          : `Converted from Delivery Challan ${challan.transaction_number || ""}.`
      );
      setItems(
        challanItems.map((item) => ({
          productId: String(item.product_id ?? item.productId ?? ""),
          subProductId: item.sub_product_id ?? item.subProductId ?? null,
          quantity: Number(item.quantity) || 1,
          unitPrice:
            Number(item.unit_price ?? item.unitPrice ?? item.rate ?? 0) || 0,
          discount: Number(item.discount) || 0,
          tax: Number(item.tax ?? item.tax_amount ?? 0) || 0,
        }))
      );
    } catch (err) {
      console.error(err);
      setDeliveryChallanId("");
      setError(err.message || "Failed to load Delivery Challan.");
    } finally {
      setLoadingChallan(false);
    }
  }

  const availableDeliveryChallans = deliveryChallans.filter((challan) => {
    const status = String(challan.status || "").trim().toUpperCase();
    const documentStatus = String(challan.document_status || "")
      .trim()
      .toUpperCase();
    const alreadyInvoiced = invoices.some(
      (invoice) =>
        String(invoice.delivery_challan_id || "") ===
        String(challan.delivery_challan_id || "")
    );

    return (
      status === "APPROVED" &&
      documentStatus !== "INVOICED" &&
      !alreadyInvoiced
    );
  });

  function startManualInvoice() {
    if (!permissions.can_create) {
      setError("You do not have permission to create sales invoices.");
      return;
    }

    resetForm();
    setError("");
    setSuccessMessage("");
    setShowInvoiceForm(true);
  }

  function startInvoiceFromDeliveryChallan() {
    if (!permissions.can_create) {
      setError("You do not have permission to create sales invoices.");
      return;
    }

    resetForm();
    setError("");
    setSuccessMessage("");
    setShowInvoiceForm(true);
  }

  async function saveInvoice(event) {
    event.preventDefault();

    if (editingInvoiceId && !permissions.can_update) {
      setError("You do not have permission to edit sales invoices.");
      return;
    }

    if (!editingInvoiceId && !permissions.can_create) {
      setError("You do not have permission to create sales invoices.");
      return;
    }

    setError("");
    setSuccessMessage("");

    if (!customerId) {
      setError("Please select a customer.");
      return;
    }

    if (!warehouseId) {
      setError("Please select a warehouse.");
      return;
    }

    if (!items.length) {
      setError("Please add at least one product.");
      return;
    }

    for (const item of items) {
      if (!item.productId) {
        setError("Please select a product for every item.");
        return;
      }

      if (
        !Number.isFinite(Number(item.quantity)) ||
        Number(item.quantity) <= 0
      ) {
        setError("Quantity must be greater than zero.");
        return;
      }
    }

    setSaving(true);

    try {
      const isEditing = Boolean(editingInvoiceId);

      const url = isEditing
        ? `/api/sales-invoices/${editingInvoiceId}`
        : "/api/sales-invoices";

      const method = isEditing ? "PUT" : "POST";

      const payload = {
        invoiceNumber: invoiceNumber.trim(),
        customerId: Number(customerId),
        warehouseId: Number(warehouseId),
        invoiceDate,
        deliveryChallanId: deliveryChallanId ? Number(deliveryChallanId) : null,
        discount: Number(discount) || 0,
        tax: Number(tax) || 0,
        notes,
        items: items.map((item) => ({
          productId: Number(item.productId),
          subProductId: item.subProductId ? Number(item.subProductId) : null,
          quantity: Number(item.quantity),
          unitPrice: Number(item.unitPrice) || 0,
          discount: Number(item.discount) || 0,
          tax: Number(item.tax) || 0,
        })),
      };

      const response = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        cache: "no-store",
        body: JSON.stringify(payload),
      });

      const responseText = await response.text();
      let data;

      try {
        data = responseText ? JSON.parse(responseText) : {};
      } catch {
        throw new Error(
          `The server returned an invalid response (HTTP ${response.status}). Check the Next.js terminal for errors.`
        );
      }

      if (!response.ok || data.success === false) {
        throw new Error(
          data.message ||
          `Failed to ${isEditing ? "update" : "create"} invoice (HTTP ${response.status}).`
        );
      }

      resetForm();

      const [invoiceResponse, challanResponse] = await Promise.all([
        fetch("/api/sales-invoices", {
          cache: "no-store",
          headers: { Accept: "application/json" },
        }),
        fetch("/api/delivery-challans", { cache: "no-store" }),
      ]);

      const [invoiceText, challanText] = await Promise.all([
        invoiceResponse.text(),
        challanResponse.text(),
      ]);

      let invoiceData;
      let challanData;

      try {
        invoiceData = invoiceText ? JSON.parse(invoiceText) : {};
      } catch {
        throw new Error(
          "Invoice saved, but the refreshed invoice list returned invalid JSON."
        );
      }

      try {
        challanData = challanText ? JSON.parse(challanText) : {};
      } catch {
        challanData = {};
      }

      if (!invoiceResponse.ok) {
        throw new Error(
          invoiceData.message ||
          "Invoice saved, but the invoice list could not be refreshed."
        );
      }

      setInvoices(invoiceData.invoices || []);
      setDeliveryChallans(challanData.challans || []);
      setSuccessMessage(
        isEditing
          ? "Sales invoice updated successfully."
          : deliveryChallanId
            ? "Delivery Challan converted to Sales Invoice successfully."
            : "Sales invoice created successfully."
      );
    } catch (err) {
      console.error("SAVE INVOICE ERROR:", err);
      setError(err.message || "Failed to save invoice.");
    } finally {
      setSaving(false);
    }
  }

  function downloadInvoicePDF() {
    if (!selectedInvoice) return;

    const invoice = selectedInvoice.invoice;
    const invoiceItems = selectedInvoice.items || [];
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();

    doc.setFontSize(20);
    doc.setFont("helvetica", "bold");
    doc.text("GOLDENLAKE", 14, 20);

    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text("Sales Invoice", 14, 27);
    doc.text(`Invoice #: ${invoice.invoice_number}`, pageWidth - 70, 18);
    doc.text(`Date: ${formatDate(invoice.invoice_date)}`, pageWidth - 70, 25);
    doc.text(`Status: ${invoice.status || "-"}`, pageWidth - 70, 32);
    doc.line(14, 36, pageWidth - 14, 36);

    doc.setFont("helvetica", "bold");
    doc.text("Bill To:", 14, 47);
    doc.setFont("helvetica", "normal");
    doc.text(invoice.customer_name || "-", 14, 54);

    if (invoice.customer_code) {
      doc.text(`Code: ${invoice.customer_code}`, 14, 61);
    }

    if (invoice.customer_phone) {
      doc.text(`Phone: ${invoice.customer_phone}`, 14, 68);
    }

    if (invoice.customer_email) {
      doc.text(`Email: ${invoice.customer_email}`, 14, 75);
    }

    doc.setFont("helvetica", "bold");
    doc.text("Warehouse:", pageWidth / 2, 47);
    doc.setFont("helvetica", "normal");
    doc.text(invoice.warehouse_name || "-", pageWidth / 2, 54);

    if (invoice.warehouse_code) {
      doc.text(`Code: ${invoice.warehouse_code}`, pageWidth / 2, 61);
    }

    const tableRows = invoiceItems.map((item, index) => [
      index + 1,
      `${item.sku || ""} - ${item.product_name || ""}`,
      item.quantity,
      item.unit || "",
      Number(item.unit_price || 0).toFixed(2),
      Number(item.discount || 0).toFixed(2),
      Number(item.tax || 0).toFixed(2),
      Number(item.line_total || 0).toFixed(2),
    ]);

    autoTable(doc, {
      startY: 85,
      head: [["#", "Product", "Qty", "Unit", "Price", "Discount", "Tax", "Total"]],
      body: tableRows,
      theme: "grid",
      styles: {
        fontSize: 8,
        cellPadding: 3,
      },
      headStyles: {
        fontStyle: "bold",
      },
      columnStyles: {
        0: { cellWidth: 10 },
        2: { halign: "right" },
        4: { halign: "right" },
        5: { halign: "right" },
        6: { halign: "right" },
        7: { halign: "right" },
      },
    });

    let finalY = doc.lastAutoTable.finalY + 10;
    const totalsX = pageWidth - 75;

    doc.setFont("helvetica", "normal");
    doc.text("Subtotal:", totalsX, finalY);
    doc.text(formatMoney(invoice.subtotal), pageWidth - 14, finalY, {
      align: "right",
    });

    finalY += 7;
    doc.text("Discount:", totalsX, finalY);
    doc.text(`-${formatMoney(invoice.discount)}`, pageWidth - 14, finalY, {
      align: "right",
    });

    finalY += 7;
    doc.text("Tax:", totalsX, finalY);
    doc.text(`+${formatMoney(invoice.tax)}`, pageWidth - 14, finalY, {
      align: "right",
    });

    finalY += 8;
    doc.line(totalsX, finalY, pageWidth - 14, finalY);
    finalY += 8;

    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.text("TOTAL:", totalsX, finalY);
    doc.text(formatMoney(invoice.total_amount), pageWidth - 14, finalY, {
      align: "right",
    });

    finalY += 10;
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text(`Paid: ${formatMoney(invoice.paid_amount)}`, totalsX, finalY);

    finalY += 7;
    doc.text(`Balance: ${formatMoney(invoice.balance_amount)}`, totalsX, finalY);

    if (invoice.notes) {
      finalY += 15;
      doc.setFont("helvetica", "bold");
      doc.text("Notes:", 14, finalY);

      finalY += 6;
      doc.setFont("helvetica", "normal");

      const noteLines = doc.splitTextToSize(invoice.notes, pageWidth - 28);

      doc.text(noteLines, 14, finalY);
    }

    const pageHeight = doc.internal.pageSize.getHeight();

    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    doc.text("Thank you for your business.", pageWidth / 2, pageHeight - 15, {
      align: "center",
    });

    doc.save(`Invoice-${invoice.invoice_number}.pdf`);
  }

  function printInvoice() {
    window.print();
  }

  const totalOutstanding = invoices.reduce(
    (sum, invoice) => sum + Number(invoice.balance_amount || 0),
    0
  );

  const totalInvoiced = invoices.reduce(
    (sum, invoice) => sum + Number(invoice.total_amount || 0),
    0
  );

  const totalPaid = invoices.reduce(
    (sum, invoice) => sum + Number(invoice.paid_amount || 0),
    0
  );

  // Wait until permissions have loaded.
  if (permissionLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 p-6 dark:bg-slate-950">
        <div className="rounded-2xl border border-slate-200 bg-white px-6 py-5 text-sm font-semibold text-slate-700 shadow-sm dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200">
          Checking permissions...
        </div>
      </div>
    );
  }

  // Block the entire Sales Invoices page without View permission.
  if (!permissions.can_view) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 p-6 dark:bg-slate-950">
        <div className="w-full max-w-lg rounded-3xl border border-red-200 bg-white p-8 text-center shadow-xl dark:border-red-900/60 dark:bg-slate-900">
          <div className="text-5xl">🔒</div>

          <h1 className="mt-5 text-2xl font-black text-slate-900 dark:text-white">
            Access Denied
          </h1>

          <p className="mt-3 text-sm leading-6 text-slate-600 dark:text-slate-300">
            You do not have permission to view Sales Invoices. Please contact
            your administrator if you need access.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="sales-invoices-page min-h-screen space-y-6 bg-slate-50/70 p-4 text-slate-800 dark:bg-slate-950 dark:text-slate-100 sm:p-6 lg:p-8">
      <style jsx global>{`
        .sales-invoices-page {
          background:
            radial-gradient(
              circle at 0% 0%,
              rgba(219, 234, 254, 0.6),
              transparent 28rem
            ),
            #f8fafc;
        }

        html[data-theme="dark"] .sales-invoices-page {
          background:
            radial-gradient(
              circle at 0% 0%,
              rgba(30, 64, 175, 0.14),
              transparent 28rem
            ),
            #020617;
          color: #e2e8f0;
          color-scheme: dark;
        }

        .sales-invoices-page * {
          box-sizing: border-box;
        }

        .sales-invoices-page button {
          transition:
            background-color 160ms ease,
            box-shadow 160ms ease,
            transform 160ms ease;
        }

        .sales-invoices-page button:not(:disabled):active {
          transform: translateY(1px);
        }

        .sales-invoices-page input,
        .sales-invoices-page select,
        .sales-invoices-page textarea {
          color: #1e293b;
          background-color: #fff;
        }

        html[data-theme="dark"] .sales-invoices-page input,
        html[data-theme="dark"] .sales-invoices-page select,
        html[data-theme="dark"] .sales-invoices-page textarea {
          color: #f1f5f9;
          background-color: #1e293b;
          border-color: #475569;
          color-scheme: dark;
        }

        html[data-theme="dark"] .sales-invoices-page input::placeholder,
        html[data-theme="dark"] .sales-invoices-page textarea::placeholder {
          color: #94a3b8;
        }

        .sales-invoices-page input:focus,
        .sales-invoices-page select:focus,
        .sales-invoices-page textarea:focus {
          outline: none;
          border-color: #3b82f6;
          box-shadow: 0 0 0 4px rgba(59, 130, 246, 0.1);
        }

        .sales-invoices-page table {
          border-collapse: separate;
          border-spacing: 0;
        }

        .sales-invoices-page th {
          white-space: nowrap;
        }

        .sales-invoices-page tbody tr {
          transition: background-color 150ms ease;
        }

        .sales-invoices-page tbody tr:hover {
          background-color: #f8fafc;
        }

        html[data-theme="dark"] .sales-invoices-page tbody tr:hover {
          background-color: #1e293b;
        }

        #invoice-preview {
          background: #fff;
          color: #0f172a;
          color-scheme: light;
        }

        #invoice-preview input,
        #invoice-preview select,
        #invoice-preview textarea {
          color: #0f172a;
          background: #fff;
        }

        @media print {
          @page {
            size: auto;
            margin: 12mm;
          }

          body * {
            visibility: hidden !important;
          }

          #invoice-preview,
          #invoice-preview * {
            visibility: visible !important;
          }

          #invoice-preview {
            position: absolute;
            inset: 0 auto auto 0;
            width: 100%;
            max-height: none !important;
            overflow: visible !important;
            padding: 0 !important;
            background: #fff !important;
            color: #0f172a !important;
            box-shadow: none !important;
          }

          #invoice-preview table {
            width: 100%;
          }
        }
      `}</style>

      {/* PAGE HEADER */}
      <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-center">
        <div>
          <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-blue-100 bg-blue-50 px-3 py-1 text-xs font-bold uppercase tracking-wider text-blue-700 dark:border-blue-900/70 dark:bg-blue-950/60 dark:text-blue-300">
            <span className="h-2 w-2 rounded-full bg-blue-600 dark:bg-blue-400" />
            Sales Management
          </div>

          <h1 className="text-3xl font-black tracking-tight text-slate-900 dark:text-white sm:text-4xl">
            Sales Invoices
          </h1>

          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400 sm:text-base">
            {showInvoiceForm
              ? "Create, update, and manage customer invoices."
              : "Manage invoices, monitor payments, and review accounting entries."}
          </p>
        </div>

        {!showInvoiceForm && permissions.can_create && (
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={startInvoiceFromDeliveryChallan}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-indigo-200 bg-indigo-50 px-4 py-3 text-sm font-bold text-indigo-700 shadow-sm transition hover:bg-indigo-100 dark:border-indigo-800 dark:bg-indigo-950/50 dark:text-indigo-300 dark:hover:bg-indigo-900/60"
            >
              <span className="text-lg leading-none">↗</span>
              Create from Delivery Challan
            </button>

            <button
              type="button"
              onClick={startManualInvoice}
              className={primaryButton}
            >
              <span className="text-xl leading-none">+</span>
              Add Manual Invoice
            </button>
          </div>
        )}
      </div>

      {/* FEEDBACK */}
      {successMessage && (
        <div className="flex items-center justify-between gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-medium text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300">
          <span>✓ {successMessage}</span>
          <button
            type="button"
            onClick={() => setSuccessMessage("")}
            className="text-lg"
          >
            ×
          </button>
        </div>
      )}

      {error && (
        <div className="flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 shadow-sm dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-red-100 font-bold dark:bg-red-900/70">
            !
          </span>
          <div className="flex-1 pt-1">{error}</div>
          <button
            type="button"
            onClick={() => setError("")}
            className="text-lg"
          >
            ×
          </button>
        </div>
      )}

      {/* SUMMARY CARDS */}
      {!showInvoiceForm && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-slate-500 dark:text-slate-400">
                Total Invoices
              </p>
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-xl text-blue-600 dark:bg-blue-950/60 dark:text-blue-300">
                #
              </span>
            </div>
            <p className="mt-4 text-3xl font-black tracking-tight text-slate-900 dark:text-white">
              {invoices.length}
            </p>
            <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">
              Recorded sales invoices
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-slate-500 dark:text-slate-400">
                Total Invoiced
              </p>
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-50 text-xl text-indigo-600 dark:bg-indigo-950/60 dark:text-indigo-300">
                ↗
              </span>
            </div>
            <p className="mt-4 break-words text-2xl font-black tracking-tight text-slate-900 dark:text-white">
              {formatMoney(totalInvoiced)}
            </p>
            <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">
              Invoice value
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-slate-500 dark:text-slate-400">
                Total Received
              </p>
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-xl text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-300">
                ✓
              </span>
            </div>
            <p className="mt-4 break-words text-2xl font-black tracking-tight text-emerald-700 dark:text-emerald-300">
              {formatMoney(totalPaid)}
            </p>
            <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">
              Payments recorded
            </p>
          </div>

          <div className="rounded-2xl border border-amber-200/80 bg-gradient-to-br from-amber-50 to-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md dark:border-amber-900/70 dark:from-amber-950/50 dark:to-slate-900">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-amber-800 dark:text-amber-300">
                Outstanding
              </p>
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-100 text-xl text-amber-700 dark:bg-amber-900/60 dark:text-amber-300">
                !
              </span>
            </div>
            <p className="mt-4 break-words text-2xl font-black tracking-tight text-amber-800 dark:text-amber-300">
              {formatMoney(totalOutstanding)}
            </p>
            <p className="mt-1 text-xs text-amber-700/70 dark:text-amber-400">
              Remaining balance
            </p>
          </div>
        </div>
      )}

      {/* CREATE / EDIT FORM */}
      {showInvoiceForm && (
        <form
          onSubmit={saveInvoice}
          className="space-y-7 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-7"
        >
          <div className="flex flex-col justify-between gap-4 border-b border-slate-100 pb-5 dark:border-slate-800 sm:flex-row sm:items-center">
            <div className="flex items-start gap-3">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-blue-50 text-2xl text-blue-700 dark:bg-blue-950/60 dark:text-blue-300">
                {editingInvoiceId ? "✎" : "+"}
              </div>
              <div>
                <h2 className="text-xl font-extrabold text-slate-900 dark:text-white">
                  {editingInvoiceId
                    ? "Edit Sales Invoice"
                    : "Create Sales Invoice"}
                </h2>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                  Enter the invoice details and add your products.
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {editingInvoiceId && (
                <span className="rounded-full bg-amber-50 px-3 py-2 text-xs font-bold text-amber-700 ring-1 ring-amber-200 dark:bg-amber-950/50 dark:text-amber-300 dark:ring-amber-800">
                  Editing invoice
                </span>
              )}

              <button
                type="button"
                disabled={saving}
                onClick={() => {
                  resetForm();
                  setError("");
                }}
                className={secondaryButton}
              >
                Cancel
              </button>
            </div>
          </div>

          {/* 01 INVOICE INFORMATION */}
          <section>
            <div className="mb-4 flex items-center gap-3">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-50 text-sm font-extrabold text-blue-700 dark:bg-blue-950/60 dark:text-blue-300">
                01
              </span>
              <div>
                <h3 className="font-bold text-slate-900 dark:text-white">
                  Invoice Information
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Invoice number, customer, warehouse, and date.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
              <div>
                <label className={labelClass}>Invoice Number</label>
                <input
                  value={invoiceNumber}
                  onChange={(event) => setInvoiceNumber(event.target.value)}
                  placeholder="INV-001"
                  className={inputClass}
                />
              </div>

              <div>
                <label className={labelClass}>Customer *</label>
                <select
                  value={customerId}
                  onChange={(event) => setCustomerId(event.target.value)}
                  className={inputClass}
                  required
                >
                  <option value="">Select Customer</option>
                  {customers.map((customer) => (
                    <option
                      key={customer.customer_id}
                      value={customer.customer_id}
                    >
                      {customer.customer_code} - {customer.customer_name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className={labelClass}>Warehouse *</label>
                <select
                  value={warehouseId}
                  onChange={(event) => setWarehouseId(event.target.value)}
                  className={inputClass}
                  required
                >
                  <option value="">Select Warehouse</option>
                  {warehouses.map((warehouse) => (
                    <option
                      key={warehouse.warehouse_id}
                      value={warehouse.warehouse_id}
                    >
                      {warehouse.warehouse_code} - {warehouse.warehouse_name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className={labelClass}>Invoice Date *</label>
                <input
                  type="date"
                  value={invoiceDate}
                  onChange={(event) => setInvoiceDate(event.target.value)}
                  className={inputClass}
                  required
                />
              </div>

              <div>
                <label className={labelClass}>Invoice Discount</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={discount}
                  onChange={(event) => setDiscount(event.target.value)}
                  className={inputClass}
                />
              </div>

              <div>
                <label className={labelClass}>Invoice Tax</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={tax}
                  onChange={(event) => setTax(event.target.value)}
                  className={inputClass}
                />
              </div>
            </div>
          </section>

          {/* 02 INVOICE ITEMS */}
          <section className="border-t border-slate-100 pt-6 dark:border-slate-800">
            <div className="mb-4 flex items-center gap-3">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-50 text-sm font-extrabold text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300">
                02
              </span>
              <div>
                <h3 className="font-bold text-slate-900 dark:text-white">
                  Invoice Items
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Type or scan a product, then press Enter or click Add.
                </p>
              </div>
            </div>

            {/* QUICK ADD BAR */}
            {/* QUICK ADD BAR */}
            <div className="mb-4 rounded-2xl border border-indigo-100 bg-indigo-50/50 p-4 dark:border-indigo-900/60 dark:bg-indigo-950/20">
              <div className="grid grid-cols-2 gap-3 lg:grid-cols-[minmax(220px,2.2fr)_repeat(4,minmax(90px,1fr))_minmax(110px,1fr)_auto] lg:items-end">
                <div className="col-span-2 lg:col-span-1">
                  <label className={labelClass}>Product</label>
                  <input
                    ref={quickInputRef}
                    list="quick-product-list"
                    value={quick.search}
                    onChange={(event) => handleQuickProductChange(event.target.value)}
                    onKeyDown={handleQuickKeyDown}
                    placeholder="Search or scan SKU, barcode or name..."
                    autoComplete="off"
                    className={inputClass}
                  />

                  <datalist id="quick-product-list">
                    {products
                      .filter((product) => product.is_active)
                      .map((product) => (
                        <option
                          key={product.product_id}
                          value={`${product.sku} - ${product.product_name}`}
                        />
                      ))}
                  </datalist>
                </div>

                <div>
                  <label className={labelClass}>Quantity</label>
                  <input
                    type="number"
                    min="0.001"
                    step="0.001"
                    value={quick.quantity}
                    onChange={(event) => setQuickField("quantity", event.target.value)}
                    onKeyDown={handleQuickKeyDown}
                    className={inputClass}
                  />
                </div>

                <div>
                  <label className={labelClass}>Unit Price</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={quick.unitPrice}
                    onChange={(event) => setQuickField("unitPrice", event.target.value)}
                    onKeyDown={handleQuickKeyDown}
                    className={inputClass}
                  />
                </div>

                <div>
                  <label className={labelClass}>Discount</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={quick.discount}
                    onChange={(event) => setQuickField("discount", event.target.value)}
                    onKeyDown={handleQuickKeyDown}
                    className={inputClass}
                  />
                </div>

                <div>
                  <label className={labelClass}>Tax</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={quick.tax}
                    onChange={(event) => setQuickField("tax", event.target.value)}
                    onKeyDown={handleQuickKeyDown}
                    className={inputClass}
                  />
                </div>

                <div>
                  <label className={labelClass}>Line Total</label>
                  <div className="flex h-[42px] items-center justify-end rounded-xl border border-slate-200 bg-slate-100 px-3 text-sm font-bold tabular-nums text-slate-800 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100">
                    {formatMoney(
                      calculateLineTotal({
                        quantity: quick.quantity,
                        unitPrice: quick.unitPrice,
                        discount: quick.discount,
                        tax: quick.tax,
                      })
                    )}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={addQuickItem}
                  className={`${primaryButton} col-span-2 h-[42px] lg:col-span-1`}
                >
                  <span className="text-lg leading-none">+</span>
                  Add
                </button>
              </div>

              {quickError && (
                <p className="mt-3 text-sm font-medium text-red-600 dark:text-red-400">
                  {quickError}
                </p>
              )}
            </div>

            {/* ITEMS TOOLBAR */}
            <div className="mb-3 flex items-center justify-between gap-3">
              <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                {items.length} item{items.length === 1 ? "" : "s"} added
              </p>

              <ColumnToggle columns={ITEM_COLUMNS} state={itemCols} />
            </div>

            {/* The scrollbar appears only when the visible columns are wider
                than the container. */}
            <div className="w-full overflow-x-auto rounded-2xl border border-slate-200 [scrollbar-width:thin] dark:border-slate-700">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 dark:bg-slate-800">
                  <tr>
                    {itemCols.visible.product && (
                      <th className="px-4 py-3 text-left font-bold text-slate-500 dark:text-slate-300">
                        Product
                      </th>
                    )}
                    {itemCols.visible.quantity && (
                      <th className="px-4 py-3 text-left font-bold text-slate-500 dark:text-slate-300">
                        Quantity
                      </th>
                    )}
                    {itemCols.visible.unitPrice && (
                      <th className="px-4 py-3 text-left font-bold text-slate-500 dark:text-slate-300">
                        Unit Price
                      </th>
                    )}
                    {itemCols.visible.discount && (
                      <th className="px-4 py-3 text-left font-bold text-slate-500 dark:text-slate-300">
                        Discount
                      </th>
                    )}
                    {itemCols.visible.tax && (
                      <th className="px-4 py-3 text-left font-bold text-slate-500 dark:text-slate-300">
                        Tax
                      </th>
                    )}
                    {itemCols.visible.lineTotal && (
                      <th className="px-4 py-3 text-right font-bold text-slate-500 dark:text-slate-300">
                        Line Total
                      </th>
                    )}
                    {itemCols.visible.action && (
                      <th className="px-4 py-3 text-center font-bold text-slate-500 dark:text-slate-300">
                        Action
                      </th>
                    )}
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {items.map((item, index) => (
                    <tr
                      key={index}
                      className="hover:bg-slate-50 dark:hover:bg-slate-800/60"
                    >
                      {itemCols.visible.product && (
                        <td className="min-w-[230px] px-3 py-3">
                          <select
                            value={item.productId}
                            onChange={(event) =>
                              updateItem(index, "productId", event.target.value)
                            }
                            className={inputClass}
                            required
                          >
                            <option value="">Select Product</option>
                            {products
                              .filter((product) => product.is_active)
                              .map((product) => (
                                <option
                                  key={product.product_id}
                                  value={product.product_id}
                                >
                                  {product.sku} - {product.product_name}
                                </option>
                              ))}
                          </select>
                        </td>
                      )}

                      {itemCols.visible.quantity && (
                        <td className="px-3 py-3">
                          <input
                            type="number"
                            min="0.001"
                            step="0.001"
                            value={item.quantity}
                            onChange={(event) =>
                              updateItem(index, "quantity", event.target.value)
                            }
                            className={`${inputClass} min-w-[100px]`}
                            required
                          />
                        </td>
                      )}

                      {itemCols.visible.unitPrice && (
                        <td className="px-3 py-3">
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={item.unitPrice}
                            onChange={(event) =>
                              updateItem(index, "unitPrice", event.target.value)
                            }
                            className={`${inputClass} min-w-[115px]`}
                          />
                        </td>
                      )}

                      {itemCols.visible.discount && (
                        <td className="px-3 py-3">
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={item.discount}
                            onChange={(event) =>
                              updateItem(index, "discount", event.target.value)
                            }
                            className={`${inputClass} min-w-[100px]`}
                          />
                        </td>
                      )}

                      {itemCols.visible.tax && (
                        <td className="px-3 py-3">
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={item.tax}
                            onChange={(event) =>
                              updateItem(index, "tax", event.target.value)
                            }
                            className={`${inputClass} min-w-[100px]`}
                          />
                        </td>
                      )}

                      {itemCols.visible.lineTotal && (
                        <td className="whitespace-nowrap px-4 py-3 text-right font-bold text-slate-800 dark:text-slate-100">
                          {formatMoney(calculateLineTotal(item))}
                        </td>
                      )}

                      {itemCols.visible.action && (
                        <td className="px-3 py-3 text-center">
                          <button
                            type="button"
                            onClick={() => removeItem(index)}
                            className="rounded-lg px-3 py-2 text-xs font-bold text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/50"
                          >
                            Remove
                          </button>
                        </td>
                      )}
                    </tr>
                  ))}

                  {!items.length && (
                    <tr>
                      <td
                        colSpan={itemCols.count}
                        className="px-4 py-12 text-center"
                      >
                        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-2xl text-slate-400 dark:bg-slate-800 dark:text-slate-500">
                          +
                        </div>
                        <p className="mt-3 font-semibold text-slate-700 dark:text-slate-200">
                          No products added
                        </p>
                        <p className="mt-1 text-sm text-slate-400 dark:text-slate-500">
                          Use the Item field above to add your first product.
                        </p>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>

          {/* 03 NOTES AND SUMMARY */}
          <section className="border-t border-slate-100 pt-6 dark:border-slate-800">
            <div className="mb-4 flex items-center gap-3">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-50 text-sm font-extrabold text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300">
                03
              </span>
              <div>
                <h3 className="font-bold text-slate-900 dark:text-white">
                  Notes and Summary
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Add optional notes and review the invoice totals.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_340px]">
              <div>
                <label className={labelClass}>Notes</label>
                <textarea
                  value={notes}
                  onChange={(event) => setNotes(event.target.value)}
                  rows={5}
                  placeholder="Enter any additional invoice notes..."
                  className={inputClass}
                />
              </div>

              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5 dark:border-slate-700 dark:bg-slate-800/70">
                <div className="mb-4 flex items-center justify-between">
                  <h4 className="font-bold text-slate-900 dark:text-white">
                    Invoice Summary
                  </h4>
                  <span className="rounded-lg bg-white px-2 py-1 text-xs font-semibold text-slate-500 ring-1 ring-slate-200 dark:bg-slate-900 dark:text-slate-300 dark:ring-slate-700">
                    PKR
                  </span>
                </div>

                <div className="space-y-3 text-sm">
                  <div className="flex justify-between gap-3 text-slate-600 dark:text-slate-300">
                    <span>Subtotal</span>
                    <span className="font-semibold text-slate-900 dark:text-white">
                      {formatMoney(subtotal)}
                    </span>
                  </div>

                  <div className="flex justify-between gap-3 text-slate-600 dark:text-slate-300">
                    <span>Invoice Discount</span>
                    <span className="font-semibold text-slate-900 dark:text-white">
                      -{formatMoney(discount)}
                    </span>
                  </div>

                  <div className="flex justify-between gap-3 text-slate-600 dark:text-slate-300">
                    <span>Invoice Tax</span>
                    <span className="font-semibold text-slate-900 dark:text-white">
                      +{formatMoney(tax)}
                    </span>
                  </div>

                  <div className="border-t border-dashed border-slate-300 pt-4 dark:border-slate-600">
                    <div className="flex items-center justify-between gap-3">
                      <span className="font-bold text-slate-900 dark:text-white">
                        Total Amount
                      </span>
                      <span className="text-xl font-black tracking-tight text-blue-700 dark:text-blue-300">
                        {formatMoney(total)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>

          <div className="flex flex-col-reverse gap-3 border-t border-slate-100 pt-6 dark:border-slate-800 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs text-slate-400 dark:text-slate-500">
              Fields marked with * are required.
            </p>

            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                disabled={saving}
                onClick={() => {
                  resetForm();
                  setError("");
                }}
                className={secondaryButton}
              >
                Cancel
              </button>

              <button
                type="submit"
                disabled={saving}
                className={`${primaryButton} min-w-[190px]`}
              >
                {saving ? (
                  <>
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                    {editingInvoiceId ? "Updating..." : "Saving..."}
                  </>
                ) : (
                  <>
                    <span>✓</span>
                    {editingInvoiceId ? "Update Invoice" : "Save Sales Invoice"}
                  </>
                )}
              </button>
            </div>
          </div>
        </form>
      )}

      {/* INVOICE LIST (no overflow-hidden, so the Columns dropdown is never clipped) */}
      {!showInvoiceForm && (
        <section className="rounded-3xl border border-slate-200/80 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="flex flex-col justify-between gap-3 rounded-t-3xl border-b border-slate-100 p-5 dark:border-slate-800 sm:flex-row sm:items-center sm:px-6">
            <div>
              <h2 className="text-lg font-extrabold text-slate-900 dark:text-white">
                Sales Invoice Register
              </h2>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                Browse invoices, review balances, and open accounting entries.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex w-fit items-center gap-2 rounded-xl bg-slate-100 px-3 py-2 text-sm font-bold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                <span className="h-2 w-2 rounded-full bg-blue-500" />
                {invoices.length} records
              </span>

              {/* COLUMN PICKER */}
              <ColumnToggle columns={INVOICE_COLUMNS} state={invoiceCols} />
            </div>
          </div>

          {loading ? (
            <div className="flex flex-col items-center justify-center gap-3 p-16">
              <div className="h-9 w-9 animate-spin rounded-full border-4 border-blue-100 border-t-blue-600 dark:border-slate-700 dark:border-t-blue-400" />
              <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
                Loading sales invoices...
              </p>
            </div>
          ) : (
            /* The scrollbar appears only when the visible columns are wider
               than the container. */
            <div className="w-full overflow-x-auto [scrollbar-width:thin]">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 dark:bg-slate-800">
                  <tr>
                    {invoiceCols.visible.invoice && (
                      <th className="px-5 py-4 text-left font-bold text-slate-500 dark:text-slate-300">
                        Invoice
                      </th>
                    )}
                    {invoiceCols.visible.challan && (
                      <th className="px-5 py-4 text-left font-bold text-slate-500 dark:text-slate-300">
                        Delivery Challan
                      </th>
                    )}
                    {invoiceCols.visible.customer && (
                      <th className="px-5 py-4 text-left font-bold text-slate-500 dark:text-slate-300">
                        Customer
                      </th>
                    )}
                    {invoiceCols.visible.warehouse && (
                      <th className="px-5 py-4 text-left font-bold text-slate-500 dark:text-slate-300">
                        Warehouse
                      </th>
                    )}
                    {invoiceCols.visible.date && (
                      <th className="px-5 py-4 text-left font-bold text-slate-500 dark:text-slate-300">
                        Date
                      </th>
                    )}
                    {invoiceCols.visible.total && (
                      <th className="px-5 py-4 text-right font-bold text-slate-500 dark:text-slate-300">
                        Total
                      </th>
                    )}
                    {invoiceCols.visible.paid && (
                      <th className="px-5 py-4 text-right font-bold text-slate-500 dark:text-slate-300">
                        Paid
                      </th>
                    )}
                    {invoiceCols.visible.balance && (
                      <th className="px-5 py-4 text-right font-bold text-slate-500 dark:text-slate-300">
                        Balance
                      </th>
                    )}
                    {invoiceCols.visible.status && (
                      <th className="px-5 py-4 text-left font-bold text-slate-500 dark:text-slate-300">
                        Status
                      </th>
                    )}
                    {invoiceCols.visible.accounting && (
                      <th className="px-5 py-4 text-center font-bold text-slate-500 dark:text-slate-300">
                        Accounting
                      </th>
                    )}
                    {invoiceCols.visible.actions && (
                      <th className="px-5 py-4 text-center font-bold text-slate-500 dark:text-slate-300">
                        Actions
                      </th>
                    )}
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {invoices.map((invoice) => (
                    <tr
                      key={invoice.invoice_id}
                      className="hover:bg-slate-50 dark:hover:bg-slate-800/60"
                    >
                      {invoiceCols.visible.invoice && (
                        <td className="whitespace-nowrap px-5 py-4">
                          <button
                            type="button"
                            onClick={() => openInvoice(invoice.invoice_id)}
                            className="font-extrabold text-blue-700 hover:text-blue-900 hover:underline dark:text-blue-300 dark:hover:text-blue-200"
                          >
                            {invoice.invoice_number}
                          </button>
                          <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">
                            ID: {invoice.invoice_id}
                          </p>
                        </td>
                      )}

                      {invoiceCols.visible.challan && (
                        <td className="whitespace-nowrap px-5 py-4">
                          {invoice.delivery_challan_number ? (
                            <span className="inline-flex whitespace-nowrap rounded-lg bg-indigo-50 px-3 py-1.5 text-xs font-bold text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300">
                              {invoice.delivery_challan_number}
                            </span>
                          ) : (
                            <span className="inline-flex rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                              Manual
                            </span>
                          )}
                        </td>
                      )}

                      {invoiceCols.visible.customer && (
                        <td className="whitespace-nowrap px-5 py-4">
                          <p className="font-semibold text-slate-800 dark:text-slate-100">
                            {invoice.customer_name || "-"}
                          </p>
                        </td>
                      )}

                      {invoiceCols.visible.warehouse && (
                        <td className="whitespace-nowrap px-5 py-4 text-slate-600 dark:text-slate-300">
                          {invoice.warehouse_name || "-"}
                        </td>
                      )}

                      {invoiceCols.visible.date && (
                        <td className="whitespace-nowrap px-5 py-4 text-slate-600 dark:text-slate-300">
                          {formatDate(invoice.invoice_date)}
                        </td>
                      )}

                      {invoiceCols.visible.total && (
                        <td className="whitespace-nowrap px-5 py-4 text-right font-bold text-slate-900 dark:text-white">
                          {formatMoney(invoice.total_amount)}
                        </td>
                      )}

                      {invoiceCols.visible.paid && (
                        <td className="whitespace-nowrap px-5 py-4 text-right font-semibold text-emerald-700 dark:text-emerald-300">
                          {formatMoney(invoice.paid_amount)}
                        </td>
                      )}

                      {invoiceCols.visible.balance && (
                        <td className="whitespace-nowrap px-5 py-4 text-right font-semibold text-amber-700 dark:text-amber-300">
                          {formatMoney(invoice.balance_amount)}
                        </td>
                      )}

                      {invoiceCols.visible.status && (
                        <td className="whitespace-nowrap px-5 py-4">
                          <StatusBadge status={invoice.status} />
                        </td>
                      )}

                      {invoiceCols.visible.accounting && (
                        <td className="whitespace-nowrap px-5 py-4 text-center">
                          <button
                            type="button"
                            onClick={() => openAccountingLines(invoice)}
                            className="whitespace-nowrap rounded-lg bg-indigo-50 px-3 py-2 text-xs font-bold text-indigo-700 transition hover:bg-indigo-100 dark:bg-indigo-950/60 dark:text-indigo-300 dark:hover:bg-indigo-900/60"
                          >
                            Debit / Credit
                          </button>
                        </td>
                      )}

                      {invoiceCols.visible.actions && (
                        <td className="whitespace-nowrap px-5 py-4">
                          <div className="flex items-center justify-center gap-2">
                            <button
                              type="button"
                              onClick={() => openInvoice(invoice.invoice_id)}
                              className="rounded-lg bg-blue-50 px-3 py-2 text-xs font-bold text-blue-700 hover:bg-blue-100 dark:bg-blue-950/60 dark:text-blue-300 dark:hover:bg-blue-900/60"
                            >
                              View
                            </button>

                            {permissions.can_update && (
                              <button
                                type="button"
                                onClick={() => editInvoice(invoice.invoice_id)}
                                className="rounded-lg bg-amber-50 px-3 py-2 text-xs font-bold text-amber-700 hover:bg-amber-100 dark:bg-amber-950/60 dark:text-amber-300 dark:hover:bg-amber-900/60"
                              >
                                Edit
                              </button>
                            )}
                          </div>
                        </td>
                      )}
                    </tr>
                  ))}

                  {!invoices.length && (
                    <tr>
                      <td
                        colSpan={invoiceCols.count}
                        className="px-6 py-16 text-center"
                      >
                        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-2xl text-slate-400 dark:bg-slate-800 dark:text-slate-500">
                          ▤
                        </div>
                        <p className="mt-4 font-bold text-slate-800 dark:text-slate-100">
                          No sales invoices found
                        </p>
                        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                          Create an invoice to see it listed here.
                        </p>
                        {permissions.can_create && (
                          <button
                            type="button"
                            onClick={startManualInvoice}
                            className={`${primaryButton} mt-4`}
                          >
                            + Add Manual Invoice
                          </button>
                        )}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}

          <div className="flex flex-col justify-between gap-2 rounded-b-3xl border-t border-slate-100 bg-slate-50/70 px-5 py-4 text-xs text-slate-500 dark:border-slate-800 dark:bg-slate-800/50 dark:text-slate-400 sm:flex-row sm:items-center sm:px-6">
            <span>
              Showing {invoices.length} invoice
              {invoices.length === 1 ? "" : "s"}
            </span>
            <span>Amounts displayed in PKR format.</span>
          </div>
        </section>
      )}

      {/* ACCOUNTING LINES MODAL */}
      {accountingInvoice && (
        <Modal
          wide
          onClose={() => {
            setAccountingInvoice(null);
            setAccountingLines([]);
            setAccountingError("");
          }}
        >
          <ModalHeader
            title="Accounting Entries"
            subtitle={`Invoice: ${accountingInvoice.invoice_number}`}
            onClose={() => {
              setAccountingInvoice(null);
              setAccountingLines([]);
              setAccountingError("");
            }}
          />

          <div className="max-h-[72vh] space-y-5 overflow-y-auto bg-slate-50/70 p-4 dark:bg-slate-950/50 sm:p-6">
            {accountingError && (
              <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
                {accountingError}
              </div>
            )}

            {accountingLoading ? (
              <div className="flex flex-col items-center justify-center gap-3 py-16">
                <div className="h-9 w-9 animate-spin rounded-full border-4 border-indigo-100 border-t-indigo-600 dark:border-slate-700 dark:border-t-indigo-400" />
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  Loading accounting entries...
                </p>
              </div>
            ) : accountingError ? null : (
              <>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                  <div className="rounded-2xl border border-blue-100 bg-white p-5 shadow-sm dark:border-blue-900/60 dark:bg-slate-900">
                    <p className="text-sm font-semibold text-slate-500 dark:text-slate-400">
                      Total Debit
                    </p>
                    <p className="mt-3 text-2xl font-black text-blue-700 dark:text-blue-300">
                      {formatMoney(accountingTotalDebit)}
                    </p>
                  </div>

                  <div className="rounded-2xl border border-purple-100 bg-white p-5 shadow-sm dark:border-purple-900/60 dark:bg-slate-900">
                    <p className="text-sm font-semibold text-slate-500 dark:text-slate-400">
                      Total Credit
                    </p>
                    <p className="mt-3 text-2xl font-black text-purple-700 dark:text-purple-300">
                      {formatMoney(accountingTotalCredit)}
                    </p>
                  </div>

                  <div
                    className={`rounded-2xl border bg-white p-5 shadow-sm dark:bg-slate-900 ${Math.abs(
                      accountingTotalDebit - accountingTotalCredit
                    ) < 0.01
                      ? "border-emerald-200 dark:border-emerald-800"
                      : "border-red-200 dark:border-red-800"
                      }`}
                  >
                    <p className="text-sm font-semibold text-slate-500 dark:text-slate-400">
                      Difference
                    </p>
                    <p className="mt-3 text-2xl font-black text-slate-900 dark:text-white">
                      {formatMoney(
                        Math.abs(accountingTotalDebit - accountingTotalCredit)
                      )}
                    </p>
                    <p
                      className={`mt-1 text-xs font-bold ${Math.abs(
                        accountingTotalDebit - accountingTotalCredit
                      ) < 0.01
                        ? "text-emerald-700 dark:text-emerald-300"
                        : "text-red-700 dark:text-red-300"
                        }`}
                    >
                      {Math.abs(
                        accountingTotalDebit - accountingTotalCredit
                      ) < 0.01
                        ? "✓ Totals match"
                        : "! Totals do not match"}
                    </p>
                  </div>
                </div>

                {accountingJournals.map((journal) => {
                  const balanced =
                    Math.abs(journal.debit - journal.credit) < 0.01;

                  return (
                    <div
                      key={journal.journal_id}
                      className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900"
                    >
                      <div className="flex flex-col justify-between gap-3 border-b border-slate-100 bg-white p-4 dark:border-slate-800 dark:bg-slate-900 sm:flex-row sm:items-center sm:p-5">
                        <div>
                          <h3 className="font-extrabold text-slate-900 dark:text-white">
                            Journal:{" "}
                            {journal.journal_number || journal.journal_id}
                          </h3>
                          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                            Type:{" "}
                            {journal.reference_type === "SALES_COGS"
                              ? "Cost of Goods Sold"
                              : journal.reference_type === "SALES_INVOICE"
                                ? "Sales Invoice"
                                : journal.reference_type || "-"}
                            {" · "}
                            Date: {formatDate(journal.journal_date)}
                          </p>
                          {journal.journal_description && (
                            <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                              {journal.journal_description}
                            </p>
                          )}
                        </div>

                        <span
                          className={`w-fit rounded-full px-3 py-1.5 text-xs font-extrabold ${balanced
                            ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300"
                            : "bg-red-50 text-red-700 dark:bg-red-950/60 dark:text-red-300"
                            }`}
                        >
                          {balanced ? "✓ Balanced" : "! Unbalanced"}
                        </span>
                      </div>

                      <div className="w-full overflow-x-auto [scrollbar-width:thin]">
                        <table className="w-full text-sm">
                          <thead className="bg-slate-50 dark:bg-slate-800">
                            <tr>
                              {["Account Code", "Account Name", "Description"].map(
                                (heading) => (
                                  <th
                                    key={heading}
                                    className="px-4 py-3 text-left font-bold text-slate-500 dark:text-slate-300"
                                  >
                                    {heading}
                                  </th>
                                )
                              )}
                              <th className="px-4 py-3 text-right font-bold text-slate-500 dark:text-slate-300">
                                Debit
                              </th>
                              <th className="px-4 py-3 text-right font-bold text-slate-500 dark:text-slate-300">
                                Credit
                              </th>
                            </tr>
                          </thead>

                          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                            {(journal.lines || []).map((line, index) => (
                              <tr
                                key={`${journal.journal_id}-${line.account_id}-${index}`}
                                className="hover:bg-slate-50 dark:hover:bg-slate-800/60"
                              >
                                <td className="whitespace-nowrap px-4 py-3 font-semibold text-slate-700 dark:text-slate-200">
                                  {line.account_code || "-"}
                                </td>
                                <td className="whitespace-nowrap px-4 py-3 font-medium text-slate-800 dark:text-slate-100">
                                  {line.account_name || "Unknown Account"}
                                </td>
                                <td className="px-4 py-3 text-slate-500 dark:text-slate-400">
                                  {line.line_description ||
                                    line.journal_description ||
                                    "-"}
                                </td>
                                <td className="whitespace-nowrap px-4 py-3 text-right font-semibold text-blue-700 dark:text-blue-300">
                                  {Number(line.debit || 0) > 0
                                    ? formatMoney(line.debit)
                                    : "-"}
                                </td>
                                <td className="whitespace-nowrap px-4 py-3 text-right font-semibold text-purple-700 dark:text-purple-300">
                                  {Number(line.credit || 0) > 0
                                    ? formatMoney(line.credit)
                                    : "-"}
                                </td>
                              </tr>
                            ))}

                            <tr className="bg-slate-50 font-extrabold dark:bg-slate-800">
                              <td
                                colSpan={3}
                                className="px-4 py-3 text-right text-slate-800 dark:text-slate-100"
                              >
                                Journal Total
                              </td>
                              <td className="px-4 py-3 text-right text-blue-700 dark:text-blue-300">
                                {formatMoney(journal.debit)}
                              </td>
                              <td className="px-4 py-3 text-right text-purple-700 dark:text-purple-300">
                                {formatMoney(journal.credit)}
                              </td>
                            </tr>
                          </tbody>
                        </table>
                      </div>
                    </div>
                  );
                })}

                {!accountingLines.length && (
                  <div className="rounded-2xl border border-amber-200 bg-amber-50 p-8 text-center dark:border-amber-900 dark:bg-amber-950/40">
                    <p className="font-bold text-amber-900 dark:text-amber-300">
                      No accounting entries found
                    </p>
                    <p className="mt-2 text-sm text-amber-800 dark:text-amber-400">
                      Check whether this invoice has generated journal entries
                      in the financial ledger.
                    </p>
                  </div>
                )}
              </>
            )}
          </div>

          <div className="flex justify-end border-t border-slate-100 bg-white p-4 dark:border-slate-800 dark:bg-slate-900 sm:px-6">
            <button
              type="button"
              onClick={() => {
                setAccountingInvoice(null);
                setAccountingLines([]);
                setAccountingError("");
              }}
              className={secondaryButton}
            >
              Close
            </button>
          </div>
        </Modal>
      )}

      {/* INVOICE PREVIEW MODAL */}
      {selectedInvoice && (
        <Modal wide onClose={() => setSelectedInvoice(null)}>
          <ModalHeader
            title="Invoice Preview"
            subtitle={`Invoice ${selectedInvoice.invoice.invoice_number}`}
            onClose={() => setSelectedInvoice(null)}
          />

          <div
            id="invoice-preview"
            className="max-h-[72vh] overflow-y-auto bg-white p-5 text-slate-900 sm:p-8"
          >
            <div className="flex flex-col justify-between gap-5 border-b-2 border-slate-900 pb-6 sm:flex-row sm:items-start">
              <div>
                <div className="inline-flex items-center gap-2">
                  <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-slate-900 text-xl font-black text-white">
                    G
                  </span>
                  <h1 className="text-3xl font-black tracking-tight text-slate-900">
                    GOLDENLAKE
                  </h1>
                </div>
                <p className="mt-2 text-sm text-slate-500">Sales Invoice</p>
              </div>

              <div className="sm:text-right">
                <p className="text-xs font-bold uppercase tracking-widest text-slate-400">
                  Invoice Number
                </p>
                <p className="mt-1 text-xl font-extrabold text-slate-900">
                  {selectedInvoice.invoice.invoice_number}
                </p>
                <p className="mt-2 text-sm text-slate-600">
                  Date: {formatDate(selectedInvoice.invoice.invoice_date)}
                </p>
                {selectedInvoice.invoice.delivery_challan_number && (
                  <p className="mt-1 text-sm text-slate-600">
                    Delivery Challan:{" "}
                    {selectedInvoice.invoice.delivery_challan_number}
                  </p>
                )}
                <div className="mt-2 sm:flex sm:justify-end">
                  <StatusBadge status={selectedInvoice.invoice.status} />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-5 border-b border-slate-200 py-6 sm:grid-cols-2">
              <div className="rounded-2xl bg-slate-50 p-5">
                <p className="mb-3 text-xs font-extrabold uppercase tracking-widest text-slate-400">
                  Bill To
                </p>
                <p className="text-lg font-bold text-slate-900">
                  {selectedInvoice.invoice.customer_name || "-"}
                </p>
                <p className="mt-1 text-sm text-slate-500">
                  {selectedInvoice.invoice.customer_code || "-"}
                </p>
                {selectedInvoice.invoice.customer_phone && (
                  <p className="mt-1 text-sm text-slate-600">
                    {selectedInvoice.invoice.customer_phone}
                  </p>
                )}
                {selectedInvoice.invoice.customer_email && (
                  <p className="mt-1 break-all text-sm text-slate-600">
                    {selectedInvoice.invoice.customer_email}
                  </p>
                )}
              </div>

              <div className="rounded-2xl bg-slate-50 p-5">
                <p className="mb-3 text-xs font-extrabold uppercase tracking-widest text-slate-400">
                  Warehouse
                </p>
                <p className="text-lg font-bold text-slate-900">
                  {selectedInvoice.invoice.warehouse_name || "-"}
                </p>
                <p className="mt-1 text-sm text-slate-500">
                  {selectedInvoice.invoice.warehouse_code || "-"}
                </p>
              </div>
            </div>

            <div className="mt-6 w-full overflow-x-auto rounded-xl border border-slate-200 [scrollbar-width:thin]">
              <table className="w-full text-sm">
                <thead className="bg-slate-50">
                  <tr>
                    {[
                      "#",
                      "Product",
                      "Qty",
                      "Unit",
                      "Price",
                      "Discount",
                      "Tax",
                      "Total",
                    ].map((heading, index) => (
                      <th
                        key={`${heading}-${index}`}
                        className={`px-4 py-3 text-xs font-extrabold uppercase tracking-wider text-slate-500 ${index === 2 || index >= 4
                          ? "text-right"
                          : "text-left"
                          }`}
                      >
                        {heading}
                      </th>
                    ))}
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-100">
                  {selectedInvoice.items.map((item, index) => (
                    <tr key={item.invoice_item_id || index}>
                      <td className="px-4 py-4 text-slate-500">{index + 1}</td>
                      <td className="px-4 py-4">
                        <p className="font-bold text-slate-800">
                          {item.product_name || "-"}
                        </p>
                        <p className="mt-1 text-xs text-slate-400">
                          {item.sku || ""}
                        </p>
                      </td>
                      <td className="px-4 py-4 text-right font-semibold">
                        {item.quantity}
                      </td>
                      <td className="px-4 py-4">{item.unit || "-"}</td>
                      <td className="px-4 py-4 text-right">
                        {formatMoney(item.unit_price)}
                      </td>
                      <td className="px-4 py-4 text-right">
                        {formatMoney(item.discount)}
                      </td>
                      <td className="px-4 py-4 text-right">
                        {formatMoney(item.tax)}
                      </td>
                      <td className="px-4 py-4 text-right font-bold">
                        {formatMoney(item.line_total)}
                      </td>
                    </tr>
                  ))}

                  {!selectedInvoice.items.length && (
                    <tr>
                      <td colSpan={8} className="p-8 text-center text-slate-500">
                        No invoice items found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <div className="mt-6 flex justify-end">
              <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-slate-50 p-5">
                <div className="space-y-3 text-sm">
                  <div className="flex justify-between gap-3 text-slate-600">
                    <span>Subtotal</span>
                    <span className="font-semibold text-slate-900">
                      {formatMoney(selectedInvoice.invoice.subtotal)}
                    </span>
                  </div>
                  <div className="flex justify-between gap-3 text-slate-600">
                    <span>Discount</span>
                    <span className="font-semibold text-slate-900">
                      -{formatMoney(selectedInvoice.invoice.discount)}
                    </span>
                  </div>
                  <div className="flex justify-between gap-3 text-slate-600">
                    <span>Tax</span>
                    <span className="font-semibold text-slate-900">
                      +{formatMoney(selectedInvoice.invoice.tax)}
                    </span>
                  </div>
                  <div className="flex justify-between gap-3 border-t border-slate-200 pt-4 text-base">
                    <span className="font-extrabold text-slate-900">Total</span>
                    <span className="font-black text-blue-700">
                      {formatMoney(selectedInvoice.invoice.total_amount)}
                    </span>
                  </div>
                  <div className="flex justify-between gap-3 text-slate-500">
                    <span>Paid</span>
                    <span className="font-semibold text-emerald-700">
                      {formatMoney(selectedInvoice.invoice.paid_amount)}
                    </span>
                  </div>
                  <div className="flex justify-between gap-3 text-slate-500">
                    <span>Balance</span>
                    <span className="font-semibold text-amber-700">
                      {formatMoney(selectedInvoice.invoice.balance_amount)}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {selectedInvoice.invoice.notes && (
              <div className="mt-6 border-t border-slate-200 pt-5">
                <p className="font-bold text-slate-900">Notes</p>
                <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-600">
                  {selectedInvoice.invoice.notes}
                </p>
              </div>
            )}

            <div className="mt-8 border-t border-slate-100 pt-5 text-center text-xs text-slate-400">
              Thank you for your business.
            </div>
          </div>

          <div className="flex flex-wrap justify-end gap-3 border-t border-slate-100 bg-white p-4 dark:border-slate-800 dark:bg-slate-900 sm:px-6">
            {permissions.can_update && (
              <button
                type="button"
                onClick={() => editInvoice(selectedInvoice.invoice.invoice_id)}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-amber-50 px-4 py-2.5 text-sm font-bold text-amber-700 hover:bg-amber-100 dark:bg-amber-950/60 dark:text-amber-300 dark:hover:bg-amber-900/60"
              >
                Edit Invoice
              </button>
            )}

            <button
              type="button"
              onClick={printInvoice}
              className={secondaryButton}
            >
              Print
            </button>

            <button
              type="button"
              onClick={downloadInvoicePDF}
              className={primaryButton}
            >
              Download PDF
            </button>

            <button
              type="button"
              onClick={() => setSelectedInvoice(null)}
              className="inline-flex items-center justify-center rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-bold text-white hover:bg-slate-800 dark:bg-slate-700 dark:hover:bg-slate-600"
            >
              Close
            </button>
          </div>
        </Modal>
      )}

      {/* LOADING OVERLAY */}
      {invoiceLoading && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-[2px]">
          <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-6 py-5 shadow-2xl dark:border-slate-700 dark:bg-slate-900">
            <span className="h-5 w-5 animate-spin rounded-full border-2 border-blue-100 border-t-blue-600 dark:border-slate-700 dark:border-t-blue-400" />
            <span className="text-sm font-bold text-slate-700 dark:text-slate-200">
              Loading invoice...
            </span>
          </div>
        </div>
      )}
    </div>
  );
}