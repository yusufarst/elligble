-- Migration 0038: authored question order for exam question snapshots
-- Purpose: questions are delivered in the order the exam was authored (D04.3-35, D04.3-41
-- fixed order; D04.2-57..59 the order a participant received is reconstructable and is
-- never reshuffled on recovery). Snapshots are immutable after insert, so the position is
-- written when the snapshot is created. Legacy snapshots without a position are delivered
-- after positioned ones, in their previous identifier order.
-- Ownership: Secure Assessment.

BEGIN;

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM elligble_migration_history WHERE migration_id = '0038_secure_assessment_question_display_order') THEN
        RAISE NOTICE 'Migration 0038_secure_assessment_question_display_order already applied. Skipping.';
        RETURN;
    END IF;

    ALTER TABLE public.secure_assessment_exam_question_snapshots
        ADD COLUMN display_order INTEGER NULL,
        ADD CONSTRAINT ck_sa_snapshot_display_order_positive CHECK (display_order IS NULL OR display_order > 0);

    CREATE UNIQUE INDEX uq_sa_snapshot_display_order
        ON public.secure_assessment_exam_question_snapshots (tenant_id, exam_instance_id, display_order)
        WHERE display_order IS NOT NULL;

    INSERT INTO elligble_migration_history (migration_id) VALUES ('0038_secure_assessment_question_display_order');
END $$;

COMMIT;
