import { test } from 'node:test';
import * as assert from 'node:assert';
import { captureAutosave } from '../src/client-answer-autosave.ts';
import type { ClientAnswerSyncIdentity } from '../src/client-answer-sync.ts';
import type { ClientAnswerRecoveryStore, ClientAnswerRecoveryRecord } from '../src/client-answer-recovery-store.ts';

test('client answer immediate autosave capture', async (t) => {
  const validIdentity: ClientAnswerSyncIdentity = {
    tenantId: 'tenant-1',
    participantId: 'participant-1',
    examInstanceId: 'exam-1',
    attemptId: 'attempt-1',
    snapshotId: 'snapshot-1'
  };

  const drainMicrotasks = async (ticks = 10) => {
    for (let i = 0; i < ticks; i++) {
      await Promise.resolve();
    }
  };

  class DeterministicMockStore implements Pick<ClientAnswerRecoveryStore, 'put'> {
    public puts: ClientAnswerRecoveryRecord[] = [];
    public shouldFail = false;
    public pauseBeforeResolve: Promise<void> | null = null;

    async put(record: ClientAnswerRecoveryRecord): Promise<void> {
      if (this.pauseBeforeResolve) {
        await this.pauseBeforeResolve;
      } else {
        await Promise.resolve();
      }
      if (this.shouldFail) {
        throw new Error('Simulated durable put failure');
      }
      this.puts.push(record);
    }
  }

  await t.test('valid pending mutation capture with full preservation and successful trigger', async () => {
    const store = new DeterministicMockStore();
    let triggerCount = 0;

    const result = await captureAutosave({
      identity: validIdentity,
      localSequence: 1,
      answerPayload: { a: 1 },
      clientWriteIdentity: 'write-id-1',
      expectedWriteVersion: 42,
      store,
      triggerSync: () => { triggerCount++; }
    });

    assert.deepStrictEqual(result.identity, validIdentity);
    assert.strictEqual(result.syncState, 'pending');
    assert.strictEqual(result.localSequence, 1);
    assert.deepStrictEqual(result.answerPayload, { a: 1 });
    assert.strictEqual(result.clientWriteIdentity, 'write-id-1');
    assert.strictEqual(result.expectedWriteVersion, 42);
    assert.strictEqual(result.acceptedWriteVersion, null);

    assert.strictEqual(store.puts.length, 1);
    assert.deepStrictEqual(store.puts[0].mutation.identity, validIdentity);
    assert.strictEqual(store.puts[0].mutation.localSequence, 1);
    assert.strictEqual(store.puts[0].mutation.clientWriteIdentity, 'write-id-1');

    assert.strictEqual(triggerCount, 1);
  });

  await t.test('store.put occurs before trigger', async () => {
    const store = new DeterministicMockStore();
    let triggerCount = 0;

    let releasePut: () => void;
    store.pauseBeforeResolve = new Promise(resolve => {
      releasePut = resolve;
    });

    const capturePromise = captureAutosave({
      identity: validIdentity,
      localSequence: 2,
      answerPayload: 'payload',
      clientWriteIdentity: 'write-id-2',
      expectedWriteVersion: null,
      store,
      triggerSync: () => { triggerCount++; }
    });

    await drainMicrotasks();

    assert.strictEqual(triggerCount, 0);
    assert.strictEqual(store.puts.length, 0);

    releasePut!();

    await capturePromise;

    assert.strictEqual(store.puts.length, 1);
    assert.strictEqual(triggerCount, 1);
  });

  await t.test('persistence failure -> no trigger and failure surfaced', async () => {
    const store = new DeterministicMockStore();
    store.shouldFail = true;
    let triggerCount = 0;

    await assert.rejects(
      captureAutosave({
        identity: validIdentity,
        localSequence: 3,
        answerPayload: null,
        clientWriteIdentity: 'write-id-3',
        expectedWriteVersion: null,
        store,
        triggerSync: () => { triggerCount++; }
      }),
      /Simulated durable put failure/
    );

    assert.strictEqual(triggerCount, 0);
    assert.strictEqual(store.puts.length, 0);
  });

  await t.test('invalid input -> no write/trigger', async () => {
    const store = new DeterministicMockStore();
    let triggerCount = 0;

    await assert.rejects(
      captureAutosave({
        identity: validIdentity,
        localSequence: -1, // invalid
        answerPayload: null,
        clientWriteIdentity: 'write-id',
        expectedWriteVersion: null,
        store,
        triggerSync: () => { triggerCount++; }
      }),
      /Invalid localSequence/
    );

    assert.strictEqual(store.puts.length, 0);
    assert.strictEqual(triggerCount, 0);
  });

  await t.test('sequential localSequence distinction', async () => {
    const store = new DeterministicMockStore();
    let triggerCount = 0;

    const r1 = await captureAutosave({
      identity: validIdentity,
      localSequence: 10,
      answerPayload: 'first',
      clientWriteIdentity: 'write-id-10',
      expectedWriteVersion: null,
      store,
      triggerSync: () => { triggerCount++; }
    });

    const r2 = await captureAutosave({
      identity: validIdentity,
      localSequence: 11,
      answerPayload: 'second',
      clientWriteIdentity: 'write-id-11',
      expectedWriteVersion: null,
      store,
      triggerSync: () => { triggerCount++; }
    });

    assert.strictEqual(r1.localSequence, 10);
    assert.strictEqual(r2.localSequence, 11);
    assert.strictEqual(triggerCount, 2);
    assert.strictEqual(store.puts.length, 2);
    assert.strictEqual(store.puts[0].mutation.localSequence, 10);
    assert.strictEqual(store.puts[1].mutation.localSequence, 11);
  });

  await t.test('autosave completion does not wait for asynchronous triggerSync', async () => {
    const store = new DeterministicMockStore();
    let triggerInvoked = false;
    let triggerCompleted = false;

    let resolveTrigger: () => void;
    const fakeNetworkPromise = new Promise<void>(resolve => {
      resolveTrigger = resolve;
    });

    const capturePromise = captureAutosave({
      identity: validIdentity,
      localSequence: 5,
      answerPayload: 'payload',
      clientWriteIdentity: 'write-id-5',
      expectedWriteVersion: null,
      store,
      triggerSync: () => {
        triggerInvoked = true;
        fakeNetworkPromise.then(() => {
          triggerCompleted = true;
        });
      }
    });

    await capturePromise;

    assert.strictEqual(triggerInvoked, true, 'triggerSync should have been invoked');
    assert.strictEqual(triggerCompleted, false, 'captureAutosave should complete before the async trigger completes');

    resolveTrigger!();
    await drainMicrotasks();
    assert.strictEqual(triggerCompleted, true, 'trigger cleanly finishes later');
  });
});
