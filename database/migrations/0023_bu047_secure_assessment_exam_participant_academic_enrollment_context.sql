-- Migration 0023: BU-047 Secure Assessment Exam Participant Academic-Enrollment Context Persistence Bootstrap
-- Purpose: Persist the minimum Academic Core enrollment reference needed by an existing Secure Assessment Exam Participant.

BEGIN;

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM elligble_migration_history WHERE migration_id = '0023_bu047_secure_assessment_exam_participant_academic_enrollment_context') THEN
        RAISE NOTICE 'Migration 0023_bu047_secure_assessment_exam_participant_academic_enrollment_context already applied. Skipping.';
        RETURN;
    END IF;

    -- 1. Add academic_enrollment_id UUID NULL to secure_assessment_exam_participants
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'secure_assessment_exam_participants' 
        AND column_name = 'academic_enrollment_id'
    ) THEN
        ALTER TABLE secure_assessment_exam_participants ADD COLUMN academic_enrollment_id UUID NULL;
    END IF;

    -- 2. Add narrowly necessary supporting constraint on academic_core_student_enrollments
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'uq_ac_student_enrollments_id_tenant'
    ) THEN
        ALTER TABLE academic_core_student_enrollments ADD CONSTRAINT uq_ac_student_enrollments_id_tenant UNIQUE (id, tenant_id);
    END IF;

    -- 3. Add tenant-safe composite FK
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'fk_sa_exam_participants_academic_enrollment'
    ) THEN
        ALTER TABLE secure_assessment_exam_participants 
            ADD CONSTRAINT fk_sa_exam_participants_academic_enrollment 
            FOREIGN KEY (academic_enrollment_id, tenant_id) 
            REFERENCES academic_core_student_enrollments(id, tenant_id) 
            ON DELETE RESTRICT;
    END IF;

    -- 4. Add exact normal NON-UNIQUE lookup index
    IF NOT EXISTS (
        SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE c.relname = 'idx_sa_exam_participants_tenant_academic_enrollment' AND n.nspname = 'public'
    ) THEN
        CREATE INDEX idx_sa_exam_participants_tenant_academic_enrollment 
        ON secure_assessment_exam_participants (tenant_id, academic_enrollment_id);
    END IF;

    -- Record migration application
    INSERT INTO elligble_migration_history (migration_id) VALUES ('0023_bu047_secure_assessment_exam_participant_academic_enrollment_context');
END $$;

COMMIT;
