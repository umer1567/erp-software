ALTER TABLE public.procurement_requisitions
    ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS deleted_by INTEGER;

CREATE INDEX IF NOT EXISTS idx_procurement_requisitions_active_recycle
    ON public.procurement_requisitions (
        company_id,
        procurement_requisition_id
    )
    WHERE deleted_at IS NULL;