BEGIN;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'secure_assessment_exam_instances'
          AND column_name = 'teaching_assignment_id'
    ) THEN
        ALTER TABLE secure_assessment_exam_instances
            ADD COLUMN teaching_assignment_id UUID NULL;
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.table_constraints
        WHERE table_schema = 'public'
          AND table_name = 'secure_assessment_exam_instances'
          AND constraint_name = 'fk_sa_exam_instances_teaching_assignment'
    ) THEN
        ALTER TABLE secure_assessment_exam_instances
            ADD CONSTRAINT fk_sa_exam_instances_teaching_assignment
            FOREIGN KEY (teaching_assignment_id, tenant_id)
            REFERENCES academic_core_teaching_assignments(id, tenant_id)
            ON DELETE RESTRICT;
    END IF;
END
$$;

CREATE INDEX IF NOT EXISTS idx_sa_exam_instances_tenant_teaching_assignment
    ON secure_assessment_exam_instances (tenant_id, teaching_assignment_id);

INSERT INTO elligble_migration_history (migration_id, applied_at)
VALUES (
    '0020_bu044_secure_assessment_exam_instance_teaching_assignment_context',
    CURRENT_TIMESTAMP
)
ON CONFLICT (migration_id) DO NOTHING;

COMMIT;
