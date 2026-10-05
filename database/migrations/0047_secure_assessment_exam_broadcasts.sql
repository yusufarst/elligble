-- Migration 0047: exam broadcast messages
-- Purpose: an authorized supervisor sends a short operational message to the participants of
-- a running exam (D04.1-77A/B, D04.6-49 LOCKED: entire exam, one exam room or selected
-- participants, within the sender's supervision scope). Each broadcast records its sender,
-- target, message and time (D04.1-77E, D04.6-54); its recipients are fixed when it is sent
-- and each recipient row records when the student's device confirmed receiving it, the
-- technical delivery state (D04.6-53: delivered to the device, never "read").
-- Ownership: Secure Assessment. Broadcasts are never changed or deleted; a recipient row only
-- gains its delivery time, once.

BEGIN;

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM elligble_migration_history WHERE migration_id = '0047_secure_assessment_exam_broadcasts') THEN
        RAISE NOTICE 'Migration 0047_secure_assessment_exam_broadcasts already applied. Skipping.';
        RETURN;
    END IF;

    CREATE TABLE public.secure_assessment_exam_broadcasts (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id UUID NOT NULL,
        exam_instance_id UUID NOT NULL,
        sender_person_id UUID NOT NULL,
        target_scope TEXT NOT NULL,
        exam_room_id UUID NULL,
        message TEXT NOT NULL,
        sent_at TIMESTAMP WITH TIME ZONE NOT NULL,
        CONSTRAINT fk_sa_exam_broadcast_instance FOREIGN KEY (exam_instance_id, tenant_id)
            REFERENCES public.secure_assessment_exam_instances (id, tenant_id) ON DELETE RESTRICT,
        CONSTRAINT fk_sa_exam_broadcast_room FOREIGN KEY (exam_room_id, tenant_id, exam_instance_id)
            REFERENCES public.secure_assessment_exam_rooms (id, tenant_id, exam_instance_id) ON DELETE RESTRICT,
        CONSTRAINT uq_sa_exam_broadcast_scope UNIQUE (id, tenant_id, exam_instance_id),
        CONSTRAINT ck_sa_exam_broadcast_target CHECK (
            target_scope IN ('EXAM', 'ROOM', 'PARTICIPANTS')
            AND (target_scope = 'ROOM') = (exam_room_id IS NOT NULL)
        ),
        CONSTRAINT ck_sa_exam_broadcast_message CHECK (
            char_length(message) BETWEEN 1 AND 200 AND message = btrim(message)
        )
    );

    CREATE INDEX idx_sa_exam_broadcasts_exam
        ON public.secure_assessment_exam_broadcasts (tenant_id, exam_instance_id, sent_at);
    CREATE INDEX idx_sa_exam_broadcasts_sender
        ON public.secure_assessment_exam_broadcasts (tenant_id, exam_instance_id, sender_person_id, sent_at);

    CREATE TABLE public.secure_assessment_exam_broadcast_recipients (
        broadcast_id UUID NOT NULL,
        tenant_id UUID NOT NULL,
        exam_instance_id UUID NOT NULL,
        exam_participant_id UUID NOT NULL,
        delivered_at TIMESTAMP WITH TIME ZONE NULL,
        CONSTRAINT pk_sa_exam_broadcast_recipients PRIMARY KEY (broadcast_id, exam_participant_id),
        CONSTRAINT fk_sa_exam_broadcast_recipient_broadcast FOREIGN KEY (broadcast_id, tenant_id, exam_instance_id)
            REFERENCES public.secure_assessment_exam_broadcasts (id, tenant_id, exam_instance_id) ON DELETE RESTRICT,
        CONSTRAINT fk_sa_exam_broadcast_recipient_participant FOREIGN KEY (exam_participant_id, tenant_id, exam_instance_id)
            REFERENCES public.secure_assessment_exam_participants (id, tenant_id, exam_instance_id) ON DELETE RESTRICT
    );

    CREATE INDEX idx_sa_exam_broadcast_recipients_participant
        ON public.secure_assessment_exam_broadcast_recipients (tenant_id, exam_participant_id);

    CREATE FUNCTION public.prevent_sa_exam_broadcast_mutation()
    RETURNS TRIGGER AS $trg$
    BEGIN
        RAISE EXCEPTION 'Exam broadcasts are append-only.';
    END;
    $trg$ LANGUAGE plpgsql;

    CREATE TRIGGER trg_prevent_sa_exam_broadcast_mutation
        BEFORE UPDATE OR DELETE ON public.secure_assessment_exam_broadcasts
        FOR EACH ROW EXECUTE FUNCTION public.prevent_sa_exam_broadcast_mutation();

    CREATE FUNCTION public.guard_sa_exam_broadcast_recipient_mutation()
    RETURNS TRIGGER AS $trg$
    BEGIN
        IF TG_OP = 'DELETE' THEN
            RAISE EXCEPTION 'Broadcast recipients are never deleted.';
        END IF;
        IF OLD.delivered_at IS NOT NULL
           OR NEW.delivered_at IS NULL
           OR NEW.broadcast_id <> OLD.broadcast_id
           OR NEW.tenant_id <> OLD.tenant_id
           OR NEW.exam_instance_id <> OLD.exam_instance_id
           OR NEW.exam_participant_id <> OLD.exam_participant_id THEN
            RAISE EXCEPTION 'A broadcast recipient only records its delivery, once.';
        END IF;
        RETURN NEW;
    END;
    $trg$ LANGUAGE plpgsql;

    CREATE TRIGGER trg_guard_sa_exam_broadcast_recipient_mutation
        BEFORE UPDATE OR DELETE ON public.secure_assessment_exam_broadcast_recipients
        FOR EACH ROW EXECUTE FUNCTION public.guard_sa_exam_broadcast_recipient_mutation();

    INSERT INTO elligble_migration_history (migration_id) VALUES ('0047_secure_assessment_exam_broadcasts');
END $$;

COMMIT;
