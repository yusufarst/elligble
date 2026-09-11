BEGIN;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM public.elligble_migration_history WHERE migration_id = '0032_bu072_secure_assessment_exam_participant_room_assignment_core_state') THEN

        ALTER TABLE public.secure_assessment_exam_participants
            ADD CONSTRAINT uq_sa_exam_participant_id_tenant_instance
            UNIQUE (id, tenant_id, exam_instance_id);

        ALTER TABLE public.secure_assessment_exam_rooms
            ADD CONSTRAINT uq_sa_exam_room_id_tenant_instance
            UNIQUE (id, tenant_id, exam_instance_id);

        CREATE TABLE public.secure_assessment_exam_participant_room_assignments (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            tenant_id UUID NOT NULL,
            exam_instance_id UUID NOT NULL,
            exam_participant_id UUID NOT NULL,
            exam_room_id UUID NOT NULL,
            assigned_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
            CONSTRAINT uq_sa_exam_participant_room_assignment_tenant
                UNIQUE (id, tenant_id),
            CONSTRAINT uq_sa_exam_participant_room_assignment_participant
                UNIQUE (tenant_id, exam_instance_id, exam_participant_id),
            CONSTRAINT fk_sa_exam_participant_room_assignment_participant
                FOREIGN KEY (exam_participant_id, tenant_id, exam_instance_id)
                REFERENCES public.secure_assessment_exam_participants (id, tenant_id, exam_instance_id)
                ON DELETE RESTRICT,
            CONSTRAINT fk_sa_exam_participant_room_assignment_room
                FOREIGN KEY (exam_room_id, tenant_id, exam_instance_id)
                REFERENCES public.secure_assessment_exam_rooms (id, tenant_id, exam_instance_id)
                ON DELETE RESTRICT
        );

        INSERT INTO public.elligble_migration_history (migration_id)
        VALUES ('0032_bu072_secure_assessment_exam_participant_room_assignment_core_state');

    END IF;
END
$$;

COMMIT;
