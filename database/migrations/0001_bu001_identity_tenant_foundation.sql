-- Migration 0001: BU-001 Identity and Tenant Foundation
-- Purpose: Minimum Foundation: Identity/Tenant Persistence Bootstrap

BEGIN;

-- 1. Create Migration History Table
CREATE TABLE IF NOT EXISTS elligble_migration_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    migration_id VARCHAR(255) NOT NULL UNIQUE,
    applied_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Check for safe repeat invocation (idempotency)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM elligble_migration_history WHERE migration_id = '0001_bu001_identity_tenant_foundation') THEN
        RAISE NOTICE 'Migration 0001_bu001_identity_tenant_foundation already applied. Skipping.';
        RETURN;
    END IF;

    -- 2. Identity Domain: Persons
    -- Truth: Person is not tenant-owned. Identity-owned.
    CREATE TABLE IF NOT EXISTS identity_persons (
        id UUID PRIMARY KEY,
        created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    -- 3. Identity Domain: User Accounts
    -- Truth: User Account is separate from Person.
    CREATE TABLE IF NOT EXISTS identity_user_accounts (
        id UUID PRIMARY KEY,
        person_id UUID NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT fk_identity_user_accounts_person FOREIGN KEY (person_id) REFERENCES identity_persons (id) ON DELETE RESTRICT
    );

    -- 4. Tenant Domain: Tenants
    -- Truth: Organization != Tenant. One school = one academic tenant baseline.
    CREATE TABLE IF NOT EXISTS tenant_tenants (
        id UUID PRIMARY KEY,
        created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    -- 5. Tenant Domain: Memberships
    -- Truth: Membership is separate from Person and User Account.
    -- Truth: Membership requires Tenant context.
    -- Note on person_id:
    -- Person truth remains Identity-owned.
    -- Membership truth remains Organization/Tenant-owned.
    -- person_id is a required cross-domain identity reference.
    -- runtime/contract validation remains deferred.
    -- absence of direct Membership->Person FK is deliberate.
    -- this does not resolve the global FK/Event Strategy.
    CREATE TABLE IF NOT EXISTS tenant_memberships (
        id UUID PRIMARY KEY,
        tenant_id UUID NOT NULL,
        person_id UUID NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT fk_tenant_memberships_tenant FOREIGN KEY (tenant_id) REFERENCES tenant_tenants (id) ON DELETE RESTRICT
    );

    -- Record migration application
    INSERT INTO elligble_migration_history (migration_id) VALUES ('0001_bu001_identity_tenant_foundation');
END $$;

COMMIT;
