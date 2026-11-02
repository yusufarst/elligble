import { createHash, randomUUID } from 'node:crypto';
import type { ClientBase } from 'pg';
import { generateElligbleId, identifierKey, ID_COLLISION_LIMIT } from './elligble-id.ts';
import { createUnusableVerifier } from './provisioning.ts';

export interface IdentityScope { tenantId: string; personId: string }
export interface IdentityActor { kind: 'platform_operator' | 'authenticated_person'; ref: string }
/** Trusted owning-application adapters, never deserialized from HTTP or inferred from labels. */
export interface IdentityAuthority {
    authorize(client: ClientBase, scope: IdentityScope): Promise<IdentityActor | null>;
    audit(client: ClientBase, event: { scope: IdentityScope; actor: IdentityActor; operation: 'allocate' | 'reserve'; id: string }): Promise<void>;
}
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function validate(scope: IdentityScope): void {
    if (!UUID.test(scope.personId) || !UUID.test(scope.tenantId)) throw new Error('Invalid identity scope');
}
async function authorize(client: ClientBase, scope: IdentityScope, authority: IdentityAuthority): Promise<IdentityActor> {
    validate(scope);
    const actor = await authority.authorize(client, scope);
    if (!actor || !['platform_operator', 'authenticated_person'].includes(actor.kind) || !actor.ref.trim() || actor.ref.length > 200)
        throw new Error('Identity operation refused');
    return actor;
}
async function lockPerson(client: ClientBase, scope: IdentityScope): Promise<void> {
    const person = await client.query('SELECT id FROM identity_persons WHERE id = $1 FOR NO KEY UPDATE', [scope.personId]);
    if (person.rowCount !== 1) throw new Error('Identity operation refused');
}
async function requireReadCommitted(client: ClientBase): Promise<void> {
    const result = await client.query("SELECT current_setting('transaction_isolation') AS isolation");
    if (result.rows[0]?.isolation !== 'read committed') throw new Error('Identity requires READ COMMITTED');
}
export interface AllocatedIdentity { receiptId: string; userAccountId: string; personId: string; elligbleId: string; outcome: 'allocated' | 'existing'; replayed: boolean }

/** Caller must own an explicit transaction; SAVEPOINT refuses an autocommit invocation. */
export async function allocateStudentIdentity(
    client: ClientBase, scope: IdentityScope, requestKey: string, authority: IdentityAuthority,
): Promise<AllocatedIdentity> {
    if (!UUID.test(requestKey)) throw new Error('Invalid request key');
    validate(scope);
    scope = { personId: scope.personId.toLowerCase(), tenantId: scope.tenantId.toLowerCase() };
    requestKey = requestKey.toLowerCase();
    await client.query('SAVEPOINT identity_allocation');
    try {
        await requireReadCommitted(client);
        const actor = await authorize(client, scope, authority);
        await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [JSON.stringify(['identity_allocate', actor.kind, actor.ref, requestKey])]);
        const currentActor = await authorize(client, scope, authority);
        if (currentActor.kind !== actor.kind || currentActor.ref !== actor.ref) throw new Error('Identity operation refused');
        const digest = createHash('sha256').update(JSON.stringify([1, 'allocate', actor.kind, actor.ref, scope.tenantId, scope.personId])).digest('hex');
        const previous = await client.query(`SELECT e.*, r.original_username FROM identity_id_allocation_events e
            JOIN identity_login_identifiers r ON r.identifier_key = e.identifier_key
            WHERE e.actor_kind = $1 AND e.actor_ref = $2 AND e.operation = 'allocate' AND e.request_key = $3`,
            [actor.kind, actor.ref, requestKey]);
        if (previous.rowCount) {
            const p = previous.rows[0];
            if (p.request_digest !== digest) throw new Error('Identity request conflict');
            await client.query('RELEASE SAVEPOINT identity_allocation');
            return { receiptId: p.id, userAccountId: p.user_account_id, personId: p.person_id, elligbleId: p.original_username, outcome: p.outcome, replayed: true };
        }
        await lockPerson(client, scope);
        const lockedActor = await authorize(client, scope, authority);
        if (lockedActor.kind !== actor.kind || lockedActor.ref !== actor.ref) throw new Error('Identity operation refused');
        const open = await client.query(`SELECT id, tenant_id FROM identity_student_claim_reservations WHERE person_id = $1 AND closed_at IS NULL`, [scope.personId]);
        if (open.rows.some(r => r.tenant_id !== scope.tenantId)) throw new Error('Identity operation refused');
        await client.query(`UPDATE identity_student_claim_reservations SET closed_at = statement_timestamp(), closure_kind = 'allocated'
            WHERE person_id = $1 AND closed_at IS NULL`, [scope.personId]);
        const existing = await client.query(`SELECT b.canonical_account_id, c.username FROM identity_person_account_bindings b
            JOIN identity_account_credentials c ON c.user_account_id = b.canonical_account_id WHERE b.person_id = $1`, [scope.personId]);
        let accountId: string, username: string, outcome: 'allocated' | 'existing';
        if (existing.rowCount === 1) {
            accountId = existing.rows[0].canonical_account_id; username = existing.rows[0].username; outcome = 'existing';
        } else {
            if ((await client.query('SELECT id FROM identity_user_accounts WHERE person_id = $1', [scope.personId])).rowCount)
                throw new Error('Ambiguous existing identity');
            accountId = randomUUID();
            await client.query('INSERT INTO identity_user_accounts(id, person_id) VALUES($1,$2)', [accountId, scope.personId]);
            await client.query(`INSERT INTO identity_person_account_bindings(person_id, canonical_account_id, source) VALUES($1,$2,'allocation')`, [scope.personId, accountId]);
            let selected: string | undefined;
            for (let attempt = 0; attempt < ID_COLLISION_LIMIT; attempt++) {
                const candidate = generateElligbleId();
                await client.query('SAVEPOINT identity_candidate');
                try {
                    await client.query(`INSERT INTO identity_login_identifiers(identifier_key, original_username, user_account_id, person_id, origin)
                        VALUES($1,$1,$2,$3,'GENERATED')`, [candidate, accountId, scope.personId]);
                    await client.query('RELEASE SAVEPOINT identity_candidate'); selected = candidate; break;
                } catch (error) {
                    await client.query('ROLLBACK TO SAVEPOINT identity_candidate');
                    await client.query('RELEASE SAVEPOINT identity_candidate');
                    if ((error as { code?: string }).code !== '23505') throw error;
                }
            }
            if (!selected) throw new Error('Identity allocation collision limit');
            username = selected; outcome = 'allocated';
            await client.query(`INSERT INTO identity_account_credentials(user_account_id, username, password_verifier) VALUES($1,$2,$3)`,
                [accountId, username, createUnusableVerifier()]);
        }
        const receipt = await client.query(`INSERT INTO identity_id_allocation_events(operation, actor_kind, actor_ref, tenant_id, request_key,
            request_digest, person_id, user_account_id, identifier_key, outcome) VALUES('allocate',$1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id`,
            [actor.kind, actor.ref, scope.tenantId, requestKey, digest, scope.personId, accountId, identifierKey(username), outcome]);
        const receiptId: string = receipt.rows[0].id;
        await authority.audit(client, { scope, actor, operation: 'allocate', id: receiptId });
        await client.query('RELEASE SAVEPOINT identity_allocation');
        return { receiptId, userAccountId: accountId, personId: scope.personId, elligbleId: username, outcome, replayed: false };
    } catch (error) {
        await client.query('ROLLBACK TO SAVEPOINT identity_allocation').catch(() => {});
        await client.query('RELEASE SAVEPOINT identity_allocation').catch(() => {});
        throw error;
    }
}

/** Allocation reservation only; not a public claim, activation or recovery workflow. */
export async function reserveStudentIdentity(client: ClientBase, scope: IdentityScope, authority: IdentityAuthority): Promise<{ id: string; expiresAt: Date }> {
    validate(scope);
    scope = { personId: scope.personId.toLowerCase(), tenantId: scope.tenantId.toLowerCase() };
    await client.query('SAVEPOINT identity_reservation');
    try {
        await requireReadCommitted(client);
        const actor = await authorize(client, scope, authority);
        await lockPerson(client, scope);
        const lockedActor = await authorize(client, scope, authority);
        if (lockedActor.kind !== actor.kind || lockedActor.ref !== actor.ref) throw new Error('Identity operation refused');
        const open = await client.query(`SELECT id, tenant_id, expires_at, expires_at <= statement_timestamp() AS expired
            FROM identity_student_claim_reservations WHERE person_id = $1 AND closed_at IS NULL`, [scope.personId]);
        if (open.rowCount) {
            if (open.rows[0].tenant_id !== scope.tenantId || !open.rows[0].expired) throw new Error('Identity reservation conflict');
            await client.query(`UPDATE identity_student_claim_reservations SET closed_at = statement_timestamp(), closure_kind = 'expired' WHERE id = $1`, [open.rows[0].id]);
        }
        const result = await client.query(`INSERT INTO identity_student_claim_reservations(person_id, tenant_id, expires_at)
            VALUES($1,$2,statement_timestamp() + interval '7 days') RETURNING id, expires_at`, [scope.personId, scope.tenantId]);
        await authority.audit(client, { scope, actor, operation: 'reserve', id: result.rows[0].id });
        await client.query('RELEASE SAVEPOINT identity_reservation');
        return { id: result.rows[0].id, expiresAt: result.rows[0].expires_at };
    } catch (error) {
        await client.query('ROLLBACK TO SAVEPOINT identity_reservation').catch(() => {});
        await client.query('RELEASE SAVEPOINT identity_reservation').catch(() => {}); throw error;
    }
}
