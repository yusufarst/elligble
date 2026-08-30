-- Verification for BU-037: Academic Core Subject Core State Persistence Bootstrap
-- Run this against a fresh disposable database.

\set ON_ERROR_STOP on

\echo 'Applying migrations 0001 through 0012...'
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

\echo 'Verifying repeat safety...'
\ir ../migrations/0012_bu037_academic_core_subject_core_state.sql

\echo 'Running assertions...'
DO $$
DECLARE
    t_count INT;
    col_exists BOOLEAN;
    constraint_count INT;
    m0012_count INT;
    v_read_label VARCHAR;
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

    -- 5. No FK to Year/Period/Grade/Rombel/Curriculum
    SELECT count(*) INTO constraint_count
    FROM pg_constraint c
    JOIN pg_class t1 ON t1.oid = c.conrelid
    JOIN pg_class t2 ON t2.oid = c.confrelid
    WHERE c.contype = 'f'
      AND t1.relname = 'academic_core_subjects';
    IF constraint_count > 0 THEN RAISE EXCEPTION 'FAIL: Subject has unexpected FKs'; END IF;

    -- 6. Migration history registration
    SELECT count(*) INTO m0012_count FROM elligble_migration_history WHERE migration_id = '0012_bu037_academic_core_subject_core_state';
    IF m0012_count != 1 THEN RAISE EXCEPTION 'FAIL: Migration history count for 0012 is % (expected 1)', m0012_count; END IF;

    -- RUNTIME PERSISTENCE TESTS

    -- Insert Tenants
    INSERT INTO tenant_tenants (id) VALUES ('10000000-0000-0000-0000-000000000000');
    INSERT INTO tenant_tenants (id) VALUES ('20000000-0000-0000-0000-000000000000');

    -- BU-036 Base objects required to prove independence (Insert valid historical Academic Years for Tenant 1)
    INSERT INTO academic_core_academic_years (id, tenant_id, display_label, start_date, end_date)
    VALUES ('c1000000-0000-0000-0000-000000000000', '10000000-0000-0000-0000-000000000000', '2024/2025', '2024-07-01', '2025-06-30');

    -- Insert Subject for Tenant 1
    INSERT INTO academic_core_subjects (id, tenant_id, display_label)
    VALUES ('f1000000-0000-0000-0000-000000000000', '10000000-0000-0000-0000-000000000000', 'Matematika');

    -- Insert multiple different Subject rows in one tenant
    INSERT INTO academic_core_subjects (id, tenant_id, display_label)
    VALUES ('f2000000-0000-0000-0000-000000000000', '10000000-0000-0000-0000-000000000000', 'Fisika');

    -- Same Subject display label in different tenant
    INSERT INTO academic_core_subjects (id, tenant_id, display_label)
    VALUES ('f3000000-0000-0000-0000-000000000000', '20000000-0000-0000-0000-000000000000', 'Matematika');

    -- Subject identity stable readback
    SELECT display_label INTO v_read_label
    FROM academic_core_subjects
    WHERE id = 'f1000000-0000-0000-0000-000000000000';
    IF v_read_label != 'Matematika' THEN RAISE EXCEPTION 'FAIL: Stable identity readback failed (expected Matematika, got %)', v_read_label; END IF;

    -- Ensure BU-001 tenant regression pass (identity foundation)
    SELECT count(*) INTO t_count
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name IN ('identity_persons', 'identity_user_accounts', 'tenant_tenants', 'tenant_memberships');
    IF t_count != 4 THEN RAISE EXCEPTION 'FAIL: BU-001 predecessor regression check failed'; END IF;

    -- Ensure BU-036 regression pass (year/period still exists and works)
    SELECT count(*) INTO t_count
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name IN ('academic_core_academic_years', 'academic_core_academic_periods');
    IF t_count != 2 THEN RAISE EXCEPTION 'FAIL: BU-036 predecessor regression check failed'; END IF;

    RAISE NOTICE 'BU-037 Verification SUCCESS';
END $$;
