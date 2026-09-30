-- Migration 0046: participant lock and unlock
-- Purpose: an authorized supervisor locks one participant's attempt and unlocks it again
-- directly (D04.6-38 lock is a first-class action and preserves answers; D04.6-39 LOCKED:
-- direct unlock by the authorized proctor, exam/room scoped, attributable, timestamped,
-- audited, no student-facing code; D04.2-76 participant level, distinct from the exam).
-- A lock is security-focused and does not stop the time (D04.6-40: pause controls timing).
-- Each lock is recorded with its exact boundaries and who set them; a lock row is closed
-- once, by its unlock, and never deleted.
-- Ownership: Secure Assessment.

BEGIN;

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM elligble_migration_history WHERE migration_id = '0046_secure_assessment_attempt_locks') THEN
        RAISE NOTICE 'Migration 0046_secure_assessment_attempt_locks already applied. Skipping.';
        RETURN;
    END IF;

    CREATE TABLE public.secure_assessment_attempt_locks (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id UUID NOT NULL,
        exam_attempt_id UUID NOT NULL,
        locked_at TIMESTAMP WITH TIME ZONE NOT NULL,
        locked_by_person_id UUID NOT NULL,
        unlocked_at TIMESTAMP WITH TIME ZONE NULL,
        unlocked_by_person_id UUID NULL,
        CONSTRAINT fk_sa_attempt_lock_attempt FOREIGN KEY (exam_attempt_id, tenant_id)
            REFERENCES public.secure_assessment_exam_attempts (id, tenant_id) ON DELETE RESTRICT,
        CONSTRAINT ck_sa_attempt_lock_unlock CHECK (
            (unlocked_at IS NULL AND unlocked_by_person_id IS NULL)
            OR (unlocked_at IS NOT NULL AND unlocked_by_person_id IS NOT NULL AND unlocked_at >= locked_at)
        )
    );

    -- At most one open lock per attempt.
    CREATE UNIQUE INDEX uq_sa_attempt_locks_open
        ON public.secure_assessment_attempt_locks (tenant_id, exam_attempt_id)
        WHERE unlocked_at IS NULL;

    CREATE INDEX idx_sa_attempt_locks_attempt
        ON public.secure_assessment_attempt_locks (tenant_id, exam_attempt_id, locked_at);

    CREATE FUNCTION public.guard_sa_attempt_lock_mutation()
    RETURNS TRIGGER AS $trg$
    BEGIN
        IF TG_OP = 'DELETE' THEN
            RAISE EXCEPTION 'Attempt locks are never deleted.';
        END IF;
        IF OLD.unlocked_at IS NOT NULL
           OR NEW.unlocked_at IS NULL
           OR NEW.id <> OLD.id
           OR NEW.tenant_id <> OLD.tenant_id
           OR NEW.exam_attempt_id <> OLD.exam_attempt_id
           OR NEW.locked_at <> OLD.locked_at
           OR NEW.locked_by_person_id <> OLD.locked_by_person_id THEN
            RAISE EXCEPTION 'An attempt lock is only closed once, by recording its unlock.';
        END IF;
        RETURN NEW;
    END;
    $trg$ LANGUAGE plpgsql;

    CREATE TRIGGER trg_guard_sa_attempt_lock_mutation
        BEFORE UPDATE OR DELETE ON public.secure_assessment_attempt_locks
        FOR EACH ROW EXECUTE FUNCTION public.guard_sa_attempt_lock_mutation();

    INSERT INTO elligble_migration_history (migration_id) VALUES ('0046_secure_assessment_attempt_locks');
END $$;

COMMIT;
