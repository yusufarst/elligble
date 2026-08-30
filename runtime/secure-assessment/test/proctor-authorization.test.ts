import { test } from 'node:test';
import * as assert from 'node:assert';
// @ts-ignore
import type { Pool } from 'pg';
import { authorizeExplicitProctorAssignment } from '../src/proctor-authorization.ts';

test('authorizeExplicitProctorAssignment', async (t) => {
    await t.test('1. active exact assignment -> authorized', async () => {
        const pool = {
            query: async (query: string, values: any[]) => {
                return { rows: [{ id: 'assign-1' }] };
            }
        } as unknown as Pool;

        const res = await authorizeExplicitProctorAssignment(pool, {
            tenantId: 't1',
            examInstanceId: 'e1',
            personId: 'p1'
        });

        assert.strictEqual(res.status, 'authorized');
        if (res.status === 'authorized') {
            assert.strictEqual(res.context.tenantId, 't1', '2. authorized result contains exact tenantId');
            assert.strictEqual(res.context.examInstanceId, 'e1', '3. authorized result contains exact examInstanceId');
            assert.strictEqual(res.context.personId, 'p1', '4. authorized result contains exact personId');
            assert.strictEqual(res.context.proctorAssignmentId, 'assign-1', '5. authorized result contains assignment ID');
        }
    });

    await t.test('6. revoked assignment -> denied', async () => {
        const pool = {
            query: async (query: string, values: any[]) => {
                // Returns empty rows because query expects revoked_at IS NULL
                return { rows: [] };
            }
        } as unknown as Pool;

        const res = await authorizeExplicitProctorAssignment(pool, {
            tenantId: 't1',
            examInstanceId: 'e1',
            personId: 'p1'
        });

        assert.strictEqual(res.status, 'denied');
    });

    await t.test('7. no assignment -> denied', async () => {
        const pool = {
            query: async (query: string, values: any[]) => {
                return { rows: [] };
            }
        } as unknown as Pool;

        const res = await authorizeExplicitProctorAssignment(pool, {
            tenantId: 't1',
            examInstanceId: 'e1',
            personId: 'p1'
        });

        assert.strictEqual(res.status, 'denied');
    });

    await t.test('8. wrong person -> denied', async () => {
        const pool = {
            query: async (query: string, values: any[]) => {
                // Assuming DB returns empty for wrong person
                return { rows: [] };
            }
        } as unknown as Pool;

        const res = await authorizeExplicitProctorAssignment(pool, {
            tenantId: 't1',
            examInstanceId: 'e1',
            personId: 'p-wrong'
        });

        assert.strictEqual(res.status, 'denied');
    });

    await t.test('9. wrong Exam Instance -> denied', async () => {
        const pool = {
            query: async (query: string, values: any[]) => {
                return { rows: [] };
            }
        } as unknown as Pool;

        const res = await authorizeExplicitProctorAssignment(pool, {
            tenantId: 't1',
            examInstanceId: 'e-wrong',
            personId: 'p1'
        });

        assert.strictEqual(res.status, 'denied');
    });

    await t.test('10. wrong tenant -> denied', async () => {
        const pool = {
            query: async (query: string, values: any[]) => {
                return { rows: [] };
            }
        } as unknown as Pool;

        const res = await authorizeExplicitProctorAssignment(pool, {
            tenantId: 't-wrong',
            examInstanceId: 'e1',
            personId: 'p1'
        });

        assert.strictEqual(res.status, 'denied');
    });

    await t.test('11. Teacher/role-like context alone cannot authorize because primitive uses no role fallback', async () => {
        const pool = {
            query: async (query: string, values: any[]) => {
                return { rows: [] }; // The DB doesn't have an explicit proctor assignment row
            }
        } as unknown as Pool;

        // Passing Teacher in input is impossible due to strict typing, but even if the person is a teacher,
        // without a DB row, they are denied.
        const res = await authorizeExplicitProctorAssignment(pool, {
            tenantId: 't1',
            examInstanceId: 'e1',
            personId: 'teacher-p1'
        });

        assert.strictEqual(res.status, 'denied');
    });

    await t.test('12. multiple different active Proctors for one Exam Instance are independently authorized', async () => {
        const pool1 = {
            query: async (query: string, values: any[]) => {
                if (values[2] === 'p1') return { rows: [{ id: 'assign-1' }] };
                return { rows: [] };
            }
        } as unknown as Pool;

        const pool2 = {
            query: async (query: string, values: any[]) => {
                if (values[2] === 'p2') return { rows: [{ id: 'assign-2' }] };
                return { rows: [] };
            }
        } as unknown as Pool;

        const res1 = await authorizeExplicitProctorAssignment(pool1, { tenantId: 't1', examInstanceId: 'e1', personId: 'p1' });
        const res2 = await authorizeExplicitProctorAssignment(pool2, { tenantId: 't1', examInstanceId: 'e1', personId: 'p2' });

        assert.strictEqual(res1.status, 'authorized');
        assert.strictEqual(res2.status, 'authorized');
        if (res1.status === 'authorized' && res2.status === 'authorized') {
            assert.strictEqual(res1.context.proctorAssignmentId, 'assign-1');
            assert.strictEqual(res2.context.proctorAssignmentId, 'assign-2');
        }
    });

    await t.test('13. Person assigned to another Exam Instance does not authorize this Exam Instance', async () => {
        const pool = {
            query: async (query: string, values: any[]) => {
                if (values[1] === 'e2' && values[2] === 'p1') return { rows: [{ id: 'assign-1' }] };
                return { rows: [] };
            }
        } as unknown as Pool;

        const res = await authorizeExplicitProctorAssignment(pool, {
            tenantId: 't1',
            examInstanceId: 'e1', // User requests auth for e1
            personId: 'p1'        // User is only assigned to e2
        });

        assert.strictEqual(res.status, 'denied');
    });

    await t.test('14. prior revoked history plus a new active assignment authorizes only through the current active assignment', async () => {
        const pool = {
            query: async (query: string, values: any[]) => {
                // The DB query explicitly includes "AND revoked_at IS NULL", so it only returns the active one
                return { rows: [{ id: 'active-assign' }] };
            }
        } as unknown as Pool;

        const res = await authorizeExplicitProctorAssignment(pool, {
            tenantId: 't1',
            examInstanceId: 'e1',
            personId: 'p1'
        });

        assert.strictEqual(res.status, 'authorized');
        if (res.status === 'authorized') {
            assert.strictEqual(res.context.proctorAssignmentId, 'active-assign');
        }
    });

    await t.test('15. invalid/missing required scope never authorizes', async () => {
        const pool = {
            query: async (query: string, values: any[]) => {
                return { rows: [{ id: 'assign-1' }] };
            }
        } as unknown as Pool;

        const res1 = await authorizeExplicitProctorAssignment(pool, { tenantId: '', examInstanceId: 'e1', personId: 'p1' });
        const res2 = await authorizeExplicitProctorAssignment(pool, { tenantId: 't1', examInstanceId: '', personId: 'p1' });
        const res3 = await authorizeExplicitProctorAssignment(pool, { tenantId: 't1', examInstanceId: 'e1', personId: '' });

        assert.strictEqual(res1.status, 'denied');
        assert.strictEqual(res2.status, 'denied');
        assert.strictEqual(res3.status, 'denied');
    });

    await t.test('16. database query failure -> authorization_unavailable', async () => {
        const pool = {
            query: async (query: string, values: any[]) => {
                throw new Error('Connection failed');
            }
        } as unknown as Pool;

        const res = await authorizeExplicitProctorAssignment(pool, {
            tenantId: 't1',
            examInstanceId: 'e1',
            personId: 'p1'
        });

        assert.strictEqual(res.status, 'authorization_unavailable');
    });

    await t.test('17. database failure never leaks raw credential/connection material through result', async () => {
        const secretErrorMsg = 'FATAL: password authentication failed for user "postgres"';
        const pool = {
            query: async (query: string, values: any[]) => {
                throw new Error(secretErrorMsg);
            }
        } as unknown as Pool;

        const res = await authorizeExplicitProctorAssignment(pool, {
            tenantId: 't1',
            examInstanceId: 'e1',
            personId: 'p1'
        });

        assert.strictEqual(res.status, 'authorization_unavailable');
        const serialized = JSON.stringify(res);
        assert.strictEqual(serialized.includes('postgres'), false);
        assert.strictEqual(serialized.includes('FATAL'), false);
    });
});
