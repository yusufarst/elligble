import test from 'node:test';
import assert from 'node:assert';
import { IdentityRuntime } from '../src/index.ts';
import { hashPassword } from '../src/crypto.ts';

class MockPgClient {
  queries: any[];
  mockResult: any;
  constructor(queries: any[], mockResult: any) {
    this.queries = queries;
    this.mockResult = mockResult;
  }
  async query(text: string, params?: any[]) {
    this.queries.push({ text, params });
    return this.mockResult;
  }
}

class MockClock {
  public currentTime = new Date('2026-09-18T00:00:00Z');
  now() {
    return this.currentTime;
  }
}

test('IdentityRuntime - authenticate success', async () => {
  const queries: any[] = [];
  const validHash = hashPassword('correctPassword');
  
  const mockResult = {
    rowCount: 1,
    rows: [{
      user_account_id: 'acc-1',
      person_id: 'person-1',
      password_verifier: validHash,
      is_valid: true,
      failed_attempts_count: 0,
      consecutive_failures_count: 0,
      locked_until: null,
      first_failed_attempt_at: null
    }]
  };
  
  const pg = new MockPgClient(queries, mockResult) as any;
  const clock = new MockClock();
  const runtime = new IdentityRuntime(pg, clock);
  
  const result = await runtime.authenticate('user1', 'correctPassword');
  
  assert.strictEqual(result.success, true);
  assert.strictEqual(result.userAccountId, 'acc-1');
  assert.strictEqual(result.personId, 'person-1');
  assert.strictEqual(queries.length, 2); // Select and Update
});

test('IdentityRuntime - authenticate invalid user', async () => {
  const queries: any[] = [];
  const pg = new MockPgClient(queries, { rowCount: 0, rows: [] }) as any;
  const runtime = new IdentityRuntime(pg);
  
  const result = await runtime.authenticate('unknown', 'pwd');
  assert.strictEqual(result.success, false);
  assert.strictEqual(result.error, 'INVALID_CREDENTIALS');
});

test('IdentityRuntime - authenticate revoked', async () => {
  const queries: any[] = [];
  const pg = new MockPgClient(queries, { rowCount: 1, rows: [{ is_valid: false }] }) as any;
  const runtime = new IdentityRuntime(pg);
  
  const result = await runtime.authenticate('user1', 'pwd');
  assert.strictEqual(result.success, false);
  assert.strictEqual(result.error, 'REVOKED');
});

test('IdentityRuntime - createSession', async () => {
  const queries: any[] = [];
  const pg = new MockPgClient(queries, { rowCount: 1, rows: [{ id: 'new-session-id' }] }) as any;
  const runtime = new IdentityRuntime(pg);
  
  const result = await runtime.createSession('acc-1');
  assert.strictEqual(result.sessionId, 'new-session-id');
  assert.ok(result.secret);
  assert.strictEqual(queries.length, 2);
});
