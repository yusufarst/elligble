import type pg from 'pg';
import { test } from 'node:test';
import * as assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import { createDisposableDatabase, skipWithoutDatabase } from '../support/pg-harness.ts';
import { addMembership, addParticipant, addProctorAssignment, addQuestionSnapshots, createAttemptWithTimer,
    createExamInstance, createPersonWithAccount, createTeachingContext, createTenant } from '../support/fixtures.ts';
import { BrowserLikeClient, startProductionWiredServer } from '../support/test-server.ts';
import { performParticipantLockAction } from '../../src/participant-lock.ts';
import { rescheduleTeacherExam } from '../../src/teacher-exam-schedule.ts';
import { cancelTeacherExam } from '../../src/teacher-exam-cancel.ts';

const BASE = '/api/v1/assessment/';
const intent = () => ({ reason: 'Gangguan ruang ujian', confirmed: true, actionKey: randomUUID() });

test('SEC-001 migration upgrades populated 0053 and is repeat-safe without rewriting native history', { skip: skipWithoutDatabase }, async t => {
    const db = await createDisposableDatabase({ migrate: false });
    t.after(() => db.close());
    const client = await db.pool.connect();
    try {
        const directory = new URL('../../../../database/migrations/', import.meta.url);
        const files = (await readdir(directory)).filter(name => /^\d{4}_.*\.sql$/.test(name)).sort();
        for (const name of files.filter(name => name < '0054')) await client.query(await readFile(new URL(name, directory), 'utf8'));
    } finally { client.release(); }
    const tenant = await createTenant(db.pool);
    const person = await createPersonWithAccount(db.pool);
    const teaching = await createTeachingContext(db.pool, tenant, await addMembership(db.pool, tenant, person.personId));
    const exam = await createExamInstance(db.pool, tenant, teaching, { lifecycleState: 'SCHEDULED' });
    const action = { examInstanceId: exam, reason: 'Riwayat asli', actionKey: randomUUID() };
    assert.equal((await cancelTeacherExam(db.pool, { tenantId: tenant, personId: person.personId }, action)).type, 'cancelled');
    const before = (await db.pool.query('SELECT * FROM secure_assessment_exam_cancellations')).rows;
    const sql = await readFile(new URL('../../../../database/migrations/0054_secure_assessment_permission_action_audit.sql', import.meta.url), 'utf8');
    const migrator = await db.pool.connect();
    try { await migrator.query(sql); await migrator.query(sql); }
    finally { migrator.release(); }
    assert.deepEqual((await db.pool.query('SELECT * FROM secure_assessment_exam_cancellations')).rows, before);
    assert.equal((await db.pool.query('SELECT * FROM secure_assessment_permission_action_events')).rows.length, 0);
    assert.equal((await db.pool.query("SELECT * FROM elligble_migration_history WHERE migration_id = '0054_secure_assessment_permission_action_audit'")).rows.length, 1);
});

test('SEC-001 permission, audit, replay and export boundaries on the real production stack', { skip: skipWithoutDatabase }, async t => {
    const db = await createDisposableDatabase();
    const { pool } = db;
    let beforeQuery: ((sql: string) => Promise<void>) | null = null;
    const guardedPool = new Proxy(pool, { get(target, property) {
        if (property === 'connect') return async () => {
            const client = await target.connect();
            return new Proxy(client, { get(connection, key) {
                if (key === 'query') return async (...args: unknown[]) => {
                    if (typeof args[0] === 'string' && beforeQuery) await beforeQuery(args[0]);
                    return Reflect.apply(connection.query, connection, args);
                };
                const value: unknown = Reflect.get(connection, key);
                return typeof value === 'function' ? value.bind(connection) : value;
            } });
        };
        const value: unknown = Reflect.get(target, property);
        return typeof value === 'function' ? value.bind(target) : value;
    } }) as pg.Pool;
    const app = await startProductionWiredServer(guardedPool);
    t.after(async () => { await app.close(); await db.close(); });
    const tenant = await createTenant(pool);
    const teacher = await createPersonWithAccount(pool);
    const teacherMembership = await addMembership(pool, tenant, teacher.personId);
    const teaching = await createTeachingContext(pool, tenant, teacherMembership);
    const outsider = await createPersonWithAccount(pool);
    await addMembership(pool, tenant, outsider.personId);
    const otherTeaching = await createTeachingContext(pool, tenant, await addMembership(pool, tenant, (await createPersonWithAccount(pool)).personId));
    const proctor = await createPersonWithAccount(pool);
    await addMembership(pool, tenant, proctor.personId);
    const login = async (person: typeof teacher) => {
        const client = new BrowserLikeClient(app.baseUrl);
        assert.equal((await client.login(person.username, person.password)).status, 200);
        client.tenantId = tenant;
        return client;
    };
    const staff = await login(teacher);
    const nonStaff = await login(outsider);
    const proctorClient = await login(proctor);
    const post = (client: BrowserLikeClient, route: string, body: object) => client.request(BASE + route, { method: 'POST', body });
    const fresh = async () => {
        const exam = await createExamInstance(pool, tenant, teaching);
        const participant = await addParticipant(pool, tenant, exam, outsider.personId);
        const attempt = await createAttemptWithTimer(pool, tenant, participant);
        await addQuestionSnapshots(pool, tenant, exam, 2);
        return { exam, participant, attempt };
    };
    const count = async (table: string) => Number((await pool.query(`SELECT count(*) AS n FROM ${table}`)).rows[0].n);
    const evidence = async () => Promise.all([
        'secure_assessment_permission_action_events', 'secure_assessment_attempt_locks',
        'secure_assessment_exam_lifecycle_events', 'secure_assessment_timer_adjustments',
        'secure_assessment_exam_cancellations', 'secure_assessment_exam_schedule_changes',
        'secure_assessment_exam_participant_additions', 'secure_assessment_question_import_batches',
    ].map(count));
    const lock = (f: Awaited<ReturnType<typeof fresh>>, action = 'lock') => ({ examInstanceId: f.exam, participantId: f.participant, action, ...intent() });

    await t.test('N01–N04 unauthenticated, foreign tenant/object, unassigned roles and injected authority have zero business effects', async () => {
        const f = await fresh();
        const foreign = await createExamInstance(pool, tenant, otherTeaching);
        const before = await evidence();
        const anonymous = new BrowserLikeClient(app.baseUrl);
        assert.equal((await post(anonymous, 'exam-monitoring/participant-lock', lock(f))).status, 401);
        for (const route of ['exam-monitoring/participant-lock', 'exam-monitoring/add-time', 'teacher-exams/transition',
            'teacher-exams/reschedule', 'teacher-exams/cancel', 'teacher-exams/participants/add', 'teacher-exams/results']) {
            const body = { ...lock(f), minutes: 3, format: 'csv', enrollmentIds: [randomUUID()],
                windowStartsAt: '2027-01-01T08:00', windowEndsAt: '2027-01-01T10:00', durationMinutes: 30,
                latestStartPolicy: 'REMAINING_WINDOW_ONLY', ...(route.endsWith('/transition') ? { action: 'pause' } : {}) };
            const denied = await post(nonStaff, route, body);
            assert.equal(denied.status, 403, route + JSON.stringify(denied.body));
            assert.deepEqual(denied.body, { error: 'forbidden' });
        }
        assert.equal((await post(staff, 'exam-monitoring/participant-lock', { ...lock(f), examInstanceId: foreign })).status, 403);
        assert.equal((await post(staff, 'exam-monitoring/participant-lock', { ...lock(f), participantId: randomUUID() })).status, 403);
        staff.tenantId = await createTenant(pool);
        assert.equal((await post(staff, 'exam-monitoring/participant-lock', lock(f))).status, 403);
        staff.tenantId = tenant;
        for (const field of ['actorPersonId','tenantId','attemptId','timestamp','audit','sessionSecret']) {
            assert.equal((await post(staff, 'exam-monitoring/participant-lock', { ...lock(f), [field]: randomUUID() })).status, 400);
        }
        assert.deepEqual(await evidence(), before);
    });

    await t.test('N08 missing confirmation/reason/key and normalized Unicode boundaries', async () => {
        const f = await fresh();
        const before = await evidence();
        for (const override of [{ confirmed: false }, { confirmed: undefined }, { actionKey: 'bad' },
            { reason: ' \n\t ' }, { reason: '界'.repeat(201) }]) {
            assert.equal((await post(staff, 'exam-monitoring/participant-lock', { ...lock(f), ...override })).status, 400);
        }
        assert.deepEqual(await evidence(), before);
        const ok = await post(staff, 'exam-monitoring/participant-lock', { ...lock(f), reason: '  Ruang\t A\n  ' });
        assert.equal(ok.status, 200, JSON.stringify(ok.body));
        const row = (await pool.query('SELECT * FROM secure_assessment_permission_action_events WHERE id = $1', [ok.body.audit.id])).rows[0];
        assert.equal(row.reason, 'Ruang A');
        assert.equal(row.actor_person_id, teacher.personId);
        assert.equal(row.authority_kind, 'TEACHER');
        assert.equal(row.attempt_id, f.attempt);
        assert.deepEqual(Object.keys(ok.body.audit).sort(), ['id','outcome','replayed']);
        for (const reason of ['界', '界'.repeat(200)]) {
            const accepted = await post(staff, 'exam-monitoring/participant-lock', { ...lock(f), reason });
            assert.equal(accepted.status, 200);
            assert.equal((await pool.query('SELECT reason FROM secure_assessment_permission_action_events WHERE id = $1', [accepted.body.audit.id])).rows[0].reason, reason);
        }
    });

    await t.test('C06/C07 exactly-once concurrent keys, native no-op and inverse-safe replay', async () => {
        const f = await fresh();
        const body = lock(f);
        const responses = await Promise.all([post(staff, 'exam-monitoring/participant-lock', body), post(staff, 'exam-monitoring/participant-lock', body)]);
        assert.deepEqual(responses.map(r => r.status), [200,200]);
        assert.equal(responses[0].body.audit.id, responses[1].body.audit.id);
        assert.deepEqual(responses.map(r => r.body.audit.replayed).sort(), [false,true]);
        assert.equal(Number((await pool.query('SELECT count(*) AS n FROM secure_assessment_attempt_locks WHERE exam_attempt_id = $1', [f.attempt])).rows[0].n), 1);
        const noOp = await post(staff, 'exam-monitoring/participant-lock', lock(f));
        assert.equal(noOp.body.changed, false);
        assert.equal(noOp.body.audit.outcome, 'NO_OP');
        await addProctorAssignment(pool, tenant, f.exam, proctor.personId);
        assert.equal((await post(proctorClient, 'exam-monitoring/participant-lock', body)).body.error, 'action_key_reused');
        assert.equal((await post(staff, 'exam-monitoring/participant-lock', lock(f, 'unlock'))).status, 200);
        const replay = await post(staff, 'exam-monitoring/participant-lock', body);
        assert.equal(replay.status, 200);
        assert.equal(replay.body.changed, false);
        assert.equal(replay.body.audit.replayed, true);
        assert.equal(Number((await pool.query('SELECT count(*) AS n FROM secure_assessment_attempt_locks WHERE exam_attempt_id = $1 AND unlocked_at IS NULL', [f.attempt])).rows[0].n), 0);
        for (const changed of [{ reason: 'Alasan berbeda' }, { action: 'unlock' }]) {
            assert.equal((await post(staff, 'exam-monitoring/participant-lock', { ...body, ...changed })).body.error, 'action_key_reused');
        }
    });

    await t.test('C05 companion failure rolls back native effects; append-only and composite references are enforced', async () => {
        const f = await fresh();
        const before = await evidence();
        await pool.query(`CREATE FUNCTION sec001_fail_audit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'synthetic audit failure'; END $$`);
        await pool.query('CREATE TRIGGER sec001_fail_audit BEFORE INSERT ON secure_assessment_permission_action_events FOR EACH ROW EXECUTE FUNCTION sec001_fail_audit()');
        try {
            const failed = await post(staff, 'exam-monitoring/participant-lock', lock(f));
            assert.equal(failed.status, 503);
            assert.deepEqual(failed.body, { error: 'persistence_unavailable' });
            assert.deepEqual(await evidence(), before);
        } finally {
            await pool.query('DROP TRIGGER sec001_fail_audit ON secure_assessment_permission_action_events');
            await pool.query('DROP FUNCTION sec001_fail_audit()');
        }
        const ok = await post(staff, 'exam-monitoring/participant-lock', lock(f));
        assert.equal(ok.status, 200);
        await assert.rejects(pool.query('UPDATE secure_assessment_permission_action_events SET reason = $1 WHERE id = $2', ['forged',ok.body.audit.id]), /append-only/);
        await assert.rejects(pool.query('DELETE FROM secure_assessment_permission_action_events WHERE id = $1', [ok.body.audit.id]), /append-only/);
        const other = await fresh();
        await assert.rejects(pool.query(`INSERT INTO secure_assessment_permission_action_events
            (tenant_id,exam_instance_id,participant_id,attempt_id,actor_person_id,authority_kind,action_kind,action,action_key,request_digest,reason,confirmed,outcome)
            VALUES ($1,$2,$3,$4,$5,'TEACHER','PARTICIPANT_CONTROL','lock',$6,$7,'test',TRUE,'APPLIED')`,
        [tenant,f.exam,other.participant,f.attempt,teacher.personId,randomUUID(),'0'.repeat(64)]), /foreign key/);
    });

    await t.test('N03/N07 a stored receipt does not retain revoked authority; Proctor cannot use Teacher operations', async () => {
        const f = await fresh();
        const assignment = await addProctorAssignment(pool, tenant, f.exam, proctor.personId);
        const body = lock(f);
        const result = await post(proctorClient, 'exam-monitoring/participant-lock', body);
        assert.equal(result.status, 200);
        assert.equal((await pool.query('SELECT authority_kind FROM secure_assessment_permission_action_events WHERE id = $1', [result.body.audit.id])).rows[0].authority_kind, 'PROCTOR');
        const before = await evidence();
        assert.equal((await post(proctorClient, 'teacher-exams/results', { examInstanceId: f.exam, format: 'csv', actionKey: randomUUID() })).status, 403);
        assert.equal((await post(proctorClient, 'exam-monitoring/add-time', { ...lock(f), minutes: 3 })).status, 403);
        await pool.query('UPDATE secure_assessment_proctor_assignments SET revoked_at = statement_timestamp() WHERE id = $1', [assignment]);
        assert.equal((await post(proctorClient, 'exam-monitoring/participant-lock', body)).status, 403);
        assert.deepEqual(await evidence(), before);
    });

    await t.test('N07 revocation winning authority acquisition denies; acquired authority fences a conflicting revoke', async () => {
        const f = await fresh();
        const revocable = await createPersonWithAccount(pool);
        await addMembership(pool, tenant, revocable.personId);
        const client = await login(revocable);
        const assignment = await addProctorAssignment(pool, tenant, f.exam, revocable.personId);
        let reached!: () => void;
        let proceed!: () => void;
        const barrier = new Promise<void>(resolve => { reached = resolve; });
        const release = new Promise<void>(resolve => { proceed = resolve; });
        beforeQuery = async sql => {
            if (sql.includes('FROM secure_assessment_proctor_assignments') && sql.includes('FOR SHARE')) {
                beforeQuery = null; reached(); await release;
            }
        };
        const before = await evidence();
        const pending = post(client, 'exam-monitoring/participant-lock', lock(f));
        try {
            await Promise.race([barrier, pending.then(() => { throw new Error('Authority barrier was not reached'); })]);
            await pool.query('UPDATE secure_assessment_proctor_assignments SET revoked_at = statement_timestamp() WHERE id = $1', [assignment]);
        } finally { beforeQuery = null; proceed(); }
        assert.equal((await pending).status, 403);
        assert.deepEqual(await evidence(), before);

        const f2 = await fresh();
        const assignment2 = await addProctorAssignment(pool, tenant, f2.exam, revocable.personId);
        let acquired!: () => void;
        let finish!: () => void;
        const acquiredPromise = new Promise<void>(resolve => { acquired = resolve; });
        const finishPromise = new Promise<void>(resolve => { finish = resolve; });
        beforeQuery = async sql => {
            if (sql.includes('INSERT INTO secure_assessment_attempt_locks')) {
                beforeQuery = null; acquired(); await finishPromise;
            }
        };
        const action = post(client, 'exam-monitoring/participant-lock', lock(f2));
        const revoker = await pool.connect();
        try {
            await Promise.race([acquiredPromise, action.then(() => { throw new Error('Effect barrier was not reached'); })]);
            await revoker.query('BEGIN');
            await revoker.query("SET LOCAL lock_timeout = '100ms'");
            await assert.rejects(revoker.query('UPDATE secure_assessment_proctor_assignments SET revoked_at = statement_timestamp() WHERE id = $1', [assignment2]), { code: '55P03' });
            await revoker.query('ROLLBACK');
        } finally { beforeQuery = null; finish(); revoker.release(); }
        assert.equal((await action).status, 200);
        await pool.query('UPDATE secure_assessment_proctor_assignments SET revoked_at = statement_timestamp() WHERE id = $1', [assignment2]);
        assert.equal((await post(client, 'exam-monitoring/participant-lock', lock(f2, 'unlock'))).status, 403);
    });

    await t.test('N07 current room reassignment winning before mapping acquisition refuses the old Proctor', async () => {
        const exam = await createExamInstance(pool, tenant, teaching, { roomBasedOperations: true, proctorPerRoomRequired: true });
        const participant = await addParticipant(pool, tenant, exam, outsider.personId);
        const attempt = await createAttemptWithTimer(pool, tenant, participant);
        const room = async (name: string) => (await pool.query('INSERT INTO secure_assessment_exam_rooms (tenant_id,exam_instance_id,display_label) VALUES ($1,$2,$3) RETURNING id', [tenant,exam,name])).rows[0].id as string;
        const roomA = await room('A'); const roomB = await room('B');
        const assignment = await addProctorAssignment(pool, tenant, exam, proctor.personId);
        await pool.query('INSERT INTO secure_assessment_exam_proctor_room_assignments (tenant_id,exam_instance_id,proctor_assignment_id,exam_room_id) VALUES ($1,$2,$3,$4)', [tenant,exam,assignment,roomA]);
        await pool.query('INSERT INTO secure_assessment_exam_participant_room_assignments (tenant_id,exam_instance_id,exam_participant_id,exam_room_id) VALUES ($1,$2,$3,$4)', [tenant,exam,participant,roomA]);
        beforeQuery = async sql => {
            if (sql.includes('SELECT id FROM secure_assessment_exam_proctor_room_assignments') && sql.includes('FOR SHARE')) {
                beforeQuery = null;
                await pool.query('UPDATE secure_assessment_exam_participant_room_assignments SET exam_room_id = $1 WHERE exam_participant_id = $2', [roomB,participant]);
            }
        };
        const before = await evidence();
        try { assert.equal((await post(proctorClient, 'exam-monitoring/participant-lock', lock({ exam,participant,attempt }))).status, 403); }
        finally { beforeQuery = null; }
        assert.deepEqual(await evidence(), before);
    });

    await t.test('C09 legacy native cancellation replays without fictitious audit; changed reason conflicts', async () => {
        const exam = await createExamInstance(pool, tenant, teaching, { lifecycleState: 'SCHEDULED' });
        const body = { examInstanceId: exam, ...intent() };
        const native = await cancelTeacherExam(pool, { tenantId: tenant, personId: teacher.personId }, body);
        assert.equal(native.type, 'cancelled');
        const before = await count('secure_assessment_permission_action_events');
        const retry = await post(staff, 'teacher-exams/cancel', body);
        assert.equal(retry.status, 200);
        assert.equal(retry.body.replayed, true);
        assert.equal(retry.body.audit, undefined);
        assert.equal((await post(staff, 'teacher-exams/cancel', { ...body, reason: 'different' })).status, 409);
        assert.equal(await count('secure_assessment_permission_action_events'), before);
        const f = await fresh();
        assert.equal((await performParticipantLockAction(pool, { tenantId: tenant, personId: teacher.personId }, f.exam, f.participant, 'lock')).type, 'ok');
        assert.equal((await post(staff, 'exam-monitoring/participant-lock', lock(f))).body.audit.outcome, 'NO_OP');
    });

    await t.test('C09 a legacy schedule key is refused without backfill or reapplication', async () => {
        const local = (hours: number) => new Date(Date.now() + (hours + 7) * 3_600_000).toISOString().slice(0,16);
        const exam = await createExamInstance(pool, tenant, teaching, { lifecycleState: 'SCHEDULED',
            windowStartsAt: new Date(Date.now() + 24 * 3_600_000), windowEndsAt: new Date(Date.now() + 26 * 3_600_000) });
        await addQuestionSnapshots(pool, tenant, exam, 2);
        await addParticipant(pool, tenant, exam, outsider.personId);
        const body = { examInstanceId: exam, windowStartsAt: local(28), windowEndsAt: local(30), durationMinutes: 60,
            latestStartPolicy: 'REMAINING_WINDOW_ONLY' as const, ...intent() };
        assert.equal((await rescheduleTeacherExam(pool, { tenantId: tenant, personId: teacher.personId }, body)).type, 'rescheduled');
        const before = await evidence();
        const response = await post(staff, 'teacher-exams/reschedule', body);
        assert.equal(response.status, 409);
        assert.deepEqual(response.body, { error: 'action_key_reused' });
        assert.deepEqual(await evidence(), before);
    });

    await t.test('C10/N05/N10 export intent returns only the entitled projection and refuses changed data on replay', async () => {
        const f = await fresh();
        const get = await staff.request(BASE + 'teacher-exams/results?examInstanceId=' + f.exam);
        assert.equal(get.status, 200);
        const body = { examInstanceId: f.exam, format: 'csv', actionKey: randomUUID() };
        const first = await post(staff, 'teacher-exams/results', body);
        assert.equal(first.status, 200, JSON.stringify(first.body));
        const { audit, format, issuedAt, ...projection } = first.body;
        assert.deepEqual(projection, get.body);
        assert.equal(format, 'csv');
        assert.equal(audit.outcome, 'ISSUED');
        assert.ok(Number.isFinite(Date.parse(issuedAt)));
        const retry = await post(staff, 'teacher-exams/results', body);
        assert.deepEqual(retry.body, { ...first.body, audit: { ...audit, replayed: true } });
        assert.equal((await post(staff, 'teacher-exams/results', { ...body, format: 'print' })).body.error, 'action_key_reused');
        await addParticipant(pool, tenant, f.exam, (await createPersonWithAccount(pool)).personId);
        const changed = await post(staff, 'teacher-exams/results', body);
        assert.equal(changed.status, 409);
        assert.deepEqual(changed.body, { error: 'export_data_changed', audit: { ...audit, replayed: true } });
        const stored = (await pool.query('SELECT * FROM secure_assessment_permission_action_events WHERE id = $1', [audit.id])).rows[0];
        assert.match(stored.result_digest, /^[0-9a-f]{64}$/);
        assert.equal(stored.reason, null);
        assert.ok(!('results' in stored));
        assert.equal((await staff.request(BASE + 'teacher-exams/results?examInstanceId=' + f.exam)).body.audit, undefined);
    });
    await t.test('N01/N07 session and Teacher revocation winning the owning guard deny without native effects', async () => {
        for (const kind of ['session', 'teacher'] as const) {
            const person = await createPersonWithAccount(pool);
            const context = await createTeachingContext(pool, tenant, await addMembership(pool, tenant, person.personId));
            const exam = await createExamInstance(pool, tenant, context);
            const participant = await addParticipant(pool, tenant, exam, outsider.personId);
            const attempt = await createAttemptWithTimer(pool, tenant, participant);
            const client = await login(person);
            const before = await evidence();
            beforeQuery = async sql => {
                const match = kind === 'session' ? sql.includes('FOR UPDATE OF s FOR SHARE OF a') : sql.includes('FOR SHARE OF ata, tta, tm');
                if (!match) return;
                beforeQuery = null;
                if (kind === 'session') await pool.query('UPDATE identity_sessions SET is_revoked = TRUE WHERE user_account_id = $1', [person.accountId]);
                else await pool.query('UPDATE academic_core_teaching_assignments SET revoked_at = statement_timestamp() WHERE id = $1', [context.teachingAssignmentId]);
            };
            try {
                const response = await post(client, 'exam-monitoring/participant-lock', lock({ exam, participant, attempt }));
                assert.equal(response.status, kind === 'session' ? 401 : 403, JSON.stringify(response.body));
                assert.deepEqual(await evidence(), before);
            } finally { beforeQuery = null; }
        }
    });

});
