-- Verification for BU-036: Academic Core Academic Year and Period Core State Persistence Bootstrap + Remediation
-- Run this against a fresh disposable database.

\set ON_ERROR_STOP on

\echo 'Applying migrations 0001 through 0011...'
\ir ../migrations/0001_bu001_identity_tenant_foundation.sql
\ir ../migrations/0002_bu002_secure_assessment_core_state.sql
\ir ../migrations/0003_bu003_secure_assessment_question_core_state.sql
\ir ../migrations/0004_bu004_secure_assessment_answer_persistence_core_state.sql
\ir ../migrations/0005_bu007_secure_assessment_timer_core_state.sql
\ir ../migrations/0006_bu009_secure_assessment_idempotent_submission_core_state.sql
\ir ../migrations/0007_bu017_secure_assessment_one_active_session_core_state.sql
\ir ../migrations/0008_bu034_secure_assessment_explicit_proctor_assignment_core_state.sql
\ir ../migrations/0009_bu036_academic_core_academic_year_period_core_state.sql
\ir ../migrations/0010_bu036_academic_core_academic_year_period_core_state_remediation.sql
\ir ../migrations/0011_bu036_academic_core_academic_year_period_concurrency_hardening.sql

\echo 'Verifying repeat safety...'
\ir ../migrations/0009_bu036_academic_core_academic_year_period_core_state.sql
\ir ../migrations/0010_bu036_academic_core_academic_year_period_core_state_remediation.sql
\ir ../migrations/0011_bu036_academic_core_academic_year_period_concurrency_hardening.sql

\echo 'Running assertions...'
DO $$
DECLARE
    t_count INT;
    col_exists BOOLEAN;
    fk_count INT;
    constraint_count INT;
    m0009_count INT;
    m0010_count INT;
    m0011_count INT;
    v_year_id UUID;
    v_period_id UUID;
    v_read_label VARCHAR;
    v_read_period_label VARCHAR;
BEGIN
    -- 1. Table set verification: exactly 2 academic core tables
    SELECT count(*) INTO t_count
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name IN ('academic_core_academic_years', 'academic_core_academic_periods');

    IF t_count != 2 THEN
        RAISE EXCEPTION 'FAIL: Expected exactly 2 academic core tables for BU-036, found %', t_count;
    END IF;

    -- 2. Breadth check: no unintended academic_core_* tables
    SELECT count(*) INTO t_count
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name LIKE 'academic_core_%'
      AND table_name NOT IN ('academic_core_academic_years', 'academic_core_academic_periods');

    IF t_count != 0 THEN
        RAISE EXCEPTION 'FAIL: Found unintended academic_core table breadth';
    END IF;

    -- 3. Academic Year schema: tenant_id required
    SELECT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'academic_core_academic_years' AND column_name = 'tenant_id' AND is_nullable = 'NO'
    ) INTO col_exists;
    IF NOT col_exists THEN RAISE EXCEPTION 'FAIL: academic_core_academic_years.tenant_id missing or nullable'; END IF;

    -- 4. Academic Period schema: tenant_id required
    SELECT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'academic_core_academic_periods' AND column_name = 'tenant_id' AND is_nullable = 'NO'
    ) INTO col_exists;
    IF NOT col_exists THEN RAISE EXCEPTION 'FAIL: academic_core_academic_periods.tenant_id missing or nullable'; END IF;

    -- 5. Status column removal verification
    SELECT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'academic_core_academic_years' AND column_name = 'status'
    ) INTO col_exists;
    IF col_exists THEN RAISE EXCEPTION 'FAIL: unapproved status column still exists on academic_core_academic_years'; END IF;

    -- 6. Academic Year composite unique constraint on (id, tenant_id)
    SELECT count(*) INTO constraint_count
    FROM pg_constraint
    WHERE conrelid = 'academic_core_academic_years'::regclass
      AND contype = 'u';
    IF constraint_count < 1 THEN RAISE EXCEPTION 'FAIL: academic_core_academic_years unique constraint missing'; END IF;

    -- 7. Academic Period tenant-bound intra-domain FK
    SELECT count(*) INTO fk_count
    FROM pg_constraint c
    JOIN pg_class t1 ON t1.oid = c.conrelid
    JOIN pg_class t2 ON t2.oid = c.confrelid
    WHERE c.contype = 'f'
      AND t1.relname = 'academic_core_academic_periods'
      AND t2.relname = 'academic_core_academic_years';

    IF fk_count != 1 THEN RAISE EXCEPTION 'FAIL: academic_core_academic_periods -> academic_core_academic_years FK not exactly 1 (found %)', fk_count; END IF;

    -- 8. Migration history registrations
    SELECT count(*) INTO m0009_count FROM elligble_migration_history WHERE migration_id = '0009_bu036_academic_core_academic_year_period_core_state';
    IF m0009_count != 1 THEN RAISE EXCEPTION 'FAIL: Migration history count for 0009 is % (expected 1)', m0009_count; END IF;

    SELECT count(*) INTO m0010_count FROM elligble_migration_history WHERE migration_id = '0010_bu036_academic_core_academic_year_period_core_state_remediation';
    IF m0010_count != 1 THEN RAISE EXCEPTION 'FAIL: Migration history count for 0010 is % (expected 1)', m0010_count; END IF;

    SELECT count(*) INTO m0011_count FROM elligble_migration_history WHERE migration_id = '0011_bu036_academic_core_academic_year_period_concurrency_hardening';
    IF m0011_count != 1 THEN RAISE EXCEPTION 'FAIL: Migration history count for 0011 is % (expected 1)', m0011_count; END IF;

    -- 8b. Trigger and Function Counts
    SELECT count(*) INTO t_count FROM pg_proc WHERE proname IN ('fn_academic_core_period_date_containment', 'fn_academic_core_year_date_containment', 'fn_academic_core_period_date_containment_concurrency');
    IF t_count != 3 THEN RAISE EXCEPTION 'FAIL: Expected exactly 3 functions for containment, found %', t_count; END IF;

    SELECT count(*) INTO t_count FROM pg_trigger WHERE tgname IN ('trg_ac_period_date_containment', 'trg_ac_year_date_containment', 'trg_ac_period_date_containment_concurrency');
    IF t_count != 3 THEN RAISE EXCEPTION 'FAIL: Expected exactly 3 triggers for containment, found %', t_count; END IF;

    -- 9. Predecessor BU-001 regression check
    SELECT count(*) INTO t_count
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name IN ('identity_persons', 'identity_user_accounts', 'tenant_tenants', 'tenant_memberships');
    IF t_count != 4 THEN RAISE EXCEPTION 'FAIL: BU-001 predecessor regression check failed (found %/4 tables)', t_count; END IF;

    -- RUNTIME PERSISTENCE TESTS

    -- Insert Tenants
    INSERT INTO tenant_tenants (id) VALUES ('10000000-0000-0000-0000-000000000000');
    INSERT INTO tenant_tenants (id) VALUES ('20000000-0000-0000-0000-000000000000');

    -- Test 10: Academic Year start_date > end_date MUST FAIL
    BEGIN
        INSERT INTO academic_core_academic_years (id, tenant_id, display_label, start_date, end_date)
        VALUES ('c0000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000000', 'Inverted Year', '2026-06-30', '2025-07-01');
        RAISE EXCEPTION 'FAIL: Academic Year start_date > end_date should have failed';
    EXCEPTION WHEN check_violation THEN
        -- Expected
    END;

    -- Insert valid historical Academic Years for Tenant 1
    INSERT INTO academic_core_academic_years (id, tenant_id, display_label, start_date, end_date)
    VALUES ('c1000000-0000-0000-0000-000000000000', '10000000-0000-0000-0000-000000000000', '2024/2025', '2024-07-01', '2025-06-30');

    INSERT INTO academic_core_academic_years (id, tenant_id, display_label, start_date, end_date)
    VALUES ('c2000000-0000-0000-0000-000000000000', '10000000-0000-0000-0000-000000000000', '2025/2026', '2025-07-01', '2026-06-30');

    -- Test 11: Cross-tenant same Academic Year label succeeds
    INSERT INTO academic_core_academic_years (id, tenant_id, display_label, start_date, end_date)
    VALUES ('c3000000-0000-0000-0000-000000000000', '20000000-0000-0000-0000-000000000000', '2025/2026', '2025-07-01', '2026-06-30');

    -- Test 12: Academic Period start_date > end_date MUST FAIL
    BEGIN
        INSERT INTO academic_core_academic_periods (id, tenant_id, academic_year_id, display_label, start_date, end_date)
        VALUES ('b0000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000000', 'c2000000-0000-0000-0000-000000000000', 'Inverted Period', '2025-12-31', '2025-07-01');
        RAISE EXCEPTION 'FAIL: Academic Period start_date > end_date should have failed';
    EXCEPTION WHEN check_violation THEN
        -- Expected
    END;

    -- Test 13: Academic Period before parent Academic Year start MUST FAIL
    BEGIN
        INSERT INTO academic_core_academic_periods (id, tenant_id, academic_year_id, display_label, start_date, end_date)
        VALUES ('b0000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000000', 'c2000000-0000-0000-0000-000000000000', 'Early Period', '2025-06-01', '2025-12-31');
        RAISE EXCEPTION 'FAIL: Academic Period before parent start_date should have failed';
    EXCEPTION WHEN OTHERS THEN
        IF SQLERRM NOT LIKE '%cannot precede parent Academic Year%' THEN
            RAISE EXCEPTION 'FAIL: Unexpected error for early period: %', SQLERRM;
        END IF;
    END;

    -- Test 14: Academic Period after parent Academic Year end MUST FAIL
    BEGIN
        INSERT INTO academic_core_academic_periods (id, tenant_id, academic_year_id, display_label, start_date, end_date)
        VALUES ('b0000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000000', 'c2000000-0000-0000-0000-000000000000', 'Late Period', '2026-01-01', '2026-07-15');
        RAISE EXCEPTION 'FAIL: Academic Period after parent end_date should have failed';
    EXCEPTION WHEN OTHERS THEN
        IF SQLERRM NOT LIKE '%cannot succeed parent Academic Year%' THEN
            RAISE EXCEPTION 'FAIL: Unexpected error for late period: %', SQLERRM;
        END IF;
    END;

    -- Test 15: Nonexistent Academic Year reference MUST FAIL
    BEGIN
        INSERT INTO academic_core_academic_periods (id, tenant_id, academic_year_id, display_label, start_date, end_date)
        VALUES ('b0000000-0000-0000-0000-000000000004', '10000000-0000-0000-0000-000000000000', '99999999-9999-9999-9999-999999999999', 'Ghost Period', '2025-07-01', '2025-12-31');
        RAISE EXCEPTION 'FAIL: Nonexistent Academic Year reference should have failed';
    EXCEPTION WHEN foreign_key_violation THEN
        -- Expected
    END;

    -- Test 16: Cross-tenant Year/Period linkage MUST FAIL
    BEGIN
        INSERT INTO academic_core_academic_periods (id, tenant_id, academic_year_id, display_label, start_date, end_date)
        VALUES ('b0000000-0000-0000-0000-000000000005', '20000000-0000-0000-0000-000000000000', 'c2000000-0000-0000-0000-000000000000', 'Cross-Tenant Period', '2025-07-01', '2025-12-31');
        RAISE EXCEPTION 'FAIL: Cross-tenant Year/Period linkage should have failed';
    EXCEPTION WHEN foreign_key_violation THEN
        -- Expected
    END;

    -- Test 17: Valid Academic Periods inside parent year succeed (multiple, including 3+)
    INSERT INTO academic_core_academic_periods (id, tenant_id, academic_year_id, display_label, start_date, end_date)
    VALUES ('b1000000-0000-0000-0000-000000000000', '10000000-0000-0000-0000-000000000000', 'c2000000-0000-0000-0000-000000000000', 'Semester 1', '2025-07-01', '2025-12-31');

    INSERT INTO academic_core_academic_periods (id, tenant_id, academic_year_id, display_label, start_date, end_date)
    VALUES ('b2000000-0000-0000-0000-000000000000', '10000000-0000-0000-0000-000000000000', 'c2000000-0000-0000-0000-000000000000', 'Semester 2', '2026-01-01', '2026-06-15');

    -- 3rd valid period proving non-hardcoded 2 semesters, still within parent range (2025-07-01 to 2026-06-30)
    INSERT INTO academic_core_academic_periods (id, tenant_id, academic_year_id, display_label, start_date, end_date)
    VALUES ('b3000000-0000-0000-0000-000000000000', '10000000-0000-0000-0000-000000000000', 'c2000000-0000-0000-0000-000000000000', 'Short Term', '2026-06-16', '2026-06-30');

    -- Test 18: Same Period label across different Academic Years
    INSERT INTO academic_core_academic_periods (id, tenant_id, academic_year_id, display_label, start_date, end_date)
    VALUES ('b4000000-0000-0000-0000-000000000000', '10000000-0000-0000-0000-000000000000', 'c1000000-0000-0000-0000-000000000000', 'Semester 1', '2024-07-01', '2024-12-31');

    -- Test 19: Same Period label cross-tenant
    INSERT INTO academic_core_academic_periods (id, tenant_id, academic_year_id, display_label, start_date, end_date)
    VALUES ('b5000000-0000-0000-0000-000000000000', '20000000-0000-0000-0000-000000000000', 'c3000000-0000-0000-0000-000000000000', 'Semester 1', '2025-07-01', '2025-12-31');

    -- Test 20: Stable identity readback for historical Academic Year
    SELECT display_label INTO v_read_label
    FROM academic_core_academic_years
    WHERE id = 'c1000000-0000-0000-0000-000000000000' AND tenant_id = '10000000-0000-0000-0000-000000000000';
    IF v_read_label != '2024/2025' THEN RAISE EXCEPTION 'FAIL: Historical Academic Year readback failed (expected 2024/2025, got %)', v_read_label; END IF;

    -- Test 21: Stable identity readback for historical Academic Period
    SELECT display_label INTO v_read_period_label
    FROM academic_core_academic_periods
    WHERE id = 'b4000000-0000-0000-0000-000000000000' AND tenant_id = '10000000-0000-0000-0000-000000000000';
    IF v_read_period_label != 'Semester 1' THEN RAISE EXCEPTION 'FAIL: Historical Academic Period readback failed (expected Semester 1, got %)', v_read_period_label; END IF;

    -- Test 22: Academic Year date update violating period containment MUST FAIL
    BEGIN
        UPDATE academic_core_academic_years
        SET end_date = '2026-01-01'
        WHERE id = 'c2000000-0000-0000-0000-000000000000' AND tenant_id = '10000000-0000-0000-0000-000000000000';
        RAISE EXCEPTION 'FAIL: Academic Year end_date contraction excluding child period should have failed';
    EXCEPTION WHEN OTHERS THEN
        IF SQLERRM NOT LIKE '%contain all child Academic Periods%' THEN
            RAISE EXCEPTION 'FAIL: Unexpected error for year contraction: %', SQLERRM;
        END IF;
    END;

    RAISE NOTICE 'BU-036 Verification SUCCESS';
END $$;
