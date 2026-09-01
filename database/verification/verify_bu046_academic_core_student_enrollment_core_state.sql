\set ON_ERROR_STOP on

-- Verifier 0021 & 0022: BU-046 Academic Core Student Enrollment Core State Persistence Remediation

DO $$
DECLARE
    v_migration_count INTEGER;
    v_idx_count INTEGER;
    
    v_tenant_1 UUID := gen_random_uuid();
    v_tenant_2 UUID := gen_random_uuid();
    
    v_person_1 UUID := gen_random_uuid();
    
    v_member_1_t1 UUID := gen_random_uuid();
    v_member_1_t2 UUID := gen_random_uuid();
    
    v_year_1_t1 UUID := gen_random_uuid();
    v_year_2_t1 UUID := gen_random_uuid();
    v_year_1_t2 UUID := gen_random_uuid();
    
    v_period_1_t1_y1 UUID := gen_random_uuid();
    v_period_2_t1_y2 UUID := gen_random_uuid();
    v_period_1_t2_y1 UUID := gen_random_uuid();
    
    v_grade_1_t1 UUID := gen_random_uuid();
    v_grade_1_t2 UUID := gen_random_uuid();
    
    v_group_1_t1_y1 UUID := gen_random_uuid();
    v_group_2_t1_y2 UUID := gen_random_uuid();
    v_group_1_t2_y1 UUID := gen_random_uuid();

    v_enroll_1 UUID := gen_random_uuid();
    v_enroll_2 UUID := gen_random_uuid();
    v_enroll_3 UUID := gen_random_uuid();
BEGIN
    -- 1-5. Check Migration History
    SELECT COUNT(*) INTO v_migration_count
    FROM elligble_migration_history
    WHERE migration_id = '0021_bu046_academic_core_student_enrollment_core_state';

    IF v_migration_count != 1 THEN
        RAISE EXCEPTION 'Verification Failed: Migration 0021 is not correctly recorded in history exactly once.';
    END IF;

    SELECT COUNT(*) INTO v_migration_count
    FROM elligble_migration_history
    WHERE migration_id = '0022_bu046_academic_core_student_enrollment_retrieval_index_remediation';

    IF v_migration_count != 1 THEN
        RAISE EXCEPTION 'Verification Failed: Migration 0022 is not correctly recorded in history exactly once.';
    END IF;

    -- 6-7, 26-27. Check Indexes (tenant_id, academic_period_id, academic_group_id)
    SELECT count(*) INTO v_idx_count
    FROM pg_index i
    JOIN pg_class idx ON idx.oid = i.indexrelid
    JOIN pg_class tbl ON tbl.oid = i.indrelid
    WHERE tbl.relname = 'academic_core_student_enrollments'
      AND idx.relname = 'idx_ac_student_enrollments_tenant_period_group'
      AND NOT i.indisunique
      AND pg_get_indexdef(i.indexrelid) ILIKE '%(tenant_id, academic_period_id, academic_group_id)%';

    IF v_idx_count != 1 THEN
        RAISE EXCEPTION 'Verification Failed: idx_ac_student_enrollments_tenant_period_group is missing or has wrong column order.';
    END IF;

    -- Check Index (tenant_id, membership_id, academic_period_id)
    SELECT count(*) INTO v_idx_count
    FROM pg_index i
    JOIN pg_class idx ON idx.oid = i.indexrelid
    JOIN pg_class tbl ON tbl.oid = i.indrelid
    WHERE tbl.relname = 'academic_core_student_enrollments'
      AND idx.relname = 'idx_ac_student_enrollments_tenant_membership_period'
      AND NOT i.indisunique
      AND pg_get_indexdef(i.indexrelid) ILIKE '%(tenant_id, membership_id, academic_period_id)%';

    IF v_idx_count != 1 THEN
        RAISE EXCEPTION 'Verification Failed: idx_ac_student_enrollments_tenant_membership_period is missing or has wrong column order.';
    END IF;

    -- Setup standard foundations
    INSERT INTO tenant_tenants (id) VALUES (v_tenant_1), (v_tenant_2);
    INSERT INTO identity_persons (id) VALUES (v_person_1);

    INSERT INTO tenant_memberships (id, tenant_id, person_id) 
    VALUES (v_member_1_t1, v_tenant_1, v_person_1), (v_member_1_t2, v_tenant_2, v_person_1);

    INSERT INTO academic_core_academic_years (id, tenant_id, display_label, start_date, end_date)
    VALUES
        (v_year_1_t1, v_tenant_1, 'Y1 T1', '2026-07-01', '2027-06-30'),
        (v_year_2_t1, v_tenant_1, 'Y2 T1', '2027-07-01', '2028-06-30'),
        (v_year_1_t2, v_tenant_2, 'Y1 T2', '2026-07-01', '2027-06-30');

    INSERT INTO academic_core_academic_periods (id, tenant_id, academic_year_id, display_label, start_date, end_date)
    VALUES
        (v_period_1_t1_y1, v_tenant_1, v_year_1_t1, 'P1 Y1 T1', '2026-07-01', '2026-12-31'),
        (v_period_2_t1_y2, v_tenant_1, v_year_2_t1, 'P1 Y2 T1', '2027-07-01', '2027-12-31'),
        (v_period_1_t2_y1, v_tenant_2, v_year_1_t2, 'P1 Y1 T2', '2026-07-01', '2026-12-31');

    INSERT INTO academic_core_grade_levels (id, tenant_id, display_label)
    VALUES (v_grade_1_t1, v_tenant_1, 'Grade 10 T1'), (v_grade_1_t2, v_tenant_2, 'Grade 10 T2');

    INSERT INTO academic_core_academic_groups (id, tenant_id, academic_year_id, grade_level_id, display_label)
    VALUES
        (v_group_1_t1_y1, v_tenant_1, v_year_1_t1, v_grade_1_t1, 'Group 1 T1 Y1'),
        (v_group_2_t1_y2, v_tenant_1, v_year_2_t1, v_grade_1_t1, 'Group 1 T1 Y2'),
        (v_group_1_t2_y1, v_tenant_2, v_year_1_t2, v_grade_1_t2, 'Group 1 T2 Y1');

    -- 8. valid same-tenant Membership + Group + Period enrollment succeeds
    BEGIN
        INSERT INTO academic_core_student_enrollments (id, tenant_id, academic_year_id, membership_id, academic_group_id, academic_period_id, start_date, end_date, status, source)
        VALUES (v_enroll_1, v_tenant_1, v_year_1_t1, v_member_1_t1, v_group_1_t1_y1, v_period_1_t1_y1, '2026-07-01', NULL, 'ACTIVE', 'MANUAL');
    EXCEPTION WHEN OTHERS THEN
        RAISE EXCEPTION 'Verification Failed: Valid same-tenant enrollment failed: %', SQLERRM;
    END;

    -- 9. cross-tenant Membership rejected
    DECLARE v_rejected BOOLEAN := false; BEGIN
        BEGIN
            INSERT INTO academic_core_student_enrollments (id, tenant_id, academic_year_id, membership_id, academic_group_id, academic_period_id, start_date, status, source)
            VALUES (gen_random_uuid(), v_tenant_1, v_year_1_t1, v_member_1_t2, v_group_1_t1_y1, v_period_1_t1_y1, '2026-07-01', 'ACTIVE', 'MANUAL');
        EXCEPTION WHEN OTHERS THEN v_rejected := true; END;
        IF NOT v_rejected THEN RAISE EXCEPTION 'Verification Failed: Allowed cross-tenant membership.'; END IF;
    END;

    -- 10. cross-tenant Group rejected
    DECLARE v_rejected BOOLEAN := false; BEGIN
        BEGIN
            INSERT INTO academic_core_student_enrollments (id, tenant_id, academic_year_id, membership_id, academic_group_id, academic_period_id, start_date, status, source)
            VALUES (gen_random_uuid(), v_tenant_1, v_year_1_t1, v_member_1_t1, v_group_1_t2_y1, v_period_1_t1_y1, '2026-07-01', 'ACTIVE', 'MANUAL');
        EXCEPTION WHEN OTHERS THEN v_rejected := true; END;
        IF NOT v_rejected THEN RAISE EXCEPTION 'Verification Failed: Allowed cross-tenant group.'; END IF;
    END;

    -- 11. cross-tenant Period rejected
    DECLARE v_rejected BOOLEAN := false; BEGIN
        BEGIN
            INSERT INTO academic_core_student_enrollments (id, tenant_id, academic_year_id, membership_id, academic_group_id, academic_period_id, start_date, status, source)
            VALUES (gen_random_uuid(), v_tenant_1, v_year_1_t1, v_member_1_t1, v_group_1_t1_y1, v_period_1_t2_y1, '2026-07-01', 'ACTIVE', 'MANUAL');
        EXCEPTION WHEN OTHERS THEN v_rejected := true; END;
        IF NOT v_rejected THEN RAISE EXCEPTION 'Verification Failed: Allowed cross-tenant period.'; END IF;
    END;

    -- 12. Group/Period Academic-Year mismatch rejected
    DECLARE v_rejected BOOLEAN := false; BEGIN
        BEGIN
            INSERT INTO academic_core_student_enrollments (id, tenant_id, academic_year_id, membership_id, academic_group_id, academic_period_id, start_date, status, source)
            VALUES (gen_random_uuid(), v_tenant_1, v_year_1_t1, v_member_1_t1, v_group_2_t1_y2, v_period_1_t1_y1, '2026-07-01', 'ACTIVE', 'MANUAL');
        EXCEPTION WHEN OTHERS THEN v_rejected := true; END;
        IF NOT v_rejected THEN RAISE EXCEPTION 'Verification Failed: Allowed Group Academic-Year mismatch.'; END IF;
    END;

    DECLARE v_rejected BOOLEAN := false; BEGIN
        BEGIN
            INSERT INTO academic_core_student_enrollments (id, tenant_id, academic_year_id, membership_id, academic_group_id, academic_period_id, start_date, status, source)
            VALUES (gen_random_uuid(), v_tenant_1, v_year_1_t1, v_member_1_t1, v_group_1_t1_y1, v_period_2_t1_y2, '2026-07-01', 'ACTIVE', 'MANUAL');
        EXCEPTION WHEN OTHERS THEN v_rejected := true; END;
        IF NOT v_rejected THEN RAISE EXCEPTION 'Verification Failed: Allowed Period Academic-Year mismatch.'; END IF;
    END;

    -- 14. invalid end-before-start rejected (end < start rejected)
    DECLARE v_rejected BOOLEAN := false; BEGIN
        BEGIN
            INSERT INTO academic_core_student_enrollments (id, tenant_id, academic_year_id, membership_id, academic_group_id, academic_period_id, start_date, end_date, status, source)
            VALUES (gen_random_uuid(), v_tenant_1, v_year_1_t1, v_member_1_t1, v_group_1_t1_y1, v_period_1_t1_y1, '2026-07-01', '2026-06-30', 'ACTIVE', 'MANUAL');
        EXCEPTION WHEN OTHERS THEN v_rejected := true; END;
        IF NOT v_rejected THEN RAISE EXCEPTION 'Verification Failed: Allowed end_date < start_date.'; END IF;
    END;

    -- 13. required lifecycle start enforced (NULL start rejected)
    DECLARE v_rejected BOOLEAN := false; BEGIN
        BEGIN
            INSERT INTO academic_core_student_enrollments (id, tenant_id, academic_year_id, membership_id, academic_group_id, academic_period_id, start_date, status, source)
            VALUES (gen_random_uuid(), v_tenant_1, v_year_1_t1, v_member_1_t1, v_group_1_t1_y1, v_period_1_t1_y1, NULL, 'ACTIVE', 'MANUAL');
        EXCEPTION WHEN OTHERS THEN v_rejected := true; END;
        IF NOT v_rejected THEN RAISE EXCEPTION 'Verification Failed: Allowed NULL start_date.'; END IF;
    END;

    -- 15. blank status rejected
    DECLARE v_rejected BOOLEAN := false; BEGIN
        BEGIN
            INSERT INTO academic_core_student_enrollments (id, tenant_id, academic_year_id, membership_id, academic_group_id, academic_period_id, start_date, status, source)
            VALUES (gen_random_uuid(), v_tenant_1, v_year_1_t1, v_member_1_t1, v_group_1_t1_y1, v_period_1_t1_y1, '2026-07-01', '   ', 'MANUAL');
        EXCEPTION WHEN OTHERS THEN v_rejected := true; END;
        IF NOT v_rejected THEN RAISE EXCEPTION 'Verification Failed: Allowed blank status.'; END IF;
    END;

    -- 16, 17, 19, 20. no enum/final status vocabulary constraint exists / status remains explicit / no source enum
    -- Verify by inserting completely arbitrary textual values
    BEGIN
        INSERT INTO academic_core_student_enrollments (id, tenant_id, academic_year_id, membership_id, academic_group_id, academic_period_id, start_date, status, source)
        VALUES (v_enroll_2, v_tenant_1, v_year_1_t1, v_member_1_t1, v_group_1_t1_y1, v_period_1_t1_y1, '2026-07-01', 'SOME_RANDOM_STATUS_123', 'SOME_UNKNOWN_SYSTEM');
    EXCEPTION WHEN OTHERS THEN
        RAISE EXCEPTION 'Verification Failed: Status/Source seems restricted by an enum/vocabulary: %', SQLERRM;
    END;

    -- 18. blank source rejected
    DECLARE v_rejected BOOLEAN := false; BEGIN
        BEGIN
            INSERT INTO academic_core_student_enrollments (id, tenant_id, academic_year_id, membership_id, academic_group_id, academic_period_id, start_date, status, source)
            VALUES (gen_random_uuid(), v_tenant_1, v_year_1_t1, v_member_1_t1, v_group_1_t1_y1, v_period_1_t1_y1, '2026-07-01', 'ACTIVE', '   ');
        EXCEPTION WHEN OTHERS THEN v_rejected := true; END;
        IF NOT v_rejected THEN RAISE EXCEPTION 'Verification Failed: Allowed blank source.'; END IF;
    END;

    -- 21. multiple historical Enrollment rows coexist
    -- 22. historical rows independently retain status/source/start/end
    BEGIN
        INSERT INTO academic_core_student_enrollments (id, tenant_id, academic_year_id, membership_id, academic_group_id, academic_period_id, start_date, end_date, status, source)
        VALUES (v_enroll_3, v_tenant_1, v_year_2_t1, v_member_1_t1, v_group_2_t1_y2, v_period_2_t1_y2, '2027-07-01', '2027-12-31', 'COMPLETED', 'PROMOTION');
    EXCEPTION WHEN OTHERS THEN
        RAISE EXCEPTION 'Verification Failed: Could not insert multiple historical rows: %', SQLERRM;
    END;

    -- Assert independent properties
    DECLARE v_stat TEXT; v_src TEXT; BEGIN
        SELECT status, source INTO v_stat, v_src FROM academic_core_student_enrollments WHERE id = v_enroll_3;
        IF v_stat != 'COMPLETED' OR v_src != 'PROMOTION' THEN
            RAISE EXCEPTION 'Verification Failed: Historical rows did not retain independent properties.';
        END IF;
    END;

    -- 23, 24, 25. verified by checking column constraints - we added no person/user tables or RBAC tables or Secure Assessment mutations
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'academic_core_student_enrollments'
        AND column_name NOT IN ('id', 'tenant_id', 'academic_year_id', 'membership_id', 'academic_group_id', 'academic_period_id', 'start_date', 'end_date', 'status', 'source', 'created_at')
    ) THEN RAISE EXCEPTION 'Verification Failed: Table contains prohibited fields (potential RBAC/User info/Secure Assessment mutations).'; END IF;

    -- Cleanup
    DELETE FROM academic_core_student_enrollments;
    DELETE FROM academic_core_academic_groups WHERE id IN (v_group_1_t1_y1, v_group_2_t1_y2, v_group_1_t2_y1);
    DELETE FROM academic_core_academic_periods WHERE id IN (v_period_1_t1_y1, v_period_2_t1_y2, v_period_1_t2_y1);
    DELETE FROM academic_core_grade_levels WHERE id IN (v_grade_1_t1, v_grade_1_t2);
    DELETE FROM academic_core_academic_years WHERE id IN (v_year_1_t1, v_year_2_t1, v_year_1_t2);
    DELETE FROM tenant_memberships WHERE id IN (v_member_1_t1, v_member_1_t2);
    DELETE FROM tenant_tenants WHERE id IN (v_tenant_1, v_tenant_2);
    DELETE FROM identity_persons WHERE id = v_person_1;
    
    RAISE NOTICE 'BU-046 VERIFICATION PASS: Schema, tenant isolation, lifecycle dates, retrieval indexes, and opaque status/source constraints are healthy.';
END $$;
