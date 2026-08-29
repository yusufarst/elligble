import type { ClientAnswerRecoveryScope, ClientAnswerRecoveryStore } from './client-answer-recovery-store.ts';
import type { ClientAnswerSynchronizationExecutor, ClientAnswerReconciliationSummary } from './client-answer-reconciliation-queue.ts';
import { reconcileClientAnswerQueue } from './client-answer-reconciliation-queue.ts';

export interface RetryPolicy {
  initialDelayMs: number;
  maxDelayMs: number;
  backoffMultiplier: number;
  jitterRatio: number;
}

export interface RetryScheduler {
  setTimeout: (callback: () => void, ms: number) => any;
  clearTimeout: (id: any) => void;
}

export interface RetryRandomness {
  random: () => number;
}

export class ClientAnswerReconciliationRetryController {
  private currentBaseDelayMs = 0;
  private timerId: any | null = null;
  private isReconciling = false;
  private isDisposed = false;
  private pendingImmediateTrigger = false;

  private scope: ClientAnswerRecoveryScope;
  private store: Pick<ClientAnswerRecoveryStore, 'listByScope' | 'put'>;
  private executor: ClientAnswerSynchronizationExecutor;
  private policy: RetryPolicy;
  private scheduler: RetryScheduler;
  private randomness: RetryRandomness;

  constructor(
    scope: ClientAnswerRecoveryScope,
    store: Pick<ClientAnswerRecoveryStore, 'listByScope' | 'put'>,
    executor: ClientAnswerSynchronizationExecutor,
    policy: RetryPolicy,
    scheduler: RetryScheduler,
    randomness: RetryRandomness
  ) {
    this.scope = scope;
    this.store = store;
    this.executor = executor;
    this.policy = policy;
    this.scheduler = scheduler;
    this.randomness = randomness;
    if (!Number.isFinite(policy.initialDelayMs) || policy.initialDelayMs <= 0) {
      throw new Error('Invalid initialDelayMs: must be a positive finite number');
    }
    if (!Number.isFinite(policy.maxDelayMs) || policy.maxDelayMs <= 0) {
      throw new Error('Invalid maxDelayMs: must be a positive finite number');
    }
    if (!Number.isFinite(policy.backoffMultiplier) || policy.backoffMultiplier <= 0) {
      throw new Error('Invalid backoffMultiplier: must be a positive finite number');
    }
    if (!Number.isFinite(policy.jitterRatio) || policy.jitterRatio <= 0) {
      throw new Error('Invalid jitterRatio: must be a positive finite number');
    }
  }

  public trigger(): void {
    if (this.isDisposed) {
      return;
    }

    if (this.timerId !== null) {
      this.scheduler.clearTimeout(this.timerId);
      this.timerId = null;
    }

    if (this.isReconciling) {
      this.pendingImmediateTrigger = true;
      return;
    }

    // Fire and forget
    this.executeReconciliation().catch(() => {});
  }

  public dispose(): void {
    this.isDisposed = true;
    if (this.timerId !== null) {
      this.scheduler.clearTimeout(this.timerId);
      this.timerId = null;
    }
    this.pendingImmediateTrigger = false;
  }

  private async executeReconciliation(): Promise<void> {
    if (this.isDisposed) {
      return;
    }

    this.isReconciling = true;
    this.pendingImmediateTrigger = false;

    let scheduleNeeded = false;

    try {
      const summary = await reconcileClientAnswerQueue(this.scope, this.store, this.executor);
      if (summary.failed > 0) {
        scheduleNeeded = true;
      } else {
        // Success or empty: reset retry progression
        this.currentBaseDelayMs = 0;
      }
    } catch (error) {
      scheduleNeeded = true;
    } finally {
      this.isReconciling = false;
      
      if (!this.isDisposed) {
        if (this.pendingImmediateTrigger) {
          this.trigger();
        } else if (scheduleNeeded) {
          this.scheduleRetry();
        }
      }
    }
  }

  private scheduleRetry(): void {
    if (this.isDisposed || this.timerId !== null) {
      return;
    }

    if (this.currentBaseDelayMs === 0) {
      this.currentBaseDelayMs = this.policy.initialDelayMs;
    } else {
      this.currentBaseDelayMs = Math.min(this.policy.maxDelayMs, this.currentBaseDelayMs * this.policy.backoffMultiplier);
    }

    const jitter = this.currentBaseDelayMs * this.policy.jitterRatio * this.randomness.random();
    const delay = Math.min(this.policy.maxDelayMs, this.currentBaseDelayMs + jitter);

    this.timerId = this.scheduler.setTimeout(() => {
      this.timerId = null;
      this.executeReconciliation().catch(() => {});
    }, delay);
  }
}
