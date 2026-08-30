-- Migration 0008: BU-034 Secure Assessment Explicit Proctor Assignment Core State
-- Purpose: Implement the smallest persistence foundation needed for explicit Secure Assessment Proctor Assignment.

BEGIN;

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM elligble_migration_history WHERE migration_id = '0008_bu034_secure_assessment_explicit_proctor_assignment_core_state') THEN
        RAISE NOTICE 'Migration 0008_bu034_secure_assessment_explicit_proctor_assignment_core_state already applied. Skipping.';
        RETURN;
    END IF;

    CREATE TABLE IF NOT EXISTS secure_assessment_proctor_assignments (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id UUID NOT NULL,
        exam_instance_id UUID NOT NULL,
        person_id UUID NOT NULL,
        assigned_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
        revoked_at TIMESTAMP WITH TIME ZONE NULL,
        CONSTRAINT fk_sa_proctor_assignment_instance
            FOREIGN KEY (exam_instance_id, tenant_id)
            REFERENCES secure_assessment_exam_instances (id, tenant_id)
            ON DELETE RESTRICT,
        CONSTRAINT chk_sa_proctor_assignment_temporal
            CHECK (revoked_at IS NULL OR revoked_at >= assigned_at)
    );

    CREATE UNIQUE INDEX uq_sa_proctor_assignment_active
    ON secure_assessment_proctor_assignments (tenant_id, exam_instance_id, person_id)
    WHERE revoked_at IS NULL;

    INSERT INTO elligble_migration_history (migration_id) VALUES ('0008_bu034_secure_assessment_explicit_proctor_assignment_core_state');
END $$;

COMMIT;
