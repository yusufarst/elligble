-- Migration 0048: question import batches
-- Purpose: a teacher schedules a teacher-managed exam from a structured question file in the
-- canonical elligble-questions-v1 template (D04.3-61/62 LOCKED, D04.4-26A LOCKED). Each
-- import is one batch recording who imported which file (its SHA-256 and name) into which
-- exam and when, and every question keeps its batch and the line of the file it came from
-- (D04.3-66 LOCKED: imported questions preserve source and batch provenance). The batch
-- carries the key the teacher's device chose for the confirmed import, so that retrying it
-- after a timeout returns the same exam instead of a second one (D04.3-65 LOCKED).
-- Ownership: Secure Assessment. Batches are never changed or deleted.

BEGIN;

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM elligble_migration_history WHERE migration_id = '0048_secure_assessment_question_import_batches') THEN
        RAISE NOTICE 'Migration 0048_secure_assessment_question_import_batches already applied. Skipping.';
        RETURN;
    END IF;

    CREATE TABLE public.secure_assessment_question_import_batches (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id UUID NOT NULL,
        exam_instance_id UUID NOT NULL,
        imported_by_person_id UUID NOT NULL,
        import_key UUID NOT NULL,
        template TEXT NOT NULL,
        source_file_name TEXT NULL,
        source_sha256 TEXT NOT NULL,
        question_count INTEGER NOT NULL,
        imported_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT fk_sa_question_import_batch_instance FOREIGN KEY (exam_instance_id, tenant_id)
            REFERENCES public.secure_assessment_exam_instances (id, tenant_id) ON DELETE RESTRICT,
        CONSTRAINT uq_sa_question_import_batch_scope UNIQUE (id, tenant_id, exam_instance_id),
        CONSTRAINT uq_sa_question_import_batch_key UNIQUE (tenant_id, imported_by_person_id, import_key),
        CONSTRAINT ck_sa_question_import_batch_template CHECK (template = 'elligble-questions-v1'),
        CONSTRAINT ck_sa_question_import_batch_file_name CHECK (
            source_file_name IS NULL OR char_length(source_file_name) BETWEEN 1 AND 255
        ),
        CONSTRAINT ck_sa_question_import_batch_sha256 CHECK (source_sha256 ~ '^[0-9a-f]{64}$'),
        CONSTRAINT ck_sa_question_import_batch_count CHECK (question_count > 0)
    );

    CREATE INDEX idx_sa_question_import_batches_exam
        ON public.secure_assessment_question_import_batches (tenant_id, exam_instance_id);

    CREATE FUNCTION public.prevent_sa_question_import_batch_mutation()
    RETURNS TRIGGER AS $trg$
    BEGIN
        RAISE EXCEPTION 'Question import batches are append-only.';
    END;
    $trg$ LANGUAGE plpgsql;

    CREATE TRIGGER trg_prevent_sa_question_import_batch_mutation
        BEFORE UPDATE OR DELETE ON public.secure_assessment_question_import_batches
        FOR EACH ROW EXECUTE FUNCTION public.prevent_sa_question_import_batch_mutation();

    -- Line 1 of a file is at least the header, so an imported question comes from line 2 or later.
    ALTER TABLE public.secure_assessment_exam_question_snapshots
        ADD COLUMN import_batch_id UUID NULL,
        ADD COLUMN import_source_line INTEGER NULL,
        ADD CONSTRAINT fk_sa_snapshot_import_batch FOREIGN KEY (import_batch_id, tenant_id, exam_instance_id)
            REFERENCES public.secure_assessment_question_import_batches (id, tenant_id, exam_instance_id) ON DELETE RESTRICT,
        ADD CONSTRAINT ck_sa_snapshot_import_source CHECK (
            (import_batch_id IS NULL AND import_source_line IS NULL)
            OR (import_batch_id IS NOT NULL AND import_source_line > 1)
        );

    INSERT INTO elligble_migration_history (migration_id) VALUES ('0048_secure_assessment_question_import_batches');
END $$;

COMMIT;
