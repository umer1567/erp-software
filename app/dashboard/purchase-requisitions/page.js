"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

const cardClass =
    "rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900";

const labelClass =
    "mb-2 block text-sm font-semibold text-slate-700 dark:text-slate-300";

const inputClass =
    "w-full rounded-xl border border-slate-200 bg-white px-3.5 py-3 text-sm text-slate-800 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 dark:border-slate-700 dark:bg-slate-950 dark:text-white";

const smallInputClass =
    "w-full min-w-[100px] rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-950 dark:text-white";

const primaryButton =
    "inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-emerald-600 px-5 py-3 text-sm font-bold text-white shadow-md transition hover:-translate-y-0.5 hover:shadow-lg disabled:cursor-not-allowed disabled:opacity-50";

const secondaryButton =
    "inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800";

const today = () => {
    const date = new Date();
    const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
    return local.toISOString().slice(0, 10);
};

const emptyItem = () => ({
    productId: "",
    description: "",
    itemBalance: "0",
    uom: "PCS",
    quantity: "1",
    memo: "",
});

const emptyForm = () => ({
    transactionDate: today(),
    status: "DRAFT",
    warehouseId: "",
    department: "",
    className: "",
    project: "",
    memo: "",
    referenceNumber: "",
});

const formatNumber = (value) =>
    Number(value || 0).toLocaleString("en-PK", {
        maximumFractionDigits: 3,
    });

const formatDate = (value) => {
    if (!value) return "-";

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) return "-";

    return date.toLocaleDateString("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric",
    });
};

const toBoolean = (value) => {
    if (typeof value === "boolean") return value;

    if (typeof value === "number") return value === 1;

    if (typeof value === "string") {
        return ["true", "1", "yes", "on"].includes(
            value.toLowerCase().trim()
        );
    }

    return false;
};

const statusClass = (status) => {
    const styles = {
        DRAFT: "border-slate-200 bg-slate-100 text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300",
        SUBMITTED: "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-900 dark:bg-blue-950/40 dark:text-blue-300",
        APPROVED: "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300",
        REJECTED: "border-red-200 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300",
    };

    return styles[status] || styles.DRAFT;
};

function Icon({ name, size = 18 }) {
    const paths = {
        plus: <><path d="M12 5v14" /><path d="M5 12h14" /></>,
        search: <><circle cx="11" cy="11" r="7" /><path d="m20 20-4-4" /></>,
        refresh: <><path d="M20 7v5h-5" /><path d="M4 17v-5h5" /><path d="M5.6 9a7 7 0 0 1 11.7-2L20 12M4 12l2.7 5a7 7 0 0 0 11.7-2" /></>,
        eye: <><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" /><circle cx="12" cy="12" r="3" /></>,
        edit: <><path d="m15 5 4 4" /><path d="M4 20h4l11-11a2.8 2.8 0 0 0-4-4L4 16v4Z" /></>,
        trash: <><path d="M3 6h18" /><path d="M8 6V4h8v2" /><path d="m19 6-1 14H6L5 6" /><path d="M10 11v5M14 11v5" /></>,
        close: <><path d="m18 6-12 12M6 6l12 12" /></>,
        check: <path d="m5 12 4 4L19 6" />,
        arrow: <><path d="M19 12H5" /><path d="m12 19-7-7 7-7" /></>,
        file: <><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z" /><path d="M14 2v6h6M8 13h8M8 17h8" /></>,
        download: <><path d="M12 3v12m-5-5 5 5 5-5" /><path d="M5 21h14" /></>,
        printer: <><path d="M6 9V2h12v7" /><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" /><path d="M6 14h12v8H6z" /></>,
        package: <><path d="m12 3 9 5-9 5-9-5 9-5Z" /><path d="M3 8v9l9 5 9-5V8M12 13v9" /></>,
        clipboard: <><rect x="5" y="4" width="14" height="18" rx="2" /><path d="M9 4V2h6v2M9 10h6M9 14h6M9 18h4" /></>,
        users: <><path d="M16 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="10" cy="7" r="4" /><path d="M20 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" /></>,
        calendar: <><rect x="3" y="4" width="18" height="17" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" /></>,
        building: <><rect x="4" y="2" width="16" height="20" rx="2" /><path d="M9 22v-4h6v4M8 6h1M15 6h1M8 10h1M15 10h1M8 14h1M15 14h1" /></>,
    };

    return (
        <svg
            width={size}
            height={size}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
        >
            {paths[name] || paths.file}
        </svg>
    );
}

function SectionHeading({ icon, title, description, action }) {
    return (
        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300">
                    <Icon name={icon} size={20} />
                </div>

                <div>
                    <h2 className="text-lg font-extrabold text-slate-900 dark:text-white">
                        {title}
                    </h2>

                    {description && (
                        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                            {description}
                        </p>
                    )}
                </div>
            </div>

            {action}
        </div>
    );
}

function SummaryCard({ title, value, description, accent = "blue" }) {
    const styles = {
        blue: "bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300",
        green: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300",
        amber: "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300",
    };

    return (
        <div className={`${cardClass} p-5`}>
            <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${styles[accent]}`}>
                <Icon name="clipboard" size={20} />
            </div>

            <p className="mt-4 text-sm font-semibold text-slate-500 dark:text-slate-400">
                {title}
            </p>

            <p className="mt-1 text-2xl font-extrabold text-slate-900 dark:text-white">
                {value}
            </p>

            <p className="mt-1 text-xs text-slate-400">
                {description}
            </p>
        </div>
    );
}

export default function PurchaseRequisitionsPage() {
    const [requisitions, setRequisitions] = useState([]);
    const [warehouses, setWarehouses] = useState([]);
    const [products, setProducts] = useState([]);
    const [units, setUnits] = useState([]);

    const [rights, setRights] = useState({
        canView: false,
        canCreate: false,
        canUpdate: false,
        canDelete: false,
        canCreateRfq: false,
    });

    const [permissionLoading, setPermissionLoading] = useState(true);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    const [showForm, setShowForm] = useState(false);
    const [editingId, setEditingId] = useState(null);
    const [selected, setSelected] = useState(null);

    const [form, setForm] = useState(emptyForm());
    const [items, setItems] = useState([emptyItem()]);
    const [search, setSearch] = useState("");
    const [activeTab, setActiveTab] = useState("lines");

    const [message, setMessage] = useState("");
    const [error, setError] = useState("");

    // RFQ creation state
    const [showRfqModal, setShowRfqModal] = useState(false);
    const [rfqSource, setRfqSource] = useState(null);
    const [rfqSuppliers, setRfqSuppliers] = useState([]);
    const [rfqSelectedSuppliers, setRfqSelectedSuppliers] = useState([]);
    const [rfqDate, setRfqDate] = useState(today());
    const [rfqStatus, setRfqStatus] = useState("DRAFT");
    const [rfqSaving, setRfqSaving] = useState(false);
    const [rfqLoading, setRfqLoading] = useState(false);

    /* -------------------------------------------------------------------------- */
    /* Data loading                                                               */
    /* -------------------------------------------------------------------------- */

    const fetchData = useCallback(async () => {
        setLoading(true);
        setError("");

        try {
            const [
                reqRes,
                warehouseRes,
                productRes,
                unitRes,
            ] = await Promise.all([
                fetch("/api/purchase-requisitions", { cache: "no-store" }),
                fetch("/api/warehouses", { cache: "no-store" }),
                fetch("/api/products", { cache: "no-store" }),
                fetch("/api/units-of-measure", { cache: "no-store" }),
            ]);

            const [
                reqData,
                warehouseData,
                productData,
                unitData,
            ] = await Promise.all([
                reqRes.json(),
                warehouseRes.json(),
                productRes.json(),
                unitRes.json(),
            ]);

            if (!reqRes.ok) {
                throw new Error(
                    reqData.message || "Failed to load requisitions."
                );
            }

            if (!warehouseRes.ok) {
                throw new Error(
                    warehouseData.message || "Failed to load locations."
                );
            }

            if (!productRes.ok) {
                throw new Error(
                    productData.message || "Failed to load products."
                );
            }

            setRequisitions(
                Array.isArray(reqData.requisitions)
                    ? reqData.requisitions
                    : []
            );

            setWarehouses(
                Array.isArray(warehouseData)
                    ? warehouseData
                    : Array.isArray(warehouseData.warehouses)
                        ? warehouseData.warehouses
                        : []
            );

            setProducts(
                Array.isArray(productData)
                    ? productData
                    : Array.isArray(productData.products)
                        ? productData.products
                        : []
            );

            setUnits(
                unitRes.ok
                    ? Array.isArray(unitData)
                        ? unitData
                        : Array.isArray(unitData.units)
                            ? unitData.units
                            : []
                    : []
            );
        } catch (err) {
            setError(
                err.message || "Unable to load the requisition workspace."
            );
        } finally {
            setLoading(false);
        }
    }, []);

    /* -------------------------------------------------------------------------- */
    /* Permission loading                                                        */
    /* -------------------------------------------------------------------------- */

    useEffect(() => {
        let active = true;

        async function loadPermissions() {
            try {
                const response = await fetch("/api/permissions/current", {
                    cache: "no-store",
                });

                const data = await response.json();

                if (!response.ok) {
                    throw new Error(
                        data.message || "Unable to check permissions."
                    );
                }

                const list = Array.isArray(data)
                    ? data
                    : Array.isArray(data.permissions)
                        ? data.permissions
                        : [];

                const findPermission = (key) =>
                    list.find(
                        (item) =>
                            item.permission_key === key ||
                            item.permissionKey === key
                    );

                const requisitionPermission = findPermission(
                    "purchase_requisitions"
                );

                const rfqPermission = findPermission("rfqs");

                if (!active) return;

                setRights({
                    canView: toBoolean(
                        requisitionPermission?.can_view ??
                        requisitionPermission?.canView
                    ),
                    canCreate: toBoolean(
                        requisitionPermission?.can_create ??
                        requisitionPermission?.canCreate
                    ),
                    canUpdate: toBoolean(
                        requisitionPermission?.can_update ??
                        requisitionPermission?.canUpdate
                    ),
                    canDelete: toBoolean(
                        requisitionPermission?.can_delete ??
                        requisitionPermission?.canDelete
                    ),
                    canCreateRfq: toBoolean(
                        rfqPermission?.can_create ??
                        rfqPermission?.canCreate
                    ),
                });
            } catch (err) {
                if (active) {
                    setError(err.message);
                }
            } finally {
                if (active) {
                    setPermissionLoading(false);
                }
            }
        }

        loadPermissions();

        return () => {
            active = false;
        };
    }, []);

    useEffect(() => {
    if (permissionLoading || !rights.canView) return;

    let active = true;

    const load = async () => {
        if (!active) return;

        await fetchData();
    };

    const timeoutId = setTimeout(load, 0);

    return () => {
        active = false;
        clearTimeout(timeoutId);
    };
}, [permissionLoading, rights.canView, fetchData]);

    /* -------------------------------------------------------------------------- */
    /* Form helpers                                                               */
    /* -------------------------------------------------------------------------- */

    const updateForm = (key, value) => {
        setForm((previous) => ({
            ...previous,
            [key]: value,
        }));
    };

    const updateItem = (index, key, value) => {
        setItems((previous) =>
            previous.map((item, i) => {
                if (i !== index) return item;

                const updated = {
                    ...item,
                    [key]: value,
                };

                if (key === "productId") {
                    const product = products.find(
                        (p) => String(p.product_id) === String(value)
                    );

                    if (product) {
                        updated.description = product.product_name || "";
                        updated.uom = product.unit || "PCS";
                    }
                }

                return updated;
            })
        );
    };

    const addItem = () => {
        setItems((previous) => [
            ...previous,
            emptyItem(),
        ]);
    };

    const removeItem = (index) => {
        setItems((previous) =>
            previous.length > 1
                ? previous.filter((_, i) => i !== index)
                : previous
        );
    };

    const totalQuantity = useMemo(
        () =>
            items.reduce(
                (sum, item) => sum + (Number(item.quantity) || 0),
                0
            ),
        [items]
    );

    const filtered = useMemo(() => {
        const term = search.toLowerCase().trim();

        if (!term) return requisitions;

        return requisitions.filter((item) =>
            [
                item.transaction_number,
                item.status,
                item.warehouse_name,
                item.department,
                item.class_name,
                item.project,
                item.reference_number,
                item.document_status,
            ]
                .join(" ")
                .toLowerCase()
                .includes(term)
        );
    }, [requisitions, search]);

    const resetForm = () => {
        setForm(emptyForm());
        setItems([emptyItem()]);
        setEditingId(null);
        setShowForm(false);
        setSelected(null);
        setActiveTab("lines");
    };

    const startCreate = () => {
        if (!rights.canCreate) return;

        setForm(emptyForm());
        setItems([emptyItem()]);
        setEditingId(null);
        setSelected(null);
        setShowForm(true);
        setActiveTab("lines");
        setError("");
        setMessage("");
    };

    /* -------------------------------------------------------------------------- */
    /* View / Edit                                                                */
    /* -------------------------------------------------------------------------- */

    const openDetails = async (id, edit = false) => {
        if (edit && !rights.canUpdate) return;

        setError("");
        setMessage("");

        try {
            const response = await fetch(
                `/api/purchase-requisitions?id=${id}`,
                { cache: "no-store" }
            );

            const data = await response.json();

            if (!response.ok) {
                throw new Error(
                    data.message || "Unable to load requisition."
                );
            }

            const record = data.requisition;

            if (!record) {
                throw new Error("Requisition record was not found.");
            }

            if (edit) {
                setForm({
                    transactionDate: record.transaction_date
                        ? String(record.transaction_date).slice(0, 10)
                        : today(),
                    status: record.status || "DRAFT",
                    warehouseId: String(record.warehouse_id || ""),
                    department: record.department || "",
                    className: record.class_name || "",
                    project: record.project || "",
                    memo: record.memo || "",
                    referenceNumber: record.reference_number || "",
                });

                setItems(
                    (record.items || []).map((item) => ({
                        productId: String(item.product_id || ""),
                        description: item.item_description || "",
                        itemBalance: String(item.item_balance ?? 0),
                        uom: item.uom || "PCS",
                        quantity: String(item.quantity ?? 1),
                        memo: item.memo || "",
                    }))
                );

                setEditingId(record.requisition_id);
                setShowForm(true);
                setSelected(record);
            } else {
                setSelected(record);
                setShowForm(false);
            }
        } catch (err) {
            setError(err.message);
        }
    };

    /* -------------------------------------------------------------------------- */
    /* Save Purchase Requisition                                                  */
    /* -------------------------------------------------------------------------- */

    const saveRequisition = async (event) => {
        event.preventDefault();

        if (editingId ? !rights.canUpdate : !rights.canCreate) {
            return;
        }

        if (!form.warehouseId) {
            setError("Please select a location.");
            return;
        }

        if (
            items.some(
                (item) =>
                    !item.productId ||
                    !Number.isFinite(Number(item.quantity)) ||
                    Number(item.quantity) <= 0
            )
        ) {
            setError(
                "Select a product and enter a valid quantity for every line."
            );
            return;
        }

        setSaving(true);
        setError("");
        setMessage("");

        try {
            const payload = {
                ...form,
                items: items.map((item) => ({
                    productId: Number(item.productId),
                    description: item.description,
                    itemBalance: Number(item.itemBalance) || 0,
                    uom: item.uom,
                    quantity: Number(item.quantity),
                    memo: item.memo,
                })),
            };

            const response = await fetch(
                editingId
                    ? `/api/purchase-requisitions/${editingId}`
                    : "/api/purchase-requisitions",
                {
                    method: editingId ? "PUT" : "POST",
                    headers: {
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify(payload),
                }
            );

            const data = await response.json();

            if (!response.ok) {
                throw new Error(
                    data.message || "Unable to save requisition."
                );
            }

            resetForm();

            await fetchData();

            setMessage(
                data.message || "Purchase requisition saved successfully."
            );
        } catch (err) {
            setError(err.message);
        } finally {
            setSaving(false);
        }
    };

    /* -------------------------------------------------------------------------- */
    /* RFQ: Open modal from an approved Purchase Requisition                      */
    /* -------------------------------------------------------------------------- */

    const openRfqModal = async (requisition) => {
        if (!rights.canCreateRfq) {
            setError(
                "You do not have permission to create Request for Quotations."
            );
            return;
        }

        if (requisition.status !== "APPROVED") {
            setError(
                "Only approved Purchase Requisitions can be converted into an RFQ."
            );
            return;
        }

        setError("");
        setMessage("");
        setRfqLoading(true);

        try {
            const [
                requisitionResponse,
                supplierResponse,
            ] = await Promise.all([
                fetch(
                    `/api/purchase-requisitions?id=${requisition.requisition_id}`,
                    { cache: "no-store" }
                ),
                fetch("/api/suppliers", { cache: "no-store" }),
            ]);

            const [
                requisitionData,
                supplierData,
            ] = await Promise.all([
                requisitionResponse.json(),
                supplierResponse.json(),
            ]);

            if (!requisitionResponse.ok) {
                throw new Error(
                    requisitionData.message ||
                    "Unable to load requisition details."
                );
            }

            if (!supplierResponse.ok) {
                throw new Error(
                    supplierData.message ||
                    "Unable to load suppliers."
                );
            }

            const record = requisitionData.requisition;

            if (!record || record.status !== "APPROVED") {
                throw new Error(
                    "This requisition is not approved."
                );
            }

            if (!Array.isArray(record.items) || !record.items.length) {
                throw new Error(
                    "This requisition does not contain any items."
                );
            }

            const supplierList = Array.isArray(supplierData)
                ? supplierData
                : Array.isArray(supplierData.suppliers)
                    ? supplierData.suppliers
                    : Array.isArray(supplierData.vendors)
                        ? supplierData.vendors
                        : Array.isArray(supplierData.data)
                            ? supplierData.data
                            : [];

            const activeSuppliers = supplierList
                .map((supplier) => ({
                    ...supplier,
                    supplier_id:
                        supplier.supplier_id ??
                        supplier.vendor_id ??
                        supplier.id,
                    supplier_name:
                        supplier.supplier_name ||
                        supplier.vendor_name ||
                        supplier.company_name ||
                        supplier.name ||
                        "",
                }))
                .filter((supplier) => {
                    const active = supplier.is_active ??
                        supplier.active ??
                        true;

                    return (
                        supplier.supplier_id &&
                        toBoolean(active)
                    );
                });

            if (!activeSuppliers.length) {
                console.error("Supplier API response:", supplierData);

                throw new Error(
                    "No active suppliers found. Please check the Suppliers API and supplier records."
                );
            }

            setRfqSource(record);
            setRfqSuppliers(activeSuppliers);
            setRfqSelectedSuppliers([]);
            setRfqDate(today());
            setRfqStatus("DRAFT");
            setShowRfqModal(true);
        } catch (err) {
            setError(err.message || "Unable to prepare RFQ.");
        } finally {
            setRfqLoading(false);
        }
    };

    /* -------------------------------------------------------------------------- */
    /* RFQ supplier selection                                                     */
    /* -------------------------------------------------------------------------- */

    const toggleRfqSupplier = (supplierId) => {
        if (rfqSaving) return;

        const id = Number(supplierId);

        setRfqSelectedSuppliers((previous) =>
            previous.includes(id)
                ? previous.filter((item) => item !== id)
                : [...previous, id]
        );
    };

    const selectAllRfqSuppliers = () => {
        if (rfqSaving) return;

        setRfqSelectedSuppliers(
            rfqSuppliers.map((supplier) =>
                Number(supplier.supplier_id)
            )
        );
    };

    const clearRfqSuppliers = () => {
        if (rfqSaving) return;

        setRfqSelectedSuppliers([]);
    };

    /* -------------------------------------------------------------------------- */
    /* RFQ modal close                                                            */
    /* -------------------------------------------------------------------------- */

    const closeRfqModal = (force = false) => {
        if (rfqSaving && !force) return;

        setShowRfqModal(false);
        setRfqSource(null);
        setRfqSuppliers([]);
        setRfqSelectedSuppliers([]);
        setRfqDate(today());
        setRfqStatus("DRAFT");
    };

    /* -------------------------------------------------------------------------- */
    /* Create RFQ                                                                 */
    /* -------------------------------------------------------------------------- */

    const createRfqFromRequisition = async () => {
        if (!rights.canCreateRfq) {
            setError(
                "You do not have permission to create RFQs."
            );
            return;
        }

        if (!rfqSource) {
            setError("Please select a Purchase Requisition.");
            return;
        }

        if (!rfqSelectedSuppliers.length) {
            setError("Please select at least one supplier.");
            return;
        }

        if (!rfqDate) {
            setError("Please select an RFQ date.");
            return;
        }

        if (rfqSource.status !== "APPROVED") {
            setError(
                "Only approved Purchase Requisitions can be converted into an RFQ."
            );
            return;
        }

        const sourceItems = rfqSource.items || [];

        if (!sourceItems.length) {
            setError("The selected requisition has no items.");
            return;
        }

        const sourceNumber = rfqSource.transaction_number;

        setRfqSaving(true);
        setError("");
        setMessage("");

        try {
            const payload = {
                transactionDate: rfqDate,
                status: rfqStatus,

                project: rfqSource.project || "",

                referenceNumber:
                    rfqSource.reference_number ||
                    sourceNumber ||
                    "",

                memo: [
                    `Created automatically from Purchase Requisition ${sourceNumber}.`,
                    rfqSource.memo || "",
                ]
                    .filter(Boolean)
                    .join("\n"),

                selectedItems: sourceItems.map((item) => ({
                    sourceType: "PURCHASE_REQUISITION",
                    sourceItemId: Number(item.requisition_item_id),
                })),

                supplierIds: rfqSelectedSuppliers,
            };

            const response = await fetch("/api/rfqs", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify(payload),
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(
                    data.message || "Unable to create RFQ."
                );
            }

            const rfqNumber =
                data.rfq?.transactionNumber ||
                data.rfq?.transaction_number ||
                "Successfully created";

            // Force close because rfqSaving is still true here.
            closeRfqModal(true);

            setSelected(null);
            setShowForm(false);

            setMessage(
                `RFQ ${rfqNumber} has been created successfully from Purchase Requisition ${sourceNumber}. It is now available in RFQ History.`
            );

            await fetchData();
        } catch (err) {
            setError(err.message || "Unable to create RFQ.");
        } finally {
            setRfqSaving(false);
        }
    };

    /* -------------------------------------------------------------------------- */
    /* Delete Purchase Requisition                                                */
    /* -------------------------------------------------------------------------- */

    const deleteRequisition = async (id) => {
        if (!rights.canDelete) return;

        if (
            !window.confirm(
                "Delete this purchase requisition permanently?"
            )
        ) {
            return;
        }

        try {
            const response = await fetch(
                `/api/purchase-requisitions/${id}`,
                {
                    method: "DELETE",
                }
            );

            const data = await response.json();

            if (!response.ok) {
                throw new Error(
                    data.message || "Delete failed."
                );
            }

            setSelected(null);

            setMessage(
                data.message || "Requisition deleted."
            );

            await fetchData();
        } catch (err) {
            setError(err.message);
        }
    };

    /* -------------------------------------------------------------------------- */
    /* PDF report                                                                 */
    /* -------------------------------------------------------------------------- */

    const downloadPDF = (record) => {
        if (!record) return;

        const doc = new jsPDF();

        doc.setFontSize(18);
        doc.text("PURCHASE REQUISITION", 14, 18);

        doc.setFontSize(10);

        doc.text(
            `Transaction No: ${record.transaction_number || "-"}`,
            14,
            30
        );

        doc.text(
            `Date: ${formatDate(record.transaction_date)}`,
            14,
            37
        );

        doc.text(
            `Status: ${record.status || "-"}`,
            14,
            44
        );

        doc.text(
            `Location: ${record.warehouse_name || "-"}`,
            14,
            51
        );

        doc.text(
            `Department: ${record.department || "-"}`,
            14,
            58
        );

        doc.text(
            `Class: ${record.class_name || "-"}`,
            14,
            65
        );

        doc.text(
            `Project: ${record.project || "-"}`,
            14,
            72
        );

        doc.text(
            `Reference: ${record.reference_number || "-"}`,
            14,
            79
        );

        autoTable(doc, {
            startY: 88,
            head: [[
                "Item",
                "Description",
                "Balance",
                "UOM",
                "Quantity",
                "Memo",
            ]],
            body: (record.items || []).map((item) => [
                item.sku || item.product_name || "-",
                item.item_description || item.product_name || "-",
                formatNumber(item.item_balance),
                item.uom || "-",
                formatNumber(item.quantity),
                item.memo || "-",
            ]),
            styles: {
                fontSize: 8,
                cellPadding: 3,
            },
            headStyles: {
                fillColor: [30, 64, 175],
            },
        });

        const finalY = doc.lastAutoTable?.finalY || 100;

        doc.text(
            `Memo: ${record.memo || "-"}`.slice(0, 180),
            14,
            Math.min(finalY + 12, 280)
        );

        doc.save(
            `${record.transaction_number || "Purchase-Requisition"}.pdf`
        );
    };

    /* -------------------------------------------------------------------------- */
    /* Print report                                                               */
    /* -------------------------------------------------------------------------- */

    function escapeHtml(value) {
        return String(value ?? "").replace(/[&<>"']/g, (character) => ({
            "&": "&amp;",
            "<": "&lt;",
            ">": "&gt;",
            '"': "&quot;",
            "'": "&#039;",
        })[character]);
    }

    const printRecord = (record) => {
        if (!record) return;

        const popup = window.open(
            "",
            "_blank",
            "width=900,height=700"
        );

        if (!popup) {
            setError(
                "Please allow pop-ups to print the requisition."
            );
            return;
        }

        const rows = (record.items || [])
            .map((item) => `
                <tr>
                    <td>${escapeHtml(item.sku || item.product_name || "-")}</td>
                    <td>${escapeHtml(item.item_description || item.product_name || "-")}</td>
                    <td>${escapeHtml(formatNumber(item.item_balance))}</td>
                    <td>${escapeHtml(item.uom || "-")}</td>
                    <td>${escapeHtml(formatNumber(item.quantity))}</td>
                    <td>${escapeHtml(item.memo || "-")}</td>
                </tr>
            `)
            .join("");

        popup.document.write(`
            <!DOCTYPE html>
            <html>
            <head>
                <title>Purchase Requisition ${escapeHtml(record.transaction_number)}</title>
                <style>
                    body {
                        font-family: Arial, sans-serif;
                        padding: 30px;
                        color: #111827;
                    }

                    h1 {
                        color: #1d4ed8;
                    }

                    .details {
                        display: grid;
                        grid-template-columns: 1fr 1fr 1fr;
                        gap: 15px;
                        margin: 25px 0;
                    }

                    .details div {
                        border: 1px solid #ddd;
                        padding: 12px;
                        border-radius: 8px;
                    }

                    table {
                        width: 100%;
                        border-collapse: collapse;
                        margin-top: 20px;
                    }

                    th, td {
                        border: 1px solid #ddd;
                        padding: 9px;
                        text-align: left;
                        font-size: 12px;
                    }

                    th {
                        background: #eff6ff;
                    }

                    @media print {
                        body {
                            padding: 0;
                        }
                    }
                </style>
            </head>
            <body>
                <h1>Purchase Requisition</h1>

                <p>
                    <strong>Transaction No:</strong>
                    ${escapeHtml(record.transaction_number)}
                </p>

                <div class="details">
                    <div>
                        <strong>Date</strong><br>
                        ${escapeHtml(formatDate(record.transaction_date))}
                    </div>

                    <div>
                        <strong>Status</strong><br>
                        ${escapeHtml(record.status)}
                    </div>

                    <div>
                        <strong>Location</strong><br>
                        ${escapeHtml(record.warehouse_name || "-")}
                    </div>

                    <div>
                        <strong>Department</strong><br>
                        ${escapeHtml(record.department || "-")}
                    </div>

                    <div>
                        <strong>Class</strong><br>
                        ${escapeHtml(record.class_name || "-")}
                    </div>

                    <div>
                        <strong>Project</strong><br>
                        ${escapeHtml(record.project || "-")}
                    </div>
                </div>

                <table>
                    <thead>
                        <tr>
                            <th>Item</th>
                            <th>Description</th>
                            <th>Balance</th>
                            <th>UOM</th>
                            <th>Quantity</th>
                            <th>Memo</th>
                        </tr>
                    </thead>

                    <tbody>
                        ${rows}
                    </tbody>
                </table>

                <p>
                    <strong>Reference:</strong>
                    ${escapeHtml(record.reference_number || "-")}
                </p>

                <p>
                    <strong>Memo:</strong>
                    ${escapeHtml(record.memo || "-")}
                </p>

                <script>
                    window.onload = () => window.print();
                <\/script>
            </body>
            </html>
        `);

        popup.document.close();
    };

    /* -------------------------------------------------------------------------- */
    /* Loading and permission screens                                             */
    /* -------------------------------------------------------------------------- */

    if (permissionLoading || loading) {


        if (permissionLoading) {
            return (
                <div className="flex min-h-[300px] items-center justify-center">
                    <div className="text-sm text-gray-500">
                        Checking permissions...
                    </div>
                </div>
            );
        }

        if (!rights.canView) {
            return (
                <div className="flex min-h-[300px] items-center justify-center">
                    <div className="rounded-lg border border-red-200 bg-red-50 p-6 text-center dark:border-red-900 dark:bg-red-950">
                        <h2 className="text-lg font-semibold text-red-600">
                            Access Denied
                        </h2>
                        <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">
                            You do not have permission to view Purchase Requisitions.
                        </p>
                    </div>
                </div>
            );
        }
        return (
            <div className="flex min-h-[60vh] items-center justify-center bg-slate-50 dark:bg-slate-950">
                <div className="text-center">
                    <div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-blue-100 border-t-blue-600" />

                    <p className="mt-4 text-sm text-slate-500">
                        Loading purchase requisitions...
                    </p>
                </div>
            </div>
        );
    }

    if (!rights.canView) {
        return (
            <div className="flex min-h-[60vh] items-center justify-center p-6">
                <div className={`${cardClass} max-w-md p-8 text-center`}>
                    <h2 className="text-xl font-bold text-red-600">
                        Access Denied
                    </h2>

                    <p className="mt-2 text-sm text-slate-500">
                        You do not have permission to view Purchase Requisitions.
                    </p>
                </div>
            </div>
        );
    }

    const tabs = [
        { id: "lines", label: "Transaction Lines" },
        { id: "related", label: "Related Transactions" },
        { id: "system", label: "System Information" },
        { id: "attachments", label: "Attachments" },
    ];

    /* -------------------------------------------------------------------------- */
    /* Main page                                                                  */
    /* -------------------------------------------------------------------------- */

    return (
        <div className="min-h-full bg-slate-50/80 p-4 text-slate-900 dark:bg-slate-950 dark:text-slate-100 sm:p-6 lg:p-8">
            <div className="mx-auto max-w-[1600px] space-y-6">

                {/* Header */}
                <header className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-blue-700 via-blue-600 to-emerald-600 p-6 text-white shadow-xl sm:p-8">
                    <div className="absolute -right-12 -top-20 h-64 w-64 rounded-full border-[35px] border-white/10" />

                    <div className="relative flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                            <span className="inline-flex rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-xs font-bold tracking-wide">
                                PROCUREMENT MANAGEMENT
                            </span>

                            <h1 className="mt-3 text-3xl font-extrabold sm:text-4xl">
                                Purchase Requisitions
                            </h1>

                            <p className="mt-2 max-w-2xl text-sm leading-6 text-blue-50">
                                Create and manage internal requests for goods before converting them into RFQs or Purchase Orders.
                            </p>
                        </div>

                        {!showForm && !selected && rights.canCreate && (
                            <button
                                onClick={startCreate}
                                className="inline-flex items-center justify-center gap-2 rounded-xl bg-white px-5 py-3.5 text-sm font-bold text-blue-700 shadow-lg hover:bg-emerald-50"
                            >
                                <Icon name="plus" />
                                New Requisition
                            </button>
                        )}
                    </div>
                </header>

                {/* Success message */}
                {message && (
                    <div className="flex items-center justify-between gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-300">
                        <span>{message}</span>

                        <button
                            type="button"
                            onClick={() => setMessage("")}
                            aria-label="Dismiss message"
                        >
                            <Icon name="close" />
                        </button>
                    </div>
                )}

                {/* Error message */}
                {error && (
                    <div className="flex items-center justify-between gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300">
                        <span>{error}</span>

                        <button
                            type="button"
                            onClick={() => setError("")}
                            aria-label="Dismiss error"
                        >
                            <Icon name="close" />
                        </button>
                    </div>
                )}

                {/* ---------------------------------------------------------------- */}
                {/* Create / Edit Form                                               */}
                {/* ---------------------------------------------------------------- */}

                {showForm && (
                    <div className="space-y-6">

                        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                            <div>
                                <h2 className="text-2xl font-extrabold">
                                    {editingId
                                        ? "Edit Purchase Requisition"
                                        : "Create Purchase Requisition"}
                                </h2>

                                <p className="mt-1 text-sm text-slate-500">
                                    Enter the request details and required items.
                                </p>
                            </div>

                            <button
                                type="button"
                                onClick={resetForm}
                                disabled={saving}
                                className={secondaryButton}
                            >
                                <Icon name="arrow" />
                                Back to History
                            </button>
                        </div>

                        <form
                            onSubmit={saveRequisition}
                            className="space-y-6"
                        >
                            {/* Transaction Information */}
                            <section className={`${cardClass} p-5 sm:p-7`}>
                                <SectionHeading
                                    icon="clipboard"
                                    title="Transaction Information"
                                    description="General requisition information and organizational details."
                                />

                                <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">

                                    <div>
                                        <label className={labelClass}>
                                            Transaction Number
                                        </label>

                                        <input
                                            readOnly
                                            value={
                                                editingId
                                                    ? selected?.transaction_number || "Existing requisition"
                                                    : "TO BE GENERATED"
                                            }
                                            className={`${inputClass} bg-slate-50 font-bold text-blue-700 dark:bg-slate-800 dark:text-sky-300`}
                                        />
                                    </div>

                                    <div>
                                        <label className={labelClass}>
                                            Transaction Date *
                                        </label>

                                        <input
                                            type="date"
                                            required
                                            value={form.transactionDate}
                                            onChange={(e) =>
                                                updateForm("transactionDate", e.target.value)
                                            }
                                            className={inputClass}
                                        />
                                    </div>

                                    <div>
                                        <label className={labelClass}>
                                            Status
                                        </label>

                                        <select
                                            value={form.status}
                                            onChange={(e) =>
                                                updateForm("status", e.target.value)
                                            }
                                            className={inputClass}
                                        >
                                            {[
                                                "DRAFT",
                                                "SUBMITTED",
                                                "APPROVED",
                                                "REJECTED",
                                            ].map((status) => (
                                                <option key={status} value={status}>
                                                    {status}
                                                </option>
                                            ))}
                                        </select>
                                    </div>

                                    <div>
                                        <label className={labelClass}>
                                            Subsidiary / Company
                                        </label>

                                        <input
                                            readOnly
                                            value="Current user's company"
                                            className={`${inputClass} bg-slate-50 dark:bg-slate-800`}
                                        />

                                        <p className="mt-1 text-xs text-slate-400">
                                            Company is assigned automatically from your login.
                                        </p>
                                    </div>

                                    <div>
                                        <label className={labelClass}>
                                            Department
                                        </label>

                                        <input
                                            value={form.department}
                                            onChange={(e) =>
                                                updateForm("department", e.target.value)
                                            }
                                            placeholder="Enter department"
                                            className={inputClass}
                                        />
                                    </div>

                                    <div>
                                        <label className={labelClass}>
                                            From Location *
                                        </label>

                                        <select
                                            required
                                            value={form.warehouseId}
                                            onChange={(e) =>
                                                updateForm("warehouseId", e.target.value)
                                            }
                                            className={inputClass}
                                        >
                                            <option value="">
                                                Select location
                                            </option>

                                            {warehouses
                                                .filter((w) => w.is_active)
                                                .map((w) => (
                                                    <option
                                                        key={w.warehouse_id}
                                                        value={w.warehouse_id}
                                                    >
                                                        {w.warehouse_code} - {w.warehouse_name}
                                                    </option>
                                                ))}
                                        </select>
                                    </div>

                                    <div>
                                        <label className={labelClass}>
                                            Class
                                        </label>

                                        <input
                                            value={form.className}
                                            onChange={(e) =>
                                                updateForm("className", e.target.value)
                                            }
                                            placeholder="Enter class"
                                            className={inputClass}
                                        />
                                    </div>

                                    <div>
                                        <label className={labelClass}>
                                            Reference Number
                                        </label>

                                        <input
                                            value={form.referenceNumber}
                                            onChange={(e) =>
                                                updateForm("referenceNumber", e.target.value)
                                            }
                                            placeholder="Optional reference"
                                            className={inputClass}
                                        />
                                    </div>

                                    <div>
                                        <label className={labelClass}>
                                            Project
                                        </label>

                                        <input
                                            value={form.project}
                                            onChange={(e) =>
                                                updateForm("project", e.target.value)
                                            }
                                            placeholder="Enter project"
                                            className={inputClass}
                                        />
                                    </div>

                                    <div className="md:col-span-2 lg:col-span-3">
                                        <label className={labelClass}>
                                            Memo
                                        </label>

                                        <textarea
                                            rows={3}
                                            value={form.memo}
                                            onChange={(e) =>
                                                updateForm("memo", e.target.value)
                                            }
                                            placeholder="Enter internal request notes..."
                                            className={inputClass}
                                        />
                                    </div>
                                </div>
                            </section>

                            {/* Requisition Details */}
                            <section className={`${cardClass} overflow-hidden`}>
                                <div className="border-b border-slate-200 p-5 dark:border-slate-800 sm:p-7">

                                    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                                        <SectionHeading
                                            icon="package"
                                            title="Requisition Details"
                                            description="Add the items and quantities requested."
                                        />

                                        {activeTab === "lines" && (
                                            <button
                                                type="button"
                                                onClick={addItem}
                                                className={primaryButton}
                                            >
                                                <Icon name="plus" />
                                                Add Item
                                            </button>
                                        )}
                                    </div>

                                    <div className="flex flex-wrap gap-2 border-b border-slate-200 dark:border-slate-800">
                                        {tabs.map((tab) => (
                                            <button
                                                type="button"
                                                key={tab.id}
                                                onClick={() => setActiveTab(tab.id)}
                                                className={`border-b-2 px-3 py-3 text-sm font-semibold transition ${activeTab === tab.id
                                                        ? "border-blue-600 text-blue-700 dark:text-sky-300"
                                                        : "border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-white"
                                                    }`}
                                            >
                                                {tab.label}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {/* Transaction Lines */}
                                {activeTab === "lines" && (
                                    <>
                                        <div className="grid gap-3 border-b border-slate-100 bg-slate-50/70 p-5 dark:border-slate-800 dark:bg-slate-950/40 sm:grid-cols-3">

                                            <div className="rounded-xl border border-blue-100 bg-blue-50 p-4 dark:border-blue-900 dark:bg-blue-950/30">
                                                <p className="text-xs font-semibold text-blue-700 dark:text-blue-300">
                                                    Item Lines
                                                </p>

                                                <p className="mt-1 text-2xl font-extrabold text-blue-800 dark:text-blue-200">
                                                    {items.length}
                                                </p>
                                            </div>

                                            <div className="rounded-xl border border-emerald-100 bg-emerald-50 p-4 dark:border-emerald-900 dark:bg-emerald-950/30">
                                                <p className="text-xs font-semibold text-emerald-700 dark:text-emerald-300">
                                                    Total Requested Quantity
                                                </p>

                                                <p className="mt-1 text-2xl font-extrabold text-emerald-800 dark:text-emerald-200">
                                                    {formatNumber(totalQuantity)}
                                                </p>
                                            </div>

                                            <div className="rounded-xl border border-amber-100 bg-amber-50 p-4 dark:border-amber-900 dark:bg-amber-950/30">
                                                <p className="text-xs font-semibold text-amber-700 dark:text-amber-300">
                                                    Document Status
                                                </p>

                                                <p className="mt-1 text-sm font-bold text-amber-800 dark:text-amber-200">
                                                    Pending Purchase Order / RFQ
                                                </p>
                                            </div>
                                        </div>

                                        <div className="overflow-x-auto">
                                            <table className="w-full min-w-[1150px] text-left">
                                                <thead>
                                                    <tr>
                                                        {[
                                                            "Item Name",
                                                            "Item Description",
                                                            "Item Balance",
                                                            "UOM",
                                                            "Quantity",
                                                            "Memo",
                                                            "Action",
                                                        ].map((heading) => (
                                                            <th
                                                                key={heading}
                                                                className="border-b border-slate-200 bg-slate-50 px-4 py-3 text-xs font-bold uppercase tracking-wide text-slate-500 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-400"
                                                            >
                                                                {heading}
                                                            </th>
                                                        ))}
                                                    </tr>
                                                </thead>

                                                <tbody>
                                                    {items.map((item, index) => (
                                                        <tr
                                                            key={index}
                                                            className="border-b border-slate-100 dark:border-slate-800"
                                                        >
                                                            <td className="min-w-[220px] p-3">
                                                                <select
                                                                    required
                                                                    value={item.productId}
                                                                    onChange={(e) =>
                                                                        updateItem(
                                                                            index,
                                                                            "productId",
                                                                            e.target.value
                                                                        )
                                                                    }
                                                                    className={smallInputClass}
                                                                >
                                                                    <option value="">
                                                                        Select item
                                                                    </option>

                                                                    {products
                                                                        .filter((p) => p.is_active)
                                                                        .map((p) => (
                                                                            <option
                                                                                key={p.product_id}
                                                                                value={p.product_id}
                                                                            >
                                                                                {p.sku} - {p.product_name}
                                                                            </option>
                                                                        ))}
                                                                </select>
                                                            </td>

                                                            <td className="min-w-[210px] p-3">
                                                                <input
                                                                    value={item.description}
                                                                    onChange={(e) =>
                                                                        updateItem(
                                                                            index,
                                                                            "description",
                                                                            e.target.value
                                                                        )
                                                                    }
                                                                    className={smallInputClass}
                                                                    placeholder="Description"
                                                                />
                                                            </td>

                                                            <td className="p-3">
                                                                <input
                                                                    type="number"
                                                                    min="0"
                                                                    step="0.001"
                                                                    value={item.itemBalance}
                                                                    onChange={(e) =>
                                                                        updateItem(
                                                                            index,
                                                                            "itemBalance",
                                                                            e.target.value
                                                                        )
                                                                    }
                                                                    className={smallInputClass}
                                                                />
                                                            </td>

                                                            <td className="min-w-[130px] p-3">
                                                                <select
                                                                    value={item.uom}
                                                                    onChange={(e) =>
                                                                        updateItem(
                                                                            index,
                                                                            "uom",
                                                                            e.target.value
                                                                        )
                                                                    }
                                                                    className={smallInputClass}
                                                                >
                                                                    {units.length
                                                                        ? units
                                                                            .filter((u) => u.is_active)
                                                                            .map((u) => (
                                                                                <option
                                                                                    key={u.unit_id}
                                                                                    value={u.unit_code}
                                                                                >
                                                                                    {u.unit_code} - {u.unit_name}
                                                                                </option>
                                                                            ))
                                                                        : (
                                                                            <option value={item.uom}>
                                                                                {item.uom}
                                                                            </option>
                                                                        )}
                                                                </select>
                                                            </td>

                                                            <td className="p-3">
                                                                <input
                                                                    required
                                                                    type="number"
                                                                    min="0.001"
                                                                    step="0.001"
                                                                    value={item.quantity}
                                                                    onChange={(e) =>
                                                                        updateItem(
                                                                            index,
                                                                            "quantity",
                                                                            e.target.value
                                                                        )
                                                                    }
                                                                    className={smallInputClass}
                                                                />
                                                            </td>

                                                            <td className="min-w-[180px] p-3">
                                                                <input
                                                                    value={item.memo}
                                                                    onChange={(e) =>
                                                                        updateItem(
                                                                            index,
                                                                            "memo",
                                                                            e.target.value
                                                                        )
                                                                    }
                                                                    className={smallInputClass}
                                                                    placeholder="Line memo"
                                                                />
                                                            </td>

                                                            <td className="p-3 text-center">
                                                                <button
                                                                    type="button"
                                                                    onClick={() => removeItem(index)}
                                                                    disabled={items.length === 1}
                                                                    className="rounded-lg border border-red-200 bg-red-50 p-2 text-red-600 disabled:opacity-30 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300"
                                                                    aria-label="Remove line"
                                                                >
                                                                    <Icon name="trash" size={16} />
                                                                </button>
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>

                                        <p className="p-4 text-xs text-slate-500 dark:text-slate-400">
                                            Requested quantities are informational. Saving this requisition does not change warehouse stock or accounting balances.
                                        </p>
                                    </>
                                )}

                                {/* Related Transactions */}
                                {activeTab === "related" && (
                                    <div className="p-8 text-center">
                                        <Icon name="clipboard" size={32} />

                                        <h3 className="mt-3 font-bold">
                                            Related Transactions
                                        </h3>

                                        <p className="mt-2 text-sm text-slate-500">
                                            RFQs and Purchase Orders created from this requisition can be tracked through their respective procurement history pages.
                                        </p>
                                    </div>
                                )}

                                {/* System Information */}
                                {activeTab === "system" && (
                                    <div className="p-6">
                                        <p className="text-sm text-slate-500">
                                            System-generated information is recorded automatically when the requisition is saved.
                                        </p>

                                        <div className="mt-4 rounded-xl bg-slate-50 p-4 text-sm dark:bg-slate-950">
                                            <p>
                                                Created and updated timestamps and user IDs are stored in the database.
                                            </p>
                                        </div>
                                    </div>
                                )}

                                {/* Attachments */}
                                {activeTab === "attachments" && (
                                    <div className="p-8 text-center">
                                        <Icon name="file" size={32} />

                                        <h3 className="mt-3 font-bold">
                                            Attachments
                                        </h3>

                                        <p className="mt-2 text-sm text-slate-500">
                                            File upload and storage can be connected to the attachment workflow.
                                        </p>
                                    </div>
                                )}
                            </section>

                            {/* Form actions */}
                            <div className="flex flex-wrap justify-end gap-3">
                                <button
                                    type="button"
                                    onClick={resetForm}
                                    disabled={saving}
                                    className={secondaryButton}
                                >
                                    Cancel
                                </button>

                                <button
                                    type="submit"
                                    disabled={saving}
                                    className={primaryButton}
                                >
                                    <Icon name="check" />

                                    {saving
                                        ? "Saving..."
                                        : editingId
                                            ? "Save Changes"
                                            : "Save Requisition"}
                                </button>
                            </div>
                        </form>
                    </div>
                )}

                {/* ---------------------------------------------------------------- */}
                {/* Selected Requisition Details                                    */}
                {/* ---------------------------------------------------------------- */}

                {!showForm && selected && (
                    <section className={`${cardClass} overflow-hidden`}>

                        <div className="flex flex-col gap-4 border-b border-slate-200 p-5 dark:border-slate-800 sm:flex-row sm:items-center sm:justify-between sm:p-7">
                            <div>
                                <p className="text-xs font-bold uppercase tracking-wider text-blue-600">
                                    Requisition Details
                                </p>

                                <h2 className="mt-1 text-2xl font-extrabold">
                                    {selected.transaction_number}
                                </h2>

                                <span className={`mt-2 inline-flex rounded-full border px-3 py-1 text-xs font-bold ${statusClass(selected.status)}`}>
                                    {selected.status}
                                </span>
                            </div>

                            <div className="flex flex-wrap gap-2">

                                {rights.canUpdate && (
                                    <button
                                        onClick={() =>
                                            openDetails(selected.requisition_id, true)
                                        }
                                        className={secondaryButton}
                                    >
                                        <Icon name="edit" />
                                        Edit
                                    </button>
                                )}

                                {selected.status === "APPROVED" &&
                                    rights.canCreateRfq && (
                                        <button
                                            type="button"
                                            onClick={() => openRfqModal(selected)}
                                            disabled={rfqLoading}
                                            className="inline-flex items-center gap-2 rounded-xl bg-purple-600 px-4 py-3 text-sm font-semibold text-white shadow-md transition hover:bg-purple-700 disabled:opacity-50"
                                        >
                                            <Icon name="clipboard" />
                                            {rfqLoading
                                                ? "Preparing RFQ..."
                                                : "Create RFQ"}
                                        </button>
                                    )}

                                <button
                                    onClick={() => printRecord(selected)}
                                    className={secondaryButton}
                                >
                                    <Icon name="printer" />
                                    Print
                                </button>

                                <button
                                    onClick={() => downloadPDF(selected)}
                                    className={primaryButton}
                                >
                                    <Icon name="download" />
                                    PDF
                                </button>

                                {rights.canDelete && (
                                    <button
                                        onClick={() =>
                                            deleteRequisition(selected.requisition_id)
                                        }
                                        className="inline-flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300"
                                    >
                                        <Icon name="trash" />
                                        Delete
                                    </button>
                                )}

                                <button
                                    onClick={() => setSelected(null)}
                                    className={secondaryButton}
                                >
                                    Back
                                </button>
                            </div>
                        </div>

                        {/* Requisition information */}
                        <div className="grid gap-4 p-5 sm:grid-cols-2 lg:grid-cols-3 sm:p-7">
                            {[
                                ["Transaction Date", formatDate(selected.transaction_date)],
                                ["Location", selected.warehouse_name || "-"],
                                ["Department", selected.department || "-"],
                                ["Class", selected.class_name || "-"],
                                ["Project", selected.project || "-"],
                                ["Reference Number", selected.reference_number || "-"],
                                [
                                    "Document Status",
                                    selected.document_status || "Pending Purchase Order / RFQ",
                                ],
                            ].map(([label, value]) => (
                                <div
                                    key={label}
                                    className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950"
                                >
                                    <p className="text-xs font-semibold uppercase text-slate-400">
                                        {label}
                                    </p>

                                    <p className="mt-2 font-bold">
                                        {value}
                                    </p>
                                </div>
                            ))}
                        </div>

                        {/* Requisition lines */}
                        <div className="overflow-x-auto p-5 pt-0 sm:p-7 sm:pt-0">
                            <h3 className="mb-3 font-bold">
                                Transaction Lines
                            </h3>

                            <table className="w-full min-w-[750px] text-left text-sm">
                                <thead>
                                    <tr>
                                        {[
                                            "Item",
                                            "Description",
                                            "Balance",
                                            "UOM",
                                            "Quantity",
                                            "Memo",
                                        ].map((heading) => (
                                            <th
                                                key={heading}
                                                className="border-b bg-slate-50 p-3 text-xs font-bold uppercase text-slate-500 dark:border-slate-800 dark:bg-slate-950"
                                            >
                                                {heading}
                                            </th>
                                        ))}
                                    </tr>
                                </thead>

                                <tbody>
                                    {(selected.items || []).map((item) => (
                                        <tr key={item.requisition_item_id}>
                                            <td className="border-b p-3 dark:border-slate-800">
                                                {item.sku || item.product_name || "-"}
                                            </td>

                                            <td className="border-b p-3 dark:border-slate-800">
                                                {item.item_description || "-"}
                                            </td>

                                            <td className="border-b p-3 dark:border-slate-800">
                                                {formatNumber(item.item_balance)}
                                            </td>

                                            <td className="border-b p-3 dark:border-slate-800">
                                                {item.uom || "-"}
                                            </td>

                                            <td className="border-b p-3 font-bold dark:border-slate-800">
                                                {formatNumber(item.quantity)}
                                            </td>

                                            <td className="border-b p-3 dark:border-slate-800">
                                                {item.memo || "-"}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>

                            <div className="mt-5 rounded-xl bg-slate-50 p-4 dark:bg-slate-950">
                                <p className="text-xs font-bold uppercase text-slate-400">
                                    Memo
                                </p>

                                <p className="mt-2 whitespace-pre-wrap text-sm">
                                    {selected.memo || "-"}
                                </p>
                            </div>
                        </div>
                    </section>
                )}

                {/* ---------------------------------------------------------------- */}
                {/* Requisition History                                             */}
                {/* ---------------------------------------------------------------- */}

                {!showForm && !selected && (
                    <>
                        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                            <SummaryCard
                                title="Total Requisitions"
                                value={requisitions.length.toLocaleString("en-PK")}
                                description="All requisition records"
                            />

                            <SummaryCard
                                title="Approved"
                                value={requisitions
                                    .filter((r) => r.status === "APPROVED")
                                    .length.toLocaleString("en-PK")}
                                description="Approved internal requests"
                                accent="green"
                            />

                            <SummaryCard
                                title="Pending Review"
                                value={requisitions
                                    .filter((r) => r.status === "SUBMITTED")
                                    .length.toLocaleString("en-PK")}
                                description="Submitted for review"
                                accent="amber"
                            />
                        </div>

                        <section className={`${cardClass} overflow-hidden`}>
                            <div className="p-5 sm:p-7">
                                <SectionHeading
                                    icon="clipboard"
                                    title="Requisition History"
                                    description="Search, review, edit, and report internal purchase requests."
                                    action={
                                        <span className="rounded-full bg-blue-50 px-3 py-2 text-xs font-bold text-blue-700 dark:bg-blue-950/40 dark:text-blue-300">
                                            {filtered.length} records
                                        </span>
                                    }
                                />

                                <div className="flex flex-col gap-3 sm:flex-row">
                                    <div className="relative flex-1">
                                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                                            <Icon name="search" />
                                        </span>

                                        <input
                                            value={search}
                                            onChange={(e) =>
                                                setSearch(e.target.value)
                                            }
                                            placeholder="Search transaction, location, department, status..."
                                            className={`${inputClass} pl-11`}
                                        />
                                    </div>

                                    <button
                                        onClick={fetchData}
                                        disabled={loading}
                                        className={secondaryButton}
                                    >
                                        <Icon name="refresh" />
                                        {loading ? "Refreshing..." : "Refresh"}
                                    </button>
                                </div>
                            </div>

                            <div className="overflow-x-auto">
                                <table className="w-full min-w-[1150px] text-left">
                                    <thead>
                                        <tr>
                                            {[
                                                "Actions",
                                                "Trandate",
                                                "Transaction Number",
                                                "Location Name",
                                                "Status",
                                                "Created From",
                                                "Department",
                                                "Class",
                                                "Document Status",
                                            ].map((heading) => (
                                                <th
                                                    key={heading}
                                                    className="border-y border-slate-100 bg-slate-50 px-4 py-3 text-xs font-bold uppercase tracking-wide text-slate-500 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-400"
                                                >
                                                    {heading}
                                                </th>
                                            ))}
                                        </tr>
                                    </thead>

                                    <tbody>
                                        {filtered.map((record) => (
                                            <tr
                                                key={record.requisition_id}
                                                className="hover:bg-blue-50/50 dark:hover:bg-slate-800/50"
                                            >
                                                <td className="whitespace-nowrap p-3">
                                                    <div className="flex gap-1.5">
                                                        <button
                                                            title="View"
                                                            onClick={() =>
                                                                openDetails(record.requisition_id)
                                                            }
                                                            className="rounded-lg border border-sky-200 bg-sky-50 p-2 text-sky-700 dark:border-sky-900 dark:bg-sky-950/40 dark:text-sky-300"
                                                        >
                                                            <Icon name="eye" size={15} />
                                                        </button>

                                                        {rights.canUpdate && (
                                                            <button
                                                                title="Edit"
                                                                onClick={() =>
                                                                    openDetails(record.requisition_id, true)
                                                                }
                                                                className="rounded-lg border border-emerald-200 bg-emerald-50 p-2 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300"
                                                            >
                                                                <Icon name="edit" size={15} />
                                                            </button>
                                                        )}

                                                        {record.status === "APPROVED" &&
                                                            rights.canCreateRfq && (
                                                                <button
                                                                    type="button"
                                                                    title="Create RFQ"
                                                                    onClick={() => openRfqModal(record)}
                                                                    disabled={rfqLoading}
                                                                    className="rounded-lg border border-purple-200 bg-purple-50 p-2 text-purple-700 transition hover:bg-purple-100 disabled:opacity-50 dark:border-purple-900 dark:bg-purple-950/40 dark:text-purple-300"
                                                                >
                                                                    <Icon name="clipboard" size={15} />
                                                                </button>
                                                            )}

                                                        <button
                                                            title="Report / View"
                                                            onClick={() =>
                                                                openDetails(record.requisition_id)
                                                            }
                                                            className="rounded-lg border border-slate-200 bg-white p-2 text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
                                                        >
                                                            <Icon name="file" size={15} />
                                                        </button>

                                                        {rights.canDelete && (
                                                            <button
                                                                title="Delete"
                                                                onClick={() =>
                                                                    deleteRequisition(record.requisition_id)
                                                                }
                                                                className="rounded-lg border border-red-200 bg-red-50 p-2 text-red-600 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300"
                                                            >
                                                                <Icon name="trash" size={15} />
                                                            </button>
                                                        )}
                                                    </div>
                                                </td>

                                                <td className="whitespace-nowrap p-4 text-sm">
                                                    {formatDate(record.transaction_date)}
                                                </td>

                                                <td className="p-4">
                                                    <button
                                                        onClick={() =>
                                                            openDetails(record.requisition_id)
                                                        }
                                                        className="font-bold text-blue-700 hover:underline dark:text-sky-300"
                                                    >
                                                        {record.transaction_number}
                                                    </button>
                                                </td>

                                                <td className="p-4 text-sm">
                                                    {record.warehouse_name || "-"}
                                                </td>

                                                <td className="p-4">
                                                    <span className={`whitespace-nowrap rounded-full border px-2.5 py-1 text-xs font-bold ${statusClass(record.status)}`}>
                                                        {record.status}
                                                    </span>
                                                </td>

                                                <td className="p-4 text-sm">
                                                    {record.reference_number || "-"}
                                                </td>

                                                <td className="p-4 text-sm">
                                                    {record.department || "-"}
                                                </td>

                                                <td className="p-4 text-sm">
                                                    {record.class_name || "-"}
                                                </td>

                                                <td className="p-4 text-sm">
                                                    {record.document_status ||
                                                        "Pending Purchase Order / RFQ"}
                                                </td>
                                            </tr>
                                        ))}

                                        {filtered.length === 0 && (
                                            <tr>
                                                <td colSpan={9} className="p-14 text-center">
                                                    <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-500 dark:bg-slate-800">
                                                        <Icon name="search" size={26} />
                                                    </div>

                                                    <h3 className="mt-4 font-bold">
                                                        No requisitions found
                                                    </h3>

                                                    <p className="mt-1 text-sm text-slate-500">
                                                        {search
                                                            ? "Try a different search term."
                                                            : "Create your first purchase requisition to get started."}
                                                    </p>

                                                    {!search && rights.canCreate && (
                                                        <button
                                                            onClick={startCreate}
                                                            className={`${primaryButton} mt-4`}
                                                        >
                                                            <Icon name="plus" />
                                                            New Requisition
                                                        </button>
                                                    )}
                                                </td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>

                            <div className="border-t border-slate-100 bg-slate-50/70 px-5 py-4 text-xs text-slate-500 dark:border-slate-800 dark:bg-slate-950/50">
                                Showing {filtered.length} of {requisitions.length} requisitions · Procurement Management
                            </div>
                        </section>
                    </>
                )}
            </div>

            {/* ================================================================== */}
            {/* CREATE RFQ MODAL                                                   */}
            {/* ================================================================== */}

            {showRfqModal && rfqSource && (
                <div
                    className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/70 p-3 backdrop-blur-sm sm:p-6"
                    onMouseDown={(event) => {
                        if (event.target === event.currentTarget) {
                            closeRfqModal();
                        }
                    }}
                >
                    <div className="flex max-h-[94vh] w-full max-w-5xl flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-900">

                        {/* Modal Header */}
                        <div className="flex items-center justify-between gap-4 border-b border-slate-200 bg-gradient-to-r from-purple-700 to-indigo-700 px-5 py-5 text-white sm:px-7">
                            <div className="flex items-center gap-3">
                                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/15">
                                    <Icon name="clipboard" size={23} />
                                </div>

                                <div>
                                    <h2 className="text-xl font-extrabold">
                                        Create Request for Quotation
                                    </h2>

                                    <p className="mt-1 text-xs text-purple-100">
                                        Convert an approved Purchase Requisition into an RFQ.
                                    </p>
                                </div>
                            </div>

                            <button
                                type="button"
                                onClick={() => closeRfqModal()}
                                disabled={rfqSaving}
                                className="rounded-xl p-2 text-white transition hover:bg-white/15 disabled:cursor-not-allowed disabled:opacity-40"
                                aria-label="Close RFQ modal"
                            >
                                <Icon name="close" size={22} />
                            </button>
                        </div>

                        {/* Modal Content */}
                        <div className="flex-1 space-y-6 overflow-y-auto p-5 sm:p-7">

                            {/* Source Requisition */}
                            <div className="rounded-2xl border border-purple-200 bg-purple-50 p-5 dark:border-purple-900 dark:bg-purple-950/30">
                                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                                    <div>
                                        <p className="text-xs font-bold uppercase tracking-wider text-purple-600 dark:text-purple-300">
                                            Source Purchase Requisition
                                        </p>

                                        <h3 className="mt-1 text-xl font-extrabold text-purple-900 dark:text-purple-100">
                                            {rfqSource.transaction_number}
                                        </h3>
                                    </div>

                                    <span className={`inline-flex w-fit rounded-full border px-3 py-1.5 text-xs font-bold ${statusClass(rfqSource.status)}`}>
                                        {rfqSource.status}
                                    </span>
                                </div>

                                <div className="mt-4 grid gap-3 sm:grid-cols-3">
                                    <div className="rounded-xl bg-white/80 p-3 dark:bg-slate-900/70">
                                        <p className="text-xs text-slate-500 dark:text-slate-400">
                                            Requisition Date
                                        </p>

                                        <p className="mt-1 font-bold text-slate-900 dark:text-white">
                                            {formatDate(rfqSource.transaction_date)}
                                        </p>
                                    </div>

                                    <div className="rounded-xl bg-white/80 p-3 dark:bg-slate-900/70">
                                        <p className="text-xs text-slate-500 dark:text-slate-400">
                                            Requested Items
                                        </p>

                                        <p className="mt-1 font-bold text-slate-900 dark:text-white">
                                            {(rfqSource.items || []).length} Lines
                                        </p>
                                    </div>

                                    <div className="rounded-xl bg-white/80 p-3 dark:bg-slate-900/70">
                                        <p className="text-xs text-slate-500 dark:text-slate-400">
                                            Location
                                        </p>

                                        <p className="mt-1 font-bold text-slate-900 dark:text-white">
                                            {rfqSource.warehouse_name || "-"}
                                        </p>
                                    </div>
                                </div>
                            </div>

                            {/* RFQ Information */}
                            <section>
                                <h3 className="mb-4 flex items-center gap-2 text-base font-extrabold text-slate-900 dark:text-white">
                                    <Icon name="calendar" />
                                    RFQ Information
                                </h3>

                                <div className="grid gap-4 sm:grid-cols-2">
                                    <div>
                                        <label className={labelClass}>
                                            RFQ Transaction Number
                                        </label>

                                        <input
                                            readOnly
                                            value="TO BE GENERATED"
                                            className={`${inputClass} bg-slate-50 font-bold text-purple-700 dark:bg-slate-950 dark:text-purple-300`}
                                        />
                                    </div>

                                    <div>
                                        <label className={labelClass}>
                                            RFQ Date *
                                        </label>

                                        <input
                                            type="date"
                                            required
                                            value={rfqDate}
                                            max="9999-12-31"
                                            disabled={rfqSaving}
                                            onChange={(e) =>
                                                setRfqDate(e.target.value)
                                            }
                                            className={inputClass}
                                        />
                                    </div>

                                    <div>
                                        <label className={labelClass}>
                                            Initial Status *
                                        </label>

                                        <select
                                            required
                                            value={rfqStatus}
                                            disabled={rfqSaving}
                                            onChange={(e) => setRfqStatus(e.target.value)}
                                            className={inputClass}
                                        >
                                            <option value="DRAFT">DRAFT</option>
                                            <option value="APPROVED">APPROVED</option>
                                            <option value="SENT">SENT</option>
                                            <option value="PARTIALLY_RECEIVED">PARTIALLY RECEIVED</option>
                                            <option value="RECEIVED">RECEIVED</option>
                                            <option value="CLOSED">CLOSED</option>
                                            <option value="CANCELLED">CANCELLED</option>
                                        </select>
                                    </div>

                                    <div>
                                        <label className={labelClass}>
                                            Project
                                        </label>

                                        <input
                                            readOnly
                                            value={rfqSource.project || "-"}
                                            className={`${inputClass} bg-slate-50 dark:bg-slate-950`}
                                        />
                                    </div>
                                </div>
                            </section>

                            {/* Items to be transferred */}
                            <section>
                                <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                                    <div>
                                        <h3 className="flex items-center gap-2 text-base font-extrabold text-slate-900 dark:text-white">
                                            <Icon name="package" />
                                            Requisition Items
                                        </h3>

                                        <p className="mt-1 text-xs text-slate-500">
                                            All approved requisition lines will be transferred to this RFQ.
                                        </p>
                                    </div>

                                    <span className="rounded-full bg-blue-50 px-3 py-2 text-xs font-bold text-blue-700 dark:bg-blue-950/40 dark:text-blue-300">
                                        {(rfqSource.items || []).length} Items
                                    </span>
                                </div>

                                <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
                                    <table className="w-full min-w-[650px] text-left text-sm">
                                        <thead>
                                            <tr className="bg-slate-50 dark:bg-slate-950">
                                                {[
                                                    "Item",
                                                    "Description",
                                                    "UOM",
                                                    "Requested Quantity",
                                                ].map((heading) => (
                                                    <th
                                                        key={heading}
                                                        className="border-b border-slate-200 px-4 py-3 text-xs font-bold uppercase text-slate-500 dark:border-slate-800 dark:text-slate-400"
                                                    >
                                                        {heading}
                                                    </th>
                                                ))}
                                            </tr>
                                        </thead>

                                        <tbody>
                                            {(rfqSource.items || []).map((item) => (
                                                <tr
                                                    key={item.requisition_item_id}
                                                    className="border-b border-slate-100 last:border-0 dark:border-slate-800"
                                                >
                                                    <td className="px-4 py-3 font-semibold">
                                                        {item.sku || item.product_name || "-"}
                                                    </td>

                                                    <td className="px-4 py-3 text-slate-600 dark:text-slate-300">
                                                        {item.item_description || item.product_name || "-"}
                                                    </td>

                                                    <td className="px-4 py-3">
                                                        {item.uom || "-"}
                                                    </td>

                                                    <td className="px-4 py-3 font-bold">
                                                        {formatNumber(item.quantity)}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </section>

                            {/* Supplier Selection */}
                            <section>
                                <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                                    <div>
                                        <h3 className="flex items-center gap-2 text-base font-extrabold text-slate-900 dark:text-white">
                                            <Icon name="users" />
                                            Select Suppliers
                                        </h3>

                                        <p className="mt-1 text-xs text-slate-500">
                                            Select the suppliers who should receive this RFQ.
                                        </p>
                                    </div>

                                    <div className="flex flex-wrap gap-2">
                                        <button
                                            type="button"
                                            onClick={selectAllRfqSuppliers}
                                            disabled={rfqSaving || !rfqSuppliers.length}
                                            className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-xs font-bold text-blue-700 hover:bg-blue-100 disabled:opacity-50 dark:border-blue-900 dark:bg-blue-950/40 dark:text-blue-300"
                                        >
                                            Select All
                                        </button>

                                        <button
                                            type="button"
                                            onClick={clearRfqSuppliers}
                                            disabled={rfqSaving || !rfqSelectedSuppliers.length}
                                            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-300"
                                        >
                                            Clear Selection
                                        </button>
                                    </div>
                                </div>

                                <div className="mb-3 flex items-center justify-between rounded-xl bg-slate-50 px-4 py-3 dark:bg-slate-950">
                                    <span className="text-sm font-semibold text-slate-600 dark:text-slate-300">
                                        Selected Suppliers
                                    </span>

                                    <span className="rounded-full bg-purple-100 px-3 py-1 text-sm font-extrabold text-purple-700 dark:bg-purple-950 dark:text-purple-300">
                                        {rfqSelectedSuppliers.length} / {rfqSuppliers.length}
                                    </span>
                                </div>

                                <div className="grid gap-3 sm:grid-cols-2">
                                    {rfqSuppliers.map((supplier) => {
                                        const supplierId = Number(
                                            supplier.supplier_id
                                        );

                                        const checked =
                                            rfqSelectedSuppliers.includes(
                                                supplierId
                                            );

                                        const supplierName =
                                            supplier.supplier_name ||
                                            supplier.name ||
                                            supplier.company_name ||
                                            supplier.vendor_name ||
                                            `Supplier #${supplierId}`;

                                        return (
                                            <label
                                                key={supplierId}
                                                className={`flex cursor-pointer items-center gap-3 rounded-xl border p-4 transition ${checked
                                                        ? "border-purple-400 bg-purple-50 dark:border-purple-700 dark:bg-purple-950/40"
                                                        : "border-slate-200 bg-white hover:border-slate-300 dark:border-slate-800 dark:bg-slate-950 dark:hover:border-slate-600"
                                                    } ${rfqSaving ? "cursor-not-allowed opacity-60" : ""}`}
                                            >
                                                <input
                                                    type="checkbox"
                                                    checked={checked}
                                                    disabled={rfqSaving}
                                                    onChange={() =>
                                                        toggleRfqSupplier(supplierId)
                                                    }
                                                    className="h-4 w-4 rounded border-slate-300 text-purple-600 focus:ring-purple-500"
                                                />

                                                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                                                    <Icon name="building" size={19} />
                                                </span>

                                                <span className="min-w-0 flex-1">
                                                    <span className="block truncate text-sm font-bold text-slate-900 dark:text-white">
                                                        {supplierName}
                                                    </span>

                                                    <span className="mt-1 block text-xs text-slate-500">
                                                        {supplier.supplier_code ||
                                                            supplier.code ||
                                                            `Supplier ID: ${supplierId}`}
                                                    </span>
                                                </span>

                                                {checked && (
                                                    <span className="text-purple-600 dark:text-purple-300">
                                                        <Icon name="check" size={19} />
                                                    </span>
                                                )}
                                            </label>
                                        );
                                    })}
                                </div>

                                {!rfqSuppliers.length && (
                                    <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-300">
                                        No active suppliers are available.
                                    </div>
                                )}
                            </section>

                            {/* Conversion information */}
                            <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 dark:border-blue-900 dark:bg-blue-950/30">
                                <div className="flex items-start gap-3">
                                    <span className="mt-0.5 text-blue-600 dark:text-blue-300">
                                        <Icon name="clipboard" size={20} />
                                    </span>

                                    <div>
                                        <p className="text-sm font-bold text-blue-900 dark:text-blue-200">
                                            RFQ Conversion Information
                                        </p>

                                        <p className="mt-1 text-xs leading-5 text-blue-800 dark:text-blue-300">
                                            This operation creates a new RFQ using the selected initial status, transfers the selected requisition items, and adds the selected suppliers as invited vendors. The original Purchase Requisition remains unchanged.
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Modal Footer */}
                        <div className="flex flex-col-reverse gap-3 border-t border-slate-200 bg-slate-50 p-5 dark:border-slate-800 dark:bg-slate-950 sm:flex-row sm:items-center sm:justify-between sm:px-7">
                            <p className="text-xs text-slate-500">
                                {rfqSelectedSuppliers.length} supplier(s) selected
                            </p>

                            <div className="flex flex-wrap justify-end gap-3">
                                <button
                                    type="button"
                                    onClick={() => closeRfqModal()}
                                    disabled={rfqSaving}
                                    className={secondaryButton}
                                >
                                    Cancel
                                </button>

                                <button
                                    type="button"
                                    onClick={createRfqFromRequisition}
                                    disabled={
                                        rfqSaving ||
                                        !rfqSelectedSuppliers.length ||
                                        !rfqDate ||
                                        !rfqSource.items?.length
                                    }
                                    className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 px-6 py-3 text-sm font-bold text-white shadow-lg transition hover:-translate-y-0.5 hover:shadow-xl disabled:cursor-not-allowed disabled:opacity-50"
                                >
                                    {rfqSaving ? (
                                        <>
                                            <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                                            Creating RFQ...
                                        </>
                                    ) : (
                                        <>
                                            <Icon name="check" />
                                            Create RFQ
                                        </>
                                    )}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
