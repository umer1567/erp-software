export const erpModules = [
  {
    id: "administration",
    name: "Administration",
    sections: [
      {
        id: "user-management",
        name: "User Management",
        items: [
          { name: "Users", href: "/dashboard/users" },
          { name: "Roles", href: "/dashboard/roles" },
          { name: "User Rights", href: "/dashboard/user-rights" },
        ],
      },
      {
        id: "settings",
        name: "Settings",
        items: [
          { name: "Company Settings", href: "/dashboard/settings" },
          { name: "Register Company", href: "/dashboard/register-company" },
          { name: "Help & Support", href: "/dashboard/help-support" },
        ],
      },
    ],
  },

  // =====================================================
  // INVENTORY
  // =====================================================

  {
    id: "inventory",
    name: "Inventory",
    sections: [
      {
        id: "item-management",
        name: "Item Management",
        items: [
          { name: "Products", href: "/dashboard/products" },
          {
            name: "Product Categories",
            href: "/dashboard/product-categories",
          },
          {
            name: "Units of Measure",
            href: "/dashboard/units-of-measure",
          },
        ],
      },
      {
        id: "warehouse-stock",
        name: "Warehouse & Stock",
        items: [
          { name: "Warehouses", href: "/dashboard/warehouses" },
          { name: "Stock", href: "/dashboard/stock" },
          { name: "Stock Adjustment", href: "/dashboard/stock-adjustment" },
          { name: "Items Ledger", href: "/dashboard/items-ledger" },
          { name: "Stock Report", href: "/dashboard/reports/stock" },
        ],
      },
    ],
  },

  // =====================================================
  // SALES
  // =====================================================

  {
    id: "sales",
    name: "Sales",
    sections: [
      {
        id: "customer-management",
        name: "Customer Define",
        items: [
          { name: "Customers", href: "/dashboard/customers" },
          { name: "Customer Balance", href: "/dashboard/customer-balance" },
          { name: "Customer Ledger", href: "/dashboard/customer-ledger" },
        ],
      },

      {
        id: "sales-processing",
        name: "Sales",
        items: [
          { name: "POS (Point of Sale)", href: "/dashboard/pos" },
          { name: "Sales Invoices", href: "/dashboard/sales-invoices" },
          { name: "Sales Payments", href: "/dashboard/sales-payments" },
        ],
      },

      {
        id: "sales-transactions",
        name: "Sales Transactions",
        items: [
          {
            name: "Sales Quotations",
            href: "/dashboard/sales-quotations",
          },
          {
            name: "Sales Orders",
            href: "/dashboard/sales-orders",
          },
          {
            name: "Pending Delivery Challans",
            href: "/dashboard/delivery-challans/pending",
          },
          {
            name: "Delivery Challans",
            href: "/dashboard/delivery-challans",
          },
        ],
      },

      {
        id: "sales-reports",
        name: "Sales Reports",
        items: [
          { name: "Sales Dashboard", href: "/dashboard/reports/sales" },
          { name: "Payment Report", href: "/dashboard/reports/payments" },
        ],
      },
    ],
  },

  // =====================================================
  // PURCHASES & PROCUREMENT
  // =====================================================

  {
    id: "purchase-procurement",
    name: "Purchases",
    sections: [

      // 1. VENDOR MANAGEMENT
      {
        id: "vendors",
        name: "Vendor Define",
        items: [
          { name: "Vendors", href: "/dashboard/suppliers" },
          { name: "Supplier Balance", href: "/dashboard/supplier-balance" },
          { name: "Vendors Ledger", href: "/dashboard/supplier-ledger" },
        ],
      },

      // 2. PURCHASE REQUISITION
      {
        id: "purchase-requisition",
        name: "Purchase Requisition",
        items: [
          {
            name: "Purchase Requisitions",
            href: "/dashboard/purchase-requisitions",
          },
        ],
      },

      // 3. PROCUREMENT
      {
        id: "procurement",
        name: "Procurement",
        items: [
          {
            name: "Requisition for Procurement",
            href: "/dashboard/requisitions-for-procurement",
          },
          {
            name: "RFQ (Request for Quotation)",
            href: "/dashboard/rfqs",
          },
          {
            name: "Purchase Quotations",
            href: "/dashboard/purchase-quotations",
          },
        ],
      },

      // 4. PURCHASE ORDERS
      {
        id: "purchase-orders",
        name: "Purchase Orders",
        items: [
          {
            name: "Purchase Orders",
            href: "/dashboard/purchase-orders",
          },
        ],
      },

      // 5. ITEM RECEIPTS
      {
        id: "item-receipts",
        name: "Item Receipts",
        items: [
          {
            name: "Pending Item Receipt",
            href: "/dashboard/item-receipts/pending",
          },
          {
            name: "Item Receipts",
            href: "/dashboard/item-receipts",
          },
        ],
      },

      // 6. PURCHASE INVOICES
      {
        id: "purchase-invoices",
        name: "Purchase Invoices",
        items: [
          {
            name: "Purchase Invoices",
            href: "/dashboard/purchase-invoices",
          },
        ],
      },

      // 7. SUPPLIER PAYMENTS
      {
        id: "supplier-payments",
        name: "Supplier Payments",
        items: [
          {
            name: "Supplier Payments",
            href: "/dashboard/purchase-payments",
          },
          {
            name: "Pay Bills",
            href: "/dashboard/purchase-payments",
          },
        ],
      },

      // 8. PURCHASE REPORTS
      {
        id: "purchase-reports",
        name: "Purchase Reports",
        items: [
          {
            name: "Purchase Dashboard",
            href: "/dashboard/reports/purchases",
          },
        ],
      },

      {
        id: "payable-reports",
        name: "Payable Reports",
        items: [
          {
            name: "Supplier Balance",
            href: "/dashboard/supplier-balance",
          },
          {
            name: "Vendors Ledger",
            href: "/dashboard/supplier-ledger",
          },
        ],
      },
    ],
  },

  // =====================================================
  // ACCOUNTING
  // =====================================================

  {
    id: "accounting",
    name: "Accounting",
    sections: [
      {
        id: "accounts",
        name: "Accounts",
        items: [
          { name: "Chart of Accounts", href: "/dashboard/chart-of-accounts" },
          { name: "Journal Entries", href: "/dashboard/journal-entries" },
          { name: "Make Payment", href: "/dashboard/make-payment" },
          { name: "Make Receipt", href: "/dashboard/make-receipt" },
          { name: "Financial Ledger", href: "/dashboard/accounting/ledger" },
          { name: "Cash / Bank", href: "/dashboard/cash-bank" },
        ],
      },

      {
        id: "financial-reports",
        name: "Financial Reports",
        items: [
          { name: "Receivable", href: "/dashboard/receivable" },
          { name: "Payable", href: "/dashboard/payable" },
          { name: "Profit & Loss", href: "/dashboard/reports/profit-loss" },
          { name: "Balance Sheet", href: "/dashboard/reports/balance-sheet" },
        ],
      },
    ],
  },

  // =====================================================
  // REPORTS
  // =====================================================

  {
    id: "reports",
    name: "Reports",
    sections: [
      {
        id: "business-reports",
        name: "Business Reports",
        items: [
          { name: "Sales Dashboard", href: "/dashboard/reports/sales" },
          { name: "Purchase Dashboard", href: "/dashboard/reports/purchases" },
          { name: "Stock Report", href: "/dashboard/reports/stock" },
          { name: "Payment Report", href: "/dashboard/reports/payments" },
          { name: "Profit & Loss", href: "/dashboard/reports/profit-loss" },
          { name: "Balance Sheet", href: "/dashboard/reports/balance-sheet" },
        ],
      },
    ],
  },
];
