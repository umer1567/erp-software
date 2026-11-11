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
  Activity,
  AlertCircle,
  ArrowDownRight,
  ArrowUpRight,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  Download,
  Eye,
  FileSpreadsheet,
  Layers3,
  LoaderCircle,
  LockKeyhole,
  Package,
  RefreshCw,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  Warehouse,
  X,
} from "lucide-react";

const PERMISSION_KEY = "items_ledger";

const INPUT_CLASS =
  "w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:border-indigo-400";

const LABEL_CLASS =
  "mb-2 block text-sm font-semibold text-slate-700 dark:text-slate-200";

const EMPTY_TOTALS = {
  opening_quantity: 0,
  received_quantity: 0,
  issued_quantity: 0,
  receive_amount: 0,
  issue_amount: 0,
  current_stock: 0,
};

const DENIED_PERMISSION = {
  can_view: false,
  can_create: false,
  can_update: false,
  can_delete: false,
};

// Keys must match the `key` values in transactionColumns below.
const LEDGER_COLUMNS = [
  { key: "date", label: "Transaction date" },
  { key: "type", label: "Transaction type" },
  { key: "number", label: "Transaction no." },
  { key: "uom", label: "UOM" },
  { key: "memo", label: "Memo" },
  { key: "transaction_rate", label: "Transaction rate" },
  { key: "old_rate", label: "Old rate" },
  { key: "actual_rate", label: "Actual rate" },
  { key: "new_rate", label: "New rate" },
  { key: "receive_quantity", label: "Receive quantity" },
  { key: "receive_rate", label: "Receive rate" },
  { key: "receive_amount", label: "Receive amount" },
  { key: "issue_quantity", label: "Issue quantity" },
  { key: "issue_rate", label: "Issue rate" },
  { key: "issue_amount", label: "Issue amount" },
  { key: "running_total", label: "Running total" },
];

/* =========================================================
   HELPERS
========================================================= */

function formatNumber(value) {
  return Number(value || 0).toLocaleString("en-PK", {
    maximumFractionDigits: 3,
  });
}

function formatAmount(value) {
  return Number(value || 0).toLocaleString("en-PK", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function formatDate(value) {
  if (!value) return "—";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return String(value);
  }

  return date.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function getTodayLocalDate() {
  const date = new Date();

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function getErrorMessage(data, fallback) {
  return data?.message || data?.error || fallback;
}

function normalizePermission(data) {
  const permission =
    data?.permission ??
    data?.permissions?.find(
      (item) => item.permission_key === PERMISSION_KEY
    ) ??
    data;

  return {
    can_view:
      permission?.can_view ??
      permission?.canView ??
      false,
    can_create:
      permission?.can_create ??
      permission?.canCreate ??
      false,
    can_update:
      permission?.can_update ??
      permission?.canUpdate ??
      false,
    can_delete:
      permission?.can_delete ??
      permission?.canDelete ??
      false,
  };
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
        className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
      >
        <Eye size={15} />
        Columns
        <span className="rounded-md bg-slate-100 px-1.5 py-0.5 text-[10px] font-bold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
          {state.count}/{columns.length}
        </span>
        <ChevronDown
          size={14}
          className={`transition ${open ? "rotate-180" : ""}`}
        />
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
              className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 dark:text-indigo-300 dark:hover:text-indigo-200"
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

function SummaryCard({
  title,
  value,
  description,
  icon: Icon,
  color = "indigo",
}) {
  const styles = {
    indigo:
      "bg-indigo-50 text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-300",
    emerald:
      "bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-300",
    rose:
      "bg-rose-50 text-rose-600 dark:bg-rose-500/10 dark:text-rose-300",
    violet:
      "bg-violet-50 text-violet-600 dark:bg-violet-500/10 dark:text-violet-300",
  };

  return (
    <div className="group rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm transition duration-200 hover:-translate-y-0.5 hover:shadow-md dark:border-slate-800 dark:bg-slate-900">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
            {title}
          </p>
          <p className="mt-2 break-words text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
            {value}
          </p>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            {description}
          </p>
        </div>

        <div
          className={`shrink-0 rounded-xl p-3 ${styles[color] || styles.indigo
            }`}
        >
          <Icon size={21} />
        </div>
      </div>
    </div>
  );
}

function TransactionBadge({ type }) {
  const value = String(type || "Transaction").toLowerCase();

  const isReceive =
    value.includes("receive") ||
    value.includes("purchase") ||
    value.includes("increase") ||
    value.includes("opening") ||
    value.includes("item receipt");

  const isIssue =
    value.includes("issue") ||
    value.includes("sale") ||
    value.includes("decrease");

  const styles = isReceive
    ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300"
    : isIssue
      ? "bg-rose-50 text-rose-700 dark:bg-rose-500/10 dark:text-rose-300"
      : "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300";

  const Icon = isReceive
    ? ArrowDownRight
    : isIssue
      ? ArrowUpRight
      : Activity;

  return (
    <span
      className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg px-2.5 py-1.5 text-xs font-semibold ${styles}`}
    >
      <Icon size={14} />
      {type || "Transaction"}
    </span>
  );
}

function AccessDenied() {
  return (
    <main className="flex min-h-[70vh] items-center justify-center bg-slate-50 px-4 py-10 dark:bg-slate-950">
      <section className="w-full max-w-lg rounded-3xl border border-rose-200 bg-white p-8 text-center shadow-xl dark:border-rose-900/50 dark:bg-slate-900">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-rose-50 text-rose-600 dark:bg-rose-500/10 dark:text-rose-300">
          <LockKeyhole size={30} />
        </div>

        <h1 className="mt-5 text-2xl font-bold text-slate-900 dark:text-white">
          Access Denied
        </h1>

        <p className="mt-3 text-sm leading-6 text-slate-600 dark:text-slate-400">
          You do not have permission to view Items Ledger. Please contact
          your administrator to request access.
        </p>

        <div className="mt-6 inline-flex items-center gap-2 rounded-xl bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
          <ShieldCheck size={17} />
          View permission required
        </div>
      </section>
    </main>
  );
}

/* =========================================================
   PAGE
========================================================= */

export default function ItemsLedgerPage() {
  const [permission, setPermission] = useState(DENIED_PERMISSION);
  const [permissionLoading, setPermissionLoading] = useState(true);
  const [permissionError, setPermissionError] = useState("");

  const canView = permission.can_view;
  const canCreate = permission.can_create;
  const canUpdate = permission.can_update;
  const canDelete = permission.can_delete;

  const [products, setProducts] = useState([]);
  const [selectedProductId, setSelectedProductId] = useState("");

  const [fromDate, setFromDate] = useState(getTodayLocalDate);
  const [toDate, setToDate] = useState(getTodayLocalDate);
  const [location, setLocation] = useState("");

  const [productSearch, setProductSearch] = useState("");
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [ledger, setLedger] = useState([]);
  const [totals, setTotals] = useState(EMPTY_TOTALS);

  const [loadingProducts, setLoadingProducts] = useState(true);
  const [loadingLedger, setLoadingLedger] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [hasSearched, setHasSearched] = useState(false);

  const [transactionFilter, setTransactionFilter] = useState("ALL");
  const [tableSearch, setTableSearch] = useState("");

  // Column visibility for the transaction history table
  const ledgerCols = useColumnVisibility(
    "items-ledger.columns",
    LEDGER_COLUMNS
  );

  // Load the current user's Items Ledger permissions first.
  useEffect(() => {
    let cancelled = false;

    async function loadPermission() {
      try {
        const response = await fetch(
          `/api/permissions/current?permissionKey=${PERMISSION_KEY}`,
          { cache: "no-store" }
        );

        const data = await response.json();

        if (!response.ok || data.success === false) {
          throw new Error(
            getErrorMessage(data, "Unable to load Items Ledger permissions.")
          );
        }

        const nextPermission = normalizePermission(data);

        if (!cancelled) {
          setPermission(nextPermission);
          setPermissionError("");
        }
      } catch (err) {
        console.error("ITEMS LEDGER PERMISSION ERROR:", err);

        if (!cancelled) {
          setPermission(DENIED_PERMISSION);
          setPermissionError(
            err.message || "Unable to verify your permissions."
          );
        }
      } finally {
        if (!cancelled) {
          setPermissionLoading(false);
        }
      }
    }

    loadPermission();

    return () => {
      cancelled = true;
    };
  }, []);

  // Do not fetch products until permission verification succeeds.
  // Users without View permission never load the protected page data.
  useEffect(() => {
    if (permissionLoading || !canView) {
      return;
    }

    let cancelled = false;

    async function fetchProducts() {
      try {
        const response = await fetch("/api/products", {
          cache: "no-store",
        });

        const contentType = response.headers.get("content-type") || "";

        if (!contentType.includes("application/json")) {
          throw new Error("Products API did not return JSON.");
        }

        const data = await response.json();

        if (!response.ok || data.success === false) {
          throw new Error(
            getErrorMessage(data, "Failed to load products.")
          );
        }

        if (!cancelled) {
          setProducts(
            Array.isArray(data.products) ? data.products : []
          );
          setError("");
        }
      } catch (err) {
        console.error("LOAD PRODUCTS ERROR:", err);

        if (!cancelled) {
          setError(err.message || "Failed to load products.");
        }
      } finally {
        if (!cancelled) {
          setLoadingProducts(false);
        }
      }
    }

    fetchProducts();

    return () => {
      cancelled = true;
    };
  }, [permissionLoading, canView]);

  const loadLedger = useCallback(async () => {
    if (!canView) {
      setError("You do not have permission to view Items Ledger.");
      return;
    }

    if (!selectedProductId) {
      setError("Please select an item first.");
      return;
    }

    if (fromDate && toDate && fromDate > toDate) {
      setError("From Date cannot be greater than To Date.");
      return;
    }

    setLoadingLedger(true);
    setError("");
    setHasSearched(false);
    setSelectedProduct(null);
    setLedger([]);
    setTotals(EMPTY_TOTALS);

    try {
      const params = new URLSearchParams();

      params.set("productId", selectedProductId);

      if (fromDate) params.set("fromDate", fromDate);
      if (toDate) params.set("toDate", toDate);
      if (location) params.set("location", location);

      const response = await fetch(
        `/api/items-ledger?${params.toString()}`,
        { cache: "no-store" }
      );

      const contentType = response.headers.get("content-type") || "";

      if (!contentType.includes("application/json")) {
        throw new Error(
          "Items Ledger API did not return JSON. Please check the API route."
        );
      }

      const data = await response.json();

      if (!response.ok || data.success === false) {
        throw new Error(
          getErrorMessage(data, "Failed to load item ledger.")
        );
      }

      setSelectedProduct(data.product || null);
      setLedger(
        Array.isArray(data.transactions) ? data.transactions : []
      );

      setTotals({
        opening_quantity: Number(data.totals?.opening_quantity) || 0,
        received_quantity: Number(data.totals?.received_quantity) || 0,
        issued_quantity: Number(data.totals?.issued_quantity) || 0,
        receive_amount: Number(data.totals?.receive_amount) || 0,
        issue_amount: Number(data.totals?.issue_amount) || 0,
        current_stock: Number(data.totals?.current_stock) || 0,
      });

      setHasSearched(true);
    } catch (err) {
      console.error("LOAD ITEM LEDGER ERROR:", err);
      setError(err.message || "Failed to load item ledger.");
      setSelectedProduct(null);
      setLedger([]);
      setTotals(EMPTY_TOTALS);
    } finally {
      setLoadingLedger(false);
    }
  }, [canView, selectedProductId, fromDate, toDate, location]);

  const filteredProducts = useMemo(() => {
    const search = productSearch.trim().toLowerCase();

    if (!search) return products;

    return products.filter((product) => {
      const name = String(product.product_name || "").toLowerCase();
      const sku = String(product.sku || "").toLowerCase();
      const barcode = String(product.barcode || "").toLowerCase();

      return (
        name.includes(search) ||
        sku.includes(search) ||
        barcode.includes(search)
      );
    });
  }, [products, productSearch]);

  const filteredLedger = useMemo(() => {
    const search = tableSearch.trim().toLowerCase();

    return ledger.filter((row) => {
      const type = String(row.transaction_type || "").toLowerCase();
      const number = String(row.transaction_number || "").toLowerCase();
      const memo = String(row.memo || "").toLowerCase();

      const matchesSearch =
        !search ||
        type.includes(search) ||
        number.includes(search) ||
        memo.includes(search);

      const matchesType =
        transactionFilter === "ALL" ||
        (transactionFilter === "RECEIVE" &&
          (type.includes("receive") ||
            type.includes("purchase") ||
            type.includes("increase") ||
            type.includes("opening") ||
            type.includes("item receipt"))) ||
        (transactionFilter === "ISSUE" &&
          (type.includes("issue") ||
            type.includes("sale") ||
            type.includes("decrease")));

      return matchesSearch && matchesType;
    });
  }, [ledger, tableSearch, transactionFilter]);

  async function refreshProducts() {
    if (!canView) return;

    setRefreshing(true);
    setError("");

    try {
      const response = await fetch("/api/products", {
        cache: "no-store",
      });

      const contentType = response.headers.get("content-type") || "";

      if (!contentType.includes("application/json")) {
        throw new Error("Products API did not return JSON.");
      }

      const data = await response.json();

      if (!response.ok || data.success === false) {
        throw new Error(
          getErrorMessage(data, "Failed to refresh products.")
        );
      }

      setProducts(Array.isArray(data.products) ? data.products : []);
    } catch (err) {
      setError(err.message || "Failed to refresh products.");
    } finally {
      setRefreshing(false);
    }
  }

  function handleProductChange(event) {
    setSelectedProductId(event.target.value);
    setSelectedProduct(null);
    setLedger([]);
    setTotals(EMPTY_TOTALS);
    setHasSearched(false);
    setError("");
  }

  function clearFilters() {
    const today = getTodayLocalDate();

    setFromDate(today);
    setToDate(today);
    setLocation("");
    setProductSearch("");
    setTableSearch("");
    setTransactionFilter("ALL");
    setError("");
  }

  // CSV export always includes every column, regardless of what is
  // hidden in the table view.
  function exportCSV() {
    if (!canView) {
      setError("You do not have permission to view Items Ledger.");
      return;
    }

    if (filteredLedger.length === 0) {
      setError("There are no ledger transactions to export.");
      return;
    }

    const columns = [
      ["Transaction Date", (row) => formatDate(row.transaction_date)],
      ["Transaction Type", (row) => row.transaction_type || ""],
      ["Transaction Number", (row) => row.transaction_number || ""],
      ["UOM", (row) => row.uom || ""],
      ["Memo", (row) => row.memo || ""],
      ["Transaction Rate", (row) => row.transaction_rate ?? 0],
      ["Old Rate", (row) => row.old_rate ?? 0],
      ["Actual Rate", (row) => row.actual_rate ?? 0],
      ["New Rate", (row) => row.new_rate ?? 0],
      ["Receive Quantity", (row) => row.receive_quantity ?? 0],
      ["Receive Rate", (row) => row.receive_rate ?? 0],
      ["Receive Amount", (row) => row.receive_amount ?? 0],
      ["Issue Quantity", (row) => row.issue_quantity ?? 0],
      ["Issue Rate", (row) => row.issue_rate ?? 0],
      ["Issue Amount", (row) => row.issue_amount ?? 0],
      ["Running Total", (row) => row.running_total ?? 0],
    ];

    const escapeCSV = (value) =>
      `"${String(value ?? "").replace(/"/g, '""')}"`;

    const lines = [
      columns.map(([heading]) => escapeCSV(heading)).join(","),
      ...filteredLedger.map((row) =>
        columns.map(([, getter]) => escapeCSV(getter(row))).join(",")
      ),
    ];

    const blob = new Blob(["\uFEFF" + lines.join("\r\n")], {
      type: "text/csv;charset=utf-8;",
    });

    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = `items-ledger-${selectedProduct?.sku || selectedProductId
      }.csv`;

    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  const transactionColumns = [
    {
      key: "date",
      label: "Transaction date",
      render: (row) => (
        <span className="font-medium text-slate-700 dark:text-slate-200">
          {formatDate(row.transaction_date)}
        </span>
      ),
    },
    {
      key: "type",
      label: "Transaction type",
      render: (row) => <TransactionBadge type={row.transaction_type} />,
    },
    {
      key: "number",
      label: "Transaction no.",
      render: (row) => (
        <span className="font-mono text-xs text-slate-600 dark:text-slate-300">
          {row.transaction_number || "—"}
        </span>
      ),
    },
    {
      key: "uom",
      label: "UOM",
      render: (row) => row.uom || "—",
    },
    {
      key: "memo",
      label: "Memo",
      render: (row) => (
        <span
          className="block min-w-40 max-w-64 truncate"
          title={row.memo || ""}
        >
          {row.memo || "—"}
        </span>
      ),
    },
    {
      key: "transaction_rate",
      label: "Transaction rate",
      numeric: true,
      render: (row) => formatAmount(row.transaction_rate),
    },
    {
      key: "old_rate",
      label: "Old rate",
      numeric: true,
      render: (row) => formatAmount(row.old_rate),
    },
    {
      key: "actual_rate",
      label: "Actual rate",
      numeric: true,
      render: (row) => formatAmount(row.actual_rate),
    },
    {
      key: "new_rate",
      label: "New rate",
      numeric: true,
      render: (row) => formatAmount(row.new_rate),
    },
    {
      key: "receive_quantity",
      label: "Receive quantity",
      numeric: true,
      render: (row) => (
        <span className="font-semibold text-emerald-600 dark:text-emerald-400">
          {formatNumber(row.receive_quantity)}
        </span>
      ),
    },
    {
      key: "receive_rate",
      label: "Receive rate",
      numeric: true,
      render: (row) => formatAmount(row.receive_rate),
    },
    {
      key: "receive_amount",
      label: "Receive amount",
      numeric: true,
      render: (row) => formatAmount(row.receive_amount),
    },
    {
      key: "issue_quantity",
      label: "Issue quantity",
      numeric: true,
      render: (row) => (
        <span className="font-semibold text-rose-600 dark:text-rose-400">
          {formatNumber(row.issue_quantity)}
        </span>
      ),
    },
    {
      key: "issue_rate",
      label: "Issue rate",
      numeric: true,
      render: (row) => formatAmount(row.issue_rate),
    },
    {
      key: "issue_amount",
      label: "Issue amount",
      numeric: true,
      render: (row) => formatAmount(row.issue_amount),
    },
    {
      key: "running_total",
      label: "Running total",
      numeric: true,
      render: (row) => (
        <span className="font-bold text-slate-900 dark:text-white">
          {formatNumber(row.running_total)}
        </span>
      ),
    },
  ];

  // Only the columns the user has ticked in the Columns dropdown
  const visibleColumns = transactionColumns.filter(
    (column) => ledgerCols.visible[column.key]
  );

  // Wait for permission verification before displaying the page.
  if (permissionLoading) {
    return (
      <main className="flex min-h-[70vh] items-center justify-center bg-slate-50 dark:bg-slate-950">
        <div className="flex flex-col items-center gap-3 text-slate-500 dark:text-slate-400">
          <LoaderCircle size={34} className="animate-spin text-indigo-600" />
          <p className="text-sm font-semibold">
            Verifying Items Ledger permissions...
          </p>
        </div>
      </main>
    );
  }

  // Fail closed if permission could not be verified or View is disabled.
  if (!canView) {
    return (
      <div>
        {permissionError && (
          <p className="mb-3 rounded-xl bg-rose-50 p-3 text-sm text-rose-700 dark:bg-rose-950/30 dark:text-rose-300">
            {permissionError}
          </p>
        )}
        <AccessDenied />
      </div>
    );
  }

  return (
    <main className="min-h-screen space-y-6 bg-slate-50/70 pb-10 dark:bg-slate-950">
      <section className="relative isolate overflow-hidden rounded-3xl bg-gradient-to-br from-indigo-700 via-indigo-600 to-violet-700 px-6 py-7 text-white shadow-lg shadow-indigo-900/10 sm:px-8 sm:py-9">
        <div className="pointer-events-none absolute -right-10 -top-24 -z-10 h-72 w-72 rounded-full bg-white/10 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-32 right-1/3 -z-10 h-64 w-64 rounded-full bg-violet-300/20 blur-3xl" />

        <div className="flex flex-col justify-between gap-6 lg:flex-row lg:items-center">
          <div className="max-w-2xl">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-xs font-semibold text-indigo-50 backdrop-blur">
              <Activity size={15} />
              INVENTORY ANALYTICS
            </div>

            <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
              Items Ledger
            </h1>

            <p className="mt-3 max-w-xl text-sm leading-6 text-indigo-100 sm:text-base">
              Track item movements, review stock balances, and analyze
              receiving and issuing transactions.
            </p>

            <div className="mt-5 flex flex-wrap items-center gap-3 text-sm text-indigo-100">
              <span className="inline-flex items-center gap-2">
                <Package size={16} />
                Item transaction history
              </span>
              <span className="hidden h-1 w-1 rounded-full bg-indigo-200 sm:block" />
              <span className="inline-flex items-center gap-2">
                <Warehouse size={16} />
                Warehouse movement
              </span>
            </div>
          </div>

          <div className="flex shrink-0 flex-wrap gap-3">
            <button
              type="button"
              onClick={refreshProducts}
              disabled={refreshing || loadingProducts}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/25 bg-white/10 px-4 py-3 text-sm font-semibold text-white transition hover:bg-white/20 disabled:opacity-60"
            >
              <RefreshCw
                size={17}
                className={refreshing ? "animate-spin" : ""}
              />
              Refresh items
            </button>

            <button
              type="button"
              onClick={exportCSV}
              disabled={filteredLedger.length === 0}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-white px-4 py-3 text-sm font-semibold text-indigo-700 shadow-sm transition hover:bg-indigo-50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Download size={17} />
              Export CSV
            </button>
          </div>
        </div>
      </section>

      {error && (
        <div
          role="alert"
          className="flex items-start gap-3 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-4 text-rose-800 dark:border-rose-900/60 dark:bg-rose-950/30 dark:text-rose-300"
        >
          <AlertCircle size={19} className="mt-0.5 shrink-0" />
          <p className="flex-1 text-sm font-medium">{error}</p>
          <button
            type="button"
            aria-label="Dismiss error"
            onClick={() => setError("")}
            className="rounded-lg p-1 hover:bg-rose-100 dark:hover:bg-rose-900/40"
          >
            <X size={17} />
          </button>
        </div>
      )}

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-col justify-between gap-3 border-b border-slate-100 px-5 py-5 dark:border-slate-800 sm:flex-row sm:items-center sm:px-7">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-indigo-50 p-2.5 text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-300">
              <SlidersHorizontal size={21} />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                Ledger filters
              </h2>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                Select an item and date range to view its transaction history.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={clearFilters}
            className="inline-flex items-center justify-center gap-2 self-start rounded-lg px-3 py-2 text-sm font-semibold text-slate-500 transition hover:bg-slate-100 hover:text-slate-800 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white sm:self-auto"
          >
            <X size={16} />
            Clear filters
          </button>
        </div>

        <div className="grid grid-cols-1 gap-5 p-5 sm:grid-cols-2 sm:p-7 xl:grid-cols-4">
          <div>
            <label className={LABEL_CLASS}>
              <span className="inline-flex items-center gap-2">
                <CalendarDays size={15} />
                From date
              </span>
            </label>
            <input
              type="date"
              value={fromDate}
              max={toDate || undefined}
              onChange={(event) => setFromDate(event.target.value)}
              className={INPUT_CLASS}
            />
          </div>

          <div>
            <label className={LABEL_CLASS}>
              <span className="inline-flex items-center gap-2">
                <CalendarDays size={15} />
                To date
              </span>
            </label>
            <input
              type="date"
              value={toDate}
              min={fromDate || undefined}
              onChange={(event) => setToDate(event.target.value)}
              className={INPUT_CLASS}
            />
          </div>

          <div>
            <label className={LABEL_CLASS}>
              <span className="inline-flex items-center gap-2">
                <Warehouse size={15} />
                Location
              </span>
            </label>
            <div className="relative">
              <select
                value={location}
                onChange={(event) => setLocation(event.target.value)}
                className={`${INPUT_CLASS} appearance-none pr-10`}
              >
                <option value="">All locations</option>
                <option value="Main Warehouse">Main Warehouse</option>
                <option value="Secondary Warehouse">Secondary Warehouse</option>
                <option value="Store">Store</option>
                <option value="Godown">Godown</option>
              </select>
              <ChevronDown
                size={16}
                className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400"
              />
            </div>
          </div>

          <div>
            <label className={LABEL_CLASS}>
              <span className="inline-flex items-center gap-2">
                <Package size={15} />
                Item
              </span>
            </label>

            <div className="relative mb-2">
              <Search
                size={16}
                className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
              />
              <input
                type="search"
                value={productSearch}
                onChange={(event) => setProductSearch(event.target.value)}
                placeholder="Search item or SKU..."
                className={`${INPUT_CLASS} pl-10`}
              />
            </div>

            <div className="relative">
              <select
                value={selectedProductId}
                onChange={handleProductChange}
                disabled={loadingProducts}
                className={`${INPUT_CLASS} appearance-none pr-10`}
              >
                <option value="">
                  {loadingProducts ? "Loading items..." : "Select an item"}
                </option>
                {filteredProducts.map((product) => (
                  <option
                    key={product.product_id}
                    value={product.product_id}
                  >
                    {product.sku ? `${product.sku} — ` : ""}
                    {product.product_name}
                  </option>
                ))}
              </select>
              <ChevronDown
                size={16}
                className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400"
              />
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-3 border-t border-slate-100 bg-slate-50/70 px-5 py-4 dark:border-slate-800 dark:bg-slate-800/30 sm:flex-row sm:items-center sm:justify-between sm:px-7">
          <p className="text-xs leading-5 text-slate-500 dark:text-slate-400">
            {selectedProductId
              ? "Filters are ready. Select View ledger to load the latest results."
              : "Choose an item before loading its ledger."}
          </p>

          <button
            type="button"
            onClick={loadLedger}
            disabled={loadingLedger || loadingProducts || !selectedProductId}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-6 py-3 text-sm font-bold text-white shadow-sm shadow-indigo-600/20 transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loadingLedger ? (
              <>
                <LoaderCircle size={18} className="animate-spin" />
                Loading ledger...
              </>
            ) : (
              <>
                <Eye size={17} />
                View ledger
              </>
            )}
          </button>
        </div>
      </section>

      {selectedProduct && (
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-6">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex min-w-0 items-center gap-4">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 text-white shadow-md shadow-indigo-600/20">
                <Package size={27} />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-wider text-indigo-600 dark:text-indigo-300">
                  Selected item
                </p>
                <h2 className="mt-1 break-words text-xl font-bold text-slate-900 dark:text-white">
                  {selectedProduct.product_name || "Unnamed product"}
                </h2>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                  SKU: {selectedProduct.sku || "—"}
                  {selectedProduct.unit ? ` · Unit: ${selectedProduct.unit}` : ""}
                </p>
              </div>
            </div>

            <div className="rounded-xl bg-emerald-50 px-5 py-4 dark:bg-emerald-500/10">
              <p className="text-xs font-semibold uppercase tracking-wider text-emerald-700 dark:text-emerald-300">
                Closing stock
              </p>
              <p className="mt-1 text-2xl font-bold text-emerald-700 dark:text-emerald-300">
                {formatNumber(totals.current_stock)}
              </p>
            </div>
          </div>
        </section>
      )}

      {selectedProduct && (
        <>
          <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <SummaryCard
              title="Opening stock"
              value={formatNumber(totals.opening_quantity)}
              description="Quantity at the start of the period"
              icon={Layers3}
              color="indigo"
            />
            <SummaryCard
              title="Received quantity"
              value={formatNumber(totals.received_quantity)}
              description="Stock received during the period"
              icon={ArrowDownRight}
              color="emerald"
            />
            <SummaryCard
              title="Issued quantity"
              value={formatNumber(totals.issued_quantity)}
              description="Stock issued during the period"
              icon={ArrowUpRight}
              color="rose"
            />
            <SummaryCard
              title="Closing stock"
              value={formatNumber(totals.current_stock)}
              description="Closing balance from the API"
              icon={Warehouse}
              color="violet"
            />
          </section>

          <section className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <div className="flex items-center gap-3">
                <div className="rounded-xl bg-emerald-50 p-3 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-300">
                  <ArrowDownRight size={21} />
                </div>
                <div>
                  <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
                    Total receive amount
                  </p>
                  <p className="mt-1 text-2xl font-bold text-slate-900 dark:text-white">
                    {formatAmount(totals.receive_amount)}
                  </p>
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <div className="flex items-center gap-3">
                <div className="rounded-xl bg-rose-50 p-3 text-rose-600 dark:bg-rose-500/10 dark:text-rose-300">
                  <ArrowUpRight size={21} />
                </div>
                <div>
                  <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
                    Total issue amount
                  </p>
                  <p className="mt-1 text-2xl font-bold text-slate-900 dark:text-white">
                    {formatAmount(totals.issue_amount)}
                  </p>
                </div>
              </div>
            </div>
          </section>
        </>
      )}

      {/* No overflow-hidden here, so the Columns dropdown is never clipped */}
      <section className="rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-col justify-between gap-4 rounded-t-2xl border-b border-slate-100 px-5 py-5 dark:border-slate-800 sm:flex-row sm:items-center sm:px-7">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-violet-50 p-2.5 text-violet-600 dark:bg-violet-500/10 dark:text-violet-300">
              <FileSpreadsheet size={21} />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                Transaction history
              </h2>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                Detailed stock movement, rates, amounts, and running balance.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-lg bg-slate-100 px-3 py-2 text-xs font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
              {filteredLedger.length} records
            </span>

            {/* COLUMN PICKER */}
            <ColumnToggle columns={LEDGER_COLUMNS} state={ledgerCols} />

            <button
              type="button"
              onClick={exportCSV}
              disabled={filteredLedger.length === 0}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              <Download size={15} />
              Export
            </button>
          </div>
        </div>

        <div className="flex flex-col gap-3 border-b border-slate-100 p-4 dark:border-slate-800 sm:flex-row sm:items-center sm:justify-between sm:px-5">
          <div className="relative w-full sm:max-w-sm">
            <Search
              size={17}
              className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
            />
            <input
              type="search"
              value={tableSearch}
              onChange={(event) => setTableSearch(event.target.value)}
              placeholder="Search transaction, number or memo..."
              className={`${INPUT_CLASS} pl-10`}
            />
          </div>

          <div className="flex flex-wrap gap-2">
            {[
              { value: "ALL", label: "All transactions" },
              { value: "RECEIVE", label: "Received" },
              { value: "ISSUE", label: "Issued" },
            ].map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => setTransactionFilter(option.value)}
                className={`rounded-lg px-3 py-2 text-xs font-semibold transition ${transactionFilter === option.value
                  ? "bg-indigo-600 text-white"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
                  }`}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>

        {/* The scrollbar appears only when the visible columns are wider
            than the container. */}
        <div className="w-full overflow-x-auto [scrollbar-width:thin]">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-800/70">
                {visibleColumns.map((column) => (
                  <th
                    key={column.key}
                    className={`whitespace-nowrap border-b border-slate-200 px-4 py-4 text-xs font-bold uppercase tracking-wider text-slate-500 dark:border-slate-700 dark:text-slate-400 ${column.numeric ? "text-right" : "text-left"
                      }`}
                  >
                    {column.label}
                  </th>
                ))}
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {loadingLedger ? (
                <tr>
                  <td colSpan={visibleColumns.length} className="px-5 py-16">
                    <div className="flex flex-col items-center justify-center gap-3 text-slate-500 dark:text-slate-400">
                      <LoaderCircle
                        size={30}
                        className="animate-spin text-indigo-500"
                      />
                      <p className="text-sm font-medium">
                        Loading item ledger...
                      </p>
                    </div>
                  </td>
                </tr>
              ) : filteredLedger.length === 0 ? (
                <tr>
                  <td colSpan={visibleColumns.length} className="px-5 py-16">
                    <div className="flex flex-col items-center justify-center text-center">
                      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-500">
                        <FileSpreadsheet size={25} />
                      </div>
                      <p className="font-semibold text-slate-800 dark:text-slate-100">
                        {hasSearched
                          ? "No transactions found"
                          : "Your ledger is ready"}
                      </p>
                      <p className="mt-2 max-w-md text-sm leading-6 text-slate-500 dark:text-slate-400">
                        {hasSearched
                          ? "Try changing the date range, location, or transaction search filters."
                          : "Select an item and click View ledger to display its transaction history."}
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredLedger.map((row, index) => (
                  <tr
                    key={
                      row.inventory_transaction_id ??
                      `${row.transaction_number || "transaction"}-${row.transaction_date || index}-${index}`
                    }
                    className="transition hover:bg-indigo-50/40 dark:hover:bg-indigo-500/5"
                  >
                    {visibleColumns.map((column) => (
                      <td
                        key={column.key}
                        className={`whitespace-nowrap px-4 py-4 text-slate-600 dark:text-slate-300 ${column.numeric
                          ? "text-right tabular-nums"
                          : "text-left"
                          }`}
                      >
                        {column.render(row)}
                      </td>
                    ))}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {!loadingLedger && filteredLedger.length > 0 && (
          <div className="flex flex-col gap-2 rounded-b-2xl border-t border-slate-100 bg-slate-50/70 px-5 py-4 dark:border-slate-800 dark:bg-slate-800/30 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Showing {filteredLedger.length} of {ledger.length} transaction records
            </p>
            <p className="inline-flex items-center gap-2 text-xs font-medium text-slate-500 dark:text-slate-400">
              <CheckCircle2 size={15} className="text-emerald-500" />
              Ledger data loaded from your ERP
            </p>
          </div>
        )}
      </section>

      <p className="px-1 text-xs leading-5 text-slate-400 dark:text-slate-500">
        Quantities, rates, amounts, and running totals are displayed using
        the values returned by your Items Ledger API.
      </p>

      {/* Permission flags are available for future CRUD controls.
          This ledger currently has no create, edit, or delete actions. */}
      <span className="hidden" aria-hidden="true">
        {String(canCreate)} {String(canUpdate)} {String(canDelete)}
      </span>
    </main>
  );
}