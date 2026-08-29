import test from 'node:test';
import assert from 'node:assert';

import { IndexedDBClientAnswerRecoveryStore } from '../src/indexeddb-recovery-store.js';
import {
  createRecoveryRecord,
  buildRecoveryScopeKey
} from '../src/client-answer-recovery-store.js';
import type { ClientAnswerRecoveryScope, ClientAnswerRecoveryRecord } from '../src/client-answer-recovery-store.js';

// Minimal in-memory mock for IDBFactory to pass deterministic tests without dependencies
class MockIDBRequest {
  result: any;
  error: Error | null = null;
  onsuccess: ((event: any) => void) | null = null;
  onerror: ((event: any) => void) | null = null;
  onupgradeneeded: ((event: any) => void) | null = null;

  fireSuccess(result?: any) {
    if (result !== undefined) this.result = result;
    if (this.onsuccess) this.onsuccess({ target: this });
  }

  fireError(error: Error) {
    this.error = error;
    if (this.onerror) this.onerror({ target: this });
  }
}

class MockIDBIndex {
  private records: Map<string, any>;
  private indexKey: string;
  constructor(records: Map<string, any>, indexKey: string) {
    this.records = records;
    this.indexKey = indexKey;
  }

  getAll(query?: any): any {
    const request = new MockIDBRequest();
    setTimeout(() => {
      const scopeKey = query;
      const results: any[] = [];
      for (const record of this.records.values()) {
        if (record[this.indexKey] === scopeKey) {
          results.push(JSON.parse(JSON.stringify(record)));
        }
      }
      request.fireSuccess(results);
    }, 0);
    return request;
  }
}

class MockIDBObjectStore {
  indices = new Map<string, MockIDBIndex>();
  private name: string;
  private records: Map<string, any>;

  constructor(name: string, records: Map<string, any>) {
    this.name = name;
    this.records = records;
  }

  createIndex(name: string, keyPath: string, options?: any) {
    this.indices.set(name, new MockIDBIndex(this.records, keyPath));
  }

  index(name: string): any {
    if (!this.indices.has(name)) {
      // Lazy creation just for tests if upgrade not simulated fully
      this.indices.set(name, new MockIDBIndex(this.records, 'scopeKey'));
    }
    return this.indices.get(name)!;
  }

  put(item: any): any {
    const request = new MockIDBRequest();
    setTimeout(() => {
      this.records.set(item.recordKey, JSON.parse(JSON.stringify(item)));
      request.fireSuccess();
    }, 0);
    return request;
  }

  get(key: string): any {
    const request = new MockIDBRequest();
    setTimeout(() => {
      const val = this.records.get(key);
      request.fireSuccess(val ? JSON.parse(JSON.stringify(val)) : undefined);
    }, 0);
    return request;
  }

  delete(key: string): any {
    const request = new MockIDBRequest();
    setTimeout(() => {
      this.records.delete(key);
      request.fireSuccess();
    }, 0);
    return request;
  }
}

class MockIDBTransaction {
  oncomplete: ((event: any) => void) | null = null;
  onerror: ((event: any) => void) | null = null;
  onabort: ((event: any) => void) | null = null;
  error: Error | null = null;
  private db: MockIDBDatabase;
  private storeName: string;

  constructor(db: MockIDBDatabase, storeName: string) {
    this.db = db;
    this.storeName = storeName;
    // Auto-complete tx in next tick
    setTimeout(() => {
      if (!this.error && this.oncomplete) {
        this.oncomplete({ target: this });
      }
    }, 5);
  }

  objectStore(name: string): any {
    if (name !== this.storeName) throw new Error('Store not found');
    return new MockIDBObjectStore(name, this.db.records);
  }
}

class MockIDBDatabase {
  objectStoreNames = { contains: () => true };
  records = new Map<string, any>();

  createObjectStore(name: string, options: any): any {
    return new MockIDBObjectStore(name, this.records);
  }

  transaction(storeName: string, mode: string): any {
    return new MockIDBTransaction(this, storeName);
  }

  close() {}
}

class MockIDBFactory {
  databasesMap = new Map<string, MockIDBDatabase>();

  open(name: string, version?: number): any {
    const request = new MockIDBRequest();
    setTimeout(() => {
      if (!this.databasesMap.has(name)) {
        this.databasesMap.set(name, new MockIDBDatabase());
        if (request.onupgradeneeded) {
          request.result = this.databasesMap.get(name);
          request.onupgradeneeded({ target: request });
        }
      }
      request.fireSuccess(this.databasesMap.get(name));
    }, 0);
    return request;
  }
}

// Ensure global type IDBKeyRange exists for mocking
if (typeof globalThis.IDBKeyRange === 'undefined') {
  (globalThis as any).IDBKeyRange = {
    only: (val: any) => val
  };
}

test('IndexedDBClientAnswerRecoveryStore tests', async (t) => {
  const createTestMutation = (id: string) => ({
    identity: {
      tenantId: 'tenant-1',
      participantId: 'participant-1',
      examInstanceId: 'exam-1',
      attemptId: 'attempt-1',
      snapshotId: 'snapshot-1',
    },
    localSequence: 1,
    clientWriteIdentity: id,
    expectedWriteVersion: 1,
    answerPayload: `{"answer": "${id}"}`,
    syncState: 'pending' as const,
    acceptedWriteVersion: 0,
  });

  const scope: ClientAnswerRecoveryScope = {
    tenantId: 'tenant-1',
    participantId: 'participant-1',
    examInstanceId: 'exam-1',
    attemptId: 'attempt-1'
  };

  const otherScope: ClientAnswerRecoveryScope = {
    tenantId: 'tenant-2',
    participantId: 'participant-2',
    examInstanceId: 'exam-2',
    attemptId: 'attempt-2'
  };

  let idbFactory: any;

  t.beforeEach(() => {
    idbFactory = new MockIDBFactory();
  });

  await t.test('1. missing IndexedDB factory failure', () => {
    assert.throws(
      () => new IndexedDBClientAnswerRecoveryStore({ idbFactory: undefined as any }),
      /IndexedDB factory not available/
    );
  });

  await t.test('2. put/get roundtrip and payload/sync-state preservation', async () => {
    const store = new IndexedDBClientAnswerRecoveryStore({ idbFactory });
    const mutation = createTestMutation('uuid-1');
    const record = createRecoveryRecord(mutation);

    await store.put(record);

    const retrieved = await store.get(record.recordKey);
    assert.ok(retrieved, 'Should retrieve the record');
    assert.deepStrictEqual(retrieved, record, 'Retrieved record should match original exactly');
  });

  await t.test('3. overwrite same recordKey preserves isolation', async () => {
    const store = new IndexedDBClientAnswerRecoveryStore({ idbFactory });
    const mutation = createTestMutation('uuid-2');
    const record1 = createRecoveryRecord(mutation);
    await store.put(record1);

    const record2 = createRecoveryRecord({
      ...mutation,
      syncState: 'acknowledged',
      acceptedWriteVersion: 2,
    });
    assert.strictEqual(record1.recordKey, record2.recordKey);

    await store.put(record2);

    const retrieved = await store.get(record1.recordKey);
    assert.ok(retrieved);
    assert.strictEqual(retrieved.mutation.syncState, 'acknowledged');
    assert.strictEqual(retrieved.mutation.acceptedWriteVersion, 2);
  });

  await t.test('4. scope-isolated list', async () => {
    const store = new IndexedDBClientAnswerRecoveryStore({ idbFactory });

    const record1 = createRecoveryRecord(createTestMutation('scope-1-id-1'));
    const record2 = createRecoveryRecord({ ...createTestMutation('scope-1-id-2'), localSequence: 2 });

    const otherMutation = {
      ...createTestMutation('scope-2-id-1'),
      identity: {
        ...createTestMutation('scope-2-id-1').identity,
        tenantId: 'tenant-2',
        participantId: 'participant-2',
        examInstanceId: 'exam-2',
        attemptId: 'attempt-2'
      }
    };
    const otherRecord = createRecoveryRecord(otherMutation);

    await store.put(record1);
    await store.put(record2);
    await store.put(otherRecord);

    const results = await store.listByScope(scope);
    assert.strictEqual(results.length, 2);

    const keys = results.map(r => r.recordKey);
    assert.ok(keys.includes(record1.recordKey));
    assert.ok(keys.includes(record2.recordKey));
    assert.ok(!keys.includes(otherRecord.recordKey));
  });

  await t.test('5. delete record', async () => {
    const store = new IndexedDBClientAnswerRecoveryStore({ idbFactory });
    const record = createRecoveryRecord(createTestMutation('delete-me'));
    await store.put(record);

    let retrieved = await store.get(record.recordKey);
    assert.ok(retrieved);

    await store.delete(record.recordKey);

    retrieved = await store.get(record.recordKey);
    assert.strictEqual(retrieved, null);
  });

  await t.test('6. clearScope isolation', async () => {
    const store = new IndexedDBClientAnswerRecoveryStore({ idbFactory });

    const record1 = createRecoveryRecord(createTestMutation('scope-1-id-1'));

    const otherMutation = {
      ...createTestMutation('scope-2-id-1'),
      identity: {
        ...createTestMutation('scope-2-id-1').identity,
        ...otherScope
      }
    };
    const otherRecord = createRecoveryRecord(otherMutation);

    await store.put(record1);
    await store.put(otherRecord);

    await store.clearScope(scope);

    const scopeResults = await store.listByScope(scope);
    assert.strictEqual(scopeResults.length, 0, 'Scope 1 should be empty');

    const otherScopeResults = await store.listByScope(otherScope);
    assert.strictEqual(otherScopeResults.length, 1, 'Scope 2 should be untouched');
  });

  await t.test('7. no caller mutation', async () => {
    const store = new IndexedDBClientAnswerRecoveryStore({ idbFactory });
    const mutation = createTestMutation('uuid-no-mutate');
    const record = createRecoveryRecord(mutation);

    await store.put(record);

    // Attempt to mutate original object locally
    (record.mutation as any).syncState = 'in_flight';

    const retrieved = await store.get(record.recordKey);
    assert.ok(retrieved);
    assert.strictEqual(retrieved.mutation.syncState, 'pending', 'Store should not reflect caller mutation of passed-in record');
  });

  await t.test('8. IndexedDB failure propagation on open', async () => {
    const brokenFactory = {
      open: () => { throw new Error('Simulated factory failure'); }
    } as unknown as IDBFactory;

    const store = new IndexedDBClientAnswerRecoveryStore({ idbFactory: brokenFactory });

    const record = createRecoveryRecord(createTestMutation('fail'));

    await assert.rejects(
      store.put(record),
      /Simulated factory failure/
    );

    await assert.rejects(
      store.get(record.recordKey),
      /Simulated factory failure/
    );

    await assert.rejects(
      store.listByScope(scope),
      /Simulated factory failure/
    );

    await assert.rejects(
      store.delete(record.recordKey),
      /Simulated factory failure/
    );

    await assert.rejects(
      store.clearScope(scope),
      /Simulated factory failure/
    );
  });
});
