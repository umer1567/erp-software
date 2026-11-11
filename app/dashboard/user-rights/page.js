
"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ShieldCheck,
  Users,
  Search,
  RefreshCw,
  Check,
  Eye,
  Plus,
  Pencil,
  Trash2,
  Layers3,
  LockKeyhole,
  AlertCircle,
  CheckCircle2,
  LoaderCircle,
  ChevronDown,
  SlidersHorizontal,
} from "lucide-react";

const PERMISSION_FIELDS = [
  { key: "can_view", label: "View", icon: Eye },
  { key: "can_create", label: "Create", icon: Plus },
  { key: "can_update", label: "Edit", icon: Pencil },
  { key: "can_delete", label: "Delete", icon: Trash2 },
];

const inputClass =
  "w-full rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-800 outline-none transition placeholder:text-slate-500 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/15 disabled:cursor-not-allowed disabled:opacity-60 dark:border-blue-400/50 dark:bg-blue-950 dark:text-white dark:placeholder:text-blue-200 dark:focus:border-blue-300 dark:focus:ring-blue-400/20";

async function readResponse(response) {
  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(
      data.message || data.error || "The request could not be completed."
    );
  }

  if (data.success === false) {
    throw new Error(data.message || "The request could not be completed.");
  }

  return data;
}

function toBoolean(value) {
  return (
    value === true ||
    value === 1 ||
    value === "1" ||
    (typeof value === "string" && value.toLowerCase() === "true")
  );
}

function normalizePermission(permission) {
  return {
    ...permission,
    can_view: toBoolean(permission.can_view),
    can_create: toBoolean(permission.can_create),
    can_update: toBoolean(permission.can_update),
    can_delete: toBoolean(permission.can_delete),
  };
}

function PermissionCheckbox({ checked, disabled, label, onChange }) {
  return (
    <label
      title={label}
      className={`inline-flex items-center justify-center ${disabled ? "cursor-not-allowed opacity-60" : "cursor-pointer"
        }`}
    >
      <input
        type="checkbox"
        checked={Boolean(checked)}
        disabled={disabled}
        aria-label={label}
        onChange={(event) => onChange(event.target.checked)}
        className="peer sr-only"
      />

      <span
        className={`flex h-9 w-9 items-center justify-center rounded-xl border-2 transition-all duration-200 peer-focus-visible:outline-none peer-focus-visible:ring-4 peer-focus-visible:ring-blue-400/40 ${checked
          ? "border-blue-500 bg-blue-600 text-white shadow-sm shadow-blue-500/30 dark:border-blue-200 dark:bg-blue-500 dark:text-white"
          : "border-slate-400 bg-white text-transparent hover:border-blue-500 hover:bg-blue-50 dark:border-blue-200 dark:bg-blue-950 dark:text-transparent dark:hover:border-white dark:hover:bg-blue-700"
          }`}
      >
        <Check size={17} strokeWidth={3.2} />
      </span>
    </label>
  );
}

function StatCard({ icon: Icon, label, value, description, color }) {
  const styles = {
    blue: {
      icon: "bg-blue-100 text-blue-800 dark:bg-blue-800 dark:text-blue-100",
      accent: "bg-blue-500",
    },
    green: {
      icon:
        "bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-100",
      accent: "bg-emerald-500",
    },
    sky: {
      icon: "bg-sky-100 text-sky-800 dark:bg-sky-900 dark:text-sky-100",
      accent: "bg-sky-500",
    },
    amber: {
      icon: "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-100",
      accent: "bg-amber-500",
    },
  };

  const theme = styles[color] || styles.blue;

  return (
    <div className="group relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition duration-200 hover:-translate-y-0.5 hover:shadow-md dark:border-blue-500/50 dark:bg-blue-900 dark:hover:border-blue-300">
      <div className={`absolute inset-x-0 top-0 h-1 ${theme.accent}`} />

      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-slate-600 dark:text-blue-100">
            {label}
          </p>

          <p className="mt-3 text-3xl font-bold tracking-tight text-slate-950 dark:text-white">
            {value}
          </p>

          <p className="mt-1.5 text-xs leading-5 text-slate-600 dark:text-blue-100">
            {description}
          </p>
        </div>

        <div className={`rounded-xl p-3 ${theme.icon}`}>
          <Icon size={22} strokeWidth={2.2} />
        </div>
      </div>
    </div>
  );
}

function EmptyState({ icon: Icon, title, description, children }) {
  return (
    <div className="flex min-h-72 flex-col items-center justify-center bg-white px-6 py-12 text-center dark:bg-blue-900">
      <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-blue-100 text-blue-800 dark:bg-blue-800 dark:text-blue-100">
        <Icon size={29} />
      </div>

      <h3 className="text-base font-bold text-slate-950 dark:text-white">
        {title}
      </h3>

      <p className="mt-2 max-w-sm text-sm leading-6 text-slate-600 dark:text-blue-100">
        {description}
      </p>

      {children}
    </div>
  );
}

export default function UserRightsPage() {
  const [roles, setRoles] = useState([]);
  const [selectedRole, setSelectedRole] = useState("");
  const [permissions, setPermissions] = useState([]);

  const [loadingRoles, setLoadingRoles] = useState(true);
  const [loadingPermissions, setLoadingPermissions] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const [savingIds, setSavingIds] = useState([]);
  const [search, setSearch] = useState("");
  const [moduleFilter, setModuleFilter] = useState("all");

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [selectedRoleIsAdmin, setSelectedRoleIsAdmin] = useState(false);

  // Synchronous request tracking prevents rapid duplicate saves.
  const savingIdsRef = useRef(new Set());

  // Store the latest permission objects without relying on stale callbacks.
  const permissionsRef = useRef([]);
  const selectedRoleRef = useRef("");
  const requestVersionRef = useRef(new Map());

  const setPermissionState = useCallback((next) => {
    setPermissions((current) => {
      const resolved =
        typeof next === "function" ? next(current) : next;

      permissionsRef.current = resolved;
      return resolved;
    });
  }, []);

  const changeSelectedRole = useCallback((nextRole) => {
    const role = String(nextRole || "");
    selectedRoleRef.current = role;
    setSelectedRole(role);
  }, []);

  const selectedRoleData = useMemo(
    () =>
      roles.find((role) => String(role.role_id) === String(selectedRole)),
    [roles, selectedRole]
  );

  // Load available roles.
  useEffect(() => {
    let cancelled = false;

    async function fetchRoles() {
      try {
        const response = await fetch("/api/roles", {
          cache: "no-store",
        });

        const data = await readResponse(response);

        if (cancelled) return;

        const nextRoles = Array.isArray(data.roles) ? data.roles : [];
        const firstRole = nextRoles.length
          ? String(nextRoles[0].role_id)
          : "";

        setRoles(nextRoles);
        selectedRoleRef.current = firstRole;
        setSelectedRole(firstRole);
        setLoadingPermissions(Boolean(firstRole));

        if (!firstRole) {
          permissionsRef.current = [];
          setPermissions([]);
          setSelectedRoleIsAdmin(false);
        }

        setError("");
      } catch (err) {
        if (!cancelled) {
          setError(err.message || "Unable to load roles.");
        }
      } finally {
        if (!cancelled) {
          setLoadingRoles(false);
        }
      }
    }

    fetchRoles();

    return () => {
      cancelled = true;
    };
  }, []);

  // Load permissions whenever the selected role changes.
  useEffect(() => {
    let cancelled = false;
    const roleId = String(selectedRole || "");

    async function loadPermissions() {
      if (!roleId) {
        permissionsRef.current = [];
        setPermissions([]);
        setSelectedRoleIsAdmin(false);
        setLoadingPermissions(false);
        return;
      }

      setLoadingPermissions(true);
      setError("");

      try {
        const response = await fetch(
          `/api/permissions?roleId=${encodeURIComponent(roleId)}`,
          { cache: "no-store" }
        );

        const data = await readResponse(response);

        if (cancelled) return;

        const nextPermissions = Array.isArray(data.permissions)
          ? data.permissions.map(normalizePermission)
          : [];

        permissionsRef.current = nextPermissions;
        setPermissions(nextPermissions);
        setSelectedRoleIsAdmin(data.roleIsAdmin === true);
        setSuccess("");
      } catch (err) {
        if (!cancelled) {
          permissionsRef.current = [];
          setPermissions([]);
          setSelectedRoleIsAdmin(false);
          setError(err.message || "Unable to load permissions.");
        }
      } finally {
        if (!cancelled) {
          setLoadingPermissions(false);
        }
      }
    }

    loadPermissions();

    return () => {
      cancelled = true;
    };
  }, [selectedRole]);

  // Refresh roles and permissions.
  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    setError("");
    setSuccess("");

    try {
      const rolesResponse = await fetch("/api/roles", {
        cache: "no-store",
      });

      const rolesData = await readResponse(rolesResponse);
      const nextRoles = Array.isArray(rolesData.roles)
        ? rolesData.roles
        : [];

      setRoles(nextRoles);

      const currentRole = String(selectedRoleRef.current || "");
      const stillExists = nextRoles.some(
        (role) => String(role.role_id) === currentRole
      );

      const nextRole = stillExists
        ? currentRole
        : nextRoles.length
          ? String(nextRoles[0].role_id)
          : "";

      if (nextRole !== currentRole) {
        selectedRoleRef.current = nextRole;
        setSelectedRole(nextRole);
        permissionsRef.current = [];
        setPermissions([]);
        setSelectedRoleIsAdmin(false);
        return;
      }

      if (!nextRole) {
        permissionsRef.current = [];
        setPermissions([]);
        setSelectedRoleIsAdmin(false);
        return;
      }

      setLoadingPermissions(true);

      const permissionsResponse = await fetch(
        `/api/permissions?roleId=${encodeURIComponent(nextRole)}`,
        { cache: "no-store" }
      );

      const permissionsData = await readResponse(permissionsResponse);

      if (String(selectedRoleRef.current) !== nextRole) return;

      const nextPermissions = Array.isArray(permissionsData.permissions)
        ? permissionsData.permissions.map(normalizePermission)
        : [];

      permissionsRef.current = nextPermissions;
      setPermissions(nextPermissions);
      setSelectedRoleIsAdmin(permissionsData.roleIsAdmin === true);
    } catch (err) {
      setError(err.message || "Unable to refresh user rights.");
    } finally {
      setLoadingRoles(false);
      setLoadingPermissions(false);
      setRefreshing(false);
    }
  }, []);

  // Save one permission entry.
  const updatePermission = useCallback(
    async (permission, changes) => {
      const roleIdAtStart = String(selectedRoleRef.current || "");
      const permissionId = Number(permission?.permission_id);

      if (!roleIdAtStart || !Number.isInteger(permissionId) || permissionId <= 0) {
        return;
      }

      const permissionKey = String(permissionId);
      const requestKey = `${roleIdAtStart}:${permissionKey}`;

      if (savingIdsRef.current.has(requestKey)) return;

      const currentPermission = permissionsRef.current.find(
        (item) => String(item.permission_id) === permissionKey
      );

      if (!currentPermission) return;

      const updated = normalizePermission({
        ...currentPermission,
        ...changes,
      });

      const version =
        (requestVersionRef.current.get(requestKey) || 0) + 1;
      requestVersionRef.current.set(requestKey, version);

      const payload = {
        roleId: Number(roleIdAtStart),
        permissionId,
        canView: updated.can_view,
        canCreate: updated.can_create,
        canUpdate: updated.can_update,
        canDelete: updated.can_delete,
      };

      console.log("[USER RIGHTS] Saving permission:", {
        roleId: roleIdAtStart,
        permissionId,
        permissionName: currentPermission.permission_name,
        changes,
        payload,
      });

      savingIdsRef.current.add(requestKey);
      setSavingIds((current) =>
        current.includes(permissionKey)
          ? current
          : [...current, permissionKey]
      );

      setError("");
      setSuccess("");

      // Optimistically update the UI.
      const optimisticPermissions = permissionsRef.current.map((item) =>
        String(item.permission_id) === permissionKey ? updated : item
      );

      permissionsRef.current = optimisticPermissions;
      setPermissions(optimisticPermissions);

      try {
        const response = await fetch("/api/permissions", {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
          },
          cache: "no-store",
          body: JSON.stringify(payload),
        });

        const data = await readResponse(response);

        // Notify the sidebar and other components that permissions changed.
        window.dispatchEvent(
          new Event("erp-permissions-updated")
        );

        const stillCurrent =
          String(selectedRoleRef.current) === roleIdAtStart &&
          requestVersionRef.current.get(requestKey) === version;

        if (stillCurrent && data.permission) {
          const savedPermission = normalizePermission({
            ...updated,
            ...data.permission,
          });

          const nextPermissions = permissionsRef.current.map((item) =>
            String(item.permission_id) === permissionKey
              ? savedPermission
              : item
          );

          permissionsRef.current = nextPermissions;
          setPermissions(nextPermissions);
        }

        if (String(selectedRoleRef.current) === roleIdAtStart) {
          setSuccess("Permission saved successfully.");
        }

        console.log("[USER RIGHTS] Save response:", {
          roleId: roleIdAtStart,
          permissionId,
          permission: data.permission,
        });
      } catch (err) {
        const stillCurrent =
          String(selectedRoleRef.current) === roleIdAtStart &&
          requestVersionRef.current.get(requestKey) === version;

        if (stillCurrent) {
          const restoredPermissions = permissionsRef.current.map((item) =>
            String(item.permission_id) === permissionKey
              ? currentPermission
              : item
          );

          permissionsRef.current = restoredPermissions;
          setPermissions(restoredPermissions);
          setError(err.message || "Failed to save permission.");
        }
      } finally {
        savingIdsRef.current.delete(requestKey);

        if (String(selectedRoleRef.current) === roleIdAtStart) {
          setSavingIds((current) =>
            current.filter((id) => id !== permissionKey)
          );
        }
      }
    },
    [setPermissionState]
  );

  // Toggle all four actions for a permission entry.
  const toggleAll = useCallback(
    (permission, value) => {
      updatePermission(permission, {
        can_view: value,
        can_create: value,
        can_update: value,
        can_delete: value,
      });
    },
    [updatePermission]
  );

  const modules = useMemo(() => {
    const names = permissions.map(
      (permission) => permission.module || "Other"
    );

    return [...new Set(names)].sort((a, b) => a.localeCompare(b));
  }, [permissions]);

  const filteredPermissions = useMemo(() => {
    const query = search.trim().toLowerCase();

    return permissions.filter((permission) => {
        const moduleName = permission.module || "Other";

        const permissionKey = String(permission.permission_key || "")
            .trim()
            .toLowerCase();

        const permissionName = String(permission.permission_name || "")
            .trim()
            .toLowerCase();

        // Hide unused duplicate Requisition for Procurement permission.
        if (permissionKey === "requisitions_for_procurement") {
            return false;
        }

        // Hide old Sales permission but keep POS.
        if (permissionKey === "sales" || permissionName === "sales") {
            return false;
        }

        const matchesSearch =
            !query ||
            String(moduleName).toLowerCase().includes(query) ||
            permissionName.includes(query) ||
            String(permission.description || "")
                .toLowerCase()
                .includes(query) ||
            permissionKey.includes(query);

        return (
            matchesSearch &&
            (moduleFilter === "all" || moduleName === moduleFilter)
        );
    });
}, [permissions, search, moduleFilter]);

  const stats = useMemo(() => {
    const total = permissions.length;

    const enabled = permissions.reduce(
      (count, permission) =>
        count +
        PERMISSION_FIELDS.reduce(
          (sum, field) => sum + Number(permission[field.key]),
          0
        ),
      0
    );

    const possible = total * PERMISSION_FIELDS.length;

    return {
      total,
      enabled,
      disabled: possible - enabled,
      percentage: possible ? Math.round((enabled / possible) * 100) : 0,
    };
  }, [permissions]);

  function handleRoleChange(event) {
    const nextRole = String(event.target.value || "");

    changeSelectedRole(nextRole);
    permissionsRef.current = [];
    setPermissions([]);
    setSelectedRoleIsAdmin(false);
    setLoadingPermissions(Boolean(nextRole));
    setSearch("");
    setModuleFilter("all");
    setError("");
    setSuccess("");
    setSavingIds([]);
  }

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-6 text-slate-950 sm:px-6 lg:px-8 dark:bg-blue-950 dark:text-white">
      <div className="mx-auto max-w-[1600px]">
        <header className="mb-8 flex flex-col justify-between gap-5 lg:flex-row lg:items-center">
          <div className="flex items-start gap-4">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-600 to-sky-500 text-white shadow-lg shadow-blue-600/20">
              <ShieldCheck size={29} strokeWidth={2.2} />
            </div>

            <div className="min-w-0">
              <div className="mb-2 flex flex-wrap items-center gap-2.5">
                <h1 className="text-2xl font-bold tracking-tight text-slate-950 dark:text-white sm:text-3xl">
                  User Rights
                </h1>

                <span className="inline-flex items-center gap-1.5 rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-blue-800 dark:border-blue-300/50 dark:bg-blue-800 dark:text-white">
                  <LockKeyhole size={12} />
                  Access Control
                </span>
              </div>

              <p className="max-w-2xl text-sm leading-6 text-slate-600 dark:text-blue-100">
                Manage role-based access to your ERP modules. Choose which
                actions users can view, create, edit, and delete.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleRefresh}
            disabled={refreshing || loadingRoles}
            className="inline-flex min-h-11 items-center justify-center gap-2.5 self-start rounded-xl bg-blue-700 px-5 py-2.5 text-sm font-bold text-white shadow-md shadow-blue-700/20 transition hover:-translate-y-0.5 hover:bg-blue-800 active:translate-y-0 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-blue-600 dark:hover:bg-blue-500 lg:self-center"
          >
            <RefreshCw
              size={16}
              className={refreshing ? "animate-spin" : ""}
            />
            {refreshing ? "Refreshing..." : "Refresh"}
          </button>
        </header>

        {error && (
          <div
            role="alert"
            className="mb-5 flex items-start gap-3 rounded-2xl border border-red-300 bg-red-50 p-4 text-sm text-red-800 dark:border-red-400/50 dark:bg-blue-900 dark:text-red-100"
          >
            <AlertCircle size={19} className="mt-0.5 shrink-0" />
            <div className="min-w-0 flex-1 leading-6">{error}</div>
            <button
              type="button"
              onClick={() => setError("")}
              aria-label="Dismiss error"
              className="rounded-lg p-1.5 hover:bg-red-100 dark:hover:bg-blue-800"
            >
              <span className="sr-only">Dismiss</span>×
            </button>
          </div>
        )}

        {success && (
          <div
            role="status"
            className="mb-5 flex items-start gap-3 rounded-2xl border border-emerald-300 bg-emerald-50 p-4 text-sm text-emerald-800 dark:border-emerald-400/50 dark:bg-blue-900 dark:text-emerald-100"
          >
            <CheckCircle2 size={19} className="mt-0.5 shrink-0" />
            <span className="flex-1 leading-6">{success}</span>
            <button
              type="button"
              onClick={() => setSuccess("")}
              aria-label="Dismiss success message"
              className="rounded-lg p-1.5 hover:bg-emerald-100 dark:hover:bg-blue-800"
            >
              <span className="sr-only">Dismiss</span>×
            </button>
          </div>
        )}

        <section className="mb-7 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            icon={Users}
            label="Available Roles"
            value={loadingRoles ? "—" : roles.length}
            description="Roles configured in your ERP"
            color="blue"
          />
          <StatCard
            icon={Layers3}
            label="Permission Entries"
            value={loadingPermissions ? "—" : stats.total}
            description="Entries for the selected role"
            color="sky"
          />
          <StatCard
            icon={CheckCircle2}
            label="Enabled Rights"
            value={loadingPermissions ? "—" : stats.enabled}
            description="Actions currently granted"
            color="green"
          />
          <StatCard
            icon={LockKeyhole}
            label="Access Coverage"
            value={loadingPermissions ? "—" : `${stats.percentage}%`}
            description={`${stats.disabled} rights currently disabled`}
            color="amber"
          />
        </section>

        <section className="mb-6 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-blue-500/50 dark:bg-blue-900">
          <div className="flex flex-col gap-5 p-5 sm:p-6 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center gap-3.5">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-blue-100 text-blue-800 dark:bg-blue-800 dark:text-white">
                <Users size={22} />
              </div>
              <div>
                <h2 className="font-bold text-slate-950 dark:text-white">
                  Role Configuration
                </h2>
                <p className="mt-1 text-sm text-slate-600 dark:text-blue-100">
                  Select a role to configure its permissions.
                </p>
              </div>
            </div>

            <div className="w-full lg:max-w-md">
              <label
                htmlFor="role-select"
                className="mb-2 block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-blue-100"
              >
                Select role
              </label>
              <div className="relative">
                <select
                  id="role-select"
                  value={selectedRole}
                  onChange={handleRoleChange}
                  disabled={loadingRoles || roles.length === 0}
                  className={`${inputClass} appearance-none py-3 pr-11`}
                >
                  <option value="">
                    {loadingRoles ? "Loading roles..." : "Select a role"}
                  </option>
                  {roles.map((role) => (
                    <option key={role.role_id} value={String(role.role_id)}>
                      {role.role_name}
                      {role.is_system_role ? " (System)" : ""}
                    </option>
                  ))}
                </select>
                <ChevronDown
                  size={18}
                  className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 dark:text-blue-100"
                />
              </div>
            </div>
          </div>

          {selectedRoleData && (
            <div className="flex flex-wrap items-center gap-3 border-t border-slate-200 bg-slate-100 px-5 py-4 sm:px-6 dark:border-blue-500/50 dark:bg-blue-950">
              <span className="text-xs font-medium text-slate-600 dark:text-blue-100">
                Configuring permissions for
              </span>

              <span className="inline-flex items-center gap-2 rounded-lg border border-blue-300 bg-blue-100 px-3 py-1.5 text-xs font-bold text-blue-900 dark:border-blue-300/50 dark:bg-blue-800 dark:text-white">
                <Users size={13} />
                {selectedRoleData.role_name}
              </span>

              {selectedRoleData.is_system_role && (
                <span className="inline-flex items-center gap-1.5 rounded-lg border border-amber-300 bg-amber-100 px-3 py-1.5 text-xs font-bold text-amber-900 dark:border-amber-300/50 dark:bg-blue-800 dark:text-amber-100">
                  <LockKeyhole size={13} />
                  System Role
                </span>
              )}

              {selectedRoleIsAdmin && (
                <span className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-300 bg-emerald-100 px-3 py-1.5 text-xs font-bold text-emerald-900 dark:border-emerald-300/50 dark:bg-blue-900 dark:text-emerald-100">
                  <ShieldCheck size={13} />
                  Full system access
                </span>
              )}

              <span className="ml-auto inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 dark:text-blue-100">
                <span className="h-2 w-2 rounded-full bg-emerald-500" />
                Auto-save enabled
              </span>
            </div>
          )}
        </section>

        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-blue-500/50 dark:bg-blue-900">
          <div className="flex flex-col gap-5 border-b border-slate-200 p-5 sm:p-6 dark:border-blue-500/50 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h2 className="text-lg font-bold text-slate-950 dark:text-white">
                Permission Matrix
              </h2>
              <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-600 dark:text-blue-100">
                Enable or disable individual actions. Use the All checkbox to
                grant or revoke all four rights for an entry.
              </p>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row">
              <div className="relative min-w-0 sm:w-64">
                <Search
                  size={17}
                  className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500 dark:text-blue-200"
                />
                <input
                  type="search"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search permissions..."
                  aria-label="Search permissions"
                  className={`${inputClass} pl-10`}
                />
                {search && (
                  <button
                    type="button"
                    onClick={() => setSearch("")}
                    aria-label="Clear search"
                    className="absolute right-3 top-1/2 -translate-y-1/2 rounded-md p-1 text-slate-500 hover:bg-slate-100 hover:text-slate-900 dark:text-blue-100 dark:hover:bg-blue-700 dark:hover:text-white"
                  >
                    <span className="sr-only">Clear search</span>×
                  </button>
                )}
              </div>

              <div className="relative min-w-0 sm:w-48">
                <SlidersHorizontal
                  size={16}
                  className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500 dark:text-blue-200"
                />
                <select
                  value={moduleFilter}
                  onChange={(event) => setModuleFilter(event.target.value)}
                  aria-label="Filter by module"
                  className={`${inputClass} appearance-none pl-10 pr-9`}
                >
                  <option value="all">All modules</option>
                  {modules.map((module) => (
                    <option key={module} value={module}>
                      {module}
                    </option>
                  ))}
                </select>
                <ChevronDown
                  size={15}
                  className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 dark:text-blue-100"
                />
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-x-5 gap-y-3 border-b border-slate-200 bg-slate-100 px-5 py-4 sm:px-6 dark:border-blue-500/50 dark:bg-blue-950">
            {PERMISSION_FIELDS.map(({ key, label, icon: Icon }) => (
              <div
                key={key}
                className="flex items-center gap-2 text-sm font-bold text-slate-800 dark:text-white"
              >
                <span className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-300 bg-white text-blue-800 dark:border-blue-300/50 dark:bg-blue-800 dark:text-white">
                  <Icon size={15} strokeWidth={2.5} />
                </span>
                <span>{label}</span>
              </div>
            ))}

            <div className="ml-auto flex items-center gap-2 text-xs font-semibold text-slate-600 dark:text-blue-100">
              {savingIds.length ? (
                <>
                  <LoaderCircle
                    size={14}
                    className="animate-spin text-blue-600 dark:text-blue-200"
                  />
                  Saving {savingIds.length} change(s)...
                </>
              ) : (
                <>
                  <CheckCircle2
                    size={15}
                    className="text-emerald-600 dark:text-emerald-300"
                  />
                  Changes save automatically
                </>
              )}
            </div>
          </div>

          {loadingPermissions || loadingRoles ? (
            <div className="flex min-h-72 flex-col items-center justify-center gap-4 bg-white p-8 dark:bg-blue-900">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-100 dark:bg-blue-800">
                <LoaderCircle
                  size={28}
                  className="animate-spin text-blue-700 dark:text-blue-100"
                />
              </div>
              <div className="text-center">
                <p className="font-bold text-slate-950 dark:text-white">
                  Loading permissions
                </p>
                <p className="mt-1 text-sm text-slate-600 dark:text-blue-100">
                  Retrieving the latest access settings...
                </p>
              </div>
            </div>
          ) : !selectedRole ? (
            <EmptyState
              icon={Users}
              title="No role selected"
              description="Create a role first or select an available role from the dropdown above."
            />
          ) : filteredPermissions.length === 0 ? (
            <EmptyState
              icon={Search}
              title="No permissions found"
              description={
                permissions.length
                  ? "Try another search term or change the module filter."
                  : "No permissions are configured for this role yet."
              }
            >
              {(search || moduleFilter !== "all") && (
                <button
                  type="button"
                  onClick={() => {
                    setSearch("");
                    setModuleFilter("all");
                  }}
                  className="mt-5 inline-flex items-center justify-center gap-2 rounded-xl border border-blue-300 bg-blue-100 px-4 py-2.5 text-sm font-bold text-blue-900 transition hover:bg-blue-200 dark:border-blue-300/50 dark:bg-blue-800 dark:text-white dark:hover:bg-blue-700"
                >
                  <span aria-hidden="true">×</span>
                  Clear filters
                </button>
              )}
            </EmptyState>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[900px] border-collapse text-left">
                  <thead>
                    <tr className="border-b border-blue-300 bg-blue-100 text-xs uppercase tracking-wider text-blue-950 dark:border-blue-400/60 dark:bg-blue-800 dark:text-white">
                      <th className="whitespace-nowrap px-5 py-4 font-extrabold sm:px-6">
                        Module
                      </th>
                      <th className="whitespace-nowrap px-5 py-4 font-extrabold">
                        Permission
                      </th>
                      {PERMISSION_FIELDS.map(({ key, label, icon: Icon }) => (
                        <th
                          key={key}
                          className="whitespace-nowrap px-3 py-4 text-center font-extrabold"
                        >
                          <div className="flex items-center justify-center gap-1.5">
                            <Icon
                              size={15}
                              strokeWidth={2.5}
                              className="text-blue-700 dark:text-white"
                            />
                            <span>{label}</span>
                          </div>
                        </th>
                      ))}
                      <th className="whitespace-nowrap px-4 py-4 text-center font-extrabold">
                        All
                      </th>
                    </tr>
                  </thead>

                  <tbody className="divide-y divide-slate-200 dark:divide-blue-500/50">
                    {filteredPermissions.map((permission) => {
                      const allEnabled = PERMISSION_FIELDS.every(
                        ({ key }) => permission[key]
                      );
                      const anyEnabled = PERMISSION_FIELDS.some(
                        ({ key }) => permission[key]
                      );
                      const permissionKey = String(permission.permission_id);
                      const isSaving = savingIds.includes(permissionKey);

                      return (
                        <tr
                          key={permission.permission_id}
                          className="group bg-white text-slate-900 transition-colors odd:bg-white even:bg-blue-50/70 hover:bg-blue-100 dark:bg-blue-900 dark:text-white dark:odd:bg-blue-900 dark:even:bg-blue-800/80 dark:hover:bg-blue-700"
                        >
                          <td className="px-5 py-4 sm:px-6">
                            <span className="inline-flex max-w-48 items-center gap-2 rounded-lg border border-slate-300 bg-slate-100 px-2.5 py-1.5 text-xs font-bold text-slate-800 transition-colors dark:border-blue-200/60 dark:bg-blue-950 dark:text-white dark:group-hover:border-blue-200 dark:group-hover:bg-blue-600 dark:group-hover:text-white">
                              <Layers3
                                size={13}
                                className="shrink-0 text-blue-700 dark:text-blue-200 dark:group-hover:text-white"
                              />
                              <span className="truncate">
                                {permission.module || "Other"}
                              </span>
                            </span>
                          </td>

                          <td className="px-5 py-4">
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-slate-900 dark:text-white">
                                {permission.permission_name}
                              </span>
                              {isSaving && (
                                <LoaderCircle
                                  size={14}
                                  className="shrink-0 animate-spin text-blue-700 dark:text-blue-100"
                                />
                              )}
                            </div>
                            {permission.description && (
                              <p className="mt-1 max-w-xs text-xs leading-5 text-slate-600 dark:text-blue-100">
                                {permission.description}
                              </p>
                            )}
                          </td>

                          {PERMISSION_FIELDS.map(({ key, label }) => (
                            <td
                              key={key}
                              className="px-3 py-4 text-center text-slate-900 dark:text-white"
                            >
                              <div className="flex justify-center">
                                <PermissionCheckbox
                                  checked={permission[key]}
                                  disabled={isSaving}
                                  label={`${label}: ${permission.permission_name}`}
                                  onChange={(value) =>
                                    updatePermission(permission, {
                                      [key]: value,
                                    })
                                  }
                                />
                              </div>
                            </td>
                          ))}

                          <td className="px-4 py-4 text-center text-slate-900 dark:text-white">
                            <div className="flex justify-center">
                              <PermissionCheckbox
                                checked={allEnabled}
                                disabled={isSaving}
                                label={`Toggle all rights: ${permission.permission_name}`}
                                onChange={(value) =>
                                  toggleAll(permission, value)
                                }
                              />
                            </div>
                            {!allEnabled && anyEnabled && (
                              <span className="mt-1.5 inline-block rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-900 dark:bg-amber-300 dark:text-blue-950">
                                Partial
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <div className="flex flex-col gap-3 border-t border-slate-200 bg-slate-100 px-5 py-4 text-xs text-slate-700 sm:flex-row sm:items-center sm:justify-between sm:px-6 dark:border-blue-500/50 dark:bg-blue-950 dark:text-blue-100">
                <span>
  Showing{" "}
  <strong className="font-extrabold text-slate-950 dark:text-white">
    {filteredPermissions.length}
  </strong>{" "}
  permission entries
</span>
                <span className="flex items-center gap-2">
                  <CheckCircle2
                    size={15}
                    className="text-emerald-700 dark:text-emerald-300"
                  />
                  <span>
                    <strong className="text-slate-950 dark:text-white">
                      {stats.enabled}
                    </strong>{" "}
                    of{" "}
                    <strong className="text-slate-950 dark:text-white">
                      {stats.total * PERMISSION_FIELDS.length}
                    </strong>{" "}
                    rights enabled
                  </span>
                </span>
              </div>
            </>
          )}
        </section>

        <aside className="mt-6 flex items-start gap-3.5 rounded-2xl border border-blue-300 bg-blue-50 p-4 sm:p-5 dark:border-blue-400/50 dark:bg-blue-900">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-blue-200 bg-white text-blue-800 dark:border-blue-300/50 dark:bg-blue-800 dark:text-white">
            <LockKeyhole size={19} />
          </div>
          <div>
            <h3 className="text-sm font-bold text-blue-950 dark:text-white">
              Security reminder
            </h3>
            <p className="mt-1 text-xs leading-6 text-blue-950 dark:text-blue-100">
              Hiding a feature in the interface is not sufficient protection.
              Your API routes must independently verify the signed-in user’s
              role and permissions before allowing sensitive operations.
              Permission changes made here configure role access; they do not
              replace authorization checks in each protected API.
            </p>
          </div>
        </aside>

        <div className="mt-5 flex flex-col gap-2 pb-4 text-center text-xs text-slate-500 sm:flex-row sm:items-center sm:justify-between sm:text-left dark:text-blue-200">
          <span>ERP Administration · User Rights Management</span>
          <span className="inline-flex items-center justify-center gap-1.5">
            <ShieldCheck
              size={13}
              className="text-emerald-700 dark:text-emerald-300"
            />
            Role-based access control
          </span>
        </div>
      </div>
    </main>
  );
}