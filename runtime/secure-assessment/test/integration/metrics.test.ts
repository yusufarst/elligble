import { test } from 'node:test';
import * as assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createDisposableDatabase, skipWithoutDatabase } from '../support/pg-harness.ts';
import {
    addMembership, addParticipant, addQuestionSnapshots, createAttemptWithTimer, createExamInstance,
    createPersonWithAccount, createTeachingContext, createTenant,
} from '../support/fixtures.ts';
import { BrowserLikeClient, startProductionWiredServer } from '../support/test-server.ts';
import { RuntimeMetrics, countPendingExpiredAttempts, createMetricsServer } from '../../src/metrics.ts';
import { startExpiryFinalizationSweeper } from '../../src/expiry-finalization.ts';
import { checkDatabaseReadiness } from '../../src/db.ts';

// Operator metrics against real PostgreSQL and the production wiring (OPS-002): answer
// saves are counted by outcome, the expiry sweep reports what it finalized and what is
// still overdue, and the listener reports the database and its pool.

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

test('operator metrics (real PostgreSQL, production wiring)', { skip: skipWithoutDatabase }, async (t) => {
    const db = await createDisposableDatabase();
    const metrics = new RuntimeMetrics();
    const app = await startProductionWiredServer(db.pool, { metrics });
    const listener = createMetricsServer({ metrics, pool: db.pool, checkReadiness: () => checkDatabaseReadiness(db.pool) });
    await new Promise<void>(resolve => listener.listen(0, '127.0.0.1', resolve));
    const scrape = async () => (await fetch(`http://127.0.0.1:${(listener.address() as { port: number }).port}/metrics`)).text();
    t.after(async () => {
        metrics.stop();
        await new Promise<void>(resolve => listener.close(() => resolve()));
        await app.close();
        await db.close();
    });
    const pool = db.pool;
    const tenant = await createTenant(pool);
    const teacher = await createPersonWithAccount(pool);
    const teaching = await createTeachingContext(pool, tenant, await addMembership(pool, tenant, teacher.personId));
    const exam = await createExamInstance(pool, tenant, teaching, { durationSeconds: 3600 });
    const [snapshot] = await addQuestionSnapshots(pool, tenant, exam, 1);

    await t.test('answer saves are counted by outcome, with their latency', async () => {
        const person = await createPersonWithAccount(pool);
        await addMembership(pool, tenant, person.personId);
        await addParticipant(pool, tenant, exam, person.personId);
        const client = new BrowserLikeClient(app.baseUrl);
        assert.equal((await client.login(person.username, person.password)).status, 200);
        client.tenantId = tenant;
        const attemptId = (await client.request('/api/v1/assessment/attempts/start', { method: 'POST', body: { examInstanceId: exam } })).body.attemptId;
        const sessionId = randomUUID();
        assert.equal((await client.request('/api/v1/assessment/session/activate', { method: 'POST', body: { attemptId, sessionId } })).status, 200);
        assert.equal((await client.request('/api/v1/assessment/timer/start', { method: 'POST', body: { attemptId } })).status, 200);
        const save = (expectedWriteVersion: number | null) => client.request('/api/v1/assessment/answer/save', {
            method: 'POST', body: { attemptId, sessionId, snapshotId: snapshot, answerPayload: { selectedOptionId: 'A' }, clientWriteIdentity: randomUUID(), expectedWriteVersion },
        });
        assert.equal((await save(null)).status, 200);
        assert.equal((await save(null)).status, 409, 'a stale version is refused by the exam rules');
        await sleep(20);
        const text = await scrape();
        assert.match(text, /^elligble_answer_saves_total\{outcome="acknowledged"\} 1$/m);
        assert.match(text, /^elligble_answer_saves_total\{outcome="refused"\} 1$/m);
        assert.doesNotMatch(text, /outcome="failed"/);
        assert.match(text, /^elligble_http_request_duration_seconds_count\{component="response_persistence"\} 2$/m);
        assert.match(text, /^elligble_http_requests_total\{component="authentication",status_class="2xx"\} 1$/m);
        assert.match(text, /^elligble_http_requests_total\{component="attempt_runtime",status_class="2xx"\} 2$/m);
        assert.match(text, /^elligble_http_requests_total\{component="timer",status_class="2xx"\} 1$/m);
        assert.match(text, /^elligble_database_ready 1$/m);
        assert.match(text, /^elligble_db_pool_connections\{state="waiting"\} 0$/m);
        assert.doesNotMatch(text, new RegExp(attemptId));
    });

    await t.test('the sweep reports what it finalized and what stays overdue while held', async () => {
        const person = await createPersonWithAccount(pool);
        await addMembership(pool, tenant, person.personId);
        const participantId = await addParticipant(pool, tenant, exam, person.personId);
        const attemptId = await createAttemptWithTimer(pool, tenant, participantId, 60);
        await pool.query(`UPDATE secure_assessment_timer_state SET started_at = statement_timestamp() - interval '61 seconds' WHERE exam_attempt_id = $1`, [attemptId]);
        assert.equal(await countPendingExpiredAttempts(pool), 1);

        // A request in flight holds the attempt: the sweep skips it and reports it as pending.
        const holder = await pool.connect();
        await holder.query('BEGIN');
        await holder.query('SELECT id FROM secure_assessment_exam_attempts WHERE id = $1 FOR UPDATE', [attemptId]);
        const sweeper = startExpiryFinalizationSweeper(pool, {
            intervalMs: 50,
            onSweep: report => metrics.observeSweep(report),
            countPending: () => countPendingExpiredAttempts(pool),
        });
        try {
            await sleep(300);
            let text = await scrape();
            assert.match(text, /^elligble_expiry_pending_attempts 1$/m);
            assert.match(text, /^elligble_expiry_last_success_timestamp_seconds \d{10}$/m);
            assert.doesNotMatch(text, /^elligble_expiry_attempts_finalized_total [1-9]/m);
            await holder.query('COMMIT');
            await sleep(300);
            text = await scrape();
            assert.match(text, /^elligble_expiry_attempts_finalized_total 1$/m);
            assert.match(text, /^elligble_expiry_pending_attempts 0$/m);
            assert.doesNotMatch(text, /result="failed"/);
        } finally {
            await holder.query('ROLLBACK').catch(() => {});
            holder.release();
            await sweeper.stop();
        }
    });
});
