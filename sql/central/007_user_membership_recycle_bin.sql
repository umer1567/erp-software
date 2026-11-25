BEGIN;

-- Add archive metadata to company memberships.
ALTER TABLE public.user_companies
    ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP NULL,
    ADD COLUMN IF NOT EXISTS deleted_by INTEGER NULL;

-- Store archived company memberships.
CREATE TABLE IF NOT EXISTS public.user_company_recycle_bin_items (
    recycle_bin_id BIGSERIAL PRIMARY KEY,

    company_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,

    module_key VARCHAR(100) NOT NULL,
    source_table VARCHAR(100) NOT NULL,
    record_label TEXT NOT NULL,

    deleted_by INTEGER NOT NULL,
    deleted_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    deletion_reason TEXT,

    record_snapshot JSONB NOT NULL DEFAULT '{}'::JSONB,
    relationship_snapshot JSONB NOT NULL DEFAULT '[]'::JSONB
);

-- A membership can have only one active archive entry.
CREATE UNIQUE INDEX IF NOT EXISTS
    uq_user_company_recycle_bin_membership
ON public.user_company_recycle_bin_items (
    company_id,
    user_id
);

-- Support company-specific recycle-bin lookups.
CREATE INDEX IF NOT EXISTS
    idx_user_company_recycle_bin_company_deleted
ON public.user_company_recycle_bin_items (
    company_id,
    deleted_at DESC
);

CREATE INDEX IF NOT EXISTS
    idx_user_company_recycle_bin_module
ON public.user_company_recycle_bin_items (
    company_id,
    module_key
);

-- Support active membership queries.
CREATE INDEX IF NOT EXISTS
    idx_user_companies_active_memberships
ON public.user_companies (
    company_id,
    user_id
)
WHERE deleted_at IS NULL;

COMMIT;
