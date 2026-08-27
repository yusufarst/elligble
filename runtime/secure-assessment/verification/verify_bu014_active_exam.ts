import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
// @ts-ignore
import { Client, Pool } from 'pg';
import * as http from 'http';
import { handleSaveAnswer } from '../src/answer.js';
import { handleTimerStart, handleTimerGet } from '../src/timer.js';
import { handleSubmit } from '../src/submission.js';
import { handleResumeGet } from '../src/resume.js';

const DB_URL = process.env.DATABASE_URL;
if (!DB_URL) {
    console.error('DATABASE_URL must be provided');
    process.exit(1);
}

const runId = Math.random().toString(36).substring(2, 9);
const TEST_DB = `elligble_bu014_${runId}`;

// Paths relative to the harness
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const migrationsDir = path.resolve(__dirname, '../../../database/migrations');
const evidenceDir = path.resolve(__dirname, '../../../docs/build/evidence');
const evidenceFile = path.join(evidenceDir, 'BU-014_ASSESSMENT_CAPABILITY_TESTING_EVIDENCE.md');

function assertStrict(condition: boolean, message: string) {
    if (!condition) {
        throw new Error(`ASSERTION FAILED: ${message}`);
    }
}

async function main() {
    let evidence = `# BU-014 INTEGRATED CAPABILITY TESTING EVIDENCE\n\nRUN ID: ${runId}\n`;
    const log = (msg: string) => {
        console.log(msg);
        evidence += `- PASS: ${msg}\n`;
    };

    const parsedUrl = new URL(DB_URL as string);
    parsedUrl.pathname = '/postgres';
    const setupClient = new Client({ connectionString: parsedUrl.toString() });

    await setupClient.connect();
    try {
        await setupClient.query(`CREATE DATABASE ${TEST_DB}`);
    } finally {
        await setupClient.end();
    }

    parsedUrl.pathname = '/' + TEST_DB;
    const client = new Client({ connectionString: parsedUrl.toString() });
    const pool = new Pool({ connectionString: parsedUrl.toString() });

    let caughtError: any = null;
    try {
        await client.connect();

        // A. migrations 0001–0006 succeed.
        const migrations = ['0001', '0002', '0003', '0004', '0005', '0006'];
        for (const m of migrations) {
            const files = fs.readdirSync(migrationsDir).filter(f => f.startsWith(m) && f.endsWith('.sql'));
            for (const file of files) {
                const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
                await client.query(sql);
            }
        }
        log("Migrations 0001-0006");

        const tenantId = '00000000-1111-4222-a333-444444444444';
        const attemptId = '11111111-2222-4333-a444-555555555555';
        const participantId = '22222222-2222-4333-a444-555555555555';
        const examInstanceId = '33333333-2222-4333-a444-555555555555';
        const personId = '00000000-0000-4000-a000-000000000000';
        const snapshotId1 = '55555555-2222-4333-a444-555555555555';
        const snapshotId2 = '66666666-2222-4333-a444-555555555555';
        const timerStateId = '77777777-2222-4333-a444-555555555555';

        await client.query('INSERT INTO secure_assessment_exam_instances (id, tenant_id) VALUES ($1, $2)', [examInstanceId, tenantId]);
        await client.query('INSERT INTO secure_assessment_exam_participants (id, tenant_id, exam_instance_id, person_id) VALUES ($1, $2, $3, $4)', [participantId, tenantId, examInstanceId, personId]);
        await client.query('INSERT INTO secure_assessment_exam_attempts (id, tenant_id, exam_participant_id) VALUES ($1, $2, $3)', [attemptId, tenantId, participantId]);
        await client.query('INSERT INTO secure_assessment_exam_question_snapshots (id, tenant_id, exam_instance_id, frozen_content) VALUES ($1, $2, $3, $4)', [snapshotId1, tenantId, examInstanceId, '{}']);
        await client.query('INSERT INTO secure_assessment_exam_question_snapshots (id, tenant_id, exam_instance_id, frozen_content) VALUES ($1, $2, $3, $4)', [snapshotId2, tenantId, examInstanceId, '{}']);
        await client.query('INSERT INTO secure_assessment_timer_state (id, tenant_id, exam_attempt_id, configured_duration_seconds) VALUES ($1, $2, $3, 10)', [timerStateId, tenantId, attemptId]);

        const callApi = async (handler: any, reqUrl: string, method: string, payload: any, tId = tenantId, aId = attemptId) => {
            return new Promise((resolve) => {
                let bodyData = payload ? JSON.stringify(payload) : '';
                const req = {
                    method,
                    url: reqUrl,
                    headers: { host: 'localhost' },
                    on: (event: string, cb: any) => {
                        if (event === 'data' && bodyData) cb(Buffer.from(bodyData));
                        if (event === 'end') cb();
                    }
                } as unknown as http.IncomingMessage;

                const res: any = {
                    statusCode: 200,
                    headers: {},
                    body: '',
                    writeHead: (status: number, headers: any) => { res.statusCode = status; res.headers = headers; },
                    end: (chunk: string) => { res.body = chunk; resolve({ status: res.statusCode, body: res.body ? JSON.parse(res.body) : null }); }
                };

                const deps = {
                    pool,
                    getAuthorizedContext: () => ({ tenantId: tId, authorizedAttemptId: aId })
                };

                handler(req, res as unknown as http.ServerResponse, deps);
            });
        };

        // B. Timer start
        const timerStartRes: any = await callApi(handleTimerStart, '/api/v1/assessment/timer/start', 'POST', { attemptId, configuredDurationSeconds: 10 });
        assertStrict(timerStartRes.status === 200, "Timer start should be 200");
        assertStrict(timerStartRes.body.status === 'started', "Timer start status should be started");
        assertStrict(typeof timerStartRes.body.startedAt === 'string', "Timer start should return startedAt");
        assertStrict(timerStartRes.body.configuredDurationSeconds === 10, "Timer start duration should be 10");
        assertStrict(typeof timerStartRes.body.effectiveDurationSeconds === 'number', "effectiveDurationSeconds missing");
        log("Timer start");

        // C. Answer 1 and Answer 2
        const ans1Res: any = await callApi(handleSaveAnswer, '/api/v1/assessment/answer/save', 'POST', {
            attemptId, snapshotId: snapshotId1, answerPayload: { choice: "A" }, clientWriteIdentity: 'client-1', expectedWriteVersion: null
        });
        assertStrict(ans1Res.status === 200, "Answer 1 save should be 200");
        assertStrict(ans1Res.body.writeVersion === 1, "Answer 1 writeVersion should be 1");

        const ans2Res: any = await callApi(handleSaveAnswer, '/api/v1/assessment/answer/save', 'POST', {
            attemptId, snapshotId: snapshotId2, answerPayload: { choice: "B" }, clientWriteIdentity: 'client-2', expectedWriteVersion: null
        });
        assertStrict(ans2Res.status === 200, "Answer 2 save should be 200");
        assertStrict(ans2Res.body.writeVersion === 1, "Answer 2 writeVersion should be 1");

        // D. DB authoritative Answers
        const dbAnswers = await client.query('SELECT * FROM secure_assessment_exam_answers WHERE exam_attempt_id = $1 ORDER BY client_write_identity ASC', [attemptId]);
        assertStrict(dbAnswers.rows.length === 2, "Should have exactly 2 DB answers");
        assertStrict(dbAnswers.rows[0].client_write_identity === 'client-1', "Answer 1 identity mismatch");
        assertStrict(dbAnswers.rows[0].answer_payload.choice === 'A', "Answer 1 payload mismatch");
        assertStrict(dbAnswers.rows[1].client_write_identity === 'client-2', "Answer 2 identity mismatch");
        assertStrict(dbAnswers.rows[1].answer_payload.choice === 'B', "Answer 2 payload mismatch");
        log("Answer persistence");

        // E. Resume before expiry
        const resumeRes: any = await callApi(handleResumeGet, `/api/v1/assessment/resume?attemptId=${attemptId}`, 'GET', null);
        assertStrict(resumeRes.status === 200, "Resume should be 200");
        assertStrict(resumeRes.body.answers.length === 2, "Resume should return 2 answers");
        assertStrict(resumeRes.body.timer.status === 'active', "Resume timer status should be active");
        assertStrict(resumeRes.body.submission.status === 'not_submitted', "Resume submission status should be not_submitted");
        log("Resume pre-submission");

        // F. REAL TIMER ADJUSTMENT
        await client.query("INSERT INTO secure_assessment_timer_adjustments (tenant_id, timer_state_id, adjustment_seconds, reason) VALUES ($1, $2, $3, $4)", [tenantId, timerStateId, -15, 'Penalty']);

        // G. Expiry
        const timerGetRes2: any = await callApi(handleTimerGet, `/api/v1/assessment/timer?attemptId=${attemptId}`, 'GET', null);
        assertStrict(timerGetRes2.status === 200, "Timer get should be 200 after expiry");
        assertStrict(timerGetRes2.body.effectiveRemainingSeconds === 0, "effectiveRemainingSeconds should be 0");
        assertStrict(timerGetRes2.body.status === 'expired', "Timer status should be expired");
        log("Real timer adjustment");
        log("Expiry");

        // H. Exact acknowledged retry after expiry
        const rowBefore = await client.query('SELECT * FROM secure_assessment_exam_answers WHERE exam_question_snapshot_id = $1', [snapshotId1]);
        const ans1RetryRes: any = await callApi(handleSaveAnswer, '/api/v1/assessment/answer/save', 'POST', {
            attemptId, snapshotId: snapshotId1, answerPayload: { choice: "A" }, clientWriteIdentity: 'client-1', expectedWriteVersion: 1
        });
        const rowAfter = await client.query('SELECT * FROM secure_assessment_exam_answers WHERE exam_question_snapshot_id = $1', [snapshotId1]);
        assertStrict(ans1RetryRes.status === 200, "Exact retry after expiry should be 200");
        assertStrict(ans1RetryRes.body.writeVersion === 1, "Retry writeVersion should be 1");
        assertStrict(rowBefore.rows.length === rowAfter.rows.length, "Row count changed");
        assertStrict(rowBefore.rows[0].answer_payload.choice === rowAfter.rows[0].answer_payload.choice, "Payload changed");
        assertStrict(rowBefore.rows[0].client_write_identity === rowAfter.rows[0].client_write_identity, "Identity changed");
        assertStrict(rowBefore.rows[0].write_version === rowAfter.rows[0].write_version, "Write version changed");
        assertStrict(rowBefore.rows[0].updated_at.getTime() === rowAfter.rows[0].updated_at.getTime(), "Updated at changed");
        log("Exact retry after expiry zero mutation");

        // I. Mutating Answer after expiry
        const ans1MutateRes: any = await callApi(handleSaveAnswer, '/api/v1/assessment/answer/save', 'POST', {
            attemptId, snapshotId: snapshotId1, answerPayload: { choice: "C" }, clientWriteIdentity: 'client-1-mutate', expectedWriteVersion: 1
        });
        assertStrict(ans1MutateRes.status === 409, "Mutate after expiry should be 409");
        assertStrict(ans1MutateRes.body.error === 'timer_expired', "Error should be timer_expired");
        const rowMutate = await client.query('SELECT * FROM secure_assessment_exam_answers WHERE exam_question_snapshot_id = $1', [snapshotId1]);
        assertStrict(rowBefore.rows[0].updated_at.getTime() === rowMutate.rows[0].updated_at.getTime(), "State should be unchanged");
        log("Mutating Answer after expiry rejected");

        // J. Submission
        const subRes: any = await callApi(handleSubmit, '/api/v1/assessment/submit', 'POST', { attemptId });
        assertStrict(subRes.status === 200, "Submission should be 200");
        assertStrict(subRes.body.status === 'submitted', "Status should be submitted");
        assertStrict(typeof subRes.body.submissionId === 'string' && subRes.body.submissionId.length > 0, "submissionId missing");

        const subDb = await client.query('SELECT * FROM secure_assessment_exam_submissions WHERE exam_attempt_id = $1', [attemptId]);
        assertStrict(subDb.rows.length === 1, "Should have exactly 1 submission row");
        assertStrict(subDb.rows[0].id === subRes.body.submissionId, "submissionId mismatch");
        assertStrict(new Date(subRes.body.submittedAt).getTime() === subDb.rows[0].submitted_at.getTime(), "submittedAt mismatch");
        log("Submission");

        // K. Submission retry
        const subRetryRes: any = await callApi(handleSubmit, '/api/v1/assessment/submit', 'POST', { attemptId });
        assertStrict(subRetryRes.status === 200, "Submission retry should be 200");
        assertStrict(subRetryRes.body.submissionId === subRes.body.submissionId, "Retry submissionId mismatch");
        assertStrict(subRetryRes.body.submittedAt === subRes.body.submittedAt, "Retry submittedAt mismatch");
        const subDbRetry = await client.query('SELECT * FROM secure_assessment_exam_submissions WHERE exam_attempt_id = $1', [attemptId]);
        assertStrict(subDbRetry.rows.length === 1, "Submission row count changed after retry");
        log("Submission idempotent retry");

        // L. Mutating Answer after Submission
        const ans3Res: any = await callApi(handleSaveAnswer, '/api/v1/assessment/answer/save', 'POST', {
            attemptId, snapshotId: snapshotId2, answerPayload: { choice: "D" }, clientWriteIdentity: 'client-3', expectedWriteVersion: 1
        });
        assertStrict(ans3Res.status === 409, "Mutating answer after submission should be 409");
        assertStrict(ans3Res.body.error === 'attempt_already_submitted', "Error should be attempt_already_submitted");
        log("Post-submission write guard");

        // M. Exact previously acknowledged Answer retry after Submission
        const row2Before = await client.query('SELECT * FROM secure_assessment_exam_answers WHERE exam_question_snapshot_id = $1', [snapshotId2]);
        const ans2RetryRes: any = await callApi(handleSaveAnswer, '/api/v1/assessment/answer/save', 'POST', {
            attemptId, snapshotId: snapshotId2, answerPayload: { choice: "B" }, clientWriteIdentity: 'client-2', expectedWriteVersion: 1
        });
        assertStrict(ans2RetryRes.status === 200, "Exact retry after submission should be 200");
        assertStrict(ans2RetryRes.body.writeVersion === 1, "Exact retry version should be 1");
        const row2After = await client.query('SELECT * FROM secure_assessment_exam_answers WHERE exam_question_snapshot_id = $1', [snapshotId2]);
        assertStrict(row2Before.rows[0].updated_at.getTime() === row2After.rows[0].updated_at.getTime(), "State should be unchanged after exact retry");
        log("Post-submission exact retry zero mutation");

        // N. Resume after Submission
        const resumeRes2: any = await callApi(handleResumeGet, `/api/v1/assessment/resume?attemptId=${attemptId}`, 'GET', null);
        assertStrict(resumeRes2.status === 200, "Resume after submission should be 200");
        assertStrict(resumeRes2.body.submission.status === 'submitted', "Resume submission status should be submitted");
        assertStrict(resumeRes2.body.submission.submissionId === subRes.body.submissionId, "Resume submissionId mismatch");
        assertStrict(resumeRes2.body.submission.submittedAt === subRes.body.submittedAt, "Resume submittedAt mismatch");
        log("Submitted resume readback");

        // O. Tenant isolation
        const wrongTenantId = '99999999-9999-9999-9999-999999999999';
        const tenantIsolRes: any = await callApi(handleResumeGet, `/api/v1/assessment/resume?attemptId=${attemptId}`, 'GET', null, wrongTenantId);
        assertStrict(tenantIsolRes.status === 404, "Tenant isolation should return 404 or boundary error");
        log("Tenant isolation");

        // P. Final authoritative consistency
        const finalAnswers = await client.query('SELECT COUNT(*) FROM secure_assessment_exam_answers WHERE exam_attempt_id = $1', [attemptId]);
        assertStrict(parseInt(finalAnswers.rows[0].count, 10) === 2, "Final answer count should be 2");
        const finalTimers = await client.query('SELECT COUNT(*) FROM secure_assessment_timer_state WHERE exam_attempt_id = $1', [attemptId]);
        assertStrict(parseInt(finalTimers.rows[0].count, 10) === 1, "Final timer count should be 1");
        const finalAdjs = await client.query('SELECT COUNT(*) FROM secure_assessment_timer_adjustments WHERE timer_state_id = $1', [timerStateId]);
        assertStrict(parseInt(finalAdjs.rows[0].count, 10) === 1, "Final adjustment count should be 1");
        const finalSubs = await client.query('SELECT COUNT(*) FROM secure_assessment_exam_submissions WHERE exam_attempt_id = $1', [attemptId]);
        assertStrict(parseInt(finalSubs.rows[0].count, 10) === 1, "Final submission count should be 1");
        log("Final authoritative consistency");

    } catch (err: any) {
        caughtError = err;
        console.error("RUN FAILED:");
        console.error(err.message || err);
    } finally {
        await pool.end();
        await client.end();

        parsedUrl.pathname = '/postgres';
        const cleanupClient = new Client({ connectionString: parsedUrl.toString() });
        await cleanupClient.connect();
        await cleanupClient.query(`DROP DATABASE IF EXISTS ${TEST_DB} WITH (FORCE)`);
        await cleanupClient.end();
        console.log("Disposable DB cleanup");

        if (caughtError) {
            process.exit(1);
        } else {
            evidence += `- PASS: Disposable DB cleanup\n`;
            fs.mkdirSync(evidenceDir, { recursive: true });
            fs.writeFileSync(evidenceFile, evidence);
        }
    }
}

main();
