
"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Users,
  UserCheck,
  LogIn,
  Activity,
  RefreshCw,
  TrendingUp,
  ShieldCheck,
  Sparkles,
} from "lucide-react";

const cards = [
  {
    key: "totalUsers",
    title: "Total Users",
    description: "Users in your accessible companies",
    icon: Users,
    color: "blue",
    gradient: "from-sky-500 to-blue-600",
    iconStyle:
      "bg-[var(--erp-blue-light)] text-[var(--erp-primary)]",
  },
  {
    key: "activeUsers",
    title: "Active Accounts",
    description: "Accounts enabled for access",
    icon: UserCheck,
    color: "green",
    gradient: "from-emerald-500 to-green-600",
    iconStyle:
      "bg-[var(--erp-green-light)] text-[var(--erp-green)]",
  },
  {
    key: "usersWhoHaveLoggedIn",
    title: "Users Logged In Before",
    description: "Unique users with a recorded login",
    icon: Activity,
    color: "purple",
    gradient: "from-violet-500 to-purple-600",
    iconStyle: "bg-violet-100 text-violet-700",
  },
  {
    key: "totalLoginEvents",
    title: "Total Login Events",
    description: "Successful logins recorded in history",
    icon: LogIn,
    color: "orange",
    gradient: "from-amber-500 to-orange-600",
    iconStyle: "bg-orange-100 text-orange-700",
  },
];

function formatNumber(value) {
  const number = Number(value ?? 0);

  return Number.isFinite(number)
    ? number.toLocaleString("en-PK")
    : "0";
}

function StatCard({ card, value, loading, index }) {
  const Icon = card.icon;

  return (
    <article
      className="group relative min-w-0 overflow-hidden rounded-2xl border p-5 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-lg sm:p-6"
      style={{
        backgroundColor: "var(--erp-surface)",
        borderColor: "var(--erp-border)",
        animationDelay: `${index * 70}ms`,
      }}
    >
      {/* Top accent */}
      <div
        className={`absolute inset-x-0 top-0 h-1 bg-gradient-to-r ${card.gradient}`}
      />

      {/* Decorative background */}
      <div
        className={`pointer-events-none absolute -right-8 -top-8 h-28 w-28 rounded-full bg-gradient-to-br ${card.gradient} opacity-[0.06] transition-transform duration-500 group-hover:scale-150`}
      />

      <div className="relative flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p
            className="text-sm font-semibold"
            style={{ color: "var(--erp-muted)" }}
          >
            {card.title}
          </p>

          <div className="mt-4 flex min-h-10 items-center">
            {loading && value === undefined ? (
              <div
                className="h-8 w-24 animate-pulse rounded-lg"
                style={{
                  backgroundColor: "var(--erp-border)",
                }}
              />
            ) : (
              <h3
                className="break-words text-3xl font-extrabold tracking-tight sm:text-4xl"
                style={{ color: "var(--erp-text)" }}
              >
                {formatNumber(value)}
              </h3>
            )}
          </div>
        </div>

        <div
          className={`shrink-0 rounded-2xl p-3.5 transition-transform duration-300 group-hover:rotate-3 group-hover:scale-110 ${card.iconStyle}`}
        >
          <Icon size={23} strokeWidth={1.8} />
        </div>
      </div>

      <div
        className="mt-5 flex items-start gap-2 border-t pt-4"
        style={{ borderColor: "var(--erp-border)" }}
      >
        <span
          className="mt-0.5 shrink-0"
          style={{ color: "var(--erp-muted)" }}
        >
          <TrendingUp size={14} />
        </span>

        <p
          className="text-xs leading-5"
          style={{ color: "var(--erp-muted)" }}
        >
          {card.description}
        </p>
      </div>
    </article>
  );
}

export default function UserStatistics() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadStats = useCallback(async (signal) => {
    setLoading(true);
    setError("");

    try {
      const response = await fetch("/api/dashboard/user-stats", {
        cache: "no-store",
        credentials: "same-origin",
        signal,
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(
          data.message || "Unable to load statistics."
        );
      }

      setStats(data.stats ?? {});
    } catch (err) {
      if (err.name !== "AbortError") {
        setError(
          err.message || "Failed to load statistics."
        );
      }
    } finally {
      if (!signal?.aborted) {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();

    Promise.resolve().then(() => {
      if (!controller.signal.aborted) {
        loadStats(controller.signal);
      }
    });

    return () => {
      controller.abort();
    };
  }, [loadStats]);

  function handleRefresh() {
    loadStats();
  }

  const totalUsers = Number(stats?.totalUsers ?? 0);
  const activeUsers = Number(stats?.activeUsers ?? 0);
  const usersWhoHaveLoggedIn = Number(
    stats?.usersWhoHaveLoggedIn ?? 0
  );
  const totalLoginEvents = Number(
    stats?.totalLoginEvents ?? 0
  );

  const activePercentage =
    totalUsers > 0
      ? Math.min(
          100,
          Math.max(0, (activeUsers / totalUsers) * 100)
        )
      : 0;

  const loginCoverage =
    totalUsers > 0
      ? Math.min(
          100,
          Math.max(
            0,
            (usersWhoHaveLoggedIn / totalUsers) * 100
          )
        )
      : 0;

  return (
    <section className="space-y-6">
      {/* Header */}
      <div
        className="relative overflow-hidden rounded-2xl border p-5 shadow-sm sm:p-7"
        style={{
          backgroundColor: "var(--erp-surface)",
          borderColor: "var(--erp-border)",
        }}
      >
        <div
          className="pointer-events-none absolute -right-12 -top-16 h-52 w-52 rounded-full opacity-10 blur-2xl"
          style={{ backgroundColor: "var(--erp-primary)" }}
        />

        <div
          className="pointer-events-none absolute -bottom-20 right-1/3 h-40 w-40 rounded-full opacity-10 blur-2xl"
          style={{ backgroundColor: "var(--erp-green)" }}
        />

        <div className="relative flex flex-col justify-between gap-5 sm:flex-row sm:items-center">
          <div className="flex min-w-0 items-start gap-4">
            <div
              className="hidden rounded-2xl p-3.5 sm:block"
              style={{
                backgroundColor: "var(--erp-blue-light)",
                color: "var(--erp-primary)",
              }}
            >
              <Users size={27} strokeWidth={1.8} />
            </div>

            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h2
                  className="text-xl font-extrabold tracking-tight sm:text-2xl"
                  style={{ color: "var(--erp-text)" }}
                >
                  User Management Overview
                </h2>

                <span
                  className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold"
                  style={{
                    backgroundColor: "var(--erp-green-light)",
                    color: "var(--erp-green)",
                  }}
                >
                  <span className="h-1.5 w-1.5 rounded-full bg-current" />
                  {loading ? "Updating" : "Overview"}
                </span>
              </div>

              <p
                className="mt-2 max-w-2xl text-sm leading-6"
                style={{ color: "var(--erp-muted)" }}
              >
                Monitor user accounts, account activity, and
                successful login history across your accessible
                companies.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleRefresh}
            disabled={loading}
            className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md disabled:cursor-not-allowed disabled:opacity-60"
            style={{
              backgroundColor: "var(--erp-primary)",
            }}
          >
            <RefreshCw
              size={16}
              className={loading ? "animate-spin" : ""}
            />
            Refresh Statistics
          </button>
        </div>
      </div>

      {/* Error message */}
      {error && (
        <div
          role="alert"
          className="flex items-start gap-3 rounded-2xl border p-4"
          style={{
            backgroundColor: "var(--erp-surface)",
            borderColor: "#fca5a5",
            color: "#dc2626",
          }}
        >
          <div className="rounded-xl bg-red-100 p-2">
            <Activity size={18} />
          </div>

          <div className="min-w-0 flex-1">
            <p className="font-semibold">
              Unable to load user statistics
            </p>
            <p className="mt-1 text-sm">{error}</p>
          </div>

          <button
            type="button"
            onClick={handleRefresh}
            className="shrink-0 rounded-lg border border-red-200 px-3 py-1.5 text-sm font-semibold transition hover:bg-red-50"
          >
            Retry
          </button>
        </div>
      )}

      {/* Statistics cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map((card, index) => (
          <StatCard
            key={card.key}
            card={card}
            value={stats?.[card.key]}
            loading={loading}
            index={index}
          />
        ))}
      </div>

      {/* Account insights */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Active account ratio */}
        <article
          className="rounded-2xl border p-5 shadow-sm sm:p-6"
          style={{
            backgroundColor: "var(--erp-surface)",
            borderColor: "var(--erp-border)",
          }}
        >
          <div className="flex items-center justify-between gap-3">
            <div>
              <p
                className="text-sm font-semibold"
                style={{ color: "var(--erp-muted)" }}
              >
                Account Availability
              </p>

              <p
                className="mt-2 text-2xl font-extrabold"
                style={{ color: "var(--erp-text)" }}
              >
                {loading && !stats
                  ? "..."
                  : `${activePercentage.toFixed(1)}%`}
              </p>
            </div>

            <div
              className="rounded-xl p-3"
              style={{
                backgroundColor: "var(--erp-green-light)",
                color: "var(--erp-green)",
              }}
            >
              <ShieldCheck size={23} />
            </div>
          </div>

          <div
            className="mt-5 h-2.5 overflow-hidden rounded-full"
            style={{ backgroundColor: "var(--erp-border)" }}
          >
            <div
              className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-green-600 transition-all duration-700"
              style={{ width: `${activePercentage}%` }}
            />
          </div>

          <div className="mt-3 flex items-center justify-between gap-2 text-xs">
            <span style={{ color: "var(--erp-muted)" }}>
              Active accounts
            </span>
            <span
              className="font-semibold"
              style={{ color: "var(--erp-text)" }}
            >
              {formatNumber(activeUsers)} / {formatNumber(totalUsers)}
            </span>
          </div>
        </article>

        {/* Login coverage */}
        <article
          className="rounded-2xl border p-5 shadow-sm sm:p-6"
          style={{
            backgroundColor: "var(--erp-surface)",
            borderColor: "var(--erp-border)",
          }}
        >
          <div className="flex items-center justify-between gap-3">
            <div>
              <p
                className="text-sm font-semibold"
                style={{ color: "var(--erp-muted)" }}
              >
                Login Coverage
              </p>

              <p
                className="mt-2 text-2xl font-extrabold"
                style={{ color: "var(--erp-text)" }}
              >
                {loading && !stats
                  ? "..."
                  : `${loginCoverage.toFixed(1)}%`}
              </p>
            </div>

            <div
              className="rounded-xl p-3"
              style={{
                backgroundColor: "var(--erp-blue-light)",
                color: "var(--erp-primary)",
              }}
            >
              <LogIn size={23} />
            </div>
          </div>

          <div
            className="mt-5 h-2.5 overflow-hidden rounded-full"
            style={{ backgroundColor: "var(--erp-border)" }}
          >
            <div
              className="h-full rounded-full bg-gradient-to-r from-sky-500 to-blue-600 transition-all duration-700"
              style={{ width: `${loginCoverage}%` }}
            />
          </div>

          <div className="mt-3 flex items-center justify-between gap-2 text-xs">
            <span style={{ color: "var(--erp-muted)" }}>
              Users logged in before
            </span>
            <span
              className="font-semibold"
              style={{ color: "var(--erp-text)" }}
            >
              {formatNumber(usersWhoHaveLoggedIn)} /{" "}
              {formatNumber(totalUsers)}
            </span>
          </div>
        </article>

        {/* Login activity */}
        <article
          className="relative overflow-hidden rounded-2xl border p-5 shadow-sm sm:p-6"
          style={{
            backgroundColor: "var(--erp-surface)",
            borderColor: "var(--erp-border)",
          }}
        >
          <div
            className="pointer-events-none absolute -right-8 -top-8 h-28 w-28 rounded-full opacity-[0.07]"
            style={{ backgroundColor: "var(--erp-primary)" }}
          />

          <div className="relative flex items-start justify-between gap-3">
            <div>
              <p
                className="text-sm font-semibold"
                style={{ color: "var(--erp-muted)" }}
              >
                Login Activity
              </p>

              <p
                className="mt-2 break-words text-2xl font-extrabold"
                style={{ color: "var(--erp-text)" }}
              >
                {loading && !stats
                  ? "..."
                  : formatNumber(totalLoginEvents)}
              </p>

              <p
                className="mt-2 text-xs leading-5"
                style={{ color: "var(--erp-muted)" }}
              >
                Total successful login events recorded in your
                database.
              </p>
            </div>

            <div
              className="rounded-xl p-3"
              style={{
                backgroundColor: "var(--erp-blue-light)",
                color: "var(--erp-primary)",
              }}
            >
              <Sparkles size={23} />
            </div>
          </div>
        </article>
      </div>

      {/* Footer */}
      <div
        className="flex flex-wrap items-center justify-between gap-2 rounded-xl border px-4 py-3"
        style={{
          backgroundColor: "var(--erp-surface)",
          borderColor: "var(--erp-border)",
        }}
      >
        <div className="flex items-center gap-2">
          <span
            className="h-2 w-2 rounded-full"
            style={{
              backgroundColor: error
                ? "#ef4444"
                : "var(--erp-green)",
            }}
          />

          <p
            className="text-xs"
            style={{ color: "var(--erp-muted)" }}
          >
            {error
              ? "Statistics could not be refreshed."
              : loading
                ? "Loading the latest user statistics..."
                : "Statistics loaded from your ERP database."}
          </p>
        </div>

        <p
          className="text-xs font-medium"
          style={{ color: "var(--erp-muted)" }}
        >
          User Management
        </p>
      </div>
    </section>
  );
}
