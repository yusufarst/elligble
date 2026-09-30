-- Migration 0036: Tenant display label
-- Purpose: human-readable school label for explicit tenant context in the UI
-- (D02.2-20 "Tenant Context Must Be Explicit in Sessions"; D02.2-05 human-readable
-- identity separate from the immutable tenant id). Ownership: Organization/Tenant.

BEGIN;

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM elligble_migration_history WHERE migration_id = '0036_tenant_display_label') THEN
        RAISE NOTICE 'Migration 0036_tenant_display_label already applied. Skipping.';
        RETURN;
    END IF;

    ALTER TABLE public.tenant_tenants
        ADD COLUMN IF NOT EXISTS display_label TEXT NULL;

    ALTER TABLE public.tenant_tenants
        ADD CONSTRAINT ck_tenant_tenants_display_label_not_blank
        CHECK (display_label IS NULL OR (length(btrim(display_label)) > 0 AND length(display_label) <= 200));

    INSERT INTO elligble_migration_history (migration_id) VALUES ('0036_tenant_display_label');
END $$;

COMMIT;
