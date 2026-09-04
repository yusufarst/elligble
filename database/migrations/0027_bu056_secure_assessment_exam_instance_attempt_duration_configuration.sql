-- Migration 0027: BU-056 Secure Assessment Exam Instance Attempt Duration Configuration Persistence Bootstrap

DO $$
BEGIN

    IF EXISTS (
      SELECT 1
      FROM elligble_migration_history
      WHERE migration_id =
        '0027_bu056_secure_assessment_exam_instance_attempt_duration_configuration'
    )
    THEN
      RETURN;
    END IF;

    -- 1. Add column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'secure_assessment_exam_instances'
          AND column_name = 'configured_attempt_duration_seconds'
    ) THEN
        ALTER TABLE public.secure_assessment_exam_instances
        ADD COLUMN configured_attempt_duration_seconds INTEGER NULL;
    END IF;

    -- 2. Add exact constraint if it doesn't exist
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.table_constraints
        WHERE table_schema = 'public'
          AND table_name = 'secure_assessment_exam_instances'
          AND constraint_name = 'ck_sa_exam_instances_attempt_duration_positive'
    ) THEN
        ALTER TABLE public.secure_assessment_exam_instances
        ADD CONSTRAINT ck_sa_exam_instances_attempt_duration_positive
        CHECK (
            configured_attempt_duration_seconds IS NULL
            OR configured_attempt_duration_seconds > 0
        );
    END IF;

    INSERT INTO elligble_migration_history (migration_id, applied_at)
    VALUES (
      '0027_bu056_secure_assessment_exam_instance_attempt_duration_configuration',
      NOW()
    );

END $$;
