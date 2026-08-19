-- Verification for Migration 0001: BU-001 Identity and Tenant Foundation (Hardened)

BEGIN;

DO $$
DECLARE
    t_count INT;
    col_exists BOOLEAN;
    fk_count INT;
    migration_count INT;
BEGIN
    -- D1. EXACT USER TABLE SET
    SELECT count(*) INTO t_count 
    FROM information_schema.tables 
    WHERE table_schema = 'public' 
      AND table_type = 'BASE TABLE';
      
    IF t_count != 5 THEN
        RAISE EXCEPTION 'D1 FAIL: Expected exactly 5 public tables, found %', t_count;
    END IF;

    -- Verify exact table names
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'elligble_migration_history') THEN RAISE EXCEPTION 'D1 FAIL: elligble_migration_history missing'; END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'identity_persons') THEN RAISE EXCEPTION 'D1 FAIL: identity_persons missing'; END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'identity_user_accounts') THEN RAISE EXCEPTION 'D1 FAIL: identity_user_accounts missing'; END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'tenant_tenants') THEN RAISE EXCEPTION 'D1 FAIL: tenant_tenants missing'; END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'tenant_memberships') THEN RAISE EXCEPTION 'D1 FAIL: tenant_memberships missing'; END IF;

    -- D2. PERSON IS NOT TENANT-OWNED
    SELECT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'identity_persons' AND column_name IN ('tenant_id', 'organization_id')
    ) INTO col_exists;
    IF col_exists THEN
        RAISE EXCEPTION 'D2 FAIL: identity_persons contains tenant ownership columns';
    END IF;

    -- D3. DISTINCT ENTITY STRUCTURE
    -- Assuming PostgreSQL, object identifiers (OIDs) for relations must be distinct
    IF (SELECT count(DISTINCT c.oid) 
        FROM pg_class c 
        JOIN pg_namespace n ON n.oid = c.relnamespace 
        WHERE n.nspname = 'public' 
          AND c.relname IN ('identity_persons', 'identity_user_accounts', 'tenant_memberships')
       ) != 3 THEN
        RAISE EXCEPTION 'D3 FAIL: Relations are not distinct physical entities';
    END IF;

    -- D4. MEMBERSHIP TENANT CONTEXT
    SELECT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'tenant_memberships' AND column_name = 'tenant_id' AND is_nullable = 'NO'
    ) INTO col_exists;
    IF NOT col_exists THEN RAISE EXCEPTION 'D4 FAIL: tenant_memberships.tenant_id missing or nullable'; END IF;

    SELECT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'tenant_memberships' AND column_name = 'person_id' AND is_nullable = 'NO'
    ) INTO col_exists;
    IF NOT col_exists THEN RAISE EXCEPTION 'D4 FAIL: tenant_memberships.person_id missing or nullable'; END IF;

    -- D5. USER ACCOUNT -> PERSON FK
    SELECT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'identity_user_accounts' AND column_name = 'person_id' AND is_nullable = 'NO'
    ) INTO col_exists;
    IF NOT col_exists THEN RAISE EXCEPTION 'D5 FAIL: identity_user_accounts.person_id is nullable'; END IF;

    SELECT count(*) INTO fk_count
    FROM pg_constraint c
    JOIN pg_class t1 ON t1.oid = c.conrelid
    JOIN pg_class t2 ON t2.oid = c.confrelid
    JOIN pg_attribute a1 ON a1.attrelid = t1.oid AND a1.attnum = ANY(c.conkey)
    JOIN pg_attribute a2 ON a2.attrelid = t2.oid AND a2.attnum = ANY(c.confkey)
    WHERE c.contype = 'f'
      AND t1.relname = 'identity_user_accounts'
      AND a1.attname = 'person_id'
      AND t2.relname = 'identity_persons'
      AND a2.attname = 'id';
      
    IF fk_count != 1 THEN RAISE EXCEPTION 'D5 FAIL: identity_user_accounts.person_id -> identity_persons.id FK not exactly 1 (found %)', fk_count; END IF;

    -- D6. MEMBERSHIP -> TENANT FK
    SELECT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'tenant_memberships' AND column_name = 'tenant_id' AND is_nullable = 'NO'
    ) INTO col_exists;
    IF NOT col_exists THEN RAISE EXCEPTION 'D6 FAIL: tenant_memberships.tenant_id is nullable'; END IF;

    SELECT count(*) INTO fk_count
    FROM pg_constraint c
    JOIN pg_class t1 ON t1.oid = c.conrelid
    JOIN pg_class t2 ON t2.oid = c.confrelid
    JOIN pg_attribute a1 ON a1.attrelid = t1.oid AND a1.attnum = ANY(c.conkey)
    JOIN pg_attribute a2 ON a2.attrelid = t2.oid AND a2.attnum = ANY(c.confkey)
    WHERE c.contype = 'f'
      AND t1.relname = 'tenant_memberships'
      AND a1.attname = 'tenant_id'
      AND t2.relname = 'tenant_tenants'
      AND a2.attname = 'id';
      
    IF fk_count != 1 THEN RAISE EXCEPTION 'D6 FAIL: tenant_memberships.tenant_id -> tenant_tenants.id FK not exactly 1 (found %)', fk_count; END IF;

    -- D7. NO MEMBERSHIP -> PERSON DIRECT DB FK
    SELECT count(*) INTO fk_count
    FROM pg_constraint c
    JOIN pg_class t1 ON t1.oid = c.conrelid
    JOIN pg_class t2 ON t2.oid = c.confrelid
    WHERE c.contype = 'f'
      AND t1.relname = 'tenant_memberships'
      AND t2.relname = 'identity_persons';
      
    IF fk_count > 0 THEN RAISE EXCEPTION 'D7 FAIL: tenant_memberships contains direct FK to identity_persons'; END IF;

    -- D8. MIGRATION HISTORY
    SELECT COUNT(*) INTO migration_count FROM elligble_migration_history WHERE migration_id = '0001_bu001_identity_tenant_foundation';
    IF migration_count != 1 THEN RAISE EXCEPTION 'D8 FAIL: Migration history count for BU-001 is % (expected 1)', migration_count; END IF;

    -- D9. RUNTIME REFERENCE TESTS
    
    -- valid Person insert
    INSERT INTO identity_persons (id) VALUES ('11111111-1111-1111-1111-111111111111');
    
    -- valid User Account -> existing Person
    INSERT INTO identity_user_accounts (id, person_id) VALUES ('22222222-2222-2222-2222-222222222222', '11111111-1111-1111-1111-111111111111');
    
    -- User Account -> nonexistent Person (MUST FAIL)
    BEGIN
        INSERT INTO identity_user_accounts (id, person_id) VALUES ('33333333-3333-3333-3333-333333333333', '99999999-9999-9999-9999-999999999999');
        RAISE EXCEPTION 'D9 FAIL: Invalid User Account insert should have failed';
    EXCEPTION WHEN foreign_key_violation THEN
        -- Expected
    END;

    -- valid Tenant
    INSERT INTO tenant_tenants (id) VALUES ('44444444-4444-4444-4444-444444444444');
    
    -- valid Membership -> existing Tenant
    INSERT INTO tenant_memberships (id, tenant_id, person_id) VALUES ('55555555-5555-5555-5555-555555555555', '44444444-4444-4444-4444-444444444444', '11111111-1111-1111-1111-111111111111');

    -- Membership -> nonexistent Tenant (MUST FAIL)
    BEGIN
        INSERT INTO tenant_memberships (id, tenant_id, person_id) VALUES ('66666666-6666-6666-6666-666666666666', '99999999-9999-9999-9999-999999999999', '11111111-1111-1111-1111-111111111111');
        RAISE EXCEPTION 'D9 FAIL: Invalid Membership insert should have failed';
    EXCEPTION WHEN foreign_key_violation THEN
        -- Expected
    END;

    -- Membership with NULL tenant_id (MUST FAIL)
    BEGIN
        INSERT INTO tenant_memberships (id, tenant_id, person_id) VALUES ('77777777-7777-7777-7777-777777777777', NULL, '11111111-1111-1111-1111-111111111111');
        RAISE EXCEPTION 'D9 FAIL: Membership with NULL tenant_id should have failed';
    EXCEPTION WHEN not_null_violation THEN
        -- Expected
    END;

    RAISE NOTICE 'BU-001 Verification SUCCESS';
END $$;

-- D10. TEST DATA ROLLBACK
ROLLBACK;
