import { describe, it, mock } from 'node:test';
import * as assert from 'node:assert/strict';
import { Pool } from 'pg';
import type { QueryResult, QueryResultRow } from 'pg';
import { createExamParticipantAcademicEnrollment } from '../src/exam-participant-academic-enrollment-creation.ts';
import type { ExamParticipantAcademicEnrollmentCreationInput } from '../src/exam-participant-academic-enrollment-creation.ts';

describe('createExamParticipantAcademicEnrollment Concurrency-Safe Creation convergence', () => {
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
    onInsert: () => Promise<QueryResult<QueryResultRow>>
  ): Pool {
    const pool = new Pool();
    mock.method(pool, 'query', async (queryText: string, values: unknown[]) => {
      if (queryText.match(/SELECT.*FROM academic_core_student_enrollments/is)) {
        return queryResult([mockContextRow], 1);
      }
      if (queryText.match(/SELECT 1 FROM secure_assessment_exam_instances/is)) {
        return queryResult([{ '?column?': 1 }], 1);
      }
      if (queryText.match(/SELECT 1 FROM secure_assessment_exam_participants/is)) {
        return queryResult([], 0); // No sequential duplicate found
      }
      if (queryText.match(/INSERT INTO secure_assessment_exam_participants/is)) {
        return await onInsert();
      }
      throw new Error(`Unexpected query: ${queryText}`);
    });
    return pool;
  }

  it('normal successful behavior remains compatible', async () => {
    const pool = createMockPool(async () => queryResult([{
      id: newParticipantId,
      tenant_id: validInput.tenantId,
      exam_instance_id: validInput.examInstanceId,
      person_id: canonicalPersonId,
      academic_enrollment_id: validInput.academicEnrollmentId,
    }], 1));

    const result = await createExamParticipantAcademicEnrollment(pool, validInput);

    assert.deepStrictEqual(result, {
      type: 'created',
      examParticipantId: newParticipantId,
      tenantId: validInput.tenantId,
      examInstanceId: validInput.examInstanceId,
      personId: canonicalPersonId,
      academicEnrollmentId: validInput.academicEnrollmentId,
    });
  });

  it('exact 23505 + exact BU-051 constraint -> denied', async () => {
    const pool = createMockPool(async () => {
      const err: any = new Error('duplicate key value violates unique constraint "uq_sa_exam_participants_tenant_instance_person"');
      err.code = '23505';
      err.constraint = 'uq_sa_exam_participants_tenant_instance_person';
      throw err;
    });

    const result = await createExamParticipantAcademicEnrollment(pool, validInput);
    assert.deepStrictEqual(result, { type: 'denied' });
  });

  it('23505 + different constraint -> creation_unavailable', async () => {
    const pool = createMockPool(async () => {
      const err: any = new Error('duplicate key value violates unique constraint "some_other_constraint"');
      err.code = '23505';
      err.constraint = 'some_other_constraint';
      throw err;
    });

    const result = await createExamParticipantAcademicEnrollment(pool, validInput);
    assert.deepStrictEqual(result, { type: 'creation_unavailable' });
  });

  it('23505 without constraint -> creation_unavailable', async () => {
    const pool = createMockPool(async () => {
      const err: any = new Error('duplicate key value violates unique constraint');
      err.code = '23505';
      throw err;
    });

    const result = await createExamParticipantAcademicEnrollment(pool, validInput);
    assert.deepStrictEqual(result, { type: 'creation_unavailable' });
  });

  it('generic insert/query error -> creation_unavailable and raw error details never leak', async () => {
    const pool = createMockPool(async () => {
      const err: any = new Error('RAW DB TIMEOUT ERROR');
      err.code = '57014';
      throw err;
    });

    const result = await createExamParticipantAcademicEnrollment(pool, validInput);
    assert.deepStrictEqual(result, { type: 'creation_unavailable' });
  });
});
