import { describe, it } from 'node:test';
import * as assert from 'node:assert/strict';
import type { Pool, QueryResult } from 'pg';
import { assignExamParticipantAcademicEnrollment } from '../src/exam-participant-academic-enrollment-assignment.ts';
import type { ExamParticipantAcademicEnrollmentAssignmentInput } from '../src/exam-participant-academic-enrollment-assignment.ts';

describe('assignExamParticipantAcademicEnrollment', () => {
  const validInput: ExamParticipantAcademicEnrollmentAssignmentInput = {
    tenantId: '11111111-1111-4111-a111-111111111111',
    examParticipantId: '22222222-2222-4222-a222-222222222222',
    academicEnrollmentId: '33333333-3333-4333-a333-333333333333',
  };

  const resolvedPersonId = '44444444-4444-4444-a444-444444444444';

  const mockContextRow = {
    person_id: resolvedPersonId,
    membership_id: '55555555-5555-4555-a555-555555555555',
    academic_year_id: '66666666-6666-4666-a666-666666666666',
    academic_group_id: '77777777-7777-4777-a777-777777777777',
    academic_period_id: '88888888-8888-4888-a888-888888888888',
  };

  function queryResult(rows: any[], rowCount: number): QueryResult<any> {
    return {
      rows,
      rowCount,
      command: 'QUERY',
      oid: 0,
      fields: [],
    };
  }

  function createMockPool(
    selectRows: any[],
    updateRowCount: number,
    onQuery?: (queryText: string, values: any[]) => void
  ): Pool {
    return {
      query: async (queryText: string, values: any[]) => {
        if (onQuery) onQuery(queryText, values);
        if (queryText.match(/SELECT.*FROM academic_core_student_enrollments/is)) {
          return queryResult(selectRows, selectRows.length);
        }
        if (queryText.match(/UPDATE secure_assessment_exam_participants/is)) {
          return queryResult([], updateRowCount);
        }
        throw new Error(`Unexpected query: ${queryText}`);
      },
    } as unknown as Pool;
  }

  it('successful initial attachment', async () => {
    const querySequence: string[] = [];
    let capturedUpdateQuery = '';
    let capturedUpdateValues: any[] = [];

    const pool = createMockPool([mockContextRow], 1, (queryText, values) => {
      if (queryText.includes('SELECT')) {
        querySequence.push('CONTEXT_SELECT');
      }
      if (queryText.includes('UPDATE')) {
        querySequence.push('PARTICIPANT_UPDATE');
        capturedUpdateQuery = queryText;
        capturedUpdateValues = values;
      }
    });

    const result = await assignExamParticipantAcademicEnrollment(pool, validInput);

    assert.deepStrictEqual(result, { type: 'assigned' });

    assert.strictEqual(querySequence.length, 2, 'exactly two Pool.query calls occurred');
    assert.deepStrictEqual(querySequence, ['CONTEXT_SELECT', 'PARTICIPANT_UPDATE'], 'first query = BU-048 context SELECT; second query = BU-049 participant UPDATE');

    assert.match(capturedUpdateQuery, /UPDATE\s+secure_assessment_exam_participants/i);
    assert.match(capturedUpdateQuery, /SET\s+academic_enrollment_id\s*=\s*\$1/i);
    assert.match(capturedUpdateQuery, /tenant_id\s*=\s*\$2/i);
    assert.match(capturedUpdateQuery, /id\s*=\s*\$3/i);
    assert.match(capturedUpdateQuery, /person_id\s*=\s*\$4/i);
    assert.match(capturedUpdateQuery, /\(\s*academic_enrollment_id\s+IS\s+NULL\s+OR\s+academic_enrollment_id\s*=\s*\$1\s*\)/i);

    assert.doesNotMatch(capturedUpdateQuery, /SET\s+person_id/i);
    assert.doesNotMatch(capturedUpdateQuery, /SET\s+exam_instance_id/i);
    assert.doesNotMatch(capturedUpdateQuery, /INSERT/i);
    assert.doesNotMatch(capturedUpdateQuery, /DELETE/i);
    assert.doesNotMatch(capturedUpdateQuery, /academic_core/i);
    assert.doesNotMatch(capturedUpdateQuery, /status/i);
    assert.doesNotMatch(capturedUpdateQuery, /ACTIVE/i);

    assert.deepStrictEqual(capturedUpdateValues, [
      validInput.academicEnrollmentId,
      validInput.tenantId,
      validInput.examParticipantId,
      resolvedPersonId,
    ]);
  });

  it('idempotent same-enrollment assignment (rowCount = 1)', async () => {
    const pool = createMockPool([mockContextRow], 1);
    const result = await assignExamParticipantAcademicEnrollment(pool, validInput);
    assert.deepStrictEqual(result, { type: 'assigned' });
  });

  it('conflicting assignment -> denied (rowCount = 0)', async () => {
    const pool = createMockPool([mockContextRow], 0);
    const result = await assignExamParticipantAcademicEnrollment(pool, validInput);
    assert.deepStrictEqual(result, { type: 'denied' });
  });

  it('person mismatch/update miss -> denied (rowCount = 0)', async () => {
    const pool = createMockPool([mockContextRow], 0);
    const result = await assignExamParticipantAcademicEnrollment(pool, validInput);
    assert.deepStrictEqual(result, { type: 'denied' });
  });

  it('missing participant/update miss -> denied (rowCount = 0)', async () => {
    const pool = createMockPool([mockContextRow], 0);
    const result = await assignExamParticipantAcademicEnrollment(pool, validInput);
    assert.deepStrictEqual(result, { type: 'denied' });
  });

  it('malformed tenantId -> denied with ZERO Pool.query calls', async () => {
    let calls = 0;
    const pool = createMockPool([mockContextRow], 1, () => { calls++; });
    const result = await assignExamParticipantAcademicEnrollment(pool, { ...validInput, tenantId: 'invalid' });
    assert.deepStrictEqual(result, { type: 'denied' });
    assert.strictEqual(calls, 0);
  });

  it('malformed examParticipantId -> denied with ZERO Pool.query calls', async () => {
    let calls = 0;
    const pool = createMockPool([mockContextRow], 1, () => { calls++; });
    const result = await assignExamParticipantAcademicEnrollment(pool, { ...validInput, examParticipantId: 'invalid' });
    assert.deepStrictEqual(result, { type: 'denied' });
    assert.strictEqual(calls, 0);
  });

  it('malformed academicEnrollmentId -> denied with ZERO Pool.query calls', async () => {
    let calls = 0;
    const pool = createMockPool([mockContextRow], 1, () => { calls++; });
    const result = await assignExamParticipantAcademicEnrollment(pool, { ...validInput, academicEnrollmentId: 'invalid' });
    assert.deepStrictEqual(result, { type: 'denied' });
    assert.strictEqual(calls, 0);
  });

  it('BU-048 denied via SELECT zero rows -> denied and ZERO UPDATE calls', async () => {
    let updateCalls = 0;
    const pool = createMockPool([], 1, (q) => { if (q.includes('UPDATE')) updateCalls++; });
    const result = await assignExamParticipantAcademicEnrollment(pool, validInput);
    assert.deepStrictEqual(result, { type: 'denied' });
    assert.strictEqual(updateCalls, 0);
  });

  it('BU-048 context query rejection -> assignment_unavailable and ZERO UPDATE calls', async () => {
    let updateCalls = 0;
    const pool = {
      query: async (q: string) => {
        if (q.includes('UPDATE')) updateCalls++;
        throw new Error('Database Error');
      }
    } as unknown as Pool;
    const result = await assignExamParticipantAcademicEnrollment(pool, validInput);
    assert.deepStrictEqual(result, { type: 'assignment_unavailable' });
    assert.strictEqual(updateCalls, 0);
  });

  it('UPDATE rejection after successful context resolution -> assignment_unavailable', async () => {
    const pool = {
      query: async (q: string) => {
        if (q.includes('SELECT')) return queryResult([mockContextRow], 1);
        if (q.includes('UPDATE')) throw new Error('Update Database Error');
        return queryResult([], 0);
      }
    } as unknown as Pool;
    const result = await assignExamParticipantAcademicEnrollment(pool, validInput);
    assert.deepStrictEqual(result, { type: 'assignment_unavailable' });
  });
});
