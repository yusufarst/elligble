-- Migration 0009: BU-036 Academic Core Academic Year and Period Core State Persistence Bootstrap
-- Purpose: Persistence foundation for configurable and historical academic-time context.

BEGIN;

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM elligble_migration_history WHERE migration_id = '0009_bu036_academic_core_academic_year_period_core_state') THEN
        RAISE NOTICE 'Migration 0009_bu036_academic_core_academic_year_period_core_state already applied. Skipping.';
        RETURN;
    END IF;

    -- 1. Academic Core Domain: Academic Year
    -- Truth: Tenant-scoped, historical, independent from Person/Teacher.
    CREATE TABLE IF NOT EXISTS academic_core_academic_years (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id UUID NOT NULL,
        display_label VARCHAR(255) NOT NULL,
        start_date DATE NOT NULL,
        end_date DATE NOT NULL,
        status VARCHAR(50) NOT NULL DEFAULT 'PLANNED',
        created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT uq_ac_academic_years_tenant UNIQUE (id, tenant_id)
    );

    -- 2. Academic Core Domain: Academic Period
    -- Truth: Belongs to one Academic Year, tenant-scoped, configurable.
    CREATE TABLE IF NOT EXISTS academic_core_academic_periods (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id UUID NOT NULL,
        academic_year_id UUID NOT NULL,
        display_label VARCHAR(255) NOT NULL,
        period_type VARCHAR(100) NULL,
        start_date DATE NOT NULL,
        end_date DATE NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT fk_ac_period_year FOREIGN KEY (academic_year_id, tenant_id) REFERENCES academic_core_academic_years (id, tenant_id) ON DELETE RESTRICT
    );

    -- Record migration application
    INSERT INTO elligble_migration_history (migration_id) VALUES ('0009_bu036_academic_core_academic_year_period_core_state');
END $$;

COMMIT;
