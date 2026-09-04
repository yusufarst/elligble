-- Migration 0030_bu059_secure_assessment_exam_instance_assessment_type_binding
-- Target: public.secure_assessment_exam_instances
-- Binds assessment_type_id for BU-059

DO $$
DECLARE
    v_history_exists BOOLEAN;
    v_col_count INT;
    v_col_type TEXT;
    v_col_nullable TEXT;
    v_col_default TEXT;
    v_idx_count INT;
    v_idx_valid INT;
    v_fk_count INT;
    v_fk_valid INT;
    c_expected_fkdef CONSTANT TEXT := 'FOREIGN KEY (assessment_type_id, tenant_id) REFERENCES secure_assessment_assessment_types(id, tenant_id) ON DELETE RESTRICT';
BEGIN
    -- Check if migration history already exists
    SELECT EXISTS (
        SELECT 1
        FROM public.elligble_migration_history
        WHERE migration_id = '0030_bu059_secure_assessment_exam_instance_assessment_type_binding'
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
      AND column_name = 'assessment_type_id';

    -- Inspect FK constraint
    SELECT
        COUNT(*),
        COUNT(*) FILTER (
            WHERE n.nspname = 'public'
              AND t.relname = 'secure_assessment_exam_instances'
              AND c.contype = 'f'
              AND c.confdeltype = 'r'
              AND pg_get_constraintdef(c.oid) = c_expected_fkdef
        )
    INTO
        v_fk_count,
        v_fk_valid
    FROM pg_constraint c
    LEFT JOIN pg_class t ON c.conrelid = t.oid
    LEFT JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE c.conname = 'fk_sa_exam_instances_assessment_type';

    -- Inspect Index (exact target, exact ordered columns tenant_id, assessment_type_id, non-unique)
    SELECT
        COUNT(*),
        COUNT(*) FILTER (
            WHERE tbl_ns.nspname = 'public'
              AND tbl.relname = 'secure_assessment_exam_instances'
              AND idx_c.relkind = 'i'
              AND i.indisunique = FALSE
              AND (
                  SELECT array_agg(a.attname::text ORDER BY k.ord)
                  FROM unnest(i.indkey) WITH ORDINALITY AS k(attnum, ord)
                  JOIN pg_attribute a ON a.attrelid = tbl.oid AND a.attnum = k.attnum
              ) = ARRAY['tenant_id', 'assessment_type_id']
        )
    INTO
        v_idx_count,
        v_idx_valid
    FROM pg_class idx_c
    JOIN pg_namespace idx_ns ON idx_ns.oid = idx_c.relnamespace
    LEFT JOIN pg_index i ON i.indexrelid = idx_c.oid
    LEFT JOIN pg_class tbl ON tbl.oid = i.indrelid
    LEFT JOIN pg_namespace tbl_ns ON tbl_ns.oid = tbl.relnamespace
    WHERE idx_ns.nspname = 'public'
      AND idx_c.relname = 'idx_sa_exam_instances_tenant_assessment_type';

    IF v_history_exists THEN
        IF v_col_count <> 1
           OR v_col_type <> 'uuid'
           OR v_col_nullable <> 'YES'
           OR v_col_default IS NOT NULL
           OR v_fk_count <> 1
           OR v_fk_valid <> 1
           OR v_idx_count <> 1
           OR v_idx_valid <> 1
        THEN
            RAISE EXCEPTION 'MIGRATION REJECTED: Migration 0030 history exists but physical schema is missing or incompatible (col_count=%, type=%, nullable=%, default=%, fk_count=%, fk_valid=%, idx_count=%, idx_valid=%).',
                v_col_count, v_col_type, v_col_nullable, v_col_default, v_fk_count, v_fk_valid, v_idx_count, v_idx_valid;
        END IF;

        -- Safe return on exact repeat
        RETURN;
    END IF;

    -- 1. Handle column
    IF v_col_count = 0 THEN
        ALTER TABLE public.secure_assessment_exam_instances
            ADD COLUMN assessment_type_id UUID NULL;
    ELSE
        -- Column already exists: verify exact compatibility
        IF v_col_count <> 1 OR v_col_type <> 'uuid' OR v_col_nullable <> 'YES' OR v_col_default IS NOT NULL THEN
            RAISE EXCEPTION 'MIGRATION REJECTED: Column assessment_type_id exists with incompatible contract (col_count=%, type=%, nullable=%, default=%).',
                v_col_count, v_col_type, v_col_nullable, v_col_default;
        END IF;
    END IF;

    -- 2. Handle index
    IF v_idx_count = 0 THEN
        CREATE INDEX idx_sa_exam_instances_tenant_assessment_type ON public.secure_assessment_exam_instances (tenant_id, assessment_type_id);
    ELSE
        -- Index already exists: verify exact compatibility
        IF v_idx_count <> 1 OR v_idx_valid <> 1 THEN
            RAISE EXCEPTION 'MIGRATION REJECTED: Index idx_sa_exam_instances_tenant_assessment_type exists with incompatible target, columns, order, or uniqueness (idx_count=%, idx_valid=%).',
                v_idx_count, v_idx_valid;
        END IF;
    END IF;

    -- 3. Handle FK constraint
    IF v_fk_count = 0 THEN
        ALTER TABLE public.secure_assessment_exam_instances
            ADD CONSTRAINT fk_sa_exam_instances_assessment_type
            FOREIGN KEY (assessment_type_id, tenant_id)
            REFERENCES public.secure_assessment_assessment_types (id, tenant_id)
            ON DELETE RESTRICT;
    ELSE
        -- FK already exists: verify exact compatibility
        IF v_fk_count <> 1 OR v_fk_valid <> 1 THEN
            RAISE EXCEPTION 'MIGRATION REJECTED: Constraint fk_sa_exam_instances_assessment_type exists with incompatible target, type, or semantics (fk_count=%, fk_valid=%).',
                v_fk_count, v_fk_valid;
        END IF;
    END IF;

    -- 4. Register migration history
    INSERT INTO public.elligble_migration_history (migration_id)
    VALUES ('0030_bu059_secure_assessment_exam_instance_assessment_type_binding');

END $$;
