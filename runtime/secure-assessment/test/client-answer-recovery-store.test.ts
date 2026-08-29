import test from 'node:test';
import assert from 'node:assert/strict';
import type { ClientAnswerMutationRecord } from '../src/client-answer-sync.ts';
import {
  buildRecoveryScopeKey,
  buildRecoveryRecordKey,
  createRecoveryRecord,
  isRecoveryRecordForScope,
  type ClientAnswerRecoveryScope,
  type ClientAnswerRecoveryStore
} from '../src/client-answer-recovery-store.ts';

test('buildRecoveryScopeKey validates all dimensions and creates deterministic key', (t) => {
  const scope: ClientAnswerRecoveryScope = {
    tenantId: 't1',
    participantId: 'p1',
    examInstanceId: 'e1',
    attemptId: 'a1'
  };

  const key = buildRecoveryScopeKey(scope);
  assert.equal(key, '["t1","p1","e1","a1"]');
  
  // Adversarial delimiter collision test
  const scope2: ClientAnswerRecoveryScope = {
    tenantId: 't1","p1',
    participantId: 'e1',
    examInstanceId: 'a1',
    attemptId: 'a1'
  };
  const key2 = buildRecoveryScopeKey(scope2);
  assert.notEqual(key, key2);

  // Invalid dimensions
  assert.throws(() => buildRecoveryScopeKey({ ...scope, tenantId: '' }), /Invalid tenantId/);
  assert.throws(() => buildRecoveryScopeKey({ ...scope, participantId: '' }), /Invalid participantId/);
  assert.throws(() => buildRecoveryScopeKey({ ...scope, examInstanceId: '' }), /Invalid examInstanceId/);
  assert.throws(() => buildRecoveryScopeKey({ ...scope, attemptId: '' }), /Invalid attemptId/);
});

test('buildRecoveryRecordKey validates all dimensions and creates deterministic key', (t) => {
  const mutation: ClientAnswerMutationRecord = {
    identity: {
      tenantId: 't1',
      participantId: 'p1',
      examInstanceId: 'e1',
      attemptId: 'a1',
      snapshotId: 's1'
    },
    localSequence: 1,
    answerPayload: { val: 42 },
    clientWriteIdentity: 'cw1',
    expectedWriteVersion: null,
    syncState: 'pending',
    acceptedWriteVersion: null
  };

  const key = buildRecoveryRecordKey(mutation);
  assert.equal(key, '["t1","p1","e1","a1","s1",1,"cw1"]');

  // localSequence distinguishes
  const mut2 = { ...mutation, localSequence: 2 };
  assert.notEqual(key, buildRecoveryRecordKey(mut2));

  // clientWriteIdentity distinguishes
  const mut3 = { ...mutation, clientWriteIdentity: 'cw2' };
  assert.notEqual(key, buildRecoveryRecordKey(mut3));

  // Same input yields same key
  assert.equal(buildRecoveryRecordKey(mutation), '["t1","p1","e1","a1","s1",1,"cw1"]');

  // Adversarial delimiter collision
  const mutColl = { ...mutation, identity: { ...mutation.identity, tenantId: 't1","p1', participantId: 'e1' } };
  assert.notEqual(key, buildRecoveryRecordKey(mutColl));

  // Validation
  assert.throws(() => buildRecoveryRecordKey({ ...mutation, identity: { ...mutation.identity, snapshotId: '' } }), /Invalid snapshotId/);
  assert.throws(() => buildRecoveryRecordKey({ ...mutation, localSequence: 0 }), /Invalid localSequence/);
  assert.throws(() => buildRecoveryRecordKey({ ...mutation, localSequence: -1 }), /Invalid localSequence/);
  assert.throws(() => buildRecoveryRecordKey({ ...mutation, clientWriteIdentity: '' }), /Invalid clientWriteIdentity/);
});

test('createRecoveryRecord maps mutation to recovery record safely', (t) => {
  const mutation: ClientAnswerMutationRecord = {
    identity: {
      tenantId: 't1',
      participantId: 'p1',
      examInstanceId: 'e1',
      attemptId: 'a1',
      snapshotId: 's1'
    },
    localSequence: 1,
    answerPayload: { answer: 'A' },
    clientWriteIdentity: 'cw1',
    expectedWriteVersion: 2,
    syncState: 'in_flight',
    acceptedWriteVersion: null
  };

  const record = createRecoveryRecord(mutation);

  assert.equal(record.scopeKey, '["t1","p1","e1","a1"]');
  assert.equal(record.recordKey, '["t1","p1","e1","a1","s1",1,"cw1"]');
  
  // Preserves properties correctly
  assert.deepEqual(record.mutation.identity, mutation.identity);
  assert.deepEqual(record.mutation.answerPayload, mutation.answerPayload);
  assert.equal(record.mutation.localSequence, mutation.localSequence);
  assert.equal(record.mutation.clientWriteIdentity, mutation.clientWriteIdentity);
  assert.equal(record.mutation.expectedWriteVersion, mutation.expectedWriteVersion);
  assert.equal(record.mutation.syncState, mutation.syncState);
  assert.equal(record.mutation.acceptedWriteVersion, mutation.acceptedWriteVersion);

  // Does not falsely acknowledge pending or convert state
  assert.equal(record.mutation.syncState, 'in_flight');
});

test('isRecoveryRecordForScope accurately checks scope boundaries', (t) => {
  const mutation: ClientAnswerMutationRecord = {
    identity: {
      tenantId: 't1',
      participantId: 'p1',
      examInstanceId: 'e1',
      attemptId: 'a1',
      snapshotId: 's1'
    },
    localSequence: 1,
    answerPayload: {},
    clientWriteIdentity: 'cw1',
    expectedWriteVersion: null,
    syncState: 'pending',
    acceptedWriteVersion: null
  };
  const record = createRecoveryRecord(mutation);
  
  const scope: ClientAnswerRecoveryScope = {
    tenantId: 't1',
    participantId: 'p1',
    examInstanceId: 'e1',
    attemptId: 'a1'
  };

  assert.ok(isRecoveryRecordForScope(record, scope));

  // Mismatches
  assert.equal(isRecoveryRecordForScope(record, { ...scope, tenantId: 't2' }), false);
  assert.equal(isRecoveryRecordForScope(record, { ...scope, participantId: 'p2' }), false);
  assert.equal(isRecoveryRecordForScope(record, { ...scope, examInstanceId: 'e2' }), false);
  assert.equal(isRecoveryRecordForScope(record, { ...scope, attemptId: 'a2' }), false);
});

test('source API exposes ClientAnswerRecoveryStore without concrete storage', (t) => {
  const storeImplementation: ClientAnswerRecoveryStore = {
    async put(record) { /* mock */ },
    async get(recordKey) { return null; },
    async listByScope(scope) { return []; },
    async delete(recordKey) { /* mock */ },
    async clearScope(scope) { /* mock */ }
  };
  assert.ok(storeImplementation);
});
