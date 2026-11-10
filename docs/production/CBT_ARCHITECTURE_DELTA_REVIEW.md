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

## ASSESS-QUESTION-005 bounded implementation checkpoint — 2026-11-08

Ordering is registered on the A01 foundation as `2:ORDERING`, rule `ORDERING_EXACT_SEQUENCE_V1`:
- 2–10 items shown in authored order;
- `{orderedItemIds}` is empty or a full permutation; exact sequence or 0;
- authored as `UR` rows reusing `left_1..left_10` of the extended v2 header, with no new column;
- the client value is the id list in answer order.

Monitoring does not count an empty order.

No route, lock order, migration or earlier-type row changes. Authority and evidence: [ASSESS-QUESTION-005](tasks/ASSESS-QUESTION-005.md) §4/§4A/§11. This is a pointer, not a release PASS. PB05 stays OPEN.

## ASSESS-QUESTION-007 bounded implementation checkpoint — 2026-11-08

Numeric answer is registered on the A01 foundation as `2:NUMERIC_ANSWER`, rule `NUMERIC_EXACT_DECIMAL_TOLERANCE_V1`:
- `{numericText}` is stored as typed and is either "" or a valid number (D1);
- scoring is exact BigInt decimal arithmetic with an inclusive absolute tolerance;
- it is authored as `IA` rows, with the tolerance in an appended 33rd `tolerance` column; the 32-column header stays valid;
- the client value is the text, and invalid text is never sent ("Belum tersimpan" draft).

Monitoring does not count "". The shared `Input` gains a documented `inputSize="exam"` variant.

No route, lock order, migration or earlier-type row changes. Authority and evidence: [ASSESS-QUESTION-007](tasks/ASSESS-QUESTION-007.md) §4/§11. This is a pointer, not a release PASS. PB05 stays OPEN.

## ASSESS-QUESTION-008 bounded implementation checkpoint — 2026-11-08

Essay is registered on the A01 foundation as `2:ESSAY`, rule `ESSAY_HUMAN_GRADED_V1`:
- `{essayText}` is stored exactly as written and is either "" or plain text of at most 5,000 code points (D2: other text is an unsaved draft);
- the managing Teacher grades it through two teacher-exam routes; grades are append-only revisions in `secure_assessment_essay_grade_revisions` (migration 0061), with a composite foreign key to the answer;
- a grade write takes the exam FOR KEY SHARE, which conflicts with finalization's FOR UPDATE;
- finalization is refused with `grading_incomplete` while any answered essay is ungraded, so `pending_issues` stays [] (A01-3);
- results count graded essays separately (D1), and the CSV gains two appended columns (D4).

No existing column, constraint or lock order changes, and no earlier-type row changes. Authority and evidence: [ASSESS-QUESTION-008](tasks/ASSESS-QUESTION-008.md) §4/§11. This is a pointer, not a release PASS. PB05 stays OPEN.

## ASSESS-QUESTION-006 bounded implementation checkpoint — 2026-11-08

Short answer is registered on the A01 foundation as `2:SHORT_ANSWER`, rule `SHORT_ANSWER_ACCEPTED_FORMS_V1`:
- `{shortText}` is stored exactly as typed and is either "" or one line of at most 200 code points (D2: other text is an unsaved draft);
- with 1–10 accepted forms it is scored all-or-nothing after the approved normalization (NFC, trim, collapsed whitespace, simple lowercase);
- without accepted forms (D1) it is graded by the managing Teacher through the ASSESS-QUESTION-008 workflow, grade table and refusals, with no migration;
- it is authored as `IS` rows with the forms in `left_1`–`left_10`; the grading-path copy is neutral.

No column, constraint, route or lock order changes, and no earlier-type row changes. Authority and evidence: [ASSESS-QUESTION-006](tasks/ASSESS-QUESTION-006.md) §4/§11. This is a pointer, not a release PASS. PB05 stays OPEN.

## ASSESS-INSTITUTION-001 bounded implementation checkpoint — 2026-11-09

Institution exams are composed by the School Operator on the A04-1 schema (migration 0062):
- `secure_assessment_institution_exam_periods` (one academic period and one assessment type) and `secure_assessment_institution_exam_sessions` (one date and time slot), both Secure Assessment, append-only;
- the nullable `institution_session_id` on `secure_assessment_exam_instances`; existing rows stay NULL (teacher-managed), and a trigger refuses any change of the reference, so an exam never moves between teacher-managed and institution-managed;
- the preparation deadline is the O05-2 implementation choice beside A04-1 (E2): the append-only `secure_assessment_institution_preparation_deadlines`, the current deadline being the highest revision (the 0061 pattern), revision 1 at placement and each extension the next revision with its reason;
- a content lock trigger on question snapshot INSERT and DELETE: it returns at once for a teacher-managed exam; for an institution exam it takes the exam row FOR SHARE and allows a change only while SCHEDULED and before the current deadline. No snapshot row is ever updated (0003 unchanged), and the RESTRICT keys of answers and review flags still block deleting delivered content (§3.3).

The new exam actions take the exam row FOR UPDATE, as every lifecycle change does; the lock order of existing actions is unchanged. The subject Teacher of an institution exam keeps content preparation (before the deadline), preview, essays, results and finalization, and is refused the organizer actions with `institution_managed`. No existing column, constraint or trigger changes. Authority and evidence: [ASSESS-INSTITUTION-001](tasks/ASSESS-INSTITUTION-001.md) §4/§11. This is a pointer, not a release PASS. PB05 stays OPEN.

## ASSESS-INSTITUTION-002 bounded implementation checkpoint — 2026-11-09

Rooms, participant room placement and Proctor assignments of institution exams use the A04-1 schema (0031–0034, 0008 unchanged) with migration 0063:
- `secure_assessment_institution_room_actions`, one append-only row per Operator write that changes something (actor, time, kind, action key shared by the three kinds, request digest, the session revision, the exams sent back to SCHEDULED), and `secure_assessment_institution_room_action_entries`, one append-only entry per changed participant room or Proctor assignment, storing room labels rather than room ids; both Secure Assessment;
- the institution room guard on `secure_assessment_exam_rooms`: it returns at once for a teacher-managed exam (the BU-071 behaviour stays); for an institution exam it keeps labels in one form, unique per exam case-insensitively and never renamed, and refuses to delete a room unless the exam is SCHEDULED or READY, with named SQLSTATEs and constraints;
- the RP-1 policy update: SCHEDULED institution exams become room-based with a Proctor per room; READY ones get it at their first room write, which re-checks readiness. No lifecycle row is written.

A physical room is one row per ExamInstance with the same label within a session; an emptied row of a SCHEDULED or READY exam is removed with its Proctor mappings, and the Proctor assignments mapped only to it are revoked. The new writes take the session advisory lock, the room label locks, the person locks, then every exam row of the session FOR UPDATE by id; the lock order of existing actions is unchanged. The schedule-conflict preflight exempts one Proctor of one physical room across the exams of one session (RP-2). No existing column, constraint or trigger changes. Authority and evidence: [ASSESS-INSTITUTION-002](tasks/ASSESS-INSTITUTION-002.md) §4/§11. This is a pointer, not a release PASS. PB05 stays OPEN.

## ASSESS-INSTITUTION-003 bounded implementation checkpoint — 2026-11-09

The School Operator's drill-down and running controls of institution exams (open, pause, resume and end per exam or per session; lock, unlock, added time and messages) run through the existing business cores, so the business ledgers (lifecycle events, 0044, 0046, 0047, 0050) name the Operator as before. Migration 0064 adds the control ledger:
- `secure_assessment_institution_control_actions`, one append-only row per applied or no-op Operator control (session, the named exam and participant when there is one, kind, action, reason, confirmation, actor, time, action key shared by every kind, request digest), and `secure_assessment_institution_control_entries`, one append-only entry per affected exam with its outcome (`APPLIED`, `NO_OP`, or `SKIPPED` with its code for a session-wide transition), the states before and after, and the participant with its attempt (tied by a composite key, as 0054 ties it) or the message; both Secure Assessment;
- two BEFORE INSERT guards with named SQLSTATEs: an action that names an exam names an institution exam of its own session (`ck_sa_institution_control_session`), and an entry names an exam of its action's session, the action's exam and participant when they are named, states that fit the kind, and is `SKIPPED` only under a session-wide transition (`ck_sa_institution_control_entry_scope`). Both compare with `IS DISTINCT FROM`, so no row of either table can name a teacher-managed exam or an exam of another session.

0054 is not widened and `executePermissionAction` is unchanged. A per-exam transition takes the exam row FOR UPDATE and no session lock; a session-wide transition takes the session advisory lock shared with room writes, then FOR UPDATE by id only the exams in the action's from-state or no-op state; lock and added time take the exam row FOR KEY SHARE, then the open attempt FOR UPDATE; a message takes no exam lock. Room writes now lock only the SCHEDULED or READY exams of the session (ASSESS-INSTITUTION-002 R14), so a running exam's answer saves never wait for them. The subject Teacher's teaching assignment counts for supervision only on a teacher-managed exam (D04.4-26D). No existing column, constraint or trigger changes. Authority and evidence: [ASSESS-INSTITUTION-003](tasks/ASSESS-INSTITUTION-003.md) §4/§11. This is a pointer, not a release PASS. PB05 stays OPEN.

## ASSESS-ROOM-001 bounded implementation checkpoint — 2026-11-11

The School Operator moves one participant of an ACTIVE or PAUSED institution exam to another existing room of the same exam that has an active mapped Proctor (OR-1, OR-2), with a reason and a confirmation, through `POST /api/v1/assessment/institution-exams/supervision/room-transfer`. Migration 0065 extends 0032 and 0063 rather than adding a parallel history (ASSESS-INSTITUTION-002 E18):
- `secure_assessment_exam_participant_room_assignments` gains `assignment_version` (NOT NULL DEFAULT 1, at least 1), owned by a BEFORE INSERT OR UPDATE trigger: an insert gets 1, an update that changes the room gets the old value plus 1, any other update keeps it. Existing rows read 1, and every room-screen move of ASSESS-INSTITUTION-002 bumps it without a code change;
- `secure_assessment_institution_room_actions` gains the kind `PARTICIPANT_TRANSFER`, `reason` and `confirmed`: a transfer carries a reason in the 0054 form, `confirmed` true and no demotions, and no other kind carries either (`ck_sa_institution_room_action_transfer`);
- `secure_assessment_institution_room_action_entries` gains the kind `PARTICIPANT_TRANSFER`, the resulting `assignment_version` and the open `exam_attempt_id` (tied to its participant as 0054 ties it; NULL when not started); a transfer entry has both labels, different, and a version of at least 2;
- the transfer guard, a BEFORE INSERT trigger on entries with a named SQLSTATE (`ck_sa_institution_room_transfer_scope`): a transfer entry only under a transfer action and the reverse, inside the action's session, once per transfer action. Any other pair returns without a lock.

The transfer changes only the current room row and appends one action and one entry; Person, Participant, Attempt, snapshots, answers, timer, sessions, locks and submissions are untouched (O05-5). The lock order is the Owner's OR-4 order, the same as the Proctor's SEC-001 path: the session advisory lock, the exam FOR KEY SHARE, the participant's room row FOR UPDATE, the open attempt FOR UPDATE with a re-read in a statement of its own, then the target room and its active mapped Proctor assignments FOR SHARE. No existing writer's lock order changes; supervision scope stays a per-request join on the current row (A04-3), so the old room's Proctor loses the participant at commit. The Operator's participant projection alone gains each participant's room id and version and each room's coverage. Authority and evidence: [ASSESS-ROOM-001](tasks/ASSESS-ROOM-001.md) §4. This is a pointer, not a release PASS. PB05 stays OPEN.
