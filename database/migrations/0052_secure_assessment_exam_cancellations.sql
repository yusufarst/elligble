-- Migration 0052: cancelling an exam before it opens
-- Purpose: the teacher who manages a scheduled or ready exam cancels it before activation
-- (D04.2-47 LOCKED concept: cancellation before ACTIVE is explicit and never hidden by
-- deletion; Owner decision 2026-09-30: SCHEDULED or READY move to ARCHIVED, no CANCELLED
-- state, the cancellation kept in append-only history with its reason, actor and time, so an
-- ARCHIVED exam shows unambiguously whether it was cancelled before opening or archived after
-- completion; never for an ACTIVE exam, whose end stays END). Nothing is deleted: the exam,
-- its participants, question snapshots and audit records stay.
--   * secure_assessment_exam_cancellations: one per exam, with the reason, who, when, the
--     state it had and the device's action key (unique per school); append-only.
--   * every lifecycle event from SCHEDULED or READY to ARCHIVED names its cancellation, and
--     only such an event may; the exam row itself cannot leave SCHEDULED or READY for
--     ARCHIVED without a recorded cancellation, and a cancelled exam cannot leave ARCHIVED.
-- Ownership: Secure Assessment.

BEGIN;

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM elligble_migration_history WHERE migration_id = '0052_secure_assessment_exam_cancellations') THEN
        RAISE NOTICE 'Migration 0052_secure_assessment_exam_cancellations already applied. Skipping.';
        RETURN;
    END IF;

    CREATE TABLE public.secure_assessment_exam_cancellations (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id UUID NOT NULL,
        exam_instance_id UUID NOT NULL,
        cancelled_by_person_id UUID NOT NULL,
        cancelled_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT statement_timestamp(),
        reason TEXT NOT NULL,
        previous_lifecycle_state TEXT NOT NULL,
        action_key UUID NOT NULL,
        CONSTRAINT fk_sa_exam_cancellation_instance FOREIGN KEY (exam_instance_id, tenant_id)
            REFERENCES public.secure_assessment_exam_instances (id, tenant_id) ON DELETE RESTRICT,
        CONSTRAINT uq_sa_exam_cancellation_exam UNIQUE (tenant_id, exam_instance_id),
        CONSTRAINT uq_sa_exam_cancellation_action_key UNIQUE (tenant_id, action_key),
        CONSTRAINT uq_sa_exam_cancellation_ref UNIQUE (id, tenant_id, exam_instance_id),
        CONSTRAINT ck_sa_exam_cancellation_reason CHECK (char_length(btrim(reason)) BETWEEN 1 AND 500),
        CONSTRAINT ck_sa_exam_cancellation_state CHECK (previous_lifecycle_state IN ('SCHEDULED', 'READY'))
    );

    CREATE FUNCTION public.prevent_sa_exam_cancellation_mutation()
    RETURNS TRIGGER AS $trg$
    BEGIN
        RAISE EXCEPTION 'Exam cancellations are append-only.';
    END;
    $trg$ LANGUAGE plpgsql;

    CREATE TRIGGER trg_prevent_sa_exam_cancellation_mutation
        BEFORE UPDATE OR DELETE ON public.secure_assessment_exam_cancellations
        FOR EACH ROW EXECUTE FUNCTION public.prevent_sa_exam_cancellation_mutation();

    -- The lifecycle history tells a cancellation apart from an archive after completion.
    ALTER TABLE public.secure_assessment_exam_lifecycle_events
        ADD COLUMN cancellation_id UUID NULL,
        ADD CONSTRAINT fk_sa_lifecycle_event_cancellation FOREIGN KEY (cancellation_id, tenant_id, exam_instance_id)
            REFERENCES public.secure_assessment_exam_cancellations (id, tenant_id, exam_instance_id) ON DELETE RESTRICT,
        ADD CONSTRAINT ck_sa_lifecycle_event_cancellation CHECK (
            (cancellation_id IS NOT NULL) = (to_state = 'ARCHIVED' AND from_state IN ('SCHEDULED', 'READY'))
        );

    -- The exam row follows the same rule: a pre-open exam is archived only by its cancellation,
    -- and a cancelled exam stays archived.
    CREATE FUNCTION public.guard_sa_exam_cancellation_state()
    RETURNS TRIGGER AS $trg$
    BEGIN
        IF NEW.lifecycle_state = 'ARCHIVED' AND OLD.lifecycle_state IN ('SCHEDULED', 'READY')
           AND NOT EXISTS (
               SELECT 1 FROM public.secure_assessment_exam_cancellations c
               WHERE c.tenant_id = NEW.tenant_id AND c.exam_instance_id = NEW.id
           ) THEN
            RAISE EXCEPTION 'An exam that has not opened is archived only by its recorded cancellation.';
        END IF;
        IF OLD.lifecycle_state = 'ARCHIVED' AND NEW.lifecycle_state <> 'ARCHIVED'
           AND EXISTS (
               SELECT 1 FROM public.secure_assessment_exam_cancellations c
               WHERE c.tenant_id = OLD.tenant_id AND c.exam_instance_id = OLD.id
           ) THEN
            RAISE EXCEPTION 'A cancelled exam stays cancelled.';
        END IF;
        RETURN NEW;
    END;
    $trg$ LANGUAGE plpgsql;

    CREATE TRIGGER trg_guard_sa_exam_cancellation_state
        BEFORE UPDATE OF lifecycle_state ON public.secure_assessment_exam_instances
        FOR EACH ROW EXECUTE FUNCTION public.guard_sa_exam_cancellation_state();

    INSERT INTO elligble_migration_history (migration_id) VALUES ('0052_secure_assessment_exam_cancellations');
END $$;

COMMIT;
