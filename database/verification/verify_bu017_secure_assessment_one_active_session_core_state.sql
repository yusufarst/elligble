-- BU-017 Verification: Secure Assessment One-Active-Session Core State Persistence
-- Purpose: Verify schema constraints for governed active Session uniqueness and supersession.

DO $$
DECLARE
    t1 UUID := gen_random_uuid();
    t2 UUID := gen_random_uuid();
    person1 UUID := gen_random_uuid();
    person2 UUID := gen_random_uuid();
    exam_inst1 UUID := gen_random_uuid();
    exam_inst2 UUID := gen_random_uuid();
    part1 UUID := gen_random_uuid();
    part2 UUID := gen_random_uuid();
    attempt_a UUID := gen_random_uuid();
    attempt_b UUID := gen_random_uuid();
    attempt_t2 UUID := gen_random_uuid();

    session_a1 UUID := gen_random_uuid();
    session_a2 UUID := gen_random_uuid();
    session_b1 UUID := gen_random_uuid();
    session_t2_1 UUID := gen_random_uuid();
    
    col_type TEXT;
    is_null TEXT;
BEGIN
    RAISE NOTICE '--- Starting BU-017 Verification ---';

    -- STRUCTURAL ASSERTIONS
    IF NOT EXISTS (SELECT 1 FROM elligble_migration_history WHERE migration_id = '0007_bu017_secure_assessment_one_active_session_core_state') THEN
        RAISE EXCEPTION 'STRUCTURAL FAILED: 0007 migration not in history';
    END IF;

    -- activated_at
    SELECT data_type, is_nullable INTO col_type, is_null FROM information_schema.columns WHERE table_name = 'secure_assessment_exam_sessions' AND column_name = 'activated_at';
    IF col_type != 'timestamp with time zone' OR is_null != 'YES' THEN RAISE EXCEPTION 'STRUCTURAL FAILED: activated_at missing, wrong type or not nullable'; END IF;
    RAISE NOTICE 'COLUMN NULLABILITY: activated_at PASS';

    -- ended_at
    SELECT data_type, is_nullable INTO col_type, is_null FROM information_schema.columns WHERE table_name = 'secure_assessment_exam_sessions' AND column_name = 'ended_at';
    IF col_type != 'timestamp with time zone' OR is_null != 'YES' THEN RAISE EXCEPTION 'STRUCTURAL FAILED: ended_at missing, wrong type or not nullable'; END IF;
    RAISE NOTICE 'COLUMN NULLABILITY: ended_at PASS';

    -- superseded_by_session_id
    SELECT data_type, is_nullable INTO col_type, is_null FROM information_schema.columns WHERE table_name = 'secure_assessment_exam_sessions' AND column_name = 'superseded_by_session_id';
    IF col_type != 'uuid' OR is_null != 'YES' THEN RAISE EXCEPTION 'STRUCTURAL FAILED: superseded_by_session_id missing, wrong type or not nullable'; END IF;
    RAISE NOTICE 'COLUMN NULLABILITY: superseded_by_session_id PASS';

    -- Robust catalog checks
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint c
        JOIN pg_class t ON c.conrelid = t.oid
        WHERE t.relname = 'secure_assessment_exam_sessions' AND c.conname = 'uq_sa_exam_sessions_tenant'
    ) THEN
        RAISE EXCEPTION 'STRUCTURAL FAILED: missing uq_sa_exam_sessions_tenant';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint c
        JOIN pg_class t ON c.conrelid = t.oid
        WHERE t.relname = 'secure_assessment_exam_sessions' AND c.conname = 'fk_sa_session_superseded'
    ) THEN
        RAISE EXCEPTION 'STRUCTURAL FAILED: missing fk_sa_session_superseded';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint c
        JOIN pg_class t ON c.conrelid = t.oid
        WHERE t.relname = 'secure_assessment_exam_sessions' AND c.conname = 'chk_sa_session_no_self_supersede'
    ) THEN
        RAISE EXCEPTION 'STRUCTURAL FAILED: missing chk_sa_session_no_self_supersede';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint c
        JOIN pg_class t ON c.conrelid = t.oid
        WHERE t.relname = 'secure_assessment_exam_sessions' AND c.conname = 'fk_sa_session_attempt'
    ) THEN
        RAISE EXCEPTION 'STRUCTURAL FAILED: missing fk_sa_session_attempt';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes
        WHERE tablename = 'secure_assessment_exam_sessions'
        AND indexname = 'uq_sa_exam_sessions_one_active'
        AND indexdef LIKE '%CREATE UNIQUE INDEX%ON %secure_assessment_exam_sessions%USING btree (tenant_id, exam_attempt_id) WHERE ((activated_at IS NOT NULL) AND (ended_at IS NULL))%'
    ) THEN
        RAISE EXCEPTION 'STRUCTURAL FAILED: missing or incorrect uq_sa_exam_sessions_one_active';
    END IF;

    RAISE NOTICE 'STRUCTURAL VERIFICATION: PASS';

    -- Setup base data (strictly canonical 0001 columns)
    INSERT INTO tenant_tenants (id) VALUES (t1), (t2);
    INSERT INTO identity_persons (id) VALUES (person1), (person2);
    
    INSERT INTO secure_assessment_exam_instances (id, tenant_id) VALUES (exam_inst1, t1), (exam_inst2, t2);
    INSERT INTO secure_assessment_exam_participants (id, tenant_id, exam_instance_id, person_id) VALUES 
        (part1, t1, exam_inst1, person1),
        (part2, t2, exam_inst2, person2);
    INSERT INTO secure_assessment_exam_attempts (id, tenant_id, exam_participant_id) VALUES 
        (attempt_a, t1, part1),
        (attempt_b, t1, part1),
        (attempt_t2, t2, part2);

    -- I. EXISTING SESSION COMPATIBILITY & A. HISTORICAL SESSION PRESERVATION
    INSERT INTO secure_assessment_exam_sessions (id, tenant_id, exam_attempt_id)
    VALUES (session_a1, t1, attempt_a);
    RAISE NOTICE 'A/I. HISTORICAL SESSION PRESERVATION: PASS';
    RAISE NOTICE 'EXISTING SESSION COMPATIBILITY: PASS';

    -- B. FIRST ACTIVE SESSION
    UPDATE secure_assessment_exam_sessions SET activated_at = CURRENT_TIMESTAMP WHERE id = session_a1;
    RAISE NOTICE 'B. FIRST ACTIVE SESSION: PASS';

    -- C. SECOND ACTIVE SESSION SAME ATTEMPT REJECTED
    BEGIN
        INSERT INTO secure_assessment_exam_sessions (id, tenant_id, exam_attempt_id, activated_at)
        VALUES (session_a2, t1, attempt_a, CURRENT_TIMESTAMP);
        RAISE EXCEPTION 'FAILED: Allowed second active session for same attempt';
    EXCEPTION WHEN unique_violation THEN
        RAISE NOTICE 'C. SECOND ACTIVE SAME ATTEMPT REJECTED: PASS';
    END;

    -- D. HISTORICAL SESSION AFTER END
    UPDATE secure_assessment_exam_sessions SET ended_at = CURRENT_TIMESTAMP WHERE id = session_a1;
    INSERT INTO secure_assessment_exam_sessions (id, tenant_id, exam_attempt_id, activated_at)
    VALUES (session_a2, t1, attempt_a, CURRENT_TIMESTAMP);
    RAISE NOTICE 'D. END THEN REPLACEMENT ACTIVE: PASS';

    -- E. SUPERSESSION HISTORY
    UPDATE secure_assessment_exam_sessions SET superseded_by_session_id = session_a2 WHERE id = session_a1;
    IF NOT EXISTS (SELECT 1 FROM secure_assessment_exam_sessions WHERE id = session_a1 AND superseded_by_session_id = session_a2) THEN
        RAISE EXCEPTION 'FAILED: Supersession history not physically present';
    END IF;
    RAISE NOTICE 'E. SUPERSESSION HISTORY: PASS';

    -- F. SELF-SUPERSESSION REJECTED
    BEGIN
        UPDATE secure_assessment_exam_sessions SET superseded_by_session_id = session_a2 WHERE id = session_a2;
        RAISE EXCEPTION 'FAILED: Allowed self-supersession';
    EXCEPTION WHEN check_violation THEN
        RAISE NOTICE 'F. SELF-SUPERSESSION REJECTED: PASS';
    END;

    -- G. DIFFERENT ATTEMPTS ACTIVE
    INSERT INTO secure_assessment_exam_sessions (id, tenant_id, exam_attempt_id, activated_at)
    VALUES (session_b1, t1, attempt_b, CURRENT_TIMESTAMP);
    RAISE NOTICE 'G. DIFFERENT ATTEMPTS ACTIVE: PASS';

    -- H. TENANT BOUNDARY
    INSERT INTO secure_assessment_exam_sessions (id, tenant_id, exam_attempt_id, activated_at)
    VALUES (session_t2_1, t2, attempt_t2, CURRENT_TIMESTAMP);

    BEGIN
        UPDATE secure_assessment_exam_sessions SET superseded_by_session_id = session_t2_1 WHERE id = session_a2;
        RAISE EXCEPTION 'FAILED: Allowed cross-tenant supersession';
    EXCEPTION WHEN foreign_key_violation THEN
        RAISE NOTICE 'H. TENANT BOUNDARY: PASS';
    END;

    RAISE NOTICE '--- Verification Complete ---';
END $$;
