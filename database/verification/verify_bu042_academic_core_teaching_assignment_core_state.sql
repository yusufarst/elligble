-- BU-042 Academic Core Teaching Assignment Core State Verification

DO $$
DECLARE
    v_count INTEGER;

    v_tenant_a UUID;
    v_tenant_b UUID;

    v_person_a1 UUID;
    v_person_a2 UUID;
    v_person_b UUID;

    v_membership_a1 UUID;
    v_membership_a2 UUID;
    v_membership_b UUID;

    v_teacher_a1 UUID;
    v_teacher_a2 UUID;
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
    v_offering_a2 UUID;
    v_offering_b UUID;

    v_assignment_old UUID;
    v_assignment_new UUID;
    v_replace_old UUID;
    v_replace_new UUID;
BEGIN
    -------------------------------------------------------------------
    -- 1. Exact structural contract
    -------------------------------------------------------------------

    SELECT count(*) INTO v_count
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'academic_core_teaching_assignments';

    ASSERT v_count = 1,
        'academic_core_teaching_assignments table must exist';

    SELECT count(*) INTO v_count
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'academic_core_teaching_assignments';

    ASSERT v_count = 7,
        'academic_core_teaching_assignments must contain exactly 7 columns';

    SELECT count(*) INTO v_count
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'academic_core_teaching_assignments'
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
                column_name = 'teacher_assignment_id'
                AND ordinal_position = 3
                AND data_type = 'uuid'
                AND is_nullable = 'NO'
                AND column_default IS NULL
            )
         OR (
                column_name = 'subject_offering_id'
                AND ordinal_position = 4
                AND data_type = 'uuid'
                AND is_nullable = 'NO'
                AND column_default IS NULL
            )
         OR (
                column_name = 'academic_group_id'
                AND ordinal_position = 5
                AND data_type = 'uuid'
                AND is_nullable = 'NO'
                AND column_default IS NULL
            )
         OR (
                column_name = 'assigned_at'
                AND ordinal_position = 6
                AND data_type = 'timestamp with time zone'
                AND is_nullable = 'NO'
                AND upper(column_default) LIKE '%CURRENT_TIMESTAMP%'
            )
         OR (
                column_name = 'revoked_at'
                AND ordinal_position = 7
                AND data_type = 'timestamp with time zone'
                AND is_nullable = 'YES'
                AND column_default IS NULL
            )
      );

    ASSERT v_count = 7,
        'Exact BU-042 column type/nullability/default contract required';

    SELECT count(*) INTO v_count
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'academic_core_teaching_assignments'
      AND column_name IN (
          'person_id',
          'membership_id',
          'subject_id',
          'academic_period_id',
          'academic_year_id',
          'grade_level_id',
          'learning_classroom_id',
          'role',
          'assignment_type',
          'capability'
      );

    ASSERT v_count = 0,
        'Forbidden BU-042 columns/model leakage detected';

    -------------------------------------------------------------------
    -- PK / UNIQUE
    -------------------------------------------------------------------

    SELECT count(*) INTO v_count
    FROM pg_constraint
    WHERE conrelid = 'academic_core_teaching_assignments'::regclass
      AND contype = 'p'
      AND pg_get_constraintdef(oid) = 'PRIMARY KEY (id)';

    ASSERT v_count = 1,
        'PRIMARY KEY(id) required';

    SELECT count(*) INTO v_count
    FROM pg_constraint
    WHERE conrelid = 'academic_core_teaching_assignments'::regclass
      AND contype = 'u'
      AND pg_get_constraintdef(oid) = 'UNIQUE (id, tenant_id)';

    ASSERT v_count = 1,
        'UNIQUE(id, tenant_id) required';

    -------------------------------------------------------------------
    -- Exact tenant-safe composite foreign keys
    -------------------------------------------------------------------

    SELECT count(*) INTO v_count
    FROM pg_constraint
    WHERE conrelid = 'academic_core_teaching_assignments'::regclass
      AND conname = 'fk_ac_teaching_assignments_teacher'
      AND contype = 'f'
      AND confrelid = 'tenant_teacher_assignments'::regclass
      AND confdeltype = 'r'
      AND regexp_replace(pg_get_constraintdef(oid), '\s+', ' ', 'g')
          = 'FOREIGN KEY (teacher_assignment_id, tenant_id) REFERENCES tenant_teacher_assignments(id, tenant_id) ON DELETE RESTRICT';

    ASSERT v_count = 1,
        'Exact teacher assignment tenant-safe FK with ON DELETE RESTRICT required';

    SELECT count(*) INTO v_count
    FROM pg_constraint
    WHERE conrelid = 'academic_core_teaching_assignments'::regclass
      AND conname = 'fk_ac_teaching_assignments_offering'
      AND contype = 'f'
      AND confrelid = 'academic_core_subject_offerings'::regclass
      AND confdeltype = 'r'
      AND regexp_replace(pg_get_constraintdef(oid), '\s+', ' ', 'g')
          = 'FOREIGN KEY (subject_offering_id, tenant_id) REFERENCES academic_core_subject_offerings(id, tenant_id) ON DELETE RESTRICT';

    ASSERT v_count = 1,
        'Exact subject offering tenant-safe FK with ON DELETE RESTRICT required';

    SELECT count(*) INTO v_count
    FROM pg_constraint
    WHERE conrelid = 'academic_core_teaching_assignments'::regclass
      AND conname = 'fk_ac_teaching_assignments_group'
      AND contype = 'f'
      AND confrelid = 'academic_core_academic_groups'::regclass
      AND confdeltype = 'r'
      AND regexp_replace(pg_get_constraintdef(oid), '\s+', ' ', 'g')
          = 'FOREIGN KEY (academic_group_id, tenant_id) REFERENCES academic_core_academic_groups(id, tenant_id) ON DELETE RESTRICT';

    ASSERT v_count = 1,
        'Exact Academic Group tenant-safe FK with ON DELETE RESTRICT required';

    -------------------------------------------------------------------
    -- Temporal CHECK
    -------------------------------------------------------------------

    SELECT count(*) INTO v_count
    FROM pg_constraint
    WHERE conrelid = 'academic_core_teaching_assignments'::regclass
      AND conname = 'chk_ac_teaching_assignments_temporal'
      AND contype = 'c'
      AND pg_get_constraintdef(oid) ILIKE '%revoked_at IS NULL%'
      AND pg_get_constraintdef(oid) ILIKE '%revoked_at >= assigned_at%';

    ASSERT v_count = 1,
        'Temporal CHECK required';

    -------------------------------------------------------------------
    -- Active partial UNIQUE index
    -------------------------------------------------------------------

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
        'Exact active partial UNIQUE index required';

    -------------------------------------------------------------------
    -- Migration history
    -------------------------------------------------------------------

    SELECT count(*) INTO v_count
    FROM elligble_migration_history
    WHERE migration_id =
        '0019_bu042_academic_core_teaching_assignment_core_state';

    ASSERT v_count = 1,
        'Migration 0019 history count must be exactly 1';

    -------------------------------------------------------------------
    -- 2. Functional fixtures
    -------------------------------------------------------------------

    INSERT INTO tenant_tenants (id)
    VALUES (gen_random_uuid())
    RETURNING id INTO v_tenant_a;

    INSERT INTO tenant_tenants (id)
    VALUES (gen_random_uuid())
    RETURNING id INTO v_tenant_b;

    INSERT INTO identity_persons (id)
    VALUES (gen_random_uuid())
    RETURNING id INTO v_person_a1;

    INSERT INTO identity_persons (id)
    VALUES (gen_random_uuid())
    RETURNING id INTO v_person_a2;

    INSERT INTO identity_persons (id)
    VALUES (gen_random_uuid())
    RETURNING id INTO v_person_b;

    INSERT INTO tenant_memberships (id, tenant_id, person_id)
    VALUES (gen_random_uuid(), v_tenant_a, v_person_a1)
    RETURNING id INTO v_membership_a1;

    INSERT INTO tenant_memberships (id, tenant_id, person_id)
    VALUES (gen_random_uuid(), v_tenant_a, v_person_a2)
    RETURNING id INTO v_membership_a2;

    INSERT INTO tenant_memberships (id, tenant_id, person_id)
    VALUES (gen_random_uuid(), v_tenant_b, v_person_b)
    RETURNING id INTO v_membership_b;

    INSERT INTO tenant_teacher_assignments (tenant_id, membership_id)
    VALUES (v_tenant_a, v_membership_a1)
    RETURNING id INTO v_teacher_a1;

    INSERT INTO tenant_teacher_assignments (tenant_id, membership_id)
    VALUES (v_tenant_a, v_membership_a2)
    RETURNING id INTO v_teacher_a2;

    INSERT INTO tenant_teacher_assignments (tenant_id, membership_id)
    VALUES (v_tenant_b, v_membership_b)
    RETURNING id INTO v_teacher_b;

    INSERT INTO academic_core_academic_years (
        tenant_id,
        display_label,
        start_date,
        end_date
    )
    VALUES (
        v_tenant_a,
        '2026/2027 A',
        DATE '2026-07-01',
        DATE '2027-06-30'
    )
    RETURNING id INTO v_year_a;

    INSERT INTO academic_core_academic_years (
        tenant_id,
        display_label,
        start_date,
        end_date
    )
    VALUES (
        v_tenant_b,
        '2026/2027 B',
        DATE '2026-07-01',
        DATE '2027-06-30'
    )
    RETURNING id INTO v_year_b;

    INSERT INTO academic_core_academic_periods (
        tenant_id,
        academic_year_id,
        display_label,
        period_type,
        start_date,
        end_date
    )
    VALUES (
        v_tenant_a,
        v_year_a,
        'Semester A',
        'SEMESTER',
        DATE '2026-07-01',
        DATE '2026-12-31'
    )
    RETURNING id INTO v_period_a;

    INSERT INTO academic_core_academic_periods (
        tenant_id,
        academic_year_id,
        display_label,
        period_type,
        start_date,
        end_date
    )
    VALUES (
        v_tenant_b,
        v_year_b,
        'Semester B',
        'SEMESTER',
        DATE '2026-07-01',
        DATE '2026-12-31'
    )
    RETURNING id INTO v_period_b;

    INSERT INTO academic_core_grade_levels (tenant_id, display_label)
    VALUES (v_tenant_a, 'Grade A')
    RETURNING id INTO v_grade_a;

    INSERT INTO academic_core_grade_levels (tenant_id, display_label)
    VALUES (v_tenant_b, 'Grade B')
    RETURNING id INTO v_grade_b;

    INSERT INTO academic_core_academic_groups (
        tenant_id,
        academic_year_id,
        grade_level_id,
        display_label
    )
    VALUES (
        v_tenant_a,
        v_year_a,
        v_grade_a,
        'Group A'
    )
    RETURNING id INTO v_group_a;

    INSERT INTO academic_core_academic_groups (
        tenant_id,
        academic_year_id,
        grade_level_id,
        display_label
    )
    VALUES (
        v_tenant_b,
        v_year_b,
        v_grade_b,
        'Group B'
    )
    RETURNING id INTO v_group_b;

    INSERT INTO academic_core_subjects (tenant_id, display_label)
    VALUES (v_tenant_a, 'Subject A')
    RETURNING id INTO v_subject_a;

    INSERT INTO academic_core_subjects (tenant_id, display_label)
    VALUES (v_tenant_b, 'Subject B')
    RETURNING id INTO v_subject_b;

    INSERT INTO academic_core_subject_offerings (
        tenant_id,
        subject_id,
        academic_period_id,
        grade_level_id
    )
    VALUES (
        v_tenant_a,
        v_subject_a,
        v_period_a,
        v_grade_a
    )
    RETURNING id INTO v_offering_a1;

    INSERT INTO academic_core_subject_offerings (
        tenant_id,
        subject_id,
        academic_period_id,
        grade_level_id
    )
    VALUES (
        v_tenant_a,
        v_subject_a,
        v_period_a,
        v_grade_a
    )
    RETURNING id INTO v_offering_a2;

    INSERT INTO academic_core_subject_offerings (
        tenant_id,
        subject_id,
        academic_period_id,
        grade_level_id
    )
    VALUES (
        v_tenant_b,
        v_subject_b,
        v_period_b,
        v_grade_b
    )
    RETURNING id INTO v_offering_b;

    -------------------------------------------------------------------
    -- 3. Tenant-isolation failures
    -------------------------------------------------------------------

    BEGIN
        INSERT INTO academic_core_teaching_assignments (
            tenant_id,
            teacher_assignment_id,
            subject_offering_id,
            academic_group_id
        )
        VALUES (
            v_tenant_a,
            v_teacher_b,
            v_offering_a1,
            v_group_a
        );

        RAISE EXCEPTION
            'Cross-tenant teacher assignment must fail';
    EXCEPTION WHEN foreign_key_violation THEN
        -- Expected
    END;

    BEGIN
        INSERT INTO academic_core_teaching_assignments (
            tenant_id,
            teacher_assignment_id,
            subject_offering_id,
            academic_group_id
        )
        VALUES (
            v_tenant_a,
            v_teacher_a1,
            v_offering_b,
            v_group_a
        );

        RAISE EXCEPTION
            'Cross-tenant Subject Offering must fail';
    EXCEPTION WHEN foreign_key_violation THEN
        -- Expected
    END;

    BEGIN
        INSERT INTO academic_core_teaching_assignments (
            tenant_id,
            teacher_assignment_id,
            subject_offering_id,
            academic_group_id
        )
        VALUES (
            v_tenant_a,
            v_teacher_a1,
            v_offering_a1,
            v_group_b
        );

        RAISE EXCEPTION
            'Cross-tenant Academic Group must fail';
    EXCEPTION WHEN foreign_key_violation THEN
        -- Expected
    END;

    -------------------------------------------------------------------
    -- 4. Valid assignment / assigned_at
    -------------------------------------------------------------------

    INSERT INTO academic_core_teaching_assignments (
        tenant_id,
        teacher_assignment_id,
        subject_offering_id,
        academic_group_id
    )
    VALUES (
        v_tenant_a,
        v_teacher_a1,
        v_offering_a1,
        v_group_a
    )
    RETURNING id INTO v_assignment_old;

    SELECT count(*) INTO v_count
    FROM academic_core_teaching_assignments
    WHERE id = v_assignment_old
      AND assigned_at IS NOT NULL;

    ASSERT v_count = 1,
        'assigned_at must auto-populate';

    -------------------------------------------------------------------
    -- 5. Active duplicate prevention
    -------------------------------------------------------------------

    BEGIN
        INSERT INTO academic_core_teaching_assignments (
            tenant_id,
            teacher_assignment_id,
            subject_offering_id,
            academic_group_id
        )
        VALUES (
            v_tenant_a,
            v_teacher_a1,
            v_offering_a1,
            v_group_a
        );

        RAISE EXCEPTION
            'Duplicate active Teaching Assignment must fail';
    EXCEPTION WHEN unique_violation THEN
        -- Expected
    END;

    -------------------------------------------------------------------
    -- 6. Co-teaching
    -------------------------------------------------------------------

    INSERT INTO academic_core_teaching_assignments (
        tenant_id,
        teacher_assignment_id,
        subject_offering_id,
        academic_group_id
    )
    VALUES (
        v_tenant_a,
        v_teacher_a2,
        v_offering_a1,
        v_group_a
    );

    SELECT count(*) INTO v_count
    FROM academic_core_teaching_assignments
    WHERE tenant_id = v_tenant_a
      AND subject_offering_id = v_offering_a1
      AND academic_group_id = v_group_a
      AND revoked_at IS NULL;

    ASSERT v_count = 2,
        'Co-teaching must permit two different active teachers';

    -------------------------------------------------------------------
    -- 7. Temporal safety + history + re-assignment
    -------------------------------------------------------------------

    BEGIN
        UPDATE academic_core_teaching_assignments
        SET revoked_at = assigned_at - interval '1 day'
        WHERE id = v_assignment_old;

        RAISE EXCEPTION
            'revoked_at before assigned_at must fail';
    EXCEPTION WHEN check_violation THEN
        -- Expected
    END;

    UPDATE academic_core_teaching_assignments
    SET revoked_at = CURRENT_TIMESTAMP
    WHERE id = v_assignment_old;

    SELECT count(*) INTO v_count
    FROM academic_core_teaching_assignments
    WHERE id = v_assignment_old
      AND revoked_at IS NOT NULL;

    ASSERT v_count = 1,
        'Revoked historical Teaching Assignment must remain';

    INSERT INTO academic_core_teaching_assignments (
        tenant_id,
        teacher_assignment_id,
        subject_offering_id,
        academic_group_id
    )
    VALUES (
        v_tenant_a,
        v_teacher_a1,
        v_offering_a1,
        v_group_a
    )
    RETURNING id INTO v_assignment_new;

    SELECT count(*) INTO v_count
    FROM academic_core_teaching_assignments
    WHERE tenant_id = v_tenant_a
      AND teacher_assignment_id = v_teacher_a1
      AND subject_offering_id = v_offering_a1
      AND academic_group_id = v_group_a;

    ASSERT v_count = 2,
        'Reassignment must preserve historical row and create new row';

    SELECT count(*) INTO v_count
    FROM academic_core_teaching_assignments
    WHERE tenant_id = v_tenant_a
      AND teacher_assignment_id = v_teacher_a1
      AND subject_offering_id = v_offering_a1
      AND academic_group_id = v_group_a
      AND revoked_at IS NULL;

    ASSERT v_count = 1,
        'Exactly one active assignment must remain for same teacher/context';

    -------------------------------------------------------------------
    -- 8. Teacher replacement preserves history
    -------------------------------------------------------------------

    INSERT INTO academic_core_teaching_assignments (
        tenant_id,
        teacher_assignment_id,
        subject_offering_id,
        academic_group_id
    )
    VALUES (
        v_tenant_a,
        v_teacher_a1,
        v_offering_a2,
        v_group_a
    )
    RETURNING id INTO v_replace_old;

    UPDATE academic_core_teaching_assignments
    SET revoked_at = CURRENT_TIMESTAMP
    WHERE id = v_replace_old;

    INSERT INTO academic_core_teaching_assignments (
        tenant_id,
        teacher_assignment_id,
        subject_offering_id,
        academic_group_id
    )
    VALUES (
        v_tenant_a,
        v_teacher_a2,
        v_offering_a2,
        v_group_a
    )
    RETURNING id INTO v_replace_new;

    SELECT count(*) INTO v_count
    FROM academic_core_teaching_assignments
    WHERE id = v_replace_old
      AND revoked_at IS NOT NULL;

    ASSERT v_count = 1,
        'Replaced teacher history must remain';

    SELECT count(*) INTO v_count
    FROM academic_core_teaching_assignments
    WHERE id = v_replace_new
      AND teacher_assignment_id = v_teacher_a2
      AND revoked_at IS NULL;

    ASSERT v_count = 1,
        'Replacement teacher must have active Teaching Assignment';

    -------------------------------------------------------------------
    -- 9. ON DELETE RESTRICT for all three parents
    -------------------------------------------------------------------

    BEGIN
        DELETE FROM tenant_teacher_assignments
        WHERE id = v_teacher_a1;

        RAISE EXCEPTION
            'Referenced TEACHER assignment delete must be restricted';
    EXCEPTION WHEN restrict_violation THEN
        -- Expected
    END;

    BEGIN
        DELETE FROM academic_core_subject_offerings
        WHERE id = v_offering_a1;

        RAISE EXCEPTION
            'Referenced Subject Offering delete must be restricted';
    EXCEPTION WHEN restrict_violation THEN
        -- Expected
    END;

    BEGIN
        DELETE FROM academic_core_academic_groups
        WHERE id = v_group_a;

        RAISE EXCEPTION
            'Referenced Academic Group delete must be restricted';
    EXCEPTION WHEN restrict_violation THEN
        -- Expected
    END;

    -------------------------------------------------------------------
    -- 10. Cleanup
    -------------------------------------------------------------------

    DELETE FROM academic_core_teaching_assignments
    WHERE tenant_id IN (v_tenant_a, v_tenant_b);

    DELETE FROM tenant_teacher_assignments
    WHERE tenant_id IN (v_tenant_a, v_tenant_b);

    DELETE FROM tenant_memberships
    WHERE tenant_id IN (v_tenant_a, v_tenant_b);

    DELETE FROM identity_persons
    WHERE id IN (v_person_a1, v_person_a2, v_person_b);

    DELETE FROM academic_core_subject_offerings
    WHERE tenant_id IN (v_tenant_a, v_tenant_b);

    DELETE FROM academic_core_academic_groups
    WHERE tenant_id IN (v_tenant_a, v_tenant_b);

    DELETE FROM academic_core_subjects
    WHERE tenant_id IN (v_tenant_a, v_tenant_b);

    DELETE FROM academic_core_academic_periods
    WHERE tenant_id IN (v_tenant_a, v_tenant_b);

    DELETE FROM academic_core_grade_levels
    WHERE tenant_id IN (v_tenant_a, v_tenant_b);

    DELETE FROM academic_core_academic_years
    WHERE tenant_id IN (v_tenant_a, v_tenant_b);

    DELETE FROM tenant_tenants
    WHERE id IN (v_tenant_a, v_tenant_b);

    RAISE NOTICE 'BU-042 Verifier: PASS';
END
$$;