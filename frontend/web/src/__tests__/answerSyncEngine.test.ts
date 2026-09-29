import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AnswerSyncEngine, type SaveOutcome, type ServerAnswerState, type SyncApi } from '../exam/answer-sync-engine.ts';
import { MemoryAnswerStore, answerKey, attemptKey, type PendingAnswerRecord } from '../exam/answer-store.ts';

const TENANT = 't-1';
const ATTEMPT = 'a-1';
const SESSION = 's-current';
const Q1 = 'q-1';
const Q2 = 'q-2';

/** Versioned fake of POST /answer/save with the server's exact concurrency rules. */
class FakeServer {
  answers = new Map<string, { optionId: string; writeVersion: number; cwi: string }>();
  activeSession = SESSION;
  mode: 'ok' | 'down' = 'ok';
  loseNextAck = false;
  calls: Array<{ snapshotId: string; optionId: string; expected: number | null; cwi: string }> = [];

  api(): SyncApi {
    return {
      save: async req => this.save(req),
      fetchServerAnswers: async () => this.state(),
    };
  }

  state(): ServerAnswerState[] {
    return [...this.answers].map(([snapshotId, a]) => ({ snapshotId, optionId: a.optionId, writeVersion: a.writeVersion, clientWriteIdentity: a.cwi }));
  }

  async save(req: { sessionId: string; snapshotId: string; optionId: string; clientWriteIdentity: string; expectedWriteVersion: number | null }): Promise<SaveOutcome> {
    this.calls.push({ snapshotId: req.snapshotId, optionId: req.optionId, expected: req.expectedWriteVersion, cwi: req.clientWriteIdentity });
    if (this.mode === 'down') return { kind: 'retry' };
    if (req.sessionId !== this.activeSession) return { kind: 'session_inactive' };
    const current = this.answers.get(req.snapshotId);
    let ack: SaveOutcome;
    if (current && current.cwi === req.clientWriteIdentity) {
      ack = current.optionId === req.optionId ? { kind: 'ack', writeVersion: current.writeVersion, clientWriteIdentity: current.cwi } : { kind: 'identity_conflict' };
    } else if ((current?.writeVersion ?? null) !== req.expectedWriteVersion) {
      return { kind: 'stale' };
    } else {
      const writeVersion = (current?.writeVersion ?? 0) + 1;
      this.answers.set(req.snapshotId, { optionId: req.optionId, writeVersion, cwi: req.clientWriteIdentity });
      ack = { kind: 'ack', writeVersion, clientWriteIdentity: req.clientWriteIdentity };
    }
    if (this.loseNextAck) {
      this.loseNextAck = false;
      return { kind: 'retry' };
    }
    return ack;
  }
}

function makeEngine(server: FakeServer, store = new MemoryAnswerStore(), overrides: Partial<ConstructorParameters<typeof AnswerSyncEngine>[0]> = {}) {
  let n = 0;
  const events = { onChange: vi.fn(), onSessionInactive: vi.fn(), onTerminal: vi.fn(), onUnauthorized: vi.fn() };
  const engine = new AnswerSyncEngine({
    tenantId: TENANT,
    attemptId: ATTEMPT,
    examSessionId: SESSION,
    store,
    api: server.api(),
    events,
    newIdentity: () => `cwi-${++n}`,
    random: () => 0,
    ...overrides,
  });
  return { engine, events, store };
}

const settle = () => new Promise(resolve => setTimeout(resolve, 0));

describe('AnswerSyncEngine', () => {
  beforeEach(() => vi.useRealTimers());

  it('persists locally before sending and reports saved only after the acknowledgement', async () => {
    const server = new FakeServer();
    const store = new MemoryAnswerStore();
    const putSpy = vi.spyOn(store, 'put');
    const { engine } = makeEngine(server, store);
    await engine.initialize([]);
    const capture = engine.capture(Q1, 'B');
    expect(engine.view(Q1)).toEqual({ optionId: 'B', status: 'saving' });
    await capture;
    await settle();
    expect(putSpy).toHaveBeenCalledTimes(1);
    expect(putSpy.mock.invocationCallOrder[0]).toBeLessThan(Infinity);
    expect(server.calls).toEqual([{ snapshotId: Q1, optionId: 'B', expected: null, cwi: 'cwi-1' }]);
    expect(engine.view(Q1)).toEqual({ optionId: 'B', status: 'saved' });
    expect(await store.listForAttempt(TENANT, ATTEMPT)).toEqual([]);
  });

  it('keeps answering offline, shows the failure honestly, and delivers only the latest choice when back online', async () => {
    vi.useFakeTimers();
    const server = new FakeServer();
    server.mode = 'down';
    const { engine } = makeEngine(server);
    await engine.initialize([]);
    await engine.capture(Q1, 'A');
    await vi.advanceTimersByTimeAsync(0);
    expect(engine.view(Q1).status).toBe('failed');
    expect(engine.degraded).toBe(true);
    await engine.capture(Q1, 'C');
    await engine.capture(Q2, 'D');
    await vi.advanceTimersByTimeAsync(0);
    expect(engine.hasUnresolved).toBe(true);

    server.mode = 'ok';
    await vi.advanceTimersByTimeAsync(5000);
    expect(server.answers.get(Q1)?.optionId).toBe('C');
    expect(server.answers.get(Q2)?.optionId).toBe('D');
    expect(server.calls.filter(c => c.snapshotId === Q1 && c.optionId === 'A').every(c => server.answers.get(Q1)?.cwi !== c.cwi)).toBe(true);
    expect(engine.view(Q1)).toEqual({ optionId: 'C', status: 'saved' });
    expect(engine.hasUnresolved).toBe(false);
    expect(engine.degraded).toBe(false);
  });

  it('never replays a stale version forever: rapid changes converge to the latest choice', async () => {
    const server = new FakeServer();
    const { engine } = makeEngine(server);
    await engine.initialize([]);
    await Promise.all([engine.capture(Q1, 'A'), engine.capture(Q1, 'B'), engine.capture(Q1, 'C')]);
    for (let i = 0; i < 10 && engine.hasUnresolved; i++) await settle();
    expect(server.answers.get(Q1)?.optionId).toBe('C');
    expect(engine.view(Q1).status).toBe('saved');
  });

  it('a lost acknowledgement does not duplicate or lose the answer', async () => {
    vi.useFakeTimers();
    const server = new FakeServer();
    server.loseNextAck = true;
    const { engine } = makeEngine(server);
    await engine.initialize([]);
    await engine.capture(Q1, 'B');
    await vi.advanceTimersByTimeAsync(0);
    expect(engine.view(Q1).status).toBe('failed');
    await vi.advanceTimersByTimeAsync(2000);
    expect(server.answers.get(Q1)).toMatchObject({ optionId: 'B', writeVersion: 1 });
    expect(engine.view(Q1).status).toBe('saved');
  });

  it('a newer choice made while the previous one is in flight is rebased and sent', async () => {
    const server = new FakeServer();
    let release: () => void = () => {};
    const gate = new Promise<void>(resolve => { release = resolve; });
    const api = server.api();
    const slowApi: SyncApi = {
      ...api,
      save: async req => {
        if (req.optionId === 'A') await gate;
        return api.save(req);
      },
    };
    const { engine } = makeEngine(server, new MemoryAnswerStore(), { api: slowApi });
    await engine.initialize([]);
    await engine.capture(Q1, 'A');
    await engine.capture(Q1, 'B');
    release();
    for (let i = 0; i < 10 && engine.hasUnresolved; i++) await settle();
    expect(server.answers.get(Q1)).toMatchObject({ optionId: 'B', writeVersion: 2 });
  });

  it('stops when the exam session is superseded and keeps the unsynced intent locally', async () => {
    const server = new FakeServer();
    server.activeSession = 'other-device';
    const { engine, events, store } = makeEngine(server);
    await engine.initialize([]);
    await engine.capture(Q1, 'B');
    await settle();
    expect(events.onSessionInactive).toHaveBeenCalledTimes(1);
    expect(engine.view(Q1).status).toBe('failed');
    expect((await store.listForAttempt(TENANT, ATTEMPT)).map(r => r.optionId)).toEqual(['B']);
  });

  it('pauses on 401 and resumes after re-authentication', async () => {
    const server = new FakeServer();
    const api = server.api();
    let unauthorized = true;
    const { engine, events } = makeEngine(server, new MemoryAnswerStore(), {
      api: { ...api, save: async req => (unauthorized ? { kind: 'unauthorized' } : api.save(req)) },
    });
    await engine.initialize([]);
    await engine.capture(Q1, 'B');
    await settle();
    expect(events.onUnauthorized).toHaveBeenCalled();
    unauthorized = false;
    engine.resume();
    for (let i = 0; i < 10 && engine.hasUnresolved; i++) await settle();
    expect(server.answers.get(Q1)?.optionId).toBe('B');
  });

  it('recovers intents after a reload in the same session', async () => {
    const server = new FakeServer();
    server.mode = 'down';
    const store = new MemoryAnswerStore();
    const first = makeEngine(server, store);
    await first.engine.initialize([]);
    await first.engine.capture(Q1, 'D');
    await settle();
    first.engine.dispose();

    server.mode = 'ok';
    const second = makeEngine(server, store);
    await second.engine.initialize(server.state());
    expect(second.engine.view(Q1).optionId).toBe('D');
    for (let i = 0; i < 10 && second.engine.hasUnresolved; i++) await settle();
    expect(server.answers.get(Q1)?.optionId).toBe('D');
  });

  function leftover(optionId: string, baseVersion: number | null, own: string[] = []): PendingAnswerRecord {
    return {
      key: answerKey(TENANT, ATTEMPT, Q1), attemptKey: attemptKey(TENANT, ATTEMPT), tenantId: TENANT, attemptId: ATTEMPT,
      snapshotId: Q1, examSessionId: 's-previous', optionId, clientWriteIdentity: 'old-cwi', ownIdentities: own,
      baseVersion, localSequence: 1, capturedAt: 0,
    };
  }

  it('replays a previous-session intent when nobody answered since (browser restart on the same device)', async () => {
    const server = new FakeServer();
    server.answers.set(Q1, { optionId: 'A', writeVersion: 1, cwi: 'x' });
    const store = new MemoryAnswerStore();
    await store.put(leftover('C', 1));
    const { engine } = makeEngine(server, store);
    const result = await engine.initialize(server.state());
    expect(result).toEqual({ adopted: 1, discarded: 0 });
    for (let i = 0; i < 10 && engine.hasUnresolved; i++) await settle();
    expect(server.answers.get(Q1)).toMatchObject({ optionId: 'C', writeVersion: 2 });
  });

  it('keeps the server answer when another device answered after this device last synced (D04.4-41)', async () => {
    const server = new FakeServer();
    server.answers.set(Q1, { optionId: 'E', writeVersion: 3, cwi: 'other-device-cwi' });
    const store = new MemoryAnswerStore();
    await store.put(leftover('C', 1));
    const { engine } = makeEngine(server, store);
    const result = await engine.initialize(server.state());
    expect(result).toEqual({ adopted: 0, discarded: 1 });
    expect(engine.view(Q1)).toEqual({ optionId: 'E', status: 'saved' });
    await settle();
    expect(server.calls).toEqual([]);
    expect(await store.listForAttempt(TENANT, ATTEMPT)).toEqual([]);
  });

  it('treats the server holding the same choice as saved', async () => {
    const server = new FakeServer();
    server.answers.set(Q1, { optionId: 'C', writeVersion: 4, cwi: 'somebody' });
    const store = new MemoryAnswerStore();
    await store.put({ ...leftover('C', 1), examSessionId: SESSION });
    const { engine } = makeEngine(server, store);
    await engine.initialize(server.state());
    expect(engine.view(Q1)).toEqual({ optionId: 'C', status: 'saved' });
    expect(engine.hasUnresolved).toBe(false);
  });

  it('clears the local buffer after the authoritative submission', async () => {
    const server = new FakeServer();
    server.mode = 'down';
    const { engine, store } = makeEngine(server);
    await engine.initialize([]);
    await engine.capture(Q1, 'A');
    await engine.clearAfterSubmission();
    expect(await store.listForAttempt(TENANT, ATTEMPT)).toEqual([]);
    engine.dispose();
  });
  it('a choice made while stored intents are still loading is not overwritten by an older one', async () => {
    const server = new FakeServer();
    const store = new MemoryAnswerStore();
    await store.put({ ...leftover('A', null), examSessionId: SESSION });
    let releaseList: () => void = () => {};
    const listGate = new Promise<void>(resolve => { releaseList = resolve; });
    const slowStore = Object.assign(Object.create(Object.getPrototypeOf(store)), store, {
      // Reads the stored intents immediately but delivers them late (slow IndexedDB).
      listForAttempt: async (t: string, a: string) => {
        const snapshot = await store.listForAttempt(t, a);
        await listGate;
        return snapshot;
      },
    });
    const { engine } = makeEngine(server, slowStore);
    const init = engine.initialize([]);
    const capture = engine.capture(Q1, 'B');
    for (let i = 0; i < 5; i++) await settle();
    releaseList();
    await Promise.all([init, capture]);
    for (let i = 0; i < 10 && engine.hasUnresolved; i++) await settle();
    expect(server.answers.get(Q1)?.optionId).toBe('B');
    expect(engine.view(Q1)).toEqual({ optionId: 'B', status: 'saved' });
  });

  it('shows every queued choice as not saved while the connection is failing', async () => {
    vi.useFakeTimers();
    const server = new FakeServer();
    server.mode = 'down';
    const { engine } = makeEngine(server);
    await engine.initialize([]);
    await engine.capture(Q1, 'A');
    await vi.advanceTimersByTimeAsync(0);
    await engine.capture(Q2, 'B');
    await vi.advanceTimersByTimeAsync(0);
    expect(engine.view(Q2).status).toBe('failed');
    expect(engine.views()).toEqual({ [Q1]: { optionId: 'A', status: 'failed' }, [Q2]: { optionId: 'B', status: 'failed' } });
    engine.dispose();
  });
});
