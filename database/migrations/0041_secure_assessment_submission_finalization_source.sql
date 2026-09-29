-- Migration 0041: how an attempt was finalized
-- Purpose: a submission records what finalized the attempt: the student (STUDENT_SUBMIT),
-- the student's device when the time ran out (EXPIRY_CLIENT, D04.5-45/46), or the server
-- from the last accepted answers when the device was unreachable at expiry (EXPIRY_SERVER,
-- D04.5-47). Server finalization is the case where answers may still wait on the device
-- (D04.5-48), so it stays distinguishable for review. Submissions made before this
-- migration keep an unknown (NULL) source.
-- Ownership: Secure Assessment.

BEGIN;

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM elligble_migration_history WHERE migration_id = '0041_secure_assessment_submission_finalization_source') THEN
        RAISE NOTICE 'Migration 0041_secure_assessment_submission_finalization_source already applied. Skipping.';
        RETURN;
    END IF;

    ALTER TABLE public.secure_assessment_exam_submissions
        ADD COLUMN finalization_source VARCHAR(32) NULL,
        ADD CONSTRAINT ck_sa_submission_finalization_source
            CHECK (finalization_source IS NULL OR finalization_source IN ('STUDENT_SUBMIT', 'EXPIRY_CLIENT', 'EXPIRY_SERVER'));

    INSERT INTO elligble_migration_history (migration_id) VALUES ('0041_secure_assessment_submission_finalization_source');
END $$;

COMMIT;
