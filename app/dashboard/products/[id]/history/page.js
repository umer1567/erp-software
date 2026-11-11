
"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";

export default function ProductHistoryPage() {
  const { id } = useParams();
  const router = useRouter();

  const [product, setProduct] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!id) return;

    const controller = new AbortController();

    async function loadHistory() {
      try {
        setLoading(true);
        setError("");

        const response = await fetch(
          `/api/products/${id}/history`,
          { signal: controller.signal }
        );

        const data = await response.json();

        if (!response.ok) {
          throw new Error(
            data.message || "Failed to load history."
          );
        }

        setProduct(data.product);
        setTransactions(data.transactions || []);
      } catch (err) {
        if (err.name !== "AbortError") {
          setError(err.message || "Failed to load history.");
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    }

    loadHistory();

    return () => controller.abort();
  }, [id]);

  function formatDate(value) {
    if (!value) return "-";

    const date = new Date(
      `${String(value).slice(0, 10)}T00:00:00`
    );

    return Number.isNaN(date.getTime())
      ? "-"
      : date.toLocaleDateString();
  }

  function formatNumber(value) {
    if (value === null || value === undefined || value === "") {
      return "-";
    }

    return Number(value).toLocaleString(undefined, {
      maximumFractionDigits: 3,
    });
  }

  function formatMoney(value) {
    if (value === null || value === undefined || value === "") {
      return "-";
    }

    return Number(value).toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  }

  const totalReceived = transactions.reduce(
    (sum, item) => sum + Number(item.receive_quantity || 0),
    0
  );

  const totalIssued = transactions.reduce(
    (sum, item) => sum + Number(item.issue_quantity || 0),
    0
  );

  if (loading) {
    return (
      <main className="p-6">
        <p className="text-slate-600">
          Loading product transaction history...
        </p>
      </main>
    );
  }

  if (error) {
    return (
      <main className="space-y-4 p-6">
        <button
          onClick={() => router.push("/dashboard/products")}
          className="rounded-lg border px-4 py-2 hover:bg-slate-50"
        >
          ← Back to Products
        </button>

        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-700">
          {error}
        </div>
      </main>
    );
  }

  return (
    <main className="space-y-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">
            Product Transaction History
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Inventory movements for the selected product.
          </p>
        </div>

        <button
          onClick={() => router.push("/dashboard/products")}
          className="rounded-lg border border-slate-300 bg-white px-4 py-2 hover:bg-slate-50"
        >
          ← Back to Products
        </button>
      </div>

      {product && (
        <section className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="rounded-xl border bg-white p-5">
            <p className="text-sm text-slate-500">SKU</p>
            <p className="mt-1 font-semibold">{product.sku}</p>
          </div>

          <div className="rounded-xl border bg-white p-5">
            <p className="text-sm text-slate-500">Product</p>
            <p className="mt-1 font-semibold">
              {product.product_name}
            </p>
          </div>

          <div className="rounded-xl border bg-white p-5">
            <p className="text-sm text-slate-500">Stock Unit</p>
            <p className="mt-1 font-semibold">
              {product.unit || "-"}
            </p>
          </div>
        </section>
      )}

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-5">
          <p className="text-sm text-emerald-700">Total Received</p>
          <p className="mt-1 text-2xl font-bold text-emerald-800">
            {formatNumber(totalReceived)}
          </p>
        </div>

        <div className="rounded-xl border border-rose-200 bg-rose-50 p-5">
          <p className="text-sm text-rose-700">Total Issued</p>
          <p className="mt-1 text-2xl font-bold text-rose-800">
            {formatNumber(totalIssued)}
          </p>
        </div>

        <div className="rounded-xl border bg-white p-5">
          <p className="text-sm text-slate-500">
            Recorded Transactions
          </p>
          <p className="mt-1 text-2xl font-bold">
            {transactions.length}
          </p>
        </div>
      </section>

      <section className="overflow-hidden rounded-xl border bg-white shadow-sm">
        <div className="border-b px-5 py-4">
          <h2 className="font-semibold">Transaction Records</h2>
          <p className="mt-1 text-sm text-slate-500">
            Newest records appear first.
          </p>
        </div>

        {transactions.length === 0 ? (
          <div className="p-8 text-center text-slate-500">
            No inventory transactions have been recorded for this product.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-slate-600">
                <tr>
                  <th className="whitespace-nowrap px-4 py-3">Date</th>
                  <th className="whitespace-nowrap px-4 py-3">Type</th>
                  <th className="whitespace-nowrap px-4 py-3">Reference</th>
                  <th className="whitespace-nowrap px-4 py-3">Location</th>
                  <th className="whitespace-nowrap px-4 py-3">Unit</th>
                  <th className="whitespace-nowrap px-4 py-3 text-right">Received</th>
                  <th className="whitespace-nowrap px-4 py-3 text-right">Issued</th>
                  <th className="whitespace-nowrap px-4 py-3 text-right">Balance</th>
                  <th className="whitespace-nowrap px-4 py-3 text-right">Receive Amount</th>
                  <th className="whitespace-nowrap px-4 py-3 text-right">Issue Amount</th>
                  <th className="min-w-48 px-4 py-3">Memo</th>
                </tr>
              </thead>

              <tbody>
                {transactions.map((item) => (
                  <tr
                    key={item.inventory_transaction_id}
                    className="border-t hover:bg-slate-50"
                  >
                    <td className="whitespace-nowrap px-4 py-3">
                      {formatDate(item.transaction_date)}
                    </td>

                    <td className="whitespace-nowrap px-4 py-3">
                      {item.transaction_type || "-"}
                    </td>

                    <td className="whitespace-nowrap px-4 py-3">
                      {item.transaction_number || "-"}
                    </td>

                    <td className="whitespace-nowrap px-4 py-3">
                      {item.location || "-"}
                    </td>

                    <td className="whitespace-nowrap px-4 py-3">
                      {item.uom || product?.unit || "-"}
                    </td>

                    <td className="whitespace-nowrap px-4 py-3 text-right text-emerald-700">
                      {formatNumber(item.receive_quantity)}
                    </td>

                    <td className="whitespace-nowrap px-4 py-3 text-right text-rose-700">
                      {formatNumber(item.issue_quantity)}
                    </td>

                    <td className="whitespace-nowrap px-4 py-3 text-right font-semibold">
                      {formatNumber(item.running_quantity)}
                    </td>

                    <td className="whitespace-nowrap px-4 py-3 text-right">
                      {formatMoney(item.receive_amount)}
                    </td>

                    <td className="whitespace-nowrap px-4 py-3 text-right">
                      {formatMoney(item.issue_amount)}
                    </td>

                    <td className="px-4 py-3">
                      {item.memo || "-"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}
