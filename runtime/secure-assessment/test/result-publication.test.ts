import { test } from 'node:test';
import * as assert from 'node:assert/strict';
import type * as pg from 'pg';
import {
    decidePublication, executeResultPublication, myResultEntry, parseResultPublicationRequest, publicationDigest, readMyResults, teacherPublication,
    type PublicationAction, type PublicationEventAction, type ResultPublicationRequest,
} from '../src/result-publication.ts';
import { formatScore } from '../../../frontend/web/src/lib/question-import.ts';

// RESULT-003 C01 units: the exact six-key body and every 400 of P-7; the E4 digest (stable across key order and UUID
// case); the E2 state machine over every (latest event, action, expectedRevision) combination; the §4.2 order of the
// command on a scripted client (key lock, re-authentication, exam lock, replay, FINALIZED, revision, insert,
// re-authentication, commit) with every refusal rolled back before any insert; the my-results row mapping under RP-1;
// the Teacher publication mapping (E9); and the shared formatScore output (E14).

const EXAM = '11111111-1111-4111-8111-111111111111';
const KEY = '22222222-2222-4222-8222-222222222222';
const TENANT = 'cccccccc-0000-4000-8000-000000000003';
const TEACHER = 'aaaaaaaa-0000-4000-8000-000000000001';
const OTHER = 'bbbbbbbb-0000-4000-8000-000000000002';
const actor = { tenantId: TENANT, personId: TEACHER };
const REASON = 'Hasil siap dibagikan';

const body = (over: Record<string, unknown> = {}): Record<string, unknown> => ({
    examInstanceId: EXAM, actionKey: KEY, action: 'publish', expectedRevision: 0, reason: REASON, confirmed: true, ...over,
});
const KEYS = ['action', 'actionKey', 'confirmed', 'examInstanceId', 'expectedRevision', 'reason'];

test('C01 P-7: the body is exactly the six keys, each of its type; every other shape is invalid_request (null)', () => {
    assert.deepEqual(parseResultPublicationRequest(body({ examInstanceId: EXAM.toUpperCase(), actionKey: KEY.toUpperCase(), reason: '  Hasil   siap\tdibagikan ' })), {
        examInstanceId: EXAM, actionKey: KEY, action: 'publish', expectedRevision: 0, reason: REASON, confirmed: true,
    });
    assert.equal(parseResultPublicationRequest(body({ action: 'withdraw', expectedRevision: 3 }))?.action, 'withdraw');
    for (const key of KEYS) {
        const { [key]: _gone, ...missing } = body();
        assert.equal(parseResultPublicationRequest(missing), null, `without ${key}`);
    }
    for (const extra of ['actorPersonId', 'tenantId', 'personId', 'published', 'revision', 'score']) {
        assert.equal(parseResultPublicationRequest(body({ [extra]: EXAM })), null, `with ${extra}`);
    }
    const invalid: Array<[string, Record<string, unknown>]> = [
        ['no reason', { reason: '' }], ['blank reason', { reason: '   ' }], ['201 characters', { reason: 'a'.repeat(201) }], ['reason not a string', { reason: 5 }],
        ['confirmed false', { confirmed: false }], ['confirmed "true"', { confirmed: 'true' }],
        ['actionKey "x"', { actionKey: 'x' }], ['examInstanceId "x"', { examInstanceId: 'x' }], ['examInstanceId null', { examInstanceId: null }],
        ['action unpublish', { action: 'unpublish' }], ['action PUBLISH', { action: 'PUBLISH' }],
        ['expectedRevision -1', { expectedRevision: -1 }], ['expectedRevision 1.5', { expectedRevision: 1.5 }], ['expectedRevision "1"', { expectedRevision: '1' }],
        ['expectedRevision null', { expectedRevision: null }], ['expectedRevision unsafe', { expectedRevision: 2 ** 53 }],
    ];
    for (const [label, over] of invalid) assert.equal(parseResultPublicationRequest(body(over)), null, label);
    assert.equal(parseResultPublicationRequest(body({ reason: 'a'.repeat(200) }))?.reason.length, 200);
});

test('C01 E4: the digest is stable across key order and UUID case, and covers actor, tenant, exam, action, revision and reason', () => {
    const request = parseResultPublicationRequest(body())!;
    const reordered = parseResultPublicationRequest(Object.fromEntries(Object.entries(body({ examInstanceId: EXAM.toUpperCase() })).reverse()))!;
    const digest = publicationDigest(actor, request);
    assert.match(digest, /^[0-9a-f]{64}$/);
    assert.equal(publicationDigest(actor, reordered), digest);
    assert.equal(publicationDigest({ tenantId: TENANT.toUpperCase(), personId: TEACHER.toUpperCase() }, request), digest);
    assert.equal(publicationDigest(actor, { ...request, actionKey: EXAM }), digest, 'the action key itself is not part of the digest');
    const changed: Array<[string, string]> = [
        ['actor', publicationDigest({ ...actor, personId: OTHER }, request)],
        ['tenant', publicationDigest({ ...actor, tenantId: OTHER }, request)],
        ['exam', publicationDigest(actor, { ...request, examInstanceId: KEY })],
        ['action', publicationDigest(actor, { ...request, action: 'withdraw' })],
        ['revision', publicationDigest(actor, { ...request, expectedRevision: 1 })],
        ['reason', publicationDigest(actor, { ...request, reason: 'Alasan lain' })],
    ];
    for (const [label, other] of changed) assert.notEqual(other, digest, label);
});

test('C01 E2: publish only from none or WITHDRAW, withdraw only from PUBLISH, only at the current revision', () => {
    const states: Array<[PublicationEventAction | null, number]> = [[null, 0], ['PUBLISH', 1], ['WITHDRAW', 2], ['PUBLISH', 3]];
    for (const [latest, revision] of states) {
        for (const action of ['publish', 'withdraw'] as PublicationAction[]) {
            for (const expected of [revision - 1, revision, revision + 1].filter(n => n >= 0)) {
                const decision = decidePublication(latest, revision, action, expected);
                const allowed = expected === revision && (action === 'publish' ? latest !== 'PUBLISH' : latest === 'PUBLISH');
                const label = `${latest} r${revision} ${action} @${expected}`;
                if (allowed) {
                    assert.deepEqual(decision, { type: 'insert', sequence: revision + 1, eventAction: action === 'publish' ? 'PUBLISH' : 'WITHDRAW' }, label);
                } else {
                    assert.deepEqual(decision, { type: 'publication_changed', published: latest === 'PUBLISH', revision }, label);
                }
            }
        }
    }
});

test('C01 E5/RP-1: a my-results entry is exactly {examInstanceId, publishedAt, standing, scaledScore}; ABSENT has no score', () => {
    const at = new Date('2026-11-12T03:04:05.000Z');
    const submitted = myResultEntry({ exam_instance_id: EXAM, published_at: at, standing: 'SUBMITTED', scaled_score: '33.33' });
    assert.deepEqual(submitted, { examInstanceId: EXAM, publishedAt: '2026-11-12T03:04:05.000Z', standing: 'SUBMITTED', scaledScore: 33.33 });
    assert.deepEqual(Object.keys(submitted), ['examInstanceId', 'publishedAt', 'standing', 'scaledScore']);
    assert.equal(myResultEntry({ exam_instance_id: EXAM, published_at: at, standing: 'SUBMITTED', scaled_score: '90.00' }).scaledScore, 90);
    assert.equal(myResultEntry({ exam_instance_id: EXAM, published_at: at, standing: 'SUBMITTED', scaled_score: '0.00' }).scaledScore, 0, 'a zero score stays a zero');
    assert.deepEqual(myResultEntry({ exam_instance_id: EXAM, published_at: at, standing: 'ABSENT', scaled_score: null }),
        { examInstanceId: EXAM, publishedAt: '2026-11-12T03:04:05.000Z', standing: 'ABSENT', scaledScore: null });
    assert.equal(myResultEntry({ exam_instance_id: EXAM, published_at: at, standing: 'ABSENT', scaled_score: '50.00' }).scaledScore, null, 'ABSENT never carries a value');
});

test('C01 E9: the Teacher publication is {published, revision, changedAt} of the latest event', () => {
    assert.deepEqual(teacherPublication({ latest: null, revision: 0, changedAt: null }), { published: false, revision: 0, changedAt: null });
    assert.deepEqual(teacherPublication({ latest: 'PUBLISH', revision: 3, changedAt: '2026-11-12T03:04:05.000Z' }), { published: true, revision: 3, changedAt: '2026-11-12T03:04:05.000Z' });
    assert.deepEqual(teacherPublication({ latest: 'WITHDRAW', revision: 2, changedAt: '2026-11-12T03:04:05.000Z' }), { published: false, revision: 2, changedAt: '2026-11-12T03:04:05.000Z' });
});

test('C01 E14: the shared formatScore gives 90, 33,33 and 55', () => {
    assert.deepEqual([90, 33.33, 55, 100, 5.5].map(formatScore), ['90', '33,33', '55', '100', '5,5']);
});

// ------------------------------------------------------------------------------------------- the command on a script

interface Script {
    state: string;
    authorized: boolean;
    earlier: Record<string, unknown> | null;
    latest: { action: PublicationEventAction; sequence: number; occurred_at: Date } | null;
    reauth: boolean[];
}

function scripted(script: Script) {
    const log: string[] = [];
    let reauthCalls = 0;
    const client = {
        async query(sql: string, params: unknown[] = []) {
            const text = sql.replace(/\s+/g, ' ').trim();
            if (text === 'BEGIN' || text === 'COMMIT' || text === 'ROLLBACK') { log.push(text); return { rows: [] }; }
            if (text.includes('pg_advisory_xact_lock')) { log.push(`lock ${params[0]}`); return { rows: [] }; }
            if (text.includes('FOR UPDATE OF i')) { log.push('exam FOR UPDATE'); return { rows: script.authorized ? [{ lifecycle_state: script.state }] : [] }; }
            if (text.includes('FOR SHARE OF ata, tta, tm')) { log.push('authority FOR SHARE'); return { rows: [{ id: 'ata' }] }; }
            if (text.includes('WHERE tenant_id = $1 AND action_key = $2')) { log.push('replay'); return { rows: script.earlier ? [script.earlier] : [] }; }
            if (text.includes('ORDER BY sequence DESC LIMIT 1')) { log.push('latest'); return { rows: script.latest ? [script.latest] : [] }; }
            if (text.startsWith('INSERT INTO secure_assessment_result_publication_events')) {
                log.push(`insert ${params[2]} ${params[3]}`);
                return { rows: [{ exam_instance_id: params[1], sequence: params[2], action: params[3], occurred_at: new Date('2026-11-12T03:04:05.000Z') }] };
            }
            throw new Error(`unexpected statement ${text}`);
        },
        release() { log.push('release'); },
    };
    const pool = { connect: async () => client } as unknown as pg.Pool;
    const reauthenticate = async () => { log.push('reauth'); return script.reauth[reauthCalls++] ?? true; };
    return { pool, log, reauthenticate };
}

const request = (over: Partial<ResultPublicationRequest> = {}): ResultPublicationRequest => ({ ...parseResultPublicationRequest(body())!, ...over });
const base: Script = { state: 'FINALIZED', authorized: true, earlier: null, latest: null, reauth: [] };

test('C01 §4.2: a publish runs key lock, re-authentication, exam lock, replay check, FINALIZED, revision, insert, re-authentication, commit', async () => {
    const run = scripted(base);
    const outcome = await executeResultPublication(run.pool, actor, request(), run.reauthenticate);
    assert.deepEqual(outcome, { type: 'ok', receipt: { examInstanceId: EXAM, published: true, revision: 1, changedAt: '2026-11-12T03:04:05.000Z', replayed: false } });
    assert.deepEqual(run.log, ['BEGIN', `lock sa-publication:${TENANT}:${KEY}`, 'reauth', 'exam FOR UPDATE', 'authority FOR SHARE', 'replay', 'latest', 'insert 1 PUBLISH', 'reauth', 'COMMIT', 'release']);

    const withdraw = scripted({ ...base, latest: { action: 'PUBLISH', sequence: 1, occurred_at: new Date() } });
    const withdrawn = await executeResultPublication(withdraw.pool, actor, request({ action: 'withdraw', expectedRevision: 1 }), withdraw.reauthenticate);
    assert.deepEqual(withdrawn.type === 'ok' && [withdrawn.receipt.published, withdrawn.receipt.revision], [false, 2]);
});

test('C01 §4.2: every refusal rolls back before any insert', async () => {
    const cases: Array<[string, Partial<Script>, Partial<ResultPublicationRequest>, unknown]> = [
        ['session gone', { reauth: [false] }, {}, { type: 'forbidden' }],
        ['not the assignment Teacher', { authorized: false }, {}, { type: 'forbidden' }],
        ['not FINALIZED', { state: 'ENDED' }, {}, { type: 'invalid_state', currentState: 'ENDED' }],
        ['stale revision', { latest: { action: 'PUBLISH', sequence: 1, occurred_at: new Date() } }, { expectedRevision: 0 }, { type: 'publication_changed', published: true, revision: 1 }],
        ['wrong action', { latest: { action: 'PUBLISH', sequence: 1, occurred_at: new Date() } }, { expectedRevision: 1 }, { type: 'publication_changed', published: true, revision: 1 }],
        ['withdraw unpublished', {}, { action: 'withdraw' }, { type: 'publication_changed', published: false, revision: 0 }],
        ['session gone before commit', { reauth: [true, false] }, {}, { type: 'forbidden' }],
    ];
    for (const [label, script, over, expected] of cases) {
        const run = scripted({ ...base, ...script });
        assert.deepEqual(await executeResultPublication(run.pool, actor, request(over), run.reauthenticate), expected, label);
        assert.ok(!run.log.includes('COMMIT'), `${label}: no commit`);
        assert.ok(run.log.includes('ROLLBACK'), `${label}: rolled back`);
        if (label !== 'session gone before commit') assert.ok(!run.log.some(line => line.startsWith('insert')), `${label}: nothing inserted`);
    }
});

test('C01 E4: the same key and digest replays the stored receipt even after the state moved on; another digest or actor is action_key_reused', async () => {
    const req = request();
    const stored = { exam_instance_id: EXAM, sequence: 1, action: 'PUBLISH', actor_person_id: TEACHER, request_digest: publicationDigest(actor, req), occurred_at: new Date('2026-11-12T01:00:00.000Z') };
    const replay = scripted({ ...base, earlier: stored, latest: { action: 'WITHDRAW', sequence: 2, occurred_at: new Date() } });
    assert.deepEqual(await executeResultPublication(replay.pool, actor, req, replay.reauthenticate),
        { type: 'ok', receipt: { examInstanceId: EXAM, published: true, revision: 1, changedAt: '2026-11-12T01:00:00.000Z', replayed: true } });
    assert.ok(!replay.log.some(line => line.startsWith('insert') || line === 'latest'));
    const ended = scripted({ ...base, state: 'ENDED', earlier: stored });
    assert.equal((await executeResultPublication(ended.pool, actor, req, ended.reauthenticate)).type, 'ok', 'the replay check precedes the state check');
    for (const earlier of [{ ...stored, request_digest: 'f'.repeat(64) }, { ...stored, actor_person_id: OTHER }]) {
        const run = scripted({ ...base, earlier });
        assert.deepEqual(await executeResultPublication(run.pool, actor, req, run.reauthenticate), { type: 'action_key_reused' });
        assert.ok(run.log.includes('ROLLBACK') && !run.log.some(line => line.startsWith('insert')));
    }
});

test('C01 database errors: 40001/40P01 state_changed, 23505 action_key_reused, others and connect unavailable', async () => {
    for (const [code, type] of [['40001', 'state_changed'], ['40P01', 'state_changed'], ['23505', 'action_key_reused'], ['23514', 'unavailable'], ['08006', 'unavailable']]) {
        const run = scripted(base);
        const failing = { connect: async () => {
            const c = await run.pool.connect() as unknown as { query(sql: string, p?: unknown[]): Promise<unknown>; release(): void };
            return { query: async (sql: string, p?: unknown[]) => { if (sql.includes('INSERT')) throw Object.assign(new Error(code), { code }); return c.query(sql, p); }, release: () => c.release() };
        } } as unknown as pg.Pool;
        assert.deepEqual(await executeResultPublication(failing, actor, request(), run.reauthenticate), { type }, code);
        assert.ok(run.log.includes('ROLLBACK'), `${code}: rolled back`);
    }
    const down = { connect: async () => { throw new Error('down'); } } as unknown as pg.Pool;
    assert.deepEqual(await executeResultPublication(down, actor, request(), async () => true), { type: 'unavailable' });
    assert.deepEqual(await readMyResults(down, actor), { type: 'unavailable' });
});

test('C01 my-results reads only the session person in the session tenant, in one read-only snapshot, ordered by exam', async () => {
    const statements: Array<{ sql: string; params: unknown[] }> = [];
    const client = {
        async query(sql: string, params: unknown[] = []) {
            statements.push({ sql: sql.replace(/\s+/g, ' ').trim(), params });
            if (sql.includes('FROM secure_assessment_exam_participants')) {
                return { rows: [{ exam_instance_id: EXAM, published_at: new Date('2026-11-12T03:04:05.000Z'), standing: 'SUBMITTED', scaled_score: '90.00' }] };
            }
            return { rows: [] };
        },
        release() {},
    };
    const pool = { connect: async () => client } as unknown as pg.Pool;
    assert.deepEqual(await readMyResults(pool, actor), { type: 'ok', results: [{ examInstanceId: EXAM, publishedAt: '2026-11-12T03:04:05.000Z', standing: 'SUBMITTED', scaledScore: 90 }] });
    assert.equal(statements[0].sql, 'BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY');
    const read = statements[1];
    assert.deepEqual(read.params, [TENANT, TEACHER]);
    for (const part of ["p.tenant_id = $1 AND p.person_id = $2", "i.lifecycle_state = 'FINALIZED'", "ev.action = 'PUBLISH'", 'secure_assessment_exam_cancellations', 'ORDER BY p.exam_instance_id ASC']) {
        assert.ok(read.sql.includes(part), part);
    }
    assert.equal(statements[2].sql, 'COMMIT');
    assert.deepEqual(await readMyResults(pool, { tenantId: 'x', personId: TEACHER }), { type: 'forbidden' });
});
