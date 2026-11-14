
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
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
    "mt-1.5 w-full min-w-0 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-800 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100";

const labelClass =
    "block text-sm font-semibold text-slate-600 dark:text-slate-300";

const LINE_COLUMNS = [
    { key: "number", label: "#" },
    { key: "item_name", label: "Item Name" },
    { key: "item_description", label: "Description" },
    { key: "item_balance", label: "Item Balance" },
    { key: "uom", label: "UOM" },
    { key: "quantity", label: "Quantity" },
    { key: "unit_price", label: "Unit Price" },
    { key: "amount", label: "Amount" },
    { key: "tax_rate", label: "Tax Rate (%)" },
    { key: "tax_amount", label: "Tax Amount" },
    { key: "gross_amount", label: "Gross Amount" },
    { key: "tax_code", label: "Tax Code" },
    { key: "memo", label: "Memo" },
];

const DEFAULT_VISIBLE_COLUMNS = LINE_COLUMNS.reduce(
    (result, column) => ({
        ...result,
        [column.key]: true,
    }),
    {}
);

function calculateLine(line) {
    const quantity = Number(line.quantity || 0);
    const unitPrice = Number(line.unit_price || 0);
    const taxRate = Number(line.tax_rate || 0);

    const amount =
        Math.round(quantity * unitPrice * 100) / 100;

    const taxAmount =
        Math.round(amount * taxRate) / 100;

    return {
        ...line,
        amount,
        tax_amount: taxAmount,
        gross_amount:
            Math.round((amount + taxAmount) * 100) / 100,
    };
}

function formatNumber(value) {
    return Number(value || 0).toLocaleString("en-PK", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    });
}

export default function DeliveryChallanForm({ challanId = null }) {
    const router = useRouter();
    const editing = Boolean(challanId);

    const [lookups, setLookups] = useState({
        customers: [],
        warehouses: [],
        products: [],
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

    // Saved transaction lines.
    const [lines, setLines] = useState([]);

    // The one currently active item-entry row.
    const [draftLine, setDraftLine] = useState(emptyItem());

    // Editing an existing transaction line.
    const [editingLineIndex, setEditingLineIndex] = useState(null);

    const [transactionNumber, setTransactionNumber] =
        useState("TO BE GENERATED");

    const [activeTab, setActiveTab] =
        useState("Transaction Lines");

    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState("");

    // Transaction line column visibility.
    const [columnsOpen, setColumnsOpen] = useState(false);
    const columnsMenuRef = useRef(null);
    const [visibleColumns, setVisibleColumns] = useState(
        DEFAULT_VISIBLE_COLUMNS
    );

    useEffect(() => {
        if (!columnsOpen) return;

        function handleOutsideClick(event) {
            if (
                columnsMenuRef.current &&
                !columnsMenuRef.current.contains(event.target)
            ) {
                setColumnsOpen(false);
            }
        }

        function handleEscape(event) {
            if (event.key === "Escape") {
                setColumnsOpen(false);
            }
        }

        document.addEventListener("mousedown", handleOutsideClick);
        document.addEventListener("touchstart", handleOutsideClick);
        document.addEventListener("keydown", handleEscape);

        return () => {
            document.removeEventListener("mousedown", handleOutsideClick);
            document.removeEventListener("touchstart", handleOutsideClick);
            document.removeEventListener("keydown", handleEscape);
        };
    }, [columnsOpen]);

    useEffect(() => {
        let cancelled = false;

        async function load() {
            setLoading(true);
            setError("");

            try {
                const lookupResponse = await fetch(
                    "/api/delivery-challans",
                    {
                        credentials: "same-origin",
                        cache: "no-store",
                    }
                );

                const lookupData = await lookupResponse.json();

                if (!lookupResponse.ok || !lookupData.success) {
                    throw new Error(
                        lookupData.message ||
                        "Could not load form data."
                    );
                }

                if (cancelled) return;

                const productList =
                    lookupData.products ||
                    lookupData.items ||
                    lookupData.data?.products ||
                    [];

                setLookups({
                    customers: lookupData.customers || [],
                    warehouses: lookupData.warehouses || [],

                    products: productList.map((product) => ({
                        ...product,
                        product_id: String(
                            product.product_id ??
                            product.id ??
                            ""
                        ),
                        product_name:
                            product.product_name ||
                            product.item_name ||
                            product.name ||
                            product.description ||
                            "",
                        product_code:
                            product.sku ||
                            product.product_code ||
                            product.item_code ||
                            product.code ||
                            "",
                        description:
                            product.description ||
                            product.item_description ||
                            "",
                        sales_unit:
                            product.sales_unit ||
                            product.sale_unit ||
                            product.unit ||
                            product.uom ||
                            "PCS",
                        sale_price: Number(
                            product.sale_price ??
                            product.sales_price ??
                            product.unit_price ??
                            0
                        ),
                    })).filter(
                        (product) => product.product_id && product.product_name
                    ),

                    company: lookupData.company || null,
                });

                setForm((previous) => ({
                    ...previous,
                    subsidiary_name:
                        previous.subsidiary_name ||
                        lookupData.company?.company_name ||
                        "",
                    currency:
                        previous.currency === "PKR" &&
                            lookupData.company?.currency
                            ? lookupData.company.currency
                            : previous.currency,
                }));

                if (editing) {
                    const response = await fetch(
                        `/api/delivery-challans/${challanId}`,
                        {
                            credentials: "same-origin",
                            cache: "no-store",
                        }
                    );

                    const result = await response.json();

                    if (!response.ok || !result.success) {
                        throw new Error(
                            result.message ||
                            "Could not load challan."
                        );
                    }

                    if (result.challan.status !== "DRAFT") {
                        throw new Error(
                            "Only draft challans can be edited."
                        );
                    }

                    if (result.challan.source_order_id) {
                        throw new Error(
                            "Sales Order-based challans cannot be edited through the manual form."
                        );
                    }

                    if (cancelled) return;

                    const c = result.challan;

                    setTransactionNumber(
                        c.transaction_number || "TO BE GENERATED"
                    );

                    setForm({
                        transaction_date: String(
                            c.transaction_date || today()
                        ).slice(0, 10),
                        customer_id: c.customer_id
                            ? String(c.customer_id)
                            : "",
                        warehouse_id: c.warehouse_id
                            ? String(c.warehouse_id)
                            : "",
                        status: c.status || "DRAFT",
                        subsidiary_name: c.subsidiary_name || "",
                        department: c.department || "",
                        challan_class:
                            c.challan_class || "Outbound Shipment",
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
                        (result.items || []).map((item) =>
                            calculateLine({
                                product_id: item.product_id
                                    ? String(item.product_id)
                                    : "",
                                item_name: item.item_name || "",
                                item_description:
                                    item.item_description || "",
                                item_balance: Number(
                                    item.item_balance || 0
                                ),
                                uom: item.uom || "",
                                quantity: Number(item.quantity || 1),
                                unit_price: Number(
                                    item.unit_price || 0
                                ),
                                tax_code: item.tax_code || "",
                                tax_rate: Number(item.tax_rate || 0),
                                memo: item.memo || "",
                            })
                        )
                    );
                }
            } catch (err) {
                if (!cancelled) {
                    setError(
                        err.message || "Could not load the form."
                    );
                }
            } finally {
                if (!cancelled) {
                    setLoading(false);
                }
            }
        }

        void load();

        return () => {
            cancelled = true;
        };
    }, [challanId, editing]);

    function change(name, value) {
        setForm((previous) => ({
            ...previous,
            [name]: value,
        }));
    }

    function changeDraftLine(name, value) {
        setDraftLine((previous) => ({
            ...previous,
            [name]: value,
        }));
    }

    function chooseProduct(productId) {
        const product = lookups.products.find(
            (item) => String(item.product_id) === String(productId)
        );

        if (!productId || !product) {
            setDraftLine((previous) => ({
                ...previous,
                product_id: "",
                item_name: "",
                item_description: "",
                unit_price: 0,
            }));
            return;
        }

        setDraftLine((previous) => ({
            ...previous,
            product_id: String(product.product_id),
            item_name: product.product_name,
            item_description: product.description || "",
            uom: product.sales_unit || "PCS",
            unit_price: Number(product.sale_price || 0),
        }));
    }

    function addLine() {
        setError("");

        const itemName = String(draftLine.item_name || "").trim();
        const quantity = Number(draftLine.quantity);
        const unitPrice = Number(draftLine.unit_price);
        const taxRate = Number(draftLine.tax_rate || 0);
        const itemBalance = Number(draftLine.item_balance || 0);

        if (!draftLine.product_id || !itemName) {
            setError("Please select an Item Name from the product dropdown.");
            return;
        }

        if (!Number.isFinite(quantity) || quantity <= 0) {
            setError("Quantity must be greater than zero.");
            return;
        }

        if (!Number.isFinite(unitPrice) || unitPrice < 0) {
            setError("Unit Price cannot be negative.");
            return;
        }

        if (!Number.isFinite(taxRate) || taxRate < 0) {
            setError("Tax Rate cannot be negative.");
            return;
        }

        if (!Number.isFinite(itemBalance) || itemBalance < 0) {
            setError("Item Balance cannot be negative.");
            return;
        }

        const newLine = calculateLine({
            ...draftLine,
            item_name: itemName,
            quantity,
            unit_price: unitPrice,
            tax_rate: taxRate,
            item_balance: itemBalance,
        });

        if (editingLineIndex !== null) {
            setLines((previous) =>
                previous.map((line, index) =>
                    index === editingLineIndex ? newLine : line
                )
            );

            setEditingLineIndex(null);
        } else {
            setLines((previous) => [...previous, newLine]);
        }

        // Clear the entry fields for the next item.
        setDraftLine(emptyItem());

        setError("");

        // Keep the user at the entry area, ready for another item.
        requestAnimationFrame(() => {
            document
                .getElementById("delivery-challan-line-entry")
                ?.scrollIntoView({
                    behavior: "smooth",
                    block: "nearest",
                });
        });
    }

    function handleLineKeyDown(event) {
        if (event.key !== "Enter") return;

        event.preventDefault();

        if (event.target.tagName === "TEXTAREA") return;

        addLine();
    }

    function editLine(index) {
        const line = lines[index];

        if (!line) return;

        setDraftLine({
            product_id: line.product_id
                ? String(line.product_id)
                : "",
            item_name: line.item_name || "",
            item_description: line.item_description || "",
            item_balance: Number(line.item_balance || 0),
            uom: line.uom || "",
            quantity: Number(line.quantity || 1),
            unit_price: Number(line.unit_price || 0),
            tax_code: line.tax_code || "",
            tax_rate: Number(line.tax_rate || 0),
            memo: line.memo || "",
        });

        setEditingLineIndex(index);
        setError("");

        document
            .getElementById("delivery-challan-line-entry")
            ?.scrollIntoView({
                behavior: "smooth",
                block: "center",
            });
    }

    function removeLine(index) {
        setLines((previous) =>
            previous.filter((_, lineIndex) => lineIndex !== index)
        );

        if (editingLineIndex === index) {
            setEditingLineIndex(null);
            setDraftLine(emptyItem());
        } else if (
            editingLineIndex !== null &&
            index < editingLineIndex
        ) {
            setEditingLineIndex((previous) => previous - 1);
        }
    }


    function toggleColumn(key) {
        setVisibleColumns((previous) => {
            const currentlyVisible = Object.values(previous).filter(Boolean).length;

            // Always keep at least one column visible.
            if (previous[key] && currentlyVisible <= 1) {
                return previous;
            }

            return {
                ...previous,
                [key]: !previous[key],
            };
        });
    }

    function showAllColumns() {
        setVisibleColumns(DEFAULT_VISIBLE_COLUMNS);
    }

    const calculatedLines = useMemo(
        () => lines.map(calculateLine),
        [lines]
    );

    const totalAmount = calculatedLines.reduce(
        (sum, line) => sum + line.amount,
        0
    );

    const taxAmount = calculatedLines.reduce(
        (sum, line) => sum + line.tax_amount,
        0
    );

    const grossAmount = calculatedLines.reduce(
        (sum, line) => sum + line.gross_amount,
        0
    );

    const visibleLineColumns = LINE_COLUMNS.filter(
        (column) => visibleColumns[column.key]
    );

    async function save(event) {
        event.preventDefault();

        if (editingLineIndex !== null) {
            setError(
                "Please finish adding or updating the current transaction line before saving."
            );
            setActiveTab("Transaction Lines");
            return;
        }

        if (lines.length === 0) {
            setError(
                "Please add at least one transaction line before saving."
            );
            setActiveTab("Transaction Lines");
            return;
        }

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
                    item_balance: Number(
                        line.item_balance || 0
                    ),
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
                    headers: {
                        "Content-Type": "application/json",
                    },
                    credentials: "same-origin",
                    body: JSON.stringify(payload),
                }
            );

            const result = await response.json();

            if (!response.ok || !result.success) {
                throw new Error(
                    result.message ||
                    "Could not save Delivery Challan."
                );
            }

            const savedId =
                result.challan?.delivery_challan_id || challanId;

            router.push(
                `/dashboard/delivery-challans/${savedId}`
            );

            router.refresh();
        } catch (err) {
            setError(
                err.message || "Could not save Delivery Challan."
            );
        } finally {
            setSaving(false);
        }
    }

    const tabs = [
        "Transaction Lines",
        "Accounting Lines",
        "Related Transactions",
        "System Information",
        "Attachments",
    ];

    if (loading) {
        return (
            <div className="grid min-h-64 place-items-center text-slate-500">
                Loading Delivery Challan form…
            </div>
        );
    }

    return (
        <form onSubmit={save} className="space-y-6">
            {/* Page header */}
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
                            {editing
                                ? "Edit Delivery Challan"
                                : "Create Delivery Challan"}
                        </h1>
                    </div>

                    <div className="rounded-2xl border border-white/20 bg-white/10 px-5 py-3 backdrop-blur">
                        <p className="text-xs font-semibold uppercase tracking-wider text-blue-100">
                            Transaction Number
                        </p>

                        <p className="mt-1 text-xl font-black">
                            {transactionNumber}
                        </p>
                    </div>
                </div>
            </header>

            {error && (
                <div
                    role="alert"
                    className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300"
                >
                    <div className="flex items-start justify-between gap-3">
                        <p>{error}</p>

                        <button
                            type="button"
                            onClick={() => setError("")}
                            className="shrink-0 font-bold"
                            aria-label="Dismiss error"
                        >
                            ×
                        </button>
                    </div>
                </div>
            )}

            {/* Transaction information */}
            <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-6">
                <div className="mb-5 flex items-center justify-between gap-3">
                    <div>
                        <h2 className="text-lg font-bold">
                            Transaction Information
                        </h2>

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
                            onChange={(event) =>
                                change(
                                    "transaction_date",
                                    event.target.value
                                )
                            }
                        />
                    </label>

                    <label className={labelClass}>
                        Customer *
                        <select
                            required
                            className={inputClass}
                            value={form.customer_id}
                            onChange={(event) =>
                                change("customer_id", event.target.value)
                            }
                        >
                            <option value="">Select customer</option>

                            {lookups.customers.map((customer) => (
                                <option
                                    key={customer.customer_id}
                                    value={customer.customer_id}
                                >
                                    {customer.customer_name}
                                    {customer.customer_code
                                        ? ` (${customer.customer_code})`
                                        : ""}
                                </option>
                            ))}
                        </select>
                    </label>

                    <label className={labelClass}>
                        Subsidiary / Company
                        <input
                            className={inputClass}
                            value={form.subsidiary_name}
                            onChange={(event) =>
                                change(
                                    "subsidiary_name",
                                    event.target.value
                                )
                            }
                            placeholder="Company name"
                        />
                    </label>

                    <label className={labelClass}>
                        Location *
                        <select
                            required
                            className={inputClass}
                            value={form.warehouse_id}
                            onChange={(event) =>
                                change(
                                    "warehouse_id",
                                    event.target.value
                                )
                            }
                        >
                            <option value="">Select location</option>

                            {lookups.warehouses.map((warehouse) => (
                                <option
                                    key={warehouse.warehouse_id}
                                    value={warehouse.warehouse_id}
                                >
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
                            onChange={(event) =>
                                change("status", event.target.value)
                            }
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
                            onChange={(event) =>
                                change(
                                    "challan_class",
                                    event.target.value
                                )
                            }
                        >
                            <option>Outbound Shipment</option>
                            <option>Customer Delivery</option>
                            <option>Other</option>
                        </select>
                    </label>

                    <label className={labelClass}>
                        Department
                        <input
                            className={inputClass}
                            value={form.department}
                            onChange={(event) =>
                                change("department", event.target.value)
                            }
                            placeholder="Department"
                        />
                    </label>

                    <label className={labelClass}>
                        Project
                        <input
                            className={inputClass}
                            value={form.project}
                            onChange={(event) =>
                                change("project", event.target.value)
                            }
                            placeholder="Project name"
                        />
                    </label>

                    <label className={labelClass}>
                        Reference Number
                        <input
                            className={inputClass}
                            value={form.reference_no}
                            onChange={(event) =>
                                change("reference_no", event.target.value)
                            }
                            placeholder="Reference number"
                        />
                    </label>

                    <label className={labelClass}>
                        Driver Name
                        <input
                            className={inputClass}
                            value={form.driver_name}
                            onChange={(event) =>
                                change("driver_name", event.target.value)
                            }
                            placeholder="Driver full name"
                        />
                    </label>

                    <label className={labelClass}>
                        Driver Mobile
                        <input
                            className={inputClass}
                            value={form.driver_mobile_no}
                            onChange={(event) =>
                                change(
                                    "driver_mobile_no",
                                    event.target.value
                                )
                            }
                            placeholder="03xx-xxxxxxx"
                        />
                    </label>

                    <label className={labelClass}>
                        Vehicle Number
                        <input
                            className={inputClass}
                            value={form.vehicle_no}
                            onChange={(event) =>
                                change("vehicle_no", event.target.value)
                            }
                            placeholder="Vehicle registration"
                        />
                    </label>

                    <label className={labelClass}>
                        Currency
                        <input
                            className={inputClass}
                            value={form.currency}
                            onChange={(event) =>
                                change(
                                    "currency",
                                    event.target.value.toUpperCase()
                                )
                            }
                            maxLength={10}
                        />
                    </label>

                    <label className={labelClass}>
                        Exchange Rate
                        <input
                            className={inputClass}
                            type="number"
                            min="0.000001"
                            step="0.000001"
                            required
                            value={form.exchange_rate}
                            onChange={(event) =>
                                change(
                                    "exchange_rate",
                                    event.target.value
                                )
                            }
                        />
                    </label>

                    <label className={`${labelClass} md:col-span-2 xl:col-span-3`}>
                        Memo
                        <textarea
                            rows={3}
                            className={inputClass}
                            value={form.memo}
                            onChange={(event) =>
                                change("memo", event.target.value)
                            }
                            placeholder="Additional delivery instructions..."
                        />
                    </label>
                </div>
            </section>

            {/* Transaction tabs and lines */}
            <section className="relative rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
                <div className="flex flex-wrap gap-2 border-b border-slate-200 p-3 dark:border-slate-800">
                    {tabs.map((tab) => (
                        <button
                            key={tab}
                            type="button"
                            onClick={() => setActiveTab(tab)}
                            className={`rounded-xl px-4 py-2.5 text-sm font-semibold transition ${activeTab === tab
                                ? "bg-blue-600 text-white shadow"
                                : "text-slate-500 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
                                }`}
                        >
                            {tab}
                        </button>
                    ))}
                </div>

                {activeTab === "Transaction Lines" ? (
                    <>
                        {/* Transaction line heading */}
                        <div className="flex flex-col justify-between gap-3 border-b border-slate-200 p-5 dark:border-slate-800 sm:flex-row sm:items-center">
                            <div>
                                <h2 className="text-lg font-bold">
                                    Transaction Lines
                                </h2>

                                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                                    Enter an item and add it to the transaction.
                                </p>
                            </div>

                            <div className="flex flex-wrap items-center gap-3">
                                <span className="rounded-xl bg-blue-50 px-4 py-2.5 text-sm font-bold text-blue-700 dark:bg-blue-950/40 dark:text-blue-300">
                                    {lines.length} item(s)
                                </span>

                                <div className="relative" ref={columnsMenuRef}>
                                    <button
                                        type="button"
                                        onClick={() =>
                                            setColumnsOpen((previous) => !previous)
                                        }
                                        className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200 dark:hover:bg-slate-800"
                                    >
                                        <span>☷</span>
                                        Columns
                                        <span>⌄</span>
                                    </button>

                                    {columnsOpen && (
                                        <div className="absolute right-0 top-full z-50 mt-2 w-72 max-w-[calc(100vw-2rem)] rounded-2xl border border-slate-200 bg-white p-3 shadow-2xl dark:border-slate-700 dark:bg-slate-900">
                                            <div className="flex items-center justify-between border-b border-slate-100 pb-3 dark:border-slate-800">
                                                <span className="font-bold">
                                                    Show / Hide Columns
                                                </span>

                                                <button
                                                    type="button"
                                                    onClick={showAllColumns}
                                                    className="text-xs font-bold text-blue-600 hover:text-blue-700 dark:text-blue-400"
                                                >
                                                    Show All
                                                </button>
                                            </div>

                                            <div className="mt-2 max-h-72 space-y-1 overflow-y-auto">
                                                {LINE_COLUMNS.map((column) => (
                                                    <label
                                                        key={column.key}
                                                        className="flex cursor-pointer items-center gap-3 rounded-lg px-2 py-2 text-sm hover:bg-slate-50 dark:hover:bg-slate-800"
                                                    >
                                                        <input
                                                            type="checkbox"
                                                            checked={Boolean(
                                                                visibleColumns[column.key]
                                                            )}
                                                            onChange={() =>
                                                                toggleColumn(column.key)
                                                            }
                                                            className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                                                        />

                                                        <span>
                                                            {column.label}
                                                        </span>
                                                    </label>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Single item entry workspace */}
                        <div
                            id="delivery-challan-line-entry"
                            className="border-b border-slate-200 bg-slate-50/70 p-4 dark:border-slate-800 dark:bg-slate-950/50 sm:p-5"
                        >
                            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                                <div>
                                    <h3 className="font-bold text-slate-800 dark:text-slate-100">
                                        {editingLineIndex !== null
                                            ? `Update Line ${editingLineIndex + 1}`
                                            : "New Transaction Line"}
                                    </h3>

                                    <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                                        Press Enter in an item field to add the line.
                                    </p>
                                </div>

                                {editingLineIndex !== null && (
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setEditingLineIndex(null);
                                            setDraftLine(emptyItem());
                                        }}
                                        className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-bold text-slate-600 hover:bg-white dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                                    >
                                        Cancel Edit
                                    </button>
                                )}
                            </div>

                            <div
                                onKeyDown={handleLineKeyDown}
                                className="grid items-end gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6"
                            >
                                <label className={`${labelClass} xl:col-span-2`}>
                                    Item Name *
                                    <select
                                        required
                                        className={inputClass}
                                        value={draftLine.product_id}
                                        onChange={(event) => chooseProduct(event.target.value)}
                                    >
                                        <option value="">Select Item</option>

                                        {lookups.products.map((product) => (
                                            <option
                                                key={product.product_id}
                                                value={product.product_id}
                                            >
                                                {product.product_name}
                                                {product.product_code
                                                    ? ` (${product.product_code})`
                                                    : ""}
                                            </option>
                                        ))}
                                    </select>

                                    <span className="mt-1 block text-xs font-normal text-slate-500">
                                        {lookups.products.length} item(s) available
                                    </span>
                                </label>

                                <label className={labelClass}>
                                    Description
                                    <input
                                        className={inputClass}
                                        value={draftLine.item_description}
                                        onChange={(event) =>
                                            changeDraftLine(
                                                "item_description",
                                                event.target.value
                                            )
                                        }
                                        placeholder="Description"
                                    />
                                </label>

                                <label className={labelClass}>
                                    Item Balance
                                    <input
                                        type="number"
                                        min="0"
                                        step="0.001"
                                        className={inputClass}
                                        value={draftLine.item_balance}
                                        onChange={(event) =>
                                            changeDraftLine(
                                                "item_balance",
                                                event.target.value
                                            )
                                        }
                                    />
                                </label>

                                <label className={labelClass}>
                                    UOM
                                    <input
                                        className={inputClass}
                                        value={draftLine.uom}
                                        onChange={(event) =>
                                            changeDraftLine(
                                                "uom",
                                                event.target.value
                                            )
                                        }
                                        placeholder="PCS"
                                    />
                                </label>

                                <label className={labelClass}>
                                    Quantity *
                                    <input
                                        type="number"
                                        min="0.001"
                                        step="0.001"
                                        className={inputClass}
                                        value={draftLine.quantity}
                                        onChange={(event) =>
                                            changeDraftLine(
                                                "quantity",
                                                event.target.value
                                            )
                                        }
                                    />
                                </label>

                                <label className={labelClass}>
                                    Unit Price
                                    <input
                                        type="number"
                                        min="0"
                                        step="0.01"
                                        className={inputClass}
                                        value={draftLine.unit_price}
                                        onChange={(event) =>
                                            changeDraftLine(
                                                "unit_price",
                                                event.target.value
                                            )
                                        }
                                    />
                                </label>

                                <label className={labelClass}>
                                    Tax Rate (%)
                                    <input
                                        type="number"
                                        min="0"
                                        step="0.001"
                                        className={inputClass}
                                        value={draftLine.tax_rate}
                                        onChange={(event) =>
                                            changeDraftLine(
                                                "tax_rate",
                                                event.target.value
                                            )
                                        }
                                    />
                                </label>

                                <label className={labelClass}>
                                    Tax Code
                                    <input
                                        className={inputClass}
                                        value={draftLine.tax_code}
                                        onChange={(event) =>
                                            changeDraftLine(
                                                "tax_code",
                                                event.target.value
                                            )
                                        }
                                        placeholder="Tax code"
                                    />
                                </label>

                                <label className={`${labelClass} sm:col-span-2 lg:col-span-3`}>
                                    Line Memo
                                    <input
                                        className={inputClass}
                                        value={draftLine.memo}
                                        onChange={(event) =>
                                            changeDraftLine(
                                                "memo",
                                                event.target.value
                                            )
                                        }
                                        placeholder="Optional line memo"
                                    />
                                </label>

                                <button
                                    type="button"
                                    onClick={addLine}
                                    className="min-h-[44px] rounded-xl bg-blue-600 px-5 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-blue-700 active:scale-[0.98]"
                                >
                                    {editingLineIndex !== null
                                        ? "✓ Update Line"
                                        : "+ Add Line"}
                                </button>
                            </div>

                            {/* Live draft amount */}
                            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-blue-100 bg-blue-50/70 px-4 py-3 dark:border-blue-900/50 dark:bg-blue-950/30">
                                <span className="text-sm font-semibold text-slate-600 dark:text-slate-300">
                                    Current line amount
                                </span>

                                <div className="flex flex-wrap gap-5 text-sm">
                                    <span>
                                        Amount:{" "}
                                        <strong>
                                            {formatNumber(
                                                Number(draftLine.quantity || 0) *
                                                Number(draftLine.unit_price || 0)
                                            )}
                                        </strong>
                                    </span>

                                    <span>
                                        Tax:{" "}
                                        <strong>
                                            {formatNumber(
                                                (Number(draftLine.quantity || 0) *
                                                    Number(draftLine.unit_price || 0) *
                                                    Number(draftLine.tax_rate || 0)) /
                                                100
                                            )}
                                        </strong>
                                    </span>

                                    <span className="text-blue-700 dark:text-blue-300">
                                        Gross:{" "}
                                        <strong>
                                            {formatNumber(
                                                Number(draftLine.quantity || 0) *
                                                Number(draftLine.unit_price || 0) *
                                                (1 +
                                                    Number(draftLine.tax_rate || 0) /
                                                    100)
                                            )}
                                        </strong>
                                    </span>
                                </div>
                            </div>
                        </div>

                        {/* Added transaction lines */}
                        <div className="p-4 sm:p-5">
                            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                                <div>
                                    <h3 className="font-bold">
                                        Added Transaction Lines
                                    </h3>

                                    <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                                        Items added here will be included when you save the challan.
                                    </p>
                                </div>

                                <span className="rounded-lg bg-slate-100 px-3 py-2 text-xs font-bold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                                    {lines.length} line(s)
                                </span>
                            </div>

                            {lines.length === 0 ? (
                                <div className="rounded-2xl border-2 border-dashed border-slate-200 px-5 py-12 text-center dark:border-slate-700">
                                    <div className="text-3xl">▤</div>

                                    <p className="mt-3 font-bold text-slate-700 dark:text-slate-200">
                                        No transaction lines added
                                    </p>

                                    <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                                        Enter an item above and press Add Line or Enter.
                                    </p>
                                </div>
                            ) : (
                                <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700">
                                    <table className="w-full min-w-max text-left text-sm">
                                        <thead className="bg-slate-100 text-xs uppercase tracking-wide text-slate-600 dark:bg-slate-950 dark:text-slate-400">
                                            <tr>
                                                {visibleLineColumns.map((column) => (
                                                    <th
                                                        key={column.key}
                                                        className="whitespace-nowrap px-4 py-3"
                                                    >
                                                        {column.label}
                                                    </th>
                                                ))}

                                                <th className="sticky right-0 whitespace-nowrap bg-slate-100 px-4 py-3 text-right dark:bg-slate-950">
                                                    Actions
                                                </th>
                                            </tr>
                                        </thead>

                                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                            {calculatedLines.map((line, index) => (
                                                <tr
                                                    key={`${line.product_id || "item"}-${index}`}
                                                    className="hover:bg-blue-50/50 dark:hover:bg-slate-800/50"
                                                >
                                                    {visibleLineColumns.map((column) => {
                                                        let value = line[column.key];

                                                        if (column.key === "number") {
                                                            value = index + 1;
                                                        } else if (
                                                            [
                                                                "amount",
                                                                "tax_amount",
                                                                "gross_amount",
                                                                "unit_price",
                                                            ].includes(column.key)
                                                        ) {
                                                            value = formatNumber(value);
                                                        } else if (
                                                            column.key === "quantity" ||
                                                            column.key === "item_balance" ||
                                                            column.key === "tax_rate"
                                                        ) {
                                                            value = Number(value || 0).toLocaleString(
                                                                "en-PK",
                                                                {
                                                                    maximumFractionDigits: 3,
                                                                }
                                                            );
                                                        }

                                                        return (
                                                            <td
                                                                key={column.key}
                                                                className={`max-w-64 px-4 py-3 ${[
                                                                    "item_name",
                                                                    "gross_amount",
                                                                ].includes(column.key)
                                                                    ? "font-bold text-slate-800 dark:text-slate-100"
                                                                    : "text-slate-600 dark:text-slate-300"
                                                                    } ${column.key === "gross_amount"
                                                                        ? "text-blue-700 dark:text-blue-400"
                                                                        : ""
                                                                    }`}
                                                            >
                                                                <span className="block min-w-0 break-words">
                                                                    {value === null ||
                                                                        value === undefined ||
                                                                        value === ""
                                                                        ? "—"
                                                                        : value}
                                                                </span>
                                                            </td>
                                                        );
                                                    })}

                                                    <td className="sticky right-0 whitespace-nowrap bg-white px-4 py-3 text-right dark:bg-slate-900">
                                                        <div className="flex justify-end gap-2">
                                                            <button
                                                                type="button"
                                                                onClick={() => editLine(index)}
                                                                className="rounded-lg bg-blue-50 px-3 py-2 text-xs font-bold text-blue-700 hover:bg-blue-100 dark:bg-blue-950/50 dark:text-blue-300"
                                                            >
                                                                Edit
                                                            </button>

                                                            <button
                                                                type="button"
                                                                onClick={() => removeLine(index)}
                                                                className="rounded-lg bg-red-50 px-3 py-2 text-xs font-bold text-red-700 hover:bg-red-100 dark:bg-red-950/40 dark:text-red-300"
                                                            >
                                                                Remove
                                                            </button>
                                                        </div>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>

                                        <tfoot className="bg-slate-50 dark:bg-slate-950">
                                            <tr>
                                                <td
                                                    colSpan={
                                                        Math.max(
                                                            visibleLineColumns.length,
                                                            1
                                                        ) + 1
                                                    }
                                                    className="px-4 py-3 text-right"
                                                >
                                                    <span className="mr-3 text-sm font-bold text-slate-500">
                                                        Lines Gross Total
                                                    </span>

                                                    <span className="text-base font-black text-blue-700 dark:text-blue-400">
                                                        {form.currency}{" "}
                                                        {formatNumber(grossAmount)}
                                                    </span>
                                                </td>
                                            </tr>
                                        </tfoot>
                                    </table>
                                </div>
                            )}
                        </div>
                    </>
                ) : (
                    <div className="p-8">
                        <h3 className="text-lg font-bold">
                            {activeTab}
                        </h3>

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

            {/* Summary */}
            <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-6">
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <h2 className="text-lg font-bold">
                        Transaction Summary
                    </h2>

                    <span className="rounded-lg bg-blue-50 px-3 py-2 text-xs font-bold text-blue-700 dark:bg-blue-950/40 dark:text-blue-300">
                        {lines.length} item(s)
                    </span>
                </div>

                <div className="mt-4 grid gap-4 sm:grid-cols-3">
                    {[
                        ["Total Amount", totalAmount],
                        ["Tax Amount", taxAmount],
                        ["Gross Amount", grossAmount],
                    ].map(([label, value]) => (
                        <div
                            key={label}
                            className="rounded-2xl bg-slate-50 p-5 dark:bg-slate-950"
                        >
                            <p className="text-sm font-semibold text-slate-500 dark:text-slate-400">
                                {label}
                            </p>

                            <p className="mt-2 break-words text-2xl font-black">
                                {form.currency} {formatNumber(value)}
                            </p>
                        </div>
                    ))}
                </div>
            </section>

            {/* Footer */}
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
                        onClick={() =>
                            router.push("/dashboard/delivery-challans")
                        }
                        className="rounded-xl border border-slate-200 px-5 py-3 text-sm font-bold dark:border-slate-700"
                    >
                        Cancel
                    </button>

                    <button
                        type="submit"
                        disabled={saving || loading}
                        className="rounded-xl bg-gradient-to-r from-blue-600 to-emerald-600 px-7 py-3 text-sm font-bold text-white shadow-lg hover:brightness-110 disabled:opacity-50"
                    >
                        {saving
                            ? "Saving…"
                            : editing
                                ? "Update Delivery Challan"
                                : "Save Delivery Challan"}
                    </button>
                </div>
            </footer>
        </form>
    );
}
