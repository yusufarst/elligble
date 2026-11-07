-- AUTH-003 in-person school-assisted recovery (record §5/§6A). Identity-owned single-use
-- recovery codes: fifteen minutes from server issuance, ten failures, one open code per
-- Account. The row is the attributable audit record; it never holds the plain code, NISN or
-- birth date. Empty at adoption: no backfill, no change to activation, claim or roster data.
BEGIN;
DO $migration$
BEGIN
    IF EXISTS (SELECT 1 FROM elligble_migration_history WHERE migration_id = '0058_student_account_recovery') THEN
        RETURN;
    END IF;

    CREATE TABLE identity_account_recovery_codes (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id uuid NOT NULL REFERENCES tenant_tenants(id) ON DELETE RESTRICT,
        user_account_id uuid NOT NULL,
        person_id uuid NOT NULL,
        roster_id uuid NOT NULL,
        issuer_person_id uuid NOT NULL REFERENCES identity_persons(id) ON DELETE RESTRICT,
        issuer_kind text NOT NULL CHECK (issuer_kind IN ('school_operator','homeroom')),
        reason text NOT NULL CHECK (char_length(btrim(reason)) BETWEEN 1 AND 200),
        request_key uuid NOT NULL,
        request_digest text NOT NULL CHECK (request_digest ~ '^[0-9a-f]{64}$'),
        code_verifier text NOT NULL,
        issued_at timestamptz NOT NULL DEFAULT statement_timestamp(),
        expires_at timestamptz NOT NULL,
        failed_attempts integer NOT NULL DEFAULT 0 CHECK (failed_attempts BETWEEN 0 AND 10),
        consumed_at timestamptz,
        revoked_at timestamptz,
        revoke_kind text CHECK (revoke_kind IN ('FAILED_ATTEMPTS','SUPERSEDED','REPLACED_BY_ACTIVATION')),
        FOREIGN KEY (user_account_id, person_id) REFERENCES identity_user_accounts(id, person_id) ON DELETE RESTRICT,
        FOREIGN KEY (roster_id, tenant_id) REFERENCES academic_core_student_roster_records(id, tenant_id) ON DELETE RESTRICT,
        UNIQUE (tenant_id, issuer_person_id, request_key),
        CHECK (expires_at = issued_at + interval '15 minutes'),
        CHECK (NOT (consumed_at IS NOT NULL AND revoked_at IS NOT NULL)),
        CHECK ((revoked_at IS NULL) = (revoke_kind IS NULL)),
        CHECK (revoke_kind IS DISTINCT FROM 'FAILED_ATTEMPTS' OR failed_attempts = 10),
        CHECK (consumed_at IS NULL OR consumed_at >= issued_at),
        CHECK (revoked_at IS NULL OR revoked_at >= issued_at),
        CHECK (person_id <> issuer_person_id)
    );
    CREATE UNIQUE INDEX uq_identity_open_recovery_code ON identity_account_recovery_codes(user_account_id)
        WHERE consumed_at IS NULL AND revoked_at IS NULL;
    CREATE INDEX ix_identity_recovery_account ON identity_account_recovery_codes(user_account_id, issued_at DESC);

    CREATE FUNCTION identity_recovery_code_guard() RETURNS trigger LANGUAGE plpgsql AS $fn$
    BEGIN
        IF TG_OP = 'DELETE' THEN RAISE EXCEPTION 'Recovery history is retained' USING ERRCODE = '23514'; END IF;
        IF ROW(NEW.id, NEW.tenant_id, NEW.user_account_id, NEW.person_id, NEW.roster_id, NEW.issuer_person_id, NEW.issuer_kind,
               NEW.reason, NEW.request_key, NEW.request_digest, NEW.code_verifier, NEW.issued_at, NEW.expires_at)
           IS DISTINCT FROM ROW(OLD.id, OLD.tenant_id, OLD.user_account_id, OLD.person_id, OLD.roster_id, OLD.issuer_person_id, OLD.issuer_kind,
               OLD.reason, OLD.request_key, OLD.request_digest, OLD.code_verifier, OLD.issued_at, OLD.expires_at)
           OR OLD.consumed_at IS NOT NULL OR OLD.revoked_at IS NOT NULL
           OR NEW.failed_attempts NOT IN (OLD.failed_attempts, OLD.failed_attempts + 1) THEN
            RAISE EXCEPTION 'Recovery code identity, lifetime or closed state is immutable' USING ERRCODE = '23514';
        END IF;
        RETURN NEW;
    END; $fn$;
    CREATE TRIGGER identity_recovery_code_immutable BEFORE UPDATE OR DELETE ON identity_account_recovery_codes
        FOR EACH ROW EXECUTE FUNCTION identity_recovery_code_guard();

    INSERT INTO elligble_migration_history(migration_id) VALUES('0058_student_account_recovery');
END; $migration$;
COMMIT;
