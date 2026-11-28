
"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

// ---------------------------------------------------------
// STYLING - WHITE AND LIGHT GRAY THEME
// ---------------------------------------------------------

const inputClass =
    "w-full min-w-0 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none transition focus:border-slate-300 focus:ring-2 focus:ring-slate-100 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-500";

const labelClass =
    "mb-1.5 block text-xs font-semibold text-slate-600";

const panelClass =
    "rounded-xl border border-slate-200 bg-white p-5";

const buttonClass =
    "rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40";

const primaryButtonClass =
    "rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50";

const emptyComponent = () => ({
    itemType: "PRODUCT",
    productId: "",
    subProductId: "",
    itemDescription: "",
    uom: "PCS",
    bomQuantity: "1",
    quantityType: "QUANTITY",
    itemSource: "STOCK",
});

const emptyStep = (sequence = 1) => ({
    sequence: String(sequence),
    operationName: "",
    workCenter: "",
    operationDescription: "",
});

const emptyRevision = (number = 1) => ({
    revisionId: null,
    revisionName: `Revision ${number}`,
    runRate: "0",
    hasProcess: false,
    components: [emptyComponent()],
    process: {
        processName: "",
        location: "",
        processDescription: "",
        processMemo: "",
        steps: [emptyStep()],
    },
});

const emptyForm = () => ({
    bomNumber: "",
    bomName: "",
    assemblyType: "PRODUCT",
    assemblyProductId: "",
    assemblySubProductId: "",
    memo: "",
    unitOfMeasure: "PCS",
    revisions: [emptyRevision()],
});

// ---------------------------------------------------------
// HELPERS
// ---------------------------------------------------------

function getProductLabel(item) {
    const sku = item.sku || item.product_code || "";
    const name = item.product_name || item.name || "";

    return [sku, name].filter(Boolean).join(" - ");
}

function getSubProductLabel(item) {
    const sku = item.sku || item.sub_product_code || "";
    const name = item.sub_product_name || item.name || "";

    return [sku, name].filter(Boolean).join(" - ");
}

function getAssemblyValue(form) {
    if (
        form.assemblyType === "SUB_PRODUCT" &&
        form.assemblySubProductId
    ) {
        return `SUB_PRODUCT:${form.assemblySubProductId}`;
    }

    if (form.assemblyProductId) {
        return `PRODUCT:${form.assemblyProductId}`;
    }

    return "";
}

function mapBomToForm(bom) {
    return {
        bomNumber: bom.bom_number || "",
        bomName: bom.bom_name || "",

        assemblyType: bom.assembly_sub_product_id
            ? "SUB_PRODUCT"
            : "PRODUCT",

        assemblyProductId: bom.assembly_product_id
            ? String(bom.assembly_product_id)
            : "",

        assemblySubProductId: bom.assembly_sub_product_id
            ? String(bom.assembly_sub_product_id)
            : "",

        memo: bom.memo || "",
        unitOfMeasure: bom.unit_of_measure || "",

        revisions: (bom.revisions || []).map((revision) => ({
            revisionId: revision.revision_id
                ? String(revision.revision_id)
                : null,

            revisionName: revision.revision_name || "",
            runRate: String(revision.run_rate ?? 0),
            hasProcess: Boolean(revision.has_process),

            components: (revision.components || []).map((component) => ({
                itemType: component.sub_product_id
                    ? "SUB_PRODUCT"
                    : "PRODUCT",

                productId: component.product_id
                    ? String(component.product_id)
                    : "",

                subProductId: component.sub_product_id
                    ? String(component.sub_product_id)
                    : "",

                itemDescription: component.item_description || "",
                uom: component.uom || "",
                bomQuantity: String(component.bom_quantity ?? 1),
                quantityType: component.quantity_type || "QUANTITY",
                itemSource: component.item_source || "STOCK",
            })),

            process: {
                processName: revision.process?.process_name || "",
                location: revision.process?.location || "",
                processDescription:
                    revision.process?.process_description || "",
                processMemo: revision.process?.process_memo || "",

                steps: revision.process?.steps?.length
                    ? revision.process.steps.map((step) => ({
                        sequence: String(step.sequence),
                        operationName: step.operation_name || "",
                        workCenter: step.work_center || "",
                        operationDescription:
                            step.operation_description || "",
                    }))
                    : [emptyStep()],
            },
        })),
    };
}

// ---------------------------------------------------------
// REUSABLE UI COMPONENTS
// ---------------------------------------------------------

function PanelTitle({ children, right }) {
    return (
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-base font-bold text-slate-700">
                {children}
            </h2>

            {right}
        </div>
    );
}

function GridToolbar({ children }) {
    return (
        <div className="flex min-h-12 flex-wrap items-center gap-2 rounded-t-lg border border-slate-200 bg-white px-3 py-2">
            {children}
        </div>
    );
}

function DataTable({ children, minWidth = "760px" }) {
    return (
        <div className="overflow-x-auto rounded-b-lg border border-t-0 border-slate-200">
            <table
                className="w-full border-collapse text-left text-xs"
                style={{ minWidth }}
            >
                {children}
            </table>
        </div>
    );
}

function TableHead({ children }) {
    return (
        <thead>
            <tr className="bg-white text-slate-600">
                {children}
            </tr>
        </thead>
    );
}

function Th({ children, className = "" }) {
    return (
        <th
            className={`border-b border-r border-slate-200 bg-white px-3 py-3 font-semibold ${className}`}
        >
            {children}
        </th>
    );
}

function Td({ children, className = "" }) {
    return (
        <td
            className={`border border-slate-200 px-2 py-2 align-middle ${className}`}
        >
            {children}
        </td>
    );
}

// ---------------------------------------------------------
// MAIN COMPONENT
// ---------------------------------------------------------

export default function BillOfMaterialsForm({
    bomId = null,
    readOnly = false,
}) {
    const router = useRouter();

    const isEdit = Boolean(bomId) && !readOnly;

    const [form, setForm] = useState(emptyForm);
    const [products, setProducts] = useState([]);
    const [subProducts, setSubProducts] = useState([]);

    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState("");

    // ---------------------------------------------------------
    // LOAD PRODUCTS, SUB-PRODUCTS AND EXISTING BOM
    // ---------------------------------------------------------

    useEffect(() => {
        let active = true;

        async function load() {
            try {
                const optionsResponse = await fetch(
                    "/api/bill-of-materials/options",
                    { cache: "no-store" }
                );

                const optionsData = await optionsResponse.json();

                if (!optionsResponse.ok || !optionsData.success) {
                    throw new Error(
                        optionsData.message ||
                        "Unable to load item options."
                    );
                }

                if (!active) return;

                setProducts(
                    Array.isArray(optionsData.products)
                        ? optionsData.products
                        : []
                );

                setSubProducts(
                    Array.isArray(optionsData.subProducts)
                        ? optionsData.subProducts
                        : []
                );

                if (bomId) {
                    const response = await fetch(
                        `/api/bill-of-materials/${bomId}`,
                        { cache: "no-store" }
                    );

                    const data = await response.json();

                    if (
                        !response.ok ||
                        !data.success ||
                        !data.bom
                    ) {
                        throw new Error(
                            data.message || "Unable to load BOM."
                        );
                    }

                    if (active) {
                        setForm(mapBomToForm(data.bom));
                    }
                }
            } catch (err) {
                if (active) {
                    setError(
                        err.message || "Unable to load BOM."
                    );
                }
            } finally {
                if (active) {
                    setLoading(false);
                }
            }
        }

        load();

        return () => {
            active = false;
        };
    }, [bomId]);

    // ---------------------------------------------------------
    // COMBINED ITEM OPTIONS
    // Products + Sub-products
    // ---------------------------------------------------------

    const allItems = useMemo(() => {
        const productItems = products
            .filter((item) => item.product_id)
            .map((item) => ({
                value: `PRODUCT:${item.product_id}`,
                label: `${getProductLabel(item)} (Product)`,
                type: "PRODUCT",
                id: String(item.product_id),
                description:
                    item.description || item.product_name || "",
                uom: item.unit || item.uom || "",
            }));

        const subProductItems = subProducts
            .filter((item) => item.sub_product_id)
            .map((item) => ({
                value: `SUB_PRODUCT:${item.sub_product_id}`,
                label: `${getSubProductLabel(item)} (Sub-product)`,
                type: "SUB_PRODUCT",
                id: String(item.sub_product_id),
                description:
                    item.description || item.sub_product_name || "",
                uom: item.unit || item.uom || "",
            }));

        return [
            ...productItems,
            ...subProductItems,
        ].sort((a, b) =>
            a.label.localeCompare(b.label)
        );
    }, [products, subProducts]);

    // ---------------------------------------------------------
    // ASSEMBLY ITEM LABEL
    // ---------------------------------------------------------

    const assemblyItemLabel = useMemo(() => {
        const selectedValue = getAssemblyValue(form);

        const item = allItems.find(
            (row) => row.value === selectedValue
        );

        return item?.label || "";
    }, [form, allItems]);

    // ---------------------------------------------------------
    // FORM UPDATE FUNCTIONS
    // ---------------------------------------------------------

    function updateForm(field, value) {
        setForm((current) => ({
            ...current,
            [field]: value,
        }));
    }

    function updateRevision(revisionIndex, field, value) {
        setForm((current) => ({
            ...current,

            revisions: current.revisions.map(
                (revision, index) =>
                    index === revisionIndex
                        ? {
                            ...revision,
                            [field]: value,
                        }
                        : revision
            ),
        }));
    }

    function updateComponent(
        revisionIndex,
        componentIndex,
        field,
        value
    ) {
        setForm((current) => ({
            ...current,

            revisions: current.revisions.map(
                (revision, rIndex) => {
                    if (rIndex !== revisionIndex) {
                        return revision;
                    }

                    return {
                        ...revision,

                        components: revision.components.map(
                            (component, cIndex) => {
                                if (cIndex !== componentIndex) {
                                    return component;
                                }

                                return {
                                    ...component,
                                    [field]: value,
                                };
                            }
                        ),
                    };
                }
            ),
        }));
    }

    // ---------------------------------------------------------
    // ASSEMBLY ITEM SELECTION
    // ONE DROPDOWN FOR PRODUCTS AND SUB-PRODUCTS
    // ---------------------------------------------------------

    function updateAssemblySelection(value) {
        const [itemType, selectedId] = String(value || "").split(":");

        if (
            !selectedId ||
            !["PRODUCT", "SUB_PRODUCT"].includes(itemType)
        ) {
            setForm((current) => ({
                ...current,
                assemblyType: "PRODUCT",
                assemblyProductId: "",
                assemblySubProductId: "",
            }));

            return;
        }

        setForm((current) => ({
            ...current,

            assemblyType: itemType,

            assemblyProductId:
                itemType === "PRODUCT"
                    ? selectedId
                    : "",

            assemblySubProductId:
                itemType === "SUB_PRODUCT"
                    ? selectedId
                    : "",
        }));
    }

    // ---------------------------------------------------------
    // COMPONENT ITEM SELECTION
    // ---------------------------------------------------------

    function updateComponentSelection(
        revisionIndex,
        componentIndex,
        value
    ) {
        const [itemType, selectedId] = String(value || "").split(":");

        const selectedItem = allItems.find(
            (item) => item.value === value
        );

        setForm((current) => ({
            ...current,

            revisions: current.revisions.map(
                (revision, rIndex) => {
                    if (rIndex !== revisionIndex) {
                        return revision;
                    }

                    return {
                        ...revision,

                        components: revision.components.map(
                            (component, cIndex) => {
                                if (cIndex !== componentIndex) {
                                    return component;
                                }

                                if (
                                    !selectedId ||
                                    !selectedItem ||
                                    !["PRODUCT", "SUB_PRODUCT"].includes(
                                        itemType
                                    )
                                ) {
                                    return {
                                        ...component,
                                        itemType: "PRODUCT",
                                        productId: "",
                                        subProductId: "",
                                        itemDescription: "",
                                        uom: "",
                                    };
                                }

                                return {
                                    ...component,

                                    itemType,

                                    productId:
                                        itemType === "PRODUCT"
                                            ? selectedId
                                            : "",

                                    subProductId:
                                        itemType === "SUB_PRODUCT"
                                            ? selectedId
                                            : "",

                                    itemDescription:
                                        selectedItem.description,

                                    uom: selectedItem.uom,
                                };
                            }
                        ),
                    };
                }
            ),
        }));
    }

    // ---------------------------------------------------------
    // PROCESS / ROUTING UPDATE FUNCTIONS
    // ---------------------------------------------------------

    function updateProcess(revisionIndex, field, value) {
        setForm((current) => ({
            ...current,

            revisions: current.revisions.map(
                (revision, index) =>
                    index === revisionIndex
                        ? {
                            ...revision,

                            process: {
                                ...revision.process,
                                [field]: value,
                            },
                        }
                        : revision
            ),
        }));
    }

    function updateStep(
        revisionIndex,
        stepIndex,
        field,
        value
    ) {
        setForm((current) => ({
            ...current,

            revisions: current.revisions.map(
                (revision, rIndex) => {
                    if (rIndex !== revisionIndex) {
                        return revision;
                    }

                    return {
                        ...revision,

                        process: {
                            ...revision.process,

                            steps: revision.process.steps.map(
                                (step, sIndex) =>
                                    sIndex === stepIndex
                                        ? {
                                            ...step,
                                            [field]: value,
                                        }
                                        : step
                            ),
                        },
                    };
                }
            ),
        }));
    }

    // ---------------------------------------------------------
    // ADD / REMOVE REVISION
    // ---------------------------------------------------------

    function addRevision() {
        setForm((current) => ({
            ...current,

            revisions: [
                ...current.revisions,
                emptyRevision(current.revisions.length + 1),
            ],
        }));
    }

    function removeRevision(index) {
        setForm((current) => ({
            ...current,

            revisions: current.revisions.filter(
                (_, i) => i !== index
            ),
        }));
    }

    // ---------------------------------------------------------
    // ADD / REMOVE COMPONENT
    // ---------------------------------------------------------

    function addComponent(revisionIndex) {
        setForm((current) => ({
            ...current,

            revisions: current.revisions.map(
                (revision, index) =>
                    index === revisionIndex
                        ? {
                            ...revision,

                            components: [
                                ...revision.components,
                                emptyComponent(),
                            ],
                        }
                        : revision
            ),
        }));
    }

    function removeComponent(
        revisionIndex,
        componentIndex
    ) {
        setForm((current) => ({
            ...current,

            revisions: current.revisions.map(
                (revision, rIndex) =>
                    rIndex === revisionIndex
                        ? {
                            ...revision,

                            components: revision.components.filter(
                                (_, index) =>
                                    index !== componentIndex
                            ),
                        }
                        : revision
            ),
        }));
    }

    // ---------------------------------------------------------
    // ADD / REMOVE ROUTING STEPS
    // ---------------------------------------------------------

    function addStep(revisionIndex) {
        setForm((current) => ({
            ...current,

            revisions: current.revisions.map(
                (revision, index) => {
                    if (index !== revisionIndex) {
                        return revision;
                    }

                    const rows = revision.process.steps;

                    return {
                        ...revision,

                        process: {
                            ...revision.process,

                            steps: [
                                ...rows,
                                emptyStep(rows.length + 1),
                            ],
                        },
                    };
                }
            ),
        }));
    }

    function removeStep(revisionIndex, stepIndex) {
        setForm((current) => ({
            ...current,

            revisions: current.revisions.map(
                (revision, rIndex) => {
                    if (rIndex !== revisionIndex) {
                        return revision;
                    }

                    const rows = revision.process.steps
                        .filter(
                            (_, index) => index !== stepIndex
                        )
                        .map((step, index) => ({
                            ...step,
                            sequence: String(index + 1),
                        }));

                    return {
                        ...revision,

                        process: {
                            ...revision.process,
                            steps: rows,
                        },
                    };
                }
            ),
        }));
    }

    // ---------------------------------------------------------
    // VALIDATION
    // ---------------------------------------------------------

    function validate() {
        if (!form.bomName.trim()) {
            return "BOM Name is required.";
        }

        if (!form.unitOfMeasure.trim()) {
            return "Unit of Measure is required.";
        }

        if (
            form.assemblyType === "PRODUCT" &&
            !form.assemblyProductId
        ) {
            return "Select an Assembly Item.";
        }

        if (
            form.assemblyType === "SUB_PRODUCT" &&
            !form.assemblySubProductId
        ) {
            return "Select an Assembly Item.";
        }

        if (!form.revisions.length) {
            return "Add at least one BOM Revision.";
        }

        const names = new Set();

        for (
            let i = 0;
            i < form.revisions.length;
            i += 1
        ) {
            const revision = form.revisions[i];

            const name = revision.revisionName
                .trim()
                .toLowerCase();

            if (!name) {
                return `Enter the name of Revision ${i + 1}.`;
            }

            if (names.has(name)) {
                return `Duplicate revision name: ${revision.revisionName}.`;
            }

            names.add(name);

            if (!revision.components.length) {
                return `Add at least one component to ${revision.revisionName}.`;
            }

            for (
                let j = 0;
                j < revision.components.length;
                j += 1
            ) {
                const component = revision.components[j];

                const selected =
                    component.itemType === "PRODUCT"
                        ? component.productId
                        : component.subProductId;

                if (!selected) {
                    return `Select an item in component ${j + 1} of ${revision.revisionName}.`;
                }

                if (
                    !component.bomQuantity ||
                    !Number.isFinite(Number(component.bomQuantity)) ||
                    Number(component.bomQuantity) <= 0
                ) {
                    return `Enter a valid BOM Quantity in component ${j + 1}.`;
                }
            }

            if (revision.hasProcess) {
                if (!revision.process.processName.trim()) {
                    return `Routing Name is required for ${revision.revisionName}.`;
                }

                if (!revision.process.steps.length) {
                    return `Add at least one Routing Step to ${revision.revisionName}.`;
                }

                if (
                    revision.process.steps.some(
                        (step) => !step.operationName.trim()
                    )
                ) {
                    return `Enter an Operation Name for every routing step in ${revision.revisionName}.`;
                }
            }
        }

        return "";
    }

    // ---------------------------------------------------------
    // SAVE BOM
    // BOM NUMBER IS GENERATED BY THE SERVER
    // ---------------------------------------------------------

    async function handleSubmit(event) {
        event.preventDefault();

        if (readOnly || saving) return;

        setError("");

        const validationMessage = validate();

        if (validationMessage) {
            setError(validationMessage);
            return;
        }

        const payload = {
            ...form,

            // Never allow the client to set or change BOM Number.
            bomNumber: undefined,

            revisions: form.revisions.map((revision) => ({
                ...revision,

                revisionId: revision.revisionId || null,

                process: revision.hasProcess
                    ? revision.process
                    : null,

                components: revision.components.map(
                    (component) => ({
                        ...component,

                        productId:
                            component.itemType === "PRODUCT"
                                ? component.productId
                                : null,

                        subProductId:
                            component.itemType === "SUB_PRODUCT"
                                ? component.subProductId
                                : null,
                    })
                ),
            })),
        };

        setSaving(true);

        try {
            const response = await fetch(
                isEdit
                    ? `/api/bill-of-materials/${bomId}`
                    : "/api/bill-of-materials",
                {
                    method: isEdit ? "PUT" : "POST",

                    headers: {
                        "Content-Type": "application/json",
                    },

                    body: JSON.stringify(payload),
                }
            );

            const data = await response.json();

            if (!response.ok || !data.success) {
                throw new Error(
                    data.message || "Unable to save BOM."
                );
            }

            router.push("/dashboard/bill-of-materials");
            router.refresh();
        } catch (err) {
            setError(
                err.message || "Unable to save BOM."
            );
        } finally {
            setSaving(false);
        }
    }

    const fieldDisabled = readOnly || saving;

    // ---------------------------------------------------------
    // LOADING
    // ---------------------------------------------------------

    if (loading) {
        return (
            <div className="bg-white p-6 text-sm text-slate-500">
                Loading BOM...
            </div>
        );
    }

    // ---------------------------------------------------------
    // MAIN FORM
    // ---------------------------------------------------------

    return (
        <div className="min-h-full space-y-4 bg-white p-3 md:p-5">

            {/* PAGE HEADER */}

            <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                    <h1 className="text-xl font-bold text-slate-700">
                        {readOnly ? "View BOM" : "Add/Edit BOM"}
                    </h1>

                    <p className="mt-1 text-xs text-slate-500">
                        Production Planning / Bill of Materials
                    </p>
                </div>

                <div className="flex flex-wrap gap-2">
                    {!readOnly && (
                        <button
                            type="submit"
                            form="bom-entry-form"
                            disabled={saving}
                            className={primaryButtonClass}
                        >
                            {saving ? "Saving..." : "Save"}
                        </button>
                    )}

                    <Link
                        href="/dashboard/bill-of-materials"
                        className={buttonClass}
                    >
                        Back
                    </Link>
                </div>
            </div>

            {/* ERROR */}

            {error && (
                <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                    {error}
                </div>
            )}

            <form
                id="bom-entry-form"
                onSubmit={handleSubmit}
                className="space-y-4"
            >

                {/* BOM DETAILS AND REVISION SUMMARY */}

                <div className="grid items-start gap-4 xl:grid-cols-[1.15fr_0.85fr]">

                    {/* BOM DETAILS */}

                    <section className={panelClass}>
                        <PanelTitle>
                            BOM Details
                        </PanelTitle>

                        <div className="grid gap-x-8 gap-y-4 md:grid-cols-2">

                            {/* BOM NUMBER - AUTOMATIC AND READ ONLY */}

                            <label>
                                <span className={labelClass}>
                                    BOM Number
                                </span>

                                <input
                                    className={`${inputClass} bg-slate-50 font-semibold text-slate-700`}
                                    value={
                                        form.bomNumber ||
                                        (bomId
                                            ? "Not available"
                                            : "Generated automatically")
                                    }
                                    disabled
                                    readOnly
                                    placeholder="Generated automatically"
                                />

                                <span className="mt-1 block text-[11px] text-slate-500">
                                    Automatically assigned when the BOM is saved.
                                </span>
                            </label>

                            {/* ASSEMBLY ITEM - SINGLE DROPDOWN */}

                            <label>
                                <span className={labelClass}>
                                    <span className="text-red-600">*</span>{" "}
                                    Assembly Item
                                </span>

                                <select
                                    className={inputClass}
                                    value={getAssemblyValue(form)}
                                    disabled={fieldDisabled}
                                    onChange={(e) =>
                                        updateAssemblySelection(e.target.value)
                                    }
                                    required
                                >
                                    <option value="">
                                        Select Assembly Item
                                    </option>

                                    {allItems.map((item) => (
                                        <option
                                            key={item.value}
                                            value={item.value}
                                        >
                                            {item.label}
                                        </option>
                                    ))}
                                </select>

                                <span className="mt-1 block text-[11px] text-slate-500">
                                    Products and sub-products are available in the same list.
                                </span>
                            </label>

                            {/* BOM NAME */}

                            <label>
                                <span className={labelClass}>
                                    <span className="text-red-600">*</span>{" "}
                                    BOM Name
                                </span>

                                <input
                                    className={inputClass}
                                    value={form.bomName}
                                    disabled={fieldDisabled}
                                    onChange={(e) =>
                                        updateForm("bomName", e.target.value)
                                    }
                                    required
                                />
                            </label>

                            {/* MEMO */}

                            <label>
                                <span className={labelClass}>
                                    Memo
                                </span>

                                <input
                                    className={inputClass}
                                    value={form.memo}
                                    disabled={fieldDisabled}
                                    onChange={(e) =>
                                        updateForm("memo", e.target.value)
                                    }
                                />
                            </label>

                            {/* UOM */}

                            <label>
                                <span className={labelClass}>
                                    <span className="text-red-600">*</span>{" "}
                                    Unit of Measure
                                </span>

                                <input
                                    className={inputClass}
                                    value={form.unitOfMeasure}
                                    disabled={fieldDisabled}
                                    onChange={(e) =>
                                        updateForm(
                                            "unitOfMeasure",
                                            e.target.value
                                        )
                                    }
                                    required
                                />
                            </label>
                        </div>
                    </section>

                    {/* BOM REVISION */}

                    <section className={panelClass}>
                        <PanelTitle
                            right={
                                !readOnly && (
                                    <button
                                        type="button"
                                        className={primaryButtonClass}
                                        onClick={addRevision}
                                    >
                                        + Add Row
                                    </button>
                                )
                            }
                        >
                            BOM Revision
                        </PanelTitle>

                        <GridToolbar>
                            <span className="text-xs text-slate-500">
                                {form.revisions.length} revision(s)
                            </span>

                            {readOnly && (
                                <span className="ml-auto text-xs text-slate-500">
                                    Read only
                                </span>
                            )}
                        </GridToolbar>

                        <DataTable minWidth="560px">
                            <TableHead>
                                <Th className="w-10 text-center">#</Th>
                                <Th>Name</Th>
                                <Th className="text-right">
                                    Run Rate (Min/Unit)
                                </Th>

                                {!readOnly && (
                                    <Th className="w-20 text-center">
                                        Action
                                    </Th>
                                )}
                            </TableHead>

                            <tbody>
                                {form.revisions.map((revision, index) => (
                                    <tr
                                        key={
                                            revision.revisionId ||
                                            `revision-${index}`
                                        }
                                        className="bg-white hover:bg-slate-50"
                                    >
                                        <Td className="text-center text-slate-500">
                                            {index + 1}
                                        </Td>

                                        <Td>
                                            <input
                                                className={inputClass}
                                                value={revision.revisionName}
                                                disabled={fieldDisabled}
                                                onChange={(e) =>
                                                    updateRevision(
                                                        index,
                                                        "revisionName",
                                                        e.target.value
                                                    )
                                                }
                                            />
                                        </Td>

                                        <Td>
                                            <input
                                                type="number"
                                                min="0"
                                                step="1"
                                                className={`${inputClass} text-right`}
                                                value={revision.runRate}
                                                disabled={fieldDisabled}
                                                onChange={(e) =>
                                                    updateRevision(
                                                        index,
                                                        "runRate",
                                                        e.target.value
                                                    )
                                                }
                                            />
                                        </Td>

                                        {!readOnly && (
                                            <Td className="text-center">
                                                <button
                                                    type="button"
                                                    disabled={
                                                        form.revisions.length === 1
                                                    }
                                                    onClick={() =>
                                                        removeRevision(index)
                                                    }
                                                    className="text-xs font-semibold text-red-600 hover:text-red-700 disabled:opacity-30"
                                                >
                                                    Remove
                                                </button>
                                            </Td>
                                        )}
                                    </tr>
                                ))}
                            </tbody>
                        </DataTable>
                    </section>
                </div>

                {/* REVISION COMPONENTS AND ROUTING */}

                {form.revisions.map((revision, revisionIndex) => (
                    <section
                        key={
                            revision.revisionId ||
                            `revision-detail-${revisionIndex}`
                        }
                        className={panelClass}
                    >

                        {/* COMPONENT HEADER */}

                        <PanelTitle
                            right={
                                <span className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600">
                                    {revision.revisionName ||
                                        `Revision ${revisionIndex + 1}`}
                                </span>
                            }
                        >
                            BOM Revision Component
                        </PanelTitle>

                        {/* COMPONENT TOOLBAR */}

                        <GridToolbar>
                            <span className="text-xs font-medium text-slate-500">
                                {revision.components.length} component row(s)
                            </span>

                            {!readOnly && (
                                <>
                                    <button
                                        type="button"
                                        className={buttonClass}
                                        onClick={() =>
                                            addComponent(revisionIndex)
                                        }
                                    >
                                        Add Row
                                    </button>

                                    <button
                                        type="button"
                                        className={buttonClass}
                                        onClick={() =>
                                            updateRevision(
                                                revisionIndex,
                                                "components",
                                                [emptyComponent()]
                                            )
                                        }
                                    >
                                        Reset Rows
                                    </button>
                                </>
                            )}
                        </GridToolbar>

                        {/* COMPONENT TABLE */}

                        <DataTable minWidth="1120px">
                            <TableHead>
                                <Th className="w-10 text-center">#</Th>
                                <Th>Item</Th>
                                <Th>Item Description</Th>
                                <Th>UOM</Th>
                                <Th className="text-right">
                                    BOM Quantity
                                </Th>
                                <Th>Item Source</Th>
                                <Th>Quantity / Percentage %</Th>

                                {!readOnly && (
                                    <Th className="w-20">
                                        Action
                                    </Th>
                                )}
                            </TableHead>

                            <tbody>
                                {revision.components.map(
                                    (component, componentIndex) => (
                                        <tr
                                            key={componentIndex}
                                            className="bg-white hover:bg-slate-50"
                                        >
                                            <Td className="text-center text-slate-500">
                                                {componentIndex + 1}
                                            </Td>

                                            {/* PRODUCT + SUB-PRODUCT DROPDOWN */}

                                            <Td>
                                                <select
                                                    className={inputClass}
                                                    value={
                                                        component.itemType === "SUB_PRODUCT" &&
                                                        component.subProductId
                                                            ? `SUB_PRODUCT:${component.subProductId}`
                                                            : component.productId
                                                                ? `PRODUCT:${component.productId}`
                                                                : ""
                                                    }
                                                    disabled={fieldDisabled}
                                                    onChange={(e) =>
                                                        updateComponentSelection(
                                                            revisionIndex,
                                                            componentIndex,
                                                            e.target.value
                                                        )
                                                    }
                                                >
                                                    <option value="">
                                                        Select Item
                                                    </option>

                                                    {allItems.map((item) => (
                                                        <option
                                                            key={item.value}
                                                            value={item.value}
                                                        >
                                                            {item.label}
                                                        </option>
                                                    ))}
                                                </select>
                                            </Td>

                                            {/* DESCRIPTION */}

                                            <Td>
                                                <input
                                                    className={inputClass}
                                                    value={component.itemDescription}
                                                    disabled={fieldDisabled}
                                                    onChange={(e) =>
                                                        updateComponent(
                                                            revisionIndex,
                                                            componentIndex,
                                                            "itemDescription",
                                                            e.target.value
                                                        )
                                                    }
                                                />
                                            </Td>

                                            {/* UOM */}

                                            <Td>
                                                <input
                                                    className={inputClass}
                                                    value={component.uom}
                                                    disabled={fieldDisabled}
                                                    onChange={(e) =>
                                                        updateComponent(
                                                            revisionIndex,
                                                            componentIndex,
                                                            "uom",
                                                            e.target.value
                                                        )
                                                    }
                                                />
                                            </Td>

                                            {/* BOM QUANTITY */}

                                            <Td>
                                                <input
                                                    type="number"
                                                    min="1"
                                                    step="1"
                                                    className={`${inputClass} text-right`}
                                                    value={component.bomQuantity}
                                                    disabled={fieldDisabled}
                                                    onChange={(e) =>
                                                        updateComponent(
                                                            revisionIndex,
                                                            componentIndex,
                                                            "bomQuantity",
                                                            e.target.value
                                                        )
                                                    }
                                                />
                                            </Td>

                                            {/* ITEM SOURCE */}

                                            <Td>
                                                <select
                                                    className={inputClass}
                                                    value={component.itemSource}
                                                    disabled={fieldDisabled}
                                                    onChange={(e) =>
                                                        updateComponent(
                                                            revisionIndex,
                                                            componentIndex,
                                                            "itemSource",
                                                            e.target.value
                                                        )
                                                    }
                                                >
                                                    <option value="STOCK">
                                                        STOCK
                                                    </option>
                                                </select>
                                            </Td>

                                            {/* QUANTITY TYPE */}

                                            <Td>
                                                <select
                                                    className={inputClass}
                                                    value={component.quantityType}
                                                    disabled={fieldDisabled}
                                                    onChange={(e) =>
                                                        updateComponent(
                                                            revisionIndex,
                                                            componentIndex,
                                                            "quantityType",
                                                            e.target.value
                                                        )
                                                    }
                                                >
                                                    <option value="QUANTITY">
                                                        Quantity
                                                    </option>

                                                    <option value="PERCENTAGE">
                                                        Percentage %
                                                    </option>
                                                </select>
                                            </Td>

                                            {/* REMOVE COMPONENT */}

                                            {!readOnly && (
                                                <Td className="text-center">
                                                    <button
                                                        type="button"
                                                        disabled={
                                                            revision.components.length === 1
                                                        }
                                                        onClick={() =>
                                                            removeComponent(
                                                                revisionIndex,
                                                                componentIndex
                                                            )
                                                        }
                                                        className="text-xs font-semibold text-red-600 hover:text-red-700 disabled:opacity-30"
                                                    >
                                                        Remove
                                                    </button>
                                                </Td>
                                            )}
                                        </tr>
                                    )
                                )}
                            </tbody>
                        </DataTable>

                        {/* PROCESS / ROUTING */}

                        <div className="mt-5 border-t border-slate-200 pt-4">

                            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                                <div>
                                    <h3 className="text-sm font-bold text-slate-700">
                                        Process / Routing
                                    </h3>

                                    <p className="mt-1 text-xs text-slate-500">
                                        Routing is optional and belongs to this BOM revision.
                                    </p>
                                </div>

                                <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600">
                                    <input
                                        type="checkbox"
                                        checked={revision.hasProcess}
                                        disabled={fieldDisabled}
                                        onChange={(e) =>
                                            updateRevision(
                                                revisionIndex,
                                                "hasProcess",
                                                e.target.checked
                                            )
                                        }
                                        className="h-4 w-4 accent-slate-500"
                                    />

                                    Enable Routing
                                </label>
                            </div>

                            {revision.hasProcess && (
                                <div className="rounded-lg border border-slate-200 bg-white p-4">

                                    <PanelTitle>
                                        Add / Edit Routing
                                    </PanelTitle>

                                    {/* ROUTING DETAILS */}

                                    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">

                                        <label>
                                            <span className={labelClass}>
                                                Routing Name *
                                            </span>

                                            <input
                                                className={inputClass}
                                                value={revision.process.processName}
                                                disabled={fieldDisabled}
                                                onChange={(e) =>
                                                    updateProcess(
                                                        revisionIndex,
                                                        "processName",
                                                        e.target.value
                                                    )
                                                }
                                            />
                                        </label>

                                        <label>
                                            <span className={labelClass}>
                                                Location
                                            </span>

                                            <input
                                                className={inputClass}
                                                value={revision.process.location}
                                                disabled={fieldDisabled}
                                                onChange={(e) =>
                                                    updateProcess(
                                                        revisionIndex,
                                                        "location",
                                                        e.target.value
                                                    )
                                                }
                                            />
                                        </label>

                                        <label>
                                            <span className={labelClass}>
                                                Assembly Item
                                            </span>

                                            <input
                                                className={inputClass}
                                                value={assemblyItemLabel}
                                                disabled
                                            />
                                        </label>

                                        <label>
                                            <span className={labelClass}>
                                                BOM Revision
                                            </span>

                                            <input
                                                className={inputClass}
                                                value={revision.revisionName}
                                                disabled
                                            />
                                        </label>

                                        <label>
                                            <span className={labelClass}>
                                                Item Description
                                            </span>

                                            <input
                                                className={inputClass}
                                                value={revision.process.processDescription}
                                                disabled={fieldDisabled}
                                                onChange={(e) =>
                                                    updateProcess(
                                                        revisionIndex,
                                                        "processDescription",
                                                        e.target.value
                                                    )
                                                }
                                            />
                                        </label>

                                        <label>
                                            <span className={labelClass}>
                                                Routing Memo
                                            </span>

                                            <input
                                                className={inputClass}
                                                value={revision.process.processMemo}
                                                disabled={fieldDisabled}
                                                onChange={(e) =>
                                                    updateProcess(
                                                        revisionIndex,
                                                        "processMemo",
                                                        e.target.value
                                                    )
                                                }
                                            />
                                        </label>
                                    </div>

                                    {/* ROUTING STEPS */}

                                    <div className="mt-5">

                                        <PanelTitle
                                            right={
                                                !readOnly && (
                                                    <button
                                                        type="button"
                                                        className={buttonClass}
                                                        onClick={() =>
                                                            addStep(revisionIndex)
                                                        }
                                                    >
                                                        Add Row
                                                    </button>
                                                )
                                            }
                                        >
                                            Routing Steps
                                        </PanelTitle>

                                        <GridToolbar>
                                            <span className="text-xs text-slate-500">
                                                {revision.process.steps.length} routing step(s)
                                            </span>
                                        </GridToolbar>

                                        <DataTable minWidth="760px">
                                            <TableHead>
                                                <Th className="w-16 text-center">
                                                    #
                                                </Th>

                                                <Th>Sequence</Th>
                                                <Th>Operation Name</Th>
                                                <Th>Work Center</Th>

                                                {!readOnly && (
                                                    <Th className="w-20">
                                                        Action
                                                    </Th>
                                                )}
                                            </TableHead>

                                            <tbody>
                                                {revision.process.steps.map(
                                                    (step, stepIndex) => (
                                                        <tr
                                                            key={stepIndex}
                                                            className="bg-white hover:bg-slate-50"
                                                        >
                                                            <Td className="text-center text-slate-500">
                                                                {stepIndex + 1}
                                                            </Td>

                                                            <Td>
                                                                <input
                                                                    type="number"
                                                                    min="1"
                                                                    className={inputClass}
                                                                    value={step.sequence}
                                                                    disabled={fieldDisabled}
                                                                    onChange={(e) =>
                                                                        updateStep(
                                                                            revisionIndex,
                                                                            stepIndex,
                                                                            "sequence",
                                                                            e.target.value
                                                                        )
                                                                    }
                                                                />
                                                            </Td>

                                                            <Td>
                                                                <input
                                                                    className={inputClass}
                                                                    value={step.operationName}
                                                                    disabled={fieldDisabled}
                                                                    onChange={(e) =>
                                                                        updateStep(
                                                                            revisionIndex,
                                                                            stepIndex,
                                                                            "operationName",
                                                                            e.target.value
                                                                        )
                                                                    }
                                                                />
                                                            </Td>

                                                            <Td>
                                                                <input
                                                                    className={inputClass}
                                                                    value={step.workCenter}
                                                                    disabled={fieldDisabled}
                                                                    onChange={(e) =>
                                                                        updateStep(
                                                                            revisionIndex,
                                                                            stepIndex,
                                                                            "workCenter",
                                                                            e.target.value
                                                                        )
                                                                    }
                                                                />
                                                            </Td>

                                                            {!readOnly && (
                                                                <Td className="text-center">
                                                                    <button
                                                                        type="button"
                                                                        disabled={
                                                                            revision.process.steps.length === 1
                                                                        }
                                                                        onClick={() =>
                                                                            removeStep(
                                                                                revisionIndex,
                                                                                stepIndex
                                                                            )
                                                                        }
                                                                        className="text-xs font-semibold text-red-600 hover:text-red-700 disabled:opacity-30"
                                                                    >
                                                                        Remove
                                                                    </button>
                                                                </Td>
                                                            )}
                                                        </tr>
                                                    )
                                                )}
                                            </tbody>
                                        </DataTable>
                                    </div>
                                </div>
                            )}
                        </div>
                    </section>
                ))}

                {/* BOTTOM ACTIONS */}

                {!readOnly && (
                    <div className="flex flex-wrap justify-end gap-2 rounded-xl border border-slate-200 bg-white p-4">

                        <Link
                            href="/dashboard/bill-of-materials"
                            className={buttonClass}
                        >
                            Cancel
                        </Link>

                        <button
                            type="submit"
                            disabled={saving}
                            className={primaryButtonClass}
                        >
                            {saving
                                ? "Saving..."
                                : isEdit
                                    ? "Update BOM"
                                    : "Save BOM"}
                        </button>
                    </div>
                )}
            </form>
        </div>
    );
}
