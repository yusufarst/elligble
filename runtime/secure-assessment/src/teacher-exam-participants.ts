import type pg from 'pg';
import { listElligbleIds } from '../../identity-access/src/directory.ts';
import { listEnrolledStudents, type EnrolledStudent } from './exam-provisioning.ts';
import { lockManagedExam, readManagedExam, type ManagedExamRow } from './managed-exam.ts';

// The teacher adds students to a scheduled or ready exam before it opens (ASSESS-TEACHER-004).
// D04.2-64 LOCKED: adding participants after READY needs authorization, a readiness re-check,
// room assignment where applicable, snapshot creation and audit; D04.4-20 LOCKED: after ACTIVE
// it is not this path. Only the teacher who manages the exam adds, the authority that
// scheduled it and marks it ready (D04.4-26A), and only students enrolled in the exam's class
// on the exam day (D04.4-02/04 LOCKED: a specific eligible student, from Academic Core,
// without editing the enrollment; D04.4-08: nobody from elsewhere). A student already expected
// in another exam at an overlapping time is refused, as the import refuses one (D04.2-37..39).
// READY is re-evaluated after the change (D04.2-25): a ready exam is scheduled again, recorded
// as a lifecycle event, and the teacher marks it ready anew, which runs every readiness check.
// Rooms are not assigned here, so an exam run with rooms is refused rather than left with a
// participant outside every room. Each request is kept with who, when and the state the exam
// had, and each participant with the enrollment it came from (migration 0053; D04.4-09
// provenance); one request adds everyone or no one, and the action key chosen by the device
// finds what a retried request added. Removing participants is open (OPEN-05) and not offered.

export type ParticipantAdditionProblemCode =
    | 'time_zone_missing'
    | 'window_missing'
    | 'rooms_in_use'
    | 'not_enrolled'
    | 'already_participant'
    | 'schedule_conflict';

/** Problems of the exam itself: nobody can be added until they are resolved. */
export type ExamAdditionProblemCode = 'time_zone_missing' | 'window_missing' | 'rooms_in_use';

export interface ParticipantCandidate {
    enrollmentId: string;
    elligbleId: string;
    /** Already expected in another exam at an overlapping time: cannot be added. */
    conflict: boolean;
}

export interface ParticipantCandidates {
    examInstanceId: string;
    lifecycleState: string;
    /** The exam day in the school's zone (`YYYY-MM-DD`); the candidates are the class on that day. */
    examDay: string | null;
    participantCount: number;
    /** Students of the class on the exam day who are not participants yet. */
    candidates: ParticipantCandidate[];
    problems: Array<{ code: ExamAdditionProblemCode }>;
}

export interface ParticipantAdditionRequest {
    examInstanceId: string;
    enrollmentIds: string[];
    actionKey: string;
}

export type ParticipantAdditionOutcome =
    | {
        type: 'added';
        examInstanceId: string;
        lifecycleState: string;
        addedAt: string;
        added: Array<{ enrollmentId: string; elligbleId: string | null }>;
        /** The action key had already added them. */
        replayed: boolean;
    }
    | { type: 'invalid'; problems: Array<{ code: ParticipantAdditionProblemCode; count?: number }> }
    | { type: 'invalid_state'; currentState: string }
    | { type: 'forbidden' }
    | { type: 'action_key_reused' }
    | { type: 'unavailable' };

/** Students one request may add (an implementation default, plan §7); it fits the request body limit. */
export const MAX_ADDED_PARTICIPANTS = 1000;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ADDABLE_STATES = new Set(['SCHEDULED', 'READY']);
/** Exams that hold their participants' time, as scheduling and readiness count them. */
const OPERATIONAL_STATES = ['SCHEDULED', 'READY', 'ACTIVE', 'PAUSED'];

/** A well-formed request, or null (400). */
export function parseParticipantAdditionRequest(body: Record<string, unknown>): ParticipantAdditionRequest | null {
    const { examInstanceId, enrollmentIds, actionKey } = body;
    if (typeof examInstanceId !== 'string' || !UUID.test(examInstanceId)) return null;
    if (typeof actionKey !== 'string' || !UUID.test(actionKey)) return null;
    if (!Array.isArray(enrollmentIds) || enrollmentIds.length === 0 || enrollmentIds.length > MAX_ADDED_PARTICIPANTS) return null;
    if (!enrollmentIds.every(id => typeof id === 'string' && UUID.test(id))) return null;
    const ids = (enrollmentIds as string[]).map(id => id.toLowerCase());
    if (new Set(ids).size !== ids.length) return null;
    return { examInstanceId: examInstanceId.toLowerCase(), enrollmentIds: ids, actionKey: actionKey.toLowerCase() };
}

function iso(value: unknown): string {
    return (value instanceof Date ? value : new Date(String(value))).toISOString();
}

interface ClassContext {
    groupId: string;
    periodId: string;
    roomsInUse: boolean;
    /** The school-zone date of the window start. */
    examDay: string | null;
}

/** The exam's class: its teaching assignment's group in the offering's period, on the exam day. */
async function readClassContext(client: pg.PoolClient, tenantId: string, examInstanceId: string): Promise<ClassContext> {
    const res = await client.query(
        `SELECT ata.academic_group_id, o.academic_period_id, i.room_based_operations_enabled,
                to_char((i.window_starts_at AT TIME ZONE t.time_zone)::date, 'YYYY-MM-DD') AS exam_day
         FROM secure_assessment_exam_instances i
         JOIN tenant_tenants t ON t.id = i.tenant_id
         JOIN academic_core_teaching_assignments ata ON ata.id = i.teaching_assignment_id AND ata.tenant_id = i.tenant_id
         JOIN academic_core_subject_offerings o ON o.id = ata.subject_offering_id AND o.tenant_id = ata.tenant_id
         WHERE i.id = $1 AND i.tenant_id = $2`,
        [examInstanceId, tenantId]
    );
    const row = res.rows[0];
    return {
        groupId: row.academic_group_id,
        periodId: row.academic_period_id,
        roomsInUse: row.room_based_operations_enabled === true,
        examDay: row.exam_day ?? null,
    };
}

function examProblems(exam: ManagedExamRow, context: ClassContext): Array<{ code: ExamAdditionProblemCode }> {
    const problems: Array<{ code: ExamAdditionProblemCode }> = [];
    if (!exam.time_zone) problems.push({ code: 'time_zone_missing' });
    else if (!context.examDay || !exam.window_starts_at || !exam.window_ends_at) problems.push({ code: 'window_missing' });
    if (context.roomsInUse) problems.push({ code: 'rooms_in_use' });
    return problems;
}

async function participantPersons(client: pg.PoolClient, tenantId: string, examInstanceId: string): Promise<Set<string>> {
    const res = await client.query(
        'SELECT person_id FROM secure_assessment_exam_participants WHERE tenant_id = $1 AND exam_instance_id = $2',
        [tenantId, examInstanceId]
    );
    return new Set(res.rows.map(row => row.person_id as string));
}

/** People already expected in another exam whose window overlaps this one. */
async function conflictingPersons(
    client: pg.PoolClient,
    tenantId: string,
    examInstanceId: string,
    exam: ManagedExamRow,
    personIds: string[]
): Promise<Set<string>> {
    if (personIds.length === 0) return new Set();
    const res = await client.query(
        `SELECT DISTINCT p.person_id
         FROM secure_assessment_exam_participants p
         JOIN secure_assessment_exam_instances i ON i.id = p.exam_instance_id AND i.tenant_id = p.tenant_id
         WHERE p.tenant_id = $1 AND p.person_id = ANY($2::uuid[]) AND i.id <> $3
           AND i.lifecycle_state = ANY($4::text[])
           AND i.window_starts_at < $6 AND i.window_ends_at > $5`,
        [tenantId, personIds, examInstanceId, OPERATIONAL_STATES, exam.window_starts_at, exam.window_ends_at]
    );
    return new Set(res.rows.map(row => row.person_id as string));
}

/** One entry per person: a person enrolled twice in the class is offered once. */
function oncePerPerson(students: EnrolledStudent[]): EnrolledStudent[] {
    const seen = new Set<string>();
    return students.filter(s => (seen.has(s.personId) ? false : (seen.add(s.personId), true)));
}

export async function readParticipantCandidates(
    pool: pg.Pool,
    actor: { tenantId: string; personId: string },
    examInstanceId: string
): Promise<
    | { type: 'ok'; candidates: ParticipantCandidates }
    | { type: 'invalid_state'; currentState: string }
    | { type: 'forbidden' }
    | { type: 'unavailable' }
> {
    if (!UUID.test(actor.tenantId) || !UUID.test(actor.personId) || !UUID.test(examInstanceId)) return { type: 'forbidden' };
    const examId = examInstanceId.toLowerCase();
    let client: pg.PoolClient;
    try {
        client = await pool.connect();
    } catch {
        return { type: 'unavailable' };
    }
    try {
        await client.query('BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY');
        const exam = await readManagedExam(client, actor, examId);
        if (!exam) {
            await client.query('COMMIT');
            return { type: 'forbidden' };
        }
        if (!ADDABLE_STATES.has(exam.lifecycle_state)) {
            await client.query('COMMIT');
            return { type: 'invalid_state', currentState: exam.lifecycle_state };
        }
        const context = await readClassContext(client, actor.tenantId, examId);
        const problems = examProblems(exam, context);
        const current = await participantPersons(client, actor.tenantId, examId);
        let candidates: ParticipantCandidate[] = [];
        if (problems.length === 0) {
            const enrolled = await listEnrolledStudents(client, actor.tenantId, {
                groupId: context.groupId, periodId: context.periodId, examDay: context.examDay!,
            });
            const open = oncePerPerson(enrolled).filter(s => !current.has(s.personId));
            const conflicting = await conflictingPersons(client, actor.tenantId, examId, exam, open.map(s => s.personId));
            candidates = open.map(s => ({ enrollmentId: s.enrollmentId, elligbleId: s.elligbleId, conflict: conflicting.has(s.personId) }));
        }
        await client.query('COMMIT');
        return {
            type: 'ok',
            candidates: {
                examInstanceId: examId,
                lifecycleState: exam.lifecycle_state,
                examDay: context.examDay,
                participantCount: current.size,
                candidates,
                problems,
            },
        };
    } catch {
        await client.query('ROLLBACK').catch(() => {});
        return { type: 'unavailable' };
    } finally {
        client.release();
    }
}

export async function addTeacherExamParticipants(
    pool: pg.Pool,
    actor: { tenantId: string; personId: string },
    request: ParticipantAdditionRequest
): Promise<ParticipantAdditionOutcome> {
    if (!UUID.test(actor.tenantId) || !UUID.test(actor.personId)) return { type: 'forbidden' };
    let client: pg.PoolClient;
    try {
        client = await pool.connect();
    } catch {
        return { type: 'unavailable' };
    }
    try {
        await client.query('BEGIN');
        // Locked like every lifecycle transition: additions to one exam are decided one at a
        // time, so a retry that overtakes the original finds what it added.
        const exam = await lockManagedExam(client, actor, request.examInstanceId);
        if (!exam) {
            await client.query('ROLLBACK');
            return { type: 'forbidden' };
        }

        // A retried request finds what it added; a key never serves another request.
        const earlier = await client.query(
            `SELECT a.exam_instance_id, a.added_by_person_id, a.added_at, e.academic_enrollment_id, p.person_id
             FROM secure_assessment_exam_participant_additions a
             LEFT JOIN secure_assessment_exam_participant_addition_entries e
               ON e.participant_addition_id = a.id AND e.tenant_id = a.tenant_id
             LEFT JOIN secure_assessment_exam_participants p
               ON p.id = e.exam_participant_id AND p.tenant_id = e.tenant_id
             WHERE a.tenant_id = $1 AND a.action_key = $2`,
            [actor.tenantId, request.actionKey]
        );
        if (earlier.rows.length > 0) {
            const first = earlier.rows[0];
            const recorded = earlier.rows.filter(row => row.academic_enrollment_id)
                .map(row => ({ enrollmentId: row.academic_enrollment_id as string, personId: row.person_id as string }))
                .sort((a, b) => a.enrollmentId.localeCompare(b.enrollmentId));
            const requested = [...request.enrollmentIds].sort((a, b) => a.localeCompare(b));
            const same = first.exam_instance_id === request.examInstanceId && first.added_by_person_id === actor.personId
                && recorded.length === requested.length && recorded.every((entry, i) => entry.enrollmentId === requested[i]);
            if (!same) {
                await client.query('ROLLBACK');
                return { type: 'action_key_reused' };
            }
            const ids = await listElligbleIds(client, recorded.map(entry => entry.personId));
            await client.query('ROLLBACK');
            return {
                type: 'added', examInstanceId: request.examInstanceId, lifecycleState: exam.lifecycle_state, addedAt: iso(first.added_at),
                added: recorded.map(entry => ({ enrollmentId: entry.enrollmentId, elligbleId: ids.get(entry.personId) ?? null })),
                replayed: true,
            };
        }

        if (!ADDABLE_STATES.has(exam.lifecycle_state)) {
            await client.query('ROLLBACK');
            return { type: 'invalid_state', currentState: exam.lifecycle_state };
        }
        const context = await readClassContext(client, actor.tenantId, request.examInstanceId);
        const problems: Array<{ code: ParticipantAdditionProblemCode; count?: number }> = examProblems(exam, context);
        if (problems.length > 0) {
            await client.query('ROLLBACK');
            return { type: 'invalid', problems };
        }

        // Students of the class on the exam day only; everyone in the request or no one.
        const enrolled = new Map((await listEnrolledStudents(client, actor.tenantId, {
            groupId: context.groupId, periodId: context.periodId, examDay: context.examDay!,
        })).map(s => [s.enrollmentId, s]));
        const chosen = request.enrollmentIds.flatMap(id => enrolled.get(id) ?? []);
        if (chosen.length < request.enrollmentIds.length) {
            problems.push({ code: 'not_enrolled', count: request.enrollmentIds.length - chosen.length });
        }
        const taken = await participantPersons(client, actor.tenantId, request.examInstanceId);
        const fresh: EnrolledStudent[] = [];
        let already = 0;
        for (const student of chosen) {
            if (taken.has(student.personId)) already++;
            else {
                taken.add(student.personId);
                fresh.push(student);
            }
        }
        if (already > 0) problems.push({ code: 'already_participant', count: already });
        const conflicting = await conflictingPersons(client, actor.tenantId, request.examInstanceId, exam, fresh.map(s => s.personId));
        if (conflicting.size > 0) problems.push({ code: 'schedule_conflict', count: conflicting.size });
        if (problems.length > 0) {
            await client.query('ROLLBACK');
            return { type: 'invalid', problems };
        }

        const addition = await client.query(
            `INSERT INTO secure_assessment_exam_participant_additions
                 (tenant_id, exam_instance_id, added_by_person_id, added_at, previous_lifecycle_state, action_key)
             VALUES ($1, $2, $3, statement_timestamp(), $4, $5)
             RETURNING id, added_at`,
            [actor.tenantId, request.examInstanceId, actor.personId, exam.lifecycle_state, request.actionKey]
        );
        const { id: additionId, added_at: addedAt } = addition.rows[0];
        for (const student of fresh) {
            const participant = await client.query(
                `INSERT INTO secure_assessment_exam_participants (tenant_id, exam_instance_id, person_id, academic_enrollment_id)
                 VALUES ($1, $2, $3, $4) RETURNING id`,
                [actor.tenantId, request.examInstanceId, student.personId, student.enrollmentId]
            );
            await client.query(
                `INSERT INTO secure_assessment_exam_participant_addition_entries
                     (participant_addition_id, tenant_id, exam_instance_id, exam_participant_id, academic_enrollment_id)
                 VALUES ($1, $2, $3, $4, $5)`,
                [additionId, actor.tenantId, request.examInstanceId, participant.rows[0].id, student.enrollmentId]
            );
        }
        // READY is re-evaluated after the change: the exam is scheduled again (D04.2-25).
        if (exam.lifecycle_state === 'READY') {
            await client.query(
                `UPDATE secure_assessment_exam_instances SET lifecycle_state = 'SCHEDULED'
                 WHERE id = $1 AND tenant_id = $2 AND lifecycle_state = 'READY'`,
                [request.examInstanceId, actor.tenantId]
            );
            await client.query(
                `INSERT INTO secure_assessment_exam_lifecycle_events (tenant_id, exam_instance_id, from_state, to_state, actor_person_id, occurred_at)
                 VALUES ($1, $2, 'READY', 'SCHEDULED', $3, $4)`,
                [actor.tenantId, request.examInstanceId, actor.personId, addedAt]
            );
        }
        await client.query('COMMIT');
        return {
            type: 'added', examInstanceId: request.examInstanceId, lifecycleState: 'SCHEDULED', addedAt: iso(addedAt),
            added: fresh.map(s => ({ enrollmentId: s.enrollmentId, elligbleId: s.elligbleId })),
            replayed: false,
        };
    } catch (err) {
        await client.query('ROLLBACK').catch(() => {});
        const failure = err as { code?: string; constraint?: string };
        if (failure?.code === '23505') {
            // The same key used at the same moment for another exam: the unique key decides.
            if (failure.constraint === 'uq_sa_participant_addition_action_key') return { type: 'action_key_reused' };
            if (failure.constraint === 'uq_sa_exam_participants_tenant_instance_person') {
                return { type: 'invalid', problems: [{ code: 'already_participant' }] };
            }
        }
        return { type: 'unavailable' };
    } finally {
        client.release();
    }
}
