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

function createClient(
  options: any = {},
  checks?: { insertUpdateDelete?: boolean; queriedContent?: boolean; queriedConflict?: boolean }
): PoolClient {
  return {
    query: async (text: string) => {
      if (/INSERT|UPDATE|DELETE/i.test(text)) {
        if (checks) checks.insertUpdateDelete = true;
      }
      
      if (options.dbError) throw new Error('DB Error');
      if (options.missingExam && text.includes('secure_assessment_exam_instances')) return { rows: [] };

      // Participant conflict query in BU-079
      if (text.includes('secure_assessment_exam_participants other_part')) {
        if (checks) checks.queriedConflict = true;
        if (options.conflict_unavailable) throw new Error('Conflict DB Error');
        if (options.participant_conflict) {
          return {
            rows: [
              {
                conflicting_exam_instance_id: '00000000-0000-0000-0000-000000000088',
                conflicting_count: 2,
              }
            ]
          };
        }
        return { rows: [] };
      }

      // Proctor conflict query in BU-079
      if (text.includes('secure_assessment_proctor_assignments other_proc')) {
        if (checks) checks.queriedConflict = true;
        if (options.conflict_unavailable) throw new Error('Conflict DB Error');
        if (options.proctor_conflict) {
          return {
            rows: [
              {
                conflicting_exam_instance_id: '00000000-0000-0000-0000-000000000089',
                conflicting_count: 1,
              }
            ]
          };
        }
        return { rows: [] };
      }

      let configuredAttemptDuration: number | null = 3600;
      let latestStartPolicy: string | null = 'FULL_DURATION_BEYOND_WINDOW';

      if (options.timing_configuration_missing || options.attempt_duration_missing) {
        configuredAttemptDuration = null;
      } else if (options.duration_window_incompatible) {
        configuredAttemptDuration = 10800; // > 7200s window duration
        latestStartPolicy = 'LATE_START_BLOCKED';
      }

      if (options.configured_attempt_duration_seconds !== undefined) {
        configuredAttemptDuration = options.configured_attempt_duration_seconds;
      }
      if (options.latest_start_policy !== undefined) {
        latestStartPolicy = options.latest_start_policy;
      }

      const row: any = {
        lifecycle_state: options.lifecycle_state || 'SCHEDULED',
        assessment_type_id: options.assessment_type_missing ? null : 'uuid',
        assessment_type_display_label: options.assessment_type_missing ? null : 'SUMMATIVE',
        snapshot_count: options.question_snapshot_presence_missing ? 0 : 5,
        participant_count: options.participant_presence_missing ? '0' : '5',
        window_starts_at: '2026-10-01T08:00:00.000Z',
        window_ends_at: '2026-10-01T10:00:00.000Z',
        configured_attempt_duration_seconds: configuredAttemptDuration,
        latest_start_policy: latestStartPolicy,
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
    const res = await checkExamInstanceBaselineReadinessChecksCompositionPreflight(
      createClient({ timing_configuration_missing: true }),
      VALID_TENANT,
      VALID_EXAM,
      () => 'granted'
    );
    assert.deepEqual(res, {
      type: 'not_ready',
      category: 'timing_configuration_presence',
      blocker: 'attempt_duration_missing'
    });
  });

  // 11. duration/window compatibility blocker preserved
  test('11. duration/window compatibility blocker preserved', async () => {
    const res = await checkExamInstanceBaselineReadinessChecksCompositionPreflight(
      createClient({ duration_window_incompatible: true }),
      VALID_TENANT,
      VALID_EXAM,
      () => 'granted'
    );
    assert.deepEqual(res, {
      type: 'not_ready',
      category: 'duration_window_policy_compatibility',
      blocker: 'attempt_duration_exceeds_window'
    });
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
    assert.equal((res as any).contentBlocker, 'question_type_invalid');
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

  // 23. earlier BU-065 blocker prevents conflict preflight execution
  test('23. earlier BU-065 blocker prevents conflict preflight execution', async () => {
    const checks = { queriedConflict: false };
    await checkExamInstanceBaselineReadinessChecksCompositionPreflight(
      createClient({ assessment_type_missing: true, participant_conflict: true }, checks),
      VALID_TENANT,
      VALID_EXAM,
      () => 'granted'
    );
    assert.equal(checks.queriedConflict, false);
  });

  // 24. participant conflict maps to category schedule_conflict
  test('24. participant conflict maps to category schedule_conflict', async () => {
    const res = await checkExamInstanceBaselineReadinessChecksCompositionPreflight(
      createClient({ participant_conflict: true }),
      VALID_TENANT,
      VALID_EXAM,
      () => 'granted'
    );
    assert.deepEqual(res, {
      type: 'not_ready',
      category: 'schedule_conflict',
      blocker: 'participant_schedule_conflict',
      conflictingExamInstanceId: '00000000-0000-0000-0000-000000000088',
      conflictingParticipantCount: 2,
    });
  });

  // 25. Proctor conflict maps to category schedule_conflict
  test('25. Proctor conflict maps to category schedule_conflict', async () => {
    const res = await checkExamInstanceBaselineReadinessChecksCompositionPreflight(
      createClient({ proctor_conflict: true }),
      VALID_TENANT,
      VALID_EXAM,
      () => 'granted'
    );
    assert.deepEqual(res, {
      type: 'not_ready',
      category: 'schedule_conflict',
      blocker: 'proctor_schedule_conflict',
      conflictingExamInstanceId: '00000000-0000-0000-0000-000000000089',
      conflictingProctorCount: 1,
    });
  });

  // 26. conflict prevents BU-067 content evaluation
  test('26. conflict prevents BU-067 content evaluation', async () => {
    const checks = { queriedContent: false };
    await checkExamInstanceBaselineReadinessChecksCompositionPreflight(
      createClient({ participant_conflict: true, invalidContent: true }, checks),
      VALID_TENANT,
      VALID_EXAM,
      () => 'granted'
    );
    assert.equal(checks.queriedContent, false);
  });

  // 27. no conflict proceeds to BU-067
  test('27. no conflict proceeds to BU-067', async () => {
    const checks = { queriedContent: false, queriedConflict: false };
    const res = await checkExamInstanceBaselineReadinessChecksCompositionPreflight(
      createClient({ invalidContent: true }, checks),
      VALID_TENANT,
      VALID_EXAM,
      () => 'granted'
    );
    assert.equal(checks.queriedConflict, true);
    assert.equal(checks.queriedContent, true);
    assert.equal(res.type, 'not_ready');
    if (res.type === 'not_ready') {
      assert.equal(res.category, 'question_snapshot_content');
    }
  });

  // 28. existing content blockers remain preserved
  test('28. existing content blockers remain preserved', async () => {
    const res = await checkExamInstanceBaselineReadinessChecksCompositionPreflight(
      createClient({ question_snapshot_empty: true }),
      VALID_TENANT,
      VALID_EXAM,
      () => 'granted'
    );
    assert.deepEqual(res, {
      type: 'not_ready',
      category: 'question_snapshot_content',
      blocker: 'question_snapshot_empty',
    });
  });

  // 29. no-conflict successful path remains baseline_readiness_checks_pass
  test('29. no-conflict successful path remains baseline_readiness_checks_pass', async () => {
    const res = await checkExamInstanceBaselineReadinessChecksCompositionPreflight(
      createClient({}),
      VALID_TENANT,
      VALID_EXAM,
      () => 'granted'
    );
    assert.deepEqual(res, {
      type: 'baseline_readiness_checks_pass',
      examInstanceId: VALID_EXAM,
      tenantId: VALID_TENANT,
    });
  });

  // 30. top-level external capability evaluator remains exactly once
  test('30. top-level external capability evaluator remains exactly once', async () => {
    let callCount = 0;
    const res = await checkExamInstanceBaselineReadinessChecksCompositionPreflight(
      createClient({}),
      VALID_TENANT,
      VALID_EXAM,
      () => {
        callCount++;
        return 'granted';
      }
    );
    assert.equal(res.type, 'baseline_readiness_checks_pass');
    assert.equal(callCount, 1);
  });

  // 31. denied/unavailable/invalid_state remain fail-closed
  test('31. denied/unavailable/invalid_state remain fail-closed', async () => {
    const resUnavailable = await checkExamInstanceBaselineReadinessChecksCompositionPreflight(
      createClient({ conflict_unavailable: true }),
      VALID_TENANT,
      VALID_EXAM,
      () => 'granted'
    );
    assert.deepEqual(resUnavailable, { type: 'unavailable' });

    const resDenied = await checkExamInstanceBaselineReadinessChecksCompositionPreflight(
      createClient({}),
      VALID_TENANT,
      VALID_EXAM,
      () => 'denied'
    );
    assert.deepEqual(resDenied, { type: 'denied' });
  });
});
