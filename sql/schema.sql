-- =========================================================
-- ERP SYSTEM DATABASE
-- PHASE 1
-- PostgreSQL
-- =========================================================

-- =========================================================
-- ROLES
-- =========================================================

CREATE TABLE IF NOT EXISTS roles (
    role_id SERIAL PRIMARY KEY,
    role_name VARCHAR(50) NOT NULL UNIQUE,
    description VARCHAR(255),
    is_system_role BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);


-- =========================================================
-- PERMISSIONS
-- =========================================================

CREATE TABLE IF NOT EXISTS permissions (
    permission_id SERIAL PRIMARY KEY,
    permission_key VARCHAR(100) NOT NULL UNIQUE,
    permission_name VARCHAR(100) NOT NULL,
    module VARCHAR(50) NOT NULL,
    description VARCHAR(255),
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);


-- =========================================================
-- ROLE PERMISSIONS
-- =========================================================

CREATE TABLE IF NOT EXISTS role_permissions (
    role_permission_id SERIAL PRIMARY KEY,

    role_id INTEGER NOT NULL
        REFERENCES roles(role_id)
        ON DELETE CASCADE,

    permission_id INTEGER NOT NULL
        REFERENCES permissions(permission_id)
        ON DELETE CASCADE,

    can_view BOOLEAN NOT NULL DEFAULT FALSE,
    can_create BOOLEAN NOT NULL DEFAULT FALSE,
    can_update BOOLEAN NOT NULL DEFAULT FALSE,
    can_delete BOOLEAN NOT NULL DEFAULT FALSE,

    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    UNIQUE(role_id, permission_id)
);


-- =========================================================
-- USERS
-- =========================================================

CREATE TABLE IF NOT EXISTS users (
    user_id SERIAL PRIMARY KEY,

    full_name VARCHAR(150) NOT NULL,

    username VARCHAR(100) NOT NULL UNIQUE,

    email VARCHAR(150) UNIQUE,

    password_hash TEXT NOT NULL,

    role_id INTEGER NOT NULL
        REFERENCES roles(role_id)
        ON DELETE RESTRICT,

    is_active BOOLEAN NOT NULL DEFAULT TRUE,

    last_login TIMESTAMP NULL,

    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);


-- =========================================================
-- INSERT ROLES
-- =========================================================

INSERT INTO roles
(
    role_name,
    description,
    is_system_role
)
VALUES
(
    'ADMIN',
    'Full system administrator',
    TRUE
),
(
    'SUB_ADMIN',
    'Administrator with controlled permissions',
    TRUE
),
(
    'USER',
    'Normal system user',
    TRUE
)
ON CONFLICT (role_name) DO NOTHING;


-- =========================================================
-- PERMISSIONS
-- =========================================================

INSERT INTO permissions
(
    permission_key,
    permission_name,
    module,
    description
)
VALUES

-- Dashboard
(
    'dashboard',
    'Dashboard',
    'Dashboard',
    'Access ERP dashboard'
),

-- Users
(
    'users',
    'Users',
    'Users',
    'Manage system users'
),

-- Roles
(
    'roles',
    'Roles',
    'Users',
    'Manage roles'
),

-- User Rights
(
    'user_rights',
    'User Rights',
    'Users',
    'Manage role permissions'
),

-- Customers
(
    'customers',
    'Customers',
    'Sales',
    'Manage customers'
),

-- Suppliers
(
    'suppliers',
    'Suppliers',
    'Purchase',
    'Manage suppliers'
),

-- Products
(
    'products',
    'Products',
    'Inventory',
    'Manage products'
),

-- Warehouse
(
    'warehouse',
    'Warehouse',
    'Inventory',
    'Manage warehouses'
),

-- Sales
(
    'sales',
    'Sales',
    'Sales',
    'Manage sales'
),

-- Sales Payment
(
    'sales_payment',
    'Sales Payment',
    'Sales',
    'Manage sales payments'
),

-- Purchase
(
    'purchase',
    'Purchase',
    'Purchase',
    'Manage purchases'
),

-- Purchase Payment
(
    'purchase_payment',
    'Purchase Payment',
    'Purchase',
    'Manage purchase payments'
),

-- Chart of Accounts
(
    'chart_of_accounts',
    'Chart of Accounts',
    'Accounting',
    'Manage chart of accounts'
),

-- Reports
(
    'reports',
    'Reports',
    'Reports',
    'View ERP reports'
),

-- Settings
(
    'settings',
    'Settings',
    'Settings',
    'Manage system settings'
)

ON CONFLICT (permission_key) DO NOTHING;


-- =========================================================
-- GIVE ADMIN ALL PERMISSIONS
-- =========================================================

INSERT INTO role_permissions
(
    role_id,
    permission_id,
    can_view,
    can_create,
    can_update,
    can_delete
)
SELECT
    r.role_id,
    p.permission_id,
    TRUE,
    TRUE,
    TRUE,
    TRUE
FROM roles r
CROSS JOIN permissions p
WHERE r.role_name = 'ADMIN'
ON CONFLICT (role_id, permission_id)
DO UPDATE SET
    can_view = TRUE,
    can_create = TRUE,
    can_update = TRUE,
    can_delete = TRUE;


-- =========================================================
-- DEFAULT SUB ADMIN PERMISSIONS
-- =========================================================

INSERT INTO role_permissions
(
    role_id,
    permission_id,
    can_view,
    can_create,
    can_update,
    can_delete
)
SELECT
    r.role_id,
    p.permission_id,

    CASE
        WHEN p.permission_key IN
        (
            'dashboard',
            'users',
            'customers',
            'suppliers',
            'products',
            'warehouse',
            'sales',
            'sales_payment',
            'purchase',
            'purchase_payment',
            'chart_of_accounts',
            'reports'
        )
        THEN TRUE
        ELSE FALSE
    END,

    CASE
        WHEN p.permission_key IN
        (
            'customers',
            'suppliers',
            'products',
            'warehouse',
            'sales',
            'sales_payment',
            'purchase',
            'purchase_payment'
        )
        THEN TRUE
        ELSE FALSE
    END,

    CASE
        WHEN p.permission_key IN
        (
            'customers',
            'suppliers',
            'products',
            'warehouse',
            'sales',
            'purchase'
        )
        THEN TRUE
        ELSE FALSE
    END,

    CASE
        WHEN p.permission_key IN
        (
            'customers',
            'suppliers',
            'products'
        )
        THEN TRUE
        ELSE FALSE
    END

FROM roles r
CROSS JOIN permissions p
WHERE r.role_name = 'SUB_ADMIN'
ON CONFLICT (role_id, permission_id)
DO NOTHING;


-- =========================================================
-- DEFAULT USER PERMISSIONS
-- =========================================================

INSERT INTO role_permissions
(
    role_id,
    permission_id,
    can_view,
    can_create,
    can_update,
    can_delete
)
SELECT
    r.role_id,
    p.permission_id,

    CASE
        WHEN p.permission_key IN
        (
            'dashboard',
            'customers',
            'products',
            'sales',
            'sales_payment'
        )
        THEN TRUE
        ELSE FALSE
    END,

    CASE
        WHEN p.permission_key IN
        (
            'customers',
            'sales',
            'sales_payment'
        )
        THEN TRUE
        ELSE FALSE
    END,

    FALSE,
    FALSE

FROM roles r
CROSS JOIN permissions p
WHERE r.role_name = 'USER'
ON CONFLICT (role_id, permission_id)
DO NOTHING;

-- =========================================================
-- COMPANY SETTINGS
-- =========================================================

CREATE TABLE IF NOT EXISTS company_settings (
    setting_id SERIAL PRIMARY KEY,

    company_name VARCHAR(200) NOT NULL DEFAULT 'My Company',

    phone VARCHAR(50),

    email VARCHAR(150),

    address TEXT,

    currency VARCHAR(20) NOT NULL DEFAULT 'PKR',

    logo_url TEXT,

    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);


-- =========================================================
-- DEFAULT COMPANY SETTINGS
-- =========================================================

INSERT INTO company_settings
(
    company_name,
    phone,
    email,
    address,
    currency
)
SELECT
    'My Company',
    '',
    '',
    '',
    'PKR'
WHERE NOT EXISTS (
    SELECT 1
    FROM company_settings
);