-- BU-034 Verification: Secure Assessment Explicit Proctor Assignment Core State Persistence
-- Purpose: Verify schema constraints, catalog integrity, default semantics, boundaries, and functional lifecycle for Proctor Assignment.

DO $$
DECLARE
    t1 UUID := gen_random_uuid();
    t2 UUID := gen_random_uuid();
    person1 UUID := gen_random_uuid();
    person2 UUID := gen_random_uuid();
    person3 UUID := gen_random_uuid();
    exam_inst1 UUID := gen_random_uuid();
    exam_inst2 UUID := gen_random_uuid();
    assign1 UUID := gen_random_uuid();
    assign2 UUID := gen_random_uuid();
    assign3 UUID := gen_random_uuid();
    assign4 UUID := gen_random_uuid();
    default_assign_id UUID;
    default_assigned_at TIMESTAMPTZ;
    col_type TEXT;
    is_null TEXT;
    col_def TEXT;
    col_count INT;
    fk_def TEXT;
    chk_def TEXT;
    idx_def TEXT;
    now_before TIMESTAMPTZ;
BEGIN
    RAISE NOTICE '--- Starting BU-034 Verification ---';

    -- 1. STRUCTURAL ASSERTIONS
    -- Migration history check
    IF NOT EXISTS (SELECT 1 FROM elligble_migration_history WHERE migration_id = '0008_bu034_secure_assessment_explicit_proctor_assignment_core_state') THEN
        RAISE EXCEPTION 'STRUCTURAL FAILED: 0008 migration not in history';
    END IF;

    -- Exactly 6 semantic columns
    SELECT count(*) INTO col_count FROM information_schema.columns WHERE table_name = 'secure_assessment_proctor_assignments';
    IF col_count != 6 THEN
        RAISE EXCEPTION 'STRUCTURAL FAILED: expected exactly 6 columns, found %', col_count;
    END IF;

    -- id column (UUID, NOT NULL, DEFAULT gen_random_uuid())
    SELECT data_type, is_nullable, column_default INTO col_type, is_null, col_def
    FROM information_schema.columns
    WHERE table_name = 'secure_assessment_proctor_assignments' AND column_name = 'id';
    IF col_type != 'uuid' OR is_null != 'NO' OR col_def NOT LIKE '%gen_random_uuid()%' THEN
        RAISE EXCEPTION 'STRUCTURAL FAILED: id column wrong type, nullability, or default (got %, %, %)', col_type, is_null, col_def;
    END IF;

    -- tenant_id column (UUID, NOT NULL)
    SELECT data_type, is_nullable INTO col_type, is_null
    FROM information_schema.columns
    WHERE table_name = 'secure_assessment_proctor_assignments' AND column_name = 'tenant_id';
    IF col_type != 'uuid' OR is_null != 'NO' THEN
        RAISE EXCEPTION 'STRUCTURAL FAILED: tenant_id column wrong type or nullability';
    END IF;

    -- exam_instance_id column (UUID, NOT NULL)
    SELECT data_type, is_nullable INTO col_type, is_null
    FROM information_schema.columns
    WHERE table_name = 'secure_assessment_proctor_assignments' AND column_name = 'exam_instance_id';
    IF col_type != 'uuid' OR is_null != 'NO' THEN
        RAISE EXCEPTION 'STRUCTURAL FAILED: exam_instance_id column wrong type or nullability';
    END IF;

    -- person_id column (UUID, NOT NULL)
    SELECT data_type, is_nullable INTO col_type, is_null
    FROM information_schema.columns
    WHERE table_name = 'secure_assessment_proctor_assignments' AND column_name = 'person_id';
    IF col_type != 'uuid' OR is_null != 'NO' THEN
        RAISE EXCEPTION 'STRUCTURAL FAILED: person_id column wrong type or nullability';
    END IF;

    -- assigned_at column (TIMESTAMPTZ, NOT NULL, DEFAULT CURRENT_TIMESTAMP)
    SELECT data_type, is_nullable, column_default INTO col_type, is_null, col_def
    FROM information_schema.columns
    WHERE table_name = 'secure_assessment_proctor_assignments' AND column_name = 'assigned_at';
    IF col_type != 'timestamp with time zone' OR is_null != 'NO' OR (col_def NOT LIKE '%CURRENT_TIMESTAMP%' AND col_def NOT LIKE '%now()%') THEN
        RAISE EXCEPTION 'STRUCTURAL FAILED: assigned_at column wrong type, nullability, or default (got %, %, %)', col_type, is_null, col_def;
    END IF;

    -- revoked_at column (TIMESTAMPTZ, NULL, NO DEFAULT)
    SELECT data_type, is_nullable, column_default INTO col_type, is_null, col_def
    FROM information_schema.columns
    WHERE table_name = 'secure_assessment_proctor_assignments' AND column_name = 'revoked_at';
    IF col_type != 'timestamp with time zone' OR is_null != 'YES' OR col_def IS NOT NULL THEN
        RAISE EXCEPTION 'STRUCTURAL FAILED: revoked_at column wrong type, nullability, or default';
    END IF;
    RAISE NOTICE 'STRUCTURAL COLUMNS & TYPES: PASS';

    -- Composite tenant-bound FK definition catalog verification
    -- foreign key (exam_instance_id, tenant_id) references secure_assessment_exam_instances(id, tenant_id) ON DELETE RESTRICT
    SELECT pg_get_constraintdef(c.oid) INTO fk_def
    FROM pg_constraint c
    JOIN pg_class t ON c.conrelid = t.oid
    WHERE t.relname = 'secure_assessment_proctor_assignments'
      AND c.conname = 'fk_sa_proctor_assignment_instance'
      AND c.contype = 'f'
      AND c.confdeltype = 'r';

    IF fk_def IS NULL OR fk_def NOT LIKE '%FOREIGN KEY (exam_instance_id, tenant_id) REFERENCES secure_assessment_exam_instances(id, tenant_id)%RESTRICT%' THEN
        RAISE EXCEPTION 'STRUCTURAL FAILED: fk_sa_proctor_assignment_instance definition mismatch: %', fk_def;
    END IF;
    RAISE NOTICE 'STRUCTURAL TENANT-BOUND FK & RESTRICT: PASS';

    -- Temporal CHECK constraint catalog verification
    SELECT pg_get_constraintdef(c.oid) INTO chk_def
    FROM pg_constraint c
    JOIN pg_class t ON c.conrelid = t.oid
    WHERE t.relname = 'secure_assessment_proctor_assignments'
      AND c.conname = 'chk_sa_proctor_assignment_temporal'
      AND c.contype = 'c';

    IF chk_def IS NULL OR (chk_def NOT LIKE '%revoked_at IS NULL%' AND chk_def NOT LIKE '%revoked_at >= assigned_at%') THEN
        RAISE EXCEPTION 'STRUCTURAL FAILED: chk_sa_proctor_assignment_temporal definition mismatch: %', chk_def;
    END IF;
    RAISE NOTICE 'STRUCTURAL TEMPORAL CHECK: PASS';

    -- Partial unique index catalog verification
    SELECT indexdef INTO idx_def
    FROM pg_indexes
    WHERE tablename = 'secure_assessment_proctor_assignments'
      AND indexname = 'uq_sa_proctor_assignment_active';

    IF idx_def IS NULL OR idx_def NOT LIKE '%CREATE UNIQUE INDEX%ON %secure_assessment_proctor_assignments% (tenant_id, exam_instance_id, person_id) WHERE (revoked_at IS NULL)%' THEN
        RAISE EXCEPTION 'STRUCTURAL FAILED: uq_sa_proctor_assignment_active definition mismatch: %', idx_def;
    END IF;
    RAISE NOTICE 'STRUCTURAL PARTIAL UNIQUE INDEX: PASS';

    -- Cross-domain boundary verification: NO direct FK to identity_persons or tenant_tenants
    IF EXISTS (
        SELECT 1 FROM pg_constraint c
        JOIN pg_class t ON c.conrelid = t.oid
        JOIN pg_class t2 ON c.confrelid = t2.oid
        WHERE t.relname = 'secure_assessment_proctor_assignments'
          AND t2.relname IN ('identity_persons', 'tenant_tenants')
    ) THEN
        RAISE EXCEPTION 'STRUCTURAL FAILED: found forbidden direct FK from secure_assessment_proctor_assignments to identity_persons or tenant_tenants';
    END IF;
    RAISE NOTICE 'STRUCTURAL CROSS-DOMAIN BOUNDARY: PASS';

    -- 2. SETUP PREDECESSOR DATA
    INSERT INTO tenant_tenants (id) VALUES (t1), (t2);
    INSERT INTO identity_persons (id) VALUES (person1), (person2), (person3);
    INSERT INTO secure_assessment_exam_instances (id, tenant_id) VALUES (exam_inst1, t1), (exam_inst2, t2);

    -- 3. DEFAULT SEMANTICS BEHAVIORAL VERIFICATION
    now_before := CURRENT_TIMESTAMP - interval '1 second';
    INSERT INTO secure_assessment_proctor_assignments (tenant_id, exam_instance_id, person_id)
    VALUES (t1, exam_inst1, person1)
    RETURNING id, assigned_at INTO default_assign_id, default_assigned_at;

    IF default_assign_id IS NULL OR default_assigned_at IS NULL OR default_assigned_at < now_before THEN
        RAISE EXCEPTION 'FUNCTIONAL FAILED: default id or assigned_at not generated correctly';
    END IF;
    -- Clean up default insert before functional suite
    DELETE FROM secure_assessment_proctor_assignments WHERE id = default_assign_id;
    RAISE NOTICE 'DEFAULT SEMANTICS INSERT BEHAVIOR: PASS';

    -- 4. FUNCTIONAL VERIFICATION
    -- 1. Valid same-tenant assignment succeeds
    INSERT INTO secure_assessment_proctor_assignments (id, tenant_id, exam_instance_id, person_id)
    VALUES (assign1, t1, exam_inst1, person1);
    RAISE NOTICE '1. Valid same-tenant assignment: PASS';

    -- 2. Cross-tenant Exam Instance assignment is rejected
    BEGIN
        INSERT INTO secure_assessment_proctor_assignments (tenant_id, exam_instance_id, person_id)
        VALUES (t2, exam_inst1, person2);
        RAISE EXCEPTION 'FAILED: cross-tenant assignment allowed';
    EXCEPTION WHEN foreign_key_violation OR restrict_violation THEN
        RAISE NOTICE '2. Cross-tenant rejection: PASS';
    END;

    -- 3. Two different Persons may simultaneously be active Proctors for the same Exam Instance
    INSERT INTO secure_assessment_proctor_assignments (tenant_id, exam_instance_id, person_id)
    VALUES (t1, exam_inst1, person2);
    RAISE NOTICE '3. Two different Persons active same Instance: PASS';

    -- 4. One Person may be active across different Exam Instances
    INSERT INTO secure_assessment_proctor_assignments (tenant_id, exam_instance_id, person_id)
    VALUES (t2, exam_inst2, person1);
    RAISE NOTICE '4. One Person active different Instances: PASS';

    -- 5. Duplicate simultaneous active assignment for identical tenant + instance + person fails
    BEGIN
        INSERT INTO secure_assessment_proctor_assignments (tenant_id, exam_instance_id, person_id)
        VALUES (t1, exam_inst1, person1);
        RAISE EXCEPTION 'FAILED: duplicate active assignment allowed';
    EXCEPTION WHEN unique_violation THEN
        RAISE NOTICE '5. Duplicate active assignment rejected: PASS';
    END;

    -- 6. Revoked assignment remains stored
    UPDATE secure_assessment_proctor_assignments SET revoked_at = CURRENT_TIMESTAMP WHERE id = assign1;
    IF NOT EXISTS (SELECT 1 FROM secure_assessment_proctor_assignments WHERE id = assign1 AND revoked_at IS NOT NULL) THEN
        RAISE EXCEPTION 'FAILED: revoked assignment not stored';
    END IF;
    RAISE NOTICE '6. Revoked assignment remains stored: PASS';

    -- 7. Reassignment after revoke succeeds
    INSERT INTO secure_assessment_proctor_assignments (id, tenant_id, exam_instance_id, person_id)
    VALUES (assign2, t1, exam_inst1, person1);
    RAISE NOTICE '7. Reassignment after revoke: PASS';

    -- 8. Multiple historical revoked rows are permitted
    UPDATE secure_assessment_proctor_assignments SET revoked_at = CURRENT_TIMESTAMP WHERE id = assign2;
    INSERT INTO secure_assessment_proctor_assignments (id, tenant_id, exam_instance_id, person_id)
    VALUES (assign3, t1, exam_inst1, person1);
    UPDATE secure_assessment_proctor_assignments SET revoked_at = CURRENT_TIMESTAMP WHERE id = assign3;
    RAISE NOTICE '8. Multiple historical revoked rows permitted: PASS';

    -- 9. Revoked_at earlier than assigned_at is rejected
    BEGIN
        INSERT INTO secure_assessment_proctor_assignments (tenant_id, exam_instance_id, person_id, assigned_at, revoked_at)
        VALUES (t1, exam_inst1, person3, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP - interval '1 hour');
        RAISE EXCEPTION 'FAILED: revoked_at earlier than assigned_at allowed';
    EXCEPTION WHEN check_violation THEN
        RAISE NOTICE '9. Revoked_at earlier than assigned_at rejected: PASS';
    END;

    -- 10. Parent Exam Instance delete is rejected while dependent Proctor Assignment history exists
    BEGIN
        DELETE FROM secure_assessment_exam_instances WHERE id = exam_inst1;
        RAISE EXCEPTION 'FAILED: Exam Instance delete not restricted';
    EXCEPTION WHEN foreign_key_violation OR restrict_violation THEN
        RAISE NOTICE '10. Exam Instance delete restricted: PASS';
    END;

    RAISE NOTICE '--- BU-034 Verification Complete: ALL PASS ---';
END $$;
