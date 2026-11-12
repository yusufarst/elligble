import { test } from 'node:test';
import * as assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import type pg from 'pg';
import { createDisposableDatabase, skipWithoutDatabase } from '../support/pg-harness.ts';
import {
    addMembership, addParticipant, addQuestionSnapshots, createExamInstance, createPersonWithAccount, createTeachingContext, createTenant,
    type TeachingContext,
} from '../support/fixtures.ts';
import { BrowserLikeClient, startProductionWiredServer, type ClientResponse } from '../support/test-server.ts';
import { setSchoolOperator } from '../../../tenant-access/src/school-operator.ts';
import { finalizeExpiredAttempts } from '../../src/expiry-finalization.ts';
import { permissionDigest } from '../../src/permission-action-audit.ts';
import {
    buildBaselineFrozenContent, buildEssayFrozenContent, buildMatchingFrozenContent, buildMultipleResponseFrozenContent, buildNumericFrozenContent,
    buildOrderingFrozenContent, buildShortAnswerFrozenContent, buildTrueFalseFrozenContent,
} from '../../src/exam-provisioning.ts';

// RESULT-004 real PostgreSQL oracle (record §5, §4.8, C02 to C04) through the production-wired server.
// Fixture (§5): tenant 1 (WIB) with institution session S (fixture SQL, as ASSESS-ROOM-001 raceExam) holding E1
// Matematika x X of T1 with the golden content G and x1..x8, and E2 Fisika x Y of T2 with two PG and y1, y2; the
// teacher-managed TM-G of T3 with G and z1..z5, z8; the School Operator O, Proctor P of E1's room, Homeroom Teacher H
// of X, actor A; tenant 2 with Teacher T9 and its exam. The integration server runs without the expiry sweeper, so x6
// stays unsubmitted until a finalization submits it. G-1..G-7 (C02), I-1..I-7 and the §4.8 N-ids (C03), K-1..K-6, T-1
// and T-2 (C04): every race on an exam of its own, with a 5 s bound and no 40P01 (state_changed).

const ALL = { 'X-Question-Types': '1:MULTIPLE_CHOICE_SINGLE,2:MULTIPLE_RESPONSE,2:TRUE_FALSE,2:MATCHING,2:ORDERING,2:NUMERIC_ANSWER,2:ESSAY,2:SHORT_ANSWER' };
const P = '/api/v1/assessment/institution-exams';
const SV = `${P}/supervision`;
const RESULTS = '/api/v1/assessment/teacher-exams/results';
const ESSAYS = '/api/v1/assessment/teacher-exams/essays';
const GRADE = '/api/v1/assessment/teacher-exams/essays/grade';
const TRANSITION = '/api/v1/assessment/teacher-exams/transition';
const M = 1_000_000;
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

type Body = Record<string, any>;
const post = (c: BrowserLikeClient, path: string, body: Body) => c.request(path, { method: 'POST', body });

/** The rows every refusal must leave unchanged (§4.8 N08): 0045 (both tables), 0061, 0054, submissions, lifecycle events. */
const WRITTEN = [
    'secure_assessment_exam_result_finalizations', 'secure_assessment_attempt_results', 'secure_assessment_essay_grade_revisions',
    'secure_assessment_permission_action_events', 'secure_assessment_exam_submissions', 'secure_assessment_exam_lifecycle_events',
    'secure_assessment_exam_answers', 'secure_assessment_exam_instances',
] as const;
async function rowsOf(pool: pg.Pool): Promise<Record<string, string[]>> {
    const out: Record<string, string[]> = {};
    for (const table of WRITTEN) out[table] = (await pool.query(`SELECT to_jsonb(x)::text AS r FROM ${table} x ORDER BY 1`)).rows.map(r => r.r as string);
    return out;
}

async function inTransaction<T>(pool: pg.Pool, run: (c: pg.PoolClient) => Promise<T>): Promise<T> {
    const c = await pool.connect();
    try {
        await c.query('BEGIN');
        const result = await run(c);
        await c.query('COMMIT');
        return result;
    } catch (error) {
        await c.query('ROLLBACK').catch(() => {});
        throw error;
    } finally {
        c.release();
    }
}

const operatorAssignment = (pool: pg.Pool, tenantId: string, personId: string, action: 'ASSIGN' | 'REVOKE') => inTransaction(pool, c =>
    setSchoolOperator(c, { tenantId, personId, action, operator: 'Synthetic CI operator', caseReference: 'RESULT-004', reason: 'Synthetic complete results' }));

/** A transaction held open by the test: it takes its locks now and releases them at commit. */
async function hold(pool: pg.Pool, statements: Array<[string, unknown[]]>): Promise<{ commit(): Promise<void> }> {
    const client = await pool.connect();
    await client.query('BEGIN');
    for (const [sql, params] of statements) await client.query(sql, params);
    return { commit: async () => { try { await client.query('COMMIT'); } finally { client.release(); } } };
}

/** Waits until at least `n` backends of this database wait on a row, transaction or advisory lock. */
async function lockWaiters(pool: pg.Pool, n: number, pending: Array<Promise<unknown>> = []): Promise<void> {
    let settled = false;
    for (const p of pending) p.then(() => { settled = true; }, () => { settled = true; });
    for (let i = 0; i < 150; i++) {
        const r = await pool.query(`SELECT count(*)::int AS n FROM pg_stat_activity WHERE datname = current_database() AND wait_event_type = 'Lock'`);
        if (r.rows[0].n >= n) return;
        if (settled) throw new Error(`A request finished before ${n} lock waits were observed.`);
        await sleep(100);
    }
    throw new Error(`${n} lock waits were not observed.`);
}

/** The 5 s bound of every race (§7 C04): completion after the release, without a deadlock (state_changed) or a 5xx. */
async function bounded<T>(pending: Promise<T>, label: string): Promise<T> {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const timeout = new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error(`${label} did not complete within 5 s`)), 5000); });
    try {
        const r = await Promise.race([pending, timeout]);
        const response = r as unknown as Partial<ClientResponse>;
        if (response && typeof response === 'object' && typeof response.status === 'number') {
            assert.notDeepEqual(response.body, { error: 'state_changed' }, `${label}: no deadlock (40P01) or serialization failure`);
            assert.ok(response.status < 500, `${label}: ${response.status} ${JSON.stringify(response.body)}`);
        }
        return r;
    } finally {
        clearTimeout(timer);
    }
}

function gate() {
    let reached!: () => void;
    let release!: () => void;
    const arrived = new Promise<void>(resolve => { reached = resolve; });
    const proceed = new Promise<void>(resolve => { release = resolve; });
    return { reached, release, arrived, proceed };
}

/** A pool whose connections pause right after the first query that `matches` (as institution-exams.test.ts). */
function gatedPool(pool: pg.Pool, matches: (sql: string) => boolean, g: ReturnType<typeof gate>): pg.Pool {
    let held = false;
    return new Proxy(pool, {
        get(target, key) {
            if (key === 'connect') {
                return async () => {
                    const client = await target.connect();
                    return new Proxy(client, {
                        get(c, property) {
                            if (property === 'query') {
                                return async (...args: unknown[]) => {
                                    const result = await Reflect.apply(c.query, c, args);
                                    if (!held && typeof args[0] === 'string' && matches(args[0])) {
                                        held = true;
                                        g.reached();
                                        await g.proceed;
                                    }
                                    return result;
                                };
                            }
                            const v = Reflect.get(c, property);
                            return typeof v === 'function' ? v.bind(c) : v;
                        },
                    });
                };
            }
            const v = Reflect.get(target, key);
            return typeof v === 'function' ? v.bind(target) : v;
        },
    }) as pg.Pool;
}

/** Every key of a JSON value, recursively. */
function keysOf(value: unknown, into = new Set<string>()): Set<string> {
    if (Array.isArray(value)) value.forEach(v => keysOf(v, into));
    else if (value && typeof value === 'object') for (const [k, v] of Object.entries(value)) { into.add(k); keysOf(v, into); }
    return into;
}

// ---------------------------------------------------------------------------------------------
// Golden content G (§5) and the participants' answers and grades.

interface Golden { contents: Array<Record<string, any>> }
function golden(): Golden {
    return {
        contents: [
            buildBaselineFrozenContent({ prompt: 'Ibu kota Indonesia adalah', options: ['Bandung', 'Jakarta', 'Surabaya', 'Medan', 'Makassar'], correctIndex: 1, maxScore: 2 }),
            buildMultipleResponseFrozenContent({ prompt: 'Bilangan prima adalah', options: ['2', '4', '5', '8', '9'], correctIndexes: [0, 2], maxScore: 3 }),
            buildTrueFalseFrozenContent({ prompt: 'Matahari terbit di timur', correctValue: true, maxScore: 1 }),
            buildMatchingFrozenContent({ prompt: 'Pasangkan hewan dengan makanannya', leftItems: ['Sapi', 'Kucing', 'Kelinci'], rightItems: ['Ikan', 'Rumput', 'Biji jagung', 'Wortel'], correctPairIndexes: [1, 0, 3], maxScore: 4 }),
            buildOrderingFrozenContent({ prompt: 'Urutkan langkah menanam biji', items: ['Siram tanah', 'Siapkan pot', 'Tanam biji'], correctSequence: [1, 2, 0], maxScore: 2 }),
            buildNumericFrozenContent({ prompt: 'Hasil dari 5 dibagi 2 adalah', key: '2,5', tolerance: '0,1', maxScore: 2 }),
            buildShortAnswerFrozenContent({ prompt: 'Sebutkan ibu kota Indonesia', acceptedForms: ['Jakarta'], rubric: '', maxScore: 1 }),
            buildShortAnswerFrozenContent({ prompt: 'Sebutkan satu monumen di Jakarta', acceptedForms: [], rubric: 'Nilai sesuai jawaban.', maxScore: 2 }),
            buildEssayFrozenContent({ prompt: 'Mengapa hutan penting?', rubric: 'Sebutkan dua alasan.', maxScore: 5 }),
        ],
    };
}

type Who = 'x1' | 'x2' | 'x3' | 'x4' | 'x5' | 'x6' | 'x7' | 'x8';
const PLANTED = 'planted';
/** §5: the saves of a participant by display number; x3's item 3 is planted by fixture SQL after a refused save. */
function plan(who: Who, g: Golden): Array<[number, unknown]> {
    const c = g.contents;
    const opt = (q: number, letter: string) => c[q].options['ABCDE'.indexOf(letter)].id as string;
    const left = (i: number) => c[3].leftItems[i].id as string;
    const right = (i: number) => c[3].rightItems[i].id as string;
    const item = (i: number) => c[4].items[i].id as string;
    const pairs = [{ leftId: left(0), rightId: right(1) }, { leftId: left(1), rightId: right(0) }, { leftId: left(2), rightId: right(3) }];
    switch (who) {
        case 'x1': return [[1, { selectedOptionId: opt(0, 'B') }], [2, { selectedOptionIds: [opt(1, 'A'), opt(1, 'C')] }], [3, { value: true }], [4, { pairs }],
            [5, { orderedItemIds: [item(1), item(2), item(0)] }], [6, { numericText: '2,5' }], [7, { shortText: 'Jakarta' }], [8, { shortText: 'Monas' }],
            [9, { essayText: 'Hutan menyimpan air dan menghasilkan oksigen.' }]];
        case 'x2': return [[1, { selectedOptionId: opt(0, 'B') }], [2, { selectedOptionIds: [opt(1, 'A')] }], [3, { value: false }],
            [4, { pairs: [pairs[0], { leftId: left(1), rightId: right(2) }, pairs[2]] }], [5, { orderedItemIds: [item(2), item(1), item(0)] }],
            [6, { numericText: '2,6' }], [7, { shortText: '  jakarta ' }], [8, { shortText: 'Monas' }], [9, { essayText: 'Hutan menahan banjir.' }]];
        case 'x3': return [[2, { selectedOptionIds: [] }], [3, PLANTED], [4, { pairs: [] }], [5, { orderedItemIds: [] }], [6, { numericText: '' }],
            [7, { shortText: '' }], [8, { shortText: '' }], [9, { essayText: '' }]];
        case 'x4': return [[2, { selectedOptionIds: [opt(1, 'A'), opt(1, 'C')] }], [6, { numericText: '2,61' }], [7, { shortText: '   ' }], [9, { essayText: 'Hutan menyimpan air.' }]];
        case 'x6': return [[1, { selectedOptionId: opt(0, 'B') }]];
        case 'x7': return [];
        case 'x8': return [[1, { selectedOptionId: opt(0, 'A') }], [4, { pairs: pairs.slice(0, 2) }], [7, { shortText: 'Bandung' }], [8, { shortText: '   ' }], [9, { essayText: '   ' }]];
        case 'x5': return [];
    }
}
const GRADES: Partial<Record<Who, Array<[number, string]>>> = { x1: [[8, '2'], [9, '5']], x2: [[8, '0'], [9, '2,5']], x4: [[9, '4']], x8: [[8, '0'], [9, '0']] };

const C = 'CORRECT', I = 'INCORRECT', U = 'UNANSWERED', G = 'GRADED', PD = 'UNGRADED';
const items = (outcomes: string[], points: number[]) => outcomes.map((outcome, i) => ({ no: i + 1, outcome, score: points[i] }));
const zero = [0, 0, 0, 0, 0, 0, 0, 0, 0];
const score = (counts: [number, number, number, number, number], raw: number, scaled: number) => {
    const [correct, incorrect, unanswered, graded, ungraded] = counts;
    return { correct, incorrect, unanswered, graded, ungraded, rawScore: raw, maxScore: 22, scaledScore: scaled };
};
/** §5 FINAL per-item outcomes, points and totals. */
const FINAL: Partial<Record<Who, { score: Body; items: Body[] }>> = {
    x1: { score: score([7, 0, 0, 2, 0], 22, 100), items: items([C, C, C, C, C, C, C, G, G], [2, 3, 1, 4, 2, 2, 1, 2, 5]) },
    x2: { score: score([3, 4, 0, 2, 0], 7.5, 34.09), items: items([C, I, I, I, I, C, C, G, G], [2, 0, 0, 0, 0, 2, 1, 0, 2.5]) },
    x3: { score: score([0, 0, 9, 0, 0], 0, 0), items: items([U, U, U, U, U, U, U, U, U], zero) },
    x4: { score: score([1, 2, 5, 1, 0], 7, 31.82), items: items([U, C, U, U, U, I, I, U, G], [0, 3, 0, 0, 0, 0, 0, 0, 4]) },
    x6: { score: score([1, 0, 8, 0, 0], 2, 9.09), items: items([C, U, U, U, U, U, U, U, U], [2, 0, 0, 0, 0, 0, 0, 0, 0]) },
    x7: { score: score([1, 0, 8, 0, 0], 1, 4.55), items: items([U, U, C, U, U, U, U, U, U], [0, 0, 1, 0, 0, 0, 0, 0, 0]) },
    x8: { score: score([0, 2, 5, 2, 0], 0, 0), items: items([I, U, U, U, U, U, I, G, G], zero) },
};
/** G-1: x4 and x8 before their grades. */
const PROVISIONAL: Partial<Record<Who, { score: Body; items: Body[] }>> = {
    x4: { score: score([1, 2, 5, 0, 1], 3, 13.64), items: items([U, C, U, U, U, I, I, U, PD], [0, 3, 0, 0, 0, 0, 0, 0, 0]) },
    x8: { score: score([0, 2, 5, 0, 2], 0, 0), items: items([I, U, U, U, U, U, I, PD, PD], zero) },
};
const QUESTIONS = [['PG', 2], ['PGK', 3], ['BS', 1], ['MJ', 4], ['UR', 2], ['IA', 2], ['IS', 1], ['IS', 2], ['ES', 5]].map(([typeCode, maxScore], i) => ({ no: i + 1, typeCode, maxScore }));
const RULES = ['BASELINE_SINGLE_CHOICE_V1', 'MULTIPLE_RESPONSE_EXACT_SET_V1', 'TRUE_FALSE_EXACT_V1', 'MATCHING_EXACT_PAIRS_V1', 'ORDERING_EXACT_SEQUENCE_V1',
    'NUMERIC_EXACT_DECIMAL_TOLERANCE_V1', 'SHORT_ANSWER_ACCEPTED_FORMS_V1', 'SHORT_ANSWER_ACCEPTED_FORMS_V1', 'ESSAY_HUMAN_GRADED_V1'];
const SCORING = { rule: 'COMPOSITE_PER_ITEM_V1', available: true, questionCount: 9, maxScore: 22, autoScoredCount: 7, essayCount: 2 };
/** I-7: keys no result, export, grade receipt or finalize receipt carries. */
const FORBIDDEN = ['fullName', 'name', 'nis', 'nisn', 'birthDate', 'prompt', 'options', 'correct', 'acceptedForms', 'tolerance', 'rubric', 'essayText', 'shortText'];
const IDENTITY = ['fullName', 'name', 'nis', 'nisn', 'birthDate'];
const SCORE_KEYS = ['correct', 'graded', 'incorrect', 'maxScore', 'rawScore', 'scaledScore', 'unanswered', 'ungraded'];
/**
 * The keys of a response with each participant's score set apart: a score is exactly the delivered counts and totals
 * (its "correct" is the D1 count of automatically scored items, not an answer key), and nothing else may carry a
 * forbidden key.
 */
function keysBeyondScores(body: Body): Set<string> {
    const copy = JSON.parse(JSON.stringify(body));
    for (const row of copy.participants ?? []) {
        if (row.score) assert.deepEqual(Object.keys(row.score).sort(), SCORE_KEYS);
        row.score = null;
    }
    return keysOf(copy);
}
const ANSWER_TEXTS = ['Monas', 'Hutan menyimpan', 'Hutan menahan', 'jakarta', 'Bandung', 'Sebutkan dua alasan', 'Mengapa hutan'];

/** The §4.3 invariants of a scored row, in micro-points. */
function assertInvariants(row: Body, label: string) {
    const its: Body[] = row.items;
    assert.equal(its.reduce((s, i) => s + Math.round(i.score * M), 0), Math.round(row.score.rawScore * M), `${label}: the items sum to the raw score`);
    const count = (o: string) => its.filter(i => i.outcome === o).length;
    assert.deepEqual([count(C), count(I), count(U), count(G), count(PD)],
        [row.score.correct, row.score.incorrect, row.score.unanswered, row.score.graded, row.score.ungraded], `${label}: the outcome counts`);
}

test('RESULT-004 C02 to C04 complete results through production wiring', { skip: skipWithoutDatabase, timeout: 900_000 }, async t => {
    const db = await createDisposableDatabase();
    const app = await startProductionWiredServer(db.pool);
    t.after(async () => { await app.close(); await db.close(); });
    const pool = db.pool;

    // ------------------------------------------------------------------ fixture
    const tenant = await createTenant(pool, 'SMA Hasil Lengkap');
    const t1 = await createPersonWithAccount(pool, 'guru.matematika');
    const teaching = await createTeachingContext(pool, tenant, await addMembership(pool, tenant, t1.personId), 'Matematika');
    const scope = (await pool.query(
        `SELECT o.academic_period_id, o.grade_level_id, g.academic_year_id FROM academic_core_teaching_assignments a
         JOIN academic_core_subject_offerings o ON o.id = a.subject_offering_id JOIN academic_core_academic_groups g ON g.id = a.academic_group_id
         WHERE a.id = $1`, [teaching.teachingAssignmentId])).rows[0];
    const academicPeriodId: string = scope.academic_period_id;
    // T2 holds Fisika x Y in the same academic period.
    const t2 = await createPersonWithAccount(pool, 'guru.fisika');
    const t2Assignment = (await pool.query('INSERT INTO tenant_teacher_assignments (tenant_id, membership_id) VALUES ($1, $2) RETURNING id',
        [tenant, await addMembership(pool, tenant, t2.personId)])).rows[0].id as string;
    const groupY = (await pool.query('INSERT INTO academic_core_academic_groups (tenant_id, academic_year_id, grade_level_id, display_label) VALUES ($1, $2, $3, $4) RETURNING id',
        [tenant, scope.academic_year_id, scope.grade_level_id, 'Y-1'])).rows[0].id as string;
    const physics = (await pool.query('INSERT INTO academic_core_subjects (tenant_id, display_label) VALUES ($1, $2) RETURNING id', [tenant, 'Fisika'])).rows[0].id;
    const physicsOffering = (await pool.query('INSERT INTO academic_core_subject_offerings (tenant_id, subject_id, academic_period_id, grade_level_id) VALUES ($1, $2, $3, $4) RETURNING id',
        [tenant, physics, academicPeriodId, scope.grade_level_id])).rows[0].id;
    const physicsY = (await pool.query('INSERT INTO academic_core_teaching_assignments (tenant_id, teacher_assignment_id, subject_offering_id, academic_group_id) VALUES ($1, $2, $3, $4) RETURNING id',
        [tenant, t2Assignment, physicsOffering, groupY])).rows[0].id as string;
    // T3 and the teacher-managed TM-G; races run on T3's exams too.
    const t3 = await createPersonWithAccount(pool, 'guru.kimia');
    const teaching3 = await createTeachingContext(pool, tenant, await addMembership(pool, tenant, t3.personId), 'Kimia');
    const staff = async (username: string) => {
        const person = await createPersonWithAccount(pool, username);
        return { ...person, membershipId: await addMembership(pool, tenant, person.personId) };
    };
    const operator = await staff('operator.sekolah');
    await operatorAssignment(pool, tenant, operator.personId, 'ASSIGN');
    const proctor = await staff('pengawas.ruang');
    const homeroom = await staff('walikelas.x');
    await pool.query(
        `INSERT INTO academic_core_homeroom_responsibilities (tenant_id, membership_id, academic_year_id, academic_period_id, academic_group_id)
         VALUES ($1, $2, $3, $4, $5)`, [tenant, homeroom.membershipId, scope.academic_year_id, academicPeriodId, teaching.academicGroupId]);
    const actorA = await staff('staf.tanpa.peran');
    // Tenant 2: T9 and its own exam.
    const tenant2 = await createTenant(pool, 'SMA Lain');
    const t9 = await createPersonWithAccount(pool, 'guru.lain');
    const teaching9 = await createTeachingContext(pool, tenant2, await addMembership(pool, tenant2, t9.personId), 'Matematika');
    const foreignExam = await createExamInstance(pool, tenant2, teaching9, { lifecycleState: 'ENDED' });

    const login = async (person: { username: string; password: string }, tenantId: string = tenant) => {
        const c = new BrowserLikeClient(app.baseUrl);
        assert.equal((await c.login(person.username, person.password)).status, 200, person.username);
        c.tenantId = tenantId;
        return c;
    };
    const ok = (r: ClientResponse, status = 200) => { assert.equal(r.status, status, JSON.stringify(r.body)); return r.body as Body; };
    const unchanged = async (run: () => Promise<void>) => {
        const before = await rowsOf(pool);
        await run();
        assert.deepEqual(await rowsOf(pool), before, 'nothing was written');
    };
    const tc1 = await login(t1);
    const tc2 = await login(t2);
    const tc3 = await login(t3);
    const oc = await login(operator);
    const pc = await login(proctor);
    const hc = await login(homeroom);
    const ac = await login(actorA);
    const t9Own = await login(t9, tenant2);
    const t9InOurs = await login(t9, tenant);
    const anonymous = new BrowserLikeClient(app.baseUrl);
    anonymous.tenantId = tenant;

    // The five routes of §4.8.
    const results = (c: BrowserLikeClient, exam: string) => c.request(`${RESULTS}?examInstanceId=${exam}`);
    const exportResults = (c: BrowserLikeClient, exam: string, format: 'csv' | 'print' = 'csv', actionKey: string = randomUUID()) =>
        post(c, RESULTS, { examInstanceId: exam, format, actionKey });
    const worklist = (c: BrowserLikeClient, exam: string) => c.request(`${ESSAYS}?examInstanceId=${exam}`);
    const grade = (c: BrowserLikeClient, exam: string, attemptId: string, snapshotId: string, value: string, expectedRevision: number | null = null) =>
        post(c, GRADE, { examInstanceId: exam, attemptId, snapshotId, score: value, expectedRevision });
    const act = (c: BrowserLikeClient, exam: string, action: string, extra: Body = {}) =>
        post(c, TRANSITION, { examInstanceId: exam, action, reason: 'Hasil lengkap', confirmed: true, actionKey: randomUUID(), ...extra });
    const control = (exam: string, action: string) =>
        post(oc, `${SV}/transition`, { examInstanceId: exam, action, reason: 'Pelaksanaan ujian sekolah', confirmed: true, actionKey: randomUUID() });
    const stateOf = async (exam: string) => (await pool.query('SELECT lifecycle_state FROM secure_assessment_exam_instances WHERE id = $1', [exam])).rows[0].lifecycle_state as string;
    const revision = async (attemptId: string, snapshotId: string) => (await pool.query(
        'SELECT max(revision)::int AS r FROM secure_assessment_essay_grade_revisions WHERE exam_attempt_id = $1 AND exam_question_snapshot_id = $2', [attemptId, snapshotId])).rows[0].r as number | null;

    // Institution session S (fixture SQL, as ASSESS-ROOM-001 raceExam) in a period the Operator creates through the product.
    const periodId = ok(await post(oc, `${P}/periods`, { label: 'PTS Hasil Lengkap', assessmentTypeId: teaching.assessmentTypeId, academicPeriodId, actionKey: randomUUID() }), 201).periodId as string;
    const sessionId = (await pool.query(
        `INSERT INTO secure_assessment_institution_exam_sessions (tenant_id, period_id, starts_at, ends_at, created_by_person_id, action_key, request_digest)
         VALUES ($1, $2, date_trunc('day', statement_timestamp()) + interval '5 days', date_trunc('day', statement_timestamp()) + interval '5 days 2 hours',
                 $3, gen_random_uuid(), repeat('a', 64))
         RETURNING id`, [tenant, periodId, operator.personId])).rows[0].id as string;

    /** An institution exam of S: content stored before its deadline, one room with P, the participants placed, then ACTIVE. */
    const institutionExam = async (teachingAssignmentId: string, roomLabel: string, store: (examId: string) => Promise<string[]>, people: Array<{ personId: string }>) => {
        const examId = (await pool.query(
            `INSERT INTO secure_assessment_exam_instances (tenant_id, teaching_assignment_id, assessment_type_id, lifecycle_state, window_starts_at, window_ends_at,
                configured_attempt_duration_seconds, latest_start_policy, room_based_operations_enabled, proctor_per_room_required, institution_session_id)
             VALUES ($1, $2, $3, 'SCHEDULED', statement_timestamp() - interval '10 minutes', statement_timestamp() + interval '3 hours', 3600,
                     'FULL_DURATION_BEYOND_WINDOW', TRUE, TRUE, $4)
             RETURNING id`, [tenant, teachingAssignmentId, teaching.assessmentTypeId, sessionId])).rows[0].id as string;
        await pool.query(
            `INSERT INTO secure_assessment_institution_preparation_deadlines (tenant_id, exam_instance_id, revision, deadline_at, set_by_person_id, action_key, request_digest)
             VALUES ($1, $2, 1, statement_timestamp() + interval '1 hour', $3, gen_random_uuid(), repeat('a', 64))`, [tenant, examId, operator.personId]);
        const snapshots = await store(examId);
        const room = (await pool.query('INSERT INTO secure_assessment_exam_rooms (tenant_id, exam_instance_id, display_label) VALUES ($1, $2, $3) RETURNING id',
            [tenant, examId, roomLabel])).rows[0].id as string;
        const assignment = (await pool.query('INSERT INTO secure_assessment_proctor_assignments (tenant_id, exam_instance_id, person_id) VALUES ($1, $2, $3) RETURNING id',
            [tenant, examId, proctor.personId])).rows[0].id as string;
        await pool.query('INSERT INTO secure_assessment_exam_proctor_room_assignments (tenant_id, exam_instance_id, proctor_assignment_id, exam_room_id) VALUES ($1, $2, $3, $4)',
            [tenant, examId, assignment, room]);
        await pool.query(`UPDATE secure_assessment_exam_instances SET lifecycle_state = 'ACTIVE' WHERE id = $1`, [examId]);
        for (const person of people) {
            const participantId = await addParticipant(pool, tenant, examId, person.personId);
            await pool.query('INSERT INTO secure_assessment_exam_participant_room_assignments (tenant_id, exam_instance_id, exam_participant_id, exam_room_id) VALUES ($1, $2, $3, $4)',
                [tenant, examId, participantId, room]);
        }
        return { examId, snapshots };
    };
    const storeGolden = (g: Golden) => async (examId: string) => {
        const ids: string[] = [];
        for (const [i, content] of g.contents.entries()) {
            ids.push((await pool.query('INSERT INTO secure_assessment_exam_question_snapshots (tenant_id, exam_instance_id, frozen_content, display_order) VALUES ($1, $2, $3, $4) RETURNING id',
                [tenant, examId, JSON.stringify(content), i + 1])).rows[0].id as string);
        }
        return ids;
    };

    const student = async (username: string) => {
        const person = await createPersonWithAccount(pool, username);
        await addMembership(pool, tenant, person.personId);
        return person;
    };
    const WHO: Who[] = ['x1', 'x2', 'x3', 'x4', 'x5', 'x6', 'x7', 'x8'];
    const xs = Object.fromEntries(await Promise.all(WHO.map(async w => [w, await student(`hasil.${w}`)] as const))) as Record<Who, Awaited<ReturnType<typeof student>>>;
    const ZS: Who[] = ['x1', 'x2', 'x3', 'x4', 'x5', 'x8'];
    const zs = Object.fromEntries(await Promise.all(ZS.map(async w => [w, await student(`hasil.z${w.slice(1)}`)] as const))) as Partial<Record<Who, Awaited<ReturnType<typeof student>>>>;
    const y1 = await student('hasil.y1');
    const y2 = await student('hasil.y2');

    const g1 = golden();
    const E1 = await institutionExam(teaching.teachingAssignmentId, 'Ruang 1', storeGolden(g1), WHO.map(w => xs[w]));
    const E2 = await institutionExam(physicsY, 'Ruang 2', async examId => addQuestionSnapshots(pool, tenant, examId, 2), [y1, y2]);
    const gTm = golden();
    const TM = await createExamInstance(pool, tenant, teaching3, { lifecycleState: 'ACTIVE' });
    const tmSnapshots = await storeGolden(gTm)(TM);
    for (const w of ZS) await addParticipant(pool, tenant, TM, zs[w]!.personId);

    /** A Student's attempt: start, an exam session and the timer, as the client does; saves declare every type. */
    const start = async (person: { username: string; password: string }, examId: string) => {
        const c = await login(person);
        const started = await c.request('/api/v1/assessment/attempts/start', { method: 'POST', body: { examInstanceId: examId } });
        assert.equal(started.status, 201, JSON.stringify(started.body));
        const attemptId: string = started.body.attemptId;
        const sessionId = randomUUID();
        assert.equal((await c.request('/api/v1/assessment/session/activate', { method: 'POST', body: { attemptId, sessionId } })).status, 200);
        assert.equal((await c.request('/api/v1/assessment/timer/start', { method: 'POST', body: { attemptId } })).status, 200);
        const save = (snapshotId: string, answerPayload: unknown, expectedWriteVersion: number | null = null) => c.request('/api/v1/assessment/answer/save',
            { method: 'POST', headers: ALL, body: { attemptId, sessionId, snapshotId, answerPayload, clientWriteIdentity: randomUUID(), expectedWriteVersion } });
        const submit = () => c.request('/api/v1/assessment/submit', { method: 'POST', body: { attemptId } });
        return { c, attemptId, sessionId, save, submit };
    };
    type Started = Awaited<ReturnType<typeof start>>;
    /** Saves a participant's §5 answers; the planted true/false value is refused on save and stored by fixture SQL. */
    const answer = async (s: Started, who: Who, g: Golden, snapshots: string[]) => {
        for (const [no, payload] of plan(who, g)) {
            if (payload === PLANTED) {
                const refused = await s.save(snapshots[no - 1], { value: 'true' });
                assert.deepEqual([refused.status, refused.body.error], [400, 'invalid_answer_payload'], `${who} item ${no}`);
                await pool.query('INSERT INTO secure_assessment_exam_answers (tenant_id, exam_attempt_id, exam_question_snapshot_id, answer_payload) VALUES ($1, $2, $3, $4)',
                    [tenant, s.attemptId, snapshots[no - 1], JSON.stringify({ value: 'true' })]);
                continue;
            }
            const r = await s.save(snapshots[no - 1], payload);
            assert.equal(r.status, 200, `${who} item ${no}: ${JSON.stringify(r.body)}`);
        }
    };
    const expire = (attemptId: string) => pool.query(
        `UPDATE secure_assessment_timer_state SET started_at = statement_timestamp() - (configured_duration_seconds + 60) * interval '1 second'
         WHERE exam_attempt_id = $1`, [attemptId]);

    // E1: x1..x4 and x8 answer and submit; x6 saves item 1 and its time runs out unsubmitted; x7 is still working; x5 never starts.
    const ax: Partial<Record<Who, Started>> = {};
    for (const w of ['x1', 'x2', 'x3', 'x4', 'x6', 'x7', 'x8'] as Who[]) {
        ax[w] = await start(xs[w], E1.examId);
        await answer(ax[w]!, w, g1, E1.snapshots);
    }
    for (const w of ['x1', 'x2', 'x3', 'x4', 'x8'] as Who[]) ok(await ax[w]!.submit());
    await expire(ax.x6!.attemptId);
    // E2: y1 answers item 1 correctly and submits; y2 never starts.
    const ay1 = await start(y1, E2.examId);
    ok(await ay1.save(E2.snapshots[0], { selectedOptionId: 'B' }));
    ok(await ay1.submit());
    const attempt = (w: Who) => ax[w]!.attemptId;
    const sid = (no: number) => E1.snapshots[no - 1];

    // ------------------------------------------------------------------ I-2, I-3
    await t.test('I-2 E6/E7: E1 ACTIVE, then PAUSED, refuses results, export (csv, print), worklist and grade with institution_exam_running; nothing is written; TM-G ACTIVE answers 200', async () => {
        for (const state of ['ACTIVE', 'PAUSED']) {
            if (state === 'PAUSED') assert.equal(ok(await control(E1.examId, 'pause')).lifecycleState, 'PAUSED');
            assert.equal(await stateOf(E1.examId), state);
            const expected = [409, { error: 'institution_exam_running', currentState: state }];
            await unchanged(async () => {
                for (const [label, r] of [
                    ['results', await results(tc1, E1.examId)], ['export csv', await exportResults(tc1, E1.examId, 'csv')], ['export print', await exportResults(tc1, E1.examId, 'print')],
                    ['worklist', await worklist(tc1, E1.examId)], ['grade', await grade(tc1, E1.examId, attempt('x1'), sid(9), '5')],
                ] as Array<[string, ClientResponse]>) {
                    assert.deepEqual([r.status, r.body], expected, `${label} while ${state}`);
                }
            });
        }
        assert.equal(ok(await control(E1.examId, 'resume')).lifecycleState, 'ACTIVE');
        const tm = ok(await results(tc3, TM));
        assert.equal(tm.exam.lifecycleState, 'ACTIVE');
        assert.equal(ok(await worklist(tc3, TM)).exam.lifecycleState, 'ACTIVE');
    });

    await t.test('I-3 after END: results, export, worklist and grade answer 200 for T1', async () => {
        assert.equal(ok(await control(E1.examId, 'end')).lifecycleState, 'ENDED');
        ok(await results(tc1, E1.examId));
        assert.equal(ok(await exportResults(tc1, E1.examId)).audit.outcome, 'ISSUED');
        ok(await worklist(tc1, E1.examId));
        for (const w of ['x1', 'x2'] as Who[]) {
            for (const [no, value] of GRADES[w]!) assert.equal(ok(await grade(tc1, E1.examId, attempt(w), sid(no), value)).revision, 1, `${w} item ${no}`);
        }
    });

    // ------------------------------------------------------------------ C02 golden vectors
    await t.test('G-1 provisional, x7 still running: scoring, questions, every row, the §4.3 invariants', async () => {
        const body = ok(await results(tc1, E1.examId));
        assert.equal(body.resultState, 'PROVISIONAL');
        assert.deepEqual(body.scoring, SCORING);
        assert.deepEqual(body.questions, QUESTIONS);
        assert.deepEqual(body.participants.map((r: Body) => r.elligbleId), WHO.map(w => `hasil.${w}`), 'ordered by ELLIGBLE ID');
        const row = (w: Who) => body.participants.find((r: Body) => r.elligbleId === `hasil.${w}`);
        for (const w of ['x1', 'x2', 'x3'] as Who[]) {
            assert.equal(row(w).status, 'SUBMITTED', w);
            assert.deepEqual([row(w).score, row(w).items], [FINAL[w]!.score, FINAL[w]!.items], w);
        }
        for (const w of ['x4', 'x8'] as Who[]) assert.deepEqual([row(w).score, row(w).items], [PROVISIONAL[w]!.score, PROVISIONAL[w]!.items], w);
        assert.deepEqual(row('x5'), { elligbleId: 'hasil.x5', status: 'NOT_STARTED', finalizationSource: null, submittedAt: null, score: null });
        for (const w of ['x6', 'x7'] as Who[]) {
            assert.deepEqual(row(w), { elligbleId: `hasil.${w}`, status: 'IN_PROGRESS', finalizationSource: null, submittedAt: null, score: null }, `${w}: no score, no items key`);
        }
        for (const r of body.participants.filter((p: Body) => p.score)) assertInvariants(r, r.elligbleId);
        assert.equal(body.questions.reduce((s: number, q: Body) => s + Math.round(q.maxScore * M), 0), 22 * M);
        assert.deepEqual(body.summary, { participants: 8, notStarted: 1, inProgress: 2, submitted: 5 });
    });

    await t.test('G-2 finalize refusals in order: attempts_running {running: 1} rolls back x6 EXPIRY_SERVER; then grading_incomplete {ungraded: 3}; each writes nothing', async () => {
        await unchanged(async () => {
            const running = await act(tc1, E1.examId, 'finalize');
            assert.deepEqual([running.status, running.body], [409, { error: 'attempts_running', running: 1 }]);
        });
        assert.equal((await pool.query('SELECT count(*)::int AS n FROM secure_assessment_exam_submissions WHERE exam_attempt_id = $1', [attempt('x6')])).rows[0].n, 0,
            'the EXPIRY_SERVER insert for x6 rolled back');
        ok(await ax.x7!.save(sid(3), { value: true }));
        ok(await ax.x7!.submit());
        await unchanged(async () => {
            const incomplete = await act(tc1, E1.examId, 'finalize');
            assert.deepEqual([incomplete.status, incomplete.body], [409, { error: 'grading_incomplete', ungraded: 3 }]);
        });
        assert.equal(await stateOf(E1.examId), 'ENDED');
    });

    let finalBefore: Body = {};
    await t.test('G-3 grade x4 and x8, then finalize: one COMPOSITE finalization of 9 questions and 22 000 000, item outcomes with rule, option and revision', async () => {
        for (const w of ['x4', 'x8'] as Who[]) {
            for (const [no, value] of GRADES[w]!) assert.equal(ok(await grade(tc1, E1.examId, attempt(w), sid(no), value)).revision, 1, `${w} item ${no}`);
        }
        const finalized = ok(await act(tc1, E1.examId, 'finalize'));
        assert.deepEqual([finalized.lifecycleState, finalized.changed, finalized.audit.outcome, finalized.audit.replayed], ['FINALIZED', true, 'APPLIED', false]);
        assert.equal((await pool.query(`SELECT count(*)::int AS n FROM secure_assessment_permission_action_events WHERE exam_instance_id = $1 AND action_kind = 'EXAM_TRANSITION' AND action = 'finalize' AND outcome = 'APPLIED'`,
            [E1.examId])).rows[0].n, 1, 'the EXAM_TRANSITION audit');
        const head = (await pool.query('SELECT id, scoring_rule, question_count, max_score_micro, pending_issues FROM secure_assessment_exam_result_finalizations WHERE exam_instance_id = $1', [E1.examId])).rows;
        assert.equal(head.length, 1);
        assert.deepEqual([head[0].scoring_rule, Number(head[0].question_count), Number(head[0].max_score_micro), head[0].pending_issues], ['COMPOSITE_PER_ITEM_V1', 9, 22 * M, []]);
        assert.equal((await pool.query('SELECT finalization_source FROM secure_assessment_exam_submissions WHERE exam_attempt_id = $1', [attempt('x6')])).rows[0].finalization_source, 'EXPIRY_SERVER');
        const frozen = (await pool.query('SELECT exam_attempt_id, standing, item_outcomes FROM secure_assessment_attempt_results WHERE finalization_id = $1', [head[0].id])).rows;
        assert.equal(frozen.length, 8);
        for (const r of frozen.filter(f => f.standing === 'SUBMITTED')) {
            const its: Body[] = r.item_outcomes;
            assert.deepEqual(its.map(i => i.questionSnapshotId), E1.snapshots, 'frozen in display order');
            assert.deepEqual(its.map(i => i.ruleId), RULES);
            assert.deepEqual(its.map(i => 'selectedOptionId' in i), [true, false, false, false, false, false, false, false, false], 'selectedOptionId only on item 1');
            for (const [k, item] of its.entries()) {
                if (item.outcome === 'GRADED') assert.equal(item.gradeRevision, await revision(r.exam_attempt_id, E1.snapshots[k]), 'gradeRevision is the 0061 revision');
                else assert.equal('gradeRevision' in item, false);
            }
        }
        assert.deepEqual(frozen.filter(f => f.standing === 'ABSENT').map(f => f.item_outcomes), [null], 'x5 is ABSENT');
    });

    await t.test('G-4 FINAL read: the §5 table; FINAL items equal the frozen outcomes; summary; ELLIGBLE ID order', async () => {
        const body = ok(await results(tc1, E1.examId));
        finalBefore = body;
        assert.equal(body.resultState, 'FINAL');
        assert.deepEqual(body.scoring, SCORING);
        assert.deepEqual(body.questions, QUESTIONS);
        assert.deepEqual(body.summary, { participants: 8, notStarted: 1, inProgress: 0, submitted: 7 });
        assert.deepEqual(body.participants.map((r: Body) => r.elligbleId), WHO.map(w => `hasil.${w}`));
        const frozen = new Map((await pool.query(
            `SELECT r.exam_attempt_id, r.item_outcomes FROM secure_assessment_attempt_results r JOIN secure_assessment_exam_result_finalizations f ON f.id = r.finalization_id
             WHERE f.exam_instance_id = $1 AND r.standing = 'SUBMITTED'`, [E1.examId])).rows.map(r => [r.exam_attempt_id as string, r.item_outcomes as Body[]]));
        for (const w of WHO) {
            const row = body.participants.find((r: Body) => r.elligbleId === `hasil.${w}`);
            if (w === 'x5') {
                assert.deepEqual(row, { elligbleId: 'hasil.x5', status: 'ABSENT', finalizationSource: null, submittedAt: null, score: null });
                continue;
            }
            assert.equal(row.status, 'SUBMITTED', w);
            assert.equal(row.finalizationSource, w === 'x6' ? 'EXPIRY_SERVER' : 'STUDENT_SUBMIT', w);
            assert.deepEqual([row.score, row.items], [FINAL[w]!.score, FINAL[w]!.items], w);
            const fromFrozen = frozen.get(attempt(w))!.map(i => ({ no: E1.snapshots.indexOf(i.questionSnapshotId) + 1, outcome: i.outcome, score: i.scoreMicro / M }));
            assert.deepEqual(row.items, fromFrozen, `${w}: FINAL items are the frozen outcomes`);
            assertInvariants(row, w);
        }
    });

    await t.test('G-5 idempotent finalization: changed false and a NO_OP audit; one finalization row and one FINALIZED event', async () => {
        const again = ok(await act(tc1, E1.examId, 'finalize'));
        assert.deepEqual([again.lifecycleState, again.changed, again.audit.outcome], ['FINALIZED', false, 'NO_OP']);
        assert.equal((await pool.query('SELECT count(*)::int AS n FROM secure_assessment_exam_result_finalizations WHERE exam_instance_id = $1', [E1.examId])).rows[0].n, 1);
        assert.equal((await pool.query(`SELECT count(*)::int AS n FROM secure_assessment_exam_lifecycle_events WHERE exam_instance_id = $1 AND to_state = 'FINALIZED'`, [E1.examId])).rows[0].n, 1);
    });

    await t.test('G-6 teacher-managed equivalence: TM-G gives the same items, counts and totals while ACTIVE and after finalization', async () => {
        const az: Partial<Record<Who, Started>> = {};
        for (const w of ['x1', 'x2', 'x3', 'x4', 'x8'] as Who[]) {
            az[w] = await start(zs[w]!, TM);
            await answer(az[w]!, w, gTm, tmSnapshots);
            ok(await az[w]!.submit());
        }
        // E6/E7 do not apply: T3 grades while TM-G is ACTIVE.
        for (const w of ['x1', 'x2', 'x4', 'x8'] as Who[]) {
            for (const [no, value] of GRADES[w]!) ok(await grade(tc3, TM, az[w]!.attemptId, tmSnapshots[no - 1], value));
        }
        const compare = (body: Body, label: string) => {
            assert.deepEqual(body.scoring, SCORING, label);
            assert.deepEqual(body.questions, QUESTIONS, label);
            for (const w of ['x1', 'x2', 'x3', 'x4', 'x8'] as Who[]) {
                const row = body.participants.find((r: Body) => r.elligbleId === `hasil.z${w.slice(1)}`);
                assert.deepEqual([row.score, row.items], [FINAL[w]!.score, FINAL[w]!.items], `${label} z${w.slice(1)}`);
            }
            assert.equal(body.participants.find((r: Body) => r.elligbleId === 'hasil.z5').score, null);
        };
        const active = ok(await results(tc3, TM));
        assert.deepEqual([active.exam.lifecycleState, active.resultState], ['ACTIVE', 'PROVISIONAL']);
        compare(active, 'ACTIVE');
        ok(await act(tc3, TM, 'end'));
        assert.equal(ok(await act(tc3, TM, 'finalize')).lifecycleState, 'FINALIZED');
        const final = ok(await results(tc3, TM));
        assert.equal(final.resultState, 'FINAL');
        compare(final, 'FINAL');
    });

    await t.test('I-1 per subject and G-7 all-v1: E1 FINAL while E2 is ENDED; O sees the states without a score; T2 finalizes E2 with the baseline rule', async () => {
        assert.equal(ok(await control(E2.examId, 'end')).lifecycleState, 'ENDED');
        const session = ok(await oc.request(`${SV}?sessionId=${sessionId}`));
        const byId = new Map(session.exams.map((e: Body) => [e.examInstanceId, e]));
        assert.deepEqual([(byId.get(E1.examId) as Body).lifecycleState, (byId.get(E2.examId) as Body).lifecycleState], ['FINALIZED', 'ENDED']);
        for (const key of ['score', 'rawScore', 'scaledScore', 'items', 'questions']) assert.equal(keysOf(session).has(key), false, `O's session view: no ${key}`);
        for (const exam of [E1.examId, E2.examId]) {
            const view = await oc.request(`${SV}/exam?examInstanceId=${exam}`);
            if (view.status === 200) for (const key of ['score', 'rawScore', 'scaledScore', 'items', 'questions']) assert.equal(keysOf(view.body).has(key), false, `O's exam view: no ${key}`);
        }
        const e2 = ok(await act(tc2, E2.examId, 'finalize'));
        assert.equal(e2.changed, true);
        const head = (await pool.query('SELECT id, scoring_rule FROM secure_assessment_exam_result_finalizations WHERE exam_instance_id = $1', [E2.examId])).rows[0];
        assert.equal(head.scoring_rule, 'BASELINE_SINGLE_CHOICE_V1');
        const frozen = (await pool.query('SELECT item_outcomes FROM secure_assessment_attempt_results WHERE finalization_id = $1 AND exam_attempt_id = $2', [head.id, ay1.attemptId])).rows[0].item_outcomes;
        assert.deepEqual(frozen, [
            { questionSnapshotId: E2.snapshots[0], selectedOptionId: 'B', outcome: 'CORRECT', scoreMicro: M, maxScoreMicro: M },
            { questionSnapshotId: E2.snapshots[1], selectedOptionId: null, outcome: 'UNANSWERED', scoreMicro: 0, maxScoreMicro: M },
        ], 'v1 item outcomes exactly as before: selectedOptionId, no ruleId');
        const body = ok(await results(tc2, E2.examId));
        assert.equal(body.scoring.rule, 'BASELINE_SINGLE_CHOICE_V1');
        assert.deepEqual(body.questions, [{ no: 1, typeCode: 'PG', maxScore: 1 }, { no: 2, typeCode: 'PG', maxScore: 1 }]);
        const y = body.participants.find((r: Body) => r.elligbleId === 'hasil.y1');
        assert.deepEqual(y.items, [{ no: 1, outcome: C, score: 1 }, { no: 2, outcome: U, score: 0 }]);
        assert.deepEqual(body.participants.find((r: Body) => r.elligbleId === 'hasil.y2'), { elligbleId: 'hasil.y2', status: 'ABSENT', finalizationSource: null, submittedAt: null, score: null });
        // No response sums E1 and E2 (O05-1).
        assert.equal(finalBefore.scoring.maxScore, 22);
        assert.equal(body.scoring.maxScore, 2);
    });

    // ------------------------------------------------------------------ C03 authority and minimization
    await t.test('I-4 wrong subject (N03) and N02 substitution: 403 byte-identical with a nonexistent id, zero mutation', async () => {
        const nonexistent = randomUUID();
        await unchanged(async () => {
            const answers: Array<[string, ClientResponse]> = [];
            for (const [label, c, exam, attemptId, snapshotId] of [
                ['T2 on E1', tc2, E1.examId, attempt('x2'), sid(9)], ['T1 on E2', tc1, E2.examId, ay1.attemptId, E2.snapshots[0]],
                ['T1 on a nonexistent exam', tc1, nonexistent, attempt('x2'), sid(9)], ['T1 on an exam of tenant 2', tc1, foreignExam, attempt('x2'), sid(9)],
            ] as Array<[string, BrowserLikeClient, string, string, string]>) {
                answers.push([`${label} results`, await results(c, exam)], [`${label} export`, await exportResults(c, exam)], [`${label} worklist`, await worklist(c, exam)],
                    [`${label} grade`, await grade(c, exam, attemptId, snapshotId, '1')], [`${label} finalize`, await act(c, exam, 'finalize')]);
            }
            for (const [label, r] of answers) assert.deepEqual([r.status, r.body], [403, { error: 'forbidden' }], label);
        });
    });

    await t.test('I-5 roles (N01, N04, N05): anonymous 401; O, P, H, a Student, actor A and T9 get 403 on the five routes for E1 and TM-G', async () => {
        await unchanged(async () => {
            for (const exam of [E1.examId, TM]) {
                const refused: Array<[string, BrowserLikeClient]> = [['O', oc], ['P', pc], ['H', hc], ['x1', ax.x1!.c], ['A', ac], ['T9 in tenant 1', t9InOurs], ['T9 in its own tenant', t9Own]];
                for (const [who, c] of refused) {
                    for (const [label, r] of [
                        ['results', await results(c, exam)], ['export', await exportResults(c, exam)], ['worklist', await worklist(c, exam)],
                        ['grade', await grade(c, exam, attempt('x1'), sid(9), '1')], ['finalize', await act(c, exam, 'finalize')],
                    ] as Array<[string, ClientResponse]>) {
                        assert.deepEqual([r.status, r.body], [403, { error: 'forbidden' }], `${who} ${label} ${exam === TM ? 'TM-G' : 'E1'}`);
                    }
                }
                for (const r of [await results(anonymous, exam), await exportResults(anonymous, exam), await worklist(anonymous, exam),
                    await grade(anonymous, exam, attempt('x1'), sid(9), '1'), await act(anonymous, exam, 'finalize')]) {
                    assert.equal(r.status, 401);
                }
            }
            // N01: an unavailable database gives 503 with nothing written.
            const unavailable = { connect: async () => { throw Object.assign(new Error('database unavailable'), { code: 'ECONNREFUSED' }); }, query: async () => { throw new Error('database unavailable'); } };
            const down = await startProductionWiredServer(unavailable as unknown as pg.Pool);
            try {
                const dc = new BrowserLikeClient(down.baseUrl);
                dc.cookie = tc1.cookie;
                dc.tenantId = tenant;
                for (const r of [await results(dc, E1.examId), await exportResults(dc, E1.examId), await worklist(dc, E1.examId),
                    await grade(dc, E1.examId, attempt('x1'), sid(9), '1'), await act(dc, E1.examId, 'finalize')]) {
                    assert.deepEqual([r.status, r.body], [503, { error: 'persistence_unavailable' }]);
                }
            } finally {
                await down.close();
            }
        });
    });

    await t.test('I-7 minimization (N05): results, export, grade and finalize receipts carry no forbidden key or answer text; the worklist no identity key', async () => {
        const responses = [ok(await results(tc1, E1.examId)), ok(await exportResults(tc1, E1.examId)), ok(await act(tc1, E1.examId, 'finalize')), ok(await results(tc3, TM))];
        for (const body of responses) {
            const keys = keysBeyondScores(body);
            for (const key of FORBIDDEN) assert.equal(keys.has(key), false, `no ${key}`);
            for (const text of ANSWER_TEXTS) assert.doesNotMatch(JSON.stringify(body), new RegExp(text), `no answer text ${text}`);
        }
        const receipt = await grade(tc1, E1.examId, attempt('x1'), sid(9), '5', 1);
        assert.deepEqual([receipt.status, receipt.body], [409, { error: 'invalid_state', currentState: 'FINALIZED' }], 'E1 is FINALIZED');
        const race = await raceExam('minimal', { graded: false });
        const written = ok(await grade(tc3, race.exam, race.attemptId, race.essay, '3'));
        const keys = keysOf(written);
        for (const key of FORBIDDEN) assert.equal(keys.has(key), false, `grade receipt: no ${key}`);
        const list = ok(await worklist(tc1, E1.examId));
        const listKeys = keysOf(list);
        for (const key of IDENTITY) assert.equal(listKeys.has(key), false, `worklist: no ${key}`);
    });

    await t.test('N08 exact bodies and replays: finalize without reason or confirmation 400; a finalize key replayed with another body action_key_reused', async () => {
        const race = await raceExam('n08', { graded: true });
        await unchanged(async () => {
            // N02 on the grade write: an Attempt or a snapshot of another exam gives the existing refusal, byte-identical with a nonexistent one.
            const answers = [
                await grade(tc3, race.exam, ay1.attemptId, race.essay, '1', 1), await grade(tc3, race.exam, randomUUID(), race.essay, '1', 1),
                await grade(tc3, race.exam, race.attemptId, sid(9), '1', 1), await grade(tc3, race.exam, race.attemptId, randomUUID(), '1', 1),
            ];
            for (const r of answers) assert.deepEqual([r.status, r.body], [409, { error: 'not_gradable' }]);
            const noReason = await post(tc3, TRANSITION, { examInstanceId: race.exam, action: 'finalize', confirmed: true, actionKey: randomUUID() });
            const noConfirm = await post(tc3, TRANSITION, { examInstanceId: race.exam, action: 'finalize', reason: 'Hasil lengkap', actionKey: randomUUID() });
            for (const r of [noReason, noConfirm]) assert.deepEqual([r.status, r.body], [400, { error: 'invalid_request' }]);
        });
        const key = randomUUID();
        ok(await act(tc3, race.exam, 'finalize', { actionKey: key }));
        await unchanged(async () => {
            const reused = await act(tc3, race.exam, 'finalize', { actionKey: key, reason: 'Alasan lain' });
            assert.deepEqual([reused.status, reused.body], [409, { error: 'action_key_reused' }]);
        });
    });

    await t.test('N10 the edge: a disallowed Origin and a 65 KiB body are refused on every POST route before any effect', async () => {
        await unchanged(async () => {
            for (const path of [RESULTS, GRADE, TRANSITION]) {
                const foreignOrigin = await tc1.request(path, { method: 'POST', body: { examInstanceId: E1.examId }, origin: 'https://lain.example' });
                assert.deepEqual([foreignOrigin.status, foreignOrigin.body], [403, { error: 'origin_not_allowed' }], path);
                const large = await tc1.request(path, { method: 'POST', rawBody: JSON.stringify({ reason: 'x'.repeat(65 * 1024) }), headers: { 'Content-Type': 'application/json' } });
                assert.equal(large.status, 413, path);
            }
        });
    });

    // ------------------------------------------------------------------ C04 tamper
    await t.test('T-1 append-only: UPDATE and DELETE on both 0045 tables and on 0061 are refused', async () => {
        await assert.rejects(pool.query('UPDATE secure_assessment_attempt_results SET scaled_score = 100 WHERE exam_attempt_id = $1', [attempt('x2')]), /append-only/);
        await assert.rejects(pool.query('DELETE FROM secure_assessment_attempt_results WHERE exam_attempt_id = $1', [attempt('x2')]), /append-only/);
        await assert.rejects(pool.query('UPDATE secure_assessment_exam_result_finalizations SET question_count = 1 WHERE exam_instance_id = $1', [E1.examId]), /append-only/);
        await assert.rejects(pool.query('DELETE FROM secure_assessment_exam_result_finalizations WHERE exam_instance_id = $1', [E1.examId]), /append-only/);
        await assert.rejects(pool.query('UPDATE secure_assessment_essay_grade_revisions SET score_micro = 0 WHERE exam_attempt_id = $1', [attempt('x2')]), /append-only/);
        await assert.rejects(pool.query('DELETE FROM secure_assessment_essay_grade_revisions WHERE exam_attempt_id = $1', [attempt('x2')]), /append-only/);
    });

    await t.test('T-2 frozen against later writes: a grade is refused; raw-SQL answer, key, maxScore, order and grade changes leave the FINAL response byte-identical', async () => {
        const refused = await grade(tc1, E1.examId, attempt('x2'), sid(9), '5', 1);
        assert.deepEqual([refused.status, refused.body], [409, { error: 'invalid_state', currentState: 'FINALIZED' }]);
        const before = JSON.stringify(ok(await results(tc1, E1.examId)));
        assert.equal(before, JSON.stringify(finalBefore));
        await pool.query(`UPDATE secure_assessment_exam_answers SET answer_payload = '{"value":true}' WHERE exam_attempt_id = $1 AND exam_question_snapshot_id = $2`, [attempt('x2'), sid(3)]);
        await pool.query('ALTER TABLE secure_assessment_exam_question_snapshots DISABLE TRIGGER trg_prevent_snapshot_mutation');
        try {
            const wrong = g1.contents[0].options[0].id as string;
            await pool.query(`UPDATE secure_assessment_exam_question_snapshots SET frozen_content = jsonb_set(jsonb_set(frozen_content, '{correctOptionId}', to_jsonb($2::text)), '{maxScore}', '10') WHERE id = $1`, [sid(1), wrong]);
            await pool.query('UPDATE secure_assessment_exam_question_snapshots SET display_order = 100 WHERE id = $1', [sid(1)]);
            await pool.query('UPDATE secure_assessment_exam_question_snapshots SET display_order = 1 WHERE id = $1', [sid(2)]);
            await pool.query('UPDATE secure_assessment_exam_question_snapshots SET display_order = 2 WHERE id = $1', [sid(1)]);
        } finally {
            await pool.query('ALTER TABLE secure_assessment_exam_question_snapshots ENABLE TRIGGER trg_prevent_snapshot_mutation');
        }
        await pool.query(
            'INSERT INTO secure_assessment_essay_grade_revisions (tenant_id, exam_attempt_id, exam_question_snapshot_id, revision, score_micro, graded_by_person_id) VALUES ($1, $2, $3, 2, $4, $5)',
            [tenant, attempt('x2'), sid(9), 5 * M, t1.personId]);
        const after = ok(await results(tc1, E1.examId));
        assert.equal(JSON.stringify(after), before, 'questions, items, counts, totals and scoring.maxScore 22 are byte-identical (the CSV is a function of them)');
        assert.equal(after.scoring.maxScore, 22);
        // R4: the read-only worklist of a FINALIZED exam shows the current grade revision, which no product path can write.
        const essay = ok(await worklist(tc1, E1.examId)).questions.find((q: Body) => q.snapshotId === sid(9));
        assert.equal(essay.answers.find((a: Body) => a.elligbleId === 'hasil.x2').grade.revision, 2);
    });

    // ------------------------------------------------------------------ C04 concurrency, each on a race exam of its own
    /**
     * A teacher-managed exam of T3 with a PG (1) and an ES (5) item and one Student, ENDED. The Student answers both items
     * (the essay only when essayAnswered is not false) and submits, unless the Attempt is to stay running or to expire.
     */
    async function raceExam(name: string, options: { graded?: boolean; running?: boolean; expired?: boolean; essayAnswered?: boolean } = {}) {
        const exam = await createExamInstance(pool, tenant, teaching3 as TeachingContext, { lifecycleState: 'ACTIVE' });
        const [pg1] = await addQuestionSnapshots(pool, tenant, exam, 1);
        const essay = (await pool.query('INSERT INTO secure_assessment_exam_question_snapshots (tenant_id, exam_instance_id, frozen_content, display_order) VALUES ($1, $2, $3, 2) RETURNING id',
            [tenant, exam, JSON.stringify(buildEssayFrozenContent({ prompt: 'Jelaskan alasanmu', rubric: '', maxScore: 5 }))])).rows[0].id as string;
        const person = await student(`balapan.${name}`);
        await addParticipant(pool, tenant, exam, person.personId);
        const s = await start(person, exam);
        ok(await s.save(pg1, { selectedOptionId: 'B' }));
        if (options.essayAnswered !== false) ok(await s.save(essay, { essayText: 'Jawaban balapan.' }));
        if (options.expired) await expire(s.attemptId);
        else if (!options.running) ok(await s.submit());
        ok(await act(tc3, exam, 'end'));
        if (options.graded) ok(await grade(tc3, exam, s.attemptId, essay, '3'));
        return { exam, attemptId: s.attemptId, essay, student: s };
    }
    const finalizations = async (exam: string) => (await pool.query('SELECT count(*)::int AS n FROM secure_assessment_exam_result_finalizations WHERE exam_instance_id = $1', [exam])).rows[0].n as number;
    /** A server on a pool that pauses the first matching query; the client carries the given session. */
    async function gatedServer(matches: (sql: string) => boolean, session: BrowserLikeClient) {
        const g = gate();
        const server = await startProductionWiredServer(gatedPool(pool, matches, g));
        const client = new BrowserLikeClient(server.baseUrl);
        client.cookie = session.cookie;
        client.tenantId = tenant;
        return { g, server, client };
    }

    await t.test('K-1 grade and finalize, grade first: the grade holds the exam FOR KEY SHARE, finalize waits and then freezes the grade', async () => {
        const race = await raceExam('k1a');
        const held = await hold(pool, [['SELECT pg_advisory_xact_lock(hashtext($1))', [`sa-essay-grade:${tenant}:${race.attemptId}:${race.essay}`]]]);
        const grading = grade(tc3, race.exam, race.attemptId, race.essay, '4');
        await lockWaiters(pool, 1, [grading]);
        const finalizing = act(tc3, race.exam, 'finalize');
        await lockWaiters(pool, 2, [grading, finalizing]);
        await held.commit();
        const [graded, finalized] = await Promise.all([bounded(grading, 'grade'), bounded(finalizing, 'finalize')]);
        assert.equal(ok(graded).revision, 1);
        assert.equal(ok(finalized).changed, true);
        const frozen = (await pool.query(
            `SELECT r.item_outcomes FROM secure_assessment_attempt_results r JOIN secure_assessment_exam_result_finalizations f ON f.id = r.finalization_id WHERE f.exam_instance_id = $1`,
            [race.exam])).rows[0].item_outcomes;
        assert.deepEqual([frozen[1].outcome, frozen[1].scoreMicro, frozen[1].gradeRevision], ['GRADED', 4 * M, 1]);
    });

    await t.test('K-1 grade and finalize, finalize first: the waiting grade sees FINALIZED and gets invalid_state; no revision written', async () => {
        const race = await raceExam('k1b', { graded: true });
        const gated = await gatedServer(sql => sql.includes('FOR UPDATE OF i'), tc3);
        try {
            const finalizing = act(gated.client, race.exam, 'finalize');
            await gated.g.arrived;
            const grading = grade(tc3, race.exam, race.attemptId, race.essay, '5', 1);
            await lockWaiters(pool, 1, [grading]);
            gated.g.release();
            const [finalized, late] = await Promise.all([bounded(finalizing, 'finalize'), bounded(grading, 'grade')]);
            assert.equal(ok(finalized).changed, true);
            assert.deepEqual([late.status, late.body], [409, { error: 'invalid_state', currentState: 'FINALIZED' }]);
            assert.equal(await revision(race.attemptId, race.essay), 1, 'no revision written');
        } finally {
            gated.g.release();
            await gated.server.close();
        }
    });

    await t.test('K-2 two finalizations at once: one changed, the other NO_OP; one finalization row', async () => {
        const race = await raceExam('k2', { graded: true });
        const both = await Promise.all([bounded(act(tc3, race.exam, 'finalize'), 'first'), bounded(act(tc3, race.exam, 'finalize'), 'second')]);
        assert.deepEqual(both.map(r => ok(r).changed).sort(), [false, true]);
        assert.deepEqual(both.map(r => r.body.audit.outcome).sort(), ['APPLIED', 'NO_OP']);
        assert.equal(await finalizations(race.exam), 1);
    });

    await t.test('K-3 finalize and submit: a submit waiting on a finalize that counted it running; finalize refuses and rolls back, the submit succeeds', async () => {
        const race = await raceExam('k3a', { running: true, essayAnswered: false });
        const gated = await gatedServer(sql => sql.includes('count(*)::int AS n') && sql.includes('secure_assessment_timer_state t') && sql.includes('NOT EXISTS (SELECT 1 FROM secure_assessment_exam_submissions'), tc3);
        try {
            const finalizing = act(gated.client, race.exam, 'finalize');
            await gated.g.arrived;
            const submitting = race.student.submit();
            await lockWaiters(pool, 1, [submitting]);
            gated.g.release();
            const [refused, submitted] = await Promise.all([bounded(finalizing, 'finalize'), bounded(submitting, 'submit')]);
            assert.deepEqual([refused.status, refused.body], [409, { error: 'attempts_running', running: 1 }]);
            ok(submitted);
            assert.equal(await finalizations(race.exam), 0);
        } finally {
            gated.g.release();
            await gated.server.close();
        }
    });

    await t.test('K-3 the opposite order: a submit holding its locks makes finalize wait; finalize then succeeds with the Student SUBMITTED', async () => {
        const race = await raceExam('k3b', { running: true, essayAnswered: false });
        const gated = await gatedServer(sql => sql.includes('INSERT INTO secure_assessment_exam_submissions'), race.student.c);
        try {
            const submitting = gated.client.request('/api/v1/assessment/submit', { method: 'POST', body: { attemptId: race.attemptId } });
            await gated.g.arrived;
            const finalizing = act(tc3, race.exam, 'finalize');
            await lockWaiters(pool, 1, [finalizing]);
            gated.g.release();
            const [submitted, finalized] = await Promise.all([bounded(submitting, 'submit'), bounded(finalizing, 'finalize')]);
            ok(submitted);
            assert.equal(ok(finalized).changed, true, 'finalize saw the committed submission');
            const standing = (await pool.query(
                `SELECT r.standing FROM secure_assessment_attempt_results r JOIN secure_assessment_exam_result_finalizations f ON f.id = r.finalization_id WHERE f.exam_instance_id = $1`,
                [race.exam])).rows.map(r => r.standing);
            assert.deepEqual(standing, ['SUBMITTED']);
        } finally {
            gated.g.release();
            await gated.server.close();
        }
    });

    await t.test('K-4 finalize and the expiry finalizer: an expired Attempt gets exactly one submission whichever commits first; the FINAL row matches', async () => {
        const race = await raceExam('k4', { expired: true, essayAnswered: false });
        const [finalized, swept] = await Promise.all([bounded(act(tc3, race.exam, 'finalize'), 'finalize'), bounded(finalizeExpiredAttempts(pool), 'expiry finalizer')]);
        assert.ok(swept);
        assert.equal(ok(finalized).changed, true);
        const submissions = (await pool.query('SELECT finalization_source FROM secure_assessment_exam_submissions WHERE exam_attempt_id = $1', [race.attemptId])).rows;
        assert.deepEqual(submissions.map(r => r.finalization_source), ['EXPIRY_SERVER'], 'exactly one submission (ON CONFLICT DO NOTHING)');
        const row = (await pool.query(
            `SELECT r.standing, r.finalization_source, r.raw_score_micro FROM secure_assessment_attempt_results r
             JOIN secure_assessment_exam_result_finalizations f ON f.id = r.finalization_id WHERE f.exam_instance_id = $1`, [race.exam])).rows;
        assert.deepEqual(row.map(r => [r.standing, r.finalization_source, Number(r.raw_score_micro)]), [['SUBMITTED', 'EXPIRY_SERVER', M]], 'the PG answer saved before expiry counts');
    });

    await t.test('K-5 export and finalize: a key issued while PROVISIONAL, retried after finalization, is export_data_changed; a new key exports FINAL; each digest matches its projection', async () => {
        const race = await raceExam('k5', { graded: true });
        const key = randomUUID();
        const digestOf = async (auditId: string) => (await pool.query('SELECT result_digest FROM secure_assessment_permission_action_events WHERE id = $1', [auditId])).rows[0].result_digest as string;
        const projection = (body: Body) => { const { audit: _a, format: _f, issuedAt: _i, ...rest } = body; return rest; };
        const issued = ok(await exportResults(tc3, race.exam, 'csv', key));
        assert.deepEqual([issued.resultState, issued.audit.outcome], ['PROVISIONAL', 'ISSUED']);
        assert.ok(Array.isArray(issued.questions) && issued.participants[0].items.length === 2, 'the export carries the item projection');
        assert.equal(await digestOf(issued.audit.id), permissionDigest(projection(issued)));
        ok(await act(tc3, race.exam, 'finalize'));
        await unchanged(async () => {
            const changed = await exportResults(tc3, race.exam, 'csv', key);
            assert.deepEqual([changed.status, changed.body.error, changed.body.audit.replayed], [409, 'export_data_changed', true]);
        });
        const fresh = ok(await exportResults(tc3, race.exam, 'csv'));
        assert.equal(fresh.resultState, 'FINAL');
        assert.equal(await digestOf(fresh.audit.id), permissionDigest(projection(fresh)));
    });

    await t.test('K-6 concurrent grades with the same expected revision: one 200, one stale_grade', async () => {
        const race = await raceExam('k6');
        const both = await Promise.all([bounded(grade(tc3, race.exam, race.attemptId, race.essay, '2'), 'first'), bounded(grade(tc3, race.exam, race.attemptId, race.essay, '3'), 'second')]);
        assert.deepEqual(both.map(r => r.status).sort(), [200, 409]);
        assert.deepEqual(both.find(r => r.status === 409)!.body, { error: 'stale_grade', current: 1 });
        assert.equal(await revision(race.attemptId, race.essay), 1);
    });

    // ------------------------------------------------------------------ I-6 last: it revokes T1
    await t.test('I-6 combined roles (P03): T1 who is also O reads and finalizes E1 as Teacher; as O alone (assignment revoked) 403; a revoked T1 403', async () => {
        await operatorAssignment(pool, tenant, t1.personId, 'ASSIGN');
        ok(await results(tc1, E1.examId));
        assert.equal(ok(await act(tc1, E1.examId, 'finalize')).changed, false);
        await pool.query('UPDATE academic_core_teaching_assignments SET revoked_at = now() WHERE id = $1', [teaching.teachingAssignmentId]);
        await unchanged(async () => {
            for (const r of [await results(tc1, E1.examId), await exportResults(tc1, E1.examId), await worklist(tc1, E1.examId),
                await grade(tc1, E1.examId, attempt('x1'), sid(9), '1'), await act(tc1, E1.examId, 'finalize')]) {
                assert.deepEqual([r.status, r.body], [403, { error: 'forbidden' }]);
            }
        });
    });
});
