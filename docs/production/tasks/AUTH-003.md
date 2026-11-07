# AUTH-003 — In-person School-assisted Recovery of the Existing Account

## 1. Control state and authority

| Field | Disposition |
|---|---|
| Classification | Active P11 Task; P0 account continuity; HIGH risk; R09, P3 F03, P5 A09, P8 V01/V03/V11 |
| Status | **DONE — final content 5003176, CI #148 attempt 1 eight SUCCESS, independent contract, implementation and rendered review chains PASS, Delegated Acceptance (DEC-048) (§16); landing by delegated squash merge (00.13 §6)** |
| Objective | A Student who forgot their password is verified in person by a scoped school verifier, who issues a single-use recovery code; the Student sets their own new password on the same Person and canonical Account, and every older session and open code is revoked atomically |
| Owner decisions | 2026-11-07, Owner in chat: R1–R4 approved (§4); the Owner designated a separate read-only fresh-context reviewer agent as the Independent Identity/Security reviewer for this Task (A03 gate, contract and implementation) |
| Execution authority | DEC-048 (00.13). Eligible after AUTH-002 DONE / MERGED (main 38259da885197ae3d207df3743d98c89d2bed9ac, post-merge CI #144 attempt 1 eight SUCCESS) and the Owner decisions above |
| Base and branch | main 38259da; branch task/auth-003-in-person-recovery, worktree `C:\Projects\ELLIGBLE-auth-003` |
| Parallel safe / cost | No parallel baseline Task. Existing Node/React/PostgreSQL/CI; no dependency, vendor, service or recurring cost |

Authority: [DEC-044](../../00-governance/00.11_CBT_RELEASE_SCOPE_REALIGNMENT.md), [DEC-045 §5](../../00-governance/00.12_AICWDF_ADOPTION_AND_TASK_EXECUTION.md), [DEC-048](../../00-governance/00.13_STANDING_EXECUTION_DELEGATION.md), [TASK_PLAN AUTH-003/§4/§8](../TASK_PLAN.md), [P2 §4](../CBT_DOMAIN_RULES_SPECIFICATION.md), [P3 F03](../ROUTE_INTERACTION_MATRIX.md), [P4 A03](../CBT_ARCHITECTURE_DELTA_REVIEW.md), [P5 A09](../CBT_PERMISSION_MATRIX.md), [AUTH-001 §4.2](AUTH-001.md), [AUTH-002 §4.1/§6A/§15](AUTH-002.md). No LOCKED decision, P5 C exclusion or PB status changes.

## 2. Reuse and bounded gaps

- AUTH-001 / O03: reset validity **fifteen minutes** from server issuance, expired at `now >= expires_at`; maximum **ten** failed attempts; single use; atomic credential/session revocation; same Person/Account; enumeration-safe responses; attributable audit without proof or credential leakage.
- AUTH-002: scoped verifier authority (own-tenant School Operator or effective own-current-rombel Homeroom), the effective roster binding (0056 `person_id` or `academic_core_roster_identity_bindings`), the six-table staff exclusion, the self-target guard and the shared lock conventions.
- Identity: credentials, sessions and the existing activation and reissue writers (credential → activation → sessions) stay unchanged.
- Gap: no school-assisted recovery exists; recovery today is only the platform-operator `activation reissue` CLI.

In scope:
- the verifier preview and issue route;
- the public completion route;
- migration 0058;
- the verifier "Pemulihan Akun" screen;
- the Student recovery form;
- tests and rendered evidence.

Excluded:
- recovery of staff, Teacher, Proctor, Operator or Homeroom Accounts (they keep the platform-operator path);
- recovery of never-activated Accounts (AUTH-002 claim or activation);
- any notification channel;
- Person merge, a new Account or a new Person;
- MFA, password policy or login lockout changes;
- real data, deployment and PB closure.

## 3. Settled inputs

O01, O03 (fifteen minutes, ten failures), A03 one canonical Account per Person, the P5 A09 boundary (verify and recover only by scoped verifiers) and AUTH-002 §6A conventions are reused unchanged.

## 4. Owner-approved decisions — 2026-11-07

Owner explicitly selected the recommended default of each:

- **R1 — proof and handoff: APPROVED.** An own-tenant School Operator or the effective Homeroom of the Student's current rombel verifies the Student in person against the roster record bound to the Account. The verifier then issues a single-use recovery code valid fifteen minutes, shown once and handed over in person. The Student enters ELLIGBLE ID, code and their own new password.
- **R2 — scope: APPROVED.** Only Student Accounts bound to the school roster qualify. Staff, Teacher, Proctor, Operator and Homeroom Accounts are refused fail-closed and keep the platform-operator path.
- **R3 — effect: APPROVED.** Issuing a code changes nothing else. On completion, atomically, the password is replaced and every existing session, open activation code and other open recovery code of the Account is revoked; the Student is signed in with a new session.
- **R4 — abuse: APPROVED.** Ten wrong codes revoke the recovery code (O03). A newer code revokes the older open recovery code. No Account lockout, no automated notification, attributable audit only.

## 5. Schema (migration 0058, Identity-owned)

`database/migrations/0058_student_account_recovery.sql`. Main ends at 0057 and no 0058 path exists; this is rechecked at READY.

The table `identity_account_recovery_codes` holds:
- id, tenant_id → tenant, user_account_id/person_id (FK to the Account and Person pair), roster_id (the verified roster record);
- issuer_person_id → Person, issuer_kind (`school_operator` or `homeroom`), reason (1–200);
- request_key, request_digest (sha256 hex);
- code_verifier (scrypt verifier of the code; the code itself is never stored);
- issued_at, expires_at with `CHECK (expires_at = issued_at + interval '15 minutes')`;
- failed_attempts 0–10, consumed_at, revoked_at, revoke_kind (`FAILED_ATTEMPTS`, `SUPERSEDED`, `REPLACED_BY_ACTIVATION`).

Constraints:
- UNIQUE(tenant_id, issuer_person_id, request_key) carries same-key replay;
- a partial unique index allows at most one open code per Account (`consumed_at IS NULL AND revoked_at IS NULL`);
- consumption and revocation are each set once, never both;
- a guard trigger permits only `failed_attempts` increments and the single close.

The row is the attributable audit record: issuer, kind, roster reference, reason, request and outcome. It holds no NISN, birth date or plain code. There is no backfill.

## 6. Transaction and lock contract

All coordinators use one caller-owned READ COMMITTED transaction and validated lowercase UUID keys, re-read after waits, and never take an earlier lock after a later one.

1. **Preview (verifier, read only).**
   - Authenticate; resolve the entered ELLIGBLE ID through `findAccountByElligbleId`.
   - Require exactly one effective roster binding in the tenant, inside the verifier's scope: Operator any, Homeroom covering that roster's group and period.
   - Refuse with one bounded `not_found_in_scope` for unknown, foreign-tenant, out-of-scope, unbound, staff, self and never-activated targets.
   - Return only the roster name, rombel label, NISN and birth date for in-person comparison, with the roster revision. No mutation.
2. **Issue (verifier).** Lock order:
   1. `recovery-request:<tenant>:<request-uuid>`;
   2. `roster-tenant:<tenant>` (binding and roster stable);
   3. authenticated session/membership mutation guard;
   4. Operator assignment or Homeroom responsibility FOR SHARE;
   5. sorted `identity_identifier:<username>` and `tenant_membership:<tenant>:<person>`;
   6. Person FOR NO KEY UPDATE;
   7. credential FOR UPDATE;
   8. that Account's open recovery code rows FOR UPDATE.

   After the locks:
   - Same-key replay returns the committed receipt (no code); altered intent refuses 409.
   - Recheck: target binding, scope, expected roster revision, staff exclusion (§6A.1 N1 tables), self-target and credential `is_valid`.
   - Require the Account to have been activated or signed in, which is the negation of the AUTH-002 §6A.2 predicate.
   - Supersede an older open recovery code (revoke_kind `SUPERSEDED`) and insert the new row.
   - Return the code once, with `expiresAt`.
3. **Complete (public).**
   - Validate shape, and check the password policy before any lookup.
   - Lock order: credential FOR UPDATE (username or generated-ID lookup, as `activate()`), then the open recovery code FOR UPDATE, then activation rows, then sessions.
   - Unknown, absent, expired (`now >= expires_at`, evaluated after the locks), consumed or revoked codes answer one constant-work `invalid_recovery`.
   - A wrong code increments `failed_attempts` and revokes at ten (`FAILED_ATTEMPTS`).
   - Success: set the password; consume the code; revoke every open activation row (`revoked_at`) and every other open recovery row; set `is_revoked` on every session of the Account; create one new session; return it as login does.
   - This order is the existing activate and reissue order (credential → activation → sessions), so there is no inverse edge. The existing `activate()` never sees recovery codes.

## 6A. Binding review-correction contract — 2026-11-07

This section corrects the original Independent contract review (§12): STOP, findings F1–F5 plus non-material notes. Where §§5–9 differ, §6A governs. It narrows behaviour and makes it precise, in the fail-closed direction already chosen for AUTH-002 D1; it grants no new role, channel, policy or data.

1. **Other credential writers close an open recovery code (F1).** An administrative reset or activation gives the Account a new credential state, so an older recovery authorization must not survive it (O03 atomic revocation, R3 intent).
   - `issueActivationInTransaction` (provisioning.ts; used by `activation reissue`, `IdentityRuntime.issueActivation` and claim approval) revokes any open recovery code of the Account with `revoke_kind = 'REPLACED_BY_ACTIVATION'`.
   - A successful `activate()`/`activateInTransaction` consumption does the same.
   - Both already hold the credential lock, and the recovery row is locked after it, so no new edge is added.
   - Footprint row 35 (provisioning.ts) is added; index.ts is already row 12.
2. **Completion rechecks the issue-time facts, fail-closed (F2).** Completion runs in a Secure Assessment coordinator (row 14).
   - It pre-resolves the username to the Account, the open recovery code and its tenant without locks.
   - Lock order: `roster-tenant:<tenant>` taken with `pg_try_advisory_xact_lock` (busy answers 429; anonymous traffic never waits on the tenant fence) → the issuer's Operator assignment or Homeroom responsibility FOR SHARE → sorted `identity_identifier:<username>` and `tenant_membership:<tenant>:<person>` taken with `pg_try_advisory_xact_lock` (busy answers the neutral 429, so anonymous traffic never waits on these keys) → Person FOR NO KEY UPDATE → credential FOR UPDATE → recovery code FOR UPDATE → activation rows → sessions.
   - After the locks it refuses unless all of these still hold:
     - the credential is `is_valid`;
     - the Person's effective roster binding in the code's tenant is the code's roster record;
     - the six-table staff exclusion (AUTH-002 §6A.1) still holds;
     - the issuer still holds School Operator authority or a Homeroom responsibility covering that roster record's current group and period.
   - If the open code re-read under lock differs from the pre-resolved one (different id, tenant or issuer), completion refuses without counting and does not retry.
   - A refusal neither consumes nor counts; it answers the same `invalid_recovery`. The code stays open until it expires, is superseded or is replaced. Issuer revocation or a scope change therefore stops completion.
3. **Distinguishable consumed retry (F3, P3 F03).**
   - If the Account has no open recovery code, but the presented code verifies against the Account's most recently consumed recovery row while `now < expires_at` of that row, completion answers 409 `recovery_already_completed`. No session is created and nothing changes.
   - Every other refusal stays `invalid_recovery`. Only the code holder learns the outcome.
   - The check costs the same single verifier comparison as the normal path.
4. **Additional C08 interleavings (F4), each in both orders with pg_locks evidence:**
   - completion against completion with the same code: one success, the other `recovery_already_completed`;
   - completion against issue (supersede);
   - issue against AUTH-002 claim decide, which shares `roster-tenant`, membership keys and the Person lock;
   - completion against claim-bound activation;
   - completion against `activation reissue` (F1 replacement);
   - issuer revocation against completion;
   - completion against granting the target a staff role (`setSchoolOperator` or people import for the target);
   - completion against roster import.
5. **Composition (F5).** "Pemulihan Akun" is its own workspace (`recovery`), shown with the `claimVerifier` capability after "Verifikasi Pendaftaran". `frontend/web/src/__tests__/claimReview.test.tsx` (row 36) updates its workspace-list assertion only.
6. **Non-material precisions applied:**
   - the self-target check runs before the target's membership key and again after all locks;
   - issue replay is disclosed only after the authority recheck;
   - schema coherence:
     - `(revoked_at IS NULL) = (revoke_kind IS NULL)`;
     - `FAILED_ATTEMPTS` only with `failed_attempts = 10`;
     - `failed_attempts` increments by exactly 1 and only while open;
     - `issued_at` defaults to server `statement_timestamp()`;
   - C01 means no business mutation (the session `last_activity_at` bookkeeping is unchanged behaviour);
   - completion clears the login lockout fields exactly as `activate()` does;
   - revoking a claim-issued activation row at completion is later observed by AUTH-002 as `CLOSED_BY_REISSUE`, which is acceptable;
   - C11 renders expiry with a synthetic backdated recovery row inserted by the test through the database, with no fixture change;
   - the new workspace reuses an existing icon from `@/components/icons`;
   - accepted: after a new code is issued, retrying an older consumed code is checked against the new open code and counts as one wrong attempt on it.
7. **Residual risk, recorded and not decided here.** The public completion route uses the general API edge zone (deploy/nginx/elligble.conf `elligble_api` 300 r/s), not `elligble_auth` (10 r/s); deployment configuration is outside this footprint and Owner-reserved. Brute force is bounded by ten failures per code and the twelve-symbol, thirty-one-letter code space.

## 7. API, privacy and UI

| Operation | Transport | Result |
|---|---|---|
| Preview / issue | POST `/api/v1/identity/recovery/authorize`, authenticated scoped verifier. Body exactly `elligbleId`, `confirmed` and, when `confirmed: true`, `expectedRosterRevision`, `reason`, `requestKey`, `inPersonVerified: true` | Preview: minimal comparison fields. Issue: `{elligbleId, recoveryCode, expiresAt, replayed:false}` once; replay `{replayed:true}` without the code. Bounded 400/401/403/404 `not_found_in_scope`/409/503 |
| Complete | POST `/api/v1/identity/recovery/complete`, public. Body exactly `username`, `recoveryCode`, `newPassword` | 200 session and cookie exactly like activation; 400 `password_rejected` with reason; 401 `invalid_recovery`; 409 `recovery_already_completed` (§6A.3); 429 busy (§6A.2); 503. No disclosure of account existence |

- 8 KiB bodies; `Cache-Control: no-store`.
- Existing Origin, CSRF and cookie rules; metrics classified.
- No NISN, birth date or code in logs, metrics, events or URLs.
- Codes use the existing activation-code alphabet and format.

Bahasa Indonesia UI, no em dash, shared primitives only:

- **Verifier workspace "Pemulihan Akun"** (shown with the existing `claimVerifier` capability):
  - ELLIGBLE ID input, then "Periksa";
  - comparison card;
  - a dialog with an in-person confirmation checkbox and reason;
  - a one-time handoff dialog with ELLIGBLE ID, code and expiry. The code is masked in evidence and purged on close, navigation or unmount.
- **Student:** the login screen adds "Lupa kata sandi? Gunakan kode pemulihan dari sekolah", which opens a recovery form (ELLIGBLE ID, code, new password and confirmation) reusing the activation form patterns, and signs in on success.

## 8. Exact proposed file scopes (frozen at READY)

| # | Path | Purpose |
|---|---|---|
| 1 | docs/production/tasks/AUTH-003.md | Contract, history, evidence |
| 2 | docs/production/TASK_PLAN.md | Status, counters, landing record |
| 3 | docs/production/PRODUCTION_COMPLETION_PLAN.md | Status and continuity |
| 4 | docs/DOCUMENT_MANIFEST.md | Index |
| 5 | docs/production/CBT_DOMAIN_RULES_SPECIFICATION.md | Recovery lifecycle pointer |
| 6 | docs/production/ROUTE_INTERACTION_MATRIX.md | F03 pointer |
| 7 | docs/production/CBT_ARCHITECTURE_DELTA_REVIEW.md | 0058 pointer |
| 8 | docs/production/CBT_PERMISSION_MATRIX.md | A09 recovery pointer |
| 9 | docs/production/CBT_UX_SCREEN_AND_INTERACTION_INVENTORY.md | Screens pointer |
| 10 | database/migrations/0058_student_account_recovery.sql | Schema |
| 11 | runtime/identity-access/src/recovery.ts | Identity recovery code APIs |
| 12 | runtime/identity-access/src/index.ts | Recovery completion in the identity runtime (sessions) |
| 13 | runtime/identity-access/test/recovery.test.ts | Units |
| 14 | runtime/secure-assessment/src/recovery.ts | Coordinator |
| 15 | runtime/secure-assessment/src/claims.ts | Export the shared verifier-authority and staff-exclusion helpers (no behaviour change) |
| 16 | runtime/secure-assessment/src/http/recovery-routes.ts | Transport |
| 17 | runtime/secure-assessment/src/server.ts | Route wiring |
| 18 | runtime/secure-assessment/src/metrics.ts | Route classification |
| 19 | runtime/secure-assessment/test/recovery.test.ts | Units |
| 20 | runtime/secure-assessment/test/integration/recovery.test.ts | Real PostgreSQL |
| 21 | runtime/secure-assessment/test/integration/account-activation.test.ts | Activation, reissue and login compatibility |
| 22 | runtime/secure-assessment/test/route-parity.test.ts | New routes |
| 23 | frontend/web/src/api/identity-client.ts | Verifier client |
| 24 | frontend/web/src/api/auth-client.ts | Completion client (signs in) |
| 25 | frontend/web/src/components/AccountRecoveryView.tsx | Verifier screen |
| 26 | frontend/web/src/session/RecoveryForm.tsx | Student form |
| 27 | frontend/web/src/session/SessionScreens.tsx | Entry link and mode |
| 28 | frontend/web/src/session/SessionProvider.tsx | Sign in after recovery |
| 29 | frontend/web/src/session/AppShell.tsx | Workspace entry |
| 30 | frontend/web/src/App.tsx | Composition |
| 31 | frontend/web/src/__tests__/accountRecovery.test.tsx | Verifier UI units |
| 32 | frontend/web/src/__tests__/session.test.tsx | Student form and regression units |
| 33 | e2e/tests/9-identity.spec.ts | Baseline and journey, rendered evidence |
| 34 | runtime/academic-core/src/student-identity.ts | Read helper for the effective bound roster, if needed |
| 35 | runtime/identity-access/src/provisioning.ts | Activation issuance closes an open recovery code (§6A.1) |
| 36 | frontend/web/src/__tests__/claimReview.test.tsx | Workspace-list assertion only (§6A.5) |

Forbidden:
- every other file;
- completed Task records;
- old migrations;
- workflows, lockfiles, dependencies, configuration and secrets;
- shared styles, tokens and primitives;
- global E2E fixtures;
- Student exam logic.

## 9. Acceptance gates (DEFINED / NOT EXECUTED)

| Gate | Oracle |
|---|---|
| C01 | Preview writes nothing; out-of-scope, unknown, foreign, unbound, staff, self and never-activated targets all give one bounded refusal with zero mutation |
| C02 | Issue only by own-tenant Operator or covering Homeroom; plain Teacher, Proctor, wrong rombel, other tenant, revoked or expired authority refused with zero mutation |
| C03 | Issuing changes nothing but the code rows: password, sessions and activation codes untouched; an older open recovery code is superseded |
| C04 | Exactly fifteen minutes; equality boundary; ten wrong codes revoke; replay never extends; no Account lockout |
| C05 | Completion atomically replaces the password, consumes the code, revokes every session, open activation and other recovery code, and signs in; the old password and old sessions fail; the same Person/Account and history are preserved |
| C06 | Same-key issue replay returns the receipt without the code; altered intent 409; a consumed, expired or revoked code cannot complete twice |
| C07 | Failure injected at each stage of issue and completion rolls back exactly |
| C08 | Real PostgreSQL contention in both orders: issue against setSchoolOperator/ensureMembership/people import/allocation/roster import/verifier revocation/session revocation/claim decide; completion against completion/issue/login/activate/reissue/session mutation/claim-bound activation/issuer revocation/target staff grant/roster import; post-wait expiry refuses |
| C09 | Privacy: no NISN, birth date or code in logs, rows or responses beyond the scoped preview; constant-work `invalid_recovery` |
| C10 | 0058 upgrade, rollback and repeat with no backfill; existing activation and claim behaviour unchanged |
| C11 | Five-browser rendered journey (verifier preview, issue and handoff; Student recovery and sign-in; refusal and expiry), seven widths plus 200% text, keyboard dialogs, purge, ≥44 px, no clipping, masked code |
| C12 | Scope inside the frozen allowlist; 33 Tasks and 78 edges; exact-SHA attempt-1 eight-job CI, no re-run |
| C13 | Independent Identity/Security implementation and rendered review PASS by the Owner-designated reviewer; Delegated Acceptance (DEC-048); evidence commit; delegated merge |

**CI-first order:**
1. A registration commit that also carries the AUTH-002 landing record (00.13 §4.5).
2. A capture-only baseline of the login screen and the verifier workspace.
3. Implementation.
4. Independent review.
5. Evidence and merge.

Only typechecks and targeted units run locally.

## 10. READY assessment

Pending only the Independent Identity/Security contract review PASS. All other inputs are present: dependencies DONE, Owner R1–R4 decisions, the reviewer designated, scope, schema, routes, UI, tests and cost (none).

## 11. History

2026-11-07: after AUTH-002 landed, no Task was eligible; the Owner answered the AUTH-003 decision package (R1–R4) and designated the reviewer. The contract was prepared under DEC-048 in the AUTH-003 worktree; not published.

## 12. Independent Identity/Security contract review

**Original review** by the Owner-designated separate read-only fresh-context reviewer, on record SHA-256 95f099081443ec8e516414724314bc7c00ce08d465531b6eaf5e5a8a8de56e36: **STOP, five material findings.**

- **F1:** the `REPLACED_BY_ACTIVATION` revoke kind had no writer, and reissue or activation left an open recovery code alive.
- **F2:** completion rechecked nothing after issue (staff assignment, binding, credential or issuer changes).
- **F3:** a uniform refusal for a consumed code contradicted P3 F03.
- **F4:** C08 lacked completion-vs-completion, completion-vs-issue, issue-vs-claim-decide and completion-vs-claim-bound interleavings.
- **F5:** the AppShell workspace breaks the out-of-footprint `claimReview.test.tsx`.

The executor verified the cited evidence before correcting: provisioning.ts and people.ts writers, ROUTE_INTERACTION_MATRIX.md:48, claimReview.test.tsx:23, deploy/nginx/elligble.conf:25-26/92-110. **Correction:** §6A and footprint rows 35–36.

**Targeted re-review, same reviewer, on SHA-256 3271b1be33d63a0c81b8d78aa2a5b27f3cd2a794bd6475d2ebeee15dc1ece02e: PASS.**
- F1–F5 are CLOSED; no new material defect.
- No §6A choice requires an Owner decision: each follows an approved rule on the fail-closed side (reissue revokes open codes and O03; R2/A09/AUTH-002 D1; P3 F03).
- Non-material precisions applied afterwards:
  - a stale re-read refuses;
  - the roster-tenant fence is taken by try-lock at completion;
  - two more C08 interleavings;
  - the accepted old-code count;
  - the §7/§9 tables are aligned;
  - the icon is reused.

**Independent Identity/Security contract review chain: PASS (STOP → PASS).**

## 13. Formal READY and Build start under DEC-048 — 2026-11-07

- **Eligibility (00.13 §4.1):**
  - The internal dependency AUTH-002 is DONE / MERGED (main 38259da885197ae3d207df3743d98c89d2bed9ac, post-merge CI #144 attempt 1 eight SUCCESS).
  - O03 residuals are decided by the Owner (R1–R4, §4); O09 by the approved P5 A09 boundary.
  - A03 rests on Owner-decided R1–R4 plus the Owner-designated reviewer's contract review chain PASS (§12).
  - No OPEN policy or unapproved architecture input is used, and the Task is not prepare-only.
- **Formal READY: PASS.**
  - Frozen allowlist: exactly the 36 paths of §8. Rows 1–4 are Task-flow paths; rows 5–36 are the implementation allowlist.
  - Migration `database/migrations/0058_student_account_recovery.sql` reserved after rechecking main 38259da885197ae3d207df3743d98c89d2bed9ac: migrations end at 0057 and no 0058 path exists.
  - Expected outcomes are only those in the TASK_PLAN card, §4 and the reviewed §6/§6A/§9.
- **Frozen CI-first order:**
  1. Registration: this record, plus the trackers carrying the AUTH-002 landing record (00.13 §4.5).
  2. A capture-only baseline of the login screen and the verifier workspace in `e2e/tests/9-identity.spec.ts`, with its five artifacts validated before any UI change.
  3. Implementation content.
  4. Independent implementation and rendered review by the same Owner-designated reviewer agent.
  5. Delegated Acceptance and the evidence commit.
  6. CI on the PR head, the delegated squash merge, then post-merge main CI.

  Every content SHA needs automatic attempt-1 eight-job CI. There are no re-runs. Locally only typechecks and targeted units run.
- **Status:** BLOCKED → READY → IN_PROGRESS. Counters: DONE 4, IN_PROGRESS 1, BLOCKED 28. 33 IDs and 78 edges unchanged. PB05 OPEN.

## 14. Implementation candidate — 2026-11-07

- **Registration:** 20bf81b6dd6a4a917c2ea80d4ab49f05d26fdd41, PR #24, CI #145/run 42359969022, attempt 1, eight SUCCESS.
- **Capture-only baseline:** 79911831eceabb66522552b033cd648803ef3e6d changed only the E2E spec (the shared capture routine now takes the Task context). CI #146/run 42360633652, attempt 1, eight SUCCESS.
  - All five workspace-visual artifacts were retrieved, each with 16 AUTH-003 captures (login-entry and verifier-workspace, seven widths plus 200% text).
  - Every capture is phase `before` at the exact commit with frontend tree 2a4f9f399167ac1947e4c2130eae354daf9ad9b3, and the recovery entry is absent (0).
- **Candidate** (within the frozen 36 paths):
  - Identity: 0058, `recovery.ts`, completion in `index.ts`; F1 closure in `provisioning.ts` and on activation.
  - Academic Core: the comparison read.
  - Secure Assessment: the coordinator `recovery.ts`, the F03 routes, wiring and metrics; `claims.ts` exports the shared helpers.
  - Web: `AccountRecoveryView`, `RecoveryForm`, the login entry, provider `recover`, the `recovery` workspace.
  - Tests: units; real PostgreSQL integration for C01–C10 with part of the §6A.4 interleavings and post-wait expiry (completed by correction 1, §15); the after-phase E2E journey with an honest expiry refusal and the masked handoff.
  - Records: P2/P3/P4/P5/P7 pointers.
  - Unchanged in this candidate: rows 21 (account-activation integration) and 34 apart from the comparison read.
- **Engineering details within the contract (00.13 §5.1):**
  - the comparison read returns name, rombel, NISN, birth date and roster revision only;
  - the login footnote now points to in-person verification;
  - the new workspace reuses `IconInfo`.
- **Local checks:**
  - typecheck PASS in all runtime packages, web and e2e;
  - targeted Node units 30/30 (route parity, metrics, server, recovery, claims) and identity recovery 3/3;
  - targeted web units 38/38 (accountRecovery, session, claimReview, designSystemGuard, studentClaim).

  Real PostgreSQL and five-browser evidence come only from CI.
- **Status:** IN_PROGRESS → VERIFYING. Counters: DONE 4, VERIFYING 1, BLOCKED 28.
- **Pending:** exact-content CI, independent implementation and rendered review, Delegated Acceptance, the evidence commit and the merge.

## 15. Implementation CI, independent review and correction 1 — 2026-11-07

- **CI #147/run 42361477459:** exact SHA da32668, push, attempt 1.
  - Web SUCCESS. Runtime FAILURE: real PostgreSQL integration 238/239. Container and the five browser jobs were skipped as dependents.
  - Preserved: no re-run.
  - Cause: the AUTH-003 C01 test took its zero-mutation snapshot before it created the out-of-scope target fixtures and the verifier sign-ins. Those new rows are the whole diff. This is a test-ordering defect; the code under test refused as expected.
- **Independent implementation review, same Owner-designated reviewer, on da32668: STOP, one material finding.**
  - C08 was only partly evidenced, and §14 overstated it.
  - Missing interleavings: issue against `ensureMembership`, people import, allocation, roster import, verifier revocation, session revocation and claim decide; completion against issue (supersede), login, `activate`, session mutation and claim-bound activation; the revocation-first issuer case; the people-import staff grant.
  - The reviewer found no authorization, lock-order, atomicity, privacy or scope defect in the code.
- **Correction 1** (test and record only, rows 20 and 1; bound 1 of 3):
  - The C01 fixtures and sign-ins now precede the snapshot.
  - A new test adds every missing interleaving in both orders on the actual writers, each observed with `pg_blocking_pids`: issue against ensureMembership, allocation, verifier revocation, session revocation, people import, roster import and claim decide; completion against a teacher-grant people import, claim-bound activation, a new issue (supersede), login, legacy `activate`, Student session mutation, and revocation-first issuer revocation.
  - Expected outcomes follow §6/§6A: a wait then serialize; 429 when completion meets a held tenant or identity key; a refusal without counting when scope, staff or issuer rechecks fail; `REPLACED_BY_ACTIVATION` after activate; every session revoked after completion.
  - §14 wording is corrected.
- **Non-material notes recorded:**
  - 0058's roster foreign key couples Identity to an Academic row that is never deleted; issue holds the tenant fence.
  - `issued_at` uses the database clock while expiry uses the application clock (single VPS).
  - Timing and 429 reveal that a recovery is in progress for a username (bounded residual).
  - An old code counts against a newer open code.
  - Completion lists memberships after COMMIT, as activation does, so the F3 409 retry covers a 503.

## 16. Final evidence and Delegated Acceptance — 2026-11-07

### 16.1 Content and CI

**Final content:** 5003176256a3364d22af438a77db48ea18c456ca.

**Commits** on task/auth-003-in-person-recovery (PR #24):

| Commit | Content |
|---|---|
| 20bf81b | registration plus the AUTH-002 landing record |
| 7991183 | capture-only baseline |
| da32668 | implementation |
| 5003176 | correction 1 |

Every commit has the Owner author and committer and a raw message without trailers or AI/tool attribution.

**Exact-content CI:** CI #148/run 42362508728, push, attempt 1, eight jobs SUCCESS on ubuntu-24.04.
- Runtime units: identity-access 34, tenant-access 14, academic-core 11, Secure Assessment 918; all pass.
- Real PostgreSQL 16 integration: 240/240, none failing.
- Web job: typecheck, tests and build.
- Container image build and smoke test.
- E2E: 28/28 in each of mobile-360, tablet-768, desktop-1280, firefox-1280 and webkit-390. That includes the AUTH-003 after-phase journey (scoped issue, one-time handoff, an honest expiry refusal, Student recovery and sign-in) and the existing journeys.

**Artifacts:** all five retrieved; 66 AUTH-003 captures per project (330), all phase `after` at the exact commit and tree, with no page overflow, no target under 44 px, no clipped dialog value, and all 45 handoff captures masked.

**All runs, preserved without re-run:**

| Run | Head | Result |
|---|---|---|
| #145 | 20bf81b | SUCCESS |
| #146 | 7991183 | SUCCESS (baseline artifacts validated) |
| #147 | da32668 | Runtime FAILURE, the test-ordering defect of §15 |
| #148 | 5003176 | SUCCESS |

### 16.2 Independent review (Owner-designated read-only fresh-context reviewer)

1. Contract: STOP (F1–F5), then PASS (§12).
2. Implementation on da32668: STOP (C08 evidence), then targeted re-review on 5003176: PASS.
3. Rendered evidence on CI #148: PASS.

The reviewer inspected the actual images: shared primitives only, Bahasa Indonesia without em dash, honest states, the masked code, nothing clipped, and targets of at least 44 px. Every STOP was closed by the same reviewer; no reviewer was replaced.

**Rendered-review notes, recorded and not blocking:**
- Most narrow `recovery-empty` captures show the lazy-load "Memuat halaman..." state. The empty form is evidenced at 200% text and at 1280 and wider, and in every `recovery-compare` capture; future captures should wait for the card.
- At 200% text, Button, link and some dialog text do not scale. This is pre-existing in the shared primitives.
- The bordered list-item pattern now has three copies.

Both of the last two items are UI-SYSTEM follow-ups, outside this Task.

### 16.3 Acceptance gates

| Gate | Disposition |
|---|---|
| C01 | PASS: preview and every out-of-scope, unknown, foreign, unbound, staff, self and never-activated target give one bounded refusal with zero business mutation |
| C02 | PASS: Operator and covering Homeroom only; wrong rombel, plain Teacher, anonymous, verifier revocation and session revocation refused |
| C03 | PASS: issuing changes only recovery rows; an older code is superseded |
| C04 | PASS: fifteen minutes exactly; equality boundary; ten failures revoke; no lockout |
| C05 | PASS: completion replaces the password, revokes sessions and open activation and recovery codes, and signs in; old password and sessions fail; same Account |
| C06 | PASS: issue replay without the code; altered intent 409; 409 `recovery_already_completed` retry; a consumed or revoked code cannot complete |
| C07 | PASS: failure injection at issue insert and completion session insert rolls back exactly |
| C08 | PASS: every §6A.4 interleaving on the actual writers in both orders (§15), plus post-wait expiry |
| C09 | PASS: verification-only projection; no NISN, birth date or code in rows or responses beyond the scoped preview; constant-work refusal |
| C10 | PASS: 0058 rollback, repeat and no backfill; F1 closure on activation issuance and consumption; claim and activation behaviour unchanged |
| C11 | PASS: five-browser rendered journey, keyboard dialog containment, purge, masked code, ≥44 px, no clipping |
| C12 | PASS: 35 of 36 frozen paths; 33 Tasks and 78 edges unchanged; exact-content attempt-1 CI with no re-run |
| C13 | PASS: review chains PASS; Delegated Acceptance below |

### 16.4 Delegated Acceptance (DEC-048, 00.13 §5.4)

Every gate C01–C13 has PASSED with recorded evidence. The independent review PASSED on the final content SHA, including the rendered evidence. AUTH-003 is accepted under DEC-048 and is DONE under 00.12 §5. The Owner may reopen it at any time.

**Residual risks:**
- the completion route uses the general API edge zone (deployment configuration is Owner-reserved);
- timing or a 429 reveals that a recovery is in progress for a username;
- `issued_at` uses the database clock while expiry uses the application clock (single VPS);
- the 0058 roster foreign key couples Identity to an Academic row that is never deleted;
- a plain staff membership with no assignment row cannot be told apart from a Student.

**Boundaries:** PB05 OPEN; G7 before real data; no deployment or release claim.

**Landing:** delegated squash merge of PR #24 under 00.13 §6 after PR-head CI (this evidence commit) shows eight SUCCESS on attempt 1. The landing is recorded by the next Task's first change, with DONE 5/33 (15.15%), VERIFYING 0, BLOCKED 28.
