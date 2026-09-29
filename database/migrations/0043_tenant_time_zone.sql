-- Migration 0043: the school's time zone
-- Purpose: exam dates and times are shown in the school's own time zone, never in whatever
-- zone a device happens to be set to (D04.2-36; D04.2-35 keeps the server clock
-- authoritative). The zone is an IANA name (Asia/Jakarta for WIB, Asia/Makassar for WITA,
-- Asia/Jayapura for WIT), set explicitly by the platform operator when the school is created
-- and changed only through the audited provisioning command. Schools created before this
-- migration have none until the operator sets it.
-- Ownership: Tenant & Access (column); Platform Operations (audit action).

BEGIN;

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM elligble_migration_history WHERE migration_id = '0043_tenant_time_zone') THEN
        RAISE NOTICE 'Migration 0043_tenant_time_zone already applied. Skipping.';
        RETURN;
    END IF;

    ALTER TABLE public.tenant_tenants
        ADD COLUMN time_zone VARCHAR(64) NULL,
        ADD CONSTRAINT ck_tenant_tenants_time_zone_format
            CHECK (time_zone IS NULL OR time_zone ~ '^[A-Za-z][A-Za-z0-9_+-]*(/[A-Za-z0-9_+-]+)*$');

    ALTER TABLE public.platform_provisioning_events
        DROP CONSTRAINT ck_platform_provisioning_action,
        ADD CONSTRAINT ck_platform_provisioning_action CHECK (action IN (
            'tenant_created', 'people_imported', 'activation_reissued', 'academic_imported', 'exam_imported',
            'tenant_time_zone_set'
        ));

    INSERT INTO elligble_migration_history (migration_id) VALUES ('0043_tenant_time_zone');
END $$;

COMMIT;
