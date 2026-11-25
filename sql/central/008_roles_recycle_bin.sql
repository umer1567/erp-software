BEGIN;

ALTER TABLE public.roles
    ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP WITHOUT TIME ZONE,
    ADD COLUMN IF NOT EXISTS deleted_by INTEGER;

CREATE INDEX IF NOT EXISTS idx_roles_active_company
    ON public.roles (company_id, role_id)
    WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS public.role_recycle_bin_items (
    recycle_bin_id BIGSERIAL PRIMARY KEY,
    company_id INTEGER NOT NULL,
    role_id INTEGER NOT NULL,
    module_key VARCHAR(100) NOT NULL DEFAULT 'roles',
    source_table VARCHAR(100) NOT NULL DEFAULT 'roles',
    record_label TEXT,
    deleted_by INTEGER,
    deleted_at TIMESTAMP WITHOUT TIME ZONE
        NOT NULL DEFAULT CURRENT_TIMESTAMP,
    deletion_reason TEXT,
    record_snapshot JSONB NOT NULL DEFAULT '{}'::JSONB,
    relationship_snapshot JSONB NOT NULL DEFAULT '[]'::JSONB,
    CONSTRAINT uq_role_recycle_bin_role
        UNIQUE (company_id, role_id)
);

CREATE INDEX IF NOT EXISTS idx_role_recycle_bin_company_deleted
    ON public.role_recycle_bin_items (company_id, deleted_at DESC);

CREATE INDEX IF NOT EXISTS idx_role_recycle_bin_role
    ON public.role_recycle_bin_items (role_id);

COMMIT;
