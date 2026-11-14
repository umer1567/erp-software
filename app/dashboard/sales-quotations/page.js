"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";

const moneyFormatter = new Intl.NumberFormat("en-PK", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

function money(value) {
  return moneyFormatter.format(Number(value) || 0);
}

function today() {
  const date = new Date();
  const offset = date.getTimezoneOffset();

  return new Date(date.getTime() - offset * 60 * 1000)
    .toISOString()
    .slice(0, 10);
}

function dateDisplay(value) {
  if (!value) return "—";

  const date = new Date(`${String(value).slice(0, 10)}T00:00:00`);

  if (Number.isNaN(date.getTime())) return value;

  return date.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function emptyItem() {
  return {
    productId: "",
    itemName: "",
    itemDescription: "",
    itemBalance: 0,
    uom: "PCS",
    quantity: 1,
    unitPrice: 0,
    taxCode: "",
    taxRate: 0,
    memo: "",
  };
}

function emptyForm() {
  return {
    quotationId: null,
    quotationNumber: "",
    customerId: "",
    warehouseId: "",
    quotationDate: today(),
    expiryDate: "",
    status: "Draft",
    department: "",
    project: "",
    quotationClass: "",
    salesRep: "",
    paymentTerm: "",
    memo: "",
    termsConditions: "",
    relatedTransaction: "",
    attachmentName: "",
    attachmentUrl: "",
    items: [],
  };
}

const EMPTY_QUICK = {
  search: "",
  quantity: 1,
  unitPrice: 0,
  taxRate: 0,
};

function getProductId(product) {
  return product.product_id ?? product.productId;
}

function getProductName(product) {
  return product.product_name ?? product.productName ?? "";
}

function getProductPrice(product) {
  return Number(product.sale_price ?? product.salePrice ?? 0);
}

function getProductUnit(product) {
  return product.sales_unit ?? product.salesUnit ?? product.unit ?? "PCS";
}

function getProductDescription(product) {
  return (
    product.sales_description ??
    product.salesDescription ??
    product.description ??
    ""
  );
}

function getProductLabel(product) {
  const sku = product.sku ?? "";
  const name = getProductName(product);
  return sku ? `${sku} - ${name}` : name;
}

function statusClass(status) {
  switch (status) {
    case "Approved":
      return "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300";
    case "Rejected":
      return "bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-300";
    case "Expired":
      return "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300";
    case "Converted":
      return "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300";
    default:
      return "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200";
  }
}

function toBoolean(value) {
  return (
    value === true ||
    value === 1 ||
    value === "1" ||
    String(value).toLowerCase() === "true"
  );
}

function calcLine(item) {
  const amount = (Number(item.quantity) || 0) * (Number(item.unitPrice) || 0);
  const taxAmount = (amount * (Number(item.taxRate) || 0)) / 100;

  return { amount, taxAmount, gross: amount + taxAmount };
}

/* =========================================================
   COLUMN DEFINITIONS
========================================================= */

const QUOTATION_HISTORY_COLUMNS = [
  { key: "quotation_number", label: "Transaction Number", width: 170 },
  { key: "customer", label: "Customer", width: 200 },
  { key: "quotation_date", label: "Quotation Date", width: 150 },
  { key: "expiry_date", label: "Expiry Date", width: 150 },
  { key: "gross_amount", label: "Gross Amount", width: 160 },
  { key: "status", label: "Status", width: 130 },
  { key: "actions", label: "Actions", width: 140 },
];

const QUOTATION_LINE_COLUMNS = [
  { key: "rowNumber", label: "#", width: 56 },
  { key: "itemName", label: "Item Name", width: 260 },
  { key: "itemDescription", label: "Item Description", width: 200 },
  { key: "itemBalance", label: "Item Balance", width: 130 },
  { key: "uom", label: "UOM", width: 110 },
  { key: "quantity", label: "Quantity", width: 130 },
  { key: "unitPrice", label: "Unit Price", width: 150 },
  { key: "amount", label: "Amount", width: 120 },
  { key: "taxCode", label: "Tax Code", width: 130 },
  { key: "taxRate", label: "Tax %", width: 110 },
  { key: "taxAmount", label: "Tax Amount", width: 120 },
  { key: "gross", label: "Gross", width: 130 },
  { key: "memo", label: "Memo", width: 170 },
  { key: "action", label: "Action", width: 80 },
];

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

function readColumns(storageKey) {
  try {
    return localStorage.getItem(storageKey) ?? "";
  } catch {
    return "";
  }
}

function writeColumns(storageKey, value) {
  try {
    localStorage.setItem(storageKey, JSON.stringify(value));
  } catch (error) {
    console.error("Unable to save column preferences:", error);
  }

  columnListeners.forEach((listener) => listener());
}

function parseColumns(raw, columns) {
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
    columns.map(({ key }) => [key, parsed[key] !== false])
  );

  if (!columns.some(({ key }) => visible[key])) {
    visible[columns[0].key] = true;
  }

  return visible;
}

function useColumnVisibility(storageKey, columns) {
  const raw = useSyncExternalStore(
    subscribeColumns,
    () => readColumns(storageKey),
    () => ""
  );

  const visible = useMemo(() => parseColumns(raw, columns), [raw, columns]);

  const visibleCount = columns.filter((column) => visible[column.key]).length;

  const minWidth = columns.reduce(
    (total, column) => total + (visible[column.key] ? column.width : 0),
    0
  );

  const toggle = useCallback(
    (key) => {
      const current = parseColumns(readColumns(storageKey), columns);
      const count = columns.filter((column) => current[column.key]).length;

      // The last visible column can't be hidden
      if (current[key] && count <= 1) return;

      writeColumns(storageKey, { ...current, [key]: !current[key] });
    },
    [storageKey, columns]
  );

  const showAll = useCallback(() => {
    writeColumns(
      storageKey,
      Object.fromEntries(columns.map(({ key }) => [key, true]))
    );
  }, [storageKey, columns]);

  return { visible, visibleCount, minWidth, toggle, showAll };
}

/* =========================================================
   ICONS
========================================================= */

function Icon({ name, className = "h-5 w-5" }) {
  const common = {
    className,
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.8,
    strokeLinecap: "round",
    strokeLinejoin: "round",
    viewBox: "0 0 24 24",
    "aria-hidden": true,
  };

  const paths = {
    plus: <><path d="M12 5v14M5 12h14" /></>,
    search: <><circle cx="11" cy="11" r="7" /><path d="m20 20-4-4" /></>,
    file: <><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><path d="M14 2v6h6M8 13h8M8 17h8" /></>,
    eye: <><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" /><circle cx="12" cy="12" r="3" /></>,
    edit: <><path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L8 18l-4 1 1-4Z" /></>,
    print: <><path d="M6 9V2h12v7M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" /><path d="M6 14h12v8H6z" /></>,
    back: <><path d="m15 18-6-6 6-6" /><path d="M9 12h12" /></>,
    copy: <><rect x="8" y="8" width="13" height="13" rx="2" /><path d="M16 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h3" /></>,
    trash: <><path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6M10 11v5M14 11v5" /></>,
    refresh: <><path d="M20 7v5h-5M4 17v-5h5" /><path d="M5.6 9A7 7 0 0 1 18 6l2 6M4 12l2 6a7 7 0 0 0 12.4-3" /></>,
    close: <><path d="m18 6-12 12M6 6l12 12" /></>,
    package: <><path d="m12 3 9 5-9 5-9-5 9-5Z" /><path d="M3 8v9l9 5 9-5V8M12 13v9" /></>,
    calendar: <><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M16 3v4M8 3v4M3 10h18" /></>,
    shield: <><path d="M12 22s8-4 8-11V5l-8-3-8 3v6c0 7 8 11 8 11Z" /><path d="m9 12 2 2 4-4" /></>,
    chevron: <><path d="m6 9 6 6 6-6" /></>,
  };

  return <svg {...common}>{paths[name] || paths.file}</svg>;
}

/* =========================================================
   SHARED UI
========================================================= */

function Field({ label, children, className = "" }) {
  return (
    <label className={`block min-w-0 ${className}`}>
      <span className="mb-1.5 block text-sm font-semibold text-slate-600 dark:text-slate-300">
        {label}
      </span>
      {children}
    </label>
  );
}

const inputClass =
  "w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 dark:border-slate-700 dark:bg-slate-900 dark:text-white dark:placeholder:text-slate-500";

const buttonPrimary =
  "inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50";

const buttonSecondary =
  "inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800";

function SummaryCard({ label, value, description, accent = "emerald" }) {
  const accents = {
    emerald: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
    blue: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
    violet: "bg-violet-500/10 text-violet-600 dark:text-violet-400",
  };

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-950">
      <div className="text-sm font-medium text-slate-500 dark:text-slate-400">
        {label}
      </div>

      <div className="mt-2 text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
        {value}
      </div>

      <div
        className={`mt-3 inline-flex rounded-lg px-2.5 py-1 text-xs font-semibold ${accents[accent]}`}
      >
        {description}
      </div>
    </div>
  );
}

function ColumnsMenu({ columns, state }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return undefined;

    const onPointer = (event) => {
      if (ref.current && !ref.current.contains(event.target)) setOpen(false);
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
        className={buttonSecondary}
      >
        <Icon name="eye" className="h-4 w-4" />
        Columns
        <span className="rounded-md bg-slate-100 px-1.5 py-0.5 text-[10px] font-bold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
          {state.visibleCount}/{columns.length}
        </span>
        <Icon
          name="chevron"
          className={`h-4 w-4 transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open && (
        <div className="absolute right-0 top-full z-[100] mt-2 w-72 max-w-[calc(100vw-2rem)] rounded-2xl border border-slate-200 bg-white p-3 shadow-2xl ring-1 ring-black/5 dark:border-slate-700 dark:bg-slate-900">
          <div className="mb-2 flex items-center justify-between gap-2 border-b border-slate-100 pb-3 dark:border-slate-800">
            <div>
              <p className="text-sm font-bold text-slate-800 dark:text-white">
                Table Columns
              </p>

              <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                {state.visibleCount} of {columns.length} visible
              </p>
            </div>

            <button
              type="button"
              onClick={state.showAll}
              className="shrink-0 rounded-lg px-2 py-1.5 text-xs font-semibold text-blue-600 transition hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-500/10"
            >
              Show All
            </button>
          </div>

          <div className="max-h-64 space-y-1 overflow-y-auto overscroll-contain pr-1">
            {columns.map((column) => {
              const checked = Boolean(state.visible[column.key]);
              const isLastVisible = checked && state.visibleCount === 1;

              return (
                <label
                  key={column.key}
                  aria-disabled={isLastVisible}
                  title={
                    isLastVisible
                      ? "At least one column must stay visible"
                      : undefined
                  }
                  className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition ${
                    isLastVisible
                      ? "cursor-default bg-blue-50 hover:bg-blue-100 dark:bg-blue-500/10 dark:hover:bg-blue-500/20"
                      : "cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => {
                      if (!isLastVisible) state.toggle(column.key);
                    }}
                    className="h-4 w-4 cursor-pointer accent-blue-600"
                  />

                  <span
                    className={`font-medium ${
                      isLastVisible
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

export default function SalesQuotationsPage() {
  const [view, setView] = useState("list");

  const [quotations, setQuotations] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [products, setProducts] = useState([]);
  const [warehouses, setWarehouses] = useState([]);

  const [form, setForm] = useState(emptyForm);
  const [activeTab, setActiveTab] = useState("lines");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  const [selectedQuotation, setSelectedQuotation] = useState(null);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  // Quick-add line bar
  const [quick, setQuick] = useState(EMPTY_QUICK);
  const [quickError, setQuickError] = useState("");
  const quickInputRef = useRef(null);

  // Column visibility (must stay above the early returns below)
  const historyCols = useColumnVisibility(
    "sales-quotations.history-columns",
    QUOTATION_HISTORY_COLUMNS
  );
  const lineCols = useColumnVisibility(
    "sales-quotations.line-columns",
    QUOTATION_LINE_COLUMNS
  );

  // ---------------------------------------------------------
  // SALES QUOTATIONS PERMISSIONS
  // ---------------------------------------------------------

  const [permissions, setPermissions] = useState({
    can_view: false,
    can_create: false,
    can_update: false,
    can_delete: false,
  });

  const [permissionsLoading, setPermissionsLoading] = useState(true);
  const [permissionsError, setPermissionsError] = useState("");

  const canView = permissions.can_view;
  const canCreate = permissions.can_create;
  const canUpdate = permissions.can_update;

  useEffect(() => {
    let active = true;
    let currentController = null;

    async function loadUserPermissions() {
      if (currentController) {
        currentController.abort();
      }

      const requestController = new AbortController();
      currentController = requestController;

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
          throw new Error(data.message || "Unable to load user permissions.");
        }

        const quotationPermission = data.permissions.find(
          (permission) =>
            String(permission.permission_key || "")
              .trim()
              .toLowerCase() === "sales_quotations"
        );

        if (active && !requestController.signal.aborted) {
          setPermissions({
            can_view: toBoolean(quotationPermission?.can_view),
            can_create: toBoolean(quotationPermission?.can_create),
            can_update: toBoolean(quotationPermission?.can_update),
            can_delete: toBoolean(quotationPermission?.can_delete),
          });

          setPermissionsError("");
        }
      } catch (permissionError) {
        if (permissionError.name === "AbortError") return;

        console.error("Sales quotation permissions error:", permissionError);

        if (active && !requestController.signal.aborted) {
          setPermissions({
            can_view: false,
            can_create: false,
            can_update: false,
            can_delete: false,
          });

          setPermissionsError(
            permissionError.message || "Unable to verify your permissions."
          );
        }
      } finally {
        if (active && !requestController.signal.aborted) {
          setPermissionsLoading(false);
        }
      }
    }

    loadUserPermissions();

    // Refresh permissions when User Rights are changed.
    function handlePermissionsUpdated() {
      loadUserPermissions();
    }

    window.addEventListener("erp-permissions-updated", handlePermissionsUpdated);

    return () => {
      active = false;

      if (currentController) {
        currentController.abort();
      }

      window.removeEventListener(
        "erp-permissions-updated",
        handlePermissionsUpdated
      );
    };
  }, []);

  const canSaveForm = form.quotationId ? canUpdate : canCreate;

  // ---------------------------------------------------------
  // TOTALS
  // ---------------------------------------------------------

  const totals = useMemo(() => {
    let subtotal = 0;
    let taxAmount = 0;

    for (const item of form.items) {
      const line = calcLine(item);
      subtotal += line.amount;
      taxAmount += line.taxAmount;
    }

    return {
      subtotal,
      taxAmount,
      grossAmount: subtotal + taxAmount,
    };
  }, [form.items]);

  // ---------------------------------------------------------
  // LOAD QUOTATIONS
  // ---------------------------------------------------------

  const loadQuotations = useCallback(async () => {
    if (!canView) {
      setQuotations([]);
      return;
    }

    const params = new URLSearchParams();

    if (search.trim()) {
      params.set("search", search.trim());
    }

    if (statusFilter) {
      params.set("status", statusFilter);
    }

    const response = await fetch(`/api/sales-quotations?${params.toString()}`, {
      cache: "no-store",
    });

    const data = await response.json();

    if (!response.ok || !data.success) {
      throw new Error(data.message || "Unable to load quotations.");
    }

    setQuotations(data.quotations || []);
  }, [search, statusFilter, canView]);

  // ---------------------------------------------------------
  // LOAD DROPDOWN OPTIONS
  // ---------------------------------------------------------

  const loadOptions = useCallback(async () => {
    const [customerResponse, productResponse, warehouseResponse] =
      await Promise.all([
        fetch("/api/customers", { cache: "no-store" }),
        fetch("/api/products", { cache: "no-store" }),
        fetch("/api/warehouses", { cache: "no-store" }),
      ]);

    const [customerData, productData, warehouseData] = await Promise.all([
      customerResponse.json(),
      productResponse.json(),
      warehouseResponse.json(),
    ]);

    if (!customerResponse.ok || !customerData.success) {
      throw new Error(customerData.message || "Unable to load customers.");
    }

    if (!productResponse.ok || !productData.success) {
      throw new Error(productData.message || "Unable to load products.");
    }

    if (!warehouseResponse.ok || !warehouseData.success) {
      throw new Error(warehouseData.message || "Unable to load warehouses.");
    }

    const customerRows = customerData.customers || [];
    const productRows = productData.products || [];
    const warehouseRows = warehouseData.warehouses || warehouseData.data || [];

    setCustomers(customerRows.filter((customer) => customer.is_active !== false));
    setProducts(productRows.filter((product) => product.is_active !== false));
    setWarehouses(
      warehouseRows.filter((warehouse) => warehouse.is_active !== false)
    );
  }, []);

  // ---------------------------------------------------------
  // REFRESH
  // ---------------------------------------------------------

  const reload = useCallback(async () => {
    if (!canView) {
      setError("You do not have permission to view quotations.");
      return;
    }

    setLoading(true);
    setError("");

    try {
      await Promise.all([loadQuotations(), loadOptions()]);
    } catch (loadError) {
      setError(loadError.message || "Unable to load the page.");
    } finally {
      setLoading(false);
    }
  }, [canView, loadOptions, loadQuotations]);

  // ---------------------------------------------------------
  // INITIAL DATA LOADING
  // ---------------------------------------------------------

  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (permissionsLoading) return;

      if (!canView) {
        setQuotations([]);
        setCustomers([]);
        setProducts([]);
        setWarehouses([]);
        setLoading(false);
        return;
      }

      setLoading(true);
      setError("");

      try {
        const params = new URLSearchParams();

        if (search.trim()) {
          params.set("search", search.trim());
        }

        if (statusFilter) {
          params.set("status", statusFilter);
        }

        const [
          quotationResponse,
          customerResponse,
          productResponse,
          warehouseResponse,
        ] = await Promise.all([
          fetch(`/api/sales-quotations?${params.toString()}`, {
            cache: "no-store",
          }),
          fetch("/api/customers", { cache: "no-store" }),
          fetch("/api/products", { cache: "no-store" }),
          fetch("/api/warehouses", { cache: "no-store" }),
        ]);

        const [quotationData, customerData, productData, warehouseData] =
          await Promise.all([
            quotationResponse.json(),
            customerResponse.json(),
            productResponse.json(),
            warehouseResponse.json(),
          ]);

        if (!quotationResponse.ok || !quotationData.success) {
          throw new Error(
            quotationData.message || "Unable to load quotations."
          );
        }

        if (!customerResponse.ok || !customerData.success) {
          throw new Error(customerData.message || "Unable to load customers.");
        }

        if (!productResponse.ok || !productData.success) {
          throw new Error(productData.message || "Unable to load products.");
        }

        if (!warehouseResponse.ok || !warehouseData.success) {
          throw new Error(
            warehouseData.message || "Unable to load warehouses."
          );
        }

        if (cancelled) return;

        setQuotations(quotationData.quotations || []);

        setCustomers(
          (customerData.customers || []).filter(
            (customer) => customer.is_active !== false
          )
        );

        setProducts(
          (productData.products || []).filter(
            (product) => product.is_active !== false
          )
        );

        const warehouseRows =
          warehouseData.warehouses || warehouseData.data || [];

        setWarehouses(
          warehouseRows.filter((warehouse) => warehouse.is_active !== false)
        );
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError.message || "Unable to load quotations.");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    load();

    return () => {
      cancelled = true;
    };
  }, [search, statusFilter, permissionsLoading, canView]);

  // ---------------------------------------------------------
  // FORM HELPERS
  // ---------------------------------------------------------

  function updateForm(field, value) {
    setForm((previous) => ({
      ...previous,
      [field]: value,
    }));
  }

  function updateItem(index, field, value) {
    setForm((previous) => ({
      ...previous,
      items: previous.items.map((item, itemIndex) =>
        itemIndex === index ? { ...item, [field]: value } : item
      ),
    }));
  }

  function selectProduct(index, productId) {
    const product = products.find(
      (item) => String(getProductId(item)) === String(productId)
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
              productId: String(getProductId(product)),
              itemName: getProductName(product),
              itemDescription: getProductDescription(product),
              uom: getProductUnit(product),
              unitPrice: getProductPrice(product),
            }
          : item
      ),
    }));
  }

  function removeLine(index) {
    setForm((previous) => ({
      ...previous,
      items: previous.items.filter((_, itemIndex) => itemIndex !== index),
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
        getProductLabel(product),
        product.sku,
        product.barcode,
        getProductName(product),
      ].some((value) => String(value || "").toLowerCase() === query)
    );

    if (exact || exactOnly) return exact || null;

    // Otherwise accept a partial match only if exactly one product matches
    const matches = products.filter((product) =>
      [product.sku, product.barcode, getProductName(product)].some((value) =>
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
        next.unitPrice = getProductPrice(product);
      }

      return next;
    });
  }

  function addQuickItem() {
    setQuickError("");

    const text = quick.search.trim();

    if (!text) {
      setQuickError("Enter or select a product first.");
      return;
    }

    const quantity = Number(quick.quantity);
    const unitPrice = Number(quick.unitPrice);
    const taxRate = Number(quick.taxRate) || 0;

    if (!Number.isFinite(quantity) || quantity <= 0) {
      setQuickError("Quantity must be greater than zero.");
      return;
    }

    if (!Number.isFinite(unitPrice) || unitPrice < 0) {
      setQuickError("Unit price cannot be negative.");
      return;
    }

    if (taxRate < 0 || taxRate > 100) {
      setQuickError("Tax % must be between 0 and 100.");
      return;
    }

    // A catalogue product if one matches; otherwise a free-text item name.
    const product = findProductByInput(text);

    setForm((previous) => ({
      ...previous,
      items: [
        ...previous.items,
        {
          ...emptyItem(),
          productId: product ? String(getProductId(product)) : "",
          itemName: product ? getProductName(product) : text,
          itemDescription: product ? getProductDescription(product) : "",
          uom: product ? getProductUnit(product) : "PCS",
          quantity,
          unitPrice,
          taxRate,
        },
      ],
    }));

    resetQuick();
    quickInputRef.current?.focus();
  }

  function handleQuickKeyDown(event) {
    if (event.key === "Enter") {
      event.preventDefault(); // stop Enter from submitting the quotation form
      addQuickItem();
    }
  }

  // ---------------------------------------------------------
  // CREATE QUOTATION
  // ---------------------------------------------------------

  function createQuotation() {
    if (!canCreate) {
      setError("You do not have permission to create quotations.");
      return;
    }

    setError("");
    setNotice("");
    setSelectedQuotation(null);
    setForm(emptyForm());
    resetQuick();
    setActiveTab("lines");
    setView("form");
  }

  // ---------------------------------------------------------
  // EDIT QUOTATION
  // ---------------------------------------------------------

  function editQuotation(quotation) {
    if (!canUpdate) {
      setError("You do not have permission to edit quotations.");
      return;
    }

    setError("");
    setNotice("");
    setSelectedQuotation(quotation);
    resetQuick();

    setForm({
      ...emptyForm(),

      quotationId: quotation.quotation_id,
      quotationNumber: quotation.quotation_number,

      customerId: quotation.customer_id ? String(quotation.customer_id) : "",
      warehouseId: quotation.warehouse_id ? String(quotation.warehouse_id) : "",

      quotationDate: String(quotation.quotation_date || "").slice(0, 10),

      expiryDate: quotation.expiry_date
        ? String(quotation.expiry_date).slice(0, 10)
        : "",

      status: quotation.status || "Draft",
      department: quotation.department || "",
      project: quotation.project || "",
      quotationClass: quotation.quotation_class || "",
      salesRep: quotation.sales_rep || "",
      paymentTerm: quotation.payment_term || "",
      memo: quotation.memo || "",
      termsConditions: quotation.terms_conditions || "",
      relatedTransaction: quotation.related_transaction || "",
      attachmentName: quotation.attachment_name || "",
      attachmentUrl: quotation.attachment_url || "",

      items: (quotation.items || []).map((item) => ({
        productId: item.product_id ? String(item.product_id) : "",
        itemName: item.item_name || "",
        itemDescription: item.item_description || "",
        itemBalance: Number(item.item_balance || 0),
        uom: item.uom || "PCS",
        quantity: Number(item.quantity || 1),
        unitPrice: Number(item.unit_price || 0),
        taxCode: item.tax_code || "",
        taxRate: Number(item.tax_rate || 0),
        memo: item.memo || "",
      })),
    });

    setActiveTab("lines");
    setView("form");
  }

  // ---------------------------------------------------------
  // VIEW QUOTATION
  // ---------------------------------------------------------

  async function viewQuotation(quotationId) {
    if (!canView) {
      setError("You do not have permission to view quotations.");
      return;
    }

    setLoading(true);
    setError("");
    setNotice("");

    try {
      const response = await fetch(`/api/sales-quotations/${quotationId}`, {
        cache: "no-store",
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.message || "Unable to open quotation.");
      }

      setSelectedQuotation(data.quotation);
      setView("detail");
    } catch (viewError) {
      setError(viewError.message || "Unable to open quotation.");
    } finally {
      setLoading(false);
    }
  }

  // ---------------------------------------------------------
  // SAVE QUOTATION
  // ---------------------------------------------------------

  async function saveQuotation(event) {
    event.preventDefault();

    if (!canSaveForm) {
      setError(
        form.quotationId
          ? "You do not have permission to update quotations."
          : "You do not have permission to create quotations."
      );
      return;
    }

    setError("");
    setNotice("");

    if (!form.customerId) {
      setError("Please select a customer.");
      return;
    }

    if (!form.items.length) {
      setError("Please add at least one transaction line.");
      setActiveTab("lines");
      return;
    }

    if (form.items.some((item) => !String(item.itemName).trim())) {
      setError("Every transaction line needs an item name.");
      setActiveTab("lines");
      return;
    }

    setSaving(true);

    try {
      const payload = {
        ...form,

        customerId: form.customerId || null,
        warehouseId: form.warehouseId || null,

        items: form.items.map((item) => ({
          ...item,
          productId: item.productId || null,
          quantity: Number(item.quantity),
          unitPrice: Number(item.unitPrice),
          taxRate: Number(item.taxRate || 0),
          itemBalance: Number(item.itemBalance || 0),
        })),
      };

      const isEditing = Boolean(form.quotationId);

      const response = await fetch(
        isEditing
          ? `/api/sales-quotations/${form.quotationId}`
          : "/api/sales-quotations",
        {
          method: isEditing ? "PUT" : "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        }
      );

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.message || "Unable to save quotation.");
      }

      const quotationId = isEditing
        ? form.quotationId
        : data.quotation.quotationId;

      setNotice(data.message || "Quotation saved successfully.");

      await loadQuotations();

      await viewQuotation(quotationId);

      setNotice(data.message || "Quotation saved successfully.");
    } catch (saveError) {
      setError(saveError.message || "Unable to save quotation.");
    } finally {
      setSaving(false);
    }
  }

  // ---------------------------------------------------------
  // COPY QUOTATION
  // ---------------------------------------------------------

  async function copyQuotation(quotation) {
    if (!canCreate) {
      setError("You do not have permission to create quotations.");
      return;
    }

    const items = (quotation.items || []).map((item) => ({
      productId: item.product_id ? String(item.product_id) : "",
      itemName: item.item_name || "",
      itemDescription: item.item_description || "",
      itemBalance: Number(item.item_balance || 0),
      uom: item.uom || "PCS",
      quantity: Number(item.quantity || 1),
      unitPrice: Number(item.unit_price || 0),
      taxCode: item.tax_code || "",
      taxRate: Number(item.tax_rate || 0),
      memo: item.memo || "",
    }));

    setSelectedQuotation(null);
    resetQuick();

    setForm({
      ...emptyForm(),

      customerId: quotation.customer_id ? String(quotation.customer_id) : "",
      warehouseId: quotation.warehouse_id ? String(quotation.warehouse_id) : "",

      quotationDate: today(),
      expiryDate: "",
      status: "Draft",
      department: quotation.department || "",
      project: quotation.project || "",
      quotationClass: quotation.quotation_class || "",
      salesRep: quotation.sales_rep || "",
      paymentTerm: quotation.payment_term || "",
      memo: quotation.memo || "",
      termsConditions: quotation.terms_conditions || "",

      items,
    });

    setError("");
    setNotice("A new draft has been prepared from the selected quotation.");

    setActiveTab("lines");
    setView("form");
  }

  // ---------------------------------------------------------
  // PRINT QUOTATION
  // ---------------------------------------------------------

  function printQuotation() {
    if (!canView) {
      setError("You do not have permission to view quotation reports.");
      return;
    }

    const report = document.getElementById("quotation-report");

    if (!report) {
      alert("Quotation report could not be found.");
      return;
    }

    const printWindow = window.open("", "_blank", "width=1100,height=800");

    if (!printWindow) {
      alert("Please allow pop-ups for this website, then try printing again.");
      return;
    }

    const reportHtml = report.outerHTML;

    printWindow.document.open();

    printWindow.document.write(`
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">

        <title>Sales Quotation Report</title>

        <style>
          @page {
            size: A4 landscape;
            margin: 10mm;
          }

          * {
            box-sizing: border-box;
          }

          html,
          body {
            width: 100%;
            margin: 0;
            padding: 0;
            background: #ffffff;
            color: #111827;
            font-family: Arial, Helvetica, sans-serif;
            font-size: 10px;
            line-height: 1.4;
          }

          body {
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }

          #quotation-report {
            display: block;
            width: 100%;
            max-width: 100%;
            margin: 0;
            padding: 0;
            border: none;
            border-radius: 0;
            box-shadow: none;
            background: #ffffff;
            color: #111827;
          }

          #quotation-report > div:first-child {
            display: flex;
            flex-direction: row;
            justify-content: space-between;
            align-items: flex-start;
            gap: 20px;
            padding-bottom: 12px;
            border-bottom: 1px solid #d1d5db;
          }

          #quotation-report .grid {
            display: grid;
            grid-template-columns: repeat(3, minmax(0, 1fr));
            gap: 12px 20px;
          }

          #quotation-report .border-y {
            margin-top: 14px;
            padding-top: 12px;
            padding-bottom: 12px;
            border-top: 1px solid #d1d5db;
            border-bottom: 1px solid #d1d5db;
          }

          #quotation-report .border-x {
            border-left: 1px solid #d1d5db;
            border-right: 1px solid #d1d5db;
          }

          #quotation-report .text-xs {
            font-size: 9px;
          }

          #quotation-report .text-sm {
            font-size: 10px;
          }

          #quotation-report .text-base {
            font-size: 12px;
          }

          #quotation-report .text-3xl {
            font-size: 22px;
          }

          #quotation-report .text-2xl {
            font-size: 18px;
          }

          #quotation-report .font-bold {
            font-weight: 700;
          }

          #quotation-report .font-semibold {
            font-weight: 600;
          }

          #quotation-report .text-slate-500 {
            color: #475569;
          }

          #quotation-report .text-emerald-600,
          #quotation-report .text-emerald-700 {
            color: #047857;
          }

          #quotation-report .text-white {
            color: #111827;
          }

          #quotation-report .mt-1 {
            margin-top: 3px;
          }

          #quotation-report .mt-2 {
            margin-top: 5px;
          }

          #quotation-report .mt-3 {
            margin-top: 7px;
          }

          #quotation-report .space-y-6 > * + * {
            margin-top: 14px;
          }

          #quotation-report .rounded-full {
            border-radius: 999px;
          }

          #quotation-report .px-3 {
            padding-left: 8px;
            padding-right: 8px;
          }

          #quotation-report .py-1 {
            padding-top: 3px;
            padding-bottom: 3px;
          }

          #quotation-report .break-words {
            overflow-wrap: anywhere;
          }

          button,
          input,
          select,
          textarea {
            display: none !important;
          }

          @media print {
            html,
            body {
              width: 100%;
              height: auto;
              margin: 0;
              padding: 0;
              overflow: visible;
            }

            #quotation-report {
              page-break-before: avoid;
              break-before: avoid-page;
            }

            #quotation-report > div,
            #quotation-report .grid {
              break-inside: avoid;
              page-break-inside: avoid;
            }
          }
        </style>
      </head>

      <body>
        ${reportHtml}

        <script>
          window.onload = function () {
            window.focus();

            setTimeout(function () {
              window.print();
            }, 300);
          };

          window.onafterprint = function () {
            window.close();
          };
        <\/script>
      </body>
      </html>
    `);

    printWindow.document.close();
  }

  // ---------------------------------------------------------
  // SUMMARY COUNTS
  // ---------------------------------------------------------

  const counts = useMemo(() => {
    return {
      total: quotations.length,

      draft: quotations.filter((quotation) => quotation.status === "Draft")
        .length,

      approved: quotations.filter(
        (quotation) => quotation.status === "Approved"
      ).length,

      value: quotations.reduce(
        (sum, quotation) => sum + Number(quotation.gross_amount || 0),
        0
      ),
    };
  }, [quotations]);

  // ---------------------------------------------------------
  // PERMISSION LOADING SCREEN
  // ---------------------------------------------------------

  if (permissionsLoading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4 dark:bg-slate-950">
        <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">
            <Icon name="shield" className="h-7 w-7" />
          </div>

          <h2 className="mt-5 text-lg font-bold text-slate-900 dark:text-white">
            Checking Permissions
          </h2>

          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
            Verifying your access to Sales Quotations...
          </p>

          <div className="mx-auto mt-5 h-1.5 w-40 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
            <div className="h-full w-1/2 animate-pulse rounded-full bg-emerald-600" />
          </div>
        </div>
      </main>
    );
  }

  // ---------------------------------------------------------
  // ACCESS DENIED SCREEN
  // ---------------------------------------------------------

  if (!canView) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-8 dark:bg-slate-950">
        <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-rose-100 text-rose-600 dark:bg-rose-900/30 dark:text-rose-400">
            <Icon name="shield" className="h-8 w-8" />
          </div>

          <h1 className="mt-5 text-2xl font-bold text-slate-900 dark:text-white">
            Access Denied
          </h1>

          <p className="mt-3 text-sm leading-6 text-slate-500 dark:text-slate-400">
            You do not have permission to view the Sales Quotations module.
            Please contact your administrator if you need access.
          </p>

          {permissionsError && (
            <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-left text-sm text-rose-700 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-300">
              {permissionsError}
            </div>
          )}

          <button
            type="button"
            onClick={() => window.location.reload()}
            className={`${buttonPrimary} mt-6`}
          >
            <Icon name="refresh" className="h-4 w-4" />
            Retry Permission Check
          </button>
        </div>
      </main>
    );
  }

  const hc = historyCols.visible;
  const lc = lineCols.visible;

  // ---------------------------------------------------------
  // MAIN PAGE
  // ---------------------------------------------------------

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-6 text-slate-900 dark:bg-slate-950 dark:text-white sm:px-6 lg:px-8">
      <div className="mx-auto max-w-[1600px] space-y-6">
        {/* PAGE HEADER */}

        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center print:hidden">
          <div>
            <div className="mb-2 flex items-center gap-2 text-sm font-medium text-emerald-600 dark:text-emerald-400">
              <span className="h-2 w-2 rounded-full bg-emerald-500" />
              Sales Management
            </div>

            <h1 className="text-3xl font-bold tracking-tight">
              {view === "list"
                ? "Sales Quotations"
                : view === "form"
                  ? form.quotationId
                    ? "Edit Quotation"
                    : "Create Quotation"
                  : "Quotation Details"}
            </h1>

            <p className="mt-2 max-w-2xl text-sm text-slate-500 dark:text-slate-400">
              Manage customer quotations, transaction lines, terms, and
              printable reports.
            </p>
          </div>

          {view === "list" ? (
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={reload}
                disabled={loading}
                className={buttonSecondary}
              >
                <Icon name="refresh" />
                Refresh
              </button>

              {canCreate && (
                <button
                  type="button"
                  onClick={createQuotation}
                  className={buttonPrimary}
                >
                  <Icon name="plus" />
                  Create Quotation
                </button>
              )}
            </div>
          ) : (
            <button
              type="button"
              onClick={() => {
                setError("");
                setNotice("");
                setView("list");
              }}
              className={buttonSecondary}
            >
              <Icon name="back" />
              Back to History
            </button>
          )}
        </div>

        {/* ERROR MESSAGE */}

        {error && (
          <div className="flex items-start justify-between gap-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-200">
            <span>{error}</span>

            <button
              type="button"
              onClick={() => setError("")}
              aria-label="Dismiss error"
            >
              <Icon name="close" className="h-4 w-4" />
            </button>
          </div>
        )}

        {/* SUCCESS MESSAGE */}

        {notice && (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200 print:hidden">
            {notice}
          </div>
        )}

        {/* ================================================= */}
        {/* QUOTATION HISTORY */}
        {/* ================================================= */}

        {view === "list" && (
          <>
            <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <SummaryCard
                label="Total Quotations"
                value={counts.total}
                description="Matching records"
                accent="emerald"
              />

              <SummaryCard
                label="Draft Quotations"
                value={counts.draft}
                description="Awaiting processing"
                accent="blue"
              />

              <SummaryCard
                label="Approved Quotations"
                value={counts.approved}
                description="Approved records"
                accent="violet"
              />

              <SummaryCard
                label="Quotation Value"
                value={`Rs ${money(counts.value)}`}
                description="Current filtered results"
                accent="emerald"
              />
            </section>

            {/* No overflow-hidden here, so the Columns dropdown is never clipped */}
            <section className="rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-950">
              <div className="flex flex-col gap-4 rounded-t-2xl border-b border-slate-200 p-5 dark:border-slate-800 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <h2 className="text-lg font-bold">Quotation History</h2>

                  <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                    View, edit, copy, and print saved quotations.
                  </p>
                </div>

                <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                  <div className="relative">
                    <Icon
                      name="search"
                      className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
                    />

                    <input
                      value={search}
                      onChange={(event) => setSearch(event.target.value)}
                      placeholder="Search quotation or customer..."
                      className={`${inputClass} pl-9 sm:w-72`}
                    />
                  </div>

                  <select
                    value={statusFilter}
                    onChange={(event) => setStatusFilter(event.target.value)}
                    className={inputClass}
                  >
                    <option value="">All Statuses</option>
                    <option value="Draft">Draft</option>
                    <option value="Approved">Approved</option>
                    <option value="Rejected">Rejected</option>
                    <option value="Expired">Expired</option>
                    <option value="Converted">Converted</option>
                  </select>

                  <ColumnsMenu
                    columns={QUOTATION_HISTORY_COLUMNS}
                    state={historyCols}
                  />
                </div>
              </div>

              {loading ? (
                <div className="p-12 text-center text-sm text-slate-500">
                  Loading quotations...
                </div>
              ) : quotations.length === 0 ? (
                <div className="px-6 py-16 text-center">
                  <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400">
                    <Icon name="file" className="h-8 w-8" />
                  </div>

                  <h3 className="mt-4 text-lg font-bold">
                    No quotations found
                  </h3>

                  <p className="mx-auto mt-2 max-w-md text-sm text-slate-500 dark:text-slate-400">
                    Create your first quotation, or change the search and
                    status filters.
                  </p>

                  {canCreate && (
                    <button
                      type="button"
                      onClick={createQuotation}
                      className={`${buttonPrimary} mt-5`}
                    >
                      <Icon name="plus" />
                      Create Quotation
                    </button>
                  )}
                </div>
              ) : (
                /* The scrollbar appears only when the visible columns are
                   wider than the container. */
                <div className="w-full overflow-x-auto [scrollbar-width:thin]">
                  <table
                    style={{ minWidth: `${historyCols.minWidth}px` }}
                    className="w-full text-left text-sm"
                  >
                    <thead className="bg-slate-50 text-xs uppercase tracking-wider text-slate-500 dark:bg-slate-900/70 dark:text-slate-400">
                      <tr>
                        {hc.quotation_number && (
                          <th className="whitespace-nowrap px-5 py-4">
                            Transaction Number
                          </th>
                        )}

                        {hc.customer && (
                          <th className="whitespace-nowrap px-5 py-4">
                            Customer
                          </th>
                        )}

                        {hc.quotation_date && (
                          <th className="whitespace-nowrap px-5 py-4">
                            Quotation Date
                          </th>
                        )}

                        {hc.expiry_date && (
                          <th className="whitespace-nowrap px-5 py-4">
                            Expiry Date
                          </th>
                        )}

                        {hc.gross_amount && (
                          <th className="whitespace-nowrap px-5 py-4 text-right">
                            Gross Amount
                          </th>
                        )}

                        {hc.status && (
                          <th className="whitespace-nowrap px-5 py-4">
                            Status
                          </th>
                        )}

                        {hc.actions && (
                          <th className="whitespace-nowrap px-5 py-4 text-right">
                            Actions
                          </th>
                        )}
                      </tr>
                    </thead>

                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {quotations.map((quotation) => (
                        <tr
                          key={quotation.quotation_id}
                          className="transition hover:bg-slate-50 dark:hover:bg-slate-900/60"
                        >
                          {hc.quotation_number && (
                            <td className="whitespace-nowrap px-5 py-4">
                              <button
                                type="button"
                                onClick={() =>
                                  viewQuotation(quotation.quotation_id)
                                }
                                className="font-bold text-emerald-700 hover:underline dark:text-emerald-400"
                              >
                                {quotation.quotation_number}
                              </button>
                            </td>
                          )}

                          {hc.customer && (
                            <td className="px-5 py-4">
                              <div className="font-semibold">
                                {quotation.customer_name || "No customer"}
                              </div>

                              <div className="mt-1 text-xs text-slate-500">
                                {quotation.warehouse_name || "No warehouse"}
                              </div>
                            </td>
                          )}

                          {hc.quotation_date && (
                            <td className="whitespace-nowrap px-5 py-4 text-slate-600 dark:text-slate-300">
                              {dateDisplay(quotation.quotation_date)}
                            </td>
                          )}

                          {hc.expiry_date && (
                            <td className="whitespace-nowrap px-5 py-4 text-slate-600 dark:text-slate-300">
                              {dateDisplay(quotation.expiry_date)}
                            </td>
                          )}

                          {hc.gross_amount && (
                            <td className="whitespace-nowrap px-5 py-4 text-right font-bold">
                              Rs {money(quotation.gross_amount)}
                            </td>
                          )}

                          {hc.status && (
                            <td className="whitespace-nowrap px-5 py-4">
                              <span
                                className={`inline-flex rounded-full px-3 py-1 text-xs font-bold ${statusClass(quotation.status)}`}
                              >
                                {quotation.status}
                              </span>
                            </td>
                          )}

                          {hc.actions && (
                            <td className="whitespace-nowrap px-5 py-4">
                              <div className="flex justify-end gap-1">
                                {canView && (
                                  <button
                                    type="button"
                                    title="View quotation"
                                    onClick={() =>
                                      viewQuotation(quotation.quotation_id)
                                    }
                                    className="rounded-lg p-2 text-slate-500 hover:bg-blue-50 hover:text-blue-600 dark:hover:bg-blue-900/30"
                                  >
                                    <Icon name="eye" className="h-4 w-4" />
                                  </button>
                                )}

                                {canUpdate &&
                                  quotation.status !== "Converted" && (
                                    <button
                                      type="button"
                                      title="Edit quotation"
                                      onClick={async () => {
                                        setLoading(true);
                                        setError("");

                                        try {
                                          const response = await fetch(
                                            `/api/sales-quotations/${quotation.quotation_id}`,
                                            { cache: "no-store" }
                                          );

                                          const data = await response.json();

                                          if (!response.ok || !data.success) {
                                            throw new Error(
                                              data.message ||
                                                "Unable to load quotation."
                                            );
                                          }

                                          editQuotation(data.quotation);
                                        } catch (editError) {
                                          setError(
                                            editError.message ||
                                              "Unable to edit quotation."
                                          );
                                        } finally {
                                          setLoading(false);
                                        }
                                      }}
                                      className="rounded-lg p-2 text-slate-500 hover:bg-emerald-50 hover:text-emerald-600 dark:hover:bg-emerald-900/30"
                                    >
                                      <Icon name="edit" className="h-4 w-4" />
                                    </button>
                                  )}

                                {canView && (
                                  <button
                                    type="button"
                                    title="Open report"
                                    onClick={() =>
                                      viewQuotation(quotation.quotation_id)
                                    }
                                    className="rounded-lg p-2 text-slate-500 hover:bg-violet-50 hover:text-violet-600 dark:hover:bg-violet-900/30"
                                  >
                                    <Icon name="print" className="h-4 w-4" />
                                  </button>
                                )}
                              </div>
                            </td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              <div className="flex flex-col gap-2 rounded-b-2xl border-t border-slate-200 px-5 py-4 text-xs text-slate-500 dark:border-slate-800 sm:flex-row sm:items-center sm:justify-between">
                <span>Showing {quotations.length} quotation(s)</span>

                <span>Amounts are displayed in PKR.</span>
              </div>
            </section>
          </>
        )}

        {/* ================================================= */}
        {/* CREATE / EDIT FORM */}
        {/* ================================================= */}

        {view === "form" && (
          <form
            onSubmit={saveQuotation}
            onKeyDown={(event) => {
              // Pressing Enter inside a text field must never save the quotation
              if (event.key === "Enter" && event.target.tagName === "INPUT") {
                event.preventDefault();
              }
            }}
            className="space-y-6 print:hidden"
          >
            {/* QUOTATION INFORMATION */}

            <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-950 sm:p-6">
              <div className="mb-6 flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
                <div>
                  <h2 className="text-lg font-bold">Quotation Information</h2>

                  <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                    Enter the customer, dates, and transaction details.
                  </p>
                </div>

                <div className="rounded-xl bg-emerald-50 px-4 py-3 dark:bg-emerald-900/20">
                  <div className="text-xs font-semibold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
                    Transaction Number
                  </div>

                  <div className="mt-1 font-bold text-emerald-800 dark:text-emerald-300">
                    {form.quotationNumber || "Generated on save"}
                  </div>
                </div>
              </div>

              <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
                <Field label="Quotation Date *">
                  <input
                    type="date"
                    required
                    value={form.quotationDate}
                    onChange={(event) =>
                      updateForm("quotationDate", event.target.value)
                    }
                    className={inputClass}
                  />
                </Field>

                <Field label="Quotation End Date">
                  <input
                    type="date"
                    min={form.quotationDate}
                    value={form.expiryDate}
                    onChange={(event) =>
                      updateForm("expiryDate", event.target.value)
                    }
                    className={inputClass}
                  />
                </Field>

                <Field label="Status">
                  <select
                    value={form.status}
                    onChange={(event) =>
                      updateForm("status", event.target.value)
                    }
                    className={inputClass}
                  >
                    <option value="Draft">Draft</option>
                    <option value="Approved">Approved</option>
                    <option value="Rejected">Rejected</option>
                    <option value="Expired">Expired</option>
                  </select>
                </Field>

                <Field label="Customer *">
                  <select
                    required
                    value={form.customerId}
                    onChange={(event) =>
                      updateForm("customerId", event.target.value)
                    }
                    className={inputClass}
                  >
                    <option value="">Select customer</option>

                    {customers.map((customer) => (
                      <option
                        key={customer.customer_id}
                        value={customer.customer_id}
                      >
                        {customer.customer_name}
                      </option>
                    ))}
                  </select>
                </Field>

                <Field label="From Location / Warehouse">
                  <select
                    value={form.warehouseId}
                    onChange={(event) =>
                      updateForm("warehouseId", event.target.value)
                    }
                    className={inputClass}
                  >
                    <option value="">Select warehouse</option>

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

                <Field label="Payment Term">
                  <input
                    value={form.paymentTerm}
                    onChange={(event) =>
                      updateForm("paymentTerm", event.target.value)
                    }
                    placeholder="e.g. Net 30, Net 90"
                    className={inputClass}
                  />
                </Field>

                <Field label="Department">
                  <input
                    value={form.department}
                    onChange={(event) =>
                      updateForm("department", event.target.value)
                    }
                    placeholder="Department"
                    className={inputClass}
                  />
                </Field>

                <Field label="Project">
                  <input
                    value={form.project}
                    onChange={(event) =>
                      updateForm("project", event.target.value)
                    }
                    placeholder="Project name"
                    className={inputClass}
                  />
                </Field>

                <Field label="Class">
                  <input
                    value={form.quotationClass}
                    onChange={(event) =>
                      updateForm("quotationClass", event.target.value)
                    }
                    placeholder="Class"
                    className={inputClass}
                  />
                </Field>

                <Field label="Sales Representative">
                  <input
                    value={form.salesRep}
                    onChange={(event) =>
                      updateForm("salesRep", event.target.value)
                    }
                    placeholder="Sales representative"
                    className={inputClass}
                  />
                </Field>

                <Field label="Memo" className="sm:col-span-2 xl:col-span-2">
                  <input
                    value={form.memo}
                    onChange={(event) => updateForm("memo", event.target.value)}
                    placeholder="Additional quotation notes"
                    className={inputClass}
                  />
                </Field>
              </div>
            </section>

            {/* FORM TABS
                (no overflow-hidden, so the Columns dropdown is never clipped) */}

            <section className="rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-950">
              <div className="flex flex-wrap gap-2 rounded-t-2xl border-b border-slate-200 p-3 dark:border-slate-800">
                {[
                  ["lines", "Transaction Lines"],
                  ["terms", "Terms & Conditions"],
                  ["related", "Related Transactions"],
                  ["system", "System Information"],
                  ["attachment", "Attachment"],
                ].map(([key, label]) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setActiveTab(key)}
                    className={`rounded-xl px-4 py-2.5 text-sm font-semibold transition ${
                      activeTab === key
                        ? "bg-emerald-600 text-white"
                        : "text-slate-500 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>

              {/* TRANSACTION LINES */}

              {activeTab === "lines" && (
                <>
                  <div className="p-5 pb-0">
                    <h3 className="font-bold">Transaction Lines</h3>

                    <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                      Type or scan a product, then press Enter or click Add.
                    </p>
                  </div>

                  {/* QUICK ADD BAR */}
                  <div className="mx-5 mt-4 rounded-2xl border border-indigo-100 bg-indigo-50/50 p-4 dark:border-indigo-900/60 dark:bg-indigo-950/20">
                    <div className="grid grid-cols-2 gap-3 lg:grid-cols-[minmax(220px,2.2fr)_repeat(3,minmax(90px,1fr))_minmax(110px,1fr)_auto] lg:items-end">
                      <div className="col-span-2 lg:col-span-1">
                        <span className="mb-1.5 block text-sm font-semibold text-slate-700 dark:text-slate-200">
                          Product
                        </span>
                        <input
                          ref={quickInputRef}
                          list="quick-product-list"
                          value={quick.search}
                          onChange={(event) =>
                            handleQuickProductChange(event.target.value)
                          }
                          onKeyDown={handleQuickKeyDown}
                          placeholder="Search or scan SKU, barcode or name..."
                          autoComplete="off"
                          className={inputClass}
                        />

                        <datalist id="quick-product-list">
                          {products.map((product) => (
                            <option
                              key={getProductId(product)}
                              value={getProductLabel(product)}
                            />
                          ))}
                        </datalist>
                      </div>

                      <div>
                        <span className="mb-1.5 block text-sm font-semibold text-slate-700 dark:text-slate-200">
                          Quantity
                        </span>
                        <input
                          type="number"
                          min="0.0001"
                          step="0.0001"
                          value={quick.quantity}
                          onChange={(event) =>
                            setQuickField("quantity", event.target.value)
                          }
                          onKeyDown={handleQuickKeyDown}
                          className={inputClass}
                        />
                      </div>

                      <div>
                        <span className="mb-1.5 block text-sm font-semibold text-slate-700 dark:text-slate-200">
                          Unit Price
                        </span>
                        <input
                          type="number"
                          min="0"
                          step="0.0001"
                          value={quick.unitPrice}
                          onChange={(event) =>
                            setQuickField("unitPrice", event.target.value)
                          }
                          onKeyDown={handleQuickKeyDown}
                          className={inputClass}
                        />
                      </div>

                      <div>
                        <span className="mb-1.5 block text-sm font-semibold text-slate-700 dark:text-slate-200">
                          Tax %
                        </span>
                        <input
                          type="number"
                          min="0"
                          max="100"
                          step="0.01"
                          value={quick.taxRate}
                          onChange={(event) =>
                            setQuickField("taxRate", event.target.value)
                          }
                          onKeyDown={handleQuickKeyDown}
                          className={inputClass}
                        />
                      </div>

                      <div>
                        <span className="mb-1.5 block text-sm font-semibold text-slate-700 dark:text-slate-200">
                          Line Total
                        </span>
                        <div className="flex h-[42px] items-center justify-end rounded-xl border border-slate-200 bg-slate-100 px-3 text-sm font-bold tabular-nums text-slate-800 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100">
                          {money(
                            calcLine({
                              quantity: quick.quantity,
                              unitPrice: quick.unitPrice,
                              taxRate: quick.taxRate,
                            }).gross
                          )}
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={addQuickItem}
                        className="col-span-2 inline-flex h-[42px] items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 lg:col-span-1"
                      >
                        <Icon name="plus" className="h-4 w-4" />
                        Add
                      </button>
                    </div>

                    {quickError && (
                      <p className="mt-3 text-sm font-medium text-red-600 dark:text-red-400">
                        {quickError}
                      </p>
                    )}
                  </div>

                  {/* LINES TOOLBAR */}
                  <div className="mx-5 mb-3 mt-4 flex items-center justify-between gap-3">
                    <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                      {form.items.length} line
                      {form.items.length === 1 ? "" : "s"} added
                    </p>

                    <ColumnsMenu
                      columns={QUOTATION_LINE_COLUMNS}
                      state={lineCols}
                    />
                  </div>

                  {/* The scrollbar appears only when the visible columns are
                      wider than the container. */}
                  <div className="mx-5 mb-5 w-full max-w-[calc(100%-2.5rem)] overflow-x-auto rounded-2xl border border-slate-200 [scrollbar-width:thin] dark:border-slate-700">
                    <table
                      style={{ minWidth: `${lineCols.minWidth}px` }}
                      className="w-full text-left text-sm"
                    >
                      <thead className="bg-slate-50 text-xs font-bold uppercase tracking-wider text-slate-500 dark:bg-slate-900 dark:text-slate-400">
                        <tr>
                          {lc.rowNumber && (
                            <th className="px-3 py-3">#</th>
                          )}
                          {lc.itemName && (
                            <th className="whitespace-nowrap px-3 py-3">
                              Item Name
                            </th>
                          )}
                          {lc.itemDescription && (
                            <th className="whitespace-nowrap px-3 py-3">
                              Item Description
                            </th>
                          )}
                          {lc.itemBalance && (
                            <th className="whitespace-nowrap px-3 py-3">
                              Item Balance
                            </th>
                          )}
                          {lc.uom && (
                            <th className="whitespace-nowrap px-3 py-3">UOM</th>
                          )}
                          {lc.quantity && (
                            <th className="whitespace-nowrap px-3 py-3">
                              Quantity
                            </th>
                          )}
                          {lc.unitPrice && (
                            <th className="whitespace-nowrap px-3 py-3">
                              Unit Price
                            </th>
                          )}
                          {lc.amount && (
                            <th className="whitespace-nowrap px-3 py-3">
                              Amount
                            </th>
                          )}
                          {lc.taxCode && (
                            <th className="whitespace-nowrap px-3 py-3">
                              Tax Code
                            </th>
                          )}
                          {lc.taxRate && (
                            <th className="whitespace-nowrap px-3 py-3">
                              Tax %
                            </th>
                          )}
                          {lc.taxAmount && (
                            <th className="whitespace-nowrap px-3 py-3">
                              Tax Amount
                            </th>
                          )}
                          {lc.gross && (
                            <th className="whitespace-nowrap px-3 py-3">
                              Gross
                            </th>
                          )}
                          {lc.memo && (
                            <th className="whitespace-nowrap px-3 py-3">Memo</th>
                          )}
                          {lc.action && (
                            <th className="whitespace-nowrap px-3 py-3">
                              Action
                            </th>
                          )}
                        </tr>
                      </thead>

                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                        {form.items.map((item, index) => {
                          const line = calcLine(item);

                          return (
                            <tr key={index} className="align-top">
                              {lc.rowNumber && (
                                <td className="px-3 py-3 text-slate-500">
                                  {index + 1}
                                </td>
                              )}

                              {lc.itemName && (
                                <td className="min-w-56 px-3 py-3">
                                  <select
                                    value={item.productId}
                                    onChange={(event) =>
                                      selectProduct(index, event.target.value)
                                    }
                                    className={`${inputClass} min-w-52`}
                                  >
                                    <option value="">Select product</option>

                                    {products.map((product) => (
                                      <option
                                        key={getProductId(product)}
                                        value={getProductId(product)}
                                      >
                                        {getProductName(product)}
                                      </option>
                                    ))}
                                  </select>

                                  <input
                                    value={item.itemName}
                                    onChange={(event) =>
                                      updateItem(
                                        index,
                                        "itemName",
                                        event.target.value
                                      )
                                    }
                                    placeholder="Or enter item name"
                                    required
                                    className={`${inputClass} mt-2 min-w-52`}
                                  />
                                </td>
                              )}

                              {lc.itemDescription && (
                                <td className="min-w-48 px-3 py-3">
                                  <input
                                    value={item.itemDescription}
                                    onChange={(event) =>
                                      updateItem(
                                        index,
                                        "itemDescription",
                                        event.target.value
                                      )
                                    }
                                    placeholder="Description"
                                    className={`${inputClass} min-w-44`}
                                  />
                                </td>
                              )}

                              {lc.itemBalance && (
                                <td className="min-w-28 px-3 py-3">
                                  <input
                                    type="number"
                                    min="0"
                                    step="0.0001"
                                    value={item.itemBalance}
                                    onChange={(event) =>
                                      updateItem(
                                        index,
                                        "itemBalance",
                                        event.target.value
                                      )
                                    }
                                    className={`${inputClass} min-w-24`}
                                  />
                                </td>
                              )}

                              {lc.uom && (
                                <td className="min-w-24 px-3 py-3">
                                  <input
                                    value={item.uom}
                                    onChange={(event) =>
                                      updateItem(index, "uom", event.target.value)
                                    }
                                    placeholder="PCS"
                                    className={`${inputClass} min-w-20`}
                                  />
                                </td>
                              )}

                              {lc.quantity && (
                                <td className="min-w-28 px-3 py-3">
                                  <input
                                    type="number"
                                    min="0.0001"
                                    step="0.0001"
                                    required
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
                              )}

                              {lc.unitPrice && (
                                <td className="min-w-32 px-3 py-3">
                                  <input
                                    type="number"
                                    min="0"
                                    step="0.0001"
                                    required
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
                              )}

                              {lc.amount && (
                                <td className="whitespace-nowrap px-3 py-5 font-semibold">
                                  {money(line.amount)}
                                </td>
                              )}

                              {lc.taxCode && (
                                <td className="min-w-28 px-3 py-3">
                                  <input
                                    value={item.taxCode}
                                    onChange={(event) =>
                                      updateItem(
                                        index,
                                        "taxCode",
                                        event.target.value
                                      )
                                    }
                                    placeholder="e.g. GST"
                                    className={`${inputClass} min-w-24`}
                                  />
                                </td>
                              )}

                              {lc.taxRate && (
                                <td className="min-w-24 px-3 py-3">
                                  <input
                                    type="number"
                                    min="0"
                                    max="100"
                                    step="0.01"
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
                              )}

                              {lc.taxAmount && (
                                <td className="whitespace-nowrap px-3 py-5">
                                  {money(line.taxAmount)}
                                </td>
                              )}

                              {lc.gross && (
                                <td className="whitespace-nowrap px-3 py-5 font-bold text-emerald-700 dark:text-emerald-400">
                                  {money(line.gross)}
                                </td>
                              )}

                              {lc.memo && (
                                <td className="min-w-36 px-3 py-3">
                                  <input
                                    value={item.memo}
                                    onChange={(event) =>
                                      updateItem(index, "memo", event.target.value)
                                    }
                                    placeholder="Memo"
                                    className={`${inputClass} min-w-32`}
                                  />
                                </td>
                              )}

                              {lc.action && (
                                <td className="px-3 py-3">
                                  <button
                                    type="button"
                                    onClick={() => removeLine(index)}
                                    title="Remove line"
                                    className="rounded-lg p-2 text-rose-500 transition hover:bg-rose-50 dark:hover:bg-rose-950/40"
                                  >
                                    <Icon name="trash" className="h-4 w-4" />
                                  </button>
                                </td>
                              )}
                            </tr>
                          );
                        })}

                        {form.items.length === 0 && (
                          <tr>
                            <td
                              colSpan={lineCols.visibleCount}
                              className="px-4 py-12 text-center"
                            >
                              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-2xl text-slate-400 dark:bg-slate-800 dark:text-slate-500">
                                +
                              </div>

                              <p className="mt-3 font-semibold text-slate-700 dark:text-slate-200">
                                No lines added
                              </p>

                              <p className="mt-1 text-sm text-slate-400 dark:text-slate-500">
                                Use the Product field above to add your first
                                line.
                              </p>
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>

                  {/* TOTALS */}

                  <div className="grid gap-3 rounded-b-2xl border-t border-slate-200 bg-slate-50 p-5 dark:border-slate-800 dark:bg-slate-900/50 sm:grid-cols-3">
                    <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-950">
                      <div className="text-sm text-slate-500 dark:text-slate-400">
                        Total Amount
                      </div>

                      <div className="mt-2 text-xl font-bold">
                        Rs {money(totals.subtotal)}
                      </div>
                    </div>

                    <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-950">
                      <div className="text-sm text-slate-500 dark:text-slate-400">
                        Tax Amount
                      </div>

                      <div className="mt-2 text-xl font-bold">
                        Rs {money(totals.taxAmount)}
                      </div>
                    </div>

                    <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 dark:border-emerald-900 dark:bg-emerald-950/40">
                      <div className="text-sm font-semibold text-emerald-700 dark:text-emerald-300">
                        Gross Amount
                      </div>

                      <div className="mt-2 text-2xl font-bold text-emerald-800 dark:text-emerald-200">
                        Rs {money(totals.grossAmount)}
                      </div>
                    </div>
                  </div>
                </>
              )}

              {/* TERMS AND CONDITIONS */}

              {activeTab === "terms" && (
                <div className="p-5">
                  <Field label="Terms & Conditions">
                    <textarea
                      rows={8}
                      value={form.termsConditions}
                      onChange={(event) =>
                        updateForm("termsConditions", event.target.value)
                      }
                      placeholder="Enter payment terms, delivery conditions, validity, warranty, and other conditions..."
                      className={inputClass}
                    />
                  </Field>
                </div>
              )}

              {/* RELATED TRANSACTIONS */}

              {activeTab === "related" && (
                <div className="p-5">
                  <Field label="Related Transactions / Reference">
                    <textarea
                      rows={5}
                      value={form.relatedTransaction}
                      onChange={(event) =>
                        updateForm("relatedTransaction", event.target.value)
                      }
                      placeholder="Enter related transaction references or notes..."
                      className={inputClass}
                    />
                  </Field>

                  <p className="mt-2 text-xs text-slate-500">
                    This field records reference information. Automatic
                    conversion to sales orders will be implemented in the next
                    stage.
                  </p>
                </div>
              )}

              {/* SYSTEM INFORMATION */}

              {activeTab === "system" && (
                <div className="grid gap-4 p-5 sm:grid-cols-2">
                  <div className="rounded-xl bg-slate-50 p-4 dark:bg-slate-900">
                    <div className="text-sm text-slate-500 dark:text-slate-400">
                      Transaction Number
                    </div>

                    <div className="mt-2 font-bold">
                      {form.quotationNumber || "Assigned when saved"}
                    </div>
                  </div>

                  <div className="rounded-xl bg-slate-50 p-4 dark:bg-slate-900">
                    <div className="text-sm text-slate-500 dark:text-slate-400">
                      Record Status
                    </div>

                    <div className="mt-2 font-bold">{form.status}</div>
                  </div>

                  <div className="rounded-xl bg-slate-50 p-4 dark:bg-slate-900">
                    <div className="text-sm text-slate-500 dark:text-slate-400">
                      Record ID
                    </div>

                    <div className="mt-2 font-bold">
                      {form.quotationId || "Not saved yet"}
                    </div>
                  </div>

                  <div className="rounded-xl bg-slate-50 p-4 dark:bg-slate-900">
                    <div className="text-sm text-slate-500 dark:text-slate-400">
                      Last action
                    </div>

                    <div className="mt-2 font-bold">
                      {form.quotationId
                        ? "Existing quotation"
                        : "New quotation"}
                    </div>
                  </div>
                </div>
              )}

              {/* ATTACHMENT */}

              {activeTab === "attachment" && (
                <div className="grid gap-5 p-5 sm:grid-cols-2">
                  <Field label="Attachment Name">
                    <input
                      value={form.attachmentName}
                      onChange={(event) =>
                        updateForm("attachmentName", event.target.value)
                      }
                      placeholder="e.g. customer-requirements.pdf"
                      className={inputClass}
                    />
                  </Field>

                  <Field label="Attachment URL">
                    <input
                      type="url"
                      value={form.attachmentUrl}
                      onChange={(event) =>
                        updateForm("attachmentUrl", event.target.value)
                      }
                      placeholder="https://..."
                      className={inputClass}
                    />
                  </Field>

                  <p className="text-xs text-slate-500 sm:col-span-2">
                    These fields store an attachment name and reference URL.
                    Actual file upload and secure file storage are not included
                    in this first version.
                  </p>
                </div>
              )}
            </section>

            {/* FORM BUTTONS */}

            <div className="flex flex-col-reverse justify-between gap-3 sm:flex-row">
              <button
                type="button"
                onClick={() => {
                  setError("");
                  setNotice("");
                  setView("list");
                }}
                className={buttonSecondary}
              >
                <Icon name="back" />
                Back
              </button>

              <button
                type="submit"
                disabled={saving || !canSaveForm}
                className={buttonPrimary}
              >
                {saving
                  ? "Saving..."
                  : form.quotationId
                    ? "Update Quotation"
                    : "Save Quotation"}
              </button>
            </div>
          </form>
        )}

        {/* ================================================= */}
        {/* QUOTATION DETAILS / REPORT */}
        {/* ================================================= */}

        {view === "detail" && selectedQuotation && (
          <section className="space-y-5">
            {/* DETAIL ACTIONS */}

            <div className="flex flex-wrap gap-2 print:hidden">
              {canUpdate && selectedQuotation.status !== "Converted" && (
                <button
                  type="button"
                  onClick={() => editQuotation(selectedQuotation)}
                  className={buttonPrimary}
                >
                  <Icon name="edit" />
                  Edit
                </button>
              )}

              <button
                type="button"
                onClick={() => setView("list")}
                className={buttonSecondary}
              >
                <Icon name="back" />
                Back
              </button>

              {canView && (
                <button
                  type="button"
                  onClick={printQuotation}
                  className={buttonSecondary}
                >
                  <Icon name="print" />
                  Report / Print / Save PDF
                </button>
              )}

              {canCreate && (
                <button
                  type="button"
                  onClick={createQuotation}
                  className={buttonSecondary}
                >
                  <Icon name="plus" />
                  Create Quotation
                </button>
              )}

              {canCreate && (
                <button
                  type="button"
                  onClick={() => copyQuotation(selectedQuotation)}
                  className={buttonSecondary}
                >
                  <Icon name="copy" />
                  Copy Quotation
                </button>
              )}
            </div>

            {/* REPORT CONTENT */}

            <div
              id="quotation-report"
              className="space-y-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-950 sm:p-8"
            >
              {/* REPORT HEADER */}

              <div className="flex flex-col justify-between gap-4 border-b border-slate-200 pb-6 dark:border-slate-800 sm:flex-row sm:items-start">
                <div>
                  <div className="text-xs font-bold uppercase tracking-[0.2em] text-emerald-600 dark:text-emerald-400">
                    Sales Management
                  </div>

                  <h2 className="mt-2 text-3xl font-bold">Quotation</h2>

                  <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
                    {selectedQuotation.company_name || "Company"}
                  </p>
                </div>

                <div className="sm:text-right">
                  <div className="text-sm text-slate-500 dark:text-slate-400">
                    Transaction Number
                  </div>

                  <div className="mt-1 text-2xl font-bold text-emerald-700 dark:text-emerald-400">
                    {selectedQuotation.quotation_number}
                  </div>

                  <span
                    className={`mt-3 inline-flex rounded-full px-3 py-1 text-xs font-bold ${statusClass(selectedQuotation.status)}`}
                  >
                    {selectedQuotation.status}
                  </span>
                </div>
              </div>

              {/* REPORT INFORMATION */}

              <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
                {[
                  ["Quotation Date", dateDisplay(selectedQuotation.quotation_date)],
                  ["Quotation End Date", dateDisplay(selectedQuotation.expiry_date)],
                  ["Subsidiary / Company", selectedQuotation.company_name || "—"],
                  ["From Location", selectedQuotation.warehouse_name || "—"],
                  ["Customer", selectedQuotation.customer_name || "—"],
                  ["Department", selectedQuotation.department || "—"],
                  ["Project", selectedQuotation.project || "—"],
                  ["Class", selectedQuotation.quotation_class || "—"],
                  ["Sales Representative", selectedQuotation.sales_rep || "—"],
                  ["Payment Term", selectedQuotation.payment_term || "—"],
                  ["Memo", selectedQuotation.memo || "—"],
                ].map(([label, value]) => (
                  <div key={label}>
                    <div className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                      {label}
                    </div>

                    <div className="mt-1 break-words text-sm font-semibold">
                      {value}
                    </div>
                  </div>
                ))}
              </div>

              {/* AMOUNT SUMMARY */}

              <div className="border-y border-slate-200 py-5 dark:border-slate-800">
                <div className="grid grid-cols-3 gap-4">
                  <div className="min-w-0">
                    <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                      Total Amount
                    </p>

                    <p className="mt-2 break-words text-base font-bold text-slate-900 dark:text-white">
                      Rs {money(selectedQuotation.subtotal)}
                    </p>
                  </div>

                  <div className="min-w-0 border-x border-slate-200 px-4 dark:border-slate-800">
                    <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                      Tax Amount
                    </p>

                    <p className="mt-2 break-words text-base font-bold text-slate-900 dark:text-white">
                      Rs {money(selectedQuotation.tax_amount)}
                    </p>
                  </div>

                  <div className="min-w-0">
                    <p className="text-xs font-semibold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
                      Gross Amount
                    </p>

                    <p className="mt-2 break-words text-base font-bold text-emerald-700 dark:text-emerald-400">
                      Rs {money(selectedQuotation.gross_amount)}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </section>
        )}
      </div>
    </main>
  );
}