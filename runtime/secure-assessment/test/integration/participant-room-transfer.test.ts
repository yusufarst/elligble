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
import { finalizeExpiredAttempts } from '../../src/expiry-finalization.ts';

// ASSESS-ROOM-001 real PostgreSQL oracle (record §5 I-1 to I-23, the §4.8 N-ids, C03) through the production-wired
// server. The main fixture follows ASSESS-INSTITUTION-003: session S1 placed, roomed and marked ready through the
// product, its windows moved to now by fixture SQL, E1 and E2 opened through the Operator route, E3 left READY. Every
// race (I-6 to I-15, approved by OR-5) runs on its own running exam built by fixture SQL in a session of its own (a
// unique schedule), so no race disturbs another; each asserts the server before/after comparison of §4.6, the absence
// of a deadlock (state_changed), and completion within 5 s of the release. A race is ordered with held transactions:
// the target room row held FOR UPDATE pauses a transfer after it holds the attempt (OR-4 step 5 comes last), and the
// attempt, an answer row or the exam row held pauses the other writer where the record says it holds its lock.
// Migration 0065 (I-21) is the second test.

const P = '/api/v1/assessment/institution-exams';
const R = `${P}/rooms`;
const SV = `${P}/supervision`;
const MOVE = `${SV}/room-transfer`;
const MON = '/api/v1/assessment/exam-monitoring';
const REASON = 'Perangkat ruang bermasalah';
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

/** §4.6: the Attempt-side rows a transfer never touches. */
const ATTEMPT_SIDE = [
    'secure_assessment_exam_participants', 'secure_assessment_exam_attempts', 'secure_assessment_exam_question_snapshots', 'secure_assessment_exam_answers',
    'secure_assessment_timer_state', 'secure_assessment_timer_adjustments', 'secure_assessment_exam_pauses', 'secure_assessment_attempt_locks',
    'secure_assessment_exam_sessions', 'secure_assessment_exam_submissions', 'secure_assessment_exam_broadcasts', 'secure_assessment_exam_broadcast_recipients',
    'secure_assessment_review_flags',
] as const;
/** The rows a transfer writes: the current room row and the 0063 history. */
const ROOM_SIDE = [
    'secure_assessment_exam_participant_room_assignments', 'secure_assessment_institution_room_actions', 'secure_assessment_institution_room_action_entries',
] as const;
/** Everything else a refusal must leave as it was. */
const OTHER_SIDE = [
    'secure_assessment_exam_instances', 'secure_assessment_exam_rooms', 'secure_assessment_proctor_assignments', 'secure_assessment_exam_proctor_room_assignments',
    'secure_assessment_institution_control_actions', 'secure_assessment_institution_control_entries', 'secure_assessment_exam_lifecycle_events',
    'secure_assessment_permission_action_events',
] as const;
const EVERY_TABLE = [...ATTEMPT_SIDE, ...ROOM_SIDE, ...OTHER_SIDE];

type Snapshot = Record<string, string[]>;
/** Every row of the tables, whole (to_jsonb), so a changed column anywhere is seen. */
async function rowsOf(pool: pg.Pool, tables: readonly string[]): Promise<Snapshot> {
    const out: Snapshot = {};
    for (const table of tables) out[table] = (await pool.query(`SELECT to_jsonb(x)::text AS r FROM ${table} x ORDER BY 1`)).rows.map(r => r.r as string);
    return out;
}
const changedTables = (before: Snapshot, after: Snapshot) => Object.keys(before).filter(t => JSON.stringify(before[t]) !== JSON.stringify(after[t])).sort();
const newRows = (before: string[], after: string[]) => after.filter(r => !before.includes(r));

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
    setSchoolOperator(c, { tenantId, personId, action, operator: 'Synthetic CI operator', caseReference: 'ASSESS-ROOM-001', reason: 'Synthetic room transfer' }));

/** A transaction held open by the test: it takes its locks now and releases them at commit or rollback. */
interface Held { client: pg.PoolClient; commit(): Promise<void>; rollback(): Promise<void> }
async function hold(pool: pg.Pool, statements: Array<[string, unknown[]]>): Promise<Held> {
    const client = await pool.connect();
    let open = true;
    const end = async (sql: 'COMMIT' | 'ROLLBACK') => {
        if (!open) return;
        open = false;
        try { await client.query(sql); } finally { client.release(); }
    };
    try {
        await client.query('BEGIN');
        for (const [sql, params] of statements) await client.query(sql, params);
    } catch (error) {
        await end('ROLLBACK').catch(() => {});
        throw error;
    }
    return { client, commit: () => end('COMMIT'), rollback: () => end('ROLLBACK') };
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

/** The 5 s bound of every race (§5): the request completes after the release, without a detected deadlock. */
async function bounded<T extends ClientResponse>(pending: Promise<T>, label: string): Promise<T> {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const timeout = new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error(`${label} did not complete within 5 s`)), 5000); });
    try {
        const r = await Promise.race([pending, timeout]);
        assert.notDeepEqual(r.body, { error: 'state_changed' }, `${label}: no deadlock (40P01) or serialization failure`);
        assert.ok(r.status < 500, `${label}: ${r.status} ${JSON.stringify(r.body)}`);
        return r;
    } finally {
        clearTimeout(timer);
    }
}

/** Every key of a JSON value, recursively. */
function keysOf(value: unknown, into = new Set<string>()): Set<string> {
    if (Array.isArray(value)) value.forEach(v => keysOf(v, into));
    else if (value && typeof value === 'object') for (const [k, v] of Object.entries(value)) { into.add(k); keysOf(v, into); }
    return into;
}

test('ASSESS-ROOM-001 C03 participant room transfer end to end through production wiring', { skip: skipWithoutDatabase, timeout: 900_000 }, async t => {
    const db = await createDisposableDatabase();
    const app = await startProductionWiredServer(db.pool);
    t.after(async () => { await app.close(); await db.close(); });
    const pool = db.pool;

    // Fixture (record §5): tenant 1 (WIB) with Matematika x X (s1..s5), Fisika x Y (y1, y2) and Biologi x Z (z1), all taught
    // by T; a teacher-managed exam TM of T2; Proctors P1..P4; Operators O and O' (and one revoked later); a Homeroom
    // Teacher H; actor A (membership, no role); tenant 2 with its Operator O2, an ACTIVE institution exam and a room.
    const tenant = await createTenant(pool, 'SMA Pindah Ruang');
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
    const s4 = await enroll('siswa.mtk.4', teaching.teachingAssignmentId);
    const s5 = await enroll('siswa.mtk.5', teaching.teachingAssignmentId);
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
    await addQuestionSnapshots(pool, tenant, TM, 2);
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
    const hc = await login(homeroom);
    const ac = await login(actorA);
    const s1c = await login(s1);
    const s2c = await login(s2);
    const s3c = await login(s3);
    const s4c = await login(s4);
    const s5c = await login(s5);
    const y1c = await login(y1);
    const foreignInOurs = await login(foreignOperator);
    const foreign = await login(foreignOperator, otherTenant);
    const anonymous = new BrowserLikeClient(app.baseUrl);
    anonymous.tenantId = tenant;

    const receipts: unknown[] = [];
    const keep = (r: ClientResponse) => { receipts.push(r.body); return r; };
    const ok = (r: ClientResponse, status = 200) => { assert.equal(r.status, status, JSON.stringify(r.body)); return r.body as Body; };
    const unchanged = async (run: () => Promise<void>) => {
        const before = await rowsOf(pool, EVERY_TABLE);
        await run();
        assert.deepEqual(await rowsOf(pool, EVERY_TABLE), before, 'nothing was written');
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
    const pid = async (examId: string, personId: string) => (await pool.query(
        'SELECT id FROM secure_assessment_exam_participants WHERE exam_instance_id = $1 AND person_id = $2', [examId, personId])).rows[0].id as string;
    const stateOf = async (examId: string) => (await pool.query('SELECT lifecycle_state FROM secure_assessment_exam_instances WHERE id = $1', [examId])).rows[0].lifecycle_state as string;
    const roomId = async (examId: string, label: string) => (await pool.query(
        'SELECT id FROM secure_assessment_exam_rooms WHERE exam_instance_id = $1 AND display_label = $2', [examId, label])).rows[0].id as string;
    /** The participant's current room row: its room label and version. */
    const placement = async (participantId: string) => {
        const r = (await pool.query(
            `SELECT r.display_label, ra.assignment_version FROM secure_assessment_exam_participant_room_assignments ra
             JOIN secure_assessment_exam_rooms r ON r.id = ra.exam_room_id WHERE ra.exam_participant_id = $1`, [participantId])).rows[0];
        return r ? { room: r.display_label as string, version: Number(r.assignment_version) } : null;
    };
    const remaining = async (attemptId: string) => (await pool.query(
        'SELECT secure_assessment_attempt_remaining_seconds(tenant_id, exam_attempt_id, statement_timestamp()) AS s FROM secure_assessment_timer_state WHERE exam_attempt_id = $1',
        [attemptId])).rows[0].s as number | null;

    // The Operator routes, each with a fresh action key unless one is given.
    const intent = (reason: string) => ({ reason, confirmed: true, actionKey: randomUUID() });
    const move = async (c: BrowserLikeClient, examInstanceId: string, participantId: string, targetRoomId: string, expectedAssignmentVersion: number, extra: Body = {}) =>
        keep(await post(c, MOVE, { examInstanceId, participantId, targetRoomId, expectedAssignmentVersion, ...intent(REASON), ...extra }));
    const transition = async (c: BrowserLikeClient, target: Body, action: string) =>
        keep(await post(c, `${SV}/transition`, { ...target, action, ...intent('Pelaksanaan ujian sekolah') }));
    const lockCtl = async (c: BrowserLikeClient, examInstanceId: string, participantId: string, action: string) =>
        keep(await post(c, `${SV}/participant-lock`, { examInstanceId, participantId, action, ...intent('Perangkat peserta bermasalah') }));
    const timeCtl = async (c: BrowserLikeClient, examInstanceId: string, participantId: string, minutes: number) =>
        keep(await post(c, `${SV}/add-time`, { examInstanceId, participantId, minutes, ...intent('Listrik padam di ruang ujian') }));
    const sessionRead = async (c: BrowserLikeClient, sessionId: string) => keep(await c.request(`${SV}?sessionId=${sessionId}`));
    const examRead = async (c: BrowserLikeClient, examId: string) => keep(await c.request(`${SV}/exam?examInstanceId=${examId}`));
    const monitoring = (c: BrowserLikeClient, examId: string) => c.request(`${MON}?examInstanceId=${examId}`);
    const proctorLock = (c: BrowserLikeClient, examInstanceId: string, participantId: string, action: string) =>
        post(c, `${MON}/participant-lock`, { examInstanceId, participantId, action, ...intent('Perangkat peserta bermasalah') });
    const transferRows = async (actionKey: string) => {
        const action = (await pool.query('SELECT * FROM secure_assessment_institution_room_actions WHERE action_key = $1', [actionKey])).rows[0];
        const entries = action ? (await pool.query('SELECT * FROM secure_assessment_institution_room_action_entries WHERE action_id = $1', [action.id])).rows : [];
        return { action, entries };
    };

    // A student's attempt on an open exam: start, an exam session and the timer, as the client does.
    interface StartedStudent {
        attemptId: string;
        sessionId: string;
        save(snapshotId: string, option: string, expectedWriteVersion?: number | null, session?: string): Promise<ClientResponse>;
        submit(): Promise<ClientResponse>;
        takeover(): Promise<ClientResponse & { previous: string; next: string }>;
    }
    const startStudent = async (client: BrowserLikeClient, examId: string, options: { timer?: boolean } = {}): Promise<StartedStudent> => {
        const started = await client.request('/api/v1/assessment/attempts/start', { method: 'POST', body: { examInstanceId: examId } });
        assert.equal(started.status, 201, JSON.stringify(started.body));
        const attemptId: string = started.body.attemptId;
        const sessionId = randomUUID();
        assert.equal((await client.request('/api/v1/assessment/session/activate', { method: 'POST', body: { attemptId, sessionId } })).status, 200);
        if (options.timer !== false) assert.equal((await client.request('/api/v1/assessment/timer/start', { method: 'POST', body: { attemptId } })).status, 200);
        const student: StartedStudent = {
            attemptId,
            sessionId,
            save: (snapshotId: string, option: string, expectedWriteVersion: number | null = null, session = student.sessionId) => client.request('/api/v1/assessment/answer/save', {
                method: 'POST',
                body: { attemptId, sessionId: session, snapshotId, answerPayload: { selectedOptionId: option }, clientWriteIdentity: randomUUID(), expectedWriteVersion },
            }),
            submit: () => client.request('/api/v1/assessment/submit', { method: 'POST', body: { attemptId } }),
            /** A takeover from another device or tab (D04.4-35): the new session supersedes the active one. */
            takeover: () => {
                const next = randomUUID();
                const previous = student.sessionId;
                return client.request('/api/v1/assessment/session/activate', {
                    method: 'POST', body: { attemptId, sessionId: next, confirmSupersede: true, expectedActiveSessionId: previous },
                }).then(r => { if (r.status === 200) student.sessionId = next; return { ...r, previous, next }; });
            },
        };
        return student;
    };
    /** Moves an attempt's start back so its server time has run out (fixture SQL, as expireAttemptOf). */
    const expire = (attemptId: string) => pool.query(
        `UPDATE secure_assessment_timer_state SET started_at = statement_timestamp() - (configured_duration_seconds + 60) * interval '1 second'
         WHERE exam_attempt_id = $1`, [attemptId]);
    /** Waits until the database clock has passed the current deadline of an exam. */
    const deadlinePassed = async (examId: string) => {
        for (let i = 0; i < 200; i++) {
            const r = await pool.query(
                `SELECT max(deadline_at) <= statement_timestamp() AS passed FROM secure_assessment_institution_preparation_deadlines WHERE exam_instance_id = $1`, [examId]);
            if (r.rows[0].passed === true) return;
            await sleep(1000);
        }
        throw new Error('The deadline did not pass.');
    };

    // Session S1 (D+3) through the product: E1 Matematika x X, E2 Fisika x Y, E3 Biologi x Z, deadlines about two minutes
    // ahead and questions stored before them; tenant 2's exam placed through its own Operator and opened by fixture SQL.
    const period1 = await createPeriod(o, 'PTS Pindah Ruang');
    const S1 = await createSession(o, period1, wibDay(3));
    const shortDeadline = wib(2);
    const E1 = await placeExam(o, S1, teaching.teachingAssignmentId, shortDeadline);
    const E2 = await placeExam(o, S1, physicsY, shortDeadline);
    const E3 = await placeExam(o, S1, biologyZ, shortDeadline);
    const e1Snapshots = await addQuestionSnapshots(pool, tenant, E1, 2);
    await addQuestionSnapshots(pool, tenant, E2, 2);
    await addQuestionSnapshots(pool, tenant, E3, 2);
    const foreignPeriod = await createPeriod(foreign, 'PTS Lain', foreignTeaching.assessmentTypeId, foreignAcademicPeriod);
    const foreignSession = await createSession(foreign, foreignPeriod, wibDay(3));
    const foreignExam = await placeExam(foreign, foreignSession, foreignTeaching.teachingAssignmentId, `${wibDay(1)}T20:00`);
    const foreignParticipant = await pid(foreignExam, foreignStudent.personId);
    const foreignRoom = (await pool.query('INSERT INTO secure_assessment_exam_rooms (tenant_id, exam_instance_id, display_label) VALUES ($1, $2, $3) RETURNING id',
        [otherTenant, foreignExam, 'Ruang 1'])).rows[0].id as string;
    await pool.query('INSERT INTO secure_assessment_exam_participant_room_assignments (tenant_id, exam_instance_id, exam_participant_id, exam_room_id) VALUES ($1, $2, $3, $4)',
        [otherTenant, foreignExam, foreignParticipant, foreignRoom]);
    await pool.query(`UPDATE secure_assessment_exam_instances SET lifecycle_state = 'ACTIVE' WHERE id = $1`, [foreignExam]);
    const E1s1 = await pid(E1, s1.personId), E1s2 = await pid(E1, s2.personId), E1s3 = await pid(E1, s3.personId);
    const E1s4 = await pid(E1, s4.personId), E1s5 = await pid(E1, s5.personId);
    const E2y1 = await pid(E2, y1.personId), E2y2 = await pid(E2, y2.personId), E3z1 = await pid(E3, z1.personId);

    // Rooms and Proctors through the product: "Ruang 1" {P1} with s1..s3 and y1, "Ruang 2" {P2} with s4 and s5, "Ruang 3"
    // {P3} with y2 (E2 only), "Ruang 4" {P4} with z1 (E3 only).
    ok(await place(S1, 'Ruang 1', [E1s1, E1s2, E1s3, E2y1]));
    ok(await place(S1, 'Ruang 2', [E1s4, E1s5]));
    ok(await place(S1, 'Ruang 3', [E2y2]));
    ok(await place(S1, 'Ruang 4', [E3z1]));
    ok(await proctors(S1, 'Ruang 1', ['pengawas.satu']));
    ok(await proctors(S1, 'Ruang 2', ['pengawas.dua']));
    ok(await proctors(S1, 'Ruang 3', ['pengawas.tiga']));
    ok(await proctors(S1, 'Ruang 4', ['pengawas.empat']));
    for (const exam of [E1, E2, E3]) await deadlinePassed(exam);
    for (const exam of [E1, E2, E3]) assert.deepEqual(ok(await post(o, `${P}/transition`, { examInstanceId: exam, action: 'mark_ready' })), { examInstanceId: exam, lifecycleState: 'READY' });
    // The windows of S1 open now (fixture SQL, as ASSESS-INSTITUTION-003 E16); E1 and E2 are opened through the Operator route.
    await pool.query(
        `UPDATE secure_assessment_exam_instances SET window_starts_at = statement_timestamp() - interval '10 minutes', window_ends_at = statement_timestamp() + interval '3 hours'
         WHERE id = ANY($1::uuid[])`, [[E1, E2, E3]]);
    for (const exam of [E1, E2]) assert.equal(ok(await transition(o, { examInstanceId: exam }, 'activate')).lifecycleState, 'ACTIVE');
    assert.deepEqual([await stateOf(E1), await stateOf(E2), await stateOf(E3)], ['ACTIVE', 'ACTIVE', 'READY']);
    const E1room1 = await roomId(E1, 'Ruang 1'), E1room2 = await roomId(E1, 'Ruang 2');
    const E2room1 = await roomId(E2, 'Ruang 1'), E2room3 = await roomId(E2, 'Ruang 3'), E3room4 = await roomId(E3, 'Ruang 4');

    // s1 started and saved with an active session; s2 not started; s3 submitted; s4 out of time (fixture timer); s5 working.
    const a1 = await startStudent(s1c, E1);
    assert.equal((await a1.save(e1Snapshots[0], 'A')).status, 200);
    const a3 = await startStudent(s3c, E1);
    const submitted3 = await a3.submit();
    assert.ok(submitted3.status >= 200 && submitted3.status < 300, JSON.stringify(submitted3.body));
    const a4 = await startStudent(s4c, E1);
    await expire(a4.attemptId);
    const a5 = await startStudent(s5c, E1);

    // Race exams (I-6 to I-15) and the I-4 fixture cases: each in a session of its own on its own day, built by fixture SQL.
    let raceDay = 10;
    type Staff = { personId: string };
    const raceExam = async (name: string, options: { rooms?: Array<[string, Staff | null]>; roomPolicy?: boolean; lifecycleState?: string; students?: number; placeIn?: number[] } = {}) => {
        const rooms = options.rooms ?? [['Ruang 1', p1], ['Ruang 2', p2]];
        const day = raceDay++;
        const sessionId = (await pool.query(
            `INSERT INTO secure_assessment_institution_exam_sessions (tenant_id, period_id, starts_at, ends_at, created_by_person_id, action_key, request_digest)
             VALUES ($1, $2, date_trunc('day', statement_timestamp()) + make_interval(days => $3), date_trunc('day', statement_timestamp()) + make_interval(days => $3, hours => 2),
                     $4, gen_random_uuid(), repeat('a', 64))
             RETURNING id`, [tenant, period1, day, operator.personId])).rows[0].id as string;
        const examId = (await pool.query(
            `INSERT INTO secure_assessment_exam_instances (tenant_id, teaching_assignment_id, assessment_type_id, lifecycle_state, window_starts_at, window_ends_at,
                configured_attempt_duration_seconds, latest_start_policy, room_based_operations_enabled, proctor_per_room_required, institution_session_id)
             VALUES ($1, $2, $3, 'SCHEDULED', statement_timestamp() - interval '10 minutes', statement_timestamp() + interval '3 hours', 3600,
                     'FULL_DURATION_BEYOND_WINDOW', $4, $4, $5)
             RETURNING id`, [tenant, teaching.teachingAssignmentId, teaching.assessmentTypeId, options.roomPolicy ?? true, sessionId])).rows[0].id as string;
        await pool.query(
            `INSERT INTO secure_assessment_institution_preparation_deadlines (tenant_id, exam_instance_id, revision, deadline_at, set_by_person_id, action_key, request_digest)
             VALUES ($1, $2, 1, statement_timestamp() + interval '1 hour', $3, gen_random_uuid(), repeat('a', 64))`, [tenant, examId, operator.personId]);
        const snapshots = await addQuestionSnapshots(pool, tenant, examId, 2);
        const roomIds = new Map<string, string>();
        for (const [label, proctor] of rooms) {
            const room = (await pool.query('INSERT INTO secure_assessment_exam_rooms (tenant_id, exam_instance_id, display_label) VALUES ($1, $2, $3) RETURNING id',
                [tenant, examId, label])).rows[0].id as string;
            roomIds.set(label, room);
            if (!proctor) continue;
            const assignment = (await pool.query('INSERT INTO secure_assessment_proctor_assignments (tenant_id, exam_instance_id, person_id) VALUES ($1, $2, $3) RETURNING id',
                [tenant, examId, proctor.personId])).rows[0].id as string;
            await pool.query('INSERT INTO secure_assessment_exam_proctor_room_assignments (tenant_id, exam_instance_id, proctor_assignment_id, exam_room_id) VALUES ($1, $2, $3, $4)',
                [tenant, examId, assignment, room]);
        }
        await pool.query('UPDATE secure_assessment_exam_instances SET lifecycle_state = $2 WHERE id = $1', [examId, options.lifecycleState ?? 'ACTIVE']);
        const students: Array<{ participantId: string; client: BrowserLikeClient }> = [];
        for (let i = 0; i < (options.students ?? 1); i++) {
            const person = await createPersonWithAccount(pool, `siswa.${name}.${i + 1}`);
            await addMembership(pool, tenant, person.personId);
            const participantId = await addParticipant(pool, tenant, examId, person.personId);
            const label = rooms[options.placeIn?.[i] ?? 0][0];
            await pool.query('INSERT INTO secure_assessment_exam_participant_room_assignments (tenant_id, exam_instance_id, exam_participant_id, exam_room_id) VALUES ($1, $2, $3, $4)',
                [tenant, examId, participantId, roomIds.get(label)]);
            students.push({ participantId, client: await login(person) });
        }
        return { examId, sessionId, snapshots, room: (label: string) => roomIds.get(label)!, students };
    };
    /** Holds a room row FOR UPDATE: a transfer to it stops after it holds the 0032 row and the attempt (OR-4 step 5 is last). */
    const holdRoom = (room: string) => hold(pool, [['SELECT id FROM secure_assessment_exam_rooms WHERE id = $1 FOR UPDATE', [room]]]);
    /** Holds an attempt FOR UPDATE after the exam FOR KEY SHARE, as every attempt writer does. */
    const holdAttempt = (examId: string, attemptId: string) => hold(pool, [
        ['SELECT id FROM secure_assessment_exam_instances WHERE id = $1 FOR KEY SHARE', [examId]],
        ['SELECT id FROM secure_assessment_exam_attempts WHERE id = $1 FOR UPDATE', [attemptId]],
    ]);

    // A save built while s1 is still in "Ruang 1" and sent after the move (I-2): the device's queued answer.
    const queuedSave = { attemptId: a1.attemptId, sessionId: a1.sessionId, snapshotId: e1Snapshots[0], answerPayload: { selectedOptionId: 'B' }, clientWriteIdentity: randomUUID(), expectedWriteVersion: 1 };
    const P1_MESSAGE = 'Pesan khusus untuk siswa satu.';

    await t.test('I-3 (before) P1 lists s1 and P2 does not; P1 messages s1 alone; the drill-down counts "Ruang 1" 3 and "Ruang 2" 2', async () => {
        const listed = (c: BrowserLikeClient) => monitoring(c, E1).then(r => ok(r));
        assert.ok((await listed(p1c)).participants.some((p: Body) => p.participantId === E1s1));
        assert.ok(!(await listed(p2c)).participants.some((p: Body) => p.participantId === E1s1));
        const sent = await post(p1c, `${MON}/broadcast`, { examInstanceId: E1, target: { scope: 'PARTICIPANTS', participantIds: [E1s1] }, message: P1_MESSAGE });
        assert.equal(sent.status, 200, JSON.stringify(sent.body));
        assert.ok((await listed(p1c)).broadcasts.some((b: Body) => b.message === P1_MESSAGE));
        assert.ok(!(await listed(p2c)).broadcasts.some((b: Body) => b.message === P1_MESSAGE));
        const e1 = ok(await sessionRead(o, S1)).exams.find((e: Body) => e.examInstanceId === E1);
        assert.deepEqual(e1.rooms.map((r: Body) => [r.label, r.counts.participants]), [['Ruang 1', 3], ['Ruang 2', 2]]);
    });

    let firstKey = '';
    let firstReceipt: Body = {};
    await t.test('I-1 O moves s1 from "Ruang 1" to "Ruang 2" with version 1: 200 version 2, one action and one entry, only the room row changes', async () => {
        const attemptBefore = await rowsOf(pool, [...ATTEMPT_SIDE, ...OTHER_SIDE]);
        const roomBefore = await rowsOf(pool, ROOM_SIDE);
        const remainingBefore = await remaining(a1.attemptId);
        const revision = await rev(S1);
        const started = Date.now();
        firstKey = randomUUID();
        firstReceipt = ok(await move(o, E1, E1s1, E1room2, 1, { actionKey: firstKey }));
        const elapsed = Math.ceil((Date.now() - started) / 1000) + 1;
        assert.deepEqual({ ...firstReceipt, transferredAt: null }, {
            examInstanceId: E1, participantId: E1s1, fromRoomLabel: 'Ruang 1', roomLabel: 'Ruang 2', assignmentVersion: 2, transferredAt: null, revision: revision + 1, replayed: false,
        });
        const { action, entries } = await transferRows(firstKey);
        assert.deepEqual([action.tenant_id, action.session_id, action.kind, action.revision, action.reason, action.confirmed, action.actor_person_id, action.demoted_exam_instance_ids],
            [tenant, S1, 'PARTICIPANT_TRANSFER', revision + 1, REASON, true, operator.personId, []]);
        assert.match(action.request_digest, /^[0-9a-f]{64}$/);
        assert.equal(new Date(action.acted_at).toISOString(), firstReceipt.transferredAt);
        assert.deepEqual(entries.map(e => [e.exam_instance_id, e.entry_kind, e.exam_participant_id, e.proctor_assignment_id, e.from_room_label, e.room_label, e.assignment_version, e.exam_attempt_id]),
            [[E1, 'PARTICIPANT_TRANSFER', E1s1, null, 'Ruang 1', 'Ruang 2', 2, a1.attemptId]]);
        assert.deepEqual(await placement(E1s1), { room: 'Ruang 2', version: 2 });
        // §4.6: every Attempt-side row (and every other row) is identical; one current row changed, one action and one entry appended.
        assert.deepEqual(changedTables(attemptBefore, await rowsOf(pool, [...ATTEMPT_SIDE, ...OTHER_SIDE])), []);
        const roomAfter = await rowsOf(pool, ROOM_SIDE);
        const current = 'secure_assessment_exam_participant_room_assignments';
        assert.equal(roomAfter[current].length, roomBefore[current].length);
        assert.equal(newRows(roomBefore[current], roomAfter[current]).length, 1, 'exactly one current row changed');
        assert.equal(newRows(roomAfter[current], roomBefore[current]).length, 1);
        for (const table of ['secure_assessment_institution_room_actions', 'secure_assessment_institution_room_action_entries']) {
            assert.equal(roomAfter[table].length, roomBefore[table].length + 1, table);
            assert.deepEqual(newRows(roomAfter[table], roomBefore[table]), [], `${table} is append-only`);
        }
        const remainingAfter = Number(await remaining(a1.attemptId));
        assert.ok(remainingAfter <= Number(remainingBefore) && Number(remainingBefore) - remainingAfter <= elapsed, `${remainingBefore} -> ${remainingAfter}`);
    });

    await t.test('I-2 session continuity: the queued and a new save with the same session, no new session, resume returns the same attempt, the list shows "Ruang 2"', async () => {
        const sessions = async () => (await pool.query('SELECT id, ended_at, superseded_by_session_id FROM secure_assessment_exam_sessions WHERE exam_attempt_id = $1', [a1.attemptId])).rows;
        assert.deepEqual(await sessions(), [{ id: a1.sessionId, ended_at: null, superseded_by_session_id: null }]);
        const queued = await s1c.request('/api/v1/assessment/answer/save', { method: 'POST', body: queuedSave });
        assert.deepEqual([queued.status, queued.body.status, queued.body.writeVersion], [200, 'acknowledged', 2], JSON.stringify(queued.body));
        const next = await a1.save(e1Snapshots[1], 'C');
        assert.deepEqual([next.status, next.body.writeVersion], [200, 1], JSON.stringify(next.body));
        assert.deepEqual(await sessions(), [{ id: a1.sessionId, ended_at: null, superseded_by_session_id: null }], 'no takeover, no new session row');
        const resumed = ok(await s1c.request(`/api/v1/assessment/resume?attemptId=${a1.attemptId}&examSessionId=${a1.sessionId}`));
        assert.deepEqual([resumed.attemptId, resumed.session.status, resumed.session.ownedByCaller, resumed.context.roomLabel], [a1.attemptId, 'active', true, 'Ruang 2']);
        assert.deepEqual(resumed.answers.map((a: Body) => `${a.snapshotId}:${a.answerPayload.selectedOptionId}`).sort(), [`${e1Snapshots[0]}:B`, `${e1Snapshots[1]}:C`].sort());
        const listed = ok(await s1c.request('/api/v1/assessment/assigned-exams'));
        assert.equal(listed.assignments.find((a: Body) => a.examInstanceId === E1).roomLabel, 'Ruang 2');
    });

    await t.test('I-3 (after) scope at commit: P1 loses s1 (list, lock, message), P2 gains s1 and may lock; the counts and the broadcast history follow the room', async () => {
        const p1List = ok(await monitoring(p1c, E1));
        assert.ok(!p1List.participants.some((p: Body) => p.participantId === E1s1), 'P1 no longer lists s1');
        await unchanged(async () => {
            assert.equal((await proctorLock(p1c, E1, E1s1, 'lock')).status, 403);
            const message = await post(p1c, `${MON}/broadcast`, { examInstanceId: E1, target: { scope: 'PARTICIPANTS', participantIds: [E1s1] }, message: 'Pesan kedua.' });
            assert.equal(message.status, 403, JSON.stringify(message.body));
        });
        const p2List = ok(await monitoring(p2c, E1));
        const seen = p2List.participants.find((p: Body) => p.participantId === E1s1);
        assert.deepEqual([seen.roomLabel, seen.status, seen.answeredCount], ['Ruang 2', 'ACTIVE', 2]);
        assert.equal(ok(await proctorLock(p2c, E1, E1s1, 'lock')).locked, true);
        assert.equal(ok(await proctorLock(p2c, E1, E1s1, 'unlock')).locked, false);
        const e1 = ok(await sessionRead(o, S1)).exams.find((e: Body) => e.examInstanceId === E1);
        assert.deepEqual(e1.rooms.map((r: Body) => [r.label, r.counts.participants]), [['Ruang 1', 2], ['Ruang 2', 3]]);
        // OR-3 supplement (E15): the history follows the current room.
        const shown = p2List.broadcasts.find((b: Body) => b.message === P1_MESSAGE);
        assert.ok(shown, 'P2 now sees the message s1 received in "Ruang 1"');
        assert.equal(shown.sender.elligbleId, 'pengawas.satu');
        assert.ok(!p1List.broadcasts.some((b: Body) => b.message === P1_MESSAGE), 'P1 no longer sees its message to s1 alone');
    });

    await t.test('I-16 reversal (D04.4-65): s1 back to "Ruang 1" with version 2 gets version 3 and a second entry; both entries remain', async () => {
        const back = ok(await move(o, E1, E1s1, E1room1, 2));
        assert.deepEqual([back.fromRoomLabel, back.roomLabel, back.assignmentVersion, back.replayed], ['Ruang 2', 'Ruang 1', 3, false]);
        assert.deepEqual(await placement(E1s1), { room: 'Ruang 1', version: 3 });
        const entries = (await pool.query(
            `SELECT from_room_label, room_label, assignment_version FROM secure_assessment_institution_room_action_entries
             WHERE exam_participant_id = $1 AND entry_kind = 'PARTICIPANT_TRANSFER' ORDER BY assignment_version`, [E1s1])).rows;
        assert.deepEqual(entries.map(e => [e.from_room_label, e.room_label, e.assignment_version]), [['Ruang 1', 'Ruang 2', 2], ['Ruang 2', 'Ruang 1', 3]]);
    });

    await t.test('I-7 replay and lost ACK: the same key and body return the original receipt; another body, a room route or another Operator get action_key_reused', async () => {
        const body = { examInstanceId: E1, participantId: E1s1, targetRoomId: E1room2, expectedAssignmentVersion: 1, reason: REASON, confirmed: true, actionKey: firstKey };
        await unchanged(async () => {
            const again = ok(keep(await post(o, MOVE, body)));
            assert.deepEqual(again, { ...firstReceipt, replayed: true }, 'the original body, never re-evaluated (s1 is back in "Ruang 1" now)');
            for (const [c, b] of [[o, { ...body, reason: 'Alasan lain' }], [o, { ...body, expectedAssignmentVersion: 3 }], [o2, body]] as Array<[BrowserLikeClient, Body]>) {
                const r = await post(c, MOVE, b);
                assert.deepEqual([r.status, r.body], [409, { error: 'action_key_reused' }], JSON.stringify(b));
            }
            const roomRoute = await post(o, `${R}/participants`, { sessionId: S1, roomLabel: 'Ruang 9', participantIds: [E3z1], expectedRevision: await rev(S1), actionKey: firstKey });
            assert.deepEqual([roomRoute.status, roomRoute.body], [409, { error: 'action_key_reused' }]);
        });
        // A room-route key on the transfer route is refused the same way (the sameAction kind check).
        const roomKey = (await pool.query(`SELECT action_key FROM secure_assessment_institution_room_actions WHERE session_id = $1 AND kind = 'ROOM_PARTICIPANTS' LIMIT 1`, [S1])).rows[0].action_key;
        await unchanged(async () => {
            const r = await move(o, E1, E1s5, E1room1, 1, { actionKey: roomKey });
            assert.deepEqual([r.status, r.body], [409, { error: 'action_key_reused' }]);
        });
    });

    await t.test('I-4 eligibility (O05-4, OR-1): not started, PAUSED, locked and a timer not started move; submitted, expired, READY, ENDED, FALSE/FALSE and no row refuse', async () => {
        // s2 has not started: the entry carries a NULL attempt.
        const key = randomUUID();
        assert.equal(ok(await move(o, E1, E1s2, E1room2, 1, { actionKey: key })).assignmentVersion, 2);
        assert.equal((await transferRows(key)).entries[0].exam_attempt_id, null);
        // E1 PAUSED: s5 moves, and its remaining time is identical before and after (N06).
        ok(await transition(o, { examInstanceId: E1 }, 'pause'));
        assert.equal(await stateOf(E1), 'PAUSED');
        const frozen = await remaining(a5.attemptId);
        assert.equal(ok(await move(o, E1, E1s5, E1room1, 1)).roomLabel, 'Ruang 1');
        assert.equal(await remaining(a5.attemptId), frozen, 'the time stays frozen while PAUSED');
        ok(await transition(o, { examInstanceId: E1 }, 'resume'));
        // A locked participant moves and stays locked.
        assert.equal(ok(await lockCtl(o, E1, E1s5, 'lock')).locked, true);
        assert.equal(ok(await move(o, E1, E1s5, E1room2, 2)).assignmentVersion, 3);
        const open = await pool.query('SELECT count(*)::int AS n FROM secure_assessment_attempt_locks WHERE exam_attempt_id = $1 AND unlocked_at IS NULL', [a5.attemptId]);
        assert.equal(open.rows[0].n, 1, 'the lock is unchanged');
        assert.equal(ok(await lockCtl(o, E1, E1s5, 'unlock')).locked, false);
        // A started attempt whose timer has not started (no remaining value) is eligible.
        const ay1 = await startStudent(y1c, E2, { timer: false });
        assert.equal(await remaining(ay1.attemptId), null);
        const y1Move = ok(await move(o, E2, E2y1, E2room3, 1));
        assert.deepEqual([y1Move.fromRoomLabel, y1Move.roomLabel], ['Ruang 1', 'Ruang 3']);
        // The refusals, each writing nothing.
        const ended = await raceExam('selesai', { lifecycleState: 'ENDED' });
        const flagless = await raceExam('tanpaflag', { roomPolicy: false });
        const roomless = await raceExam('tanparuang');
        await pool.query('DELETE FROM secure_assessment_exam_participant_room_assignments WHERE exam_participant_id = $1', [roomless.students[0].participantId]);
        await unchanged(async () => {
            const refused = async (exam: string, participant: string, target: string, version: number, expected: Body) => {
                const r = await move(o, exam, participant, target, version);
                assert.deepEqual([r.status, r.body], [409, expected], JSON.stringify(expected));
            };
            await refused(E1, E1s3, E1room2, 1, { error: 'attempt_already_submitted' });
            await refused(E1, E1s4, E1room1, 1, { error: 'time_up' });
            await refused(E3, E3z1, E3room4, 1, { error: 'invalid_state', examInstanceId: E3, currentState: 'READY' });
            await refused(ended.examId, ended.students[0].participantId, ended.room('Ruang 2'), 1, { error: 'invalid_state', examInstanceId: ended.examId, currentState: 'ENDED' });
            await refused(flagless.examId, flagless.students[0].participantId, flagless.room('Ruang 2'), 1, { error: 'room_setup_required' });
            await refused(roomless.examId, roomless.students[0].participantId, roomless.room('Ruang 2'), 1, { error: 'participant_without_room' });
        });
    });

    await t.test('I-5 target (OR-2): the current room is already_in_room; a room of another exam or tenant is 403 like a nonexistent id; a target whose Proctor was revoked is unsupervised', async () => {
        const version = (await placement(E1s5))!.version;
        await unchanged(async () => {
            const same = await move(o, E1, E1s5, E1room2, version);
            assert.deepEqual([same.status, same.body], [409, { error: 'already_in_room' }]);
            const others = [await move(o, E1, E1s5, E2room1, version), await move(o, E1, E1s5, E2room3, version), await move(o, E1, E1s5, foreignRoom, version), await move(o, E1, E1s5, randomUUID(), version)];
            for (const r of others) assert.deepEqual([r.status, r.body], [403, { error: 'forbidden' }]);
            assert.equal(new Set(others.map(r => JSON.stringify(r.body))).size, 1, 'N02 byte-identical');
        });
        const revoked = (await pool.query(
            `UPDATE secure_assessment_proctor_assignments SET revoked_at = statement_timestamp() WHERE exam_instance_id = $1 AND person_id = $2 AND revoked_at IS NULL RETURNING id`,
            [E1, p1.personId])).rows.map(r => r.id as string);
        assert.equal(revoked.length, 1);
        try {
            await unchanged(async () => {
                const r = await move(o, E1, E1s5, E1room1, version);
                assert.deepEqual([r.status, r.body], [409, { error: 'target_room_unsupervised' }]);
                const projection = ok(await examRead(o, E1));
                assert.deepEqual(projection.rooms.map((room: Body) => [room.label, room.supervised]), [['Ruang 1', false], ['Ruang 2', true]], 'E10 coverage');
            });
        } finally {
            await pool.query('UPDATE secure_assessment_proctor_assignments SET revoked_at = NULL WHERE id = ANY($1::uuid[])', [revoked]);
        }
    });

    await t.test('I-17 / §4.8 N01, N03, N04: every other role and school get 403, anonymous 401, an unavailable database 503, TM 403; an Operator who is also a Proctor moves as Operator', async () => {
        await operatorAssignment(pool, tenant, revokedOperator.personId, 'REVOKE');
        const version = (await placement(E1s5))!.version;
        const body = () => ({ examInstanceId: E1, participantId: E1s5, targetRoomId: E1room1, expectedAssignmentVersion: version, ...intent(REASON) });
        await unchanged(async () => {
            const refused: Array<[string, BrowserLikeClient]> = [
                ['O2 in this school', foreignInOurs], ['a revoked Operator', oRevoked], ['the subject Teacher', tc], ['the Teacher of TM', t2c], ['P1', p1c],
                ['P2, for a participant of its own room', p2c], ['a Homeroom Teacher', hc], ['s1', s1c], ['s2', s2c], ['actor A without a school role', ac],
            ];
            for (const [who, c] of refused) {
                const r = await post(c, MOVE, body());
                assert.deepEqual([r.status, r.body], [403, { error: 'forbidden' }], who);
            }
            const own = await post(foreign, MOVE, body());
            assert.deepEqual([own.status, own.body], [403, { error: 'forbidden' }], 'O2 in its own school');
            assert.equal((await post(anonymous, MOVE, body())).status, 401, 'anonymous');
            const tm = await move(o, TM, tmParticipant, E1room1, 1);
            assert.deepEqual([tm.status, tm.body], [403, { error: 'forbidden' }], 'a teacher-managed exam');
            // N01: an unavailable database gives 503 with nothing written.
            const unavailable = { connect: async () => { throw Object.assign(new Error('database unavailable'), { code: 'ECONNREFUSED' }); }, query: async () => { throw new Error('database unavailable'); } };
            const down = await startProductionWiredServer(unavailable as unknown as pg.Pool);
            try {
                const dc = new BrowserLikeClient(down.baseUrl);
                dc.cookie = o.cookie;
                dc.tenantId = tenant;
                const r = await post(dc, MOVE, body());
                assert.deepEqual([r.status, r.body], [503, { error: 'persistence_unavailable' }]);
            } finally {
                await down.close();
            }
        });
        // P03: O' is also the Proctor of "Ruang 1" of an exam and moves a participant of "Ruang 2" there, as Operator.
        const dual = await raceExam('ganda', { rooms: [['Ruang 1', operator2], ['Ruang 2', p2]], placeIn: [1] });
        const key = randomUUID();
        assert.equal(ok(await move(o2, dual.examId, dual.students[0].participantId, dual.room('Ruang 1'), 1, { actionKey: key })).roomLabel, 'Ruang 1');
        assert.equal((await transferRows(key)).action.actor_person_id, operator2.personId);
    });

    await t.test('I-18 substitution (N02): an exam, participant or room of another exam or tenant is 403, byte-identical with a nonexistent id', async () => {
        const version = (await placement(E1s5))!.version;
        await unchanged(async () => {
            const answers = [
                await move(o, foreignExam, foreignParticipant, foreignRoom, 1), await move(o, randomUUID(), E1s5, E1room1, version),
                await move(o, E1, E2y2, E1room1, 1), await move(o, E1, foreignParticipant, E1room1, 1), await move(o, E1, randomUUID(), E1room1, 1),
                await move(o, E1, E1s5, E2room1, version), await move(o, E1, E1s5, foreignRoom, version), await move(o, E1, E1s5, randomUUID(), version),
                await move(foreign, E1, E1s5, E1room1, version), await move(foreign, foreignExam, foreignParticipant, E1room1, 1),
            ];
            for (const r of answers) assert.deepEqual([r.status, r.body], [403, { error: 'forbidden' }]);
            assert.equal(new Set(answers.map(r => JSON.stringify(r.body))).size, 1);
        });
    });

    await t.test('I-19 exact body (N08): extra keys, a missing or 201-character reason, confirmed false or a bad version give 400 with nothing written', async () => {
        const version = (await placement(E1s5))!.version;
        const base = { examInstanceId: E1, participantId: E1s5, targetRoomId: E1room1, expectedAssignmentVersion: version, reason: REASON, confirmed: true, actionKey: randomUUID() };
        const { reason: _reason, ...noReason } = base;
        const { confirmed: _confirmed, ...noConfirmation } = base;
        await unchanged(async () => {
            for (const b of [
                { ...base, actorPersonId: operator.personId }, { ...base, tenantId: tenant }, { ...base, sessionId: S1 }, noReason, noConfirmation,
                { ...base, reason: 'x'.repeat(201) }, { ...base, reason: '   ' }, { ...base, confirmed: false }, { ...base, confirmed: 'true' },
                { ...base, expectedAssignmentVersion: 0 }, { ...base, expectedAssignmentVersion: '1' }, { ...base, targetRoomId: 'Ruang 1' },
            ] as Body[]) {
                const r = await post(o, MOVE, b);
                assert.deepEqual([r.status, r.body], [400, { error: 'invalid_request' }], JSON.stringify(Object.keys(b)));
            }
        });
    });

    await t.test('I-22 the edge (N10): a disallowed Origin and a 65 KiB body are refused before any effect', async () => {
        await unchanged(async () => {
            const foreignOrigin = await o.request(MOVE, { method: 'POST', body: { examInstanceId: E1 }, origin: 'https://lain.example' });
            assert.deepEqual([foreignOrigin.status, foreignOrigin.body], [403, { error: 'origin_not_allowed' }]);
            const large = await o.request(MOVE, { method: 'POST', rawBody: JSON.stringify({ reason: 'x'.repeat(65 * 1024) }), headers: { 'Content-Type': 'application/json' } });
            assert.deepEqual([large.status, large.body], [413, { error: 'payload_too_large' }]);
        });
    });

    // ---------------------------------------------------------------------------------------------
    // The approved concurrency cases I-6 to I-15 (OR-5), each on a running exam of its own.

    /** A transaction held open by the test, running its own statements first. */
    const holdWith = async (run: (c: pg.PoolClient) => Promise<unknown>): Promise<Held> => {
        const client = await pool.connect();
        let open = true;
        const end = async (sql: 'COMMIT' | 'ROLLBACK') => {
            if (!open) return;
            open = false;
            try { await client.query(sql); } finally { client.release(); }
        };
        try {
            await client.query('BEGIN');
            await run(client);
        } catch (error) {
            await end('ROLLBACK').catch(() => {});
            throw error;
        }
        return { client, commit: () => end('COMMIT'), rollback: () => end('ROLLBACK') };
    };
    /** Records the order in which requests complete. */
    const track = <T>(pending: Promise<T>, name: string, order: string[]) => { pending.then(() => order.push(name), () => order.push(`${name}:failed`)); return pending; };
    /** §4.6 in a race: the Attempt side changed only where the other writer wrote. */
    const onlyChanged = async (before: Snapshot, allowed: string[], label: string) => {
        const changed = changedTables(before, await rowsOf(pool, ATTEMPT_SIDE));
        assert.deepEqual(changed.filter(table => !allowed.includes(table)), [], `${label}: changed ${JSON.stringify(changed)}`);
    };
    const transferCount = async (sessionId: string) => (await pool.query(
        `SELECT count(*)::int AS n FROM secure_assessment_institution_room_actions WHERE session_id = $1 AND kind = 'PARTICIPANT_TRANSFER'`, [sessionId])).rows[0].n as number;

    await t.test('I-6 stale and opposed transfers (A04-2): a stale version names the current one; O and O\' at once give one 200 and one stale; a room-screen write with the old revision is stale', async () => {
        const x = await raceExam('serentak', { rooms: [['Ruang 1', p1], ['Ruang 2', p2], ['Ruang 3', p3]] });
        const s = x.students[0].participantId;
        await unchanged(async () => {
            const stale = await move(o, x.examId, s, x.room('Ruang 2'), 2);
            assert.deepEqual([stale.status, stale.body], [409, { error: 'stale_assignment', assignmentVersion: 1, roomLabel: 'Ruang 1' }]);
        });
        const before = await rowsOf(pool, ATTEMPT_SIDE);
        // Both requests queue on the session lock, then run one after the other.
        const held = await hold(pool, [[`SELECT pg_advisory_xact_lock(hashtext('sa-institution-rooms:' || $1::text || ':' || $2::text))`, [tenant, x.sessionId]]]);
        let first: Promise<ClientResponse> | undefined;
        let second: Promise<ClientResponse> | undefined;
        try {
            first = move(o, x.examId, s, x.room('Ruang 2'), 1);
            await lockWaiters(pool, 1, [first]);
            second = move(o2, x.examId, s, x.room('Ruang 3'), 1);
            await lockWaiters(pool, 2, [first, second]);
        } finally {
            await held.commit();
        }
        const results = [await bounded(first!, 'O'), await bounded(second!, "O'")];
        assert.deepEqual(results.map(r => r.status).sort(), [200, 409]);
        const winner = results.find(r => r.status === 200)!;
        const loser = results.find(r => r.status === 409)!;
        assert.deepEqual(loser.body, { error: 'stale_assignment', assignmentVersion: 2, roomLabel: winner.body.roomLabel });
        assert.deepEqual(await placement(s), { room: winner.body.roomLabel, version: 2 });
        assert.equal(await transferCount(x.sessionId), 1);
        await onlyChanged(before, [], 'opposed transfers');
        await unchanged(async () => {
            const r = await post(o, `${R}/participants`, { sessionId: x.sessionId, roomLabel: 'Ruang 1', participantIds: [s], expectedRevision: 0, actionKey: randomUUID() });
            assert.deepEqual([r.status, r.body], [409, { error: 'stale_assignment', revision: 1 }], 'ASSESS-INSTITUTION-002 E5');
        });
    });

    await t.test('I-8 save race: a save holding the attempt finishes and the waiting transfer commits; a transfer holding it finishes before the save', async () => {
        const x = await raceExam('simpan');
        const s = x.students[0];
        const a = await startStudent(s.client, x.examId);
        assert.equal((await a.save(x.snapshots[0], 'A')).status, 200);
        // Save first: the save holds the attempt and waits on its answer row (held here); the transfer waits on the attempt.
        let before = await rowsOf(pool, ATTEMPT_SIDE);
        let order: string[] = [];
        let save: Promise<ClientResponse> | undefined;
        let transfer: Promise<ClientResponse> | undefined;
        let held = await hold(pool, [['SELECT id FROM secure_assessment_exam_answers WHERE exam_attempt_id = $1 FOR UPDATE', [a.attemptId]]]);
        try {
            save = track(a.save(x.snapshots[0], 'B', 1), 'save', order);
            await lockWaiters(pool, 1, [save]);
            transfer = track(move(o, x.examId, s.participantId, x.room('Ruang 2'), 1), 'transfer', order);
            await lockWaiters(pool, 2, [save, transfer]);
        } finally {
            await held.commit();
        }
        assert.deepEqual([(await bounded(save!, 'save')).body.writeVersion, (await bounded(transfer!, 'transfer')).body.assignmentVersion], [2, 2]);
        assert.deepEqual(order, ['save', 'transfer']);
        await onlyChanged(before, ['secure_assessment_exam_answers'], 'save first');
        // Transfer first: the transfer holds the attempt and waits on its target room (held here); the save waits on the attempt.
        before = await rowsOf(pool, ATTEMPT_SIDE);
        order = [];
        held = await holdRoom(x.room('Ruang 1'));
        try {
            transfer = track(move(o, x.examId, s.participantId, x.room('Ruang 1'), 2), 'transfer', order);
            await lockWaiters(pool, 1, [transfer]);
            save = track(a.save(x.snapshots[0], 'C', 2), 'save', order);
            await lockWaiters(pool, 2, [transfer, save]);
        } finally {
            await held.commit();
        }
        assert.deepEqual([(await bounded(transfer!, 'transfer')).body.assignmentVersion, (await bounded(save!, 'save')).body.writeVersion], [3, 3]);
        assert.deepEqual(order, ['transfer', 'save']);
        await onlyChanged(before, ['secure_assessment_exam_answers'], 'transfer first');
        const stored = (await pool.query('SELECT answer_payload FROM secure_assessment_exam_answers WHERE exam_attempt_id = $1', [a.attemptId])).rows;
        assert.deepEqual(stored.map(r => r.answer_payload.selectedOptionId), ['C'], 'every accepted answer is kept as saved');
    });

    await t.test('I-9 submit and expiry, both orders (F1): a submit or the finalizer that commits while the transfer waits is seen by the re-read; a transfer holding the attempt goes first', async () => {
        const x = await raceExam('kumpul', { students: 4 });
        const [first, second, third, fourth] = await Promise.all(x.students.map(s => startStudent(s.client, x.examId)));
        const room2 = x.room('Ruang 2');
        // Submit first: the submit holds the attempt and inserts its submission; the transfer waits, then refuses.
        let roomBefore = await rowsOf(pool, ROOM_SIDE);
        let held = await hold(pool, [
            ['SELECT id FROM secure_assessment_exam_instances WHERE id = $1 FOR KEY SHARE', [x.examId]],
            ['SELECT id FROM secure_assessment_exam_attempts WHERE id = $1 FOR UPDATE', [first.attemptId]],
            [`INSERT INTO secure_assessment_exam_submissions (tenant_id, exam_attempt_id, finalization_source) VALUES ($1, $2, 'STUDENT_SUBMIT')`, [tenant, first.attemptId]],
        ]);
        let transfer: Promise<ClientResponse> | undefined;
        try {
            transfer = move(o, x.examId, x.students[0].participantId, room2, 1);
            await lockWaiters(pool, 1, [transfer]);
        } finally {
            await held.commit();
        }
        let r = await bounded(transfer!, 'transfer after a submit');
        assert.deepEqual([r.status, r.body], [409, { error: 'attempt_already_submitted' }]);
        assert.deepEqual(await rowsOf(pool, ROOM_SIDE), roomBefore, 'nothing written');
        // Transfer first: the submit waits on the attempt and succeeds after the move.
        let before = await rowsOf(pool, ATTEMPT_SIDE);
        const order: string[] = [];
        held = await holdRoom(room2);
        let submit: Promise<ClientResponse> | undefined;
        try {
            transfer = track(move(o, x.examId, x.students[1].participantId, room2, 1), 'transfer', order);
            await lockWaiters(pool, 1, [transfer]);
            submit = track(second.submit(), 'submit', order);
            await lockWaiters(pool, 2, [transfer, submit]);
        } finally {
            await held.commit();
        }
        assert.equal((await bounded(transfer!, 'transfer before a submit')).status, 200);
        const submitted = await bounded(submit!, 'submit after the transfer');
        assert.ok(submitted.status >= 200 && submitted.status < 300, JSON.stringify(submitted.body));
        assert.deepEqual(order, ['transfer', 'submit']);
        await onlyChanged(before, ['secure_assessment_exam_submissions'], 'transfer then submit');
        // Finalizer first: the finalizer holds an expired attempt and inserts its submission; the waiting transfer's re-read refuses.
        await expire(third.attemptId);
        roomBefore = await rowsOf(pool, ROOM_SIDE);
        held = await holdWith(async c => {
            const swept = await finalizeExpiredAttempts({ query: (sql: string, params: unknown[]) => c.query(sql, params) } as unknown as pg.Pool);
            assert.ok(swept.finalized >= 1);
        });
        try {
            transfer = move(o, x.examId, x.students[2].participantId, room2, 1);
            await lockWaiters(pool, 1, [transfer]);
        } finally {
            await held.commit();
        }
        r = await bounded(transfer!, 'transfer after the finalizer');
        assert.deepEqual([r.status, r.body], [409, { error: 'attempt_already_submitted' }], 'the submission is seen, not time_up');
        assert.deepEqual(await rowsOf(pool, ROOM_SIDE), roomBefore, 'nothing written');
        // Transfer first, finalizer second: the attempt expires after the re-read; the finalizer skips the held attempt and
        // submits it on its next run, with the new room.
        held = await holdRoom(room2);
        try {
            transfer = move(o, x.examId, x.students[3].participantId, room2, 1);
            await lockWaiters(pool, 1, [transfer]);
            await expire(fourth.attemptId);
            await finalizeExpiredAttempts(pool);
            const pending = await pool.query('SELECT count(*)::int AS n FROM secure_assessment_exam_submissions WHERE exam_attempt_id = $1', [fourth.attemptId]);
            assert.equal(pending.rows[0].n, 0, 'SKIP LOCKED: the held attempt is left for the next run');
        } finally {
            await held.commit();
        }
        assert.equal((await bounded(transfer!, 'transfer before the finalizer')).body.roomLabel, 'Ruang 2');
        await finalizeExpiredAttempts(pool);
        const finalized = await pool.query('SELECT finalization_source FROM secure_assessment_exam_submissions WHERE exam_attempt_id = $1', [fourth.attemptId]);
        assert.deepEqual(finalized.rows.map(row => row.finalization_source), ['EXPIRY_SERVER']);
        assert.deepEqual(await placement(x.students[3].participantId), { room: 'Ruang 2', version: 2 });
    });

    await t.test('I-10 Proctor lock race (OR-4): the Proctor first locks and the move keeps the lock; the transfer first leaves the old Proctor 403 with nothing written', async () => {
        const x = await raceExam('kunci', { students: 2, placeIn: [1, 1] });
        const [first, second] = await Promise.all(x.students.map(s => startStudent(s.client, x.examId)));
        const room1 = x.room('Ruang 1');
        // Proctor first: P2 holds the "Ruang 2" rows FOR SHARE and waits on the attempt (held here); the transfer waits on the row.
        let before = await rowsOf(pool, ATTEMPT_SIDE);
        let held = await holdAttempt(x.examId, first.attemptId);
        let lock: Promise<ClientResponse> | undefined;
        let transfer: Promise<ClientResponse> | undefined;
        const order: string[] = [];
        try {
            lock = track(proctorLock(p2c, x.examId, x.students[0].participantId, 'lock'), 'lock', order);
            await lockWaiters(pool, 1, [lock]);
            transfer = track(move(o, x.examId, x.students[0].participantId, room1, 1), 'transfer', order);
            await lockWaiters(pool, 2, [lock, transfer]);
        } finally {
            await held.commit();
        }
        assert.equal((await bounded(lock!, 'Proctor lock')).body.locked, true);
        assert.equal((await bounded(transfer!, 'transfer after the lock')).body.roomLabel, 'Ruang 1');
        assert.deepEqual(order, ['lock', 'transfer']);
        const kept = await pool.query('SELECT count(*)::int AS n FROM secure_assessment_attempt_locks WHERE exam_attempt_id = $1 AND unlocked_at IS NULL', [first.attemptId]);
        assert.equal(kept.rows[0].n, 1, 'the lock is kept');
        await onlyChanged(before, ['secure_assessment_attempt_locks'], 'Proctor first');
        // Transfer first: the Proctor waits on the moved row; the re-checked join no longer matches its room.
        before = await rowsOf(pool, ATTEMPT_SIDE);
        const permissionEvents = (await pool.query('SELECT count(*)::int AS n FROM secure_assessment_permission_action_events')).rows[0].n;
        held = await holdRoom(room1);
        try {
            transfer = move(o, x.examId, x.students[1].participantId, room1, 1);
            await lockWaiters(pool, 1, [transfer]);
            lock = proctorLock(p2c, x.examId, x.students[1].participantId, 'lock');
            await lockWaiters(pool, 2, [transfer, lock]);
        } finally {
            await held.commit();
        }
        assert.equal((await bounded(transfer!, 'transfer before the lock')).status, 200);
        const refused = await bounded(lock!, 'Proctor lock after the transfer');
        assert.deepEqual([refused.status, refused.body], [403, { error: 'forbidden' }]);
        await onlyChanged(before, [], 'transfer first');
        assert.equal((await pool.query('SELECT count(*)::int AS n FROM secure_assessment_permission_action_events')).rows[0].n, permissionEvents, 'the refused lock wrote nothing');
        assert.equal(second.attemptId.length, 36);
    });

    await t.test('I-11 takeover race: activation with takeover and the transfer commit in either order; the active session is the takeover\'s; a superseded session is still refused', async () => {
        const x = await raceExam('ambilalih');
        const s = x.students[0];
        const a = await startStudent(s.client, x.examId);
        // Activation first.
        let before = await rowsOf(pool, ATTEMPT_SIDE);
        let held = await holdAttempt(x.examId, a.attemptId);
        let takeover: ReturnType<typeof a.takeover> | undefined;
        let transfer: Promise<ClientResponse> | undefined;
        try {
            takeover = a.takeover();
            await lockWaiters(pool, 1, [takeover]);
            transfer = move(o, x.examId, s.participantId, x.room('Ruang 2'), 1);
            await lockWaiters(pool, 2, [takeover, transfer]);
        } finally {
            await held.commit();
        }
        const firstTakeover = await bounded(takeover!, 'takeover');
        assert.equal(firstTakeover.status, 200, JSON.stringify(firstTakeover.body));
        assert.equal((await bounded(transfer!, 'transfer after the takeover')).status, 200);
        await onlyChanged(before, ['secure_assessment_exam_sessions'], 'activation first');
        // Transfer first.
        before = await rowsOf(pool, ATTEMPT_SIDE);
        held = await holdRoom(x.room('Ruang 1'));
        try {
            transfer = move(o, x.examId, s.participantId, x.room('Ruang 1'), 2);
            await lockWaiters(pool, 1, [transfer]);
            takeover = a.takeover();
            await lockWaiters(pool, 2, [transfer, takeover]);
        } finally {
            await held.commit();
        }
        assert.equal((await bounded(transfer!, 'transfer before the takeover')).status, 200);
        const secondTakeover = await bounded(takeover!, 'takeover after the transfer');
        assert.equal(secondTakeover.status, 200, JSON.stringify(secondTakeover.body));
        await onlyChanged(before, ['secure_assessment_exam_sessions'], 'transfer first');
        const active = await pool.query('SELECT id FROM secure_assessment_exam_sessions WHERE exam_attempt_id = $1 AND activated_at IS NOT NULL AND ended_at IS NULL', [a.attemptId]);
        assert.deepEqual(active.rows.map(r => r.id), [secondTakeover.next]);
        // N06: the superseded device session is still refused after the move; the current one saves.
        const old = await a.save(x.snapshots[0], 'A', null, secondTakeover.previous);
        assert.deepEqual([old.status, old.body], [409, { error: 'session_not_active' }]);
        assert.equal((await a.save(x.snapshots[0], 'A')).status, 200);
        assert.deepEqual(await placement(s.participantId), { room: 'Ruang 1', version: 3 });
    });

    await t.test('I-12 session and exam controls: a session-wide pause and a transfer serialize on the session lock; a per-exam resume and a transfer on the exam row', async () => {
        const x = await raceExam('kendali');
        const s = x.students[0];
        await startStudent(s.client, x.examId);
        let before = await rowsOf(pool, ATTEMPT_SIDE);
        let held = await hold(pool, [[`SELECT pg_advisory_xact_lock(hashtext('sa-institution-rooms:' || $1::text || ':' || $2::text))`, [tenant, x.sessionId]]]);
        let control: Promise<ClientResponse> | undefined;
        let transfer: Promise<ClientResponse> | undefined;
        try {
            control = transition(o2, { sessionId: x.sessionId }, 'pause');
            await lockWaiters(pool, 1, [control]);
            transfer = move(o, x.examId, s.participantId, x.room('Ruang 2'), 1);
            await lockWaiters(pool, 2, [control, transfer]);
        } finally {
            await held.commit();
        }
        const paused = await bounded(control!, 'session-wide pause');
        assert.deepEqual([paused.status, paused.body.results.map((e: Body) => [e.examInstanceId, e.outcome])], [200, [[x.examId, 'APPLIED']]]);
        assert.equal((await bounded(transfer!, 'transfer behind the session lock')).body.assignmentVersion, 2);
        assert.equal(await stateOf(x.examId), 'PAUSED');
        await onlyChanged(before, ['secure_assessment_exam_pauses', 'secure_assessment_timer_state'], 'session-wide pause');
        // A per-exam resume holds the exam row FOR UPDATE; the transfer's FOR KEY SHARE waits behind it.
        before = await rowsOf(pool, ATTEMPT_SIDE);
        held = await hold(pool, [['SELECT id FROM secure_assessment_exam_instances WHERE id = $1 FOR UPDATE', [x.examId]]]);
        try {
            control = transition(o2, { examInstanceId: x.examId }, 'resume');
            await lockWaiters(pool, 1, [control]);
            transfer = move(o, x.examId, s.participantId, x.room('Ruang 1'), 2);
            await lockWaiters(pool, 2, [control, transfer]);
        } finally {
            await held.commit();
        }
        assert.deepEqual(ok(await bounded(control!, 'per-exam resume')), { examInstanceId: x.examId, lifecycleState: 'ACTIVE', changed: true, replayed: false });
        assert.equal((await bounded(transfer!, 'transfer behind the exam row')).body.assignmentVersion, 3);
        assert.equal(await stateOf(x.examId), 'ACTIVE');
        await onlyChanged(before, ['secure_assessment_exam_pauses', 'secure_assessment_timer_state'], 'per-exam resume');
        const revisions = (await pool.query('SELECT revision FROM secure_assessment_institution_room_actions WHERE session_id = $1 ORDER BY revision', [x.sessionId])).rows.map(r => r.revision);
        assert.deepEqual(revisions, [1, 2], 'revisions stay unique and dense');
    });

    await t.test('I-13 the Operator\'s own lock and added time, both orders: both commit; the lock and the 0050 rows are intact and the move changed neither', async () => {
        const x = await raceExam('operator');
        const s = x.students[0];
        const a = await startStudent(s.client, x.examId);
        const before = await rowsOf(pool, ATTEMPT_SIDE);
        // Each run: the Operator control first (it waits on the held attempt first), or the transfer first (held on its target room).
        const run = async (label: string, control: () => Promise<ClientResponse>, target: string, version: number, controlFirst: boolean) => {
            const order: string[] = [];
            const held = controlFirst ? await holdAttempt(x.examId, a.attemptId) : await holdRoom(x.room(target));
            let c: Promise<ClientResponse> | undefined;
            let m: Promise<ClientResponse> | undefined;
            try {
                if (controlFirst) {
                    c = track(control(), 'control', order);
                    await lockWaiters(pool, 1, [c]);
                    m = track(move(o, x.examId, s.participantId, x.room(target), version), 'transfer', order);
                } else {
                    m = track(move(o, x.examId, s.participantId, x.room(target), version), 'transfer', order);
                    await lockWaiters(pool, 1, [m]);
                    c = track(control(), 'control', order);
                }
                await lockWaiters(pool, 2, [c, m]);
            } finally {
                await held.commit();
            }
            const controlled = ok(await bounded(c!, `${label}: control`));
            assert.equal((await bounded(m!, `${label}: transfer`)).body.assignmentVersion, version + 1);
            assert.deepEqual(order, controlFirst ? ['control', 'transfer'] : ['transfer', 'control'], label);
            return controlled;
        };
        assert.equal((await run('lock first', () => lockCtl(o2, x.examId, s.participantId, 'lock'), 'Ruang 2', 1, true)).locked, true);
        assert.equal((await run('transfer before unlock', () => lockCtl(o2, x.examId, s.participantId, 'unlock'), 'Ruang 1', 2, false)).locked, false);
        assert.equal((await run('added time first', () => timeCtl(o2, x.examId, s.participantId, 10), 'Ruang 2', 3, true)).addedSeconds, 600);
        assert.equal((await run('transfer before added time', () => timeCtl(o2, x.examId, s.participantId, 10), 'Ruang 1', 4, false)).totalAddedSeconds, 1200);
        await onlyChanged(before, ['secure_assessment_attempt_locks', 'secure_assessment_timer_adjustments'], 'Operator controls');
        const locks = (await pool.query('SELECT locked_by_person_id, unlocked_by_person_id FROM secure_assessment_attempt_locks WHERE exam_attempt_id = $1', [a.attemptId])).rows;
        assert.deepEqual(locks, [{ locked_by_person_id: operator2.personId, unlocked_by_person_id: operator2.personId }]);
        const added = (await pool.query(
            `SELECT adj.adjustment_seconds FROM secure_assessment_timer_adjustments adj JOIN secure_assessment_timer_state t ON t.id = adj.timer_state_id
             WHERE t.exam_attempt_id = $1`, [a.attemptId])).rows;
        assert.deepEqual(added.map(r => r.adjustment_seconds), [600, 600]);
        assert.deepEqual(await placement(s.participantId), { room: 'Ruang 1', version: 5 });
    });

    await t.test('I-14 start race: a start holding the participant row commits first and the transfer records a NULL attempt; a start after the move succeeds; one attempt each', async () => {
        const x = await raceExam('mulai', { students: 2 });
        const [a, b] = x.students;
        const before = await rowsOf(pool, ATTEMPT_SIDE);
        // The start holds the participant row FOR UPDATE and waits for the exam FOR SHARE (held here FOR NO KEY UPDATE, which
        // a FOR KEY SHARE passes); the transfer reads no attempt and waits at its entry's participant key share.
        const held = await hold(pool, [['SELECT id FROM secure_assessment_exam_instances WHERE id = $1 FOR NO KEY UPDATE', [x.examId]]]);
        const order: string[] = [];
        const key = randomUUID();
        let start: Promise<ClientResponse> | undefined;
        let transfer: Promise<ClientResponse> | undefined;
        try {
            start = track(a.client.request('/api/v1/assessment/attempts/start', { method: 'POST', body: { examInstanceId: x.examId } }), 'start', order);
            await lockWaiters(pool, 1, [start]);
            transfer = track(move(o, x.examId, a.participantId, x.room('Ruang 2'), 1, { actionKey: key }), 'transfer', order);
            await lockWaiters(pool, 2, [start, transfer]);
        } finally {
            await held.commit();
        }
        assert.equal((await bounded(start!, 'start')).status, 201);
        assert.equal((await bounded(transfer!, 'transfer behind the start')).status, 200);
        assert.deepEqual(order, ['start', 'transfer']);
        assert.equal((await transferRows(key)).entries[0].exam_attempt_id, null, 'R13: the entry records no attempt');
        // The opposite order: the move, then the start.
        const otherKey = randomUUID();
        assert.equal(ok(await move(o, x.examId, b.participantId, x.room('Ruang 2'), 1, { actionKey: otherKey })).roomLabel, 'Ruang 2');
        assert.equal((await b.client.request('/api/v1/assessment/attempts/start', { method: 'POST', body: { examInstanceId: x.examId } })).status, 201);
        assert.equal((await transferRows(otherKey)).entries[0].exam_attempt_id, null);
        for (const p of [a, b]) {
            assert.equal((await pool.query('SELECT count(*)::int AS n FROM secure_assessment_exam_attempts WHERE exam_participant_id = $1', [p.participantId])).rows[0].n, 1);
            assert.deepEqual(await placement(p.participantId), { room: 'Ruang 2', version: 2 });
        }
        await onlyChanged(before, ['secure_assessment_exam_attempts', 'secure_assessment_timer_state'], 'start race');
    });

    await t.test('I-15 / N07 authority at commit: an Operator assignment revoked while the transfer waits on it gives 403 with nothing written', async () => {
        const waiting = await staff('operator.menunggu');
        await operatorAssignment(pool, tenant, waiting.personId, 'ASSIGN');
        const ow = await login(waiting);
        const x = await raceExam('cabut');
        const before = await rowsOf(pool, EVERY_TABLE);
        const revoker = await pool.connect();
        try {
            await revoker.query('BEGIN');
            await setSchoolOperator(revoker, { tenantId: tenant, personId: waiting.personId, action: 'REVOKE', operator: 'Synthetic CI operator', caseReference: 'ASSESS-ROOM-001', reason: 'Synthetic revocation' });
            const pending = move(ow, x.examId, x.students[0].participantId, x.room('Ruang 2'), 1);
            await lockWaiters(pool, 1, [pending]);
            await revoker.query('COMMIT');
            const r = await bounded(pending, 'transfer behind the revocation');
            assert.deepEqual([r.status, r.body], [403, { error: 'forbidden' }]);
        } catch (error) {
            await revoker.query('ROLLBACK').catch(() => {});
            throw error;
        } finally {
            revoker.release();
        }
        assert.deepEqual(await rowsOf(pool, EVERY_TABLE), before);
        assert.deepEqual(await placement(x.students[0].participantId), { room: 'Ruang 1', version: 1 });
    });

    await t.test('I-20 minimization (F5): no transfer receipt or Operator projection carries a name, session, fingerprint, answer, score or reason; the E10 fields are the Operator\'s only', async () => {
        const operatorViews = [ok(await examRead(o, E1)), ok(await examRead(o2, E2))];
        const transfers = receipts.filter((b): b is Body => typeof b === 'object' && b !== null && 'fromRoomLabel' in b);
        assert.ok(transfers.length >= 10, String(transfers.length));
        for (const body of transfers) {
            assert.deepEqual(Object.keys(body).sort(), ['assignmentVersion', 'examInstanceId', 'fromRoomLabel', 'participantId', 'replayed', 'revision', 'roomLabel', 'transferredAt']);
        }
        const keys = keysOf([...transfers, ...operatorViews]);
        for (const key of ['fullName', 'name', 'nis', 'nisn', 'birthDate', 'sessionId', 'activeSessionFingerprint', 'answer', 'score', 'reason']) assert.equal(keys.has(key), false, key);
        assert.equal(JSON.stringify([...transfers, ...operatorViews]).includes(REASON), false, 'no reason text');
        for (const view of operatorViews) {
            assert.ok(view.participants.every((p: Body) => typeof p.roomId === 'string' && Number.isInteger(p.assignmentVersion)), 'roomId and version per participant');
            assert.ok(view.rooms.every((r: Body) => typeof r.supervised === 'boolean'), 'supervised per room');
        }
        const proctorView = ok(await monitoring(p2c, E1));
        const teacherView = ok(await monitoring(t2c, TM));
        for (const view of [proctorView, teacherView]) {
            assert.ok(view.participants.every((p: Body) => !('roomId' in p) && !('assignmentVersion' in p)), view.scope);
            assert.ok((view.rooms ?? []).every((r: Body) => !('supervised' in r)), view.scope);
        }
    });

    await t.test('I-23 regression: a room-screen move of a READY exam bumps the version through the trigger; the teacher-managed list is unchanged; E1 ENDED refuses', async () => {
        assert.deepEqual(await placement(E3z1), { room: 'Ruang 4', version: 1 });
        const placed = ok(await place(S1, 'Ruang 6', [E3z1]));
        assert.equal(placed.moved, 1);
        assert.deepEqual(await placement(E3z1), { room: 'Ruang 6', version: 2 });
        const roomEntry = (await pool.query(
            `SELECT entry_kind, assignment_version, exam_attempt_id FROM secure_assessment_institution_room_action_entries WHERE exam_participant_id = $1`, [E3z1])).rows;
        assert.ok(roomEntry.length >= 2 && roomEntry.every(e => e.entry_kind === 'PARTICIPANT_ROOM' && e.assignment_version === null && e.exam_attempt_id === null));
        assert.equal(ok(await monitoring(t2c, TM)).scope, 'TEACHER');
        ok(await transition(o, { examInstanceId: E1 }, 'end'));
        const version = (await placement(E1s5))!.version;
        await unchanged(async () => {
            const r = await move(o, E1, E1s5, E1room1, version);
            assert.deepEqual([r.status, r.body], [409, { error: 'invalid_state', examInstanceId: E1, currentState: 'ENDED' }]);
        });
    });
});

test('ASSESS-ROOM-001 C03 migration 0065 (I-21): upgrade on a populated database, rollback, repeat, the version trigger, the transfer constraints and guard', { skip: skipWithoutDatabase }, async t => {
    const db = await createDisposableDatabase({ migrate: false });
    t.after(() => db.close());
    const c = await db.pool.connect();
    try {
        const dir = new URL('../../../../database/migrations/', import.meta.url);
        for (const name of (await readdir(dir)).filter(n => /^\d{4}.*\.sql$/.test(n) && n < '0065').sort()) await c.query(await readFile(new URL(name, dir), 'utf8'));
        // A populated database: two sessions with ACTIVE institution exams, rooms, current room rows, attempts, a teacher-managed
        // exam, and an ASSESS-INSTITUTION-002 action with a participant entry and a Proctor entry.
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
        const EA = await institution(sessionA);
        const EB = await institution(sessionB);
        const participant = async (exam: string) => (await c.query('INSERT INTO secure_assessment_exam_participants (tenant_id, exam_instance_id, person_id) VALUES ($1, $2, $3) RETURNING id',
            [tenant, exam, (await createPersonWithAccount(db.pool)).personId])).rows[0].id as string;
        const room = async (exam: string, label: string) => (await c.query('INSERT INTO secure_assessment_exam_rooms (tenant_id, exam_instance_id, display_label) VALUES ($1, $2, $3) RETURNING id',
            [tenant, exam, label])).rows[0].id as string;
        const attempt = async (participantId: string) => (await c.query('INSERT INTO secure_assessment_exam_attempts (tenant_id, exam_participant_id) VALUES ($1, $2) RETURNING id',
            [tenant, participantId])).rows[0].id as string;
        const place = (exam: string, participantId: string, roomId: string) => c.query(
            'INSERT INTO secure_assessment_exam_participant_room_assignments (tenant_id, exam_instance_id, exam_participant_id, exam_room_id) VALUES ($1, $2, $3, $4)',
            [tenant, exam, participantId, roomId]);
        const pa1 = await participant(EA);
        const pa2 = await participant(EA);
        const pb = await participant(EB);
        const pm = await participant(managed);
        const ra1 = await room(EA, 'Ruang 1');
        const ra2 = await room(EA, 'Ruang 2');
        const rb1 = await room(EB, 'Ruang 1');
        await place(EA, pa1, ra1);
        await place(EA, pa2, ra1);
        await place(EB, pb, rb1);
        const attA1 = await attempt(pa1);
        const attA2 = await attempt(pa2);
        const proctor = (await c.query('INSERT INTO secure_assessment_proctor_assignments (tenant_id, exam_instance_id, person_id) VALUES ($1, $2, $3) RETURNING id',
            [tenant, EA, teacher.personId])).rows[0].id as string;
        const earlier = (await c.query(
            `INSERT INTO secure_assessment_institution_room_actions (tenant_id, session_id, kind, revision, actor_person_id, action_key, request_digest)
             VALUES ($1, $2, 'ROOM_PARTICIPANTS', 1, $3, gen_random_uuid(), repeat('a', 64)) RETURNING id`, [tenant, sessionA, teacher.personId])).rows[0].id as string;
        await c.query(
            `INSERT INTO secure_assessment_institution_room_action_entries (tenant_id, action_id, exam_instance_id, entry_kind, exam_participant_id, proctor_assignment_id, from_room_label, room_label)
             VALUES ($1, $2, $3, 'PARTICIPANT_ROOM', $4, NULL, NULL, 'Ruang 1'), ($1, $2, $3, 'PROCTOR_ASSIGNED', NULL, $5, NULL, 'Ruang 1')`, [tenant, earlier, EA, pa1, proctor]);

        const shape = async () => (await c.query(
            `SELECT (SELECT count(*)::int FROM information_schema.columns WHERE table_schema = 'public' AND (
                        (table_name = 'secure_assessment_exam_participant_room_assignments' AND column_name = 'assignment_version')
                     OR (table_name = 'secure_assessment_institution_room_actions' AND column_name IN ('reason', 'confirmed'))
                     OR (table_name = 'secure_assessment_institution_room_action_entries' AND column_name IN ('assignment_version', 'exam_attempt_id')))) AS columns,
                    (SELECT count(*)::int FROM pg_trigger WHERE tgname IN ('trg_version_sa_exam_participant_room_assignment', 'trg_guard_sa_institution_room_transfer')) AS triggers,
                    (SELECT count(*)::int FROM pg_proc WHERE proname IN ('version_sa_exam_participant_room_assignment', 'guard_sa_institution_room_transfer')) AS functions,
                    (SELECT count(*)::int FROM pg_constraint WHERE conname IN ('ck_sa_exam_participant_room_assignment_version', 'ck_sa_institution_room_action_transfer',
                        'fk_sa_institution_room_entry_attempt')) AS constraints`)).rows[0];
        const none = { columns: 0, triggers: 0, functions: 0, constraints: 0 };
        assert.deepEqual(await shape(), none);
        const current = async () => (await c.query('SELECT id, exam_room_id, assigned_at FROM secure_assessment_exam_participant_room_assignments ORDER BY id')).rows;
        const currentBefore = await current();
        const sql = await readFile(new URL('0065_secure_assessment_participant_room_transfer.sql', dir), 'utf8');
        const failing = sql.replace("INSERT INTO elligble_migration_history (migration_id) VALUES ('0065_secure_assessment_participant_room_transfer');", "RAISE EXCEPTION 'synthetic migration rollback';");
        assert.notEqual(failing, sql);
        await assert.rejects(c.query(failing), /synthetic migration rollback/);
        await c.query('ROLLBACK');
        assert.deepEqual(await shape(), none, 'the failed migration left nothing behind');
        await c.query(sql);
        await c.query(sql);
        assert.equal((await c.query("SELECT count(*)::int AS n FROM elligble_migration_history WHERE migration_id = '0065_secure_assessment_participant_room_transfer'")).rows[0].n, 1);
        assert.deepEqual(await shape(), { columns: 5, triggers: 2, functions: 2, constraints: 3 });
        assert.deepEqual(await current(), currentBefore, 'no data is migrated');
        const versions = (await c.query('SELECT DISTINCT assignment_version FROM secure_assessment_exam_participant_room_assignments')).rows;
        assert.deepEqual(versions, [{ assignment_version: 1 }], 'every existing row reads 1');
        const actions = (await c.query('SELECT reason, confirmed FROM secure_assessment_institution_room_actions')).rows;
        assert.deepEqual(actions, [{ reason: null, confirmed: null }]);

        // The version trigger owns the column (E3).
        const versionOf = async (p: string) => Number((await c.query('SELECT assignment_version FROM secure_assessment_exam_participant_room_assignments WHERE exam_participant_id = $1', [p])).rows[0].assignment_version);
        await c.query('UPDATE secure_assessment_exam_participant_room_assignments SET exam_room_id = $2, assigned_at = statement_timestamp() WHERE exam_participant_id = $1', [pa2, ra2]);
        assert.equal(await versionOf(pa2), 2, 'a room-screen move bumps the version');
        await c.query('UPDATE secure_assessment_exam_participant_room_assignments SET assigned_at = statement_timestamp(), assignment_version = 99 WHERE exam_participant_id = $1', [pa2]);
        assert.equal(await versionOf(pa2), 2, 'an explicit version without a move is ignored');
        await c.query('UPDATE secure_assessment_exam_participant_room_assignments SET exam_room_id = $2, assignment_version = 50 WHERE exam_participant_id = $1', [pa2, ra1]);
        assert.equal(await versionOf(pa2), 3, 'a move gets the old version plus 1, whatever it names');
        const pa3 = await participant(EA);
        await c.query(
            'INSERT INTO secure_assessment_exam_participant_room_assignments (tenant_id, exam_instance_id, exam_participant_id, exam_room_id, assignment_version) VALUES ($1, $2, $3, $4, 7)',
            [tenant, EA, pa3, ra2]);
        assert.equal(await versionOf(pa3), 1, 'an insert always gets 1');

        // The action constraint (E8): a transfer has a reason in the 0054 form, confirmed true and no demotions; no other kind has either.
        const named = (code: string, constraint: string) => (error: { code?: string; constraint?: string }) => error.code === code && error.constraint === constraint;
        let revision = 10;
        const action = (fields: Record<string, unknown>) => {
            const row = { tenant_id: tenant, session_id: sessionA, kind: 'PARTICIPANT_TRANSFER', revision: revision++, actor_person_id: teacher.personId, action_key: randomUUID(),
                request_digest: 'a'.repeat(64), reason: 'Pindah ruang', confirmed: true, ...fields };
            const keys = Object.keys(row);
            return c.query(`INSERT INTO secure_assessment_institution_room_actions (${keys.join(', ')}) VALUES (${keys.map((_, i) => `$${i + 1}`).join(', ')}) RETURNING id`,
                Object.values(row)).then(r => r.rows[0].id as string);
        };
        const transferCheck = named('23514', 'ck_sa_institution_room_action_transfer');
        await assert.rejects(action({ reason: null }), transferCheck, 'a transfer without a reason');
        await assert.rejects(action({ reason: ' Pindah ruang' }), transferCheck, 'an untrimmed reason');
        await assert.rejects(action({ reason: 'x'.repeat(201) }), transferCheck, 'a reason over 200 characters');
        await assert.rejects(action({ confirmed: false }), transferCheck, 'not confirmed');
        await assert.rejects(action({ confirmed: null }), transferCheck, 'no confirmation');
        await assert.rejects(action({ demoted_exam_instance_ids: [EA] }), transferCheck, 'a transfer demotes nothing');
        await assert.rejects(action({ kind: 'ROOM_PARTICIPANTS' }), transferCheck, 'a room action with a reason');
        await assert.rejects(action({ kind: 'ROOM_PROCTORS', reason: null }), transferCheck, 'a room action with a confirmation');
        await assert.rejects(action({ kind: 'ROOM_TRANSFER', reason: null, confirmed: null }), named('23514', 'ck_sa_institution_room_action_kind'));
        const transfer = await action({});
        const transfer2 = await action({});
        const roomAction = await action({ kind: 'ROOM_PARTICIPANTS', reason: null, confirmed: null });

        // The transfer guard and the entry shape.
        const entry = (actionId: string, fields: Record<string, unknown>) => {
            const row = { tenant_id: tenant, action_id: actionId, exam_instance_id: EA, entry_kind: 'PARTICIPANT_TRANSFER', exam_participant_id: pa1, proctor_assignment_id: null,
                from_room_label: 'Ruang 1', room_label: 'Ruang 2', assignment_version: 2, exam_attempt_id: attA1, ...fields };
            const keys = Object.keys(row);
            return c.query(`INSERT INTO secure_assessment_institution_room_action_entries (${keys.join(', ')}) VALUES (${keys.map((_, i) => `$${i + 1}`).join(', ')})`, Object.values(row));
        };
        const scopeRefusal = named('23514', 'ck_sa_institution_room_transfer_scope');
        const shapeRefusal = named('23514', 'ck_sa_institution_room_entry_shape');
        const roomEntry = { entry_kind: 'PARTICIPANT_ROOM', from_room_label: null, assignment_version: null, exam_attempt_id: null };
        await assert.rejects(entry(roomAction, {}), scopeRefusal, 'a transfer entry under a room action');
        await assert.rejects(entry(transfer, roomEntry), scopeRefusal, 'a room entry under a transfer action');
        await assert.rejects(entry(transfer, { exam_instance_id: EB, exam_participant_id: pb, exam_attempt_id: null }), scopeRefusal, "an exam of another session");
        await assert.rejects(entry(transfer, { exam_instance_id: managed, exam_participant_id: pm, exam_attempt_id: null }), scopeRefusal, 'a teacher-managed exam');
        await assert.rejects(entry(transfer, { room_label: 'ruang 1' }), shapeRefusal, 'equal labels');
        await assert.rejects(entry(transfer, { assignment_version: 1 }), shapeRefusal, 'version 1');
        await assert.rejects(entry(transfer, { assignment_version: null }), shapeRefusal, 'no version');
        await assert.rejects(entry(transfer, { from_room_label: null }), shapeRefusal, 'no source room');
        await assert.rejects(entry(transfer, { proctor_assignment_id: proctor }), shapeRefusal, 'a Proctor on a transfer entry');
        await assert.rejects(entry(roomAction, { ...roomEntry, assignment_version: 2 }), shapeRefusal, 'a room entry with a version');
        await assert.rejects(entry(roomAction, { ...roomEntry, exam_attempt_id: attA1 }), shapeRefusal, 'a room entry with an attempt');
        await assert.rejects(entry(transfer, { exam_attempt_id: attA2 }), named('23503', 'fk_sa_institution_room_entry_attempt'), "another participant's attempt");
        // Valid rows: a transfer with its attempt, a transfer of a participant not started, a room entry.
        await entry(transfer, {});
        await entry(transfer2, { exam_attempt_id: null });
        await entry(roomAction, roomEntry);
        await assert.rejects(entry(transfer, { exam_participant_id: pa2, exam_attempt_id: null }), scopeRefusal, 'a second entry');
        for (const table of ['secure_assessment_institution_room_actions', 'secure_assessment_institution_room_action_entries']) {
            await assert.rejects(c.query(`UPDATE ${table} SET tenant_id = tenant_id`), /append-only/, table);
            await assert.rejects(c.query(`DELETE FROM ${table}`), /append-only/, table);
        }
    } finally {
        c.release();
    }
});
