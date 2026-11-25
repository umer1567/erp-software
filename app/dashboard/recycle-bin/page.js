
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Trash2,
  RotateCcw,
  Search,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  AlertTriangle,
  Archive,
  Calendar,
  User,
  FileText,
  Filter,
  X,
  Info,
} from "lucide-react";

const PAGE_SIZE = 20;

// Only modules whose restore and permanent-delete APIs are implemented.
const SUPPORTED_MODULES = {
  customers: {
    table: "customers",
    label: "Customer",
  },
  product_categories: {
    table: "product_categories",
    label: "Product Category",
  },
  products: {
    table: "products",
    label: "Product",
  },
  product_units: {
    table: "product_units",
    label: "Product Unit",
  },
  suppliers: {
    table: "suppliers",
    label: "Supplier",
  },
  units_of_measure: {
    table: "units_of_measure",
    label: "Unit of Measure",
  },
  warehouses: {
    table: "warehouses",
    label: "Warehouse",
  },

    sales_quotations: {
    table: "sales_quotations",
    label: "Sales Quotations",
  },

  sales_orders: {
    table: "sales_orders",
    label: "Sales Orders",
  },

  delivery_challans: {
    table: "delivery_challans",
    label: "Delivery Challans",
  },

  sales_returns: {
    table: "sales_returns",
    label: "Sales Returns",
  },
};

const MODULE_LABELS = {
  customers: "Customers",
  product_categories: "Product Categories",
  products: "Products",
  product_units: "Product Units",
  suppliers: "Suppliers",
  units_of_measure: "Units of Measure",
  warehouses: "Warehouses",
  vendors: "Vendors",
  sales: "Sales",
  purchases: "Purchases",
  purchase_orders: "Purchase Orders",
  purchase_invoices: "Purchase Invoices",
};

function formatDate(value) {
  if (!value) return "—";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "—";

  return date.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getModuleLabel(value) {
  const key = String(value || "").toLowerCase().trim();

  return (
    MODULE_LABELS[key] ||
    key.replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase()) ||
    "Unknown"
  );
}

function getSupportedModule(record) {
  if (!record) return null;

  const moduleKey = String(record.module_key || "")
    .toLowerCase()
    .trim();

  const sourceTable = String(record.source_table || "")
    .toLowerCase()
    .trim();

  const config = SUPPORTED_MODULES[moduleKey];

  if (!config || config.table !== sourceTable) {
    return null;
  }

  return {
    key: moduleKey,
    ...config,
  };
}

function hasPermission(value) {
  return (
    value === true ||
    value === 1 ||
    value === "true" ||
    value === "1"
  );
}

async function readResponse(response) {
  const data = await response.json().catch(() => ({}));

  if (!response.ok || data.success === false) {
    throw new Error(
      data.message ||
      data.error ||
      `Request failed (${response.status})`
    );
  }

  return data;
}

export default function RecycleBinPage() {
  const [records, setRecords] = useState([]);

  const [pagination, setPagination] = useState({
    page: 1,
    limit: PAGE_SIZE,
    total: 0,
    totalPages: 1,
  });

  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [moduleFilter, setModuleFilter] = useState("");

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [actionId, setActionId] = useState(null);

  const [permissionLoading, setPermissionLoading] = useState(true);

  const [permissions, setPermissions] = useState({
    canView: false,
    canUpdate: false,
    canDelete: false,
  });

  const [page, setPage] = useState(1);

  const canManage = permissions.canUpdate || permissions.canDelete;

  // --------------------------------------------------
  // LOAD PERMISSIONS
  // --------------------------------------------------

  const loadPermissions = useCallback(async (signal) => {
    try {
      const response = await fetch("/api/permissions/current", {
        method: "GET",
        credentials: "same-origin",
        cache: "no-store",
        signal,
        headers: {
          Accept: "application/json",
        },
      });

      const data = await readResponse(response);

      if (signal?.aborted) return;

      const list = Array.isArray(data.permissions)
        ? data.permissions
        : [];

      const permission = list.find(
        (item) =>
          String(item.permission_key || "").toLowerCase() ===
          "recycle_bin"
      );

      setPermissions({
        canView: hasPermission(permission?.can_view),
        canUpdate: hasPermission(permission?.can_update),
        canDelete: hasPermission(permission?.can_delete),
      });
    } catch (err) {
      if (err.name === "AbortError") return;

      console.error("RECYCLE BIN PERMISSION ERROR:", err);

      setError(err.message || "Unable to load permissions.");

      setPermissions({
        canView: false,
        canUpdate: false,
        canDelete: false,
      });
    } finally {
      if (!signal?.aborted) {
        setPermissionLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();

    const timer = setTimeout(() => {
      void loadPermissions(controller.signal);
    }, 0);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [loadPermissions]);

  // --------------------------------------------------
  // LOAD RECYCLE BIN RECORDS
  // --------------------------------------------------

  const loadRecords = useCallback(
    async (showRefresh = false, signal) => {
      if (showRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      setError("");

      try {
        const params = new URLSearchParams({
          page: String(page),
          limit: String(PAGE_SIZE),
        });

        if (moduleFilter) {
          params.set("module", moduleFilter);
        }

        if (search.trim()) {
          params.set("search", search.trim());
        }

        const response = await fetch(
          `/api/recycle-bin?${params.toString()}`,
          {
            method: "GET",
            credentials: "same-origin",
            cache: "no-store",
            signal,
            headers: {
              Accept: "application/json",
            },
          }
        );

        const data = await readResponse(response);

        if (signal?.aborted) return;

        setRecords(
          Array.isArray(data.records) ? data.records : []
        );

        const result = data.pagination || {};

        setPagination({
          page: Number(result.page || page),
          limit: Number(result.limit || PAGE_SIZE),
          total: Number(result.total || 0),
          totalPages: Math.max(
            1,
            Number(result.totalPages || 1)
          ),
        });
      } catch (err) {
        if (err.name === "AbortError") return;

        console.error("RECYCLE BIN LOAD ERROR:", err);

        setRecords([]);

        setPagination({
          page: 1,
          limit: PAGE_SIZE,
          total: 0,
          totalPages: 1,
        });

        setError(
          err.message || "Unable to load deleted records."
        );
      } finally {
        if (!signal?.aborted) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    },
    [page, moduleFilter, search]
  );

  useEffect(() => {
    if (permissionLoading || !permissions.canView) {
      return;
    }

    const controller = new AbortController();

    const timer = setTimeout(() => {
      void loadRecords(false, controller.signal);
    }, 0);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [
    permissionLoading,
    permissions.canView,
    loadRecords,
  ]);

  // --------------------------------------------------
  // MANUAL REFRESH
  // --------------------------------------------------

  const handleRefresh = useCallback(() => {
    if (!permissions.canView || refreshing || loading) return;

    void loadRecords(true);
  }, [
    permissions.canView,
    refreshing,
    loading,
    loadRecords,
  ]);

  // --------------------------------------------------
  // SEARCH AND FILTERS
  // --------------------------------------------------

  function handleSearchSubmit(event) {
    event.preventDefault();

    setPage(1);
    setSearch(searchInput.trim());
  }

  function clearFilters() {
    setSearchInput("");
    setSearch("");
    setModuleFilter("");
    setPage(1);
  }

  // --------------------------------------------------
  // RESTORE ANY SUPPORTED RECORD
  // --------------------------------------------------

  async function handleRestore(record) {
    const supportedModule = getSupportedModule(record);

    if (!permissions.canUpdate || !supportedModule) {
      return;
    }

    const recordName =
      record.record_label || supportedModule.label;

    const confirmed = window.confirm(
      `Restore "${recordName}"?\n\n` +
      `This ${supportedModule.label.toLowerCase()} will become active again.`
    );

    if (!confirmed) return;

    setActionId(record.recycle_bin_id);
    setError("");
    setSuccess("");

    try {
      const response = await fetch(
        `/api/recycle-bin/${record.recycle_bin_id}/restore`,
        {
          method: "POST",
          credentials: "same-origin",
          cache: "no-store",
          headers: {
            Accept: "application/json",
          },
        }
      );

      await readResponse(response);

      setSuccess(
        `${supportedModule.label} restored successfully.`
      );

      await loadRecords(true);
    } catch (err) {
      console.error("RECYCLE BIN RESTORE ERROR:", err);

      setError(
        err.message || "Unable to restore this record."
      );
    } finally {
      setActionId(null);
    }
  }

  // --------------------------------------------------
  // PERMANENTLY DELETE ANY SUPPORTED RECORD
  // --------------------------------------------------

  async function handlePermanentDelete(record) {
    const supportedModule = getSupportedModule(record);

    if (!permissions.canDelete || !supportedModule) {
      return;
    }

    const recordName =
      record.record_label || supportedModule.label;

    const confirmed = window.confirm(
      `Permanently delete "${recordName}"?\n\n` +
      `WARNING: This ${supportedModule.label.toLowerCase()} ` +
      `will be permanently removed and cannot be restored.`
    );

    if (!confirmed) return;

    setActionId(record.recycle_bin_id);
    setError("");
    setSuccess("");

    try {
      const response = await fetch(
        `/api/recycle-bin/${record.recycle_bin_id}`,
        {
          method: "DELETE",
          credentials: "same-origin",
          cache: "no-store",
          headers: {
            Accept: "application/json",
          },
        }
      );

      await readResponse(response);

      setSuccess(
        `${supportedModule.label} permanently deleted.`
      );

      await loadRecords(true);
    } catch (err) {
      console.error("RECYCLE BIN DELETE ERROR:", err);

      setError(
        err.message || "Unable to permanently delete this record."
      );
    } finally {
      setActionId(null);
    }
  }

  // --------------------------------------------------
  // AVAILABLE MODULE FILTERS
  // --------------------------------------------------

  const availableModules = useMemo(() => {
    const values = new Set(
      records
        .map((record) => record.module_key)
        .filter(Boolean)
    );

    if (moduleFilter) {
      values.add(moduleFilter);
    }

    return Array.from(values).sort();
  }, [records, moduleFilter]);

  // --------------------------------------------------
  // PERMISSION LOADING
  // --------------------------------------------------

  if (permissionLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="flex items-center gap-3 text-sm text-slate-500">
          <RefreshCw size={20} className="animate-spin" />
          Checking Recycle Bin permissions...
        </div>
      </div>
    );
  }

  // --------------------------------------------------
  // ACCESS DENIED
  // --------------------------------------------------

  if (!permissions.canView) {
    return (
      <div className="mx-auto max-w-2xl p-6">
        <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-center">
          <AlertTriangle
            size={36}
            className="mx-auto text-red-500"
          />

          <h1 className="mt-3 text-xl font-bold text-red-800">
            Access Denied
          </h1>

          <p className="mt-2 text-sm text-red-700">
            You do not have permission to view the Recycle Bin.
            Contact your administrator if you need access.
          </p>
        </div>
      </div>
    );
  }

  // --------------------------------------------------
  // MAIN PAGE
  // --------------------------------------------------

  return (
    <div className="mx-auto w-full max-w-7xl space-y-6 p-4 md:p-6">

      {/* HEADER */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-red-100 text-red-600">
              <Trash2 size={23} />
            </div>

            <div>
              <h1 className="text-2xl font-bold text-slate-900">
                Recycle Bin
              </h1>

              <p className="mt-1 text-sm text-slate-500">
                View, restore and permanently delete archived ERP records.
              </p>
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={handleRefresh}
          disabled={loading || refreshing}
          className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <RefreshCw
            size={16}
            className={refreshing ? "animate-spin" : ""}
          />
          Refresh
        </button>
      </div>

      {/* SUMMARY */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">

        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-500">
                Deleted Records
              </p>

              <p className="mt-2 text-3xl font-bold text-slate-900">
                {pagination.total.toLocaleString()}
              </p>
            </div>

            <div className="rounded-lg bg-red-100 p-3 text-red-600">
              <Archive size={22} />
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-500">
                Current Page
              </p>

              <p className="mt-2 text-3xl font-bold text-slate-900">
                {pagination.page}
                <span className="text-lg font-medium text-slate-400">
                  {" "}/ {pagination.totalPages}
                </span>
              </p>
            </div>

            <div className="rounded-lg bg-blue-100 p-3 text-blue-600">
              <FileText size={22} />
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-500">
                Available Actions
              </p>

              <p className="mt-2 text-sm font-semibold text-slate-900">
                {permissions.canUpdate ? "Restore" : "No restore"}
                {" · "}
                {permissions.canDelete
                  ? "Permanent delete"
                  : "No delete"}
              </p>
            </div>

            <div className="rounded-lg bg-emerald-100 p-3 text-emerald-600">
              <RotateCcw size={22} />
            </div>
          </div>
        </div>
      </div>

      {/* NOTICES */}
      {error && (
        <div className="flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          <AlertTriangle
            size={18}
            className="mt-0.5 shrink-0"
          />

          <div className="min-w-0 flex-1">{error}</div>

          <button
            type="button"
            onClick={() => setError("")}
            className="shrink-0 text-red-500 hover:text-red-700"
            aria-label="Dismiss error"
          >
            <X size={17} />
          </button>
        </div>
      )}

      {success && (
        <div className="flex items-start gap-3 rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700">
          <Info
            size={18}
            className="mt-0.5 shrink-0"
          />

          <div className="min-w-0 flex-1">{success}</div>

          <button
            type="button"
            onClick={() => setSuccess("")}
            className="shrink-0 text-emerald-600 hover:text-emerald-800"
            aria-label="Dismiss success message"
          >
            <X size={17} />
          </button>
        </div>
      )}

      {/* FILTERS */}
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-700">
          <Filter size={17} />
          Search and Filters
        </div>

        <form
          onSubmit={handleSearchSubmit}
          className="grid grid-cols-1 gap-3 md:grid-cols-[1fr_220px_auto_auto]"
        >
          <div className="relative">
            <Search
              size={17}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
            />

            <input
              type="search"
              value={searchInput}
              onChange={(event) =>
                setSearchInput(event.target.value)
              }
              placeholder="Search record name, module or ID..."
              className="w-full rounded-lg border border-slate-300 bg-white py-2.5 pl-10 pr-3 text-sm text-slate-800 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            />
          </div>

          <select
            value={moduleFilter}
            onChange={(event) => {
              setModuleFilter(event.target.value);
              setPage(1);
            }}
            className="rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-700 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
          >
            <option value="">All Modules</option>

            {availableModules.map((module) => (
              <option key={module} value={module}>
                {getModuleLabel(module)}
              </option>
            ))}
          </select>

          <button
            type="submit"
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700"
          >
            <Search size={16} />
            Search
          </button>

          <button
            type="button"
            onClick={clearFilters}
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
          >
            <X size={16} />
            Clear
          </button>
        </form>
      </div>

      {/* RECORDS TABLE */}
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">

        <div className="flex flex-col gap-2 border-b border-slate-200 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="font-semibold text-slate-900">
              Deleted Records
            </h2>

            <p className="mt-1 text-xs text-slate-500">
              Showing {records.length} of {pagination.total} records
            </p>
          </div>

          <span className="inline-flex w-fit items-center rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">
            {PAGE_SIZE} records per page
          </span>
        </div>

        {loading ? (
          <div className="flex min-h-64 items-center justify-center gap-3 text-sm text-slate-500">
            <RefreshCw size={20} className="animate-spin" />
            Loading deleted records...
          </div>
        ) : records.length === 0 ? (
          <div className="flex min-h-72 flex-col items-center justify-center px-5 text-center">
            <div className="rounded-full bg-slate-100 p-5 text-slate-400">
              <Trash2 size={32} />
            </div>

            <h3 className="mt-4 text-lg font-semibold text-slate-800">
              Recycle Bin is Empty
            </h3>

            <p className="mt-2 max-w-md text-sm text-slate-500">
              No deleted records were found for the selected search
              and filters.
            </p>

            {(search || moduleFilter) && (
              <button
                type="button"
                onClick={clearFilters}
                className="mt-4 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
              >
                Clear Filters
              </button>
            )}
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[950px] text-left text-sm">
                <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-5 py-4 font-semibold">
                      Record
                    </th>

                    <th className="px-5 py-4 font-semibold">
                      Module
                    </th>

                    <th className="px-5 py-4 font-semibold">
                      Source
                    </th>

                    <th className="px-5 py-4 font-semibold">
                      Deleted By
                    </th>

                    <th className="px-5 py-4 font-semibold">
                      Deleted At
                    </th>

                    <th className="px-5 py-4 font-semibold">
                      Reason
                    </th>

                    <th className="px-5 py-4 text-right font-semibold">
                      Actions
                    </th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-100">
                  {records.map((record) => {
                    const supportedModule =
                      getSupportedModule(record);

                    const busy =
                      String(actionId) ===
                      String(record.recycle_bin_id);

                    return (
                      <tr
                        key={record.recycle_bin_id}
                        className="transition hover:bg-slate-50"
                      >
                        {/* RECORD */}
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-3">
                            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-red-50 text-red-500">
                              <FileText size={17} />
                            </div>

                            <div className="min-w-0">
                              <p className="max-w-[230px] truncate font-semibold text-slate-800">
                                {record.record_label ||
                                  "Unnamed record"}
                              </p>

                              <p className="mt-1 text-xs text-slate-400">
                                ID: {record.source_record_id}
                              </p>
                            </div>
                          </div>
                        </td>

                        {/* MODULE */}
                        <td className="px-5 py-4">
                          <span className="inline-flex rounded-full bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-700">
                            {getModuleLabel(record.module_key)}
                          </span>
                        </td>

                        {/* SOURCE */}
                        <td className="px-5 py-4 text-slate-600">
                          <span className="font-medium">
                            {record.source_table || "—"}
                          </span>
                        </td>

                        {/* DELETED BY */}
                        <td className="px-5 py-4 text-slate-600">
                          <div className="flex items-center gap-2">
                            <User
                              size={14}
                              className="text-slate-400"
                            />
                            {record.deleted_by ?? "Unknown"}
                          </div>
                        </td>

                        {/* DELETED AT */}
                        <td className="whitespace-nowrap px-5 py-4 text-slate-600">
                          <div className="flex items-center gap-2">
                            <Calendar
                              size={14}
                              className="text-slate-400"
                            />
                            {formatDate(record.deleted_at)}
                          </div>
                        </td>

                        {/* REASON */}
                        <td className="max-w-[180px] px-5 py-4">
                          <span
                            className="block truncate text-slate-500"
                            title={record.deletion_reason || ""}
                          >
                            {record.deletion_reason || "—"}
                          </span>
                        </td>

                        {/* ACTIONS */}
                        <td className="px-5 py-4">
                          <div className="flex items-center justify-end gap-2">

                            {supportedModule ? (
                              <>
                                {permissions.canUpdate && (
                                  <button
                                    type="button"
                                    onClick={() =>
                                      void handleRestore(record)
                                    }
                                    disabled={
                                      busy || actionId !== null
                                    }
                                    title="Restore record"
                                    className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700 transition hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-50"
                                  >
                                    {busy ? (
                                      <RefreshCw
                                        size={14}
                                        className="animate-spin"
                                      />
                                    ) : (
                                      <RotateCcw size={14} />
                                    )}

                                    Restore
                                  </button>
                                )}

                                {permissions.canDelete && (
                                  <button
                                    type="button"
                                    onClick={() =>
                                      void handlePermanentDelete(record)
                                    }
                                    disabled={
                                      busy || actionId !== null
                                    }
                                    title="Permanently delete record"
                                    className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-700 transition hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-50"
                                  >
                                    <Trash2 size={14} />
                                    Delete
                                  </button>
                                )}

                                {!canManage && (
                                  <span className="text-xs text-slate-400">
                                    View only
                                  </span>
                                )}
                              </>
                            ) : (
                              <span className="inline-flex items-center gap-1.5 rounded-lg bg-amber-50 px-3 py-2 text-xs font-medium text-amber-700">
                                <AlertTriangle size={14} />
                                Not supported yet
                              </span>
                            )}

                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* PAGINATION */}
            <div className="flex flex-col gap-3 border-t border-slate-200 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-xs text-slate-500">
                Page {pagination.page} of {pagination.totalPages}
                {" · "}
                {pagination.total.toLocaleString()} total records
              </p>

              <div className="flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() =>
                    setPage((current) =>
                      Math.max(1, current - 1)
                    )
                  }
                  disabled={page <= 1 || loading}
                  className="inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <ChevronLeft size={16} />
                  Previous
                </button>

                <span className="min-w-10 text-center text-sm font-semibold text-slate-700">
                  {pagination.page}
                </span>

                <button
                  type="button"
                  onClick={() =>
                    setPage((current) =>
                      Math.min(
                        pagination.totalPages,
                        current + 1
                      )
                    )
                  }
                  disabled={
                    page >= pagination.totalPages || loading
                  }
                  className="inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Next
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      {/* INFORMATION */}
      <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4">
        <AlertTriangle
          size={19}
          className="mt-0.5 shrink-0 text-amber-600"
        />

        <div>
          <h3 className="text-sm font-semibold text-amber-900">
            Important Information
          </h3>

          <p className="mt-1 text-xs leading-5 text-amber-800">
            You can restore or permanently delete Customers,
            Product Categories, Products, Product Units, Suppliers,
            Units of Measure and Warehouses. Permanent deletion
            cannot be undone. Other modules will become available
            when their recovery APIs are implemented.
          </p>
        </div>
      </div>
    </div>
  );
}
