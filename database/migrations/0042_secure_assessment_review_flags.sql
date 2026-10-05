-- Migration 0042: "Ragu-ragu / Tandai" review flags
-- Purpose: a student may mark a question for their own review before submitting
-- (D04.5-33/34). The mark is kept apart from the answer and never changes it (D04.5-35),
-- and it is stored on the server so it survives a reload or a move to another device
-- (SECURE_ASSESSMENT_EXAM_FOCUS_WORKSPACE §13: no ephemeral flag). It is a student
-- navigation aid, not a proctor risk signal: no monitoring or result view reads it.
-- Ownership: Secure Assessment.

BEGIN;

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM elligble_migration_history WHERE migration_id = '0042_secure_assessment_review_flags') THEN
        RAISE NOTICE 'Migration 0042_secure_assessment_review_flags already applied. Skipping.';
        RETURN;
    END IF;

    CREATE TABLE public.secure_assessment_review_flags (
        tenant_id UUID NOT NULL,
        exam_attempt_id UUID NOT NULL,
        exam_question_snapshot_id UUID NOT NULL,
        flagged BOOLEAN NOT NULL,
        updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT pk_sa_review_flags PRIMARY KEY (tenant_id, exam_attempt_id, exam_question_snapshot_id),
        CONSTRAINT fk_sa_review_flag_attempt FOREIGN KEY (exam_attempt_id, tenant_id)
            REFERENCES public.secure_assessment_exam_attempts (id, tenant_id) ON DELETE RESTRICT,
        CONSTRAINT fk_sa_review_flag_snapshot FOREIGN KEY (exam_question_snapshot_id, tenant_id)
            REFERENCES public.secure_assessment_exam_question_snapshots (id, tenant_id) ON DELETE RESTRICT
    );

    INSERT INTO elligble_migration_history (migration_id) VALUES ('0042_secure_assessment_review_flags');
END $$;

COMMIT;
