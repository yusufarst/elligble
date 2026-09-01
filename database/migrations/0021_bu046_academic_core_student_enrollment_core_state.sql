-- Migration 0021: BU-046 Academic Core Student Enrollment Core State Persistence Bootstrap
-- Purpose: Bootstrap persistence for Student Academic Enrollment with required tenant and lifecycle integrity.

BEGIN;

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM elligble_migration_history WHERE migration_id = '0021_bu046_academic_core_student_enrollment_core_state') THEN
        RAISE NOTICE 'Migration 0021_bu046_academic_core_student_enrollment_core_state already applied. Skipping.';
        RETURN;
    END IF;

    -- 1. Narrowly Necessary Supporting Constraints for Tenant-Integrity and Academic-Year Coherence
    
    -- Ensure tenant_memberships has a composite unique constraint for tenant-scoped references
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'uq_tenant_memberships_id_tenant'
    ) THEN
        ALTER TABLE tenant_memberships ADD CONSTRAINT uq_tenant_memberships_id_tenant UNIQUE (id, tenant_id);
    END IF;

    -- Ensure academic_core_academic_groups has a composite unique constraint for year coherence
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'uq_ac_groups_id_tenant_year'
    ) THEN
        ALTER TABLE academic_core_academic_groups ADD CONSTRAINT uq_ac_groups_id_tenant_year UNIQUE (id, tenant_id, academic_year_id);
    END IF;

    -- Ensure academic_core_academic_periods has a composite unique constraint for year coherence
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'uq_ac_periods_id_tenant_year'
    ) THEN
        ALTER TABLE academic_core_academic_periods ADD CONSTRAINT uq_ac_periods_id_tenant_year UNIQUE (id, tenant_id, academic_year_id);
    END IF;

    -- 2. Create academic_core_student_enrollments
    CREATE TABLE IF NOT EXISTS academic_core_student_enrollments (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id UUID NOT NULL,
        academic_year_id UUID NOT NULL,
        membership_id UUID NOT NULL,
        academic_group_id UUID NOT NULL,
        academic_period_id UUID NOT NULL,
        start_date DATE NOT NULL,
        end_date DATE,
        status VARCHAR(255) NOT NULL,
        source VARCHAR(255) NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,

        -- 3. Temporal Lifecycle Contract
        CONSTRAINT chk_ac_enrollment_dates CHECK (end_date IS NULL OR end_date >= start_date),

        -- 4. Explicit Status Contract
        CONSTRAINT chk_ac_enrollment_status_nonblank CHECK (btrim(status) <> ''),

        -- 5. Source / Provenance Contract
        CONSTRAINT chk_ac_enrollment_source_nonblank CHECK (btrim(source) <> ''),

        -- 6. Tenant and Year Coherence Integrity Contract
        CONSTRAINT fk_ac_enrollment_membership
            FOREIGN KEY (membership_id, tenant_id)
            REFERENCES tenant_memberships (id, tenant_id)
            ON DELETE RESTRICT,
            
        CONSTRAINT fk_ac_enrollment_group
            FOREIGN KEY (academic_group_id, tenant_id, academic_year_id)
            REFERENCES academic_core_academic_groups (id, tenant_id, academic_year_id)
            ON DELETE RESTRICT,
            
        CONSTRAINT fk_ac_enrollment_period
            FOREIGN KEY (academic_period_id, tenant_id, academic_year_id)
            REFERENCES academic_core_academic_periods (id, tenant_id, academic_year_id)
            ON DELETE RESTRICT
    );

    -- Record migration application
    INSERT INTO elligble_migration_history (migration_id) VALUES ('0021_bu046_academic_core_student_enrollment_core_state');
END $$;

COMMIT;
