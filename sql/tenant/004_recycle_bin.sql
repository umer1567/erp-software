-- Recycle Bin registry for this company's operational database.
-- Original business records remain in their original tables.

CREATE TABLE IF NOT EXISTS public.recycle_bin_items (
    recycle_bin_id BIGSERIAL PRIMARY KEY,

    company_id INTEGER NOT NULL,

    module_key VARCHAR(100) NOT NULL,
    source_table VARCHAR(100) NOT NULL,
    source_record_id TEXT NOT NULL,

    record_label TEXT,

    deleted_by INTEGER,
    deleted_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    deletion_reason TEXT,

    record_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
    relationship_snapshot JSONB NOT NULL DEFAULT '[]'::jsonb,

    CONSTRAINT recycle_bin_items_snapshot_object_check
        CHECK (jsonb_typeof(record_snapshot) = 'object'),

    CONSTRAINT recycle_bin_items_relationship_array_check
        CHECK (jsonb_typeof(relationship_snapshot) = 'array'),

    CONSTRAINT recycle_bin_items_source_record_unique
        UNIQUE (company_id, source_table, source_record_id)
);

CREATE INDEX IF NOT EXISTS idx_recycle_bin_items_deleted_at
    ON public.recycle_bin_items (deleted_at DESC);

CREATE INDEX IF NOT EXISTS idx_recycle_bin_items_module
    ON public.recycle_bin_items (module_key);

CREATE INDEX IF NOT EXISTS idx_recycle_bin_items_source
    ON public.recycle_bin_items (source_table, source_record_id);

CREATE INDEX IF NOT EXISTS idx_recycle_bin_items_company
    ON public.recycle_bin_items (company_id);