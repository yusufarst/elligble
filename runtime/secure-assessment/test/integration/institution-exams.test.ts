import { test } from 'node:test';
import * as assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import type pg from 'pg';
import { createDisposableDatabase, skipWithoutDatabase } from '../support/pg-harness.ts';
import {
    addMembership, addParticipant, addQuestionSnapshots, baselineQuestion, createExamInstance, createPersonWithAccount, createTeachingContext,
    createTenant, enrollInTeachingGroup, type TeachingContext,
} from '../support/fixtures.ts';
import { BrowserLikeClient, startProductionWiredServer, type ClientResponse } from '../support/test-server.ts';
import { setSchoolOperator } from '../../../tenant-access/src/school-operator.ts';
import { sha256Hex } from '../../src/teacher-exam-import.ts';
import { QUESTIONS_HEADER_V2_RUBRIC } from '../../src/question-import.ts';

// ASSESS-INSTITUTION-001 real PostgreSQL oracle (record §5, §4.9, C03) through the production-wired server:
// the School Operator composes a period, sessions and placements (I-1, I-2, I-12); the subject Teacher
// prepares and replaces the questions before the deadline (I-3, I-16); the content lock at the deadline,
// in the route and in the 0062 trigger, with the RESTRICT keys of delivered content (I-4) and the trigger's
// FOR SHARE against mark ready in both orders (I-4b); extension (I-5), mark ready (I-6) and cancellation
// (I-7); the subject Teacher's refusals and kept powers (I-8); every authority denial of the P5 trace with
// zero mutation (I-9, §4.9 N01..N10); minimization (I-10); concurrency (I-11); Student discovery (I-15);
// the edge (I-17). Migration 0062 upgrade, rollback and repeat is the second test (I-14).

const P = '/api/v1/assessment/institution-exams';
const CONTENT = '/api/v1/assessment/teacher-exams/content';
const row = (head: string) => [head, ...Array(24).fill('')].join(';');
const file = (...rows: string[]) => [QUESTIONS_HEADER_V2_RUBRIC.join(';'), ...rows.map(row)].join('\r\n') + '\r\n';
const FILE_A = file('1;PG;Ibu kota Indonesia adalah;Bandung;Jakarta;Surabaya;Medan;Makassar;B;1', '2;BS;Matahari terbit di timur;;;;;;B;1');
const FILE_B = file('1;PG;Hasil dari 6 x 7 adalah;40;42;44;46;48;B;1', '2;PG;Bilangan prima terkecil adalah;0;1;2;3;4;C;1', '3;BS;Air membeku pada 0 derajat Celsius;;;;;;B;1');
const FILE_BAD = file('1;PG;;Bandung;Jakarta;Surabaya;Medan;Makassar;B;1');
const PROMPTS = ['Ibu kota Indonesia adalah', 'Matahari terbit di timur', 'Hasil dari 6 x 7 adalah', 'Bilangan prima terkecil adalah'];
const TRIGGER_REFUSAL = /change only while it is scheduled and before its preparation deadline/;
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
/** The instant of a WIB wall-clock value. */
const wibInstant = (local: string) => new Date(`${local}:00+07:00`).toISOString();

type Body = Record<string, unknown>;
const post = (c: BrowserLikeClient, path: string, body: Body) => c.request(path, { method: 'POST', body });

const TABLES = [
    'secure_assessment_institution_exam_periods', 'secure_assessment_institution_exam_sessions', 'secure_assessment_institution_preparation_deadlines',
    'secure_assessment_exam_instances', 'secure_assessment_exam_participants', 'secure_assessment_exam_question_snapshots',
    'secure_assessment_question_import_batches', 'secure_assessment_exam_lifecycle_events', 'secure_assessment_exam_cancellations',
    'secure_assessment_permission_action_events', 'secure_assessment_exam_attempts', 'tenant_school_operator_assignments',
];
async function counts(pool: pg.Pool): Promise<Record<string, unknown>> {
    const result: Record<string, unknown> = {};
    for (const table of TABLES) result[table] = (await pool.query(`SELECT count(*)::int AS n FROM ${table}`)).rows[0].n;
    result['states'] = (await pool.query(`SELECT string_agg(id::text || ':' || lifecycle_state, ',' ORDER BY id) AS s FROM secure_assessment_exam_instances`)).rows[0].s;
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
    setSchoolOperator(c, { tenantId, personId, action, operator: 'Synthetic CI operator', caseReference: 'ASSESS-INSTITUTION-001', reason: 'Synthetic institution exams' }));

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
    for (let i = 0; i < 100; i++) {
        const r = await pool.query(
            `SELECT max(deadline_at) <= statement_timestamp() AS passed FROM secure_assessment_institution_preparation_deadlines WHERE exam_instance_id = $1`, [examId]);
        if (r.rows[0].passed === true) return;
        await sleep(200);
    }
    throw new Error('The deadline did not pass.');
}

/** Every key of a JSON value, recursively. */
function keysOf(value: unknown, into = new Set<string>()): Set<string> {
    if (Array.isArray(value)) value.forEach(v => keysOf(v, into));
    else if (value && typeof value === 'object') for (const [k, v] of Object.entries(value)) { into.add(k); keysOf(v, into); }
    return into;
}

function gate() {
    let reached!: () => void;
    let release!: () => void;
    const arrived = new Promise<void>(resolve => { reached = resolve; });
    const proceed = new Promise<void>(resolve => { release = resolve; });
    return { reached, release, arrived, proceed };
}

/** A pool whose connections pause right after the first query that `matches`, while enabled. */
function gatedPool(pool: pg.Pool, matches: (sql: string) => boolean, g: ReturnType<typeof gate>, enabled: () => boolean): pg.Pool {
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
                                    if (enabled() && !held && typeof args[0] === 'string' && matches(args[0])) {
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

test('ASSESS-INSTITUTION-001 C03 institution exams end to end through production wiring', { skip: skipWithoutDatabase, timeout: 480_000 }, async t => {
    const db = await createDisposableDatabase();
    const app = await startProductionWiredServer(db.pool);
    t.after(async () => { await app.close(); await db.close(); });
    const pool = db.pool;

    // Fixture: one school (WIB), rombel X with three students, Matematika x X held by T, the Operators O
    // and O2, a Proctor P, a Homeroom Teacher H, a second subject Teacher T2, a Teacher of another period,
    // and a second school with its own Operator.
    const tenant = await createTenant(pool, 'SMA Institusi');
    const teacher = await createPersonWithAccount(pool, 'guru.institusi');
    const tMembership = await addMembership(pool, tenant, teacher.personId);
    const teaching = await createTeachingContext(pool, tenant, tMembership, 'Matematika');
    const scope = (await pool.query(
        `SELECT o.academic_period_id, o.grade_level_id, g.academic_year_id FROM academic_core_teaching_assignments a
         JOIN academic_core_subject_offerings o ON o.id = a.subject_offering_id JOIN academic_core_academic_groups g ON g.id = a.academic_group_id
         WHERE a.id = $1`, [teaching.teachingAssignmentId])).rows[0];
    const academicPeriodId: string = scope.academic_period_id;
    const students: Array<{ personId: string; enrollmentId: string; username: string; password: string }> = [];
    for (const name of ['siswa.inst.1', 'siswa.inst.2', 'siswa.inst.3']) {
        const person = await createPersonWithAccount(pool, name);
        const enrollmentId = await enrollInTeachingGroup(pool, tenant, teaching, await addMembership(pool, tenant, person.personId));
        students.push({ ...person, enrollmentId });
    }
    const operator = await createPersonWithAccount(pool, 'operator.institusi');
    await addMembership(pool, tenant, operator.personId);
    await operatorAssignment(pool, tenant, operator.personId, 'ASSIGN');
    const operator2 = await createPersonWithAccount(pool, 'operator.dua');
    await addMembership(pool, tenant, operator2.personId);
    await operatorAssignment(pool, tenant, operator2.personId, 'ASSIGN');
    const proctor = await createPersonWithAccount(pool, 'pengawas.institusi');
    await addMembership(pool, tenant, proctor.personId);
    const homeroom = await createPersonWithAccount(pool, 'walikelas.institusi');
    const hMembership = await addMembership(pool, tenant, homeroom.personId);
    await pool.query(
        `INSERT INTO academic_core_homeroom_responsibilities (tenant_id, membership_id, academic_year_id, academic_period_id, academic_group_id)
         VALUES ($1, $2, $3, $4, $5)`, [tenant, hMembership, scope.academic_year_id, academicPeriodId, teaching.academicGroupId]);
    // A second subject (and a third, for N07) of rombel X in the same academic period, held by T2.
    const teacher2 = await createPersonWithAccount(pool, 'guru.fisika');
    const t2Assignment = (await pool.query('INSERT INTO tenant_teacher_assignments (tenant_id, membership_id) VALUES ($1, $2) RETURNING id',
        [tenant, await addMembership(pool, tenant, teacher2.personId)])).rows[0].id as string;
    const subjectTeaching = async (label: string, groupId = teaching.academicGroupId, teacherAssignmentId = t2Assignment) => {
        const subject = (await pool.query('INSERT INTO academic_core_subjects (tenant_id, display_label) VALUES ($1, $2) RETURNING id', [tenant, label])).rows[0].id;
        const offering = (await pool.query('INSERT INTO academic_core_subject_offerings (tenant_id, subject_id, academic_period_id, grade_level_id) VALUES ($1, $2, $3, $4) RETURNING id',
            [tenant, subject, academicPeriodId, scope.grade_level_id])).rows[0].id;
        return (await pool.query('INSERT INTO academic_core_teaching_assignments (tenant_id, teacher_assignment_id, subject_offering_id, academic_group_id) VALUES ($1, $2, $3, $4) RETURNING id',
            [tenant, teacherAssignmentId, offering, groupId])).rows[0].id as string;
    };
    const physics = await subjectTeaching('Fisika');
    const biology = await subjectTeaching('Biologi');
    // An empty rombel of the same period, taught by T (no participants on any date).
    const emptyGroup = (await pool.query(`INSERT INTO academic_core_academic_groups (tenant_id, academic_year_id, grade_level_id, display_label) VALUES ($1, $2, $3, 'X-2') RETURNING id`,
        [tenant, scope.academic_year_id, scope.grade_level_id])).rows[0].id as string;
    const tTeacherAssignment = (await pool.query('SELECT teacher_assignment_id FROM academic_core_teaching_assignments WHERE id = $1', [teaching.teachingAssignmentId])).rows[0].teacher_assignment_id;
    const emptyTeaching = await subjectTeaching('Matematika X-2', emptyGroup, tTeacherAssignment);
    const otherPeriodTeacher = await createPersonWithAccount(pool, 'guru.periode.lain');
    const otherPeriod = await createTeachingContext(pool, tenant, await addMembership(pool, tenant, otherPeriodTeacher.personId), 'Sejarah');
    const outsider = await createPersonWithAccount(pool, 'tanpa.keanggotaan');
    // The second school.
    const otherTenant = await createTenant(pool, 'SMA Lain');
    const foreignOperator = await createPersonWithAccount(pool, 'operator.lain');
    const foreignTeaching = await createTeachingContext(pool, otherTenant, await addMembership(pool, otherTenant, foreignOperator.personId), 'Matematika');
    await operatorAssignment(pool, otherTenant, foreignOperator.personId, 'ASSIGN');
    const foreignAcademicPeriod = (await pool.query('SELECT o.academic_period_id FROM academic_core_teaching_assignments a JOIN academic_core_subject_offerings o ON o.id = a.subject_offering_id WHERE a.id = $1',
        [foreignTeaching.teachingAssignmentId])).rows[0].academic_period_id as string;
    const foreignExam = await createExamInstance(pool, otherTenant, foreignTeaching, { lifecycleState: 'SCHEDULED' });

    const login = async (person: { username: string; password: string }, tenantId: string | null = tenant, base = app.baseUrl) => {
        const c = new BrowserLikeClient(base);
        assert.equal((await c.login(person.username, person.password)).status, 200, person.username);
        c.tenantId = tenantId;
        return c;
    };
    const o = await login(operator);
    const o2 = await login(operator2);
    const tc = await login(teacher);
    const t2c = await login(teacher2);
    const tOther = await login(otherPeriodTeacher);
    const pc = await login(proctor);
    const hc = await login(homeroom);
    const sc = await login(students[0]);
    const foreignInOurs = await login(foreignOperator);
    const foreign = await login(foreignOperator, otherTenant);
    const noMembership = await login(outsider);
    const anonymous = new BrowserLikeClient(app.baseUrl);
    anonymous.tenantId = tenant;

    let hour = 6;
    let day = 3;
    /** Distinct one-hour session slots on later days, so no two exams of rombel X overlap by accident. */
    const nextSlot = () => {
        if (hour > 20) { hour = 6; day++; }
        const h = String(hour++).padStart(2, '0');
        return { date: wibDay(day), startTime: `${h}:00`, endTime: `${h}:50` };
    };
    const createPeriod = async (c: BrowserLikeClient, label: string, body: Body = {}) => {
        const r = await post(c, `${P}/periods`, { label, assessmentTypeId: teaching.assessmentTypeId, academicPeriodId, actionKey: randomUUID(), ...body });
        assert.equal(r.status, 201, JSON.stringify(r.body));
        return r.body.periodId as string;
    };
    const createSession = async (periodId: string, slot = nextSlot(), c = o) => {
        const r = await post(c, `${P}/sessions`, { periodId, ...slot, actionKey: randomUUID() });
        assert.equal(r.status, 201, JSON.stringify(r.body));
        return r.body as { sessionId: string; startsAt: string; endsAt: string };
    };
    const placement = (sessionId: string, body: Body = {}) => ({
        sessionId, teachingAssignmentId: teaching.teachingAssignmentId, durationMinutes: 45, latestStartPolicy: 'FULL_DURATION_BEYOND_WINDOW',
        preparationDeadline: `${wibDay(1)}T20:00`, actionKey: randomUUID(), ...body,
    });
    const extend = (c: BrowserLikeClient, examInstanceId: string, expectedRevision: number, preparationDeadline: string, body: Body = {}) =>
        post(c, `${P}/deadline`, { examInstanceId, preparationDeadline, expectedRevision, reason: 'Guru mata pelajaran sakit', confirmed: true, actionKey: randomUUID(), ...body });
    const cancel = (c: BrowserLikeClient, examInstanceId: string, body: Body = {}) =>
        post(c, `${P}/cancel`, { examInstanceId, reason: 'Salah tempat', confirmed: true, actionKey: randomUUID(), ...body });
    const markReady = (c: BrowserLikeClient, examInstanceId: string) => post(c, `${P}/transition`, { examInstanceId, action: 'mark_ready' });
    const contentPreview = (c: BrowserLikeClient, examInstanceId: string, questionsCsv: string, sourceFileName: string | null = 'soal.csv') =>
        post(c, `${CONTENT}/preview`, { examInstanceId, questionsCsv, sourceFileName });
    const contentConfirm = (c: BrowserLikeClient, examInstanceId: string, questionsCsv: string, importKey = randomUUID(), expectedSha256 = sha256Hex(questionsCsv)) =>
        post(c, CONTENT, { examInstanceId, questionsCsv, sourceFileName: 'soal.csv', importKey, expectedSha256 });
    const card = async (examInstanceId: string, c = tc) => {
        const r = await c.request('/api/v1/assessment/teacher-readiness');
        assert.equal(r.status, 200, JSON.stringify(r.body));
        return r.body.exams.find((e: { examInstanceId: string }) => e.examInstanceId === examInstanceId);
    };
    const snapshotsOf = async (examId: string) => (await pool.query(
        'SELECT id, import_batch_id, display_order FROM secure_assessment_exam_question_snapshots WHERE exam_instance_id = $1 ORDER BY display_order', [examId])).rows;
    const receipts: unknown[] = [];

    /** An institution exam written by fixture SQL: content inserted while the deadline (seconds from now) is ahead. */
    const fixtureExam = async (sessionId: string, options: { deadlineSeconds: number; questions: number; teachingAssignmentId?: string }) => inTransaction(pool, async c => {
        const session = (await c.query('SELECT starts_at, ends_at FROM secure_assessment_institution_exam_sessions WHERE id = $1', [sessionId])).rows[0];
        const exam = (await c.query(
            `INSERT INTO secure_assessment_exam_instances (tenant_id, teaching_assignment_id, assessment_type_id, lifecycle_state, window_starts_at, window_ends_at,
                configured_attempt_duration_seconds, latest_start_policy, room_based_operations_enabled, proctor_per_room_required, institution_session_id)
             VALUES ($1, $2, $3, 'SCHEDULED', $4, $5, 1800, 'FULL_DURATION_BEYOND_WINDOW', FALSE, FALSE, $6) RETURNING id`,
            [tenant, options.teachingAssignmentId ?? teaching.teachingAssignmentId, teaching.assessmentTypeId, session.starts_at, session.ends_at, sessionId])).rows[0].id as string;
        for (const s of students) {
            await c.query('INSERT INTO secure_assessment_exam_participants (tenant_id, exam_instance_id, person_id, academic_enrollment_id) VALUES ($1, $2, $3, $4)',
                [tenant, exam, s.personId, s.enrollmentId]);
        }
        await c.query(
            `INSERT INTO secure_assessment_institution_preparation_deadlines (tenant_id, exam_instance_id, revision, deadline_at, set_by_person_id, action_key, request_digest)
             VALUES ($1, $2, 1, transaction_timestamp() + $3 * interval '1 second', $4, gen_random_uuid(), repeat('0', 64))`,
            [tenant, exam, options.deadlineSeconds, operator.personId]);
        for (let i = 1; i <= options.questions; i++) {
            await c.query('INSERT INTO secure_assessment_exam_question_snapshots (tenant_id, exam_instance_id, frozen_content, display_order) VALUES ($1, $2, $3, $4)',
                [tenant, exam, JSON.stringify(baselineQuestion(i)), i]);
        }
        return exam;
    });

    // The second school's period and session, by its own Operator, for the foreign-object vectors (N02).
    const foreignPeriodResponse = await post(foreign, `${P}/periods`, { label: 'PTS Lain', assessmentTypeId: foreignTeaching.assessmentTypeId, academicPeriodId: foreignAcademicPeriod, actionKey: randomUUID() });
    assert.equal(foreignPeriodResponse.status, 201, JSON.stringify(foreignPeriodResponse.body));
    const foreignPeriod: string = foreignPeriodResponse.body.periodId;
    const foreignSessionResponse = await post(foreign, `${P}/sessions`, { periodId: foreignPeriod, date: wibDay(4), startTime: '07:00', endTime: '08:00', actionKey: randomUUID() });
    assert.equal(foreignSessionResponse.status, 201, JSON.stringify(foreignSessionResponse.body));
    const foreignSession: string = foreignSessionResponse.body.sessionId;

    // ---- I-1: period, session, placement ------------------------------------------------------
    const overview = await o.request(P);
    assert.equal(overview.status, 200, JSON.stringify(overview.body));
    assert.equal(overview.body.timeZone, 'Asia/Jakarta');
    assert.deepEqual(overview.body.limits, { maxDurationMinutes: 1440 });
    assert.ok(overview.body.assessmentTypes.some((x: Body) => x.assessmentTypeId === teaching.assessmentTypeId));
    assert.ok(overview.body.academicPeriods.some((x: Body) => x.academicPeriodId === academicPeriodId && x.startDate === '2026-07-01' && x.endDate === '2026-12-31'));
    assert.deepEqual(overview.body.teachingAssignments.find((x: Body) => x.teachingAssignmentId === teaching.teachingAssignmentId),
        { teachingAssignmentId: teaching.teachingAssignmentId, subjectLabel: 'Matematika', groupLabel: 'X-1', academicPeriodId, teacherElligbleId: 'guru.institusi' });
    assert.ok(!overview.body.teachingAssignments.some((x: Body) => x.teachingAssignmentId === foreignTeaching.teachingAssignmentId), 'tenant-scoped');
    assert.deepEqual(overview.body.periods, []);

    const periodBody = { label: '  PTS   Ganjil ', assessmentTypeId: teaching.assessmentTypeId, academicPeriodId, actionKey: randomUUID() };
    const created = await post(o, `${P}/periods`, periodBody);
    assert.equal(created.status, 201, JSON.stringify(created.body));
    receipts.push(created.body);
    const period1: string = created.body.periodId;
    assert.equal((await pool.query('SELECT label FROM secure_assessment_institution_exam_periods WHERE id = $1', [period1])).rows[0].label, 'PTS Ganjil');
    const mainSlot = { date: wibDay(2), startTime: '08:00', endTime: '10:00' };
    const sessionBody = { periodId: period1, ...mainSlot, actionKey: randomUUID() };
    const sMainResponse = await post(o, `${P}/sessions`, sessionBody);
    assert.equal(sMainResponse.status, 201, JSON.stringify(sMainResponse.body));
    receipts.push(sMainResponse.body);
    const sMain = { sessionId: sMainResponse.body.sessionId as string, startsAt: sMainResponse.body.startsAt as string, endsAt: sMainResponse.body.endsAt as string };
    assert.equal(sMain.startsAt, wibInstant(`${mainSlot.date}T08:00`));
    assert.equal(sMain.endsAt, wibInstant(`${mainSlot.date}T10:00`));
    const placeKey = randomUUID();
    const mainDeadline = `${wibDay(1)}T15:00`;
    const placeBody = placement(sMain.sessionId, { durationMinutes: 90, preparationDeadline: mainDeadline, actionKey: placeKey });
    const placed = await post(o, `${P}/placements`, placeBody);
    assert.equal(placed.status, 201, JSON.stringify(placed.body));
    receipts.push(placed.body);
    const mainExam: string = placed.body.examInstanceId;
    assert.deepEqual(placed.body, { examInstanceId: mainExam, participants: 3, preparationDeadline: wibInstant(mainDeadline), replayed: false });

    await t.test('I-1 the placed exam: SCHEDULED in the session window, the period type, participants, rooms off, the event and deadline 1', async () => {
        const exam = (await pool.query(
            `SELECT lifecycle_state, window_starts_at, window_ends_at, assessment_type_id, configured_attempt_duration_seconds, latest_start_policy,
                    room_based_operations_enabled, proctor_per_room_required, institution_session_id, teaching_assignment_id
             FROM secure_assessment_exam_instances WHERE id = $1`, [mainExam])).rows[0];
        assert.equal(exam.lifecycle_state, 'SCHEDULED');
        assert.equal(exam.window_starts_at.toISOString(), sMain.startsAt);
        assert.equal(exam.window_ends_at.toISOString(), sMain.endsAt);
        assert.equal(exam.assessment_type_id, teaching.assessmentTypeId);
        assert.equal(exam.configured_attempt_duration_seconds, 5400);
        assert.equal(exam.latest_start_policy, 'FULL_DURATION_BEYOND_WINDOW');
        assert.equal(exam.room_based_operations_enabled, false);
        assert.equal(exam.proctor_per_room_required, false);
        assert.equal(exam.institution_session_id, sMain.sessionId);
        assert.equal(exam.teaching_assignment_id, teaching.teachingAssignmentId);
        const participants = (await pool.query('SELECT academic_enrollment_id FROM secure_assessment_exam_participants WHERE exam_instance_id = $1', [mainExam])).rows;
        assert.deepEqual(participants.map(p => p.academic_enrollment_id).sort(), students.map(s => s.enrollmentId).sort());
        const events = (await pool.query('SELECT from_state, to_state, actor_person_id FROM secure_assessment_exam_lifecycle_events WHERE exam_instance_id = $1', [mainExam])).rows;
        assert.deepEqual(events, [{ from_state: 'DRAFT', to_state: 'SCHEDULED', actor_person_id: operator.personId }]);
        const deadlines = (await pool.query(
            `SELECT revision, deadline_at, previous_deadline_at, reason, set_by_person_id, action_key
             FROM secure_assessment_institution_preparation_deadlines WHERE exam_instance_id = $1`, [mainExam])).rows;
        assert.deepEqual(deadlines, [{ revision: 1, deadline_at: new Date(wibInstant(mainDeadline)), previous_deadline_at: null, reason: null, set_by_person_id: operator.personId, action_key: placeKey }]);
        const block = await card(mainExam);
        assert.deepEqual(block.institution, { periodLabel: 'PTS Ganjil', preparationDeadline: wibInstant(mainDeadline), deadlineExtended: false, preparationClosed: false, questionCount: 0 });
        assert.equal(block.participants, 3);
        const listed = await o.request(`${P}?periodId=${period1}`);
        assert.equal(listed.status, 200, JSON.stringify(listed.body));
        assert.deepEqual(listed.body.period, { periodId: period1, label: 'PTS Ganjil', assessmentTypeLabel: 'ULANGAN_HARIAN', academicPeriodLabel: 'Semester Ganjil' });
        assert.deepEqual(listed.body.sessions, [{ ...sMain, exams: [{
            examInstanceId: mainExam, subjectLabel: 'Matematika', groupLabel: 'X-1', teacherElligbleId: 'guru.institusi', lifecycleState: 'SCHEDULED',
            cancelledAt: null, durationMinutes: 90, latestStartPolicy: 'FULL_DURATION_BEYOND_WINDOW', participants: 3,
            preparation: { deadline: wibInstant(mainDeadline), revision: 1, closed: false, questionCount: 0, preparedAt: null, sourceFileName: null },
            readiness: null,
        }] }]);
        assert.deepEqual((await o.request(P)).body.periods,
            [{ periodId: period1, label: 'PTS Ganjil', assessmentTypeLabel: 'ULANGAN_HARIAN', academicPeriodLabel: 'Semester Ganjil', sessionCount: 1, examCount: 1 }]);
    });

    await t.test('I-12 period, session and placement replay with the same key and body; another body is action_key_reused', async () => {
        const before = await counts(pool);
        const again = await post(o, `${P}/periods`, periodBody);
        assert.deepEqual([again.status, again.body], [200, { periodId: period1, replayed: true }]);
        assert.deepEqual((await post(o, `${P}/periods`, { ...periodBody, label: 'PAS Ganjil' })).body, { error: 'action_key_reused' });
        const sAgain = await post(o, `${P}/sessions`, sessionBody);
        assert.deepEqual([sAgain.status, sAgain.body], [200, { ...sMain, replayed: true }]);
        assert.deepEqual((await post(o, `${P}/sessions`, { ...sessionBody, endTime: '11:00' })).body, { error: 'action_key_reused' });
        const pAgain = await post(o, `${P}/placements`, placeBody);
        assert.deepEqual([pAgain.status, pAgain.body], [200, { examInstanceId: mainExam, participants: 3, preparationDeadline: wibInstant(mainDeadline), replayed: true }]);
        assert.deepEqual((await post(o, `${P}/placements`, { ...placeBody, durationMinutes: 60 })).body, { error: 'action_key_reused' });
        // A key never serves another Operator, nor another kind of write.
        assert.deepEqual((await post(o2, `${P}/periods`, periodBody)).body, { error: 'action_key_reused' });
        assert.deepEqual((await extend(o, mainExam, 1, `${wibDay(1)}T16:00`, { actionKey: placeKey })).body, { error: 'action_key_reused' });
        assert.deepEqual(await counts(pool), before);
    });

    const sOther = await createSession(period1);
    const period2 = await createPeriod(o, 'PAS Ganjil');
    const s2 = await createSession(period2);

    await t.test('I-2 composition refusals are reported together and change nothing; a foreign or unknown session is 403', async () => {
        const sConflict = await createSession(period2);
        const teacherManaged = await createExamInstance(pool, tenant, teaching, {
            lifecycleState: 'SCHEDULED', windowStartsAt: new Date(sConflict.startsAt), windowEndsAt: new Date(new Date(sConflict.startsAt).getTime() + 30 * 60_000),
        });
        for (const s of students) await addParticipant(pool, tenant, teacherManaged, s.personId);
        const started = (await pool.query(
            `INSERT INTO secure_assessment_institution_exam_sessions (tenant_id, period_id, starts_at, ends_at, created_by_person_id, action_key, request_digest)
             VALUES ($1, $2, statement_timestamp() - interval '10 minutes', statement_timestamp() + interval '50 minutes', $3, gen_random_uuid(), repeat('0', 64)) RETURNING id`,
            [tenant, period2, operator.personId])).rows[0].id as string;
        const endedAcademicPeriod = (await pool.query(
            `INSERT INTO academic_core_academic_periods (tenant_id, academic_year_id, display_label, period_type, start_date, end_date)
             VALUES ($1, $2, 'Triwulan Lalu', 'SEMESTER', DATE '2026-07-01', DATE '2026-08-31') RETURNING id`, [tenant, scope.academic_year_id])).rows[0].id as string;
        const before = await counts(pool);
        const problems = async (body: Body) => {
            const r = await post(o, `${P}/placements`, body);
            assert.equal(r.status, 422, JSON.stringify(r.body));
            assert.equal(r.body.error, 'composition_invalid');
            return r.body.problems as Array<{ code: string; count?: number }>;
        };
        assert.deepEqual(await problems(placement(sOther.sessionId)), [{ code: 'already_placed' }]);
        assert.deepEqual(await problems(placement(s2.sessionId, { teachingAssignmentId: otherPeriod.teachingAssignmentId })),
            [{ code: 'teaching_assignment_other_period' }, { code: 'no_participants' }]);
        assert.deepEqual(await problems(placement(s2.sessionId, { durationMinutes: 51, latestStartPolicy: 'LATE_START_BLOCKED' })), [{ code: 'duration_exceeds_window' }]);
        assert.deepEqual(await problems(placement(s2.sessionId, { durationMinutes: 0 })), [{ code: 'duration_invalid' }]);
        assert.deepEqual(await problems(placement(s2.sessionId, { durationMinutes: 1441 })), [{ code: 'duration_invalid' }]);
        assert.deepEqual(await problems(placement(s2.sessionId, { durationMinutes: 1.5 })), [{ code: 'duration_invalid' }]);
        const s2Local = new Date(new Date(s2.startsAt).getTime() + 7 * 3_600_000).toISOString().slice(0, 16);
        assert.deepEqual(await problems(placement(s2.sessionId, { preparationDeadline: s2Local })), [{ code: 'deadline_not_before_session' }]);
        assert.deepEqual(await problems(placement(s2.sessionId, { preparationDeadline: wib(-10) })), [{ code: 'deadline_passed' }]);
        assert.deepEqual(await problems(placement(s2.sessionId, { preparationDeadline: '2026-02-30T08:00' })), [{ code: 'deadline_invalid' }]);
        const startedCodes = (await problems(placement(started))).map(p => p.code);
        assert.ok(startedCodes.includes('session_started') && startedCodes.includes('deadline_not_before_session'), JSON.stringify(startedCodes));
        assert.deepEqual(await problems(placement(s2.sessionId, { teachingAssignmentId: emptyTeaching })), [{ code: 'no_participants' }]);
        assert.deepEqual(await problems(placement(sConflict.sessionId)), [{ code: 'schedule_conflict', count: 3 }]);
        // N02: a foreign or unknown teaching assignment is unknown; a foreign or unknown session is 403.
        assert.deepEqual(await problems(placement(s2.sessionId, { teachingAssignmentId: foreignTeaching.teachingAssignmentId })), [{ code: 'teaching_assignment_unknown' }]);
        assert.deepEqual(await problems(placement(s2.sessionId, { teachingAssignmentId: randomUUID() })), [{ code: 'teaching_assignment_unknown' }]);
        for (const sessionId of [randomUUID(), foreignSession]) {
            const r = await post(o, `${P}/placements`, placement(sessionId));
            assert.deepEqual([r.status, r.body], [403, { error: 'forbidden' }]);
        }
        // Sessions: the codes of §4.3.
        const sessionProblems = async (body: Body) => (await post(o, `${P}/sessions`, { periodId: period2, actionKey: randomUUID(), ...nextSlot(), ...body })).body;
        assert.deepEqual(await sessionProblems({ date: '2026-02-30' }), { error: 'composition_invalid', problems: [{ code: 'date_invalid' }] });
        assert.deepEqual(await sessionProblems({ startTime: '25:00' }), { error: 'composition_invalid', problems: [{ code: 'time_invalid' }] });
        assert.deepEqual(await sessionProblems({ startTime: '11:00', endTime: '10:00' }), { error: 'composition_invalid', problems: [{ code: 'window_order' }] });
        assert.deepEqual(await sessionProblems({ date: wibDay(-1) }), { error: 'composition_invalid', problems: [{ code: 'window_ended' }] });
        assert.deepEqual(await sessionProblems({ date: '2027-01-15' }), { error: 'composition_invalid', problems: [{ code: 'date_outside_period' }] });
        assert.deepEqual((await post(o, `${P}/sessions`, { ...sessionBody, actionKey: randomUUID() })).body,
            { error: 'composition_invalid', problems: [{ code: 'session_taken' }] });
        assert.deepEqual((await post(o, `${P}/sessions`, { periodId: foreignPeriod, ...nextSlot(), actionKey: randomUUID() })).body, { error: 'forbidden' });
        // Periods: the codes of §4.3.
        const periodProblems = async (body: Body) => (await post(o, `${P}/periods`, { label: 'Periode Uji', assessmentTypeId: teaching.assessmentTypeId, academicPeriodId, actionKey: randomUUID(), ...body })).body;
        assert.deepEqual(await periodProblems({ label: '   ' }), { error: 'composition_invalid', problems: [{ code: 'label_invalid' }] });
        assert.deepEqual(await periodProblems({ label: 'a'.repeat(121) }), { error: 'composition_invalid', problems: [{ code: 'label_invalid' }] });
        assert.deepEqual(await periodProblems({ label: 'PTS Ganjil' }), { error: 'composition_invalid', problems: [{ code: 'label_taken' }] });
        assert.deepEqual(await periodProblems({ academicPeriodId: endedAcademicPeriod }), { error: 'composition_invalid', problems: [{ code: 'academic_period_ended' }] });
        assert.deepEqual(await counts(pool), before, 'refusals change nothing');
        // The teacher-managed exam is cancelled by its own teacher so its slot no longer holds rombel X.
        const r = await tc.request('/api/v1/assessment/teacher-exams/cancel', { method: 'POST', body: { examInstanceId: teacherManaged, reason: 'Fixture selesai', confirmed: true, actionKey: randomUUID() } });
        assert.equal(r.status, 200, JSON.stringify(r.body));
    });

    await t.test('I-3 the subject Teacher previews (nothing written), confirms, replays and replaces the questions (OP-2 A)', async () => {
        const before = await counts(pool) as Record<string, number>;
        const preview = await contentPreview(tc, mainExam, FILE_A, 'C:\\Guru\\ulangan.csv');
        assert.equal(preview.status, 200, JSON.stringify(preview.body));
        assert.equal(preview.body.replaces, 0);
        assert.deepEqual(preview.body.problems, []);
        assert.deepEqual(preview.body.questions.map((q: Body) => q.prompt), ['Ibu kota Indonesia adalah', 'Matahari terbit di timur']);
        assert.deepEqual(preview.body.participants, []);
        assert.deepEqual(preview.body.window, { startsAt: sMain.startsAt, endsAt: sMain.endsAt });
        assert.deepEqual(preview.body.totals, { questions: 2, maxScore: 2, participants: 3 });
        assert.equal(preview.body.sourceSha256, sha256Hex(FILE_A));
        assert.deepEqual(await counts(pool), before, 'the preview writes nothing');

        const keyA = randomUUID();
        const confirmed = await contentConfirm(tc, mainExam, FILE_A, keyA);
        assert.equal(confirmed.status, 201, JSON.stringify(confirmed.body));
        const { audit, ...result } = confirmed.body;
        assert.deepEqual(result, { examInstanceId: mainExam, questionCount: 2, replayed: false });
        assert.deepEqual([audit.outcome, audit.replayed], ['APPLIED', false]);
        const after = await counts(pool) as Record<string, number>;
        assert.equal(after.secure_assessment_exam_question_snapshots, before.secure_assessment_exam_question_snapshots + 2);
        assert.equal(after.secure_assessment_question_import_batches, before.secure_assessment_question_import_batches + 1);
        assert.equal(after.secure_assessment_permission_action_events, before.secure_assessment_permission_action_events + 1);
        const events = (await pool.query(
            `SELECT action_kind, action, actor_person_id, outcome, resulting_state, reason, authority_kind
             FROM secure_assessment_permission_action_events WHERE exam_instance_id = $1`, [mainExam])).rows;
        assert.deepEqual(events, [{ action_kind: 'IMPORT', action: 'import', actor_person_id: teacher.personId, outcome: 'APPLIED', resulting_state: 'SCHEDULED', reason: null, authority_kind: 'TEACHER' }]);
        const firstRows = await snapshotsOf(mainExam);
        assert.deepEqual(firstRows.map(s => s.display_order), [1, 2]);
        assert.equal((await pool.query('SELECT source_file_name FROM secure_assessment_question_import_batches WHERE id = $1', [firstRows[0].import_batch_id])).rows[0].source_file_name, 'soal.csv');

        const replay = await contentConfirm(tc, mainExam, FILE_A, keyA);
        assert.deepEqual([replay.status, replay.body.replayed, replay.body.questionCount, replay.body.audit.replayed], [200, true, 2, true]);
        assert.deepEqual((await contentConfirm(tc, mainExam, FILE_B, keyA)).body, { error: 'import_key_reused' });
        assert.deepEqual(await counts(pool), after);

        const replacing = await contentPreview(tc, mainExam, FILE_B);
        assert.equal(replacing.status, 200, JSON.stringify(replacing.body));
        assert.equal(replacing.body.replaces, 2);
        const second = await contentConfirm(tc, mainExam, FILE_B);
        assert.equal(second.status, 201, JSON.stringify(second.body));
        assert.equal(second.body.questionCount, 3);
        const rows = await snapshotsOf(mainExam);
        assert.equal(rows.length, 3);
        assert.ok(rows.every(s => !firstRows.some(f => f.id === s.id)), 'the replaced rows are gone');
        const batches = (await pool.query('SELECT id, question_count, source_sha256 FROM secure_assessment_question_import_batches WHERE exam_instance_id = $1 ORDER BY imported_at, id', [mainExam])).rows;
        assert.deepEqual(batches.map(b => [b.question_count, b.source_sha256]), [[2, sha256Hex(FILE_A)], [3, sha256Hex(FILE_B)]], 'the batch history stays');
        assert.ok(rows.every(s => s.import_batch_id === batches[1].id));
        await assert.rejects(pool.query('UPDATE secure_assessment_exam_question_snapshots SET display_order = display_order WHERE exam_instance_id = $1', [mainExam]), /immutable/,
            'no snapshot row is ever updated (0003)');
        const unchanged = await counts(pool);
        const bad = await contentConfirm(tc, mainExam, FILE_BAD);
        assert.deepEqual([bad.status, bad.body.error, bad.body.problems[0].source], [422, 'import_invalid', 'file']);
        const badPreview = await contentPreview(tc, mainExam, FILE_BAD);
        assert.deepEqual([badPreview.status, badPreview.body.replaces], [422, 3]);
        assert.deepEqual(await counts(pool), unchanged);
        assert.equal((await card(mainExam)).institution.questionCount, 3);
        const item = (await o.request(`${P}?periodId=${period1}`)).body.sessions[0].exams[0];
        assert.deepEqual([item.preparation.questionCount, item.preparation.sourceFileName, typeof item.preparation.preparedAt], [3, 'soal.csv', 'string']);
    });

    await t.test('I-16 a confirmation of another file than the checked one is content_changed and writes nothing', async () => {
        const before = await counts(pool);
        const r = await contentConfirm(tc, mainExam, FILE_A, randomUUID(), sha256Hex(FILE_B));
        assert.deepEqual([r.status, r.body], [409, { error: 'content_changed' }]);
        assert.deepEqual(await counts(pool), before);
    });

    await t.test('I-4 the lock: closed preparation, the trigger, the RESTRICT keys of delivered content, and no lock for teacher-managed exams', async () => {
        const closed = await fixtureExam((await createSession(period2)).sessionId, { deadlineSeconds: 1, questions: 1 });
        await deadlinePassed(pool, closed);
        const before = await counts(pool);
        const refused = await contentPreview(tc, closed, FILE_A);
        assert.deepEqual([refused.status, refused.body.error], [409, 'preparation_closed']);
        assert.match(refused.body.preparationDeadline, /^\d{4}-\d{2}-\d{2}T/);
        assert.equal((await contentConfirm(tc, closed, FILE_A)).body.error, 'preparation_closed');
        await assert.rejects(pool.query('INSERT INTO secure_assessment_exam_question_snapshots (tenant_id, exam_instance_id, frozen_content, display_order) VALUES ($1, $2, $3, 9)',
            [tenant, closed, JSON.stringify(baselineQuestion(9))]), TRIGGER_REFUSAL);
        await assert.rejects(pool.query('DELETE FROM secure_assessment_exam_question_snapshots WHERE exam_instance_id = $1', [closed]), TRIGGER_REFUSAL);
        assert.equal((await card(closed)).institution.preparationClosed, true);
        assert.deepEqual(await counts(pool), before);

        // Delivered content (§3.3): an answer or a review flag blocks the DELETE that the trigger would allow.
        const [snapshot] = (await snapshotsOf(mainExam)).map(s => s.id as string);
        const participantId = (await pool.query('SELECT id FROM secure_assessment_exam_participants WHERE exam_instance_id = $1 ORDER BY id LIMIT 1', [mainExam])).rows[0].id;
        const delivered: Array<[string, RegExp]> = [
            [`INSERT INTO secure_assessment_exam_answers (tenant_id, exam_attempt_id, exam_question_snapshot_id, answer_payload) VALUES ($1, $2, $3, '{}')`, /fk_sa_answer_snapshot/],
            ['INSERT INTO secure_assessment_review_flags (tenant_id, exam_attempt_id, exam_question_snapshot_id, flagged) VALUES ($1, $2, $3, TRUE)', /fk_sa_review_flag_snapshot/],
        ];
        for (const [insert, constraint] of delivered) {
            const c = await pool.connect();
            try {
                await c.query('BEGIN');
                const attempt = (await c.query('INSERT INTO secure_assessment_exam_attempts (tenant_id, exam_participant_id) VALUES ($1, $2) RETURNING id', [tenant, participantId])).rows[0].id;
                await c.query(insert, [tenant, attempt, snapshot]);
                await assert.rejects(c.query('DELETE FROM secure_assessment_exam_question_snapshots WHERE id = $1', [snapshot]), constraint);
            } finally {
                await c.query('ROLLBACK');
                c.release();
            }
        }
        assert.deepEqual(await counts(pool), before);

        // A teacher-managed exam: the trigger returns at once and takes no lock; an institution exam waits on its FOR SHARE.
        const managed = await createExamInstance(pool, tenant, otherPeriod, { lifecycleState: 'SCHEDULED' });
        const holder = await pool.connect();
        const writer = await pool.connect();
        try {
            await holder.query('BEGIN');
            await holder.query('SELECT 1 FROM secure_assessment_exam_instances WHERE id = ANY($1::uuid[]) FOR NO KEY UPDATE', [[managed, mainExam]]);
            await writer.query('BEGIN');
            await writer.query(`SET LOCAL lock_timeout = '3s'`);
            await writer.query('INSERT INTO secure_assessment_exam_question_snapshots (tenant_id, exam_instance_id, frozen_content, display_order) VALUES ($1, $2, $3, 1)',
                [tenant, managed, JSON.stringify(baselineQuestion(1))]);
            await writer.query('DELETE FROM secure_assessment_exam_question_snapshots WHERE exam_instance_id = $1', [managed]);
            await writer.query('ROLLBACK');
            await writer.query('BEGIN');
            await writer.query(`SET LOCAL lock_timeout = '500ms'`);
            await assert.rejects(writer.query('INSERT INTO secure_assessment_exam_question_snapshots (tenant_id, exam_instance_id, frozen_content, display_order) VALUES ($1, $2, $3, 9)',
                [tenant, mainExam, JSON.stringify(baselineQuestion(9))]), /lock timeout/);
            await writer.query('ROLLBACK');
        } finally {
            await holder.query('ROLLBACK');
            holder.release();
            writer.release();
        }
    });

    let fxReady = '';
    await t.test('I-5 extension: the next revision with its reason, stale and earlier deadlines, reason and confirmation, an expired deadline', async () => {
        const newDeadline = `${wibDay(1)}T18:00`;
        const body = { examInstanceId: mainExam, preparationDeadline: newDeadline, expectedRevision: 1, reason: 'Guru  mata pelajaran sakit', confirmed: true, actionKey: randomUUID() };
        const r = await post(o, `${P}/deadline`, body);
        assert.equal(r.status, 200, JSON.stringify(r.body));
        receipts.push(r.body);
        assert.deepEqual(r.body, { examInstanceId: mainExam, revision: 2, preparationDeadline: wibInstant(newDeadline), reason: 'Guru mata pelajaran sakit', replayed: false });
        const rows = (await pool.query(
            `SELECT revision, previous_deadline_at, reason, set_by_person_id FROM secure_assessment_institution_preparation_deadlines
             WHERE exam_instance_id = $1 ORDER BY revision`, [mainExam])).rows;
        assert.deepEqual(rows[1], { revision: 2, previous_deadline_at: new Date(wibInstant(mainDeadline)), reason: 'Guru mata pelajaran sakit', set_by_person_id: operator.personId });
        assert.equal((await card(mainExam)).institution.deadlineExtended, true);
        const listed = (await o.request(`${P}?periodId=${period1}`)).body;
        assert.equal(JSON.stringify(listed).includes('Guru mata pelajaran sakit'), false, 'the reason is only in the receipt');
        assert.equal(listed.sessions[0].exams[0].preparation.revision, 2);
        const before = await counts(pool);
        const replay = await post(o, `${P}/deadline`, body);
        assert.deepEqual([replay.status, replay.body], [200, { ...r.body, replayed: true }]);
        assert.deepEqual((await post(o, `${P}/deadline`, { ...body, reason: 'Alasan lain' })).body, { error: 'action_key_reused' });
        const stale = await extend(o, mainExam, 1, `${wibDay(1)}T19:00`);
        assert.deepEqual([stale.status, stale.body], [409, { error: 'stale_deadline', current: { revision: 2, deadline: wibInstant(newDeadline) } }]);
        assert.deepEqual((await extend(o, mainExam, 2, `${wibDay(1)}T16:00`)).body, { error: 'composition_invalid', problems: [{ code: 'deadline_not_later' }] });
        assert.deepEqual((await extend(o, mainExam, 2, `${mainSlot.date}T09:00`)).body, { error: 'composition_invalid', problems: [{ code: 'deadline_not_before_session' }] });
        assert.deepEqual((await extend(o, mainExam, 2, 'besok pagi')).body, { error: 'composition_invalid', problems: [{ code: 'deadline_invalid' }] });
        for (const spoiled of [{ reason: '' }, { reason: '   ' }, { reason: 'a'.repeat(201) }, { confirmed: false }, { confirmed: undefined }, { actorPersonId: operator.personId }, { expectedRevision: '2' }]) {
            const res = await extend(o, mainExam, 2, `${wibDay(1)}T19:00`, spoiled);
            assert.deepEqual([res.status, res.body], [400, { error: 'invalid_request' }], JSON.stringify(spoiled));
        }
        assert.deepEqual(await counts(pool), before);
        // OP-4 A: an expired deadline is extended while SCHEDULED, and preparation opens again.
        const expired = await fixtureExam((await createSession(period2)).sessionId, { deadlineSeconds: 1, questions: 1 });
        await deadlinePassed(pool, expired);
        assert.equal((await contentPreview(tc, expired, FILE_A)).body.error, 'preparation_closed');
        const reopened = await extend(o, expired, 1, `${wibDay(1)}T20:00`);
        assert.equal(reopened.status, 200, JSON.stringify(reopened.body));
        assert.equal((await contentPreview(tc, expired, FILE_A)).status, 200);
        assert.equal((await card(expired)).institution.preparationClosed, false);
    });

    await t.test('I-6 mark ready: preparation open, no content, READY with its event, a repeat; a READY exam is not extended', async () => {
        const open = await markReady(o, mainExam);
        assert.deepEqual([open.status, open.body], [409, { error: 'preparation_open', preparationDeadline: wibInstant(`${wibDay(1)}T18:00`) }]);
        const empty = await fixtureExam((await createSession(period2)).sessionId, { deadlineSeconds: 1, questions: 0 });
        fxReady = await fixtureExam((await createSession(period2)).sessionId, { deadlineSeconds: 1, questions: 1 });
        await deadlinePassed(pool, empty);
        await deadlinePassed(pool, fxReady);
        const before = await counts(pool);
        const notReady = await markReady(o, empty);
        assert.deepEqual([notReady.status, notReady.body.error, notReady.body.readiness.baseline.blocker], [409, 'not_ready', 'question_snapshot_empty']);
        assert.deepEqual(await counts(pool), before);
        // E15: readiness is evaluated where "Tandai Siap" applies, a SCHEDULED exam past its deadline.
        const items = (await o.request(`${P}?periodId=${period2}`)).body.sessions.flatMap((s: { exams: Body[] }) => s.exams);
        const emptyItem = items.find((e: Body) => e.examInstanceId === empty);
        assert.deepEqual([emptyItem.preparation.closed, emptyItem.readiness.baseline.blocker], [true, 'question_snapshot_empty']);
        assert.equal(items.find((e: Body) => e.examInstanceId === fxReady).readiness.baseline.status, 'baseline_readiness_checks_pass');
        const ready = await markReady(o, fxReady);
        assert.deepEqual([ready.status, ready.body], [200, { examInstanceId: fxReady, lifecycleState: 'READY' }]);
        receipts.push(ready.body);
        const events = (await pool.query(
            `SELECT actor_person_id FROM secure_assessment_exam_lifecycle_events WHERE exam_instance_id = $1 AND from_state = 'SCHEDULED' AND to_state = 'READY'`, [fxReady])).rows;
        assert.deepEqual(events, [{ actor_person_id: operator.personId }]);
        assert.deepEqual((await markReady(o, fxReady)).body, { error: 'invalid_state', currentState: 'READY' });
        assert.deepEqual((await extend(o, fxReady, 1, `${wibDay(1)}T20:00`)).body, { error: 'invalid_state', currentState: 'READY' });
        assert.deepEqual((await contentPreview(tc, fxReady, FILE_A)).body, { error: 'invalid_state', currentState: 'READY' });
        assert.equal((await card(fxReady)).institution.preparationClosed, true);
    });

    await t.test('I-7 cancel: archived with the 0052 row and its event; replay; another reason; already cancelled; the Teacher sees it', async () => {
        const exam = await fixtureExam((await createSession(period2)).sessionId, { deadlineSeconds: 3600, questions: 1 });
        const body = { examInstanceId: exam, reason: 'Salah  tempat sesi', confirmed: true, actionKey: randomUUID() };
        const r = await post(o, `${P}/cancel`, body);
        assert.equal(r.status, 200, JSON.stringify(r.body));
        receipts.push(r.body);
        assert.deepEqual([r.body.changed, r.body.replayed], [true, false]);
        const cancellation = (await pool.query(
            'SELECT id, reason, previous_lifecycle_state, cancelled_by_person_id FROM secure_assessment_exam_cancellations WHERE exam_instance_id = $1', [exam])).rows[0];
        assert.deepEqual([cancellation.reason, cancellation.previous_lifecycle_state, cancellation.cancelled_by_person_id], ['Salah tempat sesi', 'SCHEDULED', operator.personId]);
        const events = (await pool.query(
            `SELECT from_state, actor_person_id, cancellation_id FROM secure_assessment_exam_lifecycle_events WHERE exam_instance_id = $1 AND to_state = 'ARCHIVED'`, [exam])).rows;
        assert.deepEqual(events, [{ from_state: 'SCHEDULED', actor_person_id: operator.personId, cancellation_id: cancellation.id }]);
        assert.equal((await pool.query('SELECT lifecycle_state FROM secure_assessment_exam_instances WHERE id = $1', [exam])).rows[0].lifecycle_state, 'ARCHIVED');
        assert.equal((await snapshotsOf(exam)).length, 1, 'nothing is deleted');
        const before = await counts(pool);
        const replay = await post(o, `${P}/cancel`, body);
        assert.deepEqual([replay.status, replay.body], [200, { ...r.body, replayed: true }]);
        assert.deepEqual((await post(o, `${P}/cancel`, { ...body, reason: 'Alasan lain' })).body, { error: 'action_key_reused' });
        const again = await cancel(o, exam);
        assert.deepEqual([again.status, again.body.changed, again.body.cancelledAt], [200, false, r.body.cancelledAt]);
        for (const spoiled of [{ reason: '' }, { confirmed: false }, { confirmed: undefined }]) {
            assert.deepEqual((await cancel(o, mainExam, spoiled)).body, { error: 'invalid_request' }, JSON.stringify(spoiled));
        }
        assert.deepEqual(await counts(pool), before);
        const teacherView = await card(exam);
        assert.deepEqual([teacherView.cancellation.reason, teacherView.cancellation.by], ['Salah tempat sesi', { you: false, elligbleId: 'operator.institusi' }]);
        const item = (await o.request(`${P}?periodId=${period2}`)).body.sessions.flatMap((s: { exams: Body[] }) => s.exams).find((e: Body) => e.examInstanceId === exam);
        assert.deepEqual([item.lifecycleState, item.cancelledAt, item.readiness], ['ARCHIVED', r.body.cancelledAt, null]);
        // A READY exam is cancelled too (OP-8 A).
        const readyExam = await fixtureExam((await createSession(period2)).sessionId, { deadlineSeconds: 1, questions: 1 });
        await deadlinePassed(pool, readyExam);
        assert.equal((await markReady(o, readyExam)).status, 200);
        const readyCancel = await cancel(o, readyExam);
        assert.equal(readyCancel.status, 200, JSON.stringify(readyCancel.body));
    });

    let endedExam = '';
    await t.test('I-8 the subject Teacher: organizer actions are institution_managed; preview, essays, results and finalize stay', async () => {
        const before = await counts(pool);
        const act = (path: string, body: Body) => post(tc, `/api/v1/assessment/teacher-exams/${path}`, body);
        const intent = () => ({ reason: 'Uji guru mata pelajaran', confirmed: true, actionKey: randomUUID() });
        const managedRefusal = [409, { error: 'institution_managed' }];
        const markReadyByTeacher = await act('transition', { examInstanceId: mainExam, action: 'mark_ready' });
        assert.deepEqual([markReadyByTeacher.status, markReadyByTeacher.body], managedRefusal);
        for (const action of ['activate', 'pause', 'resume', 'end']) {
            const r = await act('transition', { examInstanceId: mainExam, action, ...intent() });
            assert.deepEqual([r.status, r.body], managedRefusal, action);
        }
        const reschedule = await act('reschedule', {
            examInstanceId: mainExam, windowStartsAt: `${mainSlot.date}T09:00`, windowEndsAt: `${mainSlot.date}T11:00`, durationMinutes: 60, latestStartPolicy: 'FULL_DURATION_BEYOND_WINDOW', ...intent(),
        });
        assert.deepEqual([reschedule.status, reschedule.body], managedRefusal);
        const teacherCancel = await act('cancel', { examInstanceId: mainExam, ...intent() });
        assert.deepEqual([teacherCancel.status, teacherCancel.body], managedRefusal);
        const candidates = await tc.request(`/api/v1/assessment/teacher-exams/participants/candidates?examInstanceId=${mainExam}`);
        assert.deepEqual([candidates.status, candidates.body], managedRefusal);
        const add = await act('participants/add', { examInstanceId: mainExam, enrollmentIds: [students[0].enrollmentId], ...intent() });
        assert.deepEqual([add.status, add.body], managedRefusal);
        assert.deepEqual(await counts(pool), before);
        const preview = await tc.request(`/api/v1/assessment/teacher-exams/preview?examInstanceId=${mainExam}`);
        assert.equal(preview.status, 200, JSON.stringify(preview.body));
        assert.equal(preview.body.questions.length, 3);
        // ENDED by fixture SQL: the subject Teacher reads essays and results and finalizes (O05-1).
        const ended = await fixtureExam((await createSession(period2)).sessionId, { deadlineSeconds: 1, questions: 1 });
        await deadlinePassed(pool, ended);
        await pool.query(`UPDATE secure_assessment_exam_instances SET lifecycle_state = 'ENDED' WHERE id = $1`, [ended]);
        assert.equal((await tc.request(`/api/v1/assessment/teacher-exams/essays?examInstanceId=${ended}`)).status, 200);
        assert.equal((await tc.request(`/api/v1/assessment/teacher-exams/results?examInstanceId=${ended}`)).status, 200);
        assert.deepEqual((await cancel(o, ended)).body, { error: 'invalid_state', currentState: 'ENDED' });
        assert.deepEqual((await markReady(o, ended)).body, { error: 'invalid_state', currentState: 'ENDED' });
        const finalized = await act('transition', { examInstanceId: ended, action: 'finalize', ...intent() });
        assert.deepEqual([finalized.status, finalized.body.lifecycleState], [200, 'FINALIZED'], JSON.stringify(finalized.body));
        endedExam = ended;
    });

    await t.test('I-9 / §4.9 authority denials (N01 to N08) change nothing', async () => {
        const managed = await createExamInstance(pool, tenant, teaching, { lifecycleState: 'SCHEDULED', windowStartsAt: new Date(Date.now() + 40 * 86_400_000), windowEndsAt: new Date(Date.now() + 40 * 86_400_000 + 3_600_000) });
        const routes = (): Array<[string, string, Body | null]> => [
            ['GET', P, null],
            ['GET', `${P}?periodId=${period1}`, null],
            ['POST', `${P}/periods`, { label: 'Ditolak', assessmentTypeId: teaching.assessmentTypeId, academicPeriodId, actionKey: randomUUID() }],
            ['POST', `${P}/sessions`, { periodId: period1, ...nextSlot(), actionKey: randomUUID() }],
            ['POST', `${P}/placements`, placement(sOther.sessionId, { teachingAssignmentId: physics })],
            ['POST', `${P}/deadline`, { examInstanceId: mainExam, preparationDeadline: `${wibDay(1)}T21:00`, expectedRevision: 2, reason: 'Ditolak', confirmed: true, actionKey: randomUUID() }],
            ['POST', `${P}/cancel`, { examInstanceId: mainExam, reason: 'Ditolak', confirmed: true, actionKey: randomUUID() }],
            ['POST', `${P}/transition`, { examInstanceId: mainExam, action: 'mark_ready' }],
        ];
        const call = (c: BrowserLikeClient, [method, path, body]: [string, string, Body | null]): Promise<ClientResponse> => c.request(path, body ? { method, body } : { method });
        const before = await counts(pool);
        // N01, N03, N04: no Operator assignment, another school, no membership; anonymous is 401.
        const refused: Array<[string, BrowserLikeClient]> = [['Teacher', tc], ['Proctor', pc], ['Homeroom Teacher', hc], ['Student', sc],
            ['the other school Operator', foreignInOurs], ['no membership', noMembership]];
        for (const [who, c] of refused) {
            for (const route of routes()) {
                const r = await call(c, route);
                assert.deepEqual([r.status, r.body], [403, { error: 'forbidden' }], `${who} ${route[0]} ${route[1]}`);
            }
        }
        for (const route of routes()) assert.equal((await call(anonymous, route)).status, 401, `anonymous ${route[1]}`);
        // N02: the other school's Operator, in its own school, reaches no object of this one.
        for (const route of routes().slice(1)) {
            const r = await call(foreign, route);
            if (route[1].endsWith('/periods')) assert.deepEqual(r.body, { error: 'composition_invalid', problems: [{ code: 'assessment_type_unknown' }, { code: 'academic_period_unknown' }] }, route[1]);
            else assert.deepEqual([r.status, r.body], [403, { error: 'forbidden' }], route[1]);
        }
        // The Operator on a teacher-managed exam, a foreign exam or an unknown one: 403, uniform.
        for (const examInstanceId of [managed, foreignExam, randomUUID()]) {
            for (const r of [await extend(o, examInstanceId, 1, `${wibDay(1)}T21:00`), await cancel(o, examInstanceId), await markReady(o, examInstanceId)]) {
                assert.deepEqual([r.status, r.body], [403, { error: 'forbidden' }], examInstanceId);
            }
        }
        for (const periodId of [foreignPeriod, randomUUID()]) assert.deepEqual((await o.request(`${P}?periodId=${periodId}`)).body, { error: 'forbidden' });
        // N02 on periods: a foreign choice and an unknown one answer the same bytes.
        const choices: Array<[string, string, string]> = [['assessmentTypeId', foreignTeaching.assessmentTypeId, 'assessment_type_unknown'], ['academicPeriodId', foreignAcademicPeriod, 'academic_period_unknown']];
        for (const [field, foreignId, code] of choices) {
            const base = { label: 'Pilihan Asing', assessmentTypeId: teaching.assessmentTypeId, academicPeriodId };
            const a = await post(o, `${P}/periods`, { ...base, [field]: foreignId, actionKey: randomUUID() });
            const b = await post(o, `${P}/periods`, { ...base, [field]: randomUUID(), actionKey: randomUUID() });
            assert.equal(a.status, 422);
            assert.equal(JSON.stringify(a.body), JSON.stringify(b.body), field);
            assert.deepEqual(a.body.problems, [{ code }]);
        }
        // N04/N05: the content routes refuse the Operator, the Proctor, the Homeroom Teacher, a Student and every other Teacher.
        for (const c of [o, pc, hc, sc, t2c, tOther, foreignInOurs]) {
            assert.deepEqual((await contentPreview(c, mainExam, FILE_A)).body, { error: 'forbidden' });
            assert.deepEqual((await contentConfirm(c, mainExam, FILE_A)).body, { error: 'forbidden' });
        }
        assert.deepEqual((await contentPreview(tc, foreignExam, FILE_A)).body, { error: 'forbidden' });
        assert.deepEqual((await contentPreview(tc, randomUUID(), FILE_A)).body, { error: 'forbidden' });
        // N04: the Operator and the Proctor on the content-bearing teacher routes of an institution exam.
        for (const c of [o, pc]) {
            const contentRoutes: Array<[string, { method?: string; body?: Body }]> = [
                [`/api/v1/assessment/teacher-exams/preview?examInstanceId=${mainExam}`, {}],
                [`/api/v1/assessment/teacher-exams/essays?examInstanceId=${endedExam}`, {}],
                ['/api/v1/assessment/teacher-exams/essays/grade', { method: 'POST', body: { examInstanceId: endedExam, attemptId: randomUUID(), snapshotId: randomUUID(), score: '1', expectedRevision: null } }],
                [`/api/v1/assessment/teacher-exams/results?examInstanceId=${endedExam}`, {}],
                ['/api/v1/assessment/teacher-exams/results', { method: 'POST', body: { examInstanceId: endedExam, format: 'csv', actionKey: randomUUID() } }],
            ];
            for (const [path, init] of contentRoutes) {
                const r = await c.request(path, init);
                assert.deepEqual([r.status, r.body], [403, { error: 'forbidden' }], path);
            }
        }
        // The subject Teacher on a teacher-managed exam's content route.
        assert.deepEqual((await contentPreview(tc, managed, FILE_A)).body, { error: 'not_institution_exam' });
        assert.deepEqual((await contentConfirm(tc, managed, FILE_A)).body, { error: 'not_institution_exam' });
        // N08: spoofed fields and anything outside the exact body are 400.
        const spoofed: Array<[string, Body]> = [
            [`${P}/periods`, { label: 'x', assessmentTypeId: teaching.assessmentTypeId, academicPeriodId, actionKey: randomUUID(), tenantId: tenant }],
            [`${P}/sessions`, { periodId: period1, ...nextSlot(), actionKey: randomUUID(), actorPersonId: operator.personId }],
            [`${P}/placements`, { ...placement(sOther.sessionId), participants: [students[0].enrollmentId] }],
            [`${P}/deadline`, { examInstanceId: mainExam, preparationDeadline: `${wibDay(1)}T21:00`, expectedRevision: 2, reason: 'x', actionKey: randomUUID() }],
            [`${P}/cancel`, { examInstanceId: mainExam, confirmed: true, actionKey: randomUUID() }],
            [`${P}/transition`, { examInstanceId: mainExam, action: 'mark_ready', reason: 'tidak perlu' }],
            [`${P}/transition`, { examInstanceId: mainExam, action: 'activate' }],
        ];
        for (const [path, body] of spoofed) assert.deepEqual((await post(o, path, body)).body, { error: 'invalid_request' }, path);
        for (const field of ['actorPersonId', 'tenantId', 'teachingAssignmentId']) {
            assert.deepEqual((await post(tc, `${CONTENT}/preview`, { examInstanceId: mainExam, questionsCsv: FILE_A, sourceFileName: null, [field]: randomUUID() })).body, { error: 'invalid_request' });
            assert.deepEqual((await post(tc, CONTENT, { examInstanceId: mainExam, questionsCsv: FILE_A, sourceFileName: null, importKey: randomUUID(), expectedSha256: sha256Hex(FILE_A), [field]: randomUUID() })).body, { error: 'invalid_request' });
        }
        // N01: an unavailable database gives 503 with nothing written.
        const unavailable = { connect: async () => { throw Object.assign(new Error('database unavailable'), { code: 'ECONNREFUSED' }); }, query: async () => { throw new Error('database unavailable'); } };
        const down = await startProductionWiredServer(unavailable as unknown as pg.Pool);
        try {
            const dc = new BrowserLikeClient(down.baseUrl);
            dc.cookie = o.cookie;
            dc.tenantId = tenant;
            for (const route of routes()) {
                const r = await call(dc, route);
                assert.deepEqual([r.status, r.body], [503, { error: 'persistence_unavailable' }], route[1]);
            }
            dc.cookie = tc.cookie;
            assert.equal((await contentPreview(dc, mainExam, FILE_A)).status, 503);
            assert.equal((await contentConfirm(dc, mainExam, FILE_A)).status, 503);
        } finally {
            await down.close();
        }
        assert.deepEqual(await counts(pool), before);
    });

    await t.test('N07 authority at commit: an Operator assignment or the placed teaching assignment revoked while the write waits; N03 a revoked Operator', async () => {
        const session = await createSession(period2);
        const before = await counts(pool);
        const revoker = await pool.connect();
        try {
            await revoker.query('BEGIN');
            await setSchoolOperator(revoker, { tenantId: tenant, personId: operator2.personId, action: 'REVOKE', operator: 'Synthetic CI operator', caseReference: 'ASSESS-INSTITUTION-001', reason: 'Synthetic revocation' });
            const pending = post(o2, `${P}/periods`, { label: 'Menunggu', assessmentTypeId: teaching.assessmentTypeId, academicPeriodId, actionKey: randomUUID() });
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
        for (const r of [await o2.request(P), await o2.request(`${P}?periodId=${period1}`), await markReady(o2, mainExam), await cancel(o2, mainExam),
            await extend(o2, mainExam, 2, `${wibDay(1)}T21:00`), await post(o2, `${P}/sessions`, { periodId: period1, ...nextSlot(), actionKey: randomUUID() }),
            await post(o2, `${P}/placements`, placement(session.sessionId, { teachingAssignmentId: physics }))]) {
            assert.deepEqual([r.status, r.body], [403, { error: 'forbidden' }]);
        }
        const holder = await pool.connect();
        try {
            await holder.query('BEGIN');
            await holder.query('UPDATE academic_core_teaching_assignments SET revoked_at = clock_timestamp() WHERE id = $1', [biology]);
            const pending = post(o, `${P}/placements`, placement(session.sessionId, { teachingAssignmentId: biology }));
            await lockWaitObserved(pool, pending);
            await holder.query('COMMIT');
            const r = await pending;
            assert.deepEqual([r.status, r.body], [422, { error: 'composition_invalid', problems: [{ code: 'teaching_assignment_unknown' }] }]);
        } catch (error) {
            await holder.query('ROLLBACK').catch(() => {});
            throw error;
        } finally {
            holder.release();
        }
        assert.deepEqual(await counts(pool), before, 'nothing was written');
    });

    await t.test('I-11 concurrency: one placement per subject x rombel, double booking caught at mark ready, labels, slots, extensions, content races, replays', async () => {
        const p5 = await createPeriod(o, 'Ujian Serentak');
        const a = await createSession(p5);
        const b = await createSession(p5);
        const raced = await Promise.all([post(o, `${P}/placements`, placement(a.sessionId)), post(o, `${P}/placements`, placement(b.sessionId))]);
        assert.deepEqual(raced.map(r => r.status).sort(), [201, 422], JSON.stringify(raced.map(r => r.body)));
        assert.deepEqual(raced.find(r => r.status === 422)!.body.problems, [{ code: 'already_placed' }]);
        // E16: different subjects of rombel X in overlapping sessions may both pass the overlap query.
        const p6 = await createPeriod(o, 'Ujian Tumpang');
        const day9 = wibDay(9);
        const x = await createSession(p6, { date: day9, startTime: '10:00', endTime: '11:00' });
        const y = await createSession(p6, { date: day9, startTime: '10:30', endTime: '11:30' });
        const both = await Promise.all([post(o, `${P}/placements`, placement(x.sessionId)), post(o, `${P}/placements`, placement(y.sessionId, { teachingAssignmentId: physics }))]);
        assert.ok(both.some(r => r.status === 201), JSON.stringify(both.map(r => r.body)));
        for (const r of both.filter(r => r.status !== 201)) assert.deepEqual(r.body.problems, [{ code: 'schedule_conflict', count: 3 }]);
        // The double booking is caught at mark ready, and the Operator cancels one placement (OP-8 A).
        const pF = await createPeriod(o, 'Ujian Ganda');
        const day10 = wibDay(10);
        const f1 = await createSession(pF, { date: day10, startTime: '10:00', endTime: '11:00' });
        const f2 = await createSession(pF, { date: day10, startTime: '10:30', endTime: '11:30' });
        const d1 = await fixtureExam(f1.sessionId, { deadlineSeconds: 1, questions: 1 });
        const d2 = await fixtureExam(f2.sessionId, { deadlineSeconds: 1, questions: 1, teachingAssignmentId: physics });
        await deadlinePassed(pool, d1);
        await deadlinePassed(pool, d2);
        const conflict = await markReady(o, d1);
        assert.deepEqual([conflict.status, conflict.body.error, conflict.body.readiness.baseline.blocker], [409, 'not_ready', 'participant_schedule_conflict']);
        assert.equal((await cancel(o, d2)).status, 200);
        assert.equal((await markReady(o, d1)).status, 200);
        // One label and one slot at a time: the unique constraint answers like the check.
        const labels = await Promise.all([1, 2].map(() => post(o, `${P}/periods`, { label: 'Serentak', assessmentTypeId: teaching.assessmentTypeId, academicPeriodId, actionKey: randomUUID() })));
        assert.deepEqual(labels.map(r => r.status).sort(), [201, 422]);
        assert.deepEqual(labels.find(r => r.status === 422)!.body.problems, [{ code: 'label_taken' }]);
        const slot = nextSlot();
        const slots = await Promise.all([1, 2].map(() => post(o, `${P}/sessions`, { periodId: p5, ...slot, actionKey: randomUUID() })));
        assert.deepEqual(slots.map(r => r.status).sort(), [201, 422]);
        assert.deepEqual(slots.find(r => r.status === 422)!.body.problems, [{ code: 'session_taken' }]);
        // Two extensions from one revision: one succeeds, the other is stale.
        const fxExt = await fixtureExam((await createSession(period2)).sessionId, { deadlineSeconds: 3600, questions: 0 });
        const exts = await Promise.all([extend(o, fxExt, 1, `${wibDay(2)}T05:00`), extend(o, fxExt, 1, `${wibDay(2)}T06:00`)]);
        assert.deepEqual(exts.map(r => r.status).sort(), [200, 409], JSON.stringify(exts.map(r => r.body)));
        assert.equal(exts.find(r => r.status === 409)!.body.error, 'stale_deadline');
        const revisions = (await pool.query('SELECT revision FROM secure_assessment_institution_preparation_deadlines WHERE exam_instance_id = $1', [fxExt])).rows.map(r => r.revision as number);
        assert.equal(Math.max(...revisions), 2);
        // Content racing an extension, mark ready and a cancellation: serialized by the exam row lock.
        const withExtension = await Promise.all([contentConfirm(tc, fxExt, FILE_A), extend(o, fxExt, 2, `${wibDay(2)}T07:00`)]);
        assert.deepEqual(withExtension.map(r => r.status), [201, 200], JSON.stringify(withExtension.map(r => r.body)));
        assert.equal((await snapshotsOf(fxExt)).length, 2);
        const withReady = await Promise.all([contentConfirm(tc, fxExt, FILE_B), markReady(o, fxExt)]);
        assert.deepEqual([withReady[0].status, withReady[1].body.error], [201, 'preparation_open']);
        const fxCancel = await fixtureExam((await createSession(period2)).sessionId, { deadlineSeconds: 3600, questions: 0 });
        const withCancel = await Promise.all([contentConfirm(tc, fxCancel, FILE_A), cancel(o, fxCancel)]);
        assert.equal(withCancel[1].status, 200);
        const stored = (await snapshotsOf(fxCancel)).length;
        if (withCancel[0].status === 201) assert.equal(stored, 2);
        else {
            assert.deepEqual(withCancel[0].body, { error: 'invalid_state', currentState: 'ARCHIVED' });
            assert.equal(stored, 0);
        }
        // Two concurrent replays of one content key: one batch.
        const key = randomUUID();
        assert.equal((await contentConfirm(tc, fxExt, FILE_A, key)).status, 201);
        const batches = async () => (await pool.query('SELECT count(*)::int AS n FROM secure_assessment_question_import_batches WHERE exam_instance_id = $1', [fxExt])).rows[0].n;
        const n = await batches();
        const replays = await Promise.all([contentConfirm(tc, fxExt, FILE_A, key), contentConfirm(tc, fxExt, FILE_A, key)]);
        for (const r of replays) assert.ok((r.status === 200 && r.body.replayed === true) || (r.status === 409 && r.body.error === 'state_changed'), JSON.stringify(r.body));
        assert.ok(replays.some(r => r.status === 200));
        assert.equal(await batches(), n);
    });

    await t.test('I-4b the trigger FOR SHARE serializes a raw writer with mark ready, in both orders', async () => {
        // Mark ready holds the exam FOR UPDATE; a raw INSERT waits on its FOR SHARE, then sees READY and is refused.
        const g = gate();
        let enabled = false;
        const gatedApp = await startProductionWiredServer(gatedPool(pool, sql => sql.includes('FOR UPDATE OF i') && sql.includes('secure_assessment_institution_exam_sessions'), g, () => enabled));
        try {
            const og = await login(operator, tenant, gatedApp.baseUrl);
            const exam = await fixtureExam((await createSession(period2)).sessionId, { deadlineSeconds: 1, questions: 1 });
            await deadlinePassed(pool, exam);
            enabled = true;
            const ready = markReady(og, exam);
            await g.arrived;
            const raw = await pool.connect();
            try {
                await raw.query('BEGIN');
                const insert = raw.query('INSERT INTO secure_assessment_exam_question_snapshots (tenant_id, exam_instance_id, frozen_content, display_order) VALUES ($1, $2, $3, 2)',
                    [tenant, exam, JSON.stringify(baselineQuestion(2))]).then(() => null, (error: Error) => error);
                await lockWaitObserved(pool, insert);
                g.release();
                const response = await ready;
                assert.deepEqual([response.status, response.body], [200, { examInstanceId: exam, lifecycleState: 'READY' }]);
                const refusal = await insert;
                assert.match(String(refusal?.message), TRIGGER_REFUSAL);
            } finally {
                await raw.query('ROLLBACK');
                raw.release();
            }
            assert.equal((await snapshotsOf(exam)).length, 1, 'readiness saw only the committed content');
        } finally {
            enabled = false;
            g.release();
            await gatedApp.close();
        }
        // A raw INSERT started before the deadline holds FOR SHARE; mark ready waits, then evaluates the committed rows.
        const exam2 = await fixtureExam((await createSession(period2)).sessionId, { deadlineSeconds: 3, questions: 1 });
        const raw = await pool.connect();
        try {
            await raw.query('BEGIN');
            await raw.query('INSERT INTO secure_assessment_exam_question_snapshots (tenant_id, exam_instance_id, frozen_content, display_order) VALUES ($1, $2, $3, 2)',
                [tenant, exam2, JSON.stringify(baselineQuestion(2))]);
            await deadlinePassed(pool, exam2);
            const ready = markReady(o, exam2);
            await lockWaitObserved(pool, ready);
            await raw.query('COMMIT');
            const response = await ready;
            assert.deepEqual([response.status, response.body], [200, { examInstanceId: exam2, lifecycleState: 'READY' }]);
        } catch (error) {
            await raw.query('ROLLBACK').catch(() => {});
            throw error;
        } finally {
            raw.release();
        }
        assert.equal((await snapshotsOf(exam2)).length, 2);
    });

    await t.test('I-15 a participant sees the placed exam as scheduled, without content, and cannot start it', async () => {
        const before = await counts(pool);
        const listed = await sc.request('/api/v1/assessment/assigned-exams');
        assert.equal(listed.status, 200, JSON.stringify(listed.body));
        const mine = listed.body.assignments.find((x: Body) => x.examInstanceId === mainExam);
        assert.deepEqual([mine.schedule.lifecycleState, mine.schedule.windowStartsAt, mine.subjectLabel], ['SCHEDULED', sMain.startsAt, 'Matematika']);
        const text = JSON.stringify(listed.body);
        for (const prompt of PROMPTS) assert.equal(text.includes(prompt), false, prompt);
        const start = await post(sc, '/api/v1/assessment/attempts/start', { examInstanceId: mainExam });
        assert.deepEqual([start.status, start.body], [409, { error: 'exam_not_active' }]);
        assert.deepEqual(await counts(pool), before);
    });

    await t.test('I-10 no Operator response carries a question, a key, a rubric, a score or personal data', async () => {
        const bodies = [...receipts, (await o.request(P)).body, (await o.request(`${P}?periodId=${period1}`)).body, (await o.request(`${P}?periodId=${period2}`)).body];
        const keys = keysOf(bodies);
        for (const key of ['prompt', 'options', 'correct', 'correctOptionId', 'rubric', 'score', 'nisn', 'birthDate', 'questions', 'frozenContent']) {
            assert.equal(keys.has(key), false, key);
        }
        const text = JSON.stringify(bodies);
        for (const prompt of PROMPTS) assert.equal(text.includes(prompt), false, prompt);
        for (const s of students) assert.equal(text.includes(s.username), false, 'no student identity');
    });

    await t.test('I-17 the edge of every new path: a foreign Origin and an oversized body are refused before any effect', async () => {
        const before = await counts(pool);
        const operatorPaths = ['periods', 'sessions', 'placements', 'deadline', 'cancel', 'transition'].map(p => `${P}/${p}`);
        for (const path of [...operatorPaths, `${CONTENT}/preview`, CONTENT]) {
            const r = await o.request(path, { method: 'POST', body: { examInstanceId: mainExam }, origin: 'https://lain.example' });
            assert.deepEqual([r.status, r.body], [403, { error: 'origin_not_allowed' }], path);
        }
        for (const path of operatorPaths) {
            const r = await o.request(path, { method: 'POST', rawBody: JSON.stringify({ label: 'x'.repeat(65 * 1024) }), headers: { 'Content-Type': 'application/json' } });
            assert.deepEqual([r.status, r.body], [413, { error: 'payload_too_large' }], path);
        }
        for (const path of [`${CONTENT}/preview`, CONTENT]) {
            const r = await tc.request(path, { method: 'POST', rawBody: JSON.stringify({ examInstanceId: mainExam, questionsCsv: 'x'.repeat(1024 * 1024 + 1), sourceFileName: null }), headers: { 'Content-Type': 'application/json' } });
            assert.deepEqual([r.status, r.body], [413, { error: 'payload_too_large' }], path);
        }
        assert.deepEqual(await counts(pool), before);
    });

    await t.test('N03 a revoked teaching assignment loses the content routes', async () => {
        const before = await counts(pool);
        await pool.query('UPDATE academic_core_teaching_assignments SET revoked_at = clock_timestamp() WHERE id = $1', [teaching.teachingAssignmentId]);
        assert.deepEqual((await contentPreview(tc, mainExam, FILE_A)).body, { error: 'forbidden' });
        assert.deepEqual((await contentConfirm(tc, mainExam, FILE_A)).body, { error: 'forbidden' });
        assert.deepEqual(await counts(pool), before);
    });
});

test('ASSESS-INSTITUTION-001 C03 migration 0062 (I-14): upgrade on a populated database, rollback, repeat, append-only, constraints and the session guard', { skip: skipWithoutDatabase }, async t => {
    const db = await createDisposableDatabase({ migrate: false });
    t.after(() => db.close());
    const c = await db.pool.connect();
    try {
        const dir = new URL('../../../../database/migrations/', import.meta.url);
        for (const name of (await readdir(dir)).filter(n => /^\d{4}.*\.sql$/.test(n) && n < '0062').sort()) await c.query(await readFile(new URL(name, dir), 'utf8'));
        // A populated database: a teacher-managed exam with questions.
        const tenant = await createTenant(db.pool);
        const teacher = await createPersonWithAccount(db.pool);
        const teaching: TeachingContext = await createTeachingContext(db.pool, tenant, await addMembership(db.pool, tenant, teacher.personId), 'IPA');
        const exam = await createExamInstance(db.pool, tenant, teaching, { lifecycleState: 'SCHEDULED' });
        await addQuestionSnapshots(db.pool, tenant, exam, 2);
        const shape = async () => (await c.query(
            `SELECT (SELECT count(*)::int FROM information_schema.columns WHERE table_name = 'secure_assessment_exam_instances' AND column_name = 'institution_session_id') AS columns,
                    (SELECT count(*)::int FROM pg_tables WHERE tablename IN ('secure_assessment_institution_exam_periods', 'secure_assessment_institution_exam_sessions',
                        'secure_assessment_institution_preparation_deadlines')) AS tables,
                    (SELECT count(*)::int FROM pg_trigger WHERE tgname IN ('trg_guard_sa_institution_exam_content', 'trg_guard_sa_exam_institution_session')) AS triggers`)).rows[0];
        assert.deepEqual(await shape(), { columns: 0, tables: 0, triggers: 0 });
        const sql = await readFile(new URL('0062_secure_assessment_institution_exams.sql', dir), 'utf8');
        const failing = sql.replace("INSERT INTO elligble_migration_history (migration_id) VALUES ('0062_secure_assessment_institution_exams');", "RAISE EXCEPTION 'synthetic migration rollback';");
        assert.notEqual(failing, sql);
        await assert.rejects(c.query(failing), /synthetic migration rollback/);
        await c.query('ROLLBACK');
        assert.deepEqual(await shape(), { columns: 0, tables: 0, triggers: 0 }, 'the failed migration left nothing behind');
        await c.query(sql);
        await c.query(sql);
        assert.equal((await c.query("SELECT count(*)::int AS n FROM elligble_migration_history WHERE migration_id = '0062_secure_assessment_institution_exams'")).rows[0].n, 1);
        assert.deepEqual(await shape(), { columns: 1, tables: 3, triggers: 2 });
        // Existing exams stay teacher-managed and behave as before: the content lock does not apply to them.
        assert.equal((await c.query('SELECT institution_session_id FROM secure_assessment_exam_instances WHERE id = $1', [exam])).rows[0].institution_session_id, null);
        assert.equal((await c.query('SELECT count(*)::int AS n FROM secure_assessment_exam_question_snapshots WHERE exam_instance_id = $1', [exam])).rows[0].n, 2);
        const extra = (await c.query('INSERT INTO secure_assessment_exam_question_snapshots (tenant_id, exam_instance_id, frozen_content, display_order) VALUES ($1, $2, $3, 3) RETURNING id',
            [tenant, exam, JSON.stringify(baselineQuestion(3))])).rows[0].id;
        await c.query('DELETE FROM secure_assessment_exam_question_snapshots WHERE id = $1', [extra]);
        // The institution tables and their constraints.
        const academicPeriodId = (await c.query('SELECT o.academic_period_id FROM academic_core_teaching_assignments a JOIN academic_core_subject_offerings o ON o.id = a.subject_offering_id WHERE a.id = $1',
            [teaching.teachingAssignmentId])).rows[0].academic_period_id;
        const insertPeriod = (label: string) => c.query(
            `INSERT INTO secure_assessment_institution_exam_periods (tenant_id, academic_period_id, assessment_type_id, label, created_by_person_id, action_key, request_digest)
             VALUES ($1, $2, $3, $4, $5, gen_random_uuid(), repeat('a', 64)) RETURNING id`, [tenant, academicPeriodId, teaching.assessmentTypeId, label, teacher.personId]);
        const period = (await insertPeriod('PTS')).rows[0].id;
        await assert.rejects(insertPeriod(' PTS2'), /ck_sa_institution_period_label/);
        await assert.rejects(insertPeriod('PTS'), /uq_sa_institution_period_label/);
        const insertSession = (startHours: number, endHours: number) => c.query(
            `INSERT INTO secure_assessment_institution_exam_sessions (tenant_id, period_id, starts_at, ends_at, created_by_person_id, action_key, request_digest)
             VALUES ($1, $2, statement_timestamp() + $3 * interval '1 hour', statement_timestamp() + $4 * interval '1 hour', $5, gen_random_uuid(), repeat('a', 64)) RETURNING id`,
            [tenant, period, startHours, endHours, teacher.personId]);
        const s1 = (await insertSession(48, 50)).rows[0].id;
        const s2 = (await insertSession(72, 74)).rows[0].id;
        await assert.rejects(insertSession(80, 79), /ck_sa_institution_session_window/);
        const institutionExam = (await c.query(
            `INSERT INTO secure_assessment_exam_instances (tenant_id, teaching_assignment_id, assessment_type_id, lifecycle_state, window_starts_at, window_ends_at,
                configured_attempt_duration_seconds, latest_start_policy, room_based_operations_enabled, proctor_per_room_required, institution_session_id)
             SELECT $1, $2, $3, 'SCHEDULED', s.starts_at, s.ends_at, 3600, 'FULL_DURATION_BEYOND_WINDOW', FALSE, FALSE, s.id
             FROM secure_assessment_institution_exam_sessions s WHERE s.id = $4 RETURNING id`, [tenant, teaching.teachingAssignmentId, teaching.assessmentTypeId, s1])).rows[0].id;
        const deadline = (revision: number, hours: number, previous: number | null, reason: string | null) => c.query(
            `INSERT INTO secure_assessment_institution_preparation_deadlines
                 (tenant_id, exam_instance_id, revision, deadline_at, previous_deadline_at, reason, set_by_person_id, action_key, request_digest)
             VALUES ($1, $2, $3, date_trunc('hour', statement_timestamp()) + $4 * interval '1 hour',
                     CASE WHEN $5::int IS NULL THEN NULL ELSE date_trunc('hour', statement_timestamp()) + $5::int * interval '1 hour' END, $6, $7, gen_random_uuid(), repeat('a', 64))`,
            [tenant, institutionExam, revision, hours, previous, reason, teacher.personId]);
        await assert.rejects(deadline(1, 24, null, 'alasan'), /ck_sa_institution_deadline_revision/);
        await assert.rejects(deadline(1, 24, 12, null), /ck_sa_institution_deadline_revision/);
        // The content lock: an institution exam without a deadline takes no question.
        await assert.rejects(c.query('INSERT INTO secure_assessment_exam_question_snapshots (tenant_id, exam_instance_id, frozen_content, display_order) VALUES ($1, $2, $3, 1)',
            [tenant, institutionExam, JSON.stringify(baselineQuestion(1))]), /change only while it is scheduled/);
        await deadline(1, 24, null, null);
        await assert.rejects(deadline(2, 20, 24, 'lebih awal'), /ck_sa_institution_deadline_revision/);
        await assert.rejects(deadline(2, 30, 24, null), /ck_sa_institution_deadline_revision/);
        await assert.rejects(deadline(2, 30, 24, ' spasi'), /ck_sa_institution_deadline_revision/);
        await assert.rejects(deadline(1, 30, null, null), /uq_sa_institution_deadline_revision/);
        await deadline(2, 30, 24, 'Guru sakit');
        // Before the deadline and SCHEDULED, an institution exam's questions may change; once READY they may not.
        const snapshot = (await c.query('INSERT INTO secure_assessment_exam_question_snapshots (tenant_id, exam_instance_id, frozen_content, display_order) VALUES ($1, $2, $3, 1) RETURNING id',
            [tenant, institutionExam, JSON.stringify(baselineQuestion(1))])).rows[0].id;
        await c.query(`UPDATE secure_assessment_exam_instances SET lifecycle_state = 'READY' WHERE id = $1`, [institutionExam]);
        await assert.rejects(c.query('DELETE FROM secure_assessment_exam_question_snapshots WHERE id = $1', [snapshot]), /change only while it is scheduled/);
        // Append-only.
        const appendOnly: Array<[string, string]> = [
            ['secure_assessment_institution_exam_periods', 'created_by_person_id'],
            ['secure_assessment_institution_exam_sessions', 'created_by_person_id'],
            ['secure_assessment_institution_preparation_deadlines', 'set_by_person_id'],
        ];
        for (const [table, column] of appendOnly) {
            await assert.rejects(c.query(`UPDATE ${table} SET ${column} = ${column}`), /append-only/, table);
            await assert.rejects(c.query(`DELETE FROM ${table}`), /append-only/, table);
        }
        // The session reference never changes, in any direction.
        await assert.rejects(c.query('UPDATE secure_assessment_exam_instances SET institution_session_id = $2 WHERE id = $1', [exam, s1]), /never moves/);
        await assert.rejects(c.query('UPDATE secure_assessment_exam_instances SET institution_session_id = NULL WHERE id = $1', [institutionExam]), /never moves/);
        await assert.rejects(c.query('UPDATE secure_assessment_exam_instances SET institution_session_id = $2 WHERE id = $1', [institutionExam, s2]), /never moves/);
        await c.query('UPDATE secure_assessment_exam_instances SET institution_session_id = institution_session_id WHERE id = $1', [institutionExam]);
    } finally {
        c.release();
    }
});
