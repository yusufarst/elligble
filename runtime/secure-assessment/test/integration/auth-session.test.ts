import { test } from 'node:test';
import * as assert from 'node:assert/strict';
import { createDisposableDatabase, skipWithoutDatabase } from '../support/pg-harness.ts';
import {
    addMembership, addParticipant, addProctorAssignment, createAttemptWithTimer,
    createExamInstance, createPersonWithAccount, createTeachingContext, createTenant,
} from '../support/fixtures.ts';
import { BrowserLikeClient, startProductionWiredServer } from '../support/test-server.ts';

test('authentication, browser session and attempt authorization (real PostgreSQL, production wiring)', { skip: skipWithoutDatabase }, async (t) => {
    const db = await createDisposableDatabase();
    const app = await startProductionWiredServer(db.pool);
    t.after(async () => {
        await app.close();
        await db.close();
    });
    const pool = db.pool;

    const tenantA = await createTenant(pool, 'SMA Negeri 1 Contoh');
    const tenantB = await createTenant(pool, 'SMA Negeri 2 Contoh');
    const student1 = await createPersonWithAccount(pool, 'siswa.satu');
    const student2 = await createPersonWithAccount(pool, 'siswa.dua');
    const teacher = await createPersonWithAccount(pool, 'guru.satu');
    const proctor = await createPersonWithAccount(pool, 'pengawas.satu');
    const outsider = await createPersonWithAccount(pool, 'siswa.lain');
    await addMembership(pool, tenantA, student1.personId);
    await addMembership(pool, tenantA, student2.personId);
    const teacherMembership = await addMembership(pool, tenantA, teacher.personId);
    await addMembership(pool, tenantA, proctor.personId);
    await addMembership(pool, tenantB, outsider.personId);

    const teaching = await createTeachingContext(pool, tenantA, teacherMembership);
    const exam = await createExamInstance(pool, tenantA, teaching);
    const attempt1 = await createAttemptWithTimer(pool, tenantA, await addParticipant(pool, tenantA, exam, student1.personId));
    const attempt2 = await createAttemptWithTimer(pool, tenantA, await addParticipant(pool, tenantA, exam, student2.personId));
    await addProctorAssignment(pool, tenantA, exam, proctor.personId);

    await t.test('wrong password and unknown account are indistinguishable 401s without a cookie', async () => {
        const c = new BrowserLikeClient(app.baseUrl);
        const wrong = await c.login(student1.username, 'salah-sandi-123');
        const unknown = await c.login('tidak.ada', 'salah-sandi-123');
        assert.equal(wrong.status, 401);
        assert.equal(unknown.status, 401);
        assert.deepEqual(wrong.body, { error: 'invalid_credentials' });
        assert.deepEqual(unknown.body, wrong.body);
        assert.equal(wrong.headers.get('set-cookie'), null);
        assert.equal(c.cookie, null);
    });

    await t.test('successful login sets an HttpOnly SameSite=Strict session cookie and lists memberships', async () => {
        const c = new BrowserLikeClient(app.baseUrl);
        const res = await c.login(student1.username, student1.password);
        assert.equal(res.status, 200);
        assert.equal(res.body.status, 'authenticated');
        assert.equal(res.body.username, student1.username);
        assert.deepEqual(res.body.memberships, [{ tenantId: tenantA, displayLabel: 'SMA Negeri 1 Contoh' }]);
        const setCookie = res.headers.get('set-cookie') ?? '';
        assert.match(setCookie, /^elligble_session=[0-9a-f-]{36}\.[A-Za-z0-9_-]+;/);
        assert.match(setCookie, /HttpOnly/);
        assert.match(setCookie, /SameSite=Strict/);
        assert.match(setCookie, /Path=\//);
        const maxAge = Number(/Max-Age=(\d+)/.exec(setCookie)?.[1]);
        assert.ok(maxAge > 12 * 3600 - 60 && maxAge <= 12 * 3600, `Max-Age ${maxAge}`);
        assert.equal(JSON.stringify(res.body).includes(c.cookie!.split('=')[1]), false, 'secret never in body');
        assert.equal(res.headers.get('cache-control'), 'no-store');
    });

    await t.test('session introspection follows the cookie; logout revokes it server-side', async () => {
        const c = new BrowserLikeClient(app.baseUrl);
        await c.login(student1.username, student1.password);
        const stolenCookie = c.cookie;
        const session = await c.request('/api/v1/auth/session');
        assert.equal(session.status, 200);
        assert.equal(session.body.username, student1.username);
        assert.equal(session.body.memberships.length, 1);

        const logout = await c.request('/api/v1/auth/logout', { method: 'POST' });
        assert.equal(logout.status, 204);
        assert.match(logout.headers.get('set-cookie') ?? '', /Max-Age=0/);
        assert.equal(c.cookie, null);

        const replay = new BrowserLikeClient(app.baseUrl);
        replay.cookie = stolenCookie;
        const after = await replay.request('/api/v1/auth/session');
        assert.equal(after.status, 401, 'revoked session must not resolve');

        const anonymous = await new BrowserLikeClient(app.baseUrl).request('/api/v1/auth/session');
        assert.equal(anonymous.status, 401);
    });

    await t.test('workspace capabilities come only from explicit assignments in the selected tenant', async () => {
        const expectations: Array<[typeof student1, object]> = [
            [student1, { examParticipant: true, proctor: false, teacher: false }],
            [teacher, { examParticipant: false, proctor: false, teacher: true }],
            [proctor, { examParticipant: false, proctor: true, teacher: false }],
        ];
        for (const [person, capabilities] of expectations) {
            const c = new BrowserLikeClient(app.baseUrl);
            await c.login(person.username, person.password);
            c.tenantId = tenantA;
            const res = await c.request('/api/v1/me/context');
            assert.equal(res.status, 200, person.username);
            assert.deepEqual(res.body, { tenantId: tenantA, tenantDisplayLabel: 'SMA Negeri 1 Contoh', tenantTimeZone: 'Asia/Jakarta', capabilities });
        }
        const c = new BrowserLikeClient(app.baseUrl);
        await c.login(student1.username, student1.password);
        c.tenantId = tenantB;
        assert.equal((await c.request('/api/v1/me/context')).status, 403, 'no membership in tenant B');
    });

    await t.test('attempt routes authorize by ownership: own attempt yes, classmate or other tenant no', async () => {
        const s1 = new BrowserLikeClient(app.baseUrl);
        await s1.login(student1.username, student1.password);
        s1.tenantId = tenantA;
        const own = await s1.request(`/api/v1/assessment/resume?attemptId=${attempt1}`);
        assert.equal(own.status, 200);
        assert.equal(own.body.attemptId, attempt1);

        const classmate = await s1.request(`/api/v1/assessment/resume?attemptId=${attempt2}`);
        assert.equal(classmate.status, 403);
        const classmateTimer = await s1.request(`/api/v1/assessment/timer/start`, { method: 'POST', body: { attemptId: attempt2 } });
        assert.equal(classmateTimer.status, 403);

        s1.tenantId = tenantB;
        assert.equal((await s1.request(`/api/v1/assessment/resume?attemptId=${attempt1}`)).status, 403);

        const other = new BrowserLikeClient(app.baseUrl);
        await other.login(outsider.username, outsider.password);
        other.tenantId = tenantB;
        assert.equal((await other.request(`/api/v1/assessment/resume?attemptId=${attempt1}`)).status, 403);
        other.tenantId = tenantA;
        assert.equal((await other.request(`/api/v1/assessment/resume?attemptId=${attempt1}`)).status, 403);

        const anonymous = new BrowserLikeClient(app.baseUrl);
        anonymous.tenantId = tenantA;
        assert.equal((await anonymous.request(`/api/v1/assessment/resume?attemptId=${attempt1}`)).status, 401);
        assert.equal((await anonymous.request(`/api/v1/assessment/resume?attemptId=not-a-uuid`)).status, 400);
    });

    await t.test('assigned exams, proctor monitoring and teacher readiness resolve the real session', async () => {
        const s1 = new BrowserLikeClient(app.baseUrl);
        await s1.login(student1.username, student1.password);
        s1.tenantId = tenantA;
        const assigned = await s1.request('/api/v1/assessment/assigned-exams');
        assert.equal(assigned.status, 200);
        assert.equal(assigned.body.assignments.length, 1);
        assert.deepEqual(assigned.body.assignments[0].attempts.map((a: any) => a.attemptId), [attempt1]);

        const p = new BrowserLikeClient(app.baseUrl);
        await p.login(proctor.username, proctor.password);
        p.tenantId = tenantA;
        const monitoring = await p.request('/api/v1/assessment/proctor-monitoring');
        assert.equal(monitoring.status, 200);
        assert.deepEqual(monitoring.body.assignments.map((a: any) => a.examInstanceId), [exam]);

        const studentMonitoring = await s1.request('/api/v1/assessment/proctor-monitoring');
        assert.equal(studentMonitoring.status, 200);
        assert.deepEqual(studentMonitoring.body.assignments, [], 'no proctor assignment, nothing visible');

        const g = new BrowserLikeClient(app.baseUrl);
        await g.login(teacher.username, teacher.password);
        g.tenantId = tenantA;
        assert.equal((await g.request('/api/v1/assessment/teacher-readiness')).status, 200);
        assert.equal((await s1.request('/api/v1/assessment/teacher-readiness')).status, 403);
    });

    await t.test('Authorization header transport (BU-090) remains supported', async () => {
        const c = new BrowserLikeClient(app.baseUrl);
        await c.login(student1.username, student1.password);
        const credential = c.cookie!.split('=')[1];
        const res = await fetch(`${app.baseUrl}/api/v1/assessment/assigned-exams`, {
            headers: { Authorization: `ELLIGBLE-Session ${credential}`, 'X-Tenant-ID': tenantA },
        });
        assert.equal(res.status, 200);
    });

    await t.test('cross-origin state changes are refused; oversized bodies get 413', async () => {
        const c = new BrowserLikeClient(app.baseUrl);
        const evil = await c.request('/api/v1/auth/login', {
            method: 'POST', body: { username: student1.username, password: student1.password }, origin: 'https://evil.example',
        });
        assert.equal(evil.status, 403);
        assert.deepEqual(evil.body, { error: 'origin_not_allowed' });
        assert.equal(c.cookie, null);

        await c.login(student1.username, student1.password);
        c.tenantId = tenantA;
        const huge = await c.request('/api/v1/assessment/answer/save', {
            method: 'POST', rawBody: JSON.stringify({ attemptId: attempt1, pad: 'x'.repeat(70 * 1024) }),
            headers: { 'Content-Type': 'application/json' },
        });
        assert.equal(huge.status, 413);
    });

    await t.test('five failures in five minutes throttle the account (DEC-041), even for the right password', async () => {
        const target = await createPersonWithAccount(pool, 'siswa.dibatasi');
        await addMembership(pool, tenantA, target.personId);
        const c = new BrowserLikeClient(app.baseUrl);
        for (let i = 0; i < 5; i++) {
            assert.equal((await c.login(target.username, 'salah-sandi-123')).status, 401);
        }
        const blocked = await c.login(target.username, target.password);
        assert.equal(blocked.status, 429);
        assert.deepEqual(blocked.body, { error: 'too_many_attempts' });
        assert.equal(c.cookie, null);
    });

    await t.test('secure deployments use a __Host- prefixed Secure cookie', async () => {
        const secureApp = await startProductionWiredServer(pool, { secureCookie: true });
        try {
            const c = new BrowserLikeClient(secureApp.baseUrl);
            const res = await c.login(student1.username, student1.password);
            const setCookie = res.headers.get('set-cookie') ?? '';
            assert.match(setCookie, /^__Host-elligble_session=/);
            assert.match(setCookie, /; Secure/);
            assert.equal(res.headers.get('strict-transport-security'), 'max-age=31536000; includeSubDomains');
            // An unprefixed cookie is not accepted by a secure deployment.
            const downgrade = new BrowserLikeClient(secureApp.baseUrl);
            downgrade.cookie = `elligble_session=${c.cookie!.split('=')[1]}`;
            assert.equal((await downgrade.request('/api/v1/auth/session')).status, 401);
        } finally {
            await secureApp.close();
        }
    });
});
