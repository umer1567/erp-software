
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

function today() {
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
}

const emptyItem = () => ({
    product_id: "",
    item_name: "",
    item_description: "",
    item_balance: 0,
    uom: "PCS",
    quantity: 1,
    unit_price: 0,
    tax_code: "",
    tax_rate: 0,
    memo: "",
});

const inputClass =
    "mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3.5 py-3 text-sm text-slate-800 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100";

const labelClass =
    "block text-sm font-semibold text-slate-600 dark:text-slate-300";

export default function DeliveryChallanForm({ challanId = null }) {
    const router = useRouter();
    const editing = Boolean(challanId);

    const [lookups, setLookups] = useState({
        customers: [],
        warehouses: [],
        company: null,
    });

    const [form, setForm] = useState({
        transaction_date: today(),
        customer_id: "",
        warehouse_id: "",
        status: "APPROVED",
        subsidiary_name: "",
        department: "",
        challan_class: "Outbound Shipment",
        driver_name: "",
        driver_mobile_no: "",
        vehicle_no: "",
        project: "",
        reference_no: "",
        memo: "",
        currency: "PKR",
        exchange_rate: "1",
    });

    const [lines, setLines] = useState([emptyItem()]);
    const [transactionNumber, setTransactionNumber] = useState("TO BE GENERATED");
    const [activeTab, setActiveTab] = useState("Transaction Lines");
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState("");

    useEffect(() => {
        let cancelled = false;

        async function load() {
            setLoading(true);
            setError("");

            try {
                const lookupResponse = await fetch("/api/delivery-challans", {
                    cache: "no-store",
                });
                const lookupData = await lookupResponse.json();

                if (!lookupResponse.ok || !lookupData.success) {
                    throw new Error(lookupData.message || "Could not load form data.");
                }

                if (cancelled) return;

                setLookups({
                    customers: lookupData.customers || [],
                    warehouses: lookupData.warehouses || [],
                    company: lookupData.company || null,
                });

                setForm((previous) => ({
                    ...previous,
                    subsidiary_name:
                        previous.subsidiary_name ||
                        lookupData.company?.company_name ||
                        "",
                    currency:
                        previous.currency === "PKR" && lookupData.company?.currency
                            ? lookupData.company.currency
                            : previous.currency,
                }));

                if (editing) {
                    const response = await fetch(
                        `/api/delivery-challans/${challanId}`,
                        { cache: "no-store" }
                    );
                    const result = await response.json();

                    if (!response.ok || !result.success) {
                        throw new Error(result.message || "Could not load challan.");
                    }

                    if (result.challan.status !== "DRAFT") {
                        throw new Error("Only draft challans can be edited.");
                    }

                    if (result.challan.source_order_id) {
                        throw new Error(
                            "Sales Order-based challans cannot be edited through the manual form."
                        );
                    }

                    if (cancelled) return;

                    const c = result.challan;

                    setTransactionNumber(c.transaction_number || "TO BE GENERATED");
                    setForm({
                        transaction_date: String(c.transaction_date || today()).slice(0, 10),
                        customer_id: c.customer_id ? String(c.customer_id) : "",
                        warehouse_id: c.warehouse_id ? String(c.warehouse_id) : "",
                        status: c.status || "DRAFT",
                        subsidiary_name: c.subsidiary_name || "",
                        department: c.department || "",
                        challan_class: c.challan_class || "Outbound Shipment",
                        driver_name: c.driver_name || "",
                        driver_mobile_no: c.driver_mobile_no || "",
                        vehicle_no: c.vehicle_no || "",
                        project: c.project || "",
                        reference_no: c.reference_no || "",
                        memo: c.memo || "",
                        currency: c.currency || "PKR",
                        exchange_rate: String(c.exchange_rate || 1),
                    });

                    setLines(
                        (result.items || []).map((item) => ({
                            product_id: item.product_id ? String(item.product_id) : "",
                            item_name: item.item_name || "",
                            item_description: item.item_description || "",
                            item_balance: Number(item.item_balance || 0),
                            uom: item.uom || "",
                            quantity: Number(item.quantity || 1),
                            unit_price: Number(item.unit_price || 0),
                            tax_code: item.tax_code || "",
                            tax_rate: Number(item.tax_rate || 0),
                            memo: item.memo || "",
                        }))
                    );
                }
            } catch (err) {
                if (!cancelled) {
                    setError(err.message || "Could not load the form.");
                }
            } finally {
                if (!cancelled) setLoading(false);
            }
        }

        load();

        return () => {
            cancelled = true;
        };
    }, [challanId, editing]);

    function change(name, value) {
        setForm((previous) => ({ ...previous, [name]: value }));
    }

    function changeLine(index, name, value) {
        setLines((previous) =>
            previous.map((line, lineIndex) =>
                lineIndex === index
                    ? { ...line, [name]: value }
                    : line
            )
        );
    }

    function chooseProduct(index, productId) {
        const product = (lookups.products || []).find(
            (item) => String(item.product_id) === String(productId)
        );

        setLines((previous) =>
            previous.map((line, lineIndex) =>
                lineIndex === index
                    ? {
                          ...line,
                          product_id: productId,
                          item_name: product?.product_name || line.item_name,
                          item_description: product?.description || line.item_description,
                          uom: product?.sales_unit || product?.unit || line.uom,
                          unit_price: Number(product?.sale_price || line.unit_price || 0),
                      }
                    : line
            )
        );
    }

    const calculatedLines = lines.map((line) => {
        const quantity = Number(line.quantity || 0);
        const unitPrice = Number(line.unit_price || 0);
        const taxRate = Number(line.tax_rate || 0);
        const amount = Math.round(quantity * unitPrice * 100) / 100;
        const taxAmount = Math.round((amount * taxRate) / 100 * 100) / 100;

        return {
            ...line,
            amount,
            tax_amount: taxAmount,
            gross_amount: Math.round((amount + taxAmount) * 100) / 100,
        };
    });

    const totalAmount = calculatedLines.reduce((sum, line) => sum + line.amount, 0);
    const taxAmount = calculatedLines.reduce((sum, line) => sum + line.tax_amount, 0);
    const grossAmount = totalAmount + taxAmount;

    async function save(event) {
        event.preventDefault();
        setSaving(true);
        setError("");

        try {
            const payload = {
                ...form,
                customer_id: form.customer_id,
                warehouse_id: form.warehouse_id,
                exchange_rate: Number(form.exchange_rate || 1),
                items: calculatedLines.map((line) => ({
                    product_id: line.product_id || null,
                    item_name: line.item_name,
                    item_description: line.item_description,
                    item_balance: Number(line.item_balance || 0),
                    uom: line.uom,
                    quantity: Number(line.quantity),
                    unit_price: Number(line.unit_price),
                    tax_code: line.tax_code,
                    tax_rate: Number(line.tax_rate || 0),
                    memo: line.memo,
                })),
            };

            const response = await fetch(
                editing
                    ? `/api/delivery-challans/${challanId}`
                    : "/api/delivery-challans",
                {
                    method: editing ? "PUT" : "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(payload),
                }
            );

            const result = await response.json();

            if (!response.ok || !result.success) {
                throw new Error(result.message || "Could not save Delivery Challan.");
            }

            const savedId =
                result.challan?.delivery_challan_id || challanId;

            router.push(`/dashboard/delivery-challans/${savedId}`);
            router.refresh();
        } catch (err) {
            setError(err.message || "Could not save Delivery Challan.");
        } finally {
            setSaving(false);
        }
    }

    if (loading) {
        return (
            <div className="grid min-h-64 place-items-center text-slate-500">
                Loading Delivery Challan form…
            </div>
        );
    }

    const tabs = [
        "Transaction Lines",
        "Accounting Lines",
        "Related Transactions",
        "System Information",
        "Attachments",
    ];

    return (
        <form onSubmit={save} className="space-y-6">
            <header className="rounded-3xl bg-gradient-to-r from-blue-700 via-blue-600 to-emerald-600 p-6 text-white shadow-xl sm:p-8">
                <Link
                    href="/dashboard/delivery-challans"
                    className="text-sm font-semibold text-blue-100 hover:text-white"
                >
                    ← Delivery Challans
                </Link>

                <div className="mt-4 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
                    <div>
                        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-blue-100">
                            Sales · Outbound Shipment
                        </p>
                        <h1 className="mt-2 text-3xl font-black sm:text-4xl">
                            {editing ? "Edit Delivery Challan" : "Create Delivery Challan"}
                        </h1>
                    </div>
                    <div className="rounded-2xl border border-white/20 bg-white/10 px-5 py-3 backdrop-blur">
                        <p className="text-xs font-semibold uppercase tracking-wider text-blue-100">
                            Transaction Number
                        </p>
                        <p className="mt-1 text-xl font-black">{transactionNumber}</p>
                    </div>
                </div>
            </header>

            {error && (
                <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
                    {error}
                </div>
            )}

            <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-6">
                <div className="mb-5 flex items-center justify-between gap-3">
                    <div>
                        <h2 className="text-lg font-bold">Transaction Information</h2>
                        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                            Enter customer, location, and shipment details.
                        </p>
                    </div>
                    <span className="rounded-full bg-blue-50 px-3 py-1.5 text-xs font-bold text-blue-700 dark:bg-blue-950/50 dark:text-blue-300">
                        {form.status}
                    </span>
                </div>

                <div className="grid gap-x-5 gap-y-4 md:grid-cols-2 xl:grid-cols-3">
                    <label className={labelClass}>
                        Transaction Date *
                        <input
                            required
                            type="date"
                            className={inputClass}
                            value={form.transaction_date}
                            onChange={(event) => change("transaction_date", event.target.value)}
                        />
                    </label>

                    <label className={labelClass}>
                        Customer *
                        <select
                            required
                            className={inputClass}
                            value={form.customer_id}
                            onChange={(event) => change("customer_id", event.target.value)}
                        >
                            <option value="">Select customer</option>
                            {lookups.customers.map((customer) => (
                                <option key={customer.customer_id} value={customer.customer_id}>
                                    {customer.customer_name}
                                    {customer.customer_code ? ` (${customer.customer_code})` : ""}
                                </option>
                            ))}
                        </select>
                    </label>

                    <label className={labelClass}>
                        Subsidiary / Company
                        <input
                            className={inputClass}
                            value={form.subsidiary_name}
                            onChange={(event) => change("subsidiary_name", event.target.value)}
                            placeholder="Company name"
                        />
                    </label>

                    <label className={labelClass}>
                        Location *
                        <select
                            required
                            className={inputClass}
                            value={form.warehouse_id}
                            onChange={(event) => change("warehouse_id", event.target.value)}
                        >
                            <option value="">Select location</option>
                            {lookups.warehouses.map((warehouse) => (
                                <option key={warehouse.warehouse_id} value={warehouse.warehouse_id}>
                                    {warehouse.warehouse_name}
                                </option>
                            ))}
                        </select>
                    </label>

                    <label className={labelClass}>
                        Status
                        <select
                            className={inputClass}
                            value={form.status}
                            onChange={(event) => change("status", event.target.value)}
                        >
                            <option value="DRAFT">DRAFT</option>
                            <option value="APPROVED">APPROVED</option>
                        </select>
                        {editing && (
                            <span className="mt-1 block text-xs font-normal text-amber-600">
                                Editing requires DRAFT status.
                            </span>
                        )}
                    </label>

                    <label className={labelClass}>
                        Class
                        <select
                            className={inputClass}
                            value={form.challan_class}
                            onChange={(event) => change("challan_class", event.target.value)}
                        >
                            <option>Outbound Shipment</option>
                            <option>Customer Delivery</option>
                            <option>Other</option>
                        </select>
                    </label>

                    <label className={labelClass}>
                        Department
                        <input className={inputClass} value={form.department} onChange={(event) => change("department", event.target.value)} placeholder="Department" />
                    </label>

                    <label className={labelClass}>
                        Project
                        <input className={inputClass} value={form.project} onChange={(event) => change("project", event.target.value)} placeholder="Project name" />
                    </label>

                    <label className={labelClass}>
                        Reference Number
                        <input className={inputClass} value={form.reference_no} onChange={(event) => change("reference_no", event.target.value)} placeholder="Reference number" />
                    </label>

                    <label className={labelClass}>
                        Driver Name
                        <input className={inputClass} value={form.driver_name} onChange={(event) => change("driver_name", event.target.value)} placeholder="Driver full name" />
                    </label>

                    <label className={labelClass}>
                        Driver Mobile
                        <input className={inputClass} value={form.driver_mobile_no} onChange={(event) => change("driver_mobile_no", event.target.value)} placeholder="03xx-xxxxxxx" />
                    </label>

                    <label className={labelClass}>
                        Vehicle Number
                        <input className={inputClass} value={form.vehicle_no} onChange={(event) => change("vehicle_no", event.target.value)} placeholder="Vehicle registration" />
                    </label>

                    <label className={labelClass}>
                        Currency
                        <input className={inputClass} value={form.currency} onChange={(event) => change("currency", event.target.value.toUpperCase())} maxLength={10} />
                    </label>

                    <label className={labelClass}>
                        Exchange Rate
                        <input className={inputClass} type="number" min="0.000001" step="0.000001" required value={form.exchange_rate} onChange={(event) => change("exchange_rate", event.target.value)} />
                    </label>

                    <label className={`${labelClass} md:col-span-2 xl:col-span-3`}>
                        Memo
                        <textarea
                            rows={3}
                            className={inputClass}
                            value={form.memo}
                            onChange={(event) => change("memo", event.target.value)}
                            placeholder="Additional delivery instructions..."
                        />
                    </label>
                </div>
            </section>

            <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
                <div className="flex flex-wrap gap-2 border-b border-slate-200 p-3 dark:border-slate-800">
                    {tabs.map((tab) => (
                        <button
                            key={tab}
                            type="button"
                            onClick={() => setActiveTab(tab)}
                            className={`rounded-xl px-4 py-2.5 text-sm font-semibold transition ${activeTab === tab ? "bg-blue-600 text-white shadow" : "text-slate-500 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"}`}
                        >
                            {tab}
                        </button>
                    ))}
                </div>

                {activeTab === "Transaction Lines" ? (
                    <>
                        <div className="flex flex-col gap-3 border-b border-slate-200 p-5 dark:border-slate-800 sm:flex-row sm:items-center sm:justify-between">
                            <div>
                                <h2 className="text-lg font-bold">Transaction Lines</h2>
                                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                                    Add items, quantities, prices, and tax rates.
                                </p>
                            </div>
                            <button
                                type="button"
                                onClick={() => setLines((previous) => [...previous, emptyItem()])}
                                className="rounded-xl bg-blue-600 px-4 py-3 text-sm font-bold text-white hover:bg-blue-700"
                            >
                                + Add Line
                            </button>
                        </div>

                        <div className="space-y-4 p-4 sm:p-5">
                            {calculatedLines.map((line, index) => (
                                <div
                                    key={index}
                                    className="rounded-2xl border border-slate-200 p-4 dark:border-slate-700"
                                >
                                    <div className="mb-4 flex items-center justify-between">
                                        <h3 className="font-bold">Line {index + 1}</h3>
                                        <button
                                            type="button"
                                            disabled={lines.length === 1}
                                            onClick={() => setLines((previous) => previous.filter((_, i) => i !== index))}
                                            className="rounded-lg px-3 py-2 text-sm font-bold text-red-600 hover:bg-red-50 disabled:opacity-30 dark:hover:bg-red-950/40"
                                        >
                                            Remove
                                        </button>
                                    </div>

                                    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                                        <label className={labelClass}>
                                            Item Name *
                                            <input required className={inputClass} value={line.item_name} onChange={(event) => changeLine(index, "item_name", event.target.value)} placeholder="Item name" />
                                        </label>

                                        <label className={labelClass}>
                                            Item Description
                                            <input className={inputClass} value={line.item_description} onChange={(event) => changeLine(index, "item_description", event.target.value)} placeholder="Description" />
                                        </label>

                                        <label className={labelClass}>
                                            Item Balance
                                            <input className={inputClass} type="number" min="0" step="0.001" value={line.item_balance} onChange={(event) => changeLine(index, "item_balance", event.target.value)} />
                                        </label>

                                        <label className={labelClass}>
                                            UOM
                                            <input className={inputClass} value={line.uom} onChange={(event) => changeLine(index, "uom", event.target.value)} placeholder="PCS / BOX / KG" />
                                        </label>

                                        <label className={labelClass}>
                                            Quantity *
                                            <input required className={inputClass} type="number" min="0.001" step="0.001" value={line.quantity} onChange={(event) => changeLine(index, "quantity", event.target.value)} />
                                        </label>

                                        <label className={labelClass}>
                                            Unit Price
                                            <input required className={inputClass} type="number" min="0" step="0.01" value={line.unit_price} onChange={(event) => changeLine(index, "unit_price", event.target.value)} />
                                        </label>

                                        <label className={labelClass}>
                                            Tax Rate (%)
                                            <input className={inputClass} type="number" min="0" step="0.001" value={line.tax_rate} onChange={(event) => changeLine(index, "tax_rate", event.target.value)} />
                                        </label>

                                        <label className={labelClass}>
                                            Tax Code
                                            <input className={inputClass} value={line.tax_code} onChange={(event) => changeLine(index, "tax_code", event.target.value)} placeholder="Tax code" />
                                        </label>

                                        <label className={`${labelClass} sm:col-span-2 xl:col-span-4`}>
                                            Line Memo
                                            <input className={inputClass} value={line.memo} onChange={(event) => changeLine(index, "memo", event.target.value)} placeholder="Optional line memo" />
                                        </label>
                                    </div>

                                    <div className="mt-4 grid gap-3 rounded-xl bg-slate-50 p-4 dark:bg-slate-950 sm:grid-cols-3">
                                        <div>
                                            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Amount</p>
                                            <p className="mt-1 text-lg font-bold">{line.amount.toLocaleString("en-PK", { minimumFractionDigits: 2 })}</p>
                                        </div>
                                        <div>
                                            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Tax Amount</p>
                                            <p className="mt-1 text-lg font-bold">{line.tax_amount.toLocaleString("en-PK", { minimumFractionDigits: 2 })}</p>
                                        </div>
                                        <div>
                                            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Gross Amount</p>
                                            <p className="mt-1 text-lg font-black text-blue-700 dark:text-blue-400">{line.gross_amount.toLocaleString("en-PK", { minimumFractionDigits: 2 })}</p>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </>
                ) : (
                    <div className="p-8">
                        <h3 className="text-lg font-bold">{activeTab}</h3>
                        <p className="mt-2 text-sm leading-6 text-slate-500 dark:text-slate-400">
                            {activeTab === "Accounting Lines"
                                ? "Accounting integration is not enabled for Delivery Challans. Saving this document does not post a journal entry."
                                : activeTab === "Related Transactions"
                                  ? "Sales Order references are shown on the saved challan. This form is for manual challans."
                                  : activeTab === "System Information"
                                    ? "System timestamps and transaction identifiers are assigned by the database when you save."
                                    : "Attachment upload is not connected yet. You can add an attachment workflow separately."}
                        </p>
                    </div>
                )}
            </section>

            <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-6">
                <h2 className="text-lg font-bold">Summary</h2>
                <div className="mt-4 grid gap-4 sm:grid-cols-3">
                    {[
                        ["Total Amount", totalAmount],
                        ["Tax Amount", taxAmount],
                        ["Gross Amount", grossAmount],
                    ].map(([label, value]) => (
                        <div key={label} className="rounded-2xl bg-slate-50 p-5 dark:bg-slate-950">
                            <p className="text-sm font-semibold text-slate-500 dark:text-slate-400">{label}</p>
                            <p className="mt-2 text-2xl font-black">
                                {form.currency} {Number(value).toLocaleString("en-PK", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </p>
                        </div>
                    ))}
                </div>
            </section>

            <footer className="sticky bottom-3 z-10 flex flex-wrap justify-between gap-3 rounded-2xl border border-slate-200 bg-white/95 p-4 shadow-xl backdrop-blur dark:border-slate-800 dark:bg-slate-900/95">
                <Link
                    href="/dashboard/delivery-challans"
                    className="rounded-xl border border-slate-200 px-5 py-3 text-sm font-bold dark:border-slate-700"
                >
                    ← Back
                </Link>
                <div className="flex flex-wrap gap-3">
                    <button
                        type="button"
                        onClick={() => router.push("/dashboard/delivery-challans")}
                        className="rounded-xl border border-slate-200 px-5 py-3 text-sm font-bold dark:border-slate-700"
                    >
                        Cancel
                    </button>
                    <button
                        type="submit"
                        disabled={saving}
                        className="rounded-xl bg-gradient-to-r from-blue-600 to-emerald-600 px-7 py-3 text-sm font-bold text-white shadow-lg hover:brightness-110 disabled:opacity-50"
                    >
                        {saving ? "Saving…" : "Save Delivery Challan"}
                    </button>
                </div>
            </footer>
        </form>
    );
}
