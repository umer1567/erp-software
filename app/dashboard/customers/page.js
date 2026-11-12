
"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
} from "react";

import {
  Plus,
  Search,
  Users,
  Pencil,
  Trash2,
  X,
  ArrowLeft,
  LoaderCircle,
  RefreshCw,
  UserRound,
  Phone,
  Mail,
  MapPin,
  Wallet,
  CheckCircle2,
  XCircle,
  Building2,
  UserPlus,
  TrendingUp,
  ArrowUpRight,
  ChevronDown,
  ShieldCheck,
  CreditCard,
  Sparkles,
  CircleDollarSign,
  LockKeyhole,
  Columns3,
} from "lucide-react";

const PERMISSION_KEY = "customers";
const COLUMN_STORAGE_KEY = "customers.columns.v1";

const emptyForm = {
  customerCode: "",
  customerName: "",
  phone: "",
  email: "",
  address: "",
  openingBalance: "",
  creditLimit: "",
  isActive: true,
};

const inputClass =
  "w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 hover:border-slate-300 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 dark:border-slate-700 dark:bg-slate-900 dark:text-white dark:placeholder:text-slate-500 dark:hover:border-slate-600 dark:focus:border-blue-500";

const labelClass =
  "mb-2 block text-sm font-semibold text-slate-700 dark:text-slate-300";

const CUSTOMER_COLUMNS = [
  { key: "customer", label: "Customer" },
  { key: "contact", label: "Contact Details" },
  { key: "sales", label: "Sales" },
  { key: "paid", label: "Paid" },
  { key: "balance", label: "Balance" },
  { key: "status", label: "Status" },
  { key: "actions", label: "Actions" },
];

const DEFAULT_CUSTOMER_COLUMNS = Object.fromEntries(
  CUSTOMER_COLUMNS.map(({ key }) => [key, true])
);

/* =========================================================
   CUSTOMER COLUMN VISIBILITY STORE
========================================================= */

const customerColumnListeners = new Set();

function subscribeCustomerColumns(callback) {
  customerColumnListeners.add(callback);
  window.addEventListener("storage", callback);

  return () => {
    customerColumnListeners.delete(callback);
    window.removeEventListener("storage", callback);
  };
}

function getCustomerColumnsSnapshot() {
  try {
    return window.localStorage.getItem(COLUMN_STORAGE_KEY) || "";
  } catch {
    return "";
  }
}

function getCustomerColumnsServerSnapshot() {
  return "";
}

function saveCustomerColumns(value) {
  try {
    window.localStorage.setItem(
      COLUMN_STORAGE_KEY,
      JSON.stringify(value)
    );
  } catch (error) {
    console.error(
      "Unable to save customer column preferences:",
      error
    );
  }

  customerColumnListeners.forEach((listener) => listener());
}

function parseCustomerColumns(raw) {
  let parsed = {};

  if (raw) {
    try {
      const result = JSON.parse(raw);

      if (
        result &&
        typeof result === "object" &&
        !Array.isArray(result)
      ) {
        parsed = result;
      }
    } catch {
      parsed = {};
    }
  }

  const visible = Object.fromEntries(
    CUSTOMER_COLUMNS.map(({ key }) => [
      key,
      parsed[key] !== false,
    ])
  );

  if (
    !CUSTOMER_COLUMNS.some(
      ({ key }) => visible[key] !== false
    )
  ) {
    visible[CUSTOMER_COLUMNS[0].key] = true;
  }

  return visible;
}

function useCustomerColumnVisibility() {
  const raw = useSyncExternalStore(
    subscribeCustomerColumns,
    getCustomerColumnsSnapshot,
    getCustomerColumnsServerSnapshot
  );

  const visible = useMemo(
    () => parseCustomerColumns(raw),
    [raw]
  );

  const toggleColumn = useCallback((key) => {
    const validColumn = CUSTOMER_COLUMNS.some(
      (column) => column.key === key
    );

    if (!validColumn) return;

    const current = parseCustomerColumns(
      getCustomerColumnsSnapshot()
    );

    const visibleCount = CUSTOMER_COLUMNS.filter(
      (column) => current[column.key] !== false
    ).length;

    if (current[key] !== false && visibleCount <= 1) {
      return;
    }

    const next = {
      ...current,
      [key]: current[key] === false,
    };

    saveCustomerColumns(next);
  }, []);

  const resetColumns = useCallback(() => {
    saveCustomerColumns({
      ...DEFAULT_CUSTOMER_COLUMNS,
    });
  }, []);

  const visibleColumnCount = CUSTOMER_COLUMNS.filter(
    (column) => visible[column.key] !== false
  ).length;

  return {
    visible,
    toggleColumn,
    resetColumns,
    visibleColumnCount,
  };
}

/* =========================================================
   GENERAL HELPERS
========================================================= */

function formatAmount(value) {
  const amount = Number(value ?? 0);

  return (Number.isFinite(amount) ? amount : 0).toLocaleString(
    "en-PK",
    {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }
  );
}

function formatCount(value) {
  return (Number(value) || 0).toLocaleString("en-PK");
}

function getErrorMessage(data, fallback) {
  return data?.error || data?.message || fallback;
}

async function readResponse(response) {
  const text = await response.text();

  let data = {};

  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      throw new Error(
        `Invalid server response (HTTP ${response.status}).`
      );
    }
  }

  if (!response.ok || data.success === false) {
    throw new Error(
      getErrorMessage(
        data,
        `Request failed (HTTP ${response.status}).`
      )
    );
  }

  return data;
}

function normalizePermission(data) {
  const permission =
    data?.permission ||
    (Array.isArray(data?.permissions)
      ? data.permissions.find(
        (item) =>
          item.permission_key === PERMISSION_KEY ||
          item.permissionKey === PERMISSION_KEY
      )
      : null) ||
    data;

  if (!permission || typeof permission !== "object") {
    return null;
  }

  const hasPermissionFields =
    "can_view" in permission ||
    "can_create" in permission ||
    "can_update" in permission ||
    "can_delete" in permission ||
    "canView" in permission ||
    "canCreate" in permission ||
    "canUpdate" in permission ||
    "canDelete" in permission;

  if (!hasPermissionFields) return null;

  return {
    canView:
      (permission.can_view ?? permission.canView) === true,
    canCreate:
      (permission.can_create ?? permission.canCreate) === true,
    canUpdate:
      (permission.can_update ?? permission.canUpdate) === true,
    canDelete:
      (permission.can_delete ?? permission.canDelete) === true,
  };
}

/* =========================================================
   COLUMN VISIBILITY MENU
========================================================= */

function ColumnVisibilityMenu({
  columns,
  visible,
  visibleCount,
  onToggle,
  onReset,
}) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;

    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        setOpen(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  return (
    <div className="relative z-50">
      <button
        type="button"
        onClick={() => setOpen((previous) => !previous)}
        aria-expanded={open}
        aria-label="Choose visible columns"
        className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
      >
        <Columns3 className="h-4 w-4" />
        Columns

        <ChevronDown
          className={`h-4 w-4 transition-transform ${open ? "rotate-180" : ""
            }`}
        />
      </button>

      {open && (
        <>
          {/* Click outside to close */}
          <button
            type="button"
            aria-label="Close column menu"
            onClick={() => setOpen(false)}
            className="fixed inset-0 z-[90] cursor-default"
          />

          <div className="absolute right-0 top-full z-[100] mt-2 w-72 max-w-[calc(100vw-2rem)] rounded-2xl border border-slate-200 bg-white p-3 shadow-2xl ring-1 ring-black/5 dark:border-slate-700 dark:bg-slate-900">
            {/* HEADER */}
            <div className="mb-2 flex items-center justify-between gap-2 border-b border-slate-100 pb-3 dark:border-slate-800">
              <div>
                <p className="text-sm font-bold text-slate-800 dark:text-white">
                  Table Columns
                </p>

                <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                  {visibleCount} of {columns.length} visible
                </p>
              </div>

              {onReset && (
                <button
                  type="button"
                  onClick={onReset}
                  className="shrink-0 rounded-lg px-2 py-1.5 text-xs font-semibold text-blue-600 transition hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-500/10"
                >
                  Show All
                </button>
              )}
            </div>

            {/* COLUMN OPTIONS */}
            <div className="max-h-64 space-y-1 overflow-y-auto overscroll-contain pr-1">
              {columns.map((column) => {
                const checked = visible[column.key] !== false;
                const isLastVisible = checked && visibleCount === 1;

                return (
                  <label
                    key={column.key}
                    aria-disabled={isLastVisible}
                    title={isLastVisible ? "At least one column must stay visible" : undefined}
                    className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition ${isLastVisible
                        ? "cursor-default bg-blue-50 hover:bg-blue-100 dark:bg-blue-500/10 dark:hover:bg-blue-500/20"
                        : "cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800"
                      }`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => {
                        // The last visible column can't be hidden
                        if (!isLastVisible) onToggle(column.key);
                      }}
                      className="h-4 w-4 cursor-pointer accent-blue-600"
                    />

                    <span
                      className={`font-medium ${isLastVisible
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
        </>
      )}
    </div>
  );
}

/* =========================================================
   STAT CARD
========================================================= */

function StatCard({
  title,
  value,
  description,
  icon: Icon,
  color,
  accent,
}) {
  return (
    <div className="group relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition duration-300 hover:-translate-y-1 hover:shadow-lg dark:border-slate-800 dark:bg-slate-900">
      <div className={`absolute inset-x-0 top-0 h-1 ${accent}`} />

      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
            {title}
          </p>

          <p className="mt-3 break-words text-2xl font-bold tracking-tight text-slate-900 dark:text-white sm:text-3xl">
            {value}
          </p>

          <p className="mt-2 text-xs leading-5 text-slate-500 dark:text-slate-400">
            {description}
          </p>
        </div>

        <div
          className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl transition group-hover:scale-110 ${color}`}
        >
          <Icon className="h-6 w-6" />
        </div>
      </div>
    </div>
  );
}

/* =========================================================
   STATUS BADGE
========================================================= */

function StatusBadge({ active }) {
  return active ? (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-300">
      <span className="h-2 w-2 rounded-full bg-emerald-500" />
      Active
    </span>
  ) : (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border border-slate-200 bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
      <span className="h-2 w-2 rounded-full bg-slate-400" />
      Inactive
    </span>
  );
}

/* =========================================================
   CUSTOMER AVATAR
========================================================= */

function CustomerAvatar({ name }) {
  const initials = String(name || "Customer")
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("");

  return (
    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 text-sm font-bold text-white shadow-sm shadow-blue-600/20">
      {initials || "C"}
    </div>
  );
}

/* =========================================================
   LOADING STATE
========================================================= */

function LoadingState() {
  return (
    <div className="space-y-6 p-4 sm:p-6 lg:p-8">
      <div className="h-52 animate-pulse rounded-3xl bg-slate-200 dark:bg-slate-800" />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {[1, 2, 3].map((item) => (
          <div
            key={item}
            className="h-32 animate-pulse rounded-2xl bg-slate-200 dark:bg-slate-800"
          />
        ))}
      </div>

      <div className="h-96 animate-pulse rounded-2xl bg-slate-200 dark:bg-slate-800" />

      <p className="text-center text-sm text-slate-500 dark:text-slate-400">
        Loading customer management...
      </p>
    </div>
  );
}

/* =========================================================
   ACCESS DENIED
========================================================= */

function AccessDenied({ message, loading, onRetry }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 p-4 dark:bg-slate-950">
      <section className="w-full max-w-lg rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-xl dark:border-slate-800 dark:bg-slate-900 sm:p-10">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-red-50 text-red-600 dark:bg-red-950/40 dark:text-red-300">
          {loading ? (
            <LoaderCircle className="h-8 w-8 animate-spin" />
          ) : (
            <LockKeyhole className="h-8 w-8" />
          )}
        </div>

        <h1 className="mt-5 text-2xl font-bold text-slate-900 dark:text-white">
          {loading ? "Checking Permissions" : "Access Restricted"}
        </h1>

        <p className="mt-3 text-sm leading-6 text-slate-600 dark:text-slate-400">
          {loading
            ? "Checking your customer management permissions. Please wait."
            : message ||
            "You do not have permission to view the Customers page. Contact your administrator if you need access."}
        </p>

        {!loading && onRetry && (
          <button
            type="button"
            onClick={onRetry}
            className="mt-6 inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-blue-700"
          >
            <RefreshCw className="h-4 w-4" />
            Retry
          </button>
        )}
      </section>
    </main>
  );
}

/* =========================================================
   CUSTOMERS PAGE
========================================================= */

export default function CustomersPage() {
  const [customers, setCustomers] = useState([]);
  const [form, setForm] = useState(emptyForm);

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState(null);

  const [permission, setPermission] = useState(null);
  const [permissionLoading, setPermissionLoading] = useState(true);
  const [permissionError, setPermissionError] = useState("");

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const {
    visible: visibleColumns,
    toggleColumn,
    resetColumns,
    visibleColumnCount,
  } = useCustomerColumnVisibility();

  const canView = permission?.canView === true;
  const canCreate = permission?.canCreate === true;
  const canUpdate = permission?.canUpdate === true;
  const canDelete = permission?.canDelete === true;

  /* =======================================================
     LOAD PERMISSIONS
  ======================================================= */

  const loadPermission = useCallback(async () => {
    setPermissionLoading(true);
    setPermissionError("");
    setPermission(null);

    try {
      const response = await fetch("/api/auth/my-permissions", {
        method: "GET",
        cache: "no-store",
        headers: {
          Accept: "application/json",
        },
      });

      const data = await readResponse(response);
      const normalized = normalizePermission(data);

      if (!normalized) {
        throw new Error(
          'Customers permission was not found. Verify that the permission key is "customers" and is assigned to your role.'
        );
      }

      setPermission(normalized);
    } catch (err) {
      setPermission(null);
      setPermissionError(
        err.message || "Unable to load customer permissions."
      );
    } finally {
      setPermissionLoading(false);
    }
  }, []);

  useEffect(() => {
  let isMounted = true;

  const initializePermissions = async () => {
    if (!isMounted) return;

    await loadPermission();
  };

  initializePermissions();

  return () => {
    isMounted = false;
  };
}, [loadPermission]);

  /* =======================================================
     LOAD CUSTOMERS AFTER VIEW PERMISSION
  ======================================================= */

  useEffect(() => {
    if (permissionLoading || !canView) return;

    const controller = new AbortController();

    async function fetchCustomers() {
      setLoading(true);
      setError("");

      try {
        const response = await fetch("/api/customers", {
          method: "GET",
          cache: "no-store",
          headers: {
            Accept: "application/json",
          },
          signal: controller.signal,
        });

        const data = await readResponse(response);

        if (!controller.signal.aborted) {
          setCustomers(
            Array.isArray(data.customers)
              ? data.customers
              : []
          );
        }
      } catch (err) {
        if (!controller.signal.aborted) {
          setError(err.message || "Failed to load customers.");
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    }

    fetchCustomers();

    return () => controller.abort();
  }, [permissionLoading, canView]);

  /* =======================================================
     MANUAL REFRESH
  ======================================================= */

  const loadCustomers = useCallback(async () => {
    if (!canView) {
      setError("You do not have permission to view customers.");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const response = await fetch("/api/customers", {
        method: "GET",
        cache: "no-store",
        headers: {
          Accept: "application/json",
        },
      });

      const data = await readResponse(response);

      setCustomers(
        Array.isArray(data.customers)
          ? data.customers
          : []
      );
    } catch (err) {
      setError(err.message || "Failed to load customers.");
    } finally {
      setLoading(false);
    }
  }, [canView]);

  /* =======================================================
     FORM HANDLERS
  ======================================================= */

  function handleChange(event) {
    const { name, value, type, checked } = event.target;

    setForm((current) => ({
      ...current,
      [name]: type === "checkbox" ? checked : value,
    }));

    setError("");
    setSuccess("");
  }

  function openAddForm() {
    if (!canCreate) {
      setError("You do not have permission to create customers.");
      return;
    }

    setForm({ ...emptyForm });
    setEditingId(null);
    setError("");
    setSuccess("");
    setShowForm(true);

    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  }

  function editCustomer(customer) {
    if (!canUpdate) {
      setError("You do not have permission to edit customers.");
      return;
    }

    setEditingId(customer.customer_id);

    setForm({
      customerCode: customer.customer_code ?? "",
      customerName: customer.customer_name ?? "",
      phone: customer.phone ?? "",
      email: customer.email ?? "",
      address: customer.address ?? "",
      openingBalance: customer.opening_balance ?? "",
      creditLimit: customer.credit_limit ?? "",
      isActive: customer.is_active !== false,
    });

    setError("");
    setSuccess("");
    setShowForm(true);

    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  }

  function closeForm() {
    if (saving) return;

    setShowForm(false);
    setEditingId(null);
    setForm({ ...emptyForm });
    setError("");
    setSuccess("");
  }

  /* =======================================================
     SAVE CUSTOMER
  ======================================================= */

  async function saveCustomer(event) {
    event.preventDefault();

    if (saving) return;

    if (editingId && !canUpdate) {
      setError("You do not have permission to edit customers.");
      return;
    }

    if (!editingId && !canCreate) {
      setError("You do not have permission to create customers.");
      return;
    }

    const openingBalance =
      form.openingBalance === ""
        ? 0
        : Number(form.openingBalance);

    const creditLimit =
      form.creditLimit === ""
        ? 0
        : Number(form.creditLimit);

    if (
      !Number.isFinite(openingBalance) ||
      !Number.isFinite(creditLimit) ||
      openingBalance < 0 ||
      creditLimit < 0
    ) {
      setError(
        "Opening balance and credit limit must be valid non-negative numbers."
      );
      return;
    }

    if (
      !form.customerCode.trim() ||
      !form.customerName.trim()
    ) {
      setError(
        "Customer code and customer name are required."
      );
      return;
    }

    setSaving(true);
    setError("");
    setSuccess("");

    try {
      const isEditing = Boolean(editingId);

      const url = isEditing
        ? `/api/customers/${editingId}`
        : "/api/customers";

      const response = await fetch(url, {
        method: isEditing ? "PUT" : "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          ...form,
          customerCode: form.customerCode.trim(),
          customerName: form.customerName.trim(),
          phone: form.phone.trim(),
          email: form.email.trim(),
          address: form.address.trim(),
          openingBalance,
          creditLimit,
        }),
      });

      const data = await readResponse(response);

      if (!data.customer) {
        throw new Error(
          "The API did not return the saved customer."
        );
      }

      if (isEditing) {
        setCustomers((current) =>
          current.map((customer) =>
            String(customer.customer_id) === String(editingId)
              ? { ...customer, ...data.customer }
              : customer
          )
        );

        setSuccess("Customer updated successfully.");
      } else {
        setCustomers((current) => [
          data.customer,
          ...current.filter(
            (customer) =>
              String(customer.customer_id) !==
              String(data.customer.customer_id)
          ),
        ]);

        setSuccess("Customer added successfully.");
      }

      setShowForm(false);
      setEditingId(null);
      setForm({ ...emptyForm });
    } catch (err) {
      setError(err.message || "Failed to save customer.");
    } finally {
      setSaving(false);
    }
  }

  /* =======================================================
     DELETE CUSTOMER
  ======================================================= */

  async function deleteCustomer(id) {
    if (!canDelete) {
      setError("You do not have permission to delete customers.");
      return;
    }

    if (deletingId !== null) return;

    const customer = customers.find(
      (item) => String(item.customer_id) === String(id)
    );

    const confirmed = window.confirm(
      `Delete customer "${customer?.customer_name || "this customer"}"?`
    );

    if (!confirmed) return;

    setDeletingId(id);
    setError("");
    setSuccess("");

    try {
      const response = await fetch(`/api/customers/${id}`, {
        method: "DELETE",
        headers: {
          Accept: "application/json",
        },
      });

      await readResponse(response);

      setCustomers((current) =>
        current.filter(
          (item) => String(item.customer_id) !== String(id)
        )
      );

      setSuccess("Customer deleted successfully.");
    } catch (err) {
      setError(err.message || "Failed to delete customer.");
    } finally {
      setDeletingId(null);
    }
  }

  /* =======================================================
     FILTER CUSTOMERS
  ======================================================= */

  const filteredCustomers = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();

    return customers.filter((customer) => {
      const matchesSearch = [
        customer.customer_code,
        customer.customer_name,
        customer.phone,
        customer.email,
        customer.address,
      ].some((value) =>
        String(value ?? "")
          .toLowerCase()
          .includes(normalizedSearch)
      );

      const matchesStatus =
        statusFilter === "all" ||
        (statusFilter === "active" &&
          customer.is_active === true) ||
        (statusFilter === "inactive" &&
          customer.is_active !== true);

      return matchesSearch && matchesStatus;
    });
  }, [customers, search, statusFilter]);

  /* =======================================================
     CUSTOMER STATISTICS
  ======================================================= */

  const activeCount = customers.filter(
    (customer) => customer.is_active === true
  ).length;

  const inactiveCount = customers.length - activeCount;

  const totalBalance = customers.reduce(
    (total, customer) =>
      total + (Number(customer.customer_balance) || 0),
    0
  );

  const totalSales = customers.reduce(
    (total, customer) =>
      total + (Number(customer.total_sales) || 0),
    0
  );

  /* =======================================================
     PERMISSION SCREEN
  ======================================================= */

  if (permissionLoading) {
    return <AccessDenied loading />;
  }

  if (permissionError || !canView) {
    return (
      <AccessDenied
        message={
          permissionError ||
          "You do not have permission to view the Customers page. Contact your administrator."
        }
        onRetry={loadPermission}
      />
    );
  }

  /* =======================================================
     MAIN PAGE
  ======================================================= */

  return (
    <main className="min-h-screen min-w-0 overflow-x-hidden bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      <div className="mx-auto w-full max-w-[1700px] min-w-0 space-y-6 p-4 sm:p-6 lg:space-y-8 lg:p-8">

        {/* HEADER */}

        <header className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-blue-700 via-indigo-700 to-violet-800 p-6 text-white shadow-xl shadow-indigo-900/10 sm:p-8">
          <div className="pointer-events-none absolute -right-16 -top-24 h-72 w-72 rounded-full bg-white/10 blur-2xl" />

          <div className="pointer-events-none absolute -bottom-32 right-1/3 h-64 w-64 rounded-full bg-cyan-300/20 blur-3xl" />

          <div className="relative flex flex-col justify-between gap-6 xl:flex-row xl:items-center">
            <div className="flex min-w-0 items-start gap-4">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-white/20 bg-white/15 shadow-inner backdrop-blur-sm sm:h-16 sm:w-16">
                <Users className="h-7 w-7 sm:h-8 sm:w-8" />
              </div>

              <div className="min-w-0">
                <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs font-medium text-blue-50">
                  <Sparkles className="h-3.5 w-3.5" />
                  Customer Relationship Management
                </div>

                <h1 className="text-2xl font-bold tracking-tight sm:text-3xl lg:text-4xl">
                  Customers
                </h1>

                <p className="mt-2 max-w-2xl text-sm leading-6 text-blue-100 sm:text-base">
                  Manage your customer directory, contact information,
                  account balances, and credit limits in one place.
                </p>
              </div>
            </div>

            <div className="relative flex flex-wrap items-center gap-3">
              {!showForm ? (
                <>
                  <button
                    type="button"
                    onClick={loadCustomers}
                    disabled={loading}
                    className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/25 bg-white/10 px-4 py-3 text-sm font-semibold text-white transition hover:bg-white/20 disabled:opacity-60"
                  >
                    <RefreshCw
                      className={`h-4 w-4 ${loading ? "animate-spin" : ""
                        }`}
                    />
                    Refresh
                  </button>

                  {canCreate && (
                    <button
                      type="button"
                      onClick={openAddForm}
                      className="inline-flex items-center justify-center gap-2 rounded-xl bg-white px-5 py-3 text-sm font-bold text-indigo-800 shadow-lg transition hover:-translate-y-0.5 hover:bg-blue-50"
                    >
                      <UserPlus className="h-4 w-4" />
                      Add Customer
                    </button>
                  )}
                </>
              ) : (
                <button
                  type="button"
                  onClick={closeForm}
                  disabled={saving}
                  className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/25 bg-white/10 px-4 py-3 text-sm font-semibold text-white transition hover:bg-white/20 disabled:opacity-60"
                >
                  <ArrowLeft className="h-4 w-4" />
                  Back to Customers
                </button>
              )}
            </div>
          </div>

          <div className="relative mt-7 grid grid-cols-1 gap-4 border-t border-white/20 pt-5 sm:grid-cols-3">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/10">
                <Users className="h-5 w-5 text-blue-100" />
              </div>

              <div>
                <p className="text-xs text-blue-100">
                  Total customers
                </p>

                <p className="mt-0.5 text-lg font-bold">
                  {formatCount(customers.length)}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/10">
                <ShieldCheck className="h-5 w-5 text-emerald-200" />
              </div>

              <div>
                <p className="text-xs text-blue-100">
                  Active accounts
                </p>

                <p className="mt-0.5 text-lg font-bold">
                  {formatCount(activeCount)}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/10">
                <Building2 className="h-5 w-5 text-blue-100" />
              </div>

              <div>
                <p className="text-xs text-blue-100">
                  Inactive accounts
                </p>

                <p className="mt-0.5 text-lg font-bold">
                  {formatCount(inactiveCount)}
                </p>
              </div>
            </div>
          </div>
        </header>

        {/* ALERTS */}

        {error && (
          <div
            role="alert"
            className="flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-800 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-300"
          >
            <XCircle className="mt-0.5 h-5 w-5 shrink-0" />

            <p className="flex-1 break-words">{error}</p>

            <button
              type="button"
              onClick={() => setError("")}
              aria-label="Dismiss error"
              className="rounded-lg p-1 transition hover:bg-red-100 dark:hover:bg-red-900/40"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        {success && (
          <div
            role="status"
            className="flex items-start gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800 dark:border-emerald-900/60 dark:bg-emerald-950/30 dark:text-emerald-300"
          >
            <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" />

            <p className="flex-1 break-words">{success}</p>

            <button
              type="button"
              onClick={() => setSuccess("")}
              aria-label="Dismiss success message"
              className="rounded-lg p-1 transition hover:bg-emerald-100 dark:hover:bg-emerald-900/40"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        {/* LOADING / FORM / DIRECTORY */}

        {loading && customers.length === 0 && !showForm ? (
          <LoadingState />
        ) : showForm ? (

          /* ADD / EDIT FORM */

          <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <div className="border-b border-slate-200 bg-gradient-to-r from-blue-50 to-indigo-50 px-5 py-6 dark:border-slate-800 dark:from-slate-900 dark:to-indigo-950/30 sm:px-8">
              <div className="flex items-center gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-600 text-white shadow-lg shadow-blue-600/20">
                  {editingId ? (
                    <Pencil className="h-5 w-5" />
                  ) : (
                    <UserPlus className="h-5 w-5" />
                  )}
                </div>

                <div>
                  <h2 className="text-xl font-bold text-slate-900 dark:text-white">
                    {editingId ? "Edit Customer" : "Create Customer"}
                  </h2>

                  <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                    {editingId
                      ? "Update customer details and account settings."
                      : "Add a new customer to your ERP customer directory."}
                  </p>
                </div>
              </div>
            </div>

            <form onSubmit={saveCustomer} className="p-5 sm:p-8">
              <div className="mb-6 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.16em] text-blue-600 dark:text-blue-400">
                <UserRound className="h-4 w-4" />
                Basic Information
              </div>

              <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
                <div>
                  <label htmlFor="customerCode" className={labelClass}>
                    Customer Code <span className="text-red-500">*</span>
                  </label>

                  <input
                    id="customerCode"
                    name="customerCode"
                    value={form.customerCode}
                    onChange={handleChange}
                    placeholder="CUS-001"
                    className={inputClass}
                    maxLength={100}
                    required
                  />
                </div>

                <div>
                  <label htmlFor="customerName" className={labelClass}>
                    Customer Name <span className="text-red-500">*</span>
                  </label>

                  <input
                    id="customerName"
                    name="customerName"
                    value={form.customerName}
                    onChange={handleChange}
                    placeholder="Enter customer name"
                    className={inputClass}
                    maxLength={200}
                    required
                  />
                </div>

                <div>
                  <label htmlFor="phone" className={labelClass}>
                    Phone Number
                  </label>

                  <div className="relative">
                    <Phone className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />

                    <input
                      id="phone"
                      name="phone"
                      type="tel"
                      value={form.phone}
                      onChange={handleChange}
                      placeholder="03XX XXXXXXX"
                      className={`${inputClass} pl-10`}
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="email" className={labelClass}>
                    Email Address
                  </label>

                  <div className="relative">
                    <Mail className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />

                    <input
                      id="email"
                      name="email"
                      type="email"
                      value={form.email}
                      onChange={handleChange}
                      placeholder="customer@example.com"
                      className={`${inputClass} pl-10`}
                    />
                  </div>
                </div>

                <div className="md:col-span-2 xl:col-span-1">
                  <label htmlFor="address" className={labelClass}>
                    Address
                  </label>

                  <div className="relative">
                    <MapPin className="pointer-events-none absolute left-3.5 top-3.5 h-4 w-4 text-slate-400" />

                    <textarea
                      id="address"
                      name="address"
                      value={form.address}
                      onChange={handleChange}
                      rows={3}
                      maxLength={1000}
                      placeholder="Street, city, or business address"
                      className={`${inputClass} resize-y pl-10`}
                    />
                  </div>
                </div>
              </div>

              <div className="mb-6 mt-9 flex items-center gap-2 border-t border-slate-100 pt-7 text-xs font-bold uppercase tracking-[0.16em] text-blue-600 dark:border-slate-800 dark:text-blue-400">
                <CreditCard className="h-4 w-4" />
                Financial Information
              </div>

              <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
                <div>
                  <label htmlFor="openingBalance" className={labelClass}>
                    Opening Balance
                  </label>

                  <div className="relative">
                    <CircleDollarSign className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />

                    <input
                      id="openingBalance"
                      name="openingBalance"
                      type="number"
                      min="0"
                      step="0.01"
                      value={form.openingBalance}
                      onChange={handleChange}
                      placeholder="0.00"
                      className={`${inputClass} pl-10`}
                    />
                  </div>

                  <p className="mt-1.5 text-xs text-slate-500 dark:text-slate-400">
                    Initial balance for this customer.
                  </p>
                </div>

                <div>
                  <label htmlFor="creditLimit" className={labelClass}>
                    Credit Limit
                  </label>

                  <div className="relative">
                    <Wallet className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />

                    <input
                      id="creditLimit"
                      name="creditLimit"
                      type="number"
                      min="0"
                      step="0.01"
                      value={form.creditLimit}
                      onChange={handleChange}
                      placeholder="0.00"
                      className={`${inputClass} pl-10`}
                    />
                  </div>

                  <p className="mt-1.5 text-xs text-slate-500 dark:text-slate-400">
                    Maximum credit allowed for this customer.
                  </p>
                </div>

                <div className="flex items-center">
                  <label className="flex w-full cursor-pointer items-start gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 transition hover:border-blue-200 dark:border-slate-700 dark:bg-slate-800/60 dark:hover:border-blue-800">
                    <input
                      type="checkbox"
                      name="isActive"
                      checked={form.isActive}
                      onChange={handleChange}
                      className="mt-1 h-4 w-4 rounded border-slate-300 accent-blue-600"
                    />

                    <span>
                      <span className="block text-sm font-semibold text-slate-800 dark:text-white">
                        Active Customer
                      </span>

                      <span className="mt-1 block text-xs leading-5 text-slate-500 dark:text-slate-400">
                        Enable this customer for normal ERP operations.
                      </span>
                    </span>
                  </label>
                </div>
              </div>

              <div className="mt-9 flex flex-col-reverse gap-3 border-t border-slate-100 pt-6 dark:border-slate-800 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={closeForm}
                  disabled={saving}
                  className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
                >
                  <X className="h-4 w-4" />
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={
                    saving ||
                    (editingId ? !canUpdate : !canCreate)
                  }
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-3 text-sm font-bold text-white shadow-lg shadow-blue-600/20 transition hover:from-blue-700 hover:to-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {saving ? (
                    <LoaderCircle className="h-4 w-4 animate-spin" />
                  ) : (
                    <CheckCircle2 className="h-4 w-4" />
                  )}

                  {saving
                    ? "Saving..."
                    : editingId
                      ? "Update Customer"
                      : "Save Customer"}
                </button>
              </div>
            </form>
          </section>
        ) : (

          /* CUSTOMER DIRECTORY */

          <>
            {/* SUMMARY */}

            <section>
              <div className="mb-4">
                <h2 className="text-lg font-bold text-slate-900 dark:text-white sm:text-xl">
                  Customer Overview
                </h2>

                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                  A quick snapshot of your customer accounts and balances.
                </p>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <StatCard
                  title="Total Customers"
                  value={formatCount(customers.length)}
                  description="All customer records"
                  icon={Users}
                  color="bg-blue-50 text-blue-600 dark:bg-blue-950/50 dark:text-blue-300"
                  accent="bg-blue-500"
                />

                <StatCard
                  title="Active Customers"
                  value={formatCount(activeCount)}
                  description="Accounts currently active"
                  icon={CheckCircle2}
                  color="bg-emerald-50 text-emerald-600 dark:bg-emerald-950/50 dark:text-emerald-300"
                  accent="bg-emerald-500"
                />

                <StatCard
                  title="Customer Balance"
                  value={formatAmount(totalBalance)}
                  description="Combined balance from customer records"
                  icon={Wallet}
                  color="bg-amber-50 text-amber-600 dark:bg-amber-950/50 dark:text-amber-300"
                  accent="bg-amber-500"
                />

                <StatCard
                  title="Total Sales"
                  value={formatAmount(totalSales)}
                  description="Combined recorded customer sales"
                  icon={TrendingUp}
                  color="bg-violet-50 text-violet-600 dark:bg-violet-950/50 dark:text-violet-300"
                  accent="bg-violet-500"
                />
              </div>
            </section>

            {/* CUSTOMER DIRECTORY */}

            <section className="relative z-20 overflow-visible rounded-3xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <div className="relative z-30 border-b border-slate-200 p-5 dark:border-slate-800 sm:p-6">
                <div className="flex flex-col justify-between gap-4 xl:flex-row xl:items-center">
                  <div className="flex items-center gap-3">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-50 dark:bg-blue-950/50">
                      <Users className="h-5 w-5 text-blue-600 dark:text-blue-300" />
                    </div>

                    <div>
                      <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                        Customer Directory
                      </h2>

                      <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">
                        Search and manage your customer records.
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
                      {filteredCustomers.length} of {customers.length} records
                    </span>

                    <button
                      type="button"
                      onClick={loadCustomers}
                      disabled={loading}
                      className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
                    >
                      <RefreshCw
                        className={`h-4 w-4 ${loading ? "animate-spin" : ""
                          }`}
                      />
                      Refresh
                    </button>

                    {canCreate && (
                      <button
                        type="button"
                        onClick={openAddForm}
                        className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-blue-700"
                      >
                        <Plus className="h-4 w-4" />
                        Add Customer
                      </button>
                    )}

                    <ColumnVisibilityMenu
                      columns={CUSTOMER_COLUMNS}
                      visible={visibleColumns}
                      visibleCount={visibleColumnCount}
                      onToggle={toggleColumn}
                      onReset={resetColumns}
                    />
                  </div>
                </div>

                {/* SEARCH AND FILTERS */}

                <div className="mt-5 grid grid-cols-1 gap-3 md:grid-cols-[minmax(0,1fr)_220px_auto]">
                  <div className="relative min-w-0">
                    <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />

                    <input
                      type="search"
                      value={search}
                      onChange={(event) =>
                        setSearch(event.target.value)
                      }
                      placeholder="Search name, code, phone, or email..."
                      aria-label="Search customers"
                      className={`${inputClass} pl-10`}
                    />
                  </div>

                  <div className="relative min-w-0">
                    <select
                      value={statusFilter}
                      onChange={(event) =>
                        setStatusFilter(event.target.value)
                      }
                      aria-label="Filter customer status"
                      className={`${inputClass} appearance-none pr-10`}
                    >
                      <option value="all">All Statuses</option>
                      <option value="active">Active Customers</option>
                      <option value="inactive">Inactive Customers</option>
                    </select>

                    <ChevronDown className="pointer-events-none absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      setSearch("");
                      setStatusFilter("all");
                    }}
                    disabled={!search && statusFilter === "all"}
                    className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                  >
                    <X className="h-4 w-4" />
                    Clear Filters
                  </button>
                </div>
              </div>

              {/* TABLE LOADING */}

              {loading && customers.length === 0 ? (
                <div className="flex min-h-64 items-center justify-center gap-3 p-8 text-sm text-slate-500 dark:text-slate-400">
                  <LoaderCircle className="h-5 w-5 animate-spin text-blue-600" />
                  Loading customers...
                </div>
              ) : filteredCustomers.length === 0 ? (

                /* EMPTY STATE */

                <div className="flex min-h-72 flex-col items-center justify-center px-6 py-14 text-center">
                  <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-100 dark:bg-slate-800">
                    {customers.length === 0 ? (
                      <Users className="h-8 w-8 text-slate-400" />
                    ) : (
                      <Search className="h-8 w-8 text-slate-400" />
                    )}
                  </div>

                  <h3 className="mt-5 text-lg font-bold text-slate-900 dark:text-white">
                    {customers.length === 0
                      ? "No customers yet"
                      : "No matching customers"}
                  </h3>

                  <p className="mt-2 max-w-md text-sm leading-6 text-slate-500 dark:text-slate-400">
                    {customers.length === 0
                      ? "Create your first customer to start managing customer accounts and balances."
                      : "Try another search term or clear the filters to see more customers."}
                  </p>

                  {customers.length === 0 && canCreate ? (
                    <button
                      type="button"
                      onClick={openAddForm}
                      className="mt-5 inline-flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-3 text-sm font-bold text-white transition hover:bg-blue-700"
                    >
                      <Plus className="h-4 w-4" />
                      Add First Customer
                    </button>
                  ) : customers.length > 0 ? (
                    <button
                      type="button"
                      onClick={() => {
                        setSearch("");
                        setStatusFilter("all");
                      }}
                      className="mt-5 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                    >
                      Clear Filters
                    </button>
                  ) : null}
                </div>
              ) : (
                <>
                  {/* DESKTOP TABLE */}

                  <div className="hidden w-full overflow-x-auto [scrollbar-width:thin] md:block">
                    <table
                      style={{ minWidth: `${visibleColumnCount * 160}px` }}
                      className="w-full table-auto text-left text-sm"
                    >
                      <colgroup>
                        {visibleColumns.customer && (
                          <col style={{ width: "19%" }} />
                        )}

                        {visibleColumns.contact && (
                          <col style={{ width: "19%" }} />
                        )}

                        {visibleColumns.sales && (
                          <col style={{ width: "13%" }} />
                        )}

                        {visibleColumns.paid && (
                          <col style={{ width: "13%" }} />
                        )}

                        {visibleColumns.balance && (
                          <col style={{ width: "13%" }} />
                        )}

                        {visibleColumns.status && (
                          <col style={{ width: "11%" }} />
                        )}

                        {visibleColumns.actions &&
                          (canUpdate || canDelete) && (
                            <col style={{ width: "12%" }} />
                          )}
                      </colgroup>

                      <thead className="bg-slate-50 dark:bg-slate-800/80">
                        <tr className="border-b border-slate-200 dark:border-slate-800">
                          {visibleColumns.customer && (
                            <th className="break-words px-3 py-4 font-semibold text-slate-500 dark:text-slate-300">
                              Customer
                            </th>
                          )}

                          {visibleColumns.contact && (
                            <th className="break-words px-3 py-4 font-semibold text-slate-500 dark:text-slate-300">
                              Contact Details
                            </th>
                          )}

                          {visibleColumns.sales && (
                            <th className="break-words px-3 py-4 text-right font-semibold text-slate-500 dark:text-slate-300">
                              Sales
                            </th>
                          )}

                          {visibleColumns.paid && (
                            <th className="break-words px-3 py-4 text-right font-semibold text-slate-500 dark:text-slate-300">
                              Paid
                            </th>
                          )}

                          {visibleColumns.balance && (
                            <th className="break-words px-3 py-4 text-right font-semibold text-slate-500 dark:text-slate-300">
                              Balance
                            </th>
                          )}

                          {visibleColumns.status && (
                            <th className="break-words px-3 py-4 font-semibold text-slate-500 dark:text-slate-300">
                              Status
                            </th>
                          )}

                          {visibleColumns.actions &&
                            (canUpdate || canDelete) && (
                              <th className="break-words px-3 py-4 text-right font-semibold text-slate-500 dark:text-slate-300">
                                Actions
                              </th>
                            )}
                        </tr>
                      </thead>

                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                        {filteredCustomers.map((customer) => (
                          <tr
                            key={customer.customer_id}
                            className="transition-colors hover:bg-blue-50/50 dark:hover:bg-blue-950/20"
                          >
                            {visibleColumns.customer && (
                              <td className="min-w-0 px-3 py-4">
                                <div className="flex min-w-0 items-center gap-2">
                                  <CustomerAvatar
                                    name={customer.customer_name}
                                  />

                                  <div className="min-w-0">
                                    <p className="break-words font-semibold text-slate-900 dark:text-white">
                                      {customer.customer_name ||
                                        "Unnamed Customer"}
                                    </p>

                                    <p className="mt-1 break-all text-xs text-slate-500 dark:text-slate-400">
                                      Code: {customer.customer_code || "—"}
                                    </p>
                                  </div>
                                </div>
                              </td>
                            )}

                            {visibleColumns.contact && (
                              <td className="min-w-0 px-3 py-4">
                                <div className="min-w-0 space-y-1.5">
                                  <p className="flex min-w-0 items-start gap-2 break-words text-slate-700 dark:text-slate-300">
                                    <Phone className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-400" />

                                    <span className="min-w-0 break-all">
                                      {customer.phone || "No phone"}
                                    </span>
                                  </p>

                                  <p className="flex min-w-0 items-start gap-2 break-all text-xs text-slate-500 dark:text-slate-400">
                                    <Mail className="mt-0.5 h-3.5 w-3.5 shrink-0" />

                                    <span className="min-w-0 break-all">
                                      {customer.email || "No email"}
                                    </span>
                                  </p>
                                </div>
                              </td>
                            )}

                            {visibleColumns.sales && (
                              <td className="break-words px-3 py-4 text-right font-medium tabular-nums text-slate-700 dark:text-slate-300">
                                {formatAmount(customer.total_sales)}
                              </td>
                            )}

                            {visibleColumns.paid && (
                              <td className="break-words px-3 py-4 text-right font-medium tabular-nums text-slate-700 dark:text-slate-300">
                                {formatAmount(customer.total_paid)}
                              </td>
                            )}

                            {visibleColumns.balance && (
                              <td className="break-words px-3 py-4 text-right">
                                <span className="font-bold tabular-nums text-slate-900 dark:text-white">
                                  {formatAmount(customer.customer_balance)}
                                </span>
                              </td>
                            )}

                            {visibleColumns.status && (
                              <td className="px-3 py-4">
                                <StatusBadge
                                  active={customer.is_active === true}
                                />
                              </td>
                            )}

                            {visibleColumns.actions &&
                              (canUpdate || canDelete) && (
                                <td className="px-2 py-4">
                                  <div className="flex flex-wrap justify-end gap-1.5">
                                    {canUpdate && (
                                      <button
                                        type="button"
                                        onClick={() => editCustomer(customer)}
                                        aria-label={`Edit ${customer.customer_name}`}
                                        title="Edit customer"
                                        className="inline-flex items-center justify-center gap-1 rounded-lg border border-slate-200 bg-white px-2 py-2 text-xs font-semibold text-slate-700 transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:border-blue-900 dark:hover:bg-blue-950/40 dark:hover:text-blue-300"
                                      >
                                        <Pencil className="h-3.5 w-3.5" />
                                        Edit
                                      </button>
                                    )}

                                    {canDelete && (
                                      <button
                                        type="button"
                                        onClick={() =>
                                          deleteCustomer(customer.customer_id)
                                        }
                                        disabled={deletingId !== null}
                                        aria-label={`Delete ${customer.customer_name}`}
                                        title="Delete customer"
                                        className="inline-flex items-center justify-center gap-1 rounded-lg border border-red-200 bg-white px-2 py-2 text-xs font-semibold text-red-600 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-red-900/50 dark:bg-slate-900 dark:text-red-300 dark:hover:bg-red-950/40"
                                      >
                                        {String(deletingId) ===
                                          String(customer.customer_id) ? (
                                          <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
                                        ) : (
                                          <Trash2 className="h-3.5 w-3.5" />
                                        )}
                                        Delete
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

                  {/* MOBILE CARDS */}

                  <div className="grid grid-cols-1 gap-4 p-4 md:hidden">
                    {filteredCustomers.map((customer) => (
                      <article
                        key={customer.customer_id}
                        className="rounded-2xl border border-slate-200 bg-white p-4 transition hover:border-blue-200 hover:shadow-sm dark:border-slate-800 dark:bg-slate-900 dark:hover:border-blue-900"
                      >
                        <div className="flex items-start justify-between gap-3">
                          {visibleColumns.customer && (
                            <div className="flex min-w-0 items-center gap-3">
                              <CustomerAvatar
                                name={customer.customer_name}
                              />

                              <div className="min-w-0">
                                <h3 className="break-words font-bold text-slate-900 dark:text-white">
                                  {customer.customer_name ||
                                    "Unnamed Customer"}
                                </h3>

                                <p className="mt-1 break-all text-xs text-slate-500 dark:text-slate-400">
                                  {customer.customer_code ||
                                    "No customer code"}
                                </p>
                              </div>
                            </div>
                          )}

                          {visibleColumns.status && (
                            <StatusBadge
                              active={customer.is_active === true}
                            />
                          )}
                        </div>

                        {visibleColumns.contact && (
                          <div className="mt-4 space-y-2 rounded-xl bg-slate-50 p-3 text-sm dark:bg-slate-800/70">
                            <p className="flex items-start gap-2 break-all text-slate-600 dark:text-slate-300">
                              <Phone className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
                              {customer.phone || "No phone"}
                            </p>

                            <p className="flex items-start gap-2 break-all text-slate-600 dark:text-slate-300">
                              <Mail className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
                              {customer.email || "No email"}
                            </p>

                            {customer.address && (
                              <p className="flex items-start gap-2 text-slate-600 dark:text-slate-300">
                                <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />

                                <span className="break-words">
                                  {customer.address}
                                </span>
                              </p>
                            )}
                          </div>
                        )}

                        {(visibleColumns.sales ||
                          visibleColumns.paid ||
                          visibleColumns.balance) && (
                            <div className="mt-4 grid grid-cols-2 gap-3">
                              {visibleColumns.sales && (
                                <div className="min-w-0 rounded-xl border border-slate-100 p-3 dark:border-slate-800">
                                  <p className="text-xs text-slate-500 dark:text-slate-400">
                                    Total Sales
                                  </p>

                                  <p className="mt-1 break-words font-bold text-slate-900 dark:text-white">
                                    {formatAmount(customer.total_sales)}
                                  </p>
                                </div>
                              )}

                              {visibleColumns.paid && (
                                <div className="min-w-0 rounded-xl border border-slate-100 p-3 dark:border-slate-800">
                                  <p className="text-xs text-slate-500 dark:text-slate-400">
                                    Total Paid
                                  </p>

                                  <p className="mt-1 break-words font-bold text-emerald-700 dark:text-emerald-300">
                                    {formatAmount(customer.total_paid)}
                                  </p>
                                </div>
                              )}

                              {visibleColumns.balance && (
                                <div className="col-span-2 min-w-0 rounded-xl border border-blue-100 bg-blue-50/60 p-3 dark:border-blue-900/50 dark:bg-blue-950/20">
                                  <p className="text-xs text-slate-500 dark:text-slate-400">
                                    Customer Balance
                                  </p>

                                  <p className="mt-1 break-words text-lg font-bold text-blue-800 dark:text-blue-300">
                                    {formatAmount(customer.customer_balance)}
                                  </p>
                                </div>
                              )}
                            </div>
                          )}

                        {visibleColumns.actions &&
                          (canUpdate || canDelete) && (
                            <div className="mt-4 flex flex-wrap gap-2 border-t border-slate-100 pt-4 dark:border-slate-800">
                              {canUpdate && (
                                <button
                                  type="button"
                                  onClick={() => editCustomer(customer)}
                                  className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl border border-slate-200 px-3 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-blue-50 hover:text-blue-700 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-blue-950/40 dark:hover:text-blue-300"
                                >
                                  <Pencil className="h-4 w-4" />
                                  Edit
                                </button>
                              )}

                              {canDelete && (
                                <button
                                  type="button"
                                  onClick={() =>
                                    deleteCustomer(customer.customer_id)
                                  }
                                  disabled={deletingId !== null}
                                  className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl border border-red-200 px-3 py-2.5 text-sm font-semibold text-red-600 transition hover:bg-red-50 disabled:opacity-50 dark:border-red-900/50 dark:text-red-300 dark:hover:bg-red-950/40"
                                >
                                  {String(deletingId) ===
                                    String(customer.customer_id) ? (
                                    <LoaderCircle className="h-4 w-4 animate-spin" />
                                  ) : (
                                    <Trash2 className="h-4 w-4" />
                                  )}
                                  Delete
                                </button>
                              )}
                            </div>
                          )}
                      </article>
                    ))}
                  </div>

                  {/* FOOTER */}

                  <div className="flex flex-col gap-2 border-t border-slate-200 bg-slate-50 px-5 py-4 text-xs text-slate-500 dark:border-slate-800 dark:bg-slate-800/40 dark:text-slate-400 sm:flex-row sm:items-center sm:justify-between">
                    <p>
                      Showing{" "}
                      <strong className="text-slate-700 dark:text-slate-200">
                        {filteredCustomers.length}
                      </strong>{" "}
                      customer
                      {filteredCustomers.length === 1 ? "" : "s"}
                    </p>

                    <p className="flex items-center gap-1.5">
                      <ArrowUpRight className="h-4 w-4 text-blue-500" />
                      Customer directory
                    </p>
                  </div>
                </>
              )}
            </section>
          </>
        )}

        {/* PAGE FOOTER */}

        <footer className="flex flex-col items-center justify-between gap-2 pb-2 text-center text-xs text-slate-400 dark:text-slate-500 sm:flex-row sm:text-left">
          <p>Customer Management · ERP Administration</p>
          <p>Customer details and balances</p>
        </footer>
      </div>
    </main>
  );
}
