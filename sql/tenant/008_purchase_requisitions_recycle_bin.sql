ALTER TABLE public.purchase_requisitions
    ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS deleted_by INTEGER;

CREATE INDEX IF NOT EXISTS idx_purchase_requisitions_active_recycle
    ON public.purchase_requisitions (company_id, requisition_id)
    WHERE deleted_at IS NULL;