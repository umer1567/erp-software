
"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import JsBarcode from "jsbarcode";

const inputClass =
    "w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500";

const labelClass = "mb-1.5 block text-sm font-medium text-slate-700";

function generateBarcodeValue() {
    const timestamp = Date.now().toString();
    const random = Math.floor(Math.random() * 100000)
        .toString()
        .padStart(5, "0");

    return `ERP${timestamp}${random}`;
}

function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>"']/g, (character) => {
        const entities = {
            "&": "&amp;",
            "<": "&lt;",
            ">": "&gt;",
            '"': "&quot;",
            "'": "&#39;",
        };

        return entities[character];
    });
}

export default function ProductUnitsPage() {
    const [products, setProducts] = useState([]);
    const [warehouses, setWarehouses] = useState([]);
    const [units, setUnits] = useState([]);

    const [productId, setProductId] = useState("");
    const [warehouseId, setWarehouseId] = useState("");

    const [loading, setLoading] = useState(false);
    const [optionsLoading, setOptionsLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState("");
    const [barcodeSearch, setBarcodeSearch] = useState("");

    const barcodeRef = useRef(null);

    const [unitForm, setUnitForm] = useState({
        unitName: "",
        barcode: "",
        conversionFactor: "1",
    });

    const [adjustment, setAdjustment] = useState({
        unitId: "",
        type: "INCREASE",
        quantity: "1",
    });

    const [conversion, setConversion] = useState({
        fromUnitId: "",
        toUnitId: "",
        quantity: "1",
    });

    // Load products and warehouses.
    useEffect(() => {
        let cancelled = false;

        async function loadOptions() {
            try {
                const [productsResponse, warehousesResponse] = await Promise.all([
                    fetch("/api/products"),
                    fetch("/api/warehouses"),
                ]);

                const productsData = await productsResponse.json();
                const warehousesData = await warehousesResponse.json();

                if (!productsResponse.ok || !warehousesResponse.ok) {
                    throw new Error(
                        productsData.message ||
                        warehousesData.message ||
                        "Could not load products or warehouses."
                    );
                }

                if (cancelled) return;

                const productList = productsData.products || [];
                const warehouseList = warehousesData.warehouses || [];

                setProducts(productList);
                setWarehouses(warehouseList);

                if (productList.length) {
                    setProductId(String(productList[0].product_id));
                }

                if (warehouseList.length) {
                    setWarehouseId(String(warehouseList[0].warehouse_id));
                }
            } catch (error) {
                if (!cancelled) {
                    setMessage(error.message || "Failed to load page options.");
                }
            } finally {
                if (!cancelled) {
                    setOptionsLoading(false);
                }
            }
        }

        loadOptions();

        return () => {
            cancelled = true;
        };
    }, []);

    // Load stock for the selected product and warehouse.
    const loadUnits = useCallback(async () => {
        if (!productId || !warehouseId) {
            setUnits([]);
            setLoading(false);
            return;
        }

        setLoading(true);

        try {
            const response = await fetch(
                `/api/unit-stock?productId=${encodeURIComponent(
                    productId
                )}&warehouseId=${encodeURIComponent(warehouseId)}`
            );

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.message || "Failed to load packaging stock.");
            }

            setUnits(data.stock || []);
        } catch (error) {
            setMessage(error.message || "Failed to load packaging stock.");
        } finally {
            setLoading(false);
        }
    }, [productId, warehouseId]);

    useEffect(() => {
        let cancelled = false;

        async function fetchUnits() {
            if (!productId || !warehouseId) {
                setUnits([]);
                return;
            }

            setLoading(true);

            try {
                const response = await fetch(
                    `/api/unit-stock?productId=${encodeURIComponent(
                        productId
                    )}&warehouseId=${encodeURIComponent(warehouseId)}`
                );

                const data = await response.json();

                if (!response.ok) {
                    throw new Error(data.message || "Failed to load packaging stock.");
                }

                if (!cancelled) {
                    setUnits(data.stock || []);
                }
            } catch (error) {
                if (!cancelled) {
                    setMessage(error.message || "Failed to load packaging stock.");
                }
            } finally {
                if (!cancelled) {
                    setLoading(false);
                }
            }
        }

        fetchUnits();

        return () => {
            cancelled = true;
        };
    }, [productId, warehouseId]);

    // Render the barcode preview whenever the barcode changes.
    useEffect(() => {
        const svg = barcodeRef.current;

        if (!svg) return;

        svg.innerHTML = "";

        const value = unitForm.barcode.trim();

        if (!value) return;

        try {
            JsBarcode(svg, value, {
                format: "CODE128",
                displayValue: true,
                fontSize: 14,
                fontOptions: "bold",
                textMargin: 6,
                height: 65,
                margin: 10,
                background: "#ffffff",
                lineColor: "#000000",
            });
        } catch {
            svg.innerHTML = "";
        }
    }, [unitForm.barcode]);

    function updateUnitField(field, value) {
        setUnitForm((previous) => ({
            ...previous,
            [field]: value,
        }));
    }

    function generateBarcode() {
        setMessage("");
        updateUnitField("barcode", generateBarcodeValue());
    }

    // Add a packaging unit and save its barcode.
    async function addUnit(event) {
        event.preventDefault();
        setMessage("");

        if (!productId) {
            setMessage("Please select a product.");
            return;
        }

        if (!unitForm.unitName.trim()) {
            setMessage("Please enter a unit name.");
            return;
        }

        const conversionFactor = Number(unitForm.conversionFactor);

        if (!Number.isFinite(conversionFactor) || conversionFactor <= 0) {
            setMessage("Base units per unit must be greater than zero.");
            return;
        }

        setSaving(true);

        try {
            const response = await fetch("/api/product-units", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    productId: Number(productId),
                    unitName: unitForm.unitName.trim(),
                    barcode: unitForm.barcode.trim() || null,
                    conversionFactor,
                }),
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.message || "Could not add packaging unit.");
            }

            setMessage(data.message || "Packaging unit added successfully.");

            setUnitForm({
                unitName: "",
                barcode: "",
                conversionFactor: "1",
            });

            await loadUnits();
        } catch (error) {
            setMessage(error.message || "Failed to add packaging unit.");
        } finally {
            setSaving(false);
        }
    }

    // Increase or decrease packaging stock.
    async function submitAdjustment(event) {
        event.preventDefault();
        setMessage("");

        if (!warehouseId) {
            setMessage("Please select a warehouse.");
            return;
        }

        const quantity = Number(adjustment.quantity);

        if (!Number.isFinite(quantity) || quantity <= 0) {
            setMessage("Quantity must be greater than zero.");
            return;
        }

        try {
            const response = await fetch("/api/unit-stock/adjust", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    ...adjustment,
                    unitId: Number(adjustment.unitId),
                    warehouseId: Number(warehouseId),
                    quantity,
                }),
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.message || "Stock adjustment failed.");
            }

            setMessage(data.message || "Stock adjusted successfully.");

            await loadUnits();
        } catch (error) {
            setMessage(error.message || "Stock adjustment failed.");
        }
    }

    // Convert quantities between two units of the same product.
    async function submitConversion(event) {
        event.preventDefault();
        setMessage("");

        if (conversion.fromUnitId === conversion.toUnitId) {
            setMessage("Choose two different packaging units.");
            return;
        }

        const quantity = Number(conversion.quantity);

        if (!Number.isFinite(quantity) || quantity <= 0) {
            setMessage("Conversion quantity must be greater than zero.");
            return;
        }

        try {
            const response = await fetch("/api/unit-stock", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    ...conversion,
                    warehouseId: Number(warehouseId),
                    fromUnitId: Number(conversion.fromUnitId),
                    toUnitId: Number(conversion.toUnitId),
                    quantity,
                }),
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.message || "Stock conversion failed.");
            }

            setMessage(
                `${data.message || "Stock converted successfully."}${data.destinationQuantity != null
                    ? ` Converted quantity: ${data.destinationQuantity} ${data.destinationUnit || ""
                    }.`
                    : ""
                }`
            );

            await loadUnits();
        } catch (error) {
            setMessage(error.message || "Stock conversion failed.");
        }
    }

    // Search for a saved barcode.
    async function findBarcode(event) {
        event.preventDefault();
        setMessage("");

        const barcode = barcodeSearch.trim();

        if (!barcode) {
            setMessage("Enter or scan a barcode first.");
            return;
        }

        try {
            const response = await fetch(
                `/api/product-units?barcode=${encodeURIComponent(barcode)}`
            );

            const data = await response.json();

            if (!response.ok || !data.units?.length) {
                throw new Error("No packaging unit found for this barcode.");
            }

            const match =
                data.units.find(
                    (unit) =>
                        !warehouseId ||
                        String(unit.warehouse_id) === String(warehouseId)
                ) || data.units[0];

            setProductId(String(match.product_id));

            if (match.warehouse_id != null) {
                setWarehouseId(String(match.warehouse_id));
            }

            setMessage(
                `Found ${match.product_name || "product"} — ${match.unit_name || "packaging unit"
                }.`
            );
        } catch (error) {
            setMessage(error.message || "Barcode lookup failed.");
        }
    }

    // Delete a non-base packaging unit.
    async function deleteUnit(unit) {
        if (unit.is_base_unit) {
            setMessage("The base unit cannot be deleted.");
            return;
        }

        const confirmed = window.confirm(
            `Delete the ${unit.unit_name} unit?`
        );

        if (!confirmed) return;

        try {
            const response = await fetch(
                `/api/product-units/${unit.unit_id}`,
                {
                    method: "DELETE",
                }
            );

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.message || "Could not delete unit.");
            }

            setMessage(data.message || "Packaging unit deleted.");

            await loadUnits();
        } catch (error) {
            setMessage(error.message || "Failed to delete unit.");
        }
    }

    // Print the barcode currently shown in the preview.
    function printBarcode(barcode, unitName) {
        const svg = barcodeRef.current;

        if (!svg || !barcode.trim()) {
            setMessage("Generate a barcode before printing.");
            return;
        }

        const printWindow = window.open(
            "",
            "_blank",
            "width=600,height=450"
        );

        if (!printWindow) {
            setMessage("Allow pop-ups in your browser to print barcodes.");
            return;
        }

        const productName = escapeHtml(
            selectedProduct?.product_name || "Product"
        );
        const safeSku = escapeHtml(selectedProduct?.sku || "");
        const safeUnit = escapeHtml(unitName);
        const safeBarcode = escapeHtml(barcode);

        printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Product Barcode</title>
          <meta charset="UTF-8" />
          <style>
            body {
              font-family: Arial, sans-serif;
              text-align: center;
              padding: 24px;
              color: #111827;
            }
            .label {
              display: inline-block;
              border: 1px solid #ddd;
              padding: 16px;
              max-width: 100%;
            }
            h2 {
              font-size: 18px;
              margin: 0 0 6px;
            }
            p {
              font-size: 13px;
              margin: 5px 0;
            }
            svg {
              display: block;
              max-width: 100%;
              height: auto;
              margin: 12px auto;
            }
            @media print {
              body { padding: 0; }
              .label { border: none; }
            }
          </style>
        </head>
        <body>
          <div class="label">
            <h2>${productName}</h2>
            <p>SKU: ${safeSku}</p>
            <p>Unit: ${safeUnit}</p>
            ${svg.outerHTML}
            <p>${safeBarcode}</p>
          </div>
          <script>
            window.onload = function () {
              window.print();
            };
          <\/script>
        </body>
      </html>
    `);

        printWindow.document.close();
        setMessage("Print window opened.");
    }

    const selectedProduct = products.find(
        (product) => String(product.product_id) === String(productId)
    );

    const money = (value) =>
        Number(value || 0).toLocaleString(undefined, {
            maximumFractionDigits: 3,
        });

    return (
        <div className="space-y-6 pb-8">
            {/* Page heading */}
            <div>
                <h1 className="text-3xl font-bold text-slate-900">
                    Product Units & Barcodes
                </h1>
                <p className="mt-1 text-slate-500">
                    Manage packaging units, generate barcodes, print labels, and
                    track warehouse quantities.
                </p>
            </div>

            {/* Feedback */}
            {message && (
                <div
                    role="status"
                    className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800"
                >
                    {message}
                </div>
            )}

            {/* Product and warehouse selection */}
            <div className="grid gap-4 rounded-xl border border-slate-200 bg-white p-5 md:grid-cols-2">
                <div>
                    <label className={labelClass}>Product</label>
                    <select
                        className={inputClass}
                        value={productId}
                        onChange={(event) => setProductId(event.target.value)}
                        disabled={optionsLoading}
                    >
                        <option value="">Select product</option>
                        {products.map((product) => (
                            <option
                                key={product.product_id}
                                value={product.product_id}
                            >
                                {product.sku} — {product.product_name}
                            </option>
                        ))}
                    </select>
                </div>

                <div>
                    <label className={labelClass}>Warehouse</label>
                    <select
                        className={inputClass}
                        value={warehouseId}
                        onChange={(event) => setWarehouseId(event.target.value)}
                        disabled={optionsLoading}
                    >
                        <option value="">Select warehouse</option>
                        {warehouses.map((warehouse) => (
                            <option
                                key={warehouse.warehouse_id}
                                value={warehouse.warehouse_id}
                            >
                                {warehouse.warehouse_name}
                            </option>
                        ))}
                    </select>
                </div>

                {/* Barcode lookup */}
                <form onSubmit={findBarcode} className="md:col-span-2">
                    <label className={labelClass}>Find by barcode</label>
                    <div className="flex flex-col gap-2 sm:flex-row">
                        <input
                            className={inputClass}
                            value={barcodeSearch}
                            onChange={(event) => setBarcodeSearch(event.target.value)}
                            placeholder="Scan barcode or type barcode"
                        />
                        <button
                            type="submit"
                            className="rounded-lg bg-slate-900 px-5 py-2.5 text-sm font-medium text-white hover:bg-slate-700"
                        >
                            Find
                        </button>
                    </div>
                    <p className="mt-1 text-xs text-slate-500">
                        A barcode must already be saved against a packaging unit to
                        be found here.
                    </p>
                </form>
            </div>

            {/* Selected product */}
            {selectedProduct && (
                <div className="flex flex-col justify-between gap-3 rounded-xl border border-slate-200 bg-white p-5 sm:flex-row sm:items-center">
                    <div>
                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                            Selected product
                        </p>
                        <h2 className="mt-1 text-xl font-bold text-slate-900">
                            {selectedProduct.product_name}
                        </h2>
                        <p className="mt-1 text-sm text-slate-500">
                            SKU: {selectedProduct.sku}
                        </p>
                    </div>
                    <div className="rounded-lg bg-blue-50 px-4 py-3">
                        <p className="text-xs text-blue-700">Packaging units</p>
                        <p className="text-2xl font-bold text-blue-900">
                            {loading ? "…" : units.length}
                        </p>
                    </div>
                </div>
            )}

            {/* Add unit and adjust stock */}
            <div className="grid gap-6 xl:grid-cols-2">
                {/* Add packaging unit */}
                <form
                    onSubmit={addUnit}
                    className="space-y-4 rounded-xl border border-slate-200 bg-white p-5"
                >
                    <div>
                        <h2 className="text-lg font-bold text-slate-900">
                            Add Packaging Unit
                        </h2>
                        <p className="mt-1 text-sm text-slate-500">
                            Create a unit and generate a barcode label for it.
                        </p>
                    </div>

                    <div>
                        <label className={labelClass}>Unit name</label>
                        <input
                            className={inputClass}
                            value={unitForm.unitName}
                            onChange={(event) =>
                                updateUnitField("unitName", event.target.value)
                            }
                            placeholder="e.g. Box, Packet, Piece"
                            required
                        />
                    </div>

                    <div>
                        <label className={labelClass}>Barcode (unique)</label>
                        <input
                            className={inputClass}
                            value={unitForm.barcode}
                            onChange={(event) =>
                                updateUnitField("barcode", event.target.value)
                            }
                            placeholder="Generate, scan, or enter barcode"
                        />

                        <div className="mt-3 flex flex-wrap gap-2">
                            <button
                                type="button"
                                onClick={generateBarcode}
                                className="rounded-lg bg-blue-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-800"
                            >
                                Generate Barcode
                            </button>

                            <button
                                type="button"
                                onClick={() =>
                                    printBarcode(unitForm.barcode, unitForm.unitName)
                                }
                                disabled={!unitForm.barcode.trim()}
                                className="rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                                Print Barcode
                            </button>
                        </div>

                        {unitForm.barcode.trim() && (
                            <div className="mt-4 rounded-lg border border-slate-200 bg-white p-4">
                                <p className="mb-3 text-center text-xs font-semibold uppercase tracking-wide text-slate-500">
                                    Barcode Preview
                                </p>
                                <div className="overflow-x-auto">
                                    <svg
                                        ref={barcodeRef}
                                        className="mx-auto max-w-full"
                                        role="img"
                                        aria-label="Barcode preview"
                                    />
                                </div>
                                <p className="mt-2 break-all text-center text-xs text-slate-500">
                                    {unitForm.barcode}
                                </p>
                            </div>
                        )}

                        <p className="mt-2 text-xs text-slate-500">
                            The barcode will be saved when you click Add Unit.
                        </p>
                    </div>

                    <div>
                        <label className={labelClass}>
                            Base units per unit
                        </label>
                        <input
                            type="number"
                            min="0.001"
                            step="0.001"
                            className={inputClass}
                            value={unitForm.conversionFactor}
                            onChange={(event) =>
                                updateUnitField("conversionFactor", event.target.value)
                            }
                            required
                        />
                        <p className="mt-1 text-xs text-slate-500">
                            If Packet is the base unit, set Box to 24 and Packet to 1.
                        </p>
                    </div>

                    <button
                        type="submit"
                        disabled={!productId || saving}
                        className="w-full rounded-lg bg-slate-900 px-5 py-3 font-semibold text-white hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
                    >
                        {saving ? "Saving..." : "Add Unit"}
                    </button>
                </form>

                {/* Adjust unit stock */}
                <form
                    onSubmit={submitAdjustment}
                    className="space-y-4 rounded-xl border border-slate-200 bg-white p-5"
                >
                    <div>
                        <h2 className="text-lg font-bold text-slate-900">
                            Adjust Unit Stock
                        </h2>
                        <p className="mt-1 text-sm text-slate-500">
                            Increase or decrease a unit&apos;s quantity in the selected
                            warehouse.
                        </p>
                    </div>

                    <div>
                        <label className={labelClass}>Packaging unit</label>
                        <select
                            className={inputClass}
                            value={adjustment.unitId}
                            onChange={(event) =>
                                setAdjustment({
                                    ...adjustment,
                                    unitId: event.target.value,
                                })
                            }
                            required
                        >
                            <option value="">Select unit</option>
                            {units.map((unit) => (
                                <option key={unit.unit_id} value={unit.unit_id}>
                                    {unit.unit_name} — current: {money(unit.quantity)}
                                </option>
                            ))}
                        </select>
                    </div>

                    <div>
                        <label className={labelClass}>Adjustment type</label>
                        <select
                            className={inputClass}
                            value={adjustment.type}
                            onChange={(event) =>
                                setAdjustment({
                                    ...adjustment,
                                    type: event.target.value,
                                })
                            }
                        >
                            <option value="INCREASE">Receive / Increase</option>
                            <option value="DECREASE">Remove / Decrease</option>
                        </select>
                    </div>

                    <div>
                        <label className={labelClass}>Quantity</label>
                        <input
                            type="number"
                            min="0.001"
                            step="0.001"
                            className={inputClass}
                            value={adjustment.quantity}
                            onChange={(event) =>
                                setAdjustment({
                                    ...adjustment,
                                    quantity: event.target.value,
                                })
                            }
                            required
                        />
                    </div>

                    <button
                        type="submit"
                        disabled={!warehouseId || !units.length}
                        className="rounded-lg bg-slate-900 px-5 py-3 font-semibold text-white hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                        Update Stock
                    </button>
                </form>
            </div>

            {/* Convert units */}
            <form
                onSubmit={submitConversion}
                className="grid gap-4 rounded-xl border border-slate-200 bg-white p-5 md:grid-cols-4"
            >
                <div className="md:col-span-4">
                    <h2 className="text-lg font-bold text-slate-900">
                        Convert Packaging Stock
                    </h2>
                    <p className="mt-1 text-sm text-slate-500">
                        Convert quantities between units of the same product in the
                        selected warehouse.
                    </p>
                </div>

                <div>
                    <label className={labelClass}>Convert from</label>
                    <select
                        className={inputClass}
                        value={conversion.fromUnitId}
                        onChange={(event) =>
                            setConversion({
                                ...conversion,
                                fromUnitId: event.target.value,
                            })
                        }
                        required
                    >
                        <option value="">Select source</option>
                        {units.map((unit) => (
                            <option key={unit.unit_id} value={unit.unit_id}>
                                {unit.unit_name} ({money(unit.quantity)} available)
                            </option>
                        ))}
                    </select>
                </div>

                <div>
                    <label className={labelClass}>Convert to</label>
                    <select
                        className={inputClass}
                        value={conversion.toUnitId}
                        onChange={(event) =>
                            setConversion({
                                ...conversion,
                                toUnitId: event.target.value,
                            })
                        }
                        required
                    >
                        <option value="">Select destination</option>
                        {units.map((unit) => (
                            <option key={unit.unit_id} value={unit.unit_id}>
                                {unit.unit_name}
                            </option>
                        ))}
                    </select>
                </div>

                <div>
                    <label className={labelClass}>Source quantity</label>
                    <input
                        type="number"
                        min="0.001"
                        step="0.001"
                        className={inputClass}
                        value={conversion.quantity}
                        onChange={(event) =>
                            setConversion({
                                ...conversion,
                                quantity: event.target.value,
                            })
                        }
                        required
                    />
                </div>

                <div className="flex items-end">
                    <button
                        type="submit"
                        disabled={!warehouseId || units.length < 2}
                        className="w-full rounded-lg bg-blue-700 px-5 py-3 font-semibold text-white hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                        Convert Stock
                    </button>
                </div>
            </form>

            {/* Packaging stock table */}
            <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
                <div className="flex flex-col justify-between gap-2 border-b border-slate-200 px-5 py-4 sm:flex-row sm:items-center">
                    <div>
                        <h2 className="text-lg font-bold text-slate-900">
                            Packaging Stock
                        </h2>
                        <p className="mt-1 text-sm text-slate-500">
                            {loading
                                ? "Loading stock..."
                                : `${units.length} packaging unit(s)`}
                        </p>
                    </div>

                    <button
                        type="button"
                        onClick={loadUnits}
                        disabled={loading || !productId || !warehouseId}
                        className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                    >
                        Refresh
                    </button>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full min-w-[760px] text-left text-sm">
                        <thead className="bg-slate-50 text-slate-600">
                            <tr>
                                <th className="px-5 py-3 font-semibold">Unit</th>
                                <th className="px-5 py-3 font-semibold">Barcode</th>
                                <th className="px-5 py-3 font-semibold">Base Units</th>
                                <th className="px-5 py-3 font-semibold">
                                    Warehouse Quantity
                                </th>
                                <th className="px-5 py-3 font-semibold">Type</th>
                                <th className="px-5 py-3 font-semibold">Action</th>
                            </tr>
                        </thead>

                        <tbody>
                            {units.map((unit) => (
                                <tr
                                    key={unit.unit_id}
                                    className="border-t border-slate-100 hover:bg-slate-50"
                                >
                                    <td className="px-5 py-3 font-medium text-slate-900">
                                        {unit.unit_name}
                                    </td>

                                    <td className="px-5 py-3">
                                        {unit.barcode ? (
                                            <div className="flex flex-col items-start gap-1">
                                                <span className="font-mono text-xs">
                                                    {unit.barcode}
                                                </span>
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        setUnitForm((previous) => ({
                                                            ...previous,
                                                            unitName: unit.unit_name,
                                                            barcode: unit.barcode,
                                                            conversionFactor: String(
                                                                unit.conversion_factor
                                                            ),
                                                        }));
                                                        window.scrollTo({
                                                            top: 0,
                                                            behavior: "smooth",
                                                        });
                                                    }}
                                                    className="text-xs font-medium text-blue-700 hover:underline"
                                                >
                                                    Preview barcode above
                                                </button>
                                            </div>
                                        ) : (
                                            <span className="text-slate-400">No barcode</span>
                                        )}
                                    </td>

                                    <td className="px-5 py-3">
                                        {money(unit.conversion_factor)}
                                    </td>

                                    <td className="px-5 py-3 font-semibold text-slate-900">
                                        {money(unit.quantity)}
                                    </td>

                                    <td className="px-5 py-3">
                                        <span
                                            className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${unit.is_base_unit
                                                    ? "bg-blue-50 text-blue-700"
                                                    : "bg-slate-100 text-slate-700"
                                                }`}
                                        >
                                            {unit.is_base_unit ? "Base unit" : "Packaging unit"}
                                        </span>
                                    </td>


                                    <td className="px-5 py-3">
                                        <div className="flex flex-wrap gap-2">
                                            {unit.barcode && (
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        setUnitForm((previous) => ({
                                                            ...previous,
                                                            unitName: unit.unit_name,
                                                            barcode: unit.barcode,
                                                            conversionFactor: String(unit.conversion_factor),
                                                        }));

                                                        window.scrollTo({
                                                            top: 0,
                                                            behavior: "smooth",
                                                        });

                                                        setMessage(
                                                            "Barcode loaded into the preview form. Use Print Barcode to print its label."
                                                        );
                                                    }}
                                                    className="rounded-md border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100"
                                                >
                                                    Load
                                                </button>
                                            )}

                                            {!unit.is_base_unit && (
                                                <button
                                                    type="button"
                                                    onClick={() => deleteUnit(unit)}
                                                    className="rounded-md bg-red-50 px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-100"
                                                >
                                                    Delete
                                                </button>
                                            )}
                                        </div>
                                    </td>

                                </tr>
                            ))}

                            {!loading && units.length === 0 && (
                                <tr>
                                    <td
                                        colSpan={6}
                                        className="px-5 py-10 text-center text-slate-500"
                                    >
                                        {optionsLoading
                                            ? "Loading products and warehouses..."
                                            : !productId || !warehouseId
                                                ? "Select a product and warehouse to see stock."
                                                : "No packaging units found for this product and warehouse."}
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
