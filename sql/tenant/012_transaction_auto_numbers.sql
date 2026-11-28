-- Transaction Auto Number configuration and counters.
-- Applied separately to each company tenant database.

CREATE TABLE IF NOT EXISTS public.transaction_auto_number_configs (
    config_id BIGSERIAL PRIMARY KEY,
    company_id INTEGER NOT NULL,
    transaction_type VARCHAR(60) NOT NULL,
    form_type VARCHAR(40) NOT NULL DEFAULT 'STANDARD',
    prefix VARCHAR(50) NOT NULL DEFAULT '',
    number_length INTEGER NOT NULL DEFAULT 6
        CHECK (number_length BETWEEN 1 AND 20),
    starting_number BIGINT,
    subsidiary VARCHAR(255),
    location VARCHAR(255),
    department VARCHAR(255),
    year_wise BOOLEAN NOT NULL DEFAULT FALSE,
    month_wise BOOLEAN NOT NULL DEFAULT FALSE,
    auto_number_format VARCHAR(255) NOT NULL DEFAULT '#PREFIX##NUMBER#',
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT transaction_auto_number_config_unique
        UNIQUE (company_id, transaction_type, form_type)
);

CREATE TABLE IF NOT EXISTS public.transaction_auto_number_counters (
    counter_id BIGSERIAL PRIMARY KEY,
    company_id INTEGER NOT NULL,
    transaction_type VARCHAR(60) NOT NULL,
    form_type VARCHAR(40) NOT NULL DEFAULT 'STANDARD',
    subsidiary VARCHAR(255) NOT NULL DEFAULT '',
    location VARCHAR(255) NOT NULL DEFAULT '',
    department VARCHAR(255) NOT NULL DEFAULT '',
    period_year INTEGER NOT NULL DEFAULT 0,
    period_month INTEGER NOT NULL DEFAULT 0,
    last_number BIGINT NOT NULL DEFAULT 0 CHECK (last_number >= 0),
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT transaction_auto_number_counter_unique UNIQUE (
        company_id,
        transaction_type,
        form_type,
        subsidiary,
        location,
        department,
        period_year,
        period_month
    )
);

-- Correct the existing BOM schema/API mismatch.
ALTER TABLE public.bill_of_materials
    ADD COLUMN IF NOT EXISTS bom_number VARCHAR(50);

-- Preserve existing BOM records and assign stable numbers based on their IDs.
UPDATE public.bill_of_materials
SET bom_number = 'BOM-' || LPAD(bom_id::TEXT, 6, '0')
WHERE bom_number IS NULL OR BTRIM(bom_number) = '';

CREATE UNIQUE INDEX IF NOT EXISTS bill_of_materials_company_number_unique
    ON public.bill_of_materials (company_id, bom_number);

ALTER TABLE public.bill_of_materials
    ALTER COLUMN bom_number SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_transaction_auto_number_configs_company
    ON public.transaction_auto_number_configs (company_id);

CREATE INDEX IF NOT EXISTS idx_transaction_auto_number_counters_company
    ON public.transaction_auto_number_counters (company_id);
