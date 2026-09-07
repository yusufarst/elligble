import { test, describe } from 'node:test';
import * as assert from 'node:assert/strict';
import type { PoolClient } from 'pg';
import { checkExamInstanceBaselineReadinessChecksCompositionPreflight } from '../src/exam-instance-baseline-readiness-checks-composition-preflight.ts';

const VALID_TENANT = '00000000-0000-0000-0000-000000000001';
const VALID_EXAM = '00000000-0000-0000-0000-000000000002';

const validContent = {
  schemaVersion: 1,
  questionType: 'MULTIPLE_CHOICE_SINGLE',
  prompt: { text: 'Q1' },
  options: [
    { id: '1', content: { text: 'A' } },
    { id: '2', content: { text: 'B' } },
    { id: '3', content: { text: 'C' } },
    { id: '4', content: { text: 'D' } },
    { id: '5', content: { text: 'E' } }
  ],
  correctOptionId: '1',
  maxScore: 5
};

function createClient(options: any = {}, checks?: { insertUpdateDelete?: boolean; queriedContent?: boolean }): PoolClient {
  return {
    query: async (text: string) => {
      if (/INSERT|UPDATE|DELETE/i.test(text)) {
        if (checks) checks.insertUpdateDelete = true;
      }
      
      if (options.dbError) throw new Error('DB Error');
      if (options.missingExam && text.includes('secure_assessment_exam_instances')) return { rows: [] };

      const row: any = {
        lifecycle_state: options.lifecycle_state || 'SCHEDULED',
        assessment_type_id: options.assessment_type_missing ? null : 'uuid',
        assessment_type_display_label: options.assessment_type_missing ? null : 'SUMMATIVE',
        snapshot_count: options.question_snapshot_presence_missing ? 0 : 5,
        participant_count: options.participant_presence_missing ? '0' : '5',
        window_starts_at: options.timing_configuration_missing ? null : new Date(Date.now() - 10000),
        window_ends_at: options.timing_configuration_missing ? null : new Date(Date.now() + 10000),
        configured_attempt_duration_seconds: options.attempt_duration_missing ? null : 3600,
        latest_start_policy: options.duration_window_policy_invalid ? 'INVALID_POLICY' : 'FULL_DURATION_BEYOND_WINDOW',
      };

      if (text.includes('ORDER BY s.id ASC')) {
        if (checks) checks.queriedContent = true;
        if (options.question_snapshot_empty) {
          return { rows: [{ ...row, snapshot_id: null, frozen_content: null }] };
        }
        const content = options.invalidContent ? { ...validContent, questionType: 'INVALID' } : validContent;
        return { rows: [{ ...row, snapshot_id: 'snapshot-id-123', frozen_content: content }] };
      }

      return { rows: [row] };
    }
  } as unknown as PoolClient;
}

describe('BU-068: Baseline Readiness Checks Composition Preflight', () => {
  // 1. invalid tenant UUID -> denied
  test('1. invalid tenant UUID -> denied', async () => {
    const res = await checkExamInstanceBaselineReadinessChecksCompositionPreflight(createClient(), 'invalid', VALID_EXAM, () => 'granted');
    assert.deepEqual(res, { type: 'denied' });
  });

  // 2. invalid exam UUID -> denied
  test('2. invalid exam UUID -> denied', async () => {
    const res = await checkExamInstanceBaselineReadinessChecksCompositionPreflight(createClient(), VALID_TENANT, 'invalid', () => 'granted');
    assert.deepEqual(res, { type: 'denied' });
  });

  // 3. outer capability denied -> denied
  test('3. outer capability denied -> denied', async () => {
    const res = await checkExamInstanceBaselineReadinessChecksCompositionPreflight(createClient(), VALID_TENANT, VALID_EXAM, () => 'denied');
    assert.deepEqual(res, { type: 'denied' });
  });

  // 4. outer capability unavailable -> unavailable
  test('4. outer capability unavailable -> unavailable', async () => {
    const res = await checkExamInstanceBaselineReadinessChecksCompositionPreflight(createClient(), VALID_TENANT, VALID_EXAM, () => 'unavailable');
    assert.deepEqual(res, { type: 'unavailable' });
  });

  // 5. outer capability throws -> unavailable
  test('5. outer capability throws -> unavailable', async () => {
    const res = await checkExamInstanceBaselineReadinessChecksCompositionPreflight(createClient(), VALID_TENANT, VALID_EXAM, () => { throw new Error(); });
    assert.deepEqual(res, { type: 'unavailable' });
  });

  // 6. all six baseline checks pass -> baseline_readiness_checks_pass
  test('6. all six baseline checks pass -> baseline_readiness_checks_pass', async () => {
    const res = await checkExamInstanceBaselineReadinessChecksCompositionPreflight(createClient(), VALID_TENANT, VALID_EXAM, () => 'granted');
    assert.deepEqual(res, { type: 'baseline_readiness_checks_pass', examInstanceId: VALID_EXAM, tenantId: VALID_TENANT });
  });

  // 7. assessment type blocker remains first
  test('7. assessment type blocker remains first', async () => {
    const res = await checkExamInstanceBaselineReadinessChecksCompositionPreflight(createClient({ assessment_type_missing: true }), VALID_TENANT, VALID_EXAM, () => 'granted');
    assert.deepEqual(res, { type: 'not_ready', category: 'assessment_type', blocker: 'assessment_type_missing' });
  });

  // 8. question snapshot presence blocker preserved
  test('8. question snapshot presence blocker preserved', async () => {
    const res = await checkExamInstanceBaselineReadinessChecksCompositionPreflight(createClient({ question_snapshot_presence_missing: true }), VALID_TENANT, VALID_EXAM, () => 'granted');
    assert.deepEqual(res, { type: 'not_ready', category: 'question_snapshot_presence', blocker: 'question_snapshot_empty' });
  });

  // 9. participant presence blocker preserved
  test('9. participant presence blocker preserved', async () => {
    const res = await checkExamInstanceBaselineReadinessChecksCompositionPreflight(createClient({ participant_presence_missing: true }), VALID_TENANT, VALID_EXAM, () => 'granted');
    assert.deepEqual(res, { type: 'not_ready', category: 'participant_presence', blocker: 'participant_empty' });
  });

  // 10. timing configuration blocker preserved
  test('10. timing configuration blocker preserved', async () => {
    const res = await checkExamInstanceBaselineReadinessChecksCompositionPreflight(createClient({ timing_configuration_missing: true }), VALID_TENANT, VALID_EXAM, () => 'granted');
    assert.deepEqual(res, { type: 'not_ready', category: 'timing_configuration_presence', blocker: 'window_starts_at_missing' }); // from BU-063 assuming window_starts_at_missing
  });

  // 11. duration/window compatibility blocker preserved
  test('11. duration/window compatibility blocker preserved', async () => {
    const res = await checkExamInstanceBaselineReadinessChecksCompositionPreflight(createClient({ attempt_duration_missing: true }), VALID_TENANT, VALID_EXAM, () => 'granted');
    assert.deepEqual(res, { type: 'not_ready', category: 'duration_window_policy_compatibility', blocker: 'attempt_duration_missing' });
  });

  // 12. BU-067 question_snapshot_empty mapped to category question_snapshot_content
  test('12. BU-067 question_snapshot_empty mapped to category question_snapshot_content', async () => {
    const res = await checkExamInstanceBaselineReadinessChecksCompositionPreflight(createClient({ question_snapshot_empty: true }), VALID_TENANT, VALID_EXAM, () => 'granted');
    assert.deepEqual(res, { type: 'not_ready', category: 'question_snapshot_content', blocker: 'question_snapshot_empty' });
  });

  // 13. BU-067 invalid frozen_content mapped with exact question_snapshot_content_invalid
  test('13. BU-067 invalid frozen_content mapped with exact question_snapshot_content_invalid', async () => {
    const res = await checkExamInstanceBaselineReadinessChecksCompositionPreflight(createClient({ invalidContent: true }), VALID_TENANT, VALID_EXAM, () => 'granted');
    assert.equal(res.type, 'not_ready');
    assert.equal((res as any).category, 'question_snapshot_content');
    assert.equal((res as any).blocker, 'question_snapshot_content_invalid');
  });

  // 14. snapshotId preserved
  test('14. snapshotId preserved', async () => {
    const res = await checkExamInstanceBaselineReadinessChecksCompositionPreflight(createClient({ invalidContent: true }), VALID_TENANT, VALID_EXAM, () => 'granted');
    assert.equal((res as any).snapshotId, 'snapshot-id-123');
  });

  // 15. BU-066 contentBlocker preserved exactly
  test('15. BU-066 contentBlocker preserved exactly', async () => {
    const res = await checkExamInstanceBaselineReadinessChecksCompositionPreflight(createClient({ invalidContent: true }), VALID_TENANT, VALID_EXAM, () => 'granted');
    assert.equal((res as any).contentBlocker, 'question_type_invalid'); // from my mock returning questionType: 'INVALID'
  });

  // 16. existing readiness blocker wins before content blocker
  test('16. existing readiness blocker wins before content blocker', async () => {
    const res = await checkExamInstanceBaselineReadinessChecksCompositionPreflight(
      createClient({ assessment_type_missing: true, invalidContent: true }), 
      VALID_TENANT, VALID_EXAM, () => 'granted'
    );
    assert.deepEqual(res, { type: 'not_ready', category: 'assessment_type', blocker: 'assessment_type_missing' });
  });

  // 17. non-SCHEDULED lifecycle -> invalid_state
  test('17. non-SCHEDULED lifecycle -> invalid_state', async () => {
    const res = await checkExamInstanceBaselineReadinessChecksCompositionPreflight(createClient({ lifecycle_state: 'DRAFT' }), VALID_TENANT, VALID_EXAM, () => 'granted');
    assert.deepEqual(res, { type: 'invalid_state' });
  });

  // 18. same-tenant nonexistent/inaccessible Exam Instance -> denied
  test('18. same-tenant nonexistent/inaccessible Exam Instance -> denied', async () => {
    const res = await checkExamInstanceBaselineReadinessChecksCompositionPreflight(createClient({ missingExam: true }), VALID_TENANT, VALID_EXAM, () => 'granted');
    assert.deepEqual(res, { type: 'denied' });
  });

  // 19. database/predecessor query failure -> unavailable
  test('19. database/predecessor query failure -> unavailable', async () => {
    const res = await checkExamInstanceBaselineReadinessChecksCompositionPreflight(createClient({ dbError: true }), VALID_TENANT, VALID_EXAM, () => 'granted');
    assert.deepEqual(res, { type: 'unavailable' });
  });

  // 20. no INSERT / UPDATE / DELETE issued by composition
  test('20. no INSERT / UPDATE / DELETE issued by composition', async () => {
    const checks = { insertUpdateDelete: false };
    await checkExamInstanceBaselineReadinessChecksCompositionPreflight(createClient({}, checks), VALID_TENANT, VALID_EXAM, () => 'granted');
    assert.equal(checks.insertUpdateDelete, false);
  });

  // 21. external capability evaluator is invoked once only
  test('21. external capability evaluator is invoked once only', async () => {
    let count = 0;
    await checkExamInstanceBaselineReadinessChecksCompositionPreflight(createClient(), VALID_TENANT, VALID_EXAM, () => { count++; return 'granted'; });
    assert.equal(count, 1);
  });

  // 22. content preflight is reached only after existing readiness composition has passed
  test('22. content preflight is reached only after existing readiness composition has passed', async () => {
    const checks = { queriedContent: false };
    // Trigger existing readiness block
    await checkExamInstanceBaselineReadinessChecksCompositionPreflight(createClient({ assessment_type_missing: true }, checks), VALID_TENANT, VALID_EXAM, () => 'granted');
    assert.equal(checks.queriedContent, false);

    const checksPass = { queriedContent: false };
    await checkExamInstanceBaselineReadinessChecksCompositionPreflight(createClient({}, checksPass), VALID_TENANT, VALID_EXAM, () => 'granted');
    assert.equal(checksPass.queriedContent, true);
  });
});
