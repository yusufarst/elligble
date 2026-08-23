-- Verification Script for BU-007 Secure Assessment Server-Authoritative Timer Core State
-- Requires disposable PostgreSQL environment with migrations 0001 -> 0002 -> 0003 -> 0004 -> 0005 applied.

BEGIN;

DO $$
DECLARE
    -- Deterministic Tenants
    v_tenant_id UUID := md5('tenant_a')::uuid;
    v_other_tenant_id UUID := md5('tenant_b')::uuid;

    -- Person (Identity-owned)
    v_person_id UUID := md5('person_1')::uuid;

    -- Tenant A Hierarchy
    v_instance_a1 UUID := md5('instance_a1')::uuid;
    v_participant_a1 UUID := md5('participant_a1')::uuid;
    v_attempt_a1 UUID := md5('attempt_a1')::uuid;
    v_timer_a1 UUID := md5('timer_a1')::uuid;
    
    v_instance_a2 UUID := md5('instance_a2')::uuid;
    v_participant_a2 UUID := md5('participant_a2')::uuid;
    v_attempt_a2 UUID := md5('attempt_a2')::uuid;

    -- Tenant B Hierarchy
    v_instance_b1 UUID := md5('instance_b1')::uuid;
    v_participant_b1 UUID := md5('participant_b1')::uuid;
    v_attempt_b1 UUID := md5('attempt_b1')::uuid;
    v_timer_b1 UUID := md5('timer_b1')::uuid;

    v_perf_count INT;
    v_migration_count INT;
BEGIN
    RAISE NOTICE '--- BU-007 TERMINAL VERIFICATION STARTED ---';

    -- 1. both exact table names exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'secure_assessment_timer_state' AND table_type = 'BASE TABLE') THEN
        RAISE EXCEPTION 'V1 FAILED: secure_assessment_timer_state BASE TABLE missing.';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'secure_assessment_timer_adjustments' AND table_type = 'BASE TABLE') THEN
        RAISE EXCEPTION 'V1 FAILED: secure_assessment_timer_adjustments BASE TABLE missing.';
    END IF;

    -- 2. exact columns exist; 3. exact data types; 4. exact nullability; 5. exact defaults;
    -- Timer State
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'secure_assessment_timer_state' AND column_name = 'id' AND is_nullable = 'NO' AND data_type = 'uuid') THEN RAISE EXCEPTION 'V2 FAILED: id column.'; END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'secure_assessment_timer_state' AND column_name = 'tenant_id' AND is_nullable = 'NO' AND data_type = 'uuid') THEN RAISE EXCEPTION 'V2 FAILED: tenant_id column.'; END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'secure_assessment_timer_state' AND column_name = 'exam_attempt_id' AND is_nullable = 'NO' AND data_type = 'uuid') THEN RAISE EXCEPTION 'V2 FAILED: exam_attempt_id column.'; END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'secure_assessment_timer_state' AND column_name = 'configured_duration_seconds' AND is_nullable = 'NO' AND data_type = 'integer') THEN RAISE EXCEPTION 'V2 FAILED: configured_duration_seconds column.'; END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'secure_assessment_timer_state' AND column_name = 'started_at' AND is_nullable = 'YES' AND data_type = 'timestamp with time zone') THEN RAISE EXCEPTION 'V2 FAILED: started_at column.'; END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'secure_assessment_timer_state' AND column_name = 'created_at' AND is_nullable = 'NO' AND data_type = 'timestamp with time zone') THEN RAISE EXCEPTION 'V2 FAILED: created_at column.'; END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'secure_assessment_timer_state' AND column_name = 'updated_at' AND is_nullable = 'NO' AND data_type = 'timestamp with time zone') THEN RAISE EXCEPTION 'V2 FAILED: updated_at column.'; END IF;
    
    IF (SELECT COUNT(*) FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'secure_assessment_timer_state') != 7 THEN
        RAISE EXCEPTION 'V2 FAILED: Unexpected number of columns in secure_assessment_timer_state.';
    END IF;

    -- Adjustments
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'secure_assessment_timer_adjustments' AND column_name = 'id' AND is_nullable = 'NO' AND data_type = 'uuid') THEN RAISE EXCEPTION 'V2 FAILED: id column in adjustments.'; END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'secure_assessment_timer_adjustments' AND column_name = 'tenant_id' AND is_nullable = 'NO' AND data_type = 'uuid') THEN RAISE EXCEPTION 'V2 FAILED: tenant_id column in adjustments.'; END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'secure_assessment_timer_adjustments' AND column_name = 'timer_state_id' AND is_nullable = 'NO' AND data_type = 'uuid') THEN RAISE EXCEPTION 'V2 FAILED: timer_state_id column in adjustments.'; END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'secure_assessment_timer_adjustments' AND column_name = 'adjustment_seconds' AND is_nullable = 'NO' AND data_type = 'integer') THEN RAISE EXCEPTION 'V2 FAILED: adjustment_seconds column.'; END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'secure_assessment_timer_adjustments' AND column_name = 'reason' AND is_nullable = 'NO' AND data_type = 'character varying' AND character_maximum_length = 500) THEN RAISE EXCEPTION 'V2 FAILED: reason column.'; END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'secure_assessment_timer_adjustments' AND column_name = 'created_at' AND is_nullable = 'NO' AND data_type = 'timestamp with time zone') THEN RAISE EXCEPTION 'V2 FAILED: created_at column in adjustments.'; END IF;
    
    IF (SELECT COUNT(*) FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'secure_assessment_timer_adjustments') != 6 THEN
        RAISE EXCEPTION 'V2 FAILED: Unexpected number of columns in secure_assessment_timer_adjustments.';
    END IF;

    -- EXACT DEFAULTS
    -- Timer State
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'secure_assessment_timer_state' AND column_name = 'id' AND column_default = 'gen_random_uuid()') THEN RAISE EXCEPTION 'V_DEFAULT FAILED: id default incorrect.'; END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'secure_assessment_timer_state' AND column_name = 'tenant_id' AND column_default IS NULL) THEN RAISE EXCEPTION 'V_DEFAULT FAILED: tenant_id default incorrect.'; END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'secure_assessment_timer_state' AND column_name = 'exam_attempt_id' AND column_default IS NULL) THEN RAISE EXCEPTION 'V_DEFAULT FAILED: exam_attempt_id default incorrect.'; END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'secure_assessment_timer_state' AND column_name = 'configured_duration_seconds' AND column_default IS NULL) THEN RAISE EXCEPTION 'V_DEFAULT FAILED: configured_duration_seconds default incorrect.'; END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'secure_assessment_timer_state' AND column_name = 'started_at' AND column_default IS NULL) THEN RAISE EXCEPTION 'V_DEFAULT FAILED: started_at default incorrect.'; END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'secure_assessment_timer_state' AND column_name = 'created_at' AND column_default IN ('CURRENT_TIMESTAMP', 'now()')) THEN RAISE EXCEPTION 'V_DEFAULT FAILED: created_at default incorrect.'; END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'secure_assessment_timer_state' AND column_name = 'updated_at' AND column_default IN ('CURRENT_TIMESTAMP', 'now()')) THEN RAISE EXCEPTION 'V_DEFAULT FAILED: updated_at default incorrect.'; END IF;
    
    -- Adjustments
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'secure_assessment_timer_adjustments' AND column_name = 'id' AND column_default = 'gen_random_uuid()') THEN RAISE EXCEPTION 'V_DEFAULT FAILED: id default incorrect in adjustments.'; END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'secure_assessment_timer_adjustments' AND column_name = 'tenant_id' AND column_default IS NULL) THEN RAISE EXCEPTION 'V_DEFAULT FAILED: tenant_id default incorrect in adjustments.'; END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'secure_assessment_timer_adjustments' AND column_name = 'timer_state_id' AND column_default IS NULL) THEN RAISE EXCEPTION 'V_DEFAULT FAILED: timer_state_id default incorrect in adjustments.'; END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'secure_assessment_timer_adjustments' AND column_name = 'adjustment_seconds' AND column_default IS NULL) THEN RAISE EXCEPTION 'V_DEFAULT FAILED: adjustment_seconds default incorrect in adjustments.'; END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'secure_assessment_timer_adjustments' AND column_name = 'reason' AND column_default IS NULL) THEN RAISE EXCEPTION 'V_DEFAULT FAILED: reason default incorrect in adjustments.'; END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'secure_assessment_timer_adjustments' AND column_name = 'created_at' AND column_default IN ('CURRENT_TIMESTAMP', 'now()')) THEN RAISE EXCEPTION 'V_DEFAULT FAILED: created_at default incorrect in adjustments.'; END IF;

    -- 6. primary keys
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint c
        JOIN pg_class t ON c.conrelid = t.oid
        JOIN pg_namespace n ON t.relnamespace = n.oid
        WHERE n.nspname = 'public' AND t.relname = 'secure_assessment_timer_state'
          AND c.contype = 'p'
          AND pg_get_constraintdef(c.oid) LIKE '%PRIMARY KEY (id)%'
    ) THEN RAISE EXCEPTION 'V6 FAILED: PK for timer_state incorrect.'; END IF;
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint c
        JOIN pg_class t ON c.conrelid = t.oid
        JOIN pg_namespace n ON t.relnamespace = n.oid
        WHERE n.nspname = 'public' AND t.relname = 'secure_assessment_timer_adjustments'
          AND c.contype = 'p'
          AND pg_get_constraintdef(c.oid) LIKE '%PRIMARY KEY (id)%'
    ) THEN RAISE EXCEPTION 'V6 FAILED: PK for adjustments incorrect.'; END IF;

    -- 7. uq_sa_timer_state_attempt exact column order: tenant_id, exam_attempt_id;
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint c
        JOIN pg_class t ON c.conrelid = t.oid
        JOIN pg_namespace n ON t.relnamespace = n.oid
        WHERE n.nspname = 'public' AND t.relname = 'secure_assessment_timer_state'
          AND c.contype = 'u' AND c.conname = 'uq_sa_timer_state_attempt'
          AND pg_get_constraintdef(c.oid) LIKE '%UNIQUE (tenant_id, exam_attempt_id)%'
    ) THEN RAISE EXCEPTION 'V7 FAILED: uq_sa_timer_state_attempt exact UNIQUE constraint missing.'; END IF;

    -- 8. uq_sa_timer_state_tenant exact column order: id, tenant_id;
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint c
        JOIN pg_class t ON c.conrelid = t.oid
        JOIN pg_namespace n ON t.relnamespace = n.oid
        WHERE n.nspname = 'public' AND t.relname = 'secure_assessment_timer_state'
          AND c.contype = 'u' AND c.conname = 'uq_sa_timer_state_tenant'
          AND pg_get_constraintdef(c.oid) LIKE '%UNIQUE (id, tenant_id)%'
    ) THEN RAISE EXCEPTION 'V8 FAILED: uq_sa_timer_state_tenant exact UNIQUE constraint missing.'; END IF;

    -- 9. fk_sa_timer_attempt exact mapping + 10. ON DELETE RESTRICT
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint c
        JOIN pg_class t ON c.conrelid = t.oid
        JOIN pg_namespace n ON t.relnamespace = n.oid
        WHERE n.nspname = 'public' AND t.relname = 'secure_assessment_timer_state'
          AND c.contype = 'f' AND c.conname = 'fk_sa_timer_attempt'
          AND pg_get_constraintdef(c.oid) LIKE '%FOREIGN KEY (exam_attempt_id, tenant_id) REFERENCES %secure_assessment_exam_attempts%(id, tenant_id)%RESTRICT%'
    ) THEN RAISE EXCEPTION 'V9/10 FAILED: Attempt composite FK missing or incorrect.'; END IF;

    -- 11. fk_sa_timer_adj_timer exact mapping + 12. ON DELETE RESTRICT
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint c
        JOIN pg_class t ON c.conrelid = t.oid
        JOIN pg_namespace n ON t.relnamespace = n.oid
        WHERE n.nspname = 'public' AND t.relname = 'secure_assessment_timer_adjustments'
          AND c.contype = 'f' AND c.conname = 'fk_sa_timer_adj_timer'
          AND pg_get_constraintdef(c.oid) LIKE '%FOREIGN KEY (timer_state_id, tenant_id) REFERENCES %secure_assessment_timer_state%(id, tenant_id)%RESTRICT%'
    ) THEN RAISE EXCEPTION 'V11/12 FAILED: Timer composite FK missing or incorrect.'; END IF;

    -- 13. chk_sa_timer_duration_positive
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint c
        JOIN pg_class t ON c.conrelid = t.oid
        JOIN pg_namespace n ON t.relnamespace = n.oid
        WHERE n.nspname = 'public' AND t.relname = 'secure_assessment_timer_state'
          AND c.contype = 'c' AND c.conname = 'chk_sa_timer_duration_positive'
          AND pg_get_constraintdef(c.oid) LIKE '%CHECK ((configured_duration_seconds > 0))%'
    ) THEN RAISE EXCEPTION 'V13 FAILED: chk_sa_timer_duration_positive missing.'; END IF;

    -- 14. chk_sa_timer_adj_seconds_nonzero
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint c
        JOIN pg_class t ON c.conrelid = t.oid
        JOIN pg_namespace n ON t.relnamespace = n.oid
        WHERE n.nspname = 'public' AND t.relname = 'secure_assessment_timer_adjustments'
          AND c.contype = 'c' AND c.conname = 'chk_sa_timer_adj_seconds_nonzero'
          AND pg_get_constraintdef(c.oid) LIKE '%CHECK ((adjustment_seconds <> 0))%'
    ) THEN RAISE EXCEPTION 'V14 FAILED: chk_sa_timer_adj_seconds_nonzero missing.'; END IF;

    -- 15. chk_sa_timer_adj_reason_nonempty
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint c
        JOIN pg_class t
          ON c.conrelid = t.oid
        JOIN pg_namespace n
          ON t.relnamespace = n.oid
        WHERE n.nspname = 'public'
          AND t.relname = 'secure_assessment_timer_adjustments'
          AND c.contype = 'c'
          AND c.conname = 'chk_sa_timer_adj_reason_nonempty'
    ) THEN
        RAISE EXCEPTION
          'V15 FAILED: chk_sa_timer_adj_reason_nonempty missing.';
    END IF;

    -- 16. idx_sa_timer_adj_timer_tenant exact key order: tenant_id, timer_state_id;
    IF NOT EXISTS (
        SELECT 1 FROM pg_index i
        JOIN pg_class c ON i.indexrelid = c.oid
        JOIN pg_class t ON i.indrelid = t.oid
        JOIN pg_namespace n ON t.relnamespace = n.oid
        WHERE n.nspname = 'public' AND t.relname = 'secure_assessment_timer_adjustments' AND c.relname = 'idx_sa_timer_adj_timer_tenant'
          AND pg_get_indexdef(i.indexrelid) LIKE '%USING btree (tenant_id, timer_state_id)'
    ) THEN RAISE EXCEPTION 'V16 FAILED: idx_sa_timer_adj_timer_tenant missing.'; END IF;

    -- 17. migration-history entry for 0005
    SELECT COUNT(*) INTO v_migration_count FROM public.elligble_migration_history WHERE migration_id = '0005_bu007_secure_assessment_timer_core_state';
    IF v_migration_count != 1 THEN RAISE EXCEPTION 'V17 FAILED: 0005 migration count % != 1', v_migration_count; END IF;

    -- 18. no Exam Session FK exists
    IF EXISTS (
        SELECT 1 FROM pg_constraint c
        JOIN pg_class t1 ON c.conrelid = t1.oid
        JOIN pg_class t2 ON c.confrelid = t2.oid
        JOIN pg_namespace n ON t1.relnamespace = n.oid
        WHERE n.nspname = 'public' AND t1.relname = 'secure_assessment_timer_state' AND t2.relname = 'secure_assessment_exam_sessions' AND c.contype = 'f'
    ) THEN RAISE EXCEPTION 'V18 FAILED: FK to secure_assessment_exam_sessions found in timer state.'; END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'secure_assessment_timer_state' AND column_name = 'exam_session_id') THEN RAISE EXCEPTION 'V18 FAILED: exam_session_id column found.'; END IF;

    -- 19. no remaining_time persistence column exists
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'secure_assessment_timer_state' AND column_name = 'remaining_time') THEN RAISE EXCEPTION 'V19 FAILED: remaining_time column found.'; END IF;

    -- 20. no pause/grace/submission persistence introduced
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'secure_assessment_timer_state' AND column_name IN ('is_paused', 'grace_period', 'submitted_at')) THEN RAISE EXCEPTION 'V20 FAILED: pause/grace/submission column found.'; END IF;


    -- Setup Fixtures
    -- BU-001 Foundation
    INSERT INTO identity_persons (id) VALUES (v_person_id);
    INSERT INTO tenant_tenants (id) VALUES (v_tenant_id), (v_other_tenant_id);

    -- TENANT A Hierarchy
    INSERT INTO secure_assessment_exam_instances (id, tenant_id) VALUES (v_instance_a1, v_tenant_id), (v_instance_a2, v_tenant_id);
    INSERT INTO secure_assessment_exam_participants (id, tenant_id, exam_instance_id, person_id) VALUES (v_participant_a1, v_tenant_id, v_instance_a1, v_person_id), (v_participant_a2, v_tenant_id, v_instance_a2, v_person_id);
    INSERT INTO secure_assessment_exam_attempts (id, tenant_id, exam_participant_id) VALUES (v_attempt_a1, v_tenant_id, v_participant_a1), (v_attempt_a2, v_tenant_id, v_participant_a2);

    -- TENANT B Hierarchy
    INSERT INTO secure_assessment_exam_instances (id, tenant_id) VALUES (v_instance_b1, v_other_tenant_id);
    INSERT INTO secure_assessment_exam_participants (id, tenant_id, exam_instance_id, person_id) VALUES (v_participant_b1, v_other_tenant_id, v_instance_b1, v_person_id);
    INSERT INTO secure_assessment_exam_attempts (id, tenant_id, exam_participant_id) VALUES (v_attempt_b1, v_other_tenant_id, v_participant_b1);

    -- Behavioral verification must prove:
    -- 21. valid same-tenant Attempt -> Timer insert succeeds;
    INSERT INTO secure_assessment_timer_state (id, tenant_id, exam_attempt_id, configured_duration_seconds)
    VALUES (v_timer_a1, v_tenant_id, v_attempt_a1, 3600);

    -- 22. second Timer for same tenant+Attempt is rejected;
    BEGIN
        INSERT INTO secure_assessment_timer_state (tenant_id, exam_attempt_id, configured_duration_seconds)
        VALUES (v_tenant_id, v_attempt_a1, 1800);
        RAISE EXCEPTION 'V22 FAILED: Duplicate timer allowed.';
    EXCEPTION WHEN unique_violation THEN
        -- Expected
    END;

    -- 23. cross-tenant Attempt -> Timer relationship mismatch is rejected;
    BEGIN
        INSERT INTO secure_assessment_timer_state (tenant_id, exam_attempt_id, configured_duration_seconds)
        VALUES (v_tenant_id, v_attempt_b1, 3600);
        RAISE EXCEPTION 'V23 FAILED: Cross-tenant attempt allowed.';
    EXCEPTION WHEN foreign_key_violation THEN
        -- Expected
    END;

    -- 24. duration 0 is rejected;
    BEGIN
        INSERT INTO secure_assessment_timer_state (tenant_id, exam_attempt_id, configured_duration_seconds)
        VALUES (v_tenant_id, v_attempt_a2, 0);
        RAISE EXCEPTION 'V24 FAILED: Duration 0 allowed.';
    EXCEPTION WHEN check_violation THEN
        -- Expected
    END;

    -- 25. negative duration is rejected;
    BEGIN
        INSERT INTO secure_assessment_timer_state (tenant_id, exam_attempt_id, configured_duration_seconds)
        VALUES (v_tenant_id, v_attempt_a2, -100);
        RAISE EXCEPTION 'V25 FAILED: Negative duration allowed.';
    EXCEPTION WHEN check_violation THEN
        -- Expected
    END;

    -- 26. valid adjustment succeeds;
    INSERT INTO secure_assessment_timer_adjustments (tenant_id, timer_state_id, adjustment_seconds, reason)
    VALUES (v_tenant_id, v_timer_a1, 300, 'Additional time');

    -- 27. cross-tenant Timer -> Adjustment relationship mismatch is rejected;
    INSERT INTO secure_assessment_timer_state (id, tenant_id, exam_attempt_id, configured_duration_seconds)
    VALUES (v_timer_b1, v_other_tenant_id, v_attempt_b1, 3600);
    BEGIN
        INSERT INTO secure_assessment_timer_adjustments (tenant_id, timer_state_id, adjustment_seconds, reason)
        VALUES (v_tenant_id, v_timer_b1, 300, 'Cross tenant');
        RAISE EXCEPTION 'V27 FAILED: Cross-tenant adjustment allowed.';
    EXCEPTION WHEN foreign_key_violation THEN
        -- Expected
    END;

    -- 28. adjustment_seconds = 0 is rejected;
    BEGIN
        INSERT INTO secure_assessment_timer_adjustments (tenant_id, timer_state_id, adjustment_seconds, reason)
        VALUES (v_tenant_id, v_timer_a1, 0, 'Zero');
        RAISE EXCEPTION 'V28 FAILED: Zero adjustment allowed.';
    EXCEPTION WHEN check_violation THEN
        -- Expected
    END;

    -- 29. empty reason is rejected;
    BEGIN
        INSERT INTO secure_assessment_timer_adjustments (tenant_id, timer_state_id, adjustment_seconds, reason)
        VALUES (v_tenant_id, v_timer_a1, 60, '');
        RAISE EXCEPTION 'V29 FAILED: Empty reason allowed.';
    EXCEPTION WHEN check_violation THEN
        -- Expected
    END;

    -- 30. whitespace-only reason is rejected;
    BEGIN
        INSERT INTO secure_assessment_timer_adjustments (tenant_id, timer_state_id, adjustment_seconds, reason)
        VALUES (v_tenant_id, v_timer_a1, 60, '   ');
        RAISE EXCEPTION 'V30 FAILED: Whitespace reason allowed.';
    EXCEPTION WHEN check_violation THEN
        -- Expected
    END;

    -- 31. deleting an Attempt referenced by timer state is restricted;
    BEGIN
        DELETE FROM secure_assessment_exam_attempts WHERE id = v_attempt_a1;
        RAISE EXCEPTION 'V31 FAILED: Deleting attempt allowed.';
    EXCEPTION WHEN restrict_violation THEN
        -- Expected
    END;

    -- 32. deleting timer state referenced by adjustment is restricted.
    BEGIN
        DELETE FROM secure_assessment_timer_state WHERE id = v_timer_a1;
        RAISE EXCEPTION 'V32 FAILED: Deleting timer allowed.';
    EXCEPTION WHEN restrict_violation THEN
        -- Expected
    END;


    -- PERFORMANCE VERIFICATION
    RAISE NOTICE 'Generating deterministic performance fixtures (~100,000 adjustments)...';

    -- 100 Tenants
    INSERT INTO tenant_tenants (id)
    SELECT md5('perf_tenant_' || i)::uuid FROM generate_series(101, 200) i;

    -- 20 Instances per tenant = 2000 Instances
    INSERT INTO secure_assessment_exam_instances (id, tenant_id)
    SELECT md5('perf_instance_' || t || '_' || i)::uuid, md5('perf_tenant_' || t)::uuid
    FROM generate_series(101, 200) t
    CROSS JOIN generate_series(1, 20) i;

    -- 50 Participants/Attempts per tenant (2.5 per instance) = 5000 Attempts
    INSERT INTO secure_assessment_exam_participants (id, tenant_id, exam_instance_id, person_id)
    SELECT md5('perf_participant_' || t || '_' || i)::uuid, md5('perf_tenant_' || t)::uuid, md5('perf_instance_' || t || '_' || ((i % 20) + 1))::uuid, v_person_id
    FROM generate_series(101, 200) t
    CROSS JOIN generate_series(1, 50) i;

    INSERT INTO secure_assessment_exam_attempts (id, tenant_id, exam_participant_id)
    SELECT md5('perf_attempt_' || t || '_' || i)::uuid, md5('perf_tenant_' || t)::uuid, md5('perf_participant_' || t || '_' || i)::uuid
    FROM generate_series(101, 200) t
    CROSS JOIN generate_series(1, 50) i;

    -- 1 Timer per Attempt = 5000 Timers
    INSERT INTO secure_assessment_timer_state (id, tenant_id, exam_attempt_id, configured_duration_seconds)
    SELECT md5('perf_timer_' || t || '_' || i)::uuid, md5('perf_tenant_' || t)::uuid, md5('perf_attempt_' || t || '_' || i)::uuid, 3600
    FROM generate_series(101, 200) t
    CROSS JOIN generate_series(1, 50) i;
    
    -- 20 Adjustments per Timer = 100,000 Adjustments
    INSERT INTO secure_assessment_timer_adjustments (id, tenant_id, timer_state_id, adjustment_seconds, reason)
    SELECT md5('perf_adj_' || t || '_' || i || '_' || a)::uuid, md5('perf_tenant_' || t)::uuid, md5('perf_timer_' || t || '_' || i)::uuid, 60, 'reason'
    FROM generate_series(101, 200) t
    CROSS JOIN generate_series(1, 50) i
    CROSS JOIN generate_series(1, 20) a;

    SELECT COUNT(*) INTO v_perf_count FROM public.secure_assessment_timer_state WHERE tenant_id NOT IN (v_tenant_id, v_other_tenant_id);
    IF v_perf_count != 5000 THEN
        RAISE EXCEPTION 'PERFORMANCE FAILED: Expected 5000 performance timers, found %', v_perf_count;
    END IF;
    SELECT COUNT(*) INTO v_perf_count FROM public.secure_assessment_timer_adjustments WHERE tenant_id NOT IN (v_tenant_id, v_other_tenant_id);
    IF v_perf_count != 100000 THEN
        RAISE EXCEPTION 'PERFORMANCE FAILED: Expected 100000 performance adjustments, found %', v_perf_count;
    END IF;

END $$;

ANALYZE public.secure_assessment_timer_state;
ANALYZE public.secure_assessment_timer_adjustments;

-- 1. tenant-scoped Attempt timer lookup:
EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT)
SELECT id, configured_duration_seconds, started_at
FROM public.secure_assessment_timer_state
WHERE tenant_id = md5('perf_tenant_101')::uuid
  AND exam_attempt_id = md5('perf_attempt_101_1')::uuid;

-- 2. tenant-scoped adjustment retrieval:
EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT)
SELECT id, adjustment_seconds, reason
FROM public.secure_assessment_timer_adjustments
WHERE tenant_id = md5('perf_tenant_101')::uuid
  AND timer_state_id = md5('perf_timer_101_1')::uuid;

-- 3. adjustment aggregation:
EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT)
SELECT SUM(adjustment_seconds)
FROM public.secure_assessment_timer_adjustments
WHERE tenant_id = md5('perf_tenant_101')::uuid
  AND timer_state_id = md5('perf_timer_101_1')::uuid;

DO $$
DECLARE
    v_plan_json JSON;
BEGIN
    RAISE NOTICE '--- EXECUTING PLAN ASSERTIONS ---';
    -- A. Attempt timer lookup:
    EXECUTE 'EXPLAIN (FORMAT JSON) SELECT id, configured_duration_seconds, started_at FROM public.secure_assessment_timer_state WHERE tenant_id = md5(''perf_tenant_101'')::uuid AND exam_attempt_id = md5(''perf_attempt_101_1'')::uuid;' INTO v_plan_json;
    IF v_plan_json::text NOT LIKE '%uq_sa_timer_state_attempt%' THEN
        RAISE EXCEPTION 'V_PLAN FAILED: uq_sa_timer_state_attempt not used.';
    END IF;

    -- B. adjustment retrieval:
    EXECUTE 'EXPLAIN (FORMAT JSON) SELECT id, adjustment_seconds, reason FROM public.secure_assessment_timer_adjustments WHERE tenant_id = md5(''perf_tenant_101'')::uuid AND timer_state_id = md5(''perf_timer_101_1'')::uuid;' INTO v_plan_json;
    IF v_plan_json::text NOT LIKE '%idx_sa_timer_adj_timer_tenant%' THEN
        RAISE EXCEPTION 'V_PLAN FAILED: idx_sa_timer_adj_timer_tenant not used for retrieval.';
    END IF;

    -- C. adjustment aggregation:
    EXECUTE 'EXPLAIN (FORMAT JSON) SELECT SUM(adjustment_seconds) FROM public.secure_assessment_timer_adjustments WHERE tenant_id = md5(''perf_tenant_101'')::uuid AND timer_state_id = md5(''perf_timer_101_1'')::uuid;' INTO v_plan_json;
    IF v_plan_json::text NOT LIKE '%idx_sa_timer_adj_timer_tenant%' THEN
        RAISE EXCEPTION 'V_PLAN FAILED: idx_sa_timer_adj_timer_tenant not used for aggregation.';
    END IF;

    RAISE NOTICE '--- BU-007 Verification SUCCESS ---';
END $$;

ROLLBACK;
