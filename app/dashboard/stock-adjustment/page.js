
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowDownToLine,
  ArrowDownUp,
  ArrowRight,
  ArrowUpFromLine,
  Boxes,
  CheckCircle2,
  ClipboardList,
  FileText,
  Hash,
  Layers3,
  LoaderCircle,
  MapPin,
  Package,
  PackagePlus,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
  Trash2,
  TrendingDown,
  TrendingUp,
  Warehouse,
  X,
  AlertCircle,
  LockKeyhole,
  Eye,
} from "lucide-react";

const PERMISSION_KEY = "stock_adjustment";

const inputClass =
  "w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:border-indigo-400";

const labelClass =
  "mb-2 block text-sm font-semibold text-slate-700 dark:text-slate-200";

const deniedPermission = {
  can_view: false,
  can_create: false,
  can_update: false,
  can_delete: false,
};

function toBoolean(value) {
  return (
    value === true ||
    value === 1 ||
    value === "1" ||
    (typeof value === "string" && value.toLowerCase() === "true")
  );
}

function normalizePermissions(permission) {
  const source = permission || {};

  return {
    can_view: toBoolean(source.can_view ?? source.canView),
    can_create: toBoolean(source.can_create ?? source.canCreate),
    can_update: toBoolean(
      source.can_update ?? source.can_edit ?? source.canUpdate ?? source.canEdit
    ),
    can_delete: toBoolean(source.can_delete ?? source.canDelete),
  };
}

function formatNumber(value) {
  return new Intl.NumberFormat("en-PK", {
    maximumFractionDigits: 3,
  }).format(Number(value) || 0);
}

function readError(data, fallback) {
  return data?.message || data?.error || fallback;
}

async function readResponse(response, fallback) {
  const data = await response.json().catch(() => ({}));

  if (!response.ok || data.success === false) {
    throw new Error(readError(data, fallback));
  }

  return data;
}

function SummaryCard({ title, value, description, icon: Icon, accent }) {
  const accents = {
    indigo:
      "bg-indigo-50 text-indigo-600 ring-indigo-100 dark:bg-indigo-500/10 dark:text-indigo-300 dark:ring-indigo-500/20",
    emerald:
      "bg-emerald-50 text-emerald-600 ring-emerald-100 dark:bg-emerald-500/10 dark:text-emerald-300 dark:ring-emerald-500/20",
    amber:
      "bg-amber-50 text-amber-600 ring-amber-100 dark:bg-amber-500/10 dark:text-amber-300 dark:ring-amber-500/20",
    violet:
      "bg-violet-50 text-violet-600 ring-violet-100 dark:bg-violet-500/10 dark:text-violet-300 dark:ring-violet-500/20",
  };

  return (
    <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md dark:border-slate-800 dark:bg-slate-900">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
            {title}
          </p>
          <p className="mt-2 text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
            {value}
          </p>
          <p className="mt-1 break-words text-xs text-slate-500 dark:text-slate-400">
            {description}
          </p>
        </div>

        <div
          className={`rounded-xl p-3 ring-1 ${
            accents[accent] || accents.indigo
          }`}
        >
          <Icon size={21} />
        </div>
      </div>
    </div>
  );
}

function AccessDenied({ error }) {
  return (
    <main className="flex min-h-[70vh] items-center justify-center bg-slate-50 px-4 py-10 dark:bg-slate-950">
      <section className="w-full max-w-lg rounded-3xl border border-rose-200 bg-white p-8 text-center shadow-xl dark:border-rose-900/60 dark:bg-slate-900 sm:p-10">
        <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-3xl bg-rose-50 text-rose-600 dark:bg-rose-500/10 dark:text-rose-300">
          <LockKeyhole size={36} />
        </div>

        <div className="mt-6 inline-flex items-center gap-2 rounded-full border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-bold uppercase tracking-wider text-rose-700 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-300">
          <ShieldCheck size={14} />
          Access restricted
        </div>

        <h1 className="mt-4 text-2xl font-bold text-slate-900 dark:text-white sm:text-3xl">
          Access Denied
        </h1>

        <p className="mx-auto mt-3 max-w-sm text-sm leading-6 text-slate-600 dark:text-slate-300">
          You do not have permission to view Stock Adjustment. Contact your
          administrator to request access.
        </p>

        <div className="mt-6 rounded-xl border border-slate-200 bg-slate-50 p-4 text-left dark:border-slate-700 dark:bg-slate-800/70">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-white p-2 text-slate-500 dark:bg-slate-900 dark:text-slate-300">
              <Eye size={19} />
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-800 dark:text-white">
                Required permission
              </p>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                Stock Adjustment · View
              </p>
            </div>
          </div>
        </div>

        {error ? (
          <p className="mt-4 break-words text-xs text-rose-600 dark:text-rose-300">
            Permission check failed: {error}
          </p>
        ) : null}
      </section>
    </main>
  );
}

function PermissionLoading() {
  return (
    <main className="flex min-h-[60vh] items-center justify-center bg-slate-50 px-4 dark:bg-slate-950">
      <div className="flex flex-col items-center text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-indigo-50 dark:bg-indigo-500/10">
          <LoaderCircle
            size={30}
            className="animate-spin text-indigo-600 dark:text-indigo-300"
          />
        </div>
        <h2 className="mt-4 font-bold text-slate-900 dark:text-white">
          Checking permissions
        </h2>
        <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
          Verifying your Stock Adjustment access...
        </p>
      </div>
    </main>
  );
}

export default function StockAdjustmentPage() {
  const [permission, setPermission] = useState(deniedPermission);
  const [permissionLoading, setPermissionLoading] = useState(true);
  const [permissionError, setPermissionError] = useState("");

  const [products, setProducts] = useState([]);
  const [warehouses, setWarehouses] = useState([]);

  const [warehouseId, setWarehouseId] = useState("");
  const [adjustmentType, setAdjustmentType] = useState("INCREASE");
  const [referenceNumber, setReferenceNumber] = useState("");
  const [reason, setReason] = useState("");

  const [productId, setProductId] = useState("");
  const [quantity, setQuantity] = useState("");
  const [productSearch, setProductSearch] = useState("");
  const [items, setItems] = useState([]);

  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState("error");
  const [loadingData, setLoadingData] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const canView = permission.can_view;
  const canCreate = permission.can_create;
  const canEdit = permission.can_update;
  const canDelete = permission.can_delete;

  const showMessage = useCallback((text, type = "error") => {
    setMessage(text);
    setMessageType(type);
  }, []);

  // Load the signed-in user's permissions.
  useEffect(() => {
    let cancelled = false;

    async function loadPermission() {
      setPermissionLoading(true);
      setPermissionError("");
      setPermission(deniedPermission);

      try {
        const response = await fetch(
          `/api/permissions/current?permissionKey=${encodeURIComponent(
            PERMISSION_KEY
          )}`,
          { cache: "no-store" }
        );

        const data = await readResponse(
          response,
          "Unable to verify your Stock Adjustment permissions."
        );

        if (cancelled) return;

        // Accept common API response shapes.
        const receivedPermission =
          data.permission ?? data.permissions ?? data;

        setPermission(normalizePermissions(receivedPermission));
      } catch (error) {
        if (!cancelled) {
          setPermission(deniedPermission);
          setPermissionError(
            error.message || "Unable to verify your permissions."
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

  // Load product and warehouse data only when View is allowed.
  const fetchData = useCallback(
    async (showRefresh = false) => {
      if (!canView) return;

      if (showRefresh) {
        setRefreshing(true);
      } else {
        setLoadingData(true);
      }

      setMessage("");

      try {
        const [productsResponse, warehousesResponse] = await Promise.all([
          fetch("/api/products", { cache: "no-store" }),
          fetch("/api/warehouses", { cache: "no-store" }),
        ]);

        const [productsData, warehousesData] = await Promise.all([
          productsResponse.json().catch(() => ({})),
          warehousesResponse.json().catch(() => ({})),
        ]);

        if (!productsResponse.ok) {
          throw new Error(
            readError(productsData, "Unable to load products.")
          );
        }

        if (!warehousesResponse.ok) {
          throw new Error(
            readError(warehousesData, "Unable to load warehouses.")
          );
        }

        setProducts(
          Array.isArray(productsData.products) ? productsData.products : []
        );

        setWarehouses(
          Array.isArray(warehousesData.warehouses)
            ? warehousesData.warehouses
            : []
        );
      } catch (error) {
        console.error("Stock adjustment data error:", error);
        showMessage(error.message || "Unable to load page data.");
      } finally {
        setLoadingData(false);
        setRefreshing(false);
      }
    },
    [canView, showMessage]
  );

  useEffect(() => {
  if (permissionLoading || !canView) {
    return;
  }

  let cancelled = false;

  async function loadData() {
    if (!cancelled) {
      await fetchData();
    }
  }

  loadData();

  return () => {
    cancelled = true;
  };
}, [permissionLoading, canView, fetchData]);

  const selectedWarehouse = useMemo(
    () =>
      warehouses.find(
        (warehouse) =>
          String(warehouse.warehouse_id) === String(warehouseId)
      ),
    [warehouses, warehouseId]
  );

  const selectedProduct = useMemo(
    () =>
      products.find(
        (product) => String(product.product_id) === String(productId)
      ),
    [products, productId]
  );

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

  const totalQuantity = useMemo(
    () =>
      items.reduce((total, item) => total + Number(item.quantity || 0), 0),
    [items]
  );

  function addItem() {
    if (!canCreate) {
      showMessage("You do not have permission to create stock adjustments.");
      return;
    }

    setMessage("");

    if (!productId) {
      showMessage("Please select a product first.");
      return;
    }

    const parsedQuantity = Number(quantity);

    if (!quantity || !Number.isFinite(parsedQuantity) || parsedQuantity <= 0) {
      showMessage("Enter a quantity greater than zero.");
      return;
    }

    const product = products.find(
      (item) => String(item.product_id) === String(productId)
    );

    if (!product) {
      showMessage("The selected product could not be found.");
      return;
    }

    setItems((currentItems) => {
      const existingIndex = currentItems.findIndex(
        (item) => String(item.productId) === String(product.product_id)
      );

      if (existingIndex !== -1) {
        return currentItems.map((item, index) =>
          index === existingIndex
            ? {
                ...item,
                quantity: Number(item.quantity) + parsedQuantity,
              }
            : item
        );
      }

      return [
        ...currentItems,
        {
          productId: product.product_id,
          productName: product.product_name || "Unnamed product",
          sku: product.sku || "—",
          quantity: parsedQuantity,
        },
      ];
    });

    setProductId("");
    setQuantity("");
    setProductSearch("");
    showMessage("Product added to the adjustment list.", "success");
  }

  // Delete permission controls removing products from the adjustment list.
  function removeItem(productToRemove) {
    if (!canDelete) {
      showMessage("You do not have permission to remove adjustment items.");
      return;
    }

    setItems((currentItems) =>
      currentItems.filter(
        (item) => String(item.productId) !== String(productToRemove)
      )
    );

    showMessage("Product removed from the adjustment list.", "success");
  }

  function resetForm() {
    setWarehouseId("");
    setAdjustmentType("INCREASE");
    setReferenceNumber("");
    setReason("");
    setProductId("");
    setQuantity("");
    setProductSearch("");
    setItems([]);
    setMessage("");
    setMessageType("error");
  }

  async function submitAdjustment(event) {
    event.preventDefault();
    setMessage("");

    if (!canCreate) {
      showMessage("You do not have permission to create stock adjustments.");
      return;
    }

    if (!warehouseId) {
      showMessage("Please select a warehouse.");
      return;
    }

    if (items.length === 0) {
      showMessage("Please add at least one product.");
      return;
    }

    if (
      items.some(
        (item) =>
          !Number.isFinite(Number(item.quantity)) ||
          Number(item.quantity) <= 0
      )
    ) {
      showMessage(
        "Every product must have a valid quantity greater than zero."
      );
      return;
    }

    setSubmitting(true);

    try {
      const response = await fetch("/api/stock-adjustments", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        cache: "no-store",
        body: JSON.stringify({
          warehouseId,
          adjustmentType,
          referenceNumber: referenceNumber.trim(),
          reason: reason.trim(),
          items,
        }),
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok || data.success === false) {
        showMessage(
          readError(data, "Stock adjustment failed. Please try again.")
        );
        return;
      }

      showMessage(
        data.message || "Stock adjustment completed successfully.",
        "success"
      );

      setWarehouseId("");
      setAdjustmentType("INCREASE");
      setReferenceNumber("");
      setReason("");
      setProductId("");
      setQuantity("");
      setProductSearch("");
      setItems([]);
    } catch (error) {
      console.error("Stock adjustment submission error:", error);
      showMessage("Server connection failed. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  if (permissionLoading) {
    return <PermissionLoading />;
  }

  // Only View permission determines whether the page is accessible.
  if (!canView) {
    return <AccessDenied error={permissionError} />;
  }

  return (
    <div className="min-h-screen space-y-6 bg-slate-50/70 pb-10 dark:bg-slate-950">
      {/* Page header */}
      <section className="relative isolate overflow-hidden rounded-3xl bg-gradient-to-br from-indigo-700 via-indigo-600 to-violet-700 px-6 py-7 text-white shadow-lg shadow-indigo-900/10 sm:px-8 sm:py-9">
        <div className="pointer-events-none absolute -right-10 -top-24 -z-10 h-72 w-72 rounded-full bg-white/10 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-32 right-1/3 -z-10 h-64 w-64 rounded-full bg-violet-300/20 blur-3xl" />

        <div className="flex flex-col justify-between gap-6 lg:flex-row lg:items-center">
          <div className="max-w-2xl">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-xs font-semibold text-indigo-50 backdrop-blur">
              <ShieldCheck size={15} />
              INVENTORY MANAGEMENT
            </div>

            <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
              Stock Adjustment
            </h1>

            <p className="mt-3 max-w-xl text-sm leading-6 text-indigo-100 sm:text-base">
              Record stock increases or decreases with a clear reference,
              reason, and warehouse.
            </p>

            <div className="mt-5 flex flex-wrap items-center gap-3 text-sm text-indigo-100">
              <span className="inline-flex items-center gap-2">
                <Warehouse size={16} />
                Warehouse stock control
              </span>
              <span className="hidden h-1 w-1 rounded-full bg-indigo-200 sm:block" />
              <span className="inline-flex items-center gap-2">
                <ClipboardList size={16} />
                Adjustment record
              </span>
            </div>
          </div>

          <div className="flex shrink-0 flex-wrap gap-3">
            <button
              type="button"
              onClick={() => fetchData(true)}
              disabled={refreshing || loadingData}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/25 bg-white/10 px-4 py-3 text-sm font-semibold text-white transition hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <RefreshCw
                size={17}
                className={refreshing ? "animate-spin" : ""}
              />
              Refresh data
            </button>

            <button
              type="button"
              onClick={resetForm}
              disabled={submitting}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-white px-4 py-3 text-sm font-semibold text-indigo-700 shadow-sm transition hover:bg-indigo-50 disabled:opacity-60"
            >
              <X size={17} />
              Clear form
            </button>
          </div>
        </div>
      </section>

      {/* Summary cards */}
      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryCard
          title="Products in list"
          value={items.length}
          description="Unique products to adjust"
          icon={Package}
          accent="indigo"
        />
        <SummaryCard
          title="Total quantity"
          value={formatNumber(totalQuantity)}
          description="Combined entered quantities"
          icon={Boxes}
          accent="emerald"
        />
        <SummaryCard
          title="Adjustment direction"
          value={adjustmentType === "INCREASE" ? "Increase" : "Decrease"}
          description="Selected stock movement"
          icon={adjustmentType === "INCREASE" ? TrendingUp : TrendingDown}
          accent={adjustmentType === "INCREASE" ? "emerald" : "amber"}
        />
        <SummaryCard
          title="Warehouse"
          value={selectedWarehouse ? "Selected" : "Not selected"}
          description={
            selectedWarehouse
              ? selectedWarehouse.warehouse_name
              : "Choose a warehouse below"
          }
          icon={Warehouse}
          accent="violet"
        />
      </section>

      {/* Status message */}
      {message && (
        <div
          role={messageType === "error" ? "alert" : "status"}
          className={`flex items-start gap-3 rounded-2xl border px-4 py-4 ${
            messageType === "success"
              ? "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-300"
              : "border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-300"
          }`}
        >
          {messageType === "success" ? (
            <CheckCircle2 className="mt-0.5 shrink-0" size={19} />
          ) : (
            <AlertCircle className="mt-0.5 shrink-0" size={19} />
          )}

          <p className="flex-1 text-sm font-medium">{message}</p>

          <button
            type="button"
            onClick={() => setMessage("")}
            aria-label="Dismiss message"
            className="rounded-lg p-1 opacity-70 transition hover:bg-black/5 hover:opacity-100 dark:hover:bg-white/10"
          >
            <X size={17} />
          </button>
        </div>
      )}

      {!canCreate && (
        <div className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-200">
          <LockKeyhole size={19} className="mt-0.5 shrink-0" />
          <div>
            <p className="text-sm font-bold">Read-only access</p>
            <p className="mt-1 text-sm leading-6">
              You can view this page, but you cannot create or save stock
              adjustments because Create permission is disabled.
            </p>
          </div>
        </div>
      )}

      <form onSubmit={submitAdjustment} className="space-y-6">
        {/* Adjustment details */}
        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center gap-3 border-b border-slate-100 px-5 py-5 dark:border-slate-800 sm:px-7">
            <div className="rounded-xl bg-indigo-50 p-2.5 text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-300">
              <FileText size={21} />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                Adjustment details
              </h2>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                Choose the warehouse and provide adjustment information.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-5 p-5 sm:grid-cols-2 sm:p-7">
            <div>
              <label className={labelClass}>
                Warehouse <span className="text-rose-500">*</span>
              </label>

              <div className="relative">
                <Warehouse
                  size={18}
                  className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
                />
                <select
                  value={warehouseId}
                  onChange={(event) => setWarehouseId(event.target.value)}
                  className={`${inputClass} pl-11`}
                  required={canCreate}
                  disabled={loadingData || !canCreate}
                >
                  <option value="">
                    {loadingData ? "Loading warehouses..." : "Select warehouse"}
                  </option>

                  {warehouses.map((warehouse) => (
                    <option
                      key={warehouse.warehouse_id}
                      value={warehouse.warehouse_id}
                    >
                      {warehouse.warehouse_name}
                      {warehouse.warehouse_code
                        ? ` (${warehouse.warehouse_code})`
                        : ""}
                    </option>
                  ))}
                </select>
              </div>

              {selectedWarehouse?.location && (
                <p className="mt-2 flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
                  <MapPin size={13} />
                  {selectedWarehouse.location}
                </p>
              )}
            </div>

            <div>
              <label className={labelClass}>
                Adjustment type <span className="text-rose-500">*</span>
              </label>

              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setAdjustmentType("INCREASE")}
                  disabled={!canCreate}
                  aria-pressed={adjustmentType === "INCREASE"}
                  className={`flex items-center justify-center gap-2 rounded-xl border px-3 py-3.5 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-60 ${
                    adjustmentType === "INCREASE"
                      ? "border-emerald-500 bg-emerald-50 text-emerald-700 ring-2 ring-emerald-500/15 dark:border-emerald-500 dark:bg-emerald-500/10 dark:text-emerald-300"
                      : "border-slate-200 bg-white text-slate-600 hover:border-emerald-300 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
                  }`}
                >
                  <ArrowUpFromLine size={18} />
                  Increase stock
                </button>

                <button
                  type="button"
                  onClick={() => setAdjustmentType("DECREASE")}
                  disabled={!canCreate}
                  aria-pressed={adjustmentType === "DECREASE"}
                  className={`flex items-center justify-center gap-2 rounded-xl border px-3 py-3.5 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-60 ${
                    adjustmentType === "DECREASE"
                      ? "border-amber-500 bg-amber-50 text-amber-700 ring-2 ring-amber-500/15 dark:border-amber-500 dark:bg-amber-500/10 dark:text-amber-300"
                      : "border-slate-200 bg-white text-slate-600 hover:border-amber-300 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
                  }`}
                >
                  <ArrowDownToLine size={18} />
                  Decrease stock
                </button>
              </div>

              <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                {adjustmentType === "INCREASE"
                  ? "Adds the entered quantity to the selected warehouse."
                  : "Removes the entered quantity from the selected warehouse."}
              </p>
            </div>

            <div>
              <label className={labelClass}>Reference number</label>
              <div className="relative">
                <Hash
                  size={18}
                  className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
                />
                <input
                  type="text"
                  value={referenceNumber}
                  onChange={(event) => setReferenceNumber(event.target.value)}
                  placeholder="e.g. ADJ-001"
                  maxLength={100}
                  disabled={!canCreate}
                  className={`${inputClass} pl-11`}
                />
              </div>
              <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                Optional internal reference for tracking.
              </p>
            </div>

            <div>
              <label className={labelClass}>Reason for adjustment</label>
              <input
                type="text"
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                placeholder="e.g. Damaged, missing, opening stock"
                maxLength={500}
                disabled={!canCreate}
                className={inputClass}
              />
              <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                Describe why the stock quantity is changing.
              </p>
            </div>
          </div>
        </section>

        {/* Product selection */}
        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="flex flex-col justify-between gap-3 border-b border-slate-100 px-5 py-5 dark:border-slate-800 sm:flex-row sm:items-center sm:px-7">
            <div className="flex items-center gap-3">
              <div className="rounded-xl bg-violet-50 p-2.5 text-violet-600 dark:bg-violet-500/10 dark:text-violet-300">
                <PackagePlus size={21} />
              </div>
              <div>
                <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                  Adjustment items
                </h2>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                  Select products and quantities for this adjustment.
                </p>
              </div>
            </div>

            <span className="inline-flex w-fit items-center gap-2 rounded-full bg-indigo-50 px-3 py-1.5 text-xs font-semibold text-indigo-700 dark:bg-indigo-500/10 dark:text-indigo-300">
              <Layers3 size={14} />
              {items.length} {items.length === 1 ? "product" : "products"} added
            </span>
          </div>

          <div className="space-y-5 p-5 sm:p-7">
            <div className="grid grid-cols-1 items-end gap-4 lg:grid-cols-[minmax(0,1.5fr)_minmax(160px,0.65fr)_auto]">
              <div>
                <label className={labelClass}>Product</label>

                <div className="relative mb-2">
                  <Search
                    size={17}
                    className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
                  />
                  <input
                    type="text"
                    value={productSearch}
                    onChange={(event) => setProductSearch(event.target.value)}
                    placeholder="Search by name, SKU or barcode..."
                    disabled={loadingData || !canCreate}
                    className={`${inputClass} pl-10`}
                  />
                </div>

                <select
                  value={productId}
                  onChange={(event) => setProductId(event.target.value)}
                  className={inputClass}
                  disabled={loadingData || !canCreate}
                >
                  <option value="">
                    {loadingData ? "Loading products..." : "Choose a product"}
                  </option>

                  {filteredProducts.map((product) => (
                    <option
                      key={product.product_id}
                      value={product.product_id}
                    >
                      {product.sku ? `${product.sku} — ` : ""}
                      {product.product_name || "Unnamed product"}
                      {product.barcode ? ` (${product.barcode})` : ""}
                    </option>
                  ))}
                </select>

                {!loadingData && filteredProducts.length === 0 && (
                  <p className="mt-2 text-xs text-amber-600 dark:text-amber-400">
                    No matching products found.
                  </p>
                )}
              </div>

              <div>
                <label className={labelClass}>Quantity</label>
                <input
                  type="number"
                  min="0.001"
                  step="0.001"
                  inputMode="decimal"
                  value={quantity}
                  onChange={(event) => setQuantity(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      if (canCreate) addItem();
                    }
                  }}
                  placeholder="Enter quantity"
                  disabled={!canCreate}
                  className={inputClass}
                />
              </div>

              {/* Hidden completely when Create is unchecked */}
              {canCreate && (
                <button
                  type="button"
                  onClick={addItem}
                  disabled={loadingData}
                  className="inline-flex min-h-[46px] items-center justify-center gap-2 rounded-xl bg-indigo-600 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Plus size={18} />
                  Add product
                </button>
              )}
            </div>

            {selectedProduct && (
              <div className="flex flex-col gap-3 rounded-xl border border-indigo-100 bg-indigo-50/70 p-4 dark:border-indigo-500/20 dark:bg-indigo-500/5 sm:flex-row sm:items-center">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white text-indigo-600 shadow-sm dark:bg-slate-800 dark:text-indigo-300">
                  <Package size={21} />
                </div>

                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold text-slate-900 dark:text-white">
                    {selectedProduct.product_name}
                  </p>
                  <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                    SKU: {selectedProduct.sku || "—"}
                    {selectedProduct.barcode
                      ? ` · Barcode: ${selectedProduct.barcode}`
                      : ""}
                  </p>
                </div>

                <span className="w-fit rounded-lg border border-indigo-100 bg-white px-3 py-1.5 text-xs font-semibold text-indigo-700 dark:border-slate-700 dark:bg-slate-800 dark:text-indigo-300">
                  Selected product
                </span>
              </div>
            )}

            <div className="overflow-hidden rounded-xl border border-slate-200 dark:border-slate-800">
              <div className="flex flex-col justify-between gap-2 border-b border-slate-200 bg-slate-50 px-4 py-4 dark:border-slate-800 dark:bg-slate-800/50 sm:flex-row sm:items-center sm:px-5">
                <div>
                  <h3 className="font-bold text-slate-900 dark:text-white">
                    Products to adjust
                  </h3>
                  <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                    Review the products before saving.
                  </p>
                </div>

                <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
                  <Boxes size={16} className="text-indigo-500" />
                  Total quantity:
                  <span className="font-bold text-slate-900 dark:text-white">
                    {formatNumber(totalQuantity)}
                  </span>
                </div>
              </div>

              {items.length === 0 ? (
                <div className="flex flex-col items-center px-5 py-12 text-center">
                  <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-500">
                    <Package size={29} />
                  </div>

                  <h3 className="font-semibold text-slate-800 dark:text-slate-100">
                    No products added yet
                  </h3>
                  <p className="mt-2 max-w-sm text-sm leading-6 text-slate-500 dark:text-slate-400">
                    {canCreate
                      ? 'Choose a product, enter a quantity, and click "Add product".'
                      : "You do not have permission to add products to a new adjustment."}
                  </p>
                </div>
              ) : (
                <>
                  <div className="hidden overflow-x-auto md:block">
                    <table className="w-full min-w-[580px] text-left">
                      <thead className="bg-white dark:bg-slate-900">
                        <tr className="border-b border-slate-100 dark:border-slate-800">
                          <th className="px-5 py-3.5 text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                            #
                          </th>
                          <th className="px-5 py-3.5 text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                            Product
                          </th>
                          <th className="px-5 py-3.5 text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                            SKU
                          </th>
                          <th className="px-5 py-3.5 text-right text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                            Quantity
                          </th>
                          {canDelete && (
                            <th className="px-5 py-3.5 text-right text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                              Action
                            </th>
                          )}
                        </tr>
                      </thead>

                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                        {items.map((item, index) => (
                          <tr
                            key={item.productId}
                            className="transition hover:bg-slate-50/80 dark:hover:bg-slate-800/40"
                          >
                            <td className="px-5 py-4 text-sm text-slate-400">
                              {String(index + 1).padStart(2, "0")}
                            </td>

                            <td className="px-5 py-4">
                              <div className="flex items-center gap-3">
                                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                                  <Package size={18} />
                                </div>
                                <span className="max-w-[300px] truncate text-sm font-semibold text-slate-800 dark:text-slate-100">
                                  {item.productName}
                                </span>
                              </div>
                            </td>

                            <td className="px-5 py-4">
                              <span className="rounded-md bg-slate-100 px-2.5 py-1.5 font-mono text-xs text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                                {item.sku}
                              </span>
                            </td>

                            <td className="px-5 py-4 text-right">
                              <span className="inline-flex min-w-20 items-center justify-center rounded-lg bg-indigo-50 px-3 py-2 text-sm font-bold text-indigo-700 dark:bg-indigo-500/10 dark:text-indigo-300">
                                {formatNumber(item.quantity)}
                              </span>
                            </td>

                            {/* Delete permission hides both header and button */}
                            {canDelete && (
                              <td className="px-5 py-4 text-right">
                                <button
                                  type="button"
                                  onClick={() => removeItem(item.productId)}
                                  title="Remove product"
                                  aria-label={`Remove ${item.productName}`}
                                  className="inline-flex items-center justify-center rounded-lg border border-rose-100 p-2.5 text-rose-600 transition hover:border-rose-200 hover:bg-rose-50 dark:border-rose-900/40 dark:text-rose-400 dark:hover:bg-rose-950/40"
                                >
                                  <Trash2 size={16} />
                                </button>
                              </td>
                            )}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Mobile cards use the same Delete permission */}
                  <div className="space-y-3 p-3 md:hidden">
                    {items.map((item, index) => (
                      <div
                        key={item.productId}
                        className="rounded-xl border border-slate-200 p-4 dark:border-slate-800"
                      >
                        <div className="flex items-start gap-3">
                          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-300">
                            <Package size={19} />
                          </div>

                          <div className="min-w-0 flex-1">
                            <p className="break-words text-sm font-bold text-slate-900 dark:text-white">
                              {item.productName}
                            </p>
                            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                              SKU: {item.sku}
                            </p>
                          </div>

                          {canDelete && (
                            <button
                              type="button"
                              onClick={() => removeItem(item.productId)}
                              aria-label={`Remove ${item.productName}`}
                              className="rounded-lg p-2 text-rose-500 transition hover:bg-rose-50 dark:hover:bg-rose-950/40"
                            >
                              <Trash2 size={17} />
                            </button>
                          )}
                        </div>

                        <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3 dark:border-slate-800">
                          <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                            Item {index + 1} · Quantity
                          </span>
                          <span className="rounded-lg bg-indigo-50 px-3 py-1.5 text-sm font-bold text-indigo-700 dark:bg-indigo-500/10 dark:text-indigo-300">
                            {formatNumber(item.quantity)}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="flex flex-col gap-2 border-t border-slate-200 bg-slate-50 px-4 py-4 dark:border-slate-800 dark:bg-slate-800/30 sm:flex-row sm:items-center sm:justify-between sm:px-5">
                    <p className="text-sm text-slate-500 dark:text-slate-400">
                      {items.length} unique{" "}
                      {items.length === 1 ? "product" : "products"} included
                    </p>
                    <div className="flex items-center justify-between gap-4 sm:justify-end">
                      <span className="text-sm text-slate-600 dark:text-slate-300">
                        Total quantity
                      </span>
                      <span className="text-lg font-bold text-slate-900 dark:text-white">
                        {formatNumber(totalQuantity)}
                      </span>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </section>

        {/* Final review and actions */}
        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="flex flex-col gap-5 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-7">
            <div className="flex items-start gap-3">
              <div
                className={`rounded-xl p-3 ${
                  adjustmentType === "INCREASE"
                    ? "bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-300"
                    : "bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:text-amber-300"
                }`}
              >
                <ArrowDownUp size={22} />
              </div>

              <div>
                <h2 className="font-bold text-slate-900 dark:text-white">
                  {canCreate ? "Ready to save adjustment?" : "Adjustment review"}
                </h2>
                <p className="mt-1 max-w-lg text-sm leading-6 text-slate-500 dark:text-slate-400">
                  {adjustmentType === "INCREASE"
                    ? "This adjustment will increase stock for the selected warehouse."
                    : "This adjustment will decrease stock for the selected warehouse."}{" "}
                  Review the warehouse, reason, and quantities before saving.
                </p>

                <div className="mt-3 flex flex-wrap gap-2">
                  <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                    {selectedWarehouse?.warehouse_name || "No warehouse selected"}
                  </span>
                  <span
                    className={`rounded-full px-3 py-1 text-xs font-semibold ${
                      adjustmentType === "INCREASE"
                        ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300"
                        : "bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300"
                    }`}
                  >
                    {adjustmentType === "INCREASE"
                      ? "Stock increase"
                      : "Stock decrease"}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex shrink-0 flex-col gap-3 sm:min-w-52">
              {/* Save button does not exist in the UI without Create permission */}
              {canCreate && (
                <button
                  type="submit"
                  disabled={submitting || loadingData || items.length === 0}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-5 py-3.5 text-sm font-bold text-white shadow-md transition hover:bg-indigo-700 focus:outline-none focus:ring-4 focus:ring-indigo-500/20 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {submitting ? (
                    <>
                      <LoaderCircle size={18} className="animate-spin" />
                      Saving adjustment...
                    </>
                  ) : (
                    <>
                      <CheckCircle2 size={18} />
                      Save adjustment
                      <ArrowRight size={17} />
                    </>
                  )}
                </button>
              )}

              <button
                type="button"
                onClick={resetForm}
                disabled={submitting}
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
              >
                <RefreshCw size={16} />
                Reset adjustment
              </button>

              {!canCreate && (
                <p className="text-xs leading-5 text-slate-500 dark:text-slate-400">
                  Create permission is required to save an adjustment.
                </p>
              )}
            </div>
          </div>

          <div className="flex items-start gap-2 border-t border-slate-100 bg-slate-50/80 px-5 py-4 text-xs leading-5 text-slate-500 dark:border-slate-800 dark:bg-slate-800/30 dark:text-slate-400 sm:px-7">
            <ShieldCheck size={15} className="mt-0.5 shrink-0 text-indigo-500" />
            <p>
              Review all details before submitting. Stock movements should be
              supported by a valid business reason and reference when
              applicable.
            </p>
          </div>
        </section>
      </form>

      {/* Edit permission is displayed here; this page has no edit action. */}
      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-xs text-slate-500 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400">
        <ShieldCheck size={15} className="text-indigo-500" />
        <span>
          Rights: View {canView ? "✓" : "—"} · Create {canCreate ? "✓" : "—"} ·
          Edit {canEdit ? "✓" : "—"} · Delete {canDelete ? "✓" : "—"}
        </span>
      </div>
    </div>
  );
}
