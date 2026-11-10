import { test } from 'node:test';
import * as assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import type pg from 'pg';
import { createDisposableDatabase, skipWithoutDatabase } from '../support/pg-harness.ts';
import {
    addMembership, addParticipant, addQuestionSnapshots, createExamInstance, createPersonWithAccount, createTeachingContext, createTenant,
    enrollInTeachingGroup, type TeachingContext,
} from '../support/fixtures.ts';
import { BrowserLikeClient, startProductionWiredServer, type ClientResponse } from '../support/test-server.ts';
import { setSchoolOperator } from '../../../tenant-access/src/school-operator.ts';

// ASSESS-INSTITUTION-003 real PostgreSQL oracle (record §5 I-1 to I-19, the §4.9 map, C03) through the production-wired
// server: the drill-down and its tenant scope (I-1); opening one exam with the E7 order (I-2); the session shortcut
// (I-3); pause, resume and end with their boundaries (I-4); lock and unlock (I-5); added time (I-6); messages (I-7); the
// subject Teacher under D04.4-26D (I-8); the Proctor unchanged (I-9); target substitution and every role (I-10); stale
// state and revoked roles (I-11); replay and duplicates (I-12); the audit evidence (I-13); running exams never locked by
// room writes or the activate shortcut (I-14); freshness (I-15); minimization (I-16); the teacher-managed regression
// (I-17); the edge (I-19). Migration 0064 upgrade, rollback, repeat and its guards are the second test (I-18).
// Fixture SQL stores the questions before the deadline and moves the exam windows of S1 and S3 to now (E16): the
// product refuses sessions in the past and opening needs an open window; the session rows stay append-only.

const P = '/api/v1/assessment/institution-exams';
const R = `${P}/rooms`;
const SV = `${P}/supervision`;
const MON = '/api/v1/assessment/exam-monitoring';
const TE = '/api/v1/assessment/teacher-exams';
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

function wibParts(offsetMs: number) {
    return Object.fromEntries(new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Asia/Jakarta', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
    }).formatToParts(new Date(Date.now() + offsetMs)).map(p => [p.type, p.value]));
}
/** The school-zone (WIB) date `days` from today. */
const wibDay = (days: number) => { const p = wibParts(days * 86_400_000); return `${p.year}-${p.month}-${p.day}`; };
/** WIB wall clock `minutes` from now. */
const wib = (minutes: number) => { const p = wibParts(minutes * 60_000); return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}`; };

type Body = Record<string, any>;
const post = (c: BrowserLikeClient, path: string, body: Body) => c.request(path, { method: 'POST', body });

const TABLES = [
    'secure_assessment_institution_control_actions', 'secure_assessment_institution_control_entries', 'secure_assessment_exam_lifecycle_events',
    'secure_assessment_exam_pauses', 'secure_assessment_attempt_locks', 'secure_assessment_timer_adjustments', 'secure_assessment_exam_broadcasts',
    'secure_assessment_exam_broadcast_recipients', 'secure_assessment_permission_action_events', 'secure_assessment_exam_attempts',
    'secure_assessment_institution_room_actions', 'secure_assessment_proctor_assignments',
];
/** Every table a control touches, with the states an UPDATE changes (lifecycle, open pauses and locks). */
async function counts(pool: pg.Pool): Promise<Record<string, unknown>> {
    const result: Record<string, unknown> = {};
    for (const table of TABLES) result[table] = (await pool.query(`SELECT count(*)::int AS n FROM ${table}`)).rows[0].n;
    result['exams'] = (await pool.query(
        `SELECT string_agg(id::text || ':' || lifecycle_state || ':' || coalesce(room_based_operations_enabled::text, '-'), ',' ORDER BY id) AS s
         FROM secure_assessment_exam_instances`)).rows[0].s;
    result['pauses'] = (await pool.query(`SELECT string_agg(id::text || ':' || (resumed_at IS NULL)::text, ',' ORDER BY id) AS s FROM secure_assessment_exam_pauses`)).rows[0].s;
    result['locks'] = (await pool.query(`SELECT string_agg(id::text || ':' || (unlocked_at IS NULL)::text, ',' ORDER BY id) AS s FROM secure_assessment_attempt_locks`)).rows[0].s;
    result['revoked'] = (await pool.query(`SELECT string_agg(id::text || ':' || (revoked_at IS NULL)::text, ',' ORDER BY id) AS s FROM secure_assessment_proctor_assignments`)).rows[0].s;
    return result;
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
    setSchoolOperator(c, { tenantId, personId, action, operator: 'Synthetic CI operator', caseReference: 'ASSESS-INSTITUTION-003', reason: 'Synthetic institution controls' }));

/** Waits until some backend of this database waits on a row or advisory lock. */
async function lockWaitObserved(pool: pg.Pool, pending?: Promise<unknown>): Promise<void> {
    let settled = false;
    pending?.then(() => { settled = true; }, () => { settled = true; });
    for (let i = 0; i < 100; i++) {
        const r = await pool.query(`SELECT count(*)::int AS n FROM pg_stat_activity WHERE datname = current_database() AND wait_event_type = 'Lock'`);
        if (r.rows[0].n > 0) return;
        if (settled) throw new Error('The request finished before any lock wait was observed.');
        await sleep(100);
    }
    throw new Error('No lock wait observed.');
}

/** I-14: the request completes without waiting for a lock (a FOR UPDATE on the held exam would hang until the holder ends). */
async function withoutWaiting<T>(pending: Promise<T>, label: string): Promise<T> {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const timeout = new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error(`${label} waited for a lock`)), 5000); });
    try {
        return await Promise.race([pending, timeout]);
    } finally {
        clearTimeout(timer);
    }
}

/** Waits until the database clock has passed the current deadline of an exam. */
async function deadlinePassed(pool: pg.Pool, examId: string): Promise<void> {
    for (let i = 0; i < 200; i++) {
        const r = await pool.query(
            `SELECT max(deadline_at) <= statement_timestamp() AS passed FROM secure_assessment_institution_preparation_deadlines WHERE exam_instance_id = $1`, [examId]);
        if (r.rows[0].passed === true) return;
        await sleep(1000);
    }
    throw new Error('The deadline did not pass.');
}

/** Every key of a JSON value, recursively. */
function keysOf(value: unknown, into = new Set<string>()): Set<string> {
    if (Array.isArray(value)) value.forEach(v => keysOf(v, into));
    else if (value && typeof value === 'object') for (const [k, v] of Object.entries(value)) { into.add(k); keysOf(v, into); }
    return into;
}

const byId = <T extends { examInstanceId: string }>(rows: T[]) => [...rows].sort((a, b) => a.examInstanceId.localeCompare(b.examInstanceId));

test('ASSESS-INSTITUTION-003 C03 institution supervision and running controls end to end through production wiring', { skip: skipWithoutDatabase, timeout: 900_000 }, async t => {
    const db = await createDisposableDatabase();
    const app = await startProductionWiredServer(db.pool);
    t.after(async () => { await app.close(); await db.close(); });
    const pool = db.pool;

    // Fixture (record §5): tenant 1 (WIB) with Matematika x X (three students), Fisika x Y (two) and Biologi x Z (one), all
    // taught by T; a teacher-managed exam TM of T2; Proctors P1..P5; Operators O and O' (and one revoked later); a Homeroom
    // Teacher; actor A (membership, no role); tenant 2 with its Operator O2 and an ACTIVE institution exam.
    const tenant = await createTenant(pool, 'SMA Pelaksanaan');
    const teacher = await createPersonWithAccount(pool, 'guru.mapel');
    const teaching = await createTeachingContext(pool, tenant, await addMembership(pool, tenant, teacher.personId), 'Matematika');
    const scope = (await pool.query(
        `SELECT o.academic_period_id, o.grade_level_id, g.academic_year_id FROM academic_core_teaching_assignments a
         JOIN academic_core_subject_offerings o ON o.id = a.subject_offering_id JOIN academic_core_academic_groups g ON g.id = a.academic_group_id
         WHERE a.id = $1`, [teaching.teachingAssignmentId])).rows[0];
    const academicPeriodId: string = scope.academic_period_id;
    const group = async (label: string) => (await pool.query(
        'INSERT INTO academic_core_academic_groups (tenant_id, academic_year_id, grade_level_id, display_label) VALUES ($1, $2, $3, $4) RETURNING id',
        [tenant, scope.academic_year_id, scope.grade_level_id, label])).rows[0].id as string;
    const subjectTeaching = async (label: string, groupId: string) => {
        const subject = (await pool.query('INSERT INTO academic_core_subjects (tenant_id, display_label) VALUES ($1, $2) RETURNING id', [tenant, label])).rows[0].id;
        const offering = (await pool.query('INSERT INTO academic_core_subject_offerings (tenant_id, subject_id, academic_period_id, grade_level_id) VALUES ($1, $2, $3, $4) RETURNING id',
            [tenant, subject, academicPeriodId, scope.grade_level_id])).rows[0].id;
        return (await pool.query('INSERT INTO academic_core_teaching_assignments (tenant_id, teacher_assignment_id, subject_offering_id, academic_group_id) VALUES ($1, $2, $3, $4) RETURNING id',
            [tenant, teaching.teacherAssignmentId, offering, groupId])).rows[0].id as string;
    };
    const physicsY = await subjectTeaching('Fisika', await group('Y-1'));
    const biologyZ = await subjectTeaching('Biologi', await group('Z-1'));
    type Student = { personId: string; username: string; password: string; membershipId: string; enrollmentId: string };
    const enroll = async (username: string, teachingAssignmentId: string, tenantId = tenant): Promise<Student> => {
        const person = await createPersonWithAccount(pool, username);
        const membershipId = await addMembership(pool, tenantId, person.personId);
        const enrollmentId = await enrollInTeachingGroup(pool, tenantId, { teachingAssignmentId } as TeachingContext, membershipId);
        return { ...person, membershipId, enrollmentId };
    };
    const s1 = await enroll('siswa.mtk.1', teaching.teachingAssignmentId);
    const s2 = await enroll('siswa.mtk.2', teaching.teachingAssignmentId);
    const s3 = await enroll('siswa.mtk.3', teaching.teachingAssignmentId);
    const y1 = await enroll('siswa.fis.1', physicsY);
    const y2 = await enroll('siswa.fis.2', physicsY);
    const z1 = await enroll('siswa.bio.1', biologyZ);
    const staff = async (username: string) => {
        const person = await createPersonWithAccount(pool, username);
        return { ...person, membershipId: await addMembership(pool, tenant, person.personId) };
    };
    const p1 = await staff('pengawas.satu');
    const p2 = await staff('pengawas.dua');
    const p3 = await staff('pengawas.tiga');
    await staff('pengawas.empat');
    await staff('pengawas.lima');
    const actorA = await staff('staf.tanpa.peran');
    const operator = await staff('operator.satu');
    await operatorAssignment(pool, tenant, operator.personId, 'ASSIGN');
    const operator2 = await staff('operator.dua');
    await operatorAssignment(pool, tenant, operator2.personId, 'ASSIGN');
    const revokedOperator = await staff('operator.dicabut');
    await operatorAssignment(pool, tenant, revokedOperator.personId, 'ASSIGN');
    const homeroom = await staff('walikelas.satu');
    await pool.query(
        `INSERT INTO academic_core_homeroom_responsibilities (tenant_id, membership_id, academic_year_id, academic_period_id, academic_group_id)
         VALUES ($1, $2, $3, $4, $5)`, [tenant, homeroom.membershipId, scope.academic_year_id, academicPeriodId, teaching.academicGroupId]);
    // T2 and the teacher-managed exam TM (ACTIVE now, its own student, no rooms).
    const teacher2 = await createPersonWithAccount(pool, 'guru.mandiri');
    const teaching2 = await createTeachingContext(pool, tenant, await addMembership(pool, tenant, teacher2.personId), 'Kimia');
    const tmStudent = await createPersonWithAccount(pool, 'siswa.kimia.1');
    await addMembership(pool, tenant, tmStudent.personId);
    const TM = await createExamInstance(pool, tenant, teaching2, { lifecycleState: 'ACTIVE' });
    const tmParticipant = await addParticipant(pool, tenant, TM, tmStudent.personId);
    const tmSnapshots = await addQuestionSnapshots(pool, tenant, TM, 2);
    // Tenant 2.
    const otherTenant = await createTenant(pool, 'SMA Lain');
    const foreignOperator = await createPersonWithAccount(pool, 'operator.lain');
    const foreignTeaching = await createTeachingContext(pool, otherTenant, await addMembership(pool, otherTenant, foreignOperator.personId), 'Matematika');
    await operatorAssignment(pool, otherTenant, foreignOperator.personId, 'ASSIGN');
    const foreignStudent = await enroll('siswa.lain', foreignTeaching.teachingAssignmentId, otherTenant);
    const foreignAcademicPeriod = (await pool.query('SELECT o.academic_period_id FROM academic_core_teaching_assignments a JOIN academic_core_subject_offerings o ON o.id = a.subject_offering_id WHERE a.id = $1',
        [foreignTeaching.teachingAssignmentId])).rows[0].academic_period_id as string;

    const login = async (person: { username: string; password: string }, tenantId: string | null = tenant) => {
        const c = new BrowserLikeClient(app.baseUrl);
        assert.equal((await c.login(person.username, person.password)).status, 200, person.username);
        c.tenantId = tenantId;
        return c;
    };
    const o = await login(operator);
    const o2 = await login(operator2);
    const oRevoked = await login(revokedOperator);
    const tc = await login(teacher);
    const t2c = await login(teacher2);
    const p1c = await login(p1);
    const p2c = await login(p2);
    const p3c = await login(p3);
    const hc = await login(homeroom);
    const ac = await login(actorA);
    const s1c = await login(s1);
    const s2c = await login(s2);
    const s3c = await login(s3);
    const y2c = await login(y2);
    const tmc = await login(tmStudent);
    const foreignInOurs = await login(foreignOperator);
    const foreign = await login(foreignOperator, otherTenant);
    const anonymous = new BrowserLikeClient(app.baseUrl);
    anonymous.tenantId = tenant;

    const receipts: unknown[] = [];
    const keep = (r: ClientResponse) => { receipts.push(r.body); return r; };
    const ok = (r: ClientResponse, status = 200) => { assert.equal(r.status, status, JSON.stringify(r.body)); return r.body as Body; };
    const unchanged = async (run: () => Promise<void>) => {
        const before = await counts(pool);
        await run();
        assert.deepEqual(await counts(pool), before, 'nothing was written');
    };
    const createPeriod = async (c: BrowserLikeClient, label: string, typeId = teaching.assessmentTypeId, periodId = academicPeriodId) =>
        ok(await post(c, `${P}/periods`, { label, assessmentTypeId: typeId, academicPeriodId: periodId, actionKey: randomUUID() }), 201).periodId as string;
    const createSession = async (c: BrowserLikeClient, periodId: string, date: string) =>
        ok(await post(c, `${P}/sessions`, { periodId, date, startTime: '08:00', endTime: '10:00', actionKey: randomUUID() }), 201).sessionId as string;
    const placeExam = async (c: BrowserLikeClient, sessionId: string, teachingAssignmentId: string, preparationDeadline: string) =>
        ok(await post(c, `${P}/placements`, {
            sessionId, teachingAssignmentId, durationMinutes: 45, latestStartPolicy: 'FULL_DURATION_BEYOND_WINDOW', preparationDeadline, actionKey: randomUUID(),
        }), 201).examInstanceId as string;
    const rev = async (sessionId: string) => (await pool.query(
        'SELECT coalesce(max(revision), 0)::int AS n FROM secure_assessment_institution_room_actions WHERE session_id = $1', [sessionId])).rows[0].n as number;
    const place = async (sessionId: string, roomLabel: string, participantIds: string[]) =>
        post(o, `${R}/participants`, { sessionId, roomLabel, participantIds, expectedRevision: await rev(sessionId), actionKey: randomUUID() });
    const proctors = async (sessionId: string, roomLabel: string, proctorElligbleIds: string[]) =>
        post(o, `${R}/proctors`, { sessionId, roomLabel, proctorElligbleIds, expectedRevision: await rev(sessionId), actionKey: randomUUID() });
    const markReady = (examInstanceId: string) => post(o, `${P}/transition`, { examInstanceId, action: 'mark_ready' });
    const pid = async (examId: string, personId: string) => (await pool.query(
        'SELECT id FROM secure_assessment_exam_participants WHERE exam_instance_id = $1 AND person_id = $2', [examId, personId])).rows[0].id as string;
    const stateOf = async (examId: string) => (await pool.query('SELECT lifecycle_state FROM secure_assessment_exam_instances WHERE id = $1', [examId])).rows[0].lifecycle_state as string;
    const roomId = async (examId: string, label: string) => (await pool.query(
        'SELECT id FROM secure_assessment_exam_rooms WHERE exam_instance_id = $1 AND display_label = $2', [examId, label])).rows[0].id as string;

    // The Operator routes, each with a fresh action key unless one is given.
    const intent = (reason: string) => ({ reason, confirmed: true, actionKey: randomUUID() });
    const transition = async (c: BrowserLikeClient, target: Body, action: string, extra: Body = {}) =>
        keep(await post(c, `${SV}/transition`, { ...target, action, ...intent('Pelaksanaan ujian sekolah'), ...extra }));
    const lockCtl = async (c: BrowserLikeClient, examInstanceId: string, participantId: string, action: string, extra: Body = {}) =>
        keep(await post(c, `${SV}/participant-lock`, { examInstanceId, participantId, action, ...intent('Perangkat peserta bermasalah'), ...extra }));
    const timeCtl = async (c: BrowserLikeClient, examInstanceId: string, participantId: string, minutes: number, extra: Body = {}) =>
        keep(await post(c, `${SV}/add-time`, { examInstanceId, participantId, minutes, ...intent('Listrik padam di ruang ujian'), ...extra }));
    const messageCtl = async (c: BrowserLikeClient, examInstanceId: string, target: Body, extra: Body = {}) =>
        keep(await post(c, `${SV}/broadcast`, { examInstanceId, target, message: 'Harap tetap tenang.', ...intent('Pengumuman ruang ujian'), ...extra }));
    const sessionRead = async (c: BrowserLikeClient, sessionId: string) => keep(await c.request(`${SV}?sessionId=${sessionId}`));
    const examRead = async (c: BrowserLikeClient, examId: string) => keep(await c.request(`${SV}/exam?examInstanceId=${examId}`));
    const monitoring = (c: BrowserLikeClient, examId: string) => c.request(`${MON}?examInstanceId=${examId}`);
    const controlRows = async (actionKey: string) => {
        const action = (await pool.query('SELECT * FROM secure_assessment_institution_control_actions WHERE action_key = $1', [actionKey])).rows[0];
        const entries = action ? (await pool.query('SELECT * FROM secure_assessment_institution_control_entries WHERE action_id = $1 ORDER BY exam_instance_id', [action.id])).rows : [];
        return { action, entries };
    };

    // A student's attempt on an open exam: start, an exam session and the timer, as the client does.
    const startStudent = async (client: BrowserLikeClient, examId: string) => {
        const started = await client.request('/api/v1/assessment/attempts/start', { method: 'POST', body: { examInstanceId: examId } });
        assert.equal(started.status, 201, JSON.stringify(started.body));
        const attemptId: string = started.body.attemptId;
        const sessionId = randomUUID();
        assert.equal((await client.request('/api/v1/assessment/session/activate', { method: 'POST', body: { attemptId, sessionId } })).status, 200);
        assert.equal((await client.request('/api/v1/assessment/timer/start', { method: 'POST', body: { attemptId } })).status, 200);
        return {
            attemptId,
            save: (snapshotId: string, option: string, expectedWriteVersion: number | null = null) => client.request('/api/v1/assessment/answer/save', {
                method: 'POST',
                body: { attemptId, sessionId, snapshotId, answerPayload: { selectedOptionId: option }, clientWriteIdentity: randomUUID(), expectedWriteVersion },
            }),
            timer: async () => (await client.request(`/api/v1/assessment/timer?attemptId=${attemptId}`)).body as Body,
            submit: () => client.request('/api/v1/assessment/submit', { method: 'POST', body: { attemptId } }),
        };
    };

    // Sessions on distinct days (no participant or Proctor overlap): S1 (D+3) with E1 Matematika x X and E2 Fisika x Y,
    // S2 (D+4, another period) with E3 Biologi x Z, S3 (D+5, a third period) with E5 Biologi x Z. Deadlines about two
    // minutes ahead, questions stored before them; tenant 2's exam placed through its own Operator.
    const period1 = await createPeriod(o, 'PTS Pelaksanaan');
    const period2 = await createPeriod(o, 'PAS Pelaksanaan');
    const period3 = await createPeriod(o, 'PAT Pelaksanaan');
    const S1 = await createSession(o, period1, wibDay(3));
    const S2 = await createSession(o, period2, wibDay(4));
    const S3 = await createSession(o, period3, wibDay(5));
    const shortDeadline = wib(2);
    const E1 = await placeExam(o, S1, teaching.teachingAssignmentId, shortDeadline);
    const E2 = await placeExam(o, S1, physicsY, shortDeadline);
    const E3 = await placeExam(o, S2, biologyZ, shortDeadline);
    const E5 = await placeExam(o, S3, biologyZ, shortDeadline);
    const e1Snapshots = await addQuestionSnapshots(pool, tenant, E1, 2);
    for (const exam of [E2, E3, E5]) await addQuestionSnapshots(pool, tenant, exam, 2);
    const foreignPeriod = await createPeriod(foreign, 'PTS Lain', foreignTeaching.assessmentTypeId, foreignAcademicPeriod);
    const foreignSession = await createSession(foreign, foreignPeriod, wibDay(3));
    const foreignExam = await placeExam(foreign, foreignSession, foreignTeaching.teachingAssignmentId, `${wibDay(1)}T20:00`);
    const foreignParticipant = await pid(foreignExam, foreignStudent.personId);
    const foreignRoom = (await pool.query('INSERT INTO secure_assessment_exam_rooms (tenant_id, exam_instance_id, display_label) VALUES ($1, $2, $3) RETURNING id',
        [otherTenant, foreignExam, 'Ruang Lain'])).rows[0].id as string;
    await pool.query(`UPDATE secure_assessment_exam_instances SET lifecycle_state = 'ACTIVE' WHERE id = $1`, [foreignExam]);
    const E1s1 = await pid(E1, s1.personId), E1s2 = await pid(E1, s2.personId), E1s3 = await pid(E1, s3.personId);
    const E2y1 = await pid(E2, y1.personId), E2y2 = await pid(E2, y2.personId);
    const E3z1 = await pid(E3, z1.personId), E5z1 = await pid(E5, z1.personId);

    // Rooms and Proctors through the product: S1 "Ruang 1" {P1, P3} with s1..s3 and y1, "Ruang 2" {P2} with y2; S2 and S3 "Ruang 9" {P4}.
    ok(await place(S1, 'Ruang 1', [E1s1, E1s2, E1s3, E2y1]));
    ok(await place(S1, 'Ruang 2', [E2y2]));
    ok(await proctors(S1, 'Ruang 1', ['pengawas.satu', 'pengawas.tiga']));
    ok(await proctors(S1, 'Ruang 2', ['pengawas.dua']));
    ok(await place(S2, 'Ruang 9', [E3z1]));
    ok(await proctors(S2, 'Ruang 9', ['pengawas.empat']));
    ok(await place(S3, 'Ruang 9', [E5z1]));
    ok(await proctors(S3, 'Ruang 9', ['pengawas.empat']));
    for (const exam of [E1, E2, E3, E5]) await deadlinePassed(pool, exam);
    for (const exam of [E1, E3, E5]) assert.deepEqual(ok(await markReady(exam)), { examInstanceId: exam, lifecycleState: 'READY' });
    // E16: the windows of S1 and S3 open now (the session rows stay append-only and keep their slot).
    await pool.query(
        `UPDATE secure_assessment_exam_instances SET window_starts_at = statement_timestamp() - interval '10 minutes', window_ends_at = statement_timestamp() + interval '3 hours'
         WHERE id = ANY($1::uuid[])`, [[E1, E2, E5]]);

    await t.test('I-1 the drill-down lists the session exams, rooms, counts and Proctor ELLIGBLE IDs; another school and a nonexistent session get one 403', async () => {
        const view = ok(await sessionRead(o, S1));
        assert.deepEqual(view.session, {
            sessionId: S1, periodLabel: 'PTS Pelaksanaan',
            startsAt: new Date(`${wibDay(3)}T08:00:00+07:00`).toISOString(), endsAt: new Date(`${wibDay(3)}T10:00:00+07:00`).toISOString(),
        });
        assert.ok(Number.isFinite(Date.parse(view.serverTime)));
        assert.deepEqual(view.exams.map((e: Body) => e.examInstanceId), [E2, E1], 'ordered by subject then rombel');
        const zero = { participants: 0, notStarted: 0, active: 0, submitted: 0, locked: 0 };
        const e1 = view.exams[1];
        assert.deepEqual([e1.subjectLabel, e1.groupLabel, e1.lifecycleState, e1.pausedAt, e1.roomPolicy], ['Matematika', 'X-1', 'READY', null, true]);
        assert.deepEqual(e1.counts, { ...zero, participants: 3, notStarted: 3 });
        assert.deepEqual(e1.rooms, [{ label: 'Ruang 1', counts: { ...zero, participants: 3, notStarted: 3 }, proctors: [{ elligbleId: 'pengawas.satu' }, { elligbleId: 'pengawas.tiga' }] }]);
        assert.deepEqual([e1.readiness.baseline.status, e1.readiness.roomProctor.status], ['baseline_readiness_checks_pass', 'room_proctor_readiness_ready']);
        const e2 = view.exams[0];
        assert.deepEqual([e2.subjectLabel, e2.groupLabel, e2.lifecycleState, e2.readiness], ['Fisika', 'Y-1', 'SCHEDULED', null], 'readiness only for READY exams (E5)');
        assert.deepEqual(e2.rooms.map((r: Body) => [r.label, r.counts.participants, r.proctors.map((p: Body) => p.elligbleId)]),
            [['Ruang 1', 1, ['pengawas.satu', 'pengawas.tiga']], ['Ruang 2', 1, ['pengawas.dua']]]);
        assert.equal(JSON.stringify(view).includes(TM), false, 'a teacher-managed exam is never in a session');
        const listed = ok(await examRead(o, E1));
        assert.deepEqual([listed.scope, listed.canAddTime, listed.exam.lifecycleState, listed.participants.length], ['OPERATOR', true, 'READY', 3]);
        assert.deepEqual(listed.participants.map((p: Body) => [p.elligbleId, p.roomLabel, p.status]),
            [['siswa.mtk.1', 'Ruang 1', 'NOT_STARTED'], ['siswa.mtk.2', 'Ruang 1', 'NOT_STARTED'], ['siswa.mtk.3', 'Ruang 1', 'NOT_STARTED']]);
        await unchanged(async () => {
            const refused = await foreign.request(`${SV}?sessionId=${S1}`);
            assert.deepEqual([refused.status, refused.body], [403, { error: 'forbidden' }], 'O2 in its own school');
            const foreignOne = await o.request(`${SV}?sessionId=${foreignSession}`);
            const unknownOne = await o.request(`${SV}?sessionId=${randomUUID()}`);
            assert.deepEqual([foreignOne.status, foreignOne.body], [403, { error: 'forbidden' }]);
            assert.equal(JSON.stringify(foreignOne.body), JSON.stringify(unknownOne.body), 'N02 byte-identical');
            for (const exam of [foreignExam, TM, randomUUID()]) {
                const r = await o.request(`${SV}/exam?examInstanceId=${exam}`);
                assert.deepEqual([r.status, r.body], [403, { error: 'forbidden' }], exam);
            }
        });
    });

    await t.test('I-2 the E7 order refuses with nothing written: window, the D04.2-68 re-check, room flags, room flags before the window', async () => {
        await unchanged(async () => {
            const early = await transition(o, { examInstanceId: E3 }, 'activate');
            const startsAt = new Date(`${wibDay(4)}T08:00:00+07:00`).toISOString();
            assert.deepEqual([early.status, early.body], [409, { error: 'window_not_started', windowStartsAt: startsAt }]);
            // The final re-check: E1's Proctor assignments revoked by fixture SQL (no RP-3 demotion), then restored.
            const revoked = (await pool.query(
                `UPDATE secure_assessment_proctor_assignments SET revoked_at = statement_timestamp() WHERE exam_instance_id = $1 AND revoked_at IS NULL RETURNING id`, [E1])).rows.map(r => r.id);
            assert.equal(revoked.length, 2);
            try {
                const notReady = await transition(o, { examInstanceId: E1 }, 'activate');
                assert.deepEqual([notReady.status, notReady.body.error, notReady.body.readiness.baseline.status, notReady.body.readiness.roomProctor.status],
                    [409, 'not_ready', 'baseline_readiness_checks_pass', 'not_ready'], JSON.stringify(notReady.body));
                assert.equal(typeof notReady.body.readiness.roomProctor.blocker, 'string');
            } finally {
                await pool.query('UPDATE secure_assessment_proctor_assignments SET revoked_at = NULL WHERE id = ANY($1::uuid[])', [revoked]);
            }
            // A READY exam that is not TRUE/TRUE (a pre-0063 exam, ASSESS-INSTITUTION-002 R6), now and before its window.
            for (const exam of [E1, E3]) {
                await pool.query('UPDATE secure_assessment_exam_instances SET room_based_operations_enabled = FALSE, proctor_per_room_required = FALSE WHERE id = $1', [exam]);
                try {
                    const r = await transition(o, { examInstanceId: exam }, 'activate');
                    assert.deepEqual([r.status, r.body], [409, { error: 'room_setup_required' }], exam === E3 ? 'room flags before the window' : 'room flags');
                } finally {
                    await pool.query('UPDATE secure_assessment_exam_instances SET room_based_operations_enabled = TRUE, proctor_per_room_required = TRUE WHERE id = $1', [exam]);
                }
            }
        });
        assert.deepEqual([await stateOf(E1), await stateOf(E3)], ['READY', 'READY']);
    });

    await t.test('I-11 (before opening) P3 leaves "Ruang 1" through the room route while E1 is READY; P1 still covers it', async () => {
        const body = ok(await proctors(S1, 'Ruang 1', ['pengawas.satu']));
        assert.deepEqual([body.changed, body.demoted], [true, []]);
        assert.equal(await stateOf(E1), 'READY');
        assert.equal((await monitoring(p3c, E1)).status, 403, 'P3 has no assignment any more');
    });

    let shortcutKey = '';
    let shortcutBody: Body = {};
    await t.test('I-3 the session shortcut opens E1 and skips the SCHEDULED E2 with one reason; an all-skipped shortcut writes nothing', async () => {
        shortcutKey = randomUUID();
        shortcutBody = { sessionId: S1, action: 'activate', reason: 'Sesi pertama dimulai', confirmed: true, actionKey: shortcutKey };
        const opened = ok(keep(await post(o, `${SV}/transition`, shortcutBody)));
        assert.deepEqual(opened, {
            sessionId: S1, action: 'activate', replayed: false,
            results: byId([
                { examInstanceId: E1, outcome: 'APPLIED', previousState: 'READY', resultingState: 'ACTIVE' },
                { examInstanceId: E2, outcome: 'SKIPPED', previousState: 'SCHEDULED', resultingState: 'SCHEDULED', skip: { code: 'invalid_state', currentState: 'SCHEDULED' } },
            ]),
        });
        assert.deepEqual([await stateOf(E1), await stateOf(E2)], ['ACTIVE', 'SCHEDULED']);
        const { action, entries } = await controlRows(shortcutKey);
        assert.deepEqual([action.tenant_id, action.session_id, action.exam_instance_id, action.participant_id, action.kind, action.action, action.reason, action.confirmed, action.actor_person_id],
            [tenant, S1, null, null, 'TRANSITION', 'activate', 'Sesi pertama dimulai', true, operator.personId]);
        assert.match(action.request_digest, /^[0-9a-f]{64}$/);
        assert.deepEqual(entries.map(e => [e.exam_instance_id, e.outcome, e.previous_state, e.resulting_state, e.skip_code]),
            byId([{ examInstanceId: E1, row: [E1, 'APPLIED', 'READY', 'ACTIVE', null] }, { examInstanceId: E2, row: [E2, 'SKIPPED', 'SCHEDULED', 'SCHEDULED', 'invalid_state'] }]).map(x => x.row));
        const events = (await pool.query(`SELECT actor_person_id FROM secure_assessment_exam_lifecycle_events WHERE exam_instance_id = $1 AND from_state = 'READY' AND to_state = 'ACTIVE'`, [E1])).rows;
        assert.deepEqual(events, [{ actor_person_id: operator.personId }]);
        await unchanged(async () => {
            const nothing = await transition(o, { sessionId: S1 }, 'activate');
            assert.deepEqual([nothing.status, nothing.body], [409, {
                error: 'nothing_applicable',
                results: byId([
                    { examInstanceId: E1, outcome: 'SKIPPED', previousState: 'ACTIVE', resultingState: 'ACTIVE', skip: { code: 'invalid_state', currentState: 'ACTIVE' } },
                    { examInstanceId: E2, outcome: 'SKIPPED', previousState: 'SCHEDULED', resultingState: 'SCHEDULED', skip: { code: 'invalid_state', currentState: 'SCHEDULED' } },
                ]),
            }]);
        });
    });

    await t.test('I-11 after opening: the removed P3 gets 403 per request while P1 keeps "Ruang 1"; a second "Buka Ujian" is invalid_state', async () => {
        assert.deepEqual([(await monitoring(p3c, E1)).status, (await monitoring(p3c, E1)).body], [403, { error: 'forbidden' }]);
        const p1View = ok(await monitoring(p1c, E1));
        assert.equal(p1View.scope, 'PROCTOR');
        assert.deepEqual(p1View.participants.map((p: Body) => p.roomLabel), ['Ruang 1', 'Ruang 1', 'Ruang 1']);
        await unchanged(async () => {
            const again = await transition(o, { examInstanceId: E1 }, 'activate');
            assert.deepEqual([again.status, again.body], [409, { error: 'invalid_state', examInstanceId: E1, currentState: 'ACTIVE' }]);
        });
    });

    await t.test('I-2 O opens E5 alone: ACTIVE, the lifecycle event by O, one action row and one APPLIED entry', async () => {
        const key = randomUUID();
        const opened = ok(await transition(o, { examInstanceId: E5 }, 'activate', { actionKey: key, reason: 'Ujian susulan dibuka' }));
        assert.deepEqual(opened, { examInstanceId: E5, lifecycleState: 'ACTIVE', changed: true, replayed: false });
        const { action, entries } = await controlRows(key);
        assert.deepEqual([action.session_id, action.exam_instance_id, action.kind, action.action, action.reason, action.actor_person_id],
            [S3, E5, 'TRANSITION', 'activate', 'Ujian susulan dibuka', operator.personId]);
        assert.deepEqual(entries.map(e => [e.exam_instance_id, e.participant_id, e.attempt_id, e.outcome, e.previous_state, e.resulting_state, e.skip_code]),
            [[E5, null, null, 'APPLIED', 'READY', 'ACTIVE', null]]);
        const events = (await pool.query(`SELECT actor_person_id FROM secure_assessment_exam_lifecycle_events WHERE exam_instance_id = $1 AND to_state = 'ACTIVE'`, [E5])).rows;
        assert.deepEqual(events, [{ actor_person_id: operator.personId }]);
    });

    // s1 and s2 work on E1; s3 has not started.
    const a1 = await startStudent(s1c, E1);
    const a2 = await startStudent(s2c, E1);
    const remainingNow = async (attemptId: string) => Number((await pool.query(
        'SELECT secure_assessment_attempt_remaining_seconds($1, $2, statement_timestamp()) AS r', [tenant, attemptId])).rows[0].r);

    await t.test('I-5 O locks s1 with a reason: the 0046 row by O, writes refused, time running; unlock restores; no reason is 400', async () => {
        const key = randomUUID();
        const locked = ok(await lockCtl(o, E1, E1s1, 'lock', { actionKey: key }));
        assert.deepEqual({ ...locked, lockedAt: typeof locked.lockedAt }, { participantId: E1s1, locked: true, changed: true, lockedAt: 'string', replayed: false });
        const row = (await pool.query('SELECT locked_at, locked_by_person_id FROM secure_assessment_attempt_locks WHERE exam_attempt_id = $1 AND unlocked_at IS NULL', [a1.attemptId])).rows;
        assert.deepEqual([row.length, row[0].locked_by_person_id, row[0].locked_at.toISOString()], [1, operator.personId, locked.lockedAt]);
        const { action, entries } = await controlRows(key);
        assert.deepEqual([action.session_id, action.exam_instance_id, action.participant_id, action.kind, action.action, action.reason],
            [S1, E1, E1s1, 'PARTICIPANT_LOCK', 'lock', 'Perangkat peserta bermasalah']);
        assert.deepEqual(entries.map(e => [e.exam_instance_id, e.participant_id, e.attempt_id, e.outcome, e.previous_state, e.resulting_state]),
            [[E1, E1s1, a1.attemptId, 'APPLIED', 'UNLOCKED', 'LOCKED']]);
        const refused = await a1.save(e1Snapshots[0], 'A');
        assert.deepEqual([refused.status, refused.body.error], [409, 'attempt_locked']);
        const before = await remainingNow(a1.attemptId);
        await sleep(1100);
        assert.ok(await remainingNow(a1.attemptId) < before, 'the lock does not stop the time (D04.6-40)');
        const again = ok(await lockCtl(o, E1, E1s1, 'lock'));
        assert.deepEqual([again.locked, again.changed, again.lockedAt], [true, false, locked.lockedAt]);
        await unchanged(async () => {
            for (const extra of [{ reason: '   ' }, { confirmed: false }, { confirmed: 'true' }]) {
                assert.deepEqual((await lockCtl(o, E1, E1s1, 'unlock', extra)).body, { error: 'invalid_request' }, JSON.stringify(extra));
            }
            const { reason: _r, ...noReason } = { examInstanceId: E1, participantId: E1s1, action: 'unlock', ...intent('x') };
            assert.deepEqual((await post(o, `${SV}/participant-lock`, noReason)).body, { error: 'invalid_request' });
        });
        const unlocked = ok(await lockCtl(o, E1, E1s1, 'unlock'));
        assert.deepEqual(unlocked, { participantId: E1s1, locked: false, changed: true, lockedAt: null, replayed: false });
        assert.equal((await pool.query('SELECT unlocked_by_person_id FROM secure_assessment_attempt_locks WHERE exam_attempt_id = $1', [a1.attemptId])).rows[0].unlocked_by_person_id, operator.personId);
        assert.equal((await a1.save(e1Snapshots[0], 'A')).status, 200);
    });

    let operatorTimeKey = '';
    await t.test('I-6 O adds 10 minutes to s1: the 0050 row by O; P1 sees the total; O its reason; O\' the addition without it; bounds and time_up', async () => {
        const before = (await a1.timer()).effectiveRemainingSeconds as number;
        operatorTimeKey = randomUUID();
        const added = ok(await timeCtl(o, E1, E1s1, 10, { actionKey: operatorTimeKey }));
        assert.deepEqual([added.participantId, added.addedSeconds, added.totalAddedSeconds, added.replayed], [E1s1, 600, 600, false]);
        assert.ok(added.remainingSeconds >= before + 590, JSON.stringify(added));
        const ledger = (await pool.query(
            `SELECT adj.adjustment_seconds, adj.reason, adj.actor_person_id, adj.action_key FROM secure_assessment_timer_adjustments adj
             JOIN secure_assessment_timer_state t ON t.id = adj.timer_state_id WHERE t.exam_attempt_id = $1`, [a1.attemptId])).rows;
        assert.deepEqual(ledger, [{ adjustment_seconds: 600, reason: 'Listrik padam di ruang ujian', actor_person_id: operator.personId, action_key: operatorTimeKey }]);
        const { action, entries } = await controlRows(operatorTimeKey);
        assert.deepEqual([action.kind, action.action, action.participant_id], ['TIME_ADD', 'add_time', E1s1]);
        assert.deepEqual(entries.map(e => [e.participant_id, e.attempt_id, e.outcome, e.previous_state, e.resulting_state]), [[E1s1, a1.attemptId, 'APPLIED', null, null]]);
        assert.ok((await a1.timer()).effectiveRemainingSeconds >= before + 590, 'the student timer follows at once');
        const proctorView = ok(await monitoring(p1c, E1)).participants.find((p: Body) => p.participantId === E1s1);
        assert.deepEqual([proctorView.addedSeconds, proctorView.timeAdditions], [600, undefined]);
        const own = ok(await examRead(o, E1)).participants.find((p: Body) => p.participantId === E1s1);
        assert.deepEqual(own.timeAdditions.map((a: Body) => [a.seconds, a.reason, a.by]), [[600, 'Listrik padam di ruang ujian', { elligbleId: 'operator.satu', you: true }]]);
        const otherView = ok(await examRead(o2, E1));
        const other = otherView.participants.find((p: Body) => p.participantId === E1s1);
        assert.deepEqual(other.timeAdditions, [{ addedAt: added.addedAt, seconds: 600, by: { elligbleId: 'operator.satu', you: false } }]);
        assert.equal(JSON.stringify(otherView).includes('Listrik padam di ruang ujian'), false, "another actor's reason never leaves the server");
        await unchanged(async () => {
            assert.deepEqual((await timeCtl(o, E1, E1s1, 121)).body, { error: 'invalid_request' });
            assert.deepEqual((await timeCtl(o, E1, E1s1, 0)).body, { error: 'invalid_request' });
        });
        await pool.query(
            `UPDATE secure_assessment_timer_state SET started_at = statement_timestamp() - make_interval(secs => configured_duration_seconds + 5) WHERE exam_attempt_id = $1`, [a2.attemptId]);
        await unchanged(async () => {
            const late = await timeCtl(o, E1, E1s2, 5);
            assert.deepEqual([late.status, late.body], [409, { error: 'time_up' }]);
            const notStarted = await timeCtl(o, E1, E1s3, 5);
            assert.deepEqual([notStarted.status, notStarted.body], [409, { error: 'no_active_attempt' }]);
        });
    });

    await t.test('I-14 with E1 held FOR KEY SHARE (as an answer save): room writes and the activate shortcut never wait; a pause shortcut does', async () => {
        const holder = await pool.connect();
        let held = true;
        try {
            await holder.query('BEGIN');
            await holder.query('SELECT id FROM secure_assessment_exam_instances WHERE id = $1 FOR KEY SHARE', [E1]);
            // A room write affecting only E2 succeeds; one affecting E1 is invalid_state with nothing written.
            const onlyE2 = await withoutWaiting(proctors(S1, 'Ruang 2', ['pengawas.dua', 'pengawas.lima']), 'a room write of E2');
            assert.equal(onlyE2.status, 200, JSON.stringify(onlyE2.body));
            await unchanged(async () => {
                const touchesE1 = await withoutWaiting(place(S1, 'Ruang 7', [E1s1]), 'a room write affecting E1');
                assert.deepEqual([touchesE1.status, touchesE1.body], [409, { error: 'invalid_state', examInstanceId: E1, currentState: 'ACTIVE' }]);
            });
            assert.deepEqual(ok(await withoutWaiting(markReady(E2), 'mark ready of E2')), { examInstanceId: E2, lifecycleState: 'READY' });
            const opened = ok(await withoutWaiting(transition(o, { sessionId: S1 }, 'activate'), 'the activate shortcut'));
            assert.deepEqual(opened.results, byId([
                { examInstanceId: E1, outcome: 'SKIPPED', previousState: 'ACTIVE', resultingState: 'ACTIVE', skip: { code: 'invalid_state', currentState: 'ACTIVE' } },
                { examInstanceId: E2, outcome: 'APPLIED', previousState: 'READY', resultingState: 'ACTIVE' },
            ]));
            // The pause shortcut takes E1 FOR UPDATE, as the Teacher's pause does, and waits for the holder.
            const pausing = transition(o, { sessionId: S1 }, 'pause');
            await lockWaitObserved(pool, pausing);
            await holder.query('COMMIT');
            held = false;
            const paused = ok(await pausing);
            assert.deepEqual(paused.results, byId([
                { examInstanceId: E1, outcome: 'APPLIED', previousState: 'ACTIVE', resultingState: 'PAUSED' },
                { examInstanceId: E2, outcome: 'APPLIED', previousState: 'ACTIVE', resultingState: 'PAUSED' },
            ]));
        } finally {
            if (held) await holder.query('ROLLBACK').catch(() => {});
            holder.release();
        }
        const resumed = ok(await transition(o, { sessionId: S1 }, 'resume'));
        assert.deepEqual(resumed.results.map((r: Body) => r.outcome), ['APPLIED', 'APPLIED']);
        assert.deepEqual([await stateOf(E1), await stateOf(E2)], ['ACTIVE', 'ACTIVE']);
        const pauses = (await pool.query('SELECT paused_by_person_id, resumed_by_person_id FROM secure_assessment_exam_pauses WHERE exam_instance_id = ANY($1::uuid[])', [[E1, E2]])).rows;
        assert.deepEqual(pauses, [{ paused_by_person_id: operator.personId, resumed_by_person_id: operator.personId }, { paused_by_person_id: operator.personId, resumed_by_person_id: operator.personId }]);
    });

    let a3!: Awaited<ReturnType<typeof startStudent>>;
    await t.test('I-9 the Proctor is unchanged: P2 watches only "Ruang 2" of E2, locks with a reason and messages there; never the Operator controls', async () => {
        a3 = await startStudent(y2c, E2);
        const view = ok(await monitoring(p2c, E2));
        assert.deepEqual([view.scope, view.canAddTime, view.participants.map((p: Body) => [p.elligbleId, p.roomLabel])],
            ['PROCTOR', false, [['siswa.fis.2', 'Ruang 2']]]);
        const lock = await post(p2c, `${MON}/participant-lock`, { examInstanceId: E2, participantId: E2y2, action: 'lock', ...intent('Peserta meninggalkan ruang') });
        assert.equal(lock.status, 200, JSON.stringify(lock.body));
        assert.equal((await pool.query('SELECT authority_kind FROM secure_assessment_permission_action_events WHERE id = $1', [lock.body.audit.id])).rows[0].authority_kind, 'PROCTOR');
        assert.equal((await post(p2c, `${MON}/participant-lock`, { examInstanceId: E2, participantId: E2y2, action: 'unlock', ...intent('Peserta kembali') })).status, 200);
        const room = await post(p2c, `${MON}/broadcast`, { examInstanceId: E2, target: { scope: 'ROOM', roomId: await roomId(E2, 'Ruang 2') }, message: 'Harap kembali ke tempat duduk.' });
        assert.equal(room.status, 200, JSON.stringify(room.body));
        await unchanged(async () => {
            assert.deepEqual((await post(p2c, `${MON}/broadcast`, { examInstanceId: E2, target: { scope: 'EXAM' }, message: 'Semua peserta.' })).body, { error: 'forbidden' });
            assert.deepEqual((await post(p2c, `${MON}/add-time`, { examInstanceId: E2, participantId: E2y2, minutes: 5, ...intent('Tidak boleh') })).status, 403);
            assert.deepEqual((await post(p2c, `${TE}/transition`, { examInstanceId: E2, action: 'pause', ...intent('Tidak boleh') })).status, 403);
            for (const r of [await sessionRead(p2c, S1), await examRead(p2c, E2), await transition(p2c, { examInstanceId: E2 }, 'pause'), await transition(p2c, { sessionId: S1 }, 'pause'),
                await lockCtl(p2c, E2, E2y2, 'lock'), await timeCtl(p2c, E2, E2y2, 5), await messageCtl(p2c, E2, { scope: 'EXAM' })]) {
                assert.deepEqual([r.status, r.body], [403, { error: 'forbidden' }]);
            }
        });
    });

    await t.test('I-7 messages to E2, to its "Ruang 2" and to one participant: recipients fixed at send, the 0047 sender, one action row each; a foreign room is 403; the rate limit 429', async () => {
        const key = randomUUID();
        const toExam = ok(await messageCtl(o, E2, { scope: 'EXAM' }, { actionKey: key }));
        assert.deepEqual([toExam.recipients, toExam.replayed], [2, false]);
        const stored = (await pool.query('SELECT sender_person_id, target_scope, message FROM secure_assessment_exam_broadcasts WHERE id = $1', [toExam.broadcastId])).rows;
        assert.deepEqual(stored, [{ sender_person_id: operator.personId, target_scope: 'EXAM', message: 'Harap tetap tenang.' }]);
        assert.equal((await pool.query('SELECT count(*)::int AS n FROM secure_assessment_exam_broadcast_recipients WHERE broadcast_id = $1', [toExam.broadcastId])).rows[0].n, 2);
        const { action, entries } = await controlRows(key);
        assert.deepEqual([action.kind, action.action, action.exam_instance_id, action.participant_id, action.reason], ['BROADCAST', 'message', E2, null, 'Pengumuman ruang ujian']);
        assert.deepEqual(entries.map(e => [e.exam_instance_id, e.broadcast_id, e.participant_id, e.outcome, e.previous_state]), [[E2, toExam.broadcastId, null, 'APPLIED', null]]);
        const toRoom = ok(await messageCtl(o2, E2, { scope: 'ROOM', roomId: await roomId(E2, 'Ruang 2') }));
        assert.equal(toRoom.recipients, 1);
        const toOne = ok(await messageCtl(o, E1, { scope: 'PARTICIPANTS', participantIds: [E1s1] }));
        assert.equal(toOne.recipients, 1);
        await unchanged(async () => {
            const wrongRoom = await messageCtl(o2, E2, { scope: 'ROOM', roomId: await roomId(E1, 'Ruang 1') });
            assert.deepEqual([wrongRoom.status, wrongRoom.body], [403, { error: 'forbidden' }], 'a room id of E1 sent with E2');
            const wrongParticipant = await messageCtl(o2, E2, { scope: 'PARTICIPANTS', participantIds: [E1s1] });
            assert.deepEqual([wrongParticipant.status, wrongParticipant.body], [403, { error: 'forbidden' }]);
            const limited = await messageCtl(o, E2, { scope: 'EXAM' });
            assert.deepEqual([limited.status, limited.body.error], [429, 'rate_limited']);
            assert.ok(limited.body.retryAfterSeconds >= 1);
            assert.equal(limited.headers.get('retry-after'), String(limited.body.retryAfterSeconds));
        });
        const history = ok(await examRead(o, E2)).broadcasts as Body[];
        assert.ok(history.some(b => b.broadcastId === toExam.broadcastId && b.sender.you === true));
    });

    const readinessOf = async (examId: string) => (ok(await tc.request('/api/v1/assessment/teacher-readiness')).exams as Body[]).find(e => e.examInstanceId === examId)!;

    await t.test('I-8 the subject Teacher of a running institution exam (D04.4-26D): no supervision, no live progress; as an assigned Proctor only the room scope', async () => {
        await unchanged(async () => {
            for (const r of [
                await monitoring(tc, E1),
                await post(tc, `${MON}/participant-lock`, { examInstanceId: E1, participantId: E1s1, action: 'lock', ...intent('Guru mata pelajaran') }),
                await post(tc, `${MON}/add-time`, { examInstanceId: E1, participantId: E1s1, minutes: 5, ...intent('Guru mata pelajaran') }),
                await post(tc, `${MON}/broadcast`, { examInstanceId: E1, target: { scope: 'EXAM' }, message: 'Dari guru.' }),
            ]) assert.deepEqual([r.status, r.body], [403, { error: 'forbidden' }]);
            for (const action of ['pause', 'end']) {
                const r = await post(tc, `${TE}/transition`, { examInstanceId: E1, action, ...intent('Guru mata pelajaran') });
                assert.deepEqual([r.status, r.body], [409, { error: 'institution_managed' }], action);
            }
        });
        const card = await readinessOf(E1);
        assert.deepEqual([card.lifecycleState, card.progress], ['ACTIVE', null], 'P01: no progress while ACTIVE');
        // T assigned as a Proctor of "Ruang 1" (fixture SQL: no Proctor change after opening exists in the product, OC-6).
        const assignment = (await pool.query('INSERT INTO secure_assessment_proctor_assignments (tenant_id, exam_instance_id, person_id) VALUES ($1, $2, $3) RETURNING id',
            [tenant, E1, teacher.personId])).rows[0].id as string;
        await pool.query('INSERT INTO secure_assessment_exam_proctor_room_assignments (tenant_id, exam_instance_id, proctor_assignment_id, exam_room_id) VALUES ($1, $2, $3, $4)',
            [tenant, E1, assignment, await roomId(E1, 'Ruang 1')]);
        try {
            const view = ok(await monitoring(tc, E1));
            assert.deepEqual([view.scope, view.canAddTime, [...new Set(view.participants.map((p: Body) => p.roomLabel))]], ['PROCTOR', false, ['Ruang 1']]);
            assert.equal(view.participants.some((p: Body) => 'timeAdditions' in p), false);
            await unchanged(async () => {
                assert.equal((await post(tc, `${MON}/add-time`, { examInstanceId: E1, participantId: E1s1, minutes: 5, ...intent('Guru sebagai pengawas') })).status, 403);
            });
        } finally {
            await pool.query('UPDATE secure_assessment_proctor_assignments SET revoked_at = statement_timestamp() WHERE id = $1', [assignment]);
        }
        assert.equal((await monitoring(tc, E1)).status, 403, 'the scope is read per request (A04-3)');
    });

    await t.test('I-4/I-15 pause by O freezes every running attempt at the boundary, refuses answers, repeats as NO_OP; END of a PAUSED exam is invalid_state; resume continues', async () => {
        const readBefore = ok(await examRead(o, E1));
        const key = randomUUID();
        const paused = ok(await transition(o, { examInstanceId: E1 }, 'pause', { actionKey: key }));
        assert.deepEqual(paused, { examInstanceId: E1, lifecycleState: 'PAUSED', changed: true, replayed: false });
        const boundary = (await pool.query('SELECT paused_at, paused_by_person_id FROM secure_assessment_exam_pauses WHERE exam_instance_id = $1 AND resumed_at IS NULL', [E1])).rows;
        assert.deepEqual([boundary.length, boundary[0].paused_by_person_id], [1, operator.personId]);
        const frozen = (await a1.timer()).effectiveRemainingSeconds as number;
        await sleep(1100);
        assert.equal((await a1.timer()).effectiveRemainingSeconds, frozen, 'no working time passes while paused');
        const refused = await a1.save(e1Snapshots[1], 'C');
        assert.deepEqual([refused.status, refused.body.error], [409, 'exam_paused']);
        // I-15: the next read shows PAUSED with its boundary and a later server time.
        const readAfter = ok(await examRead(o, E1));
        assert.deepEqual([readAfter.exam.lifecycleState, readAfter.exam.pausedAt], ['PAUSED', boundary[0].paused_at.toISOString()]);
        assert.ok(Date.parse(readAfter.serverTime) > Date.parse(readBefore.serverTime));
        const session = ok(await sessionRead(o, S1)).exams.find((e: Body) => e.examInstanceId === E1);
        assert.deepEqual([session.lifecycleState, session.pausedAt], ['PAUSED', boundary[0].paused_at.toISOString()]);
        const card = await readinessOf(E1);
        assert.deepEqual([card.lifecycleState, card.progress, card.pausedAt], ['PAUSED', null, boundary[0].paused_at.toISOString()], 'P01: no progress while PAUSED');
        const noOpKey = randomUUID();
        const again = ok(await transition(o, { examInstanceId: E1 }, 'pause', { actionKey: noOpKey }));
        assert.deepEqual(again, { examInstanceId: E1, lifecycleState: 'PAUSED', changed: false, replayed: false });
        assert.deepEqual((await controlRows(noOpKey)).entries.map(e => [e.outcome, e.previous_state, e.resulting_state]), [['NO_OP', 'PAUSED', 'PAUSED']]);
        await unchanged(async () => {
            const end = await transition(o, { examInstanceId: E1 }, 'end');
            assert.deepEqual([end.status, end.body], [409, { error: 'invalid_state', examInstanceId: E1, currentState: 'PAUSED' }], 'R11: resume first');
        });
        const resumed = ok(await transition(o, { examInstanceId: E1 }, 'resume'));
        assert.deepEqual(resumed, { examInstanceId: E1, lifecycleState: 'ACTIVE', changed: true, replayed: false });
        const after = (await a1.timer()).effectiveRemainingSeconds as number;
        assert.ok(after <= frozen && after >= frozen - 3, `continues from the frozen time: ${frozen} then ${after}`);
        assert.equal((await pool.query('SELECT resumed_by_person_id FROM secure_assessment_exam_pauses WHERE exam_instance_id = $1 ORDER BY paused_at DESC LIMIT 1', [E1])).rows[0].resumed_by_person_id, operator.personId);
        assert.equal((await a1.save(e1Snapshots[1], 'C')).status, 200);
    });

    let teacherTimeKey = '';
    await t.test('I-17 T2 pauses, resumes, locks, adds time and messages on TM exactly as before, with the SEC-001 rows and no 0064 row', async () => {
        const tmAttempt = await startStudent(tmc, TM);
        const permissionsBefore = (await pool.query('SELECT count(*)::int AS n FROM secure_assessment_permission_action_events')).rows[0].n;
        const controlsBefore = (await pool.query('SELECT count(*)::int AS n FROM secure_assessment_institution_control_actions')).rows[0].n;
        const teacherAct = (path: string, body: Body) => post(t2c, path, body);
        for (const action of ['pause', 'resume']) {
            const r = await teacherAct(`${TE}/transition`, { examInstanceId: TM, action, ...intent('Pelaksanaan ujian terjadwal') });
            assert.equal(r.status, 200, JSON.stringify(r.body));
            assert.deepEqual([r.body.lifecycleState, r.body.changed, r.body.audit.outcome], [action === 'pause' ? 'PAUSED' : 'ACTIVE', true, 'APPLIED']);
        }
        for (const action of ['lock', 'unlock']) {
            const r = await teacherAct(`${MON}/participant-lock`, { examInstanceId: TM, participantId: tmParticipant, action, ...intent('Perangkat bermasalah') });
            assert.equal(r.status, 200, JSON.stringify(r.body));
        }
        teacherTimeKey = randomUUID();
        const time = await teacherAct(`${MON}/add-time`, { examInstanceId: TM, participantId: tmParticipant, minutes: 5, reason: 'Gangguan listrik', confirmed: true, actionKey: teacherTimeKey });
        assert.equal(time.status, 201, JSON.stringify(time.body));
        const message = await teacherAct(`${MON}/broadcast`, { examInstanceId: TM, target: { scope: 'EXAM' }, message: 'Ujian tersisa 15 menit.' });
        assert.deepEqual([message.status, message.body.recipients], [200, 1]);
        assert.equal((await pool.query('SELECT count(*)::int AS n FROM secure_assessment_permission_action_events')).rows[0].n, permissionsBefore + 5);
        assert.equal((await pool.query('SELECT count(*)::int AS n FROM secure_assessment_institution_control_actions')).rows[0].n, controlsBefore, 'teacher-managed controls never enter 0064');
        const view = ok(await monitoring(t2c, TM));
        assert.deepEqual([view.scope, view.canAddTime], ['TEACHER', true]);
        assert.deepEqual(view.participants[0].timeAdditions.map((a: Body) => [a.seconds, a.reason, a.by.you]), [[300, 'Gangguan listrik', true]]);
        assert.equal((await tmAttempt.save(tmSnapshots[0], 'B')).status, 200);
    });

    await t.test('I-12 the same key replays with no new row; another body, route, actor or the Teacher\'s added-time key is action_key_reused; races serialize', async () => {
        await unchanged(async () => {
            const replay = ok(keep(await post(o, `${SV}/transition`, shortcutBody)));
            assert.deepEqual(replay, {
                sessionId: S1, action: 'activate', replayed: true,
                results: byId([
                    { examInstanceId: E1, outcome: 'APPLIED', previousState: 'READY', resultingState: 'ACTIVE' },
                    { examInstanceId: E2, outcome: 'SKIPPED', previousState: 'SCHEDULED', resultingState: 'SCHEDULED', skip: { code: 'invalid_state', currentState: 'SCHEDULED' } },
                ]),
            });
            const timeReplay = ok(keep(await post(o, `${SV}/add-time`, { examInstanceId: E1, participantId: E1s1, minutes: 10, reason: 'Listrik padam di ruang ujian', confirmed: true, actionKey: operatorTimeKey })));
            assert.deepEqual([timeReplay.participantId, timeReplay.addedSeconds, timeReplay.totalAddedSeconds, timeReplay.replayed], [E1s1, 600, 600, true]);
            const reused = { error: 'action_key_reused' };
            assert.deepEqual((await post(o, `${SV}/transition`, { ...shortcutBody, reason: 'Alasan lain' })).body, reused, 'another body');
            assert.deepEqual((await post(o, `${SV}/transition`, { ...shortcutBody, action: 'pause' })).body, reused);
            assert.deepEqual((await post(o2, `${SV}/transition`, shortcutBody)).body, reused, 'another actor');
            assert.deepEqual((await lockCtl(o, E1, E1s1, 'lock', { actionKey: shortcutKey })).body, reused, 'another Operator route');
            assert.deepEqual((await timeCtl(o, E1, E1s1, 5, { actionKey: shortcutKey })).body, reused);
            assert.deepEqual((await messageCtl(o, E1, { scope: 'EXAM' }, { actionKey: shortcutKey })).body, reused);
            assert.deepEqual((await timeCtl(o, E1, E1s1, 5, { actionKey: teacherTimeKey, reason: 'Gangguan listrik' })).body, reused, "the Teacher's added-time key");
        });
        // A lock replays its receipt even after the participant was unlocked again.
        const lockBody = { examInstanceId: E1, participantId: E1s1, action: 'lock', ...intent('Kunci untuk uji ulang') };
        const first = ok(await post(o, `${SV}/participant-lock`, lockBody));
        ok(await lockCtl(o, E1, E1s1, 'unlock'));
        await unchanged(async () => {
            assert.deepEqual(ok(await post(o, `${SV}/participant-lock`, lockBody)), { ...first, replayed: true });
        });
        // A message replays from its 0047 row (E5: z1 has not started, so one recipient).
        const messageBody = { examInstanceId: E5, target: { scope: 'EXAM' }, message: 'Ujian susulan dimulai.', ...intent('Pengumuman ujian susulan') };
        const sent = ok(await post(o, `${SV}/broadcast`, messageBody));
        await unchanged(async () => {
            assert.deepEqual(ok(await post(o, `${SV}/broadcast`, messageBody)), { ...sent, replayed: true });
        });
        // O and O' pause E1 at once: one APPLIED, one NO_OP.
        const pair = await Promise.all([transition(o, { examInstanceId: E1 }, 'pause'), transition(o2, { examInstanceId: E1 }, 'pause')]);
        assert.deepEqual(pair.map(r => r.status), [200, 200], JSON.stringify(pair.map(r => r.body)));
        assert.deepEqual(pair.map(r => r.body.changed).sort(), [false, true]);
        ok(await transition(o, { examInstanceId: E1 }, 'resume'));
        // A session pause racing a per-exam end of E2 serializes on E2's row: either order is consistent.
        const [sessionPause, endE2] = await Promise.all([transition(o, { sessionId: S1 }, 'pause'), transition(o2, { examInstanceId: E2 }, 'end')]);
        assert.equal(sessionPause.status, 200, JSON.stringify(sessionPause.body));
        const e2Result = sessionPause.body.results.find((r: Body) => r.examInstanceId === E2);
        if (endE2.status === 200) {
            assert.deepEqual([await stateOf(E2), e2Result.outcome, e2Result.skip], ['ENDED', 'SKIPPED', { code: 'invalid_state', currentState: 'ENDED' }]);
        } else {
            assert.deepEqual([endE2.status, endE2.body], [409, { error: 'invalid_state', examInstanceId: E2, currentState: 'PAUSED' }]);
            assert.deepEqual([await stateOf(E2), e2Result.outcome], ['PAUSED', 'APPLIED']);
            ok(await transition(o, { examInstanceId: E2 }, 'resume'));
        }
        ok(await transition(o, { examInstanceId: E1 }, 'resume'));
        assert.equal(await stateOf(E1), 'ACTIVE');
    });

    /** The six Operator routes with a well-formed body (fresh keys), for the authority and edge vectors. */
    const operatorRoutes = (): Array<[string, string, Body | null]> => [
        ['GET', `${SV}?sessionId=${S1}`, null],
        ['GET', `${SV}/exam?examInstanceId=${E1}`, null],
        ['POST', `${SV}/transition`, { examInstanceId: E1, action: 'pause', ...intent('Ditolak') }],
        ['POST', `${SV}/transition`, { sessionId: S1, action: 'pause', ...intent('Ditolak') }],
        ['POST', `${SV}/participant-lock`, { examInstanceId: E1, participantId: E1s1, action: 'lock', ...intent('Ditolak') }],
        ['POST', `${SV}/add-time`, { examInstanceId: E1, participantId: E1s1, minutes: 5, ...intent('Ditolak') }],
        ['POST', `${SV}/broadcast`, { examInstanceId: E1, target: { scope: 'EXAM' }, message: 'Ditolak.', ...intent('Ditolak') }],
    ];
    const call = (c: BrowserLikeClient, [method, path, body]: [string, string, Body | null]): Promise<ClientResponse> => c.request(path, body ? { method, body } : { method });

    await t.test('I-10 / §4.9 every other role and school, target substitution, and the Operator on the Teacher and supervisor routes (N01..N04, N08) change nothing', async () => {
        await operatorAssignment(pool, tenant, revokedOperator.personId, 'REVOKE');
        await unchanged(async () => {
            // N03/N04: the subject Teacher, a Proctor, a Student, a Homeroom Teacher, O2 in this school, actor A and a revoked Operator.
            const refused: Array<[string, BrowserLikeClient]> = [['the subject Teacher', tc], ['a Proctor', p1c], ['a Student', s1c], ['a Homeroom Teacher', hc],
                ['the other school Operator', foreignInOurs], ['actor A without a school role', ac], ['a revoked Operator', oRevoked], ['the Teacher of TM', t2c]];
            for (const [who, c] of refused) {
                for (const route of operatorRoutes()) {
                    const r = await call(c, route);
                    assert.deepEqual([r.status, r.body], [403, { error: 'forbidden' }], `${who} ${route[0]} ${route[1]}`);
                }
            }
            // N01: anonymous.
            for (const route of operatorRoutes()) assert.equal((await call(anonymous, route)).status, 401, `anonymous ${route[1]}`);
            // N02: O2 in its own school reaches no object of this one.
            for (const route of operatorRoutes()) {
                const r = await call(foreign, route);
                assert.deepEqual([r.status, r.body], [403, { error: 'forbidden' }], `O2 ${route[1]}`);
            }
            // N02: a foreign, a teacher-managed and a nonexistent object answer the same bytes.
            const same = (rs: ClientResponse[], label: string) => {
                for (const r of rs) assert.deepEqual([r.status, r.body], [403, { error: 'forbidden' }], label);
                assert.equal(new Set(rs.map(r => JSON.stringify(r.body))).size, 1, label);
            };
            same([await o.request(`${SV}?sessionId=${foreignSession}`), await o.request(`${SV}?sessionId=${randomUUID()}`)], 'session read');
            same([await transition(o, { sessionId: foreignSession }, 'pause'), await transition(o, { sessionId: randomUUID() }, 'pause')], 'session transition');
            for (const [exam, participant] of [[foreignExam, foreignParticipant], [TM, tmParticipant], [randomUUID(), randomUUID()]]) {
                same([
                    await o.request(`${SV}/exam?examInstanceId=${exam}`), await transition(o, { examInstanceId: exam }, 'pause'),
                    await lockCtl(o, exam, participant, 'lock'), await timeCtl(o, exam, participant, 5), await messageCtl(o, exam, { scope: 'EXAM' }),
                ], `exam ${exam}`);
            }
            // A participant of another exam or tenant, a room of another exam or tenant.
            for (const participant of [E2y2, foreignParticipant, randomUUID()]) {
                same([await lockCtl(o, E1, participant, 'lock'), await timeCtl(o, E1, participant, 5), await messageCtl(o, E1, { scope: 'PARTICIPANTS', participantIds: [participant] })], participant);
            }
            for (const room of [await roomId(E2, 'Ruang 2'), foreignRoom, randomUUID()]) same([await messageCtl(o2, E1, { scope: 'ROOM', roomId: room })], room);
            // N08: anything outside the exact body or query is 400.
            for (const [path, body] of [
                [`${SV}/transition`, { examInstanceId: E1, action: 'pause', ...intent('x'), actorPersonId: operator.personId }],
                [`${SV}/transition`, { sessionId: S1, action: 'pause', ...intent('x'), tenantId: tenant }],
                [`${SV}/transition`, { examInstanceId: E1, sessionId: S1, action: 'pause', ...intent('x') }],
                [`${SV}/transition`, { examInstanceId: E1, action: 'finalize', ...intent('x') }],
                [`${SV}/participant-lock`, { examInstanceId: E1, participantId: E1s1, action: 'lock', ...intent('x'), attemptId: a1.attemptId }],
                [`${SV}/add-time`, { examInstanceId: E1, participantId: E1s1, minutes: 5, ...intent('x'), tenantId: tenant }],
                [`${SV}/add-time`, { examInstanceId: E1, participantId: E1s1, minutes: 5, reason: 'x', confirmed: false, actionKey: randomUUID() }],
                [`${SV}/broadcast`, { examInstanceId: E1, target: { scope: 'EXAM' }, message: 'x', ...intent('x'), actorPersonId: operator.personId }],
                [`${SV}/broadcast`, { examInstanceId: E1, target: { scope: 'EXAM' }, message: 'x', confirmed: true, actionKey: randomUUID() }],
            ] as Array<[string, Body]>) {
                assert.deepEqual((await post(o, path, body)).body, { error: 'invalid_request' }, `${path} ${JSON.stringify(Object.keys(body))}`);
            }
            for (const query of [`sessionId=${S1}&tenantId=${tenant}`, 'sessionId=nope', '', `examInstanceId=${E1}`]) {
                assert.deepEqual((await o.request(`${SV}?${query}`)).body, { error: 'invalid_request' }, query);
            }
            assert.deepEqual((await o.request(`${SV}/exam?sessionId=${S1}`)).body, { error: 'invalid_request' });
            // N04 (F6): the School Operator, with no Teacher or Proctor assignment, on the Teacher result, export, essay,
            // finalize and the four supervisor routes, for an institution exam and for a teacher-managed one.
            for (const [exam, participant] of [[E1, E1s1], [TM, tmParticipant]]) {
                for (const [path, init] of [
                    [`${TE}/results?examInstanceId=${exam}`, {}],
                    [`${TE}/results`, { method: 'POST', body: { examInstanceId: exam, format: 'csv', actionKey: randomUUID() } }],
                    [`${TE}/results`, { method: 'POST', body: { examInstanceId: exam, format: 'print', actionKey: randomUUID() } }],
                    [`${TE}/essays?examInstanceId=${exam}`, {}],
                    [`${TE}/essays/grade`, { method: 'POST', body: { examInstanceId: exam, attemptId: randomUUID(), snapshotId: randomUUID(), score: '1', expectedRevision: null } }],
                    [`${TE}/transition`, { method: 'POST', body: { examInstanceId: exam, action: 'finalize', ...intent('Operator') } }],
                    [`${MON}?examInstanceId=${exam}`, {}],
                    [`${MON}/participant-lock`, { method: 'POST', body: { examInstanceId: exam, participantId: participant, action: 'lock', ...intent('Operator') } }],
                    [`${MON}/add-time`, { method: 'POST', body: { examInstanceId: exam, participantId: participant, minutes: 5, ...intent('Operator') } }],
                    [`${MON}/broadcast`, { method: 'POST', body: { examInstanceId: exam, target: { scope: 'EXAM' }, message: 'Dari operator.' } }],
                ] as Array<[string, { method?: string; body?: Body }]>) {
                    const r = await o.request(path, init);
                    assert.deepEqual([r.status, r.body], [403, { error: 'forbidden' }], `${exam === TM ? 'TM' : 'E1'} ${path}`);
                }
            }
            // N01: an unavailable database gives 503 with nothing written.
            const unavailable = { connect: async () => { throw Object.assign(new Error('database unavailable'), { code: 'ECONNREFUSED' }); }, query: async () => { throw new Error('database unavailable'); } };
            const down = await startProductionWiredServer(unavailable as unknown as pg.Pool);
            try {
                const dc = new BrowserLikeClient(down.baseUrl);
                dc.cookie = o.cookie;
                dc.tenantId = tenant;
                for (const route of operatorRoutes()) {
                    const r = await call(dc, route);
                    assert.deepEqual([r.status, r.body], [503, { error: 'persistence_unavailable' }], route[1]);
                }
            } finally {
                await down.close();
            }
        });
    });

    await t.test('N07 authority at commit: an Operator assignment revoked while a pause waits on its lock gives 403 with nothing written', async () => {
        const waiting = await staff('operator.menunggu');
        await operatorAssignment(pool, tenant, waiting.personId, 'ASSIGN');
        const ow = await login(waiting);
        const before = await counts(pool);
        const revoker = await pool.connect();
        try {
            await revoker.query('BEGIN');
            await setSchoolOperator(revoker, { tenantId: tenant, personId: waiting.personId, action: 'REVOKE', operator: 'Synthetic CI operator', caseReference: 'ASSESS-INSTITUTION-003', reason: 'Synthetic revocation' });
            const pending = transition(ow, { examInstanceId: E1 }, 'pause');
            await lockWaitObserved(pool, pending);
            await revoker.query('COMMIT');
            const r = await pending;
            assert.deepEqual([r.status, r.body], [403, { error: 'forbidden' }]);
        } catch (error) {
            await revoker.query('ROLLBACK').catch(() => {});
            throw error;
        } finally {
            revoker.release();
        }
        assert.deepEqual(await counts(pool), before);
        assert.equal(await stateOf(E1), 'ACTIVE');
    });

    await t.test('I-19 the edge of every POST path: a foreign Origin and a 65 KiB body are refused before any effect', async () => {
        await unchanged(async () => {
            for (const path of ['transition', 'participant-lock', 'add-time', 'broadcast'].map(p => `${SV}/${p}`)) {
                const r = await o.request(path, { method: 'POST', body: { examInstanceId: E1 }, origin: 'https://lain.example' });
                assert.deepEqual([r.status, r.body], [403, { error: 'origin_not_allowed' }], path);
                const large = await o.request(path, { method: 'POST', rawBody: JSON.stringify({ reason: 'x'.repeat(65 * 1024) }), headers: { 'Content-Type': 'application/json' } });
                assert.deepEqual([large.status, large.body], [413, { error: 'payload_too_large' }], path);
            }
        });
    });

    await t.test('I-13 every applied control has one attributable action row with its entries; the business ledgers name the Operator; both tables are append-only', async () => {
        const actions = (await pool.query('SELECT * FROM secure_assessment_institution_control_actions ORDER BY acted_at')).rows;
        assert.ok(actions.length >= 15, String(actions.length));
        for (const a of actions) {
            assert.ok([operator.personId, operator2.personId].includes(a.actor_person_id), a.id);
            assert.equal(a.confirmed, true);
            assert.match(a.request_digest, /^[0-9a-f]{64}$/);
            assert.ok(a.reason.length >= 1 && a.reason.length <= 200 && a.reason === a.reason.trim());
            assert.equal(a.tenant_id, tenant);
            const entries = (await pool.query('SELECT count(*)::int AS n FROM secure_assessment_institution_control_entries WHERE action_id = $1', [a.id])).rows[0].n;
            assert.ok(entries >= 1, `${a.kind} ${a.action} has its entries`);
        }
        const operators = [operator.personId, operator2.personId];
        const events = (await pool.query(`SELECT actor_person_id FROM secure_assessment_exam_lifecycle_events WHERE exam_instance_id = ANY($1::uuid[]) AND from_state <> 'DRAFT'`, [[E1, E2, E5]])).rows;
        for (const e of events) assert.ok(operators.includes(e.actor_person_id));
        const pauses = (await pool.query('SELECT paused_by_person_id, resumed_by_person_id FROM secure_assessment_exam_pauses WHERE exam_instance_id = ANY($1::uuid[])', [[E1, E2]])).rows;
        for (const p of pauses) assert.ok(operators.includes(p.paused_by_person_id) && (p.resumed_by_person_id === null || operators.includes(p.resumed_by_person_id)));
        const broadcasts = (await pool.query(
            `SELECT b.sender_person_id FROM secure_assessment_exam_broadcasts b JOIN secure_assessment_institution_control_entries e ON e.broadcast_id = b.id`)).rows;
        assert.ok(broadcasts.length >= 4 && broadcasts.every(b => operators.includes(b.sender_person_id)));
        assert.equal((await pool.query(`SELECT count(*)::int AS n FROM secure_assessment_permission_action_events WHERE exam_instance_id = ANY($1::uuid[])`, [[E1, E2, E5]])).rows[0].n,
            (await pool.query(`SELECT count(*)::int AS n FROM secure_assessment_permission_action_events WHERE exam_instance_id = $1 AND authority_kind = 'PROCTOR'`, [E2])).rows[0].n,
            'Operator controls never enter 0054 (E4); only the Proctor\'s own lock does');
        for (const table of ['secure_assessment_institution_control_actions', 'secure_assessment_institution_control_entries']) {
            await assert.rejects(pool.query(`UPDATE ${table} SET tenant_id = tenant_id`), /append-only/, table);
            await assert.rejects(pool.query(`DELETE FROM ${table}`), /append-only/, table);
        }
    });

    await t.test('I-16 no Operator response carries a name, NIS, NISN, birth date, membership, question, key, rubric, score or answer, nor another actor\'s reason', async () => {
        const bodies = [...receipts, ok(await sessionRead(o, S1)), ok(await sessionRead(o, S3)), ok(await examRead(o, E1)), ok(await examRead(o, E2)), ok(await examRead(o2, E1))];
        const keys = keysOf(bodies);
        for (const key of ['fullName', 'name', 'nis', 'nisn', 'birthDate', 'membershipId', 'prompt', 'options', 'correct', 'correctOptionId', 'rubric', 'score', 'answer', 'frozenContent']) {
            assert.equal(keys.has(key), false, key);
        }
        const text = JSON.stringify(bodies);
        assert.equal(text.includes('Soal nomor'), false, 'no question text');
        assert.equal(JSON.stringify(ok(await examRead(o2, E1))).includes('Listrik padam di ruang ujian'), false);
        for (const id of ['staf.tanpa.peran', 'walikelas.satu', 'pengawas.empat']) assert.equal(JSON.stringify(ok(await sessionRead(o, S1))).includes(id), false, `${id}: no member directory`);
    });

    await t.test('I-8 end: O ends E1; new starts stop, a running attempt submits; the Teacher card shows the counts and T still finalizes', async () => {
        const ended = ok(await transition(o, { examInstanceId: E1 }, 'end'));
        assert.deepEqual(ended, { examInstanceId: E1, lifecycleState: 'ENDED', changed: true, replayed: false });
        assert.deepEqual(ok(await transition(o, { examInstanceId: E1 }, 'end')), { examInstanceId: E1, lifecycleState: 'ENDED', changed: false, replayed: false });
        const late = await s3c.request('/api/v1/assessment/attempts/start', { method: 'POST', body: { examInstanceId: E1 } });
        assert.deepEqual([late.status, late.body.error], [409, 'exam_ended']);
        // Snapshot 1 already holds an answer (I-5), so the change carries its current write version.
        const stored = (await pool.query('SELECT write_version FROM secure_assessment_exam_answers WHERE exam_attempt_id = $1 AND exam_question_snapshot_id = $2', [a1.attemptId, e1Snapshots[0]])).rows[0].write_version as number;
        assert.equal((await a1.save(e1Snapshots[0], 'B', stored)).status, 200, 'a running attempt keeps its own time');
        const submitted = await a1.submit();
        assert.ok(submitted.status >= 200 && submitted.status < 300, JSON.stringify(submitted.body));
        const card = await readinessOf(E1);
        assert.equal(card.lifecycleState, 'ENDED');
        assert.ok(card.progress !== null && card.progress.participants === 3, JSON.stringify(card.progress));
        const finalized = await post(tc, `${TE}/transition`, { examInstanceId: E1, action: 'finalize', ...intent('Semua jawaban sudah lengkap') });
        assert.deepEqual([finalized.status, finalized.body.lifecycleState], [200, 'FINALIZED'], JSON.stringify(finalized.body));
    });
});

test('ASSESS-INSTITUTION-003 C03 migration 0064 (I-18): upgrade on a populated database, rollback, repeat, append-only and the two guards', { skip: skipWithoutDatabase }, async t => {
    const db = await createDisposableDatabase({ migrate: false });
    t.after(() => db.close());
    const c = await db.pool.connect();
    try {
        const dir = new URL('../../../../database/migrations/', import.meta.url);
        for (const name of (await readdir(dir)).filter(n => /^\d{4}.*\.sql$/.test(n) && n < '0064').sort()) await c.query(await readFile(new URL(name, dir), 'utf8'));
        // A populated database: two sessions with ACTIVE institution exams, their participants and attempts, and a teacher-managed exam.
        const tenant = await createTenant(db.pool);
        const teacher = await createPersonWithAccount(db.pool);
        const teaching: TeachingContext = await createTeachingContext(db.pool, tenant, await addMembership(db.pool, tenant, teacher.personId), 'IPA');
        const managed = await createExamInstance(db.pool, tenant, teaching, { lifecycleState: 'ACTIVE' });
        const academicPeriodId = (await c.query('SELECT o.academic_period_id FROM academic_core_teaching_assignments a JOIN academic_core_subject_offerings o ON o.id = a.subject_offering_id WHERE a.id = $1',
            [teaching.teachingAssignmentId])).rows[0].academic_period_id;
        const period = (await c.query(
            `INSERT INTO secure_assessment_institution_exam_periods (tenant_id, academic_period_id, assessment_type_id, label, created_by_person_id, action_key, request_digest)
             VALUES ($1, $2, $3, 'PTS', $4, gen_random_uuid(), repeat('a', 64)) RETURNING id`, [tenant, academicPeriodId, teaching.assessmentTypeId, teacher.personId])).rows[0].id;
        const session = async (days: number) => (await c.query(
            `INSERT INTO secure_assessment_institution_exam_sessions (tenant_id, period_id, starts_at, ends_at, created_by_person_id, action_key, request_digest)
             VALUES ($1, $2, statement_timestamp() + make_interval(days => $3), statement_timestamp() + make_interval(days => $3, hours => 2), $4, gen_random_uuid(), repeat('a', 64)) RETURNING id`,
            [tenant, period, days, teacher.personId])).rows[0].id as string;
        const sessionA = await session(2);
        const sessionB = await session(3);
        const institution = async (sessionId: string) => (await c.query(
            `INSERT INTO secure_assessment_exam_instances (tenant_id, teaching_assignment_id, assessment_type_id, lifecycle_state, window_starts_at, window_ends_at,
                configured_attempt_duration_seconds, latest_start_policy, room_based_operations_enabled, proctor_per_room_required, institution_session_id)
             SELECT $1, $2, $3, 'ACTIVE', s.starts_at, s.ends_at, 3600, 'FULL_DURATION_BEYOND_WINDOW', TRUE, TRUE, s.id
             FROM secure_assessment_institution_exam_sessions s WHERE s.id = $4 RETURNING id`, [tenant, teaching.teachingAssignmentId, teaching.assessmentTypeId, sessionId])).rows[0].id as string;
        const EA1 = await institution(sessionA);
        const EA2 = await institution(sessionA);
        const EB = await institution(sessionB);
        const person = async () => (await createPersonWithAccount(db.pool)).personId;
        const participant = async (exam: string) => (await c.query('INSERT INTO secure_assessment_exam_participants (tenant_id, exam_instance_id, person_id) VALUES ($1, $2, $3) RETURNING id',
            [tenant, exam, await person()])).rows[0].id as string;
        const attempt = async (participantId: string) => (await c.query('INSERT INTO secure_assessment_exam_attempts (tenant_id, exam_participant_id) VALUES ($1, $2) RETURNING id',
            [tenant, participantId])).rows[0].id as string;
        const pa1 = await participant(EA1);
        const pa2 = await participant(EA1);
        const pb = await participant(EA2);
        const attA1 = await attempt(pa1);
        const attA2 = await attempt(pa2);
        const states = async () => (await c.query('SELECT string_agg(id::text || lifecycle_state, \',\' ORDER BY id) AS s FROM secure_assessment_exam_instances')).rows[0].s;
        const shape = async () => (await c.query(
            `SELECT (SELECT count(*)::int FROM pg_tables WHERE tablename IN ('secure_assessment_institution_control_actions', 'secure_assessment_institution_control_entries')) AS tables,
                    (SELECT count(*)::int FROM pg_trigger WHERE tgname IN ('trg_prevent_sa_institution_control_action_mutation', 'trg_prevent_sa_institution_control_entry_mutation',
                        'trg_guard_sa_institution_control_action', 'trg_guard_sa_institution_control_entry')) AS triggers,
                    (SELECT count(*)::int FROM pg_proc WHERE proname IN ('prevent_sa_institution_control_mutation', 'guard_sa_institution_control_action',
                        'guard_sa_institution_control_entry')) AS functions`)).rows[0];
        assert.deepEqual(await shape(), { tables: 0, triggers: 0, functions: 0 });
        const statesBefore = await states();
        const sql = await readFile(new URL('0064_secure_assessment_institution_controls.sql', dir), 'utf8');
        const failing = sql.replace("INSERT INTO elligble_migration_history (migration_id) VALUES ('0064_secure_assessment_institution_controls');", "RAISE EXCEPTION 'synthetic migration rollback';");
        assert.notEqual(failing, sql);
        await assert.rejects(c.query(failing), /synthetic migration rollback/);
        await c.query('ROLLBACK');
        assert.deepEqual(await shape(), { tables: 0, triggers: 0, functions: 0 }, 'the failed migration left nothing behind');
        await c.query(sql);
        await c.query(sql);
        assert.equal((await c.query("SELECT count(*)::int AS n FROM elligble_migration_history WHERE migration_id = '0064_secure_assessment_institution_controls'")).rows[0].n, 1);
        assert.deepEqual(await shape(), { tables: 2, triggers: 4, functions: 3 });
        assert.equal(await states(), statesBefore, 'no data is migrated');

        const named = (code: string, constraint: string) => (error: { code?: string; constraint?: string }) => error.code === code && error.constraint === constraint;
        const action = (fields: Record<string, unknown>) => {
            const row = { tenant_id: tenant, session_id: sessionA, exam_instance_id: null, participant_id: null, kind: 'TRANSITION', action: 'pause', reason: 'Uji',
                confirmed: true, actor_person_id: teacher.personId, action_key: randomUUID(), request_digest: 'a'.repeat(64), ...fields };
            const keys = Object.keys(row);
            return c.query(`INSERT INTO secure_assessment_institution_control_actions (${keys.join(', ')}) VALUES (${keys.map((_, i) => `$${i + 1}`).join(', ')}) RETURNING id`,
                Object.values(row)).then(r => r.rows[0].id as string);
        };
        const entry = (actionId: string, fields: Record<string, unknown>) => {
            const row = { tenant_id: tenant, action_id: actionId, exam_instance_id: EA1, participant_id: null, attempt_id: null, broadcast_id: null, outcome: 'APPLIED',
                previous_state: 'ACTIVE', resulting_state: 'PAUSED', skip_code: null, ...fields };
            const keys = Object.keys(row);
            return c.query(`INSERT INTO secure_assessment_institution_control_entries (${keys.join(', ')}) VALUES (${keys.map((_, i) => `$${i + 1}`).join(', ')})`, Object.values(row));
        };
        // The action guard: an exam of another session, or a teacher-managed exam.
        await assert.rejects(action({ exam_instance_id: EB }), named('23514', 'ck_sa_institution_control_session'));
        await assert.rejects(action({ exam_instance_id: managed }), named('23514', 'ck_sa_institution_control_session'));
        // The action constraints.
        await assert.rejects(action({ reason: ' Uji' }), named('23514', 'ck_sa_institution_control_reason'));
        await assert.rejects(action({ reason: '' }), named('23514', 'ck_sa_institution_control_reason'));
        await assert.rejects(action({ confirmed: false }), named('23514', 'ck_sa_institution_control_confirmed'));
        await assert.rejects(action({ action: 'lock' }), named('23514', 'ck_sa_institution_control_action'));
        await assert.rejects(action({ kind: 'PARTICIPANT_LOCK', action: 'lock', exam_instance_id: EA1 }), named('23514', 'ck_sa_institution_control_target'));
        await assert.rejects(action({ request_digest: 'x' }), named('23514', 'ck_sa_institution_control_digest'));
        const sessionAction = await action({});
        const examAction = await action({ exam_instance_id: EA1 });
        const lockAction = await action({ kind: 'PARTICIPANT_LOCK', action: 'lock', exam_instance_id: EA1, participant_id: pa1 });
        const key = (await c.query('SELECT action_key FROM secure_assessment_institution_control_actions WHERE id = $1', [sessionAction])).rows[0].action_key;
        await assert.rejects(action({ action_key: key }), named('23505', 'uq_sa_institution_control_action_key'));
        // The entry guard (F1).
        const scopeRefusal = named('23514', 'ck_sa_institution_control_entry_scope');
        await assert.rejects(entry(sessionAction, { exam_instance_id: EB }), scopeRefusal, 'an exam of another session');
        await assert.rejects(entry(sessionAction, { exam_instance_id: managed }), scopeRefusal, 'a teacher-managed exam');
        await assert.rejects(entry(examAction, { exam_instance_id: EA2 }), scopeRefusal, 'E2 under an action naming E1');
        await assert.rejects(entry(sessionAction, { participant_id: pa1, attempt_id: attA1 }), scopeRefusal, 'a participant the action does not name');
        await assert.rejects(entry(lockAction, { participant_id: pa2, attempt_id: attA2, previous_state: 'UNLOCKED', resulting_state: 'LOCKED' }), scopeRefusal, 'another participant');
        await assert.rejects(entry(examAction, { outcome: 'SKIPPED', skip_code: 'invalid_state', resulting_state: 'ACTIVE' }), scopeRefusal, 'SKIPPED under an exam action');
        await assert.rejects(entry(lockAction, { participant_id: pa1, attempt_id: attA1 }), scopeRefusal, 'a lock entry with lifecycle states');
        await assert.rejects(entry(sessionAction, { previous_state: 'LOCKED' }), scopeRefusal, 'a transition entry with lock states');
        // The attempt is tied to its participant, as 0054 ties it.
        await assert.rejects(entry(lockAction, { participant_id: pa1, attempt_id: attA2, previous_state: 'UNLOCKED', resulting_state: 'LOCKED' }),
            named('23503', 'fk_sa_institution_control_entry_attempt'));
        // The table CHECKs: a state outside the domain passes the guard and is refused by its own named CHECK.
        await assert.rejects(entry(sessionAction, { previous_state: 'ARCHIVED' }), named('23514', 'ck_sa_institution_control_entry_previous'));
        await assert.rejects(entry(sessionAction, { resulting_state: 'DRAFT' }), named('23514', 'ck_sa_institution_control_entry_resulting'));
        await assert.rejects(entry(sessionAction, { outcome: 'SKIPPED' }), named('23514', 'ck_sa_institution_control_entry_skip'));
        await assert.rejects(entry(sessionAction, { skip_code: 'invalid_state' }), named('23514', 'ck_sa_institution_control_entry_skip'));
        await assert.rejects(entry(lockAction, { participant_id: pa1, previous_state: 'UNLOCKED', resulting_state: 'LOCKED' }), named('23514', 'ck_sa_institution_control_entry_target'));
        await assert.rejects(entry(sessionAction, { outcome: 'DONE' }), named('23514', 'ck_sa_institution_control_entry_outcome'));
        // Valid rows: a session-wide transition with an APPLIED and a SKIPPED exam, and a lock.
        await entry(sessionAction, {});
        await entry(sessionAction, { exam_instance_id: EA2, outcome: 'SKIPPED', previous_state: 'SCHEDULED', resulting_state: 'SCHEDULED', skip_code: 'invalid_state' });
        await entry(lockAction, { participant_id: pa1, attempt_id: attA1, previous_state: 'UNLOCKED', resulting_state: 'LOCKED' });
        await assert.rejects(entry(sessionAction, {}), named('23505', 'uq_sa_institution_control_entry_exam'));
        assert.ok(pb);
        for (const table of ['secure_assessment_institution_control_actions', 'secure_assessment_institution_control_entries']) {
            await assert.rejects(c.query(`UPDATE ${table} SET tenant_id = tenant_id`), /append-only/, table);
            await assert.rejects(c.query(`DELETE FROM ${table}`), /append-only/, table);
        }
    } finally {
        c.release();
    }
});
