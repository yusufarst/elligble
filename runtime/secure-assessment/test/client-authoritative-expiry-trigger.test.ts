import { test, describe } from 'node:test';
import * as assert from 'node:assert';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { triggerAuthoritativeExpiry } from '../src/client-authoritative-expiry-trigger.ts';
import type { AuthoritativeAssessmentObservation } from '../src/client-authoritative-expiry-trigger.ts';
import type { ClientAnswerRecoveryScope, ClientAnswerRecoveryStore } from '../src/client-answer-recovery-store.ts';
import type { ClientAnswerSynchronizationExecutor } from '../src/client-answer-reconciliation-queue.ts';
import type { ExpiryFinalizationExecutor, ExpiryFinalizationResult, AuthoritativeExpiryFinalizationReceipt } from '../src/client-expiry-finalization.ts';
import { finalizeAuthoritativeExpiry } from '../src/client-expiry-finalization.ts';

describe('BU-032 Secure Assessment Client Server-Derived Expiry Observation Finalization Trigger', () => {
  const defaultScope: ClientAnswerRecoveryScope = {
    tenantId: 'tenant-1',
    participantId: 'participant-1',
    examInstanceId: 'exam-1',
    attemptId: 'attempt-1'
  };

  const createMockStore = (): ClientAnswerRecoveryStore => ({
    put: async () => {},
    get: async () => null,
    listByScope: async () => [],
    delete: async () => {},
    clearScope: async () => {}
  });

  const createMockSyncExecutor = (): ClientAnswerSynchronizationExecutor => {
    return async () => ({ status: 'acknowledged', acceptedWriteVersion: 1, clientWriteIdentity: 'id-1', writeVersion: 1 });
  };

  const createMockFinalizationExecutor = (): ExpiryFinalizationExecutor => {
    return async () => ({ status: 'submitted', submissionId: 's-1', submittedAt: 'time' });
  };

  const createMockObservation = (overrides?: Partial<AuthoritativeAssessmentObservation>): AuthoritativeAssessmentObservation => {
    return {
      attemptId: 'attempt-1',
      timer: { status: 'active', effectiveRemainingSeconds: 0 },
      submission: { status: 'not_submitted' },
      ...overrides
    } as AuthoritativeAssessmentObservation;
  };

  // 1. timer not started + not submitted
  test('returns not_expired when timer is not started and not submitted', async () => {
    let coordinatorCalls = 0;
    const coordinator: typeof finalizeAuthoritativeExpiry = async () => {
      coordinatorCalls++;
      return { status: 'submitted', submissionId: 's1', submittedAt: 't1' };
    };

    const obs = createMockObservation({ timer: { status: 'not_started' } });
    const result = await triggerAuthoritativeExpiry(
      defaultScope, obs, createMockStore(), createMockSyncExecutor(), createMockFinalizationExecutor(), coordinator
    );
    assert.deepStrictEqual(result, { status: 'not_expired' });
    assert.strictEqual(coordinatorCalls, 0);
  });

  // 2. positive remaining
  test('returns not_expired when timer is active and effectiveRemainingSeconds > 0', async () => {
    let coordinatorCalls = 0;
    const coordinator: typeof finalizeAuthoritativeExpiry = async () => {
      coordinatorCalls++;
      return { status: 'submitted', submissionId: 's1', submittedAt: 't1' };
    };

    const obs = createMockObservation({ timer: { status: 'active', effectiveRemainingSeconds: 10 } });
    const result = await triggerAuthoritativeExpiry(
      defaultScope, obs, createMockStore(), createMockSyncExecutor(), createMockFinalizationExecutor(), coordinator
    );
    assert.deepStrictEqual(result, { status: 'not_expired' });
    assert.strictEqual(coordinatorCalls, 0);
  });

  // 3. remaining = 0 + not_submitted
  test('invokes coordinator exactly once when remaining time is 0 and not submitted', async () => {
    let coordinatorCalls = 0;
    const coordinator: typeof finalizeAuthoritativeExpiry = async () => {
      coordinatorCalls++;
      return { status: 'submitted', submissionId: 's1', submittedAt: 't1' };
    };

    const obs = createMockObservation();
    await triggerAuthoritativeExpiry(
      defaultScope, obs, createMockStore(), createMockSyncExecutor(), createMockFinalizationExecutor(), coordinator
    );
    assert.strictEqual(coordinatorCalls, 1);
  });

  // 4. coordinator submitted
  test('propagates submitted receipt object identity from coordinator', async () => {
    const mockReceipt: ExpiryFinalizationResult = { status: 'submitted', submissionId: 's1', submittedAt: 't1' };
    const coordinator: typeof finalizeAuthoritativeExpiry = async () => mockReceipt;

    const obs = createMockObservation();
    const result = await triggerAuthoritativeExpiry(
      defaultScope, obs, createMockStore(), createMockSyncExecutor(), createMockFinalizationExecutor(), coordinator
    );
    assert.strictEqual(result, mockReceipt);
  });

  // 5. coordinator pending_answers_unresolved
  test('propagates pending_answers_unresolved from coordinator', async () => {
    const coordinator: typeof finalizeAuthoritativeExpiry = async () => ({ status: 'pending_answers_unresolved' });

    const obs = createMockObservation();
    const result = await triggerAuthoritativeExpiry(
      defaultScope, obs, createMockStore(), createMockSyncExecutor(), createMockFinalizationExecutor(), coordinator
    );
    assert.deepStrictEqual(result, { status: 'pending_answers_unresolved' });
  });

  // 6. coordinator finalization_uncertain
  test('propagates finalization_uncertain from coordinator', async () => {
    const coordinator: typeof finalizeAuthoritativeExpiry = async () => ({ status: 'finalization_uncertain' });

    const obs = createMockObservation();
    const result = await triggerAuthoritativeExpiry(
      defaultScope, obs, createMockStore(), createMockSyncExecutor(), createMockFinalizationExecutor(), coordinator
    );
    assert.deepStrictEqual(result, { status: 'finalization_uncertain' });
  });

  // 7. already submitted observation
  test('returns supplied submission receipt object identity when already submitted, without calling coordinator', async () => {
    let coordinatorCalls = 0;
    const coordinator: typeof finalizeAuthoritativeExpiry = async () => {
      coordinatorCalls++;
      return { status: 'submitted', submissionId: 's-bad', submittedAt: 't-bad' };
    };

    const receipt = { status: 'submitted' as const, submissionId: 's1', submittedAt: 't1' };
    const obs = createMockObservation({ submission: receipt });
    const result = await triggerAuthoritativeExpiry(
      defaultScope, obs, createMockStore(), createMockSyncExecutor(), createMockFinalizationExecutor(), coordinator
    );
    assert.strictEqual(result, receipt);
    assert.strictEqual(coordinatorCalls, 0);
  });

  // 8. attemptId mismatch
  test('returns authoritative_state_invalid on attemptId mismatch', async () => {
    let coordinatorCalls = 0;
    const coordinator: typeof finalizeAuthoritativeExpiry = async () => {
      coordinatorCalls++;
      return { status: 'submitted', submissionId: 's1', submittedAt: 't1' };
    };

    const obs = createMockObservation({ attemptId: 'attempt-2' });
    const result = await triggerAuthoritativeExpiry(
      defaultScope, obs, createMockStore(), createMockSyncExecutor(), createMockFinalizationExecutor(), coordinator
    );
    assert.deepStrictEqual(result, { status: 'authoritative_state_invalid' });
    assert.strictEqual(coordinatorCalls, 0);
  });

  // 9. empty/whitespace attemptId
  test('returns authoritative_state_invalid on empty or whitespace attemptId', async () => {
    const obs1 = createMockObservation({ attemptId: '' });
    const res1 = await triggerAuthoritativeExpiry(defaultScope, obs1, createMockStore(), createMockSyncExecutor(), createMockFinalizationExecutor());
    assert.deepStrictEqual(res1, { status: 'authoritative_state_invalid' });

    const obs2 = createMockObservation({ attemptId: '   ' });
    const res2 = await triggerAuthoritativeExpiry(defaultScope, obs2, createMockStore(), createMockSyncExecutor(), createMockFinalizationExecutor());
    assert.deepStrictEqual(res2, { status: 'authoritative_state_invalid' });
  });

  // 10. negative remaining
  test('returns authoritative_state_invalid on negative remaining time', async () => {
    const obs = createMockObservation({ timer: { status: 'active', effectiveRemainingSeconds: -1 } });
    const res = await triggerAuthoritativeExpiry(defaultScope, obs, createMockStore(), createMockSyncExecutor(), createMockFinalizationExecutor());
    assert.deepStrictEqual(res, { status: 'authoritative_state_invalid' });
  });

  // 11. fractional remaining
  test('returns authoritative_state_invalid on fractional remaining time', async () => {
    const obs = createMockObservation({ timer: { status: 'active', effectiveRemainingSeconds: 5.5 } });
    const res = await triggerAuthoritativeExpiry(defaultScope, obs, createMockStore(), createMockSyncExecutor(), createMockFinalizationExecutor());
    assert.deepStrictEqual(res, { status: 'authoritative_state_invalid' });
  });

  // 12. NaN remaining
  test('returns authoritative_state_invalid on NaN remaining time', async () => {
    const obs = createMockObservation({ timer: { status: 'active', effectiveRemainingSeconds: NaN } });
    const res = await triggerAuthoritativeExpiry(defaultScope, obs, createMockStore(), createMockSyncExecutor(), createMockFinalizationExecutor());
    assert.deepStrictEqual(res, { status: 'authoritative_state_invalid' });
  });

  // 13. unsafe integer remaining
  test('returns authoritative_state_invalid on unsafe integer remaining time', async () => {
    const obs = createMockObservation({ timer: { status: 'active', effectiveRemainingSeconds: Number.MAX_SAFE_INTEGER + 1 } });
    const res = await triggerAuthoritativeExpiry(defaultScope, obs, createMockStore(), createMockSyncExecutor(), createMockFinalizationExecutor());
    assert.deepStrictEqual(res, { status: 'authoritative_state_invalid' });
  });

  // 14. blank/whitespace submissionId
  test('returns authoritative_state_invalid on blank or whitespace submissionId in submitted receipt', async () => {
    const obs1 = createMockObservation({ submission: { status: 'submitted', submissionId: '', submittedAt: 't1' } });
    const res1 = await triggerAuthoritativeExpiry(defaultScope, obs1, createMockStore(), createMockSyncExecutor(), createMockFinalizationExecutor());
    assert.deepStrictEqual(res1, { status: 'authoritative_state_invalid' });

    const obs2 = createMockObservation({ submission: { status: 'submitted', submissionId: '   ', submittedAt: 't1' } });
    const res2 = await triggerAuthoritativeExpiry(defaultScope, obs2, createMockStore(), createMockSyncExecutor(), createMockFinalizationExecutor());
    assert.deepStrictEqual(res2, { status: 'authoritative_state_invalid' });
  });

  // 15. blank/whitespace submittedAt
  test('returns authoritative_state_invalid on blank or whitespace submittedAt in submitted receipt', async () => {
    const obs1 = createMockObservation({ submission: { status: 'submitted', submissionId: 's1', submittedAt: '' } });
    const res1 = await triggerAuthoritativeExpiry(defaultScope, obs1, createMockStore(), createMockSyncExecutor(), createMockFinalizationExecutor());
    assert.deepStrictEqual(res1, { status: 'authoritative_state_invalid' });

    const obs2 = createMockObservation({ submission: { status: 'submitted', submissionId: 's1', submittedAt: '   ' } });
    const res2 = await triggerAuthoritativeExpiry(defaultScope, obs2, createMockStore(), createMockSyncExecutor(), createMockFinalizationExecutor());
    assert.deepStrictEqual(res2, { status: 'authoritative_state_invalid' });
  });

  // 16. supplied observation and scope remain unmutated
  test('observation and scope are not mutated', async () => {
    const originalScope = JSON.stringify(defaultScope);
    const originalObs = JSON.stringify(createMockObservation());

    const scope = JSON.parse(originalScope);
    const obs = JSON.parse(originalObs);

    const coordinator: typeof finalizeAuthoritativeExpiry = async () => ({ status: 'submitted', submissionId: 's1', submittedAt: 't1' });
    await triggerAuthoritativeExpiry(scope, obs, createMockStore(), createMockSyncExecutor(), createMockFinalizationExecutor(), coordinator);

    assert.strictEqual(JSON.stringify(scope), originalScope);
    assert.strictEqual(JSON.stringify(obs), originalObs);
  });

  // 17. source-level prohibition check
  test('source contains no device-clock or scheduler implementation', () => {
    const sourceCode = fs.readFileSync(path.join(import.meta.dirname, '../src/client-authoritative-expiry-trigger.ts'), 'utf8');

    assert.ok(!sourceCode.includes('Date.now'), 'Must not contain Date.now');
    assert.ok(!sourceCode.includes('new Date('), 'Must not contain new Date(');
    assert.ok(!sourceCode.includes('performance.now'), 'Must not contain performance.now');
    assert.ok(!sourceCode.includes('setInterval'), 'Must not contain setInterval');
    assert.ok(!sourceCode.includes('setTimeout'), 'Must not contain setTimeout');
  });
});
