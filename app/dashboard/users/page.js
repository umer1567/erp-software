
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Users,
  UserPlus,
  UserRound,
  Search,
  ShieldCheck,
  Building2,
  MapPin,
  Mail,
  ArrowRight,
  ArrowUpRight,
  RefreshCw,
  Pencil,
  Trash2,
  CircleCheck,
  CircleX,
  BriefcaseBusiness,
  ChevronRight,
  Sparkles,
  X,
  LockKeyhole,
  Plus,
  ShieldAlert,
} from "lucide-react";

const TABS = [
  { name: "Roles", icon: ShieldCheck },
  { name: "Details", icon: UserRound },
  { name: "Assign Subsidiary", icon: Building2 },
  { name: "Assign Locations", icon: MapPin },
];

const styles = {
  surface: {
    background: "var(--erp-surface, #ffffff)",
    borderColor: "var(--erp-border, #e5e7eb)",
    color: "var(--erp-text, #111827)",
  },
  page: {
    background: "var(--erp-page, #f8fafc)",
  },
  text: {
    color: "var(--erp-text, #111827)",
  },
  muted: {
    color: "var(--erp-muted, #64748b)",
  },
  primaryText: {
    color: "var(--erp-primary, #2563eb)",
  },
  primaryButton: {
    background: "var(--erp-primary, #2563eb)",
    color: "#ffffff",
  },
  primarySoft: {
    background: "var(--erp-primary-light, #eff6ff)",
    color: "var(--erp-primary, #2563eb)",
    borderColor: "var(--erp-border, #e5e7eb)",
  },
};

function firstNonEmpty(...values) {
  for (const value of values) {
    if (
      value !== null &&
      value !== undefined &&
      String(value).trim()
    ) {
      return String(value).trim();
    }
  }

  return "";
}

function normalizeLogoPath(value) {
  const logo = firstNonEmpty(value);

  if (!logo) return "";

  if (/^(https?:\/\/|\/|data:image\/)/i.test(logo)) {
    return logo;
  }

  return `/${logo.replace(/^\.?\//, "")}`;
}

function isUserActive(value) {
  return (
    value === true ||
    value === 1 ||
    value === "1" ||
    String(value).toLowerCase() === "true"
  );
}

function getCompanyFromUser(user) {
  if (user.company_id == null) return null;

  return {
    id: String(user.company_id),
    name:
      firstNonEmpty(user.company_name) ||
      `Company ${user.company_id}`,
    roleId: user.role_id ?? "",
    roleName: firstNonEmpty(user.role_name, user.role),
    logo: normalizeLogoPath(
      user.company_logo_url ||
        user.company_logo ||
        user.logo_url ||
        user.logo_path ||
        ""
    ),
    city: firstNonEmpty(
      user.company_city,
      user.company_location,
      user.company_address
    ),
  };
}

function groupUsersById(rows) {
  const grouped = new Map();

  for (const user of rows) {
    if (user.user_id == null) continue;

    const userId = String(user.user_id);

    if (!grouped.has(userId)) {
      grouped.set(userId, {
        ...user,
        companies: [],
        roleNames: [],
      });
    }

    const item = grouped.get(userId);
    const company = getCompanyFromUser(user);

    if (company) {
      const existing = item.companies.find(
        (entry) => entry.id === company.id
      );

      if (!existing) {
        item.companies.push(company);
      } else {
        if (!existing.logo && company.logo) {
          existing.logo = company.logo;
        }

        if (!existing.city && company.city) {
          existing.city = company.city;
        }

        if (!existing.roleId && company.roleId) {
          existing.roleId = company.roleId;
        }

        if (!existing.roleName && company.roleName) {
          existing.roleName = company.roleName;
        }
      }
    }

    const roleName = firstNonEmpty(user.role_name, user.role);

    if (roleName && !item.roleNames.includes(roleName)) {
      item.roleNames.push(roleName);
    }
  }

  for (const user of grouped.values()) {
    user.companies.sort(
      (a, b) =>
        a.name.localeCompare(b.name) ||
        Number(a.id) - Number(b.id)
    );
  }

  return Array.from(grouped.values()).map((user) => ({
    ...user,
    role_name: user.roleNames.join(", "),
  }));
}

function getInitials(value) {
  return (
    String(value || "U")
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part.charAt(0))
      .join("")
      .toUpperCase() || "U"
  );
}

function UserAvatar({ user, size = "large" }) {
  const dimensions = {
    small: "h-11 w-11 rounded-xl text-sm",
    medium: "h-14 w-14 rounded-2xl text-lg",
    large: "h-[68px] w-[68px] rounded-2xl text-xl",
  };

  return (
    <div
      className={`relative flex shrink-0 items-center justify-center ${dimensions[size]} font-bold shadow-sm`}
      style={{
        background: "var(--erp-primary, #2563eb)",
        color: "#ffffff",
      }}
      aria-label={`Avatar for ${user.full_name || user.username || "user"}`}
    >
      {getInitials(user.full_name || user.username)}

      {isUserActive(user.is_active) && (
        <span
          className="absolute -bottom-1 -right-1 h-4 w-4 rounded-full border-[3px] bg-emerald-500"
          style={{
            borderColor: "var(--erp-surface, #ffffff)",
          }}
          aria-label="Active user"
        />
      )}
    </div>
  );
}

function CompanyLogo({ logo, name }) {
  const [failedLogo, setFailedLogo] = useState("");

  if (!logo || failedLogo === logo) {
    return (
      <div
        className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border text-sm font-bold"
        style={{
          background: "var(--erp-page, #f8fafc)",
          borderColor: "var(--erp-border, #e5e7eb)",
          color: "var(--erp-primary, #2563eb)",
        }}
        title={name}
      >
        {getInitials(name)}
      </div>
    );
  }

  return (
    <img
      key={logo}
      src={logo}
      alt={`${name} logo`}
      loading="lazy"
      onError={() => setFailedLogo(logo)}
      className="h-12 w-12 shrink-0 rounded-xl border bg-white p-1 object-contain"
      style={{ borderColor: "var(--erp-border, #e5e7eb)" }}
    />
  );
}

function StatusBadge({ active }) {
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold"
      style={{
        background: active
          ? "var(--erp-green-light, #ecfdf5)"
          : "var(--erp-page, #f8fafc)",
        borderColor: active
          ? "var(--erp-green, #a7f3d0)"
          : "var(--erp-border, #e5e7eb)",
        color: active
          ? "var(--erp-green-text, #047857)"
          : "var(--erp-muted, #64748b)",
      }}
    >
      <span
        className="h-1.5 w-1.5 rounded-full"
        style={{
          background: active
            ? "var(--erp-green, #10b981)"
            : "var(--erp-muted, #94a3b8)",
        }}
      />
      {active ? "Active" : "Inactive"}
    </span>
  );
}

function StatCard({ title, value, description, icon: Icon }) {
  return (
    <div
      className="group relative overflow-hidden rounded-2xl border p-5 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md"
      style={styles.surface}
    >
      <div className="relative flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-medium" style={styles.muted}>
            {title}
          </p>

          <p
            className="mt-3 text-3xl font-bold tracking-tight"
            style={styles.text}
          >
            {value}
          </p>
        </div>

        <div
          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border"
          style={{
            ...styles.primarySoft,
            borderColor: "var(--erp-border, #e5e7eb)",
          }}
        >
          <Icon size={22} strokeWidth={1.8} />
        </div>
      </div>

      <p className="mt-4 text-xs leading-5" style={styles.muted}>
        {description}
      </p>
    </div>
  );
}

function InfoField({ label, value, icon: Icon }) {
  return (
    <div
      className="min-w-0 rounded-xl border p-4 transition hover:shadow-sm"
      style={{
        ...styles.surface,
        background: "var(--erp-page, #f8fafc)",
      }}
    >
      <div className="flex items-center gap-2">
        {Icon && <Icon size={15} style={styles.muted} />}

        <p
          className="text-xs font-medium uppercase tracking-wider"
          style={styles.muted}
        >
          {label}
        </p>
      </div>

      <p
        className="mt-3 break-words text-sm font-semibold"
        style={styles.text}
      >
        {value === null || value === undefined || value === ""
          ? "-"
          : value}
      </p>
    </div>
  );
}

function EmptyState({
  title,
  description,
  icon: Icon = Users,
  action,
}) {
  return (
    <div
      className="flex min-h-64 flex-col items-center justify-center rounded-2xl border border-dashed px-6 py-12 text-center"
      style={{
        ...styles.surface,
        background: "var(--erp-page, #f8fafc)",
      }}
    >
      <div
        className="flex h-14 w-14 items-center justify-center rounded-2xl border"
        style={styles.primarySoft}
      >
        <Icon size={27} />
      </div>

      <h3 className="mt-5 font-semibold" style={styles.text}>
        {title}
      </h3>

      <p
        className="mt-2 max-w-md text-sm leading-6"
        style={styles.muted}
      >
        {description}
      </p>

      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

function CompanyCard({
  company,
  user,
  onEdit,
  onRemove,
  deletingKey,
  canEdit,
  canDelete,
}) {
  const key = `${user.user_id}-${company.id}`;
  const deleting = deletingKey === key;

  return (
    <article
      className="overflow-hidden rounded-2xl border shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md"
      style={styles.surface}
    >
      <div
        className="h-1 w-full"
        style={{ background: "var(--erp-primary, #2563eb)" }}
      />

      <div className="p-5">
        <div className="flex items-start gap-3">
          <CompanyLogo logo={company.logo} name={company.name} />

          <div className="min-w-0 flex-1">
            <h4 className="break-words font-bold" style={styles.text}>
              {company.name}
            </h4>

            <p className="mt-1 text-xs" style={styles.muted}>
              Company ID: {company.id}
            </p>

            <span
              className="mt-2 inline-flex max-w-full items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold"
              style={styles.primarySoft}
            >
              <ShieldCheck size={12} />
              {company.roleName || "No role assigned"}
            </span>
          </div>

          <div
            className="rounded-xl border p-2"
            style={{
              background: "var(--erp-page, #f8fafc)",
              borderColor: "var(--erp-border, #e5e7eb)",
              color: "var(--erp-muted, #64748b)",
            }}
          >
            <Building2 size={18} />
          </div>
        </div>

        <div
          className="mt-5 space-y-4 border-t pt-4"
          style={{ borderColor: "var(--erp-border, #e5e7eb)" }}
        >
          <div className="flex items-start gap-3">
            <MapPin
              size={17}
              className="mt-0.5 shrink-0"
              style={styles.muted}
            />

            <div className="min-w-0">
              <p className="text-xs" style={styles.muted}>
                Location
              </p>
              <p
                className="mt-1 break-words text-sm font-medium"
                style={styles.text}
              >
                {company.city || "Location not provided"}
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <LockKeyhole
              size={17}
              className="mt-0.5 shrink-0"
              style={styles.muted}
            />

            <div className="min-w-0">
              <p className="text-xs" style={styles.muted}>
                Role identifier
              </p>
              <p className="mt-1 text-sm font-medium" style={styles.text}>
                {company.roleId || "Not available"}
              </p>
            </div>
          </div>
        </div>

        {(canEdit || canDelete) && (
          <div
            className="mt-5 flex flex-wrap gap-2 border-t pt-4"
            style={{ borderColor: "var(--erp-border, #e5e7eb)" }}
          >
            {canEdit && (
              <button
                type="button"
                onClick={() => onEdit(user, company)}
                className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl border px-3 py-2.5 text-sm font-semibold transition hover:opacity-80"
                style={{
                  borderColor: "var(--erp-border, #e5e7eb)",
                  color: "var(--erp-text, #111827)",
                }}
              >
                <Pencil size={15} />
                Edit access
              </button>
            )}

            {canDelete && (
              <button
                type="button"
                disabled={Boolean(deletingKey)}
                onClick={() => onRemove(user, company)}
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-red-200 px-3 py-2.5 text-sm font-semibold text-red-600 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Trash2 size={15} />
                {deleting ? "Removing..." : "Remove"}
              </button>
            )}
          </div>
        )}
      </div>
    </article>
  );
}

function AccessDenied({ onRetry }) {
  return (
    <main
      className="mx-auto flex min-h-[65vh] w-full max-w-3xl items-center justify-center px-4 py-10"
      style={styles.page}
    >
      <section
        className="w-full rounded-2xl border p-8 text-center shadow-sm sm:p-12"
        style={styles.surface}
      >
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl border border-red-200 bg-red-50 text-red-600 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300">
          <ShieldAlert size={30} />
        </div>

        <h1 className="mt-6 text-2xl font-bold" style={styles.text}>
          Access denied
        </h1>

        <p className="mx-auto mt-3 max-w-lg text-sm leading-6" style={styles.muted}>
          You do not have permission to view User Management. Contact your
          administrator if you believe you should have access.
        </p>

        <div className="mt-7 flex flex-wrap justify-center gap-3">
          <button
            type="button"
            onClick={onRetry}
            className="inline-flex items-center gap-2 rounded-xl border px-4 py-3 text-sm font-semibold"
            style={{
              borderColor: "var(--erp-border, #e5e7eb)",
              color: "var(--erp-text, #111827)",
            }}
          >
            <RefreshCw size={16} />
            Try again
          </button>

          <Link
            href="/dashboard"
            className="inline-flex items-center gap-2 rounded-xl px-5 py-3 text-sm font-semibold"
            style={styles.primaryButton}
          >
            Return to dashboard
            <ArrowRight size={16} />
          </Link>
        </div>
      </section>
    </main>
  );
}

function getPermissionRows(data) {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.permissions)) return data.permissions;
  if (Array.isArray(data?.data?.permissions)) return data.data.permissions;
  if (Array.isArray(data?.data)) return data.data;
  return [];
}

function readPermission(rows, key) {
  const permission = rows.find(
    (item) =>
      String(
        item.permission_key ??
          item.module_key ??
          item.key ??
          ""
      ).toLowerCase() === key
  );

  return {
    view: permission?.can_view === true || permission?.can_view === 1,
    create: permission?.can_create === true || permission?.can_create === 1,
    update: permission?.can_update === true || permission?.can_update === 1,
    delete: permission?.can_delete === true || permission?.can_delete === 1,
  };
}

export default function UsersPage() {
  const router = useRouter();

  const [users, setUsers] = useState([]);
  const [selectedUserId, setSelectedUserId] = useState("");
  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState("Roles");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [deletingKey, setDeletingKey] = useState("");
  const [accessDenied, setAccessDenied] = useState(false);

  const [permissions, setPermissions] = useState({
    view: false,
    create: false,
    update: false,
    delete: false,
  });

  const [permissionsLoaded, setPermissionsLoaded] = useState(false);

  const loadPermissions = useCallback(async (signal) => {
    try {
      const response = await fetch("/api/permissions/current", {
        method: "GET",
        cache: "no-store",
        signal,
        headers: { Accept: "application/json" },
      });

      if (!response.ok) {
        if (response.status === 401 || response.status === 403) {
          setPermissions({
            view: false,
            create: false,
            update: false,
            delete: false,
          });
          setPermissionsLoaded(true);
          return;
        }

        throw new Error("Failed to load user permissions.");
      }

      const data = await response.json();

      if (signal?.aborted) return;

      const rows = getPermissionRows(data);
      setPermissions(readPermission(rows, "users"));
      setPermissionsLoaded(true);
    } catch (err) {
      if (err.name !== "AbortError" && !signal?.aborted) {
        setPermissions({
          view: false,
          create: false,
          update: false,
          delete: false,
        });
        setPermissionsLoaded(true);
      }
    }
  }, []);

  const loadUsers = useCallback(async (signal) => {
    try {
      const response = await fetch("/api/users", {
        method: "GET",
        cache: "no-store",
        signal,
        headers: { Accept: "application/json" },
      });

      if (response.status === 401 || response.status === 403) {
        if (!signal?.aborted) {
          setUsers([]);
          setSelectedUserId("");
          setAccessDenied(true);
          setError("");
        }
        return;
      }

      let data;

      try {
        data = await response.json();
      } catch {
        data = {};
      }

      if (!response.ok || data.success === false) {
        throw new Error(data.message || "Failed to load users.");
      }

      if (signal?.aborted) return;

      const groupedUsers = groupUsersById(
        Array.isArray(data.users) ? data.users : []
      );

      setUsers(groupedUsers);

      setSelectedUserId((currentId) => {
        if (
          currentId &&
          groupedUsers.some(
            (user) => String(user.user_id) === currentId
          )
        ) {
          return currentId;
        }

        return String(groupedUsers[0]?.user_id ?? "");
      });

      setAccessDenied(false);
      setError("");
    } catch (err) {
      if (err.name !== "AbortError" && !signal?.aborted) {
        setError(err.message || "Failed to load users.");
      }
    } finally {
      if (!signal?.aborted) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();

    Promise.resolve().then(() => {
      if (controller.signal.aborted) return;

      void loadPermissions(controller.signal);
      void loadUsers(controller.signal);
    });

    return () => controller.abort();
  }, [loadPermissions, loadUsers]);

  const searchTerm = search.trim().toLowerCase();

  const filteredUsers = useMemo(
    () =>
      users.filter((user) => {
        if (!searchTerm) return true;

        const values = [
          user.user_id,
          user.full_name,
          user.username,
          user.email,
          user.role_name,
          isUserActive(user.is_active) ? "active" : "inactive",
          ...(user.companies || []).flatMap((company) => [
            company.id,
            company.name,
            company.city,
            company.roleName,
          ]),
        ];

        return values.some((value) =>
          String(value ?? "").toLowerCase().includes(searchTerm)
        );
      }),
    [users, searchTerm]
  );

  const selectedUser =
    filteredUsers.find(
      (user) => String(user.user_id) === selectedUserId
    ) ||
    filteredUsers[0] ||
    null;

  const stats = useMemo(() => {
    const active = users.filter((user) =>
      isUserActive(user.is_active)
    ).length;

    const memberships = users.reduce(
      (total, user) => total + user.companies.length,
      0
    );

    const roles = new Set(
      users.flatMap((user) =>
        user.companies
          .map((company) => company.roleName)
          .filter(Boolean)
      )
    );

    return {
      total: users.length,
      active,
      inactive: users.length - active,
      memberships,
      roles: roles.size,
    };
  }, [users]);

  const refreshUsers = useCallback(async () => {
    setRefreshing(true);
    setError("");

    const controller = new AbortController();

    try {
      await Promise.all([
        loadUsers(controller.signal),
        loadPermissions(controller.signal),
      ]);
    } finally {
      setRefreshing(false);
    }
  }, [loadPermissions, loadUsers]);

  const editCompanyAccess = useCallback(
    (user, company) => {
      router.push(
        `/dashboard/users/add?id=${encodeURIComponent(user.user_id)}&companyId=${encodeURIComponent(company.id)}`
      );
    },
    [router]
  );

  const deleteUser = useCallback(
    async (user, company) => {
      const key = `${user.user_id}-${company.id}`;

      if (deletingKey || !permissions.delete) return;

      const confirmed = window.confirm(
        `Remove "${user.username}" from "${company.name}"?\n\n` +
          "This removes only this company's membership. The login account and other company memberships remain."
      );

      if (!confirmed) return;

      setDeletingKey(key);
      setError("");
      setMessage("");

      try {
        const response = await fetch(
          `/api/users/${encodeURIComponent(user.user_id)}?companyId=${encodeURIComponent(company.id)}`,
          {
            method: "DELETE",
            cache: "no-store",
            headers: { Accept: "application/json" },
          }
        );

        let data;

        try {
          data = await response.json();
        } catch {
          data = {};
        }

        if (response.status === 401 || response.status === 403) {
          throw new Error("You do not have permission to remove this user.");
        }

        if (!response.ok || data.success === false) {
          throw new Error(
            data.message || "Failed to remove user from company."
          );
        }

        setMessage(
          data.message || `User access removed from ${company.name}.`
        );

        await loadUsers();
      } catch (err) {
        setError(err.message || "Failed to remove user from company.");
      } finally {
        setDeletingKey("");
      }
    },
    [deletingKey, loadUsers, permissions.delete]
  );

  const tabDescription = {
    Roles: "Review roles assigned to this user across companies.",
    Details: "View account information and company memberships.",
    "Assign Subsidiary":
      "Review the companies and subsidiaries this user can access.",
    "Assign Locations":
      "Review the locations associated with each company.",
  };

  function renderRoles() {
    if (!selectedUser.companies.length) {
      return (
        <EmptyState
          title="No company roles found"
          description="This user has no company memberships or role assignments to display."
          icon={ShieldCheck}
        />
      );
    }

    return (
      <div
        className="overflow-x-auto rounded-2xl border"
        style={{ borderColor: "var(--erp-border, #e5e7eb)" }}
      >
        <table className="w-full min-w-[650px] text-left text-sm">
          <thead
            style={{
              background: "var(--erp-page, #f8fafc)",
              color: "var(--erp-muted, #64748b)",
            }}
          >
            <tr>
              <th className="px-5 py-4 font-semibold">Company</th>
              <th className="px-5 py-4 font-semibold">Assigned role</th>
              <th className="px-5 py-4 font-semibold">Role ID</th>
              {(permissions.update || permissions.delete) && (
                <th className="px-5 py-4 font-semibold">Action</th>
              )}
            </tr>
          </thead>

          <tbody>
            {selectedUser.companies.map((company) => (
              <tr
                key={company.id}
                className="border-t transition"
                style={{ borderColor: "var(--erp-border, #e5e7eb)" }}
              >
                <td className="px-5 py-4">
                  <div className="flex items-center gap-3">
                    <CompanyLogo logo={company.logo} name={company.name} />

                    <div className="min-w-0">
                      <p className="font-semibold" style={styles.text}>
                        {company.name}
                      </p>
                      <p className="mt-1 text-xs" style={styles.muted}>
                        {company.city || "Location not provided"}
                      </p>
                      <p className="mt-1 text-xs" style={styles.muted}>
                        ID: {company.id}
                      </p>
                    </div>
                  </div>
                </td>

                <td className="px-5 py-4">
                  <span
                    className="inline-flex rounded-full border px-3 py-1.5 text-xs font-semibold"
                    style={styles.primarySoft}
                  >
                    {company.roleName || "No role"}
                  </span>
                </td>

                <td className="px-5 py-4" style={styles.muted}>
                  {company.roleId || "-"}
                </td>

                {(permissions.update || permissions.delete) && (
                  <td className="px-5 py-4">
                    {permissions.update && (
                      <button
                        type="button"
                        onClick={() =>
                          editCompanyAccess(selectedUser, company)
                        }
                        className="inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-semibold transition hover:opacity-80"
                        style={{
                          borderColor: "var(--erp-border, #e5e7eb)",
                          color: "var(--erp-text, #111827)",
                        }}
                      >
                        <Pencil size={14} />
                        Edit access
                      </button>
                    )}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  function renderDetails() {
    return (
      <div className="space-y-7">
        <div>
          <h4 className="font-semibold" style={styles.text}>
            Personal information
          </h4>
          <p className="mt-1 text-sm" style={styles.muted}>
            Account details and current status.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          <InfoField label="User ID" value={selectedUser.user_id} />
          <InfoField label="Full name" value={selectedUser.full_name} icon={UserRound} />
          <InfoField label="Username" value={selectedUser.username} icon={Users} />
          <InfoField label="Email address" value={selectedUser.email} icon={Mail} />
          <InfoField
            label="Account status"
            value={isUserActive(selectedUser.is_active) ? "Active" : "Inactive"}
            icon={CircleCheck}
          />
          <InfoField
            label="Company memberships"
            value={selectedUser.companies.length}
            icon={Building2}
          />
        </div>

        <div>
          <h4 className="font-semibold" style={styles.text}>
            Company access
          </h4>
          <p className="mt-1 text-sm" style={styles.muted}>
            Review each company, its location, and its assigned role.
          </p>
        </div>

        {selectedUser.companies.length ? (
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            {selectedUser.companies.map((company) => (
              <CompanyCard
                key={company.id}
                company={company}
                user={selectedUser}
                onEdit={editCompanyAccess}
                onRemove={deleteUser}
                deletingKey={deletingKey}
                canEdit={permissions.update}
                canDelete={permissions.delete}
              />
            ))}
          </div>
        ) : (
          <EmptyState
            title="No company memberships"
            description="No company access is currently assigned to this user."
            icon={Building2}
          />
        )}
      </div>
    );
  }

  function renderCompanyCards(title, description) {
    if (!selectedUser.companies.length) {
      return (
        <EmptyState
          title={`No ${title.toLowerCase()} available`}
          description="This user has no company memberships to display."
          icon={Building2}
        />
      );
    }

    return (
      <div className="space-y-5">
        <div>
          <h4 className="font-semibold" style={styles.text}>
            {title}
          </h4>
          <p className="mt-1 text-sm" style={styles.muted}>
            {description}
          </p>
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {selectedUser.companies.map((company) => (
            <CompanyCard
              key={company.id}
              company={company}
              user={selectedUser}
              onEdit={editCompanyAccess}
              onRemove={deleteUser}
              deletingKey={deletingKey}
              canEdit={permissions.update}
              canDelete={permissions.delete}
            />
          ))}
        </div>
      </div>
    );
  }

  function renderTabContent() {
    switch (activeTab) {
      case "Roles":
        return renderRoles();
      case "Details":
        return renderDetails();
      case "Assign Subsidiary":
        return renderCompanyCards(
          "Company / Subsidiary",
          "Review company names, logos, locations, and subsidiary access."
        );
      case "Assign Locations":
        return renderCompanyCards(
          "Company locations",
          "Review the location associated with each company this user can access."
        );
      default:
        return null;
    }
  }

  if (permissionsLoaded && !permissions.view) {
    return <AccessDenied onRetry={refreshUsers} />;
  }

  if (accessDenied) {
    return <AccessDenied onRetry={refreshUsers} />;
  }

  const canCreate = permissions.create;
  const canEdit = permissions.update;
  const canDelete = permissions.delete;

  return (
    <main className="mx-auto w-full max-w-[1700px] space-y-6 pb-10">
      <section
        className="relative overflow-hidden rounded-2xl border p-6 shadow-sm sm:p-8"
        style={styles.surface}
      >
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-12 -top-24 h-72 w-72 rounded-full opacity-10 blur-3xl"
          style={{ background: "var(--erp-primary, #2563eb)" }}
        />

        <div className="relative flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="mb-4 flex flex-wrap items-center gap-2 text-sm" style={styles.muted}>
              <Link href="/dashboard" className="transition hover:opacity-70">
                Dashboard
              </Link>
              <ChevronRight size={15} />
              <span style={styles.text}>Administration</span>
              <ChevronRight size={15} />
              <span style={styles.primaryText}>Users</span>
            </div>

            <div
              className="mb-3 inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold"
              style={styles.primarySoft}
            >
              <Sparkles size={14} />
              ADMINISTRATION WORKSPACE
            </div>

            <h1 className="text-3xl font-bold tracking-tight sm:text-4xl" style={styles.text}>
              User Management
            </h1>

            <p className="mt-3 max-w-2xl text-sm leading-6 sm:text-base" style={styles.muted}>
              Manage user accounts, company memberships, and role assignments
              from one central workspace.
            </p>
          </div>

          <div className="relative flex flex-wrap gap-3">
            <button
              type="button"
              disabled={loading || refreshing}
              onClick={refreshUsers}
              className="inline-flex items-center justify-center gap-2 rounded-xl border px-4 py-3 text-sm font-semibold transition hover:opacity-80 disabled:cursor-not-allowed disabled:opacity-50"
              style={{
                borderColor: "var(--erp-border, #e5e7eb)",
                color: "var(--erp-text, #111827)",
              }}
            >
              <RefreshCw size={17} className={refreshing ? "animate-spin" : ""} />
              Refresh
            </button>

            {canCreate && (
              <Link
                href="/dashboard/users/assign"
                className="inline-flex items-center justify-center gap-2 rounded-xl border px-4 py-3 text-sm font-semibold transition hover:opacity-80"
                style={{
                  borderColor: "var(--erp-border, #e5e7eb)",
                  color: "var(--erp-text, #111827)",
                }}
              >
                <ShieldCheck size={17} />
                Assign user
              </Link>
            )}

            {canCreate && (
              <Link
                href="/dashboard/users/add"
                className="inline-flex items-center justify-center gap-2 rounded-xl px-5 py-3 text-sm font-semibold shadow-sm transition hover:-translate-y-0.5 hover:opacity-90"
                style={styles.primaryButton}
              >
                <UserPlus size={18} />
                Add user
                <ArrowRight size={16} />
              </Link>
            )}
          </div>
        </div>
      </section>

      {message && (
        <div
          role="status"
          className="flex items-start justify-between gap-3 rounded-xl border px-4 py-4 text-sm"
          style={{
            background: "var(--erp-green-light, #ecfdf5)",
            borderColor: "var(--erp-green, #a7f3d0)",
            color: "var(--erp-green-text, #047857)",
          }}
        >
          <div className="flex items-start gap-3">
            <CircleCheck size={19} className="mt-0.5 shrink-0" />
            <span>{message}</span>
          </div>
          <button type="button" onClick={() => setMessage("")} aria-label="Dismiss message">
            <X size={18} />
          </button>
        </div>
      )}

      {error && (
        <div
          role="alert"
          className="flex items-start justify-between gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-4 text-sm text-red-800 dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-300"
        >
          <div className="flex items-start gap-3">
            <CircleX size={19} className="mt-0.5 shrink-0" />
            <span>{error}</span>
          </div>
          <button type="button" onClick={() => setError("")} aria-label="Dismiss error">
            <X size={18} />
          </button>
        </div>
      )}

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard title="Total users" value={loading ? "—" : stats.total} description="Unique accounts in your workspace" icon={Users} />
        <StatCard title="Active users" value={loading ? "—" : stats.active} description="Accounts currently marked active" icon={CircleCheck} />
        <StatCard title="Company memberships" value={loading ? "—" : stats.memberships} description="User-to-company assignments" icon={Building2} />
        <StatCard title="Roles in use" value={loading ? "—" : stats.roles} description={`${loading ? "Loading" : stats.inactive} inactive accounts`} icon={ShieldCheck} />
      </section>

      <section className="grid min-w-0 grid-cols-1 items-start gap-5 xl:grid-cols-[340px_minmax(0,1fr)]">
        <aside className="min-w-0 overflow-hidden rounded-2xl border shadow-sm" style={styles.surface}>
          <div className="p-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-bold" style={styles.text}>Team members</h2>
                <p className="mt-1 text-xs" style={styles.muted}>Select an account to manage</p>
              </div>

              <span className="rounded-xl border px-3 py-2 text-sm font-bold" style={styles.primarySoft}>
                {users.length}
              </span>
            </div>

            <div className="relative mt-5">
              <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2" style={styles.muted} />
              <input
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search users or companies..."
                aria-label="Search users or companies"
                className="w-full rounded-xl border py-3 pl-10 pr-10 text-sm outline-none transition focus:border-[var(--erp-primary)]"
                style={{
                  background: "var(--erp-input, var(--erp-page, #f8fafc))",
                  borderColor: "var(--erp-border, #e5e7eb)",
                  color: "var(--erp-text, #111827)",
                }}
              />

              {search && (
                <button
                  type="button"
                  onClick={() => setSearch("")}
                  aria-label="Clear search"
                  className="absolute right-3 top-1/2 -translate-y-1/2"
                  style={styles.muted}
                >
                  <X size={16} />
                </button>
              )}
            </div>
          </div>

          <div
            className="flex items-center justify-between border-y px-5 py-3"
            style={{
              background: "var(--erp-page, #f8fafc)",
              borderColor: "var(--erp-border, #e5e7eb)",
            }}
          >
            <span className="text-xs font-semibold uppercase tracking-wider" style={styles.muted}>
              User accounts
            </span>
            <span className="text-xs" style={styles.muted}>{filteredUsers.length} found</span>
          </div>

          <div className="max-h-[650px] space-y-1 overflow-y-auto p-2">
            {loading ? (
              <div className="space-y-3 p-3">
                {[1, 2, 3, 4].map((item) => (
                  <div key={item} className="flex animate-pulse gap-3 rounded-xl p-3">
                    <div className="h-11 w-11 rounded-xl" style={{ background: "var(--erp-page, #f8fafc)" }} />
                    <div className="flex-1 space-y-2 pt-1">
                      <div className="h-3 w-3/4 rounded" style={{ background: "var(--erp-page, #f8fafc)" }} />
                      <div className="h-3 w-1/2 rounded" style={{ background: "var(--erp-page, #f8fafc)" }} />
                    </div>
                  </div>
                ))}
              </div>
            ) : filteredUsers.length === 0 ? (
              <div className="px-4 py-12 text-center">
                <Users size={30} className="mx-auto" style={styles.muted} />
                <p className="mt-3 text-sm font-semibold" style={styles.text}>No users found</p>
                <p className="mt-1 text-xs" style={styles.muted}>Try another search term.</p>
                {search && (
                  <button type="button" onClick={() => setSearch("")} className="mt-3 text-xs font-semibold" style={styles.primaryText}>
                    Clear search
                  </button>
                )}
              </div>
            ) : (
              filteredUsers.map((user) => {
                const selected = String(user.user_id) === String(selectedUser?.user_id);

                return (
                  <button
                    type="button"
                    key={user.user_id}
                    onClick={() => setSelectedUserId(String(user.user_id))}
                    aria-pressed={selected}
                    className="group flex w-full items-start gap-3 rounded-xl border p-3 text-left transition"
                    style={{
                      background: selected ? "var(--erp-page, #f8fafc)" : "transparent",
                      borderColor: selected ? "var(--erp-primary, #2563eb)" : "transparent",
                      boxShadow: selected ? "inset 3px 0 0 var(--erp-primary, #2563eb)" : "none",
                    }}
                  >
                    <UserAvatar user={user} size="small" />

                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold" style={styles.text}>
                        {user.full_name || user.username || `User ${user.user_id}`}
                      </p>
                      <p className="mt-1 truncate text-xs" style={styles.muted}>
                        @{user.username || "-"}
                      </p>

                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        <StatusBadge active={isUserActive(user.is_active)} />
                        <span className="text-xs" style={styles.muted}>
                          {user.companies.length} {user.companies.length === 1 ? "company" : "companies"}
                        </span>
                      </div>

                      <p className="mt-2 truncate text-xs" style={styles.muted}>
                        {user.role_name || "No role information"}
                      </p>
                    </div>

                    <ChevronRight
                      size={17}
                      className="mt-2 shrink-0"
                      style={{ color: selected ? "var(--erp-primary, #2563eb)" : "var(--erp-muted, #64748b)" }}
                    />
                  </button>
                );
              })
            )}
          </div>

          {canCreate && (
            <div className="border-t p-4" style={{ background: "var(--erp-page, #f8fafc)", borderColor: "var(--erp-border, #e5e7eb)" }}>
              <Link
                href="/dashboard/users/add"
                className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed px-4 py-3 text-sm font-semibold transition hover:opacity-80"
                style={{
                  borderColor: "var(--erp-primary, #2563eb)",
                  color: "var(--erp-primary, #2563eb)",
                }}
              >
                <Plus size={17} />
                Create another user
              </Link>
            </div>
          )}
        </aside>

        <div className="min-w-0 overflow-hidden rounded-2xl border shadow-sm" style={styles.surface}>
          {loading ? (
            <div className="space-y-5 p-8">
              <div className="h-6 w-1/3 animate-pulse rounded" style={{ background: "var(--erp-page, #f8fafc)" }} />
              <div className="h-4 w-2/3 animate-pulse rounded" style={{ background: "var(--erp-page, #f8fafc)" }} />
              <div className="h-36 animate-pulse rounded-2xl" style={{ background: "var(--erp-page, #f8fafc)" }} />
            </div>
          ) : !selectedUser ? (
            <div className="p-6 sm:p-10">
              <EmptyState
                title="Select a user"
                description="Choose a user from the team list to view their account, roles, and company access."
                icon={UserRound}
                action={
                  canCreate ? (
                    <Link href="/dashboard/users/add" className="inline-flex items-center gap-2 rounded-xl px-5 py-3 text-sm font-semibold" style={styles.primaryButton}>
                      <UserPlus size={17} />
                      Add user
                    </Link>
                  ) : null
                }
              />
            </div>
          ) : (
            <>
              <div className="p-5 sm:p-7">
                <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
                  <div className="flex min-w-0 items-center gap-4">
                    <UserAvatar user={selectedUser} />

                    <div className="min-w-0">
                      <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider" style={styles.primaryText}>
                        <span className="h-1.5 w-1.5 rounded-full" style={{ background: "var(--erp-primary, #2563eb)" }} />
                        User profile
                      </p>

                      <h2 className="mt-1 break-words text-xl font-bold sm:text-2xl" style={styles.text}>
                        {selectedUser.full_name || selectedUser.username || `User ${selectedUser.user_id}`}
                      </h2>

                      <p className="mt-1 break-words text-sm" style={styles.muted}>
                        @{selectedUser.username || "-"}
                      </p>

                      <div className="mt-3 flex flex-wrap items-center gap-2">
                        <StatusBadge active={isUserActive(selectedUser.is_active)} />
                        <span className="rounded-full border px-3 py-1 text-xs font-medium" style={{ borderColor: "var(--erp-border, #e5e7eb)", color: "var(--erp-muted, #64748b)" }}>
                          ID: {selectedUser.user_id}
                        </span>
                      </div>
                    </div>
                  </div>

                  {canEdit && (
                    <button
                      type="button"
                      onClick={() => {
                        const company = selectedUser.companies[0];

                        if (company) {
                          editCompanyAccess(selectedUser, company);
                        } else {
                          router.push(`/dashboard/users/add?id=${encodeURIComponent(selectedUser.user_id)}`);
                        }
                      }}
                      className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-semibold transition hover:opacity-80"
                      style={{
                        borderColor: "var(--erp-border, #e5e7eb)",
                        color: "var(--erp-text, #111827)",
                      }}
                    >
                      <Pencil size={16} />
                      Edit user
                      <ArrowUpRight size={15} />
                    </button>
                  )}
                </div>

                <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
                  <div className="flex min-w-0 items-start gap-3 rounded-xl border p-4" style={{ background: "var(--erp-page, #f8fafc)", borderColor: "var(--erp-border, #e5e7eb)" }}>
                    <div className="rounded-xl border p-2" style={styles.primarySoft}><Mail size={17} /></div>
                    <div className="min-w-0">
                      <p className="text-xs" style={styles.muted}>Email address</p>
                      <p className="mt-1 break-words text-sm font-semibold" style={styles.text}>{selectedUser.email || "-"}</p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3 rounded-xl border p-4" style={{ background: "var(--erp-page, #f8fafc)", borderColor: "var(--erp-border, #e5e7eb)" }}>
                    <div className="rounded-xl border p-2" style={styles.primarySoft}><Building2 size={17} /></div>
                    <div>
                      <p className="text-xs" style={styles.muted}>Company memberships</p>
                      <p className="mt-1 text-sm font-semibold" style={styles.text}>{selectedUser.companies.length} assigned</p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3 rounded-xl border p-4" style={{ background: "var(--erp-page, #f8fafc)", borderColor: "var(--erp-border, #e5e7eb)" }}>
                    <div className="rounded-xl border p-2" style={styles.primarySoft}><ShieldCheck size={17} /></div>
                    <div className="min-w-0">
                      <p className="text-xs" style={styles.muted}>Assigned roles</p>
                      <p className="mt-1 break-words text-sm font-semibold" style={styles.text}>{selectedUser.role_name || "Not assigned"}</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="border-y px-3 sm:px-5" style={{ borderColor: "var(--erp-border, #e5e7eb)" }}>
                <div className="flex gap-1 overflow-x-auto">
                  {TABS.map((tab) => {
                    const Icon = tab.icon;
                    const active = activeTab === tab.name;

                    return (
                      <button
                        type="button"
                        key={tab.name}
                        onClick={() => setActiveTab(tab.name)}
                        aria-pressed={active}
                        className="relative inline-flex shrink-0 items-center gap-2 whitespace-nowrap px-3 py-4 text-sm font-semibold transition sm:px-4"
                        style={{ color: active ? "var(--erp-primary, #2563eb)" : "var(--erp-muted, #64748b)" }}
                      >
                        <Icon size={16} />
                        {tab.name}

                        {active && (
                          <span className="absolute inset-x-3 bottom-0 h-0.5 rounded-full sm:inset-x-4" style={{ background: "var(--erp-primary, #2563eb)" }} />
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="min-w-0 p-5 sm:p-7">
                <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <h3 className="text-lg font-bold" style={styles.text}>{activeTab}</h3>
                    <p className="mt-1 text-sm" style={styles.muted}>{tabDescription[activeTab]}</p>
                  </div>

                  <span className="inline-flex w-fit items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium" style={{ borderColor: "var(--erp-border, #e5e7eb)", color: "var(--erp-muted, #64748b)" }}>
                    <BriefcaseBusiness size={14} />
                    {selectedUser.companies.length} memberships
                  </span>
                </div>

                {renderTabContent()}
              </div>

              <div className="flex flex-col gap-2 border-t px-5 py-4 text-xs sm:flex-row sm:items-center sm:justify-between" style={{ borderColor: "var(--erp-border, #e5e7eb)", background: "var(--erp-page, #f8fafc)", color: "var(--erp-muted, #64748b)" }}>
                <span>Selected user: {selectedUser.username || selectedUser.user_id}</span>
                <span>{filteredUsers.length} matching accounts · {stats.memberships} total memberships</span>
              </div>
            </>
          )}
        </div>
      </section>

      <section className="flex items-start gap-3 rounded-2xl border p-4" style={{ background: "var(--erp-page, #f8fafc)", borderColor: "var(--erp-border, #e5e7eb)" }}>
        <div className="rounded-xl border p-2" style={styles.primarySoft}>
          <LockKeyhole size={18} />
        </div>

        <div>
          <h3 className="text-sm font-semibold" style={styles.text}>Account security</h3>
          <p className="mt-1 text-xs leading-5" style={styles.muted}>
            Backend APIs must validate permissions and company membership on every protected request.
            Interface restrictions are only a usability feature and do not replace server-side authorization.
          </p>
        </div>
      </section>
    </main>
  );
}
