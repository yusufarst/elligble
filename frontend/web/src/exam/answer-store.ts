// Durable local recovery buffer for exam answers (D04.3-83A/B, D04.5-05/06).
// One record per (tenant, attempt, question snapshot) holding the latest unsynced intent.
// Records are deleted as soon as the server acknowledges that intent, so the device only
// keeps what is not yet on the server (shared-device privacy, D04.3-83D).

/** An earlier choice for the same question that the server has not acknowledged. */
export interface IntentHistoryEntry {
  optionId: string;
  clientWriteIdentity: string;
  capturedAt: number;
}

export interface PendingAnswerRecord {
  key: string;
  attemptKey: string;
  tenantId: string;
  attemptId: string;
  snapshotId: string;
  /** Exam session under which the intent was captured (device/tab binding). */
  examSessionId: string;
  optionId: string;
  clientWriteIdentity: string;
  /** Identities this device already wrote for the snapshot, to recognise its own writes. */
  ownIdentities: string[];
  /** Server write version the intent is based on (null: no server answer yet). */
  baseVersion: number | null;
  localSequence: number;
  /** When the student chose it, in server-anchored epoch milliseconds (server-clock.ts). */
  capturedAt: number;
  /**
   * Earlier unacknowledged choices for the question, oldest first. When the server refuses
   * the latest choice because it was made during an exam pause, the latest earlier choice
   * made outside the pause is sent instead, so an answer chosen before the pause is not
   * lost (Owner decision 2026-09-30). Absent in records written before it existed.
   */
  history?: IntentHistoryEntry[];
}

export interface AnswerStore {
  readonly durable: boolean;
  listForAttempt(tenantId: string, attemptId: string): Promise<PendingAnswerRecord[]>;
  put(record: PendingAnswerRecord): Promise<void>;
  delete(key: string): Promise<void>;
  clearAttempt(tenantId: string, attemptId: string): Promise<void>;
}

export function answerKey(tenantId: string, attemptId: string, snapshotId: string): string {
  return JSON.stringify([tenantId, attemptId, snapshotId]);
}

export function attemptKey(tenantId: string, attemptId: string): string {
  return JSON.stringify([tenantId, attemptId]);
}

export class MemoryAnswerStore implements AnswerStore {
  readonly durable = false;
  private readonly records = new Map<string, PendingAnswerRecord>();

  async listForAttempt(tenantId: string, attemptId: string): Promise<PendingAnswerRecord[]> {
    const key = attemptKey(tenantId, attemptId);
    return [...this.records.values()].filter(r => r.attemptKey === key).map(r => structuredClone(r));
  }
  async put(record: PendingAnswerRecord): Promise<void> {
    this.records.set(record.key, structuredClone(record));
  }
  async delete(key: string): Promise<void> {
    this.records.delete(key);
  }
  async clearAttempt(tenantId: string, attemptId: string): Promise<void> {
    const key = attemptKey(tenantId, attemptId);
    for (const [k, r] of this.records) if (r.attemptKey === key) this.records.delete(k);
  }
}

const DB_NAME = 'elligble_exam_answers';
const DB_VERSION = 1;
const STORE = 'pending_answers';
const BY_ATTEMPT = 'by_attempt';

function request<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error('IndexedDB request failed'));
  });
}

export class IndexedDbAnswerStore implements AnswerStore {
  readonly durable = true;
  private readonly db: IDBDatabase;

  private constructor(db: IDBDatabase) {
    this.db = db;
  }

  static async open(factory: IDBFactory = globalThis.indexedDB): Promise<IndexedDbAnswerStore> {
    if (!factory) throw new Error('IndexedDB unavailable');
    const openReq = factory.open(DB_NAME, DB_VERSION);
    openReq.onupgradeneeded = () => {
      const db = openReq.result;
      if (!db.objectStoreNames.contains(STORE)) {
        const store = db.createObjectStore(STORE, { keyPath: 'key' });
        store.createIndex(BY_ATTEMPT, 'attemptKey', { unique: false });
      }
    };
    const db = await request(openReq);
    // Let a newer version of the app in another tab upgrade the schema.
    db.onversionchange = () => db.close();
    return new IndexedDbAnswerStore(db);
  }

  private async tx<T>(mode: IDBTransactionMode, run: (store: IDBObjectStore) => IDBRequest<T> | void): Promise<T | undefined> {
    const transaction = this.db.transaction(STORE, mode);
    const store = transaction.objectStore(STORE);
    const req = run(store);
    const done = new Promise<void>((resolve, reject) => {
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error ?? new Error('IndexedDB transaction failed'));
      transaction.onabort = () => reject(transaction.error ?? new Error('IndexedDB transaction aborted'));
    });
    const [result] = await Promise.all([req ? request(req) : Promise.resolve(undefined), done]);
    return result;
  }

  async listForAttempt(tenantId: string, attemptId: string): Promise<PendingAnswerRecord[]> {
    const rows = await this.tx('readonly', store => store.index(BY_ATTEMPT).getAll(IDBKeyRange.only(attemptKey(tenantId, attemptId))));
    return (rows ?? []) as PendingAnswerRecord[];
  }
  async put(record: PendingAnswerRecord): Promise<void> {
    await this.tx('readwrite', store => store.put(record));
  }
  async delete(key: string): Promise<void> {
    await this.tx('readwrite', store => store.delete(key));
  }
  async clearAttempt(tenantId: string, attemptId: string): Promise<void> {
    await this.tx('readwrite', store => {
      const cursorReq = store.index(BY_ATTEMPT).openCursor(IDBKeyRange.only(attemptKey(tenantId, attemptId)));
      cursorReq.onsuccess = () => {
        const cursor = cursorReq.result;
        if (cursor) {
          cursor.delete();
          cursor.continue();
        }
      };
    });
  }
}

let sharedStore: Promise<AnswerStore> | null = null;

/**
 * Durable IndexedDB when the browser allows it; otherwise an honest in-memory fallback
 * (the UI then warns that unsynced answers only survive while the page stays open).
 */
export function openAnswerStore(): Promise<AnswerStore> {
  if (!sharedStore) {
    sharedStore = IndexedDbAnswerStore.open().catch(() => new MemoryAnswerStore());
  }
  return sharedStore;
}

/** Removes this device's local copy of an attempt's answers once the attempt is final. */
export async function clearLocalAnswers(tenantId: string, attemptId: string): Promise<void> {
  try {
    const store = await openAnswerStore();
    await store.clearAttempt(tenantId, attemptId);
  } catch {
    // Best effort: leftovers are ignored for a submitted attempt and never sent.
  }
}
