-- Migration 0049: audited assessment types for a school
-- Purpose: the platform operator defines the school's assessment types (D04.2-26 LOCKED:
-- school-friendly categories such as Ulangan Harian, UTS or UAS, labels configurable) while
-- onboarding the school, so teachers can schedule their own exams from the first day
-- (ASSESS-TEACHER-001) without an operator exam import. Teachers choose among these types
-- and never create one. The command is recorded in the provisioning audit like every other.
-- Ownership: Platform Operations (audit action).

BEGIN;

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM elligble_migration_history WHERE migration_id = '0049_platform_provisioning_assessment_types') THEN
        RAISE NOTICE 'Migration 0049_platform_provisioning_assessment_types already applied. Skipping.';
        RETURN;
    END IF;

    ALTER TABLE public.platform_provisioning_events
        DROP CONSTRAINT ck_platform_provisioning_action,
        ADD CONSTRAINT ck_platform_provisioning_action CHECK (action IN (
            'tenant_created', 'people_imported', 'activation_reissued', 'academic_imported', 'exam_imported',
            'tenant_time_zone_set', 'assessment_types_added'
        ));

    INSERT INTO elligble_migration_history (migration_id) VALUES ('0049_platform_provisioning_assessment_types');
END $$;

COMMIT;
