-- Migration 0066: result publication of a finalized exam (RESULT-003 §4.1; Owner OD-09, O02-10, O05-1, O05-6, RP-1, RP-2)
-- Purpose: the Teacher who holds an exam's teaching assignment publishes its finalized result to the exam's Students,
-- withdraws the publication and publishes it again, each with a reason, a confirmation, an action key and a request
-- digest. Publication is not a lifecycle state: the exam stays FINALIZED and this table is an append-only sequence of
-- events per exam (PUBLISH, WITHDRAW, PUBLISH, ...), whose latest event decides; an exam with none is unpublished.
-- The foreign key to the exam's one finalization (0045) makes a publication of an exam that is not finalized impossible.
-- A sequence guard keeps each exam's events contiguous from 1, the first a PUBLISH and each a change of the previous
-- one; the append-only trigger refuses every update and delete. Nothing else changes: no 0045 row, no 0054 row or
-- constraint, no lifecycle state. The actor is a reference to Identity, as 0054 does; no Identity row is written. No
-- data is migrated. Ownership: Secure Assessment.
BEGIN;
DO $migration$
BEGIN
    IF EXISTS (SELECT 1 FROM elligble_migration_history WHERE migration_id = '0066_secure_assessment_result_publications') THEN
        RETURN;
    END IF;

    CREATE TABLE public.secure_assessment_result_publication_events (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id UUID NOT NULL,
        exam_instance_id UUID NOT NULL,
        sequence INTEGER NOT NULL,
        action TEXT NOT NULL,
        actor_person_id UUID NOT NULL,
        reason TEXT NOT NULL,
        confirmed BOOLEAN NOT NULL,
        action_key UUID NOT NULL,
        request_digest TEXT NOT NULL,
        occurred_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT statement_timestamp(),
        CONSTRAINT ck_sa_result_publication_sequence CHECK (sequence > 0),
        CONSTRAINT ck_sa_result_publication_action CHECK (action IN ('PUBLISH', 'WITHDRAW')),
        CONSTRAINT ck_sa_result_publication_reason CHECK (char_length(reason) BETWEEN 1 AND 200 AND btrim(reason) = reason),
        CONSTRAINT ck_sa_result_publication_confirmed CHECK (confirmed),
        CONSTRAINT ck_sa_result_publication_digest CHECK (request_digest ~ '^[0-9a-f]{64}$'),
        -- Only a finalized exam (0045 uq_sa_result_finalization_exam).
        CONSTRAINT fk_sa_result_publication_finalization FOREIGN KEY (tenant_id, exam_instance_id)
            REFERENCES public.secure_assessment_exam_result_finalizations (tenant_id, exam_instance_id) ON DELETE RESTRICT,
        CONSTRAINT fk_sa_result_publication_actor FOREIGN KEY (actor_person_id)
            REFERENCES public.identity_persons (id) ON DELETE RESTRICT,
        -- Also the latest-event lookup of an exam.
        CONSTRAINT uq_sa_result_publication_sequence UNIQUE (tenant_id, exam_instance_id, sequence),
        CONSTRAINT uq_sa_result_publication_action_key UNIQUE (tenant_id, action_key)
    );

    CREATE FUNCTION public.prevent_sa_result_publication_mutation()
    RETURNS TRIGGER AS $trg$
    BEGIN
        RAISE EXCEPTION 'Result publication events are append-only.';
    END;
    $trg$ LANGUAGE plpgsql;

    CREATE TRIGGER trg_prevent_sa_result_publication_mutation
        BEFORE UPDATE OR DELETE ON public.secure_assessment_result_publication_events
        FOR EACH ROW EXECUTE FUNCTION public.prevent_sa_result_publication_mutation();

    -- The sequence guard: the next sequence of the exam, the first event a PUBLISH, each event a change of the previous one.
    CREATE FUNCTION public.guard_sa_result_publication_sequence()
    RETURNS TRIGGER AS $trg$
    DECLARE
        v_previous RECORD;
    BEGIN
        -- A value outside the domain is left to its own named CHECK (ck_sa_result_publication_sequence/_action).
        IF NEW.sequence IS NULL OR NEW.sequence <= 0 OR NEW.action IS NULL OR NEW.action NOT IN ('PUBLISH', 'WITHDRAW') THEN
            RETURN NEW;
        END IF;
        SELECT e.sequence, e.action INTO v_previous
        FROM public.secure_assessment_result_publication_events e
        WHERE e.tenant_id = NEW.tenant_id AND e.exam_instance_id = NEW.exam_instance_id
        ORDER BY e.sequence DESC
        LIMIT 1;
        IF (v_previous.sequence IS NULL AND (NEW.sequence <> 1 OR NEW.action <> 'PUBLISH'))
            OR (v_previous.sequence IS NOT NULL AND (NEW.sequence <> v_previous.sequence + 1 OR NEW.action = v_previous.action)) THEN
            RAISE EXCEPTION 'A result publication event is the next of its exam: the first a PUBLISH, each a change of the previous one.'
                USING ERRCODE = 'check_violation', CONSTRAINT = 'ck_sa_result_publication_order';
        END IF;
        RETURN NEW;
    END;
    $trg$ LANGUAGE plpgsql;

    CREATE TRIGGER trg_guard_sa_result_publication_sequence
        BEFORE INSERT ON public.secure_assessment_result_publication_events
        FOR EACH ROW EXECUTE FUNCTION public.guard_sa_result_publication_sequence();

    INSERT INTO elligble_migration_history (migration_id) VALUES ('0066_secure_assessment_result_publications');
END; $migration$;
COMMIT;
