-- Verifier 0015: BU-039 Academic Core Academic Group (Rombel) Core State Persistence Bootstrap

DO $$
DECLARE
    v_migration_count INTEGER;
    v_test_tenant_1 UUID := gen_random_uuid();
    v_test_tenant_2 UUID := gen_random_uuid();
    v_year_1_t1 UUID := gen_random_uuid();
    v_year_2_t1 UUID := gen_random_uuid();
    v_year_1_t2 UUID := gen_random_uuid();
    v_grade_1_t1 UUID := gen_random_uuid();
    v_grade_1_t2 UUID := gen_random_uuid();
    v_group_1_t1 UUID := gen_random_uuid();
    v_group_2_t1 UUID := gen_random_uuid();
    v_error_msg TEXT;
BEGIN
    -- 1. Check Migration History
    SELECT COUNT(*) INTO v_migration_count
    FROM elligble_migration_history
    WHERE migration_id = '0015_bu039_academic_core_academic_group_core_state';

    IF v_migration_count != 1 THEN
        RAISE EXCEPTION 'Verification Failed: Migration 0015 is not correctly recorded in history.';
    END IF;

    -- Setup standard foundations
    INSERT INTO tenant_tenants (id) VALUES (v_test_tenant_1);
    INSERT INTO tenant_tenants (id) VALUES (v_test_tenant_2);

    INSERT INTO academic_core_academic_years (id, tenant_id, display_label, start_date, end_date)
    VALUES
        (v_year_1_t1, v_test_tenant_1, '2026/2027 T1', '2026-07-01', '2027-06-30'),
        (v_year_2_t1, v_test_tenant_1, '2027/2028 T1', '2027-07-01', '2028-06-30'),
        (v_year_1_t2, v_test_tenant_2, '2026/2027 T2', '2026-07-01', '2027-06-30');

    INSERT INTO academic_core_grade_levels (id, tenant_id, display_label)
    VALUES
        (v_grade_1_t1, v_test_tenant_1, 'Grade 10 T1'),
        (v_grade_1_t2, v_test_tenant_2, 'Grade 10 T2');

    -- 2. Verify Structural Schema
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'academic_core_academic_groups'
    ) THEN RAISE EXCEPTION 'Verification Failed: Table academic_core_academic_groups does not exist.'; END IF;

    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'academic_core_academic_groups'
        AND column_name NOT IN ('id', 'tenant_id', 'academic_year_id', 'grade_level_id', 'display_label', 'created_at')
    ) THEN RAISE EXCEPTION 'Verification Failed: Table contains prohibited fields.'; END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'academic_core_academic_groups' AND column_name = 'id' AND data_type = 'uuid' AND is_nullable = 'NO' AND column_default LIKE '%gen_random_uuid()%') THEN RAISE EXCEPTION 'Verification Failed: Missing id or bad constraints'; END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'academic_core_academic_groups' AND column_name = 'tenant_id' AND data_type = 'uuid' AND is_nullable = 'NO') THEN RAISE EXCEPTION 'Verification Failed: Missing tenant_id'; END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'academic_core_academic_groups' AND column_name = 'academic_year_id' AND data_type = 'uuid' AND is_nullable = 'NO') THEN RAISE EXCEPTION 'Verification Failed: Missing academic_year_id'; END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'academic_core_academic_groups' AND column_name = 'grade_level_id' AND data_type = 'uuid' AND is_nullable = 'NO') THEN RAISE EXCEPTION 'Verification Failed: Missing grade_level_id'; END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'academic_core_academic_groups' AND column_name = 'display_label' AND data_type = 'character varying' AND character_maximum_length = 255 AND is_nullable = 'NO') THEN RAISE EXCEPTION 'Verification Failed: Missing display_label'; END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'academic_core_academic_groups' AND column_name = 'created_at' AND data_type = 'timestamp with time zone' AND is_nullable = 'NO' AND (column_default LIKE '%CURRENT_TIMESTAMP%' OR column_default LIKE '%now()%')) THEN RAISE EXCEPTION 'Verification Failed: Missing created_at'; END IF;

    IF (SELECT string_agg(kcu.column_name, ',' ORDER BY kcu.ordinal_position) FROM information_schema.table_constraints tc JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema WHERE tc.table_schema = 'public' AND tc.table_name = 'academic_core_academic_groups' AND tc.constraint_type = 'PRIMARY KEY') != 'id' THEN RAISE EXCEPTION 'Verification Failed: Primary key is not exactly (id).'; END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints tc JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema WHERE tc.table_schema = 'public' AND tc.table_name = 'academic_core_academic_groups' AND tc.constraint_type = 'UNIQUE' GROUP BY tc.constraint_name HAVING string_agg(kcu.column_name, ',' ORDER BY kcu.ordinal_position) = 'id,tenant_id') THEN RAISE EXCEPTION 'Verification Failed: Missing exact composite UNIQUE (id, tenant_id).'; END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.check_constraints cc JOIN information_schema.table_constraints tc ON cc.constraint_name = tc.constraint_name AND cc.constraint_schema = tc.table_schema WHERE tc.table_schema = 'public' AND tc.table_name = 'academic_core_academic_groups' AND tc.constraint_name = 'chk_ac_academic_group_display_label_non_blank' AND cc.check_clause LIKE '%btrim%display_label%<>%''%''%') THEN RAISE EXCEPTION 'Verification Failed: Missing or invalid chk_ac_academic_group_display_label_non_blank.'; END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.key_column_usage kcu JOIN information_schema.referential_constraints rc ON kcu.constraint_name = rc.constraint_name JOIN information_schema.key_column_usage kcu2 ON rc.unique_constraint_name = kcu2.constraint_name AND kcu.ordinal_position = kcu2.ordinal_position WHERE kcu.table_name = 'academic_core_academic_groups' AND kcu2.table_name = 'academic_core_academic_years' GROUP BY kcu.constraint_name HAVING string_agg(kcu.column_name, ',' ORDER BY kcu.ordinal_position) = 'academic_year_id,tenant_id' AND string_agg(kcu2.column_name, ',' ORDER BY kcu2.ordinal_position) = 'id,tenant_id') THEN RAISE EXCEPTION 'Verification Failed: Missing exact tenant-scoped composite FK to academic_core_academic_years.'; END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.key_column_usage kcu JOIN information_schema.referential_constraints rc ON kcu.constraint_name = rc.constraint_name JOIN information_schema.key_column_usage kcu2 ON rc.unique_constraint_name = kcu2.constraint_name AND kcu.ordinal_position = kcu2.ordinal_position WHERE kcu.table_name = 'academic_core_academic_groups' AND kcu2.table_name = 'academic_core_grade_levels' GROUP BY kcu.constraint_name HAVING string_agg(kcu.column_name, ',' ORDER BY kcu.ordinal_position) = 'grade_level_id,tenant_id' AND string_agg(kcu2.column_name, ',' ORDER BY kcu2.ordinal_position) = 'id,tenant_id') THEN RAISE EXCEPTION 'Verification Failed: Missing exact tenant-scoped composite FK to academic_core_grade_levels.'; END IF;

    IF EXISTS (SELECT 1 FROM information_schema.key_column_usage kcu JOIN information_schema.referential_constraints rc ON kcu.constraint_name = rc.constraint_name JOIN information_schema.key_column_usage kcu2 ON rc.unique_constraint_name = kcu2.constraint_name WHERE kcu.table_name = 'academic_core_academic_groups' AND kcu2.table_name = 'tenant_tenants') THEN RAISE EXCEPTION 'Verification Failed: Contains direct FK to tenant_tenants.'; END IF;

    -- 4. Verify Same-Tenant Constraints Work
    BEGIN
        INSERT INTO academic_core_academic_groups (id, tenant_id, academic_year_id, grade_level_id, display_label)
        VALUES (v_group_1_t1, v_test_tenant_1, v_year_1_t1, v_grade_1_t1, 'Group 1 T1 Y1');
    EXCEPTION WHEN OTHERS THEN
        RAISE EXCEPTION 'Verification Failed: Meaningful label insert failed for valid same-tenant data: %', SQLERRM;
    END;

    -- 5. Verify Cross-Tenant Reject - Year
    DECLARE
        v_rejected BOOLEAN := false;
    BEGIN
        BEGIN
            INSERT INTO academic_core_academic_groups (tenant_id, academic_year_id, grade_level_id, display_label)
            VALUES (v_test_tenant_1, v_year_1_t2, v_grade_1_t1, 'Bad Group');
        EXCEPTION WHEN OTHERS THEN
            v_rejected := true;
        END;
        IF NOT v_rejected THEN RAISE EXCEPTION 'Verification Failed: Allowed cross-tenant academic year reference.'; END IF;
    END;

    -- 6. Verify Cross-Tenant Reject - Grade
    DECLARE
        v_rejected BOOLEAN := false;
    BEGIN
        BEGIN
            INSERT INTO academic_core_academic_groups (tenant_id, academic_year_id, grade_level_id, display_label)
            VALUES (v_test_tenant_1, v_year_1_t1, v_grade_1_t2, 'Bad Group');
        EXCEPTION WHEN OTHERS THEN
            v_rejected := true;
        END;
        IF NOT v_rejected THEN RAISE EXCEPTION 'Verification Failed: Allowed cross-tenant grade level reference.'; END IF;
    END;

    -- 7. Verify Null Label Reject
    DECLARE
        v_rejected BOOLEAN := false;
    BEGIN
        BEGIN
            INSERT INTO academic_core_academic_groups (tenant_id, academic_year_id, grade_level_id, display_label)
            VALUES (v_test_tenant_1, v_year_1_t1, v_grade_1_t1, NULL);
        EXCEPTION WHEN OTHERS THEN
            v_rejected := true;
        END;
        IF NOT v_rejected THEN RAISE EXCEPTION 'Verification Failed: Allowed NULL display_label.'; END IF;
    END;

    -- 8. Verify Empty Label Reject
    DECLARE
        v_rejected BOOLEAN := false;
    BEGIN
        BEGIN
            INSERT INTO academic_core_academic_groups (tenant_id, academic_year_id, grade_level_id, display_label)
            VALUES (v_test_tenant_1, v_year_1_t1, v_grade_1_t1, '');
        EXCEPTION WHEN OTHERS THEN
            v_rejected := true;
        END;
        IF NOT v_rejected THEN RAISE EXCEPTION 'Verification Failed: Allowed empty display_label.'; END IF;
    END;

    -- 9. Verify Whitespace Label Reject
    DECLARE
        v_rejected BOOLEAN := false;
    BEGIN
        BEGIN
            INSERT INTO academic_core_academic_groups (tenant_id, academic_year_id, grade_level_id, display_label)
            VALUES (v_test_tenant_1, v_year_1_t1, v_grade_1_t1, '   ');
        EXCEPTION WHEN OTHERS THEN
            v_rejected := true;
        END;
        IF NOT v_rejected THEN RAISE EXCEPTION 'Verification Failed: Allowed whitespace display_label.'; END IF;
    END;

    -- 10. Verify Same Label Across Different Years
    BEGIN
        INSERT INTO academic_core_academic_groups (id, tenant_id, academic_year_id, grade_level_id, display_label)
        VALUES (v_group_2_t1, v_test_tenant_1, v_year_2_t1, v_grade_1_t1, 'Group 1 T1 Y1');
    EXCEPTION WHEN OTHERS THEN
        RAISE EXCEPTION 'Verification Failed: Rejected same display label in different academic year: %', SQLERRM;
    END;
    
    -- Cleanup
    DELETE FROM academic_core_academic_groups WHERE tenant_id IN (v_test_tenant_1, v_test_tenant_2);
    DELETE FROM academic_core_grade_levels WHERE tenant_id IN (v_test_tenant_1, v_test_tenant_2);
    DELETE FROM academic_core_academic_years WHERE tenant_id IN (v_test_tenant_1, v_test_tenant_2);
    DELETE FROM tenant_tenants WHERE id IN (v_test_tenant_1, v_test_tenant_2);
    
    RAISE NOTICE 'BU-039 VERIFICATION PASS: Schema, tenant isolation, label constraints, and regression are healthy.';
END $$;
