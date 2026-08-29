import test from 'node:test';
import assert from 'node:assert/strict';

import type { ClientAnswerRecoveryScope, ClientAnswerRecoveryStore, ClientAnswerRecoveryRecord } from '../src/client-answer-recovery-store.ts';
import type { ClientAnswerSynchronizationExecutor, ClientAnswerReconciliationSummary } from '../src/client-answer-reconciliation-queue.ts';
import { ClientAnswerReconciliationRetryController } from '../src/client-answer-reconciliation-retry.ts';
import type { RetryPolicy, RetryScheduler, RetryRandomness } from '../src/client-answer-reconciliation-retry.ts';

const DUMMY_SCOPE: ClientAnswerRecoveryScope = {
  tenantId: 't1',
  participantId: 'p1',
  examInstanceId: 'e1',
  attemptId: 'a1',
};

const DEFAULT_POLICY: RetryPolicy = {
  initialDelayMs: 1000,
  maxDelayMs: 30000,
  backoffMultiplier: 2,
  jitterRatio: 0.1,
};

// We create a mock store and intercept the reconcileClientAnswerQueue by having it call a deterministic mock queue.
// Wait, we can't easily mock reconcileClientAnswerQueue without dependency injection if we import it directly.
// But we can just use a real store that produces deterministic records so the real reconcileClientAnswerQueue does what we want!
// Let's create a memory store.

class MockStore implements Pick<ClientAnswerRecoveryStore, 'listByScope' | 'put'> {
  public records: ClientAnswerRecoveryRecord[] = [];
  public listCalls: ClientAnswerRecoveryScope[] = [];
  public putCalls: ClientAnswerRecoveryRecord[] = [];
  public listThrows = false;

  async listByScope(scope: ClientAnswerRecoveryScope): Promise<ClientAnswerRecoveryRecord[]> {
    this.listCalls.push(scope);
    if (this.listThrows) throw new Error('List failed');
    return this.records.filter(
      r =>
        r.mutation.identity.tenantId === scope.tenantId &&
        r.mutation.identity.participantId === scope.participantId &&
        r.mutation.identity.examInstanceId === scope.examInstanceId &&
        r.mutation.identity.attemptId === scope.attemptId
    );
  }

  async put(record: ClientAnswerRecoveryRecord): Promise<void> {
    this.putCalls.push(record);
    const idx = this.records.findIndex(r => r.recordKey === record.recordKey);
    if (idx >= 0) this.records[idx] = record;
    else this.records.push(record);
  }
}

class MockScheduler implements RetryScheduler {
  public pendingTimeout: { cb: () => void; ms: number; id: number } | null = null;
  public clearCalls = 0;
  private nextId = 1;

  setTimeout(cb: () => void, ms: number): any {
    const id = this.nextId++;
    this.pendingTimeout = { cb, ms, id };
    return id;
  }

  clearTimeout(id: any): void {
    this.clearCalls++;
    if (this.pendingTimeout && this.pendingTimeout.id === id) {
      this.pendingTimeout = null;
    }
  }

  // Helper for tests
  flush(): void {
    if (this.pendingTimeout) {
      const cb = this.pendingTimeout.cb;
      this.pendingTimeout = null;
      cb();
    }
  }
}

class MockRandomness implements RetryRandomness {
  public nextValue = 0;
  random(): number {
    return this.nextValue;
  }
}

function createDummyRecord(key: string, acknowledged: boolean): ClientAnswerRecoveryRecord {
  return {
    recordKey: key,
    scopeKey: 'scope-key-1',
    mutation: {
      identity: {
        tenantId: 't1',
        participantId: 'p1',
        examInstanceId: 'e1',
        attemptId: 'a1',
        snapshotId: 's1',
      },
      clientWriteIdentity: 'w1',
      localSequence: 1,
      syncState: acknowledged ? 'acknowledged' : 'pending',
      acceptedWriteVersion: acknowledged ? 1 : null,
      expectedWriteVersion: null,
      answerPayload: { answer: 'A' },
    }
  };
}

test('BU-026 retry controller policy validation', () => {
  const store = new MockStore();
  const executor = async (): Promise<never> => { throw new Error('fail') }; 
  const scheduler = new MockScheduler();
  const rand = new MockRandomness();

  assert.throws(() => {
    new ClientAnswerReconciliationRetryController(DUMMY_SCOPE, store, executor, { ...DEFAULT_POLICY, initialDelayMs: -1 }, scheduler, rand);
  }, /Invalid initialDelayMs/);
  
  assert.throws(() => {
    new ClientAnswerReconciliationRetryController(DUMMY_SCOPE, store, executor, { ...DEFAULT_POLICY, maxDelayMs: 0 }, scheduler, rand);
  }, /Invalid maxDelayMs/);

  assert.throws(() => {
    new ClientAnswerReconciliationRetryController(DUMMY_SCOPE, store, executor, { ...DEFAULT_POLICY, backoffMultiplier: 0 }, scheduler, rand);
  }, /Invalid backoffMultiplier/);

  assert.throws(() => {
    new ClientAnswerReconciliationRetryController(DUMMY_SCOPE, store, executor, { ...DEFAULT_POLICY, jitterRatio: -0.1 }, scheduler, rand);
  }, /Invalid jitterRatio/);
});

test('BU-026 explicit trigger runs reconciliation immediately and exact attempt scope is preserved', async () => {
  const store = new MockStore();
  let executorCalls = 0;
  const executor: ClientAnswerSynchronizationExecutor = async (m) => {
    executorCalls++;
    return { status: 'acknowledged', clientWriteIdentity: m.clientWriteIdentity, writeVersion: 1 };
  };
  const scheduler = new MockScheduler();
  const rand = new MockRandomness();

  store.records.push(createDummyRecord('r1', false));

  const controller = new ClientAnswerReconciliationRetryController(DUMMY_SCOPE, store, executor, DEFAULT_POLICY, scheduler, rand);
  
  controller.trigger();
  // It's async inside. Wait for next tick.
  await new Promise(r => setImmediate(r));

  assert.equal(store.listCalls.length, 1);
  assert.deepEqual(store.listCalls[0], DUMMY_SCOPE);
  assert.equal(executorCalls, 1);
  
  // Successful, so nothing scheduled
  assert.equal(scheduler.pendingTimeout, null);
});

test('BU-026 failed summary schedules retry', async () => {
  const store = new MockStore();
  const executor: ClientAnswerSynchronizationExecutor = async (m) => {
    throw new Error('Failed'); // indicates failure
  };
  const scheduler = new MockScheduler();
  const rand = new MockRandomness();

  store.records.push(createDummyRecord('r1', false));

  const controller = new ClientAnswerReconciliationRetryController(DUMMY_SCOPE, store, executor, DEFAULT_POLICY, scheduler, rand);
  
  controller.trigger();
  await new Promise(r => setImmediate(r));

  // Should have scheduled a retry
  assert.ok(scheduler.pendingTimeout);
  // first delay = 1000 + 1000 * 0.1 * 0 = 1000
  assert.equal(scheduler.pendingTimeout.ms, 1000);
});

test('BU-026 thrown reconciliation/store failure schedules retry', async () => {
  const store = new MockStore();
  store.listThrows = true; // makes reconcileClientAnswerQueue throw
  const executor: ClientAnswerSynchronizationExecutor = async (m) => { throw new Error('failed'); };
  const scheduler = new MockScheduler();
  const rand = new MockRandomness();

  const controller = new ClientAnswerReconciliationRetryController(DUMMY_SCOPE, store, executor, DEFAULT_POLICY, scheduler, rand);
  
  controller.trigger();
  await new Promise(r => setImmediate(r));

  assert.ok(scheduler.pendingTimeout);
  assert.equal(scheduler.pendingTimeout.ms, 1000);
});

test('BU-026 deterministic injected jitter and exponential/bounded delay progression', async () => {
  const store = new MockStore();
  const executor: ClientAnswerSynchronizationExecutor = async (m) => { throw new Error('failed'); }; // always fail
  const scheduler = new MockScheduler();
  const rand = new MockRandomness();
  
  store.records.push(createDummyRecord('r1', false));

  const controller = new ClientAnswerReconciliationRetryController(DUMMY_SCOPE, store, executor, DEFAULT_POLICY, scheduler, rand);
  
  rand.nextValue = 0.5;
  controller.trigger();
  await new Promise(r => setImmediate(r));

  // 1st delay: 1000 + (1000 * 0.1 * 0.5) = 1050
  assert.ok(scheduler.pendingTimeout);
  assert.equal(scheduler.pendingTimeout.ms, 1050);

  // flush timer to trigger 2nd
  rand.nextValue = 1.0;
  scheduler.flush();
  await new Promise(r => setImmediate(r));

  // 2nd base delay: 2000. Jitter: 2000 * 0.1 * 1.0 = 200
  // total = 2200
  assert.ok(scheduler.pendingTimeout);
  assert.equal(scheduler.pendingTimeout.ms, 2200);

  // 3rd base delay: 4000. 
  scheduler.flush();
  await new Promise(r => setImmediate(r));
  assert.ok(scheduler.pendingTimeout);
  assert.equal(scheduler.pendingTimeout!.ms, 4400); // 4000 + 400

  // jump ahead to test bound: 4000 -> 8000 -> 16000 -> 32000 (bounded to 30000)
  scheduler.flush(); await new Promise(r => setImmediate(r)); // 8000
  scheduler.flush(); await new Promise(r => setImmediate(r)); // 16000
  scheduler.flush(); await new Promise(r => setImmediate(r)); // 30000
  
  // base is now 30000. maxDelayMs cannot be exceeded, jitter is applied before cap.
  // 30000 + (30000 * 0.1 * 1.0) = 33000 -> cap to 30000
  assert.ok(scheduler.pendingTimeout);
  assert.equal(scheduler.pendingTimeout!.ms, 30000);
});

test('BU-026 successful or empty reconciliation schedules nothing and resets progression', async () => {
  const store = new MockStore();
  let fail = true;
  const executor: ClientAnswerSynchronizationExecutor = async (m) => {
    if (fail) throw new Error('failed');
    return { status: 'acknowledged', clientWriteIdentity: m.clientWriteIdentity, writeVersion: 1 };
  };
  const scheduler = new MockScheduler();
  const rand = new MockRandomness();
  
  store.records.push(createDummyRecord('r1', false));

  const controller = new ClientAnswerReconciliationRetryController(DUMMY_SCOPE, store, executor, DEFAULT_POLICY, scheduler, rand);
  
  controller.trigger();
  await new Promise(r => setImmediate(r));

  // Failed, so scheduled
  assert.ok(scheduler.pendingTimeout);
  assert.equal(scheduler.pendingTimeout.ms, 1000);

  // Now make it succeed
  fail = false;
  scheduler.flush();
  await new Promise(r => setImmediate(r));

  // Success, nothing scheduled
  assert.equal(scheduler.pendingTimeout, null);

  // Now trigger fail again to see if progression reset
  fail = true;
  store.records[0] = createDummyRecord('r1', false); // reset so it attempts
  controller.trigger();
  await new Promise(r => setImmediate(r));

  // Back to 1000, confirming it reset
  assert.ok(scheduler.pendingTimeout);
  assert.equal((scheduler as any).pendingTimeout.ms, 1000);

  // Now empty
  store.records = []; // empty
  scheduler.flush();
  await new Promise(r => setImmediate(r));

  // Empty, schedules nothing
  assert.equal(scheduler.pendingTimeout, null);
});

test('BU-026 explicit trigger cancels pending delayed retry', async () => {
  const store = new MockStore();
  const executor: ClientAnswerSynchronizationExecutor = async (m) => { throw new Error('failed'); };
  const scheduler = new MockScheduler();
  const rand = new MockRandomness();

  store.records.push(createDummyRecord('r1', false));

  const controller = new ClientAnswerReconciliationRetryController(DUMMY_SCOPE, store, executor, DEFAULT_POLICY, scheduler, rand);
  
  controller.trigger();
  await new Promise(r => setImmediate(r));

  assert.ok(scheduler.pendingTimeout);
  const initialClearCalls = scheduler.clearCalls;

  controller.trigger(); // This should clear the timeout and run immediate
  assert.equal(scheduler.pendingTimeout, null);
  assert.equal(scheduler.clearCalls, initialClearCalls + 1);

  await new Promise(r => setImmediate(r));
  // should reschedule
  assert.ok(scheduler.pendingTimeout);
});

test('BU-026 overlapping triggers do not overlap reconciliation and coalesce', async () => {
  const store = new MockStore();
  let executorResolve: (v: any) => void;
  const executorPromise = new Promise(r => { executorResolve = r; });
  let callCount = 0;
  const executor: ClientAnswerSynchronizationExecutor = async (m) => {
    callCount++;
    await executorPromise;
    throw new Error('failed');
  };
  const scheduler = new MockScheduler();
  const rand = new MockRandomness();

  store.records.push(createDummyRecord('r1', false));

  const controller = new ClientAnswerReconciliationRetryController(DUMMY_SCOPE, store, executor, DEFAULT_POLICY, scheduler, rand);
  
  controller.trigger(); // starts first
  // Don't wait for completion yet
  await new Promise(r => setTimeout(r, 10)); // just let it enter executeReconciliation

  controller.trigger(); // overlapping
  controller.trigger(); // overlapping

  assert.equal(callCount, 1); // only one execution started

  // resolve the first execution
  executorResolve!(null);
  await new Promise(r => setImmediate(r));

  // It should have run a second time immediately because of pendingImmediateTrigger coalescing
  assert.equal(callCount, 2);

  // resolve the second execution (with failure so it schedules)
  await new Promise(r => setImmediate(r));
  assert.ok(scheduler.pendingTimeout);
});

test('BU-026 dispose cancels scheduled retry and prevents later execution', async () => {
  const store = new MockStore();
  const executor: ClientAnswerSynchronizationExecutor = async (m) => { throw new Error('failed'); };
  const scheduler = new MockScheduler();
  const rand = new MockRandomness();

  store.records.push(createDummyRecord('r1', false));

  const controller = new ClientAnswerReconciliationRetryController(DUMMY_SCOPE, store, executor, DEFAULT_POLICY, scheduler, rand);
  
  controller.trigger();
  await new Promise(r => setImmediate(r));

  assert.ok(scheduler.pendingTimeout);
  
  controller.dispose();
  assert.equal(scheduler.pendingTimeout, null);

  // Triggering after dispose should do nothing
  controller.trigger();
  await new Promise(r => setImmediate(r));
  assert.equal(scheduler.pendingTimeout, null);
});

test('BU-026 scheduler failure creates no false authoritative acknowledgement', async () => {
  const store = new MockStore();
  const executor: ClientAnswerSynchronizationExecutor = async (m) => { throw new Error('failed'); };
  const scheduler = new MockScheduler();
  const rand = new MockRandomness();

  const origRecord = createDummyRecord('r1', false);
  store.records.push(origRecord);

  const controller = new ClientAnswerReconciliationRetryController(DUMMY_SCOPE, store, executor, DEFAULT_POLICY, scheduler, rand);
  
  // Make setTimeout throw
  scheduler.setTimeout = () => { throw new Error('Timer broken'); };

  controller.trigger();
  await new Promise(r => setImmediate(r));

  // The record was failed by reconcileClientAnswerQueue
  const record = store.records[0];
  assert.equal(record.mutation.syncState, 'failed');
  assert.equal(record.mutation.acceptedWriteVersion, null);
  // Controller itself did not mutate to acknowledged.
});
