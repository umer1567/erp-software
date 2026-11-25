ALTER TABLE public.rfqs
    ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS deleted_by INTEGER;

CREATE INDEX IF NOT EXISTS idx_rfqs_active_recycle
    ON public.rfqs (company_id, rfq_id)
    WHERE deleted_at IS NULL;