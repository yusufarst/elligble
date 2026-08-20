-- Verification for Migration 0003: BU-003 Secure Assessment Question Core State Persistence Bootstrap

BEGIN;

DO $$
DECLARE
    t_count INT;
    col_exists BOOLEAN;
    fk_count INT;
    idx_count INT;
    explain_plan TEXT;
    mutation_rejected BOOLEAN := FALSE;
BEGIN
    -- V1. EXACT TWO DOMAIN CONCEPTS INTRODUCED
    -- We assume the 4 from BU-002 + 2 from BU-003 = 6 secure_assessment tables
    SELECT count(*) INTO t_count FROM information_schema.tables WHERE table_schema = 'public' AND table_name LIKE 'secure_assessment_%';
    IF t_count != 6 THEN RAISE EXCEPTION 'V1 FAIL: Expected exactly 6 secure_assessment tables, found %', t_count; END IF;

    -- V14. PREDECESSOR REGRESSION GUARD
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'identity_persons') THEN RAISE EXCEPTION 'V14 FAIL: identity_persons missing'; END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'identity_user_accounts') THEN RAISE EXCEPTION 'V14 FAIL: identity_user_accounts missing'; END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'tenant_tenants') THEN RAISE EXCEPTION 'V14 FAIL: tenant_tenants missing'; END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'tenant_memberships') THEN RAISE EXCEPTION 'V14 FAIL: tenant_memberships missing'; END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'secure_assessment_exam_instances') THEN RAISE EXCEPTION 'V14 FAIL: secure_assessment_exam_instances missing'; END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'secure_assessment_exam_participants') THEN RAISE EXCEPTION 'V14 FAIL: secure_assessment_exam_participants missing'; END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'secure_assessment_exam_attempts') THEN RAISE EXCEPTION 'V14 FAIL: secure_assessment_exam_attempts missing'; END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'secure_assessment_exam_sessions') THEN RAISE EXCEPTION 'V14 FAIL: secure_assessment_exam_sessions missing'; END IF;

    SELECT count(*) INTO t_count FROM elligble_migration_history WHERE migration_id = '0001_bu001_identity_tenant_foundation';
    IF t_count != 1 THEN RAISE EXCEPTION 'V14 FAIL: BU-001 migration history missing'; END IF;

    SELECT count(*) INTO t_count FROM elligble_migration_history WHERE migration_id = '0002_bu002_secure_assessment_core_state';
    IF t_count != 1 THEN RAISE EXCEPTION 'V14 FAIL: BU-002 migration history missing'; END IF;

    SELECT count(*) INTO t_count FROM pg_constraint c JOIN pg_class t ON c.conrelid = t.oid JOIN pg_namespace n ON t.relnamespace = n.oid JOIN pg_attribute a1 ON a1.attrelid = t.oid AND a1.attnum = c.conkey[1] JOIN pg_attribute a2 ON a2.attrelid = t.oid AND a2.attnum = c.conkey[2]
    WHERE n.nspname = 'public' AND t.relname = 'secure_assessment_exam_instances' AND c.contype = 'u' AND c.conname = 'uq_sa_exam_instances_tenant' AND a1.attname = 'id' AND a2.attname = 'tenant_id' AND array_length(c.conkey, 1) = 2;
    IF t_count != 1 THEN RAISE EXCEPTION 'V14 FAIL: BU-002 constraint uq_sa_exam_instances_tenant missing or shape incorrect'; END IF;

    SELECT count(*) INTO t_count FROM elligble_migration_history WHERE migration_id = '0003_bu003_secure_assessment_question_core_state';
    IF t_count != 1 THEN RAISE EXCEPTION 'V14 FAIL: BU-003 migration history missing'; END IF;

    -- V8. HARDEN EXACT BU-003 TABLE STRUCTURE
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'secure_assessment_question_bank_items') THEN RAISE EXCEPTION 'V1 FAIL: secure_assessment_question_bank_items missing'; END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'secure_assessment_exam_question_snapshots') THEN RAISE EXCEPTION 'V1 FAIL: secure_assessment_exam_question_snapshots missing'; END IF;

    -- Question Bank Item
    SELECT count(*) INTO t_count FROM pg_constraint c JOIN pg_class t ON c.conrelid = t.oid JOIN pg_namespace n ON t.relnamespace = n.oid JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = c.conkey[1]
    WHERE n.nspname = 'public' AND t.relname = 'secure_assessment_question_bank_items' AND c.contype = 'p' AND a.attname = 'id' AND array_length(c.conkey, 1) = 1;
    IF t_count != 1 THEN RAISE EXCEPTION 'H8 FAIL: question_bank_items PK is not exactly (id)'; END IF;

    SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'secure_assessment_question_bank_items' AND column_name = 'tenant_id' AND is_nullable = 'NO') INTO col_exists;
    IF NOT col_exists THEN RAISE EXCEPTION 'V3 FAIL: question_bank_items missing tenant_id NOT NULL'; END IF;

    SELECT count(*) INTO fk_count FROM pg_constraint c JOIN pg_class t ON c.conrelid = t.oid JOIN pg_namespace n ON t.relnamespace = n.oid JOIN pg_attribute a1 ON a1.attrelid = t.oid AND a1.attnum = c.conkey[1] JOIN pg_attribute a2 ON a2.attrelid = t.oid AND a2.attnum = c.conkey[2]
    WHERE n.nspname = 'public' AND t.relname = 'secure_assessment_question_bank_items' AND c.conname = 'uq_sa_qb_items_tenant' AND c.contype = 'u' AND a1.attname = 'id' AND a2.attname = 'tenant_id' AND array_length(c.conkey, 1) = 2;
    IF fk_count != 1 THEN RAISE EXCEPTION 'H8 FAIL: question_bank_items UNIQUE (id, tenant_id) missing or incorrect'; END IF;

    -- Exam Question Snapshot
    SELECT count(*) INTO t_count FROM pg_constraint c JOIN pg_class t ON c.conrelid = t.oid JOIN pg_namespace n ON t.relnamespace = n.oid JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = c.conkey[1]
    WHERE n.nspname = 'public' AND t.relname = 'secure_assessment_exam_question_snapshots' AND c.contype = 'p' AND a.attname = 'id' AND array_length(c.conkey, 1) = 1;
    IF t_count != 1 THEN RAISE EXCEPTION 'H8 FAIL: exam_question_snapshots PK is not exactly (id)'; END IF;

    SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'secure_assessment_exam_question_snapshots' AND column_name = 'tenant_id' AND is_nullable = 'NO') INTO col_exists;
    IF NOT col_exists THEN RAISE EXCEPTION 'V4 FAIL: exam_question_snapshots missing tenant_id NOT NULL'; END IF;

    SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'secure_assessment_exam_question_snapshots' AND column_name = 'exam_instance_id' AND is_nullable = 'NO') INTO col_exists;
    IF NOT col_exists THEN RAISE EXCEPTION 'V4 FAIL: exam_question_snapshots missing exam_instance_id NOT NULL'; END IF;

    SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'secure_assessment_exam_question_snapshots' AND column_name = 'frozen_content' AND is_nullable = 'NO') INTO col_exists;
    IF NOT col_exists THEN RAISE EXCEPTION 'V4 FAIL: exam_question_snapshots missing frozen_content NOT NULL'; END IF;

    SELECT count(*) INTO fk_count FROM pg_constraint c JOIN pg_class t ON c.conrelid = t.oid JOIN pg_namespace n ON t.relnamespace = n.oid JOIN pg_attribute a1 ON a1.attrelid = t.oid AND a1.attnum = c.conkey[1] JOIN pg_attribute a2 ON a2.attrelid = t.oid AND a2.attnum = c.conkey[2]
    WHERE n.nspname = 'public' AND t.relname = 'secure_assessment_exam_question_snapshots' AND c.conname = 'uq_sa_eq_snapshots_tenant' AND c.contype = 'u' AND a1.attname = 'id' AND a2.attname = 'tenant_id' AND array_length(c.conkey, 1) = 2;
    IF fk_count != 1 THEN RAISE EXCEPTION 'H8 FAIL: exam_question_snapshots UNIQUE (id, tenant_id) missing or incorrect'; END IF;

    -- FK mappings (V5, V6 structure check)
    SELECT count(*) INTO fk_count FROM pg_constraint c JOIN pg_class t1 ON t1.oid = c.conrelid JOIN pg_namespace n1 ON t1.relnamespace = n1.oid JOIN pg_class t2 ON t2.oid = c.confrelid JOIN pg_namespace n2 ON t2.relnamespace = n2.oid JOIN pg_attribute a1 ON a1.attrelid = t1.oid AND a1.attnum = c.conkey[1] JOIN pg_attribute a2 ON a2.attrelid = t1.oid AND a2.attnum = c.conkey[2] JOIN pg_attribute f1 ON f1.attrelid = t2.oid AND f1.attnum = c.confkey[1] JOIN pg_attribute f2 ON f2.attrelid = t2.oid AND f2.attnum = c.confkey[2]
    WHERE c.conname = 'fk_sa_eq_snapshot_instance' AND c.contype = 'f' AND c.confdeltype = 'r' AND n1.nspname = 'public' AND t1.relname = 'secure_assessment_exam_question_snapshots' AND a1.attname = 'exam_instance_id' AND a2.attname = 'tenant_id' AND n2.nspname = 'public' AND t2.relname = 'secure_assessment_exam_instances' AND f1.attname = 'id' AND f2.attname = 'tenant_id' AND array_length(c.conkey, 1) = 2 AND array_length(c.confkey, 1) = 2;
    IF fk_count != 1 THEN RAISE EXCEPTION 'V5 FAIL: fk_sa_eq_snapshot_instance exact composite mapping incorrect'; END IF;

    SELECT count(*) INTO fk_count FROM pg_constraint c JOIN pg_class t1 ON t1.oid = c.conrelid JOIN pg_namespace n1 ON t1.relnamespace = n1.oid JOIN pg_class t2 ON t2.oid = c.confrelid JOIN pg_namespace n2 ON t2.relnamespace = n2.oid JOIN pg_attribute a1 ON a1.attrelid = t1.oid AND a1.attnum = c.conkey[1] JOIN pg_attribute a2 ON a2.attrelid = t1.oid AND a2.attnum = c.conkey[2] JOIN pg_attribute f1 ON f1.attrelid = t2.oid AND f1.attnum = c.confkey[1] JOIN pg_attribute f2 ON f2.attrelid = t2.oid AND f2.attnum = c.confkey[2]
    WHERE c.conname = 'fk_sa_eq_snapshot_source' AND c.contype = 'f' AND c.confdeltype = 'r' AND n1.nspname = 'public' AND t1.relname = 'secure_assessment_exam_question_snapshots' AND a1.attname = 'source_question_bank_item_id' AND a2.attname = 'tenant_id' AND n2.nspname = 'public' AND t2.relname = 'secure_assessment_question_bank_items' AND f1.attname = 'id' AND f2.attname = 'tenant_id' AND array_length(c.conkey, 1) = 2 AND array_length(c.confkey, 1) = 2;
    IF fk_count != 1 THEN RAISE EXCEPTION 'V5 FAIL: fk_sa_eq_snapshot_source exact composite mapping incorrect'; END IF;

    -- V5. EXACT ALLOWED FK SET / CROSS-DOMAIN FK ABSENCE
    SELECT count(*) INTO fk_count FROM pg_constraint c JOIN pg_class t ON c.conrelid = t.oid JOIN pg_namespace n ON t.relnamespace = n.oid WHERE n.nspname = 'public' AND c.contype = 'f' AND t.relname = 'secure_assessment_question_bank_items';
    IF fk_count != 0 THEN RAISE EXCEPTION 'V5 FAIL: secure_assessment_question_bank_items must have exactly 0 foreign keys'; END IF;

    SELECT count(*) INTO fk_count FROM pg_constraint c JOIN pg_class t ON c.conrelid = t.oid JOIN pg_namespace n ON t.relnamespace = n.oid WHERE n.nspname = 'public' AND c.contype = 'f' AND t.relname = 'secure_assessment_exam_question_snapshots';
    IF fk_count != 2 THEN RAISE EXCEPTION 'V5 FAIL: secure_assessment_exam_question_snapshots must have exactly 2 foreign keys'; END IF;

    -- V10. NO OUT-OF-SCOPE PERSISTENCE
    IF EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name LIKE 'secure_assessment_%' AND
        (table_name LIKE '%answer%' OR table_name LIKE '%assessment_type%' OR
         table_name LIKE '%room%' OR table_name LIKE '%violation%' OR table_name LIKE '%risk%' OR
         table_name LIKE '%incident%' OR table_name LIKE '%cheating%' OR table_name LIKE '%score%' OR
         table_name LIKE '%scoring%' OR table_name LIKE '%submission%' OR table_name LIKE '%receipt%' OR
         table_name LIKE '%timer%' OR table_name LIKE '%response%' OR table_name LIKE '%acknowledg%')
    ) THEN
         RAISE EXCEPTION 'V10 FAIL: Out-of-scope persistence category found';
    END IF;

    -- V11. INDEXES PRESENT EXACTLY
    SELECT count(*) INTO idx_count FROM pg_index i JOIN pg_class c ON i.indrelid = c.oid JOIN pg_namespace n ON c.relnamespace = n.oid JOIN pg_class ic ON i.indexrelid = ic.oid JOIN pg_namespace inc ON ic.relnamespace = inc.oid JOIN pg_attribute a ON a.attrelid = c.oid AND a.attnum = i.indkey[0]
    WHERE n.nspname = 'public' AND c.relname = 'secure_assessment_question_bank_items' AND inc.nspname = 'public' AND ic.relname = 'idx_sa_qb_items_tenant' AND a.attname = 'tenant_id' AND i.indnatts = 1 AND i.indnkeyatts = 1 AND i.indisvalid = true AND i.indisready = true AND i.indpred IS NULL AND i.indexprs IS NULL;
    IF idx_count != 1 THEN RAISE EXCEPTION 'V11 FAIL: idx_sa_qb_items_tenant missing or shape incorrect'; END IF;

    SELECT count(*) INTO idx_count FROM pg_index i JOIN pg_class c ON i.indrelid = c.oid JOIN pg_namespace n ON c.relnamespace = n.oid JOIN pg_class ic ON i.indexrelid = ic.oid JOIN pg_namespace inc ON ic.relnamespace = inc.oid JOIN pg_attribute a1 ON a1.attrelid = c.oid AND a1.attnum = i.indkey[0] JOIN pg_attribute a2 ON a2.attrelid = c.oid AND a2.attnum = i.indkey[1]
    WHERE n.nspname = 'public' AND c.relname = 'secure_assessment_exam_question_snapshots' AND inc.nspname = 'public' AND ic.relname = 'idx_sa_eq_snapshots_instance_tenant' AND a1.attname = 'exam_instance_id' AND a2.attname = 'tenant_id' AND i.indnatts = 2 AND i.indnkeyatts = 2 AND i.indisvalid = true AND i.indisready = true AND i.indpred IS NULL AND i.indexprs IS NULL;
    IF idx_count != 1 THEN RAISE EXCEPTION 'V11 FAIL: idx_sa_eq_snapshots_instance_tenant missing or shape incorrect'; END IF;

    -- V9. EXACT IMMUTABILITY TRIGGER METADATA
    SELECT count(*) INTO t_count FROM pg_trigger tg JOIN pg_class c ON tg.tgrelid = c.oid JOIN pg_namespace n ON c.relnamespace = n.oid JOIN pg_proc p ON tg.tgfoid = p.oid JOIN pg_namespace pn ON p.pronamespace = pn.oid
    WHERE n.nspname = 'public' AND c.relname = 'secure_assessment_exam_question_snapshots' AND tg.tgname = 'trg_prevent_snapshot_mutation' AND pn.nspname = 'public' AND p.proname = 'prevent_snapshot_mutation'
    AND tg.tgisinternal = false AND tg.tgenabled = 'O' AND tg.tgtype = 19;
    IF t_count != 1 THEN RAISE EXCEPTION 'V9 FAIL: trg_prevent_snapshot_mutation exact metadata incorrect (must be exactly BEFORE UPDATE ROW)'; END IF;

    -- V12. EXPLAIN Tenant-scoped Question Bank Item retrieval
    EXPLAIN SELECT * FROM secure_assessment_question_bank_items WHERE tenant_id = '11111111-1111-1111-1111-111111111111' INTO explain_plan;
    IF explain_plan IS NULL THEN RAISE EXCEPTION 'V12 FAIL: EXPLAIN failed for Question Bank retrieval'; END IF;

    -- V13. EXPLAIN Exam-Instance-scoped Snapshot retrieval
    EXPLAIN SELECT * FROM secure_assessment_exam_question_snapshots WHERE exam_instance_id = '11111111-1111-1111-1111-111111111111' AND tenant_id = '11111111-1111-1111-1111-111111111111' INTO explain_plan;
    IF explain_plan IS NULL THEN RAISE EXCEPTION 'V13 FAIL: EXPLAIN failed for Snapshot retrieval'; END IF;

    -- RUNTIME TESTS (V6, V7, V8, V9)
    -- Requires a tenant and an exam instance first (from BU-002 runtime rules).
    INSERT INTO tenant_tenants (id) VALUES ('99999999-9999-9999-9999-999999999999');
    INSERT INTO tenant_tenants (id) VALUES ('77777777-7777-7777-7777-777777777777');

    INSERT INTO secure_assessment_exam_instances (id, tenant_id) VALUES ('10000000-0000-0000-0000-000000000000', '99999999-9999-9999-9999-999999999999');

    -- V7. Question Bank Item creation and edit
    INSERT INTO secure_assessment_question_bank_items (id, tenant_id, content_payload) VALUES ('20000000-0000-0000-0000-000000000000', '99999999-9999-9999-9999-999999999999', '{"q":"A"}');
    UPDATE secure_assessment_question_bank_items SET content_payload = '{"q":"B"}' WHERE id = '20000000-0000-0000-0000-000000000000';

    IF NOT EXISTS (SELECT 1 FROM secure_assessment_question_bank_items WHERE id = '20000000-0000-0000-0000-000000000000' AND content_payload = '{"q":"B"}') THEN RAISE EXCEPTION 'V7 FAIL: Editability assertion failed'; END IF;

    -- Snapshot Creation
    INSERT INTO secure_assessment_exam_question_snapshots (id, tenant_id, exam_instance_id, source_question_bank_item_id, frozen_content)
    VALUES ('30000000-0000-0000-0000-000000000000', '99999999-9999-9999-9999-999999999999', '10000000-0000-0000-0000-000000000000', '20000000-0000-0000-0000-000000000000', '{"q":"B"}');

    -- V8. Editing Question Bank Item does not change Snapshot truth
    UPDATE secure_assessment_question_bank_items SET content_payload = '{"q":"C"}' WHERE id = '20000000-0000-0000-0000-000000000000';
    IF NOT EXISTS (SELECT 1 FROM secure_assessment_exam_question_snapshots WHERE id = '30000000-0000-0000-0000-000000000000' AND frozen_content = '{"q":"B"}') THEN RAISE EXCEPTION 'V8 FAIL: Snapshot mutated unexpectedly'; END IF;

    -- V6. Cross-tenant Snapshot -> Exam Instance association is rejected
    BEGIN
        INSERT INTO secure_assessment_exam_question_snapshots (id, tenant_id, exam_instance_id, frozen_content)
        VALUES ('30000000-0000-0000-0000-000000000001', '77777777-7777-7777-7777-777777777777', '10000000-0000-0000-0000-000000000000', '{"q":"C"}');
        RAISE EXCEPTION 'V6 FAIL: Snapshot with mismatching tenant_id should have failed';
    EXCEPTION WHEN foreign_key_violation THEN
        -- Expected
    END;

    -- V9. Direct ordinary mutation of frozen Snapshot is rejected
    BEGIN
        UPDATE secure_assessment_exam_question_snapshots SET frozen_content = '{"q":"Hacked"}' WHERE id = '30000000-0000-0000-0000-000000000000';
    EXCEPTION WHEN RAISE_EXCEPTION THEN
        IF SQLERRM LIKE '%immutable%' THEN
            mutation_rejected := TRUE;
        ELSE
            RAISE;
        END IF;
    END;
    IF mutation_rejected IS NOT TRUE THEN RAISE EXCEPTION 'V9 FAIL: Snapshot mutation succeeded or raised wrong exception'; END IF;

    -- V15. Verification ends with unambiguous success marker
    RAISE NOTICE 'BU-003 Verification SUCCESS';
END $$;

ROLLBACK;
