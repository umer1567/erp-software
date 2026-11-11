"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Upload,
  Plus,
  Search,
  RefreshCw,
  Pencil,
  Trash2,
  X,
  Ruler,
  CheckCircle2,
  XCircle,
  Package,
  AlertCircle,
  FileSpreadsheet,
  LoaderCircle,
  Filter,
  Tag,
  FileText,
  Save,
  ChevronRight,
  Boxes,
  CircleCheck,
  RotateCcw,
  ShieldAlert,
} from "lucide-react";

const EMPTY_FORM = {
  unit_code: "",
  unit_name: "",
  description: "",
  is_active: true,
};

const DEFAULT_PERMISSIONS = {
  canView: false,
  canCreate: false,
  canUpdate: false,
  canDelete: false,
};

const INPUT_CLASS =
  "w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:placeholder:text-slate-500";

const LABEL_CLASS =
  "mb-2 block text-sm font-semibold text-slate-700 dark:text-slate-200";

function getErrorMessage(data, fallback) {
  return data?.error || data?.message || fallback;
}

function normalizePermissions(value) {
  if (!value || typeof value !== "object") {
    return { ...DEFAULT_PERMISSIONS };
  }

  return {
    canView: value.canView === true || value.can_view === true,
    canCreate: value.canCreate === true || value.can_create === true,
    canUpdate:
      value.canUpdate === true ||
      value.can_update === true ||
      value.canEdit === true ||
      value.can_edit === true,
    canDelete: value.canDelete === true || value.can_delete === true,
  };
}

function normalizeUnitsResponse(data) {
  // Supports the updated API response:
  // { success: true, units: [], permissions: {} }
  // Also accepts an array for compatibility with the original API.
  if (Array.isArray(data)) {
    return {
      units: data,
      permissions: { ...DEFAULT_PERMISSIONS },
    };
  }

  if (!data || !Array.isArray(data.units)) {
    throw new Error("The units API returned an unexpected response.");
  }

  return {
    units: data.units,
    permissions: normalizePermissions(data.permissions),
  };
}

export default function UnitsOfMeasurePage() {
  const [units, setUnits] = useState([]);
  const [permissions, setPermissions] = useState({
    ...DEFAULT_PERMISSIONS,
  });

  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [editingId, setEditingId] = useState(null);

  const [showForm, setShowForm] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [importing, setImporting] = useState(false);
  const [deletingId, setDeletingId] = useState(null);

  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const loadUnits = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const response = await fetch("/api/units-of-measure", {
        method: "GET",
        cache: "no-store",
      });

      const data = await response.json();

      if (!response.ok) {
        if (response.status === 401 || response.status === 403) {
          setUnits([]);
          setPermissions({ ...DEFAULT_PERMISSIONS });
          setShowForm(false);
        }

        throw new Error(
          getErrorMessage(data, "Could not load units.")
        );
      }

      const normalized = normalizeUnitsResponse(data);

      setPermissions(normalized.permissions);

      if (!normalized.permissions.canView) {
        setUnits([]);
        setShowForm(false);
        setEditingId(null);
        setForm({ ...EMPTY_FORM });
        setError("");
        return;
      }

      setUnits(normalized.units);
    } catch (err) {
      setError(err.message || "Could not load units.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadInitialUnits() {
      try {
        const response = await fetch("/api/units-of-measure", {
          method: "GET",
          cache: "no-store",
        });

        const data = await response.json();

        if (!response.ok) {
          if (response.status === 401 || response.status === 403) {
            if (!cancelled) {
              setUnits([]);
              setPermissions({ ...DEFAULT_PERMISSIONS });
            }
          }

          throw new Error(
            getErrorMessage(data, "Could not load units.")
          );
        }

        const normalized = normalizeUnitsResponse(data);

        if (!cancelled) {
          setPermissions(normalized.permissions);

          if (normalized.permissions.canView) {
            setUnits(normalized.units);
          } else {
            setUnits([]);
            setShowForm(false);
            setEditingId(null);
            setForm({ ...EMPTY_FORM });
          }

          setError("");
        }
      } catch (err) {
        if (!cancelled) {
          setError(err.message || "Could not load units.");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadInitialUnits();

    return () => {
      cancelled = true;
    };
  }, []);

  const activeCount = useMemo(
    () => units.filter((unit) => unit.is_active === true).length,
    [units]
  );

  const inactiveCount = units.length - activeCount;

  const filteredUnits = useMemo(() => {
    const query = search.trim().toLowerCase();

    return units.filter((unit) => {
      const matchesSearch =
        String(unit.unit_code ?? "").toLowerCase().includes(query) ||
        String(unit.unit_name ?? "").toLowerCase().includes(query) ||
        String(unit.description ?? "").toLowerCase().includes(query);

      const matchesStatus =
        statusFilter === "all" ||
        (statusFilter === "active" && unit.is_active === true) ||
        (statusFilter === "inactive" && unit.is_active !== true);

      return matchesSearch && matchesStatus;
    });
  }, [units, search, statusFilter]);

  function updateField(event) {
    const { name, value, type, checked } = event.target;

    setForm((current) => ({
      ...current,
      [name]: type === "checkbox" ? checked : value,
    }));
  }

  function openAddForm() {
    if (!permissions.canView || !permissions.canCreate) {
      setError("You do not have permission to create units.");
      return;
    }

    setForm({ ...EMPTY_FORM });
    setEditingId(null);
    setError("");
    setNotice("");
    setShowForm(true);
  }

  function closeForm() {
    if (saving) return;

    setForm({ ...EMPTY_FORM });
    setEditingId(null);
    setShowForm(false);
    setError("");
  }

  function startEdit(unit) {
    if (!permissions.canView || !permissions.canUpdate) {
      setError("You do not have permission to edit units.");
      return;
    }

    setEditingId(unit.unit_id);

    setForm({
      unit_code: unit.unit_code || "",
      unit_name: unit.unit_name || "",
      description: unit.description || "",
      is_active: unit.is_active === true,
    });

    setError("");
    setNotice("");
    setShowForm(true);
  }

  async function submitForm(event) {
    event.preventDefault();

    if (!permissions.canView) {
      setError("You do not have permission to view units.");
      return;
    }

    if (editingId ? !permissions.canUpdate : !permissions.canCreate) {
      setError(
        editingId
          ? "You do not have permission to edit units."
          : "You do not have permission to create units."
      );
      return;
    }

    if (!form.unit_code.trim() || !form.unit_name.trim()) {
      setError("Unit Code and Unit Name are required.");
      return;
    }

    setSaving(true);
    setError("");
    setNotice("");

    try {
      const response = await fetch(
        editingId
          ? `/api/units-of-measure/${editingId}`
          : "/api/units-of-measure",
        {
          method: editingId ? "PUT" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...form,
            unit_code: form.unit_code.trim().toUpperCase(),
            unit_name: form.unit_name.trim(),
            description: form.description.trim(),
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        if (response.status === 401 || response.status === 403) {
          await loadUnits();
        }

        throw new Error(getErrorMessage(data, "Could not save unit."));
      }

      setNotice(
        editingId
          ? "Unit updated successfully."
          : "Unit created successfully."
      );

      setForm({ ...EMPTY_FORM });
      setEditingId(null);
      setShowForm(false);

      await loadUnits();
    } catch (err) {
      setError(err.message || "Could not save unit.");
    } finally {
      setSaving(false);
    }
  }

  async function deleteUnit(unit) {
    if (!permissions.canView || !permissions.canDelete) {
      setError("You do not have permission to delete units.");
      return;
    }

    const confirmed = window.confirm(
      `Delete unit "${unit.unit_code} - ${unit.unit_name}"?`
    );

    if (!confirmed) return;

    setDeletingId(unit.unit_id);
    setError("");
    setNotice("");

    try {
      const response = await fetch(
        `/api/units-of-measure/${unit.unit_id}`,
        { method: "DELETE" }
      );

      const data = await response.json();

      if (!response.ok) {
        if (response.status === 401 || response.status === 403) {
          await loadUnits();
        }

        throw new Error(getErrorMessage(data, "Could not delete unit."));
      }

      if (editingId === unit.unit_id) {
        setShowForm(false);
        setEditingId(null);
        setForm({ ...EMPTY_FORM });
      }

      setNotice(data.message || "Unit deleted successfully.");
      await loadUnits();
    } catch (err) {
      setError(err.message || "Could not delete unit.");
    } finally {
      setDeletingId(null);
    }
  }

  async function handleExcelImport(event) {
    const fileInput = event.target;
    const file = fileInput.files?.[0];

    if (!file) return;

    if (!permissions.canView || !permissions.canCreate) {
      setError("You do not have permission to import units.");
      fileInput.value = "";
      return;
    }

    const extension = file.name.split(".").pop()?.toLowerCase();

    if (!["xlsx", "csv"].includes(extension)) {
      setError("Please select an Excel (.xlsx) or CSV (.csv) file.");
      fileInput.value = "";
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setError("File size must not exceed 5 MB.");
      fileInput.value = "";
      return;
    }

    const formData = new FormData();
    formData.append("file", file);

    setImporting(true);
    setError("");
    setNotice("");

    try {
      const response = await fetch("/api/units-of-measure/import", {
        method: "POST",
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        if (response.status === 401 || response.status === 403) {
          await loadUnits();
        }

        throw new Error(getErrorMessage(data, "Could not import units."));
      }

      await loadUnits();

      if (Array.isArray(data.errors) && data.errors.length > 0) {
        setError(
          `Imported ${data.imported ?? 0} units; ${data.skipped ?? 0} rows were skipped.\n${data.errors.join("\n")}`
        );
      } else {
        setNotice(
          data.message ||
          `Successfully imported ${data.imported ?? 0} units.`
        );
      }
    } catch (err) {
      setError(err.message || "Could not import units.");
    } finally {
      setImporting(false);
      fileInput.value = "";
    }
  }

  // Do not render unit information when View permission is missing.
  if (!loading && !permissions.canView) {
    return (
      <main className="flex min-h-[70vh] items-center justify-center text-slate-900 dark:text-slate-100">

        <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-red-50 text-red-600 dark:bg-red-950/40 dark:text-red-400">
            <ShieldAlert size={34} />
          </div>

          <h1 className="text-xl font-bold text-slate-900 dark:text-white">
            Access Denied
          </h1>

          <p className="mt-3 text-sm leading-6 text-slate-500 dark:text-slate-400">
            You do not have permission to view Units of Measure. Please
            contact your administrator if you need access.
          </p>

          {error && (
            <p
              role="alert"
              className="mt-4 rounded-xl bg-red-50 p-3 text-left text-sm text-red-700 dark:bg-red-950/30 dark:text-red-300"
            >
              {error}
            </p>
          )}

          <button
            type="button"
            onClick={loadUnits}
            disabled={loading}
            className="mt-6 inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:opacity-60"
          >
            <RefreshCw
              size={16}
              className={loading ? "animate-spin" : ""}
            />
            Check Permissions Again
          </button>
        </div>
      </main>
    );
  }

  if (loading) {
    return (
      <main className="flex min-h-[70vh] items-center justify-center text-slate-900 dark:text-slate-100">

        <div className="flex flex-col items-center gap-4">
          <LoaderCircle size={36} className="animate-spin text-blue-600" />
          <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
            Checking permissions and loading units...
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="uom-page w-full min-w-0 text-slate-900 dark:text-slate-100">
      <div className="w-full min-w-0 space-y-7">
        {/* <div className="mx-auto max-w-[1600px] space-y-7"> */}
        <header className="flex flex-col justify-between gap-5 lg:flex-row lg:items-center">
          <div className="flex items-start gap-4">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-600 via-indigo-600 to-violet-600 text-white shadow-lg shadow-blue-600/20">
              <Ruler size={27} />
            </div>

            <div>
              <div className="mb-1 flex flex-wrap items-center gap-2">
                <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl dark:text-white">
                  Units of Measure
                </h1>

                <span className="rounded-full border border-blue-100 bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700 dark:border-blue-900 dark:bg-blue-950/60 dark:text-blue-300">
                  Inventory
                </span>
              </div>

              <p className="max-w-2xl text-sm leading-6 text-slate-500 dark:text-slate-400">
                Manage the units used across your products, purchases, sales,
                and inventory records.
              </p>

              <div className="mt-3 flex items-center gap-2 text-xs text-slate-400 dark:text-slate-500">
                <Package size={14} />
                <span>Product Management</span>
                <ChevronRight size={13} />
                <span className="font-medium text-slate-600 dark:text-slate-300">
                  Units of Measure
                </span>
              </div>
            </div>
          </div>

          {!showForm && (
            <div className="flex flex-wrap items-center gap-3">
              {permissions.canCreate && (
                <label
                  className={`inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:border-blue-700 dark:hover:bg-blue-950/40 dark:hover:text-blue-300 ${importing ? "pointer-events-none opacity-60" : ""
                    }`}
                >
                  {importing ? (
                    <LoaderCircle size={17} className="animate-spin" />
                  ) : (
                    <Upload size={17} />
                  )}

                  {importing ? "Importing..." : "Import Excel / CSV"}

                  <input
                    type="file"
                    accept=".xlsx,.csv"
                    className="hidden"
                    disabled={importing}
                    onChange={handleExcelImport}
                  />
                </label>
              )}

              {permissions.canCreate && (
                <button
                  type="button"
                  onClick={openAddForm}
                  className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-blue-600/20 transition hover:-translate-y-0.5 hover:from-blue-700 hover:to-indigo-700 focus:outline-none focus:ring-4 focus:ring-blue-500/20"
                >
                  <Plus size={18} />
                  Add Unit
                </button>
              )}
            </div>
          )}
        </header>

        {error && (
          <div
            role="alert"
            className="flex items-start gap-3 whitespace-pre-line rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-800 dark:border-red-900/70 dark:bg-red-950/30 dark:text-red-200"
          >
            <AlertCircle className="mt-0.5 shrink-0" size={19} />
            <p className="min-w-0 flex-1">{error}</p>
            <button
              type="button"
              onClick={() => setError("")}
              className="rounded-lg p-1 hover:bg-red-100 dark:hover:bg-red-900/50"
              aria-label="Dismiss error"
            >
              <X size={17} />
            </button>
          </div>
        )}

        {notice && !error && (
          <div
            role="status"
            className="flex items-start gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800 dark:border-emerald-900/70 dark:bg-emerald-950/30 dark:text-emerald-200"
          >
            <CheckCircle2 className="mt-0.5 shrink-0" size={19} />
            <p className="min-w-0 flex-1">{notice}</p>
            <button
              type="button"
              onClick={() => setNotice("")}
              className="rounded-lg p-1 hover:bg-emerald-100 dark:hover:bg-emerald-900/50"
              aria-label="Dismiss notification"
            >
              <X size={17} />
            </button>
          </div>
        )}

        {!showForm && (
          <section
            aria-label="Unit statistics"
            className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4"
          >
            <SummaryCard
              title="Total Units"
              value={units.length}
              description="All registered units"
              icon={Boxes}
              color="blue"
              loading={loading}
            />

            <SummaryCard
              title="Active Units"
              value={activeCount}
              description="Available for use"
              icon={CircleCheck}
              color="green"
              loading={loading}
            />

            <SummaryCard
              title="Inactive Units"
              value={inactiveCount}
              description="Currently disabled"
              icon={XCircle}
              color="amber"
              loading={loading}
            />

            <SummaryCard
              title="Matching Results"
              value={filteredUnits.length}
              description="Based on your search and filter"
              icon={Search}
              color="purple"
              loading={loading}
            />
          </section>
        )}

        {showForm && (
          <form
            onSubmit={submitForm}
            className="min-w-0"
          >
            <div className="flex flex-col justify-between gap-4 p-5 sm:flex-row sm:items-center sm:px-7">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-600 text-white shadow-md shadow-blue-600/20">
                  {editingId ? <Pencil size={20} /> : <Plus size={22} />}
                </div>

                <div>
                  <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                    {editingId ? "Edit Unit" : "Create a Unit"}
                  </h2>

                  <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                    {editingId
                      ? "Update the selected unit's information."
                      : "Add a unit to your inventory master data."}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={closeForm}
                disabled={saving}
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                <X size={16} />
                Close
              </button>
            </div>

            <div className="space-y-6 p-5 sm:p-7">
              <div className="grid gap-5 md:grid-cols-2">
                <div>
                  <label htmlFor="unit_code" className={LABEL_CLASS}>
                    Unit Code <span className="text-red-500">*</span>
                  </label>

                  <div className="relative">
                    <Tag
                      size={17}
                      className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
                    />

                    <input
                      id="unit_code"
                      className={`${INPUT_CLASS} pl-10 uppercase`}
                      name="unit_code"
                      value={form.unit_code}
                      onChange={updateField}
                      maxLength={30}
                      required
                      placeholder="e.g. PCS"
                    />
                  </div>

                  <p className="mt-2 text-xs text-slate-400 dark:text-slate-500">
                    A short identifier such as PCS, KG, or BOX.
                  </p>
                </div>

                <div>
                  <label htmlFor="unit_name" className={LABEL_CLASS}>
                    Unit Name <span className="text-red-500">*</span>
                  </label>

                  <div className="relative">
                    <Ruler
                      size={17}
                      className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
                    />

                    <input
                      id="unit_name"
                      className={`${INPUT_CLASS} pl-10`}
                      name="unit_name"
                      value={form.unit_name}
                      onChange={updateField}
                      maxLength={100}
                      required
                      placeholder="e.g. Pieces"
                    />
                  </div>

                  <p className="mt-2 text-xs text-slate-400 dark:text-slate-500">
                    Enter the full, readable unit name.
                  </p>
                </div>

                <div className="md:col-span-2">
                  <label htmlFor="description" className={LABEL_CLASS}>
                    Description
                  </label>

                  <div className="relative">
                    <FileText
                      size={17}
                      className="pointer-events-none absolute left-3.5 top-4 text-slate-400"
                    />

                    <textarea
                      id="description"
                      className={`${INPUT_CLASS} min-h-24 resize-y pl-10`}
                      name="description"
                      value={form.description}
                      onChange={updateField}
                      maxLength={5000}
                      rows={3}
                      placeholder="Explain how this unit is used (optional)"
                    />
                  </div>
                </div>
              </div>

              <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4 transition hover:border-emerald-300 hover:bg-emerald-50/50 dark:border-slate-700 dark:bg-slate-950/50 dark:hover:border-emerald-800 dark:hover:bg-emerald-950/20">
                <input
                  type="checkbox"
                  name="is_active"
                  checked={form.is_active}
                  onChange={updateField}
                  className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 dark:border-slate-600 dark:bg-slate-800"
                />

                <div className="flex-1">
                  <span className="block text-sm font-semibold text-slate-800 dark:text-slate-100">
                    Active unit
                  </span>

                  <span className="mt-1 block text-xs text-slate-500 dark:text-slate-400">
                    Allow this unit to be selected in relevant forms.
                  </span>
                </div>

                <CheckCircle2
                  size={21}
                  className={
                    form.is_active
                      ? "text-emerald-500"
                      : "text-slate-300 dark:text-slate-600"
                  }
                />
              </label>
            </div>

            <div className="flex flex-col-reverse gap-3 px-5 py-4 sm:flex-row sm:justify-end sm:px-7">
              <button
                type="button"
                onClick={closeForm}
                disabled={saving}
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                Cancel
              </button>

              <button
                type="submit"
                disabled={
                  saving ||
                  (editingId
                    ? !permissions.canUpdate
                    : !permissions.canCreate)
                }
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 px-5 py-3 text-sm font-semibold text-white shadow-md shadow-blue-600/20 hover:from-blue-700 hover:to-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {saving ? (
                  <LoaderCircle size={17} className="animate-spin" />
                ) : (
                  <Save size={17} />
                )}

                {saving
                  ? "Saving..."
                  : editingId
                    ? "Update Unit"
                    : "Save Unit"}
              </button>
            </div>
          </form>
        )}

        {!showForm && (
          <section className="min-w-0">
            <div className="p-5 sm:p-6">
              <div className="mb-5 flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
                <div>
                  <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                    Units Master
                  </h2>

                  <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                    Search, review, and maintain your unit records.
                  </p>
                </div>

                <div className="inline-flex w-fit items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-600 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-300">
                  <Package size={14} />
                  {filteredUnits.length}{" "}
                  {filteredUnits.length === 1 ? "record" : "records"}
                </div>
              </div>

              <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_220px_auto_auto]">
                <div className="relative">
                  <Search
                    size={18}
                    className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
                  />

                  <input
                    className={`${INPUT_CLASS} pl-10`}
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Search code, name, or description..."
                    aria-label="Search units"
                  />

                  {search && (
                    <button
                      type="button"
                      onClick={() => setSearch("")}
                      className="absolute right-3 top-1/2 -translate-y-1/2 rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-white"
                      aria-label="Clear search"
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
                    className={`${INPUT_CLASS} appearance-none pl-10 pr-8`}
                    value={statusFilter}
                    onChange={(event) => setStatusFilter(event.target.value)}
                    aria-label="Filter units by status"
                  >
                    <option value="all">All statuses</option>
                    <option value="active">Active only</option>
                    <option value="inactive">Inactive only</option>
                  </select>
                </div>

                <button
                  type="button"
                  onClick={loadUnits}
                  disabled={loading}
                  className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:border-blue-800 dark:hover:bg-blue-950/30 dark:hover:text-blue-300"
                >
                  <RefreshCw
                    size={16}
                    className={loading ? "animate-spin" : ""}
                  />
                  Refresh
                </button>

                {(search || statusFilter !== "all") && (
                  <button
                    type="button"
                    onClick={() => {
                      setSearch("");
                      setStatusFilter("all");
                    }}
                    className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                  >
                    <RotateCcw size={15} />
                    Reset
                  </button>
                )}
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 dark:bg-slate-950/70">
                  <tr className="border-b border-slate-200 dark:border-slate-800">
                    <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                      Unit Code
                    </th>

                    <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                      Unit Name
                    </th>

                    <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                      Description
                    </th>

                    <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                      Status
                    </th>

                    {(permissions.canUpdate || permissions.canDelete) && (
                      <th className="px-6 py-4 text-right text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                        Actions
                      </th>
                    )}
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {loading ? (
                    <tr>
                      <td
                        colSpan={
                          4 +
                          (permissions.canUpdate || permissions.canDelete
                            ? 1
                            : 0)
                        }
                        className="px-6 py-16 text-center"
                      >
                        <div className="flex flex-col items-center gap-3">
                          <LoaderCircle
                            size={29}
                            className="animate-spin text-blue-600"
                          />

                          <span className="text-sm font-medium text-slate-500 dark:text-slate-400">
                            Loading units...
                          </span>
                        </div>
                      </td>
                    </tr>
                  ) : filteredUnits.length === 0 ? (
                    <tr>
                      <td
                        colSpan={
                          4 +
                          (permissions.canUpdate || permissions.canDelete
                            ? 1
                            : 0)
                        }
                        className="px-6 py-16 text-center"
                      >
                        <div className="mx-auto flex max-w-md flex-col items-center">
                          <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-500">
                            <Ruler size={27} />
                          </div>

                          <h3 className="font-semibold text-slate-800 dark:text-slate-100">
                            {search || statusFilter !== "all"
                              ? "No matching units"
                              : "No units yet"}
                          </h3>

                          <p className="mt-2 text-sm leading-6 text-slate-500 dark:text-slate-400">
                            {search || statusFilter !== "all"
                              ? "Try another search term or change the status filter."
                              : "Create your first unit to start organizing inventory."}
                          </p>

                          {!search &&
                            statusFilter === "all" &&
                            units.length === 0 &&
                            permissions.canCreate && (
                              <button
                                type="button"
                                onClick={openAddForm}
                                className="mt-5 inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700"
                              >
                                <Plus size={17} />
                                Create first unit
                              </button>
                            )}
                        </div>
                      </td>
                    </tr>
                  ) : (
                    filteredUnits.map((unit) => (
                      <tr
                        key={unit.unit_id}
                        className="group transition-colors hover:bg-blue-50/50 dark:hover:bg-slate-800/50"
                      >
                        <td className="px-6 py-4">
                          <span className="inline-flex items-center gap-2 rounded-lg border border-blue-100 bg-blue-50 px-3 py-2 font-bold tracking-wide text-blue-700 dark:border-blue-900/70 dark:bg-blue-950/50 dark:text-blue-300">
                            <Ruler size={15} />
                            {unit.unit_code}
                          </span>
                        </td>

                        <td className="px-6 py-4">
                          <div>
                            <p className="font-semibold text-slate-900 dark:text-slate-100">
                              {unit.unit_name}
                            </p>

                            <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">
                              Unit ID: {unit.unit_id}
                            </p>
                          </div>
                        </td>

                        <td className="px-6 py-4">
                          <p className="max-w-md whitespace-pre-line break-words leading-6 text-slate-600 dark:text-slate-300">
                            {unit.description || (
                              <span className="italic text-slate-400 dark:text-slate-500">
                                No description provided
                              </span>
                            )}
                          </p>
                        </td>

                        <td className="px-6 py-4">
                          <span
                            className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold ${unit.is_active
                              ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/50 dark:text-emerald-300"
                              : "border-slate-200 bg-slate-100 text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
                              }`}
                          >
                            <span
                              className={`h-1.5 w-1.5 rounded-full ${unit.is_active
                                ? "bg-emerald-500"
                                : "bg-slate-400"
                                }`}
                            />

                            {unit.is_active ? "Active" : "Inactive"}
                          </span>
                        </td>

                        {(permissions.canUpdate || permissions.canDelete) && (
                          <td className="px-6 py-4">
                            <div className="flex justify-end gap-2">
                              {permissions.canUpdate && (
                                <button
                                  type="button"
                                  onClick={() => startEdit(unit)}
                                  className="inline-flex items-center gap-2 rounded-lg border border-blue-200 bg-white px-3 py-2 text-xs font-semibold text-blue-700 hover:border-blue-300 hover:bg-blue-50 dark:border-blue-900 dark:bg-slate-900 dark:text-blue-300 dark:hover:bg-blue-950/50"
                                  aria-label={`Edit ${unit.unit_name}`}
                                >
                                  <Pencil size={14} />
                                  Edit
                                </button>
                              )}

                              {permissions.canDelete && (
                                <button
                                  type="button"
                                  onClick={() => deleteUnit(unit)}
                                  disabled={deletingId === unit.unit_id}
                                  className="inline-flex items-center gap-2 rounded-lg border border-red-200 bg-white px-3 py-2 text-xs font-semibold text-red-600 hover:border-red-300 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-red-900 dark:bg-slate-900 dark:text-red-300 dark:hover:bg-red-950/40"
                                  aria-label={`Delete ${unit.unit_name}`}
                                >
                                  {deletingId === unit.unit_id ? (
                                    <LoaderCircle
                                      size={14}
                                      className="animate-spin"
                                    />
                                  ) : (
                                    <Trash2 size={14} />
                                  )}

                                  Delete
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

            <div className="flex flex-col justify-between gap-3 px-5 py-4 text-sm sm:flex-row sm:items-center">
              <p className="text-slate-500 dark:text-slate-400">
                Showing{" "}
                <span className="font-semibold text-slate-800 dark:text-slate-100">
                  {filteredUnits.length}
                </span>{" "}
                of{" "}
                <span className="font-semibold text-slate-800 dark:text-slate-100">
                  {units.length}
                </span>{" "}
                units
              </p>

              <div className="flex items-center gap-2 text-xs text-slate-400 dark:text-slate-500">
                <FileSpreadsheet size={15} />
                Inventory master data
              </div>
            </div>
          </section>
        )}

        <footer className="flex items-center justify-center gap-2 pb-2 text-xs text-slate-400 dark:text-slate-500">
          <CheckCircle2 size={14} />
          Unit records are managed through your ERP master data.
        </footer>
      </div>
    </main>
  );
}

function SummaryCard({
  title,
  value,
  description,
  icon: Icon,
  color = "blue",
  loading = false,
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

    amber: {
      icon: "bg-amber-100 text-amber-700",
      glow: "from-amber-500/10",
      bar: "bg-amber-500",
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
            {loading ? (
              <span className="inline-block h-9 w-12 animate-pulse rounded-lg bg-slate-200" />
            ) : (
              value
            )}
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