-- Migration 0050: attributed time additions
-- Purpose: an authorized supervisor adds working time for one participant (D04.6-41 LOCKED:
-- add time is a first-class controlled action recording minutes, reason, actor and time;
-- D04.2-78 participant-specific; D04.2-79 and D04.6-63 high-impact and audited; D04.5-31 it
-- updates the attempt timing ledger, explicit, attributable and reproducible). The ledger
-- secure_assessment_timer_adjustments (0005) already feeds every remaining-time computation
-- (0044). This migration records who made each adjustment and the device's action key (one
-- request, one adjustment, even when the request is retried), requires the actor on every
-- new adjustment, and makes the ledger append-only.
-- Ownership: Secure Assessment.

BEGIN;

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM elligble_migration_history WHERE migration_id = '0050_secure_assessment_time_additions') THEN
        RAISE NOTICE 'Migration 0050_secure_assessment_time_additions already applied. Skipping.';
        RETURN;
    END IF;

    ALTER TABLE public.secure_assessment_timer_adjustments
        ADD COLUMN actor_person_id UUID NULL,
        ADD COLUMN action_key UUID NULL;

    -- Every adjustment from now on names who made it. NOT VALID leaves rows written before
    -- this migration (none by the product) in the ledger unchanged.
    ALTER TABLE public.secure_assessment_timer_adjustments
        ADD CONSTRAINT ck_sa_timer_adj_actor CHECK (actor_person_id IS NOT NULL) NOT VALID;

    -- One adjustment per action key in a school: a retried request finds the one it made.
    CREATE UNIQUE INDEX uq_sa_timer_adj_action_key
        ON public.secure_assessment_timer_adjustments (tenant_id, action_key)
        WHERE action_key IS NOT NULL;

    CREATE FUNCTION public.guard_sa_timer_adjustment_mutation()
    RETURNS TRIGGER AS $trg$
    BEGIN
        RAISE EXCEPTION 'Timer adjustments are append-only.';
    END;
    $trg$ LANGUAGE plpgsql;

    CREATE TRIGGER trg_guard_sa_timer_adjustment_mutation
        BEFORE UPDATE OR DELETE ON public.secure_assessment_timer_adjustments
        FOR EACH ROW EXECUTE FUNCTION public.guard_sa_timer_adjustment_mutation();

    INSERT INTO elligble_migration_history (migration_id) VALUES ('0050_secure_assessment_time_additions');
END $$;

COMMIT;
