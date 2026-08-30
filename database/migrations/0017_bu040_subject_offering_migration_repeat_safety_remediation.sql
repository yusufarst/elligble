-- Migration 0017: BU-040 Subject Offering Migration Repeat Safety Remediation
-- Purpose: Remediate Migration 0016 history repeat safety via targeted narrow trigger guard

BEGIN;

CREATE OR REPLACE FUNCTION fn_bu040_0016_history_repeat_guard()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.migration_id = '0016_bu040_academic_core_subject_offering_core_state' THEN
        IF EXISTS (
            SELECT 1 
            FROM elligble_migration_history 
            WHERE migration_id = '0016_bu040_academic_core_subject_offering_core_state'
        ) THEN
            RETURN NULL;
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_bu040_0016_history_repeat_guard ON elligble_migration_history;

CREATE TRIGGER trg_bu040_0016_history_repeat_guard
BEFORE INSERT ON elligble_migration_history
FOR EACH ROW
EXECUTE FUNCTION fn_bu040_0016_history_repeat_guard();

-- Register 0017 repeat-safely
INSERT INTO elligble_migration_history (migration_id, applied_at)
SELECT '0017_bu040_subject_offering_migration_repeat_safety_remediation', CURRENT_TIMESTAMP
WHERE NOT EXISTS (
    SELECT 1 FROM elligble_migration_history
    WHERE migration_id = '0017_bu040_subject_offering_migration_repeat_safety_remediation'
);

COMMIT;
