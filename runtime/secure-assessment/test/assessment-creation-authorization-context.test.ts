import { describe, it } from 'node:test';
import * as assert from 'node:assert/strict';
import type { Pool, QueryResult } from 'pg';
import { resolveTeacherManagedAssessmentCreationContext } from '../src/assessment-creation-authorization-context.ts';
import type { AssessmentCreationContextInput } from '../src/assessment-creation-authorization-context.ts';

describe('resolveTeacherManagedAssessmentCreationContext', () => {
  const validInput: AssessmentCreationContextInput = {
    tenantId: '11111111-1111-4111-a111-111111111111',
    personId: '22222222-2222-4222-a222-222222222222',
    subjectOfferingId: '33333333-3333-4333-a333-333333333333',
    academicGroupId: '44444444-4444-4444-a444-444444444444',
  };

  const secondPersonId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

  const mockResolvedRow = {
    membership_id: '55555555-5555-4555-a555-555555555555',
    teacher_assignment_id: '66666666-6666-4666-a666-666666666666',
    teaching_assignment_id: '77777777-7777-4777-a777-777777777777',
  };

  const secondResolvedRow = {
    membership_id: '88888888-8888-4888-a888-888888888888',
    teacher_assignment_id: '99999999-9999-4999-a999-999999999999',
    teaching_assignment_id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
  };

  function queryResult(rows: any[]): QueryResult<any> {
    return {
      rows,
      rowCount: rows.length,
      command: 'SELECT',
      oid: 0,
      fields: [],
    };
  }

  function createMockPool(
    queryMock: (queryText: string, values: any[]) => Promise<QueryResult<any>>
  ): Pool {
    return { query: queryMock } as unknown as Pool;
  }

  it('exact active context resolves and SQL contract is exact/read-only', async () => {
    let capturedQuery = '';
    let capturedValues: any[] = [];

    const pool = createMockPool(async (queryText, values) => {
      capturedQuery = queryText;
      capturedValues = values;
      return queryResult([mockResolvedRow]);
    });

    const result =
      await resolveTeacherManagedAssessmentCreationContext(pool, validInput);

    assert.deepStrictEqual(result, {
      type: 'context_resolved',
      context: {
        tenantId: validInput.tenantId,
        personId: validInput.personId,
        membershipId: mockResolvedRow.membership_id,
        teacherAssignmentId: mockResolvedRow.teacher_assignment_id,
        teachingAssignmentId: mockResolvedRow.teaching_assignment_id,
        subjectOfferingId: validInput.subjectOfferingId,
        academicGroupId: validInput.academicGroupId,
      },
    });

    assert.match(capturedQuery, /FROM\s+tenant_memberships\s+tm/i);
    assert.match(capturedQuery, /JOIN\s+tenant_teacher_assignments\s+tta/i);
    assert.match(capturedQuery, /tta\.membership_id\s*=\s*tm\.id/i);
    assert.match(capturedQuery, /tta\.tenant_id\s*=\s*tm\.tenant_id/i);
    assert.match(capturedQuery, /tta\.revoked_at\s+IS\s+NULL/i);
    assert.match(capturedQuery, /JOIN\s+academic_core_teaching_assignments\s+ata/i);
    assert.match(capturedQuery, /ata\.teacher_assignment_id\s*=\s*tta\.id/i);
    assert.match(capturedQuery, /ata\.tenant_id\s*=\s*tta\.tenant_id/i);
    assert.match(capturedQuery, /ata\.revoked_at\s+IS\s+NULL/i);
    assert.match(capturedQuery, /tm\.tenant_id\s*=\s*\$1/i);
    assert.match(capturedQuery, /tm\.person_id\s*=\s*\$2/i);
    assert.match(capturedQuery, /ata\.subject_offering_id\s*=\s*\$3/i);
    assert.match(capturedQuery, /ata\.academic_group_id\s*=\s*\$4/i);
    assert.match(capturedQuery, /LIMIT\s+2/i);

    assert.doesNotMatch(capturedQuery, /\bINSERT\b/i);
    assert.doesNotMatch(capturedQuery, /\bUPDATE\b/i);
    assert.doesNotMatch(capturedQuery, /\bDELETE\b/i);
    assert.doesNotMatch(capturedQuery, /secure_assessment_proctor_assignments/i);
    assert.doesNotMatch(capturedQuery, /\brole\b/i);
    assert.doesNotMatch(capturedQuery, /\bpermission\b/i);
    assert.doesNotMatch(capturedQuery, /\bcapability\b/i);

    assert.deepStrictEqual(capturedValues, [
      validInput.tenantId,
      validInput.personId,
      validInput.subjectOfferingId,
      validInput.academicGroupId,
    ]);
  });

  async function expectDenied(
    input: AssessmentCreationContextInput,
    expectedValues: string[]
  ): Promise<void> {
    const pool = createMockPool(async (_queryText, values) => {
      assert.deepStrictEqual(values, expectedValues);
      return queryResult([]);
    });

    const result =
      await resolveTeacherManagedAssessmentCreationContext(pool, input);

    assert.deepStrictEqual(result, { type: 'denied' });
  }

  it('missing Teaching Assignment denies', async () => {
    await expectDenied(validInput, [
      validInput.tenantId,
      validInput.personId,
      validInput.subjectOfferingId,
      validInput.academicGroupId,
    ]);
  });

  it('revoked TEACHER staff assignment denies through active-filter query', async () => {
    const pool = createMockPool(async (queryText) => {
      assert.match(queryText, /tta\.revoked_at\s+IS\s+NULL/i);
      return queryResult([]);
    });

    assert.deepStrictEqual(
      await resolveTeacherManagedAssessmentCreationContext(pool, validInput),
      { type: 'denied' }
    );
  });

  it('revoked Teaching Assignment denies through active-filter query', async () => {
    const pool = createMockPool(async (queryText) => {
      assert.match(queryText, /ata\.revoked_at\s+IS\s+NULL/i);
      return queryResult([]);
    });

    assert.deepStrictEqual(
      await resolveTeacherManagedAssessmentCreationContext(pool, validInput),
      { type: 'denied' }
    );
  });

  it('wrong tenant denies', async () => {
    const input = {
      ...validInput,
      tenantId: '12121212-1212-4121-a121-121212121212',
    };

    await expectDenied(input, [
      input.tenantId,
      input.personId,
      input.subjectOfferingId,
      input.academicGroupId,
    ]);
  });

  it('wrong person denies', async () => {
    const input = { ...validInput, personId: secondPersonId };

    await expectDenied(input, [
      input.tenantId,
      input.personId,
      input.subjectOfferingId,
      input.academicGroupId,
    ]);
  });

  it('wrong Subject Offering denies', async () => {
    const input = {
      ...validInput,
      subjectOfferingId: '13131313-1313-4131-a131-131313131313',
    };

    await expectDenied(input, [
      input.tenantId,
      input.personId,
      input.subjectOfferingId,
      input.academicGroupId,
    ]);
  });

  it('wrong Academic Group denies', async () => {
    const input = {
      ...validInput,
      academicGroupId: '14141414-1414-4141-a141-141414141414',
    };

    await expectDenied(input, [
      input.tenantId,
      input.personId,
      input.subjectOfferingId,
      input.academicGroupId,
    ]);
  });

  it('ambiguous two-row active context fails closed', async () => {
    const pool = createMockPool(async () =>
      queryResult([mockResolvedRow, secondResolvedRow])
    );

    assert.deepStrictEqual(
      await resolveTeacherManagedAssessmentCreationContext(pool, validInput),
      { type: 'denied' }
    );
  });

  it('database failure returns context_unavailable and leaks no raw error material', async () => {
    const pool = createMockPool(async () => {
      throw new Error(
        'FATAL: password authentication failed for user "postgres" secret-value'
      );
    });

    const result =
      await resolveTeacherManagedAssessmentCreationContext(pool, validInput);

    assert.deepStrictEqual(result, { type: 'context_unavailable' });

    const serialized = JSON.stringify(result);
    assert.strictEqual(serialized.includes('postgres'), false);
    assert.strictEqual(serialized.includes('FATAL'), false);
    assert.strictEqual(serialized.includes('secret-value'), false);
  });

  it('malformed tenantId denies without query', async () => {
    let queryCount = 0;
    const pool = createMockPool(async () => {
      queryCount++;
      return queryResult([mockResolvedRow]);
    });

    const result = await resolveTeacherManagedAssessmentCreationContext(
      pool,
      { ...validInput, tenantId: 'invalid' }
    );

    assert.deepStrictEqual(result, { type: 'denied' });
    assert.strictEqual(queryCount, 0);
  });

  it('malformed personId denies without query', async () => {
    let queryCount = 0;
    const pool = createMockPool(async () => {
      queryCount++;
      return queryResult([mockResolvedRow]);
    });

    const result = await resolveTeacherManagedAssessmentCreationContext(
      pool,
      { ...validInput, personId: 'invalid' }
    );

    assert.deepStrictEqual(result, { type: 'denied' });
    assert.strictEqual(queryCount, 0);
  });

  it('malformed subjectOfferingId denies without query', async () => {
    let queryCount = 0;
    const pool = createMockPool(async () => {
      queryCount++;
      return queryResult([mockResolvedRow]);
    });

    const result = await resolveTeacherManagedAssessmentCreationContext(
      pool,
      { ...validInput, subjectOfferingId: '' }
    );

    assert.deepStrictEqual(result, { type: 'denied' });
    assert.strictEqual(queryCount, 0);
  });

  it('malformed academicGroupId denies without query', async () => {
    let queryCount = 0;
    const pool = createMockPool(async () => {
      queryCount++;
      return queryResult([mockResolvedRow]);
    });

    const result = await resolveTeacherManagedAssessmentCreationContext(
      pool,
      { ...validInput, academicGroupId: '123' }
    );

    assert.deepStrictEqual(result, { type: 'denied' });
    assert.strictEqual(queryCount, 0);
  });

  it('does not use implicit Proctor or role fallback', async () => {
    let capturedQuery = '';

    const pool = createMockPool(async (queryText) => {
      capturedQuery = queryText;
      return queryResult([]);
    });

    const result =
      await resolveTeacherManagedAssessmentCreationContext(pool, validInput);

    assert.deepStrictEqual(result, { type: 'denied' });
    assert.doesNotMatch(capturedQuery, /secure_assessment_proctor_assignments/i);
    assert.doesNotMatch(capturedQuery, /\brole\b/i);
    assert.doesNotMatch(capturedQuery, /\bpermission\b/i);
  });

  it('two different Teachers independently resolve the same offering/group context', async () => {
    const pool = createMockPool(async (_queryText, values) => {
      if (values[1] === validInput.personId) {
        return queryResult([mockResolvedRow]);
      }

      if (values[1] === secondPersonId) {
        return queryResult([secondResolvedRow]);
      }

      return queryResult([]);
    });

    const first =
      await resolveTeacherManagedAssessmentCreationContext(pool, validInput);

    const second =
      await resolveTeacherManagedAssessmentCreationContext(pool, {
        ...validInput,
        personId: secondPersonId,
      });

    assert.strictEqual(first.type, 'context_resolved');
    assert.strictEqual(second.type, 'context_resolved');

    if (first.type === 'context_resolved' &&
        second.type === 'context_resolved') {
      assert.notStrictEqual(
        first.context.teacherAssignmentId,
        second.context.teacherAssignmentId
      );

      assert.strictEqual(
        first.context.subjectOfferingId,
        second.context.subjectOfferingId
      );

      assert.strictEqual(
        first.context.academicGroupId,
        second.context.academicGroupId
      );
    }
  });
});