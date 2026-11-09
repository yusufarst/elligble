-- Migration 0063: institution exam rooms, room placement and Proctor assignment history (ASSESS-INSTITUTION-002 §4.1;
-- Owner OB-2, RP-1..RP-5, OB-3; A04-1)
-- Purpose: the School Operator places the participants of an institution session into physical rooms and sets
-- the Proctors of each room before the exams open. A physical room is one row per ExamInstance with the same
-- label (A04-1, the 0031 table unchanged); the rows of one room carry identical text. Every Operator write that
-- changes something is one append-only action row (actor, time, kind, action key, request digest, the session
-- revision and the exams that went back to SCHEDULED); every changed participant room or Proctor assignment is
-- one append-only entry, which stores room labels rather than room ids, so an emptied room row of a
-- never-opened exam may be removed without breaking its history. The institution room guard keeps the labels of
-- an institution exam in one form, unique per exam case-insensitively and never renamed, and refuses to delete
-- a room of an exam that is not SCHEDULED or READY (a cancelled or opened exam keeps its rooms); a
-- teacher-managed exam returns at once and keeps the BU-071 behaviour. RP-1: institution exams that are
-- SCHEDULED become room-based with a Proctor per room; READY ones are left for their first room write, so no
-- READY exam has failing readiness after the upgrade. No lifecycle row is written. Person columns are
-- cross-domain references without a database FK, as in 0061 and 0062. Ownership: Secure Assessment.
BEGIN;
DO $migration$
BEGIN
    IF EXISTS (SELECT 1 FROM elligble_migration_history WHERE migration_id = '0063_secure_assessment_institution_rooms') THEN
        RETURN;
    END IF;

    CREATE TABLE public.secure_assessment_institution_room_actions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id UUID NOT NULL,
        session_id UUID NOT NULL,
        kind TEXT NOT NULL,
        revision INTEGER NOT NULL,
        demoted_exam_instance_ids UUID[] NOT NULL DEFAULT '{}',
        actor_person_id UUID NOT NULL,
        acted_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT statement_timestamp(),
        action_key UUID NOT NULL,
        request_digest TEXT NOT NULL,
        CONSTRAINT ck_sa_institution_room_action_kind CHECK (kind IN ('ROOM_PARTICIPANTS', 'ROOM_PROCTORS', 'PARTICIPANT_ADDITION')),
        CONSTRAINT ck_sa_institution_room_action_revision CHECK (revision >= 1),
        CONSTRAINT ck_sa_institution_room_action_digest CHECK (request_digest ~ '^[0-9a-f]{64}$'),
        CONSTRAINT fk_sa_institution_room_action_session FOREIGN KEY (session_id, tenant_id)
            REFERENCES public.secure_assessment_institution_exam_sessions (id, tenant_id) ON DELETE RESTRICT,
        CONSTRAINT uq_sa_institution_room_action_ref UNIQUE (id, tenant_id),
        CONSTRAINT uq_sa_institution_room_action_key UNIQUE (tenant_id, action_key),
        CONSTRAINT uq_sa_institution_room_action_revision UNIQUE (tenant_id, session_id, revision)
    );

    CREATE TABLE public.secure_assessment_institution_room_action_entries (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id UUID NOT NULL,
        action_id UUID NOT NULL,
        exam_instance_id UUID NOT NULL,
        entry_kind TEXT NOT NULL,
        exam_participant_id UUID NULL,
        proctor_assignment_id UUID NULL,
        from_room_label TEXT NULL,
        room_label TEXT NOT NULL,
        CONSTRAINT ck_sa_institution_room_entry_kind CHECK (entry_kind IN ('PARTICIPANT_ROOM', 'PROCTOR_ASSIGNED', 'PROCTOR_REVOKED')),
        CONSTRAINT ck_sa_institution_room_entry_label CHECK (
            room_label = regexp_replace(btrim(room_label), '\s+', ' ', 'g') AND char_length(room_label) BETWEEN 1 AND 60
        ),
        CONSTRAINT ck_sa_institution_room_entry_from_label CHECK (
            from_room_label IS NULL
            OR (from_room_label = regexp_replace(btrim(from_room_label), '\s+', ' ', 'g') AND char_length(from_room_label) BETWEEN 1 AND 60)
        ),
        CONSTRAINT ck_sa_institution_room_entry_shape CHECK (
            (entry_kind = 'PARTICIPANT_ROOM' AND exam_participant_id IS NOT NULL AND proctor_assignment_id IS NULL
                AND (from_room_label IS NULL OR lower(from_room_label) <> lower(room_label)))
            OR (entry_kind IN ('PROCTOR_ASSIGNED', 'PROCTOR_REVOKED') AND proctor_assignment_id IS NOT NULL
                AND exam_participant_id IS NULL AND from_room_label IS NULL)
        ),
        CONSTRAINT fk_sa_institution_room_entry_action FOREIGN KEY (action_id, tenant_id)
            REFERENCES public.secure_assessment_institution_room_actions (id, tenant_id) ON DELETE RESTRICT,
        CONSTRAINT fk_sa_institution_room_entry_exam FOREIGN KEY (exam_instance_id, tenant_id)
            REFERENCES public.secure_assessment_exam_instances (id, tenant_id) ON DELETE RESTRICT,
        CONSTRAINT fk_sa_institution_room_entry_participant FOREIGN KEY (exam_participant_id, tenant_id, exam_instance_id)
            REFERENCES public.secure_assessment_exam_participants (id, tenant_id, exam_instance_id) ON DELETE RESTRICT,
        CONSTRAINT fk_sa_institution_room_entry_proctor FOREIGN KEY (proctor_assignment_id, tenant_id, exam_instance_id)
            REFERENCES public.secure_assessment_proctor_assignments (id, tenant_id, exam_instance_id) ON DELETE RESTRICT
    );

    CREATE INDEX idx_sa_institution_room_entries_exam
        ON public.secure_assessment_institution_room_action_entries (tenant_id, exam_instance_id);

    CREATE FUNCTION public.prevent_sa_institution_room_history_mutation()
    RETURNS TRIGGER AS $trg$
    BEGIN
        RAISE EXCEPTION 'Institution room actions and entries are append-only.';
    END;
    $trg$ LANGUAGE plpgsql;

    CREATE TRIGGER trg_prevent_sa_institution_room_action_mutation
        BEFORE UPDATE OR DELETE ON public.secure_assessment_institution_room_actions
        FOR EACH ROW EXECUTE FUNCTION public.prevent_sa_institution_room_history_mutation();
    CREATE TRIGGER trg_prevent_sa_institution_room_entry_mutation
        BEFORE UPDATE OR DELETE ON public.secure_assessment_institution_room_action_entries
        FOR EACH ROW EXECUTE FUNCTION public.prevent_sa_institution_room_history_mutation();

    -- The institution room guard (E2, E17, F1, F4): a teacher-managed exam returns at once and takes no lock.
    CREATE FUNCTION public.guard_sa_institution_exam_room()
    RETURNS TRIGGER AS $trg$
    DECLARE
        v_tenant UUID;
        v_exam UUID;
        v_session UUID;
        v_state TEXT;
    BEGIN
        IF TG_OP = 'DELETE' THEN
            v_tenant := OLD.tenant_id;
            v_exam := OLD.exam_instance_id;
        ELSE
            v_tenant := NEW.tenant_id;
            v_exam := NEW.exam_instance_id;
        END IF;
        SELECT i.institution_session_id INTO v_session
        FROM public.secure_assessment_exam_instances i
        WHERE i.id = v_exam AND i.tenant_id = v_tenant;
        IF v_session IS NULL THEN
            IF TG_OP = 'DELETE' THEN
                RETURN OLD;
            END IF;
            RETURN NEW;
        END IF;
        PERFORM pg_advisory_xact_lock(hashtext('sa-institution-exam-rooms:' || v_tenant::text || ':' || v_exam::text));
        IF TG_OP = 'INSERT' THEN
            IF NEW.display_label IS NULL
                OR NEW.display_label <> regexp_replace(btrim(NEW.display_label), '\s+', ' ', 'g')
                OR char_length(NEW.display_label) NOT BETWEEN 1 AND 60 THEN
                RAISE EXCEPTION 'An institution room label is trimmed, single-spaced and 1 to 60 characters long.'
                    USING ERRCODE = 'check_violation', CONSTRAINT = 'ck_sa_institution_exam_room_label';
            END IF;
            IF EXISTS (
                SELECT 1 FROM public.secure_assessment_exam_rooms r
                WHERE r.tenant_id = v_tenant AND r.exam_instance_id = v_exam AND lower(r.display_label) = lower(NEW.display_label)
            ) THEN
                RAISE EXCEPTION 'An institution exam has one room per label.'
                    USING ERRCODE = 'unique_violation', CONSTRAINT = 'uq_sa_institution_exam_room_label';
            END IF;
            RETURN NEW;
        END IF;
        IF TG_OP = 'UPDATE' THEN
            IF NEW.display_label IS DISTINCT FROM OLD.display_label THEN
                RAISE EXCEPTION 'An institution room label never changes.'
                    USING ERRCODE = 'check_violation', CONSTRAINT = 'ck_sa_institution_exam_room_label';
            END IF;
            RETURN NEW;
        END IF;
        SELECT i.lifecycle_state INTO v_state
        FROM public.secure_assessment_exam_instances i
        WHERE i.id = v_exam AND i.tenant_id = v_tenant;
        IF v_state IS DISTINCT FROM 'SCHEDULED' AND v_state IS DISTINCT FROM 'READY' THEN
            RAISE EXCEPTION 'A room of an institution exam is removed only while the exam is scheduled or ready.'
                USING ERRCODE = 'check_violation', CONSTRAINT = 'ck_sa_institution_exam_room_frozen';
        END IF;
        RETURN OLD;
    END;
    $trg$ LANGUAGE plpgsql;

    CREATE TRIGGER trg_guard_sa_institution_exam_room
        BEFORE INSERT OR UPDATE OF display_label OR DELETE ON public.secure_assessment_exam_rooms
        FOR EACH ROW EXECUTE FUNCTION public.guard_sa_institution_exam_room();

    -- RP-1: SCHEDULED institution exams need rooms and a Proctor per room; READY ones at their first room write.
    UPDATE public.secure_assessment_exam_instances
    SET room_based_operations_enabled = TRUE, proctor_per_room_required = TRUE
    WHERE institution_session_id IS NOT NULL AND lifecycle_state = 'SCHEDULED';

    INSERT INTO elligble_migration_history (migration_id) VALUES ('0063_secure_assessment_institution_rooms');
END; $migration$;
COMMIT;
