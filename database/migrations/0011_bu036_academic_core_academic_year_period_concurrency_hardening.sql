-- Migration 0011: BU-036 Academic Core Academic Year and Period Concurrency Hardening
-- Purpose: Harden the date-containment invariant against concurrent parent-date updates and child Period inserts/updates.

BEGIN;

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM elligble_migration_history WHERE migration_id = '0011_bu036_academic_core_academic_year_period_concurrency_hardening') THEN
        RAISE NOTICE 'Migration 0011_bu036_academic_core_academic_year_period_concurrency_hardening already applied. Skipping.';
        RETURN;
    END IF;

    -- B. Verify existing rows satisfy the constraint before finalizing 0011
    IF EXISTS (
        SELECT 1 
        FROM academic_core_academic_periods p
        JOIN academic_core_academic_years y 
          ON p.academic_year_id = y.id AND p.tenant_id = y.tenant_id
        WHERE p.start_date < y.start_date OR p.end_date > y.end_date
    ) THEN
        RAISE EXCEPTION 'Existing periods violate parent year date boundaries.';
    END IF;

    -- C. Replace/harden the containment locking mechanism using SELECT ... FOR SHARE
    -- We use a new function and trigger name so that a repeat of 0010 does not overwrite our concurrency hardening.
    EXECUTE $ddl$
    CREATE OR REPLACE FUNCTION fn_academic_core_period_date_containment_concurrency()
    RETURNS TRIGGER AS $inner$
    DECLARE
        v_year_start DATE;
        v_year_end DATE;
    BEGIN
        SELECT start_date, end_date INTO v_year_start, v_year_end
        FROM academic_core_academic_years
        WHERE id = NEW.academic_year_id AND tenant_id = NEW.tenant_id
        FOR SHARE;

        IF NOT FOUND THEN
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
    $inner$ LANGUAGE plpgsql;
    
    DROP TRIGGER IF EXISTS trg_ac_period_date_containment_concurrency ON academic_core_academic_periods;
    CREATE TRIGGER trg_ac_period_date_containment_concurrency
    BEFORE INSERT OR UPDATE OF start_date, end_date, academic_year_id, tenant_id
    ON academic_core_academic_periods
    FOR EACH ROW
    EXECUTE FUNCTION fn_academic_core_period_date_containment_concurrency();
    
    -- Optional: We could drop the 0010 trigger here, but 0010 will recreate it on repeat anyway.
    -- Having both is safe. We will drop it here to prevent duplicate execution on the first run.
    DROP TRIGGER IF EXISTS trg_ac_period_date_containment ON academic_core_academic_periods;
    
    $ddl$;

    -- Record migration application
    INSERT INTO elligble_migration_history (migration_id) VALUES ('0011_bu036_academic_core_academic_year_period_concurrency_hardening');
END $$;

COMMIT;
