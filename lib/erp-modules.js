
export const erpModules = [
    // =====================================================
    // ADMINISTRATION
    // =====================================================
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

            {
                id: "data-management",
                name: "Data Management",
                items: [
                    {
                        name: "Recycle Bin",
                        href: "/dashboard/recycle-bin",
                    },
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
                    { name: "Product Categories", href: "/dashboard/product-categories" },
                    { name: "Units of Measure", href: "/dashboard/units-of-measure" },
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
                    {
                        name: "Customer Detail Ledger",
                        href: "/dashboard/customer-detail-ledger",
                    },
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
                    { name: "Sales Quotations", href: "/dashboard/sales-quotations" },
                    { name: "Sales Orders", href: "/dashboard/sales-orders" },
                    { name: "Pending Delivery Challans", href: "/dashboard/delivery-challans/pending" },
                    { name: "Delivery Challans", href: "/dashboard/delivery-challans" },
                ],
            },
            {
                id: "sales-returns",
                name: "Sales Returns",
                items: [
                    { name: "Sales Returns", href: "/dashboard/sales-returns" },
                ],
            },
            {
                id: "sales-reports",
                name: "Sales Reports",
                items: [
                    { name: "Sales Report", href: "/dashboard/reports/sales" },
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
            {
                id: "vendors",
                name: "Vendor Define",
                items: [
                    { name: "Vendors", href: "/dashboard/suppliers" },
                    { name: "Supplier Balance", href: "/dashboard/supplier-balance" },
                    { name: "Vendors Ledger", href: "/dashboard/supplier-ledger" },
                    {
                        name: "Purchase Detail Ledger",
                        href: "/dashboard/purchase-detail-ledger",
                    },
                ],
            },
            {
                id: "purchase-requisition",
                name: "Purchase Requisition",
                items: [
                    { name: "Purchase Requisitions", href: "/dashboard/purchase-requisitions" },
                ],
            },
            {
                id: "procurement",
                name: "Procurement",
                items: [
                    { name: "Requisition for Procurement", href: "/dashboard/requisitions-for-procurement" },
                    { name: "RFQ (Request for Quotation)", href: "/dashboard/rfqs" },
                    { name: "Purchase Quotations", href: "/dashboard/purchase-quotations" },
                ],
            },
            {
                id: "purchase-orders",
                name: "Purchase Orders",
                items: [
                    { name: "Purchase Orders", href: "/dashboard/purchase-orders" },
                ],
            },
            {
                id: "item-receipts",
                name: "Item Receipts",
                items: [
                    { name: "Pending Item Receipt", href: "/dashboard/item-receipts/pending" },
                    { name: "Item Receipts", href: "/dashboard/item-receipts" },
                ],
            },
            {
                id: "purchase-invoices",
                name: "Purchase Invoices",
                items: [
                    { name: "Purchase Invoices", href: "/dashboard/purchase-invoices" },
                ],
            },
            {
                id: "supplier-payments",
                name: "Supplier Payments",
                items: [
                    { name: "Supplier Payments", href: "/dashboard/purchase-payments" },
                    { name: "Pay Bills", href: "/dashboard/purchase-payments" },
                ],
            },
            {
                id: "purchase-reports",
                name: "Purchase Reports",
                items: [
                    { name: "Purchase Report", href: "/dashboard/reports/purchases" },
                ],
            },
            {
                id: "payable-reports",
                name: "Payable Reports",
                items: [
                    { name: "Supplier Balance", href: "/dashboard/supplier-balance" },
                    { name: "Vendors Ledger", href: "/dashboard/supplier-ledger" },
                ],
            },
        ],
    },

    // =====================================================
    // PRODUCTION & PLANNING
    // =====================================================
    {
        id: "production-planning",
        name: "Production & Planning",
        sections: [
            {
                id: "manufacturing-routing",
                name: "Manufacturing Routing",
                items: [
                    {
                        name: "Bill of Materials",
                        href: "/dashboard/bill-of-materials",
                    },
                    {
                        name: "Assembly Build",
                        href: "/dashboard/assembly-build",
                    },
                    {
                        name: "Assembly Unbuild",
                        href: "/dashboard/assembly-unbuild",
                    },
                ],
            },
        ],
    },


     // =====================================================
// TRANSACTION AUTO NUMBER
// =====================================================
{
    id: "transaction-auto-number",
    name: "Transaction Auto Number",
    sections: [
        {
            id: "numbering-settings",
            name: "Numbering Configuration",
            items: [
                {
                    name: "Transaction Auto Number",
                    href: "/dashboard/transaction-auto-number",
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
                    { name: "Sales Report", href: "/dashboard/reports/sales" },
                    { name: "Purchase Report", href: "/dashboard/reports/purchases" },
                    { name: "Stock Report", href: "/dashboard/reports/stock" },
                    { name: "Payment Report", href: "/dashboard/reports/payments" },
                    { name: "Profit & Loss", href: "/dashboard/reports/profit-loss" },
                    { name: "Balance Sheet", href: "/dashboard/reports/balance-sheet" },
                ],
            },
        ],
    },
];
