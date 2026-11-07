-- Migration 0060: question import template v2 (ASSESS-QUESTION-002 §4.2/§4A.5; Owner O02-12)
-- Purpose: an import batch may record the elligble-questions-v2 template, which adds a question
-- type column (PG single choice, PGK multiple response). elligble-questions-v1 stays accepted.
-- Existing batches are unchanged; no backfill. Ownership: Secure Assessment.
BEGIN;
DO $migration$
BEGIN
    IF EXISTS (SELECT 1 FROM elligble_migration_history WHERE migration_id = '0060_secure_assessment_question_import_template_v2') THEN
        RETURN;
    END IF;

    ALTER TABLE public.secure_assessment_question_import_batches
        DROP CONSTRAINT ck_sa_question_import_batch_template,
        ADD CONSTRAINT ck_sa_question_import_batch_template CHECK (template IN ('elligble-questions-v1', 'elligble-questions-v2'));

    INSERT INTO elligble_migration_history (migration_id) VALUES ('0060_secure_assessment_question_import_template_v2');
END; $migration$;
COMMIT;
