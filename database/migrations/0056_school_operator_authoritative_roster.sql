BEGIN;
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM elligble_migration_history WHERE migration_id = '0056_school_operator_authoritative_roster') THEN RETURN; END IF;
    CREATE TABLE tenant_school_operator_assignments (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id UUID NOT NULL, membership_id UUID NOT NULL,
        assigned_at TIMESTAMPTZ NOT NULL DEFAULT statement_timestamp(), revoked_at TIMESTAMPTZ,
        FOREIGN KEY (membership_id, tenant_id) REFERENCES tenant_memberships(id, tenant_id) ON DELETE RESTRICT,
        UNIQUE(id,tenant_id),
        CHECK (revoked_at IS NULL OR revoked_at >= assigned_at)
    );
    CREATE UNIQUE INDEX tenant_school_operator_active ON tenant_school_operator_assignments(tenant_id,membership_id) WHERE revoked_at IS NULL;
    CREATE TABLE tenant_school_operator_events (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id UUID NOT NULL REFERENCES tenant_tenants(id),
        assignment_id UUID NOT NULL, operator_label TEXT NOT NULL,
        case_reference TEXT NOT NULL, reason TEXT NOT NULL, action TEXT NOT NULL CHECK(action IN ('ASSIGN','REVOKE')),
        occurred_at TIMESTAMPTZ NOT NULL DEFAULT statement_timestamp(),
        FOREIGN KEY(assignment_id,tenant_id) REFERENCES tenant_school_operator_assignments(id,tenant_id),
        CHECK(length(btrim(operator_label)) BETWEEN 1 AND 200 AND length(btrim(case_reference)) BETWEEN 1 AND 200 AND length(btrim(reason)) BETWEEN 1 AND 200)
    );
    CREATE TABLE academic_core_roster_import_receipts (
        id UUID PRIMARY KEY, tenant_id UUID NOT NULL REFERENCES tenant_tenants(id), actor_person_id UUID NOT NULL REFERENCES identity_persons(id),
        request_key UUID NOT NULL, protocol_version SMALLINT NOT NULL DEFAULT 1 CHECK(protocol_version=1),
        input_digest TEXT NOT NULL CHECK(input_digest ~ '^[0-9a-f]{64}$'), request_digest TEXT NOT NULL CHECK(request_digest ~ '^[0-9a-f]{64}$'),
        preview_digest TEXT NOT NULL CHECK(preview_digest ~ '^[0-9a-f]{64}$'), reason TEXT NOT NULL CHECK(length(btrim(reason)) BETWEEN 1 AND 200),
        outcome TEXT NOT NULL CHECK(outcome IN ('APPLIED','NO_OP')), summary JSONB NOT NULL,
        occurred_at TIMESTAMPTZ NOT NULL DEFAULT statement_timestamp(),
        UNIQUE(tenant_id,actor_person_id,request_key), UNIQUE(id,tenant_id)
    );
    CREATE TABLE academic_core_student_roster_records (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id UUID NOT NULL REFERENCES tenant_tenants(id),
        source_student_key TEXT NOT NULL CHECK(length(source_student_key) BETWEEN 1 AND 64),
        revision INTEGER NOT NULL DEFAULT 1 CHECK(revision>0), full_name TEXT NOT NULL CHECK(length(full_name) BETWEEN 1 AND 200),
        nis TEXT NOT NULL CHECK(length(nis) BETWEEN 1 AND 64), nisn TEXT NOT NULL CHECK(length(nisn) BETWEEN 1 AND 64), date_of_birth DATE NOT NULL,
        academic_year_id UUID NOT NULL, academic_period_id UUID NOT NULL, academic_group_id UUID NOT NULL,
        person_id UUID REFERENCES identity_persons(id), updated_at TIMESTAMPTZ NOT NULL DEFAULT statement_timestamp(),
        UNIQUE(tenant_id,source_student_key), UNIQUE(id,tenant_id), UNIQUE(tenant_id,nis), UNIQUE(tenant_id,nisn,date_of_birth),
        FOREIGN KEY(academic_group_id,tenant_id,academic_year_id) REFERENCES academic_core_academic_groups(id,tenant_id,academic_year_id),
        FOREIGN KEY(academic_period_id,tenant_id,academic_year_id) REFERENCES academic_core_academic_periods(id,tenant_id,academic_year_id)
    );
    CREATE TABLE academic_core_student_roster_revisions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(), roster_id UUID NOT NULL, tenant_id UUID NOT NULL,
        previous_revision INTEGER NOT NULL, resulting_revision INTEGER NOT NULL CHECK(resulting_revision=previous_revision+1),
        receipt_id UUID NOT NULL, protected_values JSONB NOT NULL, occurred_at TIMESTAMPTZ NOT NULL DEFAULT statement_timestamp(),
        FOREIGN KEY(roster_id,tenant_id) REFERENCES academic_core_student_roster_records(id,tenant_id),
        FOREIGN KEY(receipt_id,tenant_id) REFERENCES academic_core_roster_import_receipts(id,tenant_id) DEFERRABLE INITIALLY DEFERRED,
        UNIQUE(roster_id,resulting_revision)
    );
    CREATE FUNCTION roster_append_only() RETURNS trigger LANGUAGE plpgsql AS $guard$
    BEGIN RAISE EXCEPTION 'Immutable roster evidence'; END $guard$;
    CREATE TRIGGER roster_receipt_immutable BEFORE UPDATE OR DELETE ON academic_core_roster_import_receipts FOR EACH ROW EXECUTE FUNCTION roster_append_only();
    CREATE TRIGGER roster_revision_immutable BEFORE UPDATE OR DELETE ON academic_core_student_roster_revisions FOR EACH ROW EXECUTE FUNCTION roster_append_only();
    CREATE TRIGGER operator_event_immutable BEFORE UPDATE OR DELETE ON tenant_school_operator_events FOR EACH ROW EXECUTE FUNCTION roster_append_only();
    CREATE FUNCTION roster_record_guard() RETURNS trigger LANGUAGE plpgsql AS $guard$
    BEGIN
        IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Roster deletion refused'; END IF;
        IF ROW(NEW.id,NEW.tenant_id,NEW.source_student_key) IS DISTINCT FROM ROW(OLD.id,OLD.tenant_id,OLD.source_student_key)
           OR NEW.person_id IS DISTINCT FROM OLD.person_id OR NEW.revision<>OLD.revision+1 THEN RAISE EXCEPTION 'Roster identity/revision refused'; END IF;
        RETURN NEW;
    END $guard$;
    CREATE TRIGGER roster_record_identity BEFORE UPDATE OR DELETE ON academic_core_student_roster_records FOR EACH ROW EXECUTE FUNCTION roster_record_guard();
    CREATE FUNCTION operator_assignment_guard() RETURNS trigger LANGUAGE plpgsql AS $guard$
    BEGIN
        IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Assignment deletion refused'; END IF;
        IF ROW(NEW.id,NEW.tenant_id,NEW.membership_id,NEW.assigned_at) IS DISTINCT FROM ROW(OLD.id,OLD.tenant_id,OLD.membership_id,OLD.assigned_at)
           OR OLD.revoked_at IS NOT NULL OR NEW.revoked_at IS NULL THEN RAISE EXCEPTION 'Assignment reassignment refused'; END IF;
        RETURN NEW;
    END $guard$;
    CREATE TRIGGER operator_assignment_identity BEFORE UPDATE OR DELETE ON tenant_school_operator_assignments FOR EACH ROW EXECUTE FUNCTION operator_assignment_guard();
    INSERT INTO elligble_migration_history(migration_id) VALUES('0056_school_operator_authoritative_roster');
END $$;
COMMIT;
