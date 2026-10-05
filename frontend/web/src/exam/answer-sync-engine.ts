import { answerKey, attemptKey, type AnswerStore, type IntentHistoryEntry, type PendingAnswerRecord } from './answer-store.ts';
import { serverClock } from './server-clock.ts';

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
// - Exam pause (Owner decision 2026-09-30): every intent carries its server-anchored
//   capture time. The server accepts, even while paused, an intent chosen before the pause
//   boundary and refuses one chosen during a pause. A refused intent falls back to the
//   latest earlier choice for that question made outside every known pause; when there is
//   none, the server's answer stays. Such discarded choices are reported, never silently
//   lost, and no new choice is captured while the exam is known to be paused. A supervisor's
//   lock of this attempt (D04.6-38) follows the same boundary rule.
// - Answers about a pause or lock can arrive out of order. Each carries the server time it
//   was produced at, and one older than an answer already applied about the same kind of
//   span is stale: it cannot close a span the server still holds open or reopen one that
//   ended. A stale refusal only shows that the span lasted at least until then, so a choice
//   made later is left for the server to decide instead of being dropped.
// - An intent the server refused because of a pause or lock but this engine keeps (it cannot
//   place the choice inside a known span) is held: it is not sent again until its backoff
//   elapses, whatever else asks to send now (the state check each refusal triggers, a
//   reconnect), so the two can never feed each other in a loop; the other intents go on. When
//   the pause or lock ends, a held intent is tried again after the shortest backoff, and when
//   the time runs out, at once.

export type SaveOutcome =
  | { kind: 'ack'; writeVersion: number; clientWriteIdentity: string }
  | { kind: 'stale' }
  | { kind: 'identity_conflict' }
  | { kind: 'session_inactive' }
  | { kind: 'terminal'; code: string }
  | { kind: 'rejected'; code: string }
  | { kind: 'unauthorized' }
  | { kind: 'retry' }
  /** The exam is paused and the intent was not chosen before the boundary (null: unknown boundary). */
  | { kind: 'exam_paused'; pausedAt: number | null; serverTime?: number | null }
  /** The intent was chosen inside this pause interval of the exam. */
  | { kind: 'captured_during_pause'; pausedAt: number; resumedAt: number | null }
  /** A supervisor locked this attempt and the intent was not chosen before the lock. */
  | { kind: 'attempt_locked'; lockedAt: number | null; serverTime?: number | null }
  /** The intent was chosen while this attempt was locked. */
  | { kind: 'captured_during_lock'; lockedAt: number; unlockedAt: number | null };

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
    /** Server-anchored capture time in epoch milliseconds. */
    capturedAt: number;
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
  /** A save showed that the exam is paused (the workstation switches to its paused screen). */
  onExamPaused?(pausedAt: number | null): void;
  /** A save showed that a supervisor locked this attempt. */
  onAttemptLocked?(lockedAt: number | null): void;
  /** Choices made during a pause were dropped for these questions (each shows its earlier answer). */
  onDiscarded?(snapshotIds: string[]): void;
}

export type ExamRunState = 'ACTIVE' | 'PAUSED' | 'ENDED';

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
  /** Server-anchored clock for capture times (epoch milliseconds). */
  now?: () => number;
}

const DEFAULT_RETRY: RetryPolicy = { initialDelayMs: 1000, maxDelayMs: 30000, multiplier: 2, jitterRatio: 0.3 };
const MAX_CONSECUTIVE_STALE = 2;
const MAX_OWN_IDENTITIES = 20;
const MAX_HISTORY = 8;

export type BlockSource = 'pause' | 'lock';

/** A time span in which choices are not accepted: an exam pause or a lock of this attempt. */
interface BlockInterval {
  source: BlockSource;
  from: number;
  /** Null while it is open. */
  to: number | null;
  /** The end is the server's record, not an estimate: such a span never opens again. */
  exact?: boolean;
}

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
  /** Refused intents this engine keeps, by question: not sent again before the backoff releases them. */
  private readonly held = new Map<string, string>();
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
  private readonly blocks: BlockInterval[] = [];
  private examPaused = false;
  private attemptLocked = false;
  /** Server time of the newest answer applied about a pause and about a lock. */
  private readonly seenAt: Record<BlockSource, number> = { pause: Number.NEGATIVE_INFINITY, lock: Number.NEGATIVE_INFINITY };

  constructor(options: EngineOptions) {
    this.opts = {
      newIdentity: () => crypto.randomUUID(),
      random: Math.random,
      setTimer: (fn, ms) => setTimeout(fn, ms),
      clearTimer: handle => clearTimeout(handle as ReturnType<typeof setTimeout>),
      now: () => serverClock.now(),
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
    // The exam screen is read-only during a pause; a choice made anyway would be refused.
    if (this.disposed || this.examPaused || this.attemptLocked) return;
    const existing = this.pending.get(snapshotId);
    const server = this.server.get(snapshotId);
    if (!existing && server?.optionId === optionId) return;

    const ownIdentities = [...(existing?.ownIdentities ?? [])];
    if (existing) ownIdentities.push(existing.clientWriteIdentity);
    const history: IntentHistoryEntry[] = existing
      ? [...(existing.history ?? []), { optionId: existing.optionId, clientWriteIdentity: existing.clientWriteIdentity, capturedAt: existing.capturedAt }].slice(-MAX_HISTORY)
      : [];
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
      capturedAt: this.opts.now(),
      history,
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
    // Trying now cuts a transient backoff short; the timer stays while it is what releases a
    // held intent, so a refused intent is never sent again before its backoff.
    if (this.retryTimer !== null && !this.holdsRefused()) {
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

  /**
   * The attempt is about to be finalized (its time ran out, D04.5-46): a held intent is tried
   * once more at once instead of after its backoff, since there is no later.
   */
  flushBeforeFinalization(): void {
    this.held.clear();
    this.kick();
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
      if (this.inFlight.has(record.snapshotId) || this.rejected.has(record.snapshotId) || this.isHeld(record)) continue;
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
    const sentIdentity = record.clientWriteIdentity;
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
        capturedAt: record.capturedAt,
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
      case 'exam_paused':
        if (!this.accept('pause', outcome.serverTime)) {
          if (outcome.pausedAt !== null) this.noteLasted('pause', outcome.pausedAt, outcome.serverTime!);
          return this.afterPauseRefusal(snapshotId, sentIdentity);
        }
        this.examPaused = true;
        this.opts.events.onExamPaused?.(outcome.pausedAt);
        if (outcome.pausedAt === null) {
          // No boundary to decide by: keep every intent and ask again later.
          this.hold(snapshotId, sentIdentity);
          return true;
        }
        this.noteOpen('pause', outcome.pausedAt);
        return this.afterPauseRefusal(snapshotId, sentIdentity);
      case 'captured_during_pause':
        this.noteBlock('pause', outcome.pausedAt, outcome.resumedAt);
        return this.afterPauseRefusal(snapshotId, sentIdentity);
      case 'attempt_locked':
        if (!this.accept('lock', outcome.serverTime)) {
          if (outcome.lockedAt !== null) this.noteLasted('lock', outcome.lockedAt, outcome.serverTime!);
          return this.afterPauseRefusal(snapshotId, sentIdentity);
        }
        this.attemptLocked = true;
        this.opts.events.onAttemptLocked?.(outcome.lockedAt);
        if (outcome.lockedAt === null) {
          this.hold(snapshotId, sentIdentity);
          return true;
        }
        this.noteOpen('lock', outcome.lockedAt);
        return this.afterPauseRefusal(snapshotId, sentIdentity);
      case 'captured_during_lock':
        this.noteBlock('lock', outcome.lockedAt, outcome.unlockedAt);
        return this.afterPauseRefusal(snapshotId, sentIdentity);
    }
  }

  /**
   * The workstation learned whether a supervisor has locked this attempt, from an answer the
   * server produced at `at` (null: unknown; a stale answer is ignored): a known lock stops
   * new captures and settles every intent against its boundary; an unlock closes it now.
   */
  async noteLockState(lockedAt: number | null, at: number | null = null): Promise<void> {
    if (this.disposed || !this.accept('lock', at)) return;
    if (lockedAt !== null) {
      this.attemptLocked = true;
      this.noteOpen('lock', lockedAt);
      await this.settleAgainstPauses();
      this.opts.events.onChange();
      this.kick();
      return;
    }
    if (this.attemptLocked || this.blocks.some(b => b.source === 'lock' && b.to === null)) {
      const now = this.opts.now();
      for (const block of this.blocks) if (block.source === 'lock' && block.to === null) block.to = Math.max(block.from, now);
      this.retryHeldSoon();
    }
    this.attemptLocked = false;
    this.opts.events.onChange();
    this.kick();
  }

  /** True while the engine knows this attempt is locked (captures are ignored). */
  get attemptIsLocked(): boolean {
    return this.attemptLocked;
  }

  /**
   * The workstation learned the exam state (periodic check, resume) from an answer the server
   * produced at `at` (null: unknown; a stale answer is ignored). A known pause stops new
   * captures and settles every intent against its boundary at once; when the exam runs
   * again, an open pause is closed at the current time (the screen was paused until now).
   */
  async noteExamState(state: ExamRunState, pausedAt: number | null, at: number | null = null): Promise<void> {
    if (this.disposed || !this.accept('pause', at)) return;
    if (state === 'PAUSED') {
      this.examPaused = true;
      if (pausedAt !== null) {
        this.noteOpen('pause', pausedAt);
        await this.settleAgainstPauses();
      }
      this.opts.events.onChange();
      this.kick();
      return;
    }
    if (this.examPaused || this.blocks.some(b => b.source === 'pause' && b.to === null)) {
      const now = this.opts.now();
      for (const block of this.blocks) if (block.source === 'pause' && block.to === null) block.to = Math.max(block.from, now);
      this.retryHeldSoon();
    }
    this.examPaused = false;
    this.opts.events.onChange();
    this.kick();
  }

  /** True while the engine knows the exam is paused (captures are ignored). */
  get examIsPaused(): boolean {
    return this.examPaused;
  }

  /**
   * Whether an answer about a pause or lock produced at server time `at` is not older than
   * one already applied about the same kind of span (an answer without a time is accepted).
   */
  isFresh(source: BlockSource, at: number | null | undefined): boolean {
    return typeof at !== 'number' || at >= this.seenAt[source];
  }

  /** Accepts a fresh answer and remembers its time; false for a stale one. */
  private accept(source: BlockSource, at: number | null | undefined): boolean {
    if (!this.isFresh(source, at)) return false;
    if (typeof at === 'number') this.seenAt[source] = at;
    return true;
  }

  /**
   * A fresh answer says the server holds a span open since `from`: open it, also when this
   * engine had closed it by estimate (a span the server recorded as ended stays ended).
   */
  private noteOpen(source: BlockSource, from: number): void {
    const known = this.blocks.find(b => b.source === source && b.from === from);
    if (!known) this.noteBlock(source, from, null);
    else if (!known.exact) known.to = null;
  }

  /** The server's record of a span that began at `from`: ended at `to`, or open when to is null. */
  private noteBlock(source: BlockSource, from: number, to: number | null): void {
    const known = this.blocks.find(b => b.source === source && b.from === from);
    if (known) {
      if (to !== null) {
        known.to = to;
        known.exact = true;
      }
      return;
    }
    // A newer span means an older one of the same kind this engine still believed open had ended.
    for (const block of this.blocks) if (block.source === source && block.to === null && block.from < from) block.to = from;
    this.blocks.push({ source, from, to, exact: to !== null });
  }

  /**
   * A stale refusal: the span that began at `from` still held at server time `at`, but a newer
   * answer said it was over. Only [from, at) is certain; a later choice is for the server.
   */
  private noteLasted(source: BlockSource, from: number, at: number): void {
    const until = Math.max(from, at);
    const known = this.blocks.find(b => b.source === source && b.from === from);
    if (!known) this.blocks.push({ source, from, to: until });
    else if (!known.exact && known.to !== null && known.to < until) known.to = until;
  }

  private insidePause(capturedAt: number): boolean {
    return this.blocks.some(b => capturedAt >= b.from && (b.to === null || capturedAt < b.to));
  }

  private async afterPauseRefusal(snapshotId: string, sentIdentity: string): Promise<boolean> {
    await this.settleAgainstPauses();
    // The server refused an intent this engine would keep: never loop, back off.
    this.hold(snapshotId, sentIdentity);
    return true;
  }

  /**
   * Holds a refused intent that is still the question's latest (a newer choice is not held)
   * until the backoff releases it; the other intents go on, so one the server would accept
   * is never stuck behind it.
   */
  private hold(snapshotId: string, sentIdentity: string): void {
    if (this.pending.get(snapshotId)?.clientWriteIdentity !== sentIdentity) return;
    this.held.set(snapshotId, sentIdentity);
    this.failedAttempts.set(snapshotId, (this.failedAttempts.get(snapshotId) ?? 0) + 1);
    this.opts.events.onChange();
    this.scheduleRetry();
  }

  private isHeld(record: PendingAnswerRecord): boolean {
    return this.held.get(record.snapshotId) === record.clientWriteIdentity;
  }

  /** True while a held intent is still waiting (one replaced or settled since is no longer held). */
  private holdsRefused(): boolean {
    for (const [snapshotId, identity] of this.held) {
      if (this.pending.get(snapshotId)?.clientWriteIdentity === identity) return true;
      this.held.delete(snapshotId);
    }
    return false;
  }

  /**
   * A pause or lock ended: a held intent is tried again after the shortest backoff, not at
   * once, so even answers that contradict each other cannot make it loop.
   */
  private retryHeldSoon(): void {
    if (this.disposed || !this.holdsRefused()) return;
    if (this.retryTimer !== null) this.opts.clearTimer(this.retryTimer);
    this.retryTimer = null;
    this.retryDelay = 0;
    this.scheduleRetry();
  }

  /** Applies every known pause to every waiting intent; reports the questions whose latest choice was dropped. */
  private async settleAgainstPauses(): Promise<void> {
    const discarded: string[] = [];
    for (const record of [...this.pending.values()]) {
      if (this.inFlight.has(record.snapshotId)) continue;
      if (await this.settleRecord(record)) discarded.push(record.snapshotId);
    }
    if (discarded.length > 0) this.opts.events.onDiscarded?.(discarded);
    this.opts.events.onChange();
  }

  /** Returns true when the latest choice for the question was dropped. */
  private async settleRecord(record: PendingAnswerRecord): Promise<boolean> {
    const candidates: IntentHistoryEntry[] = [
      ...(record.history ?? []),
      { optionId: record.optionId, clientWriteIdentity: record.clientWriteIdentity, capturedAt: record.capturedAt },
    ];
    let keep = -1;
    for (let i = candidates.length - 1; i >= 0; i--) {
      if (!this.insidePause(candidates[i].capturedAt)) {
        keep = i;
        break;
      }
    }
    if (keep === candidates.length - 1) return false;
    const snapshotId = record.snapshotId;
    const server = this.server.get(snapshotId);
    if (keep < 0 || server?.optionId === candidates[keep].optionId) {
      // Nothing else to send: the server's answer (or no answer) stays for this question.
      this.pending.delete(snapshotId);
      this.rejected.delete(snapshotId);
      this.failedAttempts.delete(snapshotId);
      this.staleCount.delete(snapshotId);
      await this.safeDelete(record.key);
      return true;
    }
    const chosen = candidates[keep];
    const dropped = candidates.slice(keep + 1).map(c => c.clientWriteIdentity);
    record.optionId = chosen.optionId;
    record.clientWriteIdentity = chosen.clientWriteIdentity;
    record.capturedAt = chosen.capturedAt;
    record.history = candidates.slice(0, keep);
    record.ownIdentities = [...new Set([...record.ownIdentities, ...dropped])].filter(id => id !== chosen.clientWriteIdentity).slice(-MAX_OWN_IDENTITIES);
    this.rejected.delete(snapshotId);
    await this.safePut(record);
    return true;
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
      // Earlier choices up to the acknowledged one are now the server's answer.
      current.baseVersion = ack.writeVersion;
      current.ownIdentities = [...new Set([...current.ownIdentities, ack.clientWriteIdentity])].slice(-MAX_OWN_IDENTITIES);
      const history = current.history ?? [];
      const acked = history.findIndex(h => h.clientWriteIdentity === sent.clientWriteIdentity);
      if (acked >= 0) current.history = history.slice(acked + 1);
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
      this.held.clear();
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
