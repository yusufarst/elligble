# ASSESS-QUESTION-005 — Ordering

## 1. Control state and authority

| Field | Disposition |
|---|---|
| Classification | Active P11 Task; P1 all eight formats; HIGH risk; R14, R02, R03, R25, R30; P8 V02–V06, V09–V12 |
| Status | **VERIFYING — implementation candidate published for exact-content CI and the independent implementation and rendered review (§11); DEC-048** |
| Objective | Deliver ordering ("Mengurutkan") end to end on the versioned foundation: author it through the v2 import, preview it as a teacher, answer it as a Student with local recovery, then submit and score it as an exact sequence |
| Owner decisions | O02-1, O02-2, O02-6 and O02-12, approved 2026-11-07 ([ASSESS-QUESTION-001 §4](ASSESS-QUESTION-001.md)); A01. Reviewer: the standing Owner-designated read-only subagent reviewer, a fresh one for this Task |
| Execution authority | DEC-048 (00.13). ASSESS-QUESTION-001 is DONE / MERGED. ASSESS-QUESTION-004 is DONE / MERGED (PR #30, main 01d58bb86a7575cbd83880a883ab324333ef4491, post-merge CI #199). Its extended v2 header, shared `NativeSelect`, client value pattern and E2E harness are reused. O09 rests on the approved P5 content |
| Base and branch | main 01d58bb; branch task/assess-question-005-ordering, worktree `C:\Projects\ELLIGBLE-question-005` |
| Parallel safe / cost | No parallel baseline Task; no dependency, vendor, service or cost |

Authority:
- [DEC-044](../../00-governance/00.11_CBT_RELEASE_SCOPE_REALIGNMENT.md), [DEC-045 §5](../../00-governance/00.12_AICWDF_ADOPTION_AND_TASK_EXECUTION.md), [DEC-048](../../00-governance/00.13_STANDING_EXECUTION_DELEGATION.md);
- [TASK_PLAN ASSESS-QUESTION-005/§4/§8](../TASK_PLAN.md);
- [P2 row R14](../CBT_DOMAIN_RULES_SPECIFICATION.md). Its "unapproved" note on full permutation and exact sequence is settled by O02-6.
- [ASSESS-QUESTION-001 §4/§5/§5A](ASSESS-QUESTION-001.md);
- [ASSESS-QUESTION-002 §4A](ASSESS-QUESTION-002.md), [ASSESS-QUESTION-003 §4A/§13](ASSESS-QUESTION-003.md), [ASSESS-QUESTION-004 §4/§4A/§11–§13](ASSESS-QUESTION-004.md);
- D04.3-61/62 (LOCKED).

No LOCKED decision or PB status changes.

## 2. Reuse and bounded gaps

**Reused unchanged:**
- the registry and its refusal contract;
- the extended v2 header of ASSESS-QUESTION-004. Ordering items use `left_1`…`left_10`; no column is added;
- the client canonical value string, the empty-value rule (`isEmptyValue`) and the unsupported-content state;
- save, delivery, resume, readiness, finalization and the composite rule;
- the exam screen's option-card and status patterns, and the shared `Button` primitive;
- the `99`–`99c` E2E harness, including `openQuestionList()`, `reloadPage()` and `open()`.

**Gaps closed (ordering only):**
- there is no descriptor;
- the import has no `UR` type;
- preview, monitoring and client do not handle ordering.

**Excluded:**
- the other types (006–008), the bank, media and convergence;
- partial credit;
- per-Student shuffling;
- report detail (RESULT-004);
- any change to the behaviour of v1, multiple response, true/false or matching.

## 3. Settled inputs and engineering readings

**Settled:**
- **O02-6:** 2–10 items. The answer must be a full permutation. The exact sequence earns full score, otherwise 0.
- **O02-1:** maxScore is > 0 and ≤ 1000 with 2 decimals; unanswered scores 0.
- **O02-2:** for new types, an empty value is an accepted versioned write that counts as UNANSWERED and is shown as "Belum dijawab".
- **O02-12:** v2 grows by type-specific columns, appended only.

**Engineering readings, recorded for review and not decided as policy:**
- **E1. Display order.** The Student sees the items in authored order, and the key is a separate sequence. This is the same as PG and matching (ASSESS-QUESTION-004 E3, confirmed by review). There is no shuffle.
- **E2. An untouched arrangement is not an answer.** The authored order starts as the arrangement. It becomes the answer only when the Student acts, either by moving an item or by choosing "Gunakan urutan ini". Otherwise an exam would count as answered before the Student does anything.
- **E3. Clearing.** "Kosongkan jawaban" saves `[]` (O02-2), and the arrangement returns to authored order.
- **E4. The type code is `UR` (urutan).** Items reuse `left_1`…`left_10`. The key lists item numbers in the correct order, for example `3,1,2`.

## 4. Contract

### 4.1 Content, answer and score (`question-types/ordering.ts`, new)

- **Key and rule:** key `2:ORDERING`, rule `ORDERING_EXACT_SEQUENCE_V1`, registered in the production registry.
- **Content:** `{schemaVersion: 2, questionType: 'ORDERING', prompt (meaningful), items, correctOrder, maxScore > 0 finite}`. Extra keys are allowed.
  - `items` has 2–10 entries of `{id, content}`, in display order; ids are unique and non-blank, and content is meaningful.
  - `correctOrder` is a permutation of the item ids.
- **Student view:** `{schemaVersion: 2, questionType: 'ORDERING', prompt, items}`, in stored order. No key and no score.
- **Answer:** `{orderedItemIds}` is either `[]` (empty, `allowsEmpty: true`) or a permutation of every item id, each exactly once. Anything else is 400 `invalid_answer_payload`, including a partial list, a duplicate, an unknown id or an extra key.
- **Score:**
  - `[]`, no answer, or a stored value that is not a valid answer gives UNANSWERED, 0;
  - the exact sequence gives CORRECT and maxScore;
  - any other permutation gives INCORRECT, 0.
- **Monitoring:** `orderedItemIds: []` is not counted as answered, as for `selectedOptionIds: []`. A full permutation is counted.

### 4.2 Import (extended v2, type `UR`)

**`UR` rows**, checked in this order: number → type → prompt → options → columns → items → right cells → duplicates → key → score.
- `option_a`…`option_e` must be empty; otherwise `options_not_allowed` with `type: 'UR'`.
- A ten-column file gives `columns_missing` with `type: 'UR'`.
- The items are `left_1`…`left_10`, filled in order from `left_1` with no gap, 2–10 of them; otherwise `ordering_items_invalid`.
- `right_a`…`right_l` must be empty; otherwise `items_not_allowed` with `type: 'UR'`.
- Item texts must differ from each other, compared case-insensitively with spaces collapsed; otherwise `items_duplicate` with `type: 'UR'`.
- **`correct`** lists every item number 1…N exactly once, in the correct order, separated by commas and/or spaces (for example `3,1,2`).
  - A wrong count, a number outside 1…N, or another character gives `correct_invalid` with `type: 'UR'`.
  - A repeated number gives `correct_duplicate` with `type: 'UR'`.
- **Score** is checked as in v2.

**PG/PGK/BS rows** keep `items_not_allowed` (no `type`). Its operator wording becomes "left and right item columns are only for MJ and UR".

**MJ rows** are unchanged. `columns_missing` without `type` keeps its MJ wording.

**Builder.** `buildOrderingFrozenContent` gives each item a new option-style id and builds `correctOrder` from the numbers. `buildImportedFrozenContent` dispatches UR to it.

**Wording (frozen).** Teacher in Bahasa Indonesia; operator in English.

| Code | Teacher | Operator |
|---|---|---|
| `type_invalid` | "tipe soal harus PG, PGK, BS, MJ atau UR." | `"type" must be PG (single answer), BS (true/false), MJ (matching), UR (ordering) or PGK (multiple answers)` |
| `options_not_allowed`, UR | "soal Mengurutkan (UR) tidak memakai kolom pilihan; kosongkan option_a sampai option_e." | `options must be empty for UR` |
| `columns_missing`, UR | "soal Mengurutkan (UR) memerlukan kolom left_1 sampai left_10. Unduh templat terbaru lalu salin soal Anda ke dalamnya." | `UR needs the v2 header with left_1..left_10` |
| `ordering_items_invalid` | "soal UR memerlukan 2 sampai 10 item, diisi berurutan mulai left_1." | `UR needs 2 to 10 items, filled in order from left_1` |
| `items_not_allowed`, UR | "soal UR tidak memakai kolom right_a sampai right_l; kosongkan kolom itu." | `right item columns are not used for UR` |
| `items_not_allowed`, PG/PGK/BS | "kolom left_1 sampai right_l hanya untuk soal MJ dan UR; kosongkan untuk soal PG, PGK atau BS." | `left and right item columns are only for MJ and UR` |
| `items_duplicate`, UR | "item soal UR tidak boleh sama satu sama lain." | `items must differ from each other` |
| `correct_invalid`, UR | "kunci jawaban UR adalah nomor item dalam urutan yang benar, setiap nomor tepat sekali, misalnya 3,1,2." | `"correct" for UR must list every item number once, in the correct order (for example 3,1,2)` |
| `correct_duplicate`, UR | "setiap nomor item hanya boleh muncul sekali dalam kunci jawaban UR." | `"correct" for UR uses an item number more than once` |

**Template.** It adds one UR example: four steps in a scrambled authored order, with key `2,4,1,3`.

**Page copy:**
- The intro and the card instruction are frozen word for word in §4A.2.

**Import preview item for UR:** `{type: 'UR', options: [], leftItems: string[] (the items, in authored order), rightItems: [], correctLetters: string[] (the item numbers in the correct order), correct: '3, 1, 2'}`.
- Label: "Mengurutkan".
- The items are numbered 1…N.
- A "Kunci jawaban" list shows the items in correct order, in the success tint.

### 4.3 Teacher preview

A valid UR item is `{questionType: 'ORDERING', items: [{id, content}], correctOrder: [ids], correctOptionId: null, correctOptionIds: null, options: [], maxScore, valid: true}`. Other types never carry these fields, and invalid content falls through.

The view shows a local try-out of the Student control and, on request, a "Kunci jawaban" list of the items in correct order. The label is " · Mengurutkan".

### 4.4 Client

- **Supported types:** `SUPPORTED_QUESTION_TYPES` adds `2:ORDERING`, five keys in all.
- **Canonical value:** the JSON array of item ids in answer order (not sorted). `"[]"` means empty.
  - `answerValueOf` maps `{orderedItemIds}`.
  - `orderOf(value)` returns null unless the value is a JSON array of unique strings.
  - The adapter builds `{orderedItemIds}` only from such a value; anything else is refused locally.
  - `isEmptyValue` includes ordering.
  - `isAnsweredValue(ORDERING, v, itemCount)` is true only for a valid order of exactly `itemCount` ids (§4A.4 item 7).
- **Control (`OrderingAnswer`):**
  - an ordered list of the current arrangement: the value's order when answered, otherwise authored order;
  - each row has its position number, its text, and two shared icon buttons, "Naikkan" and "Turunkan", each at least 44 px. They are named "Naikkan item N" and "Turunkan item N", with `aria-describedby` pointing to the item text (§4A.4 item 9). The first row's up button and the last row's down button are disabled;
  - a move saves the full new order. Focus follows the moved item, as set out in §4A.1, which also states the pointer behaviour;
  - a polite status reads "<teks> dipindah ke urutan N.";
  - when unanswered, a secondary button "Gunakan urutan ini" saves the arrangement as shown (E2);
  - when answered, "Kosongkan jawaban" saves `[]` (E3);
  - in the answered state each row takes the exam option card's selected state, with the check badge (§4A.4 item 9). Row markers show the position numbers;
  - hidden during pause and lock, like every type.
- **Save-state area:** `ORDERING_KEY` is added to the key-aware check, so an empty ordering value reads "Belum dijawab" (§4A.4 item 2).
- **`StudentSafeQuestion`:** gains optional `items`; `options` stays required.

### 4.5 Invariants

- No new route, lock order, migration or authority.
- Other types' content, answers, views, scoring and results are unchanged.
- The Student view and client records never carry `correctOrder`.
- Bahasa Indonesia, with no em dash in UI copy.
- E2E navigation only through the shared helpers.

### 4.6 Existing assertions that change (only these)

- The registry-key lists gain `'2:ORDERING'`: `question-contract.test.ts:63`, `multiple-response.test.ts:23`, `true-false.test.ts:17` and `matching.test.ts:25`.
- The exact `type_invalid` operator text: `true-false.test.ts:72` and `matching.test.ts:147`. The new text still matches `/PG .* or PGK/` (`multiple-response.test.ts:96`, `matching.test.ts:148`).
- `matching.test.ts:159`: the `items_not_allowed` operator text ("…only for MJ and UR").
- `answerTypes.test.tsx:59, 76–77`: the supported list and header gain `2:ORDERING`.

Every other existing test is unchanged. That includes the `header_invalid` regexes: no header changes.

## 4A. Binding review-correction contract — 2026-11-08

This section corrects the contract after the independent contract review (§9). Where §3–§7 differ, §4A governs. The reviewer confirmed that E1–E4 are legitimate executor readings, so no Owner decision is needed.

### 4A.1 Focus, targets and pointer (F1)

1. **A move into an end of the list.** When the moved item reaches the first position, focus goes to its "Turunkan". At the last position, focus goes to its "Naikkan".
   - Otherwise focus stays on the same button of the moved item at its new position.
   - Focus is restored explicitly after render (keyed by item id), because a keyed reorder relocates DOM nodes.
2. **Swapping the two buttons.** When "Gunakan urutan ini" is replaced by "Kosongkan jawaban", or the reverse, focus moves to the replacing button.
3. **Pointer, stated honestly.**
   - The moved row carries a visible "just moved" cue: the option card's existing `:focus-within` outline. It shows while the moved item's button holds focus, which it does after every move.
   - The row is scrolled into view with `block: 'nearest'`.
   - Focus follows the item, but the pointer does not. A second tap at the same spot acts on the neighbouring item now there. The cue and the polite status show what happened.
4. **Gates.** C05 and C06 add:
   - a move into each end, with focus checked;
   - two consecutive moves of the same item through its button at the new position, by keyboard and by pointer;
   - the focus target after "Gunakan urutan ini" and after "Kosongkan jawaban".

### 4A.2 Frozen copy (F2)

- **Import page intro:** "Pilih kelas dan jadwal, unggah soal pilihan ganda (PG), pilihan ganda kompleks (PGK), benar/salah (BS), menjodohkan (MJ) atau mengurutkan (UR) dalam templat CSV ELLIGBLE, periksa hasilnya, lalu jadwalkan."
- **Import card instruction:** "Satu baris per soal: nomor, tipe (PG, PGK, BS, MJ atau UR), teks soal, pilihan A sampai E (kosong untuk BS, MJ dan UR), kunci jawaban (satu huruf untuk PG; satu sampai lima huruf untuk PGK, misalnya A,C; B atau S untuk BS; untuk MJ huruf pasangan kanan setiap pernyataan kiri secara berurutan, misalnya B,C,A; untuk UR nomor item dalam urutan yang benar, misalnya 3,1,2) dan skor, lalu khusus MJ pernyataan kiri (left_1 sampai left_10) dan pasangan kanan (right_a sampai right_l), dan khusus UR item (left_1 sampai left_10). Item UR ditampilkan kepada siswa sesuai urutan penulisan, jadi tulislah dalam urutan acak."
- **Student instruction** (`options-instruction`, the multiple-response pattern): "Urutkan item dengan tombol Naikkan dan Turunkan."
- **Non-blocking notice when the key equals the authored order.**
  - It appears in the import preview item, in the warning tint: "Kunci jawaban sama dengan urutan penulisan, sehingga siswa langsung melihat urutan yang benar. Tulis item dalam urutan acak."
  - The import is not refused, so no acceptance rule is added beyond O02-6.
  - The preview item gains `keyEqualsAuthoredOrder: boolean`.
- **Control status:**
  - after a move: "<teks> dipindah ke urutan N.";
  - after "Gunakan urutan ini": "Urutan ini disimpan sebagai jawaban.";
  - after "Kosongkan jawaban": "Jawaban dikosongkan.".

All new copy is in Bahasa Indonesia, with no em dash.

### 4A.3 Long items and the narrow layout (F3)

- **Fixture.** The `99d` fixture has a long item of at least 100 characters. C07 checks it at 360 px and at 200 % text.
- **Layout.** A row is the option card. The position marker and the text are on one line, and the text wraps with `overflow-wrap: anywhere`.
  - Below 640 px, the two move buttons sit in a right-aligned group under the text.
  - From 640 px, the buttons sit beside the text.
- **Spacing and targets.** Tokens only; buttons are at least 44 px.

### 4A.4 Precisions (N1–N10)

1. **CI #199 (N1).** Main CI #199 must succeed before READY. Its result and artifacts become the C07 baseline, recorded in §10.
2. **Save-state check (N2).** `ORDERING_KEY` is added to the key-aware save-state check, beside multiple response and matching (`StudentExamWorkstation.tsx`, row 17).
3. **`ParsedQuestion` for UR (N3):** `{type: 'UR', options: [], correctIndex: -1, correctIndexes: [], leftItems: string[] (the items), correctSequence: number[] (item indexes in the correct order)}`.
   - Each item number matches `^[1-9][0-9]?$`: no leading zero, 1–10.
   - The type unions gain `'UR'`, and the problem-code unions gain `ordering_items_invalid`, in `question-import.ts` and `types/assessment.ts`.
4. **Problem shapes (N4).**
   - `ordering_items_invalid`: `{code, line}`.
   - With `type: 'UR'` and no `side`: `items_duplicate`, `items_not_allowed` and `columns_missing`.
   - With `type: 'UR'`: `options_not_allowed`, `correct_invalid` and `correct_duplicate`.
   - Untyped and MJ shapes keep their wording.
5. **C07 comparison (N5).** The `99`–`99c` captures may differ from the baseline only in the import intro and card instruction, the schedule times and the random fixture IDs.
6. **Icons (N6).** The chevron-up and chevron-down icons are inline SVGs of the same family as the multiple-response check mark. `icons.tsx` is not changed.
7. **Validation (N7).**
   - `orderOf` also requires the canonical form, `JSON.stringify(parsed) === value`.
   - A value that is not a permutation of the current items is shown as authored order, with no status, and treated as unanswered.
   - `isAnsweredValue(ORDERING, value, itemCount)` is true only for a valid order of exactly `itemCount` ids, so the navigator agrees with the display. The workstation passes `q.items?.length`, as matching passes `leftCount`.
   - The Student view projects each item to exactly `{id, content}`.
8. **Vectors (N8).**
   - O5 adds `{orderedItemIds: 'I3,I1,I2'}` and `null`.
   - O6 adds `correctOrder` absent, partial, or not an array, and a wrong `questionType`.
9. **Accessibility (N9).**
   - The buttons are named "Naikkan item N" and "Turunkan item N", with `aria-describedby` pointing to the item text.
   - In the answered state each row takes the exam option card's selected state, reusing `option-item-label selected` and its colours and radius, plus the `option-check-badge` as the cue that is not colour alone.
   - An `.ordering-row` variant (tokens only) removes the option card's pointer cursor and hover change, because the row itself is not clickable.
   - Unanswered rows are neutral option cards.
10. **E2E (N10).**
    - `99d` uses its own CSV name, `mengurutkan-e2e.csv`.
    - "Touch" means pointer clicks in the existing contexts; no `hasTouch` context is added, and this is recorded.
    - C06 asserts the untouched and answered states in the question list (`openQuestionList()`) and in the submit dialog.

## 5. Expected vectors (O02 READY condition; P2 R14, O02-6)

Content: items I1, I2, I3; `correctOrder` I3, I1, I2; maxScore 2.

| # | Answer | Expected |
|---|---|---|
| O1 | `{orderedItemIds: [I3, I1, I2]}` | accepted; CORRECT, 2 |
| O2 | `[I1, I3, I2]` (swapped) | accepted; INCORRECT, 0; answered |
| O3 | `[]` | accepted; UNANSWERED, 0; not answered |
| O4 | no answer | UNANSWERED, 0 |
| O5 | refusals | 400 with zero mutation, for each of: `[I3, I1]` (partial); `[I3, I3, I1]`; `[I3, I1, I9]`; `[I3, I1, I2, I2]`; a non-string id; `{orderedItemIds: [...], extra: 1}`; `{selectedOptionIds: []}`; `[]`; `{}` |
| O6 | invalid content | readiness `question_content_invalid`; delivery 500. Cases: 1 or 11 items; duplicate or blank ids; empty item content; `correctOrder` missing, duplicated or foreign; maxScore ≤ 0, NaN or Infinity; empty prompt |

**Mixed exam:** v1 (1, correct), multiple response (2, exact), true/false (2, wrong), matching (3, exact) and O1 (2) give 8/10, which is 80.

**Import vectors:**
- UR with 3 items and `3,1,2` gives the order [2, 0, 1]. `3 1 2` and type `ur` are accepted.
- `3,1` or `3,1,4` gives `correct_invalid`; `3,3,1` gives `correct_duplicate`.
- A left gap, or 1 item, gives `ordering_items_invalid`.
- A right cell filled gives `items_not_allowed` with `type` UR.
- Duplicate items give `items_duplicate` with `type` UR.
- An option filled gives `options_not_allowed` with `type` UR.
- A ten-column file gives `columns_missing` with `type` UR.
- The MJ, PG, PGK and BS vectors are unchanged.

## 6. Exact proposed file scopes (frozen at READY)

Rows 1–4 are Task-flow paths.

| # | Path | Purpose |
|---|---|---|
| 1 | docs/production/tasks/ASSESS-QUESTION-005.md | Contract, history, evidence |
| 2 | docs/production/TASK_PLAN.md | Status, counters, ASSESS-QUESTION-004 landing |
| 3 | docs/production/PRODUCTION_COMPLETION_PLAN.md | Status and continuity |
| 4 | docs/DOCUMENT_MANIFEST.md | Index |
| 5 | docs/production/CBT_ARCHITECTURE_DELTA_REVIEW.md | Appended checkpoint |
| 6 | runtime/secure-assessment/src/question-types/ordering.ts | Descriptor |
| 7 | runtime/secure-assessment/src/question-contract.ts | Register |
| 8 | runtime/secure-assessment/src/question-import.ts | UR type, problems, wording |
| 9 | runtime/secure-assessment/src/exam-provisioning.ts | Builder |
| 10 | runtime/secure-assessment/src/teacher-exam-import.ts | Preview items and key |
| 11 | runtime/secure-assessment/src/teacher-exam-preview.ts | Type-aware preview |
| 12 | runtime/secure-assessment/src/exam-monitoring.ts | `orderedItemIds: []` is not answered |
| 13 | frontend/web/src/types/assessment.ts | Key, value helpers, view and preview types |
| 14 | frontend/web/src/lib/question-import.ts | Template, wording |
| 15 | frontend/web/src/exam/answer-sync-api.ts | Payload by key |
| 16 | frontend/web/src/components/answers/OrderingAnswer.tsx | Student control |
| 17 | frontend/web/src/components/StudentExamWorkstation.tsx | Render by type |
| 18 | frontend/web/src/components/TeacherExamPreviewView.tsx | Ordering preview |
| 19 | frontend/web/src/components/TeacherExamImportView.tsx | Intro, instruction, UR import preview |
| 20 | frontend/web/src/styles/workstation.css | `.ordering-*` rules, tokens only |
| 21 | runtime/secure-assessment/test/ordering.test.ts | Units |
| 22 | runtime/secure-assessment/test/integration/ordering.test.ts | Real PostgreSQL journey |
| 23 | frontend/web/src/__tests__/ordering.test.tsx | Control, sync, previews |
| 24 | e2e/tests/99d-ordering.spec.ts | Five-browser journey and rendered captures (sorts after `99c`) |
| 25 | runtime/secure-assessment/test/question-contract.test.ts | §4.6 only |
| 26 | runtime/secure-assessment/test/multiple-response.test.ts | §4.6 only |
| 27 | runtime/secure-assessment/test/true-false.test.ts | §4.6 only |
| 28 | runtime/secure-assessment/test/matching.test.ts | §4.6 only |
| 29 | frontend/web/src/__tests__/answerTypes.test.tsx | §4.6 only |

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
| C01 | O1–O6 and the mixed vector as units; the production registry holds the five keys |
| C02 | Import vectors; every earlier parser result unchanged; the client template parses; `keyEqualsAuthoredOrder` is true for `1,2,3` and false for `3,1,2` |
| C03 | Real PostgreSQL:<br>• teacher imports UR and PG;<br>• key previews; readiness;<br>• delivery without the key;<br>• O1/O2/O3 saves and O5 refusals with zero mutation;<br>• 409 for a client without `2:ORDERING` on delivery and save, with zero mutation;<br>• monitoring counts O1 and O2 and not O3;<br>• resume, submit, composite finalization;<br>• provisional and final results agree |
| C04 | Regression: every existing test passes, with only the §4.6 assertions changed |
| C05 | Client:<br>• canonical values both ways; local refusals;<br>• moves by keyboard and pointer with focus following the moved item;<br>• "Gunakan urutan ini";<br>• "Kosongkan jawaban" giving "Belum dijawab";<br>• local recovery; no key in any record;<br>• the teacher preview;<br>• the import-preview notice when the key equals the authored order |
| C06 | Five-browser E2E (`99d`, `siswa.e2e.06`):<br>• import and preview;<br>• the untouched list is "Belum dijawab";<br>• keyboard and pointer moves;<br>• offline moves, with only the final order saved;<br>• reload recovery;<br>• clear, then "Gunakan urutan ini";<br>• read-only pause;<br>• V06 (submit disabled while a save is held);<br>• end, finalize and score |
| C07 | Rendered evidence (`workspace-question-ur-*`):<br>• **Baseline:** the exact-main CI #199 artifacts, retrieved and fingerprinted in step 1.<br>• **After:** the exam screen (untouched, keyboard focus after a move, answered), the teacher preview with the key and the import preview. Widths 360, 390, 430, 768, 1024, 1280, 1440 and 640×360, plus 200 % text for the surfaces and a reduced set for journey states.<br>• No overflow; targets ≥ 44 px; visible focus; independent rendered review PASS.<br>• One import-preview capture shows the authored-order notice.<br>• The `99`–`99c` captures compared with the baseline: only the import intro, the card instruction, the schedule times and the random fixture IDs may differ (§4A.4 item 5) |
| C08 | Scope inside the frozen allowlist; 33 Tasks and 78 edges; exact-SHA attempt-1 eight-job CI, no re-run |
| C09 | Independent contract, implementation and rendered review PASS; Delegated Acceptance; evidence commit; delegated merge |

**Frozen CI-first order:**
1. Registration, carrying the ASSESS-QUESTION-004 landing and the baseline manifest.
2. Implementation, whose exact-SHA CI passes before review.
3. Implementation and rendered review by the same reviewer.
4. Delegated Acceptance and the evidence commit.
5. PR-head CI, the delegated squash merge, then post-merge main CI.

No re-runs.

**Frontend skill checkpoint:** as ASSESS-QUESTION-002 §4A.8. The shared `Button` (icon size) and the option-card pattern are reused, and no new primitive is introduced. DesainPakeAI is not consulted.

## 8. History

- 2026-11-08: contract prepared under DEC-048 on main 01d58bb after ASSESS-QUESTION-004 landed.
- 2026-11-08: contract review STOP (F1–F3, N1–N11); correction 1 (§4A).

## 9. Independent contract review

- **Reviewer:** a fresh-context, read-only subagent under the standing Owner designation. The same reviewer will review the implementation and the rendered evidence.
- **Review 1: STOP.** E1–E4 are confirmed as executor readings; no Owner decision is needed.
  - **F1:** focus, target and pointer behaviour after a move.
  - **F2:** unfrozen copy and the authored-order risk.
  - **F3:** long items in the rendered evidence.
  - The reviewer verified §4.6, security and the allowlist as sufficient.
  - All findings are addressed in §4A. N11 (reviewer authority follows the ASSESS-QUESTION-001 designation) is noted.

### 9.1 Re-reviews

- **Review 2: STOP R1.**
  - R1: the corrected record was corrupted by a `$`-pattern string replacement that pasted §1–§4.6 into §4A.4. It was rebuilt with literal replacements only.
  - Notes A–D were applied then:
    - the `:focus-within` cue and the `.ordering-row` variant;
    - inline updates to stale text;
    - `keyEqualsAuthoredOrder` in C02, C05 and C07;
    - `isAnsweredValue` with `itemCount`.
- **Review 3: PASS** on record SHA-256 3f15cb7ddc2bf4cd984916c4c9d0036c4a011017ab4bf205da73def76b73e551. No material finding.
  - Non-material notes, applied at READY: the stale §4.4 `isAnsweredValue` line is updated, and this record of reviews is added.
  - The row variant will sit beside `.workstation-container .option-item-label`, with a comment.

## 10. Formal READY and Build start under DEC-048 — 2026-11-08

- **Eligibility (00.13 §4.1):**
  - ASSESS-QUESTION-001 is DONE and landed.
  - ASSESS-QUESTION-004 is DONE and landed: PR #30, main 01d58bb86a7575cbd83880a883ab324333ef4491, tree equal to evidence head 001041d, PR-head CI #198, post-merge main CI #199 attempt 1 eight SUCCESS ([record §12–§13](ASSESS-QUESTION-004.md)).
  - O02-1/-2/-6/-12 are approved, and O09 rests on P5.
- **Review chain:** STOP → STOP → PASS (§9, §9.1).
- **Frozen allowlist:** §6 rows 5–29. Rows 1–4 are Task-flow paths. No migration, route, dependency, workflow or production resource.
- **Rendered baseline (step 1):** the five `workspace-visual-*` artifacts of exact-main CI #199 (run 42447458039, 01d58bb).
  - 875 `workspace-question-*` pairs from the `99`, `99b` and `99c` specs.
  - All at commit 01d58bb with frontend tree 6019c22ba7eba9d7911ac029def08f8a07116bad; every screenshot hash matches its JSON.
  - Zero overflow and zero targets under 44 px.
  - Manifest, built as in ASSESS-QUESTION-004 §10: SHA-256 bdfa14b149e6e3a2ac4ea6f76ea39fc0d8ecdacc0f8b6359350b1874030963e5.
- **CI-first order:** as frozen in §7. This registration is step 1. No re-runs.
- **Status:** BLOCKED → IN_PROGRESS. Counters: DONE 10, IN_PROGRESS 1, VERIFYING 0, BLOCKED 22.

## 11. Implementation checkpoint — 2026-11-08

- **Step 1:** registration d699fd3 (CI #200) carries the #199 baseline manifest (§10).
- **Implementation candidate,** inside rows 5–29 plus the Task-flow rows 1–4:
  - **Descriptor** `question-types/ordering.ts`, registered.
  - **Parser:**
    - `UR` rows in the frozen check order, with the problem shapes of §4A.4 item 4 and the frozen wording;
    - the number syntax `^[1-9][0-9]?$`;
    - `correctSequence`.
  - **Builder:** `buildOrderingFrozenContent`.
  - **Import preview:** items, the key order and `keyEqualsAuthoredOrder`.
  - **Teacher preview item:** the §4.3 shape.
  - **Monitoring:** `orderedItemIds: []` is not answered.
  - **Client:**
    - `ORDERING_KEY` and `orderOf` (canonical);
    - `isEmptyValue`, and `isAnsweredValue` with the item count;
    - the adapter;
    - `OrderingAnswer`: option-card rows; shared icon Buttons named "Naikkan/Turunkan item N" with `aria-describedby`; focus restored after a move and moved to the other button at an end; "Gunakan urutan ini" and "Kosongkan jawaban", each focusing its replacement; the polite status; the answered state as `option-item-label selected` with the check badge;
    - the `.ordering-row` variant beside the option-card focus rule, plus the narrow layout, with tokens only;
    - the exam screen renders by type, with the save-state key list extended;
    - the teacher preview has the try-out control and the key list;
    - the import page has the frozen intro and instruction, the UR preview and the authored-order notice;
    - the template has a UR row, and the teacher wording is as frozen.
  - **Document:** the P4 pointer.
- **Tests:**
  - `test/ordering.test.ts` (C01/C02);
  - `test/integration/ordering.test.ts` (C03, including the authored-order notice);
  - `frontend/web/src/__tests__/ordering.test.tsx` (C05);
  - `e2e/tests/99d-ordering.spec.ts` (C06/C07, with a long item, the notice capture and the shared navigation helpers);
  - the §4.6 assertions in rows 25–29.
- **Local:** typechecks PASS (runtime, web, e2e); the new and affected runtime units 35/35; the new and affected web files 19/19. Integration and E2E run in CI only.
- **Status:** IN_PROGRESS → VERIFYING. Counters: DONE 10, VERIFYING 1, BLOCKED 22.

### 11.1 Implementation review STOP F1 and correction 1

- **CI #201** (run 42452237514, 341d615, attempt 1): eight jobs SUCCESS.
- **Implementation review by the same reviewer: STOP F1.** The new ordering CSS used five fixed pixel gaps (12px, 8px) where §4A.3 and row 20 require tokens, and §11's  wording was therefore inaccurate. Everything else was confirmed to conform: the descriptor, parser, builder, previews, monitoring, client, focus rules, copy, §4.6, tests and security.
- **Correction 1** (row 20 only): the five gaps use  (12px) and  (8px). The computed values are identical, so the rendering does not change. The 640px media query stays a literal, because custom properties cannot be used in media queries. With this correction, §11's  statement holds.
- **Non-material notes:**
  - **N1.** No web unit test covers the notice; integration and E2E cover it.
  - **N2.** The exam option card's right padding reserved for the badge is left for the rendered review.
  - **N3.** The 200 % text captures are at 390 px and 1280 px, as in the ASSESS-QUESTION-004 harness.
  - **N4.** There is no unit vector for an item number of 10.

