-- Migration 0039: Identity account activation
-- Purpose: provisioned accounts start activation-required and become usable only when the
-- person sets their own password with a single-use, short-lived activation code
-- (D02.3-09/10, D02.5-04/05, D02.7-37..41). Codes are stored only as verifiers; a reissue
-- revokes the previous code; an activation is closed exactly once (consumed or revoked).
-- Ownership: Identity & Access.

BEGIN;

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM elligble_migration_history WHERE migration_id = '0039_identity_account_activation') THEN
        RAISE NOTICE 'Migration 0039_identity_account_activation already applied. Skipping.';
        RETURN;
    END IF;

    CREATE TABLE public.identity_account_activations (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_account_id UUID NOT NULL,
        code_verifier VARCHAR(255) NOT NULL,
        issued_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
        expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
        failed_attempts INTEGER NOT NULL DEFAULT 0,
        consumed_at TIMESTAMP WITH TIME ZONE NULL,
        revoked_at TIMESTAMP WITH TIME ZONE NULL,
        CONSTRAINT fk_identity_activation_account FOREIGN KEY (user_account_id)
            REFERENCES public.identity_user_accounts (id) ON DELETE RESTRICT,
        CONSTRAINT ck_identity_activation_window CHECK (expires_at > issued_at),
        CONSTRAINT ck_identity_activation_attempts CHECK (failed_attempts >= 0),
        CONSTRAINT ck_identity_activation_closed_once CHECK (NOT (consumed_at IS NOT NULL AND revoked_at IS NOT NULL))
    );

    CREATE UNIQUE INDEX uq_identity_activation_open
        ON public.identity_account_activations (user_account_id)
        WHERE consumed_at IS NULL AND revoked_at IS NULL;

    INSERT INTO elligble_migration_history (migration_id) VALUES ('0039_identity_account_activation');
END $$;

COMMIT;
