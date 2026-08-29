import { describe, it } from 'node:test';
import * as assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as path from 'node:path';

import type {
  ClientAnswerRecoveryScope,
  ClientAnswerRecoveryRecord,
  ClientAnswerRecoveryStore,
} from '../src/client-answer-recovery-store.ts';

import type {
  ClientAnswerSynchronizationExecutor,
} from '../src/client-answer-reconciliation-queue.ts';

import type { AuthoritativeAcknowledgement } from '../src/client-answer-sync.ts';

import type {
  ExpiryFinalizationExecutor,
  AuthoritativeExpiryFinalizationReceipt,
} from '../src/client-expiry-finalization.ts';
import { finalizeAuthoritativeExpiry } from '../src/client-expiry-finalization.ts';

function createMockStore(records: ClientAnswerRecoveryRecord[]) {
  const store: Pick<ClientAnswerRecoveryStore, 'listByScope' | 'put'> = {
    listByScope: async () => [...records],
    put: async () => {},
  };
  return store;
}

const mockScope: ClientAnswerRecoveryScope = {
  tenantId: 't-1',
  participantId: 'p-1',
  examInstanceId: 'e-1',
  attemptId: 'att-1',
};

const mockIdentity = {
  tenantId: 't-1',
  participantId: 'p-1',
  examInstanceId: 'e-1',
  attemptId: 'att-1',
  snapshotId: 'snap-1',
};

const validReceipt: AuthoritativeExpiryFinalizationReceipt = {
  status: 'submitted',
  submissionId: 'sub-1',
  submittedAt: '2026-08-30T00:00:00.000Z',
};

describe('finalizeAuthoritativeExpiry', () => {
  it('case 1: all records already acknowledged -> attempted 0 -> finalizer called once -> submitted receipt', async () => {
    let finalizerCalls = 0;
    const store = createMockStore([{
      recordKey: 'key-1',
      scopeKey: 'scope-1',
      mutation: {
        identity: mockIdentity,
        syncState: 'acknowledged',
        acceptedWriteVersion: 1,
        localSequence: 1,
        clientWriteIdentity: 'w-1',
        answerPayload: { value: true },
        expectedWriteVersion: null,
      },
    }]);

    const syncExecutor: ClientAnswerSynchronizationExecutor = async () => {
      throw new Error('should not be called');
    };

    const finalizer: ExpiryFinalizationExecutor = async (attemptId) => {
      finalizerCalls++;
      assert.equal(attemptId, 'att-1');
      return validReceipt;
    };

    const result = await finalizeAuthoritativeExpiry(mockScope, store, syncExecutor, finalizer);
    assert.equal(finalizerCalls, 1);
    assert.deepEqual(result, validReceipt);
    assert.equal(result, validReceipt);
  });

  it('case 2: pending mutation successfully reconciles -> synchronization happens before finalizer -> finalizer called once -> submitted', async () => {
    const callOrder: string[] = [];
    
    const store = createMockStore([{
      recordKey: 'key-1',
      scopeKey: 'scope-1',
      mutation: {
        identity: mockIdentity,
        syncState: 'pending',
        localSequence: 1,
        clientWriteIdentity: 'w-1',
        answerPayload: { value: true },
        expectedWriteVersion: null,
        acceptedWriteVersion: null,
      },
    }]);

    const syncExecutor: ClientAnswerSynchronizationExecutor = async (): Promise<AuthoritativeAcknowledgement> => {
      callOrder.push('sync');
      return { status: 'acknowledged', clientWriteIdentity: 'w-1', writeVersion: 2 };
    };

    const finalizer: ExpiryFinalizationExecutor = async () => {
      callOrder.push('finalize');
      return validReceipt;
    };

    const result = await finalizeAuthoritativeExpiry(mockScope, store, syncExecutor, finalizer);
    assert.deepEqual(callOrder, ['sync', 'finalize']);
    assert.equal(result, validReceipt);
  });

  it('case 3: one mutation fails reconciliation -> pending_answers_unresolved -> finalizer zero calls', async () => {
    let finalizerCalls = 0;
    
    const store = createMockStore([{
      recordKey: 'key-1',
      scopeKey: 'scope-1',
      mutation: {
        identity: mockIdentity,
        syncState: 'pending',
        localSequence: 1,
        clientWriteIdentity: 'w-1',
        answerPayload: { value: true },
        expectedWriteVersion: null,
        acceptedWriteVersion: null,
      },
    }]);

    const syncExecutor: ClientAnswerSynchronizationExecutor = async (): Promise<AuthoritativeAcknowledgement> => {
      throw new Error('sync failed');
    };

    const finalizer: ExpiryFinalizationExecutor = async () => {
      finalizerCalls++;
      return validReceipt;
    };

    const result = await finalizeAuthoritativeExpiry(mockScope, store, syncExecutor, finalizer);
    assert.equal(finalizerCalls, 0);
    assert.deepEqual(result, { status: 'pending_answers_unresolved' });
  });

  it('case 4: recovery store/list throws -> pending_answers_unresolved -> finalizer zero calls', async () => {
    let finalizerCalls = 0;
    
    const store = createMockStore([]);
    store.listByScope = async () => { throw new Error('store error'); };

    const syncExecutor: ClientAnswerSynchronizationExecutor = async (): Promise<AuthoritativeAcknowledgement> => {
      return { status: 'acknowledged', clientWriteIdentity: 'w-1', writeVersion: 2 };
    };

    const finalizer: ExpiryFinalizationExecutor = async () => {
      finalizerCalls++;
      return validReceipt;
    };

    const result = await finalizeAuthoritativeExpiry(mockScope, store, syncExecutor, finalizer);
    assert.equal(finalizerCalls, 0);
    assert.deepEqual(result, { status: 'pending_answers_unresolved' });
  });

  it('case 5: synchronization executor throws -> pending_answers_unresolved -> finalizer zero calls', async () => {
    let finalizerCalls = 0;
    
    const store = createMockStore([{
      recordKey: 'key-1',
      scopeKey: 'scope-1',
      mutation: {
        identity: mockIdentity,
        syncState: 'pending',
        localSequence: 1,
        clientWriteIdentity: 'w-1',
        answerPayload: { value: true },
        expectedWriteVersion: null,
        acceptedWriteVersion: null,
      },
    }]);

    const syncExecutor: ClientAnswerSynchronizationExecutor = async (): Promise<AuthoritativeAcknowledgement> => {
      throw new Error('sync throw');
    };

    const finalizer: ExpiryFinalizationExecutor = async () => {
      finalizerCalls++;
      return validReceipt;
    };

    const result = await finalizeAuthoritativeExpiry(mockScope, store, syncExecutor, finalizer);
    assert.equal(finalizerCalls, 0);
    assert.deepEqual(result, { status: 'pending_answers_unresolved' });
  });

  it('case 6: finalization executor throws -> finalization_uncertain', async () => {
    const store = createMockStore([]);
    const syncExecutor: ClientAnswerSynchronizationExecutor = async (): Promise<AuthoritativeAcknowledgement> => { throw new Error('should not call'); };

    const finalizer: ExpiryFinalizationExecutor = async () => {
      throw new Error('finalizer throw');
    };

    const result = await finalizeAuthoritativeExpiry(mockScope, store, syncExecutor, finalizer);
    assert.deepEqual(result, { status: 'finalization_uncertain' });
  });

  it('case 7: finalization executor rejects as timeout -> finalization_uncertain', async () => {
    const store = createMockStore([]);
    const syncExecutor: ClientAnswerSynchronizationExecutor = async (): Promise<AuthoritativeAcknowledgement> => { throw new Error('should not call'); };

    const finalizer: ExpiryFinalizationExecutor = async () => {
      return Promise.reject(new Error('timeout'));
    };

    const result = await finalizeAuthoritativeExpiry(mockScope, store, syncExecutor, finalizer);
    assert.deepEqual(result, { status: 'finalization_uncertain' });
  });

  it('case 8: malformed finalization result -> finalization_uncertain -> never submitted', async () => {
    const store = createMockStore([]);
    const syncExecutor: ClientAnswerSynchronizationExecutor = async (): Promise<AuthoritativeAcknowledgement> => { throw new Error('should not call'); };

    // @ts-expect-error
    const finalizer: ExpiryFinalizationExecutor = async () => {
      return { status: 'submitted', submissionId: '' };
    };

    const result = await finalizeAuthoritativeExpiry(mockScope, store, syncExecutor, finalizer);
    assert.deepEqual(result, { status: 'finalization_uncertain' });
  });

  it('case 9: valid authoritative receipt -> propagated unchanged', async () => {
    const store = createMockStore([]);
    const syncExecutor: ClientAnswerSynchronizationExecutor = async (): Promise<AuthoritativeAcknowledgement> => { throw new Error('should not call'); };

    const finalizer: ExpiryFinalizationExecutor = async () => {
      return validReceipt;
    };

    const result = await finalizeAuthoritativeExpiry(mockScope, store, syncExecutor, finalizer);
    assert.equal(result, validReceipt);
  });

  it('case 9a: acknowledged record with acceptedWriteVersion = 0 -> pending_answers_unresolved', async () => {
    let finalizerCalls = 0;
    let putCalls = 0;
    const store = createMockStore([{
      recordKey: 'key-1', scopeKey: 'scope-1',
      mutation: { identity: mockIdentity, syncState: 'acknowledged', acceptedWriteVersion: 0, localSequence: 1, clientWriteIdentity: 'w-1', answerPayload: { value: true }, expectedWriteVersion: null }
    }]);
    store.put = async () => { putCalls++; };
    const syncExecutor: ClientAnswerSynchronizationExecutor = async () => { throw new Error('should not be called'); };
    const finalizer: ExpiryFinalizationExecutor = async () => { finalizerCalls++; return validReceipt; };

    const result = await finalizeAuthoritativeExpiry(mockScope, store, syncExecutor, finalizer);
    assert.deepEqual(result, { status: 'pending_answers_unresolved' });
    assert.equal(finalizerCalls, 0);
    assert.equal(putCalls, 0);
  });

  it('case 9b: acknowledged record with acceptedWriteVersion = -1 -> pending_answers_unresolved', async () => {
    let finalizerCalls = 0;
    let putCalls = 0;
    const store = createMockStore([{
      recordKey: 'key-1', scopeKey: 'scope-1',
      mutation: { identity: mockIdentity, syncState: 'acknowledged', acceptedWriteVersion: -1, localSequence: 1, clientWriteIdentity: 'w-1', answerPayload: { value: true }, expectedWriteVersion: null }
    }]);
    store.put = async () => { putCalls++; };
    const syncExecutor: ClientAnswerSynchronizationExecutor = async () => { throw new Error('should not be called'); };
    const finalizer: ExpiryFinalizationExecutor = async () => { finalizerCalls++; return validReceipt; };

    const result = await finalizeAuthoritativeExpiry(mockScope, store, syncExecutor, finalizer);
    assert.deepEqual(result, { status: 'pending_answers_unresolved' });
    assert.equal(finalizerCalls, 0);
    assert.equal(putCalls, 0);
  });

  it('case 9c: acknowledged record with acceptedWriteVersion = 1.5 -> pending_answers_unresolved', async () => {
    let finalizerCalls = 0;
    let putCalls = 0;
    const store = createMockStore([{
      recordKey: 'key-1', scopeKey: 'scope-1',
      mutation: { identity: mockIdentity, syncState: 'acknowledged', acceptedWriteVersion: 1.5, localSequence: 1, clientWriteIdentity: 'w-1', answerPayload: { value: true }, expectedWriteVersion: null }
    }]);
    store.put = async () => { putCalls++; };
    const syncExecutor: ClientAnswerSynchronizationExecutor = async () => { throw new Error('should not be called'); };
    const finalizer: ExpiryFinalizationExecutor = async () => { finalizerCalls++; return validReceipt; };

    const result = await finalizeAuthoritativeExpiry(mockScope, store, syncExecutor, finalizer);
    assert.deepEqual(result, { status: 'pending_answers_unresolved' });
    assert.equal(finalizerCalls, 0);
    assert.equal(putCalls, 0);
  });

  it('case 9d: acknowledged record with acceptedWriteVersion = NaN -> pending_answers_unresolved', async () => {
    let finalizerCalls = 0;
    let putCalls = 0;
    const store = createMockStore([{
      recordKey: 'key-1', scopeKey: 'scope-1',
      mutation: { identity: mockIdentity, syncState: 'acknowledged', acceptedWriteVersion: NaN, localSequence: 1, clientWriteIdentity: 'w-1', answerPayload: { value: true }, expectedWriteVersion: null }
    }]);
    store.put = async () => { putCalls++; };
    const syncExecutor: ClientAnswerSynchronizationExecutor = async () => { throw new Error('should not be called'); };
    const finalizer: ExpiryFinalizationExecutor = async () => { finalizerCalls++; return validReceipt; };

    const result = await finalizeAuthoritativeExpiry(mockScope, store, syncExecutor, finalizer);
    assert.deepEqual(result, { status: 'pending_answers_unresolved' });
    assert.equal(finalizerCalls, 0);
    assert.equal(putCalls, 0);
  });

  it('case 9e: acknowledged record with acceptedWriteVersion = MAX_SAFE_INTEGER + 1 -> pending_answers_unresolved', async () => {
    let finalizerCalls = 0;
    let putCalls = 0;
    const store = createMockStore([{
      recordKey: 'key-1', scopeKey: 'scope-1',
      mutation: { identity: mockIdentity, syncState: 'acknowledged', acceptedWriteVersion: Number.MAX_SAFE_INTEGER + 1, localSequence: 1, clientWriteIdentity: 'w-1', answerPayload: { value: true }, expectedWriteVersion: null }
    }]);
    store.put = async () => { putCalls++; };
    const syncExecutor: ClientAnswerSynchronizationExecutor = async () => { throw new Error('should not be called'); };
    const finalizer: ExpiryFinalizationExecutor = async () => { finalizerCalls++; return validReceipt; };

    const result = await finalizeAuthoritativeExpiry(mockScope, store, syncExecutor, finalizer);
    assert.deepEqual(result, { status: 'pending_answers_unresolved' });
    assert.equal(finalizerCalls, 0);
    assert.equal(putCalls, 0);
  });

  it('case 9f: whitespace-only submissionId -> finalization_uncertain', async () => {
    const store = createMockStore([]);
    const syncExecutor: ClientAnswerSynchronizationExecutor = async () => { throw new Error('should not call'); };
    const finalizer: ExpiryFinalizationExecutor = async () => {
      return { status: 'submitted', submissionId: '   ', submittedAt: '2026-08-30T00:00:00.000Z' };
    };

    const result = await finalizeAuthoritativeExpiry(mockScope, store, syncExecutor, finalizer);
    assert.deepEqual(result, { status: 'finalization_uncertain' });
  });

  it('case 9g: whitespace-only submittedAt -> finalization_uncertain', async () => {
    const store = createMockStore([]);
    const syncExecutor: ClientAnswerSynchronizationExecutor = async () => { throw new Error('should not call'); };
    const finalizer: ExpiryFinalizationExecutor = async () => {
      return { status: 'submitted', submissionId: 's-1', submittedAt: ' \t\n ' };
    };

    const result = await finalizeAuthoritativeExpiry(mockScope, store, syncExecutor, finalizer);
    assert.deepEqual(result, { status: 'finalization_uncertain' });
  });

  it('case 9h: binding-sensitive store delegation succeeds during reconciliation', async () => {
    class BindingSensitiveStore {
      private state = 'bound';
      public records: ClientAnswerRecoveryRecord[];

      constructor(records: ClientAnswerRecoveryRecord[]) {
        this.records = records;
      }

      async listByScope() {
        return this.records;
      }

      async put(record: ClientAnswerRecoveryRecord) {
        if (this.state !== 'bound') {
          throw new Error('Lost binding!');
        }
        const index = this.records.findIndex(r => r.recordKey === record.recordKey);
        if (index >= 0) {
          this.records[index] = record;
        } else {
          this.records.push(record);
        }
      }
    }

    const backingStore = new BindingSensitiveStore([{
      recordKey: 'key-1', scopeKey: 'scope-1',
      mutation: { identity: mockIdentity, syncState: 'pending', acceptedWriteVersion: null, localSequence: 1, clientWriteIdentity: 'w-1', answerPayload: { value: true }, expectedWriteVersion: null }
    }]);

    const syncExecutor: ClientAnswerSynchronizationExecutor = async (): Promise<any> => {
      return { status: 'acknowledged', clientWriteIdentity: 'w-1', writeVersion: 1 };
    };

    let finalizerCalls = 0;
    const finalizer: ExpiryFinalizationExecutor = async () => { finalizerCalls++; return validReceipt; };

    const result = await finalizeAuthoritativeExpiry(mockScope, backingStore, syncExecutor, finalizer);
    assert.deepEqual(result, validReceipt);
    assert.equal(finalizerCalls, 1);
  });

  it('case 10: store surface used by orchestration never requires/calls clearScope/delete', async () => {
    const store = createMockStore([]);
    let deleteCalled = false;
    // @ts-expect-error
    store.clearScope = () => { deleteCalled = true; };
    // @ts-expect-error
    store.delete = () => { deleteCalled = true; };

    const syncExecutor: ClientAnswerSynchronizationExecutor = async (): Promise<AuthoritativeAcknowledgement> => { throw new Error('should not call'); };
    const finalizer: ExpiryFinalizationExecutor = async () => { return validReceipt; };

    await finalizeAuthoritativeExpiry(mockScope, store, syncExecutor, finalizer);
    assert.equal(deleteCalled, false);
  });

  it('case 11: ordering proof - reconciliation acknowledgement completes before finalizer invocation', async () => {
    const callOrder: string[] = [];
    const store = createMockStore([{
      recordKey: 'key-1',
      scopeKey: 'scope-1',
      mutation: {
        identity: mockIdentity,
        syncState: 'pending',
        localSequence: 1,
        clientWriteIdentity: 'w-1',
        answerPayload: { value: true },
        expectedWriteVersion: null,
        acceptedWriteVersion: null,
      },
    }]);

    const syncExecutor: ClientAnswerSynchronizationExecutor = async (): Promise<AuthoritativeAcknowledgement> => {
      callOrder.push('sync');
      return { status: 'acknowledged', clientWriteIdentity: 'w-1', writeVersion: 2 };
    };

    const finalizer: ExpiryFinalizationExecutor = async () => {
      callOrder.push('finalizer');
      return validReceipt;
    };

    await finalizeAuthoritativeExpiry(mockScope, store, syncExecutor, finalizer);
    assert.deepEqual(callOrder, ['sync', 'finalizer']);
  });

  it('case 12: supplied scope remains unchanged', async () => {
    const store = createMockStore([]);
    const syncExecutor: ClientAnswerSynchronizationExecutor = async (): Promise<AuthoritativeAcknowledgement> => { throw new Error('should not call'); };
    const finalizer: ExpiryFinalizationExecutor = async () => { return validReceipt; };

    const scopeCopy = { ...mockScope };
    await finalizeAuthoritativeExpiry(mockScope, store, syncExecutor, finalizer);
    assert.deepEqual(mockScope, scopeCopy);
  });

  it('case 13: source/runtime contains no device-clock expiry calculation', () => {
    const sourcePath = path.join(import.meta.dirname, '../src/client-expiry-finalization.ts');
    const sourceCode = fs.readFileSync(sourcePath, 'utf8');
    
    assert.equal(sourceCode.includes('Date.now()'), false);
    assert.equal(sourceCode.includes('new Date()'), false);
    assert.equal(sourceCode.includes('performance.now()'), false);
  });
});
