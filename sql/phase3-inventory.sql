-- ============================================
-- PHASE 3 - INVENTORY
-- ============================================

-- ============================================
-- PRODUCTS
-- ============================================

CREATE TABLE IF NOT EXISTS products (
    product_id SERIAL PRIMARY KEY,

    sku VARCHAR(100) UNIQUE NOT NULL,

    product_name VARCHAR(200) NOT NULL,

    category VARCHAR(100),

    unit VARCHAR(50) NOT NULL DEFAULT 'PCS',

    cost_price NUMERIC(15,2) NOT NULL DEFAULT 0,

    sale_price NUMERIC(15,2) NOT NULL DEFAULT 0,

    minimum_stock NUMERIC(15,3) NOT NULL DEFAULT 0,

    is_active BOOLEAN NOT NULL DEFAULT TRUE,

    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);


-- ============================================
-- WAREHOUSES
-- ============================================

CREATE TABLE IF NOT EXISTS warehouses (
    warehouse_id SERIAL PRIMARY KEY,

    warehouse_name VARCHAR(200) NOT NULL,

    warehouse_code VARCHAR(50) UNIQUE NOT NULL,

    location VARCHAR(300),

    description TEXT,

    is_active BOOLEAN NOT NULL DEFAULT TRUE,

    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);


-- ============================================
-- STOCK
-- One record per Product + Warehouse
-- ============================================

CREATE TABLE IF NOT EXISTS stock (
    stock_id SERIAL PRIMARY KEY,

    product_id INTEGER NOT NULL
        REFERENCES products(product_id)
        ON DELETE CASCADE,

    warehouse_id INTEGER NOT NULL
        REFERENCES warehouses(warehouse_id)
        ON DELETE CASCADE,

    quantity NUMERIC(15,3) NOT NULL DEFAULT 0,

    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT unique_product_warehouse
        UNIQUE(product_id, warehouse_id),

    CONSTRAINT stock_quantity_non_negative
        CHECK(quantity >= 0)
);


-- ============================================
-- STOCK ADJUSTMENTS
-- ============================================

CREATE TABLE IF NOT EXISTS stock_adjustments (
    adjustment_id SERIAL PRIMARY KEY,

    warehouse_id INTEGER NOT NULL
        REFERENCES warehouses(warehouse_id),

    adjustment_type VARCHAR(20) NOT NULL,

    reference_number VARCHAR(100),

    reason TEXT,

    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT valid_adjustment_type
        CHECK(adjustment_type IN ('INCREASE', 'DECREASE'))
);


-- ============================================
-- STOCK ADJUSTMENT ITEMS
-- ============================================

CREATE TABLE IF NOT EXISTS stock_adjustment_items (
    adjustment_item_id SERIAL PRIMARY KEY,

    adjustment_id INTEGER NOT NULL
        REFERENCES stock_adjustments(adjustment_id)
        ON DELETE CASCADE,

    product_id INTEGER NOT NULL
        REFERENCES products(product_id),

    quantity NUMERIC(15,3) NOT NULL,

    CONSTRAINT adjustment_quantity_positive
        CHECK(quantity > 0)
);


-- ============================================
-- INDEXES
-- ============================================

CREATE INDEX IF NOT EXISTS idx_products_sku
ON products(sku);

CREATE INDEX IF NOT EXISTS idx_products_name
ON products(product_name);

CREATE INDEX IF NOT EXISTS idx_stock_product
ON stock(product_id);

CREATE INDEX IF NOT EXISTS idx_stock_warehouse
ON stock(warehouse_id);

CREATE INDEX IF NOT EXISTS idx_adjustment_warehouse
ON stock_adjustments(warehouse_id);

CREATE INDEX IF NOT EXISTS idx_adjustment_items_product
ON stock_adjustment_items(product_id);