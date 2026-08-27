import * as fs from 'fs';
import * as path from 'path';
// @ts-ignore
import { Client, Pool } from 'pg';
import * as http from 'http';
import { handleSaveAnswer } from '../src/answer.js';
import { handleTimerStart, handleTimerGet } from '../src/timer.js';
import { handleSubmit } from '../src/submission.js';
import { handleResumeGet } from '../src/resume.js';

const DB_URL = process.env.DATABASE_URL || 'postgresql://postgres:Password*08@localhost:5432';
const TEST_DB = 'elligble_bu014_integration';

async function main() {
    let evidence = '# BU-014 INTEGRATED CAPABILITY TESTING EVIDENCE\n\n';
    const log = (msg: string) => {
        console.log(msg);
        evidence += `- ${msg}\n`;
    };

    // 1. Create database
    const parsedUrl = new URL(DB_URL);
    parsedUrl.pathname = '/postgres';
    const setupClient = new Client({ connectionString: parsedUrl.toString() });
    await setupClient.connect();
    await setupClient.query(`DROP DATABASE IF EXISTS ${TEST_DB} WITH (FORCE)`);
    await setupClient.query(`CREATE DATABASE ${TEST_DB}`);
    await setupClient.end();

    parsedUrl.pathname = '/' + TEST_DB;
    const client = new Client({ connectionString: parsedUrl.toString() });
    await client.connect();

    // 2. Run migrations
    const migrationsDir = 'C:/Projects/ELLIGBLE/database/migrations';
    const migrations = ['0001', '0002', '0003', '0004', '0005', '0006'];
    for (const m of migrations) {
        const files = fs.readdirSync(migrationsDir).filter(f => f.startsWith(m) && f.endsWith('.sql'));
        for (const file of files) {
            const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
            await client.query(sql);
        }
    }

    const tenantId = '00000000-1111-4222-a333-444444444444';
    const attemptId = '11111111-2222-4333-a444-555555555555';
    const participantId = '22222222-2222-4333-a444-555555555555';
    const examInstanceId = '33333333-2222-4333-a444-555555555555';
    const personId = '00000000-0000-4000-a000-000000000000';
    const snapshotId1 = '55555555-2222-4333-a444-555555555555';
    const snapshotId2 = '66666666-2222-4333-a444-555555555555';

    await client.query('INSERT INTO secure_assessment_exam_instances (id, tenant_id) VALUES ($1, $2)', [examInstanceId, tenantId]);
    await client.query('INSERT INTO secure_assessment_exam_participants (id, tenant_id, exam_instance_id, person_id) VALUES ($1, $2, $3, $4)', [participantId, tenantId, examInstanceId, personId]);
    await client.query('INSERT INTO secure_assessment_exam_attempts (id, tenant_id, exam_participant_id) VALUES ($1, $2, $3)', [attemptId, tenantId, participantId]);
    await client.query('INSERT INTO secure_assessment_exam_question_snapshots (id, tenant_id, exam_instance_id, frozen_content) VALUES ($1, $2, $3, $4)', [snapshotId1, tenantId, examInstanceId, '{}']);
    await client.query('INSERT INTO secure_assessment_exam_question_snapshots (id, tenant_id, exam_instance_id, frozen_content) VALUES ($1, $2, $3, $4)', [snapshotId2, tenantId, examInstanceId, '{}']);

    const timerStateId = '77777777-2222-4333-a444-555555555555';
    await client.query('INSERT INTO secure_assessment_timer_state (id, tenant_id, exam_attempt_id, configured_duration_seconds) VALUES ($1, $2, $3, 10)', [timerStateId, tenantId, attemptId]);

    log("valid tenant / participant / Attempt / snapshots created.");

    const pool = new Pool({ connectionString: parsedUrl.toString() });

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

    // 2. Timer start/read
    const timerStartRes: any = await callApi(handleTimerStart, '/api/v1/assessment/timer/start', 'POST', { attemptId, configuredDurationSeconds: 10 });
    log(`Timer start: ${timerStartRes.status}`);
    const timerGetRes: any = await callApi(handleTimerGet, `/api/v1/assessment/timer?attemptId=${attemptId}`, 'GET', null);
    log(`Timer read: ${timerGetRes.status}, remaining: ${timerGetRes.body.effectiveRemainingSeconds}`);

    // 3. Answer Save acknowledgement
    const ans1Res: any = await callApi(handleSaveAnswer, '/api/v1/assessment/answer/save', 'POST', {
        attemptId,
        snapshotId: snapshotId1,
        answerPayload: { choice: "A" },
        clientWriteIdentity: 'client-1',
        expectedWriteVersion: null
    });
    log(`Answer 1 save: ${ans1Res.status}, version: ${ans1Res.body?.write_version}, error: ${ans1Res.body?.error}`);

    // 4. multiple authoritative Answers
    const ans2Res: any = await callApi(handleSaveAnswer, '/api/v1/assessment/answer/save', 'POST', {
        attemptId,
        snapshotId: snapshotId2,
        answerPayload: { choice: "B" },
        clientWriteIdentity: 'client-2',
        expectedWriteVersion: null
    });
    log(`Answer 2 save: ${ans2Res.status}, version: ${ans2Res.body?.write_version}, error: ${ans2Res.body?.error}`);

    // 5. reconnect/resume authoritative readback
    const resumeRes: any = await callApi(handleResumeGet, `/api/v1/assessment/resume?attemptId=${attemptId}`, 'GET', null);
    log(`Resume readback: ${resumeRes.status}, answers count: ${resumeRes.body.answers.length}, timer status: ${resumeRes.body.timer.status}`);

    // 6. Timer adjustment (simulate by manually updating started_at and elapsed_seconds in DB since we just want to verify expiry guard logic which uses these)
    await client.query("UPDATE secure_assessment_timer_state SET started_at = CURRENT_TIMESTAMP - interval '15 seconds' WHERE exam_attempt_id = $1", [attemptId]);
    log(`Timer adjustment applied (-15 seconds).`);

    // 7. authoritative Timer expiry
    const timerGetRes2: any = await callApi(handleTimerGet, `/api/v1/assessment/timer?attemptId=${attemptId}`, 'GET', null);
    log(`Timer read after expiry: ${timerGetRes2.status}, remaining: ${timerGetRes2.body.effectiveRemainingSeconds}, status: ${timerGetRes2.body.status}`);

    // 8. exact acknowledged retry after expiry = 200 / zero mutation
    const ans1RetryRes: any = await callApi(handleSaveAnswer, '/api/v1/assessment/answer/save', 'POST', {
        attemptId,
        snapshotId: snapshotId1,
        answerPayload: { choice: "A" },
        clientWriteIdentity: 'client-1',
        expectedWriteVersion: 1
    });
    log(`Answer 1 exact retry after expiry: ${ans1RetryRes.status}, version: ${ans1RetryRes.body?.write_version}`);

    // 9. mutating Answer after expiry rejected
    const ans1MutateRes: any = await callApi(handleSaveAnswer, '/api/v1/assessment/answer/save', 'POST', {
        attemptId,
        snapshotId: snapshotId1,
        answerPayload: { choice: "C" },
        clientWriteIdentity: 'client-1-mutate',
        expectedWriteVersion: 1
    });
    log(`Answer 1 mutate after expiry: ${ans1MutateRes.status}, error: ${ans1MutateRes.body?.error}`);

    // 10. final Submission succeeds
    const subRes: any = await callApi(handleSubmit, '/api/v1/assessment/submit', 'POST', { attemptId });
    log(`Submission: ${subRes.status}, id: ${subRes.body?.submission_id}`);

    // 11. Submission retry returns same receipt
    const subRetryRes: any = await callApi(handleSubmit, '/api/v1/assessment/submit', 'POST', { attemptId });
    log(`Submission retry: ${subRetryRes.status}, id matches: ${subRetryRes.body?.submission_id === subRes.body?.submission_id}`);

    // 12. new/mutating Answer after Submission rejected
    const ans3Res: any = await callApi(handleSaveAnswer, '/api/v1/assessment/answer/save', 'POST', {
        attemptId,
        snapshotId: snapshotId2,
        answerPayload: { choice: "D" },
        clientWriteIdentity: 'client-3',
        expectedWriteVersion: 1
    });
    log(`Answer mutate after submission: ${ans3Res.status}`);

    // 13. exact previously acknowledged Answer retry after Submission = zero mutation
    const ans2RetryRes: any = await callApi(handleSaveAnswer, '/api/v1/assessment/answer/save', 'POST', {
        attemptId,
        snapshotId: snapshotId2,
        answerPayload: { choice: "B" },
        clientWriteIdentity: 'client-2',
        expectedWriteVersion: 1
    });
    log(`Answer 2 exact retry after submission: ${ans2RetryRes.status}, version: ${ans2RetryRes.body?.write_version}`);

    // 14. submitted-state resume readback
    const resumeRes2: any = await callApi(handleResumeGet, `/api/v1/assessment/resume?attemptId=${attemptId}`, 'GET', null);
    log(`Resume readback after submission: ${resumeRes2.status}, submitted: ${resumeRes2.body.submitted_at !== null}`);

    // 15. tenant isolation
    const wrongTenantId = '99999999-9999-9999-9999-999999999999';
    const tenantIsolRes: any = await callApi(handleResumeGet, `/api/v1/assessment/resume?attemptId=${attemptId}`, 'GET', null, wrongTenantId);
    log(`Tenant isolation check: ${tenantIsolRes.status}`);

    // 16. final authoritative row counts/state consistency
    const answerCount = (await client.query('SELECT COUNT(*) FROM secure_assessment_exam_answers WHERE exam_attempt_id = $1', [attemptId])).rows[0].count;
    log(`Final authoritative answer row count: ${answerCount}`);

    fs.writeFileSync(path.join('C:/Projects/ELLIGBLE/docs/build/evidence', 'BU-014_ASSESSMENT_CAPABILITY_TESTING_EVIDENCE.md'), evidence);

    await pool.end();
    await client.end();
    
    // DB CLEANUP
    parsedUrl.pathname = '/postgres';
    const cleanupClient = new Client({ connectionString: parsedUrl.toString() });
    await cleanupClient.connect();
    await cleanupClient.query(`DROP DATABASE IF EXISTS ${TEST_DB} WITH (FORCE)`);
    await cleanupClient.end();
    log(`Database cleanup completed.`);
}

main().catch(err => { console.error(err); process.exit(1); });
