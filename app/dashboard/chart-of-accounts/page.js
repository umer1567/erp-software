"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Activity,
  AlertCircle,
  ArrowRight,
  BookOpen,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  CircleDollarSign,
  ClipboardList,
  FilePlus2,
  Folder,
  FolderOpen,
  Landmark,
  Layers3,
  LoaderCircle,
  Plus,
  Pencil,
  RefreshCw,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  Wallet,
  X,
  LockKeyhole,
  Eye,
} from "lucide-react";

const ACCOUNT_TYPES = [
  "ASSET",
  "LIABILITY",
  "EQUITY",
  "REVENUE",
  "EXPENSE",
];

const emptyForm = {
  accountCode: "",
  accountName: "",
  accountType: "ASSET",
  isSummary: false,
  parentAccountId: "",
  openingBalance: "",
  isActive: true,
  isCashBank: false,
};

const NO_PERMISSIONS = {
  canView: false,
  canCreate: false,
  canUpdate: false,
  canDelete: false,
};

const inputClass =
  "w-full rounded-xl border border-slate-200 bg-white px-3.5 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 hover:border-slate-300 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:placeholder:text-slate-500 dark:hover:border-slate-600 dark:focus:border-blue-400";

const labelClass =
  "mb-2 block text-sm font-semibold text-slate-700 dark:text-slate-300";

const panelClass =
  "rounded-2xl border border-slate-200/80 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900";

const buttonSecondary =
  "inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:border-slate-600 dark:hover:bg-slate-800";

const typeStyles = {
  ASSET:
    "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-800 dark:bg-blue-950/60 dark:text-blue-300",
  LIABILITY:
    "border-orange-200 bg-orange-50 text-orange-700 dark:border-orange-800 dark:bg-orange-950/40 dark:text-orange-300",
  EQUITY:
    "border-violet-200 bg-violet-50 text-violet-700 dark:border-violet-800 dark:bg-violet-950/40 dark:text-violet-300",
  REVENUE:
    "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300",
  EXPENSE:
    "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-300",
};

async function readApiResponse(response) {
  const text = await response.text();
  let data = {};

  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      const error = new Error(
        `Invalid server response (${response.status}). Check the server logs.`
      );
      error.status = response.status;
      throw error;
    }
  }

  if (!response.ok || data.success === false) {
    const error = new Error(
      data.message ||
        data.error ||
        `Request failed (${response.status}).`
    );

    error.status = response.status;
    error.data = data;
    throw error;
  }

  return data;
}

function normalizeAccounts(data) {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.accounts)) return data.accounts;
  return [];
}

function normalizePermissions(data) {
  const source = data?.permissions;

  if (!source || typeof source !== "object") {
    return { ...NO_PERMISSIONS };
  }

  return {
    canView: source.canView === true || source.can_view === true,
    canCreate: source.canCreate === true || source.can_create === true,
    canUpdate: source.canUpdate === true || source.can_update === true,
    canDelete: source.canDelete === true || source.can_delete === true,
  };
}

function formatMoney(value) {
  return Number(value || 0).toLocaleString("en-PK", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function formatCount(value) {
  return Number(value || 0).toLocaleString("en-PK");
}

function getTypeStyle(type) {
  return (
    typeStyles[String(type || "").toUpperCase()] ||
    "border-slate-200 bg-slate-100 text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
  );
}

function SummaryCard({
  title,
  value,
  description,
  icon: Icon,
  tone = "blue",
}) {
  const tones = {
    blue: {
      icon: "bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300",
      top: "from-blue-500 to-blue-700",
    },
    green: {
      icon:
        "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300",
      top: "from-emerald-500 to-green-600",
    },
    cyan: {
      icon: "bg-cyan-100 text-cyan-700 dark:bg-cyan-500/15 dark:text-cyan-300",
      top: "from-cyan-500 to-blue-500",
    },
    violet: {
      icon:
        "bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300",
      top: "from-violet-500 to-indigo-600",
    },
  };

  const colors = tones[tone] || tones.blue;

  return (
    <div className="group relative overflow-hidden rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg dark:border-slate-800 dark:bg-slate-900">
      <div
        className={`absolute inset-x-0 top-0 h-1 bg-gradient-to-r ${colors.top}`}
      />

      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
            {title}
          </p>
          <p className="mt-3 text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
            {value}
          </p>
          <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
            {description}
          </p>
        </div>

        <div
          className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl ${colors.icon}`}
        >
          <Icon size={23} />
        </div>
      </div>
    </div>
  );
}

function SectionHeading({ icon: Icon, title, description }) {
  return (
    <div className="flex items-start gap-3">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-300">
        <Icon size={20} />
      </div>

      <div>
        <h3 className="font-bold text-slate-900 dark:text-white">{title}</h3>
        <p className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400">
          {description}
        </p>
      </div>
    </div>
  );
}

function FormCheckbox({
  name,
  checked,
  onChange,
  title,
  description,
  icon: Icon,
}) {
  return (
    <label className="group flex min-h-[76px] cursor-pointer items-start gap-3 rounded-xl border border-slate-200 bg-white p-3.5 transition hover:border-blue-300 hover:bg-blue-50/50 dark:border-slate-700 dark:bg-slate-950 dark:hover:border-blue-800 dark:hover:bg-blue-950/20">
      <input
        type="checkbox"
        name={name}
        checked={Boolean(checked)}
        onChange={onChange}
        className="mt-1 h-4 w-4 shrink-0 cursor-pointer accent-blue-600"
      />

      {Icon && (
        <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-600 group-hover:bg-blue-100 group-hover:text-blue-700 dark:bg-slate-800 dark:text-slate-300 dark:group-hover:bg-blue-500/15 dark:group-hover:text-blue-300">
          <Icon size={17} />
        </div>
      )}

      <span className="min-w-0">
        <span className="block text-sm font-semibold text-slate-800 dark:text-slate-200">
          {title}
        </span>

        {description && (
          <span className="mt-1 block text-xs leading-4 text-slate-500 dark:text-slate-400">
            {description}
          </span>
        )}
      </span>
    </label>
  );
}

function AccountFormFields({
  form,
  onChange,
  parentOptions,
  mode = "add",
}) {
  return (
    <div className="space-y-6">
      <section>
        <SectionHeading
          icon={ClipboardList}
          title="Account Information"
          description="Enter the account code, name, and financial category."
        />

        <div className="mt-5 grid grid-cols-1 gap-5 md:grid-cols-2">
          <div>
            <label className={labelClass} htmlFor={`${mode}-account-code`}>
              Account Code <span className="text-rose-500">*</span>
            </label>

            <input
              id={`${mode}-account-code`}
              name="accountCode"
              value={form.accountCode}
              onChange={onChange}
              placeholder="e.g. 1100"
              autoComplete="off"
              className={inputClass}
              required
            />

            <p className="mt-1.5 text-xs text-slate-500 dark:text-slate-400">
              Use your company&apos;s chart of accounts coding structure.
            </p>
          </div>

          <div>
            <label className={labelClass} htmlFor={`${mode}-account-name`}>
              Account Name <span className="text-rose-500">*</span>
            </label>

            <input
              id={`${mode}-account-name`}
              name="accountName"
              value={form.accountName}
              onChange={onChange}
              placeholder="e.g. Cash in Hand"
              className={inputClass}
              required
            />
          </div>

          <div>
            <label className={labelClass} htmlFor={`${mode}-account-type`}>
              Account Type
            </label>

            <select
              id={`${mode}-account-type`}
              name="accountType"
              value={form.accountType}
              onChange={onChange}
              className={inputClass}
            >
              {ACCOUNT_TYPES.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>

            <div className="mt-2">
              <span
                className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${getTypeStyle(form.accountType)}`}
              >
                {form.accountType}
              </span>
            </div>
          </div>

          <div>
            <label
              className={labelClass}
              htmlFor={`${mode}-parent-account`}
            >
              Parent Account
            </label>

            <select
              id={`${mode}-parent-account`}
              name="parentAccountId"
              value={form.parentAccountId}
              onChange={onChange}
              className={inputClass}
            >
              <option value="">No Parent — Root Account</option>

              {parentOptions.map((account) => (
                <option
                  key={account.account_id}
                  value={String(account.account_id)}
                >
                  {account.account_code} - {account.account_name}
                </option>
              ))}
            </select>

            <p className="mt-1.5 text-xs text-slate-500 dark:text-slate-400">
              Select a summary account to create a child account.
            </p>
          </div>

          <div>
            <label
              className={labelClass}
              htmlFor={`${mode}-opening-balance`}
            >
              Opening Balance (PKR)
            </label>

            <div className="relative">
              <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-500 dark:text-slate-400">
                PKR
              </span>

              <input
                id={`${mode}-opening-balance`}
                type="number"
                min="0"
                step="0.01"
                name="openingBalance"
                value={form.openingBalance}
                onChange={onChange}
                placeholder="0.00"
                className={`${inputClass} pl-14`}
              />
            </div>
          </div>

          <div>
            <label className={labelClass}>Account Structure</label>

            <FormCheckbox
              name="isSummary"
              checked={form.isSummary}
              onChange={onChange}
              title="Summary Account"
              description="Allows child accounts beneath this account."
              icon={Folder}
            />
          </div>
        </div>
      </section>

      <section className="border-t border-slate-200 pt-5 dark:border-slate-800">
        <SectionHeading
          icon={ShieldCheck}
          title="Account Settings"
          description="Configure account availability and cash/bank classification."
        />

        <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2">
          <FormCheckbox
            name="isActive"
            checked={form.isActive}
            onChange={onChange}
            title="Active Account"
            description="Keep this account available for use."
            icon={CheckCircle2}
          />

          <FormCheckbox
            name="isCashBank"
            checked={form.isCashBank}
            onChange={onChange}
            title="Cash / Bank Account"
            description="Identify this account as a cash or bank account."
            icon={Landmark}
          />
        </div>
      </section>
    </div>
  );
}

function AccountRow({
  account,
  level,
  searchActive,
  expandedAccounts,
  onToggle,
  onAddChild,
  onEdit,
  onView,
  canCreate,
  canUpdate,
}) {
  const hasChildren = Boolean(account.children?.length);

  const isExpanded =
    searchActive || expandedAccounts.has(Number(account.account_id));

  return (
    <div className="w-full">
      <div className="border-b border-slate-100 bg-white transition-colors hover:bg-blue-50/40 dark:border-slate-800/80 dark:bg-slate-900 dark:hover:bg-blue-950/20">
        <div
          className="flex min-h-[76px] items-center px-5 py-3"
          style={{ paddingLeft: `${20 + level * 28}px` }}
        >
          <div className="mr-3 flex w-7 shrink-0 justify-center">
            {hasChildren ? (
              <button
                type="button"
                onClick={() => onToggle(account.account_id)}
                className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 transition hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:border-blue-700 dark:hover:bg-blue-950 dark:hover:text-blue-300"
                aria-label={isExpanded ? "Collapse account" : "Expand account"}
              >
                {isExpanded ? (
                  <ChevronDown size={16} />
                ) : (
                  <ChevronRight size={16} />
                )}
              </button>
            ) : (
              <div className="flex h-8 w-8 items-center justify-center text-slate-300 dark:text-slate-600">
                <span className="h-1.5 w-1.5 rounded-full bg-slate-300 dark:bg-slate-600" />
              </div>
            )}
          </div>

          <div className="w-[150px] shrink-0">
            <span className="inline-flex rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 font-mono text-xs font-bold text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200">
              {account.account_code || "-"}
            </span>
          </div>

          <div className="min-w-0 flex-1 pr-4">
            <div className="flex flex-wrap items-center gap-2">
              {account.is_group ? (
                <FolderOpen
                  size={16}
                  className="shrink-0 text-blue-600 dark:text-blue-400"
                />
              ) : (
                <CircleDollarSign
                  size={16}
                  className="shrink-0 text-emerald-600 dark:text-emerald-400"
                />
              )}

              <span
                className={
                  account.is_group
                    ? "font-bold text-slate-900 dark:text-white"
                    : "font-medium text-slate-700 dark:text-slate-200"
                }
              >
                {account.account_name}
              </span>

              {account.is_group && (
                <span className="inline-flex rounded-full border border-violet-200 bg-violet-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-violet-700 dark:border-violet-800 dark:bg-violet-950/50 dark:text-violet-300">
                  Summary
                </span>
              )}

              {account.is_cash_bank && (
                <span className="inline-flex items-center gap-1 rounded-full border border-cyan-200 bg-cyan-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-cyan-700 dark:border-cyan-800 dark:bg-cyan-950/40 dark:text-cyan-300">
                  <Landmark size={11} />
                  Cash/Bank
                </span>
              )}
            </div>

            <div className="mt-1 text-[11px] text-slate-400 dark:text-slate-500">
              Account ID: {account.account_id}
            </div>
          </div>

          <div className="w-[120px] shrink-0">
            <span
              className={`inline-flex rounded-full border px-2.5 py-1 text-[10px] font-bold tracking-wide ${getTypeStyle(account.account_type)}`}
            >
              {account.account_type}
            </span>
          </div>

          <div className="w-[130px] shrink-0 text-right">
            <span className="text-sm font-medium tabular-nums text-slate-600 dark:text-slate-300">
              {formatMoney(account.opening_balance)}
            </span>
          </div>

          <div className="w-[140px] shrink-0 text-right">
            <span className="text-sm font-bold tabular-nums text-slate-900 dark:text-white">
              {formatMoney(account.current_balance)}
            </span>
          </div>

          <div className="w-[100px] shrink-0 text-center">
            {account.is_active !== false ? (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                Active
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400">
                <span className="h-1.5 w-1.5 rounded-full bg-slate-400" />
                Inactive
              </span>
            )}
          </div>

          <div className="ml-4 flex w-[260px] shrink-0 items-center justify-end gap-2">
            {/* View remains visible regardless of Create/Edit permission. */}
            <button
              type="button"
              onClick={() => onView(account)}
              title={`View ${account.account_name}`}
              className="inline-flex h-9 items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 text-xs font-bold text-slate-700 transition hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:border-blue-700 dark:hover:bg-blue-950/40 dark:hover:text-blue-300"
            >
              <Eye size={14} />
              View
            </button>

            {/* Create/Child button disappears when Create permission is false. */}
            {canCreate && account.is_group && (
              <button
                type="button"
                onClick={() => onAddChild(account)}
                title={`Add a child account under ${account.account_name}`}
                className="inline-flex h-9 items-center justify-center gap-1.5 rounded-xl border border-emerald-200 bg-emerald-50 px-3 text-xs font-bold text-emerald-700 transition hover:border-emerald-300 hover:bg-emerald-100 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300 dark:hover:bg-emerald-900/40"
              >
                <Plus size={14} />
                Child
              </button>
            )}

            {/* Edit button disappears when Edit permission is false. */}
            {canUpdate && (
              <button
                type="button"
                onClick={() => onEdit(account)}
                title={`Edit ${account.account_name}`}
                className="inline-flex h-9 items-center justify-center gap-1.5 rounded-xl bg-blue-600 px-3.5 text-xs font-bold text-white shadow-sm transition hover:bg-blue-700 active:scale-[0.98] dark:bg-blue-600 dark:hover:bg-blue-500"
              >
                <Pencil size={13} />
                Edit
              </button>
            )}
          </div>
        </div>
      </div>

      {hasChildren && isExpanded && (
        <div className="relative">
          <div
            className="absolute bottom-0 top-0 w-px bg-slate-200 dark:bg-slate-700"
            style={{ left: `${34 + level * 28}px` }}
          />

          {account.children.map((child) => (
            <AccountRow
              key={child.account_id}
              account={child}
              level={level + 1}
              searchActive={searchActive}
              expandedAccounts={expandedAccounts}
              onToggle={onToggle}
              onAddChild={onAddChild}
              onEdit={onEdit}
              onView={onView}
              canCreate={canCreate}
              canUpdate={canUpdate}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function AccountDetailsModal({ account, onClose }) {
  if (!account) return null;

  const details = [
    ["Account ID", account.account_id ?? "-"],
    ["Account Code", account.account_code || "-"],
    ["Account Name", account.account_name || "-"],
    ["Account Type", account.account_type || "-"],
    [
      "Parent Account",
      account.parent_account_id ?? "No Parent",
    ],
    ["Opening Balance", `PKR ${formatMoney(account.opening_balance)}`],
    ["Current Balance", `PKR ${formatMoney(account.current_balance)}`],
    ["Account Category", account.is_group ? "Summary Account" : "Ledger Account"],
    ["Cash / Bank", account.is_cash_bank ? "Yes" : "No"],
    ["Status", account.is_active === false ? "Inactive" : "Active"],
  ];

  return (
    <div
      className="fixed inset-0 z-[110] flex items-center justify-center bg-slate-950/75 p-3 backdrop-blur-sm sm:p-5"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="account-details-title"
        className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-3xl border border-slate-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-900"
      >
        <div className="flex items-center justify-between gap-4 border-b border-slate-200 px-5 py-5 sm:px-7 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300">
              <Eye size={22} />
            </div>

            <div>
              <h2
                id="account-details-title"
                className="text-xl font-bold text-slate-900 dark:text-white"
              >
                Account Details
              </h2>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                Read-only account information
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 text-slate-500 transition hover:bg-slate-100 hover:text-slate-900 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white"
            aria-label="Close account details"
          >
            <X size={19} />
          </button>
        </div>

        <div className="grid grid-cols-1 gap-3 p-5 sm:grid-cols-2 sm:p-7">
          {details.map(([label, value]) => (
            <div
              key={label}
              className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950"
            >
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                {label}
              </p>
              <p className="mt-2 break-words text-sm font-semibold text-slate-900 dark:text-slate-100">
                {String(value)}
              </p>
            </div>
          ))}
        </div>

        <div className="flex justify-end border-t border-slate-200 px-5 py-4 dark:border-slate-800">
          <button
            type="button"
            onClick={onClose}
            className={buttonSecondary}
          >
            Close
          </button>
        </div>
      </section>
    </div>
  );
}

export default function AccountsPage() {
  const [accounts, setAccounts] = useState([]);
  const [permissions, setPermissions] = useState({ ...NO_PERMISSIONS });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [accessDenied, setAccessDenied] = useState(false);

  const [form, setForm] = useState({ ...emptyForm });
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);

  const [editingAccount, setEditingAccount] = useState(null);
  const [viewingAccount, setViewingAccount] = useState(null);
  const [editForm, setEditForm] = useState({ ...emptyForm });
  const [updating, setUpdating] = useState(false);

  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [expandedAccounts, setExpandedAccounts] = useState(new Set());

  /*
   * IMPORTANT:
   * Every successful accounts response must update both accounts and
   * permissions. Otherwise permissions stay false and the page incorrectly
   * displays Access Denied.
   */
  const loadAccounts = useCallback(async (showLoader = true) => {
    try {
      if (showLoader) setLoading(true);

      setError();

      const response = await fetch("/api/accounts", {
        cache: "no-store",
      });

      const data = await readApiResponse(response);
      const loadedAccounts = normalizeAccounts(data);
      const loadedPermissions = normalizePermissions(data);

      setAccounts(loadedAccounts);
      setPermissions(loadedPermissions);
      setAccessDenied(!loadedPermissions.canView);

      if (!loadedPermissions.canView) {
        setAccounts([]);
        setShowForm(false);
        setEditingAccount(null);
        setViewingAccount(null);
      }

      return loadedAccounts;
    } catch (err) {
      console.error("LOAD ACCOUNTS ERROR:", err);

      if (
        err.status === 401 ||
        err.status === 403 ||
        /forbidden|permission denied|unauthorized/i.test(err.message || "")
      ) {
        setAccessDenied(true);
        setAccounts([]);
        setPermissions({ ...NO_PERMISSIONS });
        setShowForm(false);
        setEditingAccount(null);
        setViewingAccount(null);
        setError("");
      } else {
        setError(err.message || "Failed to load accounts.");
      }

      return [];
    } finally {
      if (showLoader) setLoading(false);
    }
  }, []);

  /*
   * Initial load: fetch accounts AND permission information.
   * This replaces the old effect that fetched accounts but forgot permissions.
   */
  useEffect(() => {
    let cancelled = false;

    async function initialLoad() {
      try {
        const response = await fetch("/api/accounts", {
          cache: "no-store",
        });

        const data = await readApiResponse(response);
        const loadedAccounts = normalizeAccounts(data);
        const loadedPermissions = normalizePermissions(data);

        if (cancelled) return;

        setAccounts(loadedPermissions.canView ? loadedAccounts : []);
        setPermissions(loadedPermissions);
        setAccessDenied(!loadedPermissions.canView);
        setError("");

        if (!loadedPermissions.canView) {
          setShowForm(false);
          setEditingAccount(null);
          setViewingAccount(null);
        }
      } catch (err) {
        if (cancelled) return;

        console.error("INITIAL LOAD ACCOUNTS ERROR:", err);

        if (
          err.status === 401 ||
          err.status === 403 ||
          /forbidden|permission denied|unauthorized/i.test(err.message || "")
        ) {
          setAccessDenied(true);
          setAccounts([]);
          setPermissions({ ...NO_PERMISSIONS });
          setError("");
        } else {
          setError(err.message || "Failed to load accounts.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    initialLoad();

    return () => {
      cancelled = true;
    };
  }, []);

  function handleFormChange(event) {
    const { name, value, type, checked } = event.target;

    setForm((previous) => ({
      ...previous,
      [name]: type === "checkbox" ? checked : value,
    }));
  }

  function handleEditChange(event) {
    const { name, value, type, checked } = event.target;

    setEditForm((previous) => ({
      ...previous,
      [name]: type === "checkbox" ? checked : value,
    }));
  }

  function resetAddForm() {
    setForm({ ...emptyForm });
  }

  function cancelAddForm() {
    if (saving) return;

    setShowForm(false);
    resetAddForm();
    setError("");
    setMessage("");
  }

  function openAddForm() {
    if (!permissions.canCreate) return;

    resetAddForm();
    setError("");
    setMessage("");
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function findAccount(accountId, accountList = accounts) {
    return accountList.find(
      (account) => Number(account.account_id) === Number(accountId)
    );
  }

  function getParentName(parentAccountId) {
    if (!parentAccountId) return "No Parent";

    const parent = findAccount(parentAccountId);

    return parent
      ? `${parent.account_code} - ${parent.account_name}`
      : "No Parent";
  }

  function expandParentChain(accountId, accountList = accounts) {
    const idsToExpand = [];
    let currentId = Number(accountId);
    const visited = new Set();

    while (currentId && !visited.has(currentId)) {
      visited.add(currentId);

      const account = accountList.find(
        (item) => Number(item.account_id) === currentId
      );

      if (!account) break;

      if (account.is_group) {
        idsToExpand.push(Number(account.account_id));
      }

      if (!account.parent_account_id) break;

      currentId = Number(account.parent_account_id);
    }

    setExpandedAccounts((previous) => {
      const next = new Set(previous);
      idsToExpand.forEach((id) => next.add(id));
      return next;
    });
  }

  async function saveAccount(event) {
    event.preventDefault();

    if (!permissions.canCreate || saving) return;

    if (!form.accountCode.trim()) {
      setError("Account code is required.");
      return;
    }

    if (!form.accountName.trim()) {
      setError("Account name is required.");
      return;
    }

    const openingBalance = Number(form.openingBalance || 0);

    if (!Number.isFinite(openingBalance) || openingBalance < 0) {
      setError("Opening balance must be a valid non-negative number.");
      return;
    }

    setSaving(true);
    setMessage("");
    setError("");

    try {
      const response = await fetch("/api/accounts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          account_code: form.accountCode.trim(),
          account_name: form.accountName.trim(),
          account_type: form.accountType,
          parent_account_id: form.parentAccountId || null,
          opening_balance: openingBalance,
          is_active: form.isActive,
          is_group: form.isSummary,
          is_cash_bank: form.isCashBank,
        }),
      });

      const data = await readApiResponse(response);
      const createdAccount = data.account;
      const updatedAccounts = await loadAccounts(false);

      if (createdAccount?.parent_account_id) {
        expandParentChain(
          createdAccount.parent_account_id,
          updatedAccounts
        );
      }

      setMessage("Account created successfully.");
      resetAddForm();
      setShowForm(false);
    } catch (err) {
      console.error("CREATE ACCOUNT ERROR:", err);

      if (err.status === 403) {
        setPermissions((previous) => ({
          ...previous,
          canCreate: false,
        }));
        setShowForm(false);
        setError("You do not have permission to create accounts.");
      } else {
        setError(err.message || "Failed to create account.");
      }
    } finally {
      setSaving(false);
    }
  }

  function addChildAccount(parentAccount) {
    if (!permissions.canCreate || !parentAccount.is_group) return;

    setForm({
      ...emptyForm,
      parentAccountId: String(parentAccount.account_id),
      accountType: parentAccount.account_type || "ASSET",
    });

    setMessage("");
    setError("");
    setShowForm(true);
    expandParentChain(parentAccount.account_id);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function getDescendantIds(accountId) {
    const descendants = new Set();
    const visited = new Set();

    function collect(parentId) {
      const normalizedParentId = Number(parentId);

      if (visited.has(normalizedParentId)) return;
      visited.add(normalizedParentId);

      accounts.forEach((account) => {
        const parentIdOfAccount = account.parent_account_id
          ? Number(account.parent_account_id)
          : null;

        if (parentIdOfAccount === normalizedParentId) {
          const childId = Number(account.account_id);

          if (!descendants.has(childId)) {
            descendants.add(childId);
            collect(childId);
          }
        }
      });
    }

    collect(accountId);
    return descendants;
  }

  function editAccount(account) {
    if (!permissions.canUpdate) return;

    setMessage("");
    setError("");
    setEditingAccount(account);

    setEditForm({
      accountCode: account.account_code || "",
      accountName: account.account_name || "",
      accountType: account.account_type || "ASSET",
      isSummary: Boolean(account.is_group),
      parentAccountId: account.parent_account_id
        ? String(account.parent_account_id)
        : "",
      openingBalance:
        account.opening_balance !== null &&
        account.opening_balance !== undefined
          ? String(account.opening_balance)
          : "",
      isActive: account.is_active !== false,
      isCashBank: Boolean(account.is_cash_bank),
    });
  }

  function viewAccount(account) {
    setViewingAccount(account);
  }

  function closeEdit() {
    if (updating) return;

    setEditingAccount(null);
    setEditForm({ ...emptyForm });
  }

  async function updateAccount(event) {
    event.preventDefault();

    if (!permissions.canUpdate || !editingAccount || updating) return;

    if (!editForm.accountCode.trim()) {
      setError("Account code is required.");
      return;
    }

    if (!editForm.accountName.trim()) {
      setError("Account name is required.");
      return;
    }

    const openingBalance = Number(editForm.openingBalance || 0);

    if (!Number.isFinite(openingBalance) || openingBalance < 0) {
      setError("Opening balance must be a valid non-negative number.");
      return;
    }

    setUpdating(true);
    setMessage("");
    setError("");

    try {
      const response = await fetch("/api/accounts", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          account_id: editingAccount.account_id,
          account_code: editForm.accountCode.trim(),
          account_name: editForm.accountName.trim(),
          account_type: editForm.accountType,
          parent_account_id: editForm.parentAccountId || null,
          opening_balance: openingBalance,
          is_active: editForm.isActive,
          is_group: editForm.isSummary,
          is_cash_bank: editForm.isCashBank,
        }),
      });

      const data = await readApiResponse(response);
      const updatedAccount = data.account;
      const updatedAccounts = await loadAccounts(false);

      if (updatedAccount?.parent_account_id) {
        expandParentChain(
          updatedAccount.parent_account_id,
          updatedAccounts
        );
      }

      setEditingAccount(null);
      setEditForm({ ...emptyForm });
      setMessage("Account updated successfully.");
    } catch (err) {
      console.error("UPDATE ACCOUNT ERROR:", err);

      if (err.status === 403) {
        setPermissions((previous) => ({
          ...previous,
          canUpdate: false,
        }));
        setEditingAccount(null);
        setError("You do not have permission to edit accounts.");
      } else {
        setError(err.message || "Failed to update account.");
      }
    } finally {
      setUpdating(false);
    }
  }

  const accountTree = useMemo(() => {
    const accountMap = new Map();

    accounts.forEach((account) => {
      accountMap.set(Number(account.account_id), {
        ...account,
        children: [],
      });
    });

    accounts.forEach((account) => {
      const id = Number(account.account_id);
      const parentId = account.parent_account_id
        ? Number(account.parent_account_id)
        : null;

      if (
        parentId !== null &&
        parentId !== id &&
        accountMap.has(parentId)
      ) {
        accountMap.get(parentId).children.push(accountMap.get(id));
      }
    });

    function sortNode(node) {
      node.children.sort((a, b) =>
        String(a.account_code).localeCompare(
          String(b.account_code),
          undefined,
          { numeric: true }
        )
      );

      node.children.forEach(sortNode);
    }

    accountMap.forEach(sortNode);

    const roots = accounts
      .filter((account) => {
        const id = Number(account.account_id);
        const parentId = account.parent_account_id
          ? Number(account.parent_account_id)
          : null;

        return (
          parentId === null ||
          parentId === id ||
          !accountMap.has(parentId)
        );
      })
      .map((account) => accountMap.get(Number(account.account_id)));

    const renderedIds = new Set();

    function safeNode(node, path = new Set()) {
      if (!node) return null;

      const id = Number(node.account_id);

      if (path.has(id)) return null;

      const nextPath = new Set(path);
      nextPath.add(id);
      renderedIds.add(id);

      return {
        ...node,
        children: node.children
          .map((child) => safeNode(child, nextPath))
          .filter(Boolean),
      };
    }

    const tree = roots.map((root) => safeNode(root)).filter(Boolean);

    accounts.forEach((account) => {
      const id = Number(account.account_id);

      if (!renderedIds.has(id)) {
        const orphan = safeNode(accountMap.get(id));
        if (orphan) tree.push(orphan);
      }
    });

    return tree.sort((a, b) =>
      String(a.account_code).localeCompare(
        String(b.account_code),
        undefined,
        { numeric: true }
      )
    );
  }, [accounts]);

  function toggleAccount(accountId) {
    setExpandedAccounts((previous) => {
      const next = new Set(previous);
      const id = Number(accountId);

      if (next.has(id)) next.delete(id);
      else next.add(id);

      return next;
    });
  }

  function expandAll() {
    setExpandedAccounts(
      new Set(
        accounts
          .filter((account) => account.is_group)
          .map((account) => Number(account.account_id))
      )
    );
  }

  function collapseAll() {
    setExpandedAccounts(new Set());
  }

  const normalizedSearch = search.trim().toLowerCase();

  function accountMatchesSearch(account) {
    if (!normalizedSearch) return true;

    return (
      String(account.account_code || "")
        .toLowerCase()
        .includes(normalizedSearch) ||
      String(account.account_name || "")
        .toLowerCase()
        .includes(normalizedSearch) ||
      String(account.account_type || "")
        .toLowerCase()
        .includes(normalizedSearch)
    );
  }

  function filterTree(items) {
    if (!normalizedSearch) return items;

    return items
      .map((account) => {
        const children = filterTree(account.children || []);

        if (accountMatchesSearch(account) || children.length > 0) {
          return { ...account, children };
        }

        return null;
      })
      .filter(Boolean);
  }

  const filteredAccountTree = filterTree(accountTree);

  const editParentOptions = useMemo(() => {
    if (!editingAccount) return [];

    const editingId = Number(editingAccount.account_id);
    const descendantIds = getDescendantIds(editingId);

    return accounts.filter((account) => {
      const accountId = Number(account.account_id);

      return (
        account.is_group &&
        accountId !== editingId &&
        !descendantIds.has(accountId)
      );
    });
  }, [accounts, editingAccount]);

  const parentOptions = useMemo(
    () => accounts.filter((account) => account.is_group),
    [accounts]
  );

  const stats = useMemo(() => {
    const active = accounts.filter(
      (account) => account.is_active !== false
    ).length;

    const summary = accounts.filter(
      (account) => Boolean(account.is_group)
    ).length;

    const cashBank = accounts.filter(
      (account) => Boolean(account.is_cash_bank)
    ).length;

    return {
      total: accounts.length,
      active,
      summary,
      ledger: accounts.length - summary,
      cashBank,
    };
  }, [accounts]);

  async function handleRefresh() {
    if (refreshing || loading) return;

    setRefreshing(true);

    try {
      await loadAccounts(false);
    } finally {
      setRefreshing(false);
    }
  }

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50 p-6 dark:bg-[#070d19]">
        <div className="flex flex-col items-center text-center">
          <LoaderCircle
            size={38}
            className="animate-spin text-blue-600 dark:text-blue-300"
          />
          <p className="mt-4 font-semibold text-slate-800 dark:text-slate-200">
            Loading Chart of Accounts
          </p>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Verifying access and retrieving accounts...
          </p>
        </div>
      </main>
    );
  }

  /*
   * Access Denied is shown only when the API actually denies view access.
   * Missing Create/Edit permission does not prevent viewing the page.
   */
  if (accessDenied || !permissions.canView) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50 p-4 text-slate-900 dark:bg-[#070d19] dark:text-slate-100">
        <section className="w-full max-w-lg rounded-3xl border border-rose-200 bg-white p-8 text-center shadow-xl dark:border-rose-900/60 dark:bg-slate-900">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300">
            <LockKeyhole size={30} />
          </div>

          <h1 className="mt-5 text-2xl font-bold text-slate-900 dark:text-white">
            Access Denied
          </h1>

          <p className="mt-3 text-sm leading-6 text-slate-600 dark:text-slate-300">
            You do not have permission to view the Chart of Accounts. Contact
            your administrator if you need access.
          </p>

          <button
            type="button"
            onClick={() => loadAccounts(true)}
            className="mt-6 inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-3 text-sm font-bold text-white transition hover:bg-blue-700"
          >
            <RefreshCw size={16} />
            Check Permission Again
          </button>
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50 p-4 text-slate-900 transition-colors sm:p-6 lg:p-8 dark:bg-[#070d19] dark:text-slate-100">
      <div className="mx-auto max-w-[1700px] space-y-6">
        <section className="relative isolate overflow-hidden rounded-3xl bg-gradient-to-br from-[#0b1b3a] via-[#12366a] to-[#075e50] p-6 shadow-xl shadow-blue-950/10 sm:p-8">
          <div className="pointer-events-none absolute -right-12 -top-24 -z-10 h-72 w-72 rounded-full bg-blue-400/15 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-32 right-1/4 -z-10 h-72 w-72 rounded-full bg-emerald-400/15 blur-3xl" />

          <div className="flex flex-col justify-between gap-6 lg:flex-row lg:items-center">
            <div className="max-w-3xl">
              <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-xs font-semibold tracking-wide text-blue-100 backdrop-blur-sm">
                <Activity size={14} />
                FINANCIAL MANAGEMENT
              </div>

              <div className="flex items-start gap-4">
                <div className="hidden h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-white/15 bg-white/10 text-white shadow-lg backdrop-blur-sm sm:flex">
                  <BookOpen size={28} />
                </div>

                <div>
                  <h1 className="text-2xl font-bold tracking-tight text-white sm:text-3xl lg:text-4xl">
                    Chart of Accounts
                  </h1>

                  <p className="mt-2 max-w-2xl text-sm leading-6 text-blue-100/85 sm:text-base">
                    Organize your company&apos;s financial structure, manage
                    ledger accounts, and maintain a clear accounting hierarchy.
                  </p>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={handleRefresh}
                disabled={loading || refreshing}
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/20 bg-white/10 px-4 py-3 text-sm font-semibold text-white backdrop-blur-sm transition hover:bg-white/20 disabled:opacity-60"
              >
                <RefreshCw
                  size={17}
                  className={refreshing ? "animate-spin" : ""}
                />
                Refresh
              </button>

              {/* Hide Create button only when Create permission is missing. */}
              {!showForm && permissions.canCreate && (
                <button
                  type="button"
                  onClick={openAddForm}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-400 px-5 py-3 text-sm font-bold text-emerald-950 shadow-lg transition hover:bg-emerald-300 active:scale-[0.98]"
                >
                  <Plus size={18} />
                  Add Account
                </button>
              )}
            </div>
          </div>

          <div className="mt-7 grid grid-cols-2 gap-3 border-t border-white/15 pt-5 sm:grid-cols-4">
            {[
              ["Total Accounts", stats.total, "text-white"],
              ["Active Accounts", stats.active, "text-emerald-300"],
              ["Summary Accounts", stats.summary, "text-white"],
              ["Ledger Accounts", stats.ledger, "text-cyan-200"],
            ].map(([title, value, color]) => (
              <div key={title}>
                <p className="text-xs font-medium text-blue-100/70">
                  {title}
                </p>
                <p className={`mt-1.5 text-2xl font-bold ${color}`}>
                  {formatCount(value)}
                </p>
              </div>
            ))}
          </div>
        </section>

        {message && (
          <div
            role="status"
            className="flex items-start gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3.5 text-sm font-medium text-emerald-800 dark:border-emerald-800/60 dark:bg-emerald-950/30 dark:text-emerald-300"
          >
            <CheckCircle2 size={20} className="mt-0.5 shrink-0" />

            <span className="flex-1">{message}</span>

            <button
              type="button"
              onClick={() => setMessage("")}
              className="rounded-lg p-1 hover:bg-emerald-100 dark:hover:bg-emerald-900/40"
              aria-label="Dismiss success message"
            >
              <X size={16} />
            </button>
          </div>
        )}

        {error && (
          <div
            role="alert"
            className="flex items-start gap-3 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3.5 text-sm font-medium text-rose-800 dark:border-rose-800/60 dark:bg-rose-950/30 dark:text-rose-300"
          >
            <AlertCircle size={20} className="mt-0.5 shrink-0" />

            <span className="flex-1">{error}</span>

            <button
              type="button"
              onClick={() => setError("")}
              className="rounded-lg p-1 hover:bg-rose-100 dark:hover:bg-rose-900/40"
              aria-label="Dismiss error message"
            >
              <X size={16} />
            </button>
          </div>
        )}

        <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <SummaryCard
            title="Total Accounts"
            value={formatCount(stats.total)}
            description="All configured accounts"
            icon={Layers3}
            tone="blue"
          />

          <SummaryCard
            title="Active Accounts"
            value={formatCount(stats.active)}
            description="Currently available accounts"
            icon={CheckCircle2}
            tone="green"
          />

          <SummaryCard
            title="Cash & Bank"
            value={formatCount(stats.cashBank)}
            description="Accounts for cash and banking"
            icon={Wallet}
            tone="cyan"
          />

          <SummaryCard
            title="Summary Accounts"
            value={formatCount(stats.summary)}
            description="Parent and grouping accounts"
            icon={FolderOpen}
            tone="violet"
          />
        </section>

        {showForm && permissions.canCreate && (
          <section className={`${panelClass} overflow-hidden`}>
            <div className="flex flex-col gap-4 border-b border-slate-200 bg-gradient-to-r from-blue-50/80 to-emerald-50/50 px-5 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-7 dark:border-slate-800 dark:from-blue-950/30 dark:to-emerald-950/20">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300">
                  <FilePlus2 size={24} />
                </div>

                <div>
                  <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                    Create New Account
                  </h2>

                  <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                    Add an account to your chart of accounts.
                  </p>

                  {form.parentAccountId && (
                    <p className="mt-2 text-xs font-medium text-blue-700 dark:text-blue-300">
                      Parent: {getParentName(form.parentAccountId)}
                    </p>
                  )}
                </div>
              </div>

              <button
                type="button"
                onClick={cancelAddForm}
                disabled={saving}
                className={buttonSecondary}
              >
                <X size={16} />
                Cancel
              </button>
            </div>

            <form onSubmit={saveAccount} className="p-5 sm:p-7">
              <AccountFormFields
                form={form}
                onChange={handleFormChange}
                parentOptions={parentOptions}
                mode="add"
              />

              <div className="mt-7 flex flex-col-reverse gap-3 border-t border-slate-200 pt-5 sm:flex-row sm:justify-end dark:border-slate-800">
                <button
                  type="button"
                  onClick={cancelAddForm}
                  disabled={saving}
                  className={buttonSecondary}
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={saving || !permissions.canCreate}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-blue-700 to-blue-600 px-6 py-3 text-sm font-bold text-white shadow-lg transition hover:from-blue-600 hover:to-blue-500 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {saving ? (
                    <>
                      <LoaderCircle size={17} className="animate-spin" />
                      Saving Account...
                    </>
                  ) : (
                    <>
                      <Check size={18} />
                      Save Account
                    </>
                  )}
                </button>
              </div>
            </form>
          </section>
        )}

        {!showForm && (
          <section className={`${panelClass} overflow-hidden`}>
            <div className="border-b border-slate-200 p-5 sm:p-6 dark:border-slate-800">
              <div className="flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
                <div className="flex items-start gap-3">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300">
                    <BookOpen size={21} />
                  </div>

                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                        Account Directory
                      </h2>

                      <span className="rounded-full border border-slate-200 bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
                        {formatCount(accounts.length)}
                      </span>
                    </div>

                    <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                      Browse accounts across your financial hierarchy.
                    </p>
                  </div>
                </div>

                <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                  <div className="relative min-w-0 flex-1 sm:min-w-[260px]">
                    <Search
                      size={18}
                      className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
                    />

                    <input
                      type="search"
                      value={search}
                      onChange={(event) => setSearch(event.target.value)}
                      placeholder="Search code, name or type..."
                      aria-label="Search accounts"
                      className={`${inputClass} pl-10 pr-10`}
                    />

                    {search && (
                      <button
                        type="button"
                        onClick={() => setSearch("")}
                        className="absolute right-3 top-1/2 -translate-y-1/2 rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200"
                        aria-label="Clear search"
                      >
                        <X size={15} />
                      </button>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={expandAll}
                    disabled={loading || accounts.length === 0}
                    className={buttonSecondary}
                  >
                    <ChevronDown size={16} />
                    Expand All
                  </button>

                  <button
                    type="button"
                    onClick={collapseAll}
                    disabled={loading || accounts.length === 0}
                    className={buttonSecondary}
                  >
                    <ArrowRight size={15} />
                    Collapse All
                  </button>
                </div>
              </div>

              <div className="mt-5 flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                  <SlidersHorizontal size={14} />
                  Hierarchical view
                </span>

                <span className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-50 px-3 py-1.5 text-xs font-medium text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300">
                  <CheckCircle2 size={14} />
                  {formatCount(stats.active)} active
                </span>

                {normalizedSearch && (
                  <span className="inline-flex items-center gap-1.5 rounded-lg bg-blue-50 px-3 py-1.5 text-xs font-medium text-blue-700 dark:bg-blue-500/10 dark:text-blue-300">
                    <Search size={14} />
                    Filtered results
                  </span>
                )}

                {!permissions.canCreate && (
                  <span className="inline-flex items-center gap-1.5 rounded-lg bg-amber-50 px-3 py-1.5 text-xs font-medium text-amber-800 dark:bg-amber-500/10 dark:text-amber-300">
                    <LockKeyhole size={14} />
                    Create restricted
                  </span>
                )}

                {!permissions.canUpdate && (
                  <span className="inline-flex items-center gap-1.5 rounded-lg bg-amber-50 px-3 py-1.5 text-xs font-medium text-amber-800 dark:bg-amber-500/10 dark:text-amber-300">
                    <LockKeyhole size={14} />
                    Edit restricted
                  </span>
                )}
              </div>
            </div>

            <div className="overflow-x-auto">
              <div className="min-w-[1450px]">
                <div className="border-b border-slate-200 bg-slate-50/90 px-5 py-4 dark:border-slate-800 dark:bg-slate-950/70">
                  <div className="flex items-center text-[11px] font-bold uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400">
                    <div className="mr-3 w-7 shrink-0" />
                    <div className="w-[150px] shrink-0">Account Code</div>
                    <div className="min-w-0 flex-1">Account Name</div>
                    <div className="w-[120px] shrink-0">Type</div>
                    <div className="w-[130px] shrink-0 text-right">Opening</div>
                    <div className="w-[140px] shrink-0 text-right">Balance</div>
                    <div className="w-[100px] shrink-0 text-center">Status</div>
                    <div className="w-[260px] shrink-0 text-right">Actions</div>
                  </div>
                </div>

                {accounts.length === 0 ? (
                  <div className="flex min-h-72 flex-col items-center justify-center p-8 text-center">
                    <Folder
                      size={35}
                      className="text-blue-600 dark:text-blue-300"
                    />

                    <h3 className="mt-4 text-lg font-bold text-slate-900 dark:text-white">
                      No accounts yet
                    </h3>

                    <p className="mt-2 max-w-sm text-sm leading-6 text-slate-500 dark:text-slate-400">
                      {permissions.canCreate
                        ? "Create your first account to start building your financial hierarchy."
                        : "There are currently no accounts available to display."}
                    </p>

                    {permissions.canCreate && (
                      <button
                        type="button"
                        onClick={openAddForm}
                        className="mt-5 inline-flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-3 text-sm font-bold text-white transition hover:bg-blue-700"
                      >
                        <Plus size={17} />
                        Create First Account
                      </button>
                    )}
                  </div>
                ) : filteredAccountTree.length === 0 ? (
                  <div className="flex min-h-64 flex-col items-center justify-center p-8 text-center">
                    <Search
                      size={35}
                      className="text-slate-300 dark:text-slate-600"
                    />

                    <h3 className="mt-3 font-semibold text-slate-800 dark:text-slate-200">
                      No matching accounts
                    </h3>

                    <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                      Try another account code, name, or type.
                    </p>

                    <button
                      type="button"
                      onClick={() => setSearch("")}
                      className="mt-4 text-sm font-semibold text-blue-700 hover:underline dark:text-blue-300"
                    >
                      Clear search
                    </button>
                  </div>
                ) : (
                  <div>
                    {filteredAccountTree.map((account) => (
                      <AccountRow
                        key={account.account_id}
                        account={account}
                        level={0}
                        searchActive={Boolean(normalizedSearch)}
                        expandedAccounts={expandedAccounts}
                        onToggle={toggleAccount}
                        onAddChild={addChildAccount}
                        onEdit={editAccount}
                        onView={viewAccount}
                        canCreate={permissions.canCreate}
                        canUpdate={permissions.canUpdate}
                      />
                    ))}
                  </div>
                )}
              </div>
            </div>

            {!loading && accounts.length > 0 && (
              <div className="flex flex-col gap-2 border-t border-slate-200 bg-slate-50/70 px-5 py-3.5 text-xs text-slate-500 sm:flex-row sm:items-center sm:justify-between dark:border-slate-800 dark:bg-slate-950/50 dark:text-slate-400">
                <span>
                  Showing {formatCount(filteredAccountTree.length)} top-level
                  account group(s).
                </span>

                <span className="inline-flex items-center gap-1.5">
                  <ShieldCheck size={14} />
                  Account management
                </span>
              </div>
            )}
          </section>
        )}

        {!showForm && (
          <div className="flex items-start gap-3 rounded-2xl border border-blue-100 bg-blue-50/70 p-4 dark:border-blue-900/50 dark:bg-blue-950/20">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300">
              <BookOpen size={17} />
            </div>

            <div>
              <p className="text-sm font-semibold text-blue-950 dark:text-blue-200">
                Working with account hierarchy
              </p>

              <p className="mt-1 text-xs leading-5 text-blue-800/80 dark:text-blue-300/80">
                Use summary accounts to organize your chart. Select the expand
                arrow to view child accounts. The View button displays
                account details. Create and Edit actions appear only when
                your role has the corresponding permissions.
              </p>
            </div>
          </div>
        )}
      </div>

      {viewingAccount && (
        <AccountDetailsModal
          account={viewingAccount}
          onClose={() => setViewingAccount(null)}
        />
      )}

      {editingAccount && permissions.canUpdate && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/75 p-3 backdrop-blur-sm sm:p-5"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) closeEdit();
          }}
        >
          <div className="max-h-[94vh] w-full max-w-3xl overflow-y-auto rounded-3xl border border-slate-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-900">
            <div className="sticky top-0 z-10 flex items-center justify-between gap-4 border-b border-slate-200 bg-white/95 px-5 py-5 backdrop-blur sm:px-7 dark:border-slate-800 dark:bg-slate-900/95">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300">
                  <Pencil size={22} />
                </div>

                <div>
                  <h2 className="text-xl font-bold text-slate-900 dark:text-white">
                    Edit Account
                  </h2>

                  <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                    Account ID: {editingAccount.account_id}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={closeEdit}
                disabled={updating}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-slate-200 text-slate-500 transition hover:bg-slate-100 hover:text-slate-900 disabled:opacity-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white"
                aria-label="Close edit form"
              >
                <X size={19} />
              </button>
            </div>

            <form onSubmit={updateAccount} className="p-5 sm:p-7">
              <AccountFormFields
                form={editForm}
                onChange={handleEditChange}
                parentOptions={editParentOptions}
                mode="edit"
              />

              <div className="mt-7 flex flex-col-reverse gap-3 border-t border-slate-200 pt-5 sm:flex-row sm:justify-end dark:border-slate-800">
                <button
                  type="button"
                  onClick={closeEdit}
                  disabled={updating}
                  className={buttonSecondary}
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={updating || !permissions.canUpdate}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-blue-700 to-blue-600 px-6 py-3 text-sm font-bold text-white shadow-lg transition hover:from-blue-600 hover:to-blue-500 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {updating ? (
                    <>
                      <LoaderCircle size={17} className="animate-spin" />
                      Updating Account...
                    </>
                  ) : (
                    <>
                      <Check size={18} />
                      Update Account
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </main>
  );
}