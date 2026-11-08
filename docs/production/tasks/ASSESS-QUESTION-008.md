# ASSESS-QUESTION-008 — Essay and authorized human grading

## 1. Control state and authority

| Field | Disposition |
|---|---|
| Classification | Active P11 Task; P1, all eight formats; HIGH risk; R17, R02, R03, R25, R30; P8 V02–V06, V09–V12 |
| Status | **VERIFYING — contract review chain STOP → STOP → PASS (§9); Owner decisions D1–D4; formal READY PASS (§10); implementation candidate published for exact-content CI and the independent implementation and rendered review (§11)** |
| Objective | Deliver essay end to end on the versioned foundation:<br>• authored through the v2 import;<br>• previewed by the teacher;<br>• written by the Student as plain text, with local recovery, then submitted;<br>• graded by the managing Teacher, with revision history.<br>Finalization is refused while any answered essay is ungraded. Provisional and final results include the human scores, which are counted separately (D1) |
| Owner decisions | O02-1, O02-2, O02-9, O02-10 and O02-12, approved 2026-11-07 ([ASSESS-QUESTION-001 §4](ASSESS-QUESTION-001.md)); OD-07 and OD-07b (00.11); **D1–D4 decided by the Owner on 2026-11-08 (§3)**; A01 (A01-3). Reviewer: the standing Owner-designated read-only subagent reviewer, a fresh one for this Task |
| Execution authority | DEC-048 (00.13).<br>• ASSESS-QUESTION-001 is DONE / MERGED.<br>• ASSESS-QUESTION-007 is DONE / MERGED: PR #32, main 7e5141c3676733db34c9320592486d49d33d12b2, tree equal to evidence head b883f05, PR-head CI #208, post-merge main CI #209 attempt 1 with eight SUCCESS ([record §12](ASSESS-QUESTION-007.md)).<br>• O09 rests on the approved P5 content |
| Base and branch | main 7e5141c; branch task/assess-question-008-essay; worktree `C:\Projects\ELLIGBLE-question-008` |
| Parallel safe / cost | No parallel baseline Task; no dependency, vendor, service or cost |

**Authority:**
- **Governance:** [DEC-044](../../00-governance/00.11_CBT_RELEASE_SCOPE_REALIGNMENT.md) (OD-07/OD-07b, 00.11 §12), [DEC-045 §5](../../00-governance/00.12_AICWDF_ADOPTION_AND_TASK_EXECUTION.md) and [DEC-048](../../00-governance/00.13_STANDING_EXECUTION_DELEGATION.md).
- **Plan and rules:**
  - [TASK_PLAN ASSESS-QUESTION-008/§4/§8](../TASK_PLAN.md);
  - [P2 row R17](../CBT_DOMAIN_RULES_SPECIFICATION.md);
  - [CBT_PERMISSION_MATRIX](../CBT_PERMISSION_MATRIX.md) lines 26, 40 and 110: attributable human grading; reason, confirmation and audit reserved for high-risk finalize and publish;
  - [ROUTE_INTERACTION_MATRIX W14](../ROUTE_INTERACTION_MATRIX.md).
- **Earlier records:**
  - [ASSESS-QUESTION-001 §4/§5/§5A](ASSESS-QUESTION-001.md), including A01-3;
  - [ASSESS-QUESTION-007](ASSESS-QUESTION-007.md), for the draft pattern.
- **Locked decisions and schema:** D04.3-61/62 (LOCKED); migration 0045's append-only result tables, which stay unchanged.

No LOCKED decision or PB status changes.

## 2. Reuse and bounded gaps

**Reused:**
- the registry and its refusal contract;
- the v2 import with its appended columns;
- save, delivery, resume and readiness;
- the composite rule and the append-only finalization tables (0045);
- the ASSESS-QUESTION-007 draft mechanism. Its `NumericAnswer` props are unchanged, so the numeric tests stay unchanged;
- the shared `Textarea`, `Input`, `Button`, `Label` and `Page` primitives;
- the managed-exam authority (`managed-exam.ts`, used unchanged);
- the shared E2E helpers.

**Gaps closed (essay only):**
- there is no essay descriptor;
- the import has no `ES` type and no rubric;
- there is no grade storage, grading route or grading screen;
- scoring, results, CSV and finalization have no notion of "ungraded".

**Excluded:**
- multiple graders (FUTURE);
- AI or automatic grading;
- file uploads and rich text;
- corrections after finalization (O02-10);
- the short-answer manual mode (006);
- report item detail (RESULT-004);
- any change to an earlier type's behaviour.

## 3. Settled inputs, Owner decisions and engineering readings

**Approved before this Task:**
- **O02-9:**
  - plain text only, up to 5,000 characters, with no markup and no file upload;
  - one grader, the assigned subject or managing Teacher; multiple scorers are FUTURE;
  - a score from 0 to maxScore with up to 2 decimals;
  - an optional plain-text rubric pinned in the snapshot and never sent to the Student;
  - ungraded is not 0 and blocks finalization;
  - grades can be revised before finalization, with revision history.
- **O02-10:** a finalized result is immutable.
- **O02-2:** an empty value (`""`) is accepted and counts as UNANSWERED.
- **A01-3:** a grading table, and finalization that is refused while grades are pending.
  - Refusal is the operative rule, so a successful finalization never has pending grades. `pending_issues` therefore stays `[]` (0045:31–33).
  - The "rubric version" is the immutable question snapshot (0003:45–55) that carries the rubric. No separate version column is needed.

**Owner decisions, 2026-11-08 in chat.** For each, the options offered and the Owner's choice, quoted verbatim:
- **D1, how graded essays appear in results.** Options: "Hitung terpisah (Recommended)" and "Penuh = Benar". The Owner chose **"Hitung terpisah (Recommended)"**:
  > Esai yang dinilai tidak masuk hitungan Benar/Salah. Hasil menampilkan Benar (soal otomatis saja) dan "Dinilai guru: n soal". Poin esai tetap masuk ke Nilai akhir. Esai kosong dihitung tidak dijawab.
- **D2, essay text over 5,000 characters.** Options: "Draf, belum tersimpan (Recommended)" and "Berhenti di 5.000". The Owner chose **"Draf, belum tersimpan (Recommended)"**:
  > Sama seperti isian angka: teks yang melebihi batas tidak dikirim, layar menampilkan "Belum tersimpan" dan petunjuk. Yang tersimpan tetap versi terakhir di bawah 5.000 karakter, termasuk saat waktu habis.
- **D3, rubric length.** Options: "Tanpa batas khusus (Recommended)" and "Maksimal 2.000". The Owner chose **"Tanpa batas khusus (Recommended)"**:
  > Sama seperti teks soal: tidak ada batas tersendiri, hanya dibatasi ukuran berkas impor.
- **D4, the provisional CSV.** Options: "Tambah 2 kolom (Recommended)" and "Kosongkan skor". The Owner chose **"Tambah 2 kolom (Recommended)"**:
  > Menambah kolom "Dinilai guru" dan "Belum dinilai" di akhir. Ke-17 kolom yang ada tidak berubah urutan.

**Engineering readings.** The review confirmed E1–E5.
- **E1, the grader.** The single code authority is the person holding the exam's active teaching assignment (`managed-exam.ts`). That person is the assigned subject or managing Teacher of OD-07 and OD-07b (P5 A11). Institution exams are not implemented.
- **E2, when grading is allowed.** Writes are allowed while the exam is ACTIVE, PAUSED or ENDED. They are refused when it is FINALIZED. The worklist is also readable when FINALIZED, read-only.
- **E3, no reason per grade.** P5 asks for attributable human grading, and keeps reason, confirmation and audit for high-risk finalize and publish (CBT_PERMISSION_MATRIX.md:26, 40, 110). The append-only revision history attributes every grade: score, grader and time.
- **E4, the text predicate (§4.1).** Characters are counted in Unicode code points.
- **E5, the type and column.** The type code is `ES` (esai). The rubric uses one appended column, `rubric`, with no special limit (D3).

**Recorded deviations from proposed (not locked) documents:**
- P2 R17 proposes `{text}`; this contract uses `{essayText}`, matching the `numericText` naming.
- P3 F09 proposes `POST /api/v1/assessment/grades`; this contract uses the teacher-exams namespace (§4.3).

## 4. Contract

### 4.1 Content, answer and score (`question-types/essay.ts`, new)

- **Key and rule:** key `2:ESSAY`, rule `ESSAY_HUMAN_GRADED_V1`, registered in the production registry.
- **Content:** `{schemaVersion: 2, questionType: 'ESSAY', prompt (meaningful), rubric: string (may be empty), maxScore > 0 finite}`.
- **Student view:** `{schemaVersion: 2, questionType: 'ESSAY', prompt}`. No rubric and no score.
- **Answer:** `{essayText: string}`, which is either `""` (empty; `allowsEmpty: true`) or valid text. Valid text means all of these:
  - it is a well-formed string, with no lone surrogate;
  - it has at most 5,000 code points;
  - it contains no C0 control character other than tab (U+0009), LF (U+000A) and CR (U+000D);
  - it contains no DEL (U+007F) and no C1 character (U+0080–U+009F).

  Anything else is 400 `invalid_answer_payload`. The client applies the identical predicate as `isEssayText`.
- **Descriptor interface.** `QuestionDescriptor.score(content, payload, grade?)` gains an optional third argument, `{scoreMicro: bigint}`, carrying the current grade. Every existing descriptor ignores it.
- **Score:**
  - no answer, `""`, or an invalid stored value gives UNANSWERED and 0;
  - a non-empty answer with no grade, or with a grade outside 0..max, gives **UNGRADED**: 0 earned, and the item is pending;
  - a non-empty answer with a valid grade gives **GRADED** and earns `scoreMicro`.
- **`DescriptorScore.outcome`** gains `GRADED` and `UNGRADED`.
- **`scoreAttempt(questions, answers, registry?, grades?)`.** `grades` is a `Map<snapshotId, scoreMicro>`.
  - The composite result adds `gradedCount` and `ungradedCount`.
  - Per D1, `correct` and `incorrect` count only CORRECT and INCORRECT items, and `unanswered` counts UNANSWERED items.
  - GRADED points add to the raw total.
  - The all-v1 baseline result is identical to today and has no new fields (001 §5.6).
- **Monitoring:** `NOT (answer_payload ? 'essayText' AND answer_payload->>'essayText' = '')`.

### 4.2 Grade storage (migration `0061_secure_assessment_essay_grades.sql`, new)

The table `secure_assessment_essay_grade_revisions` has these columns:

| Column | Definition |
|---|---|
| `id` | `uuid` primary key, default `gen_random_uuid()` |
| `tenant_id` | `uuid NOT NULL` |
| `exam_attempt_id` | `uuid NOT NULL` |
| `exam_question_snapshot_id` | `uuid NOT NULL` |
| `revision` | `integer NOT NULL CHECK (revision >= 1)` |
| `score_micro` | `bigint NOT NULL CHECK (score_micro >= 0)` |
| `graded_by_person_id` | `uuid NOT NULL`. A cross-domain reference with no DB foreign key, as in 0002:26 |
| `graded_at` | `timestamptz NOT NULL DEFAULT statement_timestamp()` |

**Constraints:**
- A composite foreign key `(tenant_id, exam_attempt_id, exam_question_snapshot_id)` references `secure_assessment_exam_answers` `uq_sa_exam_answer_current` (0004:26), so a grade always belongs to an existing answer, on delete RESTRICT.
- `UNIQUE (tenant_id, exam_attempt_id, exam_question_snapshot_id, revision)`, which also serves as the read index.
- An append-only trigger refuses UPDATE and DELETE, following 0045:89–104.

The current grade is the highest revision. The migration is idempotent in the 0060 pattern. No existing column or constraint changes; nothing else in the schema changes.

### 4.3 Grading routes (`essay-grading.ts`, new; wired in `server.ts`)

Both routes are authorized by the managed-exam authority (E1). Any other person, another school's object or a foreign object gets 403 `forbidden`, uniform with today (`managed-exam.ts:47`).

**The population rule** is the same for the worklist, the grade write, the ungraded count at finalization and the results:
- it uses the first attempt per participant (`result-finalization.ts:82–97`);
- that attempt must be submitted;
- it is ordered by ELLIGBLE ID (D04.8-51).

**`GET /api/v1/assessment/teacher-exams/essays?examInstanceId=`**
- Runs in a REPEATABLE READ READ ONLY transaction.
- Returns `{exam: {examInstanceId, lifecycleState}, questions: [{snapshotId, no, prompt, rubric, maxScore, answers: [{attemptId, elligbleId, essayText, grade: {score, revision, gradedAt} | null, history: [{score, revision, gradedAt}]}]}]}`.
- Only non-empty essays are listed. Scores are decimal strings with a `.`.
- States: ACTIVE, PAUSED, ENDED and FINALIZED. Any other state gives 409 `invalid_state` with `currentState`.

**`POST /api/v1/assessment/teacher-exams/essays/grade`**
- **Body:** exactly `{examInstanceId, attemptId, snapshotId, score, expectedRevision}`.
  - The three ids are UUID strings.
  - `score` is a string.
  - `expectedRevision` is an integer of at least 1, or null.
  - A missing or extra key, a non-UUID id, a non-string `score` or a wrong `expectedRevision` gives 400 `invalid_request`. This check runs before the transaction.
- **Transaction:** its own READ COMMITTED transaction, in this order:
  1. `buildAuthenticatedContext(…, {mutation: true})`;
  2. `lockManagedExam(client, actor, examInstanceId, true)`, a FOR KEY SHARE that conflicts with finalize's `FOR UPDATE OF i`;
  3. `pg_advisory_xact_lock(hashtext('sa-essay-grade:' || tenant || ':' || attempt || ':' || snapshot))`;
  4. re-authentication;
  5. the checks;
  6. the insert;
  7. re-authentication, then COMMIT.
- **Checks, in order:**
  1. the state is ACTIVE, PAUSED or ENDED; otherwise 409 `invalid_state` with `currentState`;
  2. the attempt is the participant's first attempt, belongs to this exam and is submitted; otherwise 409 `not_gradable`;
  3. the snapshot belongs to this exam and is an ESSAY, and the stored answer is non-empty; otherwise 409 `not_gradable`;
  4. `score` matches `^\d{1,4}([.,]\d{1,2})?$` (the import `SCORE_FORMAT`), is parsed exactly to integer micro-points, and is at most maxScore; otherwise 400 `invalid_score` (so `-1`, `abc`, `2,555` and `5,01` with max 5 are all `invalid_score`);
  5. `expectedRevision` equals the current revision, read after the advisory lock (null when none); otherwise 409 `stale_grade` with `{error, current: number | null}`.
- **Write:** inserts revision n+1. `graded_by_person_id` comes from the actor, never from the body. A unique violation (23505) maps to `stale_grade`.
- **Response:** `{revision, score, gradedAt}`, with `score` as a decimal string with a `.`, as in the worklist.

**Route coverage:**
- `route-parity.test.ts` CALLS gains the two client functions.
- `permission-enforcement.test.ts` adds a POST denial for the grade route and a GET denial for the worklist.

### 4.4 Results, CSV and finalization

**Provisional results** (`teacher-results.ts`):
- The current grades are read and passed to `scoreAttempt`.
- `ParticipantScore` gains `graded` and `ungraded`.
- `scoring` gains `autoScoredCount` (questions that are not ESSAY) and `essayCount`.

**Finalization** (`result-finalization.ts`):
- The current grades are read inside the finalize transaction, after the running-attempt check.
- If any first submitted attempt has an UNGRADED item, finalization refuses with `{type: 'grading_incomplete', ungraded: n}`. That surfaces as HTTP 409 `{error: 'grading_incomplete', ungraded: n}`, and the transaction rolls back.
- Otherwise essays are frozen in `item_outcomes` as `{questionSnapshotId, ruleId, outcome: 'GRADED', scoreMicro, maxScoreMicro, gradeRevision}`.
- The columns `correct`, `incorrect` and `unanswered` follow D1, and the totals include essay points.
- **Known window:** EXPIRY_SERVER submissions that finalization writes inside its own transaction (`result-finalization.ts:47–58`) are counted as ungraded, so finalization is refused. They appear in the worklist on the next read.

**Final results:** `graded` is derived from the frozen `item_outcomes`. `autoScoredCount` and `essayCount` come from the snapshots.

**CSV** (`results-export.ts`, D4): two columns are appended after "Aturan penilaian": "Dinilai guru" (the graded count) and "Belum dinilai" (the ungraded count, 0 when final). They are empty whenever the participant's score is null (absent, NOT_STARTED or IN_PROGRESS). An exam without essays shows "0" and "0". The 17 existing positions are unchanged.

### 4.5 Import (v2, type `ES`)

**Header with rubric:** `QUESTIONS_HEADER_V2_RUBRIC`, new, is the 33 tolerance columns plus `rubric`, 34 in all.
- The 33-, 32- and 10-column headers and v1 stay valid. The rubric is cell 33.
- The template switches to 34 columns.

**Generic order** for every type: number → type → prompt → `rubric_not_allowed` (every type except ES) → the IA or ES branch → `tolerance_not_allowed` (other types) → the existing checks.

**`ES` rows** branch right after the rubric check, in this order: options → items → tolerance → key → score.
- `{code: 'options_not_allowed', line, type: 'ES'}`;
- `{code: 'items_not_allowed', line, type: 'ES'}`;
- `tolerance_not_allowed` when the tolerance is filled;
- `{code: 'correct_not_allowed', line}` when `correct` is filled;
- the score check as in v2.

The rubric is taken as typed (trimmed), with no limit (D3). An ES row is valid in a 10-, 32-, 33- or 34-column file; the rubric is empty when the column is absent.

**Other types** in a 34-column file give `{code: 'rubric_not_allowed', line}` when the rubric is filled.

**`ParsedQuestion` for ES:** `{type: 'ES', options: [], correctIndex: -1, correctIndexes: [], essayRubric: string}`.

The type and problem-code unions gain `'ES'`, `correct_not_allowed` and `rubric_not_allowed`.

**Builder:** `buildEssayFrozenContent({prompt, rubric, maxScore})`.

**Wording (frozen):**

| Code | Teacher | Operator |
|---|---|---|
| `type_invalid` | "tipe soal harus PG, PGK, BS, MJ, UR, IA atau ES." | `"type" must be PG (single answer), BS (true/false), MJ (matching), UR (ordering), IA (numeric), ES (essay) or PGK (multiple answers)` |
| `options_not_allowed`, ES | "soal Esai (ES) tidak memakai kolom pilihan; kosongkan option_a sampai option_e." | `options must be empty for ES` |
| `items_not_allowed`, ES | "soal ES tidak memakai kolom left_1 sampai right_l; kosongkan kolom itu." | `item columns are not used for ES` |
| `correct_not_allowed` | "soal ES dinilai guru, jadi kolom correct dikosongkan." | `"correct" must be empty for ES (graded by the teacher)` |
| `rubric_not_allowed` | "kolom rubric hanya untuk soal ES; kosongkan untuk tipe lain." | `"rubric" is only for ES` |
| `header_invalid` | the existing text, with ", atau no;type;prompt;option_a sampai option_e;correct;score;left_1 sampai left_10;right_a sampai right_l;tolerance;rubric" inserted before ")" | the existing text followed by ` or <the 34 columns joined by ","> (elligble-questions-v2)` |

**Page copy (frozen):**
- **Intro:** "Pilih kelas dan jadwal, unggah soal pilihan ganda (PG), pilihan ganda kompleks (PGK), benar/salah (BS), menjodohkan (MJ), mengurutkan (UR), isian angka (IA) atau esai (ES) dalam templat CSV ELLIGBLE, periksa hasilnya, lalu jadwalkan."
- **Card instruction:** "Satu baris per soal: nomor, tipe (PG, PGK, BS, MJ, UR, IA atau ES), teks soal, pilihan A sampai E (kosong untuk BS, MJ, UR, IA dan ES), kunci jawaban (satu huruf untuk PG; satu sampai lima huruf untuk PGK, misalnya A,C; B atau S untuk BS; untuk MJ huruf pasangan kanan setiap pernyataan kiri secara berurutan, misalnya B,C,A; untuk UR nomor item dalam urutan yang benar, misalnya 3,1,2; untuk IA angka jawaban yang benar, misalnya 3,5; untuk ES kosongkan, karena esai dinilai guru) dan skor, lalu khusus MJ pernyataan kiri (left_1 sampai left_10) dan pasangan kanan (right_a sampai right_l), dan khusus UR item (left_1 sampai left_10). Item UR ditampilkan kepada siswa sesuai urutan penulisan, jadi tulislah dalam urutan acak. Soal IA memakai kolom tolerance untuk selisih yang masih dianggap benar; kosongkan bila jawaban harus tepat. Soal ES boleh memakai kolom rubric untuk pedoman penilaian guru; rubrik tidak ditampilkan kepada siswa."
- **Template:** one ES row with a rubric; every other row gets an empty `rubric` cell.

**Import preview item:** `{type: 'ES', options: [], correct: '', correctLetters: [], rubric}`. On the frontend type, `rubric?: string` is optional, so existing fixtures stay unchanged. The label is "Esai", with a muted "Dinilai guru" line, and "Rubrik: <rubric>" when the rubric is present.

### 4.6 Client

- **Supported types:** `SUPPORTED_QUESTION_TYPES` adds `2:ESSAY`.
- **Values:** the value is the text itself, with `""` as empty.
  - `answerValueOf` maps `{essayText}` to it.
  - `isEssayText` applies the §4.1 predicate.
  - The adapter sends only `""` or valid text.
  - `isEmptyValue` treats `""` as empty, and `isAnsweredValue` is true for non-empty text.
- **Control (`EssayAnswer`):**
  - A visible `Label` "Jawaban esai".
  - The instruction "Tulis jawaban dengan teks biasa, paling banyak 5.000 karakter."
  - The shared `Textarea`: at least 8 rows, with no `maxLength`.
  - A counter "n/5.000 karakter", which is not a live region. The field's `aria-describedby` points to the instruction, the counter and the hint.
  - The hint region is always mounted and polite. When the text exceeds 5,000 code points (D2), or contains a character that is not allowed, it reads "Jawaban melebihi 5.000 karakter, sehingga belum tersimpan." or "Jawaban memuat karakter yang tidak didukung, sehingga belum tersimpan." When both apply, the over-limit hint is shown. Such text is a draft: it is not captured, and the save-state area shows "Belum tersimpan".
  - The control keeps its own text state.
  - Like every type, it is hidden during pause and lock.
- **Drafts.** The workstation's numeric drafts map is generalized to both types under the same rules (ASSESS-QUESTION-007 §4.4). `NumericAnswer`'s props are unchanged.
- **Save state:** `ESSAY` is added to the key-aware check.
- **Grading screen (`TeacherEssayGradingView`, new):**
  - **Entry:** reached from the exam card's "Nilai Esai" button. The button appears only when `essayCount > 0`, which `teacher-readiness.ts` adds to the card projection (on the frontend type `essayCount?: number`, absent meaning 0, so existing fixtures stay unchanged), and the exam is ACTIVE, PAUSED, ENDED or FINALIZED. The route is `?view=teacher&gradeExam=<id>` and the title is "Penilaian Esai", in the shared `Page`.
  - **Summary:** "Belum dinilai: n dari m jawaban".
  - **Per question:** the number, the prompt and the rubric under "Rubrik".
  - **Per answer, a `fieldset`:**
    - its legend is "Soal N · <ELLIGBLE ID>";
    - the essay text uses `white-space: pre-wrap` and `overflow-wrap: anywhere`;
    - the score field is the shared `Input` with `inputMode="decimal"`, labelled "Skor (0 sampai <max with decimal comma>)", for example "Skor (0 sampai 2,5)";
    - the action is "Simpan Nilai";
    - history is a native `<details>` "Riwayat", with a summary of at least 44 px, listing each revision's score and time;
    - one polite status region per answer reads "Nilai tersimpan.", "Nilai tidak valid. Gunakan angka 0 sampai <max>, paling banyak dua angka di belakang koma." or "Nilai ini baru saja diubah. Muat ulang untuk melihat nilai terbaru."
  - When the exam is FINALIZED, the screen is read-only: no field and no action.
- **Results view.** Only when `essayCount > 0`:
  - "Benar" shows `correct/autoScoredCount`;
  - a "Dinilai guru" column shows n;
  - while ungraded > 0, the score is marked provisional as "Belum dinilai: n";
  - the rule footnote adds "Esai dinilai guru; poinnya masuk ke Nilai."

  Exams without essays render exactly as today.
- **Finalize refusal copy** (`TeacherReadinessView`): "Masih ada n jawaban esai yang belum dinilai. Nilai semua esai sebelum finalisasi hasil."
- **Teacher preview:** the prompt, the rubric under "Rubrik" on request, and the label " · Esai".
- **Number format:** copy follows UI_CONTENT_AND_COPY_STYLE.md:148, with "5.000" and a decimal comma.

### 4.7 Invariants

- The lock order of existing actions is unchanged.
- No existing column or constraint is altered.
- Earlier types are unchanged, including the all-v1 scoring hand-off.
- No Student response or IndexedDB record carries the rubric or grades.
- Bahasa Indonesia, with no em dash in UI copy.
- E2E navigation goes only through the shared helpers.
- The frontend skill checkpoint follows ASSESS-QUESTION-002 §4A.8. The new screen uses only shared primitives and `Page`.

### 4.8 Existing assertions that change (only these)

- **Registry lists gain `'2:ESSAY'`:**
  - `question-contract.test.ts:63`, including the message on that line;
  - `multiple-response.test.ts:23`;
  - `true-false.test.ts:17`;
  - `matching.test.ts:25`;
  - `ordering.test.ts:19`;
  - `numeric-answer.test.ts:19`.
- **Exact `type_invalid` text:** `true-false.test.ts:72`, `matching.test.ts:147`, `ordering.test.ts:124` and `numeric-answer.test.ts:131`. The `/PG .* or PGK/` checks still match.
- **`header_invalid` regexes:** `matching.test.ts:160` and `numeric-answer.test.ts:139` now end in `tolerance,rubric \(elligble-questions-v2\)$`.
- **`answerTypes.test.tsx:59, 76, 77`:** the supported list and the header.
- **`route-parity.test.ts` CALLS (:31–62):** the two new client functions.
- **`permission-enforcement.test.ts`:** the POST grade route joins the non-staff denial list (:104–105) and receives its own valid five-key body in the loop (:106–108), so the refusal is the 403 authority refusal and not the exact-body 400. A GET denial for the worklist is added.
- **`test/integration/teacher-results.test.ts:98, 107, 111` and `test/integration/result-finalization.test.ts:131, 133`:** the `scoring` fields (`autoScoredCount`, `essayCount`) and the `ParticipantScore` shape (`graded`, `ungraded`).
- **`frontend/web/src/__tests__/teacherResults.test.tsx:26, 30–31, 191`:** typed fixtures with the new fields.
- **`frontend/web/src/__tests__/resultsExport.test.ts:20, 25–26, 44–48, 49–53`:** the fixtures, the 19-column header and the full row `a` with the two appended cells. `:54–57` and `:67` are unchanged.
- **`e2e/tests/5-lifecycle.spec.ts:523`** (cited as :522 at READY; the same reviewer confirmed the line correction, §11): the absent participant's row now ends in 12 empty cells: `/;Tidak mengerjakan(;){12}$/`.

The numeric tests (`numeric-answer.test.tsx`) are unchanged.

## 5. Expected vectors

Essay content: maxScore 5, rubric "Sebutkan dua alasan".

| # | Case | Expected |
|---|---|---|
| E-1 | `{essayText: "Jawaban saya."}` with no grade | UNGRADED; finalize refused with `grading_incomplete` |
| E-2 | the same, graded `3,5` | GRADED, 3.5 earned |
| E-3 | `""` or no answer | UNANSWERED, 0; no grading needed; not listed |
| E-4 | answer refusals with zero mutation | 400 for each of:<br>• 5,001 code points;<br>• U+0001, U+007F and U+0085;<br>• a lone surrogate `\ud800`;<br>• `{essayText: 5}`;<br>• an extra key;<br>• `{}` |
| E-5 | grade refusals with zero mutation | • 400 `invalid_score` for `-1`, `5,01`, `2,555` and `abc`;<br>• 400 `invalid_request` for an extra key or a wrong type;<br>• 409 `stale_grade` with `{current}`;<br>• 409 `not_gradable` for an empty answer, an unsubmitted attempt, an attempt or snapshot of another exam, or a non-essay snapshot;<br>• 409 `invalid_state` when FINALIZED;<br>• 403 for another Teacher, a Proctor, a Student and another school |
| E-6 | revision | grading 3, then 4 with expectedRevision 1, gives revision 2 and history [3, 4]; the frozen `gradeRevision` is 2 |
| E-7 | invalid content | a non-string rubric, maxScore ≤ 0 or an empty prompt gives readiness `question_content_invalid` |
| E-8 | text fidelity | LF, tab and astral characters (😀) survive save, resume, takeover and reload exactly (C05, C06). CRLF is proved at the engine and API level (C01, C03), because a browser textarea normalizes line breaks to LF |

- **Mixed exam:** v1 (1, correct), true/false (2, wrong) and essay (5, graded 3,5) give correct 1, incorrect 1, graded 1 and raw 4.5/8, which is 56.25.
- **Concurrency:**
  - Two writes with the same expectedRevision: exactly one succeeds.
  - A grade write racing finalize either commits before finalize locks the exam or gets `invalid_state` after it.
- **Import vectors:**
  - ES in a 10-, 32-, 33- and 34-column file;
  - a rubric on a PG row and on an IA row gives `rubric_not_allowed`;
  - `correct` filled on an ES row gives `correct_not_allowed`;
  - an option, item or tolerance filled on an ES row;
  - every earlier vector unchanged.

## 6. Exact proposed file scopes (frozen at READY)

| # | Path | Purpose |
|---|---|---|
| 1 | docs/production/tasks/ASSESS-QUESTION-008.md | Contract, history, evidence (Task-flow) |
| 2 | docs/production/TASK_PLAN.md | Status, counters, ASSESS-QUESTION-007 landing (Task-flow) |
| 3 | docs/production/PRODUCTION_COMPLETION_PLAN.md | Status (Task-flow) |
| 4 | docs/DOCUMENT_MANIFEST.md | Index (Task-flow) |
| 5 | docs/production/CBT_ARCHITECTURE_DELTA_REVIEW.md | Appended checkpoint |
| 6 | database/migrations/0061_secure_assessment_essay_grades.sql | Grade revisions |
| 7 | runtime/secure-assessment/src/question-types/essay.ts | Descriptor |
| 8 | runtime/secure-assessment/src/question-contract.ts | Register; grade argument; outcomes |
| 9 | runtime/secure-assessment/src/scoring.ts | Grades, GRADED/UNGRADED, counts |
| 10 | runtime/secure-assessment/src/question-import.ts | Rubric header, ES type, problems, wording |
| 11 | runtime/secure-assessment/src/exam-provisioning.ts | Builder |
| 12 | runtime/secure-assessment/src/teacher-exam-import.ts | Preview item |
| 13 | runtime/secure-assessment/src/teacher-exam-preview.ts | Type-aware preview |
| 14 | runtime/secure-assessment/src/exam-monitoring.ts | `essayText: ""` is not answered |
| 15 | runtime/secure-assessment/src/essay-grading.ts | Worklist and grade write (new) |
| 16 | runtime/secure-assessment/src/result-finalization.ts | Grades; `grading_incomplete` |
| 17 | runtime/secure-assessment/src/exam-lifecycle-operations.ts | Refusal union |
| 18 | runtime/secure-assessment/src/teacher-results.ts | Grades, counts, scoring fields |
| 19 | runtime/secure-assessment/src/teacher-readiness.ts | `essayCount` on the card projection |
| 20 | runtime/secure-assessment/src/server.ts | Two routes; refusal mapping |
| 21 | frontend/web/src/types/assessment.ts | Key, helpers, results, readiness and grading types |
| 22 | frontend/web/src/api/assessment-client.ts | `getTeacherEssays`, `postTeacherEssayGrade` |
| 23 | frontend/web/src/lib/question-import.ts | Template, wording |
| 24 | frontend/web/src/lib/results-export.ts | Two appended CSV columns (D4) |
| 25 | frontend/web/src/lib/screen-titles.ts | "Penilaian Esai" |
| 26 | frontend/web/src/exam/answer-sync-api.ts | Payload by key |
| 27 | frontend/web/src/components/answers/EssayAnswer.tsx | Student control |
| 28 | frontend/web/src/components/StudentExamWorkstation.tsx | Render by type; drafts generalized |
| 29 | frontend/web/src/components/TeacherExamPreviewView.tsx | Essay preview |
| 30 | frontend/web/src/components/TeacherExamImportView.tsx | Intro, instruction, ES preview |
| 31 | frontend/web/src/components/TeacherEssayGradingView.tsx | Grading screen (new) |
| 32 | frontend/web/src/components/TeacherReadinessView.tsx | "Nilai Esai"; refusal copy |
| 33 | frontend/web/src/components/TeacherResultsView.tsx | D1 columns; provisional state |
| 34 | frontend/web/src/staff-screens.ts | Lazy export |
| 35 | frontend/web/src/App.tsx | Route `gradeExam` |
| 36 | frontend/web/src/styles/workstation.css | Essay styles, tokens only |
| 37 | runtime/secure-assessment/test/essay.test.ts | Units |
| 38 | runtime/secure-assessment/test/integration/essay.test.ts | Journey, concurrency, migration upgrade/rollback/repeat, append-only |
| 39 | frontend/web/src/__tests__/essay.test.tsx | Control, drafts, grading screen, results |
| 40 | e2e/tests/99f-essay.spec.ts | Five-browser journey and captures |
| 41 | runtime/secure-assessment/test/question-contract.test.ts | §4.8 only |
| 42 | runtime/secure-assessment/test/multiple-response.test.ts | §4.8 only |
| 43 | runtime/secure-assessment/test/true-false.test.ts | §4.8 only |
| 44 | runtime/secure-assessment/test/matching.test.ts | §4.8 only |
| 45 | runtime/secure-assessment/test/ordering.test.ts | §4.8 only |
| 46 | runtime/secure-assessment/test/numeric-answer.test.ts | §4.8 only |
| 47 | runtime/secure-assessment/test/route-parity.test.ts | §4.8 only |
| 48 | runtime/secure-assessment/test/integration/permission-enforcement.test.ts | §4.8 only |
| 49 | runtime/secure-assessment/test/integration/teacher-results.test.ts | §4.8 only |
| 50 | runtime/secure-assessment/test/integration/result-finalization.test.ts | §4.8 only |
| 51 | frontend/web/src/__tests__/answerTypes.test.tsx | §4.8 only |
| 52 | frontend/web/src/__tests__/teacherResults.test.tsx | §4.8 only |
| 53 | frontend/web/src/__tests__/resultsExport.test.ts | §4.8 only |
| 54 | e2e/tests/5-lifecycle.spec.ts | §4.8 only |
| 56 | runtime/secure-assessment/src/metrics.ts | Two `COMPONENT_BY_PATH` entries (`reporting`) for the new routes, required by `test/metrics.test.ts:19-23` (00.13 §5.2 path-only addition, confirmed by the same reviewer before the edit) |
| 55 | frontend/web/src/components/ScreenLoadBoundary.tsx | One added `onDemand` export for the grading screen (00.13 §5.2 path-only addition, confirmed by the same reviewer before the edit, §10.1) |

**Forbidden:**
- every other file;
- completed Task records;
- other migrations;
- lockfiles, dependencies and workflows;
- production resources.

## 7. Acceptance gates (DEFINED / NOT EXECUTED)

| Gate | Expected outcome |
|---|---|
| C01 | E-1–E-7, the mixed vector and the descriptor predicate as units; the registry holds seven keys; earlier types and the all-v1 hand-off are unchanged |
| C02 | Import vectors; earlier parser results unchanged; the template parses |
| C03 | Real PostgreSQL:<br>• import of ES and PG; previews; delivery without the rubric;<br>• saves and E-4 refusals with zero mutation; the 409 pair for a client without `2:ESSAY`;<br>• submit; the worklist, including its population and order;<br>• grade, revise and stale; the E-5 refusals with zero mutation;<br>• unauthorized readers and writers;<br>• finalize refused while ungraded, then accepted;<br>• frozen item outcomes with `gradeRevision` matching the revision rows;<br>• provisional and final results and the CSV agree with D1 and D4;<br>• the concurrency vectors;<br>• migration 0061 upgrade on a populated database, synthetic rollback and repeat; UPDATE and DELETE refused |
| C04 | Regression with only the §4.8 assertions changed |
| C05 | Client:<br>• values and the predicate;<br>• the counter;<br>• over-limit and disallowed text become a draft with "Belum tersimpan";<br>• E-8 recovery exactly as typed;<br>• no rubric or grade in any record;<br>• the grading screen: save, invalid, stale, history, read-only once FINALIZED;<br>• the results D1 columns only with essays;<br>• the finalize refusal copy |
| C06 | Five-browser E2E (`99f`, `siswa.e2e.06`, own CSV name `esai-e2e.csv`, the schedule window per project as in 99–99e):<br>• import with a rubric; preview;<br>• the Student writes multi-line text, goes offline, reloads, sees pause, and submits through V06;<br>• the teacher ends;<br>• finalize is refused with the copy; grade, then revise, with history;<br>• finalize; the final score with "Dinilai guru";<br>• shared helpers only |
| C07 | Rendered evidence (`workspace-question-es-*`):<br>• **Baseline:** exact-main CI #209 (1300 pairs, manifest 5f3c3c6b…).<br>• **After:** the import preview, the teacher preview with the rubric, the exam screen (empty, keyboard focus while writing, the over-limit draft), the grading screen (ungraded, stale status, graded with history, read-only FINALIZED), the finalize refusal and the results with "Dinilai guru".<br>• Frozen widths and 200 % text; long essay text at 360 px; no overflow; 44 px targets; visible focus; rendered review PASS.<br>• `99`–`99e` differ only in the import intro, the card instruction, times and IDs |
| C08 | Scope inside rows 1–56; 33 Tasks and 78 edges; exact-SHA attempt-1 eight-job CI; no re-run |
| C09 | Reviews PASS; Delegated Acceptance; evidence commit; delegated merge |

**CI-first order:** the same as ASSESS-QUESTION-007 §7. No re-runs, and no push while the previous commit's CI runs.

## 8. History

- 2026-11-08: Owner decision D1 asked in advance. Contract prepared under DEC-048 on main 7e5141c after ASSESS-QUESTION-007 landed.
- 2026-11-08: Contract review 1 returned STOP (F1–F15). Owner decisions D2–D4 taken (F1–F3). Contract rewritten with all corrections (§9).
- 2026-11-08: Contract review 2 returned STOP (R1–R4). Corrections applied (§9).
- 2026-11-08: Contract review 3 returned PASS. Formal READY and Build start (§10).

## 9. Independent contract review

- **Reviewer:** a fresh-context, read-only subagent under the standing Owner designation. The same reviewer will review the implementation and the rendered evidence.
- **Review 1: STOP.** The reviewer confirmed E1–E5 as executor readings and the A01-3 refusal reading. Each finding and its resolution:
  - **F1:** the over-limit behaviour is an Owner decision. Now D2.
  - **F2:** the rubric cap was unapproved. Now D3: no cap; `rubric_invalid` is removed.
  - **F3:** the provisional CSV. Now D4: two appended columns.
  - **F4:** locking and the transaction. Now `lockManagedExam(…, true)` (FOR KEY SHARE) in its own READ COMMITTED transaction, with the re-authentication points, the advisory lock that includes the tenant, the revision read after that lock, 23505 mapped to stale, the exact body and the grader taken from the actor.
  - **F5:** the uniform 403.
  - **F6:** the refusal codes and the population rule, with the EXPIRY_SERVER window noted.
  - **F7:** the exact text predicate, including lone surrogates.
  - **F8:** the results data source (`autoScoredCount`, `essayCount`), the essay-only UI, `teacher-readiness.ts` (row 19), and counts on the composite result only.
  - **F9:** A01-3 fidelity, covering the rubric version and `pending_issues`.
  - **F10:** the migration, with a composite FK to the answer, `statement_timestamp()`, the tenant in the unique key and the rollback test.
  - **F11:** exact rows 41–54, with `migrations.test.ts` dropped and the numeric tests unchanged.
  - **F12:** the import order, `rubric_not_allowed` placement, the operator ES text and the fifth `header_invalid` text.
  - **F13:** copy now uses "5.000", the decimal comma and "finalisasi".
  - **F14:** grading-screen accessibility: fieldset and legend, per-answer status, `<details>`, and a counter that is not live.
  - **F15:** the added vectors (E-5 readers, E-6 reconstruction, E-8 fidelity) and the C07 captures.
  - **Non-material notes:** applied. The payload and route deviations are recorded, the tenant is in the lock key, a grade outside the range is treated as UNGRADED, and the score field uses `inputMode` decimal.
- **Review 2: STOP.** The reviewer confirmed that F1–F15 are closed, apart from the remaining gaps in F11. Each finding and its resolution:
  - **R1:** D4 broke `e2e/tests/5-lifecycle.spec.ts:523` (first cited as :522). Now row 54, listed in §4.8 with `(;){12}$`.
  - **R2:** the score refusal codes contradicted each other. Now `invalid_request` covers only shape (the score must be a string). Format, exact parsing and the maximum are all `invalid_score` at check 4.
  - **R3:** assertions missing from §4.8. Now they include `teacher-results.test.ts:98`, the grade route's own valid body at `permission-enforcement.test.ts:106–108`, and `resultsExport.test.ts:49–53`.
  - **R4:** the frontend fields' optionality. Now `essayCount?: number` (absent meaning 0) and `rubric?: string`, so the fixtures not in the allowlist stay unchanged.
  - **Non-material notes, applied:**
    - CRLF is proved at the engine and API level;
    - the D4 cells are empty whenever the score is null, and "0", "0" without essays;
    - the over-limit hint wins when both hints apply;
    - the grade response score uses the decimal `.` format;
    - an export key replayed across deploy returns `export_data_changed`, which is acceptable.
- **Review 3: PASS** on record SHA-256 8e8ff572cf393fa1806dbe41a577a384e3449a4d14ea2eb8e165e49c1642a3af, with no finding, material or not.

## 10. Formal READY and Build start under DEC-048 — 2026-11-08

- **Eligibility (00.13 §4.1):**
  - ASSESS-QUESTION-001 is DONE.
  - ASSESS-QUESTION-007 is DONE and landed: PR #32, main 7e5141c3676733db34c9320592486d49d33d12b2, PR-head CI #208, post-merge main CI #209 attempt 1 eight SUCCESS.
  - O02-1, -2, -9, -10 and -12 and A01-3 are approved; D1–D4 were decided by the Owner; O09 rests on P5.
- **Review chain:** STOP → STOP → PASS (§9).
- **Frozen allowlist:** §6 rows 5–54; rows 1–4 are Task-flow paths. One migration, 0061, reserved. Two routes. No dependency, workflow or production resource.
- **Rendered baseline (step 1):** the five `workspace-visual-*` artifacts of exact-main CI #209 (run 42473041916, 7e5141c).
  - The artifacts were fetched with the resumable, size- and `unzip -t`-checked transfer.
  - 1300 `workspace-question-*` pairs from the `99`–`99e` specs, all at commit 7e5141c with frontend tree f4f6eb58943f318b4288474e84771999fa94404a.
  - Every screenshot hash matches its JSON; zero overflow; zero targets under 44 px.
  - Manifest, built as in ASSESS-QUESTION-004 §10: SHA-256 5f3c3c6b42f8c95efc9e83b2bfe352442e53f41d9a45c866cee5075af986418d.
- **CI-first order:** as frozen in §7. This registration is step 1. No re-runs.
- **Status:** BLOCKED → IN_PROGRESS. Counters: DONE 12, IN_PROGRESS 1, VERIFYING 0, BLOCKED 20.

### 10.1 Path-only addition (00.13 §5.2) — 2026-11-08

- **Path:** row 55, `frontend/web/src/components/ScreenLoadBoundary.tsx`.
- **Why:**
  - `App.tsx` (row 35) gets every staff screen from `ScreenLoadBoundary.tsx` (`App.tsx:10-12`).
  - That file wraps each one with the file-local `onDemand` over WEB-001's single on-demand download (`:12-15`, `:35-47`).
  - The grading screen (row 31) therefore needs the same one-line export.
  - Without it, `App.tsx` would need a second `React.lazy` path that bypasses that download and its retry boundary.
- **Scope:** exactly one added line. No route, table, dependency, permission, data field or acceptance change.
- **Confirmation:** the same reviewer confirmed the addition (CONFIRM) on record SHA-256 8e8ff572…, before the edit. C08 now reads rows 1–55.

## 11. Implementation checkpoint — 2026-11-08

- **Step 1:** registration b16332b (CI #210, attempt 1, eight SUCCESS) carries the #209 baseline manifest (§10).
- **Path-only additions (00.13 §5.2),** each confirmed by the same reviewer before the edit:
  - row 55, `ScreenLoadBoundary.tsx`, one `onDemand` export (§10.1);
  - row 56, `metrics.ts`, two `reporting` entries required by `test/metrics.test.ts:19-23`.
- **Citation correction:** the D4 regex in `e2e/tests/5-lifecycle.spec.ts` is at :523, not :522. The same reviewer confirmed it is non-material; only :523 changed.
- **Implementation candidate,** inside rows 5–56 plus the Task-flow rows 1–4:
  - **Descriptor** `question-types/essay.ts`: the §4.1 text predicate, the Student view without rubric or score, UNGRADED/GRADED with the optional grade argument; registered as the seventh key.
  - **Scoring:** `grades` argument, `gradedCount` and `ungradedCount` on the composite result only, D1 counts; the all-v1 hand-off is unchanged.
  - **Migration 0061:** append-only grade revisions with the composite foreign key to the answer.
  - **Grading** `essay-grading.ts`: the worklist (REPEATABLE READ READ ONLY, first submitted attempts by ELLIGBLE ID) and the grade write (READ COMMITTED; re-authentication, FOR KEY SHARE, the tenant-scoped advisory lock, the revision read after it, 23505 as stale, the grader from the actor); both routes wired in `server.ts`.
  - **Finalization:** current grades read after the exam lock; `grading_incomplete` refusal; `gradeRevision` frozen in `item_outcomes`.
  - **Results:** `graded`/`ungraded` and `autoScoredCount`/`essayCount`; `essayCount` on the readiness card.
  - **Import:** the 34-column rubric header, `ES` rows in the frozen order, `rubric_not_allowed` and `correct_not_allowed`, the frozen wording; builder `buildEssayFrozenContent`; preview items with the rubric.
  - **Client:**
    - `ESSAY_KEY`, `isEssayText` (the same predicate), `isEmptyValue`/`isAnsweredValue`; the adapter sends only "" or valid text;
    - `EssayAnswer` with the counter (not live) and the always-mounted polite hint; drafts generalized with numeric answers;
    - the teacher preview with the rubric on request;
    - the grading screen in the shared `Page`, fieldset per answer, status region, `<details>` history, read-only once FINALIZED;
    - the "Nilai Esai" button, the finalize refusal copy, the D1 results columns and footnote, the D4 CSV columns;
    - the import intro, instruction, ES preview and the 34-column template with an ES row;
    - the `.essay-*` CSS, tokens only.
- **Tests:**
  - `test/essay.test.ts` (C01/C02);
  - `test/integration/essay.test.ts` (C03, migration upgrade, rollback, repeat and append-only);
  - `frontend/web/src/__tests__/essay.test.tsx` (C05);
  - `e2e/tests/99f-essay.spec.ts` (C06/C07);
  - the §4.8 assertions in rows 41–54.
- **Local:**
  - typechecks PASS (runtime, web, e2e);
  - Secure Assessment units pass, including the 11 essay units and `metrics.test.ts`;
  - web 427 tests: the 13 new essay tests and every affected file pass. In one full run on this 8 GB workstation, `onDemandScreens.test.tsx` timed out at 5 s under load. It passed on two later runs alone (2.7 s and 3.3 s) and is unchanged; CI decides it on the exact SHA.
  - the client template parses with the server parser without problems.
  - Integration and E2E run in CI only.
- **Status:** IN_PROGRESS → VERIFYING. Counters: DONE 12, VERIFYING 1, BLOCKED 20.

### 11.0 Exact-content CI of the first candidate

- **CI #211** (run 42487879697, 6888adf, attempt 1): FAILURE, preserved without re-run. Runtime and Web failed; E2E and Container were skipped.
  - **Web typecheck:** an unused `React` import in the new `frontend/web/src/__tests__/essay.test.tsx` (TS6133).
  - **Integration:** `mark_ready` returned 409 in the new `test/integration/essay.test.ts`. The test placed `students[0]` in a second, overlapping ACTIVE exam before the exam was marked ready, so the participant schedule-conflict readiness check refused it (`exam-instance-participant-proctor-schedule-conflict-readiness-preflight.ts:117`), as designed. The later 400 followed from that.
- **Correction (tests only, inside rows 38 and 39):** the unused import is removed. The foreign exam is created only after activation, with a participant outside this exam, and the transition assertions now print the response body. No product code changed.
