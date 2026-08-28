-- BU-017 Verification: Secure Assessment One-Active-Session Core State Persistence
-- Purpose: Verify schema constraints for governed active Session uniqueness and supersession.

\set ON_ERROR_STOP on

-- Apply migrations
\ir ../migrations/0001_initial_schema.sql
\ir ../migrations/0002_bu002_secure_assessment_core_state.sql
\ir ../migrations/0003_bu003_secure_assessment_question_core_state.sql
\ir ../migrations/0004_bu004_secure_assessment_answer_core_state.sql
\ir ../migrations/0005_bu006_secure_assessment_submission_core_state.sql
\ir ../migrations/0006_bu012_secure_assessment_exam_time_lock_core_state.sql
\ir ../migrations/0007_bu017_secure_assessment_one_active_session_core_state.sql

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
    session_a3 UUID := gen_random_uuid();
    session_b1 UUID := gen_random_uuid();
    session_b2 UUID := gen_random_uuid();
    session_t2_1 UUID := gen_random_uuid();

    error_msg TEXT;
BEGIN
    RAISE NOTICE '--- Starting BU-017 Verification ---';

    -- Setup base data
    INSERT INTO tenant_tenants (id, name, slug, domain) VALUES (t1, 'Tenant 1', 't1', 't1.local'), (t2, 'Tenant 2', 't2', 't2.local');
    INSERT INTO identity_persons (id, tenant_id, auth_provider_id, email, full_name) VALUES
        (person1, t1, 'auth1', 'p1@t1.local', 'P1'),
        (person2, t2, 'auth2', 'p2@t2.local', 'P2');

    INSERT INTO secure_assessment_exam_instances (id, tenant_id) VALUES (exam_inst1, t1), (exam_inst2, t2);
    INSERT INTO secure_assessment_exam_participants (id, tenant_id, exam_instance_id, person_id) VALUES
        (part1, t1, exam_inst1, person1),
        (part2, t2, exam_inst2, person2);
    INSERT INTO secure_assessment_exam_attempts (id, tenant_id, exam_participant_id) VALUES
        (attempt_a, t1, part1),
        (attempt_b, t1, part1),
        (attempt_t2, t2, part2);

    -- I. EXISTING SESSION COMPATIBILITY & A. HISTORICAL SESSION PRESERVATION
    -- Creating a session without activated_at (simulating pre-BU-017 or a historical row without active state)
    INSERT INTO secure_assessment_exam_sessions (id, tenant_id, exam_attempt_id)
    VALUES (session_a1, t1, attempt_a);
    RAISE NOTICE 'A/I. Historical Session Preservation / Existing Compatibility: PASS';

    -- B. FIRST ACTIVE SESSION
    UPDATE secure_assessment_exam_sessions SET activated_at = CURRENT_TIMESTAMP WHERE id = session_a1;
    RAISE NOTICE 'B. First Active Session: PASS';

    -- C. SECOND ACTIVE SESSION SAME ATTEMPT REJECTED
    BEGIN
        INSERT INTO secure_assessment_exam_sessions (id, tenant_id, exam_attempt_id, activated_at)
        VALUES (session_a2, t1, attempt_a, CURRENT_TIMESTAMP);
        RAISE EXCEPTION 'FAILED: Allowed second active session for same attempt';
    EXCEPTION WHEN unique_violation THEN
        RAISE NOTICE 'C. Second Active Session Same Attempt Rejected: PASS';
    END;

    -- D. HISTORICAL SESSION AFTER END
    UPDATE secure_assessment_exam_sessions SET ended_at = CURRENT_TIMESTAMP WHERE id = session_a1;
    -- Now A2 can become active
    INSERT INTO secure_assessment_exam_sessions (id, tenant_id, exam_attempt_id, activated_at)
    VALUES (session_a2, t1, attempt_a, CURRENT_TIMESTAMP);
    RAISE NOTICE 'D. Historical Session After End: PASS';

    -- E. SUPERSESSION HISTORY
    UPDATE secure_assessment_exam_sessions SET superseded_by_session_id = session_a2 WHERE id = session_a1;
    -- Check it physically exists
    IF NOT EXISTS (SELECT 1 FROM secure_assessment_exam_sessions WHERE id = session_a1 AND superseded_by_session_id = session_a2) THEN
        RAISE EXCEPTION 'FAILED: Supersession history not physically present';
    END IF;
    RAISE NOTICE 'E. Supersession History: PASS';

    -- F. SELF-SUPERSESSION REJECTED
    BEGIN
        UPDATE secure_assessment_exam_sessions SET superseded_by_session_id = session_a2 WHERE id = session_a2;
        RAISE EXCEPTION 'FAILED: Allowed self-supersession';
    EXCEPTION WHEN check_violation THEN
        RAISE NOTICE 'F. Self-Supersession Rejected: PASS';
    END;

    -- G. DIFFERENT ATTEMPTS ACTIVE
    -- Attempt A has session_a2 active. Attempt B can have session_b1 active.
    INSERT INTO secure_assessment_exam_sessions (id, tenant_id, exam_attempt_id, activated_at)
    VALUES (session_b1, t1, attempt_b, CURRENT_TIMESTAMP);
    RAISE NOTICE 'G. Different Attempts Active: PASS';

    -- H. TENANT BOUNDARY
    INSERT INTO secure_assessment_exam_sessions (id, tenant_id, exam_attempt_id, activated_at)
    VALUES (session_t2_1, t2, attempt_t2, CURRENT_TIMESTAMP);

    BEGIN
        -- Try to supersede a session across tenants
        UPDATE secure_assessment_exam_sessions SET superseded_by_session_id = session_t2_1 WHERE id = session_a2;
        RAISE EXCEPTION 'FAILED: Allowed cross-tenant supersession';
    EXCEPTION WHEN foreign_key_violation THEN
        RAISE NOTICE 'H. Tenant Boundary: PASS';
    END;

    RAISE NOTICE '--- Verification Complete ---';
END $$;
