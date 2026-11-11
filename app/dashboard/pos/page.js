
"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
    Activity,
    AlertCircle,
    Archive,
    ArrowDownLeft,
    ArrowRight,
    ArrowUpRight,
    Banknote,
    Barcode,
    Boxes,
    CheckCircle2,
    ChevronDown,
    Clock,
    CreditCard,
    FileText,
    Package,
    Plus,
    Printer,
    RefreshCw,
    Search,
    ShoppingBag,
    ShoppingCart,
    Trash2,
    Wallet,
    X,
    Warehouse,
    UserRound,
    ScanLine,
    Receipt,
    Minus,
    CircleDollarSign,
    RotateCcw,
    Eye,
    Download,
    CalendarDays,
    Hash,
    Phone,
    Layers3,
    Sparkles,
    Check,
    LockKeyhole,
} from "lucide-react";

const inputClass =
    "w-full rounded-xl border border-slate-200 bg-white px-3.5 py-3 text-sm text-slate-800 outline-none transition-all duration-200 placeholder:text-slate-400 hover:border-indigo-300 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:placeholder:text-slate-500 dark:hover:border-indigo-500 dark:focus:border-indigo-400 dark:focus:ring-indigo-400/10";

const labelClass =
    "mb-2 block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400";

const panelClass =
    "rounded-2xl border border-slate-200/80 bg-white shadow-sm transition-colors duration-200 dark:border-slate-700/80 dark:bg-slate-900";

const buttonPrimary =
    "inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 px-4 py-3 text-sm font-bold text-white shadow-md shadow-indigo-600/20 transition-all duration-200 hover:-translate-y-0.5 hover:from-indigo-700 hover:to-violet-700 hover:shadow-lg hover:shadow-indigo-600/25 active:translate-y-0 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0";

const buttonSecondary =
    "inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 shadow-sm transition-all duration-200 hover:border-indigo-300 hover:bg-indigo-50 hover:text-indigo-700 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:border-indigo-500 dark:hover:bg-slate-700 dark:hover:text-indigo-300";

const buttonIcon =
    "inline-flex h-10 w-10 items-center justify-center rounded-xl text-slate-400 transition-all duration-200 hover:bg-rose-50 hover:text-rose-600 active:scale-95 dark:text-slate-400 dark:hover:bg-rose-950/40 dark:hover:text-rose-400";

function todayLocal() {
    const date = new Date();

    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(
        2,
        "0"
    )}-${String(date.getDate()).padStart(2, "0")}`;
}

function rowsFrom(data, key) {
    return Array.isArray(data) ? data : data?.[key] || [];
}

function cartKey(item) {
    return `${item.product_id}:${item.sub_product_id ?? "main"}`;
}

function formatDate(value) {
    if (!value) return "—";

    const date = new Date(value);

    return Number.isNaN(date.getTime())
        ? String(value)
        : date.toLocaleDateString("en-PK", {
            day: "2-digit",
            month: "short",
            year: "numeric",
        });
}

function formatDateTime(value) {
    if (!value) return "—";

    const date = new Date(value);

    return Number.isNaN(date.getTime())
        ? String(value)
        : date.toLocaleString("en-PK", {
            dateStyle: "medium",
            timeStyle: "short",
        });
}

function Modal({ children, onClose, className = "", zIndex = "z-50" }) {
    useEffect(() => {
        function handleKeyDown(event) {
            if (event.key === "Escape") onClose?.();
        }

        window.addEventListener("keydown", handleKeyDown);

        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [onClose]);

    return (
        <div
            className={`fixed inset-0 ${zIndex} flex items-center justify-center overflow-y-auto bg-slate-950/60 p-3 backdrop-blur-sm sm:p-6`}
            onMouseDown={(event) => {
                if (event.target === event.currentTarget) onClose?.();
            }}
        >
            <div
                className={`my-auto w-full overflow-hidden rounded-2xl border border-white/20 bg-white shadow-2xl ${className}`}
            >
                {children}
            </div>
        </div>
    );
}

function ModalHeader({
    icon: Icon,
    title,
    subtitle,
    onClose,
    accent = "indigo",
}) {
    const colors = {
        indigo: "bg-indigo-50 text-indigo-600",
        emerald: "bg-emerald-50 text-emerald-600",
        rose: "bg-rose-50 text-rose-600",
        violet: "bg-violet-50 text-violet-600",
        slate: "bg-slate-100 text-slate-600",
    };

    return (
        <div className="flex items-center justify-between gap-4 border-b border-slate-100 px-5 py-4 sm:px-6">
            <div className="flex min-w-0 items-center gap-3">
                <div
                    className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${colors[accent] || colors.indigo
                        }`}
                >
                    {Icon && <Icon size={21} />}
                </div>

                <div className="min-w-0">
                    <h2 className="text-lg font-extrabold tracking-tight text-slate-900">
                        {title}
                    </h2>
                    {subtitle && (
                        <p className="mt-0.5 text-xs text-slate-500 sm:text-sm">
                            {subtitle}
                        </p>
                    )}
                </div>
            </div>

            <button
                type="button"
                onClick={onClose}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
                aria-label="Close dialog"
            >
                <X size={19} />
            </button>
        </div>
    );
}

function SummaryCard({ icon: Icon, label, value, detail, color }) {
    const themes = {
        indigo: "bg-indigo-50 text-indigo-600",
        emerald: "bg-emerald-50 text-emerald-600",
        violet: "bg-violet-50 text-violet-600",
        amber: "bg-amber-50 text-amber-600",
    };

    return (
        <div className={`${panelClass} group p-4 transition hover:-translate-y-0.5 hover:shadow-md sm:p-5`}>
            <div className="flex items-start justify-between gap-3">
                <div>
                    <p className="text-xs font-bold uppercase tracking-wider text-slate-500">
                        {label}
                    </p>
                    <p className="mt-2 text-2xl font-extrabold tracking-tight text-slate-900">
                        {value}
                    </p>
                    {detail && (
                        <p className="mt-1 text-xs text-slate-500">{detail}</p>
                    )}
                </div>

                <div
                    className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${themes[color] || themes.indigo
                        }`}
                >
                    {Icon && <Icon size={21} />}
                </div>
            </div>
        </div>
    );
}

function SectionHeading({ icon: Icon, title, subtitle, action }) {
    return (
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
                    {Icon && <Icon size={20} />}
                </div>

                <div>
                    <h2 className="font-extrabold tracking-tight text-slate-900">
                        {title}
                    </h2>
                    {subtitle && (
                        <p className="mt-0.5 text-xs text-slate-500 sm:text-sm">
                            {subtitle}
                        </p>
                    )}
                </div>
            </div>

            {action}
        </div>
    );
}

export default function POSPage() {
    const [products, setProducts] = useState([]);
    const [customers, setCustomers] = useState([]);
    const [warehouses, setWarehouses] = useState([]);
    const [stock, setStock] = useState([]);
    const [cart, setCart] = useState([]);

    const [customerId, setCustomerId] = useState("");
    const [warehouseId, setWarehouseId] = useState("");

    const [barcode, setBarcode] = useState("");
    const barcodeRef = useRef(null);

    const [search, setSearch] = useState("");
    const [discount, setDiscount] = useState("0");
    const [tax, setTax] = useState("0");
    const [received, setReceived] = useState("0");
    const [accounts, setAccounts] = useState([]);
    const [accountId, setAccountId] = useState("");

    const [orders, setOrders] = useState([]);
    const [showOrders, setShowOrders] = useState(false);
    const [reviewingOrder, setReviewingOrder] = useState(false);

    const [reviewingInvoice, setReviewingInvoice] = useState(null);
    const [loadingInvoice, setLoadingInvoice] = useState(false);

    const [heldSales, setHeldSales] = useState([]);
    const [showHeldSales, setShowHeldSales] = useState(false);

    const [showCashMovement, setShowCashMovement] = useState(false);
    const [cashMovementType, setCashMovementType] = useState("RECEIPT");
    const [cashAccounts, setCashAccounts] = useState([]);
    const [counterAccounts, setCounterAccounts] = useState([]);
    const [cashAccountId, setCashAccountId] = useState("");
    const [counterAccountId, setCounterAccountId] = useState("");
    const [cashAmount, setCashAmount] = useState("");
    const [cashDate, setCashDate] = useState(todayLocal());
    const [cashReference, setCashReference] = useState("");
    const [cashDescription, setCashDescription] = useState("");
    const [loadingCashAccounts, setLoadingCashAccounts] = useState(false);
    const [savingCashMovement, setSavingCashMovement] = useState(false);

    const [loading, setLoading] = useState(true);
    const [checkingOut, setCheckingOut] = useState(false);
    const [message, setMessage] = useState("");
    const [error, setError] = useState("");
    const [permissions, setPermissions] = useState({
        canView: false,
        canCreate: false,
        canUpdate: false,
        canDelete: false,
    });
    const [permissionsLoaded, setPermissionsLoaded] = useState(false);

    const money = useCallback(
        (value) =>
            Number(value || 0).toLocaleString("en-PK", {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
            }),
        []
    );

    useEffect(() => {
        let cancelled = false;

        async function loadPosPermissions() {
            try {
                const response = await fetch("/api/auth/my-permissions", {
                    cache: "no-store",
                });

                const data = await response.json();

                if (!response.ok) {
                    throw new Error(
                        data.message || "Could not load POS permissions."
                    );
                }

                const posPermission = (data.permissions || []).find(
                    (permission) => permission.permission_key === "pos"
                );

                if (!cancelled) {
                    setPermissions({
                        canView: posPermission?.can_view === true,
                        canCreate: posPermission?.can_create === true,
                        canUpdate: posPermission?.can_update === true,
                        canDelete: posPermission?.can_delete === true,
                    });
                }
            } catch (err) {
                if (!cancelled) {
                    setPermissions({
                        canView: false,
                        canCreate: false,
                        canUpdate: false,
                        canDelete: false,
                    });
                }
            } finally {
                if (!cancelled) {
                    setPermissionsLoaded(true);
                }
            }
        }

        loadPosPermissions();

        return () => {
            cancelled = true;
        };
    }, []);

    useEffect(() => {
        let cancelled = false;

        async function loadData() {
            try {
                const [pRes, cRes, wRes, aRes] = await Promise.all([
                    fetch("/api/products", { cache: "no-store" }),
                    fetch("/api/customers", { cache: "no-store" }),
                    fetch("/api/warehouses", { cache: "no-store" }),
                    fetch("/api/accounts", { cache: "no-store" }).catch(
                        () => null
                    ),
                ]);

                const [pData, cData, wData] = await Promise.all([
                    pRes.json(),
                    cRes.json(),
                    wRes.json(),
                ]);

                if (!pRes.ok || !cRes.ok || !wRes.ok) {
                    throw new Error(
                        "Could not load products, customers, or warehouses."
                    );
                }

                let accountRows = [];

                if (aRes?.ok) {
                    const aData = await aRes.json();

                    accountRows = rowsFrom(aData, "accounts").filter(
                        (account) =>
                            account.is_active === true &&
                            account.is_group === false &&
                            account.is_cash_bank === true
                    );
                }

                if (cancelled) return;

                const warehouseRows = rowsFrom(wData, "warehouses");

                setProducts(rowsFrom(pData, "products"));
                setCustomers(rowsFrom(cData, "customers"));
                setWarehouses(warehouseRows);
                setAccounts(accountRows);

                if (warehouseRows.length) {
                    setWarehouseId((current) =>
                        current || String(warehouseRows[0].warehouse_id)
                    );
                }
            } catch (err) {
                if (!cancelled) {
                    setError(err.message || "Failed to load POS data.");
                }
            } finally {
                if (!cancelled) setLoading(false);
            }
        }

        loadData();

        return () => {
            cancelled = true;
        };
    }, []);

    useEffect(() => {
        if (
            !showCashMovement &&
            !showHeldSales &&
            !showOrders &&
            !reviewingInvoice
        ) {
            barcodeRef.current?.focus();
        }
    }, [cart, showCashMovement, showHeldSales, showOrders, reviewingInvoice]);

    useEffect(() => {
        // No warehouse means there is no stock request to make.
        // Keep state updates inside async request callbacks.
        if (!warehouseId) return;

        let cancelled = false;

        async function loadStock() {
            try {
                const response = await fetch(
                    `/api/stock?warehouseId=${encodeURIComponent(warehouseId)}`,
                    { cache: "no-store" }
                );

                const data = await response.json();

                if (!response.ok) {
                    throw new Error(data.message || "Failed to load stock.");
                }

                if (!cancelled) {
                    setStock(rowsFrom(data, "stock"));
                }
            } catch (err) {
                if (!cancelled) {
                    console.error("Failed to load warehouse stock:", err);
                    setStock([]);
                    setError(
                        err.message || "Could not load warehouse stock."
                    );
                }
            }
        }

        loadStock();

        return () => {
            cancelled = true;
        };
    }, [warehouseId]);

    let cancelled = false;

    const selectedCustomer = customers.find(
        (customer) => String(customer.customer_id) === String(customerId)
    );

    const selectedWarehouse = warehouses.find(
        (warehouse) =>
            String(warehouse.warehouse_id) === String(warehouseId)
    );

    const availableProducts = useMemo(() => {
        const stockMap = new Map(
            stock.map((row) => [
                String(row.product_id),
                Number(row.warehouse_stock ?? row.quantity ?? 0),
            ])
        );

        const term = search.trim().toLowerCase();
        const result = [];

        for (const product of products) {
            if (product.is_active === false) continue;

            const parentStock =
                stockMap.get(String(product.product_id)) ?? 0;

            const productName = String(product.product_name || "");
            const productSku = String(product.sku || "");
            const category = String(product.category || "");
            const productBarcode = String(
                product.barcode ?? product.product_barcode ?? ""
            ).trim();

            const parentMatches =
                !term ||
                productName.toLowerCase().includes(term) ||
                productSku.toLowerCase().includes(term) ||
                category.toLowerCase().includes(term) ||
                productBarcode.toLowerCase().includes(term);

            if (parentMatches) {
                result.push({
                    ...product,
                    barcode: productBarcode,
                    sub_product_id: null,
                    display_name: productName,
                    display_sku: productSku,
                    display_unit: product.unit || "",
                    display_price: Number(product.sale_price || 0),
                    parent_stock: parentStock,
                    quantity: parentStock,
                    units_per_parent: 1,
                    is_sub_product: false,
                });
            }

            const subProducts =
                product.sub_products ||
                product.subProducts ||
                product.variants ||
                [];

            for (const sub of subProducts) {
                if (sub.is_active === false) continue;

                const conversion = Number(sub.units_per_parent || 0);

                if (!Number.isFinite(conversion) || conversion <= 0) {
                    continue;
                }

                const subName = String(
                    sub.sub_product_name ||
                    sub.variant_name ||
                    sub.name ||
                    ""
                );

                const subSku = String(sub.sku || sub.variant_sku || "");
                const subUnit = String(sub.unit || product.unit || "");

                const subBarcode = String(
                    sub.barcode ??
                    sub.variant_barcode ??
                    sub.sub_product_barcode ??
                    ""
                ).trim();

                const matches =
                    !term ||
                    parentMatches ||
                    subName.toLowerCase().includes(term) ||
                    subSku.toLowerCase().includes(term) ||
                    productName.toLowerCase().includes(term) ||
                    subBarcode.toLowerCase().includes(term);

                if (!matches) continue;

                result.push({
                    ...product,
                    barcode: subBarcode,
                    sub_product_id:
                        sub.sub_product_id ?? sub.variant_id ?? sub.id,
                    display_name: `${productName} — ${subName || "Sub-product"}`,
                    display_sku: subSku || productSku,
                    display_unit: subUnit,
                    display_price: Number(
                        sub.sale_price ??
                        sub.unit_price ??
                        product.sale_price ??
                        0
                    ),
                    parent_stock: parentStock,
                    quantity:
                        Math.floor(parentStock * conversion * 1000000) /
                        1000000,
                    units_per_parent: conversion,
                    is_sub_product: true,
                    sub_product_name: subName,
                });
            }
        }

        return result.filter((item) => {
            if (!term) return true;

            return (
                String(item.display_name || "").toLowerCase().includes(term) ||
                String(item.display_sku || "").toLowerCase().includes(term) ||
                String(item.barcode || "").toLowerCase().includes(term) ||
                String(item.category || "").toLowerCase().includes(term)
            );
        });
    }, [products, stock, search]);

    const subtotal = cart.reduce(
        (sum, item) =>
            sum + Number(item.quantity) * Number(item.unit_price),
        0
    );

    const totalQuantity = cart.reduce(
        (sum, item) => sum + Number(item.quantity || 0),
        0
    );

    const discountAmount = Math.max(0, Number(discount) || 0);
    const taxAmount = Math.max(0, Number(tax) || 0);
    const total = Math.max(0, subtotal - discountAmount + taxAmount);
    const receivedAmount = Math.max(0, Number(received) || 0);
    const changeDue = Math.max(0, receivedAmount - total);
    const balanceDue = Math.max(0, total - receivedAmount);

    function addToCart(product) {
        setError("");
        setMessage("");

        if (reviewingOrder) {
            setError("Exit order review before starting a new sale.");
            return;
        }

        if (Number(product.quantity) <= 0) {
            setError("This item has no available stock in this warehouse.");
            return;
        }

        const key = cartKey(product);

        setCart((current) => {
            const existing = current.find((item) => cartKey(item) === key);

            if (existing) {
                if (
                    existing.quantity + 1 >
                    Number(existing.available_quantity)
                ) {
                    setError("You cannot sell more than the available stock.");
                    return current;
                }

                return current.map((item) =>
                    cartKey(item) === key
                        ? { ...item, quantity: item.quantity + 1 }
                        : item
                );
            }

            return [
                ...current,
                {
                    product_id: product.product_id,
                    sub_product_id: product.sub_product_id ?? null,
                    product_name: product.product_name,
                    sub_product_name: product.sub_product_name || null,
                    display_name: product.display_name,
                    sku: product.display_sku,
                    barcode: product.barcode || "",
                    unit: product.display_unit,
                    unit_price: Number(product.display_price || 0),
                    quantity: 1,
                    available_quantity: Number(product.quantity || 0),
                    units_per_parent: Number(product.units_per_parent || 1),
                    is_sub_product: Boolean(product.is_sub_product),
                },
            ];
        });
    }

    function handleBarcodeScan(event) {
        event.preventDefault();

        const scannedBarcode = barcode.trim();

        if (!scannedBarcode) {
            barcodeRef.current?.focus();
            return;
        }

        setError("");
        setMessage("");

        if (reviewingOrder) {
            setError("Exit order review before scanning a new item.");
            setBarcode("");
            return;
        }

        const normalizedBarcode = scannedBarcode.toLowerCase();

        const matchedProduct = availableProducts.find((product) => {
            const productBarcode = String(product.barcode || "")
                .trim()
                .toLowerCase();

            return (
                productBarcode !== "" &&
                productBarcode === normalizedBarcode
            );
        });

        if (!matchedProduct) {
            setError(
                `No product found with barcode: ${scannedBarcode}. Check that the barcode is saved on the product or sub-product.`
            );
            setBarcode("");
            barcodeRef.current?.focus();
            return;
        }

        if (Number(matchedProduct.quantity) <= 0) {
            setError(
                `${matchedProduct.display_name} has no available stock in this warehouse.`
            );
            setBarcode("");
            barcodeRef.current?.focus();
            return;
        }

        addToCart(matchedProduct);
        setBarcode("");
    }

    function changeQuantity(itemKey, value) {
        const quantity = Number(value);

        if (!Number.isFinite(quantity) || quantity <= 0) return;

        setCart((current) =>
            current.map((item) =>
                cartKey(item) === itemKey
                    ? {
                        ...item,
                        quantity: Math.min(
                            quantity,
                            Number(item.available_quantity)
                        ),
                    }
                    : item
            )
        );
    }

    function removeCartItem(itemKey) {
        setCart((current) =>
            current.filter((item) => cartKey(item) !== itemKey)
        );
    }

    function clearCart() {
        setCart([]);
        setDiscount("0");
        setTax("0");
        setReceived("0");
        setReviewingOrder(false);
        setError("");
        setMessage("");
        setBarcode("");
    }

    function holdSale() {

        if (!permissions.canCreate) {
    setError("You do not have permission to create or hold POS sales.");
    return;
}
        setError("");
        setMessage("");

        if (reviewingOrder) {
            setError("Exit order review before holding a new sale.");
            return;
        }

        if (!cart.length) {
            setError("Add at least one item before holding a sale.");
            return;
        }

        if (!customerId) {
            setError("Select a customer before holding this sale.");
            return;
        }

        if (!warehouseId) {
            setError("Select a warehouse before holding this sale.");
            return;
        }

        const heldSale = {
            id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
            customerId,
            customerName: selectedCustomer?.customer_name || "Customer",
            warehouseId,
            warehouseName: selectedWarehouse?.warehouse_name || "Warehouse",
            accountId,
            cart: cart.map((item) => ({ ...item })),
            discount,
            tax,
            received,
            createdAt: new Date().toISOString(),
        };

        setHeldSales((current) => [heldSale, ...current]);
        setCart([]);
        setCustomerId("");
        setDiscount("0");
        setTax("0");
        setReceived("0");
        setAccountId("");
        setSearch("");
        setBarcode("");
        setReviewingOrder(false);
        setMessage(`Sale held for ${heldSale.customerName}.`);
    }

    function resumeHeldSale(heldSaleId) {
        setError("");
        setMessage("");

        if (cart.length) {
            setError(
                "Hold or clear the current sale before resuming another."
            );
            return;
        }

        const sale = heldSales.find((item) => item.id === heldSaleId);

        if (!sale) {
            setError("This held sale could not be found.");
            return;
        }

        setCustomerId(sale.customerId);
        setWarehouseId(sale.warehouseId);
        setAccountId(sale.accountId || "");
        setCart(sale.cart.map((item) => ({ ...item })));
        setDiscount(sale.discount);
        setTax(sale.tax);
        setReceived(sale.received);
        setSearch("");
        setBarcode("");
        setReviewingOrder(false);

        setHeldSales((current) =>
            current.filter((item) => item.id !== heldSaleId)
        );

        setShowHeldSales(false);
        setMessage(`Sale for ${sale.customerName} restored.`);
    }

    function removeHeldSale(heldSaleId) {
        if (!permissions.canDelete) {
    setError("You do not have permission to delete held sales.");
    return;
}
        setHeldSales((current) =>
            current.filter((item) => item.id !== heldSaleId)
        );

        setMessage("Held sale removed.");
        setError("");
    }

    async function loadOrders() {
        setError("");
        setMessage("");

        try {
            const response = await fetch("/api/sales-invoices", {
                cache: "no-store",
            });

            const data = await response.json();

            if (!response.ok || data.success === false) {
                throw new Error(data.message || "Could not load orders.");
            }

            setOrders(rowsFrom(data, "invoices"));
            setShowOrders(true);
            setShowHeldSales(false);
            setReviewingInvoice(null);
        } catch (err) {
            setError(err.message || "Could not load orders.");
        }
    }

    async function editOrder(order) {
        if (!permissions.canView) {
    setError("You do not have permission to view POS invoices.");
    return;
}
        setError("");
        setMessage("");
        setLoadingInvoice(true);

        try {
            const response = await fetch(
                `/api/sales-invoices/${encodeURIComponent(order.invoice_id)}`,
                { cache: "no-store" }
            );

            const data = await response.json();

            if (!response.ok || data.success === false) {
                throw new Error(data.message || "Could not load this invoice.");
            }

            const invoice = data.invoice || order;
            const items = Array.isArray(data.items)
                ? data.items
                : Array.isArray(invoice.items)
                    ? invoice.items
                    : [];

            setReviewingInvoice({ invoice, items });
            setShowOrders(false);
            setShowHeldSales(false);
        } catch (err) {
            setError(err.message || "Could not load invoice.");
        } finally {
            setLoadingInvoice(false);
        }
    }

    function printInvoice() {
        if (reviewingInvoice) window.print();
    }

    function downloadInvoicePdf() {
        if (reviewingInvoice) window.print();
    }

    async function checkout() {

        if (!permissions.canCreate) {
    setError("You do not have permission to create POS invoices.");
    return;
}
        setError("");
        setMessage("");

        if (reviewingOrder) {
            setError(
                "This saved order is in review mode only. Exit review before creating a new sale."
            );
            return;
        }

        if (!customerId) {
            setError("Please select a customer.");
            return;
        }

        if (!warehouseId) {
            setError("Please select a warehouse.");
            return;
        }

        if (!cart.length) {
            setError("Please add at least one item.");
            return;
        }

        const receivedValue = Number(received);
        const discountValue = Number(discount);
        const taxValue = Number(tax);

        if (
            received.trim() === "" ||
            !Number.isFinite(receivedValue) ||
            receivedValue < 0
        ) {
            setError("Received amount must be a valid non-negative amount.");
            return;
        }

        if (
            discount.trim() === "" ||
            tax.trim() === "" ||
            !Number.isFinite(discountValue) ||
            !Number.isFinite(taxValue) ||
            discountValue < 0 ||
            taxValue < 0
        ) {
            setError("Discount and tax must be valid non-negative amounts.");
            return;
        }

        if (discountValue > subtotal) {
            setError("Discount cannot exceed the subtotal.");
            return;
        }

        if (receivedValue > 0 && !accountId) {
            setError(
                "Select a Cash/Bank account before recording the received payment."
            );
            return;
        }

        if (
            receivedValue > 0 &&
            !accounts.some(
                (account) =>
                    String(account.account_id) === String(accountId) &&
                    account.is_active === true &&
                    account.is_group === false &&
                    account.is_cash_bank === true
            )
        ) {
            setError(
                "The selected Cash/Bank account is invalid or inactive. Please select another account."
            );
            return;
        }

        setCheckingOut(true);

        try {
            const response = await fetch("/api/pos", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    customerId: Number(customerId),
                    warehouseId: Number(warehouseId),
                    invoiceDate: todayLocal(),
                    discount: discountValue,
                    tax: taxValue,
                    notes: "Created from POS",
                    receivedAmount: receivedValue,
                    accountId: receivedValue > 0 ? Number(accountId) : null,
                    paymentMethod: "CASH",
                    referenceNumber: null,
                    items: cart.map((item) => ({
                        productId: Number(item.product_id),
                        subProductId:
                            item.sub_product_id != null
                                ? Number(item.sub_product_id)
                                : null,
                        quantity: Number(item.quantity),
                        unitPrice: Number(item.unit_price),
                        discount: 0,
                        tax: 0,
                    })),
                }),
            });

            const data = await response.json();

            if (!response.ok || data.success === false) {
                throw new Error(
                    data.message || data.error || "Checkout failed."
                );
            }

            const invoice = data.invoice || {};
            const recordedPayment = Number(
                data.payment?.amount ?? data.receivedAmount ?? 0
            );
            const returnedChange = Number(
                data.changeAmount ?? Math.max(0, receivedValue - total)
            );
            const remainingBalance = Number(
                invoice.balance_amount ?? Math.max(0, total - recordedPayment)
            );

            const invoiceNumber =
                invoice.invoice_number || invoice.invoice_id || "created";

            setMessage(
                `Invoice ${invoiceNumber} created successfully.` +
                (recordedPayment > 0
                    ? ` Payment recorded: Rs. ${money(recordedPayment)}.`
                    : " No payment was recorded.") +
                (returnedChange > 0
                    ? ` Change to return: Rs. ${money(returnedChange)}.`
                    : "") +
                (remainingBalance > 0
                    ? ` Remaining due: Rs. ${money(remainingBalance)}.`
                    : "")
            );

            setCart([]);
            setDiscount("0");
            setTax("0");
            setReceived("0");
            setCustomerId("");
            setAccountId("");
            setSearch("");
            setBarcode("");
            setReviewingOrder(false);

            const stockResponse = await fetch(
                `/api/stock?warehouseId=${encodeURIComponent(warehouseId)}`,
                { cache: "no-store" }
            );

            if (stockResponse.ok) {
                const stockData = await stockResponse.json();
                setStock(rowsFrom(stockData, "stock"));
            }
        } catch (err) {
            setError(err.message || "Could not complete the sale.");
        } finally {
            setCheckingOut(false);
        }
    }

    async function openCashMovement(type) {

        if (!permissions.canCreate) {
    setError("You do not have permission to create cash movements.");
    return;
}
        setError("");
        setMessage("");
        setCashMovementType(type);
        setCashAmount("");
        setCashDate(todayLocal());
        setCashReference("");
        setCashDescription("");
        setCashAccountId("");
        setCounterAccountId("");
        setShowCashMovement(true);
        setShowOrders(false);
        setShowHeldSales(false);
        setLoadingCashAccounts(true);

        try {
            const response = await fetch("/api/cash-movements", {
                cache: "no-store",
            });

            const data = await response.json();

            if (!response.ok || data.success === false) {
                throw new Error(
                    data.error || "Could not load cash/bank accounts."
                );
            }

            const cashRows = data.cashAccounts || [];
            const counterRows = data.counterAccounts || [];

            setCashAccounts(cashRows);
            setCounterAccounts(counterRows);

            const preferred = cashRows.find(
                (account) => String(account.account_id) === String(accountId)
            );

            setCashAccountId(
                String(preferred?.account_id || cashRows[0]?.account_id || "")
            );

            setCounterAccountId(String(counterRows[0]?.account_id || ""));
        } catch (err) {
            setError(err.message || "Could not load cash/bank accounts.");
        } finally {
            setLoadingCashAccounts(false);
        }
    }

    async function submitCashMovement(event) {
        event.preventDefault();
        setError("");
        setMessage("");

        if (!cashAccountId) {
            setError("Select a cash or bank account.");
            return;
        }

        if (!counterAccountId) {
            setError("Select a counter account.");
            return;
        }

        if (
            !cashAmount ||
            !Number.isFinite(Number(cashAmount)) ||
            Number(cashAmount) <= 0
        ) {
            setError("Enter an amount greater than zero.");
            return;
        }

        if (!cashDate) {
            setError("Select a transaction date.");
            return;
        }

        if (!cashDescription.trim()) {
            setError("Enter a transaction description.");
            return;
        }

        setSavingCashMovement(true);

        try {
            const response = await fetch("/api/cash-movements", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    accountId: Number(cashAccountId),
                    counterAccountId: Number(counterAccountId),
                    transactionType: cashMovementType,
                    amount: Number(cashAmount),
                    date: cashDate,
                    referenceNumber: cashReference.trim(),
                    description: cashDescription.trim(),
                }),
            });

            const data = await response.json();

            if (!response.ok || data.success === false) {
                throw new Error(
                    data.error ||
                    data.message ||
                    "Could not save transaction."
                );
            }

            setShowCashMovement(false);

            setMessage(
                `${data.message || "Transaction recorded successfully."} ${data.journalNumber || data.journalId
                    ? `Journal: ${data.journalNumber || data.journalId}`
                    : ""
                }`
            );
        } catch (err) {
            setError(err.message || "Could not save cash movement.");
        } finally {
            setSavingCashMovement(false);
        }
    }

    const invoice = reviewingInvoice?.invoice;
    const invoiceItems = reviewingInvoice?.items || [];

    const invoiceSubtotal =
        Number(invoice?.subtotal ?? invoice?.subtotal_amount ?? 0) ||
        invoiceItems.reduce(
            (sum, item) =>
                sum +
                Number(item.quantity || 0) *
                Number(item.unit_price ?? item.unitPrice ?? 0),
            0
        );

    const invoiceDiscount = Number(
        invoice?.discount_amount ?? invoice?.discount ?? 0
    );

    const invoiceTax = Number(invoice?.tax_amount ?? invoice?.tax ?? 0);

    const invoiceTotal = Number(
        invoice?.total_amount ??
        invoice?.grand_total ??
        invoiceSubtotal - invoiceDiscount + invoiceTax
    );

    const invoicePaid = Number(
        invoice?.paid_amount ?? invoice?.received_amount ?? 0
    );

    const invoiceBalance = Number(
        invoice?.balance_amount ?? Math.max(0, invoiceTotal - invoicePaid)
    );

    if (!permissionsLoaded || loading) {
        return (
            <div className="flex min-h-[70vh] items-center justify-center bg-slate-50 p-6">
                <div className="text-center">
                    <div className="mx-auto flex h-16 w-16 animate-pulse items-center justify-center rounded-2xl bg-indigo-100 text-indigo-600">
                        <ShoppingCart size={30} />
                    </div>
                    <h2 className="mt-5 text-lg font-extrabold text-slate-900">
                        Preparing your POS
                    </h2>
                    <p className="mt-2 text-sm text-slate-500">
                        Checking access and loading POS data...
                    </p>
                </div>
            </div>
        );
    }

    if (!permissions.canView) {
        return (
            <div className="flex min-h-[70vh] items-center justify-center bg-slate-50 p-6">
                <div className="max-w-md rounded-2xl border border-rose-200 bg-white p-8 text-center shadow-sm">
                    <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-rose-50 text-rose-600">
                        <LockKeyhole size={26} />
                    </div>
                    <h2 className="mt-4 text-xl font-extrabold text-slate-900">
                        Access Denied
                    </h2>
                    <p className="mt-2 text-sm leading-6 text-slate-600">
                        You do not have View permission for Point of Sale.
                        Contact your administrator to request access.
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div
            data-pos-page
            className="min-h-screen bg-slate-50 p-3 text-slate-900 sm:p-5 lg:p-7"
        >
            <style jsx global>{`
                @keyframes pos-fade-up {
                    from {
                        opacity: 0;
                        transform: translateY(8px);
                    }
                    to {
                        opacity: 1;
                        transform: translateY(0);
                    }
                }

                .pos-animate {
                    animation: pos-fade-up 0.25s ease-out both;
                }

                @media print {
                    body * {
                        visibility: hidden !important;
                    }

                    #pos-invoice-print,
                    #pos-invoice-print * {
                        visibility: visible !important;
                    }

                    #pos-invoice-print {
                        position: absolute !important;
                        left: 0 !important;
                        top: 0 !important;
                        width: 100% !important;
                        max-width: none !important;
                        margin: 0 !important;
                        padding: 20px !important;
                        border: none !important;
                        box-shadow: none !important;
                        overflow: visible !important;
                        background: white !important;
                        color: #111827 !important;
                    }

                    .invoice-no-print {
                        display: none !important;
                    }

                    table {
                        width: 100% !important;
                        border-collapse: collapse !important;
                    }

                    th,
                    td {
                        border: 1px solid #d1d5db !important;
                        padding: 8px !important;
                        text-align: left !important;
                    }

                    thead {
                        display: table-header-group;
                    }

                    tr {
                        page-break-inside: avoid;
                    }
                }
            `}</style>

            <div className="mx-auto max-w-[1600px]">
                {/* Header */}
                <header className="pos-animate relative mb-6 overflow-hidden rounded-2xl bg-gradient-to-br from-slate-950 via-indigo-950 to-indigo-800 p-5 text-white shadow-xl shadow-indigo-950/10 sm:p-7">
                    <div className="pointer-events-none absolute -right-16 -top-24 h-64 w-64 rounded-full border-[35px] border-white/[0.06]" />
                    <div className="pointer-events-none absolute -bottom-28 right-1/4 h-64 w-64 rounded-full bg-indigo-400/10 blur-3xl" />

                    <div className="relative flex flex-col justify-between gap-6 xl:flex-row xl:items-center">
                        <div>
                            <div className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.2em] text-indigo-200">
                                <Sparkles size={15} />
                                Sales workspace
                            </div>

                            <h1 className="text-3xl font-black tracking-tight sm:text-4xl">
                                Point of Sale
                            </h1>

                            <p className="mt-2 max-w-xl text-sm leading-6 text-indigo-100/80">
                                A smarter checkout experience for managing
                                products, inventory, payments and customer
                                invoices.
                            </p>

                            <div className="mt-4 flex flex-wrap gap-2">
                                <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/10 px-3 py-1.5 text-xs font-semibold text-indigo-50">
                                    <span className="h-2 w-2 rounded-full bg-emerald-400" />
                                    POS ready
                                </span>

                                <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/10 px-3 py-1.5 text-xs font-semibold text-indigo-50">
                                    <Warehouse size={13} />
                                    {selectedWarehouse?.warehouse_name ||
                                        "No warehouse selected"}
                                </span>
                            </div>
                        </div>

                        <div className="flex flex-wrap gap-2">
                            {permissions.canCreate && (
                                <>
                                    <button
                                        type="button"
                                        onClick={() => openCashMovement("RECEIPT")}
                                        className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-500 px-4 py-3 text-sm font-bold text-white shadow-lg transition hover:bg-emerald-400"
                                    >
                                        <ArrowDownLeft size={17} />
                                        Cash In
                                    </button>

                                    <button
                                        type="button"
                                        onClick={() => openCashMovement("PAYMENT")}
                                        className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/15 bg-white/10 px-4 py-3 text-sm font-bold text-white transition hover:bg-white/20"
                                    >
                                        <ArrowUpRight size={17} />
                                        Cash Out
                                    </button>

                                    <button
                                        type="button"
                                        onClick={holdSale}
                                        disabled={
                                            checkingOut || !cart.length || reviewingOrder
                                        }
                                        className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/15 bg-white/10 px-4 py-3 text-sm font-bold text-white transition hover:bg-white/20 disabled:opacity-40"
                                    >
                                        <Clock size={17} />
                                        Hold ({heldSales.length})
                                    </button>
                                </>
                            )}
                        </div>
                    </div>
                </header>

                {/* Notifications */}
                {error && (
                    <div
                        role="alert"
                        className="pos-animate mb-4 flex items-start gap-3 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800"
                    >
                        <AlertCircle className="mt-0.5 shrink-0" size={19} />
                        <div className="min-w-0 flex-1">{error}</div>
                        <button
                            type="button"
                            onClick={() => setError("")}
                            className="shrink-0 text-rose-500 hover:text-rose-800"
                            aria-label="Dismiss error"
                        >
                            <X size={18} />
                        </button>
                    </div>
                )}

                {message && (
                    <div
                        role="status"
                        className="pos-animate mb-4 flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800"
                    >
                        <CheckCircle2 className="mt-0.5 shrink-0" size={19} />
                        <div className="min-w-0 flex-1">{message}</div>
                        <button
                            type="button"
                            onClick={() => setMessage("")}
                            className="shrink-0 text-emerald-600 hover:text-emerald-900"
                            aria-label="Dismiss notification"
                        >
                            <X size={18} />
                        </button>
                    </div>
                )}

                {reviewingOrder && (
                    <div className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4">
                        <div className="flex items-center gap-3">
                            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-100 text-amber-700">
                                <Eye size={20} />
                            </div>
                            <div>
                                <p className="font-bold text-amber-950">
                                    Order review mode
                                </p>
                                <p className="text-xs text-amber-800">
                                    This order is read-only. Changes are not
                                    saved.
                                </p>
                            </div>
                        </div>

                        <button
                            type="button"
                            onClick={clearCart}
                            className="rounded-lg border border-amber-300 bg-white px-4 py-2 text-sm font-bold text-amber-900 hover:bg-amber-100"
                        >
                            Exit review
                        </button>
                    </div>
                )}

                {/* Summary cards */}
                <div className="mb-6 grid grid-cols-2 gap-3 xl:grid-cols-4">
                    <SummaryCard
                        icon={Package}
                        label="Products"
                        value={products.length}
                        detail="Product master records"
                        color="indigo"
                    />
                    <SummaryCard
                        icon={UserRound}
                        label="Customers"
                        value={customers.length}
                        detail="Registered customers"
                        color="emerald"
                    />
                    <SummaryCard
                        icon={ShoppingBag}
                        label="Cart items"
                        value={cart.length}
                        detail={`${totalQuantity} total units`}
                        color="violet"
                    />
                    <SummaryCard
                        icon={CircleDollarSign}
                        label="Current total"
                        value={`Rs. ${money(total)}`}
                        detail="Current sale amount"
                        color="amber"
                    />
                </div>

                {/* Quick actions */}
                <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
                    <button
                        type="button"
                        onClick={() => {
                            setShowHeldSales(true);
                            setShowOrders(false);
                            setShowCashMovement(false);
                            setError("");
                        }}
                        className={`${panelClass} flex items-center gap-3 p-4 text-left transition hover:border-violet-200 hover:shadow-md`}
                    >
                        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-violet-50 text-violet-600">
                            <Archive size={21} />
                        </div>
                        <div className="min-w-0 flex-1">
                            <p className="font-bold text-slate-900">
                                Held Sales
                            </p>
                            <p className="mt-1 text-xs text-slate-500">
                                {heldSales.length} saved in this session
                            </p>
                        </div>
                        <ArrowRight size={18} className="text-slate-400" />
                    </button>

                    <button
                        type="button"
                        onClick={loadOrders}
                        className={`${panelClass} flex items-center gap-3 p-4 text-left transition hover:border-blue-200 hover:shadow-md`}
                    >
                        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
                            <Receipt size={21} />
                        </div>
                        <div className="min-w-0 flex-1">
                            <p className="font-bold text-slate-900">
                                View Orders
                            </p>
                            <p className="mt-1 text-xs text-slate-500">
                                Review invoices and print receipts
                            </p>
                        </div>
                        <ArrowRight size={18} className="text-slate-400" />
                    </button>

                    <button
                        type="button"
                        onClick={() => {
                            setError("");
                            setMessage("");
                            setBarcode("");
                            barcodeRef.current?.focus();
                        }}
                        className={`${panelClass} flex items-center gap-3 p-4 text-left transition hover:border-emerald-200 hover:shadow-md`}
                    >
                        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
                            <ScanLine size={21} />
                        </div>
                        <div className="min-w-0 flex-1">
                            <p className="font-bold text-slate-900">
                                Quick Scan
                            </p>
                            <p className="mt-1 text-xs text-slate-500">
                                Focus barcode scanner input
                            </p>
                        </div>
                        <ArrowRight size={18} className="text-slate-400" />
                    </button>
                </div>

                {/* Customer and warehouse */}
                <section className={`${panelClass} mb-6 p-4 sm:p-6`}>
                    <SectionHeading
                        icon={UserRound}
                        title="Sale Information"
                        subtitle="Choose the customer, stock location and payment account."
                    />

                    <div className="grid gap-5 lg:grid-cols-3">
                        <div>
                            <label className={labelClass}>Customer *</label>
                            <div className="relative">
                                <UserRound
                                    size={17}
                                    className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
                                />
                                <select
                                    value={customerId}
                                    onChange={(event) =>
                                        setCustomerId(event.target.value)
                                    }
                                    className={`${inputClass} appearance-none pl-10 pr-10`}
                                >
                                    <option value="">Select customer</option>
                                    {customers.map((customer) => (
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
                                <ChevronDown
                                    size={16}
                                    className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400"
                                />
                            </div>

                            <div className="mt-3 grid grid-cols-2 gap-3">
                                <div className="rounded-xl bg-slate-50 p-3">
                                    <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                                        Customer name
                                    </p>
                                    <p className="mt-1 truncate text-sm font-semibold text-slate-800">
                                        {selectedCustomer?.customer_name ||
                                            "Not selected"}
                                    </p>
                                </div>
                                <div className="rounded-xl bg-slate-50 p-3">
                                    <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                                        Phone number
                                    </p>
                                    <p className="mt-1 truncate text-sm font-semibold text-slate-800">
                                        {selectedCustomer?.phone || "—"}
                                    </p>
                                </div>
                            </div>
                        </div>

                        <div>
                            <label className={labelClass}>Warehouse *</label>
                            <div className="relative">
                                <Warehouse
                                    size={17}
                                    className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
                                />
                                <select
                                    value={warehouseId}
                                    onChange={(event) => {
                                        setWarehouseId(event.target.value);
                                        setError("");
                                    }}
                                    className={`${inputClass} appearance-none pl-10 pr-10`}
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
                                <ChevronDown
                                    size={16}
                                    className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400"
                                />
                            </div>

                            <div className="mt-3 rounded-xl border border-indigo-100 bg-indigo-50/70 p-3">
                                <div className="flex items-center gap-2 text-indigo-700">
                                    <Boxes size={17} />
                                    <span className="text-xs font-bold uppercase tracking-wider">
                                        Inventory source
                                    </span>
                                </div>
                                <p className="mt-1.5 text-sm font-bold text-indigo-950">
                                    {selectedWarehouse?.warehouse_name ||
                                        "Select a warehouse"}
                                </p>
                                <p className="mt-1 text-xs text-indigo-700/80">
                                    Available stock is shown for this warehouse.
                                </p>
                            </div>
                        </div>

                        <div>
                            <label className={labelClass}>
                                Cash / Bank Account
                            </label>
                            <div className="relative">
                                <Wallet
                                    size={17}
                                    className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
                                />
                                <select
                                    value={accountId}
                                    onChange={(event) =>
                                        setAccountId(event.target.value)
                                    }
                                    className={`${inputClass} appearance-none pl-10 pr-10`}
                                >
                                    <option value="">
                                        Select Cash/Bank account
                                    </option>
                                    {accounts.map((account) => (
                                        <option
                                            key={account.account_id}
                                            value={account.account_id}
                                        >
                                            {account.account_code} -{" "}
                                            {account.account_name}
                                        </option>
                                    ))}
                                </select>
                                <ChevronDown
                                    size={16}
                                    className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400"
                                />
                            </div>

                            {!accounts.length && (
                                <p className="mt-2 flex items-center gap-1.5 text-xs text-amber-700">
                                    <AlertCircle size={14} />
                                    No active Cash/Bank accounts found.
                                </p>
                            )}

                            <div className="mt-3 rounded-xl border border-slate-200 p-3">
                                <div className="flex items-center gap-2 text-slate-600">
                                    <CreditCard size={17} />
                                    <span className="text-xs font-bold uppercase tracking-wider">
                                        Payment settings
                                    </span>
                                </div>
                                <p className="mt-1.5 text-sm text-slate-700">
                                    Cash payment
                                </p>
                                <p className="mt-1 text-xs text-slate-500">
                                    Required when the received amount is greater
                                    than zero.
                                </p>
                            </div>
                        </div>
                    </div>
                </section>

                {/* Main POS layout */}
                <div className="grid items-start gap-5 xl:grid-cols-12">
                    {/* Product catalog */}
                    <section className={`${panelClass} min-w-0 p-4 sm:p-6 xl:col-span-7`}>
                        <SectionHeading
                            icon={Boxes}
                            title="Product Catalog"
                            subtitle="Scan a barcode or search the catalog to add products."
                            action={
                                <span className="rounded-lg bg-indigo-50 px-3 py-1.5 text-xs font-bold text-indigo-700">
                                    {availableProducts.length} results
                                </span>
                            }
                        />

                        <div className="mb-4 rounded-2xl border border-indigo-100 bg-gradient-to-br from-indigo-50/80 to-white p-3 sm:p-4">
                            <div className="mb-3 flex items-center gap-2">
                                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-600 text-white">
                                    <Barcode size={20} />
                                </div>
                                <div>
                                    <p className="text-sm font-extrabold text-slate-900">
                                        Barcode Scanner
                                    </p>
                                    <p className="text-xs text-slate-500">
                                        Press Enter to add a matching item
                                    </p>
                                </div>
                            </div>

                            <form
                                onSubmit={handleBarcodeScan}
                                className="flex flex-col gap-2 sm:flex-row"
                            >
                                <input
                                    ref={barcodeRef}
                                    type="text"
                                    value={barcode}
                                    onChange={(event) =>
                                        setBarcode(event.target.value)
                                    }
                                    placeholder="Scan or type barcode..."
                                    autoComplete="off"
                                    autoCapitalize="off"
                                    spellCheck={false}
                                    disabled={reviewingOrder}
                                    className={`${inputClass} min-w-0 flex-1 border-indigo-100 bg-white`}
                                    aria-label="Product barcode"
                                />
                                <button
                                    type="submit"
                                    disabled={
                                        reviewingOrder || !barcode.trim()
                                    }
                                    className={buttonPrimary}
                                >
                                    <ScanLine size={17} />
                                    Scan / Add
                                </button>
                            </form>
                        </div>

                        <div className="relative mb-4">
                            <Search
                                size={18}
                                className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
                            />
                            <input
                                value={search}
                                onChange={(event) =>
                                    setSearch(event.target.value)
                                }
                                placeholder="Search product, SKU, category or barcode..."
                                className={`${inputClass} pl-10`}
                            />
                            {search && (
                                <button
                                    type="button"
                                    onClick={() => setSearch("")}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700"
                                    aria-label="Clear search"
                                >
                                    <X size={16} />
                                </button>
                            )}
                        </div>

                        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                            <p className="text-xs font-bold uppercase tracking-wider text-slate-500">
                                Available items
                            </p>
                            <span className="inline-flex items-center gap-1.5 text-xs text-slate-500">
                                <span className="h-2 w-2 rounded-full bg-emerald-500" />
                                Stock by selected warehouse
                            </span>
                        </div>

                        <div className="grid gap-3 sm:grid-cols-2 2xl:grid-cols-3">
                            {availableProducts.map((product) => {
                                const inCart = cart.find(
                                    (item) =>
                                        cartKey(item) === cartKey(product)
                                );

                                const inStock = Number(product.quantity) > 0;

                                return (
                                    <button
                                        type="button"
                                        key={cartKey(product)}
                                        onClick={() => addToCart(product)}
                                        disabled={
                                            !inStock ||
                                            reviewingOrder ||
                                            (inCart &&
                                                inCart.quantity >=
                                                inCart.available_quantity)
                                        }
                                        className="group relative flex min-w-0 flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white p-4 text-left transition duration-200 hover:-translate-y-0.5 hover:border-indigo-300 hover:shadow-lg hover:shadow-indigo-950/5 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:hover:translate-y-0 disabled:hover:shadow-none"
                                    >
                                        <div className="mb-3 flex w-full items-start justify-between gap-2">
                                            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-50 to-violet-100 text-indigo-600 transition group-hover:from-indigo-100 group-hover:to-violet-200">
                                                {product.is_sub_product ? (
                                                    <Layers3 size={22} />
                                                ) : (
                                                    <Package size={22} />
                                                )}
                                            </div>

                                            <span
                                                className={`max-w-[55%] truncate rounded-lg px-2 py-1 text-[10px] font-bold ${inStock
                                                    ? "bg-emerald-50 text-emerald-700"
                                                    : "bg-rose-50 text-rose-700"
                                                    }`}
                                            >
                                                {inStock
                                                    ? "IN STOCK"
                                                    : "OUT OF STOCK"}
                                            </span>
                                        </div>

                                        <p className="line-clamp-2 min-h-[42px] w-full break-words text-sm font-extrabold leading-5 text-slate-900">
                                            {product.display_name}
                                        </p>

                                        <p className="mt-1 w-full truncate text-xs text-slate-500">
                                            SKU: {product.display_sku || "—"}
                                        </p>

                                        {product.barcode && (
                                            <p className="mt-1 w-full truncate text-xs text-slate-400">
                                                Barcode: {product.barcode}
                                            </p>
                                        )}

                                        {product.is_sub_product && (
                                            <span className="mt-2 inline-flex w-fit max-w-full items-center gap-1 rounded-md bg-violet-50 px-2 py-1 text-[10px] font-bold text-violet-700">
                                                <Layers3 size={11} />
                                                Sub-product
                                            </span>
                                        )}

                                        <div className="mt-4 flex w-full items-end justify-between gap-2">
                                            <div className="min-w-0">
                                                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                                                    Sale price
                                                </p>
                                                <p className="mt-1 break-words text-base font-black text-indigo-700">
                                                    Rs. {money(product.display_price)}
                                                </p>
                                            </div>

                                            <div className="text-right">
                                                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                                                    Available
                                                </p>
                                                <p className="mt-1 text-sm font-bold text-slate-800">
                                                    {product.quantity}{" "}
                                                    {product.display_unit}
                                                </p>
                                            </div>
                                        </div>

                                        {product.is_sub_product && (
                                            <p className="mt-2 text-[11px] text-slate-500">
                                                {product.units_per_parent}{" "}
                                                {product.display_unit} per
                                                parent unit
                                            </p>
                                        )}

                                        <div
                                            className={`mt-4 flex items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-xs font-bold transition ${inStock &&
                                                !reviewingOrder &&
                                                (!inCart ||
                                                    inCart.quantity <
                                                    inCart.available_quantity)
                                                ? "bg-slate-900 text-white group-hover:bg-indigo-600"
                                                : "bg-slate-100 text-slate-400"
                                                }`}
                                        >
                                            <Plus size={15} />
                                            {inCart
                                                ? `In cart: ${inCart.quantity}`
                                                : inStock
                                                    ? "Add to cart"
                                                    : "Unavailable"}
                                        </div>
                                    </button>
                                );
                            })}
                        </div>

                        {!availableProducts.length && (
                            <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-5 py-14 text-center">
                                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-white text-slate-400 shadow-sm">
                                    <Search size={25} />
                                </div>
                                <h3 className="mt-4 font-bold text-slate-800">
                                    No products found
                                </h3>
                                <p className="mt-1 text-sm text-slate-500">
                                    Try another search or choose a warehouse
                                    with available stock.
                                </p>
                                {search && (
                                    <button
                                        type="button"
                                        onClick={() => setSearch("")}
                                        className="mt-4 text-sm font-bold text-indigo-600 hover:text-indigo-800"
                                    >
                                        Clear search
                                    </button>
                                )}
                            </div>
                        )}
                    </section>

                    {/* Checkout panel */}
                    <section className={`${panelClass} min-w-0 overflow-hidden xl:sticky xl:top-5 xl:col-span-5`}>
                        <div className="border-b border-slate-100 bg-gradient-to-r from-slate-50 to-white p-4 sm:p-5">
                            <div className="flex items-center justify-between gap-3">
                                <div className="flex items-center gap-3">
                                    <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-indigo-600 text-white shadow-md shadow-indigo-600/20">
                                        <ShoppingCart size={21} />
                                    </div>
                                    <div>
                                        <h2 className="text-lg font-extrabold tracking-tight text-slate-900">
                                            Current Sale
                                        </h2>
                                        <p className="mt-0.5 text-xs text-slate-500">
                                            {cart.length} distinct items
                                        </p>
                                    </div>
                                </div>

                                <button
                                    type="button"
                                    onClick={clearCart}
                                    disabled={checkingOut || !cart.length}
                                    className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-bold text-rose-600 transition hover:bg-rose-50 disabled:opacity-40"
                                >
                                    <Trash2 size={14} />
                                    Clear
                                </button>
                            </div>
                        </div>

                        <div className="max-h-[420px] min-h-[160px] space-y-3 overflow-y-auto p-4 sm:p-5">
                            {cart.map((item) => {
                                const key = cartKey(item);

                                return (
                                    <div
                                        key={key}
                                        className="rounded-xl border border-slate-200 p-3 transition hover:border-slate-300 sm:p-4"
                                    >
                                        <div className="flex items-start gap-3">
                                            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-500">
                                                {item.is_sub_product ? (
                                                    <Layers3 size={19} />
                                                ) : (
                                                    <Package size={19} />
                                                )}
                                            </div>

                                            <div className="min-w-0 flex-1">
                                                <p className="break-words text-sm font-bold leading-5 text-slate-900">
                                                    {item.display_name ||
                                                        item.product_name}
                                                </p>
                                                <p className="mt-1 truncate text-xs text-slate-500">
                                                    {item.sku || "No SKU"}
                                                    {item.barcode
                                                        ? ` · ${item.barcode}`
                                                        : ""}
                                                </p>
                                                <p className="mt-1 text-xs font-medium text-indigo-600">
                                                    Rs. {money(item.unit_price)}{" "}
                                                    / {item.unit || "unit"}
                                                </p>
                                            </div>

                                            <button
                                                type="button"
                                                onClick={() =>
                                                    removeCartItem(key)
                                                }
                                                className={buttonIcon}
                                                aria-label={`Remove ${item.display_name}`}
                                            >
                                                <Trash2 size={16} />
                                            </button>
                                        </div>

                                        <div className="mt-3 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-3">
                                            <div className="flex items-center gap-2">
                                                <span className="text-xs font-semibold text-slate-500">
                                                    Qty
                                                </span>
                                                <input
                                                    aria-label={`Quantity for ${item.display_name ||
                                                        item.product_name
                                                        }`}
                                                    type="number"
                                                    min="0.001"
                                                    step="any"
                                                    max={item.available_quantity}
                                                    value={item.quantity}
                                                    onChange={(event) =>
                                                        changeQuantity(
                                                            key,
                                                            event.target.value
                                                        )
                                                    }
                                                    className="w-24 rounded-lg border border-slate-200 bg-slate-50 px-2 py-2 text-center text-sm font-bold text-slate-800 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10"
                                                />
                                            </div>

                                            <p className="text-sm font-extrabold text-slate-900">
                                                Rs.{" "}
                                                {money(
                                                    item.quantity *
                                                    item.unit_price
                                                )}
                                            </p>
                                        </div>

                                        <p className="mt-2 text-[11px] text-slate-400">
                                            Maximum available:{" "}
                                            {item.available_quantity}{" "}
                                            {item.unit}
                                        </p>
                                    </div>
                                );
                            })}

                            {!cart.length && (
                                <div className="flex min-h-[220px] flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50/70 px-5 py-8 text-center">
                                    <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-white text-slate-300 shadow-sm">
                                        <ShoppingCart size={30} />
                                    </div>
                                    <h3 className="mt-4 font-bold text-slate-800">
                                        Your cart is empty
                                    </h3>
                                    <p className="mt-2 max-w-[240px] text-xs leading-5 text-slate-500">
                                        Select a product from the catalog or
                                        scan its barcode to start a sale.
                                    </p>
                                </div>
                            )}
                        </div>

                        <div className="border-t border-slate-100 bg-slate-50/70 p-4 sm:p-5">
                            <div className="space-y-3">
                                <div className="flex items-center justify-between text-sm">
                                    <span className="text-slate-500">
                                        Subtotal
                                    </span>
                                    <span className="font-bold text-slate-800">
                                        Rs. {money(subtotal)}
                                    </span>
                                </div>

                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <label className={labelClass}>
                                            Discount (Rs.)
                                        </label>
                                        <input
                                            type="number"
                                            min="0"
                                            step="0.01"
                                            value={discount}
                                            onChange={(event) =>
                                                setDiscount(event.target.value)
                                            }
                                            className={inputClass}
                                        />
                                    </div>
                                    <div>
                                        <label className={labelClass}>
                                            Tax (Rs.)
                                        </label>
                                        <input
                                            type="number"
                                            min="0"
                                            step="0.01"
                                            value={tax}
                                            onChange={(event) =>
                                                setTax(event.target.value)
                                            }
                                            className={inputClass}
                                        />
                                    </div>
                                </div>

                                <div className="flex items-center justify-between border-t border-dashed border-slate-200 pt-3">
                                    <span className="text-sm font-bold text-slate-600">
                                        Grand Total
                                    </span>
                                    <span className="text-2xl font-black tracking-tight text-indigo-700">
                                        Rs. {money(total)}
                                    </span>
                                </div>

                                <div className="rounded-xl border border-slate-200 bg-white p-3.5">
                                    <label className={labelClass}>
                                        Received Amount (Rs.)
                                    </label>
                                    <div className="relative">
                                        <Banknote
                                            size={18}
                                            className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
                                        />
                                        <input
                                            type="number"
                                            min="0"
                                            step="0.01"
                                            value={received}
                                            onChange={(event) =>
                                                setReceived(event.target.value)
                                            }
                                            className={`${inputClass} pl-10`}
                                        />
                                    </div>

                                    <p className="mt-2 text-[11px] leading-5 text-slate-500">
                                        Enter 0 for an unpaid invoice or a
                                        smaller amount for partial payment.
                                    </p>

                                    <div className="mt-3 grid grid-cols-2 gap-2">
                                        <div className="rounded-lg bg-emerald-50 p-3">
                                            <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-700">
                                                Change
                                            </p>
                                            <p className="mt-1 break-words text-sm font-extrabold text-emerald-800">
                                                Rs. {money(changeDue)}
                                            </p>
                                        </div>

                                        <div className="rounded-lg bg-amber-50 p-3">
                                            <p className="text-[10px] font-bold uppercase tracking-wider text-amber-700">
                                                Balance due
                                            </p>
                                            <p className="mt-1 break-words text-sm font-extrabold text-amber-800">
                                                Rs. {money(balanceDue)}
                                            </p>
                                        </div>
                                    </div>
                                </div>

                                <div className="flex items-center justify-between rounded-xl bg-white px-3.5 py-3">
                                    <div className="flex items-center gap-2 text-slate-500">
                                        <Boxes size={17} />
                                        <span className="text-xs font-semibold">
                                            Total quantity
                                        </span>
                                    </div>
                                    <span className="font-extrabold text-slate-900">
                                        {totalQuantity}
                                    </span>
                                </div>

                                {permissions.canCreate && (
    <button
        type="button"
        onClick={checkout}
        disabled={
            checkingOut ||
            !cart.length ||
            reviewingOrder
        }
        className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 px-4 py-4 text-sm font-extrabold text-white shadow-lg transition hover:from-indigo-700 hover:to-violet-700 disabled:cursor-not-allowed disabled:from-slate-400 disabled:to-slate-400"
    >
        {checkingOut ? (
            <>
                <RefreshCw size={18} className="animate-spin" />
                Processing sale...
            </>
        ) : (
            <>
                <CheckCircle2 size={19} />
                Complete Checkout
                <ArrowRight size={18} className="ml-auto" />
            </>
        )}
    </button>
)}

                                <p className="text-center text-[11px] text-slate-400">
                                    Review the customer, warehouse and payment
                                    before completing checkout.
                                </p>
                            </div>
                        </div>
                    </section>
                </div>
            </div>

            {/* Cash In / Cash Out */}
            {showCashMovement && (
                <Modal
                    onClose={() =>
                        !savingCashMovement && setShowCashMovement(false)
                    }
                    className="max-w-xl"
                    zIndex="z-[70]"
                >
                    <div
                        className={`flex items-center gap-4 px-5 py-5 text-white sm:px-6 ${cashMovementType === "RECEIPT"
                            ? "bg-gradient-to-r from-emerald-700 to-teal-600"
                            : "bg-gradient-to-r from-rose-700 to-red-600"
                            }`}
                    >
                        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white/15">
                            {cashMovementType === "RECEIPT" ? (
                                <ArrowDownLeft size={25} />
                            ) : (
                                <ArrowUpRight size={25} />
                            )}
                        </div>
                        <div className="min-w-0 flex-1">
                            <h2 className="text-xl font-extrabold">
                                {cashMovementType === "RECEIPT"
                                    ? "Cash In"
                                    : "Cash Out"}
                            </h2>
                            <p className="mt-1 text-sm text-white/80">
                                {cashMovementType === "RECEIPT"
                                    ? "Record money received into your account."
                                    : "Record a payment made from your account."}
                            </p>
                        </div>
                        <button
                            type="button"
                            onClick={() => setShowCashMovement(false)}
                            disabled={savingCashMovement}
                            className="rounded-lg p-2 text-white/80 transition hover:bg-white/15 hover:text-white"
                            aria-label="Close cash movement"
                        >
                            <X size={21} />
                        </button>
                    </div>

                    <form onSubmit={submitCashMovement}>
                        <div className="max-h-[65vh] space-y-4 overflow-y-auto p-5 sm:p-6">
                            {loadingCashAccounts ? (
                                <div className="py-12 text-center">
                                    <RefreshCw
                                        size={25}
                                        className="mx-auto animate-spin text-indigo-600"
                                    />
                                    <p className="mt-3 text-sm text-slate-500">
                                        Loading chart of accounts...
                                    </p>
                                </div>
                            ) : (
                                <>
                                    <div>
                                        <label className={labelClass}>
                                            Cash / Bank Account *
                                        </label>
                                        <select
                                            required
                                            value={cashAccountId}
                                            onChange={(event) =>
                                                setCashAccountId(
                                                    event.target.value
                                                )
                                            }
                                            className={inputClass}
                                        >
                                            <option value="">
                                                Select cash or bank account
                                            </option>
                                            {cashAccounts.map((account) => (
                                                <option
                                                    key={account.account_id}
                                                    value={account.account_id}
                                                >
                                                    {account.account_code} -{" "}
                                                    {account.account_name}
                                                </option>
                                            ))}
                                        </select>
                                    </div>

                                    <div>
                                        <label className={labelClass}>
                                            Counter Account *
                                        </label>
                                        <select
                                            required
                                            value={counterAccountId}
                                            onChange={(event) =>
                                                setCounterAccountId(
                                                    event.target.value
                                                )
                                            }
                                            className={inputClass}
                                        >
                                            <option value="">
                                                Select counter account
                                            </option>
                                            {counterAccounts.map((account) => (
                                                <option
                                                    key={account.account_id}
                                                    value={account.account_id}
                                                >
                                                    {account.account_code} -{" "}
                                                    {account.account_name} (
                                                    {account.account_type})
                                                </option>
                                            ))}
                                        </select>
                                    </div>

                                    <div className="grid gap-4 sm:grid-cols-2">
                                        <div>
                                            <label className={labelClass}>
                                                Amount (Rs.) *
                                            </label>
                                            <input
                                                required
                                                type="number"
                                                min="0.01"
                                                step="0.01"
                                                value={cashAmount}
                                                onChange={(event) =>
                                                    setCashAmount(
                                                        event.target.value
                                                    )
                                                }
                                                className={inputClass}
                                                placeholder="0.00"
                                            />
                                        </div>

                                        <div>
                                            <label className={labelClass}>
                                                Transaction Date *
                                            </label>
                                            <input
                                                required
                                                type="date"
                                                value={cashDate}
                                                onChange={(event) =>
                                                    setCashDate(
                                                        event.target.value
                                                    )
                                                }
                                                className={inputClass}
                                            />
                                        </div>
                                    </div>

                                    <div>
                                        <label className={labelClass}>
                                            Reference Number
                                        </label>
                                        <input
                                            value={cashReference}
                                            onChange={(event) =>
                                                setCashReference(
                                                    event.target.value
                                                )
                                            }
                                            maxLength={100}
                                            className={inputClass}
                                            placeholder="Optional reference"
                                        />
                                    </div>

                                    <div>
                                        <label className={labelClass}>
                                            Description / Notes *
                                        </label>
                                        <textarea
                                            required
                                            value={cashDescription}
                                            onChange={(event) =>
                                                setCashDescription(
                                                    event.target.value
                                                )
                                            }
                                            maxLength={1000}
                                            rows={3}
                                            className={inputClass}
                                            placeholder="Enter the reason for this transaction..."
                                        />
                                    </div>
                                </>
                            )}
                        </div>

                        <div className="flex flex-wrap justify-end gap-3 border-t border-slate-100 bg-slate-50/70 px-5 py-4 sm:px-6">
                            <button
                                type="button"
                                onClick={() => setShowCashMovement(false)}
                                disabled={savingCashMovement}
                                className={buttonSecondary}
                            >
                                Cancel
                            </button>

                            <button
                                type="submit"
                                disabled={
                                    savingCashMovement ||
                                    loadingCashAccounts ||
                                    !cashAccounts.length ||
                                    !counterAccounts.length
                                }
                                className={`inline-flex items-center justify-center gap-2 rounded-xl px-5 py-3 text-sm font-bold text-white transition disabled:opacity-50 ${cashMovementType === "RECEIPT"
                                    ? "bg-emerald-600 hover:bg-emerald-700"
                                    : "bg-rose-600 hover:bg-rose-700"
                                    }`}
                            >
                                {savingCashMovement ? (
                                    <RefreshCw
                                        size={17}
                                        className="animate-spin"
                                    />
                                ) : (
                                    <Check size={17} />
                                )}
                                {savingCashMovement
                                    ? "Saving..."
                                    : cashMovementType === "RECEIPT"
                                        ? "Save Cash In"
                                        : "Save Cash Out"}
                            </button>
                        </div>
                    </form>
                </Modal>
            )}

            {/* Held Sales */}
            {showHeldSales && (
                <Modal
                    onClose={() => setShowHeldSales(false)}
                    className="max-w-4xl"
                >
                    <ModalHeader
                        icon={Archive}
                        title="Held Sales"
                        subtitle="Resume or remove a previously held cart."
                        accent="violet"
                        onClose={() => setShowHeldSales(false)}
                    />

                    <div className="max-h-[72vh] space-y-3 overflow-y-auto p-4 sm:p-6">
                        {!heldSales.length ? (
                            <div className="py-14 text-center">
                                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-violet-50 text-violet-400">
                                    <Archive size={29} />
                                </div>
                                <h3 className="mt-4 font-extrabold text-slate-900">
                                    No held sales
                                </h3>
                                <p className="mt-2 text-sm text-slate-500">
                                    Use Hold Sale to temporarily save a cart.
                                </p>
                            </div>
                        ) : (
                            heldSales.map((sale) => {
                                const saleSubtotal = sale.cart.reduce(
                                    (sum, item) =>
                                        sum +
                                        Number(item.quantity || 0) *
                                        Number(item.unit_price || 0),
                                    0
                                );

                                const saleTotal = Math.max(
                                    0,
                                    saleSubtotal -
                                    Math.max(
                                        0,
                                        Number(sale.discount) || 0
                                    ) +
                                    Math.max(0, Number(sale.tax) || 0)
                                );

                                return (
                                    <div
                                        key={sale.id}
                                        className="rounded-2xl border border-slate-200 p-4 transition hover:border-violet-200 hover:shadow-sm sm:p-5"
                                    >
                                        <div className="flex flex-wrap items-start justify-between gap-4">
                                            <div className="flex min-w-0 items-start gap-3">
                                                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-violet-50 text-violet-600">
                                                    <UserRound size={21} />
                                                </div>
                                                <div className="min-w-0">
                                                    <h3 className="font-extrabold text-slate-900">
                                                        {sale.customerName}
                                                    </h3>
                                                    <p className="mt-1 text-xs text-slate-500">
                                                        <Warehouse
                                                            size={13}
                                                            className="mr-1 inline"
                                                        />
                                                        {sale.warehouseName}
                                                    </p>
                                                    <p className="mt-1 text-xs text-slate-400">
                                                        <Clock
                                                            size={13}
                                                            className="mr-1 inline"
                                                        />
                                                        {formatDateTime(
                                                            sale.createdAt
                                                        )}
                                                    </p>
                                                </div>
                                            </div>

                                            <div className="text-right">
                                                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                                                    Sale total
                                                </p>
                                                <p className="mt-1 text-xl font-black text-indigo-700">
                                                    Rs. {money(saleTotal)}
                                                </p>
                                            </div>
                                        </div>

                                        <div className="mt-4 rounded-xl bg-slate-50 p-3">
                                            {sale.cart.map((item) => (
                                                <div
                                                    key={cartKey(item)}
                                                    className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200/70 py-2 last:border-0"
                                                >
                                                    <span className="min-w-0 flex-1 break-words text-sm text-slate-700">
                                                        {item.display_name ||
                                                            item.product_name}
                                                        <span className="ml-2 text-xs font-bold text-slate-500">
                                                            × {item.quantity}
                                                        </span>
                                                    </span>
                                                    <span className="text-sm font-bold text-slate-800">
                                                        Rs.{" "}
                                                        {money(
                                                            item.quantity *
                                                            item.unit_price
                                                        )}
                                                    </span>
                                                </div>
                                            ))}
                                        </div>

                                        <div className="mt-4 flex flex-wrap justify-end gap-2">
                                            {permissions.canDelete && (
    <button
        type="button"
        onClick={() => removeHeldSale(sale.id)}
        className="inline-flex items-center gap-2 rounded-xl border border-rose-200 px-4 py-2.5 text-sm font-bold text-rose-600 transition hover:bg-rose-50"
    >
        <Trash2 size={16} />
        Remove
    </button>
)}

                                            <button
                                                type="button"
                                                onClick={() =>
                                                    resumeHeldSale(sale.id)
                                                }
                                                disabled={
                                                    cart.length > 0 ||
                                                    checkingOut
                                                }
                                                className={buttonPrimary}
                                            >
                                                <RotateCcw size={16} />
                                                Resume Sale
                                            </button>
                                        </div>
                                    </div>
                                );
                            })
                        )}
                    </div>
                </Modal>
            )}

            {/* Sales Orders */}
            {showOrders && (
                <Modal
                    onClose={() => setShowOrders(false)}
                    className="max-w-6xl"
                >
                    <ModalHeader
                        icon={Receipt}
                        title="Sales Orders"
                        subtitle="Review saved invoices and print customer receipts."
                        onClose={() => setShowOrders(false)}
                    />

                    <div className="max-h-[75vh] overflow-auto p-4 sm:p-6">
                        {!orders.length ? (
                            <div className="py-14 text-center">
                                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-400">
                                    <FileText size={30} />
                                </div>
                                <h3 className="mt-4 font-extrabold text-slate-900">
                                    No sales orders found
                                </h3>
                                <p className="mt-2 text-sm text-slate-500">
                                    Created invoices will appear here.
                                </p>
                            </div>
                        ) : (
                            <>
                                <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                                    <div>
                                        <p className="text-sm font-bold text-slate-800">
                                            Invoice register
                                        </p>
                                        <p className="mt-1 text-xs text-slate-500">
                                            {orders.length} records
                                        </p>
                                    </div>
                                    <span className="rounded-lg bg-indigo-50 px-3 py-2 text-xs font-bold text-indigo-700">
                                        Sales history
                                    </span>
                                </div>

                                <div className="overflow-x-auto rounded-xl border border-slate-200">
                                    <table className="min-w-[760px] w-full text-left text-sm">
                                        <thead className="bg-slate-50">
                                            <tr className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                                                <th className="px-4 py-4">
                                                    Invoice
                                                </th>
                                                <th className="px-4 py-4">
                                                    Customer
                                                </th>
                                                <th className="px-4 py-4">
                                                    Date
                                                </th>
                                                <th className="px-4 py-4">
                                                    Total
                                                </th>
                                                <th className="px-4 py-4">
                                                    Status
                                                </th>
                                                <th className="px-4 py-4 text-right">
                                                    Action
                                                </th>
                                            </tr>
                                        </thead>

                                        <tbody className="divide-y divide-slate-100 bg-white">
                                            {orders.map((order) => (
                                                <tr
                                                    key={order.invoice_id}
                                                    className="transition hover:bg-indigo-50/40"
                                                >
                                                    <td className="whitespace-nowrap px-4 py-4 font-bold text-indigo-700">
                                                        {order.invoice_number ||
                                                            order.invoice_id}
                                                    </td>
                                                    <td className="px-4 py-4 font-medium text-slate-800">
                                                        {order.customer_name ||
                                                            "—"}
                                                    </td>
                                                    <td className="whitespace-nowrap px-4 py-4 text-slate-500">
                                                        {formatDate(
                                                            order.invoice_date
                                                        )}
                                                    </td>
                                                    <td className="whitespace-nowrap px-4 py-4 font-bold text-slate-900">
                                                        Rs.{" "}
                                                        {money(
                                                            order.total_amount
                                                        )}
                                                    </td>
                                                    <td className="px-4 py-4">
                                                        <span className="inline-flex rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-700">
                                                            {order.status ||
                                                                "—"}
                                                        </span>
                                                    </td>
                                                    <td className="px-4 py-4 text-right">
                                                        {permissions.canView && (
    <button
        type="button"
        onClick={() => editOrder(order)}
        disabled={loadingInvoice}
        className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-3.5 py-2 text-xs font-bold text-white transition hover:bg-indigo-700 disabled:opacity-50"
    >
        <Eye size={14} />
        {loadingInvoice ? "Loading..." : "Review"}
    </button>
)}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </>
                        )}
                    </div>
                </Modal>
            )}

            {/* Invoice Preview */}
            {reviewingInvoice && (
                <Modal
                    onClose={() => setReviewingInvoice(null)}
                    className="max-w-5xl"
                    zIndex="z-[80]"
                >
                    <div className="invoice-no-print flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 bg-slate-50 px-5 py-4 sm:px-6">
                        <div className="flex items-center gap-3">
                            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-indigo-100 text-indigo-600">
                                <FileText size={22} />
                            </div>
                            <div>
                                <h2 className="font-extrabold text-slate-900">
                                    Invoice Preview
                                </h2>
                                <p className="mt-0.5 text-xs text-slate-500">
                                    Review, print or save as PDF
                                </p>
                            </div>
                        </div>

                        <div className="flex flex-wrap gap-2">
                            <button
                                type="button"
                                onClick={printInvoice}
                                className={buttonSecondary}
                            >
                                <Printer size={16} />
                                Print
                            </button>
                            <button
                                type="button"
                                onClick={downloadInvoicePdf}
                                className={buttonPrimary}
                            >
                                <Download size={16} />
                                Save as PDF
                            </button>
                            <button
                                type="button"
                                onClick={() => setReviewingInvoice(null)}
                                className="flex h-11 w-11 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500 transition hover:bg-slate-100"
                                aria-label="Close invoice preview"
                            >
                                <X size={19} />
                            </button>
                        </div>
                    </div>

                    <div className="max-h-[80vh] overflow-y-auto bg-slate-100 p-3 sm:p-7">
                        <div
                            id="pos-invoice-print"
                            className="mx-auto max-w-4xl bg-white p-5 text-slate-900 shadow-sm sm:p-9 lg:p-12"
                        >
                            <div className="flex flex-wrap items-start justify-between gap-5 border-b-2 border-slate-900 pb-7">
                                <div>
                                    <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-indigo-600 text-white">
                                        <Receipt size={25} />
                                    </div>
                                    <h1 className="text-3xl font-black tracking-tight sm:text-4xl">
                                        SALES INVOICE
                                    </h1>
                                    <p className="mt-2 text-sm text-slate-500">
                                        Invoice / Sales Receipt
                                    </p>
                                </div>

                                <div className="min-w-0 text-left sm:text-right">
                                    <p className="text-xs font-bold uppercase tracking-widest text-slate-400">
                                        Invoice number
                                    </p>
                                    <p className="mt-2 break-all text-xl font-black text-indigo-700">
                                        {invoice?.invoice_number ||
                                            invoice?.invoice_id ||
                                            "—"}
                                    </p>
                                    <p className="mt-3 text-sm text-slate-600">
                                        <CalendarDays
                                            size={15}
                                            className="mr-1 inline"
                                        />
                                        {formatDate(invoice?.invoice_date)}
                                    </p>
                                </div>
                            </div>

                            <div className="grid gap-6 py-7 sm:grid-cols-2">
                                <div className="rounded-xl bg-slate-50 p-4">
                                    <h3 className="mb-3 text-[10px] font-black uppercase tracking-widest text-slate-400">
                                        Bill to
                                    </h3>
                                    <p className="break-words text-base font-extrabold text-slate-900">
                                        {invoice?.customer_name ||
                                            selectedCustomer?.customer_name ||
                                            "Customer"}
                                    </p>
                                    {invoice?.customer_code && (
                                        <p className="mt-2 text-sm text-slate-600">
                                            <Hash
                                                size={14}
                                                className="mr-1 inline"
                                            />
                                            {invoice.customer_code}
                                        </p>
                                    )}
                                    {invoice?.customer_phone && (
                                        <p className="mt-1 text-sm text-slate-600">
                                            <Phone
                                                size={14}
                                                className="mr-1 inline"
                                            />
                                            {invoice.customer_phone}
                                        </p>
                                    )}
                                </div>

                                <div className="rounded-xl bg-slate-50 p-4 sm:text-right">
                                    <h3 className="mb-3 text-[10px] font-black uppercase tracking-widest text-slate-400">
                                        Invoice details
                                    </h3>
                                    <p className="text-sm text-slate-600">
                                        Warehouse:{" "}
                                        <span className="font-bold text-slate-900">
                                            {invoice?.warehouse_name ||
                                                selectedWarehouse?.warehouse_name ||
                                                "—"}
                                        </span>
                                    </p>
                                    <p className="mt-2 text-sm text-slate-600">
                                        Status:{" "}
                                        <span className="font-bold text-slate-900">
                                            {invoice?.status || "—"}
                                        </span>
                                    </p>
                                </div>
                            </div>

                            <div className="overflow-x-auto">
                                <table className="w-full min-w-[600px] border-collapse text-sm">
                                    <thead>
                                        <tr className="bg-slate-900 text-white">
                                            <th className="px-3 py-3.5 text-left text-xs font-bold">
                                                #
                                            </th>
                                            <th className="px-3 py-3.5 text-left text-xs font-bold">
                                                Product / Description
                                            </th>
                                            <th className="px-3 py-3.5 text-right text-xs font-bold">
                                                Qty
                                            </th>
                                            <th className="px-3 py-3.5 text-right text-xs font-bold">
                                                Unit Price
                                            </th>
                                            <th className="px-3 py-3.5 text-right text-xs font-bold">
                                                Line Total
                                            </th>
                                        </tr>
                                    </thead>

                                    <tbody>
                                        {invoiceItems.map((item, index) => {
                                            const quantity = Number(
                                                item.quantity || 0
                                            );
                                            const unitPrice = Number(
                                                item.unit_price ??
                                                item.unitPrice ??
                                                item.sale_price ??
                                                0
                                            );
                                            const lineTotal = Number(
                                                item.line_total ??
                                                item.total ??
                                                quantity * unitPrice
                                            );

                                            return (
                                                <tr
                                                    key={
                                                        item.invoice_item_id ||
                                                        item.item_id ||
                                                        `${item.product_id}-${index}`
                                                    }
                                                    className="border-b border-slate-200"
                                                >
                                                    <td className="px-3 py-4 text-slate-500">
                                                        {index + 1}
                                                    </td>
                                                    <td className="px-3 py-4">
                                                        <p className="font-bold text-slate-900">
                                                            {item.product_name ||
                                                                item.display_name ||
                                                                item.name ||
                                                                "Product"}
                                                        </p>
                                                        {(item.sku ||
                                                            item.product_sku) && (
                                                                <p className="mt-1 text-xs text-slate-500">
                                                                    SKU:{" "}
                                                                    {item.sku ||
                                                                        item.product_sku}
                                                                </p>
                                                            )}
                                                        {item.sub_product_name && (
                                                            <p className="mt-1 text-xs text-slate-500">
                                                                Variant:{" "}
                                                                {item.sub_product_name}
                                                            </p>
                                                        )}
                                                    </td>
                                                    <td className="px-3 py-4 text-right">
                                                        {quantity}
                                                    </td>
                                                    <td className="px-3 py-4 text-right whitespace-nowrap">
                                                        Rs. {money(unitPrice)}
                                                    </td>
                                                    <td className="px-3 py-4 text-right font-bold whitespace-nowrap">
                                                        Rs. {money(lineTotal)}
                                                    </td>
                                                </tr>
                                            );
                                        })}

                                        {!invoiceItems.length && (
                                            <tr>
                                                <td
                                                    colSpan={5}
                                                    className="px-3 py-10 text-center text-slate-500"
                                                >
                                                    No invoice line items were
                                                    returned by the server.
                                                </td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>

                            <div className="mt-7 flex justify-end">
                                <div className="w-full max-w-sm space-y-3">
                                    <div className="flex justify-between gap-4 text-sm">
                                        <span className="text-slate-500">
                                            Subtotal
                                        </span>
                                        <span className="font-semibold">
                                            Rs. {money(invoiceSubtotal)}
                                        </span>
                                    </div>

                                    <div className="flex justify-between gap-4 text-sm">
                                        <span className="text-slate-500">
                                            Discount
                                        </span>
                                        <span>
                                            Rs. {money(invoiceDiscount)}
                                        </span>
                                    </div>

                                    <div className="flex justify-between gap-4 text-sm">
                                        <span className="text-slate-500">
                                            Tax
                                        </span>
                                        <span>Rs. {money(invoiceTax)}</span>
                                    </div>

                                    <div className="flex justify-between gap-4 border-t border-slate-200 pt-4 text-lg font-black">
                                        <span>Grand Total</span>
                                        <span className="text-indigo-700">
                                            Rs. {money(invoiceTotal)}
                                        </span>
                                    </div>

                                    <div className="flex justify-between gap-4 text-sm">
                                        <span className="text-slate-500">
                                            Amount paid
                                        </span>
                                        <span className="font-bold text-emerald-700">
                                            Rs. {money(invoicePaid)}
                                        </span>
                                    </div>

                                    <div className="flex justify-between gap-4 rounded-xl bg-rose-50 p-3 text-sm">
                                        <span className="font-bold text-rose-700">
                                            Balance due
                                        </span>
                                        <span className="font-black text-rose-700">
                                            Rs. {money(invoiceBalance)}
                                        </span>
                                    </div>
                                </div>
                            </div>

                            <div className="mt-12 border-t border-slate-200 pt-6 text-center">
                                <p className="font-extrabold text-slate-900">
                                    Thank you for your business!
                                </p>
                                <p className="mt-2 text-xs text-slate-400">
                                    This invoice was generated by the ERP
                                    system.
                                </p>
                            </div>
                        </div>
                    </div>
                </Modal>
            )}
        </div>
    );
}
