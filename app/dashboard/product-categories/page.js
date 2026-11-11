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
  FolderOpen,
  Layers3,
  CheckCircle2,
  XCircle,
  Package,
  AlertCircle,
  FileSpreadsheet,
  ArrowRight,
  LoaderCircle,
  Filter,
  Tag,
  FileText,
  Save,
  ChevronRight,
  LockKeyhole,
  ShieldCheck,
} from "lucide-react";

const EMPTY_FORM = {
  category_name: "",
  description: "",
  is_active: true,
};

const NO_PERMISSIONS = {
  canView: false,
  canCreate: false,
  canUpdate: false,
  canDelete: false,
};

const inputClass =
  "w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:placeholder:text-slate-500";

const labelClass =
  "mb-2 block text-sm font-semibold text-slate-700 dark:text-slate-200";

function getErrorMessage(data, fallback) {
  return data?.error || data?.message || fallback;
}

function normalizePermissions(permission) {
  return {
    canView: permission?.can_view === true || permission?.canView === true,
    canCreate:
      permission?.can_create === true || permission?.canCreate === true,
    canUpdate:
      permission?.can_update === true || permission?.canUpdate === true,
    canDelete:
      permission?.can_delete === true || permission?.canDelete === true,
  };
}

export default function ProductCategoriesPage() {
  const [categories, setCategories] = useState([]);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [editingId, setEditingId] = useState(null);
  const [showForm, setShowForm] = useState(false);

  const [permissions, setPermissions] = useState({
    ...NO_PERMISSIONS,
  });
  const [permissionsLoaded, setPermissionsLoaded] = useState(false);
  const [accessDenied, setAccessDenied] = useState(false);

  const [importing, setImporting] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const handleForbidden = useCallback((message) => {
    setAccessDenied(true);
    setCategories([]);
    setShowForm(false);
    setEditingId(null);
    setForm({ ...EMPTY_FORM });
    setPermissions({ ...NO_PERMISSIONS });
    setError(message || "You do not have permission to view product categories.");
  }, []);

  const loadCategories = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const response = await fetch("/api/product-categories", {
        cache: "no-store",
      });

      const data = await response.json().catch(() => []);

      if (response.status === 401) {
        throw Object.assign(
          new Error("Your session has expired. Please sign in again."),
          { status: 401 }
        );
      }

      if (response.status === 403) {
        handleForbidden(
          data?.message ||
          data?.error ||
          "You do not have permission to view product categories."
        );
        return false;
      }

      if (!response.ok) {
        throw new Error(
          getErrorMessage(data, "Could not load product categories.")
        );
      }

      setCategories(Array.isArray(data) ? data : []);
      setAccessDenied(false);
      return true;
    } catch (err) {
      setError(err.message || "Could not load product categories.");

      if (err.status === 401) {
        setCategories([]);
      }

      return false;
    } finally {
      setLoading(false);
    }
  }, [handleForbidden]);

  const loadPermissions = useCallback(async () => {
    setPermissionsLoaded(false);

    try {
      const response = await fetch("/api/auth/my-permissions", {
        cache: "no-store",
      });

      const data = await response.json().catch(() => ({}));

      if (response.status === 401) {
        setPermissions({ ...NO_PERMISSIONS });
        setPermissionsLoaded(true);
        setError("Your session has expired. Please sign in again.");
        return false;
      }

      if (!response.ok) {
        throw new Error(
          getErrorMessage(data, "Unable to load your permissions.")
        );
      }

      const allPermissions = Array.isArray(data.permissions)
        ? data.permissions
        : [];

      const categoryPermission = allPermissions.find((item) => {
        const key = String(item.permission_key || "")
          .trim()
          .toLowerCase()
          .replace(/-/g, "_");

        return key === "product_categories";
      });

      const nextPermissions = normalizePermissions(categoryPermission);

      setPermissions(nextPermissions);
      setPermissionsLoaded(true);

      if (!nextPermissions.canView) {
        handleForbidden(
          "You do not have permission to view product categories. Contact your administrator if you need access."
        );
        return false;
      }

      setAccessDenied(false);
      return true;
    } catch (err) {
      setPermissions({ ...NO_PERMISSIONS });
      setPermissionsLoaded(true);
      setError(err.message || "Unable to load your permissions.");
      return false;
    }
  }, [handleForbidden]);

  const refreshPageData = useCallback(async () => {
    setError("");
    setNotice("");

    const allowed = await loadPermissions();

    if (allowed) {
      await loadCategories();
    } else {
      setLoading(false);
    }
  }, [loadCategories, loadPermissions]);

  useEffect(() => {
    let cancelled = false;

    async function initialize() {
      setLoading(true);

      try {
        const permissionResponse = await fetch("/api/auth/my-permissions", {
          cache: "no-store",
        });

        const permissionData = await permissionResponse
          .json()
          .catch(() => ({}));

        if (cancelled) return;

        if (permissionResponse.status === 401) {
          setPermissions({ ...NO_PERMISSIONS });
          setPermissionsLoaded(true);
          setError("Your session has expired. Please sign in again.");
          setLoading(false);
          return;
        }

        if (!permissionResponse.ok) {
          throw new Error(
            getErrorMessage(
              permissionData,
              "Unable to load your permissions."
            )
          );
        }

        const permissionRows = Array.isArray(permissionData.permissions)
          ? permissionData.permissions
          : [];

        const categoryPermission = permissionRows.find((item) => {
          const key = String(item.permission_key || "")
            .trim()
            .toLowerCase()
            .replace(/-/g, "_");

          return key === "product_categories";
        });

        const nextPermissions = normalizePermissions(categoryPermission);

        setPermissions(nextPermissions);
        setPermissionsLoaded(true);

        if (!nextPermissions.canView) {
          handleForbidden(
            "You do not have permission to view product categories. Contact your administrator if you need access."
          );
          setLoading(false);
          return;
        }

        const response = await fetch("/api/product-categories", {
          cache: "no-store",
        });

        const data = await response.json().catch(() => []);

        if (cancelled) return;

        if (response.status === 403) {
          handleForbidden(
            data?.message ||
            data?.error ||
            "You do not have permission to view product categories."
          );
          return;
        }

        if (response.status === 401) {
          setError("Your session has expired. Please sign in again.");
          setCategories([]);
          return;
        }

        if (!response.ok) {
          throw new Error(
            getErrorMessage(data, "Could not load product categories.")
          );
        }

        setCategories(Array.isArray(data) ? data : []);
        setAccessDenied(false);
        setError("");
      } catch (err) {
        if (!cancelled) {
          setError(err.message || "Could not initialize Product Categories.");
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
  }, [handleForbidden]);

  const activeCount = useMemo(
    () => categories.filter((category) => category.is_active === true).length,
    [categories]
  );

  const inactiveCount = categories.length - activeCount;

  const filteredCategories = useMemo(() => {
    const query = search.trim().toLowerCase();

    return categories.filter((category) => {
      const name = String(category.category_name || "").toLowerCase();
      const description = String(category.description || "").toLowerCase();

      const matchesSearch =
        name.includes(query) || description.includes(query);

      const matchesStatus =
        statusFilter === "all" ||
        (statusFilter === "active" && category.is_active === true) ||
        (statusFilter === "inactive" && category.is_active !== true);

      return matchesSearch && matchesStatus;
    });
  }, [categories, search, statusFilter]);

  function updateField(event) {
    const { name, value, type, checked } = event.target;

    setForm((current) => ({
      ...current,
      [name]: type === "checkbox" ? checked : value,
    }));
  }

  function openAddForm() {
    if (!permissions.canCreate) {
      setError("You do not have permission to create categories.");
      return;
    }

    setForm({ ...EMPTY_FORM });
    setEditingId(null);
    setError("");
    setNotice("");
    setShowForm(true);
  }

  function closeForm() {
    setForm({ ...EMPTY_FORM });
    setEditingId(null);
    setShowForm(false);
    setError("");
  }

  function startEdit(category) {
    if (!permissions.canUpdate) {
      setError("You do not have permission to edit categories.");
      return;
    }

    setEditingId(category.category_id);

    setForm({
      category_name: category.category_name || "",
      description: category.description || "",
      is_active: Boolean(category.is_active),
    });

    setError("");
    setNotice("");
    setShowForm(true);
  }

  async function submitForm(event) {
    event.preventDefault();

    const editing = editingId !== null;
    const allowed = editing ? permissions.canUpdate : permissions.canCreate;

    if (!allowed) {
      setError(
        editing
          ? "You do not have permission to edit categories."
          : "You do not have permission to create categories."
      );
      return;
    }

    setSaving(true);
    setError("");
    setNotice("");

    try {
      const response = await fetch(
        editing
          ? `/api/product-categories/${editingId}`
          : "/api/product-categories",
        {
          method: editing ? "PUT" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(form),
        }
      );

      const data = await response.json().catch(() => ({}));

      if (response.status === 403) {
        handleForbidden(
          data.message || data.error || "You do not have permission."
        );
        return;
      }

      if (!response.ok) {
        throw new Error(
          getErrorMessage(data, "Could not save category.")
        );
      }

      setShowForm(false);
      setForm({ ...EMPTY_FORM });
      setEditingId(null);
      setNotice(
        editing
          ? "Category updated successfully."
          : "Category created successfully."
      );

      await loadCategories();
    } catch (err) {
      setError(err.message || "Could not save category.");
    } finally {
      setSaving(false);
    }
  }

  async function deleteCategory(category) {
    if (!permissions.canDelete) {
      setError("You do not have permission to delete categories.");
      return;
    }

    const confirmed = window.confirm(
      `Delete category "${category.category_name}"?`
    );

    if (!confirmed) return;

    setDeletingId(category.category_id);
    setError("");
    setNotice("");

    try {
      const response = await fetch(
        `/api/product-categories/${category.category_id}`,
        { method: "DELETE", cache: "no-store" }
      );

      const data = await response.json().catch(() => ({}));

      if (response.status === 403) {
        handleForbidden(
          data.message || data.error || "You do not have permission."
        );
        return;
      }

      if (!response.ok) {
        throw new Error(
          getErrorMessage(data, "Could not delete category.")
        );
      }

      if (String(editingId) === String(category.category_id)) {
        closeForm();
      }

      setNotice("Category deleted successfully.");
      await loadCategories();
    } catch (err) {
      setError(err.message || "Could not delete category.");
    } finally {
      setDeletingId(null);
    }
  }

  async function handleExcelImport(event) {
    const input = event.target;

    if (!permissions.canCreate) {
      setError("You do not have permission to import categories.");
      input.value = "";
      return;
    }

    const file = input.files?.[0];
    if (!file) return;

    const extension = file.name.split(".").pop()?.toLowerCase();

    if (!["xlsx", "csv"].includes(extension)) {
      setError("Choose an Excel (.xlsx) or CSV (.csv) file.");
      input.value = "";
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setError("File size cannot exceed 5 MB.");
      input.value = "";
      return;
    }

    const formData = new FormData();
    formData.append("file", file);

    setImporting(true);
    setError("");
    setNotice("");

    try {
      const response = await fetch("/api/product-categories/import", {
        method: "POST",
        body: formData,
      });

      const data = await response.json().catch(() => ({}));

      if (response.status === 403) {
        handleForbidden(
          data.message || data.error || "You do not have permission."
        );
        return;
      }

      if (!response.ok) {
        const details = Array.isArray(data.errors)
          ? `\n${data.errors.join("\n")}`
          : "";

        throw new Error(
          getErrorMessage(data, "Category import failed.") + details
        );
      }

      await loadCategories();

      if (data.errors?.length) {
        setError(
          `Imported ${data.imported ?? 0} categories. Some rows had errors:\n${data.errors.join("\n")}`
        );
      } else {
        setNotice(
          data.message ||
          `Successfully imported ${data.imported ?? 0} categories.`
        );
      }
    } catch (err) {
      setError(err.message || "Category import failed.");
    } finally {
      setImporting(false);
      input.value = "";
    }
  }

  if (!permissionsLoaded || (loading && !accessDenied && !error)) {
    return (
      <main className="flex min-h-[70vh] items-center justify-center bg-slate-50 p-6 dark:bg-slate-950">
        <div className="flex flex-col items-center gap-4 text-center">
          <LoaderCircle size={38} className="animate-spin text-blue-600" />
          <p className="text-sm font-medium text-slate-600 dark:text-slate-300">
            Checking permissions and loading categories...
          </p>
        </div>
      </main>
    );
  }

  if (accessDenied) {
    return (
      <main className="flex min-h-[70vh] items-center justify-center bg-slate-50 p-6 dark:bg-[#070d19]">
        <section className="w-full max-w-lg rounded-3xl border border-rose-200 bg-white p-8 text-center shadow-xl dark:border-rose-900/60 dark:bg-slate-900">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300">
            <LockKeyhole size={30} />
          </div>

          <div className="mt-5 flex items-center justify-center gap-2 text-xs font-bold uppercase tracking-[0.18em] text-rose-600 dark:text-rose-300">
            <ShieldCheck size={15} />
            Restricted Access
          </div>

          <h1 className="mt-3 text-2xl font-bold text-slate-900 dark:text-white">
            Access Denied
          </h1>

          <p className="mt-3 text-sm leading-6 text-slate-600 dark:text-slate-300">
            You do not have permission to view Product Categories. Contact
            your administrator if you need access.
          </p>

          <button
            type="button"
            onClick={refreshPageData}
            className="mt-6 inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-3 text-sm font-bold text-white transition hover:bg-blue-700 focus:outline-none focus:ring-4 focus:ring-blue-500/20"
          >
            <RefreshCw size={16} />
            Check Permission Again
          </button>
        </section>
      </main>
    );
  }

  return (
    <main className="categories-page w-full space-y-7 text-slate-900 dark:text-slate-100">
      <div className="contents">
        <div className="flex flex-col justify-between gap-5 lg:flex-row lg:items-center">
          <div className="flex items-start gap-4">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-600 text-white shadow-lg shadow-blue-600/20">
              <Layers3 size={27} />
            </div>

            <div>
              <div className="mb-1 flex flex-wrap items-center gap-2">
                <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl dark:text-white">
                  Product Categories
                </h1>
                <span className="rounded-full border border-blue-100 bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700 dark:border-blue-900 dark:bg-blue-950/60 dark:text-blue-300">
                  Inventory
                </span>
              </div>

              <p className="max-w-2xl text-sm leading-6 text-slate-500 dark:text-slate-400">
                Organize products into meaningful categories and keep your
                inventory master data consistent.
              </p>

              <div className="mt-3 flex items-center gap-2 text-xs text-slate-400 dark:text-slate-500">
                <span>Product Management</span>
                <ChevronRight size={13} />
                <span className="font-medium text-slate-600 dark:text-slate-300">
                  Categories
                </span>
              </div>
            </div>
          </div>

          {!showForm && (
            <div className="flex flex-wrap items-center gap-3">
              {permissions.canCreate && (
                <>
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

                  <button
                    type="button"
                    onClick={openAddForm}
                    className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-blue-600/20 transition hover:-translate-y-0.5 hover:from-blue-700 hover:to-indigo-700"
                  >
                    <Plus size={18} />
                    Add Category
                  </button>
                </>
              )}
            </div>
          )}
        </div>

        {error && (
          <div
            role="alert"
            className="flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-800 dark:border-red-900/70 dark:bg-red-950/30 dark:text-red-200"
          >
            <AlertCircle size={19} className="mt-0.5 shrink-0" />
            <p className="min-w-0 flex-1 whitespace-pre-line">{error}</p>
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
            <CheckCircle2 size={19} className="mt-0.5 shrink-0" />
            <p className="flex-1">{notice}</p>
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
          <div className="mb-7 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
            <SummaryCard
              title="Total Categories"
              value={categories.length}
              description="All categories in your master list"
              icon={FolderOpen}
              color="blue"
              loading={loading}
            />
            <SummaryCard
              title="Active Categories"
              value={activeCount}
              description="Available for product organization"
              icon={CheckCircle2}
              color="green"
              loading={loading}
            />
            <SummaryCard
              title="Inactive Categories"
              value={inactiveCount}
              description="Currently marked as inactive"
              icon={XCircle}
              color="amber"
              loading={loading}
            />
          </div>
        )}

        {showForm && (
          <form
            onSubmit={submitForm}
            className="overflow-hidden"
          >
            <div className="flex flex-col justify-between gap-4 p-5 sm:flex-row sm:items-center sm:px-7">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-600 text-white">
                  {editingId !== null ? <Pencil size={20} /> : <Plus size={22} />}
                </div>
                <div>
                  <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                    {editingId !== null ? "Edit Category" : "Create a Category"}
                  </h2>
                  <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                    {editingId !== null
                      ? "Update the category information below."
                      : "Add a new category to your product master."}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={closeForm}
                disabled={saving}
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-100 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                <X size={16} />
                Close
              </button>
            </div>

            <div className="space-y-6 p-5 sm:p-7">
              <div className="grid gap-5 md:grid-cols-2">
                <div>
                  <label htmlFor="category_name" className={labelClass}>
                    Category Name <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <Tag
                      size={17}
                      className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
                    />
                    <input
                      id="category_name"
                      className={`${inputClass} pl-10`}
                      name="category_name"
                      value={form.category_name}
                      onChange={updateField}
                      maxLength={100}
                      required
                      placeholder="e.g. Electronics"
                    />
                  </div>
                  <p className="mt-2 text-xs text-slate-400 dark:text-slate-500">
                    Use a clear, recognizable category name.
                  </p>
                </div>

                <div>
                  <label htmlFor="description" className={labelClass}>
                    Description
                  </label>
                  <div className="relative">
                    <FileText
                      size={17}
                      className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
                    />
                    <input
                      id="description"
                      className={`${inputClass} pl-10`}
                      name="description"
                      value={form.description}
                      onChange={updateField}
                      placeholder="Add a short description (optional)"
                    />
                  </div>
                  <p className="mt-2 text-xs text-slate-400 dark:text-slate-500">
                    Describe which products belong in this category.
                  </p>
                </div>
              </div>

              <label className="flex cursor-pointer items-center gap-3 rounded-xl p-4 transition hover:bg-emerald-50/50 dark:hover:bg-emerald-950/20">
                <input
                  type="checkbox"
                  name="is_active"
                  checked={form.is_active}
                  onChange={updateField}
                  className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 dark:border-slate-600 dark:bg-slate-800"
                />
                <div className="flex-1">
                  <span className="block text-sm font-semibold text-slate-800 dark:text-slate-100">
                    Active category
                  </span>
                  <span className="mt-1 block text-xs text-slate-500 dark:text-slate-400">
                    Allow this category to be used in product organization.
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
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-100 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                Cancel
              </button>

              <button
                type="submit"
                disabled={saving}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 px-5 py-3 text-sm font-semibold text-white shadow-md transition hover:from-blue-700 hover:to-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {saving ? (
                  <LoaderCircle size={17} className="animate-spin" />
                ) : (
                  <Save size={17} />
                )}
                {saving
                  ? "Saving..."
                  : editingId !== null
                    ? "Update Category"
                    : "Save Category"}
              </button>
            </div>
          </form>
        )}

        {!showForm && (
          <section className="overflow-hidden">
            <div className="flex flex-col gap-4 p-5 sm:p-6">
              <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
                <div>
                  <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                    Category Master
                  </h2>
                  <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                    View, search, and manage product categories.
                  </p>
                </div>

                <div className="inline-flex w-fit items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-600 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-300">
                  <Package size={14} />
                  {filteredCategories.length}{" "}
                  {filteredCategories.length === 1 ? "record" : "records"}
                </div>
              </div>

              <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_220px_auto]">
                <div className="relative">
                  <Search
                    size={18}
                    className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
                  />
                  <input
                    className={`${inputClass} pl-10`}
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Search by category or description..."
                    aria-label="Search categories"
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
                    className={`${inputClass} appearance-none pl-10 pr-8`}
                    value={statusFilter}
                    onChange={(event) => setStatusFilter(event.target.value)}
                    aria-label="Filter categories by status"
                  >
                    <option value="all">All statuses</option>
                    <option value="active">Active only</option>
                    <option value="inactive">Inactive only</option>
                  </select>
                </div>

                <button
                  type="button"
                  onClick={refreshPageData}
                  disabled={loading}
                  className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:border-blue-800 dark:hover:bg-blue-950/30 dark:hover:text-blue-300"
                >
                  <RefreshCw
                    size={16}
                    className={loading ? "animate-spin" : ""}
                  />
                  Refresh
                </button>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[700px] text-left text-sm">
                <thead className="bg-slate-50 dark:bg-slate-950/70">
                  <tr className="border-b border-slate-200 dark:border-slate-800">
                    <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                      Category
                    </th>
                    <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                      Description
                    </th>
                    <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                      Status
                    </th>
                    <th className="px-6 py-4 text-right text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                      Actions
                    </th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {loading ? (
                    <tr>
                      <td colSpan={4} className="px-6 py-16 text-center">
                        <LoaderCircle
                          size={28}
                          className="mx-auto animate-spin text-blue-600"
                        />
                        <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">
                          Loading categories...
                        </p>
                      </td>
                    </tr>
                  ) : filteredCategories.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-6 py-16 text-center">
                        <div className="mx-auto flex max-w-md flex-col items-center">
                          <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-500">
                            <FolderOpen size={27} />
                          </div>
                          <h3 className="font-semibold text-slate-800 dark:text-slate-100">
                            {search || statusFilter !== "all"
                              ? "No matching categories"
                              : "No categories yet"}
                          </h3>
                          <p className="mt-2 text-sm leading-6 text-slate-500 dark:text-slate-400">
                            {search || statusFilter !== "all"
                              ? "Try changing your search terms or status filter."
                              : "Create your first category to start organizing products."}
                          </p>
                          {!search &&
                            statusFilter === "all" &&
                            categories.length === 0 &&
                            permissions.canCreate && (
                              <button
                                type="button"
                                onClick={openAddForm}
                                className="mt-5 inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700"
                              >
                                <Plus size={17} />
                                Create first category
                                <ArrowRight size={15} />
                              </button>
                            )}
                        </div>
                      </td>
                    </tr>
                  ) : (
                    filteredCategories.map((category) => (
                      <tr
                        key={category.category_id}
                        className="group transition-colors hover:bg-blue-50/50 dark:hover:bg-slate-800/50"
                      >
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-blue-100 to-indigo-100 text-blue-700 transition group-hover:scale-105 dark:from-blue-950 dark:to-indigo-950 dark:text-blue-300">
                              <Tag size={18} />
                            </div>
                            <div>
                              <p className="font-semibold text-slate-900 dark:text-slate-100">
                                {category.category_name}
                              </p>
                              <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">
                                Category ID: {category.category_id}
                              </p>
                            </div>
                          </div>
                        </td>

                        <td className="px-6 py-4">
                          <p className="max-w-md whitespace-pre-line break-words leading-6 text-slate-600 dark:text-slate-300">
                            {category.description || (
                              <span className="italic text-slate-400 dark:text-slate-500">
                                No description provided
                              </span>
                            )}
                          </p>
                        </td>

                        <td className="px-6 py-4">
                          <span
                            className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold ${category.is_active
                                ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/50 dark:text-emerald-300"
                                : "border-slate-200 bg-slate-100 text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
                              }`}
                          >
                            <span
                              className={`h-1.5 w-1.5 rounded-full ${category.is_active
                                  ? "bg-emerald-500"
                                  : "bg-slate-400"
                                }`}
                            />
                            {category.is_active ? "Active" : "Inactive"}
                          </span>
                        </td>

                        <td className="px-6 py-4">
                          <div className="flex justify-end gap-2">
                            {permissions.canUpdate && (
                              <button
                                type="button"
                                onClick={() => startEdit(category)}
                                className="inline-flex items-center gap-2 rounded-lg border border-blue-200 bg-white px-3 py-2 text-xs font-semibold text-blue-700 transition hover:border-blue-300 hover:bg-blue-50 dark:border-blue-900 dark:bg-slate-900 dark:text-blue-300 dark:hover:bg-blue-950/50"
                                aria-label={`Edit ${category.category_name}`}
                              >
                                <Pencil size={14} />
                                Edit
                              </button>
                            )}

                            {permissions.canDelete && (
                              <button
                                type="button"
                                onClick={() => deleteCategory(category)}
                                disabled={deletingId === category.category_id}
                                className="inline-flex items-center gap-2 rounded-lg border border-red-200 bg-white px-3 py-2 text-xs font-semibold text-red-600 transition hover:border-red-300 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-red-900 dark:bg-slate-900 dark:text-red-300 dark:hover:bg-red-950/40"
                                aria-label={`Delete ${category.category_name}`}
                              >
                                {deletingId === category.category_id ? (
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

                            {!permissions.canUpdate &&
                              !permissions.canDelete && (
                                <span className="text-xs text-slate-400">
                                  No actions available
                                </span>
                              )}
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            <div className="flex flex-col justify-between gap-2 px-5 py-4 text-sm sm:flex-row sm:items-center">
              <p className="text-slate-500 dark:text-slate-400">
                Showing{" "}
                <span className="font-semibold text-slate-800 dark:text-slate-100">
                  {filteredCategories.length}
                </span>{" "}
                of{" "}
                <span className="font-semibold text-slate-800 dark:text-slate-100">
                  {categories.length}
                </span>{" "}
                categories
              </p>

              <div className="flex items-center gap-2 text-xs text-slate-400 dark:text-slate-500">
                <FileSpreadsheet size={15} />
                Product category master data
              </div>
            </div>
          </section>
        )}

        <div className="flex items-center justify-center gap-2 pb-2 text-xs text-slate-400 dark:text-slate-500">
          <CheckCircle2 size={14} />
          Product categories are managed from your ERP master data.
        </div>
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