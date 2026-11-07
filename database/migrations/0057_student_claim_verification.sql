-- AUTH-002 Student claim, scoped verification and claim-bound activation (record §5/§6A).
-- Identity owns claims, claim events and the claim-issued activation relation; Academic Core
-- owns roster identity bindings and Homeroom responsibilities. New tables are empty at
-- adoption: no backfill, no fuzzy match, no change to 0056 roster person_id or receipts.
BEGIN;
DO $migration$
BEGIN
    IF EXISTS (SELECT 1 FROM elligble_migration_history WHERE migration_id = '0057_student_claim_verification') THEN
        RETURN;
    END IF;

    CREATE TABLE identity_student_claims (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id uuid NOT NULL REFERENCES tenant_tenants(id) ON DELETE RESTRICT,
        request_key uuid NOT NULL,
        request_digest text NOT NULL CHECK (request_digest ~ '^[0-9a-f]{64}$'),
        submitted_name text NOT NULL CHECK (char_length(submitted_name) BETWEEN 1 AND 200),
        submitted_nisn text NOT NULL CHECK (char_length(submitted_nisn) BETWEEN 1 AND 64),
        submitted_birth date NOT NULL,
        roster_id uuid,
        roster_revision integer CHECK (roster_revision IS NULL OR roster_revision > 0),
        person_id uuid REFERENCES identity_persons(id) ON DELETE RESTRICT,
        state text NOT NULL CHECK (state IN ('PENDING_REVIEW','REVIEW_REQUIRED','APPROVED_PENDING_ACTIVATION',
            'APPROVED_EXISTING_ACCOUNT','REJECTED','CANCELLED','ACTIVATED','EXPIRED','EXHAUSTED','CLOSED_BY_REISSUE')),
        revision integer NOT NULL DEFAULT 1 CHECK (revision > 0),
        created_at timestamptz NOT NULL DEFAULT statement_timestamp(),
        expires_at timestamptz NOT NULL,
        closed_at timestamptz,
        UNIQUE (tenant_id, request_key),
        UNIQUE (id, tenant_id),
        CHECK (expires_at = created_at + interval '7 days'),
        CHECK ((roster_id IS NULL) = (roster_revision IS NULL)),
        CHECK ((closed_at IS NULL) = (state IN ('PENDING_REVIEW','REVIEW_REQUIRED','APPROVED_PENDING_ACTIVATION'))),
        CHECK (closed_at IS NULL OR closed_at >= created_at),
        CHECK (state NOT IN ('APPROVED_PENDING_ACTIVATION','APPROVED_EXISTING_ACCOUNT','ACTIVATED','EXHAUSTED','CLOSED_BY_REISSUE')
            OR (person_id IS NOT NULL AND roster_id IS NOT NULL))
    );
    -- At most one open claim per official roster identity and, once resolved, per Person.
    CREATE UNIQUE INDEX uq_identity_open_claim_roster ON identity_student_claims(tenant_id, roster_id)
        WHERE closed_at IS NULL AND roster_id IS NOT NULL;
    CREATE UNIQUE INDEX uq_identity_open_claim_person ON identity_student_claims(person_id)
        WHERE closed_at IS NULL AND person_id IS NOT NULL;
    CREATE INDEX ix_identity_claims_open_tenant ON identity_student_claims(tenant_id, created_at) WHERE closed_at IS NULL;

    CREATE TABLE identity_student_claim_events (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        claim_id uuid NOT NULL,
        tenant_id uuid NOT NULL,
        event text NOT NULL CHECK (event IN ('SUBMITTED','APPROVED','APPROVED_EXISTING_ACCOUNT','REJECTED','CANCELLED',
            'ACTIVATED','EXPIRED','EXHAUSTED','CLOSED_BY_REISSUE')),
        actor_kind text NOT NULL CHECK (actor_kind IN ('anonymous','homeroom','school_operator','system','student')),
        actor_person_id uuid REFERENCES identity_persons(id) ON DELETE RESTRICT,
        previous_revision integer CHECK (previous_revision IS NULL OR previous_revision > 0),
        resulting_revision integer NOT NULL CHECK (resulting_revision > 0),
        request_key uuid,
        request_digest text CHECK (request_digest IS NULL OR request_digest ~ '^[0-9a-f]{64}$'),
        adjudication text CHECK (adjudication IS NULL OR adjudication IN ('EXISTING_BINDING','EXISTING_ACCOUNT_CONTINUITY','NEW_IDENTITY_REVIEWED')),
        reason text CHECK (reason IS NULL OR char_length(btrim(reason)) BETWEEN 1 AND 200),
        roster_revision integer,
        occurred_at timestamptz NOT NULL DEFAULT statement_timestamp(),
        FOREIGN KEY (claim_id, tenant_id) REFERENCES identity_student_claims(id, tenant_id) ON DELETE RESTRICT,
        UNIQUE (claim_id, resulting_revision),
        CHECK ((previous_revision IS NULL) = (event = 'SUBMITTED')),
        CHECK (previous_revision IS NULL OR resulting_revision = previous_revision + 1),
        CHECK ((actor_kind IN ('homeroom','school_operator')) = (actor_person_id IS NOT NULL AND request_key IS NOT NULL AND request_digest IS NOT NULL)),
        CHECK (event NOT IN ('REJECTED','CANCELLED','APPROVED','APPROVED_EXISTING_ACCOUNT') OR actor_kind IN ('homeroom','school_operator')),
        CHECK (event NOT IN ('REJECTED','CANCELLED','APPROVED','APPROVED_EXISTING_ACCOUNT') OR reason IS NOT NULL),
        CHECK (event NOT IN ('APPROVED','APPROVED_EXISTING_ACCOUNT') OR adjudication IS NOT NULL)
    );
    -- One decision receipt per verifier request key (same-key replay returns it).
    CREATE UNIQUE INDEX uq_identity_claim_decision_key ON identity_student_claim_events(tenant_id, actor_person_id, request_key)
        WHERE request_key IS NOT NULL AND actor_person_id IS NOT NULL;

    -- The single activation row issued by an approval; every other code keeps ordinary semantics.
    CREATE TABLE identity_student_claim_activations (
        claim_id uuid PRIMARY KEY,
        tenant_id uuid NOT NULL,
        activation_id uuid NOT NULL UNIQUE REFERENCES identity_account_activations(id) ON DELETE RESTRICT,
        user_account_id uuid NOT NULL REFERENCES identity_user_accounts(id) ON DELETE RESTRICT,
        issued_at timestamptz NOT NULL DEFAULT statement_timestamp(),
        FOREIGN KEY (claim_id, tenant_id) REFERENCES identity_student_claims(id, tenant_id) ON DELETE RESTRICT
    );

    CREATE FUNCTION identity_claim_guard() RETURNS trigger LANGUAGE plpgsql AS $fn$
    BEGIN
        IF TG_OP = 'DELETE' THEN RAISE EXCEPTION 'Claim history is retained' USING ERRCODE = '23514'; END IF;
        IF ROW(NEW.id, NEW.tenant_id, NEW.request_key, NEW.request_digest, NEW.submitted_name, NEW.submitted_nisn,
               NEW.submitted_birth, NEW.created_at, NEW.expires_at)
           IS DISTINCT FROM ROW(OLD.id, OLD.tenant_id, OLD.request_key, OLD.request_digest, OLD.submitted_name, OLD.submitted_nisn,
               OLD.submitted_birth, OLD.created_at, OLD.expires_at)
           OR OLD.closed_at IS NOT NULL
           OR NEW.revision <> OLD.revision + 1
           OR (OLD.roster_id IS NOT NULL AND NEW.roster_id IS DISTINCT FROM OLD.roster_id)
           OR (OLD.person_id IS NOT NULL AND NEW.person_id IS DISTINCT FROM OLD.person_id) THEN
            RAISE EXCEPTION 'Claim identity, lifetime or terminal state is immutable' USING ERRCODE = '23514';
        END IF;
        RETURN NEW;
    END; $fn$;
    CREATE TRIGGER identity_claim_immutable BEFORE UPDATE OR DELETE ON identity_student_claims
        FOR EACH ROW EXECUTE FUNCTION identity_claim_guard();
    CREATE TRIGGER identity_claim_events_immutable BEFORE UPDATE OR DELETE ON identity_student_claim_events
        FOR EACH ROW EXECUTE FUNCTION identity_reject_mutation();
    CREATE TRIGGER identity_claim_activation_immutable BEFORE UPDATE OR DELETE ON identity_student_claim_activations
        FOR EACH ROW EXECUTE FUNCTION identity_reject_mutation();

    CREATE TABLE academic_core_roster_identity_bindings (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id uuid NOT NULL,
        roster_id uuid NOT NULL,
        person_id uuid NOT NULL REFERENCES identity_persons(id) ON DELETE RESTRICT,
        claim_id uuid NOT NULL,
        decided_by_person_id uuid NOT NULL REFERENCES identity_persons(id) ON DELETE RESTRICT,
        decision_event_id uuid NOT NULL UNIQUE REFERENCES identity_student_claim_events(id) ON DELETE RESTRICT,
        established_at timestamptz NOT NULL DEFAULT statement_timestamp(),
        FOREIGN KEY (roster_id, tenant_id) REFERENCES academic_core_student_roster_records(id, tenant_id) ON DELETE RESTRICT,
        FOREIGN KEY (claim_id, tenant_id) REFERENCES identity_student_claims(id, tenant_id) ON DELETE RESTRICT,
        UNIQUE (tenant_id, roster_id),
        UNIQUE (tenant_id, person_id),
        CHECK (person_id <> decided_by_person_id)
    );
    CREATE FUNCTION academic_core_roster_binding_guard() RETURNS trigger LANGUAGE plpgsql AS $fn$
    DECLARE recorded uuid;
    BEGIN
        IF TG_OP <> 'INSERT' THEN RAISE EXCEPTION 'Roster identity binding is immutable' USING ERRCODE = '23514'; END IF;
        SELECT person_id INTO recorded FROM academic_core_student_roster_records WHERE id = NEW.roster_id AND tenant_id = NEW.tenant_id;
        IF recorded IS NOT NULL AND recorded <> NEW.person_id THEN
            RAISE EXCEPTION 'Roster binding disagrees with recorded Person' USING ERRCODE = '23514';
        END IF;
        IF EXISTS (SELECT 1 FROM academic_core_student_roster_records WHERE tenant_id = NEW.tenant_id AND person_id = NEW.person_id AND id <> NEW.roster_id) THEN
            RAISE EXCEPTION 'Person already bound to another roster record' USING ERRCODE = '23514';
        END IF;
        RETURN NEW;
    END; $fn$;
    CREATE TRIGGER academic_core_roster_binding_identity BEFORE INSERT OR UPDATE OR DELETE ON academic_core_roster_identity_bindings
        FOR EACH ROW EXECUTE FUNCTION academic_core_roster_binding_guard();

    CREATE TABLE academic_core_homeroom_responsibilities (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id uuid NOT NULL,
        membership_id uuid NOT NULL,
        academic_year_id uuid NOT NULL,
        academic_period_id uuid NOT NULL,
        academic_group_id uuid NOT NULL,
        effective_from timestamptz NOT NULL DEFAULT statement_timestamp(),
        effective_until timestamptz,
        revoked_at timestamptz,
        FOREIGN KEY (membership_id, tenant_id) REFERENCES tenant_memberships(id, tenant_id) ON DELETE RESTRICT,
        FOREIGN KEY (academic_group_id, tenant_id, academic_year_id) REFERENCES academic_core_academic_groups(id, tenant_id, academic_year_id) ON DELETE RESTRICT,
        FOREIGN KEY (academic_period_id, tenant_id, academic_year_id) REFERENCES academic_core_academic_periods(id, tenant_id, academic_year_id) ON DELETE RESTRICT,
        UNIQUE (id, tenant_id),
        CHECK (effective_until IS NULL OR effective_until > effective_from),
        CHECK (revoked_at IS NULL OR revoked_at >= effective_from)
    );
    -- One active Homeroom responsibility per membership and period; no implied multiple roles.
    CREATE UNIQUE INDEX uq_academic_core_homeroom_active ON academic_core_homeroom_responsibilities(tenant_id, membership_id, academic_period_id)
        WHERE revoked_at IS NULL;
    CREATE TABLE academic_core_homeroom_responsibility_events (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id uuid NOT NULL REFERENCES tenant_tenants(id) ON DELETE RESTRICT,
        responsibility_id uuid NOT NULL,
        action text NOT NULL CHECK (action IN ('ASSIGN','REVOKE')),
        operator_label text NOT NULL CHECK (char_length(btrim(operator_label)) BETWEEN 1 AND 200),
        case_reference text NOT NULL CHECK (char_length(btrim(case_reference)) BETWEEN 1 AND 200),
        reason text NOT NULL CHECK (char_length(btrim(reason)) BETWEEN 1 AND 200),
        occurred_at timestamptz NOT NULL DEFAULT statement_timestamp(),
        FOREIGN KEY (responsibility_id, tenant_id) REFERENCES academic_core_homeroom_responsibilities(id, tenant_id) ON DELETE RESTRICT
    );
    CREATE FUNCTION academic_core_homeroom_guard() RETURNS trigger LANGUAGE plpgsql AS $fn$
    BEGIN
        IF TG_OP = 'DELETE' THEN RAISE EXCEPTION 'Homeroom history is retained' USING ERRCODE = '23514'; END IF;
        IF ROW(NEW.id, NEW.tenant_id, NEW.membership_id, NEW.academic_year_id, NEW.academic_period_id, NEW.academic_group_id,
               NEW.effective_from, NEW.effective_until)
           IS DISTINCT FROM ROW(OLD.id, OLD.tenant_id, OLD.membership_id, OLD.academic_year_id, OLD.academic_period_id, OLD.academic_group_id,
               OLD.effective_from, OLD.effective_until)
           OR OLD.revoked_at IS NOT NULL OR NEW.revoked_at IS NULL THEN
            RAISE EXCEPTION 'Homeroom responsibility may only be revoked once' USING ERRCODE = '23514';
        END IF;
        RETURN NEW;
    END; $fn$;
    CREATE TRIGGER academic_core_homeroom_identity BEFORE UPDATE OR DELETE ON academic_core_homeroom_responsibilities
        FOR EACH ROW EXECUTE FUNCTION academic_core_homeroom_guard();
    CREATE TRIGGER academic_core_homeroom_events_immutable BEFORE UPDATE OR DELETE ON academic_core_homeroom_responsibility_events
        FOR EACH ROW EXECUTE FUNCTION roster_append_only();

    INSERT INTO elligble_migration_history(migration_id) VALUES('0057_student_claim_verification');
END; $migration$;
COMMIT;
