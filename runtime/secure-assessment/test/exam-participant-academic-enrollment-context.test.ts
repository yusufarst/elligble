import { describe, it } from 'node:test';
import * as assert from 'node:assert/strict';
import type { Pool, QueryResult } from 'pg';
import { resolveExamParticipantAcademicEnrollmentContext } from '../src/exam-participant-academic-enrollment-context.ts';
import type { ExamParticipantAcademicEnrollmentContextInput } from '../src/exam-participant-academic-enrollment-context.ts';

describe('resolveExamParticipantAcademicEnrollmentContext', () => {
  const validInput: ExamParticipantAcademicEnrollmentContextInput = {
    tenantId: '11111111-1111-4111-a111-111111111111',
    academicEnrollmentId: '22222222-2222-4222-a222-222222222222',
  };

  const mockResolvedRow = {
    person_id: '33333333-3333-4333-a333-333333333333',
    membership_id: '44444444-4444-4444-a444-444444444444',
    academic_year_id: '55555555-5555-4555-a555-555555555555',
    academic_group_id: '66666666-6666-4666-a666-666666666666',
    academic_period_id: '77777777-7777-4777-a777-777777777777',
  };

  const secondResolvedRow = {
    person_id: '88888888-8888-4888-a888-888888888888',
    membership_id: '99999999-9999-4999-a999-999999999999',
    academic_year_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    academic_group_id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    academic_period_id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
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

  it('exact resolved row returns context_resolved with db-sourced personId and membershipId', async () => {
    let capturedQuery = '';
    let capturedValues: any[] = [];

    const pool = createMockPool(async (queryText, values) => {
      capturedQuery = queryText;
      capturedValues = values;
      return queryResult([mockResolvedRow]);
    });

    const result = await resolveExamParticipantAcademicEnrollmentContext(pool, validInput);

    assert.deepStrictEqual(result, {
      type: 'context_resolved',
      context: {
        tenantId: validInput.tenantId,
        personId: mockResolvedRow.person_id,
        membershipId: mockResolvedRow.membership_id,
        academicEnrollmentId: validInput.academicEnrollmentId,
        academicYearId: mockResolvedRow.academic_year_id,
        academicGroupId: mockResolvedRow.academic_group_id,
        academicPeriodId: mockResolvedRow.academic_period_id,
      },
    });

    assert.match(capturedQuery, /FROM\s+academic_core_student_enrollments\s+acse/i);
    assert.match(capturedQuery, /JOIN\s+tenant_memberships\s+tm/i);
    assert.match(capturedQuery, /tm\.id\s*=\s*acse\.membership_id/i);
    assert.match(capturedQuery, /tm\.tenant_id\s*=\s*acse\.tenant_id/i);
    assert.match(capturedQuery, /acse\.start_date\s*<=\s*CURRENT_DATE/i);
    assert.match(capturedQuery, /acse\.end_date\s+IS\s+NULL/i);
    assert.match(capturedQuery, /acse\.end_date\s*>=\s*CURRENT_DATE/i);
    assert.doesNotMatch(capturedQuery, /status/i);
    assert.doesNotMatch(capturedQuery, /'ACTIVE'/i);

    assert.doesNotMatch(capturedQuery, /\bINSERT\b/i);
    assert.doesNotMatch(capturedQuery, /\bUPDATE\b/i);
    assert.doesNotMatch(capturedQuery, /\bDELETE\b/i);

    assert.deepStrictEqual(capturedValues, [
      validInput.tenantId,
      validInput.academicEnrollmentId,
    ]);
  });

  it('malformed tenantId denies without query', async () => {
    let queryCount = 0;
    const pool = createMockPool(async () => {
      queryCount++;
      return queryResult([mockResolvedRow]);
    });

    const result = await resolveExamParticipantAcademicEnrollmentContext(pool, {
      ...validInput,
      tenantId: 'invalid',
    });

    assert.deepStrictEqual(result, { type: 'denied' });
    assert.strictEqual(queryCount, 0);
  });

  it('malformed academicEnrollmentId denies without query', async () => {
    let queryCount = 0;
    const pool = createMockPool(async () => {
      queryCount++;
      return queryResult([mockResolvedRow]);
    });

    const result = await resolveExamParticipantAcademicEnrollmentContext(pool, {
      ...validInput,
      academicEnrollmentId: 'invalid',
    });

    assert.deepStrictEqual(result, { type: 'denied' });
    assert.strictEqual(queryCount, 0);
  });

  it('zero rows returned => denied', async () => {
    const pool = createMockPool(async () => queryResult([]));
    const result = await resolveExamParticipantAcademicEnrollmentContext(pool, validInput);
    assert.deepStrictEqual(result, { type: 'denied' });
  });

  it('more than one row => fail closed / denied', async () => {
    const pool = createMockPool(async () => queryResult([mockResolvedRow, secondResolvedRow]));
    const result = await resolveExamParticipantAcademicEnrollmentContext(pool, validInput);
    assert.deepStrictEqual(result, { type: 'denied' });
  });

  it('query rejection/error => context_unavailable', async () => {
    const pool = createMockPool(async () => {
      throw new Error('Database error');
    });
    const result = await resolveExamParticipantAcademicEnrollmentContext(pool, validInput);
    assert.deepStrictEqual(result, { type: 'context_unavailable' });
  });
});
