-- Migration 0064: the School Operator's running controls of institution exams (ASSESS-INSTITUTION-003 §4.1;
-- Owner OC-1..OC-6, O05-3, OD-07)
-- Purpose: every Operator control of an institution exam (open, pause, resume and end of one exam or of a whole
-- session; lock and unlock of a participant; added time; a message) is one append-only action row with its actor,
-- time, reason (OC-4), confirmation, action key and request digest, and one append-only entry per affected exam
-- with its outcome (APPLIED, NO_OP or, for a session-wide transition only, SKIPPED with its code, OC-3). The
-- business ledgers (lifecycle events, 0044, 0046, 0047, 0050) keep naming the actor as before; this ledger adds the
-- reason and the outcome per exam, which they do not carry. 0054 is not widened (E4). Two guards keep both tables
-- inside institution exams: an action that names an exam must name an exam of its session, and an entry must name
-- an exam of its action's session, the action's exam and participant when it names them, and states that fit its
-- kind. Both compare with IS DISTINCT FROM, so a teacher-managed exam (NULL session) never fits. Person columns
-- are cross-domain references without a database FK, as in 0061 to 0063. Ownership: Secure Assessment.
BEGIN;
DO $migration$
BEGIN
    IF EXISTS (SELECT 1 FROM elligble_migration_history WHERE migration_id = '0064_secure_assessment_institution_controls') THEN
        RETURN;
    END IF;

    CREATE TABLE public.secure_assessment_institution_control_actions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id UUID NOT NULL,
        session_id UUID NOT NULL,
        exam_instance_id UUID NULL,
        participant_id UUID NULL,
        kind TEXT NOT NULL,
        action TEXT NOT NULL,
        reason TEXT NOT NULL,
        confirmed BOOLEAN NOT NULL,
        actor_person_id UUID NOT NULL,
        acted_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT statement_timestamp(),
        action_key UUID NOT NULL,
        request_digest TEXT NOT NULL,
        CONSTRAINT ck_sa_institution_control_kind CHECK (kind IN ('TRANSITION', 'PARTICIPANT_LOCK', 'TIME_ADD', 'BROADCAST')),
        CONSTRAINT ck_sa_institution_control_action CHECK (
            (kind = 'TRANSITION' AND action IN ('activate', 'pause', 'resume', 'end'))
            OR (kind = 'PARTICIPANT_LOCK' AND action IN ('lock', 'unlock'))
            OR (kind = 'TIME_ADD' AND action = 'add_time')
            OR (kind = 'BROADCAST' AND action = 'message')
        ),
        CONSTRAINT ck_sa_institution_control_reason CHECK (char_length(reason) BETWEEN 1 AND 200 AND btrim(reason) = reason),
        CONSTRAINT ck_sa_institution_control_confirmed CHECK (confirmed),
        CONSTRAINT ck_sa_institution_control_digest CHECK (request_digest ~ '^[0-9a-f]{64}$'),
        CONSTRAINT ck_sa_institution_control_target CHECK (
            (kind = 'TRANSITION' AND participant_id IS NULL)
            OR (kind IN ('PARTICIPANT_LOCK', 'TIME_ADD') AND exam_instance_id IS NOT NULL AND participant_id IS NOT NULL)
            OR (kind = 'BROADCAST' AND exam_instance_id IS NOT NULL AND participant_id IS NULL)
        ),
        CONSTRAINT fk_sa_institution_control_session FOREIGN KEY (session_id, tenant_id)
            REFERENCES public.secure_assessment_institution_exam_sessions (id, tenant_id) ON DELETE RESTRICT,
        CONSTRAINT fk_sa_institution_control_exam FOREIGN KEY (exam_instance_id, tenant_id)
            REFERENCES public.secure_assessment_exam_instances (id, tenant_id) ON DELETE RESTRICT,
        CONSTRAINT fk_sa_institution_control_participant FOREIGN KEY (participant_id, tenant_id, exam_instance_id)
            REFERENCES public.secure_assessment_exam_participants (id, tenant_id, exam_instance_id) ON DELETE RESTRICT,
        CONSTRAINT uq_sa_institution_control_action_ref UNIQUE (id, tenant_id),
        CONSTRAINT uq_sa_institution_control_action_key UNIQUE (tenant_id, action_key)
    );

    CREATE INDEX idx_sa_institution_control_actions_session
        ON public.secure_assessment_institution_control_actions (tenant_id, session_id, acted_at);

    CREATE TABLE public.secure_assessment_institution_control_entries (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id UUID NOT NULL,
        action_id UUID NOT NULL,
        exam_instance_id UUID NOT NULL,
        participant_id UUID NULL,
        attempt_id UUID NULL,
        broadcast_id UUID NULL,
        outcome TEXT NOT NULL,
        previous_state TEXT NULL,
        resulting_state TEXT NULL,
        skip_code TEXT NULL,
        CONSTRAINT ck_sa_institution_control_entry_outcome CHECK (outcome IN ('APPLIED', 'NO_OP', 'SKIPPED')),
        CONSTRAINT ck_sa_institution_control_entry_previous CHECK (
            previous_state IS NULL
            OR previous_state IN ('SCHEDULED', 'READY', 'ACTIVE', 'PAUSED', 'ENDED', 'FINALIZED', 'LOCKED', 'UNLOCKED')
        ),
        CONSTRAINT ck_sa_institution_control_entry_resulting CHECK (
            resulting_state IS NULL
            OR resulting_state IN ('SCHEDULED', 'READY', 'ACTIVE', 'PAUSED', 'ENDED', 'FINALIZED', 'LOCKED', 'UNLOCKED')
        ),
        CONSTRAINT ck_sa_institution_control_entry_skip_code CHECK (
            skip_code IS NULL OR skip_code IN ('invalid_state', 'room_setup_required', 'window_not_started', 'window_closed', 'not_ready')
        ),
        CONSTRAINT ck_sa_institution_control_entry_skip CHECK ((outcome = 'SKIPPED') = (skip_code IS NOT NULL)),
        CONSTRAINT ck_sa_institution_control_entry_target CHECK ((participant_id IS NULL) = (attempt_id IS NULL)),
        CONSTRAINT fk_sa_institution_control_entry_action FOREIGN KEY (action_id, tenant_id)
            REFERENCES public.secure_assessment_institution_control_actions (id, tenant_id) ON DELETE RESTRICT,
        CONSTRAINT fk_sa_institution_control_entry_exam FOREIGN KEY (exam_instance_id, tenant_id)
            REFERENCES public.secure_assessment_exam_instances (id, tenant_id) ON DELETE RESTRICT,
        CONSTRAINT fk_sa_institution_control_entry_participant FOREIGN KEY (participant_id, tenant_id, exam_instance_id)
            REFERENCES public.secure_assessment_exam_participants (id, tenant_id, exam_instance_id) ON DELETE RESTRICT,
        CONSTRAINT fk_sa_institution_control_entry_attempt FOREIGN KEY (attempt_id, tenant_id, participant_id)
            REFERENCES public.secure_assessment_exam_attempts (id, tenant_id, exam_participant_id) ON DELETE RESTRICT,
        CONSTRAINT fk_sa_institution_control_entry_broadcast FOREIGN KEY (broadcast_id, tenant_id, exam_instance_id)
            REFERENCES public.secure_assessment_exam_broadcasts (id, tenant_id, exam_instance_id) ON DELETE RESTRICT,
        CONSTRAINT uq_sa_institution_control_entry_exam UNIQUE (action_id, exam_instance_id)
    );

    CREATE INDEX idx_sa_institution_control_entries_exam
        ON public.secure_assessment_institution_control_entries (tenant_id, exam_instance_id);

    CREATE FUNCTION public.prevent_sa_institution_control_mutation()
    RETURNS TRIGGER AS $trg$
    BEGIN
        RAISE EXCEPTION 'Institution control actions and entries are append-only.';
    END;
    $trg$ LANGUAGE plpgsql;

    CREATE TRIGGER trg_prevent_sa_institution_control_action_mutation
        BEFORE UPDATE OR DELETE ON public.secure_assessment_institution_control_actions
        FOR EACH ROW EXECUTE FUNCTION public.prevent_sa_institution_control_mutation();
    CREATE TRIGGER trg_prevent_sa_institution_control_entry_mutation
        BEFORE UPDATE OR DELETE ON public.secure_assessment_institution_control_entries
        FOR EACH ROW EXECUTE FUNCTION public.prevent_sa_institution_control_mutation();

    -- The action guard: an action that names an exam names an institution exam of its own session.
    CREATE FUNCTION public.guard_sa_institution_control_action()
    RETURNS TRIGGER AS $trg$
    DECLARE
        v_session UUID;
    BEGIN
        IF NEW.exam_instance_id IS NULL THEN
            RETURN NEW;
        END IF;
        SELECT i.institution_session_id INTO v_session
        FROM public.secure_assessment_exam_instances i
        WHERE i.id = NEW.exam_instance_id AND i.tenant_id = NEW.tenant_id;
        IF v_session IS DISTINCT FROM NEW.session_id THEN
            RAISE EXCEPTION 'An institution control names an exam of its own session.'
                USING ERRCODE = 'check_violation', CONSTRAINT = 'ck_sa_institution_control_session';
        END IF;
        RETURN NEW;
    END;
    $trg$ LANGUAGE plpgsql;

    CREATE TRIGGER trg_guard_sa_institution_control_action
        BEFORE INSERT ON public.secure_assessment_institution_control_actions
        FOR EACH ROW EXECUTE FUNCTION public.guard_sa_institution_control_action();

    -- The entry guard (F1): an entry names an exam of its action's session, the action's exam and participant when
    -- the action names them, states that fit the action's kind, and is SKIPPED only under a session-wide transition.
    CREATE FUNCTION public.guard_sa_institution_control_entry()
    RETURNS TRIGGER AS $trg$
    DECLARE
        v_action RECORD;
        v_session UUID;
        v_fits BOOLEAN;
    BEGIN
        -- A state outside the domain is left to its own named CHECK (ck_sa_institution_control_entry_previous/_resulting).
        IF (NEW.previous_state IS NOT NULL AND NEW.previous_state NOT IN ('SCHEDULED', 'READY', 'ACTIVE', 'PAUSED', 'ENDED', 'FINALIZED', 'LOCKED', 'UNLOCKED'))
            OR (NEW.resulting_state IS NOT NULL AND NEW.resulting_state NOT IN ('SCHEDULED', 'READY', 'ACTIVE', 'PAUSED', 'ENDED', 'FINALIZED', 'LOCKED', 'UNLOCKED')) THEN
            RETURN NEW;
        END IF;
        SELECT a.session_id, a.exam_instance_id, a.participant_id, a.kind INTO v_action
        FROM public.secure_assessment_institution_control_actions a
        WHERE a.id = NEW.action_id AND a.tenant_id = NEW.tenant_id;
        SELECT i.institution_session_id INTO v_session
        FROM public.secure_assessment_exam_instances i
        WHERE i.id = NEW.exam_instance_id AND i.tenant_id = NEW.tenant_id;
        IF v_action.kind = 'TRANSITION' THEN
            v_fits := NEW.previous_state IN ('SCHEDULED', 'READY', 'ACTIVE', 'PAUSED', 'ENDED', 'FINALIZED')
                AND NEW.resulting_state IN ('SCHEDULED', 'READY', 'ACTIVE', 'PAUSED', 'ENDED', 'FINALIZED');
        ELSIF v_action.kind = 'PARTICIPANT_LOCK' THEN
            v_fits := NEW.previous_state IN ('LOCKED', 'UNLOCKED') AND NEW.resulting_state IN ('LOCKED', 'UNLOCKED');
        ELSIF v_action.kind IN ('TIME_ADD', 'BROADCAST') THEN
            v_fits := NEW.previous_state IS NULL AND NEW.resulting_state IS NULL;
        ELSE
            v_fits := FALSE;
        END IF;
        IF v_session IS DISTINCT FROM v_action.session_id
            OR (v_action.exam_instance_id IS NOT NULL AND NEW.exam_instance_id IS DISTINCT FROM v_action.exam_instance_id)
            OR NEW.participant_id IS DISTINCT FROM v_action.participant_id
            OR v_fits IS NOT TRUE
            OR (NEW.outcome = 'SKIPPED' AND v_action.exam_instance_id IS NOT NULL) THEN
            RAISE EXCEPTION 'An institution control entry names an exam, participant and states of its own action.'
                USING ERRCODE = 'check_violation', CONSTRAINT = 'ck_sa_institution_control_entry_scope';
        END IF;
        RETURN NEW;
    END;
    $trg$ LANGUAGE plpgsql;

    CREATE TRIGGER trg_guard_sa_institution_control_entry
        BEFORE INSERT ON public.secure_assessment_institution_control_entries
        FOR EACH ROW EXECUTE FUNCTION public.guard_sa_institution_control_entry();

    INSERT INTO elligble_migration_history (migration_id) VALUES ('0064_secure_assessment_institution_controls');
END; $migration$;
COMMIT;
