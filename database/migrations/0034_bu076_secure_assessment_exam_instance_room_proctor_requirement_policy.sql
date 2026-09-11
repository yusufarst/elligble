-- Migration 0034_bu076_secure_assessment_exam_instance_room_proctor_requirement_policy
-- Target: public.secure_assessment_exam_instances
-- Adds room_based_operations_enabled and proctor_per_room_required columns to support BU-076

DO $$
DECLARE
    v_history_exists BOOLEAN;
    v_room_col_count INT;
    v_room_col_type TEXT;
    v_room_col_nullable TEXT;
    v_room_col_default TEXT;
    v_proctor_col_count INT;
    v_proctor_col_type TEXT;
    v_proctor_col_nullable TEXT;
    v_proctor_col_default TEXT;
    v_con_count INT;
    v_con_valid INT;
    c_expected_condef CONSTANT TEXT := 'CHECK ((((room_based_operations_enabled IS NULL) AND (proctor_per_room_required IS NULL)) OR ((room_based_operations_enabled IS NOT NULL) AND (proctor_per_room_required IS NOT NULL) AND (((room_based_operations_enabled = false) AND (proctor_per_room_required = false)) OR ((room_based_operations_enabled = true) AND (proctor_per_room_required = false)) OR ((room_based_operations_enabled = true) AND (proctor_per_room_required = true))))))';
BEGIN
    -- Check if migration history already exists
    SELECT EXISTS (
        SELECT 1
        FROM public.elligble_migration_history
        WHERE migration_id = '0034_bu076_secure_assessment_exam_instance_room_proctor_requirement_policy'
    ) INTO v_history_exists;

    -- Inspect room_based_operations_enabled column physical contract on target table
    SELECT
        COUNT(*),
        MAX(data_type),
        MAX(is_nullable),
        MAX(column_default)
    INTO
        v_room_col_count,
        v_room_col_type,
        v_room_col_nullable,
        v_room_col_default
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'secure_assessment_exam_instances'
      AND column_name = 'room_based_operations_enabled';

    -- Inspect proctor_per_room_required column physical contract on target table
    SELECT
        COUNT(*),
        MAX(data_type),
        MAX(is_nullable),
        MAX(column_default)
    INTO
        v_proctor_col_count,
        v_proctor_col_type,
        v_proctor_col_nullable,
        v_proctor_col_default
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'secure_assessment_exam_instances'
      AND column_name = 'proctor_per_room_required';

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
    WHERE c.conname = 'ck_sa_exam_instances_room_proctor_requirement_policy';

    IF v_history_exists THEN
        -- Case A: History already exists. Verify exact schema and fail loudly if incompatible.
        IF v_room_col_count <> 1
           OR v_room_col_type <> 'boolean'
           OR v_room_col_nullable <> 'YES'
           OR v_room_col_default IS NOT NULL
           OR v_proctor_col_count <> 1
           OR v_proctor_col_type <> 'boolean'
           OR v_proctor_col_nullable <> 'YES'
           OR v_proctor_col_default IS NOT NULL
           OR v_con_count <> 1
           OR v_con_valid <> 1
        THEN
            RAISE EXCEPTION 'MIGRATION REJECTED: Migration 0034 history exists but physical schema is missing or incompatible (room_col_count=%, room_type=%, room_nullable=%, room_default=%, proctor_col_count=%, proctor_type=%, proctor_nullable=%, proctor_default=%, con_count=%, con_valid=%).',
                v_room_col_count, v_room_col_type, v_room_col_nullable, v_room_col_default,
                v_proctor_col_count, v_proctor_col_type, v_proctor_col_nullable, v_proctor_col_default,
                v_con_count, v_con_valid;
        END IF;

        -- Safe return on exact repeat
        RETURN;
    END IF;

    -- Case B: History does NOT exist yet.

    -- 1. Handle room_based_operations_enabled column
    IF v_room_col_count = 0 THEN
        ALTER TABLE public.secure_assessment_exam_instances
            ADD COLUMN room_based_operations_enabled BOOLEAN NULL;
    ELSE
        IF v_room_col_count <> 1 OR v_room_col_type <> 'boolean' OR v_room_col_nullable <> 'YES' OR v_room_col_default IS NOT NULL THEN
            RAISE EXCEPTION 'MIGRATION REJECTED: Column room_based_operations_enabled exists with incompatible contract (col_count=%, type=%, nullable=%, default=%).',
                v_room_col_count, v_room_col_type, v_room_col_nullable, v_room_col_default;
        END IF;
    END IF;

    -- 2. Handle proctor_per_room_required column
    IF v_proctor_col_count = 0 THEN
        ALTER TABLE public.secure_assessment_exam_instances
            ADD COLUMN proctor_per_room_required BOOLEAN NULL;
    ELSE
        IF v_proctor_col_count <> 1 OR v_proctor_col_type <> 'boolean' OR v_proctor_col_nullable <> 'YES' OR v_proctor_col_default IS NOT NULL THEN
            RAISE EXCEPTION 'MIGRATION REJECTED: Column proctor_per_room_required exists with incompatible contract (col_count=%, type=%, nullable=%, default=%).',
                v_proctor_col_count, v_proctor_col_type, v_proctor_col_nullable, v_proctor_col_default;
        END IF;
    END IF;

    -- 3. Handle constraint
    IF v_con_count = 0 THEN
        ALTER TABLE public.secure_assessment_exam_instances
            ADD CONSTRAINT ck_sa_exam_instances_room_proctor_requirement_policy
            CHECK (
                (room_based_operations_enabled IS NULL AND proctor_per_room_required IS NULL)
                OR
                (
                    room_based_operations_enabled IS NOT NULL
                    AND proctor_per_room_required IS NOT NULL
                    AND (
                        (room_based_operations_enabled = FALSE AND proctor_per_room_required = FALSE)
                        OR
                        (room_based_operations_enabled = TRUE AND proctor_per_room_required = FALSE)
                        OR
                        (room_based_operations_enabled = TRUE AND proctor_per_room_required = TRUE)
                    )
                )
            );
    ELSE
        IF v_con_count <> 1 OR v_con_valid <> 1 THEN
            RAISE EXCEPTION 'MIGRATION REJECTED: Constraint ck_sa_exam_instances_room_proctor_requirement_policy exists with incompatible target, type, or semantics (con_count=%, con_valid=%).',
                v_con_count, v_con_valid;
        END IF;
    END IF;

    -- 4. Register migration history only after exact compatible schema exists
    INSERT INTO public.elligble_migration_history (migration_id)
    VALUES ('0034_bu076_secure_assessment_exam_instance_room_proctor_requirement_policy');

END $$;
