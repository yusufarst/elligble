import test from 'node:test';
import assert from 'node:assert';
import { TenantAccessRuntime } from '../src/index.ts';

class MockIdentityRuntime {
  public mockSession: any = null;

  async resolveSession(sessionId: string, secretAttempt: string) {
    if (this.mockSession && 
        this.mockSession.sessionId === sessionId && 
        this.mockSession.secretAttempt === secretAttempt) {
      return this.mockSession.result;
    }
    return null;
  }
}

class MockPgClient {
  public mockRows: any[] = [];
  public queries: { text: string, params: any[] }[] = [];
  
  async query(text: string, params: any[] = []) {
    this.queries.push({ text, params });
    // Handle the specific membership query
    if (text.includes('FROM tenant_memberships m')) {
      const requestedTenantId = params[0];
      const personId = params[1];
      
      const matched = this.mockRows.filter(r => r.tenant_id === requestedTenantId && r.person_id === personId);
      return {
        rowCount: matched.length,
        rows: matched
      };
    }
    return { rowCount: 0, rows: [] };
  }
}

function setup() {
  const pg = new MockPgClient();
  const identity = new MockIdentityRuntime();
  const runtime = new TenantAccessRuntime(pg as any, identity as any);
  return { pg, identity, runtime };
}

test('TenantAccessRuntime - valid authenticated session + matching membership => PASS', async () => {
  const { pg, identity, runtime } = setup();
  const sessionId = '00000000-0000-0000-0000-000000000001';
  const secret = 'valid-secret';
  const tenantId = '10000000-0000-0000-0000-000000000001';
  const personId = '20000000-0000-0000-0000-000000000001';
  const membershipId = '30000000-0000-0000-0000-000000000001';

  identity.mockSession = {
    sessionId,
    secretAttempt: secret,
    result: { personId, sessionId, userAccountId: 'account1' }
  };

  pg.mockRows = [
    { id: membershipId, tenant_id: tenantId, person_id: personId }
  ];

  const result = await runtime.resolveAuthenticatedMembershipContext(sessionId, secret, tenantId);
  assert.ok(result);
  assert.strictEqual(result?.tenantId, tenantId);
  assert.strictEqual(result?.membershipId, membershipId);
  assert.strictEqual(result?.personId, personId);

  // Check returned context does not expose password/session secret
  const keys = Object.keys(result!).sort();
  assert.deepStrictEqual(keys, ['membershipId', 'personId', 'tenantId']);
});

test('TenantAccessRuntime - matching Person in Tenant A cannot resolve Tenant B membership', async () => {
  const { pg, identity, runtime } = setup();
  const sessionId = '00000000-0000-0000-0000-000000000001';
  const secret = 'valid-secret';
  const tenantA = '10000000-0000-0000-0000-000000000001';
  const tenantB = '10000000-0000-0000-0000-000000000002';
  const personId = '20000000-0000-0000-0000-000000000001';

  identity.mockSession = {
    sessionId,
    secretAttempt: secret,
    result: { personId, sessionId, userAccountId: 'account1' }
  };

  // Person has membership in Tenant A
  pg.mockRows = [
    { id: 'mem1', tenant_id: tenantA, person_id: personId }
  ];

  // Requesting Tenant B context
  const result = await runtime.resolveAuthenticatedMembershipContext(sessionId, secret, tenantB);
  assert.strictEqual(result, null);
});

test('TenantAccessRuntime - other Person\'s membership cannot resolve', async () => {
  const { pg, identity, runtime } = setup();
  const sessionId = '00000000-0000-0000-0000-000000000001';
  const secret = 'valid-secret';
  const tenantId = '10000000-0000-0000-0000-000000000001';
  const myPersonId = '20000000-0000-0000-0000-000000000001';
  const otherPersonId = '20000000-0000-0000-0000-000000000002';

  identity.mockSession = {
    sessionId,
    secretAttempt: secret,
    result: { personId: myPersonId, sessionId, userAccountId: 'account1' }
  };

  // Tenant has membership, but for other person
  pg.mockRows = [
    { id: 'mem2', tenant_id: tenantId, person_id: otherPersonId }
  ];

  const result = await runtime.resolveAuthenticatedMembershipContext(sessionId, secret, tenantId);
  assert.strictEqual(result, null);
});

test('TenantAccessRuntime - no membership => deny', async () => {
  const { pg, identity, runtime } = setup();
  const sessionId = '00000000-0000-0000-0000-000000000001';
  const secret = 'valid-secret';
  const tenantId = '10000000-0000-0000-0000-000000000001';

  identity.mockSession = {
    sessionId,
    secretAttempt: secret,
    result: { personId: '20000000-0000-0000-0000-000000000001' }
  };

  pg.mockRows = []; // No memberships at all

  const result = await runtime.resolveAuthenticatedMembershipContext(sessionId, secret, tenantId);
  assert.strictEqual(result, null);
});

test('TenantAccessRuntime - unknown tenant => deny', async () => {
  const { pg, identity, runtime } = setup();
  const sessionId = '00000000-0000-0000-0000-000000000001';
  const secret = 'valid-secret';
  const unknownTenantId = '10000000-0000-0000-0000-000000000999';

  identity.mockSession = {
    sessionId,
    secretAttempt: secret,
    result: { personId: '20000000-0000-0000-0000-000000000001' }
  };
  pg.mockRows = []; 
  const result = await runtime.resolveAuthenticatedMembershipContext(sessionId, secret, unknownTenantId);
  assert.strictEqual(result, null);
});

test('TenantAccessRuntime - duplicate/ambiguous membership rows => deny', async () => {
  const { pg, identity, runtime } = setup();
  const sessionId = '00000000-0000-0000-0000-000000000001';
  const secret = 'valid-secret';
  const tenantId = '10000000-0000-0000-0000-000000000001';
  const personId = '20000000-0000-0000-0000-000000000001';

  identity.mockSession = {
    sessionId,
    secretAttempt: secret,
    result: { personId, sessionId }
  };

  pg.mockRows = [
    { id: 'mem1', tenant_id: tenantId, person_id: personId },
    { id: 'mem2', tenant_id: tenantId, person_id: personId }
  ];

  const result = await runtime.resolveAuthenticatedMembershipContext(sessionId, secret, tenantId);
  assert.strictEqual(result, null);
});

test('TenantAccessRuntime - invalid/revoked/expired/idle-expired BU-088 session => deny', async () => {
  const { identity, runtime } = setup();
  const sessionId = '00000000-0000-0000-0000-000000000001';
  const secret = 'valid-secret';
  const tenantId = '10000000-0000-0000-0000-000000000001';

  identity.mockSession = null; // resolveSession returns null (meaning revoked, expired, idle-expired, or wrong secret)

  const result = await runtime.resolveAuthenticatedMembershipContext(sessionId, secret, tenantId);
  assert.strictEqual(result, null);
});

test('TenantAccessRuntime - wrong session secret => deny', async () => {
  const { identity, runtime } = setup();
  const sessionId = '00000000-0000-0000-0000-000000000001';
  const secret = 'valid-secret';
  const tenantId = '10000000-0000-0000-0000-000000000001';

  identity.mockSession = {
    sessionId,
    secretAttempt: secret, // expects 'valid-secret'
    result: { personId: '20000000-0000-0000-0000-000000000001' }
  };

  const result = await runtime.resolveAuthenticatedMembershipContext(sessionId, 'wrong-secret', tenantId);
  assert.strictEqual(result, null);
});

test('TenantAccessRuntime - malformed tenant/session ID => fail closed', async () => {
  const { identity, pg, runtime } = setup();
  const validSessionId = '00000000-0000-0000-0000-000000000001';
  const validSecret = 'valid-secret';
  const validTenantId = '10000000-0000-0000-0000-000000000001';
  
  identity.mockSession = {
    sessionId: validSessionId,
    secretAttempt: validSecret,
    result: { personId: '20000000-0000-0000-0000-000000000001' }
  };
  pg.mockRows = [
    { id: 'mem1', tenant_id: validTenantId, person_id: '20000000-0000-0000-0000-000000000001' }
  ];

  // Malformed session ID
  assert.strictEqual(await runtime.resolveAuthenticatedMembershipContext('not-uuid', validSecret, validTenantId), null);
  // Malformed tenant ID
  assert.strictEqual(await runtime.resolveAuthenticatedMembershipContext(validSessionId, validSecret, 'not-uuid'), null);
  
  // Empty inputs
  assert.strictEqual(await runtime.resolveAuthenticatedMembershipContext('', validSecret, validTenantId), null);
  assert.strictEqual(await runtime.resolveAuthenticatedMembershipContext(validSessionId, '', validTenantId), null);
  assert.strictEqual(await runtime.resolveAuthenticatedMembershipContext(validSessionId, validSecret, ''), null);
  
  // Ensure no queries were executed for malformed inputs
  assert.strictEqual(pg.queries.length, 0);
});

test('TenantAccessRuntime - requested tenantId does not become trusted simply because caller provided it', async () => {
  const { identity, pg, runtime } = setup();
  const sessionId = '00000000-0000-0000-0000-000000000001';
  const secret = 'valid-secret';
  const requestedTenantId = '10000000-0000-0000-0000-000000000999'; // Provided by caller

  identity.mockSession = {
    sessionId,
    secretAttempt: secret,
    result: { personId: '20000000-0000-0000-0000-000000000001' }
  };
  // But no DB mapping exists for this user in this tenant
  pg.mockRows = [];

  const result = await runtime.resolveAuthenticatedMembershipContext(sessionId, secret, requestedTenantId);
  assert.strictEqual(result, null); // Denied because untrusted requestedTenantId must be validated against DB membership
});

test('TenantAccessRuntime - read-only / no mutation (no non-SELECT queries executed)', async () => {
  const { pg, identity, runtime } = setup();
  const sessionId = '00000000-0000-0000-0000-000000000001';
  const secret = 'valid-secret';
  const tenantId = '10000000-0000-0000-0000-000000000001';
  const personId = '20000000-0000-0000-0000-000000000001';

  identity.mockSession = {
    sessionId,
    secretAttempt: secret,
    result: { personId, sessionId }
  };

  pg.mockRows = [
    { id: 'mem1', tenant_id: tenantId, person_id: personId }
  ];

  await runtime.resolveAuthenticatedMembershipContext(sessionId, secret, tenantId);
  
  // Verify all queries executed were purely SELECTs
  for (const q of pg.queries) {
    assert.ok(q.text.trim().toUpperCase().startsWith('SELECT'), 'Only SELECT queries allowed');
  }
});
