DO $$
DECLARE
    v_count INTEGER;

    v_tenant_a UUID;
    v_tenant_b UUID;

    v_person_a1 UUID;
    v_person_b UUID;

    v_membership_a1 UUID;
    v_membership_b UUID;

    v_teacher_a1 UUID;
    v_teacher_b UUID;

    v_year_a UUID;
    v_year_b UUID;
    v_period_a UUID;
    v_period_b UUID;

    v_grade_a UUID;
    v_grade_b UUID;

    v_group_a UUID;
    v_group_b UUID;

    v_subject_a UUID;
    v_subject_b UUID;

    v_offering_a1 UUID;
    v_offering_b UUID;

    v_assignment_a1 UUID;
    v_assignment_a2 UUID;
    v_assignment_b UUID;

    v_assignment_a1_assigned_at TIMESTAMP WITH TIME ZONE;
    v_assignment_a1_revoked_at TIMESTAMP WITH TIME ZONE;

    v_exam_instance_1 UUID;
    v_exam_instance_2 UUID;
    v_exam_instance_null UUID;
BEGIN
    -------------------------------------------------------------------
    -- A. STRUCTURE
    -------------------------------------------------------------------
    SELECT count(*) INTO v_count
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'secure_assessment_exam_instances';

    ASSERT v_count = 1, 'secure_assessment_exam_instances table must exist';

    -- Exact BU-002 baseline + BU-044 teaching_assignment_id contract
    SELECT count(*) INTO v_count
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'secure_assessment_exam_instances';

    ASSERT v_count = 4,
        'secure_assessment_exam_instances must contain exactly 4 columns';

    SELECT count(*) INTO v_count
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'secure_assessment_exam_instances'
      AND (
            (
                column_name = 'id'
                AND ordinal_position = 1
                AND data_type = 'uuid'
                AND is_nullable = 'NO'
                AND column_default ILIKE '%gen_random_uuid%'
            )
         OR (
                column_name = 'tenant_id'
                AND ordinal_position = 2
                AND data_type = 'uuid'
                AND is_nullable = 'NO'
                AND column_default IS NULL
            )
         OR (
                column_name = 'created_at'
                AND ordinal_position = 3
                AND data_type = 'timestamp with time zone'
                AND is_nullable = 'NO'
                AND upper(column_default) LIKE '%CURRENT_TIMESTAMP%'
            )
         OR (
                column_name = 'teaching_assignment_id'
                AND ordinal_position = 4
                AND data_type = 'uuid'
                AND is_nullable = 'YES'
                AND column_default IS NULL
            )
      );

    ASSERT v_count = 4,
        'Exact BU-002 + BU-044 column type/nullability/default contract required';

    -- Check forbidden columns
    SELECT count(*) INTO v_count
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'secure_assessment_exam_instances'
      AND column_name IN (
          'teacher_assignment_id',
          'subject_offering_id',
          'academic_group_id',
          'membership_id',
          'person_id',
          'academic_period_id',
          'academic_year_id',
          'grade_level_id',
          'subject_id',
          'proctor_assignment_id',
          'role',
          'capability',
          'permission'
      );

    ASSERT v_count = 0, 'Forbidden columns found in secure_assessment_exam_instances';

    -------------------------------------------------------------------
    -- B. FK CONTRACT
    -------------------------------------------------------------------
    SELECT count(*) INTO v_count
    FROM pg_constraint
    WHERE conrelid = 'secure_assessment_exam_instances'::regclass
      AND conname = 'fk_sa_exam_instances_teaching_assignment'
      AND contype = 'f'
      AND confrelid = 'academic_core_teaching_assignments'::regclass
      AND confdeltype = 'r'
      AND regexp_replace(pg_get_constraintdef(oid), '\s+', ' ', 'g')
          = 'FOREIGN KEY (teaching_assignment_id, tenant_id) REFERENCES academic_core_teaching_assignments(id, tenant_id) ON DELETE RESTRICT';

    ASSERT v_count = 1, 'Exact foreign key fk_sa_exam_instances_teaching_assignment required';

    -------------------------------------------------------------------
    -- C. INDEX CONTRACT
    -------------------------------------------------------------------
    SELECT count(*) INTO v_count
    FROM pg_index i
    JOIN pg_class idx ON idx.oid = i.indexrelid
    WHERE i.indrelid = 'secure_assessment_exam_instances'::regclass
      AND idx.relname = 'idx_sa_exam_instances_tenant_teaching_assignment'
      AND NOT i.indisunique
      AND i.indpred IS NULL
      AND i.indnkeyatts = 2
      AND pg_get_indexdef(i.indexrelid, 1, true) = 'tenant_id'
      AND pg_get_indexdef(i.indexrelid, 2, true) = 'teaching_assignment_id';

    ASSERT v_count = 1,
        'Exact normal non-unique two-column BU-044 lookup index required';

    -------------------------------------------------------------------
    -- D. MIGRATION HISTORY
    -------------------------------------------------------------------
    SELECT count(*) INTO v_count
    FROM elligble_migration_history
    WHERE migration_id = '0020_bu044_secure_assessment_exam_instance_teaching_assignment_context';

    ASSERT v_count = 1, 'Migration 0020 history count must be exactly 1';

    -------------------------------------------------------------------
    -- E. POSITIVE FUNCTIONAL CASE SETUP
    -------------------------------------------------------------------
    INSERT INTO tenant_tenants (id) VALUES (gen_random_uuid()) RETURNING id INTO v_tenant_a;
    INSERT INTO tenant_tenants (id) VALUES (gen_random_uuid()) RETURNING id INTO v_tenant_b;

    INSERT INTO identity_persons (id) VALUES (gen_random_uuid()) RETURNING id INTO v_person_a1;
    INSERT INTO identity_persons (id) VALUES (gen_random_uuid()) RETURNING id INTO v_person_b;

    INSERT INTO tenant_memberships (id, tenant_id, person_id) VALUES (gen_random_uuid(), v_tenant_a, v_person_a1) RETURNING id INTO v_membership_a1;
    INSERT INTO tenant_memberships (id, tenant_id, person_id) VALUES (gen_random_uuid(), v_tenant_b, v_person_b) RETURNING id INTO v_membership_b;

    INSERT INTO tenant_teacher_assignments (tenant_id, membership_id) VALUES (v_tenant_a, v_membership_a1) RETURNING id INTO v_teacher_a1;
    INSERT INTO tenant_teacher_assignments (tenant_id, membership_id) VALUES (v_tenant_b, v_membership_b) RETURNING id INTO v_teacher_b;

    INSERT INTO academic_core_academic_years (tenant_id, display_label, start_date, end_date)
    VALUES (v_tenant_a, 'Year A', DATE '2026-07-01', DATE '2027-06-30') RETURNING id INTO v_year_a;
    INSERT INTO academic_core_academic_years (tenant_id, display_label, start_date, end_date)
    VALUES (v_tenant_b, 'Year B', DATE '2026-07-01', DATE '2027-06-30') RETURNING id INTO v_year_b;

    INSERT INTO academic_core_academic_periods (tenant_id, academic_year_id, display_label, period_type, start_date, end_date)
    VALUES (v_tenant_a, v_year_a, 'Period A', 'SEMESTER', DATE '2026-07-01', DATE '2026-12-31') RETURNING id INTO v_period_a;
    INSERT INTO academic_core_academic_periods (tenant_id, academic_year_id, display_label, period_type, start_date, end_date)
    VALUES (v_tenant_b, v_year_b, 'Period B', 'SEMESTER', DATE '2026-07-01', DATE '2026-12-31') RETURNING id INTO v_period_b;

    INSERT INTO academic_core_grade_levels (tenant_id, display_label) VALUES (v_tenant_a, 'Grade A') RETURNING id INTO v_grade_a;
    INSERT INTO academic_core_grade_levels (tenant_id, display_label) VALUES (v_tenant_b, 'Grade B') RETURNING id INTO v_grade_b;

    INSERT INTO academic_core_academic_groups (tenant_id, academic_year_id, grade_level_id, display_label)
    VALUES (v_tenant_a, v_year_a, v_grade_a, 'Group A') RETURNING id INTO v_group_a;
    INSERT INTO academic_core_academic_groups (tenant_id, academic_year_id, grade_level_id, display_label)
    VALUES (v_tenant_b, v_year_b, v_grade_b, 'Group B') RETURNING id INTO v_group_b;

    INSERT INTO academic_core_subjects (tenant_id, display_label) VALUES (v_tenant_a, 'Subject A') RETURNING id INTO v_subject_a;
    INSERT INTO academic_core_subjects (tenant_id, display_label) VALUES (v_tenant_b, 'Subject B') RETURNING id INTO v_subject_b;

    INSERT INTO academic_core_subject_offerings (tenant_id, subject_id, academic_period_id, grade_level_id)
    VALUES (v_tenant_a, v_subject_a, v_period_a, v_grade_a) RETURNING id INTO v_offering_a1;
    INSERT INTO academic_core_subject_offerings (tenant_id, subject_id, academic_period_id, grade_level_id)
    VALUES (v_tenant_b, v_subject_b, v_period_b, v_grade_b) RETURNING id INTO v_offering_b;

    INSERT INTO academic_core_teaching_assignments (tenant_id, teacher_assignment_id, subject_offering_id, academic_group_id)
    VALUES (v_tenant_a, v_teacher_a1, v_offering_a1, v_group_a) RETURNING id INTO v_assignment_a1;

    INSERT INTO academic_core_teaching_assignments (tenant_id, teacher_assignment_id, subject_offering_id, academic_group_id)
    VALUES (v_tenant_b, v_teacher_b, v_offering_b, v_group_b) RETURNING id INTO v_assignment_b;

    -- Positive Functional Case: Same-tenant Exam Instance can reference Teaching Assignment
    INSERT INTO secure_assessment_exam_instances (id, tenant_id, teaching_assignment_id)
    VALUES (gen_random_uuid(), v_tenant_a, v_assignment_a1) RETURNING id INTO v_exam_instance_1;

    SELECT count(*) INTO v_count FROM secure_assessment_exam_instances WHERE id = v_exam_instance_1;
    ASSERT v_count = 1, 'Exam Instance with Teaching Assignment reference should persist';

    -------------------------------------------------------------------
    -- F. NULL COMPATIBILITY
    -------------------------------------------------------------------
    INSERT INTO secure_assessment_exam_instances (id, tenant_id, teaching_assignment_id)
    VALUES (gen_random_uuid(), v_tenant_a, NULL) RETURNING id INTO v_exam_instance_null;

    SELECT count(*) INTO v_count FROM secure_assessment_exam_instances WHERE id = v_exam_instance_null;
    ASSERT v_count = 1, 'Exam Instance with NULL teaching_assignment_id must be valid';

    -------------------------------------------------------------------
    -- G. CROSS-TENANT SAFETY
    -------------------------------------------------------------------
    BEGIN
        INSERT INTO secure_assessment_exam_instances (id, tenant_id, teaching_assignment_id)
        VALUES (gen_random_uuid(), v_tenant_a, v_assignment_b);

        RAISE EXCEPTION 'Cross-tenant teaching assignment reference must fail';
    EXCEPTION WHEN foreign_key_violation THEN
        -- Expected
    END;

    -------------------------------------------------------------------
    -- H. NONEXISTENT REFERENCE
    -------------------------------------------------------------------
    BEGIN
        INSERT INTO secure_assessment_exam_instances (id, tenant_id, teaching_assignment_id)
        VALUES (gen_random_uuid(), v_tenant_a, gen_random_uuid());

        RAISE EXCEPTION 'Nonexistent teaching assignment reference must fail';
    EXCEPTION WHEN foreign_key_violation THEN
        -- Expected
    END;

    -------------------------------------------------------------------
    -- I. REVOKED HISTORICAL REFERENCE
    -------------------------------------------------------------------
    -- Revoke the teaching assignment
    UPDATE academic_core_teaching_assignments
    SET revoked_at = CURRENT_TIMESTAMP
    WHERE id = v_assignment_a1;

    SELECT assigned_at, revoked_at
    INTO v_assignment_a1_assigned_at, v_assignment_a1_revoked_at
    FROM academic_core_teaching_assignments
    WHERE id = v_assignment_a1
      AND tenant_id = v_tenant_a;

    ASSERT v_assignment_a1_revoked_at IS NOT NULL,
        'Teaching Assignment revocation fixture must be established';

    -- Create new exam instance pointing to revoked assignment
    INSERT INTO secure_assessment_exam_instances (id, tenant_id, teaching_assignment_id)
    VALUES (gen_random_uuid(), v_tenant_a, v_assignment_a1) RETURNING id INTO v_exam_instance_2;

    SELECT count(*) INTO v_count FROM secure_assessment_exam_instances WHERE id = v_exam_instance_2;
    ASSERT v_count = 1, 'Exam Instance can reference a revoked historical Teaching Assignment';

    -------------------------------------------------------------------
    -- J. ON DELETE RESTRICT
    -------------------------------------------------------------------
    BEGIN
        DELETE FROM academic_core_teaching_assignments WHERE id = v_assignment_a1;
        RAISE EXCEPTION 'Teaching assignment deletion must be restricted';
    EXCEPTION WHEN restrict_violation THEN
        -- Expected
    END;

    -------------------------------------------------------------------
    -- K. MANY EXAMS / ONE TEACHING ASSIGNMENT
    -------------------------------------------------------------------
    INSERT INTO academic_core_teaching_assignments (tenant_id, teacher_assignment_id, subject_offering_id, academic_group_id)
    VALUES (v_tenant_a, v_teacher_a1, v_offering_a1, v_group_a) RETURNING id INTO v_assignment_a2;

    INSERT INTO secure_assessment_exam_instances (id, tenant_id, teaching_assignment_id)
    VALUES (gen_random_uuid(), v_tenant_a, v_assignment_a2);

    INSERT INTO secure_assessment_exam_instances (id, tenant_id, teaching_assignment_id)
    VALUES (gen_random_uuid(), v_tenant_a, v_assignment_a2);

    SELECT count(*) INTO v_count FROM secure_assessment_exam_instances WHERE teaching_assignment_id = v_assignment_a2;
    ASSERT v_count = 2, 'Multiple Exam Instances may reference the same Teaching Assignment';

    -------------------------------------------------------------------
    -- L. NO ACADEMIC-CORE MUTATION
    -------------------------------------------------------------------
    UPDATE secure_assessment_exam_instances
    SET teaching_assignment_id = NULL
    WHERE id = v_exam_instance_1;

    SELECT count(*) INTO v_count
    FROM academic_core_teaching_assignments
    WHERE id = v_assignment_a1
      AND tenant_id = v_tenant_a
      AND teacher_assignment_id = v_teacher_a1
      AND subject_offering_id = v_offering_a1
      AND academic_group_id = v_group_a
      AND assigned_at IS NOT DISTINCT FROM v_assignment_a1_assigned_at
      AND revoked_at IS NOT DISTINCT FROM v_assignment_a1_revoked_at;

    ASSERT v_count = 1,
        'Exam Instance reference update must not mutate Academic Core Teaching Assignment fields';

    -------------------------------------------------------------------
    -- M. PREDECESSOR INTEGRITY
    -------------------------------------------------------------------

    -- BU-002 Exam Instance primary key baseline.
    SELECT count(*) INTO v_count
    FROM pg_constraint
    WHERE conrelid = 'secure_assessment_exam_instances'::regclass
      AND contype = 'p'
      AND pg_get_constraintdef(oid) = 'PRIMARY KEY (id)';

    ASSERT v_count = 1,
        'BU-002 Exam Instance PRIMARY KEY(id) must remain intact';

    -- BU-002 tenant-safe unique baseline.
    SELECT count(*) INTO v_count
    FROM pg_constraint
    WHERE conrelid = 'secure_assessment_exam_instances'::regclass
      AND conname = 'uq_sa_exam_instances_tenant'
      AND contype = 'u'
      AND pg_get_constraintdef(oid) = 'UNIQUE (id, tenant_id)';

    ASSERT v_count = 1,
        'BU-002 Exam Instance UNIQUE(id, tenant_id) must remain intact';

    -- BU-042 composite unique target required by BU-044 FK.
    SELECT count(*) INTO v_count
    FROM pg_constraint
    WHERE conrelid = 'academic_core_teaching_assignments'::regclass
      AND conname = 'uq_academic_core_teaching_assignments_id_tenant'
      AND contype = 'u'
      AND pg_get_constraintdef(oid) = 'UNIQUE (id, tenant_id)';

    ASSERT v_count = 1,
        'BU-042 UNIQUE(id, tenant_id) must remain intact';

    -- BU-042 active uniqueness baseline must remain intact.
    SELECT count(*) INTO v_count
    FROM pg_index i
    JOIN pg_class idx
      ON idx.oid = i.indexrelid
    WHERE i.indrelid = 'academic_core_teaching_assignments'::regclass
      AND idx.relname = 'udx_academic_core_teaching_assignments_active'
      AND i.indisunique
      AND pg_get_indexdef(i.indexrelid)
          LIKE '%(tenant_id, teacher_assignment_id, subject_offering_id, academic_group_id)%'
      AND pg_get_expr(i.indpred, i.indrelid)
          ILIKE '%revoked_at IS NULL%';

    ASSERT v_count = 1,
        'BU-042 active Teaching Assignment uniqueness/index must remain intact';

    -------------------------------------------------------------------
    -- N. NO PROCTOR COUPLING
    -------------------------------------------------------------------
    -- Tests naturally run without interacting with proctor_assignments

    -------------------------------------------------------------------
    -- CLEANUP
    -------------------------------------------------------------------
    DELETE FROM secure_assessment_exam_instances WHERE tenant_id IN (v_tenant_a, v_tenant_b);
    DELETE FROM academic_core_teaching_assignments WHERE tenant_id IN (v_tenant_a, v_tenant_b);
    DELETE FROM academic_core_subject_offerings WHERE tenant_id IN (v_tenant_a, v_tenant_b);
    DELETE FROM academic_core_subjects WHERE tenant_id IN (v_tenant_a, v_tenant_b);
    DELETE FROM academic_core_academic_groups WHERE tenant_id IN (v_tenant_a, v_tenant_b);
    DELETE FROM academic_core_grade_levels WHERE tenant_id IN (v_tenant_a, v_tenant_b);
    DELETE FROM academic_core_academic_periods WHERE tenant_id IN (v_tenant_a, v_tenant_b);
    DELETE FROM academic_core_academic_years WHERE tenant_id IN (v_tenant_a, v_tenant_b);
    DELETE FROM tenant_teacher_assignments WHERE tenant_id IN (v_tenant_a, v_tenant_b);
    DELETE FROM tenant_memberships WHERE tenant_id IN (v_tenant_a, v_tenant_b);
    DELETE FROM identity_persons WHERE id IN (v_person_a1, v_person_b);
    DELETE FROM tenant_tenants WHERE id IN (v_tenant_a, v_tenant_b);

    RAISE NOTICE 'BU-044 Verifier: PASS';
END
$$;
