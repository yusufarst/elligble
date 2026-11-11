-- Migration 0065: participant room transfer during running institution exams (ASSESS-ROOM-001 §4.1; Owner OR-1..OR-5,
-- O05-4, O05-5, A04-2, A04-3; ASSESS-INSTITUTION-002 E18)
-- Purpose: the School Operator moves one participant of an ACTIVE or PAUSED institution exam to another room of the
-- same exam with a reason and a confirmation. The current room row (0032) gains assignment_version, owned by a
-- trigger: an insert gets 1, an update that changes the room gets the old value plus 1, any other update keeps it, so
-- no caller sets it and every room-screen move of ASSESS-INSTITUTION-002 bumps it too. Existing rows read 1, the
-- defined initial version. The room history of 0063 is extended rather than duplicated (E18): a PARTICIPANT_TRANSFER
-- action carries the reason and the confirmation, and exactly one PARTICIPANT_TRANSFER entry carries the participant,
-- its open attempt (NULL when not started), both room labels and the resulting version. A transfer guard keeps the
-- kinds of an action and its entries equal for transfers, the entry inside the action's session, and one entry per
-- transfer action; any other pair returns at once and takes no lock, so ASSESS-INSTITUTION-002 writes behave as before.
-- The append-only triggers and the room guard of 0063 are unchanged. No data is migrated. Ownership: Secure Assessment.
BEGIN;
DO $migration$
BEGIN
    IF EXISTS (SELECT 1 FROM elligble_migration_history WHERE migration_id = '0065_secure_assessment_participant_room_transfer') THEN
        RETURN;
    END IF;

    -- 0032: the version of the current room row (A04-2, E3).
    ALTER TABLE public.secure_assessment_exam_participant_room_assignments
        ADD COLUMN assignment_version INTEGER NOT NULL DEFAULT 1;
    ALTER TABLE public.secure_assessment_exam_participant_room_assignments
        ADD CONSTRAINT ck_sa_exam_participant_room_assignment_version CHECK (assignment_version >= 1);

    CREATE FUNCTION public.version_sa_exam_participant_room_assignment()
    RETURNS TRIGGER AS $trg$
    BEGIN
        IF TG_OP = 'INSERT' THEN
            NEW.assignment_version := 1;
        ELSIF NEW.exam_room_id IS DISTINCT FROM OLD.exam_room_id THEN
            NEW.assignment_version := OLD.assignment_version + 1;
        ELSE
            NEW.assignment_version := OLD.assignment_version;
        END IF;
        RETURN NEW;
    END;
    $trg$ LANGUAGE plpgsql;

    CREATE TRIGGER trg_version_sa_exam_participant_room_assignment
        BEFORE INSERT OR UPDATE ON public.secure_assessment_exam_participant_room_assignments
        FOR EACH ROW EXECUTE FUNCTION public.version_sa_exam_participant_room_assignment();

    -- 0063 actions: the transfer kind with its reason and confirmation (E8).
    ALTER TABLE public.secure_assessment_institution_room_actions
        DROP CONSTRAINT ck_sa_institution_room_action_kind;
    ALTER TABLE public.secure_assessment_institution_room_actions
        ADD CONSTRAINT ck_sa_institution_room_action_kind
            CHECK (kind IN ('ROOM_PARTICIPANTS', 'ROOM_PROCTORS', 'PARTICIPANT_ADDITION', 'PARTICIPANT_TRANSFER'));
    ALTER TABLE public.secure_assessment_institution_room_actions
        ADD COLUMN reason TEXT NULL;
    ALTER TABLE public.secure_assessment_institution_room_actions
        ADD COLUMN confirmed BOOLEAN NULL;
    ALTER TABLE public.secure_assessment_institution_room_actions
        ADD CONSTRAINT ck_sa_institution_room_action_transfer CHECK (
            (kind = 'PARTICIPANT_TRANSFER' AND reason IS NOT NULL AND char_length(reason) BETWEEN 1 AND 200 AND btrim(reason) = reason
                AND confirmed IS TRUE AND demoted_exam_instance_ids = '{}')
            OR (kind <> 'PARTICIPANT_TRANSFER' AND reason IS NULL AND confirmed IS NULL)
        );

    -- 0063 entries: the transfer kind with its resulting version and the open attempt.
    ALTER TABLE public.secure_assessment_institution_room_action_entries
        DROP CONSTRAINT ck_sa_institution_room_entry_kind;
    ALTER TABLE public.secure_assessment_institution_room_action_entries
        ADD CONSTRAINT ck_sa_institution_room_entry_kind
            CHECK (entry_kind IN ('PARTICIPANT_ROOM', 'PROCTOR_ASSIGNED', 'PROCTOR_REVOKED', 'PARTICIPANT_TRANSFER'));
    ALTER TABLE public.secure_assessment_institution_room_action_entries
        ADD COLUMN assignment_version INTEGER NULL;
    ALTER TABLE public.secure_assessment_institution_room_action_entries
        ADD COLUMN exam_attempt_id UUID NULL;
    ALTER TABLE public.secure_assessment_institution_room_action_entries
        ADD CONSTRAINT fk_sa_institution_room_entry_attempt FOREIGN KEY (exam_attempt_id, tenant_id, exam_participant_id)
            REFERENCES public.secure_assessment_exam_attempts (id, tenant_id, exam_participant_id) ON DELETE RESTRICT;
    ALTER TABLE public.secure_assessment_institution_room_action_entries
        DROP CONSTRAINT ck_sa_institution_room_entry_shape;
    ALTER TABLE public.secure_assessment_institution_room_action_entries
        ADD CONSTRAINT ck_sa_institution_room_entry_shape CHECK (
            (entry_kind = 'PARTICIPANT_ROOM' AND exam_participant_id IS NOT NULL AND proctor_assignment_id IS NULL
                AND (from_room_label IS NULL OR lower(from_room_label) <> lower(room_label))
                AND assignment_version IS NULL AND exam_attempt_id IS NULL)
            OR (entry_kind IN ('PROCTOR_ASSIGNED', 'PROCTOR_REVOKED') AND proctor_assignment_id IS NOT NULL
                AND exam_participant_id IS NULL AND from_room_label IS NULL
                AND assignment_version IS NULL AND exam_attempt_id IS NULL)
            OR (entry_kind = 'PARTICIPANT_TRANSFER' AND exam_participant_id IS NOT NULL AND proctor_assignment_id IS NULL
                AND from_room_label IS NOT NULL AND lower(from_room_label) <> lower(room_label)
                AND assignment_version IS NOT NULL AND assignment_version >= 2)
        );

    -- The transfer guard (§4.1): a transfer entry only under a transfer action and the reverse, inside the action's
    -- session, and at most one per transfer action. Any other pair returns without a lock.
    CREATE FUNCTION public.guard_sa_institution_room_transfer()
    RETURNS TRIGGER AS $trg$
    DECLARE
        v_action RECORD;
        v_session UUID;
    BEGIN
        SELECT a.kind, a.session_id INTO v_action
        FROM public.secure_assessment_institution_room_actions a
        WHERE a.id = NEW.action_id AND a.tenant_id = NEW.tenant_id;
        IF (NEW.entry_kind = 'PARTICIPANT_TRANSFER') IS DISTINCT FROM (v_action.kind IS NOT DISTINCT FROM 'PARTICIPANT_TRANSFER') THEN
            RAISE EXCEPTION 'A transfer entry belongs to a transfer action, and a transfer action has only transfer entries.'
                USING ERRCODE = 'check_violation', CONSTRAINT = 'ck_sa_institution_room_transfer_scope';
        END IF;
        IF v_action.kind IS DISTINCT FROM 'PARTICIPANT_TRANSFER' THEN
            RETURN NEW;
        END IF;
        SELECT i.institution_session_id INTO v_session
        FROM public.secure_assessment_exam_instances i
        WHERE i.id = NEW.exam_instance_id AND i.tenant_id = NEW.tenant_id;
        IF v_session IS DISTINCT FROM v_action.session_id
            OR EXISTS (
                SELECT 1 FROM public.secure_assessment_institution_room_action_entries e
                WHERE e.tenant_id = NEW.tenant_id AND e.action_id = NEW.action_id
            ) THEN
            RAISE EXCEPTION 'A transfer entry names an exam of its action''s session, once per transfer.'
                USING ERRCODE = 'check_violation', CONSTRAINT = 'ck_sa_institution_room_transfer_scope';
        END IF;
        RETURN NEW;
    END;
    $trg$ LANGUAGE plpgsql;

    CREATE TRIGGER trg_guard_sa_institution_room_transfer
        BEFORE INSERT ON public.secure_assessment_institution_room_action_entries
        FOR EACH ROW EXECUTE FUNCTION public.guard_sa_institution_room_transfer();

    INSERT INTO elligble_migration_history (migration_id) VALUES ('0065_secure_assessment_participant_room_transfer');
END; $migration$;
COMMIT;
