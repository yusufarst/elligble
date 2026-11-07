import 'fake-indexeddb/auto';
import { describe, it, expect, afterEach, vi } from 'vitest';
import { AnswerSyncEngine, type SaveOutcome, type ServerAnswerState, type SyncApi } from '../exam/answer-sync-engine.ts';
import { IndexedDbAnswerStore, MemoryAnswerStore, answerKey, attemptKey, type AnswerStore, type PendingAnswerRecord } from '../exam/answer-store.ts';
import { classifySaveFailure, createAnswerSyncApi } from '../exam/answer-sync-api.ts';
import { getQuestions } from '../api/assessment-client.ts';
import { SUPPORTED_QUESTION_TYPES, V1_SINGLE_CHOICE_KEY, contentKeyOf } from '../types/assessment.ts';

// ASSESS-QUESTION-001 client contract (record §5.7/§5A.4/§5A.7, C07): the client declares the
// content keys it renders on delivery and on the real save path; queued intents carry their
// content key; intents written by an earlier client keep working as v1; content this client
// cannot handle is never sent and never shown as saved.

const TENANT = 't-types';
const ATTEMPT = '11111111-1111-4111-8111-111111111111';
const SESSION = '22222222-2222-4222-8222-222222222222';
const settle = () => new Promise(resolve => setTimeout(resolve, 0));

type SaveRequest = Parameters<SyncApi['save']>[0];
class FakeServer {
  answers = new Map<string, { optionId: string; writeVersion: number; cwi: string }>();
  calls: SaveRequest[] = [];
  reply: SaveOutcome | null = null;
  api(): SyncApi {
    return { save: async req => this.save(req), fetchServerAnswers: async () => this.state() };
  }
  state(): ServerAnswerState[] {
    return [...this.answers].map(([snapshotId, a]) => ({ snapshotId, optionId: a.optionId, writeVersion: a.writeVersion, clientWriteIdentity: a.cwi }));
  }
  async save(req: SaveRequest): Promise<SaveOutcome> {
    this.calls.push(req);
    if (this.reply) return this.reply;
    const current = this.answers.get(req.snapshotId);
    if ((current?.writeVersion ?? null) !== req.expectedWriteVersion) return { kind: 'stale' };
    const writeVersion = (current?.writeVersion ?? 0) + 1;
    this.answers.set(req.snapshotId, { optionId: req.optionId, writeVersion, cwi: req.clientWriteIdentity });
    return { kind: 'ack', writeVersion, clientWriteIdentity: req.clientWriteIdentity };
  }
}

function makeEngine(api: SyncApi, store: AnswerStore = new MemoryAnswerStore(), examSessionId = SESSION) {
  let n = 0;
  const events = { onChange: vi.fn(), onSessionInactive: vi.fn(), onTerminal: vi.fn(), onUnauthorized: vi.fn() };
  const engine = new AnswerSyncEngine({ tenantId: TENANT, attemptId: ATTEMPT, examSessionId, store, api, events, newIdentity: () => `cwi-${++n}`, random: () => 0 });
  return { engine, events };
}

function storedRecord(snapshotId: string, optionId: string, extra: Partial<PendingAnswerRecord> = {}): PendingAnswerRecord {
  return {
    key: answerKey(TENANT, ATTEMPT, snapshotId), attemptKey: attemptKey(TENANT, ATTEMPT), tenantId: TENANT, attemptId: ATTEMPT, snapshotId,
    examSessionId: SESSION, optionId, clientWriteIdentity: `old-${snapshotId}`, ownIdentities: [], baseVersion: null, localSequence: 1, capturedAt: 1000, ...extra,
  };
}

afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });

describe('declared question types', () => {
  it('the supported list is exactly v1 and keys are built from the delivered question', () => {
    expect(SUPPORTED_QUESTION_TYPES).toEqual(['1:MULTIPLE_CHOICE_SINGLE', '2:MULTIPLE_RESPONSE']);
    expect(contentKeyOf({ schemaVersion: 1, questionType: 'MULTIPLE_CHOICE_SINGLE' })).toBe(V1_SINGLE_CHOICE_KEY);
  });

  it('question delivery and the real engine-driven save send X-Question-Types', async () => {
    const fetchMock = vi.fn(async (url: string) => url.includes('/questions')
      ? new Response(JSON.stringify({ attemptId: ATTEMPT, questions: [] }), { status: 200, headers: { 'Content-Type': 'application/json' } })
      : new Response(JSON.stringify({ status: 'acknowledged', clientWriteIdentity: 'cwi-1', writeVersion: 1, serverTime: new Date().toISOString() }), { status: 200, headers: { 'Content-Type': 'application/json' } }));
    vi.stubGlobal('fetch', fetchMock);
    await getQuestions(ATTEMPT);
    const { engine } = makeEngine(createAnswerSyncApi(ATTEMPT, SESSION));
    await engine.initialize([]);
    await engine.capture('q-1', 'B');
    await vi.waitFor(() => expect(engine.view('q-1').status).toBe('saved'));
    const headersOf = (i: number) => new Headers((fetchMock.mock.calls[i] as unknown as [string, RequestInit])[1].headers);
    const urls = fetchMock.mock.calls.map(c => c[0] as string);
    const q = urls.findIndex(u => u.includes('/assessment/questions')), s = urls.findIndex(u => u.includes('/answer/save'));
    expect(headersOf(q).get('X-Question-Types')).toBe('1:MULTIPLE_CHOICE_SINGLE,2:MULTIPLE_RESPONSE');
    expect(headersOf(s).get('X-Question-Types')).toBe('1:MULTIPLE_CHOICE_SINGLE,2:MULTIPLE_RESPONSE');
    const body = JSON.parse((fetchMock.mock.calls[s] as unknown as [string, RequestInit])[1].body as string);
    expect(body.answerPayload).toEqual({ selectedOptionId: 'B' });
    expect(Object.keys(body).sort()).toEqual(['answerPayload', 'attemptId', 'capturedAt', 'clientWriteIdentity', 'expectedWriteVersion', 'sessionId', 'snapshotId']);
    engine.dispose();
  });

  it('question_type_unsupported is rejected, never retried', async () => {
    expect(classifySaveFailure(409, 'question_type_unsupported', {})).toEqual({ kind: 'rejected', code: 'question_type_unsupported' });
    const server = new FakeServer();
    server.reply = { kind: 'rejected', code: 'question_type_unsupported' };
    const { engine } = makeEngine(server.api());
    await engine.initialize([]);
    await engine.capture('q-1', 'B');
    await settle(); await settle();
    expect(engine.view('q-1').status).toBe('failed');
    engine.kick(); await settle();
    expect(server.calls.length).toBeLessThanOrEqual(2);
    const before = server.calls.length;
    await new Promise(resolve => setTimeout(resolve, 50));
    expect(server.calls.length).toBe(before);
    engine.dispose();
  });
});

describe('queued intents carry their content key', () => {
  it('new records store the key and send it; nothing else about the record changes', async () => {
    const server = new FakeServer();
    const store = new MemoryAnswerStore();
    const puts: PendingAnswerRecord[] = [];
    const put = store.put.bind(store);
    store.put = async (r: PendingAnswerRecord) => { puts.push(structuredClone(r)); return put(r); };
    const { engine } = makeEngine(server.api(), store);
    await engine.initialize([]);
    await engine.capture('q-1', 'C');
    await vi.waitFor(() => expect(engine.view('q-1').status).toBe('saved'));
    expect(puts[0].contentKey).toBe(V1_SINGLE_CHOICE_KEY);
    expect(Object.keys(puts[0]).sort()).toEqual(['attemptId', 'attemptKey', 'baseVersion', 'capturedAt', 'clientWriteIdentity', 'contentKey', 'examSessionId', 'history', 'key',
      'localSequence', 'optionId', 'ownIdentities', 'snapshotId', 'tenantId']);
    expect(server.calls[0]).toMatchObject({ snapshotId: 'q-1', contentKey: V1_SINGLE_CHOICE_KEY, optionId: 'C', expectedWriteVersion: null });
    engine.dispose();
  });

  it('a record written by an earlier client (no key) syncs as v1 with the same payload', async () => {
    const server = new FakeServer();
    const store = new MemoryAnswerStore();
    await store.put(storedRecord('q-1', 'D'));
    const { engine } = makeEngine(server.api(), store);
    await engine.initialize([]);
    await vi.waitFor(() => expect(engine.view('q-1').status).toBe('saved'));
    expect(server.calls).toHaveLength(1);
    expect(server.calls[0]).toMatchObject({ snapshotId: 'q-1', contentKey: V1_SINGLE_CHOICE_KEY, optionId: 'D', clientWriteIdentity: 'old-q-1', expectedWriteVersion: null });
    engine.dispose();
  });

  it('legacy and new records survive a reopen and adoption by another session unchanged; discard behaviour is unchanged', async () => {
    const first = await IndexedDbAnswerStore.open();
    await first.put(storedRecord('q-legacy', 'A', { examSessionId: 'old-session' }));
    await first.put(storedRecord('q-new', 'B', { examSessionId: 'old-session', contentKey: V1_SINGLE_CHOICE_KEY, localSequence: 2 }));
    await first.put(storedRecord('q-gone', 'C', { examSessionId: 'old-session', contentKey: V1_SINGLE_CHOICE_KEY, baseVersion: null, localSequence: 3 }));
    const reopened = await IndexedDbAnswerStore.open();
    const server = new FakeServer();
    server.answers.set('q-gone', { optionId: 'E', writeVersion: 4, cwi: 'someone-else' });
    const { engine } = makeEngine(server.api(), reopened);
    const result = await engine.initialize(server.state());
    expect(result).toEqual({ adopted: 2, discarded: 1 });
    await vi.waitFor(() => expect([engine.view('q-legacy').status, engine.view('q-new').status]).toEqual(['saved', 'saved']));
    expect(server.calls.map(c => [c.snapshotId, c.contentKey, c.optionId, c.clientWriteIdentity, c.expectedWriteVersion]).sort()).toEqual([
      ['q-legacy', V1_SINGLE_CHOICE_KEY, 'A', 'old-q-legacy', null], ['q-new', V1_SINGLE_CHOICE_KEY, 'B', 'old-q-new', null],
    ]);
    expect(engine.view('q-gone')).toEqual({ optionId: 'E', status: 'saved' });
    expect(await reopened.listForAttempt(TENANT, ATTEMPT)).toEqual([]);
    engine.dispose();
  });

  it('an intent for a content key this client does not handle is never sent and never shown as saved', async () => {
    const server = new FakeServer();
    const store = new MemoryAnswerStore();
    await store.put(storedRecord('q-x', 'A', { contentKey: '2:TRUE_FALSE' }));
    const { engine } = makeEngine(server.api(), store);
    await engine.initialize([]);
    await settle(); await settle();
    expect(server.calls).toEqual([]);
    expect(engine.view('q-x').status).toBe('failed');
    await engine.capture('q-y', 'B', '2:MATCHING');
    await settle(); await settle();
    expect(server.calls).toEqual([]);
    expect(engine.view('q-y').status).toBe('failed');
    expect((await store.listForAttempt(TENANT, ATTEMPT)).map(r => [r.snapshotId, r.contentKey]).sort()).toEqual([['q-x', '2:TRUE_FALSE'], ['q-y', '2:MATCHING']]);
    // The HTTP adapter refuses to build a payload for it as well.
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const outcome = await createAnswerSyncApi(ATTEMPT, SESSION).save({ attemptId: ATTEMPT, sessionId: SESSION, snapshotId: 'q-x', contentKey: '2:TRUE_FALSE', optionId: 'A', clientWriteIdentity: 'c', expectedWriteVersion: null, capturedAt: 0 });
    expect(outcome).toEqual({ kind: 'rejected', code: 'question_type_unsupported' });
    expect(fetchMock).not.toHaveBeenCalled();
    engine.dispose();
  });
});
