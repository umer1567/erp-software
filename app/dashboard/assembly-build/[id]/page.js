"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useSearchParams, useRouter } from "next/navigation";
import {
    ArrowLeft,
    Save,
    RefreshCw,
    Plus,
    Trash2,
    Package,
    Factory,
    Layers,
    Clock3,
    ClipboardList,
    Calculator,
    FileText,
    X,
    LockKeyhole,
} from "lucide-react";

const API_URL = "/api/assembly-build";
const PERMISSION_KEY = "assembly_build";

const TABS = [
    { id: "components", label: "Components", icon: Package },
    { id: "byproducts", label: "By Products", icon: Layers },
    { id: "accounting", label: "Accounting Lines", icon: Calculator },
    { id: "downtime", label: "Down Time", icon: Clock3 },
    { id: "related", label: "Related Transactions", icon: ClipboardList },
    { id: "system", label: "System Information", icon: FileText },
];

// =========================================================
// HELPERS
// =========================================================

function getRows(data, keys = []) {
    if (Array.isArray(data)) return data;

    for (const key of keys) {
        if (Array.isArray(data?.[key])) return data[key];
        if (Array.isArray(data?.data?.[key])) return data.data[key];
    }

    if (Array.isArray(data?.data)) return data.data;
    if (Array.isArray(data?.records)) return data.records;

    return [];
}

function getErrorMessage(data, fallback) {
    return data?.message || data?.error || fallback;
}

function numberValue(value) {
    const number = Number(value);
    return Number.isFinite(number) ? number : 0;
}

function formatNumber(value) {
    return numberValue(value).toLocaleString(undefined, {
        maximumFractionDigits: 4,
    });
}

function formatDateTime(value) {
    if (!value) return "-";

    const date = new Date(value);

    return Number.isNaN(date.getTime())
        ? "-"
        : date.toLocaleString();
}

function toDateInput(value) {
    if (!value) return "";

    if (typeof value === "string") {
        const match = value.match(/^\d{4}-\d{2}-\d{2}/);
        if (match) return match[0];
    }

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) return "";

    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");

    return `${year}-${month}-${day}`;
}

function toDateTimeLocal(value) {
    if (!value) return "";

    if (typeof value === "string") {
        const match = value.match(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/);
        if (match) return match[0];
    }

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
        return String(value).slice(0, 16);
    }

    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    const hours = String(date.getHours()).padStart(2, "0");
    const minutes = String(date.getMinutes()).padStart(2, "0");

    return `${year}-${month}-${day}T${hours}:${minutes}`;
}

function getProductSku(product) {
    return (
        product?.sku ||
        product?.product_sku ||
        product?.barcode ||
        ""
    );
}

function getComponentName(component) {
    return (
        component?.itemName ||
        component?.item_name ||
        component?.item_description ||
        component?.sub_product_name ||
        component?.product_name ||
        "-"
    );
}

function getBuildName(build) {
    return (
        build?.assembly_name ||
        build?.assembly_product_name ||
        build?.assembly_sub_product_name ||
        build?.item_name ||
        "-"
    );
}

function getItemOptions(products, subProducts) {
    const productOptions = products.map((item) => ({
        type: "PRODUCT",
        id: item.product_id,
        name: item.product_name || item.name || "-",
        sku: getProductSku(item),
        uom: item.unit || item.uom || "",
        productId: item.product_id,
        subProductId: null,
    }));

    const subProductOptions = subProducts.map((item) => ({
        type: "SUB_PRODUCT",
        id: item.sub_product_id,
        name: item.sub_product_name || item.name || "-",
        sku: getProductSku(item),
        uom: item.unit || item.uom || "",
        productId: item.product_id ?? item.parent_product_id,
        subProductId: item.sub_product_id,
    }));

    return [...productOptions, ...subProductOptions].filter(
        (item) => item.id
    );
}

function newByproduct() {
    return {
        rowId: `bp-${Date.now()}-${Math.random()}`,
        productId: "",
        subProductId: "",
        itemDescription: "",
        uom: "",
        quantity: "1",
        unitCost: "0",
        details: "",
    };
}

function newDowntime() {
    return {
        rowId: `dt-${Date.now()}-${Math.random()}`,
        machine: "",
        reason: "",
        startTime: "",
        endTime: "",
        durationMinutes: "0",
        remarks: "",
    };
}

function getStatusClass(status) {
    switch (String(status || "").trim().toUpperCase()) {
        case "APPROVED":
        case "POSTED":
            return "border-emerald-200 bg-emerald-50 text-emerald-700";

        case "CANCELLED":
        case "REJECTED":
            return "border-red-200 bg-red-50 text-red-700";

        default:
            return "border-amber-200 bg-amber-50 text-amber-700";
    }
}

// Handles the common response structures returned by permission APIs.
function getPermissionSource(data) {
    const candidates = [
        data?.permissions?.[PERMISSION_KEY],
        data?.data?.permissions?.[PERMISSION_KEY],
        data?.permission,
        data?.data?.permission,
        data?.permissions,
        data?.data?.permissions,
        data?.data,
        data,
    ];

    for (const candidate of candidates) {
        if (
            candidate &&
            !Array.isArray(candidate) &&
            typeof candidate === "object" &&
            (
                "canView" in candidate ||
                "can_view" in candidate ||
                "canUpdate" in candidate ||
                "can_update" in candidate
            )
        ) {
            return candidate;
        }
    }

    return {};
}

function normalizePermission(data) {
    const source = getPermissionSource(data);

    return {
        canView: Boolean(
            source.canView ??
            source.can_view ??
            false
        ),

        canUpdate: Boolean(
            source.canUpdate ??
            source.can_update ??
            false
        ),
    };
}

function getBuildStatus(build) {
    return String(
        build?.status ??
        build?.document_status ??
        build?.build_status ??
        "DRAFT"
    ).trim().toUpperCase();
}

function isBuildPosted(build) {
    if (!build) return false;

    const postingStatus = String(
        build.posting_status || ""
    ).trim().toUpperCase();

    return Boolean(
        build.posted_at ||
        build.postedAt ||
        build.is_posted === true ||
        build.isPosted === true ||
        build.posted === true ||
        ["POSTED", "YES", "TRUE"].includes(postingStatus)
    );
}

function normalizeByproduct(row, index) {
    return {
        rowId: `byproduct-${row.assembly_build_byproduct_id || index}`,
        productId: row.product_id ? String(row.product_id) : "",
        subProductId: row.sub_product_id
            ? String(row.sub_product_id)
            : "",
        itemDescription: row.item_description || "",
        uom: row.uom || "",
        quantity: String(row.quantity ?? "0"),
        unitCost: String(row.unit_cost ?? "0"),
        details: row.details || "",
    };
}

function normalizeDowntime(row, index) {
    return {
        rowId: `downtime-${row.assembly_build_downtime_id || index}`,
        machine: row.machine || "",
        reason: row.reason || "",
        startTime: toDateTimeLocal(row.start_time),
        endTime: toDateTimeLocal(row.end_time),
        durationMinutes: String(row.duration_minutes ?? "0"),
        remarks: row.remarks || "",
    };
}

function normalizeComponent(component, index) {
    return {
        rowId: `component-${component.assembly_build_component_id || index}`,
        componentId: component.component_id || "",
        productId: component.product_id || null,
        subProductId: component.sub_product_id || null,
        itemDescription: component.item_description || "",
        itemName: getComponentName(component),
        itemSku:
            component.item_sku ||
            component.itemSku ||
            component.sku ||
            "",
        uom: component.uom || "",
        itemBalance: numberValue(component.item_balance),
        requiredQuantity: numberValue(component.required_quantity),
        issuedQuantity: String(component.issued_quantity ?? "0"),
        unitCost: String(component.unit_cost ?? "0"),
        amount: numberValue(component.amount),
        details: component.details || "",
    };
}

// Extract the record from common detail API response structures.
function getAssemblyBuildRecord(data) {
    return (
        data?.assemblyBuild ||
        data?.assembly_build ||
        data?.data?.assemblyBuild ||
        data?.data?.assembly_build ||
        data?.data ||
        null
    );
}

// =========================================================
// FORM COMPONENTS
// =========================================================

function Field({
    label,
    children,
    required = false,
    className = "",
}) {
    return (
        <div className={className}>
            <label className="mb-1.5 block text-xs font-semibold text-slate-600">
                {label}
                {required && (
                    <span className="ml-1 text-red-500">*</span>
                )}
            </label>
            {children}
        </div>
    );
}

function inputClass(disabled = false) {
    return `w-full min-w-0 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-slate-500 focus:ring-2 focus:ring-slate-200 ${
        disabled
            ? "cursor-not-allowed bg-slate-100 text-slate-500"
            : ""
    }`;
}

function Input({
    label,
    value,
    onChange,
    type = "text",
    placeholder = "",
    required = false,
    disabled = false,
    className = "",
    min,
    step,
}) {
    return (
        <Field label={label} required={required} className={className}>
            <input
                type={type}
                value={value ?? ""}
                onChange={(event) => onChange?.(event.target.value)}
                placeholder={placeholder}
                required={required}
                disabled={disabled}
                min={min}
                step={step}
                className={inputClass(disabled)}
            />
        </Field>
    );
}

function Select({
    label,
    value,
    onChange,
    options = [],
    placeholder = "Select...",
    required = false,
    disabled = false,
    className = "",
}) {
    return (
        <Field label={label} required={required} className={className}>
            <select
                value={value ?? ""}
                onChange={(event) => onChange?.(event.target.value)}
                required={required}
                disabled={disabled}
                className={inputClass(disabled)}
            >
                <option value="">{placeholder}</option>

                {options.map((option) => (
                    <option
                        key={option.value}
                        value={option.value}
                        disabled={option.disabled}
                    >
                        {option.label}
                    </option>
                ))}
            </select>
        </Field>
    );
}

function TextArea({
    label,
    value,
    onChange,
    rows = 3,
    placeholder = "",
    className = "",
    disabled = false,
}) {
    return (
        <Field label={label} className={className}>
            <textarea
                value={value ?? ""}
                onChange={(event) => onChange?.(event.target.value)}
                rows={rows}
                placeholder={placeholder}
                disabled={disabled}
                className={`${inputClass(disabled)} resize-y`}
            />
        </Field>
    );
}

function SummaryBox({ label, value, description }) {
    return (
        <div className="rounded-xl border border-slate-200 bg-white p-4">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                {label}
            </p>
            <p className="mt-2 text-xl font-bold text-slate-900">
                {value}
            </p>
            {description && (
                <p className="mt-1 text-xs text-slate-500">
                    {description}
                </p>
            )}
        </div>
    );
}

// =========================================================
// MAIN PAGE
// =========================================================

export default function AssemblyBuildDetailPage() {
    const params = useParams();
    const searchParams = useSearchParams();
    const router = useRouter();

    const buildId = params?.id;
    const viewMode = searchParams.get("mode") === "view";

    const [permissions, setPermissions] = useState({
        canView: false,
        canUpdate: false,
    });

    const [permissionChecked, setPermissionChecked] = useState(false);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [approving, setApproving] = useState(false);
    const [error, setError] = useState("");
    const [activeTab, setActiveTab] = useState("components");

    const [build, setBuild] = useState(null);

    const [warehouses, setWarehouses] = useState([]);
    const [customers, setCustomers] = useState([]);
    const [products, setProducts] = useState([]);
    const [subProducts, setSubProducts] = useState([]);
    const [boms, setBoms] = useState([]);
    const [revisions, setRevisions] = useState([]);

    const [form, setForm] = useState({
        transactionDate: "",
        warehouseId: "",
        customerId: "",
        bomId: "",
        revisionId: "",
        buildQuantity: "1",
        uom: "",
        employee: "",
        machine: "",
        shift: "",
        workOrderNumber: "",
        details: "",
        memo: "",
    });

    const [components, setComponents] = useState([]);
    const [byproducts, setByproducts] = useState([]);
    const [downtime, setDowntime] = useState([]);
    const [bomData, setBomData] = useState(null);

    // =====================================================
    // DOCUMENT STATUS AND PERMISSIONS
    // =====================================================

    const status = getBuildStatus(build);
    const posted = isBuildPosted(build);

    const isDraft = status === "DRAFT";
    const isUnposted = !posted;

    // Editing requires update permission and a DRAFT document.
    // View mode always remains read-only.
    const canEdit = Boolean(
        !viewMode &&
        permissions.canUpdate &&
        isDraft &&
        isUnposted
    );

    // Approval is independent of View/Edit mode.
    // A user must have update permission to approve.
    const canApprove = Boolean(
        permissions.canUpdate &&
        isDraft &&
        isUnposted
    );

    const readOnly = !canEdit;

    // =====================================================
    // FORM UPDATE
    // =====================================================

    const updateForm = useCallback((key, value) => {
        setForm((current) => ({
            ...current,
            [key]: value,
        }));
    }, []);

    // =====================================================
    // LOAD DETAIL, PERMISSIONS AND DROPDOWNS
    // =====================================================

    useEffect(() => {
        if (!buildId) return;

        let active = true;

        async function requestJson(url) {
            const response = await fetch(url, {
                method: "GET",
                cache: "no-store",
            });

            const data = await response.json().catch(() => ({}));

            if (!response.ok || data.success === false) {
                throw new Error(
                    getErrorMessage(data, `Unable to load ${url}.`)
                );
            }

            return data;
        }

        async function loadOptional(url, label) {
            try {
                return await requestJson(url);
            } catch (err) {
                console.warn(
                    `ASSEMBLY BUILD: Unable to load ${label}:`,
                    err.message
                );
                return null;
            }
        }

        async function initialize() {
            setLoading(true);
            setPermissionChecked(false);
            setError("");
            setBuild(null);
            setBomData(null);
            setRevisions([]);

            try {
                // 1. PERMISSIONS

                const permissionData = await requestJson(
                    `/api/permissions/current?permissionKey=${PERMISSION_KEY}`
                );

                if (!active) return;

                const nextPermissions = normalizePermission(permissionData);

                console.log(
                    "ASSEMBLY BUILD PERMISSIONS:",
                    permissionData
                );

                console.log(
                    "ASSEMBLY BUILD NORMALIZED PERMISSIONS:",
                    nextPermissions
                );

                setPermissions(nextPermissions);
                setPermissionChecked(true);

                if (!nextPermissions.canView) {
                    return;
                }

                // 2. DOCUMENT DETAIL

                const detailData = await requestJson(
                    `${API_URL}/${buildId}`
                );

                if (!active) return;

                const record = getAssemblyBuildRecord(detailData);

                if (
                    !record ||
                    !(
                        record.assembly_build_id ||
                        record.id
                    )
                ) {
                    console.error(
                        "ASSEMBLY BUILD DETAIL RESPONSE:",
                        detailData
                    );

                    throw new Error(
                        "Assembly Build record was not returned."
                    );
                }

                console.log("ASSEMBLY BUILD RECORD:", record);
                console.log("ASSEMBLY BUILD STATUS:", getBuildStatus(record));
                console.log("ASSEMBLY BUILD POSTED:", isBuildPosted(record));

                setBuild(record);

                // 3. OPTIONAL DROPDOWNS

                const [
                    bomListData,
                    warehouseData,
                    customerData,
                    productData,
                ] = await Promise.all([
                    loadOptional("/api/bill-of-materials", "BOM list"),
                    loadOptional("/api/warehouses", "warehouses"),
                    loadOptional("/api/customers", "customers"),
                    loadOptional("/api/products", "products"),
                ]);

                if (!active) return;

                // 4. DROPDOWN DATA

                setBoms(
                    getRows(bomListData, [
                        "billOfMaterials",
                        "boms",
                    ])
                );

                setWarehouses(
                    getRows(warehouseData, ["warehouses"])
                );

                setCustomers(
                    getRows(customerData, ["customers"])
                );

                // 5. PRODUCTS AND SUB-PRODUCTS

                const productsList = getRows(productData, ["products"]);

                setProducts(productsList);

                const subProductsList = productsList.flatMap((product) => {
                    const nested = Array.isArray(product.sub_products)
                        ? product.sub_products
                        : [];

                    return nested.map((subProduct) => ({
                        ...subProduct,
                        parent_product_id: product.product_id,
                        parent_product_name: product.product_name || "",
                    }));
                });

                setSubProducts(subProductsList);

                // 6. HEADER FORM

                setForm({
                    transactionDate: toDateInput(record.transaction_date),
                    warehouseId: String(record.warehouse_id ?? ""),
                    customerId: record.customer_id
                        ? String(record.customer_id)
                        : "",
                    bomId: String(record.bom_id ?? ""),
                    revisionId: String(record.revision_id ?? ""),
                    buildQuantity: String(record.build_quantity ?? "1"),
                    uom: record.uom || "",
                    employee: record.employee || "",
                    machine: record.machine || "",
                    shift: record.shift || "",
                    workOrderNumber: record.work_order_number || "",
                    details: record.details || "",
                    memo: record.memo || "",
                });

                // 7. COMPONENTS

                setComponents(
                    (record.components || []).map(normalizeComponent)
                );

                // 8. BY-PRODUCTS

                setByproducts(
                    (record.byproducts || []).map(normalizeByproduct)
                );

                // 9. DOWNTIME

                setDowntime(
                    (record.downtime || []).map(normalizeDowntime)
                );

                // 10. BOM INFORMATION

                if (record.bom_id) {
                    const bomResponse = await loadOptional(
                        `${API_URL}/bom/${record.bom_id}?warehouseId=${encodeURIComponent(
                            record.warehouse_id || ""
                        )}`,
                        "BOM details"
                    );

                    if (!active) return;

                    const selectedBom =
                        bomResponse?.bom ||
                        bomResponse?.data?.bom ||
                        bomResponse?.data;

                    if (selectedBom) {
                        setBomData(selectedBom);
                        setRevisions(selectedBom.revisions || []);
                    }
                }
            } catch (err) {
                if (active) {
                    console.error(
                        "ASSEMBLY BUILD INITIALIZATION ERROR:",
                        err
                    );

                    setError(
                        err.message || "Unable to load Assembly Build."
                    );
                }
            } finally {
                if (active) {
                    setPermissionChecked(true);
                    setLoading(false);
                }
            }
        }

        initialize();

        return () => {
            active = false;
        };
    }, [buildId]);

    // =====================================================
    // DROPDOWN OPTIONS
    // =====================================================

    const warehouseOptions = useMemo(
        () =>
            warehouses
                .filter((item) => item.is_active !== false)
                .map((item) => ({
                    value: String(item.warehouse_id),
                    label:
                        item.warehouse_name ||
                        item.name ||
                        `Warehouse ${item.warehouse_id}`,
                }))
                .filter((item) => item.value),
        [warehouses]
    );

    const customerOptions = useMemo(
        () =>
            customers
                .filter((item) => item.is_active !== false)
                .map((item) => ({
                    value: String(item.customer_id ?? item.id ?? ""),
                    label:
                        item.customer_name ||
                        item.name ||
                        item.company_name ||
                        `Customer ${item.customer_id ?? item.id}`,
                }))
                .filter((item) => item.value),
        [customers]
    );

    const bomOptions = useMemo(
        () =>
            boms.map((item) => ({
                value: String(item.bom_id),
                label:
                    `${item.bom_name || `BOM ${item.bom_id}`}` +
                    (
                        item.assembly_product_name
                            ? ` — ${item.assembly_product_name}`
                            : item.assembly_sub_product_name
                                ? ` — ${item.assembly_sub_product_name}`
                                : ""
                    ),
            })),
        [boms]
    );

    const revisionOptions = useMemo(
        () =>
            revisions.map((revision) => ({
                value: String(revision.revision_id),
                label:
                    revision.revision_name ||
                    `Revision ${revision.revision_id}`,
            })),
        [revisions]
    );

    const itemOptions = useMemo(
        () => getItemOptions(products, subProducts),
        [products, subProducts]
    );

    // =====================================================
    // COMPONENT UPDATE
    // =====================================================

    function updateComponent(index, key, value) {
        if (!canEdit) return;

        setComponents((current) =>
            current.map((component, rowIndex) =>
                rowIndex === index
                    ? { ...component, [key]: value }
                    : component
            )
        );
    }

    // =====================================================
    // BY-PRODUCT ACTIONS
    // =====================================================

    function addByproduct() {
        if (!canEdit) return;

        setByproducts((current) => [
            ...current,
            newByproduct(),
        ]);
    }

    function updateByproduct(index, key, value) {
        if (!canEdit) return;

        setByproducts((current) =>
            current.map((row, rowIndex) => {
                if (rowIndex !== index) return row;

                const updated = {
                    ...row,
                    [key]: value,
                };

                if (key === "itemKey") {
                    const selected = itemOptions.find(
                        (item) => `${item.type}-${item.id}` === value
                    );

                    updated.productId = selected?.productId
                        ? String(selected.productId)
                        : "";

                    updated.subProductId = selected?.subProductId
                        ? String(selected.subProductId)
                        : "";

                    updated.itemDescription = selected?.name || "";
                    updated.uom = selected?.uom || "";
                }

                return updated;
            })
        );
    }

    function removeByproduct(index) {
        if (!canEdit) return;

        setByproducts((current) =>
            current.filter((_, rowIndex) => rowIndex !== index)
        );
    }

    // =====================================================
    // DOWNTIME ACTIONS
    // =====================================================

    function addDowntime() {
        if (!canEdit) return;

        setDowntime((current) => [
            ...current,
            newDowntime(),
        ]);
    }

    function updateDowntime(index, key, value) {
        if (!canEdit) return;

        setDowntime((current) =>
            current.map((row, rowIndex) => {
                if (rowIndex !== index) return row;

                const updated = {
                    ...row,
                    [key]: value,
                };

                if (key === "startTime" || key === "endTime") {
                    const start = updated.startTime
                        ? new Date(updated.startTime)
                        : null;

                    const end = updated.endTime
                        ? new Date(updated.endTime)
                        : null;

                    if (
                        start &&
                        end &&
                        !Number.isNaN(start.getTime()) &&
                        !Number.isNaN(end.getTime()) &&
                        end >= start
                    ) {
                        updated.durationMinutes = String(
                            Math.round(
                                (end.getTime() - start.getTime()) / 60000
                            )
                        );
                    }
                }

                return updated;
            })
        );
    }

    function removeDowntime(index) {
        if (!canEdit) return;

        setDowntime((current) =>
            current.filter((_, rowIndex) => rowIndex !== index)
        );
    }

    // =====================================================
    // TOTALS
    // =====================================================

    const totals = useMemo(() => {
        const componentAmount = components.reduce(
            (total, component) =>
                total +
                numberValue(component.issuedQuantity) *
                numberValue(component.unitCost),
            0
        );

        const byproductAmount = byproducts.reduce(
            (total, row) =>
                total +
                numberValue(row.quantity) *
                numberValue(row.unitCost),
            0
        );

        const totalRequired = components.reduce(
            (total, component) =>
                total + numberValue(component.requiredQuantity),
            0
        );

        const totalIssued = components.reduce(
            (total, component) =>
                total + numberValue(component.issuedQuantity),
            0
        );

        return {
            componentAmount,
            byproductAmount,
            totalRequired,
            totalIssued,
        };
    }, [components, byproducts]);

    // =====================================================
    // VALIDATION
    // =====================================================

    function validateForm() {
        if (!form.transactionDate) {
            return "Transaction Date is required.";
        }

        if (!form.warehouseId) {
            return "Production Location is required.";
        }

        if (!form.bomId || !form.revisionId) {
            return "BOM and Revision are required.";
        }

        if (numberValue(form.buildQuantity) <= 0) {
            return "Build Quantity must be greater than zero.";
        }

        if (!components.length) {
            return "This Assembly Build has no component rows.";
        }

        for (let index = 0; index < components.length; index++) {
            const component = components[index];

            if (!component.componentId) {
                return `Component row ${index + 1} has an invalid BOM component reference.`;
            }

            if (numberValue(component.requiredQuantity) <= 0) {
                return `Required Quantity must be greater than zero for ${component.itemName}.`;
            }

            if (numberValue(component.issuedQuantity) <= 0) {
                return `Issued Quantity must be greater than zero for ${component.itemName}.`;
            }

            if (numberValue(component.unitCost) < 0) {
                return `Unit Cost cannot be negative for ${component.itemName}.`;
            }
        }

        for (let index = 0; index < byproducts.length; index++) {
            const row = byproducts[index];

            if (!row.productId && !row.subProductId) {
                return `Please select an item for By Product row ${index + 1}.`;
            }

            if (numberValue(row.quantity) <= 0) {
                return `Quantity must be greater than zero for By Product row ${index + 1}.`;
            }

            if (numberValue(row.unitCost) < 0) {
                return `Unit Cost cannot be negative for By Product row ${index + 1}.`;
            }

            if (!row.itemDescription.trim()) {
                return `Description is required for By Product row ${index + 1}.`;
            }
        }

        for (let index = 0; index < downtime.length; index++) {
            const row = downtime[index];

            if (
                row.startTime &&
                row.endTime &&
                new Date(row.endTime) < new Date(row.startTime)
            ) {
                return `Downtime end time cannot be earlier than start time in row ${index + 1}.`;
            }

            if (numberValue(row.durationMinutes) < 0) {
                return `Downtime duration cannot be negative in row ${index + 1}.`;
            }
        }

        return "";
    }

    // =====================================================
    // BUILD PAYLOAD
    // =====================================================

    function createBuildPayload() {
        return {
            transactionDate: form.transactionDate,
            warehouseId: Number(form.warehouseId),

            customerId: form.customerId
                ? Number(form.customerId)
                : null,

            bomId: Number(form.bomId),
            revisionId: Number(form.revisionId),
            buildQuantity: numberValue(form.buildQuantity),

            uom: form.uom || null,
            employee: form.employee.trim() || null,
            machine: form.machine.trim() || null,
            shift: form.shift.trim() || null,
            workOrderNumber: form.workOrderNumber.trim() || null,
            details: form.details.trim() || null,
            memo: form.memo.trim() || null,

            components: components.map((component) => ({
                componentId: Number(component.componentId),
                requiredQuantity: numberValue(component.requiredQuantity),
                issuedQuantity: numberValue(component.issuedQuantity),
                unitCost: numberValue(component.unitCost),
                details: component.details?.trim() || null,
            })),

            byproducts: byproducts.map((row) => ({
                productId: row.productId
                    ? Number(row.productId)
                    : null,

                subProductId: row.subProductId
                    ? Number(row.subProductId)
                    : null,

                itemDescription: row.itemDescription.trim(),
                uom: row.uom || null,
                quantity: numberValue(row.quantity),
                unitCost: numberValue(row.unitCost),
                details: row.details?.trim() || null,
            })),

            downtime: downtime.map((row) => ({
                machine: row.machine.trim() || null,
                reason: row.reason.trim() || null,
                startTime: row.startTime || null,
                endTime: row.endTime || null,
                durationMinutes: numberValue(row.durationMinutes),
                remarks: row.remarks.trim() || null,
            })),
        };
    }

    // =====================================================
    // VALIDATION ERROR TAB
    // =====================================================

    function showValidationError(validationError) {
        setError(validationError);

        if (validationError.toLowerCase().includes("by product")) {
            setActiveTab("byproducts");
        } else if (validationError.toLowerCase().includes("downtime")) {
            setActiveTab("downtime");
        } else {
            setActiveTab("components");
        }
    }

    // =====================================================
    // SAVE CHANGES - KEEP DOCUMENT IN DRAFT
    // =====================================================

    async function saveChanges(event) {
        event.preventDefault();

        if (!canEdit || saving || approving) return;

        setError("");

        const validationError = validateForm();

        if (validationError) {
            showValidationError(validationError);
            return;
        }

        setSaving(true);

        try {
            const response = await fetch(`${API_URL}/${buildId}`, {
                method: "PUT",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify(createBuildPayload()),
            });

            const data = await response.json().catch(() => ({}));

            if (!response.ok || data.success === false) {
                throw new Error(
                    getErrorMessage(data, "Unable to update Assembly Build.")
                );
            }

            router.push("/dashboard/assembly-build");
            router.refresh();
        } catch (err) {
            setError(err.message || "Unable to update Assembly Build.");
        } finally {
            setSaving(false);
        }
    }

    // =====================================================
    // APPROVE ASSEMBLY BUILD
    // =====================================================

    async function approveAssemblyBuild() {
        if (!canApprove || saving || approving) return;

        setError("");

        // In Edit mode, validate the current form before saving.
        // In View mode, approve the saved server-side document.
        if (!viewMode) {
            const validationError = validateForm();

            if (validationError) {
                showValidationError(validationError);
                return;
            }
        }

        const confirmed = window.confirm(
            "Are you sure you want to approve this Assembly Build?\n\n" +
            "Approval will:\n" +
            "1. Deduct issued component quantities from inventory.\n" +
            "2. Add the finished assembly quantity to inventory.\n" +
            "3. Add by-product quantities to inventory.\n\n" +
            "The approved Assembly Build will become read-only and cannot be approved again."
        );

        if (!confirmed) return;

        setApproving(true);

        try {
            // 1. SAVE LATEST DRAFT VALUES WHEN NOT IN VIEW MODE

            if (!viewMode) {
                const updateResponse = await fetch(
                    `${API_URL}/${buildId}`,
                    {
                        method: "PUT",
                        headers: {
                            "Content-Type": "application/json",
                        },
                        body: JSON.stringify(createBuildPayload()),
                    }
                );

                const updateData = await updateResponse
                    .json()
                    .catch(() => ({}));

                if (
                    !updateResponse.ok ||
                    updateData.success === false
                ) {
                    throw new Error(
                        getErrorMessage(
                            updateData,
                            "Unable to save Assembly Build before approval."
                        )
                    );
                }
            }

            // 2. APPROVE AND POST INVENTORY MOVEMENTS

            const approveResponse = await fetch(
                `${API_URL}/${buildId}/approve`,
                {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                    },
                }
            );

            const approveData = await approveResponse
                .json()
                .catch(() => ({}));

            if (
                !approveResponse.ok ||
                approveData.success === false
            ) {
                throw new Error(
                    getErrorMessage(
                        approveData,
                        "Unable to approve Assembly Build."
                    )
                );
            }

            // 3. RETURN TO ASSEMBLY BUILD HISTORY

            router.push("/dashboard/assembly-build");
            router.refresh();
        } catch (err) {
            setError(
                err.message || "Unable to approve Assembly Build."
            );
        } finally {
            setApproving(false);
        }
    }

    // =====================================================
    // LOADING
    // =====================================================

    if (!permissionChecked || loading) {
        return (
            <div className="min-h-full bg-white p-5">
                <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500 shadow-sm">
                    <RefreshCw
                        size={20}
                        className="mx-auto mb-3 animate-spin"
                    />
                    Loading Assembly Build...
                </div>
            </div>
        );
    }

    // =====================================================
    // ACCESS CONTROL
    // =====================================================

    if (!permissions.canView) {
        return (
            <div className="min-h-full bg-white p-5">
                <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
                    <LockKeyhole
                        size={28}
                        className="mx-auto text-slate-400"
                    />

                    <h2 className="mt-3 text-lg font-bold text-slate-900">
                        Access Denied
                    </h2>

                    <p className="mt-2 text-sm text-slate-500">
                        {error
                            ? `Unable to verify your permission: ${error}`
                            : "You do not have permission to view Assembly Build."}
                    </p>

                    <Link
                        href="/dashboard/assembly-build"
                        className="mt-4 inline-flex items-center gap-2 rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                    >
                        <ArrowLeft size={16} />
                        Back to History
                    </Link>
                </div>
            </div>
        );
    }

    if (!build) {
        return (
            <div className="min-h-full bg-white p-5">
                <div className="rounded-2xl border border-red-200 bg-red-50 p-8 text-center">
                    <h2 className="font-bold text-red-800">
                        Assembly Build Not Found
                    </h2>

                    <p className="mt-2 text-sm text-red-700">
                        {error ||
                            "The requested Assembly Build could not be loaded."}
                    </p>

                    <Link
                        href="/dashboard/assembly-build"
                        className="mt-4 inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700"
                    >
                        <ArrowLeft size={16} />
                        Back to History
                    </Link>
                </div>
            </div>
        );
    }

    const title =
        viewMode || !canEdit
            ? "View Assembly Build"
            : "Edit Assembly Build";

    // =====================================================
    // MAIN FORM
    // =====================================================

    return (
        <form
            onSubmit={saveChanges}
            className="min-h-full space-y-5 bg-white p-3 md:p-5"
        >
            {/* HEADER */}

            <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                    <Link
                        href="/dashboard/assembly-build"
                        className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50"
                        title="Back"
                    >
                        <ArrowLeft size={17} />
                    </Link>

                    <div>
                        <h1 className="text-2xl font-bold text-slate-900">
                            {title}
                        </h1>

                        <p className="mt-1 text-sm text-slate-500">
                            {build.transaction_number} — {getBuildName(build)}
                        </p>
                    </div>
                </div>

                {/* HEADER ACTIONS */}

                <div className="flex flex-wrap items-center gap-2">
                    <span
                        className={`inline-flex items-center rounded-lg border px-3 py-2 text-xs font-bold ${getStatusClass(status)}`}
                    >
                        {status}
                    </span>

                    {!canEdit && (
                        <span className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-600">
                            <LockKeyhole size={14} />
                            Read Only
                        </span>
                    )}

                    {canEdit && (
                        <button
                            type="submit"
                            disabled={saving || approving}
                            className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-800 shadow-sm hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                            {saving ? (
                                <RefreshCw size={16} className="animate-spin" />
                            ) : (
                                <Save size={16} />
                            )}
                            {saving ? "Saving..." : "Save Changes"}
                        </button>
                    )}

                    {/* APPROVE BUTTON: VISIBLE IN EDIT OR VIEW MODE */}

                    {canApprove && (
                        <button
                            type="button"
                            onClick={approveAssemblyBuild}
                            disabled={saving || approving}
                            className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                            {approving ? (
                                <RefreshCw size={16} className="animate-spin" />
                            ) : (
                                <Package size={16} />
                            )}
                            {approving ? "Approving..." : "Approve"}
                        </button>
                    )}
                </div>
            </div>

            {/* ALERT */}

            {error && (
                <div className="flex items-start justify-between gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                    <span>{error}</span>

                    <button
                        type="button"
                        onClick={() => setError("")}
                        className="font-bold"
                        aria-label="Dismiss error"
                    >
                        <X size={16} />
                    </button>
                </div>
            )}

            {!canEdit && (
                <div className="flex items-start gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
                    <LockKeyhole size={17} className="mt-0.5 shrink-0" />

                    <div>
                        {viewMode
                            ? "You are viewing this Assembly Build in read-only mode. If you have update permission and this is an unposted DRAFT, you can still approve it."
                            : !isDraft || posted
                                ? "Only unposted DRAFT Assembly Builds can be edited or approved."
                                : "You have view permission but do not have update permission."}
                    </div>
                </div>
            )}

            {/* TRANSACTION HEADER */}

            <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
                    <div className="flex items-center gap-2">
                        <Factory size={18} className="text-slate-600" />
                        <h2 className="font-bold text-slate-900">
                            Transaction Information
                        </h2>
                    </div>

                    <span
                        className={`rounded-lg border px-3 py-1 text-xs font-bold ${getStatusClass(status)}`}
                    >
                        {status}
                    </span>
                </div>

                <div className="grid gap-4 p-4 sm:grid-cols-2 xl:grid-cols-3">
                    <Input
                        label="Transaction Number"
                        value={build.transaction_number || ""}
                        disabled
                    />

                    <Input
                        label="Subsidiary"
                        value="Goldenlake Integrated Solutions"
                        disabled
                    />

                    <Input
                        label="Status"
                        value={status}
                        disabled
                    />

                    <Input
                        label="Transaction Date"
                        type="date"
                        value={form.transactionDate}
                        onChange={(value) => updateForm("transactionDate", value)}
                        disabled={readOnly}
                        required
                    />

                    <Select
                        label="Production Location"
                        value={form.warehouseId}
                        options={warehouseOptions}
                        disabled
                        required
                    />

                    <Select
                        label="Customer"
                        value={form.customerId}
                        onChange={(value) => updateForm("customerId", value)}
                        options={customerOptions}
                        placeholder="Optional customer"
                        disabled={readOnly}
                    />

                    <Select
                        label="Bill of Materials"
                        value={form.bomId}
                        options={bomOptions}
                        disabled
                    />

                    <Select
                        label="Revision"
                        value={form.revisionId}
                        options={revisionOptions}
                        disabled
                    />

                    <Input
                        label="Build Quantity"
                        type="number"
                        value={form.buildQuantity}
                        disabled
                    />

                    <Input
                        label="UOM"
                        value={form.uom}
                        onChange={(value) => updateForm("uom", value)}
                        disabled={readOnly}
                    />

                    <Input
                        label="Employee"
                        value={form.employee}
                        onChange={(value) => updateForm("employee", value)}
                        disabled={readOnly}
                    />

                    <Input
                        label="Machine"
                        value={form.machine}
                        onChange={(value) => updateForm("machine", value)}
                        disabled={readOnly}
                    />

                    <Input
                        label="Shift"
                        value={form.shift}
                        onChange={(value) => updateForm("shift", value)}
                        disabled={readOnly}
                    />

                    <Input
                        label="Work Order No."
                        value={form.workOrderNumber}
                        onChange={(value) => updateForm("workOrderNumber", value)}
                        disabled={readOnly}
                    />

                    <TextArea
                        label="Details"
                        value={form.details}
                        onChange={(value) => updateForm("details", value)}
                        disabled={readOnly}
                        className="sm:col-span-2 xl:col-span-3"
                    />

                    <TextArea
                        label="Memo"
                        value={form.memo}
                        onChange={(value) => updateForm("memo", value)}
                        disabled={readOnly}
                        className="sm:col-span-2 xl:col-span-3"
                    />
                </div>
            </section>

            {/* SELECTED ASSEMBLY */}

            <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                            Selected Assembly
                        </p>

                        <h3 className="mt-1 text-lg font-bold text-slate-900">
                            {bomData?.assemblyName || getBuildName(build)}
                        </h3>

                        <p className="mt-1 text-xs text-slate-500">
                            {bomData?.assemblySku
                                ? `SKU: ${bomData.assemblySku}`
                                : `BOM: ${build.bom_name || build.bom_id}`}
                        </p>
                    </div>

                    <div className="text-right">
                        <p className="text-xs text-slate-500">Revision</p>
                        <p className="mt-1 font-bold text-slate-900">
                            {build.revision_name || build.revision_id || "-"}
                        </p>
                    </div>
                </div>
            </section>

            {/* SUMMARY */}

            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <SummaryBox
                    label="Component Lines"
                    value={components.length}
                    description="Saved component rows"
                />

                <SummaryBox
                    label="Total Required"
                    value={formatNumber(totals.totalRequired)}
                    description="Saved BOM requirements"
                />

                <SummaryBox
                    label="Total Issued"
                    value={formatNumber(totals.totalIssued)}
                    description="Component consumption"
                />

                <SummaryBox
                    label="Component Amount"
                    value={formatNumber(totals.componentAmount)}
                    description="Calculated component value"
                />
            </div>

            {/* TABS */}

            <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                <div className="flex overflow-x-auto border-b border-slate-200 bg-white">
                    {TABS.map((tab) => {
                        const Icon = tab.icon;
                        const active = activeTab === tab.id;

                        return (
                            <button
                                key={tab.id}
                                type="button"
                                onClick={() => setActiveTab(tab.id)}
                                className={`inline-flex shrink-0 items-center gap-2 border-b-2 px-4 py-3 text-xs font-semibold transition ${
                                    active
                                        ? "border-slate-700 bg-slate-50 text-slate-900"
                                        : "border-transparent text-slate-500 hover:bg-slate-50 hover:text-slate-800"
                                }`}
                            >
                                <Icon size={15} />
                                {tab.label}

                                {tab.id === "components" && (
                                    <span className="rounded-md border border-slate-200 bg-white px-1.5 py-0.5 text-[10px]">
                                        {components.length}
                                    </span>
                                )}

                                {tab.id === "byproducts" && (
                                    <span className="rounded-md border border-slate-200 bg-white px-1.5 py-0.5 text-[10px]">
                                        {byproducts.length}
                                    </span>
                                )}

                                {tab.id === "downtime" && (
                                    <span className="rounded-md border border-slate-200 bg-white px-1.5 py-0.5 text-[10px]">
                                        {downtime.length}
                                    </span>
                                )}
                            </button>
                        );
                    })}
                </div>

                <div className="p-4">
                    {/* COMPONENTS */}

                    {activeTab === "components" && (
                        <div className="space-y-4">
                            <div>
                                <h3 className="font-bold text-slate-900">
                                    Component Consumption
                                </h3>
                                <p className="mt-1 text-xs text-slate-500">
                                    Saved component lines from this Assembly Build.
                                </p>
                            </div>

                            {components.length === 0 ? (
                                <div className="rounded-xl border border-dashed border-slate-300 p-10 text-center text-sm text-slate-500">
                                    No component rows found.
                                </div>
                            ) : (
                                <div className="overflow-x-auto rounded-xl border border-slate-200">
                                    <table className="w-full min-w-[1100px] border-collapse text-left text-xs">
                                        <thead>
                                            <tr className="border-b border-slate-200 bg-slate-50 text-slate-600">
                                                <th className="px-3 py-3">Item</th>
                                                <th className="px-3 py-3">Description</th>
                                                <th className="px-3 py-3">UOM</th>
                                                <th className="px-3 py-3 text-right">Item Balance</th>
                                                <th className="px-3 py-3 text-right">Required Quantity</th>
                                                <th className="px-3 py-3 text-right">Issued Quantity</th>
                                                <th className="px-3 py-3 text-right">Unit Cost</th>
                                                <th className="px-3 py-3 text-right">Amount</th>
                                                <th className="px-3 py-3">Details</th>
                                            </tr>
                                        </thead>

                                        <tbody>
                                            {components.map((component, index) => (
                                                <tr
                                                    key={component.rowId}
                                                    className="border-b border-slate-100 last:border-0"
                                                >
                                                    <td className="px-3 py-3 font-semibold text-slate-800">
                                                        {component.itemName}

                                                        {component.itemSku && (
                                                            <div className="mt-1 text-[10px] text-slate-400">
                                                                {component.itemSku}
                                                            </div>
                                                        )}

                                                        <div className="mt-1 text-[10px] text-slate-400">
                                                            {component.subProductId
                                                                ? "Sub-product"
                                                                : "Product"}
                                                        </div>
                                                    </td>

                                                    <td className="px-3 py-3 text-slate-600">
                                                        {component.itemDescription || "-"}
                                                    </td>

                                                    <td className="px-3 py-3">
                                                        {component.uom || "-"}
                                                    </td>

                                                    <td className="px-3 py-3 text-right">
                                                        {formatNumber(component.itemBalance)}
                                                    </td>

                                                    <td className="px-3 py-3 text-right font-semibold">
                                                        {formatNumber(component.requiredQuantity)}
                                                    </td>

                                                    <td className="px-3 py-3">
                                                        <input
                                                            type="number"
                                                            min="1"
                                                            step="1"
                                                            value={component.issuedQuantity}
                                                            disabled={readOnly}
                                                            onChange={(event) =>
                                                                updateComponent(
                                                                    index,
                                                                    "issuedQuantity",
                                                                    event.target.value
                                                                )
                                                            }
                                                            className="w-28 rounded-lg border border-slate-300 px-2 py-1.5 text-right outline-none focus:border-slate-500 disabled:bg-slate-100"
                                                        />
                                                    </td>

                                                    <td className="px-3 py-3">
                                                        <input
                                                            type="number"
                                                            min="0"
                                                            step="1"
                                                            value={component.unitCost}
                                                            disabled={readOnly}
                                                            onChange={(event) =>
                                                                updateComponent(
                                                                    index,
                                                                    "unitCost",
                                                                    event.target.value
                                                                )
                                                            }
                                                            className="w-28 rounded-lg border border-slate-300 px-2 py-1.5 text-right outline-none focus:border-slate-500 disabled:bg-slate-100"
                                                        />
                                                    </td>

                                                    <td className="px-3 py-3 text-right font-semibold">
                                                        {formatNumber(
                                                            numberValue(component.issuedQuantity) *
                                                            numberValue(component.unitCost)
                                                        )}
                                                    </td>

                                                    <td className="px-3 py-3">
                                                        <input
                                                            type="text"
                                                            value={component.details}
                                                            disabled={readOnly}
                                                            onChange={(event) =>
                                                                updateComponent(
                                                                    index,
                                                                    "details",
                                                                    event.target.value
                                                                )
                                                            }
                                                            className="w-32 rounded-lg border border-slate-300 px-2 py-1.5 outline-none focus:border-slate-500 disabled:bg-slate-100"
                                                        />
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>

                                        <tfoot>
                                            <tr className="bg-slate-50 font-bold text-slate-800">
                                                <td colSpan={7} className="px-3 py-3 text-right">
                                                    Total Component Amount
                                                </td>
                                                <td className="px-3 py-3 text-right">
                                                    {formatNumber(totals.componentAmount)}
                                                </td>
                                                <td />
                                            </tr>
                                        </tfoot>
                                    </table>
                                </div>
                            )}
                        </div>
                    )}

                    {/* BY-PRODUCTS */}

                    {activeTab === "byproducts" && (
                        <div className="space-y-4">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                                <div>
                                    <h3 className="font-bold text-slate-900">
                                        By Products
                                    </h3>
                                    <p className="mt-1 text-xs text-slate-500">
                                        Additional items generated during this production build.
                                    </p>
                                </div>

                                {canEdit && (
                                    <button
                                        type="button"
                                        onClick={addByproduct}
                                        className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                                    >
                                        <Plus size={15} />
                                        Add By Product
                                    </button>
                                )}
                            </div>

                            {byproducts.length === 0 ? (
                                <div className="rounded-xl border border-dashed border-slate-300 p-10 text-center">
                                    <Layers size={28} className="mx-auto text-slate-400" />
                                    <p className="mt-3 text-sm font-semibold text-slate-700">
                                        No by-products recorded
                                    </p>
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    {byproducts.map((row, index) => (
                                        <div
                                            key={row.rowId}
                                            className="rounded-xl border border-slate-200 p-3"
                                        >
                                            <div className="mb-3 flex items-center justify-between">
                                                <p className="text-xs font-bold text-slate-700">
                                                    By Product #{index + 1}
                                                </p>

                                                {canEdit && (
                                                    <button
                                                        type="button"
                                                        onClick={() => removeByproduct(index)}
                                                        className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-red-200 text-red-600 hover:bg-red-50"
                                                        aria-label="Remove by-product"
                                                    >
                                                        <Trash2 size={15} />
                                                    </button>
                                                )}
                                            </div>

                                            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                                                <Select
                                                    label="Item"
                                                    value={
                                                        row.subProductId
                                                            ? `SUB_PRODUCT-${row.subProductId}`
                                                            : row.productId
                                                                ? `PRODUCT-${row.productId}`
                                                                : ""
                                                    }
                                                    onChange={(value) =>
                                                        updateByproduct(index, "itemKey", value)
                                                    }
                                                    options={itemOptions.map((item) => ({
                                                        value: `${item.type}-${item.id}`,
                                                        label:
                                                            `${item.name}` +
                                                            (item.sku ? ` (${item.sku})` : ""),
                                                    }))}
                                                    placeholder="Select product or sub-product"
                                                    disabled={readOnly}
                                                    required
                                                />

                                                <Input
                                                    label="Description"
                                                    value={row.itemDescription}
                                                    onChange={(value) =>
                                                        updateByproduct(index, "itemDescription", value)
                                                    }
                                                    disabled={readOnly}
                                                />

                                                <Input
                                                    label="UOM"
                                                    value={row.uom}
                                                    onChange={(value) =>
                                                        updateByproduct(index, "uom", value)
                                                    }
                                                    disabled={readOnly}
                                                />

                                                <Input
                                                    label="Quantity"
                                                    type="number"
                                                    min="1"
                                                    step="1"
                                                    value={row.quantity}
                                                    onChange={(value) =>
                                                        updateByproduct(index, "quantity", value)
                                                    }
                                                    disabled={readOnly}
                                                />

                                                <Input
                                                    label="Unit Cost"
                                                    type="number"
                                                    min="0"
                                                    step="1"
                                                    value={row.unitCost}
                                                    onChange={(value) =>
                                                        updateByproduct(index, "unitCost", value)
                                                    }
                                                    disabled={readOnly}
                                                />

                                                <Field label="Amount">
                                                    <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-bold text-slate-800">
                                                        {formatNumber(
                                                            numberValue(row.quantity) *
                                                            numberValue(row.unitCost)
                                                        )}
                                                    </div>
                                                </Field>

                                                <TextArea
                                                    label="Details"
                                                    value={row.details}
                                                    onChange={(value) =>
                                                        updateByproduct(index, "details", value)
                                                    }
                                                    disabled={readOnly}
                                                    className="sm:col-span-2 xl:col-span-3"
                                                />
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}

                            <div className="flex justify-end rounded-xl border border-slate-200 bg-slate-50 p-3">
                                <div className="text-right">
                                    <p className="text-xs text-slate-500">
                                        Total By Product Amount
                                    </p>
                                    <p className="mt-1 text-lg font-bold text-slate-900">
                                        {formatNumber(totals.byproductAmount)}
                                    </p>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* ACCOUNTING */}

                    {activeTab === "accounting" && (
                        <div className="space-y-4">
                            <div>
                                <h3 className="font-bold text-slate-900">
                                    Inventory Valuation Summary
                                </h3>
                                <p className="mt-1 text-xs text-slate-500">
                                    Informational valuation only. Assembly Build does not generate manufacturing journal entries.
                                </p>
                            </div>

                            <div className="overflow-x-auto rounded-xl border border-slate-200">
                                <table className="w-full min-w-[650px] text-left text-xs">
                                    <thead>
                                        <tr className="border-b border-slate-200 bg-slate-50 text-slate-600">
                                            <th className="px-4 py-3">Description</th>
                                            <th className="px-4 py-3">Account</th>
                                            <th className="px-4 py-3 text-right">Amount</th>
                                        </tr>
                                    </thead>

                                    <tbody>
                                        <tr className="border-b border-slate-100">
                                            <td className="px-4 py-3">
                                                Component inventory consumption
                                            </td>
                                            <td className="px-4 py-3">
                                                Inventory — Account 7
                                            </td>
                                            <td className="px-4 py-3 text-right">
                                                {formatNumber(totals.componentAmount)}
                                            </td>
                                        </tr>

                                        <tr className="border-b border-slate-100">
                                            <td className="px-4 py-3">
                                                By-product valuation
                                            </td>
                                            <td className="px-4 py-3">
                                                Inventory — Account 7
                                            </td>
                                            <td className="px-4 py-3 text-right">
                                                {formatNumber(totals.byproductAmount)}
                                            </td>
                                        </tr>
                                    </tbody>
                                </table>
                            </div>

                            <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-xs text-amber-800">
                                No journal entry is generated or posted from this screen. Inventory stock movements are handled by the Assembly Build approval process.
                            </div>
                        </div>
                    )}

                    {/* DOWNTIME */}

                    {activeTab === "downtime" && (
                        <div className="space-y-4">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                                <div>
                                    <h3 className="font-bold text-slate-900">
                                        Production Down Time
                                    </h3>
                                    <p className="mt-1 text-xs text-slate-500">
                                        Record machine downtime during production.
                                    </p>
                                </div>

                                {canEdit && (
                                    <button
                                        type="button"
                                        onClick={addDowntime}
                                        className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                                    >
                                        <Plus size={15} />
                                        Add Down Time
                                    </button>
                                )}
                            </div>

                            {downtime.length === 0 ? (
                                <div className="rounded-xl border border-dashed border-slate-300 p-10 text-center">
                                    <Clock3 size={28} className="mx-auto text-slate-400" />
                                    <p className="mt-3 text-sm font-semibold text-slate-700">
                                        No downtime recorded
                                    </p>
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    {downtime.map((row, index) => (
                                        <div
                                            key={row.rowId}
                                            className="rounded-xl border border-slate-200 p-3"
                                        >
                                            <div className="mb-3 flex items-center justify-between">
                                                <p className="text-xs font-bold text-slate-700">
                                                    Downtime #{index + 1}
                                                </p>

                                                {canEdit && (
                                                    <button
                                                        type="button"
                                                        onClick={() => removeDowntime(index)}
                                                        className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-red-200 text-red-600 hover:bg-red-50"
                                                        aria-label="Remove downtime"
                                                    >
                                                        <Trash2 size={15} />
                                                    </button>
                                                )}
                                            </div>

                                            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                                                <Input
                                                    label="Machine"
                                                    value={row.machine}
                                                    onChange={(value) =>
                                                        updateDowntime(index, "machine", value)
                                                    }
                                                    disabled={readOnly}
                                                />

                                                <Input
                                                    label="Reason"
                                                    value={row.reason}
                                                    onChange={(value) =>
                                                        updateDowntime(index, "reason", value)
                                                    }
                                                    disabled={readOnly}
                                                />

                                                <Input
                                                    label="Start Time"
                                                    type="datetime-local"
                                                    value={row.startTime}
                                                    onChange={(value) =>
                                                        updateDowntime(index, "startTime", value)
                                                    }
                                                    disabled={readOnly}
                                                />

                                                <Input
                                                    label="End Time"
                                                    type="datetime-local"
                                                    value={row.endTime}
                                                    onChange={(value) =>
                                                        updateDowntime(index, "endTime", value)
                                                    }
                                                    disabled={readOnly}
                                                />

                                                <Input
                                                    label="Duration (Minutes)"
                                                    type="number"
                                                    min="0"
                                                    step="1"
                                                    value={row.durationMinutes}
                                                    onChange={(value) =>
                                                        updateDowntime(
                                                            index,
                                                            "durationMinutes",
                                                            value
                                                        )
                                                    }
                                                    disabled={readOnly}
                                                />

                                                <Input
                                                    label="Remarks"
                                                    value={row.remarks}
                                                    onChange={(value) =>
                                                        updateDowntime(index, "remarks", value)
                                                    }
                                                    disabled={readOnly}
                                                />
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}

                    {/* RELATED TRANSACTIONS */}

                    {activeTab === "related" && (
                        <div className="rounded-xl border border-dashed border-slate-300 p-10 text-center">
                            <ClipboardList
                                size={28}
                                className="mx-auto text-slate-400"
                            />

                            <p className="mt-3 text-sm font-semibold text-slate-700">
                                Related Transactions
                            </p>

                            <p className="mt-1 text-xs text-slate-500">
                                Related work orders and source transactions can be displayed here when linked to this build.
                            </p>

                            <p className="mt-3 text-xs text-slate-400">
                                No related transaction has been linked.
                            </p>
                        </div>
                    )}

                    {/* SYSTEM INFORMATION */}

                    {activeTab === "system" && (
                        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                            {[
                                {
                                    label: "Document Status",
                                    value: status,
                                },
                                {
                                    label: "Transaction Number",
                                    value: build.transaction_number || "-",
                                },
                                {
                                    label: "Created At",
                                    value: formatDateTime(build.created_at),
                                },
                                {
                                    label: "Updated At",
                                    value: formatDateTime(build.updated_at),
                                },
                                {
                                    label: "Posted At",
                                    value: formatDateTime(
                                        build.posted_at || build.postedAt
                                    ),
                                },
                                {
                                    label: "Created By",
                                    value: build.created_by || "-",
                                },
                                {
                                    label: "Updated By",
                                    value: build.updated_by || "-",
                                },
                                {
                                    label: "Posted By",
                                    value: build.posted_by || "Not posted",
                                },
                                {
                                    label: "Posting Status",
                                    value: posted ? "Posted" : "Not posted",
                                },
                            ].map((item) => (
                                <div
                                    key={item.label}
                                    className="rounded-xl border border-slate-200 p-4"
                                >
                                    <p className="text-xs font-semibold uppercase text-slate-500">
                                        {item.label}
                                    </p>
                                    <p className="mt-2 font-bold text-slate-800">
                                        {item.value}
                                    </p>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </section>

            {/* BOTTOM SUMMARY */}

            <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                    <div>
                        <p className="text-xs text-slate-500">
                            Component Amount
                        </p>
                        <p className="mt-1 text-lg font-bold text-slate-900">
                            {formatNumber(totals.componentAmount)}
                        </p>
                    </div>

                    <div>
                        <p className="text-xs text-slate-500">
                            By Product Amount
                        </p>
                        <p className="mt-1 text-lg font-bold text-slate-900">
                            {formatNumber(totals.byproductAmount)}
                        </p>
                    </div>

                    <div>
                        <p className="text-xs text-slate-500">
                            Finished Build Quantity
                        </p>
                        <p className="mt-1 text-lg font-bold text-slate-900">
                            {formatNumber(form.buildQuantity)}
                            {form.uom ? ` ${form.uom}` : ""}
                        </p>
                    </div>

                    <div>
                        <p className="text-xs text-slate-500">Status</p>
                        <p className="mt-1 text-lg font-bold text-slate-900">
                            {status}
                        </p>
                    </div>
                </div>
            </section>

            {/* FOOTER ACTIONS */}

            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 pt-4">
                <Link
                    href="/dashboard/assembly-build"
                    className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                >
                    <ArrowLeft size={16} />
                    Back to History
                </Link>

                <div className="flex flex-wrap items-center gap-2">
                    {canEdit && (
                        <button
                            type="submit"
                            disabled={saving || approving}
                            className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-5 py-2.5 text-sm font-semibold text-slate-800 shadow-sm hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                            {saving ? (
                                <RefreshCw size={16} className="animate-spin" />
                            ) : (
                                <Save size={16} />
                            )}
                            {saving ? "Saving..." : "Save Draft"}
                        </button>
                    )}

                    {/* APPROVE BUTTON: ALSO AVAILABLE IN VIEW MODE */}

                    {canApprove && (
                        <button
                            type="button"
                            onClick={approveAssemblyBuild}
                            disabled={saving || approving}
                            className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                            {approving ? (
                                <RefreshCw size={16} className="animate-spin" />
                            ) : (
                                <Package size={16} />
                            )}

                            {approving
                                ? "Approving..."
                                : "Approve Assembly Build"}
                        </button>
                    )}
                </div>
            </div>

            <div className="border-t border-slate-200 pt-4 text-center text-xs text-slate-400">
                Developed By Golden Lake
            </div>
        </form>
    );
}