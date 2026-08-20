-- Migration 0004: BU-004 Secure Assessment Answer Persistence Core State Bootstrap
-- Purpose: Authoritative answer state bound to Attempt and immutable Snapshot.

BEGIN;

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM elligble_migration_history WHERE migration_id = '0004_bu004_secure_assessment_answer_persistence_core_state') THEN
        RAISE NOTICE 'Migration 0004_bu004_secure_assessment_answer_persistence_core_state already applied. Skipping.';
        RETURN;
    END IF;

    -- 1. Authoritative Answer State
    CREATE TABLE IF NOT EXISTS secure_assessment_exam_answers (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id UUID NOT NULL,
        exam_attempt_id UUID NOT NULL,
        exam_question_snapshot_id UUID NOT NULL,
        answer_payload JSONB NOT NULL DEFAULT '{}',
        client_write_identity VARCHAR(255),
        write_version INTEGER NOT NULL DEFAULT 1,
        created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT fk_sa_answer_attempt FOREIGN KEY (exam_attempt_id, tenant_id) REFERENCES secure_assessment_exam_attempts (id, tenant_id) ON DELETE RESTRICT,
        CONSTRAINT fk_sa_answer_snapshot FOREIGN KEY (exam_question_snapshot_id, tenant_id) REFERENCES secure_assessment_exam_question_snapshots (id, tenant_id) ON DELETE RESTRICT,
        CONSTRAINT uq_sa_exam_answer_current UNIQUE (tenant_id, exam_attempt_id, exam_question_snapshot_id),
        CONSTRAINT uq_sa_exam_answers_tenant UNIQUE (id, tenant_id)
    );

    -- Index for Query A: Tenant-scoped Attempt retrieval
    CREATE INDEX idx_sa_answers_attempt_tenant ON secure_assessment_exam_answers (tenant_id, exam_attempt_id);

    -- (Query B is explicitly supported by the unique constraint index uq_sa_exam_answer_current which has prefix tenant_id, exam_attempt_id, exam_question_snapshot_id)

    -- 2. Context Safety: Ensure Attempt and Snapshot belong to the same Exam Instance
    CREATE OR REPLACE FUNCTION verify_sa_answer_context()
    RETURNS TRIGGER AS $trg$
    DECLARE
        v_attempt_instance_id UUID;
        v_snapshot_instance_id UUID;
    BEGIN
        -- Get Exam Instance from Attempt
        SELECT p.exam_instance_id INTO v_attempt_instance_id
        FROM secure_assessment_exam_attempts a
        JOIN secure_assessment_exam_participants p ON p.id = a.exam_participant_id AND p.tenant_id = a.tenant_id
        WHERE a.id = NEW.exam_attempt_id AND a.tenant_id = NEW.tenant_id;

        -- Get Exam Instance from Snapshot
        SELECT exam_instance_id INTO v_snapshot_instance_id
        FROM secure_assessment_exam_question_snapshots
        WHERE id = NEW.exam_question_snapshot_id AND tenant_id = NEW.tenant_id;

        IF v_attempt_instance_id IS NOT NULL AND v_snapshot_instance_id IS NOT NULL AND v_attempt_instance_id != v_snapshot_instance_id THEN
            RAISE EXCEPTION 'Attempt and Snapshot belong to incompatible Exam Instance contexts.';
        END IF;

        RETURN NEW;
    END;
    $trg$ LANGUAGE plpgsql;

    CREATE TRIGGER trg_verify_sa_answer_context
    BEFORE INSERT OR UPDATE ON secure_assessment_exam_answers
    FOR EACH ROW
    EXECUTE FUNCTION verify_sa_answer_context();

    -- Record migration application
    INSERT INTO elligble_migration_history (migration_id) VALUES ('0004_bu004_secure_assessment_answer_persistence_core_state');
END $$;

COMMIT;
