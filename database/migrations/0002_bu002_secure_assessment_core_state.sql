-- Migration 0002: BU-002 Secure Assessment Core State Persistence Bootstrap
-- Purpose: Persistence foundation for Exam Instance, Participant, Attempt, and Session

BEGIN;

-- Check for safe repeat invocation (idempotency)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM elligble_migration_history WHERE migration_id = '0002_bu002_secure_assessment_core_state') THEN
        RAISE NOTICE 'Migration 0002_bu002_secure_assessment_core_state already applied. Skipping.';
        RETURN;
    END IF;

    -- 1. Secure Assessment Domain: Exam Instances
    -- Truth: Exam Instance is assessment context.
    -- tenant_id is a cross-domain reference to Tenant. No direct DB FK to tenant_tenants (provisional global FK strategy).
    CREATE TABLE IF NOT EXISTS secure_assessment_exam_instances (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id UUID NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT uq_sa_exam_instances_tenant UNIQUE (id, tenant_id)
    );

    -- 2. Secure Assessment Domain: Exam Participants
    -- Truth: Participant belongs to one Exam Instance.
    -- person_id is a cross-domain reference. No direct DB FK to identity_persons.
    CREATE TABLE IF NOT EXISTS secure_assessment_exam_participants (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id UUID NOT NULL,
        exam_instance_id UUID NOT NULL,
        person_id UUID NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT fk_sa_participant_instance FOREIGN KEY (exam_instance_id, tenant_id) REFERENCES secure_assessment_exam_instances (id, tenant_id) ON DELETE RESTRICT,
        CONSTRAINT uq_sa_exam_participants_tenant UNIQUE (id, tenant_id)
    );

    -- 3. Secure Assessment Domain: Exam Attempts
    -- Truth: Attempt belongs to one Exam Participant.
    CREATE TABLE IF NOT EXISTS secure_assessment_exam_attempts (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id UUID NOT NULL,
        exam_participant_id UUID NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT fk_sa_attempt_participant FOREIGN KEY (exam_participant_id, tenant_id) REFERENCES secure_assessment_exam_participants (id, tenant_id) ON DELETE RESTRICT,
        CONSTRAINT uq_sa_exam_attempts_tenant UNIQUE (id, tenant_id)
    );

    -- 4. Secure Assessment Domain: Exam Sessions
    -- Truth: Session belongs to one Exam Attempt.
    CREATE TABLE IF NOT EXISTS secure_assessment_exam_sessions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id UUID NOT NULL,
        exam_attempt_id UUID NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT fk_sa_session_attempt FOREIGN KEY (exam_attempt_id, tenant_id) REFERENCES secure_assessment_exam_attempts (id, tenant_id) ON DELETE RESTRICT
    );

    -- Record migration application
    INSERT INTO elligble_migration_history (migration_id) VALUES ('0002_bu002_secure_assessment_core_state');
END $$;

COMMIT;
