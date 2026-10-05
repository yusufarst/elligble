import { test } from 'node:test';
import * as assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createDisposableDatabase, skipWithoutDatabase } from '../support/pg-harness.ts';
import {
    addMembership, addParticipant, addQuestionSnapshots, createExamInstance,
    createPersonWithAccount, createTeachingContext, createTenant,
} from '../support/fixtures.ts';
import { BrowserLikeClient, startProductionWiredServer } from '../support/test-server.ts';

// One active exam session per attempt (D04.4-32/35/36/37, D04.5-22) through HTTP with real
// PostgreSQL: the active session id is never disclosed, moving the exam needs an explicit
// fingerprint-confirmed takeover, and the replaced device loses write authority.

test('exam session takeover between two devices (real PostgreSQL, production wiring)', { skip: skipWithoutDatabase }, async (t) => {
    const db = await createDisposableDatabase();
    const app = await startProductionWiredServer(db.pool);
    t.after(async () => {
        await app.close();
        await db.close();
    });
    const pool = db.pool;
    const tenant = await createTenant(pool, 'SMA Negeri 1 Contoh');
    const teacher = await createPersonWithAccount(pool, 'guru.sesi');
    const teaching = await createTeachingContext(pool, tenant, await addMembership(pool, tenant, teacher.personId));
    const student = await createPersonWithAccount(pool, 'siswa.sesi');
    await addMembership(pool, tenant, student.personId);
    const exam = await createExamInstance(pool, tenant, teaching);
    const snapshots = await addQuestionSnapshots(pool, tenant, exam, 2);
    await addParticipant(pool, tenant, exam, student.personId);

    async function device() {
        const client = new BrowserLikeClient(app.baseUrl);
        assert.equal((await client.login(student.username, student.password)).status, 200);
        client.tenantId = tenant;
        return client;
    }
    const deviceA = await device();
    const deviceB = await device();

    const attemptId = (await deviceA.request('/api/v1/assessment/attempts/start', { method: 'POST', body: { examInstanceId: exam } })).body.attemptId;
    const sessionA = randomUUID();
    assert.equal((await deviceA.request('/api/v1/assessment/session/activate', { method: 'POST', body: { attemptId, sessionId: sessionA } })).status, 200);
    assert.equal((await deviceA.request('/api/v1/assessment/timer/start', { method: 'POST', body: { attemptId } })).status, 200);

    const save = (client: BrowserLikeClient, sessionId: string, snapshotId: string, option: string, expectedWriteVersion: number | null) =>
        client.request('/api/v1/assessment/answer/save', {
            method: 'POST',
            body: { attemptId, sessionId, snapshotId, answerPayload: { selectedOptionId: option }, clientWriteIdentity: randomUUID(), expectedWriteVersion },
        });
    assert.equal((await save(deviceA, sessionA, snapshots[0], 'A', null)).status, 200);

    await t.test('resume never discloses the active session id', async () => {
        const own = await deviceA.request(`/api/v1/assessment/resume?attemptId=${attemptId}&examSessionId=${sessionA}`);
        assert.equal(own.status, 200);
        assert.equal(own.body.session.ownedByCaller, true);
        const other = await deviceB.request(`/api/v1/assessment/resume?attemptId=${attemptId}`);
        assert.equal(other.body.session.status, 'active');
        assert.equal(other.body.session.ownedByCaller, false);
        assert.equal(JSON.stringify(other.body).includes(sessionA), false);
        assert.equal(JSON.stringify(own.body).includes(sessionA), false);
        const malformed = await deviceB.request(`/api/v1/assessment/resume?attemptId=${attemptId}&examSessionId=nope`);
        assert.equal(malformed.status, 400);
    });

    const sessionB = randomUUID();
    let fingerprint = '';

    await t.test('a second device is refused without confirmation and learns only a fingerprint', async () => {
        const refused = await deviceB.request('/api/v1/assessment/session/activate', { method: 'POST', body: { attemptId, sessionId: sessionB } });
        assert.equal(refused.status, 409);
        assert.equal(refused.body.error, 'active_session_exists');
        assert.match(refused.body.activeSessionFingerprint, /^[0-9a-f]{16}$/);
        assert.equal(JSON.stringify(refused.body).includes(sessionA), false);
        fingerprint = refused.body.activeSessionFingerprint;

        // Knowing the fingerprint does not let device B write with device A's session.
        assert.equal((await save(deviceB, sessionB, snapshots[1], 'B', null)).status, 409);
    });

    await t.test('a stale or wrong fingerprint does not take over', async () => {
        const wrong = await deviceB.request('/api/v1/assessment/session/activate', {
            method: 'POST',
            body: { attemptId, sessionId: sessionB, confirmSupersede: true, expectedActiveSessionFingerprint: '0000000000000000' },
        });
        assert.equal(wrong.status, 409);
        assert.equal(wrong.body.error, 'active_session_changed');
        const missing = await deviceB.request('/api/v1/assessment/session/activate', {
            method: 'POST',
            body: { attemptId, sessionId: sessionB, confirmSupersede: true },
        });
        assert.equal(missing.status, 400);
    });

    await t.test('confirmed takeover moves write authority to the new device', async () => {
        const taken = await deviceB.request('/api/v1/assessment/session/activate', {
            method: 'POST',
            body: { attemptId, sessionId: sessionB, confirmSupersede: true, expectedActiveSessionFingerprint: fingerprint },
        });
        assert.equal(taken.status, 200);
        assert.equal(taken.body.sessionId, sessionB);

        const lost = await save(deviceA, sessionA, snapshots[0], 'C', 1);
        assert.equal(lost.status, 409);
        assert.equal(lost.body.error, 'session_not_active');
        const reactivateOld = await deviceA.request('/api/v1/assessment/session/activate', { method: 'POST', body: { attemptId, sessionId: sessionA } });
        assert.equal(reactivateOld.status, 409, 'a replaced session never regains write authority');

        const resumeA = await deviceA.request(`/api/v1/assessment/resume?attemptId=${attemptId}&examSessionId=${sessionA}`);
        assert.equal(resumeA.body.session.ownedByCaller, false);
        const resumeB = await deviceB.request(`/api/v1/assessment/resume?attemptId=${attemptId}&examSessionId=${sessionB}`);
        assert.equal(resumeB.body.session.ownedByCaller, true);
        // The answer saved on device A is preserved and continues on device B.
        assert.deepEqual(resumeB.body.answers.map((a: any) => [a.snapshotId, a.answerPayload.selectedOptionId, a.writeVersion]), [[snapshots[0], 'A', 1]]);
        assert.equal((await save(deviceB, sessionB, snapshots[0], 'D', 1)).body.writeVersion, 2);
    });

    await t.test('another student cannot use the fingerprint flow on this attempt', async () => {
        const other = await createPersonWithAccount(pool);
        await addMembership(pool, tenant, other.personId);
        const intruder = new BrowserLikeClient(app.baseUrl);
        assert.equal((await intruder.login(other.username, other.password)).status, 200);
        intruder.tenantId = tenant;
        const attempt = await intruder.request('/api/v1/assessment/session/activate', {
            method: 'POST',
            body: { attemptId, sessionId: randomUUID(), confirmSupersede: true, expectedActiveSessionFingerprint: fingerprint },
        });
        assert.equal(attempt.status, 403);
        const peek = await intruder.request(`/api/v1/assessment/resume?attemptId=${attemptId}`);
        assert.equal(peek.status, 403);
    });
});
