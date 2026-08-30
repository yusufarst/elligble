-- Verification for BU-038: Academic Core Grade Level Core State Persistence Bootstrap
-- Run this against a fresh disposable database.
-- Target-agnostic: caller selects the database. No \c, no \connect, no hardcoded DB.

\set ON_ERROR_STOP on

-- Apply full migration chain 0001–0014
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
\ir ../migrations/0014_bu038_academic_core_grade_level_core_state.sql

-- Test repeat invocation of 0014
\ir ../migrations/0014_bu038_academic_core_grade_level_core_state.sql

DO $$
DECLARE
    v_count              INTEGER;
    v_constraint_count   INTEGER;
    v_fk_count           INTEGER;
    v_exists             BOOLEAN;
    v_data_type          TEXT;
    v_is_nullable        TEXT;
    v_column_default     TEXT;
    v_character_maximum_length INTEGER;
    v_read_label         TEXT;
    v_unique_col_names   TEXT;
    tenant_1             UUID := gen_random_uuid();
    tenant_2             UUID := gen_random_uuid();
    grade_id_1           UUID;
    grade_id_2           UUID;
    grade_id_3           UUID;
    v_created_at         TIMESTAMPTZ;
    expected_migrations  TEXT[] := ARRAY[
        '0001_bu001_identity_tenant_foundation',
        '0002_bu002_secure_assessment_core_state',
        '0003_bu003_secure_assessment_question_core_state',
        '0004_bu004_secure_assessment_answer_persistence_core_state',
        '0005_bu007_secure_assessment_timer_core_state',
        '0006_bu009_secure_assessment_idempotent_submission_core_state',
        '0007_bu017_secure_assessment_one_active_session_core_state',
        '0008_bu034_secure_assessment_explicit_proctor_assignment_core_state',
        '0009_bu036_academic_core_academic_year_period_core_state',
        '0010_bu036_academic_core_academic_year_period_core_state_remediation',
        '0011_bu036_academic_core_academic_year_period_concurrency_hardening',
        '0012_bu037_academic_core_subject_core_state',
        '0013_bu037_academic_core_subject_display_label_integrity_remediation',
        '0014_bu038_academic_core_grade_level_core_state'
    ];
    mig_id TEXT;
BEGIN

    -- =========================================================
    -- MIGRATION HISTORY COHERENCE
    -- =========================================================

    -- 0014 history count exactly 1
    SELECT count(*) INTO v_count
    FROM elligble_migration_history
    WHERE migration_id = '0014_bu038_academic_core_grade_level_core_state';
    IF v_count != 1 THEN
        RAISE EXCEPTION 'FAIL: Migration 0014 history count is % instead of 1', v_count;
    END IF;

    -- Every expected migration 0001–0014 exists exactly once
    FOREACH mig_id IN ARRAY expected_migrations
    LOOP
        SELECT count(*) INTO v_count
        FROM elligble_migration_history
        WHERE migration_id = mig_id;
        IF v_count != 1 THEN
            RAISE EXCEPTION 'FAIL: Missing or duplicate expected migration: %', mig_id;
        END IF;
    END LOOP;

    -- =========================================================
    -- GRADE LEVEL TABLE EXISTENCE
    -- =========================================================

    SELECT count(*) INTO v_count
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'academic_core_grade_levels';
    IF v_count != 1 THEN
        RAISE EXCEPTION 'FAIL: academic_core_grade_levels table must exist exactly once';
    END IF;

    -- Academic Core breadth: exactly 4 tables
    SELECT count(*) INTO v_count
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name LIKE 'academic_core_%';
    IF v_count != 4 THEN
        RAISE EXCEPTION 'FAIL: Expected exactly 4 academic_core tables, found %', v_count;
    END IF;

    -- Exact column count: 4
    SELECT count(*) INTO v_count
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'academic_core_grade_levels';
    IF v_count != 4 THEN
        RAISE EXCEPTION 'FAIL: Expected exactly 4 columns in academic_core_grade_levels, found %', v_count;
    END IF;

    -- =========================================================
    -- COLUMN: id — UUID NOT NULL PRIMARY KEY gen_random_uuid()
    -- =========================================================

    SELECT data_type, is_nullable, column_default
    INTO v_data_type, v_is_nullable, v_column_default
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'academic_core_grade_levels'
      AND column_name = 'id';

    IF v_data_type != 'uuid' THEN
        RAISE EXCEPTION 'FAIL: id must be UUID, got %', v_data_type;
    END IF;
    IF v_is_nullable != 'NO' THEN
        RAISE EXCEPTION 'FAIL: id must be NOT NULL';
    END IF;
    IF v_column_default NOT LIKE '%gen_random_uuid()%' THEN
        RAISE EXCEPTION 'FAIL: id default must use gen_random_uuid(), got %', v_column_default;
    END IF;

    -- id is PRIMARY KEY
    SELECT count(*) INTO v_constraint_count
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu
      ON tc.constraint_name = kcu.constraint_name
     AND tc.table_schema = kcu.table_schema
    WHERE tc.table_schema = 'public'
      AND tc.table_name = 'academic_core_grade_levels'
      AND tc.constraint_type = 'PRIMARY KEY'
      AND kcu.column_name = 'id';
    IF v_constraint_count != 1 THEN
        RAISE EXCEPTION 'FAIL: id must be PRIMARY KEY';
    END IF;

    -- =========================================================
    -- COLUMN: tenant_id — UUID NOT NULL
    -- =========================================================

    SELECT data_type, is_nullable
    INTO v_data_type, v_is_nullable
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'academic_core_grade_levels'
      AND column_name = 'tenant_id';

    IF v_data_type != 'uuid' THEN
        RAISE EXCEPTION 'FAIL: tenant_id must be UUID, got %', v_data_type;
    END IF;
    IF v_is_nullable != 'NO' THEN
        RAISE EXCEPTION 'FAIL: tenant_id must be NOT NULL';
    END IF;

    -- =========================================================
    -- COLUMN: display_label — VARCHAR(255) NOT NULL
    -- =========================================================

    SELECT data_type, is_nullable, character_maximum_length
    INTO v_data_type, v_is_nullable, v_character_maximum_length
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'academic_core_grade_levels'
      AND column_name = 'display_label';

    IF v_data_type != 'character varying' THEN
        RAISE EXCEPTION 'FAIL: display_label must be character varying, got %', v_data_type;
    END IF;
    IF v_is_nullable != 'NO' THEN
        RAISE EXCEPTION 'FAIL: display_label must be NOT NULL';
    END IF;
    IF v_character_maximum_length != 255 THEN
        RAISE EXCEPTION 'FAIL: display_label max length must be 255, got %', v_character_maximum_length;
    END IF;

    -- =========================================================
    -- COLUMN: created_at — TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
    -- =========================================================

    SELECT data_type, is_nullable, column_default
    INTO v_data_type, v_is_nullable, v_column_default
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'academic_core_grade_levels'
      AND column_name = 'created_at';

    IF v_data_type != 'timestamp with time zone' THEN
        RAISE EXCEPTION 'FAIL: created_at must be timestamp with time zone, got %', v_data_type;
    END IF;
    IF v_is_nullable != 'NO' THEN
        RAISE EXCEPTION 'FAIL: created_at must be NOT NULL';
    END IF;
    IF v_column_default NOT LIKE '%CURRENT_TIMESTAMP%' AND v_column_default NOT LIKE '%now()%' THEN
        RAISE EXCEPTION 'FAIL: created_at must default to CURRENT_TIMESTAMP, got %', v_column_default;
    END IF;

    -- =========================================================
    -- CHECK CONSTRAINT: chk_ac_grade_level_display_label_non_blank
    -- =========================================================

    SELECT count(*) INTO v_constraint_count
    FROM pg_constraint
    WHERE conrelid = 'academic_core_grade_levels'::regclass
      AND conname = 'chk_ac_grade_level_display_label_non_blank';
    IF v_constraint_count != 1 THEN
        RAISE EXCEPTION 'FAIL: chk_ac_grade_level_display_label_non_blank missing';
    END IF;

    -- =========================================================
    -- EXACT COMPOSITE UNIQUE (id, tenant_id) — ordered columns
    -- =========================================================

    SELECT string_agg(a.attname, ',' ORDER BY array_position(c.conkey, a.attnum))
    INTO v_unique_col_names
    FROM pg_constraint c
    JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = ANY(c.conkey)
    WHERE c.conrelid = 'academic_core_grade_levels'::regclass
      AND c.contype = 'u';

    IF v_unique_col_names IS NULL OR v_unique_col_names != 'id,tenant_id' THEN
        RAISE EXCEPTION 'FAIL: Expected UNIQUE(id, tenant_id), got %', COALESCE(v_unique_col_names, 'NONE');
    END IF;

    -- =========================================================
    -- ZERO FOREIGN KEYS
    -- =========================================================

    SELECT count(*) INTO v_fk_count
    FROM pg_constraint
    WHERE conrelid = 'academic_core_grade_levels'::regclass
      AND contype = 'f';
    IF v_fk_count != 0 THEN
        RAISE EXCEPTION 'FAIL: Expected zero FKs on academic_core_grade_levels, found %', v_fk_count;
    END IF;

    -- =========================================================
    -- FORBIDDEN COLUMNS
    -- =========================================================

    SELECT count(*) INTO v_count
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'academic_core_grade_levels'
      AND column_name IN (
          'academic_year_id', 'academic_period_id', 'subject_id',
          'program_id', 'major_id', 'curriculum_id', 'rombel_id',
          'code', 'status', 'sequence', 'sequence_order', 'sort_order',
          'next_grade_level_id', 'previous_grade_level_id'
      );
    IF v_count > 0 THEN
        RAISE EXCEPTION 'FAIL: Prohibited columns exist in academic_core_grade_levels';
    END IF;

    -- =========================================================
    -- BU-001 FOUNDATION REGRESSION
    -- =========================================================

    SELECT count(*) INTO v_count
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name IN ('identity_persons', 'identity_user_accounts', 'tenant_tenants', 'tenant_memberships');
    IF v_count != 4 THEN
        RAISE EXCEPTION 'FAIL: BU-001 regression — found %/4 foundation tables', v_count;
    END IF;

    -- =========================================================
    -- BU-036 STRUCTURAL REGRESSION
    -- =========================================================

    SELECT count(*) INTO v_count
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name IN ('academic_core_academic_years', 'academic_core_academic_periods');
    IF v_count != 2 THEN
        RAISE EXCEPTION 'FAIL: BU-036 tables missing (found %/2)', v_count;
    END IF;

    SELECT count(*) INTO v_constraint_count
    FROM pg_constraint
    WHERE conrelid = 'academic_core_academic_years'::regclass
      AND conname = 'chk_ac_year_dates';
    IF v_constraint_count != 1 THEN
        RAISE EXCEPTION 'FAIL: chk_ac_year_dates constraint missing';
    END IF;

    SELECT count(*) INTO v_constraint_count
    FROM pg_constraint
    WHERE conrelid = 'academic_core_academic_periods'::regclass
      AND conname = 'chk_ac_period_dates';
    IF v_constraint_count != 1 THEN
        RAISE EXCEPTION 'FAIL: chk_ac_period_dates constraint missing';
    END IF;

    SELECT count(*) INTO v_count
    FROM pg_proc
    WHERE proname IN ('fn_academic_core_year_date_containment', 'fn_academic_core_period_date_containment_concurrency');
    IF v_count < 2 THEN
        RAISE EXCEPTION 'FAIL: BU-036 date containment functions missing (found %)', v_count;
    END IF;

    SELECT count(*) INTO v_count
    FROM pg_trigger
    WHERE tgname IN ('trg_ac_year_date_containment', 'trg_ac_period_date_containment_concurrency');
    IF v_count < 2 THEN
        RAISE EXCEPTION 'FAIL: BU-036 date containment triggers missing (found %)', v_count;
    END IF;

    -- =========================================================
    -- BU-037 STRUCTURAL REGRESSION
    -- =========================================================

    SELECT count(*) INTO v_count
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'academic_core_subjects';
    IF v_count != 1 THEN
        RAISE EXCEPTION 'FAIL: academic_core_subjects missing';
    END IF;

    SELECT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'academic_core_subjects'
          AND column_name = 'tenant_id'
          AND is_nullable = 'NO'
    ) INTO v_exists;
    IF NOT v_exists THEN
        RAISE EXCEPTION 'FAIL: academic_core_subjects.tenant_id missing or nullable';
    END IF;

    SELECT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'academic_core_subjects'
          AND column_name = 'display_label'
          AND is_nullable = 'NO'
    ) INTO v_exists;
    IF NOT v_exists THEN
        RAISE EXCEPTION 'FAIL: academic_core_subjects.display_label missing or nullable';
    END IF;

    SELECT count(*) INTO v_constraint_count
    FROM pg_constraint
    WHERE conrelid = 'academic_core_subjects'::regclass
      AND conname = 'chk_ac_subject_display_label_non_blank';
    IF v_constraint_count != 1 THEN
        RAISE EXCEPTION 'FAIL: chk_ac_subject_display_label_non_blank constraint missing';
    END IF;

    SELECT count(*) INTO v_fk_count
    FROM pg_constraint
    WHERE conrelid = 'academic_core_subjects'::regclass
      AND contype = 'f';
    IF v_fk_count > 0 THEN
        RAISE EXCEPTION 'FAIL: Subject has unexpected FKs';
    END IF;

    -- =========================================================
    -- SETUP: Insert tenants for functional tests
    -- =========================================================

    INSERT INTO tenant_tenants (id) VALUES (tenant_1);
    INSERT INTO tenant_tenants (id) VALUES (tenant_2);

    -- =========================================================
    -- GRADE LEVEL FUNCTIONAL TESTS
    -- =========================================================

    -- tenant_id NULL: REJECT
    BEGIN
        INSERT INTO academic_core_grade_levels (tenant_id, display_label)
        VALUES (NULL, 'XI');
        RAISE EXCEPTION 'FAIL: Failed to reject NULL tenant_id';
    EXCEPTION WHEN not_null_violation THEN
        -- PASS
    END;

    -- display_label NULL: REJECT
    BEGIN
        INSERT INTO academic_core_grade_levels (tenant_id, display_label)
        VALUES (tenant_1, NULL);
        RAISE EXCEPTION 'FAIL: Failed to reject NULL display_label';
    EXCEPTION WHEN not_null_violation THEN
        -- PASS
    END;

    -- display_label '': REJECT
    BEGIN
        INSERT INTO academic_core_grade_levels (tenant_id, display_label)
        VALUES (tenant_1, '');
        RAISE EXCEPTION 'FAIL: Failed to reject empty display_label';
    EXCEPTION WHEN check_violation THEN
        -- PASS
    END;

    -- display_label whitespace-only: REJECT
    BEGIN
        INSERT INTO academic_core_grade_levels (tenant_id, display_label)
        VALUES (tenant_1, '   ');
        RAISE EXCEPTION 'FAIL: Failed to reject whitespace-only display_label';
    EXCEPTION WHEN check_violation THEN
        -- PASS
    END;

    -- meaningful display_label: ACCEPT
    INSERT INTO academic_core_grade_levels (tenant_id, display_label)
    VALUES (tenant_1, 'XI')
    RETURNING id, created_at INTO grade_id_1, v_created_at;
    IF grade_id_1 IS NULL THEN
        RAISE EXCEPTION 'FAIL: Failed to insert meaningful display_label';
    END IF;

    -- created_at auto-populated
    IF v_created_at IS NULL THEN
        RAISE EXCEPTION 'FAIL: created_at was not automatically populated';
    END IF;

    -- same display_label different tenant: ACCEPT
    INSERT INTO academic_core_grade_levels (tenant_id, display_label)
    VALUES (tenant_2, 'XI')
    RETURNING id INTO grade_id_2;

    -- same display_label same tenant: ACCEPT
    INSERT INTO academic_core_grade_levels (tenant_id, display_label)
    VALUES (tenant_1, 'XI')
    RETURNING id INTO grade_id_3;

    -- distinct UUID identities
    IF grade_id_1 = grade_id_2 OR grade_id_1 = grade_id_3 OR grade_id_2 = grade_id_3 THEN
        RAISE EXCEPTION 'FAIL: Grade Level identities are not distinct';
    END IF;

    -- readback by UUID
    SELECT display_label INTO v_read_label
    FROM academic_core_grade_levels
    WHERE id = grade_id_1;
    IF v_read_label != 'XI' THEN
        RAISE EXCEPTION 'FAIL: Grade Level readback failed (expected XI, got %)', v_read_label;
    END IF;

    -- =========================================================
    -- BU-036 FUNCTIONAL REGRESSION
    -- =========================================================

    -- Academic Year start_date > end_date: REJECT
    BEGIN
        INSERT INTO academic_core_academic_years (id, tenant_id, display_label, start_date, end_date)
        VALUES ('c0000000-0000-0000-0000-000000000001', tenant_1, 'Inverted Year', '2026-06-30', '2025-07-01');
        RAISE EXCEPTION 'FAIL: Academic Year start_date > end_date should have failed';
    EXCEPTION WHEN check_violation THEN
        -- PASS
    END;

    -- valid Academic Year: ACCEPT
    INSERT INTO academic_core_academic_years (id, tenant_id, display_label, start_date, end_date)
    VALUES ('c1000000-0000-0000-0000-000000000000', tenant_1, '2024/2025', '2024-07-01', '2025-06-30');
    INSERT INTO academic_core_academic_years (id, tenant_id, display_label, start_date, end_date)
    VALUES ('c2000000-0000-0000-0000-000000000000', tenant_1, '2025/2026', '2025-07-01', '2026-06-30');

    -- valid Period inside parent Academic Year: ACCEPT
    INSERT INTO academic_core_academic_periods (id, tenant_id, academic_year_id, display_label, start_date, end_date)
    VALUES ('b1000000-0000-0000-0000-000000000000', tenant_1, 'c2000000-0000-0000-0000-000000000000', 'Semester 1', '2025-07-01', '2025-12-31');

    -- Period outside/before parent Year: REJECT
    BEGIN
        INSERT INTO academic_core_academic_periods (id, tenant_id, academic_year_id, display_label, start_date, end_date)
        VALUES ('b0000000-0000-0000-0000-000000000002', tenant_1, 'c2000000-0000-0000-0000-000000000000', 'Early Period', '2025-06-01', '2025-12-31');
        RAISE EXCEPTION 'FAIL: Academic Period before parent start_date should have failed';
    EXCEPTION WHEN OTHERS THEN
        IF SQLERRM NOT LIKE '%cannot precede parent Academic Year%' THEN
            RAISE EXCEPTION 'FAIL: Unexpected error for early period: %', SQLERRM;
        END IF;
    END;

    -- parent Academic Year contraction excluding existing child Period: REJECT
    BEGIN
        UPDATE academic_core_academic_years
        SET end_date = '2025-10-01'
        WHERE id = 'c2000000-0000-0000-0000-000000000000' AND tenant_id = tenant_1;
        RAISE EXCEPTION 'FAIL: Academic Year contraction excluding child period should have failed';
    EXCEPTION WHEN OTHERS THEN
        IF SQLERRM NOT LIKE '%contain all child Academic Periods%' THEN
            RAISE EXCEPTION 'FAIL: Unexpected error for year contraction: %', SQLERRM;
        END IF;
    END;

    -- =========================================================
    -- BU-037 FUNCTIONAL REGRESSION
    -- =========================================================

    -- NULL Subject label: REJECT
    BEGIN
        INSERT INTO academic_core_subjects (tenant_id, display_label)
        VALUES (tenant_1, NULL);
        RAISE EXCEPTION 'FAIL: NULL Subject display_label should have failed';
    EXCEPTION WHEN not_null_violation THEN
        -- PASS
    END;

    -- empty Subject label: REJECT
    BEGIN
        INSERT INTO academic_core_subjects (tenant_id, display_label)
        VALUES (tenant_1, '');
        RAISE EXCEPTION 'FAIL: Empty Subject display_label should have failed';
    EXCEPTION WHEN check_violation THEN
        -- PASS
    END;

    -- whitespace Subject label: REJECT
    BEGIN
        INSERT INTO academic_core_subjects (tenant_id, display_label)
        VALUES (tenant_1, '   ');
        RAISE EXCEPTION 'FAIL: Whitespace Subject display_label should have failed';
    EXCEPTION WHEN check_violation THEN
        -- PASS
    END;

    -- meaningful Subject: ACCEPT
    INSERT INTO academic_core_subjects (id, tenant_id, display_label)
    VALUES ('f1000000-0000-0000-0000-000000000000', tenant_1, 'Matematika');

    RAISE NOTICE 'BU-038 verification passed';
END $$;
