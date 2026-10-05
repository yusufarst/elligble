-- Migration 0044: exam pauses and pause-aware working time
-- Purpose: Owner decision of 2026-09-30 on PAUSED (D04.2-77). A whole-exam pause freezes
-- every active attempt's server-authoritative remaining time at the authoritative pause
-- boundary, and a resume continues each attempt from exactly that remaining time. Each
-- pause is recorded with its exact boundaries and who set them; the lifecycle events
-- (0037) keep recording the transitions themselves.
-- secure_assessment_attempt_elapsed_seconds is the single rule for an attempt's elapsed
-- working time: wall time since its timer started minus the time the exam was paused.
-- Every timer computation (answer save, submission and expiry, timer, resume, question
-- delivery, review marks, the expiry sweep, monitoring) uses it, directly or through
-- secure_assessment_attempt_remaining_seconds.
-- Ownership: Secure Assessment. A pause row is closed once, by its resume, and never
-- deleted.

BEGIN;

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM elligble_migration_history WHERE migration_id = '0044_secure_assessment_exam_pauses') THEN
        RAISE NOTICE 'Migration 0044_secure_assessment_exam_pauses already applied. Skipping.';
        RETURN;
    END IF;

    CREATE TABLE public.secure_assessment_exam_pauses (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id UUID NOT NULL,
        exam_instance_id UUID NOT NULL,
        paused_at TIMESTAMP WITH TIME ZONE NOT NULL,
        paused_by_person_id UUID NOT NULL,
        resumed_at TIMESTAMP WITH TIME ZONE NULL,
        resumed_by_person_id UUID NULL,
        CONSTRAINT fk_sa_exam_pause_instance FOREIGN KEY (exam_instance_id, tenant_id)
            REFERENCES public.secure_assessment_exam_instances (id, tenant_id) ON DELETE RESTRICT,
        CONSTRAINT ck_sa_exam_pause_resume CHECK (
            (resumed_at IS NULL AND resumed_by_person_id IS NULL)
            OR (resumed_at IS NOT NULL AND resumed_by_person_id IS NOT NULL AND resumed_at >= paused_at)
        )
    );

    -- At most one open pause per exam.
    CREATE UNIQUE INDEX uq_sa_exam_pauses_open
        ON public.secure_assessment_exam_pauses (tenant_id, exam_instance_id)
        WHERE resumed_at IS NULL;

    CREATE INDEX idx_sa_exam_pauses_instance
        ON public.secure_assessment_exam_pauses (tenant_id, exam_instance_id, paused_at);

    CREATE FUNCTION public.guard_sa_exam_pause_mutation()
    RETURNS TRIGGER AS $trg$
    BEGIN
        IF TG_OP = 'DELETE' THEN
            RAISE EXCEPTION 'Exam pauses are never deleted.';
        END IF;
        IF OLD.resumed_at IS NOT NULL
           OR NEW.resumed_at IS NULL
           OR NEW.id <> OLD.id
           OR NEW.tenant_id <> OLD.tenant_id
           OR NEW.exam_instance_id <> OLD.exam_instance_id
           OR NEW.paused_at <> OLD.paused_at
           OR NEW.paused_by_person_id <> OLD.paused_by_person_id THEN
            RAISE EXCEPTION 'An exam pause is only closed once, by recording its resume.';
        END IF;
        RETURN NEW;
    END;
    $trg$ LANGUAGE plpgsql;

    CREATE TRIGGER trg_guard_sa_exam_pause_mutation
        BEFORE UPDATE OR DELETE ON public.secure_assessment_exam_pauses
        FOR EACH ROW EXECUTE FUNCTION public.guard_sa_exam_pause_mutation();

    -- Whole seconds of working time of an attempt at p_at: wall time since its timer
    -- started, minus every part of an exam pause that falls between the start and p_at (an
    -- open pause counts up to p_at, so the value stays constant while the exam is paused).
    -- NULL when the attempt's timer has not started.
    CREATE FUNCTION public.secure_assessment_attempt_elapsed_seconds(p_tenant_id UUID, p_attempt_id UUID, p_at TIMESTAMP WITH TIME ZONE)
    RETURNS INTEGER
    LANGUAGE sql
    STABLE
    AS $fn$
        SELECT FLOOR(
            EXTRACT(EPOCH FROM (p_at - t.started_at))
            - COALESCE((
                SELECT SUM(GREATEST(0, EXTRACT(EPOCH FROM (
                    LEAST(COALESCE(ps.resumed_at, p_at), p_at) - GREATEST(ps.paused_at, t.started_at)
                ))))
                FROM public.secure_assessment_exam_pauses ps
                WHERE ps.tenant_id = t.tenant_id
                  AND ps.exam_instance_id = p.exam_instance_id
                  AND ps.paused_at < p_at
                  AND (ps.resumed_at IS NULL OR ps.resumed_at > t.started_at)
            ), 0)
        )::integer
        FROM public.secure_assessment_timer_state t
        JOIN public.secure_assessment_exam_attempts a
          ON a.id = t.exam_attempt_id AND a.tenant_id = t.tenant_id
        JOIN public.secure_assessment_exam_participants p
          ON p.id = a.exam_participant_id AND p.tenant_id = a.tenant_id
        WHERE t.tenant_id = p_tenant_id
          AND t.exam_attempt_id = p_attempt_id
          AND t.started_at IS NOT NULL
    $fn$;

    -- Whole seconds of working time an attempt still has at p_at: its configured duration
    -- plus adjustments, minus the elapsed working time above. Zero or less means the time is
    -- up. NULL when the attempt's timer has not started.
    CREATE FUNCTION public.secure_assessment_attempt_remaining_seconds(p_tenant_id UUID, p_attempt_id UUID, p_at TIMESTAMP WITH TIME ZONE)
    RETURNS INTEGER
    LANGUAGE sql
    STABLE
    AS $fn$
        SELECT t.configured_duration_seconds
            + COALESCE((
                SELECT SUM(adj.adjustment_seconds)
                FROM public.secure_assessment_timer_adjustments adj
                WHERE adj.tenant_id = t.tenant_id AND adj.timer_state_id = t.id
            ), 0)::integer
            - public.secure_assessment_attempt_elapsed_seconds(p_tenant_id, p_attempt_id, p_at)
        FROM public.secure_assessment_timer_state t
        WHERE t.tenant_id = p_tenant_id
          AND t.exam_attempt_id = p_attempt_id
          AND t.started_at IS NOT NULL
    $fn$;

    INSERT INTO elligble_migration_history (migration_id) VALUES ('0044_secure_assessment_exam_pauses');
END $$;

COMMIT;
