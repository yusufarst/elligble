-- Migration 0006: BU-009 Secure Assessment Idempotent Submission Core State Persistence Bootstrap
-- Purpose: Persistence foundation for BU-009

BEGIN;

-- Check for safe repeat invocation (idempotency)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM elligble_migration_history WHERE migration_id = '0006_bu009_secure_assessment_idempotent_submission_core_state') THEN
        RAISE NOTICE 'Migration 0006_bu009_secure_assessment_idempotent_submission_core_state already applied. Skipping.';
        RETURN;
    END IF;

    -- 1. Secure Assessment Domain: Exam Submissions
    CREATE TABLE IF NOT EXISTS secure_assessment_exam_submissions (
        id UUID NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id UUID NOT NULL,
        exam_attempt_id UUID NOT NULL,
        submitted_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT fk_sa_submission_attempt FOREIGN KEY (exam_attempt_id, tenant_id) REFERENCES secure_assessment_exam_attempts (id, tenant_id) ON DELETE RESTRICT,
        CONSTRAINT uq_sa_submission_attempt UNIQUE (tenant_id, exam_attempt_id),
        CONSTRAINT uq_sa_submission_tenant UNIQUE (id, tenant_id)
    );

    -- Record migration application
    INSERT INTO elligble_migration_history (migration_id) VALUES ('0006_bu009_secure_assessment_idempotent_submission_core_state');
END $$;

COMMIT;
