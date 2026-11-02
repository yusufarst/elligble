# AUTH-001 — ELLIGBLE ID and Canonical Account Foundation

## 1. Contract, authority and current authorization

| Field | Frozen contract |
|---|---|
| Task / classification | AUTH-001, existing active P11 baseline Task; P0 identity foundation; HIGH risk; R07/R08/R09; no Task split or new baseline row |
| Current status | DONE — bounded AUTH-001 identity foundation only; final content, CI, independent implementation review and Owner acceptance recorded in §13 |
| Objective | Implement the approved ELLIGBLE ID allocation, canonical Account/Person and database-enforced uniqueness foundation while preserving existing provisioning, activation-card, authentication and exam continuity |
| Base / branch | main 89d725c0cebdc4425971d91721376927fe160bbb; task/auth-001-elligble-id-foundation |
| Internal dependency | SEC-001 DONE: accepted implementation 7866a4088fd766ac7c31f632f28779c25d0faaa8, evidence 55ab60818819ec47d1e34ad44ad8d1a4a15be0d5, Owner-merged PR #19/main above; exact-main CI #119/run 41367164249, attempt 1, eight SUCCESS |
| External inputs | Owner approved O01/O03/A03 on 2026-11-02, within §4; Independent Identity/Security contract review and targeted A03 re-review in §6/§11 |
| Responsible parties | Owner approves policy, authorizes Build and merges. Authorized executor implements only this contract. Independent Identity/Security reviewer performs HIGH-risk review; contract review was explicitly commissioned and completed, implementation review remains mandatory before DONE |
| Current publication permission | Owner separately authorized exactly one final Task-record-only evidence commit and normal push to existing PR #20 after the §13 closure guards. Earlier Build/CI-first authority and checkpoints remain historical. No merge, deployment, PB05 closure or successor execution |
| Parallel safe | NO parallel execution of baseline Tasks. Owner/school may gather legal, infrastructure or device facts without executing another Task |
| Cost / tools | Existing Node/TypeScript, PostgreSQL 16, Git and automatic eight-job GitHub Actions workflow; no dependency/vendor/service/recurring-cost change. Heavy verification uses isolated CI runners, never shared workstation Docker/DB/processes |
| DONE | §8 acceptance and §9 exact-content verification, Independent HIGH-risk/Identity-Security Review PASS and Owner acceptance satisfied for final content in §13; this sole separately authorized Task-record-only evidence change records closure under DEC-045. Not achieved by registration |

Authority: [DEC-044 §5/§9/OD-05/OD-06](../../00-governance/00.11_CBT_RELEASE_SCOPE_REALIGNMENT.md), [DEC-045 §4–§7](../../00-governance/00.12_AICWDF_ADOPTION_AND_TASK_EXECUTION.md), [decision hierarchy](../../00-governance/00.02_DECISION_HIERARCHY.md), [TASK_PLAN §4/AUTH-001/§8](../TASK_PLAN.md), [domain ownership](../../00-governance/00.07_DOMAIN_OWNERSHIP_AND_CONTRACTS.md), [Identity/security architecture](../../architecture/IDENTITY_ACCESS_AND_SECURITY_ARCHITECTURE.md), [P2](../CBT_DOMAIN_RULES_SPECIFICATION.md), [P4](../CBT_ARCHITECTURE_DELTA_REVIEW.md), [P5](../CBT_PERMISSION_MATRIX.md), [GOV-POLICY-001 §7](GOV-POLICY-001.md) and [GOV-PERF-001 §7](GOV-PERF-001.md). Existing LOCKED/FROZEN decisions remain authoritative; this contract supplies approved implementation detail, not a new decision ID or silent supersession.

## 2. Reuse and physical continuity checkpoint

Entry on 2026-11-02: C:/Projects/ELLIGBLE, main/HEAD/origin/main/upstream all equal the base above, working tree CLEAN. Owner identity verified as Yusuf Arif Setiawan <134618411+yusufarst@users.noreply.github.com>. Remote main and PR #19 merge match; CI #119 COMPLETED/SUCCESS, attempt 1, all eight individual jobs SUCCESS. No open/conflicting PR or AUTH-001 branch/record existed at preflight. A single Task branch was then created from that base. Dedicated ELLIGBLE GitHub configuration is used; no credentials are recorded here.

Reuse IdentityRuntime, Identity provisioning/directory/crypto, Tenant Access provisioning, existing platform people import/reissue/audit, PostgreSQL migrations and the existing exam enrollment projection. SEC-001 is completed history, not reopened. Its Task record is preserved unchanged; this registration performs its previously deferred tracker/landing synchronization.

Baseline accounting after registration: Total/Current **33**, DONE **1**, READY **1** (AUTH-001), IN_PROGRESS **0**, VERIFYING **0**, BLOCKED **31**, TODO/SUPERSEDED **0**, progress **1/33 = 3.03%**. The 78 internal dependency edges and R01–R31/G1–G10 coverage remain unchanged. The intermediate SEC-only reconciliation is DONE 1/VERIFYING 0/BLOCKED 32 before AUTH-001's separately justified BLOCKED → READY transition.

## 3. Bounded outcome and exclusions

In scope: Identity-owned ID generation/registry, one canonical Account per resolved Person across roles, persistence constraints/reservation foundation, deterministic migration/backfill, owning-domain allocation/replay, legacy INSERT compatibility, existing Identity writers and canonical read projections, and their tests. Existing platform import may create a new Person/Account under its existing authority; it must adopt the same binding/registry invariants atomically. The new allocator accepts an already authoritatively resolved Person, never name-based identity creation.

Out of scope: School Operator roster product/schema/import (ADMIN-001), public claim/verification/activation or recovery/reset journeys (AUTH-002/AUTH-003), new routes/role authority, Person merge, replacing an existing Account, official student-data collection, new UI/localization, shared design/token changes, workflow/dependencies/global fixtures, school infrastructure, production operations or blocker closure. No real student data before G7. No new Account on an ambiguous match or recovery. Academic/Tenant writes occur only through their owning APIs; a shared transaction is not cross-domain write permission.

No Student Attempt, answer, timer, lifecycle, session/takeover authority, scoring or submission change. Existing cards/usernames/UUIDs and activation policy remain compatible. Canonical ID read convergence in exam-provisioning must not create/remove enrollments or participants. Future claim/reset implementation remains separately gated even though its policy inputs are recorded below.

## 4. Approved O01/O03/A03 decisions

### 4.1 O01: generated ID and legacy namespace

- New generated ID is exactly 18 ASCII characters, `elg-xxxx-xxxx-xxxx`; each `x` is from **abcdefghjkmnpqrstuvwxyz23456789** (31 symbols). Use cryptographic unbiased rejection sampling, not modulo-biased random selection or PII-derived values.
- Global uniqueness and non-reuse are enforced by the immutable registry, not a UI/preflight check. Try at most ten random candidates under savepoints for generator collisions; exhaustion rejects and rolls back the operation. This does not authorize transaction retry or CI rerun-to-PASS.
- Existing usernames remain byte-for-byte unchanged. Resolve exact legacy username first. Only a registry entry with GENERATED origin may supply the new generated-ID ASCII case-folded fallback; a legacy entry does not silently gain aliases. Reserved generated-format keys are normalized to lowercase for collision prevention even when a historical matching username has LEGACY origin; other legacy keys remain exact. Normalization must be shared by migration, trigger and owning lookup/generator.
- Any ambiguous legacy case/namespace collision stops migration without renaming, reassigning or choosing a winner. An identifier remains reserved after invalidation; no normal update/delete can make it reusable. Non-reuse covers identifiers known at adoption and subsequently registered; identifiers deleted before the baseline cannot be reconstructed or falsely certified.

### 4.2 O03: approved future lifecycle inputs, not new endpoints

Owner approved **claim validity seven days**, **reset validity fifteen minutes**, **maximum ten failed attempts** for the new claim/reset lifecycle. Validity starts at server creation/issuance, expiration is reached at `now >= expires_at`, replay never extends it, and attempts/consumption must be serialized. These are not replacements for existing activation-code validity, DEC-041 login lockout, MFA or step-up policy. AUTH-001 does not implement or enable those public workflows.

Preserve the approved principles: a claim alone never activates an Account; scoped school-assisted verification with minimal proof; no stored raw proof documents in this foundation; single-use reset; atomic credential/session revocation; same Person/Account/Participant/Attempt. No second Account or Person for recovery. Claims/rejections/resets use enumeration-safe outward responses and attributable audit without proof/credential leakage. Detailed user journeys, notification handling and applicable legal/privacy inputs remain prerequisites for their responsible later Tasks; this bounded approval does not close all O03 work or excluded P5 C capabilities.

### 4.3 A03: exact identity key and ownership

The global internal identity key is **identity_persons.id (Person UUID)**. One immutable canonical Account binding per Person applies **across roles**, explicitly approved by the Owner; role changes use assignments, not another Account. At most one valid credential per Person; an activation-required credential with `is_valid = true` reserves that slot too. Invalid historical Accounts may remain without becoming canonical or being reassigned.

Identity owns Person, Account, credentials, login registry, reservations and allocation receipts. Academic Core owns official roster/academic truth, Tenant Access owns membership/assignment boundaries. The future authoritative roster reference is `(tenant UUID, immutable roster-record UUID)` through owning-domain resolution; AUTH-001 does not create that table or infer its values. NISN/date of birth are matching inputs under OD-05, not a global unique key or proof of equivalence between arbitrary Person UUIDs. Ambiguity refuses allocation; no automatic Person merge or new identity fallback. The persistence guarantee is per authoritatively resolved Person, not a claim that arbitrary duplicate real-world people have already been deduplicated.

## 5. Frozen migration/schema contract

Reserved future path: **database/migrations/0055_identity_student_identity_allocation.sql**. Main currently ends at 0054. Registration creates no SQL file and runs no migration; recheck number/path at Build entry and STOP on collision. Versioned Identity-owned changes only; no Academic/Tenant table changes.

| Relation / change | Required columns, constraints and behavior |
|---|---|
| identity_user_accounts | Existing id/person_id preserved; add UNIQUE(id, person_id) for composite references. Account → Person cannot be reassigned. Existing invalid history is retained |
| identity_person_account_bindings (new) | person_id UUID PRIMARY KEY/FK Person; canonical_account_id UUID NOT NULL UNIQUE; UNIQUE(person_id, canonical_account_id); composite Account/Person FK; source TEXT restricted to migration/existing provisioning/authorized allocation; established_at TIMESTAMPTZ server time. Binding ownership immutable, no ordinary delete/reassignment |
| identity_account_credentials | Add person_id UUID NOT NULL, deterministically derived from its Account; composite FK(user_account_id, person_id) → identity_user_accounts(id, person_id). Partial UNIQUE(person_id) WHERE is_valid. Stored generated valid_account_id UUID is user_account_id when is_valid, otherwise NULL; deferred composite FK(person_id, valid_account_id) → bindings(person_id, canonical_account_id). Thus an invalid noncanonical historical Account cannot be made valid. Preserve all credential/authentication fields |
| identity_login_identifiers (new) | identifier_key TEXT PRIMARY KEY using §4.1 normalization; original_username TEXT NOT NULL; user_account_id/person_id UUID NOT NULL composite Account/Person FK; origin TEXT LEGACY or GENERATED; allocated_at TIMESTAMPTZ server time; UNIQUE(original_username, user_account_id, person_id). Credential (username, user_account_id, person_id) must reference its exact registry owner. Key/username/owner/origin immutable; no ordinary deletion, including after credential invalidation |
| identity_student_claim_reservations (new) | id UUID PRIMARY KEY; person_id UUID NOT NULL/FK; tenant_id UUID NOT NULL scoped through owning Tenant authority; created_at/expires_at TIMESTAMPTZ NOT NULL; closed_at TIMESTAMPTZ NULL; closure_kind TEXT NULL. CHECK expires_at > created_at and coherent closure pair. Partial UNIQUE(person_id) WHERE closed_at IS NULL; no clock expression in an index. Explicit authorized transaction closes expiry before another reservation. This is a duplicate-producing allocation reservation, not every claim/recovery record; an existing binding cannot be used to reserve allocation of a replacement Account |
| identity_id_allocation_events (new) | id UUID receipt PRIMARY KEY; operation TEXT; actor_kind/actor_ref TEXT; tenant_id UUID; request_key UUID; protocol_version SMALLINT = 1; request_digest TEXT lowercase 64-hex SHA-256; person_id/user_account_id UUID and identifier_key references; outcome TEXT allocated/existing; occurred_at TIMESTAMPTZ server time. Required actor/operation/scope references and valid outcome/reference checks; unique actor-kind/ref/operation/request-key namespace. Append-only; no password, plaintext activation/reset secret, NISN, birth date or raw proof |

DB constraints/guards, not only helpers, must enforce exact Account/Person/registry ownership, immutable binding, valid-credential canonical membership, non-reuse and one open duplicate-producing reservation. Account binding and reservation writers serialize on the same Person; binding establishment closes its matching open reservation atomically and refuses conflicting scope. Cross-table guards prevent a new allocation reservation once canonical binding exists. This does not prevent a later workflow from claiming/verifying the existing Account without replacement allocation.

### 5.1 Migration compatibility and refusal rules

1. In one controlled migration transaction, preflight duplicate valid Accounts per Person, inconsistent foreign keys, identifier collisions and ambiguous history. No partial migration/history record on refusal.
2. Backfill credentials.person_id only through existing Account FK. Choose the sole valid-credential Account as canonical; when none is valid, choose only a sole existing Account. Multiple candidates without an authoritative unique choice STOP; never choose lexicographic/arbitrary identity. A Person without an Account needs no binding.
3. Adopt every existing credential identifier with LEGACY origin. Preserve usernames, Person/Account UUIDs, password verifiers, activation codes, sessions, failure counters, answers and results. Install compatibility/immutability guards after deterministic adoption and validate the constraints.
4. Empty DB, populated 0054 upgrade, known-conflict rollback and repeated migration invocation must be verified through existing migration machinery. No destructive down migration, account merge/delete, automatic repair, production migration execution or manual data mutation authorized.
5. A Build-time conflict is a STOP with diagnostic counts/opaque references, not printed PII or a permission to discard existing data.

## 6. Atomic protocols, locks and reviewed legacy correction

### 6.1 Owning writers and replay

New allocation uses the caller's existing PostgreSQL client and READ COMMITTED transaction: command-key advisory lock → resolved Person **FOR NO KEY UPDATE** → binding/reservation → Account reference (no exclusive Account update) → identifier registry reservation → credential where needed → receipt/caller audit. A legacy credential INSERT performs the complete Person → binding → registry compatibility sequence in §6.2 before accepting its credential row. Multi-subject work orders Person UUIDs and shared identifier/membership advisory keys deterministically before effects, not by CSV input order. Import output still follows original CSV rows. No nested BEGIN or separately committed Identity effect.

The owning application service must validate actual existing platform/operator or authenticated tenant authority through owning contracts before mutation or receipt lookup; an actor label or caller-supplied Person/tenant is not authorization. No new School Operator capability is granted. Semantic SHA-256 binds protocol, operation, actor scope, tenant, Person and normalized request fields. Same actor/request key and semantics return the original Account/ID/receipt without another effect; changed semantics refuse. Other actors/scopes cannot retrieve the receipt. Never replay a plaintext activation secret or implicitly reissue it. Existing explicit audited reissue remains the recovery path for a lost card.

If any Account already exists for Person, resolve the approved canonical Account or refuse ambiguity; never allocate a replacement Account. Allocation, reservation closure, binding, registry, receipt and required caller audit commit together; receipt/audit failure rolls them all back. SQL deadlock/serialization conflict (40P01/40001) causes whole-operation rollback and bounded conflict, no automatic transaction retry.

| Existing writer / reader | Preserved or required sequence |
|---|---|
| createActivationRequiredAccount / people import | Existing trusted new-Person provisioning authority retained; create Person/Account, then §6.2 compatibility sequence and credential, initial activation and caller audit in existing whole-import transaction. Existing cross-school linking still requires its explicit authority; no fuzzy person matching |
| authenticate | Keep credential FOR UPDATE → failure/success update → new session. Do not add Person/binding acquisition after credential lock |
| activate | Keep credential FOR UPDATE → activation FOR UPDATE → consume/password/session. Recheck applicable server time after waiting on locks; existing expiry/attempt/password policy values stay unchanged |
| issueActivation / platform reissue | Credential FOR UPDATE → current activation → existing password/session revocation where requested → new activation/audit. Owning helper requires caller-held credential lock or a newly inserted credential owned by that transaction; no new Person/binding lock |
| Session mutation / ordinary resolve | Preserve SEC-001 mutation locks Session FOR UPDATE then Account FOR SHARE and post-lock time check; ordinary resolve remains distinct. No exclusive Account → existing Session inverse lock path |
| Directory / enrolled-student projection | Read canonical binding through Identity-owned lookup on caller client; replace arbitrary directory choice and all-Accounts enrollment join. Preserve enrollment IDs, tenant/time scope, API shape and participant semantics; no Academic/Tenant write |

### 6.2 Targeted A03 correction: legacy credential INSERT

Original Independent Identity/Security contract review **STOP**: the candidate required binding/registry references, but its compatibility trigger only populated person_id. Existing `runtime/secure-assessment/test/support/fixtures.ts` inserts Person, Account and credential with separate pool queries; it would fail new constraints. The production provisioning helper also needs the same compatibility contract. Fixture/test modification is not the remedy.

Owner authorized this targeted correction; **targeted Independent Identity/Security re-review PASS, 2026-11-02**, on the following exact contract:

1. A dedicated **BEFORE INSERT** credential compatibility trigger resolves the existing Account's authoritative Person, refuses missing Account or supplied person_id mismatch and acquires that Person **FOR NO KEY UPDATE before credential insertion**.
2. Under that lock, establish canonical binding only for the first legitimate unambiguous Account. Reuse an existing binding only for the identical Account/Person. Other Account candidates/conflicting binding fail closed, without reassignment or a new Person.
3. Reserve the immutable identifier registry key after binding. Reuse only the identical original username/Account/Person and appropriate existing origin. Identifier, namespace/case or tombstone conflicts fail closed; never overwrite another reservation. Populate NEW.person_id, then admit the credential under the required constraints.
4. Binding, registry and credential effects use the **same statement/transaction**. An exception rolls back that statement; the owning import/allocation wrapper rolls back its whole transaction. Do not catch-and-continue, silently skip a conflict or commit a helper independently.
5. A deferred consistency guard validates newly established binding/registry effects against an actual matching credential at transaction completion. INSERT ON CONFLICT DO NOTHING/DO UPDATE or another suppressing trigger must not leave an orphan registry/binding; inconsistency rejects the transaction. Exact reuse must still pass ownership/immutability constraints.
6. The existing fixture's preceding autocommit Person/Account statements are not retroactively rolled back. The guaranteed atomic unit is the credential INSERT plus its binding/registry effects, or the whole explicit caller transaction. No partial new binding/registry/credential survives failure.
7. Credential UPDATE paths do not acquire the INSERT trigger's Person/binding locks. Login/activation/reissue retain their credential-first sequences; key ownership remains protected by relevant constraints/immutability guards. No artificial fixture focus/state repair, fixture rewrite or assertion weakening.

Required real-PostgreSQL oracles: unchanged autocommit fixture and transactional import succeed; concurrent first Accounts for one Person cannot produce two canonical/valid credentials; another Person's duplicate identifier and Account/Person mismatch reject without partial new binding/registry/credential; skipped/conflicting INSERT cannot leave orphan effects; explicit transaction failure restores its pre-command snapshot; login/activation lock behavior remains compatible. These are defined acceptance oracles, **not executed test PASS claims**. Re-review covers the contract defect only, not implemented SQL or whole-release security.

## 7. Exact closed implementation allowlist

Exactly **20 repository-relative paths**, no globs. The Owner Build/CI-first grant in §12 now authorizes rows 1–20. Earlier registration-only/future labels in the inventory preserve that checkpoint. No 21st path, dependency, shared fixture or ADR without separate Owner approval.

| # | Exact path | Registration / future purpose |
|---:|---|---|
| 1 | docs/production/tasks/AUTH-001.md | NEW contract/record; current documentation |
| 2 | docs/production/TASK_PLAN.md | Current READY/status/SEC-001 landing synchronization |
| 3 | docs/production/PRODUCTION_COMPLETION_PLAN.md | Current evidence/critical path/continuity |
| 4 | docs/production/CBT_DOMAIN_RULES_SPECIFICATION.md | Current bounded O01/O03/A03 decisions |
| 5 | docs/production/CBT_ARCHITECTURE_DELTA_REVIEW.md | Current accepted A03 technical-contract pointer |
| 6 | docs/production/CBT_PERMISSION_MATRIX.md | Current bounded identity-policy applicability/default-deny |
| 7 | docs/DOCUMENT_MANIFEST.md | Current registration/navigation |
| 8 | database/migrations/0055_identity_student_identity_allocation.sql | NEW, reserved future Identity migration; not created |
| 9 | runtime/identity-access/src/elligble-id.ts | NEW, future generator/normalization |
| 10 | runtime/identity-access/src/student-identity.ts | NEW, future canonical allocation/reservation/receipt API |
| 11 | runtime/identity-access/src/provisioning.ts | Future compatibility integration |
| 12 | runtime/identity-access/src/directory.ts | Future canonical read lookup |
| 13 | runtime/identity-access/src/index.ts | Future legacy/generated lookup and compatible time/lock handling |
| 14 | runtime/identity-access/test/elligble-id.test.ts | NEW, future generator tests |
| 15 | runtime/identity-access/test/runtime.test.ts | Future Identity regressions |
| 16 | runtime/secure-assessment/src/ops/provisioning/people.ts | Future existing import/reissue integration |
| 17 | runtime/secure-assessment/src/exam-provisioning.ts | Future canonical enrollment read projection only |
| 18 | runtime/secure-assessment/test/integration/identity-allocation.test.ts | NEW, future PostgreSQL concurrency/constraint/migration tests |
| 19 | runtime/secure-assessment/test/integration/provisioning.test.ts | Future import/old-card regression |
| 20 | runtime/secure-assessment/test/integration/account-activation.test.ts | Future activation/reissue/session regression |

Forbidden classes include every other source/test/migration, frontend/assets/styles, e2e/global fixture and browser specs, workflow/config/dependency files, other Task records, LOCKED/FROZEN source decisions, other projects and production resources. Changes to Academic Core or Tenant Access implementation are not authorized; use existing APIs. No source/migration file is created by registration.

## 8. Acceptance gates for future Build (C01–C16)

All implementation gates below remain **NOT EXECUTED / NOT PASS** at registration. Defined expected results make a Task READY; its own verification evidence is produced during Build, not demanded before it can start.

| Gate | Exact acceptance oracle |
|---|---|
| C01 | Generated IDs match §4.1 alphabet/format with unbiased generation; collision injection tests reach the ten-candidate bound and full rollback without weakening randomness |
| C02 | Registry enforces global uniqueness/non-reuse, exact legacy lookup and generated-only fallback; reserved-key/case conflict refuses without rename or data loss |
| C03 | One canonical Account/Person across roles and at most one valid credential; direct SQL rejects duplicate valid Account, Account/Person mismatch and reactivation of noncanonical history |
| C04 | Allocation uses authoritative existing Person and owning-domain boundaries; ambiguous/mismatched/cross-tenant references never create or merge another Person or expose peer identity |
| C05 | At most one open duplicate-producing reservation per Person; expiry closure and binding creation serialize, no replacement allocation for existing Account; future public claim/reset remains disabled |
| C06 | Concurrent same-subject/same-key requests yield one logical allocation/receipt; changed semantic replay and unauthorized receipt access refuse without mutation |
| C07 | Injected registry/receipt/caller-audit failure rolls back all effects in the command transaction; no partial Account/credential/claim/registry change or returned false success |
| C08 | Targeted legacy INSERT compatibility and skipped-INSERT/deferred guard oracles in §6.2 pass unchanged fixtures/assertions, including direct SQL negatives and exact rollback boundaries |
| C09 | Existing authenticate/activate/reissue/session-mutation writers preserve lock order, revocation, single-use/expiry decisions and post-wait time correctness under representative concurrent operations |
| C10 | Empty, populated 0054 upgrade, conflict refusal and repeated migration pass; legacy UUIDs/verifiers/cards/sessions and stored assessment data preserved without auto repair |
| C11 | Existing people import/reimport/link-existing/reissue retains atomicity, original card/CSV contract and explicit cross-school authority; no replacement Account or leaked secret on replay |
| C12 | Directory and enrollment projection resolve canonical ID exactly once per existing enrollment; tenant/date/group scope, participants, results and existing API response shape remain compatible |
| C13 | No new route/UI/role authority/vendor/dependency; unchanged Student answer ACK/offline/recovery/timer/session/submit and teacher/proctor security regressions pass; P5 excluded C/default-deny and G7 preserved |
| C14 | Entire exact-candidate typecheck/unit/regression/build, real PostgreSQL, image smoke and five browser projects PASS with actual inventory recorded, no skip/assertion weakening/rerun-to-PASS |
| C15 | Exact 20-path scope, migration path, owning writes/locks/replay/secret/identity/attribution/whitespace guards verified; 33 Tasks/78 edges/R/G coverage unchanged, PB05 OPEN |
| C16 | Exact implementation content and evidence independently reviewed HIGH-risk/Identity-Security PASS, Owner acceptance recorded, then sole separately authorized Task-record evidence commit; no automatic merge or blocker closure |

## 9. Verification order and CI-first plan

**Present authorization:** seven-file documentation registration only. Perform lightweight scope, link, decision consistency, 20-path inventory, 33-row/78-edge DAG/counter/R/G, identity/attribution/secret and whitespace guards; controlled content commit, normal push and one Task PR. Let existing push CI run automatically; record its actual exact SHA/run/attempt/results without claiming implementation or carrying forward old test counts. No manual dispatch/rerun and no heavy local tests. Registration does not produce another evidence-only commit or mark AUTH-001 DONE.

**Future Build plan, frozen but execution NOT AUTHORIZED:** Owner must explicitly authorize Build and the Task-specific CI-first verification order before implementation content is committed ahead of heavy verification (TASK_PLAN §4.9). Do not inherit SEC-001 or governance CI-first permission. After permitted targeted source/typecheck/static guards, one controlled implementation candidate is pushed normally on this same Task branch/PR. Full verification runs on that exact content SHA, attempt 1, using the unchanged existing workflow on ubuntu-24.04: Runtime typecheck/unit/PostgreSQL integration; Web typecheck/full Vitest/build; container/image smoke; mobile-360, tablet-768, desktop-1280, firefox-1280 and webkit-390 browser jobs. All eight must individually SUCCESS; preserve complete inventory and existing browser assertions. No assumed historical 344/346/22 total, test reduction or retry-to-PASS.

Required targeted PostgreSQL tests are added in the allowed integration paths and use synthetic data under CI, not a local database. Defined race tests use barriers/controlled transactions, not sleep-based success. All failure evidence is retained; failed verification stops for bounded assessment/authorization, not an automatic corrective commit. No local Docker, DB, ports, global environment/process operations, provisioning or production command.

No material UI is proposed, so no new screenshot harness or visual redesign is required. Existing five-browser regression/artifacts continue unchanged; any discovered need for UI/source outside §7 requires STOP, not implied scope. Full accessibility/device/security/release certifications are not inferred from contract review or browser CI. PB05/G6 closure, PB06/PB07, capacity, legal, restore and UAT evidence remain with their responsible Tasks and G1–G10 gates.

## 10. READY verification and Build stop boundary

| READY prerequisite | Verified contract-registration disposition |
|---|---|
| P11 active / predecessor DONE | Active 33-Task baseline; SEC-001 reviewed/accepted, merged PR #19, exact-main CI #119 PASS; synchronized without changing its completed record |
| O01/O03/A03 authority | Explicit Owner approval and targeted correction authorization; exact bounded decisions §4–§6, Independent contract re-review PASS; no mandatory AUTH-001 input left as an invented policy |
| Exact outcome / impacts | §3/§5–§8 freeze Person key, owners, schema/path, all existing writer sequences, migration compatibility, rollback/replay and expected tests; no new route/UI/localization or cost/vendor impact |
| Scope | Owner accepted 20-path candidate; current authorization only seven documentation files. New source/migration names are future reservations, not existing implementation |
| Tests / tools / reviewers | Existing CI/toolchain available, full exact-content plan and oracles defined; independent contract review commissioned/completed, independent implementation review mandatory before DONE; no heavy local execution needed to register |
| Registration | This record, bounded policy pointers, official tracker, living checkpoint and manifest updated together; no active IN_PROGRESS/VERIFYING Task remains |
| Separate execution authority | **NOT GRANTED. READY is not Build authorization.** STOP after registration publication; request explicit Build/CI-first authority before any source/test/migration change |

READY at this stage certifies the registered input contract only. No SQL, application, test or load implementation has passed by implication. A new mismatch in migration number, baseline, scope or authority must stop Build preflight. Final production readiness remains NOT ACHIEVED; all applicable OPEN blockers, approved P5/P6 boundaries and LOCKED/FROZEN requirements stay in force.

## 11. Review, authorization and status history

| Date / event | Evidence / disposition |
|---|---|
| 2026-11-02 preparation | Read-only repository/source review on main 89d725c; candidate 20-path contract, O01/O03/A03 decisions prepared; AUTH-001 remained BLOCKED, no implementation |
| Owner final decisions | O01 format/alphabet/global uniqueness/non-reuse/legacy approved; O03 seven-day claim/fifteen-minute reset/ten failures approved, existing activation unchanged; A03 canonical Account across roles and candidate 20-path constraints/locking/rollback/replay/migration compatibility approved |
| Original independent contract review | STOP for missing binding/registry establishment on legacy credential INSERT; fixture/source verified, no existing fixture assertion changed |
| Owner targeted correction / re-review | Owner approved §6.2 atomic compatibility correction; targeted Independent Identity/Security re-review PASS, no remaining material defect in that correction and no 21st path; review of contract only, not implemented SQL/tests |
| Owner contract-registration authorization | Seven proposed documentation files, controlled commit, normal push, one AUTH-001 branch/PR, verify READY, STOP before Build. No source, migration execution, PB05 closure, LOCKED change or deployment |
| Current transition | BLOCKED → READY, contract registration only, after input/review/registration guards; not IN_PROGRESS/VERIFYING/DONE. SEC-001 post-merge reconciliation gives DONE 1/33; remaining 31 Tasks BLOCKED |

Local registration guards PASS: exactly seven authorized changed documentation paths; 20 unique numbered implementation paths with the same seven-document subset; 33 unique baseline rows/78 acyclic edges; unchanged dependency/external-gate columns, other 31 rows and R/G reference set; counters DONE 1/READY 1/BLOCKED 31; local Markdown file references resolve; whitespace and Owner author/committer identity verified. Application/runtime/e2e/database/workflow trees remain unchanged and the reserved migration is absent. The protocol overview was aligned with the reviewed binding → registry → credential INSERT order; no policy or scope change.

Actual staged/commit scope, raw message, parent and remote synchronization must be inspected before/after publication. A commit does not contain its own SHA. No new exact-content CI, implementation acceptance, further independent review, Owner Build grant or release PASS is invented in this record. The single normal push/PR is the publication boundary; subsequent work requires explicit Owner authority.

**PB05 OPEN. No automatic Build, merge, deployment, successor or evidence-only finalization.**

## 12. Owner-authorized Build and verification checkpoint, 2026-11-02

Owner explicitly authorizes AUTH-001 Build/CI-first from registered 93a4ac42fa0fa6165f9d378821273ea63d2a1fa9, existing branch/PR #20. Registration CI #120/run 41402361878 attempt 1/eight SUCCESS. The earlier registration-only/Build-NOT-AUTHORIZED paragraphs are historical and superseded only by this bounded execution grant. No policy, scope, dependency or LOCKED change.

Status history: READY → IN_PROGRESS on this grant; implementation/source/targeted verification → VERIFYING for exact-content CI/review. No DONE. Current baseline counters: 33 total, DONE 1, VERIFYING 1, BLOCKED 31, READY 0, IN_PROGRESS 0; 78 dependency edges unchanged.

Implemented: 0055 deterministic adoption and constraints; canonical Account/Person binding and immutable global registry/receipts; INSERT-only legacy compatibility with deferred orphan guard; Person-serialized reservations; cryptographic generated IDs, ten-collision savepoint bound and semantic replay; caller-owned READ COMMITTED transactions, required owning authorization/audit adapters and post-wait authority rechecks. No new public claim/reset route or role grant. Existing provisioning retains v1 CSV/card behavior and acquires deterministic batch locks; Identity lookup uses exact legacy precedence and GENERATED-only fallback; credential-first login/activation/reissue locks stay intact with post-lock time checks; enrollment/directory reads converge on canonical Identity lookup without academic writes.

Targeted local verification: generator/normalization and ten-collision rollback tests PASS (2 tests); AUTH-001 post-credential-lock authentication time/no-Person-lock regression PASS (1 test). Existing tests/assertions retained. Typechecks for Identity and Secure Assessment PASS during authoring; a new test predicate UUID/string typing mismatch was corrected without oracle change, final typecheck repeated before publication. No local PostgreSQL, full suite, build, Docker, port or global-process operation.

Added CI PostgreSQL oracles cover legacy autocommit INSERT, canonical/registry adoption, direct SQL ownership/duplicate/skipped INSERT refusal, whole-command audit rollback, same-key concurrency/replay, authorization before replay/cross-tenant denial, reservation uniqueness, empty/latest DB, populated 0054 migration/refusal/repeat, invalid historical Account preservation, old card/import regression and generated-ID activation/reissue/session continuity. Defined synthetic owning-adapter callbacks in tests are not production routes or new platform authentication. Future product callers must supply real owning authorization/audit adapters; caller labels alone never grant authority.

C01–C13 implementation/oracles prepared, full PostgreSQL and regression evidence PENDING automatic CI on the actual implementation SHA. C14 PENDING eight-job/five-browser exact-content CI. C15 requires final scope/DAG/identity/whitespace guards; C16 PENDING Independent HIGH-risk/Identity-Security Review and Owner acceptance. No implementation acceptance or test-count claim from earlier runs. If CI fails, STOP and retain precise failure; no rerun, second correction, evidence finalization, merge, PB05 closure or deployment automatically.

The derived Graphify graph is not rewritten because it is outside the exact 20-path allowlist; current source remains authoritative. This candidate never records its own commit SHA. After successful exact-content CI, hand over for Independent Review while remaining VERIFYING / NOT DONE. PB05 OPEN.

## 13. Final implementation review, Owner acceptance and completion evidence, 2026-11-03

**AUTH-001: DONE — ELLIGBLE ID and canonical Account foundation only.** Classification remains HIGH risk, active P11 baseline Task. This final checkpoint supersedes the pending/NOT DONE wording in the historical registration and Build checkpoints above; it does not change their recorded outcomes or the frozen contract.

### 13.1 Content, review chain and explicit acceptance

| Checkpoint | Verified evidence / disposition |
|---|---|
| Registered contract | 93a4ac42fa0fa6165f9d378821273ea63d2a1fa9; CI #120/run 41402361878, attempt 1, eight SUCCESS. Contract review and targeted legacy INSERT contract re-review remain separate from actual implementation review |
| Initial implementation | 9c7ba74da7c496871c6d6aa924299cb101049899, parent registered contract; exact 20-path implementation scope. [CI #121](https://github.com/yusufarst/elligble/actions/runs/41428840090), attempt 1, eight SUCCESS; PostgreSQL 190 PASS |
| Initial Independent HIGH-risk/Identity-Security implementation review | STOP on actual implementation 9c7ba74: C09 lacked real-PostgreSQL credential/session writer interleavings and expiry-during-lock evidence. C01–C08/C10–C13 inspected without a reported material defect; C14/C15 CI/scope/metadata verified separately. This was an evidence gap, not a demonstrated application vulnerability. Green CI did not override STOP |
| Owner-authorized C09 correction | Only runtime/secure-assessment/test/integration/account-activation.test.ts changed, +185/-0, all original lines/assertions retained. Six controlled interleavings cover both orders of reissue versus authentication, activation and session mutation; two cases cover expiry while waiting for credential or activation locks. Real SQL barriers and pg_blocking_pids prove contention; no sleeps, fake contention, production-source correction or fixture/workflow change |
| Final reviewed content | **82a96a55778c338dc9aa658f9b921c4b18a73b01**, parent 9c7ba74da7c496871c6d6aa924299cb101049899. Production source and migration identical to the initial implementation reviewed above; cumulative implementation scope remains exactly the §7 20 paths |
| Targeted Independent Identity/Security re-review | **PASS on exact 82a96a55778c338dc9aa658f9b921c4b18a73b01**, by the same independent implementation reviewer. Actual test diff/locks/snapshot oracles inspected; C09 evidence gap explicitly closed, no remaining material defect found in the correction; prior source assessment preserved. Reviewer explicitly stated readiness for Owner Acceptance and that C16 still required acceptance/final evidence |
| Final review disposition | **Independent HIGH-risk/Identity-Security PASS for final content 82a96a5**, composed of the original actual-source assessment and the exact-SHA targeted closure of its sole reported blocker, with final CI/scope evidence below. This records that review chain, not a fabricated separate full-review attestation or a substitution of contract review for implementation review |
| Owner Acceptance | Explicitly received 2026-11-03 for exact 82a96a55778c338dc9aa658f9b921c4b18a73b01, citing CI #122 eight SUCCESS/attempt 1, PostgreSQL 200/200, targeted C09 re-review PASS, approved 20-path scope and no remaining reported material defect |
| Final evidence authorization | Owner separately authorized exactly ONE evidence commit modifying only this Task record, normal push to existing [PR #20](https://github.com/yusufarst/elligble/pull/20), then STOP. No source change, unnecessary test repetition, merge, deployment or PB05 closure |

The old registration-era identity comment is not an implementation review result. Its reviewed commit was 93a4ac4; actual local Git and GitHub commit metadata for 93a4ac4 and 9c7ba74 show the Owner as author/committer, without attribution trailers. Final 82a96a5 likewise has the Owner identity. The contrary comment is not supported by the inspected immutable metadata; no published history was rewritten.

### 13.2 Exact-final-content verification

[CI #122 / run 41443162362](https://github.com/yusufarst/elligble/actions/runs/41443162362): automatic push event, exact final content **82a96a55778c338dc9aa658f9b921c4b18a73b01**, **attempt 1**, COMPLETED / SUCCESS, **eight of eight jobs SUCCESS**, ubuntu-24.04. No rerun, dispatch or retry-to-PASS.

| Job | Result / actual inventory |
|---|---|
| Web client (125269749696) | SUCCESS; typecheck, **346/346 tests in 34 files**, build PASS |
| Runtime (125269750192) | SUCCESS; typecheck PASS; Identity 28, Tenant Access 13, Academic Core 3 and Secure Assessment 911 unit tests PASS; real PostgreSQL 16 integration **200/200 PASS**, zero failures/skips |
| Container image (125270271887) | SUCCESS; build and PostgreSQL smoke PASS |
| mobile-360 (125270271962) | SUCCESS; **22/22 E2E PASS** |
| desktop-1280 (125270272021) | SUCCESS; **22/22 E2E PASS** |
| tablet-768 (125270272083) | SUCCESS; **22/22 E2E PASS** |
| firefox-1280 (125270272120) | SUCCESS; **22/22 E2E PASS** |
| webkit-390 (125270272265) | SUCCESS; **22/22 E2E PASS** |

The eight C09 subcases all PASS. The two new parent tests plus eight subtests explain PostgreSQL inventory 190 → 200. The barriers execute real queries before holding locks; ordering must complete while independent Person/binding locks remain held. Expiry cases prove initial validity/blocking, then wait for actual database/process clocks to cross the isolated synthetic expiry before release. Exact INVALID_ACTIVATION and unchanged credential/session/consumption state are asserted. No repeated operation masks a failure.

Evidence sources: exact-run/job metadata and raw CI job logs; existing local targeted results in §12; C09 source/typecheck/whitespace guards PASS. Finalization reads those existing results and performs deterministic documentation/Git guards only, with no test/CI rerun or local database. Browser logs confirm all five inventories; successful workspace-artifact upload steps remain intact. No new UI or manually inspected visual-quality/accessibility certification is claimed for this non-UI Task.

### 13.3 Acceptance C01–C16 disposition

| Gate | Final result / evidence |
|---|---|
| C01 | PASS — generator/normalization and bounded collision rollback tests; Identity unit and PostgreSQL suites; actual-source independent assessment |
| C02 | PASS — immutable registry/ownership constraints, exact legacy lookup and GENERATED-only fallback; collision/namespace and non-reuse negatives; PostgreSQL and source review |
| C03 | PASS — canonical Person/Account binding and valid-credential constraints; direct SQL duplicate/mismatch/noncanonical history refusal; PostgreSQL and source review |
| C04 | PASS — existing authoritative Person, required owning authorization/audit adapters and post-wait checks; cross-tenant/semantic-conflict zero-mutation tests; no Person merge or new public authority |
| C05 | PASS — Person-serialized reservation/binding guards and one-open-reservation constraint, conflict/rollback tests; no replacement allocation or public claim/reset workflow |
| C06 | PASS — concurrent same-key replay has one logical receipt/effect, different keys retain one Account; changed-scope replay and unauthorized/cross-tenant requests refuse without mutation |
| C07 | PASS — injected failure/collision/audit rollback and exact pre/post snapshots; savepoint/caller-transaction source review; no partial command effect |
| C08 | PASS — unchanged autocommit fixture and transactional import; direct SQL mismatch/duplicate/skipped INSERT/deferred orphan guards and rollback assertions |
| C09 | PASS — six real PostgreSQL writer/session interleavings and two post-wait expiry cases at final SHA; revocation/identity/snapshot oracles intact; targeted independent re-review PASS |
| C10 | PASS — empty/latest database, populated 0054 upgrade, ambiguous conflict atomic refusal and repeat migration; legacy verifier/UUID/history preserved; complete regression suite |
| C11 | PASS — existing import/reimport/link/reissue/card regressions and atomicity/security assertions; source review preserves explicit existing authority and credential/session revocation |
| C12 | PASS — canonical directory/enrollment read integration, existing scope/shape and participant/results regressions; no Academic write or new enrollment behavior |
| C13 | PASS — unchanged route/UI/role/vendor/dependency surface, P5 excluded C/default-deny and G7; complete five-browser and Runtime security/answer/timer/session/submit regression |
| C14 | PASS — exact-final-content CI #122, attempt 1, eight SUCCESS; full actual inventory above, including real PostgreSQL and five browser projects |
| C15 | PASS — exact cumulative 20 paths, unchanged 0055/source since original review, sole +185/-0 C09 correction; 33 Tasks/78 edges unchanged; Owner identity/raw messages, scope and whitespace guards; PB05 OPEN |
| C16 | PASS — original implementation assessment plus exact-SHA targeted C09 closure, final CI/scope verification, explicit Owner Acceptance and separate authorization; this sole Task-record-only evidence change records completion under DEC-045 |

### 13.4 Closure boundaries and publication controls

Status history: registered READY → Owner-authorized IN_PROGRESS → VERIFYING; initial independent implementation review STOP retained; Owner-authorized C09 correction → exact-SHA CI #122 PASS → targeted independent re-review PASS → Owner Acceptance → **DONE** through this authorized evidence record. Earlier pending and counter statements are historical checkpoints, not current closure claims.

Only this Task record changes in finalization. The official tracker/living plan remain at the previous VERIFYING checkpoint because this evidence authorization excludes them. Their next authorized post-merge synchronization must record AUTH-001's completion/landing and reconcile **DONE 2/33 (6.06%), VERIFYING 0, BLOCKED 31, READY 0, IN_PROGRESS 0**; this is the completed-Task disposition, not a claim that those files have already been edited. Total 33 and 78 internal dependency edges remain unchanged; no successor becomes READY or authorized by inference.

Pre-publication guards: clean entry at the accepted SHA and synchronized upstream/remote PR head; PR #20 OPEN; Owner author/committer configuration and effective identity verified as Yusuf Arif Setiawan <134618411+yusufarst@users.noreply.github.com>. Publication requires exactly this one staged path, whitespace/reference/secret/attribution checks, parent equal to accepted content, actual raw commit metadata inspection, normal push and remote PR-head synchronization. The evidence commit does not record its own SHA and its own CI is not a recursive DONE prerequisite under DEC-045.

**PB05 remains OPEN.** All other applicable production blockers and G1–G10 remain mandatory; production is NOT READY. Preserve approved P5/O09 and P6/O07 boundaries, B09/O06/O08 exclusions and unknown school/capacity/operational facts. This records bounded AUTH-001 acceptance, not broad O03 lifecycle completion, legal clearance, blocker closure, implementation of AUTH-002/AUTH-003/ADMIN-001, deployment or production migration authority. LOCKED/FROZEN decisions and existing Student/Person/Attempt/answer/timer/session integrity remain unchanged. The Owner alone controls PR #20 squash merge. STOP after this evidence publication; no successor execution.
