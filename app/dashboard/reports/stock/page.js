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
  Boxes,
  Package,
  Search,
  RefreshCw,
  Download,
  Warehouse,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  DollarSign,
  ShoppingCart,
  BarChart3,
  ArrowUpDown,
  Filter,
  X,
  ChevronDown,
  FileSpreadsheet,
  Layers3,
  Clock3,
  ShieldAlert,
  LockKeyhole,
  Eye,
} from "lucide-react";

const PERMISSION_KEY = "stock_report";

// Column picker definitions for the Stock Details table
const STOCK_COLUMNS = [
  { key: "sku", label: "SKU" },
  { key: "product", label: "Product" },
  { key: "warehouse", label: "Warehouse" },
  { key: "quantity", label: "Quantity" },
  { key: "cost", label: "Cost Value" },
  { key: "sale", label: "Sale Value" },
  { key: "status", label: "Status" },
];

const numberFormat = new Intl.NumberFormat("en-PK", {
  minimumFractionDigits: 0,
  maximumFractionDigits: 3,
});

const amountFormat = new Intl.NumberFormat("en-PK", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

function formatNumber(value) {
  const number = Number(value ?? 0);
  return numberFormat.format(Number.isFinite(number) ? number : 0);
}

function formatAmount(value) {
  const number = Number(value ?? 0);
  return amountFormat.format(Number.isFinite(number) ? number : 0);
}

function getErrorMessage(data, fallback) {
  return data?.message || data?.error || fallback;
}

function normalizePermission(data) {
  const permission =
    data?.permission ||
    data?.permissions?.find(
      (item) => item.permission_key === PERMISSION_KEY
    ) ||
    null;

  if (!permission) {
    return {
      permission_key: PERMISSION_KEY,
      can_view: false,
      can_create: false,
      can_update: false,
      can_delete: false,
    };
  }

  return {
    permission_key: permission.permission_key || PERMISSION_KEY,
    can_view:
      permission.can_view === true ||
      permission.can_view === "true",
    can_create:
      permission.can_create === true ||
      permission.can_create === "true",
    can_update:
      permission.can_update === true ||
      permission.can_update === "true",
    can_delete:
      permission.can_delete === true ||
      permission.can_delete === "true",
  };
}

function getStatusInfo(status) {
  const normalized = String(status ?? "").toLowerCase().trim();

  if (
    normalized.includes("out of stock") ||
    normalized.includes("out_of_stock") ||
    normalized.includes("zero stock") ||
    normalized.includes("no stock")
  ) {
    return {
      label: status || "Out of Stock",
      className:
        "border-red-200 bg-red-50 text-red-700 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300",
      icon: XCircle,
    };
  }

  if (
    normalized.includes("low") ||
    normalized.includes("critical") ||
    normalized.includes("reorder")
  ) {
    return {
      label: status || "Low Stock",
      className:
        "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-300",
      icon: AlertTriangle,
    };
  }

  if (
    normalized.includes("normal") ||
    normalized.includes("in stock") ||
    normalized.includes("available") ||
    normalized.includes("healthy")
  ) {
    return {
      label: status || "In Stock",
      className:
        "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-300",
      icon: CheckCircle2,
    };
  }

  return {
    label: status || "Unknown",
    className:
      "border-gray-200 bg-gray-100 text-gray-700 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300",
    icon: Boxes,
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
        className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-semibold text-gray-700 transition hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200 dark:hover:bg-gray-800"
      >
        <Eye className="h-4 w-4" />
        Columns
        <span className="rounded-md bg-gray-100 px-1.5 py-0.5 text-[10px] font-bold text-gray-600 dark:bg-gray-800 dark:text-gray-300">
          {state.count}/{columns.length}
        </span>
        <ChevronDown
          className={`h-4 w-4 transition ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open && (
        <div className="absolute right-0 z-30 mt-2 w-60 rounded-2xl border border-gray-200 bg-white p-2 shadow-xl dark:border-gray-700 dark:bg-gray-900">
          <div className="flex items-center justify-between px-2 pb-2 pt-1">
            <p className="text-[11px] font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">
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
                className="flex cursor-pointer items-center gap-3 rounded-lg px-2.5 py-2 text-sm text-gray-700 hover:bg-gray-50 dark:text-gray-200 dark:hover:bg-gray-800"
              >
                <input
                  type="checkbox"
                  checked={state.visible[col.key]}
                  onChange={() => state.toggle(col.key)}
                  className="h-4 w-4 rounded border-gray-300 accent-blue-600"
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


function StatCard({
  title,
  value,
  subtitle,
  icon: Icon,
  color = "blue",
  loading = false,
}) {
  const themes = {
    blue: {
      icon: "bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300",
      glow: "from-blue-500/10",
      bar: "bg-blue-500",
    },
    purple: {
      icon: "bg-violet-100 text-violet-700 dark:bg-violet-900/50 dark:text-violet-300",
      glow: "from-violet-500/10",
      bar: "bg-violet-500",
    },
    green: {
      icon: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300",
      glow: "from-emerald-500/10",
      bar: "bg-emerald-500",
    },
    amber: {
      icon: "bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300",
      glow: "from-amber-500/10",
      bar: "bg-amber-500",
    },
    red: {
      icon: "bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300",
      glow: "from-red-500/10",
      bar: "bg-red-500",
    },
    indigo: {
      icon: "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/50 dark:text-indigo-300",
      glow: "from-indigo-500/10",
      bar: "bg-indigo-500",
    },
  };

  const theme = themes[color] || themes.blue;

  return (
    <div className="group relative isolate overflow-hidden rounded-2xl border border-gray-200 bg-white p-5 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:border-blue-200 hover:shadow-xl dark:border-gray-800 dark:bg-gray-900 dark:hover:border-gray-700">
      {/* Background glow */}
      <div
        className={`pointer-events-none absolute -right-12 -top-12 h-36 w-36 rounded-full bg-gradient-to-br ${theme.glow} to-transparent blur-2xl transition-transform duration-500 group-hover:scale-150`}
      />

      <div className="relative flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-gray-500 dark:text-gray-400">
            {title}
          </p>

          {loading ? (
            <div className="mt-4 h-9 w-32 animate-pulse rounded-lg bg-gray-200 dark:bg-gray-800" />
          ) : (
            <p className="mt-3 break-words text-2xl font-bold tracking-tight text-gray-900 dark:text-white sm:text-3xl">
              {value}
            </p>
          )}

          {subtitle && (
            <p className="mt-2 text-xs leading-5 text-gray-500 dark:text-gray-400">
              {subtitle}
            </p>
          )}
        </div>

        <div
          className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl transition-transform duration-300 group-hover:scale-110 ${theme.icon}`}
        >
          <Icon className="h-6 w-6" />
        </div>
      </div>

      {/* Bottom accent bar */}
      <div className="absolute bottom-0 left-0 h-1 w-full overflow-hidden bg-gray-100 dark:bg-gray-800">
        <div
          className={`h-full w-1/3 rounded-r-full transition-all duration-500 group-hover:w-full ${theme.bar}`}
        />
      </div>
    </div>
  );
}

function StatusBadge({ status }) {
  const info = getStatusInfo(status);
  const Icon = info.icon;

  return (
    <span
      className={`inline-flex max-w-full items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-1 text-xs font-semibold ${info.className}`}
    >
      <Icon className="h-3.5 w-3.5 shrink-0" />
      {info.label}
    </span>
  );
}

function LoadingState({ message = "Loading your stock report..." }) {
  return (
    <div className="min-h-[60vh] space-y-6">
      <div className="h-36 animate-pulse rounded-3xl bg-gray-200 dark:bg-gray-800" />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[1, 2, 3, 4].map((item) => (
          <div
            key={item}
            className="h-32 animate-pulse rounded-2xl bg-gray-200 dark:bg-gray-800"
          />
        ))}
      </div>

      <div className="h-96 animate-pulse rounded-2xl bg-gray-200 dark:bg-gray-800" />

      <p className="text-center text-sm text-gray-500 dark:text-gray-400">
        {message}
      </p>
    </div>
  );
}

function AccessDenied({ message }) {
  return (
    <div className="flex min-h-[70vh] items-center justify-center p-4 sm:p-8">
      <div className="w-full max-w-lg rounded-3xl border border-gray-200 bg-white p-8 text-center shadow-xl dark:border-gray-800 dark:bg-gray-900 sm:p-10">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-red-50 dark:bg-red-950/40">
          <LockKeyhole className="h-8 w-8 text-red-600 dark:text-red-400" />
        </div>

        <h1 className="mt-5 text-2xl font-bold text-gray-900 dark:text-white">
          Access Denied
        </h1>

        <p className="mt-3 text-sm leading-6 text-gray-600 dark:text-gray-400">
          {message ||
            "You do not have permission to view the Stock Report. Please contact your administrator."}
        </p>

        <div className="mt-6 inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-600 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300">
          <ShieldAlert className="h-4 w-4" />
          Required permission: Stock Report → View
        </div>
      </div>
    </div>
  );
}

/* =========================================================
   PAGE
========================================================= */

export default function StockReportPage() {
  const [permission, setPermission] = useState(null);
  const [permissionLoading, setPermissionLoading] = useState(true);
  const [permissionError, setPermissionError] = useState("");

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const [search, setSearch] = useState("");
  const [warehouseFilter, setWarehouseFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sortBy, setSortBy] = useState("product_name");
  const [sortDirection, setSortDirection] = useState("asc");

  // Column visibility for the Stock Details table
  // (must stay above the early returns below)
  const stockCols = useColumnVisibility("stock-report.columns", STOCK_COLUMNS);

  const canView = permission?.can_view === true;

  /*
   * First load the current user's Stock Report permission.
   * Only request report data after View permission is confirmed.
   */
  useEffect(() => {
    let cancelled = false;

    async function initializePage() {
      setPermissionLoading(true);
      setLoading(true);
      setPermissionError("");
      setError("");

      try {
        const permissionResponse = await fetch(
          `/api/permissions/current?permissionKey=${encodeURIComponent(PERMISSION_KEY)}`,
          {
            method: "GET",
            cache: "no-store",
            headers: {
              Accept: "application/json",
            },
          }
        );

        const permissionContentType =
          permissionResponse.headers.get("content-type") || "";

        if (!permissionContentType.includes("application/json")) {
          throw new Error("The permissions API did not return JSON.");
        }

        const permissionData = await permissionResponse.json();

        if (!permissionResponse.ok || permissionData.success === false) {
          throw new Error(
            getErrorMessage(
              permissionData,
              "Unable to verify Stock Report permissions."
            )
          );
        }

        const currentPermission = normalizePermission(permissionData);

        if (cancelled) return;

        setPermission(currentPermission);
        setPermissionLoading(false);

        if (!currentPermission.can_view) {
          setLoading(false);
          return;
        }

        const reportResponse = await fetch("/api/reports/stock", {
          method: "GET",
          cache: "no-store",
          headers: {
            Accept: "application/json",
          },
        });

        const reportContentType =
          reportResponse.headers.get("content-type") || "";

        if (!reportContentType.includes("application/json")) {
          throw new Error(
            "The server returned an invalid response. Please check your stock report API."
          );
        }

        const reportData = await reportResponse.json();

        if (!reportResponse.ok || reportData.success === false) {
          throw new Error(
            getErrorMessage(reportData, "Unable to load the stock report.")
          );
        }

        if (!cancelled) {
          setData(reportData);
          setError("");
        }
      } catch (err) {
        console.error("Stock report initialization error:", err);

        if (!cancelled) {
          setPermissionError(
            err instanceof Error
              ? err.message
              : "Unable to verify your Stock Report access."
          );
          setError(
            err instanceof Error
              ? err.message
              : "Something went wrong while loading the stock report."
          );
        }
      } finally {
        if (!cancelled) {
          setPermissionLoading(false);
          setLoading(false);
        }
      }
    }

    initializePage();

    return () => {
      cancelled = true;
    };
  }, []);

  const loadData = useCallback(
    async ({ silent = false } = {}) => {
      if (!canView) {
        setError("You do not have permission to view the Stock Report.");
        return;
      }

      if (silent) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      setError("");

      try {
        const response = await fetch("/api/reports/stock", {
          method: "GET",
          cache: "no-store",
          headers: {
            Accept: "application/json",
          },
        });

        const contentType = response.headers.get("content-type") || "";

        if (!contentType.includes("application/json")) {
          throw new Error(
            "The server returned an invalid response. Please check your stock report API."
          );
        }

        const result = await response.json();

        if (!response.ok || result.success === false) {
          throw new Error(
            getErrorMessage(result, "Unable to load the stock report.")
          );
        }

        setData(result);
      } catch (err) {
        console.error("Stock report refresh error:", err);
        setError(
          err instanceof Error
            ? err.message
            : "Something went wrong while refreshing the report."
        );
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [canView]
  );

  const stock = useMemo(
    () => (Array.isArray(data?.stock) ? data.stock : []),
    [data]
  );

  const warehouses = useMemo(() => {
    return [
      ...new Set(
        stock
          .map((item) => item.warehouse_name)
          .filter(
            (warehouse) =>
              typeof warehouse === "string" && warehouse.trim() !== ""
          )
      ),
    ].sort((a, b) => a.localeCompare(b));
  }, [stock]);

  const summary = useMemo(() => {
    const productCount = Number(data?.summary?.product_count ?? 0);
    const totalQuantity = Number(data?.summary?.total_quantity ?? 0);

    const lowStockCount = stock.filter((item) => {
      const status = String(item.stock_status ?? "").toLowerCase();

      return (
        status.includes("low") ||
        status.includes("critical") ||
        status.includes("reorder")
      );
    }).length;

    const outOfStockCount = stock.filter((item) => {
      const quantity = Number(item.quantity ?? 0);
      const status = String(item.stock_status ?? "").toLowerCase();

      return (
        quantity <= 0 ||
        status.includes("out of stock") ||
        status.includes("out_of_stock") ||
        status.includes("zero stock")
      );
    }).length;

    const totalCostValue = stock.reduce(
      (total, item) => total + (Number(item.stock_cost_value) || 0),
      0
    );

    const totalSaleValue = stock.reduce(
      (total, item) => total + (Number(item.stock_sale_value) || 0),
      0
    );

    return {
      productCount: Number.isFinite(productCount) ? productCount : 0,
      totalQuantity: Number.isFinite(totalQuantity) ? totalQuantity : 0,
      lowStockCount,
      outOfStockCount,
      totalCostValue,
      totalSaleValue,
    };
  }, [data, stock]);

  const filteredStock = useMemo(() => {
    const query = search.trim().toLowerCase();

    const filtered = stock.filter((item) => {
      const matchesSearch =
        !query ||
        [
          item.sku,
          item.product_name,
          item.warehouse_name,
          item.stock_status,
        ].some((value) =>
          String(value ?? "").toLowerCase().includes(query)
        );

      const matchesWarehouse =
        warehouseFilter === "all" || item.warehouse_name === warehouseFilter;

      const quantity = Number(item.quantity ?? 0);
      const status = String(item.stock_status ?? "").toLowerCase();

      const isOutOfStock =
        quantity <= 0 ||
        status.includes("out of stock") ||
        status.includes("out_of_stock") ||
        status.includes("zero stock") ||
        status.includes("no stock");

      const isLowStock =
        status.includes("low") ||
        status.includes("critical") ||
        status.includes("reorder");

      const isNormalStock =
        !isOutOfStock &&
        !isLowStock &&
        (status.includes("normal") ||
          status.includes("in stock") ||
          status.includes("available") ||
          status.includes("healthy"));

      const matchesStatus =
        statusFilter === "all" ||
        (statusFilter === "out" && isOutOfStock) ||
        (statusFilter === "low" && !isOutOfStock && isLowStock) ||
        (statusFilter === "normal" && isNormalStock);

      return matchesSearch && matchesWarehouse && matchesStatus;
    });

    return filtered.sort((a, b) => {
      const first = a?.[sortBy];
      const second = b?.[sortBy];

      let comparison;

      if (
        ["quantity", "stock_cost_value", "stock_sale_value"].includes(sortBy)
      ) {
        comparison = (Number(first) || 0) - (Number(second) || 0);
      } else {
        comparison = String(first ?? "").localeCompare(
          String(second ?? ""),
          undefined,
          {
            numeric: true,
            sensitivity: "base",
          }
        );
      }

      return sortDirection === "asc" ? comparison : -comparison;
    });
  }, [
    stock,
    search,
    warehouseFilter,
    statusFilter,
    sortBy,
    sortDirection,
  ]);

  const handleSort = (column) => {
    if (sortBy === column) {
      setSortDirection((current) => (current === "asc" ? "desc" : "asc"));
    } else {
      setSortBy(column);
      setSortDirection("asc");
    }
  };

  const clearFilters = () => {
    setSearch("");
    setWarehouseFilter("all");
    setStatusFilter("all");
  };

  // CSV export always includes every column, regardless of what is
  // hidden in the table view.
  const exportCSV = () => {
    if (!canView) {
      setError("You do not have permission to export this report.");
      return;
    }

    if (filteredStock.length === 0) {
      setError(
        "There are no stock records to export with the current filters."
      );
      return;
    }

    const columns = [
      ["SKU", "sku"],
      ["Product", "product_name"],
      ["Warehouse", "warehouse_name"],
      ["Quantity", "quantity"],
      ["Cost Value", "stock_cost_value"],
      ["Sale Value", "stock_sale_value"],
      ["Status", "stock_status"],
    ];

    const escapeCSV = (value) => {
      let text = String(value ?? "");

      // Reduce spreadsheet formula injection risk.
      if (/^[=+\-@\t\r]/.test(text)) {
        text = `'${text}`;
      }

      return `"${text.replace(/"/g, '""')}"`;
    };

    const csv = [
      columns.map(([heading]) => escapeCSV(heading)).join(","),
      ...filteredStock.map((item) =>
        columns.map(([, key]) => escapeCSV(item[key])).join(",")
      ),
    ].join("\r\n");

    const blob = new Blob(["\uFEFF" + csv], {
      type: "text/csv;charset=utf-8;",
    });

    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = `stock-report-${new Date()
      .toISOString()
      .slice(0, 10)}.csv`;

    document.body.appendChild(link);
    link.click();
    link.remove();

    URL.revokeObjectURL(url);
  };

  if (permissionLoading) {
    return <LoadingState message="Checking your Stock Report permissions..." />;
  }

  if (permissionError && !permission) {
    return <AccessDenied message={permissionError} />;
  }

  if (!canView) {
    return (
      <AccessDenied message="Your role does not have View permission for Stock Report. Ask your administrator to enable View in User Rights." />
    );
  }

  if (loading) {
    return <LoadingState />;
  }

  return (
    <div className="stock-report-page w-full min-w-0 text-gray-900 dark:text-gray-100">
      <div className="w-full min-w-0 space-y-6 lg:space-y-8">
        {/* Header */}
        <div className="flex flex-col justify-between gap-5 xl:flex-row xl:items-center">
          <div className="flex items-start gap-4">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-600 to-blue-600 text-white shadow-lg shadow-indigo-600/20">
              <BarChart3 className="h-7 w-7" />
            </div>

            <div>
              <div className="mb-1 flex flex-wrap items-center gap-2">
                <h1 className="text-2xl font-bold tracking-tight text-gray-900 sm:text-3xl dark:text-white">
                  Stock Report
                </h1>
                <span className="rounded-full border border-blue-100 bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700 dark:border-blue-900 dark:bg-blue-950/60 dark:text-blue-300">
                  Inventory
                </span>
              </div>

              <p className="max-w-2xl text-sm leading-6 text-gray-500 dark:text-gray-400">
                Monitor current inventory, warehouse quantities, stock status, and
                estimated inventory values from one place.
              </p>

              <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-gray-500 dark:text-gray-400">
                <span className="inline-flex items-center gap-2">
                  <Package className="h-4 w-4" />
                  {formatNumber(summary.productCount)} products
                </span>
                <span className="inline-flex items-center gap-2">
                  <Warehouse className="h-4 w-4" />
                  {formatNumber(warehouses.length)} warehouses
                </span>
                <span className="inline-flex items-center gap-2">
                  <Layers3 className="h-4 w-4" />
                  {formatNumber(stock.length)} records
                </span>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-600 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300">
              <Clock3 className="h-4 w-4" />
              <span>
                Updated{" "}
                {new Date().toLocaleDateString("en-PK", {
                  day: "2-digit",
                  month: "short",
                  year: "numeric",
                })}
              </span>
            </div>

            <button
              type="button"
              onClick={() => loadData({ silent: true })}
              disabled={refreshing}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm font-semibold text-gray-700 transition hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700 disabled:cursor-not-allowed disabled:opacity-70 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200"
            >
              <RefreshCw
                className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`}
              />
              {refreshing ? "Refreshing..." : "Refresh"}
            </button>

            <button
              type="button"
              onClick={exportCSV}
              disabled={filteredStock.length === 0}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-blue-600/20 transition disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Download className="h-4 w-4" />
              Export CSV
            </button>
          </div>
        </div>

        {/* Error message */}
        {error && (
          <div
            role="alert"
            className="flex flex-col gap-3 rounded-2xl border border-red-200 bg-red-50 p-4 text-red-800 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-300 sm:flex-row sm:items-center sm:justify-between"
          >
            <div className="flex items-start gap-3">
              <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
              <p className="text-sm">{error}</p>
            </div>

            <button
              type="button"
              onClick={() => setError("")}
              className="self-start rounded-lg p-1 transition hover:bg-red-100 dark:hover:bg-red-900/40 sm:self-center"
              aria-label="Dismiss error"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        {/* Summary cards */}

        {/* Inventory Overview */}
        <section>
          <div className="mb-4">
            <h2 className="text-lg font-bold text-gray-900 dark:text-white sm:text-xl">
              Inventory Overview
            </h2>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              Monitor stock quantities, availability, and inventory performance.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
            <StatCard
              title="Total Products"
              value={formatNumber(summary.productCount)}
              subtitle="Products included in the stock report"
              icon={Package}
              color="blue"
            />

            <StatCard
              title="Total Stock Quantity"
              value={formatNumber(summary.totalQuantity)}
              subtitle="Combined quantity across stock records"
              icon={Boxes}
              color="purple"
            />

            <StatCard
              title="Low Stock Records"
              value={formatNumber(summary.lowStockCount)}
              subtitle="Items requiring replenishment"
              icon={AlertTriangle}
              color="amber"
            />

            <StatCard
              title="Out of Stock Records"
              value={formatNumber(summary.outOfStockCount)}
              subtitle="Items with zero or negative quantity"
              icon={XCircle}
              color="red"
            />

            <StatCard
              title="Total Stock Cost Value"
              value={formatAmount(summary.totalCostValue)}
              subtitle="Estimated cost value of current inventory"
              icon={DollarSign}
              color="green"
            />

            <StatCard
              title="Total Potential Sale Value"
              value={formatAmount(summary.totalSaleValue)}
              subtitle="Estimated selling value of current inventory"
              icon={ShoppingCart}
              color="indigo"
            />
          </div>
        </section>
        <section className="min-w-0">
          <div className="p-5 sm:p-6">
            <div className="flex flex-col justify-between gap-4 xl:flex-row xl:items-center">
              <div className="flex items-center gap-2">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 dark:bg-blue-950/50">
                  <FileSpreadsheet className="h-5 w-5 text-blue-600 dark:text-blue-300" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-gray-900 dark:text-white">
                    Stock Details
                  </h2>
                  <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">
                    Search, filter, and review inventory by warehouse.
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <div className="inline-flex w-fit items-center gap-2 rounded-xl bg-gray-100 px-3 py-2 text-sm text-gray-600 dark:bg-gray-800 dark:text-gray-300">
                  <Boxes className="h-4 w-4" />
                  <span>
                    Showing{" "}
                    <strong className="text-gray-900 dark:text-white">
                      {formatNumber(filteredStock.length)}
                    </strong>{" "}
                    of {formatNumber(stock.length)} records
                  </span>
                </div>

                {/* COLUMN PICKER (table view only; mobile shows cards) */}
                <div className="hidden md:block">
                  <ColumnToggle columns={STOCK_COLUMNS} state={stockCols} />
                </div>
              </div>
            </div>

            <div className="mt-5 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-[minmax(240px,1.5fr)_minmax(180px,1fr)_minmax(180px,1fr)_auto]">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <input
                  type="search"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search SKU, product, warehouse..."
                  aria-label="Search stock"
                  className="w-full rounded-xl border border-gray-200 bg-gray-50 py-3 pl-10 pr-4 text-sm text-gray-900 outline-none transition placeholder:text-gray-400 focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-500/10 dark:border-gray-700 dark:bg-gray-800 dark:text-white dark:focus:border-blue-500 dark:focus:bg-gray-800"
                />
              </div>

              <div className="relative">
                <Warehouse className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <select
                  value={warehouseFilter}
                  onChange={(event) => setWarehouseFilter(event.target.value)}
                  aria-label="Filter by warehouse"
                  className="w-full appearance-none rounded-xl border border-gray-200 bg-gray-50 py-3 pl-10 pr-10 text-sm text-gray-800 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
                >
                  <option value="all">All Warehouses</option>
                  {warehouses.map((warehouse) => (
                    <option key={warehouse} value={warehouse}>
                      {warehouse}
                    </option>
                  ))}
                </select>
                <ChevronDown className="pointer-events-none absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              </div>

              <div className="relative">
                <Filter className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <select
                  value={statusFilter}
                  onChange={(event) => setStatusFilter(event.target.value)}
                  aria-label="Filter by stock status"
                  className="w-full appearance-none rounded-xl border border-gray-200 bg-gray-50 py-3 pl-10 pr-10 text-sm text-gray-800 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
                >
                  <option value="all">All Statuses</option>
                  <option value="normal">Normal Stock</option>
                  <option value="low">Low Stock</option>
                  <option value="out">Out of Stock</option>
                </select>
                <ChevronDown className="pointer-events-none absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              </div>

              <button
                type="button"
                onClick={clearFilters}
                disabled={
                  !search &&
                  warehouseFilter === "all" &&
                  statusFilter === "all"
                }
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-gray-200 px-4 py-3 text-sm font-semibold text-gray-600 transition hover:border-gray-300 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
              >
                <X className="h-4 w-4" />
                Clear Filters
              </button>
            </div>
          </div>

          {filteredStock.length === 0 ? (
            <div className="flex min-h-72 flex-col items-center justify-center px-6 py-14 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gray-100 dark:bg-gray-800">
                {stock.length === 0 ? (
                  <Package className="h-8 w-8 text-gray-400" />
                ) : (
                  <Search className="h-8 w-8 text-gray-400" />
                )}
              </div>

              <h3 className="mt-5 text-lg font-bold text-gray-900 dark:text-white">
                {stock.length === 0
                  ? "No stock records available"
                  : "No matching stock records"}
              </h3>

              <p className="mt-2 max-w-md text-sm leading-6 text-gray-500 dark:text-gray-400">
                {stock.length === 0
                  ? "Your stock report does not contain any inventory records yet."
                  : "Try a different search term or clear your filters to see more results."}
              </p>

              {stock.length > 0 && (
                <button
                  type="button"
                  onClick={clearFilters}
                  className="mt-5 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700"
                >
                  Clear all filters
                </button>
              )}
            </div>
          ) : (
            <>
              {/* Desktop and tablet table.
                  The horizontal scrollbar appears only when the visible
                  columns are wider than the container. */}
              <div className="hidden w-full min-w-0 overflow-x-auto [scrollbar-width:thin] md:block">
                <table className="w-full border-collapse text-left text-sm">
                  <thead className="bg-gray-50 dark:bg-gray-800/80">
                    <tr className="border-b border-gray-200 dark:border-gray-800">
                      {stockCols.visible.sku && (
                        <th className="whitespace-nowrap px-5 py-4 font-semibold text-gray-600 dark:text-gray-300">
                          <button
                            type="button"
                            onClick={() => handleSort("sku")}
                            className="inline-flex items-center gap-1.5 hover:text-blue-600 dark:hover:text-blue-400"
                          >
                            SKU
                            <ArrowUpDown className="h-3.5 w-3.5" />
                          </button>
                        </th>
                      )}

                      {stockCols.visible.product && (
                        <th className="whitespace-nowrap px-5 py-4 font-semibold text-gray-600 dark:text-gray-300">
                          <button
                            type="button"
                            onClick={() => handleSort("product_name")}
                            className="inline-flex items-center gap-1.5 hover:text-blue-600 dark:hover:text-blue-400"
                          >
                            Product
                            <ArrowUpDown className="h-3.5 w-3.5" />
                          </button>
                        </th>
                      )}

                      {stockCols.visible.warehouse && (
                        <th className="whitespace-nowrap px-5 py-4 font-semibold text-gray-600 dark:text-gray-300">
                          Warehouse
                        </th>
                      )}

                      {stockCols.visible.quantity && (
                        <th className="whitespace-nowrap px-5 py-4 text-right font-semibold text-gray-600 dark:text-gray-300">
                          <button
                            type="button"
                            onClick={() => handleSort("quantity")}
                            className="ml-auto inline-flex items-center gap-1.5 hover:text-blue-600 dark:hover:text-blue-400"
                          >
                            Quantity
                            <ArrowUpDown className="h-3.5 w-3.5" />
                          </button>
                        </th>
                      )}

                      {stockCols.visible.cost && (
                        <th className="whitespace-nowrap px-5 py-4 text-right font-semibold text-gray-600 dark:text-gray-300">
                          <button
                            type="button"
                            onClick={() => handleSort("stock_cost_value")}
                            className="ml-auto inline-flex items-center gap-1.5 hover:text-blue-600 dark:hover:text-blue-400"
                          >
                            Cost Value
                            <ArrowUpDown className="h-3.5 w-3.5" />
                          </button>
                        </th>
                      )}

                      {stockCols.visible.sale && (
                        <th className="whitespace-nowrap px-5 py-4 text-right font-semibold text-gray-600 dark:text-gray-300">
                          <button
                            type="button"
                            onClick={() => handleSort("stock_sale_value")}
                            className="ml-auto inline-flex items-center gap-1.5 hover:text-blue-600 dark:hover:text-blue-400"
                          >
                            Sale Value
                            <ArrowUpDown className="h-3.5 w-3.5" />
                          </button>
                        </th>
                      )}

                      {stockCols.visible.status && (
                        <th className="whitespace-nowrap px-5 py-4 font-semibold text-gray-600 dark:text-gray-300">
                          <button
                            type="button"
                            onClick={() => handleSort("stock_status")}
                            className="inline-flex items-center gap-1.5 hover:text-blue-600 dark:hover:text-blue-400"
                          >
                            Status
                            <ArrowUpDown className="h-3.5 w-3.5" />
                          </button>
                        </th>
                      )}
                    </tr>
                  </thead>

                  <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                    {filteredStock.map((item, index) => (
                      <tr
                        key={
                          item.stock_id ??
                          `${item.sku}-${item.warehouse_name}-${index}`
                        }
                        className="transition-colors hover:bg-blue-50/60 dark:hover:bg-blue-950/20"
                      >
                        {stockCols.visible.sku && (
                          <td className="whitespace-nowrap px-5 py-4">
                            <span className="inline-flex rounded-lg border border-gray-200 bg-gray-50 px-2.5 py-1 font-mono text-xs font-semibold text-gray-700 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300">
                              {item.sku || "—"}
                            </span>
                          </td>
                        )}

                        {stockCols.visible.product && (
                          <td className="px-5 py-4">
                            <div className="flex min-w-[180px] items-center gap-3">
                              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 dark:bg-blue-950/50">
                                <Package className="h-5 w-5 text-blue-600 dark:text-blue-300" />
                              </div>
                              <span className="font-semibold text-gray-900 dark:text-gray-100">
                                {item.product_name || "Unnamed Product"}
                              </span>
                            </div>
                          </td>
                        )}

                        {stockCols.visible.warehouse && (
                          <td className="whitespace-nowrap px-5 py-4">
                            <span className="inline-flex items-center gap-2 text-gray-600 dark:text-gray-300">
                              <Warehouse className="h-4 w-4 text-gray-400" />
                              {item.warehouse_name || "Unassigned"}
                            </span>
                          </td>
                        )}

                        {stockCols.visible.quantity && (
                          <td className="whitespace-nowrap px-5 py-4 text-right">
                            <span
                              className={`font-bold tabular-nums ${Number(item.quantity ?? 0) <= 0
                                ? "text-red-600 dark:text-red-400"
                                : "text-gray-900 dark:text-white"
                                }`}
                            >
                              {formatNumber(item.quantity)}
                            </span>
                          </td>
                        )}

                        {stockCols.visible.cost && (
                          <td className="whitespace-nowrap px-5 py-4 text-right font-medium tabular-nums text-gray-700 dark:text-gray-300">
                            {formatAmount(item.stock_cost_value)}
                          </td>
                        )}

                        {stockCols.visible.sale && (
                          <td className="whitespace-nowrap px-5 py-4 text-right font-medium tabular-nums text-gray-700 dark:text-gray-300">
                            {formatAmount(item.stock_sale_value)}
                          </td>
                        )}

                        {stockCols.visible.status && (
                          <td className="whitespace-nowrap px-5 py-4">
                            <StatusBadge status={item.stock_status} />
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile cards */}
              <div className="grid grid-cols-1 gap-3 p-4 md:hidden">
                {filteredStock.map((item, index) => (
                  <article
                    key={
                      item.stock_id ??
                      `${item.sku}-${item.warehouse_name}-${index}`
                    }
                    className="rounded-2xl border border-gray-200 bg-white p-4 transition hover:border-blue-200 dark:border-gray-800 dark:bg-gray-900 dark:hover:border-blue-900"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex min-w-0 items-start gap-3">
                        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-50 dark:bg-blue-950/50">
                          <Package className="h-5 w-5 text-blue-600 dark:text-blue-300" />
                        </div>

                        <div className="min-w-0">
                          <h3 className="break-words font-bold text-gray-900 dark:text-white">
                            {item.product_name || "Unnamed Product"}
                          </h3>
                          <p className="mt-1 break-all font-mono text-xs text-gray-500 dark:text-gray-400">
                            SKU: {item.sku || "—"}
                          </p>
                        </div>
                      </div>

                      <StatusBadge status={item.stock_status} />
                    </div>

                    <div className="mt-4 flex items-center gap-2 rounded-xl bg-gray-50 p-3 text-sm text-gray-600 dark:bg-gray-800 dark:text-gray-300">
                      <Warehouse className="h-4 w-4 shrink-0 text-gray-400" />
                      <span className="break-words">
                        {item.warehouse_name || "Unassigned"}
                      </span>
                    </div>

                    <div className="mt-4 grid grid-cols-2 gap-3">
                      <div className="rounded-xl border border-gray-100 p-3 dark:border-gray-800">
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          Quantity
                        </p>
                        <p
                          className={`mt-1 text-lg font-bold tabular-nums ${Number(item.quantity ?? 0) <= 0
                            ? "text-red-600 dark:text-red-400"
                            : "text-gray-900 dark:text-white"
                            }`}
                        >
                          {formatNumber(item.quantity)}
                        </p>
                      </div>

                      <div className="rounded-xl border border-gray-100 p-3 dark:border-gray-800">
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          Cost Value
                        </p>
                        <p className="mt-1 break-words text-base font-bold tabular-nums text-gray-900 dark:text-white">
                          {formatAmount(item.stock_cost_value)}
                        </p>
                      </div>

                      <div className="col-span-2 rounded-xl border border-gray-100 p-3 dark:border-gray-800">
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          Potential Sale Value
                        </p>
                        <p className="mt-1 text-lg font-bold tabular-nums text-indigo-700 dark:text-indigo-300">
                          {formatAmount(item.stock_sale_value)}
                        </p>
                      </div>
                    </div>
                  </article>
                ))}
              </div>

              <div className="flex flex-col gap-2 px-5 py-4 text-xs text-gray-500 dark:text-gray-400 sm:flex-row sm:items-center sm:justify-between">
                <p>
                  Displaying{" "}
                  <strong className="text-gray-700 dark:text-gray-200">
                    {formatNumber(filteredStock.length)}
                  </strong>{" "}
                  inventory records
                </p>

                <p className="flex items-center gap-1.5">
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                  Stock report loaded
                </p>
              </div>
            </>
          )}
        </section>

        <footer className="flex flex-col items-center justify-between gap-2 pb-2 text-center text-xs text-gray-400 dark:text-gray-500 sm:flex-row sm:text-left">
          <p>Inventory Management · Stock Report</p>
          <p>Use Refresh to retrieve the latest report data.</p>
        </footer>
      </div>
    </div>
  );
}