import { describe, it, mock } from 'node:test';
import * as assert from 'node:assert/strict';
import { Pool } from 'pg';
import type { QueryResult, QueryResultRow } from 'pg';
import { createExamParticipantAcademicEnrollment } from '../src/exam-participant-academic-enrollment-creation.ts';
import type { ExamParticipantAcademicEnrollmentCreationInput } from '../src/exam-participant-academic-enrollment-creation.ts';

describe('createExamParticipantAcademicEnrollment', () => {
  const validInput: ExamParticipantAcademicEnrollmentCreationInput = {
    tenantId: '11111111-1111-4111-a111-111111111111',
    examInstanceId: '22222222-2222-4222-a222-222222222222',
    academicEnrollmentId: '33333333-3333-4333-a333-333333333333',
  };

  const canonicalPersonId = '44444444-4444-4444-a444-444444444444';
  const newParticipantId = '99999999-9999-4999-a999-999999999999';

  const mockContextRow = {
    person_id: canonicalPersonId,
    membership_id: '55555555-5555-4555-a555-555555555555',
    academic_year_id: '66666666-6666-4666-a666-666666666666',
    academic_group_id: '77777777-7777-4777-a777-777777777777',
    academic_period_id: '88888888-8888-4888-a888-888888888888',
  };

  function queryResult(rows: QueryResultRow[], rowCount: number): QueryResult<QueryResultRow> {
    return { rows, rowCount, command: 'QUERY', oid: 0, fields: [] };
  }

  function createMockPool(
    selectContextRows: QueryResultRow[],
    selectInstanceRows: QueryResultRow[],
    selectDuplicateRows: QueryResultRow[],
    onQuery?: (queryText: string, values: unknown[]) => void
  ): Pool {
    const pool = new Pool();
    mock.method(pool, 'query', async (queryText: string, values: unknown[]) => {
      if (onQuery) onQuery(queryText, values);
      if (queryText.match(/SELECT.*FROM academic_core_student_enrollments/is)) {
        return queryResult(selectContextRows, selectContextRows.length);
      }
      if (queryText.match(/SELECT 1 FROM secure_assessment_exam_instances/is)) {
        return queryResult(selectInstanceRows, selectInstanceRows.length);
      }
      if (queryText.match(/SELECT 1 FROM secure_assessment_exam_participants/is)) {
        return queryResult(selectDuplicateRows, selectDuplicateRows.length);
      }
      if (queryText.match(/INSERT INTO secure_assessment_exam_participants/is)) {
        return queryResult([{
          id: newParticipantId,
          tenant_id: values[0],
          exam_instance_id: values[1],
          person_id: values[2],
          academic_enrollment_id: values[3],
        }], 1);
      }
      throw new Error(`Unexpected query: ${queryText}`);
    });
    return pool;
  }

  it('successful creation with correct sequential query and INSERT assertions', async () => {
    const querySequence: string[] = [];
    let capturedInsertQuery = '';
    let capturedInsertValues: unknown[] = [];

    const pool = createMockPool([mockContextRow], [{ '?column?': 1 }], [], (queryText, values) => {
      if (queryText.includes('FROM academic_core_student_enrollments')) {
        querySequence.push('CONTEXT_SELECT');
      } else if (queryText.includes('FROM secure_assessment_exam_instances')) {
        querySequence.push('INSTANCE_SELECT');
      } else if (queryText.includes('FROM secure_assessment_exam_participants')) {
        querySequence.push('DUPLICATE_SELECT');
      } else if (queryText.includes('INSERT INTO')) {
        querySequence.push('PARTICIPANT_INSERT');
        capturedInsertQuery = queryText;
        capturedInsertValues = values;
      }
    });

    const result = await createExamParticipantAcademicEnrollment(pool, validInput);

    assert.deepStrictEqual(result, {
      type: 'created',
      examParticipantId: newParticipantId,
      tenantId: validInput.tenantId,
      examInstanceId: validInput.examInstanceId,
      personId: canonicalPersonId,
      academicEnrollmentId: validInput.academicEnrollmentId,
    });

    assert.deepStrictEqual(querySequence, ['CONTEXT_SELECT', 'INSTANCE_SELECT', 'DUPLICATE_SELECT', 'PARTICIPANT_INSERT']);

    assert.match(capturedInsertQuery, /INSERT\s+INTO\s+secure_assessment_exam_participants/i);
    assert.deepStrictEqual(capturedInsertValues, [
      validInput.tenantId,
      validInput.examInstanceId,
      canonicalPersonId,
      validInput.academicEnrollmentId,
    ], 'canonical personId from BU-048 used in INSERT; academicEnrollmentId written at creation time');
  });

  it('invalid tenantId -> denied with ZERO queries', async () => {
    let calls = 0;
    const pool = createMockPool([mockContextRow], [{ '?column?': 1 }], [], () => { calls++; });
    const result = await createExamParticipantAcademicEnrollment(pool, { ...validInput, tenantId: 'invalid' });
    assert.deepStrictEqual(result, { type: 'denied' });
    assert.strictEqual(calls, 0);
  });

  it('invalid examInstanceId -> denied with ZERO queries', async () => {
    let calls = 0;
    const pool = createMockPool([mockContextRow], [{ '?column?': 1 }], [], () => { calls++; });
    const result = await createExamParticipantAcademicEnrollment(pool, { ...validInput, examInstanceId: 'invalid' });
    assert.deepStrictEqual(result, { type: 'denied' });
    assert.strictEqual(calls, 0);
  });

  it('invalid academicEnrollmentId -> denied with ZERO queries', async () => {
    let calls = 0;
    const pool = createMockPool([mockContextRow], [{ '?column?': 1 }], [], () => { calls++; });
    const result = await createExamParticipantAcademicEnrollment(pool, { ...validInput, academicEnrollmentId: 'invalid' });
    assert.deepStrictEqual(result, { type: 'denied' });
    assert.strictEqual(calls, 0);
  });

  it('BU-048 denied -> denied', async () => {
    const pool = createMockPool([], [{ '?column?': 1 }], []);
    const result = await createExamParticipantAcademicEnrollment(pool, validInput);
    assert.deepStrictEqual(result, { type: 'denied' });
  });

  it('BU-048 context_unavailable -> creation_unavailable', async () => {
    const pool = new Pool();
    mock.method(pool, 'query', async () => { throw new Error('DB Error'); });
    const result = await createExamParticipantAcademicEnrollment(pool, validInput);
    assert.deepStrictEqual(result, { type: 'creation_unavailable' });
  });

  it('missing same-tenant Exam Instance -> denied', async () => {
    let duplicateQueryRun = false;
    const pool = createMockPool([mockContextRow], [], [], (q) => {
      if (q.includes('FROM secure_assessment_exam_participants')) {
        duplicateQueryRun = true;
      }
    });
    const result = await createExamParticipantAcademicEnrollment(pool, validInput);
    assert.deepStrictEqual(result, { type: 'denied' });
    assert.strictEqual(duplicateQueryRun, false, 'no duplicate check / no INSERT should run');
  });

  it('wrong-tenant Exam Instance (via missing rows in SAME tenant query) -> denied', async () => {
    let duplicateQueryRun = false;
    let insertQueryRun = false;
    let capturedInstanceQuery = '';
    let capturedInstanceValues: unknown[] = [];

    const pool = createMockPool([mockContextRow], [], [], (q, values) => {
      if (q.includes('FROM secure_assessment_exam_instances')) {
        capturedInstanceQuery = q;
        capturedInstanceValues = values;
      } else if (q.includes('FROM secure_assessment_exam_participants')) {
        duplicateQueryRun = true;
      } else if (q.includes('INSERT INTO')) {
        insertQueryRun = true;
      }
    });

    const result = await createExamParticipantAcademicEnrollment(pool, validInput);
    assert.deepStrictEqual(result, { type: 'denied' });

    assert.match(capturedInstanceQuery, /id\s*=\s*\$1/);
    assert.match(capturedInstanceQuery, /tenant_id\s*=\s*\$2/);
    assert.deepStrictEqual(capturedInstanceValues, [
      validInput.examInstanceId,
      validInput.tenantId,
    ]);

    assert.strictEqual(duplicateQueryRun, false, 'no duplicate check should run');
    assert.strictEqual(insertQueryRun, false, 'no INSERT should run');
  });

  it('sequential duplicate same tenant + exam instance + canonical person -> denied', async () => {
    let insertQueryRun = false;
    const pool = createMockPool([mockContextRow], [{ '?column?': 1 }], [{ '?column?': 1 }], (q) => {
      if (q.includes('INSERT INTO')) {
        insertQueryRun = true;
      }
    });
    const result = await createExamParticipantAcademicEnrollment(pool, validInput);
    assert.deepStrictEqual(result, { type: 'denied' });
    assert.strictEqual(insertQueryRun, false, 'no INSERT should run');
  });

  it('DB/query failure -> creation_unavailable and raw DB error never exposed', async () => {
    const pool = new Pool();
    mock.method(pool, 'query', async (q: string) => {
      if (q.includes('FROM academic_core_student_enrollments')) return queryResult([mockContextRow], 1);
      throw new Error('Raw DB Error');
    });
    const result = await createExamParticipantAcademicEnrollment(pool, validInput);
    assert.deepStrictEqual(result, { type: 'creation_unavailable' });
  });
});
