"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";

import {
  Plus,
  Save,
  X,
  Edit,
  Trash2,
  LockKeyhole,
  RefreshCw,
  Package,
  Search,
  Boxes,
  ChevronLeft,
  ChevronRight,
  Barcode,
  Layers3,
  ShoppingCart,
  Truck,
  Wallet,
  CheckCircle2,
  AlertCircle,
  Image as ImageIcon,
  CircleDollarSign,
  PackageCheck,
  ArrowUpRight,
  Hash,
  Ruler,
  SlidersHorizontal,
  Eye,
  ChevronDown,
} from "lucide-react";

/* =========================================================
   CONSTANTS
========================================================= */

const EMPTY_FORM = {
  sku: "",
  barcode: "",
  productName: "",
  description: "",
  category: "",
  unit: "PCS",
  itemType: "Stock Item",
  brand: "",
  model: "",
  color: "",
  size: "",
  design: "",
  salesUnit: "PCS",
  salePrice: "0",
  salesDescription: "",
  salesAccount: "",
  receivableAccount: "",
  purchaseUnit: "PCS",
  costPrice: "0",
  purchaseDescription: "",
  purchaseAccount: "",
  inventoryAccount: "",
  cogsAccount: "",
  minimumStock: "0",
  isActive: true,
  image: "",
  bannerSequence: "0",
};

const EMPTY_VARIANT = {
  code: "",
  name: "",
  barcode: "",
  unit: "PCS",
  units_per_parent: "1",
  color: "",
  size: "",
  design: "",
  cost_price: "0",
  sale_price: "0",
};

const CATEGORIES = [
  "Electronics",
  "Furniture",
  "Clothing",
  "Food & Beverage",
  "Grocery",
  "Hardware",
  "Stationery",
  "Raw Material",
  "Finished Goods",
  "Services",
];

const UNITS = [
  "PCS",
  "BOX",
  "KG",
  "G",
  "TON",
  "L",
  "ML",
  "M",
  "CM",
  "DOZEN",
  "PACK",
  "SET",
  "PAIR",
  "ROLL",
  "CARTON",
];

const SECTIONS = [
  { id: "primary", label: "Primary", icon: Package },
  { id: "subproducts", label: "Sub-Products", icon: Layers3 },
  { id: "sales", label: "Sales", icon: ShoppingCart },
  { id: "purchase", label: "Purchase", icon: Truck },
  { id: "accounts", label: "Accounts", icon: Wallet },
];

const PRODUCT_COLUMNS = [
  { key: "product", label: "Product" },
  { key: "category", label: "Category" },
  { key: "uom", label: "UOM" },
  { key: "stock", label: "Available Stock" },
  { key: "cost", label: "Cost Price" },
  { key: "sale", label: "Sale Price" },
  { key: "status", label: "Status" },
  { key: "actions", label: "Actions" },
];

const VARIANT_COLUMNS = [
  { key: "code", label: "Code" },
  { key: "name", label: "Sub-Product" },
  { key: "uom", label: "UOM" },
  { key: "color", label: "Color" },
  { key: "size", label: "Size" },
  { key: "barcode", label: "Barcode" },
  { key: "stock", label: "Available Stock" },
  { key: "conversion", label: "Conversion" },
  { key: "cost", label: "Cost" },
  { key: "sale", label: "Sale" },
  { key: "actions", label: "Actions" },
];

const inputClass =
  "w-full rounded-xl border border-slate-200 bg-white px-3.5 py-3 text-sm text-slate-800 shadow-sm outline-none transition duration-200 placeholder:text-slate-400 hover:border-slate-300 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 disabled:cursor-not-allowed disabled:bg-slate-50";

const labelClass =
  "mb-2 block text-[13px] font-semibold tracking-wide text-slate-700";

/* =========================================================
   HELPER FUNCTIONS
========================================================= */

function getArray(data, keys = []) {
  if (Array.isArray(data)) return data;

  for (const key of keys) {
    if (Array.isArray(data?.[key])) {
      return data[key];
    }
  }

  return [];
}

function getProductId(product) {
  return (
    product?.product_id ??
    product?.productId ??
    product?.id ??
    null
  );
}

function getVariantId(variant) {
  return (
    variant?.sub_product_id ??
    variant?.subProductId ??
    variant?.variant_id ??
    variant?.id ??
    null
  );
}

function normalizeProduct(product) {
  return {
    ...product,

    product_id: getProductId(product),

    sku: product?.sku ?? "",
    barcode: product?.barcode ?? "",

    product_name:
      product?.product_name ??
      product?.productName ??
      product?.name ??
      "",

    description: product?.description ?? "",
    category: product?.category ?? "",
    unit: product?.unit ?? "PCS",

    item_type:
      product?.item_type ??
      product?.itemType ??
      "Stock Item",

    brand: product?.brand ?? "",
    model: product?.model ?? "",
    color: product?.color ?? "",
    size: product?.size ?? "",
    design: product?.design ?? "",

    sales_unit:
      product?.sales_unit ??
      product?.salesUnit ??
      "PCS",

    sale_price:
      product?.sale_price ??
      product?.salePrice ??
      0,

    sales_description:
      product?.sales_description ??
      product?.salesDescription ??
      "",

    sales_account:
      product?.sales_account ??
      product?.salesAccount ??
      "",

    receivable_account:
      product?.receivable_account ??
      product?.receivableAccount ??
      "",

    purchase_unit:
      product?.purchase_unit ??
      product?.purchaseUnit ??
      "PCS",

    cost_price:
      product?.cost_price ??
      product?.costPrice ??
      0,

    purchase_description:
      product?.purchase_description ??
      product?.purchaseDescription ??
      "",

    purchase_account:
      product?.purchase_account ??
      product?.purchaseAccount ??
      "",

    inventory_account:
      product?.inventory_account ??
      product?.inventoryAccount ??
      "",

    cogs_account:
      product?.cogs_account ??
      product?.cogsAccount ??
      "",

    minimum_stock:
      product?.minimum_stock ??
      product?.minimumStock ??
      0,

    is_active:
      product?.is_active ??
      product?.isActive ??
      true,

    image:
      product?.image ??
      product?.image_url ??
      "",

    banner_sequence:
      product?.banner_sequence ??
      product?.bannerSequence ??
      0,
  };
}

function normalizeVariant(variant) {
  return {
    ...variant,

    sub_product_id: getVariantId(variant),

    sku:
      variant?.sku ??
      variant?.variant_sku ??
      variant?.sub_product_code ??
      "",

    sub_product_name:
      variant?.sub_product_name ??
      variant?.variant_name ??
      variant?.name ??
      "",

    barcode: variant?.barcode ?? "",
    unit: variant?.unit ?? "PCS",

    units_per_parent:
      variant?.units_per_parent ??
      1,

    parent_available_stock:
      variant?.parent_available_stock ??
      0,

    stock_source:
      variant?.stock_source ??
      "conversion",

    color: variant?.color ?? "",
    size: variant?.size ?? "",
    design: variant?.design ?? "",

    cost_price:
      variant?.cost_price ??
      variant?.costPrice ??
      0,

    sale_price:
      variant?.sale_price ??
      variant?.salePrice ??
      0,

    available_stock:
      variant?.available_stock ??
      variant?.availableStock ??
      variant?.quantity ??
      0,
  };
}

function getErrorMessage(data, fallback) {
  return data?.message || data?.error || fallback;
}

function money(value) {
  const amount = Number(value ?? 0);

  return new Intl.NumberFormat("en-PK", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number.isFinite(amount) ? amount : 0);
}

function formatQuantity(value) {
  const quantity = Number(value ?? 0);

  return new Intl.NumberFormat("en-PK", {
    maximumFractionDigits: 3,
  }).format(Number.isFinite(quantity) ? quantity : 0);
}

function isActiveProduct(product) {
  return !(
    product?.is_active === false ||
    product?.is_active === "false" ||
    product?.is_active === 0
  );
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
   REUSABLE UI COMPONENTS
========================================================= */

function Field({
  label,
  children,
  className = "",
  required = false,
  hint,
}) {
  return (
    <div className={`min-w-0 ${className}`}>
      <label className={labelClass}>
        {label}

        {required && (
          <span className="ml-1 text-rose-500">*</span>
        )}
      </label>

      {children}

      {hint && (
        <p className="mt-1.5 text-xs leading-5 text-slate-500">
          {hint}
        </p>
      )}
    </div>
  );
}

function Input({ className = "", ...props }) {
  return (
    <input
      {...props}
      className={`${inputClass} ${className}`}
    />
  );
}

function Select({ children, className = "", ...props }) {
  return (
    <select
      {...props}
      className={`${inputClass} cursor-pointer ${className}`}
    >
      {children}
    </select>
  );
}

function TextArea({ className = "", ...props }) {
  return (
    <textarea
      {...props}
      className={`${inputClass} min-h-[100px] resize-y ${className}`}
    />
  );
}

function SectionHeading({
  eyebrow,
  title,
  description,
  icon: Icon,
}) {
  return (
    <div className="flex items-start gap-3">
      {Icon && (
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-indigo-100 bg-indigo-50 text-indigo-600">
          <Icon size={21} />
        </div>
      )}

      <div>
        {eyebrow && (
          <p className="mb-1 text-[10px] font-bold uppercase tracking-[0.18em] text-indigo-600">
            {eyebrow}
          </p>
        )}

        <h3 className="text-base font-bold tracking-tight text-slate-900">
          {title}
        </h3>

        {description && (
          <p className="mt-1 text-sm leading-6 text-slate-500">
            {description}
          </p>
        )}
      </div>
    </div>
  );
}

function SummaryCard({
  title,
  value,
  description,
  icon: Icon,
  color,
}) {
  const themes = {
    blue: {
      icon: "bg-blue-100 text-blue-700",
      glow: "from-blue-500/10",
      bar: "bg-blue-500",
    },

    purple: {
      icon: "bg-violet-100 text-violet-700",
      glow: "from-violet-500/10",
      bar: "bg-violet-500",
    },

    green: {
      icon: "bg-emerald-100 text-emerald-700",
      glow: "from-emerald-500/10",
      bar: "bg-emerald-500",
    },
  };

  const theme = themes[color] || themes.blue;

  return (
    <div className="group relative overflow-hidden p-5 transition duration-300 hover:-translate-y-1">
      <div
        className={`pointer-events-none absolute inset-0 bg-gradient-to-br ${theme.glow} via-transparent to-transparent opacity-70`}
      />

      <div className="relative flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-sm font-medium text-slate-500">
            {title}
          </p>

          <p className="mt-3 text-3xl font-bold tracking-tight text-slate-900">
            {value}
          </p>

          <p className="mt-2 text-xs text-slate-500">
            {description}
          </p>
        </div>

        <div className={`rounded-2xl p-3.5 ${theme.icon}`}>
          <Icon size={23} strokeWidth={1.8} />
        </div>
      </div>

      <div className="relative mt-5 h-1 overflow-hidden rounded-full bg-slate-100">
        <div className={`h-full w-1/3 rounded-full ${theme.bar}`} />
      </div>
    </div>
  );
}

function ActionButton({
  children,
  onClick,
  variant = "secondary",
  disabled = false,
  className = "",
  type = "button",
  title,
}) {
  const variants = {
    primary:
      "border border-indigo-600 bg-indigo-600 text-white shadow-sm hover:border-indigo-700 hover:bg-indigo-700 hover:shadow-lg hover:shadow-indigo-600/20 focus:ring-indigo-500/20",

    secondary:
      "border border-slate-200 bg-white text-slate-700 shadow-sm hover:border-slate-300 hover:bg-slate-50 focus:ring-slate-300/30",

    danger:
      "border border-rose-100 bg-white text-rose-600 hover:border-rose-200 hover:bg-rose-50 focus:ring-rose-500/10",
  };

  return (
    <button
      type={type}
      title={title}
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition duration-200 focus:outline-none focus:ring-4 disabled:cursor-not-allowed disabled:opacity-50 ${variants[variant]} ${className}`}
    >
      {children}
    </button>
  );
}

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
      <ActionButton onClick={() => setOpen((v) => !v)}>
        <Eye size={16} />
        Columns
        <span className="rounded-md bg-slate-100 px-1.5 py-0.5 text-[10px] font-bold text-slate-600">
          {state.count}/{columns.length}
        </span>
        <ChevronDown
          size={15}
          className={`transition ${open ? "rotate-180" : ""}`}
        />
      </ActionButton>

      {open && (
        <div className="absolute right-0 z-30 mt-2 w-60 rounded-2xl border border-slate-200 bg-white p-2 shadow-xl">
          <div className="flex items-center justify-between px-2 pb-2 pt-1">
            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
              Show columns
            </p>
            <button
              type="button"
              onClick={state.showAll}
              className="text-xs font-semibold text-indigo-600 hover:text-indigo-800"
            >
              Show all
            </button>
          </div>

          <div className="max-h-72 overflow-y-auto">
            {columns.map((col) => (
              <label
                key={col.key}
                className="flex cursor-pointer items-center gap-3 rounded-lg px-2.5 py-2 text-sm text-slate-700 hover:bg-slate-50"
              >
                <input
                  type="checkbox"
                  checked={state.visible[col.key]}
                  onChange={() => state.toggle(col.key)}
                  className="h-4 w-4 rounded border-slate-300 accent-indigo-600"
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

function Notification({ type, message, onClose }) {
  if (!message) return null;

  const success = type === "success";
  const Icon = success ? CheckCircle2 : AlertCircle;

  return (
    <div
      role={success ? "status" : "alert"}
      className={`mb-5 flex items-start gap-3 rounded-2xl border p-4 shadow-sm ${success
        ? "border-emerald-200 bg-emerald-50/90 text-emerald-900"
        : "border-rose-200 bg-rose-50/90 text-rose-900"
        }`}
    >
      <Icon
        size={20}
        className={`mt-0.5 shrink-0 ${success ? "text-emerald-600" : "text-rose-600"
          }`}
      />

      <p className="flex-1 text-sm font-medium leading-6">
        {message}
      </p>

      <button
        type="button"
        onClick={onClose}
        aria-label="Dismiss message"
        className="rounded-lg p-1 transition hover:bg-black/5"
      >
        <X size={17} />
      </button>
    </div>
  );
}

function EmptyState({
  icon: Icon = Package,
  title,
  description,
}) {
  return (
    <div className="flex flex-col items-center px-6 py-14 text-center">
      <div className="mb-4 rounded-2xl bg-slate-100 p-4 text-slate-400">
        <Icon size={30} strokeWidth={1.6} />
      </div>

      <h4 className="font-semibold text-slate-800">
        {title}
      </h4>

      <p className="mt-1 max-w-sm text-sm leading-6 text-slate-500">
        {description}
      </p>
    </div>
  );
}

/* =========================================================
   PRODUCTS PAGE
========================================================= */

export default function ProductsPage() {
  /* -------------------------------------------------------
     STATE
  ------------------------------------------------------- */

  const [products, setProducts] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [stockRows, setStockRows] = useState([]);

  const [variants, setVariants] = useState([]);
  const [subProductsByProduct, setSubProductsByProduct] =
    useState({});

  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [variantForm, setVariantForm] = useState({
    ...EMPTY_VARIANT,
  });

  const [editingProduct, setEditingProduct] = useState(null);
  const [editingVariantId, setEditingVariantId] = useState(null);

  const [showForm, setShowForm] = useState(false);
  const [activeSection, setActiveSection] = useState("primary");

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savingVariant, setSavingVariant] = useState(false);

  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const [manualCategory, setManualCategory] = useState("");
  const [showManualCategory, setShowManualCategory] =
    useState(false);

  const [manualUnit, setManualUnit] = useState("");
  const [showManualUnit, setShowManualUnit] = useState(false);

  // Column visibility (hooks must live inside the component)
  const productCols = useColumnVisibility(
    "products.columns",
    PRODUCT_COLUMNS
  );
  const variantCols = useColumnVisibility(
    "variants.columns",
    VARIANT_COLUMNS
  );

  const NO_PERMISSIONS = {
    canView: false,
    canCreate: false,
    canUpdate: false,
    canDelete: false,
  };

  const [permissions, setPermissions] = useState({
    ...NO_PERMISSIONS,
  });

  const [permissionsLoaded, setPermissionsLoaded] = useState(false);
  const [accessDenied, setAccessDenied] = useState(false);

  /* -------------------------------------------------------
     FORM HELPERS
  ------------------------------------------------------- */

  const setField = (name, value) => {
    setForm((previous) => ({
      ...previous,
      [name]: value,
    }));
  };

  const setVariantField = (name, value) => {
    setVariantForm((previous) => ({
      ...previous,
      [name]: value,
    }));
  };

  /* -------------------------------------------------------
     API REQUEST HELPER
  ------------------------------------------------------- */

  const request = useCallback(async (url, options = {}) => {
    const response = await fetch(url, {
      ...options,
      headers: {
        ...(options.body
          ? { "Content-Type": "application/json" }
          : {}),
        ...options.headers,
      },
      cache: "no-store",
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok || data.success === false) {
      const error = new Error(
        data.message ||
        data.error ||
        `Request failed (${response.status}).`
      );

      error.status = response.status;
      error.data = data;

      throw error;
    }

    return data;
  }, []);

  /* -------------------------------------------------------
     LOAD STOCK
  ------------------------------------------------------- */

  const loadStock = useCallback(async () => {
    try {
      const data = await request("/api/stock");

      const rows = getArray(data, [
        "stock",
        "stocks",
        "data",
        "items",
      ]);

      setStockRows(rows);

      return rows;
    } catch (err) {
      console.error("Could not load stock:", err);

      setStockRows([]);

      throw err;
    }
  }, [request]);

  /* -------------------------------------------------------
     LOAD ACCOUNTS
  ------------------------------------------------------- */

  const loadAccounts = useCallback(async () => {
    try {
      const data = await request("/api/accounts");

      const rows = getArray(data, [
        "accounts",
        "data",
        "items",
      ]);

      const activeAccounts = rows.filter((account) => {
        const isActive =
          account.is_active !== false &&
          account.is_active !== "false" &&
          account.is_active !== 0;

        const isGroup =
          account.is_group === true ||
          account.is_group === "true" ||
          account.is_group === 1;

        return isActive && !isGroup;
      });

      setAccounts(activeAccounts);

      return activeAccounts;
    } catch (err) {
      console.error("Could not load chart of accounts:", err);

      setAccounts([]);

      throw err;
    }
  }, [request]);

  /* -------------------------------------------------------
     LOAD VARIANTS FOR ONE PRODUCT
  ------------------------------------------------------- */

  const loadVariants = useCallback(
    async (productId) => {
      if (productId == null) {
        setVariants([]);
        return [];
      }

      const requestedProductId = String(productId);

      try {
        const data = await request(
          `/api/products/${productId}/variants`
        );

        const rows = getArray(data, [
          "variants",
          "subProducts",
          "sub_products",
          "data",
          "items",
        ]).map(normalizeVariant);

        setVariants(rows);

        setSubProductsByProduct((previous) => ({
          ...previous,
          [requestedProductId]: rows,
        }));

        return rows;
      } catch (err) {
        console.error(
          `Could not load variants for product ${productId}:`,
          err
        );

        setVariants([]);

        setError(
          `Could not load sub-products: ${err.message}`
        );

        return [];
      }
    },
    [request]
  );

  /* -------------------------------------------------------
     LOAD PRODUCTS
  ------------------------------------------------------- */

  const loadProducts = useCallback(async () => {
    try {
      const data = await request("/api/products");

      const source = data?.permissions ?? {};

      const nextPermissions = {
        canView:
          source.canView === true ||
          source.can_view === true,
        canCreate:
          source.canCreate === true ||
          source.can_create === true,
        canUpdate:
          source.canUpdate === true ||
          source.can_update === true,
        canDelete:
          source.canDelete === true ||
          source.can_delete === true,
      };

      setPermissions(nextPermissions);
      setPermissionsLoaded(true);
      setAccessDenied(!nextPermissions.canView);

      if (!nextPermissions.canView) {
        setProducts([]);
        setSubProductsByProduct({});
        setVariants([]);
        setShowForm(false);
        setEditingProduct(null);
        setEditingVariantId(null);

        return [];
      }

      const rows = getArray(data, [
        "products",
        "data",
        "items",
      ]).map(normalizeProduct);

      const grouped = {};

      for (const product of rows) {
        const productId = getProductId(product);

        if (productId == null) continue;

        grouped[String(productId)] = Array.isArray(
          product.sub_products
        )
          ? product.sub_products.map(normalizeVariant)
          : [];
      }

      setProducts(rows);

      setSubProductsByProduct((previous) => {
        const merged = { ...grouped };

        for (const [productId, cachedVariants] of Object.entries(
          previous
        )) {
          if (
            Object.prototype.hasOwnProperty.call(
              merged,
              productId
            ) &&
            merged[productId].length === 0 &&
            cachedVariants.length > 0
          ) {
            merged[productId] = cachedVariants;
          }
        }

        return merged;
      });

      return rows;
    } catch (error) {
      console.error("LOAD PRODUCTS ERROR:", error);

      if (
        error.status === 401 ||
        error.status === 403 ||
        /permission denied|access denied|unauthorized|forbidden/i.test(
          error.message || ""
        )
      ) {
        setPermissions({ ...NO_PERMISSIONS });
        setPermissionsLoaded(true);
        setAccessDenied(true);
        setProducts([]);
        setSubProductsByProduct({});
        setVariants([]);
        setShowForm(false);
        setEditingProduct(null);
        setEditingVariantId(null);

        return [];
      }

      throw error;
    }
  }, [request]);

  /* -------------------------------------------------------
     INITIAL LOADING
  ------------------------------------------------------- */

  useEffect(() => {
    let cancelled = false;

    async function loadInitialData() {
      setLoading(true);
      setError("");

      const results = await Promise.allSettled([
        loadProducts(),
        loadAccounts(),
        loadStock(),
      ]);

      if (cancelled) return;

      const productResult = results[0];
      const accountResult = results[1];
      const stockResult = results[2];

      const errors = [];

      if (productResult.status === "rejected") {
        errors.push(
          productResult.reason?.message ||
          "Could not load products."
        );
      }

      if (accountResult.status === "rejected") {
        console.error(
          "Account loading failed. Product catalogue is still available."
        );
      }

      if (stockResult.status === "rejected") {
        console.error(
          "Stock loading failed. Stock figures may be unavailable."
        );
      }

      if (errors.length > 0) {
        setError(errors.join(" "));
      }

      setLoading(false);
    }

    loadInitialData();

    return () => {
      cancelled = true;
    };
  }, [loadProducts, loadAccounts, loadStock]);

  /* -------------------------------------------------------
     PRODUCT STOCK MAP
  ------------------------------------------------------- */

  const productStock = useMemo(() => {
    const totals = new Map();

    for (const row of stockRows) {
      const id =
        row?.product_id ??
        row?.productId ??
        row?.id;

      if (id == null) continue;

      const quantity = Number(
        row?.available_stock ??
        row?.availableStock ??
        row?.quantity ??
        row?.stock_quantity ??
        0
      );

      const safeQuantity = Number.isFinite(quantity)
        ? quantity
        : 0;

      if (
        row?.available_stock != null ||
        row?.availableStock != null
      ) {
        if (!totals.has(String(id))) {
          totals.set(String(id), safeQuantity);
        }
      } else {
        totals.set(
          String(id),
          (totals.get(String(id)) || 0) + safeQuantity
        );
      }
    }

    return totals;
  }, [stockRows]);

  /* -------------------------------------------------------
     FILTERED PRODUCTS
  ------------------------------------------------------- */

  const filteredProducts = useMemo(() => {
    const query = search.trim().toLowerCase();

    return products.filter((product) => {
      const matchesQuery =
        !query ||
        [
          product.sku,
          product.barcode,
          product.product_name,
          product.category,
          product.brand,
        ]
          .filter(Boolean)
          .some((value) =>
            String(value).toLowerCase().includes(query)
          );

      const active = isActiveProduct(product);

      const matchesStatus =
        statusFilter === "all" ||
        (statusFilter === "active" && active) ||
        (statusFilter === "inactive" && !active);

      return matchesQuery && matchesStatus;
    });
  }, [products, search, statusFilter]);

  /* -------------------------------------------------------
     DERIVED VALUES
  ------------------------------------------------------- */

  const currentProductId = getProductId(editingProduct);

  const currentProductStock =
    currentProductId != null
      ? productStock.get(String(currentProductId)) ?? 0
      : 0;

  const totalSubProducts = useMemo(() => {
    return Object.values(subProductsByProduct).reduce(
      (total, items) => total + items.length,
      0
    );
  }, [subProductsByProduct]);

  const activeProducts = useMemo(() => {
    return products.filter(isActiveProduct).length;
  }, [products]);

  /* -------------------------------------------------------
     FORM RESET
  ------------------------------------------------------- */

  const resetForm = () => {
    setForm({ ...EMPTY_FORM });
    setVariantForm({ ...EMPTY_VARIANT });

    setEditingProduct(null);
    setEditingVariantId(null);

    setVariants([]);

    setActiveSection("primary");

    setManualCategory("");
    setShowManualCategory(false);

    setManualUnit("");
    setShowManualUnit(false);
  };

  /* -------------------------------------------------------
     OPEN NEW PRODUCT
  ------------------------------------------------------- */

  const openNewProduct = () => {
    if (!permissions.canCreate) {
      setError("You do not have permission to create products.");
      return;
    }

    resetForm();

    setError("");
    setNotice("");

    setShowForm(true);
  };

  /* -------------------------------------------------------
     OPEN EDIT PRODUCT
  ------------------------------------------------------- */

  const openEditProduct = async (product) => {
    if (!permissions.canUpdate) {
      setError("You do not have permission to edit products.");
      return;
    }

    const normalized = normalizeProduct(product);

    setEditingProduct(normalized);

    setForm({
      sku: String(normalized.sku ?? ""),
      barcode: String(normalized.barcode ?? ""),
      productName: String(
        normalized.product_name ?? ""
      ),
      description: String(
        normalized.description ?? ""
      ),
      category: String(normalized.category ?? ""),
      unit: String(normalized.unit ?? "PCS"),
      itemType: String(
        normalized.item_type ?? "Stock Item"
      ),
      brand: String(normalized.brand ?? ""),
      model: String(normalized.model ?? ""),
      color: String(normalized.color ?? ""),
      size: String(normalized.size ?? ""),
      design: String(normalized.design ?? ""),
      salesUnit: String(
        normalized.sales_unit ?? "PCS"
      ),
      salePrice: String(
        normalized.sale_price ?? 0
      ),
      salesDescription: String(
        normalized.sales_description ?? ""
      ),
      salesAccount: String(
        normalized.sales_account ?? ""
      ),
      receivableAccount: String(
        normalized.receivable_account ?? ""
      ),
      purchaseUnit: String(
        normalized.purchase_unit ?? "PCS"
      ),
      costPrice: String(
        normalized.cost_price ?? 0
      ),
      purchaseDescription: String(
        normalized.purchase_description ?? ""
      ),
      purchaseAccount: String(
        normalized.purchase_account ?? ""
      ),
      inventoryAccount: String(
        normalized.inventory_account ?? ""
      ),
      cogsAccount: String(
        normalized.cogs_account ?? ""
      ),
      minimumStock: String(
        normalized.minimum_stock ?? 0
      ),
      isActive: isActiveProduct(normalized),
      image: String(normalized.image ?? ""),
      bannerSequence: String(
        normalized.banner_sequence ?? 0
      ),
    });

    setVariantForm({ ...EMPTY_VARIANT });
    setEditingVariantId(null);

    setActiveSection("primary");

    setError("");
    setNotice("");

    setShowForm(true);

    if (normalized.product_id != null) {
      await loadVariants(normalized.product_id);
    }
  };

  /* -------------------------------------------------------
     CLOSE FORM
  ------------------------------------------------------- */

  const closeForm = () => {
    setShowForm(false);

    resetForm();

    setError("");
    setNotice("");
  };

  /* -------------------------------------------------------
     SAVE PRODUCT
  ------------------------------------------------------- */

  const submitProduct = async (event) => {
    event?.preventDefault?.();

    setError("");
    setNotice("");

    const productIdForPermission = getProductId(editingProduct);
    const isEditingProduct = productIdForPermission != null;

    if (isEditingProduct && !permissions.canUpdate) {
      setError("You do not have permission to edit products.");
      return;
    }

    if (!isEditingProduct && !permissions.canCreate) {
      setError("You do not have permission to create products.");
      return;
    }

    if (!form.productName.trim()) {
      setError("Please enter the product name.");
      setActiveSection("primary");
      return;
    }

    if (!form.unit) {
      setError(
        "Please select a unit of measurement."
      );
      setActiveSection("primary");
      return;
    }

    const numericFields = [
      ["Sale Price", form.salePrice],
      ["Cost Price", form.costPrice],
      ["Minimum Stock", form.minimumStock],
      ["Banner Sequence", form.bannerSequence],
    ];

    for (const [label, value] of numericFields) {
      if (
        value !== "" &&
        !Number.isFinite(Number(value))
      ) {
        setError(`${label} must be a valid number.`);
        return;
      }

      if (
        value !== "" &&
        Number(value) < 0
      ) {
        setError(`${label} cannot be negative.`);
        return;
      }
    }

    setSaving(true);

    try {
      const payload = {
        sku: form.sku.trim(),
        barcode: form.barcode.trim() || null,

        productName: form.productName.trim(),
        description: form.description.trim(),

        category: form.category,
        unit: form.unit,
        itemType: form.itemType,

        brand: form.brand.trim(),
        model: form.model.trim(),
        color: form.color.trim(),
        size: form.size.trim(),
        design: form.design.trim(),

        salesUnit: form.salesUnit,
        salePrice: Number(form.salePrice || 0),

        salesDescription:
          form.salesDescription.trim(),

        salesAccount:
          form.salesAccount || null,

        receivableAccount:
          form.receivableAccount || null,

        purchaseUnit: form.purchaseUnit,
        costPrice: Number(form.costPrice || 0),

        purchaseDescription:
          form.purchaseDescription.trim(),

        purchaseAccount:
          form.purchaseAccount || null,

        inventoryAccount:
          form.inventoryAccount || null,

        cogsAccount:
          form.cogsAccount || null,

        minimumStock:
          Number(form.minimumStock || 0),

        isActive: Boolean(form.isActive),

        image: form.image.trim(),

        bannerSequence:
          Number(form.bannerSequence || 0),
      };

      const productId = getProductId(editingProduct);
      const isEditing = productId != null;

      const data = await request(
        isEditing
          ? `/api/products/${productId}`
          : "/api/products",
        {
          method: isEditing ? "PUT" : "POST",
          body: JSON.stringify(payload),
        }
      );

      const returnedProduct =
        data?.product ??
        data?.data?.product ??
        data?.data ??
        data;

      const returnedId =
        getProductId(returnedProduct) ?? productId;

      const refreshResults = await Promise.allSettled([
        loadProducts(),
        loadStock(),
      ]);

      if (
        refreshResults[0].status === "rejected"
      ) {
        console.error(
          "Product saved, but catalogue refresh failed:",
          refreshResults[0].reason
        );
      }

      if (
        refreshResults[1].status === "rejected"
      ) {
        console.error(
          "Product saved, but stock refresh failed:",
          refreshResults[1].reason
        );
      }

      if (returnedId != null) {
        const normalized = normalizeProduct({
          ...returnedProduct,

          product_id: returnedId,

          sku:
            returnedProduct?.sku ??
            payload.sku,

          product_name:
            returnedProduct?.product_name ??
            returnedProduct?.productName ??
            payload.productName,

          unit:
            returnedProduct?.unit ??
            payload.unit,
        });

        setEditingProduct(normalized);

        await loadVariants(returnedId);

        setNotice(
          isEditing
            ? "Product updated successfully."
            : "Product saved successfully. You can now add sub-products."
        );
      } else {
        const refreshed = await request("/api/products");

        const rows = getArray(refreshed, [
          "products",
          "data",
          "items",
        ]).map(normalizeProduct);

        setProducts(rows);

        const found = rows.find(
          (product) =>
            payload.sku &&
            String(product.sku).toLowerCase() ===
            payload.sku.toLowerCase()
        );

        if (found) {
          setEditingProduct(found);

          await loadVariants(found.product_id);
        }

        setNotice(
          found
            ? "Product saved successfully."
            : "Product saved. The API did not return the product ID, so confirm the product before adding sub-products."
        );
      }
    } catch (err) {
      setError(
        err.message || "Could not save the product."
      );
    } finally {
      setSaving(false);
    }
  };

  /* -------------------------------------------------------
     RESET VARIANT FORM
  ------------------------------------------------------- */

  const clearVariantForm = () => {
    setVariantForm({ ...EMPTY_VARIANT });
    setEditingVariantId(null);
  };

  /* -------------------------------------------------------
     EDIT VARIANT
  ------------------------------------------------------- */

  const editVariant = (variant) => {
    if (!permissions.canUpdate) {
      setError("You do not have permission to edit sub-products.");
      return;
    }

    setEditingVariantId(getVariantId(variant));

    setVariantForm({
      code: String(
        variant.sku ??
        variant.variant_sku ??
        variant.sub_product_code ??
        ""
      ),

      name: String(
        variant.sub_product_name ??
        variant.variant_name ??
        variant.name ??
        ""
      ),

      barcode: String(variant.barcode ?? ""),
      unit: String(variant.unit ?? "PCS"),

      units_per_parent: String(
        variant.units_per_parent ?? 1
      ),

      color: String(variant.color ?? ""),
      size: String(variant.size ?? ""),
      design: String(variant.design ?? ""),

      cost_price: String(
        variant.cost_price ?? 0
      ),

      sale_price: String(
        variant.sale_price ?? 0
      ),
    });

    setError("");
    setNotice("");
  };

  /* -------------------------------------------------------
     SAVE VARIANT
  ------------------------------------------------------- */

  const submitVariant = async (event) => {
    event.preventDefault();

    setError("");
    setNotice("");

    const isEditingVariant = editingVariantId != null;

    if (isEditingVariant && !permissions.canUpdate) {
      setError("You do not have permission to edit sub-products.");
      return;
    }

    if (!isEditingVariant && !permissions.canCreate) {
      setError("You do not have permission to create sub-products.");
      return;
    }

    const productId = getProductId(editingProduct);

    if (productId == null) {
      setError(
        "Save the main product first, then add sub-products."
      );

      setActiveSection("primary");
      return;
    }

    const code = variantForm.code.trim();
    const name = variantForm.name.trim();

    if (!code) {
      setError("Sub-product code is required.");
      return;
    }

    if (!name) {
      setError("Sub-product name is required.");
      return;
    }

    if (!variantForm.unit) {
      setError(
        "Please select a UOM for the sub-product."
      );
      return;
    }

    const unitsPerParent = Number(
      variantForm.units_per_parent
    );

    const costPrice = Number(
      variantForm.cost_price
    );

    const salePrice = Number(
      variantForm.sale_price
    );

    if (
      !Number.isFinite(unitsPerParent) ||
      unitsPerParent <= 0
    ) {
      setError(
        "Units per Main Product must be greater than zero."
      );
      return;
    }

    if (
      !Number.isFinite(costPrice) ||
      costPrice < 0 ||
      !Number.isFinite(salePrice) ||
      salePrice < 0
    ) {
      setError(
        "Cost price and sale price must be valid non-negative numbers."
      );
      return;
    }

    setSavingVariant(true);

    try {
      const payload = {
        variant_sku: code,
        variant_name: name,

        sku: code,
        sub_product_code: code,
        sub_product_name: name,

        barcode:
          variantForm.barcode.trim() || null,

        unit: variantForm.unit,

        units_per_parent: unitsPerParent,

        color: variantForm.color.trim(),
        size: variantForm.size.trim(),
        design: variantForm.design.trim(),

        cost_price: costPrice,
        sale_price: salePrice,
      };

      const baseUrl =
        `/api/products/${productId}/variants`;

      const variantId = editingVariantId;

      const data = await request(
        variantId
          ? `${baseUrl}/${variantId}`
          : baseUrl,
        {
          method: variantId ? "PUT" : "POST",
          body: JSON.stringify(payload),
        }
      );

      await Promise.all([
        loadVariants(productId),
        loadStock(),
      ]);

      clearVariantForm();

      setNotice(
        data?.message ||
        (variantId
          ? "Sub-product updated successfully."
          : "Sub-product added successfully.")
      );
    } catch (err) {
      setError(
        err.message || "Could not save the sub-product."
      );
    } finally {
      setSavingVariant(false);
    }
  };

  /* -------------------------------------------------------
     DELETE VARIANT
  ------------------------------------------------------- */

  const deleteVariant = async (variant) => {
    if (!permissions.canDelete) {
      setError("You do not have permission to delete sub-products.");
      return;
    }

    const productId = getProductId(editingProduct);
    const variantId = getVariantId(variant);

    if (
      productId == null ||
      variantId == null
    ) {
      setError(
        "Could not identify this sub-product."
      );
      return;
    }

    if (
      !window.confirm(
        `Delete sub-product "${variant.sub_product_name}"?`
      )
    ) {
      return;
    }

    setError("");
    setNotice("");

    try {
      await request(
        `/api/products/${productId}/variants/${variantId}`,
        { method: "DELETE" }
      );

      await loadVariants(productId);

      setNotice(
        "Sub-product deleted successfully."
      );
    } catch (err) {
      setError(
        err.message || "Could not delete the sub-product."
      );
    }
  };

  /* -------------------------------------------------------
     DELETE PRODUCT
  ------------------------------------------------------- */

  const deleteProduct = async (product) => {
    if (!permissions.canDelete) {
      setError("You do not have permission to delete products.");
      return;
    }

    const id = getProductId(product);

    if (id == null) {
      setError("Could not identify this product.");
      return;
    }

    if (
      !window.confirm(
        `Delete product "${product.product_name}"?`
      )
    ) {
      return;
    }

    setError("");
    setNotice("");

    try {
      await request(`/api/products/${id}`, {
        method: "DELETE",
      });

      await Promise.all([
        loadProducts(),
        loadStock(),
      ]);

      setNotice(
        "Product deleted successfully."
      );
    } catch (err) {
      setError(
        err.message || "Could not delete product."
      );
    }
  };

  /* -------------------------------------------------------
     ACCOUNT OPTIONS
  ------------------------------------------------------- */

  const accountOptions = (filter) =>
    accounts.filter((account) => {
      const text = [
        account.account_type,
        account.type,
        account.account_name,
        account.name,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      if (filter === "cash-bank") {
        return (
          account.is_cash_bank === true ||
          text.includes("cash") ||
          text.includes("bank")
        );
      }

      return true;
    });

  const renderAccountSelect = (
    label,
    fieldName,
    options = accounts
  ) => (
    <Field label={label}>
      <Select
        value={String(form[fieldName] ?? "")}
        onChange={(event) =>
          setField(fieldName, event.target.value)
        }
      >
        <option value="">
          {accounts.length === 0
            ? "No accounts available"
            : "Select account"}
        </option>

        {options.map((account) => {
          const id =
            account.account_id ??
            account.accountId ??
            account.id;

          const code =
            account.account_code ??
            account.accountCode ??
            account.code ??
            "";

          const name =
            account.account_name ??
            account.accountName ??
            account.name ??
            "Unnamed Account";

          if (id == null) return null;

          return (
            <option
              key={id}
              value={String(id)}
            >
              {code ? `${code} - ` : ""}
              {name}
            </option>
          );
        })}
      </Select>

      {accounts.length === 0 && (
        <p className="mt-2 text-xs text-amber-700">
          No accounts were loaded. Check the chart of
          accounts and browser console.
        </p>
      )}
    </Field>
  );

  /* -------------------------------------------------------
     MAIN PRODUCT STOCK CARD
  ------------------------------------------------------- */

  const mainStockCard = (
    <div className="relative overflow-hidden rounded-2xl border border-indigo-100 bg-gradient-to-r from-indigo-50 via-white to-blue-50 p-5">
      <div className="pointer-events-none absolute -right-6 -top-10 h-36 w-36 rounded-full bg-indigo-100/50 blur-2xl" />

      <div className="relative flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-indigo-100 p-3 text-indigo-700">
            <PackageCheck size={23} />
          </div>

          <div>
            <p className="font-bold text-slate-900">
              Main Product Available Stock
            </p>

            <p className="mt-1 text-xs leading-5 text-slate-500">
              Stock is displayed in the main product&apos;s
              unit of measurement.
            </p>
          </div>
        </div>

        <div className="rounded-xl border border-indigo-100 bg-white/90 px-5 py-3 text-right shadow-sm">
          <p className="text-2xl font-bold tabular-nums text-indigo-700">
            {formatQuantity(currentProductStock)}
          </p>

          <p className="mt-1 text-xs font-bold uppercase tracking-wider text-slate-500">
            {form.unit || "PCS"}
          </p>
        </div>
      </div>
    </div>
  );

  /* -------------------------------------------------------
     MANUAL REFRESH
  ------------------------------------------------------- */

  const refreshProducts = async () => {
    if (loading) return;

    setLoading(true);
    setError("");
    setNotice("");

    const results = await Promise.allSettled([
      loadProducts(),
      loadStock(),
    ]);

    const errors = results
      .filter((result) => result.status === "rejected")
      .map(
        (result) =>
          result.reason?.message ||
          "A refresh request failed."
      );

    if (errors.length > 0) {
      setError(errors.join(" "));
    } else {
      setNotice("Product catalogue refreshed.");
    }

    setLoading(false);
  };

  /* =========================================================
     RENDER
  ========================================================= */

  if (permissionsLoaded && accessDenied) {
    return (
      <main className="flex min-h-[70vh] items-center justify-center bg-slate-50 p-6 dark:bg-[#070d19]">
        <section className="w-full max-w-lg rounded-3xl border border-rose-200 bg-white p-8 text-center shadow-xl dark:border-rose-900/60 dark:bg-slate-900">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300">
            <LockKeyhole size={30} />
          </div>

          <h1 className="mt-5 text-2xl font-bold text-slate-900 dark:text-white">
            Access Denied
          </h1>

          <p className="mt-3 text-sm leading-6 text-slate-600 dark:text-slate-300">
            You do not have permission to view Products.
            Contact your administrator if you need access.
          </p>

          <button
            type="button"
            onClick={() => window.location.reload()}
            className="mt-6 inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-3 text-sm font-bold text-white transition hover:bg-blue-700"
          >
            <RefreshCw size={16} />
            Check Permission Again
          </button>
        </section>
      </main>
    );
  }

  return (
    <div className="products-page w-full min-w-0 text-slate-900 dark:text-slate-100">
      <div className="mx-auto w-full min-w-0 max-w-[1600px]">

        {/* PAGE HEADING */}

        <div className="mb-8 flex flex-col justify-between gap-5 lg:flex-row lg:items-center">
          <div className="flex items-center gap-4">
            <div className="relative flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-600 to-blue-600 text-white shadow-lg shadow-indigo-600/20">
              <Package
                size={27}
                strokeWidth={1.8}
              />

              <span className="absolute -bottom-1 -right-1 h-4 w-4 rounded-full border-[3px] border-white bg-emerald-400" />
            </div>

            <div>
              <div className="mb-1 flex flex-wrap items-center gap-2">
                <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
                  Product Master
                </h1>

                <span className="rounded-full border border-indigo-100 bg-indigo-50 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-indigo-700">
                  Inventory
                </span>
              </div>

              <p className="max-w-xl text-sm leading-6 text-slate-500">
                Manage your product catalogue, variants,
                pricing, accounting and inventory in one place.
              </p>
            </div>
          </div>

          {!showForm && permissions.canCreate && (
            <ActionButton
              variant="primary"
              onClick={openNewProduct}
              className="min-h-12 px-5"
            >
              <Plus size={19} />
              Add New Product
              <ArrowUpRight
                size={16}
                className="ml-1 opacity-70"
              />
            </ActionButton>
          )}
        </div>

        {/* NOTIFICATIONS */}

        <Notification
          type="error"
          message={error}
          onClose={() => setError("")}
        />

        <Notification
          type="success"
          message={notice}
          onClose={() => setNotice("")}
        />

        {!showForm ? (
          <>
            {/* SUMMARY CARDS */}

            <div className="mb-7 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
              <SummaryCard
                title="Total Products"
                value={products.length}
                description="All registered products"
                icon={Package}
                color="blue"
              />

              <SummaryCard
                title="Total Sub-Products"
                value={totalSubProducts}
                description="Variants across your catalogue"
                icon={Boxes}
                color="purple"
              />

              <SummaryCard
                title="Active Products"
                value={activeProducts}
                description={`${Math.max(
                  0,
                  products.length - activeProducts
                )} inactive product(s)`}
                icon={CheckCircle2}
                color="green"
              />
            </div>

            {/* PRODUCT CATALOGUE */}

            <section className="min-w-0">
              {/* TABLE HEADER */}

              <div className="border-b border-slate-100 p-5 sm:p-6">
                <div className="flex flex-col justify-between gap-5 xl:flex-row xl:items-center">
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="text-lg font-bold tracking-tight text-slate-900">
                        Product Catalogue
                      </h2>

                      <span className="rounded-lg bg-slate-100 px-2 py-1 text-xs font-bold tabular-nums text-slate-600">
                        {filteredProducts.length}
                      </span>
                    </div>

                    <p className="mt-1.5 text-sm text-slate-500">
                      View, search, edit and maintain your products.
                    </p>
                  </div>

                  <div className="flex flex-col gap-3 sm:flex-row">

                    {/* SEARCH */}

                    <div className="relative min-w-0 sm:w-72">
                      <Search
                        size={18}
                        className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
                      />

                      <Input
                        value={search}
                        onChange={(event) =>
                          setSearch(event.target.value)
                        }
                        placeholder="Search code, name, barcode..."
                        className="pl-10"
                      />
                    </div>

                    {/* STATUS FILTER */}

                    <div className="relative sm:w-40">
                      <SlidersHorizontal
                        size={15}
                        className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                      />

                      <Select
                        value={statusFilter}
                        onChange={(event) =>
                          setStatusFilter(event.target.value)
                        }
                        className="pl-9"
                        aria-label="Filter products by status"
                      >
                        <option value="all">
                          All statuses
                        </option>

                        <option value="active">
                          Active only
                        </option>

                        <option value="inactive">
                          Inactive only
                        </option>
                      </Select>
                    </div>

                    {/* REFRESH */}

                    <ActionButton
                      onClick={refreshProducts}
                      disabled={loading}
                    >
                      <RefreshCw
                        size={16}
                        className={
                          loading ? "animate-spin" : ""
                        }
                      />

                      Refresh
                    </ActionButton>

                    {/* COLUMN PICKER */}

                    <ColumnToggle
                      columns={PRODUCT_COLUMNS}
                      state={productCols}
                    />
                  </div>
                </div>
              </div>

              {/* TABLE */}

              <div className="w-full overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50/90 text-[10px] uppercase tracking-[0.12em] text-slate-500">
                      {productCols.visible.product && (
                        <th className="px-5 py-4 font-bold">Product</th>
                      )}
                      {productCols.visible.category && (
                        <th className="px-4 py-4 font-bold">Category</th>
                      )}
                      {productCols.visible.uom && (
                        <th className="px-4 py-4 font-bold">UOM</th>
                      )}
                      {productCols.visible.stock && (
                        <th className="px-4 py-4 text-right font-bold">
                          Available Stock
                        </th>
                      )}
                      {productCols.visible.cost && (
                        <th className="px-4 py-4 text-right font-bold">
                          Cost Price
                        </th>
                      )}
                      {productCols.visible.sale && (
                        <th className="px-4 py-4 text-right font-bold">
                          Sale Price
                        </th>
                      )}
                      {productCols.visible.status && (
                        <th className="px-4 py-4 font-bold">Status</th>
                      )}
                      {productCols.visible.actions && (
                        <th className="px-5 py-4 text-right font-bold">
                          Actions
                        </th>
                      )}
                    </tr>
                  </thead>

                  <tbody className="divide-y divide-slate-100">
                    {loading ? (
                      <tr>
                        <td
                          colSpan={productCols.count}
                          className="px-5 py-16 text-center"
                        >
                          <RefreshCw
                            size={23}
                            className="mx-auto mb-3 animate-spin text-indigo-500"
                          />

                          <p className="font-medium text-slate-700">
                            Loading product catalogue...
                          </p>

                          <p className="mt-1 text-xs text-slate-400">
                            Fetching products and inventory.
                          </p>
                        </td>
                      </tr>
                    ) : filteredProducts.length === 0 ? (
                      <tr>
                        <td colSpan={productCols.count}>
                          <EmptyState
                            icon={Package}
                            title={
                              search || statusFilter !== "all"
                                ? "No matching products"
                                : "Your catalogue is empty"
                            }
                            description={
                              search || statusFilter !== "all"
                                ? "Try another search term or change the status filter."
                                : "Create your first product to start managing inventory."
                            }
                          />
                        </td>
                      </tr>
                    ) : (
                      filteredProducts.map((product) => {
                        const id = getProductId(product);

                        const stock =
                          productStock.get(String(id)) ?? 0;

                        const active =
                          isActiveProduct(product);

                        const lowStock =
                          Number(product.minimum_stock || 0) > 0 &&
                          stock <=
                          Number(product.minimum_stock || 0);

                        return (
                          <tr
                            key={id ?? product.sku}
                            className="group transition-colors duration-150 hover:bg-indigo-50/40"
                          >
                            {/* PRODUCT */}

                            {productCols.visible.product && (
                              <td className="px-5 py-4">
                                <div className="flex items-center gap-3">
                                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-gradient-to-br from-slate-50 to-indigo-50 text-indigo-600 transition group-hover:border-indigo-100 group-hover:from-indigo-50 group-hover:to-blue-50">
                                    <Package
                                      size={20}
                                      strokeWidth={1.8}
                                    />
                                  </div>

                                  <div className="min-w-0">
                                    <p className="max-w-[260px] truncate font-bold text-slate-900">
                                      {product.product_name ||
                                        "Unnamed Product"}
                                    </p>

                                    <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-500">
                                      <span className="inline-flex items-center gap-1 font-semibold text-indigo-600">
                                        <Hash size={12} />

                                        {product.sku || "No SKU"}
                                      </span>

                                      {product.barcode && (
                                        <span className="inline-flex items-center gap-1">
                                          <Barcode size={12} />

                                          {product.barcode}
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              </td>
                            )}

                            {/* CATEGORY */}

                            {productCols.visible.category && (
                              <td className="px-4 py-4">
                                <span className="inline-flex rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-600">
                                  {product.category ||
                                    "Uncategorized"}
                                </span>
                              </td>
                            )}

                            {/* UOM */}

                            {productCols.visible.uom && (
                              <td className="px-4 py-4">
                                <span className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-700">
                                  <Ruler
                                    size={13}
                                    className="text-slate-400"
                                  />

                                  {product.unit || "PCS"}
                                </span>
                              </td>
                            )}

                            {/* STOCK */}

                            {productCols.visible.stock && (
                              <td className="px-4 py-4 text-right">
                                <div
                                  className={`inline-flex flex-col items-end rounded-lg px-2.5 py-1.5 ${lowStock
                                    ? "bg-amber-50 text-amber-800"
                                    : "text-slate-800"
                                    }`}
                                >
                                  <span className="font-bold tabular-nums">
                                    {formatQuantity(stock)}
                                  </span>

                                  <span className="text-[10px] font-semibold uppercase tracking-wider opacity-70">
                                    {product.unit || "PCS"}
                                  </span>
                                </div>
                              </td>
                            )}

                            {/* COST */}

                            {productCols.visible.cost && (
                              <td className="whitespace-nowrap px-4 py-4 text-right tabular-nums text-slate-600">
                                {money(product.cost_price)}
                              </td>
                            )}

                            {/* SALE */}

                            {productCols.visible.sale && (
                              <td className="whitespace-nowrap px-4 py-4 text-right">
                                <span className="font-bold tabular-nums text-slate-900">
                                  {money(product.sale_price)}
                                </span>
                              </td>
                            )}

                            {/* STATUS */}

                            {productCols.visible.status && (
                              <td className="px-4 py-4">
                                <span
                                  className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1.5 text-xs font-semibold ${active
                                    ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                                    : "border-slate-200 bg-slate-100 text-slate-500"
                                    }`}
                                >
                                  <span
                                    className={`h-1.5 w-1.5 rounded-full ${active
                                      ? "bg-emerald-500"
                                      : "bg-slate-400"
                                      }`}
                                  />

                                  {active ? "Active" : "Inactive"}
                                </span>
                              </td>
                            )}

                            {/* ACTIONS */}

                            {productCols.visible.actions && (
                              <td className="px-5 py-4">
                                <div className="flex justify-end gap-2">
                                  {permissions.canUpdate && (
                                    <button
                                      type="button"
                                      onClick={() =>
                                        openEditProduct(product)
                                      }
                                      title="Edit product"
                                      aria-label={`Edit ${product.product_name}`}
                                      className="rounded-xl border border-slate-200 bg-white p-2.5 text-slate-500 shadow-sm transition hover:border-indigo-200 hover:bg-indigo-50 hover:text-indigo-600 focus:outline-none focus:ring-4 focus:ring-indigo-500/10"
                                    >
                                      <Edit size={16} />
                                    </button>
                                  )}

                                  {permissions.canDelete && (
                                    <button
                                      type="button"
                                      onClick={() =>
                                        deleteProduct(product)
                                      }
                                      title="Delete product"
                                      aria-label={`Delete ${product.product_name}`}
                                      className="rounded-xl border border-slate-200 bg-white p-2.5 text-slate-500 shadow-sm transition hover:border-rose-200 hover:bg-rose-50 hover:text-rose-600 focus:outline-none focus:ring-4 focus:ring-rose-500/10"
                                    >
                                      <Trash2 size={16} />
                                    </button>
                                  )}

                                  {!permissions.canUpdate &&
                                    !permissions.canDelete && (
                                      <span className="text-xs text-slate-400">
                                        No actions available
                                      </span>
                                    )}
                                </div>
                              </td>
                            )}
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>

              {/* TABLE FOOTER */}

              <div className="flex flex-col justify-between gap-2 border-t border-slate-100 bg-slate-50/70 px-5 py-4 text-xs text-slate-500 sm:flex-row sm:items-center">
                <span>
                  Showing{" "}

                  <strong className="text-slate-800">
                    {filteredProducts.length}
                  </strong>{" "}

                  of{" "}

                  <strong className="text-slate-800">
                    {products.length}
                  </strong>{" "}

                  products
                </span>

                <span className="inline-flex items-center gap-1.5">
                  <Package size={13} />
                  Product Master
                </span>
              </div>
            </section>
          </>
        ) : (
          /* =================================================
             PRODUCT FORM
          ================================================= */

          <section className="overflow-hidden">

            {/* FORM HEADER */}

            <div className="relative overflow-hidden px-5 py-6 sm:px-7">

              <div className="pointer-events-none absolute -right-10 -top-20 h-48 w-48 rounded-full bg-indigo-100/40 blur-3xl" />

              <div className="relative flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={closeForm}
                    className="rounded-xl border border-slate-200 bg-white p-2.5 text-slate-600 shadow-sm transition hover:border-indigo-200 hover:bg-indigo-50 hover:text-indigo-600"
                    title="Back to product list"
                  >
                    <ChevronLeft size={20} />
                  </button>

                  <div>
                    <div className="mb-1.5 flex flex-wrap items-center gap-2">
                      <h2 className="text-xl font-bold tracking-tight text-slate-900">
                        {editingProduct
                          ? "Edit Product"
                          : "Create New Product"}
                      </h2>

                      <span className="rounded-full border border-indigo-100 bg-white px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-indigo-600">
                        {editingProduct
                          ? "Editing"
                          : "New Entry"}
                      </span>
                    </div>

                    <p className="text-sm text-slate-500">
                      {currentProductId != null
                        ? `Product ID: ${currentProductId}`
                        : "Enter product details and save before adding sub-products."}
                    </p>
                  </div>
                </div>

                <ActionButton onClick={closeForm}>
                  <X size={16} />
                  Close Form
                </ActionButton>
              </div>
            </div>

            <div className="space-y-6 p-4 sm:p-6 lg:p-7">
              {currentProductId != null && mainStockCard}

              {/* SECTION TABS */}

              <div className="p-2">
                <div className="flex gap-2 overflow-x-auto">
                  {SECTIONS.map((section, index) => {
                    const Icon = section.icon;

                    const selected =
                      activeSection === section.id;

                    const sectionVariants =
                      subProductsByProduct[
                      String(currentProductId)
                      ] || [];

                    return (
                      <button
                        key={section.id}
                        type="button"
                        onClick={() =>
                          setActiveSection(section.id)
                        }
                        className={`relative inline-flex shrink-0 items-center gap-2.5 rounded-xl px-4 py-3 text-sm font-semibold transition duration-200 ${selected
                          ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/20"
                          : "border border-transparent bg-white/60 text-slate-600 hover:border-slate-200 hover:bg-white hover:text-slate-900"
                          }`}
                      >
                        <Icon size={17} />

                        {section.label}

                        {section.id === "subproducts" && (
                          <span
                            className={`min-w-5 rounded-full px-1.5 py-0.5 text-[10px] font-bold ${selected
                              ? "bg-white/20 text-white"
                              : "bg-slate-100 text-slate-600"
                              }`}
                          >
                            {variants.length ||
                              sectionVariants.length}
                          </span>
                        )}

                        {selected && (
                          <span className="absolute inset-x-4 -bottom-2 h-0.5 rounded-full bg-indigo-300" />
                        )}

                        <span className="sr-only">
                          Section {index + 1}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* =================================================
                  PRIMARY SECTION
              ================================================= */}

              {activeSection === "primary" && (
                <div className="space-y-6">
                  <SectionHeading
                    eyebrow="Product details"
                    title="Primary Information"
                    description="Set up the product identity, classification, measurements and general details."
                    icon={Package}
                  />

                  {/* IDENTIFICATION */}

                  <div className="p-4 sm:p-6">
                    <div className="mb-5 flex items-center gap-2 border-b border-slate-100 pb-3">
                      <div className="h-5 w-1 rounded-full bg-indigo-500" />

                      <h4 className="text-sm font-bold text-slate-800">
                        Identification
                      </h4>
                    </div>

                    <div className="grid grid-cols-1 gap-x-5 gap-y-5 md:grid-cols-2 xl:grid-cols-3">

                      <Field label="Product Code / SKU">
                        <Input
                          value={form.sku}
                          onChange={(event) =>
                            setField("sku", event.target.value)
                          }
                          placeholder="e.g. ITEM-001"
                        />
                      </Field>

                      <Field
                        label="Product Name"
                        required
                      >
                        <Input
                          value={form.productName}
                          onChange={(event) =>
                            setField(
                              "productName",
                              event.target.value
                            )
                          }
                          placeholder="Enter product name"
                          required
                        />
                      </Field>

                      <Field label="Barcode">
                        <div className="relative">
                          <Barcode
                            size={17}
                            className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
                          />

                          <Input
                            value={form.barcode}
                            onChange={(event) =>
                              setField(
                                "barcode",
                                event.target.value
                              )
                            }
                            placeholder="Scan or enter barcode"
                            className="pl-10"
                          />
                        </div>
                      </Field>

                      {/* CATEGORY */}

                      <Field label="Category">
                        {showManualCategory ? (
                          <div className="flex gap-2">
                            <Input
                              value={manualCategory}
                              onChange={(event) =>
                                setManualCategory(
                                  event.target.value
                                )
                              }
                              placeholder="New category"
                              autoFocus
                              onKeyDown={(event) => {
                                if (event.key === "Enter") {
                                  event.preventDefault();

                                  const value =
                                    manualCategory.trim();

                                  if (value) {
                                    setField(
                                      "category",
                                      value
                                    );

                                    setManualCategory("");
                                    setShowManualCategory(false);
                                  }
                                }

                                if (event.key === "Escape") {
                                  setShowManualCategory(false);
                                }
                              }}
                            />

                            <ActionButton
                              variant="primary"
                              onClick={() => {
                                const value =
                                  manualCategory.trim();

                                if (value) {
                                  setField(
                                    "category",
                                    value
                                  );

                                  setManualCategory("");
                                  setShowManualCategory(false);
                                }
                              }}
                              className="shrink-0"
                            >
                              Add
                            </ActionButton>
                          </div>
                        ) : (
                          <Select
                            value={form.category}
                            onChange={(event) => {
                              if (
                                event.target.value ===
                                "__add_category__"
                              ) {
                                setShowManualCategory(true);
                                return;
                              }

                              setField(
                                "category",
                                event.target.value
                              );
                            }}
                          >
                            <option value="">
                              Select category
                            </option>

                            {CATEGORIES.map((category) => (
                              <option
                                key={category}
                                value={category}
                              >
                                {category}
                              </option>
                            ))}

                            {form.category &&
                              !CATEGORIES.includes(
                                form.category
                              ) && (
                                <option value={form.category}>
                                  {form.category}
                                </option>
                              )}

                            <option value="__add_category__">
                              + Add category
                            </option>
                          </Select>
                        )}
                      </Field>

                      {/* UNIT */}

                      <Field
                        label="Unit of Measurement"
                        required
                      >
                        {showManualUnit ? (
                          <div className="flex gap-2">
                            <Input
                              value={manualUnit}
                              onChange={(event) =>
                                setManualUnit(
                                  event.target.value
                                )
                              }
                              placeholder="New unit"
                              autoFocus
                              onKeyDown={(event) => {
                                if (event.key === "Enter") {
                                  event.preventDefault();

                                  const value =
                                    manualUnit.trim();

                                  if (value) {
                                    setField("unit", value);

                                    setManualUnit("");
                                    setShowManualUnit(false);
                                  }
                                }

                                if (event.key === "Escape") {
                                  setShowManualUnit(false);
                                }
                              }}
                            />

                            <ActionButton
                              variant="primary"
                              onClick={() => {
                                const value =
                                  manualUnit.trim();

                                if (value) {
                                  setField("unit", value);

                                  setManualUnit("");
                                  setShowManualUnit(false);
                                }
                              }}
                              className="shrink-0"
                            >
                              Add
                            </ActionButton>
                          </div>
                        ) : (
                          <Select
                            value={form.unit}
                            onChange={(event) => {
                              if (
                                event.target.value ===
                                "__add_unit__"
                              ) {
                                setShowManualUnit(true);
                                return;
                              }

                              setField(
                                "unit",
                                event.target.value
                              );
                            }}
                            required
                          >
                            {UNITS.map((unit) => (
                              <option
                                key={unit}
                                value={unit}
                              >
                                {unit}
                              </option>
                            ))}

                            {form.unit &&
                              !UNITS.includes(form.unit) && (
                                <option value={form.unit}>
                                  {form.unit}
                                </option>
                              )}

                            <option value="__add_unit__">
                              + Add unit
                            </option>
                          </Select>
                        )}
                      </Field>

                      <Field label="Item Type">
                        <Select
                          value={form.itemType}
                          onChange={(event) =>
                            setField(
                              "itemType",
                              event.target.value
                            )
                          }
                        >
                          <option value="Stock Item">
                            Stock Item
                          </option>

                          <option value="Service">
                            Service
                          </option>

                          <option value="Non Stock Item">
                            Non Stock Item
                          </option>
                        </Select>
                      </Field>
                    </div>
                  </div>

                  {/* PRODUCT ATTRIBUTES */}

                  <div className="p-4 sm:p-6">
                    <div className="mb-5 flex items-center gap-2 border-b border-slate-100 pb-3">
                      <div className="h-5 w-1 rounded-full bg-violet-500" />

                      <h4 className="text-sm font-bold text-slate-800">
                        Product Attributes
                      </h4>
                    </div>

                    <div className="grid grid-cols-1 gap-x-5 gap-y-5 md:grid-cols-2 xl:grid-cols-3">
                      <Field label="Brand">
                        <Input
                          value={form.brand}
                          onChange={(event) =>
                            setField("brand", event.target.value)
                          }
                          placeholder="Brand"
                        />
                      </Field>

                      <Field label="Model">
                        <Input
                          value={form.model}
                          onChange={(event) =>
                            setField("model", event.target.value)
                          }
                          placeholder="Model"
                        />
                      </Field>

                      <Field label="Color">
                        <Input
                          value={form.color}
                          onChange={(event) =>
                            setField("color", event.target.value)
                          }
                          placeholder="Color"
                        />
                      </Field>

                      <Field label="Size">
                        <Input
                          value={form.size}
                          onChange={(event) =>
                            setField("size", event.target.value)
                          }
                          placeholder="Size"
                        />
                      </Field>

                      <Field label="Design">
                        <Input
                          value={form.design}
                          onChange={(event) =>
                            setField("design", event.target.value)
                          }
                          placeholder="Design"
                        />
                      </Field>

                      <Field
                        label="Minimum Stock"
                        hint="Used as a reference for low-stock monitoring."
                      >
                        <Input
                          type="number"
                          min="0"
                          step="0.001"
                          value={form.minimumStock}
                          onChange={(event) =>
                            setField(
                              "minimumStock",
                              event.target.value
                            )
                          }
                        />
                      </Field>
                    </div>
                  </div>

                  {/* ADDITIONAL INFORMATION */}

                  <div className="p-4 sm:p-6">
                    <div className="mb-5 flex items-center gap-2 border-b border-slate-100 pb-3">
                      <div className="h-5 w-1 rounded-full bg-emerald-500" />

                      <h4 className="text-sm font-bold text-slate-800">
                        Additional Information
                      </h4>
                    </div>

                    <div className="grid grid-cols-1 gap-x-5 gap-y-5 md:grid-cols-2 xl:grid-cols-3">

                      <Field label="Image URL">
                        <div className="relative">
                          <ImageIcon
                            size={17}
                            className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
                          />

                          <Input
                            value={form.image}
                            onChange={(event) =>
                              setField(
                                "image",
                                event.target.value
                              )
                            }
                            placeholder="Optional image URL"
                            className="pl-10"
                          />
                        </div>
                      </Field>

                      <Field label="Banner Sequence">
                        <Input
                          type="number"
                          min="0"
                          value={form.bannerSequence}
                          onChange={(event) =>
                            setField(
                              "bannerSequence",
                              event.target.value
                            )
                          }
                        />
                      </Field>

                      <Field label="Status">
                        <Select
                          value={
                            form.isActive
                              ? "active"
                              : "inactive"
                          }
                          onChange={(event) =>
                            setField(
                              "isActive",
                              event.target.value === "active"
                            )
                          }
                        >
                          <option value="active">
                            Active
                          </option>

                          <option value="inactive">
                            Inactive
                          </option>
                        </Select>
                      </Field>

                      <Field
                        label="Description"
                        className="md:col-span-2 xl:col-span-3"
                      >
                        <TextArea
                          rows={3}
                          value={form.description}
                          onChange={(event) =>
                            setField(
                              "description",
                              event.target.value
                            )
                          }
                          placeholder="Enter product details, specifications or notes..."
                        />
                      </Field>
                    </div>
                  </div>
                </div>
              )}

              {/* =================================================
                  SUB-PRODUCTS SECTION
              ================================================= */}

              {activeSection === "subproducts" && (
                <div className="space-y-6">
                  <SectionHeading
                    eyebrow="Product variations"
                    title="Sub-Products & Variants"
                    description="Create variant codes and barcodes, define unit conversions, and manage variant-level prices."
                    icon={Layers3}
                  />

                  {currentProductId == null && (
                    <div className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
                      <AlertCircle
                        size={19}
                        className="mt-0.5 shrink-0"
                      />

                      <div>
                        <p className="font-bold">
                          Save the main product first
                        </p>

                        <p className="mt-1 leading-5 text-amber-800">
                          Sub-products can be added after
                          the main product has been saved
                          and has an ID.
                        </p>
                      </div>
                    </div>
                  )}

                  {/* VARIANT FORM */}

                  {(
                    (editingVariantId == null && permissions.canCreate) ||
                    (editingVariantId != null && permissions.canUpdate)
                  ) && (
                      <form
                        onSubmit={submitVariant}
                        className="overflow-hidden"
                      >
                        <div className="flex flex-col justify-between gap-3 border-b border-slate-100 bg-slate-50/80 px-5 py-4 sm:flex-row sm:items-center">
                          <div className="flex items-center gap-3">
                            <div className="rounded-xl bg-indigo-100 p-2.5 text-indigo-700">
                              {editingVariantId != null ? (
                                <Edit size={19} />
                              ) : (
                                <Plus size={19} />
                              )}
                            </div>

                            <div>
                              <h4 className="font-bold text-slate-900">
                                {editingVariantId != null
                                  ? "Edit Sub-Product"
                                  : "Add a Sub-Product"}
                              </h4>

                              <p className="mt-1 text-xs text-slate-500">
                                Fields marked with * are required.
                              </p>
                            </div>
                          </div>

                          {editingVariantId != null && (
                            <button
                              type="button"
                              onClick={clearVariantForm}
                              className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-500 transition hover:text-rose-600"
                            >
                              <X size={15} />
                              Cancel edit
                            </button>
                          )}
                        </div>

                        <div className="grid grid-cols-1 gap-x-5 gap-y-5 p-5 md:grid-cols-2 xl:grid-cols-3">

                          <Field
                            label="Sub-Product Code"
                            required
                          >
                            <Input
                              value={variantForm.code}
                              onChange={(event) =>
                                setVariantField(
                                  "code",
                                  event.target.value
                                )
                              }
                              placeholder="e.g. ITEM-001-PCS"
                              required
                            />
                          </Field>

                          <Field
                            label="Sub-Product Name"
                            required
                          >
                            <Input
                              value={variantForm.name}
                              onChange={(event) =>
                                setVariantField(
                                  "name",
                                  event.target.value
                                )
                              }
                              placeholder="e.g. Single Piece"
                              required
                            />
                          </Field>

                          <Field label="Barcode">
                            <Input
                              value={variantForm.barcode}
                              onChange={(event) =>
                                setVariantField(
                                  "barcode",
                                  event.target.value
                                )
                              }
                              placeholder="Scan or enter barcode"
                            />
                          </Field>

                          <Field
                            label="Sub-Product Unit"
                            required
                          >
                            <Select
                              value={variantForm.unit}
                              onChange={(event) =>
                                setVariantField(
                                  "unit",
                                  event.target.value
                                )
                              }
                              required
                            >
                              {UNITS.map((unit) => (
                                <option
                                  key={unit}
                                  value={unit}
                                >
                                  {unit}
                                </option>
                              ))}
                            </Select>
                          </Field>

                          <Field
                            label="Units per Main Product"
                            required
                            hint={`Example: one ${form.unit || "BOX"
                              } contains 10 PCS, so enter 10.`}
                          >
                            <Input
                              type="number"
                              min="0.001"
                              step="0.001"
                              value={
                                variantForm.units_per_parent
                              }
                              onChange={(event) =>
                                setVariantField(
                                  "units_per_parent",
                                  event.target.value
                                )
                              }
                              required
                            />
                          </Field>

                          <Field label="Color">
                            <Input
                              value={variantForm.color}
                              onChange={(event) =>
                                setVariantField(
                                  "color",
                                  event.target.value
                                )
                              }
                              placeholder="Color"
                            />
                          </Field>

                          <Field label="Size">
                            <Input
                              value={variantForm.size}
                              onChange={(event) =>
                                setVariantField(
                                  "size",
                                  event.target.value
                                )
                              }
                              placeholder="Size"
                            />
                          </Field>

                          <Field label="Design">
                            <Input
                              value={variantForm.design}
                              onChange={(event) =>
                                setVariantField(
                                  "design",
                                  event.target.value
                                )
                              }
                              placeholder="Design"
                            />
                          </Field>

                          <Field label="Cost Price">
                            <Input
                              type="number"
                              min="0"
                              step="0.01"
                              value={variantForm.cost_price}
                              onChange={(event) =>
                                setVariantField(
                                  "cost_price",
                                  event.target.value
                                )
                              }
                            />
                          </Field>

                          <Field label="Sale Price">
                            <Input
                              type="number"
                              min="0"
                              step="0.01"
                              value={variantForm.sale_price}
                              onChange={(event) =>
                                setVariantField(
                                  "sale_price",
                                  event.target.value
                                )
                              }
                            />
                          </Field>
                        </div>

                        {/* VARIANT ACTIONS */}

                        <div className="flex flex-wrap gap-2 border-t border-slate-100 bg-slate-50/50 px-5 py-4">
                          <ActionButton
                            type="submit"
                            variant="primary"
                            disabled={
                              savingVariant ||
                              currentProductId == null
                            }
                          >
                            {savingVariant ? (
                              <RefreshCw
                                size={16}
                                className="animate-spin"
                              />
                            ) : (
                              <Save size={16} />
                            )}

                            {savingVariant
                              ? "Saving..."
                              : editingVariantId != null
                                ? "Update Sub-Product"
                                : "Save Sub-Product"}
                          </ActionButton>

                          <ActionButton
                            onClick={clearVariantForm}
                          >
                            <X size={16} />
                            Clear Fields
                          </ActionButton>
                        </div>
                      </form>
                    )}

                  {/* SAVED VARIANTS
                      (no overflow-hidden here, so the column dropdown is not clipped) */}

                  <div>
                    <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
                      <div>
                        <h4 className="font-bold text-slate-900">
                          Saved Sub-Products
                        </h4>

                        <p className="mt-1 text-xs text-slate-500">
                          {variants.length} variant(s) registered
                        </p>
                      </div>

                      <div className="flex items-center gap-2">
                        <span className="rounded-xl bg-violet-50 px-3 py-2 text-xs font-bold text-violet-700">
                          {variants.length} total
                        </span>

                        <ColumnToggle
                          columns={VARIANT_COLUMNS}
                          state={variantCols}
                        />
                      </div>
                    </div>

                    <div className="w-full overflow-x-auto">
                      <table className="w-full text-left text-sm">
                        <thead>
                          <tr className="border-b border-slate-200 bg-slate-50 text-[10px] uppercase tracking-wider text-slate-500">
                            {variantCols.visible.code && (
                              <th className="px-4 py-3.5 font-bold">Code</th>
                            )}
                            {variantCols.visible.name && (
                              <th className="px-4 py-3.5 font-bold">
                                Sub-Product
                              </th>
                            )}
                            {variantCols.visible.uom && (
                              <th className="px-3 py-3.5 font-bold">UOM</th>
                            )}
                            {variantCols.visible.color && (
                              <th className="px-3 py-3.5 font-bold">Color</th>
                            )}
                            {variantCols.visible.size && (
                              <th className="px-3 py-3.5 font-bold">Size</th>
                            )}
                            {variantCols.visible.barcode && (
                              <th className="px-3 py-3.5 font-bold">
                                Barcode
                              </th>
                            )}
                            {variantCols.visible.stock && (
                              <th className="px-4 py-3.5 text-right font-bold">
                                Available Stock
                              </th>
                            )}
                            {variantCols.visible.conversion && (
                              <th className="px-4 py-3.5 text-right font-bold">
                                Conversion
                              </th>
                            )}
                            {variantCols.visible.cost && (
                              <th className="px-4 py-3.5 text-right font-bold">
                                Cost
                              </th>
                            )}
                            {variantCols.visible.sale && (
                              <th className="px-4 py-3.5 text-right font-bold">
                                Sale
                              </th>
                            )}
                            {variantCols.visible.actions && (
                              <th className="px-4 py-3.5 text-right font-bold">
                                Actions
                              </th>
                            )}
                          </tr>
                        </thead>

                        <tbody className="divide-y divide-slate-100">
                          {currentProductId == null ? (
                            <tr>
                              <td colSpan={variantCols.count}>
                                <EmptyState
                                  title="Main product not saved"
                                  description="Save the main product before creating variants."
                                />
                              </td>
                            </tr>
                          ) : variants.length === 0 ? (
                            <tr>
                              <td colSpan={variantCols.count}>
                                <EmptyState
                                  icon={Boxes}
                                  title="No sub-products yet"
                                  description="Add your first sub-product using the form above."
                                />
                              </td>
                            </tr>
                          ) : (
                            variants.map((variant) => (
                              <tr
                                key={
                                  getVariantId(variant) ??
                                  `${variant.sku}-${variant.barcode}`
                                }
                                className="transition-colors hover:bg-indigo-50/40"
                              >
                                {variantCols.visible.code && (
                                  <td className="px-4 py-3.5 font-bold text-indigo-700">
                                    {variant.sku || "—"}
                                  </td>
                                )}

                                {variantCols.visible.name && (
                                  <td className="px-4 py-3.5 font-semibold text-slate-800">
                                    {variant.sub_product_name || "—"}
                                  </td>
                                )}

                                {variantCols.visible.uom && (
                                  <td className="px-3 py-3.5">
                                    <span className="rounded-md bg-slate-100 px-2 py-1 text-xs font-bold text-slate-700">
                                      {variant.unit || "PCS"}
                                    </span>
                                  </td>
                                )}

                                {variantCols.visible.color && (
                                  <td className="px-3 py-3.5 text-slate-600">
                                    {variant.color || "—"}
                                  </td>
                                )}

                                {variantCols.visible.size && (
                                  <td className="px-3 py-3.5 text-slate-600">
                                    {variant.size || "—"}
                                  </td>
                                )}

                                {variantCols.visible.barcode && (
                                  <td className="px-3 py-3.5 text-slate-600">
                                    {variant.barcode || "—"}
                                  </td>
                                )}

                                {variantCols.visible.stock && (
                                  <td className="px-4 py-3.5 text-right">
                                    <span className="font-bold tabular-nums text-slate-800">
                                      {formatQuantity(
                                        variant.available_stock
                                      )}
                                    </span>

                                    <span className="ml-1 text-xs text-slate-500">
                                      {variant.unit || "PCS"}
                                    </span>

                                    {variant.stock_source ===
                                      "conversion" && (
                                        <div className="mt-1 text-[10px] text-slate-400">
                                          From main stock
                                        </div>
                                      )}
                                  </td>
                                )}

                                {variantCols.visible.conversion && (
                                  <td className="px-4 py-3.5 text-right tabular-nums text-slate-600">
                                    {formatQuantity(
                                      variant.units_per_parent ?? 1
                                    )}

                                    <span className="block text-[10px] text-slate-400">
                                      per {form.unit || "main unit"}
                                    </span>
                                  </td>
                                )}

                                {variantCols.visible.cost && (
                                  <td className="px-4 py-3.5 text-right tabular-nums text-slate-600">
                                    {money(variant.cost_price)}
                                  </td>
                                )}

                                {variantCols.visible.sale && (
                                  <td className="px-4 py-3.5 text-right font-semibold tabular-nums text-slate-800">
                                    {money(variant.sale_price)}
                                  </td>
                                )}

                                {variantCols.visible.actions && (
                                  <td className="px-4 py-3.5">
                                    <div className="flex justify-end gap-1.5">
                                      {permissions.canUpdate && (
                                        <button
                                          type="button"
                                          onClick={() => editVariant(variant)}
                                          title="Edit sub-product"
                                          className="rounded-lg border border-slate-200 bg-white p-2 text-slate-500 transition hover:border-indigo-200 hover:bg-indigo-50 hover:text-indigo-600"
                                        >
                                          <Edit size={15} />
                                        </button>
                                      )}

                                      {permissions.canDelete && (
                                        <button
                                          type="button"
                                          onClick={() => deleteVariant(variant)}
                                          title="Delete sub-product"
                                          className="rounded-lg border border-slate-200 bg-white p-2 text-slate-500 transition hover:border-rose-200 hover:bg-rose-50 hover:text-rose-600"
                                        >
                                          <Trash2 size={15} />
                                        </button>
                                      )}
                                    </div>
                                  </td>
                                )}
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}

              {/* =================================================
                  SALES SECTION
              ================================================= */}

              {activeSection === "sales" && (
                <div className="space-y-6">
                  <SectionHeading
                    eyebrow="Selling configuration"
                    title="Sales Information"
                    description="Configure the selling unit, price and accounts used by sales transactions."
                    icon={ShoppingCart}
                  />

                  <div className="p-4 sm:p-6">
                    <div className="mb-5 flex items-center gap-2 border-b border-slate-100 pb-3">
                      <div className="h-5 w-1 rounded-full bg-blue-500" />

                      <h4 className="text-sm font-bold text-slate-800">
                        Pricing & Accounts
                      </h4>
                    </div>

                    <div className="grid grid-cols-1 gap-x-5 gap-y-5 md:grid-cols-2 xl:grid-cols-3">

                      <Field label="Sales Unit">
                        <Select
                          value={form.salesUnit}
                          onChange={(event) =>
                            setField(
                              "salesUnit",
                              event.target.value
                            )
                          }
                        >
                          {UNITS.map((unit) => (
                            <option
                              key={unit}
                              value={unit}
                            >
                              {unit}
                            </option>
                          ))}
                        </Select>
                      </Field>

                      <Field label="Sale Price">
                        <div className="relative">
                          <CircleDollarSign
                            size={17}
                            className="absolute left-3.5 top-1/2 -translate-y-1/2 text-emerald-600"
                          />

                          <Input
                            type="number"
                            min="0"
                            step="0.01"
                            value={form.salePrice}
                            onChange={(event) =>
                              setField(
                                "salePrice",
                                event.target.value
                              )
                            }
                            className="pl-10"
                          />
                        </div>
                      </Field>

                      {renderAccountSelect(
                        "Sales Account",
                        "salesAccount"
                      )}

                      {renderAccountSelect(
                        "Receivable Account",
                        "receivableAccount"
                      )}

                      <Field
                        label="Sales Description"
                        className="md:col-span-2 xl:col-span-3"
                      >
                        <TextArea
                          rows={3}
                          value={form.salesDescription}
                          onChange={(event) =>
                            setField(
                              "salesDescription",
                              event.target.value
                            )
                          }
                          placeholder="Description shown on sales documents"
                        />
                      </Field>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-blue-100 bg-blue-50/60 p-4">
                    <div className="flex items-start gap-3">
                      <div className="rounded-xl bg-white p-2.5 text-blue-600 shadow-sm">
                        <ShoppingCart size={19} />
                      </div>

                      <div>
                        <h4 className="text-sm font-bold text-blue-950">
                          Sales configuration
                        </h4>

                        <p className="mt-1 text-sm leading-6 text-blue-800/80">
                          Check your sales unit, selling price
                          and linked accounts before saving
                          product changes.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* =================================================
                  PURCHASE SECTION
              ================================================= */}

              {activeSection === "purchase" && (
                <div className="space-y-6">
                  <SectionHeading
                    eyebrow="Purchasing configuration"
                    title="Purchase Information"
                    description="Set purchase units, costs and purchase accounting details."
                    icon={Truck}
                  />

                  <div className="p-4 sm:p-6">
                    <div className="mb-5 flex items-center gap-2 border-b border-slate-100 pb-3">
                      <div className="h-5 w-1 rounded-full bg-amber-500" />

                      <h4 className="text-sm font-bold text-slate-800">
                        Purchase Pricing & Accounts
                      </h4>
                    </div>

                    <div className="grid grid-cols-1 gap-x-5 gap-y-5 md:grid-cols-2 xl:grid-cols-3">

                      <Field label="Purchase Unit">
                        <Select
                          value={form.purchaseUnit}
                          onChange={(event) =>
                            setField(
                              "purchaseUnit",
                              event.target.value
                            )
                          }
                        >
                          {UNITS.map((unit) => (
                            <option
                              key={unit}
                              value={unit}
                            >
                              {unit}
                            </option>
                          ))}
                        </Select>
                      </Field>

                      <Field label="Cost Price">
                        <div className="relative">
                          <CircleDollarSign
                            size={17}
                            className="absolute left-3.5 top-1/2 -translate-y-1/2 text-amber-600"
                          />

                          <Input
                            type="number"
                            min="0"
                            step="0.01"
                            value={form.costPrice}
                            onChange={(event) =>
                              setField(
                                "costPrice",
                                event.target.value
                              )
                            }
                            className="pl-10"
                          />
                        </div>
                      </Field>

                      {renderAccountSelect(
                        "Purchase Account",
                        "purchaseAccount"
                      )}

                      <Field
                        label="Purchase Description"
                        className="md:col-span-2 xl:col-span-3"
                      >
                        <TextArea
                          rows={3}
                          value={form.purchaseDescription}
                          onChange={(event) =>
                            setField(
                              "purchaseDescription",
                              event.target.value
                            )
                          }
                          placeholder="Description shown on purchase documents"
                        />
                      </Field>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-amber-100 bg-amber-50/60 p-4">
                    <div className="flex items-start gap-3">
                      <div className="rounded-xl bg-white p-2.5 text-amber-600 shadow-sm">
                        <Truck size={19} />
                      </div>

                      <div>
                        <h4 className="text-sm font-bold text-amber-950">
                          Purchase configuration
                        </h4>

                        <p className="mt-1 text-sm leading-6 text-amber-900/75">
                          Confirm your purchase unit, cost
                          and purchase account so purchase
                          transactions use the correct
                          product information.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* =================================================
                  ACCOUNTS SECTION
              ================================================= */}

              {activeSection === "accounts" && (
                <div className="space-y-6">
                  <SectionHeading
                    eyebrow="Accounting setup"
                    title="Accounting Information"
                    description="Link the product to the appropriate chart-of-accounts entries."
                    icon={Wallet}
                  />

                  <div className="p-4 sm:p-6">
                    <div className="mb-5 flex items-center gap-2 border-b border-slate-100 pb-3">
                      <div className="h-5 w-1 rounded-full bg-violet-500" />

                      <h4 className="text-sm font-bold text-slate-800">
                        General Ledger Accounts
                      </h4>
                    </div>

                    <div className="grid grid-cols-1 gap-x-5 gap-y-5 md:grid-cols-2 xl:grid-cols-3">
                      {renderAccountSelect(
                        "Sales Account",
                        "salesAccount"
                      )}

                      {renderAccountSelect(
                        "Receivable Account",
                        "receivableAccount"
                      )}

                      {renderAccountSelect(
                        "Purchase Account",
                        "purchaseAccount"
                      )}

                      {renderAccountSelect(
                        "Inventory Account",
                        "inventoryAccount"
                      )}

                      {renderAccountSelect(
                        "Cost of Goods Sold (COGS) Account",
                        "cogsAccount"
                      )}
                    </div>
                  </div>

                  <div className="rounded-2xl border border-violet-100 bg-violet-50/60 p-4">
                    <div className="flex items-start gap-3">
                      <div className="rounded-xl bg-white p-2.5 text-violet-600 shadow-sm">
                        <Wallet size={19} />
                      </div>

                      <div>
                        <h4 className="text-sm font-bold text-violet-950">
                          Accounting reminder
                        </h4>

                        <p className="mt-1 text-sm leading-6 text-violet-900/75">
                          Select the correct accounts according
                          to your company&apos;s chart of accounts.
                          Your account selections are saved
                          with the product.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* =================================================
                FOOTER ACTIONS
            ================================================= */}

            <div className="sticky bottom-0 z-10 border-t border-slate-200 bg-white/95 px-4 py-4 backdrop-blur-md sm:px-6 lg:px-7">
              <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">

                <div className="flex items-center gap-2 text-xs text-slate-500">
                  <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-slate-100 text-slate-500">
                    <Package size={14} />
                  </span>

                  <span>
                    {currentProductId != null ? (
                      <>
                        Product ID:{" "}

                        <strong className="text-slate-800">
                          {currentProductId}
                        </strong>
                      </>
                    ) : (
                      "Save the main product before adding sub-products."
                    )}
                  </span>
                </div>

                <div className="flex flex-wrap items-center gap-2">

                  {activeSection !== "primary" && (
                    <ActionButton
                      onClick={() => {
                        const index =
                          SECTIONS.findIndex(
                            (section) =>
                              section.id === activeSection
                          );

                        setActiveSection(
                          SECTIONS[
                            Math.max(0, index - 1)
                          ].id
                        );
                      }}
                    >
                      <ChevronLeft size={16} />
                      Previous
                    </ActionButton>
                  )}

                  {activeSection !== "accounts" && (
                    <ActionButton
                      onClick={() => {
                        const index =
                          SECTIONS.findIndex(
                            (section) =>
                              section.id === activeSection
                          );

                        setActiveSection(
                          SECTIONS[
                            Math.min(
                              SECTIONS.length - 1,
                              index + 1
                            )
                          ].id
                        );
                      }}
                    >
                      Next Section
                      <ChevronRight size={16} />
                    </ActionButton>
                  )}

                  <ActionButton
                    variant="primary"
                    onClick={() =>
                      submitProduct({
                        preventDefault() { },
                      })
                    }
                    disabled={saving}
                    className="min-w-[190px]"
                  >
                    {saving ? (
                      <RefreshCw
                        size={17}
                        className="animate-spin"
                      />
                    ) : (
                      <Save size={17} />
                    )}

                    {saving
                      ? "Saving Product..."
                      : editingProduct
                        ? "Save Changes"
                        : "Save Main Product"}
                  </ActionButton>
                </div>
              </div>
            </div>
          </section>
        )}
      </div>
    </div>
  );
}