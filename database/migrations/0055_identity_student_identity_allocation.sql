-- Identity-owned canonical account/identifier foundation. No academic/tenant writes.
BEGIN;
DO $migration$
BEGIN
    IF EXISTS (SELECT 1 FROM elligble_migration_history WHERE migration_id = '0055_identity_student_identity_allocation') THEN
        RETURN;
    END IF;

    LOCK TABLE identity_user_accounts, identity_account_credentials IN SHARE ROW EXCLUSIVE MODE;
    IF EXISTS (
        SELECT a.person_id FROM identity_user_accounts a
        LEFT JOIN identity_account_credentials c ON c.user_account_id = a.id
        GROUP BY a.person_id
        HAVING count(*) FILTER (WHERE c.is_valid) > 1
            OR (count(*) FILTER (WHERE c.is_valid) = 0 AND count(*) > 1)
    ) THEN RAISE EXCEPTION 'Ambiguous canonical identity history' USING ERRCODE = '23514'; END IF;

    CREATE FUNCTION identity_identifier_key(value text) RETURNS text
    LANGUAGE sql IMMUTABLE STRICT AS $fn$
        SELECT CASE WHEN translate(value, 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz')
            ~ '^elg-[abcdefghjkmnpqrstuvwxyz23456789]{4}-[abcdefghjkmnpqrstuvwxyz23456789]{4}-[abcdefghjkmnpqrstuvwxyz23456789]{4}$'
            THEN translate(value, 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz') ELSE value END
    $fn$;

    IF EXISTS (SELECT identity_identifier_key(username) FROM identity_account_credentials
        GROUP BY identity_identifier_key(username) HAVING count(*) > 1)
    THEN RAISE EXCEPTION 'Conflicting legacy identifier namespace' USING ERRCODE = '23514'; END IF;

    ALTER TABLE identity_user_accounts ADD CONSTRAINT uq_identity_account_person UNIQUE(id, person_id);
    CREATE TABLE identity_person_account_bindings (
        person_id uuid PRIMARY KEY REFERENCES identity_persons(id) ON DELETE RESTRICT,
        canonical_account_id uuid NOT NULL UNIQUE,
        source text NOT NULL CHECK (source IN ('migration','provisioning','allocation')),
        established_at timestamptz NOT NULL DEFAULT statement_timestamp(),
        UNIQUE(person_id, canonical_account_id),
        FOREIGN KEY(canonical_account_id, person_id) REFERENCES identity_user_accounts(id, person_id) ON DELETE RESTRICT
    );
    INSERT INTO identity_person_account_bindings(person_id, canonical_account_id, source)
    SELECT a.person_id, a.id, 'migration' FROM identity_user_accounts a
    LEFT JOIN identity_account_credentials c ON c.user_account_id = a.id
    WHERE c.is_valid OR NOT EXISTS (
        SELECT 1 FROM identity_user_accounts other
        JOIN identity_account_credentials valid ON valid.user_account_id = other.id AND valid.is_valid
        WHERE other.person_id = a.person_id
    );

    CREATE TABLE identity_login_identifiers (
        identifier_key text PRIMARY KEY,
        original_username text NOT NULL CHECK (char_length(original_username) BETWEEN 1 AND 255),
        user_account_id uuid NOT NULL,
        person_id uuid NOT NULL,
        origin text NOT NULL CHECK (origin IN ('LEGACY','GENERATED')),
        allocated_at timestamptz NOT NULL DEFAULT statement_timestamp(),
        CHECK(identifier_key = identity_identifier_key(original_username)),
        CHECK(origin <> 'GENERATED' OR original_username ~ '^elg-[abcdefghjkmnpqrstuvwxyz23456789]{4}-[abcdefghjkmnpqrstuvwxyz23456789]{4}-[abcdefghjkmnpqrstuvwxyz23456789]{4}$'),
        UNIQUE(original_username, user_account_id, person_id),
        UNIQUE(identifier_key, user_account_id, person_id),
        FOREIGN KEY(user_account_id, person_id) REFERENCES identity_user_accounts(id, person_id) ON DELETE RESTRICT
    );
    INSERT INTO identity_login_identifiers(identifier_key, original_username, user_account_id, person_id, origin)
    SELECT identity_identifier_key(c.username), c.username, c.user_account_id, a.person_id, 'LEGACY'
    FROM identity_account_credentials c JOIN identity_user_accounts a ON a.id = c.user_account_id;

    ALTER TABLE identity_account_credentials ADD COLUMN person_id uuid;
    UPDATE identity_account_credentials c SET person_id = a.person_id FROM identity_user_accounts a WHERE a.id = c.user_account_id;
    ALTER TABLE identity_account_credentials ALTER COLUMN person_id SET NOT NULL;
    ALTER TABLE identity_account_credentials ADD COLUMN valid_account_id uuid GENERATED ALWAYS AS
        (CASE WHEN is_valid THEN user_account_id ELSE NULL END) STORED;
    ALTER TABLE identity_account_credentials ADD CONSTRAINT fk_identity_credential_person
        FOREIGN KEY(user_account_id, person_id) REFERENCES identity_user_accounts(id, person_id) ON DELETE RESTRICT;
    ALTER TABLE identity_account_credentials ADD CONSTRAINT fk_identity_valid_canonical
        FOREIGN KEY(person_id, valid_account_id) REFERENCES identity_person_account_bindings(person_id, canonical_account_id)
        DEFERRABLE INITIALLY DEFERRED;
    ALTER TABLE identity_account_credentials ADD CONSTRAINT fk_identity_credential_identifier
        FOREIGN KEY(username, user_account_id, person_id)
        REFERENCES identity_login_identifiers(original_username, user_account_id, person_id) ON DELETE RESTRICT;
    CREATE UNIQUE INDEX uq_identity_valid_person ON identity_account_credentials(person_id) WHERE is_valid;

    CREATE TABLE identity_student_claim_reservations (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        person_id uuid NOT NULL REFERENCES identity_persons(id) ON DELETE RESTRICT,
        tenant_id uuid NOT NULL,
        created_at timestamptz NOT NULL DEFAULT statement_timestamp(),
        expires_at timestamptz NOT NULL,
        closed_at timestamptz,
        closure_kind text CHECK(closure_kind IN ('expired','allocated','cancelled')),
        CHECK(expires_at > created_at),
        CHECK((closed_at IS NULL) = (closure_kind IS NULL)),
        CHECK(closed_at IS NULL OR closed_at >= created_at)
    );
    CREATE UNIQUE INDEX uq_identity_open_reservation ON identity_student_claim_reservations(person_id) WHERE closed_at IS NULL;
    CREATE TABLE identity_id_allocation_events (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        operation text NOT NULL CHECK(operation = 'allocate'),
        actor_kind text NOT NULL CHECK(actor_kind IN ('platform_operator','authenticated_person')),
        actor_ref text NOT NULL CHECK(char_length(actor_ref) BETWEEN 1 AND 200),
        tenant_id uuid NOT NULL,
        request_key uuid NOT NULL,
        protocol_version smallint NOT NULL DEFAULT 1 CHECK(protocol_version = 1),
        request_digest text NOT NULL CHECK(request_digest ~ '^[0-9a-f]{64}$'),
        person_id uuid NOT NULL,
        user_account_id uuid NOT NULL,
        identifier_key text NOT NULL REFERENCES identity_login_identifiers(identifier_key) ON DELETE RESTRICT,
        outcome text NOT NULL CHECK(outcome IN ('allocated','existing')),
        occurred_at timestamptz NOT NULL DEFAULT statement_timestamp(),
        UNIQUE(actor_kind, actor_ref, operation, request_key),
        FOREIGN KEY(identifier_key, user_account_id, person_id)
            REFERENCES identity_login_identifiers(identifier_key, user_account_id, person_id) ON DELETE RESTRICT,
        FOREIGN KEY(user_account_id, person_id) REFERENCES identity_user_accounts(id, person_id) ON DELETE RESTRICT
    );

    CREATE FUNCTION identity_reject_mutation() RETURNS trigger LANGUAGE plpgsql AS $fn$
    BEGIN RAISE EXCEPTION 'Immutable Identity history' USING ERRCODE = '23514'; END; $fn$;
    CREATE TRIGGER identity_binding_immutable BEFORE UPDATE OR DELETE ON identity_person_account_bindings
        FOR EACH ROW EXECUTE FUNCTION identity_reject_mutation();
    CREATE TRIGGER identity_identifier_immutable BEFORE UPDATE OR DELETE ON identity_login_identifiers
        FOR EACH ROW EXECUTE FUNCTION identity_reject_mutation();
    CREATE TRIGGER identity_allocation_immutable BEFORE UPDATE OR DELETE ON identity_id_allocation_events
        FOR EACH ROW EXECUTE FUNCTION identity_reject_mutation();
    CREATE FUNCTION identity_protect_account() RETURNS trigger LANGUAGE plpgsql AS $fn$
    BEGIN
        IF NEW.id IS DISTINCT FROM OLD.id OR NEW.person_id IS DISTINCT FROM OLD.person_id THEN
            RAISE EXCEPTION 'Account ownership is immutable' USING ERRCODE = '23514';
        END IF;
        RETURN NEW;
    END; $fn$;
    CREATE TRIGGER identity_account_owner BEFORE UPDATE ON identity_user_accounts
        FOR EACH ROW EXECUTE FUNCTION identity_protect_account();

    CREATE FUNCTION identity_guard_reservation() RETURNS trigger LANGUAGE plpgsql AS $fn$
    BEGIN
        PERFORM 1 FROM identity_persons WHERE id = NEW.person_id FOR NO KEY UPDATE;
        IF TG_OP = 'UPDATE' THEN
            IF NEW.id <> OLD.id OR NEW.person_id <> OLD.person_id OR NEW.tenant_id <> OLD.tenant_id
                OR NEW.created_at <> OLD.created_at OR NEW.expires_at <> OLD.expires_at OR OLD.closed_at IS NOT NULL
            THEN RAISE EXCEPTION 'Reservation ownership/lifetime is immutable' USING ERRCODE = '23514'; END IF;
        END IF;
        IF NEW.closed_at IS NULL AND EXISTS (SELECT 1 FROM identity_person_account_bindings WHERE person_id = NEW.person_id) THEN
            RAISE EXCEPTION 'Canonical account already exists' USING ERRCODE = '23514';
        END IF;
        RETURN NEW;
    END; $fn$;
    CREATE TRIGGER identity_reservation_guard BEFORE INSERT OR UPDATE ON identity_student_claim_reservations
        FOR EACH ROW EXECUTE FUNCTION identity_guard_reservation();
    CREATE TRIGGER identity_reservation_no_delete BEFORE DELETE ON identity_student_claim_reservations
        FOR EACH ROW EXECUTE FUNCTION identity_reject_mutation();

    CREATE FUNCTION identity_guard_binding() RETURNS trigger LANGUAGE plpgsql AS $fn$
    BEGIN
        PERFORM 1 FROM identity_persons WHERE id = NEW.person_id FOR NO KEY UPDATE;
        IF EXISTS (SELECT 1 FROM identity_user_accounts WHERE person_id = NEW.person_id AND id <> NEW.canonical_account_id) THEN
            RAISE EXCEPTION 'Ambiguous first canonical account' USING ERRCODE = '23514';
        END IF;
        IF EXISTS (SELECT 1 FROM identity_student_claim_reservations WHERE person_id = NEW.person_id AND closed_at IS NULL) THEN
            RAISE EXCEPTION 'Close authorized reservation before binding' USING ERRCODE = '23514';
        END IF;
        RETURN NEW;
    END; $fn$;
    CREATE TRIGGER identity_binding_guard BEFORE INSERT ON identity_person_account_bindings
        FOR EACH ROW EXECUTE FUNCTION identity_guard_binding();

    CREATE FUNCTION identity_credential_insert() RETURNS trigger LANGUAGE plpgsql AS $fn$
    DECLARE subject uuid; canonical uuid; entry identity_login_identifiers%ROWTYPE;
    BEGIN
        SELECT person_id INTO STRICT subject FROM identity_user_accounts WHERE id = NEW.user_account_id;
        IF NEW.person_id IS NOT NULL AND NEW.person_id <> subject THEN
            RAISE EXCEPTION 'Credential Person mismatch' USING ERRCODE = '23514';
        END IF;
        PERFORM 1 FROM identity_persons WHERE id = subject FOR NO KEY UPDATE;
        SELECT canonical_account_id INTO canonical FROM identity_person_account_bindings WHERE person_id = subject;
        IF canonical IS NULL THEN
            IF EXISTS (SELECT 1 FROM identity_user_accounts WHERE person_id = subject AND id <> NEW.user_account_id) THEN
                RAISE EXCEPTION 'Ambiguous account allocation' USING ERRCODE = '23514';
            END IF;
            INSERT INTO identity_person_account_bindings(person_id, canonical_account_id, source)
                VALUES(subject, NEW.user_account_id, 'provisioning');
        ELSIF canonical <> NEW.user_account_id THEN
            RAISE EXCEPTION 'Noncanonical credential allocation' USING ERRCODE = '23514';
        END IF;
        INSERT INTO identity_login_identifiers(identifier_key, original_username, user_account_id, person_id, origin)
            VALUES(identity_identifier_key(NEW.username), NEW.username, NEW.user_account_id, subject, 'LEGACY') ON CONFLICT DO NOTHING;
        SELECT * INTO STRICT entry FROM identity_login_identifiers WHERE identifier_key = identity_identifier_key(NEW.username);
        IF entry.original_username <> NEW.username OR entry.user_account_id <> NEW.user_account_id OR entry.person_id <> subject THEN
            RAISE EXCEPTION 'Identifier ownership conflict' USING ERRCODE = '23505';
        END IF;
        NEW.person_id := subject;
        RETURN NEW;
    END; $fn$;
    CREATE TRIGGER identity_credential_compatibility BEFORE INSERT ON identity_account_credentials
        FOR EACH ROW EXECUTE FUNCTION identity_credential_insert();
    CREATE FUNCTION identity_credential_immutable() RETURNS trigger LANGUAGE plpgsql AS $fn$
    BEGIN
        IF TG_OP = 'DELETE' THEN RAISE EXCEPTION 'Credential identity is retained' USING ERRCODE = '23514'; END IF;
        IF NEW.person_id <> OLD.person_id OR NEW.user_account_id <> OLD.user_account_id OR NEW.username <> OLD.username THEN
            RAISE EXCEPTION 'Credential identity is immutable' USING ERRCODE = '23514';
        END IF;
        RETURN NEW;
    END; $fn$;
    CREATE TRIGGER identity_credential_owner BEFORE UPDATE OR DELETE ON identity_account_credentials
        FOR EACH ROW EXECUTE FUNCTION identity_credential_immutable();

    CREATE FUNCTION identity_validate_insert_effect() RETURNS trigger LANGUAGE plpgsql AS $fn$
    BEGIN
        IF TG_TABLE_NAME = 'identity_login_identifiers' THEN
            IF NOT EXISTS(SELECT 1 FROM identity_account_credentials WHERE user_account_id = NEW.user_account_id
                AND person_id = NEW.person_id AND username = NEW.original_username) THEN
                RAISE EXCEPTION 'Identifier without matching credential' USING ERRCODE = '23514';
            END IF;
        ELSE
            IF NOT EXISTS(SELECT 1 FROM identity_account_credentials WHERE user_account_id = NEW.canonical_account_id AND person_id = NEW.person_id) THEN
                RAISE EXCEPTION 'Binding without matching credential' USING ERRCODE = '23514';
            END IF;
        END IF;
        RETURN NULL;
    END; $fn$;
    CREATE CONSTRAINT TRIGGER identity_identifier_complete AFTER INSERT ON identity_login_identifiers
        DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION identity_validate_insert_effect();
    CREATE CONSTRAINT TRIGGER identity_binding_complete AFTER INSERT ON identity_person_account_bindings
        DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION identity_validate_insert_effect();

    INSERT INTO elligble_migration_history(migration_id) VALUES('0055_identity_student_identity_allocation');
END; $migration$;
COMMIT;
