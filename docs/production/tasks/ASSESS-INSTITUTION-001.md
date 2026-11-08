# ASSESS-INSTITUTION-001 — Institution organizer, subject and session composition

## 1. Control state and authority

| Field | Disposition |
|---|---|
| Classification | Active P11 Task; P1 / school-scale exam governance; HIGH risk; R20, R21; P8 V07, V10, V11, V12 |
| Status | **VERIFYING — Owner decisions taken (§3.1); contract review chain STOP → PASS (§9); formal READY PASS (§10); implementation candidate published for exact-content CI and the independent implementation and rendered review (§11)** |
| Objective | The School Operator composes an institution exam period:<br>• an exam period with sessions (a date and a time slot);<br>• in each session, one ExamInstance per subject × rombel, each bound to one teaching assignment;<br>• a preparation deadline per ExamInstance.<br>The assigned subject Teacher prepares the content through the existing import path before the deadline. After the deadline the content is locked. The Operator can extend a deadline with reason, confirmation and audit, but never edits content or sees answer keys. Teacher-managed exams are unchanged |
| Owner decisions | O05-1, O05-2 and A04-1, approved 2026-11-07 ([ASSESS-QUESTION-001 §4](ASSESS-QUESTION-001.md)); OD-07 and OD-07b (00.11 §12); **OP-1–OP-9 (recommended defaults, with OP-2 asked explicitly) and the authority boundary OB-1, decided by the Owner on 2026-11-09 (§3.1)**. Reviewer: the standing Owner-designated read-only subagent reviewer, a fresh one for this Task |
| Execution authority | DEC-048 (00.13).<br>• Internal dependency SEC-001 is DONE / MERGED (PR #19, 89d725c).<br>• The previous Task, ASSESS-QUESTION-006, is DONE / MERGED by PR #34 as main e031d31949972fd501946dd231f2bd1a45e247b5; its PR-head CI and post-merge main CI #219 are recorded from GitHub in this Task's first change.<br>• O05 (O05-1, O05-2) and A04 (A04-1) are approved; O09 rests on the approved P5 content. The institution composition that P5 left to O05 (CBT_PERMISSION_MATRIX.md:96, :142) is settled for this scope by the Owner's authority boundary OB-1 (§3.1, risk R1).<br>• READY still needs the independent contract review PASS (00.13 §4.3) |
| Base and branch | main e031d31; branch task/assess-institution-001; worktree `C:\Projects\ELLIGBLE-institution-001` |
| Parallel safe / cost | No parallel baseline Task; no dependency, vendor, service or cost |

**Authority:**
- **Governance:** [DEC-044](../../00-governance/00.11_CBT_RELEASE_SCOPE_REALIGNMENT.md) (OD-07 :156, OD-07b :157), [DEC-045 §5](../../00-governance/00.12_AICWDF_ADOPTION_AND_TASK_EXECUTION.md) and [DEC-048](../../00-governance/00.13_STANDING_EXECUTION_DELEGATION.md).
- **Plan and rules:**
  - [TASK_PLAN ASSESS-INSTITUTION-001/§4/§8](../TASK_PLAN.md) (O05, O09, A04);
  - [P2 §5 and rows R20/R21](../CBT_DOMAIN_RULES_SPECIFICATION.md) (:73–77, :116–117);
  - [CBT_PERMISSION_MATRIX](../CBT_PERMISSION_MATRIX.md) A03 (:32, :102), A04 (:33, :103), A10 (:39, :109), A11 (:40, :110), P01–P03 (:84–88);
  - [ROUTE_INTERACTION_MATRIX](../ROUTE_INTERACTION_MATRIX.md) F06 (:51), W07 (:28), W08 (:29), W10 (:31).
- **Earlier records:** [ASSESS-QUESTION-001 §4](ASSESS-QUESTION-001.md) (the decision text); [ADMIN-001](ADMIN-001.md) (the School Operator authority pattern); [ASSESS-QUESTION-008](ASSESS-QUESTION-008.md) (the record layout and the append-only revision pattern).
- **Locked decisions and schema:** D04.4-26A (teacher-managed exams, unchanged); D04.4-26D/E and OD-07b (institution-managed exams); migrations 0003, 0037, 0048, 0052 and 0054, which stay unchanged.

No LOCKED decision or PB status changes. OPEN-05 (participant removal) stays OPEN and is not touched.

## 2. Reuse and bounded gaps

**Reused:**
- the ExamInstance and its lifecycle, readiness checks, window, duration and late-start invariants (`exam-lifecycle-operations.ts` `evaluateExamReadiness`, the readiness preflights);
- the participant rule "students enrolled in the rombel on the exam day" (`exam-provisioning.ts:233–251` `listEnrolledStudents`) and the overlap conflict query of the import (`teacher-exam-import.ts:416–430`);
- the question parser, the frozen-content builders, the import batch, the file SHA-256 and the import key (`question-import.ts`, `exam-provisioning.ts:168–183`, migration 0048);
- the IMPORT audit event of the shared permission wrapper (`permission-action-audit.ts`), `normalizePermissionReason` (:45–49) and `permissionDigest` (:65–67);
- the School Operator assignment check (`tenant-access/src/school-operator.ts:7–12`), as the roster import uses it (`roster-import.ts:16–30`);
- the cancellation archive (migration 0052 and the lifecycle event with `cancellation_id`, 0052:56–60);
- the managing-teacher authority (`managed-exam.ts`) for content, preview, essays, results and finalization;
- the shared `Page`, `Card`, `Dialog`, `Input`, `NativeSelect`, `Button`, `StatusBadge`, `ExamListCard`, `ActionReasonField` and `permissionDialogClass` primitives, and the shared E2E helpers.

**Gaps closed:**
- there is no exam period, session or preparation deadline;
- an ExamInstance cannot exist without questions (`exam-provisioning.ts:263`), so there is no way to place a subject before its content exists;
- the existing import always creates a new exam (`teacher-exam-import.ts:441`); it cannot fill an exam the Operator created;
- every teacher-managed control follows the teaching assignment alone (`managed-exam.ts:35–43`, `exam-lifecycle-operations.ts:101–116`), so the subject Teacher of an institution exam would otherwise hold organizer powers that OD-07b and O05-3 give to the School Operator;
- the School Operator has no exam workspace.

**Excluded:**
- open, pause, resume and end of institution exams, the session-wide shortcut, and Operator lock, unlock, messages and added time (O05-3: ASSESS-INSTITUTION-002/003);
- rooms, room assignments, Proctor assignments and participant changes after placement (ASSESS-INSTITUTION-002);
- Operator drill-down and monitoring (ASSESS-INSTITUTION-003);
- room transfer (O05-4, O05-5: ASSESS-ROOM-001);
- totals across subjects (O05-1: none in CBT-R1) and institution reporting (RESULT-004);
- participant removal (OPEN-05);
- any change to teacher-managed exams other than the refusals of §4.5, which apply only to institution exams.

## 3. Settled inputs, Owner decisions and engineering readings

**Approved before this Task (quoted from [ASSESS-QUESTION-001 §4](ASSESS-QUESTION-001.md)):**
- **O05-1:** "An exam period is organized by the School Operator. Each subject × rombel group is one existing ExamInstance, bound to one teaching assignment, placed in a session (date and time slot). Finalization happens per subject ExamInstance, by its subject Teacher. There is no total across subjects in CBT-R1 (an assessment result is not an official grade)."
- **O05-2:** "The School Operator sets a deadline for each ExamInstance. Content is locked after the deadline. The Operator can extend it with reason, confirmation and audit, but never edits content or sees answer keys."
- **A04-1:** "New period and session tables owned by Secure Assessment, plus a nullable session reference on ExamInstance. Teacher-managed exams are unchanged. Rooms stay per ExamInstance, and the UI writes one room row per ExamInstance for each physical room." The room part belongs to ASSESS-INSTITUTION-002.
- **OD-07b:** the School Operator organizes institution-managed exams: "schedule and sessions, rooms, participants by rombel, proctor assignment, readiness, open, pause and end"; "Subject teachers prepare and preview the questions before a deadline, grade essays and finalize the results of their subject."
- **OD-07:** high-risk actions are one actor with mandatory reason, explicit confirmation and audit; the School Operator has no score edits, grading or cheating verdicts.
- **P5:** A10 (:109) reads "operational roster/readiness/assignment data" for the Operator, "No Operator keys, scores, grading, score edits"; P01 (:84) permits only listed data groups; P02 (:86) keeps R/C/A for high-risk actions and forbids blanket high-risk treatment of ordinary saves; P03 (:88) evaluates combined roles per assignment.
- **P2 §5 (:77):** reuse the lifecycle semantics; pre-open cancellation archives and never deletes; no lifecycle rewrite.
- **Out of scope by decision:** O05-3 (Operator running-exam controls; "Teachers and Proctors cannot pause or end institution exams") is implemented by ASSESS-INSTITUTION-002/003. This Task only keeps the subject Teacher from those controls (§4.5).

### 3.1 Owner decisions on the open points (decided 2026-11-09 in chat)

The Owner answered one consolidated package, quoted verbatim:
- **OP-1 to OP-9:** question "ASSESS-INSTITUTION-001 (susunan ujian sekolah oleh Operator): setujui semua default OP-1 sampai OP-9?"; options "Setujui semua default (Recommended)" and "Tinjau satu per satu". The Owner chose **"Setujui semua default (Recommended)"**. Every recommended default (A) below is decided.
- **OP-2, explicitly:** question "OP-2: bolehkah guru mengunggah ulang soal sebelum tenggat, dengan soal lama ujian yang belum pernah dibuka dihapus (riwayat unggahan tetap tercatat)?"; options "Boleh, ganti seluruhnya (Recommended)" and "Tidak, sekali unggah". The Owner chose **"Boleh, ganti seluruhnya (Recommended)"**.
- **OB-1, the authority boundary** that P5 left to O05 (CBT_PERMISSION_MATRIX.md:96, :142): question "Batas wewenang (P5 dulu menyisakan susunan O05): Operator boleh membuat periode/sesi, menempatkan ujian, mengatur dan memperpanjang tenggat, menandai siap, membatalkan, tanpa melihat isi soal/kunci; guru kehilangan siap/buka/jeda/akhiri/ubah jadwal/batal untuk ujian sekolah. Setuju?"; options "Setuju batas ini (Recommended)" and "Tunda, perlu dibahas". The Owner chose **"Setuju batas ini (Recommended)"**.

The points as they were put, with the rationale:

O05 and A04 did not settle the points below, and each changes what users see or what data is kept. They were put in Bahasa Indonesia, with the recommended default first. The Owner decided the recommended default (A) of every point, and this contract implements exactly those defaults.

- **OP-1. Pembuatan ujian per mata pelajaran dan masuknya soal.** "Siapa yang membuat ujian per mata pelajaran × rombel, dan bagaimana soal guru masuk ke ujian itu?"
  - **A (Recommended):** "Operator membuat ujian kosong di sesi, terikat ke satu penugasan mengajar. Guru mata pelajaran mengunggah berkas soal langsung ke ujian itu (periksa, lalu simpan), dengan templat dan pemeriksaan yang sama seperti sekarang."
  - B: "Guru membuat ujian seperti biasa, lalu Operator memasukkannya ke sesi."
  - C: "Operator membuat ujian kosong; guru memilihnya dari layar Buat Ujian yang sekarang."
  - *Rationale:* A keeps the schedule with the organizer (O05-1, OD-07b) and reuses the import checks; B lets a Teacher set the schedule, which OD-07b gives to the Operator.
- **OP-2. Mengganti soal sebelum tenggat.** "Bolehkah guru mengunggah ulang berkas soal sebelum tenggat?"
  - **A (Recommended):** "Boleh. Berkas baru menggantikan seluruh soal sebelumnya sampai tenggat. Riwayat unggahan (nama berkas, sidik SHA-256, waktu, guru) tetap tercatat."
  - B: "Tidak. Satu kali unggah saja; untuk memperbaiki, Operator membatalkan dan menempatkan ujian baru."
  - *Rationale:* preparation before a deadline implies correction. Note: under A the replaced question rows of a never-opened exam are removed (no Attempt or answer can exist yet); the batch history stays append-only. P2 :77 forbids deletion for cancellation only, so this is a new behaviour that needs the Owner's yes. The Owner gave it explicitly (§3.1); its reconciliation with the immutable-snapshot invariant is §3.3.
- **OP-3. Ujian tanpa soal saat tenggat.** "Apa yang terjadi bila tenggat lewat dan belum ada soal?"
  - **A (Recommended):** "Ujian tetap terjadwal tetapi belum siap ('Soal ujian belum ditambahkan'). Operator dapat memperpanjang tenggat dengan alasan, atau membatalkan ujian. Tidak ada tindakan otomatis."
  - B: "Ujian dibatalkan otomatis saat tenggat."
  - *Rationale:* an automatic cancellation is an unattributed action without a reason (OD-07); A keeps a human decision.
- **OP-4. Perpanjangan setelah tenggat lewat.** "Bolehkah Operator memperpanjang tenggat yang sudah lewat?"
  - **A (Recommended):** "Boleh, selama ujian belum ditandai siap dan tenggat baru masih sebelum sesi dimulai. Penyiapan soal terbuka kembali."
  - B: "Hanya sebelum tenggat lewat."
  - *Rationale:* a Teacher who missed the deadline is the main reason to extend one.
- **OP-5. Kesiapan dan pelaksanaan di tugas ini.** "Siapa yang menandai ujian sekolah siap, dan apakah ujian sekolah sudah bisa dibuka setelah tugas ini?"
  - **A (Recommended):** "Operator menandai siap per ujian, hanya setelah tenggat lewat (soal sudah final). Membuka, menjeda, melanjutkan dan mengakhiri tetap di ASSESS-INSTITUTION-003 (O05-3), jadi ujian sekolah belum dapat dibuka sampai tugas itu selesai. Guru mata pelajaran tidak dapat menandai siap, membuka, menjeda, melanjutkan atau mengakhiri ujian sekolah, tetapi tetap memfinalisasi hasilnya."
  - B: "Tugas ini hanya menampilkan kesiapan; 'Tandai Siap' juga di ASSESS-INSTITUTION-003."
  - C: "Membuka, menjeda, melanjutkan dan mengakhiri per ujian dimajukan ke tugas ini."
  - *Rationale:* readiness belongs to the Operator (OD-07b) and gives the deadline lock a visible end state; C pulls O05-3 forward and widens this Task.
- **OP-6. Peserta di tugas ini.** "Siapa peserta ujian sekolah saat ditempatkan?"
  - **A (Recommended):** "Semua siswa yang terdaftar di rombel itu pada tanggal sesi, saat ujian ditempatkan. Tidak ada pengubahan peserta di tugas ini; penambahan peserta di ASSESS-INSTITUTION-002."
  - B: "Operator dapat mengecualikan siswa saat menempatkan ujian."
  - C: "Peserta baru ditentukan di ASSESS-INSTITUTION-002."
  - *Rationale:* "participants by rombel" (OD-07b) with the existing D04.4-02/05 rule; conflicts are then caught at placement. C leaves a placed exam that can never be ready.
- **OP-7. Tindakan yang wajib beralasan.** "Tindakan Operator mana yang wajib alasan, konfirmasi dan audit?"
  - **A (Recommended):** "Perpanjangan tenggat dan pembatalan: wajib alasan, konfirmasi dan audit. Membuat periode, membuat sesi, menempatkan ujian dan menandai siap: konfirmasi di layar, pelaku dan waktu dicatat, tanpa alasan."
  - B: "Semua tindakan Operator wajib alasan."
  - *Rationale:* O05-2 names the extension; P02 (:86) forbids blanket high-risk treatment of ordinary saves; a teacher's mark ready needs no reason today.
- **OP-8. Memperbaiki susunan sebelum ujian dibuka.** "Bagaimana Operator memperbaiki ujian yang salah ditempatkan?"
  - **A (Recommended):** "Operator dapat membatalkan ujian yang belum dibuka, dengan alasan (diarsipkan, tidak dihapus), lalu menempatkan ujian baru. Tidak ada pemindahan sesi atau pengubahan durasi di tugas ini."
  - B: "Pembatalan, pemindahan ke sesi lain dan pengubahan durasi sebelum tenggat."
  - C: "Tidak ada perbaikan di tugas ini."
  - *Rationale:* A reuses the existing archive (0052) as the smallest safe correction; under C a wrong placement keeps blocking the students' slot through schedule conflicts.
- **OP-9. Durasi dan aturan mulai terlambat.** "Siapa yang menentukan durasi pengerjaan dan aturan mulai terlambat ujian sekolah?"
  - **A (Recommended):** "Operator, saat menempatkan ujian. Guru melihatnya di layar penyiapan soal."
  - B: "Guru mata pelajaran, saat menyiapkan soal, di dalam waktu sesi."
  - C: "Sama dengan panjang sesi, tanpa pilihan."
  - *Rationale:* the schedule belongs to the organizer (OD-07b), and the window and conflict checks need the duration at placement.

### 3.2 Engineering readings

- **E1, authority.**
  - School Operator: an active `tenant_school_operator_assignments` row for the session's membership (`schoolOperatorAssignment`, FOR SHARE on writes), read through the Tenant Access API as the roster import does. Re-checked at commit. Platform CLI authority is never inherited (A13).
  - Subject Teacher: the person holding the exam's active teaching assignment (`lockManagedExam`), which is the "assigned content responsibility" of A03 (:102), because O05-1 binds the ExamInstance to one teaching assignment.
  - Combined roles act per assignment (P03). A Proctor or a Student gains nothing.
- **E2, schema shape.** A04-1's two tables and one nullable column. The deadline is the O05-2 implementation choice beside A04-1, which names no deadline storage: not a second ExamInstance column but an append-only revision table (current deadline = highest revision, the 0061 pattern), which is also the extension history and audit. Rooms are not configured: institution exams are created with `room_based_operations_enabled = FALSE` and `proctor_per_room_required = FALSE`, as the teacher import does (`exam-provisioning.ts:279–280`); ASSESS-INSTITUTION-002 changes them.
- **E3, window, type and period.**
  - The ExamInstance window equals its session's slot, so every existing window, duration, late-start and conflict check applies unchanged.
  - The assessment type is the period's.
  - A period belongs to one academic period; a placed teaching assignment must be of that academic period; a session date lies inside the academic period's dates.
  - Times are entered as school-zone wall-clock values (`YYYY-MM-DD`, `HH:MM`, `YYYY-MM-DDTHH:MM`) and converted with the tenant time zone, as the import does (`teacher-exam-import.ts:385–395`). A session does not cross midnight.
- **E4, one ExamInstance per period × subject × rombel** (O05-1): at most one non-cancelled ExamInstance per (period, subject offering, academic group), enforced under a tenant-scoped advisory lock; otherwise `already_placed`.
- **E5, the content lock.** Content may change only while the exam is SCHEDULED and `transaction_timestamp()` is before the current deadline, checked under the exam row FOR UPDATE, the lock the deadline extension, the cancellation and mark ready also take. A DB trigger refuses snapshot INSERT and DELETE for an institution exam outside that condition, as a defence in depth; for an institution exam it first takes the exam row `FOR SHARE`, so a raw writer serializes with mark ready, extension and cancellation exactly as the application path does (§4.1). An import counts at its transaction start.
- **E6, content import readiness.** The same parser, builders, batch row, SHA-256 confirmation and import key as the teacher import, and the same IMPORT audit event. `evaluateExamReadiness` cannot be used here: the baseline composition stops at the first blocker, in the order existing checks (`exam-instance-existing-readiness-checks-composition-preflight.ts:47–90`: assessment type, snapshot presence, participants, timing, duration/window), then schedule conflict (`exam-instance-baseline-readiness-checks-composition-preflight.ts:105–133`), then content (:135–162), so an organizer blocker would hide a content defect or refuse the Teacher for something only the Operator can fix. The import therefore calls the content check alone, `checkExamInstanceBaselineQuestionSnapshotContentReadiness(client, tenantId, examInstanceId, async () => 'granted')` (`exam-instance-baseline-question-snapshot-content-readiness-preflight.ts:47–132`), after inserting the new snapshots. Its results map as follows:
  - `baseline_question_snapshot_content_ready`: accepted;
  - `not_ready` with `question_snapshot_content_invalid` or `question_snapshot_empty`: the problem `{source: 'setup', code: 'not_ready', blocker}`, 422 `import_invalid` (the builders already validate each row, `exam-provisioning.ts:51–54`, :81, so this is a backstop);
  - `invalid_state`, `denied` or `unavailable`: 503 `persistence_unavailable`, rolled back (the state was checked under the lock, so these mean an internal fault).

  `exam-instance-baseline-scoring-readiness-preflight.ts` is not composed into readiness anywhere and is not called. The import preview shows only file and content problems. Organizer blockers (schedule conflict, duration, participants) are not shown in the preview; the Teacher card keeps its existing "Kesiapan Dasar" line (the first blocker, unchanged), and the Operator sees them in the overview after the deadline (E15).
- **E7, the subject Teacher's refusals** (OD-07b, O05-1, O05-3): on an institution exam, the Teacher's `mark_ready`, `activate`, `pause`, `resume` and `end`, reschedule, cancel, participant candidates and participant addition answer 409 `institution_managed`. Finalize, preview, essay grading, results and export are unchanged. Monitoring, lock, messages and added time are unchanged in code and unreachable in this Task, because no institution exam can open before ASSESS-INSTITUTION-003, which settles them (risk R3).
- **E8, Operator projection.** Only operational data (P01, A10): subject, rombel, teacher ELLIGBLE ID, schedule, participant count, preparation status, question count, the time and file name of the last import, readiness codes and lifecycle state. No prompt, option, key, rubric, score, NISN or birth date. Extension reasons are returned only in the extending Operator's own receipt, not listed (CBT_PERMISSION_MATRIX.md:105: an operator's own reason may accompany its receipt, "not a grant to read other staff's private reasons"). The cancellation reason differs: it is the recorded disposition of the Teacher's own exam, the existing cancellation projection already shows it to that exam's Teacher (`teacher-readiness.ts:279–283`), and the cancel dialog names the Teacher as a reader before the Operator writes it (§4.6). The extension dialog names no reader, so its reason stays with its author.
- **E9, audit records.** Operator writes are kept in owning-domain append-only rows that carry the actor, the time, the action key, a request digest (`permissionDigest`) and, where OP-7 requires, the reason. The SEC-001 table is not widened: its CHECK binds authority to TEACHER or PROCTOR (0054:43–45), and changing a reviewed constraint is outside this Task. The Teacher's content import writes the existing IMPORT event.
- **E10, routes.** Flat paths with the ids in the body or query, as every existing route, in the `institution-exams` namespace for the Operator and the `teacher-exams` namespace for the Teacher.
- **E11, client placement.** A new workspace `institution`, "Ujian Sekolah", for a School Operator. Its screen loads on demand like `SchoolRosterImportView` (`App.tsx:23`), outside the teacher and proctor file. The Teacher's preparation screen is `TeacherExamImportView` in a preparation mode, so the preview section is reused and the default rendering is unchanged. The workspace reuses `IconClipboardCheck` deliberately: a distinct icon would add `components/icons.tsx` to the allowlist for no functional gain; the label distinguishes the workspace.
- **E12, E2E file name.** `99h-institution-exams.spec.ts`, so it sorts after every spec (Playwright orders files with localeCompare). The card's `13-institution-exams.spec.ts` would run second and its scheduled exam would hold all six students against the later specs.
- **E13, Student discovery.** Unchanged: a placed institution exam is listed to its participants as a scheduled exam, with no content.
- **E14, the Teacher card query.** The institution block is read by a separate query issued only for rows with a session reference, and it uses no `LIMIT 1`, so the mock in `test/teacher-readiness.test.ts:41–44` (it routes any `LIMIT 1` query to the authority check) and its forbidden-field list (:262–268) stay valid.
- **E15, Operator overview cost.** Readiness is evaluated only for SCHEDULED exams whose deadline has passed (where "Tandai Siap" applies), and the exams are read one period at a time.
- **E16, double-booking across subjects.** The placement advisory lock (E4) serializes one subject × rombel per period only. Two concurrent placements of different subjects for the same rombel in overlapping sessions can both pass the overlap query, exactly as two concurrent teacher imports can today. The double-booking is caught at mark ready by the participant schedule-conflict readiness check (`exam-instance-participant-proctor-schedule-conflict-readiness-preflight.ts:130`), which refuses with `not_ready` and `participant_schedule_conflict`; the Operator then cancels one placement (OP-8 A).
- **E17, placement does not reuse `provisionScheduledExam`,** because it refuses an exam without questions (`exam-provisioning.ts:263`). The placement INSERTs (exam, participants, the move to SCHEDULED and its lifecycle event) are written in `institution-exams.ts` with the same columns and statements as `exam-provisioning.ts:275–330`. The overlap query is shared: it is extracted unchanged from `teacher-exam-import.ts:418–426` as the exported `overlappingPersonIds`, and `SCHEDULING_STATES` (:151) is exported. `cleanFileName` (:167) is exported for the content routes.

### 3.3 OP-2 and the immutable exam question snapshots

00.11:26 keeps "immutable exam question snapshots" binding, TASK_PLAN §4 item 8 (TASK_PLAN.md:211) requires the immutable snapshot invariants, and P8 V10 expects "questions frozen". The Owner approved OP-2 A, whose question stated that the old rows of a never-opened exam are deleted (§3.1). The contract reconciles the two as follows:
- **No snapshot row is ever updated.** The 0003 UPDATE trigger (0003:45–55) is unchanged, so the content of every stored question stays exactly as imported.
- **Rows are replaced only for a never-delivered institution exam:** SCHEDULED, before its current deadline, through the Teacher's content route; the 0062 trigger refuses every other INSERT or DELETE on an institution exam (§4.1). Teacher-managed exams are untouched.
- **Nothing delivered or answered can be removed.** The RESTRICT foreign keys from answers (0004:25) and review flags (0042:27–28) to the snapshot block a DELETE once any answer or flag exists, and grades (0061:25–26) hang off answers.
- **The batch history stays append-only** (0048:46–55): every import keeps its file name, SHA-256, time, Teacher and question count, so the replaced set stays attributable.

Freezing therefore takes effect at the deadline (or READY), before any Student can see the questions, and from then on the snapshot set is immutable.

**Recorded deviations from proposed (not locked) documents:**
- P3 F06 proposes `POST /api/v1/assessment/institution-exams` and `…/{id}/transition`; this contract uses flat paths (E10).
- The card's `e2e/tests/13-institution-exams.spec.ts` becomes `99h-institution-exams.spec.ts` (E12).

## 4. Contract

### 4.1 Schema (migration `0062_secure_assessment_institution_exams.sql`, new)

Idempotent in the 0060/0061 pattern; history row `0062_secure_assessment_institution_exams`. Ownership: Secure Assessment. Person columns have no DB foreign key, as in 0061 (`graded_by_person_id`).

**`secure_assessment_institution_exam_periods`:**

| Column | Definition |
|---|---|
| `id` | `uuid` primary key, default `gen_random_uuid()` |
| `tenant_id` | `uuid NOT NULL` |
| `academic_period_id` | `uuid NOT NULL`; FK `(academic_period_id, tenant_id)` → `academic_core_academic_periods (id, tenant_id)` (0016:15), on delete RESTRICT |
| `assessment_type_id` | `uuid NOT NULL`; FK `(assessment_type_id, tenant_id)` → `secure_assessment_assessment_types (id, tenant_id)` (0029:214), on delete RESTRICT |
| `label` | `text NOT NULL CHECK (char_length(label) BETWEEN 1 AND 120 AND btrim(label) = label)` |
| `created_by_person_id` | `uuid NOT NULL` |
| `created_at` | `timestamptz NOT NULL DEFAULT statement_timestamp()` |
| `action_key` | `uuid NOT NULL` |
| `request_digest` | `text NOT NULL CHECK (request_digest ~ '^[0-9a-f]{64}$')` |

Constraints: `UNIQUE (id, tenant_id)`; `UNIQUE (tenant_id, action_key)`; `UNIQUE (tenant_id, academic_period_id, label)`.

**`secure_assessment_institution_exam_sessions`:** `id`, `tenant_id`, `period_id uuid NOT NULL` (FK `(period_id, tenant_id)` → periods `(id, tenant_id)`, RESTRICT), `starts_at timestamptz NOT NULL`, `ends_at timestamptz NOT NULL`, `created_by_person_id`, `created_at`, `action_key`, `request_digest` as above. Constraints: `CHECK (ends_at > starts_at)`; `UNIQUE (id, tenant_id)`; `UNIQUE (tenant_id, action_key)`; `UNIQUE (tenant_id, period_id, starts_at, ends_at)`.

**`secure_assessment_exam_instances`:** adds `institution_session_id uuid NULL`, FK `(institution_session_id, tenant_id)` → sessions `(id, tenant_id)`, RESTRICT, and the index `(tenant_id, institution_session_id)`. Existing rows stay NULL (teacher-managed); no backfill. A `BEFORE UPDATE OF institution_session_id` trigger raises when `OLD.institution_session_id IS DISTINCT FROM NEW.institution_session_id`, so an exam never moves between teacher-managed and institution-managed (NULL to a value, a value to NULL, or one value to another).

**`secure_assessment_institution_preparation_deadlines`:**

| Column | Definition |
|---|---|
| `id` | `uuid` primary key |
| `tenant_id` | `uuid NOT NULL` |
| `exam_instance_id` | `uuid NOT NULL`; FK `(exam_instance_id, tenant_id)` → `secure_assessment_exam_instances (id, tenant_id)`, RESTRICT |
| `revision` | `integer NOT NULL CHECK (revision >= 1)` |
| `deadline_at` | `timestamptz NOT NULL` |
| `previous_deadline_at` | `timestamptz NULL` |
| `reason` | `text NULL` |
| `set_by_person_id` | `uuid NOT NULL` |
| `set_at` | `timestamptz NOT NULL DEFAULT statement_timestamp()` |
| `action_key` | `uuid NOT NULL` |
| `request_digest` | `text NOT NULL`, 64 hex |

Constraints: `UNIQUE (tenant_id, exam_instance_id, revision)` (also the read index); `UNIQUE (tenant_id, action_key)`; and
`CHECK ((revision = 1 AND previous_deadline_at IS NULL AND reason IS NULL) OR (revision > 1 AND previous_deadline_at IS NOT NULL AND deadline_at > previous_deadline_at AND reason IS NOT NULL AND char_length(reason) BETWEEN 1 AND 200 AND btrim(reason) = reason))`.

Revision 1 is written at placement; each extension writes the next revision (O05-2).

**Append-only:** the three new tables refuse UPDATE and DELETE with triggers, following 0051 and 0061.

**Content lock trigger (E5):** `BEFORE INSERT OR DELETE ON secure_assessment_exam_question_snapshots FOR EACH ROW`, for the row's exam (`NEW` on INSERT, `OLD` on DELETE):
1. It reads `institution_session_id` of the exam without a lock. The value is immutable (the trigger above), so this read is final. When it is NULL (a teacher-managed exam), the trigger returns at once and takes no lock, so teacher-managed behaviour is unchanged.
2. Otherwise it runs `SELECT lifecycle_state FROM secure_assessment_exam_instances WHERE id = … AND tenant_id = … FOR SHARE`. This waits for any open transaction that holds the exam row FOR UPDATE (mark ready, extension, cancellation, the content route) and conflicts with the next one. Inside the content route's own transaction it is compatible with the FOR UPDATE that transaction already holds.
3. It then reads the exam's highest-revision `deadline_at` and raises unless `lifecycle_state = 'SCHEDULED'` and `transaction_timestamp() < deadline_at` (and a deadline row exists).

The existing UPDATE trigger (0003:45–55) is unchanged.

Nothing else in the schema changes.

### 4.2 Authority and transactions (`institution-exams.ts`, new)

**Operator writes,** in this order:
1. Exact body keys and shapes, before any connection; otherwise 400 `invalid_request`.
2. `buildAuthenticatedContext(req, pool, {cookie})`; none gives 403 `forbidden`.
3. `BEGIN` (READ COMMITTED).
4. `pg_advisory_xact_lock(hashtext('sa-institution:' || tenant || ':' || kind || ':' || actionKey))`, for the writes that carry an action key.
5. `buildAuthenticatedContext(…, {client, mutation: true})` for the same person and tenant, and `schoolOperatorAssignment(client, tenant, membershipId, true)`; otherwise 403 `forbidden`.
6. Replay: a row with this action key and the same actor and request digest returns the original result with `replayed: true` (200); a different actor or digest gives 409 `action_key_reused`. The cancellation has no digest column (0052): its replay compares the exam, the actor and the reason, exactly as `teacher-exam-cancel.ts:99` does.
7. The object lock: the exam row `FOR UPDATE` for exam actions. For placement: the teaching assignment and its teacher assignment `FOR SHARE` (as `teacher-exam-import.ts:362–370`, without the actor filter, because the Operator is not the Teacher), then `pg_advisory_xact_lock(hashtext('sa-institution-placement:' || tenant || ':' || period || ':' || offering || ':' || group))` (E4).
8. The checks, then the writes.
9. Re-authentication (mutation), then `COMMIT`.

Errors: 40001 and 40P01 give 409 `state_changed`. A 23505 is mapped by the violated constraint: the period label constraint gives 422 `composition_invalid` with `label_taken`, the session slot constraint gives 422 with `session_taken`, and any action-key constraint gives 409 `action_key_reused`; so a race that slips past the in-transaction check gets the same answer as the check. Connection failures give 503 `persistence_unavailable`.

**Object scope:** a period, session or exam that is not this tenant's institution object, including a teacher-managed exam of the same school, gives 403 `forbidden`, uniform with a foreign object.

**Operator reads:** `buildAuthenticatedContext(req, pool, {cookie})` through the pool first, because session resolution writes session bookkeeping, then `BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY` and `schoolOperatorAssignment(client, tenant, membershipId)` (no lock) inside that transaction; otherwise 403 `forbidden`.

**Teacher content writes** go through `executePermissionAction` with kind `IMPORT` and action `import` (§4.4).

### 4.3 Operator routes

**`GET /api/v1/assessment/institution-exams`** (no query):
`{timeZone, limits: {maxDurationMinutes}, assessmentTypes: [{assessmentTypeId, label}], academicPeriods: [{academicPeriodId, label, startDate, endDate}], teachingAssignments: [{teachingAssignmentId, subjectLabel, groupLabel, academicPeriodId, teacherElligbleId}], periods: [{periodId, label, assessmentTypeLabel, academicPeriodLabel, sessionCount, examCount}]}`.
Teaching assignments are the active ones of the tenant (`ata.revoked_at IS NULL AND tta.revoked_at IS NULL`), ordered by period, subject and rombel. Periods are ordered newest first.

**`GET /api/v1/assessment/institution-exams?periodId=`:**
`{period: {periodId, label, assessmentTypeLabel, academicPeriodLabel}, sessions: [{sessionId, startsAt, endsAt, exams: [ExamItem]}]}`, sessions by `starts_at`, exams by subject then rombel.

`ExamItem` = `{examInstanceId, subjectLabel, groupLabel, teacherElligbleId | null, lifecycleState, cancelledAt | null, durationMinutes, latestStartPolicy, participants, preparation: {deadline, revision, closed, questionCount, preparedAt | null, sourceFileName | null}, readiness: {baseline, roomProctor} | null}`.
- `closed` is true when the deadline has passed or the exam is no longer SCHEDULED.
- `readiness` uses `evaluateExamReadiness`, only for SCHEDULED exams past their deadline (E15); otherwise null.
- Nothing else is projected (E8).

**`POST /api/v1/assessment/institution-exams/periods`:** body exactly `{label, assessmentTypeId, academicPeriodId, actionKey}`.
- The label is trimmed with inner whitespace collapsed (the `normalizePermissionReason` rule, limit 120).
- 422 `composition_invalid` with `problems: [{code}]`, codes `label_invalid`, `label_taken`, `assessment_type_unknown`, `academic_period_unknown`, `academic_period_ended`.
- 201 `{periodId, replayed: false}`.

**`POST /api/v1/assessment/institution-exams/sessions`:** body exactly `{periodId, date, startTime, endTime, actionKey}`.
- 422 codes: `time_zone_missing`, `date_invalid`, `time_invalid`, `window_order`, `window_ended`, `date_outside_period`, `session_taken`.
- 201 `{sessionId, startsAt, endsAt, replayed}`.

**`POST /api/v1/assessment/institution-exams/placements`:** body exactly `{sessionId, teachingAssignmentId, durationMinutes, latestStartPolicy, preparationDeadline, actionKey}`.
- **Checks, all reported together:** `teaching_assignment_unknown`, `teaching_assignment_other_period`, `already_placed` (E4), `session_started`, `duration_invalid` (integer 1 to `MAX_DURATION_MINUTES`), `duration_exceeds_window` (the existing duration/window/policy rule), `deadline_invalid`, `deadline_passed`, `deadline_not_before_session`, `no_participants`, `schedule_conflict` with `count` (the import's overlap query over SCHEDULED, READY, ACTIVE and PAUSED exams); 422 `composition_invalid`.
- **Writes, in one transaction:**
  1. the ExamInstance as DRAFT (teaching assignment, the period's assessment type, the session window, duration, policy, room flags FALSE, `institution_session_id`);
  2. the participants: every student enrolled in the rombel on the session's school-zone date (OP-6 A);
  3. the move to SCHEDULED with the lifecycle event DRAFT → SCHEDULED, actor the Operator;
  4. deadline revision 1, carrying the placement's action key and digest.
- 201 `{examInstanceId, participants, preparationDeadline, replayed}`.

**`POST /api/v1/assessment/institution-exams/deadline`:** body exactly `{examInstanceId, preparationDeadline, expectedRevision, reason, confirmed, actionKey}`.
- The reason is normalized (`normalizePermissionReason`); an empty reason or `confirmed !== true` gives 400 `invalid_request`.
- Under the exam row lock: not SCHEDULED gives 409 `invalid_state` with `currentState`; `expectedRevision` not the current revision gives 409 `stale_deadline` with `{current: {revision, deadline}}`.
- 422 codes: `deadline_invalid`, `deadline_not_later`, `deadline_passed`, `deadline_not_before_session`. A deadline that has already passed may be extended (OP-4 A).
- 200 `{examInstanceId, revision, preparationDeadline, reason, replayed}`.

**`POST /api/v1/assessment/institution-exams/cancel`** (OP-8 A): body exactly `{examInstanceId, reason, confirmed, actionKey}`.
- The same reason and confirmation rule.
- SCHEDULED or READY only, otherwise 409 `invalid_state`; an exam already cancelled returns 200 with `changed: false`.
- Writes the 0052 cancellation, ARCHIVED and the lifecycle event with `cancellation_id`, through a helper extracted unchanged from `teacher-exam-cancel.ts:124–141`.
- 200 `{examInstanceId, cancelledAt, changed, replayed}`.

**`POST /api/v1/assessment/institution-exams/transition`** (OP-5 A): body exactly `{examInstanceId, action}` with `action` `mark_ready`. Like the Teacher's `mark_ready`, it carries no action key; a repeat meets `invalid_state`.
- Under the exam row lock: not SCHEDULED gives 409 `invalid_state`; `statement_timestamp()` before the current deadline (read after the lock) gives 409 `preparation_open` with `{preparationDeadline}`; `evaluateExamReadiness` failing gives 409 `not_ready` with `{readiness}` (for example `participant_schedule_conflict`, E16). Because the lock waits for any content transaction and the trigger's FOR SHARE (§4.1), readiness always sees the committed final content.
- Then SCHEDULED → READY with its lifecycle event, actor the Operator.
- 200 `{examInstanceId, lifecycleState: 'READY'}`.

**Route coverage:** `route-parity.test.ts` CALLS gains the client functions (§4.8); `metrics.ts` `COMPONENT_BY_PATH` gains every new path as `exam_setup` (required by `test/metrics.test.ts:19–23`). The negatives of every new route (§4.9) are asserted in the new integration test; the SEC-001 suite (`permission-enforcement.test.ts`) is unchanged.

**Edge behaviour, unchanged and applied to the new paths:** every API request with a disallowed Origin gets 403 `origin_not_allowed` before routing (`server.ts:276–280`). Operator bodies use the default JSON limit of 64 KiB (`http/http-utils.ts:3`, :24); the two content routes use the import's 1 MiB limit (`server.ts:78`); a larger body gets 413 `payload_too_large` (`http/http-utils.ts:29`, :41) before any database work.

### 4.4 Teacher content preparation routes

**`POST /api/v1/assessment/teacher-exams/content/preview`:** body exactly `{examInstanceId, questionsCsv, sourceFileName}`. **`POST /api/v1/assessment/teacher-exams/content`:** the same plus `{importKey, expectedSha256}`. The body limit is the import's (`server.ts:78`).

**Order, inside the transaction:**
1. (Confirm only) the wrapper's key lock and re-authentication. The wrapper receives no `examInstanceId`, as the existing import does, so it takes no exam lock first; the IMPORT event takes the exam from the result.
2. `lockManagedExam(client, actor, examInstanceId)` (FOR UPDATE); null gives 403 `forbidden`.
3. (Confirm) a batch with this import key returns the earlier result (`replayed: true`); a different SHA-256 gives 409 `import_key_reused`. This runs before the deadline check, so a lost acknowledgement after the deadline replays safely.
4. `institution_session_id` null gives 409 `not_institution_exam`; not SCHEDULED gives 409 `invalid_state`; `transaction_timestamp()` at or after the current deadline gives 409 `preparation_closed` with `{preparationDeadline}`.
5. The SHA-256 check (409 `content_changed`), the file size check and `parseQuestionFile`.
6. File problems stop here (422 `import_invalid`, nothing written). Otherwise the existing snapshots of the exam are deleted (OP-2 A, §3.3), and a new batch and the new snapshots are inserted in authored order.
7. `checkExamInstanceBaselineQuestionSnapshotContentReadiness` alone, mapped as E6; a content problem rolls everything back with 422 `import_invalid`.

**Outcomes:** preview returns the `TeacherExamImportPreview` shape with `participants: []`, `window` the session window, `totals.participants` the participant count, plus `replaces: n` (the question count stored now, 0 when none); it always rolls back. Problems give 422 `import_invalid` with the preview. Confirm returns 201 `{examInstanceId, questionCount, replayed, audit}` (200 when replayed), with result type `prepared`, which `permission-action-audit.ts:71–73` `successful()` gains. The confirm response carries no replaced count; the Teacher saw `replaces` in the preview.

**Replay locking.** On a replay the wrapper finds the earlier IMPORT event, so it knows the exam and takes it `FOR KEY SHARE` (`permission-action-audit.ts:159`) before step 2 takes `FOR UPDATE` in the same transaction. Two concurrent replays of one key can therefore deadlock; PostgreSQL aborts one with 40P01, which the wrapper answers as 409 `state_changed` (`permission-action-audit.ts:252`), with nothing written. The client retries with the same key and gets the replay. This is the existing teacher import's behaviour.

The question row building at `teacher-exam-import.ts:307–316` is exported unchanged as `previewQuestionsOf`, and both imports use it.

### 4.5 Teacher-managed routes and the Teacher card

**Refusals (E7),** each before any write and only when `institution_session_id` is non-null, as 409 `{error: 'institution_managed'}`:
- `teacher-exams/transition` for every action except `finalize`. The check follows the authority check at `exam-lifecycle-operations.ts:117–120`; the exam query (:101–116) also selects `i.institution_session_id`, and the result union (:40–50) gains `{type: 'institution_managed'}`.
- `teacher-exams/reschedule`, `teacher-exams/cancel`, `teacher-exams/participants/add` and `teacher-exams/participants/candidates`, after `lockManagedExam`/`readManagedExam` (`teacher-exam-schedule.ts:126`, `teacher-exam-cancel.ts:85`, `teacher-exam-participants.ts:189`, :248). `ManagedExamRow` (`managed-exam.ts:11–20`) gains `institution_session_id`, selected at :30–31.

**Teacher card** (`teacher-readiness.ts`): every exam projection gains `institution: {periodLabel, preparationDeadline, deadlineExtended, preparationClosed, questionCount} | null`, null for teacher-managed exams, read as E14. A cancelled institution exam keeps the existing cancellation projection (time, the Operator's ELLIGBLE ID and the reason; the cancel dialog says the Teacher sees it).

### 4.6 Client

**Workspace** (`AppShell.tsx`): `Workspace` (:8) gains `institution`, labelled "Ujian Sekolah" with the existing `IconClipboardCheck`; `availableWorkspaces` (:28–36) pushes it right after `operator` when `schoolOperator` is true. `App.tsx` renders it as an on-demand screen like `operator` (:98–100), titled "Ujian Sekolah".

**Operator screen (`InstitutionExamView`, new),** in the shared `Page`:
- **Header:** title "Ujian Sekolah"; description "Susun periode ujian, sesi, dan ujian setiap mata pelajaran per rombel. Guru mata pelajaran menyiapkan soal sebelum tenggat. Isi soal dan kunci jawaban tidak ditampilkan di sini."; actions "Buat Periode" and "Muat Ulang".
- **Empty state** (shared pattern): "Belum ada periode ujian."
- **Period card:** the label, "<jenis penilaian> · <periode akademik>", action "Buka Periode"; once open, its time slots and "Tambah Sesi".
- **Time slot ("Sesi"):** heading "Jadwal Sesi: <tanggal>, <jam mulai> sampai <jam selesai>" in the shared date and time format; action "Tempatkan Ujian". UI_CONTENT_AND_COPY_STYLE.md §13 (:150–154, LOCKED) uses "Sesi Ujian" for the exam itself, and the student screens use "sesi" for the device session, so the time slot is always "Sesi" or "Jadwal Sesi", never "Sesi Ujian".
- **Exam item** (`ExamListCard`):
  - title: the subject; facts: "<rombel> · Guru <ELLIGBLE ID>", "<n> peserta · <durasi> menit", "Tenggat penyiapan soal: <tanggal dan jam>", followed by " (diperpanjang)" when the revision is above 1;
  - status: the lifecycle badge, plus the preparation badge from `lib/status.ts` `preparationStatus`: "Belum ada soal" (warning), "Soal disiapkan: n soal" (info), "Penyiapan ditutup" (neutral);
  - the readiness message when present, using the blocker texts moved unchanged from `TeacherReadinessView.tsx:77–102` to `lib/status.ts`;
  - actions while SCHEDULED: "Perpanjang Tenggat", "Tandai Siap" (enabled when readiness passes) and "Batalkan Ujian"; while READY: "Batalkan Ujian". A cancelled exam shows "Dibatalkan".
- **Dialogs** (`permissionDialogClass`, focus returns to the trigger). Under OP-7 A, the form dialogs are the on-screen confirmation for creating a period, creating a time slot and placing an exam: nothing is sent until their "Simpan …" or "Tempatkan Ujian" action. Mark ready gets its own confirmation dialog without a reason; extension and cancellation carry a reason and `confirmed: true`.
  - "Buat Periode Ujian": "Nama periode", "Jenis penilaian", "Periode Akademik"; action "Simpan Periode".
  - "Tambah Sesi": "Tanggal", "Jam mulai", "Jam selesai"; action "Simpan Sesi".
  - "Tempatkan Ujian di Sesi": "Mata pelajaran dan rombel" (options "<mapel> · <rombel> · <ELLIGBLE ID guru>"), "Durasi pengerjaan (menit)", "Aturan mulai terlambat" (the existing `LATEST_START_OPTIONS`), "Tenggat penyiapan soal"; action "Tempatkan Ujian".
  - "Tandai Siap?": the text "Ujian <mapel> · <rombel> akan ditandai siap. Soal tidak dapat diubah lagi, dan tenggat tidak dapat diperpanjang. Membuka ujian dilakukan pada langkah tersendiri."; actions "Batal" and "Tandai Siap". No reason field.
  - "Perpanjang Tenggat Penyiapan Soal": "Tenggat baru" and `ActionReasonField`; action "Perpanjang".
  - "Batalkan Ujian Sekolah?": the text "Ujian diarsipkan dan tidak dihapus. Guru mata pelajaran melihat pembatalan ini beserta alasannya.", `ActionReasonField`; action "Batalkan Ujian".
- **Problem and refusal copy (frozen):**

| Code | Copy |
|---|---|
| `label_invalid` | "Nama periode wajib diisi, paling banyak 120 karakter." |
| `label_taken` | "Nama periode ini sudah dipakai untuk periode akademik yang sama." |
| `assessment_type_unknown`, `academic_period_unknown`, `teaching_assignment_unknown` | "Data pilihan sudah berubah. Muat ulang halaman, lalu pilih lagi." |
| `academic_period_ended` | "Periode akademik ini sudah berakhir." |
| `date_invalid`, `time_invalid`, `deadline_invalid` | "Tanggal atau jam tidak valid." |
| `window_order` | "Jam selesai harus setelah jam mulai." |
| `window_ended` | "Waktu sesi sudah lewat." |
| `date_outside_period` | "Tanggal sesi harus berada di dalam periode akademik periode ujian ini." |
| `session_taken` | "Sesi dengan waktu yang sama sudah ada di periode ini." |
| `time_zone_missing` | "Zona waktu sekolah belum diatur. Hubungi administrator platform." |
| `teaching_assignment_other_period` | "Mata pelajaran ini bukan dari periode akademik periode ujian ini." |
| `already_placed` | "Mata pelajaran dan rombel ini sudah ditempatkan di periode ini." |
| `session_started` | "Sesi sudah dimulai, jadi ujian tidak dapat ditempatkan." |
| `duration_invalid` | "Durasi harus 1 sampai 1.440 menit." |
| `duration_exceeds_window` | "Durasi tidak muat di waktu sesi dengan aturan mulai terlambat ini." |
| `deadline_passed` | "Tenggat harus di masa mendatang." |
| `deadline_not_before_session` | "Tenggat harus sebelum sesi dimulai." |
| `deadline_not_later` | "Tenggat baru harus setelah tenggat saat ini." |
| `no_participants` | "Tidak ada siswa yang terdaftar di rombel ini pada tanggal sesi." |
| `schedule_conflict` | "n siswa sudah dijadwalkan di ujian lain pada waktu yang sama." |
| `stale_deadline` | "Tenggat baru saja diubah. Muat ulang untuk melihat tenggat terbaru." |
| `preparation_open` | "Tenggat penyiapan soal belum lewat. Ujian dapat ditandai siap setelah tenggat." |
| `not_ready` | "Ujian belum dapat ditandai siap: <pesan kesiapan>." (the readiness message of `lib/status.ts`, for example after a double-booking, E16) |
| `invalid_state` | "Status ujian sudah berubah. Muat ulang halaman." |
| `invalid_request` | "Isian belum lengkap atau tidak valid. Periksa lagi." (the text the import screen already uses, `TeacherExamImportView.tsx:51`) |
| `action_key_reused`, `state_changed` | "Tindakan ini bertabrakan dengan perubahan lain. Muat ulang, lalu coba lagi." |
| `forbidden` | "Anda tidak berwenang mengatur ujian sekolah ini." |
| network or 503 | "Perubahan belum tersimpan karena koneksi terputus. Coba lagi: mencoba lagi tidak membuat data ganda." |

**Teacher card** (`TeacherReadinessView.tsx`), only when `institution` is present:
- facts: "Ujian sekolah · <periode>", then "Tenggat penyiapan soal <tanggal dan jam>." or "Penyiapan soal ditutup <tanggal dan jam>.", then "Belum ada soal." or "n soal disiapkan.", then "Jadwal, peserta, dan pelaksanaan ujian ini diatur operator sekolah.";
- the before-opening actions (:413–431) become "Siapkan Soal" (while SCHEDULED and not closed, new prop `onPrepareExam`) and "Pratinjau Soal" (when questions exist); "Ubah Jadwal", "Tambah Peserta", "Tandai Siap", "Buka Ujian" and "Batalkan Ujian" are not shown;
- the pause, resume and end group (:376–391) is not shown; "Finalisasi Hasil" stays;
- `transitionFailureMessage` (:59) maps `institution_managed` to "Ujian ini diatur operator sekolah, jadi tindakan ini dilakukan oleh operator."

Teacher-managed cards render exactly as today.

**Preparation screen** (`TeacherExamImportView`, new optional prop `preparation: {examInstanceId}`, route `?view=teacher&prepareExam=<id>`, title `SCREEN_TITLE.examPreparation` "Siapkan Soal Ujian Sekolah"):
- reads the exam's card from `GET teacher-readiness` and the limits from `GET teacher-exams/setup`; no new read route;
- intro: "Unggah berkas soal untuk ujian sekolah ini sebelum tenggat. Jadwal, durasi, dan peserta diatur operator sekolah.";
- the class, type, schedule and participant fields are replaced by a read-only summary (subject, rombel, session, duration, late-start rule, participants, deadline);
- the file field, template download and `PreviewSection` are reused; the participant list is not shown;
- when questions exist, the confirmation shows "Soal yang sudah tersimpan (n soal) akan diganti seluruhnya oleh berkas ini.";
- confirmation dialog "Simpan Soal Ujian Sekolah?", action "Simpan Soal"; success notice "Soal ujian sekolah tersimpan: n soal.";
- `preparation_closed`: "Tenggat penyiapan soal sudah lewat, jadi soal tidak dapat diubah. Hubungi operator sekolah bila perlu perpanjangan."; `not_institution_exam`: "Ujian ini bukan ujian sekolah.".

Without the prop, the screen is unchanged. `App.tsx` adds `prepareExam` to the route state (:28–54) and to the screen key (:93).

### 4.7 Invariants

- No existing column, constraint or trigger changes; one column and two triggers (the session-reference guard and the content lock) are added to existing tables.
- Teacher-managed exams behave as today on every route.
- The lock order of existing actions is unchanged; new exam actions take the exam row FOR UPDATE, as every lifecycle change does.
- No Operator response, log or audit row carries a prompt, option, key, rubric, score, NISN, birth date or answer.
- No total across subjects; finalization stays per ExamInstance with its subject Teacher (O05-1).
- No participant removal (OPEN-05); a cancellation archives and deletes nothing.
- Bahasa Indonesia, with no em dash in UI copy; times in the school's zone; numbers per UI_CONTENT_AND_COPY_STYLE.md:148.
- E2E navigation goes only through the shared helpers.
- The frontend skill checkpoint follows ASSESS-QUESTION-002 §4A.8; the new screen uses only shared primitives and tokens.

### 4.8 Existing assertions that change (only these)

- **`runtime/secure-assessment/test/route-parity.test.ts` CALLS (:31–64):** the `api/assessment-client.ts` block (:32–64) gains the ten new client functions over the nine new paths (the GET path serves two): `getInstitutionExams`, `getInstitutionPeriod`, `postInstitutionPeriod`, `postInstitutionSession`, `postInstitutionPlacement`, `postInstitutionDeadline`, `postInstitutionCancel`, `postInstitutionTransition`, `postTeacherExamContentPreview` and `postTeacherExamContent`.
- **`frontend/web/src/__tests__/schoolRosterImport.test.tsx:18`:** `['operator']` becomes `['operator', 'institution']`.

`test/teacher-readiness.test.ts`, `test/metrics.test.ts`, `test/integration/permission-enforcement.test.ts`, `frontend/web/src/__tests__/claimReview.test.tsx:22–23` and every teacher screen test stay unchanged.

### 4.9 Negative coverage (P5 trace)

The P5 enforcement table names the negatives each action must carry: A03 N01, N02, N03, N05, N06, N08 (CBT_PERMISSION_MATRIX.md:123) and A10 N01, N02, N03, N04, N07, N08 (:130). N10 (:60) is added for the edge checks of every new path.

| Route | P5 row | N-ids asserted (C03) |
|---|---|---|
| GET `institution-exams` and `?periodId=` | A10 | N01, N02 (foreign `periodId` → 403), N03, N04, N10 |
| POST `institution-exams/periods` | A10 | N01, N02 (foreign assessment type or academic period → 422 `…_unknown`, nothing disclosed), N03, N04, N07, N08, N10 |
| POST `institution-exams/sessions` | A10 | N01, N02 (foreign `periodId` → 403), N03, N04, N07, N08, N10 |
| POST `institution-exams/placements` | A10 | N01, N02 (foreign session → 403; foreign or revoked teaching assignment → 422 `teaching_assignment_unknown`), N03, N04, N07, N08, N10 |
| POST `institution-exams/deadline` | A10 | N01, N02 (foreign or teacher-managed exam → 403), N03, N04, N07, N08 (missing reason or confirmation, altered replay, stale revision), N10 |
| POST `institution-exams/cancel` | A10 | N01, N02, N03, N04, N07, N08 (missing reason or confirmation, altered replay), N10 |
| POST `institution-exams/transition` | A10 | N01, N02, N03, N04, N07, N08 (spoofed fields through the exact body; no reason under OP-7 A), N10 |
| POST `teacher-exams/content/preview` | A03 | N01, N02 (foreign exam, another Teacher's exam → 403), N03 (other subject, revoked teaching assignment), N05, N06, N10 |
| POST `teacher-exams/content` | A03 | N01, N02, N03, N05, N06 (stale SHA, reused import key, closed preparation, wrong state, replay), N08 (spoofed fields, altered replay input), N10 |

What each N-id means here:
- **N01:** anonymous gives 401; a session for another tenant or without membership gives 403; an unavailable database gives 503 with nothing written.
- **N03:** the other tenant's Operator, an Operator whose assignment is revoked, a Teacher of another subject or with a revoked teaching assignment: 403.
- **N04:** a Teacher, a Proctor, a Homeroom Teacher and a Student on every Operator route; the Operator on both content routes and on the existing content-bearing routes of an institution exam (`teacher-exams/preview`, `teacher-exams/essays`, `teacher-exams/essays/grade`, `teacher-exams/results` GET and its export POST), and a Proctor on the same routes: 403. The subject Teacher's organizer actions give `institution_managed` (§4.5).
- **N05:** no content-route response reaches a Student; a Student on the content routes gets 403; Student delivery of a SCHEDULED institution exam is refused as today (I-15).
- **N06:** I-3, I-4 and I-16.
- **N07:** this Task has no rooms, so the room-switch part belongs to ASSESS-INSTITUTION-002 and ASSESS-ROOM-001. Applied here as authority at commit: an Operator assignment, or the placed teaching assignment, revoked while a write waits on its lock gives 403 or `teaching_assignment_unknown` (the re-authentication and the FOR SHARE reads), with nothing written.
- **N08:** body fields `actorPersonId`, `tenantId` or any key outside the exact body give 400; a missing reason or `confirmed` gives 400; altered replay input gives `action_key_reused` or `import_key_reused`; a stale revision gives `stale_deadline`; every refusal leaves the before/after table counts equal.
- **N10:** a disallowed Origin gives 403 `origin_not_allowed`; a body over 64 KiB (Operator routes) or 1 MiB (content routes) gives 413 `payload_too_large`; both before any database effect (§4.3).

## 5. Expected vectors

Fixture: one tenant (school zone Asia/Jakarta), an academic period, rombel X with three enrolled students, a teaching assignment "Matematika × X" held by Teacher T, a School Operator O, a Proctor P and a second tenant with its own Operator.

| # | Case | Expected |
|---|---|---|
| I-1 | O creates a period, a session D+2 08:00–10:00 and places Matematika × X (90 minutes, `FULL_DURATION_BEYOND_WINDOW`, deadline D+1 15:00) | An ExamInstance in SCHEDULED with the session window, the period's assessment type, three participants, room flags FALSE, `institution_session_id` set; lifecycle event DRAFT → SCHEDULED by O; deadline revision 1; T's card shows the institution block with 0 questions and "Siapkan Soal" |
| I-2 | Placement refusals, zero mutation | 422 for `already_placed`, `teaching_assignment_other_period`, `duration_exceeds_window`, `deadline_not_before_session`, `deadline_passed`, `session_started`, `no_participants`, `schedule_conflict` (count 3 when X sits in an overlapping teacher-managed exam); 403 for a foreign or unknown session |
| I-3 | T prepares | Preview writes nothing; confirm writes the snapshots, one batch and one IMPORT event; a replay with the same key returns the same with no new row; the same key with another file gives `import_key_reused`; a second file replaces the questions (OP-2 A): the preview reports `replaces` with the old count, the old rows are gone, two batches remain with their own counts, and no snapshot row was ever updated |
| I-4 | The lock | At or after the deadline: preview and confirm give 409 `preparation_closed`, zero mutation; a direct SQL INSERT or DELETE of a snapshot of that exam is refused by the trigger; a direct DELETE of a snapshot that has an answer or review flag is refused by the RESTRICT foreign key (§3.3); a teacher-managed exam's snapshots are unaffected and the trigger takes no lock for them |
| I-4b | Raw writer racing mark ready | With the deadline passed and content present, transaction 1 takes the exam FOR UPDATE through mark ready; transaction 2 inserts a snapshot by raw SQL. Transaction 2's trigger waits on its FOR SHARE until 1 commits, then sees READY and raises; READY's readiness saw only the committed content. In the opposite order (a raw INSERT started before the deadline holds FOR SHARE), mark ready waits and then evaluates readiness over the committed rows |
| I-5 | Extension | With `expectedRevision` 1, a later deadline and a reason: revision 2, T can prepare again; a stale revision gives `stale_deadline` with `current`; an earlier deadline gives `deadline_not_later`; no reason or `confirmed` false gives 400; an expired deadline can be extended while SCHEDULED (OP-4 A); a READY exam gives `invalid_state` |
| I-6 | Mark ready | Before the deadline: `preparation_open`; no content after the deadline: `not_ready` with `question_snapshot_empty`; with content after the deadline: READY with its lifecycle event by O; a repeat gives `invalid_state` |
| I-7 | Cancel | SCHEDULED → ARCHIVED with the 0052 row and the event; a replay is the same; the same key with another reason gives `action_key_reused`; T's card lists it under "Ujian Dibatalkan" |
| I-8 | The subject Teacher on an institution exam | `mark_ready`, `activate`, `pause`, `resume`, `end`, reschedule, cancel, participant candidates and participant addition give 409 `institution_managed`, zero mutation; preview, essays and results work; with the exam set to ENDED by fixture SQL, T's `finalize` succeeds (O05-1) |
| I-9 | Authority denials, zero mutation (§4.9) | Every Operator route gives 403 to T, P, a Student, the other tenant's Operator and O after the assignment is revoked; O on a teacher-managed exam gives 403; O and another Teacher on the content routes give 403; O and P on `teacher-exams/preview`, `teacher-exams/essays`, `teacher-exams/essays/grade`, `teacher-exams/results` GET and the results export POST of an institution exam give 403; T on a teacher-managed exam's content route gives 409 `not_institution_exam`; unauthenticated gives 401 |
| I-10 | Minimization | No Operator response contains `prompt`, `options`, `correct`, `rubric`, `score`, `nisn` or `birthDate` keys or any authored question text |
| I-11 | Concurrency | Two placements of Matematika × X in one period: exactly one succeeds, the other is `already_placed`; two placements of different subjects for X in overlapping sessions may both succeed, and the later mark ready gives `not_ready` with `participant_schedule_conflict` (E16); two periods with one label or two sessions with one slot created concurrently: one succeeds, the other is `label_taken` or `session_taken`; content confirm racing an extension, a cancel or mark ready is serialized by the exam lock with one consistent outcome; two extensions with the same `expectedRevision`: one succeeds, the other is `stale_deadline`; two concurrent content replays of one key: one replays, the other is the replay or 409 `state_changed`, with one batch |
| I-12 | Replay | Period, session, placement and deadline with the same key and body return the same result with no new row, and another body gives `action_key_reused`; cancel with the same key, exam, actor and reason replays, and another reason gives `action_key_reused` |
| I-13 | Teacher-managed regression | Every existing teacher-managed suite passes unchanged (§4.8) |
| I-14 | Migration 0062 | Upgrade on a populated database (teacher-managed exams keep NULL and behave as before), repeat as a no-op, synthetic rollback; UPDATE and DELETE refused on the three tables; a change of `institution_session_id` refused in every direction (NULL to a value, a value to NULL, one value to another) |
| I-15 | Student discovery (E13) | A participant Student sees the placed exam in "Jadwal Ujian" as scheduled, with no question content; `attempts/start` gives 409 `exam_not_active` (`attempt-eligibility.ts:47`, sent at `attempt-start.ts:105–107`), so no Attempt exists and no question can be delivered |
| I-16 | Stale file | Confirm with an `expectedSha256` that differs from the sent file gives 409 `content_changed`, zero mutation |
| I-17 | Edge (N10) | Every new path with a disallowed Origin gives 403 `origin_not_allowed`; an Operator body over 64 KiB and a content body over 1 MiB give 413 `payload_too_large`; zero mutation |

## 6. Exact proposed file scopes (frozen at READY)

| # | Path | Purpose |
|---|---|---|
| 1 | docs/production/tasks/ASSESS-INSTITUTION-001.md | Contract, history, evidence (Task-flow) |
| 2 | docs/production/TASK_PLAN.md | Status, counters, ASSESS-QUESTION-006 landing (Task-flow) |
| 3 | docs/production/PRODUCTION_COMPLETION_PLAN.md | Status (Task-flow) |
| 4 | docs/DOCUMENT_MANIFEST.md | Index (Task-flow) |
| 5 | docs/production/CBT_ARCHITECTURE_DELTA_REVIEW.md | Appended checkpoint: the A04-1 period and session tables and session reference, and the deadline revision table as the O05-2 implementation choice beside A04-1 (E2) |
| 6 | database/migrations/0062_secure_assessment_institution_exams.sql | Periods, sessions, session reference, deadlines, content lock |
| 7 | runtime/secure-assessment/src/institution-exams.ts | Operator routes logic and Teacher content preparation (new) |
| 8 | runtime/secure-assessment/src/managed-exam.ts | `institution_session_id` on the row |
| 9 | runtime/secure-assessment/src/exam-lifecycle-operations.ts | `institution_managed` refusal |
| 10 | runtime/secure-assessment/src/teacher-exam-import.ts | Unchanged behaviour; exports `previewQuestionsOf` (extracted from :307–316), `overlappingPersonIds` (extracted from :418–426), and the existing `SCHEDULING_STATES` (:151) and `cleanFileName` (:167) (E17) |
| 11 | runtime/secure-assessment/src/teacher-exam-schedule.ts | Refusal |
| 12 | runtime/secure-assessment/src/teacher-exam-cancel.ts | Refusal; cancellation helper export |
| 13 | runtime/secure-assessment/src/teacher-exam-participants.ts | Refusals (candidates, add) |
| 14 | runtime/secure-assessment/src/teacher-readiness.ts | Institution block |
| 15 | runtime/secure-assessment/src/permission-action-audit.ts | `prepared` in `successful()` |
| 16 | runtime/secure-assessment/src/server.ts | Nine routes; refusal mappings |
| 17 | runtime/secure-assessment/src/metrics.ts | Nine `COMPONENT_BY_PATH` entries |
| 18 | frontend/web/src/types/assessment.ts | Institution and card types (`institution?` optional) |
| 19 | frontend/web/src/api/assessment-client.ts | Ten client functions |
| 20 | frontend/web/src/session/AppShell.tsx | `institution` workspace |
| 21 | frontend/web/src/App.tsx | Workspace screen; `prepareExam` route |
| 22 | frontend/web/src/lib/screen-titles.ts | `examPreparation` |
| 23 | frontend/web/src/lib/status.ts | `preparationStatus`; readiness blocker texts moved |
| 24 | frontend/web/src/components/InstitutionExamView.tsx | Operator screen (new) |
| 25 | frontend/web/src/components/TeacherReadinessView.tsx | Institution card; blocker texts from `lib/status.ts` |
| 26 | frontend/web/src/components/TeacherExamImportView.tsx | Preparation mode |
| 27 | runtime/secure-assessment/test/institution-exams.test.ts | Units (new) |
| 28 | runtime/secure-assessment/test/integration/institution-exams.test.ts | I-1–I-12, I-14–I-17 and the §4.9 map on real PostgreSQL (new) |
| 29 | frontend/web/src/__tests__/institutionExams.test.tsx | Operator screen, Teacher card, preparation mode (new) |
| 30 | e2e/tests/99h-institution-exams.spec.ts | Five-browser journey and captures (new) |
| 31 | runtime/secure-assessment/test/route-parity.test.ts | §4.8 only |
| 32 | frontend/web/src/__tests__/schoolRosterImport.test.tsx | §4.8 only |

**Forbidden:**
- every other file, including `staff-screens.ts`, `ScreenLoadBoundary.tsx`, `global-setup.ts`, `helpers.ts` and the test fixtures;
- completed Task records;
- other migrations;
- lockfiles, dependencies and workflows;
- production resources.

## 7. Acceptance gates (DEFINED / NOT EXECUTED)

| Gate | Expected outcome |
|---|---|
| C01 | Units: the content-readiness result mapping as a pure function over all six preflight results (ready, `question_snapshot_empty`, `question_snapshot_content_invalid` → 422 `import_invalid`; invalid_state, denied, unavailable → 503 with rollback); the body parsers and exact-key checks, school-zone conversion of dates, times and deadlines, the problem codes, the deadline revision rule, the reason normalization, `preparationStatus` |
| C02 | `previewQuestionsOf` gives exactly today's preview items; every import vector of the earlier Tasks is unchanged |
| C03 | Real PostgreSQL: I-1–I-12 (with I-4b), I-14–I-17 and every N-id of the §4.9 map, through the production-wired server, with before/after table counts for every refusal (V07, V10, V11) |
| C04 | Regression with only the §4.8 assertions changed |
| C05 | Client: the workspace list; the Operator screen states (empty, loading, refused, error, success), dialogs, focus return, problem copy; the Teacher institution card (open, closed, READY, cancelled) with the organizer actions absent; the preparation mode with the replacement notice and `preparation_closed`; teacher-managed cards and the import screen unchanged |
| C06 | Five-browser E2E (`99h`; the C07 multi-width captures run outside the timed deadline test; the deadline test sets `test.setTimeout(240_000)`, because the config allows 90 s with no retries and no re-run is permitted: C's deadline is at most 120 s after its placement and the wait polls for at most 150 s, leaving 90 s for the steps; Operator `pengawas.e2e` given and later revoked the School Operator assignment in the spec, as `9-identity.spec.ts` does, Teacher `guru.e2e`, the X-E2E rombel, sessions on later days so no earlier exam conflicts):<br>• the Operator creates two periods, each with one session on its own day (E4 allows one Matematika × X-E2E exam per period); places exam A (deadline days ahead) and exam C (deadline about a minute ahead); a second placement of Matematika × X-E2E in A's period is refused with `already_placed`;<br>• the Teacher prepares C at once, then prepares A, re-uploads A (replacement notice), previews A;<br>• the Operator extends A's deadline with a reason;<br>• after a bounded wait for C's deadline: the Teacher sees "Penyiapan soal ditutup" on C and the server refuses its content; the Operator marks C ready;<br>• the Operator cancels A with a reason; the Teacher sees it under "Ujian Dibatalkan";<br>• shared helpers only |
| C07 | Rendered evidence (`workspace-institution-*`):<br>• **Baseline:** the five `workspace-visual-*` artifacts of exact-main CI #219, fetched with the resumable, size- and `unzip -t`-checked transfer; pair count and manifest recorded at READY step 1.<br>• **After:** the Operator screen (empty, period open with sessions and exams, each dialog, a refusal, readiness blocker, READY, cancelled); the Teacher card (before the deadline, closed, READY); the preparation screen (empty, checked preview, replacement confirmation, `preparation_closed`).<br>• The frozen widths 360, 390, 430, 768, 1024, 1280, 1440 and 640×360, and 200 % text at 390×844 and 1280×800; no page overflow; targets ≥ 44 px; visible focus; rendered review PASS.<br>• The `99`–`99g` pairs are identical to the baseline apart from times, generated IDs and capture timing; School Operator captures elsewhere (`9-identity.spec.ts`) differ only by the added "Ujian Sekolah" navigation item |
| C08 | Scope inside rows 1–32; 33 Tasks and 78 edges; exact-SHA attempt-1 eight-job CI; no re-run |
| C09 | Independent contract, implementation and rendered review PASS; Delegated Acceptance; evidence commit; delegated merge |

**CI-first order:** as ASSESS-QUESTION-007 §7:
1. Registration, carrying the ASSESS-QUESTION-006 landing and the #219 manifest.
2. Implementation, whose exact-SHA CI passes before review.
3. Implementation and rendered review by the same reviewer.
4. Delegated Acceptance and the evidence commit.
5. PR-head CI, the delegated squash merge, then post-merge main CI.

No re-runs, and no push while the previous commit's CI runs.

**Honest limits and risks:**
- **R1, O09 coverage.** P5 approval excluded "O05 institution … composition" (CBT_PERMISSION_MATRIX.md:96, :142). The Owner approved the exact authority boundary of this Task as OB-1 on 2026-11-09 (§3.1): the Operator creates periods and time slots, places exams, sets and extends deadlines, marks ready and cancels, without seeing content or keys; the Teacher loses mark ready, open, pause, end, reschedule and cancel on institution exams. The route boundaries of §4.3–§4.5 and §4.9 implement OB-1 with A10 and O05-1/O05-2. A reviewer is never a §8 authority (00.13 §4.1); the review checks only that the contract matches OB-1. PB05 stays OPEN.
- **R2, no institution exam can open after this Task** (OP-5 A); the end-to-end institution journey completes only with ASSESS-INSTITUTION-002/003.
- **R3, the Teacher's monitoring controls** (lock, messages, added time) on institution exams are left to ASSESS-INSTITUTION-003; they are unreachable here because no institution exam can be ACTIVE.
- **R4, a READY institution exam meeting ASSESS-INSTITUTION-002:** adding rooms there must re-check readiness, as rescheduling does today.
- **R5, overview cost:** readiness per exam is bounded by E15 but not measured against the P6 budgets (PERF-001).
- **R6, E2E timing:** C06 waits about a minute for C's deadline inside the spec; the wait is bounded and the lock is also proved in C03 without waiting.
- **R7, snapshot deletion on replacement** (OP-2 A, approved explicitly by the Owner with the deletion stated in the question) is a new behaviour, reconciled with the binding immutable-snapshot invariant (00.11:26, TASK_PLAN §4 item 8, P8 V10) in §3.3: no snapshot row is ever updated (the 0003 trigger is unchanged); rows are replaced only for a never-delivered SCHEDULED institution exam before its deadline, enforced by the 0062 trigger; the RESTRICT foreign keys from answers (0004:25) and review flags (0042:27–28) block deletion once either exists; the import batch history stays append-only.

## 8. History

- 2026-11-09: Contract prepared under DEC-048 on main e031d31 after ASSESS-QUESTION-006 landed (PR #34). O05-1, O05-2 and A04-1 are the approved inputs. Open points OP-1–OP-9 raised for the Owner with recommended defaults. Not reviewed; NOT READY.
- 2026-11-09: Owner decisions in chat, quoted in §3.1: "Setujui semua default (Recommended)" for OP-1 to OP-9; OP-2 asked explicitly, "Boleh, ganti seluruhnya (Recommended)"; the authority boundary OB-1, "Setuju batas ini (Recommended)".
- 2026-11-09: Contract review 1 returned STOP (F1–F7): F1 status consistency and R1 on OB-1; F2 the mark-ready confirmation dialog; F3 the content-import readiness check; F4 the trigger lock; F5 OP-2 against immutable snapshots; F6 the time-slot term; F7 the P5 negative trace and vectors. Non-material notes a–p. Corrections applied in this revision; status stays NOT READY, under independent review.
- 2026-11-09: Contract review 2 returned PASS. The reviewer's rulings and four minor corrections were applied, then formal READY and Build start (§10).

## 9. Independent contract review

- **Reviewer:** a fresh-context, read-only subagent under the standing Owner designation. The same reviewer will review the implementation and the rendered evidence.
- **Review 1: STOP** (F1–F7, notes a–p). F1 status consistency and R1 on OB-1; F2 the "Tandai Siap?" confirmation (OP-7 A); F3 the exact content-readiness check and mapping; F4 the trigger's FOR SHARE on the exam row; F5 the OP-2 reconciliation with immutable snapshots (§3.3); F6 "Sesi" instead of "Sesi Ujian"; F7 the P5 negative trace (§4.9) and the content-route refusals for the Operator and the Proctor. All closed in review 2.
- **Review 2: PASS,** with no material finding. Rulings:
  - C03 needs no injected-content test; C01 covers the content-readiness mapping as a pure function over all six preflight results (applied to C01).
  - Foreign ids on period creation answering 422 `…_unknown` are acceptable on three conditions: tenant-scoped lookups, a byte-identical body for a foreign and a nonexistent id (asserted in C03), and route targets (period, session, exam) staying 403.
  - Minor corrections applied: N10 at CBT_PERMISSION_MATRIX.md:60; the `participant_schedule_conflict` result at :130; the C07 captures outside the timed deadline test; "akan ditandai siap".

## 10. Formal READY and Build start under DEC-048 — 2026-11-09

- **Eligibility (00.13 §4.1):**
  - SEC-001 is DONE.
  - O05 (O05-1, O05-2) and A04 (A04-1) are approved in [ASSESS-QUESTION-001 §4](ASSESS-QUESTION-001.md); O09 rests on P5, and its O05 exclusion (CBT_PERMISSION_MATRIX.md:96, :142) is covered by the Owner's OB-1 (§3.1).
  - Every open point was decided by the Owner (§3.1). No earlier-row or P0 Task is eligible.
  - ASSESS-QUESTION-006 is DONE and landed: PR #34, main e031d31949972fd501946dd231f2bd1a45e247b5, PR-head CI #218, post-merge main CI #219 attempt 1 eight SUCCESS.
- **Review chain:** STOP → PASS (§9).
- **Frozen allowlist:** §6 rows 5–32; rows 1–4 are Task-flow paths. Migration 0062 reserved. No dependency, workflow or production resource.
- **Rendered baseline (step 1):** the five `workspace-visual-*` artifacts of exact-main CI #219 (run 42502731581, e031d31).
  - They were fetched with the resumable, size- and `unzip -t`-checked transfer.
  - 2050 `workspace-question-*` pairs from the `99`–`99g` specs, all with frontend tree 96c7189bac3d2e20f73e76d5acf2247a706c10f6.
  - Every screenshot hash matches its JSON; zero overflow; zero targets under 44 px.
  - Manifest, built as in ASSESS-QUESTION-004 §10: SHA-256 56b1a1babe2fb8b6a7077627168b34f2a1a9b66f797ca379d306f9dd59a1698a.
- **CI-first order:** as frozen in §7. This registration is step 1. No re-runs.
- **Status:** BLOCKED → IN_PROGRESS. Counters: DONE 14, IN_PROGRESS 1, VERIFYING 0, BLOCKED 18.

## 11. Implementation checkpoint — 2026-11-09

- **Step 1:** registration 0895ab4 on main e031d31 carries the ASSESS-QUESTION-006 landing and the #219 baseline manifest (§10).
- **Implementation candidate,** inside rows 5–32 plus the Task-flow rows 1–4:
  - **Schema** migration 0062 (idempotent, the 0060/0061 pattern): the period and session tables, `institution_session_id` with its FK, index and the guard trigger (no change in any direction), the deadline revision table with the revision CHECK, append-only triggers on the three new tables, and the content lock trigger (no lock for a teacher-managed exam; FOR SHARE, SCHEDULED and `transaction_timestamp()` before the highest-revision deadline for an institution exam).
  - **Operator routes** `institution-exams.ts`, in the §4.2 order (exact body, authentication, BEGIN, the action-key lock, re-authentication with the Operator assignment FOR SHARE, replay, object lock, checks, writes, re-authentication, COMMIT) and the 23505 constraint mapping:
    - the overview and the period view, operational data only, readiness only for a SCHEDULED exam past its deadline (E15);
    - periods, sessions (school-zone conversion with the tenant zone, as the import), placements (E4 advisory lock, OP-6 participants on the session date, the shared overlap query, the writes of `exam-provisioning.ts:275–330`, deadline revision 1);
    - the deadline extension (stale revision, OP-4 A), the cancellation (the 0052 helper extracted unchanged from `teacher-exam-cancel.ts`), mark ready.
  - **Teacher content routes:** preview (always rolled back) and confirm through the IMPORT wrapper, in the §4.4 order; OP-2 replacement; the content check alone, mapped as E6 by the pure `mapContentReadiness`; `prepared` added to `successful()`.
  - **Refusals** `institution_managed`: transition (every action except finalize), reschedule, cancel, participant candidates and addition; `ManagedExamRow.institution_session_id`.
  - **Teacher card:** the institution block, read by a separate query without `LIMIT 1` (E14).
  - **Extracted unchanged** from the teacher import: `previewQuestionsOf`, `overlappingPersonIds`, `SCHEDULING_STATES`, `cleanFileName` (E17).
  - **server.ts** nine routes and the refusal mappings; **metrics.ts** nine `exam_setup` entries.
  - **Client:**
    - the `institution` workspace "Ujian Sekolah" (`IconClipboardCheck`), right after `operator`, loaded on demand in `App.tsx`;
    - `InstitutionExamView`: the header, the empty, loading, refused and failed states, period cards, "Jadwal Sesi" headings, exam items (lifecycle and preparation badges, the readiness message, the actions), the six dialogs with focus return, one action key per dialog kept on retries, and the frozen problem and refusal copy;
    - `lib/status.ts`: `preparationStatus` and the readiness blocker texts moved unchanged from `TeacherReadinessView.tsx`;
    - the Teacher institution card: the four facts, "Siapkan Soal" and "Pratinjau Soal", the organizer actions and the pause, resume and end group absent, `institution_managed` in `transitionFailureMessage`;
    - `TeacherExamImportView` preparation mode (`?view=teacher&prepareExam=`, `SCREEN_TITLE.examPreparation`): the read-only summary, the file card shared with the scheduling mode, the preview, the replacement notice, "Simpan Soal Ujian Sekolah?", `preparation_closed` and `not_institution_exam`; without the prop the screen is unchanged;
    - ten client functions and the institution types.
- **Tests:**
  - `test/institution-exams.test.ts` (C01/C02: the six content-readiness results, the exact bodies, the school-zone conversion, the problem codes and the deadline revision rule, the reason normalization, the error mapping, `previewQuestionsOf` against the inline mapping of e031d31 for all eight types, and the N10 edge of every new path before any database work);
  - `test/integration/institution-exams.test.ts` (C03: I-1–I-12 with I-4b, I-15–I-17 and every N-id of the §4.9 map with before/after counts; I-14 migration upgrade on a populated database, synthetic rollback and repeat);
  - `frontend/web/src/__tests__/institutionExams.test.tsx` (C05);
  - `e2e/tests/99h-institution-exams.spec.ts` (C06: the timed deadline journey with `test.setTimeout(240_000)`; C07: the `workspace-institution-*` captures with the #219 baseline, in two separate tests outside it);
  - the §4.8 assertions only (route-parity CALLS; `schoolRosterImport.test.tsx:18`).
- **Local:**
  - typechecks PASS (runtime, web, e2e);
  - the new and affected Secure Assessment units 90/90;
  - the new and affected web files 148/148.
  - Integration and E2E run in CI only.
- **Noted for the implementation review:**
  - N10 on the GET path: the existing Origin check applies to unsafe methods only (`http/http-utils.ts` `isOriginAllowed`), so the GET overview is not refused for a foreign Origin; the eight POST paths are, and `http-utils.ts` is outside the allowlist.
  - The Operator and content routes read and check the body before authentication, so 400 and 413 come before any database work.
  - Copy beyond §4.6, in the frozen voice: success notices, loading lines, the empty-state line under "Belum ada periode ujian.", "Belum ada sesi di periode ini.", "Belum ada ujian di sesi ini.", the deadline help line of the placement dialog, and the preparation-mode labels ("Periksa Soal", "Soal siap disimpan", "Simpan Soal", the summary labels).
  - The exam item heading is an `h3` under the `h3` session heading: `ExamListCard` offers `h2` and `h3` only, and its file is outside the allowlist.
  - The placement dialog lists every active teaching assignment of the school: the overview's period entries carry no academic period id; another period is refused with its frozen copy.
- **Status:** IN_PROGRESS → VERIFYING. Counters: DONE 14, VERIFYING 1, BLOCKED 18.

### 11.0 Exact-content CI of the first candidate

- **CI #221** (run 42513709043, 5bf5b3e, attempt 1): FAILURE, preserved without re-run. Web passed; Runtime failed; E2E and Container were skipped.
  - **The one failure, out of 310 integration tests:** the existing SEC-001 test "migration upgrades populated 0053 and is repeat-safe" (`test/integration/permission-enforcement.test.ts`). It migrates only to 0053, then calls the current `cancelTeacherExam`, which received `unavailable` instead of `cancelled`. The new read of `i.institution_session_id` in `managed-exam.ts` cannot run on a schema without the 0062 column. Every new institution integration test passed.
- **Correction (row: managed-exam.ts, inside the allowlist):** the teacher-managed lookup now reads the column as `to_jsonb(i) ->> 'institution_session_id'`. On a pre-0062 schema that is null, the teacher-managed meaning; on the current schema it is identical. No test changed.

### 11.0.1 Exact-content CI of the second candidate

- **CI #222** (run 42514037710, fd159cc, attempt 1): FAILURE, preserved without re-run. Web, Runtime (all 310 integration tests, including the 0053 upgrade test) and Container passed. All five E2E jobs failed at the same step, with every earlier spec passing (36/36 each); the capture test did not run.
  - `openPeriod` (99h :140, called at :303) used Playwright `isVisible()`, which does not wait. Before the overview had rendered the period card, it returned false and skipped "Buka Periode". The period stayed closed, so "Tambah Sesi" never appeared. The page snapshot shows the period present and closed.
- **Correction (row 30, test only):** `openPeriod` first waits for the period card to be visible, then opens it when it is closed. No product code changed.

### 11.0.2 Exact-content CI of the third candidate

- **CI #223** (run 42516495197, fe57a24, attempt 1): FAILURE, preserved without re-run. Web, Runtime and Container passed. In all five browsers the deadline journey and every earlier spec passed (37/37 each); only the 99h capture test failed:
  - **mobile-360, tablet-768, desktop-1280 and firefox-1280 (:379):** `getByRole('button', { name: 'Batal' })` inside the cancellation dialog also matched "Batalkan Ujian". Playwright matches role names by substring unless `exact` is set.
  - **webkit-390 (:371):** a full-page screenshot with a dialog open exceeded WebKit's 32767-pixel limit. The height pre-check read only the document element, while WebKit sizes the page by the body.
- **Correction (row 30, test only):**
  - every "Batal" click uses `exact: true`;
  - the capture height pre-check takes the larger of the document and body heights;
  - a screenshot WebKit still refuses as too large is retaken as a viewport screenshot, recorded as `fullPage: false` in its JSON.
  - The overflow and 44 px assertions are unchanged. No product code changed.

### 11.0.3 Exact-content CI of the fourth candidate

- **CI #224** (run 42518901717, d17d12f, attempt 1): FAILURE, preserved without re-run. Web, Runtime, Container and the E2E jobs for mobile-360, tablet-768, desktop-1280 and firefox-1280 passed.
  - In webkit-390, the 99h capture test failed one C07 gate: `teacher-card-closed` at 360x800 with 100 % text overflowed (scrollWidth 384 against 360). The same capture at 390, 430 and 768 px was clean.
  - The overflowing elements were the existing readiness sections of the Teacher card (`.teacher-readiness-details` grid, `teacher-readiness.css`), whose texts all wrap. WebKit sized the `1fr` grid track from the items' automatic minimum width. No earlier spec captured a Teacher card at 360 px in WebKit.
- **Correction (TeacherReadinessView.tsx, an allowlisted row):** the two readiness grid items take `min-w-0` and `overflow-wrap: anywhere`, so the track cannot grow past the card. This applies to every Teacher card and changes nothing at widths where the content already fits.
  - Local: web typecheck clean; teacherOperations, institutionExams and teacherResults 44/44.

### 11.0.4 Rendered review of 6325c1e and its correction

- **CI #225** (run 42521915020, 6325c1e, attempt 1): eight SUCCESS. The rendered review (C07) returned **STOP F1**: focus was lost after a dialog send.
  - **Failed send:** the focused action stays disabled while saving and nothing restores focus when the error renders. The capture  recorded focus on BODY in 40 of 50 captures, with the dialog still open.
  - **Successful "Tandai Siap" or "Batalkan Ujian":** the trigger is removed by the refresh, so focus fell to BODY.
- **Correction (rows InstitutionExamView.tsx, TeacherExamImportView.tsx and institutionExams.test.tsx):**
  - **Failed send:** the six Operator dialogs (through ) and the preparation dialog "Simpan Soal Ujian Sekolah?" move focus to their enabled retry action once the error has rendered. This is the pattern of TeacherExamParticipants.tsx:69–75.
  - **Successful mark ready or cancel:** focus moves to the success notice (, as in StudentClaimView.tsx:112), which survives the refresh. Where the trigger survives, focus returns to it as before.
  - **The reviewer's non-material Metric note:** the summary metrics take .
  - **Tests:** C05 asserts the retry focus for period, placement, mark ready, cancel and preparation save, and the notice focus after a successful mark ready and cancel. Run against the earlier components, these assertions fail.
  - **Local checks:** web typecheck clean; institutionExams, teacherExamImport, teacherOperations and designSystemGuard 52/52.
