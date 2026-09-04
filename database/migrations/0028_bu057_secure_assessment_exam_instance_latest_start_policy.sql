-- Migration 0028_bu057_secure_assessment_exam_instance_latest_start_policy
-- Target: public.secure_assessment_exam_instances
-- Adds latest_start_policy column to support BU-057

DO $$
DECLARE
    v_history_exists BOOLEAN;
    v_col_count INT;
    v_col_type TEXT;
    v_col_nullable TEXT;
    v_col_default TEXT;
    v_con_count INT;
    v_con_valid INT;
    c_expected_condef CONSTANT TEXT := 'CHECK (((latest_start_policy IS NULL) OR (latest_start_policy = ANY (ARRAY[''FULL_DURATION_BEYOND_WINDOW''::text, ''REMAINING_WINDOW_ONLY''::text, ''LATE_START_BLOCKED''::text]))))';
BEGIN
    -- Check if migration history already exists
    SELECT EXISTS (
        SELECT 1
        FROM public.elligble_migration_history
        WHERE migration_id = '0028_bu057_secure_assessment_exam_instance_latest_start_policy'
    ) INTO v_history_exists;

    -- Inspect column physical contract on target table
    SELECT
        COUNT(*),
        MAX(data_type),
        MAX(is_nullable),
        MAX(column_default)
    INTO
        v_col_count,
        v_col_type,
        v_col_nullable,
        v_col_default
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'secure_assessment_exam_instances'
      AND column_name = 'latest_start_policy';

    -- Inspect constraint contract across database
    SELECT
        COUNT(*),
        COUNT(*) FILTER (
            WHERE n.nspname = 'public'
              AND t.relname = 'secure_assessment_exam_instances'
              AND c.contype = 'c'
              AND pg_get_constraintdef(c.oid) = c_expected_condef
        )
    INTO
        v_con_count,
        v_con_valid
    FROM pg_constraint c
    LEFT JOIN pg_class t ON c.conrelid = t.oid
    LEFT JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE c.conname = 'ck_sa_exam_instances_latest_start_policy';

    IF v_history_exists THEN
        -- Case A: History already exists. Verify exact schema and fail loudly if incompatible.
        IF v_col_count <> 1
           OR v_col_type <> 'text'
           OR v_col_nullable <> 'YES'
           OR v_col_default IS NOT NULL
           OR v_con_count <> 1
           OR v_con_valid <> 1
        THEN
            RAISE EXCEPTION 'MIGRATION REJECTED: Migration 0028 history exists but physical schema is missing or incompatible (col_count=%, type=%, nullable=%, default=%, con_count=%, con_valid=%).',
                v_col_count, v_col_type, v_col_nullable, v_col_default, v_con_count, v_con_valid;
        END IF;

        -- Safe return on exact repeat
        RETURN;
    END IF;

    -- Case B / C / D: History does NOT exist yet.

    -- 1. Handle column
    IF v_col_count = 0 THEN
        ALTER TABLE public.secure_assessment_exam_instances
            ADD COLUMN latest_start_policy TEXT NULL;
    ELSE
        -- Column already exists: verify exact compatibility
        IF v_col_type <> 'text' OR v_col_nullable <> 'YES' OR v_col_default IS NOT NULL THEN
            RAISE EXCEPTION 'MIGRATION REJECTED: Column latest_start_policy exists with incompatible contract (type=%, nullable=%, default=%).',
                v_col_type, v_col_nullable, v_col_default;
        END IF;
    END IF;

    -- 2. Handle constraint
    IF v_con_count = 0 THEN
        ALTER TABLE public.secure_assessment_exam_instances
            ADD CONSTRAINT ck_sa_exam_instances_latest_start_policy
            CHECK (
                latest_start_policy IS NULL
                OR latest_start_policy IN (
                    'FULL_DURATION_BEYOND_WINDOW',
                    'REMAINING_WINDOW_ONLY',
                    'LATE_START_BLOCKED'
                )
            );
    ELSE
        -- Constraint already exists: verify exact target table, public schema, check type, and semantics
        IF v_con_count <> 1 OR v_con_valid <> 1 THEN
            RAISE EXCEPTION 'MIGRATION REJECTED: Constraint ck_sa_exam_instances_latest_start_policy exists with incompatible target, type, or semantics (con_count=%, con_valid=%).',
                v_con_count, v_con_valid;
        END IF;
    END IF;

    -- 3. Register migration history only after exact compatible schema exists
    INSERT INTO public.elligble_migration_history (migration_id)
    VALUES ('0028_bu057_secure_assessment_exam_instance_latest_start_policy');

END $$;
