-- Migration 0062: institution exam periods, sessions and preparation deadlines (ASSESS-INSTITUTION-001 §4.1;
-- Owner O05-1, O05-2, A04-1, OP-1..OP-9, OB-1)
-- Purpose: the School Operator organizes an institution exam period. A period belongs to one academic
-- period and one assessment type; a session is one date and time slot of a period; each subject x rombel
-- group is one existing ExamInstance placed in a session (the nullable institution_session_id; existing
-- rows stay NULL, teacher-managed, no backfill). An exam never moves between teacher-managed and
-- institution-managed. The preparation deadline of an institution exam is an append-only revision table
-- (the current deadline is the highest revision, the 0061 pattern): revision 1 at placement, each
-- extension the next revision with its reason. The questions of an institution exam may be inserted or
-- deleted only while it is SCHEDULED and before its current deadline; the content lock takes the exam row
-- FOR SHARE, so a raw writer serializes with mark ready, extension and cancellation. No snapshot row is
-- ever updated (0003 unchanged). Person columns are cross-domain references without a database FK, as in
-- 0061. Ownership: Secure Assessment.
BEGIN;
DO $migration$
BEGIN
    IF EXISTS (SELECT 1 FROM elligble_migration_history WHERE migration_id = '0062_secure_assessment_institution_exams') THEN
        RETURN;
    END IF;

    CREATE TABLE public.secure_assessment_institution_exam_periods (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id UUID NOT NULL,
        academic_period_id UUID NOT NULL,
        assessment_type_id UUID NOT NULL,
        label TEXT NOT NULL,
        created_by_person_id UUID NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT statement_timestamp(),
        action_key UUID NOT NULL,
        request_digest TEXT NOT NULL,
        CONSTRAINT ck_sa_institution_period_label CHECK (char_length(label) BETWEEN 1 AND 120 AND btrim(label) = label),
        CONSTRAINT ck_sa_institution_period_digest CHECK (request_digest ~ '^[0-9a-f]{64}$'),
        CONSTRAINT fk_sa_institution_period_academic_period FOREIGN KEY (academic_period_id, tenant_id)
            REFERENCES public.academic_core_academic_periods (id, tenant_id) ON DELETE RESTRICT,
        CONSTRAINT fk_sa_institution_period_assessment_type FOREIGN KEY (assessment_type_id, tenant_id)
            REFERENCES public.secure_assessment_assessment_types (id, tenant_id) ON DELETE RESTRICT,
        CONSTRAINT uq_sa_institution_period_ref UNIQUE (id, tenant_id),
        CONSTRAINT uq_sa_institution_period_action_key UNIQUE (tenant_id, action_key),
        CONSTRAINT uq_sa_institution_period_label UNIQUE (tenant_id, academic_period_id, label)
    );

    CREATE TABLE public.secure_assessment_institution_exam_sessions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id UUID NOT NULL,
        period_id UUID NOT NULL,
        starts_at TIMESTAMP WITH TIME ZONE NOT NULL,
        ends_at TIMESTAMP WITH TIME ZONE NOT NULL,
        created_by_person_id UUID NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT statement_timestamp(),
        action_key UUID NOT NULL,
        request_digest TEXT NOT NULL,
        CONSTRAINT ck_sa_institution_session_window CHECK (ends_at > starts_at),
        CONSTRAINT ck_sa_institution_session_digest CHECK (request_digest ~ '^[0-9a-f]{64}$'),
        CONSTRAINT fk_sa_institution_session_period FOREIGN KEY (period_id, tenant_id)
            REFERENCES public.secure_assessment_institution_exam_periods (id, tenant_id) ON DELETE RESTRICT,
        CONSTRAINT uq_sa_institution_session_ref UNIQUE (id, tenant_id),
        CONSTRAINT uq_sa_institution_session_action_key UNIQUE (tenant_id, action_key),
        CONSTRAINT uq_sa_institution_session_slot UNIQUE (tenant_id, period_id, starts_at, ends_at)
    );

    -- The session reference of an institution exam; NULL is a teacher-managed exam (D04.4-26A unchanged).
    ALTER TABLE public.secure_assessment_exam_instances
        ADD COLUMN institution_session_id UUID NULL,
        ADD CONSTRAINT fk_sa_exam_instance_institution_session FOREIGN KEY (institution_session_id, tenant_id)
            REFERENCES public.secure_assessment_institution_exam_sessions (id, tenant_id) ON DELETE RESTRICT;

    CREATE INDEX idx_sa_exam_instances_institution_session
        ON public.secure_assessment_exam_instances (tenant_id, institution_session_id);

    CREATE FUNCTION public.guard_sa_exam_institution_session()
    RETURNS TRIGGER AS $trg$
    BEGIN
        IF OLD.institution_session_id IS DISTINCT FROM NEW.institution_session_id THEN
            RAISE EXCEPTION 'An exam never moves between teacher-managed and institution-managed.';
        END IF;
        RETURN NEW;
    END;
    $trg$ LANGUAGE plpgsql;

    CREATE TRIGGER trg_guard_sa_exam_institution_session
        BEFORE UPDATE OF institution_session_id ON public.secure_assessment_exam_instances
        FOR EACH ROW EXECUTE FUNCTION public.guard_sa_exam_institution_session();

    CREATE TABLE public.secure_assessment_institution_preparation_deadlines (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id UUID NOT NULL,
        exam_instance_id UUID NOT NULL,
        revision INTEGER NOT NULL,
        deadline_at TIMESTAMP WITH TIME ZONE NOT NULL,
        previous_deadline_at TIMESTAMP WITH TIME ZONE NULL,
        reason TEXT NULL,
        set_by_person_id UUID NOT NULL,
        set_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT statement_timestamp(),
        action_key UUID NOT NULL,
        request_digest TEXT NOT NULL,
        CONSTRAINT ck_sa_institution_deadline_revision_number CHECK (revision >= 1),
        CONSTRAINT ck_sa_institution_deadline_digest CHECK (request_digest ~ '^[0-9a-f]{64}$'),
        CONSTRAINT ck_sa_institution_deadline_revision CHECK (
            (revision = 1 AND previous_deadline_at IS NULL AND reason IS NULL)
            OR (revision > 1 AND previous_deadline_at IS NOT NULL AND deadline_at > previous_deadline_at
                AND reason IS NOT NULL AND char_length(reason) BETWEEN 1 AND 200 AND btrim(reason) = reason)
        ),
        CONSTRAINT fk_sa_institution_deadline_exam FOREIGN KEY (exam_instance_id, tenant_id)
            REFERENCES public.secure_assessment_exam_instances (id, tenant_id) ON DELETE RESTRICT,
        CONSTRAINT uq_sa_institution_deadline_revision UNIQUE (tenant_id, exam_instance_id, revision),
        CONSTRAINT uq_sa_institution_deadline_action_key UNIQUE (tenant_id, action_key)
    );

    CREATE FUNCTION public.prevent_sa_institution_exam_mutation()
    RETURNS TRIGGER AS $trg$
    BEGIN
        RAISE EXCEPTION 'Institution exam periods, sessions and preparation deadlines are append-only.';
    END;
    $trg$ LANGUAGE plpgsql;

    CREATE TRIGGER trg_prevent_sa_institution_period_mutation
        BEFORE UPDATE OR DELETE ON public.secure_assessment_institution_exam_periods
        FOR EACH ROW EXECUTE FUNCTION public.prevent_sa_institution_exam_mutation();
    CREATE TRIGGER trg_prevent_sa_institution_session_mutation
        BEFORE UPDATE OR DELETE ON public.secure_assessment_institution_exam_sessions
        FOR EACH ROW EXECUTE FUNCTION public.prevent_sa_institution_exam_mutation();
    CREATE TRIGGER trg_prevent_sa_institution_deadline_mutation
        BEFORE UPDATE OR DELETE ON public.secure_assessment_institution_preparation_deadlines
        FOR EACH ROW EXECUTE FUNCTION public.prevent_sa_institution_exam_mutation();

    -- The content lock (E5): a teacher-managed exam returns at once and takes no lock; an institution
    -- exam is read FOR SHARE (waiting for mark ready, an extension, a cancellation or the content route
    -- that holds it FOR UPDATE), then its questions change only while SCHEDULED and before the deadline.
    CREATE FUNCTION public.guard_sa_institution_exam_content()
    RETURNS TRIGGER AS $trg$
    DECLARE
        v_tenant UUID;
        v_exam UUID;
        v_session UUID;
        v_state TEXT;
        v_deadline TIMESTAMP WITH TIME ZONE;
    BEGIN
        IF TG_OP = 'INSERT' THEN
            v_tenant := NEW.tenant_id;
            v_exam := NEW.exam_instance_id;
        ELSE
            v_tenant := OLD.tenant_id;
            v_exam := OLD.exam_instance_id;
        END IF;
        SELECT i.institution_session_id INTO v_session
        FROM public.secure_assessment_exam_instances i
        WHERE i.id = v_exam AND i.tenant_id = v_tenant;
        IF v_session IS NOT NULL THEN
            SELECT i.lifecycle_state INTO v_state
            FROM public.secure_assessment_exam_instances i
            WHERE i.id = v_exam AND i.tenant_id = v_tenant
            FOR SHARE;
            SELECT d.deadline_at INTO v_deadline
            FROM public.secure_assessment_institution_preparation_deadlines d
            WHERE d.tenant_id = v_tenant AND d.exam_instance_id = v_exam
            ORDER BY d.revision DESC
            LIMIT 1;
            IF v_state IS DISTINCT FROM 'SCHEDULED' OR v_deadline IS NULL OR NOT (transaction_timestamp() < v_deadline) THEN
                RAISE EXCEPTION 'The questions of an institution exam change only while it is scheduled and before its preparation deadline.';
            END IF;
        END IF;
        IF TG_OP = 'INSERT' THEN
            RETURN NEW;
        END IF;
        RETURN OLD;
    END;
    $trg$ LANGUAGE plpgsql;

    CREATE TRIGGER trg_guard_sa_institution_exam_content
        BEFORE INSERT OR DELETE ON public.secure_assessment_exam_question_snapshots
        FOR EACH ROW EXECUTE FUNCTION public.guard_sa_institution_exam_content();

    INSERT INTO elligble_migration_history (migration_id) VALUES ('0062_secure_assessment_institution_exams');
END; $migration$;
COMMIT;
