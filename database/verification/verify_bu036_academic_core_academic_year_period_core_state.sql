-- Verification for Migration 0009: BU-036 Academic Core Academic Year and Period Core State Persistence Bootstrap

BEGIN;

DO $$
DECLARE
    t_count INT;
    migration_count INT;
    col_exists BOOLEAN;
    fk_count INT;
    constraint_count INT;
BEGIN
    -- Verify tables exist (Migrations 0001-0009 should result in exactly 2 new tables)
    SELECT count(*) INTO t_count 
    FROM information_schema.tables 
    WHERE table_schema = 'public' 
      AND table_name IN ('academic_core_academic_years', 'academic_core_academic_periods');
      
    IF t_count != 2 THEN
        RAISE EXCEPTION 'FAIL: Expected exactly 2 academic core tables for BU-036, found %', t_count;
    END IF;

    -- Verify no other unexpected academic core tables
    SELECT count(*) INTO t_count 
    FROM information_schema.tables 
    WHERE table_schema = 'public' 
      AND table_name LIKE 'academic_core_%'
      AND table_name NOT IN ('academic_core_academic_years', 'academic_core_academic_periods');
      
    IF t_count != 0 THEN
        RAISE EXCEPTION 'FAIL: Found unintended academic_core table breadth';
    END IF;

    -- Academic Year is tenant scoped
    SELECT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'academic_core_academic_years' AND column_name = 'tenant_id' AND is_nullable = 'NO'
    ) INTO col_exists;
    IF NOT col_exists THEN RAISE EXCEPTION 'FAIL: academic_core_academic_years.tenant_id missing or nullable'; END IF;

    -- Academic Year unique per tenant
    SELECT count(*) INTO constraint_count
    FROM pg_constraint
    WHERE conrelid = 'academic_core_academic_years'::regclass 
      AND contype = 'u';
    IF constraint_count < 1 THEN RAISE EXCEPTION 'FAIL: academic_core_academic_years unique constraint missing'; END IF;

    -- Academic Period is tenant scoped
    SELECT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'academic_core_academic_periods' AND column_name = 'tenant_id' AND is_nullable = 'NO'
    ) INTO col_exists;
    IF NOT col_exists THEN RAISE EXCEPTION 'FAIL: academic_core_academic_periods.tenant_id missing or nullable'; END IF;

    -- Academic Period FK requires existing Academic Year (intra-domain tenant-bound FK)
    SELECT count(*) INTO fk_count
    FROM pg_constraint c
    JOIN pg_class t1 ON t1.oid = c.conrelid
    JOIN pg_class t2 ON t2.oid = c.confrelid
    WHERE c.contype = 'f'
      AND t1.relname = 'academic_core_academic_periods'
      AND t2.relname = 'academic_core_academic_years';
      
    IF fk_count != 1 THEN RAISE EXCEPTION 'FAIL: academic_core_academic_periods -> academic_core_academic_years FK not exactly 1 (found %)', fk_count; END IF;

    -- Verify migration history
    SELECT COUNT(*) INTO migration_count FROM elligble_migration_history WHERE migration_id = '0009_bu036_academic_core_academic_year_period_core_state';
    IF migration_count != 1 THEN RAISE EXCEPTION 'FAIL: Migration history count for BU-036 is % (expected 1)', migration_count; END IF;

    -- RUNTIME TESTS

    -- Insert Tenant
    INSERT INTO tenant_tenants (id) VALUES ('10000000-0000-0000-0000-000000000000');
    INSERT INTO tenant_tenants (id) VALUES ('20000000-0000-0000-0000-000000000000');

    -- Insert multiple historical Academic Years for tenant 1
    INSERT INTO academic_core_academic_years (id, tenant_id, display_label, start_date, end_date) 
    VALUES ('c1000000-0000-0000-0000-000000000000', '10000000-0000-0000-0000-000000000000', '2024/2025', '2024-07-01', '2025-06-30');
    
    INSERT INTO academic_core_academic_years (id, tenant_id, display_label, start_date, end_date) 
    VALUES ('c2000000-0000-0000-0000-000000000000', '10000000-0000-0000-0000-000000000000', '2025/2026', '2025-07-01', '2026-06-30');

    -- Insert Academic Year for tenant 2 with SAME label (no global collision)
    INSERT INTO academic_core_academic_years (id, tenant_id, display_label, start_date, end_date) 
    VALUES ('c3000000-0000-0000-0000-000000000000', '20000000-0000-0000-0000-000000000000', '2025/2026', '2025-07-01', '2026-06-30');

    -- Insert multiple Academic Periods for a single Academic Year
    INSERT INTO academic_core_academic_periods (id, tenant_id, academic_year_id, display_label, start_date, end_date)
    VALUES ('b1000000-0000-0000-0000-000000000000', '10000000-0000-0000-0000-000000000000', 'c2000000-0000-0000-0000-000000000000', 'Semester 1', '2025-07-01', '2025-12-31');

    INSERT INTO academic_core_academic_periods (id, tenant_id, academic_year_id, display_label, start_date, end_date)
    VALUES ('b2000000-0000-0000-0000-000000000000', '10000000-0000-0000-0000-000000000000', 'c2000000-0000-0000-0000-000000000000', 'Semester 2', '2026-01-01', '2026-06-30');

    -- Insert a 3rd Academic Period (proving not hardcoded to exactly two)
    INSERT INTO academic_core_academic_periods (id, tenant_id, academic_year_id, display_label, start_date, end_date)
    VALUES ('b3000000-0000-0000-0000-000000000000', '10000000-0000-0000-0000-000000000000', 'c2000000-0000-0000-0000-000000000000', 'Remedial Term', '2026-07-01', '2026-07-15');

    -- Cross-tenant Year/Period reference (MUST FAIL because FK includes tenant_id)
    BEGIN
        INSERT INTO academic_core_academic_periods (id, tenant_id, academic_year_id, display_label, start_date, end_date)
        VALUES ('b4000000-0000-0000-0000-000000000000', '20000000-0000-0000-0000-000000000000', 'c2000000-0000-0000-0000-000000000000', 'Cross-Tenant Semester', '2025-07-01', '2025-12-31');
        RAISE EXCEPTION 'FAIL: Cross-tenant Year/Period linkage should have failed';
    EXCEPTION WHEN foreign_key_violation THEN
        -- Expected
    END;

    -- Nonexistent Academic Year (MUST FAIL)
    BEGIN
        INSERT INTO academic_core_academic_periods (id, tenant_id, academic_year_id, display_label, start_date, end_date)
        VALUES ('b5000000-0000-0000-0000-000000000000', '10000000-0000-0000-0000-000000000000', '99999999-9999-9999-9999-999999999999', 'Ghost Semester', '2025-07-01', '2025-12-31');
        RAISE EXCEPTION 'FAIL: Nonexistent Academic Year reference should have failed';
    EXCEPTION WHEN foreign_key_violation THEN
        -- Expected
    END;

    RAISE NOTICE 'BU-036 Verification SUCCESS';
END $$;

ROLLBACK;
