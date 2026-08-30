-- Migration 0013: BU-037 Academic Core Subject Display Label Integrity Remediation
-- Purpose: Forward-correct BU-037 Subject identity integrity by ensuring display_label is not empty or whitespace-only.

BEGIN;

DO $$
DECLARE
    v_violating_count INTEGER;
BEGIN
    IF EXISTS (SELECT 1 FROM elligble_migration_history WHERE migration_id = '0013_bu037_academic_core_subject_display_label_integrity_remediation') THEN
        RAISE NOTICE 'Migration 0013_bu037_academic_core_subject_display_label_integrity_remediation already applied. Skipping.';
        RETURN;
    END IF;

    -- 1. Precheck: verify no existing row in academic_core_subjects has empty/whitespace-only display_label
    SELECT count(*) INTO v_violating_count
    FROM academic_core_subjects
    WHERE btrim(display_label) = '';

    IF v_violating_count > 0 THEN
        RAISE EXCEPTION 'Cannot apply migration 0013: % existing row(s) in academic_core_subjects have blank display_label', v_violating_count;
    END IF;

    -- 2. Add CHECK constraint ensuring display_label contains at least one non-whitespace character
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'chk_ac_subject_display_label_non_blank'
    ) THEN
        ALTER TABLE academic_core_subjects
            ADD CONSTRAINT chk_ac_subject_display_label_non_blank
            CHECK (btrim(display_label) <> '');
    END IF;

    -- Record migration application
    INSERT INTO elligble_migration_history (migration_id) VALUES ('0013_bu037_academic_core_subject_display_label_integrity_remediation');
END $$;

COMMIT;
