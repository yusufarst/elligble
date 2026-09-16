import { test } from 'node:test';
import * as assert from 'node:assert/strict';
import * as http from 'node:http';
import { handleAssignedExamsGet, type AssignedExamDiscoveryContext, type AssignedExamsDependencies } from '../src/assigned-exams.ts';

const VALID_TENANT_ID = '11111111-1111-4111-8111-111111111111';
const VALID_PERSON_ID = '22222222-2222-4222-8222-222222222222';
const VALID_INSTANCE_ID_1 = '33333333-3333-4333-8333-333333333333';
const VALID_INSTANCE_ID_2 = '44444444-4444-4444-8444-444444444444';
const VALID_ATTEMPT_ID_1 = '55555555-5555-4555-8555-555555555555';
const VALID_ATTEMPT_ID_2 = '66666666-6666-4666-8666-666666666666';

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

test('BU-085 assigned-exams runtime handler tests', async (t) => {

    await t.test('1. GET accepted and returns assignments with correct headers', async () => {
        const { pool, mockClient } = createMockPool({
            rows: [
                {
                    participant_id: 'p-1',
                    exam_instance_id: VALID_INSTANCE_ID_1,
                    subject_label: 'Matematika',
                    room_label: 'Lab 1',
                    attempt_id: VALID_ATTEMPT_ID_1,
                    submitted_at: null
                }
            ]
        });

        const req = new MockIncomingMessage('GET', '/api/v1/assessment/assigned-exams');
        const res = new MockServerResponse(req);

        await handleAssignedExamsGet(req, res, {
            pool,
            getAssignedExamDiscoveryContext: () => ({
                tenantId: VALID_TENANT_ID,
                personId: VALID_PERSON_ID
            })
        });

        assert.equal(res.statusCode, 200);
        assert.equal(res.headers['Content-Type'], 'application/json');
        const data = JSON.parse(res.body);
        assert.deepEqual(data, {
            assignments: [
                {
                    examInstanceId: VALID_INSTANCE_ID_1,
                    subjectLabel: 'Matematika',
                    roomLabel: 'Lab 1',
                    attempts: [
                        {
                            attemptId: VALID_ATTEMPT_ID_1,
                            submittedAt: null
                        }
                    ]
                }
            ]
        });
        assert.equal(mockClient.released, true);
    });

    await t.test('2. non-GET rejected with 405 method_not_allowed', async () => {
        for (const method of ['POST', 'PUT', 'DELETE', 'PATCH']) {
            const { pool } = createMockPool();
            const req = new MockIncomingMessage(method, '/api/v1/assessment/assigned-exams');
            const res = new MockServerResponse(req);

            await handleAssignedExamsGet(req, res, {
                pool,
                getAssignedExamDiscoveryContext: () => ({
                    tenantId: VALID_TENANT_ID,
                    personId: VALID_PERSON_ID
                })
            });

            assert.equal(res.statusCode, 405, `Expected 405 for ${method}`);
            const data = JSON.parse(res.body);
            assert.deepEqual(data, { error: 'method_not_allowed' });
        }
    });

    await t.test('3. missing discovery context -> 403 forbidden', async () => {
        const { pool } = createMockPool();
        const req = new MockIncomingMessage('GET', '/api/v1/assessment/assigned-exams');
        const res = new MockServerResponse(req);

        await handleAssignedExamsGet(req, res, {
            pool,
            getAssignedExamDiscoveryContext: () => null
        });

        assert.equal(res.statusCode, 403);
        const data = JSON.parse(res.body);
        assert.deepEqual(data, { error: 'forbidden' });
    });

    await t.test('3b. invalid UUID in discovery context -> 403 forbidden', async () => {
        const { pool } = createMockPool();
        const req = new MockIncomingMessage('GET', '/api/v1/assessment/assigned-exams');
        const res = new MockServerResponse(req);

        await handleAssignedExamsGet(req, res, {
            pool,
            getAssignedExamDiscoveryContext: () => ({
                tenantId: 'invalid-uuid',
                personId: VALID_PERSON_ID
            })
        });

        assert.equal(res.statusCode, 403);
        const data = JSON.parse(res.body);
        assert.deepEqual(data, { error: 'forbidden' });
    });

    await t.test('4. context resolver failure -> safe 500 internal_error', async () => {
        const { pool } = createMockPool();
        const req = new MockIncomingMessage('GET', '/api/v1/assessment/assigned-exams');
        const res = new MockServerResponse(req);

        await handleAssignedExamsGet(req, res, {
            pool,
            getAssignedExamDiscoveryContext: () => {
                throw new Error('Token verification failed');
            }
        });

        assert.equal(res.statusCode, 500);
        const data = JSON.parse(res.body);
        assert.deepEqual(data, { error: 'internal_error' });
    });

    await t.test('5. DB connection failure -> 503 persistence_unavailable', async () => {
        const { pool } = createMockPool({ connectThrows: true });
        const req = new MockIncomingMessage('GET', '/api/v1/assessment/assigned-exams');
        const res = new MockServerResponse(req);

        await handleAssignedExamsGet(req, res, {
            pool,
            getAssignedExamDiscoveryContext: () => ({
                tenantId: VALID_TENANT_ID,
                personId: VALID_PERSON_ID
            })
        });

        assert.equal(res.statusCode, 503);
        const data = JSON.parse(res.body);
        assert.deepEqual(data, { error: 'persistence_unavailable' });
    });

    await t.test('5b. DB query failure -> 503 persistence_unavailable and rollback', async () => {
        const { pool, mockClient } = createMockPool({ queryThrows: true });
        const req = new MockIncomingMessage('GET', '/api/v1/assessment/assigned-exams');
        const res = new MockServerResponse(req);

        await handleAssignedExamsGet(req, res, {
            pool,
            getAssignedExamDiscoveryContext: () => ({
                tenantId: VALID_TENANT_ID,
                personId: VALID_PERSON_ID
            })
        });

        assert.equal(res.statusCode, 503);
        const data = JSON.parse(res.body);
        assert.deepEqual(data, { error: 'persistence_unavailable' });
        assert.ok(mockClient.queries.some(q => q.text.includes('ROLLBACK')));
        assert.equal(mockClient.released, true);
    });

    await t.test('6. zero assignments -> []', async () => {
        const { pool } = createMockPool({ rows: [] });
        const req = new MockIncomingMessage('GET', '/api/v1/assessment/assigned-exams');
        const res = new MockServerResponse(req);

        await handleAssignedExamsGet(req, res, {
            pool,
            getAssignedExamDiscoveryContext: () => ({
                tenantId: VALID_TENANT_ID,
                personId: VALID_PERSON_ID
            })
        });

        assert.equal(res.statusCode, 200);
        const data = JSON.parse(res.body);
        assert.deepEqual(data, { assignments: [] });
    });

    await t.test('7. assignment with zero attempts remains visible with attempts: []', async () => {
        const { pool } = createMockPool({
            rows: [
                {
                    participant_id: 'p-1',
                    exam_instance_id: VALID_INSTANCE_ID_1,
                    subject_label: 'Bahasa Indonesia',
                    room_label: null,
                    attempt_id: null,
                    submitted_at: null
                }
            ]
        });

        const req = new MockIncomingMessage('GET', '/api/v1/assessment/assigned-exams');
        const res = new MockServerResponse(req);

        await handleAssignedExamsGet(req, res, {
            pool,
            getAssignedExamDiscoveryContext: () => ({
                tenantId: VALID_TENANT_ID,
                personId: VALID_PERSON_ID
            })
        });

        assert.equal(res.statusCode, 200);
        const data = JSON.parse(res.body);
        assert.deepEqual(data, {
            assignments: [
                {
                    examInstanceId: VALID_INSTANCE_ID_1,
                    subjectLabel: 'Bahasa Indonesia',
                    roomLabel: null,
                    attempts: []
                }
            ]
        });
    });

    await t.test('8. one attempt preserved', async () => {
        const { pool } = createMockPool({
            rows: [
                {
                    participant_id: 'p-1',
                    exam_instance_id: VALID_INSTANCE_ID_1,
                    subject_label: 'Fisika',
                    room_label: 'Ruang 101',
                    attempt_id: VALID_ATTEMPT_ID_1,
                    submitted_at: null
                }
            ]
        });

        const req = new MockIncomingMessage('GET', '/api/v1/assessment/assigned-exams');
        const res = new MockServerResponse(req);

        await handleAssignedExamsGet(req, res, {
            pool,
            getAssignedExamDiscoveryContext: () => ({
                tenantId: VALID_TENANT_ID,
                personId: VALID_PERSON_ID
            })
        });

        assert.equal(res.statusCode, 200);
        const data = JSON.parse(res.body);
        assert.equal(data.assignments.length, 1);
        assert.equal(data.assignments[0].attempts.length, 1);
        assert.equal(data.assignments[0].attempts[0].attemptId, VALID_ATTEMPT_ID_1);
        assert.equal(data.assignments[0].attempts[0].submittedAt, null);
    });

    await t.test('9. multiple attempts remain distinct and not collapsed', async () => {
        const { pool } = createMockPool({
            rows: [
                {
                    participant_id: 'p-1',
                    exam_instance_id: VALID_INSTANCE_ID_1,
                    subject_label: 'Kimia',
                    room_label: 'Lab Kimia',
                    attempt_id: VALID_ATTEMPT_ID_1,
                    submitted_at: new Date('2026-09-16T08:00:00.000Z')
                },
                {
                    participant_id: 'p-1',
                    exam_instance_id: VALID_INSTANCE_ID_1,
                    subject_label: 'Kimia',
                    room_label: 'Lab Kimia',
                    attempt_id: VALID_ATTEMPT_ID_2,
                    submitted_at: null
                }
            ]
        });

        const req = new MockIncomingMessage('GET', '/api/v1/assessment/assigned-exams');
        const res = new MockServerResponse(req);

        await handleAssignedExamsGet(req, res, {
            pool,
            getAssignedExamDiscoveryContext: () => ({
                tenantId: VALID_TENANT_ID,
                personId: VALID_PERSON_ID
            })
        });

        assert.equal(res.statusCode, 200);
        const data = JSON.parse(res.body);
        assert.equal(data.assignments.length, 1);
        assert.equal(data.assignments[0].attempts.length, 2);
        assert.equal(data.assignments[0].attempts[0].attemptId, VALID_ATTEMPT_ID_1);
        assert.equal(data.assignments[0].attempts[0].submittedAt, '2026-09-16T08:00:00.000Z');
        assert.equal(data.assignments[0].attempts[1].attemptId, VALID_ATTEMPT_ID_2);
        assert.equal(data.assignments[0].attempts[1].submittedAt, null);
    });

    await t.test('10. submitted attempt exposes submittedAt ISO string and remains distinct', async () => {
        const submittedDate = new Date('2026-09-16T09:00:00.000Z');
        const { pool } = createMockPool({
            rows: [
                {
                    participant_id: 'p-1',
                    exam_instance_id: VALID_INSTANCE_ID_1,
                    subject_label: 'Biologi',
                    room_label: 'Lab Biologi',
                    attempt_id: VALID_ATTEMPT_ID_1,
                    submitted_at: submittedDate
                }
            ]
        });

        const req = new MockIncomingMessage('GET', '/api/v1/assessment/assigned-exams');
        const res = new MockServerResponse(req);

        await handleAssignedExamsGet(req, res, {
            pool,
            getAssignedExamDiscoveryContext: () => ({
                tenantId: VALID_TENANT_ID,
                personId: VALID_PERSON_ID
            })
        });

        assert.equal(res.statusCode, 200);
        const data = JSON.parse(res.body);
        assert.equal(data.assignments[0].attempts[0].submittedAt, '2026-09-16T09:00:00.000Z');
    });

    await t.test('11. tenantId + personId are used as authoritative query filters', async () => {
        const { pool, mockClient } = createMockPool({ rows: [] });
        const req = new MockIncomingMessage('GET', '/api/v1/assessment/assigned-exams');
        const res = new MockServerResponse(req);

        await handleAssignedExamsGet(req, res, {
            pool,
            getAssignedExamDiscoveryContext: () => ({
                tenantId: VALID_TENANT_ID,
                personId: VALID_PERSON_ID
            })
        });

        const selectQuery = mockClient.queries.find(q => q.text.includes('SELECT'));
        assert.ok(selectQuery, 'SELECT query must be executed');
        assert.deepEqual(selectQuery.values, [VALID_TENANT_ID, VALID_PERSON_ID]);
    });

    await t.test('12. no tenant/person values accepted from request input (query or headers)', async () => {
        const { pool, mockClient } = createMockPool({ rows: [] });
        const req = new MockIncomingMessage(
            'GET',
            '/api/v1/assessment/assigned-exams?tenantId=99999999-9999-4999-8999-999999999999&personId=88888888-8888-4888-8888-888888888888',
            {
                'x-tenant-id': '99999999-9999-4999-8999-999999999999',
                'x-person-id': '88888888-8888-4888-8888-888888888888'
            }
        );
        const res = new MockServerResponse(req);

        await handleAssignedExamsGet(req, res, {
            pool,
            getAssignedExamDiscoveryContext: () => ({
                tenantId: VALID_TENANT_ID,
                personId: VALID_PERSON_ID
            })
        });

        const selectQuery = mockClient.queries.find(q => q.text.includes('SELECT'));
        assert.ok(selectQuery);
        // Query must strictly use injected context values, never request values!
        assert.deepEqual(selectQuery.values, [VALID_TENANT_ID, VALID_PERSON_ID]);
    });
});
