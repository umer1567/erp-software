ALTER TABLE public.purchase_quotations
    ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS deleted_by INTEGER;

CREATE INDEX IF NOT EXISTS idx_purchase_quotations_active_recycle
    ON public.purchase_quotations (company_id, purchase_quotation_id)
    WHERE deleted_at IS NULL;