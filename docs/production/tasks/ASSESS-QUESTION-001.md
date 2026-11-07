# ASSESS-QUESTION-001 — Versioned Question/Answer/Scoring Compatibility Foundation

## 1. Control state and authority

| Field | Disposition |
|---|---|
| Classification | Active P11 Task; P0 question and answer integrity foundation; HIGH risk; R02, R03, R10–R17, R25, R26; P8 V02–V06, V09–V11 |
| Status | **VERIFYING — implementation candidate published for exact-content CI and the independent implementation review (§11); DEC-048** |
| Objective | Freeze and implement the approved discriminated question/answer/scoring contract and compatibility policy (A01) so that later type Tasks plug in without touching v1 truth. No new question type is delivered here |
| Owner decisions | 2026-11-07, Owner in chat: all 18 O02/O05 defaults ("Setujui semua default") and all 7 A01/A04 designs ("Setujui semua desain") of the question and institution package, recorded verbatim in §4. The architecture/assessment and security reviewer is the standing Owner-designated read-only subagent reviewer |
| Execution authority | DEC-048 (00.13). Internal dependency SEC-001 is DONE / MERGED. O02 (approved rules), O05 (approved composition, result shape), O09 (approved P5 content under GOV-POLICY-001) and A01 (approved design) are settled inputs |
| Base and branch | main aa2c0427960fa79969eeef68019a61eea18f4f84; branch task/assess-question-001-versioned-foundation, worktree `C:\Projects\ELLIGBLE-question-001` |
| Parallel safe / cost | No parallel baseline Task; no dependency, vendor, service or cost |

Authority: [DEC-044](../../00-governance/00.11_CBT_RELEASE_SCOPE_REALIGNMENT.md), [DEC-045 §5](../../00-governance/00.12_AICWDF_ADOPTION_AND_TASK_EXECUTION.md), [DEC-048](../../00-governance/00.13_STANDING_EXECUTION_DELEGATION.md), [TASK_PLAN ASSESS-QUESTION-001/§4/§8 (O02, O05, O09, A01)](../TASK_PLAN.md), [P2 domain rules](../CBT_DOMAIN_RULES_SPECIFICATION.md), [P4 architecture delta](../CBT_ARCHITECTURE_DELTA_REVIEW.md), [P8 V02–V11](../CBT_VERIFICATION_AND_RELEASE_DOD_PLAN.md). No LOCKED decision or PB status changes.

## 2. Reuse and bounded gaps

What exists (main aa2c042; `src/` = `runtime/secure-assessment/src/`):

- **Content:** `validateBaselineQuestionSnapshotFrozenContent` accepts only `schemaVersion: 1` + `MULTIPLE_CHOICE_SINGLE`, five options, a correct option id and `maxScore > 0` (`src/question-snapshot-baseline-frozen-content-contract.ts:96-200`). Snapshots are written only by `buildBaselineFrozenContent` (`src/exam-provisioning.ts:30-48`). `frozen_content` is immutable JSONB with no CHECK (0003).
- **Answer:** `isAnswerForQuestion` requires exactly `{selectedOptionId}` naming a frozen option (`src/answer.ts:11-19`); the save route keeps its lock order (exam → attempt FOR UPDATE → lock → session → snapshot → submission/timer → answer row FOR UPDATE), write identity and `write_version` (`src/answer.ts:112-378`). `answer_payload` is JSONB with no CHECK (0004).
- **Delivery:** a snapshot that fails the v1 validator turns the whole response into 500 after COMMIT (`src/question-delivery.ts:225-229`); the Student-safe view hard-codes `schemaVersion: 1` and the type (`:235-244`).
- **Scoring and results:** `scoreBaselineAttempt` and `BASELINE_SINGLE_CHOICE_V1` (`src/scoring.ts:15,71-103`); `freezeExamResults` writes `scoring_rule` = that rule and `item_outcomes` `{questionSnapshotId, selectedOptionId, outcome, scoreMicro, maxScoreMicro}` (`src/result-finalization.ts:36-149`; 0045 has no enum on either).
- **Readiness:** the content preflight runs the v1 validator per snapshot and blocks activation (`src/exam-instance-baseline-question-snapshot-content-readiness-preflight.ts:95-108`), composed into `evaluateExamReadiness` and `activate`.
- **Client:** no supported-types signal is sent; `StudentSafeQuestion.questionType` is the v1 literal; the pending IndexedDB record (`elligble_exam_answers` v1, store `pending_answers`) has no type or version; the save payload is fixed to `{selectedOptionId}` (`frontend/web/src/exam/answer-sync-api.ts:96`).

Gaps closed by this Task (A01-1, A01-2, A01-4, O02-2):

1. no versioned registry: every module hard-codes v1;
2. a content version the server cannot handle becomes an opaque 500 (delivery) or a 400 (save) instead of an explicit refusal;
3. readiness cannot name an unsupported version;
4. old clients cannot declare what they render;
5. queued local entries carry no type and version;
6. there is no per-item rule identity or composite rule for a future mixed exam;
7. there is no contract for an empty (cleared) answer of a new type.

Excluded (later Tasks):
- every new type's validator, Student control, authoring, import and scoring (ASSESS-QUESTION-002–008);
- manual grading storage (A01-3, ASSESS-QUESTION-008);
- import template v2 (O02-12, ASSESS-QUESTION-010);
- question bank (009) and media (ASSESS-MEDIA-001);
- institution exams (A04, ASSESS-INSTITUTION-*);
- publication and result reports (RESULT-003/004);
- any UI copy, screen or control change;
- teacher preview and teacher results of non-v1 content;
- migrations.

## 3. Settled inputs

- **v1 truth is never reinterpreted** (`CBT_ARCHITECTURE_DELTA_REVIEW.md:26`): stored v1 snapshots, answers, write identities and versions, finalizations and item outcomes stay byte-identical, and v1 behaviour is unchanged.
- **D04.8-08:** an exact correct set earns full score, otherwise zero. Unanswered scores 0 and is not absent. Raw scores are reconstructable from snapshots and accepted answers.
- **O09 / P5:** no new route or actor authority. Existing assessment route authority, envelopes and the Student-safe projection (no key, no maxScore) are unchanged.

## 4. Owner decisions — 2026-11-07

The Owner approved every recommended default below in chat on 2026-11-07: "Setujui semua default" (Part 1, 18 rows) and "Setujui semua desain" (Part 2, 7 rows). The architecture/assessment reviewer for A01/A04 is the standing Owner-designated subagent reviewer. The alternatives were not chosen. This record is the repository source of these decisions; other Tasks cite it.

Fixed inputs (not reopened): DEC-044 scope with eight formats; 00.11 §5A transfer invariants; OD-07 role authority; OD-07b School Operator as organizer; OD-09 publication; D04.8-08; unanswered 0 and not absent; raw scores reconstructable; stored v1 never reinterpreted; O09 P-content approved under GOV-POLICY-001.

### 4.1 Part 1. Owner policy decisions (O02, O05) — APPROVED

| ID | Question | Approved default | Unblocks |
|---|---|---|---|
| O02-1 | Scoring basis for new auto-scored types | All-or-nothing for every auto-scored type: an exact match earns the item maxScore, anything else earns 0. No partial credit, no negative marking. Unanswered = 0. Existing per-item maxScore (>0, ≤1000, 2 decimals) and the same raw/max×100 half-up scaling are kept. | ASSESS-QUESTION-001; 002–007; RESULT-004 |
| O02-2 | Clearing an answer | v1 single choice is unchanged: an answer can be changed but not cleared. For new types, an empty value (`[]` or `""`) is an accepted, versioned write that counts as UNANSWERED. It is shown as "Belum dijawab", not as saved content. | ASSESS-QUESTION-001 |
| O02-3 | Multiple response (R11) | Five options A–E, the same as single choice. The correct set has 1–5 options. The number of correct options is not shown ("Pilih semua jawaban yang benar"). D04.8-08 exact-set scoring. Duplicate or foreign IDs are rejected. | ASSESS-QUESTION-002 |
| O02-4 | True/false (R12) | Strict boolean `{value}`. No string coercion. Exact match scoring. | ASSESS-QUESTION-003 |
| O02-5 | Matching (R13) | 2–10 left items. The right list has as many items as the left list plus up to 2 distractors. Strictly one-to-one: each right item is used at most once. An answer counts as complete only when every left item is paired. All-or-nothing scoring (O02-1). | ASSESS-QUESTION-004 |
| O02-6 | Ordering (R14) | 2–10 items. The answer must be a full permutation. Exact sequence earns full score, otherwise 0. | ASSESS-QUESTION-005 |
| O02-7 | Short answer (R15) | The original text is stored exactly as typed, up to 200 characters. Auto-scored against up to 10 accepted forms entered by the Teacher. Matching only after: trimming leading and trailing whitespace, collapsing inner whitespace, case-insensitive comparison and Unicode NFC. No fuzzy, synonym or AI matching. The Teacher can set an item to manual grading, which uses the essay workflow. | ASSESS-QUESTION-006 (needs 008 first) |
| O02-8 | Numeric answer (R16) | The input text is stored as typed, up to 30 characters. Either a comma or a dot is accepted as the decimal separator (Indonesian comma). No thousands separators, exponents or units. Compared as an exact decimal (no floating point) against an expected value, with an absolute tolerance set by the Teacher (default 0). Bounds are inclusive. | ASSESS-QUESTION-007 |
| O02-9 | Essay and manual grading (R17) | Plain text only, up to 5,000 characters. No markup and no file upload. One grader: the assigned subject or managing Teacher (OD-07, OD-07b; multiple scorers FUTURE). Score from 0 to maxScore with up to 2 decimals. An optional plain-text rubric is pinned in the snapshot and never sent to the Student. Ungraded is not 0 and blocks finalization. Grades can be revised before finalization, with revision history. | ASSESS-QUESTION-008; 006 manual mode; RESULT-004 |
| O02-10 | Corrections after finalization | Not available in CBT-R1. A finalized result is immutable, as today (one finalization per exam). | RESULT-004 |
| O02-11 | Question bank sharing (R19) | Bank items are private to the Teacher who wrote them, within the tenant. They are pinned into an exam by copying them into the snapshot. No sharing in CBT-R1. | ASSESS-QUESTION-009 (also needs O06) |
| O02-12 | Import format | `elligble-questions-v1` stays accepted without change. A new versioned CSV template `elligble-questions-v2` adds a `type` column and type-specific columns. Import is atomic. Media packaging waits for O06. | ASSESS-QUESTION-010 |
| O05-1 | Institution exam composition (R20) | An exam period is organized by the School Operator. Each subject × rombel group is one existing ExamInstance, bound to one teaching assignment, placed in a session (date and time slot). Finalization happens per subject ExamInstance, by its subject Teacher. There is no total across subjects in CBT-R1 (an assessment result is not an official grade). | ASSESS-INSTITUTION-001; RESULT-004; ASSESS-QUESTION-001 (result shape) |
| O05-2 | Preparation deadline | The School Operator sets a deadline for each ExamInstance. Content is locked after the deadline. The Operator can extend it with reason, confirmation and audit, but never edits content or sees answer keys. | ASSESS-INSTITUTION-001 |
| O05-3 | Running-exam controls for the Operator | Open, pause, resume and end per ExamInstance, plus a session-wide shortcut that applies the same action to each ExamInstance with one reason. Lock and unlock, messages and added time follow OD-07, with reason, confirmation and audit. Teachers and Proctors cannot pause or end institution exams. | ASSESS-INSTITUTION-002/003 |
| O05-4 | Transfer target eligibility (R22) | Allowed only within the same tenant and ExamInstance, for a participant who has not submitted or expired, while the exam is READY, ACTIVE or PAUSED. The target room must be covered by a Proctor when the exam's policy requires one. Not allowed after submission. | ASSESS-ROOM-001 |
| O05-5 | Session behavior during a transfer | The same active session continues. No logout, takeover or timer change. Room scope is checked again on every request. | ASSESS-ROOM-001 |
| O05-6 | Withdrawing publication (R27) | The Teacher can withdraw a publication with reason, confirmation and audit. Scores are hidden again, and the Student sees "Hasil belum tersedia". Republishing shows the same frozen result. | RESULT-003 |

### 4.2 Part 2. Architecture design decisions (A01, A04) — APPROVED

| ID | Question | Approved design | Unblocks |
|---|---|---|---|
| A01-1 | Version strategy | Keep the JSONB `frozen_content` and `answer_payload` columns. v1 rows are left untouched, with no backfill. New types are written as `schemaVersion: 2` with a `questionType` field that selects the type. A validator registry dispatches on (version, type). The v1 validator and rule do not change. | ASSESS-QUESTION-001 |
| A01-2 | Scoring rule identity in results | Each new type gets its own versioned rule ID, recorded per item in `item_outcomes`. `scoring_rule` stays `BASELINE_SINGLE_CHOICE_V1` for exams that are entirely v1. Mixed exams get a new composite rule ID. `scaleToHundred` is reused. | ASSESS-QUESTION-001; RESULT-004 |
| A01-3 | Manual grading storage | A new grading table (Attempt × snapshot, revision, actor, score in micro-points, rubric version), separate from the Student's answer. Finalization refuses while any required grade is pending, using the existing `pending_issues` record. | ASSESS-QUESTION-008; RESULT-004 |
| A01-4 | Unsupported content and old clients | The client sends the types it supports. Unsupported types cause explicit refusals on delivery and save (replacing today's 500), and readiness blocks activation. Queued local entries carry type and version. | ASSESS-QUESTION-001 |
| A04-1 | Institution schema | New period and session tables owned by Secure Assessment, plus a nullable session reference on ExamInstance. Teacher-managed exams are unchanged. Rooms stay per ExamInstance, and the UI writes one room row per ExamInstance for each physical room. | ASSESS-INSTITUTION-001/002 |
| A04-2 | Transfer transaction | Lock the Attempt `FOR UPDATE` first, in the same order as save, submit and session. Then lock the room assignment, compare a new `assignment_version`, insert an append-only history row and update the current row, all in one transaction. Retries are idempotent through `actionKey`. | ASSESS-ROOM-001 |
| A04-3 | Supervisor scope after a transfer | Keep the per-request join to the current room, with no cached scope. The old room's Proctor loses access at commit. | ASSESS-ROOM-001; INSTITUTION-003 |

Each type Task still freezes its own expected test vectors (O02 READY condition) from P2 §38-47 before its READY. Approving this package authorizes no Task by itself.

## 5. Contract (A01-1, A01-2, A01-4, O02-2)

### 5.1 Content identity and the registry (`src/question-contract.ts`, new)

- **Content key:** `"<schemaVersion>:<questionType>"`, for example `1:MULTIPLE_CHOICE_SINGLE`.
- **Classification** `classifyFrozenContent(content, registry)`, total and side-effect free:
  - not an object, or `schemaVersion` missing or not an integer from 1 to 99 → **invalid**;
  - `schemaVersion` 1 → the unchanged v1 validator decides: valid, or **invalid** with its existing blocker (a v1 row with another type stays invalid, as today);
  - `schemaVersion` ≥ 2 with `questionType` not a string of 1–40 characters `[A-Z_]` → **invalid**;
  - `schemaVersion` ≥ 2 with a well-formed key that the registry does not hold → **unsupported** (never validated further, never delivered, never scored);
  - a registered key → that descriptor's content validator decides valid or **invalid**.
- **Descriptor** (one per key): `key`, `scoringRuleId`, `validateContent`, `studentView` (key-free projection that always carries `schemaVersion` and `questionType` from the row), `validateAnswer` (returns `{ ok: false }` or `{ ok: true, empty: boolean }`), `allowsEmpty`, and `score` (returns outcome, earned micro-points and max micro-points).
- **Production registry:** exactly one descriptor, `1:MULTIPLE_CHOICE_SINGLE`. It wraps the unchanged v1 validator, the existing Student view fields, `isAnswerForQuestion` semantics (`allowsEmpty: false`: v1 cannot clear) and the existing all-or-nothing scoring, with rule `BASELINE_SINGLE_CHOICE_V1`.
- **Registry injection:** every consumer below takes an optional registry argument whose default is the production registry, so tests can prove dispatch with a test-only descriptor without shipping a type.
- **Empty answers (O02-2):** for a descriptor with `allowsEmpty: true`, an empty value is an accepted, versioned write (normal write identity and version) and scores UNANSWERED. With only v1 registered, no production path accepts an empty value.

### 5.2 Client-declared types (A01-4)

- **Header:** `X-Question-Types`, a comma-separated list of 1–16 content keys, each `^[1-9][0-9]?:[A-Z_]{1,40}$`, no duplicates.
  - Absent: the client supports exactly `1:MULTIPLE_CHOICE_SINGLE`, so every client released before this Task keeps working unchanged.
  - Present but malformed: 400 `invalid_request`, no state read or change.
- **Effective support** for a request is the client list intersected with the production registry.
- The web client sends `X-Question-Types: 1:MULTIPLE_CHOICE_SINGLE` on question delivery and answer save, from one shared constant.

### 5.3 Delivery (`src/question-delivery.ts`)

- Authority, transaction, status checks and order are unchanged.
- After the existing checks each snapshot is classified:
  - **unsupported by the server, or not in the client's effective support** → 409 `question_type_unsupported`, body `{ "error": "question_type_unsupported" }`, with no question content. This replaces the 500 for these rows;
  - **invalid** → the existing 500 `internal_error` (corrupt content of a known version is a server fault; readiness prevents it);
  - **valid** → `descriptor.studentView`. For v1 this is exactly today's object.
- The header is validated before any database work.

### 5.4 Answer save (`src/answer.ts`)

- Lock order, write identity, version and terminal checks are unchanged.
- At the existing payload check point (after the snapshot read) the snapshot is classified:
  - unsupported by the server or by the client → 409 `question_type_unsupported`, zero mutation;
  - invalid → the existing 400 `invalid_answer_payload`;
  - otherwise `descriptor.validateAnswer`: not ok → the existing 400 `invalid_answer_payload`.
- v1 accepts and refuses exactly what `isAnswerForQuestion` does today. `isAnswerForQuestion` stays exported and unchanged.
- The header is validated before any database work.

### 5.5 Readiness (content preflight and composition)

- Each snapshot is classified. **Unsupported** → `not_ready` / `question_snapshot_content_invalid` with `contentBlocker: 'question_type_unsupported'` (the union widens by one value).
- v1 results are unchanged, so activation of an exam with any unsupported snapshot is blocked through the existing `evaluateExamReadiness` path. No UI copy changes: the existing content-invalid message is shown.

### 5.6 Scoring and finalization (A01-2)

- `scoreAttempt(questions, answers, registry)` in `src/scoring.ts`:
  - **all questions v1:** returns exactly `scoreBaselineAttempt(questions, answers)`, the same object with rule `BASELINE_SINGLE_CHOICE_V1`;
  - **any unsupported or invalid question:** `unscorable` / `invalid_question`, as today;
  - **otherwise (mixed or all new types):** rule `COMPOSITE_PER_ITEM_V1`. Each item carries `ruleId` (its descriptor's rule). Sums are in micro-points; `scaleToHundred` is reused. Empty answers are UNANSWERED.
- `scoreBaselineAttempt`, `AttemptScore` and `BASELINE_SCORING_RULE` stay unchanged.
- `freezeExamResults` takes an optional registry and uses `scoreAttempt`:
  - all-v1 exams write the same `scoring_rule` and byte-identical `item_outcomes` as today;
  - a composite exam writes `scoring_rule = COMPOSITE_PER_ITEM_V1`, and each item is `{questionSnapshotId, ruleId, outcome, scoreMicro, maxScoreMicro}`, plus `selectedOptionId` for v1 items;
  - unsupported content keeps `scoring_unavailable`.
- Teacher results and preview are unchanged (they handle v1 only). Reading a composite result is RESULT-004.

### 5.7 Client contracts (types, API, store, sync)

- **Types:** `StudentSafeQuestion.questionType` becomes `string`; the type adds `QuestionContentKey` and `SUPPORTED_QUESTION_TYPES = ['1:MULTIPLE_CHOICE_SINGLE']`.
- **API:** `getQuestions` and `postSaveAnswer` send the header. `question_type_unsupported` surfaces as an `ApiError` code.
- **Store:** `PendingAnswerRecord` gains `contentKey`, written on every new record. A record without it, written by an earlier client, is read as `1:MULTIPLE_CHOICE_SINGLE`. The IndexedDB name, version 1, store and index are unchanged, so no upgrade and no rewrite.
- **Sync:**
  - `capture` takes the content key (default v1);
  - the save request carries it, and the payload is built from it (v1 → `{selectedOptionId}`, exactly as today);
  - a record whose key is not in `SUPPORTED_QUESTION_TYPES` is never sent and is marked failed as `question_type_unsupported`;
  - `classifySaveFailure` treats 409 `question_type_unsupported` as `rejected` (no retry loop).
- **UI:** the existing failure states are shown; there is no new copy or control. The honest "reload for a newer version" message comes with the first new type's UI Task.

### 5.8 Invariants

- **No migration.** Columns, constraints and triggers are unchanged; v1 rows untouched.
- **Locks:** no new lock, lock order or transaction.
- **Routes and authority:** no new route, actor or authority. Student-safe projection unchanged: no key, maxScore, rubric or accepted forms.
- **Determinism:** classification and scoring are pure and deterministic.

## 5A. Binding review-correction contract — 2026-11-07

This section corrects the contract after the independent contract review (§9). Where §5, §6 or §7 differ, §5A governs.

1. **Save keeps v1 acceptance exactly (F1).** At the existing payload check point, the save route decides in this order:
   - (a) a well-formed row of version 2 or higher whose key is not in the effective support (§5A.3), or (b) a row with `schemaVersion` 1 when `1:MULTIPLE_CHOICE_SINGLE` is not in the effective support → 409 `question_type_unsupported`, zero mutation (correction 2, N1);
   - a registered key of version 2 or higher in the effective support → `descriptor.validateAnswer`; not ok → 400 `invalid_answer_payload`;
   - every other row (`schemaVersion` 1 with v1 supported, or a missing or malformed version) → the unchanged `isAnswerForQuestion(frozen_content, payload)`, without the content validator. With the header absent, behaviour is identical to today.
   - **Precedence in save** stays as today: this check sits where the payload check sits now, after the session and context checks and before the submission, timer, pause and lock checks.
   - Consequences:
     - v1 accepts and refuses exactly as today, including minimal fixtures with only `{schemaVersion: 1, questionType, options}`;
     - a row `{schemaVersion: 2, questionType: 'MULTIPLE_CHOICE_SINGLE', options}` moves from accepted to 409, as A01-4 intends;
     - a v1 row with a header that lacks `1:MULTIPLE_CHOICE_SINGLE` is 409.
2. **Readiness keeps every existing blocker (F2, option a).**
   - A row with a registered key of version 2 or higher is validated by its descriptor. An invalid result is `not_ready` / `question_snapshot_content_invalid` with `contentBlocker: 'question_content_invalid'`. That one value widens the union, through row 13.
   - Every other row, including unsupported version 2 or higher, gets exactly the result and blocker that `validateBaselineQuestionSnapshotFrozenContent` returns today. For unsupported version 2 rows that is `schema_version_invalid`.
   - So activation is blocked for every non-deliverable row, and the existing preflight tests pass unchanged. There is no `question_type_unsupported` readiness blocker; §5.5 is replaced.
3. **Effective support uses the registry in use (F3):** the client list intersected with the registry passed to the handler (production by default). C06 proves the empty-answer write through the real save handler with an injected test registry and a header that lists the test key.
4. **The header is sent on the real save path (F4):**
   - the engine-driven save request in `exam/answer-sync-api.ts` sends `X-Question-Types` from the shared constant;
   - `getQuestions` and the unused `postSaveAnswer` also send it.
   - C07 asserts the header on the real engine-driven request.
5. **Header validation point (F5):** in each handler, after the existing authorization-context check and before `pool.connect()`. A malformed header gives 400 `invalid_request` with no handler query and no transaction; authentication and authorization refusals still come first. C03 is proven at handler level (a mock pool whose `connect` is never called) and with one real-PostgreSQL zero-mutation check.
   - **Parsing:** tokens are separated by commas. Spaces and tabs around a token are trimmed, so the ", " that Node uses to join duplicate headers is valid. An empty token, a bad token, more than 16 tokens or a duplicate key is malformed.
6. **Delivery precedence:**
   - rows are evaluated in the delivered order (`display_order`, then id), and the first row that cannot be delivered decides: unsupported or outside the effective support → 409; invalid → 500;
   - classification runs only after every existing pause, lock, session, submission and timer check, so those refusals keep precedence;
   - the 409 carries no question content.
7. **More reload and takeover evidence (F6).** C07 adds:
   - legacy (no `contentKey`) and new records survive a store reopen and adoption by another session (`answer-sync-engine.ts` adoption path) with identical payload, version and discard behaviour;
   - a record with an unsupported key is never sent, ends failed with `question_type_unsupported`, and is never shown as saved.

   C04 adds that a paused, locked or submitted attempt keeps its existing refusal even when it holds an unsupported row.
8. **Engineering precisions:**
   - `PendingAnswerRecord.contentKey` is optional in the TypeScript type and always written by the new client.
   - `scoreAttempt` hands off to `scoreBaselineAttempt` unchanged whenever no row has a registered key of version 2 or higher (correction 2, note 2). So every exam that production can hold today scores exactly as before, including the `invalid_question` snapshot id. Otherwise an unsupported, malformed or invalid row gives `unscorable` / `invalid_question` with the first such row in authored order.
   - An exam made entirely of new types also uses `COMPOSITE_PER_ITEM_V1` (an engineering reading of A01-2).
   - Composite totals are kept and written as bigint micro-points, without a float round trip.
   - `descriptor.validateContent` returns `{ ok: true }` or `{ ok: false }`; readiness maps the failure to `question_content_invalid`.
   - `classifySaveFailure` already maps an unknown 409 to `rejected`; the explicit case only names it.
9. **Honest limits:**
   - A delivery 409 is shown with the existing generic connectivity message and re-polling (`StudentExamWorkstation.tsx:352`, `:476-532`). That cannot happen in production now: only v1 is registered, and the web client always declares it. The reload message comes with the first new type's UI Task.
   - The O02-2 "Belum dijawab" display of a cleared answer belongs to the type UI Tasks.
   - `verification/verify_bu067…` and `verify_bu068…` use `schemaVersion` 99. They are historical scripts, not run in CI, and are not changed.
   - `resume.ts`, the v1 contract file and `exam-instance-baseline-scoring-readiness-preflight.ts` (no production caller) stay unchanged.
   - A client that does not declare v1 and saves to a submitted or expired attempt gets 409 `question_type_unsupported` rather than the terminal code, the same position as today's `invalid_answer_payload`. The web client always declares v1.
10. **Gate updates:**
    - **C02** adds the minimal-content v1 save vector and the version 2 `MULTIPLE_CHOICE_SINGLE` save refusal.
    - **C04** replaces "readiness `not_ready` with `question_type_unsupported`" by "readiness `not_ready` / `question_snapshot_content_invalid` with the v1 blocker (`schema_version_invalid`), and `activate` refused".
    - **C06** covers a registered-v2 invalid row giving `question_content_invalid` through an injected registry.
    - Rows 1–4 of §6 are Task-flow paths, not allowlist entries.
    - The CI-first order is recorded at READY.

## 6. Exact proposed file scopes (frozen at READY)

| # | Path | Purpose |
|---|---|---|
| 1 | docs/production/tasks/ASSESS-QUESTION-001.md | Contract, decisions, history, evidence |
| 2 | docs/production/TASK_PLAN.md | Status, counters, SEC-OPS-001 landing record |
| 3 | docs/production/PRODUCTION_COMPLETION_PLAN.md | Status and continuity |
| 4 | docs/DOCUMENT_MANIFEST.md | Index |
| 5 | docs/production/CBT_DOMAIN_RULES_SPECIFICATION.md | Appended O02/O05 decision pointer |
| 6 | docs/production/CBT_ARCHITECTURE_DELTA_REVIEW.md | Appended A01/A04 decision pointer |
| 7 | runtime/secure-assessment/src/question-contract.ts | Registry, classification, header parsing, v1 descriptor |
| 8 | runtime/secure-assessment/src/question-delivery.ts | Classified delivery and explicit refusal |
| 9 | runtime/secure-assessment/src/answer.ts | Classified save |
| 10 | runtime/secure-assessment/src/scoring.ts | `scoreAttempt`, composite rule |
| 11 | runtime/secure-assessment/src/result-finalization.ts | Registry-aware freeze |
| 12 | runtime/secure-assessment/src/exam-instance-baseline-question-snapshot-content-readiness-preflight.ts | Registered-v2 content check (§5A.2) |
| 13 | runtime/secure-assessment/src/exam-instance-baseline-readiness-checks-composition-preflight.ts | Widened blocker type (`question_content_invalid`) |
| 14 | frontend/web/src/types/assessment.ts | Content key types and supported list |
| 15 | frontend/web/src/api/assessment-client.ts | Header |
| 16 | frontend/web/src/exam/answer-store.ts | `contentKey` on records |
| 17 | frontend/web/src/exam/answer-sync-api.ts | Payload by key; failure class |
| 18 | frontend/web/src/exam/answer-sync-engine.ts | Key through capture and send |
| 19 | runtime/secure-assessment/test/question-contract.test.ts | Units |
| 20 | runtime/secure-assessment/test/integration/question-types.test.ts | Real PostgreSQL and production wiring |
| 21 | frontend/web/src/__tests__/answerTypes.test.tsx | Client contract tests |

Forbidden:
- every other file, including existing tests (they must pass unchanged as the v1 regression oracle);
- completed Task records;
- migrations;
- workflows, lockfiles and dependencies;
- UI components and copy;
- e2e specs;
- production resources.

## 7. Acceptance gates (DEFINED / NOT EXECUTED)

| Gate | Expected outcome |
|---|---|
| C01 | Classification table: invalid (non-object, missing, non-integer or out-of-range version, malformed v2 type), v1 valid, v1 invalid with each existing blocker, v2 unsupported, registered-v2 valid and invalid through a test-only descriptor; deterministic |
| C02 | v1 golden vectors: for every existing scoring fixture, `scoreAttempt` equals `scoreBaselineAttempt`; v1 Student view, answer acceptance and refusal identical to the existing functions on a fixture table, including the minimal-content v1 save vector; a version 2 `MULTIPLE_CHOICE_SINGLE` row is refused 409 on save |
| C03 | Header: absent means v1 only; valid lists accepted, including trimmed and Node-joined repeats; empty, malformed, over-long, duplicate or bad-token lists give 400 `invalid_request` after the authorization-context check and before `pool.connect()` (handler level, mock pool never connected), plus one real-PostgreSQL zero-mutation check |
| C04 | Real PostgreSQL: a synthetic version 2 snapshot (inserted directly) makes delivery 409 `question_type_unsupported` with no content, save 409 with no answer row or version change, readiness `not_ready` / `question_snapshot_content_invalid` with the v1 blocker `schema_version_invalid`, and `activate` refused; a client header without v1 gets 409 on both delivery and save of a v1 exam; delivery of a paused, locked or submitted attempt keeps its existing refusal even with an unsupported row |
| C05 | Real PostgreSQL v1 regression: delivery, save (new, idempotent, conflict, stale), resume, submit and finalization unchanged; a finalized all-v1 exam has `BASELINE_SINGLE_CHOICE_V1` and `item_outcomes` exactly as before |
| C06 | Composite through a test-only registry: `scoreAttempt` and `freezeExamResults` (real PostgreSQL) give `COMPOSITE_PER_ITEM_V1`, per-item `ruleId`, `selectedOptionId` only on v1 items, exact bigint micro-point sums and half-up scaling; through the real save handler with the injected registry and a header listing the test key, an empty answer of an `allowsEmpty` type is an accepted versioned write and scores UNANSWERED; a registered-v2 invalid row gives readiness `question_content_invalid` |
| C07 | Client: the header is sent on delivery and on the real engine-driven save; new records carry `contentKey`; a legacy record without it syncs as v1 with the same payload; legacy and new records survive a store reopen and adoption by another session with identical payload, version and discard behaviour; an unsupported key is never sent, ends failed with `question_type_unsupported` and is never shown as saved; 409 `question_type_unsupported` is `rejected` without retry; no key leakage in stored records |
| C08 | Every existing unit, integration and E2E test passes unchanged; scope inside the frozen allowlist; 33 Tasks and 78 edges; exact-SHA attempt-1 eight-job CI, no re-run |
| C09 | Independent contract and implementation review PASS; Delegated Acceptance; evidence commit; delegated merge |

There is no material UI, so there is no rendered baseline. If implementation shows a UI change is needed, it is a STOP for a contract correction, not scope creep.

## 8. History

- 2026-11-07: contract prepared under DEC-048 on main aa2c042 after SEC-OPS-001 landed. Owner decisions recorded in §4.

## 9. Independent contract review

**Original review** by a fresh-context read-only Owner-designated reviewer, on SHA-256 34b8b996018e7fb63394470839bd33af423e1912aa99474e70b0a8bf68673da7: **STOP**, six material findings.

- **F1:** classifying save through the content validator would refuse minimal v1 fixtures that are accepted today.
- **F2:** an unsupported readiness blocker would change an existing preflight assertion (`schema_version_invalid` for a version 2 row).
- **F3:** "intersect with the production registry" contradicted registry injection.
- **F4:** the save header was placed on an unused client function.
- **F5:** "before any database work" cannot hold, because production wiring authorizes first.
- **F6:** the reload and takeover evidence the Task card requires was missing.

The reviewer found the design faithful to A01-1/A01-2/A01-4/O02-2 otherwise. It found no security or privacy defect, the header safe, lock order and authority unchanged, and the exclusions justified.

**Correction 1:** §5A.

**First targeted re-review**, same reviewer, on SHA-256 3c15a23b5abced715515ee1395851d0d884ab07ae552bfd68328c23b25e14aad: **STOP.**

- F1–F6 are CLOSED.
- New N1: in §5A.1 the 409 rule covered only version 2 or higher rows. A v1 row with a header that does not declare v1 would then be accepted on save while delivery refuses it.
- Notes:
  - fold the §5A.10 gate updates into §6 and §7;
  - hand `scoreAttempt` off whenever no row has a registered version 2 or higher key;
  - record this round.

**Correction 2:**
- §5A.1 adds rule (b) and states the save precedence;
- §5A.8 adopts the simpler hand-off rule;
- §6 row 12–13 purposes and §7 C02, C03, C04, C06 and C07 are aligned with §5A.

**Second targeted re-review**, same reviewer, on SHA-256 83d6d317f11c3a229f772384fdfea1063fd795acecec83d9b80ef177a888dc64: **PASS.**

- N1 is CLOSED; there is no new material finding.
- Notes:
  - the save refusal order on a finished attempt (recorded in §5A.9);
  - pre-READY draft source in the worktree (§10);
  - a possible import cycle between `question-contract.ts` and `answer.ts`, for the implementation review;
  - the READY steps.
- **Independent contract review chain: STOP → STOP → PASS.**

## 10. Formal READY and Build start under DEC-048 — 2026-11-07

- **Eligibility (00.13 §4.1):**
  - SEC-001 is DONE / MERGED. SEC-OPS-001 is DONE / MERGED (main aa2c042, post-merge CI #155 attempt 1 eight SUCCESS), so no other Task is in flight.
  - O02, O05 and A01 were approved by the Owner on 2026-11-07 (§4), and the A01 reviewer is the Owner-designated reviewer, whose contract chain PASSED. O09 rests on the approved P5 content.
  - No OPEN policy or unapproved architecture input is used, and the Task is not prepare-only.
- **Formal READY: PASS.**
  - Frozen allowlist: rows 5–21 of §6; rows 1–4 are Task-flow paths. No migration is reserved; none is needed.
  - Expected outcomes are only those in §5, §5A and §7.
- **Pre-READY draft:** a draft of `runtime/secure-assessment/src/question-contract.ts` and draft edits to `question-delivery.ts` and `answer.ts` were written in the worktree while the contract was under review. They are uncommitted. They are reviewed against this frozen contract with the rest of the implementation, and are not part of the registration commit.
- **Frozen CI-first order:**
  1. Registration, carrying the SEC-OPS-001 landing record and the Owner decisions (§4).
  2. The implementation content commit.
  3. Independent implementation review by the same reviewer.
  4. Delegated Acceptance and the evidence commit.
  5. PR-head CI, the delegated squash merge, then post-merge main CI.

  There is no material UI, so there is no rendered baseline. No re-runs.
- **Status:** BLOCKED → READY → IN_PROGRESS. Counters: DONE 6, IN_PROGRESS 1, BLOCKED 26. 33 IDs and 78 edges unchanged. PB05 and PB12 OPEN.

## 11. Implementation checkpoint — 2026-11-07

- **CI-first step 1:** registration 4a8fd30, CI #156 (run 42375034561) attempt 1, eight SUCCESS.
- **Implementation candidate (CI-first step 2):** inside the frozen allowlist rows 5–21 plus the Task-flow rows 1–4; it includes the pre-READY draft named in §10, now completed.
  - **`question-contract.ts`:**
    - content keys, the total classification, the registry with only the v1 descriptor, `parseDeclaredQuestionTypes` and `effectiveSupport`;
    - the v1 descriptor wraps the unchanged v1 validator, view, answer check and rule;
    - the rule literal equals `BASELINE_SCORING_RULE` (asserted), and the module imports no scoring code, to avoid an import cycle at load time.
  - **Delivery:** the header is checked after the context check and before `pool.connect()`; rows are classified in the delivered order; 409 `question_type_unsupported` without content; invalid stays 500; v1 view unchanged.
  - **Save:** the same header point; `checkAnswerForContent` sits at the existing payload check (§5A.1); `isAnswerForQuestion` is unchanged.
  - **Readiness:** a registered version 2 or higher row is judged by its descriptor (`question_content_invalid`); every other row keeps the v1 result.
  - **Scoring:** `scoreAttempt` hands off to `scoreBaselineAttempt` when no registered version 2 or higher row exists; otherwise `COMPOSITE_PER_ITEM_V1` with per-item rules and bigint totals. `freezeExamResults` takes an optional registry; all-v1 output is unchanged.
  - **Client:** content key types and `SUPPORTED_QUESTION_TYPES`; the header on delivery and on the real save path; `contentKey` on new records (optional in the type); unsupported keys are never sent and end failed; `question_type_unsupported` is rejected.
  - **Documents:** appended decision pointers in P2 and P4.
  - Registries can be injected only through handler dependencies and function arguments. The production server wiring is unchanged, so a request cannot reach a test registry.
- **Tests:**
  - `test/question-contract.test.ts`: C01 classification; C02 v1 golden equivalence for scoring, view and answer acceptance, including minimal content and the version 2 single choice refusal; C03 header parsing and handler-level ordering with a never-connected pool; C06 composite scoring.
  - `test/integration/question-types.test.ts` (real PostgreSQL): C03 zero mutation, C04 refusals, readiness and activation, C05 v1 regression through production wiring, and C06 empty versioned writes and composite finalization with a test-only registry.
  - `frontend/web/src/__tests__/answerTypes.test.tsx`: C07.
- **Local verification:**
  - typechecks PASS for Secure Assessment and the web client;
  - Secure Assessment units PASS (the new file, plus 173 existing answer, delivery, scoring, readiness and contract tests);
  - web tests PASS: the new file 7/7, and the existing sync engine, storage, workstation, resilience, pause, flags, messages and participant-time files.

  Integration oracles run in CI only (the 8 GB workstation rule).
- **Next:** exact-content CI on the candidate head, then the independent implementation review by the same reviewer, Delegated Acceptance and the evidence commit. No re-runs.
- **Status:** IN_PROGRESS → VERIFYING. Counters: DONE 6, VERIFYING 1, BLOCKED 26. 33 IDs and 78 edges unchanged. PB05 and PB12 OPEN.
