-- Migration 0051: recorded schedule changes before an exam opens
-- Purpose: the teacher who manages a scheduled or ready exam moves its window, duration or
-- late-start rule before activation (D04.2-45 LOCKED: rescheduling before ACTIVE is allowed
-- under governance with a readiness re-check, a conflict re-check, participant and proctor
-- notification and audit; D04.2-25 LOCKED: READY is re-evaluated after a schedule change;
-- D04.2-46: an ACTIVE exam is not rescheduled). Each change keeps the values before and after
-- it, who made it and when, and the device's action key (one request, one change, even when
-- retried); participants and proctors see from it that the schedule changed. Never changed or
-- deleted.
-- Ownership: Secure Assessment.

BEGIN;

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM elligble_migration_history WHERE migration_id = '0051_secure_assessment_exam_schedule_changes') THEN
        RAISE NOTICE 'Migration 0051_secure_assessment_exam_schedule_changes already applied. Skipping.';
        RETURN;
    END IF;

    CREATE TABLE public.secure_assessment_exam_schedule_changes (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id UUID NOT NULL,
        exam_instance_id UUID NOT NULL,
        changed_by_person_id UUID NOT NULL,
        action_key UUID NOT NULL,
        changed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT statement_timestamp(),
        previous_lifecycle_state TEXT NOT NULL,
        previous_window_starts_at TIMESTAMP WITH TIME ZONE NULL,
        previous_window_ends_at TIMESTAMP WITH TIME ZONE NULL,
        previous_duration_seconds INTEGER NULL,
        previous_latest_start_policy TEXT NULL,
        new_window_starts_at TIMESTAMP WITH TIME ZONE NOT NULL,
        new_window_ends_at TIMESTAMP WITH TIME ZONE NOT NULL,
        new_duration_seconds INTEGER NOT NULL,
        new_latest_start_policy TEXT NOT NULL,
        CONSTRAINT fk_sa_schedule_change_instance FOREIGN KEY (exam_instance_id, tenant_id)
            REFERENCES public.secure_assessment_exam_instances (id, tenant_id) ON DELETE RESTRICT,
        CONSTRAINT uq_sa_schedule_change_action_key UNIQUE (tenant_id, action_key),
        CONSTRAINT ck_sa_schedule_change_state CHECK (previous_lifecycle_state IN ('SCHEDULED', 'READY')),
        CONSTRAINT ck_sa_schedule_change_window CHECK (new_window_ends_at > new_window_starts_at),
        CONSTRAINT ck_sa_schedule_change_duration CHECK (new_duration_seconds > 0),
        CONSTRAINT ck_sa_schedule_change_policy CHECK (new_latest_start_policy IN ('FULL_DURATION_BEYOND_WINDOW', 'REMAINING_WINDOW_ONLY', 'LATE_START_BLOCKED'))
    );

    CREATE INDEX idx_sa_schedule_changes_instance
        ON public.secure_assessment_exam_schedule_changes (tenant_id, exam_instance_id, changed_at);

    CREATE FUNCTION public.prevent_sa_schedule_change_mutation()
    RETURNS TRIGGER AS $trg$
    BEGIN
        RAISE EXCEPTION 'Exam schedule changes are append-only.';
    END;
    $trg$ LANGUAGE plpgsql;

    CREATE TRIGGER trg_prevent_sa_schedule_change_mutation
        BEFORE UPDATE OR DELETE ON public.secure_assessment_exam_schedule_changes
        FOR EACH ROW EXECUTE FUNCTION public.prevent_sa_schedule_change_mutation();

    INSERT INTO elligble_migration_history (migration_id) VALUES ('0051_secure_assessment_exam_schedule_changes');
END $$;

COMMIT;
