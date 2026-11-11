"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Boxes,
  Warehouse,
  Package,
  Search,
  RefreshCw,
  MapPin,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Filter,
  ArrowDownToLine,
  Activity,
  ClipboardList,
  LoaderCircle,
  Layers3,
  X,
  PackageSearch,
  ShieldCheck,
  LockKeyhole,
  Eye,
} from "lucide-react";

const inputClass =
  "w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:border-blue-400";

function toBoolean(value) {
  return (
    value === true ||
    value === 1 ||
    value === "1" ||
    (typeof value === "string" && value.toLowerCase() === "true")
  );
}

function formatQuantity(value) {
  const number = Number(value);

  if (!Number.isFinite(number)) return value ?? "—";

  return number.toLocaleString("en-PK", {
    maximumFractionDigits: 4,
  });
}

function AccessDenied() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 p-5 text-slate-900 dark:bg-slate-950 dark:text-white">
      <section className="w-full max-w-lg rounded-3xl border border-rose-200 bg-white p-8 text-center shadow-xl dark:border-rose-500/30 dark:bg-slate-900 sm:p-10">
        <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-3xl bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300">
          <LockKeyhole size={36} />
        </div>

        <h1 className="mt-6 text-2xl font-bold tracking-tight">
          Access Denied
        </h1>

        <p className="mt-3 text-sm leading-6 text-slate-600 dark:text-slate-300">
          You do not have permission to view the Stock Overview page.
          Please contact your administrator to request access.
        </p>

        <div className="mt-6 inline-flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-sm font-semibold text-rose-800 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-200">
          <Eye size={17} />
          Stock · View permission required
        </div>
      </section>
    </main>
  );
}

function PermissionLoading() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-slate-50 p-6 text-slate-900 dark:bg-slate-950 dark:text-white">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-blue-100 dark:bg-blue-500/15">
        <LoaderCircle
          size={32}
          className="animate-spin text-blue-700 dark:text-blue-300"
        />
      </div>

      <h2 className="mt-5 text-lg font-bold">Checking access</h2>

      <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
        Verifying your Stock permissions...
      </p>
    </main>
  );
}

function SummaryCard({ title, value, description, icon: Icon, tone }) {
  const tones = {
    blue: {
      icon: "bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300",
      glow: "from-blue-500/10",
    },
    emerald: {
      icon:
        "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300",
      glow: "from-emerald-500/10",
    },
    rose: {
      icon: "bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300",
      glow: "from-rose-500/10",
    },
    violet: {
      icon:
        "bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300",
      glow: "from-violet-500/10",
    },
  };

  const selected = tones[tone] || tones.blue;

  return (
    <div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition duration-200 hover:-translate-y-0.5 hover:shadow-md dark:border-slate-800 dark:bg-slate-900">
      <div
        className={`pointer-events-none absolute inset-0 bg-gradient-to-br ${selected.glow} to-transparent`}
      />

      <div className="relative flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
            {title}
          </p>

          <p className="mt-3 break-words text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
            {value}
          </p>

          <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
            {description}
          </p>
        </div>

        <div
          className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl ${selected.icon}`}
        >
          <Icon size={23} />
        </div>
      </div>
    </div>
  );
}

function StockStatus({ lowStock, quantity }) {
  const isOut = Number(quantity) <= 0;
  const isLow = Boolean(toBoolean(lowStock)) || isOut;

  if (isOut) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-semibold text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-300">
        <XCircle size={14} />
        Out of Stock
      </span>
    );
  }

  if (isLow) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300">
        <AlertTriangle size={14} />
        Low Stock
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300">
      <CheckCircle2 size={14} />
      Normal
    </span>
  );
}

export default function StockPage() {
  const [permissionsLoading, setPermissionsLoading] = useState(true);
  const [canView, setCanView] = useState(false);
  const [canCreate, setCanCreate] = useState(false);
  const [canEdit, setCanEdit] = useState(false);
  const [canUpdate, setCanUpdate] = useState(false);
  const [canDelete, setCanDelete] = useState(false);
  const [permissionError, setPermissionError] = useState("");

  const [warehouses, setWarehouses] = useState([]);
  const [stock, setStock] = useState([]);
  const [warehouseId, setWarehouseId] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [warehouseError, setWarehouseError] = useState("");

  // Check permissions for the currently signed-in user.
  useEffect(() => {
    let cancelled = false;

    async function loadPermissions() {
      setPermissionsLoading(true);
      setPermissionError("");

      try {
        const response = await fetch("/api/permissions/current", {
          cache: "no-store",
          credentials: "same-origin",
        });

        const data = await response.json().catch(() => ({}));

        if (!response.ok || data.success === false) {
          throw new Error(
            data.message || data.error || "Unable to verify permissions."
          );
        }

        const permissionList = Array.isArray(data.permissions)
          ? data.permissions
          : [];

        const stockPermission = permissionList.find((permission) => {
          const key = String(permission.permission_key || "")
            .trim()
            .toLowerCase();

          return key === "stock";
        });

        // Support an explicit administrator flag if your API returns one.
        const isAdmin =
          data.roleIsAdmin === true ||
          data.isAdmin === true ||
          data.is_admin === true;

        if (cancelled) return;

        if (isAdmin) {
          setCanView(true);
          setCanCreate(true);
          setCanEdit(true);
          setCanUpdate(true);
          setCanDelete(true);
        } else if (stockPermission) {
          setCanView(toBoolean(stockPermission.can_view));
          setCanCreate(toBoolean(stockPermission.can_create));

          // "Edit" and "Update" can share the same database permission.
          setCanEdit(
            toBoolean(stockPermission.can_edit) ||
              toBoolean(stockPermission.can_update)
          );

          setCanUpdate(
            toBoolean(stockPermission.can_update) ||
              toBoolean(stockPermission.can_edit)
          );

          setCanDelete(toBoolean(stockPermission.can_delete));
        } else {
          // No Stock permission record means no access.
          setCanView(false);
          setCanCreate(false);
          setCanEdit(false);
          setCanUpdate(false);
          setCanDelete(false);
        }
      } catch (err) {
        if (!cancelled) {
          setCanView(false);
          setCanCreate(false);
          setCanEdit(false);
          setCanUpdate(false);
          setCanDelete(false);
          setPermissionError(
            err.message || "Unable to verify your Stock permissions."
          );
        }
      } finally {
        if (!cancelled) {
          setPermissionsLoading(false);
        }
      }
    }

    loadPermissions();

    return () => {
      cancelled = true;
    };
  }, []);

  // Load warehouses only after View permission has been granted.
  useEffect(() => {
    if (permissionsLoading || !canView) return;

    let cancelled = false;

    async function fetchWarehouses() {
      try {
        const response = await fetch("/api/warehouses", {
          cache: "no-store",
        });

        const data = await response.json().catch(() => ({}));

        if (!response.ok) {
          throw new Error(
            data.message || "Failed to load warehouses."
          );
        }

        if (!cancelled) {
          setWarehouses(
            Array.isArray(data.warehouses) ? data.warehouses : []
          );
          setWarehouseError("");
        }
      } catch (err) {
        if (!cancelled) {
          setWarehouseError(
            err.message || "Unable to load warehouses."
          );
        }
      }
    }

    fetchWarehouses();

    return () => {
      cancelled = true;
    };
  }, [permissionsLoading, canView]);

  // Fetch stock whenever the selected warehouse changes.
  useEffect(() => {
    if (permissionsLoading || !canView) return;

    let cancelled = false;

    async function fetchStock() {
      setLoading(true);
      setError("");

      try {
        const url = warehouseId
          ? `/api/stock?warehouseId=${encodeURIComponent(warehouseId)}`
          : "/api/stock";

        const response = await fetch(url, {
          cache: "no-store",
          credentials: "same-origin",
        });

        const data = await response.json().catch(() => ({}));

        if (!response.ok || data.success === false) {
          throw new Error(
            data.message || data.error || "Failed to load stock."
          );
        }

        if (!cancelled) {
          setStock(Array.isArray(data.stock) ? data.stock : []);
        }
      } catch (err) {
        if (!cancelled) {
          setStock([]);
          setError(err.message || "Unable to load stock.");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    fetchStock();

    return () => {
      cancelled = true;
    };
  }, [warehouseId, permissionsLoading, canView]);

  const loadStock = useCallback(async () => {
    if (!canView) return;

    setRefreshing(true);
    setError("");

    try {
      const url = warehouseId
        ? `/api/stock?warehouseId=${encodeURIComponent(warehouseId)}`
        : "/api/stock";

      const response = await fetch(url, {
        cache: "no-store",
        credentials: "same-origin",
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok || data.success === false) {
        throw new Error(
          data.message || data.error || "Failed to load stock."
        );
      }

      setStock(Array.isArray(data.stock) ? data.stock : []);
    } catch (err) {
      setError(err.message || "Unable to load stock.");
    } finally {
      setRefreshing(false);
    }
  }, [canView, warehouseId]);

  const loadWarehouses = useCallback(async () => {
    if (!canView) return;

    try {
      const response = await fetch("/api/warehouses", {
        cache: "no-store",
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(
          data.message || "Failed to load warehouses."
        );
      }

      setWarehouses(
        Array.isArray(data.warehouses) ? data.warehouses : []
      );
      setWarehouseError("");
    } catch (err) {
      setWarehouseError(
        err.message || "Unable to load warehouses."
      );
    }
  }, [canView]);

  const filteredStock = useMemo(() => {
    const query = search.trim().toLowerCase();

    return stock.filter((item) => {
      const matchesSearch =
        !query ||
        [
          item.sku,
          item.product_name,
          item.warehouse_name,
          item.unit,
        ].some((value) =>
          String(value ?? "").toLowerCase().includes(query)
        );

      const quantity = Number(item.quantity);
      const isOutOfStock = Number.isFinite(quantity) && quantity <= 0;
      const isLowStock = toBoolean(item.low_stock) || isOutOfStock;

      const matchesStatus =
        statusFilter === "all" ||
        (statusFilter === "low" && isLowStock && !isOutOfStock) ||
        (statusFilter === "normal" && !isLowStock) ||
        (statusFilter === "out" && isOutOfStock);

      return matchesSearch && matchesStatus;
    });
  }, [stock, search, statusFilter]);

  const summary = useMemo(() => {
    const low = stock.filter((item) => {
      const quantity = Number(item.quantity);

      return (
        (toBoolean(item.low_stock) || quantity <= 0) &&
        quantity > 0
      );
    }).length;

    const out = stock.filter(
      (item) => Number(item.quantity) <= 0
    ).length;

    const normal = stock.filter((item) => {
      const quantity = Number(item.quantity);
      return quantity > 0 && !toBoolean(item.low_stock);
    }).length;

    const totalQuantity = stock.reduce((total, item) => {
      const quantity = Number(item.quantity);
      return total + (Number.isFinite(quantity) ? quantity : 0);
    }, 0);

    return {
      products: stock.length,
      low,
      out,
      normal,
      totalQuantity,
    };
  }, [stock]);

  function exportCsv() {
    if (!canView || !filteredStock.length) return;

    const columns = [
      ["SKU", "sku"],
      ["Product", "product_name"],
      ["Warehouse", "warehouse_name"],
      ["Unit", "unit"],
      ["Quantity", "quantity"],
      ["Low Stock", "low_stock"],
    ];

    const escapeCsv = (value) =>
      `"${String(value ?? "").replace(/"/g, '""')}"`;

    const csv = [
      columns.map(([label]) => escapeCsv(label)).join(","),
      ...filteredStock.map((item) =>
        columns.map(([, key]) => escapeCsv(item[key])).join(",")
      ),
    ].join("\r\n");

    const blob = new Blob(["\uFEFF" + csv], {
      type: "text/csv;charset=utf-8;",
    });

    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = "stock-report.csv";
    document.body.appendChild(link);
    link.click();
    link.remove();

    // Allow the browser to begin downloading before releasing the URL.
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  // Do not render stock data before the permission check finishes.
  if (permissionsLoading) {
    return <PermissionLoading />;
  }

  // A missing permission or a failed permission request denies access.
  if (!canView) {
    return <AccessDenied />;
  }

  return (
    <div className="min-h-screen space-y-6 bg-slate-50/70 p-4 text-slate-900 dark:bg-slate-950 dark:text-slate-100 sm:p-6 lg:p-8">
      {/* Header */}
      <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-950 via-slate-900 to-blue-950 p-6 text-white shadow-xl shadow-slate-900/10 sm:p-8">
        <div className="pointer-events-none absolute -right-12 -top-20 h-64 w-64 rounded-full bg-blue-500/20 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-24 right-1/3 h-48 w-48 rounded-full bg-cyan-400/10 blur-3xl" />

        <div className="relative flex flex-col justify-between gap-6 lg:flex-row lg:items-center">
          <div>
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-xs font-semibold text-blue-100 backdrop-blur">
              <Layers3 size={15} />
              INVENTORY MANAGEMENT
            </div>

            <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
              Stock Overview
            </h1>

            <p className="mt-3 max-w-xl text-sm leading-6 text-slate-300 sm:text-base">
              Monitor product quantities across your warehouses, identify
              low-stock items, and keep your inventory organized.
            </p>

            <div className="mt-5 flex flex-wrap items-center gap-3 text-sm text-slate-300">
              <span className="inline-flex items-center gap-2">
                <Warehouse size={16} className="text-blue-300" />
                {warehouseId
                  ? warehouses.find(
                      (warehouse) =>
                        String(warehouse.warehouse_id) ===
                        String(warehouseId)
                    )?.warehouse_name || "Selected warehouse"
                  : "All warehouses"}
              </span>

              <span className="hidden text-slate-600 sm:inline">•</span>

              <span className="inline-flex items-center gap-2">
                <Activity size={16} className="text-emerald-300" />
                {summary.products} stock records
              </span>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => {
                loadWarehouses();
                loadStock();
              }}
              disabled={refreshing}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/20 bg-white/10 px-4 py-3 text-sm font-semibold text-white transition hover:bg-white/15 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <RefreshCw
                size={17}
                className={refreshing ? "animate-spin" : ""}
              />
              Refresh
            </button>

            <button
              type="button"
              onClick={exportCsv}
              disabled={!filteredStock.length}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-white px-5 py-3 text-sm font-bold text-slate-900 shadow-lg transition hover:-translate-y-0.5 hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <ArrowDownToLine size={18} />
              Export CSV
            </button>
          </div>
        </div>
      </section>

      {/* Warehouse and stock errors */}
      {warehouseError && (
        <div className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300">
          <AlertTriangle size={20} className="mt-0.5 shrink-0" />
          <div>
            <p className="font-semibold">Warehouse list unavailable</p>
            <p className="mt-1 text-sm">{warehouseError}</p>
          </div>
        </div>
      )}

      {error && (
        <div
          role="alert"
          className="flex items-start gap-3 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-rose-800 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-300"
        >
          <AlertTriangle size={20} className="mt-0.5 shrink-0" />

          <div className="flex-1">
            <p className="font-semibold">Unable to load stock</p>
            <p className="mt-1 text-sm">{error}</p>
          </div>

          <button
            type="button"
            onClick={loadStock}
            className="rounded-lg px-3 py-1.5 text-sm font-bold hover:bg-rose-100 dark:hover:bg-rose-500/10"
          >
            Retry
          </button>
        </div>
      )}

      {/* Summary */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryCard
          title="Stock Records"
          value={summary.products}
          description="Records returned by the API"
          icon={Package}
          tone="blue"
        />

        <SummaryCard
          title="Normal Stock"
          value={summary.normal}
          description="Records not marked low stock"
          icon={CheckCircle2}
          tone="emerald"
        />

        <SummaryCard
          title="Low Stock"
          value={summary.low}
          description="Records needing replenishment"
          icon={AlertTriangle}
          tone="rose"
        />

        <SummaryCard
          title="Out of Stock"
          value={summary.out}
          description="Records with zero or less quantity"
          icon={XCircle}
          tone="violet"
        />
      </div>

      {/* Warehouse selection */}
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-6">
        <div className="mb-5 flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300">
            <Warehouse size={22} />
          </div>

          <div>
            <h2 className="font-bold text-slate-900 dark:text-white">
              Warehouse Selection
            </h2>

            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              Choose a location to view its stock records.
            </p>
          </div>
        </div>

        <div className="flex flex-col gap-4 lg:flex-row lg:items-end">
          <div className="w-full lg:max-w-md">
            <label
              htmlFor="warehouseFilter"
              className="mb-2 block text-sm font-semibold text-slate-700 dark:text-slate-200"
            >
              Select Warehouse
            </label>

            <div className="relative">
              <MapPin
                size={18}
                className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
              />

              <select
                id="warehouseFilter"
                value={warehouseId}
                onChange={(event) => setWarehouseId(event.target.value)}
                className={`${inputClass} appearance-none pl-10 pr-10`}
              >
                <option value="">All Warehouses</option>

                {warehouses.map((warehouse) => (
                  <option
                    key={warehouse.warehouse_id}
                    value={warehouse.warehouse_id}
                  >
                    {warehouse.warehouse_name}
                  </option>
                ))}
              </select>

              <Filter
                size={16}
                className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400"
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 pb-0.5">
            <span className="inline-flex items-center gap-2 rounded-xl bg-slate-100 px-3.5 py-3 text-sm font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-300">
              <Warehouse size={16} />
              {warehouseId ? "Single warehouse" : "Combined view"}
            </span>

            {warehouseId && (
              <button
                type="button"
                onClick={() => setWarehouseId("")}
                className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-3.5 py-3 text-sm font-semibold text-slate-600 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
              >
                <X size={15} />
                Clear selection
              </button>
            )}
          </div>
        </div>
      </section>

      {/* Stock table */}
      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="border-b border-slate-200 p-5 dark:border-slate-800 sm:p-6">
          <div className="flex flex-col justify-between gap-4 xl:flex-row xl:items-center">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-indigo-100 text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-300">
                <ClipboardList size={22} />
              </div>

              <div>
                <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                  Inventory Records
                </h2>

                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                  Search products and monitor stock availability.
                </p>
              </div>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row">
              <div className="relative min-w-0 sm:min-w-[260px]">
                <Search
                  size={18}
                  className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
                />

                <input
                  type="search"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search SKU, product..."
                  aria-label="Search stock records"
                  className={`${inputClass} pl-10 pr-10`}
                />

                {search && (
                  <button
                    type="button"
                    onClick={() => setSearch("")}
                    aria-label="Clear search"
                    className="absolute right-3 top-1/2 -translate-y-1/2 rounded p-1 text-slate-400 hover:text-slate-700 dark:hover:text-white"
                  >
                    <X size={15} />
                  </button>
                )}
              </div>

              <div className="relative">
                <Filter
                  size={16}
                  className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
                />

                <select
                  value={statusFilter}
                  onChange={(event) => setStatusFilter(event.target.value)}
                  aria-label="Filter by stock status"
                  className="w-full appearance-none rounded-xl border border-slate-200 bg-white py-3 pl-9 pr-9 text-sm font-medium text-slate-700 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 sm:w-auto"
                >
                  <option value="all">All Statuses</option>
                  <option value="normal">Normal Stock</option>
                  <option value="low">Low Stock</option>
                  <option value="out">Out of Stock</option>
                </select>
              </div>
            </div>
          </div>

          <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Showing{" "}
              <span className="font-bold text-slate-900 dark:text-white">
                {filteredStock.length}
              </span>{" "}
              of{" "}
              <span className="font-bold text-slate-900 dark:text-white">
                {stock.length}
              </span>{" "}
              records
            </p>

            {(search || statusFilter !== "all") && (
              <button
                type="button"
                onClick={() => {
                  setSearch("");
                  setStatusFilter("all");
                }}
                className="text-sm font-semibold text-blue-600 transition hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
              >
                Clear filters
              </button>
            )}
          </div>
        </div>

        {loading ? (
          <div className="flex min-h-64 flex-col items-center justify-center p-8">
            <LoaderCircle
              size={36}
              className="animate-spin text-blue-600 dark:text-blue-400"
            />

            <p className="mt-4 font-semibold text-slate-700 dark:text-slate-200">
              Loading inventory
            </p>

            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              Fetching stock records...
            </p>
          </div>
        ) : filteredStock.length === 0 ? (
          <div className="flex min-h-72 flex-col items-center justify-center px-5 py-12 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-500">
              <PackageSearch size={30} />
            </div>

            <h3 className="mt-5 text-lg font-bold text-slate-900 dark:text-white">
              {error
                ? "Stock could not be loaded"
                : search || statusFilter !== "all"
                  ? "No matching stock records"
                  : "No stock records found"}
            </h3>

            <p className="mt-2 max-w-md text-sm leading-6 text-slate-500 dark:text-slate-400">
              {error
                ? "Check the API response and try refreshing the stock list."
                : search || statusFilter !== "all"
                  ? "Try another search term or clear the filters to see all available records."
                  : "There are no stock records returned for the selected warehouse. Check your stock entries and warehouse selection."}
            </p>

            {(search || statusFilter !== "all") && (
              <button
                type="button"
                onClick={() => {
                  setSearch("");
                  setStatusFilter("all");
                }}
                className="mt-5 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                Clear filters
              </button>
            )}

            {error && (
              <button
                type="button"
                onClick={loadStock}
                className="mt-3 inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-blue-700"
              >
                <RefreshCw size={16} />
                Try Again
              </button>
            )}
          </div>
        ) : (
          <>
            {/* Desktop table */}
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full min-w-[850px] text-left">
                <thead className="bg-slate-50 dark:bg-slate-800/70">
                  <tr>
                    <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                      Product
                    </th>

                    <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                      Warehouse
                    </th>

                    <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                      Unit
                    </th>

                    <th className="px-6 py-4 text-right text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                      Quantity
                    </th>

                    <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                      Status
                    </th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {filteredStock.map((item, index) => (
                    <tr
                      key={
                        item.stock_id ??
                        `${item.sku}-${item.warehouse_id}-${index}`
                      }
                      className="transition hover:bg-blue-50/40 dark:hover:bg-slate-800/50"
                    >
                      <td className="px-6 py-5">
                        <div className="flex items-center gap-3">
                          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-blue-100 to-indigo-100 text-blue-700 dark:from-blue-500/15 dark:to-indigo-500/15 dark:text-blue-300">
                            <Package size={21} />
                          </div>

                          <div className="min-w-0">
                            <p className="font-bold text-slate-900 dark:text-white">
                              {item.product_name || "Unnamed product"}
                            </p>

                            <p className="mt-1 text-xs font-medium text-slate-500 dark:text-slate-400">
                              SKU: {item.sku || "—"}
                            </p>
                          </div>
                        </div>
                      </td>

                      <td className="px-6 py-5">
                        <div className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
                          <Warehouse
                            size={16}
                            className="shrink-0 text-slate-400"
                          />

                          <span>{item.warehouse_name || "Unassigned"}</span>
                        </div>
                      </td>

                      <td className="px-6 py-5">
                        <span className="inline-flex rounded-lg bg-slate-100 px-2.5 py-1.5 text-xs font-semibold text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                          {item.unit || "—"}
                        </span>
                      </td>

                      <td className="px-6 py-5 text-right">
                        <span
                          className={`text-base font-bold tabular-nums ${
                            Number(item.quantity) <= 0
                              ? "text-rose-600 dark:text-rose-400"
                              : toBoolean(item.low_stock)
                                ? "text-amber-600 dark:text-amber-400"
                                : "text-slate-900 dark:text-white"
                          }`}
                        >
                          {formatQuantity(item.quantity)}
                        </span>
                      </td>

                      <td className="px-6 py-5">
                        <StockStatus
                          lowStock={item.low_stock}
                          quantity={item.quantity}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile cards */}
            <div className="grid grid-cols-1 gap-4 p-4 md:hidden">
              {filteredStock.map((item, index) => (
                <article
                  key={
                    item.stock_id ??
                    `${item.sku}-${item.warehouse_id}-${index}`
                  }
                  className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900"
                >
                  <div className="flex items-start gap-3">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-blue-100 to-indigo-100 text-blue-700 dark:from-blue-500/15 dark:to-indigo-500/15 dark:text-blue-300">
                      <Package size={22} />
                    </div>

                    <div className="min-w-0 flex-1">
                      <h3 className="break-words font-bold text-slate-900 dark:text-white">
                        {item.product_name || "Unnamed product"}
                      </h3>

                      <p className="mt-1 text-xs font-medium text-slate-500 dark:text-slate-400">
                        SKU: {item.sku || "—"}
                      </p>
                    </div>
                  </div>

                  <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                    <StockStatus
                      lowStock={item.low_stock}
                      quantity={item.quantity}
                    />

                    <span className="rounded-lg bg-slate-100 px-2.5 py-1.5 text-xs font-semibold text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                      {item.unit || "—"}
                    </span>
                  </div>

                  <div className="mt-4 grid grid-cols-2 gap-3 border-t border-slate-100 pt-4 dark:border-slate-800">
                    <div>
                      <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                        Warehouse
                      </p>

                      <p className="mt-1 break-words text-sm font-semibold text-slate-800 dark:text-slate-200">
                        {item.warehouse_name || "Unassigned"}
                      </p>
                    </div>

                    <div className="text-right">
                      <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                        Quantity
                      </p>

                      <p className="mt-1 text-xl font-bold tabular-nums text-slate-900 dark:text-white">
                        {formatQuantity(item.quantity)}
                      </p>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </>
        )}

        {!loading && stock.length > 0 && (
          <div className="flex flex-col justify-between gap-2 border-t border-slate-200 bg-slate-50/70 px-5 py-4 text-xs text-slate-500 dark:border-slate-800 dark:bg-slate-800/30 dark:text-slate-400 sm:flex-row sm:items-center sm:px-6">
            <span>
              Displaying{" "}
              <span className="font-semibold text-slate-700 dark:text-slate-200">
                {filteredStock.length}
              </span>{" "}
              of {stock.length} stock records
            </span>

            <span className="inline-flex items-center gap-1.5">
              <Activity size={14} />
              Inventory stock report
            </span>
          </div>
        )}
      </section>

      <footer className="flex flex-col gap-2 px-1 text-xs text-slate-500 dark:text-slate-400 sm:flex-row sm:items-center sm:justify-between">
        <span className="inline-flex items-center gap-2">
          <Boxes size={14} />
          Stock figures reflect the data returned by your stock API.
        </span>

        <span className="inline-flex items-center gap-2">
          <ShieldCheck size={14} />
          ERP · Inventory Management
        </span>
      </footer>
    </div>
  );
}