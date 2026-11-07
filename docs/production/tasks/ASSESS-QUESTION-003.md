# ASSESS-QUESTION-003 — True/False

## 1. Control state and authority

| Field | Disposition |
|---|---|
| Classification | Active P11 Task; P1 all eight formats; HIGH risk; R12, R02, R03, R25, R30; P8 V02–V06, V09–V12 |
| Status | **VERIFYING — implementation candidate published for exact-content CI and the independent implementation and rendered review (§11); DEC-048** |
| Objective | Deliver true/false ("Benar/Salah") end to end on the versioned foundation: author through the v2 import, teacher preview, Student answer with local recovery, submit and exact-match score |
| Owner decisions | O02-1, O02-2, O02-4 and O02-12, approved 2026-11-07 ([ASSESS-QUESTION-001 §4](ASSESS-QUESTION-001.md)); A01. Reviewer: the standing Owner-designated read-only subagent reviewer |
| Execution authority | DEC-048 (00.13). Internal dependency ASSESS-QUESTION-001 is DONE / MERGED. ASSESS-QUESTION-002 is DONE / MERGED (main a129a38672f1da050999b6d677d7c4eac0d78194, post-merge CI #181 attempt 1 eight SUCCESS); its v2 template, client answer values and E2E harness are reused. O09 rests on the approved P5 content |
| Base and branch | main a129a38; branch task/assess-question-003-true-false, worktree `C:\Projects\ELLIGBLE-question-003` |
| Parallel safe / cost | No parallel baseline Task; no dependency, vendor, service or cost |

Authority: [DEC-044](../../00-governance/00.11_CBT_RELEASE_SCOPE_REALIGNMENT.md), [DEC-045 §5](../../00-governance/00.12_AICWDF_ADOPTION_AND_TASK_EXECUTION.md), [DEC-048](../../00-governance/00.13_STANDING_EXECUTION_DELEGATION.md), [TASK_PLAN ASSESS-QUESTION-003/§4/§8](../TASK_PLAN.md), [P2 row R12](../CBT_DOMAIN_RULES_SPECIFICATION.md), [ASSESS-QUESTION-001 §4/§5/§5A](ASSESS-QUESTION-001.md), [ASSESS-QUESTION-002 §4/§4A/§12](ASSESS-QUESTION-002.md), D04.3-61/62 (LOCKED). No LOCKED decision or PB status changes.

## 2. Reuse and bounded gaps

**Reused unchanged:**
- the registry and refusal contract;
- the v2 template, which grows by appending only (ASSESS-QUESTION-002 §4A.5);
- the client canonical value string and the unsupported-content state;
- the save route, delivery, resume, readiness, finalization and composite rule;
- the option-card radio pattern of the exam screen;
- the `99-question-types` E2E harness pattern.

**Gaps closed (true/false only):**
- there is no descriptor;
- the v2 import has no true/false type;
- preview and client do not render it.

**Excluded:**
- the other types (004–008), the bank, media and convergence (009, 010, ASSESS-MEDIA-001);
- partial or negative credit;
- clearing a true/false answer (§3);
- report detail (RESULT-004);
- any change to v1 or multiple-response behaviour.

## 3. Settled inputs

- **O02-4:** strict boolean `{value}`, no string coercion, exact-match scoring.
- **O02-1:** exact match earns maxScore, otherwise 0; unanswered 0; maxScore >0 and ≤1000 with 2 decimals.
- **P2 R12:** `"true"`, `null` and extraneous fields are rejected, and each value survives recovery.
- **Clearing (O02-2):** O02-2 permits an empty value for new types as `[]` or `""`. A strict boolean has no such value, and P2 R12 rejects `null`. Engineering reading: **a true/false answer can be changed but not cleared**, like v1 single choice (`allowsEmpty: false`). This is recorded for review, not decided as policy.

## 4. Contract

### 4.1 Content, answer and score (`question-types/true-false.ts`, new)

- **Key, rule and registration:** key `2:TRUE_FALSE`, rule `TRUE_FALSE_EXACT_V1`, registered in the production registry.
- **Content:** `{schemaVersion: 2, questionType: 'TRUE_FALSE', prompt (meaningful), correctValue: boolean, maxScore > 0 finite}`. Extra keys are allowed, as in v1.
- **Student view:** `{schemaVersion: 2, questionType: 'TRUE_FALSE', prompt}`, with no key and no score. The two choices are fixed by the client.
- **Answer:** an object whose only key is `value`, and `value` must be a boolean. Anything else is 400 `invalid_answer_payload`. `allowsEmpty: false`.
- **Score:** `value === correctValue` gives CORRECT and maxScore. A different boolean gives INCORRECT and 0. No answer, or a stored non-boolean, gives UNANSWERED and 0.

### 4.2 Import (v2, type `BS`)

- **Type.** `BS` (benar-salah) joins PG and PGK in the existing v2 header. No column is added.
- **Options.** For `BS` the five option cells must be empty. Otherwise the row gets the new problem `options_not_allowed`.
- **Key.** `correct` is one of `B`, `S`, `Benar` or `Salah`, case-insensitive and trimmed. Anything else is `correct_invalid`.
- **Unchanged checks.** `no`, prompt, score, the limits and atomicity are as in v2.
- **Builder.** `buildImportedFrozenContent` builds true/false content for `BS`. The operator CLI follows through the same builder.
- **Teacher and operator wording.**
  - `options_not_allowed`, teacher: "soal Benar/Salah (BS) tidak memakai kolom pilihan; kosongkan option_a sampai option_e."
  - `options_not_allowed`, operator: "options must be empty for BS".
  - The `type_invalid` text names PG, PGK and BS.
  - For a BS row, the teacher's `correct_invalid` text says "kunci jawaban BS harus B (Benar) atau S (Salah)."
- **Template.** "Unduh Templat CSV" adds one BS example row.
- **Import preview.**
  - Type label: "Benar/Salah".
  - `correct`: "Benar" or "Salah".
  - `correctLetters`: `[]`.
  - No option list.

### 4.3 Teacher preview

The server preview item gets:
- `questionType: 'TRUE_FALSE'`;
- `correctValue: boolean | null`, which is absent on other items (invalid content keeps its earlier shape, per ASSESS-QUESTION-002 §11.3);
- `maxScore`;
- `options: []`.

The view shows the statement, two try-out radio cards "Benar" and "Salah" (local only), and the key on request ("Kunci jawaban").

### 4.4 Client

- **Supported types:** `SUPPORTED_QUESTION_TYPES` adds `2:TRUE_FALSE`, so the header declares three keys.
- **Canonical value:** `"true"` or `"false"`.
  - `answerValueOf` maps `{value: boolean}` to that string.
  - The adapter builds `{value: true|false}` only from `"true"` or `"false"`; anything else is refused locally.
  - `isAnsweredValue` is true for either value.
- **Control (`TrueFalseAnswer`):**
  - a `radiogroup` of two option cards, "Benar" and "Salah", with markers B and S;
  - the same radio card, selected state, check badge, 48 px minimum and focus ring as single choice;
  - arrow keys follow the native radio behaviour;
  - nothing is preselected; read-only during pause and lock;
  - no clearing control.
- **Exam screen:** renders by `questionType`; v1 and multiple response are unchanged.

### 4.5 Invariants

- No new route, lock order, migration or authority; the 0048/0060 template CHECK already allows v2.
- v1 and multiple-response content, answers, views, scoring and results are unchanged.
- The Student view and client records never carry `correctValue`.
- Bahasa Indonesia, no em dash in UI copy.

## 4A. Binding review-correction contract — 2026-11-08

This section corrects the contract after the independent contract review (§9). Where §3–§7 differ, §4A governs.

1. **Existing assertions that use `2:TRUE_FALSE` as the unsupported example (F1).** They stop being unsupported once this Task registers the type. Only these assertions change, and each moves to the key `2:UNREGISTERED_EXAMPLE`, which no planned Task registers:
   - `runtime/secure-assessment/test/question-contract.test.ts`, row 23: the registry-keys assertion (line 63) and the unsupported example (lines 52, 58–59);
   - `frontend/web/src/__tests__/answerTypes.test.tsx`, row 25: the supported list and header assertions (lines 59, 76–77) and the never-sent record of lines 155–169.
   - `test/integration/question-types.test.ts` lines 106/118 stay unchanged and still pass. Line 106 still answers 409, because v1 is not declared; line 118 still answers 200.
   - **Lesson for ASSESS-QUESTION-004+:** tests use `2:UNREGISTERED_EXAMPLE`, never a planned type key such as `2:MATCHING`, as an unsupported example. `answerTypes.test.tsx:162` still uses `2:MATCHING` and stays unchanged here.
2. **Import problem data and wording (F2), frozen:**
   - **BS key problem.** A BS row's key problem is `{code: 'correct_invalid', line, type: 'BS'}`. Only BS adds the optional `type`; PG/PGK problem shapes are exactly unchanged.
     - Teacher: "kunci jawaban BS harus B (Benar) atau S (Salah)."
     - Operator: `"correct" must be B (true) or S (false) for BS`.
   - **`type_invalid`.**
     - Operator: `"type" must be PG (single answer), BS (true/false) or PGK (multiple answers)`. This still matches `multiple-response.test.ts:96`.
     - Teacher: "tipe soal harus PG, PGK atau BS."
   - **`options_not_allowed`.**
     - Teacher: "soal Benar/Salah (BS) tidak memakai kolom pilihan; kosongkan option_a sampai option_e."
     - Operator: `options must be empty for BS`.
   - **Import card instruction.** It names BS, its B/S key and its empty option cells: "Satu baris per soal: nomor, tipe (PG, PGK atau BS), teks soal, pilihan A sampai E (kosong untuk BS), kunci jawaban (satu huruf untuk PG; satu sampai lima huruf untuk PGK, misalnya A,C; B atau S untuk BS) dan skor."
3. **Rendered baseline from exact-main artifacts (F3).**
   - **Step 1 retrieves them.** CI-first step 1 retrieves the five `workspace-visual-*` artifacts of main CI #181 (run 42399664689, a129a38) before any application change. It records in §10 the commit, frontend tree, pair count and a SHA-256 manifest of every screenshot. If they are unavailable, a capture-only baseline commit replaces them.
   - **Regression comparison.** The unchanged `99-question-types` spec runs again at every ASSESS-QUESTION-003 SHA. Its JSON keeps `task: ASSESS-QUESTION-002, phase: after`, because phase is detected against tree 95c0845. Those captures are compared with #181 to show that the v1 and PGK exam screen, teacher preview and import preview are unchanged apart from the intended import-instruction copy.
4. **More gates (F4):**
   - **C03 adds** that a client whose header lacks `2:TRUE_FALSE` gets 409 `question_type_unsupported` on delivery and save, with zero mutation.
   - **C06 adds** submit with a held TF save (V06) and a read-only step while the exam is paused.
   - **C07 adds** a long TF statement at 360 px and at 200 % text, reduced motion, and the existing dock's safe areas.
5. **Preview and import shapes (F5), frozen:**
   - **Valid TF teacher-preview item:** `{questionType: 'TRUE_FALSE', correctValue: boolean, correctOptionId: null, correctOptionIds: null, options: [], maxScore, valid: true}`.
     - v1 and MR items never carry `correctValue`.
     - Invalid TF content falls through to the existing invalid shape, with no type fields (`teacher-exam-preview.test.ts:74` unchanged).
     - Client type: `correctValue?: boolean`.
   - **`ParsedQuestion` for BS:** `{type: 'BS', options: [], correctIndex: -1, correctIndexes: [], correctValue: boolean}`.
   - **Import-preview item for BS:** `{type: 'BS', options: [], correct: 'Benar'|'Salah', correctLetters: [], correctValue: boolean}`.
   - **BS check order:** number → type → prompt → `options_not_allowed` → correct → score.
6. **Precisions:**
   - **Clearing.** No Owner decision is needed. O02-2's empty values (`[]`, `""`) have no boolean form, R12 rejects `null`, and with no negative marking (O02-1) clearing changes no score; v1 behaves the same. The Owner may reopen this. TASK_PLAN's "blank" is the never-answered state (T3).
   - **More vectors.** T4 adds `{value:"false"}`, `{value:0}` and `[true]`; T5 adds NaN and Infinity maxScore.
   - **`StudentSafeQuestion.options` stays required** (correction 2, N1): a strict typecheck would otherwise fail in files outside the allowlist. The TF view has no options at runtime, and only the v1 and MR branches read them. The exam screen renders the v1 radio branch only for `MULTIPLE_CHOICE_SINGLE` or a missing type (older servers), and `TrueFalseAnswer` never reads `options`.
   - **Malformed client values.** A malformed TF value is refused locally as `rejected` / `invalid_answer_payload`, as for MR.
   - **E2E 99b:**
     - its own file name `benar-salah-e2e.csv`, with the batch looked up by that name;
     - the WebKit lessons applied from the start: a fresh tab before reloads after many captures, a device-pixel cap, and reduced journey-state variants;
     - JSON stamped with task, commit, frontend tree and the #181 baseline reference;
     - if spec 99 fails, 99b fails with a schedule conflict, which is expected.
   - **Order:** the implementation's exact-SHA CI passes before the review starts.

## 5. Expected vectors (O02 READY condition; P2 R12, O02-4)

Content `{correctValue: true, maxScore: 2}`:

| # | Answer | Expected |
|---|---|---|
| T1 | `{value: true}` | accepted; CORRECT, 2 |
| T2 | `{value: false}` | accepted; INCORRECT, 0 |
| T3 | no answer | UNANSWERED, 0 |
| T4 | `{value: "true"}`, `{value: null}`, `{value: 1}`, `{value: true, extra: 1}`, `{selectedOptionId: "x"}`, `true`, `{}` | 400 |
| T5 | content with `correctValue` not boolean, empty prompt or maxScore ≤ 0 | invalid content: readiness `question_content_invalid`; delivery 500 |

- **Mixed exam:** one v1 question (max 1, correct), one multiple-response question (max 2, exact) and T2 → `COMPOSITE_PER_ITEM_V1`, raw 3/5, 60.
- **Import vectors:**
  - `BS` with `B`, `s`, `Benar` and `salah` → true, false, true, false;
  - `BS` with `Ya` or `T` → `correct_invalid`;
  - `BS` with any option filled → `options_not_allowed`;
  - type `bs` is accepted.

## 6. Exact proposed file scopes (frozen at READY)

| # | Path | Purpose |
|---|---|---|
| 1 | docs/production/tasks/ASSESS-QUESTION-003.md | Contract, history, evidence |
| 2 | docs/production/TASK_PLAN.md | Status, counters, ASSESS-QUESTION-002 landing record |
| 3 | docs/production/PRODUCTION_COMPLETION_PLAN.md | Status and continuity |
| 4 | docs/DOCUMENT_MANIFEST.md | Index |
| 5 | docs/production/CBT_ARCHITECTURE_DELTA_REVIEW.md | Appended checkpoint |
| 6 | runtime/secure-assessment/src/question-types/true-false.ts | Descriptor |
| 7 | runtime/secure-assessment/src/question-contract.ts | Register |
| 8 | runtime/secure-assessment/src/question-import.ts | BS type, `options_not_allowed`, wording |
| 9 | runtime/secure-assessment/src/exam-provisioning.ts | Builder |
| 10 | runtime/secure-assessment/src/teacher-exam-import.ts | Preview type and key |
| 11 | runtime/secure-assessment/src/teacher-exam-preview.ts | Type-aware preview |
| 12 | frontend/web/src/types/assessment.ts | Supported key, value helpers, preview types |
| 13 | frontend/web/src/lib/question-import.ts | Template row and wording |
| 14 | frontend/web/src/exam/answer-sync-api.ts | Payload by key |
| 15 | frontend/web/src/components/answers/TrueFalseAnswer.tsx | Student control |
| 16 | frontend/web/src/components/StudentExamWorkstation.tsx | Render by type |
| 17 | frontend/web/src/components/TeacherExamPreviewView.tsx | True/false preview |
| 18 | frontend/web/src/components/TeacherExamImportView.tsx | Type label and key in the import preview |
| 19 | runtime/secure-assessment/test/true-false.test.ts | Units |
| 20 | runtime/secure-assessment/test/integration/true-false.test.ts | Real PostgreSQL journey |
| 21 | frontend/web/src/__tests__/true-false.test.tsx | Control, sync, preview |
| 22 | e2e/tests/99b-true-false.spec.ts | Five-browser journey and rendered captures (sorts after `99-question-types`) |
| 23 | runtime/secure-assessment/test/question-contract.test.ts | Registry keys and the unsupported example (§4A.1) |
| 24 | runtime/secure-assessment/test/multiple-response.test.ts | Only the registry-keys assertion |
| 25 | frontend/web/src/__tests__/answerTypes.test.tsx | Supported list, header and the never-sent example key (§4A.1) |

Forbidden:
- every other file, including all other existing tests;
- completed Task records;
- migrations;
- lockfiles and dependencies;
- workflows;
- production resources.

## 7. Acceptance gates (DEFINED / NOT EXECUTED)

| Gate | Expected outcome |
|---|---|
| C01 | Vectors T1–T5 and the mixed-exam vector as units; the production registry holds the three keys |
| C02 | Import vectors; v1 and PG/PGK parser results unchanged |
| C03 | Real PostgreSQL: a teacher imports a v2 file with BS and PG; the preview shows the key; readiness passes; delivery without the key; T1/T2 saves and T4 refusals with zero mutation; a client whose header lacks `2:TRUE_FALSE` gets 409 on delivery and save with zero mutation; resume; submit; finalize composite; provisional and final results agree |
| C04 | Regression: every existing test passes, with only the assertions named in §4A.1 changed |
| C05 | Client: canonical values both ways; malformed values refused locally; control with keyboard and pointer; local recovery after a reload; adoption; no key in any record; the true/false teacher preview |
| C06 | Five-browser E2E (`99b`, one participant `siswa.e2e.06`): teacher import and preview; the Student answers with keyboard and pointer, changes the answer offline and only the final value is saved, recovers after a reload, sees no question content while paused, submits with a held pending save (V06); the teacher ends and finalizes and sees the score |
| C07 | Rendered evidence (`workspace-question-tf-*`). **Baseline:** the unchanged question surfaces of the exact-main CI #181 artifacts (`workspace-question-after-*` of ASSESS-QUESTION-002 at a129a38), retrieved and fingerprinted in step 1 (§4A.3), with a capture-only baseline commit as the fallback. **After:** the true/false exam screen (empty, selected, keyboard focus), the teacher preview with the key, and the import preview, at 360, 390, 430, 768, 1024, 1280, 1440 and 640×360 and at 200 % text for the surfaces, with a reduced set for journey states; no overflow, ≥ 44 px targets, visible focus; independent rendered review PASS |
| C08 | Scope inside the frozen allowlist; 33 Tasks and 78 edges; exact-SHA attempt-1 eight-job CI, no re-run |
| C09 | Independent contract, implementation and rendered review PASS; Delegated Acceptance; evidence commit; delegated merge |

**Frozen CI-first order:**
1. Registration (record and trackers, carrying the ASSESS-QUESTION-002 landing), with the #181 baseline artifacts retrieved and their manifest recorded (§4A.3).
2. Implementation.
3. Independent implementation and rendered review by the same reviewer.
4. Delegated Acceptance and the evidence commit.
5. PR-head CI, the delegated squash merge, then post-merge main CI.

No re-runs.

**Frontend skill checkpoint:** as ASSESS-QUESTION-002 §4A.8. The three verified skills are reused. DesainPakeAI is not consulted, and there is no authority claim. The control reuses the radio option card.

## 8. History

- 2026-11-08: contract prepared under DEC-048 on main a129a38 after ASSESS-QUESTION-002 landed; correction 1 (§4A); correction 2 (§4A.6, N1); formal READY (§10).

## 9. Independent contract review

**Original review** by a fresh-context read-only Owner-designated reviewer, on SHA-256 47bf2a6b12242253e9462b1fcb27205ce1d10061a6645153504850a47fe13947: **STOP**, five material findings.

- **F1:** existing tests use `2:TRUE_FALSE` as the unsupported example.
- **F2:** the import problem data and wording could not be implemented without breaking an unchanged test, and the card instruction omitted BS.
- **F3:** the exact-main baseline needed retrieval before the artifacts expire (seven days) and a stated regression comparison.
- **F4:** the gates lacked V06, a pause check, the undeclared-client 409, long content and the render conditions.
- **F5:** the preview and import shapes were underspecified.

The reviewer confirmed the clearing reading (no Owner decision needed), the import design within the append-only v2 rule, the vectors, the control design and the allowlist otherwise, and found no security or privacy defect.

**Correction 1:** §4A.

**First targeted re-review**, same reviewer, on SHA-256 de4deae4119a6dfc83f02a80d2738ef58fe4b45dc08fb91bee4898e8f0a63246: **STOP.**

- F1–F5 are CLOSED.
- New N1: making `StudentSafeQuestion.options` optional would break the strict web typecheck in `MultipleResponseAnswer.tsx` and `workstation.test.tsx`, both outside the allowlist.

**Correction 2:**
- `options` stays required (§4A.6);
- §7 C04, C07 and the CI-first list are aligned with §4A.

**Second targeted re-review**, same reviewer, on SHA-256 d14e2c536124bc1cf2153559e0dd4cb0dfae0a31d01590848230d91efbfc4dd3: **PASS.**

- N1 is CLOSED; there is no new material finding.
- **Independent contract review chain: STOP → STOP → PASS.**

## 10. Formal READY and Build start under DEC-048 — 2026-11-08

- **Eligibility (00.13 §4.1):**
  - ASSESS-QUESTION-001 and ASSESS-QUESTION-002 are DONE / MERGED (main a129a38, post-merge CI #181 attempt 1 eight SUCCESS); no other Task is in flight.
  - O02-1/2/4/12 were approved by the Owner on 2026-11-07; the vectors are frozen in §5 and §4A.6; A01 is implemented.
  - O09 rests on the approved P5 content.
  - No OPEN policy or unapproved architecture input is used, and the Task is not prepare-only.
- **Formal READY: PASS.**
  - Frozen allowlist: rows 5–25 of §6, with rows 23 and 25 widened by §4A.1; rows 1–4 are Task-flow paths.
  - No migration.
  - Expected outcomes are only those in §4, §4A, §5 and §7.
- **Rendered baseline (§4A.3), CI-first step 1:**
  - **Source:** main CI #181 (run 42399664689) artifacts `workspace-visual-*`, all five retrieved.
  - **Content:** 90 pairs per project (450), every one at commit a129a38672f1da050999b6d677d7c4eac0d78194 with frontend tree 543bd3cf9e9c01a8865901da56308649385ee926.
  - **Manifest:** the sorted lines of project, scenario, viewport, text scale and screenshot SHA-256, whose SHA-256 is 9cebdf0956b46c56795d066788f4b128b23ac48a33bc5ceabb56ce60fbab5ffa.
- **Frontend skill checkpoint:** as ASSESS-QUESTION-002 §4A.8: three verified skills, DesainPakeAI not consulted, no authority claim.
- **Frozen CI-first order:** registration (this commit) → implementation → exact-SHA CI → independent implementation and rendered review by the same reviewer → Delegated Acceptance and the evidence commit → PR-head CI, delegated squash merge, post-merge main CI. No re-runs.
- **Status:** BLOCKED → READY → IN_PROGRESS. Counters: DONE 8, IN_PROGRESS 1, BLOCKED 24. 33 IDs and 78 edges unchanged. PB05 and PB12 OPEN.

## 11. Implementation checkpoint — 2026-11-08

- **Step 1:** registration a0009ee carries the #181 baseline manifest (§10).
- **Implementation candidate**, inside rows 5–25 plus the Task-flow rows 1–4:
  - **Descriptor** `question-types/true-false.ts`, registered.
  - **Parser:**
    - BS rows follow the frozen order (number → type → prompt → `options_not_allowed` → correct → score);
    - `correctValue` is on `ParsedQuestion`; BS-only `type` on `correct_invalid`;
    - operator wording as frozen.
  - **Builder:** `buildTrueFalseFrozenContent`, dispatched by `buildImportedFrozenContent`.
  - **Import preview item:** `correct` "Benar"/"Salah", `correctLetters` [], `correctValue`.
  - **Teacher preview item:** `{questionType, correctValue, correctOptionId: null, correctOptionIds: null, options: []}`; invalid content keeps its earlier shape.
  - **Client:**
    - `TRUE_FALSE_KEY` is supported; `answerValueOf` maps a strict boolean; the adapter sends `{value}` only from "true"/"false";
    - `TrueFalseAnswer` uses radio option cards B/S, rendered by type on the exam screen;
    - teacher-preview and import-preview views by type;
    - the template has a BS row; the wording and the import card instruction are as frozen.
  - **`StudentSafeQuestion.options`** stays required (§4A.6).
  - **Document:** the P4 pointer.
- **Tests:**
  - `test/true-false.test.ts` (C01/C02);
  - `test/integration/true-false.test.ts` (C03, including the 409 pair for a client without true/false);
  - `frontend/web/src/__tests__/true-false.test.tsx` (C05);
  - `e2e/tests/99b-true-false.spec.ts` (C06/C07, with the ASSESS-QUESTION-002 WebKit lessons applied);
  - the §4A.1 assertions in rows 23–25.
- **Local:** typechecks PASS (runtime, web, e2e); Secure Assessment units 938/938; the new web file 6/6 and the affected web files PASS. Integration and E2E run in CI only.
- **Status:** IN_PROGRESS → VERIFYING. Counters: DONE 8, VERIFYING 1, BLOCKED 24.

### 11.1 CI #183 and correction 1

- **CI #183:** exact SHA a0136e1, attempt 1. Runtime (including the true/false integration oracle), Web and Container SUCCESS. The five E2E jobs FAILED. Preserved; no re-run.
  - **Four projects:** they reached V06. The step waited for the submission dialog while the save was held, but "Selesaikan Ujian" is disabled while a choice is unsent, so the dialog never opened.
  - **Firefox:** it hung for the 10-minute test budget on the fresh-tab navigation used for the reload step.
- **Correction 1** (row 22 only):
  - V06 asserts that "Selesaikan Ujian" is disabled while the save is held, then releases it, and the submission completes;
  - the reload step uses a plain `reload()`. Only about 40 captures precede it, the point where every browser reloaded safely in ASSESS-QUESTION-002, and the fresh-tab helper is removed.

### 11.2 CI #184, implementation review and rendered review STOP; correction 2

- **CI #184:** exact SHA 55a4a9b, attempt 1. All eight jobs SUCCESS.
- **Artifacts:** 650 pairs at 55a4a9b (450 from the 99 spec, 200 from ASSESS-QUESTION-003 = 40 × 5 projects). Every screenshot hash matches its JSON. Zero overflow; zero targets under 44 px.
- **Implementation review:** PASS, by the same standing reviewer as the contract chain (§9), conditional on CI #184. Non-material notes:
  - the workstation keeps its v1 fallback branch;
  - the #181 baseline manifest is held as the reviewer's scratch evidence, and its SHA-256 is recorded in §10;
  - V06 is read as "submit is disabled while the choice is unsent";
  - safe areas were checked visually;
  - there is no frontend unit test for the BS import display.
- **Regression against #181:** normalized accessibility snapshots compared key by key.
  - Exam screens and teacher previews are identical.
  - One multiple-response focus capture differs only in a transient "Menyimpan..." state.
  - The import preview differs only in the intended card instruction and random fixture student IDs.
- **Rendered review: STOP B1.** The import page intro still described only PG and PGK "dengan pilihan A sampai E". That is wrong for BS and contradicts the card instruction.
- **Correction 2** (row 18 only):
  - the intro now reads: "Pilih kelas dan jadwal, unggah soal pilihan ganda (PG), pilihan ganda kompleks (PGK) atau benar/salah (BS) dalam templat CSV ELLIGBLE, periksa hasilnya, lalu jadwalkan.";
  - the option list in the import preview is rendered only when the item has options. This was the reviewer's non-material note: BS items no longer show an empty list.
  - No test asserts either. Local: web typecheck PASS; `teacherExamImport` and `true-false` web tests 16/16.
- **Not caused by this Task** (also present at #181):
  - the dock breaks words mid-word at 200 % text;
  - the fixed dock covers content in full-page captures;
  - the `::first-line` prompt style.
  These are left for UI-SYSTEM.
