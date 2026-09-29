import { answerKey, attemptKey, type AnswerStore, type PendingAnswerRecord } from './answer-store.ts';

// Local-first answer synchronisation for one attempt on one device (D04.3-83A..D,
// D04.5-05..18, D04.4-37/41). Every selection is written to the local buffer before it is
// sent; "saved" means only that the server acknowledged exactly that intent.
//
// - One latest intent per question; older unsent intents are simply replaced.
// - The expected write version is the last server version known when sending, so an
//   intent captured offline never replays a stale version forever.
// - Within the active session the student's latest visible choice wins a version race
//   (the session is the only writer); an identical server answer counts as saved.
// - Intents left over from a previous session are replayed only if the server answer has
//   not moved since, or its latest write was this device's own; otherwise the server wins.
// - Transient failures retry with exponential backoff and jitter; session supersession,
//   expiry and submission stop the engine without deleting unsynced local intents.

export type SaveOutcome =
  | { kind: 'ack'; writeVersion: number; clientWriteIdentity: string }
  | { kind: 'stale' }
  | { kind: 'identity_conflict' }
  | { kind: 'session_inactive' }
  | { kind: 'terminal'; code: string }
  | { kind: 'rejected'; code: string }
  | { kind: 'unauthorized' }
  | { kind: 'retry' };

export interface ServerAnswerState {
  snapshotId: string;
  optionId: string | null;
  writeVersion: number;
  clientWriteIdentity: string | null;
}

export interface SyncApi {
  save(request: {
    attemptId: string;
    sessionId: string;
    snapshotId: string;
    optionId: string;
    clientWriteIdentity: string;
    expectedWriteVersion: number | null;
  }): Promise<SaveOutcome>;
  fetchServerAnswers(): Promise<ServerAnswerState[]>;
}

export type AnswerSyncStatus = 'unanswered' | 'saving' | 'saved' | 'failed';

export interface AnswerView {
  optionId: string | null;
  status: AnswerSyncStatus;
}

export interface EngineEvents {
  onChange(): void;
  onSessionInactive(): void;
  onTerminal(code: string): void;
  onUnauthorized(): void;
}

export interface RetryPolicy {
  initialDelayMs: number;
  maxDelayMs: number;
  multiplier: number;
  jitterRatio: number;
}

export interface EngineOptions {
  tenantId: string;
  attemptId: string;
  examSessionId: string;
  store: AnswerStore;
  api: SyncApi;
  events: EngineEvents;
  newIdentity?: () => string;
  retryPolicy?: RetryPolicy;
  random?: () => number;
  setTimer?: (fn: () => void, ms: number) => unknown;
  clearTimer?: (handle: unknown) => void;
}

const DEFAULT_RETRY: RetryPolicy = { initialDelayMs: 1000, maxDelayMs: 30000, multiplier: 2, jitterRatio: 0.3 };
const MAX_CONSECUTIVE_STALE = 2;
const MAX_OWN_IDENTITIES = 20;

interface ServerEntry {
  optionId: string | null;
  writeVersion: number;
  clientWriteIdentity: string | null;
}

export interface InitializeResult {
  adopted: number;
  discarded: number;
}

export class AnswerSyncEngine {
  private readonly opts: Required<Omit<EngineOptions, 'retryPolicy'>> & { retryPolicy: RetryPolicy };
  private readonly server = new Map<string, ServerEntry>();
  private readonly pending = new Map<string, PendingAnswerRecord>();
  private readonly inFlight = new Set<string>();
  private readonly failedAttempts = new Map<string, number>();
  private readonly rejected = new Map<string, string>();
  private readonly staleCount = new Map<string, number>();
  private sequence = 0;
  private running = false;
  private rerunRequested = false;
  private initialization: Promise<InitializeResult> | null = null;
  private initialized = false;
  private stopped: 'session_inactive' | 'terminal' | null = null;
  private paused = false;
  private disposed = false;
  private retryTimer: unknown = null;
  private retryDelay = 0;
  private lastSendFailed = false;

  constructor(options: EngineOptions) {
    this.opts = {
      newIdentity: () => crypto.randomUUID(),
      random: Math.random,
      setTimer: (fn, ms) => setTimeout(fn, ms),
      clearTimer: handle => clearTimeout(handle as ReturnType<typeof setTimeout>),
      ...options,
      retryPolicy: options.retryPolicy ?? DEFAULT_RETRY,
    };
  }

  get storageDurable(): boolean {
    return this.opts.store.durable;
  }

  /** True while at least one intent is waiting after a failed send (connectivity trouble). */
  get degraded(): boolean {
    return this.lastSendFailed && this.pending.size > 0;
  }

  get pendingCount(): number {
    return this.pending.size;
  }

  get hasUnresolved(): boolean {
    return this.pending.size > 0 || this.rejected.size > 0;
  }

  view(snapshotId: string): AnswerView {
    const local = this.pending.get(snapshotId);
    if (local) {
      if (this.rejected.has(snapshotId)) return { optionId: local.optionId, status: 'failed' };
      if (this.inFlight.has(snapshotId)) return { optionId: local.optionId, status: 'saving' };
      // While sends are failing (offline, server unreachable) every queued intent is honestly
      // "not saved yet, retrying automatically", not only the one that was last tried.
      if ((this.failedAttempts.get(snapshotId) ?? 0) > 0 || this.stopped || this.paused || this.lastSendFailed) {
        return { optionId: local.optionId, status: 'failed' };
      }
      return { optionId: local.optionId, status: 'saving' };
    }
    const server = this.server.get(snapshotId);
    if (server?.optionId) return { optionId: server.optionId, status: 'saved' };
    return { optionId: null, status: 'unanswered' };
  }

  /** Current view of every question this engine knows about (server answers and local intents). */
  views(): Record<string, AnswerView> {
    const result: Record<string, AnswerView> = {};
    for (const snapshotId of new Set([...this.server.keys(), ...this.pending.keys()])) {
      result[snapshotId] = this.view(snapshotId);
    }
    return result;
  }

  initialize(serverAnswers: ServerAnswerState[]): Promise<InitializeResult> {
    if (!this.initialization) this.initialization = this.load(serverAnswers);
    return this.initialization;
  }

  private async load(serverAnswers: ServerAnswerState[]): Promise<InitializeResult> {
    for (const answer of serverAnswers) {
      this.server.set(answer.snapshotId, {
        optionId: answer.optionId,
        writeVersion: answer.writeVersion,
        clientWriteIdentity: answer.clientWriteIdentity,
      });
    }
    let adopted = 0;
    let discarded = 0;
    let records: PendingAnswerRecord[] = [];
    try {
      records = await this.opts.store.listForAttempt(this.opts.tenantId, this.opts.attemptId);
    } catch {
      records = [];
    }
    for (const record of records.sort((a, b) => a.localSequence - b.localSequence)) {
      this.sequence = Math.max(this.sequence, record.localSequence);
      const server = this.server.get(record.snapshotId);
      if (server && server.optionId === record.optionId) {
        // Already on the server (the acknowledgement was lost): nothing to send.
        await this.safeDelete(record.key);
        continue;
      }
      if (record.examSessionId !== this.opts.examSessionId) {
        const serverVersion = server ? server.writeVersion : null;
        const serverIsOurs = server?.clientWriteIdentity != null &&
          (record.ownIdentities.includes(server.clientWriteIdentity) || record.clientWriteIdentity === server.clientWriteIdentity);
        if (serverVersion !== record.baseVersion && !serverIsOurs) {
          // Someone else answered after this device's last known state (device transfer,
          // D04.4-41): the authoritative server answer stays.
          await this.safeDelete(record.key);
          discarded++;
          continue;
        }
        record.examSessionId = this.opts.examSessionId;
        record.baseVersion = serverVersion;
        await this.safePut(record);
        adopted++;
      }
      this.pending.set(record.snapshotId, record);
    }
    this.initialized = true;
    this.opts.events.onChange();
    this.kick();
    return { adopted, discarded };
  }

  async capture(snapshotId: string, optionId: string): Promise<void> {
    // A choice made while the stored intents are still loading must not be overwritten by
    // an older stored intent for the same question.
    if (!this.initialized && this.initialization) await this.initialization;
    if (this.disposed) return;
    const existing = this.pending.get(snapshotId);
    const server = this.server.get(snapshotId);
    if (!existing && server?.optionId === optionId) return;

    const ownIdentities = [...(existing?.ownIdentities ?? [])];
    if (existing) ownIdentities.push(existing.clientWriteIdentity);
    const record: PendingAnswerRecord = {
      key: answerKey(this.opts.tenantId, this.opts.attemptId, snapshotId),
      attemptKey: attemptKey(this.opts.tenantId, this.opts.attemptId),
      tenantId: this.opts.tenantId,
      attemptId: this.opts.attemptId,
      snapshotId,
      examSessionId: this.opts.examSessionId,
      optionId,
      clientWriteIdentity: this.opts.newIdentity(),
      ownIdentities: [...new Set(ownIdentities)].slice(-MAX_OWN_IDENTITIES),
      baseVersion: existing ? existing.baseVersion : server ? server.writeVersion : null,
      localSequence: ++this.sequence,
      capturedAt: Date.now(),
    };
    this.pending.set(snapshotId, record);
    this.rejected.delete(snapshotId);
    this.staleCount.delete(snapshotId);
    this.opts.events.onChange();
    await this.safePut(record);
    this.kick();
  }

  /** Try now (new input, connectivity regained, tab visible, re-authenticated). */
  kick(): void {
    if (this.disposed || this.stopped || this.paused) return;
    if (this.retryTimer !== null) {
      this.opts.clearTimer(this.retryTimer);
      this.retryTimer = null;
    }
    if (this.running) {
      // A send is in flight; look at the queue again as soon as it settles.
      this.rerunRequested = true;
      return;
    }
    void this.run();
  }

  /** Resume after the caller re-authenticated following an unauthorized response. */
  resume(): void {
    this.paused = false;
    this.kick();
  }

  dispose(): void {
    this.disposed = true;
    if (this.retryTimer !== null) this.opts.clearTimer(this.retryTimer);
    this.retryTimer = null;
  }

  /** After an authoritative submission the local buffer for this attempt is no longer needed. */
  async clearAfterSubmission(): Promise<void> {
    this.pending.clear();
    try {
      await this.opts.store.clearAttempt(this.opts.tenantId, this.opts.attemptId);
    } catch {
      // Best effort; stale records are ignored by later sessions once the attempt is submitted.
    }
  }

  private nextCandidate(): PendingAnswerRecord | null {
    let next: PendingAnswerRecord | null = null;
    for (const record of this.pending.values()) {
      if (this.inFlight.has(record.snapshotId) || this.rejected.has(record.snapshotId)) continue;
      if (!next || record.localSequence < next.localSequence) next = record;
    }
    return next;
  }

  private async run(): Promise<void> {
    if (this.running) return;
    this.running = true;
    this.rerunRequested = false;
    try {
      while (!this.disposed && !this.stopped && !this.paused) {
        const record = this.nextCandidate();
        if (!record) break;
        const proceed = await this.sendOne(record);
        if (!proceed) break;
      }
    } finally {
      this.running = false;
    }
    if (this.rerunRequested) {
      this.rerunRequested = false;
      this.kick();
    }
  }

  /** Returns false when processing should stop (backoff scheduled or engine halted). */
  private async sendOne(record: PendingAnswerRecord): Promise<boolean> {
    const snapshotId = record.snapshotId;
    this.inFlight.add(snapshotId);
    this.opts.events.onChange();
    let outcome: SaveOutcome;
    try {
      outcome = await this.opts.api.save({
        attemptId: this.opts.attemptId,
        sessionId: this.opts.examSessionId,
        snapshotId,
        optionId: record.optionId,
        clientWriteIdentity: record.clientWriteIdentity,
        expectedWriteVersion: record.baseVersion,
      });
    } catch {
      outcome = { kind: 'retry' };
    }
    this.inFlight.delete(snapshotId);
    if (this.disposed) return false;

    switch (outcome.kind) {
      case 'ack':
        await this.onAck(record, outcome);
        this.markSendSucceeded();
        return true;
      case 'stale':
        return this.onStale(snapshotId);
      case 'identity_conflict': {
        const current = this.pending.get(snapshotId);
        if (current) {
          current.ownIdentities = [...new Set([...current.ownIdentities, current.clientWriteIdentity])].slice(-MAX_OWN_IDENTITIES);
          current.clientWriteIdentity = this.opts.newIdentity();
          await this.safePut(current);
        }
        return true;
      }
      case 'session_inactive':
        this.stopped = 'session_inactive';
        this.opts.events.onChange();
        this.opts.events.onSessionInactive();
        return false;
      case 'terminal':
        this.stopped = 'terminal';
        this.opts.events.onChange();
        this.opts.events.onTerminal(outcome.code);
        return false;
      case 'rejected':
        this.rejected.set(snapshotId, outcome.code);
        this.opts.events.onChange();
        return true;
      case 'unauthorized':
        this.paused = true;
        this.opts.events.onChange();
        this.opts.events.onUnauthorized();
        return false;
      case 'retry':
        this.failedAttempts.set(snapshotId, (this.failedAttempts.get(snapshotId) ?? 0) + 1);
        this.lastSendFailed = true;
        this.opts.events.onChange();
        this.scheduleRetry();
        return false;
    }
  }

  private async onAck(sent: PendingAnswerRecord, ack: { writeVersion: number; clientWriteIdentity: string }): Promise<void> {
    const snapshotId = sent.snapshotId;
    this.server.set(snapshotId, { optionId: sent.optionId, writeVersion: ack.writeVersion, clientWriteIdentity: ack.clientWriteIdentity });
    this.failedAttempts.delete(snapshotId);
    this.staleCount.delete(snapshotId);
    const current = this.pending.get(snapshotId);
    if (current && current.clientWriteIdentity === sent.clientWriteIdentity) {
      this.pending.delete(snapshotId);
      await this.safeDelete(current.key);
    } else if (current) {
      // A newer choice was made while this one was in flight: rebase it on the new version.
      current.baseVersion = ack.writeVersion;
      current.ownIdentities = [...new Set([...current.ownIdentities, ack.clientWriteIdentity])].slice(-MAX_OWN_IDENTITIES);
      await this.safePut(current);
    }
    this.opts.events.onChange();
  }

  private async onStale(snapshotId: string): Promise<boolean> {
    let answers: ServerAnswerState[];
    try {
      answers = await this.opts.api.fetchServerAnswers();
    } catch {
      this.failedAttempts.set(snapshotId, (this.failedAttempts.get(snapshotId) ?? 0) + 1);
      this.lastSendFailed = true;
      this.opts.events.onChange();
      this.scheduleRetry();
      return false;
    }
    for (const answer of answers) {
      this.server.set(answer.snapshotId, { optionId: answer.optionId, writeVersion: answer.writeVersion, clientWriteIdentity: answer.clientWriteIdentity });
    }
    const current = this.pending.get(snapshotId);
    if (!current) return true;
    const server = this.server.get(snapshotId);
    if (server && server.optionId === current.optionId) {
      // The server already holds exactly this choice.
      this.pending.delete(snapshotId);
      await this.safeDelete(current.key);
      this.failedAttempts.delete(snapshotId);
      this.staleCount.delete(snapshotId);
      this.opts.events.onChange();
      return true;
    }
    const stale = (this.staleCount.get(snapshotId) ?? 0) + 1;
    this.staleCount.set(snapshotId, stale);
    // The active session is the only legitimate writer, so the student's latest visible
    // choice is rebased onto the server version and sent again.
    current.baseVersion = server ? server.writeVersion : null;
    await this.safePut(current);
    if (stale >= MAX_CONSECUTIVE_STALE) {
      // Keep the intent but back off instead of racing the server in a tight loop.
      this.failedAttempts.set(snapshotId, (this.failedAttempts.get(snapshotId) ?? 0) + 1);
      this.staleCount.set(snapshotId, 0);
      this.opts.events.onChange();
      this.scheduleRetry();
      return false;
    }
    return true;
  }

  private markSendSucceeded(): void {
    this.lastSendFailed = false;
    this.retryDelay = 0;
  }

  private scheduleRetry(): void {
    if (this.disposed || this.stopped || this.retryTimer !== null) return;
    const policy = this.opts.retryPolicy;
    this.retryDelay = this.retryDelay === 0 ? policy.initialDelayMs : Math.min(policy.maxDelayMs, this.retryDelay * policy.multiplier);
    const delay = Math.min(policy.maxDelayMs, this.retryDelay + this.retryDelay * policy.jitterRatio * this.opts.random());
    this.retryTimer = this.opts.setTimer(() => {
      this.retryTimer = null;
      this.kick();
    }, delay);
  }

  private async safePut(record: PendingAnswerRecord): Promise<void> {
    try {
      await this.opts.store.put(record);
    } catch {
      // Storage failure (quota, private mode): the in-memory intent is still sent.
    }
  }

  private async safeDelete(key: string): Promise<void> {
    try {
      await this.opts.store.delete(key);
    } catch {
      // Ignored: a stale record is reconciled against the server on the next load.
    }
  }
}
