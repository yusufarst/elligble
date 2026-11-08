import { randomUUID } from 'node:crypto';
import type * as http from 'node:http';
import type * as pg from 'pg';
import { listElligbleIds } from '../../identity-access/src/directory.ts';
import { schoolOperatorAssignment } from '../../tenant-access/src/school-operator.ts';
import { AuthenticationError, buildAuthenticatedContext } from './http/authenticated-context.ts';
import { HttpError, readJsonObject, sendJson } from './http/http-utils.ts';
import type { SessionCookieConfig } from './http/session-credentials.ts';
import { evaluateExamReadiness } from './exam-lifecycle-operations.ts';
import {
    checkExamInstanceBaselineQuestionSnapshotContentReadiness, type BaselineQuestionSnapshotContentReadinessResult,
} from './exam-instance-baseline-question-snapshot-content-readiness-preflight.ts';
import { LATEST_START_POLICIES, buildImportedFrozenContent, listEnrolledStudents, type LatestStartPolicy } from './exam-provisioning.ts';
import { lockManagedExam } from './managed-exam.ts';
import { normalizePermissionReason, permissionDigest } from './permission-action-audit.ts';
import { QUESTIONS_TEMPLATE, parseQuestionFile } from './question-import.ts';
import { recordExamCancellation } from './teacher-exam-cancel.ts';
import {
    MAX_DURATION_MINUTES, MAX_QUESTION_FILE_CHARS, cleanFileName, isRealLocalDateTime, overlappingPersonIds, previewQuestionsOf, sha256Hex,
    type ImportProblem, type TeacherExamImportPreview,
} from './teacher-exam-import.ts';

// Institution exams (ASSESS-INSTITUTION-001; Owner O05-1, O05-2, A04-1, OP-1..OP-9, OB-1). The School
// Operator composes an exam period: sessions (a date and a time slot), and in each session one
// ExamInstance per subject x rombel, bound to one teaching assignment, placed with its duration,
// late-start rule and preparation deadline. The participants are the students enrolled in the rombel on
// the session date (OP-6 A). The Operator extends a deadline (reason, confirmation, audit), marks an exam
// ready after its deadline and cancels one that has not opened (archived, never deleted), and never sees
// a prompt, option, key, rubric or score (P5 A10, P01). The subject Teacher, who holds the exam's
// teaching assignment, prepares its questions through the import checks before the deadline and may
// replace them until then (OP-2 A: the earlier snapshots of a never-opened exam are removed; every import
// batch stays). After the deadline the content is final (the 0062 content lock).
//
// Operator writes: exact body, authentication, BEGIN, the action-key lock, re-authentication with the
// School Operator assignment FOR SHARE, the replay, the object lock, the checks and the writes, then a
// last re-authentication and COMMIT (§4.2). Every write is kept in an owning-domain append-only row with
// the actor, the time, the action key and the request digest (E9).

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SHA256_HEX = /^[0-9a-f]{64}$/;
export const LOCAL_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;
export const LOCAL_TIME = /^(\d{2}):(\d{2})$/;
export const INSTITUTION_LABEL_MAX_LENGTH = 120;
/** The content routes carry the question file, as the teacher import does (server.ts). */
export const INSTITUTION_CONTENT_BODY_LIMIT_BYTES = 1024 * 1024;

export const INSTITUTION_ROUTES = {
    overview: '/api/v1/assessment/institution-exams',
    periods: '/api/v1/assessment/institution-exams/periods',
    sessions: '/api/v1/assessment/institution-exams/sessions',
    placements: '/api/v1/assessment/institution-exams/placements',
    deadline: '/api/v1/assessment/institution-exams/deadline',
    cancel: '/api/v1/assessment/institution-exams/cancel',
    transition: '/api/v1/assessment/institution-exams/transition',
} as const;

export type CompositionProblemCode =
    | 'label_invalid' | 'label_taken' | 'assessment_type_unknown' | 'academic_period_unknown' | 'academic_period_ended'
    | 'time_zone_missing' | 'date_invalid' | 'time_invalid' | 'window_order' | 'window_ended' | 'date_outside_period' | 'session_taken'
    | 'teaching_assignment_unknown' | 'teaching_assignment_other_period' | 'already_placed' | 'session_started'
    | 'duration_invalid' | 'duration_exceeds_window' | 'deadline_invalid' | 'deadline_passed' | 'deadline_not_before_session'
    | 'deadline_not_later' | 'no_participants' | 'schedule_conflict';

export interface CompositionProblem { code: CompositionProblemCode; count?: number }

export interface InstitutionActor { tenantId: string; personId: string }

// ---------------------------------------------------------------------------------------------
// Request bodies (exact keys and shapes; 400 otherwise, before any connection).

const uuid = (value: unknown): value is string => typeof value === 'string' && UUID.test(value);

/** The body has exactly these keys. */
export function hasExactKeys(body: Record<string, unknown>, keys: readonly string[]): boolean {
    const present = Object.keys(body);
    return present.length === keys.length && keys.every(key => Object.hasOwn(body, key));
}

/** A period label as recorded: inner whitespace collapsed, trimmed, 1 to 120 characters; null when unusable. */
export function normalizeInstitutionLabel(value: unknown): string | null {
    if (typeof value !== 'string') return null;
    const text = value.replace(/[\u0000-\u001f\u007f\s]+/g, ' ').trim();
    return text && [...text].length <= INSTITUTION_LABEL_MAX_LENGTH ? text : null;
}

/** A `YYYY-MM-DD` value naming a real calendar date. */
export function isRealDate(value: string): boolean {
    const m = LOCAL_DATE.exec(value);
    if (!m) return false;
    const [y, mo, d] = m.slice(1).map(Number);
    const date = new Date(Date.UTC(y, mo - 1, d));
    return date.getUTCFullYear() === y && date.getUTCMonth() === mo - 1 && date.getUTCDate() === d;
}

/** A `HH:MM` value naming a real time of day. */
export function isRealTime(value: string): boolean {
    const m = LOCAL_TIME.exec(value);
    return !!m && Number(m[1]) < 24 && Number(m[2]) < 60;
}

export interface PeriodRequest { label: string; assessmentTypeId: string; academicPeriodId: string; actionKey: string }
export interface SessionRequest { periodId: string; date: string; startTime: string; endTime: string; actionKey: string }
export interface PlacementRequest {
    sessionId: string; teachingAssignmentId: string; durationMinutes: number; latestStartPolicy: LatestStartPolicy;
    /** Wall-clock date and time in the school's zone, `YYYY-MM-DDTHH:MM`. */
    preparationDeadline: string; actionKey: string;
}
export interface DeadlineRequest { examInstanceId: string; preparationDeadline: string; expectedRevision: number; reason: string; actionKey: string }
export interface CancelRequest { examInstanceId: string; reason: string; actionKey: string }
export interface TransitionRequest { examInstanceId: string; action: 'mark_ready' }
export interface ContentRequest {
    examInstanceId: string; questionsCsv: string; sourceFileName: string | null;
    /** Confirmation only. */
    importKey?: string; expectedSha256?: string;
}

export function parsePeriodRequest(body: Record<string, unknown>): PeriodRequest | null {
    if (!hasExactKeys(body, ['label', 'assessmentTypeId', 'academicPeriodId', 'actionKey'])) return null;
    const { label, assessmentTypeId, academicPeriodId, actionKey } = body;
    if (typeof label !== 'string' || !uuid(assessmentTypeId) || !uuid(academicPeriodId) || !uuid(actionKey)) return null;
    return { label, assessmentTypeId: assessmentTypeId.toLowerCase(), academicPeriodId: academicPeriodId.toLowerCase(), actionKey: actionKey.toLowerCase() };
}

export function parseSessionRequest(body: Record<string, unknown>): SessionRequest | null {
    if (!hasExactKeys(body, ['periodId', 'date', 'startTime', 'endTime', 'actionKey'])) return null;
    const { periodId, date, startTime, endTime, actionKey } = body;
    if (!uuid(periodId) || !uuid(actionKey) || typeof date !== 'string' || typeof startTime !== 'string' || typeof endTime !== 'string') return null;
    return { periodId: periodId.toLowerCase(), date, startTime, endTime, actionKey: actionKey.toLowerCase() };
}

export function parsePlacementRequest(body: Record<string, unknown>): PlacementRequest | null {
    if (!hasExactKeys(body, ['sessionId', 'teachingAssignmentId', 'durationMinutes', 'latestStartPolicy', 'preparationDeadline', 'actionKey'])) return null;
    const { sessionId, teachingAssignmentId, durationMinutes, latestStartPolicy, preparationDeadline, actionKey } = body;
    if (!uuid(sessionId) || !uuid(teachingAssignmentId) || !uuid(actionKey)) return null;
    if (typeof durationMinutes !== 'number' || !Number.isFinite(durationMinutes)) return null;
    if (typeof latestStartPolicy !== 'string' || !LATEST_START_POLICIES.includes(latestStartPolicy as LatestStartPolicy)) return null;
    if (typeof preparationDeadline !== 'string') return null;
    return {
        sessionId: sessionId.toLowerCase(), teachingAssignmentId: teachingAssignmentId.toLowerCase(), durationMinutes,
        latestStartPolicy: latestStartPolicy as LatestStartPolicy, preparationDeadline, actionKey: actionKey.toLowerCase(),
    };
}

export function parseDeadlineRequest(body: Record<string, unknown>): DeadlineRequest | null {
    if (!hasExactKeys(body, ['examInstanceId', 'preparationDeadline', 'expectedRevision', 'reason', 'confirmed', 'actionKey'])) return null;
    const { examInstanceId, preparationDeadline, expectedRevision, confirmed, actionKey } = body;
    const reason = normalizePermissionReason(body.reason);
    if (!uuid(examInstanceId) || !uuid(actionKey) || typeof preparationDeadline !== 'string') return null;
    if (typeof expectedRevision !== 'number' || !Number.isInteger(expectedRevision) || expectedRevision < 1) return null;
    if (reason === null || confirmed !== true) return null;
    return { examInstanceId: examInstanceId.toLowerCase(), preparationDeadline, expectedRevision, reason, actionKey: actionKey.toLowerCase() };
}

export function parseCancelRequest(body: Record<string, unknown>): CancelRequest | null {
    if (!hasExactKeys(body, ['examInstanceId', 'reason', 'confirmed', 'actionKey'])) return null;
    const { examInstanceId, confirmed, actionKey } = body;
    const reason = normalizePermissionReason(body.reason);
    if (!uuid(examInstanceId) || !uuid(actionKey) || reason === null || confirmed !== true) return null;
    return { examInstanceId: examInstanceId.toLowerCase(), reason, actionKey: actionKey.toLowerCase() };
}

export function parseTransitionRequest(body: Record<string, unknown>): TransitionRequest | null {
    if (!hasExactKeys(body, ['examInstanceId', 'action'])) return null;
    if (!uuid(body.examInstanceId) || body.action !== 'mark_ready') return null;
    return { examInstanceId: body.examInstanceId.toLowerCase(), action: 'mark_ready' };
}

export function parseContentRequest(body: Record<string, unknown>, confirm: boolean): ContentRequest | null {
    const keys = confirm
        ? ['examInstanceId', 'questionsCsv', 'sourceFileName', 'importKey', 'expectedSha256']
        : ['examInstanceId', 'questionsCsv', 'sourceFileName'];
    if (!hasExactKeys(body, keys)) return null;
    const { examInstanceId, questionsCsv } = body;
    if (!uuid(examInstanceId) || typeof questionsCsv !== 'string') return null;
    const sourceFileName = cleanFileName(body.sourceFileName);
    if (sourceFileName === undefined) return null;
    const request: ContentRequest = { examInstanceId: examInstanceId.toLowerCase(), questionsCsv, sourceFileName };
    if (confirm) {
        const { importKey, expectedSha256 } = body;
        if (!uuid(importKey) || typeof expectedSha256 !== 'string' || !SHA256_HEX.test(expectedSha256)) return null;
        request.importKey = importKey.toLowerCase();
        request.expectedSha256 = expectedSha256;
    }
    return request;
}

// ---------------------------------------------------------------------------------------------
// Pure rules.

/** The two school-zone wall-clock values of a session slot (a session never crosses midnight). */
export function sessionLocals(date: string, startTime: string, endTime: string): [string, string] {
    return [`${date}T${startTime}`, `${date}T${endTime}`];
}

/** The existing duration/window/policy rule: only "Tidak boleh terlambat" needs the duration to fit the window. */
export function durationFitsWindow(durationMinutes: number, startsAt: Date, endsAt: Date, policy: LatestStartPolicy): boolean {
    return policy !== 'LATE_START_BLOCKED' || durationMinutes * 60 <= (endsAt.getTime() - startsAt.getTime()) / 1000;
}

/**
 * The deadline rule (O05-2, OP-4 A): a new deadline lies in the future, before the session starts and,
 * for an extension, after the current one (which may already have passed).
 */
export function deadlineProblems(deadline: Date, context: { now: Date; sessionStartsAt: Date; current?: Date | null }): CompositionProblemCode[] {
    const problems: CompositionProblemCode[] = [];
    if (context.current && !(deadline.getTime() > context.current.getTime())) problems.push('deadline_not_later');
    if (!(deadline.getTime() > context.now.getTime())) problems.push('deadline_passed');
    if (!(deadline.getTime() < context.sessionStartsAt.getTime())) problems.push('deadline_not_before_session');
    return problems;
}

/** The questions are final: the deadline has passed (or there is none) or the exam is no longer SCHEDULED. */
export function isPreparationClosed(lifecycleState: string, deadline: Date | null, now: Date): boolean {
    return lifecycleState !== 'SCHEDULED' || deadline === null || !(now.getTime() < deadline.getTime());
}

export type ContentReadinessDecision =
    | { kind: 'accepted' }
    | { kind: 'invalid'; problem: ImportProblem }
    | { kind: 'unavailable' };

/**
 * The content check after the new snapshots are inserted (E6): ready is accepted; an empty or invalid
 * snapshot is a content problem (422 import_invalid); invalid_state, denied and unavailable are an
 * internal fault (503, rolled back), because the state was checked under the lock.
 */
export function mapContentReadiness(result: BaselineQuestionSnapshotContentReadinessResult): ContentReadinessDecision {
    switch (result.type) {
        case 'baseline_question_snapshot_content_ready': return { kind: 'accepted' };
        case 'not_ready': return { kind: 'invalid', problem: { source: 'setup', code: 'not_ready', blocker: result.blocker } };
        default: return { kind: 'unavailable' };
    }
}

/** School-zone wall-clock values (`YYYY-MM-DDTHH:MM`) as instants, converted with the tenant time zone as the import does. */
export async function schoolInstants(client: Pick<pg.ClientBase, 'query'>, timeZone: string, locals: readonly string[]): Promise<{ instants: Date[]; now: Date }> {
    const columns = locals.map((_, i) => `($${i + 2}::timestamp AT TIME ZONE $1) AS t${i}`);
    const res = await client.query(`SELECT ${[...columns, 'statement_timestamp() AS db_now'].join(', ')}`, [timeZone, ...locals]);
    const row = res.rows[0];
    return { instants: locals.map((_, i) => new Date(row[`t${i}`])), now: new Date(row.db_now) };
}

function iso(value: unknown): string {
    return (value instanceof Date ? value : new Date(String(value))).toISOString();
}

function isoOrNull(value: unknown): string | null {
    return value === null || value === undefined ? null : iso(value);
}

function digestOf(actor: InstitutionActor, kind: string, payload: object): string {
    return permissionDigest({ version: 1, tenantId: actor.tenantId, actorPersonId: actor.personId, kind, payload });
}

// ---------------------------------------------------------------------------------------------
// Transactions.

class InstitutionRefusal extends Error {
    readonly status: number;
    readonly body: Record<string, unknown>;
    constructor(status: number, body: Record<string, unknown>) { super(String(body.error)); this.status = status; this.body = body; }
}

function refuse(status: number, error: string, extra: Record<string, unknown> = {}): never {
    throw new InstitutionRefusal(status, { error, ...extra });
}
function invalid(problems: CompositionProblem[]): never {
    return refuse(422, 'composition_invalid', { problems });
}

interface Outcome { status: number; body: unknown }

function errorCode(error: unknown): string {
    return typeof error === 'object' && error !== null && typeof (error as { code?: unknown }).code === 'string' ? (error as { code: string }).code : '';
}

/** The answer of a failed request: refusals, authentication, then the database error classes (§4.2). */
export function institutionFailure(error: unknown): Outcome {
    if (error instanceof InstitutionRefusal) return { status: error.status, body: error.body };
    if (error instanceof AuthenticationError) return { status: error.statusCode, body: { error: error.message } };
    if (error instanceof HttpError) return { status: error.statusCode, body: { error: error.message } };
    const code = errorCode(error);
    if (code === '40001' || code === '40P01') return { status: 409, body: { error: 'state_changed' } };
    if (code === '23505') {
        const constraint = String((error as { constraint?: unknown }).constraint ?? '');
        if (constraint === 'uq_sa_institution_period_label') return { status: 422, body: { error: 'composition_invalid', problems: [{ code: 'label_taken' }] } };
        if (constraint === 'uq_sa_institution_session_slot') return { status: 422, body: { error: 'composition_invalid', problems: [{ code: 'session_taken' }] } };
        if (constraint.includes('action_key')) return { status: 409, body: { error: 'action_key_reused' } };
        return { status: 409, body: { error: 'state_changed' } };
    }
    if (/^(08|53|57)/.test(code) || code.startsWith('ECONN')) return { status: 503, body: { error: 'persistence_unavailable' } };
    return { status: 500, body: { error: 'internal_error' } };
}

async function sameOperator(req: http.IncomingMessage, pool: pg.Pool, cookie: SessionCookieConfig, client: pg.PoolClient, actor: InstitutionActor, lock: boolean): Promise<void> {
    const membership = await buildAuthenticatedContext(req, pool, { cookie, client, mutation: true });
    if (!membership || membership.tenantId !== actor.tenantId || membership.personId !== actor.personId
        || !(await schoolOperatorAssignment(client, actor.tenantId, membership.membershipId, lock))) {
        refuse(403, 'forbidden');
    }
}

/** One Operator write (§4.2): authentication, the action-key lock, the Operator assignment FOR SHARE, the run, re-authentication, COMMIT. */
async function operatorWrite(
    req: http.IncomingMessage, pool: pg.Pool, cookie: SessionCookieConfig,
    kind: string, actionKey: string | null,
    run: (client: pg.PoolClient, actor: InstitutionActor) => Promise<Outcome>
): Promise<Outcome> {
    let initial;
    try {
        initial = await buildAuthenticatedContext(req, pool, { cookie });
    } catch (error) {
        return institutionFailure(error);
    }
    if (!initial) return { status: 403, body: { error: 'forbidden' } };
    const actor: InstitutionActor = { tenantId: initial.tenantId, personId: initial.personId };
    let client: pg.PoolClient;
    try {
        client = await pool.connect();
    } catch {
        return { status: 503, body: { error: 'persistence_unavailable' } };
    }
    try {
        await client.query('BEGIN');
        if (actionKey) {
            await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`sa-institution:${actor.tenantId}:${kind}:${actionKey}`]);
        }
        await sameOperator(req, pool, cookie, client, actor, true);
        const outcome = await run(client, actor);
        // Recheck the session and the assignment after every blocking lock and effect, before commit.
        await sameOperator(req, pool, cookie, client, actor, true);
        await client.query('COMMIT');
        return outcome;
    } catch (error) {
        await client.query('ROLLBACK').catch(() => {});
        return institutionFailure(error);
    } finally {
        client.release();
    }
}

/** One Operator read (§4.2): authentication through the pool, then a read-only snapshot with the assignment check. */
async function operatorRead(
    req: http.IncomingMessage, pool: pg.Pool, cookie: SessionCookieConfig,
    run: (client: pg.PoolClient, actor: InstitutionActor) => Promise<Outcome>
): Promise<Outcome> {
    let initial;
    try {
        initial = await buildAuthenticatedContext(req, pool, { cookie });
    } catch (error) {
        return institutionFailure(error);
    }
    if (!initial) return { status: 403, body: { error: 'forbidden' } };
    let client: pg.PoolClient;
    try {
        client = await pool.connect();
    } catch {
        return { status: 503, body: { error: 'persistence_unavailable' } };
    }
    try {
        await client.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
        if (!(await schoolOperatorAssignment(client, initial.tenantId, initial.membershipId))) refuse(403, 'forbidden');
        const outcome = await run(client, { tenantId: initial.tenantId, personId: initial.personId });
        await client.query('COMMIT');
        return outcome;
    } catch (error) {
        await client.query('ROLLBACK').catch(() => {});
        const failed = institutionFailure(error);
        // A read has nothing to retry under another key: database faults are unavailability.
        return failed.status === 500 ? { status: 503, body: { error: 'persistence_unavailable' } } : failed;
    } finally {
        client.release();
    }
}

// ---------------------------------------------------------------------------------------------
// Operator reads (§4.3, E8: operational data only).

async function teacherIds(client: pg.PoolClient, personIds: Array<string | null>): Promise<Map<string, string>> {
    return listElligbleIds(client, [...new Set(personIds.filter((id): id is string => typeof id === 'string'))]);
}

async function readOverview(client: pg.PoolClient, actor: InstitutionActor): Promise<Outcome> {
    const tenant = await client.query('SELECT time_zone FROM tenant_tenants WHERE id = $1', [actor.tenantId]);
    const types = await client.query(
        'SELECT id, display_label FROM secure_assessment_assessment_types WHERE tenant_id = $1 ORDER BY display_label, id', [actor.tenantId]);
    const academicPeriods = await client.query(
        `SELECT id, display_label, to_char(start_date, 'YYYY-MM-DD') AS start_date, to_char(end_date, 'YYYY-MM-DD') AS end_date
         FROM academic_core_academic_periods WHERE tenant_id = $1 ORDER BY start_date DESC, display_label, id`, [actor.tenantId]);
    const assignments = await client.query(
        `SELECT ata.id, s.display_label AS subject_label, g.display_label AS group_label, o.academic_period_id, tm.person_id
         FROM academic_core_teaching_assignments ata
         JOIN tenant_teacher_assignments tta ON tta.id = ata.teacher_assignment_id AND tta.tenant_id = ata.tenant_id AND tta.revoked_at IS NULL
         JOIN tenant_memberships tm ON tm.id = tta.membership_id AND tm.tenant_id = tta.tenant_id
         JOIN academic_core_subject_offerings o ON o.id = ata.subject_offering_id AND o.tenant_id = ata.tenant_id
         JOIN academic_core_subjects s ON s.id = o.subject_id AND s.tenant_id = o.tenant_id
         JOIN academic_core_academic_groups g ON g.id = ata.academic_group_id AND g.tenant_id = ata.tenant_id
         JOIN academic_core_academic_periods p ON p.id = o.academic_period_id AND p.tenant_id = o.tenant_id
         WHERE ata.tenant_id = $1 AND ata.revoked_at IS NULL
         ORDER BY p.start_date DESC, p.id, s.display_label, g.display_label, ata.id`, [actor.tenantId]);
    const ids = await teacherIds(client, assignments.rows.map(r => r.person_id));
    const periods = await client.query(
        `SELECT ep.id, ep.label, t.display_label AS assessment_type_label, ap.display_label AS academic_period_label,
                (SELECT count(*)::int FROM secure_assessment_institution_exam_sessions s
                 WHERE s.tenant_id = ep.tenant_id AND s.period_id = ep.id) AS session_count,
                (SELECT count(*)::int FROM secure_assessment_exam_instances i
                 JOIN secure_assessment_institution_exam_sessions s ON s.id = i.institution_session_id AND s.tenant_id = i.tenant_id
                 WHERE s.tenant_id = ep.tenant_id AND s.period_id = ep.id
                   AND NOT EXISTS (SELECT 1 FROM secure_assessment_exam_cancellations c WHERE c.tenant_id = i.tenant_id AND c.exam_instance_id = i.id)
                ) AS exam_count
         FROM secure_assessment_institution_exam_periods ep
         JOIN secure_assessment_assessment_types t ON t.id = ep.assessment_type_id AND t.tenant_id = ep.tenant_id
         JOIN academic_core_academic_periods ap ON ap.id = ep.academic_period_id AND ap.tenant_id = ep.tenant_id
         WHERE ep.tenant_id = $1
         ORDER BY ep.created_at DESC, ep.id DESC`, [actor.tenantId]);
    return {
        status: 200,
        body: {
            timeZone: tenant.rows[0]?.time_zone ?? null,
            limits: { maxDurationMinutes: MAX_DURATION_MINUTES },
            assessmentTypes: types.rows.map(r => ({ assessmentTypeId: r.id, label: r.display_label })),
            academicPeriods: academicPeriods.rows.map(r => ({ academicPeriodId: r.id, label: r.display_label, startDate: r.start_date, endDate: r.end_date })),
            teachingAssignments: assignments.rows.map(r => ({
                teachingAssignmentId: r.id, subjectLabel: r.subject_label, groupLabel: r.group_label, academicPeriodId: r.academic_period_id,
                teacherElligbleId: ids.get(r.person_id) ?? null,
            })),
            periods: periods.rows.map(r => ({
                periodId: r.id, label: r.label, assessmentTypeLabel: r.assessment_type_label, academicPeriodLabel: r.academic_period_label,
                sessionCount: r.session_count, examCount: r.exam_count,
            })),
        },
    };
}

async function readPeriod(client: pg.PoolClient, actor: InstitutionActor, periodId: string): Promise<Outcome> {
    const period = await client.query(
        `SELECT ep.id, ep.label, t.display_label AS assessment_type_label, ap.display_label AS academic_period_label
         FROM secure_assessment_institution_exam_periods ep
         JOIN secure_assessment_assessment_types t ON t.id = ep.assessment_type_id AND t.tenant_id = ep.tenant_id
         JOIN academic_core_academic_periods ap ON ap.id = ep.academic_period_id AND ap.tenant_id = ep.tenant_id
         WHERE ep.id = $2 AND ep.tenant_id = $1`, [actor.tenantId, periodId]);
    if (period.rows.length !== 1) refuse(403, 'forbidden');
    const sessions = await client.query(
        `SELECT id, starts_at, ends_at FROM secure_assessment_institution_exam_sessions
         WHERE tenant_id = $1 AND period_id = $2 ORDER BY starts_at, ends_at, id`, [actor.tenantId, periodId]);
    const exams = await client.query(
        `SELECT i.id, i.institution_session_id, i.lifecycle_state, i.configured_attempt_duration_seconds, i.latest_start_policy,
                s.display_label AS subject_label, g.display_label AS group_label, tm.person_id AS teacher_person_id, c.cancelled_at,
                (SELECT count(*)::int FROM secure_assessment_exam_participants pc WHERE pc.tenant_id = i.tenant_id AND pc.exam_instance_id = i.id) AS participants,
                (SELECT count(*)::int FROM secure_assessment_exam_question_snapshots qs WHERE qs.tenant_id = i.tenant_id AND qs.exam_instance_id = i.id) AS question_count,
                d.deadline_at, d.revision, (d.deadline_at IS NULL OR d.deadline_at <= statement_timestamp()) AS deadline_passed,
                b.imported_at, b.source_file_name
         FROM secure_assessment_exam_instances i
         JOIN secure_assessment_institution_exam_sessions es ON es.id = i.institution_session_id AND es.tenant_id = i.tenant_id
         JOIN academic_core_teaching_assignments ata ON ata.id = i.teaching_assignment_id AND ata.tenant_id = i.tenant_id
         LEFT JOIN tenant_teacher_assignments tta ON tta.id = ata.teacher_assignment_id AND tta.tenant_id = ata.tenant_id
         LEFT JOIN tenant_memberships tm ON tm.id = tta.membership_id AND tm.tenant_id = tta.tenant_id
         LEFT JOIN academic_core_subject_offerings o ON o.id = ata.subject_offering_id AND o.tenant_id = ata.tenant_id
         LEFT JOIN academic_core_subjects s ON s.id = o.subject_id AND s.tenant_id = o.tenant_id
         LEFT JOIN academic_core_academic_groups g ON g.id = ata.academic_group_id AND g.tenant_id = ata.tenant_id
         LEFT JOIN secure_assessment_exam_cancellations c ON c.tenant_id = i.tenant_id AND c.exam_instance_id = i.id
         LEFT JOIN LATERAL (
             SELECT dl.deadline_at, dl.revision FROM secure_assessment_institution_preparation_deadlines dl
             WHERE dl.tenant_id = i.tenant_id AND dl.exam_instance_id = i.id ORDER BY dl.revision DESC LIMIT 1
         ) d ON TRUE
         LEFT JOIN LATERAL (
             SELECT ib.imported_at, ib.source_file_name FROM secure_assessment_question_import_batches ib
             WHERE ib.tenant_id = i.tenant_id AND ib.exam_instance_id = i.id ORDER BY ib.imported_at DESC, ib.id DESC LIMIT 1
         ) b ON TRUE
         WHERE es.tenant_id = $1 AND es.period_id = $2
         ORDER BY s.display_label, g.display_label, i.id`, [actor.tenantId, periodId]);
    const ids = await teacherIds(client, exams.rows.map(r => r.teacher_person_id));
    const items = new Map<string, unknown[]>();
    for (const row of exams.rows) {
        const closed = row.deadline_passed === true || row.lifecycle_state !== 'SCHEDULED';
        let readiness: { baseline: unknown; roomProctor: unknown } | null = null;
        // E15: readiness only where "Tandai Siap" applies, a SCHEDULED exam past its deadline.
        if (row.lifecycle_state === 'SCHEDULED' && row.deadline_passed === true && !row.cancelled_at) {
            const evaluated = await evaluateExamReadiness(client, actor.tenantId, row.id);
            readiness = { baseline: evaluated.baseline, roomProctor: evaluated.roomProctor };
        }
        const questionCount = Number(row.question_count ?? 0);
        const list = items.get(row.institution_session_id) ?? [];
        list.push({
            examInstanceId: row.id,
            subjectLabel: row.subject_label ?? null,
            groupLabel: row.group_label ?? null,
            teacherElligbleId: row.teacher_person_id ? ids.get(row.teacher_person_id) ?? null : null,
            lifecycleState: row.lifecycle_state,
            cancelledAt: isoOrNull(row.cancelled_at),
            durationMinutes: Math.round(Number(row.configured_attempt_duration_seconds) / 60),
            latestStartPolicy: row.latest_start_policy,
            participants: Number(row.participants ?? 0),
            preparation: {
                deadline: isoOrNull(row.deadline_at),
                revision: Number(row.revision ?? 1),
                closed,
                questionCount,
                preparedAt: questionCount > 0 ? isoOrNull(row.imported_at) : null,
                sourceFileName: questionCount > 0 ? row.source_file_name ?? null : null,
            },
            readiness,
        });
        items.set(row.institution_session_id, list);
    }
    const p = period.rows[0];
    return {
        status: 200,
        body: {
            period: { periodId: p.id, label: p.label, assessmentTypeLabel: p.assessment_type_label, academicPeriodLabel: p.academic_period_label },
            sessions: sessions.rows.map(s => ({ sessionId: s.id, startsAt: iso(s.starts_at), endsAt: iso(s.ends_at), exams: items.get(s.id) ?? [] })),
        },
    };
}

// ---------------------------------------------------------------------------------------------
// Operator writes (§4.3).

async function createPeriod(client: pg.PoolClient, actor: InstitutionActor, request: PeriodRequest): Promise<Outcome> {
    const label = normalizeInstitutionLabel(request.label);
    const digest = digestOf(actor, 'period', { label: label ?? request.label, assessmentTypeId: request.assessmentTypeId, academicPeriodId: request.academicPeriodId });
    const earlier = await client.query(
        'SELECT id, created_by_person_id, request_digest FROM secure_assessment_institution_exam_periods WHERE tenant_id = $1 AND action_key = $2',
        [actor.tenantId, request.actionKey]);
    if (earlier.rows.length === 1) {
        const row = earlier.rows[0];
        if (row.created_by_person_id !== actor.personId || row.request_digest !== digest) refuse(409, 'action_key_reused');
        return { status: 200, body: { periodId: row.id, replayed: true } };
    }
    const problems: CompositionProblem[] = [];
    if (label === null) problems.push({ code: 'label_invalid' });
    const type = await client.query('SELECT 1 FROM secure_assessment_assessment_types WHERE id = $1 AND tenant_id = $2', [request.assessmentTypeId, actor.tenantId]);
    if (type.rows.length !== 1) problems.push({ code: 'assessment_type_unknown' });
    const academic = await client.query(
        `SELECT (p.end_date < (statement_timestamp() AT TIME ZONE coalesce(t.time_zone, 'UTC'))::date) AS ended
         FROM academic_core_academic_periods p JOIN tenant_tenants t ON t.id = p.tenant_id
         WHERE p.id = $1 AND p.tenant_id = $2`, [request.academicPeriodId, actor.tenantId]);
    if (academic.rows.length !== 1) problems.push({ code: 'academic_period_unknown' });
    else if (academic.rows[0].ended === true) problems.push({ code: 'academic_period_ended' });
    if (label !== null && academic.rows.length === 1) {
        const taken = await client.query(
            'SELECT 1 FROM secure_assessment_institution_exam_periods WHERE tenant_id = $1 AND academic_period_id = $2 AND label = $3',
            [actor.tenantId, request.academicPeriodId, label]);
        if (taken.rows.length > 0) problems.push({ code: 'label_taken' });
    }
    if (problems.length > 0) invalid(problems);
    const created = await client.query(
        `INSERT INTO secure_assessment_institution_exam_periods
             (tenant_id, academic_period_id, assessment_type_id, label, created_by_person_id, action_key, request_digest)
         VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
        [actor.tenantId, request.academicPeriodId, request.assessmentTypeId, label, actor.personId, request.actionKey, digest]);
    return { status: 201, body: { periodId: created.rows[0].id, replayed: false } };
}

async function createSession(client: pg.PoolClient, actor: InstitutionActor, request: SessionRequest): Promise<Outcome> {
    const digest = digestOf(actor, 'session', { periodId: request.periodId, date: request.date, startTime: request.startTime, endTime: request.endTime });
    const earlier = await client.query(
        `SELECT id, created_by_person_id, request_digest, starts_at, ends_at FROM secure_assessment_institution_exam_sessions
         WHERE tenant_id = $1 AND action_key = $2`, [actor.tenantId, request.actionKey]);
    if (earlier.rows.length === 1) {
        const row = earlier.rows[0];
        if (row.created_by_person_id !== actor.personId || row.request_digest !== digest) refuse(409, 'action_key_reused');
        return { status: 200, body: { sessionId: row.id, startsAt: iso(row.starts_at), endsAt: iso(row.ends_at), replayed: true } };
    }
    const period = await client.query(
        `SELECT to_char(ap.start_date, 'YYYY-MM-DD') AS start_date, to_char(ap.end_date, 'YYYY-MM-DD') AS end_date, t.time_zone
         FROM secure_assessment_institution_exam_periods ep
         JOIN academic_core_academic_periods ap ON ap.id = ep.academic_period_id AND ap.tenant_id = ep.tenant_id
         JOIN tenant_tenants t ON t.id = ep.tenant_id
         WHERE ep.id = $1 AND ep.tenant_id = $2`, [request.periodId, actor.tenantId]);
    if (period.rows.length !== 1) refuse(403, 'forbidden');
    const { start_date: periodStart, end_date: periodEnd, time_zone: timeZone } = period.rows[0];
    const problems: CompositionProblem[] = [];
    if (!timeZone) problems.push({ code: 'time_zone_missing' });
    const dateValid = isRealDate(request.date);
    if (!dateValid) problems.push({ code: 'date_invalid' });
    const timesValid = isRealTime(request.startTime) && isRealTime(request.endTime);
    if (!timesValid) problems.push({ code: 'time_invalid' });
    let startsAt: Date | null = null;
    let endsAt: Date | null = null;
    if (timeZone && dateValid && timesValid) {
        const converted = await schoolInstants(client, timeZone, sessionLocals(request.date, request.startTime, request.endTime));
        [startsAt, endsAt] = converted.instants;
        if (!(endsAt.getTime() > startsAt.getTime())) problems.push({ code: 'window_order' });
        else if (!(endsAt.getTime() > converted.now.getTime())) problems.push({ code: 'window_ended' });
    }
    if (dateValid && (request.date < periodStart || request.date > periodEnd)) problems.push({ code: 'date_outside_period' });
    if (problems.length === 0) {
        const taken = await client.query(
            'SELECT 1 FROM secure_assessment_institution_exam_sessions WHERE tenant_id = $1 AND period_id = $2 AND starts_at = $3 AND ends_at = $4',
            [actor.tenantId, request.periodId, startsAt, endsAt]);
        if (taken.rows.length > 0) problems.push({ code: 'session_taken' });
    }
    if (problems.length > 0) invalid(problems);
    const created = await client.query(
        `INSERT INTO secure_assessment_institution_exam_sessions
             (tenant_id, period_id, starts_at, ends_at, created_by_person_id, action_key, request_digest)
         VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
        [actor.tenantId, request.periodId, startsAt, endsAt, actor.personId, request.actionKey, digest]);
    return { status: 201, body: { sessionId: created.rows[0].id, startsAt: iso(startsAt), endsAt: iso(endsAt), replayed: false } };
}

async function placeExam(client: pg.PoolClient, actor: InstitutionActor, request: PlacementRequest): Promise<Outcome> {
    const digest = digestOf(actor, 'placement', {
        sessionId: request.sessionId, teachingAssignmentId: request.teachingAssignmentId, durationMinutes: request.durationMinutes,
        latestStartPolicy: request.latestStartPolicy, preparationDeadline: request.preparationDeadline,
    });
    const earlier = await client.query(
        `SELECT d.exam_instance_id, d.set_by_person_id, d.request_digest, d.revision, d.deadline_at,
                (SELECT count(*)::int FROM secure_assessment_exam_participants p WHERE p.tenant_id = d.tenant_id AND p.exam_instance_id = d.exam_instance_id) AS participants
         FROM secure_assessment_institution_preparation_deadlines d WHERE d.tenant_id = $1 AND d.action_key = $2`,
        [actor.tenantId, request.actionKey]);
    if (earlier.rows.length === 1) {
        const row = earlier.rows[0];
        if (row.set_by_person_id !== actor.personId || row.request_digest !== digest || row.revision !== 1) refuse(409, 'action_key_reused');
        return { status: 200, body: { examInstanceId: row.exam_instance_id, participants: row.participants, preparationDeadline: iso(row.deadline_at), replayed: true } };
    }

    const session = await client.query(
        `SELECT s.starts_at, s.ends_at, s.period_id, ep.academic_period_id, ep.assessment_type_id, t.time_zone,
                to_char((s.starts_at AT TIME ZONE coalesce(t.time_zone, 'UTC'))::date, 'YYYY-MM-DD') AS session_day,
                (s.starts_at <= statement_timestamp()) AS started, statement_timestamp() AS db_now
         FROM secure_assessment_institution_exam_sessions s
         JOIN secure_assessment_institution_exam_periods ep ON ep.id = s.period_id AND ep.tenant_id = s.tenant_id
         JOIN tenant_tenants t ON t.id = s.tenant_id
         WHERE s.id = $1 AND s.tenant_id = $2`, [request.sessionId, actor.tenantId]);
    if (session.rows.length !== 1) refuse(403, 'forbidden');
    const slot = session.rows[0];
    const startsAt = new Date(slot.starts_at);
    const endsAt = new Date(slot.ends_at);

    // The teaching assignment and its teacher assignment stay active until the end (N07), without the
    // actor filter of the teacher import: the Operator is not the Teacher.
    const teaching = await client.query(
        `SELECT ata.id, ata.academic_group_id, ata.subject_offering_id, o.academic_period_id
         FROM academic_core_teaching_assignments ata
         JOIN tenant_teacher_assignments tta
           ON tta.id = ata.teacher_assignment_id AND tta.tenant_id = ata.tenant_id AND tta.revoked_at IS NULL
         JOIN academic_core_subject_offerings o ON o.id = ata.subject_offering_id AND o.tenant_id = ata.tenant_id
         WHERE ata.id = $1 AND ata.tenant_id = $2 AND ata.revoked_at IS NULL
         FOR SHARE OF ata, tta`, [request.teachingAssignmentId, actor.tenantId]);
    const problems: CompositionProblem[] = [];
    const assignment = teaching.rows[0] as { academic_group_id: string; subject_offering_id: string; academic_period_id: string } | undefined;
    if (!assignment) problems.push({ code: 'teaching_assignment_unknown' });
    else {
        // E4: one ExamInstance per period x subject x rombel, decided one at a time.
        await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [
            `sa-institution-placement:${actor.tenantId}:${slot.period_id}:${assignment.subject_offering_id}:${assignment.academic_group_id}`,
        ]);
        if (assignment.academic_period_id !== slot.academic_period_id) problems.push({ code: 'teaching_assignment_other_period' });
        const placed = await client.query(
            `SELECT 1 FROM secure_assessment_exam_instances i
             JOIN secure_assessment_institution_exam_sessions s ON s.id = i.institution_session_id AND s.tenant_id = i.tenant_id
             JOIN academic_core_teaching_assignments ata ON ata.id = i.teaching_assignment_id AND ata.tenant_id = i.tenant_id
             WHERE i.tenant_id = $1 AND s.period_id = $2 AND ata.subject_offering_id = $3 AND ata.academic_group_id = $4
               AND NOT EXISTS (SELECT 1 FROM secure_assessment_exam_cancellations c WHERE c.tenant_id = i.tenant_id AND c.exam_instance_id = i.id)`,
            [actor.tenantId, slot.period_id, assignment.subject_offering_id, assignment.academic_group_id]);
        if (placed.rows.length > 0) problems.push({ code: 'already_placed' });
    }
    if (slot.started === true) problems.push({ code: 'session_started' });
    const durationValid = Number.isInteger(request.durationMinutes) && request.durationMinutes >= 1 && request.durationMinutes <= MAX_DURATION_MINUTES;
    if (!durationValid) problems.push({ code: 'duration_invalid' });
    else if (!durationFitsWindow(request.durationMinutes, startsAt, endsAt, request.latestStartPolicy)) problems.push({ code: 'duration_exceeds_window' });
    let deadline: Date | null = null;
    if (!isRealLocalDateTime(request.preparationDeadline) || !slot.time_zone) problems.push({ code: 'deadline_invalid' });
    else {
        const converted = await schoolInstants(client, slot.time_zone, [request.preparationDeadline]);
        deadline = converted.instants[0];
        problems.push(...deadlineProblems(deadline, { now: converted.now, sessionStartsAt: startsAt }).map(code => ({ code })));
    }
    // OP-6 A: everyone enrolled in the rombel on the session's school-zone date.
    const seen = new Set<string>();
    const enrolled = assignment
        ? (await listEnrolledStudents(client, actor.tenantId, { groupId: assignment.academic_group_id, periodId: assignment.academic_period_id, examDay: slot.session_day }))
            .filter(s => (seen.has(s.personId) ? false : (seen.add(s.personId), true)))
        : [];
    if (assignment && enrolled.length === 0) problems.push({ code: 'no_participants' });
    if (enrolled.length > 0) {
        const conflicting = new Set(await overlappingPersonIds(client, actor.tenantId, enrolled.map(s => s.personId), startsAt, endsAt));
        const blocked = enrolled.filter(s => conflicting.has(s.personId)).length;
        if (blocked > 0) problems.push({ code: 'schedule_conflict', count: blocked });
    }
    if (problems.length > 0) invalid(problems);

    const exam = await client.query(
        `INSERT INTO secure_assessment_exam_instances (
            tenant_id, teaching_assignment_id, assessment_type_id, lifecycle_state,
            window_starts_at, window_ends_at, configured_attempt_duration_seconds, latest_start_policy,
            room_based_operations_enabled, proctor_per_room_required, institution_session_id
         ) VALUES ($1, $2, $3, 'DRAFT', $4, $5, $6, $7, FALSE, FALSE, $8) RETURNING id`,
        [actor.tenantId, request.teachingAssignmentId, slot.assessment_type_id, startsAt, endsAt, request.durationMinutes * 60,
            request.latestStartPolicy, request.sessionId]);
    const examInstanceId: string = exam.rows[0].id;
    for (const participant of enrolled) {
        await client.query(
            `INSERT INTO secure_assessment_exam_participants (tenant_id, exam_instance_id, person_id, academic_enrollment_id)
             VALUES ($1, $2, $3, $4)`,
            [actor.tenantId, examInstanceId, participant.personId, participant.enrollmentId]);
    }
    const scheduled = await client.query(
        `UPDATE secure_assessment_exam_instances SET lifecycle_state = 'SCHEDULED'
         WHERE id = $1 AND tenant_id = $2 AND lifecycle_state = 'DRAFT' RETURNING id`, [examInstanceId, actor.tenantId]);
    if (scheduled.rowCount !== 1) throw new Error('The exam could not be scheduled.');
    await client.query(
        `INSERT INTO secure_assessment_exam_lifecycle_events (tenant_id, exam_instance_id, from_state, to_state, actor_person_id)
         VALUES ($1, $2, 'DRAFT', 'SCHEDULED', $3)`, [actor.tenantId, examInstanceId, actor.personId]);
    await client.query(
        `INSERT INTO secure_assessment_institution_preparation_deadlines
             (tenant_id, exam_instance_id, revision, deadline_at, set_by_person_id, action_key, request_digest)
         VALUES ($1, $2, 1, $3, $4, $5, $6)`, [actor.tenantId, examInstanceId, deadline, actor.personId, request.actionKey, digest]);
    return { status: 201, body: { examInstanceId, participants: enrolled.length, preparationDeadline: iso(deadline), replayed: false } };
}

interface LockedInstitutionExam {
    lifecycle_state: string;
    session_starts_at: Date;
    time_zone: string | null;
}

/** This tenant's institution exam, FOR UPDATE (the lock of every lifecycle change); 403 otherwise, a teacher-managed exam included. */
async function lockInstitutionExam(client: pg.PoolClient, actor: InstitutionActor, examInstanceId: string): Promise<LockedInstitutionExam> {
    const res = await client.query(
        `SELECT i.lifecycle_state, s.starts_at AS session_starts_at, t.time_zone
         FROM secure_assessment_exam_instances i
         JOIN secure_assessment_institution_exam_sessions s ON s.id = i.institution_session_id AND s.tenant_id = i.tenant_id
         JOIN tenant_tenants t ON t.id = i.tenant_id
         WHERE i.id = $1 AND i.tenant_id = $2
         FOR UPDATE OF i`, [examInstanceId, actor.tenantId]);
    if (res.rows.length !== 1) refuse(403, 'forbidden');
    return res.rows[0] as LockedInstitutionExam;
}

async function currentDeadline(client: pg.PoolClient, tenantId: string, examInstanceId: string): Promise<{ revision: number; deadline: Date; open: boolean } | null> {
    const res = await client.query(
        `SELECT revision, deadline_at, (statement_timestamp() < deadline_at) AS open
         FROM secure_assessment_institution_preparation_deadlines
         WHERE tenant_id = $1 AND exam_instance_id = $2 ORDER BY revision DESC LIMIT 1`, [tenantId, examInstanceId]);
    const row = res.rows[0];
    return row ? { revision: Number(row.revision), deadline: new Date(row.deadline_at), open: row.open === true } : null;
}

async function extendDeadline(client: pg.PoolClient, actor: InstitutionActor, request: DeadlineRequest): Promise<Outcome> {
    const digest = digestOf(actor, 'deadline', {
        examInstanceId: request.examInstanceId, preparationDeadline: request.preparationDeadline, expectedRevision: request.expectedRevision, reason: request.reason,
    });
    const earlier = await client.query(
        `SELECT exam_instance_id, set_by_person_id, request_digest, revision, deadline_at, reason
         FROM secure_assessment_institution_preparation_deadlines WHERE tenant_id = $1 AND action_key = $2`, [actor.tenantId, request.actionKey]);
    if (earlier.rows.length === 1) {
        const row = earlier.rows[0];
        if (row.set_by_person_id !== actor.personId || row.request_digest !== digest || row.revision === 1) refuse(409, 'action_key_reused');
        return { status: 200, body: { examInstanceId: row.exam_instance_id, revision: row.revision, preparationDeadline: iso(row.deadline_at), reason: row.reason, replayed: true } };
    }
    const exam = await lockInstitutionExam(client, actor, request.examInstanceId);
    if (exam.lifecycle_state !== 'SCHEDULED') refuse(409, 'invalid_state', { currentState: exam.lifecycle_state });
    const current = await currentDeadline(client, actor.tenantId, request.examInstanceId);
    if (!current) throw new Error('An institution exam has no preparation deadline.');
    if (request.expectedRevision !== current.revision) {
        refuse(409, 'stale_deadline', { current: { revision: current.revision, deadline: current.deadline.toISOString() } });
    }
    if (!isRealLocalDateTime(request.preparationDeadline) || !exam.time_zone) invalid([{ code: 'deadline_invalid' }]);
    const converted = await schoolInstants(client, exam.time_zone!, [request.preparationDeadline]);
    const deadline = converted.instants[0];
    const problems = deadlineProblems(deadline, { now: converted.now, sessionStartsAt: new Date(exam.session_starts_at), current: current.deadline });
    if (problems.length > 0) invalid(problems.map(code => ({ code })));
    const revision = current.revision + 1;
    await client.query(
        `INSERT INTO secure_assessment_institution_preparation_deadlines
             (tenant_id, exam_instance_id, revision, deadline_at, previous_deadline_at, reason, set_by_person_id, action_key, request_digest)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [actor.tenantId, request.examInstanceId, revision, deadline, current.deadline, request.reason, actor.personId, request.actionKey, digest]);
    return { status: 200, body: { examInstanceId: request.examInstanceId, revision, preparationDeadline: deadline.toISOString(), reason: request.reason, replayed: false } };
}

async function cancelInstitutionExam(client: pg.PoolClient, actor: InstitutionActor, request: CancelRequest): Promise<Outcome> {
    // 0052 has no digest column: the replay compares the exam, the actor and the reason (teacher-exam-cancel.ts).
    const byKey = await client.query(
        `SELECT exam_instance_id, cancelled_by_person_id, cancelled_at, reason
         FROM secure_assessment_exam_cancellations WHERE tenant_id = $1 AND action_key = $2`, [actor.tenantId, request.actionKey]);
    if (byKey.rows.length === 1) {
        const row = byKey.rows[0];
        if (row.exam_instance_id !== request.examInstanceId || row.cancelled_by_person_id !== actor.personId || row.reason !== request.reason) {
            refuse(409, 'action_key_reused');
        }
        await lockInstitutionExam(client, actor, request.examInstanceId);
        return { status: 200, body: { examInstanceId: request.examInstanceId, cancelledAt: iso(row.cancelled_at), changed: true, replayed: true } };
    }
    const exam = await lockInstitutionExam(client, actor, request.examInstanceId);
    const existing = await client.query(
        'SELECT cancelled_at FROM secure_assessment_exam_cancellations WHERE tenant_id = $1 AND exam_instance_id = $2',
        [actor.tenantId, request.examInstanceId]);
    if (existing.rows.length === 1) {
        return { status: 200, body: { examInstanceId: request.examInstanceId, cancelledAt: iso(existing.rows[0].cancelled_at), changed: false, replayed: false } };
    }
    if (exam.lifecycle_state !== 'SCHEDULED' && exam.lifecycle_state !== 'READY') refuse(409, 'invalid_state', { currentState: exam.lifecycle_state });
    const cancelledAt = await recordExamCancellation(client, actor, request, exam.lifecycle_state);
    return { status: 200, body: { examInstanceId: request.examInstanceId, cancelledAt: iso(cancelledAt), changed: true, replayed: false } };
}

async function markReady(client: pg.PoolClient, actor: InstitutionActor, request: TransitionRequest): Promise<Outcome> {
    const exam = await lockInstitutionExam(client, actor, request.examInstanceId);
    if (exam.lifecycle_state !== 'SCHEDULED') refuse(409, 'invalid_state', { currentState: exam.lifecycle_state });
    // Read after the lock: every content transaction has committed or waits behind it (the 0062 FOR SHARE).
    const deadline = await currentDeadline(client, actor.tenantId, request.examInstanceId);
    if (!deadline || deadline.open) refuse(409, 'preparation_open', { preparationDeadline: deadline ? deadline.deadline.toISOString() : null });
    const readiness = await evaluateExamReadiness(client, actor.tenantId, request.examInstanceId);
    if (!readiness.ready) refuse(409, 'not_ready', { readiness: { baseline: readiness.baseline, roomProctor: readiness.roomProctor } });
    const moved = await client.query(
        `UPDATE secure_assessment_exam_instances SET lifecycle_state = 'READY' WHERE id = $1 AND tenant_id = $2 AND lifecycle_state = 'SCHEDULED'`,
        [request.examInstanceId, actor.tenantId]);
    if (moved.rowCount !== 1) refuse(409, 'invalid_state', { currentState: exam.lifecycle_state });
    await client.query(
        `INSERT INTO secure_assessment_exam_lifecycle_events (tenant_id, exam_instance_id, from_state, to_state, actor_person_id)
         VALUES ($1, $2, 'SCHEDULED', 'READY', $3)`, [actor.tenantId, request.examInstanceId, actor.personId]);
    return { status: 200, body: { examInstanceId: request.examInstanceId, lifecycleState: 'READY' } };
}

/** The Operator routes (§4.3): method, exact body, then one transaction each. */
export async function handleInstitutionExamRoute(
    req: http.IncomingMessage, res: http.ServerResponse, url: URL, pool: pg.Pool, cookie: SessionCookieConfig
): Promise<void> {
    const send = (outcome: Outcome) => sendJson(res, outcome.status, outcome.body);
    const pathname = url.pathname;
    if (pathname === INSTITUTION_ROUTES.overview) {
        if (req.method !== 'GET') { req.resume(); send({ status: 405, body: { error: 'method_not_allowed' } }); return; }
        const keys = [...url.searchParams.keys()];
        const periodId = url.searchParams.get('periodId');
        if (keys.some(k => k !== 'periodId') || keys.length > 1 || (keys.length === 1 && !uuid(periodId))) {
            send({ status: 400, body: { error: 'invalid_request' } });
            return;
        }
        send(await operatorRead(req, pool, cookie, (client, actor) => periodId ? readPeriod(client, actor, periodId.toLowerCase()) : readOverview(client, actor)));
        return;
    }
    if (req.method !== 'POST') { req.resume(); send({ status: 405, body: { error: 'method_not_allowed' } }); return; }
    let body: Record<string, unknown>;
    try {
        body = await readJsonObject(req);
    } catch (error) {
        send(institutionFailure(error instanceof HttpError ? error : new HttpError(400, 'invalid_request')));
        return;
    }
    const bad = () => send({ status: 400, body: { error: 'invalid_request' } });
    switch (pathname) {
        case INSTITUTION_ROUTES.periods: {
            const request = parsePeriodRequest(body);
            if (!request) return bad();
            send(await operatorWrite(req, pool, cookie, 'period', request.actionKey, (c, a) => createPeriod(c, a, request)));
            return;
        }
        case INSTITUTION_ROUTES.sessions: {
            const request = parseSessionRequest(body);
            if (!request) return bad();
            send(await operatorWrite(req, pool, cookie, 'session', request.actionKey, (c, a) => createSession(c, a, request)));
            return;
        }
        case INSTITUTION_ROUTES.placements: {
            const request = parsePlacementRequest(body);
            if (!request) return bad();
            send(await operatorWrite(req, pool, cookie, 'placement', request.actionKey, (c, a) => placeExam(c, a, request)));
            return;
        }
        case INSTITUTION_ROUTES.deadline: {
            const request = parseDeadlineRequest(body);
            if (!request) return bad();
            send(await operatorWrite(req, pool, cookie, 'deadline', request.actionKey, (c, a) => extendDeadline(c, a, request)));
            return;
        }
        case INSTITUTION_ROUTES.cancel: {
            const request = parseCancelRequest(body);
            if (!request) return bad();
            send(await operatorWrite(req, pool, cookie, 'cancel', request.actionKey, (c, a) => cancelInstitutionExam(c, a, request)));
            return;
        }
        case INSTITUTION_ROUTES.transition: {
            const request = parseTransitionRequest(body);
            if (!request) return bad();
            send(await operatorWrite(req, pool, cookie, 'transition', null, (c, a) => markReady(c, a, request)));
            return;
        }
    }
    send({ status: 404, body: { error: 'not found' } });
}

// ---------------------------------------------------------------------------------------------
// The subject Teacher's content preparation (§4.4).

export interface InstitutionContentPreview extends TeacherExamImportPreview {
    /** The questions stored now, which a confirmation replaces (OP-2 A); 0 when none. */
    replaces: number;
}

export type InstitutionContentOutcome =
    | { type: 'preview'; preview: InstitutionContentPreview }
    | { type: 'invalid'; preview: InstitutionContentPreview }
    | { type: 'prepared'; examInstanceId: string; questionCount: number; replayed: boolean }
    | { type: 'not_institution_exam' }
    | { type: 'invalid_state'; currentState: string }
    | { type: 'preparation_closed'; preparationDeadline: string | null }
    | { type: 'content_changed' }
    | { type: 'import_key_reused' }
    | { type: 'forbidden' }
    | { type: 'unavailable' };

/**
 * Checks (preview, always rolled back) or stores (confirm) the questions of an institution exam. In the
 * permission wrapper's transaction on confirm; the order is §4.4: the managing Teacher's exam FOR UPDATE,
 * the replay by import key, the institution, state and deadline checks, the file, then the replacement and
 * the content check.
 */
export async function runInstitutionContent(
    pool: pg.Pool,
    actor: InstitutionActor,
    request: ContentRequest,
    mode: 'preview' | 'confirm',
    transaction?: pg.PoolClient
): Promise<InstitutionContentOutcome> {
    if (!UUID.test(actor.tenantId) || !UUID.test(actor.personId)) return { type: 'forbidden' };
    const sourceSha256 = sha256Hex(request.questionsCsv);
    let client: pg.PoolClient;
    try {
        client = transaction ?? await pool.connect();
    } catch (transactionError) {
        if (transaction) throw transactionError;
        return { type: 'unavailable' };
    }
    const stop = async <T extends InstitutionContentOutcome>(outcome: T): Promise<T> => {
        if (!transaction) await client.query('ROLLBACK');
        return outcome;
    };
    try {
        if (!transaction) await client.query('BEGIN');
        const exam = await lockManagedExam(client, actor, request.examInstanceId);
        if (!exam) return await stop({ type: 'forbidden' });
        if (mode === 'confirm') {
            // Before the deadline check, so a lost acknowledgement after the deadline replays safely.
            const earlier = await client.query(
                `SELECT exam_instance_id, source_sha256, question_count FROM secure_assessment_question_import_batches
                 WHERE tenant_id = $1 AND imported_by_person_id = $2 AND import_key = $3`,
                [actor.tenantId, actor.personId, request.importKey]);
            if (earlier.rows.length === 1) {
                const row = earlier.rows[0];
                if (row.exam_instance_id !== request.examInstanceId || row.source_sha256 !== sourceSha256) return await stop({ type: 'import_key_reused' });
                return await stop({ type: 'prepared', examInstanceId: request.examInstanceId, questionCount: Number(row.question_count), replayed: true });
            }
        }
        if (exam.institution_session_id === null) return await stop({ type: 'not_institution_exam' });
        if (exam.lifecycle_state !== 'SCHEDULED') return await stop({ type: 'invalid_state', currentState: exam.lifecycle_state });
        const deadline = await client.query(
            `SELECT deadline_at, (transaction_timestamp() < deadline_at) AS open
             FROM secure_assessment_institution_preparation_deadlines
             WHERE tenant_id = $1 AND exam_instance_id = $2 ORDER BY revision DESC LIMIT 1`, [actor.tenantId, request.examInstanceId]);
        if (deadline.rows[0]?.open !== true) {
            return await stop({ type: 'preparation_closed', preparationDeadline: isoOrNull(deadline.rows[0]?.deadline_at) });
        }
        if (mode === 'confirm' && request.expectedSha256 !== sourceSha256) return await stop({ type: 'content_changed' });

        const problems: ImportProblem[] = [];
        let parsed: ReturnType<typeof parseQuestionFile> = { questions: [], problems: [], template: QUESTIONS_TEMPLATE };
        if (request.questionsCsv.length > MAX_QUESTION_FILE_CHARS) problems.push({ source: 'setup', code: 'file_too_large' });
        else {
            parsed = parseQuestionFile(request.questionsCsv);
            problems.push(...parsed.problems.map(p => ({ source: 'file' as const, ...p })));
        }
        const counts = await client.query(
            `SELECT (SELECT count(*)::int FROM secure_assessment_exam_question_snapshots WHERE tenant_id = $1 AND exam_instance_id = $2) AS questions,
                    (SELECT count(*)::int FROM secure_assessment_exam_participants WHERE tenant_id = $1 AND exam_instance_id = $2) AS participants`,
            [actor.tenantId, request.examInstanceId]);
        const preview: InstitutionContentPreview = {
            sourceSha256,
            problems,
            questions: previewQuestionsOf(parsed.questions),
            participants: [],
            window: exam.window_starts_at && exam.window_ends_at ? { startsAt: iso(exam.window_starts_at), endsAt: iso(exam.window_ends_at) } : null,
            totals: {
                questions: parsed.questions.length,
                maxScore: parsed.questions.reduce((sum, q) => sum + Math.round(q.maxScore * 100), 0) / 100,
                participants: Number(counts.rows[0].participants),
            },
            replaces: Number(counts.rows[0].questions),
        };
        if (problems.length > 0) return await stop({ type: 'invalid', preview });

        // OP-2 A (§3.3): the questions of this never-opened exam are replaced as a whole; no row is updated.
        await client.query('DELETE FROM secure_assessment_exam_question_snapshots WHERE tenant_id = $1 AND exam_instance_id = $2',
            [actor.tenantId, request.examInstanceId]);
        const batch = await client.query(
            `INSERT INTO secure_assessment_question_import_batches (
                tenant_id, exam_instance_id, imported_by_person_id, import_key, template, source_file_name, source_sha256, question_count
             ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id`,
            [actor.tenantId, request.examInstanceId, actor.personId, request.importKey ?? randomUUID(), parsed.template,
                request.sourceFileName, sourceSha256, parsed.questions.length]);
        for (const [index, question] of parsed.questions.entries()) {
            await client.query(
                `INSERT INTO secure_assessment_exam_question_snapshots (
                    tenant_id, exam_instance_id, frozen_content, display_order, import_batch_id, import_source_line
                 ) VALUES ($1, $2, $3, $4, $5, $6)`,
                [actor.tenantId, request.examInstanceId, JSON.stringify(buildImportedFrozenContent(question)), index + 1, batch.rows[0].id, question.line]);
        }
        const decision = mapContentReadiness(await checkExamInstanceBaselineQuestionSnapshotContentReadiness(
            client, actor.tenantId, request.examInstanceId, async () => 'granted' as const));
        if (decision.kind === 'unavailable') return await stop({ type: 'unavailable' });
        if (decision.kind === 'invalid') {
            problems.push(decision.problem);
            return await stop({ type: 'invalid', preview });
        }
        if (mode === 'preview') return await stop({ type: 'preview', preview });
        if (!transaction) await client.query('COMMIT');
        return { type: 'prepared', examInstanceId: request.examInstanceId, questionCount: parsed.questions.length, replayed: false };
    } catch (transactionError) {
        if (!transaction) await client.query('ROLLBACK').catch(() => {});
        if (transaction) throw transactionError;
        return { type: 'unavailable' };
    } finally {
        if (!transaction) client.release();
    }
}

/** The answer of a content route outcome. */
export function sendInstitutionContentOutcome(res: http.ServerResponse, outcome: InstitutionContentOutcome, audit: unknown): void {
    switch (outcome.type) {
        case 'preview': sendJson(res, 200, outcome.preview); return;
        case 'invalid': sendJson(res, 422, { error: 'import_invalid', ...outcome.preview }); return;
        case 'prepared':
            sendJson(res, outcome.replayed ? 200 : 201, {
                examInstanceId: outcome.examInstanceId, questionCount: outcome.questionCount, replayed: outcome.replayed, audit,
            });
            return;
        case 'invalid_state': sendJson(res, 409, { error: 'invalid_state', currentState: outcome.currentState }); return;
        case 'preparation_closed': sendJson(res, 409, { error: 'preparation_closed', preparationDeadline: outcome.preparationDeadline }); return;
        case 'not_institution_exam':
        case 'content_changed':
        case 'import_key_reused':
            sendJson(res, 409, { error: outcome.type }); return;
        case 'forbidden': sendJson(res, 403, { error: 'forbidden' }); return;
        case 'unavailable': sendJson(res, 503, { error: 'persistence_unavailable' }); return;
    }
}
