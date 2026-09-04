-- Migration 0029_bu058_secure_assessment_assessment_type_taxonomy_core_state
-- Target: public.secure_assessment_assessment_types
-- Persists tenant-scoped Assessment Type taxonomy core state for BU-058

DO $$
DECLARE
    v_history_exists BOOLEAN;
    v_table_exists BOOLEAN;
    v_id_ok BOOLEAN;
    v_tenant_id_ok BOOLEAN;
    v_display_label_ok BOOLEAN;
    v_created_at_ok BOOLEAN;
    v_pk_ok BOOLEAN;
    v_uq_ok BOOLEAN;
    v_ck_ok BOOLEAN;
    v_fk_count INT;
    v_schema_is_compatible BOOLEAN;
    c_expected_ck_def CONSTANT TEXT := 'CHECK ((btrim((display_label)::text) <> ''''::text))';
    c_expected_uq_def CONSTANT TEXT := 'UNIQUE (id, tenant_id)';
    c_expected_pk_def CONSTANT TEXT := 'PRIMARY KEY (id)';
BEGIN
    -- 1. Check if migration history already exists
    SELECT EXISTS (
        SELECT 1
        FROM public.elligble_migration_history
        WHERE migration_id = '0029_bu058_secure_assessment_assessment_type_taxonomy_core_state'
    ) INTO v_history_exists;

    -- 2. Check if table exists as BASE TABLE in public schema
    SELECT EXISTS (
        SELECT 1
        FROM information_schema.tables
        WHERE table_schema = 'public'
          AND table_name = 'secure_assessment_assessment_types'
          AND table_type = 'BASE TABLE'
    ) INTO v_table_exists;

    IF v_table_exists THEN
        -- Check column id
        SELECT EXISTS (
            SELECT 1
            FROM information_schema.columns
            WHERE table_schema = 'public'
              AND table_name = 'secure_assessment_assessment_types'
              AND column_name = 'id'
              AND data_type = 'uuid'
              AND is_nullable = 'NO'
              AND column_default LIKE '%gen_random_uuid%'
        ) INTO v_id_ok;

        -- Check column tenant_id
        SELECT EXISTS (
            SELECT 1
            FROM information_schema.columns
            WHERE table_schema = 'public'
              AND table_name = 'secure_assessment_assessment_types'
              AND column_name = 'tenant_id'
              AND data_type = 'uuid'
              AND is_nullable = 'NO'
              AND column_default IS NULL
        ) INTO v_tenant_id_ok;

        -- Check column display_label
        SELECT EXISTS (
            SELECT 1
            FROM information_schema.columns
            WHERE table_schema = 'public'
              AND table_name = 'secure_assessment_assessment_types'
              AND column_name = 'display_label'
              AND data_type = 'character varying'
              AND character_maximum_length = 255
              AND is_nullable = 'NO'
              AND column_default IS NULL
        ) INTO v_display_label_ok;

        -- Check column created_at
        SELECT EXISTS (
            SELECT 1
            FROM information_schema.columns
            WHERE table_schema = 'public'
              AND table_name = 'secure_assessment_assessment_types'
              AND column_name = 'created_at'
              AND data_type = 'timestamp with time zone'
              AND is_nullable = 'NO'
              AND column_default IS NOT NULL
        ) INTO v_created_at_ok;

        -- Check PK constraint
        SELECT EXISTS (
            SELECT 1
            FROM pg_constraint c
            JOIN pg_class t ON c.conrelid = t.oid
            JOIN pg_namespace n ON n.oid = t.relnamespace
            WHERE n.nspname = 'public'
              AND t.relname = 'secure_assessment_assessment_types'
              AND c.contype = 'p'
              AND pg_get_constraintdef(c.oid) = c_expected_pk_def
        ) INTO v_pk_ok;

        -- Check unique constraint uq_sa_assessment_types_tenant
        -- Also ensure no constraint with this name exists on any other table
        SELECT (
            COUNT(*) = 1 AND
            COUNT(*) FILTER (
                WHERE n.nspname = 'public'
                  AND t.relname = 'secure_assessment_assessment_types'
                  AND c.contype = 'u'
                  AND pg_get_constraintdef(c.oid) = c_expected_uq_def
            ) = 1
        ) INTO v_uq_ok
        FROM pg_constraint c
        LEFT JOIN pg_class t ON c.conrelid = t.oid
        LEFT JOIN pg_namespace n ON n.oid = t.relnamespace
        WHERE c.conname = 'uq_sa_assessment_types_tenant';

        -- Check check constraint ck_sa_assessment_types_display_label_non_blank
        -- Also ensure no constraint with this name exists on any other table
        SELECT (
            COUNT(*) = 1 AND
            COUNT(*) FILTER (
                WHERE n.nspname = 'public'
                  AND t.relname = 'secure_assessment_assessment_types'
                  AND c.contype = 'c'
                  AND pg_get_constraintdef(c.oid) = c_expected_ck_def
            ) = 1
        ) INTO v_ck_ok
        FROM pg_constraint c
        LEFT JOIN pg_class t ON c.conrelid = t.oid
        LEFT JOIN pg_namespace n ON n.oid = t.relnamespace
        WHERE c.conname = 'ck_sa_assessment_types_display_label_non_blank';

        -- Check zero FKs on table
        SELECT COUNT(*)
        INTO v_fk_count
        FROM pg_constraint c
        JOIN pg_class t ON c.conrelid = t.oid
        JOIN pg_namespace n ON n.oid = t.relnamespace
        WHERE n.nspname = 'public'
          AND t.relname = 'secure_assessment_assessment_types'
          AND c.contype = 'f';

        v_schema_is_compatible := (
            v_id_ok AND
            v_tenant_id_ok AND
            v_display_label_ok AND
            v_created_at_ok AND
            v_pk_ok AND
            v_uq_ok AND
            v_ck_ok AND
            v_fk_count = 0
        );
    ELSE
        v_schema_is_compatible := FALSE;
    END IF;

    -- Scenario D: History exists
    IF v_history_exists THEN
        IF NOT v_table_exists OR NOT v_schema_is_compatible THEN
            RAISE EXCEPTION 'MIGRATION REJECTED: Migration 0029 history exists but physical schema is missing or incompatible (table_exists=%, id=%, tenant=%, label=%, created=%, pk=%, uq=%, ck=%, fks=%).',
                v_table_exists, v_id_ok, v_tenant_id_ok, v_display_label_ok, v_created_at_ok, v_pk_ok, v_uq_ok, v_ck_ok, v_fk_count;
        END IF;
        -- Safe return on exact repeat
        RETURN;
    END IF;

    -- Scenario B & C: History does NOT exist, but table exists
    IF v_table_exists THEN
        IF NOT v_schema_is_compatible THEN
            RAISE EXCEPTION 'MIGRATION REJECTED: Table public.secure_assessment_assessment_types pre-exists with incompatible contract (id=%, tenant=%, label=%, created=%, pk=%, uq=%, ck=%, fks=%).',
                v_id_ok, v_tenant_id_ok, v_display_label_ok, v_created_at_ok, v_pk_ok, v_uq_ok, v_ck_ok, v_fk_count;
        END IF;

        -- Compatible pre-existing table: register migration history
        INSERT INTO public.elligble_migration_history (migration_id)
        VALUES ('0029_bu058_secure_assessment_assessment_type_taxonomy_core_state');
        RETURN;
    END IF;

    -- Scenario A: History absent + table absent
    -- Check if constraint names collide with existing constraints elsewhere
    IF EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname IN ('uq_sa_assessment_types_tenant', 'ck_sa_assessment_types_display_label_non_blank')
    ) THEN
        RAISE EXCEPTION 'MIGRATION REJECTED: Constraint name collision with existing constraint on another relation.';
    END IF;

    CREATE TABLE public.secure_assessment_assessment_types (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id UUID NOT NULL,
        display_label VARCHAR(255) NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT uq_sa_assessment_types_tenant UNIQUE (id, tenant_id),
        CONSTRAINT ck_sa_assessment_types_display_label_non_blank CHECK (btrim(display_label) <> '')
    );

    INSERT INTO public.elligble_migration_history (migration_id)
    VALUES ('0029_bu058_secure_assessment_assessment_type_taxonomy_core_state');

END $$;
