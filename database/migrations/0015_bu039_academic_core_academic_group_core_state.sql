-- Migration 0015: BU-039 Academic Core Academic Group (Rombel) Core State Persistence Bootstrap
-- Depends on: 0014

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM elligble_migration_history
        WHERE migration_id = '0015_bu039_academic_core_academic_group_core_state'
    ) THEN
        -- Create academic_core_academic_groups table
        CREATE TABLE academic_core_academic_groups (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            tenant_id UUID NOT NULL,
            academic_year_id UUID NOT NULL,
            grade_level_id UUID NOT NULL,
            display_label VARCHAR(255) NOT NULL,
            created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,

            -- Composite Unique
            CONSTRAINT uq_academic_core_academic_groups_id_tenant UNIQUE (id, tenant_id),

            -- Nonblank display_label
            CONSTRAINT chk_ac_academic_group_display_label_non_blank CHECK (btrim(display_label) <> ''),

            -- Tenant-scoped composite FK to academic_years
            CONSTRAINT fk_ac_academic_groups_year_tenant
                FOREIGN KEY (academic_year_id, tenant_id)
                REFERENCES academic_core_academic_years(id, tenant_id)
                ON DELETE RESTRICT,

            -- Tenant-scoped composite FK to grade_levels
            CONSTRAINT fk_ac_academic_groups_grade_tenant
                FOREIGN KEY (grade_level_id, tenant_id)
                REFERENCES academic_core_grade_levels(id, tenant_id)
                ON DELETE RESTRICT
        );

        -- Record migration
        INSERT INTO elligble_migration_history (migration_id)
        VALUES ('0015_bu039_academic_core_academic_group_core_state');
    END IF;
END $$;
