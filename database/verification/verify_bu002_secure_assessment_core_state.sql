-- Verification for Migration 0002: BU-002 Secure Assessment Core State Persistence Bootstrap

BEGIN;

DO $$
DECLARE
    t_count INT;
    col_exists BOOLEAN;
    fk_count INT;
BEGIN
    -- H1. EXACT FOUR-TABLE SET / NO FIFTH SECURE_ASSESSMENT TABLE
    SELECT count(*) INTO t_count
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name LIKE 'secure_assessment_%';

    IF t_count != 4 THEN
        RAISE EXCEPTION 'H1 FAIL: Expected exactly 4 secure_assessment tables, found %', t_count;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'secure_assessment_exam_instances') THEN RAISE EXCEPTION 'H1 FAIL: secure_assessment_exam_instances missing'; END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'secure_assessment_exam_participants') THEN RAISE EXCEPTION 'H1 FAIL: secure_assessment_exam_participants missing'; END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'secure_assessment_exam_attempts') THEN RAISE EXCEPTION 'H1 FAIL: secure_assessment_exam_attempts missing'; END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'secure_assessment_exam_sessions') THEN RAISE EXCEPTION 'H1 FAIL: secure_assessment_exam_sessions missing'; END IF;

    -- V2. TENANT ISOLATION STRUCTURAL ASSURANCE
    SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'secure_assessment_exam_instances' AND column_name = 'tenant_id' AND is_nullable = 'NO') INTO col_exists;
    IF NOT col_exists THEN RAISE EXCEPTION 'V2 FAIL: exam_instances missing tenant_id'; END IF;

    SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'secure_assessment_exam_participants' AND column_name = 'tenant_id' AND is_nullable = 'NO') INTO col_exists;
    IF NOT col_exists THEN RAISE EXCEPTION 'V2 FAIL: exam_participants missing tenant_id'; END IF;

    SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'secure_assessment_exam_attempts' AND column_name = 'tenant_id' AND is_nullable = 'NO') INTO col_exists;
    IF NOT col_exists THEN RAISE EXCEPTION 'V2 FAIL: exam_attempts missing tenant_id'; END IF;

    SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'secure_assessment_exam_sessions' AND column_name = 'tenant_id' AND is_nullable = 'NO') INTO col_exists;
    IF NOT col_exists THEN RAISE EXCEPTION 'V2 FAIL: exam_sessions missing tenant_id'; END IF;

    -- H2. PK (id) ON ALL FOUR TABLES
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.key_column_usage kcu
        JOIN information_schema.table_constraints tc ON kcu.constraint_name = tc.constraint_name
        WHERE tc.table_schema = 'public' AND tc.table_name = 'secure_assessment_exam_instances' AND tc.constraint_type = 'PRIMARY KEY' AND kcu.column_name = 'id'
        AND NOT EXISTS (SELECT 1 FROM information_schema.key_column_usage kcu2 WHERE kcu2.constraint_name = tc.constraint_name AND kcu2.column_name != 'id')
    ) THEN RAISE EXCEPTION 'H2 FAIL: exam_instances PK is not exactly (id)'; END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.key_column_usage kcu
        JOIN information_schema.table_constraints tc ON kcu.constraint_name = tc.constraint_name
        WHERE tc.table_schema = 'public' AND tc.table_name = 'secure_assessment_exam_participants' AND tc.constraint_type = 'PRIMARY KEY' AND kcu.column_name = 'id'
        AND NOT EXISTS (SELECT 1 FROM information_schema.key_column_usage kcu2 WHERE kcu2.constraint_name = tc.constraint_name AND kcu2.column_name != 'id')
    ) THEN RAISE EXCEPTION 'H2 FAIL: exam_participants PK is not exactly (id)'; END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.key_column_usage kcu
        JOIN information_schema.table_constraints tc ON kcu.constraint_name = tc.constraint_name
        WHERE tc.table_schema = 'public' AND tc.table_name = 'secure_assessment_exam_attempts' AND tc.constraint_type = 'PRIMARY KEY' AND kcu.column_name = 'id'
        AND NOT EXISTS (SELECT 1 FROM information_schema.key_column_usage kcu2 WHERE kcu2.constraint_name = tc.constraint_name AND kcu2.column_name != 'id')
    ) THEN RAISE EXCEPTION 'H2 FAIL: exam_attempts PK is not exactly (id)'; END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.key_column_usage kcu
        JOIN information_schema.table_constraints tc ON kcu.constraint_name = tc.constraint_name
        WHERE tc.table_schema = 'public' AND tc.table_name = 'secure_assessment_exam_sessions' AND tc.constraint_type = 'PRIMARY KEY' AND kcu.column_name = 'id'
        AND NOT EXISTS (SELECT 1 FROM information_schema.key_column_usage kcu2 WHERE kcu2.constraint_name = tc.constraint_name AND kcu2.column_name != 'id')
    ) THEN RAISE EXCEPTION 'H2 FAIL: exam_sessions PK is not exactly (id)'; END IF;

    -- H3. EXACT UNIQUE (id, tenant_id) CONSTRAINTS
    SELECT count(*) INTO fk_count FROM pg_constraint c JOIN pg_class t ON c.conrelid = t.oid JOIN pg_attribute a1 ON a1.attrelid = t.oid AND a1.attnum = c.conkey[1] JOIN pg_attribute a2 ON a2.attrelid = t.oid AND a2.attnum = c.conkey[2]
    WHERE t.relname = 'secure_assessment_exam_instances' AND c.contype = 'u' AND c.conname = 'uq_sa_exam_instances_tenant' AND a1.attname = 'id' AND a2.attname = 'tenant_id' AND array_length(c.conkey, 1) = 2;
    IF fk_count != 1 THEN RAISE EXCEPTION 'H3 FAIL: exam_instances UNIQUE (id, tenant_id) missing or incorrect'; END IF;

    SELECT count(*) INTO fk_count FROM pg_constraint c JOIN pg_class t ON c.conrelid = t.oid JOIN pg_attribute a1 ON a1.attrelid = t.oid AND a1.attnum = c.conkey[1] JOIN pg_attribute a2 ON a2.attrelid = t.oid AND a2.attnum = c.conkey[2]
    WHERE t.relname = 'secure_assessment_exam_participants' AND c.contype = 'u' AND c.conname = 'uq_sa_exam_participants_tenant' AND a1.attname = 'id' AND a2.attname = 'tenant_id' AND array_length(c.conkey, 1) = 2;
    IF fk_count != 1 THEN RAISE EXCEPTION 'H3 FAIL: exam_participants UNIQUE (id, tenant_id) missing or incorrect'; END IF;

    SELECT count(*) INTO fk_count FROM pg_constraint c JOIN pg_class t ON c.conrelid = t.oid JOIN pg_attribute a1 ON a1.attrelid = t.oid AND a1.attnum = c.conkey[1] JOIN pg_attribute a2 ON a2.attrelid = t.oid AND a2.attnum = c.conkey[2]
    WHERE t.relname = 'secure_assessment_exam_attempts' AND c.contype = 'u' AND c.conname = 'uq_sa_exam_attempts_tenant' AND a1.attname = 'id' AND a2.attname = 'tenant_id' AND array_length(c.conkey, 1) = 2;
    IF fk_count != 1 THEN RAISE EXCEPTION 'H3 FAIL: exam_attempts UNIQUE (id, tenant_id) missing or incorrect'; END IF;

    -- H4. EXACT COMPOSITE FK MAPPINGS + ON DELETE RESTRICT
    SELECT count(*) INTO fk_count FROM pg_constraint c JOIN pg_class t1 ON t1.oid = c.conrelid JOIN pg_class t2 ON t2.oid = c.confrelid JOIN pg_attribute a1 ON a1.attrelid = t1.oid AND a1.attnum = c.conkey[1] JOIN pg_attribute a2 ON a2.attrelid = t1.oid AND a2.attnum = c.conkey[2] JOIN pg_attribute f1 ON f1.attrelid = t2.oid AND f1.attnum = c.confkey[1] JOIN pg_attribute f2 ON f2.attrelid = t2.oid AND f2.attnum = c.confkey[2]
    WHERE c.conname = 'fk_sa_participant_instance' AND c.contype = 'f' AND c.confdeltype = 'r' AND t1.relname = 'secure_assessment_exam_participants' AND a1.attname = 'exam_instance_id' AND a2.attname = 'tenant_id' AND t2.relname = 'secure_assessment_exam_instances' AND f1.attname = 'id' AND f2.attname = 'tenant_id' AND array_length(c.conkey, 1) = 2;
    IF fk_count != 1 THEN RAISE EXCEPTION 'H4 FAIL: fk_sa_participant_instance exact mapping incorrect'; END IF;

    SELECT count(*) INTO fk_count FROM pg_constraint c JOIN pg_class t1 ON t1.oid = c.conrelid JOIN pg_class t2 ON t2.oid = c.confrelid JOIN pg_attribute a1 ON a1.attrelid = t1.oid AND a1.attnum = c.conkey[1] JOIN pg_attribute a2 ON a2.attrelid = t1.oid AND a2.attnum = c.conkey[2] JOIN pg_attribute f1 ON f1.attrelid = t2.oid AND f1.attnum = c.confkey[1] JOIN pg_attribute f2 ON f2.attrelid = t2.oid AND f2.attnum = c.confkey[2]
    WHERE c.conname = 'fk_sa_attempt_participant' AND c.contype = 'f' AND c.confdeltype = 'r' AND t1.relname = 'secure_assessment_exam_attempts' AND a1.attname = 'exam_participant_id' AND a2.attname = 'tenant_id' AND t2.relname = 'secure_assessment_exam_participants' AND f1.attname = 'id' AND f2.attname = 'tenant_id' AND array_length(c.conkey, 1) = 2;
    IF fk_count != 1 THEN RAISE EXCEPTION 'H4 FAIL: fk_sa_attempt_participant exact mapping incorrect'; END IF;

    SELECT count(*) INTO fk_count FROM pg_constraint c JOIN pg_class t1 ON t1.oid = c.conrelid JOIN pg_class t2 ON t2.oid = c.confrelid JOIN pg_attribute a1 ON a1.attrelid = t1.oid AND a1.attnum = c.conkey[1] JOIN pg_attribute a2 ON a2.attrelid = t1.oid AND a2.attnum = c.conkey[2] JOIN pg_attribute f1 ON f1.attrelid = t2.oid AND f1.attnum = c.confkey[1] JOIN pg_attribute f2 ON f2.attrelid = t2.oid AND f2.attnum = c.confkey[2]
    WHERE c.conname = 'fk_sa_session_attempt' AND c.contype = 'f' AND c.confdeltype = 'r' AND t1.relname = 'secure_assessment_exam_sessions' AND a1.attname = 'exam_attempt_id' AND a2.attname = 'tenant_id' AND t2.relname = 'secure_assessment_exam_attempts' AND f1.attname = 'id' AND f2.attname = 'tenant_id' AND array_length(c.conkey, 1) = 2;
    IF fk_count != 1 THEN RAISE EXCEPTION 'H4 FAIL: fk_sa_session_attempt exact mapping incorrect'; END IF;

    -- H5. NO UNEXPECTED CROSS-DOMAIN FK
    -- Ensure exactly 3 foreign keys exist in total across all 4 secure_assessment tables
    SELECT count(*) INTO fk_count FROM pg_constraint c JOIN pg_class t ON c.conrelid = t.oid WHERE c.contype = 'f' AND t.relname LIKE 'secure_assessment_%';
    IF fk_count != 3 THEN RAISE EXCEPTION 'H5 FAIL: Found % foreign keys in secure_assessment instead of exactly 3 (unexpected cross-domain FK exists)', fk_count; END IF;

    -- H6. ALL REQUIRED OUT-OF-SCOPE PERSISTENCE CATEGORIES REJECTED
    IF EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name LIKE 'secure_assessment_%' AND
        (table_name LIKE '%answer%' OR table_name LIKE '%snapshot%' OR table_name LIKE '%assessment_type%' OR
         table_name LIKE '%room%' OR table_name LIKE '%violation%' OR table_name LIKE '%risk%' OR
         table_name LIKE '%incident%' OR table_name LIKE '%cheating%' OR table_name LIKE '%score%' OR
         table_name LIKE '%scoring%' OR table_name LIKE '%submission%' OR table_name LIKE '%receipt%' OR
         table_name LIKE '%timer%' OR table_name LIKE '%response%' OR table_name LIKE '%acknowledg%')
    ) THEN
         RAISE EXCEPTION 'H6 FAIL: Out-of-scope persistence category found';
    END IF;

    -- V6. MIGRATION HISTORY
    SELECT COUNT(*) INTO t_count FROM elligble_migration_history WHERE migration_id = '0002_bu002_secure_assessment_core_state';
    IF t_count != 1 THEN RAISE EXCEPTION 'V6 FAIL: Migration history count for BU-002 is % (expected 1)', t_count; END IF;

    -- H7. MINIMUM BU-001 FOUNDATION REGRESSION
    -- Check elligble_migration_history table and migration_id column structure
    SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'elligble_migration_history' AND column_name = 'migration_id' AND data_type = 'character varying' AND character_maximum_length = 255 AND is_nullable = 'NO') INTO col_exists;
    IF NOT col_exists THEN RAISE EXCEPTION 'H7 FAIL: elligble_migration_history.migration_id column structure incorrect or missing'; END IF;

    -- Assert BU-001 migration_id is exactly once
    SELECT COUNT(*) INTO t_count FROM elligble_migration_history WHERE migration_id = '0001_bu001_identity_tenant_foundation';
    IF t_count != 1 THEN RAISE EXCEPTION 'H7 FAIL: BU-001 migration history record count is % (expected 1)', t_count; END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'identity_persons') THEN RAISE EXCEPTION 'H7 FAIL: BU-001 identity_persons missing'; END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'identity_user_accounts') THEN RAISE EXCEPTION 'H7 FAIL: BU-001 identity_user_accounts missing'; END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'tenant_tenants') THEN RAISE EXCEPTION 'H7 FAIL: BU-001 tenant_tenants missing'; END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'tenant_memberships') THEN RAISE EXCEPTION 'H7 FAIL: BU-001 tenant_memberships missing'; END IF;

    -- H8 (V7). RUNTIME TENANT ISOLATION TESTS
    -- Instance
    INSERT INTO secure_assessment_exam_instances (id, tenant_id) VALUES ('10000000-0000-0000-0000-000000000000', '99999999-9999-9999-9999-999999999999');

    -- Participant (MATCHING TENANT -> SUCCESS)
    INSERT INTO secure_assessment_exam_participants (id, tenant_id, exam_instance_id, person_id)
    VALUES ('20000000-0000-0000-0000-000000000000', '99999999-9999-9999-9999-999999999999', '10000000-0000-0000-0000-000000000000', '88888888-8888-8888-8888-888888888888');

    -- Participant (MISMATCHING TENANT -> MUST FAIL)
    BEGIN
        INSERT INTO secure_assessment_exam_participants (id, tenant_id, exam_instance_id, person_id)
        VALUES ('30000000-0000-0000-0000-000000000000', '77777777-7777-7777-7777-777777777777', '10000000-0000-0000-0000-000000000000', '88888888-8888-8888-8888-888888888888');
        RAISE EXCEPTION 'H8 FAIL: Participant with mismatching tenant_id should have failed';
    EXCEPTION WHEN foreign_key_violation THEN
        -- Expected
    END;

    -- Attempt (MATCHING TENANT -> SUCCESS)
    INSERT INTO secure_assessment_exam_attempts (id, tenant_id, exam_participant_id)
    VALUES ('40000000-0000-0000-0000-000000000000', '99999999-9999-9999-9999-999999999999', '20000000-0000-0000-0000-000000000000');

    -- Attempt (MISMATCHING TENANT -> MUST FAIL)
    BEGIN
        INSERT INTO secure_assessment_exam_attempts (id, tenant_id, exam_participant_id)
        VALUES ('50000000-0000-0000-0000-000000000000', '77777777-7777-7777-7777-777777777777', '20000000-0000-0000-0000-000000000000');
        RAISE EXCEPTION 'H8 FAIL: Attempt with mismatching tenant_id should have failed';
    EXCEPTION WHEN foreign_key_violation THEN
        -- Expected
    END;

    -- Session (MATCHING TENANT -> SUCCESS)
    INSERT INTO secure_assessment_exam_sessions (id, tenant_id, exam_attempt_id)
    VALUES ('60000000-0000-0000-0000-000000000000', '99999999-9999-9999-9999-999999999999', '40000000-0000-0000-0000-000000000000');

    -- Session (MISMATCHING TENANT -> MUST FAIL)
    BEGIN
        INSERT INTO secure_assessment_exam_sessions (id, tenant_id, exam_attempt_id)
        VALUES ('70000000-0000-0000-0000-000000000000', '77777777-7777-7777-7777-777777777777', '40000000-0000-0000-0000-000000000000');
        RAISE EXCEPTION 'H8 FAIL: Session with mismatching tenant_id should have failed';
    EXCEPTION WHEN foreign_key_violation THEN
        -- Expected
    END;

    RAISE NOTICE 'BU-002 Verification SUCCESS';
END $$;

-- V8. TEST DATA ROLLBACK
ROLLBACK;
