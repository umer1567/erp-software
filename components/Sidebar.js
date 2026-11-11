
"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import {
  LayoutDashboard,
  Users,
  Settings,
  UserCog,
  LogOut,
  Package,
  Warehouse,
  UserRound,
  FileText,
  CreditCard,
  Truck,
  ShoppingCart,
  Receipt,
  BookOpen,
  Scale,
  Landmark,
  BarChart3,
  TrendingUp,
  BookOpenCheck,
  ChevronDown,
  ChevronRight,
  Menu,
  X,
  PanelsTopLeft,
  PanelLeft,
  ShieldAlert,
  RefreshCw,
} from "lucide-react";

import { erpModules } from "@/lib/erp-modules";

const STORAGE_KEY = "erp-sidebar-mode";
const PERMISSIONS_URL = "/api/permissions/current";

const ROUTE_PERMISSION_KEYS = {
  // Administration
  "/dashboard/users": "users",
  "/dashboard/roles": "roles",
  "/dashboard/user-rights": "user_rights",

  // Settings
  "/dashboard/settings": "settings",
  "/dashboard/register-company": "settings",
  "/dashboard/help-support": "settings",

  // Inventory
  "/dashboard/products": "products",
  "/dashboard/product-categories": "product_categories",
  "/dashboard/units-of-measure": "units_of_measure",
  "/dashboard/warehouses": "warehouse",
  "/dashboard/stock": "warehouse",
  "/dashboard/stock-adjustment": "warehouse",
  "/dashboard/items-ledger": "warehouse",
  "/dashboard/reports/stock": "warehouse",

  // Customers
  "/dashboard/customers": "customers",
  "/dashboard/customer-balance": "customers",
  "/dashboard/customer-ledger": "customers",

  // Sales
  "/dashboard/pos": "sales",
  "/dashboard/sales-invoices": "sales",
  "/dashboard/sales-payments": "sales_payment",
  "/dashboard/sales-quotations": "sales_quotations",
  "/dashboard/sales-orders": "sales_orders",

  // Pending Sales
  "/dashboard/delivery-challans/pending": "pending_delivery_challans",

  // General Delivery Challans
  "/dashboard/delivery-challans": "delivery_challans",

  // Sales Reports
  "/dashboard/reports/sales": "sales_dashboard",

  // Payment Report has its own independent permission.
  "/dashboard/reports/payments": "payment_report",

  // =====================================================
  // PURCHASE & PROCUREMENT PERMISSIONS
  // =====================================================

  // Vendors
  "/dashboard/suppliers": "vendors",
  "/dashboard/supplier-balance": "supplier_balance",
  "/dashboard/supplier-ledger": "vendors_ledger",

  // Purchase Requisition
  "/dashboard/purchase-requisitions": "purchase_requisitions",

  // Procurement
  "/dashboard/requisitions-for-procurement": "requisitions_for_procurement",
  "/dashboard/rfqs": "rfqs",
  "/dashboard/purchase-quotations": "purchase_quotations",

  // Purchase Orders
  "/dashboard/purchase-orders": "purchase_orders",

  // Item Receipts
  "/dashboard/item-receipts/pending": "pending_item_receipts",
  "/dashboard/item-receipts": "item_receipts",

  // Purchase Invoices
  "/dashboard/purchase-invoices": "purchase_invoices",

  // Supplier Payments
  "/dashboard/purchase-payments": "purchase_payment",

  // Purchase Reports
  "/dashboard/reports/purchases": "purchase_dashboard",

  // Accounting
  "/dashboard/chart-of-accounts": "chart_of_accounts",
  "/dashboard/journal-entries": "journal_entries",


  "/dashboard/make-payment": "make_payment",
  "/dashboard/make-receipt": "make_receipt",

  "/dashboard/accounting/ledger": "financial_ledger",
  "/dashboard/cash-bank": "cash_bank",
  "/dashboard/receivable": "receivable",
  "/dashboard/payable": "payable",
  "/dashboard/reports/profit-loss": "profit_loss",
  "/dashboard/reports/balance-sheet": "balance_sheet",
};

const PERMISSION_KEY_ALIASES = {



  "/dashboard/reports/stock": ["stock_report", "stock"],
  "/dashboard/reports/sales": ["sales_report"],
  "/dashboard/reports/purchases": [
    "purchase_report",
    "purchase_dashboard",
  ],
};

const moduleIcons = {
  administration: Users,
  inventory: Package,
  sales: ShoppingCart,
  "purchase-procurement": Truck,
  accounting: Landmark,
  reports: BarChart3,
};

const sectionIcons = {
  "user-management": UserCog,
  settings: Settings,
  "item-management": Package,
  "warehouse-stock": Warehouse,
  "customer-management": UserRound,
  "sales-processing": Receipt,
  "sales-reports": TrendingUp,

  vendors: Truck,
  "purchase-requisition": FileText,
  procurement: FileText,
  "purchase-orders": ShoppingCart,
  "item-receipts": Package,
  "purchase-invoices": Receipt,
  "supplier-payments": CreditCard,
  "purchase-reports": BarChart3,
  "payable-reports": BookOpenCheck,

  accounts: BookOpen,
  "financial-reports": Scale,
  "business-reports": BarChart3,
};

function isItemActive(item, pathname) {
  return (
    pathname === item.href ||
    pathname.startsWith(`${item.href}/`)
  );
}

function isSectionActive(section, pathname) {
  return section.items.some((item) =>
    isItemActive(item, pathname)
  );
}

function isModuleActive(module, pathname) {
  return module.sections.some((section) =>
    isSectionActive(section, pathname)
  );
}

function normalizePermissionKey(value) {
  return String(value || "").trim().toLowerCase();
}

function toBoolean(value) {
  return (
    value === true ||
    value === 1 ||
    value === "1" ||
    String(value).toLowerCase() === "true"
  );
}

function getPermissionKeysForItem(item) {
  const explicitKeys = ROUTE_PERMISSION_KEYS[item.href];

  if (explicitKeys) {
    return [
      explicitKeys,
      ...(PERMISSION_KEY_ALIASES[item.href] || []),
    ].map(normalizePermissionKey);
  }

  const routeName = item.href
    .replace(/^\/dashboard\/?/, "")
    .replace(/\/+/g, "_")
    .replace(/-/g, "_")
    .replace(/^_+|_+$/g, "");

  return [normalizePermissionKey(routeName)];
}

function canViewItem(item, permissions) {
  const keys = getPermissionKeysForItem(item);

  return keys.some((key) => permissions.get(key) === true);
}

function filterModulesByPermission(modules, permissions) {
  return modules
    .map((module) => {
      const sections = module.sections
        .map((section) => ({
          ...section,
          items: section.items.filter((item) =>
            canViewItem(item, permissions)
          ),
        }))
        .filter((section) => section.items.length > 0);

      return {
        ...module,
        sections,
      };
    })
    .filter((module) => module.sections.length > 0);
}

function ModeSelector({
  mode,
  onModeChange,
  horizontal = false,
}) {
  return (
    <div
      className={`flex w-fit shrink-0 items-center gap-0.5 rounded-lg border border-slate-700 bg-slate-900 p-0.5 ${horizontal ? "" : "mx-3 mb-1"
        }`}
    >
      <button
        type="button"
        onClick={() => onModeChange("vertical")}
        aria-label="Vertical navigation"
        title="Vertical navigation"
        aria-pressed={mode === "vertical"}
        className={`flex items-center justify-center rounded-md p-1.5 transition-colors ${mode === "vertical"
            ? "bg-blue-600 text-white"
            : "text-slate-400 hover:bg-slate-800 hover:text-white"
          }`}
      >
        <PanelLeft size={14} />
      </button>

      <button
        type="button"
        onClick={() => onModeChange("horizontal")}
        aria-label="Horizontal navigation"
        title="Horizontal navigation"
        aria-pressed={mode === "horizontal"}
        className={`flex items-center justify-center rounded-md p-1.5 transition-colors ${mode === "horizontal"
            ? "bg-blue-600 text-white"
            : "text-slate-400 hover:bg-slate-800 hover:text-white"
          }`}
      >
        <PanelsTopLeft size={14} />
      </button>
    </div>
  );
}

export default function Sidebar({
  mode = "vertical",
  onModeChange,
}) {
  const [savedMode, setSavedMode] = useState(null);

  return (
    <SidebarContent
      mode={mode}
      onModeChange={onModeChange}
      savedMode={savedMode}
      setSavedMode={setSavedMode}
    />
  );
}

function SidebarContent({
  mode,
  onModeChange,
  savedMode,
  setSavedMode,
}) {
  const pathname = usePathname();

  const [permissions, setPermissions] = useState(new Map());
  const [permissionsLoading, setPermissionsLoading] = useState(true);
  const [permissionsError, setPermissionsError] = useState(false);

  const [openModule, setOpenModule] = useState(undefined);
  const [openSection, setOpenSection] = useState(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [compactSidebar, setCompactSidebar] = useState(false);

  const hoverCloseTimer = useRef(null);
  const permissionControllerRef = useRef(null);

  const layoutMode = savedMode ?? mode;
  const isHorizontal = layoutMode === "horizontal";

  const loadPermissions = useCallback(async () => {
    permissionControllerRef.current?.abort();

    const controller = new AbortController();
    permissionControllerRef.current = controller;

    try {
      const response = await fetch(PERMISSIONS_URL, {
        method: "GET",
        credentials: "same-origin",
        cache: "no-store",
        signal: controller.signal,
        headers: {
          Accept: "application/json",
        },
      });

      if (!response.ok) {
        throw new Error(
          `Permission request failed (${response.status})`
        );
      }

      const data = await response.json();

      if (!Array.isArray(data.permissions)) {
        throw new Error(
          "Invalid permissions response: expected permissions array"
        );
      }

      const nextPermissions = new Map();

      for (const permission of data.permissions) {
        const key = normalizePermissionKey(
          permission.permission_key
        );

        if (!key) continue;

        nextPermissions.set(
          key,
          toBoolean(permission.can_view)
        );
      }

      if (controller.signal.aborted) return;

      setPermissions(nextPermissions);
      setPermissionsError(false);
      setPermissionsLoading(false);
    } catch (error) {
      if (
        error.name === "AbortError" ||
        controller.signal.aborted
      ) {
        return;
      }

      console.error(
        "Could not load sidebar permissions:",
        error
      );

      setPermissions(new Map());
      setPermissionsError(true);
      setPermissionsLoading(false);
    }
  }, []);

  // Load permissions on initial mount.
  useEffect(() => {
    const timer = setTimeout(() => {
      void loadPermissions();
    }, 0);

    return () => {
      clearTimeout(timer);
      permissionControllerRef.current?.abort();
    };
  }, [loadPermissions]);

  // Refresh permissions after User Rights changes.
  useEffect(() => {
    function handlePermissionsUpdated() {
      void loadPermissions();
    }

    window.addEventListener(
      "erp-permissions-updated",
      handlePermissionsUpdated
    );

    return () => {
      window.removeEventListener(
        "erp-permissions-updated",
        handlePermissionsUpdated
      );
    };
  }, [loadPermissions]);

  // Refresh when the browser tab becomes active again.
  useEffect(() => {
    function handleVisibilityChange() {
      if (document.visibilityState === "visible") {
        void loadPermissions();
      }
    }

    window.addEventListener("focus", handleVisibilityChange);

    document.addEventListener(
      "visibilitychange",
      handleVisibilityChange
    );

    return () => {
      window.removeEventListener(
        "focus",
        handleVisibilityChange
      );

      document.removeEventListener(
        "visibilitychange",
        handleVisibilityChange
      );
    };
  }, [loadPermissions]);

  const visibleModules = filterModulesByPermission(
    erpModules,
    permissions
  );

  const currentModule = visibleModules.find((module) =>
    isModuleActive(module, pathname)
  );

  const effectiveOpenModule =
    openModule === undefined
      ? currentModule?.id ?? null
      : openModule;

  useEffect(() => {
    function updateSidebarDensity() {
      setCompactSidebar(
        window.innerHeight < 850 || erpModules.length > 5
      );
    }

    updateSidebarDensity();

    window.addEventListener("resize", updateSidebarDensity);

    return () => {
      window.removeEventListener("resize", updateSidebarDensity);
    };
  }, []);

  useEffect(() => {
    try {
      const storedMode =
        window.localStorage.getItem(STORAGE_KEY);

      if (
        storedMode === "vertical" ||
        storedMode === "horizontal"
      ) {
        setSavedMode(storedMode);
        onModeChange?.(storedMode);
      }
    } catch (error) {
      console.error("Could not read sidebar layout:", error);
    }
  }, [onModeChange]);

  useEffect(() => {
    document.cookie =
      `${STORAGE_KEY}=${layoutMode}; path=/; max-age=31536000; samesite=lax`;
  }, [layoutMode]);

  const cancelHoverClose = useCallback(() => {
    if (hoverCloseTimer.current !== null) {
      clearTimeout(hoverCloseTimer.current);
      hoverCloseTimer.current = null;
    }
  }, []);

  const scheduleHoverClose = useCallback(() => {
    cancelHoverClose();

    hoverCloseTimer.current = setTimeout(() => {
      hoverCloseTimer.current = null;
    }, 180);
  }, [cancelHoverClose]);

  const closeHoverCard = useCallback(() => {
    cancelHoverClose();
  }, [cancelHoverClose]);

  useEffect(() => {
    return () => {
      if (hoverCloseTimer.current !== null) {
        clearTimeout(hoverCloseTimer.current);
        hoverCloseTimer.current = null;
      }
    };
  }, []);

  useEffect(() => {
    function handleOutsideClick(event) {
      const target = event.target;

      if (
        target instanceof Element &&
        target.closest("[data-sidebar-root]")
      ) {
        return;
      }

      setOpenModule(null);
      setOpenSection(null);
    }

    function handleEscape(event) {
      if (event.key === "Escape") {
        closeHoverCard();
        setOpenModule(null);
        setOpenSection(null);
        setMobileOpen(false);
      }
    }

    document.addEventListener(
      "pointerdown",
      handleOutsideClick
    );

    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener(
        "pointerdown",
        handleOutsideClick
      );

      document.removeEventListener("keydown", handleEscape);
    };
  }, [closeHoverCard]);

  function changeLayoutMode(nextMode) {
    if (
      nextMode !== "horizontal" &&
      nextMode !== "vertical"
    ) {
      return;
    }

    cancelHoverClose();
    setSavedMode(nextMode);

    try {
      window.localStorage.setItem(STORAGE_KEY, nextMode);
    } catch (error) {
      console.error("Could not save sidebar layout:", error);
    }

    setMobileOpen(false);
    setOpenModule(undefined);
    setOpenSection(null);

    onModeChange?.(nextMode);
  }

  function toggleModule(moduleId) {
    cancelHoverClose();

    const currentlyOpen =
      openModule === undefined
        ? currentModule?.id ?? null
        : openModule;

    setOpenSection(null);

    setOpenModule(
      currentlyOpen === moduleId ? null : moduleId
    );
  }

  function toggleSection(sectionKey) {
    setOpenSection((current) =>
      current === sectionKey ? null : sectionKey
    );
  }

  function closeDropdowns() {
    cancelHoverClose();
    setOpenModule(null);
    setOpenSection(null);
  }

  function handleNavigation() {
    closeDropdowns();
    setMobileOpen(false);
  }

  async function handleLogout() {
    let selectedCompany = null;

    try {
      const savedCompany = localStorage.getItem(
        "erp-selected-company"
      );

      if (savedCompany) {
        selectedCompany = JSON.parse(savedCompany);
      }
    } catch (error) {
      console.error("Could not read selected company:", error);
    }

    try {
      await fetch("/api/auth/logout", {
        method: "POST",
        credentials: "same-origin",
        cache: "no-store",
      });
    } catch (error) {
      console.error("Logout request failed:", error);
    } finally {
      if (selectedCompany?.companyId) {
        const params = new URLSearchParams({
          companyId: String(selectedCompany.companyId),
          companyName:
            selectedCompany.companyName || "Company Login",
        });

        window.location.replace(
          `/login?${params.toString()}`
        );
      } else {
        window.location.replace("/login");
      }
    }
  }

  function renderDashboardLink(compact = false) {
    const active = pathname === "/dashboard";

    return (
      <Link
        href="/dashboard"
        onClick={handleNavigation}
        className={`flex shrink-0 items-center gap-2 rounded-lg px-2 ${compactSidebar ? "py-1.5" : "py-2"
          } text-xs font-medium transition-colors ${active
            ? "bg-blue-600 text-white shadow-sm"
            : "text-slate-300 hover:bg-slate-800 hover:text-white"
          } ${compact ? "whitespace-nowrap" : ""}`}
      >
        <LayoutDashboard size={16} className="shrink-0" />
        <span>Dashboard</span>
      </Link>
    );
  }

  function renderModeButton() {
    return (
      <ModeSelector
        mode={layoutMode}
        onModeChange={changeLayoutMode}
        horizontal={isHorizontal}
      />
    );
  }

  function renderChildLinks(section) {
    return (
      <div
        className={`pb-1 pl-5 ${compactSidebar ? "space-y-0" : "space-y-0.5"
          }`}
      >
        {section.items.map((item) => {
          const active = isItemActive(item, pathname);

          return (
            <Link
              key={`${item.name}:${item.href}`}
              href={item.href}
              onClick={handleNavigation}
              className={`block rounded-md px-2 ${compactSidebar ? "py-1" : "py-1.5"
                } text-xs transition-colors ${active
                  ? "bg-blue-600/20 font-medium text-blue-300"
                  : "text-slate-400 hover:bg-slate-800 hover:text-white"
                }`}
            >
              {item.name}
            </Link>
          );
        })}
      </div>
    );
  }

  function renderHoverCard(module) {
    return (
      <div
        className="max-h-[75dvh] w-80 max-w-[calc(100vw-2rem)] overflow-y-auto overscroll-contain rounded-xl border border-slate-700 bg-slate-900 p-3 text-white shadow-2xl"
        onMouseEnter={cancelHoverClose}
        onMouseLeave={scheduleHoverClose}
      >
        <p className="mb-2 px-2 text-sm font-semibold text-blue-300">
          {module.name}
        </p>

        <div className="space-y-2">
          {module.sections.map((section) => {
            const SectionIcon =
              sectionIcons[section.id] || FileText;

            return (
              <div
                key={section.id}
                className="rounded-lg border border-slate-800 p-2"
              >
                <p className="mb-1 flex items-center gap-2 px-2 py-1 text-sm font-medium text-slate-200">
                  <SectionIcon size={15} />
                  {section.name}
                </p>

                <div className="space-y-1">
                  {section.items.map((item) => (
                    <Link
                      key={`${item.name}:${item.href}`}
                      href={item.href}
                      onClick={handleNavigation}
                      className={`block rounded-md px-3 py-2 text-sm transition-colors ${isItemActive(item, pathname)
                          ? "bg-blue-600/20 text-blue-300"
                          : "text-slate-400 hover:bg-slate-800 hover:text-white"
                        }`}
                    >
                      {item.name}
                    </Link>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  function renderSection(section, moduleId) {
    const SectionIcon =
      sectionIcons[section.id] || FileText;

    const sectionKey = `${moduleId}:${section.id}`;
    const sectionActive = isSectionActive(section, pathname);
    const sectionOpen = openSection === sectionKey;

    return (
      <div key={section.id} className="min-w-0">
        <button
          type="button"
          onClick={() => toggleSection(sectionKey)}
          aria-expanded={Boolean(sectionOpen)}
          className={`flex w-full min-w-0 items-center gap-1.5 rounded-md px-1.5 ${compactSidebar ? "py-1" : "py-1.5"
            } text-left text-xs transition-colors ${sectionActive || sectionOpen
              ? "bg-slate-800 text-blue-300"
              : "text-slate-300 hover:bg-slate-800 hover:text-white"
            }`}
        >
          {sectionOpen ? (
            <ChevronDown size={12} className="shrink-0" />
          ) : (
            <ChevronRight size={12} className="shrink-0" />
          )}

          <SectionIcon size={14} className="shrink-0" />

          <span className="min-w-0 flex-1 whitespace-normal break-words">
            {section.name}
          </span>
        </button>

        {sectionOpen && renderChildLinks(section)}
      </div>
    );
  }

  function renderPermissionStatus() {
    if (permissionsLoading) {
      return (
        <div className="flex items-center gap-2 px-2 py-3 text-xs text-slate-400">
          <RefreshCw size={14} className="animate-spin" />
          Loading permissions...
        </div>
      );
    }

    if (permissionsError) {
      return (
        <div className="mx-1 my-2 rounded-lg border border-amber-700/50 bg-amber-950/30 p-3">
          <div className="flex items-start gap-2 text-amber-300">
            <ShieldAlert size={16} className="mt-0.5 shrink-0" />

            <div className="min-w-0">
              <p className="text-xs font-semibold">
                Permissions unavailable
              </p>

              <p className="mt-1 text-[11px] leading-4 text-amber-200/80">
                Protected navigation is hidden until permissions
                can be loaded.
              </p>

              <button
                type="button"
                onClick={() => void loadPermissions()}
                className="mt-2 inline-flex items-center gap-1 rounded-md bg-amber-900/60 px-2 py-1 text-xs text-amber-100 hover:bg-amber-900"
              >
                <RefreshCw size={12} />
                Retry
              </button>
            </div>
          </div>
        </div>
      );
    }

    return null;
  }

  function renderVerticalModules() {
    return (
      <nav
        data-erp-vertical-nav
        aria-label="ERP navigation"
        className="relative z-0 min-h-0 flex-1 overflow-x-hidden overflow-y-auto overscroll-y-contain px-2 py-1"
      >
        <div className="flex w-full flex-col gap-1">
          <div className="w-full">
            {renderDashboardLink()}
          </div>

          {renderPermissionStatus()}

          <p className="px-2 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-widest text-slate-500">
            Modules
          </p>

          {!permissionsLoading &&
            !permissionsError &&
            visibleModules.length === 0 && (
              <p className="px-2 py-3 text-xs leading-5 text-slate-500">
                No modules are available for your account.
              </p>
            )}

          {visibleModules.map((module) => {
            const ModuleIcon =
              moduleIcons[module.id] || Package;

            const moduleHref =
              `/dashboard/modules/${module.id}`;

            const moduleActive = isModuleActive(
              module,
              pathname
            );

            const isOpen =
              effectiveOpenModule === module.id;

            return (
              <div
                key={module.id}
                data-sidebar-root
                className="w-full min-w-0"
              >
                <div
                  className={`flex w-full min-w-0 items-center rounded-lg transition-colors ${moduleActive || isOpen
                      ? "bg-slate-800 text-white"
                      : "text-slate-300 hover:bg-slate-800 hover:text-white"
                    }`}
                >
                  <button
                    type="button"
                    onClick={() => toggleModule(module.id)}
                    aria-label={`${isOpen ? "Collapse" : "Expand"} ${module.name}`}
                    aria-expanded={Boolean(isOpen)}
                    className="flex shrink-0 items-center justify-center rounded-md p-1.5 hover:bg-slate-700"
                  >
                    {isOpen ? (
                      <ChevronDown size={14} />
                    ) : (
                      <ChevronRight size={14} />
                    )}
                  </button>

                  <Link
                    href={moduleHref}
                    onClick={handleNavigation}
                    className="flex min-w-0 flex-1 items-center gap-2 py-2 pl-1 pr-2 text-xs font-medium"
                  >
                    <ModuleIcon size={16} className="shrink-0" />

                    <span className="min-w-0 flex-1 whitespace-normal break-words">
                      {module.name}
                    </span>
                  </Link>
                </div>

                {isOpen && (
                  <div className="ml-3 mt-1 min-w-0 pl-1.5">
                    <div className="flex flex-col gap-0.5">
                      {module.sections.map((section) =>
                        renderSection(section, module.id)
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </nav>
    );
  }

  function renderHorizontalModules() {
    return (
      <nav
        aria-label="ERP navigation"
        className="flex min-w-0 flex-1 items-stretch gap-1"
      >
        <div className="flex min-w-0 flex-1 items-stretch">
          <Link
            href="/dashboard"
            onClick={handleNavigation}
            title="Dashboard"
            className={`flex min-w-0 flex-1 items-center justify-center gap-1 rounded-lg px-1 py-2 text-xs font-medium transition-colors ${pathname === "/dashboard"
                ? "bg-blue-600 text-white"
                : "text-slate-300 hover:bg-slate-800 hover:text-white"
              }`}
          >
            <LayoutDashboard size={14} className="shrink-0" />
            <span className="truncate">Dashboard</span>
          </Link>
        </div>

        {visibleModules.map((module) => {
          const ModuleIcon =
            moduleIcons[module.id] || Package;

          const moduleHref =
            `/dashboard/modules/${module.id}`;

          const moduleActive = isModuleActive(
            module,
            pathname
          );

          const isOpen =
            effectiveOpenModule === module.id;

          return (
            <div
              key={module.id}
              data-sidebar-root
              className="relative flex min-w-0 flex-1 flex-col"
            >
              <div
                className={`flex min-w-0 items-center rounded-lg transition-colors ${moduleActive || isOpen
                    ? "bg-slate-800 text-white"
                    : "text-slate-300 hover:bg-slate-800 hover:text-white"
                  }`}
              >
                <button
                  type="button"
                  onClick={() => toggleModule(module.id)}
                  aria-label={`${isOpen ? "Collapse" : "Expand"} ${module.name}`}
                  aria-expanded={Boolean(isOpen)}
                  title={`${module.name} menu`}
                  className="flex shrink-0 items-center justify-center rounded-md p-1 hover:bg-slate-700"
                >
                  {isOpen ? (
                    <ChevronDown size={12} />
                  ) : (
                    <ChevronRight size={12} />
                  )}
                </button>

                <Link
                  href={moduleHref}
                  onClick={handleNavigation}
                  title={module.name}
                  className="flex min-w-0 flex-1 items-center justify-center gap-1 px-1 py-2 text-xs font-medium"
                >
                  <ModuleIcon size={14} className="shrink-0" />
                  <span className="truncate">{module.name}</span>
                </Link>
              </div>

              {isOpen && (
                <div className="absolute left-0 top-full z-[100] mt-1 max-h-[70dvh] w-64 overflow-y-auto overscroll-contain rounded-xl border border-slate-700 bg-slate-900 p-2 shadow-2xl">
                  <div className="flex flex-col gap-1">
                    {module.sections.map((section) =>
                      renderSection(section, module.id)
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </nav>
    );
  }

  if (isHorizontal) {
    return (
      <header
        data-sidebar-root
        data-erp-sidebar
        className="relative z-[80] w-full border-b border-slate-800 bg-slate-950 text-white shadow-lg"
      >
        <div className="hidden min-h-12 items-center gap-1.5 px-2 lg:flex">
          <Link
            href="/dashboard"
            onClick={handleNavigation}
            className="flex shrink-0 items-center gap-1.5"
            title="ERP System"
          >
            <div className="flex h-7 w-7 items-center justify-center rounded-md bg-blue-600 text-[10px] font-bold">
              ERP
            </div>

            <span className="whitespace-nowrap text-xs font-bold">
              ERP System
            </span>
          </Link>

          <div className="h-6 w-px shrink-0 bg-slate-700" />

          {renderPermissionStatus()}
          {renderHorizontalModules()}

          <div className="h-6 w-px shrink-0 bg-slate-700" />

          {renderModeButton()}

          <button
            type="button"
            onClick={handleLogout}
            title="Logout"
            className="flex shrink-0 items-center gap-1 rounded-lg px-1.5 py-1.5 text-xs font-medium text-slate-300 transition-colors hover:bg-red-600 hover:text-white"
          >
            <LogOut size={14} />
            <span>Logout</span>
          </button>
        </div>

        <div className="flex min-h-12 items-center justify-between gap-2 px-3 py-1.5 lg:hidden">
          <Link
            href="/dashboard"
            onClick={handleNavigation}
            className="flex min-w-0 items-center gap-2"
          >
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-blue-600 text-[10px] font-bold">
              ERP
            </div>

            <span className="truncate text-sm font-bold">
              ERP System
            </span>
          </Link>

          <div className="flex shrink-0 items-center gap-2">
            {renderModeButton()}

            <button
              type="button"
              onClick={() =>
                setMobileOpen((current) => !current)
              }
              className="rounded-lg border border-slate-700 p-1.5 text-slate-200 transition-colors hover:bg-slate-800"
              aria-label={
                mobileOpen
                  ? "Close navigation"
                  : "Open navigation"
              }
              aria-expanded={mobileOpen}
            >
              {mobileOpen ? <X size={18} /> : <Menu size={18} />}
            </button>
          </div>
        </div>

        {mobileOpen && (
          <div className="border-t border-slate-800 p-2 lg:hidden">
            <div className="max-h-[65dvh] overflow-y-auto overscroll-contain">
              <div className="flex flex-col gap-1">
                {renderDashboardLink()}
                {renderPermissionStatus()}

                {visibleModules.map((module) => {
                  const ModuleIcon =
                    moduleIcons[module.id] || Package;

                  const moduleHref =
                    `/dashboard/modules/${module.id}`;

                  const moduleActive = isModuleActive(
                    module,
                    pathname
                  );

                  const isOpen =
                    effectiveOpenModule === module.id;

                  return (
                    <div
                      key={module.id}
                      data-sidebar-root
                      className="min-w-0"
                    >
                      <div
                        className={`flex items-center rounded-lg ${moduleActive || isOpen
                            ? "bg-slate-800 text-white"
                            : "text-slate-300 hover:bg-slate-800 hover:text-white"
                          }`}
                      >
                        <button
                          type="button"
                          onClick={() => toggleModule(module.id)}
                          aria-label={`${isOpen ? "Collapse" : "Expand"} ${module.name}`}
                          aria-expanded={Boolean(isOpen)}
                          className="shrink-0 p-1.5"
                        >
                          {isOpen ? (
                            <ChevronDown size={14} />
                          ) : (
                            <ChevronRight size={14} />
                          )}
                        </button>

                        <Link
                          href={moduleHref}
                          onClick={handleNavigation}
                          className="flex min-w-0 flex-1 items-center gap-2 py-1.5 pr-2 text-xs"
                        >
                          <ModuleIcon size={15} className="shrink-0" />

                          <span className="truncate">
                            {module.name}
                          </span>
                        </Link>
                      </div>

                      {isOpen && (
                        <div className="ml-3 space-y-0.5 pl-1.5">
                          {module.sections.map((section) =>
                            renderSection(section, module.id)
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="mt-2 border-t border-slate-800 pt-2">
              <button
                type="button"
                onClick={handleLogout}
                className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-xs text-slate-300 transition-colors hover:bg-red-600 hover:text-white"
              >
                <LogOut size={15} />
                Logout
              </button>
            </div>
          </div>
        )}
      </header>
    );
  }

  return (
    <>
      <style jsx global>{`
        [data-erp-vertical-nav] {
          scrollbar-width: none;
          -ms-overflow-style: none;
        }

        [data-erp-vertical-nav]::-webkit-scrollbar {
          display: none;
          width: 0;
          height: 0;
        }
      `}</style>

      <button
        type="button"
        onClick={() =>
          setMobileOpen((current) => !current)
        }
        className="fixed left-3 top-3 z-[60] rounded-lg border border-slate-200 bg-white p-2 text-slate-800 shadow-lg md:hidden"
        aria-label={
          mobileOpen
            ? "Close navigation"
            : "Open navigation"
        }
        aria-expanded={mobileOpen}
      >
        {mobileOpen ? <X size={19} /> : <Menu size={19} />}
      </button>

      {mobileOpen && (
        <button
          type="button"
          aria-label="Close navigation overlay"
          onClick={() => setMobileOpen(false)}
          className="fixed inset-0 z-40 bg-slate-950/60 backdrop-blur-[2px] md:hidden"
        />
      )}

      <aside
        data-sidebar-root
        data-erp-sidebar
        className={`isolate fixed inset-y-0 left-0 z-50 flex h-dvh max-h-dvh w-[min(320px,calc(100vw-1rem))] min-w-[220px] shrink-0 flex-col overflow-hidden overscroll-none border-r border-slate-800 bg-slate-950 text-white shadow-xl transition-transform duration-200 md:sticky md:top-0 md:h-dvh md:max-h-dvh md:translate-x-0 md:w-max md:max-w-[320px] ${mobileOpen
            ? "translate-x-0"
            : "-translate-x-full"
          }`}
      >
        <Link
          href="/dashboard"
          onClick={handleNavigation}
          className="relative z-20 flex h-14 shrink-0 items-center gap-2.5 border-b border-slate-800 bg-slate-950 px-4"
        >
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-600 text-xs font-bold">
            ERP
          </div>

          <div className="min-w-0">
            <h1 className="text-base font-bold tracking-wide">
              ERP System
            </h1>

            <p className="text-[10px] text-slate-400">
              Enterprise Resource Planning
            </p>
          </div>
        </Link>

        <div className="relative z-20 shrink-0 bg-slate-950 pt-2">
          {renderModeButton()}
        </div>

        {renderVerticalModules()}

        <div className="relative z-20 shrink-0 border-t border-slate-800 bg-slate-950 p-2">
          <button
            type="button"
            onClick={handleLogout}
            className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-xs font-medium text-slate-300 transition-colors hover:bg-red-600 hover:text-white"
          >
            <LogOut size={16} />
            <span>Logout</span>
          </button>

          <p className="mt-1.5 text-center text-[10px] text-slate-500">
            Developed for your business
          </p>
        </div>
      </aside>
    </>
  );
}
