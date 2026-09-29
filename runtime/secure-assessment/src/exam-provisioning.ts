import { randomBytes } from 'node:crypto';
import type { ClientBase } from 'pg';
import { validateBaselineQuestionSnapshotFrozenContent } from './question-snapshot-baseline-frozen-content-contract.ts';

// Secure Assessment provisioning for operator exam import (pilot bridge until teachers
// author or import their own exams): a teacher-managed exam (D04.4-26A) is created with its
// frozen question snapshots in the authored order (D04.2-49..51, D04.3-21, D04.3-41),
// explicit participants from Academic Core enrollments (D04.4-02/05/07) and proctors, then
// scheduled, all inside the caller's transaction. Marking it ready and opening it stay with
// the teacher, where the readiness checks run.

export type LatestStartPolicy = 'FULL_DURATION_BEYOND_WINDOW' | 'REMAINING_WINDOW_ONLY' | 'LATE_START_BLOCKED';
export const LATEST_START_POLICIES: readonly LatestStartPolicy[] = ['FULL_DURATION_BEYOND_WINDOW', 'REMAINING_WINDOW_ONLY', 'LATE_START_BLOCKED'];

export interface BaselineQuestionInput {
    prompt: string;
    /** Exactly five option texts, in the authored order (shown as A to E). */
    options: string[];
    /** Index (0 to 4) of the correct option. */
    correctIndex: number;
    maxScore: number;
}

/**
 * Frozen MULTIPLE_CHOICE_SINGLE content. Option identifiers are random, never the display
 * letters (D04.3-21), so a later option shuffle cannot leak or break the key.
 */
export function buildBaselineFrozenContent(
    input: BaselineQuestionInput,
    newOptionId: () => string = () => `opt_${randomBytes(6).toString('hex')}`
): Record<string, unknown> {
    const options = input.options.map(content => ({ id: newOptionId(), content }));
    const content = {
        schemaVersion: 1,
        questionType: 'MULTIPLE_CHOICE_SINGLE',
        prompt: input.prompt,
        options,
        correctOptionId: options[input.correctIndex]?.id,
        maxScore: input.maxScore,
    };
    const validation = validateBaselineQuestionSnapshotFrozenContent(content);
    if (validation.type !== 'baseline_question_snapshot_content_valid') {
        throw new Error(`Question content is not a valid baseline question: ${validation.blocker}`);
    }
    return content;
}

export async function ensureAssessmentType(client: ClientBase, tenantId: string, label: string): Promise<{ id: string; created: boolean }> {
    const trimmed = label.trim();
    await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`sa_assessment_type:${tenantId}:${trimmed}`]);
    const existing = await client.query(
        'SELECT id FROM secure_assessment_assessment_types WHERE tenant_id = $1 AND display_label = $2',
        [tenantId, trimmed]
    );
    if ((existing.rowCount ?? 0) > 1) throw new Error(`More than one assessment type is labelled "${trimmed}".`);
    if (existing.rowCount === 1) return { id: existing.rows[0].id, created: false };
    const res = await client.query(
        'INSERT INTO secure_assessment_assessment_types (tenant_id, display_label) VALUES ($1, $2) RETURNING id',
        [tenantId, trimmed]
    );
    return { id: res.rows[0].id, created: true };
}

export interface ExamProvisioningInput {
    teachingAssignmentId: string;
    assessmentTypeId: string;
    windowStartsAt: Date;
    windowEndsAt: Date;
    durationSeconds: number;
    latestStartPolicy: LatestStartPolicy;
    /** Frozen contents from buildBaselineFrozenContent, in the authored order. */
    questions: Record<string, unknown>[];
    participants: Array<{ personId: string; academicEnrollmentId: string }>;
    proctorPersonIds: string[];
}

export async function provisionScheduledExam(client: ClientBase, tenantId: string, input: ExamProvisioningInput): Promise<{ examInstanceId: string }> {
    if (!(input.windowEndsAt.getTime() > input.windowStartsAt.getTime())) throw new Error('The exam window must end after it starts.');
    if (!Number.isInteger(input.durationSeconds) || input.durationSeconds <= 0) throw new Error('The attempt duration must be a positive number of seconds.');
    if (!LATEST_START_POLICIES.includes(input.latestStartPolicy)) throw new Error('Unknown latest start policy.');
    if (input.questions.length === 0) throw new Error('An exam needs at least one question.');
    if (input.participants.length === 0) throw new Error('An exam needs at least one participant.');

    const teaching = await client.query(
        'SELECT id FROM academic_core_teaching_assignments WHERE id = $1 AND tenant_id = $2 AND revoked_at IS NULL',
        [input.teachingAssignmentId, tenantId]
    );
    if (teaching.rowCount !== 1) throw new Error('The teaching assignment is not active in this school.');

    const exam = await client.query(
        `INSERT INTO secure_assessment_exam_instances (
            tenant_id, teaching_assignment_id, assessment_type_id, lifecycle_state,
            window_starts_at, window_ends_at, configured_attempt_duration_seconds, latest_start_policy,
            room_based_operations_enabled, proctor_per_room_required
         ) VALUES ($1, $2, $3, 'DRAFT', $4, $5, $6, $7, FALSE, FALSE) RETURNING id`,
        [tenantId, input.teachingAssignmentId, input.assessmentTypeId, input.windowStartsAt, input.windowEndsAt, input.durationSeconds, input.latestStartPolicy]
    );
    const examInstanceId: string = exam.rows[0].id;

    for (const [index, content] of input.questions.entries()) {
        await client.query(
            `INSERT INTO secure_assessment_exam_question_snapshots (tenant_id, exam_instance_id, frozen_content, display_order)
             VALUES ($1, $2, $3, $4)`,
            [tenantId, examInstanceId, JSON.stringify(content), index + 1]
        );
    }
    for (const participant of input.participants) {
        await client.query(
            `INSERT INTO secure_assessment_exam_participants (tenant_id, exam_instance_id, person_id, academic_enrollment_id)
             VALUES ($1, $2, $3, $4)`,
            [tenantId, examInstanceId, participant.personId, participant.academicEnrollmentId]
        );
    }
    for (const personId of new Set(input.proctorPersonIds)) {
        await client.query(
            'INSERT INTO secure_assessment_proctor_assignments (tenant_id, exam_instance_id, person_id) VALUES ($1, $2, $3)',
            [tenantId, examInstanceId, personId]
        );
    }
    const scheduled = await client.query(
        `UPDATE secure_assessment_exam_instances SET lifecycle_state = 'SCHEDULED'
         WHERE id = $1 AND tenant_id = $2 AND lifecycle_state = 'DRAFT' RETURNING id`,
        [examInstanceId, tenantId]
    );
    if (scheduled.rowCount !== 1) throw new Error('The exam could not be scheduled.');
    return { examInstanceId };
}
