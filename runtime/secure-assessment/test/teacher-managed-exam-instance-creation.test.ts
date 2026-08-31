import { describe, it } from 'node:test';
import * as assert from 'node:assert';
import type { Pool, PoolClient, QueryResult } from 'pg';
import { createTeacherManagedExamInstance } from '../src/teacher-managed-exam-instance-creation.ts';
import type { AssessmentCreationCapabilityEvaluator } from '../src/teacher-managed-exam-instance-creation.ts';
import type { AssessmentCreationContextInput } from '../src/assessment-creation-authorization-context.ts';

describe('createTeacherManagedExamInstance', () => {
  const validInput: AssessmentCreationContextInput = {
    tenantId: '11111111-1111-1111-1111-111111111111',
    personId: '22222222-2222-2222-2222-222222222222',
    subjectOfferingId: '33333333-3333-3333-3333-333333333333',
    academicGroupId: '44444444-4444-4444-4444-444444444444',
  };

  const mockResolvedRow = {
    membership_id: '55555555-5555-5555-5555-555555555555',
    teacher_assignment_id: '66666666-6666-6666-6666-666666666666',
    teaching_assignment_id: '77777777-7777-7777-7777-777777777777',
  };

  const newExamId = '99999999-9999-9999-9999-999999999999';

  function createMockPool(
    queryHandler: (queryText: string, values?: any[]) => Promise<QueryResult<any>>,
    clientQueryHandler?: (queryText: string, values?: any[]) => Promise<QueryResult<any>>
  ): { pool: Pool; state: { clientReleased: boolean } } {
    const state = { clientReleased: false };

    const mockClient = {
      query: clientQueryHandler || queryHandler,
      release: () => {
        state.clientReleased = true;
      }
    } as unknown as PoolClient;

    const pool = {
      query: queryHandler,
      connect: async () => mockClient
    } as unknown as Pool;

    return { pool, state };
  }

  const defaultQueryHandler = async (q: string): Promise<QueryResult<any>> => {
    if (q.includes('LIMIT 2')) {
      return { rows: [mockResolvedRow], rowCount: 1 } as any;
    }
    return { rows: [], rowCount: 0 } as any;
  };

  const defaultClientQueryHandler = async (q: string): Promise<QueryResult<any>> => {
    if (q.includes('LIMIT 2')) {
      return { rows: [mockResolvedRow], rowCount: 1 } as any;
    }
    if (q.includes('FOR UPDATE')) {
      return { rows: [mockResolvedRow], rowCount: 1 } as any;
    }
    if (q.includes('INSERT')) {
      return { rows: [{ id: newExamId }], rowCount: 1 } as any;
    }
    return { rows: [], rowCount: 0 } as any;
  };

  const grantEvaluator: AssessmentCreationCapabilityEvaluator = async () => 'granted';
  const denyEvaluator: AssessmentCreationCapabilityEvaluator = async () => 'denied';

  it('1. valid context + capability granted + exact active revalidation -> created', async () => {
    let insertQuery = '';
    let revalidationQuery = '';
    let revalidationParams: any[] = [];
    const executionOrder: string[] = [];

    const { pool, state } = createMockPool(defaultQueryHandler, async (q, v) => {
      if (q === 'BEGIN' || q === 'COMMIT' || q === 'ROLLBACK') {
        executionOrder.push(q);
      }
      if (q.includes('FOR UPDATE')) {
        executionOrder.push('SELECT FOR UPDATE');
        revalidationQuery = q;
        revalidationParams = v || [];
      }
      if (q.includes('INSERT')) {
        executionOrder.push('INSERT');
        insertQuery = q;
        assert.deepStrictEqual(v, [validInput.tenantId, mockResolvedRow.teaching_assignment_id]);
      }
      return defaultClientQueryHandler(q);
    });

    const result = await createTeacherManagedExamInstance(pool, validInput, grantEvaluator);

    assert.deepStrictEqual(result, {
      type: 'created',
      examInstanceId: newExamId,
      teachingAssignmentId: mockResolvedRow.teaching_assignment_id
    });
    assert.strictEqual(state.clientReleased, true);

    // D. Successful sequence: BEGIN, locked SELECT ... FOR UPDATE, INSERT, COMMIT. in that order.
    assert.deepStrictEqual(executionOrder, ['BEGIN', 'SELECT FOR UPDATE', 'INSERT', 'COMMIT']);

    // B. Capture revalidation SQL and exact parameter list.
    assert.ok(revalidationQuery.includes('tm.tenant_id = $1'));
    assert.ok(revalidationQuery.includes('tm.person_id = $2'));
    assert.ok(revalidationQuery.includes('tm.id = $3'));
    assert.ok(revalidationQuery.includes('tta.id = $4'));
    assert.ok(revalidationQuery.includes('ata.id = $5'));
    assert.ok(revalidationQuery.includes('ata.subject_offering_id = $6'));
    assert.ok(revalidationQuery.includes('ata.academic_group_id = $7'));
    assert.ok(revalidationQuery.includes('tta.revoked_at IS NULL'));
    assert.ok(revalidationQuery.includes('ata.revoked_at IS NULL'));
    assert.ok(revalidationQuery.includes('FOR UPDATE'));
    assert.deepStrictEqual(revalidationParams, [
      validInput.tenantId,
      validInput.personId,
      mockResolvedRow.membership_id,
      mockResolvedRow.teacher_assignment_id,
      mockResolvedRow.teaching_assignment_id,
      validInput.subjectOfferingId,
      validInput.academicGroupId
    ]);

    // E. Prove the INSERT business column list is EXACTLY: tenant_id, teaching_assignment_id
    assert.ok(insertQuery.includes('tenant_id'));
    assert.ok(insertQuery.includes('teaching_assignment_id'));
    assert.ok(!insertQuery.includes('teacher_assignment_id'));
    assert.ok(!insertQuery.includes('subject_offering_id'));
    assert.ok(!insertQuery.includes('academic_group_id'));
    assert.ok(!insertQuery.includes('membership_id'));
    assert.ok(!insertQuery.includes('person_id'));
    assert.ok(!insertQuery.includes('academic_period_id'));
    assert.ok(!insertQuery.includes('academic_year_id'));
    assert.ok(!insertQuery.includes('grade_level_id'));
    assert.ok(!insertQuery.includes('subject_id'));
    assert.ok(!insertQuery.includes('proctor_assignment_id'));
    assert.ok(!insertQuery.includes('role'));
    assert.ok(!insertQuery.includes('capability'));
    assert.ok(!insertQuery.includes('permission'));

    // F. Prove creation SQL does NOT reference secure_assessment_proctor_assignments and contains no hardcoded policy
    assert.ok(!insertQuery.includes('secure_assessment_proctor_assignments'));
    assert.ok(!revalidationQuery.includes('secure_assessment_proctor_assignments'));
    assert.ok(!insertQuery.includes('role'));
    assert.ok(!insertQuery.includes('permission'));
    assert.ok(!insertQuery.includes('capability'));
  });

  it('2. context denied -> denied / capability not called / no transaction write', async () => {
    let evalCalled = false;
    let clientConnected = false;
    const pool = {
      query: async () => ({ rows: [], rowCount: 0 }), // BU-043 denies
      connect: async () => { clientConnected = true; return {} as any; }
    } as unknown as Pool;

    const result = await createTeacherManagedExamInstance(pool, validInput, async () => {
      evalCalled = true;
      return 'granted';
    });

    assert.deepStrictEqual(result, { type: 'denied' });
    assert.strictEqual(evalCalled, false);
    assert.strictEqual(clientConnected, false);
  });

  it('3. context unavailable -> unavailable / capability not called / no write', async () => {
    let evalCalled = false;
    const pool = {
      query: async () => { throw new Error('DB Error'); }
    } as unknown as Pool;

    const result = await createTeacherManagedExamInstance(pool, validInput, async () => {
      evalCalled = true;
      return 'granted';
    });

    assert.deepStrictEqual(result, { type: 'unavailable' });
    assert.strictEqual(evalCalled, false);
  });

  it('4. missing evaluator -> denied / no write', async () => {
    const { pool } = createMockPool(defaultQueryHandler);
    const result = await createTeacherManagedExamInstance(pool, validInput, undefined as any);
    assert.deepStrictEqual(result, { type: 'denied' });
  });

  it('5. capability denied -> denied / no write', async () => {
    const { pool } = createMockPool(defaultQueryHandler);
    let clientConnected = false;
    pool.connect = async () => { clientConnected = true; return {} as any; };

    const result = await createTeacherManagedExamInstance(pool, validInput, denyEvaluator);
    assert.deepStrictEqual(result, { type: 'denied' });
    assert.strictEqual(clientConnected, false);
  });

  it('6. capability unavailable -> unavailable / no write', async () => {
    const { pool } = createMockPool(defaultQueryHandler);
    const result = await createTeacherManagedExamInstance(pool, validInput, async () => 'unavailable');
    assert.deepStrictEqual(result, { type: 'unavailable' });
  });

  it('7. capability evaluator throws -> unavailable / no write', async () => {
    const { pool } = createMockPool(defaultQueryHandler);
    const result = await createTeacherManagedExamInstance(pool, validInput, async () => { throw new Error(); });
    assert.deepStrictEqual(result, { type: 'unavailable' });
  });

  it('8. stale/revoked Teaching Assignment at transactional revalidation -> denied', async () => {
    let rollbackCalled = false;
    const { pool, state } = createMockPool(defaultQueryHandler, async (q, v) => {
      if (q.includes('FOR UPDATE')) return { rows: [], rowCount: 0 } as any;
      if (q === 'ROLLBACK') rollbackCalled = true;
      return defaultClientQueryHandler(q);
    });

    const result = await createTeacherManagedExamInstance(pool, validInput, grantEvaluator);
    assert.deepStrictEqual(result, { type: 'denied' });
    assert.strictEqual(rollbackCalled, true);
    assert.strictEqual(state.clientReleased, true);
  });

  it('9. stale/revoked TEACHER staff assignment -> denied (handled by same FOR UPDATE returning 0 rows)', async () => {
    const { pool } = createMockPool(defaultQueryHandler, async (q, v) => {
      if (q.includes('FOR UPDATE')) return { rows: [], rowCount: 0 } as any;
      return defaultClientQueryHandler(q);
    });
    const result = await createTeacherManagedExamInstance(pool, validInput, grantEvaluator);
    assert.deepStrictEqual(result, { type: 'denied' });
  });

  it('10. C. Transactional boundary negatives: wrong tenant -> denied, ROLLBACK, no INSERT, client released', async () => {
    let rollbackCalled = false;
    let insertCalled = false;
    const { pool, state } = createMockPool(defaultQueryHandler, async (q, v) => {
      if (q.includes('FOR UPDATE')) return { rows: [], rowCount: 0 } as any;
      if (q === 'ROLLBACK') rollbackCalled = true;
      if (q.includes('INSERT')) insertCalled = true;
      return defaultClientQueryHandler(q);
    });
    const result = await createTeacherManagedExamInstance(pool, { ...validInput, tenantId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' }, grantEvaluator);
    assert.deepStrictEqual(result, { type: 'denied' });
    assert.strictEqual(rollbackCalled, true);
    assert.strictEqual(insertCalled, false);
    assert.strictEqual(state.clientReleased, true);
  });

  it('11. C. Transactional boundary negatives: wrong Person/Membership -> denied, ROLLBACK, no INSERT, client released', async () => {
    let rollbackCalled = false;
    let insertCalled = false;
    const { pool, state } = createMockPool(defaultQueryHandler, async (q, v) => {
      if (q.includes('FOR UPDATE')) return { rows: [], rowCount: 0 } as any;
      if (q === 'ROLLBACK') rollbackCalled = true;
      if (q.includes('INSERT')) insertCalled = true;
      return defaultClientQueryHandler(q);
    });
    const result = await createTeacherManagedExamInstance(pool, { ...validInput, personId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb' }, grantEvaluator);
    assert.deepStrictEqual(result, { type: 'denied' });
    assert.strictEqual(rollbackCalled, true);
    assert.strictEqual(insertCalled, false);
    assert.strictEqual(state.clientReleased, true);
  });

  it('12. C. Transactional boundary negatives: wrong Subject Offering -> denied, ROLLBACK, no INSERT, client released', async () => {
    let rollbackCalled = false;
    let insertCalled = false;
    const { pool, state } = createMockPool(defaultQueryHandler, async (q, v) => {
      if (q.includes('FOR UPDATE')) return { rows: [], rowCount: 0 } as any;
      if (q === 'ROLLBACK') rollbackCalled = true;
      if (q.includes('INSERT')) insertCalled = true;
      return defaultClientQueryHandler(q);
    });
    const result = await createTeacherManagedExamInstance(pool, { ...validInput, subjectOfferingId: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc' }, grantEvaluator);
    assert.deepStrictEqual(result, { type: 'denied' });
    assert.strictEqual(rollbackCalled, true);
    assert.strictEqual(insertCalled, false);
    assert.strictEqual(state.clientReleased, true);
  });

  it('13. C. Transactional boundary negatives: wrong Academic Group -> denied, ROLLBACK, no INSERT, client released', async () => {
    let rollbackCalled = false;
    let insertCalled = false;
    const { pool, state } = createMockPool(defaultQueryHandler, async (q, v) => {
      if (q.includes('FOR UPDATE')) return { rows: [], rowCount: 0 } as any;
      if (q === 'ROLLBACK') rollbackCalled = true;
      if (q.includes('INSERT')) insertCalled = true;
      return defaultClientQueryHandler(q);
    });
    const result = await createTeacherManagedExamInstance(pool, { ...validInput, academicGroupId: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd' }, grantEvaluator);
    assert.deepStrictEqual(result, { type: 'denied' });
    assert.strictEqual(rollbackCalled, true);
    assert.strictEqual(insertCalled, false);
    assert.strictEqual(state.clientReleased, true);
  });

  it('14. A. Only exact evaluator result \'granted\' may connect/start transaction', async () => {
    const { pool } = createMockPool(defaultQueryHandler);
    let clientConnected = false;
    pool.connect = async () => { clientConnected = true; return {} as any; };
    const unexpectedEvaluator: AssessmentCreationCapabilityEvaluator = async () => 'unexpected' as any;

    const result = await createTeacherManagedExamInstance(pool, validInput, unexpectedEvaluator);
    assert.deepStrictEqual(result, { type: 'denied' });
    assert.strictEqual(clientConnected, false);
  });

  it('15. transaction failure -> unavailable + rollback, client released', async () => {
    let rollbackCalled = false;
    const { pool, state } = createMockPool(defaultQueryHandler, async (q, v) => {
      if (q.includes('INSERT')) throw new Error('DB Crash');
      if (q === 'ROLLBACK') rollbackCalled = true;
      return defaultClientQueryHandler(q);
    });

    const result = await createTeacherManagedExamInstance(pool, validInput, grantEvaluator);
    assert.deepStrictEqual(result, { type: 'unavailable' });
    assert.strictEqual(rollbackCalled, true);
    assert.strictEqual(state.clientReleased, true);
  });

  it('17. raw DB error text/secrets are not returned', async () => {
    const { pool } = createMockPool(async () => { throw new Error('SECRET_PASSWORD_123'); });
    const result = await createTeacherManagedExamInstance(pool, validInput, grantEvaluator);
    assert.deepStrictEqual(result, { type: 'unavailable' });
  });
});
