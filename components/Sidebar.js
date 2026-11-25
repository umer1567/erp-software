
"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
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
  ChevronLeft,
  Menu,
  X,
  PanelsTopLeft,
  PanelLeft,
  ShieldAlert,
  RefreshCw,
  Grid3X3,
  Trash2,
} from "lucide-react";

import { erpModules } from "@/lib/erp-modules";

const STORAGE_KEY = "erp-sidebar-mode";
const PERMISSIONS_URL = "/api/permissions/current";

// Shared between Sidebar mounts to avoid repeated API requests.
const PERMISSION_CACHE_TTL = 30 * 1000;

let sidebarPermissionCache = null;
let sidebarPermissionRequest = null;

async function fetchSidebarPermissions(forceRefresh = false) {
  const cacheIsValid =
    sidebarPermissionCache &&
    Date.now() - sidebarPermissionCache.timestamp <
    PERMISSION_CACHE_TTL;

  if (!forceRefresh && cacheIsValid) {
    return sidebarPermissionCache.data;
  }

  // Reuse an existing request instead of sending duplicates.
  if (sidebarPermissionRequest) {
    return sidebarPermissionRequest;
  }

  sidebarPermissionRequest = (async () => {
    const response = await fetch(PERMISSIONS_URL, {
      method: "GET",
      credentials: "same-origin",
      cache: "no-store",
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
        "Invalid permissions response"
      );
    }

    sidebarPermissionCache = {
      data,
      timestamp: Date.now(),
    };

    return data;
  })();

  try {
    return await sidebarPermissionRequest;
  } finally {
    sidebarPermissionRequest = null;
  }
}

// =====================================================
// ROUTE PERMISSIONS
// =====================================================

const ROUTE_PERMISSION_KEYS = {
  // Administration
  "/dashboard/users": "users",
  "/dashboard/roles": "roles",
  "/dashboard/user-rights": "user_rights",

  // Settings
  "/dashboard/settings": "settings",
  "/dashboard/register-company": "settings",
  "/dashboard/help-support": "settings",
  "/dashboard/recycle-bin": "recycle_bin",

  // Inventory
  "/dashboard/products": "products",
  "/dashboard/product-categories": "product_categories",
  "/dashboard/units-of-measure": "units_of_measure",
  "/dashboard/warehouses": "warehouse",
  "/dashboard/stock": "warehouse",
  "/dashboard/stock-adjustment": "warehouse",
  "/dashboard/items-ledger": "items_ledger",
  "/dashboard/reports/stock": "warehouse",

  // Customers
  "/dashboard/customers": "customers",
  "/dashboard/customer-balance": "customers",
  "/dashboard/customer-ledger": "customers",
  "/dashboard/customer-detail-ledger": "customer_detail_ledger",

  // Sales
  "/dashboard/pos": "sales",
  "/dashboard/sales-invoices": "sales",
  "/dashboard/sales-payments": "sales_payment",
  "/dashboard/sales-quotations": "sales_quotations",
  "/dashboard/sales-orders": "sales_orders",

  // Delivery Challans and Returns
  "/dashboard/delivery-challans/pending":
    "pending_delivery_challans",
  "/dashboard/delivery-challans": "delivery_challans",
  "/dashboard/sales-returns": "sales_returns",

  // Sales Reports
  "/dashboard/reports/sales": "sales_dashboard",
  "/dashboard/reports/payments": "payment_report",

  // Vendors
  "/dashboard/suppliers": "vendors",
  "/dashboard/supplier-balance": "supplier_balance",
  "/dashboard/supplier-ledger": "vendors_ledger",
  "/dashboard/purchase-detail-ledger": "purchase_detail_ledger",

  // Purchase and Procurement
  "/dashboard/purchase-requisitions": "purchase_requisitions",
  "/dashboard/requisitions-for-procurement":
    "requisitions_for_procurement",
  "/dashboard/rfqs": "rfqs",
  "/dashboard/purchase-quotations": "purchase_quotations",
  "/dashboard/purchase-orders": "purchase_orders",
  "/dashboard/item-receipts/pending": "pending_item_receipts",
  "/dashboard/item-receipts": "item_receipts",
  "/dashboard/purchase-invoices": "purchase_invoices",
  "/dashboard/purchase-payments": "purchase_payment",
  "/dashboard/reports/purchases": "purchase_dashboard",


  "/dashboard/bill-of-materials": "bill_of_materials",
  "/dashboard/assembly-build": "assembly_build",
  "/dashboard/assembly-unbuild": "assembly_unbuild",

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

// =====================================================
// ICONS
// =====================================================

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
  "sales-transactions": FileText,
  "sales-returns": Receipt,
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
  "data-management": Trash2,
};

// =====================================================
// HELPERS
// =====================================================

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
  const explicitKey = ROUTE_PERMISSION_KEYS[item.href];

  if (explicitKey) {
    return [
      explicitKey,
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

// =====================================================
// LAYOUT MODE SELECTOR
// =====================================================


function ModeSelector({ mode, onModeChange }) {
  const pathname = usePathname();
  const modulesActive =
    pathname === "/dashboard/modules" ||
    pathname.startsWith("/dashboard/modules/");

  return (
    <div className="flex w-fit shrink-0 items-center gap-0.5 rounded-lg border border-slate-700 bg-slate-900 p-0.5">
      {/* Vertical sidebar */}
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

      {/* Modules */}
      <Link
        href="/dashboard/modules"
        aria-label="Modules"
        title="Modules"
        className={`flex items-center justify-center rounded-md p-1.5 transition-colors ${modulesActive
          ? "bg-blue-600 text-white"
          : "text-slate-400 hover:bg-slate-800 hover:text-white"
          }`}
      >
        <Grid3X3 size={14} />
      </Link>

      {/* Horizontal navigation */}
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

// =====================================================
// MAIN SIDEBAR
// =====================================================

export default function Sidebar({
  mode = "vertical",
  onModeChange,
  collapsed = false,
  onToggleCollapsed,
}) {
  const [savedMode, setSavedMode] = useState(null);

  return (
    <SidebarContent
      mode={mode}
      onModeChange={onModeChange}
      savedMode={savedMode}
      setSavedMode={setSavedMode}
      collapsed={collapsed}
      onToggleCollapsed={onToggleCollapsed}
    />
  );
}

// =====================================================
// SIDEBAR CONTENT
// =====================================================

function SidebarContent({
  mode,
  onModeChange,
  savedMode,
  setSavedMode,
  collapsed,
  onToggleCollapsed,
}) {
  const pathname = usePathname();

  const [permissions, setPermissions] = useState(new Map());
  const [permissionsLoading, setPermissionsLoading] =
    useState(true);
  const [permissionsError, setPermissionsError] =
    useState(false);

  // undefined means automatically expand the active module.
  const [openModule, setOpenModule] = useState(undefined);

  // undefined means automatically expand the active section.
  const [openSection, setOpenSection] = useState(undefined);

  const [mobileOpen, setMobileOpen] = useState(false);
  // const [compactSidebar, setCompactSidebar] = useState(false);

  // const permissionControllerRef = useRef(null);

  const layoutMode = savedMode ?? mode;
  const isHorizontal = layoutMode === "horizontal";

  // ===================================================
  // LOAD PERMISSIONS - OPTIMIZED
  // ===================================================

  const loadPermissions = useCallback(async (forceRefresh = false) => {
    try {
      const data = await fetchSidebarPermissions(forceRefresh);

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

      setPermissions(nextPermissions);
      setPermissionsError(false);
    } catch (error) {
      console.error(
        "Could not load sidebar permissions:",
        error
      );

      setPermissionsError(true);
    } finally {
      setPermissionsLoading(false);
    }
  }, []);

  // Load once when the sidebar mounts.
  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadPermissions(false);
    }, 0);

    return () => {
      window.clearTimeout(timer);
    };
  }, [loadPermissions]);

  // Refresh immediately when User Rights changes.
  useEffect(() => {
    function handlePermissionsUpdated() {
      void loadPermissions(true);
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

  // ===================================================
  // FILTER MODULES BY PERMISSIONS
  // ===================================================

  const visibleModules = useMemo(
    () => filterModulesByPermission(erpModules, permissions),
    [permissions]
  );

  const currentModule = visibleModules.find((module) => {
    const modulePage = `/dashboard/modules/${module.id}`;

    return (
      isModuleActive(module, pathname) ||
      pathname === modulePage ||
      pathname.startsWith(`${modulePage}/`)
    );
  });

  const currentSection = currentModule?.sections.find(
    (section) => isSectionActive(section, pathname)
  );

  const effectiveOpenModule =
    openModule === undefined
      ? currentModule?.id ?? null
      : openModule;

  const currentSectionKey = currentSection && currentModule
    ? `${currentModule.id}:${currentSection.id}`
    : null;

  const effectiveOpenSection =
    openSection === undefined
      ? currentSectionKey
      : openSection;

  // ===================================================
  // SIDEBAR DENSITY
  // ===================================================

  // useEffect(() => {
  //   function updateSidebarDensity() {
  //     setCompactSidebar(window.innerHeight < 850);
  //   }

  //   updateSidebarDensity();

  //   window.addEventListener("resize", updateSidebarDensity);

  //   return () => {
  //     window.removeEventListener(
  //       "resize",
  //       updateSidebarDensity
  //     );
  //   };
  // }, []);

  // ===================================================
  // RESTORE SAVED LAYOUT
  // ===================================================

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
      console.error(
        "Could not read sidebar layout:",
        error
      );
    }
    // Read the saved layout once when the sidebar mounts.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    document.cookie =
      `${STORAGE_KEY}=${layoutMode}; path=/; max-age=31536000; samesite=lax`;
  }, [layoutMode]);

  // Reset expansion state after navigation so the active
  // module and section automatically open again.
  const handleNavigation = () => {
    setOpenModule(undefined);
    setOpenSection(undefined);
    setMobileOpen(false);
  };

  // ===================================================
  // NAVIGATION HELPERS
  // ===================================================

  function changeLayoutMode(nextMode) {
    if (
      nextMode !== "horizontal" &&
      nextMode !== "vertical"
    ) {
      return;
    }

    setSavedMode(nextMode);

    try {
      window.localStorage.setItem(STORAGE_KEY, nextMode);
    } catch (error) {
      console.error(
        "Could not save sidebar layout:",
        error
      );
    }

    setMobileOpen(false);
    setOpenModule(undefined);
    setOpenSection(undefined);

    onModeChange?.(nextMode);
  }

  function toggleModule(moduleId) {
    const currentlyOpen = effectiveOpenModule;

    setOpenSection(undefined);

    setOpenModule(
      currentlyOpen === moduleId ? null : moduleId
    );
  }

  function toggleSection(sectionKey) {
    setOpenSection(
      effectiveOpenSection === sectionKey
        ? null
        : sectionKey
    );
  }

  // function handleNavigation() {
  //   setMobileOpen(false);
  //   setOpenModule(undefined);
  //   setOpenSection(undefined);
  // }

  // ===================================================
  // OUTSIDE CLICK AND ESCAPE
  // ===================================================

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

      document.removeEventListener(
        "keydown",
        handleEscape
      );
    };
  }, []);

  // ===================================================
  // LOGOUT
  // ===================================================

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
      console.error(
        "Could not read selected company:",
        error
      );
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

  // ===================================================
  // DASHBOARD LINK
  // ===================================================

  function renderDashboardLink(horizontal = false) {
    const active = pathname === "/dashboard";

    return (
      <Link
        href="/dashboard"
        onClick={handleNavigation}
        className={`flex shrink-0 items-center gap-2 rounded-lg transition-colors ${horizontal
          ? "px-3 py-2 text-xs"
          : "px-3 py-2.5 text-sm"
          } font-medium ${active
            ? "bg-blue-600 text-white shadow-sm"
            : "text-slate-300 hover:bg-slate-800 hover:text-white"
          }`}
      >
        <LayoutDashboard
          size={horizontal ? 15 : 17}
          className="shrink-0"
        />
        <span>Dashboard</span>
      </Link>
    );
  }

  // ===================================================
  // MODE AND COLLAPSE BUTTONS
  // ===================================================

  function renderModeButton() {
    return (
      <ModeSelector
        mode={layoutMode}
        onModeChange={changeLayoutMode}
      />
    );
  }

  function renderVerticalCollapseToggle() {
    return (
      <button
        type="button"
        onClick={() => onToggleCollapsed?.()}
        title="Hide vertical sidebar"
        aria-label="Hide vertical sidebar"
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-slate-400 transition-colors hover:bg-slate-800 hover:text-white"
      >
        <ChevronLeft size={19} />
      </button>
    );
  }

  // ===================================================
  // PERMISSION STATUS
  // ===================================================

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
            <ShieldAlert
              size={16}
              className="mt-0.5 shrink-0"
            />

            <div className="min-w-0">
              <p className="text-xs font-semibold">
                Permissions unavailable
              </p>

              <p className="mt-1 text-[11px] leading-4 text-amber-200/80">
                Protected navigation is hidden until
                permissions can be loaded.
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

  // ===================================================
  // THIRD LEVEL: INDIVIDUAL PAGE LINKS
  // ===================================================

  function renderChildLinks(section) {
    return (
      <div className="ml-5 space-y-0.5 py-1 pl-2">
        {section.items.map((item) => {
          const active = isItemActive(item, pathname);

          return (
            <Link
              key={`${item.name}:${item.href}`}
              href={item.href}
              onClick={handleNavigation}
              className={`block rounded-md px-2 py-1.5 text-xs transition-colors ${active
                ? "bg-blue-600/20 font-semibold text-blue-300"
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

  // ===================================================
  // SECOND LEVEL: SECTIONS
  // ===================================================

  function renderSection(section, moduleId) {
    const SectionIcon =
      sectionIcons[section.id] || FileText;

    const sectionKey = `${moduleId}:${section.id}`;
    const sectionActive = isSectionActive(section, pathname);
    const sectionOpen =
      effectiveOpenSection === sectionKey;

    return (
      <div key={section.id} className="min-w-0">
        <button
          type="button"
          onClick={() => toggleSection(sectionKey)}
          aria-expanded={Boolean(sectionOpen)}
          className={`flex w-full min-w-0 items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs transition-colors ${sectionActive || sectionOpen
            ? "bg-slate-800 text-blue-300"
            : "text-slate-300 hover:bg-slate-800 hover:text-white"
            }`}
        >
          {sectionOpen ? (
            <ChevronDown
              size={12}
              className="shrink-0"
            />
          ) : (
            <ChevronRight
              size={12}
              className="shrink-0"
            />
          )}

          <SectionIcon
            size={14}
            className="shrink-0"
          />

          <span className="min-w-0 flex-1 whitespace-normal break-words">
            {section.name}
          </span>
        </button>

        {sectionOpen && renderChildLinks(section)}
      </div>
    );
  }

  // ===================================================
  // FIRST LEVEL: MODULES - VERTICAL NAVIGATION
  // ===================================================

  function renderVerticalModules() {
    return (
      <nav
        aria-label="Main navigation"
        className="min-h-0 flex-1 overflow-y-auto px-2 py-2"
      >
        <div className="mb-2 flex w-full items-center gap-1">
          <div className="min-w-0 flex-1">
            {renderDashboardLink()}
          </div>

          {renderVerticalCollapseToggle()}
        </div>

        {renderPermissionStatus()}

        {!permissionsLoading && !permissionsError && (
          <div className="space-y-1">
            {visibleModules.map((module) => {
              const ModuleIcon =
                moduleIcons[module.id] || Package;

              const moduleActive = isModuleActive(
                module,
                pathname
              );

              const modulePage =
                `/dashboard/modules/${module.id}`;

              const modulePageActive =
                pathname === modulePage ||
                pathname.startsWith(`${modulePage}/`);

              const isOpen =
                effectiveOpenModule === module.id;

              return (
                <div
                  key={module.id}
                  className="min-w-0"
                >
                  {/* Parent module */}
                  <div
                    className={`flex min-w-0 items-center rounded-lg transition-colors ${moduleActive || modulePageActive || isOpen
                      ? "bg-slate-800 text-white"
                      : "text-slate-300 hover:bg-slate-800 hover:text-white"
                      }`}
                  >
                    <button
                      type="button"
                      onClick={() => toggleModule(module.id)}
                      aria-label={`${isOpen ? "Collapse" : "Expand"} ${module.name}`}
                      aria-expanded={Boolean(isOpen)}
                      className="flex h-10 w-8 shrink-0 items-center justify-center rounded-l-lg hover:text-blue-300"
                    >
                      {isOpen ? (
                        <ChevronDown size={15} />
                      ) : (
                        <ChevronRight size={15} />
                      )}
                    </button>

                    <Link
                      href={modulePage}
                      onClick={handleNavigation}
                      className="flex min-w-0 flex-1 items-center gap-2 py-2 pr-2 text-sm font-medium"
                    >
                      <ModuleIcon
                        size={17}
                        className="shrink-0"
                      />

                      <span className="min-w-0 flex-1 truncate">
                        {module.name}
                      </span>
                    </Link>
                  </div>

                  {/* Second and third levels */}
                  {isOpen && (
                    <div className="ml-3 mt-1 space-y-0.5 pl-2">
                      {module.sections.map((section) =>
                        renderSection(section, module.id)
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {!permissionsLoading &&
          !permissionsError &&
          visibleModules.length === 0 && (
            <p className="px-3 py-4 text-center text-xs text-slate-400">
              No modules are available for your account.
            </p>
          )}
      </nav>
    );
  }

  // ===================================================
  // HORIZONTAL NAVIGATION MODULE DROPDOWNS
  // ===================================================

  function renderHorizontalModules() {
    return (
        <nav
            aria-label="Main navigation"
            className="flex min-w-0 flex-1 items-center gap-1"
        >
            {/* Dashboard */}
            <div className="min-w-0 flex-1">
                {renderDashboardLink(true)}
            </div>

            {permissionsLoading && (
                <div className="flex flex-1 items-center justify-center gap-2 px-3 text-xs text-slate-400">
                    <RefreshCw size={13} className="animate-spin" />
                    Loading...
                </div>
            )}

            {permissionsError && (
                <button
                    type="button"
                    onClick={() => void loadPermissions()}
                    className="flex flex-1 items-center justify-center gap-1 rounded-lg px-3 py-2 text-xs text-amber-300 hover:bg-slate-800"
                >
                    <ShieldAlert size={14} />
                    Retry permissions
                </button>
            )}

            {!permissionsLoading &&
                !permissionsError &&
                visibleModules.map((module) => {
                    const ModuleIcon =
                        moduleIcons[module.id] || Package;

                    const isOpen =
                        effectiveOpenModule === module.id;

                    const moduleActive =
                        isModuleActive(module, pathname);

                    return (
                        <div
                            key={module.id}
                            className="relative min-w-0 flex-1"
                        >
                            <button
                                type="button"
                                onClick={() => toggleModule(module.id)}
                                aria-expanded={Boolean(isOpen)}
                                title={module.name}
                                className={`flex w-full min-w-0 items-center justify-center gap-1.5 rounded-lg px-2 py-2 text-xs font-medium transition-colors ${moduleActive || isOpen
                                    ? "bg-blue-600 text-white"
                                    : "text-slate-300 hover:bg-slate-800 hover:text-white"
                                    }`}
                            >
                                <ModuleIcon
                                    size={15}
                                    className="shrink-0"
                                />

                                <span className="min-w-0 truncate">
                                    {module.name}
                                </span>

                                {isOpen ? (
                                    <ChevronDown
                                        size={13}
                                        className="shrink-0"
                                    />
                                ) : (
                                    <ChevronRight
                                        size={13}
                                        className="shrink-0"
                                    />
                                )}
                            </button>

                            {/* Module dropdown */}
                            {isOpen && (
                                <div className="absolute left-0 top-full z-[150] mt-2 max-h-[75dvh] w-[320px] max-w-[calc(100vw-2rem)] overflow-y-auto rounded-xl border border-slate-700 bg-slate-950 p-3 text-white shadow-2xl">
                                    <div className="mb-3 flex items-center gap-2 border-b border-slate-800 pb-3">
                                        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600/20 text-blue-400">
                                            <ModuleIcon size={17} />
                                        </div>

                                        <span className="text-sm font-semibold">
                                            {module.name}
                                        </span>
                                    </div>

                                    <div className="space-y-1">
                                        {module.sections.map((section) =>
                                            renderSection(section, module.id)
                                        )}
                                    </div>

                                    <Link
                                        href={`/dashboard/modules/${module.id}`}
                                        onClick={handleNavigation}
                                        className="mt-3 flex items-center justify-center gap-2 rounded-lg border border-slate-700 px-3 py-2 text-xs text-slate-300 transition-colors hover:bg-slate-800 hover:text-white"
                                    >
                                        <Grid3X3 size={13} />
                                        Open {module.name} module
                                    </Link>
                                </div>
                            )}
                        </div>
                    );
                })}
        </nav>
    );
}

  // ===================================================
  // COLLAPSED SIDEBAR
  // ===================================================

  if (collapsed && !isHorizontal) {
    return (
      <button
        type="button"
        onClick={() => onToggleCollapsed?.()}
        title="Show vertical sidebar"
        aria-label="Show vertical sidebar"
        className="fixed left-2 top-1/2 z-[150] flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-md border border-slate-700 bg-slate-950 text-white shadow-xl transition-colors hover:bg-blue-600"
      >
        <ChevronRight size={19} />
      </button>
    );
  }

  // ===================================================
  // HORIZONTAL SIDEBAR
  // ===================================================

  if (isHorizontal) {
    return (
      <header
        data-sidebar-root
        data-erp-sidebar
        className="relative z-[80] w-full shrink-0 border-b border-slate-800 bg-slate-950 text-white shadow-lg"
      >
        {/* Desktop horizontal navigation */}
        <div className="hidden min-h-12 w-full items-center gap-2 px-3 lg:flex">
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

          {renderHorizontalModules()}

          <div className="h-6 w-px shrink-0 bg-slate-700" />

          {renderModeButton()}

          <button
            type="button"
            onClick={handleLogout}
            title="Logout"
            className="flex shrink-0 items-center gap-1 rounded-lg px-2 py-1.5 text-xs font-medium text-slate-300 transition-colors hover:bg-red-600 hover:text-white"
          >
            <LogOut size={14} />
            <span>Logout</span>
          </button>
        </div>

        {/* Mobile horizontal header */}
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
              {mobileOpen ? (
                <X size={18} />
              ) : (
                <Menu size={18} />
              )}
            </button>
          </div>
        </div>

        {/* Mobile three-level navigation */}
        {mobileOpen && (
          <div className="border-t border-slate-800 p-2 lg:hidden">
            <div className="max-h-[70dvh] overflow-y-auto overscroll-contain">
              {renderVerticalModules()}
            </div>

            <div className="border-t border-slate-800 pt-2">
              <button
                type="button"
                onClick={handleLogout}
                className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-xs text-slate-300 transition-colors hover:bg-red-600 hover:text-white"
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

  // ===================================================
  // VERTICAL SIDEBAR
  // ===================================================

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

      {/* Mobile menu button */}
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
        {mobileOpen ? (
          <X size={19} />
        ) : (
          <Menu size={19} />
        )}
      </button>

      {/* Mobile overlay */}
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
        className={`isolate fixed inset-y-0 left-0 z-50 flex h-dvh max-h-dvh w-fit min-w-[220px] max-w-[min(320px,calc(100vw-1rem))] shrink-0 flex-col overflow-hidden overscroll-none border-r border-slate-800 bg-slate-950 text-white shadow-xl transition-transform duration-200 md:sticky md:top-0 md:h-dvh md:max-h-dvh md:translate-x-0 md:w-fit md:min-w-[220px] md:max-w-[320px] ${mobileOpen
          ? "translate-x-0"
          : "-translate-x-full"
          }`}
      >
        {/* Sidebar brand */}
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

        {/* Sidebar toolbar */}
        <div className="relative z-20 flex shrink-0 items-center justify-end gap-2 border-b border-slate-800 bg-slate-950 px-3 py-2">
          {renderModeButton()}
          {/* {renderCollapseButton()} */}
        </div>

        {/* Three-level navigation */}
        {renderVerticalModules()}

        {/* Sidebar footer */}
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
