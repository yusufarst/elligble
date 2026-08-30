-- Migration 0010: BU-036 Academic Core Academic Year and Period Core State Remediation
-- Purpose: Remediation for BU-036 persistence: removes unapproved status vocabulary,
--          enforces intra-table date-range ordering, and enforces parent-year date containment.

BEGIN;

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM elligble_migration_history WHERE migration_id = '0010_bu036_academic_core_academic_year_period_core_state_remediation') THEN
        RAISE NOTICE 'Migration 0010_bu036_academic_core_academic_year_period_core_state_remediation already applied. Skipping.';
        RETURN;
    END IF;

    -- 1. Remove unapproved Academic Year status column
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'academic_core_academic_years'
          AND column_name = 'status'
    ) THEN
        ALTER TABLE academic_core_academic_years DROP COLUMN status;
    END IF;

    -- 2. Enforce Academic Year start_date <= end_date
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'chk_ac_year_dates'
    ) THEN
        ALTER TABLE academic_core_academic_years
            ADD CONSTRAINT chk_ac_year_dates CHECK (start_date <= end_date);
    END IF;

    -- 3. Enforce Academic Period start_date <= end_date
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'chk_ac_period_dates'
    ) THEN
        ALTER TABLE academic_core_academic_periods
            ADD CONSTRAINT chk_ac_period_dates CHECK (start_date <= end_date);
    END IF;

    -- Record migration application
    INSERT INTO elligble_migration_history (migration_id) VALUES ('0010_bu036_academic_core_academic_year_period_core_state_remediation');
END $$;

-- 4. Cross-table date containment trigger functions & triggers (Outside DO block for standard DDL)
CREATE OR REPLACE FUNCTION fn_academic_core_period_date_containment()
RETURNS TRIGGER AS $$
DECLARE
    v_year_start DATE;
    v_year_end DATE;
BEGIN
    SELECT start_date, end_date INTO v_year_start, v_year_end
    FROM academic_core_academic_years
    WHERE id = NEW.academic_year_id AND tenant_id = NEW.tenant_id;

    IF NOT FOUND THEN
        -- Let FK constraint handle nonexistent parent, or raise if triggered first
        RETURN NEW;
    END IF;

    IF NEW.start_date < v_year_start THEN
        RAISE EXCEPTION 'Academic Period start_date (%) cannot precede parent Academic Year start_date (%)', NEW.start_date, v_year_start;
    END IF;

    IF NEW.end_date > v_year_end THEN
        RAISE EXCEPTION 'Academic Period end_date (%) cannot succeed parent Academic Year end_date (%)', NEW.end_date, v_year_end;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_ac_period_date_containment ON academic_core_academic_periods;
CREATE TRIGGER trg_ac_period_date_containment
BEFORE INSERT OR UPDATE OF start_date, end_date, academic_year_id, tenant_id
ON academic_core_academic_periods
FOR EACH ROW
EXECUTE FUNCTION fn_academic_core_period_date_containment();

CREATE OR REPLACE FUNCTION fn_academic_core_year_date_containment()
RETURNS TRIGGER AS $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM academic_core_academic_periods p
        WHERE p.academic_year_id = NEW.id
          AND p.tenant_id = NEW.tenant_id
          AND (p.start_date < NEW.start_date OR p.end_date > NEW.end_date)
    ) THEN
        RAISE EXCEPTION 'Academic Year date range must contain all child Academic Periods';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_ac_year_date_containment ON academic_core_academic_years;
CREATE TRIGGER trg_ac_year_date_containment
BEFORE UPDATE OF start_date, end_date
ON academic_core_academic_years
FOR EACH ROW
EXECUTE FUNCTION fn_academic_core_year_date_containment();

COMMIT;
