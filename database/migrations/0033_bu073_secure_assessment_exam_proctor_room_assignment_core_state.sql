BEGIN;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM public.elligble_migration_history WHERE migration_id = '0033_bu073_secure_assessment_exam_proctor_room_assignment_core_state') THEN

        ALTER TABLE public.secure_assessment_proctor_assignments
            ADD CONSTRAINT uq_sa_proctor_assignment_id_tenant_instance
            UNIQUE (id, tenant_id, exam_instance_id);

        CREATE TABLE public.secure_assessment_exam_proctor_room_assignments (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            tenant_id UUID NOT NULL,
            exam_instance_id UUID NOT NULL,
            proctor_assignment_id UUID NOT NULL,
            exam_room_id UUID NOT NULL,
            assigned_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
            CONSTRAINT uq_sa_exam_proctor_room_assignment_tenant
                UNIQUE (id, tenant_id),
            CONSTRAINT uq_sa_exam_proctor_room_assignment_mapping
                UNIQUE (tenant_id, exam_instance_id, proctor_assignment_id, exam_room_id),
            CONSTRAINT fk_sa_exam_proctor_room_assignment_proctor
                FOREIGN KEY (proctor_assignment_id, tenant_id, exam_instance_id)
                REFERENCES public.secure_assessment_proctor_assignments (id, tenant_id, exam_instance_id)
                ON DELETE RESTRICT,
            CONSTRAINT fk_sa_exam_proctor_room_assignment_room
                FOREIGN KEY (exam_room_id, tenant_id, exam_instance_id)
                REFERENCES public.secure_assessment_exam_rooms (id, tenant_id, exam_instance_id)
                ON DELETE RESTRICT
        );

        INSERT INTO public.elligble_migration_history (migration_id)
        VALUES ('0033_bu073_secure_assessment_exam_proctor_room_assignment_core_state');

    END IF;
END
$$;

COMMIT;
