import { test } from 'node:test';
import * as assert from 'node:assert/strict';
import * as http from 'node:http';
import {
    handleProctorMonitoringGet,
    type ProctorMonitoringContext,
    type ProctorMonitoringDependencies,
    type ProctorMonitoringResponse
} from '../src/proctor-monitoring.ts';
import { createServer } from '../src/server.ts';

const VALID_TENANT_ID = '11111111-1111-4111-8111-111111111111';
const VALID_PERSON_ID = '22222222-2222-4222-8222-222222222222';
const VALID_EXAM_ID = '33333333-3333-4333-8333-333333333333';
const VALID_ROOM_ID_1 = '44444444-4444-4444-8444-444444444444';
const VALID_ROOM_ID_2 = '55555555-5555-4555-8555-555555555555';

interface MockClient {
    queries: Array<{ text: string; values?: any[] }>;
    query: (text: string, values?: any[]) => Promise<{ rows: any[] }>;
    release: () => void;
    released: boolean;
}

function createMockPool(options?: {
    connectThrows?: boolean;
    queryThrows?: boolean;
    rows?: any[];
}) {
    const mockClient: MockClient = {
        queries: [],
        released: false,
        release() {
            this.released = true;
        },
        async query(text: string, values?: any[]) {
            this.queries.push({ text, values });
            if (options?.queryThrows && text.includes('SELECT')) {
                throw new Error('DB query execution failed');
            }
            if (text.includes('SELECT')) {
                return { rows: options?.rows ?? [] };
            }
            return { rows: [] };
        }
    };

    const pool = {
        async connect() {
            if (options?.connectThrows) {
                throw new Error('DB connection refused');
            }
            return mockClient;
        }
    };

    return { pool: pool as any, mockClient };
}

class MockIncomingMessage extends http.IncomingMessage {
    _headers: Record<string, string> = {};

    constructor(method: string, url: string, headers: Record<string, string> = {}) {
        super(null as any);
        this.method = method;
        this.url = url;
        this._headers = headers;
        this.headers = headers;
    }
}

class MockServerResponse extends http.ServerResponse {
    statusCode: number = 200;
    headers: Record<string, string> = {};
    body: string = '';

    constructor(req: http.IncomingMessage) {
        super(req);
    }

    writeHead(statusCode: number, headers?: any): this {
        this.statusCode = statusCode;
        if (headers) {
            this.headers = headers;
        }
        return this;
    }

    end(chunk?: any): this {
        if (chunk) {
            this.body = chunk.toString();
        }
        return this;
    }
}

test('BU-086 proctor-monitoring focused runtime/API tests', async (t) => {

    await t.test('1. missing context -> fail closed (403 forbidden)', async () => {
        const { pool } = createMockPool();
        const req = new MockIncomingMessage('GET', '/api/v1/assessment/proctor-monitoring');
        const res = new MockServerResponse(req);

        await handleProctorMonitoringGet(req, res, {
            pool,
            getProctorMonitoringContext: () => null
        });

        assert.equal(res.statusCode, 403);
        const body = JSON.parse(res.body);
        assert.deepEqual(body, { error: 'forbidden' });
    });

    await t.test('2. context provider throwing -> bounded 500 internal_error', async () => {
        const { pool } = createMockPool();
        const req = new MockIncomingMessage('GET', '/api/v1/assessment/proctor-monitoring');
        const res = new MockServerResponse(req);

        await handleProctorMonitoringGet(req, res, {
            pool,
            getProctorMonitoringContext: () => {
                throw new Error('Unexpected context extraction failure');
            }
        });

        assert.equal(res.statusCode, 500);
        const body = JSON.parse(res.body);
        assert.deepEqual(body, { error: 'internal_error' });
    });

    await t.test('3. invalid context (non-UUID tenant or person) -> fail closed (403 forbidden)', async () => {
        const { pool } = createMockPool();

        // Non-UUID tenantId
        const req1 = new MockIncomingMessage('GET', '/api/v1/assessment/proctor-monitoring');
        const res1 = new MockServerResponse(req1);
        await handleProctorMonitoringGet(req1, res1, {
            pool,
            getProctorMonitoringContext: () => ({ tenantId: 'not-a-uuid', personId: VALID_PERSON_ID })
        });
        assert.equal(res1.statusCode, 403);
        assert.deepEqual(JSON.parse(res1.body), { error: 'forbidden' });

        // Non-UUID personId
        const req2 = new MockIncomingMessage('GET', '/api/v1/assessment/proctor-monitoring');
        const res2 = new MockServerResponse(req2);
        await handleProctorMonitoringGet(req2, res2, {
            pool,
            getProctorMonitoringContext: () => ({ tenantId: VALID_TENANT_ID, personId: 'invalid-person' })
        });
        assert.equal(res2.statusCode, 403);
        assert.deepEqual(JSON.parse(res2.body), { error: 'forbidden' });
    });

    await t.test('4. non-GET method rejected (405 method_not_allowed)', async () => {
        const { pool } = createMockPool();
        for (const method of ['POST', 'PUT', 'DELETE', 'PATCH']) {
            const req = new MockIncomingMessage(method, '/api/v1/assessment/proctor-monitoring');
            const res = new MockServerResponse(req);

            await handleProctorMonitoringGet(req, res, {
                pool,
                getProctorMonitoringContext: () => ({ tenantId: VALID_TENANT_ID, personId: VALID_PERSON_ID })
            });

            assert.equal(res.statusCode, 405);
            const body = JSON.parse(res.body);
            assert.deepEqual(body, { error: 'method_not_allowed' });
        }
    });

    await t.test('5. persistence unavailable (connect throws) -> bounded failure (503)', async () => {
        const { pool } = createMockPool({ connectThrows: true });
        const req = new MockIncomingMessage('GET', '/api/v1/assessment/proctor-monitoring');
        const res = new MockServerResponse(req);

        await handleProctorMonitoringGet(req, res, {
            pool,
            getProctorMonitoringContext: () => ({ tenantId: VALID_TENANT_ID, personId: VALID_PERSON_ID })
        });

        assert.equal(res.statusCode, 503);
        const body = JSON.parse(res.body);
        assert.deepEqual(body, { error: 'persistence_unavailable' });
    });

    await t.test('6. persistence unavailable (query throws) -> bounded failure (503)', async () => {
        const { pool, mockClient } = createMockPool({ queryThrows: true });
        const req = new MockIncomingMessage('GET', '/api/v1/assessment/proctor-monitoring');
        const res = new MockServerResponse(req);

        await handleProctorMonitoringGet(req, res, {
            pool,
            getProctorMonitoringContext: () => ({ tenantId: VALID_TENANT_ID, personId: VALID_PERSON_ID })
        });

        assert.equal(res.statusCode, 503);
        const body = JSON.parse(res.body);
        assert.deepEqual(body, { error: 'persistence_unavailable' });
        assert.equal(mockClient.released, true);
    });

    await t.test('7. authorized empty monitoring response remains representable', async () => {
        const { pool, mockClient } = createMockPool({ rows: [] });
        const req = new MockIncomingMessage('GET', '/api/v1/assessment/proctor-monitoring');
        const res = new MockServerResponse(req);

        await handleProctorMonitoringGet(req, res, {
            pool,
            getProctorMonitoringContext: () => ({ tenantId: VALID_TENANT_ID, personId: VALID_PERSON_ID })
        });

        assert.equal(res.statusCode, 200);
        assert.equal(res.headers['Content-Type'], 'application/json');
        const body: ProctorMonitoringResponse = JSON.parse(res.body);
        assert.deepEqual(body, { assignments: [] });
        assert.equal(mockClient.released, true);
    });

    await t.test('8. returned monitoring response does not expose participant Person PII', async () => {
        const { pool } = createMockPool({
            rows: [
                {
                    exam_instance_id: VALID_EXAM_ID,
                    subject_label: 'Matematika Dasar',
                    room_id: VALID_ROOM_ID_1,
                    room_label: 'Ruang Lab Komputer 1',
                    participant_count: '25',
                    active_session_count: '20'
                },
                {
                    exam_instance_id: VALID_EXAM_ID,
                    subject_label: 'Matematika Dasar',
                    room_id: VALID_ROOM_ID_2,
                    room_label: 'Ruang Lab Komputer 2',
                    participant_count: '15',
                    active_session_count: '0'
                }
            ]
        });

        const req = new MockIncomingMessage('GET', '/api/v1/assessment/proctor-monitoring');
        const res = new MockServerResponse(req);

        await handleProctorMonitoringGet(req, res, {
            pool,
            getProctorMonitoringContext: () => ({ tenantId: VALID_TENANT_ID, personId: VALID_PERSON_ID })
        });

        assert.equal(res.statusCode, 200);
        const body: ProctorMonitoringResponse = JSON.parse(res.body);
        assert.equal(body.assignments.length, 1);
        assert.equal(body.assignments[0].examInstanceId, VALID_EXAM_ID);
        assert.equal(body.assignments[0].subjectLabel, 'Matematika Dasar');
        assert.equal(body.assignments[0].rooms.length, 2);

        const r1 = body.assignments[0].rooms[0];
        assert.equal(r1.roomId, VALID_ROOM_ID_1);
        assert.equal(r1.roomLabel, 'Ruang Lab Komputer 1');
        assert.equal(r1.participantCount, 25);
        assert.equal(r1.activeSessionCount, 20);

        const r2 = body.assignments[0].rooms[1];
        assert.equal(r2.roomId, VALID_ROOM_ID_2);
        assert.equal(r2.roomLabel, 'Ruang Lab Komputer 2');
        assert.equal(r2.participantCount, 15);
        assert.equal(r2.activeSessionCount, 0);

        // Explicit PII checks: ensure NO participant names, person IDs, NISN, or student attributes
        const rawJson = res.body;
        const forbiddenPiiTerms = [
            'student', 'participant_name', 'person_name', 'nisn', 'email', 'phone',
            'first_name', 'last_name', 'birth', 'gender'
        ];
        for (const term of forbiddenPiiTerms) {
            assert.equal(rawJson.toLowerCase().includes(`"${term}"`), false, `Must not contain PII property ${term}`);
        }
    });

    await t.test('9. server route composition: GET /api/v1/assessment/proctor-monitoring', async () => {
        const { pool } = createMockPool({
            rows: [
                {
                    exam_instance_id: VALID_EXAM_ID,
                    subject_label: 'Fisika',
                    room_id: VALID_ROOM_ID_1,
                    room_label: 'Ruang 101',
                    participant_count: '10',
                    active_session_count: '8'
                }
            ]
        });

        let currentContext: ProctorMonitoringContext | null = {
            tenantId: VALID_TENANT_ID,
            personId: VALID_PERSON_ID
        };

        const server = createServer({
            checkReadiness: async () => true,
            pool,
            getAuthorizedContext: () => null,
            getAssignedExamDiscoveryContext: () => currentContext
        });

        await new Promise<void>((resolve, reject) => {
            server.once('listening', resolve);
            server.once('error', reject);
            server.listen(0);
        });

        const port = (server.address() as any).port;
        const baseUrl = `http://127.0.0.1:${port}`;

        try {
            // Authorized GET
            const resAuth = await fetch(`${baseUrl}/api/v1/assessment/proctor-monitoring`);
            assert.equal(resAuth.status, 200);
            const dataAuth = await resAuth.json();
            assert.equal(dataAuth.assignments.length, 1);
            assert.equal(dataAuth.assignments[0].subjectLabel, 'Fisika');

            // Missing context GET -> 403
            currentContext = null;
            const resUnauth = await fetch(`${baseUrl}/api/v1/assessment/proctor-monitoring`);
            assert.equal(resUnauth.status, 403);
            const dataUnauth = await resUnauth.json();
            assert.deepEqual(dataUnauth, { error: 'forbidden' });

            // Method Not Allowed -> 405
            const resPost = await fetch(`${baseUrl}/api/v1/assessment/proctor-monitoring`, {
                method: 'POST',
                body: JSON.stringify({})
            });
            assert.equal(resPost.status, 405);
            const dataPost = await resPost.json();
            assert.deepEqual(dataPost, { error: 'method_not_allowed' });

            // Unrelated route unaffected: /healthz
            const resHealth = await fetch(`${baseUrl}/healthz`);
            assert.equal(resHealth.status, 200);
            assert.deepEqual(await resHealth.json(), { status: 'alive' });

            // Unrelated route unaffected: /readyz
            const resReady = await fetch(`${baseUrl}/readyz`);
            assert.equal(resReady.status, 200);
            assert.deepEqual(await resReady.json(), { status: 'ready' });

            // Unrelated unknown route -> 404
            const resUnknown = await fetch(`${baseUrl}/api/v1/assessment/proctor-nonexistent`);
            assert.equal(resUnknown.status, 404);
        } finally {
            await new Promise<void>((resolve) => server.close(() => resolve()));
        }
    });

});
