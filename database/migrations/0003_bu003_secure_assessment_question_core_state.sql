-- Migration 0003: BU-003 Secure Assessment Question Core State Persistence Bootstrap
-- Purpose: Question Bank Item and immutable Exam Question Snapshot persistence foundation.

BEGIN;

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM elligble_migration_history WHERE migration_id = '0003_bu003_secure_assessment_question_core_state') THEN
        RAISE NOTICE 'Migration 0003_bu003_secure_assessment_question_core_state already applied. Skipping.';
        RETURN;
    END IF;

    -- 1. Question Bank Item
    -- Truth: Editable / reusable source question item.
    CREATE TABLE IF NOT EXISTS secure_assessment_question_bank_items (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id UUID NOT NULL,
        content_payload JSONB NOT NULL DEFAULT '{}',
        created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT uq_sa_qb_items_tenant UNIQUE (id, tenant_id)
    );

    -- Index for A: Tenant-scoped Question Bank Item retrieval
    CREATE INDEX idx_sa_qb_items_tenant ON secure_assessment_question_bank_items (tenant_id);

    -- 2. Exam Question Snapshot
    -- Truth: Stable / immutable frozen question truth for an exam context.
    CREATE TABLE IF NOT EXISTS secure_assessment_exam_question_snapshots (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id UUID NOT NULL,
        exam_instance_id UUID NOT NULL,
        source_question_bank_item_id UUID,
        frozen_content JSONB NOT NULL DEFAULT '{}',
        created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT fk_sa_eq_snapshot_instance FOREIGN KEY (exam_instance_id, tenant_id) REFERENCES secure_assessment_exam_instances (id, tenant_id) ON DELETE RESTRICT,
        CONSTRAINT fk_sa_eq_snapshot_source FOREIGN KEY (source_question_bank_item_id, tenant_id) REFERENCES secure_assessment_question_bank_items (id, tenant_id) ON DELETE RESTRICT,
        CONSTRAINT uq_sa_eq_snapshots_tenant UNIQUE (id, tenant_id)
    );

    -- Index for B: Exam-Instance-scoped Exam Question Snapshot retrieval
    CREATE INDEX idx_sa_eq_snapshots_instance_tenant ON secure_assessment_exam_question_snapshots (exam_instance_id, tenant_id);

    -- 3. Immutability Enforcement for Exam Question Snapshot
    CREATE OR REPLACE FUNCTION prevent_snapshot_mutation()
    RETURNS TRIGGER AS $trg$
    BEGIN
        RAISE EXCEPTION 'Exam Question Snapshot is immutable and cannot be updated.';
    END;
    $trg$ LANGUAGE plpgsql;

    CREATE TRIGGER trg_prevent_snapshot_mutation
    BEFORE UPDATE ON secure_assessment_exam_question_snapshots
    FOR EACH ROW
    EXECUTE FUNCTION prevent_snapshot_mutation();

    -- Record migration application
    INSERT INTO elligble_migration_history (migration_id) VALUES ('0003_bu003_secure_assessment_question_core_state');
END $$;

COMMIT;
