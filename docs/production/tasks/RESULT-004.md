# RESULT-004 — Full-type and institution result finalization/reporting

## 1. Control state and authority

| Field | Disposition |
|---|---|
| Classification | Active P11 Task; P1 / trustworthy complete results; HIGH risk; R25, R26; P8 V09, V11, V12 |
| Status | **VERIFYING under DEC-048: final evidence and Delegated Acceptance (§12); implementation and reviews (§11); formal READY PASS (§10). Owner decisions RS-1 to RS-3, the RS-1 cell format and the O02/O05 reviewer half decided (§3.1); contract review chain STOP → PASS (§9)** |
| Objective | Make the Teacher results complete and trustworthy for every question type and for institution exams, by reusing the delivered scoring, human grading and finalization rather than adding policy:<br>• golden vectors over one exam that holds all eight types, including the manual short answer, prove per-type scoring, the composite aggregation, the absent, ungraded, unanswered and zero distinctions, idempotent finalization and the frozen, reconstructable raw, maximum and scaled totals, for a teacher-managed exam and an institution subject exam alike;<br>• the results, the export and the grading of an institution exam are not available to its subject Teacher while the exam is ACTIVE or PAUSED (D04.4-26D, LOCKED), and are per subject ExamInstance afterwards (O05-1);<br>• the CSV carries per-question points with an explanation for every 0 (RS-1) and stays spreadsheet-safe;<br>• the results and grading screens never leave focus on BODY;<br>• concurrency, wrong-subject, tamper and full-type export negatives are proven on real PostgreSQL and in a five-browser journey.<br>No new scoring rule, grade policy, correction, publication, route, table, column or School Operator score access |
| Owner decisions | **Approved inputs:**<br>• O02-1, O02-2, O02-9, O02-10, O05-1 and O05-6 (boundary only), A01-2 and A01-3, decided 2026-11-07 ([ASSESS-QUESTION-001 §4](ASSESS-QUESTION-001.md));<br>• D1 and D4 of [ASSESS-QUESTION-008 §3](ASSESS-QUESTION-008.md) (graded essays counted apart; the two appended CSV columns);<br>• D1 of [ASSESS-QUESTION-006 §3](ASSESS-QUESTION-006.md) (manual mode by empty accepted forms);<br>• OD-07, OD-07b and OD-09 (00.11 §12);<br>• RS-1 (with its cell-format follow-up), RS-2, RS-3 and the O02/O05 reviewer half, decided in chat 2026-11-10/11 (§3.1).<br>**Open:** none.<br>**Reviewer:** the standing Owner-designated read-only subagent reviewer, a fresh one for this Task. It is the A01 architecture/assessment reviewer named at ASSESS-QUESTION-001:57, and, by the Owner's answer of §3.1, the reviewer half of O02 and O05 for this Task |
| Execution authority | DEC-048 (00.13). Not eligible yet (below) |
| Base and branch | Drafted on 1b53171 (branch task/assess-room-001, worktree `C:\Projects\ELLIGBLE-room-001`), whose code equals `main` after ASSESS-ROOM-001 lands. Proposed branch task/result-004-complete-results from `main` after that landing |
| Parallel safe / cost | No parallel baseline Task; no dependency, vendor, service or cost |

**Eligibility under 00.13 §4.1** (checked at drafting; re-checked at READY):
- **Internal dependencies** (TASK_PLAN:178, :463): ASSESS-QUESTION-002 to ASSESS-QUESTION-008 are DONE (:162–168) and ASSESS-INSTITUTION-001 is DONE (:173), each landed with its post-merge `main` CI recorded in the TASK_PLAN checklist and its record.
- **One active Task** (§4.2): ASSESS-ROOM-001 is VERIFYING (:176). It must be DONE, merged, and its post-merge `main` CI must pass before this Task starts. It is not an internal dependency.
- **External gate O02** (TASK_PLAN:639, Owner + subject/security reviewers):
  - the rows used are O02-1 (all-or-nothing auto scoring, unanswered 0, the raw/max×100 half-up scaling), O02-2 (an empty value is UNANSWERED), O02-9 (one grader, 0 to maxScore with two decimals, ungraded is not 0 and blocks finalization, revision with history before finalization) and O02-10 (no correction after finalization);
  - the expected vectors of §5 are computed from those rows and the vectors already frozen by the type Tasks. None is a new expected outcome.
- **Reviewer half of O02 and O05** (F2):
  - **Basis used by earlier Tasks:** each type and institution Task named "the standing Owner-designated read-only subagent reviewer, a fresh one for this Task" as its reviewer (for example ASSESS-QUESTION-008:10, ASSESS-ROOM-001:10), under the package statement "The architecture/assessment and security reviewer is the standing Owner-designated read-only subagent reviewer" (ASSESS-QUESTION-001:10). ASSESS-QUESTION-001:57 names that reviewer for A01/A04 only; it is not cited for O02.
  - **For this Task:** the Owner approved in chat that the fixed independent contract reviewer of RESULT-004 holds the reviewer half of O02 and O05 (§3.1, "Setujui (Recommended)"). That half is its contract PASS, recorded in §9 with the reviewed SHA.
- **External gate O05** (:642, Owner + assessment/security reviewer):
  - O05-1: one ExamInstance per subject × rombel, finalized per subject ExamInstance by its subject Teacher, no total across subjects, an assessment result is not an official grade;
  - **"unresolved publication correction"** (F8) is settled for CBT-R1 by O02-10 ("Not available in CBT-R1. A finalized result is immutable, as today (one finalization per exam)") and OD-09 (00.11:159, "Scores stay hidden until the teacher publishes a finalized result, per exam"): only a finalized result is ever published, and a finalized result has no correction path, so there is nothing to correct in a publication. Withdrawal and republication are O05-6, implemented by RESULT-003. This Task neither corrects, withdraws nor publishes. No further Owner input is needed for it.
- **External gate O09** (:646): P5 A10 (CBT_PERMISSION_MATRIX.md:109), A11 (:110), the data rule (:45), P01, P03, P04 (:84, :88, :90) and N01–N10 (:51–60) are approved P content under GOV-POLICY-001.
  - The A11 C column, "O02 manual/type/grading contracts, O05 institution/publication withdrawal/correction", is covered by O02-9, O02-10, O05-1 and O05-6.
  - The A10 C column, "O05 exact composition/aggregate finalization", is covered by O05-1.
  - The :142 exclusion "O05 institution/transfer/publication composition" is covered by the same rows.
- **External gate A01** (:647, Owner-authorized architecture/assessment reviewer): approved as A01-2 (per-item rule identity in `item_outcomes`; the composite rule) and A01-3 (the grading table; finalization refused while grades are pending), Owner 2026-11-07.
  - This Task adds no schema, no content version and no answer version. Its only compatibility point is additive response fields (E10).
  - The reviewer half is the standing reviewer's contract PASS on §4 and E10, recorded in §9 with its reviewed SHA (the ASSESS-ROOM-001 F8 pattern). A01 is §7-reserved; the executor never resolves it alone.
- **OPEN policy inputs:** none. RS-1 to RS-3 are decided (§3.1). None of O03, O04, O06, O07 or O08 is used.
- **Selection:** once ASSESS-ROOM-001 lands, this is the first eligible row in TASK_PLAN order:
  - ASSESS-STUDENT-001 (P0) waits on O04 (OPEN);
  - ASSESS-MEDIA-001 waits on O06, O07 and A02; ASSESS-QUESTION-009 and -010 wait on ASSESS-MEDIA-001 and O06; ASSESS-PROCTOR-003 waits on O08 and A05;
  - OPS-STAGING-001, OPS-001, PERF-001, DEVICE-001, VERIFY-INTEGRITY-001, LEGAL-001, SEC-RELEASE-001 and RELEASE-001 are prepare-only (00.13 §7).

**Authority:**
- **Governance:**
  - [DEC-044](../../00-governance/00.11_CBT_RELEASE_SCOPE_REALIGNMENT.md): the Results row (:40), the School Operator boundary (:51, "no grading, no score edits"), OD-07 (:156), OD-07b (:157, "Subject teachers ... grade essays and finalize the results of their subject") and OD-09 (:159);
  - [DEC-045 §5](../../00-governance/00.12_AICWDF_ADOPTION_AND_TASK_EXECUTION.md);
  - [DEC-048](../../00-governance/00.13_STANDING_EXECUTION_DELEGATION.md).
- **Plan and rules:**
  - [TASK_PLAN RESULT-004/§4/§8](../TASK_PLAN.md): the card :461–469, with acceptance at :465, tests at :466 and impacts at :467; O02 :639, O05 :642, O09 :646 and A01 :647 of §8;
  - [P1 CBT_RELEASE_DEFINITION](../CBT_RELEASE_DEFINITION.md) R25 (:93) and R26 (:94);
  - [P2 CBT_DOMAIN_RULES_SPECIFICATION](../CBT_DOMAIN_RULES_SPECIFICATION.md) grading and finalization (:51, :53);
  - [P3 ROUTE_INTERACTION_MATRIX](../ROUTE_INTERACTION_MATRIX.md) W14 (:35) and F09 (:54);
  - [P5 CBT_PERMISSION_MATRIX](../CBT_PERMISSION_MATRIX.md) A10 (:39, :109), A11 (:40, :110, :131), N01–N10 (:51–60) and the exclusions (:142);
  - [CBT_UX_SCREEN_AND_INTERACTION_INVENTORY](../CBT_UX_SCREEN_AND_INTERACTION_INVENTORY.md) C12 (:45), C21 (:54), R25 (:89), R26 (:90);
  - [CBT_VERIFICATION_AND_RELEASE_DOD_PLAN](../CBT_VERIFICATION_AND_RELEASE_DOD_PLAN.md) V09 (:35), V11 (:37), V12 (:38).
- **Locked discovery rules** ([04.01_SECURE_ASSESSMENT.md](../../01-discovery/04.01_SECURE_ASSESSMENT.md); D04.4 and D04.8 are "REVIEWED & LOCKED", :4222 and :9821):
  - D04.4-12 (:4381): ABSENT is not a zero score;
  - D04.4-26D (:4670): "A subject teacher does not automatically obtain whole-exam or cross-room monitoring rights merely because they teach the subject";
  - D04.8-16 to D04.8-21 (:10018–10100): visibility separately controlled; finalization explicit; blocking scoring work resolved first; responses kept; stable against source edits; finalized is not published;
  - D04.8-24 to D04.8-32 (:10143–10260): a scoring-defect correction is a governed operation and a finalized result is corrected, never silently edited. O02-10 makes no correction available in CBT-R1 (RS-3);
  - D04.8-49 (:10485): simple school-friendly display, "Detailed analytics can be secondary";
  - D04.8-50, D04.8-51 (:10503, :10511): no peer results, no ranking;
  - D04.8-52, D04.8-53 (:10521, :10537): authorized CSV and printable summary; export preserves provenance;
  - D04.8-56, D04.8-57 (:10574, :10592): deterministic computation; audited finalization.
- **Earlier records:**
  - [ASSESS-QUESTION-001](ASSESS-QUESTION-001.md) §4, §5.6 and §5A.8 (the composite rule and its bigint totals);
  - ASSESS-QUESTION-002 to -007: each defers "Composite item detail in reports" to this Task (for example ASSESS-QUESTION-002:43, :633);
  - [ASSESS-QUESTION-008](ASSESS-QUESTION-008.md) E1–E3, D1, D4 and the 0061 table; [ASSESS-QUESTION-006](ASSESS-QUESTION-006.md) manual mode;
  - [ASSESS-INSTITUTION-001](ASSESS-INSTITUTION-001.md) E7 (the subject Teacher keeps finalize, preview, essays, results and export) and :51 (institution reporting is RESULT-004);
  - [ASSESS-INSTITUTION-003](ASSESS-INSTITUTION-003.md) E2 and F3 (live progress of a running institution exam is whole-exam monitoring, denied by D04.4-26D), E20 (role-neutral copy) and the rendered lessons of §11.0.2 to §11.0.4;
  - [ASSESS-ROOM-001](ASSESS-ROOM-001.md) E14 and §11 (the final 99k capture harness).
- **Schema:** migrations 0003, 0004, 0041, 0045, 0054, 0061 and 0062 are reused. No migration is needed (§4.1).

No LOCKED decision or PB status changes.

## 2. Reuse and bounded gaps

`src/` = `runtime/secure-assessment/src/`.

**Reused unchanged:**
- **Scoring:** the production registry with all eight descriptors (`src/question-contract.ts:107`), `scoreBaselineAttempt`, `scoreAttempt` with the composite rule `COMPOSITE_PER_ITEM_V1`, per-item `ruleId`, GRADED and UNGRADED outcomes, bigint micro-point totals and the half-up `scaleToHundred` (`src/scoring.ts:67–70`, :107–191).
- **Human grading:** `secure_assessment_essay_grade_revisions` (0061, append-only), the worklist and the grade write with the per-answer advisory lock and the expected revision; essays and manual short answers alike (`src/essay-grading.ts:52–98`, :143–334).
- **Finalization:** `freezeExamResults` (`src/result-finalization.ts:40–205`):
  - expired unsubmitted Attempts are finalized `EXPIRY_SERVER` first (:50–61);
  - running Attempts give `attempts_running` (:62–71), unsupported content `scoring_unavailable` (:82–83), ungraded items `grading_incomplete` (:179);
  - composite `item_outcomes` carry `ruleId`, `selectedOptionId` on v1 items and `gradeRevision` on GRADED items (:143–151);
  - `pending_issues` stays `[]` (A01-3);
  - the 0045 append-only triggers (0045:91–104).
- **The transition:** `finalize` through `teacher-exams/transition` with reason, confirmation and the `EXAM_TRANSITION` audit (`src/server.ts:344–372`, 0054); idempotent repeat as NO_OP; the subject Teacher of an institution exam keeps `finalize` only (`src/exam-lifecycle-operations.ts:125–130`).
- **Results and export:** `readTeacherExamResults` (`src/teacher-results.ts:82–270`), with the provisional read computed from snapshots, accepted answers and current grades, and the FINAL read from the frozen rows; the export intent through `executePermissionAction` (`RESULT_EXPORT`, REPEATABLE READ, result digest, `export_data_changed`; `src/permission-action-audit.ts:99`, :159, :199–209); `buildResultsCsv` with its formula guard (`frontend/web/src/lib/results-export.ts:14–20`, :45–83).
- **Authority:** `managed-exam.ts` (the active teaching assignment of the exam), for teacher-managed and institution exams alike (ASSESS-INSTITUTION-001 E7).
- **Teacher card:** for an institution exam in ACTIVE or PAUSED, no progress, no "Lihat Hasil" and no "Nilai Esai" (`src/teacher-readiness.ts:263–266`; `frontend/web/src/components/TeacherReadinessView.tsx:343–368`).

**Gaps closed:**
1. **Running institution exams leak live progress.** `teacher-exams/results` (GET and the export POST) returns every participant's NOT_STARTED, IN_PROGRESS or SUBMITTED status and provisional score while an institution exam is ACTIVE or PAUSED. Only the card hides it. That is the whole-exam monitoring D04.4-26D denies the subject Teacher (ASSESS-INSTITUTION-003 F3). The essay worklist and grade write behave the same way (E7, confirmed by RS-2).
2. **No item detail in any report.** Eight type records defer "Composite item detail in reports" to this Task. The CSV and screen carry only totals (RS-1).
3. **Focus falls to BODY.** "Perbarui Data", "Unduh CSV" and "Cetak" (`TeacherResultsView.tsx:171–177`) and "Simpan Nilai" (`TeacherEssayGradingView.tsx:164`) disable themselves while their request runs, so focus is lost.
4. **Copy names the wrong actor.** "guru yang mengelola ujian ini" (`TeacherResultsView.tsx:106`, `TeacherEssayGradingView.tsx:70`) is untrue for an institution exam, which the School Operator organizes (ASSESS-INSTITUTION-003 E20).
5. **Evidence gaps** named by the card (:466): no golden vectors across all eight types in one exam; no institution-exam result, wrong-subject, concurrent grade/finalize, tamper or full-type export evidence.

**Excluded:**
- publication, withdrawal and the Student result screen (RESULT-003; OD-09; O05-6);
- any correction, item void or full-credit remedy (O02-10; RS-3);
- totals across subjects, rankings, analytics, official grades and Academic Core projection (O05-1, D04.8-51, D04.8-54);
- multiple graders, AI grading (O02-9, FUTURE);
- susulan, retake and effective-result selection (one original Attempt only, as today);
- School Operator, Proctor or Homeroom result access (A10, A11, N04);
- question bank, import v2 changes and media (ASSESS-QUESTION-009/010, ASSESS-MEDIA-001);
- the preview copy "Pratinjau hanya dapat dilihat oleh guru yang mengelola ujian ini." (`TeacherExamPreviewView.tsx:64`; ASSESS-INSTITUTION-001 territory, residual R9);
- load evidence (PERF-001).

## 3. Settled inputs, Owner decisions and engineering readings

**Approved before this Task (quoted):**
- **O02-1** (ASSESS-QUESTION-001.md:65): "All-or-nothing for every auto-scored type ... Unanswered = 0. Existing per-item maxScore (>0, ≤1000, 2 decimals) and the same raw/max×100 half-up scaling are kept."
- **O02-9** (:73): "Ungraded is not 0 and blocks finalization. Grades can be revised before finalization, with revision history."
- **O02-10** (:74): "Not available in CBT-R1. A finalized result is immutable, as today (one finalization per exam)."
- **O05-1** (:77): "Finalization happens per subject ExamInstance, by its subject Teacher. There is no total across subjects in CBT-R1 (an assessment result is not an official grade)."
- **O05-6** (:82): "Republishing shows the same frozen result." (RESULT-003)
- **A01-2** (:89) and **A01-3** (:90), quoted in §1.
- **ASSESS-QUESTION-008 D1:** "Esai yang dinilai tidak masuk hitungan Benar/Salah ... Poin esai tetap masuk ke Nilai akhir. Esai kosong dihitung tidak dijawab." **D4:** "Menambah kolom "Dinilai guru" dan "Belum dinilai" di akhir. Ke-17 kolom yang ada tidak berubah urutan."
- **P5 A11** (:110): "Teacher export limited to scoped authorized result/identity fields, excludes NISN/birth date and unrelated subjects ... Proctor/Operator/Platform Admin receive no scores by those roles"; "No implicit publication on END, mutable finalized result or unaudited correction".
- **P5 A10** (:109): "No Operator keys, scores, grading, score edits or cheating verdicts; no bulk result export".
- **Card acceptance** (TASK_PLAN:465): "Every type and institution subject follows approved scoring/aggregation. Required manual work blocks finalization; absent/ungraded/zero stay distinct. Preserve frozen v1 truth, revision/history, idempotent finalization and reconstructable raw/max/scaled totals; authorized CSV/print remain spreadsheet-safe."
- **Card tests** (:466): "golden vectors, concurrent grades/finalization, incomplete grading/running Attempt refusal, wrong-subject grader, frozen result tamper and full-type export".

**Settled by these inputs, so not asked:**
- **Who sees institution exam results, and which fields:** only the subject Teacher, the person holding the exam's active teaching assignment (OD-07b, O05-1, A11, `managed-exam.ts`). The fields are today's Teacher projection plus the RS-1 item points: ELLIGBLE ID, status, submission source and time, counts, raw, maximum and scaled scores. Never names, NIS, NISN, birth date, answer text, keys or rubrics (A11, P04, :45).
  - The School Operator sees no score and no results route (00.11:51, A10, A11 "no scores", ASSESS-INSTITUTION-003 F6). It already sees the lifecycle state "Hasil Final" of each subject exam in its session view (ASSESS-INSTITUTION-001 E8); nothing is added.
  - The Homeroom Teacher has no exam result power (N04 "Homeroom assignment alone no exam powers"; A11 does not list it).
  - Another subject's Teacher, Proctors and Students are refused (N03, N04, N05).
- **Partial results while essays are ungraded:** the provisional result counts an answered, ungraded item as UNGRADED with 0 earned, shows "Belum dinilai: n" and fills the D4 column; finalization is refused with `grading_incomplete` (O02-9, A01-3, D1, D4). Unchanged.
- **Recompute or regrade after a correction:** before finalization a grade revision is always recomputed on read (provisional); after finalization nothing is recomputed (O02-10, D04.8-20, D04.8-26). An answer-key remedy is RS-3.
- **Export authority:** the subject or managing Teacher only, through the existing audited export intent; CSV and print only (A11, D04.8-52, SEC-001). No Operator or bulk export (A10).
- **Aggregation across subjects:** none (O05-1). Each subject ExamInstance has its own result, finalization and file.
- **Publication:** finalization publishes nothing (D04.8-21, OD-09); RESULT-003.

### 3.1 Owner decisions (decided in chat, 2026-11-10/11)

Each point changes what users see or do, or is a choice between materially different outcomes, so it went to the Owner (00.13 §7). Questions and answers are quoted verbatim:

- **RS-1, item detail in reports** (gap 2).
  - Question: "Task berikutnya RESULT-004 (hasil lengkap dan tepercaya), RS-1: bagaimana rincian nilai per soal disediakan?"
  - The Owner chose **"Kolom per soal di CSV (Recommended)"**. Alternatives not chosen: no item detail; item detail on the screen as well.
  - **Cell-format follow-up (review F6).**
    - Question: "RESULT-004 (temuan reviewer F6): di kolom per soal CSV, angka 0 tidak membedakan jawaban salah, tidak dijawab, dan esai yang dinilai 0. Bentuk sel mana yang dipakai?"
    - The Owner chose **"Poin dengan keterangan (Recommended)"**, whose option text was "Sel berisi poin; bila 0 diberi keterangan, misalnya "0 (tidak dijawab)" atau "0 (salah)"; "Belum dinilai" untuk esai yang belum dinilai."
    - The exact cell strings are fixed in E9.
- **RS-2, grading of an institution exam** (gap 1).
  - Question: "RESULT-004, RS-2: kapan guru mata pelajaran boleh menilai esai pada ujian sekolah?"
  - The Owner chose **"Setelah ujian berakhir (Recommended)"**. The alternative not chosen was grading of submitted answers while the exam runs.
  - This confirms the LOCKED reading E7 (F1). The alternative would have needed an explicit Owner reinterpretation of D04.4-26D.
- **RS-3, a wrong answer key found after the exam opened** (D04.8-24 to D04.8-29).
  - Question: "RESULT-004, RS-3: bila kunci jawaban ternyata salah setelah ujian dibuka, apa yang tersedia?"
  - The Owner chose **"Tidak tersedia di CBT-R1 (Recommended)"**. The alternative not chosen was an item void or full-credit remedy before finalization, which would have needed migration 0066, new routes and screens.
- **The O02/O05 reviewer half** (review F2).
  - Question: "RESULT-004 (temuan reviewer F2): gerbang O02 dan O05 meminta persetujuan reviewer di samping Owner. Setujui bahwa reviewer independen tetap untuk tugas ini (reviewer kontrak RESULT-004) memegang bagian reviewer O02/O05, seperti pada tugas soal dan ujian sekolah sebelumnya?"
  - The Owner chose **"Setujui (Recommended)"**.

**What each decision fixes in this contract:**
- **RS-1:** E8, E9 and §4.3; §6 rows 10 and 17; the `5-lifecycle.spec.ts:523` change of §4.7; X-1.
- **RS-2:** E7 and its rows in §4.2, §4.5 and §4.8; no Teacher card change.
- **RS-3:** E15 and residual R1; no migration.
- **Reviewer half:** §1 eligibility and C10.

### 3.2 Engineering readings (for the contract review)

- **E1, authority** (OD-07, OD-07b, A11, P03).
  - Results, export, worklist, grade and finalize keep the single authority of `managed-exam.ts:28–67` and `teacher-results.ts:100–116`: an active teaching assignment of this exam, re-read per request and taken FOR SHARE on writes.
  - It is the same for teacher-managed and institution exams. A person with combined roles acts as Teacher here only through that assignment (P03).
  - Every other actor gets the existing 403, byte-identical with a nonexistent id.
- **E2, per-type scoring is reused, not re-implemented.** `scoring.ts`, the registry and the eight descriptors are unchanged and forbidden. The golden vectors of §5 are evidence of the approved rules, computed by hand from O02-1 and the type rules.
- **E3, aggregation** (O05-1, A01-2).
  - An exam with any registered version 2 item scores with `COMPOSITE_PER_ITEM_V1`; an all-v1 exam keeps `BASELINE_SINGLE_CHOICE_V1`.
  - A result belongs to one ExamInstance. No route sums ExamInstances; an institution session has as many results, finalizations and files as subject exams.
- **E4, the distinctions** (D04.4-12, O02-1, O02-2, O02-9, D1), as delivered:
  - **absent:** no submission at finalization, standing ABSENT, no score, empty CSV cells; provisional NOT_STARTED or IN_PROGRESS, no score;
  - **unanswered:** no answer or an empty value, UNANSWERED, 0 earned, counted in "Tidak dijawab";
  - **ungraded:** a non-empty answer of a teacher-graded item without a valid grade, UNGRADED, 0 earned but pending, "Belum dinilai"; it blocks finalization;
  - **graded zero:** GRADED with 0 earned, counted in "Dinilai guru".
- **E5, finalization** (D04.8-17, D04.8-18, D04.8-57), as delivered: explicit, audited with reason and confirmation, idempotent; refused while any Attempt runs, while content is unscorable or while any item is ungraded; it writes one finalization and one append-only row per participant with reconstructable item outcomes.
- **E6, results of a running institution exam** (D04.4-26D, LOCKED; ASSESS-INSTITUTION-003 E2 and F3). For an exam with `institution_session_id IS NOT NULL` in ACTIVE or PAUSED:
  - `teacher-exams/results` GET and its export POST answer 409 `institution_exam_running` with `{currentState}`;
  - from ENDED the results are available, matching the Teacher card's counts from ENDED (ASSESS-INSTITUTION-003 E2);
  - SCHEDULED and READY stay as today (a roster with no activity, no monitoring);
  - teacher-managed exams are unchanged: their managing Teacher supervises them (D04.4-26A, D04.4-26C);
  - this follows from the LOCKED rule, as the Teacher card did there. It is not an Owner choice; the reviewer confirms the reading.
- **E7, grading of a running institution exam** (D04.4-26D, LOCKED; F1).
  - The same window and code on `teacher-exams/essays` GET and `teacher-exams/essays/grade` POST: essay and manual short-answer grading of an institution exam opens only once it has ended.
  - **Why it is the LOCKED reading:** the worklist of a running exam lists, per ELLIGBLE ID, which participants have submitted and their answers as they arrive. That is whole-exam progress, the same monitoring E6 removes from the results.
  - **Owner confirmation:** RS-2 "Setelah ujian berakhir (Recommended)" (§3.1). Grading while running would have needed an explicit Owner reinterpretation of D04.4-26D.
  - **Not offered:** "anonymized grading while running" (answers without ELLIGBLE IDs). The arrival of each answer still shows progress, and anonymity is no approved policy.
  - Grading of teacher-managed exams keeps ACTIVE, PAUSED and ENDED (ASSESS-QUESTION-008 E2).
- **E7a, earlier readings withdrawn** (F9). Under D04.4-26D, E6 and E7 withdraw, for the ACTIVE and PAUSED window only:
  - ASSESS-INSTITUTION-001 E7 (:140), "Finalize, preview, essay grading, results and export are unchanged";
  - ASSESS-INSTITUTION-003 E2 (:168), "Finalization, essay grading, results and export are unchanged".

  Both readings stay true from ENDED, and for preview and finalization. Those completed records are history and are not edited (00.13 §3).
- **E8, the item projection** (RS-1).
  - `questions`: one entry per snapshot in display order, `{no, typeCode, maxScore}`. `typeCode` is the v2 import type code of the content key (`question-import.ts:48`): `1:MULTIPLE_CHOICE_SINGLE` PG, `2:MULTIPLE_RESPONSE` PGK, `2:TRUE_FALSE` BS, `2:MATCHING` MJ, `2:ORDERING` UR, `2:NUMERIC_ANSWER` IA, `2:SHORT_ANSWER` IS (automatic and manual alike), `2:ESSAY` ES. No prompt, option, key, accepted form, tolerance or rubric.
  - `participants[].items`: present only on a row with a score, one entry per question, `{no, outcome, score}`; `outcome` is CORRECT, INCORRECT, UNANSWERED, GRADED or UNGRADED; `score` is the earned points (0 for UNGRADED).
  - **PROVISIONAL:** `questions` from the snapshots in display order (the key and `maxScore` of each); `items` from the same `scoreAttempt` call that gives the totals, matched by `questionSnapshotId`, so items and totals cannot disagree.
  - **FINAL** (F4): never recomputed (D04.8-20); only frozen data is used.
    - `items`: each frozen `item_outcomes` entry, matched to its question by `questionSnapshotId`; outcome and points from the entry (`scoreMicro`).
    - `questions`: the frozen order of `item_outcomes` gives `no`; the frozen `maxScoreMicro` of the entry gives `maxScore`; `typeCode` comes from the frozen `ruleId` (`BASELINE_SINGLE_CHOICE_V1` or no `ruleId` PG, `MULTIPLE_RESPONSE_EXACT_SET_V1` PGK, `TRUE_FALSE_EXACT_V1` BS, `MATCHING_EXACT_PAIRS_V1` MJ, `ORDERING_EXACT_SEQUENCE_V1` UR, `NUMERIC_EXACT_DECIMAL_TOLERANCE_V1` IA, `SHORT_ANSWER_ACCEPTED_FORMS_V1` IS, `ESSAY_HUMAN_GRADED_V1` ES). They are read from the first SUBMITTED row; every SUBMITTED row of one finalization has the same order and maxima.
    - With no SUBMITTED row there are no item cells. `questions` then comes from the snapshots, as PROVISIONAL.
    - The exam maximum stays the frozen `max_score_micro` (`result-finalization.ts:254`).
  - When `scoring.available` is false, `questions` is `[]` and no row has `items`.
- **E9, the CSV** (RS-1 and its cell-format answer; D4 precedent; F6).
  - The 19 existing columns keep their order and values.
  - Then one column per `questions` entry, headed "Soal <no> (<typeCode>, maks <maxScore>)" with the decimal comma, for example "Soal 6 (IA, maks 2,5)".
  - **Cell strings** ("<p>" is the earned points with the decimal comma and no trailing zeros):

    | Item | Cell |
    |---|---|
    | CORRECT | "<p>", for example "2" or "1,5" (always above 0, since maxScore > 0) |
    | PARTIAL | does not exist in CBT-R1: every automatic type is all-or-nothing (O02-1) and no descriptor returns it |
    | INCORRECT | "0 (salah)" |
    | UNANSWERED (no answer, an O02-2 empty value, an incomplete matching, an invalid stored value) | "0 (tidak dijawab)" |
    | GRADED above 0 | "<p>", for example "2,5" |
    | GRADED with 0 | "0 (dinilai guru)" |
    | UNGRADED (answered, not yet graded) | "Belum dinilai" |
    | Row without a score (ABSENT, NOT_STARTED, IN_PROGRESS, scoring unavailable) | empty |

  - The outcome set is closed (CORRECT, INCORRECT, UNANSWERED, GRADED, UNGRADED). An outcome outside it is a defect: the builder throws, and the export shows the existing generic failure with no file (C01).
  - None of these strings starts with `=`, `+`, `-`, `@`, tab or CR, or contains `;`, `"`, CR or LF. Each still passes the existing `text()` guard. A response without `questions` (an older server) adds no column.
  - Print and screen are unchanged.
- **E10, compatibility** (A01, reviewer half).
  - The response gains `questions` and `participants[].items`; existing fields, their order and values are unchanged, so an older web client ignores them.
  - No stored row changes. The export result digest now covers the new fields: an export key issued before deployment and retried after it answers `export_data_changed`, the existing safe refusal (residual R3).
- **E11, tamper scope** (card "frozen result tamper", D04.8-20).
  - The product cannot write after FINALIZED: the grade write refuses FINALIZED under the exam lock (`essay-grading.ts:271`); submitted Attempts refuse saves; the 0045 and 0061 tables refuse UPDATE and DELETE.
  - A raw-SQL change outside the product (an answer, a snapshot with its trigger disabled, a later grade revision) leaves the FINAL results, items and CSV unchanged, as `result-finalization.test.ts:155–172` proves for v1.
  - The read-only worklist of a FINALIZED exam shows the current grade revision; a raw-SQL revision added after finalization would show there (residual R4). No product path, agent or role can write it.
- **E12, focus and layout** (V12; ASSESS-INSTITUTION-003 §11.0.3).
  - "Perbarui Data", "Unduh CSV", "Cetak" and "Simpan Nilai" keep `disabled` while their request runs (existing tests read it).
  - When the request settles, and only when focus is on BODY (the control lost it while disabled), focus returns to the same control once it is enabled again, then to "Perbarui Data" (results) or "Muat Ulang" (grading) if it is not. Focus the user moved elsewhere in the meantime is left alone.
  - The default `Button` size is already `h-11`, 44 px (`ui/button.tsx:21`), so the targets need no size change. The four results toolbar buttons and "Simpan Nilai" take the wrapping form `h-auto min-h-11 max-w-full whitespace-normal` only so that their labels wrap at 200 % text, as "Tampilkan Nilai" already does (`TeacherResultsView.tsx:167`).
  - The new refusal states use the shared `LoadErrorState`; any Alert touched takes `AlertDescription min-w-0 break-words`.
- **E13, copy** (E20 precedent, UI_CONTENT_AND_COPY_STYLE): role-neutral refusals and the running states of §4.5, in Bahasa Indonesia with no em dash.
- **E14, E2E.**
  - The new spec `99l-complete-results.spec.ts` sorts after `99k`.
  - It copies the final 99k capture step unchanged except its prefix and task value: single-pass 200 % calibration, the retry of a variant whose calibrated DOM was replaced, the post-capture integrity check, and the WebKit fallback to the viewport for a page WebKit refuses as too large. It is copied, not imported, because `helpers.ts` stays forbidden (ASSESS-INSTITUTION-003 R17).
  - It uses the in-app "Perbarui Data" and "Muat Ulang", never a browser reload.
  - guru.e2e, also a Proctor from earlier specs, may land on "Ruang Ujian" first; the spec opens "Pelaksanaan Ujian" from the "Ruang kerja" navigation.
  - The fixture has seven X-E2E students at that point: the six of `global-setup.ts:15` plus the Student the AUTH-002 claim journey enrolls (`9-identity.spec.ts:227`), as 99k counts them (`99k-room-transfer.spec.ts:475`).
- **E15, corrections** (O02-10, RS-3 "Tidak tersedia di CBT-R1"): no item void, full credit, regrade after finalization or correction path. D04.8-24 to D04.8-32 stay LOCKED principles for a later governed workflow.

**Recorded deviations from proposed (not locked) documents:**
- The card's `scoring.ts` and `result-finalization.ts` are reused unchanged (E2, E5).
- The card's `manual-grading.ts` and `ManualGradingView.tsx` are the delivered `essay-grading.ts` and `TeacherEssayGradingView.tsx`.
- The card's `test/integration/teacher-results.test.ts` and `e2e/tests/4-results.spec.ts` stay unchanged as regression oracles; new files `test/integration/complete-results.test.ts` and `e2e/tests/99l-complete-results.spec.ts` carry the new evidence.
- P3 F09's `POST /api/v1/assessment/grades` stays the delivered `teacher-exams/essays/grade` (ASSESS-QUESTION-008).

## 4. Contract

### 4.1 Schema

No migration. No table, column, constraint, trigger or row changes. Migration 0066 is not reserved (RS-3 chose no remedy).

### 4.2 Authority, transactions and errors

No new lock, lock order or transaction. Each change is one check placed after the existing authority check and before any other effect.

| Route | Existing order kept | New check (E6, E7) | Placement |
|---|---|---|---|
| GET `teacher-exams/results` | 400 id → 401/403 context → 403 not this exam's Teacher (`teacher-results.ts:100–120`) | institution exam in ACTIVE or PAUSED → 409 `institution_exam_running` | after the exam query, which also selects `institution_session_id`, inside the REPEATABLE READ READ ONLY snapshot; ROLLBACK |
| POST `teacher-exams/results` (csv, print) | 400 body → key lock → re-authentication → `lockManagedExam` FOR KEY SHARE 403 (`permission-action-audit.ts:88–160`) | the same, from `run` | `run` returns `{type: 'institution_exam_running'}`; `successful()` is false, so ROLLBACK and **no audit row** |
| GET `teacher-exams/essays` (E7) | 403 `readManagedExam` (`essay-grading.ts:148–150`) | the same | before the existing `invalid_state` check |
| POST `teacher-exams/essays/grade` (E7) | 400 → re-authentication → `lockManagedExam` FOR KEY SHARE 403 (`:266–268`) | the same | right after `lockManagedExam`, before the advisory lock; the exam row is held, so END cannot commit in between |
| POST `teacher-exams/transition` `finalize` | unchanged | none (ENDED is required; a running exam answers `invalid_state` as today) | |

**Body:** `{"error": "institution_exam_running", "currentState": "ACTIVE" | "PAUSED"}`. No participant, count or score.

**Errors otherwise unchanged:** 403 `forbidden`, 409 `invalid_state`, `attempts_running`, `scoring_unavailable`, `grading_incomplete` (`ungraded`), `stale_grade` (`current`), `not_gradable`, `export_data_changed`, `action_key_reused`, `state_changed`, 503 `persistence_unavailable`.

### 4.3 Projection and CSV

`GET teacher-exams/results` and the export POST, for every exam kind:
- adds top-level `questions: [{no: number, typeCode: 'PG'|'PGK'|'BS'|'MJ'|'UR'|'IA'|'IS'|'ES', maxScore: number}]` (E8);
- adds `items: [{no: number, outcome: 'CORRECT'|'INCORRECT'|'UNANSWERED'|'GRADED'|'UNGRADED', score: number}]` to each participant row whose `score` is not null; rows without a score have no `items` key, so their existing shape is byte-identical;
- leaves `exam`, `scoring`, `resultState`, `finalizedAt`, `summary` and every existing participant field unchanged.

**Invariants of the projection** (in micro-points, F4; the response shows them divided by 1 000 000):
- for every scored row, the sum of the items' earned micro-points equals the row's raw micro-points (`raw_score_micro` when FINAL); the counts of CORRECT, INCORRECT, UNANSWERED, GRADED and UNGRADED equal `correct`, `incorrect`, `unanswered`, `graded` and `ungraded`;
- the sum of the questions' maximum micro-points equals the exam maximum: the frozen `max_score_micro` when FINAL, the `scoreAttempt` maximum when PROVISIONAL;
- FINAL items equal the frozen `item_outcomes`, matched by `questionSnapshotId`, in order, outcome and `scoreMicro`; FINAL `questions` equal the frozen order, `maxScoreMicro` and `ruleId` (E8).

`buildResultsCsv` (E9): columns 1 to 19 unchanged; columns 20 onward as E9.

### 4.4 Teacher, School Operator, Proctor and Student surfaces

- **Subject or managing Teacher:** the results screen and file as §4.3 and §4.5; the grading screen as §4.5.
- **School Operator, Proctor, Homeroom Teacher:** nothing changes. They get 403 on all five routes and receive no score, `questions` or `items` in any projection.
- **Student:** nothing changes; no result is visible before RESULT-003.

### 4.5 Client

**Results screen** (`TeacherResultsView.tsx`):
- **Load refusals:**
  - 403: title "Akses Ditolak", "Hasil ujian hanya dapat dilihat oleh guru mata pelajaran ujian ini." (E13);
  - 409 `institution_exam_running`: `LoadErrorState kind="refused"`, title "Hasil Belum Tersedia", "Hasil ujian sekolah dapat dilihat setelah ujian berakhir. Selama ujian berlangsung, pemantauan dilakukan operator sekolah dan pengawas ruang.";
  - everything else as today.
- **Export refusal** `institution_exam_running` (unreachable in the product, mapped so it never shows the generic copy): "Hasil ujian sekolah dapat diekspor setelah ujian berakhir. Tidak ada berkas atau cetakan dibuat."
- **Focus and layout:** E12.
- The table, metrics, toggle, notes and print are unchanged (RS-1: detail in the CSV only).

**Grading screen** (`TeacherEssayGradingView.tsx`):
- **Load refusals:**
  - 403: "Jawaban hanya dapat dinilai oleh guru mata pelajaran ujian ini." (E13);
  - 409 `institution_exam_running` (E7): title "Penilaian Belum Tersedia", "Jawaban ujian sekolah dapat dinilai setelah ujian berakhir.";
  - `invalid_state` as today.
- **Save refusal** `institution_exam_running`: "Jawaban ujian sekolah dapat dinilai setelah ujian berakhir." in the answer's status line.
- **Focus and layout:** E12.

**CSV** (`lib/results-export.ts`): E9.

**Types** (`types/assessment.ts`): optional `questions` on `TeacherExamResultsResponse` and optional `items` on `ParticipantResult`.

The Teacher card, the client API and every other screen are unchanged. Bahasa Indonesia, no em dash, times in the school zone, shared primitives and tokens only (plan §10.1).

### 4.6 Invariants

- **Truth:** no stored row changes. Stored v1 snapshots, answers, grades, finalizations and `item_outcomes` stay byte-identical; an all-v1 exam keeps `BASELINE_SINGLE_CHOICE_V1` and its exact totals.
- **Determinism** (D04.8-56): the same snapshots, accepted answers and current grades give the same provisional items and totals; a FINAL read returns exactly the frozen rows.
- **Distinctions** (F6): E4 holds in the response (`outcome`), the screen and the CSV. In a per-question cell a 0 is never bare: "0 (salah)", "0 (tidak dijawab)" and "0 (dinilai guru)" tell an incorrect, an unanswered and a graded-zero item apart; "Belum dinilai" is never 0; an empty cell is a participant with no score (E9).
- **Authority:** only the exam's Teacher (E1). Every refusal writes nothing: no grade revision, finalization, attempt result, submission, lifecycle event or permission event.
- **Supervision** (D04.4-26D): no route returns per-participant status or scores of an ACTIVE or PAUSED institution exam to its subject Teacher.
- **Data:** no response, CSV, log or row added here carries a name, NIS, NISN, birth date, answer text, key, accepted form, tolerance or rubric.
- **Locks:** unchanged (§4.2).

### 4.7 Existing assertions that change (only these)

- `e2e/tests/5-lifecycle.spec.ts:523`: the absent row of a three-question v1 exam now ends with `(;){15}` instead of `(;){12}` (three per-question columns, empty for an absent row, E9). Its other assertions hold: :521 still finds ";Dikumpulkan;Oleh siswa;" and :522 still finds ";66,67;BASELINE_SINGLE_CHOICE_V1", because the per-question cells follow the 19 fixed columns.

**Unchanged and passing as they are:**
- **Runtime:** `teacher-results.test.ts` (it compares `exam`, `scoring`, `summary`, `.score` of scored rows and whole rows only without a score, :89–114); `result-finalization.test.ts` (:169 compares `participants` before and after source edits: FINAL items come from the frozen rows, so both sides stay equal); `permission-enforcement.test.ts:316–339` (the GET and the export carry the same new fields); `essay.test.ts`, `short-answer.test.ts` and every type integration test (they compare `.score` and `.scoring`); `institution-exams.test.ts:720–740` (reads at ENDED); `school-exam-monitoring`, `teacher-readiness`, `route-parity` (no new route) and `metrics`.
- **Web:** `teacherResults.test.tsx` (its `disabled` read at :196 stays true), `resultsExport.test.ts` (its fixture has no `questions`, so no column is added: :44–57 unchanged), `essay.test.tsx`, `short-answer.test.tsx`.
- **E2E:** `4-results`, `99f`, `99g`, `99h`–`99k` journeys; their screens are unchanged.

### 4.8 Negative coverage (P5 trace)

P5 names for A11 the negatives N01, N02, N03, N04, N05, N06 and N08 (:131). N10 is added for the POST edges.

| Route | P5 row | N-ids asserted (C03) |
|---|---|---|
| GET `teacher-exams/results` | A11 | N01, N02, N03, N04, N05, N06 |
| POST `teacher-exams/results` (csv, print) | A11 | N01, N02, N03, N04, N05, N06, N08, N10 |
| GET `teacher-exams/essays` | A11 | N01, N02, N03, N04, N05, N06 |
| POST `teacher-exams/essays/grade` | A11 | N01, N02, N03, N04, N05, N06, N08, N10 |
| POST `teacher-exams/transition` `finalize` | A04, A11 | N01, N02, N03, N04, N05, N06, N08, N10 |
| The School Operator session and exam projections | A10 | N04 (no `score`, `rawScore`, `scaledScore`, `items` or `questions` key) |

What each N-id means here:
- **N01:** anonymous gives 401; no membership or another tenant gives 403; an unavailable database gives 503 with nothing written.
- **N02:** an exam of another tenant, and on the grade write an Attempt or snapshot of another exam, give the existing refusal, byte-identical with a nonexistent id.
- **N03:** T2 (Fisika × Y of the same session) on E1, T1 on E2, T1 after its teaching assignment is revoked, the tenant-2 Teacher and actor A (member, no school role) get 403 with zero mutation. The CLI-only platform operator has no product session, as in ASSESS-INSTITUTION-003 §4.9.
- **N04:** the School Operator O (no Teacher assignment), the Proctor P (also on its own room's participants), the Homeroom Teacher H and a Student get 403 on all five routes, for E1 and for TM-G.
- **N05** (CBT_PERMISSION_MATRIX.md:131, F7): the results and export responses, the grade receipt and the finalize receipt carry none of the I-7 forbidden keys; the worklist, which shows prompt, rubric and answer text to the grader by design (`essay-grading.ts:194–202`, `essay.test.ts:183–185`), carries no identity key beyond the ELLIGBLE ID; a Student gets 403 on every route, including the grade write and finalize; the Student delivery is unchanged.
- **N06:** E6 and E7 (409 `institution_exam_running` in ACTIVE and PAUSED); a grade after FINALIZED is `invalid_state`; a stale revision is `stale_grade`; finalize with a running Attempt is `attempts_running`, with an ungraded item `grading_incomplete`.
- **N08:** finalize without a reason or confirmation gives 400; a finalize key replayed with another body gives `action_key_reused`; an export replayed after the data changed gives `export_data_changed`; every refusal leaves equal before/after counts in 0045 (both tables), 0061, 0054, submissions and lifecycle events.
- **N10:** a disallowed Origin gives 403 `origin_not_allowed` and a body over 64 KiB gives 413, before any database effect.

## 5. Expected vectors

**Fixture:**
- **Tenant 1** (Asia/Jakarta).
  - Institution session S (its window moved by fixture SQL):
    - E1, Matematika × X, subject Teacher T1, golden content G, participants x1 to x8;
    - E2, Fisika × Y, subject Teacher T2, two PG questions, participants y1 and y2.
  - TM-G: a teacher-managed exam of T3 with content G and participants z1, z2, z3, z4, z5 and z8.
  - The integration server runs without the expiry sweeper, which only `main.ts:94` starts; an expired, unsubmitted Attempt therefore stays unsubmitted until the finalization submits it (x6).
  - Also: the School Operator O (no Teacher or Proctor assignment), Proctor P of E1's room, Homeroom Teacher H of X, actor A.
- **Tenant 2:** Teacher T9 with its own exam.

**Golden content G** (display order; total maximum 22):

| No | Type (code) | Max | Key |
|---|---|---|---|
| 1 | Single choice (PG) | 2 | B |
| 2 | Multiple response (PGK) | 3 | {A, C} |
| 3 | True/false (BS) | 1 | true |
| 4 | Matching (MJ) | 4 | L1→R2, L2→R1, L3→R4 (R3 a distractor) |
| 5 | Ordering (UR) | 2 | I2, I3, I1 |
| 6 | Numeric (IA) | 2 | 2,5 ± 0,1 (inclusive) |
| 7 | Short answer, automatic (IS) | 1 | accepted form "Jakarta" |
| 8 | Short answer, manual (IS) | 2 | no accepted forms (006 D1) |
| 9 | Essay (ES) | 5 | rubric "Sebutkan dua alasan." |

**Participants of E1** (z1, z2, z3, z4, z5 and z8 of TM-G copy x1, x2, x3, x4, x5 and x8; F5). Item outcomes are listed for items 1 to 9: C CORRECT, I INCORRECT, U UNANSWERED, G GRADED, P UNGRADED (pending).

| Who | Answers and grades | Per-item outcomes (FINAL) | Expected totals (FINAL) |
|---|---|---|---|
| x1 | Every item correct; T1 grades 8 = 2 and 9 = 5 | C C C C C C C G G | raw 22, max 22, scaled 100; correct 7, incorrect 0, unanswered 0, graded 2, ungraded 0 |
| x2 | 1 B; 2 {A}; 3 false; 4 one pair wrong; 5 I3, I2, I1; 6 "2,6" (inclusive bound); 7 "  jakarta "; 8 "Monas" graded 0; 9 graded 2,5 | C I I I I C C G G; points 2, 0, 0, 0, 0, 2, 1, 0, 2,5 | raw 7,5, scaled 34,09; correct 3, incorrect 4, unanswered 0, graded 2, ungraded 0 |
| x3 | The O02-2 empty writes, each an accepted versioned write: 2 `[]`, 4 empty pairs, 5 `[]`, 6 "", 7 "", 8 "", 9 "". Item 1 is never answered (v1 cannot clear). Item 3 is saved as `{"value": "true"}`: the save is refused 400 `invalid_answer_payload`, then fixture SQL stores that string value. The stored value of x3 and z3 is a planted test input only; no product path can write it | U U U U U U U U U | raw 0, scaled 0; unanswered 9. Zero, not absent |
| x4 | 2 {A, C}; 6 "2,61" (outside the bound); 7 "   " (whitespace only); 9 text, graded 4 only in G-3 | U C U U U I I U G | provisional: 9 P, raw 3, scaled 13,64, ungraded 1. FINAL: raw 7, scaled 31,82; correct 1, incorrect 2, unanswered 5, graded 1 |
| x5 | Never starts | none | provisional NOT_STARTED, FINAL ABSENT; no score, no `items`, empty CSV cells |
| x6 | Starts, saves 1 B, time expires unsubmitted (fixture timer) | C U U U U U U U U | finalization inserts `EXPIRY_SERVER`; raw 2, scaled 9,09; correct 1, unanswered 8 |
| x7 | Still running after END; then submits 3 true | U U C U U U U U U | first finalize refused `attempts_running` `{running: 1}`; FINAL raw 1, scaled 4,55; correct 1, unanswered 8 |
| x8 | 1 A; 3 omitted; 4 two of the three pairs (incomplete); 7 "Bandung"; 8 "   " and 9 "   " (whitespace only), each graded 0 in G-3; 2, 5 and 6 omitted | I U U U U U I G G | provisional: 8 P and 9 P, ungraded 2. FINAL: raw 0, scaled 0; correct 0, incorrect 2, unanswered 5, graded 2 |

**Readings behind the F5 rows** (delivered behaviour, not new rules):
- an empty value of PGK, MJ, UR, IA, IS and ES scores UNANSWERED (O02-2; `multiple-response.ts:85`, `ordering.ts:84`, `numeric-answer.ts:91`, `short-answer.ts:103`, `essay.ts:79`);
- an incomplete matching answer is accepted on save and scores UNANSWERED (`matching.ts:110`, ASSESS-QUESTION-004 D1);
- a true/false value that is not a boolean is refused on save and, if stored anyway, scores UNANSWERED without coercion (O02-4; `true-false.ts:38`, :44);
- only "" is empty for IS and ES: whitespace-only text is valid text (`isShortText`, `isEssayText`, `shortTextOf`, `essayTextOf`). An automatic IS item then normalizes to "" and matches no accepted form, so it is INCORRECT; a manual IS or ES item is answered, listed in the worklist and UNGRADED until graded.

Every scaled value follows `scaleToHundred` half-up (34,0909 → 34,09; 13,636 → 13,64; 31,818 → 31,82; 9,0909 → 9,09; 4,5454 → 4,55).

| # | Case | Expected |
|---|---|---|
| G-1 | Provisional, taken first: E1 ENDED, **x7 still running**, x1 and x2 graded, x4 and x8 not | `scoring` `{rule: COMPOSITE_PER_ITEM_V1, available: true, questionCount: 9, maxScore: 22, autoScoredCount: 7, essayCount: 2}`; `questions` PG 2, PGK 3, BS 1, MJ 4, UR 2, IA 2, IS 1, IS 2, ES 5; x1, x2, x3 as the table; x4 and x8 provisional; x5 NOT_STARTED; x6 and x7 IN_PROGRESS with no score and no `items` (x6 expired but unsubmitted, the sweeper being off); the §4.3 sum and count invariants on every scored row |
| G-2 | Finalize refusals, in this order | 1. With x7 still running: `attempts_running` `{running: 1}`; the transaction rolls back, including the `EXPIRY_SERVER` insert for x6.<br>2. x7 submits item 3 true.<br>3. Finalize again: `grading_incomplete` `{ungraded: 3}` (x4 item 9, x8 items 8 and 9).<br>Each refusal writes nothing (N08 counts) |
| G-3 | Grade x4 and x8, then finalize | T1 grades x4 item 9 = 4 and x8 items 8 = 0 and 9 = 0 (revision 1 each); finalize 200 with the EXAM_TRANSITION audit; one finalization `COMPOSITE_PER_ITEM_V1`, `question_count` 9, `max_score_micro` 22 000 000, `pending_issues` `[]`; x6 gets `EXPIRY_SERVER`; `item_outcomes` per row carry `ruleId` of each type, `selectedOptionId` only on item 1 and `gradeRevision` on GRADED items equal to the 0061 revision |
| G-4 | FINAL read | equals the table; FINAL `items` equal the frozen outcomes; `summary` `{participants: 8, notStarted: 1, inProgress: 0, submitted: 7}`; rows ordered by ELLIGBLE ID |
| G-5 | Idempotent finalization | a second finalize gives `changed: false` and a NO_OP audit; one finalization row, one FINALIZED lifecycle event |
| G-6 | Teacher-managed equivalence | TM-G gives the same per-item outcomes, points, counts and totals for z1, z2, z3, z4, z5 and z8 as for x1, x2, x3, x4, x5 and x8, while ACTIVE (provisional, E6 not applicable) and after finalization |
| G-7 | All-v1 regression | E2 (two PG) finalizes with `BASELINE_SINGLE_CHOICE_V1` and `item_outcomes` exactly as before (`selectedOptionId`, no `ruleId`); its `questions` are PG, PG |
| I-1 | Per subject (O05-1) | T1 finalizes E1 while E2 stays ENDED; T2 finalizes E2 later. No response sums E1 and E2. O's session view shows E1 "FINALIZED" and E2 "ENDED" with no score key |
| I-2 | Running refusal (E6, E7) | E1 ACTIVE, then PAUSED: T1 on results GET, export POST csv and print, essays GET and grade POST gets 409 `institution_exam_running` with `currentState`; no audit row, grade revision or other write. TM-G ACTIVE: 200 as today |
| I-3 | After END | E1 ENDED: all four routes answer 200 for T1 |
| I-4 | Wrong subject (N03) | T2 on E1 and T1 on E2: 403 on results GET and POST, essays, grade and finalize, byte-identical with a nonexistent id, zero mutation; a revoked T1 gets 403 |
| I-5 | Roles (N01, N04) | anonymous 401; O, P, H, x1, actor A and T9 get 403 on the five routes for E1 and TM-G; O's projections carry none of the §4.8 A10 keys |
| I-6 | Combined roles (P03) | a person who is both O and T1 reads and finalizes E1 as Teacher; as O alone (T1 assignment revoked) 403 |
| I-7 | Minimization (N05, F3) | • **Results, export, grade receipt and finalize receipt:** none carries `fullName`, `name`, `nis`, `nisn`, `birthDate`, `prompt`, `options`, `correct`, `acceptedForms`, `tolerance`, `rubric`, `essayText` or `shortText` keys, or any answer text.<br>• **Worklist:** it shows prompt, rubric and answer text to the grader by design (`essay-grading.ts:194–202`, asserted at `essay.test.ts:183–185`), so only the identity keys `fullName`, `name`, `nis`, `nisn` and `birthDate` are asserted absent; the ELLIGBLE ID is its only identity field |
| K-1 | Grade and finalize, both orders | a grade holding the exam FOR KEY SHARE makes finalize wait; finalize then sees the grade. Finalize first: the waiting grade sees FINALIZED and gets `invalid_state`; no revision written |
| K-2 | Two finalizations at once | one 200 `changed: true`, the other NO_OP; one finalization row |
| K-3 | Finalize and submit | x7's submit waits on the exam lock held by a finalize that counted x7 running; finalize answers `attempts_running` and rolls back; the submit then succeeds. In the opposite order finalize succeeds with x7 SUBMITTED |
| K-4 | Finalize and the expiry finalizer | an expired x6 gets exactly one submission whichever commits first (`ON CONFLICT DO NOTHING`); the FINAL row matches |
| K-5 | Export and finalize | an export key issued while PROVISIONAL, retried after finalization, gives `export_data_changed`; a new key exports FINAL; the digest of the issued event matches its projection |
| K-6 | Concurrent grades | two revisions of one answer with the same expected revision: one 200, one `stale_grade` |
| T-1 | Append-only | UPDATE and DELETE on both 0045 tables and on 0061 are refused |
| T-2 | Frozen against later writes (D04.8-20, F4) | After G-3:<br>• a grade POST gives `invalid_state`;<br>• then, by fixture SQL with `trg_prevent_snapshot_mutation` disabled and re-enabled: an answer update, a key change of item 1, item 1's `maxScore` changed from 2 to 10, and the `display_order` of items 1 and 2 swapped; plus an extra grade revision for x2 item 9.<br>**Expected:** the FINAL response (`questions` order, codes and maxima; every row's `items`, counts and totals; `scoring.maxScore` 22), the CSV header and every CSV row are byte-identical to before. A PROVISIONAL read is not taken: the exam is FINALIZED |
| X-1 | Full-type CSV | FINAL E1 file:<br>• header: columns 1 to 19 as today, then "Soal 1 (PG, maks 2)", "Soal 2 (PGK, maks 3)", "Soal 3 (BS, maks 1)", "Soal 4 (MJ, maks 4)", "Soal 5 (UR, maks 2)", "Soal 6 (IA, maks 2)", "Soal 7 (IS, maks 1)", "Soal 8 (IS, maks 2)", "Soal 9 (ES, maks 5)";<br>• x2 ends with "7,5;22;34,09;COMPOSITE_PER_ITEM_V1;2;0;2;0 (salah);0 (salah);0 (salah);0 (salah);2;1;0 (dinilai guru);2,5";<br>• x3's nine cells are "0 (tidak dijawab)";<br>• x4's cells are "0 (tidak dijawab);3;0 (tidak dijawab);0 (tidak dijawab);0 (tidak dijawab);0 (salah);0 (salah);0 (tidak dijawab);4";<br>• x8's cells are "0 (salah);0 (tidak dijawab);0 (tidak dijawab);0 (tidak dijawab);0 (tidak dijawab);0 (tidak dijawab);0 (salah);0 (dinilai guru);0 (dinilai guru)";<br>• x5 ends with 21 empty cells after "Tidak mengerjakan".<br>The provisional file of G-1 shows "Belum dinilai" in x4's column for item 9 and in x8's columns for items 8 and 9, and empty per-question cells for x6 and x7 |
| X-2 | Spreadsheet safety | a subject label "=HYPERLINK(...)", a rombel "X; IPA "1"" and an ELLIGBLE ID starting with "-" are quoted or prefixed as today, in fixed and per-question columns alike; BOM, CRLF and the semicolon separator are kept |
| X-3 | Print | the print export is audited ISSUED and the printed screen is unchanged |
| R-1 | Regression | every existing suite passes with only the §4.7 change |

## 6. Exact proposed file scopes (to be frozen at READY)

| # | Path | Purpose |
|---|---|---|
| 1 | docs/production/tasks/RESULT-004.md | Contract, history, evidence (Task-flow) |
| 2 | docs/production/TASK_PLAN.md | Status, counters, ASSESS-ROOM-001 landing (Task-flow) |
| 3 | docs/production/PRODUCTION_COMPLETION_PLAN.md | Status and continuity (Task-flow) |
| 4 | docs/DOCUMENT_MANIFEST.md | Index (Task-flow) |
| 5 | docs/production/CBT_DOMAIN_RULES_SPECIFICATION.md | Appended pointer to the RS-1 to RS-3 decisions |
| 6 | runtime/secure-assessment/src/teacher-results.ts | E6 refusal; `questions` and `items` (E8) |
| 7 | runtime/secure-assessment/src/essay-grading.ts | E7 refusal on the worklist and the grade write |
| 8 | runtime/secure-assessment/src/server.ts | 409 `institution_exam_running` on the four routes |
| 9 | frontend/web/src/types/assessment.ts | Optional `questions` and `items` |
| 10 | frontend/web/src/lib/results-export.ts | Per-question columns (E9) |
| 11 | frontend/web/src/components/TeacherResultsView.tsx | Refusal states and copy, focus, wrapping (§4.5, E12) |
| 12 | frontend/web/src/components/TeacherEssayGradingView.tsx | Refusal states and copy, focus, wrapping (§4.5, E12) |
| 13 | runtime/secure-assessment/test/complete-results.test.ts | Units (new) |
| 14 | runtime/secure-assessment/test/integration/complete-results.test.ts | §5 and §4.8 on real PostgreSQL (new) |
| 15 | frontend/web/src/__tests__/completeResults.test.tsx | Screens, copy, focus, CSV (new) |
| 16 | e2e/tests/99l-complete-results.spec.ts | Five-browser journey and captures (new) |
| 17 | e2e/tests/5-lifecycle.spec.ts | §4.7 only |

Rows 1–4 are Task-flow paths. The allowlist is rows 5–17, 13 paths, fixed by the Owner's RS-1 to RS-3 answers. No row depends on an open point.

**Forbidden:**
- every other file, including:
  - runtime: `scoring.ts`, `result-finalization.ts`, `question-contract.ts`, `question-types/*`, `exam-lifecycle-operations.ts`, `permission-action-audit.ts`, `managed-exam.ts`, `teacher-readiness.ts`, `institution-exams.ts`, `school-exam-monitoring.ts`, `submission.ts`, `answer.ts`;
  - frontend: `TeacherReadinessView.tsx`, `api/assessment-client.ts`, `App.tsx`, `lib/status.ts`, `lib/format.ts`, the `ui/` primitives, `hooks/`;
  - tests: `helpers.ts`, `global-setup.ts`, and every existing spec and test other than row 17;
- completed Task records;
- migrations;
- lockfiles, dependencies and workflows;
- production resources.

## 7. Acceptance gates (DEFINED / NOT EXECUTED)

| Gate | Expected outcome |
|---|---|
| C01 | Units:<br>• the content key to type code map for all eight keys and the manual short answer;<br>• the frozen `ruleId` to type code map, including an entry without `ruleId`;<br>• the item projection from a provisional baseline score, a provisional composite score and frozen outcomes, matched by `questionSnapshotId`, with the §4.3 micro-point sum and count invariants;<br>• the E6/E7 predicate over every lifecycle state and both exam kinds;<br>• `buildResultsCsv`: the per-question header and every cell string of the E9 table (CORRECT, INCORRECT, UNANSWERED, GRADED above 0 and with 0, UNGRADED, no score), the throw on an outcome outside the closed set, the formula guard, and a response without `questions` |
| C02 | Real PostgreSQL golden vectors G-1 to G-7, for E1 and TM-G, with every value of §5 exact |
| C03 | Real PostgreSQL, through the production-wired server: I-1 to I-7 and every N-id of §4.8, with before/after counts for every refusal. Covers V09 and V11 |
| C04 | Real PostgreSQL concurrency and tamper: K-1 to K-6, T-1 and T-2, each race with a 5 s bound and no 40P01 |
| C05 | Regression with only the §4.7 change: every runtime, web and E2E suite unchanged and passing |
| C06 | Client:<br>• both screens' refusal states and copy (403, `institution_exam_running`, export and save refusals), with no em dash;<br>• focus after "Perbarui Data", "Unduh CSV", "Cetak" and "Simpan Nilai" settle, success and failure: restored when it was on BODY, never left on BODY, and left alone when the user moved it elsewhere;<br>• the wrapping classes;<br>• X-1 and X-2 on the client builder;<br>• unchanged rendering for a response without the new fields |
| C07 | Five-browser E2E (`99l`). pengawas.e2e is the School Operator; guru.e2e is the subject Teacher.<br>Journey:<br>• the Operator places Matematika × X-E2E in a session; guru.e2e imports a v2 file with G through "Siapkan Soal Ujian Sekolah"; the deadline and window are set by fixture SQL; the Operator opens the exam;<br>• one Student answers all nine items through the exam screen; a second saves through its own signed-in page (the 99f pattern); the others stay absent;<br>• while the exam runs, guru.e2e (from the "Ruang kerja" navigation) sees the running line and no "Lihat Hasil" or "Nilai Esai", and an in-page request to results and essays gets 409 `institution_exam_running`;<br>• the Operator ends the exam; guru.e2e opens "Lihat Hasil" (provisional, "Belum dinilai"), tries "Finalisasi Hasil" (refused with the `grading_incomplete` copy), grades the essay and the manual short answer in "Nilai Esai", finalizes with a reason, and opens the FINAL results;<br>• "Unduh CSV" gives a file with the 19 fixed columns, the nine E9 headers of G and the E9 cell strings for its two Students, empty cells for the absent ones; "Cetak" is issued;<br>• the Operator's session view shows "Hasil Final" and no score; an in-page Operator request to results gets 403.<br>Shared helpers and the in-app refresh only, never a browser reload |
| C08 | Rendered evidence (`workspace-complete-results-*`):<br>• **Baseline:** the five `workspace-visual-*` artifacts of the post-merge `main` CI of ASSESS-ROOM-001, fetched with the resumable, size- and `unzip -t`-checked transfer; manifest recorded at READY.<br>• **After:** provisional results with "Belum dinilai", FINAL results with scores shown, the institution grading screen, and the Teacher card's refused finalization.<br>• **Conditions:** widths 360, 390, 430, 768, 1024, 1280, 1440 and 640×360, and 200 % text at 390×844 and 1280×800 with the 99k single-pass calibration.<br>• **Pass criteria:** no page overflow; targets ≥ 44 px; focus never on BODY; buttons and badges wrap; rendered review PASS.<br>• **Earlier captures:** pixel-identical except times and IDs; a difference caused by the E12 wrapping classes is recorded and reviewed.<br>• **Budget:** at most five scenarios |
| C09 | Scope inside rows 1–17; 33 Tasks and 78 edges; exact-SHA attempt-1 eight-job CI; no re-run |
| C10 | Independent contract, implementation and rendered review PASS. The reviewer's contract approval, which is also the A01 reviewer half and, by the Owner's answer of §3.1, the O02 and O05 reviewer half, is anchored to the registration commit SHA; Delegated Acceptance; evidence commit; delegated merge |

**CI-first order,** as ASSESS-ROOM-001 §7:
1. Registration, carrying the ASSESS-ROOM-001 landing and the baseline manifest.
2. Implementation, whose exact-SHA CI passes before review.
3. Implementation and rendered review.
4. Delegated Acceptance and the evidence commit.
5. PR-head CI, the delegated squash merge, then post-merge main CI.

No re-runs, and no push while the previous commit's CI runs. Integration and E2E run in CI only (8 GB workstation).

**Honest limits and risks:**
- **R1, no item remedy** (RS-3, O02-10): CBT-R1 has no way to void an item or give full credit. If a key is found wrong after the exam opened, the results are still computed from the frozen snapshot, before and after finalization, and a finalized result cannot be corrected. Any remedy needs a later governed workflow (D04.8-24 to D04.8-32).
- **R2, varying column count** (RS-1): files of exams with different question counts align only in columns 1 to 19 when merged.
- **R3, export digest:** an export key issued before deployment and retried after it gets `export_data_changed` (E10).
- **R3a, a builder failure after the audit:** the CSV is built on the client after the export intent is already audited as ISSUED. An outcome outside the closed set (E9) makes the builder throw, so an ISSUED audit row exists with no file. This matches today's client-side failures (a download or print that fails after the intent), and no production path produces such an outcome (C01).
- **R4, raw-SQL grade after finalization** shows in the read-only worklist; results and CSV stay frozen (E11). No product path writes it.
- **R5, no early view for institution exams:** the subject Teacher sees no provisional result and cannot grade until the Operator ends the exam (E6, E7).
- **R6, print stays totals;** scores hidden on screen print hidden, as today.
- **R7, PB05 stays OPEN;** G7 still bars real student data.
- **R8, E2E budget:** 99h to 99k already run long; 99l is bounded to five capture scenarios, recorded at READY.
- **R9, preview copy** still says "guru yang mengelola ujian ini" (outside this scope).
- **R10, the CSV holds scores** and leaves the server; the existing on-screen notice stays.

## 8. History

- **2026-11-11, contract drafted** under DEC-048 on 1b53171 (task/assess-room-001, code equal to `main` after ASSESS-ROOM-001 lands), while ASSESS-ROOM-001 was VERIFYING.
  - Approved inputs: O02-1, O02-2, O02-9, O02-10, O05-1, O05-6 (boundary), A01-2, A01-3; ASSESS-QUESTION-008 D1 and D4; ASSESS-QUESTION-006 D1; OD-07, OD-07b, OD-09; D04.4-26D (LOCKED).
  - O05 "unresolved publication correction" recorded as settled (first by O02-10, O05-6 and P2:176; corrected by F8 to O02-10 and OD-09).
  - Open: RS-1 to RS-3, raised with recommended defaults.
  - No migration needed or reserved.
  - Not reviewed; NOT READY; BLOCKED.
- **2026-11-11, contract review 1 returned STOP** (F1–F9 and non-material notes, §9).
- **2026-11-10/11, Owner decisions in chat,** quoted in §3.1:
  - RS-1: "Kolom per soal di CSV (Recommended)", and for the cell format (F6): "Poin dengan keterangan (Recommended)".
  - RS-2: "Setelah ujian berakhir (Recommended)".
  - RS-3: "Tidak tersedia di CBT-R1 (Recommended)".
  - The O02/O05 reviewer half (F2): "Setujui (Recommended)".
- **2026-11-11, review 1 corrections applied** in this revision (§9).
  - Status: Owner decisions decided; review 1 STOP corrected; re-review pending; NOT READY; BLOCKED.
- **2026-11-11, contract review 2 returned PASS** (§9.2). Its four non-material notes were applied in this revision, with no further round. Status: contract review chain STOP → PASS; formal READY pending (§10); BLOCKED.

## 9. Independent contract review

### 9.1 Review 1: STOP

Review 1 was given by the standing Owner-designated read-only subagent reviewer, on the uncommitted first draft of this record (scratchpad copy; no SHA, since nothing is committed). The verdict was **STOP**, with nine material findings and non-material notes. Each finding and its correction:

| Finding | Evidence | Correction in this revision |
|---|---|---|
| F1, grading while running was left as an Owner choice | The worklist of a running institution exam shows who has submitted, which is the whole-exam progress D04.4-26D (LOCKED) denies, as E6 reads it for results | E7 is a reading of D04.4-26D, as E6 is. RS-2's answer confirms it; the alternative would have needed an explicit Owner reinterpretation; "anonymized grading while running" is recorded as not offered (§3.1, E7) |
| F2, the O02/O05 reviewer half had no basis | ASSESS-QUESTION-001:57 names the reviewer for A01/A04 only | §1 cites the basis used by earlier Tasks (ASSESS-QUESTION-001:10, ASSESS-QUESTION-008:10, ASSESS-ROOM-001:10) and the Owner's answer "Setujui (Recommended)" (§3.1); the :57 claim for O02 is removed; C10 |
| F3, the forbidden-key list contradicted the worklist | The worklist returns prompt, rubric and answer text by design (`essay-grading.ts:194–202`, `essay.test.ts:183–185`) | I-7 and N05 scope prompt, rubric and answer-text keys to results, export, grade and finalize receipts; the worklist is checked for identity keys only |
| F4, FINAL questions and maxima were read from mutable sources | Snapshot order and `maxScore` can be changed by raw SQL with the trigger disabled; the frozen maximum is `max_score_micro` (`result-finalization.ts:254`) | E8: FINAL items matched by `questionSnapshotId`; FINAL `questions` from the frozen order, `maxScoreMicro` and `ruleId`; exam maximum from `max_score_micro`. §4.3 invariants in micro-points. T-2 adds a `maxScore` and order tamper with a byte-identical expected result |
| F5, golden vectors missed outcomes | No INCORRECT PG or automatic IS, no O02-2 empties for PGK, MJ, UR, IA, no incomplete matching (`matching.ts:110`), no non-boolean or omitted BS, no whitespace-only IS or ES | x3 extended (O02-2 empties, non-boolean BS), x4 extended (whitespace-only automatic IS), new x8 (INCORRECT PG and IS, incomplete MJ, omitted BS, whitespace-only manual IS and ES); per-item outcomes and counts listed for every row; TM-G copies them (§5, G-6) |
| F6, a bare 0 in a per-question cell hid three meanings | Incorrect, unanswered and graded zero all read "0" | Owner answer "Poin dengan keterangan (Recommended)" (§3.1); exact cell strings in E9; §4.6 Distinctions; X-1 and the §4.7 change updated |
| F7, N05 missing on two rows | CBT_PERMISSION_MATRIX.md:131 lists N05 for A11 | §4.8 adds N05 to the grade POST and finalize rows |
| F8, the O05 correction reading leaned on P2:176 | P2:176 names withdrawal, not correction | §1 rests the reading on O02-10 and OD-09 (00.11:159); the P2:176 claim is dropped |
| F9, earlier "unchanged" readings were silently contradicted | ASSESS-INSTITUTION-001 E7 (:140) and ASSESS-INSTITUTION-003 E2 (:168) say results and grading are unchanged | E7a records that E6/E7 withdraw those readings for ACTIVE and PAUSED under D04.4-26D; the completed records are not edited |

**Non-material notes, all applied:**
- E12: focus is restored only when it is on BODY (C06).
- E14: the seventh X-E2E Student comes from `9-identity.spec.ts:227`; 99k counts seven at `99k-room-transfer.spec.ts:475`.
- G-1 and G-2 are ordered explicitly: G-1 with x7 running, G-2 refusing first on x7, then on ungraded items after x7 submits.
- x6 stays IN_PROGRESS in G-1 because the integration server runs without the expiry sweeper (`main.ts:94`; §5 fixture).
- R1 is reworded.
- E12 states that the default `Button` is already `h-11`, 44 px; the wrapping classes are for text wrap only.

**Status after review 1:** STOP corrected; targeted re-review by the same reviewer pending.

### 9.2 Review 2: PASS

- **Verdict:** PASS, by the same reviewer, on the uncommitted corrected revision of this record (scratchpad copy; no SHA yet). F1 to F9 are CLOSED, and there is no new material finding.
- **Cell strings:** the reviewer judged the E9 cell strings, including "0 (dinilai guru)", to be routine copy within the Owner's approved option "Poin dengan keterangan (Recommended)" (00.13 §5.1). No further Owner input is needed.
- **Reviewer halves:** this PASS is the A01 reviewer half and, by the Owner's answer of §3.1, the O02 and O05 reviewer half. It is bound to the reviewed content and is recorded against the registration commit SHA once that commit exists (C10).
- **Non-material notes, applied after the PASS with no further round:**
  1. A duplicate POST `teacher-exams/results` row in §4.8. On checking, §4.8 holds that route once; the second row is the §4.2 lock and placement row, which is kept.
  2. §4.7 now cites `5-lifecycle.spec.ts:522` for ";66,67;BASELINE_SINGLE_CHOICE_V1", and :521 for ";Dikumpulkan;Oleh siswa;".
  3. R3a: an unknown outcome makes the builder throw after the export intent is audited ISSUED, leaving an audit row with no file, as today's client-side failures do.
  4. §5 x3 records that the true/false value of x3 and z3 is planted by fixture SQL, a test input only and not a product path.
- **Status:** the contract review chain is STOP → PASS. Formal READY pending (§10).

## 10. Formal READY and Build start under DEC-048 — 2026-11-11

- **Eligibility (00.13 §4.1):**
  - Every internal dependency (ASSESS-QUESTION-002 to -008, ASSESS-INSTITUTION-001) is DONE. The previous Task, ASSESS-ROOM-001, landed by PR #39, main 0d5d4f997a62be1e1e67b1ebaa40e102c9d416ba, PR-head CI #257, post-merge main CI #258 (run 42969282367) attempt 1 eight SUCCESS.
  - O02, O05 and A01 inputs are approved in [ASSESS-QUESTION-001 §4](ASSESS-QUESTION-001.md); the open points are the Owner's RS-1 to RS-3 and the RS-1 cell format (§3.1); the reviewer half of O02/O05 is this Task's standing reviewer by the Owner's answer (§3.1), and A01 needs no schema here. O09 rests on P5.
  - No earlier-row or P0 Task is eligible (ASSESS-PROCTOR-003 waits on O08/A05).
- **Review chain:** STOP → PASS (§9).
- **Frozen allowlist:** §6 rows 5–17, 13 paths; rows 1–4 are Task-flow paths. No migration. No dependency, workflow or production resource.
- **Rendered baseline (step 1):** the five `workspace-visual-*` artifacts of exact-main CI #258 (run 42969282367, 0d5d4f9), fetched in parallel with the resumable, size- and `unzip -t`-checked transfer.
  - 4200 pairs (450 ASSESS-QUESTION-002, 200 -003, 225 -004, 200 -005, 325 -006, 225 -007, 425 -008, 950 ASSESS-INSTITUTION-001, 450 -002, 500 -003, 250 ASSESS-ROOM-001 `workspace-room-transfer-*`), all with frontend tree 572923ca5dc42ed4a9c713cdb61eedb7f8e774f0.
  - Every screenshot hash matches its JSON; zero overflow; zero targets under 44 px.
  - Manifest, built as in ASSESS-QUESTION-004 §10 over the `workspace-question-*`, `workspace-institution-*` and `workspace-room-transfer-*` captures: SHA-256 1f7b4598df8c46e2ec23d76291ac317f4a462808ff5f9a0e0c7146a0b635d22c.
- **CI-first order:** as frozen in §7. This registration is step 1. No re-runs, and no push while the previous commit's CI runs.
- **Status:** BLOCKED → IN_PROGRESS. Counters: DONE 18, IN_PROGRESS 1, VERIFYING 0, BLOCKED 14.

## 11. Implementation checkpoint — 2026-11-11

- **Registration CI:** CI #259 (run 42987509303, eec2e45) attempt 1 eight SUCCESS.
- **Candidate:** d062029; every changed path is in §6 rows 5–17 (13 paths, the frozen allowlist exactly); `5-lifecycle.spec.ts` changes only `(;){12}` to `(;){15}` (§4.7). No migration. Status IN_PROGRESS → VERIFYING.
- **Implementer departures, for the implementation review:**
  1. I-7 pins `score` to the eight delivered count keys and scans every other key for answer-key fields, stricter than a name list.
  2. 99l sets the deadline through the product rather than fixture SQL.
  3. The second Student saves by an in-page request on its own signed-in page (the 99f pattern of C07).
  4. 99l's `BASELINE` gains the #258 run and manifest at registration; `frontendTree` is unchanged.
  5. Additions: focus restore on "Muat Ulang" and "Coba Lagi"; a running refusal clears the screen (the stricter reading of D04.4-26D); `useFocusRestore` and `WRAPPING_BUTTON` are exported from `TeacherResultsView.tsx` and shared with the grading screen, since `hooks/` is outside the allowlist.
  6. T-2 proves the CSV unchanged through a byte-identical results JSON; `buildResultsCsv` is a pure function of it.
  7. `buildResultsCsv` also throws on a scored row without its item, as E9's closed-set defect handling.
- **RS-2 pointer wording:** the CBT_DOMAIN_RULES_SPECIFICATION line attributes the results and export refusal to the E6 reading of D04.4-26D, not to RS-2 (reviewer note).

### 11.0.1 Exact-content CI of d062029, e7607a6 and dbc1d66 (99l corrections)

- **CI #260 (run 42994036834, d062029):** attempt 1, FAILURE in the five E2E jobs only; runtime with real PostgreSQL, web and container SUCCESS, and every other E2E spec passed. 99l waited for "Kembali ke Pelaksanaan Ujian" after "Simpan Soal", which returns the Teacher to the exam list with its notice (as in 99h), and hung until the 45-minute test timeout.
- **Correction e7607a6** (row 16 only): the stale click is removed; every 99l page gets a 120 s default step timeout, so a missing control fails in minutes; the stored PGK selection is compared sorted, as the client stores it.
- **CI #261 (run 43006617433, e7607a6):** attempt 1, FAILURE in the five E2E jobs at the Operator's last step only (99l:704); the journey through grading, finalization, CSV and print passed in every browser. The "Ujian Sekolah" navigation is already active on "Pelaksanaan Sesi", so its click did not navigate.
- **Correction dbc1d66** (row 16 only): the Operator's session screen refreshes in place with its own "Perbarui", then shows "Hasil Final"; the in-app refresh only, never a browser reload (E14).

### 11.0.2 Exact-content CI of dbc1d66 and the entry focus (C08)

- **CI #262 (run 43011946196, dbc1d66):** attempt 1, eight SUCCESS. Its 200 `workspace-complete-results-*` pairs had no overflow and no target under 44 px (manifest SHA-256 8297dd9713d9d6542e1582624bd8ddf144e23c956ac140a8334addf8b6f33016), but focus was on BODY in all 50 `grading` captures: the "Nilai Esai" opener is gone after navigation.
- **Correction b86e1fe** (rows 11, 12, 15 and 16): `useEntryTitleFocus`, exported from `TeacherResultsView.tsx`, gives the screen title focus (`tabIndex=-1`) once the results or grading screen has first loaded or been refused, only when focus is on BODY or nowhere, in the layout phase so no input reaches the screen first (a passive effect let `essay.test.tsx` type before the focus move). Pattern of ASSESS-ROOM-001 §11.0.2. Two unit tests cover load, refusal and focus already elsewhere; 99l asserts the focused "Hasil Ujian" and "Penilaian Esai" titles.
- **Local checks** (8 GB executor; typechecks and targeted units only): web and e2e typecheck clean; web units 54/54 (completeResults, essay, short-answer, teacherResults). Runtime units, real-PostgreSQL integration and every E2E spec run in CI.

### 11.1 Reviews of the candidate

- **Implementation review by the same reviewer:** PASS on the d062029 working tree (departures 1–7 accepted, departure 4 conditioned on the `BASELINE` delta, checked and confirmed); CONFIRM of the 99l corrections e7607a6 and dbc1d66 and of the b86e1fe code change (scope rows 11, 12, 15 and 16).
- **Non-material notes recorded:** a CSV build defect (R3a) shows the existing generic export failure copy "Izin ekspor belum diterima" although the intent was audited ISSUED, and the kept key replays the same failure on retry; no production path produces such an outcome. `useFocusRestore` and `useEntryTitleFocus` live in a component file; moving them to `hooks/` belongs to a later UI-SYSTEM Task.
- **Rendered review by the same reviewer:** PASS on b86e1fe (CI #263 artifacts, all five browsers), with no material finding: the focused title without outline is acceptable (tabindex -1, not in the tab order; the ASSESS-ROOM-001 pattern), and keyboard focus rings show where they matter; grading, results and finalize-refused layouts are correct at 200 % text, with no page overflow and 44 px targets; the E12 wrapping differences are accepted. Limitation recorded: the two WebKit 200 % finalize-refused viewport captures do not show the target card (a later harness change should scroll the root into view before the viewport fallback). Non-material: the WebKit sticky header covers the top of full-page captures (a known capture artifact); the results back button centres its wrapped label at 200 % while the grading one is left-aligned, which predates this Task and goes to a UI-SYSTEM consistency Task.

## 12. Final evidence and Delegated Acceptance — 2026-11-11

### 12.1 Content and CI

**Final content:** b86e1fe3fc563a74072b2630b8b9d3c21d36f305. The registration was eec2e45. Every commit has the Owner as author and committer, with no trailers or AI/tool attribution.

**Exact-content CI:** CI #263 (run 43031767935), push, attempt 1, eight SUCCESS: runtime typecheck and units, real PostgreSQL 16 integration (G-1 to G-7, I-1 to I-7, every §4.8 N-id, K-1 to K-6, T-1 and T-2); web typecheck, tests and build; container build and smoke; every E2E spec in mobile-360, tablet-768, desktop-1280, firefox-1280 and webkit-390, including 4-results, 5-lifecycle, 99f, 99g and the 99l journey (C07) and captures (C08).

**Rendered evidence:** the five `workspace-visual-*` artifacts of run 43031767935, fetched in parallel with the resumable, size- and `unzip -t`-checked transfer: 200 `workspace-complete-results-*` pairs at b86e1fe (frontend tree 6851be1471d706593b43d6a844fe4d815c4aeb4d), 40 per browser over four scenarios (results-provisional, finalize-refused, grading, results-final); every hash matches; zero overflow; zero targets under 44 px; exact single-pass 200 % calibration, restoration and post-capture integrity; focus never on BODY (grading: the title, 50 of 50; the other scenarios: their button). The five WebKit finalize-refused captures are viewport-only (the 99h WebKit fallback): the three at 100 % text show the refused card; the two at 200 % text show neighbouring cards because the fallback does not scroll the capture root into view, so they are a recorded limitation, not visual evidence (their metrics on the right root pass, and the other four browsers render the card at 200 %). Manifest SHA-256 3032f91e5c3594cbde398d5250c5281a00ab0a639613a0f235bc361eb1f26413.

**Earlier captures** against the #258 baseline (5424 PNG pairs, none missing or extra): 2251 byte-identical; every other pair has the same accessibility snapshot once times, dates, durations and IDs are normalized. Dimensions change consistently in all five browsers only at 200 % text on the results and grading screens (es/is grading +40 px at 390×844 and +4 at 1280×800; es/is results +126 and +42; sec001 final results +57 at 360×780): the E12 wrapping classes, as C08 allows. The remaining dimension changes are single-browser full-page swings of the known kind.

**All runs, preserved without re-run:**

| Run | Result |
|---|---|
| CI #259 (eec2e45, registration) | attempt 1, eight SUCCESS |
| CI #260 (d062029) | attempt 1, FAILURE: 99l stale back click after saving (§11.0.1) |
| CI #261 (e7607a6) | attempt 1, FAILURE: 99l Operator navigation no-op at the last step (§11.0.1) |
| CI #262 (dbc1d66) | attempt 1, eight SUCCESS; captures showed the grading entry focus on BODY (§11.0.2) |
| CI #263 (b86e1fe) | attempt 1, eight SUCCESS |

### 12.2 Independent review (Owner-designated standing reviewer, also the A01 and O02/O05 reviewer half)

1. **Contract:** STOP, then PASS (§9).
2. **Implementation:** PASS, with CONFIRM of every correction (§11.1).
3. **Rendered:** PASS on b86e1fe (§11.1).

### 12.3 Acceptance gates

| Gate | Disposition |
|---|---|
| C01 | PASS: type-code maps, the item projection and its invariants, the E6/E7 predicate, `buildResultsCsv` with every E9 cell string, the closed-set throw, the formula guard and a response without `questions` (units) |
| C02 | PASS on real PostgreSQL (CI #263): golden vectors G-1 to G-7 for E1 and TM-G, every §5 value exact |
| C03 | PASS on real PostgreSQL through the production-wired server: I-1 to I-7 and every §4.8 N-id with before/after counts (V09, V11) |
| C04 | PASS on real PostgreSQL: K-1 to K-6, T-1 and T-2, each race within 5 s and no 40P01 |
| C05 | PASS: regression with only the §4.7 change; every runtime, web and E2E suite passing |
| C06 | PASS: refusal states and copy with no em dash; focus after "Perbarui Data", "Unduh CSV", "Cetak" and "Simpan Nilai" and on screen entry, never left on BODY; the wrapping classes; X-1 and X-2; unchanged rendering without the new fields |
| C07 | PASS: the five-browser 99l journey, from the running refusals through grading, finalization, the per-question CSV and print to the Operator's "Hasil Final" without scores and 403 |
| C08 | PASS: the #258 baseline and the after captures; no overflow; 44 px; focus never on BODY; wrapping; earlier captures change only by times, IDs, the E12 wrapping and known full-page swings; four scenarios; rendered review PASS |
| C09 | PASS: every changed path within §6 rows 1–17; 33 Tasks and 78 edges; exact-SHA attempt-1 eight-job CI with no re-run |
| C10 | PASS: review chains PASS; the reviewer's contract approval is the A01 and O02/O05 reviewer half, anchored to eec2e45; Delegated Acceptance below |

### 12.4 Delegated Acceptance (DEC-048, 00.13 §5.4)

Every gate C01–C10 has PASSED with recorded evidence, and the independent contract, implementation and rendered reviews PASSED on the final content SHA. RESULT-004 is accepted under DEC-048 and is DONE under 00.12 §5. The Owner may reopen it at any time.

**Residual risks and limits:** R1 to R10 of §7 stand, including no item remedy after opening (RS-3), the varying CSV column count (RS-1), the export digest change for keys issued before deployment, the builder failure after the audit (R3a, with the copy noted in §11.1), and no early view of institution results (E6, E7). PB05 and PB12 are OPEN. G7 comes before real data. There is no deployment or release claim.

**Landing:** a delegated squash merge under 00.13 §6, after PR-head CI on this evidence commit shows eight SUCCESS on attempt 1, followed by post-merge main CI. DONE 19/33 (57.58%) after the merge.
