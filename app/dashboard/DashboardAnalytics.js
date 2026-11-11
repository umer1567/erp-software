
"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
} from "recharts";
import {
  RefreshCw,
  TrendingUp,
  ShoppingCart,
  CreditCard,
  FileText,
  AlertCircle,
  ArrowUpRight,
  Receipt,
  Wallet,
} from "lucide-react";

const COLORS = ["#168b5a", "#2585d8", "#f59e0b", "#ef4444"];

const chartTooltipStyle = {
  backgroundColor: "var(--erp-surface)",
  border: "1px solid var(--erp-border)",
  borderRadius: "12px",
  color: "var(--erp-text)",
  boxShadow: "var(--erp-shadow)",
};

function money(value) {
  return new Intl.NumberFormat("en-PK", {
    style: "currency",
    currency: "PKR",
    maximumFractionDigits: 0,
  }).format(Number(value || 0));
}

function StatCard({
  title,
  value,
  subtitle,
  icon: Icon,
  accent = "blue",
}) {
  const accents = {
    blue: {
      icon: "bg-[var(--erp-blue-light)] text-[var(--erp-primary)]",
      bar: "from-sky-500 to-blue-600",
      glow: "bg-sky-500/5",
    },
    green: {
      icon: "bg-[var(--erp-green-light)] text-[var(--erp-green)]",
      bar: "from-emerald-500 to-green-700",
      glow: "bg-emerald-500/5",
    },
  };

  const style = accents[accent] || accents.blue;

  return (
    <article className="erp-stat-card group relative">
      <div
        className={`absolute inset-x-0 top-0 h-1 bg-gradient-to-r ${style.bar}`}
      />

      <div
        className={`pointer-events-none absolute -right-8 -top-8 h-28 w-28 rounded-full ${style.glow} blur-2xl`}
      />

      <div className="relative flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="erp-muted text-sm font-medium">{title}</p>

          <h3 className="mt-3 break-words text-xl font-extrabold tracking-tight [color:var(--erp-text)] sm:text-2xl">
            {value}
          </h3>

          <p className="erp-muted mt-2 text-xs leading-5">
            {subtitle}
          </p>
        </div>

        <div
          className={`shrink-0 rounded-2xl p-3 ${style.icon} transition-transform duration-300 group-hover:scale-110`}
        >
          <Icon size={23} strokeWidth={1.8} />
        </div>
      </div>

      <div className="relative mt-5 flex items-center gap-1 border-t pt-3 [border-color:var(--erp-border)]">
        <span className="erp-muted text-xs font-medium">
          Financial overview
        </span>
        <ArrowUpRight
          size={14}
          className="text-[var(--erp-primary)] transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5"
        />
      </div>
    </article>
  );
}

function ChartCard({ title, icon: Icon, children }) {
  return (
    <section className="erp-card min-w-0 overflow-hidden">
      <div className="flex items-center gap-3 border-b px-4 py-4 [border-color:var(--erp-border)] sm:px-6">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--erp-blue-light)] text-[var(--erp-primary)]">
          <Icon size={20} strokeWidth={1.8} />
        </div>

        <div className="min-w-0">
          <h2 className="text-base font-bold [color:var(--erp-text)] sm:text-lg">
            {title}
          </h2>
          <p className="erp-muted mt-0.5 text-xs">
            Business analytics
          </p>
        </div>
      </div>

      <div className="p-4 sm:p-6">{children}</div>
    </section>
  );
}

function EmptyChart({ children }) {
  return (
    <div className="flex min-h-64 flex-col items-center justify-center px-4 text-center">
      <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--erp-blue-light)] text-[var(--erp-primary)]">
        <Receipt size={26} strokeWidth={1.6} />
      </div>

      <p className="erp-muted max-w-xs text-sm leading-6">
        {children}
      </p>
    </div>
  );
}

export default function DashboardAnalytics() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    let isMounted = true;

    async function fetchDashboard() {
      try {
        const response = await fetch("/api/dashboard", {
          cache: "no-store",
          signal: controller.signal,
        });

        const result = await response.json();

        if (!response.ok) {
          throw new Error(
            result.error || "Could not load dashboard data."
          );
        }

        if (isMounted) {
          setData(result);
          setError("");
        }
      } catch (err) {
        if (err.name !== "AbortError" && isMounted) {
          setError(
            err.message || "Could not load dashboard data."
          );
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    fetchDashboard();

    return () => {
      isMounted = false;
      controller.abort();
    };
  }, [refreshKey]);

  const loadDashboard = useCallback(() => {
    setLoading(true);
    setError("");
    setRefreshKey((current) => current + 1);
  }, []);

  if (loading && !data) {
    return (
      <div className="erp-card flex items-center gap-4 p-8">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[var(--erp-blue-light)] text-[var(--erp-primary)]">
          <RefreshCw className="animate-spin" size={21} />
        </div>

        <div>
          <p className="font-semibold [color:var(--erp-text)]">
            Loading business analytics
          </p>
          <p className="erp-muted mt-1 text-sm">
            Fetching your latest ERP data...
          </p>
        </div>
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="rounded-2xl border border-red-200 bg-white p-6 shadow-sm">
        <div className="flex items-center gap-3 text-red-700">
          <AlertCircle size={22} />
          <h2 className="font-bold">
            Dashboard data could not be loaded
          </h2>
        </div>

        <p className="mt-3 break-words text-sm text-slate-600">
          {error}
        </p>

        <button
          type="button"
          onClick={loadDashboard}
          className="erp-button mt-5"
        >
          <RefreshCw size={16} />
          Try again
        </button>
      </div>
    );
  }

  if (!data) {
    return null;
  }

  const summary = data.summary || {};

  const invoiceStatus = (data.invoiceStatus || []).map((item) => ({
    name: item.payment_status || "Unknown",
    value: Number(item.count || 0),
  }));

  const monthly = data.monthly || [];

  const totalInvoices = Number(summary.total_invoices || 0);
  const totalPurchases = Number(summary.total_purchases || 0);

  const totalSalesAmount = Number(summary.total_sales || 0);
  const salesReceived = Number(summary.sales_received || 0);
  const totalPurchaseAmount = Number(
    summary.total_purchases_amount || 0
  );
  const purchasesPaid = Number(summary.purchases_paid || 0);

  const salesPercentage =
    totalSalesAmount > 0
      ? Math.min(100, Math.max(0, (salesReceived / totalSalesAmount) * 100))
      : 0;

  const purchasePercentage =
    totalPurchaseAmount > 0
      ? Math.min(
          100,
          Math.max(0, (purchasesPaid / totalPurchaseAmount) * 100)
        )
      : 0;

  const quickLinks = [
    {
      label: "Sales Invoices",
      description: "View and manage customer invoices",
      href: "/dashboard/sales-invoices",
      icon: Receipt,
      accent: "blue",
    },
    {
      label: "Sales Payments",
      description: "Review customer collections",
      href: "/dashboard/sales-payments",
      icon: CreditCard,
      accent: "green",
    },
    {
      label: "Purchase Payments",
      description: "Review supplier payments",
      href: "/dashboard/purchase-payments",
      icon: Wallet,
      accent: "green",
    },
    {
      label: "Financial Ledger",
      description: "Explore accounting transactions",
      href: "/dashboard/accounting/ledger",
      icon: FileText,
      accent: "blue",
    },
  ];

  const axisStyle = {
    fill: "var(--erp-muted)",
    fontSize: 12,
  };

  return (
    <div className="space-y-6 lg:space-y-8">
      {/* Analytics heading */}
      <section className="erp-card relative overflow-hidden p-5 sm:p-6">
        <div className="pointer-events-none absolute -right-12 -top-16 h-44 w-44 rounded-full bg-sky-400/10 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-16 right-1/3 h-36 w-36 rounded-full bg-emerald-400/10 blur-3xl" />

        <div className="relative flex flex-wrap items-center justify-between gap-4">
          <div className="flex min-w-0 items-start gap-3">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-sky-500 to-blue-700 text-white shadow-md shadow-blue-900/10">
              <TrendingUp size={24} />
            </div>

            <div className="min-w-0">
              <h1 className="text-xl font-extrabold tracking-tight [color:var(--erp-text)] sm:text-2xl">
                Business Dashboard
              </h1>

              <p className="erp-muted mt-1 text-sm leading-6">
                Overview of sales, purchases, invoices, and payments.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={loadDashboard}
            disabled={loading}
            className="erp-button erp-button-outline"
          >
            <RefreshCw
              size={16}
              className={loading ? "animate-spin" : ""}
            />
            {loading ? "Refreshing..." : "Refresh data"}
          </button>
        </div>
      </section>

      {/* Refresh warning */}
      {error && (
        <div
          role="alert"
          className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900"
        >
          <div className="flex min-w-0 items-start gap-2">
            <AlertCircle size={18} className="mt-0.5 shrink-0" />
            <span className="break-words">
              Could not refresh the dashboard: {error}
            </span>
          </div>

          <button
            type="button"
            onClick={loadDashboard}
            className="shrink-0 font-semibold underline"
          >
            Try again
          </button>
        </div>
      )}

      {/* Financial summary */}
      <section className="space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <h2 className="text-lg font-bold [color:var(--erp-text)]">
              Financial Summary
            </h2>
            <p className="erp-muted mt-1 text-sm">
              Your sales and purchasing position.
            </p>
          </div>

          <span className="inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold [border-color:var(--erp-border)] [color:var(--erp-muted)]">
            <span className="h-2 w-2 rounded-full bg-emerald-500" />
            Live dashboard data
          </span>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            title="Total Sales"
            value={money(summary.total_sales)}
            subtitle={`${totalInvoices} sales invoices`}
            icon={TrendingUp}
            accent="blue"
          />

          <StatCard
            title="Sales Received"
            value={money(summary.sales_received)}
            subtitle={`Outstanding: ${money(summary.sales_outstanding)}`}
            icon={CreditCard}
            accent="green"
          />

          <StatCard
            title="Total Purchases"
            value={money(summary.total_purchases_amount)}
            subtitle={`${totalPurchases} purchase records`}
            icon={ShoppingCart}
            accent="blue"
          />

          <StatCard
            title="Purchase Payments"
            value={money(summary.purchases_paid)}
            subtitle={`Outstanding: ${money(summary.purchases_outstanding)}`}
            icon={FileText}
            accent="green"
          />
        </div>
      </section>

      {/* Charts */}
      <section className="space-y-4">
        <div>
          <h2 className="text-lg font-bold [color:var(--erp-text)]">
            Business Analytics
          </h2>
          <p className="erp-muted mt-1 text-sm">
            Compare activity and track financial trends.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
          <ChartCard
            title="Monthly Sales vs Purchases"
            icon={ShoppingCart}
          >
            {monthly.length === 0 ? (
              <EmptyChart>
                No monthly sales or purchase data available yet.
              </EmptyChart>
            ) : (
              <div className="h-72 w-full sm:h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={monthly}
                    margin={{ top: 8, right: 8, left: -15, bottom: 0 }}
                    barGap={5}
                  >
                    <CartesianGrid
                      strokeDasharray="3 3"
                      vertical={false}
                      stroke="var(--erp-border)"
                    />

                    <XAxis
                      dataKey="month"
                      tick={axisStyle}
                      axisLine={{ stroke: "var(--erp-border)" }}
                      tickLine={false}
                    />

                    <YAxis
                      tickFormatter={(value) =>
                        `${Math.round(Number(value) / 1000)}k`
                      }
                      tick={axisStyle}
                      axisLine={false}
                      tickLine={false}
                    />

                    <Tooltip
                      formatter={(value) => money(value)}
                      contentStyle={chartTooltipStyle}
                      cursor={{ fill: "var(--erp-blue-light)", opacity: 0.5 }}
                    />

                    <Legend wrapperStyle={{ fontSize: 12, paddingTop: 12 }} />

                    <Bar
                      dataKey="sales"
                      name="Sales"
                      fill="#2585d8"
                      radius={[5, 5, 0, 0]}
                      maxBarSize={36}
                    />

                    <Bar
                      dataKey="purchases"
                      name="Purchases"
                      fill="#168b5a"
                      radius={[5, 5, 0, 0]}
                      maxBarSize={36}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </ChartCard>

          <ChartCard
            title="Sales Invoice Payment Status"
            icon={Receipt}
          >
            {invoiceStatus.length === 0 ? (
              <EmptyChart>
                No sales invoices available yet.
              </EmptyChart>
            ) : (
              <div className="h-72 w-full sm:h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={invoiceStatus}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="45%"
                      innerRadius={62}
                      outerRadius={96}
                      paddingAngle={4}
                      stroke="var(--erp-surface)"
                      strokeWidth={3}
                      label={({ name, value }) => `${name}: ${value}`}
                      labelLine={{ stroke: "var(--erp-muted)" }}
                    >
                      {invoiceStatus.map((entry, index) => (
                        <Cell
                          key={`${entry.name}-${index}`}
                          fill={COLORS[index % COLORS.length]}
                        />
                      ))}
                    </Pie>

                    <Tooltip contentStyle={chartTooltipStyle} />
                    <Legend
                      verticalAlign="bottom"
                      wrapperStyle={{ fontSize: 12 }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            )}
          </ChartCard>

          <ChartCard
            title="Monthly Sales Trend"
            icon={TrendingUp}
          >
            {monthly.length === 0 ? (
              <EmptyChart>
                No monthly sales data available yet.
              </EmptyChart>
            ) : (
              <div className="h-72 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart
                    data={monthly}
                    margin={{ top: 8, right: 10, left: -15, bottom: 0 }}
                  >
                    <CartesianGrid
                      strokeDasharray="3 3"
                      vertical={false}
                      stroke="var(--erp-border)"
                    />

                    <XAxis
                      dataKey="month"
                      tick={axisStyle}
                      axisLine={{ stroke: "var(--erp-border)" }}
                      tickLine={false}
                    />

                    <YAxis
                      tickFormatter={(value) =>
                        `${Math.round(Number(value) / 1000)}k`
                      }
                      tick={axisStyle}
                      axisLine={false}
                      tickLine={false}
                    />

                    <Tooltip
                      formatter={(value) => money(value)}
                      contentStyle={chartTooltipStyle}
                    />

                    <Line
                      type="monotone"
                      dataKey="sales"
                      name="Sales"
                      stroke="#2585d8"
                      strokeWidth={3}
                      activeDot={{ r: 6, fill: "#168b5a" }}
                      dot={{
                        r: 3,
                        fill: "#2585d8",
                        strokeWidth: 2,
                        stroke: "var(--erp-surface)",
                      }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </ChartCard>

          {/* Payment progress */}
          <ChartCard title="Payment Overview" icon={Wallet}>
            <div className="space-y-7 py-2">
              <div>
                <div className="mb-3 flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold [color:var(--erp-text)]">
                      Customer payments received
                    </p>
                    <p className="erp-muted mt-1 text-xs">
                      {salesPercentage.toFixed(1)}% of total sales
                    </p>
                  </div>

                  <strong className="text-right text-sm [color:var(--erp-text)]">
                    {money(summary.sales_payments)}
                  </strong>
                </div>

                <div className="h-3 overflow-hidden rounded-full bg-[var(--erp-blue-light)]">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-sky-500 to-blue-700 transition-all duration-700"
                    style={{ width: `${salesPercentage}%` }}
                  />
                </div>
              </div>

              <div>
                <div className="mb-3 flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold [color:var(--erp-text)]">
                      Supplier payments made
                    </p>
                    <p className="erp-muted mt-1 text-xs">
                      {purchasePercentage.toFixed(1)}% of total purchases
                    </p>
                  </div>

                  <strong className="text-right text-sm [color:var(--erp-text)]">
                    {money(summary.purchase_payments)}
                  </strong>
                </div>

                <div className="h-3 overflow-hidden rounded-full bg-[var(--erp-green-light)]">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-green-700 transition-all duration-700"
                    style={{ width: `${purchasePercentage}%` }}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="rounded-2xl border border-sky-100 bg-sky-50 p-4">
                  <div className="flex items-center gap-2 text-sky-700">
                    <CreditCard size={17} />
                    <p className="text-xs font-semibold">
                      Customer outstanding
                    </p>
                  </div>

                  <p className="mt-3 break-words text-lg font-extrabold text-sky-950">
                    {money(summary.sales_outstanding)}
                  </p>
                </div>

                <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-4">
                  <div className="flex items-center gap-2 text-emerald-700">
                    <Wallet size={17} />
                    <p className="text-xs font-semibold">
                      Supplier outstanding
                    </p>
                  </div>

                  <p className="mt-3 break-words text-lg font-extrabold text-emerald-950">
                    {money(summary.purchases_outstanding)}
                  </p>
                </div>
              </div>
            </div>
          </ChartCard>
        </div>
      </section>

      {/* Quick access */}
      <section className="erp-card overflow-hidden">
        <div className="flex items-center gap-3 border-b px-5 py-4 [border-color:var(--erp-border)] sm:px-6">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--erp-green-light)] text-[var(--erp-green)]">
            <ArrowUpRight size={21} />
          </div>

          <div>
            <h2 className="text-lg font-bold [color:var(--erp-text)]">
              Quick Access
            </h2>
            <p className="erp-muted mt-0.5 text-xs">
              Jump directly to important business areas.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 p-4 sm:grid-cols-2 sm:p-6 xl:grid-cols-4">
          {quickLinks.map((item) => {
            const Icon = item.icon;

            const iconStyle =
              item.accent === "green"
                ? "bg-[var(--erp-green-light)] text-[var(--erp-green)]"
                : "bg-[var(--erp-blue-light)] text-[var(--erp-primary)]";

            return (
              <Link
                key={item.href}
                href={item.href}
                className="group flex min-w-0 items-center gap-3 rounded-2xl border p-4 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md [border-color:var(--erp-border)] hover:[border-color:var(--erp-primary)]"
              >
                <div
                  className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${iconStyle}`}
                >
                  <Icon size={21} />
                </div>

                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold [color:var(--erp-text)]">
                    {item.label}
                  </p>

                  <p className="erp-muted mt-1 text-xs leading-5">
                    {item.description}
                  </p>
                </div>

                <ArrowUpRight
                  size={17}
                  className="shrink-0 text-[var(--erp-muted)] transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-[var(--erp-primary)]"
                />
              </Link>
            );
          })}
        </div>
      </section>
    </div>
  );
}
