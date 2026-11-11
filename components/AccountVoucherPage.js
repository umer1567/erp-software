
"use client";

import { useCallback, useEffect, useState } from "react";
import {
  ArrowDownLeft,
  ArrowUpRight,
  CalendarDays,
  CheckCircle2,
  FileText,
  Loader2,
  Plus,
  RefreshCw,
  Search,
  Wallet,
} from "lucide-react";

function getToday() {
  const date = new Date();
  const localDate = new Date(
    date.getTime() - date.getTimezoneOffset() * 60000
  );

  return localDate.toISOString().slice(0, 10);
}

function formatAmount(value) {
  return Number(value || 0).toLocaleString("en-PK", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function formatDate(value) {
  if (!value) return "-";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return value;

  return date.toLocaleDateString("en-GB");
}

export default function AccountVoucherPage({ type }) {
  const isPayment = type === "PAYMENT";
  const title = isPayment ? "Make Payment" : "Make Receipt";
  const subtitle = isPayment
    ? "Record payments from your Cash or Bank accounts."
    : "Record money received into your Cash or Bank accounts.";

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [canCreate, setCanCreate] = useState(false);
  const [cashAccounts, setCashAccounts] = useState([]);
  const [counterpartAccounts, setCounterpartAccounts] = useState([]);
  const [vouchers, setVouchers] = useState([]);
  const [search, setSearch] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const [form, setForm] = useState({
    cashAccountId: "",
    counterpartAccountId: "",
    date: getToday(),
    amount: "",
    referenceNumber: "",
    description: "",
  });

  const loadData = useCallback(async () => {
    try {
      const result = await fetch(
        isPayment ? "/api/make-payment" : "/api/make-receipt",
        {
          method: "GET",
          cache: "no-store",
          credentials: "same-origin",
        }
      );

      const data = await result.json();

      if (!result.ok || !data.success) {
        throw new Error(data.message || "Unable to load vouchers.");
      }

      setCashAccounts(data.cashAccounts || []);
      setCounterpartAccounts(data.counterpartAccounts || []);
      setVouchers(data.vouchers || []);
      setCanCreate(data.permissions?.canCreate === true);
      setError("");
    } catch (err) {
      setError(err.message || "Unable to load page data.");
    } finally {
      setLoading(false);
    }
  }, [isPayment]);

  useEffect(() => {
  let cancelled = false;

  Promise.resolve().then(async () => {
    try {
      const endpoint = isPayment
        ? "/api/make-payment"
        : "/api/make-receipt";

      const result = await fetch(endpoint, {
        method: "GET",
        cache: "no-store",
        credentials: "same-origin",
      });

      const data = await result.json();

      if (!result.ok || !data.success) {
        throw new Error(data.message || "Unable to load vouchers.");
      }

      if (!cancelled) {
        setCashAccounts(data.cashAccounts || []);
        setCounterpartAccounts(data.counterpartAccounts || []);
        setVouchers(data.vouchers || []);
        setCanCreate(data.permissions?.canCreate === true);
        setError("");
      }
    } catch (err) {
      if (!cancelled) {
        setError(err.message || "Unable to load page data.");
      }
    } finally {
      if (!cancelled) {
        setLoading(false);
      }
    }
  });

  return () => {
    cancelled = true;
  };
}, [isPayment]);

  function updateField(event) {
    const { name, value } = event.target;

    setForm((previous) => ({
      ...previous,
      [name]: value,
    }));
  }

  async function handleSubmit(event) {
    event.preventDefault();

    setError("");
    setMessage("");

    if (!canCreate) {
      setError("You do not have permission to create this voucher.");
      return;
    }

    if (!form.cashAccountId || !form.counterpartAccountId) {
      setError("Please select both accounts.");
      return;
    }

    if (Number(form.amount) <= 0 || !Number.isFinite(Number(form.amount))) {
      setError("Please enter a valid amount greater than zero.");
      return;
    }

    if (!form.description.trim()) {
      setError("Description is required.");
      return;
    }

    setSaving(true);

    try {
      const result = await fetch(
        isPayment ? "/api/make-payment" : "/api/make-receipt",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          credentials: "same-origin",
          body: JSON.stringify(form),
        }
      );

      const data = await result.json();

      if (!result.ok || !data.success) {
        throw new Error(data.message || `Unable to create ${title}.`);
      }

      setMessage(
        `${title} voucher ${data.voucher?.journal_number || ""} created successfully.`
      );

      setForm({
        cashAccountId: "",
        counterpartAccountId: "",
        date: getToday(),
        amount: "",
        referenceNumber: "",
        description: "",
      });

      await loadData();
    } catch (err) {
      setError(err.message || `Unable to create ${title}.`);
    } finally {
      setSaving(false);
    }
  }

  const filteredVouchers = vouchers.filter((voucher) => {
    const query = search.toLowerCase();

    return (
      String(voucher.journal_number || "").toLowerCase().includes(query) ||
      String(voucher.description || "").toLowerCase().includes(query) ||
      String(voucher.debit_account || "").toLowerCase().includes(query) ||
      String(voucher.credit_account || "").toLowerCase().includes(query)
    );
  });

  const selectedCashAccount = cashAccounts.find(
    (account) =>
      String(account.account_id) === String(form.cashAccountId)
  );

  const selectedCounterpartAccount = counterpartAccounts.find(
    (account) =>
      String(account.account_id) === String(form.counterpartAccountId)
  );

  return (
    <div className="min-h-screen space-y-6 bg-slate-50 p-4 sm:p-6 lg:p-8">
      {/* HEADER */}
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <div className="flex items-center gap-3">
            <div
              className={`rounded-xl p-3 ${isPayment
                  ? "bg-rose-100 text-rose-700"
                  : "bg-emerald-100 text-emerald-700"
                }`}
            >
              {isPayment ? (
                <ArrowUpRight size={25} />
              ) : (
                <ArrowDownLeft size={25} />
              )}
            </div>

            <div>
              <h1 className="text-2xl font-bold tracking-tight text-slate-900">
                {title}
              </h1>
              <p className="mt-1 text-sm text-slate-500">
                {subtitle}
              </p>
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={() => {
            setLoading(true);
            setError("");
            loadData();
          }}
          disabled={loading}
          className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-100 disabled:opacity-50"
        >
          <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
          Refresh
        </button>
      </div>

      {/* ALERTS */}
      {error && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </div>
      )}

      {message && (
        <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          <CheckCircle2 size={18} />
          {message}
        </div>
      )}

      {/* CREATE FORM */}
      {canCreate && (
        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center gap-3 border-b border-slate-100 px-5 py-4">
            <div className="rounded-lg bg-blue-50 p-2 text-blue-700">
              <Plus size={19} />
            </div>

            <div>
              <h2 className="font-semibold text-slate-900">
                New {isPayment ? "Payment" : "Receipt"} Voucher
              </h2>
              <p className="text-xs text-slate-500">
                Complete the details below to post your voucher.
              </p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5 p-5">
            <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">
                  {isPayment ? "Payment From (Cash / Bank)" : "Deposit To (Cash / Bank)"}
                  <span className="text-rose-500"> *</span>
                </label>

                <select
                  name="cashAccountId"
                  value={form.cashAccountId}
                  onChange={updateField}
                  required
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                >
                  <option value="">Select Cash / Bank Account</option>
                  {cashAccounts.map((account) => (
                    <option
                      key={account.account_id}
                      value={account.account_id}
                    >
                      {account.account_code} - {account.account_name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">
                  {isPayment ? "Paid To / Expense Account" : "Received From / Income Account"}
                  <span className="text-rose-500"> *</span>
                </label>

                <select
                  name="counterpartAccountId"
                  value={form.counterpartAccountId}
                  onChange={updateField}
                  required
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                >
                  <option value="">Select Posting Account</option>
                  {counterpartAccounts.map((account) => (
                    <option
                      key={account.account_id}
                      value={account.account_id}
                    >
                      {account.account_code} - {account.account_name} ({account.account_type})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">
                  Voucher Date <span className="text-rose-500">*</span>
                </label>

                <div className="relative">
                  <CalendarDays
                    size={17}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                  />
                  <input
                    type="date"
                    name="date"
                    value={form.date}
                    onChange={updateField}
                    required
                    className="w-full rounded-lg border border-slate-300 bg-white py-2.5 pl-10 pr-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                  />
                </div>
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">
                  Amount <span className="text-rose-500">*</span>
                </label>

                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-semibold text-slate-500">
                    PKR
                  </span>
                  <input
                    type="number"
                    name="amount"
                    value={form.amount}
                    onChange={updateField}
                    min="0.01"
                    step="0.01"
                    required
                    placeholder="0.00"
                    className="w-full rounded-lg border border-slate-300 bg-white py-2.5 pl-14 pr-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                  />
                </div>
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">
                  Reference Number
                </label>
                <input
                  type="text"
                  name="referenceNumber"
                  value={form.referenceNumber}
                  onChange={updateField}
                  maxLength={100}
                  placeholder="Cheque / transaction / reference number"
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">
                  Description <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  name="description"
                  value={form.description}
                  onChange={updateField}
                  maxLength={1000}
                  required
                  placeholder={`Enter ${title.toLowerCase()} description`}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                />
              </div>
            </div>

            {/* ACCOUNTING PREVIEW */}
            {form.cashAccountId && form.counterpartAccountId && (
              <div className="rounded-xl border border-blue-100 bg-blue-50/70 p-4">
                <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-blue-900">
                  <FileText size={17} />
                  Accounting Preview
                </div>

                <div className="grid gap-3 text-sm md:grid-cols-2">
                  <div className="rounded-lg bg-white p-3">
                    <p className="text-xs text-slate-500">Debit</p>
                    <p className="mt-1 font-semibold text-slate-800">
                      {isPayment
                        ? selectedCounterpartAccount?.account_name
                        : selectedCashAccount?.account_name}
                    </p>
                    <p className="mt-1 font-bold text-emerald-700">
                      PKR {formatAmount(form.amount)}
                    </p>
                  </div>

                  <div className="rounded-lg bg-white p-3">
                    <p className="text-xs text-slate-500">Credit</p>
                    <p className="mt-1 font-semibold text-slate-800">
                      {isPayment
                        ? selectedCashAccount?.account_name
                        : selectedCounterpartAccount?.account_name}
                    </p>
                    <p className="mt-1 font-bold text-blue-700">
                      PKR {formatAmount(form.amount)}
                    </p>
                  </div>
                </div>
              </div>
            )}

            <div className="flex justify-end border-t border-slate-100 pt-4">
              <button
                type="submit"
                disabled={saving || loading}
                className={`inline-flex items-center justify-center gap-2 rounded-lg px-6 py-2.5 text-sm font-semibold text-white shadow-sm transition disabled:cursor-not-allowed disabled:opacity-50 ${isPayment
                    ? "bg-rose-600 hover:bg-rose-700"
                    : "bg-emerald-600 hover:bg-emerald-700"
                  }`}
              >
                {saving ? (
                  <>
                    <Loader2 size={17} className="animate-spin" />
                    Processing...
                  </>
                ) : (
                  <>
                    <CheckCircle2 size={17} />
                    Create {isPayment ? "Payment" : "Receipt"}
                  </>
                )}
              </button>
            </div>
          </form>
        </section>
      )}

      {!canCreate && !loading && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          You have view access only. Contact your administrator to enable Create permission.
        </div>
      )}

      {/* HISTORY */}
      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-col justify-between gap-3 border-b border-slate-100 px-5 py-4 sm:flex-row sm:items-center">
          <div>
            <h2 className="font-semibold text-slate-900">
              {isPayment ? "Payment" : "Receipt"} History
            </h2>
            <p className="mt-1 text-xs text-slate-500">
              Recently posted vouchers
            </p>
          </div>

          <div className="relative w-full sm:w-72">
            <Search
              size={17}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
            />
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search vouchers..."
              className="w-full rounded-lg border border-slate-300 py-2 pl-9 pr-3 text-sm outline-none focus:border-blue-500"
            />
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center gap-2 py-16 text-sm text-slate-500">
            <Loader2 size={19} className="animate-spin" />
            Loading vouchers...
          </div>
        ) : filteredVouchers.length === 0 ? (
          <div className="flex flex-col items-center justify-center px-5 py-16 text-center">
            <div className="rounded-full bg-slate-100 p-4 text-slate-400">
              <Wallet size={28} />
            </div>
            <p className="mt-3 font-semibold text-slate-700">
              No vouchers found
            </p>
            <p className="mt-1 text-sm text-slate-500">
              Your {title.toLowerCase()} history will appear here.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[850px] text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-5 py-3 font-semibold">Voucher No.</th>
                  <th className="px-5 py-3 font-semibold">Date</th>
                  <th className="px-5 py-3 font-semibold">Debit Account</th>
                  <th className="px-5 py-3 font-semibold">Credit Account</th>
                  <th className="px-5 py-3 text-right font-semibold">Amount (PKR)</th>
                  <th className="px-5 py-3 font-semibold">Status</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-100">
                {filteredVouchers.map((voucher) => (
                  <tr
                    key={voucher.journal_id}
                    className="transition hover:bg-slate-50"
                  >
                    <td className="whitespace-nowrap px-5 py-4 font-semibold text-blue-700">
                      {voucher.journal_number}
                    </td>
                    <td className="whitespace-nowrap px-5 py-4 text-slate-600">
                      {formatDate(voucher.journal_date)}
                    </td>
                    <td className="px-5 py-4 text-slate-700">
                      {voucher.debit_account || "-"}
                    </td>
                    <td className="px-5 py-4 text-slate-700">
                      {voucher.credit_account || "-"}
                    </td>
                    <td className="whitespace-nowrap px-5 py-4 text-right font-semibold text-slate-900">
                      {formatAmount(voucher.amount)}
                    </td>
                    <td className="px-5 py-4">
                      <span className="inline-flex rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-700">
                        {voucher.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="border-t border-slate-100 px-5 py-3 text-xs text-slate-500">
          Showing {filteredVouchers.length} of {vouchers.length} vouchers
        </div>
      </section>
    </div>
  );
}
