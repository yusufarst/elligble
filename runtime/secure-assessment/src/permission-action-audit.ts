import { createHash } from 'node:crypto';
import type * as http from 'node:http';
import type * as pg from 'pg';
import { AuthenticationError, buildAuthenticatedContext } from './http/authenticated-context.ts';
import type { SessionCookieConfig } from './http/session-credentials.ts';
import { sendError, sendJson } from './http/http-utils.ts';
import { lockManagedExam } from './managed-exam.ts';
import { participantInScope, resolveSupervisionScope } from './supervision-scope.ts';

export type PermissionKind = 'PARTICIPANT_CONTROL' | 'EXAM_TRANSITION' | 'RESCHEDULE' | 'CANCEL'
    | 'PARTICIPANT_ADD' | 'TIME_ADD' | 'IMPORT' | 'RESULT_EXPORT' | 'NONE';
export interface PermissionActor { tenantId: string; personId: string }
export interface PermissionEvent {
    id: string; exam_instance_id: string; participant_id: string | null; attempt_id: string | null;
    actor_person_id: string; request_digest: string; outcome: 'APPLIED' | 'NO_OP' | 'ISSUED';
    previous_state: string | null; resulting_state: string | null; effective_at: Date | null;
    occurred_at: Date; result_digest: string | null;
}
export interface AuditReceipt { id: string; outcome: 'APPLIED' | 'NO_OP' | 'ISSUED'; replayed: boolean }
export interface PermissionOptions<T> {
    kind: PermissionKind;
    action: string;
    examInstanceId?: string;
    participantId?: string;
    key?: unknown;
    reason?: unknown;
    confirmed?: unknown;
    payload: object;
    body: Record<string, unknown>;
    replay?: (event: PermissionEvent) => T;
}
export interface PermissionExecution<T> { result: T; audit?: AuditReceipt; issuedAt?: string }

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const PRIVATE_FIELDS = new Set(['actor', 'actorPersonId', 'actor_person_id', 'personId', 'tenantId', 'tenant_id',
    'audit', 'occurredAt', 'occurred_at', 'timestamp', 'authorityKind', 'sessionSecret', 'sessionId',
    'session_id', 'attemptId', 'serverTime', 'receipt', 'accepted', 'isSaved']);
class PermissionRefusal extends Error {
    readonly status: number;
    readonly code: string;
    constructor(status: number, code: string) { super(code); this.status = status; this.code = code; }
}
class AuditUnavailable extends Error {}

export function normalizePermissionReason(value: unknown): string | null {
    if (typeof value !== 'string') return null;
    const text = value.replace(/[\u0000-\u001f\u007f\s]+/g, ' ').trim();
    return text && [...text].length <= 200 ? text : null;
}

function record(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}
function canonical(value: unknown, key = ''): unknown {
    if (Array.isArray(value)) {
        if (['enrollmentIds', 'participantEnrollmentIds', 'participantIds'].includes(key)) {
            return [...new Set(value.map(v => typeof v === 'string' ? v.toLowerCase() : v))].sort();
        }
        return value.map(v => canonical(v));
    }
    if (record(value)) return Object.fromEntries(Object.keys(value).sort().filter(k => value[k] !== undefined)
        .map(k => [k, canonical(value[k], k)]));
    return typeof value === 'string' && UUID.test(value) && ['examInstanceId','participantId','actorPersonId','tenantId','teachingAssignmentId','assessmentTypeId','actionKey','importKey'].includes(key) ? value.toLowerCase() : value;
}
export function permissionDigest(value: unknown): string {
    return createHash('sha256').update(JSON.stringify(canonical(value))).digest('hex');
}
function conflict(kind: PermissionKind): never {
    throw new PermissionRefusal(409, kind === 'IMPORT' ? 'import_key_reused' : 'action_key_reused');
}
function successful(result: { type: string }): boolean {
    return ['ok', 'transitioned', 'rescheduled', 'cancelled', 'added', 'scheduled'].includes(result.type);
}
function iso(value: Date | string | null): string | null {
    return value === null ? null : new Date(value).toISOString();
}

/** Existing staff routes share one owning transaction; Student routes do not enter here. */
export async function executePermissionAction<T extends { type: string }>(
    pool: pg.Pool, req: http.IncomingMessage, res: http.ServerResponse, cookie: SessionCookieConfig,
    initialActor: PermissionActor, options: PermissionOptions<T>,
    run: (client: pg.PoolClient, actor: PermissionActor) => Promise<T>
): Promise<PermissionExecution<T> | null> {
    const audited = options.kind !== 'NONE';
    let reason: string | null = null;
    let key: string | null = null;
    let client: pg.PoolClient | null = null;
    try {
        if (Object.keys(options.body).some(k => PRIVATE_FIELDS.has(k))) throw new PermissionRefusal(400, 'invalid_request');
        if (audited) {
            if (typeof options.key !== 'string' || !UUID.test(options.key)) throw new PermissionRefusal(400, 'invalid_request');
            key = options.key.toLowerCase();
            if (!['IMPORT', 'RESULT_EXPORT'].includes(options.kind)) {
                reason = normalizePermissionReason(options.reason);
                if (reason === null || options.confirmed !== true) throw new PermissionRefusal(400, 'invalid_request');
            }
        }
        try { client = await pool.connect(); } catch { throw new PermissionRefusal(503, 'persistence_unavailable'); }
        await client.query(options.kind === 'RESULT_EXPORT' ? 'BEGIN ISOLATION LEVEL REPEATABLE READ' : 'BEGIN');
        if (key) await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [
            `sa-permission:${initialActor.tenantId}:${options.kind}:${options.kind === 'IMPORT' ? initialActor.personId + ':' : ''}${key}`,
        ]);
        const membership = await buildAuthenticatedContext(req, pool, { cookie, client, mutation: true });
        if (!membership || membership.tenantId !== initialActor.tenantId || membership.personId !== initialActor.personId) {
            throw new PermissionRefusal(403, 'forbidden');
        }
        const actor: PermissionActor = { tenantId: membership.tenantId, personId: membership.personId };
        const payload = options.kind === 'IMPORT' && record(options.payload) && typeof options.payload.questionsCsv === 'string'
            ? { ...options.payload, questionsCsv: undefined, sourceSha256: createHash('sha256').update(options.payload.questionsCsv).digest('hex') }
            : options.payload;
        const digest = permissionDigest({ version: 1, tenantId: actor.tenantId, actorPersonId: actor.personId,
            kind: options.kind, action: options.action, payload, reason, confirmed: true });
        let earlier: PermissionEvent | undefined;
        if (audited) {
            const found = await client.query<PermissionEvent>(
                `SELECT * FROM secure_assessment_permission_action_events
                 WHERE tenant_id = $1 AND action_kind = $2 AND action_key = $3
                   AND ($2 <> 'IMPORT' OR actor_person_id = $4)`, [actor.tenantId, options.kind, key, actor.personId]
            );
            earlier = found.rows[0];
        }
        let examId = options.examInstanceId ?? earlier?.exam_instance_id;
        let legacy = false;
        if (audited && !earlier) {
            const legacyQueries: Partial<Record<PermissionKind, string>> = {
                RESCHEDULE: 'SELECT exam_instance_id FROM secure_assessment_exam_schedule_changes WHERE tenant_id = $1 AND action_key = $2',
                CANCEL: 'SELECT exam_instance_id FROM secure_assessment_exam_cancellations WHERE tenant_id = $1 AND action_key = $2',
                PARTICIPANT_ADD: 'SELECT exam_instance_id FROM secure_assessment_exam_participant_additions WHERE tenant_id = $1 AND action_key = $2',
                TIME_ADD: 'SELECT id FROM secure_assessment_timer_adjustments WHERE tenant_id = $1 AND action_key = $2',
                IMPORT: 'SELECT exam_instance_id FROM secure_assessment_question_import_batches WHERE tenant_id = $1 AND import_key = $2 AND imported_by_person_id = $3',
            };
            const sql = legacyQueries[options.kind];
            if (sql) {
                const found = await client.query(sql, options.kind === 'IMPORT' ? [actor.tenantId, key, actor.personId] : [actor.tenantId, key]);
                legacy = found.rows.length > 0;
                if (options.kind === 'IMPORT' && legacy) examId = found.rows[0].exam_instance_id as string;
            }
        }
        let authority: 'TEACHER' | 'PROCTOR' = 'TEACHER';
        let previousState: string | null = null;
        let attemptId: string | null = null;
        if (examId) {
            if (options.kind === 'PARTICIPANT_CONTROL' || (options.kind === 'NONE' && options.action === 'broadcast')) {
                const scope = await resolveSupervisionScope(client, actor, examId, {
                    lockExam: options.kind === 'PARTICIPANT_CONTROL', lockAuthority: true,
                });
                if (!scope) throw new PermissionRefusal(403, 'forbidden');
                authority = scope.scope;
                previousState = scope.lifecycleState;
                if (options.participantId) {
                    const participant = await client.query(
                        `SELECT p.id FROM secure_assessment_exam_participants p
                         WHERE p.tenant_id = $1 AND p.exam_instance_id = $2 AND p.id = $3 AND ${participantInScope('p', '$4')}`,
                        [actor.tenantId, examId, options.participantId, scope.roomFilter]
                    );
                    if (participant.rows.length !== 1) throw new PermissionRefusal(403, 'forbidden');
                }
            } else {
                const exam = await lockManagedExam(client, actor, examId, ['TIME_ADD', 'IMPORT', 'RESULT_EXPORT'].includes(options.kind));
                if (!exam) throw new PermissionRefusal(403, 'forbidden');
                previousState = exam.lifecycle_state;
            }
            if (options.participantId) {
                const participant = await client.query(
                    'SELECT id FROM secure_assessment_exam_participants WHERE tenant_id = $1 AND exam_instance_id = $2 AND id = $3',
                    [actor.tenantId, examId, options.participantId]
                );
                if (participant.rows.length !== 1) throw new PermissionRefusal(403, 'forbidden');
                const attempt = await client.query(
                    `SELECT a.id FROM secure_assessment_exam_attempts a WHERE a.tenant_id = $1 AND a.exam_participant_id = $2
                     AND NOT EXISTS (SELECT 1 FROM secure_assessment_exam_submissions s WHERE s.tenant_id = a.tenant_id AND s.exam_attempt_id = a.id)
                     ORDER BY a.created_at, a.id LIMIT 1 FOR UPDATE OF a`, [actor.tenantId, options.participantId]
                );
                attemptId = earlier?.attempt_id ?? (attempt.rows[0]?.id as string | undefined) ?? null;
                if (options.kind === 'PARTICIPANT_CONTROL' && attemptId) {
                    const locked = await client.query(
                        'SELECT id FROM secure_assessment_attempt_locks WHERE tenant_id = $1 AND exam_attempt_id = $2 AND unlocked_at IS NULL',
                        [actor.tenantId, attemptId]
                    );
                    previousState = locked.rows.length ? 'LOCKED' : 'UNLOCKED';
                }
            }
        }
        if (earlier && (earlier.actor_person_id !== actor.personId || earlier.request_digest !== digest)) conflict(options.kind);
        if (legacy && ['IMPORT', 'RESCHEDULE', 'PARTICIPANT_ADD'].includes(options.kind)) conflict(options.kind);
        const beforeEffect = await buildAuthenticatedContext(req, pool, { cookie, client, mutation: true });
        if (!beforeEffect || beforeEffect.personId !== actor.personId || beforeEffect.tenantId !== actor.tenantId) throw new PermissionRefusal(403, 'forbidden');
        const result = earlier && options.replay ? options.replay(earlier) : await run(client, actor);
        if (!successful(result)) {
            await client.query('ROLLBACK');
            return { result };
        }
        const data: Record<string, unknown> = record(result) ? result : {};
        // A native producer can finish while this request waits for its owning key lock.
        // An unverifiable legacy replay must not be relabelled as a new audited effect.
        if (!earlier && data.replayed === true && ['IMPORT','RESCHEDULE','PARTICIPANT_ADD'].includes(options.kind)) conflict(options.kind);
        examId ??= typeof data.examInstanceId === 'string' ? data.examInstanceId : undefined;
        let resultDigest: string | null = null;
        if (options.kind === 'RESULT_EXPORT') {
            if (!record(data.results)) throw new Error('Missing entitled export projection');
            resultDigest = permissionDigest(data.results);
            if (earlier && earlier.result_digest !== resultDigest) {
                const current = await buildAuthenticatedContext(req, pool, { cookie, client, mutation: true });
                if (!current || current.personId !== actor.personId || current.tenantId !== actor.tenantId) throw new PermissionRefusal(403, 'forbidden');
                await client.query('ROLLBACK');
                sendJson(res, 409, { error: 'export_data_changed', audit: { id: earlier.id, outcome: earlier.outcome, replayed: true } });
                return null;
            }
        }
        let audit: AuditReceipt | undefined;
        let issuedAt: string | undefined;
        if (earlier) {
            audit = { id: earlier.id, outcome: earlier.outcome, replayed: true };
            issuedAt = iso(earlier.occurred_at) ?? undefined;
        } else if (audited && data.replayed !== true) {
            if (!examId) throw new Error('Missing action exam');
            const observed = await client.query('SELECT lifecycle_state FROM secure_assessment_exam_instances WHERE id = $1 AND tenant_id = $2', [examId, actor.tenantId]);
            let resultingState: string | null = observed.rows[0]?.lifecycle_state as string | undefined ?? null;
            if (options.kind === 'PARTICIPANT_CONTROL') resultingState = data.locked === true ? 'LOCKED' : 'UNLOCKED';
            const effective = [data.lockedAt, data.addedAt, data.changedAt, data.cancelledAt].find(v => typeof v === 'string');
            const outcome = options.kind === 'RESULT_EXPORT' ? 'ISSUED' : data.changed === false ? 'NO_OP' : 'APPLIED';
            try {
                const inserted = await client.query<{ id: string; occurred_at: Date }>(
                    `INSERT INTO secure_assessment_permission_action_events
                     (tenant_id,exam_instance_id,participant_id,attempt_id,actor_person_id,authority_kind,action_kind,action,
                      action_key,request_digest,reason,confirmed,outcome,previous_state,resulting_state,effective_at,result_digest)
                     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,TRUE,$12,$13,$14,$15,$16) RETURNING id,occurred_at`,
                    [actor.tenantId,examId,options.participantId ?? null,attemptId,actor.personId,authority,options.kind,options.action,
                        key,digest,reason,outcome,previousState,resultingState,effective ?? null,resultDigest]
                );
                audit = { id: inserted.rows[0].id, outcome, replayed: false };
                issuedAt = iso(inserted.rows[0].occurred_at) ?? undefined;
            } catch (error) {
                const code = record(error) && typeof error.code === 'string' ? error.code : '';
                if (['40001','40P01','23505'].includes(code)) throw error;
                throw new AuditUnavailable();
            }
        }
        // Recheck absolute/idle validity after all blocking locks/effects, before commit.
        const finalContext = await buildAuthenticatedContext(req, pool, { cookie, client, mutation: true });
        if (!finalContext || finalContext.personId !== actor.personId || finalContext.tenantId !== actor.tenantId) {
            throw new PermissionRefusal(403, 'forbidden');
        }
        await client.query('COMMIT');
        return { result, ...(audit ? { audit } : {}), ...(issuedAt ? { issuedAt } : {}) };
    } catch (error) {
        if (client) await client.query('ROLLBACK').catch(() => {});
        if (error instanceof PermissionRefusal) sendError(res, error.status, error.code);
        else if (error instanceof AuthenticationError) sendError(res, error.statusCode, error.message);
        else {
            const code = record(error) && typeof error.code === 'string' ? error.code : '';
            if (['40001', '40P01'].includes(code)) sendError(res, 409, 'state_changed');
            else if (code === '23505') sendError(res, 409, options.kind === 'IMPORT' ? 'import_key_reused' : 'action_key_reused');
            else if (error instanceof AuditUnavailable || /^(08|53|57)/.test(code) || code.startsWith('ECONN')) sendError(res, 503, 'persistence_unavailable');
            else sendError(res, 500, 'internal_error');
        }
        return null;
    } finally { client?.release(); }
}
