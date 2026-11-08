# ASSESS-QUESTION-006 — Short answer

## 1. Control state and authority

| Field | Disposition |
|---|---|
| Classification | Active P11 Task; P1, all eight formats; HIGH risk; R15, R02, R03, R25, R30; P8 V02–V06, V09–V12 |
| Status | **VERIFYING — contract review chain STOP → STOP → PASS (§9); Owner decisions D1–D2; formal READY PASS (§10); implementation candidate published for exact-content CI and the independent implementation and rendered review (§11)** |
| Objective | Deliver short answer ("Isian singkat") end to end on the versioned foundation:<br>• authored through the v2 import;<br>• previewed by the teacher;<br>• answered by the Student as one line of text, kept exactly as typed, with local recovery, then submitted;<br>• scored automatically against the Teacher's accepted forms after the approved normalization, or graded by the Teacher through the essay workflow (manual mode) |
| Owner decisions | O02-1, O02-2, O02-7, O02-9, O02-10 and O02-12, approved 2026-11-07 ([ASSESS-QUESTION-001 §4](ASSESS-QUESTION-001.md)); OD-07 and OD-07b (00.11); **D1–D2 decided by the Owner on 2026-11-08 (§3)**; A01 (A01-3). Reviewer: the standing Owner-designated read-only subagent reviewer, a fresh one for this Task |
| Execution authority | DEC-048 (00.13).<br>• ASSESS-QUESTION-001 is DONE / MERGED.<br>• ASSESS-QUESTION-008 is DONE / MERGED: Delegated Acceptance in [record §12](ASSESS-QUESTION-008.md); landed by PR #33 as main bd39d652236eb055b1b8496dfadec1f0a433cc44, tree equal to evidence head a0cf3fa, with PR-head CI #214 and post-merge main CI #215 attempt 1, eight SUCCESS each (GitHub; recorded in this Task's first change).<br>• O09 rests on the approved P5 content |
| Base and branch | main bd39d65; branch task/assess-question-006-short-answer; worktree `C:\Projects\ELLIGBLE-question-006` |
| Parallel safe / cost | No parallel baseline Task; no dependency, vendor, service or cost |

**Authority:**
- **Governance:** [DEC-044](../../00-governance/00.11_CBT_RELEASE_SCOPE_REALIGNMENT.md), [DEC-045 §5](../../00-governance/00.12_AICWDF_ADOPTION_AND_TASK_EXECUTION.md) and [DEC-048](../../00-governance/00.13_STANDING_EXECUTION_DELEGATION.md).
- **Plan and rules:** [TASK_PLAN ASSESS-QUESTION-006/§4/§8](../TASK_PLAN.md); [P2 row R15](../CBT_DOMAIN_RULES_SPECIFICATION.md), whose open points are settled by O02-7 and D1–D2.
- **Earlier records:** [ASSESS-QUESTION-001 §4/§5/§5A](ASSESS-QUESTION-001.md); [ASSESS-QUESTION-007](ASSESS-QUESTION-007.md) and [ASSESS-QUESTION-008](ASSESS-QUESTION-008.md), whose draft mechanism, grading workflow, grade table and results shape are reused.
- **Locked decisions and schema:** D04.3-61/62 (LOCKED); migrations 0045 and 0061, which stay unchanged.

No LOCKED decision or PB status changes.

## 2. Reuse and bounded gaps

**Reused:**
- the registry and its refusal contract; the v2 import with its 34-column header (no new column);
- save, delivery, resume and readiness;
- ASSESS-QUESTION-008's grading: `essay-grading.ts`, migration 0061's grade revisions (their foreign key is to any answer), the worklist and grade routes, the grading screen, `grading_incomplete`, the D1 results and the D4 CSV columns;
- the ASSESS-QUESTION-007/008 draft mechanism (`answerDrafts`), the shared `Input` exam size, `Label` and `Page`;
- the shared E2E helpers.

**Gaps closed (short answer only):**
- there is no short-answer descriptor, import type or Student control;
- the grading workflow and the "graded by the teacher" counts know only essays.

**Excluded:**
- fuzzy, synonym or AI matching (O02-7);
- multiple graders (FUTURE); corrections after finalization (O02-10);
- report item detail (RESULT-004);
- any change to an earlier type's behaviour.

No migration: the grade revisions of 0061 already reference any answer row.

## 3. Settled inputs, Owner decisions and engineering readings

**Approved before this Task (O02-7, with O02-1, O02-2 and O02-9):**
- The original text is stored exactly as typed, up to 200 characters.
- It is auto-scored against up to 10 accepted forms entered by the Teacher, all-or-nothing (O02-1).
- Matching happens only after trimming leading and trailing whitespace, collapsing inner whitespace, case-insensitive comparison and Unicode NFC. No fuzzy, synonym or AI matching.
- The Teacher can set an item to manual grading, which uses the essay workflow (O02-9: one grader, 0 to maxScore with up to 2 decimals, optional rubric never sent to the Student, ungraded blocks finalization, revisions before finalization).
- An empty value `""` is an accepted write that counts as UNANSWERED (O02-2).

**Owner decisions, 2026-11-08 in chat.** For each, the options offered and the Owner's choice, quoted verbatim:
- **D1, how manual mode is set.** Options: "Kosongkan bentuk jawaban (Recommended)" and "Tulis GURU di correct". The Owner chose **"Kosongkan bentuk jawaban (Recommended)"**:
  > Baris IS dengan bentuk jawaban diterima (left_1 sampai left_10) otomatis dinilai sistem; baris IS tanpa bentuk jawaban berarti dinilai guru lewat layar Penilaian Esai. Pratinjau impor menandai jelas "Dinilai guru".
- **D2, text over 200 characters.** Options: "Draf, belum tersimpan (Recommended)" and "Berhenti di 200". The Owner chose **"Draf, belum tersimpan (Recommended)"**:
  > Sama seperti esai dan isian angka: teks yang melebihi batas tidak dikirim, layar menampilkan "Belum tersimpan" dan petunjuk. Yang tersimpan tetap versi terakhir yang sah.

**Engineering readings:**
- **E1, characters.** "200 characters" is counted in Unicode code points, as for essays (ASSESS-QUESTION-008 E4).
- **E2, one line.** A short answer is one line, so LF and CR are refused. Tab is kept, as for essays. Otherwise the predicate is the essay predicate: well-formed (no lone surrogate), no other C0 control, no DEL, no C1.
- **E3, the normalization** applied to an answer and to each accepted form before comparison, in this order:
  1. Unicode NFC;
  2. trim leading and trailing whitespace;
  3. replace each run of inner whitespace with one U+0020;
  4. lowercase with the locale-independent Unicode default (`toLowerCase()`);
  5. NFC again (lowercasing can produce a decomposed sequence).

  "Whitespace" is the Unicode White_Space set as JavaScript `\s` matches it, so U+2028 and U+2029 pass the one-line predicate and normalize as spaces. Lowercasing is simple, not full case folding: "ß" does not equal "SS", and "İ" does not equal "i". The stored answer is never changed; only the comparison uses the normalized text.
- **E4, authoring.** The type code is `IS` (isian singkat). Accepted forms go in the existing `left_1` to `left_10` columns, filled in order. In manual mode (D1) the existing `rubric` column carries the optional rubric; an auto-scored row must leave it empty. No new column.
- **E5, the essay workflow.** Manual short answers appear on the existing "Penilaian Esai" screen and in the same grade table, routes and refusals. The 008 response fields keep their names: the worklist answer field `essayText` carries the short text, and `scoring.essayCount` counts every question graded by the teacher (essays and manual short answers). Each worklist question gains `questionType`.
- **E6, counts (ASSESS-QUESTION-008 D1).** An auto-scored short answer counts in Benar/Salah; a manual one counts in "Dinilai guru", like an essay.
- **E7, copy on the grading path.** The screen keeps its name "Penilaian Esai" and the card button stays "Nilai Esai" (the screen named in D1). Every sentence on the grading path that names essays becomes neutral, because two types are now graded by the teacher (§4.4).

**Recorded deviation from a proposed (not locked) document:** P2 R15 proposes `{text}`; this contract uses `{shortText}`, matching `numericText` and `essayText`.

## 4. Contract

### 4.1 Content, answer and score (`question-types/short-answer.ts`, new)

- **Key and rule:** key `2:SHORT_ANSWER`, rule `SHORT_ANSWER_ACCEPTED_FORMS_V1`, registered in the production registry as the eighth key.
- **Content:** `{schemaVersion: 2, questionType: 'SHORT_ANSWER', prompt (meaningful), acceptedForms: string[], rubric: string, maxScore > 0 finite}`.
  - `acceptedForms` holds 0 to 10 forms, as typed (each trimmed by the import). Each form is valid short text (E2), is non-empty after normalization, and no two forms are equal after normalization.
  - `acceptedForms: []` is manual mode (D1). An auto-scored item has `rubric: ''`.
- **Student view:** `{schemaVersion: 2, questionType: 'SHORT_ANSWER', prompt}`. No forms, rubric or score.
- **Answer:** `{shortText: string}`, either `""` (empty; `allowsEmpty: true`) or valid text: well-formed, at most 200 code points, no C0 control other than tab, no DEL, no C1 (E1, E2). Anything else is 400 `invalid_answer_payload`. The client applies the identical predicate as `isShortText`.
- **Score:**
  - no answer, `""`, or an invalid stored value gives UNANSWERED and 0;
  - **auto mode:** CORRECT (maxScore) when the normalized answer equals a normalized accepted form (E3), otherwise INCORRECT (0);
  - **manual mode:** UNGRADED (0, pending) without a valid grade, GRADED with one, as for essays.
- **Monitoring:** `NOT (answer_payload ? 'shortText' AND answer_payload->>'shortText' = '')`.

### 4.2 Grading workflow (`essay-grading.ts`, generalized)

- A question is **graded by the teacher** when it is a valid ESSAY, or a valid SHORT_ANSWER with no accepted forms. One content-returning helper, `teacherGradedContentOf(frozen)` (`{content, questionType}` or null), replaces `essayContentOf`; `isTeacherGradedQuestion` replaces `isEssayQuestion`; and a type-aware `teacherGradedTextOf(questionType, payload)` returns the non-empty valid `essayText` or `shortText`, or null. The results, the worklist and the grade write use them.
- **Worklist:** questions graded by the teacher, each with `questionType: 'ESSAY' | 'SHORT_ANSWER'`. Answers are the non-empty valid texts of the first submitted attempts by ELLIGBLE ID; the text is in `essayText` (E5). On the frontend type `questionType?` is optional, absent meaning `'ESSAY'`, so existing fixtures stay unchanged.
- **Grade write:** check 3 becomes "the snapshot belongs to this exam and is graded by the teacher, and the stored answer is non-empty valid text of its type"; otherwise 409 `not_gradable`. An auto-scored short answer is `not_gradable`. Everything else in ASSESS-QUESTION-008 §4.3 is unchanged: transaction, locks, re-authentication, refusal codes and order, exact body, and grader from the actor.
- **Readiness card:** `essayCount` also counts SHORT_ANSWER snapshots whose `acceptedForms` is an empty array.
- **Finalization and results:** unchanged code paths; the descriptor's UNGRADED and GRADED outcomes carry manual short answers through `grading_incomplete`, the frozen `gradeRevision`, D1 and D4.

### 4.3 Import (v2, type `IS`)

- No new header. An `IS` row is valid in a 10-, 32-, 33- or 34-column file. In a 10-column file it has no form columns, so it is manual (D1).
- **Generic order** for every type: number → type → prompt → `rubric_not_allowed` (every type except ES and IS) → the IA, ES or IS branch → `tolerance_not_allowed` (other types) → the existing checks.
- **`IS` rows,** in this order:
  1. options empty, else `{code: 'options_not_allowed', line, type: 'IS'}`;
  2. `right_a` to `right_l` empty, else `{code: 'items_not_allowed', line, type: 'IS'}`;
  3. forms filled in order from `left_1` with no gap, else `{code: 'short_answer_forms_invalid', line}`;
  4. each form valid short text (E1, E2), else `{code: 'short_answer_forms_invalid', line}`;
  5. no two forms equal after normalization, else `{code: 'items_duplicate', line, type: 'IS'}`;
  6. tolerance empty, else `tolerance_not_allowed`;
  7. `correct` empty, else `{code: 'correct_not_allowed', line, type: 'IS'}`;
  8. rubric empty when there is at least one form, else `{code: 'rubric_not_allowed', line}`;
  9. the score check as in v2.
- **`ParsedQuestion` for IS:** `{type: 'IS', options: [], correctIndex: -1, correctIndexes: [], acceptedForms: string[], essayRubric: string}`.
- The type and problem-code unions gain `'IS'` and `short_answer_forms_invalid`. `correct_not_allowed` has no `type` field today; it carries `type: 'IS'` only for IS rows. The `type` union of the problem shape gains `'IS'` for `options_not_allowed`, `items_not_allowed` and `items_duplicate`. The ES shapes are unchanged.
- **Builder:** `buildShortAnswerFrozenContent({prompt, acceptedForms, rubric, maxScore})`.
- **Import preview item:** `{type: 'IS', options: [], correct: '', correctLetters: [], acceptedForms: string[], rubric?: string}` (`acceptedForms` and `rubric` optional on the frontend type).

**Wording (frozen):**

| Code | Teacher | Operator |
|---|---|---|
| `type_invalid` | "tipe soal harus PG, PGK, BS, MJ, UR, IA, IS atau ES." | `"type" must be PG (single answer), BS (true/false), MJ (matching), UR (ordering), IA (numeric), IS (short answer), ES (essay) or PGK (multiple answers)` |
| `options_not_allowed`, IS | "soal Isian singkat (IS) tidak memakai kolom pilihan; kosongkan option_a sampai option_e." | `options must be empty for IS` |
| `items_not_allowed`, IS | "soal IS tidak memakai kolom right_a sampai right_l; kosongkan kolom itu." | `right item columns are not used for IS` |
| `short_answer_forms_invalid` | "bentuk jawaban IS diisi berurutan mulai left_1, paling banyak 10, masing-masing satu baris, paling banyak 200 karakter dan tanpa karakter yang tidak didukung." | `IS accepted forms must be filled in order from left_1, at most 10, each one line of at most 200 characters without unsupported characters` |
| `items_duplicate`, IS | "bentuk jawaban IS tidak boleh sama satu sama lain (huruf besar, huruf kecil dan spasi tidak dibedakan)." | `IS accepted forms must differ after normalization` |
| `correct_not_allowed`, IS | "soal IS memakai kolom left_1 sampai left_10 untuk bentuk jawaban, jadi kolom correct dikosongkan." | `"correct" must be empty for IS (accepted forms go in left_1..left_10)` |
| `rubric_not_allowed` | "kolom rubric hanya untuk soal ES dan soal IS yang dinilai guru; kosongkan untuk tipe lain." | `"rubric" is only for ES and teacher-graded IS` |

The ES wording of `correct_not_allowed` ("soal ES dinilai guru, jadi kolom correct dikosongkan.") is unchanged.

**Page copy (frozen):**
- **Intro:** "Pilih kelas dan jadwal, unggah soal pilihan ganda (PG), pilihan ganda kompleks (PGK), benar/salah (BS), menjodohkan (MJ), mengurutkan (UR), isian angka (IA), isian singkat (IS) atau esai (ES) dalam templat CSV ELLIGBLE, periksa hasilnya, lalu jadwalkan."
- **Card instruction:** the ASSESS-QUESTION-008 text with:
  - "tipe (PG, PGK, BS, MJ, UR, IA, IS atau ES)";
  - "(kosong untuk BS, MJ, UR, IA, IS dan ES)";
  - "; untuk IS dan ES kosongkan" in place of "; untuk ES kosongkan, karena esai dinilai guru";
  - and appended: "Soal IS memakai kolom left_1 sampai left_10 untuk bentuk jawaban yang diterima; huruf besar, huruf kecil dan spasi berlebih tidak dibedakan. Soal IS tanpa bentuk jawaban dinilai guru seperti esai dan boleh memakai kolom rubric."
- **Template:** one auto IS row with two forms.
- **Preview item:** label "Isian singkat"; auto: "Bentuk jawaban diterima: <forms joined by "; ">"; manual: the muted "Dinilai guru" line and "Rubrik: <rubric>" when present.

### 4.4 Client

- **Supported types:** `SUPPORTED_QUESTION_TYPES` adds `2:SHORT_ANSWER`.
- **Values:** the text itself, `""` empty. `answerValueOf` maps `{shortText}`; `isShortText` applies the §4.1 predicate; the adapter sends only `""` or valid text; `isEmptyValue` and `isAnsweredValue` as for essays.
- **Control (`ShortAnswer`):**
  - the visible `Label` "Jawaban singkat";
  - the instruction "Tulis jawaban singkat dalam satu baris, paling banyak 200 karakter.";
  - the shared `Input` in its exam size, `type="text"`, no `maxLength`, autocomplete, autocorrect and spellcheck off;
  - a counter "n/200 karakter", not a live region; `aria-describedby` points to the instruction, the counter and the hint;
  - the always-mounted polite hint: "Jawaban melebihi 200 karakter, sehingga belum tersimpan." or "Jawaban memuat karakter yang tidak didukung, sehingga belum tersimpan." The over-limit hint wins when both apply. Such text is a draft (D2): never captured, and the save state shows "Belum tersimpan".
  - It keeps its own text state; drafts use the shared `answerDrafts` map; it is hidden during pause and lock.
- **Save state:** `SHORT_ANSWER` joins the key-aware check.
- **Teacher preview response** (`teacher-exam-preview.ts`, frozen): a short-answer item is `{snapshotId, no, prompt, options: [], correctOptionId: null, maxScore, valid: true, questionType: 'SHORT_ANSWER', correctOptionIds: null, acceptedForms: string[], rubric: string}`. `acceptedForms` is `[]` in manual mode, and `rubric` is `''` on an auto item. `acceptedForms` is absent on every other item. The server and frontend `questionType` unions gain `'SHORT_ANSWER'`, and the frontend type gains `acceptedForms?: string[]`.
- **Teacher preview screen:** the label " · Isian singkat"; the Student control as a try-out; on request, an auto item lists "Bentuk jawaban diterima" (each form as authored), and a manual item shows "Dinilai guru" and the rubric under "Rubrik".
- **Neutral grading-path copy (E7).** Each sentence below replaces the earlier text named first:
  - preview, empty rubric: "Tidak ada rubrik. Esai dinilai guru." → "Tidak ada rubrik. Soal ini dinilai guru.";
  - grading screen, loading: "Memuat jawaban esai..." → "Memuat jawaban...";
  - grading screen, load error title: "Gagal Memuat Jawaban Esai" → "Gagal Memuat Jawaban";
  - grading screen, not yet open: "Esai dapat dinilai setelah ujian dibuka." → "Jawaban dapat dinilai setelah ujian dibuka.";
  - grading screen, refused: "Esai hanya dapat dinilai oleh guru yang mengelola ujian ini." → "Jawaban hanya dapat dinilai oleh guru yang mengelola ujian ini.";
  - grading screen, the info note: "Nilai setiap jawaban esai sebelum finalisasi hasil. …" → "Nilai setiap jawaban sebelum finalisasi hasil. …" (the rest unchanged);
  - grading screen, FINALIZED: "Hasil ujian sudah difinalisasi. Nilai esai dibekukan dan tidak dapat diubah." → "Hasil ujian sudah difinalisasi. Nilai dibekukan dan tidak dapat diubah.";
  - grading screen, no answers: "Belum ada jawaban esai yang dikumpulkan untuk soal ini." → "Belum ada jawaban yang dikumpulkan untuk soal ini.";
  - results footnote (`TeacherResultsView`): "Esai dinilai guru; poinnya masuk ke Nilai." → "Poin soal yang dinilai guru ikut masuk ke Nilai.";
  - finalize refusal (`TeacherReadinessView`): "Masih ada n jawaban yang belum dinilai guru. Nilai semua jawaban di Penilaian Esai sebelum finalisasi hasil."
- **Grading screen:** each question shows its type, "Esai" or "Isian singkat", under its number.
- **Number format:** "200" needs no separator; scores use the decimal comma.

### 4.5 Invariants

- The lock order of existing actions is unchanged; no column or constraint is altered; no migration.
- Earlier types are unchanged, including the all-v1 hand-off; essays behave exactly as in ASSESS-QUESTION-008 apart from the neutral grading-path copy (E7) and the type line on the grading screen.
- No Student response or IndexedDB record carries accepted forms, the rubric or grades.
- Bahasa Indonesia, with no em dash in UI copy. E2E navigation only through the shared helpers.
- The frontend skill checkpoint follows ASSESS-QUESTION-002 §4A.8; only shared primitives.

### 4.6 Existing assertions that change (only these)

- **Registry lists gain `'2:SHORT_ANSWER'`:** `question-contract.test.ts:63` (with its message), `multiple-response.test.ts:23`, `true-false.test.ts:17`, `matching.test.ts:25`, `ordering.test.ts:19`, `numeric-answer.test.ts:19`, and `essay.test.ts:20` (7 → 8).
- **Exact `type_invalid` text:** `true-false.test.ts:72`, `matching.test.ts:147`, `ordering.test.ts:124`, `numeric-answer.test.ts:131`, `essay.test.ts:146`.
- **Exact `rubric_not_allowed` text:** `essay.test.ts:145` (operator) and `frontend/web/src/__tests__/essay.test.tsx:309` (teacher).
- **`answerTypes.test.tsx:59, 76, 77`:** the supported list and the header.
- **`frontend/web/src/__tests__/essay.test.tsx`:** `:237` (the FINALIZED note), `:265` (the results footnote), `:301` (the finalize refusal copy) and `:310` (the teacher `type_invalid` text). `:271` keeps passing unchanged.
- **`e2e/tests/99f-essay.spec.ts`:** `:42` (the `REFUSED` constant), `:302` (the FINALIZED note) and `:315` (the results footnote).

## 5. Expected vectors

Short-answer content: maxScore 2, accepted forms `["Jakarta", "DKI Jakarta"]`.

| # | Case | Expected |
|---|---|---|
| S-1 | `"Jakarta"`, `"  jakarta "`, `"JAKARTA"`, `"dki   jakarta"`, `"Dki\tJakarta"` | CORRECT, 2 |
| S-2 | `"Jakarta."`, `"Jakart"`, `"Bandung"` | INCORRECT, 0 (no fuzzy matching) |
| S-3 | NFC: form `"Café"` (U+00E9) and answer `"cafe\u0301"` | CORRECT |
| S-4 | `""` or no answer | UNANSWERED, 0 |
| S-5 | answer refusals with zero mutation | 400 for each of: 201 code points; LF; CR; U+0001; U+007F; U+0085; a lone surrogate; `{shortText: 5}`; an extra key; `{}` |
| S-6 | manual item (`acceptedForms: []`, rubric "Sebutkan ibu kota") | UNGRADED until graded; listed on the worklist with `questionType: 'SHORT_ANSWER'`; graded `1,5` gives GRADED 1.5; finalize refused with `grading_incomplete` until graded |
| S-7 | an auto item on the grade route | 409 `not_gradable` |
| S-8 | invalid content | 11 forms, an empty or duplicate-after-normalization form, a form with LF, a rubric on an auto item, maxScore ≤ 0 or an empty prompt: readiness `question_content_invalid` |
| S-9 | text fidelity | tab and astral characters (😀) survive save, resume and reload exactly |

- **Mixed exam:** v1 (1, correct), auto short answer (2, `" dki jakarta "`), manual short answer (2, graded 1) and essay (5, graded 3,5) give correct 2, incorrect 0, graded 2 and raw 7.5/10, which is 75.
- **Import vectors:** IS auto and manual in 10-, 32-, 33- and 34-column files; 10 forms accepted and an 11th column is not a form; a gap in the forms; a form over 200 code points; duplicate forms after normalization; a rubric on an auto IS row; `correct` filled; options or right cells filled; every earlier vector unchanged.

## 6. Exact proposed file scopes (frozen at READY)

| # | Path | Purpose |
|---|---|---|
| 1 | docs/production/tasks/ASSESS-QUESTION-006.md | Contract, history, evidence (Task-flow) |
| 2 | docs/production/TASK_PLAN.md | Status, counters, ASSESS-QUESTION-008 landing (Task-flow) |
| 3 | docs/production/PRODUCTION_COMPLETION_PLAN.md | Status (Task-flow) |
| 4 | docs/DOCUMENT_MANIFEST.md | Index (Task-flow) |
| 5 | docs/production/CBT_ARCHITECTURE_DELTA_REVIEW.md | Appended checkpoint |
| 6 | runtime/secure-assessment/src/question-types/short-answer.ts | Descriptor, predicate, normalization (new) |
| 7 | runtime/secure-assessment/src/question-contract.ts | Register |
| 8 | runtime/secure-assessment/src/question-import.ts | IS type, problems, wording |
| 9 | runtime/secure-assessment/src/exam-provisioning.ts | Builder |
| 10 | runtime/secure-assessment/src/teacher-exam-import.ts | Preview item |
| 11 | runtime/secure-assessment/src/teacher-exam-preview.ts | Frozen short-answer preview item; neutral empty-rubric text lives in row 21 |
| 12 | runtime/secure-assessment/src/exam-monitoring.ts | `shortText: ""` is not answered |
| 13 | runtime/secure-assessment/src/essay-grading.ts | Teacher-graded predicate, worklist type, grade check |
| 14 | runtime/secure-assessment/src/teacher-results.ts | The teacher-graded count |
| 15 | runtime/secure-assessment/src/teacher-readiness.ts | `essayCount` with manual short answers |
| 16 | frontend/web/src/types/assessment.ts | Key, helpers, preview and worklist types |
| 17 | frontend/web/src/lib/question-import.ts | Template, wording |
| 18 | frontend/web/src/exam/answer-sync-api.ts | Payload by key |
| 19 | frontend/web/src/components/answers/ShortAnswer.tsx | Student control (new) |
| 20 | frontend/web/src/components/StudentExamWorkstation.tsx | Render by type |
| 21 | frontend/web/src/components/TeacherExamPreviewView.tsx | Short-answer preview |
| 22 | frontend/web/src/components/TeacherExamImportView.tsx | Intro, instruction, IS preview |
| 23 | frontend/web/src/components/TeacherEssayGradingView.tsx | Type line per question; neutral copy (E7) |
| 24 | frontend/web/src/components/TeacherReadinessView.tsx | Neutral refusal copy |
| 25 | frontend/web/src/styles/workstation.css | Short-answer styles, tokens only |
| 26 | runtime/secure-assessment/test/short-answer.test.ts | Units |
| 27 | runtime/secure-assessment/test/integration/short-answer.test.ts | Journey: auto, manual, refusals, monitoring, results |
| 28 | frontend/web/src/__tests__/short-answer.test.tsx | Control, drafts, previews, grading type line |
| 29 | e2e/tests/99g-short-answer.spec.ts | Five-browser journey and captures |
| 30 | runtime/secure-assessment/test/question-contract.test.ts | §4.6 only |
| 31 | runtime/secure-assessment/test/multiple-response.test.ts | §4.6 only |
| 32 | runtime/secure-assessment/test/true-false.test.ts | §4.6 only |
| 33 | runtime/secure-assessment/test/matching.test.ts | §4.6 only |
| 34 | runtime/secure-assessment/test/ordering.test.ts | §4.6 only |
| 35 | runtime/secure-assessment/test/numeric-answer.test.ts | §4.6 only |
| 36 | runtime/secure-assessment/test/essay.test.ts | §4.6 only |
| 37 | frontend/web/src/__tests__/answerTypes.test.tsx | §4.6 only |
| 38 | frontend/web/src/__tests__/essay.test.tsx | §4.6 only |
| 39 | e2e/tests/99f-essay.spec.ts | §4.6 only |
| 40 | frontend/web/src/components/TeacherResultsView.tsx | Neutral results footnote (E7) |

**Forbidden:** every other file; completed Task records; migrations; lockfiles, dependencies and workflows; production resources.

## 7. Acceptance gates (DEFINED / NOT EXECUTED)

| Gate | Expected outcome |
|---|---|
| C01 | S-1–S-9 and the mixed vector as units; the predicate and the normalization; the registry holds eight keys; earlier types and the all-v1 hand-off unchanged |
| C02 | Import vectors; earlier parser results unchanged; the template parses |
| C03 | Real PostgreSQL: import of IS auto and manual with PG and ES; previews; delivery without forms or rubric; saves and S-5 refusals with zero mutation; the 409 pair for a client without `2:SHORT_ANSWER`; monitoring; submit; auto scoring of S-1/S-2; the manual item on the worklist, graded, `not_gradable` for the auto item; finalize refused while the manual item is ungraded, then accepted; frozen outcomes; provisional and final results agree with D1 of ASSESS-QUESTION-008 |
| C04 | Regression with only the §4.6 assertions changed |
| C05 | Client: values and the predicate; the counter; over-limit and disallowed text become a draft with "Belum tersimpan"; S-9 recovery; no forms, rubric or grade in any record; the teacher preview for auto and manual; the grading type line; the neutral grading-path copy (E7); the import wording |
| C06 | Five-browser E2E (`99g`, `siswa.e2e.06`, own CSV name `isian-singkat-e2e.csv`, the schedule window as in 99–99f): import with an auto and a manual IS row; preview; the Student types with keyboard, an over-limit draft, offline, reload, pause and V06 submit; the teacher ends; grades the manual answer; finalizes; the final score with "Dinilai guru" |
| C07 | Rendered evidence (`workspace-question-is-*`): baseline exact-main CI #215; the import preview, the teacher preview with forms and with the rubric, the exam screen (empty, keyboard focus, over-limit draft), the grading screen with an "Isian singkat" question, and the results; the frozen widths and 200 % text; no overflow; 44 px targets; visible focus; rendered review PASS. `99`–`99f` differ only in the import intro, the card instruction, times and IDs; `99f` also in the neutral grading-path copy (E7) and the grading type line |
| C08 | Scope inside rows 1–40; 33 Tasks and 78 edges; exact-SHA attempt-1 eight-job CI; no re-run |
| C09 | Reviews PASS; Delegated Acceptance; evidence commit; delegated merge |

**CI-first order:** the same as ASSESS-QUESTION-007 §7. No re-runs, and no push while the previous commit's CI runs.

## 8. History

- 2026-11-08: Owner decisions D1–D2 asked in advance and recorded. Contract prepared under DEC-048 on main bd39d65 after ASSESS-QUESTION-008 landed.
- 2026-11-08: Contract review 1 returned STOP (F1–F4). Corrections applied (§9).
- 2026-11-08: Contract review 2 returned STOP (R1). Correction applied (§9).
- 2026-11-08: Contract review 3 returned PASS. Formal READY and Build start (§10).

## 9. Independent contract review

- **Reviewer:** a fresh-context, read-only subagent under the standing Owner designation. The same reviewer will review the implementation and the rendered evidence.
- **Review 1: STOP.** The reviewer confirmed E1–E6 as executor readings, needing no Owner decision. Each finding and its resolution:
  - **F1:** §4.6 missed the `rubric_not_allowed` texts. Now `essay.test.ts:145` and `essay.test.tsx:309` are listed.
  - **F2:** the frontend worklist `questionType` was neither required nor optional. Now it is optional, absent meaning ESSAY.
  - **F3:** the teacher-preview response for a short answer was not frozen. It is frozen now in §4.4, with the union changes on both sides.
  - **F4:** some grading-path copy named essays only. Every such sentence is now neutral (E7, §4.4): row 40 `TeacherResultsView.tsx` is added, and so are the §4.6 lines `essay.test.tsx:237, 265` and `99f:302, 315`.
  - **Non-material notes, applied:**
    - the type-aware text helper and check 3;
    - the step-8 shape, and `correct_not_allowed` gaining `type` only for IS;
    - the `{shortText}` deviation recorded;
    - U+2028/U+2029 and simple lowercasing (E3);
    - the card instruction names the rubric for manual IS;
    - the `short_answer_forms_invalid` wording names unsupported characters;
    - the §1 landing facts are attributed to GitHub.
- **Review 2: STOP R1.** The E7 list missed two grading-screen sentences. Both are now listed: the load error title and the not-yet-open text. §4.5 and C05 now say "the neutral grading-path copy (E7)".
- **Review 3: PASS,** with no finding, material or not.

## 10. Formal READY and Build start under DEC-048 — 2026-11-08

- **Eligibility (00.13 §4.1):**
  - ASSESS-QUESTION-001 is DONE.
  - ASSESS-QUESTION-008 is DONE and landed: PR #33, main bd39d652236eb055b1b8496dfadec1f0a433cc44, PR-head CI #214, post-merge main CI #215 attempt 1 eight SUCCESS.
  - O02-1, -2, -7, -9, -10 and -12 and A01-3 are approved; D1–D2 were decided by the Owner; O09 rests on P5.
- **Review chain:** STOP → STOP → PASS (§9).
- **Frozen allowlist:** §6 rows 5–40; rows 1–4 are Task-flow paths. No migration, route, dependency, workflow or production resource.
- **Rendered baseline (step 1):** the five `workspace-visual-*` artifacts of exact-main CI #215 (run 42494229352, bd39d65).
  - They were fetched with the resumable, size- and `unzip -t`-checked transfer.
  - 1725 `workspace-question-*` pairs from the `99`–`99f` specs, all with frontend tree 2893f772a315faad5961d6733b8a9e8090205c51.
  - Every screenshot hash matches its JSON; zero overflow; zero targets under 44 px.
  - Manifest, built as in ASSESS-QUESTION-004 §10: SHA-256 40571ad954bb122e831c22ace8e61395df7a08c0c62d1738905fe8f48cf553b6.
- **CI-first order:** as frozen in §7. This registration is step 1. No re-runs.
- **Status:** BLOCKED → IN_PROGRESS. Counters: DONE 13, IN_PROGRESS 1, VERIFYING 0, BLOCKED 19.

## 11. Implementation checkpoint — 2026-11-08

- **Step 1:** registration aafe542 (CI #216, attempt 1, eight SUCCESS) carries the #215 baseline manifest (§10).
- **Implementation candidate,** inside rows 5–40 plus the Task-flow rows 1–4:
  - **Descriptor** `question-types/short-answer.ts`: the one-line predicate (E1, E2), the normalization (E3), auto and manual scoring; registered as the eighth key.
  - **Grading** `essay-grading.ts`: `teacherGradedContentOf`, `isTeacherGradedQuestion` and `teacherGradedTextOf`; the worklist carries `questionType`; the grade write accepts a manual short answer and refuses an auto one.
  - **Results and readiness:** the teacher-graded count includes manual short answers.
  - **Import:** `IS` rows in the frozen order, `short_answer_forms_invalid`, the frozen wording; builder `buildShortAnswerFrozenContent`; preview items with the forms or the rubric; the frozen teacher-preview item.
  - **Monitoring:** `shortText: ""` is not answered.
  - **Client:**
    - `SHORT_ANSWER_KEY` and `isShortText` (the same predicate); the adapter sends only "" or valid text;
    - `ShortAnswer` with the shared Input in its exam size, the counter (not live) and the always-mounted polite hint; drafts through the shared map;
    - the teacher preview for auto and manual items;
    - the grading type line;
    - the neutral grading-path copy (E7);
    - the import intro, instruction and IS preview; the template with an IS row;
    - the `.short-answer` CSS, tokens only.
- **Tests:**
  - `test/short-answer.test.ts` (C01/C02);
  - `test/integration/short-answer.test.ts` (C03);
  - `frontend/web/src/__tests__/short-answer.test.tsx` (C05);
  - `e2e/tests/99g-short-answer.spec.ts` (C06/C07);
  - the §4.6 assertions in rows 30–39.
- **Local:**
  - typechecks PASS (runtime, web, e2e);
  - the new and affected Secure Assessment units 61/61;
  - the new and affected web files 64/64;
  - the client template parses with the server parser without problems.
  - Integration and E2E run in CI only.
- **Status:** IN_PROGRESS → VERIFYING. Counters: DONE 13, VERIFYING 1, BLOCKED 19.

### 11.1 Reviews of the candidate

- **Implementation review by the same reviewer:** PASS on 7855486, with no material finding: scope, correctness, security, client and test coverage against §4–§7. Non-material notes:
  - in `answerValueOf`, the short-answer block sits between the essay comment and the essay block (cosmetic);
  - the IS import-preview item omits `rubric` on auto rows, as §4.3 allows;
  - the readiness count reads manual short answers from the raw JSON, as for essays; invalid content is still blocked by `question_content_invalid`.
- **Rendered review:** PASS on 7855486 (CI #217 artifacts), with no material finding. The reviewer independently checked all 325 `workspace-question-is-*` pairs and classified every one of the 47 distinct changed accessibility lines across the 896 earlier-Task pairs that differ from #215. Each falls under the C07 allowance:
  - the import intro, the card instruction, the generated IDs and the window time text;
  - the window date format: the exam window crossed midnight WIB during the run, and the shared date formatter is not in the diff;
  - in `99f`, the neutral grading-path copy (E7) and the "Esai" type line.
  - One `workspace-question-after-exam-mr-keyboard-focus` variant differs by capture timing in the unchanged `99` spec: the #215 baseline caught a save in flight ("Menyimpan...", submit disabled), and the new capture shows "Tersimpan".
  - Non-material notes, unchanged from the baseline:
    - full-page screenshots draw the sticky staff header and the fixed exam navigation over content;
    - exam navigation labels break mid-word at 200 % text;
    - the results table scrolls inside its container at 200 % text.

## 12. Final evidence and Delegated Acceptance — 2026-11-08

### 12.1 Content and CI

**Final content:** 78554861b20dedcba2497ea74322220db16210db. The registration was aafe542. Every commit has the Owner as author and committer, with no trailers or AI/tool attribution.

**Exact-content CI:** CI #217 (run 42498631882), push, attempt 1, eight jobs SUCCESS.
- **Runtime units:** identity-access 34, tenant-access 14, academic-core 11 and Secure Assessment 976, all passing.
- **Real PostgreSQL 16 integration:** 290/290, including the short-answer journey: auto and manual items, the refusals with zero mutation, the 409 pair, monitoring, the worklist, `not_gradable` for the auto item, the refused and then accepted finalization, the frozen outcomes, and the results.
- **Web:** 46 files and 436 tests, plus typecheck and build.
- **Container:** image build and smoke test.
- **E2E:** 35/35 in each of mobile-360, tablet-768, desktop-1280, firefox-1280 and webkit-390. This includes the short-answer journey (C06) and the rendered captures (C07).

**Rendered evidence:** the five `workspace-visual-*` artifacts of run 42498631882, fetched with the resumable, size- and `unzip -t`-checked transfer.
- 2050 `workspace-question-*` pairs: 002 450, 003 200, 004 225, 005 200, 007 225, 008 425 and 006 325.
- All at commit 7855486 with frontend tree 96c7189bac3d2e20f73e76d5acf2247a706c10f6.
- Every screenshot hash matches its JSON; zero page overflow; zero targets under 44 px.
- Manifest, built as in ASSESS-QUESTION-004 §10: SHA-256 66db13d43544c7df44224351795b4c9e96235bd1c04b8970fa7f512b88939eb0.
- Against the #215 baseline: 829 of the 1725 earlier pairs are identical; the 896 that differ are classified in §11.1.

**All runs, preserved without re-run:**

| Run | Result |
|---|---|
| CI #216 (aafe542, registration) | attempt 1, eight SUCCESS |
| CI #217 (7855486) | attempt 1, eight SUCCESS |

### 12.2 Independent review (Owner-designated read-only fresh-context reviewer)

1. **Contract:** STOP (F1–F4), then STOP (R1), then PASS (§9).
2. **Implementation:** PASS (§11.1).
3. **Rendered:** PASS (§11.1).

No reviewer was replaced.

### 12.3 Acceptance gates

| Gate | Disposition |
|---|---|
| C01 | PASS: S-1–S-9, the one-line predicate, the E3 normalization (NFC decomposed and precomposed, collapsed whitespace, simple lowercase), auto and manual scoring, the teacher-graded helpers, the mixed vector 7.5/10 → 75; the registry holds eight keys; earlier types unchanged |
| C02 | PASS: IS import vectors in 10-, 32- and 34-column files, ten forms, the problem order, shapes and wording; earlier parser results unchanged; the template parses |
| C03 | PASS on real PostgreSQL (CI #217): import, previews, delivery without forms or rubric, saves exactly as typed, refusals with zero mutation, the 409 pair, monitoring, the worklist with `questionType`, `not_gradable` for the auto item, finalization refused then accepted, frozen outcomes, results |
| C04 | PASS: regression with only the §4.6 assertions changed |
| C05 | PASS: values and the predicate, the counter, D2 drafts with "Belum tersimpan", recovery as typed, no forms, rubric or grade in any record, the teacher preview for auto and manual items, the grading type line, the neutral copy, the import wording |
| C06 | PASS: the five-browser journey: import with auto and manual IS rows, preview, keyboard entry, the over-limit draft, offline, reload, read-only pause, V06, end, manual grading on "Penilaian Esai", finalize, and the final score 4/5 = 80 with "Dinilai guru" |
| C07 | PASS: the #215 baseline and the after captures across the frozen conditions; no overflow; 44 px targets; visible focus; rendered review PASS |
| C08 | PASS: every changed path is within rows 1–40; 33 Tasks and 78 edges; exact-SHA attempt-1 CI with no re-run |
| C09 | PASS: review chains PASS; Delegated Acceptance below |

### 12.4 Delegated Acceptance (DEC-048, 00.13 §5.4)

Every gate C01–C09 has PASSED with recorded evidence. The independent contract, implementation and rendered reviews PASSED on the final content SHA. ASSESS-QUESTION-006 is accepted under DEC-048 and is DONE under 00.12 §5. The Owner may reopen it at any time.

**Residual risks and limits:**
- Matching is exact after the approved normalization: no fuzzy, synonym or AI matching (O02-7), and lowercasing is simple, not full case folding (E3).
- An IS row authored without forms is graded by the teacher (D1); the import preview shows "Dinilai guru".
- The grading screen and its card button keep the name "Penilaian Esai"/"Nilai Esai" (E7).
- Composite item detail in reports is RESULT-004.
- PB05 and PB12 are OPEN. G7 comes before real data. There is no deployment or release claim.

**Landing:** a delegated squash merge under 00.13 §6, after PR-head CI (this evidence commit) shows eight SUCCESS on attempt 1, followed by post-merge main CI. The next Task's first change records the landing, with DONE 14/33 (42.42%).
