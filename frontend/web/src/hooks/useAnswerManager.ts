import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ResumeAnswer, SaveState } from '../types/assessment.ts';
import { AnswerSyncEngine, type SyncApi } from '../exam/answer-sync-engine.ts';
import { MemoryAnswerStore, openAnswerStore, type AnswerStore, type PendingAnswerRecord } from '../exam/answer-store.ts';
import { createAnswerSyncApi, selectedOptionOf, toServerAnswerState } from '../exam/answer-sync-api.ts';
import { useOptionalSession } from '../session/SessionProvider.tsx';

// Student answers for one attempt on this device, local-first (D04.3-83A..D, D04.5-05..18).
// A choice is written to the device buffer before it is sent and shows "Tersimpan" only
// after the server acknowledged exactly that choice. The four Owner-locked states are
// "Belum dijawab", "Menyimpan...", "Tersimpan" and "Gagal menyimpan" (retrying by itself).

export interface UseAnswerManagerOptions {
  tenantId: string | null;
  attemptId: string;
  /** This tab's own exam session id (its write capability). */
  sessionId: string;
  /** Server answers from resume; null until they are loaded. */
  initialAnswers: ResumeAnswer[] | null;
  enabled: boolean;
  onSessionInactive?: () => void;
  onTerminalEvent?: (code: string) => void;
  /** Seams for tests; production uses IndexedDB and the HTTP API. */
  openStore?: () => Promise<AnswerStore>;
  api?: SyncApi;
}

export interface AnswerManager {
  selectedOptions: Record<string, string>;
  saveStates: Record<string, SaveState>;
  selectOption: (snapshotId: string, optionId: string) => void;
  /** True while any choice is not yet acknowledged by the server (or still loading). */
  hasUnresolvedSaves: boolean;
  /** Sends are failing (offline or server unreachable); intents are kept and retried. */
  degraded: boolean;
  /** Unsynced choices survive a reload or browser restart on this device. */
  storageDurable: boolean;
  /** Choices captured on this device that the server has not acknowledged yet. */
  pendingCount: number;
  /** Try to send pending choices now (e.g. at timer expiry, D04.5-46). */
  flush: () => void;
}

/** Lets the engine start immediately while the durable store is still opening. */
class DeferredAnswerStore implements AnswerStore {
  private resolved: AnswerStore | null = null;
  private readonly ready: Promise<AnswerStore>;

  constructor(open: () => Promise<AnswerStore>) {
    this.ready = open()
      .catch(() => new MemoryAnswerStore())
      .then(store => (this.resolved = store));
  }
  get durable(): boolean {
    return this.resolved?.durable ?? false;
  }
  async listForAttempt(tenantId: string, attemptId: string): Promise<PendingAnswerRecord[]> {
    return (await this.ready).listForAttempt(tenantId, attemptId);
  }
  async put(record: PendingAnswerRecord): Promise<void> {
    return (await this.ready).put(record);
  }
  async delete(key: string): Promise<void> {
    return (await this.ready).delete(key);
  }
  async clearAttempt(tenantId: string, attemptId: string): Promise<void> {
    return (await this.ready).clearAttempt(tenantId, attemptId);
  }
}

const EMPTY: Record<string, never> = {};

export function useAnswerManager(options: UseAnswerManagerOptions): AnswerManager {
  const { tenantId, attemptId, sessionId, initialAnswers, enabled } = options;
  const [engine, setEngine] = useState<AnswerSyncEngine | null>(null);
  const [ready, setReady] = useState(false);
  const [tick, setTick] = useState(0);
  const callbacksRef = useRef(options);
  callbacksRef.current = options;
  const queuedRef = useRef<Array<[string, string]>>([]);

  useEffect(() => {
    if (!enabled || !attemptId || !sessionId || !initialAnswers) return;
    const tenantKey = tenantId ?? '';
    const created = new AnswerSyncEngine({
      tenantId: tenantKey,
      attemptId,
      examSessionId: sessionId,
      store: new DeferredAnswerStore(callbacksRef.current.openStore ?? openAnswerStore),
      api: callbacksRef.current.api ?? createAnswerSyncApi(attemptId, sessionId),
      events: {
        onChange: () => setTick(t => t + 1),
        onSessionInactive: () => callbacksRef.current.onSessionInactive?.(),
        onTerminal: code => callbacksRef.current.onTerminalEvent?.(code),
        // The shared transport already reports 401 to the session layer (re-auth dialog).
        onUnauthorized: () => undefined,
      },
    });
    let active = true;
    setEngine(created);
    setReady(false);
    created.initialize(initialAnswers.map(toServerAnswerState)).then(() => {
      if (active) setReady(true);
    });
    for (const [snapshotId, optionId] of queuedRef.current.splice(0)) void created.capture(snapshotId, optionId);
    return () => {
      active = false;
      created.dispose();
      setEngine(null);
    };
  }, [enabled, tenantId, attemptId, sessionId, initialAnswers]);

  // Connectivity regained or the tab is visible again: try the queue now.
  useEffect(() => {
    if (!engine) return;
    const kick = () => engine.kick();
    const onVisibility = () => {
      if (document.visibilityState === 'visible') engine.kick();
    };
    window.addEventListener('online', kick);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      window.removeEventListener('online', kick);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [engine]);

  // Resume sending once the student has signed in again after the session expired.
  const session = useOptionalSession();
  const sessionExpired = session?.expired ?? false;
  useEffect(() => {
    if (engine && !sessionExpired) engine.resume();
  }, [engine, sessionExpired]);

  const selectOption = useCallback(
    (snapshotId: string, optionId: string) => {
      if (engine) void engine.capture(snapshotId, optionId);
      else queuedRef.current.push([snapshotId, optionId]);
    },
    [engine]
  );

  const unsupported = useMemo(() => {
    const ids = new Set<string>();
    for (const answer of initialAnswers ?? []) {
      if (selectedOptionOf(answer.answerPayload) === null) ids.add(answer.snapshotId);
    }
    return ids;
  }, [initialAnswers]);

  const { selectedOptions, saveStates } = useMemo(() => {
    const selected: Record<string, string> = {};
    const states: Record<string, SaveState> = {};
    const views = engine ? engine.views() : EMPTY;
    for (const [snapshotId, view] of Object.entries(views)) {
      if (view.optionId) selected[snapshotId] = view.optionId;
      if (view.status === 'unanswered') {
        states[snapshotId] = unsupported.has(snapshotId) ? { status: 'unsupported_payload' } : { status: 'pristine' };
      } else {
        states[snapshotId] = { status: view.status };
      }
    }
    return { selectedOptions: selected, saveStates: states };
    // tick: the engine mutates in place and signals changes through onChange.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [engine, tick, unsupported]);

  const flush = useCallback(() => {
    engine?.kick();
  }, [engine]);

  return {
    selectedOptions,
    saveStates,
    selectOption,
    hasUnresolvedSaves: !ready || !engine || engine.hasUnresolved,
    degraded: engine?.degraded ?? false,
    storageDurable: engine?.storageDurable ?? false,
    pendingCount: engine?.pendingCount ?? 0,
    flush,
  };
}
