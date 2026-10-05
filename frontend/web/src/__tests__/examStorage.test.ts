import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { IndexedDbAnswerStore, answerKey, attemptKey, type PendingAnswerRecord } from '../exam/answer-store.ts';
import {
  claimExamSessionForTab,
  forgetExamSessionId,
  newExamSessionId,
  readExamSessionId,
  storeExamSessionId,
} from '../exam/exam-session.ts';

function record(tenantId: string, attemptId: string, snapshotId: string, optionId: string, sequence = 1): PendingAnswerRecord {
  return {
    key: answerKey(tenantId, attemptId, snapshotId),
    attemptKey: attemptKey(tenantId, attemptId),
    tenantId,
    attemptId,
    snapshotId,
    examSessionId: 's-1',
    optionId,
    clientWriteIdentity: `cwi-${snapshotId}-${optionId}`,
    ownIdentities: [],
    baseVersion: null,
    localSequence: sequence,
    capturedAt: 0,
  };
}

describe('IndexedDbAnswerStore', () => {
  it('is durable and keeps one latest intent per question', async () => {
    const store = await IndexedDbAnswerStore.open();
    expect(store.durable).toBe(true);
    await store.put(record('t-1', 'a-1', 'q-1', 'A'));
    await store.put(record('t-1', 'a-1', 'q-1', 'C', 2));
    await store.put(record('t-1', 'a-1', 'q-2', 'B', 3));
    const rows = await store.listForAttempt('t-1', 'a-1');
    expect(rows.map(r => [r.snapshotId, r.optionId]).sort()).toEqual([['q-1', 'C'], ['q-2', 'B']]);
  });

  it('survives reopening (reload / browser restart on the same device)', async () => {
    const first = await IndexedDbAnswerStore.open();
    await first.put(record('t-2', 'a-2', 'q-1', 'D'));
    const second = await IndexedDbAnswerStore.open();
    expect((await second.listForAttempt('t-2', 'a-2')).map(r => r.optionId)).toEqual(['D']);
  });

  it('isolates attempts and tenants and clears only the finished attempt', async () => {
    const store = await IndexedDbAnswerStore.open();
    await store.put(record('t-3', 'a-3', 'q-1', 'A'));
    await store.put(record('t-3', 'a-4', 'q-1', 'B'));
    await store.put(record('t-4', 'a-3', 'q-1', 'C'));
    await store.clearAttempt('t-3', 'a-3');
    expect(await store.listForAttempt('t-3', 'a-3')).toEqual([]);
    expect((await store.listForAttempt('t-3', 'a-4')).map(r => r.optionId)).toEqual(['B']);
    expect((await store.listForAttempt('t-4', 'a-3')).map(r => r.optionId)).toEqual(['C']);
    await store.delete(answerKey('t-3', 'a-4', 'q-1'));
    expect(await store.listForAttempt('t-3', 'a-4')).toEqual([]);
  });
});

describe('exam session binding', () => {
  const ATTEMPT = '11111111-1111-4111-8111-111111111111';
  const originalLocks = Object.getOwnPropertyDescriptor(navigator, 'locks');

  beforeEach(() => window.sessionStorage.clear());
  afterEach(() => {
    if (originalLocks) Object.defineProperty(navigator, 'locks', originalLocks);
    else delete (navigator as { locks?: unknown }).locks;
  });

  it('keeps the session id of this tab per attempt and forgets it on request', () => {
    const id = newExamSessionId();
    expect(readExamSessionId(ATTEMPT)).toBeNull();
    storeExamSessionId(ATTEMPT, id);
    expect(readExamSessionId(ATTEMPT)).toBe(id);
    forgetExamSessionId(ATTEMPT);
    expect(readExamSessionId(ATTEMPT)).toBeNull();
  });

  it('ignores a malformed stored value', () => {
    window.sessionStorage.setItem(`elligble.examSession.${ATTEMPT}`, 'not-a-uuid');
    expect(readExamSessionId(ATTEMPT)).toBeNull();
  });

  it('refuses the id when another tab of this browser already holds it (duplicated tab)', async () => {
    const held = new Set<string>();
    Object.defineProperty(navigator, 'locks', {
      configurable: true,
      value: {
        request: vi.fn(async (name: string, _opts: unknown, callback: (lock: unknown) => unknown) => {
          if (held.has(name)) return callback(null);
          held.add(name);
          return callback({ name });
        }),
      },
    });
    const id = newExamSessionId();
    held.add(`elligble-exam-session:${id}`);
    expect(await claimExamSessionForTab(id, 1)).toBe(false);

    const free = newExamSessionId();
    expect(await claimExamSessionForTab(free, 1)).toBe(true);
    // The same tab asking again keeps its claim.
    expect(await claimExamSessionForTab(free, 1)).toBe(true);
  });

  it('grants the claim when Web Locks are unavailable (the server still enforces one session)', async () => {
    Object.defineProperty(navigator, 'locks', { configurable: true, value: undefined });
    expect(await claimExamSessionForTab(newExamSessionId(), 1)).toBe(true);
  });
});
