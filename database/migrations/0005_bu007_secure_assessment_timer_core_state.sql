-- Migration 0005: BU-007 Secure Assessment Server-Authoritative Timer Core State Persistence Bootstrap
-- Purpose: Authoritative timer state and adjustments bound to Attempt.

BEGIN;

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM elligble_migration_history WHERE migration_id = '0005_bu007_secure_assessment_timer_core_state') THEN
        RAISE NOTICE 'Migration 0005_bu007_secure_assessment_timer_core_state already applied. Skipping.';
        RETURN;
    END IF;

    -- 1. Secure Assessment Timer State
    CREATE TABLE IF NOT EXISTS secure_assessment_timer_state (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id UUID NOT NULL,
        exam_attempt_id UUID NOT NULL,
        configured_duration_seconds INTEGER NOT NULL,
        started_at TIMESTAMP WITH TIME ZONE NULL,
        created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT fk_sa_timer_attempt FOREIGN KEY (exam_attempt_id, tenant_id) REFERENCES secure_assessment_exam_attempts (id, tenant_id) ON DELETE RESTRICT,
        CONSTRAINT uq_sa_timer_state_attempt UNIQUE (tenant_id, exam_attempt_id),
        CONSTRAINT uq_sa_timer_state_tenant UNIQUE (id, tenant_id),
        CONSTRAINT chk_sa_timer_duration_positive CHECK (configured_duration_seconds > 0)
    );

    -- 2. Secure Assessment Timer Adjustments
    CREATE TABLE IF NOT EXISTS secure_assessment_timer_adjustments (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id UUID NOT NULL,
        timer_state_id UUID NOT NULL,
        adjustment_seconds INTEGER NOT NULL,
        reason VARCHAR(500) NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT fk_sa_timer_adj_timer FOREIGN KEY (timer_state_id, tenant_id) REFERENCES secure_assessment_timer_state (id, tenant_id) ON DELETE RESTRICT,
        CONSTRAINT chk_sa_timer_adj_seconds_nonzero CHECK (adjustment_seconds != 0),
        CONSTRAINT chk_sa_timer_adj_reason_nonempty CHECK (LENGTH(TRIM(reason)) > 0)
    );

    -- Index for adjustment retrieval by timer
    CREATE INDEX idx_sa_timer_adj_timer_tenant ON secure_assessment_timer_adjustments (tenant_id, timer_state_id);

    -- Record migration application
    INSERT INTO elligble_migration_history (migration_id) VALUES ('0005_bu007_secure_assessment_timer_core_state');
END $$;

COMMIT;
