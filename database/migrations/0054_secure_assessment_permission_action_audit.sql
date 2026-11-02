-- SEC-001: protocol evidence accompanies existing owning-domain business ledgers.
-- No historical reason, intent or event is backfilled.
BEGIN;

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM public.elligble_migration_history WHERE migration_id = '0054_secure_assessment_permission_action_audit') THEN
        RETURN;
    END IF;

    ALTER TABLE public.secure_assessment_exam_attempts
        ADD CONSTRAINT uq_sa_attempt_permission_scope UNIQUE (id, tenant_id, exam_participant_id);

    CREATE TABLE public.secure_assessment_permission_action_events (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id UUID NOT NULL,
        exam_instance_id UUID NOT NULL,
        participant_id UUID NULL,
        attempt_id UUID NULL,
        actor_person_id UUID NOT NULL,
        authority_kind TEXT NOT NULL,
        action_kind TEXT NOT NULL,
        action TEXT NOT NULL,
        action_key UUID NOT NULL,
        protocol_version SMALLINT NOT NULL DEFAULT 1 CHECK (protocol_version = 1),
        request_digest TEXT NOT NULL CHECK (request_digest ~ '^[0-9a-f]{64}$'),
        reason TEXT NULL,
        confirmed BOOLEAN NOT NULL CHECK (confirmed),
        outcome TEXT NOT NULL,
        occurred_at TIMESTAMPTZ NOT NULL DEFAULT statement_timestamp(),
        previous_state TEXT NULL,
        resulting_state TEXT NULL,
        effective_at TIMESTAMPTZ NULL,
        result_digest TEXT NULL,
        CONSTRAINT fk_sa_permission_exam FOREIGN KEY (exam_instance_id, tenant_id)
            REFERENCES public.secure_assessment_exam_instances (id, tenant_id) ON DELETE RESTRICT,
        CONSTRAINT fk_sa_permission_participant FOREIGN KEY (participant_id, tenant_id, exam_instance_id)
            REFERENCES public.secure_assessment_exam_participants (id, tenant_id, exam_instance_id) ON DELETE RESTRICT,
        CONSTRAINT fk_sa_permission_attempt FOREIGN KEY (attempt_id, tenant_id, participant_id)
            REFERENCES public.secure_assessment_exam_attempts (id, tenant_id, exam_participant_id) ON DELETE RESTRICT,
        CONSTRAINT fk_sa_permission_actor FOREIGN KEY (actor_person_id)
            REFERENCES public.identity_persons (id) ON DELETE RESTRICT,
        CONSTRAINT ck_sa_permission_authority CHECK (
            authority_kind = 'TEACHER' OR (authority_kind = 'PROCTOR' AND action_kind = 'PARTICIPANT_CONTROL')
        ),
        CONSTRAINT ck_sa_permission_action CHECK (
            (action_kind = 'PARTICIPANT_CONTROL' AND action IN ('lock', 'unlock')) OR
            (action_kind = 'EXAM_TRANSITION' AND action IN ('activate', 'pause', 'resume', 'end', 'finalize')) OR
            (action_kind = 'RESCHEDULE' AND action = 'reschedule') OR
            (action_kind = 'CANCEL' AND action = 'cancel') OR
            (action_kind = 'PARTICIPANT_ADD' AND action = 'add_participants') OR
            (action_kind = 'TIME_ADD' AND action = 'add_time') OR
            (action_kind = 'IMPORT' AND action = 'import') OR
            (action_kind = 'RESULT_EXPORT' AND action IN ('csv', 'print'))
        ),
        CONSTRAINT ck_sa_permission_target CHECK (
            (action_kind IN ('PARTICIPANT_CONTROL', 'TIME_ADD') AND participant_id IS NOT NULL AND attempt_id IS NOT NULL) OR
            (action_kind NOT IN ('PARTICIPANT_CONTROL', 'TIME_ADD') AND participant_id IS NULL AND attempt_id IS NULL)
        ),
        CONSTRAINT ck_sa_permission_reason CHECK (
            (action_kind IN ('IMPORT', 'RESULT_EXPORT') AND reason IS NULL) OR
            (action_kind NOT IN ('IMPORT', 'RESULT_EXPORT') AND reason IS NOT NULL
             AND char_length(reason) BETWEEN 1 AND 200 AND btrim(reason) = reason)
        ),
        CONSTRAINT ck_sa_permission_outcome CHECK (
            (action_kind = 'RESULT_EXPORT' AND outcome = 'ISSUED') OR
            (action_kind <> 'RESULT_EXPORT' AND outcome = 'APPLIED') OR
            (outcome = 'NO_OP' AND action IN ('lock', 'unlock', 'pause', 'resume', 'end', 'finalize', 'reschedule', 'cancel'))
        ),
        CONSTRAINT ck_sa_permission_result_digest CHECK (
            (action_kind = 'RESULT_EXPORT' AND result_digest IS NOT NULL AND result_digest ~ '^[0-9a-f]{64}$') OR
            (action_kind <> 'RESULT_EXPORT' AND result_digest IS NULL)
        ),
        CONSTRAINT ck_sa_permission_state CHECK (
            (previous_state IS NULL OR previous_state IN ('DRAFT','SCHEDULED','READY','ACTIVE','PAUSED','ENDED','FINALIZED','ARCHIVED','LOCKED','UNLOCKED')) AND
            (resulting_state IS NULL OR resulting_state IN ('DRAFT','SCHEDULED','READY','ACTIVE','PAUSED','ENDED','FINALIZED','ARCHIVED','LOCKED','UNLOCKED')) AND
            (action_kind = 'PARTICIPANT_CONTROL' OR
             (COALESCE(previous_state, '') NOT IN ('LOCKED','UNLOCKED') AND COALESCE(resulting_state, '') NOT IN ('LOCKED','UNLOCKED')))
        ),
        CONSTRAINT ck_sa_permission_transition CHECK (
            action_kind <> 'EXAM_TRANSITION' OR (
                previous_state IS NOT NULL AND resulting_state IS NOT NULL AND (
                    (outcome = 'APPLIED' AND (
                        (action = 'activate' AND previous_state = 'READY' AND resulting_state = 'ACTIVE') OR
                        (action = 'pause' AND previous_state = 'ACTIVE' AND resulting_state = 'PAUSED') OR
                        (action = 'resume' AND previous_state = 'PAUSED' AND resulting_state = 'ACTIVE') OR
                        (action = 'end' AND previous_state = 'ACTIVE' AND resulting_state = 'ENDED') OR
                        (action = 'finalize' AND previous_state = 'ENDED' AND resulting_state = 'FINALIZED')
                    )) OR (outcome = 'NO_OP' AND previous_state = resulting_state AND (
                        (action = 'pause' AND resulting_state = 'PAUSED') OR
                        (action = 'resume' AND resulting_state = 'ACTIVE') OR
                        (action = 'end' AND resulting_state = 'ENDED') OR
                        (action = 'finalize' AND resulting_state = 'FINALIZED')
                    ))
                )
            )
        )
    );

    CREATE UNIQUE INDEX uq_sa_permission_action_key
        ON public.secure_assessment_permission_action_events (tenant_id, action_kind, action_key)
        WHERE action_kind <> 'IMPORT';
    CREATE UNIQUE INDEX uq_sa_permission_import_key
        ON public.secure_assessment_permission_action_events (tenant_id, actor_person_id, action_key)
        WHERE action_kind = 'IMPORT';
    CREATE INDEX idx_sa_permission_exam_time
        ON public.secure_assessment_permission_action_events (tenant_id, exam_instance_id, occurred_at, id);

    CREATE FUNCTION public.prevent_sa_permission_action_mutation()
    RETURNS TRIGGER AS $trg$
    BEGIN
        RAISE EXCEPTION 'Permission action evidence is append-only.';
    END;
    $trg$ LANGUAGE plpgsql;
    CREATE TRIGGER trg_prevent_sa_permission_action_mutation
        BEFORE UPDATE OR DELETE ON public.secure_assessment_permission_action_events
        FOR EACH ROW EXECUTE FUNCTION public.prevent_sa_permission_action_mutation();

    INSERT INTO public.elligble_migration_history (migration_id) VALUES ('0054_secure_assessment_permission_action_audit');
END $$;
COMMIT;
