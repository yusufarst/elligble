-- Migration 0014 - BU-038 Academic Core Grade Level Core State Persistence
-- Purpose: Establish authoritative tenant-scoped configurable Grade Level identity.

BEGIN;

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM elligble_migration_history WHERE migration_id = '0014_bu038_academic_core_grade_level_core_state') THEN
        RAISE NOTICE 'Migration 0014_bu038_academic_core_grade_level_core_state already applied, skipping.';
        RETURN;
    END IF;

    CREATE TABLE academic_core_grade_levels (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id UUID NOT NULL,
        display_label VARCHAR(255) NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT chk_ac_grade_level_display_label_non_blank CHECK (btrim(display_label) <> ''),
        UNIQUE (id, tenant_id)
    );

    INSERT INTO elligble_migration_history (migration_id) VALUES ('0014_bu038_academic_core_grade_level_core_state');
END $$;

COMMIT;
