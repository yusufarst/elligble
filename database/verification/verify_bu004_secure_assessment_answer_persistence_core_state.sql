-- Verification Script for BU-004 Secure Assessment Answer Persistence Core State
-- Requires disposable PostgreSQL environment with migrations 0001 -> 0002 -> 0003 -> 0004 applied.

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
    v_instance_a2 UUID := md5('instance_a2')::uuid;

    v_participant_a1 UUID := md5('participant_a1')::uuid;
    v_participant_a2 UUID := md5('participant_a2')::uuid;

    v_attempt_a1 UUID := md5('attempt_a1')::uuid;
    v_attempt_a2 UUID := md5('attempt_a2')::uuid;

    v_snapshot_a1 UUID := md5('snapshot_a1')::uuid;
    v_snapshot_a2 UUID := md5('snapshot_a2')::uuid;

    -- Tenant B Hierarchy
    v_instance_b1 UUID := md5('instance_b1')::uuid;
    v_participant_b1 UUID := md5('participant_b1')::uuid;
    v_attempt_b1 UUID := md5('attempt_b1')::uuid;
    v_snapshot_b1 UUID := md5('snapshot_b1')::uuid;

    v_context_rejected BOOLEAN;
    v_perf_count INT;
    v_migration_count INT;
BEGIN
    RAISE NOTICE '--- BU-004 TERMINAL VERIFICATION STARTED ---';

    -- V1. Expected schema/object presence (Exact Set)
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'secure_assessment_exam_instances' AND table_type = 'BASE TABLE') THEN
        RAISE EXCEPTION 'V1 FAILED: secure_assessment_exam_instances BASE TABLE missing.';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'secure_assessment_exam_participants' AND table_type = 'BASE TABLE') THEN
        RAISE EXCEPTION 'V1 FAILED: secure_assessment_exam_participants BASE TABLE missing.';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'secure_assessment_exam_attempts' AND table_type = 'BASE TABLE') THEN
        RAISE EXCEPTION 'V1 FAILED: secure_assessment_exam_attempts BASE TABLE missing.';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'secure_assessment_exam_sessions' AND table_type = 'BASE TABLE') THEN
        RAISE EXCEPTION 'V1 FAILED: secure_assessment_exam_sessions BASE TABLE missing.';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'secure_assessment_question_bank_items' AND table_type = 'BASE TABLE') THEN
        RAISE EXCEPTION 'V1 FAILED: secure_assessment_question_bank_items BASE TABLE missing.';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'secure_assessment_exam_question_snapshots' AND table_type = 'BASE TABLE') THEN
        RAISE EXCEPTION 'V1 FAILED: secure_assessment_exam_question_snapshots BASE TABLE missing.';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'secure_assessment_exam_answers' AND table_type = 'BASE TABLE') THEN
        RAISE EXCEPTION 'V1 FAILED: secure_assessment_exam_answers BASE TABLE missing.';
    END IF;

    -- V15. Out-of-scope persistence check (No other secure_assessment_ tables)
    IF EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public'
          AND table_type = 'BASE TABLE'
          AND table_name LIKE 'secure_assessment_%'
          AND table_name NOT IN (
            'secure_assessment_exam_instances',
            'secure_assessment_exam_participants',
            'secure_assessment_exam_attempts',
            'secure_assessment_exam_sessions',
            'secure_assessment_question_bank_items',
            'secure_assessment_exam_question_snapshots',
            'secure_assessment_exam_answers'
          )
    ) THEN
        RAISE EXCEPTION 'V1/V15 FAILED: Unexpected out-of-scope secure_assessment BASE TABLE found.';
    END IF;

    -- V2. Exact Answer Table Structure
    -- PK exact check
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint c
        JOIN pg_class t ON c.conrelid = t.oid
        JOIN pg_namespace n ON t.relnamespace = n.oid
        WHERE n.nspname = 'public' AND t.relname = 'secure_assessment_exam_answers'
          AND c.contype = 'p'
          AND pg_get_constraintdef(c.oid) LIKE '%PRIMARY KEY (id)%'
    ) THEN
        RAISE EXCEPTION 'V2 FAILED: PK (id) missing or incorrect.';
    END IF;

    -- uq_sa_exam_answer_current exact check
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint c
        JOIN pg_class t ON c.conrelid = t.oid
        JOIN pg_namespace n ON t.relnamespace = n.oid
        WHERE n.nspname = 'public' AND t.relname = 'secure_assessment_exam_answers'
          AND c.contype = 'u' AND c.conname = 'uq_sa_exam_answer_current'
          AND pg_get_constraintdef(c.oid) LIKE '%UNIQUE (tenant_id, exam_attempt_id, exam_question_snapshot_id)%'
    ) THEN
        RAISE EXCEPTION 'V2 FAILED: uq_sa_exam_answer_current exact UNIQUE constraint missing.';
    END IF;

    -- uq_sa_exam_answers_tenant exact check
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint c
        JOIN pg_class t ON c.conrelid = t.oid
        JOIN pg_namespace n ON t.relnamespace = n.oid
        WHERE n.nspname = 'public' AND t.relname = 'secure_assessment_exam_answers'
          AND c.contype = 'u' AND c.conname = 'uq_sa_exam_answers_tenant'
          AND pg_get_constraintdef(c.oid) LIKE '%UNIQUE (id, tenant_id)%'
    ) THEN
        RAISE EXCEPTION 'V2 FAILED: uq_sa_exam_answers_tenant exact UNIQUE constraint missing.';
    END IF;

    -- Attempt composite FK exact check
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint c
        JOIN pg_class t ON c.conrelid = t.oid
        JOIN pg_namespace n ON t.relnamespace = n.oid
        WHERE n.nspname = 'public' AND t.relname = 'secure_assessment_exam_answers'
          AND c.contype = 'f'
          AND pg_get_constraintdef(c.oid) LIKE '%FOREIGN KEY (exam_attempt_id, tenant_id) REFERENCES %secure_assessment_exam_attempts%(id, tenant_id)%RESTRICT%'
    ) THEN
        RAISE EXCEPTION 'V2 FAILED: Attempt composite FK missing or incorrect.';
    END IF;

    -- Snapshot composite FK exact check
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint c
        JOIN pg_class t ON c.conrelid = t.oid
        JOIN pg_namespace n ON t.relnamespace = n.oid
        WHERE n.nspname = 'public' AND t.relname = 'secure_assessment_exam_answers'
          AND c.contype = 'f'
          AND pg_get_constraintdef(c.oid) LIKE '%FOREIGN KEY (exam_question_snapshot_id, tenant_id) REFERENCES %secure_assessment_exam_question_snapshots%(id, tenant_id)%RESTRICT%'
    ) THEN
        RAISE EXCEPTION 'V2 FAILED: Snapshot composite FK missing or incorrect.';
    END IF;

    -- Columns exact check
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'secure_assessment_exam_answers' AND column_name = 'id' AND is_nullable = 'NO' AND data_type = 'uuid') THEN RAISE EXCEPTION 'V2 FAILED: id column.'; END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'secure_assessment_exam_answers' AND column_name = 'tenant_id' AND is_nullable = 'NO' AND data_type = 'uuid') THEN RAISE EXCEPTION 'V2 FAILED: tenant_id column.'; END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'secure_assessment_exam_answers' AND column_name = 'exam_attempt_id' AND is_nullable = 'NO' AND data_type = 'uuid') THEN RAISE EXCEPTION 'V2 FAILED: exam_attempt_id column.'; END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'secure_assessment_exam_answers' AND column_name = 'exam_question_snapshot_id' AND is_nullable = 'NO' AND data_type = 'uuid') THEN RAISE EXCEPTION 'V2 FAILED: exam_question_snapshot_id column.'; END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'secure_assessment_exam_answers' AND column_name = 'answer_payload' AND is_nullable = 'NO' AND data_type = 'jsonb' AND column_default = '''{}''::jsonb') THEN RAISE EXCEPTION 'V2 FAILED: answer_payload column.'; END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'secure_assessment_exam_answers' AND column_name = 'client_write_identity' AND is_nullable = 'YES' AND data_type = 'character varying' AND character_maximum_length = 255) THEN RAISE EXCEPTION 'V2 FAILED: client_write_identity column.'; END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'secure_assessment_exam_answers' AND column_name = 'write_version' AND is_nullable = 'NO' AND data_type = 'integer' AND column_default = '1') THEN RAISE EXCEPTION 'V2 FAILED: write_version column.'; END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'secure_assessment_exam_answers' AND column_name = 'created_at' AND is_nullable = 'NO' AND data_type IN ('timestamp with time zone', 'timestamp without time zone')) THEN RAISE EXCEPTION 'V2 FAILED: created_at column.'; END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'secure_assessment_exam_answers' AND column_name = 'updated_at' AND is_nullable = 'NO' AND data_type IN ('timestamp with time zone', 'timestamp without time zone')) THEN RAISE EXCEPTION 'V2 FAILED: updated_at column.'; END IF;

    -- Ensure exactly 9 columns
    IF (SELECT COUNT(*) FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'secure_assessment_exam_answers') != 9 THEN
        RAISE EXCEPTION 'V2 FAILED: Unexpected number of columns in secure_assessment_exam_answers.';
    END IF;

    -- idx_sa_answers_attempt_tenant exact check
    IF NOT EXISTS (
        SELECT 1 FROM pg_index i
        JOIN pg_class c ON i.indexrelid = c.oid
        JOIN pg_class t ON i.indrelid = t.oid
        JOIN pg_namespace n ON t.relnamespace = n.oid
        WHERE n.nspname = 'public' AND t.relname = 'secure_assessment_exam_answers' AND c.relname = 'idx_sa_answers_attempt_tenant'
          AND pg_get_indexdef(i.indexrelid) LIKE '%USING btree (tenant_id, exam_attempt_id)'
    ) THEN
        RAISE EXCEPTION 'V2 FAILED: idx_sa_answers_attempt_tenant index missing or incorrect keys.';
    END IF;

    -- Verify function exists
    IF NOT EXISTS (
        SELECT 1 FROM pg_proc p
        JOIN pg_namespace n ON p.pronamespace = n.oid
        WHERE n.nspname = 'public' AND p.proname = 'verify_sa_answer_context'
    ) THEN
        RAISE EXCEPTION 'V2 FAILED: public.verify_sa_answer_context() function missing.';
    END IF;

    -- Verify exact trigger definition
    IF NOT EXISTS (
        SELECT 1 FROM pg_trigger tg
        JOIN pg_class t ON tg.tgrelid = t.oid
        JOIN pg_namespace n ON t.relnamespace = n.oid
        WHERE n.nspname = 'public' AND t.relname = 'secure_assessment_exam_answers'
          AND tg.tgname = 'trg_verify_sa_answer_context'
          AND pg_get_triggerdef(tg.oid) LIKE 'CREATE TRIGGER trg_verify_sa_answer_context BEFORE INSERT OR UPDATE ON %secure_assessment_exam_answers FOR EACH ROW EXECUTE FUNCTION verify_sa_answer_context()'
    ) THEN
        RAISE EXCEPTION 'V2 FAILED: trg_verify_sa_answer_context trigger missing or incorrectly defined.';
    END IF;

    -- V11. Attempt Ownership / No Session Ownership (FK Proof)
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'secure_assessment_exam_answers' AND column_name = 'exam_session_id') THEN
        RAISE EXCEPTION 'V11 FAILED: exam_session_id found in answer table.';
    END IF;
    IF EXISTS (
        SELECT 1 FROM pg_constraint c
        JOIN pg_class t1 ON c.conrelid = t1.oid
        JOIN pg_class t2 ON c.confrelid = t2.oid
        JOIN pg_namespace n ON t1.relnamespace = n.oid
        WHERE n.nspname = 'public' AND t1.relname = 'secure_assessment_exam_answers' AND t2.relname = 'secure_assessment_exam_sessions' AND c.contype = 'f'
    ) THEN
        RAISE EXCEPTION 'V11 FAILED: FK to secure_assessment_exam_sessions found in answer table.';
    END IF;

    -- V12. Snapshot Truth / No Direct QBI (FK Proof)
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'secure_assessment_exam_answers' AND column_name IN ('question_bank_item_id', 'source_question_bank_item_id')) THEN
        RAISE EXCEPTION 'V12 FAILED: Direct question bank item reference found in answer table.';
    END IF;
    IF EXISTS (
        SELECT 1 FROM pg_constraint c
        JOIN pg_class t1 ON c.conrelid = t1.oid
        JOIN pg_class t2 ON c.confrelid = t2.oid
        JOIN pg_namespace n ON t1.relnamespace = n.oid
        WHERE n.nspname = 'public' AND t1.relname = 'secure_assessment_exam_answers' AND t2.relname = 'secure_assessment_question_bank_items' AND c.contype = 'f'
    ) THEN
        RAISE EXCEPTION 'V12 FAILED: FK to secure_assessment_question_bank_items found in answer table.';
    END IF;

    -- V3. Predecessor Regression Guard & Exact Migration Counts
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'identity_persons' AND table_type = 'BASE TABLE') THEN RAISE EXCEPTION 'V3 FAILED: identity_persons missing.'; END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'identity_user_accounts' AND table_type = 'BASE TABLE') THEN RAISE EXCEPTION 'V3 FAILED: identity_user_accounts missing.'; END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'tenant_tenants' AND table_type = 'BASE TABLE') THEN RAISE EXCEPTION 'V3 FAILED: tenant_tenants missing.'; END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'tenant_memberships' AND table_type = 'BASE TABLE') THEN RAISE EXCEPTION 'V3 FAILED: tenant_memberships missing.'; END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'elligble_migration_history' AND table_type = 'BASE TABLE') THEN RAISE EXCEPTION 'V3 FAILED: elligble_migration_history missing.'; END IF;

    SELECT COUNT(*) INTO v_migration_count FROM public.elligble_migration_history WHERE migration_id = '0001_bu001_identity_tenant_foundation';
    IF v_migration_count != 1 THEN RAISE EXCEPTION 'V3 FAILED: 0001 migration count % != 1', v_migration_count; END IF;

    SELECT COUNT(*) INTO v_migration_count FROM public.elligble_migration_history WHERE migration_id = '0002_bu002_secure_assessment_core_state';
    IF v_migration_count != 1 THEN RAISE EXCEPTION 'V3 FAILED: 0002 migration count % != 1', v_migration_count; END IF;

    SELECT COUNT(*) INTO v_migration_count FROM public.elligble_migration_history WHERE migration_id = '0003_bu003_secure_assessment_question_core_state';
    IF v_migration_count != 1 THEN RAISE EXCEPTION 'V3 FAILED: 0003 migration count % != 1', v_migration_count; END IF;

    SELECT COUNT(*) INTO v_migration_count FROM public.elligble_migration_history WHERE migration_id = '0004_bu004_secure_assessment_answer_persistence_core_state';
    IF v_migration_count != 1 THEN RAISE EXCEPTION 'V3 FAILED: 0004 migration count % != 1', v_migration_count; END IF;

    -- Setup Fixtures
    -- BU-001 Foundation
    INSERT INTO identity_persons (id) VALUES (v_person_id);
    INSERT INTO tenant_tenants (id) VALUES (v_tenant_id), (v_other_tenant_id);

    -- TENANT A Hierarchy
    INSERT INTO secure_assessment_exam_instances (id, tenant_id) VALUES
        (v_instance_a1, v_tenant_id),
        (v_instance_a2, v_tenant_id);

    INSERT INTO secure_assessment_exam_participants (id, tenant_id, exam_instance_id, person_id) VALUES
        (v_participant_a1, v_tenant_id, v_instance_a1, v_person_id),
        (v_participant_a2, v_tenant_id, v_instance_a2, v_person_id);

    INSERT INTO secure_assessment_exam_attempts (id, tenant_id, exam_participant_id) VALUES
        (v_attempt_a1, v_tenant_id, v_participant_a1),
        (v_attempt_a2, v_tenant_id, v_participant_a2);

    INSERT INTO secure_assessment_exam_question_snapshots (id, tenant_id, exam_instance_id) VALUES
        (v_snapshot_a1, v_tenant_id, v_instance_a1),
        (v_snapshot_a2, v_tenant_id, v_instance_a2);

    -- TENANT B Hierarchy
    INSERT INTO secure_assessment_exam_instances (id, tenant_id) VALUES (v_instance_b1, v_other_tenant_id);
    INSERT INTO secure_assessment_exam_participants (id, tenant_id, exam_instance_id, person_id) VALUES (v_participant_b1, v_other_tenant_id, v_instance_b1, v_person_id);
    INSERT INTO secure_assessment_exam_attempts (id, tenant_id, exam_participant_id) VALUES (v_attempt_b1, v_other_tenant_id, v_participant_b1);
    INSERT INTO secure_assessment_exam_question_snapshots (id, tenant_id, exam_instance_id) VALUES (v_snapshot_b1, v_other_tenant_id, v_instance_b1);

    -- V14. Explicit NULL Malformed Required State Rejection
    BEGIN
        INSERT INTO secure_assessment_exam_answers (tenant_id, exam_attempt_id, exam_question_snapshot_id, answer_payload)
        VALUES (v_tenant_id, v_attempt_a2, v_snapshot_a2, NULL);
        RAISE EXCEPTION 'V14 FAILED: Inserted answer with explicit NULL payload.';
    EXCEPTION WHEN not_null_violation THEN
        -- Expected
    END;

    -- V4 & V13. Valid authoritative answer insertion succeeds & Readback
    INSERT INTO secure_assessment_exam_answers (tenant_id, exam_attempt_id, exam_question_snapshot_id, answer_payload, client_write_identity)
    VALUES (v_tenant_id, v_attempt_a1, v_snapshot_a1, '{"choice":"A"}', 'client-write-001');

    IF NOT EXISTS (
        SELECT 1 FROM secure_assessment_exam_answers
        WHERE tenant_id = v_tenant_id
          AND exam_attempt_id = v_attempt_a1
          AND exam_question_snapshot_id = v_snapshot_a1
          AND answer_payload = '{"choice":"A"}'::jsonb
          AND client_write_identity = 'client-write-001'
          AND write_version = 1
    ) THEN
        RAISE EXCEPTION 'V4/V13 FAILED: Initial answer readback failed.';
    END IF;

    -- V13 Update check
    UPDATE secure_assessment_exam_answers
    SET answer_payload = '{"choice":"C"}', client_write_identity = 'client-write-002', write_version = 2
    WHERE tenant_id = v_tenant_id AND exam_attempt_id = v_attempt_a1 AND exam_question_snapshot_id = v_snapshot_a1;

    IF NOT EXISTS (
        SELECT 1 FROM secure_assessment_exam_answers
        WHERE tenant_id = v_tenant_id
          AND exam_attempt_id = v_attempt_a1
          AND exam_question_snapshot_id = v_snapshot_a1
          AND answer_payload = '{"choice":"C"}'::jsonb
          AND client_write_identity = 'client-write-002'
          AND write_version = 2
    ) THEN
        RAISE EXCEPTION 'V13 FAILED: Answer update failed (one or more fields mismatch).';
    END IF;

    -- V10. Authoritative current answer uniqueness enforced
    BEGIN
        INSERT INTO secure_assessment_exam_answers (tenant_id, exam_attempt_id, exam_question_snapshot_id, answer_payload)
        VALUES (v_tenant_id, v_attempt_a1, v_snapshot_a1, '{"choice":"B"}');
        RAISE EXCEPTION 'V10 FAILED: Duplicate answer allowed for same attempt and snapshot.';
    EXCEPTION WHEN unique_violation THEN
        -- Expected
    END;

    -- V5. Answer -> Attempt cross-tenant isolation (Attempt FK must reject)
    BEGIN
        INSERT INTO secure_assessment_exam_answers (tenant_id, exam_attempt_id, exam_question_snapshot_id, answer_payload)
        VALUES (v_tenant_id, v_attempt_b1, v_snapshot_a1, '{}');
        RAISE EXCEPTION 'V5 FAILED: Cross-tenant Attempt allowed.';
    EXCEPTION WHEN foreign_key_violation THEN
        -- Expected
    END;

    -- V6. Answer -> Snapshot cross-tenant isolation (Snapshot FK must reject)
    BEGIN
        INSERT INTO secure_assessment_exam_answers (tenant_id, exam_attempt_id, exam_question_snapshot_id, answer_payload)
        VALUES (v_tenant_id, v_attempt_a1, v_snapshot_b1, '{}');
        RAISE EXCEPTION 'V6 FAILED: Cross-tenant snapshot allowed.';
    EXCEPTION WHEN foreign_key_violation THEN
        -- Expected
    END;

    -- V7. Same-tenant Attempt + Snapshot from incompatible Exam Instance context is rejected
    v_context_rejected := FALSE;
    BEGIN
        INSERT INTO secure_assessment_exam_answers (tenant_id, exam_attempt_id, exam_question_snapshot_id, answer_payload)
        VALUES (v_tenant_id, v_attempt_a1, v_snapshot_a2, '{}');
    EXCEPTION WHEN raise_exception THEN
        IF SQLERRM LIKE '%incompatible Exam Instance contexts%' THEN
            v_context_rejected := TRUE;
        ELSE
            RAISE; -- Rethrow if it's a different exception
        END IF;
    END;

    IF v_context_rejected IS NOT TRUE THEN
        RAISE EXCEPTION 'V7 FAILED: Incompatible context allowed.';
    END IF;

    -- V8. Nonexistent Attempt is rejected
    BEGIN
        INSERT INTO secure_assessment_exam_answers (tenant_id, exam_attempt_id, exam_question_snapshot_id, answer_payload)
        VALUES (v_tenant_id, gen_random_uuid(), v_snapshot_a1, '{}');
        RAISE EXCEPTION 'V8 FAILED: Nonexistent attempt allowed.';
    EXCEPTION WHEN foreign_key_violation THEN
        -- Expected
    END;

    -- V9. Nonexistent Snapshot is rejected
    BEGIN
        INSERT INTO secure_assessment_exam_answers (tenant_id, exam_attempt_id, exam_question_snapshot_id, answer_payload)
        VALUES (v_tenant_id, v_attempt_a1, gen_random_uuid(), '{}');
        RAISE EXCEPTION 'V9 FAILED: Nonexistent snapshot allowed.';
    EXCEPTION WHEN foreign_key_violation THEN
        -- Expected
    END;

    -- PERFORMANCE VERIFICATION
    RAISE NOTICE 'Generating deterministic performance fixtures (~100,000 answers)...';

    -- 100 Tenants
    INSERT INTO tenant_tenants (id)
    SELECT md5('perf_tenant_' || i)::uuid FROM generate_series(1, 100) i;

    -- 20 Instances per tenant = 2000 Instances
    INSERT INTO secure_assessment_exam_instances (id, tenant_id)
    SELECT md5('perf_instance_' || t || '_' || i)::uuid, md5('perf_tenant_' || t)::uuid
    FROM generate_series(1, 100) t
    CROSS JOIN generate_series(1, 20) i;

    -- 20 Participants/Attempts per tenant (1 per instance) = 2000 Attempts
    INSERT INTO secure_assessment_exam_participants (id, tenant_id, exam_instance_id, person_id)
    SELECT md5('perf_participant_' || t || '_' || i)::uuid, md5('perf_tenant_' || t)::uuid, md5('perf_instance_' || t || '_' || i)::uuid, v_person_id
    FROM generate_series(1, 100) t
    CROSS JOIN generate_series(1, 20) i;

    INSERT INTO secure_assessment_exam_attempts (id, tenant_id, exam_participant_id)
    SELECT md5('perf_attempt_' || t || '_' || i)::uuid, md5('perf_tenant_' || t)::uuid, md5('perf_participant_' || t || '_' || i)::uuid
    FROM generate_series(1, 100) t
    CROSS JOIN generate_series(1, 20) i;

    -- 50 Snapshots per instance = 100,000 Snapshots
    INSERT INTO secure_assessment_exam_question_snapshots (id, tenant_id, exam_instance_id)
    SELECT md5('perf_snapshot_' || t || '_' || i || '_' || s)::uuid, md5('perf_tenant_' || t)::uuid, md5('perf_instance_' || t || '_' || i)::uuid
    FROM generate_series(1, 100) t
    CROSS JOIN generate_series(1, 20) i
    CROSS JOIN generate_series(1, 50) s;

    -- 1 Answer per Attempt/Snapshot = 100,000 Answers
    INSERT INTO secure_assessment_exam_answers (id, tenant_id, exam_attempt_id, exam_question_snapshot_id, answer_payload)
    SELECT md5('perf_answer_' || t || '_' || i || '_' || s)::uuid, md5('perf_tenant_' || t)::uuid, md5('perf_attempt_' || t || '_' || i)::uuid, md5('perf_snapshot_' || t || '_' || i || '_' || s)::uuid, '{}'::jsonb
    FROM generate_series(1, 100) t
    CROSS JOIN generate_series(1, 20) i
    CROSS JOIN generate_series(1, 50) s;

    -- Assert exactly 100000 performance answers
    SELECT COUNT(*) INTO v_perf_count FROM public.secure_assessment_exam_answers WHERE tenant_id NOT IN (v_tenant_id, v_other_tenant_id);
    IF v_perf_count != 100000 THEN
        RAISE EXCEPTION 'PERFORMANCE FAILED: Expected 100000 performance answers, found %', v_perf_count;
    END IF;

END $$;

ANALYZE public.secure_assessment_exam_answers;

EXPLAIN (ANALYZE, BUFFERS, COSTS, FORMAT TEXT)
SELECT id, answer_payload, client_write_identity, write_version
FROM public.secure_assessment_exam_answers
WHERE tenant_id = md5('perf_tenant_1')::uuid
  AND exam_attempt_id = md5('perf_attempt_1_1')::uuid;

EXPLAIN (ANALYZE, BUFFERS, COSTS, FORMAT TEXT)
SELECT id, answer_payload, client_write_identity, write_version
FROM public.secure_assessment_exam_answers
WHERE tenant_id = md5('perf_tenant_1')::uuid
  AND exam_attempt_id = md5('perf_attempt_1_1')::uuid
  AND exam_question_snapshot_id = md5('perf_snapshot_1_1_1')::uuid;

DO $$
BEGIN
    RAISE NOTICE '--- BU-004 Verification SUCCESS ---';
END $$;

ROLLBACK;
