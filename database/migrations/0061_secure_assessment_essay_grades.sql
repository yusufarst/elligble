-- Migration 0061: essay grade revisions (ASSESS-QUESTION-008 §4.2; Owner O02-9/O02-10, A01-3)
-- Purpose: the managing Teacher's grades of essay answers, one append-only row per revision.
-- The current grade of an answer is its highest revision. A grade always belongs to an
-- existing answer (composite FK to uq_sa_exam_answer_current). graded_by_person_id is a
-- cross-domain reference without a database FK, as in 0002. No existing table changes; no
-- backfill. Ownership: Secure Assessment.
BEGIN;
DO $migration$
BEGIN
    IF EXISTS (SELECT 1 FROM elligble_migration_history WHERE migration_id = '0061_secure_assessment_essay_grades') THEN
        RETURN;
    END IF;

    CREATE TABLE public.secure_assessment_essay_grade_revisions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id UUID NOT NULL,
        exam_attempt_id UUID NOT NULL,
        exam_question_snapshot_id UUID NOT NULL,
        revision INTEGER NOT NULL,
        score_micro BIGINT NOT NULL,
        graded_by_person_id UUID NOT NULL,
        graded_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT statement_timestamp(),
        CONSTRAINT ck_sa_essay_grade_revision CHECK (revision >= 1),
        CONSTRAINT ck_sa_essay_grade_score CHECK (score_micro >= 0),
        CONSTRAINT fk_sa_essay_grade_answer FOREIGN KEY (tenant_id, exam_attempt_id, exam_question_snapshot_id)
            REFERENCES public.secure_assessment_exam_answers (tenant_id, exam_attempt_id, exam_question_snapshot_id) ON DELETE RESTRICT,
        CONSTRAINT uq_sa_essay_grade_revision UNIQUE (tenant_id, exam_attempt_id, exam_question_snapshot_id, revision)
    );

    CREATE FUNCTION public.prevent_sa_essay_grade_mutation()
    RETURNS TRIGGER AS $trg$
    BEGIN
        RAISE EXCEPTION 'Essay grade revisions are append-only.';
    END;
    $trg$ LANGUAGE plpgsql;

    CREATE TRIGGER trg_prevent_sa_essay_grade_mutation
        BEFORE UPDATE OR DELETE ON public.secure_assessment_essay_grade_revisions
        FOR EACH ROW EXECUTE FUNCTION public.prevent_sa_essay_grade_mutation();

    INSERT INTO elligble_migration_history (migration_id) VALUES ('0061_secure_assessment_essay_grades');
END; $migration$;
COMMIT;
