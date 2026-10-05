-- Migration 0053: adding participants to an exam after it was scheduled
-- Purpose: the teacher who manages a scheduled or ready exam adds students of the exam's class
-- before it opens (D04.2-64 LOCKED: adding participants after READY needs authorization, a
-- readiness re-check, room assignment where applicable, snapshot creation and audit; D04.4-04
-- LOCKED: a specific eligible student is added without editing the enrollment; D04.4-09
-- LOCKED: the participant keeps its provenance, who added it, when and from which
-- enrollment; D04.4-20 LOCKED: after ACTIVE this is not the path). Removing participants is
-- not part of it (OPEN-05).
--   * secure_assessment_exam_participant_additions: one per request, with who, when, the state
--     the exam had and the device's action key (unique per school); append-only.
--   * secure_assessment_exam_participant_addition_entries: the participants each request
--     created with the enrollment they came from; a participant is added at most once;
--     append-only.
-- Ownership: Secure Assessment.

BEGIN;

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM elligble_migration_history WHERE migration_id = '0053_secure_assessment_exam_participant_additions') THEN
        RAISE NOTICE 'Migration 0053_secure_assessment_exam_participant_additions already applied. Skipping.';
        RETURN;
    END IF;

    CREATE TABLE public.secure_assessment_exam_participant_additions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id UUID NOT NULL,
        exam_instance_id UUID NOT NULL,
        added_by_person_id UUID NOT NULL,
        added_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT statement_timestamp(),
        previous_lifecycle_state TEXT NOT NULL,
        action_key UUID NOT NULL,
        CONSTRAINT fk_sa_participant_addition_instance FOREIGN KEY (exam_instance_id, tenant_id)
            REFERENCES public.secure_assessment_exam_instances (id, tenant_id) ON DELETE RESTRICT,
        CONSTRAINT uq_sa_participant_addition_action_key UNIQUE (tenant_id, action_key),
        CONSTRAINT uq_sa_participant_addition_ref UNIQUE (id, tenant_id, exam_instance_id),
        CONSTRAINT ck_sa_participant_addition_state CHECK (previous_lifecycle_state IN ('SCHEDULED', 'READY'))
    );

    CREATE TABLE public.secure_assessment_exam_participant_addition_entries (
        participant_addition_id UUID NOT NULL,
        tenant_id UUID NOT NULL,
        exam_instance_id UUID NOT NULL,
        exam_participant_id UUID NOT NULL,
        academic_enrollment_id UUID NOT NULL,
        CONSTRAINT pk_sa_participant_addition_entry PRIMARY KEY (participant_addition_id, exam_participant_id),
        CONSTRAINT uq_sa_participant_addition_entry_participant UNIQUE (tenant_id, exam_participant_id),
        CONSTRAINT fk_sa_participant_addition_entry_addition FOREIGN KEY (participant_addition_id, tenant_id, exam_instance_id)
            REFERENCES public.secure_assessment_exam_participant_additions (id, tenant_id, exam_instance_id) ON DELETE RESTRICT,
        CONSTRAINT fk_sa_participant_addition_entry_participant FOREIGN KEY (exam_participant_id, tenant_id, exam_instance_id)
            REFERENCES public.secure_assessment_exam_participants (id, tenant_id, exam_instance_id) ON DELETE RESTRICT,
        CONSTRAINT fk_sa_participant_addition_entry_enrollment FOREIGN KEY (academic_enrollment_id, tenant_id)
            REFERENCES public.academic_core_student_enrollments (id, tenant_id) ON DELETE RESTRICT
    );

    CREATE INDEX idx_sa_participant_additions_exam
        ON public.secure_assessment_exam_participant_additions (tenant_id, exam_instance_id);

    CREATE FUNCTION public.prevent_sa_participant_addition_mutation()
    RETURNS TRIGGER AS $trg$
    BEGIN
        RAISE EXCEPTION 'Participant additions are append-only.';
    END;
    $trg$ LANGUAGE plpgsql;

    CREATE TRIGGER trg_prevent_sa_participant_addition_mutation
        BEFORE UPDATE OR DELETE ON public.secure_assessment_exam_participant_additions
        FOR EACH ROW EXECUTE FUNCTION public.prevent_sa_participant_addition_mutation();

    CREATE TRIGGER trg_prevent_sa_participant_addition_entry_mutation
        BEFORE UPDATE OR DELETE ON public.secure_assessment_exam_participant_addition_entries
        FOR EACH ROW EXECUTE FUNCTION public.prevent_sa_participant_addition_mutation();

    INSERT INTO elligble_migration_history (migration_id) VALUES ('0053_secure_assessment_exam_participant_additions');
END $$;

COMMIT;
