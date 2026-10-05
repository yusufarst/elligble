-- Migration 0045: result finalization of an exam
-- Purpose: explicit, audited finalization that freezes the governed Assessment Result state
-- (D04.8-17/20/56/57, D04.2-83; Owner decision 2026-09-30: once no legitimate active attempt
-- remains, an ended exam may proceed through result finalization). One finalization per
-- exam records who finalized it, when, with which scoring rule and the pending-issue state;
-- one result row per participant keeps the computed outcome, so later edits to questions,
-- enrollment, assignments or default scoring rules cannot change a finalized result. The
-- answers themselves are not touched (D04.8-19). A participant who did not work on the exam
-- is ABSENT, never a zero score (D04.4-12). Finalization does not publish anything to
-- students (D04.8-21).
-- Ownership: Secure Assessment. Rows are never updated or deleted by the application.

BEGIN;

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM elligble_migration_history WHERE migration_id = '0045_secure_assessment_result_finalization') THEN
        RAISE NOTICE 'Migration 0045_secure_assessment_result_finalization already applied. Skipping.';
        RETURN;
    END IF;

    CREATE TABLE public.secure_assessment_exam_result_finalizations (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id UUID NOT NULL,
        exam_instance_id UUID NOT NULL,
        finalized_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT statement_timestamp(),
        finalized_by_person_id UUID NOT NULL,
        scoring_rule TEXT NOT NULL,
        question_count INTEGER NOT NULL,
        max_score_micro BIGINT NOT NULL,
        -- Issues still open when the result was finalized (D04.8-57); none can block the
        -- baseline today, the record keeps the state explicit.
        pending_issues JSONB NOT NULL DEFAULT '[]'::jsonb,
        CONSTRAINT fk_sa_result_finalization_instance FOREIGN KEY (exam_instance_id, tenant_id)
            REFERENCES public.secure_assessment_exam_instances (id, tenant_id) ON DELETE RESTRICT,
        CONSTRAINT uq_sa_result_finalization_exam UNIQUE (tenant_id, exam_instance_id),
        CONSTRAINT uq_sa_result_finalization_tenant UNIQUE (id, tenant_id),
        CONSTRAINT ck_sa_result_finalization_values CHECK (
            length(trim(scoring_rule)) > 0 AND question_count > 0 AND max_score_micro > 0
            AND jsonb_typeof(pending_issues) = 'array'
        )
    );

    CREATE TABLE public.secure_assessment_attempt_results (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id UUID NOT NULL,
        finalization_id UUID NOT NULL,
        exam_participant_id UUID NOT NULL,
        exam_attempt_id UUID NULL,
        standing TEXT NOT NULL,
        finalization_source TEXT NULL,
        submitted_at TIMESTAMP WITH TIME ZONE NULL,
        correct_count INTEGER NULL,
        incorrect_count INTEGER NULL,
        unanswered_count INTEGER NULL,
        raw_score_micro BIGINT NULL,
        max_score_micro BIGINT NULL,
        scaled_score NUMERIC(5, 2) NULL,
        -- Per question, in the exam's order: snapshot id, selected option (or null), outcome
        -- and the micro-points earned and possible (D04.8-03 raw scoring reconstructable).
        item_outcomes JSONB NULL,
        CONSTRAINT fk_sa_attempt_result_finalization FOREIGN KEY (finalization_id, tenant_id)
            REFERENCES public.secure_assessment_exam_result_finalizations (id, tenant_id) ON DELETE RESTRICT,
        CONSTRAINT fk_sa_attempt_result_participant FOREIGN KEY (exam_participant_id, tenant_id)
            REFERENCES public.secure_assessment_exam_participants (id, tenant_id) ON DELETE RESTRICT,
        CONSTRAINT fk_sa_attempt_result_attempt FOREIGN KEY (exam_attempt_id, tenant_id)
            REFERENCES public.secure_assessment_exam_attempts (id, tenant_id) ON DELETE RESTRICT,
        CONSTRAINT uq_sa_attempt_result_participant UNIQUE (finalization_id, exam_participant_id),
        CONSTRAINT ck_sa_attempt_result_standing CHECK (
            (standing = 'SUBMITTED'
                AND exam_attempt_id IS NOT NULL AND submitted_at IS NOT NULL
                AND num_nonnulls(correct_count, incorrect_count, unanswered_count, raw_score_micro, max_score_micro, scaled_score, item_outcomes) = 7
                AND correct_count >= 0 AND incorrect_count >= 0 AND unanswered_count >= 0
                AND raw_score_micro >= 0 AND max_score_micro > 0 AND raw_score_micro <= max_score_micro
                AND scaled_score BETWEEN 0 AND 100
                AND jsonb_typeof(item_outcomes) = 'array')
            OR (standing = 'ABSENT'
                AND submitted_at IS NULL AND finalization_source IS NULL
                AND correct_count IS NULL AND incorrect_count IS NULL AND unanswered_count IS NULL
                AND raw_score_micro IS NULL AND max_score_micro IS NULL AND scaled_score IS NULL
                AND item_outcomes IS NULL)
        ),
        CONSTRAINT ck_sa_attempt_result_source CHECK (
            finalization_source IS NULL OR finalization_source IN ('STUDENT_SUBMIT', 'EXPIRY_CLIENT', 'EXPIRY_SERVER')
        )
    );

    CREATE INDEX idx_sa_attempt_results_finalization
        ON public.secure_assessment_attempt_results (tenant_id, finalization_id);

    CREATE FUNCTION public.prevent_sa_result_finalization_mutation()
    RETURNS TRIGGER AS $trg$
    BEGIN
        RAISE EXCEPTION 'Finalized results are append-only.';
    END;
    $trg$ LANGUAGE plpgsql;

    CREATE TRIGGER trg_prevent_sa_result_finalization_mutation
        BEFORE UPDATE OR DELETE ON public.secure_assessment_exam_result_finalizations
        FOR EACH ROW EXECUTE FUNCTION public.prevent_sa_result_finalization_mutation();

    CREATE TRIGGER trg_prevent_sa_attempt_result_mutation
        BEFORE UPDATE OR DELETE ON public.secure_assessment_attempt_results
        FOR EACH ROW EXECUTE FUNCTION public.prevent_sa_result_finalization_mutation();

    INSERT INTO elligble_migration_history (migration_id) VALUES ('0045_secure_assessment_result_finalization');
END $$;

COMMIT;
