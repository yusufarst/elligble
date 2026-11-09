import { test } from 'node:test';
import * as assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import type pg from 'pg';
import { createDisposableDatabase, skipWithoutDatabase } from '../support/pg-harness.ts';
import {
    addMembership, addParticipant, addProctorAssignment, addQuestionSnapshots, createExamInstance, createPersonWithAccount, createTeachingContext,
    createTenant, enrollInTeachingGroup, type TeachingContext,
} from '../support/fixtures.ts';
import { BrowserLikeClient, startProductionWiredServer, type ClientResponse } from '../support/test-server.ts';
import { setSchoolOperator } from '../../../tenant-access/src/school-operator.ts';
import { checkExamInstanceParticipantProctorScheduleConflictReadiness } from '../../src/exam-instance-participant-proctor-schedule-conflict-readiness-preflight.ts';

// ASSESS-INSTITUTION-002 real PostgreSQL oracle (record §5 I-1 to I-18, §4.9, C03) through the production-wired
// server: placement and the RP-1 upgrade (I-1); one physical room across the exams of a session (I-2) with its
// Proctor and the RP-2 exemption at mark ready (I-3); moves and pruning (I-4); the Proctor rules (I-5); rooms
// across sessions and tenants (I-6); the room guard (I-7); participant addition (I-8); the RP-3 re-check (I-9);
// stale writes and replays (I-10); lifecycle bounds and cancelled exams (I-11); every authority denial of the P5
// trace with zero mutation (I-12, N01..N10); the per-request supervision scope after commit (I-13, N07);
// minimization (I-14); concurrency (I-15); the teacher-managed regression (I-16); the edge (I-18). Migration 0063
// upgrade, rollback and repeat is the second test (I-17).

const P = '/api/v1/assessment/institution-exams';
const R = `${P}/rooms`;
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
    'secure_assessment_exam_rooms', 'secure_assessment_exam_participant_room_assignments', 'secure_assessment_proctor_assignments',
    'secure_assessment_exam_proctor_room_assignments', 'secure_assessment_exam_participants', 'secure_assessment_exam_participant_additions',
    'secure_assessment_exam_participant_addition_entries', 'secure_assessment_institution_room_actions', 'secure_assessment_institution_room_action_entries',
    'secure_assessment_exam_lifecycle_events', 'secure_assessment_exam_cancellations', 'secure_assessment_institution_preparation_deadlines',
    'tenant_school_operator_assignments',
];
/** Every table a room write touches, with the states an UPDATE changes (lifecycle, flags, revocations, current rooms). */
async function counts(pool: pg.Pool): Promise<Record<string, unknown>> {
    const result: Record<string, unknown> = {};
    for (const table of TABLES) result[table] = (await pool.query(`SELECT count(*)::int AS n FROM ${table}`)).rows[0].n;
    result['exams'] = (await pool.query(
        `SELECT string_agg(id::text || ':' || lifecycle_state || ':' || coalesce(room_based_operations_enabled::text, '-') || coalesce(proctor_per_room_required::text, '-'), ',' ORDER BY id) AS s
         FROM secure_assessment_exam_instances`)).rows[0].s;
    result['revoked'] = (await pool.query(`SELECT string_agg(id::text || ':' || (revoked_at IS NULL)::text, ',' ORDER BY id) AS s FROM secure_assessment_proctor_assignments`)).rows[0].s;
    result['placed'] = (await pool.query(`SELECT string_agg(id::text || ':' || exam_room_id::text, ',' ORDER BY id) AS s FROM secure_assessment_exam_participant_room_assignments`)).rows[0].s;
    result['labels'] = (await pool.query(`SELECT string_agg(id::text || ':' || display_label, ',' ORDER BY id) AS s FROM secure_assessment_exam_rooms`)).rows[0].s;
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
    setSchoolOperator(c, { tenantId, personId, action, operator: 'Synthetic CI operator', caseReference: 'ASSESS-INSTITUTION-002', reason: 'Synthetic institution rooms' }));

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

test('ASSESS-INSTITUTION-002 C03 institution rooms, participants and Proctors end to end through production wiring', { skip: skipWithoutDatabase, timeout: 600_000 }, async t => {
    const db = await createDisposableDatabase();
    const app = await startProductionWiredServer(db.pool);
    t.after(async () => { await app.close(); await db.close(); });
    const pool = db.pool;

    // Fixture (record §5): tenant 1 (WIB) with rombel X (three students), Y (two) and Z (one); Matematika x X,
    // Fisika x Y and Biologi x Z held by T; staff P1..P6 and an unassigned member; Operators O and Or (revoked
    // later); a Homeroom Teacher; tenant 2 with its own Operator, student and session.
    const tenant = await createTenant(pool, 'SMA Ruang');
    const teacher = await createPersonWithAccount(pool, 'guru.ruang');
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
    const s1 = await enroll('siswa.ruang.1', teaching.teachingAssignmentId);
    const s2 = await enroll('siswa.ruang.2', teaching.teachingAssignmentId);
    const s3 = await enroll('siswa.ruang.3', teaching.teachingAssignmentId);
    const y1 = await enroll('siswa.fisika.1', physicsY);
    const y2 = await enroll('siswa.fisika.2', physicsY);
    const z1 = await enroll('siswa.biologi.1', biologyZ);
    const staff = async (username: string) => {
        const person = await createPersonWithAccount(pool, username);
        return { ...person, membershipId: await addMembership(pool, tenant, person.personId) };
    };
    const p1 = await staff('pengawas.satu');
    const p2 = await staff('pengawas.dua');
    await staff('pengawas.tiga');
    await staff('pengawas.empat');
    await staff('pengawas.enam');
    const unassigned = await staff('staf.lain');
    const operator = await staff('operator.ruang');
    await operatorAssignment(pool, tenant, operator.personId, 'ASSIGN');
    const revokedOperator = await staff('operator.dicabut');
    await operatorAssignment(pool, tenant, revokedOperator.personId, 'ASSIGN');
    const homeroom = await staff('walikelas.ruang');
    await pool.query(
        `INSERT INTO academic_core_homeroom_responsibilities (tenant_id, membership_id, academic_year_id, academic_period_id, academic_group_id)
         VALUES ($1, $2, $3, $4, $5)`, [tenant, homeroom.membershipId, scope.academic_year_id, academicPeriodId, teaching.academicGroupId]);
    const outsider = await createPersonWithAccount(pool, 'tanpa.keanggotaan');
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
    const oRevoked = await login(revokedOperator);
    const tc = await login(teacher);
    const pc = await login(p1);
    const hc = await login(homeroom);
    const sc = await login(s1);
    const foreignInOurs = await login(foreignOperator);
    const foreign = await login(foreignOperator, otherTenant);
    const noMembership = await login(outsider);
    const anonymous = new BrowserLikeClient(app.baseUrl);
    anonymous.tenantId = tenant;

    const receipts: unknown[] = [];
    const keep = (r: ClientResponse) => { receipts.push(r.body); return r; };
    const createPeriod = async (c: BrowserLikeClient, label: string, typeId = teaching.assessmentTypeId, periodId = academicPeriodId) => {
        const r = await post(c, `${P}/periods`, { label, assessmentTypeId: typeId, academicPeriodId: periodId, actionKey: randomUUID() });
        assert.equal(r.status, 201, JSON.stringify(r.body));
        return r.body.periodId as string;
    };
    const createSession = async (c: BrowserLikeClient, periodId: string, date: string, startTime: string, endTime: string) => {
        const r = await post(c, `${P}/sessions`, { periodId, date, startTime, endTime, actionKey: randomUUID() });
        assert.equal(r.status, 201, JSON.stringify(r.body));
        return r.body.sessionId as string;
    };
    const placeExam = async (c: BrowserLikeClient, sessionId: string, teachingAssignmentId: string, preparationDeadline: string) => {
        const r = await post(c, `${P}/placements`, {
            sessionId, teachingAssignmentId, durationMinutes: 45, latestStartPolicy: 'FULL_DURATION_BEYOND_WINDOW', preparationDeadline, actionKey: randomUUID(),
        });
        assert.equal(r.status, 201, JSON.stringify(r.body));
        return r.body.examInstanceId as string;
    };
    const roomView = async (sessionId: string, c = o) => {
        const r = await c.request(`${R}?sessionId=${sessionId}`);
        assert.equal(r.status, 200, JSON.stringify(r.body));
        receipts.push(r.body);
        return r.body as Body;
    };
    const rev = async (sessionId: string) => (await pool.query(
        'SELECT coalesce(max(revision), 0)::int AS n FROM secure_assessment_institution_room_actions WHERE session_id = $1', [sessionId])).rows[0].n as number;
    const place = async (sessionId: string, roomLabel: string, participantIds: string[], extra: Body = {}, c = o) =>
        keep(await post(c, `${R}/participants`, { sessionId, roomLabel, participantIds, expectedRevision: await rev(sessionId), actionKey: randomUUID(), ...extra }));
    const proctors = async (sessionId: string, roomLabel: string, proctorElligbleIds: string[], extra: Body = {}, c = o) =>
        keep(await post(c, `${R}/proctors`, { sessionId, roomLabel, proctorElligbleIds, expectedRevision: await rev(sessionId), actionKey: randomUUID(), ...extra }));
    const addition = async (examInstanceId: string, sessionId: string, enrollmentIds: string[], roomLabel: string, extra: Body = {}, c = o) =>
        keep(await post(c, `${P}/participants`, { examInstanceId, enrollmentIds, roomLabel, expectedRevision: await rev(sessionId), actionKey: randomUUID(), ...extra }));
    const markReady = (examInstanceId: string, c = o) => post(c, `${P}/transition`, { examInstanceId, action: 'mark_ready' });
    const ok = (r: ClientResponse, status = 200) => { assert.equal(r.status, status, JSON.stringify(r.body)); return r.body as Body; };
    const pid = async (examId: string, personId: string) => (await pool.query(
        'SELECT id FROM secure_assessment_exam_participants WHERE exam_instance_id = $1 AND person_id = $2', [examId, personId])).rows[0].id as string;
    const roomsOf = async (examId: string) => (await pool.query(
        'SELECT id, display_label FROM secure_assessment_exam_rooms WHERE exam_instance_id = $1 ORDER BY display_label, id', [examId])).rows;
    const roomOf = async (participantId: string) => (await pool.query(
        `SELECT r.display_label FROM secure_assessment_exam_participant_room_assignments ra JOIN secure_assessment_exam_rooms r ON r.id = ra.exam_room_id
         WHERE ra.exam_participant_id = $1`, [participantId])).rows.map(r => r.display_label as string);
    const activeProctors = async (examId: string) => (await pool.query(
        `SELECT pa.person_id, r.display_label FROM secure_assessment_proctor_assignments pa
         LEFT JOIN secure_assessment_exam_proctor_room_assignments m ON m.proctor_assignment_id = pa.id
         LEFT JOIN secure_assessment_exam_rooms r ON r.id = m.exam_room_id
         WHERE pa.exam_instance_id = $1 AND pa.revoked_at IS NULL ORDER BY pa.person_id, r.display_label`, [examId])).rows;
    const stateOf = async (examId: string) => (await pool.query('SELECT lifecycle_state FROM secure_assessment_exam_instances WHERE id = $1', [examId])).rows[0].lifecycle_state as string;
    const roomExam = (view: Body, examId: string) => view.exams.find((e: Body) => e.examInstanceId === examId);
    const invalid = (r: ClientResponse) => { assert.equal(r.status, 422, JSON.stringify(r.body)); assert.equal(r.body.error, 'room_invalid'); return r.body.problems as Body[]; };
    const unchanged = async (run: () => Promise<void>) => {
        const before = await counts(pool);
        await run();
        assert.deepEqual(await counts(pool), before, 'nothing was written');
    };

    // Periods and sessions: S1 (D+2 08:00 to 10:00) with E1 (Matematika x X) and E2 (Fisika x Y); S2 of another
    // period overlapping S1 with E3 (Biologi x Z); S3 not overlapping with E4 (Biologi x Z); tenant 2's session.
    const period1 = await createPeriod(o, 'PTS Ruang');
    const period2 = await createPeriod(o, 'PAS Ruang');
    const period3 = await createPeriod(o, 'PAT Ruang');
    const S1 = await createSession(o, period1, wibDay(2), '08:00', '10:00');
    const S2 = await createSession(o, period2, wibDay(2), '09:00', '11:00');
    const S3 = await createSession(o, period3, wibDay(5), '08:00', '10:00');
    const shortDeadline = wib(2);
    const E1 = await placeExam(o, S1, teaching.teachingAssignmentId, shortDeadline);
    const E2 = await placeExam(o, S1, physicsY, shortDeadline);
    await addQuestionSnapshots(pool, tenant, E1, 2);
    await addQuestionSnapshots(pool, tenant, E2, 2);
    const E3 = await placeExam(o, S2, biologyZ, `${wibDay(1)}T20:00`);
    const E4 = await placeExam(o, S3, biologyZ, `${wibDay(1)}T20:00`);
    const foreignPeriod = await createPeriod(foreign, 'PTS Lain', foreignTeaching.assessmentTypeId, foreignAcademicPeriod);
    const foreignSession = await createSession(foreign, foreignPeriod, wibDay(2), '08:00', '10:00');
    const foreignExam = await placeExam(foreign, foreignSession, foreignTeaching.teachingAssignmentId, `${wibDay(1)}T20:00`);
    const foreignParticipant = await pid(foreignExam, foreignStudent.personId);
    // A teacher-managed exam of rombel X (no rooms, flags FALSE/FALSE).
    const managed = await createExamInstance(pool, tenant, teaching, { lifecycleState: 'SCHEDULED', windowStartsAt: new Date(Date.now() + 40 * 86_400_000), windowEndsAt: new Date(Date.now() + 40 * 86_400_000 + 3_600_000) });
    const E1s1 = await pid(E1, s1.personId), E1s2 = await pid(E1, s2.personId), E1s3 = await pid(E1, s3.personId);
    const E2y1 = await pid(E2, y1.personId), E2y2 = await pid(E2, y2.personId);
    const E3z1 = await pid(E3, z1.personId), E4z1 = await pid(E4, z1.personId);

    await t.test('I-1 a placement is room-based with a Proctor per room; without a room mark ready names exam_room_empty', async () => {
        const flags = async (id: string) => (await pool.query('SELECT room_based_operations_enabled AS r, proctor_per_room_required AS p FROM secure_assessment_exam_instances WHERE id = $1', [id])).rows[0];
        for (const id of [E1, E2, E3, E4]) assert.deepEqual(await flags(id), { r: true, p: true }, id);
        assert.deepEqual(await flags(managed), { r: false, p: false }, 'teacher-managed exams keep their flags');
        const view = await roomView(S1);
        assert.deepEqual(view.session, { sessionId: S1, periodLabel: 'PTS Ruang', startsAt: new Date(`${wibDay(2)}T08:00:00+07:00`).toISOString(), endsAt: new Date(`${wibDay(2)}T10:00:00+07:00`).toISOString() });
        assert.equal(view.revision, 0);
        assert.deepEqual(view.rooms, []);
        assert.deepEqual(view.exams.map((e: Body) => e.examInstanceId), [E2, E1], 'ordered by subject then rombel');
        const e1 = roomExam(view, E1);
        assert.deepEqual([e1.subjectLabel, e1.groupLabel, e1.lifecycleState, e1.editable, e1.roomBased], ['Matematika', 'X-1', 'SCHEDULED', true, true]);
        assert.deepEqual(e1.roomReadiness, { status: 'not_ready', blocker: 'exam_room_empty' });
        assert.deepEqual(e1.participants.map((p: Body) => [p.elligbleId, p.roomLabel]), [['siswa.ruang.1', null], ['siswa.ruang.2', null], ['siswa.ruang.3', null]]);
        assert.deepEqual(e1.candidates, []);
        await deadlinePassed(pool, E1);
        await deadlinePassed(pool, E2);
        await unchanged(async () => {
            const r = await markReady(E1);
            assert.deepEqual([r.status, r.body.error, r.body.readiness.baseline.status, r.body.readiness.roomProctor], [409, 'not_ready', 'baseline_readiness_checks_pass', { status: 'not_ready', blocker: 'exam_room_empty' }]);
        });
    });

    await t.test('I-2 all five students of S1 into "Ruang 1": one row per exam with identical labels, five entries, revision 1', async () => {
        const body = ok(await place(S1, 'Ruang 1', [E1s1, E1s2, E1s3, E2y1, E2y2]));
        assert.deepEqual(body, { sessionId: S1, revision: 1, moved: 5, demoted: [], replayed: false });
        assert.deepEqual((await roomsOf(E1)).map(r => r.display_label), ['Ruang 1']);
        assert.deepEqual((await roomsOf(E2)).map(r => r.display_label), ['Ruang 1']);
        for (const id of [E1s1, E1s2, E1s3, E2y1, E2y2]) assert.deepEqual(await roomOf(id), ['Ruang 1']);
        const action = (await pool.query('SELECT id, kind, revision, actor_person_id, demoted_exam_instance_ids FROM secure_assessment_institution_room_actions WHERE session_id = $1', [S1])).rows;
        assert.deepEqual(action.map(a => [a.kind, a.revision, a.actor_person_id, a.demoted_exam_instance_ids]), [['ROOM_PARTICIPANTS', 1, operator.personId, []]]);
        const entries = (await pool.query('SELECT entry_kind, from_room_label, room_label, exam_participant_id FROM secure_assessment_institution_room_action_entries WHERE action_id = $1', [action[0].id])).rows;
        assert.equal(entries.length, 5);
        for (const e of entries) assert.deepEqual([e.entry_kind, e.from_room_label, e.room_label], ['PARTICIPANT_ROOM', null, 'Ruang 1']);
        const r = await markReady(E1);
        assert.deepEqual([r.status, r.body.error, r.body.readiness.roomProctor.blocker], [409, 'not_ready', 'active_proctor_assignment_empty']);
    });

    await t.test('I-3 {P1} for "Ruang 1": one assignment per exam mapped to its row; E1 and E2 mark ready without a Proctor conflict (RP-2)', async () => {
        const body = ok(await proctors(S1, 'Ruang 1', ['pengawas.satu']));
        assert.deepEqual(body, { sessionId: S1, revision: 2, changed: true, proctors: [{ elligbleId: 'pengawas.satu' }], demoted: [], replayed: false });
        assert.deepEqual(await activeProctors(E1), [{ person_id: p1.personId, display_label: 'Ruang 1' }]);
        assert.deepEqual(await activeProctors(E2), [{ person_id: p1.personId, display_label: 'Ruang 1' }]);
        const kinds = (await pool.query(
            `SELECT e.entry_kind, e.room_label FROM secure_assessment_institution_room_action_entries e JOIN secure_assessment_institution_room_actions a ON a.id = e.action_id
             WHERE a.session_id = $1 AND a.revision = 2`, [S1])).rows;
        assert.deepEqual(kinds, [{ entry_kind: 'PROCTOR_ASSIGNED', room_label: 'Ruang 1' }, { entry_kind: 'PROCTOR_ASSIGNED', room_label: 'Ruang 1' }]);
        const view = await roomView(S1);
        assert.deepEqual(view.rooms, [{
            label: 'Ruang 1', participantCount: 5, proctors: [{ elligbleId: 'pengawas.satu' }],
            groups: [{ examInstanceId: E2, subjectLabel: 'Fisika', groupLabel: 'Y-1', count: 2 }, { examInstanceId: E1, subjectLabel: 'Matematika', groupLabel: 'X-1', count: 3 }],
        }]);
        for (const id of [E1, E2]) assert.equal(roomExam(view, id).roomReadiness.status, 'room_proctor_readiness_ready');
        assert.deepEqual(ok(await markReady(E1)), { examInstanceId: E1, lifecycleState: 'READY' });
        assert.deepEqual(ok(await markReady(E2)), { examInstanceId: E2, lifecycleState: 'READY' });
    });

    await t.test('I-4/I-5/I-6 a move creates a row and re-checks readiness; the Proctor rules and the room rules; moving back prunes the row', async () => {
        const moved = ok(await place(S1, 'Ruang 2', [E1s1]));
        assert.deepEqual(moved, { sessionId: S1, revision: 3, moved: 1, demoted: [E1], replayed: false });
        assert.equal(await stateOf(E1), 'SCHEDULED');
        assert.equal(await stateOf(E2), 'READY', 'E2 is not affected');
        const demotion = (await pool.query(`SELECT actor_person_id FROM secure_assessment_exam_lifecycle_events WHERE exam_instance_id = $1 AND from_state = 'READY' AND to_state = 'SCHEDULED'`, [E1])).rows;
        assert.deepEqual(demotion, [{ actor_person_id: operator.personId }]);
        assert.deepEqual((await roomsOf(E1)).map(r => r.display_label), ['Ruang 1', 'Ruang 2']);
        const entry = (await pool.query(`SELECT from_room_label, room_label FROM secure_assessment_institution_room_action_entries WHERE exam_participant_id = $1 ORDER BY id`, [E1s1])).rows;
        assert.ok(entry.some(e => e.from_room_label === 'Ruang 1' && e.room_label === 'Ruang 2'));
        assert.deepEqual(roomExam(await roomView(S1), E1).roomReadiness,
            { status: 'not_ready', blocker: 'active_proctor_room_coverage_incomplete', examRoomCount: 2, coveredExamRoomCount: 1, uncoveredExamRoomCount: 1 });

        // I-5: each refusal leaves zero mutation.
        await unchanged(async () => {
            assert.deepEqual(invalid(await proctors(S1, 'Ruang 2', ['pengawas.satu'])), [{ code: 'proctor_other_room', elligbleIds: ['pengawas.satu'] }]);
            assert.deepEqual(invalid(await proctors(S1, 'Ruang 2', ['siswa.ruang.1'])), [{ code: 'proctor_ineligible', elligbleIds: ['siswa.ruang.1'] }]);
            const foreignId = await proctors(S1, 'Ruang 2', ['siswa.lain']);
            const unknownId = await proctors(S1, 'Ruang 2', ['tidak.ada.sama.sekali']);
            assert.deepEqual(invalid(foreignId), [{ code: 'proctor_unknown', elligbleIds: ['siswa.lain'] }]);
            assert.equal(JSON.stringify(foreignId.body).replace('siswa.lain', 'X'), JSON.stringify(unknownId.body).replace('tidak.ada.sama.sekali', 'X'), 'byte-identical apart from the echo');
        });
        // P2 becomes the Proctor of a room of S2 (E3), then is refused in S1 (overlapping).
        ok(await place(S2, 'Ruang 9', [E3z1]));
        ok(await proctors(S2, 'Ruang 9', ['pengawas.dua']));
        assert.deepEqual(await activeProctors(E3), [{ person_id: p2.personId, display_label: 'Ruang 9' }]);
        await unchanged(async () => {
            assert.deepEqual(invalid(await proctors(S1, 'Ruang 2', ['pengawas.dua'])), [{ code: 'proctor_schedule_conflict', count: 1, elligbleIds: ['pengawas.dua'] }]);
            // I-6: "Ruang 1" is S1's in an overlapping session.
            assert.deepEqual(invalid(await place(S2, 'Ruang 1', [E3z1])), [{ code: 'room_conflict' }]);
            assert.deepEqual(invalid(await place(S2, '  ruang   1 ', [E3z1])), [{ code: 'room_conflict' }]);
        });
        // In a session that does not overlap, and in tenant 2 at the same time, "Ruang 1" is accepted.
        ok(await place(S3, 'Ruang 1', [E4z1]));
        const foreignView = await roomView(foreignSession, foreign);
        const foreignRoom = await post(foreign, `${R}/participants`, { sessionId: foreignSession, roomLabel: 'Ruang 1', participantIds: [foreignParticipant], expectedRevision: foreignView.revision, actionKey: randomUUID() });
        assert.equal(foreignRoom.status, 200, JSON.stringify(foreignRoom.body));
        const ours = JSON.stringify(await roomView(S1)) + JSON.stringify(await roomView(S2)) + JSON.stringify(await roomView(S3));
        for (const text of ['siswa.lain', foreignParticipant, foreignExam, foreignSession]) assert.equal(ours.includes(text), false, text);

        // Moved back with another spelling: the same room, stored as "Ruang 1"; the emptied row is pruned, its entry kept.
        const rowsBefore = (await pool.query('SELECT id FROM secure_assessment_exam_rooms ORDER BY id')).rows.map(r => r.id);
        const ruang2 = (await roomsOf(E1)).find(r => r.display_label === 'Ruang 2')!.id;
        const back = ok(await place(S1, 'ruang  1', [E1s1]));
        assert.deepEqual(back, { sessionId: S1, revision: 4, moved: 1, demoted: [], replayed: false });
        assert.deepEqual((await roomsOf(E1)).map(r => r.display_label), ['Ruang 1']);
        assert.deepEqual((await pool.query('SELECT id FROM secure_assessment_exam_rooms ORDER BY id')).rows.map(r => r.id), rowsBefore.filter(id => id !== ruang2), 'no other row is deleted');
        const history = (await pool.query(`SELECT e.from_room_label, e.room_label FROM secure_assessment_institution_room_action_entries e
            JOIN secure_assessment_institution_room_actions a ON a.id = e.action_id WHERE e.exam_participant_id = $1 ORDER BY a.revision`, [E1s1])).rows;
        assert.deepEqual(history.slice(-2), [{ from_room_label: 'Ruang 1', room_label: 'Ruang 2' }, { from_room_label: 'Ruang 2', room_label: 'Ruang 1' }]);
        assert.deepEqual(await roomOf(E1s1), ['Ruang 1']);
    });

    await t.test('I-7 the room guard refuses with its named constraints; a teacher-managed exam keeps duplicate labels', async () => {
        const insert = (examId: string, label: string) => pool.query('INSERT INTO secure_assessment_exam_rooms (tenant_id, exam_instance_id, display_label) VALUES ($1, $2, $3)', [tenant, examId, label]);
        const named = (code: string, constraint: string) => (error: { code?: string; constraint?: string }) => error.code === code && error.constraint === constraint;
        await unchanged(async () => {
            await assert.rejects(insert(E1, 'RUANG 1'), named('23505', 'uq_sa_institution_exam_room_label'));
            await assert.rejects(insert(E1, 'Ruang  2'), named('23514', 'ck_sa_institution_exam_room_label'));
            await assert.rejects(insert(E1, ' Ruang 2'), named('23514', 'ck_sa_institution_exam_room_label'));
            await assert.rejects(insert(E1, 'x'.repeat(61)), named('23514', 'ck_sa_institution_exam_room_label'));
            await assert.rejects(pool.query(`UPDATE secure_assessment_exam_rooms SET display_label = 'Ruang Satu' WHERE exam_instance_id = $1`, [E1]), named('23514', 'ck_sa_institution_exam_room_label'));
        });
        await insert(managed, 'A');
        await insert(managed, 'A');
        await insert(managed, '  a  ');
        assert.equal((await roomsOf(managed)).length, 3, 'BU-071: duplicates allowed on a teacher-managed exam');
    });

    let s4: Student, s5: Student, s6: Student;
    let s6Z = '';
    let additionBody: Body = {};
    await t.test('I-8 a student enrolled after placement is a candidate and joins into a room with the 0053 rows; the refusals change nothing', async () => {
        s4 = await enroll('siswa.ruang.4', teaching.teachingAssignmentId);
        s5 = await enroll('siswa.ruang.5', teaching.teachingAssignmentId);
        s6 = await enroll('siswa.ruang.6', teaching.teachingAssignmentId);
        s6Z = await enrollInTeachingGroup(pool, tenant, { teachingAssignmentId: biologyZ } as TeachingContext, s6.membershipId);
        // s5 is expected at the same time in a teacher-managed exam.
        const busy = await createExamInstance(pool, tenant, teaching, { lifecycleState: 'SCHEDULED', windowStartsAt: new Date(`${wibDay(2)}T08:30:00+07:00`), windowEndsAt: new Date(`${wibDay(2)}T09:30:00+07:00`) });
        await addParticipant(pool, tenant, busy, s5.personId);
        const view = await roomView(S1);
        assert.deepEqual(roomExam(view, E1).candidates.map((c: Body) => [c.enrollmentId, c.elligbleId, c.conflict]),
            [[s4.enrollmentId, 'siswa.ruang.4', false], [s5.enrollmentId, 'siswa.ruang.5', true], [s6.enrollmentId, 'siswa.ruang.6', false]]);
        assert.deepEqual(roomExam(view, E2).candidates, []);
        await unchanged(async () => {
            const notEnrolled = await addition(E1, S1, [y1.enrollmentId], 'Ruang 1');
            assert.deepEqual(invalid(notEnrolled), [{ code: 'not_enrolled', count: 1 }]);
            const foreignEnrollment = await addition(E1, S1, [foreignStudent.enrollmentId], 'Ruang 1');
            const unknownEnrollment = await addition(E1, S1, [randomUUID()], 'Ruang 1');
            assert.equal(JSON.stringify(foreignEnrollment.body), JSON.stringify(unknownEnrollment.body), 'N02: a foreign and a nonexistent enrollment');
            assert.equal(JSON.stringify(foreignEnrollment.body), JSON.stringify(notEnrolled.body));
            assert.deepEqual(invalid(await addition(E1, S1, [s1.enrollmentId], 'Ruang 1')), [{ code: 'already_participant', count: 1 }]);
            assert.deepEqual(invalid(await addition(E1, S1, [s5.enrollmentId], 'Ruang 1')), [{ code: 'schedule_conflict', count: 1 }]);
            assert.deepEqual(invalid(await addition(E1, S1, [s4.enrollmentId], '   ')), [{ code: 'room_label_invalid' }]);
            assert.deepEqual(invalid(await addition(E3, S2, [s6Z], 'Ruang 1')), [{ code: 'room_conflict' }]);
        });
        const key = randomUUID();
        additionBody = { examInstanceId: E1, enrollmentIds: [s4.enrollmentId], roomLabel: 'Ruang 1', expectedRevision: await rev(S1), actionKey: key };
        const added = await post(o, `${P}/participants`, additionBody);
        keep(added);
        assert.deepEqual([added.status, added.body], [201, { examInstanceId: E1, revision: 5, added: [{ enrollmentId: s4.enrollmentId, elligbleId: 'siswa.ruang.4' }], demoted: [], replayed: false }]);
        const participant = await pid(E1, s4.personId);
        assert.deepEqual(await roomOf(participant), ['Ruang 1']);
        const provenance = (await pool.query(
            `SELECT a.previous_lifecycle_state, a.added_by_person_id, a.action_key, e.academic_enrollment_id, e.exam_participant_id
             FROM secure_assessment_exam_participant_additions a JOIN secure_assessment_exam_participant_addition_entries e ON e.participant_addition_id = a.id
             WHERE a.action_key = $1`, [key])).rows;
        assert.deepEqual(provenance, [{ previous_lifecycle_state: 'SCHEDULED', added_by_person_id: operator.personId, action_key: key, academic_enrollment_id: s4.enrollmentId, exam_participant_id: participant }]);
        const entries = (await pool.query(
            `SELECT e.entry_kind, e.from_room_label, e.room_label FROM secure_assessment_institution_room_action_entries e
             JOIN secure_assessment_institution_room_actions a ON a.id = e.action_id WHERE a.action_key = $1`, [key])).rows;
        assert.deepEqual(entries, [{ entry_kind: 'PARTICIPANT_ROOM', from_room_label: null, room_label: 'Ruang 1' }]);
        assert.equal((await pool.query(`SELECT kind FROM secure_assessment_institution_room_actions WHERE action_key = $1`, [key])).rows[0].kind, 'PARTICIPANT_ADDITION');
        // No route removes a participant or clears a room: an empty choice is not a request.
        assert.deepEqual((await post(o, `${R}/participants`, { sessionId: S1, roomLabel: 'Ruang 1', participantIds: [], expectedRevision: 5, actionKey: randomUUID() })).body, { error: 'invalid_request' });
        assert.deepEqual((await post(o, `${P}/participants`, { ...additionBody, enrollmentIds: [], actionKey: randomUUID() })).body, { error: 'invalid_request' });
    });

    await t.test('I-10 a stale revision, the replay of one key, a key reused, and an unchanged Proctor set', async () => {
        const current = await rev(S1);
        await unchanged(async () => {
            const stale = await post(o, `${R}/participants`, { sessionId: S1, roomLabel: 'Ruang 2', participantIds: [E1s2], expectedRevision: current - 1, actionKey: randomUUID() });
            assert.deepEqual([stale.status, stale.body], [409, { error: 'stale_assignment', revision: current }]);
            const ahead = await post(o, `${R}/proctors`, { sessionId: S1, roomLabel: 'Ruang 1', proctorElligbleIds: [], expectedRevision: current + 1, actionKey: randomUUID() });
            assert.deepEqual([ahead.status, ahead.body], [409, { error: 'stale_assignment', revision: current }]);
        });
        const key = randomUUID();
        const body = { sessionId: S1, roomLabel: 'Ruang 2', participantIds: [E1s2], expectedRevision: current, actionKey: key };
        const first = await post(o, `${R}/participants`, body);
        assert.deepEqual([first.status, first.body], [200, { sessionId: S1, revision: current + 1, moved: 1, demoted: [], replayed: false }]);
        await unchanged(async () => {
            const again = await post(o, `${R}/participants`, body);
            assert.deepEqual([again.status, again.body], [200, { ...first.body, replayed: true }]);
            assert.deepEqual((await post(o, `${R}/participants`, { ...body, participantIds: [E1s3] })).body, { error: 'action_key_reused' });
            assert.deepEqual((await post(o, `${R}/proctors`, { sessionId: S1, roomLabel: 'Ruang 1', proctorElligbleIds: ['pengawas.satu'], expectedRevision: current + 1, actionKey: key })).body, { error: 'action_key_reused' });
            assert.deepEqual((await post(o, `${P}/participants`, { ...additionBody, expectedRevision: current + 1, actionKey: key })).body, { error: 'action_key_reused' });
            // The addition replays with what it added.
            const addedAgain = await post(o, `${P}/participants`, additionBody);
            assert.deepEqual([addedAgain.status, addedAgain.body], [200, { examInstanceId: E1, revision: 5, added: [{ enrollmentId: s4.enrollmentId, elligbleId: 'siswa.ruang.4' }], demoted: [], replayed: true }]);
        });
        ok(await place(S1, 'Ruang 1', [E1s2]));
        const settled = await rev(S1);
        const same = { sessionId: S1, roomLabel: 'Ruang 1', proctorElligbleIds: ['pengawas.satu'], expectedRevision: settled, actionKey: randomUUID() };
        await unchanged(async () => {
            for (let i = 0; i < 2; i++) {
                const r = await post(o, `${R}/proctors`, same);
                assert.deepEqual([r.status, r.body], [200, { sessionId: S1, revision: settled, changed: false, proctors: [{ elligbleId: 'pengawas.satu' }], demoted: [], replayed: false }]);
            }
        });
        assert.equal(await rev(S1), settled, 'no action, no revision bump');
    });

    await t.test('I-13 after commit: the Proctor sees only their room; a moved student leaves the list; a removed Proctor gets 403', async () => {
        const monitoring = async (examId: string) => pc.request(`/api/v1/assessment/exam-monitoring?examInstanceId=${examId}`);
        ok(await place(S1, 'Ruang 3', [E1s3]));
        const listed = ok(await monitoring(E1));
        assert.deepEqual(listed.participants.map((p: Body) => p.elligbleId), ['siswa.ruang.1', 'siswa.ruang.2', 'siswa.ruang.4']);
        ok(await place(S1, 'Ruang 3', [E1s2]));
        assert.deepEqual(ok(await monitoring(E1)).participants.map((p: Body) => p.elligbleId), ['siswa.ruang.1', 'siswa.ruang.4']);
        const list = ok(await pc.request('/api/v1/assessment/proctor-monitoring'));
        const mine = list.assignments.find((a: Body) => a.examInstanceId === E1);
        assert.deepEqual(mine.rooms.map((r: Body) => r.roomLabel), ['Ruang 1']);
        const discovered = ok(await sc.request('/api/v1/assessment/assigned-exams'));
        assert.equal(discovered.assignments.find((a: Body) => a.examInstanceId === E1).roomLabel, 'Ruang 1');
        ok(await proctors(S1, 'Ruang 1', ['pengawas.tiga']));
        assert.deepEqual((await monitoring(E1)).status, 403);
        assert.deepEqual((await monitoring(E2)).status, 403);
        // Restore: everyone in "Ruang 1" with P1.
        ok(await place(S1, 'Ruang 1', [E1s2, E1s3]));
        ok(await proctors(S1, 'Ruang 1', ['pengawas.satu']));
        assert.deepEqual((await roomsOf(E1)).map(r => r.display_label), ['Ruang 1']);
        assert.equal(await stateOf(E2), 'READY', 'E2 stayed complete through every Proctor change');
    });

    await t.test('I-9 RP-3: a complete set keeps READY, an empty set sends both back to SCHEDULED; the extension is refused once marked ready', async () => {
        assert.deepEqual(ok(await markReady(E1)), { examInstanceId: E1, lifecycleState: 'READY' });
        assert.deepEqual(ok(await proctors(S1, 'Ruang 1', ['pengawas.satu', 'pengawas.tiga'])).demoted, []);
        assert.deepEqual([await stateOf(E1), await stateOf(E2)], ['READY', 'READY']);
        const emptied = ok(await proctors(S1, 'Ruang 1', []));
        assert.deepEqual(emptied.demoted, [E1, E2].sort());
        assert.deepEqual([await stateOf(E1), await stateOf(E2)], ['SCHEDULED', 'SCHEDULED']);
        for (const id of [E1, E2]) {
            const events = (await pool.query(
                `SELECT actor_person_id FROM secure_assessment_exam_lifecycle_events WHERE exam_instance_id = $1 AND from_state = 'READY' AND to_state = 'SCHEDULED' ORDER BY occurred_at DESC LIMIT 1`, [id])).rows;
            assert.deepEqual(events, [{ actor_person_id: operator.personId }]);
        }
        const action = (await pool.query('SELECT demoted_exam_instance_ids FROM secure_assessment_institution_room_actions WHERE session_id = $1 AND revision = $2', [S1, emptied.revision])).rows[0];
        assert.deepEqual(action.demoted_exam_instance_ids.sort(), [E1, E2].sort());
        await unchanged(async () => {
            const extension = await post(o, `${P}/deadline`, { examInstanceId: E1, preparationDeadline: `${wibDay(1)}T21:00`, expectedRevision: 1, reason: 'Guru mata pelajaran sakit', confirmed: true, actionKey: randomUUID() });
            assert.deepEqual([extension.status, extension.body], [409, { error: 'marked_ready_before' }]);
        });
        const periodRead = ok(await o.request(`${P}?periodId=${period1}`));
        const items = periodRead.sessions.flatMap((s: Body) => s.exams);
        assert.equal(items.find((e: Body) => e.examInstanceId === E1).markedReadyBefore, true);
        assert.equal(items.find((e: Body) => e.examInstanceId === E3)?.markedReadyBefore, undefined);
        const key = randomUUID();
        const restore = { sessionId: S1, roomLabel: 'Ruang 1', proctorElligbleIds: ['pengawas.satu'], expectedRevision: await rev(S1), actionKey: key };
        const restored = await post(o, `${R}/proctors`, restore);
        assert.equal(restored.status, 200, JSON.stringify(restored.body));
        await unchanged(async () => {
            const replay = await post(o, `${R}/proctors`, restore);
            assert.deepEqual([replay.status, replay.body], [200, { ...restored.body, replayed: true }]);
        });
        assert.deepEqual(ok(await markReady(E1)), { examInstanceId: E1, lifecycleState: 'READY' });
        assert.deepEqual(ok(await markReady(E2)), { examInstanceId: E2, lifecycleState: 'READY' });
    });

    await t.test('I-17 (route part) a READY exam placed before 0063 gets TRUE/TRUE at its first room write and is re-checked', async () => {
        const S4 = await createSession(o, period1, wibDay(8), '08:00', '09:00');
        const legacy = await inTransaction(pool, async c => {
            const session = (await c.query('SELECT starts_at, ends_at FROM secure_assessment_institution_exam_sessions WHERE id = $1', [S4])).rows[0];
            const id = (await c.query(
                `INSERT INTO secure_assessment_exam_instances (tenant_id, teaching_assignment_id, assessment_type_id, lifecycle_state, window_starts_at, window_ends_at,
                    configured_attempt_duration_seconds, latest_start_policy, room_based_operations_enabled, proctor_per_room_required, institution_session_id)
                 VALUES ($1, $2, $3, 'READY', $4, $5, 1800, 'FULL_DURATION_BEYOND_WINDOW', FALSE, FALSE, $6) RETURNING id`,
                [tenant, teaching.teachingAssignmentId, teaching.assessmentTypeId, session.starts_at, session.ends_at, S4])).rows[0].id as string;
            await c.query('INSERT INTO secure_assessment_exam_participants (tenant_id, exam_instance_id, person_id, academic_enrollment_id) VALUES ($1, $2, $3, $4)',
                [tenant, id, s1.personId, s1.enrollmentId]);
            return id;
        });
        const view = await roomView(S4);
        assert.deepEqual([roomExam(view, legacy).roomBased, roomExam(view, legacy).roomReadiness], [false, { status: 'room_proctor_readiness_not_applicable' }]);
        const moved = ok(await place(S4, 'Ruang Lama', [await pid(legacy, s1.personId)]));
        assert.deepEqual(moved.demoted, [legacy], 'no Proctor yet: re-checked and scheduled again');
        const flags = (await pool.query('SELECT room_based_operations_enabled AS r, proctor_per_room_required AS p, lifecycle_state FROM secure_assessment_exam_instances WHERE id = $1', [legacy])).rows[0];
        assert.deepEqual(flags, { r: true, p: true, lifecycle_state: 'SCHEDULED' });
    });

    await t.test('I-15 concurrency serializes to one consistent outcome', async () => {
        // Two writes with the same revision: one succeeds, the other is stale.
        const at = await rev(S1);
        const pair = await Promise.all([
            post(o, `${R}/participants`, { sessionId: S1, roomLabel: 'Ruang 4', participantIds: [E1s1], expectedRevision: at, actionKey: randomUUID() }),
            post(o, `${R}/participants`, { sessionId: S1, roomLabel: 'Ruang 5', participantIds: [E1s2], expectedRevision: at, actionKey: randomUUID() }),
        ]);
        assert.deepEqual(pair.map(r => r.status).sort(), [200, 409], JSON.stringify(pair.map(r => r.body)));
        assert.deepEqual(pair.find(r => r.status === 409)!.body, { error: 'stale_assignment', revision: at + 1 });
        ok(await place(S1, 'Ruang 1', [E1s1, E1s2]));
        assert.equal(await stateOf(E1), 'SCHEDULED');
        // A room write racing mark ready serializes on the exam lock: E1 ends READY with a complete room.
        const raced = await Promise.all([markReady(E1), proctors(S1, 'Ruang 1', ['pengawas.satu', 'pengawas.tiga'])]);
        assert.deepEqual(raced.map(r => r.status), [200, 200], JSON.stringify(raced.map(r => r.body)));
        assert.equal(await stateOf(E1), 'READY');
        assert.equal(roomExam(await roomView(S1), E1).roomReadiness.status, 'room_proctor_readiness_ready');
        // The same new label in two overlapping sessions at once: one room_conflict.
        const s1Rev = await rev(S1), s2Rev = await rev(S2);
        const labels = await Promise.all([
            post(o, `${R}/participants`, { sessionId: S1, roomLabel: 'Ruang Serentak', participantIds: [E2y1], expectedRevision: s1Rev, actionKey: randomUUID() }),
            post(o, `${R}/participants`, { sessionId: S2, roomLabel: 'Ruang Serentak', participantIds: [E3z1], expectedRevision: s2Rev, actionKey: randomUUID() }),
        ]);
        assert.deepEqual(labels.map(r => r.status).sort(), [200, 422], JSON.stringify(labels.map(r => r.body)));
        assert.deepEqual(labels.find(r => r.status === 422)!.body.problems, [{ code: 'room_conflict' }]);
        if (labels[0].status === 200) ok(await place(S1, 'Ruang 1', [E2y1]));
        else ok(await place(S2, 'Ruang 9', [E3z1]));
        // One Proctor assigned in two overlapping sessions at once: one proctor_schedule_conflict.
        const p1Rev = await rev(S1), p2Rev = await rev(S2);
        const proctorRace = await Promise.all([
            post(o, `${R}/proctors`, { sessionId: S1, roomLabel: 'Ruang 1', proctorElligbleIds: ['pengawas.satu', 'pengawas.tiga', 'pengawas.empat'], expectedRevision: p1Rev, actionKey: randomUUID() }),
            post(o, `${R}/proctors`, { sessionId: S2, roomLabel: 'Ruang 9', proctorElligbleIds: ['pengawas.dua', 'pengawas.empat'], expectedRevision: p2Rev, actionKey: randomUUID() }),
        ]);
        assert.deepEqual(proctorRace.map(r => r.status).sort(), [200, 422], JSON.stringify(proctorRace.map(r => r.body)));
        assert.deepEqual(proctorRace.find(r => r.status === 422)!.body.problems, [{ code: 'proctor_schedule_conflict', count: 1, elligbleIds: ['pengawas.empat'] }]);
        // The same new student added at once to overlapping exams of S1 and S2: one schedule_conflict (F8).
        const a1 = await rev(S1), a2 = await rev(S2);
        const additions = await Promise.all([
            post(o, `${P}/participants`, { examInstanceId: E1, enrollmentIds: [s6.enrollmentId], roomLabel: 'Ruang 1', expectedRevision: a1, actionKey: randomUUID() }),
            post(o, `${P}/participants`, { examInstanceId: E3, enrollmentIds: [s6Z], roomLabel: 'Ruang 9', expectedRevision: a2, actionKey: randomUUID() }),
        ]);
        assert.deepEqual(additions.map(r => r.status).sort(), [201, 422], JSON.stringify(additions.map(r => r.body)));
        assert.deepEqual(additions.find(r => r.status === 422)!.body.problems, [{ code: 'schedule_conflict', count: 1 }]);
        assert.equal((await pool.query('SELECT count(*)::int AS n FROM secure_assessment_exam_participants WHERE person_id = $1', [s6.personId])).rows[0].n, 1);
    });

    await t.test('I-11 cancelled exams are frozen and never counted; an opened exam refuses every write that touches it', async () => {
        // E2 keeps y1 in "Ruang 1" and has y2 alone in "Ruang Fisika" with P6.
        ok(await place(S1, 'Ruang Fisika', [E2y2]));
        ok(await proctors(S1, 'Ruang Fisika', ['pengawas.enam']));
        // The cancellation racing a Proctor change of "Ruang 1" serializes on the exam lock.
        const raced = await Promise.all([
            post(o, `${P}/cancel`, { examInstanceId: E2, reason: 'Ujian dipindahkan', confirmed: true, actionKey: randomUUID() }),
            proctors(S1, 'Ruang 1', ['pengawas.satu']),
        ]);
        assert.deepEqual(raced.map(r => r.status), [200, 200], JSON.stringify(raced.map(r => r.body)));
        assert.equal(await stateOf(E2), 'ARCHIVED');
        const frozen = async () => ({
            rooms: await roomsOf(E2),
            proctors: (await pool.query('SELECT id, person_id, revoked_at FROM secure_assessment_proctor_assignments WHERE exam_instance_id = $1 ORDER BY id', [E2])).rows,
            mappings: (await pool.query('SELECT id, proctor_assignment_id, exam_room_id FROM secure_assessment_exam_proctor_room_assignments WHERE exam_instance_id = $1 ORDER BY id', [E2])).rows,
            placed: (await pool.query('SELECT id, exam_room_id FROM secure_assessment_exam_participant_room_assignments WHERE exam_instance_id = $1 ORDER BY id', [E2])).rows,
        });
        const before = await frozen();
        assert.deepEqual(before.rooms.map(r => r.display_label), ['Ruang 1', 'Ruang Fisika']);
        const view = await roomView(S1);
        assert.deepEqual(view.exams.map((e: Body) => e.examInstanceId), [E1], 'E2 is absent from the view');
        const e1Count = (await pool.query('SELECT count(*)::int AS n FROM secure_assessment_exam_participants WHERE exam_instance_id = $1', [E1])).rows[0].n;
        assert.deepEqual(view.rooms.map((r: Body) => [r.label, r.participantCount, r.groups.map((g: Body) => g.examInstanceId)]), [['Ruang 1', e1Count, [E1]]]);
        await unchanged(async () => {
            assert.deepEqual(invalid(await place(S1, 'Ruang 1', [E2y2])), [{ code: 'participant_unknown' }]);
            assert.deepEqual(invalid(await proctors(S1, 'Ruang Fisika', ['pengawas.satu'])), [{ code: 'room_unknown' }]);
            // An addition to the cancelled exam itself is refused by its state.
            const r = await addition(E2, S1, [randomUUID()], 'Ruang 1');
            assert.deepEqual([r.status, r.body], [409, { error: 'invalid_state', examInstanceId: E2, currentState: 'ARCHIVED' }]);
        });
        // A cancelled exam's Proctor and label do not count (F1).
        ok(await proctors(S1, 'Ruang 1', ['pengawas.satu', 'pengawas.enam']));
        ok(await place(S2, 'Ruang Fisika', [E3z1]));
        ok(await place(S2, 'Ruang 9', [E3z1]));
        // Later moves and Proctor changes of "Ruang 1" leave the cancelled exam's rows as they were.
        ok(await place(S1, 'Ruang 6', [E1s1]));
        ok(await place(S1, 'Ruang 1', [E1s1]));
        ok(await proctors(S1, 'Ruang 1', ['pengawas.satu']));
        assert.deepEqual(await frozen(), before);
        const fisika = before.rooms.find(r => r.display_label === 'Ruang Fisika')!.id;
        await assert.rejects(pool.query('DELETE FROM secure_assessment_exam_rooms WHERE id = $1', [fisika]),
            (error: { code?: string; constraint?: string }) => error.code === '23514' && error.constraint === 'ck_sa_institution_exam_room_frozen');

        // E1 opened by fixture SQL: every write that touches it is invalid_state.
        if (await stateOf(E1) !== 'READY') ok(await markReady(E1));
        await pool.query(`UPDATE secure_assessment_exam_instances SET lifecycle_state = 'ACTIVE' WHERE id = $1`, [E1]);
        try {
            await unchanged(async () => {
                const opened = { error: 'invalid_state', examInstanceId: E1, currentState: 'ACTIVE' };
                for (const r of [await place(S1, 'Ruang 7', [E1s1]), await proctors(S1, 'Ruang 1', ['pengawas.satu', 'pengawas.tiga']), await addition(E1, S1, [s5.enrollmentId], 'Ruang 1')]) {
                    assert.deepEqual([r.status, r.body], [409, opened]);
                }
                const view2 = await roomView(S1);
                assert.deepEqual([roomExam(view2, E1).editable, roomExam(view2, E1).roomReadiness, roomExam(view2, E1).candidates], [false, null, []]);
            });
        } finally {
            await pool.query(`UPDATE secure_assessment_exam_instances SET lifecycle_state = 'READY' WHERE id = $1`, [E1]);
        }
    });

    await t.test('I-12 / §4.9 every route refuses every other role, another school and a revoked Operator (N01..N04, N08, N10) and changes nothing', async () => {
        const routes = async (): Promise<Array<[string, string, Body | null]>> => [
            ['GET', `${R}?sessionId=${S1}`, null],
            ['POST', `${R}/participants`, { sessionId: S1, roomLabel: 'Ruang 1', participantIds: [E1s1], expectedRevision: await rev(S1), actionKey: randomUUID() }],
            ['POST', `${R}/proctors`, { sessionId: S1, roomLabel: 'Ruang 1', proctorElligbleIds: ['pengawas.tiga'], expectedRevision: await rev(S1), actionKey: randomUUID() }],
            ['POST', `${P}/participants`, { examInstanceId: E1, enrollmentIds: [s5.enrollmentId], roomLabel: 'Ruang 1', expectedRevision: await rev(S1), actionKey: randomUUID() }],
        ];
        const call = (c: BrowserLikeClient, [method, path, body]: [string, string, Body | null]): Promise<ClientResponse> => c.request(path, body ? { method, body } : { method });
        await operatorAssignment(pool, tenant, revokedOperator.personId, 'REVOKE');
        await unchanged(async () => {
            const refused: Array<[string, BrowserLikeClient]> = [['the subject Teacher', tc], ['a Proctor', pc], ['a Homeroom Teacher', hc], ['a Student', sc],
                ['the other school Operator', foreignInOurs], ['no membership', noMembership], ['a revoked Operator', oRevoked]];
            for (const [who, c] of refused) {
                for (const route of await routes()) { const r = await call(c, route); assert.deepEqual([r.status, r.body], [403, { error: 'forbidden' }], `${who} ${route[0]} ${route[1]}`); }
            }
            for (const route of await routes()) assert.equal((await call(anonymous, route)).status, 401, `anonymous ${route[1]}`);
            // N02: the other school's Operator in its own school reaches no object of this one.
            for (const route of (await routes())) {
                const r = await call(foreign, route);
                assert.deepEqual([r.status, r.body], [403, { error: 'forbidden' }], route[1]);
            }
            // The Operator on a foreign, unknown or teacher-managed object: 403, uniform.
            for (const sessionId of [foreignSession, randomUUID()]) {
                assert.deepEqual((await o.request(`${R}?sessionId=${sessionId}`)).body, { error: 'forbidden' });
                assert.deepEqual((await post(o, `${R}/participants`, { sessionId, roomLabel: 'Ruang 1', participantIds: [E1s1], expectedRevision: 0, actionKey: randomUUID() })).body, { error: 'forbidden' });
                assert.deepEqual((await post(o, `${R}/proctors`, { sessionId, roomLabel: 'Ruang 1', proctorElligbleIds: [], expectedRevision: 0, actionKey: randomUUID() })).body, { error: 'forbidden' });
            }
            for (const examInstanceId of [foreignExam, managed, randomUUID()]) {
                assert.deepEqual((await post(o, `${P}/participants`, { examInstanceId, enrollmentIds: [s5.enrollmentId], roomLabel: 'Ruang 1', expectedRevision: 0, actionKey: randomUUID() })).body, { error: 'forbidden' }, examInstanceId);
            }
            // N02: a foreign participant and a nonexistent one get the same bytes.
            const foreignOne = await place(S1, 'Ruang 1', [foreignParticipant]);
            const unknownOne = await place(S1, 'Ruang 1', [randomUUID()]);
            assert.deepEqual(invalid(foreignOne), [{ code: 'participant_unknown' }]);
            assert.equal(JSON.stringify(foreignOne.body), JSON.stringify(unknownOne.body));
            // N08: spoofed fields and anything outside the exact body are 400.
            for (const [path, body] of [
                [`${R}/participants`, { sessionId: S1, roomLabel: 'Ruang 1', participantIds: [E1s1], expectedRevision: 0, actionKey: randomUUID(), actorPersonId: operator.personId }],
                [`${R}/participants`, { sessionId: S1, roomLabel: 'Ruang 1', participantIds: [E1s1], expectedRevision: 0, actionKey: randomUUID(), tenantId: tenant }],
                [`${R}/proctors`, { sessionId: S1, roomLabel: 'Ruang 1', proctorElligbleIds: [], expectedRevision: 0, actionKey: randomUUID(), membershipIds: [] }],
                [`${R}/proctors`, { sessionId: S1, roomLabel: 'Ruang 1', proctorElligbleIds: ['ELG-ABCD-EFGH-JKMN', ' elg-abcd-efgh-jkmn '], expectedRevision: 0, actionKey: randomUUID() }],
                [`${P}/participants`, { examInstanceId: E1, enrollmentIds: [s5.enrollmentId], roomLabel: 'Ruang 1', expectedRevision: 0, actionKey: randomUUID(), tenantId: tenant }],
                [`${P}/participants`, { examInstanceId: E1, enrollmentIds: [s5.enrollmentId], expectedRevision: 0, actionKey: randomUUID() }],
            ] as Array<[string, Body]>) {
                assert.deepEqual((await post(o, path, body)).body, { error: 'invalid_request' }, path);
            }
            for (const query of [`sessionId=${S1}&tenantId=${tenant}`, 'sessionId=nope', '']) assert.deepEqual((await o.request(`${R}?${query}`)).body, { error: 'invalid_request' }, query);
            // N01: an unavailable database gives 503 with nothing written.
            const unavailable = { connect: async () => { throw Object.assign(new Error('database unavailable'), { code: 'ECONNREFUSED' }); }, query: async () => { throw new Error('database unavailable'); } };
            const down = await startProductionWiredServer(unavailable as unknown as pg.Pool);
            try {
                const dc = new BrowserLikeClient(down.baseUrl);
                dc.cookie = o.cookie;
                dc.tenantId = tenant;
                for (const route of await routes()) { const r = await call(dc, route); assert.deepEqual([r.status, r.body], [503, { error: 'persistence_unavailable' }], route[1]); }
            } finally {
                await down.close();
            }
        });
        // N04: the Teacher and Proctor routes gain nothing: the subject Teacher's addition still refuses an institution exam.
        const teacherAdd = await post(tc, '/api/v1/assessment/teacher-exams/participants/add', { examInstanceId: E1, enrollmentIds: [s5.enrollmentId], reason: 'Uji guru mata pelajaran', confirmed: true, actionKey: randomUUID() });
        assert.deepEqual([teacherAdd.status, teacherAdd.body], [409, { error: 'institution_managed' }]);
    });

    await t.test('N07 authority at commit: an Operator assignment revoked while a room write waits gives 403 with nothing written', async () => {
        const waiting = await staff('operator.menunggu');
        await operatorAssignment(pool, tenant, waiting.personId, 'ASSIGN');
        const ow = await login(waiting);
        const before = await counts(pool);
        const revoker = await pool.connect();
        try {
            await revoker.query('BEGIN');
            await setSchoolOperator(revoker, { tenantId: tenant, personId: waiting.personId, action: 'REVOKE', operator: 'Synthetic CI operator', caseReference: 'ASSESS-INSTITUTION-002', reason: 'Synthetic revocation' });
            const pending = post(ow, `${R}/participants`, { sessionId: S1, roomLabel: 'Ruang 8', participantIds: [E1s1], expectedRevision: await rev(S1), actionKey: randomUUID() });
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
        const after = await counts(pool);
        delete before['tenant_school_operator_assignments'];
        delete after['tenant_school_operator_assignments'];
        assert.deepEqual(after, before);
    });

    await t.test('I-16 teacher-managed exams and different sessions still conflict on one Proctor; one room of one session does not', async () => {
        const at = (days: number, hour: number) => new Date(`${wibDay(days)}T${String(hour).padStart(2, '0')}:00:00+07:00`);
        const tm1 = await createExamInstance(pool, tenant, teaching, { lifecycleState: 'SCHEDULED', windowStartsAt: at(12, 8), windowEndsAt: at(12, 10) });
        const tm2 = await createExamInstance(pool, tenant, teaching, { lifecycleState: 'SCHEDULED', windowStartsAt: at(12, 9), windowEndsAt: at(12, 11) });
        await addProctorAssignment(pool, tenant, tm1, unassigned.personId);
        await addProctorAssignment(pool, tenant, tm2, unassigned.personId);
        const Sa = await createSession(o, period1, wibDay(13), '08:00', '10:00');
        const Sb = await createSession(o, period2, wibDay(13), '09:00', '11:00');
        const fixture = async (sessionId: string, label: string) => inTransaction(pool, async c => {
            const s = (await c.query('SELECT starts_at, ends_at FROM secure_assessment_institution_exam_sessions WHERE id = $1', [sessionId])).rows[0];
            const exam = (await c.query(
                `INSERT INTO secure_assessment_exam_instances (tenant_id, teaching_assignment_id, assessment_type_id, lifecycle_state, window_starts_at, window_ends_at,
                    configured_attempt_duration_seconds, latest_start_policy, room_based_operations_enabled, proctor_per_room_required, institution_session_id)
                 VALUES ($1, $2, $3, 'SCHEDULED', $4, $5, 1800, 'FULL_DURATION_BEYOND_WINDOW', TRUE, TRUE, $6) RETURNING id`,
                [tenant, teaching.teachingAssignmentId, teaching.assessmentTypeId, s.starts_at, s.ends_at, sessionId])).rows[0].id as string;
            const room = (await c.query('INSERT INTO secure_assessment_exam_rooms (tenant_id, exam_instance_id, display_label) VALUES ($1, $2, $3) RETURNING id', [tenant, exam, label])).rows[0].id;
            const assignment = (await c.query('INSERT INTO secure_assessment_proctor_assignments (tenant_id, exam_instance_id, person_id) VALUES ($1, $2, $3) RETURNING id', [tenant, exam, unassigned.personId])).rows[0].id;
            await c.query('INSERT INTO secure_assessment_exam_proctor_room_assignments (tenant_id, exam_instance_id, proctor_assignment_id, exam_room_id) VALUES ($1, $2, $3, $4)', [tenant, exam, assignment, room]);
            return exam;
        });
        const sameRoomA = await fixture(Sa, 'Lab');
        const sameRoomB = await fixture(Sa, 'lab');
        const otherSession = await fixture(Sb, 'Lab');
        const c = await pool.connect();
        try {
            const check = (examId: string) => checkExamInstanceParticipantProctorScheduleConflictReadiness(c, tenant, examId, async () => 'granted' as const);
            const r1 = await check(tm1);
            assert.deepEqual([r1.type, 'blocker' in r1 ? r1.blocker : null], ['not_ready', 'proctor_schedule_conflict'], 'two teacher-managed exams');
            // sameRoomA and sameRoomB share the room of Sa (exempt), but otherSession is another session (a conflict).
            const r2 = await check(sameRoomA);
            assert.deepEqual([r2.type, 'conflictingExamInstanceId' in r2 ? r2.conflictingExamInstanceId : null], ['not_ready', otherSession]);
            await pool.query('UPDATE secure_assessment_proctor_assignments SET revoked_at = statement_timestamp() WHERE exam_instance_id = $1', [otherSession]);
            assert.equal((await check(sameRoomA)).type, 'schedule_conflict_ready', 'one physical room of one session is no conflict (RP-2)');
            assert.equal((await check(sameRoomB)).type, 'schedule_conflict_ready');
            // Another room of the same session is a conflict.
            const third = await fixture(Sa, 'Aula');
            const r3 = await check(third);
            assert.deepEqual([r3.type, 'blocker' in r3 ? r3.blocker : null], ['not_ready', 'proctor_schedule_conflict']);
        } finally {
            c.release();
        }
    });

    await t.test('I-14 no Operator response carries a name, NIS, NISN, birth date, membership, question, key, rubric or score; there is no member directory', async () => {
        const bodies = [...receipts, await roomView(S1), await roomView(S2), await roomView(S3)];
        const keys = keysOf(bodies);
        for (const key of ['fullName', 'name', 'nis', 'nisn', 'birthDate', 'membershipId', 'prompt', 'options', 'correct', 'correctOptionId', 'rubric', 'score', 'frozenContent']) {
            assert.equal(keys.has(key), false, key);
        }
        const text = JSON.stringify(bodies);
        assert.equal(text.includes('Soal nomor'), false, 'no question text');
        for (const id of ['staf.lain', 'pengawas.empat', 'walikelas.ruang', 'operator.ruang']) {
            assert.equal(JSON.stringify([await roomView(S1), await roomView(S3)]).includes(id), false, `${id}: no list of members`);
        }
    });

    await t.test('I-18 the edge of every new POST path: a foreign Origin and a 65 KiB body are refused before any effect', async () => {
        await unchanged(async () => {
            for (const path of [`${R}/participants`, `${R}/proctors`, `${P}/participants`]) {
                const r = await o.request(path, { method: 'POST', body: { sessionId: S1 }, origin: 'https://lain.example' });
                assert.deepEqual([r.status, r.body], [403, { error: 'origin_not_allowed' }], path);
                const large = await o.request(path, { method: 'POST', rawBody: JSON.stringify({ roomLabel: 'x'.repeat(65 * 1024) }), headers: { 'Content-Type': 'application/json' } });
                assert.deepEqual([large.status, large.body], [413, { error: 'payload_too_large' }], path);
            }
        });
    });
});

test('ASSESS-INSTITUTION-002 C03 migration 0063 (I-17): upgrade on a populated database, rollback, repeat, append-only and the room policy', { skip: skipWithoutDatabase }, async t => {
    const db = await createDisposableDatabase({ migrate: false });
    t.after(() => db.close());
    const c = await db.pool.connect();
    try {
        const dir = new URL('../../../../database/migrations/', import.meta.url);
        for (const name of (await readdir(dir)).filter(n => /^\d{4}.*\.sql$/.test(n) && n < '0063').sort()) await c.query(await readFile(new URL(name, dir), 'utf8'));
        // A populated database: institution exams SCHEDULED, READY and ARCHIVED, and a teacher-managed exam, all FALSE/FALSE.
        const tenant = await createTenant(db.pool);
        const teacher = await createPersonWithAccount(db.pool);
        const teaching: TeachingContext = await createTeachingContext(db.pool, tenant, await addMembership(db.pool, tenant, teacher.personId), 'IPA');
        const managed = await createExamInstance(db.pool, tenant, teaching, { lifecycleState: 'SCHEDULED' });
        const academicPeriodId = (await c.query('SELECT o.academic_period_id FROM academic_core_teaching_assignments a JOIN academic_core_subject_offerings o ON o.id = a.subject_offering_id WHERE a.id = $1',
            [teaching.teachingAssignmentId])).rows[0].academic_period_id;
        const period = (await c.query(
            `INSERT INTO secure_assessment_institution_exam_periods (tenant_id, academic_period_id, assessment_type_id, label, created_by_person_id, action_key, request_digest)
             VALUES ($1, $2, $3, 'PTS', $4, gen_random_uuid(), repeat('a', 64)) RETURNING id`, [tenant, academicPeriodId, teaching.assessmentTypeId, teacher.personId])).rows[0].id;
        const session = (await c.query(
            `INSERT INTO secure_assessment_institution_exam_sessions (tenant_id, period_id, starts_at, ends_at, created_by_person_id, action_key, request_digest)
             VALUES ($1, $2, statement_timestamp() + interval '2 days', statement_timestamp() + interval '2 days 2 hours', $3, gen_random_uuid(), repeat('a', 64)) RETURNING id`,
            [tenant, period, teacher.personId])).rows[0].id;
        const institution = async (state: string) => (await c.query(
            `INSERT INTO secure_assessment_exam_instances (tenant_id, teaching_assignment_id, assessment_type_id, lifecycle_state, window_starts_at, window_ends_at,
                configured_attempt_duration_seconds, latest_start_policy, room_based_operations_enabled, proctor_per_room_required, institution_session_id)
             SELECT $1, $2, $3, $4, s.starts_at, s.ends_at, 3600, 'FULL_DURATION_BEYOND_WINDOW', FALSE, FALSE, s.id
             FROM secure_assessment_institution_exam_sessions s WHERE s.id = $5 RETURNING id`, [tenant, teaching.teachingAssignmentId, teaching.assessmentTypeId, state, session])).rows[0].id as string;
        const scheduled = await institution('SCHEDULED');
        const ready = await institution('READY');
        const archived = await institution('ARCHIVED');
        const flags = async () => Object.fromEntries((await c.query(
            `SELECT id, room_based_operations_enabled AS r, proctor_per_room_required AS p FROM secure_assessment_exam_instances WHERE id = ANY($1::uuid[])`,
            [[scheduled, ready, archived, managed]])).rows.map(r => [r.id, [r.r, r.p]]));
        const states = async () => (await c.query('SELECT string_agg(id::text || lifecycle_state, \',\' ORDER BY id) AS s FROM secure_assessment_exam_instances')).rows[0].s;
        const events = async () => (await c.query('SELECT count(*)::int AS n FROM secure_assessment_exam_lifecycle_events')).rows[0].n;
        const shape = async () => (await c.query(
            `SELECT (SELECT count(*)::int FROM pg_tables WHERE tablename IN ('secure_assessment_institution_room_actions', 'secure_assessment_institution_room_action_entries')) AS tables,
                    (SELECT count(*)::int FROM pg_trigger WHERE tgname IN ('trg_prevent_sa_institution_room_action_mutation', 'trg_prevent_sa_institution_room_entry_mutation',
                        'trg_guard_sa_institution_exam_room')) AS triggers,
                    (SELECT count(*)::int FROM pg_proc WHERE proname IN ('guard_sa_institution_exam_room', 'prevent_sa_institution_room_history_mutation')) AS functions`)).rows[0];
        const allFalse = { [scheduled]: [false, false], [ready]: [false, false], [archived]: [false, false], [managed]: [false, false] };
        assert.deepEqual(await shape(), { tables: 0, triggers: 0, functions: 0 });
        assert.deepEqual(await flags(), allFalse);
        const statesBefore = await states();
        const eventsBefore = await events();
        const sql = await readFile(new URL('0063_secure_assessment_institution_rooms.sql', dir), 'utf8');
        const failing = sql.replace("INSERT INTO elligble_migration_history (migration_id) VALUES ('0063_secure_assessment_institution_rooms');", "RAISE EXCEPTION 'synthetic migration rollback';");
        assert.notEqual(failing, sql);
        await assert.rejects(c.query(failing), /synthetic migration rollback/);
        await c.query('ROLLBACK');
        assert.deepEqual(await shape(), { tables: 0, triggers: 0, functions: 0 }, 'the failed migration left nothing behind');
        assert.deepEqual(await flags(), allFalse, 'nor any policy change');
        await c.query(sql);
        await c.query(sql);
        assert.equal((await c.query("SELECT count(*)::int AS n FROM elligble_migration_history WHERE migration_id = '0063_secure_assessment_institution_rooms'")).rows[0].n, 1);
        assert.deepEqual(await shape(), { tables: 2, triggers: 3, functions: 2 });
        // RP-1: SCHEDULED institution exams become TRUE/TRUE; READY, ARCHIVED and teacher-managed exams are unchanged; no lifecycle row.
        assert.deepEqual(await flags(), { ...allFalse, [scheduled]: [true, true] });
        assert.equal(await states(), statesBefore);
        assert.equal(await events(), eventsBefore);
        // The new tables are append-only.
        const participant = (await c.query('INSERT INTO secure_assessment_exam_participants (tenant_id, exam_instance_id, person_id) VALUES ($1, $2, $3) RETURNING id',
            [tenant, scheduled, teacher.personId])).rows[0].id;
        const action = (await c.query(
            `INSERT INTO secure_assessment_institution_room_actions (tenant_id, session_id, kind, revision, actor_person_id, action_key, request_digest)
             VALUES ($1, $2, 'ROOM_PARTICIPANTS', 1, $3, gen_random_uuid(), repeat('b', 64)) RETURNING id`, [tenant, session, teacher.personId])).rows[0].id;
        await c.query(
            `INSERT INTO secure_assessment_institution_room_action_entries (tenant_id, action_id, exam_instance_id, entry_kind, exam_participant_id, room_label)
             VALUES ($1, $2, $3, 'PARTICIPANT_ROOM', $4, 'Ruang 1')`, [tenant, action, scheduled, participant]);
        for (const table of ['secure_assessment_institution_room_actions', 'secure_assessment_institution_room_action_entries']) {
            await assert.rejects(c.query(`UPDATE ${table} SET tenant_id = tenant_id`), /append-only/, table);
            await assert.rejects(c.query(`DELETE FROM ${table}`), /append-only/, table);
        }
        // The constraints of the history.
        const entry = (fields: string, values: string) => c.query(
            `INSERT INTO secure_assessment_institution_room_action_entries (tenant_id, action_id, exam_instance_id, ${fields}) VALUES ($1, $2, $3, ${values})`, [tenant, action, scheduled, participant]);
        await assert.rejects(entry('entry_kind, exam_participant_id, room_label', "'PARTICIPANT_ROOM', $4, 'Ruang  1'"), /ck_sa_institution_room_entry_label/);
        await assert.rejects(entry('entry_kind, exam_participant_id, from_room_label, room_label', "'PARTICIPANT_ROOM', $4, 'ruang 1', 'Ruang 1'"), /ck_sa_institution_room_entry_shape/);
        await assert.rejects(entry('entry_kind, exam_participant_id, room_label', "'PROCTOR_ASSIGNED', $4, 'Ruang 1'"), /ck_sa_institution_room_entry_shape/);
        await assert.rejects(c.query(
            `INSERT INTO secure_assessment_institution_room_actions (tenant_id, session_id, kind, revision, actor_person_id, action_key, request_digest)
             VALUES ($1, $2, 'ROOM_PARTICIPANTS', 1, $3, gen_random_uuid(), repeat('b', 64))`, [tenant, session, teacher.personId]), /uq_sa_institution_room_action_revision/);
        await assert.rejects(c.query(
            `INSERT INTO secure_assessment_institution_room_actions (tenant_id, session_id, kind, revision, actor_person_id, action_key, request_digest)
             VALUES ($1, $2, 'ROOM_MOVE', 2, $3, gen_random_uuid(), repeat('b', 64))`, [tenant, session, teacher.personId]), /ck_sa_institution_room_action_kind/);
        // The room guard: institution labels in one form and unique per exam; a teacher-managed exam as before.
        await c.query(`INSERT INTO secure_assessment_exam_rooms (tenant_id, exam_instance_id, display_label) VALUES ($1, $2, 'Ruang 1')`, [tenant, ready]);
        await assert.rejects(c.query(`INSERT INTO secure_assessment_exam_rooms (tenant_id, exam_instance_id, display_label) VALUES ($1, $2, 'ruang 1')`, [tenant, ready]), /uq_sa_institution_exam_room_label|one room per label/);
        await c.query(`INSERT INTO secure_assessment_exam_rooms (tenant_id, exam_instance_id, display_label) VALUES ($1, $2, ' x '), ($1, $2, ' x ')`, [tenant, managed]);
        await assert.rejects(c.query('DELETE FROM secure_assessment_exam_rooms WHERE exam_instance_id = $1', [archived]).then(async () => {
            await c.query(`INSERT INTO secure_assessment_exam_rooms (tenant_id, exam_instance_id, display_label) VALUES ($1, $2, 'Aula')`, [tenant, archived]);
            await c.query('DELETE FROM secure_assessment_exam_rooms WHERE exam_instance_id = $1', [archived]);
        }), /removed only while the exam is scheduled or ready/);
    } finally {
        c.release();
    }
});
