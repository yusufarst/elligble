BEGIN;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM public.elligble_migration_history WHERE migration_id = '0031_bu071_secure_assessment_exam_room_core_state') THEN

        CREATE TABLE public.secure_assessment_exam_rooms (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            tenant_id UUID NOT NULL,
            exam_instance_id UUID NOT NULL,
            display_label TEXT NOT NULL,
            created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
            CONSTRAINT uq_sa_exam_room UNIQUE (id, tenant_id),
            CONSTRAINT fk_sa_exam_room_exam_instance
                FOREIGN KEY (exam_instance_id, tenant_id)
                REFERENCES public.secure_assessment_exam_instances (id, tenant_id)
                ON DELETE RESTRICT
        );

        INSERT INTO public.elligble_migration_history (migration_id)
        VALUES ('0031_bu071_secure_assessment_exam_room_core_state');

    END IF;
END
$$;

COMMIT;
