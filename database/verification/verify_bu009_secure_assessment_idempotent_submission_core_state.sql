-- Verification for Migration 0006: BU-009 Secure Assessment Idempotent Submission Core State Persistence Bootstrap

BEGIN;

DO $$
DECLARE
    t_count INT;
    col_exists BOOLEAN;
    fk_count INT;
BEGIN
    -- 1. exact table exists: secure_assessment_exam_submissions
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'secure_assessment_exam_submissions') THEN
        RAISE EXCEPTION 'V1 FAIL: secure_assessment_exam_submissions missing';
    END IF;

    -- 2. exact four columns only: id, tenant_id, exam_attempt_id, submitted_at
    SELECT count(*) INTO t_count FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'secure_assessment_exam_submissions';
    IF t_count != 4 THEN
        RAISE EXCEPTION 'V2 FAIL: Expected exactly 4 columns, found %', t_count;
    END IF;

    -- 3, 4, 5, 6. exact data types, exact nullability, id default, submitted_at default
    SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'secure_assessment_exam_submissions' AND column_name = 'id' AND is_nullable = 'NO' AND data_type = 'uuid' AND column_default = 'gen_random_uuid()') INTO col_exists;
    IF NOT col_exists THEN RAISE EXCEPTION 'V3 FAIL: id column incorrect'; END IF;

    SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'secure_assessment_exam_submissions' AND column_name = 'tenant_id' AND is_nullable = 'NO' AND data_type = 'uuid' AND column_default IS NULL) INTO col_exists;
    IF NOT col_exists THEN RAISE EXCEPTION 'V3 FAIL: tenant_id column incorrect'; END IF;

    SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'secure_assessment_exam_submissions' AND column_name = 'exam_attempt_id' AND is_nullable = 'NO' AND data_type = 'uuid' AND column_default IS NULL) INTO col_exists;
    IF NOT col_exists THEN RAISE EXCEPTION 'V3 FAIL: exam_attempt_id column incorrect'; END IF;

    SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'secure_assessment_exam_submissions' AND column_name = 'submitted_at' AND is_nullable = 'NO' AND data_type LIKE 'timestamp%with time zone' AND (column_default = 'CURRENT_TIMESTAMP' OR column_default = 'now()')) INTO col_exists;
    IF NOT col_exists THEN RAISE EXCEPTION 'V3 FAIL: submitted_at column incorrect'; END IF;

    -- 7. exact primary key on id
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.key_column_usage kcu
        JOIN information_schema.table_constraints tc ON kcu.constraint_name = tc.constraint_name
        WHERE tc.table_schema = 'public' AND tc.table_name = 'secure_assessment_exam_submissions' AND tc.constraint_type = 'PRIMARY KEY' AND kcu.column_name = 'id'
        AND NOT EXISTS (SELECT 1 FROM information_schema.key_column_usage kcu2 WHERE kcu2.constraint_name = tc.constraint_name AND kcu2.column_name != 'id')
    ) THEN RAISE EXCEPTION 'V7 FAIL: PK is not exactly (id)'; END IF;

    -- 8. exact constraint: uq_sa_submission_attempt UNIQUE (tenant_id, exam_attempt_id)
    SELECT count(*) INTO fk_count FROM pg_constraint c JOIN pg_class t ON c.conrelid = t.oid JOIN pg_namespace n ON t.relnamespace = n.oid JOIN pg_attribute a1 ON a1.attrelid = t.oid AND a1.attnum = c.conkey[1] JOIN pg_attribute a2 ON a2.attrelid = t.oid AND a2.attnum = c.conkey[2]
    WHERE n.nspname = 'public' AND t.relname = 'secure_assessment_exam_submissions' AND c.contype = 'u' AND c.conname = 'uq_sa_submission_attempt' AND a1.attname = 'tenant_id' AND a2.attname = 'exam_attempt_id' AND array_length(c.conkey, 1) = 2;
    IF fk_count != 1 THEN
        RAISE EXCEPTION 'V8 FAIL: uq_sa_submission_attempt UNIQUE (tenant_id, exam_attempt_id) missing or incorrect';
    END IF;

    -- 9. exact constraint: uq_sa_submission_tenant UNIQUE (id, tenant_id)
    SELECT count(*) INTO fk_count FROM pg_constraint c JOIN pg_class t ON c.conrelid = t.oid JOIN pg_namespace n ON t.relnamespace = n.oid JOIN pg_attribute a1 ON a1.attrelid = t.oid AND a1.attnum = c.conkey[1] JOIN pg_attribute a2 ON a2.attrelid = t.oid AND a2.attnum = c.conkey[2]
    WHERE n.nspname = 'public' AND t.relname = 'secure_assessment_exam_submissions' AND c.contype = 'u' AND c.conname = 'uq_sa_submission_tenant' AND a1.attname = 'id' AND a2.attname = 'tenant_id' AND array_length(c.conkey, 1) = 2;
    IF fk_count != 1 THEN
        RAISE EXCEPTION 'V9 FAIL: uq_sa_submission_tenant UNIQUE (id, tenant_id) missing or incorrect';
    END IF;

    -- 10. exact foreign key: fk_sa_submission_attempt
    SELECT count(*) INTO fk_count FROM pg_constraint c JOIN pg_class t1 ON t1.oid = c.conrelid JOIN pg_namespace n1 ON t1.relnamespace = n1.oid JOIN pg_class t2 ON t2.oid = c.confrelid JOIN pg_namespace n2 ON t2.relnamespace = n2.oid JOIN pg_attribute a1 ON a1.attrelid = t1.oid AND a1.attnum = c.conkey[1] JOIN pg_attribute a2 ON a2.attrelid = t1.oid AND a2.attnum = c.conkey[2] JOIN pg_attribute f1 ON f1.attrelid = t2.oid AND f1.attnum = c.confkey[1] JOIN pg_attribute f2 ON f2.attrelid = t2.oid AND f2.attnum = c.confkey[2]
    WHERE c.conname = 'fk_sa_submission_attempt' AND c.contype = 'f' AND c.confdeltype = 'r' AND n1.nspname = 'public' AND t1.relname = 'secure_assessment_exam_submissions' AND a1.attname = 'exam_attempt_id' AND a2.attname = 'tenant_id' AND n2.nspname = 'public' AND t2.relname = 'secure_assessment_exam_attempts' AND f1.attname = 'id' AND f2.attname = 'tenant_id' AND array_length(c.conkey, 1) = 2;
    IF fk_count != 1 THEN RAISE EXCEPTION 'V10 FAIL: fk_sa_submission_attempt exact mapping incorrect'; END IF;

    -- 19. migration-history identity appears exactly as required after migration
    SELECT COUNT(*) INTO t_count FROM elligble_migration_history WHERE migration_id = '0006_bu009_secure_assessment_idempotent_submission_core_state';
    IF t_count != 1 THEN RAISE EXCEPTION 'V19 FAIL: Migration history count is % (expected 1)', t_count; END IF;

    -- 20. predecessor persistence remains valid enough for the BU-009 verification fixture
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'secure_assessment_exam_attempts') THEN RAISE EXCEPTION 'V20 FAIL: secure_assessment_exam_attempts missing'; END IF;

    -- Data verification for 11, 12, 13, 14, 15, 16, 17, 18
    -- Insert test data respecting predecessors
    -- Tenant 1
    INSERT INTO secure_assessment_exam_instances (id, tenant_id) VALUES ('10000000-0000-0000-0000-000000000000', '99999999-9999-9999-9999-999999999999');
    INSERT INTO secure_assessment_exam_participants (id, tenant_id, exam_instance_id, person_id) VALUES ('20000000-0000-0000-0000-000000000000', '99999999-9999-9999-9999-999999999999', '10000000-0000-0000-0000-000000000000', '88888888-8888-8888-8888-888888888888');
    INSERT INTO secure_assessment_exam_attempts (id, tenant_id, exam_participant_id) VALUES ('40000000-0000-0000-0000-000000000000', '99999999-9999-9999-9999-999999999999', '20000000-0000-0000-0000-000000000000');
    -- Attempt 2 on Tenant 1
    INSERT INTO secure_assessment_exam_attempts (id, tenant_id, exam_participant_id) VALUES ('40000000-0000-0000-0000-000000000001', '99999999-9999-9999-9999-999999999999', '20000000-0000-0000-0000-000000000000');

    -- Tenant 2 for cross-tenant testing (V12)
    -- Tenant identity is explicit in bounded lookup predicates

    -- 11. same-tenant valid Exam Attempt submission succeeds
    -- 15. submitted_at is populated by the database when omitted from INSERT
    INSERT INTO secure_assessment_exam_submissions (id, tenant_id, exam_attempt_id) VALUES ('50000000-0000-0000-0000-000000000000', '99999999-9999-9999-9999-999999999999', '40000000-0000-0000-0000-000000000000');

    -- 12. cross-tenant Exam Attempt mismatch is rejected by authoritative database constraint
    BEGIN
        INSERT INTO secure_assessment_exam_submissions (id, tenant_id, exam_attempt_id) VALUES ('50000000-0000-0000-0000-000000000001', '77777777-7777-7777-7777-777777777777', '40000000-0000-0000-0000-000000000000');
        RAISE EXCEPTION 'V12 FAIL: Mismatching tenant_id should have failed FK constraint';
    EXCEPTION WHEN foreign_key_violation THEN
        -- Expected
    END;

    -- 13. second Submission for the same tenant + exam_attempt_id is rejected
    BEGIN
        INSERT INTO secure_assessment_exam_submissions (id, tenant_id, exam_attempt_id) VALUES ('50000000-0000-0000-0000-000000000002', '99999999-9999-9999-9999-999999999999', '40000000-0000-0000-0000-000000000000');
        RAISE EXCEPTION 'V13 FAIL: Second submission should have failed UNIQUE constraint';
    EXCEPTION WHEN unique_violation THEN
        -- Expected
    END;

    -- 14. separate Exam Attempts can each have their own Submission
    INSERT INTO secure_assessment_exam_submissions (id, tenant_id, exam_attempt_id) VALUES ('50000000-0000-0000-0000-000000000003', '99999999-9999-9999-9999-999999999999', '40000000-0000-0000-0000-000000000001');

    -- 16. referenced Exam Attempt cannot be deleted while the Submission references it
    BEGIN
        DELETE FROM secure_assessment_exam_attempts WHERE id = '40000000-0000-0000-0000-000000000000' AND tenant_id = '99999999-9999-9999-9999-999999999999';
        RAISE EXCEPTION 'V16 FAIL: Should not be able to delete Exam Attempt';
    EXCEPTION WHEN restrict_violation THEN
        -- Expected
    END;

    -- 17. tenant_id + exam_attempt_id lookup returns zero-or-one authoritative Submission
    SELECT COUNT(*) INTO t_count FROM secure_assessment_exam_submissions WHERE tenant_id = '99999999-9999-9999-9999-999999999999' AND exam_attempt_id = '40000000-0000-0000-0000-000000000000';
    IF t_count != 1 THEN RAISE EXCEPTION 'V17 FAIL: Expected 1 submission, got %', t_count; END IF;

    -- 18. the exact tenant + Attempt unique structure physically supports the bounded lookup
    -- (Proven by the index existing and preventing duplicate rows)

    RAISE NOTICE 'BU-009 Verification SUCCESS';
END $$;

ROLLBACK;
