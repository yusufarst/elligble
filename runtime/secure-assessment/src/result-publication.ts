import type * as pg from 'pg';
import { AuthenticationError } from './http/authenticated-context.ts';
import { lockManagedExam } from './managed-exam.ts';
import { normalizePermissionReason, permissionDigest } from './permission-action-audit.ts';

// Result publication (RESULT-003 §4; Owner OD-09, O02-10, O05-1, O05-6, RP-1). The Teacher who holds an exam's teaching
// assignment (managed-exam.ts: the managing Teacher of a teacher-managed exam, the subject Teacher of an institution
// exam) publishes the frozen result of a FINALIZED exam to its Students, withdraws the publication and publishes it
// again, each with a reason, a confirmation and an append-only event (0066). Publication is not a lifecycle state: the
// exam stays FINALIZED and the latest event decides (E2). Every command carries the expected revision (the number of
// events so far), so a stale screen or a concurrent command is an explicit publication_changed, never a silent no-op.
// The same action key with the same request returns the stored receipt (E4). END and finalization never publish.
//
// Order in one transaction (§4.2): the key lock, re-authentication, the exam row FOR UPDATE and its authority FOR SHARE
// (the lock of every lifecycle transition, so finalize and publish serialize on the exam row), the replay check, the
// FINALIZED check, the revision and action check, the insert, re-authentication again, commit. No Attempt, answer or
// grade lock is taken. Every refusal rolls back and writes nothing.
//
// The Student's read (my-results) returns, for the caller's own participations only, each exam whose latest event is a
// PUBLISH, with the frozen standing and scaled score of the caller's own row (D04.8-20; RP-1 "Nilai akhir saja"): no
// points, counts, item outcome, key, other person, rank or aggregate (E5, E6). ABSENT has no score (D04.4-12).

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type PublicationAction = 'publish' | 'withdraw';
export type PublicationEventAction = 'PUBLISH' | 'WITHDRAW';

export interface ResultPublicationRequest {
    actionKey: string;
    action: PublicationAction;
    confirmed: true;
    examInstanceId: string;
    expectedRevision: number;
    /** Normalized as every permission reason (permission-action-audit.ts). */
    reason: string;
}

/** The exact key set of the command body (§4.2), sorted. */
const PUBLICATION_KEYS = ['action', 'actionKey', 'confirmed', 'examInstanceId', 'expectedRevision', 'reason'];

/** The exact publication body (§4.2, as parseGradeRequest), or null for 400 invalid_request. */
export function parseResultPublicationRequest(body: Record<string, unknown>): ResultPublicationRequest | null {
    const keys = Object.keys(body).sort();
    if (keys.length !== PUBLICATION_KEYS.length || keys.some((key, i) => key !== PUBLICATION_KEYS[i])) return null;
    const { actionKey, action, confirmed, examInstanceId, expectedRevision, reason } = body;
    if (typeof examInstanceId !== 'string' || !UUID_REGEX.test(examInstanceId)) return null;
    if (typeof actionKey !== 'string' || !UUID_REGEX.test(actionKey)) return null;
    if (action !== 'publish' && action !== 'withdraw') return null;
    if (typeof expectedRevision !== 'number' || !Number.isSafeInteger(expectedRevision) || expectedRevision < 0) return null;
    if (typeof reason !== 'string') return null;
    if (confirmed !== true) return null;
    const normalized = normalizePermissionReason(reason);
    if (normalized === null) return null;
    return { actionKey: actionKey.toLowerCase(), action, confirmed: true, examInstanceId: examInstanceId.toLowerCase(), expectedRevision, reason: normalized };
}

/** The request digest of E4: stable across key order and UUID case; the action key itself is not part of it. */
export function publicationDigest(actor: { tenantId: string; personId: string }, request: ResultPublicationRequest): string {
    return permissionDigest({
        version: 1, tenantId: actor.tenantId, actorPersonId: actor.personId, examInstanceId: request.examInstanceId,
        action: request.action, expectedRevision: request.expectedRevision, reason: request.reason,
    });
}

/** The publication state of an exam: its latest event, if any. */
export interface PublicationState {
    latest: PublicationEventAction | null;
    revision: number;
    changedAt: string | null;
}

export type PublicationDecision =
    | { type: 'insert'; sequence: number; eventAction: PublicationEventAction }
    | { type: 'publication_changed'; published: boolean; revision: number };

/**
 * The state machine of E2: publish only when the latest event is absent or WITHDRAW, withdraw only when it is PUBLISH,
 * and only at the current revision; any other combination is publication_changed with the current state.
 */
export function decidePublication(latest: PublicationEventAction | null, revision: number, action: PublicationAction, expectedRevision: number): PublicationDecision {
    const published = latest === 'PUBLISH';
    const allowed = action === 'publish' ? !published : published;
    if (expectedRevision !== revision || !allowed) return { type: 'publication_changed', published, revision };
    return { type: 'insert', sequence: revision + 1, eventAction: action === 'publish' ? 'PUBLISH' : 'WITHDRAW' };
}

/** The Teacher projection of E9: null while PROVISIONAL, else the published flag, the revision and the latest event time. */
export interface TeacherPublication {
    published: boolean;
    revision: number;
    changedAt: string | null;
}

export function teacherPublication(state: PublicationState): TeacherPublication {
    return { published: state.latest === 'PUBLISH', revision: state.revision, changedAt: state.changedAt };
}

function isoOrNull(value: unknown): string | null {
    if (value === null || value === undefined) return null;
    const date = value instanceof Date ? value : new Date(String(value));
    return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

/** The latest event of an exam inside the caller's transaction (no lock). */
export async function readPublicationState(client: pg.ClientBase, tenantId: string, examInstanceId: string): Promise<PublicationState> {
    const latest = await client.query(
        `SELECT action, sequence, occurred_at FROM secure_assessment_result_publication_events
         WHERE tenant_id = $1 AND exam_instance_id = $2 ORDER BY sequence DESC LIMIT 1`,
        [tenantId, examInstanceId]
    );
    const row = latest.rows[0];
    if (!row) return { latest: null, revision: 0, changedAt: null };
    return { latest: row.action as PublicationEventAction, revision: Number(row.sequence), changedAt: isoOrNull(row.occurred_at) };
}

/** The receipt of a command (§4.2): no reason, actor or score. */
export interface ResultPublicationReceipt {
    examInstanceId: string;
    published: boolean;
    revision: number;
    changedAt: string;
    replayed: boolean;
}

export type ResultPublicationOutcome =
    | { type: 'ok'; receipt: ResultPublicationReceipt }
    | { type: 'forbidden' }
    | { type: 'action_key_reused' }
    | { type: 'invalid_state'; currentState: string }
    | { type: 'publication_changed'; published: boolean; revision: number }
    | { type: 'state_changed' }
    | { type: 'unavailable' };

/**
 * Publishes or withdraws (§4.2). `reauthenticate` re-checks the session as a mutation inside the transaction and returns
 * false when it no longer belongs to the actor; it may throw the authentication error, which the caller maps.
 */
export async function executeResultPublication(
    pool: pg.Pool,
    actor: { tenantId: string; personId: string },
    request: ResultPublicationRequest,
    reauthenticate: (client: pg.PoolClient) => Promise<boolean>
): Promise<ResultPublicationOutcome> {
    if (!UUID_REGEX.test(actor.tenantId) || !UUID_REGEX.test(actor.personId)) return { type: 'forbidden' };
    let client: pg.PoolClient;
    try { client = await pool.connect(); } catch { return { type: 'unavailable' }; }
    const refuse = async <T extends ResultPublicationOutcome>(outcome: T): Promise<T> => { await client.query('ROLLBACK'); return outcome; };
    try {
        await client.query('BEGIN');
        await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`sa-publication:${actor.tenantId}:${request.actionKey}`]);
        if (!(await reauthenticate(client))) return await refuse({ type: 'forbidden' });
        const exam = await lockManagedExam(client, actor, request.examInstanceId);
        if (!exam) return await refuse({ type: 'forbidden' });

        const digest = publicationDigest(actor, request);
        const earlier = await client.query(
            `SELECT exam_instance_id, sequence, action, actor_person_id, request_digest, occurred_at
             FROM secure_assessment_result_publication_events WHERE tenant_id = $1 AND action_key = $2`,
            [actor.tenantId, request.actionKey]
        );
        if (earlier.rows.length === 1) {
            const event = earlier.rows[0];
            if (event.actor_person_id !== actor.personId || event.request_digest !== digest) return await refuse({ type: 'action_key_reused' });
            if (!(await reauthenticate(client))) return await refuse({ type: 'forbidden' });
            await client.query('COMMIT');
            return {
                type: 'ok',
                receipt: {
                    examInstanceId: event.exam_instance_id, published: event.action === 'PUBLISH', revision: Number(event.sequence),
                    changedAt: isoOrNull(event.occurred_at)!, replayed: true,
                },
            };
        }

        if (exam.lifecycle_state !== 'FINALIZED') return await refuse({ type: 'invalid_state', currentState: exam.lifecycle_state });
        const state = await readPublicationState(client, actor.tenantId, request.examInstanceId);
        const decision = decidePublication(state.latest, state.revision, request.action, request.expectedRevision);
        if (decision.type === 'publication_changed') return await refuse(decision);

        const inserted = await client.query(
            `INSERT INTO secure_assessment_result_publication_events
                (tenant_id, exam_instance_id, sequence, action, actor_person_id, reason, confirmed, action_key, request_digest)
             VALUES ($1, $2, $3, $4, $5, $6, TRUE, $7, $8)
             RETURNING exam_instance_id, sequence, action, occurred_at`,
            [actor.tenantId, request.examInstanceId, decision.sequence, decision.eventAction, actor.personId, request.reason, request.actionKey, digest]
        );
        if (!(await reauthenticate(client))) return await refuse({ type: 'forbidden' });
        await client.query('COMMIT');
        const row = inserted.rows[0];
        return {
            type: 'ok',
            receipt: {
                examInstanceId: row.exam_instance_id, published: row.action === 'PUBLISH', revision: Number(row.sequence),
                changedAt: isoOrNull(row.occurred_at)!, replayed: false,
            },
        };
    } catch (error) {
        await client.query('ROLLBACK').catch(() => {});
        if (error instanceof AuthenticationError) throw error;
        const code = error && typeof error === 'object' && 'code' in error ? (error as { code?: unknown }).code : undefined;
        if (code === '40001' || code === '40P01') return { type: 'state_changed' };
        if (code === '23505') return { type: 'action_key_reused' };
        return { type: 'unavailable' };
    } finally {
        client.release();
    }
}

/** One entry of my-results under RP-1 "Nilai akhir saja" (E5): exactly these four keys. */
export interface MyResultEntry {
    examInstanceId: string;
    publishedAt: string;
    standing: 'SUBMITTED' | 'ABSENT';
    scaledScore: number | null;
}

/** The entry of one frozen row: the scaled score only for SUBMITTED, null for ABSENT (D04.4-12). */
export function myResultEntry(row: { exam_instance_id: string; published_at: unknown; standing: string; scaled_score: unknown }): MyResultEntry {
    const standing = row.standing === 'SUBMITTED' ? 'SUBMITTED' : 'ABSENT';
    return {
        examInstanceId: row.exam_instance_id,
        publishedAt: isoOrNull(row.published_at)!,
        standing,
        scaledScore: standing === 'SUBMITTED' && row.scaled_score !== null && row.scaled_score !== undefined ? Number(row.scaled_score) : null,
    };
}

export type MyResultsOutcome = { type: 'ok'; results: MyResultEntry[] } | { type: 'forbidden' } | { type: 'unavailable' };

/**
 * The caller's own published results (§4.2 GET my-results): the participations of the session person in the session
 * tenant, excluding cancelled exams (as assigned-exams.ts), of a FINALIZED exam with its finalization, whose latest
 * publication event is a PUBLISH, joined to the caller's own frozen row; ordered by exam. One REPEATABLE READ READ ONLY
 * snapshot, so a read taken during a publish sees it wholly before or wholly after (K-4).
 */
export async function readMyResults(pool: pg.Pool, actor: { tenantId: string; personId: string }): Promise<MyResultsOutcome> {
    if (!UUID_REGEX.test(actor.tenantId) || !UUID_REGEX.test(actor.personId)) return { type: 'forbidden' };
    let client: pg.PoolClient;
    try { client = await pool.connect(); } catch { return { type: 'unavailable' }; }
    try {
        await client.query('BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY');
        const rows = await client.query(
            `SELECT p.exam_instance_id, ev.occurred_at AS published_at, r.standing, r.scaled_score
             FROM secure_assessment_exam_participants p
             JOIN secure_assessment_exam_instances i
               ON i.id = p.exam_instance_id AND i.tenant_id = p.tenant_id AND i.lifecycle_state = 'FINALIZED'
             JOIN secure_assessment_exam_result_finalizations f
               ON f.tenant_id = p.tenant_id AND f.exam_instance_id = p.exam_instance_id
             JOIN LATERAL (
                 SELECT e.action, e.occurred_at FROM secure_assessment_result_publication_events e
                 WHERE e.tenant_id = f.tenant_id AND e.exam_instance_id = f.exam_instance_id
                 ORDER BY e.sequence DESC
                 LIMIT 1
             ) ev ON ev.action = 'PUBLISH'
             JOIN secure_assessment_attempt_results r
               ON r.tenant_id = p.tenant_id AND r.finalization_id = f.id AND r.exam_participant_id = p.id
             WHERE p.tenant_id = $1 AND p.person_id = $2
               AND NOT EXISTS (
                   SELECT 1 FROM secure_assessment_exam_cancellations c
                   WHERE c.tenant_id = i.tenant_id AND c.exam_instance_id = i.id
               )
             ORDER BY p.exam_instance_id ASC`,
            [actor.tenantId, actor.personId]
        );
        await client.query('COMMIT');
        return { type: 'ok', results: rows.rows.map(myResultEntry) };
    } catch {
        await client.query('ROLLBACK').catch(() => {});
        return { type: 'unavailable' };
    } finally {
        client.release();
    }
}
