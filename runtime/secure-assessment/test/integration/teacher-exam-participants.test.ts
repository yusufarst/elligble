import { test } from 'node:test';
import * as assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createDisposableDatabase, skipWithoutDatabase } from '../support/pg-harness.ts';
import {
    addMembership, addProctorAssignment, addQuestionSnapshots, createExamInstance, createPersonWithAccount,
    createTeachingContext, createTenant, enrollInTeachingGroup, type PersonAccount, type TeachingContext,
} from '../support/fixtures.ts';
import { BrowserLikeClient, startProductionWiredServer } from '../support/test-server.ts';

// Adding participants to a scheduled or ready exam against real PostgreSQL (ASSESS-TEACHER-004;
// D04.2-64 LOCKED): only the managing teacher, only students enrolled in the exam's class on
// the exam day and not expected elsewhere at the same time, everyone in a request or no one;
// each request kept with who, when and the state the exam had, each participant with its
// enrollment, append-only; a ready exam scheduled again and marked ready anew; safe to repeat;
// never after the exam opened; the added student finds the exam and can start it.

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
const HOUR = 3_600_000;
const jakartaDay = (at: Date) =>
    new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta', year: 'numeric', month: '2-digit', day: '2-digit' }).format(at);

test('adding participants after scheduling (real PostgreSQL, production wiring)', { skip: skipWithoutDatabase }, async (t) => {
    const db = await createDisposableDatabase();
    const app = await startProductionWiredServer(db.pool);
    t.after(async () => {
        await app.close();
        await db.close();
    });
    const pool = db.pool;
    const tenant = await createTenant(pool);
    const teacher = await createPersonWithAccount(pool, 'guru.tambah');
    const otherTeacher = await createPersonWithAccount(pool);
    const proctor = await createPersonWithAccount(pool);
    const teaching = await createTeachingContext(pool, tenant, await addMembership(pool, tenant, teacher.personId), 'Biologi');
    const otherTeaching = await createTeachingContext(pool, tenant, await addMembership(pool, tenant, otherTeacher.personId), 'Kimia');
    await addMembership(pool, tenant, proctor.personId);

    interface Student extends PersonAccount { membershipId: string; enrollmentId: string }
    const today = jakartaDay(new Date());
    const dayOffset = (days: number) => jakartaDay(new Date(Date.now() + days * 24 * HOUR));
    async function student(username: string, where: TeachingContext = teaching, dates: { startDate?: string; endDate?: string | null } = {}): Promise<Student> {
        const person = await createPersonWithAccount(pool, username);
        const membershipId = await addMembership(pool, tenant, person.personId);
        const enrollmentId = await enrollInTeachingGroup(pool, tenant, where, membershipId, dates);
        return { ...person, membershipId, enrollmentId };
    }
    // The class: A takes part from the start; B, C and G can be added; C is expected elsewhere
    // at the same time in one slot; D left the class before the exam; E is in another class;
    // F joins after the exam; G is enrolled twice in the class.
    const sA = await student('siswa.tambah.a');
    const sB = await student('siswa.tambah.b');
    const sC = await student('siswa.tambah.c');
    const sD = await student('siswa.tambah.d', teaching, { endDate: dayOffset(-1) });
    const sE = await student('siswa.tambah.e', otherTeaching);
    const sF = await student('siswa.tambah.f', teaching, { startDate: dayOffset(30) });
    const sG = await student('siswa.tambah.g');
    const sGAgain = await enrollInTeachingGroup(pool, tenant, teaching, sG.membershipId);
    assert.ok(today < dayOffset(30));

    const loggedIn = async (person: { username: string; password: string }, tenantId = tenant) => {
        const c = new BrowserLikeClient(app.baseUrl);
        assert.equal((await c.login(person.username, person.password)).status, 200);
        c.tenantId = tenantId;
        return c;
    };
    const teacherClient = await loggedIn(teacher);
    const candidates = (c: BrowserLikeClient, exam: string) =>
        c.request(`/api/v1/assessment/teacher-exams/participants/candidates?examInstanceId=${exam}`);
    const add = (c: BrowserLikeClient, body: Record<string, unknown>) =>
        c.request('/api/v1/assessment/teacher-exams/participants/add', { method: 'POST', body });
    const transition = (examInstanceId: string, action: string) =>
        teacherClient.request('/api/v1/assessment/teacher-exams/transition', { method: 'POST', body: { examInstanceId, action } });
    const stateOf = async (exam: string) => (await pool.query('SELECT lifecycle_state FROM secure_assessment_exam_instances WHERE id = $1', [exam])).rows[0]?.lifecycle_state;
    const participantsOf = async (exam: string) => (await pool.query(
        'SELECT person_id, academic_enrollment_id FROM secure_assessment_exam_participants WHERE exam_instance_id = $1 ORDER BY created_at, id',
        [exam]
    )).rows;
    const additionsOf = async (exam: string) => (await pool.query(
        `SELECT a.id, a.added_by_person_id, a.added_at, a.previous_lifecycle_state, a.action_key,
                (SELECT array_agg(e.academic_enrollment_id::text ORDER BY e.academic_enrollment_id)
                 FROM secure_assessment_exam_participant_addition_entries e WHERE e.participant_addition_id = a.id) AS enrollments
         FROM secure_assessment_exam_participant_additions a WHERE a.exam_instance_id = $1 ORDER BY a.added_at`,
        [exam]
    )).rows;
    const eventsOf = async (exam: string) => (await pool.query(
        'SELECT from_state, to_state, actor_person_id, occurred_at FROM secure_assessment_exam_lifecycle_events WHERE exam_instance_id = $1 ORDER BY occurred_at',
        [exam]
    )).rows;

    // Every exam gets its own two-hour slot, so exams of different subtests never overlap.
    let slot = 0;
    async function plannedExam(lifecycleState = 'SCHEDULED', options: { startsAt?: Date; rooms?: boolean; where?: TeachingContext; participants?: Student[] } = {}) {
        const startsAt = options.startsAt ?? new Date(Date.now() + (24 + 3 * slot++) * HOUR);
        const exam = await createExamInstance(pool, tenant, options.where ?? teaching, {
            lifecycleState, windowStartsAt: startsAt, windowEndsAt: new Date(startsAt.getTime() + 2 * HOUR), durationSeconds: 3600,
            roomBasedOperations: options.rooms ?? false,
        });
        await addQuestionSnapshots(pool, tenant, exam, 2);
        for (const s of options.participants ?? [sA]) {
            await pool.query(
                'INSERT INTO secure_assessment_exam_participants (tenant_id, exam_instance_id, person_id, academic_enrollment_id) VALUES ($1, $2, $3, $4)',
                [tenant, exam, s.personId, s.enrollmentId]
            );
        }
        return { exam, startsAt };
    }

    await t.test('the class on the exam day is offered, without participants, leavers, later joiners or other classes; conflicts marked', async () => {
        const { exam, startsAt } = await plannedExam();
        // C is expected in another teacher's exam overlapping this one.
        await plannedExam('SCHEDULED', { startsAt: new Date(startsAt.getTime() + HOUR), where: otherTeaching, participants: [sC] });
        const res = await candidates(teacherClient, exam);
        assert.equal(res.status, 200, JSON.stringify(res.body));
        assert.deepEqual(res.body, {
            examInstanceId: exam,
            lifecycleState: 'SCHEDULED',
            examDay: jakartaDay(startsAt),
            participantCount: 1,
            candidates: [
                { enrollmentId: sB.enrollmentId, elligbleId: 'siswa.tambah.b', conflict: false },
                { enrollmentId: sC.enrollmentId, elligbleId: 'siswa.tambah.c', conflict: true },
                // Enrolled twice: offered once.
                { enrollmentId: res.body.candidates[2]?.enrollmentId, elligbleId: 'siswa.tambah.g', conflict: false },
            ],
            problems: [],
        });
        assert.ok([sG.enrollmentId, sGAgain].includes(res.body.candidates[2].enrollmentId));
        const offered = JSON.stringify(res.body);
        for (const absent of [sA, sD, sE, sF]) assert.ok(!offered.includes(absent.enrollmentId), absent.username);
        assert.equal((await candidates(teacherClient, 'bukan-id')).status, 400);
    });

    await t.test('the managing teacher adds a student: kept with who, when and the enrollment; the student finds the exam', async () => {
        const { exam } = await plannedExam();
        const actionKey = randomUUID();
        const res = await add(teacherClient, { examInstanceId: exam, enrollmentIds: [sB.enrollmentId.toUpperCase()], actionKey });
        assert.equal(res.status, 200, JSON.stringify(res.body));
        assert.deepEqual({ ...res.body, addedAt: undefined }, {
            examInstanceId: exam, lifecycleState: 'SCHEDULED', addedAt: undefined, replayed: false,
            added: [{ enrollmentId: sB.enrollmentId, elligbleId: 'siswa.tambah.b' }],
        });
        assert.deepEqual(await participantsOf(exam), [
            { person_id: sA.personId, academic_enrollment_id: sA.enrollmentId },
            { person_id: sB.personId, academic_enrollment_id: sB.enrollmentId },
        ]);
        const [addition] = await additionsOf(exam);
        assert.deepEqual({ ...addition, id: undefined, added_at: addition.added_at.toISOString() }, {
            id: undefined, added_by_person_id: teacher.personId, added_at: res.body.addedAt, previous_lifecycle_state: 'SCHEDULED',
            action_key: actionKey, enrollments: [sB.enrollmentId],
        });
        assert.equal(await stateOf(exam), 'SCHEDULED');
        assert.deepEqual(await eventsOf(exam), [], 'a scheduled exam stays scheduled');

        const listed = (await (await loggedIn(sB)).request('/api/v1/assessment/assigned-exams')).body.assignments
            .map((a: { examInstanceId: string }) => a.examInstanceId);
        assert.ok(listed.includes(exam), 'the added student finds the exam');
        const card = (await teacherClient.request('/api/v1/assessment/teacher-readiness')).body.exams
            .find((e: { examInstanceId: string }) => e.examInstanceId === exam);
        assert.deepEqual({ participants: card.participants, participantsAddedAt: card.participantsAddedAt }, { participants: 2, participantsAddedAt: res.body.addedAt });
        assert.equal((await candidates(teacherClient, exam)).body.candidates.some((c: { enrollmentId: string }) => c.enrollmentId === sB.enrollmentId), false);

        // Append-only, one entry per participant.
        await assert.rejects(pool.query(`UPDATE secure_assessment_exam_participant_additions SET previous_lifecycle_state = 'READY' WHERE id = $1`, [addition.id]), /append-only/);
        await assert.rejects(pool.query('DELETE FROM secure_assessment_exam_participant_additions WHERE id = $1', [addition.id]), /append-only/);
        await assert.rejects(pool.query('UPDATE secure_assessment_exam_participant_addition_entries SET academic_enrollment_id = $2 WHERE participant_addition_id = $1', [addition.id, sC.enrollmentId]), /append-only/);
        await assert.rejects(pool.query('DELETE FROM secure_assessment_exam_participant_addition_entries WHERE participant_addition_id = $1', [addition.id]), /append-only/);
        const second = await pool.query(
            `INSERT INTO secure_assessment_exam_participant_additions (tenant_id, exam_instance_id, added_by_person_id, previous_lifecycle_state, action_key)
             VALUES ($1, $2, $3, 'SCHEDULED', $4) RETURNING id`,
            [tenant, exam, teacher.personId, randomUUID()]
        );
        const participantB = (await pool.query('SELECT id FROM secure_assessment_exam_participants WHERE exam_instance_id = $1 AND person_id = $2', [exam, sB.personId])).rows[0].id;
        await assert.rejects(pool.query(
            `INSERT INTO secure_assessment_exam_participant_addition_entries (participant_addition_id, tenant_id, exam_instance_id, exam_participant_id, academic_enrollment_id)
             VALUES ($1, $2, $3, $4, $5)`,
            [second.rows[0].id, tenant, exam, participantB, sB.enrollmentId]
        ), /uq_sa_participant_addition_entry_participant/);
        await assert.rejects(pool.query(
            `INSERT INTO secure_assessment_exam_participant_additions (tenant_id, exam_instance_id, added_by_person_id, previous_lifecycle_state, action_key)
             VALUES ($1, $2, $3, 'ACTIVE', $4)`,
            [tenant, exam, teacher.personId, randomUUID()]
        ), /ck_sa_participant_addition_state/);
        // One key per school, whatever the path (the exam row lock orders same-exam retries
        // before the key could collide, so this is checked directly).
        await assert.rejects(pool.query(
            `INSERT INTO secure_assessment_exam_participant_additions (tenant_id, exam_instance_id, added_by_person_id, previous_lifecycle_state, action_key)
             VALUES ($1, $2, $3, 'SCHEDULED', $4)`,
            [tenant, exam, teacher.personId, actionKey]
        ), /uq_sa_participant_addition_action_key/);
    });

    await t.test('the exam day is the school date: early-morning exams take the class of that day', async () => {
        // 01.00 WIB is the evening before in UTC; a student enrolled from that school day is offered.
        const day = dayOffset(5);
        const startsAt = new Date(`${day}T01:00:00+07:00`);
        const sH = await student('siswa.tambah.h', teaching, { startDate: day });
        const { exam } = await plannedExam('SCHEDULED', { startsAt });
        const res = await candidates(teacherClient, exam);
        assert.equal(res.status, 200);
        assert.equal(res.body.examDay, day);
        assert.ok(res.body.candidates.some((c: { enrollmentId: string }) => c.enrollmentId === sH.enrollmentId), 'enrolled from the exam day');
        const added = await add(teacherClient, { examInstanceId: exam, enrollmentIds: [sH.enrollmentId], actionKey: randomUUID() });
        assert.equal(added.status, 200, JSON.stringify(added.body));
    });

    await t.test('a ready exam is scheduled again after an addition and marked ready anew', async () => {
        const { exam } = await plannedExam('READY');
        const res = await add(teacherClient, { examInstanceId: exam, enrollmentIds: [sB.enrollmentId, sG.enrollmentId], actionKey: randomUUID() });
        assert.equal(res.status, 200, JSON.stringify(res.body));
        assert.equal(res.body.lifecycleState, 'SCHEDULED');
        assert.deepEqual(res.body.added.map((a: { elligbleId: string }) => a.elligbleId), ['siswa.tambah.b', 'siswa.tambah.g']);
        assert.equal(await stateOf(exam), 'SCHEDULED');
        const [addition] = await additionsOf(exam);
        assert.equal(addition.previous_lifecycle_state, 'READY');
        assert.deepEqual(addition.enrollments, [sB.enrollmentId, sG.enrollmentId].sort());
        const events = await eventsOf(exam);
        assert.deepEqual(events.map(e => ({ ...e, occurred_at: e.occurred_at.toISOString() })), [
            { from_state: 'READY', to_state: 'SCHEDULED', actor_person_id: teacher.personId, occurred_at: res.body.addedAt },
        ]);
        const ready = await transition(exam, 'mark_ready');
        assert.equal(ready.status, 200, JSON.stringify(ready.body));
        assert.equal(await stateOf(exam), 'READY');
    });

    await t.test('repeating an addition is safe: a retry is replayed, a key serves one request, racing requests add once', async () => {
        const { exam } = await plannedExam();
        const actionKey = randomUUID();
        const first = await add(teacherClient, { examInstanceId: exam, enrollmentIds: [sB.enrollmentId], actionKey });
        assert.equal(first.status, 200);
        const retry = await add(teacherClient, { examInstanceId: exam, enrollmentIds: [sB.enrollmentId], actionKey });
        assert.equal(retry.status, 200);
        assert.deepEqual(retry.body, { ...first.body, replayed: true });
        for (const other of [
            { examInstanceId: exam, enrollmentIds: [sG.enrollmentId], actionKey },
            { examInstanceId: exam, enrollmentIds: [sB.enrollmentId, sG.enrollmentId], actionKey },
            { examInstanceId: (await plannedExam()).exam, enrollmentIds: [sB.enrollmentId], actionKey },
        ]) {
            const reused = await add(teacherClient, other);
            assert.equal(reused.status, 409, JSON.stringify(other));
            assert.equal(reused.body.error, 'action_key_reused');
        }
        const again = await add(teacherClient, { examInstanceId: exam, enrollmentIds: [sB.enrollmentId], actionKey: randomUUID() });
        assert.equal(again.status, 422);
        assert.deepEqual(again.body.problems, [{ code: 'already_participant', count: 1 }]);
        assert.equal((await additionsOf(exam)).length, 1);
        assert.equal((await participantsOf(exam)).length, 2);

        // Requests racing each other while a transition holds the exam: one addition.
        const { exam: raced } = await plannedExam('READY');
        const holder = await pool.connect();
        let results: Awaited<ReturnType<typeof add>>[];
        try {
            await holder.query('BEGIN');
            await holder.query('SELECT id FROM secure_assessment_exam_instances WHERE id = $1 FOR UPDATE', [raced]);
            const key = randomUUID();
            const pending = Promise.all([
                add(teacherClient, { examInstanceId: raced, enrollmentIds: [sB.enrollmentId], actionKey: key }),
                add(teacherClient, { examInstanceId: raced, enrollmentIds: [sB.enrollmentId], actionKey: key }),
                add(teacherClient, { examInstanceId: raced, enrollmentIds: [sG.enrollmentId], actionKey: randomUUID() }),
            ]);
            await sleep(400);
            await holder.query('COMMIT');
            results = await pending;
        } finally {
            holder.release();
        }
        // Whatever order they take the lock in: the key adds B once and replays it, G is added.
        assert.ok(results.every(r => r.status === 200), JSON.stringify(results.map(r => r.body)));
        assert.equal(results.filter(r => r.body.replayed).length, 1, 'the retry is replayed');
        assert.deepEqual(results[0].body.added, results[1].body.added);
        assert.equal((await additionsOf(raced)).length, 2);
        assert.equal((await participantsOf(raced)).length, 3);
        assert.deepEqual((await eventsOf(raced)).map(e => [e.from_state, e.to_state]), [['READY', 'SCHEDULED']], 'scheduled again once');
    });

    await t.test('nobody is added from outside the class or into a conflict, and one refusal adds no one', async () => {
        const { exam, startsAt } = await plannedExam();
        await plannedExam('READY', { startsAt: new Date(startsAt.getTime() - HOUR), where: otherTeaching, participants: [sC] });
        const otherSchool = await createTenant(pool);
        const stranger = await createPersonWithAccount(pool);
        const strangerEnrollment = await enrollInTeachingGroup(pool, otherSchool,
            await createTeachingContext(pool, otherSchool, await addMembership(pool, otherSchool, (await createPersonWithAccount(pool)).personId)),
            await addMembership(pool, otherSchool, stranger.personId));
        const refusals: Array<[string[], Array<{ code: string; count?: number }>]> = [
            [[sE.enrollmentId], [{ code: 'not_enrolled', count: 1 }]],
            [[sD.enrollmentId], [{ code: 'not_enrolled', count: 1 }]],
            [[sF.enrollmentId], [{ code: 'not_enrolled', count: 1 }]],
            [[strangerEnrollment], [{ code: 'not_enrolled', count: 1 }]],
            [[randomUUID()], [{ code: 'not_enrolled', count: 1 }]],
            [[sB.enrollmentId, sE.enrollmentId], [{ code: 'not_enrolled', count: 1 }]],
            [[sA.enrollmentId], [{ code: 'already_participant', count: 1 }]],
            [[sG.enrollmentId, sGAgain], [{ code: 'already_participant', count: 1 }]],
            [[sC.enrollmentId], [{ code: 'schedule_conflict', count: 1 }]],
            [[sB.enrollmentId, sC.enrollmentId], [{ code: 'schedule_conflict', count: 1 }]],
            [[sE.enrollmentId, sA.enrollmentId, sC.enrollmentId], [
                { code: 'not_enrolled', count: 1 }, { code: 'already_participant', count: 1 }, { code: 'schedule_conflict', count: 1 },
            ]],
        ];
        for (const [enrollmentIds, problems] of refusals) {
            const res = await add(teacherClient, { examInstanceId: exam, enrollmentIds, actionKey: randomUUID() });
            assert.equal(res.status, 422, JSON.stringify(enrollmentIds));
            assert.deepEqual(res.body, { error: 'participants_invalid', problems }, JSON.stringify(enrollmentIds));
        }
        assert.equal((await participantsOf(exam)).length, 1, 'refused requests add no one');
        assert.equal((await additionsOf(exam)).length, 0);

        // Malformed requests.
        const valid = { examInstanceId: exam, enrollmentIds: [sB.enrollmentId], actionKey: randomUUID() };
        for (const bad of [
            { enrollmentIds: [] }, { enrollmentIds: undefined }, { enrollmentIds: 'x' }, { enrollmentIds: ['bukan-id'] },
            { enrollmentIds: [sB.enrollmentId, sB.enrollmentId.toUpperCase()] },
            { enrollmentIds: Array.from({ length: 1001 }, () => randomUUID()) },
            { examInstanceId: 'bukan-id' }, { actionKey: 'bukan-kunci' }, { actionKey: undefined },
        ]) {
            assert.equal((await add(teacherClient, { ...valid, ...bad })).status, 400, JSON.stringify(bad).slice(0, 80));
        }
        assert.equal((await teacherClient.request('/api/v1/assessment/teacher-exams/participants/add')).status, 405);
        assert.equal((await teacherClient.request('/api/v1/assessment/teacher-exams/participants/candidates?examInstanceId=' + exam, { method: 'POST', body: {} })).status, 405);
        assert.equal((await participantsOf(exam)).length, 1);
    });

    await t.test('an exam run with rooms, or a school without its time zone, takes no additions here', async () => {
        const { exam: roomed } = await plannedExam('SCHEDULED', { rooms: true });
        const offered = await candidates(teacherClient, roomed);
        assert.equal(offered.status, 200);
        assert.deepEqual({ candidates: offered.body.candidates, problems: offered.body.problems }, { candidates: [], problems: [{ code: 'rooms_in_use' }] });
        const refused = await add(teacherClient, { examInstanceId: roomed, enrollmentIds: [sB.enrollmentId], actionKey: randomUUID() });
        assert.equal(refused.status, 422);
        assert.deepEqual(refused.body.problems, [{ code: 'rooms_in_use' }]);

        const { exam } = await plannedExam();
        await pool.query('UPDATE tenant_tenants SET time_zone = NULL WHERE id = $1', [tenant]);
        try {
            const unknownDay = await candidates(teacherClient, exam);
            assert.deepEqual({ examDay: unknownDay.body.examDay, candidates: unknownDay.body.candidates, problems: unknownDay.body.problems }, {
                examDay: null, candidates: [], problems: [{ code: 'time_zone_missing' }],
            });
            const res = await add(teacherClient, { examInstanceId: exam, enrollmentIds: [sB.enrollmentId], actionKey: randomUUID() });
            assert.equal(res.status, 422);
            assert.deepEqual(res.body.problems, [{ code: 'time_zone_missing' }]);
        } finally {
            await pool.query(`UPDATE tenant_tenants SET time_zone = 'Asia/Jakarta' WHERE id = $1`, [tenant]);
        }
        assert.equal((await participantsOf(roomed)).length + (await participantsOf(exam)).length, 2);
    });

    await t.test('an opened exam takes no additions here', async () => {
        for (const state of ['ACTIVE', 'PAUSED', 'ENDED', 'FINALIZED', 'DRAFT']) {
            const { exam } = await plannedExam(state);
            const offered = await candidates(teacherClient, exam);
            assert.equal(offered.status, 409, state);
            assert.deepEqual(offered.body, { error: 'invalid_state', currentState: state });
            const res = await add(teacherClient, { examInstanceId: exam, enrollmentIds: [sB.enrollmentId], actionKey: randomUUID() });
            assert.equal(res.status, 409, state);
            assert.deepEqual(res.body, { error: 'invalid_state', currentState: state });
            assert.equal((await participantsOf(exam)).length, 1);
            assert.equal((await additionsOf(exam)).length, 0);
        }
        // A cancelled exam neither.
        const { exam: cancelled } = await plannedExam();
        const cancel = await teacherClient.request('/api/v1/assessment/teacher-exams/cancel', {
            method: 'POST', body: { examInstanceId: cancelled, reason: 'Diganti', actionKey: randomUUID() },
        });
        assert.equal(cancel.status, 200);
        const res = await add(teacherClient, { examInstanceId: cancelled, enrollmentIds: [sB.enrollmentId], actionKey: randomUUID() });
        assert.deepEqual({ status: res.status, body: res.body }, { status: 409, body: { error: 'invalid_state', currentState: 'ARCHIVED' } });
    });

    await t.test('only the managing teacher adds', async () => {
        const { exam } = await plannedExam();
        await addProctorAssignment(pool, tenant, exam, proctor.personId);
        const body = { examInstanceId: exam, enrollmentIds: [sB.enrollmentId] };
        for (const [who, client] of [
            ['another teacher', await loggedIn(otherTeacher)],
            ['a student', await loggedIn(sB)],
            ['an assigned proctor', await loggedIn(proctor)],
        ] as const) {
            assert.equal((await candidates(client, exam)).status, 403, who);
            assert.equal((await add(client, { ...body, actionKey: randomUUID() })).status, 403, who);
        }
        assert.equal((await candidates(teacherClient, randomUUID())).status, 403, 'an unknown exam');
        assert.equal((await add(teacherClient, { ...body, examInstanceId: randomUUID(), actionKey: randomUUID() })).status, 403, 'an unknown exam');
        const otherSchool = await createTenant(pool);
        const outsider = await createPersonWithAccount(pool);
        await createTeachingContext(pool, otherSchool, await addMembership(pool, otherSchool, outsider.personId));
        const outsiderClient = await loggedIn(outsider, otherSchool);
        assert.equal((await candidates(outsiderClient, exam)).status, 403, 'another school');
        assert.equal((await add(outsiderClient, { ...body, actionKey: randomUUID() })).status, 403, 'another school');
        assert.equal((await participantsOf(exam)).length, 1, 'refused requests add no one');
    });

    await t.test('the added student starts the exam once it opens', async () => {
        const { exam } = await plannedExam('SCHEDULED', { startsAt: new Date(Date.now() - 10 * 60_000) });
        assert.equal((await add(teacherClient, { examInstanceId: exam, enrollmentIds: [sB.enrollmentId], actionKey: randomUUID() })).status, 200);
        assert.equal((await transition(exam, 'mark_ready')).status, 200);
        assert.equal((await transition(exam, 'activate')).status, 200);
        const start = await (await loggedIn(sB)).request('/api/v1/assessment/attempts/start', { method: 'POST', body: { examInstanceId: exam } });
        assert.equal(start.status, 201, JSON.stringify(start.body));
    });

    await t.test('a revoked teaching assignment adds nothing', async () => {
        const { exam } = await plannedExam();
        await pool.query('UPDATE academic_core_teaching_assignments SET revoked_at = now() WHERE id = $1', [teaching.teachingAssignmentId]);
        assert.equal((await candidates(teacherClient, exam)).status, 403);
        assert.equal((await add(teacherClient, { examInstanceId: exam, enrollmentIds: [sB.enrollmentId], actionKey: randomUUID() })).status, 403);
        assert.equal((await participantsOf(exam)).length, 1);
    });
});
