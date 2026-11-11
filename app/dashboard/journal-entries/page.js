"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Activity,
  ArrowDownLeft,
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  BookOpen,
  CalendarDays,
  Check,
  CheckCircle2,
  CircleAlert,
  Clock3,
  Download,
  Eye,
  FileText,
  Filter,
  Layers3,
  LoaderCircle,
  Plus,
  Printer,
  RefreshCw,
  RotateCcw,
  Save,
  Search,
  ShieldCheck,
  Trash2,
  Wallet,
  X,
  Pencil,
} from "lucide-react";

const emptyLine = {
  entityName: "",
  accountId: "",
  description: "",
  debit: "",
  credit: "",
};

const emptyForm = {
  journalNumber: "",
  journalDate: "",
  description: "",
};

const inputClass =
  "w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:border-blue-400 dark:focus:ring-blue-400/10";

const labelClass =
  "mb-2 block text-sm font-semibold text-slate-700 dark:text-slate-300";

const panelClass =
  "overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm shadow-slate-200/40 dark:border-slate-800 dark:bg-slate-900 dark:shadow-black/10";

const secondaryButtonClass =
  "inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800";

const primaryButtonClass =
  "inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-blue-700 px-5 py-2.5 text-sm font-semibold text-white shadow-md shadow-blue-600/20 transition hover:from-blue-700 hover:to-blue-800 disabled:cursor-not-allowed disabled:opacity-50";

const greenButtonClass =
  "inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-600 to-green-600 px-5 py-2.5 text-sm font-semibold text-white shadow-md shadow-emerald-600/20 transition hover:from-emerald-700 hover:to-green-700 disabled:cursor-not-allowed disabled:opacity-50";

function getApiMessage(data, fallback) {
  if (data && typeof data.message === "string") {
    return data.message;
  }

  if (data && typeof data.error === "string") {
    return data.error;
  }

  return fallback;
}

async function readResponse(response) {
  const text = await response.text();

  if (!text) return {};

  try {
    return JSON.parse(text);
  } catch {
    throw new Error(
      "The server returned an invalid response. Please check your API route."
    );
  }
}

function normalizeAccounts(data) {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.accounts)) return data.accounts;
  return [];
}

function normalizeJournals(data) {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.journals)) return data.journals;
  return [];
}

function money(value) {
  return Number(value || 0).toLocaleString("en-PK", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function formatDate(value) {
  if (!value) return "—";

  const dateString = String(value).substring(0, 10);
  const date = new Date(`${dateString}T00:00:00`);

  if (Number.isNaN(date.getTime())) return dateString;

  return date.toLocaleDateString("en-PK", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function todayString() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function isAccountSelectable(account) {
  return (
    account.is_active !== false &&
    account.is_active !== 0 &&
    account.is_group !== true &&
    account.is_group !== 1 &&
    account.is_summary !== true &&
    account.is_summary !== 1
  );
}

function statusClasses(status) {
  const normalized = String(status || "POSTED").toUpperCase();

  if (normalized === "POSTED" || normalized === "APPROVED") {
    return "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/50 dark:text-emerald-300";
  }

  if (normalized === "DRAFT" || normalized === "PENDING") {
    return "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-300";
  }

  if (normalized === "CANCELLED" || normalized === "VOID") {
    return "border-red-200 bg-red-50 text-red-700 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300";
  }

  return "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-900/60 dark:bg-blue-950/40 dark:text-blue-300";
}

function StatusBadge({ status }) {
  const normalized = String(status || "POSTED").toUpperCase();
  const isPosted =
    normalized === "POSTED" || normalized === "APPROVED";

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-bold ${statusClasses(
        status
      )}`}
    >
      {isPosted ? (
        <CheckCircle2 size={13} />
      ) : (
        <Clock3 size={13} />
      )}
      {normalized}
    </span>
  );
}

function SectionTitle({ icon: Icon, title, description, action }) {
  return (
    <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-950/60 dark:text-blue-400">
          <Icon size={20} />
        </div>

        <div>
          <h2 className="text-lg font-bold text-slate-900 dark:text-white">
            {title}
          </h2>

          {description ? (
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              {description}
            </p>
          ) : null}
        </div>
      </div>

      {action}
    </div>
  );
}

function SummaryCard({
  title,
  value,
  description,
  icon: Icon,
  color = "blue",
}) {
  const colors = {
    blue: {
      icon: "bg-blue-50 text-blue-600 dark:bg-blue-950/60 dark:text-blue-400",
      accent: "from-blue-500 to-indigo-500",
    },
    green: {
      icon: "bg-emerald-50 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-400",
      accent: "from-emerald-500 to-green-500",
    },
    teal: {
      icon: "bg-teal-50 text-teal-600 dark:bg-teal-950/60 dark:text-teal-400",
      accent: "from-teal-500 to-cyan-500",
    },
    violet: {
      icon: "bg-violet-50 text-violet-600 dark:bg-violet-950/60 dark:text-violet-400",
      accent: "from-violet-500 to-purple-500",
    },
  };

  const selected = colors[color] || colors.blue;

  return (
    <div className="group relative overflow-hidden rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm transition duration-200 hover:-translate-y-0.5 hover:shadow-md dark:border-slate-800 dark:bg-slate-900">
      <div
        className={`absolute inset-x-0 top-0 h-1 bg-gradient-to-r ${selected.accent}`}
      />

      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
            {title}
          </p>

          <p className="mt-3 break-words text-2xl font-extrabold tracking-tight text-slate-900 dark:text-white">
            {value}
          </p>

          <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
            {description}
          </p>
        </div>

        <div
          className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${selected.icon}`}
        >
          <Icon size={21} />
        </div>
      </div>
    </div>
  );
}

function Notice({ type = "error", message, onClose }) {
  if (!message) return null;

  const styles =
    type === "success"
      ? "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-200"
      : "border-red-200 bg-red-50 text-red-800 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-200";

  const Icon = type === "success" ? CheckCircle2 : CircleAlert;

  return (
    <div
      role="alert"
      className={`mb-5 flex items-start gap-3 rounded-xl border px-4 py-3.5 ${styles}`}
    >
      <Icon size={19} className="mt-0.5 shrink-0" />

      <p className="flex-1 text-sm font-medium">{message}</p>

      <button
        type="button"
        onClick={onClose}
        className="rounded-lg p-1 opacity-70 transition hover:bg-black/5 hover:opacity-100 dark:hover:bg-white/10"
        aria-label="Dismiss notification"
      >
        <X size={17} />
      </button>
    </div>
  );
}

export default function JournalEntriesPage() {
  const [accounts, setAccounts] = useState([]);
  const [journals, setJournals] = useState([]);

  const [form, setForm] = useState({ ...emptyForm });
  const [items, setItems] = useState([
    { ...emptyLine },
    { ...emptyLine },
  ]);

  const [loading, setLoading] = useState(true);
  // -----------------------------------------------------
  // USER RIGHTS / PERMISSIONS
  // -----------------------------------------------------

  const [permissionLoading, setPermissionLoading] = useState(true);

  const [journalPermissions, setJournalPermissions] = useState({
    can_view: false,
    can_create: false,
    can_update: false,
    can_delete: false,
  });
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);

  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const [showForm, setShowForm] = useState(false);
  const [editingJournalId, setEditingJournalId] = useState(null);

  const [selectedJournal, setSelectedJournal] = useState(null);
  const [selectedJournalLines, setSelectedJournalLines] = useState([]);
  const [showPopup, setShowPopup] = useState(false);
  const [loadingDetails, setLoadingDetails] = useState(false);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");

  // -----------------------------------------------------
  // LOAD ACCOUNTS AND JOURNAL HISTORY
  // -----------------------------------------------------

  // -----------------------------------------------------
  // LOAD CURRENT USER PERMISSIONS
  // -----------------------------------------------------

  useEffect(() => {
  let active = true;

  const loadPermissions = async () => {
    try {
      const response = await fetch("/api/permissions/current", {
        method: "GET",
        credentials: "same-origin",
        cache: "no-store",
        headers: {
          Accept: "application/json",
        },
      });

      if (!response.ok) {
        throw new Error("Unable to load journal permissions.");
      }

      const data = await response.json();

      if (!Array.isArray(data.permissions)) {
        throw new Error("Invalid permissions response.");
      }

      const permission = data.permissions.find(
        (item) =>
          String(item.permission_key || "")
            .trim()
            .toLowerCase() === "journal_entries"
      );

      const toBoolean = (value) =>
        value === true ||
        value === 1 ||
        value === "1" ||
        String(value).toLowerCase() === "true";

      if (active) {
        setJournalPermissions({
          can_view: toBoolean(permission?.can_view),
          can_create: toBoolean(permission?.can_create),
          can_update: toBoolean(permission?.can_update),
          can_delete: toBoolean(permission?.can_delete),
        });
      }
    } catch (error) {
      console.error("Journal permissions error:", error);

      if (active) {
        setJournalPermissions({
          can_view: false,
          can_create: false,
          can_update: false,
          can_delete: false,
        });
      }
    } finally {
      if (active) {
        setPermissionLoading(false);
      }
    }
  };

  loadPermissions();

  const handlePermissionsUpdated = () => {
    loadPermissions();
  };

  window.addEventListener(
    "erp-permissions-updated",
    handlePermissionsUpdated
  );

  window.addEventListener("focus", handlePermissionsUpdated);

  return () => {
    active = false;

    window.removeEventListener(
      "erp-permissions-updated",
      handlePermissionsUpdated
    );

    window.removeEventListener("focus", handlePermissionsUpdated);
  };
}, []);

  const canView = journalPermissions.can_view;
  const canCreate = journalPermissions.can_create;
  const canUpdate = journalPermissions.can_update;
  const canDelete = journalPermissions.can_delete;

  const loadData = useCallback(async () => {
    const [accountsResponse, journalsResponse] = await Promise.all([
      fetch("/api/accounts", { cache: "no-store" }),
      fetch("/api/journal-entries", { cache: "no-store" }),
    ]);

    const accountsData = await readResponse(accountsResponse);
    const journalsData = await readResponse(journalsResponse);

    if (!accountsResponse.ok || accountsData.success === false) {
      throw new Error(
        getApiMessage(accountsData, "Failed to load accounts.")
      );
    }

    if (!journalsResponse.ok || journalsData.success === false) {
      throw new Error(
        getApiMessage(journalsData, "Failed to load journal history.")
      );
    }

    setAccounts(normalizeAccounts(accountsData));
    setJournals(normalizeJournals(journalsData));
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function initialLoad() {
      try {
        const [accountsResponse, journalsResponse] = await Promise.all([
          fetch("/api/accounts", { cache: "no-store" }),
          fetch("/api/journal-entries", { cache: "no-store" }),
        ]);

        const accountsData = await readResponse(accountsResponse);
        const journalsData = await readResponse(journalsResponse);

        if (!accountsResponse.ok || accountsData.success === false) {
          throw new Error(
            getApiMessage(accountsData, "Failed to load accounts.")
          );
        }

        if (!journalsResponse.ok || journalsData.success === false) {
          throw new Error(
            getApiMessage(journalsData, "Failed to load journal history.")
          );
        }

        if (!cancelled) {
          setAccounts(normalizeAccounts(accountsData));
          setJournals(normalizeJournals(journalsData));
        }
      } catch (err) {
        if (!cancelled) {
          setError(err.message || "Unable to load accounting data.");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    initialLoad();

    return () => {
      cancelled = true;
    };
  }, []);

  // -----------------------------------------------------
  // REFRESH JOURNAL HISTORY
  // -----------------------------------------------------

  async function refreshJournals() {
    setRefreshing(true);

    try {
      await loadData();
      setError("");
    } catch (err) {
      setError(err.message || "Failed to refresh journal history.");
    } finally {
      setRefreshing(false);
    }
  }

  // -----------------------------------------------------
  // ADD JOURNAL
  // -----------------------------------------------------

  function addJournal() {
    if (!canCreate) {
      setError("You do not have permission to create journal entries.");
      return;
    }
    setForm({
      ...emptyForm,
      journalDate: todayString(),
    });

    setItems([
      { ...emptyLine },
      { ...emptyLine },
    ]);

    setEditingJournalId(null);
    setMessage("");
    setError("");
    setShowForm(true);
  }

  // -----------------------------------------------------
  // CANCEL FORM
  // -----------------------------------------------------

  function cancelForm() {
    if (saving) return;

    setForm({ ...emptyForm });
    setItems([
      { ...emptyLine },
      { ...emptyLine },
    ]);

    setEditingJournalId(null);
    setShowForm(false);
    setError("");
  }

  // -----------------------------------------------------
  // UPDATE FORM FIELDS
  // -----------------------------------------------------

  function updateForm(field, value) {
    setForm((current) => ({
      ...current,
      [field]: value,
    }));
  }

  function updateItem(index, field, value) {
    setItems((current) =>
      current.map((item, itemIndex) => {
        if (itemIndex !== index) return item;

        const updated = { ...item, [field]: value };

        // Debit and credit cannot both have a positive amount.
        if (field === "debit" && Number(value) > 0) {
          updated.credit = "";
        }

        if (field === "credit" && Number(value) > 0) {
          updated.debit = "";
        }

        return updated;
      })
    );
  }

  function addLine() {
    setItems((current) => [
      ...current,
      { ...emptyLine },
    ]);
  }

  function removeLine(index) {
    setItems((current) => {
      if (current.length <= 2) return current;

      return current.filter((_, itemIndex) => itemIndex !== index);
    });
  }

  function resetForm() {
    setForm({ ...emptyForm });
    setItems([
      { ...emptyLine },
      { ...emptyLine },
    ]);

    setEditingJournalId(null);
    setShowForm(false);
  }

  // -----------------------------------------------------
  // TOTALS AND BALANCE VALIDATION
  // -----------------------------------------------------

  const totalDebit = useMemo(
    () =>
      items.reduce(
        (sum, item) => sum + (Number(item.debit) || 0),
        0
      ),
    [items]
  );

  const totalCredit = useMemo(
    () =>
      items.reduce(
        (sum, item) => sum + (Number(item.credit) || 0),
        0
      ),
    [items]
  );

  const difference = Math.abs(totalDebit - totalCredit);
  const balanced = difference < 0.01;

  const selectableAccounts = useMemo(
    () => accounts.filter(isAccountSelectable),
    [accounts]
  );

  const totalJournalDebit = useMemo(
    () =>
      journals.reduce(
        (sum, journal) => sum + (Number(journal.total_debit) || 0),
        0
      ),
    [journals]
  );

  const totalJournalCredit = useMemo(
    () =>
      journals.reduce(
        (sum, journal) => sum + (Number(journal.total_credit) || 0),
        0
      ),
    [journals]
  );

  const filteredJournals = useMemo(() => {
    const query = search.trim().toLowerCase();

    return journals.filter((journal) => {
      const matchesSearch =
        !query ||
        String(journal.journal_number || "")
          .toLowerCase()
          .includes(query) ||
        String(journal.description || "")
          .toLowerCase()
          .includes(query) ||
        String(journal.journal_date || "")
          .toLowerCase()
          .includes(query) ||
        String(journal.journal_id || "")
          .includes(query);

      const status = String(journal.status || "POSTED").toUpperCase();

      const matchesStatus =
        statusFilter === "ALL" || status === statusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [journals, search, statusFilter]);

  const postedCount = useMemo(
    () =>
      journals.filter((journal) => {
        const status = String(journal.status || "POSTED").toUpperCase();
        return status === "POSTED" || status === "APPROVED";
      }).length,
    [journals]
  );

  // -----------------------------------------------------
  // SAVE OR UPDATE JOURNAL
  // -----------------------------------------------------

  async function saveJournal(event) {
    event.preventDefault();
    if (editingJournalId && !canUpdate) {
      setError("You do not have permission to update journal entries.");
      return;
    }

    if (!editingJournalId && !canCreate) {
      setError("You do not have permission to create journal entries.");
      return;
    }

    setSaving(true);
    setMessage("");
    setError("");

    try {
      if (items.length < 2) {
        throw new Error("A journal must contain at least two lines.");
      }

      if (!form.journalDate) {
        throw new Error("Please select the journal date.");
      }

      if (selectableAccounts.length === 0) {
        throw new Error(
          "No active posting accounts were found. Please check your Chart of Accounts."
        );
      }

      const validItems = items.every((item) => {
        const debit = Number(item.debit) || 0;
        const credit = Number(item.credit) || 0;

        return (
          Boolean(item.accountId) &&
          (debit > 0 || credit > 0) &&
          !(debit > 0 && credit > 0) &&
          debit >= 0 &&
          credit >= 0
        );
      });

      if (!validItems) {
        throw new Error(
          "Every journal line needs an account and a positive debit or credit amount. A line cannot have both."
        );
      }

      if (!balanced) {
        throw new Error(
          "Total debit and total credit must be equal before posting."
        );
      }

      const method = editingJournalId ? "PUT" : "POST";

      const body = {
        ...form,
        items: items.map((item) => ({
          ...item,
          accountId: String(item.accountId),
          debit: Number(item.debit) || 0,
          credit: Number(item.credit) || 0,
        })),
      };

      if (editingJournalId) {
        body.journalId = editingJournalId;
      }

      const response = await fetch("/api/journal-entries", {
        method,
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });

      const data = await readResponse(response);

      if (!response.ok || data.success === false || !data.success) {
        throw new Error(
          getApiMessage(data, "Failed to save journal entry.")
        );
      }

      const wasEditing = Boolean(editingJournalId);

      resetForm();

      await loadData();

      setMessage(
        wasEditing
          ? "Journal entry updated successfully."
          : "Journal entry posted successfully."
      );
    } catch (err) {
      setError(err.message || "Failed to save journal entry.");
    } finally {
      setSaving(false);
    }
  }

  // -----------------------------------------------------
  // FETCH JOURNAL DETAILS
  // -----------------------------------------------------

  async function fetchJournalDetails(journalId) {
    const response = await fetch(
      `/api/journal-entries?id=${encodeURIComponent(journalId)}`,
      { cache: "no-store" }
    );

    const data = await readResponse(response);

    if (!response.ok || data.success === false || !data.success) {
      throw new Error(
        getApiMessage(data, "Failed to load journal details.")
      );
    }

    if (!data.journal) {
      throw new Error("The requested journal entry was not found.");
    }

    return data;
  }

  // -----------------------------------------------------
  // VIEW JOURNAL
  // -----------------------------------------------------

  async function viewJournal(journalId) {
    if (!canView) {
      setError("You do not have permission to view journal entries.");
      return;
    }
    setLoadingDetails(true);
    setError("");

    try {
      const data = await fetchJournalDetails(journalId);

      setSelectedJournal(data.journal);
      setSelectedJournalLines(
        Array.isArray(data.lines) ? data.lines : []
      );
      setShowPopup(true);
    } catch (err) {
      setError(err.message || "Failed to load journal details.");
    } finally {
      setLoadingDetails(false);
    }
  }

  // -----------------------------------------------------
  // EDIT JOURNAL
  // -----------------------------------------------------

  async function editJournal(journalId) {
    if (!canUpdate) {
      setError("You do not have permission to edit journal entries.");
      return;
    }
    setLoadingDetails(true);
    setError("");
    setMessage("");

    try {
      const data = await fetchJournalDetails(journalId);
      const journal = data.journal;
      const lines = Array.isArray(data.lines) ? data.lines : [];

      setForm({
        journalNumber: journal.journal_number || "",
        journalDate: journal.journal_date
          ? String(journal.journal_date).substring(0, 10)
          : todayString(),
        description: journal.description || "",
      });

      setItems(
        lines.length >= 2
          ? lines.map((line) => ({
            entityName: line.entity_name || "",
            accountId: String(line.account_id ?? ""),
            description: line.description || "",
            debit:
              Number(line.debit) > 0
                ? String(line.debit)
                : "",
            credit:
              Number(line.credit) > 0
                ? String(line.credit)
                : "",
          }))
          : [
            { ...emptyLine },
            { ...emptyLine },
          ]
      );

      setEditingJournalId(journal.journal_id);
      setShowPopup(false);
      setShowForm(true);

      window.scrollTo({
        top: 0,
        behavior: "smooth",
      });
    } catch (err) {
      setError(err.message || "Failed to edit journal.");
    } finally {
      setLoadingDetails(false);
    }
  }

  // -----------------------------------------------------
  // CLOSE VOUCHER
  // -----------------------------------------------------

  function closePopup() {
    setShowPopup(false);
    setSelectedJournal(null);
    setSelectedJournalLines([]);
  }

  // -----------------------------------------------------
  // PRINT JOURNAL VOUCHER
  // -----------------------------------------------------

  function printJournal() {
    if (!selectedJournal) return;

    const journal = selectedJournal;
    const lines = selectedJournalLines;

    const escapeHtml = (value) =>
      String(value ?? "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");

    const rows = lines
      .map(
        (line) => `
          <tr>
            <td>${escapeHtml(line.entity_name || "-")}</td>
            <td>
              <strong>${escapeHtml(line.account_code || "")}</strong><br />
              ${escapeHtml(line.account_name || "")}
            </td>
            <td>${escapeHtml(line.description || "-")}</td>
            <td class="number">${money(line.debit)}</td>
            <td class="number">${money(line.credit)}</td>
          </tr>
        `
      )
      .join("");

    const printWindow = window.open(
      "",
      "_blank",
      "width=1000,height=800"
    );

    if (!printWindow) {
      setError(
        "The print window was blocked. Please allow popups for this site."
      );
      return;
    }

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8" />
        <title>Journal Voucher - ${escapeHtml(
      journal.journal_number || journal.journal_id
    )}</title>
        <style>
          * { box-sizing: border-box; }
          body {
            margin: 0;
            padding: 30px;
            font-family: Arial, Helvetica, sans-serif;
            color: #0f172a;
            background: #ffffff;
          }
          .document { max-width: 1000px; margin: auto; }
          .top {
            display: flex;
            justify-content: space-between;
            align-items: center;
            gap: 20px;
            border-bottom: 3px solid #2563eb;
            padding-bottom: 20px;
            margin-bottom: 24px;
          }
          .company { font-size: 25px; font-weight: 800; color: #1d4ed8; }
          .subtitle { margin-top: 5px; font-size: 12px; color: #64748b; }
          .title { text-align: right; }
          .title h1 { margin: 0; font-size: 24px; }
          .title p { margin-bottom: 0; color: #64748b; }
          .info {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 12px;
            margin-bottom: 24px;
          }
          .info-box {
            border: 1px solid #dbe3ee;
            border-radius: 8px;
            padding: 13px;
          }
          .label {
            font-size: 10px;
            color: #64748b;
            text-transform: uppercase;
            letter-spacing: 1px;
            margin-bottom: 7px;
          }
          .value { font-size: 13px; font-weight: 700; overflow-wrap: anywhere; }
          table { width: 100%; border-collapse: collapse; }
          th {
            background: #eff6ff;
            color: #1e40af;
            border: 1px solid #dbe3ee;
            padding: 11px;
            text-align: left;
            font-size: 11px;
            text-transform: uppercase;
          }
          td {
            border: 1px solid #dbe3ee;
            padding: 11px;
            font-size: 12px;
            vertical-align: top;
          }
          .number { text-align: right; white-space: nowrap; }
          .total td { font-weight: 800; background: #f8fafc; }
          .footer {
            display: flex;
            justify-content: space-between;
            gap: 12px;
            margin-top: 30px;
            border-top: 1px solid #dbe3ee;
            padding-top: 13px;
            color: #64748b;
            font-size: 10px;
          }
          @media print {
            body { padding: 8px; }
            .document { max-width: none; }
          }
        </style>
      </head>
      <body>
        <div class="document">
          <div class="top">
            <div>
              <div class="company">ERP SOFTWARE</div>
              <div class="subtitle">Accounting &amp; Financial Management</div>
            </div>
            <div class="title">
              <h1>Journal Voucher</h1>
              <p>${escapeHtml(
      journal.journal_number || `JV-${journal.journal_id}`
    )}</p>
            </div>
          </div>

          <div class="info">
            <div class="info-box">
              <div class="label">Journal Number</div>
              <div class="value">${escapeHtml(
      journal.journal_number || `JV-${journal.journal_id}`
    )}</div>
            </div>
            <div class="info-box">
              <div class="label">Journal Date</div>
              <div class="value">${escapeHtml(
      String(journal.journal_date || "").substring(0, 10)
    )}</div>
            </div>
            <div class="info-box">
              <div class="label">Description</div>
              <div class="value">${escapeHtml(
      journal.description || "-"
    )}</div>
            </div>
            <div class="info-box">
              <div class="label">Status</div>
              <div class="value">${escapeHtml(
      journal.status || "POSTED"
    )}</div>
            </div>
          </div>

          <table>
            <thead>
              <tr>
                <th>Entity Name</th>
                <th>Account</th>
                <th>Description</th>
                <th class="number">Debit</th>
                <th class="number">Credit</th>
              </tr>
            </thead>
            <tbody>${rows}</tbody>
            <tfoot>
              <tr class="total">
                <td colspan="3" style="text-align:right">TOTAL</td>
                <td class="number">${money(journal.total_debit)}</td>
                <td class="number">${money(journal.total_credit)}</td>
              </tr>
            </tfoot>
          </table>

          <div class="footer">
            <span>Generated from ERP Software</span>
            <span>Journal Voucher</span>
          </div>
        </div>
      </body>
      </html>
    `);

    printWindow.document.close();
    printWindow.focus();

    printWindow.onload = () => {
      printWindow.print();
    };
  }

  // The browser print dialog provides "Save as PDF".
  function downloadPDF() {
    printJournal();
  }

  // -----------------------------------------------------
  // LOADING SCREEN
  // -----------------------------------------------------

  if (loading || permissionLoading) {
    return (
      <div className="min-h-screen bg-slate-50 p-4 dark:bg-slate-950 md:p-6">
        <div className="mx-auto max-w-7xl space-y-6">
          <div className="h-36 animate-pulse rounded-2xl bg-slate-200 dark:bg-slate-800" />

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {[1, 2, 3, 4].map((item) => (
              <div
                key={item}
                className="h-32 animate-pulse rounded-2xl bg-slate-200 dark:bg-slate-800"
              />
            ))}
          </div>

          <div className="flex min-h-64 items-center justify-center rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
            <div className="text-center">
              <LoaderCircle
                size={30}
                className="mx-auto animate-spin text-blue-600"
              />
              <p className="mt-3 text-sm font-medium text-slate-600 dark:text-slate-300">
                Loading journal entries...
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }
  if (!canView) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 p-6 dark:bg-slate-950">
        <div className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-xl dark:border-slate-800 dark:bg-slate-900">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-red-50 text-red-600 dark:bg-red-950/40 dark:text-red-400">
            <ShieldCheck size={30} />
          </div>

          <h2 className="mt-5 text-xl font-extrabold text-slate-900 dark:text-white">
            Access Restricted
          </h2>

          <p className="mt-2 text-sm leading-6 text-slate-500 dark:text-slate-400">
            You do not have permission to access Journal Entries.
            Please contact your administrator.
          </p>
        </div>
      </div>
    );
  }

  // -----------------------------------------------------
  // MAIN PAGE
  // -----------------------------------------------------

  return (
    <div className="min-h-screen bg-slate-50/80 p-4 text-slate-900 dark:bg-slate-950 dark:text-slate-100 sm:p-6 xl:p-8">
      <div className="mx-auto max-w-[1600px]">
        {/* PAGE HEADER */}
        <div className="relative mb-6 overflow-hidden rounded-3xl bg-gradient-to-br from-blue-700 via-blue-600 to-indigo-700 p-6 text-white shadow-xl shadow-blue-900/10 sm:p-8">
          <div className="pointer-events-none absolute -right-10 -top-20 h-64 w-64 rounded-full bg-white/10 blur-2xl" />
          <div className="pointer-events-none absolute bottom-0 right-1/4 h-32 w-32 rounded-full bg-emerald-300/20 blur-2xl" />

          <div className="relative flex flex-col justify-between gap-6 lg:flex-row lg:items-center">
            <div>
              <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-xs font-semibold text-blue-50 backdrop-blur">
                <BookOpen size={14} />
                ACCOUNTING MANAGEMENT
              </div>

              <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl">
                Journal Entries
              </h1>

              <p className="mt-2 max-w-2xl text-sm leading-6 text-blue-100 sm:text-base">
                Create balanced journal vouchers, manage accounting
                transactions, and review your financial records in one place.
              </p>

              <div className="mt-5 flex flex-wrap items-center gap-3 text-xs font-medium text-blue-50">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1.5">
                  <ShieldCheck size={14} />
                  Double-entry accounting
                </span>

                <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1.5">
                  <Activity size={14} />
                  Live balance calculation
                </span>
              </div>
            </div>

            <div className="relative flex shrink-0 flex-wrap gap-3">
              <button
                type="button"
                onClick={refreshJournals}
                disabled={refreshing}
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/25 bg-white/10 px-4 py-3 text-sm font-semibold text-white backdrop-blur transition hover:bg-white/20 disabled:opacity-60"
              >
                <RefreshCw
                  size={17}
                  className={refreshing ? "animate-spin" : ""}
                />
                Refresh
              </button>

              {!showForm ? (
                canCreate && (
                  <button
                    type="button"
                    onClick={addJournal}
                    className="inline-flex items-center justify-center gap-2 rounded-xl bg-white px-5 py-3 text-sm font-bold text-blue-700 shadow-lg transition hover:-translate-y-0.5 hover:bg-blue-50"
                  >
                    <Plus size={18} />
                    Add Journal
                  </button>
                )
              ) : (
                <button
                  type="button"
                  onClick={cancelForm}
                  disabled={saving}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-white px-5 py-3 text-sm font-bold text-slate-800 shadow-lg transition hover:bg-slate-100 disabled:opacity-50"
                >
                  <ArrowLeft size={17} />
                  Back to History
                </button>
              )}
            </div>
          </div>
        </div>

        {/* NOTIFICATIONS */}
        <Notice
          type="success"
          message={message}
          onClose={() => setMessage("")}
        />

        <Notice
          type="error"
          message={error}
          onClose={() => setError("")}
        />

        {/* SUMMARY CARDS */}
        {!showForm && (
          <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <SummaryCard
              title="Total Journals"
              value={journals.length.toLocaleString("en-PK")}
              description="Recorded journal entries"
              icon={BookOpen}
              color="blue"
            />

            <SummaryCard
              title="Posted Journals"
              value={postedCount.toLocaleString("en-PK")}
              description="Posted or approved entries"
              icon={CheckCircle2}
              color="green"
            />

            <SummaryCard
              title="Total Debits"
              value={money(totalJournalDebit)}
              description="Debit value across journal history"
              icon={ArrowDownLeft}
              color="teal"
            />

            <SummaryCard
              title="Total Credits"
              value={money(totalJournalCredit)}
              description="Credit value across journal history"
              icon={ArrowUpRight}
              color="violet"
            />
          </div>
        )}

        {/* ================================================= */}
        {/* ADD / EDIT JOURNAL FORM */}
        {/* ================================================= */}

        {showForm && (
          <form onSubmit={saveJournal} className={`${panelClass} mb-6`}>
            {/* FORM HEADER */}
            <div className="border-b border-slate-200 bg-gradient-to-r from-blue-50 via-white to-emerald-50 px-5 py-6 dark:border-slate-800 dark:from-blue-950/30 dark:via-slate-900 dark:to-emerald-950/20 sm:px-7">
              <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
                <div className="flex items-start gap-3">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-600 text-white shadow-lg shadow-blue-600/20">
                    {editingJournalId ? (
                      <Pencil size={22} />
                    ) : (
                      <FileText size={22} />
                    )}
                  </div>

                  <div>
                    <h2 className="text-xl font-extrabold text-slate-900 dark:text-white sm:text-2xl">
                      {editingJournalId
                        ? "Edit Journal Entry"
                        : "Create Journal Entry"}
                    </h2>

                    <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                      Enter transaction details and ensure that debits equal
                      credits.
                    </p>
                  </div>
                </div>

                <span className="inline-flex w-fit items-center gap-2 rounded-full border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-bold text-blue-700 dark:border-blue-900/60 dark:bg-blue-950/50 dark:text-blue-300">
                  <CalendarDays size={14} />
                  {editingJournalId ? "EDIT MODE" : "NEW VOUCHER"}
                </span>
              </div>
            </div>

            <div className="space-y-7 p-5 sm:p-7">
              {/* JOURNAL DETAILS */}
              <section>
                <SectionTitle
                  icon={Layers3}
                  title="Journal Information"
                  description="Provide the voucher number, transaction date, and general description."
                />

                <div className="mt-5 grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
                  <div>
                    <label className={labelClass}>
                      Journal Number
                    </label>

                    <input
                      value={form.journalNumber}
                      onChange={(event) =>
                        updateForm("journalNumber", event.target.value)
                      }
                      placeholder="Auto-generated or JV-001"
                      className={inputClass}
                    />

                    <p className="mt-1.5 text-xs text-slate-500 dark:text-slate-400">
                      Leave blank if your API generates the number.
                    </p>
                  </div>

                  <div>
                    <label className={labelClass}>
                      Journal Date <span className="text-red-500">*</span>
                    </label>

                    <input
                      type="date"
                      required
                      value={form.journalDate}
                      onChange={(event) =>
                        updateForm("journalDate", event.target.value)
                      }
                      className={inputClass}
                    />
                  </div>

                  <div className="md:col-span-2 xl:col-span-1">
                    <label className={labelClass}>
                      Transaction Description
                    </label>

                    <input
                      value={form.description}
                      onChange={(event) =>
                        updateForm("description", event.target.value)
                      }
                      placeholder="Describe the purpose of this journal"
                      className={inputClass}
                    />
                  </div>
                </div>
              </section>

              {/* JOURNAL LINES */}
              <section>
                <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
                  <SectionTitle
                    icon={Wallet}
                    title="Journal Lines"
                    description="Select posting accounts and enter debit or credit amounts."
                  />

                  {(editingJournalId ? canUpdate : canCreate) && (
                    <button
                      type="button"
                      onClick={addLine}
                      className={secondaryButtonClass}
                    >
                      <Plus size={17} />
                      Add Line
                    </button>
                  )}
                </div>

                <div className="mt-5 overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-800">
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[1120px] border-collapse">
                      <thead>
                        <tr className="bg-slate-50 dark:bg-slate-800/70">
                          <th className="w-12 px-3 py-4 text-center text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                            #
                          </th>

                          <th className="px-3 py-4 text-left text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                            Entity Name
                          </th>

                          <th className="px-3 py-4 text-left text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                            Account
                          </th>

                          <th className="px-3 py-4 text-left text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                            Description
                          </th>

                          <th className="px-3 py-4 text-right text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                            Debit
                          </th>

                          <th className="px-3 py-4 text-right text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                            Credit
                          </th>

                          <th className="px-3 py-4 text-center text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                            Action
                          </th>
                        </tr>
                      </thead>

                      <tbody>
                        {items.map((item, index) => (
                          <tr
                            key={index}
                            className="border-t border-slate-100 align-top transition hover:bg-blue-50/30 dark:border-slate-800 dark:hover:bg-slate-800/30"
                          >
                            <td className="px-3 py-4 text-center">
                              <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-slate-100 text-xs font-bold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                                {index + 1}
                              </span>
                            </td>

                            <td className="px-3 py-3">
                              <input
                                value={item.entityName}
                                onChange={(event) =>
                                  updateItem(
                                    index,
                                    "entityName",
                                    event.target.value
                                  )
                                }
                                placeholder="Customer / Vendor"
                                className={`${inputClass} min-w-[165px]`}
                              />
                            </td>

                            <td className="px-3 py-3">
                              <select
                                value={item.accountId}
                                onChange={(event) =>
                                  updateItem(
                                    index,
                                    "accountId",
                                    event.target.value
                                  )
                                }
                                required
                                className={`${inputClass} min-w-[240px]`}
                              >
                                <option value="">Select Account</option>

                                {selectableAccounts.map((account) => (
                                  <option
                                    key={account.account_id}
                                    value={account.account_id}
                                  >
                                    {account.account_code} -{" "}
                                    {account.account_name}
                                  </option>
                                ))}
                              </select>
                            </td>

                            <td className="px-3 py-3">
                              <input
                                value={item.description}
                                onChange={(event) =>
                                  updateItem(
                                    index,
                                    "description",
                                    event.target.value
                                  )
                                }
                                placeholder="Line description"
                                className={`${inputClass} min-w-[180px]`}
                              />
                            </td>

                            <td className="px-3 py-3">
                              <div className="relative">
                                <input
                                  type="number"
                                  step="0.01"
                                  min="0"
                                  value={item.debit}
                                  onChange={(event) =>
                                    updateItem(
                                      index,
                                      "debit",
                                      event.target.value
                                    )
                                  }
                                  placeholder="0.00"
                                  className={`${inputClass} min-w-[125px] text-right font-medium tabular-nums`}
                                />
                              </div>
                            </td>

                            <td className="px-3 py-3">
                              <input
                                type="number"
                                step="0.01"
                                min="0"
                                value={item.credit}
                                onChange={(event) =>
                                  updateItem(
                                    index,
                                    "credit",
                                    event.target.value
                                  )
                                }
                                placeholder="0.00"
                                className={`${inputClass} min-w-[125px] text-right font-medium tabular-nums`}
                              />
                            </td>

                            <td className="px-3 py-3 text-center">
                              <button
                                type="button"
                                onClick={() => removeLine(index)}
                                disabled={items.length <= 2}
                                title={
                                  items.length <= 2
                                    ? "At least two lines are required"
                                    : "Remove this line"
                                }
                                className="inline-flex h-10 w-10 items-center justify-center rounded-xl text-slate-400 transition hover:bg-red-50 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-30 dark:hover:bg-red-950/40 dark:hover:text-red-400"
                                aria-label={`Remove journal line ${index + 1}`}
                              >
                                <Trash2 size={17} />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>

                      <tfoot>
                        <tr className="border-t-2 border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-800/70">
                          <td
                            colSpan={4}
                            className="px-4 py-4 text-right text-sm font-extrabold text-slate-700 dark:text-slate-200"
                          >
                            TOTAL
                          </td>

                          <td className="px-3 py-4 text-right text-sm font-extrabold tabular-nums text-blue-700 dark:text-blue-300">
                            {money(totalDebit)}
                          </td>

                          <td className="px-3 py-4 text-right text-sm font-extrabold tabular-nums text-emerald-700 dark:text-emerald-300">
                            {money(totalCredit)}
                          </td>

                          <td />
                        </tr>
                      </tfoot>
                    </table>
                  </div>

                  <div className="border-t border-slate-200 bg-white px-4 py-3 dark:border-slate-800 dark:bg-slate-900">
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Tip: Enter a debit amount or a credit amount for each
                      line. The opposite amount is cleared automatically.
                    </p>
                  </div>
                </div>
              </section>

              {/* BALANCE SUMMARY */}
              <section
                className={`rounded-2xl border p-5 transition ${balanced
                    ? "border-emerald-200 bg-gradient-to-r from-emerald-50 to-green-50 dark:border-emerald-900/60 dark:from-emerald-950/30 dark:to-green-950/20"
                    : "border-amber-200 bg-gradient-to-r from-amber-50 to-orange-50 dark:border-amber-900/60 dark:from-amber-950/30 dark:to-orange-950/20"
                  }`}
              >
                <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
                  <div className="flex items-start gap-3">
                    <div
                      className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${balanced
                          ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/60 dark:text-emerald-300"
                          : "bg-amber-100 text-amber-700 dark:bg-amber-900/60 dark:text-amber-300"
                        }`}
                    >
                      {balanced ? (
                        <CheckCircle2 size={23} />
                      ) : (
                        <CircleAlert size={23} />
                      )}
                    </div>

                    <div>
                      <h3
                        className={`text-base font-extrabold ${balanced
                            ? "text-emerald-900 dark:text-emerald-200"
                            : "text-amber-900 dark:text-amber-200"
                          }`}
                      >
                        {balanced
                          ? "Journal is balanced"
                          : "Journal needs balancing"}
                      </h3>

                      <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                        {balanced
                          ? "Total debits match total credits. You can continue to post this journal."
                          : "Adjust your debit or credit entries until the difference reaches zero."}
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 lg:min-w-[540px]">
                    <div className="rounded-xl border border-white/80 bg-white/80 p-3 dark:border-slate-700 dark:bg-slate-900/70">
                      <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                        Total Debit
                      </p>
                      <p className="mt-1 text-lg font-extrabold tabular-nums text-blue-700 dark:text-blue-300">
                        {money(totalDebit)}
                      </p>
                    </div>

                    <div className="rounded-xl border border-white/80 bg-white/80 p-3 dark:border-slate-700 dark:bg-slate-900/70">
                      <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                        Total Credit
                      </p>
                      <p className="mt-1 text-lg font-extrabold tabular-nums text-emerald-700 dark:text-emerald-300">
                        {money(totalCredit)}
                      </p>
                    </div>

                    <div className="rounded-xl border border-white/80 bg-white/80 p-3 dark:border-slate-700 dark:bg-slate-900/70">
                      <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                        Difference
                      </p>
                      <p
                        className={`mt-1 text-lg font-extrabold tabular-nums ${balanced
                            ? "text-emerald-700 dark:text-emerald-300"
                            : "text-amber-700 dark:text-amber-300"
                          }`}
                      >
                        {money(difference)}
                      </p>
                    </div>
                  </div>
                </div>
              </section>

              {/* FORM ACTIONS */}
              <div className="flex flex-col-reverse justify-between gap-3 border-t border-slate-200 pt-6 dark:border-slate-800 sm:flex-row sm:items-center">
                <button
                  type="button"
                  onClick={cancelForm}
                  disabled={saving}
                  className={secondaryButtonClass}
                >
                  <X size={17} />
                  Cancel
                </button>

                <div className="flex flex-col gap-3 sm:flex-row">
                  <button
                    type="button"
                    onClick={() => {
                      setForm({ ...emptyForm, journalDate: todayString() });
                      setItems([
                        { ...emptyLine },
                        { ...emptyLine },
                      ]);
                      setEditingJournalId(null);
                      setError("");
                    }}
                    disabled={saving || Boolean(editingJournalId)}
                    className={secondaryButtonClass}
                  >
                    <RotateCcw size={16} />
                    Reset Form
                  </button>

                  <button
                    type="submit"
                    disabled={
  saving ||
  !balanced ||
  selectableAccounts.length === 0 ||
  (editingJournalId ? !canUpdate : !canCreate)
}
                    className={greenButtonClass}
                  >
                    {saving ? (
                      <LoaderCircle size={17} className="animate-spin" />
                    ) : (
                      <Save size={17} />
                    )}

                    {saving
                      ? "Saving Journal..."
                      : editingJournalId
                        ? "Update Journal"
                        : "Post Journal"}
                  </button>
                </div>
              </div>
            </div>
          </form>
        )}

        {/* ================================================= */}
        {/* JOURNAL HISTORY */}
        {/* ================================================= */}

        {!showForm && (
          <section className={panelClass}>
            {/* HISTORY HEADER */}
            <div className="border-b border-slate-200 p-5 dark:border-slate-800 sm:p-6">
              <div className="flex flex-col justify-between gap-4 xl:flex-row xl:items-center">
                <SectionTitle
                  icon={BookOpen}
                  title="Journal History"
                  description="Search, view, and edit your recorded journal vouchers."
                  action={
                    <span className="inline-flex w-fit items-center gap-2 rounded-full border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-bold text-blue-700 dark:border-blue-900/60 dark:bg-blue-950/40 dark:text-blue-300">
                      <FileText size={14} />
                      {filteredJournals.length}{" "}
                      {filteredJournals.length === 1
                        ? "entry"
                        : "entries"}
                    </span>
                  }
                />

                {/* SEARCH AND FILTERS */}
                <div className="flex flex-col gap-3 sm:flex-row">
                  <div className="relative min-w-0 sm:min-w-[250px]">
                    <Search
                      size={17}
                      className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
                    />

                    <input
                      value={search}
                      onChange={(event) => setSearch(event.target.value)}
                      placeholder="Search journal number..."
                      className={`${inputClass} pl-10`}
                    />
                  </div>

                  <div className="relative">
                    <Filter
                      size={16}
                      className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
                    />

                    <select
                      value={statusFilter}
                      onChange={(event) =>
                        setStatusFilter(event.target.value)
                      }
                      className={`${inputClass} min-w-[155px] pl-10`}
                      aria-label="Filter journals by status"
                    >
                      <option value="ALL">All Statuses</option>
                      <option value="POSTED">Posted</option>
                      <option value="APPROVED">Approved</option>
                      <option value="DRAFT">Draft</option>
                      <option value="PENDING">Pending</option>
                      <option value="CANCELLED">Cancelled</option>
                      <option value="VOID">Void</option>
                    </select>
                  </div>
                </div>
              </div>
            </div>

            {/* TABLE */}
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1000px] border-collapse">
                <thead>
                  <tr className="bg-slate-50 dark:bg-slate-800/70">
                    <th className="px-5 py-4 text-left text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                      Journal
                    </th>

                    <th className="px-5 py-4 text-left text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                      Date
                    </th>

                    <th className="px-5 py-4 text-left text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                      Description
                    </th>

                    <th className="px-5 py-4 text-right text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                      Debit
                    </th>

                    <th className="px-5 py-4 text-right text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                      Credit
                    </th>

                    <th className="px-5 py-4 text-center text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                      Status
                    </th>

                    <th className="px-5 py-4 text-center text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                      Actions
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {filteredJournals.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-5 py-16 text-center">
                        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-blue-50 text-blue-600 dark:bg-blue-950/50 dark:text-blue-400">
                          {search || statusFilter !== "ALL" ? (
                            <Search size={28} />
                          ) : (
                            <BookOpen size={28} />
                          )}
                        </div>

                        <h3 className="mt-4 text-base font-bold text-slate-900 dark:text-white">
                          {search || statusFilter !== "ALL"
                            ? "No matching journals"
                            : "No journal entries yet"}
                        </h3>

                        <p className="mx-auto mt-2 max-w-md text-sm text-slate-500 dark:text-slate-400">
                          {search || statusFilter !== "ALL"
                            ? "Try a different search term or change the status filter."
                            : "Your journal vouchers will appear here after you create your first entry."}
                        </p>

                        {search || statusFilter !== "ALL" ? (
                          <button
                            type="button"
                            onClick={() => {
                              setSearch("");
                              setStatusFilter("ALL");
                            }}
                            className={`${secondaryButtonClass} mt-5`}
                          >
                            <RotateCcw size={16} />
                            Clear Filters
                          </button>
                        ) : (
  canCreate && (
    <button
      type="button"
      onClick={addJournal}
      className={`${primaryButtonClass} mt-5`}
    >
      <Plus size={17} />
      Create First Journal
    </button>
  )
)}
                    
                      </td>
                    </tr>
                  ) : (
                    filteredJournals.map((journal) => (
                      <tr
                        key={journal.journal_id}
                        className="border-t border-slate-100 transition hover:bg-blue-50/40 dark:border-slate-800 dark:hover:bg-slate-800/40"
                      >
                        <td className="px-5 py-4">
                          <button
                            type="button"
                            onClick={() => viewJournal(journal.journal_id)}
                            className="group flex items-center gap-3 text-left"
                          >
                            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600 transition group-hover:bg-blue-100 dark:bg-blue-950/60 dark:text-blue-400 dark:group-hover:bg-blue-900/60">
                              <FileText size={18} />
                            </div>

                            <div>
                              <p className="font-bold text-slate-900 transition group-hover:text-blue-700 dark:text-white dark:group-hover:text-blue-300">
                                {journal.journal_number ||
                                  `JV-${journal.journal_id}`}
                              </p>

                              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                                ID: {journal.journal_id}
                              </p>
                            </div>
                          </button>
                        </td>

                        <td className="px-5 py-4">
                          <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
                            <CalendarDays
                              size={15}
                              className="shrink-0 text-slate-400"
                            />
                            {formatDate(journal.journal_date)}
                          </div>
                        </td>

                        <td className="max-w-[280px] px-5 py-4">
                          <p
                            className="truncate text-sm text-slate-600 dark:text-slate-300"
                            title={journal.description || ""}
                          >
                            {journal.description || "No description"}
                          </p>
                        </td>

                        <td className="px-5 py-4 text-right">
                          <span className="font-semibold tabular-nums text-blue-700 dark:text-blue-300">
                            {money(journal.total_debit)}
                          </span>
                        </td>

                        <td className="px-5 py-4 text-right">
                          <span className="font-semibold tabular-nums text-emerald-700 dark:text-emerald-300">
                            {money(journal.total_credit)}
                          </span>
                        </td>

                        <td className="px-5 py-4 text-center">
                          <StatusBadge status={journal.status} />
                        </td>

                        <td className="px-5 py-4">
                          <div className="flex items-center justify-center gap-2">
                            <button
                              type="button"
                              onClick={() => viewJournal(journal.journal_id)}
                              title="View journal voucher"
                              aria-label="View journal voucher"
                              className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:border-blue-900 dark:hover:bg-blue-950/50 dark:hover:text-blue-300"
                            >
                              <Eye size={16} />
                            </button>

                            {canUpdate && (
  <button
    type="button"
    onClick={() => editJournal(journal.journal_id)}
    title="Edit journal"
    aria-label="Edit journal"
    className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-blue-200 bg-blue-50 text-blue-700 transition hover:bg-blue-100 dark:border-blue-900/60 dark:bg-blue-950/40 dark:text-blue-300 dark:hover:bg-blue-900/50"
  >
    <Pencil size={15} />
  </button>
)}
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* TABLE FOOTER */}
            <div className="flex flex-col justify-between gap-2 border-t border-slate-200 bg-slate-50/70 px-5 py-4 dark:border-slate-800 dark:bg-slate-900 sm:flex-row sm:items-center">
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Showing{" "}
                <span className="font-bold text-slate-700 dark:text-slate-200">
                  {filteredJournals.length}
                </span>{" "}
                of{" "}
                <span className="font-bold text-slate-700 dark:text-slate-200">
                  {journals.length}
                </span>{" "}
                journal entries
              </p>

              <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                <ShieldCheck size={15} className="text-emerald-600" />
                Double-entry journal management
              </div>
            </div>
          </section>
        )}

        {/* ================================================= */}
        {/* JOURNAL VOUCHER POPUP */}
        {/* ================================================= */}

        {showPopup && selectedJournal && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-3 backdrop-blur-sm sm:p-5"
            onMouseDown={(event) => {
              if (event.target === event.currentTarget) {
                closePopup();
              }
            }}
          >
            <div
              role="dialog"
              aria-modal="true"
              aria-labelledby="journal-voucher-title"
              className="flex max-h-[95vh] w-full max-w-6xl flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-900"
            >
              {/* VOUCHER HEADER */}
              <div className="relative overflow-hidden bg-gradient-to-r from-blue-700 via-blue-600 to-indigo-700 px-5 py-5 text-white sm:px-7">
                <div className="pointer-events-none absolute -right-8 -top-12 h-40 w-40 rounded-full bg-white/10 blur-xl" />

                <div className="relative flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-white/20 bg-white/10 text-lg font-extrabold backdrop-blur">
                      JV
                    </div>

                    <div>
                      <h2
                        id="journal-voucher-title"
                        className="text-xl font-extrabold sm:text-2xl"
                      >
                        Journal Voucher
                      </h2>

                      <p className="mt-1 text-sm text-blue-100">
                        {selectedJournal.journal_number ||
                          `JV-${selectedJournal.journal_id}`}
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={closePopup}
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/20 bg-white/10 text-white transition hover:bg-white/20"
                    aria-label="Close journal voucher"
                  >
                    <X size={20} />
                  </button>
                </div>
              </div>

              {/* VOUCHER BODY */}
              <div className="flex-1 overflow-auto p-4 sm:p-6">
                {/* VOUCHER DETAILS */}
                <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950">
                    <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                      <FileText size={14} />
                      Journal Number
                    </div>

                    <p className="mt-2 break-words text-base font-extrabold text-slate-900 dark:text-white">
                      {selectedJournal.journal_number ||
                        `JV-${selectedJournal.journal_id}`}
                    </p>
                  </div>

                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950">
                    <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                      <CalendarDays size={14} />
                      Journal Date
                    </div>

                    <p className="mt-2 text-base font-extrabold text-slate-900 dark:text-white">
                      {formatDate(selectedJournal.journal_date)}
                    </p>
                  </div>

                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950">
                    <div className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                      Status
                    </div>

                    <div className="mt-2">
                      <StatusBadge status={selectedJournal.status} />
                    </div>
                  </div>

                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950">
                    <div className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                      Description
                    </div>

                    <p className="mt-2 break-words text-sm font-semibold text-slate-900 dark:text-white">
                      {selectedJournal.description || "No description"}
                    </p>
                  </div>
                </div>

                {/* VOUCHER LINES */}
                <div className="overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-800">
                  <div className="flex items-center gap-2 border-b border-slate-200 px-4 py-4 dark:border-slate-800">
                    <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-950/60 dark:text-blue-400">
                      <Layers3 size={18} />
                    </div>

                    <div>
                      <h3 className="font-bold text-slate-900 dark:text-white">
                        Transaction Details
                      </h3>

                      <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                        {selectedJournalLines.length} journal{" "}
                        {selectedJournalLines.length === 1 ? "line" : "lines"}
                      </p>
                    </div>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[760px] border-collapse">
                      <thead>
                        <tr className="bg-slate-50 dark:bg-slate-800/70">
                          <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                            Entity
                          </th>

                          <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                            Account
                          </th>

                          <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                            Description
                          </th>

                          <th className="px-4 py-3 text-right text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                            Debit
                          </th>

                          <th className="px-4 py-3 text-right text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                            Credit
                          </th>
                        </tr>
                      </thead>

                      <tbody>
                        {selectedJournalLines.length === 0 ? (
                          <tr>
                            <td
                              colSpan={5}
                              className="px-4 py-12 text-center text-sm text-slate-500 dark:text-slate-400"
                            >
                              No journal lines were returned by the API.
                            </td>
                          </tr>
                        ) : (
                          selectedJournalLines.map((line, index) => (
                            <tr
                              key={
                                line.journal_line_id ||
                                `${line.account_id}-${index}`
                              }
                              className="border-t border-slate-100 dark:border-slate-800"
                            >
                              <td className="px-4 py-4 text-sm text-slate-600 dark:text-slate-300">
                                {line.entity_name || "—"}
                              </td>

                              <td className="px-4 py-4">
                                <p className="font-bold text-slate-900 dark:text-white">
                                  {line.account_code || "—"}
                                </p>

                                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                                  {line.account_name || ""}
                                </p>
                              </td>

                              <td className="max-w-[260px] px-4 py-4 text-sm text-slate-600 dark:text-slate-300">
                                {line.description || "—"}
                              </td>

                              <td className="px-4 py-4 text-right text-sm font-semibold tabular-nums text-blue-700 dark:text-blue-300">
                                {money(line.debit)}
                              </td>

                              <td className="px-4 py-4 text-right text-sm font-semibold tabular-nums text-emerald-700 dark:text-emerald-300">
                                {money(line.credit)}
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>

                      <tfoot>
                        <tr className="border-t-2 border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-800/70">
                          <td
                            colSpan={3}
                            className="px-4 py-4 text-right text-sm font-extrabold text-slate-700 dark:text-slate-200"
                          >
                            TOTAL
                          </td>

                          <td className="px-4 py-4 text-right text-sm font-extrabold tabular-nums text-blue-700 dark:text-blue-300">
                            {money(selectedJournal.total_debit)}
                          </td>

                          <td className="px-4 py-4 text-right text-sm font-extrabold tabular-nums text-emerald-700 dark:text-emerald-300">
                            {money(selectedJournal.total_credit)}
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </div>

                {/* BALANCE SUMMARY */}
                <div className="mt-5 rounded-2xl border border-emerald-200 bg-gradient-to-r from-emerald-50 to-green-50 p-5 dark:border-emerald-900/60 dark:from-emerald-950/30 dark:to-green-950/20">
                  <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
                    <div className="flex items-center gap-3">
                      <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700 dark:bg-emerald-900/60 dark:text-emerald-300">
                        <CheckCircle2 size={22} />
                      </div>

                      <div>
                        <p className="font-extrabold text-emerald-900 dark:text-emerald-200">
                          Journal Voucher Summary
                        </p>

                        <p className="mt-1 text-sm text-emerald-800/80 dark:text-emerald-300/80">
                          Compare the debit and credit totals before printing.
                        </p>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3 sm:min-w-[300px]">
                      <div className="rounded-xl border border-emerald-200/70 bg-white/80 p-3 dark:border-emerald-900/50 dark:bg-slate-900/60">
                        <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                          Total Debit
                        </p>

                        <p className="mt-1 text-lg font-extrabold tabular-nums text-blue-700 dark:text-blue-300">
                          {money(selectedJournal.total_debit)}
                        </p>
                      </div>

                      <div className="rounded-xl border border-emerald-200/70 bg-white/80 p-3 dark:border-emerald-900/50 dark:bg-slate-900/60">
                        <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                          Total Credit
                        </p>

                        <p className="mt-1 text-lg font-extrabold tabular-nums text-emerald-700 dark:text-emerald-300">
                          {money(selectedJournal.total_credit)}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* VOUCHER FOOTER */}
              <div className="flex flex-col-reverse justify-between gap-3 border-t border-slate-200 bg-slate-50 px-4 py-4 dark:border-slate-800 dark:bg-slate-950 sm:flex-row sm:items-center sm:px-6">
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  ERP Software · Journal Voucher
                </p>

                <div className="flex flex-wrap justify-end gap-2">
                  <button
                    type="button"
                    onClick={closePopup}
                    className={secondaryButtonClass}
                  >
                    <X size={16} />
                    Close
                  </button>

                  <button
                    type="button"
                    onClick={downloadPDF}
                    className={secondaryButtonClass}
                  >
                    <Download size={16} />
                    Save as PDF
                  </button>

                  <button
                    type="button"
                    onClick={printJournal}
                    className={primaryButtonClass}
                  >
                    <Printer size={16} />
                    Print Voucher
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* LOADING JOURNAL DETAILS */}
        {loadingDetails && (
          <div className="fixed bottom-5 right-5 z-[60] flex items-center gap-3 rounded-2xl border border-slate-700 bg-slate-900 px-5 py-4 text-sm font-semibold text-white shadow-2xl">
            <LoaderCircle size={19} className="animate-spin text-blue-400" />
            Loading journal...
          </div>
        )}
      </div>
    </div>
  );
}