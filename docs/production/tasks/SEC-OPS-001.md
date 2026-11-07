# SEC-OPS-001 — Audited Operational/Session Intervention

## 1. Control state and authority

| Field | Disposition |
|---|---|
| Classification | Active P11 Task; P0 operational security; HIGH risk; R07/R23/R28/R29, P5 A14, P8 V01/V11/V16 |
| Status | **IN_PROGRESS — security contract review chain PASS (§11); formal READY PASS and Build started under DEC-048 on 2026-11-07 (§12)** |
| Objective | Replace the runbook's manual-SQL session revocation with an approved, case-scoped, audited owning-module command, and record the Owner's PB12 incident arrangements |
| Owner decisions | 2026-11-07, Owner in chat (§4): the Owner is the named incident lead; intervention is a case-scoped platform-operator CLI; escalation runs from the lead to the affected school principal, manually. The Owner also designated a separate read-only fresh-context reviewer agent as the independent security reviewer for this Task and, by default, for later Tasks unless the Owner names another |
| Execution authority | DEC-048 (00.13). Internal dependencies SEC-001 and AUTH-003 are DONE / MERGED (main b6dab652be382bd8c3dec78912e397b44dffaf86, post-merge CI #150 attempt 1 eight SUCCESS) |
| Base and branch | main b6dab65; branch task/sec-ops-001-audited-intervention, worktree `C:\Projects\ELLIGBLE-sec-ops-001` |
| Parallel safe / cost | No parallel baseline Task; no dependency, vendor, service or cost |

Authority: [DEC-044](../../00-governance/00.11_CBT_RELEASE_SCOPE_REALIGNMENT.md), [DEC-045 §5](../../00-governance/00.12_AICWDF_ADOPTION_AND_TASK_EXECUTION.md), [DEC-048](../../00-governance/00.13_STANDING_EXECUTION_DELEGATION.md), [TASK_PLAN SEC-OPS-001/§4/§8 (O03, O09, PB12)](../TASK_PLAN.md), [P5 A14](../CBT_PERMISSION_MATRIX.md), [runbook §6](../OPERATIONS_RUNBOOK.md), [AUTH-001](AUTH-001.md) and [AUTH-003](AUTH-003.md) session and credential conventions. No LOCKED decision or PB status changes.

## 2. Reuse and bounded gaps

- **Session model:** Identity sessions fail closed once `is_revoked` is set. `activation reissue` already revokes every session of an Account inside its credential-locked transaction.
- **Provisioning boundary:** the operator CLI is the trusted platform-operator boundary. Every change is validated, applied in one transaction and recorded in the append-only `platform_provisioning_events` with `--operator` and `--case`.
- **Gap:** the runbook (§6.3) tells operators to run `UPDATE identity_sessions SET is_revoked = TRUE WHERE ...` by hand. That has no scope check, no case, no reason and no audit.

In scope:
- one CLI command, its coordinator and an Identity owning function;
- migration 0059 (audit action and reason);
- the runbook replacement and the PB12 record;
- tests.

Excluded:
- any web screen or route;
- a School Operator capability;
- tenant-wide or bulk revocation;
- password changes (the existing `activation reissue` remains the reset path);
- automated notification or sanctions;
- production SQL by agents;
- deployment and PB closure.

## 3. Settled inputs

- **O03:** atomic credential/session revocation; same Account.
- **O09 / P5 A14:** a named operations authority for interventions; logs minimise personal data and secrets.
- **AUTH-001 / AUTH-003:** credential → activation → sessions lock order.

## 4. Owner decisions — 2026-11-07

Owner selected the recommended default of each:

- **PB12 incident lead: APPROVED.** The Owner is the named incident lead. Contact is through the Owner's own established channel; no further personal data is recorded in the repository.
- **Intervention path: APPROVED.** A platform-operator CLI command per case. `--case`, `--reason` and `--operator` are required; scope is one school and one Account; the revocation and its audit are atomic. No new admin screen and no production SQL by agents.
- **Duties and escalation: APPROVED.** The incident lead decides an intervention, records the case, and informs the principal of the affected school manually. There is no automated notification and no automated sanction.

## 5. Schema (migration 0059)

`database/migrations/0059_platform_session_intervention.sql`. Main ends at 0058; this is rechecked at READY.

- `ck_platform_provisioning_action` is extended with `sessions_revoked`.
- `platform_provisioning_events.reason text NULL` is added, with:
  - `CHECK (reason IS NULL OR char_length(btrim(reason)) BETWEEN 1 AND 200)`;
  - `CHECK (action <> 'sessions_revoked' OR reason IS NOT NULL)`.
- Existing rows are unchanged, no backfill, and the append-only trigger is unchanged.

## 6. Command, transaction and lock contract

`session revoke --tenant <id> --elligble-id <id> --reason <reason> --operator <name> --case <reference> [--dry-run]`.

1. **Validation:**
   - before any connection, `--operator`, `--case` and `--reason` must be 1–200 characters and the tenant a UUID;
   - `--dry-run` still needs the reason;
   - a usage error exits 2.
2. **Coordinator** (Secure Assessment `ops/provisioning/sessions.ts`), in one READ COMMITTED transaction:
   - Resolve the ELLIGBLE ID with `findAccountByElligbleId`.
   - Require a membership in `--tenant` with `findMembership`. An unknown ID or a non-member gets one bounded problem ("no account with this ELLIGBLE ID in this school") and zero mutation.
   - Lock the credential FOR UPDATE, then call the Identity owning function `revokeAccountSessionsInTransaction`. It sets `is_revoked = TRUE` on every non-revoked session of the Account and returns the count.
   - Record `sessions_revoked` with the tenant, operator, case, reason and summary `{ sessions: n }` (counts only), then commit.
   - Any failure rolls back everything.
3. **Dry run:** counts the Account's non-revoked sessions in the same scope without writing and without an audit row. Its output is the count only.
4. **Account-wide effect:** sessions belong to the Account, not to a school, so revoking them ends every session of that Account. The scope check (membership in the named school) decides who may be targeted under a case of that school. The password and activation codes are untouched; a credential reset stays with `activation reissue`.
5. **Lock order:** credential, then sessions; the audit insert has no lock edge. This matches `activation reissue`, so there is no inverse edge with login, activation, recovery or session mutation.
6. **Output:** `{"revoked": n}` (or `{"wouldRevoke": n}` for a dry run). It never prints session ids, secrets, credentials or personal data.

## 6A. Binding review-correction contract — 2026-11-07

This section corrects the original Independent security contract review (§11). Where §§5–9 differ, §6A governs. The Owner decided items 1 and 2 in chat on 2026-11-07.

1. **Cross-school effect (F1): OWNER APPROVED 2026-11-07 (recommended default).** accept account-wide revocation. The audit summary records the number of other-school memberships, and the incident lead informs the principal of every school where the Account is a member.
2. **PB12 / O03 / O09 authorities (F2): OWNER DETERMINED 2026-11-07 (recommended).**
   - Legal is not applicable to this Task's READY scope, which is an intervention tool and its runbook entry.
   - Statutory breach-notification duties to data subjects or regulators are not decided here; they stay with LEGAL-001/PB12.
   - The security authority is the Owner-designated reviewer.
3. **Audit identifies the target; schools are listed (F3, F7).**
   - The CLI output and the dry-run output also list every other school where the Account is a member, as `{ tenantId, displayLabel }`, so the lead can inform each principal. School labels are not personal data; the audit keeps only the count.
   - The school list is read in the coordinator (`sessions.ts`) directly from `tenant_memberships` and `tenant_tenants`, as other Secure Assessment coordinators do; no tenant-access file is added.
   - The summary is `{ sessions: n, userAccountId: "<opaque uuid>", otherSchoolMemberships: m }`.
   - The runbook warns that `--case` and `--reason` must hold no personal data, because rows are append-only.
   - C01 and C06 assert these.
4. **Exact lock edges and cycle analysis (F4, corrected).**
   - **The intervention:** credential FOR UPDATE, then UPDATE of the target Account's sessions, then the audit insert. It never waits for a credential while holding a session lock.
   - **Verifier coordinators** hold the verifier's own session row FOR UPDATE and may later lock another Account's credential:
     - AUTH-002 decide APPROVE, through `lockCanonicalCredential`, only for non-staff targets;
     - AUTH-002 decide CANCEL of an approved-pending claim and the expiry observation in `observeClaim`, through `revokeClaimActivation`. This can reach an Account that became staff after approval;
     - AUTH-003 issue, through `lockCanonicalCredential`, only for non-staff targets.
   - **Cycle analysis:** a wait cycle needs a verifier transaction V1 (holding its session, waiting on credential C_P) and a revoke of P (holding C_P, waiting on P's sessions), with P's session lock held by a transaction that waits, directly or through further such pairs, back on V1's session row.
     - Every transaction holding a session lock and waiting on a credential is a verifier coordinator, and the intervention never holds a session lock while waiting.
     - So a cycle needs at least two verifier transactions that each target the other's Account through concurrent revokes, and both coordinators first take `roster-tenant` of their own tenant.
     - Such a cycle is possible only across tenants. PostgreSQL detects it and rolls back one transaction atomically: there is no partial revocation and no partial audit, and the CLI reports the failure, so the operator can rerun the same case.
   - **C05 adds,** each in both orders with pg_locks evidence:
     - revoking a verifier while that verifier's recovery issue or claim decision is paused after its session lock;
     - revoking an Account whose approved-pending claim is being cancelled, or observed as expired, by a verifier;
     - a detected deadlock leaves zero partial state. This may be produced synthetically: a test client holds the target's session row and then waits on a lock the revoke holds, and the revoke, as deadlock victim, must roll back with no audit row.
   - A verifier transaction chosen as a deadlock victim returns its own route's existing error path. That is known behaviour, outside this Task's acceptance.
5. **Negatives (F5).**
   - "Cross-case" denial is defined as the school-membership scope check, because no case registry exists and `case_reference` is free text.
   - "Unauthorized" is defined as: no HTTP route or School Operator path exists. A route-parity or no-route assertion shows no `/api/v1/*` session-revoke route.
   - Both are mapped into C02.
6. **Matrix edit (F6).** Limited to one appended checkpoint section; P5 §1–§5, including the Owner-approved A14 rows, stay unchanged.
7. **Precisions:**
   - The dry run requires real `--operator`, `--case` and `--reason` (1–200 characters), with no "dry-run" default for this command.
   - The new constraints are named, and `reason` is trimmed like operator and case.
   - `n` is the number of rows updated, including never-revoked expired sessions.
   - `issueActivationInTransaction` and recovery completion are not refactored.
   - Rows 1–4 are Task-flow paths, not allowlist (00.13 §4.3).
   - The coordinator takes a pool, so tests can pause it.

## 7. Runbook and PB12 record

- **Runbook §6.3** replaces the manual SQL with the command and the PB12 arrangement (as corrected by §6A):
  - the Owner is the incident lead;
  - duties: preserve logs, decide and record the case, revoke sessions with the command, rotate the database password when credentials may be exposed, use `activation reissue` for credential resets;
  - the lead informs the principal of every school where the Account is a member, as listed by the command, manually;
  - no automated notification or sanction.
- **PB12 stays OPEN.** Tested readiness and the authorized closure belong to SEC-RELEASE-001 and OPS-001.

## 8. Exact proposed file scopes (frozen at READY)

| # | Path | Purpose |
|---|---|---|
| 1 | docs/production/tasks/SEC-OPS-001.md | Contract, history, evidence |
| 2 | docs/production/TASK_PLAN.md | Status, counters, AUTH-003 landing record |
| 3 | docs/production/PRODUCTION_COMPLETION_PLAN.md | Status and continuity |
| 4 | docs/DOCUMENT_MANIFEST.md | Index |
| 5 | docs/production/OPERATIONS_RUNBOOK.md | Replace manual SQL; PB12 arrangement |
| 6 | docs/production/CBT_PERMISSION_MATRIX.md | A14 pointer |
| 7 | database/migrations/0059_platform_session_intervention.sql | Audit action and reason |
| 8 | runtime/identity-access/src/provisioning.ts | `revokeAccountSessionsInTransaction` |
| 9 | runtime/secure-assessment/src/ops/provisioning/audit.ts | Action type and reason |
| 10 | runtime/secure-assessment/src/ops/provisioning/sessions.ts | Coordinator |
| 11 | runtime/secure-assessment/src/ops/provision-cli.ts | Command and usage |
| 12 | runtime/secure-assessment/test/integration/session-intervention.test.ts | Real PostgreSQL and CLI |
| 13 | runtime/secure-assessment/test/session-intervention.test.ts | Units |

Forbidden:
- every other file;
- completed Task records;
- old migrations;
- workflows, lockfiles and dependencies;
- web, UI and e2e;
- production resources.

## 9. Acceptance gates (DEFINED / NOT EXECUTED)

| Gate | Oracle |
|---|---|
| C01 | The CLI revokes every non-revoked session of the target Account atomically with one audit row: action, tenant, operator, case, reason and summary `{sessions, userAccountId, otherSchoolMemberships}`. The output lists the other member schools. The old session is refused (HTTP 401) |
| C02 | Missing or invalid operator, case, reason or tenant is a usage error with zero mutation. Unknown ID and non-member (cross-case and cross-school) are a bounded problem with zero mutation. Unauthorized: no HTTP route or School Operator path (no-route assertion) |
| C03 | Dry run reports the count with zero mutation and no audit row |
| C04 | An audit insert failure rolls back the revocation exactly |
| C05 | Real PostgreSQL contention in both orders with pg_locks evidence against login (credential), Student session mutation (session row), a paused verifier coordinator being revoked, and claim CANCEL or expiry of an approved-pending claim on the revoked Account; a detected deadlock leaves zero partial state; a retry is idempotent (0 more revoked, still audited) |
| C06 | No session id, secret, credential, NISN or birth date in CLI output or the audit summary; the summary holds only the counts and the opaque account id; the output adds only school ids and labels |
| C07 | 0059 rollback, repeat and existing audit rows unchanged; earlier actions still valid; a reason is required only for `sessions_revoked` |
| C08 | Scope inside the frozen allowlist; 33 Tasks and 78 edges; exact-SHA attempt-1 eight-job CI, no re-run |
| C09 | Independent security implementation review PASS; Delegated Acceptance; evidence commit; delegated merge |

**CI-first order:**
1. A registration commit that carries the AUTH-003 landing record.
2. The implementation commit.
3. Independent review.
4. Evidence and merge.

There is no material UI, so there is no rendered baseline. Locally only typechecks and targeted units run.

## 10. History

2026-11-07: after AUTH-003 landed, the Owner answered the PB12 and intervention package and designated the reviewer. The contract was prepared under DEC-048; not published.

## 11. Independent security contract review

**Original review** by the Owner-designated read-only fresh-context reviewer, on SHA-256 74e8260048eb29f0e99e85531e004ac5a4a59f422fd97edc470db38da6168963: **STOP.**

- F1: the account-wide, cross-school effect is unapproved (Owner).
- F2: authorities per gate not shown; legal applicability (Owner).
- F3: the audit lacks the target.
- F4: the lock-edge claim was inaccurate; a cross-Account session → credential edge was untested.
- F5: card negatives were unmapped.
- F6: the matrix edit risked touching approved O09 content.

The executor verified the evidence: 0035 sessions without a tenant; people.ts link-existing; TASK_PLAN:584; recovery.ts and claims.ts verifier locking.

**First targeted re-review**, same reviewer, on SHA-256 9698553e9f8478d9e8979d4a33a220edd7656849e7a0754689f15ba0552b7f72: **STOP.**

- F1, F2, F3, F5 and F6 are CLOSED.
- F4 is NOT CLOSED: the invariant was false for AUTH-002 cancel and expiry, which lock a claim Account's credential while holding the verifier's session.
- New F7: the member schools were not listed, so the duty to inform every school could not be carried out from the tool.
- **Correction 2:** §6A.3 lists the schools; §6A.4 gives the exact edges and the cycle analysis, with C05 cases; §1, §7 and §9 are aligned.
- **Second targeted re-review, same reviewer, on SHA-256 17e50186e54589d276c5e908bf446123ce5b14d06474352a799c4e5c2e812275: PASS.** F4 and F7 are CLOSED; no new material defect.
- Non-material notes applied: the synthetic deadlock is allowed for C05, and verifier deadlock-victim behaviour is recorded.
- **Independent security contract review chain: STOP → STOP → PASS.**

**Original correction:** §6A (F3–F6 and the precisions). The Owner decided F1 (accept account-wide revocation, record other-school memberships, the lead informs every member school) and F2 (legal not applicable to this Task; breach-notification duties stay with LEGAL-001/PB12) in chat on 2026-11-07. **Targeted re-review: pending.**

## 12. Formal READY and Build start under DEC-048 — 2026-11-07

- **Eligibility (00.13 §4.1):**
  - SEC-001 and AUTH-003 are DONE / MERGED (main b6dab652be382bd8c3dec78912e397b44dffaf86, post-merge CI #150 attempt 1 eight SUCCESS).
  - PB12 is decided by the Owner (lead, duties, escalation, intervention path) and the Owner determined that legal is not applicable to this Task; the security authority is the Owner-designated reviewer, whose contract chain PASSED.
  - O03 and O09 rest on approved values and the P5 A14 boundary.
  - No OPEN policy or unapproved architecture input is used, and the Task is not prepare-only.
- **Formal READY: PASS.**
  - Frozen allowlist: rows 5–13 of §8; rows 1–4 are Task-flow paths.
  - Migration `database/migrations/0059_platform_session_intervention.sql` reserved after rechecking main b6dab652be382bd8c3dec78912e397b44dffaf86: migrations end at 0058 and no 0059 path exists.
  - Expected outcomes are only those in §4, §6, §6A and §9.
- **Frozen CI-first order:**
  1. Registration, carrying the AUTH-003 landing record.
  2. The implementation content commit.
  3. Independent security implementation review by the same reviewer.
  4. Delegated Acceptance and the evidence commit.
  5. PR-head CI, the delegated squash merge, then post-merge main CI.

  There is no material UI, so there is no rendered baseline. No re-runs.
- **Status:** BLOCKED → READY → IN_PROGRESS. Counters: DONE 5, IN_PROGRESS 1, BLOCKED 27. 33 IDs and 78 edges unchanged. PB05 and PB12 OPEN.
