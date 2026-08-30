-- Verification for BU-037: Academic Core Subject Core State Persistence Bootstrap + Remediation
-- Run this against a fresh disposable database.

\set ON_ERROR_STOP on

\echo 'Applying migrations 0001 through 0013...'
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
\ir ../migrations/0012_bu037_academic_core_subject_core_state.sql
\ir ../migrations/0013_bu037_academic_core_subject_display_label_integrity_remediation.sql

\echo 'Verifying repeat safety...'
\ir ../migrations/0012_bu037_academic_core_subject_core_state.sql
\ir ../migrations/0013_bu037_academic_core_subject_display_label_integrity_remediation.sql

\echo 'Running assertions...'
DO $$
DECLARE
    t_count INT;
    col_exists BOOLEAN;
    constraint_count INT;
    m0012_count INT;
    m0013_count INT;
    v_read_label VARCHAR;
    v_read_period_label VARCHAR;
BEGIN
    -- 1. Table set verification: academic_core_subjects must exist
    SELECT count(*) INTO t_count
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'academic_core_subjects';

    IF t_count != 1 THEN
        RAISE EXCEPTION 'FAIL: Expected academic_core_subjects table for BU-037';
    END IF;

    -- 2. Breadth check: exactly 3 academic_core_* tables (years, periods, subjects)
    SELECT count(*) INTO t_count
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name LIKE 'academic_core_%';

    IF t_count != 3 THEN
        RAISE EXCEPTION 'FAIL: Found unintended academic_core table breadth (expected 3 tables, got %)', t_count;
    END IF;

    -- 3. Unintended Subject Offering table
    SELECT count(*) INTO t_count
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name LIKE '%subject_offering%';

    IF t_count != 0 THEN
        RAISE EXCEPTION 'FAIL: Found unintended Subject Offering table';
    END IF;

    -- 4. Schema checks on academic_core_subjects
    -- 4a. tenant_id NOT NULL
    SELECT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'academic_core_subjects' AND column_name = 'tenant_id' AND is_nullable = 'NO'
    ) INTO col_exists;
    IF NOT col_exists THEN RAISE EXCEPTION 'FAIL: academic_core_subjects.tenant_id missing or nullable'; END IF;

    -- 4b. display_label NOT NULL
    SELECT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'academic_core_subjects' AND column_name = 'display_label' AND is_nullable = 'NO'
    ) INTO col_exists;
    IF NOT col_exists THEN RAISE EXCEPTION 'FAIL: academic_core_subjects.display_label missing or nullable'; END IF;

    -- 4c. created_at exists
    SELECT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'academic_core_subjects' AND column_name = 'created_at'
    ) INTO col_exists;
    IF NOT col_exists THEN RAISE EXCEPTION 'FAIL: academic_core_subjects.created_at missing'; END IF;

    -- 4d. status must NOT exist
    SELECT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'academic_core_subjects' AND column_name = 'status'
    ) INTO col_exists;
    IF col_exists THEN RAISE EXCEPTION 'FAIL: status column unexpectedly exists'; END IF;

    -- 4e. code must NOT exist
    SELECT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'academic_core_subjects' AND column_name = 'code'
    ) INTO col_exists;
    IF col_exists THEN RAISE EXCEPTION 'FAIL: mandatory code column unexpectedly exists'; END IF;

    -- 4f. composite unique constraint on (id, tenant_id)
    SELECT count(*) INTO constraint_count
    FROM pg_constraint
    WHERE conrelid = 'academic_core_subjects'::regclass
      AND contype = 'u';
    IF constraint_count < 1 THEN RAISE EXCEPTION 'FAIL: academic_core_subjects unique constraint missing'; END IF;

    -- 4g. check constraint chk_ac_subject_display_label_non_blank exists
    SELECT count(*) INTO constraint_count
    FROM pg_constraint
    WHERE conrelid = 'academic_core_subjects'::regclass
      AND conname = 'chk_ac_subject_display_label_non_blank';
    IF constraint_count != 1 THEN RAISE EXCEPTION 'FAIL: chk_ac_subject_display_label_non_blank constraint missing'; END IF;

    -- 5. No FK from academic_core_subjects
    SELECT count(*) INTO constraint_count
    FROM pg_constraint c
    JOIN pg_class t1 ON t1.oid = c.conrelid
    WHERE c.contype = 'f'
      AND t1.relname = 'academic_core_subjects';
    IF constraint_count > 0 THEN RAISE EXCEPTION 'FAIL: Subject has unexpected FKs'; END IF;

    -- 6. Migration history registrations
    SELECT count(*) INTO m0012_count FROM elligble_migration_history WHERE migration_id = '0012_bu037_academic_core_subject_core_state';
    IF m0012_count != 1 THEN RAISE EXCEPTION 'FAIL: Migration history count for 0012 is % (expected 1)', m0012_count; END IF;

    SELECT count(*) INTO m0013_count FROM elligble_migration_history WHERE migration_id = '0013_bu037_academic_core_subject_display_label_integrity_remediation';
    IF m0013_count != 1 THEN RAISE EXCEPTION 'FAIL: Migration history count for 0013 is % (expected 1)', m0013_count; END IF;

    -- 7. BU-001 Foundation Regression
    SELECT count(*) INTO t_count
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name IN ('identity_persons', 'identity_user_accounts', 'tenant_tenants', 'tenant_memberships');
    IF t_count != 4 THEN RAISE EXCEPTION 'FAIL: BU-001 predecessor regression check failed (found %/4 tables)', t_count; END IF;

    -- 8. BU-036 Schema & Objects Regression
    SELECT count(*) INTO t_count
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name IN ('academic_core_academic_years', 'academic_core_academic_periods');
    IF t_count != 2 THEN RAISE EXCEPTION 'FAIL: BU-036 predecessor tables check failed'; END IF;

    SELECT count(*) INTO constraint_count
    FROM pg_constraint
    WHERE conrelid = 'academic_core_academic_years'::regclass
      AND conname = 'chk_ac_year_dates';
    IF constraint_count != 1 THEN RAISE EXCEPTION 'FAIL: chk_ac_year_dates constraint missing'; END IF;

    SELECT count(*) INTO constraint_count
    FROM pg_constraint
    WHERE conrelid = 'academic_core_academic_periods'::regclass
      AND conname = 'chk_ac_period_dates';
    IF constraint_count != 1 THEN RAISE EXCEPTION 'FAIL: chk_ac_period_dates constraint missing'; END IF;

    SELECT count(*) INTO t_count
    FROM pg_proc
    WHERE proname IN ('fn_academic_core_year_date_containment', 'fn_academic_core_period_date_containment_concurrency');
    IF t_count < 2 THEN RAISE EXCEPTION 'FAIL: BU-036 date containment functions missing (found %)', t_count; END IF;

    SELECT count(*) INTO t_count
    FROM pg_trigger
    WHERE tgname IN ('trg_ac_year_date_containment', 'trg_ac_period_date_containment_concurrency');
    IF t_count < 2 THEN RAISE EXCEPTION 'FAIL: BU-036 date containment triggers missing (found %)', t_count; END IF;

    -- RUNTIME PERSISTENCE & INTEGRITY TESTS

    -- Insert Tenants
    INSERT INTO tenant_tenants (id) VALUES ('10000000-0000-0000-0000-000000000000');
    INSERT INTO tenant_tenants (id) VALUES ('20000000-0000-0000-0000-000000000000');

    -- BU-036 Functional Containment Regression
    -- Year start > end MUST FAIL
    BEGIN
        INSERT INTO academic_core_academic_years (id, tenant_id, display_label, start_date, end_date)
        VALUES ('c0000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000000', 'Inverted Year', '2026-06-30', '2025-07-01');
        RAISE EXCEPTION 'FAIL: Academic Year start_date > end_date should have failed';
    EXCEPTION WHEN check_violation THEN
        -- Expected
    END;

    -- Insert valid historical Academic Years
    INSERT INTO academic_core_academic_years (id, tenant_id, display_label, start_date, end_date)
    VALUES ('c1000000-0000-0000-0000-000000000000', '10000000-0000-0000-0000-000000000000', '2024/2025', '2024-07-01', '2025-06-30');
    INSERT INTO academic_core_academic_years (id, tenant_id, display_label, start_date, end_date)
    VALUES ('c2000000-0000-0000-0000-000000000000', '10000000-0000-0000-0000-000000000000', '2025/2026', '2025-07-01', '2026-06-30');

    -- Valid in-year Period
    INSERT INTO academic_core_academic_periods (id, tenant_id, academic_year_id, display_label, start_date, end_date)
    VALUES ('b1000000-0000-0000-0000-000000000000', '10000000-0000-0000-0000-000000000000', 'c2000000-0000-0000-0000-000000000000', 'Semester 1', '2025-07-01', '2025-12-31');

    -- Period outside parent Year (early) MUST FAIL
    BEGIN
        INSERT INTO academic_core_academic_periods (id, tenant_id, academic_year_id, display_label, start_date, end_date)
        VALUES ('b0000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000000', 'c2000000-0000-0000-0000-000000000000', 'Early Period', '2025-06-01', '2025-12-31');
        RAISE EXCEPTION 'FAIL: Academic Period before parent start_date should have failed';
    EXCEPTION WHEN OTHERS THEN
        IF SQLERRM NOT LIKE '%cannot precede parent Academic Year%' THEN
            RAISE EXCEPTION 'FAIL: Unexpected error for early period: %', SQLERRM;
        END IF;
    END;

    -- Parent Year contraction excluding existing Period MUST FAIL
    BEGIN
        UPDATE academic_core_academic_years
        SET end_date = '2025-10-01'
        WHERE id = 'c2000000-0000-0000-0000-000000000000' AND tenant_id = '10000000-0000-0000-0000-000000000000';
        RAISE EXCEPTION 'FAIL: Academic Year end_date contraction excluding child period should have failed';
    EXCEPTION WHEN OTHERS THEN
        IF SQLERRM NOT LIKE '%contain all child Academic Periods%' THEN
            RAISE EXCEPTION 'FAIL: Unexpected error for year contraction: %', SQLERRM;
        END IF;
    END;

    -- BU-037 NON-BLANK INTEGRITY TESTS

    -- Test: NULL display_label MUST FAIL
    BEGIN
        INSERT INTO academic_core_subjects (id, tenant_id, display_label)
        VALUES ('f0000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000000', NULL);
        RAISE EXCEPTION 'FAIL: NULL display_label should have failed';
    EXCEPTION WHEN not_null_violation THEN
        -- Expected
    END;

    -- Test: Empty display_label '' MUST FAIL
    BEGIN
        INSERT INTO academic_core_subjects (id, tenant_id, display_label)
        VALUES ('f0000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000000', '');
        RAISE EXCEPTION 'FAIL: Empty display_label should have failed';
    EXCEPTION WHEN check_violation THEN
        -- Expected
    END;

    -- Test: Whitespace-only display_label '   ' MUST FAIL
    BEGIN
        INSERT INTO academic_core_subjects (id, tenant_id, display_label)
        VALUES ('f0000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000000', '   ');
        RAISE EXCEPTION 'FAIL: Whitespace-only display_label should have failed';
    EXCEPTION WHEN check_violation THEN
        -- Expected
    END;

    -- Test: Meaningful label 'Matematika' MUST SUCCEED
    INSERT INTO academic_core_subjects (id, tenant_id, display_label)
    VALUES ('f1000000-0000-0000-0000-000000000000', '10000000-0000-0000-0000-000000000000', 'Matematika');

    -- Test: Multiple different Subject rows in one tenant MUST SUCCEED
    INSERT INTO academic_core_subjects (id, tenant_id, display_label)
    VALUES ('f2000000-0000-0000-0000-000000000000', '10000000-0000-0000-0000-000000000000', 'Fisika');

    -- Test: Same Subject display label in different tenant MUST SUCCEED
    INSERT INTO academic_core_subjects (id, tenant_id, display_label)
    VALUES ('f3000000-0000-0000-0000-000000000000', '20000000-0000-0000-0000-000000000000', 'Matematika');

    -- Test: Same Subject display label in same tenant MUST SUCCEED (unless prohibited, no constraint prohibits it)
    INSERT INTO academic_core_subjects (id, tenant_id, display_label)
    VALUES ('f4000000-0000-0000-0000-000000000000', '10000000-0000-0000-0000-000000000000', 'Matematika');

    -- Test: Subject identity stable readback
    SELECT display_label INTO v_read_label
    FROM academic_core_subjects
    WHERE id = 'f1000000-0000-0000-0000-000000000000';
    IF v_read_label != 'Matematika' THEN RAISE EXCEPTION 'FAIL: Stable identity readback failed (expected Matematika, got %)', v_read_label; END IF;

    RAISE NOTICE 'BU-037 Verification SUCCESS';
END $$;
