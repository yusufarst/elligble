-- Migration 0012: BU-037 Academic Core Subject Core State Persistence Bootstrap
-- Purpose: Persistence foundation for stable tenant-scoped Subject identity.

BEGIN;

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM elligble_migration_history WHERE migration_id = '0012_bu037_academic_core_subject_core_state') THEN
        RAISE NOTICE 'Migration 0012_bu037_academic_core_subject_core_state already applied. Skipping.';
        RETURN;
    END IF;

    -- Academic Core Domain: Subject
    -- Truth: Tenant-scoped, stable identity, independent from Academic Year/Period/Grade/Rombel/Curriculum.
    CREATE TABLE IF NOT EXISTS academic_core_subjects (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id UUID NOT NULL,
        display_label VARCHAR(255) NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT uq_ac_subjects_tenant UNIQUE (id, tenant_id)
    );

    -- Record migration application
    INSERT INTO elligble_migration_history (migration_id) VALUES ('0012_bu037_academic_core_subject_core_state');
END $$;

COMMIT;
