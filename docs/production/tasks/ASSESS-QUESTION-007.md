# ASSESS-QUESTION-007 — Numeric answer

## 1. Control state and authority

| Field | Disposition |
|---|---|
| Classification | Active P11 Task; P1 all eight formats; HIGH risk; R16, R02, R03, R25, R30; P8 V02–V06, V09–V12 |
| Status | **VERIFYING — implementation candidate published for exact-content CI and the independent implementation and rendered review (§11); DEC-048** |
| Objective | Deliver numeric answer ("Isian angka") end to end on the versioned foundation: author it through the v2 import, preview it as a teacher, answer it as a Student with local recovery, then submit and score it by exact decimal comparison with an absolute tolerance |
| Owner decisions | O02-1, O02-2, O02-8 and O02-12, approved 2026-11-07 ([ASSESS-QUESTION-001 §4](ASSESS-QUESTION-001.md)); **D1 (invalid input), decided by the Owner on 2026-11-08 (§3)**; A01. Reviewer: the standing Owner-designated read-only subagent reviewer, a fresh one for this Task |
| Execution authority | DEC-048 (00.13). ASSESS-QUESTION-001 is DONE / MERGED. ASSESS-QUESTION-005 is DONE / MERGED: PR #31, main 42a281c52c04f5e54af37893fb7a2c56e521545c, tree equal to evidence head cbba01e, PR-head CI #204, post-merge main CI #205 attempt 1 eight SUCCESS ([record §12](ASSESS-QUESTION-005.md)). Its extended v2 header, client value pattern and E2E harness are reused. O09 rests on the approved P5 content |
| Base and branch | main 42a281c; branch task/assess-question-007-numeric-answer, worktree `C:\Projects\ELLIGBLE-question-007` |
| Parallel safe / cost | No parallel baseline Task; no dependency, vendor, service or cost |

Authority:
- [DEC-044](../../00-governance/00.11_CBT_RELEASE_SCOPE_REALIGNMENT.md), [DEC-045 §5](../../00-governance/00.12_AICWDF_ADOPTION_AND_TASK_EXECUTION.md) and [DEC-048](../../00-governance/00.13_STANDING_EXECUTION_DELEGATION.md);
- [TASK_PLAN ASSESS-QUESTION-007/§4/§8](../TASK_PLAN.md);
- [P2 row R16](../CBT_DOMAIN_RULES_SPECIFICATION.md), whose open points are settled by O02-8 and D1;
- [ASSESS-QUESTION-001 §4/§5/§5A](ASSESS-QUESTION-001.md);
- [ASSESS-QUESTION-004 §4A/§11–§13](ASSESS-QUESTION-004.md) and [ASSESS-QUESTION-005 §4A/§9–§12](ASSESS-QUESTION-005.md);
- D04.3-61/62 (LOCKED).

No LOCKED decision or PB status changes.

## 2. Reuse and bounded gaps

**Reused unchanged:**
- the registry and its refusal contract;
- the extended v2 header, which this Task grows by one appended column (§4.2);
- the client canonical value string and the unsupported-content state;
- save, delivery, resume, readiness, finalization and the composite rule. `useAnswerManager.ts`, `answer-sync-engine.ts`, `scoring.ts` and `question-delivery.ts` are unchanged; the engine coalesces keystroke writes per snapshot;
- the shared `Input`, with one documented variant (§4.4), and the shared `Label`;
- the `99`–`99d` E2E harness and its shared navigation helpers.

**Gaps closed (numeric answer only):**
- there is no descriptor;
- the import has no `IA` type and no tolerance;
- preview, monitoring and client do not handle the type.

**Excluded:**
- relative tolerance, units and exponents;
- short answer (006) and essay (008);
- report detail (RESULT-004);
- any change to the behaviour of an earlier type.

## 3. Settled inputs and engineering readings

- **O02-8:**
  - the input text is stored as typed, up to 30 characters;
  - a comma or a dot is the decimal separator;
  - no thousands separators, exponents or units;
  - comparison is as an exact decimal (no floating point) against an expected value, with an absolute tolerance set by the Teacher, default 0;
  - bounds are inclusive.
- **O02-1:** an exact match earns maxScore, otherwise 0. Unanswered scores 0.
- **O02-2:** an empty value (`""`) is an accepted versioned write. It counts as UNANSWERED and is shown as "Belum dijawab".
- **Owner decision D1 (2026-11-08, in chat).** The question put to the Owner asked how to treat Student input that is not a valid number, for example "1.000,5", "2e3", "5 cm" or "abc". The options were "Tolak dengan petunjuk (Recommended)" and "Simpan, dinilai salah". The Owner chose **"Tolak dengan petunjuk (Recommended)"**, whose option text reads verbatim:

  > Hanya angka sah yang disimpan: tanda minus opsional, digit, satu koma atau titik desimal, maksimal 30 karakter, atau kosong. Isian lain tidak dikirim; di soal tampil petunjuk "Tulis angka saja, pakai koma atau titik untuk desimal." Siswa langsung tahu dan tidak kehilangan nilai diam-diam.

**Engineering readings,** recorded for review. The review confirmed E1, E3 and E4.
- **E1. Number syntax.** A valid number has at most 30 characters and matches `^-?[0-9]+([.,][0-9]+)?$`, with ASCII digits only.
  - Invalid: a leading `+`, a bare separator (`5,` or `,5`), spaces, U+2212, full-width or other-script digits, `NaN` and `Infinity`.
  - Leading zeros are allowed as typed, for example `007`.
  - There is no decimal cap beyond the 30 characters. A precision cap would be an Owner rule (review F1).
- **E3. Tolerance column.** One column, `tolerance`, is appended after `right_l`.
- **E4. The type code is `IA` (isian angka).**
- **E5. Capture and display.** This is D1's storage rule with the display corrections of review F2 and F3, as set out in §4.4.

## 4. Contract

### 4.1 Content, answer and score (`question-types/numeric-answer.ts`, new)

- **Key and rule:** key `2:NUMERIC_ANSWER`, rule `NUMERIC_EXACT_DECIMAL_TOLERANCE_V1`, registered in the production registry.
- **Content:** `{schemaVersion: 2, questionType: 'NUMERIC_ANSWER', prompt (meaningful), expected, tolerance, maxScore > 0 finite}`.
  - `expected` is canonical: it matches `^-?(0|[1-9][0-9]*)(\.[0-9]*[1-9])?$`, is not `-0`, and has at most 30 characters.
  - `tolerance` is canonical and non-negative: it matches `^(0|[1-9][0-9]*)(\.[0-9]*[1-9])?$`, with at most 30 characters.
- **Student view:** `{schemaVersion: 2, questionType: 'NUMERIC_ANSWER', prompt}`. No key, no tolerance and no score.
- **Answer:** an object whose only key is `numericText`, a string.
  - It is either `""` (empty, `allowsEmpty: true`) or valid under E1.
  - Anything else gets 400 `invalid_answer_payload`.
  - The text is stored exactly as sent.
- **Score:** exact decimal arithmetic with BigInt, scaled to the largest number of decimals among the answer, `expected` and `tolerance`.
  - `""`, no answer, or a stored value that is not valid gives UNANSWERED and 0.
  - |answer − expected| ≤ tolerance gives CORRECT and maxScore.
  - Otherwise INCORRECT and 0.
  - `-0` equals `0`.
- **Monitoring:** `NOT (answer_payload ? 'numericText' AND answer_payload->>'numericText' = '')`. No guard is needed, because payloads are validated.

### 4.2 Import (extended v2, type `IA`)

**The header with tolerance** (`QUESTIONS_HEADER_V2_TOLERANCE`, new) is the 32 columns of `QUESTIONS_HEADER_V2_EXTENDED`, which stays at 32, plus `tolerance`: 33 columns.
- The 32-column, ten-column and v1 headers stay valid.
- A row has exactly as many cells as its header. Under the 33-column header, `column_count` has `expected: 33`.
- In both the 32- and 33-column files, the left cells are cells 10–19 and the right cells are cells 20–31; together they are the 22 item cells, 10–31. The tolerance is cell 32 and exists only in the 33-column file.
- The downloadable template switches to the 33-column header.

**`IA` rows**, in this check order: number → type → prompt → options → items → key → tolerance → score.
- **Options:** `option_a`…`option_e` must be empty; otherwise `{code: 'options_not_allowed', line, type: 'IA'}`.
- **Items:** the 22 item cells, when the file has them, must be empty; otherwise `{code: 'items_not_allowed', line, type: 'IA'}`.
- **Key:** `correct` must be valid under E1, which includes the 30-character limit; otherwise `{code: 'correct_invalid', line, type: 'IA'}`. That includes an empty key.
- **Tolerance:** `tolerance` may be empty or absent, which means 0. Otherwise it must match `^[0-9]+([.,][0-9]+)?$` with at most 30 characters; otherwise `{code: 'tolerance_invalid', line}`. A sign, including `-0`, is invalid.
- An IA row is valid in a 10-, 32- or 33-column file.

**Other types** in a 33-column file must leave `tolerance` empty; otherwise `{code: 'tolerance_not_allowed', line}`.
- This is checked immediately after the prompt, before every type-specific check.
- Their shapes and orders are otherwise unchanged.

**`ParsedQuestion` for IA:** `{type: 'IA', options: [], correctIndex: -1, correctIndexes: [], numericKey: string (the key as typed, trimmed), numericTolerance: string (as typed, or '0')}`.

**Builder.** `buildNumericFrozenContent` normalizes the key and the tolerance to the canonical forms:
- `,` becomes `.`;
- leading integer zeros are dropped, keeping one digit;
- trailing fraction zeros are dropped, along with the `.` when nothing is left after it;
- zero has no sign.

For example: `007` → `7`, `-0` → `0`, `2,50` → `2.5`, `-0,0` → `0`.

**Wording (frozen),** teacher in Bahasa Indonesia, operator in English:

| Code | Teacher | Operator |
|---|---|---|
| `type_invalid` | "tipe soal harus PG, PGK, BS, MJ, UR atau IA." | `"type" must be PG (single answer), BS (true/false), MJ (matching), UR (ordering), IA (numeric) or PGK (multiple answers)` |
| `options_not_allowed`, IA | "soal Isian angka (IA) tidak memakai kolom pilihan; kosongkan option_a sampai option_e." | `options must be empty for IA` |
| `items_not_allowed`, IA | "soal IA tidak memakai kolom left_1 sampai right_l; kosongkan kolom itu." | `item columns are not used for IA` |
| `correct_invalid`, IA | "kunci jawaban IA harus angka, dengan koma atau titik untuk desimal, misalnya 3,5." | `"correct" for IA must be a number with a comma or dot decimal (for example 3,5)` |
| `tolerance_invalid` | "toleransi harus kosong atau angka tidak negatif, dengan koma atau titik untuk desimal." | `"tolerance" must be empty or a non-negative number` |
| `tolerance_not_allowed` | "kolom tolerance hanya untuk soal IA; kosongkan untuk tipe lain." | `"tolerance" is only for IA` |

**`header_invalid`:**
- **Teacher:** "judul kolom harus sama dengan templat ELLIGBLE (no;prompt;option_a sampai option_e;correct;score, atau no;type;prompt;option_a sampai option_e;correct;score, atau no;type;prompt;option_a sampai option_e;correct;score;left_1 sampai left_10;right_a sampai right_l, atau no;type;prompt;option_a sampai option_e;correct;score;left_1 sampai left_10;right_a sampai right_l;tolerance). Unduh templat terbaru lalu salin soal Anda ke dalamnya."
- **Operator:** the existing text followed by ` or <the 33 columns joined by ","> (elligble-questions-v2)`.

Every untyped, MJ and UR text is unchanged.

**Page copy (frozen):**
- **Intro:** "Pilih kelas dan jadwal, unggah soal pilihan ganda (PG), pilihan ganda kompleks (PGK), benar/salah (BS), menjodohkan (MJ), mengurutkan (UR) atau isian angka (IA) dalam templat CSV ELLIGBLE, periksa hasilnya, lalu jadwalkan."
- **Card instruction:** "Satu baris per soal: nomor, tipe (PG, PGK, BS, MJ, UR atau IA), teks soal, pilihan A sampai E (kosong untuk BS, MJ, UR dan IA), kunci jawaban (satu huruf untuk PG; satu sampai lima huruf untuk PGK, misalnya A,C; B atau S untuk BS; untuk MJ huruf pasangan kanan setiap pernyataan kiri secara berurutan, misalnya B,C,A; untuk UR nomor item dalam urutan yang benar, misalnya 3,1,2; untuk IA angka jawaban yang benar, misalnya 3,5) dan skor, lalu khusus MJ pernyataan kiri (left_1 sampai left_10) dan pasangan kanan (right_a sampai right_l), dan khusus UR item (left_1 sampai left_10). Item UR ditampilkan kepada siswa sesuai urutan penulisan, jadi tulislah dalam urutan acak. Soal IA memakai kolom tolerance untuk selisih yang masih dianggap benar; kosongkan bila jawaban harus tepat."
- **Template:** one IA row with key `2,5` and tolerance `0,1`. Every other row gets an empty `tolerance` cell.

**Import preview item:** `{type: 'IA', options: [], correct: '<key as typed>', correctLetters: [], tolerance: '<tolerance as typed, or "0">'}`.
- Label: "Isian angka".
- The key uses the existing BS key-line pattern in `TeacherExamImportView.tsx`: the value, then "Kunci jawaban", in the success tint.
- A second line reads "Toleransi <tolerance>" in muted text (`text-muted-foreground`), so the tolerance is not styled as a key.
- The values are shown as typed.

### 4.3 Teacher preview

A valid item is `{questionType: 'NUMERIC_ANSWER', expected, tolerance, correctOptionId: null, correctOptionIds: null, options: [], maxScore, valid: true}`. Other types never carry these fields.

- The view shows a local try-out of the Student control.
- On request it shows the key line (the canonical value, then "Kunci jawaban") and "Toleransi <tolerance>".
- Teacher-side numbers are shown by replacing `.` with `,` in the string, never through `Number`, `toLocaleString` or `formatScore`.
- The label is " · Isian angka".

### 4.4 Client

- **Supported types:** `SUPPORTED_QUESTION_TYPES` adds `2:NUMERIC_ANSWER`, making six keys.
- **Canonical value:** the text itself, as typed; `""` means empty.
  - `answerValueOf` maps `{numericText}` to it.
  - `isNumericText(value)` applies E1.
  - The adapter sends `{numericText}` only for `""` or a valid text, and refuses anything else locally.
  - `isEmptyValue` includes this type for `""`.
  - `countUnreceivedLocalAnswers` treats a local `""` as received when the server holds `""` or nothing.
  - `isAnsweredValue` is true for a valid non-empty text.
- **Shared Input variant (row 20):** `components/ui/input.tsx` gains `inputSize?: 'default' | 'exam'`.
  - `exam` gives `h-12`, which is 48 px; the default classes are unchanged.
  - The prop is not named `size`, because `size` is a native attribute.
  - This is the documented variant, following the `NativeSelect` precedent.
- **Control (`NumericAnswer`):**
  - A visible shared `Label`: "Jawaban angka".
  - The instruction "Tulis jawaban berupa angka." in the `options-instruction` pattern.
  - The shared `Input`, with:
    - `inputSize="exam"` and `type="text"`;
    - no `inputMode`, so the text keyboard appears and a minus can be typed on iOS (review F4);
    - `autoComplete="off"`, `autoCapitalize="off"`, `autoCorrect="off"` and `spellCheck={false}`;
    - no `maxLength`.
  - `aria-describedby="<instruction-id> <hint-id>"`.
  - A `role="status"` polite hint region, always mounted. Its text is empty or the D1 hint "Tulis angka saja, pakai koma atau titik untuk desimal.". It is styled with `--color-danger-text` through a tokens-only class.
  - The field uses the Input's existing `aria-invalid` danger border.
  - The control keeps its own text state, so fast typing never loses characters to engine re-renders.
- **Capture rules (E5, review F2 and F3):**
  - **Valid or empty text** is captured, and therefore saved, on change.
  - **Incomplete prefixes** (`^-$` and `^-?[0-9]+[.,]$`) are not captured. While the field has focus they show no `aria-invalid` and no hint; on blur they are treated as invalid.
  - **Other invalid text** is not captured. The field is `aria-invalid` and the hint shows.
  - **Drafts.** While the field holds text that was not captured (invalid, or incomplete after blur), that text is a draft.
    - It is kept per snapshot id in the exam screen's memory while the screen is open, so returning to the question shows it with the hint.
    - It is never persisted. A reload or takeover shows the stored text.
    - Any external change to the stored value replaces the draft. That covers a discard at a pause or lock boundary, stale reconciliation and adoption.
  - **Save-state area.** While a draft exists for the current question, the area shows the frozen state **"Belum tersimpan"** (class `unanswered`), never "Tersimpan" or "Belum dijawab".
  - **What counts.** The question list, the submit dialog and scoring use the last captured value.
- **Exam screen:** renders by `questionType`. `NUMERIC_ANSWER` is added to the key-aware save-state check, so a captured `""` reads "Belum dijawab".
- **`StudentSafeQuestion`:** unchanged.

### 4.5 Invariants

- No new route, lock order, migration or authority.
- Earlier types are unchanged.
- The Student view and client records never carry `expected` or `tolerance`.
- Bahasa Indonesia, with no em dash in UI copy.
- E2E navigation goes only through the shared helpers.

### 4.6 Existing assertions that change (only these)

- **The registry-key lists gain `'2:NUMERIC_ANSWER'`:**
  - `question-contract.test.ts:63`, including its message;
  - `multiple-response.test.ts:23`;
  - `true-false.test.ts:17`;
  - `matching.test.ts:25`;
  - `ordering.test.ts:19`.
- **The exact `type_invalid` operator text:** `true-false.test.ts:72`, `matching.test.ts:147` and `ordering.test.ts:124`. The new text still matches `/PG .* or PGK/` at `multiple-response.test.ts:96`, `matching.test.ts:148` and `ordering.test.ts:125`.
- **`matching.test.ts:160`:** the `header_invalid` regex now ends in `right_l,tolerance \(elligble-questions-v2\)$`.
- **`answerTypes.test.tsx:59, 76–77`:** the supported list and header.

Every other existing test is unchanged. In particular, two groups depend on `QUESTIONS_HEADER_V2_EXTENDED` staying at 32 columns (review F6a):
- the 32-column vectors and the integration files that import it;
- the header regexes at `multiple-response.test.ts:95` and `question-import.test.ts:83`.

## 5. Expected vectors

Content: expected `2.5`, tolerance `0.1`, maxScore 2.

| # | Answer | Expected |
|---|---|---|
| N1 | `2,5`, `2.5`, `002,5` | CORRECT, 2 |
| N2 | `2,6` and `2,4` (inclusive bounds) | CORRECT, 2 |
| N3 | `2,61` and `2,39` | INCORRECT, 0 |
| N4 | `""`, including after a value (clearing) | accepted; UNANSWERED; not counted as answered; "Belum dijawab" |
| N5 | no answer | UNANSWERED |
| N6 | refusals with zero mutation | 400 for each of:<br>• `1.000,5`, `2e3`, `5 cm`, `abc`;<br>• `+2,5`, `2,`, `,5`, ` 2,5`, `-`, `--5`, `2,5,1`;<br>• `NaN`, `Infinity`, `-Infinity`;<br>• full-width `２,５`, Arabic-Indic digits, U+2212 `−2,5`;<br>• a 31-character text;<br>• a JSON number `2.5`;<br>• `{numericText: "2,5", extra: 1}`;<br>• `{}` |
| N7 | invalid content | readiness `question_content_invalid`; delivery 500. Cases:<br>• `expected` missing, non-canonical (`2,5`, `02.5`, `2.50`, `-0`) or a number type;<br>• tolerance negative, missing or non-canonical;<br>• maxScore ≤ 0, NaN or Infinity;<br>• an empty prompt |

**Tolerance 0:** `2,50` is CORRECT and `2,5000000001` is INCORRECT.

**Precision extremes:** expected `0.0000000000000000000000000001` (28 decimals), tolerance 0.
- The 30-character answer `0,0000000000000000000000000001` is CORRECT.
- An answer that differs only in its last decimal is INCORRECT.
- A 31-character text is refused.

**Large values:** expected `123456789012345678.5`, tolerance 0. `123456789012345678,5` is CORRECT and `123456789012345678,6` is INCORRECT.

**Negative:** expected `-3`, tolerance `0.5`. `-2,5` and `-3,5` are CORRECT; `-2,4` and `-3,51` are INCORRECT.

**Zero:** `-0` against expected `0` is CORRECT.

**Mixed exam:** v1 (1, correct), multiple response (2, exact), true/false (2, wrong), matching (3, exact), ordering (2, exact) and N1 (2) give 10/12, which is 83.33.

**Import vectors:**
- IA in a 10-, 32- and 33-column file;
- `ia` in lower case;
- `correct` empty, `1.000,5` or `2e3` gives `correct_invalid`;
- `tolerance` `abc`, `-1` or `-0` gives `tolerance_invalid`;
- a tolerance on a PG, MJ or UR row gives `tolerance_not_allowed`;
- an option or item cell filled on an IA row gives `options_not_allowed` or `items_not_allowed`;
- normalization: `007` → `7`, `-0` → `0`, `2,50` → `2.5`;
- a 32-cell row under the 33-column header gives `column_count` with `expected: 33`;
- every earlier vector is unchanged.

## 6. Exact proposed file scopes (frozen at READY)

| # | Path | Purpose |
|---|---|---|
| 1 | docs/production/tasks/ASSESS-QUESTION-007.md | Contract, history, evidence (Task-flow) |
| 2 | docs/production/TASK_PLAN.md | Status, counters, ASSESS-QUESTION-005 landing (Task-flow) |
| 3 | docs/production/PRODUCTION_COMPLETION_PLAN.md | Status and continuity (Task-flow) |
| 4 | docs/DOCUMENT_MANIFEST.md | Index (Task-flow) |
| 5 | docs/production/CBT_ARCHITECTURE_DELTA_REVIEW.md | Appended checkpoint |
| 6 | runtime/secure-assessment/src/question-types/numeric-answer.ts | Descriptor |
| 7 | runtime/secure-assessment/src/question-contract.ts | Register |
| 8 | runtime/secure-assessment/src/question-import.ts | Tolerance header; the type union gains `'IA'` and the problem-code union gains `tolerance_invalid` and `tolerance_not_allowed`; problems; wording |
| 9 | runtime/secure-assessment/src/exam-provisioning.ts | Builder |
| 10 | runtime/secure-assessment/src/teacher-exam-import.ts | Preview items and key |
| 11 | runtime/secure-assessment/src/teacher-exam-preview.ts | Type-aware preview |
| 12 | runtime/secure-assessment/src/exam-monitoring.ts | `numericText: ""` is not answered |
| 13 | frontend/web/src/types/assessment.ts | Key, value helpers, preview types; the type and problem-code unions gain `'IA'`, `tolerance_invalid` and `tolerance_not_allowed` |
| 14 | frontend/web/src/lib/question-import.ts | Template, wording |
| 15 | frontend/web/src/exam/answer-sync-api.ts | Payload by key; empty received |
| 16 | frontend/web/src/components/answers/NumericAnswer.tsx | Student control |
| 17 | frontend/web/src/components/StudentExamWorkstation.tsx | Render by type, drafts, save-state |
| 18 | frontend/web/src/components/TeacherExamPreviewView.tsx | Numeric preview |
| 19 | frontend/web/src/components/TeacherExamImportView.tsx | Intro, instruction, IA import preview |
| 20 | frontend/web/src/components/ui/input.tsx | `inputSize="exam"` variant |
| 21 | frontend/web/src/styles/workstation.css | Hint style, tokens only |
| 22 | runtime/secure-assessment/test/numeric-answer.test.ts | Units |
| 23 | runtime/secure-assessment/test/integration/numeric-answer.test.ts | Real PostgreSQL journey |
| 24 | frontend/web/src/__tests__/numeric-answer.test.tsx | Control, drafts, sync, previews |
| 25 | e2e/tests/99e-numeric-answer.spec.ts | Five-browser journey and captures (sorts after `99d`) |
| 26 | runtime/secure-assessment/test/question-contract.test.ts | §4.6 only |
| 27 | runtime/secure-assessment/test/multiple-response.test.ts | §4.6 only |
| 28 | runtime/secure-assessment/test/true-false.test.ts | §4.6 only |
| 29 | runtime/secure-assessment/test/matching.test.ts | §4.6 only |
| 30 | runtime/secure-assessment/test/ordering.test.ts | §4.6 only |
| 31 | frontend/web/src/__tests__/answerTypes.test.tsx | §4.6 only |

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
| C01 | N1–N7, the further vectors and the mixed vector as units; the production registry holds six keys |
| C02 | Import vectors; every earlier parser result unchanged; the client template parses |
| C03 | Real PostgreSQL:<br>• a teacher imports IA, with and without tolerance, and PG;<br>• key previews and readiness;<br>• delivery without the key;<br>• N1/N3/N4 saves and N6 refusals with zero mutation;<br>• a client without `2:NUMERIC_ANSWER` gets 409 on delivery and on save, with zero mutation;<br>• monitoring does not count `""`;<br>• resume, submit and composite finalization;<br>• provisional and final results agree |
| C04 | Regression: every existing test passes, with only the §4.6 assertions changed |
| C05 | Client:<br>• canonical values and local refusals;<br>• typing `2,5` key by key shows no hint;<br>• `5,` then blur shows the hint and "Belum tersimpan";<br>• invalid text is never sent, and the server value is unchanged;<br>• the draft survives leaving and returning to the question;<br>• a reload shows the stored text;<br>• a captured `""` reads "Belum dijawab";<br>• pending `""`, server `""` and `countUnreceivedLocalAnswers`;<br>• recovery as typed;<br>• no key in any record;<br>• the teacher preview |
| C06 | Five-browser E2E (`99e`, `siswa.e2e.06`, its own CSV name `isian-angka-e2e.csv`):<br>• import and preview;<br>• empty reads "Belum dijawab";<br>• comma, dot and a negative value;<br>• invalid text shows the hint and "Belum tersimpan", with no save request and the server value unchanged;<br>• the question-list and submit-dialog states;<br>• offline, with only the final value saved;<br>• reload recovery;<br>• read-only pause;<br>• V06;<br>• end, finalize and score;<br>• navigation only through the shared helpers;<br>• the schedule window per browser project as in `99`–`99d` |
| C07 | Rendered evidence (`workspace-question-ia-*`):<br>• **Baseline:** the exact-main CI #205 artifacts, retrieved and fingerprinted in step 1.<br>• **After:** the import preview, the teacher preview with the key, and the exam screen (empty, valid value, keyboard focus, hint with "Belum tersimpan"). Widths 360, 390, 430, 768, 1024, 1280, 1440 and 640×360, plus 200 % text for the surfaces and a reduced set for journey states.<br>• No overflow; targets ≥ 44 px; visible focus; independent rendered review PASS.<br>• The `99`–`99d` captures may differ from the baseline only in the import intro, the card instruction, the schedule times and the random IDs |
| C08 | Scope inside rows 1–31; 33 Tasks and 78 edges; exact-SHA attempt-1 eight-job CI; no re-run |
| C09 | Independent contract, implementation and rendered review PASS; Delegated Acceptance; evidence commit; delegated merge |

**Frozen CI-first order:**
1. Registration, carrying the ASSESS-QUESTION-005 landing and the #205 manifest.
2. Implementation, whose exact-SHA CI passes before review.
3. Implementation and rendered review by the same reviewer.
4. Delegated Acceptance and the evidence commit.
5. PR-head CI, the delegated squash merge, then post-merge main CI.

No re-runs, and no push while the previous commit's CI runs.

**Honest limits:**
- While the field has focus and holds an incomplete prefix, the save-state area keeps its earlier state until blur.
- Playwright typing bypasses the virtual keyboard, so C06 cannot prove the iOS minus key (F4).
- For more than 30 characters, the frozen D1 hint does not name the length limit, because D1 fixes its text verbatim.

**Frontend skill checkpoint:** as ASSESS-QUESTION-002 §4A.8. The shared `Input` (with its documented exam variant) and `Label` are reused. DesainPakeAI is not consulted.

**E2E note:** the proposed TASK_PLAN path `10-question-types.spec.ts` becomes `99e-numeric-answer.spec.ts`, which sorts last.

## 8. History

- 2026-11-08: Owner decision D1 asked in advance and recorded. The contract was prepared under DEC-048 on main 42a281c after ASSESS-QUESTION-005 landed.
- 2026-11-08: the contract review returned STOP (F1–F9, N1–N10), and the contract was rewritten with all corrections (§9).

## 9. Independent contract review

- **Reviewer:** a fresh-context read-only subagent under the standing Owner designation. The same reviewer will review the implementation and the rendered evidence.
- **Review 1: STOP.** The reviewer confirmed E1, E3 and E4 as executor readings, and E5's storage rule as faithful to D1. The findings and how each is addressed:
  - **F1:** the former E2 (a 10-decimal cap) was an unapproved precision rule. It is dropped, and validity is E1 within 30 characters.
  - **F2:** a misleading save state and an undefined draft lifecycle. Addressed with "Belum tersimpan" and the in-memory draft (§4.4).
  - **F3:** the hint flashed during ordinary typing. Incomplete prefixes now stay silent while the field has focus (§4.4).
  - **F4:** `inputMode="decimal"` has no minus key on iOS. The control now uses the text keyboard.
  - **F5:** there was no 48 px mechanism. Addressed with the `inputSize="exam"` variant (row 20) and the label and hint wiring.
  - **F6:** import precision. Addressed with the separate 33-column constant, the cell indexes, the check orders, the problem shapes, `ParsedQuestion`, the canonical regex and the full strings.
  - **F7:** vectors were added in §5.
  - **F8:** §6 is now an exact allowlist.
  - **F9:** §7 now holds the gates and the CI-first order.
- **Review 2: STOP R1.** The cell indexes contradicted themselves; they are now left cells 10–19, right cells 20–31 and the tolerance in cell 32. RN1–RN7 are applied as well: `expected` is limited to 30 characters, the union growth is named in rows 8 and 13, the tolerance line is muted, the schedule window is stated, and the honest limits are listed under §7.
  - **N1–N10:** applied. The D1 alternatives are recorded; there is no `maxLength`; engine coalescing and the empty-value paths are covered; the comma display; the key-line pattern; the monitoring SQL; the `99e` path.

- **Review 3: PASS** on record SHA-256 c1f3471eac0b81aca7f682bfd860d94f3c85a223c487bf49868a489eff07953e, with no finding, material or not.

## 10. Formal READY and Build start under DEC-048 — 2026-11-08

- **Eligibility (00.13 §4.1):**
  - ASSESS-QUESTION-001 is DONE.
  - ASSESS-QUESTION-005 is DONE and landed: PR #31, main 42a281c52c04f5e54af37893fb7a2c56e521545c, PR-head CI #204, post-merge main CI #205 attempt 1 eight SUCCESS.
  - O02-1, -2, -8 and -12 are approved; D1 was decided by the Owner; O09 rests on P5.
- **Review chain:** STOP → STOP → PASS (§9).
- **Frozen allowlist:** §6 rows 5–31; rows 1–4 are Task-flow paths. No migration, route, dependency, workflow or production resource.
- **Rendered baseline (step 1):** the five `workspace-visual-*` artifacts of exact-main CI #205 (run 42463820269, 42a281c).
  - The network to GitHub was unstable, so the artifacts were fetched with a resumable, size- and `unzip -t`-checked transfer.
  - 1075 `workspace-question-*` pairs from the `99`–`99d` specs, all at commit 42a281c with frontend tree 7bb15d77c23ce63bfd6611320214129b98a046f8.
  - Every screenshot hash matches its JSON; zero overflow; zero targets under 44 px.
  - Manifest, built as in ASSESS-QUESTION-004 §10: SHA-256 3aec13b32832318ad45bf5ed916c581a4003b7b387e6f00eaa4429837b0b93b4.
- **CI-first order:** as frozen in §7. This registration is step 1. No re-runs.
- **Status:** BLOCKED → IN_PROGRESS. Counters: DONE 11, IN_PROGRESS 1, VERIFYING 0, BLOCKED 21.

## 11. Implementation checkpoint — 2026-11-08

- **Step 1:** registration 817c007 (CI #206) carries the #205 baseline manifest (§10).
- **Implementation candidate,** inside rows 5–31 plus the Task-flow rows 1–4:
  - **Descriptor** `question-types/numeric-answer.ts`: E1 syntax, the canonical forms, exact BigInt comparison with an inclusive tolerance, D1 refusals; registered.
  - **Parser:**
    - `QUESTIONS_HEADER_V2_TOLERANCE` (33 columns) beside the unchanged 32-column header;
    - left cells 10–19, right cells 20–31, tolerance cell 32;
    - `IA` rows in the frozen check order;
    - `tolerance_not_allowed` immediately after the prompt for every other type;
    - the problem shapes and frozen wording.
  - **Builder:** `buildNumericFrozenContent` (canonical normalization).
  - **Import preview:** the key as typed and the tolerance.
  - **Teacher preview:** the §4.3 shape.
  - **Monitoring:** `numericText: ""` is not answered.
  - **Client:**
    - `NUMERIC_ANSWER_KEY`, `isNumericText`, `isEmptyValue` and `isAnsweredValue`; the adapter sends only "" or a valid number;
    - `countUnreceivedLocalAnswers` treats an empty value as received when the server holds the same empty value or nothing;
    - the shared `Input` `inputSize="exam"` variant;
    - `NumericAnswer`: visible Label, instruction, text keyboard, the always-mounted polite D1 hint, silent incomplete prefixes until blur, drafts reported to the exam screen;
    - the exam screen keeps in-memory drafts, dropped when the stored value changes, and shows "Belum tersimpan" while a draft exists;
    - the teacher preview: try-out, plus a key with a comma separator taken from the string;
    - the import page: the frozen intro and instruction and the IA preview;
    - the 33-column template with an IA row and the frozen teacher wording;
    - the `.numeric-*` CSS, tokens only.
  - **Document:** the P4 pointer.
- **Tests:**
  - `test/numeric-answer.test.ts` (C01/C02);
  - `test/integration/numeric-answer.test.ts` (C03);
  - `frontend/web/src/__tests__/numeric-answer.test.tsx` (C05);
  - `e2e/tests/99e-numeric-answer.spec.ts` (C06/C07);
  - the §4.6 assertions in rows 26–31.
- **Local:**
  - typechecks PASS (runtime, web, e2e);
  - Secure Assessment units 957/957;
  - the new and affected web files 16/16;
  - the client template parses with the server parser without problems.
  - Integration and E2E run in CI only.
- **Status:** IN_PROGRESS → VERIFYING. Counters: DONE 11, VERIFYING 1, BLOCKED 21.

### 11.1 Reviews of the candidate

- **Implementation review by the same reviewer:** PASS on ffe9f62 (CI #207), with no material finding. Scope: 31 paths, all within rows 1–31. The reviewer ran the descriptor, parser, builder and template against the real code and verified the client, workstation drafts, §4.6 and security. Non-material residuals: (1) a narrow window during engine startup in which a draft can be dropped while invalid text is still shown; (2) a doc comment of buildOrderingFrozenContent now sits above buildNumericFrozenContent; (3) the .numeric-* sizes are literals, like the .ordering-status precedent, while colours and gaps are tokens; (4) the key-line weight differs between the teacher preview and the import preview.
- **Rendered review:** PASS across all five projects on the #207 artifacts: 1300 pairs at ffe9f62, tree f4f6eb58, every hash matching, overflow 0, no target under 44 px, after-manifest SHA-256 a9c2d11a3baf23157e297ccd0cbcc3f8f492355ae85395a492ce499ab040feda. Against #205, 115 of 215 pairs per project are identical; the 100 that differ change only the intro, the card instruction, schedule times and random IDs. The IA surfaces show: empty "Belum dijawab"; focus on the 48 px field; the D1 hint with "Belum tersimpan" and the aria-invalid border; the answered state; the import and teacher key lines with a muted Toleransi; no em dash. Non-material: key-line weight; "Belum tersimpan" in the neutral tone; the question list counts the last captured value; capture-method effects.

## 12. Final evidence and Delegated Acceptance — 2026-11-08

### 12.1 Content and CI

**Final content:** ffe9f6289906c47f733f6ec35c780e4fdd869167. The registration was 817c007. Every commit has the Owner as author and committer, with no trailers or AI/tool attribution.

**Exact-content CI:** CI #207, push, attempt 1, eight jobs SUCCESS.
- **Runtime units:** identity-access 34, tenant-access 14, academic-core 11 and Secure Assessment 957, all passing.
- **Real PostgreSQL 16 integration:** 273/273, including the numeric journey, the 409 pair, monitoring and results.
- **Web:** 44 files and 414 tests, plus typecheck and build.
- **Container:** image build and smoke test.
- **E2E:** 33/33 in each of mobile-360, tablet-768, desktop-1280, firefox-1280 and webkit-390. This includes the numeric journey (C06) and the rendered captures (C07).

**All runs, preserved without re-run:**

| Run | Result |
|---|---|
| #206 | SUCCESS (registration 817c007) |
| #207 | SUCCESS (implementation ffe9f62, final) |

### 12.2 Independent review (Owner-designated read-only fresh-context reviewer)

1. **Contract:** STOP (F1–F9), then STOP (R1), then PASS (§9).
2. **Implementation:** PASS (§11.1).
3. **Rendered:** PASS (§11.1).

No reviewer was replaced.

### 12.3 Acceptance gates

| Gate | Disposition |
|---|---|
| C01 | PASS: N1–N7; tolerance 0; precision extremes; large, negative and zero values; mixed vector 10/12 → 83.33; the registry holds six keys |
| C02 | PASS: IA import vectors in 10-, 32- and 33-column files; tolerance problems; normalization; earlier parser results unchanged; the template parses |
| C03 | PASS on real PostgreSQL:<br>• import of IA with and without tolerance, and PG;<br>• canonical preview;<br>• delivery without the key;<br>• N1/N2/N3/N4 saves and N6 refusals with zero mutation;<br>• the 409 pair;<br>• monitoring {3, 1, 0};<br>• provisional and final results agree |
| C04 | PASS: regression; only the §4.6 assertions changed |
| C05 | PASS:<br>• text kept as typed;<br>• local refusals;<br>• incomplete prefixes stay silent until blur;<br>• the D1 hint, "Belum tersimpan" and the draft surviving navigation;<br>• "" reads "Belum dijawab";<br>• `countUnreceivedLocalAnswers`;<br>• recovery as typed;<br>• no key in any record;<br>• teacher preview |
| C06 | PASS: the five-browser journey:<br>• import and preview;<br>• empty, comma, dot and negative input;<br>• invalid text never sent;<br>• the hint with "Belum tersimpan";<br>• the question list and submit dialog;<br>• offline;<br>• reload;<br>• clear;<br>• read-only pause;<br>• V06;<br>• score 3/4 = 75 |
| C07 | PASS: the #205 baseline and the after captures across the frozen conditions; no overflow; 44 px targets; visible focus; rendered review PASS |
| C08 | PASS: every changed path is within rows 1–31; 33 Tasks and 78 edges; attempt-1 CI with no re-run |
| C09 | PASS: review chains PASS; Delegated Acceptance below |

### 12.4 Delegated Acceptance (DEC-048, 00.13 §5.4)

Every gate C01–C09 has PASSED with recorded evidence. The independent contract, implementation and rendered reviews PASSED on the final content SHA. ASSESS-QUESTION-007 is accepted under DEC-048 and is DONE under 00.12 §5. The Owner may reopen it at any time.

**Residual risks and limits:**
- While the field has focus and holds an incomplete prefix, the save-state area keeps its earlier state until blur.
- Playwright cannot prove the iOS minus key.
- The D1 hint does not name the 30-character limit.
- Composite item detail in reports is RESULT-004.
- PB05 and PB12 are OPEN. G7 comes before real data. There is no deployment or release claim.

**Landing:** a delegated squash merge of PR #32 under 00.13 §6, after PR-head CI (this evidence commit) shows eight SUCCESS on attempt 1, followed by post-merge main CI. The next Task's first change records the landing, with DONE 12/33 (36.36%).
