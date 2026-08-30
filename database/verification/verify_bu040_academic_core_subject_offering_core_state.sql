-- BU-040 Verifier

DO $$
DECLARE
    v_table_exists BOOLEAN;
    v_columns_count INTEGER;
    v_type_id TEXT;
    v_type_tenant TEXT;
    v_type_subject TEXT;
    v_type_period TEXT;
    v_type_grade TEXT;
    v_type_created TEXT;
    v_nullable_grade TEXT;
    
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
BEGIN
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

    -- Check types and nullability
    SELECT data_type INTO v_type_id FROM information_schema.columns WHERE table_name = 'academic_core_subject_offerings' AND column_name = 'id';
    ASSERT v_type_id = 'uuid', 'id must be UUID';
    
    SELECT is_nullable INTO v_nullable_grade FROM information_schema.columns WHERE table_name = 'academic_core_subject_offerings' AND column_name = 'grade_level_id';
    ASSERT v_nullable_grade = 'YES', 'grade_level_id must be NULLABLE';
    
    -- Prohibited columns absent
    SELECT count(*) INTO v_prohibited_col_count
    FROM information_schema.columns
    WHERE table_name = 'academic_core_subject_offerings'
      AND column_name IN ('academic_year_id', 'program_id', 'major_id', 'concentration_id', 'curriculum_id', 'academic_group_id', 'rombel_id', 'learning_classroom_id', 'teaching_assignment_id', 'display_label', 'code', 'status', 'effective_start', 'effective_end', 'capacity', 'sequence', 'order');
    ASSERT v_prohibited_col_count = 0, 'prohibited columns must be absent';

    -- PK definition
    SELECT pg_get_expr(adbin, adrelid) INTO v_pk_def FROM pg_attrdef WHERE adrelid = 'academic_core_subject_offerings'::regclass AND adnum = 1;
    ASSERT v_pk_def = 'gen_random_uuid()', 'id must default to gen_random_uuid()';
    
    -- UNIQUE constraint exact
    SELECT pg_get_constraintdef(oid) INTO v_uq_tenant_def FROM pg_constraint WHERE conrelid = 'academic_core_subject_offerings'::regclass AND contype = 'u';
    ASSERT v_uq_tenant_def = 'UNIQUE (id, tenant_id)', 'must have UNIQUE (id, tenant_id)';
    
    -- No unsupported Subject Offering business UNIQUE
    SELECT count(*) INTO v_uq_other_count FROM pg_constraint WHERE conrelid = 'academic_core_subject_offerings'::regclass AND contype = 'u';
    ASSERT v_uq_other_count = 1, 'must have EXACTLY ONE unique constraint on subject offerings (id, tenant_id)';

    -- Supporting Period UNIQUE
    SELECT pg_get_constraintdef(oid) INTO v_uq_period_tenant_def FROM pg_constraint WHERE conrelid = 'academic_core_academic_periods'::regclass AND conname = 'uq_ac_academic_periods_tenant' AND contype = 'u';
    ASSERT v_uq_period_tenant_def = 'UNIQUE (id, tenant_id)', 'period table must have supporting UNIQUE (id, tenant_id)';
    
    -- Foreign Keys
    SELECT pg_get_constraintdef(oid) INTO v_fk_subject_def FROM pg_constraint WHERE conrelid = 'academic_core_subject_offerings'::regclass AND contype = 'f' AND confrelid = 'academic_core_subjects'::regclass;
    ASSERT v_fk_subject_def ILIKE '%FOREIGN KEY (subject_id, tenant_id) REFERENCES academic_core_subjects(id, tenant_id)%', 'Subject FK exact match required';
    
    SELECT pg_get_constraintdef(oid) INTO v_fk_period_def FROM pg_constraint WHERE conrelid = 'academic_core_subject_offerings'::regclass AND contype = 'f' AND confrelid = 'academic_core_academic_periods'::regclass;
    ASSERT v_fk_period_def ILIKE '%FOREIGN KEY (academic_period_id, tenant_id) REFERENCES academic_core_academic_periods(id, tenant_id)%', 'Period FK exact match required';
    
    SELECT pg_get_constraintdef(oid) INTO v_fk_grade_def FROM pg_constraint WHERE conrelid = 'academic_core_subject_offerings'::regclass AND contype = 'f' AND confrelid = 'academic_core_grade_levels'::regclass;
    ASSERT v_fk_grade_def ILIKE '%FOREIGN KEY (grade_level_id, tenant_id) REFERENCES academic_core_grade_levels(id, tenant_id)%', 'Grade FK exact match required';

    -- Exactly 3 FKs, no direct tenant_tenants FK
    SELECT count(*) INTO v_fk_total_count FROM pg_constraint WHERE conrelid = 'academic_core_subject_offerings'::regclass AND contype = 'f';
    ASSERT v_fk_total_count = 3, 'Must have exactly 3 foreign keys';
    
    SELECT count(*) INTO v_fk_tenant_direct_count FROM pg_constraint WHERE conrelid = 'academic_core_subject_offerings'::regclass AND contype = 'f' AND confrelid = 'tenant_tenants'::regclass;
    ASSERT v_fk_tenant_direct_count = 0, 'No direct tenant_tenants FK allowed';

    ---------------------------------------------------------------------------
    -- 2. FUNCTIONAL VERIFICATION
    ---------------------------------------------------------------------------
    
    -- 2. Tenant isolation setup
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

    -- 2.1 & 2.9 valid same-tenant Subject + Period + NULL Grade -> ACCEPT
    INSERT INTO academic_core_subject_offerings (tenant_id, subject_id, academic_period_id, grade_level_id) 
    VALUES (v_tenant_1, v_subject_1, v_period_1, NULL) 
    RETURNING id INTO v_offering_id;
    ASSERT v_offering_id IS NOT NULL, 'Valid offering with NULL grade must be accepted';
    
    -- 2.10 created_at auto-populates
    SELECT created_at INTO v_created_at FROM academic_core_subject_offerings WHERE id = v_offering_id;
    ASSERT v_created_at IS NOT NULL, 'created_at must auto-populate';
    
    -- 2.11 Period referenced by Offering remains tied to authoritative Academic Year
    SELECT academic_year_id INTO v_period_year 
    FROM academic_core_subject_offerings o 
    JOIN academic_core_academic_periods p ON o.academic_period_id = p.id AND o.tenant_id = p.tenant_id
    WHERE o.id = v_offering_id;
    ASSERT v_period_year IS NOT NULL, 'Offering must remain tied to authoritative Academic Year through Period';

    -- 2.2 valid same-tenant Subject + Period + same-tenant Grade -> ACCEPT
    INSERT INTO academic_core_subject_offerings (tenant_id, subject_id, academic_period_id, grade_level_id) 
    VALUES (v_tenant_1, v_subject_1, v_period_1, v_grade_1);
    
    -- 2.3 cross-tenant Subject -> REJECT
    v_rejected := false;
    BEGIN
        INSERT INTO academic_core_subject_offerings (tenant_id, subject_id, academic_period_id, grade_level_id) VALUES (v_tenant_1, v_subject_2, v_period_1, v_grade_1);
    EXCEPTION WHEN foreign_key_violation THEN v_rejected := true; END;
    ASSERT v_rejected, 'Cross-tenant subject must be rejected via FK violation';
    
    -- 2.4 cross-tenant Period -> REJECT
    v_rejected := false;
    BEGIN
        INSERT INTO academic_core_subject_offerings (tenant_id, subject_id, academic_period_id, grade_level_id) VALUES (v_tenant_1, v_subject_1, v_period_2, v_grade_1);
    EXCEPTION WHEN foreign_key_violation THEN v_rejected := true; END;
    ASSERT v_rejected, 'Cross-tenant period must be rejected via FK violation';
    
    -- 2.5 cross-tenant non-null Grade -> REJECT
    v_rejected := false;
    BEGIN
        INSERT INTO academic_core_subject_offerings (tenant_id, subject_id, academic_period_id, grade_level_id) VALUES (v_tenant_1, v_subject_1, v_period_1, v_grade_2);
    EXCEPTION WHEN foreign_key_violation THEN v_rejected := true; END;
    ASSERT v_rejected, 'Cross-tenant grade must be rejected via FK violation';

    -- 2.6 NULL subject_id -> REJECT
    v_rejected := false;
    BEGIN
        INSERT INTO academic_core_subject_offerings (tenant_id, subject_id, academic_period_id, grade_level_id) VALUES (v_tenant_1, NULL, v_period_1, v_grade_1);
    EXCEPTION WHEN not_null_violation THEN v_rejected := true; END;
    ASSERT v_rejected, 'NULL subject must be rejected via not_null violation';

    -- 2.7 NULL academic_period_id -> REJECT
    v_rejected := false;
    BEGIN
        INSERT INTO academic_core_subject_offerings (tenant_id, subject_id, academic_period_id, grade_level_id) VALUES (v_tenant_1, v_subject_1, NULL, v_grade_1);
    EXCEPTION WHEN not_null_violation THEN v_rejected := true; END;
    ASSERT v_rejected, 'NULL period must be rejected via not_null violation';

    -- 2.8 NULL tenant_id -> REJECT
    v_rejected := false;
    BEGIN
        INSERT INTO academic_core_subject_offerings (tenant_id, subject_id, academic_period_id, grade_level_id) VALUES (NULL, v_subject_1, v_period_1, v_grade_1);
    EXCEPTION WHEN not_null_violation THEN v_rejected := true; END;
    ASSERT v_rejected, 'NULL tenant must be rejected via not_null violation';

    RAISE NOTICE 'BU-040 Verifier: PASS';
END $$;
