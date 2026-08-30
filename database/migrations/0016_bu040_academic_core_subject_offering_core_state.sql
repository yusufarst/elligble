-- BU-040: Academic Core Subject Offering Core State Persistence Bootstrap

BEGIN;

-- 1. Supporting Key on Academic Period
-- Added safely for environments that don't support IF NOT EXISTS on constraints
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'uq_ac_academic_periods_tenant'
    ) THEN
        ALTER TABLE academic_core_academic_periods
        ADD CONSTRAINT uq_ac_academic_periods_tenant UNIQUE (id, tenant_id);
    END IF;
END $$;

-- 2. Create academic_core_subject_offerings
CREATE TABLE IF NOT EXISTS academic_core_subject_offerings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    subject_id UUID NOT NULL,
    academic_period_id UUID NOT NULL,
    grade_level_id UUID NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_ac_subject_offerings_tenant UNIQUE (id, tenant_id),
    CONSTRAINT fk_ac_subject_offerings_subject FOREIGN KEY (subject_id, tenant_id) REFERENCES academic_core_subjects (id, tenant_id) ON DELETE RESTRICT,
    CONSTRAINT fk_ac_subject_offerings_period FOREIGN KEY (academic_period_id, tenant_id) REFERENCES academic_core_academic_periods (id, tenant_id) ON DELETE RESTRICT,
    CONSTRAINT fk_ac_subject_offerings_grade FOREIGN KEY (grade_level_id, tenant_id) REFERENCES academic_core_grade_levels (id, tenant_id) ON DELETE RESTRICT
);

-- Insert into history
INSERT INTO elligble_migration_history (migration_id, applied_at)
VALUES ('0016_bu040_academic_core_subject_offering_core_state', CURRENT_TIMESTAMP);

COMMIT;
