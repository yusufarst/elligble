BEGIN;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.tables
        WHERE table_schema = 'public'
          AND table_name = 'academic_core_teaching_assignments'
    ) THEN
        CREATE TABLE academic_core_teaching_assignments (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            tenant_id UUID NOT NULL,
            teacher_assignment_id UUID NOT NULL,
            subject_offering_id UUID NOT NULL,
            academic_group_id UUID NOT NULL,
            assigned_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
            revoked_at TIMESTAMP WITH TIME ZONE NULL,

            CONSTRAINT uq_academic_core_teaching_assignments_id_tenant
                UNIQUE (id, tenant_id),

            CONSTRAINT fk_ac_teaching_assignments_teacher
                FOREIGN KEY (teacher_assignment_id, tenant_id)
                REFERENCES tenant_teacher_assignments(id, tenant_id)
                ON DELETE RESTRICT,

            CONSTRAINT fk_ac_teaching_assignments_offering
                FOREIGN KEY (subject_offering_id, tenant_id)
                REFERENCES academic_core_subject_offerings(id, tenant_id)
                ON DELETE RESTRICT,

            CONSTRAINT fk_ac_teaching_assignments_group
                FOREIGN KEY (academic_group_id, tenant_id)
                REFERENCES academic_core_academic_groups(id, tenant_id)
                ON DELETE RESTRICT,

            CONSTRAINT chk_ac_teaching_assignments_temporal
                CHECK (revoked_at IS NULL OR revoked_at >= assigned_at)
        );

        CREATE UNIQUE INDEX udx_academic_core_teaching_assignments_active
        ON academic_core_teaching_assignments (
            tenant_id,
            teacher_assignment_id,
            subject_offering_id,
            academic_group_id
        )
        WHERE revoked_at IS NULL;
    END IF;
END
$$;

INSERT INTO elligble_migration_history (migration_id, applied_at)
VALUES (
    '0019_bu042_academic_core_teaching_assignment_core_state',
    CURRENT_TIMESTAMP
)
ON CONFLICT (migration_id) DO NOTHING;

COMMIT;