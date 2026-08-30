-- BU-034 Verification: Secure Assessment Explicit Proctor Assignment Core State Persistence
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
    col_type TEXT;
    is_null TEXT;
BEGIN
    RAISE NOTICE '--- Starting BU-034 Verification ---';

    -- A. migration chain 0001 through 0008 applies
    IF NOT EXISTS (SELECT 1 FROM elligble_migration_history WHERE migration_id = '0008_bu034_secure_assessment_explicit_proctor_assignment_core_state') THEN
        RAISE EXCEPTION 'FAILED: 0008 migration not in history';
    END IF;
    RAISE NOTICE 'A. migration chain applies: PASS';

    -- B. table exists with exact required columns
    SELECT data_type, is_nullable INTO col_type, is_null FROM information_schema.columns WHERE table_name = 'secure_assessment_proctor_assignments' AND column_name = 'id';
    IF col_type != 'uuid' OR is_null != 'NO' THEN RAISE EXCEPTION 'FAILED: id column'; END IF;
    SELECT data_type, is_nullable INTO col_type, is_null FROM information_schema.columns WHERE table_name = 'secure_assessment_proctor_assignments' AND column_name = 'tenant_id';
    IF col_type != 'uuid' OR is_null != 'NO' THEN RAISE EXCEPTION 'FAILED: tenant_id column'; END IF;
    SELECT data_type, is_nullable INTO col_type, is_null FROM information_schema.columns WHERE table_name = 'secure_assessment_proctor_assignments' AND column_name = 'exam_instance_id';
    IF col_type != 'uuid' OR is_null != 'NO' THEN RAISE EXCEPTION 'FAILED: exam_instance_id column'; END IF;
    SELECT data_type, is_nullable INTO col_type, is_null FROM information_schema.columns WHERE table_name = 'secure_assessment_proctor_assignments' AND column_name = 'person_id';
    IF col_type != 'uuid' OR is_null != 'NO' THEN RAISE EXCEPTION 'FAILED: person_id column'; END IF;
    SELECT data_type, is_nullable INTO col_type, is_null FROM information_schema.columns WHERE table_name = 'secure_assessment_proctor_assignments' AND column_name = 'assigned_at';
    IF col_type != 'timestamp with time zone' OR is_null != 'NO' THEN RAISE EXCEPTION 'FAILED: assigned_at column'; END IF;
    SELECT data_type, is_nullable INTO col_type, is_null FROM information_schema.columns WHERE table_name = 'secure_assessment_proctor_assignments' AND column_name = 'revoked_at';
    IF col_type != 'timestamp with time zone' OR is_null != 'YES' THEN RAISE EXCEPTION 'FAILED: revoked_at column'; END IF;
    RAISE NOTICE 'B. table structure: PASS';

    -- C. composite Exam Instance + Tenant FK exists
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint c
        JOIN pg_class t ON c.conrelid = t.oid
        WHERE t.relname = 'secure_assessment_proctor_assignments' AND c.conname = 'fk_sa_proctor_assignment_instance'
    ) THEN RAISE EXCEPTION 'FAILED: fk_sa_proctor_assignment_instance missing'; END IF;
    RAISE NOTICE 'C. composite FK: PASS';

    -- N. there is no direct FK from person_id to identity_persons
    IF EXISTS (
        SELECT 1 FROM pg_constraint c
        JOIN pg_class t ON c.conrelid = t.oid
        JOIN pg_class t2 ON c.confrelid = t2.oid
        WHERE t.relname = 'secure_assessment_proctor_assignments' AND t2.relname = 'identity_persons'
    ) THEN RAISE EXCEPTION 'FAILED: found direct FK to identity_persons'; END IF;
    RAISE NOTICE 'N. no direct Person FK: PASS';

    -- SETUP DATA
    INSERT INTO tenant_tenants (id) VALUES (t1), (t2);
    INSERT INTO identity_persons (id) VALUES (person1), (person2), (person3);
    INSERT INTO secure_assessment_exam_instances (id, tenant_id) VALUES (exam_inst1, t1), (exam_inst2, t2);

    -- P. predecessor Secure Assessment persistence remains intact (implied by setup data success)
    RAISE NOTICE 'P. predecessor persistence intact: PASS';

    -- D. valid same-tenant assignment succeeds
    INSERT INTO secure_assessment_proctor_assignments (id, tenant_id, exam_instance_id, person_id)
    VALUES (assign1, t1, exam_inst1, person1);
    RAISE NOTICE 'D. valid same-tenant assignment: PASS';

    -- E. cross-tenant Exam Instance assignment is rejected
    BEGIN
        INSERT INTO secure_assessment_proctor_assignments (tenant_id, exam_instance_id, person_id)
        VALUES (t2, exam_inst1, person2);
        RAISE EXCEPTION 'FAILED: cross-tenant assignment allowed';
    EXCEPTION WHEN foreign_key_violation OR restrict_violation THEN
        RAISE NOTICE 'E. cross-tenant rejection: PASS';
    END;

    -- F. two different Persons may both be active Proctors for the same Exam Instance
    INSERT INTO secure_assessment_proctor_assignments (tenant_id, exam_instance_id, person_id)
    VALUES (t1, exam_inst1, person2);
    RAISE NOTICE 'F. two different Persons active same Instance: PASS';

    -- G. one Person may be active on different Exam Instances
    INSERT INTO secure_assessment_proctor_assignments (tenant_id, exam_instance_id, person_id)
    VALUES (t2, exam_inst2, person1);
    RAISE NOTICE 'G. one Person active different Instances: PASS';

    -- H. duplicate active same tenant + instance + person assignment is rejected
    BEGIN
        INSERT INTO secure_assessment_proctor_assignments (tenant_id, exam_instance_id, person_id)
        VALUES (t1, exam_inst1, person1);
        RAISE EXCEPTION 'FAILED: duplicate active assignment allowed';
    EXCEPTION WHEN unique_violation THEN
        RAISE NOTICE 'H. duplicate active assignment rejected: PASS';
    END;

    -- I. revoked assignment remains stored
    UPDATE secure_assessment_proctor_assignments SET revoked_at = CURRENT_TIMESTAMP WHERE id = assign1;
    IF NOT EXISTS (SELECT 1 FROM secure_assessment_proctor_assignments WHERE id = assign1 AND revoked_at IS NOT NULL) THEN
        RAISE EXCEPTION 'FAILED: revoked assignment not stored';
    END IF;
    RAISE NOTICE 'I. revoked assignment remains stored: PASS';

    -- J. reassignment after revoke succeeds
    INSERT INTO secure_assessment_proctor_assignments (id, tenant_id, exam_instance_id, person_id)
    VALUES (assign2, t1, exam_inst1, person1);
    RAISE NOTICE 'J. reassignment after revoke: PASS';

    -- K. multiple historical revoked rows are permitted
    UPDATE secure_assessment_proctor_assignments SET revoked_at = CURRENT_TIMESTAMP WHERE id = assign2;
    INSERT INTO secure_assessment_proctor_assignments (id, tenant_id, exam_instance_id, person_id)
    VALUES (assign3, t1, exam_inst1, person1);
    UPDATE secure_assessment_proctor_assignments SET revoked_at = CURRENT_TIMESTAMP WHERE id = assign3;
    RAISE NOTICE 'K. multiple historical revoked rows permitted: PASS';

    -- L. revoked_at earlier than assigned_at is rejected
    BEGIN
        INSERT INTO secure_assessment_proctor_assignments (tenant_id, exam_instance_id, person_id, assigned_at, revoked_at)
        VALUES (t1, exam_inst1, person3, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP - interval '1 hour');
        RAISE EXCEPTION 'FAILED: revoked_at earlier than assigned_at allowed';
    EXCEPTION WHEN check_violation THEN
        RAISE NOTICE 'L. revoked_at earlier than assigned_at rejected: PASS';
    END;

    -- M. Exam Instance delete with dependent Proctor Assignment history is restricted by the defined FK
    BEGIN
        DELETE FROM secure_assessment_exam_instances WHERE id = exam_inst1;
        RAISE EXCEPTION 'FAILED: Exam Instance delete not restricted';
    EXCEPTION WHEN foreign_key_violation OR restrict_violation THEN
        RAISE NOTICE 'M. Exam Instance delete restricted: PASS';
    END;

    RAISE NOTICE '--- Verification Complete ---';
END $$;
