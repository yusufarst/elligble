import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AnswerSyncEngine, type SaveOutcome, type ServerAnswerState, type SyncApi } from '../exam/answer-sync-engine.ts';
import { MemoryAnswerStore, answerKey, attemptKey, type PendingAnswerRecord } from '../exam/answer-store.ts';
import { classifySaveFailure } from '../exam/answer-sync-api.ts';

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

describe('classifySaveFailure', () => {
  it('reads the pause boundary and the pause interval from a refusal', () => {
    expect(classifySaveFailure(409, 'exam_paused', { pausedAt: '2026-09-30T01:00:00.000Z' })).toEqual({ kind: 'exam_paused', pausedAt: Date.parse('2026-09-30T01:00:00.000Z') });
    expect(classifySaveFailure(409, 'exam_paused')).toEqual({ kind: 'exam_paused', pausedAt: null });
    expect(classifySaveFailure(409, 'captured_during_pause', { pausedAt: '2026-09-30T01:00:00.000Z', resumedAt: '2026-09-30T01:10:00.000Z' }))
      .toEqual({ kind: 'captured_during_pause', pausedAt: Date.parse('2026-09-30T01:00:00.000Z'), resumedAt: Date.parse('2026-09-30T01:10:00.000Z') });
    // Without its interval the choice is kept and retried.
    expect(classifySaveFailure(409, 'captured_during_pause', {})).toEqual({ kind: 'retry' });
    expect(classifySaveFailure(409, 'timer_expired')).toEqual({ kind: 'terminal', code: 'timer_expired' });
  });
});

/** The server's pause rules (answer.ts, Owner decision 2026-09-30) on top of the versioned fake. */
class PausableServer extends FakeServer {
  pauses: Array<{ from: number; to: number | null }> = [];
  captured: number[] = [];

  override async save(req: Parameters<FakeServer['save']>[0] & { capturedAt?: number }): Promise<SaveOutcome> {
    if (this.mode !== 'down' && typeof req.capturedAt === 'number') {
      this.captured.push(req.capturedAt);
      const at = req.capturedAt;
      const current = this.answers.get(req.snapshotId);
      const replay = current && current.cwi === req.clientWriteIdentity && current.optionId === req.optionId;
      const open = this.pauses.find(p => p.to === null);
      if (!replay && open && at >= open.from) {
        this.calls.push({ snapshotId: req.snapshotId, optionId: req.optionId, expected: req.expectedWriteVersion, cwi: req.clientWriteIdentity });
        return { kind: 'exam_paused', pausedAt: open.from };
      }
      const covering = this.pauses.find(p => at >= p.from && (p.to === null || at < p.to));
      if (!replay && covering) {
        this.calls.push({ snapshotId: req.snapshotId, optionId: req.optionId, expected: req.expectedWriteVersion, cwi: req.clientWriteIdentity });
        return { kind: 'captured_during_pause', pausedAt: covering.from, resumedAt: covering.to };
      }
    }
    return super.save(req);
  }
}

describe('AnswerSyncEngine under an exam pause (Owner decision 2026-09-30)', () => {
  beforeEach(() => vi.useRealTimers());

  function pausable(clock: { now: number }, store = new MemoryAnswerStore()) {
    const server = new PausableServer();
    const onExamPaused = vi.fn();
    const onDiscarded = vi.fn();
    const made = makeEngine(server, store, { now: () => clock.now });
    Object.assign(made.events, { onExamPaused, onDiscarded });
    return { server, ...made, onExamPaused, onDiscarded };
  }

  it('sends each choice with its server-anchored capture time', async () => {
    const clock = { now: 1_000_000 };
    const { server, engine } = pausable(clock);
    await engine.initialize([]);
    await engine.capture(Q1, 'A');
    await settle();
    expect(server.captured).toEqual([1_000_000]);
  });

  it('saves a choice made before the pause even while paused, and drops only the one made after it', async () => {
    vi.useFakeTimers();
    const clock = { now: 1000 };
    const { server, engine, onExamPaused, onDiscarded } = pausable(clock);
    await engine.initialize([]);
    server.mode = 'down';
    await engine.capture(Q1, 'A');
    await vi.advanceTimersByTimeAsync(0);
    server.pauses.push({ from: 1500, to: null });
    clock.now = 2500;
    await engine.capture(Q1, 'C'); // this device did not know about the pause yet
    server.mode = 'ok';
    await vi.advanceTimersByTimeAsync(5000);

    expect(server.answers.get(Q1)?.optionId).toBe('A');
    expect(onExamPaused).toHaveBeenCalledWith(1500);
    expect(onDiscarded).toHaveBeenCalledWith([Q1]);
    expect(engine.view(Q1)).toEqual({ optionId: 'A', status: 'saved' });
    expect(engine.hasUnresolved).toBe(false);

    // No new choice while paused.
    await engine.capture(Q2, 'B');
    expect(engine.view(Q2)).toEqual({ optionId: null, status: 'unanswered' });
  });

  it('keeps the server answer when nothing was chosen before the pause', async () => {
    vi.useFakeTimers();
    const clock = { now: 1000 };
    const { server, engine, onDiscarded } = pausable(clock);
    server.answers.set(Q1, { optionId: 'A', writeVersion: 1, cwi: 'earlier' });
    await engine.initialize(server.state());
    server.pauses.push({ from: 1500, to: null });
    clock.now = 2000;
    await engine.capture(Q1, 'C');
    await vi.advanceTimersByTimeAsync(1000);
    expect(server.answers.get(Q1)).toEqual({ optionId: 'A', writeVersion: 1, cwi: 'earlier' });
    expect(engine.view(Q1)).toEqual({ optionId: 'A', status: 'saved' });
    expect(onDiscarded).toHaveBeenCalledWith([Q1]);
    expect(engine.pendingCount).toBe(0);
  });

  it('after a resume, refuses a choice made during the pause and sends the earlier one; later choices save normally', async () => {
    vi.useFakeTimers();
    const clock = { now: 1000 };
    const { server, engine, onDiscarded } = pausable(clock);
    await engine.initialize([]);
    server.mode = 'down';
    await engine.capture(Q1, 'A');
    clock.now = 2000;
    await engine.capture(Q1, 'C'); // offline through a pause it never saw
    await vi.advanceTimersByTimeAsync(0);
    server.pauses.push({ from: 1500, to: 3000 });
    server.mode = 'ok';
    clock.now = 3500;
    await vi.advanceTimersByTimeAsync(5000);
    expect(server.answers.get(Q1)?.optionId).toBe('A');
    expect(onDiscarded).toHaveBeenCalledWith([Q1]);

    await engine.capture(Q1, 'D');
    await vi.advanceTimersByTimeAsync(0);
    expect(server.answers.get(Q1)?.optionId).toBe('D');
    expect(engine.view(Q1)).toEqual({ optionId: 'D', status: 'saved' });
  });

  it('settles waiting choices as soon as the pause is known, and closes it when the exam runs again', async () => {
    vi.useFakeTimers();
    const clock = { now: 1000 };
    const { server, engine, onDiscarded } = pausable(clock);
    await engine.initialize([]);
    server.mode = 'down';
    clock.now = 2000;
    await engine.capture(Q1, 'C');
    await vi.advanceTimersByTimeAsync(0);
    const callsBefore = server.calls.length;
    await engine.noteExamState('PAUSED', 1500);
    expect(onDiscarded).toHaveBeenCalledWith([Q1]);
    expect(engine.pendingCount).toBe(0);
    expect(server.calls.length).toBe(callsBefore);
    expect(engine.examIsPaused).toBe(true);

    clock.now = 9000;
    await engine.noteExamState('ACTIVE', null);
    server.mode = 'ok';
    clock.now = 9001;
    await engine.capture(Q1, 'E');
    await vi.advanceTimersByTimeAsync(0);
    expect(server.answers.get(Q1)?.optionId).toBe('E');
  });

  it('keeps every choice and backs off when a pause refusal cannot be decided', async () => {
    vi.useFakeTimers();
    const clock = { now: 1000 };
    const server = new PausableServer();
    let refusals = 0;
    const api: SyncApi = {
      save: async () => {
        refusals++;
        return { kind: 'exam_paused', pausedAt: null };
      },
      fetchServerAnswers: async () => server.state(),
    };
    const { engine } = makeEngine(server, new MemoryAnswerStore(), { api, now: () => clock.now });
    await engine.initialize([]);
    await engine.capture(Q1, 'A');
    await vi.advanceTimersByTimeAsync(0);
    expect(refusals).toBe(1);
    expect(engine.pendingCount).toBe(1);
    await vi.advanceTimersByTimeAsync(1000);
    expect(refusals).toBeLessThanOrEqual(3);
    expect(engine.view(Q1).optionId).toBe('A');
  });

  it('keeps the earlier choices across a reload, so the fallback still works afterwards', async () => {
    vi.useFakeTimers();
    const clock = { now: 1000 };
    const store = new MemoryAnswerStore();
    const first = pausable(clock, store);
    await first.engine.initialize([]);
    first.server.mode = 'down';
    await first.engine.capture(Q1, 'A');
    clock.now = 2000;
    await first.engine.capture(Q1, 'C');
    await vi.advanceTimersByTimeAsync(0);
    first.engine.dispose();
    const saved = await store.listForAttempt(TENANT, ATTEMPT);
    expect(saved[0].optionId).toBe('C');
    expect(saved[0].history?.map(h => h.optionId)).toEqual(['A']);

    const second = pausable(clock, store);
    second.server.pauses.push({ from: 1500, to: null });
    await second.engine.initialize([]);
    await vi.advanceTimersByTimeAsync(1000);
    expect(second.server.answers.get(Q1)?.optionId).toBe('A');
  });

  it('forgets earlier choices once the server holds a later one', async () => {
    const clock = { now: 1000 };
    let release: () => void = () => {};
    const server = new PausableServer();
    const api: SyncApi = {
      save: async req => {
        if (req.optionId === 'A') await new Promise<void>(resolve => { release = resolve; });
        return server.save(req);
      },
      fetchServerAnswers: async () => server.state(),
    };
    const store = new MemoryAnswerStore();
    const { engine } = makeEngine(server, store, { api, now: () => clock.now });
    await engine.initialize([]);
    await engine.capture(Q1, 'A');
    await settle();
    clock.now = 1100;
    await engine.capture(Q1, 'B');
    const [inQueue] = await store.listForAttempt(TENANT, ATTEMPT);
    expect(inQueue.history?.map(h => h.optionId)).toEqual(['A']);
    release();
    await settle();
    await settle();
    expect(server.answers.get(Q1)?.optionId).toBe('B');
    expect(await store.listForAttempt(TENANT, ATTEMPT)).toEqual([]);
  });
});
