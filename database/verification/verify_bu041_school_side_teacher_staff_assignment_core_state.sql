\ir ../migrations/0018_bu041_school_side_teacher_staff_assignment_core_state.sql

DO $$
DECLARE
    v_history_count INTEGER;
    v_column_count INTEGER;
    v_count INTEGER;
    v_tenant_a UUID;
    v_tenant_b UUID;
    v_person_a UUID;
    v_person_b UUID;
    v_membership_a UUID;
    v_membership_b UUID;
    v_assignment UUID;
    v_mig_count INTEGER;
    v_expected_mig TEXT;
    v_all_migs TEXT[] := ARRAY[
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
        '0017_bu040_subject_offering_migration_repeat_safety_remediation',
        '0018_bu041_school_side_teacher_staff_assignment_core_state'
    ];
BEGIN
    -------------------------------------------------------------------
    -- 1. Migration History Integrity (0001-0018)
    -------------------------------------------------------------------
    FOREACH v_expected_mig IN ARRAY v_all_migs
    LOOP
        SELECT count(*) INTO v_mig_count
        FROM elligble_migration_history
        WHERE migration_id = v_expected_mig;

        IF v_mig_count != 1 THEN
            RAISE EXCEPTION 'Migration % count is %, expected 1', v_expected_mig, v_mig_count;
        END IF;
    END LOOP;

    -------------------------------------------------------------------
    -- 2. Validate BU-040 Migration Guard Logic
    -------------------------------------------------------------------
    -- Duplicate 0016 should be silently ignored (count remains 1)
    INSERT INTO elligble_migration_history (migration_id, applied_at)
    VALUES ('0016_bu040_academic_core_subject_offering_core_state', CURRENT_TIMESTAMP);

    SELECT count(*) INTO v_count FROM elligble_migration_history WHERE migration_id = '0016_bu040_academic_core_subject_offering_core_state';
    ASSERT v_count = 1, '0016 history count changed! Guard is broken.';

    -- Duplicate 0015 must raise unique_violation
    BEGIN
        INSERT INTO elligble_migration_history (migration_id, applied_at)
        VALUES ('0015_bu039_academic_core_academic_group_core_state', CURRENT_TIMESTAMP);
        RAISE EXCEPTION 'Duplicate 0015 did not throw unique_violation!';
    EXCEPTION WHEN unique_violation THEN
        -- Expected
    END;

    -------------------------------------------------------------------
    -- 3. Exact Structural Contract
    -------------------------------------------------------------------

    -- Exactly five columns and exact column contracts.
    SELECT count(*) INTO v_count
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'tenant_teacher_assignments'
      AND (
          (
              column_name = 'id'
              AND data_type = 'uuid'
              AND is_nullable = 'NO'
              AND column_default = 'gen_random_uuid()'
          )
          OR
          (
              column_name = 'tenant_id'
              AND data_type = 'uuid'
              AND is_nullable = 'NO'
              AND column_default IS NULL
          )
          OR
          (
              column_name = 'membership_id'
              AND data_type = 'uuid'
              AND is_nullable = 'NO'
              AND column_default IS NULL
          )
          OR
          (
              column_name = 'assigned_at'
              AND data_type = 'timestamp with time zone'
              AND is_nullable = 'NO'
              AND (
                  column_default ILIKE '%CURRENT_TIMESTAMP%'
                  OR column_default ILIKE '%now()%'
              )
          )
          OR
          (
              column_name = 'revoked_at'
              AND data_type = 'timestamp with time zone'
              AND is_nullable = 'YES'
              AND column_default IS NULL
          )
      );

    ASSERT v_count = 5,
        'Exact five-column type/nullability/default contract required';

    SELECT count(*) INTO v_column_count
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'tenant_teacher_assignments';

    ASSERT v_column_count = 5,
        'tenant_teacher_assignments must have exactly 5 columns';

    -- Explicit forbidden columns.
    SELECT count(*) INTO v_count
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'tenant_teacher_assignments'
      AND column_name IN (
          'person_id',
          'subject_id',
          'subject_offering_id',
          'academic_year_id',
          'academic_period_id',
          'grade_level_id',
          'academic_group_id',
          'rombel_id',
          'learning_classroom_id',
          'role_id',
          'assignment_type',
          'capability',
          'permission'
      );

    ASSERT v_count = 0,
        'Forbidden BU-041 columns must not exist';

    -- Exact primary key.
    SELECT count(*) INTO v_count
    FROM pg_constraint
    WHERE conrelid = 'tenant_teacher_assignments'::regclass
      AND contype = 'p'
      AND pg_get_constraintdef(oid) = 'PRIMARY KEY (id)';

    ASSERT v_count = 1,
        'PRIMARY KEY (id) required';

    -- Exact assignment composite identity.
    SELECT count(*) INTO v_count
    FROM pg_constraint
    WHERE conrelid = 'tenant_teacher_assignments'::regclass
      AND contype = 'u'
      AND pg_get_constraintdef(oid) = 'UNIQUE (id, tenant_id)';

    ASSERT v_count = 1,
        'UNIQUE (id, tenant_id) required on teacher assignments';

    SELECT count(*) INTO v_count
    FROM pg_constraint
    WHERE conrelid = 'tenant_teacher_assignments'::regclass
      AND contype = 'u';

    ASSERT v_count = 1,
        'Teacher assignment table must have exactly one UNIQUE constraint';

    -- Membership supporting composite key.
    SELECT count(*) INTO v_count
    FROM pg_constraint
    WHERE conrelid = 'tenant_memberships'::regclass
      AND contype = 'u'
      AND pg_get_constraintdef(oid) = 'UNIQUE (id, tenant_id)';

    ASSERT v_count = 1,
        'tenant_memberships UNIQUE (id, tenant_id) required';

    -- Exact tenant-safe Membership FK.
    SELECT count(*) INTO v_count
    FROM pg_constraint
    WHERE conrelid = 'tenant_teacher_assignments'::regclass
      AND contype = 'f'
      AND confrelid = 'tenant_memberships'::regclass
      AND pg_get_constraintdef(oid) =
          'FOREIGN KEY (membership_id, tenant_id) REFERENCES tenant_memberships(id, tenant_id) ON DELETE RESTRICT';

    ASSERT v_count = 1,
        'Exact tenant-safe Membership FK required';

    SELECT count(*) INTO v_count
    FROM pg_constraint
    WHERE conrelid = 'tenant_teacher_assignments'::regclass
      AND contype = 'f';

    ASSERT v_count = 1,
        'Teacher assignment table must have exactly one FK';

    -- Temporal CHECK.
    SELECT count(*) INTO v_count
    FROM pg_constraint
    WHERE conrelid = 'tenant_teacher_assignments'::regclass
      AND conname = 'chk_tenant_teacher_assignments_temporal'
      AND contype = 'c'
      AND pg_get_constraintdef(oid) ILIKE '%revoked_at IS NULL%'
      AND pg_get_constraintdef(oid) ILIKE '%revoked_at >= assigned_at%';

    ASSERT v_count = 1,
        'Temporal revoked_at/assigned_at CHECK required';

    -- Exact active partial UNIQUE index.
    SELECT count(*) INTO v_count
    FROM pg_index i
    JOIN pg_class idx
      ON idx.oid = i.indexrelid
    WHERE i.indrelid = 'tenant_teacher_assignments'::regclass
      AND idx.relname = 'udx_tenant_teacher_assignments_active'
      AND i.indisunique
      AND pg_get_indexdef(i.indexrelid)
          LIKE '%(tenant_id, membership_id)%'
      AND pg_get_expr(i.indpred, i.indrelid)
          ILIKE '%revoked_at IS NULL%';

    ASSERT v_count = 1,
        'Active partial UNIQUE index required';

    -------------------------------------------------------------------
    -- 4. Functional Testing
    -------------------------------------------------------------------
    -- Setup Tenants
    INSERT INTO tenant_tenants (id) VALUES (gen_random_uuid()) RETURNING id INTO v_tenant_a;
    INSERT INTO tenant_tenants (id) VALUES (gen_random_uuid()) RETURNING id INTO v_tenant_b;

    -- Setup Persons
    INSERT INTO identity_persons (id) VALUES (gen_random_uuid()) RETURNING id INTO v_person_a;
    INSERT INTO identity_persons (id) VALUES (gen_random_uuid()) RETURNING id INTO v_person_b;

    -- Setup Memberships
    INSERT INTO tenant_memberships (id, tenant_id, person_id) VALUES (gen_random_uuid(), v_tenant_a, v_person_a) RETURNING id INTO v_membership_a;
    INSERT INTO tenant_memberships (id, tenant_id, person_id) VALUES (gen_random_uuid(), v_tenant_b, v_person_b) RETURNING id INTO v_membership_b;

    -- Valid Assignment
    INSERT INTO tenant_teacher_assignments (tenant_id, membership_id)
    VALUES (v_tenant_a, v_membership_a) RETURNING id INTO v_assignment;
    -- assigned_at must auto-populate.
    SELECT count(*) INTO v_count
    FROM tenant_teacher_assignments
    WHERE id = v_assignment
      AND assigned_at IS NOT NULL;

    ASSERT v_count = 1,
        'assigned_at must auto-populate for valid assignment';

    -- Cross-tenant failure (Membership B assigned in Tenant A)
    BEGIN
        INSERT INTO tenant_teacher_assignments (tenant_id, membership_id)
        VALUES (v_tenant_a, v_membership_b);
        RAISE EXCEPTION 'Cross-tenant assignment must fail';
    EXCEPTION WHEN foreign_key_violation THEN
        -- Expected
    END;

    -- Duplicate active assignment failure
    BEGIN
        INSERT INTO tenant_teacher_assignments (tenant_id, membership_id)
        VALUES (v_tenant_a, v_membership_a);
        RAISE EXCEPTION 'Duplicate active assignment must fail';
    EXCEPTION WHEN unique_violation THEN
        -- Expected
    END;

    -- Temporal validation (revoked_at < assigned_at)
    BEGIN
        UPDATE tenant_teacher_assignments
        SET revoked_at = assigned_at - interval '1 day'
        WHERE id = v_assignment;
        RAISE EXCEPTION 'Temporal check must fail for revoked_at < assigned_at';
    EXCEPTION WHEN check_violation THEN
        -- Expected
    END;

    -- Revocation succeeds
    UPDATE tenant_teacher_assignments
    SET revoked_at = CURRENT_TIMESTAMP
    WHERE id = v_assignment;
    -- Revoked historical row must remain stored.
    SELECT count(*) INTO v_count
    FROM tenant_teacher_assignments
    WHERE id = v_assignment
      AND tenant_id = v_tenant_a
      AND membership_id = v_membership_a
      AND revoked_at IS NOT NULL;

    ASSERT v_count = 1,
        'Revoked historical assignment must remain stored';

    -- Re-assignment after revocation succeeds.
    INSERT INTO tenant_teacher_assignments (tenant_id, membership_id)
    VALUES (v_tenant_a, v_membership_a);

    -- Historical + new assignment must both remain.
    SELECT count(*) INTO v_count
    FROM tenant_teacher_assignments
    WHERE tenant_id = v_tenant_a
      AND membership_id = v_membership_a;

    ASSERT v_count = 2,
        'Reassignment must preserve historical row and create a new row';

    -- Exactly one assignment remains active.
    SELECT count(*) INTO v_count
    FROM tenant_teacher_assignments
    WHERE tenant_id = v_tenant_a
      AND membership_id = v_membership_a
      AND revoked_at IS NULL;

    ASSERT v_count = 1,
        'Exactly one active TEACHER assignment must remain';

    -- Delete membership RESTRICT check
    BEGIN
        DELETE FROM tenant_memberships WHERE id = v_membership_a;
        RAISE EXCEPTION 'Delete membership must be restricted';
    EXCEPTION WHEN restrict_violation THEN
        -- Expected
    END;

    -- Cleanup test data
    DELETE FROM tenant_teacher_assignments WHERE tenant_id IN (v_tenant_a, v_tenant_b);
    DELETE FROM tenant_memberships WHERE tenant_id IN (v_tenant_a, v_tenant_b);
    DELETE FROM identity_persons WHERE id IN (v_person_a, v_person_b);
    DELETE FROM tenant_tenants WHERE id IN (v_tenant_a, v_tenant_b);

    RAISE NOTICE 'BU-041 Verifier: PASS';
END
$$;
