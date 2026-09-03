BEGIN;

DO $$
DECLARE
  v_dup_count INT;
  v_constraint_count INT;
  v_exact_match INT;
BEGIN
  -- 1. Check if migration is already applied
  IF EXISTS (SELECT 1 FROM elligble_migration_history WHERE migration_id = '0024_bu051_secure_assessment_exam_participant_concurrency_safe_uniqueness') THEN
    RETURN;
  END IF;

  -- 2. Detect pre-existing duplicates
  SELECT COUNT(*)
  INTO v_dup_count
  FROM (
    SELECT tenant_id, exam_instance_id, person_id
    FROM public.secure_assessment_exam_participants
    GROUP BY tenant_id, exam_instance_id, person_id
    HAVING COUNT(*) > 1
  ) AS dupes;

  IF v_dup_count > 0 THEN
    RAISE EXCEPTION 'MIGRATION REJECTED: Pre-existing duplicate exam participants found for tenant_id, exam_instance_id, person_id.';
  END IF;

  -- 3. Check for existing constraint with the same name on the intended target
  SELECT COUNT(*)
  INTO v_constraint_count
  FROM pg_constraint c
  JOIN pg_class t ON c.conrelid = t.oid
  JOIN pg_namespace n ON n.oid = t.relnamespace
  WHERE c.conname = 'uq_sa_exam_participants_tenant_instance_person'
    AND t.relname = 'secure_assessment_exam_participants'
    AND n.nspname = 'public';

  IF v_constraint_count > 0 THEN
    -- Check if it matches exactly
    SELECT COUNT(*)
    INTO v_exact_match
    FROM pg_constraint c
    JOIN pg_class t ON c.conrelid = t.oid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE c.conname = 'uq_sa_exam_participants_tenant_instance_person'
      AND c.contype = 'u'
      AND t.relname = 'secure_assessment_exam_participants'
      AND n.nspname = 'public'
      AND (
        SELECT array_agg(attname ORDER BY array_position(c.conkey, attnum))
        FROM pg_attribute
        WHERE attrelid = t.oid AND attnum = ANY(c.conkey)
      ) = ARRAY['tenant_id', 'exam_instance_id', 'person_id']::name[];

    IF v_exact_match = 0 THEN
      RAISE EXCEPTION 'MIGRATION REJECTED: Constraint uq_sa_exam_participants_tenant_instance_person already exists but with incorrect semantics.';
    END IF;
  ELSE
    -- 4. Add the constraint
    ALTER TABLE public.secure_assessment_exam_participants
    ADD CONSTRAINT uq_sa_exam_participants_tenant_instance_person UNIQUE (tenant_id, exam_instance_id, person_id);
  END IF;

  -- 5. Record migration
  INSERT INTO elligble_migration_history (migration_id, applied_at)
  VALUES ('0024_bu051_secure_assessment_exam_participant_concurrency_safe_uniqueness', NOW());

END $$;

COMMIT;
