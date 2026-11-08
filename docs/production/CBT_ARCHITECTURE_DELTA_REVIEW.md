> **AUTH-001 execution checkpoint, 2026-11-02:** Owner-authorized Build/CI-first now supersedes the registration-only/no-Build checkpoint below, only within AUTH-001 exact 20 paths. See [AUTH-001 §12](tasks/AUTH-001.md). Migration/source/tests prepared; exact-content CI/review pending, VERIFYING / NOT DONE. SEC-001 DONE 1/33 (3.03%), VERIFYING 1/BLOCKED 31/READY 0; 78 dependencies unchanged. All other policy/LOCKED/excluded boundaries, PB05 OPEN and G1–G10 preserved; no new route, merge or deployment.

**Status:** DRAFT / SUBMITTED FOR REVIEW; NOT APPROVED
**Task:** GOV-REALIGN-004; HIGH; PRE-P11 / PRE-BASELINE; NOT COUNTED IN P11 BASELINE
**Baseline:** `2c6a4860a71a40b5cfb344eae3b964dd5b983125`; verified 2026-10-30
**Authority:** P4 delta analysis only; no new ADR or architecture rewrite approved

# CBT-R1 necessary architecture delta review

> **Effective A03 foundation contract, 2026-11-02:** original draft headers and other delta proposals remain historical planning. The Owner approved the bounded Identity/Academic Core/Tenant Access design in [AUTH-001 §4–§6](tasks/AUTH-001.md), including its targeted Independent Identity/Security re-review PASS for legacy credential INSERT compatibility. This is contract registration only: no Build, SQL migration, new ADR, cross-domain write, policy supersession or PB closure is authorized. Other A01/A02/A04/A05 decisions and applicable downstream A03 work remain unresolved where their contracts require them.

## 1. Reuse boundary

[ADR-001](../decisions/ADR-001_AS_BUILT_STACK_AND_SELF_HOSTED_TOPOLOGY.md) remains the accepted Node/TypeScript modular monolith, one origin React/Vite/API, PostgreSQL, one image behind school nginx/VPS. [Domain ownership](../00-governance/00.07_DOMAIN_OWNERSHIP_AND_CONTRACTS.md), [critical assessment architecture](../architecture/SECURE_ASSESSMENT_CRITICAL_ARCHITECTURE.md), [identity/security architecture](../architecture/IDENTITY_ACCESS_AND_SECURITY_ARCHITECTURE.md) and [runtime reliability](../architecture/RUNTIME_RELIABILITY_AND_OPERATIONS_ARCHITECTURE.md) stay locked within exact supersessions. Their historical unselected topology/provider wording is resolved by ADR-001, not a new choice here.

Reuse identity-access for Person/account/credentials; tenant-access for membership/tenant resolution; academic-core for official academic groups/enrollments/teaching truth; secure-assessment for exam/participant/room/Attempt/Session/snapshot/answer/timer/submission/scoring. The location of official identity/roster attributes must follow existing ownership, not convenient SQL access. Command/application-service/owning-module contracts enforce cross-domain writes; a shared PostgreSQL transaction is not authority to write another domain's tables directly.

No broker, managed backend, Redis, extra service, new paid dependency or stack change is proposed as a prerequisite. Existing `server.ts`, `http/authenticated-context.ts`, `http/attempt-authorization.ts`, owning modules, versioned migration runner, frozen single-choice validator, answer/version/idempotency path, lifecycle/finalization locks and local queue are the reusable foundation. Existing tests/CI are evidence for those slices only. Graphify query was used as derived navigation (491-node historical graph); current source/canonical checks, not inferred graph relationships, establish this review. No graph rebuild or file outside the eight-file package is performed.

This review depends on [P2 definitions/O01–O09/consolidated R map](CBT_DOMAIN_RULES_SPECIFICATION.md), [P3 workflows](ROUTE_INTERACTION_MATRIX.md), [P5 authorization](CBT_PERMISSION_MATRIX.md) and [P6 measurements](PERFORMANCE_AND_LOAD_PLAN.md). Every row below is a necessary unresolved delta or implementation constraint. No new ADR text/file is created by this Task.

## 2. Necessary deltas and decision proposals

| ID / P1 | Existing / required delta | Proposed design boundary, not approved implementation | Required decision / impact evidence before implementation |
|---|---|---|---|
| A01 / R10–R17/R19/R25–R27 | PARTIAL: v1 single-choice snapshot/payload/scoring/final results; no mixed-type/manual/publication path | Extend through versioned discriminated frozen contracts and student-safe projections; reuse answer envelope, queue version/dedup, existing single-choice rule and immutable historical result truth. Grade/manual-completion state distinct from Attempt submission and publication. Transactional finalization waits for grading | Follow-up contract/version compatibility decision, ADR only if new material architecture choice arises. O02/O05 and P5 grading approval first; migration/backfill/old-client policy, per-type golden vectors, no-key projection, browser recovery and frozen-score compatibility tests. Never retroactively reinterpret stored v1 answers |
| A02 / R18/R19/R30/R31 | MISSING: safe image ingestion/storage/pinned delivery | **Proposed follow-up ADR decision: question-media storage and delivery.** Compare school-VPS immutable filesystem/rendition store vs another justified school-controlled store; keep version-pinned metadata owned by Assessment, authenticated tenant/object delivery, safe mime/size/decode pipeline, optimized renditions, backup/restore consistency and no raw-original student delivery | O06/O07, P5 upload/access/retention review, P6 media/device measurements; storage path/object naming, limits, deletion/GC, version pinning and broken-item recovery must be explicit. No external provider, format library or new recurring cost selected here. P9 backs up/restores DB and pinned assets coherently |
| A03 / R07–R09 | PARTIAL: existing Person/Account/Membership/cards reused; missing foundation implementation and downstream roster/claim/recovery workflows | **Owner-approved bounded AUTH-001 technical contract:** Identity owns Person/Account/credential/identifier/reservation; Academic Core owns roster/enrollment; Tenant Access owns membership. Person UUID anchors one canonical Account across roles; owning-module APIs compose shared transactions. Constraints/registry enforce uniqueness/non-reuse; no fuzzy Person merge | O01/O03 approved only within [AUTH-001](tasks/AUTH-001.md), with exact schema/locks/replay/rollback/compatibility and future 20-path footprint. Reserved 0055 migration remains uncreated. Downstream ADMIN-001/AUTH-002/AUTH-003 still need their own precise contracts, applicable privacy/G7 and execution authority; no prior PB05 closure or own implementation evidence is an AUTH-001 entry prerequisite |
| A04 / R20–R23 | PARTIAL: rooms/proctors/lifecycle exist; institution UI and safe running transfer missing | **Proposed follow-up ADR/consistency decision: institution exam composition and room-transfer/session contract.** P2 same Attempt/answers/time/snapshot/submission invariants; proposed active-session continuity with per-request committed room authorization; expected assignment revision and replay key, append-only transfer record in one transaction | O05 and P5 detailed matrix. Inspect existing exam→Attempt lock acquisition before choosing ordering; all involved writers must use compatible ordering. Prove no deadlock/authorization stale window across concurrent save/submit/expiry/lock/takeover/two transfers. Exact composition/session choice remains unapproved, no hidden session revocation or replacement |
| A05 / R24/R28/R31 | MISSING: full risk ingestion/feed/incidents; metrics/logs exist | **Proposed follow-up ADR decision: bounded risk ingestion, evidence storage and overload isolation.** Prefer existing process/PostgreSQL and bounded work; asynchronous relative to answering, no synchronous dependency of save/submit on signal processing. Tenant-derived attribution, dedupe, receipt/client-time distinction, scoped paging and attributable human review | O08/O09, retention PB02/PB10, P6 abuse/backpressure and privacy/security tests. Decide batch/size/retention/dedupe/index/cleanup policy and explicit overload states. Do not add broker/Redis preemptively, swallow evidence failure or turn missed signals into misconduct |

For A01, a code-level extension spec is needed even if no new ADR is justified; don't create ceremony merely to restate ADR-001. For A02/A04/A05 the table remains a decision brief, not acceptance of an alternative. A03 acceptance is limited to the AUTH-001 foundation, not all downstream identity workflows. A single later authorized decision may group compatible choices; no parallel implementation is implied. Each row must reference P2 policy Oxx, P3 Fxx and P5 action boundaries before it can be READY.

### 2.1 A03 legacy credential INSERT compatibility

The approved correction belongs to the reserved Identity migration, not to fixture changes. A credential `BEFORE INSERT` compatibility path derives and validates Account/Person, acquires the Person lock, establishes or verifies the first legitimate canonical binding, then establishes or verifies the immutable identifier registry before accepting the credential. Conflicts fail closed without reassignment. Binding/registry/credential effects share the credential statement and caller transaction; deferred consistency validation rejects orphan effects from a skipped `INSERT`. Previously autocommitted fixture Person/Account statements are not falsely included in that rollback guarantee. Existing login/activation credential `UPDATE` paths acquire no new Person/binding locks; SEC-001 session/account locking stays intact. Full schema, ordering and required PostgreSQL oracles remain in AUTH-001 §5–§8, avoiding a second competing implementation specification here. Targeted contract re-review PASS is not executed migration, concurrency or regression PASS.

## 3. Cross-cutting compatibility and operating constraints

- Migrations: versioned owning-domain changes only, tested from empty and upgraded databases, no destructive reset/backfill of accepted answers or historical scoring; P10 staging rehearsal and explicit database/rollback declaration. New snapshot/rule/client version handling must fail closed for unsupported types without making an active exam appear answerable.
- Student runtime: no arbitrary grading keys/media URLs in student payload; local storage envelope preserves type/intent across recovery; a deployment cannot silently discard pending v1 or new-type data. P3 receipt/resume reconcile the exact acknowledged state. No new service dependency may take down active answering.
- Security: every new read and mutation resolves membership and assignment plus tenant/exam/room/participant/object; authorize again in the transaction where scope changes can race. Keep private metrics off public routes; distinguish audited provisioning operator from School Operator. P5 tracks broader runtime gaps, not grants.
- Load: default pool max 10/connect timeout 5s and single process are implementation defaults, not sizing proof. Metrics are per process. P6 measures lock waits, event-loop delay, pool saturation, payload/media bandwidth, restart and NAT limits before any scaling/parameter change; P9 supplies actual school facts.
- Operations: media/identity/signal storage grows backup/privacy duties; include encrypted off-host backups, restore consistency, monitoring and incident responsibilities. Do not execute Docker, DB actions or load on the Owner workstation. Existing runbook manual-SQL session revocation needs a governed audited path before go-live (DEC-044 §11), not ad-hoc implementation in planning.

## 4. Review exit

Required outputs before implementation: explicit Oxx decisions/accepted technical contracts, approved P5 enforcement and negatives, migration and client-version plan, P6 workload/budget agreement, and P7–P10 dependencies represented. One integrated review checks that A01–A05 preserve P1 scope and canonical invariants. No architecture alternative or phase is marked APPROVED, no capacity/production claim or P11 baseline, no application/ADR/workflow change. PB05/06/07/11/12 and legal blockers remain open as applicable.

## ADMIN-001 bounded implementation checkpoint — 2026-11-03

A03 foundation AUTH-001 is DONE/merged main ebcc4ca/CI #124. ADMIN-001 candidate adds reserved 0056: Tenant-owned Operator assignment/events and Academic-owned official roster/revisions/receipts. Existing privileged CLI owns bootstrap; membership/session/assignment guards coordinate confirm. Both Academic enrollment writers use one validated lowercase enrollmentSlotKey; roster try-locks sorted slots including absent entries, then locks group/roster rows, rereads enrollment and rolls back on conflict. No Identity allocation, credential or Assessment writes. Original contract review/targeted closure remains input evidence, not actual implementation approval. CI/migration/real-race evidence pending.

Authority and evidence: [ADMIN-001](tasks/ADMIN-001.md). Earlier draft/registration checkpoints remain history; no policy supersession or release PASS.

## AUTH-002 bounded implementation checkpoint — 2026-11-07

Migration 0057 adds Identity-owned claims, claim events and the claim-to-activation relation, and Academic-owned roster identity bindings and Homeroom responsibilities with append-only events. The Secure Assessment coordinator composes owning APIs in one READ COMMITTED transaction with the reviewed total lock order (record §6A.3). 0056 roster person_id and all prior migrations are unchanged; Identity never reads Academic tables.

Authority and evidence: [AUTH-002](tasks/AUTH-002.md) §4.1/§6A/§12. Pointer to the Owner-approved D1–D3 and the reviewed contract only; it decides no new policy, role, channel, retention period or architecture item, and it is not a release PASS. PB05 stays OPEN.

## AUTH-003 bounded implementation checkpoint — 2026-11-07

Migration 0058 adds the Identity-owned identity_account_recovery_codes table: one open code per Account, immutable identity, and a single close. Issue and completion compose the owning APIs in the reviewed lock orders (record §6/§6A). Completion uses the existing credential → activation → sessions order, with non-blocking tenant and identity keys.

Authority and evidence: [AUTH-003](tasks/AUTH-003.md) §4/§6A/§13. Pointer to the Owner-approved R1–R4 and the reviewed contract only; it decides no new policy, role, channel or architecture item and is not a release PASS. PB05 stays OPEN.

## ASSESS-QUESTION-001 bounded implementation checkpoint — 2026-11-07

The Owner approved the A01 (question/answer/grading compatibility) and A04 (institution, transfer and supervisor scope) designs on 2026-11-07; the text is in [ASSESS-QUESTION-001 §4.2](tasks/ASSESS-QUESTION-001.md).

ASSESS-QUESTION-001 implements A01-1, A01-2 and A01-4 as a foundation (record §5/§5A):
- a content-key registry (`schemaVersion:questionType`) that holds only v1 single choice;
- client-declared types;
- explicit 409 `question_type_unsupported` on delivery and save;
- readiness blocking;
- a per-item rule identity and the composite rule `COMPOSITE_PER_ITEM_V1` for future mixed exams;
- the content key on queued client intents.

It changes no migration, route, lock order or v1 row, and v1 history is not reinterpreted. A01-3 and A04 belong to their own Tasks. This is a pointer, not a release PASS. PB05 stays OPEN.

## ASSESS-QUESTION-002 bounded implementation checkpoint — 2026-11-07

Multiple response is the first new type on the A01 foundation.

- **Content and rule:**
  - descriptor `2:MULTIPLE_RESPONSE` with the rule `MULTIPLE_RESPONSE_EXACT_SET_V1` (exact set → maxScore, otherwise 0; an empty selection is an accepted versioned write that scores UNANSWERED);
  - registered in the production registry next to v1;
  - mixed exams finalize under `COMPOSITE_PER_ITEM_V1`.
- **Import:**
  - the `elligble-questions-v2` template adds a `type` column (PG stays v1 content; PGK is multiple response) and grows only by appending columns;
  - migration 0060 lets the batch record v2;
  - v1 files are unchanged.
- **Client:**
  - one canonical value string per answer (the sorted JSON id array for multiple response) in the existing local record, so the sync engine and the IndexedDB schema are unchanged;
  - an explicit reload state for content the client cannot show.
- **Unchanged:** routes, lock order and v1 rows.

Authority and evidence: [ASSESS-QUESTION-002](tasks/ASSESS-QUESTION-002.md) §4/§4A/§11. This is a pointer, not a release PASS. PB05 stays OPEN.

## ASSESS-QUESTION-003 bounded implementation checkpoint — 2026-11-08

True/false is registered on the A01 foundation as `2:TRUE_FALSE`, rule `TRUE_FALSE_EXACT_V1`:
- strict boolean `{value}`, exact match, no clearing;
- authored as `BS` rows of the v2 template without new columns, under the append-only rule;
- the client value is the canonical `"true"` or `"false"` in the existing local record.

No route, lock order, migration or v1/multiple-response row changes. Authority and evidence: [ASSESS-QUESTION-003](tasks/ASSESS-QUESTION-003.md) §4/§4A/§11. This is a pointer, not a release PASS. PB05 stays OPEN.

## ASSESS-QUESTION-004 bounded implementation checkpoint — 2026-11-08

Matching is registered on the A01 foundation as `2:MATCHING`, rule `MATCHING_EXACT_PAIRS_V1`:
- 2–10 left items; right items equal in number plus at most 2;
- strictly one-to-one `{pairs}`; all-or-nothing;
- an incomplete answer is saved but UNANSWERED (Owner D1);
- authored as `MJ` rows through the extended v2 header (`left_1..left_10`, `right_a..right_l`, append-only);
- the client value is the canonical sorted pair list.

Monitoring counts a matching answer only when it is complete (one primary-key join to the snapshot). A shared `NativeSelect` primitive replaces the import page's local select class.

No route, lock order, migration or v1/multiple-response/true-false row changes. Authority and evidence: [ASSESS-QUESTION-004](tasks/ASSESS-QUESTION-004.md) §4/§4A/§11. This is a pointer, not a release PASS. PB05 stays OPEN.
