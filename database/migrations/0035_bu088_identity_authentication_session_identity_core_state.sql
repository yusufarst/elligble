-- Migration 0035: BU-088 Identity Authentication and Session Identity Runtime Foundation Bootstrap
-- Purpose: Minimum Identity-owned real authentication and server-authoritative Session Identity

BEGIN;

-- Check for safe repeat invocation
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM elligble_migration_history WHERE migration_id = '0035_bu088_identity_authentication_session_identity_core_state') THEN
        RAISE NOTICE 'Migration 0035 already applied. Skipping.';
        RETURN;
    END IF;

    -- 1. Authentication Credentials
    -- Ownership: Identity
    -- Enforces: ELLIGBLE ID / username uniqueness, failed attempts timeline, lockouts
    CREATE TABLE IF NOT EXISTS identity_account_credentials (
        user_account_id UUID PRIMARY KEY,
        username VARCHAR(255) NOT NULL UNIQUE,
        password_verifier VARCHAR(255) NOT NULL,
        is_valid BOOLEAN NOT NULL DEFAULT TRUE,
        failed_attempts_timeline JSONB NOT NULL DEFAULT '[]'::jsonb,
        consecutive_failures_count INT NOT NULL DEFAULT 0,
        locked_until TIMESTAMP WITH TIME ZONE,
        last_successful_login_at TIMESTAMP WITH TIME ZONE,
        created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT fk_identity_account_credentials_account FOREIGN KEY (user_account_id) REFERENCES identity_user_accounts (id) ON DELETE RESTRICT
    );

    CREATE INDEX IF NOT EXISTS idx_identity_account_credentials_username ON identity_account_credentials (username);

    -- 2. Session Identity
    -- Ownership: Identity
    -- Enforces: Server-authoritative session, absolute expiry, idle expiry
    CREATE TABLE IF NOT EXISTS identity_sessions (
        id UUID PRIMARY KEY,
        user_account_id UUID NOT NULL,
        session_secret_verifier VARCHAR(255) NOT NULL,
        is_revoked BOOLEAN NOT NULL DEFAULT FALSE,
        authenticated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
        expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
        last_activity_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT fk_identity_sessions_account FOREIGN KEY (user_account_id) REFERENCES identity_user_accounts (id) ON DELETE RESTRICT
    );

    CREATE INDEX IF NOT EXISTS idx_identity_sessions_account_id ON identity_sessions (user_account_id);

    -- Record migration application
    INSERT INTO elligble_migration_history (migration_id) VALUES ('0035_bu088_identity_authentication_session_identity_core_state');
END $$;

COMMIT;
