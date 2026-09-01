-- Migration 0022 - BU-046 Academic Core Student Enrollment Retrieval Index Remediation
-- This migration adds materially necessary non-unique retrieval indexes for Academic Enrollment.
-- It is designed to be idempotent (repeat-safe).

BEGIN;

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM elligble_migration_history WHERE migration_id = '0022_bu046_academic_core_student_enrollment_retrieval_index_remediation') THEN
        RAISE NOTICE 'Migration 0022_bu046_academic_core_student_enrollment_retrieval_index_remediation already applied. Skipping.';
        RETURN;
    END IF;

    -- Add retrieval index for roster/enrollment lookup (tenant + academic period + academic group)
    IF NOT EXISTS (
        SELECT 1
        FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE c.relname = 'idx_ac_student_enrollments_tenant_period_group'
          AND n.nspname = 'public'
    ) THEN
        CREATE INDEX idx_ac_student_enrollments_tenant_period_group
        ON academic_core_student_enrollments (tenant_id, academic_period_id, academic_group_id);
    END IF;

    -- Add retrieval index for placement lookup (tenant + membership + academic period)
    IF NOT EXISTS (
        SELECT 1
        FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE c.relname = 'idx_ac_student_enrollments_tenant_membership_period'
          AND n.nspname = 'public'
    ) THEN
        CREATE INDEX idx_ac_student_enrollments_tenant_membership_period
        ON academic_core_student_enrollments (tenant_id, membership_id, academic_period_id);
    END IF;

    INSERT INTO elligble_migration_history (migration_id) VALUES ('0022_bu046_academic_core_student_enrollment_retrieval_index_remediation');
END $$;

COMMIT;
