
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
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
} from "lucide-react";

const API_URL = "/api/assembly-build";
const BOM_API = "/api/bill-of-materials";
const PERMISSION_KEY = "assembly_build";

const TABS = [
    { id: "components", label: "Components", icon: Package },
    { id: "byproducts", label: "By Products", icon: Layers },
    { id: "accounting", label: "Accounting Lines", icon: Calculator },
    { id: "downtime", label: "Down Time", icon: Clock3 },
    { id: "related", label: "Related Transactions", icon: ClipboardList },
    { id: "system", label: "System Information", icon: FileText },
];

// ---------------------------------------------------------
// HELPERS
// ---------------------------------------------------------

function getRows(data, keys = []) {
    if (Array.isArray(data)) return data;

    for (const key of keys) {
        if (Array.isArray(data?.[key])) {
            return data[key];
        }
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

function formatDate(value) {
    if (!value) return "-";

    const date = new Date(value);

    return Number.isNaN(date.getTime())
        ? "-"
        : date.toLocaleDateString();
}

function getProductName(product) {
    return (
        product.product_name ||
        product.name ||
        product.item_name ||
        product.sub_product_name ||
        "-"
    );
}

function getProductSku(product) {
    return product.sku || product.product_sku || product.barcode || "";
}

function getComponentName(component) {
    return (
        component.itemName ||
        component.item_description ||
        component.product_name ||
        component.sub_product_name ||
        "-"
    );
}

function getItemType(component) {
    return component.sub_product_id ? "SUB_PRODUCT" : "PRODUCT";
}

function getItemKey(item) {
    return item.sub_product_id
        ? `SUB_PRODUCT-${item.sub_product_id}`
        : `PRODUCT-${item.product_id}`;
}

function calculateRequiredQuantity(component, buildQuantity) {
    const bomQuantity = numberValue(component.bom_quantity);
    const buildQty = numberValue(buildQuantity);

    if (String(component.quantity_type).toUpperCase() === "PERCENTAGE") {
        return (bomQuantity / 100) * buildQty;
    }

    return bomQuantity * buildQty;
}

function getItemOptions(products, subProducts) {
    return [
        ...products.map((item) => ({
            type: "PRODUCT",
            id: item.product_id,
            name: getProductName(item),
            sku: getProductSku(item),
            uom: item.unit || item.uom || "",
            productId: item.product_id,
            subProductId: null,
        })),
        ...subProducts.map((item) => ({
            type: "SUB_PRODUCT",
            id: item.sub_product_id,
            name: getProductName(item),
            sku: getProductSku(item),
            uom: item.unit || item.uom || "",
            productId: item.product_id,
            subProductId: item.sub_product_id,
        })),
    ];
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

// ---------------------------------------------------------
// REUSABLE FORM COMPONENTS
// ---------------------------------------------------------

function Field({ label, children, required = false, className = "" }) {
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
}) {
    return (
        <Field label={label} className={className}>
            <textarea
                value={value ?? ""}
                onChange={(event) => onChange?.(event.target.value)}
                rows={rows}
                placeholder={placeholder}
                className={`${inputClass()} resize-y`}
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

// ---------------------------------------------------------
// MAIN PAGE
// ---------------------------------------------------------

export default function NewAssemblyBuildPage() {
    const router = useRouter();

    const [permissionChecked, setPermissionChecked] = useState(false);
    const [canCreate, setCanCreate] = useState(false);

    const [initializing, setInitializing] = useState(true);
    const [saving, setSaving] = useState(false);
    const [loadingBom, setLoadingBom] = useState(false);

    const [error, setError] = useState("");
    const [success, setSuccess] = useState("");
    const [activeTab, setActiveTab] = useState("components");

    // Dropdown data
    const [boms, setBoms] = useState([]);
    const [warehouses, setWarehouses] = useState([]);
    const [customers, setCustomers] = useState([]);
    const [products, setProducts] = useState([]);
    const [subProducts, setSubProducts] = useState([]);

    // Selected BOM information
    const [bomData, setBomData] = useState(null);
    const [revisions, setRevisions] = useState([]);

    // Transaction header
    const [form, setForm] = useState({
        transactionDate: new Date().toISOString().slice(0, 10),
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

    // Transaction detail rows
    const [components, setComponents] = useState([]);
    const [byproducts, setByproducts] = useState([]);
    const [downtime, setDowntime] = useState([]);

    // ---------------------------------------------------------
    // FIELD UPDATE
    // ---------------------------------------------------------

    const updateForm = useCallback((key, value) => {
        setForm((current) => ({
            ...current,
            [key]: value,
        }));
    }, []);

    // ---------------------------------------------------------
    // PERMISSION CHECK
    // ---------------------------------------------------------

    useEffect(() => {
    let active = true;

    async function checkPermission() {
        try {
            const response = await fetch(
                `/api/permissions/current?permissionKey=${encodeURIComponent(PERMISSION_KEY)}`,
                {
                    method: "GET",
                    cache: "no-store",
                }
            );

            const data = await response.json();

            if (!response.ok) {
                throw new Error(
                    getErrorMessage(
                        data,
                        "Unable to verify Assembly Build permissions."
                    )
                );
            }

            // Support both array and object API responses.
            const permissionList = Array.isArray(data?.permissions)
                ? data.permissions
                : Array.isArray(data)
                    ? data
                    : [];

            const source =
                data?.permission ||
                permissionList.find(
                    (item) =>
                        item?.permission_key === PERMISSION_KEY ||
                        item?.key === PERMISSION_KEY
                ) ||
                (
                    data?.permissions &&
                    !Array.isArray(data.permissions)
                        ? data.permissions[PERMISSION_KEY] ||
                          data.permissions
                        : null
                ) ||
                (
                    data?.permission_key === PERMISSION_KEY
                        ? data
                        : null
                ) ||
                {};

            const permission = Boolean(
                source.canCreate ??
                source.can_create ??
                false
            );

            if (!active) return;

            setCanCreate(permission);
            setPermissionChecked(true);

        } catch (err) {
            if (!active) return;

            console.error(
                "Assembly Build permission error:",
                err
            );

            setCanCreate(false);
            setError(err.message);
            setPermissionChecked(true);

        } finally {
            if (active) {
                setInitializing(false);
            }
        }
    }

    checkPermission();

    return () => {
        active = false;
    };
}, []);

    // ---------------------------------------------------------
    // LOAD SUPPORTING DROPDOWNS
    // ---------------------------------------------------------

    useEffect(() => {
        if (!permissionChecked || !canCreate) return;

        let active = true;

        async function loadDropdowns() {
            setInitializing(true);
            setError("");

            const requests = [
                {
                    name: "BOMs",
                    url: BOM_API,
                    keys: ["billOfMaterials", "boms"],
                    setter: setBoms,
                    required: true,
                },
                {
                    name: "Warehouses",
                    url: "/api/warehouses",
                    keys: ["warehouses"],
                    setter: setWarehouses,
                },
                {
                    name: "Customers",
                    url: "/api/customers",
                    keys: ["customers"],
                    setter: setCustomers,
                },
                {
                    name: "Products",
                    url: "/api/products",
                    keys: ["products"],
                    setter: setProducts,
                },
                {
                    name: "Sub-products",
                    url: "/api/sub-products",
                    keys: ["subProducts", "sub_products"],
                    setter: setSubProducts,
                },
            ];

            const results = await Promise.all(
                requests.map(async (request) => {
                    try {
                        const response = await fetch(request.url, {
                            method: "GET",
                            cache: "no-store",
                        });

                        const data = await response.json();

                        if (!response.ok || data.success === false) {
                            throw new Error(
                                getErrorMessage(
                                    data,
                                    `Unable to load ${request.name}.`
                                )
                            );
                        }

                        return {
                            request,
                            rows: getRows(data, request.keys),
                            error: "",
                        };
                    } catch (err) {
                        return {
                            request,
                            rows: [],
                            error: err.message,
                        };
                    }
                })
            );

            if (!active) return;

            const requiredErrors = [];

            for (const result of results) {
                result.request.setter(result.rows);

                if (result.request.required && result.error) {
                    requiredErrors.push(result.error);
                }
            }

            if (requiredErrors.length) {
                setError(requiredErrors.join(" "));
            }

            setInitializing(false);
        }

        loadDropdowns();

        return () => {
            active = false;
        };
    }, [permissionChecked, canCreate]);

    // ---------------------------------------------------------
    // WAREHOUSE OPTIONS
    // ---------------------------------------------------------

    const warehouseOptions = useMemo(() => {
        return warehouses
            .filter((item) => item.is_active !== false)
            .map((item) => ({
                value: String(item.warehouse_id),
                label: item.warehouse_name || item.name || `Warehouse ${item.warehouse_id}`,
            }));
    }, [warehouses]);

    // ---------------------------------------------------------
    // CUSTOMER OPTIONS
    // ---------------------------------------------------------

    const customerOptions = useMemo(() => {
        return customers
            .filter((item) => item.is_active !== false)
            .map((item) => ({
                value: String(
                    item.customer_id ??
                    item.id ??
                    ""
                ),
                label:
                    item.customer_name ||
                    item.name ||
                    item.company_name ||
                    `Customer ${item.customer_id ?? item.id}`,
            }))
            .filter((item) => item.value);
    }, [customers]);

    // ---------------------------------------------------------
    // BOM OPTIONS
    // ---------------------------------------------------------

    const bomOptions = useMemo(() => {
        return boms.map((item) => ({
            value: String(item.bom_id),
            label: `${item.bom_name || `BOM ${item.bom_id}`}${
                item.assembly_product_name
                    ? ` — ${item.assembly_product_name}`
                    : item.assembly_sub_product_name
                        ? ` — ${item.assembly_sub_product_name}`
                        : ""
            }`,
        }));
    }, [boms]);

    // ---------------------------------------------------------
    // REVISION OPTIONS
    // ---------------------------------------------------------

    const revisionOptions = useMemo(() => {
        return revisions
            .filter((revision) => revision.is_active !== false)
            .map((revision) => ({
                value: String(revision.revision_id),
                label: revision.revision_name || `Revision ${revision.revision_id}`,
            }));
    }, [revisions]);

    // ---------------------------------------------------------
    // ITEM OPTIONS FOR BYPRODUCTS
    // ---------------------------------------------------------

    const itemOptions = useMemo(
        () => getItemOptions(products, subProducts),
        [products, subProducts]
    );

    // ---------------------------------------------------------
    // LOAD BOM DETAILS
    // ---------------------------------------------------------

    const loadBomDetails = useCallback(async (bomId, warehouseId) => {
        if (!bomId) {
            setBomData(null);
            setRevisions([]);
            setComponents([]);
            setForm((current) => ({
                ...current,
                revisionId: "",
                uom: "",
            }));
            return;
        }

        setLoadingBom(true);
        setError("");
        setBomData(null);
        setRevisions([]);
        setComponents([]);

        try {
            const query = warehouseId
                ? `?warehouseId=${encodeURIComponent(warehouseId)}`
                : "";

            const response = await fetch(
                `${API_URL}/bom/${bomId}${query}`,
                {
                    method: "GET",
                    cache: "no-store",
                }
            );

            const data = await response.json();

            if (!response.ok || data.success === false) {
                throw new Error(
                    getErrorMessage(
                        data,
                        "Unable to load BOM details."
                    )
                );
            }

            const bom = data.bom || data.data?.bom || data.data;

            if (!bom) {
                throw new Error("BOM details were not returned by the server.");
            }

            const activeRevisions = Array.isArray(bom.revisions)
                ? bom.revisions.filter(
                    (revision) => revision.is_active !== false
                )
                : [];

            setBomData(bom);
            setRevisions(activeRevisions);

            const firstRevision = activeRevisions[0] || null;

            updateForm("revisionId", firstRevision
                ? String(firstRevision.revision_id)
                : ""
            );

            updateForm(
                "uom",
                bom.assemblyUom ||
                bom.unit_of_measure ||
                ""
            );

            if (firstRevision) {
                const rows = Array.isArray(firstRevision.components)
                    ? firstRevision.components
                    : [];

                setComponents(
                    rows.map((component) => {
                        const requiredQuantity =
                            calculateRequiredQuantity(
                                component,
                                form.buildQuantity
                            );

                        return {
                            componentId: component.component_id,
                            productId: component.product_id || null,
                            subProductId: component.sub_product_id || null,
                            itemDescription: component.item_description || "",
                            itemName: getComponentName(component),
                            itemSku: component.itemSku || "",
                            uom: component.uom || "",
                            itemBalance: numberValue(component.itemBalance),
                            quantityType: component.quantity_type || "QUANTITY",
                            bomQuantity: numberValue(component.bom_quantity),
                            requiredQuantity,
                            issuedQuantity: requiredQuantity,
                            unitCost: numberValue(component.unit_cost),
                            amount: requiredQuantity * numberValue(component.unit_cost),
                            details: "",
                        };
                    })
                );
            }
        } catch (err) {
            setError(err.message || "Unable to load BOM details.");
        } finally {
            setLoadingBom(false);
        }
    }, [form.buildQuantity, updateForm]);

    // ---------------------------------------------------------
    // BOM SELECTION
    // ---------------------------------------------------------

    async function handleBomChange(value) {
        updateForm("bomId", value);
        updateForm("revisionId", "");

        setByproducts([]);

        await loadBomDetails(
            value,
            form.warehouseId
        );
    }

    // ---------------------------------------------------------
    // WAREHOUSE SELECTION
    // ---------------------------------------------------------

    async function handleWarehouseChange(value) {
        updateForm("warehouseId", value);

        if (form.bomId) {
            await loadBomDetails(
                form.bomId,
                value
            );
        }
    }

    // ---------------------------------------------------------
    // REVISION SELECTION
    // ---------------------------------------------------------

    function handleRevisionChange(value) {
        updateForm("revisionId", value);

        const revision = revisions.find(
            (item) => String(item.revision_id) === String(value)
        );

        if (!revision) {
            setComponents([]);
            return;
        }

        const rows = Array.isArray(revision.components)
            ? revision.components
            : [];

        setComponents(
            rows.map((component) => {
                const requiredQuantity =
                    calculateRequiredQuantity(
                        component,
                        form.buildQuantity
                    );

                const unitCost = numberValue(component.unit_cost);

                return {
                    componentId: component.component_id,
                    productId: component.product_id || null,
                    subProductId: component.sub_product_id || null,
                    itemDescription: component.item_description || "",
                    itemName: getComponentName(component),
                    itemSku: component.itemSku || "",
                    uom: component.uom || "",
                    itemBalance: numberValue(component.itemBalance),
                    quantityType: component.quantity_type || "QUANTITY",
                    bomQuantity: numberValue(component.bom_quantity),
                    requiredQuantity,
                    issuedQuantity: requiredQuantity,
                    unitCost,
                    amount: requiredQuantity * unitCost,
                    details: "",
                };
            })
        );
    }

    // ---------------------------------------------------------
    // BUILD QUANTITY CHANGE
    // ---------------------------------------------------------

    function handleBuildQuantityChange(value) {
        updateForm("buildQuantity", value);

        const quantity = numberValue(value);

        setComponents((current) =>
            current.map((component) => {
                const requiredQuantity =
                    calculateRequiredQuantity(
                        {
                            bom_quantity: component.bomQuantity,
                            quantity_type: component.quantityType,
                        },
                        quantity
                    );

                const unitCost = numberValue(component.unitCost);

                return {
                    ...component,
                    requiredQuantity,
                    issuedQuantity: requiredQuantity,
                    amount: requiredQuantity * unitCost,
                };
            })
        );
    }

    // ---------------------------------------------------------
    // COMPONENT UPDATE
    // ---------------------------------------------------------

    function updateComponent(index, key, value) {
        setComponents((current) =>
            current.map((component, rowIndex) => {
                if (rowIndex !== index) return component;

                const updated = {
                    ...component,
                    [key]: value,
                };

                const issuedQuantity = numberValue(
                    key === "issuedQuantity"
                        ? value
                        : updated.issuedQuantity
                );

                const unitCost = numberValue(
                    key === "unitCost"
                        ? value
                        : updated.unitCost
                );

                updated.amount = issuedQuantity * unitCost;

                return updated;
            })
        );
    }

    // ---------------------------------------------------------
    // BYPRODUCT ACTIONS
    // ---------------------------------------------------------

    function addByproduct() {
        setByproducts((current) => [
            ...current,
            newByproduct(),
        ]);
    }

    function updateByproduct(index, key, value) {
        setByproducts((current) =>
            current.map((row, rowIndex) => {
                if (rowIndex !== index) return row;

                const updated = {
                    ...row,
                    [key]: value,
                };

                if (key === "itemKey") {
                    const selected = itemOptions.find(
                        (item) =>
                            `${item.type}-${item.id}` === value
                    );

                    updated.productId = selected?.productId || "";
                    updated.subProductId = selected?.subProductId || "";
                    updated.itemDescription = selected?.name || "";
                    updated.uom = selected?.uom || "";
                }

                return updated;
            })
        );
    }

    function removeByproduct(index) {
        setByproducts((current) =>
            current.filter((_, rowIndex) => rowIndex !== index)
        );
    }

    // ---------------------------------------------------------
    // DOWNTIME ACTIONS
    // ---------------------------------------------------------

    function addDowntime() {
        setDowntime((current) => [
            ...current,
            newDowntime(),
        ]);
    }

    function updateDowntime(index, key, value) {
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
                            Math.round((end - start) / 60000)
                        );
                    }
                }

                return updated;
            })
        );
    }

    function removeDowntime(index) {
        setDowntime((current) =>
            current.filter((_, rowIndex) => rowIndex !== index)
        );
    }

    // ---------------------------------------------------------
    // CALCULATIONS
    // ---------------------------------------------------------

    const totals = useMemo(() => {
        const componentAmount = components.reduce(
            (total, component) =>
                total + numberValue(component.amount),
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

    // ---------------------------------------------------------
    // FORM VALIDATION
    // ---------------------------------------------------------

    function validateForm() {
        if (!form.transactionDate) {
            return "Transaction Date is required.";
        }

        if (!form.warehouseId) {
            return "Please select a Production Location.";
        }

        if (!form.bomId) {
            return "Please select a Bill of Materials.";
        }

        if (!form.revisionId) {
            return "Please select a BOM Revision.";
        }

        if (numberValue(form.buildQuantity) <= 0) {
            return "Build Quantity must be greater than zero.";
        }

        if (!components.length) {
            return "The selected BOM revision does not contain components.";
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
        }

        return "";
    }

    // ---------------------------------------------------------
    // SAVE DRAFT
    // ---------------------------------------------------------

    async function saveDraft(event) {
        event.preventDefault();

        if (!canCreate || saving) return;

        setError("");
        setSuccess("");

        const validationError = validateForm();

        if (validationError) {
            setError(validationError);

            if (
                validationError.toLowerCase().includes("by product")
            ) {
                setActiveTab("byproducts");
            } else {
                setActiveTab("components");
            }

            return;
        }

        const payload = {
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

        setSaving(true);

        try {
            const response = await fetch(API_URL, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify(payload),
            });

            const data = await response.json();

            if (!response.ok || data.success === false) {
                throw new Error(
                    getErrorMessage(
                        data,
                        "Unable to save Assembly Build."
                    )
                );
            }

            const savedBuild = data.assemblyBuild;

            setSuccess(
                data.message ||
                "Assembly Build saved successfully as DRAFT."
            );

            if (savedBuild?.assembly_build_id) {
                router.push(
                    `/dashboard/assembly-build/${savedBuild.assembly_build_id}`
                );
            } else {
                router.push("/dashboard/assembly-build");
            }

            router.refresh();
        } catch (err) {
            setError(
                err.message ||
                "Unable to save Assembly Build."
            );
        } finally {
            setSaving(false);
        }
    }

    // ---------------------------------------------------------
    // LOADING
    // ---------------------------------------------------------

    if (!permissionChecked || initializing) {
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

    // ---------------------------------------------------------
    // ACCESS DENIED
    // ---------------------------------------------------------

    if (!canCreate) {
        return (
            <div className="min-h-full bg-white p-5">
                <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
                    <h2 className="text-lg font-bold text-slate-900">
                        Access Denied
                    </h2>

                    <p className="mt-2 text-sm text-slate-500">
                        You do not have permission to create Assembly Builds.
                    </p>

                    <Link
                        href="/dashboard/assembly-build"
                        className="mt-4 inline-flex items-center gap-2 rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                    >
                        <ArrowLeft size={16} />
                        Back to Assembly Build
                    </Link>
                </div>
            </div>
        );
    }

    // ---------------------------------------------------------
    // MAIN FORM
    // ---------------------------------------------------------

    return (
        <form
            onSubmit={saveDraft}
            className="min-h-full space-y-5 bg-white p-3 md:p-5"
        >

            {/* HEADER */}

            <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
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
                                Create Assembly Build
                            </h1>

                            <p className="mt-1 text-sm text-slate-500">
                                Create a production build from an approved BOM revision.
                            </p>
                        </div>
                    </div>
                </div>

                <div className="flex flex-wrap gap-2">
                    <Link
                        href="/dashboard/assembly-build"
                        className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                    >
                        Cancel
                    </Link>

                    <button
                        type="submit"
                        disabled={saving || loadingBom}
                        className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-800 shadow-sm hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                        {saving ? (
                            <RefreshCw size={16} className="animate-spin" />
                        ) : (
                            <Save size={16} />
                        )}

                        {saving ? "Saving..." : "Save Draft"}
                    </button>
                </div>
            </div>

            {/* ALERTS */}

            {error && (
                <div className="flex items-start justify-between gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                    <span>{error}</span>

                    <button
                        type="button"
                        onClick={() => setError("")}
                        className="font-bold"
                    >
                        <X size={16} />
                    </button>
                </div>
            )}

            {success && (
                <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
                    {success}
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

                    <span className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-bold text-amber-700">
                        DRAFT
                    </span>
                </div>

                <div className="grid gap-4 p-4 sm:grid-cols-2 xl:grid-cols-3">

                    <Input
                        label="Transaction Number"
                        value="Auto Generated"
                        disabled
                    />

                    <Input
                        label="Subsidiary"
                        value="Goldenlake Integrated Solutions"
                        disabled
                    />

                    <Input
                        label="Status"
                        value="DRAFT"
                        disabled
                    />

                    <Input
                        label="Transaction Date"
                        type="date"
                        value={form.transactionDate}
                        onChange={(value) => updateForm("transactionDate", value)}
                        required
                    />

                    <Select
                        label="Production Location"
                        value={form.warehouseId}
                        onChange={handleWarehouseChange}
                        options={warehouseOptions}
                        placeholder="Select production location"
                        required
                    />

                    <Select
                        label="Customer"
                        value={form.customerId}
                        onChange={(value) => updateForm("customerId", value)}
                        options={customerOptions}
                        placeholder="Optional customer"
                    />

                    <Select
                        label="Bill of Materials"
                        value={form.bomId}
                        onChange={handleBomChange}
                        options={bomOptions}
                        placeholder="Select BOM"
                        required
                    />

                    <Select
                        label="Revision"
                        value={form.revisionId}
                        onChange={handleRevisionChange}
                        options={revisionOptions}
                        placeholder="Select revision"
                        disabled={!revisions.length}
                        required
                    />

                    <Input
                        label="Build Quantity"
                        type="number"
                        min="1"
                        step="1"
                        value={form.buildQuantity}
                        onChange={handleBuildQuantityChange}
                        required
                    />

                    <Input
                        label="UOM"
                        value={form.uom}
                        onChange={(value) => updateForm("uom", value)}
                        placeholder="Unit of measure"
                    />

                    <Input
                        label="Employee"
                        value={form.employee}
                        onChange={(value) => updateForm("employee", value)}
                        placeholder="Employee name"
                    />

                    <Input
                        label="Machine"
                        value={form.machine}
                        onChange={(value) => updateForm("machine", value)}
                        placeholder="Machine name"
                    />

                    <Input
                        label="Shift"
                        value={form.shift}
                        onChange={(value) => updateForm("shift", value)}
                        placeholder="Morning / Evening / Night"
                    />

                    <Input
                        label="Work Order No."
                        value={form.workOrderNumber}
                        onChange={(value) => updateForm("workOrderNumber", value)}
                        placeholder="Optional work order number"
                    />

                    <TextArea
                        label="Details"
                        value={form.details}
                        onChange={(value) => updateForm("details", value)}
                        placeholder="Production details..."
                        className="sm:col-span-2 xl:col-span-3"
                    />

                    <TextArea
                        label="Memo"
                        value={form.memo}
                        onChange={(value) => updateForm("memo", value)}
                        placeholder="Enter memo..."
                        className="sm:col-span-2 xl:col-span-3"
                    />
                </div>
            </section>

            {/* SELECTED BOM INFORMATION */}

            {bomData && (
                <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                                Selected Assembly
                            </p>

                            <h3 className="mt-1 text-lg font-bold text-slate-900">
                                {bomData.assemblyName || bomData.bom_name}
                            </h3>

                            <p className="mt-1 text-xs text-slate-500">
                                {bomData.assemblySku
                                    ? `SKU: ${bomData.assemblySku}`
                                    : `BOM: ${bomData.bom_name}`}
                            </p>
                        </div>

                        <div className="text-right">
                            <p className="text-xs text-slate-500">
                                Active Revisions
                            </p>

                            <p className="mt-1 text-xl font-bold text-slate-900">
                                {revisions.length}
                            </p>
                        </div>
                    </div>
                </section>
            )}

            {/* LOADING BOM */}

            {loadingBom && (
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
                    <RefreshCw
                        size={16}
                        className="mr-2 inline animate-spin"
                    />
                    Loading BOM components and stock balances...
                </div>
            )}

            {/* SUMMARY */}

            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <SummaryBox
                    label="Component Lines"
                    value={components.length}
                    description="BOM components"
                />

                <SummaryBox
                    label="Total Required"
                    value={formatNumber(totals.totalRequired)}
                    description="Calculated requirement"
                />

                <SummaryBox
                    label="Total Issued"
                    value={formatNumber(totals.totalIssued)}
                    description="Planned component consumption"
                />

                <SummaryBox
                    label="Component Amount"
                    value={formatNumber(totals.componentAmount)}
                    description="Estimated component value"
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

                    {/* COMPONENTS TAB */}

                    {activeTab === "components" && (
                        <div className="space-y-4">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                                <div>
                                    <h3 className="font-bold text-slate-900">
                                        Component Consumption
                                    </h3>

                                    <p className="mt-1 text-xs text-slate-500">
                                        Components are loaded from the selected BOM revision.
                                    </p>
                                </div>
                            </div>

                            {components.length === 0 ? (
                                <div className="rounded-xl border border-dashed border-slate-300 p-10 text-center">
                                    <Package
                                        size={28}
                                        className="mx-auto text-slate-400"
                                    />

                                    <p className="mt-3 text-sm font-semibold text-slate-700">
                                        No components loaded
                                    </p>

                                    <p className="mt-1 text-xs text-slate-500">
                                        Select a BOM and revision to load components.
                                    </p>
                                </div>
                            ) : (
                                <div className="overflow-x-auto rounded-xl border border-slate-200">
                                    <table className="w-full min-w-[1150px] border-collapse text-left text-xs">
                                        <thead>
                                            <tr className="border-b border-slate-200 bg-slate-50 text-slate-600">
                                                <th className="px-3 py-3 font-bold">Item</th>
                                                <th className="px-3 py-3 font-bold">Description</th>
                                                <th className="px-3 py-3 font-bold">UOM</th>
                                                <th className="px-3 py-3 text-right font-bold">Item Balance</th>
                                                <th className="px-3 py-3 text-right font-bold">BOM Quantity</th>
                                                <th className="px-3 py-3 text-right font-bold">Required Quantity</th>
                                                <th className="px-3 py-3 text-right font-bold">Issued Quantity</th>
                                                <th className="px-3 py-3 text-right font-bold">Unit Cost</th>
                                                <th className="px-3 py-3 text-right font-bold">Amount</th>
                                                <th className="px-3 py-3 font-bold">Details</th>
                                            </tr>
                                        </thead>

                                        <tbody>
                                            {components.map((component, index) => (
                                                <tr
                                                    key={component.componentId}
                                                    className="border-b border-slate-100 last:border-0"
                                                >
                                                    <td className="px-3 py-3 font-semibold text-slate-800">
                                                        <div>{component.itemName}</div>

                                                        {component.itemSku && (
                                                            <div className="mt-1 text-[10px] text-slate-400">
                                                                {component.itemSku}
                                                            </div>
                                                        )}

                                                        <div className="mt-1 text-[10px] text-slate-400">
                                                            {getItemType(component) === "SUB_PRODUCT"
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

                                                    <td className="px-3 py-3 text-right font-medium">
                                                        {formatNumber(component.itemBalance)}
                                                    </td>

                                                    <td className="px-3 py-3 text-right">
                                                        {formatNumber(component.bomQuantity)}
                                                        {component.quantityType === "PERCENTAGE" && (
                                                            <span className="ml-1 text-slate-400">%</span>
                                                        )}
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
                                                            onChange={(event) =>
                                                                updateComponent(
                                                                    index,
                                                                    "issuedQuantity",
                                                                    event.target.value
                                                                )
                                                            }
                                                            className="w-28 rounded-lg border border-slate-300 px-2 py-1.5 text-right outline-none focus:border-slate-500"
                                                        />
                                                    </td>

                                                    <td className="px-3 py-3">
                                                        <input
                                                            type="number"
                                                            min="0"
                                                            step="1"
                                                            value={component.unitCost}
                                                            onChange={(event) =>
                                                                updateComponent(
                                                                    index,
                                                                    "unitCost",
                                                                    event.target.value
                                                                )
                                                            }
                                                            className="w-28 rounded-lg border border-slate-300 px-2 py-1.5 text-right outline-none focus:border-slate-500"
                                                        />
                                                    </td>

                                                    <td className="px-3 py-3 text-right font-semibold text-slate-800">
                                                        {formatNumber(component.amount)}
                                                    </td>

                                                    <td className="px-3 py-3">
                                                        <input
                                                            type="text"
                                                            value={component.details}
                                                            onChange={(event) =>
                                                                updateComponent(
                                                                    index,
                                                                    "details",
                                                                    event.target.value
                                                                )
                                                            }
                                                            placeholder="Details"
                                                            className="w-32 rounded-lg border border-slate-300 px-2 py-1.5 outline-none focus:border-slate-500"
                                                        />
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>

                                        <tfoot>
                                            <tr className="bg-slate-50 font-bold text-slate-800">
                                                <td colSpan={8} className="px-3 py-3 text-right">
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

                    {/* BYPRODUCTS TAB */}

                    {activeTab === "byproducts" && (
                        <div className="space-y-4">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                                <div>
                                    <h3 className="font-bold text-slate-900">
                                        By Products
                                    </h3>

                                    <p className="mt-1 text-xs text-slate-500">
                                        Add additional items produced during this build.
                                    </p>
                                </div>

                                <button
                                    type="button"
                                    onClick={addByproduct}
                                    className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                                >
                                    <Plus size={15} />
                                    Add By Product
                                </button>
                            </div>

                            {byproducts.length === 0 ? (
                                <div className="rounded-xl border border-dashed border-slate-300 p-10 text-center">
                                    <Layers
                                        size={28}
                                        className="mx-auto text-slate-400"
                                    />

                                    <p className="mt-3 text-sm font-semibold text-slate-700">
                                        No by-products added
                                    </p>

                                    <p className="mt-1 text-xs text-slate-500">
                                        Add a by-product if this production run generates additional inventory.
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

                                                <button
                                                    type="button"
                                                    onClick={() => removeByproduct(index)}
                                                    className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-red-200 text-red-600 hover:bg-red-50"
                                                    title="Remove by-product"
                                                >
                                                    <Trash2 size={15} />
                                                </button>
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
                                                        label: `${item.name}${item.sku ? ` (${item.sku})` : ""}`,
                                                    }))}
                                                    placeholder="Select product or sub-product"
                                                    required
                                                />

                                                <Input
                                                    label="Description"
                                                    value={row.itemDescription}
                                                    onChange={(value) =>
                                                        updateByproduct(index, "itemDescription", value)
                                                    }
                                                />

                                                <Input
                                                    label="UOM"
                                                    value={row.uom}
                                                    onChange={(value) =>
                                                        updateByproduct(index, "uom", value)
                                                    }
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
                                                    required
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
                                                />

                                                <div>
                                                    <label className="mb-1.5 block text-xs font-semibold text-slate-600">
                                                        Amount
                                                    </label>

                                                    <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-bold text-slate-800">
                                                        {formatNumber(
                                                            numberValue(row.quantity) *
                                                            numberValue(row.unitCost)
                                                        )}
                                                    </div>
                                                </div>

                                                <TextArea
                                                    label="Details"
                                                    value={row.details}
                                                    onChange={(value) =>
                                                        updateByproduct(index, "details", value)
                                                    }
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

                    {/* ACCOUNTING LINES TAB */}

                    {activeTab === "accounting" && (
                        <div className="space-y-4">
                            <div>
                                <h3 className="font-bold text-slate-900">
                                    Inventory Valuation Summary
                                </h3>

                                <p className="mt-1 text-xs text-slate-500">
                                    This is an informational valuation summary. Manufacturing journal entries are not posted by Assembly Build.
                                </p>
                            </div>

                            <div className="overflow-x-auto rounded-xl border border-slate-200">
                                <table className="w-full min-w-[650px] text-left text-xs">
                                    <thead>
                                        <tr className="border-b border-slate-200 bg-slate-50 text-slate-600">
                                            <th className="px-4 py-3 font-bold">Description</th>
                                            <th className="px-4 py-3 font-bold">Account</th>
                                            <th className="px-4 py-3 text-right font-bold">Debit</th>
                                            <th className="px-4 py-3 text-right font-bold">Credit</th>
                                        </tr>
                                    </thead>

                                    <tbody>
                                        <tr className="border-b border-slate-100">
                                            <td className="px-4 py-3">
                                                Component inventory consumption
                                            </td>

                                            <td className="px-4 py-3">
                                                Inventory — Account 1400
                                            </td>

                                            <td className="px-4 py-3 text-right">
                                                0
                                            </td>

                                            <td className="px-4 py-3 text-right">
                                                {formatNumber(totals.componentAmount)}
                                            </td>
                                        </tr>

                                        <tr className="border-b border-slate-100">
                                            <td className="px-4 py-3">
                                                Finished assembly valuation
                                            </td>

                                            <td className="px-4 py-3">
                                                Inventory — Account 1400
                                            </td>

                                            <td className="px-4 py-3 text-right">
                                                0
                                            </td>

                                            <td className="px-4 py-3 text-right">
                                                0
                                            </td>
                                        </tr>

                                        <tr>
                                            <td className="px-4 py-3">
                                                By-product valuation
                                            </td>

                                            <td className="px-4 py-3">
                                                Inventory — Account 1400
                                            </td>

                                            <td className="px-4 py-3 text-right">
                                                0
                                            </td>

                                            <td className="px-4 py-3 text-right">
                                                {formatNumber(totals.byproductAmount)}
                                            </td>
                                        </tr>
                                    </tbody>
                                </table>
                            </div>

                            <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-xs text-amber-800">
                                No journal entry is generated or posted from this screen. Inventory stock movements will be handled by the Assembly Build approval process.
                            </div>
                        </div>
                    )}

                    {/* DOWNTIME TAB */}

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

                                <button
                                    type="button"
                                    onClick={addDowntime}
                                    className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                                >
                                    <Plus size={15} />
                                    Add Down Time
                                </button>
                            </div>

                            {downtime.length === 0 ? (
                                <div className="rounded-xl border border-dashed border-slate-300 p-10 text-center">
                                    <Clock3
                                        size={28}
                                        className="mx-auto text-slate-400"
                                    />

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

                                                <button
                                                    type="button"
                                                    onClick={() => removeDowntime(index)}
                                                    className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-red-200 text-red-600 hover:bg-red-50"
                                                >
                                                    <Trash2 size={15} />
                                                </button>
                                            </div>

                                            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                                                <Input
                                                    label="Machine"
                                                    value={row.machine}
                                                    onChange={(value) =>
                                                        updateDowntime(index, "machine", value)
                                                    }
                                                />

                                                <Input
                                                    label="Reason"
                                                    value={row.reason}
                                                    onChange={(value) =>
                                                        updateDowntime(index, "reason", value)
                                                    }
                                                />

                                                <Input
                                                    label="Start Time"
                                                    type="datetime-local"
                                                    value={row.startTime}
                                                    onChange={(value) =>
                                                        updateDowntime(index, "startTime", value)
                                                    }
                                                />

                                                <Input
                                                    label="End Time"
                                                    type="datetime-local"
                                                    value={row.endTime}
                                                    onChange={(value) =>
                                                        updateDowntime(index, "endTime", value)
                                                    }
                                                />

                                                <Input
                                                    label="Duration (Minutes)"
                                                    type="number"
                                                    min="0"
                                                    step="1"
                                                    value={row.durationMinutes}
                                                    onChange={(value) =>
                                                        updateDowntime(index, "durationMinutes", value)
                                                    }
                                                />

                                                <Input
                                                    label="Remarks"
                                                    value={row.remarks}
                                                    onChange={(value) =>
                                                        updateDowntime(index, "remarks", value)
                                                    }
                                                />
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}

                    {/* RELATED TRANSACTIONS TAB */}

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
                                No related transaction has been linked yet.
                            </p>
                        </div>
                    )}

                    {/* SYSTEM INFORMATION TAB */}

                    {activeTab === "system" && (
                        <div className="grid gap-4 sm:grid-cols-2">
                            <div className="rounded-xl border border-slate-200 p-4">
                                <p className="text-xs font-semibold uppercase text-slate-500">
                                    Document Status
                                </p>

                                <p className="mt-2 font-bold text-amber-700">
                                    DRAFT
                                </p>
                            </div>

                            <div className="rounded-xl border border-slate-200 p-4">
                                <p className="text-xs font-semibold uppercase text-slate-500">
                                    Transaction Number
                                </p>

                                <p className="mt-2 font-bold text-slate-800">
                                    Generated on Save
                                </p>
                            </div>

                            <div className="rounded-xl border border-slate-200 p-4">
                                <p className="text-xs font-semibold uppercase text-slate-500">
                                    Created At
                                </p>

                                <p className="mt-2 font-bold text-slate-800">
                                    Generated by server
                                </p>
                            </div>

                            <div className="rounded-xl border border-slate-200 p-4">
                                <p className="text-xs font-semibold uppercase text-slate-500">
                                    Inventory Posting
                                </p>

                                <p className="mt-2 font-bold text-slate-800">
                                    Not posted
                                </p>
                            </div>
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
                        <p className="text-xs text-slate-500">
                            Status
                        </p>

                        <p className="mt-1 text-lg font-bold text-amber-700">
                            DRAFT
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

                <button
                    type="submit"
                    disabled={saving || loadingBom}
                    className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-5 py-2.5 text-sm font-semibold text-slate-800 shadow-sm hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
                >
                    {saving ? (
                        <RefreshCw size={16} className="animate-spin" />
                    ) : (
                        <Save size={16} />
                    )}

                    {saving ? "Saving..." : "Save Assembly Build"}
                </button>
            </div>

            <div className="border-t border-slate-200 pt-4 text-center text-xs text-slate-400">
                Developed By Golden Lake
            </div>
        </form>
    );
}
