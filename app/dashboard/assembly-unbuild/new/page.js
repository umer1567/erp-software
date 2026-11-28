
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
    ArrowLeft,
    Save,
    RefreshCw,
    Package,
    Warehouse,
    Factory,
    Layers,
    CalendarDays,
    AlertCircle,
    CheckCircle2,
    Calculator,
    ClipboardList,
} from "lucide-react";

const API_URL = "/api/assembly-unbuild";
const PERMISSION_KEY = "assembly_unbuild";

function todayLocal() {
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");

    return `${year}-${month}-${day}`;
}

function getRows(payload, keys = []) {
    if (Array.isArray(payload)) return payload;

    for (const key of keys) {
        if (Array.isArray(payload?.[key])) return payload[key];
    }

    if (Array.isArray(payload?.data)) return payload.data;

    if (Array.isArray(payload?.data?.rows)) {
        return payload.data.rows;
    }

    return [];
}

function getId(row, ...keys) {
    for (const key of keys) {
        if (row?.[key] !== undefined && row?.[key] !== null) {
            return row[key];
        }
    }

    return "";
}

function getName(row, ...keys) {
    for (const key of keys) {
        if (row?.[key]) return row[key];
    }

    return "";
}

function numberValue(value, fallback = 0) {
    const number = Number(value);
    return Number.isFinite(number) ? number : fallback;
}

function formatQuantity(value) {
    return numberValue(value).toLocaleString(undefined, {
        maximumFractionDigits: 6,
    });
}

function calculateRequiredQuantity(component, unbuildQuantity) {
    const bomQuantity = numberValue(
        component.bomQuantity ?? component.bom_quantity
    );

    const quantityType = String(
        component.quantityType ??
        component.quantity_type ??
        "QUANTITY"
    ).toUpperCase();

    if (quantityType === "PERCENTAGE") {
        return (bomQuantity / 100) * unbuildQuantity;
    }

    return bomQuantity * unbuildQuantity;
}

function getPermission(payload) {
    if (payload?.permission) return payload.permission;

    if (payload?.data && !Array.isArray(payload.data)) {
        return payload.data;
    }

    if (Array.isArray(payload?.permissions)) {
        return payload.permissions.find(
            (item) =>
                item.permission_key === PERMISSION_KEY ||
                item.permissionKey === PERMISSION_KEY
        );
    }

    return payload;
}

export default function NewAssemblyUnbuildPage() {
    const router = useRouter();

    const [permissionLoading, setPermissionLoading] = useState(true);
    const [canCreate, setCanCreate] = useState(false);

    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [loadingBom, setLoadingBom] = useState(false);

    const [warehouses, setWarehouses] = useState([]);
    const [boms, setBoms] = useState([]);

    const [selectedBom, setSelectedBom] = useState(null);
    const [revisions, setRevisions] = useState([]);
    const [components, setComponents] = useState([]);

    const [error, setError] = useState("");
    const [success, setSuccess] = useState("");

    const [form, setForm] = useState({
        transactionDate: todayLocal(),
        warehouseId: "",
        bomId: "",
        revisionId: "",
        unbuildQuantity: "1",
        memo: "",
        details: "",
    });

    const loadInitialData = useCallback(async () => {
        setLoading(true);
        setError("");

        try {
            const [warehouseResponse, bomResponse] = await Promise.all([
                fetch("/api/warehouses", {
                    cache: "no-store",
                }),
                fetch("/api/bill-of-materials", {
                    cache: "no-store",
                }),
            ]);

            const warehousePayload = await warehouseResponse.json();
            const bomPayload = await bomResponse.json();

            if (!warehouseResponse.ok) {
                throw new Error(
                    warehousePayload.message ||
                    "Unable to load warehouses."
                );
            }

            if (!bomResponse.ok) {
                throw new Error(
                    bomPayload.message ||
                    "Unable to load Bills of Materials."
                );
            }

            const warehouseRows = getRows(
                warehousePayload,
                ["warehouses", "data"]
            );

            const bomRows = getRows(
                bomPayload,
                ["boms", "billOfMaterials", "items", "data"]
            );

            setWarehouses(warehouseRows);
            setBoms(bomRows);
        } catch (err) {
            console.error("ASSEMBLY UNBUILD INITIAL LOAD ERROR:", err);
            setError(
                err.message ||
                "Unable to load the required form data."
            );
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        let mounted = true;

        async function initialize() {
            setPermissionLoading(true);

            try {
                const response = await fetch(
                    `/api/permissions/current?permissionKey=${PERMISSION_KEY}`,
                    { cache: "no-store" }
                );

                const payload = await response.json();

                if (!response.ok) {
                    throw new Error(
                        payload.message ||
                        "Unable to verify user permissions."
                    );
                }

                const permission = getPermission(payload);

                const allowed = Boolean(
                    permission?.can_create ??
                    permission?.canCreate ??
                    false
                );

                if (!mounted) return;

                setCanCreate(allowed);

                if (allowed) {
                    await loadInitialData();
                } else {
                    setLoading(false);
                }
            } catch (err) {
                if (!mounted) return;

                setCanCreate(false);
                setError(err.message || "Permission check failed.");
                setLoading(false);
            } finally {
                if (mounted) setPermissionLoading(false);
            }
        }

        initialize();

        return () => {
            mounted = false;
        };
    }, [loadInitialData]);

    const updateForm = (field, value) => {
        setForm((previous) => ({
            ...previous,
            [field]: value,
        }));
    };

    const loadBomDetails = useCallback(
        async (bomId, warehouseId) => {
            if (!bomId) {
                setSelectedBom(null);
                setRevisions([]);
                setComponents([]);
                updateForm("revisionId", "");
                return;
            }

            setLoadingBom(true);
            setError("");
            setSuccess("");

            try {
                const query = warehouseId
                    ? `?warehouseId=${encodeURIComponent(warehouseId)}`
                    : "";

                const response = await fetch(
                    `${API_URL}/bom/${encodeURIComponent(bomId)}${query}`,
                    {
                        cache: "no-store",
                    }
                );

                const payload = await response.json();

                if (!response.ok) {
                    throw new Error(
                        payload.message ||
                        "Unable to load BOM details."
                    );
                }

                const bom = payload.bom || payload.data?.bom || payload.data;

                if (!bom) {
                    throw new Error("BOM details were not returned.");
                }

                const revisionRows = Array.isArray(bom.revisions)
                    ? bom.revisions
                    : [];

                setSelectedBom(bom);
                setRevisions(revisionRows);

                const activeRevision =
                    revisionRows.find(
                        (revision) =>
                            revision.isActive === true ||
                            revision.is_active === true
                    ) || revisionRows[0];

                if (!activeRevision) {
                    setComponents([]);
                    updateForm("revisionId", "");
                    throw new Error(
                        "No active BOM revision is available for this BOM."
                    );
                }

                const revisionId = getId(
                    activeRevision,
                    "revisionId",
                    "revision_id",
                    "id"
                );

                updateForm("revisionId", String(revisionId));

                setComponents(
                    Array.isArray(activeRevision.components)
                        ? activeRevision.components
                        : []
                );
            } catch (err) {
                console.error("ASSEMBLY UNBUILD BOM ERROR:", err);
                setSelectedBom(null);
                setRevisions([]);
                setComponents([]);
                updateForm("revisionId", "");
                setError(
                    err.message || "Unable to load BOM components."
                );
            } finally {
                setLoadingBom(false);
            }
        },
        []
    );

    const handleWarehouseChange = async (warehouseId) => {
        setForm((previous) => ({
            ...previous,
            warehouseId,
            revisionId: "",
        }));

        if (form.bomId) {
            await loadBomDetails(form.bomId, warehouseId);
        }
    };

    const handleBomChange = async (bomId) => {
        setForm((previous) => ({
            ...previous,
            bomId,
            revisionId: "",
        }));

        setSelectedBom(null);
        setRevisions([]);
        setComponents([]);

        if (bomId) {
            await loadBomDetails(bomId, form.warehouseId);
        }
    };

    const handleRevisionChange = (revisionId) => {
        updateForm("revisionId", revisionId);

        const revision = revisions.find(
            (item) =>
                String(
                    getId(item, "revisionId", "revision_id", "id")
                ) === String(revisionId)
        );

        setComponents(
            Array.isArray(revision?.components)
                ? revision.components
                : []
        );
    };

    const unbuildQuantity = numberValue(form.unbuildQuantity);

    const calculatedComponents = useMemo(() => {
        return components.map((component) => {
            const requiredQuantity = calculateRequiredQuantity(
                component,
                unbuildQuantity
            );

            return {
                ...component,
                calculatedRequiredQuantity: requiredQuantity,
            };
        });
    }, [components, unbuildQuantity]);

    const totalComponentAmount = useMemo(() => {
        return calculatedComponents.reduce((total, component) => {
            const quantity = numberValue(
                component.calculatedRequiredQuantity
            );
            const unitCost = numberValue(
                component.unitCost ?? component.unit_cost
            );

            return total + quantity * unitCost;
        }, 0);
    }, [calculatedComponents]);

    const handleSubmit = async (event) => {
        event.preventDefault();

        setError("");
        setSuccess("");

        if (!form.transactionDate) {
            setError("Please select a transaction date.");
            return;
        }

        if (!form.warehouseId) {
            setError("Please select a warehouse.");
            return;
        }

        if (!form.bomId) {
            setError("Please select a Bill of Materials.");
            return;
        }

        if (!form.revisionId) {
            setError("Please select a BOM revision.");
            return;
        }

        if (!Number.isFinite(unbuildQuantity) || unbuildQuantity <= 0) {
            setError("Unbuild quantity must be greater than zero.");
            return;
        }

        if (calculatedComponents.length === 0) {
            setError("The selected BOM revision has no components.");
            return;
        }

        setSaving(true);

        try {
            const payload = {
                transactionDate: form.transactionDate,
                warehouseId: Number(form.warehouseId),
                bomId: Number(form.bomId),
                revisionId: Number(form.revisionId),
                unbuildQuantity,
                memo: form.memo.trim(),
                details: form.details.trim(),
            };

            const response = await fetch(API_URL, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify(payload),
            });

            const result = await response.json();

            if (!response.ok) {
                throw new Error(
                    result.message ||
                    "Unable to save Assembly Unbuild."
                );
            }

            const savedRecord =
                result.data ||
                result.unbuild ||
                result.record ||
                {};

            const savedId =
                savedRecord.assembly_unbuild_id ||
                savedRecord.assemblyUnbuildId ||
                savedRecord.id;

            setSuccess(
                result.message ||
                "Assembly Unbuild draft created successfully."
            );

            if (savedId) {
                router.push(`/dashboard/assembly-unbuild/${savedId}`);
            } else {
                router.push("/dashboard/assembly-unbuild");
            }

            router.refresh();
        } catch (err) {
            console.error("ASSEMBLY UNBUILD SAVE ERROR:", err);
            setError(
                err.message || "Failed to save Assembly Unbuild."
            );
        } finally {
            setSaving(false);
        }
    };

    if (permissionLoading || loading) {
        return (
            <div className="flex min-h-[60vh] items-center justify-center">
                <div className="flex items-center gap-3 text-gray-600">
                    <RefreshCw className="h-5 w-5 animate-spin" />
                    <span className="text-sm font-medium">
                        Loading Assembly Unbuild form...
                    </span>
                </div>
            </div>
        );
    }

    if (!canCreate) {
        return (
            <div className="mx-auto mt-10 max-w-xl rounded-xl border border-red-200 bg-red-50 p-8 text-center">
                <AlertCircle className="mx-auto mb-3 h-10 w-10 text-red-600" />
                <h2 className="text-lg font-bold text-red-800">
                    Access Denied
                </h2>
                <p className="mt-2 text-sm text-red-700">
                    You do not have permission to create Assembly Unbuild
                    transactions.
                </p>
                <Link
                    href="/dashboard/assembly-unbuild"
                    className="mt-5 inline-flex items-center gap-2 rounded-lg border border-red-300 px-4 py-2 text-sm font-semibold text-red-700 hover:bg-red-100"
                >
                    <ArrowLeft className="h-4 w-4" />
                    Back to Assembly Unbuild
                </Link>
            </div>
        );
    }

    return (
        <div className="space-y-6 p-4 md:p-6">
            {/* HEADER */}
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <Link
                        href="/dashboard/assembly-unbuild"
                        className="mb-3 inline-flex items-center gap-2 text-sm font-medium text-gray-500 hover:text-orange-700"
                    >
                        <ArrowLeft className="h-4 w-4" />
                        Back to Assembly Unbuild
                    </Link>

                    <div className="flex items-center gap-3">
                        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-orange-100">
                            <Factory className="h-6 w-6 text-orange-700" />
                        </div>

                        <div>
                            <h1 className="text-2xl font-bold text-gray-900">
                                New Assembly Unbuild
                            </h1>
                            <p className="mt-1 text-sm text-gray-500">
                                Create a draft to return BOM components to inventory.
                            </p>
                        </div>
                    </div>
                </div>

                <div className="inline-flex w-fit items-center gap-2 rounded-full border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-700">
                    <ClipboardList className="h-4 w-4" />
                    DRAFT
                </div>
            </div>

            {/* MESSAGES */}
            {error && (
                <div className="flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
                    <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
                    <span>{error}</span>
                </div>
            )}

            {success && (
                <div className="flex items-start gap-3 rounded-lg border border-green-200 bg-green-50 p-4 text-sm text-green-700">
                    <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" />
                    <span>{success}</span>
                </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-6">
                {/* TRANSACTION DETAILS */}
                <section className="rounded-xl border border-gray-200 bg-white shadow-sm">
                    <div className="flex items-center gap-3 border-b border-gray-200 px-5 py-4">
                        <CalendarDays className="h-5 w-5 text-orange-600" />
                        <div>
                            <h2 className="font-semibold text-gray-900">
                                Transaction Details
                            </h2>
                            <p className="text-xs text-gray-500">
                                Select the date, warehouse, and BOM.
                            </p>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 gap-5 p-5 md:grid-cols-2 lg:grid-cols-3">
                        <div>
                            <label className="mb-1.5 block text-sm font-medium text-gray-700">
                                Transaction Date <span className="text-red-500">*</span>
                            </label>
                            <input
                                type="date"
                                value={form.transactionDate}
                                onChange={(event) =>
                                    updateForm(
                                        "transactionDate",
                                        event.target.value
                                    )
                                }
                                required
                                className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-100"
                            />
                        </div>

                        <div>
                            <label className="mb-1.5 block text-sm font-medium text-gray-700">
                                Warehouse <span className="text-red-500">*</span>
                            </label>
                            <select
                                value={form.warehouseId}
                                onChange={(event) =>
                                    handleWarehouseChange(event.target.value)
                                }
                                required
                                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-100"
                            >
                                <option value="">Select Warehouse</option>
                                {warehouses.map((warehouse) => {
                                    const id = getId(
                                        warehouse,
                                        "warehouse_id",
                                        "warehouseId",
                                        "id"
                                    );

                                    const name = getName(
                                        warehouse,
                                        "warehouse_name",
                                        "warehouseName",
                                        "name"
                                    );

                                    return (
                                        <option key={id} value={id}>
                                            {name || `Warehouse ${id}`}
                                        </option>
                                    );
                                })}
                            </select>
                        </div>

                        <div>
                            <label className="mb-1.5 block text-sm font-medium text-gray-700">
                                Bill of Materials <span className="text-red-500">*</span>
                            </label>
                            <select
                                value={form.bomId}
                                onChange={(event) =>
                                    handleBomChange(event.target.value)
                                }
                                required
                                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-100"
                            >
                                <option value="">Select BOM</option>
                                {boms.map((bom) => {
                                    const id = getId(
                                        bom,
                                        "bom_id",
                                        "bomId",
                                        "id"
                                    );

                                    const name = getName(
                                        bom,
                                        "bom_name",
                                        "bomName",
                                        "name",
                                        "assembly_name"
                                    );

                                    return (
                                        <option key={id} value={id}>
                                            {name || `BOM ${id}`}
                                        </option>
                                    );
                                })}
                            </select>
                        </div>

                        <div>
                            <label className="mb-1.5 block text-sm font-medium text-gray-700">
                                BOM Revision <span className="text-red-500">*</span>
                            </label>
                            <select
                                value={form.revisionId}
                                onChange={(event) =>
                                    handleRevisionChange(event.target.value)
                                }
                                disabled={!revisions.length || loadingBom}
                                required
                                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-100 disabled:cursor-not-allowed disabled:bg-gray-100"
                            >
                                <option value="">
                                    {loadingBom
                                        ? "Loading revisions..."
                                        : "Select Revision"}
                                </option>

                                {revisions.map((revision) => {
                                    const id = getId(
                                        revision,
                                        "revisionId",
                                        "revision_id",
                                        "id"
                                    );

                                    const name = getName(
                                        revision,
                                        "revisionName",
                                        "revision_name",
                                        "revision_number",
                                        "name"
                                    );

                                    return (
                                        <option key={id} value={id}>
                                            {name || `Revision ${id}`}
                                            {revision.isActive ||
                                            revision.is_active
                                                ? " (Active)"
                                                : ""}
                                        </option>
                                    );
                                })}
                            </select>
                        </div>

                        <div>
                            <label className="mb-1.5 block text-sm font-medium text-gray-700">
                                Unbuild Quantity <span className="text-red-500">*</span>
                            </label>
                            <input
                                type="number"
                                min="1"
                                step="any"
                                value={form.unbuildQuantity}
                                onChange={(event) =>
                                    updateForm(
                                        "unbuildQuantity",
                                        event.target.value
                                    )
                                }
                                required
                                className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-100"
                            />
                        </div>
                    </div>
                </section>

                {/* SELECTED ASSEMBLY */}
                {selectedBom && (
                    <section className="rounded-xl border border-gray-200 bg-white shadow-sm">
                        <div className="flex items-center gap-3 border-b border-gray-200 px-5 py-4">
                            <Package className="h-5 w-5 text-orange-600" />
                            <div>
                                <h2 className="font-semibold text-gray-900">
                                    Finished Assembly
                                </h2>
                                <p className="text-xs text-gray-500">
                                    Assembly selected from the chosen BOM.
                                </p>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 gap-4 p-5 sm:grid-cols-2 lg:grid-cols-4">
                            <div>
                                <p className="text-xs font-medium uppercase text-gray-500">
                                    Assembly
                                </p>
                                <p className="mt-1 font-semibold text-gray-900">
                                    {selectedBom.assemblyName ||
                                        selectedBom.assembly_name ||
                                        "—"}
                                </p>
                            </div>

                            <div>
                                <p className="text-xs font-medium uppercase text-gray-500">
                                    SKU
                                </p>
                                <p className="mt-1 font-semibold text-gray-900">
                                    {selectedBom.assemblySku ||
                                        selectedBom.assembly_sku ||
                                        "—"}
                                </p>
                            </div>

                            <div>
                                <p className="text-xs font-medium uppercase text-gray-500">
                                    Unit
                                </p>
                                <p className="mt-1 font-semibold text-gray-900">
                                    {selectedBom.assemblyUom ||
                                        selectedBom.assembly_uom ||
                                        "—"}
                                </p>
                            </div>

                            <div>
                                <p className="text-xs font-medium uppercase text-gray-500">
                                    Quantity to Unbuild
                                </p>
                                <p className="mt-1 font-semibold text-orange-700">
                                    {formatQuantity(unbuildQuantity)}
                                </p>
                            </div>
                        </div>
                    </section>
                )}

                {/* COMPONENTS */}
                <section className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
                    <div className="flex flex-col gap-2 border-b border-gray-200 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                        <div className="flex items-center gap-3">
                            <Layers className="h-5 w-5 text-orange-600" />
                            <div>
                                <h2 className="font-semibold text-gray-900">
                                    BOM Components to Return
                                </h2>
                                <p className="text-xs text-gray-500">
                                    Quantities are calculated from the selected BOM revision.
                                </p>
                            </div>
                        </div>

                        <span className="rounded-full bg-orange-50 px-3 py-1 text-xs font-semibold text-orange-700">
                            {calculatedComponents.length} Components
                        </span>
                    </div>

                    {loadingBom ? (
                        <div className="flex items-center justify-center gap-2 p-10 text-sm text-gray-500">
                            <RefreshCw className="h-4 w-4 animate-spin" />
                            Loading BOM components...
                        </div>
                    ) : calculatedComponents.length === 0 ? (
                        <div className="p-10 text-center">
                            <Package className="mx-auto mb-3 h-9 w-9 text-gray-300" />
                            <p className="font-medium text-gray-700">
                                No components loaded
                            </p>
                            <p className="mt-1 text-sm text-gray-500">
                                Select a warehouse and BOM to load its active revision components.
                            </p>
                        </div>
                    ) : (
                        <>
                            <div className="overflow-x-auto">
                                <table className="w-full min-w-[850px] text-left text-sm">
                                    <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
                                        <tr>
                                            <th className="px-5 py-3 font-semibold">
                                                Component
                                            </th>
                                            <th className="px-5 py-3 font-semibold">
                                                SKU
                                            </th>
                                            <th className="px-5 py-3 font-semibold">
                                                UOM
                                            </th>
                                            <th className="px-5 py-3 text-right font-semibold">
                                                BOM Qty
                                            </th>
                                            <th className="px-5 py-3 text-right font-semibold">
                                                Current Balance
                                            </th>
                                            <th className="px-5 py-3 text-right font-semibold">
                                                Return Qty
                                            </th>
                                        </tr>
                                    </thead>

                                    <tbody className="divide-y divide-gray-100">
                                        {calculatedComponents.map(
                                            (component, index) => {
                                                const componentId = getId(
                                                    component,
                                                    "componentId",
                                                    "component_id",
                                                    "id"
                                                );

                                                const productId = getId(
                                                    component,
                                                    "productId",
                                                    "product_id"
                                                );

                                                const subProductId = getId(
                                                    component,
                                                    "subProductId",
                                                    "sub_product_id"
                                                );

                                                const name = getName(
                                                    component,
                                                    "itemDescription",
                                                    "item_description",
                                                    "description",
                                                    "productName",
                                                    "product_name",
                                                    "subProductName",
                                                    "sub_product_name",
                                                    "name"
                                                );

                                                const sku = getName(
                                                    component,
                                                    "sku",
                                                    "productSku",
                                                    "product_sku"
                                                );

                                                const uom = getName(
                                                    component,
                                                    "uom",
                                                    "unit"
                                                );

                                                const bomQuantity = numberValue(
                                                    component.bomQuantity ??
                                                    component.bom_quantity
                                                );

                                                const balance = numberValue(
                                                    component.itemBalance ??
                                                    component.item_balance
                                                );

                                                return (
                                                    <tr
                                                        key={
                                                            componentId ||
                                                            `${productId}-${subProductId}-${index}`
                                                        }
                                                        className="hover:bg-gray-50"
                                                    >
                                                        <td className="px-5 py-4">
                                                            <div className="font-medium text-gray-900">
                                                                {name || "Unnamed Component"}
                                                            </div>
                                                            <div className="mt-1 text-xs text-gray-400">
                                                                {subProductId
                                                                    ? `Sub-product #${subProductId}`
                                                                    : `Product #${productId}`}
                                                            </div>
                                                        </td>

                                                        <td className="px-5 py-4 text-gray-600">
                                                            {sku || "—"}
                                                        </td>

                                                        <td className="px-5 py-4 text-gray-600">
                                                            {uom || "—"}
                                                        </td>

                                                        <td className="px-5 py-4 text-right tabular-nums text-gray-700">
                                                            {formatQuantity(bomQuantity)}
                                                            {String(
                                                                component.quantityType ??
                                                                component.quantity_type ??
                                                                ""
                                                            ).toUpperCase() === "PERCENTAGE" && (
                                                                <span className="ml-1 text-xs text-gray-400">
                                                                    %
                                                                </span>
                                                            )}
                                                        </td>

                                                        <td className="px-5 py-4 text-right tabular-nums text-gray-700">
                                                            {formatQuantity(balance)}
                                                        </td>

                                                        <td className="px-5 py-4 text-right font-semibold tabular-nums text-green-700">
                                                            +{formatQuantity(
                                                                component.calculatedRequiredQuantity
                                                            )}
                                                        </td>
                                                    </tr>
                                                );
                                            }
                                        )}
                                    </tbody>
                                </table>
                            </div>

                            <div className="flex flex-col gap-2 border-t border-gray-200 bg-gray-50 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                                <div className="flex items-center gap-2 text-sm text-gray-600">
                                    <Calculator className="h-4 w-4" />
                                    Component return quantities are based on the saved revision.
                                </div>

                                <div className="text-sm font-semibold text-gray-800">
                                    Estimated Component Amount:{" "}
                                    <span className="text-orange-700">
                                        {totalComponentAmount.toLocaleString(
                                            undefined,
                                            {
                                                minimumFractionDigits: 2,
                                                maximumFractionDigits: 2,
                                            }
                                        )}
                                    </span>
                                </div>
                            </div>
                        </>
                    )}
                </section>

                {/* MEMO AND DETAILS */}
                <section className="rounded-xl border border-gray-200 bg-white shadow-sm">
                    <div className="flex items-center gap-3 border-b border-gray-200 px-5 py-4">
                        <ClipboardList className="h-5 w-5 text-orange-600" />
                        <div>
                            <h2 className="font-semibold text-gray-900">
                                Additional Information
                            </h2>
                            <p className="text-xs text-gray-500">
                                Optional transaction notes.
                            </p>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 gap-5 p-5 md:grid-cols-2">
                        <div>
                            <label className="mb-1.5 block text-sm font-medium text-gray-700">
                                Memo
                            </label>
                            <input
                                type="text"
                                value={form.memo}
                                onChange={(event) =>
                                    updateForm("memo", event.target.value)
                                }
                                maxLength={500}
                                placeholder="Enter transaction memo"
                                className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-100"
                            />
                        </div>

                        <div>
                            <label className="mb-1.5 block text-sm font-medium text-gray-700">
                                Details
                            </label>
                            <textarea
                                value={form.details}
                                onChange={(event) =>
                                    updateForm("details", event.target.value)
                                }
                                rows={3}
                                placeholder="Additional details..."
                                className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-100"
                            />
                        </div>
                    </div>
                </section>

                {/* ACTIONS */}
                <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                    <Link
                        href="/dashboard/assembly-unbuild"
                        className="inline-flex items-center justify-center gap-2 rounded-lg border border-gray-300 bg-white px-5 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50"
                    >
                        <ArrowLeft className="h-4 w-4" />
                        Cancel
                    </Link>

                    <button
                        type="submit"
                        disabled={
                            saving ||
                            loadingBom ||
                            !form.bomId ||
                            !form.revisionId ||
                            calculatedComponents.length === 0
                        }
                        className="inline-flex items-center justify-center gap-2 rounded-lg bg-orange-600 px-6 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-orange-700 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                        {saving ? (
                            <>
                                <RefreshCw className="h-4 w-4 animate-spin" />
                                Saving...
                            </>
                        ) : (
                            <>
                                <Save className="h-4 w-4" />
                                Save Draft
                            </>
                        )}
                    </button>
                </div>
            </form>

            {/* INVENTORY NOTE */}
            <div className="rounded-lg border border-blue-100 bg-blue-50 p-4">
                <div className="flex items-start gap-3">
                    <Warehouse className="mt-0.5 h-5 w-5 shrink-0 text-blue-700" />
                    <div>
                        <p className="text-sm font-semibold text-blue-900">
                            Draft does not affect inventory
                        </p>
                        <p className="mt-1 text-xs leading-5 text-blue-800">
                            Saving this form stores the selected BOM revision and
                            component quantities. Inventory is updated only when
                            an authorized user approves the Assembly Unbuild.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}
