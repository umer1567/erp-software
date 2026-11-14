
export const dynamic = "force-dynamic";

import { getCurrentUser } from "@/lib/auth";
import { hasPermission } from "@/lib/permissions";
import DashboardAnalytics from "./DashboardAnalytics";
import UserStatistics from "./UserStatistics";

function Icon({ name, size = 24, strokeWidth = 1.8, className = "", style = {} }) {
  const paths = {
    user: (
      <>
        <circle cx="12" cy="8" r="4" />
        <path d="M5 21v-2a7 7 0 0 1 14 0v2" />
      </>
    ),
    shield: (
      <>
        <path d="M12 22s8-4 8-11V5l-8-3-8 3v6c0 7 8 11 8 11Z" />
        <path d="m9 12 2 2 4-4" />
      </>
    ),
    dashboard: (
      <>
        <rect x="3" y="3" width="8" height="8" rx="1" />
        <rect x="13" y="3" width="8" height="5" rx="1" />
        <rect x="13" y="10" width="8" height="11" rx="1" />
        <rect x="3" y="13" width="8" height="8" rx="1" />
      </>
    ),
    arrow: (
      <>
        <path d="M7 17 17 7" />
        <path d="M7 7h10v10" />
      </>
    ),
    sparkles: (
      <>
        <path d="m12 3 1.9 5.8L20 11l-6.1 2.2L12 19l-1.9-5.8L4 11l6.1-2.2L12 3Z" />
        <path d="m19 14 1.2 2.8L23 18l-2.8 1.2L19 22l-1.2-2.8L15 18l2.8-1.2L19 14Z" />
      </>
    ),
    building: (
      <>
        <rect x="3" y="3" width="18" height="18" rx="2" />
        <path d="M9 21V9h6v12M7 7h.01M17 7h.01M7 11h.01M17 11h.01M7 15h.01M17 15h.01" />
      </>
    ),
    lock: (
      <>
        <rect x="4" y="10" width="16" height="11" rx="2" />
        <path d="M8 10V7a4 4 0 1 1 8 0v3" />
      </>
    ),
  };

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      style={style}
      aria-hidden="true"
    >
      {paths[name]}
    </svg>
  );
}

function InfoCard({ title, value, description, icon, accent }) {
  const styles = {
    blue: {
      icon: "bg-sky-100 text-sky-700",
      glow: "from-sky-500/10",
    },
    green: {
      icon: "bg-emerald-100 text-emerald-700",
      glow: "from-emerald-500/10",
    },
    teal: {
      icon: "bg-cyan-100 text-cyan-700",
      glow: "from-cyan-500/10",
    },
  };

  const style = styles[accent] || styles.blue;

  return (
    <article className="erp-card group relative overflow-hidden p-5 transition-all duration-300 hover:-translate-y-1 sm:p-6">
      <div
        className={`pointer-events-none absolute inset-0 bg-gradient-to-br ${style.glow} to-transparent opacity-60`}
      />

      <div className="relative flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="erp-muted text-sm font-medium">{title}</p>

          <h3 className="mt-3 break-words text-2xl font-bold tracking-tight [color:var(--erp-text)]">
            {value}
          </h3>

          <p className="erp-muted mt-2 text-xs leading-5">
            {description}
          </p>
        </div>

        <div
          className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl ${style.icon} transition-transform duration-300 group-hover:scale-110`}
        >
          <Icon name={icon} size={23} />
        </div>
      </div>

      <div className="relative mt-5 flex items-center justify-between border-t pt-4 [border-color:var(--erp-border)]">
        <span className="erp-muted text-xs font-medium">
          ERP workspace
        </span>

        <Icon
          name="arrow"
          size={17}
          className="text-[var(--erp-primary)] transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5"
        />
      </div>
    </article>
  );
}

function AccessDenied() {
  return (
    <main className="flex min-h-[60vh] items-center justify-center p-6">
      <section className="erp-card w-full max-w-lg p-8 text-center sm:p-10">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-rose-500/10 text-rose-500">
          <Icon name="lock" size={32} />
        </div>

        <h1 className="mt-5 text-2xl font-bold [color:var(--erp-text)]">
          Dashboard Access Denied
        </h1>

        <p className="erp-muted mt-3 text-sm leading-7">
          You do not have permission to view the dashboard.
          Please contact your administrator if you need access.
        </p>
      </section>
    </main>
  );
}

export default async function DashboardPage() {
  const user = await getCurrentUser();

  if (!user) {
    return <AccessDenied />;
  }

  const roleId = Number(user.roleId ?? user.role_id);

  if (!Number.isInteger(roleId) || roleId <= 0) {
    return <AccessDenied />;
  }

  let canViewDashboard = false;
  let canViewUsers = false;

  try {
    [canViewDashboard, canViewUsers] = await Promise.all([
      hasPermission(roleId, "dashboard", "view"),
      hasPermission(roleId, "users", "view"),
    ]);
  } catch (error) {
    console.error("DASHBOARD PAGE PERMISSION ERROR:", error);
    return <AccessDenied />;
  }

  if (canViewDashboard !== true) {
    return <AccessDenied />;
  }

  const username = user.username || "User";
  const roleName = user.roleName ?? user.role_name ?? "User";

  return (
    <div className="space-y-8 lg:space-y-10">
      <section
        className="relative isolate overflow-hidden rounded-3xl border p-6 shadow-sm transition-colors duration-300 sm:p-8 lg:p-10"
        style={{
          background:
            "linear-gradient(135deg, var(--erp-surface) 0%, var(--erp-page) 55%, var(--erp-surface) 100%)",
          borderColor: "var(--erp-border)",
        }}
      >
        <div
          className="pointer-events-none absolute -right-16 -top-20 -z-10 h-64 w-64 rounded-full opacity-15 blur-3xl"
          style={{ backgroundColor: "var(--erp-primary)" }}
        />

        <div
          className="pointer-events-none absolute -bottom-24 right-1/3 -z-10 h-56 w-56 rounded-full opacity-10 blur-3xl"
          style={{ backgroundColor: "var(--erp-green)" }}
        />

        <div className="relative flex flex-col justify-between gap-7 sm:flex-row sm:items-center">
          <div className="min-w-0">
            <div
              className="mb-5 inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold shadow-sm"
              style={{
                backgroundColor: "var(--erp-surface)",
                borderColor: "var(--erp-border)",
                color: "var(--erp-green)",
              }}
            >
              <Icon name="sparkles" size={14} />
              Welcome to your workspace
            </div>

            <h1
              className="text-3xl font-extrabold tracking-tight sm:text-4xl lg:text-5xl"
              style={{ color: "var(--erp-text)" }}
            >
              Welcome back,
              <span className="mt-1 block break-words bg-gradient-to-r from-sky-500 to-emerald-500 bg-clip-text text-transparent">
                {username}
              </span>
            </h1>

            <p
              className="mt-4 max-w-2xl text-sm leading-7 sm:text-base"
              style={{ color: "var(--erp-muted)" }}
            >
              Your business operations, financial performance,
              inventory, and team activity — all in one place.
            </p>

            <div className="mt-6 flex flex-wrap items-center gap-3 text-xs font-medium">
              <span
                className="inline-flex items-center gap-2 rounded-lg border px-3 py-2"
                style={{
                  backgroundColor: "var(--erp-surface)",
                  borderColor: "var(--erp-border)",
                  color: "var(--erp-text)",
                }}
              >
                <span className="h-2 w-2 rounded-full bg-emerald-500" />
                System workspace
              </span>

              <span
                className="inline-flex items-center gap-2 rounded-lg border px-3 py-2"
                style={{
                  backgroundColor: "var(--erp-surface)",
                  borderColor: "var(--erp-border)",
                  color: "var(--erp-text)",
                }}
              >
                <Icon
                  name="shield"
                  size={14}
                  style={{ color: "var(--erp-primary)" }}
                />
                {roleName} access
              </span>
            </div>
          </div>

          <div className="hidden shrink-0 sm:block">
            <div
              className="flex h-28 w-28 items-center justify-center rounded-[2rem] border shadow-lg backdrop-blur transition-transform duration-300 hover:scale-105 lg:h-32 lg:w-32"
              style={{
                backgroundColor: "var(--erp-surface)",
                borderColor: "var(--erp-border)",
                color: "var(--erp-primary)",
                boxShadow: "var(--erp-shadow)",
              }}
            >
              <Icon name="dashboard" size={52} strokeWidth={1.4} />
            </div>
          </div>
        </div>
      </section>

      <section className="space-y-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="h-6 w-1 rounded-full bg-gradient-to-b from-sky-500 to-emerald-500" />
            <h2 className="text-xl font-bold [color:var(--erp-text)]">
              Your Workspace
            </h2>
          </div>

          <p className="erp-muted mt-2 text-sm">
            Your account and access information.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          <InfoCard
            title="Logged-in User"
            value={username}
            description="Your currently signed-in ERP account"
            icon="user"
            accent="blue"
          />

          <InfoCard
            title="Account Role"
            value={roleName}
            description="Your assigned role and access level"
            icon="shield"
            accent="green"
          />

          <InfoCard
            title="Application"
            value="ERP System"
            description="Your business management workspace"
            icon="building"
            accent="teal"
          />
        </div>
      </section>

      {canViewUsers === true && (
        <section className="space-y-4">
          <div>
            <div className="flex items-center gap-2">
              <div className="h-6 w-1 rounded-full bg-emerald-500" />
              <h2 className="text-xl font-bold [color:var(--erp-text)]">
                Administration
              </h2>
            </div>

            <p className="erp-muted mt-2 text-sm">
              Monitor user accounts and login activity.
            </p>
          </div>

          <UserStatistics />
        </section>
      )}

      <section className="space-y-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="h-6 w-1 rounded-full bg-sky-500" />
            <h2 className="text-xl font-bold [color:var(--erp-text)]">
              Business Performance
            </h2>
          </div>

          <p className="erp-muted mt-2 text-sm">
            Review sales, purchases, and payment activity.
          </p>
        </div>

        <DashboardAnalytics />
      </section>

      <section className="erp-card overflow-hidden">
        <div className="h-1.5 bg-gradient-to-r from-sky-500 via-cyan-400 to-emerald-500" />

        <div className="flex flex-col gap-5 p-6 sm:flex-row sm:items-center sm:p-8">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-[var(--erp-blue-light)] text-[var(--erp-primary)]">
            <Icon name="shield" size={28} strokeWidth={1.7} />
          </div>

          <div>
            <h2 className="text-lg font-bold [color:var(--erp-text)] sm:text-xl">
              Your business, connected
            </h2>

            <p className="erp-muted mt-2 max-w-3xl text-sm leading-7">
              Manage users, permissions, inventory, sales, purchases,
              and accounting from one ERP workspace. Available
              modules depend on your assigned permissions.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
