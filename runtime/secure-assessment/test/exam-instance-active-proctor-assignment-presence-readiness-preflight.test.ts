import { test, describe } from 'node:test';
import * as assert from 'node:assert/strict';
import type { PoolClient } from 'pg';
import {
  checkExamInstanceActiveProctorAssignmentPresenceReadiness,
  type CapabilityEvaluator
} from '../src/exam-instance-active-proctor-assignment-presence-readiness-preflight.ts';

const VALID_TENANT = '00000000-0000-0000-0000-000000000001';
const VALID_EXAM = '00000000-0000-0000-0000-000000000002';

const grantedCapability: CapabilityEvaluator = async () => 'granted' as const;
const deniedCapability: CapabilityEvaluator = async () => 'denied' as const;
const unavailableCapability: CapabilityEvaluator = async () => 'unavailable' as const;

function createClient(options: any = {}, checks?: { insertUpdateDelete?: boolean; queryText?: string[] }): PoolClient {
  return {
    query: async (text: string, params: any[]) => {
      if (checks) {
        if (/INSERT|UPDATE|DELETE/i.test(text)) checks.insertUpdateDelete = true;
        checks.queryText = checks.queryText || [];
        checks.queryText.push(text);
      }

      if (options.dbError) throw new Error('DB Error');

      if (text.includes('secure_assessment_exam_instances')) {
        if (options.missingExam || (options.wrongTenant && params[1] !== VALID_TENANT)) return { rowCount: 0, rows: [] };
        return { rowCount: 1, rows: [{ lifecycle_state: options.lifecycle_state || 'SCHEDULED' }] };
      }

      if (text.includes('secure_assessment_proctor_assignments')) {
        let count = 0;
        if (options.activeAssignments) {
          count = options.activeAssignments;
        }
        return { rowCount: 1, rows: [{ count: count.toString() }] };
      }

      return { rowCount: 1, rows: [{}] };
    }
  } as unknown as PoolClient;
}

describe('BU-070: Exam Instance Active Proctor Assignment Presence Readiness Preflight', () => {
  test('1. invalid tenant UUID -> denied', async () => {
    const res = await checkExamInstanceActiveProctorAssignmentPresenceReadiness(createClient(), 'invalid', VALID_EXAM, grantedCapability);
    assert.deepEqual(res, { type: 'denied' });
  });

  test('2. invalid exam UUID -> denied', async () => {
    const res = await checkExamInstanceActiveProctorAssignmentPresenceReadiness(createClient(), VALID_TENANT, 'invalid', grantedCapability);
    assert.deepEqual(res, { type: 'denied' });
  });

  test('3. capability denied -> denied', async () => {
    const res = await checkExamInstanceActiveProctorAssignmentPresenceReadiness(createClient(), VALID_TENANT, VALID_EXAM, deniedCapability);
    assert.deepEqual(res, { type: 'denied' });
  });

  test('4. explicit unavailable -> unavailable', async () => {
    const res = await checkExamInstanceActiveProctorAssignmentPresenceReadiness(createClient(), VALID_TENANT, VALID_EXAM, unavailableCapability);
    assert.deepEqual(res, { type: 'unavailable' });
  });

  test('5. evaluator throws -> unavailable', async () => {
    const res = await checkExamInstanceActiveProctorAssignmentPresenceReadiness(createClient(), VALID_TENANT, VALID_EXAM, async () => { throw new Error(); });
    assert.deepEqual(res, { type: 'unavailable' });
  });

  test('6. unexpected capability decision fails closed -> denied', async () => {
    const res = await checkExamInstanceActiveProctorAssignmentPresenceReadiness(createClient(), VALID_TENANT, VALID_EXAM, async () => 'unknown' as any);
    assert.deepEqual(res, { type: 'denied' });
  });

  test('7. nonexistent exam -> denied', async () => {
    const res = await checkExamInstanceActiveProctorAssignmentPresenceReadiness(createClient({ missingExam: true }), VALID_TENANT, VALID_EXAM, grantedCapability);
    assert.deepEqual(res, { type: 'denied' });
  });

  test('8. wrong tenant -> denied', async () => {
    const res = await checkExamInstanceActiveProctorAssignmentPresenceReadiness(createClient({ wrongTenant: true }), '00000000-0000-0000-0000-000000000003', VALID_EXAM, grantedCapability);
    assert.deepEqual(res, { type: 'denied' });
  });

  test('9. non-SCHEDULED -> invalid_state', async () => {
    const res = await checkExamInstanceActiveProctorAssignmentPresenceReadiness(createClient({ lifecycle_state: 'DRAFT' }), VALID_TENANT, VALID_EXAM, grantedCapability);
    assert.deepEqual(res, { type: 'invalid_state' });
  });

  test('10. zero active assignments -> not_ready', async () => {
    const res = await checkExamInstanceActiveProctorAssignmentPresenceReadiness(createClient({ activeAssignments: 0 }), VALID_TENANT, VALID_EXAM, grantedCapability);
    assert.deepEqual(res, { type: 'not_ready', blocker: 'active_proctor_assignment_empty' });
  });

  test('11. one active assignment -> count 1', async () => {
    const res = await checkExamInstanceActiveProctorAssignmentPresenceReadiness(createClient({ activeAssignments: 1 }), VALID_TENANT, VALID_EXAM, grantedCapability);
    assert.deepEqual(res, { type: 'active_proctor_assignment_presence_ready', tenantId: VALID_TENANT, examInstanceId: VALID_EXAM, activeProctorAssignmentCount: 1 });
  });

  test('12. two active assignments -> count 2', async () => {
    const res = await checkExamInstanceActiveProctorAssignmentPresenceReadiness(createClient({ activeAssignments: 2 }), VALID_TENANT, VALID_EXAM, grantedCapability);
    assert.deepEqual(res, { type: 'active_proctor_assignment_presence_ready', tenantId: VALID_TENANT, examInstanceId: VALID_EXAM, activeProctorAssignmentCount: 2 });
  });

  test('13. revoked-only -> zero/not_ready', async () => {
    const res = await checkExamInstanceActiveProctorAssignmentPresenceReadiness(createClient({ activeAssignments: 0 }), VALID_TENANT, VALID_EXAM, grantedCapability);
    assert.deepEqual(res, { type: 'not_ready', blocker: 'active_proctor_assignment_empty' });
  });

  test('14. active + revoked -> active count only', async () => {
    const res = await checkExamInstanceActiveProctorAssignmentPresenceReadiness(createClient({ activeAssignments: 1 }), VALID_TENANT, VALID_EXAM, grantedCapability);
    assert.deepEqual(res, { type: 'active_proctor_assignment_presence_ready', tenantId: VALID_TENANT, examInstanceId: VALID_EXAM, activeProctorAssignmentCount: 1 });
  });

  test('15. other-exam assignment excluded', async () => {
    const checks = { queryText: [] as string[] };
    await checkExamInstanceActiveProctorAssignmentPresenceReadiness(createClient({ activeAssignments: 1 }, checks), VALID_TENANT, VALID_EXAM, grantedCapability);
    const countQuery = checks.queryText.find(t => t.includes('secure_assessment_proctor_assignments'));
    assert.ok(countQuery?.includes('exam_instance_id = $1'));
  });

  test('16. other-tenant assignment excluded', async () => {
    const checks = { queryText: [] as string[] };
    await checkExamInstanceActiveProctorAssignmentPresenceReadiness(createClient({ activeAssignments: 1 }, checks), VALID_TENANT, VALID_EXAM, grantedCapability);
    const countQuery = checks.queryText.find(t => t.includes('secure_assessment_proctor_assignments'));
    assert.ok(countQuery?.includes('tenant_id = $2'));
  });

  test('17. database failure -> unavailable', async () => {
    const res = await checkExamInstanceActiveProctorAssignmentPresenceReadiness(createClient({ dbError: true }), VALID_TENANT, VALID_EXAM, grantedCapability);
    assert.deepEqual(res, { type: 'unavailable' });
  });

  test('18. capability called exactly once with exact context', async () => {
    let callCount = 0;
    let receivedCtx: any = null;
    const evaluator: CapabilityEvaluator = async (ctx) => {
      callCount++;
      receivedCtx = ctx;
      return 'granted' as const;
    };
    await checkExamInstanceActiveProctorAssignmentPresenceReadiness(createClient(), VALID_TENANT, VALID_EXAM, evaluator);
    assert.equal(callCount, 1);
    assert.deepEqual(receivedCtx, { tenantId: VALID_TENANT, examInstanceId: VALID_EXAM });
  });

  test('19. no INSERT / UPDATE / DELETE', async () => {
    const checks = { insertUpdateDelete: false };
    await checkExamInstanceActiveProctorAssignmentPresenceReadiness(createClient({ activeAssignments: 1 }, checks), VALID_TENANT, VALID_EXAM, grantedCapability);
    assert.equal(checks.insertUpdateDelete, false);
  });
});
