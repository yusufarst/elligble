-- Migration 0007: BU-017 Secure Assessment One-Active-Session Core State Persistence
-- Purpose: Implement the smallest persistence-level foundation required for one active Exam Session per Attempt

BEGIN;

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM elligble_migration_history WHERE migration_id = '0007_bu017_secure_assessment_one_active_session_core_state') THEN
        RAISE NOTICE 'Migration 0007_bu017_secure_assessment_one_active_session_core_state already applied. Skipping.';
        RETURN;
    END IF;

    -- Add unique constraint to support tenant-bound foreign key
    ALTER TABLE secure_assessment_exam_sessions
    ADD CONSTRAINT uq_sa_exam_sessions_tenant UNIQUE (id, tenant_id);

    -- Add new columns for lifecycle and supersession
    ALTER TABLE secure_assessment_exam_sessions
    ADD COLUMN activated_at TIMESTAMP WITH TIME ZONE NULL,
    ADD COLUMN ended_at TIMESTAMP WITH TIME ZONE NULL,
    ADD COLUMN superseded_by_session_id UUID NULL;

    -- Add tenant-bound self-referencing foreign key for supersession
    ALTER TABLE secure_assessment_exam_sessions
    ADD CONSTRAINT fk_sa_session_superseded
    FOREIGN KEY (superseded_by_session_id, tenant_id)
    REFERENCES secure_assessment_exam_sessions (id, tenant_id)
    ON DELETE RESTRICT;

    -- Prevent self-supersession
    ALTER TABLE secure_assessment_exam_sessions
    ADD CONSTRAINT chk_sa_session_no_self_supersede
    CHECK (superseded_by_session_id IS NULL OR superseded_by_session_id != id);

    -- Enforce at most one active Session per Attempt (per tenant)
    CREATE UNIQUE INDEX uq_sa_exam_sessions_one_active
    ON secure_assessment_exam_sessions (tenant_id, exam_attempt_id)
    WHERE activated_at IS NOT NULL AND ended_at IS NULL;

    -- Record migration application
    INSERT INTO elligble_migration_history (migration_id) VALUES ('0007_bu017_secure_assessment_one_active_session_core_state');
END $$;

COMMIT;
