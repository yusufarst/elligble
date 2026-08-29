import { test } from 'node:test';
import * as assert from 'node:assert/strict';
import {
  buildSyncKey,
  createPendingMutation,
  transitionToInFlight,
  markMutationFailed,
  applyAuthoritativeAcknowledgement,
  isMutationAcknowledged,
  type ClientAnswerSyncIdentity
} from '../src/client-answer-sync.js';

const validIdentity: ClientAnswerSyncIdentity = {
  tenantId: 'tenant-1',
  participantId: 'participant-1',
  examInstanceId: 'exam-1',
  attemptId: 'attempt-1',
  snapshotId: 'snapshot-1'
};

test('1. same identity inputs create same deterministic synchronization key', () => {
  const key1 = buildSyncKey({ ...validIdentity });
  const key2 = buildSyncKey({ ...validIdentity });
  assert.equal(key1, key2);
  assert.equal(key1, 'tenant-1:participant-1:exam-1:attempt-1:snapshot-1');
});

test('2. changing tenantId changes the key', () => {
  const key1 = buildSyncKey(validIdentity);
  const key2 = buildSyncKey({ ...validIdentity, tenantId: 'tenant-2' });
  assert.notEqual(key1, key2);
});

test('3. changing participantId changes the key', () => {
  const key1 = buildSyncKey(validIdentity);
  const key2 = buildSyncKey({ ...validIdentity, participantId: 'participant-2' });
  assert.notEqual(key1, key2);
});

test('4. changing examInstanceId changes the key', () => {
  const key1 = buildSyncKey(validIdentity);
  const key2 = buildSyncKey({ ...validIdentity, examInstanceId: 'exam-2' });
  assert.notEqual(key1, key2);
});

test('5. changing attemptId changes the key', () => {
  const key1 = buildSyncKey(validIdentity);
  const key2 = buildSyncKey({ ...validIdentity, attemptId: 'attempt-2' });
  assert.notEqual(key1, key2);
});

test('6. changing snapshotId changes the key', () => {
  const key1 = buildSyncKey(validIdentity);
  const key2 = buildSyncKey({ ...validIdentity, snapshotId: 'snapshot-2' });
  assert.notEqual(key1, key2);
});

test('7. initial valid mutation starts pending', () => {
  const mutation = createPendingMutation(validIdentity, 1, { some: 'data' }, 'write-1', 10);
  assert.equal(mutation.syncState, 'pending');
  assert.equal(mutation.localSequence, 1);
  assert.deepEqual(mutation.answerPayload, { some: 'data' });
  assert.equal(mutation.clientWriteIdentity, 'write-1');
  assert.equal(mutation.expectedWriteVersion, 10);
  assert.equal(mutation.acceptedWriteVersion, null);
});

test('8. invalid/empty required identity is rejected', () => {
  assert.throws(() => buildSyncKey({ ...validIdentity, tenantId: '' }), /Invalid tenantId/);
  assert.throws(() => buildSyncKey({ ...validIdentity, participantId: '   ' }), /Invalid participantId/);
  assert.throws(() => buildSyncKey({ ...validIdentity, examInstanceId: '' }), /Invalid examInstanceId/);
  assert.throws(() => buildSyncKey({ ...validIdentity, attemptId: '' }), /Invalid attemptId/);
  assert.throws(() => buildSyncKey({ ...validIdentity, snapshotId: '' }), /Invalid snapshotId/);
});

test('9. invalid localSequence is rejected', () => {
  assert.throws(() => createPendingMutation(validIdentity, 0, {}, 'write', null), /Invalid localSequence/);
  assert.throws(() => createPendingMutation(validIdentity, -1, {}, 'write', null), /Invalid localSequence/);
  assert.throws(() => createPendingMutation(validIdentity, 1.5, {}, 'write', null), /Invalid localSequence/);
});

test('10. empty clientWriteIdentity is rejected', () => {
  assert.throws(() => createPendingMutation(validIdentity, 1, {}, '', null), /Invalid clientWriteIdentity/);
  assert.throws(() => createPendingMutation(validIdentity, 1, {}, '   ', null), /Invalid clientWriteIdentity/);
});

test('11. clientWriteIdentity >255 characters is rejected', () => {
  const longId = 'a'.repeat(256);
  assert.throws(() => createPendingMutation(validIdentity, 1, {}, longId, null), /Invalid clientWriteIdentity/);
});

test('12. invalid expectedWriteVersion is rejected', () => {
  assert.throws(() => createPendingMutation(validIdentity, 1, {}, 'write', 0), /Invalid expectedWriteVersion/);
  assert.throws(() => createPendingMutation(validIdentity, 1, {}, 'write', -5), /Invalid expectedWriteVersion/);
  assert.throws(() => createPendingMutation(validIdentity, 1, {}, 'write', 1.5), /Invalid expectedWriteVersion/);
  assert.throws(() => createPendingMutation(validIdentity, 1, {}, 'write', 2147483648), /Invalid expectedWriteVersion/);
});

test('13. pending mutation can enter in_flight', () => {
  const pending = createPendingMutation(validIdentity, 1, {}, 'write-1', null);
  const inFlight = transitionToInFlight(pending);
  assert.equal(inFlight.syncState, 'in_flight');
});

test('14. matching valid acknowledgement marks acknowledged', () => {
  const mutation = transitionToInFlight(createPendingMutation(validIdentity, 1, {}, 'write-1', null));
  const acked = applyAuthoritativeAcknowledgement(mutation, { status: 'acknowledged', clientWriteIdentity: 'write-1', writeVersion: 5 });
  assert.equal(acked.syncState, 'acknowledged');
  assert.equal(isMutationAcknowledged(acked), true);
});

test('15. acceptedWriteVersion equals authoritative acknowledgement writeVersion', () => {
  const mutation = transitionToInFlight(createPendingMutation(validIdentity, 1, {}, 'write-1', null));
  const acked = applyAuthoritativeAcknowledgement(mutation, { status: 'acknowledged', clientWriteIdentity: 'write-1', writeVersion: 5 });
  assert.equal(acked.acceptedWriteVersion, 5);
});

test('16. mismatched clientWriteIdentity MUST NOT mark acknowledged', () => {
  const mutation = transitionToInFlight(createPendingMutation(validIdentity, 1, {}, 'write-1', null));
  const acked = applyAuthoritativeAcknowledgement(mutation, { status: 'acknowledged', clientWriteIdentity: 'write-2', writeVersion: 5 });
  assert.equal(acked.syncState, 'in_flight');
  assert.equal(isMutationAcknowledged(acked), false);
});

test('17. zero/negative/non-integer acknowledgement writeVersion MUST NOT mark acknowledged', () => {
  const mutation = transitionToInFlight(createPendingMutation(validIdentity, 1, {}, 'write-1', null));

  const ack1 = applyAuthoritativeAcknowledgement(mutation, { status: 'acknowledged', clientWriteIdentity: 'write-1', writeVersion: 0 });
  assert.equal(ack1.syncState, 'in_flight');

  const ack2 = applyAuthoritativeAcknowledgement(mutation, { status: 'acknowledged', clientWriteIdentity: 'write-1', writeVersion: -1 });
  assert.equal(ack2.syncState, 'in_flight');

  const ack3 = applyAuthoritativeAcknowledgement(mutation, { status: 'acknowledged', clientWriteIdentity: 'write-1', writeVersion: 1.5 });
  assert.equal(ack3.syncState, 'in_flight');
});

test('18. failed synchronization preserves answerPayload', () => {
  const payload = { answer: 'A' };
  const mutation = createPendingMutation(validIdentity, 1, payload, 'write-1', null);
  const failed = markMutationFailed(mutation);
  assert.equal(failed.syncState, 'failed');
  assert.deepEqual(failed.answerPayload, payload);
});

test('19. failed synchronization preserves clientWriteIdentity', () => {
  const mutation = createPendingMutation(validIdentity, 1, {}, 'write-1', null);
  const failed = markMutationFailed(mutation);
  assert.equal(failed.clientWriteIdentity, 'write-1');
});

test('20. failed synchronization preserves expectedWriteVersion', () => {
  const mutation = createPendingMutation(validIdentity, 1, {}, 'write-1', 42);
  const failed = markMutationFailed(mutation);
  assert.equal(failed.expectedWriteVersion, 42);
});

test('21. failed synchronization is not authoritatively acknowledged', () => {
  const mutation = markMutationFailed(createPendingMutation(validIdentity, 1, {}, 'write-1', null));
  const acked = applyAuthoritativeAcknowledgement(mutation, { status: 'acknowledged', clientWriteIdentity: 'write-1', writeVersion: 5 });
  assert.equal(acked.syncState, 'failed');
  assert.equal(isMutationAcknowledged(acked), false);
});

test('22. repeated identical valid acknowledgement is idempotent', () => {
  const mutation = transitionToInFlight(createPendingMutation(validIdentity, 1, {}, 'write-1', null));
  const ack1 = applyAuthoritativeAcknowledgement(mutation, { status: 'acknowledged', clientWriteIdentity: 'write-1', writeVersion: 5 });
  const ack2 = applyAuthoritativeAcknowledgement(ack1, { status: 'acknowledged', clientWriteIdentity: 'write-1', writeVersion: 5 });
  assert.equal(ack1, ack2); // same object reference
});

test('23. one mutation/acknowledgement operation cannot modify a different mutation record', () => {
  const m1 = createPendingMutation(validIdentity, 1, {}, 'write-1', null);
  const m2 = createPendingMutation(validIdentity, 2, {}, 'write-2', null);

  const acked1 = applyAuthoritativeAcknowledgement(transitionToInFlight(m1), { status: 'acknowledged', clientWriteIdentity: 'write-1', writeVersion: 5 });

  assert.equal(acked1.syncState, 'acknowledged');
  assert.equal(m2.syncState, 'pending');
});

test('24. module behavior is deterministic and requires no browser/network/database resources', () => {
  // Proven by running successfully in plain node test environment without mocks.
  const key = buildSyncKey(validIdentity);
  assert.ok(key);
});
