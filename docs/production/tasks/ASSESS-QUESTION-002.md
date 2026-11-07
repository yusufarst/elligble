# ASSESS-QUESTION-002 — Multiple Response

## 1. Control state and authority

| Field | Disposition |
|---|---|
| Classification | Active P11 Task; P1 all eight formats; HIGH risk; R11, R02, R03, R25, R30; P8 V02–V06, V09–V12 |
| Status | **VERIFYING — implementation candidate published for exact-content CI and the independent implementation and rendered review (§11); DEC-048** |
| Objective | Deliver multiple response ("Pilihan ganda kompleks") end to end: author through the approved import format, teacher preview, Student answer with local recovery, submit, and score under the approved exact-set rule, on the ASSESS-QUESTION-001 foundation |
| Owner decisions | O02-1, O02-2, O02-3 and O02-12, approved 2026-11-07 and recorded in [ASSESS-QUESTION-001 §4](ASSESS-QUESTION-001.md); A01-1/A01-2/A01-4 as implemented there. Reviewer: the standing Owner-designated read-only subagent reviewer |
| Execution authority | DEC-048 (00.13). Internal dependency ASSESS-QUESTION-001 is DONE / MERGED (main 8ade3ae4316a2839d91311be2037e8bfbb8c745f, post-merge CI #160 attempt 1 eight SUCCESS). O09 rests on the approved P5 content |
| Base and branch | main 8ade3ae; branch task/assess-question-002-multiple-response, worktree `C:\Projects\ELLIGBLE-question-002` |
| Parallel safe / cost | No parallel baseline Task; no dependency, vendor, service or cost |

Authority: [DEC-044](../../00-governance/00.11_CBT_RELEASE_SCOPE_REALIGNMENT.md), [DEC-045 §5](../../00-governance/00.12_AICWDF_ADOPTION_AND_TASK_EXECUTION.md), [DEC-048](../../00-governance/00.13_STANDING_EXECUTION_DELEGATION.md), [TASK_PLAN ASSESS-QUESTION-002/§4/§8](../TASK_PLAN.md), [P2 row R11](../CBT_DOMAIN_RULES_SPECIFICATION.md), [ASSESS-QUESTION-001 §4/§5/§5A](ASSESS-QUESTION-001.md), D04.3-61/62 (structured import with a question-type column, LOCKED), D04.8-08 (exact correct set). No LOCKED decision or PB status changes.

## 2. Reuse and bounded gaps

Reused unchanged:
- the content-key registry, classification, client-declared types, explicit refusals and the composite rule (ASSESS-QUESTION-001);
- the save route with its lock order, write identity and version;
- delivery and resume envelopes;
- the teacher import flow (Periksa → Jadwalkan Ujian), schedule, readiness and lifecycle;
- finalization;
- the sync engine and IndexedDB store;
- the option-card styling of the exam screen.

Gaps closed (all for multiple response only):
1. no descriptor, so a multiple-response row is unsupported;
2. the import parser refuses more than one correct letter (`correct_multiple`), and only `elligble-questions-v1` is accepted (including the 0048 CHECK);
3. teacher preview shows non-v1 content as invalid;
4. provisional teacher results score with the v1 rule only;
5. the client models an answer as one option id;
6. the exam screen has no multiple-choice control.

Excluded:
- every other new type (003–008);
- browser authoring and the bank (009);
- media (ASSESS-MEDIA-001);
- mixed-format convergence beyond PG and PGK (010);
- partial or negative credit;
- showing the number of correct options to the Student;
- result reporting of composite item detail (RESULT-004);
- the operator CLI's own wording beyond accepting the same file;
- any change to v1 content, answers or results.

## 3. Settled inputs

- **O02-3:** five options A–E; the correct set has 1–5 options; the count is not shown; the instruction is "Pilih semua jawaban yang benar"; exact-set scoring (D04.8-08); duplicate or foreign ids are rejected.
- **O02-1:** an exact match earns maxScore, anything else 0; unanswered 0; maxScore >0 and ≤1000 with 2 decimals; the same scaling.
- **O02-2:** an empty selection is an accepted, versioned write that counts as UNANSWERED and is shown as "Belum dijawab".
- **O02-12:** `elligble-questions-v1` stays accepted without change. `elligble-questions-v2` adds a `type` column; import is atomic.
- **A01:** new types are `schemaVersion: 2`; v1 is never reinterpreted; per-item rule IDs; the composite rule for mixed exams.

## 4. Contract

### 4.1 Content, answer and score (`runtime/secure-assessment/src/question-types/multiple-response.ts`, new)

- **Key:** `2:MULTIPLE_RESPONSE`. **Rule:** `MULTIPLE_RESPONSE_EXACT_SET_V1`. It is registered in the production registry next to v1.
- **Content** (`validateContent`): an object with
  - `schemaVersion: 2` and `questionType: 'MULTIPLE_RESPONSE'`;
  - a meaningful `prompt`;
  - `options`, exactly five `{id, content}` with non-blank unique string ids and meaningful content;
  - `correctOptionIds`, an array of 1–5 unique strings, each an option id;
  - `maxScore`, a finite number > 0.

  "Meaningful" uses the same `isMeaningfulJson` as v1. Extra keys are allowed, as in v1.
- **Student view:** `{schemaVersion: 2, questionType: 'MULTIPLE_RESPONSE', prompt, options: [{id, content}]}` in authored option order. It has no correct set, no count and no maxScore.
- **Answer** (`validateAnswer`): an object whose only key is `selectedOptionIds`, an array of 0–5 strings, unique, each an option id. `[]` is ok and empty (`allowsEmpty: true`). Anything else is invalid (400 `invalid_answer_payload`).
- **Score:**
  - no answer or `[]` → UNANSWERED, 0;
  - the selected set equals the correct set (order-independent) → CORRECT, maxScore;
  - otherwise → INCORRECT, 0.

### 4.2 Import (`elligble-questions-v2`)

- **Header** (10 columns): `no,type,prompt,option_a,option_b,option_c,option_d,option_e,correct,score`. Delimiter detection and decoding are as in v1.
  - A file whose header is exactly v1 is parsed by the unchanged v1 rules and recorded as v1.
  - A file whose header is exactly v2 is parsed by the v2 rules.
  - Anything else is `header_invalid`.
- **`type`** (case-insensitive, trimmed):
  - `PG` (pilihan ganda) → a v1 single-choice question, built exactly as today, so single choice stays v1 content;
  - `PGK` (pilihan ganda kompleks) → a multiple-response question;
  - anything else → the new problem `type_invalid`.
- **`correct`:**
  - for `PG`, one letter A–E, with the v1 problems (`correct_multiple`, `correct_invalid`);
  - for `PGK`, 1–5 letters A–E separated by commas and/or spaces (for example `A,C` or `A C`). An empty cell or any other character is `correct_invalid`; a repeated letter is the new problem `correct_duplicate`.
- **Unchanged checks:** `no`, prompt, the five options, duplicate options, score, the 200-question limit and atomicity are exactly as in v1. The batch records the template actually used.
- **Migration 0060** (`0060_question_import_template_v2.sql`) changes `ck_sa_question_import_batch_template` to `template IN ('elligble-questions-v1', 'elligble-questions-v2')`. Existing rows are unchanged, with no backfill.
- **Teacher template:** "Unduh Templat CSV" gives the v2 template (semicolons, decimal comma, BOM) with one PG row and one PGK row. v1 files keep working.
- **Teacher wording** for the new problems, Bahasa Indonesia, no em dash:
  - `type_invalid`: "Tipe soal harus PG atau PGK";
  - `correct_duplicate`: "Huruf kunci jawaban tidak boleh berulang";
  - PGK `correct_invalid`: "Kunci jawaban PGK berisi satu sampai lima huruf A sampai E, misalnya A,C";
  - the column count message names the template's own count.
- **Import preview:** each question shows its type ("Pilihan ganda" or "Pilihan ganda kompleks") and its key letters.
- **Operator CLI** `exam import` uses the same parser and builder, so it accepts the same v2 file.

### 4.3 Teacher preview ("Pratinjau Soal")

- The server returns, per question, `questionType`.
  - v1 keeps `correctOptionId`.
  - Multiple response adds `correctOptionIds` (authored order) and `maxScore`, and is `valid` when its descriptor validates it.
  - Other content stays `valid: false`, as today.
- The view labels the type. For multiple response it shows the instruction "Pilih semua jawaban yang benar", try-out checkboxes (local only, as the single-choice try-out is today) and, on request, every key option marked "Kunci jawaban". Zero attempts are created, as today.

### 4.4 Results

- Provisional teacher results score through `scoreAttempt` with the production registry. All-v1 exams keep exactly today's values and rule; an exam with multiple response shows its scores and the composite rule.
- The finalized path is unchanged; it already reads the frozen rule.
- `readFinalizedResults` types `selectedOptionId` and `ruleId` as optional, matching composite items. CSV export shows the rule string it receives.

### 4.5 Client answer model

- **Canonical value string.** A queued intent and the engine's server state keep one string per question (the existing `optionId` field, so stored records stay compatible):
  - for v1 it is the option id, unchanged;
  - for multiple response it is the JSON array of the selected ids, sorted, for example `["opt_a1","opt_c3"]`; `[]` is the empty selection.

  The engine's equality, history, adoption, discard, stale and pause handling therefore work unchanged on that string.
- **`answer-sync-api.ts`:**
  - builds the payload by content key (v1 `{selectedOptionId}`; multiple response `{selectedOptionIds: JSON.parse(value)}`, only when it parses to a sorted unique string array);
  - maps server payloads back (`selectedOptionIds` array → the canonical string);
  - refuses any other key before sending, as today.
- **Types:** `SUPPORTED_QUESTION_TYPES` becomes `['1:MULTIPLE_CHOICE_SINGLE', '2:MULTIPLE_RESPONSE']`, so the header declares both.
- **`useAnswerManager`:**
  - `selectOption(snapshotId, value, contentKey)` passes the question's key through `capture`, including for queued pre-engine selections;
  - the resume "unsupported" check accepts both payload shapes;
  - `isAnsweredValue(value)` is false for an absent value and for `[]`.
- **Answered state:** the exam screen, `QuestionNumberButton` and `QuestionNavigatorSheet` count a question as answered only when `isAnsweredValue` holds. An empty selection is therefore "Belum dijawab" in the navigator and the submit summary, while its save status is still shown honestly.

### 4.6 Student control

- **Rendering:** the exam screen renders by `questionType`. v1 is unchanged. Multiple response renders `MultipleResponseAnswer`:
  - a group labelled by the prompt, with the visible instruction "Pilih semua jawaban yang benar.";
  - five checkbox option cards that reuse the existing option-card styles (A–E marker, 48 px minimum height, selected state, focus ring);
  - Space toggles the focused option, Tab moves between options;
  - every target is ≥ 44 px, there is no horizontal overflow from 360 px, and it is readable at 200 % text.
- **Behaviour:**
  - each toggle captures the new canonical set;
  - unchecking the last option captures `[]`;
  - read-only during pause, lock, submit and expiry, as the radio list is today;
  - an option is never preselected;
  - the number of correct options is never shown.
- **Styles:** `frontend/web/src/styles/workstation.css` adds only the checkbox marker variant of the existing option card.

### 4.7 Invariants

- **Routes and locks:** no new route, actor or authority; no change to lock order or transactions.
- **v1:** v1 content, answers, delivery view, scoring, finalization and template behaviour are byte-identical.
- **Single path:** one save pipeline and one timer.
- **No key leak:** the Student view and stored client records never carry `correctOptionIds`.
- **Copy:** Bahasa Indonesia without em dash in new UI copy.

## 4A. Binding review-correction contract — 2026-11-07

This section corrects the contract after the independent contract review (§9). Where §2, §4, §5, §6 or §7 differ, §4A governs.

1. **Existing assertions that this Task changes (F1).**
   - Two existing tests move to the allowlist (rows 32–33), and only the named assertions change:
     - `runtime/secure-assessment/test/question-contract.test.ts`: the production registry keys become `['1:MULTIPLE_CHOICE_SINGLE', '2:MULTIPLE_RESPONSE']`;
     - `frontend/web/src/__tests__/answerTypes.test.tsx`: the supported list and the sent header become `1:MULTIPLE_CHOICE_SINGLE,2:MULTIPLE_RESPONSE`.
   - Every other assertion in those files, and every other existing test, stays unchanged. C04 records this.
2. **Honest unsupported-content state (F2).** This is the first new type's UI Task, as ASSESS-QUESTION-001 §5.7/§5A.9 require.
   - The exam screen handles a delivery 409 `question_type_unsupported`, or a save rejected with it, with an explicit state:
     - it stops re-polling questions;
     - it keeps the timer and status display;
     - it shows "Soal ujian ini memerlukan versi aplikasi yang lebih baru. Muat ulang halaman untuk melanjutkan." with a "Muat Ulang" button that reloads the page.
   - Unit test and rendered capture (C08).
3. **A cleared answer is "Belum dijawab" (F3, O02-2).**
   - On the exam screen and in the navigator, an acknowledged empty selection (`[]`) shows "Belum dijawab", not "Tersimpan". "Menyimpan..." and "Gagal menyimpan" are shown as today, while an empty write is pending or has failed.
   - **Staff monitoring:** `runtime/secure-assessment/src/exam-monitoring.ts` joins the allowlist (row 34). Its answered count excludes rows whose payload is `{selectedOptionIds: []}`; the last-accepted time still covers every row. All-v1 counts are identical.
   - Real-PostgreSQL vector in C03.
4. **Exact canonical mapping (F4)** in `answer-sync-api.ts`, shared by every client reader:
   - **Server to client:**
     - `{selectedOptionId: string}` → that string;
     - `{selectedOptionIds: string[]}` with unique strings → `JSON.stringify` of the array sorted by UTF-16 code units (`[...ids].sort()`). An unsorted server array is sorted.
     - Any other shape, including a non-array, non-strings or duplicates → `null`, which keeps today's `unsupported_payload` path.
   - **Client to server:**
     - for a multiple-response key, the value must `JSON.parse` to an array of unique strings, already sorted. Otherwise the adapter returns `rejected` / `invalid_answer_payload` and sends nothing.
     - the v1 key builds `{selectedOptionId}` exactly as today.
   - **After submission:** `countUnreceivedLocalAnswers` compares through the same mapping. A local record whose value is `[]` counts as received when the server holds `[]` **or holds no row**, because both are UNANSWERED.
   - **Answered helper:** `isAnsweredValue(contentKey, value)` takes the key. For v1, any non-null value is answered (unchanged). For multiple response, any value except `[]` is answered.
   - `selectOption`'s `contentKey` defaults to v1, so existing callers and tests keep working.
5. **v2 is extended by appending columns (F5).**
   - O02-12 defines one v2 template, "a `type` column and type-specific columns". This Task freezes its first header, the 10 columns of §4.2.
   - Rule: later type Tasks may extend `elligble-questions-v2` **only by appending** new type-specific columns after `score`. A file with exactly this 10-column header stays a valid v2 file forever, and empty appended columns are allowed for types that do not use them. A header that changes, removes or reorders these 10 columns is not v2.
   - So the stored batch template `elligble-questions-v2` always names a file that still parses under the latest v2 parser, and provenance (D04.3-66) stays unambiguous. ASSESS-QUESTION-010 converges mixed-format import and media on the same template.
   - This is an engineering reading of the approved O02-12, not a new policy.
6. **Import and preview precision (F6).**
   - **Operator wording:** `describeQuestionProblem` (English, operator-facing) gets wording for `type_invalid` and `correct_duplicate`. §2's exclusion is narrowed to "no other CLI change".
   - **`header_invalid` copy** (teacher and operator) names both accepted headers. Teacher text: "Baris judul kolom harus sama dengan templat ELLIGBLE. Unduh templat terbaru lalu salin soal Anda ke dalamnya."
   - **`column_count`:** a v1 problem keeps exactly `{code, line, found}`. A v2 problem adds `expected: 10`. The client words a problem without `expected` as 9 columns, as today.
   - **Import preview item:** keeps `correct` (the letters, joined by ", " for PGK) and adds `type: 'PG' | 'PGK'` and `correctLetters: string[]`. A missing `type` renders as PG, and its key mark uses `correctLetters` when present, else `correct`.
   - **Teacher preview item:** adds `questionType`: `'MULTIPLE_CHOICE_SINGLE'` for valid v1, `'MULTIPLE_RESPONSE'` for valid multiple response, and `null` for invalid content. It adds `correctOptionIds: string[] | null`. A missing `questionType` renders exactly as today.
   - **Provisional results rule:** the scored rule (`BASELINE_SINGLE_CHOICE_V1` or `COMPOSITE_PER_ITEM_V1`). When scoring is unavailable it stays `BASELINE_SINGLE_CHOICE_V1`, as today.
   - **Stored non-array payloads** on a multiple-response row score UNANSWERED, mirroring v1's non-string handling.
7. **Gates and order (F7).**
   - **Frozen CI-first order:**
     1. Registration (record and trackers, carrying the ASSESS-QUESTION-001 landing).
     2. A capture-only baseline commit that changes only `e2e/tests/99-question-types.spec.ts`: it captures the existing v1 exam screen, v1 teacher preview and import view, and its CI artifacts are validated before any application change.
     3. Implementation.
     4. Independent implementation and rendered review by the same reviewer.
     5. Delegated Acceptance and the evidence commit.
     6. PR-head CI, the delegated squash merge, post-merge main CI.

     No re-runs.
   - **C08 "before" captures** are of v1 content. The "after" captures add multiple-response content.
   - **Render conditions:**
     - widths 360, 390, 430, 768, 1024, 1280 and 1440, plus a short landscape 640×360;
     - 200 % text;
     - long PGK option content (wrapping, no overflow);
     - `prefers-reduced-motion: reduce`;
     - `env(safe-area-inset-*)` honoured by the existing dock;
     - the unsupported-content state of §4A.2.
   - **Journeys** (C06/C07):
     - offline: toggle several times while offline, reconnect, and only the final set is saved;
     - submit with a pending PGK save (V06);
     - read-only under pause and lock.
   - **Artifacts** are named `workspace-question-*.png` and `workspace-question-*.json`, so the existing ci.yml artifact paths cover them and row 31 is not needed.
   - **E2E:** the five browser projects use separate schedule windows, as spec 6 does.
8. **Frontend skill and design checkpoint (F8).**
   - **Skills:**
     - engineering `react-typescript-vite` (SHA-256 450285288fba41f497991f074f100a43ed2d714e51818caae3294663e5ccd558);
     - responsive `frontend-responsive-ui` (d72a56fa99d64b54c9af01037802006ebe9e1c711f4cfc75a2fb0f34a2904ec1);
     - rendered QA `web-design-reviewer` (a08a147cfe555dabe30f2c8f2e267f287e992f74f2b802e68989884338e23b17).

     All three are verified against the canonical inventory (FRONTEND_AGENT_SKILL_STACK §3). Nothing is installed.
   - **DesainPakeAI:** the `dpai` CLI is installed, but no `DPAI_API_KEY` is present in this execution environment. No DesainPakeAI guidance is consulted, and there is no design-authority claim. The design follows the locked design system and existing primitives.
   - **Option card variant:** the option-card checkbox is a documented variant of the existing option card, used by the Student control and the teacher-preview try-out (§10.1: a pattern used twice). Its selected state follows FDS §21 as locked by the Owner: green as soon as it is chosen, and also shown by the checked mark, not by color alone. The A–E marker shows the letter; when checked, the check badge is shown as for radio cards.
9. **Precisions:**
   - **Save-path refusal state:** `useAnswerManager.ts` builds it. It wraps the `SyncApi.save` it gives the engine to observe `rejected` / `question_type_unsupported`, and recognises records the engine refuses locally from the question's content key. `answer-sync-engine.ts` stays unchanged.
   - **Operator `header_invalid` wording** starts with the existing v1 text, so `question-import.test.ts:83` (`/^line 1: header must be exactly: no,prompt,option_a/`) still matches, then adds "or (v2): no,type,prompt,option_a,…,score".
   - **Teacher `header_invalid` copy** follows the existing "Baris N: " prefix: "judul kolom harus sama dengan templat ELLIGBLE (no;prompt;option_a sampai option_e;correct;score, atau no;type;prompt;option_a sampai option_e;correct;score). Unduh templat terbaru lalu salin soal Anda ke dalamnya."
   - **Teacher preview fields:** a multiple-response item has `correctOptionId: null`; a v1 item has `correctOptionIds: null`.
   - the migration is `0060_secure_assessment_question_import_template_v2.sql`;
   - C05 includes a synthetic rollback;
   - import vectors use semicolon files, or quoted cells in comma files;
   - existing callers of `selectOption` keep the v1 default.

## 5. Expected vectors (O02 READY condition; P2 R11 and O02-3)

Content `{options A–E with ids oA..oE, correctOptionIds [oA, oC], maxScore 2}`:

| # | Answer | Expected |
|---|---|---|
| V1 | `{selectedOptionIds: [oA, oC]}` | accepted; CORRECT, 2 |
| V2 | `{selectedOptionIds: [oC, oA]}` | accepted; CORRECT, 2 (order-independent) |
| V3 | `{selectedOptionIds: [oA]}` (missing) | accepted; INCORRECT, 0 |
| V4 | `{selectedOptionIds: [oA, oC, oD]}` (extra) | accepted; INCORRECT, 0 |
| V5 | `{selectedOptionIds: [oB, oD]}` (wrong) | accepted; INCORRECT, 0 |
| V6 | `{selectedOptionIds: []}` | accepted, versioned write; UNANSWERED, 0 |
| V7 | no answer | UNANSWERED, 0 |
| V8 | `{selectedOptionIds: [oA, oA]}` | 400 `invalid_answer_payload` (duplicate) |
| V9 | `{selectedOptionIds: [oA, 'oZ']}` | 400 (foreign id) |
| V10 | `{selectedOptionIds: 'oA'}`, `{selectedOptionId: 'oA'}`, `{selectedOptionIds: [oA], extra: 1}`, `{selectedOptionIds: [1]}`, six ids | 400 |
| V11 | content with an empty, duplicate or foreign correct set, 4 or 6 options, or maxScore ≤ 0 | invalid content: readiness `question_content_invalid`, delivery 500 |

Mixed exam:
- one v1 question (max 1, answered correctly) and V1 (max 2) → `COMPOSITE_PER_ITEM_V1`, raw 3/3, 100;
- the same with V3 → raw 1/3, 33.33.

Import vectors: `PGK` with `A,C`, `a c`, `A, C` → set {A, C}. `PGK` with `A,A` → `correct_duplicate`; with `A,F`, empty or `semua` → `correct_invalid`. `PG` with `A,C` → `correct_multiple`. Type `pgk` is accepted; type `PGX` → `type_invalid`. A v1 file → unchanged v1 result.

## 6. Exact proposed file scopes (frozen at READY)

| # | Path | Purpose |
|---|---|---|
| 1 | docs/production/tasks/ASSESS-QUESTION-002.md | Contract, history, evidence |
| 2 | docs/production/TASK_PLAN.md | Status, counters, ASSESS-QUESTION-001 landing record |
| 3 | docs/production/PRODUCTION_COMPLETION_PLAN.md | Status and continuity |
| 4 | docs/DOCUMENT_MANIFEST.md | Index |
| 5 | docs/production/CBT_ARCHITECTURE_DELTA_REVIEW.md | Appended checkpoint |
| 6 | database/migrations/0060_secure_assessment_question_import_template_v2.sql | Template CHECK |
| 7 | runtime/secure-assessment/src/question-types/multiple-response.ts | Descriptor |
| 8 | runtime/secure-assessment/src/question-contract.ts | Register the descriptor |
| 9 | runtime/secure-assessment/src/question-import.ts | v2 parser |
| 10 | runtime/secure-assessment/src/exam-provisioning.ts | Multiple-response builder; batch template |
| 11 | runtime/secure-assessment/src/teacher-exam-import.ts | Per-type snapshots and preview |
| 12 | runtime/secure-assessment/src/ops/provisioning/exam.ts | Same parser and builder for the CLI |
| 13 | runtime/secure-assessment/src/teacher-exam-preview.ts | Type-aware preview |
| 14 | runtime/secure-assessment/src/teacher-results.ts | Provisional scoring through `scoreAttempt` |
| 15 | runtime/secure-assessment/src/result-finalization.ts | `readFinalizedResults` item type |
| 16 | frontend/web/src/types/assessment.ts | Supported types, preview and import types |
| 17 | frontend/web/src/lib/question-import.ts | v2 template and wording |
| 18 | frontend/web/src/exam/answer-sync-api.ts | Payload by key, canonical values |
| 19 | frontend/web/src/hooks/useAnswerManager.ts | Key-aware selection, answered helper |
| 20 | frontend/web/src/components/answers/MultipleResponseAnswer.tsx | Student control |
| 21 | frontend/web/src/components/StudentExamWorkstation.tsx | Render by type; answered counts |
| 22 | frontend/web/src/components/QuestionNumberButton.tsx | Answered helper |
| 23 | frontend/web/src/components/QuestionNavigatorSheet.tsx | Answered helper |
| 24 | frontend/web/src/components/TeacherExamPreviewView.tsx | Multiple-response preview |
| 25 | frontend/web/src/components/TeacherExamImportView.tsx | Type and key letters in the import preview |
| 26 | frontend/web/src/styles/workstation.css | Checkbox marker variant |
| 27 | runtime/secure-assessment/test/multiple-response.test.ts | Units: descriptor and parser vectors |
| 28 | runtime/secure-assessment/test/integration/multiple-response.test.ts | Real PostgreSQL journey and migration |
| 29 | frontend/web/src/__tests__/multiple-response.test.tsx | Control, sync and preview |
| 30 | e2e/tests/99-question-types.spec.ts (renamed by §10A) | Capture baseline, five-browser journey and rendered evidence |
| 31 | (withdrawn by §4A.7: the existing artifact paths are used; ci.yml is forbidden) | — |
| 32 | runtime/secure-assessment/test/question-contract.test.ts | One assertion: production registry keys (§4A.1) |
| 33 | frontend/web/src/__tests__/answerTypes.test.tsx | Supported list and header assertions (§4A.1) |
| 34 | runtime/secure-assessment/src/exam-monitoring.ts | Answered count excludes empty selections (§4A.3) |

Forbidden:
- every other file, including existing tests (they must pass unchanged as the regression oracle);
- completed Task records;
- earlier migrations;
- lockfiles and dependencies;
- other workflow changes;
- production resources.

## 7. Acceptance gates (DEFINED / NOT EXECUTED)

| Gate | Expected outcome |
|---|---|
| C01 | Descriptor vectors V1–V11 and the mixed-exam vectors as units; the production registry holds exactly v1 and multiple response |
| C02 | Parser vectors (§5 import) and v1 parser behaviour unchanged on the existing parser tests |
| C03 | Real PostgreSQL: a teacher imports a v2 file (PG + PGK) atomically, with the batch template v2; previews the key set; schedules; readiness passes; a Student answers through HTTP (V1/V2/V6, refusals V8–V10 with zero mutation); resume returns the canonical payload; submit; finalize → composite rule, per-item rules and exact totals; provisional and final teacher results agree |
| C04 | v1 regression: v1 files, delivery, save, scoring, finalization, preview and results are unchanged (existing tests unchanged and passing) |
| C05 | Migration 0060: upgrade from 0059, synthetic rollback, repeat, existing batches unchanged, v2 accepted, other template names refused |
| C06 | Client: toggling captures canonical sorted sets; `[]` saves and reads "Belum dijawab"; recovery after reload and other-session adoption restore the set; legacy v1 records unchanged; the payload is built by key; malformed values are refused locally; `countUnreceivedLocalAnswers` uses the canonical mapping; the unsupported-content state; no correct set in any client record |
| C07 | Five-browser E2E in separate schedule windows: teacher import and preview of PG + PGK; the Student answers PGK with keyboard and pointer, toggles while offline and only the final set is saved after reconnecting, reloads and recovers, clears and reselects, submits with a pending PGK save (V06); the control is read-only under pause; the teacher ends and finalizes and sees the score |
| C08 | Rendered evidence (`workspace-question-*`): a capture-only baseline of v1 content (before) and after captures, including multiple-response content and the unsupported-content state, of the exam screen, teacher preview and import preview at 360, 390, 430, 768, 1024, 1280 and 1440 px, 640×360, 200 % text, long PGK option content and reduced motion; no overflow; every target ≥ 44 px; visible focus; safe areas honoured; independent rendered review PASS |
| C09 | Scope inside the frozen allowlist; 33 Tasks and 78 edges; exact-SHA attempt-1 eight-job CI, no re-run |
| C10 | Independent contract, implementation and rendered review PASS; Delegated Acceptance; evidence commit; delegated merge |

## 8. History

- 2026-11-07: contract prepared under DEC-048 on main 8ade3ae after ASSESS-QUESTION-001 landed; correction 1 (§4A) after the contract review; formal READY (§10).

## 9. Independent contract review

**Original review** by a fresh-context read-only Owner-designated reviewer, on SHA-256 0075859e5c7335b22201f47e3e086d41eeb1200bf0ca6c87f56d71264752be12: **STOP**, eight material findings.

- **F1:** existing tests assert the registry and the supported list that this Task changes.
- **F2:** the honest reload state assigned to the first type UI Task was omitted.
- **F3:** a cleared answer would show "Tersimpan", and monitoring would count it as answered.
- **F4:** the canonical mapping, including `countUnreceivedLocalAnswers` and malformed values, was incomplete.
- **F5:** freezing the v2 header conflicted with O02-12's type-specific columns.
- **F6:** CLI wording, header copy, `column_count` shape, preview shapes and the provisional rule were underspecified.
- **F7:** the baseline definition, CI-first order, render conditions, offline, V06 and read-only journeys, and artifact names were missing.
- **F8:** no frontend skill or DesainPakeAI checkpoint was recorded.

The reviewer confirmed the descriptor, vectors, PG-as-v1 choice, engine safety of the canonical string, replay determinism and the migration. It found no security or privacy defect.

**Correction 1:** §4A.

**Targeted re-review**, same reviewer, on SHA-256 1d87fe0ebf7eeb532add0a522a1030c35013fc6d87cc57e789e17058976fac87: **PASS.**

- F1–F8 are CLOSED; there is no new material finding.
- The non-material notes are folded into §4A.9 and §7 at READY:
  - the save-path refusal state lives in the hook;
  - operator header wording;
  - teacher header copy;
  - preview null fields;
  - gate text.
- **Independent contract review chain: STOP → PASS.**

## 10. Formal READY and Build start under DEC-048 — 2026-11-07

- **Eligibility (00.13 §4.1):**
  - ASSESS-QUESTION-001 is DONE / MERGED (main 8ade3ae, post-merge CI #160 attempt 1 eight SUCCESS); no other Task is in flight.
  - O02-1/2/3/12 were approved by the Owner on 2026-11-07 (ASSESS-QUESTION-001 §4); the expected vectors are frozen in §5; A01 is implemented.
  - O09 rests on the approved P5 content.
  - No OPEN policy or unapproved architecture input is used, and the Task is not prepare-only.
- **Formal READY: PASS.**
  - Frozen allowlist: rows 5–30 and 32–34 of §6 (row 31 withdrawn); rows 1–4 are Task-flow paths.
  - Migration `database/migrations/0060_secure_assessment_question_import_template_v2.sql` reserved after rechecking main 8ade3ae: migrations end at 0059 and no 0060 path exists.
  - Expected outcomes are only those in §4, §4A, §5 and §7.
- **Frontend skill checkpoint (§4A.8):** `react-typescript-vite`, `frontend-responsive-ui` and `web-design-reviewer`, verified by SHA-256. DesainPakeAI was not consulted, and there is no design-authority claim.
- **Frozen CI-first order:** as in §4A.7.
  1. Registration.
  2. The capture-only v1 baseline (only `e2e/tests/99-question-types.spec.ts`), with its five artifacts validated.
  3. Implementation.
  4. Independent implementation and rendered review by the same reviewer.
  5. Delegated Acceptance and the evidence commit.
  6. PR-head CI, the delegated squash merge, post-merge main CI.

  No re-runs.
- **Status:** BLOCKED → READY → IN_PROGRESS. Counters: DONE 7, IN_PROGRESS 1, BLOCKED 25. 33 IDs and 78 edges unchanged. PB05 and PB12 OPEN.

## 10A. READY correction 1 (spec file name and participant) — 2026-11-07

- **Finding:** writing the capture-only baseline showed that Playwright orders spec files with `localeCompare`. `10-question-types.spec.ts` would therefore run second, right after `1-pilot-journey`.
  - Later specs assert global state: `6-teacher-import` expects exactly one active teacher exam card, exactly one import batch, and zero attempts outside finalized exams.
  - A Task-10 exam created before them would break those unchanged specs.
- **Correction:** allowlist row 30 becomes `e2e/tests/99-question-types.spec.ts` (it sorts after `9-identity`). Its content, purpose and gates are unchanged. Row 30's old name is not created.
- **Participant:** the spec's exam has one participant, `siswa.e2e.06`. The other fixture students are expected in `6-teacher-import`'s exam at an overlapping time, which would block scheduling (D04.2 conflict rule). The five browser projects run in separate CI jobs, each with its own database, so no cross-project conflict arises.
- **Targeted re-review**, same reviewer, on SHA-256 1fce42a0942805669b4d39a16c3bce677ab97af6b42fd64b53eb8c9c8237fefb: **PASS** on §10A, and PASS on the draft spec as the capture-only step 2.
  - Names folded: every earlier mention of `10-question-types` (in §4A.7 and §10) now reads `99-question-types`; the only remaining mention of the old name is §10A's own explanation.
  - The 200 % text method is fixed before the baseline: each element's computed font size and line height are doubled, as in spec 6, and the method is identical in both phases.
  - The after phase adds explicit keyboard-focus captures, the multiple-response scenarios and the unsupported-content state. The before scenarios stay byte-for-byte the same.
  - The spec draft (written before this confirmation, uncommitted) and the descriptor, parser and builder drafts are pre-baseline working-tree work. The descriptor, parser and builder are reviewed with the implementation.

## 11. Baseline and implementation checkpoint — 2026-11-07

### 11.1 Registration and capture-only baseline (CI-first steps 1–2)

| Commit | Content | CI |
|---|---|---|
| b4a878e | registration plus the ASSESS-QUESTION-001 landing record | #161 SUCCESS |
| c7ff705 | READY correction record (§10A) | #162 cancelled by the next push (concurrency) |
| c37f656 | record text repair | #163 SUCCESS |
| 4b9b00f | capture-only baseline (spec only) | #164 FAILURE: five E2E jobs; the other class members were expected in an overlapping exam, and spec 9 adds a claimed student |
| 18ba220 | baseline: keep only `siswa.e2e.06` (spec only) | #165 FAILURE: WebKit refused a full-page image above 32767 px |
| 44d99f1 | baseline: cap the full-page height (spec only) | #166 FAILURE: WebKit renders at device pixel ratio 3 |
| 3138f06 | baseline: the cap counts device pixels (spec only) | **#167 attempt 1, eight SUCCESS** |

- Every failed run is preserved. None was re-run; each correction was a new spec-only SHA.
- **Artifacts of #167, all five retrieved:** 50 screenshot/JSON pairs per project (250), every one phase `before` at commit 3138f06 with frontend tree 95c0845 (= main 8ade3ae). Scenarios: import preview, teacher preview (single and key shown) and the exam screen (two v1 questions), at seven widths, 640×360 and two 200 % text variants.
- **Recorded, not blessed, baseline defects** on the existing import view (allowlist row 25), fixed in the candidate and gated in the after phase:
  - "Kembali ke Pelaksanaan Ujian" is 36 px high and "Unduh Templat CSV" is 23 px high, below 44 px, at every width;
  - the page overflows horizontally at 390 px with 200 % text (537 px).

  The exam screen and the teacher preview had no target or overflow defect.

### 11.2 Implementation candidate (CI-first step 3)

Inside the frozen allowlist (rows 5–30 and 32–34). Rows 22–23 needed no change: the exam screen passes only answered values to the navigator.

- **Server:**
  - descriptor `question-types/multiple-response.ts`, registered in the production registry;
  - the v2 parser (PG/PGK, `type_invalid`, `correct_duplicate`, `column_count` with `expected` for v2 only, both headers in the operator text);
  - builders: PG as v1 content, PGK as multiple response; the batch records its template; the operator CLI uses the same builder;
  - type-aware teacher preview (`questionType`, `correctOptionIds`);
  - provisional results through `scoreAttempt` (the reported rule is the scored rule);
  - optional `ruleId`/`selectedOptionId` on finalized items;
  - monitoring does not count `{selectedOptionIds: []}`;
  - migration 0060.
- **Client:**
  - the pure answer-value helpers (`EMPTY_SELECTION`, `canonicalSelection`, `answerValueOf`, `selectionOf`, `isAnsweredValue`) are in `types/assessment.ts`, so the route-parity guard over `answer-sync-api.ts` stays unchanged;
  - the adapter builds the payload by key and refuses a malformed value locally;
  - `countUnreceivedLocalAnswers` uses the canonical mapping;
  - the hook passes the content key and observes `question_type_unsupported` without changing the engine;
  - `MultipleResponseAnswer` (checkbox option cards, the instruction, no count);
  - the exam screen: "Belum dijawab" for a cleared choice, answered values only to the navigator and counts, and the "Perlu Memuat Ulang" state for both the delivery and the save refusal. Both stop polling; the server time keeps running;
  - teacher preview and import preview by type;
  - the v2 template download and the new wording (no em dash);
  - the checkbox marker variant uses a token color.
- **Baseline defects fixed in the import view:** 44 px minimum on both buttons; `min-w-0` on the schedule columns and inputs. The intro names PG and PGK.
- **E2E after phase:**
  - the same five baseline scenarios, plus the PGK teacher preview with the key, and the exam screen with PGK empty, keyboard focus, selected and cleared, and the unsupported state;
  - the journey: keyboard and pointer, offline toggles with only the final set saved, reload recovery, clear to "Belum dijawab", the reload state, read-only during a pause, submit with a pending save (V06), and end and finalize with the exact score;
  - the after phase also records the elements reaching past the viewport, for diagnosis.
- **Tests:** `test/multiple-response.test.ts` (C01/C02), `test/integration/multiple-response.test.ts` (C03/C05), `frontend/web/src/__tests__/multiple-response.test.tsx` (C06), and the two §4A.1 assertions.
- **Local verification:**
  - typechecks PASS (runtime, web, e2e);
  - Secure Assessment units PASS (933, including route parity after moving the helpers);
  - the new web tests 7/7, plus the affected existing files, PASS when run in groups.

  A full local web run timed out in four heavy UI files under workstation load. They pass in smaller groups, and CI is the oracle. Integration and E2E run in CI only.
- **Status:** IN_PROGRESS → VERIFYING. Counters: DONE 7, VERIFYING 1, BLOCKED 25. 33 IDs and 78 edges unchanged. PB05 and PB12 OPEN.

### 11.3 CI #168 and implementation correction 1

- **CI #168/run 42385334232:** exact SHA 625b7d2, push, attempt 1. Web SUCCESS. Runtime FAILURE (real PostgreSQL integration). Container and E2E skipped as dependents. Preserved; no re-run.
- **Cause 1:** the new multiple-response oracle expected 200 from the import confirm; the route answers 201 Created, as before this Task. The test is corrected.
- **Cause 2:** the unchanged `teacher-exam-preview` oracle compares an invalid item with `deepEqual`. Adding `questionType: null` and `correctOptionIds: null` changed that shape.
  - Correction: invalid content now carries **no** type fields, so it keeps exactly its earlier shape.
  - A valid v1 item still carries `questionType` and `correctOptionIds: null`; a multiple-response item carries both.
  - This refines §4A.6 ("null for invalid content") to "absent for invalid content". The client already renders a missing `questionType` exactly as today.
- **Correction 1** (rows 13 and 28 only): `teacher-exam-preview.ts` and the new integration test.

### 11.4 CI #169, implementation review STOP and correction 2

- **CI #169/run 42385656657:** exact SHA ffd4d97, push, attempt 1. Runtime FAILURE (integration). Container and E2E skipped. Preserved; no re-run.
  - Cause: the new oracle called delivery and save without `X-Question-Types`. By the ASSESS-QUESTION-001 rule such a client declares v1 only, so the multiple-response row was refused with 409, as designed.
  - The oracle now declares both keys, and also asserts the 409 for an undeclared client.
- **Independent implementation review, same reviewer, on 625b7d2 + ffd4d97: STOP, three material findings.**
  1. The results oracles read `results`; the route returns `participants`.
  2. The full-page unsupported state departed from §4A.2, and by leaving the active phase it stopped the engine sending other pending answers, as well as the expiry flush.
  3. Client evidence was missing for local recovery, adoption, "no correct set in any record", the save-path refusal and the teacher-preview view.
- **Correction 2** (rows 10, 21, 28, 29, 30 and 1):
  - **Finding 1:** the oracles read `participants` and `answeredCount`.
  - **Finding 2, §4A.2 now implemented as written.** The refusal is a flag, not a phase, so the exam stays active: the timer and the answer engine (sending and the expiry flush) keep running, and questions are no longer requested.
    - With no questions delivered, the page "Perlu Memuat Ulang" shows the remaining time and states that chosen answers are still sent.
    - With questions on screen, after a save refusal, an alert with "Muat Ulang" appears above the question and the questions stay.
    - Tests prove that a pending answer of another question is still sent in both cases.
  - **Finding 3:** `multiple-response.test.tsx` adds:
    - local recovery of an unsent set after a reload, with the canonical payload sent;
    - "no correct set" in any stored record;
    - adoption by another session (same value, version and identity) and discard of a newer foreign answer;
    - the save-path refusal;
    - the teacher-preview multiple-response view (instruction, local try-out, both keys, score).
  - **Notes applied:**
    - V06 now holds the save at the network until the submission has started;
    - the `template` field indentation is fixed;
    - the §11.3 refinement of §4A.6 (absent, not null, for invalid preview content) stands.
- **Known limit (recorded, not blessed):** a local intent with a content key this client does not support (for example one left by a newer client before a rollback) is never cleared by this client, so the reload alert returns on each load until that newer client sends it or the attempt ends.

### 11.5 Targeted re-review PASS; CI #170 and correction 3

- **Targeted re-review, same reviewer, on a75c1d9: PASS.** Findings 1–3 are CLOSED and there is no new material finding. Precision (§11.4): `loadQuestions` sets the flag, and the guard sits at its only call site in `applyRunInfo`.
- **CI #170/run 42386394275:** exact SHA a75c1d9, attempt 1. Runtime, Web and Container SUCCESS, which includes every new integration oracle. The five E2E jobs FAILED at the first after-phase gate, the recorded baseline overflow of the import view at 390 px with 200 % text (470 px, down from 537 px). Preserved; no re-run.
  - The after-phase diagnostics named a single element: the back button "Kembali ke Pelaksanaan Ujian", which uses the shared `whitespace-nowrap` button style and is 462 px wide.
- **Correction 3** (rows 25 and 30):
  - the back button and the "Unduh Templat CSV" link wrap (`whitespace-normal`, `h-auto`, `max-w-full`) and keep their 44 px minimum;
  - the after-phase layout gates are `expect.soft`, so one run reports every violating scenario; the test still fails on any of them.

### 11.6 CI #171 and correction 4

- **CI #171/run 42387529024:** exact SHA 2594cbd, attempt 1. Runtime, Web and Container SUCCESS. The five E2E jobs FAILED at the first pointer click of the PGK journey, after the import, teacher-preview and v1 exam captures and the PGK empty and keyboard-focus captures. No soft layout violation was reported up to that point, so the import-view overflow is fixed. Preserved; no re-run.
  - Cause: the spec clicked the visually hidden native checkbox, and its option card (label and marker) intercepts pointer events, as it does for the radio cards, which the existing specs click through the card. The run then hit the 90 s test timeout.
- **Correction 4** (row 30 only):
  - pointer input goes to the option card containing the checkbox; checked-state assertions still read the checkbox;
  - the test timeout is 10 minutes for the many rendered variants;
  - stepping to the PGK question waits for the progress heading after a reload and checks each step.

### 11.7 CI #172 and correction 5

- **CI #172/run 42388684029:** exact SHA f791b40, attempt 1. Runtime, Web and Container SUCCESS. The five E2E jobs FAILED at the first PGK step, after every capture up to exam-second. Preserved; no re-run.
  - Cause: an editing script dropped the backslash in the progress-heading pattern (`/^Soal d dari 3$/`), so the heading "Soal 2 dari 3" was never matched.
- **Correction 5** (row 30 only): the pattern is `/^Soal d dari 3$/`.
