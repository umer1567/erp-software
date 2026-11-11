
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Warehouse,
  Plus,
  Search,
  RefreshCw,
  MapPin,
  Package,
  Pencil,
  Trash2,
  X,
  Save,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Building2,
  Activity,
  Boxes,
  Filter,
  ArrowUpRight,
  ClipboardList,
  LoaderCircle,
  FileText,
  ShieldAlert,
  LockKeyhole,
} from "lucide-react";

const emptyForm = {
  warehouseName: "",
  warehouseCode: "",
  location: "",
  description: "",
  isActive: true,
};

const inputClass =
  "w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 placeholder:text-slate-400 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:border-blue-400";

const labelClass =
  "mb-2 block text-sm font-semibold text-slate-700 dark:text-slate-200";

const deniedPermissions = {
  view: false,
  create: false,
  edit: false,
  delete: false,
};

function getErrorMessage(data, fallback) {
  return data?.message || data?.error || fallback;
}

function normalizePermissions(rows) {
  const list = Array.isArray(rows) ? rows : [];

  const permission = list.find((item) => {
    const key = String(item.permission_key || "")
      .trim()
      .toLowerCase();

    return key === "warehouses" || key === "warehouse";
  });

  if (!permission) {
    return { ...deniedPermissions };
  }

  return {
    view: permission.can_view === true,
    create: permission.can_create === true,
    edit:
      permission.can_edit === true ||
      permission.can_update === true,
    delete: permission.can_delete === true,
  };
}

function formatDate(value) {
  if (!value) return "—";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "—";

  return date.toLocaleDateString("en-PK", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function SummaryCard({ title, value, description, icon: Icon, tone }) {
  const tones = {
    blue: {
      icon: "bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300",
      glow: "from-blue-500/10",
    },
    emerald: {
      icon: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300",
      glow: "from-emerald-500/10",
    },
    amber: {
      icon: "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300",
      glow: "from-amber-500/10",
    },
    violet: {
      icon: "bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300",
      glow: "from-violet-500/10",
    },
  };

  const selectedTone = tones[tone] || tones.blue;

  return (
    <div className="relative p-5 transition duration-200 hover:-translate-y-0.5">
      <div
        className={`pointer-events-none absolute inset-0 bg-gradient-to-br ${selectedTone.glow} to-transparent`}
      />

      <div className="relative flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
            {title}
          </p>

          <p className="mt-3 text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
            {value}
          </p>

          <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
            {description}
          </p>
        </div>

        <div
          className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl ${selectedTone.icon}`}
        >
          <Icon size={23} />
        </div>
      </div>
    </div>
  );
}

function StatusBadge({ active }) {
  return active ? (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300">
      <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
      Active
    </span>
  ) : (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
      <span className="h-1.5 w-1.5 rounded-full bg-slate-400" />
      Inactive
    </span>
  );
}

function AccessDenied({ title, description }) {
  return (
    <div className="flex min-h-[60vh] items-center justify-center bg-slate-50 p-5 dark:bg-slate-950">
      <div className="w-full max-w-lg rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-xl dark:border-slate-800 dark:bg-slate-900">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-rose-100 text-rose-600 dark:bg-rose-500/10 dark:text-rose-300">
          <ShieldAlert size={32} />
        </div>

        <h1 className="mt-5 text-2xl font-bold text-slate-900 dark:text-white">
          {title}
        </h1>

        <p className="mt-3 text-sm leading-6 text-slate-600 dark:text-slate-400">
          {description}
        </p>

        <div className="mt-6 inline-flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-600 dark:border-slate-700 dark:text-slate-300">
          <LockKeyhole size={17} />
          Access restricted by User Rights
        </div>
      </div>
    </div>
  );
}

export default function WarehousesPage() {
  const [warehouses, setWarehouses] = useState([]);
  const [permissions, setPermissions] = useState(deniedPermissions);
  const [permissionsLoaded, setPermissionsLoaded] = useState(false);
  const [permissionError, setPermissionError] = useState(false);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingWarehouse, setEditingWarehouse] = useState(null);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [message, setMessage] = useState(null);
  const [formError, setFormError] = useState("");
  const [form, setForm] = useState({ ...emptyForm });

  const loadPermissions = useCallback(async () => {
    const response = await fetch("/api/permissions/current", {
      cache: "no-store",
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(
        getErrorMessage(data, "Unable to load your permissions.")
      );
    }

    if (!Array.isArray(data.permissions)) {
      throw new Error("The permissions API returned an invalid response.");
    }

    const nextPermissions = normalizePermissions(data.permissions);

    setPermissions(nextPermissions);
    setPermissionsLoaded(true);
    setPermissionError(false);

    return nextPermissions;
  }, []);

  const loadWarehouses = useCallback(async (showRefresh = false) => {
    if (showRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    try {
      const response = await fetch("/api/warehouses", {
        cache: "no-store",
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          getErrorMessage(data, "Unable to load warehouses.")
        );
      }

      setWarehouses(
        Array.isArray(data.warehouses) ? data.warehouses : []
      );

      setMessage(null);
    } catch (error) {
      console.error("Failed to load warehouses:", error);

      setMessage({
        type: "error",
        text: error.message || "Unable to load warehouses.",
      });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function initialize() {
      try {
        const response = await fetch("/api/permissions/current", {
          cache: "no-store",
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(
            getErrorMessage(data, "Unable to load your permissions.")
          );
        }

        if (!Array.isArray(data.permissions)) {
          throw new Error("The permissions API returned an invalid response.");
        }

        const nextPermissions = normalizePermissions(data.permissions);

        if (cancelled) return;

        setPermissions(nextPermissions);
        setPermissionsLoaded(true);

        // Only VIEW permission controls access to the entire page.
        // Create, Edit, and Delete permissions do not block page access.
        if (!nextPermissions.view) {
          setLoading(false);
          return;
        }

        const warehouseResponse = await fetch("/api/warehouses", {
          cache: "no-store",
        });

        const warehouseData = await warehouseResponse.json();

        if (!warehouseResponse.ok) {
          throw new Error(
            getErrorMessage(
              warehouseData,
              "Unable to load warehouses."
            )
          );
        }

        if (!cancelled) {
          setWarehouses(
            Array.isArray(warehouseData.warehouses)
              ? warehouseData.warehouses
              : []
          );

          setMessage(null);
        }
      } catch (error) {
        console.error("Warehouse initialization failed:", error);

        if (!cancelled) {
          setPermissionError(true);
          setPermissions({ ...deniedPermissions });
          setPermissionsLoaded(true);

          setMessage({
            type: "error",
            text: error.message || "Unable to load warehouse access.",
          });
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    initialize();

    return () => {
      cancelled = true;
    };
  }, []);

  const activeCount = useMemo(
    () => warehouses.filter((warehouse) => warehouse.is_active).length,
    [warehouses]
  );

  const inactiveCount = warehouses.length - activeCount;

  const filteredWarehouses = useMemo(() => {
    const query = search.trim().toLowerCase();

    return warehouses.filter((warehouse) => {
      const matchesSearch =
        !query ||
        [
          warehouse.warehouse_name,
          warehouse.warehouse_code,
          warehouse.location,
          warehouse.description,
        ].some((value) =>
          String(value || "").toLowerCase().includes(query)
        );

      const matchesStatus =
        statusFilter === "all" ||
        (statusFilter === "active" && warehouse.is_active) ||
        (statusFilter === "inactive" && !warehouse.is_active);

      return matchesSearch && matchesStatus;
    });
  }, [warehouses, search, statusFilter]);

  function updateField(field, value) {
    setForm((previous) => ({
      ...previous,
      [field]: value,
    }));
  }

  function openCreateForm() {
    if (!permissions.view || !permissions.create) return;

    setEditingWarehouse(null);
    setForm({ ...emptyForm });
    setFormError("");
    setMessage(null);
    setShowForm(true);
  }

  function editWarehouse(warehouse) {
    if (!permissions.view || !permissions.edit) return;

    setEditingWarehouse(warehouse);

    setForm({
      warehouseName: warehouse.warehouse_name || "",
      warehouseCode: warehouse.warehouse_code || "",
      location: warehouse.location || "",
      description: warehouse.description || "",
      isActive: Boolean(warehouse.is_active),
    });

    setFormError("");
    setMessage(null);
    setShowForm(true);
  }

  function resetForm() {
    setForm({ ...emptyForm });
    setEditingWarehouse(null);
    setFormError("");
    setShowForm(false);
  }

  async function submitForm(event) {
    event.preventDefault();
    setFormError("");
    setMessage(null);

    if (!permissions.view) return;

    if (editingWarehouse ? !permissions.edit : !permissions.create) {
      setShowForm(false);
      setFormError(
        editingWarehouse
          ? "You do not have permission to edit warehouses."
          : "You do not have permission to create warehouses."
      );
      return;
    }

    if (!form.warehouseName.trim()) {
      setFormError("Please enter a warehouse name.");
      return;
    }

    if (!form.warehouseCode.trim()) {
      setFormError("Please enter a warehouse code.");
      return;
    }

    setSaving(true);

    try {
      const url = editingWarehouse
        ? `/api/warehouses/${editingWarehouse.warehouse_id}`
        : "/api/warehouses";

      const response = await fetch(url, {
        method: editingWarehouse ? "PUT" : "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ...form,
          warehouseName: form.warehouseName.trim(),
          warehouseCode: form.warehouseCode.trim(),
          location: form.location.trim(),
          description: form.description.trim(),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          getErrorMessage(data, "Unable to save warehouse.")
        );
      }

      setMessage({
        type: "success",
        text: editingWarehouse
          ? "Warehouse updated successfully."
          : "Warehouse created successfully.",
      });

      resetForm();
      await loadWarehouses(true);
    } catch (error) {
      setFormError(error.message || "Unable to save warehouse.");
    } finally {
      setSaving(false);
    }
  }

  async function deleteWarehouse(warehouse) {
    if (!permissions.view || !permissions.delete) return;

    const confirmed = window.confirm(
      `Delete "${warehouse.warehouse_name}"?\n\nThis action may be unavailable if the warehouse has existing stock or transactions.`
    );

    if (!confirmed) return;

    setDeletingId(warehouse.warehouse_id);
    setMessage(null);

    try {
      const response = await fetch(
        `/api/warehouses/${warehouse.warehouse_id}`,
        { method: "DELETE" }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          getErrorMessage(data, "Unable to delete warehouse.")
        );
      }

      setMessage({
        type: "success",
        text: "Warehouse deleted successfully.",
      });

      await loadWarehouses(true);
    } catch (error) {
      setMessage({
        type: "error",
        text: error.message || "Unable to delete warehouse.",
      });
    } finally {
      setDeletingId(null);
    }
  }

  if (!permissionsLoaded || loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center bg-slate-50 dark:bg-slate-950">
        <div className="text-center">
          <LoaderCircle
            size={38}
            className="mx-auto animate-spin text-blue-600 dark:text-blue-400"
          />

          <p className="mt-4 font-semibold text-slate-800 dark:text-slate-100">
            Checking warehouse permissions
          </p>

          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Loading your access rights...
          </p>
        </div>
      </div>
    );
  }

  // Show Access Denied ONLY when View permission is missing,
  // or permissions cannot be verified.
  if (!permissions.view || permissionError) {
    return (
      <AccessDenied
        title="Access Denied"
        description="You do not have View permission for Warehouse Management. Contact your administrator if you need access."
      />
    );
  }

  return (
    <div className="warehouse-page w-full min-w-0 space-y-6 text-slate-900 dark:text-slate-100">
      {/* Page header */}
      {/* Page header */}
<div className="flex flex-col justify-between gap-5 lg:flex-row lg:items-center">
  <div>
    <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-blue-100 bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-700 dark:border-blue-900 dark:bg-blue-950/60 dark:text-blue-300">
      <Warehouse size={15} />
      INVENTORY MANAGEMENT
    </div>

    <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl dark:text-white">
      Warehouse Management
    </h1>

    <p className="mt-2 max-w-xl text-sm leading-6 text-slate-500 dark:text-slate-400">
      Organize storage locations, manage warehouse details, and keep your
      inventory operations under control.
    </p>

    <div className="mt-4 flex flex-wrap items-center gap-3 text-sm text-slate-500 dark:text-slate-400">
      <span className="inline-flex items-center gap-2">
        <Building2 size={16} className="text-blue-500" />
        {warehouses.length} total warehouses
      </span>
      <span className="hidden sm:inline">•</span>
      <span className="inline-flex items-center gap-2">
        <Activity size={16} className="text-emerald-500" />
        {activeCount} active locations
      </span>
    </div>
  </div>

  <div className="flex shrink-0 flex-wrap items-center gap-3">
    <button
      type="button"
      onClick={() => loadWarehouses(true)}
      disabled={refreshing}
      className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
    >
      <RefreshCw size={17} className={refreshing ? "animate-spin" : ""} />
      Refresh
    </button>

    {permissions.create && (
      <button
        type="button"
        onClick={openCreateForm}
        className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 px-5 py-3 text-sm font-bold text-white shadow-lg shadow-blue-600/20 transition hover:-translate-y-0.5"
      >
        <Plus size={18} />
        Add Warehouse
      </button>
    )}
  </div>
</div>

      {/* Notifications */}
      {message && (
        <div
          role="status"
          className={`flex items-start gap-3 rounded-2xl border p-4 ${
            message.type === "success"
              ? "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300"
              : "border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-300"
          }`}
        >
          {message.type === "success" ? (
            <CheckCircle2 size={20} className="mt-0.5 shrink-0" />
          ) : (
            <AlertCircle size={20} className="mt-0.5 shrink-0" />
          )}

          <p className="flex-1 text-sm font-medium">{message.text}</p>

          <button
            type="button"
            onClick={() => setMessage(null)}
            aria-label="Dismiss notification"
            className="rounded-lg p-1 transition hover:bg-black/5 dark:hover:bg-white/10"
          >
            <X size={17} />
          </button>
        </div>
      )}

      {/* Summary cards remain visible with View permission alone. */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryCard
          title="Total Warehouses"
          value={warehouses.length}
          description="All registered locations"
          icon={Warehouse}
          tone="blue"
        />

        <SummaryCard
          title="Active Warehouses"
          value={activeCount}
          description="Available for operations"
          icon={CheckCircle2}
          tone="emerald"
        />

        <SummaryCard
          title="Inactive Warehouses"
          value={inactiveCount}
          description="Currently disabled"
          icon={XCircle}
          tone="amber"
        />

        <SummaryCard
          title="Filtered Results"
          value={filteredWarehouses.length}
          description="Matching your current filters"
          icon={Boxes}
          tone="violet"
        />
      </div>

      {/* Create/edit form */}
      {showForm &&
        (editingWarehouse ? permissions.edit : permissions.create) && (
          <div className="warehouse-form min-w-0">
            <div className="flex items-center justify-between gap-4 border-b border-slate-200 bg-slate-50/80 px-5 py-5 dark:border-slate-800 dark:bg-slate-900/80 sm:px-7">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300">
                  {editingWarehouse ? (
                    <Pencil size={21} />
                  ) : (
                    <Plus size={22} />
                  )}
                </div>

                <div>
                  <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                    {editingWarehouse ? "Edit Warehouse" : "Create Warehouse"}
                  </h2>

                  <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                    {editingWarehouse
                      ? "Update the warehouse information below."
                      : "Add a new storage location to your ERP."}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={resetForm}
                aria-label="Close warehouse form"
                className="rounded-xl border border-slate-200 p-2.5 text-slate-500 transition hover:bg-slate-100 hover:text-slate-900 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white"
              >
                <X size={19} />
              </button>
            </div>

            <form onSubmit={submitForm} className="p-5 sm:p-7">
              <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                <div>
                  <label htmlFor="warehouseName" className={labelClass}>
                    Warehouse Name <span className="text-rose-500">*</span>
                  </label>

                  <input
                    id="warehouseName"
                    value={form.warehouseName}
                    onChange={(event) =>
                      updateField("warehouseName", event.target.value)
                    }
                    placeholder="e.g. Main Warehouse"
                    className={inputClass}
                    maxLength={150}
                    required
                  />
                </div>

                <div>
                  <label htmlFor="warehouseCode" className={labelClass}>
                    Warehouse Code <span className="text-rose-500">*</span>
                  </label>

                  <input
                    id="warehouseCode"
                    value={form.warehouseCode}
                    onChange={(event) =>
                      updateField("warehouseCode", event.target.value)
                    }
                    placeholder="e.g. WH-001"
                    className={inputClass}
                    maxLength={50}
                    required
                  />
                </div>

                <div>
                  <label htmlFor="location" className={labelClass}>
                    <span className="inline-flex items-center gap-2">
                      <MapPin size={15} />
                      Location
                    </span>
                  </label>

                  <input
                    id="location"
                    value={form.location}
                    onChange={(event) =>
                      updateField("location", event.target.value)
                    }
                    placeholder="City, branch, or address"
                    className={inputClass}
                    maxLength={255}
                  />
                </div>

                <div>
                  <label htmlFor="description" className={labelClass}>
                    <span className="inline-flex items-center gap-2">
                      <FileText size={15} />
                      Description
                    </span>
                  </label>

                  <input
                    id="description"
                    value={form.description}
                    onChange={(event) =>
                      updateField("description", event.target.value)
                    }
                    placeholder="Brief description (optional)"
                    className={inputClass}
                    maxLength={500}
                  />
                </div>
              </div>

              <div className="mt-6 flex flex-col justify-between gap-5 rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800/50 sm:flex-row sm:items-center">
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300">
                    <Activity size={20} />
                  </div>

                  <div>
                    <p className="font-semibold text-slate-800 dark:text-slate-100">
                      Warehouse Status
                    </p>

                    <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                      {form.isActive
                        ? "This warehouse is active and available."
                        : "This warehouse is marked as inactive."}
                    </p>
                  </div>
                </div>

                <label className="inline-flex cursor-pointer items-center gap-3 self-start sm:self-center">
                  <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                    {form.isActive ? "Active" : "Inactive"}
                  </span>

                  <input
                    type="checkbox"
                    checked={form.isActive}
                    onChange={(event) =>
                      updateField("isActive", event.target.checked)
                    }
                    className="peer sr-only"
                  />

                  <span className="relative h-6 w-11 rounded-full bg-slate-300 transition peer-checked:bg-emerald-500 peer-focus-visible:ring-4 peer-focus-visible:ring-emerald-500/20 after:absolute after:left-0.5 after:top-0.5 after:h-5 after:w-5 after:rounded-full after:bg-white after:shadow-sm after:transition-transform after:content-[''] peer-checked:after:translate-x-5 dark:bg-slate-600" />
                </label>
              </div>

              {formError && (
                <div className="mt-5 flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-300">
                  <AlertCircle size={18} className="mt-0.5 shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={resetForm}
                  disabled={saving}
                  className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 px-5 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                >
                  <X size={17} />
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={saving}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-6 py-3 text-sm font-bold text-white shadow-lg shadow-blue-600/20 transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {saving ? (
                    <LoaderCircle size={18} className="animate-spin" />
                  ) : (
                    <Save size={18} />
                  )}

                  {saving
                    ? "Saving..."
                    : editingWarehouse
                      ? "Save Changes"
                      : "Create Warehouse"}
                </button>
              </div>
            </form>
          </div>
        )}

      {/* Warehouse listing */}
      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="border-b border-slate-200 p-5 dark:border-slate-800 sm:p-6">
          <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300">
                <ClipboardList size={22} />
              </div>

              <div>
                <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                  Warehouse Directory
                </h2>

                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                  View and manage your registered storage locations.
                </p>
              </div>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row">
              <div className="relative min-w-0 sm:min-w-[270px]">
                <Search
                  size={18}
                  className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
                />

                <input
                  type="search"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search warehouses..."
                  aria-label="Search warehouses"
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
                  aria-label="Filter warehouses by status"
                  className="w-full appearance-none rounded-xl border border-slate-200 bg-white py-3 pl-9 pr-9 text-sm font-medium text-slate-700 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 sm:w-auto"
                >
                  <option value="all">All Statuses</option>
                  <option value="active">Active Only</option>
                  <option value="inactive">Inactive Only</option>
                </select>
              </div>
            </div>
          </div>

          <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Showing{" "}
              <span className="font-bold text-slate-900 dark:text-white">
                {filteredWarehouses.length}
              </span>{" "}
              of{" "}
              <span className="font-bold text-slate-900 dark:text-white">
                {warehouses.length}
              </span>{" "}
              warehouses
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
              size={35}
              className="animate-spin text-blue-600 dark:text-blue-400"
            />

            <p className="mt-4 font-semibold text-slate-700 dark:text-slate-200">
              Loading warehouses
            </p>

            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              Fetching your warehouse directory...
            </p>
          </div>
        ) : filteredWarehouses.length === 0 ? (
          <div className="flex min-h-72 flex-col items-center justify-center px-5 py-12 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-500">
              {search || statusFilter !== "all" ? (
                <Search size={29} />
              ) : (
                <Warehouse size={30} />
              )}
            </div>

            <h3 className="mt-5 text-lg font-bold text-slate-900 dark:text-white">
              {search || statusFilter !== "all"
                ? "No matching warehouses"
                : "No warehouses yet"}
            </h3>

            <p className="mt-2 max-w-sm text-sm leading-6 text-slate-500 dark:text-slate-400">
              {search || statusFilter !== "all"
                ? "Try a different search term or change your status filter."
                : permissions.create
                  ? "Create your first warehouse to start organizing your inventory locations."
                  : "There are no warehouses to display."}
            </p>

            {search || statusFilter !== "all" ? (
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
            ) : (
              permissions.create && (
                <button
                  type="button"
                  onClick={openCreateForm}
                  className="mt-5 inline-flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-3 text-sm font-bold text-white transition hover:bg-blue-700"
                >
                  <Plus size={17} />
                  Add Your First Warehouse
                </button>
              )
            )}
          </div>
        ) : (
          <>
            {/* Desktop table */}
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full min-w-[760px] text-left">
                <thead className="bg-slate-50 dark:bg-slate-800/70">
                  <tr>
                    {[
                      "Warehouse",
                      "Location",
                      "Description",
                      "Status",
                    ].map((heading) => (
                      <th
                        key={heading}
                        className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400"
                      >
                        {heading}
                      </th>
                    ))}

                    {(permissions.edit || permissions.delete) && (
                      <th className="px-6 py-4 text-right text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                        Actions
                      </th>
                    )}
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {filteredWarehouses.map((warehouse) => (
                    <tr
                      key={warehouse.warehouse_id}
                      className="group transition hover:bg-blue-50/40 dark:hover:bg-slate-800/50"
                    >
                      <td className="px-6 py-5">
                        <div className="flex items-center gap-3">
                          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-blue-100 to-indigo-100 text-blue-700 dark:from-blue-500/15 dark:to-indigo-500/15 dark:text-blue-300">
                            <Warehouse size={21} />
                          </div>

                          <div className="min-w-0">
                            <p className="font-bold text-slate-900 dark:text-white">
                              {warehouse.warehouse_name || "Unnamed warehouse"}
                            </p>

                            <p className="mt-1 text-xs font-semibold tracking-wide text-slate-500 dark:text-slate-400">
                              {warehouse.warehouse_code || "NO CODE"}
                            </p>
                          </div>
                        </div>
                      </td>

                      <td className="px-6 py-5">
                        <div className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
                          <MapPin size={16} className="shrink-0 text-slate-400" />
                          <span>{warehouse.location || "Not specified"}</span>
                        </div>
                      </td>

                      <td className="max-w-[220px] px-6 py-5">
                        <p className="truncate text-sm text-slate-600 dark:text-slate-300">
                          {warehouse.description || "No description"}
                        </p>
                      </td>

                      <td className="px-6 py-5">
                        <StatusBadge active={warehouse.is_active} />
                      </td>

                      {(permissions.edit || permissions.delete) && (
                        <td className="px-6 py-5">
                          <div className="flex justify-end gap-2">
                            {permissions.edit && (
                              <button
                                type="button"
                                onClick={() => editWarehouse(warehouse)}
                                title="Edit warehouse"
                                aria-label={`Edit ${warehouse.warehouse_name}`}
                                className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:border-blue-500/40 dark:hover:bg-blue-500/10 dark:hover:text-blue-300"
                              >
                                <Pencil size={15} />
                                Edit
                              </button>
                            )}

                            {permissions.delete && (
                              <button
                                type="button"
                                onClick={() => deleteWarehouse(warehouse)}
                                disabled={deletingId === warehouse.warehouse_id}
                                title="Delete warehouse"
                                aria-label={`Delete ${warehouse.warehouse_name}`}
                                className="inline-flex items-center justify-center rounded-lg border border-rose-200 bg-white p-2 text-rose-600 transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-rose-500/30 dark:bg-slate-900 dark:text-rose-400 dark:hover:bg-rose-500/10"
                              >
                                {deletingId === warehouse.warehouse_id ? (
                                  <LoaderCircle
                                    size={17}
                                    className="animate-spin"
                                  />
                                ) : (
                                  <Trash2 size={17} />
                                )}
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

            {/* Mobile cards */}
            <div className="grid grid-cols-1 gap-4 p-4 md:hidden">
              {filteredWarehouses.map((warehouse) => (
                <article
                  key={warehouse.warehouse_id}
                  className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900"
                >
                  <div className="flex items-start gap-3">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-blue-100 to-indigo-100 text-blue-700 dark:from-blue-500/15 dark:to-indigo-500/15 dark:text-blue-300">
                      <Warehouse size={22} />
                    </div>

                    <div className="min-w-0 flex-1">
                      <h3 className="break-words font-bold text-slate-900 dark:text-white">
                        {warehouse.warehouse_name || "Unnamed warehouse"}
                      </h3>

                      <p className="mt-1 text-xs font-semibold text-slate-500 dark:text-slate-400">
                        {warehouse.warehouse_code || "NO CODE"}
                      </p>
                    </div>

                    <StatusBadge active={warehouse.is_active} />
                  </div>

                  <div className="mt-4 space-y-3 border-t border-slate-100 pt-4 dark:border-slate-800">
                    <div className="flex items-start gap-2 text-sm text-slate-600 dark:text-slate-300">
                      <MapPin size={16} className="mt-0.5 shrink-0 text-slate-400" />
                      <span>
                        {warehouse.location || "Location not specified"}
                      </span>
                    </div>

                    <div className="flex items-start gap-2 text-sm text-slate-600 dark:text-slate-300">
                      <FileText size={16} className="mt-0.5 shrink-0 text-slate-400" />
                      <span className="break-words">
                        {warehouse.description || "No description provided"}
                      </span>
                    </div>
                  </div>

                  {(permissions.edit || permissions.delete) && (
                    <div
                      className={`mt-4 grid gap-2 ${
                        permissions.edit && permissions.delete
                          ? "grid-cols-2"
                          : "grid-cols-1"
                      }`}
                    >
                      {permissions.edit && (
                        <button
                          type="button"
                          onClick={() => editWarehouse(warehouse)}
                          className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 px-3 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                        >
                          <Pencil size={16} />
                          Edit
                        </button>
                      )}

                      {permissions.delete && (
                        <button
                          type="button"
                          onClick={() => deleteWarehouse(warehouse)}
                          disabled={deletingId === warehouse.warehouse_id}
                          className="inline-flex items-center justify-center gap-2 rounded-xl border border-rose-200 px-3 py-2.5 text-sm font-semibold text-rose-600 transition hover:bg-rose-50 disabled:opacity-50 dark:border-rose-500/30 dark:text-rose-400 dark:hover:bg-rose-500/10"
                        >
                          {deletingId === warehouse.warehouse_id ? (
                            <LoaderCircle
                              size={16}
                              className="animate-spin"
                            />
                          ) : (
                            <Trash2 size={16} />
                          )}
                          Delete
                        </button>
                      )}
                    </div>
                  )}
                </article>
              ))}
            </div>
          </>
        )}

        {!loading && warehouses.length > 0 && (
          <div className="flex flex-col justify-between gap-2 border-t border-slate-200 bg-slate-50/70 px-5 py-4 text-xs text-slate-500 dark:border-slate-800 dark:bg-slate-800/30 dark:text-slate-400 sm:flex-row sm:items-center sm:px-6">
            <span>
              <span className="font-semibold text-slate-700 dark:text-slate-200">
                {filteredWarehouses.length}
              </span>{" "}
              warehouse{filteredWarehouses.length === 1 ? "" : "s"} displayed
            </span>

            <span className="inline-flex items-center gap-1.5">
              <Activity size={14} />
              Warehouse directory
              <ArrowUpRight size={13} />
            </span>
          </div>
        )}
      </section>

      <div className="flex flex-col gap-2 px-1 text-xs text-slate-500 dark:text-slate-400 sm:flex-row sm:items-center sm:justify-between">
        <span className="inline-flex items-center gap-2">
          <Package size={14} />
          Keep warehouse names and codes consistent with your inventory records.
        </span>

        <span>ERP · Inventory Management</span>
      </div>
    </div>
  );
}
