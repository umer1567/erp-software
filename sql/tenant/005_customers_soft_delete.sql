ALTER TABLE public.customers
    ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS deleted_by INTEGER;

CREATE INDEX IF NOT EXISTS idx_customers_deleted_at
    ON public.customers (deleted_at)
    WHERE deleted_at IS NOT NULL;