-- SEC-OPS-001 audited session intervention (record §5/§6A). Adds the provisioning audit action
-- 'sessions_revoked' and a reason column, required for that action. Existing rows and actions
-- are unchanged; the append-only trigger is unchanged.
BEGIN;
DO $migration$
BEGIN
    IF EXISTS (SELECT 1 FROM elligble_migration_history WHERE migration_id = '0059_platform_session_intervention') THEN
        RETURN;
    END IF;

    ALTER TABLE public.platform_provisioning_events
        DROP CONSTRAINT ck_platform_provisioning_action,
        ADD CONSTRAINT ck_platform_provisioning_action CHECK (action IN (
            'tenant_created', 'people_imported', 'activation_reissued', 'academic_imported', 'exam_imported',
            'tenant_time_zone_set', 'assessment_types_added', 'sessions_revoked'
        )),
        ADD COLUMN reason TEXT NULL,
        ADD CONSTRAINT ck_platform_provisioning_reason CHECK (reason IS NULL OR char_length(btrim(reason)) BETWEEN 1 AND 200),
        ADD CONSTRAINT ck_platform_provisioning_reason_required CHECK (action <> 'sessions_revoked' OR reason IS NOT NULL);

    INSERT INTO elligble_migration_history (migration_id) VALUES ('0059_platform_session_intervention');
END; $migration$;
COMMIT;
