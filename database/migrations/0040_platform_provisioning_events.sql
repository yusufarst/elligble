-- Migration 0040: platform provisioning audit
-- Purpose: every operator provisioning action (school creation, account import, activation
-- reissue, academic setup, exam import) is attributable, case-linked and append-only, never
-- an invisible superuser shortcut (D02.2-27/28, D03.7-44/45). Summaries hold counts and
-- identifiers only, never personal data.
-- Ownership: Platform Operations.

BEGIN;

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM elligble_migration_history WHERE migration_id = '0040_platform_provisioning_events') THEN
        RAISE NOTICE 'Migration 0040_platform_provisioning_events already applied. Skipping.';
        RETURN;
    END IF;

    CREATE TABLE public.platform_provisioning_events (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        batch_id UUID NOT NULL,
        tenant_id UUID NULL,
        operator_label TEXT NOT NULL,
        case_reference TEXT NOT NULL,
        action TEXT NOT NULL,
        input_sha256 CHAR(64) NULL,
        summary JSONB NOT NULL DEFAULT '{}'::jsonb,
        occurred_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT ck_platform_provisioning_operator CHECK (length(btrim(operator_label)) BETWEEN 1 AND 200),
        CONSTRAINT ck_platform_provisioning_case CHECK (length(btrim(case_reference)) BETWEEN 1 AND 200),
        CONSTRAINT ck_platform_provisioning_action CHECK (action IN (
            'tenant_created', 'people_imported', 'activation_reissued', 'academic_imported', 'exam_imported'
        )),
        CONSTRAINT ck_platform_provisioning_sha CHECK (input_sha256 IS NULL OR input_sha256 ~ '^[0-9a-f]{64}$')
    );

    CREATE INDEX idx_platform_provisioning_events_tenant
        ON public.platform_provisioning_events (tenant_id, occurred_at);

    CREATE FUNCTION public.prevent_platform_provisioning_event_mutation()
    RETURNS TRIGGER AS $trg$
    BEGIN
        RAISE EXCEPTION 'Platform provisioning events are append-only.';
    END;
    $trg$ LANGUAGE plpgsql;

    CREATE TRIGGER trg_platform_provisioning_events_append_only
        BEFORE UPDATE OR DELETE ON public.platform_provisioning_events
        FOR EACH ROW EXECUTE FUNCTION public.prevent_platform_provisioning_event_mutation();

    INSERT INTO elligble_migration_history (migration_id) VALUES ('0040_platform_provisioning_events');
END $$;

COMMIT;
