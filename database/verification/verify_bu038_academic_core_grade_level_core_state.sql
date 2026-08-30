\set ON_ERROR_STOP on
\c verify_bu038_db

-- Apply migrations
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

-- Test Repeat Invocation of 0014
\ir ../migrations/0014_bu038_academic_core_grade_level_core_state.sql

DO $$
DECLARE
    migration_count INT;
    col_count INT;
    constraint_exists BOOLEAN;
    unrelated_count INT;
    tenant_1 UUID := gen_random_uuid();
    tenant_2 UUID := gen_random_uuid();
    grade_id_1 UUID;
    grade_id_2 UUID;
    grade_id_3 UUID;
BEGIN
    -- 4. migration-history count for 0014 is exactly one
    SELECT COUNT(*) INTO migration_count FROM elligble_migration_history WHERE migration_id = '0014_bu038_academic_core_grade_level_core_state';
    IF migration_count <> 1 THEN
        RAISE EXCEPTION 'Migration 0014 history count is % instead of 1', migration_count;
    END IF;

    -- 5, 7, 8, 9, 10. Table exists and required columns exist
    SELECT COUNT(*) INTO col_count
    FROM information_schema.columns
    WHERE table_name = 'academic_core_grade_levels'
      AND column_name IN ('id', 'tenant_id', 'display_label', 'created_at');
    IF col_count <> 4 THEN
        RAISE EXCEPTION 'Missing required columns in academic_core_grade_levels';
    END IF;

    -- 6. no unrelated BU-038 business table is created
    SELECT COUNT(*) INTO unrelated_count
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name NOT IN (
          'elligble_migration_history',
          'identity_persons',
          'identity_user_accounts',
          'tenant_tenants',
          'tenant_memberships',
          'secure_assessment_exam_instances',
          'secure_assessment_exam_participants',
          'secure_assessment_exam_attempts',
          'secure_assessment_exam_question_snapshots',
          'secure_assessment_question_bank_items',
          'secure_assessment_exam_answers',
          'secure_assessment_timer_state',
          'secure_assessment_timer_adjustments',
          'secure_assessment_exam_submissions',
          'secure_assessment_exam_sessions',
          'secure_assessment_proctor_assignments',
          'academic_core_academic_years',
          'academic_core_academic_periods',
          'academic_core_subjects',
          'academic_core_grade_levels'
      );
    IF unrelated_count > 0 THEN
        RAISE EXCEPTION 'Unrelated business tables created: %', (
            SELECT string_agg(table_name, ', ')
            FROM information_schema.tables
            WHERE table_schema = 'public'
              AND table_name NOT IN (
                  'elligble_migration_history',
                  'identity_persons',
                  'identity_user_accounts',
                  'tenant_tenants',
                  'tenant_memberships',
                  'secure_assessment_exam_instances',
                  'secure_assessment_exam_participants',
                  'secure_assessment_exam_attempts',
                  'secure_assessment_exam_question_snapshots',
                  'secure_assessment_question_bank_items',
                  'secure_assessment_exam_answers',
                  'secure_assessment_timer_state',
                  'secure_assessment_timer_adjustments',
                  'secure_assessment_exam_submissions',
                  'secure_assessment_exam_sessions',
                  'secure_assessment_proctor_assignments',
                  'academic_core_academic_years',
                  'academic_core_academic_periods',
                  'academic_core_subjects',
                  'academic_core_grade_levels'
              )
        );
    END IF;

    -- 11. non-blank CHECK exists
    SELECT EXISTS (
        SELECT 1
        FROM information_schema.check_constraints cc
        JOIN information_schema.table_constraints tc
          ON cc.constraint_name = tc.constraint_name
        WHERE tc.table_name = 'academic_core_grade_levels'
          AND tc.constraint_name = 'chk_ac_grade_level_display_label_non_blank'
    ) INTO constraint_exists;
    IF NOT constraint_exists THEN
        RAISE EXCEPTION 'Constraint chk_ac_grade_level_display_label_non_blank missing';
    END IF;

    -- 19-26. Check for absence of prohibited columns
    SELECT COUNT(*) INTO col_count
    FROM information_schema.columns
    WHERE table_name = 'academic_core_grade_levels'
      AND column_name IN (
          'academic_year_id', 'academic_period_id', 'subject_id', 'program_id', 'major_id', 'curriculum_id', 'rombel_id', 'code', 'status', 'sequence', 'sequence_order', 'sort_order', 'next_grade_level_id', 'previous_grade_level_id'
      );
    IF col_count > 0 THEN
        RAISE EXCEPTION 'Prohibited column(s) found in academic_core_grade_levels';
    END IF;

    -- Setup: tenants for inserts
    INSERT INTO tenant_tenants (id) VALUES (tenant_1), (tenant_2);

    -- 12. NULL display_label is rejected
    BEGIN
        INSERT INTO academic_core_grade_levels (tenant_id, display_label) VALUES (tenant_1, NULL);
        RAISE EXCEPTION 'Failed to reject NULL display_label';
    EXCEPTION WHEN not_null_violation THEN
        -- PASS
    END;

    -- 13. empty string display_label is rejected
    BEGIN
        INSERT INTO academic_core_grade_levels (tenant_id, display_label) VALUES (tenant_1, '');
        RAISE EXCEPTION 'Failed to reject empty display_label';
    EXCEPTION WHEN check_violation THEN
        -- PASS
    END;

    -- 14. whitespace-only display_label is rejected
    BEGIN
        INSERT INTO academic_core_grade_levels (tenant_id, display_label) VALUES (tenant_1, '   ');
        RAISE EXCEPTION 'Failed to reject whitespace-only display_label';
    EXCEPTION WHEN check_violation THEN
        -- PASS
    END;

    -- 15. meaningful display label is accepted
    INSERT INTO academic_core_grade_levels (tenant_id, display_label) VALUES (tenant_1, 'XI') RETURNING id INTO grade_id_1;
    IF grade_id_1 IS NULL THEN
        RAISE EXCEPTION 'Failed to insert meaningful display_label';
    END IF;

    -- 16. same display label across different tenants is allowed
    INSERT INTO academic_core_grade_levels (tenant_id, display_label) VALUES (tenant_2, 'XI') RETURNING id INTO grade_id_2;

    -- 17. same display label inside one tenant is allowed
    INSERT INTO academic_core_grade_levels (tenant_id, display_label) VALUES (tenant_1, 'XI') RETURNING id INTO grade_id_3;

    -- 18. separate Grade Level records have separate UUID identities
    IF grade_id_1 = grade_id_2 OR grade_id_1 = grade_id_3 OR grade_id_2 = grade_id_3 THEN
        RAISE EXCEPTION 'Identities are not distinct';
    END IF;

    -- 27-31. Regression test: insert Subject
    BEGIN
        INSERT INTO academic_core_subjects (tenant_id, display_label) VALUES (tenant_1, '  ');
        RAISE EXCEPTION 'Failed to reject whitespace subject display_label';
    EXCEPTION WHEN check_violation THEN
        -- PASS
    END;

    RAISE NOTICE 'BU-038 verification passed';
END $$;
