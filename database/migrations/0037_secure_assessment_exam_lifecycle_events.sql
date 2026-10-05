-- Migration 0037: Secure Assessment exam lifecycle events
-- Purpose: append-only, individually attributable record of exam lifecycle transitions
-- (D04.2-01 explicit transitions, D04.1-57 attributable operational actions).
-- Ownership: Secure Assessment. Rows are never updated or deleted by the application.

BEGIN;

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM elligble_migration_history WHERE migration_id = '0037_secure_assessment_exam_lifecycle_events') THEN
        RAISE NOTICE 'Migration 0037_secure_assessment_exam_lifecycle_events already applied. Skipping.';
        RETURN;
    END IF;

    CREATE TABLE public.secure_assessment_exam_lifecycle_events (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id UUID NOT NULL,
        exam_instance_id UUID NOT NULL,
        from_state TEXT NOT NULL,
        to_state TEXT NOT NULL,
        actor_person_id UUID NOT NULL,
        occurred_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT fk_sa_lifecycle_event_instance FOREIGN KEY (exam_instance_id, tenant_id)
            REFERENCES public.secure_assessment_exam_instances (id, tenant_id) ON DELETE RESTRICT,
        CONSTRAINT ck_sa_lifecycle_event_states CHECK (
            from_state IN ('DRAFT', 'SCHEDULED', 'READY', 'ACTIVE', 'PAUSED', 'ENDED', 'FINALIZED', 'ARCHIVED')
            AND to_state IN ('DRAFT', 'SCHEDULED', 'READY', 'ACTIVE', 'PAUSED', 'ENDED', 'FINALIZED', 'ARCHIVED')
            AND from_state <> to_state
        )
    );

    CREATE INDEX idx_sa_lifecycle_events_instance
        ON public.secure_assessment_exam_lifecycle_events (tenant_id, exam_instance_id, occurred_at);

    CREATE FUNCTION public.prevent_sa_lifecycle_event_mutation()
    RETURNS TRIGGER AS $trg$
    BEGIN
        RAISE EXCEPTION 'Exam lifecycle events are append-only.';
    END;
    $trg$ LANGUAGE plpgsql;

    CREATE TRIGGER trg_prevent_sa_lifecycle_event_mutation
        BEFORE UPDATE OR DELETE ON public.secure_assessment_exam_lifecycle_events
        FOR EACH ROW EXECUTE FUNCTION public.prevent_sa_lifecycle_event_mutation();

    INSERT INTO elligble_migration_history (migration_id) VALUES ('0037_secure_assessment_exam_lifecycle_events');
END $$;

COMMIT;
