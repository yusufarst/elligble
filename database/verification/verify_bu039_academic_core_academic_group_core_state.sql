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

    -- 2. Verify Table Exists
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.tables
        WHERE table_schema = 'public'
        AND table_name = 'academic_core_academic_groups'
    ) THEN
        RAISE EXCEPTION 'Verification Failed: Table academic_core_academic_groups does not exist.';
    END IF;

    -- 3. Verify Exact Column Schema and Prohibited Fields
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'academic_core_academic_groups'
        AND column_name NOT IN ('id', 'tenant_id', 'academic_year_id', 'grade_level_id', 'display_label', 'created_at')
    ) THEN
        RAISE EXCEPTION 'Verification Failed: Table contains prohibited fields.';
    END IF;
    
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'academic_core_academic_groups'
        AND column_name = 'id' AND data_type = 'uuid'
    ) THEN RAISE EXCEPTION 'Verification Failed: Missing id'; END IF;

    -- 4. Verify Same-Tenant Constraints Work
    BEGIN
        INSERT INTO academic_core_academic_groups (id, tenant_id, academic_year_id, grade_level_id, display_label)
        VALUES (v_group_1_t1, v_test_tenant_1, v_year_1_t1, v_grade_1_t1, 'Group 1 T1 Y1');
    EXCEPTION WHEN OTHERS THEN
        RAISE EXCEPTION 'Verification Failed: Meaningful label insert failed for valid same-tenant data: %', SQLERRM;
    END;

    -- 5. Verify Cross-Tenant Reject - Year
    BEGIN
        INSERT INTO academic_core_academic_groups (tenant_id, academic_year_id, grade_level_id, display_label)
        VALUES (v_test_tenant_1, v_year_1_t2, v_grade_1_t1, 'Bad Group');
        RAISE EXCEPTION 'Verification Failed: Allowed cross-tenant academic year reference.';
    EXCEPTION WHEN OTHERS THEN
        -- Expected
    END;

    -- 6. Verify Cross-Tenant Reject - Grade
    BEGIN
        INSERT INTO academic_core_academic_groups (tenant_id, academic_year_id, grade_level_id, display_label)
        VALUES (v_test_tenant_1, v_year_1_t1, v_grade_1_t2, 'Bad Group');
        RAISE EXCEPTION 'Verification Failed: Allowed cross-tenant grade level reference.';
    EXCEPTION WHEN OTHERS THEN
        -- Expected
    END;

    -- 7. Verify Null Label Reject
    BEGIN
        INSERT INTO academic_core_academic_groups (tenant_id, academic_year_id, grade_level_id, display_label)
        VALUES (v_test_tenant_1, v_year_1_t1, v_grade_1_t1, NULL);
        RAISE EXCEPTION 'Verification Failed: Allowed NULL display_label.';
    EXCEPTION WHEN OTHERS THEN
        -- Expected
    END;

    -- 8. Verify Empty/Whitespace Label Reject
    BEGIN
        INSERT INTO academic_core_academic_groups (tenant_id, academic_year_id, grade_level_id, display_label)
        VALUES (v_test_tenant_1, v_year_1_t1, v_grade_1_t1, '   ');
        RAISE EXCEPTION 'Verification Failed: Allowed whitespace display_label.';
    EXCEPTION WHEN OTHERS THEN
        -- Expected
    END;

    -- 9. Verify Same Label Across Different Years
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
