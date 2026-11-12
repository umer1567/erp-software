CREATE TABLE IF NOT EXISTS user_sessions (
    session_id UUID PRIMARY KEY,
    user_id BIGINT NOT NULL,
    company_id BIGINT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    last_activity_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMPTZ NOT NULL,
    revoked_at TIMESTAMPTZ,
    ip_address TEXT,
    user_agent TEXT
);

CREATE INDEX IF NOT EXISTS idx_user_sessions_user
ON user_sessions (user_id, company_id);

CREATE INDEX IF NOT EXISTS idx_user_sessions_expiry
ON user_sessions (expires_at);

CREATE INDEX IF NOT EXISTS idx_user_sessions_activity
ON user_sessions (last_activity_at);