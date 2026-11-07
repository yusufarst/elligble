# AUTH-002 — Student Claim and Scoped Verification/Activation

## 1. Control state and authority

| Field | Preparation disposition |
|---|---|
| Classification | Existing active P11 Task; P0 identity journey; HIGH risk; R08/R09, P3 F02, P5 A09, P8 V01/V11/V12 |
| Status | **VERIFYING — capture-only baseline PASS (§13.1); implementation candidate published for exact-content CI and independent implementation review (§13); DEC-048** |
| Objective | Student submits a non-trusted registration claim; an explicitly scoped school verifier resolves it against the current official roster, then the same authoritative Person/canonical Account reaches explicit Student-controlled activation without duplicate identities or lost history |
| Owner authorization | 2026-11-04: documentation preparation and SEC-001/AUTH-001/ADMIN-001 tracker reconciliation only. 2026-11-07 (Owner in chat, executor handoff): continue AUTH-002 contract finalization in the same four documentation paths, explicit D1/D2/D3 approval (§4.1) and a separate read-only Independent HIGH-risk Identity/Security contract review. Still no commit, push, PR, CI execution, production code, migration reservation/execution or Build |
| Baseline | Preparation base 056a154d4ae2eb9c5a7c7923c6737496f396990d. Execution base main/origin/main 5d0672f3c73ea4754a17d64316a876c5a5a7e3a5 (GOV-EXEC-001 landing, §12.1) |
| Internal dependency | ADMIN-001 DONE / MERGED. Reuse completed SEC-001 and AUTH-001; no reopening of their contracts/reviews |
| Branch | task/auth-002-student-claim-verification from 5d0672f3c73ea4754a17d64316a876c5a5a7e3a5, worktree `C:\Projects\ELLIGBLE-auth-002`; the four preparation documents were carried over unchanged in content (§12.1) |
| Responsible parties | Owner approved D1–D3 (§4.1) and separately authorizes publication/Build. Owner designated a separate read-only fresh-context reviewer agent (same model family; context-independent, not organizationally independent) as Independent Identity/Security contract reviewer for this Task; no review PASS is inferred from predecessor reviews |
| Parallel safe / cost | NO parallel baseline Task execution. Existing Node/React/PostgreSQL/CI, no new dependency/vendor/service or recurring cost proposed |

Authority: [DEC-044 §5/OD-05/OD-06/OD-07](../../00-governance/00.11_CBT_RELEASE_SCOPE_REALIGNMENT.md), [DEC-045 §4–§7](../../00-governance/00.12_AICWDF_ADOPTION_AND_TASK_EXECUTION.md), [decision hierarchy](../../00-governance/00.02_DECISION_HIERARCHY.md), [domain ownership](../../00-governance/00.07_DOMAIN_OWNERSHIP_AND_CONTRACTS.md), [TASK_PLAN AUTH-002/§4/§8](../TASK_PLAN.md), [P2 §4](../CBT_DOMAIN_RULES_SPECIFICATION.md), [P3 F02](../ROUTE_INTERACTION_MATRIX.md), [P4 A03](../CBT_ARCHITECTURE_DELTA_REVIEW.md), [P5 A09/§5.5](../CBT_PERMISSION_MATRIX.md), [GOV-POLICY-001 §7](GOV-POLICY-001.md), [AUTH-001 §4–§8/§13](AUTH-001.md), [ADMIN-001 §14](ADMIN-001.md). These remain authoritative; this candidate approves no excluded C capability or LOCKED supersession.

## 2. Verified predecessor landing and local reconciliation

[PR #21](https://github.com/yusufarst/elligble/pull/21) squash MERGED as main **056a154d4ae2eb9c5a7c7923c6737496f396990d**, matching evidence tree ad3cbbba1daa8a00bdb44e3b0951eec93fab0aa4. ADMIN-001 accepted implementation 3df5b32243245bfa5b2203be16b2aa5fe164fce9, CI #129/run 41684459058 attempt 1 eight SUCCESS; original independent actual-source review STOP C11 only, corrected/targeted C11 PASS, Owner Acceptance 2026-11-04, final evidence 3baa7de40c494fe6f3f815f515072b216ed89412. Completed record/history is unchanged.

[Post-merge CI #131/run 41824758308](https://github.com/yusufarst/elligble/actions/runs/41824758308): exact main above, automatic push, attempt 1, all eight individual jobs SUCCESS on ubuntu-24.04. Web 356/356; Secure Assessment units 912/912; PostgreSQL 224/224; image/smoke PASS; each of mobile-360/tablet-768/desktop-1280/firefox-1280/webkit-390 24/24 PASS. These are predecessor results, not AUTH-002 test results.

Authorized local tracker/plan reconciliation: **DONE 3/33 (9.09%), BLOCKED 30 including AUTH-002; READY/IN_PROGRESS/VERIFYING/TODO/SUPERSEDED 0**. Exactly 33 Task IDs, 78 internal dependency edges, DAG and R01–R31/G1–G10 traceability retained. No new baseline Task, predecessor evidence commit or automatic successor READY. These edits are unpublished until separately authorized.

## 3. Actual-source reuse and bounded gaps

- Identity `student-identity.ts`/0055 already provide canonical Person→Account binding, global non-reused generated IDs, atomic legacy credential INSERT compatibility, reservation and allocation/replay. The reservation API explicitly is **not** a public claim. Do not treat an untrusted matching tuple as Person authority.
- Identity `index.ts`/`provisioning.ts`/0039 already provide activation-required credentials, single-use code issuance, Student-set password and sessions. Existing activation locks credential then activation; existing login/reissue/session lock ordering and policy must remain compatible. Existing card activation works without a claim and must remain unchanged.
- Academic Core `roster-import.ts`/0056 own official roster, revision history and full-file atomic import. Records include immutable tenant/source key and an immutable nullable person_id. The record trigger forbids changing person_id: **do not disable it or rewrite 0056 to bind a claim**. New owning binding contract/read-model integration is proposed below.
- Tenant Access owns Membership and explicit School Operator assignments with audited privileged CLI bootstrap. No Homeroom assignment persistence/guard or public claim/review route exists in the merged runtime. A Teacher/staff label is not Homeroom authority.
- Shared `enrollmentSlotKey` canonicalizes tenant/membership/period UUIDs and protects existing and empty slots. Roster confirm holds roster-request→roster-tenant→authenticated session/membership→Operator→sorted try-lock enrollment slots→Academic rows. Reuse it; do not introduce a different enrollment namespace.
- Existing SessionScreens/ActivationForm, shared form/Dialog/Alert/Button/Page primitives and role-aware shell are reusable. Claim UI is not a new theme; DEC-039/043/047 and cosmetic deferral remain in force.

In scope: one synthetic/public claim entry, scoped verifier queue/detail and reasoned decision, owning identity resolution/binding and activation authorization, explicit Homeroom assignment/bootstrap, one migration proposal, atomic audit/replay, minimal functional UI and security/concurrency/rendered evidence.

Excluded: AUTH-003 password reset/recovery, Person merge/reassignment, replacement Account, arbitrary global account search, contacts/email/SMS/OTP notification infrastructure, proof-document upload, new retention/deletion policy or background job, general staff/student directory/export, roster correction/import redesign, enrollment transfer, exam/Attempt/answer/timer/session/takeover/submission/result changes, new dependencies/tokens/shared styling, real data, deployment and PB closure.

## 4. Settled inputs and consolidated remaining decision package

**Do not reopen:** O01 format elg-xxxx-xxxx-xxxx, alphabet abcdefghjkmnpqrstuvwxyz23456789, global uniqueness/non-reuse and legacy compatibility; O03 claim **seven days from server creation**, expiry at now >= expires_at, **maximum ten failed attempts**, no lifetime extension by replay; A03 one canonical Account per authoritatively resolved Person across roles. Existing reset fifteen minutes belongs to AUTH-003; existing card activation/login/session/MFA policy is unchanged. NISN + date of birth match with name confirmation, ambiguous manual review, own-rombel Homeroom/own-tenant Operator and R/C/A audit are already authoritative, not new policy questions.

The table below is the 2026-11-04 preparation package, preserved as history. The Owner selected the recommended default for each of D1, D2 and D3 on 2026-11-07; the alternatives were not selected. The binding decision text is §4.1. Technical names/schema/lock details may be refined within the approved boundaries after independent review, but no unresolved policy is inferred.

| Input | Recommended bounded default | Alternative / risk / required disposition |
|---|---|---|
| D1 — verification proof and activation handoff (O03/O09) | Scoped verifier checks NISN/date of birth plus name against the live roster and confirms the Student directly at school; record only method/actor/roster revision/reason, no proof image/document or password. After approval, use controlled school handoff of the existing single-use activation-card mechanism; Student alone sets password. No automated notification or new contact channel | Alternative remote proof/digital notification needs an independently specified channel, delivery and abuse contract, extra scope/cost review. Matching public attributes alone is not proof of the human. Owner must accept the precise verification/handoff method; no new proof or notification rule is already approved |
| D2 — authoritative Person resolution and first binding (A03/O09) | Reuse a consistent existing roster/Person binding. Otherwise explicit verifier adjudication must distinguish an authenticated existing-Account continuity proof from an expressly reviewed new-identity case; unknown/conflicting/ambiguous cases remain REVIEW_REQUIRED. Existing active Account goes to existing login or later AUTH-003, never password overwrite/reissue/new Account. No global staff lookup or NISN-as-global-identity inference | Alternative restrict this iteration to already-resolved Persons would leave new unbound-roster registration undelivered. New Person creation must be explicitly authorized as a reviewed outcome, never inferred merely from a null binding or absent own-tenant match. Owner/domain/Security must approve this bounded resolution contract and acceptable continuity proof. No merge/transfer adjudication feature is proposed |
| D3 — claim failure/replacement lifecycle (O03) | Define failed proof/capability-verification attempts as serialized failures on the same claim, capped at ten; successful transport replay does not increment. An open resolved identity/roster reservation cannot be bypassed by another request key. Expiry/exhaustion/rejection prevents activation; only a fresh governed claim after terminal closure may proceed, without extending/reviving the old claim. Never lock or reset an existing Account because an anonymous claim failed | Alternative per-IP/per-roster permanent lockout risks shared-school-NAT denial or account-targeting abuse. Exact failed-event definition and authorized stale/abandoned-claim disposition need Owner/Security acceptance. Existing edge limits are reused, not silently replaced with new numeric rate budgets |

Privacy/retention boundary: no new raw proof documents or contact attributes. Minimize protected claim matching inputs and keep them out of audit/log/cache/URLs. Seven-day authorization expiry is **not** approval to retain or delete personal/audit data for seven days. Retention/purge schedule, lawful basis and notification obligations remain qualified privacy/legal inputs under O03/G7 before real-data use; do not invent a period or claim PB closure. Synthetic implementation may proceed only after review confirms its bounded storage contract does not depend on an unresolved mandatory retention action. If such an action is necessary to deliver AUTH-002, it becomes a material READY blocker, not a waived release note.

### 4.1 Owner-approved decisions — 2026-11-07

Owner explicitly approved, in chat on 2026-11-07, the recommended default of each decision below. This approval settles policy for this Task only; it is not a contract-review PASS, READY, publication or Build authority, and it changes no LOCKED decision, O01/O03/A03/P5 value, PB05 or G7.

- **D1 — in-person verification and existing activation-card handoff: APPROVED.** An authorized scoped verifier (assigned own-current-rombel Homeroom or own-tenant School Operator) checks submitted NISN/date of birth and name against the current official roster and confirms the Student in person at school. Only method, actor, roster revision, decision and reason are recorded; no proof image/document upload, no password, no new contact attribute, no automated notification channel. Handoff reuses the existing single-use activation-code mechanism (`issueActivationInTransaction`, existing card format and `ACTIVATION_POLICY` validity/ten wrong-code limits, unchanged) for an approved canonical Account that has no usable password: the code is issued inside the approval transaction with `unusableVerifier: null`, disclosed once to the authenticated verifier for in-person handoff, and only its verifier hash is persisted. A same-key replay after a lost ACK returns the committed minimal receipt without re-disclosing the code; a lost or unreceived code is re-handed off only through the existing audited `activation reissue` authority, unchanged. Claim-bound activation additionally refuses at/after the claim's `expires_at` and on roster/binding/scope change, for whichever current code the Account holds. An Account with a usable password is never issued a code, reset or given sessions revoked by this Task; the Student uses existing login, or later AUTH-003.
- **D2 — explicit adjudication of Person resolution: APPROVED.** A consistent existing roster `person_id` or effective binding is reused. For an unbound roster identity the verifier must record one explicit outcome: existing-Account continuity (the candidate Person is already reachable through own-tenant authoritative data and confirmed in person), or a reviewed new identity (new Person and canonical Account through the existing AUTH-001 allocation only, with a mandatory reason, and only when no own-tenant binding/membership candidate exists). A new Person is never inferred from a null binding or an absent match. Unknown, conflicting or ambiguous cases stay REVIEW_REQUIRED; there is no automatic transition to approval, no global staff/Student lookup, no NISN-as-global-identity inference, no merge, reassignment or enrollment transfer.
- **D3 — failure counting: APPROVED.** The O03 seven-day server lifetime (expired at `now >= expires_at`) and maximum of ten failures are unchanged. Counted: only a substantive server-side verification failure on the same existing open claim, i.e. a wrong claim capability or wrong claim-bound proof/activation secret, recorded serially under that claim's row lock. Not counted: syntax-invalid requests (400), overload (429), persistence failure (503), same-key replay of a committed intent, verifier authorization denial, and a verifier's reasoned REJECTED decision (which is terminal on its own). Replay never extends the lifetime or resets the count. Expiry, exhaustion and rejection prevent activation; a new claim may be admitted only after the prior open claim for the same official identity is terminally closed, and never revives or extends it. No per-IP, per-roster or per-Account lockout is introduced, no existing Account is locked or reset by anonymous claim failures, and existing edge limits are reused without new numeric budgets.

## 5. Candidate ownership, schema and state transitions

**Migration proposal only:** `database/migrations/0057_student_claim_verification.sql`. At verified main, migrations end at 0056 and 0057 is unused. It is **not reserved, authored or executed** by preparation. Recheck collision and explicitly approve its exact path/schema before READY.

- Identity owns `identity_student_claims`: opaque UUID, server-bound requested tenant, protected minimal submitted matching/name fields only where required for unresolved review, creation/expiry, failed count 0–10, revision, candidate roster reference/revision, eventual authoritatively resolved Person, explicit state and closed time. Public inputs never establish trusted Person/Account/Membership. No claim capability is persisted (§6A.4); submit replay derives from the request UUID plus payload digest and discloses only the uniform receipt; the failed count is the claim-issued code's existing counter (§6A.5). Use existing crypto primitives and Node crypto, no new secret service.
- Proposed states: RECEIVED→PENDING_REVIEW or REVIEW_REQUIRED; scoped decision→APPROVED_PENDING_ACTIVATION or REJECTED; valid Student activation→ACTIVATED; server expiry/ten failures→EXPIRED/EXHAUSTED; explicit permitted closure→CANCELLED. No automatic ambiguous→approved transition. Claim submission and approval alone create no usable password or authenticated Student session. Terminal transitions/history are immutable, with optimistic revision and atomic receipt.
- Persistence must enforce at most one open duplicate-producing claim per tenant/official roster identity and, once resolved, per canonical Person across tenants. Unmatched claims must not manufacture Person UUIDs. Apply guarded row/partial-unique constraints and shared owner-controlled reservation protocol; admission of a resolved public claim must not close/bypass AUTH-001 reservations. Allocation's existing reservation-closing behavior must be composed with the claim state machine and tested, not assumed sufficient.
- Identity owns append-only claim decision/events and mutation receipts: tenant, actual actor, claim/revision, reason, authority reference, operation/digest/key, outcome/time; no raw proof/NISN/date of birth/password/capability secret in generic audit. Same-key/reason/payload replay yields the same minimal committed receipt after current authority; altered intent refuses.
- Academic Core owns proposed append-only `academic_core_roster_identity_bindings`: tenant/roster identity→Person with coherent FK, unique roster binding and unique own-tenant Person binding, authoritative decision provenance and immutable identity. Preserve 0056 person_id and all historical import receipts/revisions. Owning read APIs resolve existing person_id and the new binding consistently, rejecting disagreement; roster preview/confirm must use this effective binding so future corrections still check the same Person's enrollment. No uncoordinated shadow truth.
- Academic Core owns current roster matching/revision and group/period checks; it alone binds roster and ensures compatible enrollment through existing `ensureStudentEnrollment`. Tenant Access alone ensures/reuses an unambiguous membership. No automatic group move or adoption of ambiguous existing memberships. These writes occur only in one approved verifier transaction after D2 adjudication, not public submission.
- Academic Core owns explicit Homeroom responsibility under 00.07 and D03.4-21–24, not Tenant Access. Proposed academic_core_homeroom_responsibilities/events bind a Tenant-owned membership to a coherent own-tenant group/year/period with explicit start/end/revocation, active uniqueness per membership/scope and append-only history. Evaluate effective time after waits; ending a responsibility never changes Student enrollment. Tenant Access supplies current authenticated membership through its owning API; the coordinator composes Academic responsibility or existing Tenant-owned School Operator authority. No implicit Teacher role or universal staff power. Reuse the trusted existing CLI administration pattern with named operator/case/reason and owning APIs, no self-grant or role-management product UI. No new policy granting multiple Homeroom roles is inferred.
- New schema is empty at adoption; no fuzzy match/backfill, Person reassignment, credential rename or old-card reinterpretation. Empty/0056 upgrade/repeat/constraint/transaction-rollback tests required. Keep prior migrations immutable.

## 6. Candidate transaction, locking and replay contract

Lock order, submit behavior, allocation placement and activation composition in this section are superseded by §6A wherever they differ. All mutation coordinators use one caller-owned READ COMMITTED PostgreSQL transaction and owning APIs. UUIDs are validated and canonicalized lowercase before advisory keys/lookup/replay. No session/actor/role/Person/approval timestamp from caller payload becomes authority. Re-read after waits and check authoritative time immediately before effect and replay disclosure.

1. Public submission: validate bounded fields and existing Origin/body/edge protections; server treats tenant as untrusted locator. Resolve only Academic-owned matching information internally. Acquire deterministic claim request/admission locks, then the same `roster-tenant:<tenant>` fence as import where matching/reservation state is committed; persist only a non-trusted claim/receipt. Preserve roster/history/Account/Person/session with zero mutation. Uniform outward acknowledgement must not expose matched/unknown/ambiguous/active-account status.
2. Verifier mutation: claim request namespace→`roster-tenant:<tenant>`→existing authenticated session/account/membership mutation guard→explicit Operator or Homeroom assignment locks→claim/reservation→Identity allocation namespace→authoritatively resolved Person→canonical Account/credential/activation as applicable. Resolve Academic locators without treating an unlocked read as authority; final Academic reference/binding row locks follow the enrollment fence in step 3. Preserve existing allocation namespace-before-Person and credential-before-activation order. Do not call allocation under an already held Person lock if that would invert the existing allocator. Newly created Persons and all owning effects remain in this same transaction; an existing active Account is not a password-reset target.
3. Enrollment/reference protection: acquire canonical `enrollmentSlotKey` for all affected existing/initially empty slots, sorted and using nonblocking acquisition where a legacy writer could form a cycle. Hold all locks to COMMIT/ROLLBACK, re-read membership/group/enrollment/roster revision and authority after acquisition. Refuse busy/stale/ambiguous state atomically; do not auto-retry the transaction or silently re-match to another roster row.
4. Approval atomically records Identity resolution/reservation/activation authorization, Academic binding/compatible enrollment, Tenant membership and attributable outcome. Full rollback on any owning-domain/audit failure. A current active Account is never reset or replaced by this Task; an unknown global identity remains unresolved, not a new-Person fallback.
5. Activation consumes only a valid approved, unexpired claim authorization bound to the same roster revision/Person/canonical Account and the genuine existing activation secret; Student chooses password. Recheck current roster and approved scope immediately before consumption. A claim-bound extension to existing activation must acquire its admission/roster/reservation locks before the existing credential→activation locks, or use explicit nonblocking refusal to avoid an inverse wait. A prior unlocked classification is not authority: revalidate binding after locks. Legacy non-claim cards keep their current semantics. Do not call an independently committing runtime transaction inside the coordinator.
6. Candidate key/row contracts: a claim request namespace is `claim-request:<tenant>:<request-uuid>` (§6A.3); admission is `claim-roster:<tenant>:<roster-uuid>` for resolved own-tenant candidates; authoritative Person reservation uses the existing Identity Person lock, never a NISN-based global key. Keep raw matching values/secrets out of advisory labels and logs. Each claim row is FOR UPDATE for transition; required verifier assignment is FOR SHARE; roster import's exact tenant fence is reused. A new binding is protected by the same tenant fence plus its unique/FK constraints. Enrollment slots use exactly the existing canonical helper, sorted, with try-lock refusal before Academic row locks. After acquiring slots, re-read enrollment and take Academic references FOR SHARE/effective binding and relevant roster rows FOR UPDATE in sorted UUID order. No per-claim lock can substitute for a missing-slot fence or current authority.
7. Claim-bound activation pre-resolves its immutable Account→claim relation, then takes claim admission/roster fences and claim/Person guards before the existing credential→activation locks. If an added guard must be acquired after an existing credential lock, it is nonblocking (try-advisory/row NOWAIT) and failure rolls back without consuming the code/changing password/creating a session. Recheck classification, authoritative time and current roster after locks. Claim expiry bounds claim-bound activation even when an existing-format card was issued later; it does not modify ordinary card validity. Do not reuse or invalidate an existing active Account's password to complete a claim.
8. Writer matrix for independent contract review: public submit/duplicate/expiry serialize on admission/claim rows; approve/reject share those locks and verifier assignment guards; import and binding share roster-tenant; enrollment creation shares enrollmentSlotKey including absent rows; allocation/legacy INSERT preserve existing namespace/Person/registry order; authentication/card reissue retain credential-first behavior; session mutation retains its owning session/account lock. New claim code must never add a blocking reverse edge to those existing writers. C09 requires both orders of each actual interleaving, including verifier-as-Student/self-target rejection and post-wait expiry. The candidate is **not a completed locking review**; unresolved actual function-level inversion blocks freeze, and real PostgreSQL evidence is produced during Build.

Atomic identity binding/approval must be independently reviewed before READY. Real database contention evidence is produced during Build, not demanded before implementing it. Tests must use actual writers with controlled transactions/pg_locks/pg_blocking_pids, not sleeps, mocks or transaction retry to hide deadlocks.

## 6A. Binding review-correction contract — 2026-11-07

Corrects the six material findings M1–M6 of the original independent contract review (§10.1) within Owner-approved D1–D3. Where earlier text in §§4.1, 5, 6, 7 or 9 conflicts, this section governs. It narrows or makes precise; it grants no new policy, role, channel or data.

1. **Continuity and new-identity adjudication (M1).** The decision request carries exactly one adjudication:
   - `EXISTING_BINDING`: the roster record already has a 0056 `person_id` or an effective Academic binding; no selector input is accepted.
   - `EXISTING_ACCOUNT_CONTINUITY`: the verifier enters the Student's existing ELLIGBLE ID, shown in person (card or Student statement); the server resolves it only through the existing Identity lookup (`findAccountByElligbleId`). Eligibility, all evaluated again after the §6A.3 locks: the Account and its canonical credential exist and `is_valid`; the Person has exactly one membership in the same tenant (`findMembership`; memberships carry no kind, so this alone does not establish a Student); the Person is not the verifier's own Person; the Person is not bound (0056 or new binding) to any other roster record of the tenant; no other open claim exists for the Person; enrollment compatibility follows existing `ensureStudentEnrollment` rules. Any failure returns REVIEW_REQUIRED with zero mutation. An unknown, foreign-tenant or ambiguous ID gives the same bounded refusal and never discloses another school's data.
   - **Fail-closed staff-role exclusion (N1), applied to every adjudication before any binding or code issuance:** REVIEW_REQUIRED with zero mutation if the candidate Person has, in any tenant and in any state (active, ended or revoked), any row in `tenant_teacher_assignments`, `tenant_school_operator_assignments`, `academic_core_teaching_assignments`, the new Academic Homeroom responsibilities, `secure_assessment_proctor_assignments` or `secure_assessment_exam_proctor_room_assignments`. Each check goes through its owning domain's read API and is evaluated after the §6A.3 `tenant_membership`/Person locks (same-tenant people import and `setSchoolOperator` take `tenant_membership` first, so only those same-tenant writes are serialized; grants in other tenants and Secure Assessment proctor grants are not, and fall under the residual below). This prevents a verifier from obtaining a code for a never-activated staff, Teacher, Proctor or Operator Account. Residual risk: a plain staff membership with no assignment row cannot be distinguished from a Student and relies on in-person verification and audit; a role granted to the Person later is a separate authorized act outside this Task.
   - `NEW_IDENTITY_REVIEWED`: permitted only when the roster record has no binding; the verifier records an explicit attestation that, after asking the Student in person, no existing ELLIGBLE Account is known, plus a mandatory reason. Identity creates a bare Person (`identity_persons` row, new Identity-owned function in path 11) in the same transaction, then composes the existing AUTH-001 allocation for that Person under the authenticated verifier as actor. Anonymous submission never creates a Person, reservation or allocation.
   - **Honest residual risk (accepted by D2):** the system cannot detect an already-provisioned legacy Student whose Account is not linked to the roster record; `NEW_IDENTITY_REVIEWED` therefore relies on the recorded in-person attestation, R/C/A audit and the UI prompt to ask for an existing card. No global or own-tenant directory search is added to compensate; Person merge remains excluded.
2. **Deterministic "no usable password" predicate (M2).** Code issuance under D1 is allowed only for a never-activated Account: canonical credential `is_valid`, `last_successful_login_at IS NULL`, and no `identity_account_activations` row with `consumed_at IS NOT NULL` for that Account. This is fail-closed: an Account that was ever activated or signed in is treated as having a usable password even if later administratively reset, and receives no claim-issued code (the claim ends `APPROVED_EXISTING_ACCOUNT`; re-handoff stays with the existing audited `activation reissue`). The predicate is evaluated only after the approval's credential `FOR UPDATE`, so a concurrent legacy `activate()` either commits first and is seen, or waits. No new password-state column or backfill is needed.
3. **One total lock order (M3).** Every claim writer acquires only an ordered subsequence of this sequence and never acquires an earlier item after a later one. All advisory keys use validated, canonical lowercase tenant/person/roster UUIDs, matching existing `tenant_membership` keys:
   `claim-request:<tenant>:<request-uuid>` → `claim-roster:<tenant>:<roster-uuid>` → `roster-tenant:<tenant>` → existing authenticated session/account/membership guard → Operator assignment or Homeroom responsibility `FOR SHARE` → claim row `FOR UPDATE` → `identity_identifier:<id>` and `tenant_membership:<tenant>:<person>` advisory keys, sorted together lexicographically exactly as people import does → existing AUTH-001 allocation composed unchanged (its per-actor/request namespace key, already serialized by `claim-request`, then its Person lock) → Person `FOR NO KEY UPDATE` (including reservation-trigger Person locks) → credential `FOR UPDATE` → activation rows → sorted `enrollmentSlotKey` try-locks → Academic reference/binding `FOR SHARE` and roster rows `FOR UPDATE` in sorted UUID order.
   - Submit: `claim-request` blocking, then `claim-roster` by `pg_try_advisory_xact_lock` (busy returns the neutral 429), then, only if an open claim exists for the same roster identity, that claim row `FOR UPDATE` as a lazy observer (§6A.5): it records `EXPIRED` when `now >= expires_at` (revoking the claim-issued code, taking credential then activation row locks in the total order) or an already-reached `EXHAUSTED`/`CLOSED_BY_REISSUE`; a new claim is admitted only after such an observed terminal state, and an unexpired open claim keeps the new submission refused behind the uniform 202. Matched, unmatched and prior-claim submit paths use the existing constant-work pattern so timing reveals neither a roster match nor a prior claim. Submit takes neither `roster-tenant` nor any other later item; it reads the roster without the fence because it confers no trust, and the open-claim partial unique index enforces duplicates. Anonymous traffic therefore cannot stall roster import or decisions on the tenant fence.
   - Decide: the full sequence; `ensureMembership` re-entering its already-held `tenant_membership` key is required, not an extra edge.
   - Claim-bound activation: `claim-roster` → `roster-tenant` → claim row → credential → activation (§6A.6).
   - Writer matrix §6 item 8 and C09 additionally cover people import (identifier/membership advisory → Person), `ensureMembership` and `setSchoolOperator`, in both interleaving orders against decide and claim-bound activation.
4. **No claim capability (M4).** The bearer claim capability is removed. A09 "own minimal status" is delivered as: the uniform 202 submission receipt, status given in person by the verifier under D1, and the activation result itself. No status/polling endpoint, no capability verifier column and no capability-keyed request namespace; the submit request namespace is the request UUID in §6A.3 with digest replay. D3's counted failures therefore have only one operand: wrong codes against the claim-issued activation code (§6A.5). `CANCELLED` is performed only by an authorized scoped verifier with a mandatory reason, using the decision route.
5. **Claim-bound activation guard lifecycle (M5).** Identity records the issued activation row in an Identity-owned unique relation (claim ↔ activation row, in 0057). The guard applies only to that specific code row and only while the claim is `APPROVED_PENDING_ACTIVATION`; every other code of the Account, including any later `activation reissue` card, keeps ordinary semantics. Failure counting is the existing per-code `ACTIVATION_POLICY` counter of that row (ten wrong codes revoke it), which is the claim's failed count; no second counter. Every claim-driven revocation (submit observation, `EXPIRED`) targets only the claim-issued row by id through the 0057 relation, and only while that row is still open and unconsumed; it never uses `issueActivationInTransaction`'s account-wide revoke, so an anonymous submit can never revoke an ordinary reissue card. Transitions, all under the claim row lock: consumption of that row → `ACTIVATED`; its revocation by wrong codes → `EXHAUSTED`; observation at `now >= expires_at` → `EXPIRED` and the claim-issued row is revoked in the same transaction; revocation by an ordinary reissue → `CLOSED_BY_REISSUE`. Because existing reissue is unchanged and takes no claim lock, `EXHAUSTED` and `CLOSED_BY_REISSUE` are recorded lazily by the next observer holding the claim row lock (submit, decide or claim-bound activation); they are told apart at observation by the claim-issued row's state: revoked with failed attempts at the `ACTIVATION_POLICY` maximum is `EXHAUSTED`, any other revocation is `CLOSED_BY_REISSUE`. Until observed, the claim is still treated as open but its claim-issued code is already unusable. Approval for an Account that fails the §6A.2 predicate → terminal `APPROVED_EXISTING_ACCOUNT` with the binding recorded and no code. After any terminal state the Account is under ordinary card semantics, so anonymous wrong codes can at most revoke one code, exactly as for any card today, and can never block recovery or reissue.
6. **Activation composition and ownership (M6).** `auth-routes.ts` (path 44) pre-resolves, unlocked, whether the username's open code row is claim-issued through an Identity owning read. If not, it calls existing `identity.activate()` unchanged. If so, it calls the Secure Assessment claims coordinator (path 22), which owns one transaction: §6A.3 claim-bound order, Academic/Tenant owning checks of current roster, binding and scope through their own APIs, then a new transactional Identity activation variant (`activateInTransaction`, path 14) for credential → activation. Identity never reads or locks Academic tables. Race closure: if existing `activate()` finds, after its credential lock, that the open code row is claim-issued, it refuses with the same constant-work `INVALID_ACTIVATION`, without consuming, counting or changing the password; the Student retries and is routed to the coordinator. Conversely, if the coordinator finds after its credential lock that the open code row is no longer claim-issued (a concurrent reissue), it refuses with the same `INVALID_ACTIVATION` without consuming or counting, and the retry takes the legacy route. The unlocked pre-resolution is constant-work (same queries and verifier-hash cost on both branches) so timing does not reveal whether a username has a claim-issued code.
7. **Additional precisions from non-material observations.** A duplicate open claim gets the same uniform 202. The self-target rule (resolved Person ≠ verifier Person) is a §6 guard, checked before the `identity_identifier`/`tenant_membership` keys are acquired (so decide never waits on the verifier's own membership key, which `setSchoolOperator` takes before its `school_operator` key) and checked again after all locks. Name confirmation is deterministic: Unicode NFC, trim, collapse internal whitespace, case-fold, exact equality; a mismatch goes to REVIEW_REQUIRED and is never a similarity score. Enrollment uses `ensureStudentEnrollment` with the current roster period/group, start date = approval date in the school time zone, and source `student_claim`; if the tenant `time_zone` is NULL the decision refuses fail-closed with zero mutation (no fallback zone is invented). UI copy states the remaining activation time when a claim is approved close to its expiry.

## 7. Candidate API, privacy, UI and localization contract

| Operation | Proposed transport and guard | Minimal result |
|---|---|---|
| Submit claim | POST /api/v1/identity/claims, unauthenticated non-trusted entry; tenant locator, name/NISN/ISO birth date, request key (no claim capability, §6A.4); no Person/Account/role input | Uniform 202 opaque receipt on eligible/unknown/ambiguous business outcomes; bounded syntax 400, overload 429, persistence 503. No matched name/NISN/date of birth/account existence in public response |
| Verifier queue/detail | GET /api/v1/identity/claims/review, authenticated assigned Homeroom own current rombel or own-tenant Operator; bounded paging/detail under same endpoint, current roster-derived scope | Only scoped claims and verification fields required by OD-06; no cross-tenant queue, global lookup, raw secret/proof, bulk export or Student peer data. Unknown/ambiguous rombel goes to authorized Operator only |
| Approve/reject | POST /api/v1/identity/claims/decision; claim ID/revision, expected roster revision, decision/reason/confirmed/request key and explicit D2 adjudication; server-derived actor/authority | Minimal attributable receipt or bounded REVIEW_REQUIRED/stale-conflict/denial; rejection requires reason; no password or automatically active Account/session |
| Student password/activation | Reuse POST /api/v1/auth/activate and ActivationForm, with claim-bound authorization checks; no new reset endpoint | Existing session/cookie success only after approved code/password plus latest roster validation; exact existing card errors and non-claim path preserved |

Card handoff and failure accounting follow Owner-approved D1/D3 (§4.1); the public receipt is the uniform 202 of §6A.4, not an implemented endpoint yet. No public polling/search/notification endpoint is added. Candidate validation reuses the existing 64 KiB JSON bound, UUID validation/canonicalization, 1–200-character name/reason and 1–64-character NISN string bounds, strict valid ISO date and existing password policy. Preserve NISN leading zeros; reject control characters; no numeric coercion, fuzzy name lookup or Student-supplied matched Person. Name remains submitted confirmation for scoped human review, not an authority-bearing similarity score. There is no claim capability (§6A.4); failure accounting is §6A.5. Matching/request hashes are not anonymization. New routes must be classified in metrics and covered by existing route parity. Reuse cookie/CSRF/Origin/constant-work error patterns and existing edge controls; do not reduce security to status-code tests. Authentication and role checks precede sensitive projection and replay.

Bahasa Indonesia functional screens: Student claim form with native labels, no account-trust implication, honest pending/review/refusal/expiry states and no passwords collected at submission; verifier list/detail with reason/confirmation, current revision/stale reload and minimal fields. Reuse LoginScreen mode/ActivationForm, shared Page/Card/Dialog/Button/Alert/inputs and shell variants; no shared token/CSS changes or redesign. No UI em dash. >=44px controls, visible focus, keyboard dialog containment and persistent focus restoration after removed triggers, accessible errors, no optimistic success before ACK. Sensitive form/review/activation-code state is cleared on cancellation/navigation/tenant change/logout/unmount; late async responses cannot repopulate it. Preserve uncertain request key/reason while an operation is in flight. No proof/PII/secret in URL, browser storage, logs or screenshots with real data.

## 8. Exact proposed file scopes

**Current local preparation scope: exactly four documentation paths**, no publication or Build:

1. docs/production/tasks/AUTH-002.md
2. docs/production/TASK_PLAN.md
3. docs/production/PRODUCTION_COMPLETION_PLAN.md
4. docs/DOCUMENT_MANIFEST.md

The same four paths are proposed for subsequent contract publication; if approved decisions require substantive P2/P3/P4/P5 edits, their exact additional documentation paths below require explicit publication authorization rather than silently changing them now.

**Future implementation candidate: exactly 44 paths** (43 originally proposed plus row 44 from review finding M6), a proposed footprint for review/Owner approval, not an active or frozen write allowlist. New names do not claim existing files. D1–D3 or final owning-lock review may reveal a smaller footprint; any additional path must be explicitly approved before Build.

| # | Exact proposed path | Purpose |
|---|---|---|
| 1 | docs/production/tasks/AUTH-002.md | Contract/history/evidence |
| 2 | docs/production/TASK_PLAN.md | Authorized lifecycle/counters |
| 3 | docs/production/PRODUCTION_COMPLETION_PLAN.md | Production evidence/continuity |
| 4 | docs/DOCUMENT_MANIFEST.md | Document index |
| 5 | docs/production/CBT_DOMAIN_RULES_SPECIFICATION.md | Exact approved claim lifecycle checkpoint |
| 6 | docs/production/ROUTE_INTERACTION_MATRIX.md | F02 route/projection checkpoint |
| 7 | docs/production/CBT_ARCHITECTURE_DELTA_REVIEW.md | Reviewed owning A03 delta |
| 8 | docs/production/CBT_PERMISSION_MATRIX.md | Exact approved A09 boundary, no broader C grant |
| 9 | docs/production/CBT_UX_SCREEN_AND_INTERACTION_INVENTORY.md | Functional claim/verifier states |
| 10 | database/migrations/0057_student_claim_verification.sql | Proposed new schema/constraints, not allocated |
| 11 | runtime/identity-access/src/claims.ts | Identity-owned claim/decision/authorization APIs |
| 12 | runtime/identity-access/src/student-identity.ts | Compose canonical allocation/reservation and lock protocol |
| 13 | runtime/identity-access/src/provisioning.ts | Explicit owning Person/activation provisioning composition |
| 14 | runtime/identity-access/src/index.ts | Claim-bound activation guard; legacy path preserved |
| 15 | runtime/identity-access/test/claims.test.ts | Lifecycle/validation/privacy unit oracles |
| 16 | runtime/academic-core/src/homeroom.ts | Academic-owned time-bounded responsibility/guard/bootstrap APIs |
| 17 | runtime/academic-core/test/homeroom.test.ts | Scope/effective-time/revocation/validation units |
| 18 | runtime/tenant-access/src/provisioning.ts | Canonical membership creation/locking composition if needed |
| 19 | runtime/academic-core/src/student-identity.ts | Roster matching/effective binding/compatible enrollment APIs |
| 20 | runtime/academic-core/src/roster-import.ts | Read effective binding without bypassing existing protections |
| 21 | runtime/academic-core/test/student-identity.test.ts | Matching/binding/invalid ownership units |
| 22 | runtime/secure-assessment/src/claims.ts | Shared-transaction owning-domain coordinator |
| 23 | runtime/secure-assessment/src/http/claim-routes.ts | F02 transport/security/response projection |
| 24 | runtime/secure-assessment/src/server.ts | Exact route wiring only |
| 25 | runtime/secure-assessment/src/http/me-context.ts | Server-derived Homeroom capability only |
| 26 | runtime/secure-assessment/src/metrics.ts | Fixed route classifications |
| 27 | runtime/secure-assessment/src/ops/provision-cli.ts | Existing-authority scoped Homeroom command |
| 28 | runtime/secure-assessment/src/ops/provisioning/homeroom.ts | Audited bootstrap coordinator |
| 29 | runtime/secure-assessment/test/claims.test.ts | Route/error/request shape units |
| 30 | runtime/secure-assessment/test/integration/claims.test.ts | Real PostgreSQL state/race/rollback/compatibility |
| 31 | runtime/secure-assessment/test/route-parity.test.ts | New routes and no old-route weakening |
| 32 | frontend/web/src/api/identity-client.ts | Typed claim/review/decision client |
| 33 | frontend/web/src/api/auth-client.ts | Optional server capability type; legacy shape preserved |
| 34 | frontend/web/src/components/StudentClaimView.tsx | Non-trusted public claim UI |
| 35 | frontend/web/src/components/ClaimReviewView.tsx | Scoped queue/review/decision UI |
| 36 | frontend/web/src/session/SessionScreens.tsx | Claim entry mode and reuse activation |
| 37 | frontend/web/src/session/AppShell.tsx | Authorized role-aware workspace navigation |
| 38 | frontend/web/src/App.tsx | Bounded claim/review route composition |
| 39 | frontend/web/src/__tests__/studentClaim.test.tsx | Claim form/privacy/purge/accessibility units |
| 40 | frontend/web/src/__tests__/claimReview.test.tsx | Review/reason/focus/replay units |
| 41 | frontend/web/src/__tests__/session.test.tsx | Existing login/card/tenant regression |
| 42 | runtime/secure-assessment/test/integration/account-activation.test.ts | Claim/card/login/reissue/session compatibility races |
| 43 | e2e/tests/9-identity.spec.ts | Isolated synthetic journeys and rendered evidence |
| 44 | runtime/secure-assessment/src/http/auth-routes.ts | Route claim-bound activation through the coordinator (§6A.6); ordinary activation unchanged |

Forbidden: every other file, completed SEC-001/AUTH-001/ADMIN-001 records, old migrations, existing global E2E fixture/shared Student capture helper, workflows/lockfiles/dependencies/config/secrets, shared styles/tokens/primitives/assets, Student exam business logic, other projects and production resources. No directory/glob authorization. No production writer is edited at preparation.

## 9. Acceptance gates and proposed verification order

All gates below are **DEFINED / NOT EXECUTED** for AUTH-002. Predecessor CI/reviews do not constitute their PASS.

| Gate | Required acceptance oracle |
|---|---|
| C01 | Non-trusted submission/matching writes zero Person/Account/credential/activation/session/enrollment/roster/history, except §6A.3 lazy closure of an already-expired claim and single-row revocation of its unusable claim-issued code; neutral response and no public identity enumeration |
| C02 | Own-tenant NISN/date/name confirmation is deterministic; unknown/ambiguous/mismatched/current-revision cases stay untrusted/review-required; no fuzzy/global merge |
| C03 | Homeroom explicit own-current-rombel scope, own-tenant Operator, no implicit Teacher/Proctor/Platform role; continuity/binding to a Person with any staff-role assignment row (§6A.1 N1) refused; substitution/cross-tenant/expired/revoked/missing/ambiguous authority denied with exact zero mutation |
| C04 | Exactly seven-day server lifetime, expiry equality boundary and ten serialized failures per approved D3; replay does not extend time/reset failures; no Account lockout from claim abuse |
| C05 | One duplicate-producing open claim per official identity/Person under concurrent keys and existing AUTH-001 reservation; DB constraints, late Person resolution and cross-school same-attribute cases preserve global canonical identity |
| C06 | Approve/reject/audit/binding/membership/compatible enrollment all-or-nothing; inject failure at each owning stage including receipt/activation issuance, assert exact rollback and no orphan trust/history |
| C07 | Re-read latest roster/rombel/binding/claim revision before approval and activation; concurrent import/assignment/membership/enrollment change either serializes compatibly or refuses stale with zero unauthorized effects |
| C08 | Only explicitly adjudicated Person; existing canonical Account/identifier reused, no replacement or active-password change; unbound new-identity outcome requires approved D2, conflicts remain review; staff/Teacher/Proctor/Operator/Homeroom Person never bound or issued a code (§6A.1 N1); Attempts/history remain identical |
| C09 | Actual PostgreSQL controlled barriers in both orders for duplicate submission/decision, allocate/reserve/legacy INSERT, card/login/activation/reissue/session mutation, roster correction, people import, ensureMembership, setSchoolOperator, both enrollment writers incl. initially empty slots/case variants and verifier revocation; no lock inversion, late expiry consumption, partial state or retry masking |
| C10 | Same-key intended replay after lost ACK produces one logical receipt, current authority rechecked; altered reason/decision/person/roster/scope refuses; expired/consumed/rejected authorization cannot create another activation/session |
| C11 | OD-06 verification-only sensitive projection, bounded scoped queue/detail, no Student/other-role/foreign proof or identifiers; no PII/secret in logs/metrics/audit/cache/storage/URL; no invented proof/notification/retention behavior |
| C12 | Empty/0056 upgrade/repeat/constraint/migration rollback preserve old roster receipts/revisions, canonical Accounts, legacy usernames, activation cards, sessions, accepted answers/results and all existing assertions |
| C13 | Real synthetic public claim→scoped review→explicit approval→Student password/card activation and refusal/rejection/expiry/error/retry; keyboard/labels/focus/purge/late response/uncertain intent and responsive rendered checks across five browsers |
| C14 | Exact approved scope/identity/references/33-Task 78-edge DAG/R-G coverage; full automatic exact-content attempt-1 eight-job CI (web/runtime/real PostgreSQL/image/five browsers), actual inventory with no weakening/skips/rerun-to-PASS |
| C15 | Actual-source Independent HIGH-risk/Identity-Security implementation review PASS, rendered evidence review and explicit Owner Acceptance, then separately authorized single Task-record-only evidence commit. PB05 OPEN; Owner controls merge |

CI-first is **PROPOSED, NOT AUTHORIZED** for AUTH-002. Request this Task's explicit verification-order grant with Build: safe targeted unit/static/typechecks and deterministic scope guards → controlled candidate commit/normal push/one PR → existing automatic eight-job ubuntu-24.04 workflow on exact SHA/attempt 1 with real PostgreSQL and five browser projects. No heavy local DB/Docker/browser/build suite. Determine actual test counts from the candidate, not predecessor 356/912/224/24 counts. Failure means STOP, no automatic rerun/correction without applicable authority.

Before frontend Build, verify the existing Frontend Entry Gate and documented engineering/review skill roles in FRONTEND_AGENT_SKILL_STACK; select/read/record only the purpose-fit installed skill needed. No frontend skill execution, DesainPakeAI access or new design authority is claimed by this documentation preparation. Existing shared primitives/tokens and functional accessibility constraints remain mandatory.

Before material UI changes, propose capture-only baseline inside allowed E2E spec with exact SHA/source-tree/fixture hash/project/viewport/scenario using existing workspace-* artifacts; all required baseline gates must PASS before UI. Capture actual existing Login/Activation/Operator entry, clearly mark absent claim/review screens; never compare a loading frame as an equivalent before-state. After implementation render Student claim and authorized Homeroom/Operator states at 360/390/430/768/1024/1280/1440 and short landscape/200% text; capture pending/ambiguous/refused/error/rejection/approval/activation, keyboard/focus/cancellation, no overflow, >=44px and current design primitives. Keep unchanged fixture/provenance, actual browser inputs, secret-redacted synthetic screenshots and accessible feedback; no blanket WCAG/device certification. Baseline/candidate commits and CI order need separate explicit Owner authorization; no capture or CI is run by preparation.

## 10. Formal READY assessment and next approval gate

| Prerequisite | Actual disposition |
|---|---|
| Baseline and dependency | PASS: exact merged main/PR #21/CI #131, ADMIN-001 DONE; SEC-001/AUTH-001 preserved |
| Baseline accounting | Locally reconciled 3/33, 30 BLOCKED, all other counters zero; 33 IDs/78 edges retained; unpublished |
| Settled O01/O03/A03/P5 inputs | Reused, no renewed approval requested for their existing values/authority |
| Remaining D1–D3 | PASS: Owner explicitly approved D1/D2/D3 on 2026-11-07 (§4.1) |
| Owning schema/locks/API | PASS (contract): §§5–7 as governed by §6A, total lock order and failure/lifecycle contract reviewed against actual writers (§10.1). Real PostgreSQL contention evidence is Build-time C09 |
| Proposed scopes/migration | Four current docs/44 future paths; 0057 unused but not allocated. Exact publication/Build allowlist and migration reservation require approval |
| Independent reviewer | Owner designated a separate read-only fresh-context reviewer agent on 2026-11-07; contract review chain PASS in §10.1. Implementation review is later completion evidence |
| Publication/Build/CI-first | NOT AUTHORIZED; current grant ends at local documentation/decision package |

**AUTH-002 remains BLOCKED. SAFE TO IMPLEMENT: NO.** D1–D3, reviewer designation and the Independent Identity/Security contract review chain (PASS, §10.1) are settled. Remaining before formal READY: explicit Owner approval of the exact 44-path future footprint and the `0057_student_claim_verification.sql` migration path, and Owner authorization of four-document publication (one controlled commit, normal push, one PR, automatic exact-SHA CI) on `task/auth-002-student-claim-verification`. Build/Task-specific CI-first remains a subsequent explicit grant. No repeated predecessor review is required.

### 10.1 Independent Identity/Security contract review

Original review, 2026-11-07, by the Owner-designated separate read-only fresh-context reviewer, on exact record SHA-256 77f9a56e9596119e8ec25c7358e3f62e973b296c30ffe0dd5f6e29b59bb51ddb: **STOP, six material findings.** M1 continuity/new-identity selector and Person creation undefined; M2 "no usable password" not representable and not rechecked after the credential lock; M3 admission key unplaced and membership/people-import reverse edge, writer matrix incomplete; M4 claim capability used but undefined, A09 status and CANCELLED actor undefined; M5 claim-bound guard lifecycle undefined, enabling anonymous exhaustion lockout and blocking reissue; M6 activation route `auth-routes.ts` outside the footprint and an Identity-internal cross-domain read implied. Confirmed sound: authorization/tenant model, roster fence order, existing credential→activation and allocation orders, `unusableVerifier: null` handoff safety, additive binding preserving 0056, D3 value/exclusion fidelity, privacy bounds, footprint/gates apart from M6. Executor independently verified the cited evidence before correcting.

Correction: §6A (M1–M6 and selected non-material precisions), path 44 added to §8. D1–D3, the other 43 paths, C01–C15, 0057 proposal, 33 Tasks/78 edges and PB05 OPEN unchanged. First targeted re-review, same reviewer, on SHA-256 52ce2da9a59e4fe3a4ba8b4592a915c9d7533ed4d4913b4b10d09e649b9fc146: **STOP.** M2–M6 CLOSED; M1 CLOSED except one new material finding N1: "exactly one Student membership" is undecidable (memberships carry no kind), letting a verifier obtain a code for a never-activated staff/Teacher/Proctor/Operator Account. Correction: §6A.1 fail-closed staff-role exclusion across all six assignment/responsibility tables in any tenant and state, C03/C08 extended. Non-material notes 1–8 also applied (allocation position and "subsequence", canonical lowercase keys, submit closing expired claims, lazy EXHAUSTED/CLOSED_BY_REISSUE, coordinator re-classification, constant-work pre-resolution, stale capability text removed, NULL time zone fail-closed, C09 writer list). **Second targeted re-review, same reviewer, on SHA-256 5f4c7386cbebd7569fe96cdeda421b8fe326d2df4460f1cb73769f239c707b28: PASS.** N1 CLOSED: the exclusion list covers every role/assignment table in the migrations (0008, 0018, 0019, 0033, 0056, new Homeroom); no new material defect from the targeted edits, checked against actual credential-first writers, reissue/wrong-code revocation and allocator lock order. **Independent Identity/Security contract review chain: PASS** (original STOP M1–M6 → targeted STOP N1 → targeted PASS). This is a contract review, not implementation review or test evidence.

Post-PASS edits are limited to the reviewer's six non-material wording notes, with no change to any decision, path, gate or lock edge: C01 exception for lazy expired-claim closure; claim-driven revocation targets only the claim-issued row by id (never the account-wide revoke); submit aligned as lazy observer with admission only after an observed terminal state; constant-work submit paths; §6 superseded-by-§6A pointer; same-tenant wording of exclusion serialization.

Release-only boundaries: qualified legal/real-data clearance G7, real-device/load/restore/UAT/production deployment evidence and full PB05/G6 closure are not manufactured or demanded as completed AUTH-002 entry tests. Their actual authority applies before real-data/release use. A genuinely unresolved proof/role/privacy/ownership rule that determines this implementation remains a READY blocker; do not conflate it with later execution evidence.

## 11. Preparation record

2026-11-04: Owner authorized documentation preparation only; Git/main/PR #21/CI #131 verified, safely reused existing clean checkout and fast-forwarded main; source inspected without tests/services. Prepared this candidate and next-Task predecessor reconciliation. Status remains BLOCKED; no publication, review attestation, migration reservation, Build, real data, secret/vendor configuration or PB closure. Lightweight scope/reference/accounting/history guards are recorded in the executor's preparation report; no unexecuted test PASS claimed. STOP at §10 approval gate.

Local deterministic documentation guards: PASS for exactly four expected documentation paths (three modified tracked files plus this new untracked record), nothing staged; 43 unique proposed future paths; C01–C15 defined; 0057 physically unused; local Markdown targets resolve. Compared TASK_PLAN rows against Git HEAD: all 33 IDs/outcomes/priorities/risks/internal/external dependencies unchanged except authorized ADMIN-001 VERIFYING→DONE; 78-edge DAG acyclic, R/G reference coverage unchanged, three checked DONE rows, thirty BLOCKED and zero other statuses. Completed Task records, application/test/migration/workflow/fixture files unchanged. Whitespace checked, no secrets/attribution trailers introduced. This is documentation verification, not AUTH-002 runtime, database, rendered, independent-review or READY PASS.

2026-11-07 (executor handoff to Claude Code): reconstructed state without restarting work; main/origin/main 056a154d4ae2eb9c5a7c7923c6737496f396990d, the same four local documentation paths preserved. Verified no prior Owner approval of D1–D3 existed in the repository; Owner approved D1/D2/D3 and designated the reviewer in chat (§4.1). Contract finalized within those decisions (§4.1, §6A, path 44); Independent Identity/Security contract review chain STOP → STOP → PASS (§10.1), each correction verified against actual source by the executor before submission. Status remains BLOCKED pending Owner footprint/0057/publication approval. No commit, push, PR, CI, source, migration, real data or successor; PB05 OPEN.

## 12. Formal READY and Build start under DEC-048 — 2026-11-07

### 12.1 Authority and landing record

- **Authority:** DEC-048 (00.13), effective on 2026-11-07 when GOV-EXEC-001 landed. AUTH-002 is the highest-priority eligible Task (00.13 §4.1–§4.2). The executor performs READY, Build, CI, review commissioning, evidence and the squash merge under 00.13 §4–§6. Every §7 item stays with the Owner.
- **Predecessor landing (00.13 §4.5):** [PR #22](https://github.com/yusufarst/elligble/pull/22), GOV-EXEC-001 / DEC-048.
  - Content b0eaf71880d1bf3f8bb96b87ace10fea94e6781c, CI #132/run 42324774887, attempt 1, eight SUCCESS.
  - Evidence cba11eb8a55a7a3c25e2d1939367e3cde9c67d7d, CI #133/run 42325477630, attempt 1, SUCCESS.
  - Squash merge by the executor under the Owner's one-time instruction: main 5d0672f3c73ea4754a17d64316a876c5a5a7e3a5, tree equal to the PR head.
  - Post-merge main CI #134/run 42325511982: push, attempt 1, eight jobs SUCCESS.
- **Publication carry-over:**
  - This record (preparation SHA-256 785ed0f902a2151ae6162b940c64a48b959eeaf7fb23b47077b9b16ec64c5e57) and the three tracker edits were moved from the main checkout onto the new branch.
  - The only conflicts were the top checkpoint lines and the TASK_PLAN §11 heads, resolved by keeping both sides in date order.
  - The main checkout copy is preserved untouched.

### 12.2 Eligibility and formal READY: PASS

| Prerequisite | Disposition |
|---|---|
| Internal dependency | ADMIN-001 DONE, landed main 056a154 with post-merge CI #131 attempt 1 eight SUCCESS |
| O01 | Settled at AUTH-001 (Owner approval 2026-11-02); reused unchanged |
| O03 | Settled values (seven days, ten failures) plus Owner-approved D1/D3 (§4.1). The persistence and transaction design is §6A, reviewed by the Owner-designated reviewer (§10.1) |
| O09 | Approved P5 matrix (GOV-POLICY-001 §7) plus Owner-approved D1/D2 scoped verifier boundary. PB05 stays OPEN |
| A03 | Owner-approved D2 (A03/O09 resolution contract) and Owner-designated Identity/Security reviewer PASS on the §6A lock, constraint, rollback and replay design. Same basis as the ADMIN-001 downstream A03 contract |
| OPEN policy / architecture | None used. No new role, channel, retention period, notification or proof rule |
| Expected outcomes | Only those in the TASK_PLAN card, §4.1 Owner decisions and §6A/§9 as reviewed. No new outcome is decided by the executor |
| Privacy / retention (§4) | The bounded storage contract does not depend on an unresolved retention action. The reviewed contract stores minimal claim fields with no purge job, and no retention period is invented. G7 applies before any real data |
| Prepare-only / §7 | AUTH-002 is not prepare-only. Rows 5–9 record the approved contract as status/pointer text and decide no §7 item |

**Frozen allowlist:** exactly the 44 paths of §8. Rows 1–4 are the Task-flow paths of 00.13 §4.3, and rows 5–44 are the implementation allowlist. No directory or glob authorization, and the §8 "Forbidden" list applies unchanged.

**Migration reservation:** `database/migrations/0057_student_claim_verification.sql`, reserved after rechecking main 5d0672f3c73ea4754a17d64316a876c5a5a7e3a5: migrations end at 0056 and no 0057-prefixed path exists. Build rechecks before creating it.

### 12.3 Frozen CI-first verification order

1. **Registration commit.** This record plus the three tracker paths. Normal push, one PR, then the automatic exact-SHA CI, which must show eight SUCCESS on attempt 1.
2. **Capture-only baseline commit.** Only `e2e/tests/9-identity.spec.ts` changes: it captures the existing Login/Activation screens and the absent claim/review entry. The rules are the same as ADMIN-001 §10: seven widths plus short landscape/200% text, exact SHA/source tree/global fixture hash, and no application source change. CI attempt 1 must show eight SUCCESS, and the five workspace-* artifacts must be retrieved and validated before any UI source change.
3. **Implementation content commit(s).** Allowlist paths only. Allowed local checks: typecheck and targeted Node/web unit tests. Not allowed: local PostgreSQL, Docker, browsers or heavy suites (TASK_PLAN §4 item 9). Each content SHA needs automatic CI attempt 1 with eight SUCCESS. Real PostgreSQL (C05–C10, C12) and five-browser (C13) evidence come only from CI.
4. **Independent implementation review** (00.13 §5.5). A fresh-context, read-only Identity/Security reviewer reviews the final content SHA and inspects the actual rendered evidence. A STOP is closed only by a correction re-reviewed by the same reviewer. Corrections stay inside the frozen contract as new SHAs with full CI, bounded to three per gate (00.13 §5.6).
5. **Delegated Acceptance (DEC-048)** under 00.13 §5.4. C15's per-Task "explicit Owner Acceptance" and "Owner controls merge" are replaced by DEC-048 (00.13 §3). The C15 review and rendered-evidence gates are unchanged.
6. **Evidence commit.** It changes only this record. Then CI on the PR head (attempt 1), the delegated squash merge under 00.13 §6, and post-merge main CI. The next Task's first change records the landing.

No CI re-run of any kind (TOOLCHAIN rule, 00.13 §5.3). An infrastructure failure is escalated to the Owner.

### 12.4 Status

**BLOCKED → READY → IN_PROGRESS** on 2026-11-07. Earlier BLOCKED / "not authorized" / "Owner approval pending" wording in §§1, 8, 9, 10 and 11 is preparation history.

**Counters:** DONE 3/33 (9.09%), IN_PROGRESS 1, BLOCKED 29, READY/VERIFYING/TODO/SUPERSEDED 0. 33 IDs and 78 edges unchanged.

**Boundaries:** PB05 OPEN. No real data, deployment or release claim.

## 13. Implementation candidate and verification handoff — 2026-11-07

### 13.1 CI-first steps 1 and 2

- **Registration:** ba1b2cd1e354a68603a733dd02fb038e31b0ef54, PR #23, CI #135/run 42326609353, push, attempt 1, eight SUCCESS.
- **Capture-only baseline:** b7f0b89b9d4db46f53e2bd438555852496d95858 changed only `e2e/tests/9-identity.spec.ts`. CI #136/run 42327185424, push, attempt 1, eight SUCCESS.
- **Artifacts:** all five workspace-visual-* artifacts were retrieved (desktop-1280 13555817576, mobile-360 13555822882, webkit-390 13555878422, firefox-1280 13555967713, tablet-768 13556037466). Each holds 24 AUTH-002 screenshot/JSON pairs (login-entry, activation-entry, staff-workspace at seven widths plus 200% text).
  - Every pair has the exact baseline commit, phase `before`, frontend tree b11e1f64f2321ca05e3aa6d24ccde1fb9c041996 and the unchanged fixture hash.
  - Claim and verifier entries are absent (0) in every pair.
  - The baseline passed before any application source change.
- **Baseline defect recorded, not blessed:** the existing login screen overflowed horizontally at 360 and 390 px in all five projects. The activation link button is `whitespace-nowrap` and measured 428 px. The candidate fixes this in `SessionScreens.tsx` (allowlist path 36) by letting both entry links wrap with a 44 px minimum height. The after-phase gate re-asserts it.
- **Frontend skill:** `react-typescript-vite`, verified at `~/.gemini/config/skills/react-typescript-vite/SKILL.md` with SHA-256 450285288fba41f497991f074f100a43ed2d714e51818caae3294663e5ccd558 (the registered stack hash), read before UI work. No DesainPakeAI access and no design-authority claim. Shared tokens and primitives only.

### 13.2 Candidate content

41 of the 44 frozen paths changed; nothing outside the allowlist. Paths 12, 13 and 42 needed no change. Contents:

- **0057:** claims, claim events and the claim-to-activation relation (Identity); roster identity bindings and Homeroom responsibilities with events (Academic Core). Includes partial unique open-claim indexes, immutability triggers and the binding/0056 agreement guard. Empty at adoption.
- **Identity** `claims.ts` holds the state, observation and issuance APIs. `index.ts` gains `activateInTransaction`, and the legacy `activate()` refuses a claim-issued code without counting.
- **Academic Core:** `student-identity.ts` (matching, name rule, binding, enrollment, staff read) and `homeroom.ts` (responsibility, effective time, audited bootstrap). `roster-import.ts` now reads the effective binding.
- **Tenant Access:** the staff-role exclusion read.
- **Secure Assessment:** coordinator `claims.ts` in the §6A.3 order; routes; server, metrics and me-context wiring; activation routing in `auth-routes.ts`; the `homeroom assign|revoke` CLI.
- **Web:** `StudentClaimView` and `ClaimReviewView`, the claim entry link and the `verifier` workspace.
- **Tests:** units in all four runtime packages and the web; real-PostgreSQL integration `test/integration/claims.test.ts`; the after-phase E2E journey.
- **Records:** P2/P3/P4/P5/P7 pointer checkpoints only.

Engineering details resolved within the contract (00.13 §5.1):

- **Approval:** requires an exact current match (state PENDING_REVIEW and NISN/date/name still equal); REVIEW_REQUIRED and unmatched claims can only be rejected or cancelled.
- **Cancel and reject:** Cancel of an approved-pending claim revokes only its own code row. Reject applies only before approval.
- **School code:** the Student claim takes the school code from the school's own link (`?sekolah=`) or as typed input. It is an untrusted locator, and the verifier screen shows it for sharing.
- **Capture metric:** the E2E capture measures a checkbox or radio by its label, the actual target. The handoff activation code is masked in screenshots.

### 13.3 Local verification (workstation limits, TASK_PLAN §4 item 9)

- **Typecheck PASS:** identity-access, tenant-access, academic-core, secure-assessment (src and tests), web, e2e.
- **Targeted Node units PASS:**
  - identity claims 3/3;
  - academic student-identity and homeroom 6/6;
  - academic roster-import 5/5;
  - Secure Assessment claims 4/4;
  - route parity, metrics and server 24/24.
- **Targeted web units PASS:** studentClaim, claimReview, session, designSystemGuard, onDemandScreens, screenFiles and schoolRosterImport, 7 files and 52 tests, after the session regression was added.
- **Not run locally:** PostgreSQL, Docker, browsers and the full suites. C05–C10 and C12 real-database evidence and C13 five-browser rendered evidence come only from the exact-content CI.
- **Corrections made before publication:** a review-list loading counter shared with the decision counter (it left a dialog busy) and a test query, found by the new units.

### 13.4 Status and residual risks

**Status:** IN_PROGRESS → VERIFYING. Counters: DONE 3, VERIFYING 1, BLOCKED 29, other statuses 0.

**Pending:** exact-content CI attempt 1, artifact validation, independent implementation review on the final content SHA (C15), Delegated Acceptance and the evidence commit.

**Residual risks, recorded honestly:**

- The claim-bound activation path performs more database work than an ordinary activation. The routing query is constant, but end-to-end timing can differ by a few milliseconds, which could reveal that a username holds an approved-pending claim code.
- A plain staff membership with no assignment row cannot be told apart from a Student (§6A.1).
- NEW_IDENTITY_REVIEWED relies on the recorded in-person attestation.

**Boundaries:** PB05 OPEN. No real data, deployment or release claim.

## 14. Independent implementation review and correction 1 — 2026-11-07

### 14.1 Original implementation review: STOP

The reviewer was a fresh-context, read-only Identity/Security agent (00.13 §5.5) and reviewed content 660d69d113341b77095351362e0e09b086120bae against base 5d0672f. The executor verified each item of cited evidence in the source before correcting.

**Verdict: STOP, three material findings.**

- **M1, queue truncated before scope:** `listClaimReview` took the tenant's oldest 500 open claims, then filtered by Homeroom scope and capped at 100. `truncated` ignored the source cut, and expired or unmatched claims were never excluded. Anonymous unmatched submissions could therefore hide scoped claims (C03/C11).
- **M2, no expiry recheck after the credential wait:** claim-bound activation evaluated claim expiry before waiting on the credential lock. A code could be consumed after the claim's `expires_at` (§6 item 7, C09).
- **M3, C09/C12 evidence below the gate:** contention used raw advisory or row locks instead of the actual writers, mostly in one order. Several writer pairs, a 0057 upgrade/rollback oracle and path 42 compatibility were missing.

**Found consistent by the reviewer:**

- the lock order against every existing writer;
- D2 adjudication, self-target and N1 exclusion;
- the §6A.2 predicate after the credential lock, `unusableVerifier: null` and no code on replay;
- the claim-issued guard, single-row revocation and lazy observation;
- 0057 constraints and 0056 agreement;
- scope (41 of 44 paths);
- UI copy and purge;
- no test assertion expected to fail.

**Exact-content CI of 660d69d:** CI #137/run 42333137898, push, attempt 1: Web job SUCCESS; the Runtime job's integration step started 2026-11-07T03:15:44Z and was still running at 04:41:45Z (CI #136 took 29 s), so it is hung. Executor diagnosis from source: the 660d69d contention test registered `t.after(watch.release)` after `t.after(db.close)`. Hooks run in registration order, so `pool.end()` waits for the unreleased observer client, the test process never exits and the job runs to the 6-hour default limit. Correction 1 replaces every teardown with one that first releases barriers and destroys still-held clients. The run is not cancelled; its final conclusion is recorded at evidence time. It was preserved as recorded: no cancellation and no re-run.

### 14.2 Correction 1 (within the frozen contract and allowlist; bound 1 of 3, 00.13 §5.6)

- **M1:**
  - Identity `listOpenClaims` now pages in SQL over open, unexpired claims, scoped by an Academic-owned `rosterIdsInScope` for Homeroom; roster-matched claims come first. `truncated` reflects the scoped query.
  - The route accepts a bounded `offset` (0 to 100000; anything else is 400), and the UI offers next and first page.
  - Expired claims are not offered for decision; the next locked observer records their closure. Unmatched claims still require an Operator rejection or cancellation, or simply expire.
- **M2:**
  - `ClaimActivationGuard.notAfter` carries the claim's `expires_at` and is evaluated in `#activateCore` after the credential and activation row locks; it refuses without counting or consuming.
  - The coordinator then re-observes the claim, so it records EXPIRED and revokes only its own code row.
- **M3:** new real-PostgreSQL barrier tests on the actual writers, each observed through `pg_blocking_pids` and run in both orders:
  - `setSchoolOperator` on the target;
  - `ensureMembership`;
  - AUTH-001 `allocateStudentIdentity`;
  - the shared enrollment writer on an initially empty slot with case-variant UUIDs;
  - `importPeople`;
  - roster import confirm over HTTP;
  - session revocation;
  - School Operator revocation of the verifier;
  - reissue against claim-bound activation;
  - post-wait claim expiry.

  Also added:
  - a scoped-queue and paging oracle;
  - a 0057 upgrade, rollback and repeat oracle over 0056 data;
  - a path 42 compatibility oracle: legacy `activate()` refuses a claim-issued code without counting, and ordinary cards count and activate as before.
- **Non-material notes applied:**
  - the 429 copy is neutral ("Server sedang sibuk");
  - a refused password is answered before any claim lock;
  - the received-state info Alert no longer nests an alert role.
- **Notes left as recorded residuals:** activation-row writes after the slot lock (harmless, credential held); the no-op allocation audit (claim event and allocation event are the record); the predicate evaluated at approval only, as the contract defines; retention is a G7 input.
- **Local checks:**
  - typecheck PASS in all runtime packages, web and e2e;
  - targeted Node units PASS (Secure Assessment claims and route parity 5/5, plus earlier units);
  - targeted web units PASS (studentClaim and claimReview 8/8).

  Real PostgreSQL and browser evidence come only from CI.

**Status:** VERIFYING. Pending: exact-content CI of the correction, then targeted re-review by the same reviewer.

### 14.3 Correction-1 verification, rendered review STOP and correction 2

- **Targeted re-review, same reviewer, on 7b60c9d9c76a5c55308e80f177d23ba48edf08e5: PASS.**
  - M1, M2 and M3 are CLOSED; no new material defect.
  - Non-material residuals: Homeroom-responsibility revocation during decide is not separately interleaved; reserve and the legacy credential INSERT share the allocation's Person-lock pattern.
- **CI #138/run 42339912468:** ref task/auth-002-student-claim-verification-c1, exact SHA 7b60c9d, push, attempt 1, eight jobs SUCCESS.
  - Counts: Secure Assessment units 916/916; other runtime units 31, 14 and 11; real PostgreSQL integration 234/234 (224 before plus the 10 new oracles, none skipped); E2E 26/26 in each of the five projects, including the AUTH-002 after-phase journey.
  - Artifacts: the five workspace-visual artifacts hold 64 AUTH-002 captures each, all phase `after` at the exact commit, with no overflow, no target under 44 px, and every handoff capture masked.
  - The temporary verification ref keeps the original CI #137 on PR #23 running, as the Owner directed; it is not a second Task branch.
- **Rendered-evidence review, same reviewer: STOP, one material finding.** In the approval dialog the radio and checkbox indicators shrank to about 10 px when their labels wrapped (flex items without `shrink-0` under `[&_*]:min-w-0`) and used the browser default colour. Evidence: `workspace-auth-verifier-approve-360x800-mobile-360.png` and its webkit-390 counterpart. Everything else met the contract, including the fixed login overflow, copy, labels, queue states, the shared primitives and handoff masking.
- **Correction 2** (bound 2 of 3, path 35 and E2E path 43 only):
  - the four dialog inputs use the existing `size-4 shrink-0 accent-primary` pattern of ParticipantChoiceList;
  - the handed-over ELLIGBLE ID no longer breaks mid-identifier;
  - the text-200 captures add a scrolled capture of any open dialog, so the whole dialog is evidenced at 200% text.
- **Local checks:** web typecheck and claimReview/designSystemGuard 13/13 PASS; e2e typecheck PASS.
