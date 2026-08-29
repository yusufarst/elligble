import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  reconcileClientAnswerQueue,
  type ClientAnswerSynchronizationExecutor,
} from '../src/client-answer-reconciliation-queue.ts';

import {
  type ClientAnswerRecoveryRecord,
  type ClientAnswerRecoveryScope,
  type ClientAnswerRecoveryStore,
  isRecoveryRecordForScope
} from '../src/client-answer-recovery-store.ts';
import type { ClientAnswerMutationRecord, AuthoritativeAcknowledgement } from '../src/client-answer-sync.ts';

const testScope: ClientAnswerRecoveryScope = {
  tenantId: 'tenant-1',
  participantId: 'participant-1',
  examInstanceId: 'exam-1',
  attemptId: 'attempt-1',
};

function createMockMutation(
  syncState: 'pending' | 'in_flight' | 'acknowledged' | 'failed',
  localSequence: number,
  clientWriteIdentity: string
): ClientAnswerMutationRecord {
  return {
    identity: {
      tenantId: 'tenant-1',
      participantId: 'participant-1',
      examInstanceId: 'exam-1',
      attemptId: 'attempt-1',
      snapshotId: 'snapshot-1',
    },
    localSequence,
    answerPayload: { data: 'test' },
    clientWriteIdentity,
    expectedWriteVersion: 1,
    syncState,
    acceptedWriteVersion: syncState === 'acknowledged' ? 2 : null,
  };
}

function createMockRecord(mutation: ClientAnswerMutationRecord): ClientAnswerRecoveryRecord {
  return {
    recordKey: `key-${mutation.clientWriteIdentity}`,
    scopeKey: 'scope-1',
    mutation,
  };
}

class MockStore implements Pick<ClientAnswerRecoveryStore, 'listByScope' | 'put'> {
  public records: ClientAnswerRecoveryRecord[] = [];
  public putCalls: ClientAnswerRecoveryRecord[] = [];
  public listByScopeCalls: ClientAnswerRecoveryScope[] = [];
  public shouldFailList = false;
  public shouldFailPut = false;
  public putFailureCondition?: (record: ClientAnswerRecoveryRecord) => boolean;

  async listByScope(scope: ClientAnswerRecoveryScope): Promise<ClientAnswerRecoveryRecord[]> {
    this.listByScopeCalls.push(structuredClone(scope));
    if (this.shouldFailList) {
      throw new Error('Mock store list failure');
    }
    const filtered = this.records.filter(r => isRecoveryRecordForScope(r, scope));
    return structuredClone(filtered);
  }

  async put(record: ClientAnswerRecoveryRecord): Promise<void> {
    if (this.shouldFailPut || (this.putFailureCondition && this.putFailureCondition(record))) {
      throw new Error('Mock store put failure');
    }
    this.putCalls.push(structuredClone(record));
  }
}

describe('client-answer-reconciliation-queue', () => {
  it('handles empty scope', async () => {
    const store = new MockStore();
    const executor: ClientAnswerSynchronizationExecutor = async () => {
      throw new Error('Should not be called');
    };

    const summary = await reconcileClientAnswerQueue(testScope, store, executor);

    assert.deepEqual(summary, {
      scanned: 0,
      attempted: 0,
      acknowledged: 0,
      failed: 0,
      skippedAcknowledged: 0,
    });
    assert.equal(store.putCalls.length, 0);
  });

  it('skips already acknowledged records and does not mutate caller records', async () => {
    const store = new MockStore();
    const mutation = createMockMutation('acknowledged', 1, 'client-id-1');
    const record = createMockRecord(mutation);

    // We keep a reference to the original object to ensure it's not mutated
    const originalRecord = structuredClone(record);
    store.records = [record];

    const executor: ClientAnswerSynchronizationExecutor = async () => {
      throw new Error('Should not be called');
    };

    const summary = await reconcileClientAnswerQueue(testScope, store, executor);

    assert.deepEqual(summary, {
      scanned: 1,
      attempted: 0,
      acknowledged: 0,
      failed: 0,
      skippedAcknowledged: 1,
    });
    assert.equal(store.putCalls.length, 0);
    assert.deepEqual(record, originalRecord, 'Caller records must not be mutated');
  });

  it('passes the exact supplied scope to listByScope', async () => {
    const store = new MockStore();
    const executor: ClientAnswerSynchronizationExecutor = async (mut) => {
      return { status: 'acknowledged', clientWriteIdentity: mut.clientWriteIdentity, writeVersion: 2 };
    };

    await reconcileClientAnswerQueue(testScope, store, executor);

    assert.equal(store.listByScopeCalls.length, 1, 'Should call listByScope exactly once');
    assert.deepEqual(store.listByScopeCalls[0], testScope, 'Must forward exact scope to listByScope');
  });

  it('store dependency satisfies Pick<ClientAnswerRecoveryStore, "listByScope" | "put"> compile-time contract', async () => {
    const store = new MockStore();
    const canonicalDependency: Pick<ClientAnswerRecoveryStore, 'listByScope' | 'put'> = store;

    const executor: ClientAnswerSynchronizationExecutor = async (mut) => {
      return { status: 'acknowledged', clientWriteIdentity: mut.clientWriteIdentity, writeVersion: 2 };
    };

    const summary = await reconcileClientAnswerQueue(testScope, canonicalDependency, executor);
    assert.equal(summary.scanned, 0);
  });

  it('attempt-scope isolation, including another attempt/scope not being executed', async () => {
    const store = new MockStore();

    const mut1 = createMockMutation('pending', 1, 'in-scope');
    const rec1 = createMockRecord(mut1);

    const mut2 = createMockMutation('pending', 2, 'out-of-scope');
    const rec2 = {
      ...createMockRecord(mut2),
      scopeKey: 'different-scope',
      mutation: {
        ...mut2,
        identity: { ...mut2.identity, attemptId: 'different-attempt' }
      }
    };

    store.records = [rec1, rec2];

    const executor: ClientAnswerSynchronizationExecutor = async (mut) => {
      return { status: 'acknowledged', clientWriteIdentity: mut.clientWriteIdentity, writeVersion: 2 };
    };

    const summary = await reconcileClientAnswerQueue(testScope, store, executor);

    assert.equal(summary.scanned, 1, 'Should only scan in-scope records');
    assert.equal(summary.attempted, 1, 'Should only attempt in-scope records');
    assert.equal(store.putCalls.length, 2);
    assert.equal(store.putCalls[0].mutation.clientWriteIdentity, 'in-scope');
  });

  it('structured-clone-compatible non-JSON answerPayload survives reconciliation', async () => {
    const store = new MockStore();
    const mutation = {
      ...createMockMutation('pending', 1, 'client-id-1'),
      answerPayload: { data: new Uint8Array([1, 2, 3]) }
    };
    const record = createMockRecord(mutation);
    store.records = [record];

    const executor: ClientAnswerSynchronizationExecutor = async (mut) => {
      return { status: 'acknowledged', clientWriteIdentity: mut.clientWriteIdentity, writeVersion: 2 };
    };

    await reconcileClientAnswerQueue(testScope, store, executor);

    const payload = store.putCalls[0].mutation.answerPayload as any;
    assert.ok(payload.data instanceof Uint8Array);
    assert.deepEqual(payload.data, new Uint8Array([1, 2, 3]));
  });

  it('processes pending candidate, persists valid acknowledgement', async () => {
    const store = new MockStore();
    const mutation = createMockMutation('pending', 1, 'client-id-1');
    const record = createMockRecord(mutation);
    store.records = [record];

    let executorCalled = false;
    const executor: ClientAnswerSynchronizationExecutor = async (mut) => {
      executorCalled = true;
      assert.equal(mut.syncState, 'in_flight', 'Executor must receive in_flight state');
      assert.equal(mut.clientWriteIdentity, 'client-id-1', 'Must preserve original clientWriteIdentity');
      return {
        status: 'acknowledged',
        clientWriteIdentity: mut.clientWriteIdentity,
        writeVersion: 2,
      };
    };

    const summary = await reconcileClientAnswerQueue(testScope, store, executor);

    assert.ok(executorCalled);
    assert.deepEqual(summary, {
      scanned: 1,
      attempted: 1,
      acknowledged: 1,
      failed: 0,
      skippedAcknowledged: 0,
    });

    // Should have put twice: once for in-flight, once for acknowledged
    assert.equal(store.putCalls.length, 2);
    assert.equal(store.putCalls[0].mutation.syncState, 'in_flight');
    assert.equal(store.putCalls[1].mutation.syncState, 'acknowledged');
    assert.equal(store.putCalls[1].mutation.acceptedWriteVersion, 2);
  });

  it('processes in_flight candidate, persists valid acknowledgement', async () => {
    const store = new MockStore();
    const mutation = createMockMutation('in_flight', 1, 'client-id-1');
    const record = createMockRecord(mutation);
    store.records = [record];

    const executor: ClientAnswerSynchronizationExecutor = async (mut) => {
      return {
        status: 'acknowledged',
        clientWriteIdentity: mut.clientWriteIdentity,
        writeVersion: 2,
      };
    };

    const summary = await reconcileClientAnswerQueue(testScope, store, executor);

    assert.equal(summary.attempted, 1);
    assert.equal(summary.acknowledged, 1);
    assert.equal(store.putCalls[1].mutation.syncState, 'acknowledged');
  });

  it('processes failed candidate, persists valid acknowledgement', async () => {
    const store = new MockStore();
    const mutation = createMockMutation('failed', 1, 'client-id-1');
    const record = createMockRecord(mutation);
    store.records = [record];

    const executor: ClientAnswerSynchronizationExecutor = async (mut) => {
      return {
        status: 'acknowledged',
        clientWriteIdentity: mut.clientWriteIdentity,
        writeVersion: 2,
      };
    };

    const summary = await reconcileClientAnswerQueue(testScope, store, executor);

    assert.equal(summary.attempted, 1);
    assert.equal(summary.acknowledged, 1);
    assert.equal(store.putCalls[1].mutation.syncState, 'acknowledged');
  });

  it('processes candidates in deterministic order (localSequence, clientWriteIdentity, recordKey)', async () => {
    const store = new MockStore();

    // Create out of order
    const mut2 = createMockMutation('pending', 2, 'C'); // seq 2
    const rec2 = createMockRecord(mut2);

    const mut1b = createMockMutation('pending', 1, 'B'); // seq 1, identity B
    const rec1b = createMockRecord(mut1b);

    const mut1a = createMockMutation('pending', 1, 'A');
    const mut1a2 = createMockMutation('pending', 1, 'A');
    const rec1a2 = { ...createMockRecord(mut1a2), recordKey: 'key-1' };
    const rec1a_modified = { ...createMockRecord(mut1a), recordKey: 'key-2' };

    store.records = [rec2, rec1b, rec1a_modified, rec1a2];

    const processedIdentities: string[] = [];
    const processedKeys: string[] = [];

    const executor: ClientAnswerSynchronizationExecutor = async (mut) => {
      processedIdentities.push(mut.clientWriteIdentity);
      // hack to get record key since we only pass mutation to executor.
      // the test asserts order of executor calls.
      return {
        status: 'acknowledged',
        clientWriteIdentity: mut.clientWriteIdentity,
        writeVersion: 2,
      };
    };

    await reconcileClientAnswerQueue(testScope, store, executor);

    // Expected order:
    // seq 1, A, key-1 (rec1a2)
    // seq 1, A, key-2 (rec1a)
    // seq 1, B, key-B (rec1b)
    // seq 2, C, key-C (rec2)

    assert.equal(store.putCalls[0].recordKey, 'key-1');
    assert.equal(store.putCalls[2].recordKey, 'key-2');
    assert.equal(store.putCalls[4].recordKey, 'key-B');
    assert.equal(store.putCalls[6].recordKey, 'key-C');
  });
  it('invalid acknowledgement version (<= 0) marks record as failed and preserves payload', async () => {
    const store = new MockStore();
    const mutation = createMockMutation('pending', 1, 'client-id-1');
    const record = createMockRecord(mutation);
    store.records = [record];

    const executor: ClientAnswerSynchronizationExecutor = async (mut) => {
      // Matching clientWriteIdentity, but invalid writeVersion (0)
      return { status: 'acknowledged', clientWriteIdentity: mut.clientWriteIdentity, writeVersion: 0 };
    };

    const summary = await reconcileClientAnswerQueue(testScope, store, executor);

    assert.equal(summary.scanned, 1);
    assert.equal(summary.attempted, 1);
    assert.equal(summary.acknowledged, 0);
    assert.equal(summary.failed, 1);

    assert.equal(store.putCalls.length, 2);

    const finalPut = store.putCalls[1];
    assert.equal(finalPut.mutation.syncState, 'failed');
    assert.deepEqual(finalPut.mutation.answerPayload, mutation.answerPayload, 'answerPayload must be preserved');
    assert.equal(finalPut.mutation.acceptedWriteVersion, null, 'no false authoritative save should occur');
  });


  it('never falsely saves mismatched acknowledgement', async () => {
    const store = new MockStore();
    const mutation = createMockMutation('pending', 1, 'client-id-1');
    const record = createMockRecord(mutation);
    store.records = [record];

    const executor: ClientAnswerSynchronizationExecutor = async (mut) => {
      return {
        status: 'acknowledged',
        clientWriteIdentity: 'different-client-id', // Mismatched!
        writeVersion: 2,
      };
    };

    const summary = await reconcileClientAnswerQueue(testScope, store, executor);

    assert.equal(summary.attempted, 1);
    assert.equal(summary.acknowledged, 0);
    assert.equal(summary.failed, 1);

    // putCalls: 1 for in-flight, 1 for failed
    assert.equal(store.putCalls.length, 2);
    assert.equal(store.putCalls[1].mutation.syncState, 'failed', 'Persists failed state on mismatched ack');
    assert.notEqual(store.putCalls[1].mutation.answerPayload, null, 'Retains answer payload');
  });

  it('executor rejection persists failed state and retains answer', async () => {
    const store = new MockStore();
    const mutation = createMockMutation('pending', 1, 'client-id-1');
    const record = createMockRecord(mutation);
    store.records = [record];

    const executor: ClientAnswerSynchronizationExecutor = async () => {
      throw new Error('Network error');
    };

    const summary = await reconcileClientAnswerQueue(testScope, store, executor);

    assert.equal(summary.failed, 1);
    assert.equal(store.putCalls.length, 2);
    assert.equal(store.putCalls[1].mutation.syncState, 'failed');
    assert.ok(store.putCalls[1].mutation.answerPayload);
  });

  it('one failed candidate does not prevent later candidates', async () => {
    const store = new MockStore();
    const mut1 = createMockMutation('pending', 1, 'fail-me');
    const rec1 = createMockRecord(mut1);

    const mut2 = createMockMutation('pending', 2, 'pass-me');
    const rec2 = createMockRecord(mut2);

    store.records = [rec1, rec2];

    const executor: ClientAnswerSynchronizationExecutor = async (mut) => {
      if (mut.clientWriteIdentity === 'fail-me') {
        throw new Error('Fail');
      }
      return {
        status: 'acknowledged',
        clientWriteIdentity: mut.clientWriteIdentity,
        writeVersion: 2,
      };
    };

    const summary = await reconcileClientAnswerQueue(testScope, store, executor);

    assert.equal(summary.attempted, 2);
    assert.equal(summary.failed, 1);
    assert.equal(summary.acknowledged, 1);
  });

  it('store read failure rejects the reconciliation', async () => {
    const store = new MockStore();
    store.shouldFailList = true;

    const executor: ClientAnswerSynchronizationExecutor = async () => {
      return { status: 'acknowledged', clientWriteIdentity: 'id', writeVersion: 2 };
    };

    await assert.rejects(
      reconcileClientAnswerQueue(testScope, store, executor),
      /Mock store list failure/
    );
  });

  it('store write failure for in-flight rejects the reconciliation', async () => {
    const store = new MockStore();
    const mutation = createMockMutation('pending', 1, 'client-id-1');
    const record = createMockRecord(mutation);
    store.records = [record];

    // Fail on the first put (in-flight state)
    store.shouldFailPut = true;

    const executor: ClientAnswerSynchronizationExecutor = async () => {
      return { status: 'acknowledged', clientWriteIdentity: 'client-id-1', writeVersion: 2 };
    };

    await assert.rejects(
      reconcileClientAnswerQueue(testScope, store, executor),
      /Mock store put failure/
    );
  });

  it('store write failure for acknowledged state rejects the reconciliation', async () => {
    const store = new MockStore();
    const mutation = createMockMutation('pending', 1, 'client-id-1');
    const record = createMockRecord(mutation);
    store.records = [record];

    // Fail on the second put (acknowledged state)
    store.putFailureCondition = (r) => r.mutation.syncState === 'acknowledged';

    const executor: ClientAnswerSynchronizationExecutor = async (mut) => {
      return { status: 'acknowledged', clientWriteIdentity: mut.clientWriteIdentity, writeVersion: 2 };
    };

    await assert.rejects(
      reconcileClientAnswerQueue(testScope, store, executor),
      /Mock store put failure/
    );
  });
});
