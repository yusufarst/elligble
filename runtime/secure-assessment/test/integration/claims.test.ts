import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import type pg from 'pg';
import { createDisposableDatabase, skipWithoutDatabase } from '../support/pg-harness.ts';
import { addMembership, addProctorAssignment, createExamInstance, createPersonWithAccount, createTeachingContext, createTenant } from '../support/fixtures.ts';
import { BrowserLikeClient, startProductionWiredServer } from '../support/test-server.ts';
import { setSchoolOperator } from '../../../tenant-access/src/school-operator.ts';
import { IdentityRuntime } from '../../../identity-access/src/index.ts';
import { resolveClaimActivationRoute } from '../../../identity-access/src/claims.ts';
import { activateClaimBound, submitClaim } from '../../src/claims.ts';

// AUTH-002 real PostgreSQL oracles (record §9 C01–C12). Every scenario uses synthetic data,
// the production-wired server and the existing CLI boundary; contention uses real locks
// observed through pg_blocking_pids, never sleeps or retries.

const CLI = new URL('../../src/ops/provision-cli.ts', import.meta.url).pathname;
const PASSWORD = 'MatahariPagiSintetis2026!';
const TRUSTED = ['identity_persons', 'identity_user_accounts', 'identity_account_credentials', 'identity_person_account_bindings',
    'identity_login_identifiers', 'identity_account_activations', 'tenant_memberships', 'academic_core_student_enrollments',
    'academic_core_student_roster_records', 'academic_core_roster_identity_bindings', 'identity_student_claim_activations'];

async function snapshot(pool: pg.Pool, tables: readonly string[] = TRUSTED) {
    const result: Record<string, unknown> = {};
    for (const table of tables) result[table] = (await pool.query(`SELECT to_jsonb(t) AS row FROM ${table} t ORDER BY to_jsonb(t)::text`)).rows;
    return result;
}

interface School { tenant: string; group: string; year: string; period: string; staff: Awaited<ReturnType<typeof createPersonWithAccount>>; staffMembership: string }

async function school(pool: pg.Pool): Promise<School> {
    const tenant = await createTenant(pool), staff = await createPersonWithAccount(pool), staffMembership = await addMembership(pool, tenant, staff.personId);
    const teaching = await createTeachingContext(pool, tenant, staffMembership);
    const year = (await pool.query('SELECT academic_year_id FROM academic_core_academic_groups WHERE id=$1', [teaching.academicGroupId])).rows[0].academic_year_id as string;
    const period = (await pool.query(`SELECT o.academic_period_id FROM academic_core_subject_offerings o
        JOIN academic_core_teaching_assignments a ON a.subject_offering_id=o.id WHERE a.id=$1`, [teaching.teachingAssignmentId])).rows[0].academic_period_id as string;
    return { tenant, group: teaching.academicGroupId, year, period, staff, staffMembership };
}

async function otherGroup(pool: pg.Pool, s: School): Promise<string> {
    const grade = (await pool.query('SELECT grade_level_id FROM academic_core_academic_groups WHERE id=$1', [s.group])).rows[0].grade_level_id;
    return (await pool.query(`INSERT INTO academic_core_academic_groups (tenant_id, academic_year_id, grade_level_id, display_label)
        VALUES ($1,$2,$3,$4) RETURNING id`, [s.tenant, s.year, grade, `X-${randomUUID().slice(0, 4)}`])).rows[0].id as string;
}

let rosterSeq = 0;
async function roster(pool: pg.Pool, s: School, name: string, nisn: string, birth: string, group = s.group): Promise<string> {
    rosterSeq++;
    return (await pool.query(`INSERT INTO academic_core_student_roster_records(tenant_id, source_student_key, full_name, nis, nisn, date_of_birth,
            academic_year_id, academic_period_id, academic_group_id) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id`,
        [s.tenant, `claim-src-${rosterSeq}-${randomUUID().slice(0, 6)}`, name, `nis-${rosterSeq}-${randomUUID().slice(0, 6)}`, nisn, birth, s.year, s.period, group])).rows[0].id as string;
}

async function operator(pool: pg.Pool, s: School, personId: string, action: 'ASSIGN' | 'REVOKE' = 'ASSIGN') {
    const c = await pool.connect();
    try {
        await c.query('BEGIN');
        await setSchoolOperator(c, { tenantId: s.tenant, personId, action, operator: 'Synthetic platform operator', caseReference: 'AUTH-002', reason: 'Synthetic verifier' });
        await c.query('COMMIT');
    } catch (e) { await c.query('ROLLBACK'); throw e; } finally { c.release(); }
}

function homeroomCli(dbUrl: string, s: School, username: string, group: string, action: 'assign' | 'revoke' = 'assign') {
    return JSON.parse(execFileSync(process.execPath, [CLI, 'homeroom', action, '--tenant', s.tenant, '--elligble-id', username, '--group', group,
        '--period', s.period, '--operator', 'Synthetic platform operator', '--case', 'AUTH-002 synthetic', '--reason', 'Synthetic Homeroom'],
    { env: { ...process.env, DATABASE_URL: dbUrl }, stdio: 'pipe' }).toString());
}

async function signIn(baseUrl: string, s: School, account: { username: string; password: string }) {
    const c = new BrowserLikeClient(baseUrl);
    assert.equal((await c.login(account.username, account.password)).status, 200);
    c.tenantId = s.tenant;
    return c;
}

const submit = (c: BrowserLikeClient, body: Record<string, unknown>) => c.request('/api/v1/identity/claims', { method: 'POST', body });
const review = (c: BrowserLikeClient) => c.request('/api/v1/identity/claims/review');
const decide = (c: BrowserLikeClient, body: Record<string, unknown>) => c.request('/api/v1/identity/claims/decision', { method: 'POST', body });
const activate = (c: BrowserLikeClient, username: string, code: string, newPassword = PASSWORD) =>
    c.request('/api/v1/auth/activate', { method: 'POST', body: { username, activationCode: code, newPassword } });

async function claimOf(pool: pg.Pool, rosterId: string) {
    return (await pool.query('SELECT * FROM identity_student_claims WHERE roster_id=$1 ORDER BY created_at DESC, id LIMIT 1', [rosterId])).rows[0];
}

async function approveBody(pool: pg.Pool, rosterId: string, extra: Record<string, unknown>) {
    const claim = await claimOf(pool, rosterId);
    const revision = (await pool.query('SELECT revision FROM academic_core_student_roster_records WHERE id=$1', [rosterId])).rows[0].revision;
    return { claimId: claim.id, expectedRevision: claim.revision, expectedRosterRevision: revision, decision: 'APPROVE', reason: 'Diverifikasi langsung', confirmed: true, requestKey: randomUUID(), ...extra };
}

async function blockedBackends(watch: pg.PoolClient): Promise<number> {
    return (await watch.query(`SELECT count(*)::int AS n FROM pg_stat_activity WHERE datname = current_database() AND cardinality(pg_blocking_pids(pid)) > 0`)).rows[0].n;
}
async function untilBlocked(watch: pg.PoolClient, count: number, pending: Promise<unknown>[]) {
    let finished = false;
    for (const p of pending) p.then(() => { finished = true; }, () => { finished = true; });
    const until = Date.now() + 15000;
    while (Date.now() < until) {
        if (finished) throw new Error('Writer finished before contention was observed');
        if (await blockedBackends(watch) >= count) return;
    }
    throw new Error('No real PostgreSQL contention observed');
}

const student = (s: School, name: string, nisn: string, birth: string, key = randomUUID()) => ({ tenantId: s.tenant, fullName: name, nisn, birthDate: birth, requestKey: key });

test('AUTH-002 C01/C02/C04/C11 public submission is non-trusted, uniform, replay-safe and lazily expires', { skip: skipWithoutDatabase }, async t => {
    const db = await createDisposableDatabase(); const app = await startProductionWiredServer(db.pool);
    t.after(async () => { await app.close(); await db.close(); });
    const s = await school(db.pool);
    const matched = await roster(db.pool, s, 'Siti  Rahmawati', '0012345678', '2010-02-03');
    const other = await roster(db.pool, s, 'Budi Santoso', '0099999999', '2010-05-06');
    const anonymous = new BrowserLikeClient(app.baseUrl);
    const before = await snapshot(db.pool);

    const first = student(s, 'siti rahmawati', '0012345678', '2010-02-03');
    const responses = [
        await submit(anonymous, first),
        await submit(anonymous, student(s, 'Nama Lain', '0099999999', '2010-05-06')),
        await submit(anonymous, student(s, 'Tidak Terdaftar', '0000000001', '2011-01-01')),
        await submit(anonymous, student({ ...s, tenant: randomUUID() }, 'Sekolah Lain', '0012345678', '2010-02-03')),
    ];
    for (const r of responses) {
        assert.equal(r.status, 202);
        assert.deepEqual(Object.keys(r.body).sort(), ['requestKey', 'status']);
        assert.equal(r.headers.get('cache-control'), 'no-store');
        assert.ok(!JSON.stringify(r.body).includes('0012345678') && !JSON.stringify(r.body).toLowerCase().includes('siti'));
    }
    // C01: zero Person/Account/credential/activation/session/membership/enrollment/roster effect.
    assert.deepEqual(await snapshot(db.pool), before);
    // C02: deterministic NFC/whitespace/case confirmation; mismatch and unknown stay review-required.
    assert.equal((await claimOf(db.pool, matched)).state, 'PENDING_REVIEW');
    assert.equal((await claimOf(db.pool, other)).state, 'REVIEW_REQUIRED');
    const unmatched = (await db.pool.query(`SELECT state, roster_id FROM identity_student_claims WHERE submitted_nisn='0000000001'`)).rows;
    assert.deepEqual(unmatched, [{ state: 'REVIEW_REQUIRED', roster_id: null }]);
    assert.equal((await db.pool.query('SELECT count(*)::int AS n FROM identity_student_claims WHERE tenant_id <> $1', [s.tenant])).rows[0].n, 0);

    // Replay and duplicates: one claim per roster identity; altered intent under a key refuses.
    const count = async () => (await db.pool.query('SELECT count(*)::int AS n FROM identity_student_claims')).rows[0].n as number;
    const n = await count();
    assert.equal((await submit(anonymous, first)).status, 202);
    assert.equal((await submit(anonymous, student(s, 'Siti Rahmawati', '0012345678', '2010-02-03'))).status, 202);
    assert.equal(await count(), n);
    assert.equal((await submit(anonymous, { ...first, fullName: 'Diubah' })).status, 409);
    for (const bad of [{ ...first, personId: randomUUID() }, { ...first, birthDate: '2010-02-30' }, { ...first, nisn: 12345678 },
        { ...first, nisn: ' 0012' }, { ...first, fullName: 'x'.repeat(201) }, { ...first, requestKey: 'abc' }, { tenantId: s.tenant }]) {
        assert.equal((await submit(anonymous, bad as Record<string, unknown>)).status, 400);
    }
    assert.equal(await count(), n);

    // C04: exactly seven days; the first observer at expires_at closes it, then a new claim is admitted.
    const open = await claimOf(db.pool, matched);
    assert.equal(new Date(open.expires_at).getTime() - new Date(open.created_at).getTime(), 7 * 24 * 60 * 60 * 1000);
    const expiresAt = new Date(open.expires_at).getTime();
    await submitClaim(db.pool, student(s, 'Siti Rahmawati', '0012345678', '2010-02-03'), { now: () => new Date(expiresAt - 1) });
    assert.equal(await count(), n);
    await submitClaim(db.pool, student(s, 'Siti Rahmawati', '0012345678', '2010-02-03'), { now: () => new Date(expiresAt) });
    assert.equal((await db.pool.query('SELECT state FROM identity_student_claims WHERE id=$1', [open.id])).rows[0].state, 'EXPIRED');
    assert.equal(await count(), n + 1);
    assert.equal((await claimOf(db.pool, matched)).state, 'PENDING_REVIEW');
    // Generic claim history is append-only and holds no raw proof or secret.
    await assert.rejects(db.pool.query('UPDATE identity_student_claim_events SET reason=$1', ['tamper']));
    await assert.rejects(db.pool.query('DELETE FROM identity_student_claims'));
    await assert.rejects(db.pool.query('UPDATE identity_student_claims SET expires_at = expires_at + interval \'1 day\', revision = revision + 1 WHERE id=$1', [open.id]));
    assert.deepEqual(await snapshot(db.pool), before);
});

test('AUTH-002 C03/C08/C10/C11 scoped verifiers, explicit new identity, one-time handoff and Student activation', { skip: skipWithoutDatabase, timeout: 120000 }, async t => {
    const db = await createDisposableDatabase(); const app = await startProductionWiredServer(db.pool);
    t.after(async () => { await app.close(); await db.close(); });
    const s = await school(db.pool), elsewhere = await otherGroup(db.pool, s);
    const homeroom = await createPersonWithAccount(db.pool), homeroomMembership = await addMembership(db.pool, s.tenant, homeroom.personId);
    const foreignHomeroom = await createPersonWithAccount(db.pool); await addMembership(db.pool, s.tenant, foreignHomeroom.personId);
    const plainTeacher = await createPersonWithAccount(db.pool); await addMembership(db.pool, s.tenant, plainTeacher.personId);
    const outsiderTenant = await school(db.pool);
    const rosterId = await roster(db.pool, s, 'Dewi Lestari', '0011112222', '2010-03-04');
    const anonymous = new BrowserLikeClient(app.baseUrl);
    assert.equal((await submit(anonymous, student(s, 'Dewi Lestari', '0011112222', '2010-03-04'))).status, 202);

    const result = homeroomCli(db.url, s, homeroom.username, s.group);
    assert.equal(result.changed, true);
    assert.equal(homeroomCli(db.url, s, homeroom.username, s.group).changed, false);
    homeroomCli(db.url, s, foreignHomeroom.username, elsewhere);
    assert.ok(homeroomMembership);

    const hr = await signIn(app.baseUrl, s, homeroom), wrongRombel = await signIn(app.baseUrl, s, foreignHomeroom), teacher = await signIn(app.baseUrl, s, plainTeacher);
    assert.equal((await hr.request('/api/v1/me/context')).body.capabilities.claimVerifier, true);
    assert.equal((await teacher.request('/api/v1/me/context')).body.capabilities.claimVerifier, undefined);
    const queue = await review(hr);
    assert.equal(queue.status, 200); assert.equal(queue.body.authority, 'homeroom'); assert.equal(queue.body.claims.length, 1);
    assert.equal(queue.headers.get('cache-control'), 'no-store');
    assert.deepEqual(queue.body.claims[0].submitted, { fullName: 'Dewi Lestari', nisn: '0011112222', birthDate: '2010-03-04' });
    assert.equal((await review(wrongRombel)).body.claims.length, 0);
    assert.equal((await review(teacher)).status, 403);
    assert.equal((await review(anonymous)).status, 401);
    const staffOutside = await signIn(app.baseUrl, outsiderTenant, outsiderTenant.staff);
    await operator(db.pool, outsiderTenant, outsiderTenant.staff.personId);
    assert.equal((await review(staffOutside)).body.claims.length, 0);

    const before = await snapshot(db.pool);
    const body = await approveBody(db.pool, rosterId, { adjudication: 'NEW_IDENTITY_REVIEWED', noExistingAccountConfirmed: true });
    // Substitution, missing attestation, wrong scope and foreign tenant all refuse with zero mutation.
    for (const field of ['personId', 'actorPersonId', 'tenantId', 'activationCode']) assert.equal((await decide(hr, { ...body, [field]: randomUUID() })).status, 400);
    assert.equal((await decide(hr, { ...body, noExistingAccountConfirmed: false })).status, 400);
    assert.equal((await decide(hr, { ...body, confirmed: false })).status, 400);
    assert.equal((await decide(wrongRombel, body)).status, 403);
    assert.equal((await decide(teacher, body)).status, 403);
    assert.equal((await decide(staffOutside, body)).status, 404);
    assert.equal((await decide(hr, { ...body, expectedRevision: 2 })).status, 409);
    assert.equal((await decide(hr, { ...body, expectedRosterRevision: 2 })).status, 409);
    assert.deepEqual(await snapshot(db.pool), before);

    const approved = await decide(hr, body);
    assert.equal(approved.status, 200, JSON.stringify(approved.body));
    assert.equal(approved.body.outcome, 'APPROVED');
    assert.match(approved.body.elligbleId, /^elg-[a-z0-9]{4}-[a-z0-9]{4}-[a-z0-9]{4}$/);
    assert.match(approved.body.activationCode, /^[A-Z0-9-]+$/);
    assert.equal(approved.headers.get('cache-control'), 'no-store');
    const claim = await claimOf(db.pool, rosterId);
    assert.equal(claim.state, 'APPROVED_PENDING_ACTIVATION');
    const binding = (await db.pool.query('SELECT * FROM academic_core_roster_identity_bindings WHERE roster_id=$1', [rosterId])).rows;
    assert.equal(binding.length, 1); assert.equal(binding[0].person_id, claim.person_id); assert.equal(binding[0].decided_by_person_id, homeroom.personId);
    const enrollment = (await db.pool.query(`SELECT e.source, e.academic_group_id FROM academic_core_student_enrollments e JOIN tenant_memberships m ON m.id=e.membership_id
        WHERE m.person_id=$1`, [claim.person_id])).rows;
    assert.deepEqual(enrollment, [{ source: 'student_claim', academic_group_id: s.group }]);
    // Approval alone creates no usable password and no session.
    assert.equal((await db.pool.query('SELECT count(*)::int AS n FROM identity_sessions s JOIN identity_user_accounts a ON a.id=s.user_account_id WHERE a.person_id=$1', [claim.person_id])).rows[0].n, 0);
    const events = (await db.pool.query('SELECT to_jsonb(e)::text AS row FROM identity_student_claim_events e')).rows.map(r => r.row).join('\n');
    assert.ok(!events.includes(approved.body.activationCode) && !events.includes('0011112222') && !events.includes('2010-03-04'));

    // C10: same-key replay returns the receipt without re-disclosing the code; altered intent refuses.
    const afterApproval = await snapshot(db.pool);
    const replay = await decide(hr, body);
    assert.equal(replay.status, 200); assert.equal(replay.body.replayed, true); assert.equal(replay.body.activationCode, undefined);
    assert.equal((await decide(hr, { ...body, reason: 'Alasan lain' })).status, 409);
    assert.deepEqual(await snapshot(db.pool), afterApproval);

    // A wrong code counts on the claim-issued row only; the right code activates through the claim route.
    const studentClient = new BrowserLikeClient(app.baseUrl);
    assert.equal((await activate(studentClient, approved.body.elligbleId, 'AAAA-BBBB-CCCC')).status, 401);
    assert.equal((await db.pool.query('SELECT a.failed_attempts FROM identity_student_claim_activations r JOIN identity_account_activations a ON a.id=r.activation_id WHERE r.claim_id=$1', [claim.id])).rows[0].failed_attempts, 1);
    const activated = await activate(studentClient, approved.body.elligbleId.toUpperCase(), approved.body.activationCode);
    assert.equal(activated.status, 200, JSON.stringify(activated.body));
    assert.equal((await claimOf(db.pool, rosterId)).state, 'ACTIVATED');
    assert.equal((await activate(new BrowserLikeClient(app.baseUrl), approved.body.elligbleId, approved.body.activationCode, 'LainKataSandi2026!')).status, 401);
    const relogin = new BrowserLikeClient(app.baseUrl);
    assert.equal((await relogin.login(approved.body.elligbleId, PASSWORD)).status, 200);
    // Expired, consumed or closed authorization cannot be decided again.
    assert.equal((await decide(hr, { ...body, requestKey: randomUUID(), expectedRevision: (await claimOf(db.pool, rosterId)).revision })).status, 409);
    // Revoking the Homeroom responsibility removes authority.
    homeroomCli(db.url, s, homeroom.username, s.group, 'revoke');
    assert.equal((await review(hr)).status, 403);
    await assert.rejects(db.pool.query('UPDATE academic_core_roster_identity_bindings SET person_id=$1', [randomUUID()]));
    await assert.rejects(db.pool.query('DELETE FROM academic_core_homeroom_responsibility_events'));
});

test('AUTH-002 C03/C08 continuity, existing binding, active Account and fail-closed staff exclusion', { skip: skipWithoutDatabase, timeout: 120000 }, async t => {
    const db = await createDisposableDatabase(); const app = await startProductionWiredServer(db.pool);
    t.after(async () => { await app.close(); await db.close(); });
    const s = await school(db.pool);
    const verifier = await createPersonWithAccount(db.pool); await addMembership(db.pool, s.tenant, verifier.personId);
    await operator(db.pool, s, verifier.personId);
    const op = await signIn(app.baseUrl, s, verifier);
    const anonymous = new BrowserLikeClient(app.baseUrl);
    const claimFor = async (name: string, nisn: string) => {
        const id = await roster(db.pool, s, name, nisn, '2010-07-08');
        assert.equal((await submit(anonymous, student(s, name, nisn, '2010-07-08'))).status, 202);
        return id;
    };

    // An active Account (signed in before) is never issued a code or reset.
    const active = await createPersonWithAccount(db.pool); await addMembership(db.pool, s.tenant, active.personId);
    await signIn(app.baseUrl, s, active);
    const activeRoster = await claimFor('Andi Wijaya', '0020000001');
    const before = await snapshot(db.pool, ['identity_account_credentials', 'identity_account_activations']);
    const kept = await decide(op, await approveBody(db.pool, activeRoster, { adjudication: 'EXISTING_ACCOUNT_CONTINUITY', elligbleId: active.username }));
    assert.equal(kept.status, 200, JSON.stringify(kept.body)); assert.equal(kept.body.outcome, 'APPROVED_EXISTING_ACCOUNT'); assert.equal(kept.body.activationCode, undefined);
    assert.deepEqual(await snapshot(db.pool, ['identity_account_credentials', 'identity_account_activations']), before);
    assert.equal((await new BrowserLikeClient(app.baseUrl).login(active.username, active.password)).status, 200);
    // The binding now exists: a later claim must use EXISTING_BINDING, never continuity.
    assert.equal((await submit(anonymous, student(s, 'Andi Wijaya', '0020000001', '2010-07-08'))).status, 202);
    assert.equal((await decide(op, await approveBody(db.pool, activeRoster, { adjudication: 'EXISTING_ACCOUNT_CONTINUITY', elligbleId: active.username }))).status, 409);
    const rebound = await decide(op, await approveBody(db.pool, activeRoster, { adjudication: 'EXISTING_BINDING' }));
    assert.equal(rebound.status, 200); assert.equal(rebound.body.outcome, 'APPROVED_EXISTING_ACCOUNT');

    // A never-activated existing Account receives the existing single-use code, no password reset.
    const fresh = await createPersonWithAccount(db.pool); await addMembership(db.pool, s.tenant, fresh.personId);
    const freshRoster = await claimFor('Rina Putri', '0020000002');
    const verifierBefore = (await db.pool.query('SELECT password_verifier FROM identity_account_credentials WHERE user_account_id=$1', [fresh.accountId])).rows[0];
    const handed = await decide(op, await approveBody(db.pool, freshRoster, { adjudication: 'EXISTING_ACCOUNT_CONTINUITY', elligbleId: fresh.username }));
    assert.equal(handed.status, 200); assert.equal(handed.body.outcome, 'APPROVED'); assert.equal(handed.body.elligbleId, fresh.username);
    assert.deepEqual((await db.pool.query('SELECT password_verifier FROM identity_account_credentials WHERE user_account_id=$1', [fresh.accountId])).rows[0], verifierBefore);

    // Staff, Teacher, Proctor, Operator, foreign and self targets stay REVIEW_REQUIRED with zero mutation.
    const teacher = s.staff;
    const proctor = await createPersonWithAccount(db.pool); await addMembership(db.pool, s.tenant, proctor.personId);
    const teaching = (await db.pool.query('SELECT id AS "teachingAssignmentId", academic_group_id AS "academicGroupId" FROM academic_core_teaching_assignments WHERE tenant_id=$1', [s.tenant])).rows[0];
    const assessmentTypeId = (await db.pool.query('SELECT id FROM secure_assessment_assessment_types WHERE tenant_id=$1', [s.tenant])).rows[0].id;
    const exam = await createExamInstance(db.pool, s.tenant, { ...teaching, teacherAssignmentId: '', subjectLabel: '', assessmentTypeId });
    await addProctorAssignment(db.pool, s.tenant, exam, proctor.personId);
    const otherOperator = await createPersonWithAccount(db.pool); const foreign = await school(db.pool);
    await addMembership(db.pool, foreign.tenant, otherOperator.personId); await operator(db.pool, foreign, otherOperator.personId, 'ASSIGN');
    await operator(db.pool, foreign, otherOperator.personId, 'REVOKE');
    await addMembership(db.pool, s.tenant, otherOperator.personId);
    const notMember = await createPersonWithAccount(db.pool);
    const targets: Array<[string, string]> = [['teacher', teacher.username], ['proctor', proctor.username], ['revoked operator elsewhere', otherOperator.username],
        ['no membership', notMember.username], ['self', verifier.username], ['unknown', 'elg-zzzz-zzzz-zzzz']];
    const probe = await claimFor('Target Uji', '0020000003');
    for (const [label, username] of targets) {
        const state = await snapshot(db.pool);
        const r = await decide(op, await approveBody(db.pool, probe, { adjudication: 'EXISTING_ACCOUNT_CONTINUITY', elligbleId: username }));
        assert.equal(r.status, 409, label); assert.equal(r.body.error, 'review_required', label);
        assert.deepEqual(await snapshot(db.pool), state, label);
    }
    // A Person already bound to another roster record of the tenant is never bound twice.
    const r = await decide(op, await approveBody(db.pool, probe, { adjudication: 'EXISTING_ACCOUNT_CONTINUITY', elligbleId: active.username }));
    assert.equal(r.status, 409);
    // Reject is terminal and needs a reason; REVIEW_REQUIRED can be rejected but never approved.
    const mismatch = await roster(db.pool, s, 'Nama Resmi', '0020000004', '2010-07-08');
    await submit(anonymous, student(s, 'Nama Berbeda', '0020000004', '2010-07-08'));
    assert.equal((await decide(op, await approveBody(db.pool, mismatch, { adjudication: 'NEW_IDENTITY_REVIEWED', noExistingAccountConfirmed: true }))).status, 409);
    const claim = await claimOf(db.pool, mismatch);
    assert.equal((await decide(op, { claimId: claim.id, expectedRevision: claim.revision, decision: 'REJECT', reason: '   ', confirmed: true, requestKey: randomUUID() })).status, 400);
    const rejected = await decide(op, { claimId: claim.id, expectedRevision: claim.revision, decision: 'REJECT', reason: 'Data tidak cocok', confirmed: true, requestKey: randomUUID() });
    assert.equal(rejected.status, 200); assert.equal(rejected.body.outcome, 'REJECTED');
    assert.equal((await claimOf(db.pool, mismatch)).state, 'REJECTED');
});

test('AUTH-002 C04/C05/C06 exhaustion, reissue, expiry, cancellation and atomic rollback', { skip: skipWithoutDatabase, timeout: 120000 }, async t => {
    const db = await createDisposableDatabase(); const app = await startProductionWiredServer(db.pool);
    t.after(async () => { await app.close(); await db.close(); });
    const s = await school(db.pool);
    const verifier = await createPersonWithAccount(db.pool); await addMembership(db.pool, s.tenant, verifier.personId);
    await operator(db.pool, s, verifier.personId);
    const op = await signIn(app.baseUrl, s, verifier);
    const anonymous = new BrowserLikeClient(app.baseUrl);
    let n = 0;
    const approvedClaim = async () => {
        n++;
        const nisn = `003000000${n}`, name = `Siswa Uji ${n}`;
        const id = await roster(db.pool, s, name, nisn, '2010-09-10');
        assert.equal((await submit(anonymous, student(s, name, nisn, '2010-09-10'))).status, 202);
        const r = await decide(op, await approveBody(db.pool, id, { adjudication: 'NEW_IDENTITY_REVIEWED', noExistingAccountConfirmed: true }));
        assert.equal(r.status, 200, JSON.stringify(r.body));
        return { rosterId: id, nisn, name, elligbleId: r.body.elligbleId as string, code: r.body.activationCode as string };
    };

    // C06: a failure at any owning stage rolls back every effect, including the new Person.
    for (const table of ['academic_core_roster_identity_bindings', 'academic_core_student_enrollments', 'identity_student_claim_activations', 'identity_student_claim_events']) {
        const id = await roster(db.pool, s, `Rollback ${table}`, `004${table.length}${randomUUID().slice(0, 4)}`, '2010-01-01');
        const row = (await db.pool.query('SELECT nisn FROM academic_core_student_roster_records WHERE id=$1', [id])).rows[0];
        await submit(anonymous, student(s, `Rollback ${table}`, row.nisn, '2010-01-01'));
        const body = await approveBody(db.pool, id, { adjudication: 'NEW_IDENTITY_REVIEWED', noExistingAccountConfirmed: true });
        const state = await snapshot(db.pool, [...TRUSTED, 'identity_student_claims', 'identity_student_claim_events', 'identity_id_allocation_events']);
        await db.pool.query(`CREATE FUNCTION synthetic_claim_failure() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'synthetic'; END $$;
            CREATE TRIGGER synthetic_claim_failure BEFORE INSERT ON ${table} FOR EACH ROW WHEN (pg_trigger_depth() = 0) EXECUTE FUNCTION synthetic_claim_failure()`);
        try {
            assert.equal((await decide(op, body)).status, 503, table);
            assert.deepEqual(await snapshot(db.pool, [...TRUSTED, 'identity_student_claims', 'identity_student_claim_events', 'identity_id_allocation_events']), state, table);
        } finally {
            await db.pool.query(`DROP TRIGGER synthetic_claim_failure ON ${table}; DROP FUNCTION synthetic_claim_failure()`);
        }
    }

    // Ten wrong codes revoke only the claim-issued row; the next observer records EXHAUSTED and admits a new claim.
    const exhausted = await approvedClaim();
    for (let i = 0; i < 10; i++) assert.equal((await activate(new BrowserLikeClient(app.baseUrl), exhausted.elligbleId, 'AAAA-BBBB-CCCC')).status, 401);
    assert.equal((await claimOf(db.pool, exhausted.rosterId)).state, 'EXHAUSTED');
    assert.equal((await activate(new BrowserLikeClient(app.baseUrl), exhausted.elligbleId, exhausted.code)).status, 401);
    await submit(anonymous, student(s, exhausted.name, exhausted.nisn, '2010-09-10'));
    assert.equal((await claimOf(db.pool, exhausted.rosterId)).state, 'PENDING_REVIEW');

    // An ordinary reissue closes the claim lazily; the reissued card keeps ordinary semantics.
    const reissued = await approvedClaim();
    const account = (await db.pool.query('SELECT user_account_id FROM identity_account_credentials WHERE username=$1', [reissued.elligbleId])).rows[0].user_account_id;
    const c = await db.pool.connect();
    let card: { code: string } | null;
    try { card = await new IdentityRuntime(c as unknown as pg.Client).issueActivation(account, { rotatePassword: false }); } finally { c.release(); }
    assert.ok(card);
    assert.equal((await activate(new BrowserLikeClient(app.baseUrl), reissued.elligbleId, reissued.code)).status, 401);
    assert.equal((await activate(new BrowserLikeClient(app.baseUrl), reissued.elligbleId, card.code)).status, 200);
    await submit(anonymous, student(s, reissued.name, reissued.nisn, '2010-09-10'));
    const closed = (await db.pool.query('SELECT state FROM identity_student_claims WHERE roster_id=$1 ORDER BY created_at, id', [reissued.rosterId])).rows.map(r => r.state);
    assert.deepEqual(closed, ['CLOSED_BY_REISSUE', 'PENDING_REVIEW']);

    // Claim expiry bounds claim-bound activation at the exact boundary, without consuming the code.
    const expiring = await approvedClaim();
    const claim = await claimOf(db.pool, expiring.rosterId);
    const route = await resolveClaimActivationRoute(db.pool as unknown as pg.PoolClient, expiring.elligbleId);
    assert.equal(route?.claimId, claim.id);
    const pc = await db.pool.connect();
    try {
        const late = await activateClaimBound(pc, route!, expiring.elligbleId, expiring.code, PASSWORD, { now: () => new Date(claim.expires_at) });
        assert.equal(late.success, false);
    } finally { pc.release(); }
    assert.equal((await claimOf(db.pool, expiring.rosterId)).state, 'EXPIRED');
    assert.equal((await activate(new BrowserLikeClient(app.baseUrl), expiring.elligbleId, expiring.code)).status, 401);

    // Cancelling an approved claim revokes only its own code row.
    const cancelled = await approvedClaim();
    const open = await claimOf(db.pool, cancelled.rosterId);
    const r = await decide(op, { claimId: open.id, expectedRevision: open.revision, decision: 'CANCEL', reason: 'Siswa pindah sekolah', confirmed: true, requestKey: randomUUID() });
    assert.equal(r.status, 200); assert.equal(r.body.outcome, 'CANCELLED');
    assert.equal((await activate(new BrowserLikeClient(app.baseUrl), cancelled.elligbleId, cancelled.code)).status, 401);
    // A missing school time zone refuses approval fail-closed with zero mutation.
    await db.pool.query('UPDATE tenant_tenants SET time_zone = NULL WHERE id=$1', [s.tenant]);
    const tz = await roster(db.pool, s, 'Zona Uji', '0050000001', '2010-01-01');
    await submit(anonymous, student(s, 'Zona Uji', '0050000001', '2010-01-01'));
    const state = await snapshot(db.pool);
    const refused = await decide(op, await approveBody(db.pool, tz, { adjudication: 'NEW_IDENTITY_REVIEWED', noExistingAccountConfirmed: true }));
    assert.equal(refused.status, 409); assert.equal(refused.body.error, 'school_time_zone_missing');
    assert.deepEqual(await snapshot(db.pool), state);
});

test('AUTH-002 C07/C09 real contention: roster fence both orders, membership key, credential lock, duplicates', { skip: skipWithoutDatabase, timeout: 120000 }, async t => {
    const db = await createDisposableDatabase(); const app = await startProductionWiredServer(db.pool);
    t.after(async () => { await app.close(); await db.close(); });
    const s = await school(db.pool);
    const verifier = await createPersonWithAccount(db.pool); await addMembership(db.pool, s.tenant, verifier.personId);
    await operator(db.pool, s, verifier.personId);
    const op = await signIn(app.baseUrl, s, verifier);
    const anonymous = new BrowserLikeClient(app.baseUrl);
    const watch = await db.pool.connect();
    t.after(() => watch.release());
    const newClaim = async (name: string, nisn: string) => {
        const id = await roster(db.pool, s, name, nisn, '2010-11-12');
        assert.equal((await submit(anonymous, student(s, name, nisn, '2010-11-12'))).status, 202);
        return id;
    };
    const hold = async (sql: string, params: unknown[]) => {
        const c = await db.pool.connect();
        await c.query('BEGIN');
        await c.query(sql, params);
        return { commit: async () => { await c.query('COMMIT'); c.release(); } };
    };

    // Order 1: a roster writer holds the roster-tenant fence; the decision waits, then succeeds.
    const first = await newClaim('Kontensi Satu', '0060000001');
    const fence = await hold('SELECT pg_advisory_xact_lock(hashtext($1))', [`roster-tenant:${s.tenant}`]);
    const waiting = decide(op, await approveBody(db.pool, first, { adjudication: 'NEW_IDENTITY_REVIEWED', noExistingAccountConfirmed: true }));
    await untilBlocked(watch, 1, [waiting]);
    await fence.commit();
    assert.equal((await waiting).status, 200);

    // Order 2: the decision holds the fence while it waits on a same-tenant membership writer
    // (people import / ensureMembership / setSchoolOperator take this key first); roster import waits behind it.
    const person = await createPersonWithAccount(db.pool); await addMembership(db.pool, s.tenant, person.personId);
    const second = await newClaim('Kontensi Dua', '0060000002');
    // A second Operator imports, so its own session is free and it waits on the roster-tenant fence.
    const importer = await createPersonWithAccount(db.pool); await addMembership(db.pool, s.tenant, importer.personId);
    await operator(db.pool, s, importer.personId);
    const op2 = await signIn(app.baseUrl, s, importer);
    const csv = 'source_student_key,full_name,nis,nisn,date_of_birth,academic_group_id\n' + `kontensi,Impor Kontensi,nis-k,0069999999,2010-01-01,${s.group}`;
    const input = { academicYearId: s.year, academicPeriodId: s.period, csv };
    const preview = await op2.request('/api/v1/identity/roster/preview', { method: 'POST', body: input });
    assert.equal(preview.status, 200);
    const member = await hold('SELECT pg_advisory_xact_lock(hashtext($1))', [`tenant_membership:${s.tenant}:${person.personId}`]);
    const deciding = decide(op, await approveBody(db.pool, second, { adjudication: 'EXISTING_ACCOUNT_CONTINUITY', elligbleId: person.username }));
    await untilBlocked(watch, 1, [deciding]);
    const importing = op2.request('/api/v1/identity/roster/confirm', { method: 'POST', body: { ...input, inputDigest: preview.body.inputDigest, stateDigest: preview.body.stateDigest, requestKey: randomUUID(), reason: 'Kontensi impor', confirmed: true } });
    await untilBlocked(watch, 2, [deciding, importing]);
    await member.commit();
    const [decided, imported] = await Promise.all([deciding, importing]);
    assert.equal(decided.status, 200, JSON.stringify(decided.body));
    // The binding changed the effective roster identity, so the earlier preview is stale; never a deadlock.
    assert.equal(imported.status, 409);
    assert.equal(imported.body.error, 'stale_conflict');

    // Claim-bound activation waits on an existing credential-first writer (login/reissue), then activates.
    const third = await newClaim('Kontensi Tiga', '0060000003');
    const approved = await decide(op, await approveBody(db.pool, third, { adjudication: 'NEW_IDENTITY_REVIEWED', noExistingAccountConfirmed: true }));
    const account = (await db.pool.query('SELECT user_account_id FROM identity_account_credentials WHERE username=$1', [approved.body.elligbleId])).rows[0].user_account_id;
    const credential = await hold('SELECT 1 FROM identity_account_credentials WHERE user_account_id=$1 FOR UPDATE', [account]);
    const activating = activate(new BrowserLikeClient(app.baseUrl), approved.body.elligbleId, approved.body.activationCode);
    await untilBlocked(watch, 1, [activating]);
    await credential.commit();
    assert.equal((await activating).status, 200);
    assert.equal((await claimOf(db.pool, third)).state, 'ACTIVATED');

    // A submit observer holding the claim row makes claim-bound activation wait; no partial state.
    const fourth = await newClaim('Kontensi Empat', '0060000004');
    const fourthApproved = await decide(op, await approveBody(db.pool, fourth, { adjudication: 'NEW_IDENTITY_REVIEWED', noExistingAccountConfirmed: true }));
    const claimRow = await hold('SELECT 1 FROM identity_student_claims WHERE id=$1 FOR UPDATE', [(await claimOf(db.pool, fourth)).id]);
    const blockedActivation = activate(new BrowserLikeClient(app.baseUrl), fourthApproved.body.elligbleId, fourthApproved.body.activationCode);
    await untilBlocked(watch, 1, [blockedActivation]);
    await claimRow.commit();
    assert.equal((await blockedActivation).status, 200);

    // Two verifiers deciding the same claim with distinct keys: exactly one effect.
    const fifth = await newClaim('Kontensi Lima', '0060000005');
    const a = await approveBody(db.pool, fifth, { adjudication: 'NEW_IDENTITY_REVIEWED', noExistingAccountConfirmed: true });
    const results = await Promise.all([decide(op, a), decide(op, { ...a, requestKey: randomUUID() })]);
    assert.deepEqual(results.map(r => r.status).sort(), [200, 409]);
    assert.equal((await db.pool.query('SELECT count(*)::int AS n FROM academic_core_roster_identity_bindings WHERE roster_id=$1', [fifth])).rows[0].n, 1);
    // Concurrent anonymous submissions for one roster identity: one open claim.
    const sixth = await roster(db.pool, s, 'Kontensi Enam', '0060000006', '2010-11-12');
    const many = await Promise.all(Array.from({ length: 6 }, () => submit(anonymous, student(s, 'Kontensi Enam', '0060000006', '2010-11-12'))));
    for (const r of many) assert.ok([202, 429].includes(r.status));
    assert.equal((await db.pool.query('SELECT count(*)::int AS n FROM identity_student_claims WHERE roster_id=$1 AND closed_at IS NULL', [sixth])).rows[0].n, 1);
    // A roster correction after approval stops claim-bound activation without consuming the code.
    const seventh = await newClaim('Kontensi Tujuh', '0060000007');
    const seventhApproved = await decide(op, await approveBody(db.pool, seventh, { adjudication: 'NEW_IDENTITY_REVIEWED', noExistingAccountConfirmed: true }));
    await db.pool.query(`UPDATE academic_core_student_roster_records SET full_name='Kontensi Tujuh Koreksi', revision=revision+1 WHERE id=$1`, [seventh]);
    assert.equal((await activate(new BrowserLikeClient(app.baseUrl), seventhApproved.body.elligbleId, seventhApproved.body.activationCode)).status, 401);
    assert.equal((await claimOf(db.pool, seventh)).state, 'APPROVED_PENDING_ACTIVATION');
    assert.equal((await db.pool.query(`SELECT a.consumed_at, a.failed_attempts FROM identity_student_claim_activations r JOIN identity_account_activations a ON a.id=r.activation_id
        WHERE r.claim_id=$1`, [(await claimOf(db.pool, seventh)).id])).rows[0].failed_attempts, 0);
});
