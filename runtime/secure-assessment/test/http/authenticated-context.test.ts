import { test } from 'node:test';
import * as assert from 'node:assert/strict';
import { buildAuthenticatedContext, AuthenticationError } from '../../src/http/authenticated-context.ts';
import { generateSessionSecret } from '../../../identity-access/src/crypto.ts';

const SESSION_ID = '11111111-2222-4333-8444-555555555555';
const TENANT_ID = '22222222-3333-4444-8555-666666666666';
const OTHER_TENANT_ID = '33333333-4444-4555-8666-777777777777';
const PERSON_ID = '44444444-5555-4666-8777-888888888888';
const ACCOUNT_ID = '55555555-6666-4777-8888-999999999999';
const MEMBERSHIP_ID = '66666666-7777-4888-8999-aaaaaaaaaaaa';

type Mode = {
  membership?: boolean;
  membershipTenant?: string;
  connectFailure?: boolean;
  queryFailure?: boolean;
};

function makeReq(
  authorization?: string,
  tenantId?: string,
  extra: Record<string, string> = {}
): any {
  return {
    headers: {
      ...(authorization ? { authorization } : {}),
      ...(tenantId ? { 'x-tenant-id': tenantId } : {}),
      ...extra,
    },
  };
}

function makeHarness(secretVerifier: string, mode: Mode = {}) {
  let released = 0;
  let identityUpdates = 0;

  const now = Date.now();

  const client = {
    async query(sql: string, params?: unknown[]) {
      const normalized = sql.replace(/\s+/g, ' ').trim();

      if (mode.queryFailure) {
        throw new Error('sensitive database detail must never leak');
      }

      if (
        normalized.includes('FROM identity_sessions s') &&
        normalized.includes('JOIN identity_user_accounts')
      ) {
        return {
          rowCount: 1,
          rows: [{
            id: SESSION_ID,
            user_account_id: ACCOUNT_ID,
            session_secret_verifier: secretVerifier,
            is_revoked: false,
            authenticated_at: new Date(now - 5 * 60 * 1000),
            expires_at: new Date(now + 6 * 60 * 60 * 1000),
            last_activity_at: new Date(now - 5 * 60 * 1000),
            person_id: PERSON_ID,
          }],
        };
      }

      if (
        normalized.includes('UPDATE identity_sessions SET last_activity_at')
      ) {
        identityUpdates++;
        return { rowCount: 1, rows: [] };
      }

      if (normalized.includes('FROM tenant_memberships m')) {
        const requestedTenant = String(params?.[0] ?? '');

        const hasMembership =
          mode.membership !== false &&
          requestedTenant === (mode.membershipTenant ?? TENANT_ID);

        if (!hasMembership) {
          return { rowCount: 0, rows: [] };
        }

        return {
          rowCount: 1,
          rows: [{
            id: MEMBERSHIP_ID,
            tenant_id: requestedTenant,
            person_id: PERSON_ID,
          }],
        };
      }

      throw new Error(`Unexpected SQL in focused fixture: ${normalized}`);
    },

    release() {
      released++;
    },
  };

  const pool = {
    async connect() {
      if (mode.connectFailure) {
        throw new Error('database unavailable sensitive detail');
      }
      return client;
    },
  } as any;

  return {
    pool,
    released: () => released,
    identityUpdates: () => identityUpdates,
  };
}

async function expectAuthError(
  fn: () => Promise<unknown>,
  status: number
) {
  await assert.rejects(
    fn,
    (err: unknown) => {
      assert.ok(err instanceof AuthenticationError);
      assert.equal(err.statusCode, status);
      return true;
    },
  );
}

test('authenticated context focused contract', async (t) => {
  const generated = generateSessionSecret();
  const secret = generated.secret;
  const verifier = generated.verifier;

  await t.test('1. valid authenticated Membership Context', async () => {
    const h = makeHarness(verifier);

    const ctx = await buildAuthenticatedContext(
      makeReq(
        `ELLIGBLE-Session ${SESSION_ID}.${secret}`,
        TENANT_ID,
      ),
      h.pool,
    );

    assert.deepEqual(ctx, {
      tenantId: TENANT_ID,
      membershipId: MEMBERSHIP_ID,
      personId: PERSON_ID,
    });

    assert.equal(h.released(), 1);
    assert.ok(h.identityUpdates() >= 1);
  });

  await t.test('2. missing credential -> 401', async () => {
    const h = makeHarness(verifier);

    await expectAuthError(
      () => buildAuthenticatedContext(
        makeReq(undefined, TENANT_ID),
        h.pool,
      ),
      401,
    );
  });

  await t.test('3. malformed credential -> 401', async () => {
    const h = makeHarness(verifier);

    await expectAuthError(
      () => buildAuthenticatedContext(
        makeReq(`ELLIGBLE-Session ${SESSION_ID}`, TENANT_ID),
        h.pool,
      ),
      401,
    );
  });

  await t.test('4. wrong secret -> 401', async () => {
    const h = makeHarness(verifier);

    await expectAuthError(
      () => buildAuthenticatedContext(
        makeReq(
          `ELLIGBLE-Session ${SESSION_ID}.definitely-wrong-secret`,
          TENANT_ID,
        ),
        h.pool,
      ),
      401,
    );

    assert.equal(h.released(), 1);
  });

  await t.test('5. missing tenant -> 403', async () => {
    const h = makeHarness(verifier);

    await expectAuthError(
      () => buildAuthenticatedContext(
        makeReq(`ELLIGBLE-Session ${SESSION_ID}.${secret}`),
        h.pool,
      ),
      403,
    );
  });

  await t.test('6. malformed tenant -> 403', async () => {
    const h = makeHarness(verifier);

    await expectAuthError(
      () => buildAuthenticatedContext(
        makeReq(
          `ELLIGBLE-Session ${SESSION_ID}.${secret}`,
          'not-a-uuid',
        ),
        h.pool,
      ),
      403,
    );
  });

  await t.test('7. valid session without Membership -> 403', async () => {
    const h = makeHarness(verifier, { membership: false });

    await expectAuthError(
      () => buildAuthenticatedContext(
        makeReq(
          `ELLIGBLE-Session ${SESSION_ID}.${secret}`,
          TENANT_ID,
        ),
        h.pool,
      ),
      403,
    );

    assert.equal(h.released(), 1);
  });

  await t.test('8. cross-tenant Membership -> 403', async () => {
    const h = makeHarness(verifier, {
      membershipTenant: TENANT_ID,
    });

    await expectAuthError(
      () => buildAuthenticatedContext(
        makeReq(
          `ELLIGBLE-Session ${SESSION_ID}.${secret}`,
          OTHER_TENANT_ID,
        ),
        h.pool,
      ),
      403,
    );

    assert.equal(h.released(), 1);
  });

  await t.test('9. pool.connect failure -> 503', async () => {
    const h = makeHarness(verifier, {
      connectFailure: true,
    });

    await expectAuthError(
      () => buildAuthenticatedContext(
        makeReq(
          `ELLIGBLE-Session ${SESSION_ID}.${secret}`,
          TENANT_ID,
        ),
        h.pool,
      ),
      503,
    );
  });

  await t.test('10. unexpected persistence failure -> bounded 500', async () => {
    const h = makeHarness(verifier, {
      queryFailure: true,
    });

    let caught: unknown;

    try {
      await buildAuthenticatedContext(
        makeReq(
          `ELLIGBLE-Session ${SESSION_ID}.${secret}`,
          TENANT_ID,
        ),
        h.pool,
      );
    } catch (err) {
      caught = err;
    }

    assert.ok(caught instanceof AuthenticationError);
    assert.equal(caught.statusCode, 500);
    assert.equal(caught.message, 'internal_error');
    assert.equal(h.released(), 1);
  });

  await t.test('11. client release occurs on success', async () => {
    const h = makeHarness(verifier);

    await buildAuthenticatedContext(
      makeReq(
        `ELLIGBLE-Session ${SESSION_ID}.${secret}`,
        TENANT_ID,
      ),
      h.pool,
    );

    assert.equal(h.released(), 1);
  });

  await t.test('12. client release occurs on runtime failure', async () => {
    const h = makeHarness(verifier, {
      queryFailure: true,
    });

    await expectAuthError(
      () => buildAuthenticatedContext(
        makeReq(
          `ELLIGBLE-Session ${SESSION_ID}.${secret}`,
          TENANT_ID,
        ),
        h.pool,
      ),
      500,
    );

    assert.equal(h.released(), 1);
  });

  await t.test('13. raw session secret/internal detail is not disclosed', async () => {
    const h = makeHarness(verifier);

    let caught: unknown;

    try {
      await buildAuthenticatedContext(
        makeReq(
          `ELLIGBLE-Session ${SESSION_ID}.wrong-secret-${secret}`,
          TENANT_ID,
          { 'x-person-id': 'attacker-controlled-person' },
        ),
        h.pool,
      );
    } catch (err) {
      caught = err;
    }

    assert.ok(caught instanceof AuthenticationError);

    const exposed = String(caught.message);

    assert.equal(exposed.includes(secret), false);
    assert.equal(exposed.includes('session_secret_verifier'), false);
    assert.equal(exposed.includes('database'), false);
  });
});
