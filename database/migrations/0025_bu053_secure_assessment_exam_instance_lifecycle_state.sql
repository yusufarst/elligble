BEGIN;

DO $$
DECLARE
  v_constraint_count INT;
BEGIN
  -- 1. Check if migration is already applied
  IF EXISTS (SELECT 1 FROM elligble_migration_history WHERE migration_id = '0025_bu053_secure_assessment_exam_instance_lifecycle_state') THEN
    RETURN;
  END IF;

  -- 2. Add column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'secure_assessment_exam_instances'
      AND column_name = 'lifecycle_state'
  ) THEN
    ALTER TABLE public.secure_assessment_exam_instances
    ADD COLUMN lifecycle_state TEXT NOT NULL DEFAULT 'DRAFT';
  END IF;

  -- 3. Check for existing constraint with the same name
  SELECT COUNT(*)
  INTO v_constraint_count
  FROM pg_constraint c
  JOIN pg_class t ON c.conrelid = t.oid
  JOIN pg_namespace n ON n.oid = t.relnamespace
  WHERE c.conname = 'ck_sa_exam_instances_lifecycle_state'
    AND t.relname = 'secure_assessment_exam_instances'
    AND n.nspname = 'public';

  IF v_constraint_count = 0 THEN
    -- 4. Add the constraint
    ALTER TABLE public.secure_assessment_exam_instances
    ADD CONSTRAINT ck_sa_exam_instances_lifecycle_state CHECK (
      lifecycle_state IN (
        'DRAFT',
        'SCHEDULED',
        'READY',
        'ACTIVE',
        'PAUSED',
        'ENDED',
        'FINALIZED',
        'ARCHIVED'
      )
    );
  END IF;

  -- 5. Record migration
  INSERT INTO elligble_migration_history (migration_id, applied_at)
  VALUES ('0025_bu053_secure_assessment_exam_instance_lifecycle_state', NOW());

END $$;

COMMIT;
