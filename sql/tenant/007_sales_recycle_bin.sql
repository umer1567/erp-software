-- =========================================================
-- 007: SALES MODULE RECYCLE BIN
-- =========================================================

ALTER TABLE public.sales_quotations
    ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS deleted_by INTEGER;

ALTER TABLE public.sales_orders
    ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS deleted_by INTEGER;

ALTER TABLE public.delivery_challans
    ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS deleted_by INTEGER;

ALTER TABLE public.sales_returns
    ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS deleted_by INTEGER;

CREATE INDEX IF NOT EXISTS idx_sales_quotations_active_company
    ON public.sales_quotations (company_id, quotation_id)
    WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_sales_orders_active_company
    ON public.sales_orders (company_id, order_id)
    WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_delivery_challans_active_company
    ON public.delivery_challans (company_id, delivery_challan_id)
    WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_sales_returns_active_company
    ON public.sales_returns (company_id, return_id)
    WHERE deleted_at IS NULL;
