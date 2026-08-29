import type {
  ClientAnswerRecoveryStore,
  ClientAnswerRecoveryRecord,
  ClientAnswerRecoveryScope
} from './client-answer-recovery-store.js';
import { buildRecoveryScopeKey, isRecoveryRecordForScope } from './client-answer-recovery-store.js';

const DB_NAME = 'elligble_secure_assessment_recovery';
const DB_VERSION = 1;
const STORE_NAME = 'client_answers';
const INDEX_SCOPE = 'idx_scope_key';

export interface IndexedDBRecoveryStoreOptions {
  idbFactory?: IDBFactory;
}

export class IndexedDBClientAnswerRecoveryStore implements ClientAnswerRecoveryStore {
  private readonly _idbFactory: IDBFactory;

  constructor(options?: IndexedDBRecoveryStoreOptions) {
    const factory = options?.idbFactory ?? globalThis.indexedDB;
    if (!factory) {
      throw new Error('IndexedDB factory not available in this environment');
    }
    this._idbFactory = factory;
  }

  private _openDB(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      let request: IDBOpenDBRequest;
      try {
        request = this._idbFactory.open(DB_NAME, DB_VERSION);
      } catch (err) {
        return reject(err);
      }

      request.onupgradeneeded = (event: IDBVersionChangeEvent) => {
        const db = request.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          const store = db.createObjectStore(STORE_NAME, { keyPath: 'recordKey' });
          store.createIndex(INDEX_SCOPE, 'scopeKey', { unique: false });
        }
      };

      request.onsuccess = () => {
        resolve(request.result);
      };

      request.onerror = () => {
        reject(request.error || new Error('Failed to open IndexedDB'));
      };
    });
  }

  async put(record: ClientAnswerRecoveryRecord): Promise<void> {
    const db = await this._openDB();
    return new Promise<void>((resolve, reject) => {
      let tx: IDBTransaction;
      try {
        tx = db.transaction(STORE_NAME, 'readwrite');
      } catch (err) {
        db.close();
        return reject(err);
      }

      const store = tx.objectStore(STORE_NAME);
      const clonedRecord: ClientAnswerRecoveryRecord = JSON.parse(JSON.stringify(record));
      const request = store.put(clonedRecord);

      request.onsuccess = () => {};
      request.onerror = () => reject(request.error || new Error('Failed to put record'));

      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error || new Error('Transaction failed'));
      tx.onabort = () => reject(tx.error || new Error('Transaction aborted'));
    }).finally(() => {
       db.close();
    });
  }

  async get(recordKey: string): Promise<ClientAnswerRecoveryRecord | null> {
    const db = await this._openDB();
    return new Promise<ClientAnswerRecoveryRecord | null>((resolve, reject) => {
      let tx: IDBTransaction;
      try {
        tx = db.transaction(STORE_NAME, 'readonly');
      } catch (err) {
        db.close();
        return reject(err);
      }

      const store = tx.objectStore(STORE_NAME);
      const request = store.get(recordKey);

      request.onsuccess = () => {
        resolve(request.result ? (request.result as ClientAnswerRecoveryRecord) : null);
      };

      request.onerror = () => reject(request.error || new Error('Failed to get record'));

      tx.oncomplete = () => {};
      tx.onerror = () => reject(tx.error || new Error('Transaction failed'));
      tx.onabort = () => reject(tx.error || new Error('Transaction aborted'));
    }).finally(() => {
        db.close();
    });
  }

  async listByScope(scope: ClientAnswerRecoveryScope): Promise<ClientAnswerRecoveryRecord[]> {
    const scopeKey = buildRecoveryScopeKey(scope);
    const db = await this._openDB();

    return new Promise<ClientAnswerRecoveryRecord[]>((resolve, reject) => {
      let tx: IDBTransaction;
      try {
        tx = db.transaction(STORE_NAME, 'readonly');
      } catch (err) {
        db.close();
        return reject(err);
      }

      const store = tx.objectStore(STORE_NAME);
      const index = store.index(INDEX_SCOPE);
      const request = index.getAll(IDBKeyRange.only(scopeKey));

      request.onsuccess = () => {
        const results = request.result as ClientAnswerRecoveryRecord[];
        const verifiedResults = results.filter(r => isRecoveryRecordForScope(r, scope));
        resolve(verifiedResults);
      };

      request.onerror = () => reject(request.error || new Error('Failed to list records by scope'));

      tx.oncomplete = () => {};
      tx.onerror = () => reject(tx.error || new Error('Transaction failed'));
      tx.onabort = () => reject(tx.error || new Error('Transaction aborted'));
    }).finally(() => {
        db.close();
    });
  }

  async delete(recordKey: string): Promise<void> {
    const db = await this._openDB();
    return new Promise<void>((resolve, reject) => {
      let tx: IDBTransaction;
      try {
        tx = db.transaction(STORE_NAME, 'readwrite');
      } catch (err) {
        db.close();
        return reject(err);
      }

      const store = tx.objectStore(STORE_NAME);
      const request = store.delete(recordKey);

      request.onsuccess = () => {};
      request.onerror = () => reject(request.error || new Error('Failed to delete record'));

      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error || new Error('Transaction failed'));
      tx.onabort = () => reject(tx.error || new Error('Transaction aborted'));
    }).finally(() => {
        db.close();
    });
  }

  async clearScope(scope: ClientAnswerRecoveryScope): Promise<void> {
    const records = await this.listByScope(scope);
    if (records.length === 0) {
      return;
    }

    const db = await this._openDB();
    return new Promise<void>((resolve, reject) => {
      let tx: IDBTransaction;
      try {
        tx = db.transaction(STORE_NAME, 'readwrite');
      } catch (err) {
        db.close();
        return reject(err);
      }

      const store = tx.objectStore(STORE_NAME);

      for (const record of records) {
        store.delete(record.recordKey);
      }

      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error || new Error('Transaction failed'));
      tx.onabort = () => reject(tx.error || new Error('Transaction aborted'));
    }).finally(() => {
       db.close();
    });
  }
}
