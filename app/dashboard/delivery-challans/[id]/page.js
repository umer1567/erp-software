
"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import DeliveryChallanForm from "@/components/delivery-challans/DeliveryChallanForm";

function formatDate(value) {
    if (!value) return "—";
    return String(value).slice(0, 10);
}

function formatMoney(value, currency = "PKR") {
    return `${currency || "PKR"} ${Number(value || 0).toLocaleString("en-PK", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    })}`;
}

function Field({ label, value }) {
    return (
        <div className="rounded-xl bg-slate-50 p-4 dark:bg-slate-950">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                {label}
            </p>
            <p className="mt-2 break-words text-sm font-semibold text-slate-800 dark:text-slate-100">
                {value || "—"}
            </p>
        </div>
    );
}

export default function DeliveryChallanDetailPage() {
    const params = useParams();
    const searchParams = useSearchParams();
    const id = params.id;
    const editing = searchParams.get("edit") === "1";
    const printRequested = searchParams.get("print") === "1";

    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    const load = useCallback(async () => {
        setLoading(true);
        setError("");

        try {
            const response = await fetch(`/api/delivery-challans/${id}`, {
                cache: "no-store",
            });
            const result = await response.json();

            if (!response.ok || !result.success) {
                throw new Error(result.message || "Could not load Delivery Challan.");
            }

            setData(result);
        } catch (err) {
            setError(err.message || "Could not load Delivery Challan.");
        } finally {
            setLoading(false);
        }
    }, [id]);

    useEffect(() => {
    if (!id) return;

    let cancelled = false;

    async function fetchChallan() {
        try {
            setLoading(true);
            setError("");

            const response = await fetch(`/api/delivery-challans/${id}`, {
                cache: "no-store",
            });

            const result = await response.json();

            if (!response.ok || !result.success) {
                throw new Error(
                    result.message || "Failed to load delivery challan."
                );
            }

            if (cancelled) return;

            setData(result);
        } catch (err) {
            if (!cancelled) {
                setError(err.message || "Failed to load delivery challan.");
            }
        } finally {
            if (!cancelled) {
                setLoading(false);
            }
        }
    }

    fetchChallan();

    return () => {
        cancelled = true;
    };
}, [id]);

    useEffect(() => {
        if (!loading && data && printRequested) {
            const handle = window.setTimeout(() => window.print(), 350);
            return () => window.clearTimeout(handle);
        }
    }, [loading, data, printRequested]);

    if (editing) {
        return (
            <main className="min-h-screen bg-slate-50 p-4 text-slate-800 dark:bg-slate-950 dark:text-slate-100 sm:p-6 lg:p-8">
                <div className="mx-auto max-w-[1500px]">
                    <DeliveryChallanForm challanId={id} />
                </div>
            </main>
        );
    }

    const challan = data?.challan;
    const items = data?.items || [];

    return (
        <main className="min-h-screen bg-slate-50 p-4 text-slate-800 dark:bg-slate-950 dark:text-slate-100 sm:p-6 lg:p-8 print:bg-white print:p-0 print:text-black">
            <div className="mx-auto max-w-[1500px] space-y-6 print:max-w-none print:space-y-3">
                {error && (
                    <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300 print:hidden">
                        {error}
                        <button onClick={load} className="ml-3 font-bold underline">
                            Retry
                        </button>
                    </div>
                )}

                {loading ? (
                    <div className="grid min-h-64 place-items-center text-slate-500 print:hidden">
                        Loading Delivery Challan…
                    </div>
                ) : challan ? (
                    <>
                        <header className="rounded-3xl bg-gradient-to-r from-blue-700 via-blue-600 to-emerald-600 p-6 text-white shadow-xl print:rounded-none print:bg-white print:p-0 print:text-black print:shadow-none">
                            <div className="flex flex-col justify-between gap-5 lg:flex-row lg:items-end">
                                <div>
                                    <Link
                                        href="/dashboard/delivery-challans"
                                        className="text-sm font-semibold text-blue-100 hover:text-white print:hidden"
                                    >
                                        ← Delivery Challans
                                    </Link>
                                    <p className="mt-4 text-sm font-semibold uppercase tracking-[0.2em] text-blue-100 print:mt-0 print:text-slate-500">
                                        {challan.company_name || challan.subsidiary_name || "Company"}
                                    </p>
                                    <h1 className="mt-2 text-3xl font-black sm:text-4xl print:text-2xl">
                                        Delivery Challan
                                    </h1>
                                    <p className="mt-2 text-blue-50 print:text-slate-600">
                                        Outbound shipment document
                                    </p>
                                </div>

                                <div className="rounded-2xl border border-white/20 bg-white/10 p-5 backdrop-blur print:rounded-none print:border print:border-slate-300 print:bg-white">
                                    <p className="text-xs font-semibold uppercase tracking-wider text-blue-100 print:text-slate-500">
                                        Transaction Number
                                    </p>
                                    <p className="mt-1 text-2xl font-black print:text-black">
                                        {challan.transaction_number}
                                    </p>
                                    <p className="mt-2 text-sm text-blue-50 print:text-slate-600">
                                        Date: {formatDate(challan.transaction_date)}
                                    </p>
                                </div>
                            </div>
                        </header>

                        <div className="flex flex-wrap gap-3 print:hidden">
                            {challan.status === "DRAFT" && data.permissions?.canUpdate && (
                                <Link
                                    href={`/dashboard/delivery-challans/${id}?edit=1`}
                                    className="rounded-xl bg-emerald-600 px-5 py-3 text-sm font-bold text-white hover:bg-emerald-700"
                                >
                                    Edit
                                </Link>
                            )}

                            <Link
                                href="/dashboard/delivery-challans"
                                className="rounded-xl border border-slate-200 bg-white px-5 py-3 text-sm font-bold dark:border-slate-700 dark:bg-slate-900"
                            >
                                Back
                            </Link>

                            <Link
                                href="/dashboard/delivery-challans/new"
                                className="rounded-xl bg-blue-600 px-5 py-3 text-sm font-bold text-white hover:bg-blue-700"
                            >
                                + Create Delivery Challan
                            </Link>

                            <button
                                onClick={() => window.print()}
                                className="rounded-xl bg-slate-800 px-5 py-3 text-sm font-bold text-white hover:bg-slate-900 dark:bg-slate-700"
                            >
                                Report / Print / Save PDF
                            </button>

                            <button
                                onClick={() => window.alert("Voucher integration has not been implemented yet. This challan has not posted accounting entries.")}
                                className="rounded-xl border border-violet-200 bg-violet-50 px-5 py-3 text-sm font-bold text-violet-700 dark:border-violet-900 dark:bg-violet-950/40 dark:text-violet-300"
                            >
                                Voucher
                            </button>
                        </div>

                        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900 print:rounded-none print:border-slate-300 print:p-3 print:shadow-none">
                            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                                <h2 className="text-lg font-bold print:text-base">
                                    Shipment Information
                                </h2>
                                <div className="flex flex-wrap gap-2">
                                    <span className={`rounded-full px-3 py-1.5 text-xs font-bold ${challan.status === "APPROVED" ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300 print:border print:border-emerald-700 print:bg-white" : "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300 print:border print:border-amber-700 print:bg-white"}`}>
                                        {challan.status}
                                    </span>
                                    <span className="rounded-full bg-blue-50 px-3 py-1.5 text-xs font-bold text-blue-700 dark:bg-blue-950/40 dark:text-blue-300 print:border print:border-blue-700 print:bg-white">
                                        {challan.document_status || "Pending Invoice"}
                                    </span>
                                </div>
                            </div>

                            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                                <Field label="Customer" value={challan.customer_name} />
                                <Field label="Customer Code" value={challan.customer_code} />
                                <Field label="Location / Warehouse" value={challan.warehouse_name} />
                                <Field label="Created From" value={challan.source_order_number || "Manual"} />
                                <Field label="Subsidiary" value={challan.subsidiary_name} />
                                <Field label="Department" value={challan.department} />
                                <Field label="Class" value={challan.challan_class} />
                                <Field label="Project" value={challan.project} />
                                <Field label="Driver Name" value={challan.driver_name} />
                                <Field label="Driver Mobile" value={challan.driver_mobile_no} />
                                <Field label="Vehicle Number" value={challan.vehicle_no} />
                                <Field label="Reference Number" value={challan.reference_no} />
                            </div>

                            {challan.memo && (
                                <div className="mt-4 rounded-xl border border-slate-200 p-4 dark:border-slate-700 print:border-slate-300">
                                    <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                                        Memo
                                    </p>
                                    <p className="mt-2 whitespace-pre-wrap text-sm">{challan.memo}</p>
                                </div>
                            )}
                        </section>

                        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900 print:rounded-none print:border-slate-300 print:shadow-none">
                            <div className="border-b border-slate-200 p-5 dark:border-slate-800 print:p-3">
                                <h2 className="text-lg font-bold print:text-base">Transaction Lines</h2>
                            </div>

                            <div className="overflow-x-auto">
                                <table className="w-full min-w-[850px] text-left text-sm">
                                    <thead className="bg-slate-50 text-xs uppercase tracking-wider text-slate-500 dark:bg-slate-950 dark:text-slate-400 print:bg-slate-100 print:text-black">
                                        <tr>
                                            <th className="px-4 py-3">#</th>
                                            <th className="px-4 py-3">Item Name</th>
                                            <th className="px-4 py-3">Description</th>
                                            <th className="px-4 py-3">UOM</th>
                                            <th className="px-4 py-3 text-right">Quantity</th>
                                            <th className="px-4 py-3 text-right">Unit Price</th>
                                            <th className="px-4 py-3 text-right">Amount</th>
                                            <th className="px-4 py-3 text-right">Tax</th>
                                            <th className="px-4 py-3 text-right">Gross Amount</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800 print:divide-slate-300">
                                        {items.map((item, index) => (
                                            <tr key={item.delivery_challan_item_id || index}>
                                                <td className="px-4 py-3">{index + 1}</td>
                                                <td className="px-4 py-3 font-semibold">{item.item_name}</td>
                                                <td className="px-4 py-3">{item.item_description || "—"}</td>
                                                <td className="px-4 py-3">{item.uom || "—"}</td>
                                                <td className="px-4 py-3 text-right">{Number(item.quantity || 0).toLocaleString("en-PK")}</td>
                                                <td className="px-4 py-3 text-right">{formatMoney(item.unit_price, challan.currency)}</td>
                                                <td className="px-4 py-3 text-right">{formatMoney(item.amount, challan.currency)}</td>
                                                <td className="px-4 py-3 text-right">{formatMoney(item.tax_amount, challan.currency)}</td>
                                                <td className="px-4 py-3 text-right font-bold">{formatMoney(item.gross_amount, challan.currency)}</td>
                                            </tr>
                                        ))}
                                        {items.length === 0 && (
                                            <tr>
                                                <td colSpan={9} className="p-8 text-center text-slate-500">
                                                    No transaction lines found.
                                                </td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </section>

                        <section className="ml-auto grid max-w-xl gap-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900 print:rounded-none print:border-slate-300 print:shadow-none">
                            <div className="flex justify-between gap-5 text-sm">
                                <span className="text-slate-500 dark:text-slate-400">Total Amount</span>
                                <span className="font-semibold">{formatMoney(challan.total_amount, challan.currency)}</span>
                            </div>
                            <div className="flex justify-between gap-5 text-sm">
                                <span className="text-slate-500 dark:text-slate-400">Tax Amount</span>
                                <span className="font-semibold">{formatMoney(challan.tax_amount, challan.currency)}</span>
                            </div>
                            <div className="flex justify-between gap-5 border-t border-slate-200 pt-3 dark:border-slate-700">
                                <span className="font-bold">Gross Amount</span>
                                <span className="text-xl font-black text-blue-700 dark:text-blue-400 print:text-black">
                                    {formatMoney(challan.gross_amount, challan.currency)}
                                </span>
                            </div>
                        </section>

                        <footer className="flex flex-wrap justify-between gap-4 text-xs text-slate-400 print:mt-6 print:text-slate-600">
                            <span>Delivery Challan: {challan.transaction_number}</span>
                            <span>Printed on {new Date().toLocaleString()}</span>
                        </footer>
                    </>
                ) : null}
            </div>

            <style jsx global>{`
                @media print {
                    @page {
                        size: A4 landscape;
                        margin: 12mm;
                    }

                    body {
                        background: white !important;
                        color: black !important;
                        -webkit-print-color-adjust: exact;
                        print-color-adjust: exact;
                    }

                    nav,
                    aside,
                    header a,
                    button {
                        display: none !important;
                    }

                    .print\\:hidden {
                        display: none !important;
                    }
                }
            `}</style>
        </main>
    );
}
