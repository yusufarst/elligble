import { test } from 'node:test';
import * as assert from 'node:assert/strict';
import * as http from 'node:http';
import {
    handleTeacherReadinessGet,
    type TeacherReadinessContext,
    type TeacherReadinessDependencies,
    type TeacherReadinessResponse
} from '../src/teacher-readiness.ts';
import { createServer } from '../src/server.ts';

const VALID_TENANT_ID = '11111111-1111-4111-8111-111111111111';
const VALID_PERSON_ID = '22222222-2222-4222-8222-222222222222';
const VALID_EXAM_ID_1 = '33333333-3333-4333-8333-333333333333';
const VALID_EXAM_ID_2 = '44444444-4444-4444-8444-444444444444';

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
            if (text.includes('SELECT') && text.includes('tenant_teacher_assignments')) {
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

test('BU-087 teacher-readiness focused runtime/API tests', async (t) => {

    await t.test('1. missing context -> fail closed (403 forbidden)', async () => {
        const { pool } = createMockPool();
        const req = new MockIncomingMessage('GET', '/api/v1/assessment/teacher-readiness');
        const res = new MockServerResponse(req);

        await handleTeacherReadinessGet(req, res, {
            pool,
            getTeacherReadinessContext: () => null
        });

        assert.equal(res.statusCode, 403);
        const body = JSON.parse(res.body);
        assert.deepEqual(body, { error: 'forbidden' });
    });

    await t.test('2. context provider throwing -> bounded 500 internal_error', async () => {
        const { pool } = createMockPool();
        const req = new MockIncomingMessage('GET', '/api/v1/assessment/teacher-readiness');
        const res = new MockServerResponse(req);

        await handleTeacherReadinessGet(req, res, {
            pool,
            getTeacherReadinessContext: () => {
                throw new Error('Unexpected context extraction failure');
            }
        });

        assert.equal(res.statusCode, 500);
        const body = JSON.parse(res.body);
        assert.deepEqual(body, { error: 'internal_error' });
    });

    await t.test('3. invalid context (non-UUID tenant or person) -> fail closed (403 forbidden)', async () => {
        const { pool } = createMockPool();

        const req1 = new MockIncomingMessage('GET', '/api/v1/assessment/teacher-readiness');
        const res1 = new MockServerResponse(req1);
        await handleTeacherReadinessGet(req1, res1, {
            pool,
            getTeacherReadinessContext: () => ({ tenantId: 'not-a-uuid', personId: VALID_PERSON_ID })
        });
        assert.equal(res1.statusCode, 403);
        assert.deepEqual(JSON.parse(res1.body), { error: 'forbidden' });

        const req2 = new MockIncomingMessage('GET', '/api/v1/assessment/teacher-readiness');
        const res2 = new MockServerResponse(req2);
        await handleTeacherReadinessGet(req2, res2, {
            pool,
            getTeacherReadinessContext: () => ({ tenantId: VALID_TENANT_ID, personId: 'invalid-person' })
        });
        assert.equal(res2.statusCode, 403);
        assert.deepEqual(JSON.parse(res2.body), { error: 'forbidden' });
    });

    await t.test('4. non-GET method rejected (405 method_not_allowed)', async () => {
        const { pool } = createMockPool();
        for (const method of ['POST', 'PUT', 'DELETE', 'PATCH']) {
            const req = new MockIncomingMessage(method, '/api/v1/assessment/teacher-readiness');
            const res = new MockServerResponse(req);

            await handleTeacherReadinessGet(req, res, {
                pool,
                getTeacherReadinessContext: () => ({ tenantId: VALID_TENANT_ID, personId: VALID_PERSON_ID })
            });

            assert.equal(res.statusCode, 405);
            const body = JSON.parse(res.body);
            assert.deepEqual(body, { error: 'method_not_allowed' });
        }
    });

    await t.test('5. persistence unavailable (connect throws) -> bounded failure (503)', async () => {
        const { pool } = createMockPool({ connectThrows: true });
        const req = new MockIncomingMessage('GET', '/api/v1/assessment/teacher-readiness');
        const res = new MockServerResponse(req);

        await handleTeacherReadinessGet(req, res, {
            pool,
            getTeacherReadinessContext: () => ({ tenantId: VALID_TENANT_ID, personId: VALID_PERSON_ID })
        });

        assert.equal(res.statusCode, 503);
        const body = JSON.parse(res.body);
        assert.deepEqual(body, { error: 'persistence_unavailable' });
    });

    await t.test('6. persistence unavailable (query throws) -> bounded failure (503)', async () => {
        const { pool, mockClient } = createMockPool({ queryThrows: true });
        const req = new MockIncomingMessage('GET', '/api/v1/assessment/teacher-readiness');
        const res = new MockServerResponse(req);

        await handleTeacherReadinessGet(req, res, {
            pool,
            getTeacherReadinessContext: () => ({ tenantId: VALID_TENANT_ID, personId: VALID_PERSON_ID })
        });

        assert.equal(res.statusCode, 503);
        const body = JSON.parse(res.body);
        assert.deepEqual(body, { error: 'persistence_unavailable' });
        assert.equal(mockClient.released, true);
    });

    await t.test('7. valid Teacher with zero scheduled exams returns empty result', async () => {
        const { pool, mockClient } = createMockPool({ rows: [] });
        const req = new MockIncomingMessage('GET', '/api/v1/assessment/teacher-readiness');
        const res = new MockServerResponse(req);

        await handleTeacherReadinessGet(req, res, {
            pool,
            getTeacherReadinessContext: () => ({ tenantId: VALID_TENANT_ID, personId: VALID_PERSON_ID })
        });

        assert.equal(res.statusCode, 200);
        assert.equal(res.headers['Content-Type'], 'application/json');
        const body: TeacherReadinessResponse = JSON.parse(res.body);
        assert.deepEqual(body, { exams: [] });
        assert.equal(mockClient.released, true);
    });

    await t.test('8. one scheduled exam successfully projected without PII', async () => {
        const { pool } = createMockPool({
            rows: [
                {
                    exam_instance_id: VALID_EXAM_ID_1,
                    subject_label: 'Matematika Dasar'
                }
            ]
        });

        const req = new MockIncomingMessage('GET', '/api/v1/assessment/teacher-readiness');
        const res = new MockServerResponse(req);

        await handleTeacherReadinessGet(req, res, {
            pool,
            getTeacherReadinessContext: () => ({ tenantId: VALID_TENANT_ID, personId: VALID_PERSON_ID })
        });

        assert.equal(res.statusCode, 200);
        const body: TeacherReadinessResponse = JSON.parse(res.body);
        assert.equal(body.exams.length, 1);
        assert.equal(body.exams[0].examInstanceId, VALID_EXAM_ID_1);
        assert.equal(body.exams[0].subjectLabel, 'Matematika Dasar');

        // Due to mocked subsequent queries returning empty, we expect 'denied' from preflights
        // This confirms the preflight composition is called and its result stored
        assert.equal(body.exams[0].baseline.type, 'denied');
        assert.equal(body.exams[0].roomProctor.type, 'denied');

        const rawJson = res.body;
        const forbiddenPiiTerms = [
            'student', 'participant_name', 'person_name', 'nisn', 'email', 'phone',
            'first_name', 'last_name', 'birth', 'gender'
        ];
        for (const term of forbiddenPiiTerms) {
            assert.equal(rawJson.toLowerCase().includes(`"${term}"`), false, `Must not contain PII property ${term}`);
        }
    });

    await t.test('9. server route composition: GET /api/v1/assessment/teacher-readiness', async () => {
        const { pool } = createMockPool({
            rows: [
                {
                    exam_instance_id: VALID_EXAM_ID_1,
                    subject_label: 'Fisika'
                },
                {
                    exam_instance_id: VALID_EXAM_ID_2,
                    subject_label: 'Kimia'
                }
            ]
        });

        let currentContext: TeacherReadinessContext | null = {
            tenantId: VALID_TENANT_ID,
            personId: VALID_PERSON_ID
        };

        const server = createServer({
            checkReadiness: async () => true,
            pool,
            getAuthorizedContext: () => null,
            getTeacherReadinessContext: () => currentContext
        });

        await new Promise<void>((resolve, reject) => {
            server.once('listening', resolve);
            server.once('error', reject);
            server.listen(0);
        });

        const port = (server.address() as any).port;
        const baseUrl = `http://127.0.0.1:${port}`;

        try {
            const resAuth = await fetch(`${baseUrl}/api/v1/assessment/teacher-readiness`);
            assert.equal(resAuth.status, 200);
            const dataAuth = await resAuth.json();
            assert.equal(dataAuth.exams.length, 2);
            assert.equal(dataAuth.exams[0].subjectLabel, 'Fisika');
            assert.equal(dataAuth.exams[1].subjectLabel, 'Kimia');

            currentContext = null;
            const resUnauth = await fetch(`${baseUrl}/api/v1/assessment/teacher-readiness`);
            assert.equal(resUnauth.status, 403);
            const dataUnauth = await resUnauth.json();
            assert.deepEqual(dataUnauth, { error: 'forbidden' });

            const resPost = await fetch(`${baseUrl}/api/v1/assessment/teacher-readiness`, {
                method: 'POST',
                body: JSON.stringify({})
            });
            assert.equal(resPost.status, 405);
            const dataPost = await resPost.json();
            assert.deepEqual(dataPost, { error: 'method_not_allowed' });

        } finally {
            await new Promise<void>((resolve) => server.close(() => resolve()));
        }
    });
});
