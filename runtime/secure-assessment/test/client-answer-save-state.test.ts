import test from 'node:test';
import assert from 'node:assert';
import { 
  type ClientAnswerMutationRecord, 
  type ClientAnswerSyncIdentity 
} from '../src/client-answer-sync.js';
import { projectClientAnswerSaveState } from '../src/client-answer-save-state.js';

const mockIdentity: ClientAnswerSyncIdentity = {
  tenantId: 'tenant-1',
  participantId: 'participant-1',
  examInstanceId: 'exam-1',
  attemptId: 'attempt-1',
  snapshotId: 'snap-1'
};

const createMockMutation = (overrides: Partial<ClientAnswerMutationRecord> = {}): ClientAnswerMutationRecord => {
  return {
    identity: { ...mockIdentity },
    localSequence: 1,
    answerPayload: { val: 1 },
    clientWriteIdentity: 'client-1',
    expectedWriteVersion: null,
    syncState: 'pending',
    acceptedWriteVersion: null,
    ...overrides
  };
};

test('BU-030 projectClientAnswerSaveState', async (t) => {
  await t.test('1. acknowledged + accepted version -> saved', () => {
    const mutation = createMockMutation({ syncState: 'acknowledged', acceptedWriteVersion: 10 });
    assert.strictEqual(projectClientAnswerSaveState(mutation, false), 'saved');
  });

  await t.test('2. in_flight online -> saving', () => {
    const mutation = createMockMutation({ syncState: 'in_flight' });
    assert.strictEqual(projectClientAnswerSaveState(mutation, false), 'saving');
  });

  await t.test('3. pending online -> pending', () => {
    const mutation = createMockMutation({ syncState: 'pending' });
    assert.strictEqual(projectClientAnswerSaveState(mutation, false), 'pending');
  });

  await t.test('4. pending offline -> offline', () => {
    const mutation = createMockMutation({ syncState: 'pending' });
    assert.strictEqual(projectClientAnswerSaveState(mutation, true), 'offline');
  });

  await t.test('5. in_flight offline -> offline', () => {
    const mutation = createMockMutation({ syncState: 'in_flight' });
    assert.strictEqual(projectClientAnswerSaveState(mutation, true), 'offline');
  });

  await t.test('6. failed online -> save_failed', () => {
    const mutation = createMockMutation({ syncState: 'failed' });
    assert.strictEqual(projectClientAnswerSaveState(mutation, false), 'save_failed');
  });

  await t.test('7. failed offline -> save_failed', () => {
    const mutation = createMockMutation({ syncState: 'failed' });
    assert.strictEqual(projectClientAnswerSaveState(mutation, true), 'save_failed');
  });

  await t.test('8. acknowledged without acceptedWriteVersion -> never saved', () => {
    const mutation = createMockMutation({ syncState: 'acknowledged', acceptedWriteVersion: null });
    assert.strictEqual(projectClientAnswerSaveState(mutation, false), 'save_failed');
  });

  await t.test('9. valid acknowledged while currently offline remains saved', () => {
    const mutation = createMockMutation({ syncState: 'acknowledged', acceptedWriteVersion: 10 });
    assert.strictEqual(projectClientAnswerSaveState(mutation, true), 'saved');
  });

  await t.test('10. input record is not mutated', () => {
    const mutation = createMockMutation({ syncState: 'in_flight' });
    const originalJson = JSON.stringify(mutation);
    const result = projectClientAnswerSaveState(mutation, false);
    assert.strictEqual(result, 'saving');
    assert.strictEqual(JSON.stringify(mutation), originalJson, 'Mutation should not be modified');
  });
});
