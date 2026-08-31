BEGIN;

DO $$
BEGIN
    -- Add supporting UNIQUE constraint to tenant_memberships if absent
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conrelid = 'tenant_memberships'::regclass
          AND contype = 'u'
          AND pg_get_constraintdef(oid) = 'UNIQUE (id, tenant_id)'
    ) THEN
        ALTER TABLE tenant_memberships
        ADD CONSTRAINT uq_tenant_memberships_id_tenant UNIQUE (id, tenant_id);
    END IF;
END
$$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.tables
        WHERE table_schema = 'public'
          AND table_name = 'tenant_teacher_assignments'
    ) THEN

        CREATE TABLE tenant_teacher_assignments (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            tenant_id UUID NOT NULL,
            membership_id UUID NOT NULL,
            assigned_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
            revoked_at TIMESTAMP WITH TIME ZONE NULL,

            CONSTRAINT uq_tenant_teacher_assignments_id_tenant UNIQUE (id, tenant_id),
            CONSTRAINT fk_tenant_teacher_assignments_membership
                FOREIGN KEY (membership_id, tenant_id)
                REFERENCES tenant_memberships(id, tenant_id)
                ON DELETE RESTRICT,
            CONSTRAINT chk_tenant_teacher_assignments_temporal
                CHECK (revoked_at IS NULL OR revoked_at >= assigned_at)
        );

        CREATE UNIQUE INDEX udx_tenant_teacher_assignments_active
        ON tenant_teacher_assignments (tenant_id, membership_id)
        WHERE revoked_at IS NULL;

    END IF;
END
$$;

INSERT INTO elligble_migration_history (migration_id, applied_at)
VALUES (
    '0018_bu041_school_side_teacher_staff_assignment_core_state',
    CURRENT_TIMESTAMP
)
ON CONFLICT (migration_id) DO NOTHING;

COMMIT;
