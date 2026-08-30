-- BU-040 Verifier

\ir ../migrations/0017_bu040_subject_offering_migration_repeat_safety_remediation.sql
\ir ../migrations/0016_bu040_academic_core_subject_offering_core_state.sql

DO $$
DECLARE
    v_table_exists BOOLEAN;
    v_columns_count INTEGER;
    v_type_id TEXT;
    v_nullable_id TEXT;
    v_default_id TEXT;
    v_type_tenant TEXT;
    v_nullable_tenant TEXT;
    v_type_subject TEXT;
    v_nullable_subject TEXT;
    v_type_period TEXT;
    v_nullable_period TEXT;
    v_type_grade TEXT;
    v_nullable_grade TEXT;
    v_type_created TEXT;
    v_nullable_created TEXT;
    v_default_created TEXT;

    v_pk_def TEXT;
    v_uq_tenant_def TEXT;
    v_uq_period_tenant_def TEXT;
    v_uq_other_count INTEGER;
    v_prohibited_col_count INTEGER;

    v_fk_subject_def TEXT;
    v_fk_period_def TEXT;
    v_fk_grade_def TEXT;
    v_fk_tenant_direct_count INTEGER;
    v_fk_total_count INTEGER;

    v_tenant_1 UUID := gen_random_uuid();
    v_tenant_2 UUID := gen_random_uuid();

    v_year_1 UUID := gen_random_uuid();
    v_period_1 UUID := gen_random_uuid();
    v_period_2 UUID := gen_random_uuid();

    v_subject_1 UUID := gen_random_uuid();
    v_subject_2 UUID := gen_random_uuid();

    v_grade_1 UUID := gen_random_uuid();
    v_grade_2 UUID := gen_random_uuid();

    v_offering_id UUID;
    v_created_at TIMESTAMP WITH TIME ZONE;
    v_period_year UUID;
    v_rejected BOOLEAN;
    v_migration_count INTEGER;
    v_expected_mig TEXT;
    v_expected_migs TEXT[] := ARRAY[
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
        '0014_bu038_academic_core_grade_level_core_state',
        '0015_bu039_academic_core_academic_group_core_state',
        '0016_bu040_academic_core_subject_offering_core_state',
        '0017_bu040_subject_offering_migration_repeat_safety_remediation'
    ];
BEGIN
    ---------------------------------------------------------------------------
    -- 0. MIGRATION REPEAT / HISTORY VERIFICATION
    ---------------------------------------------------------------------------

    FOREACH v_expected_mig IN ARRAY v_expected_migs
    LOOP
        SELECT count(*) INTO v_migration_count
        FROM elligble_migration_history
        WHERE migration_id = v_expected_mig;
        ASSERT v_migration_count = 1, 'Migration ID ' || v_expected_mig || ' must exist exactly once in history';
    END LOOP;

    -- Prove narrow migration-history guard behavior:
    -- 1) Duplicate INSERT for 0016 is safely ignored and count remains 1
    INSERT INTO elligble_migration_history (migration_id, applied_at)
    VALUES ('0016_bu040_academic_core_subject_offering_core_state', CURRENT_TIMESTAMP);

    SELECT count(*) INTO v_migration_count
    FROM elligble_migration_history
    WHERE migration_id = '0016_bu040_academic_core_subject_offering_core_state';
    ASSERT v_migration_count = 1, '0016 must still have count exactly 1 after duplicate insert attempt';

    -- 2) Duplicate INSERT for another existing migration (e.g. 0015) MUST still raise unique_violation
    v_rejected := false;
    BEGIN
        INSERT INTO elligble_migration_history (migration_id, applied_at)
        VALUES ('0015_bu039_academic_core_academic_group_core_state', CURRENT_TIMESTAMP);
    EXCEPTION WHEN unique_violation THEN
        v_rejected := true;
    END;
    ASSERT v_rejected, 'Duplicate insert for 0015 must raise unique_violation';

    ---------------------------------------------------------------------------
    -- 1. STRUCTURAL VERIFICATION
    ---------------------------------------------------------------------------

    -- Table exists
    SELECT EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_name = 'academic_core_subject_offerings'
    ) INTO v_table_exists;
    ASSERT v_table_exists, 'academic_core_subject_offerings must exist';

    -- Exactly six frozen columns
    SELECT count(*) INTO v_columns_count
    FROM information_schema.columns
    WHERE table_name = 'academic_core_subject_offerings';
    ASSERT v_columns_count = 6, 'academic_core_subject_offerings must have exactly 6 columns';

    -- Check types and nullability for all 6 columns
    -- 1. id: UUID, NOT NULL, PRIMARY KEY, DEFAULT gen_random_uuid()
    SELECT data_type, is_nullable, column_default
    INTO v_type_id, v_nullable_id, v_default_id
    FROM information_schema.columns
    WHERE table_name = 'academic_core_subject_offerings' AND column_name = 'id';
    ASSERT v_type_id = 'uuid' AND v_nullable_id = 'NO', 'id must be UUID NOT NULL';
    ASSERT v_default_id = 'gen_random_uuid()', 'id must default to gen_random_uuid()';

    SELECT pg_get_constraintdef(oid) INTO v_pk_def
    FROM pg_constraint
    WHERE conrelid = 'academic_core_subject_offerings'::regclass AND contype = 'p';
    ASSERT v_pk_def = 'PRIMARY KEY (id)', 'id must be PRIMARY KEY';

    -- 2. tenant_id: UUID, NOT NULL
    SELECT data_type, is_nullable
    INTO v_type_tenant, v_nullable_tenant
    FROM information_schema.columns
    WHERE table_name = 'academic_core_subject_offerings' AND column_name = 'tenant_id';
    ASSERT v_type_tenant = 'uuid' AND v_nullable_tenant = 'NO', 'tenant_id must be UUID NOT NULL';

    -- 3. subject_id: UUID, NOT NULL
    SELECT data_type, is_nullable
    INTO v_type_subject, v_nullable_subject
    FROM information_schema.columns
    WHERE table_name = 'academic_core_subject_offerings' AND column_name = 'subject_id';
    ASSERT v_type_subject = 'uuid' AND v_nullable_subject = 'NO', 'subject_id must be UUID NOT NULL';

    -- 4. academic_period_id: UUID, NOT NULL
    SELECT data_type, is_nullable
    INTO v_type_period, v_nullable_period
    FROM information_schema.columns
    WHERE table_name = 'academic_core_subject_offerings' AND column_name = 'academic_period_id';
    ASSERT v_type_period = 'uuid' AND v_nullable_period = 'NO', 'academic_period_id must be UUID NOT NULL';

    -- 5. grade_level_id: UUID, NULLABLE
    SELECT data_type, is_nullable
    INTO v_type_grade, v_nullable_grade
    FROM information_schema.columns
    WHERE table_name = 'academic_core_subject_offerings' AND column_name = 'grade_level_id';
    ASSERT v_type_grade = 'uuid' AND v_nullable_grade = 'YES', 'grade_level_id must be UUID NULLABLE';

    -- 6. created_at: TIMESTAMP WITH TIME ZONE, NOT NULL, DEFAULT CURRENT_TIMESTAMP
    SELECT data_type, is_nullable, column_default
    INTO v_type_created, v_nullable_created, v_default_created
    FROM information_schema.columns
    WHERE table_name = 'academic_core_subject_offerings' AND column_name = 'created_at';
    ASSERT v_type_created = 'timestamp with time zone' AND v_nullable_created = 'NO', 'created_at must be TIMESTAMP WITH TIME ZONE NOT NULL';
    ASSERT v_default_created ILIKE '%CURRENT_TIMESTAMP%' OR v_default_created ILIKE '%now()%', 'created_at must have CURRENT_TIMESTAMP default';

    -- Prohibited columns absent
    SELECT count(*) INTO v_prohibited_col_count
    FROM information_schema.columns
    WHERE table_name = 'academic_core_subject_offerings'
      AND column_name IN ('academic_year_id', 'program_id', 'major_id', 'concentration_id', 'curriculum_id', 'academic_group_id', 'rombel_id', 'learning_classroom_id', 'teaching_assignment_id', 'display_label', 'code', 'status', 'effective_start', 'effective_end', 'capacity', 'sequence', 'order');
    ASSERT v_prohibited_col_count = 0, 'prohibited columns must be absent';

    -- UNIQUE constraint exact: (id, tenant_id)
    SELECT pg_get_constraintdef(oid) INTO v_uq_tenant_def
    FROM pg_constraint
    WHERE conrelid = 'academic_core_subject_offerings'::regclass AND contype = 'u';
    ASSERT v_uq_tenant_def = 'UNIQUE (id, tenant_id)', 'must have UNIQUE (id, tenant_id)';

    -- No unsupported Subject Offering business UNIQUE
    SELECT count(*) INTO v_uq_other_count
    FROM pg_constraint
    WHERE conrelid = 'academic_core_subject_offerings'::regclass AND contype = 'u';
    ASSERT v_uq_other_count = 1, 'must have EXACTLY ONE unique constraint on subject offerings (id, tenant_id)';

    -- Supporting Period UNIQUE: (id, tenant_id)
    SELECT pg_get_constraintdef(oid) INTO v_uq_period_tenant_def
    FROM pg_constraint
    WHERE conrelid = 'academic_core_academic_periods'::regclass AND conname = 'uq_ac_academic_periods_tenant' AND contype = 'u';
    ASSERT v_uq_period_tenant_def = 'UNIQUE (id, tenant_id)', 'period table must have supporting UNIQUE (id, tenant_id)';

    -- Exact Foreign Keys:
    -- (subject_id, tenant_id) -> academic_core_subjects(id, tenant_id) ON DELETE RESTRICT
    SELECT pg_get_constraintdef(oid) INTO v_fk_subject_def
    FROM pg_constraint
    WHERE conrelid = 'academic_core_subject_offerings'::regclass AND contype = 'f' AND confrelid = 'academic_core_subjects'::regclass;
    ASSERT v_fk_subject_def = 'FOREIGN KEY (subject_id, tenant_id) REFERENCES academic_core_subjects(id, tenant_id) ON DELETE RESTRICT', 'Subject FK exact match required';

    -- (academic_period_id, tenant_id) -> academic_core_academic_periods(id, tenant_id) ON DELETE RESTRICT
    SELECT pg_get_constraintdef(oid) INTO v_fk_period_def
    FROM pg_constraint
    WHERE conrelid = 'academic_core_subject_offerings'::regclass AND contype = 'f' AND confrelid = 'academic_core_academic_periods'::regclass;
    ASSERT v_fk_period_def = 'FOREIGN KEY (academic_period_id, tenant_id) REFERENCES academic_core_academic_periods(id, tenant_id) ON DELETE RESTRICT', 'Period FK exact match required';

    -- (grade_level_id, tenant_id) -> academic_core_grade_levels(id, tenant_id) ON DELETE RESTRICT
    SELECT pg_get_constraintdef(oid) INTO v_fk_grade_def
    FROM pg_constraint
    WHERE conrelid = 'academic_core_subject_offerings'::regclass AND contype = 'f' AND confrelid = 'academic_core_grade_levels'::regclass;
    ASSERT v_fk_grade_def = 'FOREIGN KEY (grade_level_id, tenant_id) REFERENCES academic_core_grade_levels(id, tenant_id) ON DELETE RESTRICT', 'Grade FK exact match required';

    -- Exactly 3 FKs, no direct tenant_tenants FK
    SELECT count(*) INTO v_fk_total_count
    FROM pg_constraint
    WHERE conrelid = 'academic_core_subject_offerings'::regclass AND contype = 'f';
    ASSERT v_fk_total_count = 3, 'Must have exactly 3 foreign keys';

    SELECT count(*) INTO v_fk_tenant_direct_count
    FROM pg_constraint
    WHERE conrelid = 'academic_core_subject_offerings'::regclass AND contype = 'f' AND confrelid = 'tenant_tenants'::regclass;
    ASSERT v_fk_tenant_direct_count = 0, 'No direct tenant_tenants FK allowed';

    ---------------------------------------------------------------------------
    -- 2. FUNCTIONAL VERIFICATION
    ---------------------------------------------------------------------------

    -- Tenant isolation setup
    INSERT INTO tenant_tenants (id) VALUES (v_tenant_1), (v_tenant_2);
    INSERT INTO academic_core_academic_years (id, tenant_id, display_label, start_date, end_date) VALUES (v_year_1, v_tenant_1, 'Y1', '2026-01-01', '2026-12-31');
    INSERT INTO academic_core_academic_periods (id, tenant_id, academic_year_id, display_label, start_date, end_date) VALUES
        (v_period_1, v_tenant_1, v_year_1, 'P1', '2026-01-01', '2026-06-30');
    -- Insert cross-tenant period independently
    INSERT INTO academic_core_academic_years (id, tenant_id, display_label, start_date, end_date) VALUES (gen_random_uuid(), v_tenant_2, 'Y2', '2026-01-01', '2026-12-31') RETURNING id INTO v_year_1;
    INSERT INTO academic_core_academic_periods (id, tenant_id, academic_year_id, display_label, start_date, end_date) VALUES
        (v_period_2, v_tenant_2, v_year_1, 'P2', '2026-01-01', '2026-06-30');

    INSERT INTO academic_core_subjects (id, tenant_id, display_label) VALUES (v_subject_1, v_tenant_1, 'S1'), (v_subject_2, v_tenant_2, 'S2');
    INSERT INTO academic_core_grade_levels (id, tenant_id, display_label) VALUES (v_grade_1, v_tenant_1, 'G1'), (v_grade_2, v_tenant_2, 'G2');

    -- 2.1 valid same-tenant Subject + Period + NULL Grade -> ACCEPT
    INSERT INTO academic_core_subject_offerings (tenant_id, subject_id, academic_period_id, grade_level_id)
    VALUES (v_tenant_1, v_subject_1, v_period_1, NULL)
    RETURNING id INTO v_offering_id;
    ASSERT v_offering_id IS NOT NULL, 'Valid offering with NULL grade must be accepted';

    -- 2.2 created_at auto-populates
    SELECT created_at INTO v_created_at FROM academic_core_subject_offerings WHERE id = v_offering_id;
    ASSERT v_created_at IS NOT NULL, 'created_at must auto-populate';

    -- 2.3 Period referenced by Offering remains tied to authoritative Academic Year
    SELECT academic_year_id INTO v_period_year
    FROM academic_core_subject_offerings o
    JOIN academic_core_academic_periods p ON o.academic_period_id = p.id AND o.tenant_id = p.tenant_id
    WHERE o.id = v_offering_id;
    ASSERT v_period_year IS NOT NULL, 'Offering must remain tied to authoritative Academic Year through Period';

    -- 2.4 valid same-tenant Subject + Period + same-tenant Grade -> ACCEPT
    INSERT INTO academic_core_subject_offerings (tenant_id, subject_id, academic_period_id, grade_level_id)
    VALUES (v_tenant_1, v_subject_1, v_period_1, v_grade_1);

    -- 2.5 cross-tenant Subject -> REJECT
    v_rejected := false;
    BEGIN
        INSERT INTO academic_core_subject_offerings (tenant_id, subject_id, academic_period_id, grade_level_id) VALUES (v_tenant_1, v_subject_2, v_period_1, v_grade_1);
    EXCEPTION WHEN foreign_key_violation THEN v_rejected := true; END;
    ASSERT v_rejected, 'Cross-tenant subject must be rejected via FK violation';

    -- 2.6 cross-tenant Period -> REJECT
    v_rejected := false;
    BEGIN
        INSERT INTO academic_core_subject_offerings (tenant_id, subject_id, academic_period_id, grade_level_id) VALUES (v_tenant_1, v_subject_1, v_period_2, v_grade_1);
    EXCEPTION WHEN foreign_key_violation THEN v_rejected := true; END;
    ASSERT v_rejected, 'Cross-tenant period must be rejected via FK violation';

    -- 2.7 cross-tenant non-null Grade -> REJECT
    v_rejected := false;
    BEGIN
        INSERT INTO academic_core_subject_offerings (tenant_id, subject_id, academic_period_id, grade_level_id) VALUES (v_tenant_1, v_subject_1, v_period_1, v_grade_2);
    EXCEPTION WHEN foreign_key_violation THEN v_rejected := true; END;
    ASSERT v_rejected, 'Cross-tenant grade must be rejected via FK violation';

    -- 2.8 NULL subject_id -> REJECT
    v_rejected := false;
    BEGIN
        INSERT INTO academic_core_subject_offerings (tenant_id, subject_id, academic_period_id, grade_level_id) VALUES (v_tenant_1, NULL, v_period_1, v_grade_1);
    EXCEPTION WHEN not_null_violation THEN v_rejected := true; END;
    ASSERT v_rejected, 'NULL subject must be rejected via not_null violation';

    -- 2.9 NULL academic_period_id -> REJECT
    v_rejected := false;
    BEGIN
        INSERT INTO academic_core_subject_offerings (tenant_id, subject_id, academic_period_id, grade_level_id) VALUES (v_tenant_1, v_subject_1, NULL, v_grade_1);
    EXCEPTION WHEN not_null_violation THEN v_rejected := true; END;
    ASSERT v_rejected, 'NULL period must be rejected via not_null violation';

    -- 2.10 NULL tenant_id -> REJECT
    v_rejected := false;
    BEGIN
        INSERT INTO academic_core_subject_offerings (tenant_id, subject_id, academic_period_id, grade_level_id) VALUES (NULL, v_subject_1, v_period_1, v_grade_1);
    EXCEPTION WHEN not_null_violation THEN v_rejected := true; END;
    ASSERT v_rejected, 'NULL tenant must be rejected via not_null violation';

    RAISE NOTICE 'BU-040 Verifier: PASS';
END $$;
