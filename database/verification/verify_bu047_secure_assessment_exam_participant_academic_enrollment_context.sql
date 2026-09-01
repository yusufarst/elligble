\set ON_ERROR_STOP on

-- BU-047 Verification
DO $$
DECLARE
    v_migration_count INTEGER;
    
    v_tenant_1 UUID := gen_random_uuid();
    v_tenant_2 UUID := gen_random_uuid();
    
    v_person_1 UUID := gen_random_uuid();
    v_person_2 UUID := gen_random_uuid();
    
    v_member_1 UUID := gen_random_uuid();
    v_member_2 UUID := gen_random_uuid();
    
    v_year_1 UUID := gen_random_uuid();
    v_year_2 UUID := gen_random_uuid();
    
    v_period_1 UUID := gen_random_uuid();
    v_period_2 UUID := gen_random_uuid();
    
    v_grade_1 UUID := gen_random_uuid();
    v_grade_2 UUID := gen_random_uuid();
    
    v_group_1 UUID := gen_random_uuid();
    v_group_2 UUID := gen_random_uuid();
    
    v_enroll_1_t1 UUID := gen_random_uuid();
    v_enroll_2_t1_historical UUID := gen_random_uuid();
    v_enroll_3_t2 UUID := gen_random_uuid();
    
    v_exam_instance_1_t1 UUID := gen_random_uuid();
    v_exam_instance_2_t2 UUID := gen_random_uuid();
    
    v_participant_1 UUID := gen_random_uuid();
    v_participant_2 UUID := gen_random_uuid();
    v_participant_3 UUID := gen_random_uuid();
    
    v_count INTEGER;
BEGIN
    -- A, B, C: History check
    SELECT COUNT(*) INTO v_migration_count FROM elligble_migration_history WHERE migration_id = '0023_bu047_secure_assessment_exam_participant_academic_enrollment_context';
    IF v_migration_count != 1 THEN
        RAISE EXCEPTION 'Verification Failed: Migration 0023 count is %, expected exactly 1.', v_migration_count;
    END IF;

    -- D: academic_enrollment_id exists, UUID, nullable, no default
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'secure_assessment_exam_participants' 
        AND column_name = 'academic_enrollment_id'
        AND data_type = 'uuid'
        AND is_nullable = 'YES'
        AND column_default IS NULL
    ) THEN
        RAISE EXCEPTION 'Verification Failed: academic_enrollment_id does not meet requirements (UUID, NULLable, no default).';
    END IF;

    -- E: person_id remains physically present and unchanged
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'secure_assessment_exam_participants' 
        AND column_name = 'person_id'
        AND data_type = 'uuid'
        AND is_nullable = 'NO'
    ) THEN
        RAISE EXCEPTION 'Verification Failed: person_id is missing or modified.';
    END IF;

    -- F: supporting unique constraint exact
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint c
        JOIN pg_class t ON t.oid = c.conrelid
        WHERE t.relname = 'academic_core_student_enrollments'
        AND c.conname = 'uq_ac_student_enrollments_id_tenant'
        AND c.contype = 'u'
        AND pg_get_constraintdef(c.oid) = 'UNIQUE (id, tenant_id)'
    ) THEN
        RAISE EXCEPTION 'Verification Failed: uq_ac_student_enrollments_id_tenant is not EXACTLY UNIQUE (id, tenant_id).';
    END IF;

    -- G: FK exact
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint c
        JOIN pg_class t ON t.oid = c.conrelid
        WHERE t.relname = 'secure_assessment_exam_participants'
        AND c.conname = 'fk_sa_exam_participants_academic_enrollment'
        AND c.contype = 'f'
        AND pg_get_constraintdef(c.oid) = 'FOREIGN KEY (academic_enrollment_id, tenant_id) REFERENCES academic_core_student_enrollments(id, tenant_id) ON DELETE RESTRICT'
    ) THEN
        RAISE EXCEPTION 'Verification Failed: fk_sa_exam_participants_academic_enrollment is missing or incorrect.';
    END IF;

    -- H: index exact
    IF NOT EXISTS (
        SELECT 1 FROM pg_index i
        JOIN pg_class idx ON idx.oid = i.indexrelid
        JOIN pg_class tbl ON tbl.oid = i.indrelid
        WHERE tbl.relname = 'secure_assessment_exam_participants'
        AND idx.relname = 'idx_sa_exam_participants_tenant_academic_enrollment'
        AND NOT i.indisunique
        AND pg_get_indexdef(i.indexrelid) ILIKE '%(tenant_id, academic_enrollment_id)%'
    ) THEN
        RAISE EXCEPTION 'Verification Failed: idx_sa_exam_participants_tenant_academic_enrollment is missing or incorrect.';
    END IF;

    -- P: no forbidden scope-leak columns added
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'secure_assessment_exam_participants'
        AND column_name NOT IN ('id', 'tenant_id', 'exam_instance_id', 'person_id', 'created_at', 'academic_enrollment_id')
    ) THEN
        RAISE EXCEPTION 'Verification Failed: Forbidden columns leaked into secure_assessment_exam_participants.';
    END IF;

    -- Set up baseline data
    INSERT INTO tenant_tenants (id) VALUES (v_tenant_1), (v_tenant_2);
    INSERT INTO identity_persons (id) VALUES (v_person_1), (v_person_2);
    INSERT INTO tenant_memberships (id, tenant_id, person_id) VALUES 
        (v_member_1, v_tenant_1, v_person_1), 
        (v_member_2, v_tenant_2, v_person_2);

    INSERT INTO academic_core_academic_years (id, tenant_id, display_label, start_date, end_date) VALUES 
        (v_year_1, v_tenant_1, 'Y1', '2026-07-01', '2027-06-30'),
        (v_year_2, v_tenant_2, 'Y2', '2026-07-01', '2027-06-30');
        
    INSERT INTO academic_core_academic_periods (id, tenant_id, academic_year_id, display_label, start_date, end_date) VALUES 
        (v_period_1, v_tenant_1, v_year_1, 'P1', '2026-07-01', '2026-12-31'),
        (v_period_2, v_tenant_2, v_year_2, 'P2', '2026-07-01', '2026-12-31');

    INSERT INTO academic_core_grade_levels (id, tenant_id, display_label) VALUES 
        (v_grade_1, v_tenant_1, 'G1'),
        (v_grade_2, v_tenant_2, 'G2');
        
    INSERT INTO academic_core_academic_groups (id, tenant_id, academic_year_id, grade_level_id, display_label) VALUES 
        (v_group_1, v_tenant_1, v_year_1, v_grade_1, 'Grp1'),
        (v_group_2, v_tenant_2, v_year_2, v_grade_2, 'Grp2');

    INSERT INTO academic_core_student_enrollments (id, tenant_id, academic_year_id, membership_id, academic_group_id, academic_period_id, start_date, end_date, status, source) VALUES 
        (v_enroll_1_t1, v_tenant_1, v_year_1, v_member_1, v_group_1, v_period_1, '2026-07-01', NULL, 'ACTIVE', 'MANUAL'),
        (v_enroll_2_t1_historical, v_tenant_1, v_year_1, v_member_1, v_group_1, v_period_1, '2025-07-01', '2025-12-31', 'HISTORICAL', 'MANUAL'),
        (v_enroll_3_t2, v_tenant_2, v_year_2, v_member_2, v_group_2, v_period_2, '2026-07-01', NULL, 'ACTIVE', 'MANUAL');

    INSERT INTO secure_assessment_exam_instances (id, tenant_id) VALUES 
        (v_exam_instance_1_t1, v_tenant_1),
        (v_exam_instance_2_t2, v_tenant_2);

    -- I: positive same-tenant reference succeeds
    BEGIN
        INSERT INTO secure_assessment_exam_participants (id, tenant_id, exam_instance_id, person_id, academic_enrollment_id)
        VALUES (v_participant_1, v_tenant_1, v_exam_instance_1_t1, v_person_1, v_enroll_1_t1);
    EXCEPTION WHEN OTHERS THEN
        RAISE EXCEPTION 'Verification Failed: Same-tenant reference failed: %', SQLERRM;
    END;

    -- J: NULL academic_enrollment_id compatibility succeeds (BU-002 predecessor integrity test)
    BEGIN
        INSERT INTO secure_assessment_exam_participants (id, tenant_id, exam_instance_id, person_id, academic_enrollment_id)
        VALUES (v_participant_2, v_tenant_1, v_exam_instance_1_t1, v_person_1, NULL);
    EXCEPTION WHEN OTHERS THEN
        RAISE EXCEPTION 'Verification Failed: NULL academic_enrollment_id failed: %', SQLERRM;
    END;

    -- K: cross-tenant enrollment reference fails
    DECLARE v_rejected BOOLEAN := false; BEGIN
        BEGIN
            INSERT INTO secure_assessment_exam_participants (id, tenant_id, exam_instance_id, person_id, academic_enrollment_id)
            VALUES (gen_random_uuid(), v_tenant_1, v_exam_instance_1_t1, v_person_1, v_enroll_3_t2);
        EXCEPTION WHEN OTHERS THEN v_rejected := true; END;
        IF NOT v_rejected THEN RAISE EXCEPTION 'Verification Failed: Allowed cross-tenant enrollment reference.'; END IF;
    END;

    -- L: nonexistent enrollment reference fails
    DECLARE v_rejected BOOLEAN := false; BEGIN
        BEGIN
            INSERT INTO secure_assessment_exam_participants (id, tenant_id, exam_instance_id, person_id, academic_enrollment_id)
            VALUES (gen_random_uuid(), v_tenant_1, v_exam_instance_1_t1, v_person_1, gen_random_uuid());
        EXCEPTION WHEN OTHERS THEN v_rejected := true; END;
        IF NOT v_rejected THEN RAISE EXCEPTION 'Verification Failed: Allowed nonexistent enrollment reference.'; END IF;
    END;

    -- M: referenced enrollment cannot be deleted while referenced
    DECLARE v_rejected BOOLEAN := false; BEGIN
        BEGIN
            DELETE FROM academic_core_student_enrollments WHERE id = v_enroll_1_t1;
        EXCEPTION WHEN OTHERS THEN v_rejected := true; END;
        IF NOT v_rejected THEN RAISE EXCEPTION 'Verification Failed: Allowed deleting referenced enrollment.'; END IF;
    END;

    -- N: historical/end-dated enrollment remains referentially usable
    BEGIN
        INSERT INTO secure_assessment_exam_participants (id, tenant_id, exam_instance_id, person_id, academic_enrollment_id)
        VALUES (v_participant_3, v_tenant_1, v_exam_instance_1_t1, v_person_1, v_enroll_2_t1_historical);
    EXCEPTION WHEN OTHERS THEN
        RAISE EXCEPTION 'Verification Failed: Historical/end-dated reference failed: %', SQLERRM;
    END;

    -- O: participant reference operation does not mutate Academic Core enrollment truth
    SELECT COUNT(*) INTO v_count FROM academic_core_student_enrollments WHERE id = v_enroll_1_t1 AND status = 'ACTIVE';
    IF v_count != 1 THEN
        RAISE EXCEPTION 'Verification Failed: Academic core mutation detected.';
    END IF;

    -- Cleanup
    DELETE FROM secure_assessment_exam_participants WHERE id IN (v_participant_1, v_participant_2, v_participant_3);
    DELETE FROM secure_assessment_exam_instances WHERE id IN (v_exam_instance_1_t1, v_exam_instance_2_t2);
    DELETE FROM academic_core_student_enrollments WHERE id IN (v_enroll_1_t1, v_enroll_2_t1_historical, v_enroll_3_t2);
    DELETE FROM academic_core_academic_groups WHERE id IN (v_group_1, v_group_2);
    DELETE FROM academic_core_grade_levels WHERE id IN (v_grade_1, v_grade_2);
    DELETE FROM academic_core_academic_periods WHERE id IN (v_period_1, v_period_2);
    DELETE FROM academic_core_academic_years WHERE id IN (v_year_1, v_year_2);
    DELETE FROM tenant_memberships WHERE id IN (v_member_1, v_member_2);
    DELETE FROM tenant_tenants WHERE id IN (v_tenant_1, v_tenant_2);
    DELETE FROM identity_persons WHERE id IN (v_person_1, v_person_2);

    RAISE NOTICE 'BU-047 VERIFICATION PASS: All constraints, nullable rules, historical validity, and zero-mutation checks passed.';
END $$;
