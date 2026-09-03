BEGIN;

DO $$
DECLARE
  v_pair_constraint_count INT;
  v_order_constraint_count INT;
BEGIN
  -- 1. Check if migration is already applied
  IF EXISTS (SELECT 1 FROM elligble_migration_history WHERE migration_id = '0026_bu054_secure_assessment_exam_instance_operational_window') THEN
    RETURN;
  END IF;

  -- 2. Add window_starts_at column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'secure_assessment_exam_instances'
      AND column_name = 'window_starts_at'
  ) THEN
    ALTER TABLE public.secure_assessment_exam_instances
    ADD COLUMN window_starts_at TIMESTAMP WITH TIME ZONE NULL;
  END IF;

  -- 3. Add window_ends_at column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'secure_assessment_exam_instances'
      AND column_name = 'window_ends_at'
  ) THEN
    ALTER TABLE public.secure_assessment_exam_instances
    ADD COLUMN window_ends_at TIMESTAMP WITH TIME ZONE NULL;
  END IF;

  -- 4. Check for existing ck_sa_exam_instances_window_pair constraint
  SELECT COUNT(*)
  INTO v_pair_constraint_count
  FROM pg_constraint c
  JOIN pg_class t ON c.conrelid = t.oid
  JOIN pg_namespace n ON n.oid = t.relnamespace
  WHERE c.conname = 'ck_sa_exam_instances_window_pair'
    AND t.relname = 'secure_assessment_exam_instances'
    AND n.nspname = 'public';

  IF v_pair_constraint_count = 0 THEN
    ALTER TABLE public.secure_assessment_exam_instances
    ADD CONSTRAINT ck_sa_exam_instances_window_pair CHECK (
      (window_starts_at IS NULL AND window_ends_at IS NULL)
      OR
      (window_starts_at IS NOT NULL AND window_ends_at IS NOT NULL)
    );
  END IF;

  -- 5. Check for existing ck_sa_exam_instances_window_order constraint
  SELECT COUNT(*)
  INTO v_order_constraint_count
  FROM pg_constraint c
  JOIN pg_class t ON c.conrelid = t.oid
  JOIN pg_namespace n ON n.oid = t.relnamespace
  WHERE c.conname = 'ck_sa_exam_instances_window_order'
    AND t.relname = 'secure_assessment_exam_instances'
    AND n.nspname = 'public';

  IF v_order_constraint_count = 0 THEN
    ALTER TABLE public.secure_assessment_exam_instances
    ADD CONSTRAINT ck_sa_exam_instances_window_order CHECK (
      window_starts_at IS NULL
      OR
      window_ends_at IS NULL
      OR
      window_starts_at < window_ends_at
    );
  END IF;

  -- 6. Record migration
  INSERT INTO elligble_migration_history (migration_id, applied_at)
  VALUES ('0026_bu054_secure_assessment_exam_instance_operational_window', NOW());

END $$;

COMMIT;
