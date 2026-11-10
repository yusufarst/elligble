# ASSESS-INSTITUTION-003 — School Operator drill-down and audited bounded controls

## 1. Control state and authority

| Field | Disposition |
|---|---|
| Classification | Active P11 Task; P1 / operational supervision; HIGH risk; R21, R23, R28; P8 V07, V11, V12 |
| Status | **VERIFYING under DEC-048: final evidence and Delegated Acceptance (§12); implementation and reviews (§11); formal READY PASS (§10). All Owner decisions are decided: OC-1 to OC-6 on 2026-11-09 (§3.1). Contract review chain STOP → PASS (§9)** |
| Objective | For the institution exams of the School Operator's own school, the Operator:<br>• follows each session as exam → room → participant status, refreshed by itself and marked stale when a refresh fails;<br>• opens, pauses, resumes and ends exams, one by one or for a whole session;<br>• locks and unlocks a participant, sends messages and adds time.<br>Every control carries a reason, an on-screen confirmation and an append-only, attributable record. Subject Teachers and Proctors gain nothing. Teacher-managed exams are unchanged. No score, grade edit or cheating verdict is shown or possible |
| Owner decisions | **Approved inputs:**<br>• O05-1 to O05-4 and A04-1 to A04-3, decided 2026-11-07 ([ASSESS-QUESTION-001 §4](ASSESS-QUESTION-001.md));<br>• OP-1 to OP-9 and OB-1, decided 2026-11-09 ([ASSESS-INSTITUTION-001 §3.1](ASSESS-INSTITUTION-001.md));<br>• OB-2, RP-1 to RP-5 and OB-3, decided 2026-11-09 ([ASSESS-INSTITUTION-002 §3.1](ASSESS-INSTITUTION-002.md));<br>• OC-1 to OC-6, decided 2026-11-09 (§3.1).<br>**Open:** none.<br>Reviewer: the standing Owner-designated read-only subagent reviewer, a fresh one for this Task |
| Execution authority | DEC-048 (00.13).<br>• Internal dependency ASSESS-INSTITUTION-002 is complete at c11ab1f with Delegated Acceptance (its §12.4); its landing (PR #36) is in progress. Its PR-head CI and post-merge main CI are recorded in this Task's first change.<br>• O05 is approved (O05-1 to O05-6). O09 rests on the approved P5 content, whose approval excludes "O05 institution … composition" (CBT_PERMISSION_MATRIX.md:96, :142), and whose A06 row leaves "O05 institution control composition" unresolved (:105). The Owner closed that gap for this Task with OC-1 to OC-6 (§3.1), as OB-2 and OB-3 did for ASSESS-INSTITUTION-002 |
| Base and branch | Drafted on c11ab1f (branch task/assess-institution-002, worktree `C:\Projects\ELLIGBLE-institution-002`), whose tree equals `main` after PR #36. Proposed branch task/assess-institution-003 from `main` after that landing |
| Parallel safe / cost | No parallel baseline Task; no dependency, vendor, service or cost |

**Eligibility under 00.13 §4.1** (checked at drafting; re-checked at READY):
- **Internal dependency:** ASSESS-INSTITUTION-002 must be DONE and landed with passing post-merge `main` CI. This is the landing in progress.
- **External gates O05 and O09** (TASK_PLAN §8 :626, :630): O05 is approved. For O09 the Operator's running-control composition is outside the approved P5 content (:96, :105, :142); the Owner decided it as OC-1 to OC-6 (§3.1), exactly as OB-2/OB-3 were decided for ASSESS-INSTITUTION-002.
- **OPEN policy inputs:** none. OPEN-05 (participant removal) is not touched.
- **Selection:** no other row is eligible before this one.
  - P0 rows not DONE: ASSESS-STUDENT-001 waits on O04 (OPEN); ASSESS-ROOM-001 depends on this Task; OPS-STAGING-001, OPS-001, PERF-001, DEVICE-001, VERIFY-INTEGRITY-001, LEGAL-001, SEC-RELEASE-001 and RELEASE-001 are prepare-only (00.13 §7).
  - P1 rows above this one: ASSESS-MEDIA-001 waits on O06 and O07 (OPEN); ASSESS-QUESTION-009 depends on ASSESS-MEDIA-001; ASSESS-QUESTION-010 depends on ASSESS-QUESTION-009.
- **Not a blocker, recorded:** P5 A06 also leaves "O03/O08 sensitive reason/retention details" unresolved (:105). This Task stores reasons as SEC-001 and ASSESS-INSTITUTION-001 already do (append-only, returned only to their author) and decides no retention (R8).

**Authority:**
- **Governance:** [DEC-044](../../00-governance/00.11_CBT_RELEASE_SCOPE_REALIGNMENT.md) (OD-07, OD-07b), [DEC-045 §5](../../00-governance/00.12_AICWDF_ADOPTION_AND_TASK_EXECUTION.md) and [DEC-048](../../00-governance/00.13_STANDING_EXECUTION_DELEGATION.md).
- **Plan and rules:**
  - [TASK_PLAN ASSESS-INSTITUTION-003/§4/§8](../TASK_PLAN.md) (:415–423; O05 :626 and O09 :630 of §8; ASSESS-ROOM-001 :425–433; ASSESS-PROCTOR-003 :435–441);
  - [CBT_PERMISSION_MATRIX](../CBT_PERMISSION_MATRIX.md):
    - data rule :45, P01 :84, P02 :86, P03 :88, P04 :90, the exclusions :96 and :142, and :152 (no new account directory);
    - rows A05 (:34, :104), A06 (:35, :105), A07 (:36, :106) and A10 (:39, :109);
    - the trace rows A05 :125, A06 :126 and A10 :130, and N01–N10 (:50–60);
  - [ROUTE_INTERACTION_MATRIX](../ROUTE_INTERACTION_MATRIX.md) W07 (:28), W11 (:32), W12 (:33), F06 (:51);
  - [CBT_UX_SCREEN_AND_INTERACTION_INVENTORY](../CBT_UX_SCREEN_AND_INTERACTION_INVENTORY.md) C11 (:44), C17 (:50), C18 (:51), R21 (:85);
  - [CBT_VERIFICATION_AND_RELEASE_DOD_PLAN](../CBT_VERIFICATION_AND_RELEASE_DOD_PLAN.md) V07 (:33), V11 (:37), V12 (:38).
- **Locked discovery rules** ([04.01_SECURE_ASSESSMENT.md](../../01-discovery/04.01_SECURE_ASSESSMENT.md)):
  - D04.2-68 (:2307): "READY → ACTIVE must re-check critical conditions immediately before launch";
  - D04.2-69 (:2321, LOCK concept): activation may be automatic at the scheduled time or manual by authorized staff, "Exact modes later";
  - D04.2-70 (:2336): no start before the allowed start;
  - D04.4-26D (:4670, LOCKED): "A subject teacher does not automatically obtain whole-exam or cross-room monitoring rights merely because they teach the subject";
  - D04.4-26E (:4698): an institution-managed assessment is supervised by "explicit operational/proctor assignment";
  - D04.4-59 (:5527–5531): after ACTIVE, room changes become governed transfers;
  - D04.6-48 (:7629): a whole-exam emergency pause "should not be available casually to every room proctor";
  - D04.6-38 to D04.6-41 (lock and added time) and D04.6-49 to D04.6-55 (broadcast), as cited in `participant-lock.ts`, `participant-time.ts` and `exam-broadcast.ts`.
- **Earlier records:**
  - [ASSESS-INSTITUTION-001](ASSESS-INSTITUTION-001.md): the Operator frame, E7 (the subject Teacher's refusals), E9 (owning-domain audit, SEC-001 table not widened), R3;
  - [ASSESS-INSTITUTION-002](ASSESS-INSTITUTION-002.md): E10, E14, E15, E18, the residual risks R2, R5, R6, R12 and R14, and the rendered lessons of §11.0.1 to §11.0.3;
  - [SEC-001](SEC-001.md): the R/C/A protocol of the existing staff routes (`permission-action-audit.ts`, 0054).
- **Schema:** migrations 0005, 0044, 0046, 0047, 0050, 0054, 0062 and 0063 are reused unchanged. One new migration, 0064, is proposed (§4.1).

No LOCKED decision or PB status changes. OPEN-05 (participant removal) stays OPEN and is not touched.

## 2. Reuse and bounded gaps

**Reused:**
- **The lifecycle core** of `performTeacherExamAction` (`exam-lifecycle-operations.ts`):
  - the transition table (:54–61), with idempotent pause, resume and end;
  - the window checks of activation (:186–196, D04.2-70) and the final readiness re-check (:198–202, D04.2-68, `evaluateExamReadiness` :66–79);
  - the pause boundary rows of 0044 (:159–176) and the lifecycle events (:177–181, :213–217);
  - the semantics recorded at :11–20: pause freezes every running attempt, end only stops new starts, nothing is force-submitted, END of a PAUSED exam needs a resume first.
- **The participant lock** (`participant-lock.ts:45–109`, 0046): open attempt, boundary after the attempt row lock, idempotent.
- **Added time** (`participant-time.ts`): `parseTimeAdditionRequest`, the bounds `MAX_ADDED_MINUTES` 120 and `TIME_REASON_MAX_LENGTH` 200 (:20–21), the states ACTIVE and PAUSED (:54), the timer ledger 0005/0050 with its action-key index `uq_sa_timer_adj_action_key`.
- **Broadcast** (`exam-broadcast.ts`): `sendExamBroadcast` (:87), the targets EXAM, ROOM and PARTICIPANTS (D04.6-49), the rate limit per sender and exam, 0047 and the Student inbox.
- **The monitoring projection** (`exam-monitoring.ts`): the REPEATABLE READ READ ONLY read (:95), the participant query (:119–168), the status rules (:195–221), `readScopeRooms` and `readBroadcastHistory`. It carries ELLIGBLE IDs only and no score.
- **The Operator frame of ASSESS-INSTITUTION-001**, already exported: `operatorWrite` (:304), `operatorRead` (:343), `institutionFailure` (:278), `hasExactKeys` (:74), `digestOf` (:251), `refuse` (:264) and `lockInstitutionExam` (:726).
- **The session lock of ASSESS-INSTITUTION-002**, `lockSession` (`institution-rooms.ts:317`), exported unchanged so the session-wide shortcut and room writes serialize on one key.
- **The per-request supervision scope** (`supervision-scope.ts`): the Proctor's room filter is a per-request join (A04-3).
- **The shared UI:**
  - `ExamMonitoringView` with its 20 s refresh (:30, :130–141), visibility refresh, "Perbarui" and the stale notice "Pemantauan tertunda";
  - `AddTimeDialog`, `BroadcastComposer`, `BroadcastHistory`, `ActionReasonField` and `permissionDialogClass`;
  - `Page`, `Card`, `Dialog`, `Button`, `StatusBadge`, `ExamListCard`, `MetricList` (`layout="narrowFirst"`), `LoadErrorState`, `StaleDataNotice`;
  - `examLifecycleStatus`, `participantStatus`, `LOCKED_PARTICIPANT_STATUS` and `readinessBlockerMessage` (`lib/status.ts`);
  - the dialog hooks `useActionKey` and `useRetryFocus` (`hooks/useDialogAction.ts`).

**Gaps closed:**
- No product path opens, pauses, resumes or ends an institution exam: the subject Teacher is refused with `institution_managed` (`exam-lifecycle-operations.ts:124–130`), and the Operator has only mark ready. Institution exams cannot open (ASSESS-INSTITUTION-002 R2).
- The R/C/A ledger of SEC-001 cannot carry the Operator. `ck_sa_permission_authority` (0054:43–45) binds the authority to TEACHER or PROCTOR, and `uq_sa_permission_action_key` allows one row per action key, so a session-wide action with one reason has no place. The business ledgers 0044, 0046 and the lifecycle events have no reason column.
- The subject Teacher of an institution exam counts as a "managing teacher" (`supervision-scope.ts:36–44`, :93). Once an institution exam opens they would monitor every participant, lock, send messages and add time (ASSESS-INSTITUTION-001 R3, ASSESS-INSTITUTION-002 R5). This contradicts D04.4-26D (LOCKED).
- The Teacher card offers "Pantau Peserta" on an institution exam (`TeacherReadinessView.tsx:350–353`) and shows live progress counts while it is ACTIVE or PAUSED (:334–347, from `teacher-readiness.ts:256–288`). Both are whole-exam monitoring, which D04.4-26D denies the subject Teacher (F3).
- Copy that names the Teacher as the actor becomes untrue for institution exams, where the Operator opens, pauses and adds time (F4):
  - Student: `StudentExamWorkstation.tsx:814` ("setelah guru melanjutkan ujian") and `AssignedExamDiscovery.tsx:216–217` ("guru atau pengawas");
  - supervisors: `ExamMonitoringView.tsx:184`, :217 and :352, and `ParticipantTime.tsx:51` ("guru yang mengelola ujian").
- A pre-0063 READY institution exam with FALSE/FALSE room flags could open without rooms (ASSESS-INSTITUTION-002 R6).
- Room writes lock every exam of the session FOR UPDATE (`institution-rooms.ts:361–373`). Once an exam is ACTIVE, that blocks its answer saves (ASSESS-INSTITUTION-002 R14).
- There is no school-wide drill-down (C18 MISSING).

**Excluded:**
- moving a participant between rooms while READY, ACTIVE or PAUSED: ASSESS-ROOM-001 (O05-4, O05-5, A04-2, C19). Room writes keep refusing an affected exam that is not SCHEDULED or READY (ASSESS-INSTITUTION-002 E10);
- the STANDAR risk feed, signals and incidents: ASSESS-PROCTOR-003 (O08, A08, C20). The drill-down shows only the existing session facts (`sessionActive`, `sessionMoves`) as facts, never as a risk score or verdict;
- changing or adding a room's Proctors after the exam opened (OC-6);
- automatic activation (OC-2) and any automatic end at session end;
- mark ready (ASSESS-INSTITUTION-001, unchanged), finalization, essay grading, results, export and publication (the subject Teacher; RESULT-003/004);
- any change to teacher-managed exams, to the Proctor's rights (A05) or to the Student screens, except the role-neutral copy of E20;
- participant removal (OPEN-05);
- any change to 0054 or to `executePermissionAction`; the retention of reasons (O03/O08).

## 3. Settled inputs, Owner decisions and engineering readings

**Approved before this Task (quoted):**
- **O05-3** ([ASSESS-QUESTION-001 §4](ASSESS-QUESTION-001.md), :79, assigned to ASSESS-INSTITUTION-002/003): "Open, pause, resume and end per ExamInstance, plus a session-wide shortcut that applies the same action to each ExamInstance with one reason. Lock and unlock, messages and added time follow OD-07, with reason, confirmation and audit. Teachers and Proctors cannot pause or end institution exams."
- **OP-5 A** ([ASSESS-INSTITUTION-001 §3.1](ASSESS-INSTITUTION-001.md)): "Membuka, menjeda, melanjutkan dan mengakhiri tetap di ASSESS-INSTITUTION-003 (O05-3), jadi ujian sekolah belum dapat dibuka sampai tugas itu selesai. Guru mata pelajaran tidak dapat menandai siap, membuka, menjeda, melanjutkan atau mengakhiri ujian sekolah, tetapi tetap memfinalisasi hasilnya."
  - **What OP-5 hands to this Task:** the opening (READY → ACTIVE), pause, resume and end of institution exams, by the Operator. Mark ready stays with the ASSESS-INSTITUTION-001 route, unchanged. The subject Teacher keeps finalization only.
- **OB-1:** the Teacher loses "siap/buka/jeda/akhiri/ubah jadwal/batal" for institution exams; already enforced (`exam-lifecycle-operations.ts:124–130`).
- **OB-2** ([ASSESS-INSTITUTION-002 §3.1](ASSESS-INSTITUTION-002.md)): room, participant and Proctor writes "hanya sebelum ujian dibuka".
- **OB-3:** the Operator sees "ELLIGBLE ID dan rombel setiap peserta, serta ELLIGBLE ID pengawas yang ditugaskan … Nama, NISN, tanggal lahir, jawaban, nilai dan isi soal tidak ditampilkan."
- **OP-7 A and RP-5:** placement, mark ready and pre-open room writes need no reason. Neither covers running controls; OC-4 does.
- **O05-4, O05-5, A04-2** (assigned to ASSESS-ROOM-001): the running transfer, its session continuity and its transaction. Not in this Task.
- **A04-3** (assigned to ASSESS-ROOM-001 and this Task): "Keep the per-request join to the current room, with no cached scope. The old room's Proctor loses access at commit."
- **OD-07:** high-risk actions are one actor with mandatory reason, explicit confirmation and audit; no score edits, grading or cheating verdicts for the Operator. **OD-07b:** the Operator organizes "readiness, open, pause and end".
- **D04.4-26D (LOCKED):** "A subject teacher does not automatically obtain whole-exam or cross-room monitoring rights merely because they teach the subject." **D04.4-26E:** institution-managed assessment is supervised through explicit operational or Proctor assignment.
- **D04.2-69 (LOCK concept):** activation "automatic … at scheduled time" or "manual … by authorized staff"; "Exact modes later". OC-2 decided the manual mode by the Operator.
- **P5:**
  - A06 (:105): the School Operator acts "only own tenant and authorized school-wide participant control scope, drilled to exam/room/participant"; "Proctor add-time denied"; "Operator's own submitted operational reason may accompany its action receipt under P02, not a grant to read other staff's private reasons; no score edit/export". Unresolved: "O05 institution control composition; O03/O08 sensitive reason/retention details".
  - A10 (:109): "Write organizer schedule/readiness/open/pause/end/room/participant assignments in scope. No Operator keys, scores, grading, score edits or cheating verdicts".
  - A05 (:104): the Proctor writes "lock/unlock/messages only".
  - :152: "No new account directory, identity export, raw proof storage or cross-tenant lookup is permitted."
- **ASSESS-INSTITUTION-002 residual risks handed to this Task:**
  - R2: institution exams cannot open until this Task.
  - R5: the subject Teacher's monitoring scope of an institution exam stays exam-wide until this Task.
  - R6: "this Task's activation must refuse an institution exam that is not TRUE/TRUE".
  - R12: the READY-move overlap with ASSESS-ROOM-001; not changed here.
  - R14: "lock FOR UPDATE only the exams that are SCHEDULED or READY; an exam that has left those states never returns to them and can be refused without a lock."
- **Card acceptance** (TASK_PLAN:419): "School Operator sees authorized school exam → room → participant status and approved operations with reason/confirmation/audit. Preserve monitoring freshness, Teacher-only/assigned authority and no scores/grade edits/cheating verdicts."

### 3.1 Owner decisions (decided 2026-11-09 in chat)

O05-3 names the Operator's controls, but not how they are shared with Proctors, how an exam opens, how the session shortcut treats exams that do not qualify, whether a message needs a reason, what the Operator sees about each participant, or whether Proctors change after opening. P5 leaves "O05 institution control composition" open (:105). Each point changes what users see or do, so it was put to the Owner (00.13 §7). The Owner answered four questions, quoted verbatim:

- **OC-1, the sharing of running controls.**
  - Question: "ASSESS-INSTITUTION-003 (kendali ujian sekolah oleh Operator), OC-1: bagaimana pembagian kendali saat ujian sekolah berjalan?"
  - The Owner chose **"Operator penuh, pengawas ruang (Recommended)"**, whose option text was "Operator membuka, menjeda, melanjutkan dan mengakhiri per ujian atau satu sesi, serta mengunci, mengirim pesan dan menambah waktu. Pengawas ruang tetap mengunci dan mengirim pesan di ruangnya saja."
- **OC-2, how an institution exam opens.**
  - Question: "ASSESS-INSTITUTION-003, OC-2: bagaimana ujian sekolah dibuka?"
  - The Owner chose **"Operator membuka (Recommended)"**, whose option text was "Operator menekan tombol mulai pada jam sesi; kesiapan diperiksa ulang saat dibuka."
- **OC-3 to OC-6, one question.**
  - Question: "ASSESS-INSTITUTION-003, default yang direkomendasikan: OC-3 pintasan sesi menjalankan ujian yang memenuhi syarat dan melewati yang lain beserta sebabnya. OC-4 semua kendali saat ujian berjalan wajib alasan, termasuk pesan. OC-5 Operator melihat status peserta sama dengan layar pengawas, dengan ELLIGBLE ID tanpa nama. OC-6 pengawas tidak dapat diganti setelah ujian dibuka di tugas ini. Setujui semua?"
  - The Owner chose **"Setujui semua default (Recommended)"**.
- **OC-6, asked again** after review finding F7 (§9) named the missing alternative.
  - Question: "ASSESS-INSTITUTION-003, OC-6 (reviewer menemukan opsi yang terlewat): bila pengawas berhalangan setelah ujian sekolah dibuka, apa yang boleh dilakukan Operator?"
  - Options:
    - "Tidak di tugas ini (Recommended)": "Pengawas tidak dapat diubah setelah ujian dibuka; tetap sesuai OB-2 (hanya sebelum ujian dibuka)."
    - "Tambah pengawas pengganti": "...dengan alasan, tanpa mencabut pengawas lama. Ini mengubah OB-2."
    - "Ganti pengawas": "...Ini mengubah OB-2 dan menambah risiko balapan pencabutan."
  - The Owner chose **"Tidak di tugas ini (Recommended)"**.

**Notes on the option sets** (from review 1):
- OC-1: the alternative in which Proctors only watch would have removed P5 A05 rights (:104); the Owner kept them.
- OC-4: the alternative without a separate reason for messages would have amended O05-3 ("messages … with reason, confirmation and audit"); the Owner chose the option that follows O05-3.
- OC-6: both other options would have amended OB-2 ("hanya sebelum ujian dibuka"); the Owner kept OB-2.
- The subject Teacher's absence from supervision is not an Owner choice: it is the LOCKED D04.4-26D (E2).

**What each decision fixes in this contract:**
- **OC-1:** the Operator controls of §4.3 (open, pause, resume and end per exam or per session; lock, unlock, message, added time); Proctor rights unchanged (§4.4); no Proctor pause, end or added time.
- **OC-2:** "Buka Ujian" and the session shortcut "activate" by the Operator, from the session start, with the D04.2-68 re-check (E7, E9); no scheduler and no automatic opening.
- **OC-3:** per-exam outcomes `APPLIED`, `NO_OP` and `SKIPPED` with a skip code, in one action (E9, §4.1); the confirmation lists affected and unaffected exams (§4.6).
- **OC-4:** `reason` is required on every Operator control, the message included (§4.1 `ck_sa_institution_control_reason`, §4.3). Reading the drill-down needs none. A reason is returned only to its author.
- **OC-5:** the participant projection of §4.3 equals the Proctor's, with ELLIGBLE IDs and no names (E5).
- **OC-6:** no Proctor change after opening. Room writes keep refusing an affected exam that is not SCHEDULED or READY; no new Proctor route.

### 3.2 Engineering readings (for the contract review)

- **E1, Operator authority and scope.**
  - The ASSESS-INSTITUTION-001 E1 reading applies: an active `tenant_school_operator_assignments` row, FOR SHARE on writes, re-checked at commit (`operatorWrite`, `operatorRead`). Platform CLI authority is never inherited (A13).
  - The scope is the institution exams of the Operator's own tenant: an exam with a non-null `institution_session_id`. A teacher-managed exam gets 403 on every Operator route. This is the card's "Teacher-only" authority and P5 A06 ("Managing Teacher own teacher-managed …").
  - Within that scope the Operator sees and controls every participant, without a room filter (A06 "school-wide … drilled to exam/room/participant").
  - Combined roles act per assignment (P03): an Operator who is also a Proctor acts as Proctor on the Proctor routes and as Operator on these.
- **E2, the subject Teacher (D04.4-26D, LOCKED; OC-1).**
  - `resolveSupervisionScope` counts the teaching assignment only for a teacher-managed exam (`i.institution_session_id IS NULL`). On an institution exam the subject Teacher therefore gets 403 on `exam-monitoring`, `participant-lock`, `add-time` and `broadcast`, unless they hold an active Proctor assignment; then they act in PROCTOR scope, with `managingTeacher` false.
  - Finalization, essay grading, results and export are unchanged: they use `lockManagedExam`, not the supervision scope.
  - **The Teacher card** (F3). Live progress of a running exam is whole-exam monitoring, which D04.4-26D denies and OC-1 leaves with the Operator and the room Proctors. For an institution exam:
    - `teacher-readiness.ts` returns `progress: null` while the exam is ACTIVE or PAUSED, and the counts from ENDED onward, where "Finalisasi Hasil" needs them (`TeacherReadinessView.tsx:361–370`). P01 requires the omission at the server, not only in the UI;
    - the card shows the lifecycle badge, the pause notice while PAUSED, and the line "Ujian ini sedang dilaksanakan. Pemantauan dilakukan operator sekolah dan pengawas ruang. Kemajuan peserta tampil setelah ujian berakhir.";
    - "Pantau Peserta" is not shown.
  - Teacher-managed exams keep their card exactly as today.
- **E3, one core per business action.**
  - `exam-lifecycle-operations.ts`, `participant-lock.ts`, `participant-time.ts` and `exam-broadcast.ts` each export the part after authority as a core function. It takes the client, the tenant, the exam (and participant), the actor person and the state read under the caller's lock.
  - The existing Teacher and Proctor entry points call the same core. Their refusals, lock order, SQL and results do not change; the unchanged suites prove it (C04).
  - The Operator entry points resolve Operator authority, take their locks (§4.2), then call the core with the Operator as actor. The business ledgers therefore name the Operator: lifecycle events `actor_person_id`, 0044 `paused_by_person_id` and `resumed_by_person_id`, 0046 `locked_by_person_id` and `unlocked_by_person_id`, 0050 `actor_person_id` with `reason` and `action_key`, and 0047 `sender_person_id`.
- **E4, the audit ledger.**
  - Operator controls are kept in a new owning-domain append-only ledger (0064, §4.1), as ASSESS-INSTITUTION-001 E9 and ASSESS-INSTITUTION-002 E9 did. It holds actor, time, reason, confirmation, action key, request digest and the outcome per affected exam.
  - 0054 is not widened. Its authority CHECK binds TEACHER or PROCTOR (:43–45), and its key index holds one row per key, which cannot carry one reason over several exams.
  - *Rejected alternative, recorded for the reviewer:* add a SCHOOL_OPERATOR authority to 0054, with per-exam keys derived from the shortcut key. It changes a reviewed SEC-001 constraint and the shared wrapper.
- **E5, the projections** (OB-3, OC-5, P01, P04).
  - **Session read:** for each non-cancelled exam of the session: subject, rombel, lifecycle state, `pausedAt`, counts by status, and per room the label, counts by status, locked count and Proctor ELLIGBLE IDs. Full readiness is evaluated only for READY exams, to say whether "Buka Ujian" passes (cost bound, as ASSESS-INSTITUTION-002 E13).
  - **Exam read:** the exported participant query of `exam-monitoring.ts` with no room filter, so the fields are exactly the Proctor's (OC-5). Added time shows the total to everyone in scope. Each addition shows minutes, time and the ELLIGBLE ID of its actor; its reason only when the viewer is that actor (P5 A06 :105).
  - Both reads carry `serverTime` and use one REPEATABLE READ READ ONLY snapshot, with the scope decided per request (A04-3).
  - Never shown: names, NIS, NISN, birth dates, contact data, session handles or fingerprints, answers, prompts, options, keys, rubrics or scores; no list of members (:152).
- **E6, freshness.** The client reuses the `ExamMonitoringView` behaviour on both screens:
  - an automatic refresh every 20 s and on returning to the tab;
  - "Diperbarui <jam>. Diperbarui otomatis.";
  - a failed refresh keeps the last data with the stale notice "Pemantauan tertunda";
  - a 403 replaces the data with the refused state.

  After a control, the screen refreshes itself; the E2E uses that in-app refresh, never a browser reload (ASSESS-INSTITUTION-002 §11.0.3).
- **E7, opening (OC-2).** The checks run under the exam lock in this order, the first failing one deciding the refusal (and the skip code in a session shortcut):
  1. state: not READY gives `invalid_state` with `currentState`;
  2. room flags: an institution exam whose room flags are not TRUE/TRUE gives `room_setup_required` (ASSESS-INSTITUTION-002 R6); a room write of ASSESS-INSTITUTION-002 sets the flags and re-checks readiness;
  3. window: before the window start `window_not_started` with `windowStartsAt`, from the window end `window_closed` (D04.2-70);
  4. readiness: the final re-check including rooms and Proctors gives `not_ready` with `readiness` (D04.2-68).

  Steps 1, 3 and 4 are the existing activation core in its existing order; step 2 is inserted by the Operator entry point before the core. The duration and the late-start rule are unchanged.
- **E8, pause, resume and end.** The existing core and semantics (`exam-lifecycle-operations.ts:11–20`):
  - pause records the boundary (0044) and freezes every running attempt;
  - resume closes it;
  - end stops new starts; running attempts finish by submission or their own expiry; nothing is force-submitted and no result becomes visible;
  - a repeat that already took effect is `NO_OP`;
  - END of a PAUSED exam is refused with `invalid_state` (resume first), as for teachers. This is a recorded residual of the existing semantics, not a new rule (R11).
- **E9, the session shortcut (O05-3, OC-3).**
  - The body names a `sessionId` instead of an `examInstanceId`. Cancelled exams are excluded.
  - Each action has a from-state and, where a repeat is idempotent, a to-state that gives `NO_OP`:
    - activate: from READY; no `NO_OP` state;
    - pause: from ACTIVE; `NO_OP` in PAUSED;
    - resume: from PAUSED; `NO_OP` in ACTIVE;
    - end: from ACTIVE; `NO_OP` in ENDED.
  - **Locking (F5):** the exams are read without a lock. Only those whose read state is the from-state or the `NO_OP` state are taken FOR UPDATE, in id order, and read again (§4.2). An activate shortcut therefore never locks an ACTIVE exam.
  - **Outcomes:**
    - a locked exam in the from-state is evaluated by the core (E7 for activate) and is `APPLIED`, or `SKIPPED` with the code of its first failing check;
    - a locked exam in the `NO_OP` state is `NO_OP`;
    - a locked exam that moved to another state while waiting is `SKIPPED` with `invalid_state` and its current state;
    - an unlocked exam is `SKIPPED` with `invalid_state` and the state read.
  - **Why an unlocked skip is sound** (the E13 argument): an exam in neither state can reach the from-state only by a forward step that commits after the read, such as a SCHEDULED exam marked ready. The shortcut is then ordered before that step, and its skip reflects the state it read. Every other state (ENDED, FINALIZED, ARCHIVED, ACTIVE for activate) never returns to the from-state.
  - **Skip codes:** `invalid_state`, `room_setup_required`, `window_not_started`, `window_closed` and `not_ready`, in the E7 order.
  - The action row and its entries are written when at least one exam is `APPLIED` or `NO_OP`. When every exam is `SKIPPED`, the answer is 409 `nothing_applicable` with the per-exam list, and nothing is written.
- **E10, participant controls.** Lock and unlock in ACTIVE, PAUSED or ENDED on the open attempt; added time in ACTIVE or PAUSED with time left, 1 to 120 minutes; a message in ACTIVE, PAUSED or ENDED to the exam, one room row of that exam, or up to 200 selected participants, under the existing rate limit per sender and exam. All bounds are the existing ones; no new value is chosen.
- **E11, replay.**
  - Every Operator control carries an `actionKey`. A row with that key, the same kind, actor and digest returns the original receipt with `replayed: true`, rebuilt from the action row and its entries and never re-evaluated. Another kind, actor or digest gives 409 `action_key_reused`.
  - **Replay bodies:**
    - one exam: `{examInstanceId, lifecycleState: resulting_state, changed: outcome = 'APPLIED', replayed: true}`;
    - one session: `{sessionId, action, results: [{examInstanceId, outcome, previousState, resultingState, skip?: {code, currentState?}}], replayed: true}`, in id order. `windowStartsAt` and `readiness` of a skip are not stored, so a replayed skip carries only its code and the state read;
    - lock: `{participantId, locked: resulting_state = 'LOCKED', changed: outcome = 'APPLIED', lockedAt, replayed: true}`, with `lockedAt` from the 0046 row;
    - added time and message: the existing replay of the core (0050 by action key; the 0047 row by `broadcast_id`), with `replayed: true`.
  - One key cannot serve two routes (`uq_sa_institution_control_action_key`).
  - An added-time key also lives in the 0050 index shared with the Teacher route, so a key used there gives `action_key_reused` here.
- **E12, lock order:** §4.2.
- **E13, R14 (room writes).** `lockSessionExams` reads the session's exams without a lock, then takes FOR UPDATE, in id order, only those that were SCHEDULED or READY, then reads their state again.
  - An exam that is not SCHEDULED or READY is never locked. It refuses the write with `invalid_state` only when the write affects it, as today (ASSESS-INSTITUTION-002 E10).
  - An exam that left those states while the write waited is refused the same way when affected.
  - The lifecycle never returns to SCHEDULED or READY from ACTIVE or later, so no locked decision depends on an unlocked exam.
  - The room write takes the session lock first, as the session shortcut does, so the two serialize.
- **E14, routes.** Flat paths in the `institution-exams` namespace, under `supervision`, with ids in the body or query (ASSESS-INSTITUTION-001 E10, ASSESS-INSTITUTION-002 E14).
- **E15, client placement.**
  - "Pelaksanaan Sesi" opens `SchoolExamMonitoringView` from a session of `InstitutionExamView` as an in-view screen, without a URL parameter, as ASSESS-INSTITUTION-002 E15 did. `App.tsx` is unchanged.
  - The participant level is the shared `ExamMonitoringView`. It gains an optional `source` adapter (load, lock, add time, broadcast). The default adapter is today's client functions, so every existing caller behaves as before; its copy changes only as E20 says. `AddTimeDialog` and `BroadcastComposer` take the same adapter; under OC-4, `BroadcastComposer` shows `ActionReasonField` when the adapter requires a reason.
  - `ExamMonitoringView` treats the `OPERATOR` scope as whole-exam: `wholeExam` (:198) becomes `data.scope === 'TEACHER' || data.scope === 'OPERATOR' || !exam.roomBased`.
  - `TimeAddition.reason` becomes optional in `types/assessment.ts`, and `ParticipantTime` renders an addition without a reason (another actor's addition seen by an Operator, E5). For the Teacher projection the field is still always present.
  - These follow the Global UI/UX Consistency Contract (living plan §10.1): one supervision screen for every role.
- **E16, E2E file name.**
  - The new spec is `99j-institution-supervision.spec.ts`; it sorts after `99i`.
  - The product refuses sessions in the past, and activation needs an open window. Fixture SQL therefore stores the synthetic questions, closes the deadline and moves the session and exam window to the current time, as `99i` used fixture SQL for content and state.
- **E17, this Task and its successors.**
  - **ASSESS-ROOM-001:** owns moves of READY, ACTIVE or PAUSED participants (O05-4, O05-5, A04-2, C19; TASK_PLAN:429). The drill-down reads the current room per request (A04-3), so its moves appear without a change here. The R12 overlap stays for its contract.
  - **ASSESS-PROCTOR-003:** owns the risk feed and incidents (O08, A08, C20; TASK_PLAN:439). Nothing here classifies, scores or concludes.
- **E18, teacher-managed exams.** Every route, scope, refusal and screen behaves as today. The core extraction (E3) is behaviour-preserving; C04 proves it.
- **E19, session end.** No automatic end: D04.2-69 modes are not chosen beyond OC-2, and an unattended action would have no actor (OP-3 rationale). Added time may run past the session end, as for teacher-managed exams (R5).
- **E20, role-neutral copy** (F4). Copy that names the Teacher as the actor is untrue for institution exams. Each line below serves both kinds of exam, so it becomes role-neutral and stays accurate for teacher-managed exams, where the Teacher is the "petugas ujian":

  | Place | Today | New |
  |---|---|---|
  | `StudentExamWorkstation.tsx:814` | "Tetap di halaman ini. Soal tampil kembali setelah guru melanjutkan ujian." | "Tetap di halaman ini. Soal tampil kembali setelah ujian dilanjutkan." |
  | `AssignedExamDiscovery.tsx:216`, with a time | "Ujian dibuka <waktu> setelah guru atau pengawas membukanya." | "Ujian dibuka <waktu> setelah petugas ujian membukanya." |
  | `AssignedExamDiscovery.tsx:216`, without a time | "Menunggu guru atau pengawas membuka ujian." | "Menunggu petugas ujian membuka ujian." |
  | `AssignedExamDiscovery.tsx:217` | "Ujian sedang dijeda oleh guru atau pengawas." | "Ujian sedang dijeda oleh petugas ujian." |
  | `ExamMonitoringView.tsx:184` | "Daftar peserta hanya dapat dilihat oleh pengawas yang ditugaskan atau guru yang mengelola ujian ini." | "Daftar peserta hanya dapat dilihat oleh petugas yang berwenang atas ujian ini." |
  | `ExamMonitoringView.tsx:217` | "Sisa waktu peserta berhenti dan jawaban tidak dapat diubah sampai guru melanjutkan ujian." | "Sisa waktu peserta berhenti dan jawaban tidak dapat diubah sampai ujian dilanjutkan." |
  | `ExamMonitoringView.tsx:352`, last sentence | "\"Waktu ditambah\" berarti guru yang mengelola ujian menambah waktu pengerjaan peserta itu." | "\"Waktu ditambah\" berarti petugas yang berwenang menambah waktu pengerjaan peserta itu." |
  | `ParticipantTime.tsx:51` (`forbidden`) | "Hanya guru yang mengelola ujian ini yang dapat menambah waktu." | "Anda tidak berwenang menambah waktu untuk ujian ini." |

  The other `forbidden` lines of `TeacherExamCancel`, `TeacherExamParticipants` and `TeacherExamReschedule` serve teacher-managed exams only and stay. Student behaviour, data and layout are otherwise unchanged.
- **E21, the exam lock of participant controls.** `lockInstitutionExam` takes FOR UPDATE and `institution-exams.ts` stays forbidden. The new module therefore has its own variant, `keyShareInstitutionExam`: the same query and refusal (403 for anything but this tenant's institution exam) with `FOR KEY SHARE OF i`, the lock every attempt writer and the supervision path take. Per-exam transitions use `lockInstitutionExam` (FOR UPDATE).

**Recorded deviations from proposed (not locked) documents:**
- The card's `participant-lock.ts`, `participant-time.ts`, `supervision-scope.ts`, `server.ts`, `school-exam-monitoring.ts`, `SchoolExamMonitoringView.tsx` and `test/integration/school-exam-monitoring.test.ts` are kept.
- The card's `e2e/tests/14-school-supervision.spec.ts` becomes `99j-institution-supervision.spec.ts` (E16).
- P3 F06 nested paths become flat paths (E14).

## 4. Contract

### 4.1 Schema (migration `0064_secure_assessment_institution_controls.sql`, new)

- **Pattern:** idempotent, as 0060–0063; history row `0064_secure_assessment_institution_controls`.
- **Ownership:** Secure Assessment.
- **Person columns** have no DB foreign key, as in 0061–0063.
- **Reason form** used below: `char_length(reason) BETWEEN 1 AND 200 AND btrim(reason) = reason`, the 0054 form; the server normalizes as `normalizePermissionReason` does.

**`secure_assessment_institution_control_actions`:**

| Column | Definition |
|---|---|
| `id` | `uuid` primary key, default `gen_random_uuid()` |
| `tenant_id` | `uuid NOT NULL` |
| `session_id` | `uuid NOT NULL`; FK `(session_id, tenant_id)` → `secure_assessment_institution_exam_sessions (id, tenant_id)` (`uq_sa_institution_session_ref`), RESTRICT |
| `exam_instance_id` | `uuid NULL`; FK `(exam_instance_id, tenant_id)` → `secure_assessment_exam_instances (id, tenant_id)`, RESTRICT. NULL only for a session-wide transition |
| `participant_id` | `uuid NULL`; FK `(participant_id, tenant_id, exam_instance_id)` → `secure_assessment_exam_participants (id, tenant_id, exam_instance_id)` (0032 `uq_sa_exam_participant_id_tenant_instance`), RESTRICT |
| `kind` | `text NOT NULL`, `ck_sa_institution_control_kind`: `kind IN ('TRANSITION', 'PARTICIPANT_LOCK', 'TIME_ADD', 'BROADCAST')` |
| `action` | `text NOT NULL`, `ck_sa_institution_control_action`: `(kind = 'TRANSITION' AND action IN ('activate', 'pause', 'resume', 'end')) OR (kind = 'PARTICIPANT_LOCK' AND action IN ('lock', 'unlock')) OR (kind = 'TIME_ADD' AND action = 'add_time') OR (kind = 'BROADCAST' AND action = 'message')` |
| `reason` | `text NOT NULL`, `ck_sa_institution_control_reason`: the reason form (OC-4) |
| `confirmed` | `boolean NOT NULL CHECK (confirmed)` |
| `actor_person_id` | `uuid NOT NULL` |
| `acted_at` | `timestamptz NOT NULL DEFAULT statement_timestamp()` |
| `action_key` | `uuid NOT NULL` |
| `request_digest` | `text NOT NULL`, `ck_sa_institution_control_digest`: `request_digest ~ '^[0-9a-f]{64}$'` |

**Constraints:**
- `uq_sa_institution_control_action_ref` UNIQUE `(id, tenant_id)`;
- `uq_sa_institution_control_action_key` UNIQUE `(tenant_id, action_key)`, shared by every kind;
- `ck_sa_institution_control_target`:
  - `kind = 'TRANSITION' AND participant_id IS NULL`, or
  - `kind IN ('PARTICIPANT_LOCK', 'TIME_ADD') AND exam_instance_id IS NOT NULL AND participant_id IS NOT NULL`, or
  - `kind = 'BROADCAST' AND exam_instance_id IS NOT NULL AND participant_id IS NULL`;
- index `(tenant_id, session_id, acted_at)`.

**`secure_assessment_institution_control_entries`:** one per affected exam of an action.

| Column | Definition |
|---|---|
| `id` | `uuid` primary key |
| `tenant_id` | `uuid NOT NULL` |
| `action_id` | `uuid NOT NULL`; FK `(action_id, tenant_id)` → actions `(id, tenant_id)`, RESTRICT |
| `exam_instance_id` | `uuid NOT NULL`; FK `(exam_instance_id, tenant_id)` → `secure_assessment_exam_instances (id, tenant_id)`, RESTRICT |
| `participant_id` | `uuid NULL`; FK `(participant_id, tenant_id, exam_instance_id)` → `secure_assessment_exam_participants (id, tenant_id, exam_instance_id)` (0032 `uq_sa_exam_participant_id_tenant_instance`), RESTRICT. Set for lock and added time |
| `attempt_id` | `uuid NULL`; FK `(attempt_id, tenant_id, participant_id)` → `secure_assessment_exam_attempts (id, tenant_id, exam_participant_id)` (0054 `uq_sa_attempt_permission_scope`), RESTRICT, as 0054 ties its attempt to its participant. Set for lock and added time |
| `broadcast_id` | `uuid NULL`; FK `(broadcast_id, tenant_id, exam_instance_id)` → `secure_assessment_exam_broadcasts (id, tenant_id, exam_instance_id)` (0047 `uq_sa_exam_broadcast_scope`), RESTRICT. Set for a message |
| `outcome` | `text NOT NULL CHECK (outcome IN ('APPLIED', 'NO_OP', 'SKIPPED'))` |
| `previous_state` | `text NULL`, `ck_sa_institution_control_entry_previous`: `previous_state IS NULL OR previous_state IN ('SCHEDULED', 'READY', 'ACTIVE', 'PAUSED', 'ENDED', 'FINALIZED', 'LOCKED', 'UNLOCKED')` |
| `resulting_state` | `text NULL`, `ck_sa_institution_control_entry_resulting`: the same domain |
| `skip_code` | `text NULL CHECK (skip_code IN ('invalid_state', 'room_setup_required', 'window_not_started', 'window_closed', 'not_ready'))` |

**Constraints:**
- `ck_sa_institution_control_entry_skip`: `(outcome = 'SKIPPED') = (skip_code IS NOT NULL)`;
- `ck_sa_institution_control_entry_target`: `(participant_id IS NULL) = (attempt_id IS NULL)`;
- `uq_sa_institution_control_entry_exam` UNIQUE `(action_id, exam_instance_id)`;
- index `(tenant_id, exam_instance_id)`.

**Guard triggers,** with named SQLSTATEs as the 0063 guard. Both compare with `IS DISTINCT FROM`, so a NULL `institution_session_id` (a teacher-managed exam) always fails:
- **BEFORE INSERT on actions:** an `exam_instance_id` whose `institution_session_id IS DISTINCT FROM session_id` raises `check_violation` with `CONSTRAINT = 'ck_sa_institution_control_session'`.
- **BEFORE INSERT on entries** (F1): it reads the entry's action. It raises `check_violation` with `CONSTRAINT = 'ck_sa_institution_control_entry_scope'` when:
  - the entry exam's `institution_session_id IS DISTINCT FROM` the action's `session_id`; or
  - the action names an exam and the entry's `exam_instance_id` differs from it; or
  - the action names a participant and the entry's `participant_id` differs from it, or the action names none and the entry names one; or
  - the entry's states do not fit the action's kind: lifecycle states for `TRANSITION`, `LOCKED`/`UNLOCKED` for `PARTICIPANT_LOCK`, both NULL for `TIME_ADD` and `BROADCAST`; or a `SKIPPED` entry under an action that names an exam (only a session-wide transition skips).

With both guards, no row of either table can name a teacher-managed exam or an exam of another session.

**Append-only:** both tables refuse UPDATE and DELETE with triggers, following 0053, 0062 and 0063.

Nothing else in the schema changes: 0005, 0044, 0046, 0047, 0050, 0054, 0062 and 0063 keep every column, constraint and trigger. No data is migrated.

### 4.2 Authority, transactions, lock order and errors (`school-exam-monitoring.ts`, new)

The §4.2 frame of ASSESS-INSTITUTION-001 applies through the exported `operatorWrite` and `operatorRead`:
1. Exact body keys and shapes are checked before any connection; otherwise 400 `invalid_request`. A `reason` that normalizes to nothing or to more than 200 characters, or `confirmed` other than `true`, is 400.
2. Authentication, `BEGIN`, the action-key advisory lock `sa-institution:<tenant>:control:<key>`, and re-authentication with the Operator assignment FOR SHARE; otherwise 403 `forbidden`.
3. Replay (E11).
4. The object locks below, then the scope check: a session or exam that is not this tenant's institution object gives 403 `forbidden`.
5. The checks and the core (E3), then the action row and entries.
6. Re-authentication, then `COMMIT`.

**Lock order** (the engineering detail of O05's approved "serialized-transition design" (TASK_PLAN §8 :626), resolved by the executor as ASSESS-INSTITUTION-001 §4.2 and ASSESS-INSTITUTION-002 E6 did; 00.13 §5.1):
- **Per-exam transition:** the exam row FOR UPDATE (`lockInstitutionExam`, the lock of every lifecycle change), then the core. No session lock is taken, so it cannot form a cycle with a session lock holder.
- **Session-wide transition** (E9, F5):
  1. the session advisory lock of ASSESS-INSTITUTION-002 (`lockSession`, `'sa-institution-rooms:' || tenant || ':' || session`), shared with room writes;
  2. the non-cancelled exams of the session read without a lock;
  3. FOR UPDATE, in id order, only the exams whose read state is the action's from-state or its `NO_OP` state; then their state read again;
  4. the core per locked exam, in id order. The other exams are `SKIPPED` from the unlocked read.
- **Participant lock and added time:** the exam row FOR KEY SHARE (`keyShareInstitutionExam`, E21; the supervision order, `participant-lock.ts:45–46`), the participant check, the open attempt FOR UPDATE, then the core. This is the order of every attempt writer.
- **Message:** the order of `sendExamBroadcast`, with the Operator authority in place of the supervision scope.
- **Room writes** (ASSESS-INSTITUTION-002 E6) keep their order, with step 4 narrowed (E13).

The Operator assignment is taken FOR SHARE before any exam lock. Its revocation holds no exam lock, so no cycle arises.

**Errors** (`institutionControlFailure`, run before the unchanged `institutionFailure`):

| Condition | Answer |
|---|---|
| 23505 on `uq_sa_institution_control_action_key` or 0050 `uq_sa_timer_adj_action_key` | 409 `action_key_reused` |
| 23505 on `uq_sa_institution_control_entry_exam`, 0044 `uq_sa_exam_pauses_open` or 0046 `uq_sa_attempt_locks_open` | 409 `state_changed` (unreachable under the locks; mapped so a race never answers 500) |
| 23514 on `ck_sa_institution_control_session` or `ck_sa_institution_control_entry_scope` | 403 `forbidden` (unreachable through the routes; mapped so a defect never answers 500 or writes) |
| A core result `invalid_state` | 409 `invalid_state` with `{examInstanceId, currentState}` |
| `not_ready` | 409 `not_ready` with `readiness` |
| `window_not_started` | 409 `window_not_started` with `windowStartsAt` |
| `window_closed` | 409 `window_closed` |
| an institution exam that is not TRUE/TRUE on activate (E7 step 2) | 409 `room_setup_required` |
| every exam `SKIPPED` in a session-wide transition | 409 `nothing_applicable` with `results` |
| `no_active_attempt`, `not_started`, `time_up` | 409 with the same code |
| `rate_limited` | 429 `rate_limited` with `retryAfterSeconds`, as the existing route |
| `no_recipients` | 409 `no_recipients`, as the existing route |

`institutionFailure` itself is unchanged: 40001 and 40P01 give 409 `state_changed`, connection failures 503 `persistence_unavailable`, an unknown 23505 409 `state_changed`, anything else 500.

**Object scope:**
- A session or exam that is not this tenant's institution object, including a teacher-managed exam, gives 403 `forbidden`, byte-identical for a foreign and a nonexistent id.
- A participant that is not a participant of the named exam gives 403 `forbidden` (the existing rule of the lock and time routes). A room that is not a room row of the named exam gives 403.

### 4.3 Operator routes

**`GET /api/v1/assessment/institution-exams/supervision?sessionId=`** (exactly one query key):
`{session: {sessionId, periodLabel, startsAt, endsAt}, serverTime, exams: [SupervisedExam]}`.
- **`SupervisedExam`** = `{examInstanceId, subjectLabel, groupLabel, lifecycleState, pausedAt | null, counts: {participants, notStarted, active, submitted, locked}, rooms: [{label, counts, proctors: [{elligbleId}]}], readiness: {baseline, roomProctor} | null, roomPolicy}`.
  - It covers every non-cancelled exam of the session, ordered by subject then rombel.
  - `readiness` is evaluated only for READY exams (E5); `roomPolicy` is false when the room flags are not TRUE/TRUE.
  - Rooms are ordered by label; counts come from the same snapshot.

**`GET /api/v1/assessment/institution-exams/supervision/exam?examInstanceId=`** (exactly one query key):
the `ExamMonitoring` shape of `exam-monitoring.ts` with `scope: 'OPERATOR'` and `canAddTime: true`.
- `participants` are every participant of the exam (E1, E5); `rooms` are the exam's room rows; `broadcasts` are its messages.
- `timeAdditions` per participant: `{addedAt, seconds, by: {elligbleId, you}, reason?}`, with `reason` only where `you` is true.

**`POST /api/v1/assessment/institution-exams/supervision/transition`:** body exactly `{examInstanceId, action, reason, confirmed, actionKey}` or exactly `{sessionId, action, reason, confirmed, actionKey}`; `action` is one of `activate`, `pause`, `resume`, `end`.
- **One exam:** E7 or E8 through the core, then one action row and one entry. Answer 200 `{examInstanceId, lifecycleState, changed, replayed}`.
- **One session:** E9. Answer 200 `{sessionId, action, results: [{examInstanceId, outcome, previousState, resultingState, skip?: {code, currentState?, windowStartsAt?, readiness?}}], replayed}`, results in id order.
- A replay of either answers 200 with the body of E11.

**`POST /api/v1/assessment/institution-exams/supervision/participant-lock`:** body exactly `{examInstanceId, participantId, action, reason, confirmed, actionKey}`; `action` is `lock` or `unlock`.
- The core of `participant-lock.ts`, then one action row and one entry (`LOCKED`/`UNLOCKED`, `APPLIED` or `NO_OP`).
- Answer 200 `{participantId, locked, changed, lockedAt, replayed}`.

**`POST /api/v1/assessment/institution-exams/supervision/add-time`:** body exactly `{examInstanceId, participantId, minutes, reason, confirmed, actionKey}`; `minutes` 1 to 120.
- The core of `participant-time.ts` with the Operator as actor; the 0050 row carries the reason and the same `actionKey`; then one action row and one entry.
- Answer 200 `{participantId, addedSeconds, totalAddedSeconds, remainingSeconds, addedAt, replayed}`.

**`POST /api/v1/assessment/institution-exams/supervision/broadcast`:** body exactly `{examInstanceId, target, message, reason, confirmed, actionKey}`; `target` as `parseBroadcastTarget`, with `roomId` a room row of that exam.
- The core of `exam-broadcast.ts`; then one action row and one entry with `broadcast_id`.
- Answer 200 `{broadcastId, sentAt, recipients, replayed}`.

**Route coverage:**
- `route-parity.test.ts` CALLS gains the six client functions (§4.8).
- `metrics.ts` `COMPONENT_BY_PATH` gains the two GET paths, `supervision/transition`, `supervision/participant-lock` and `supervision/add-time` as `monitoring`, like the existing supervision paths (:53–58), and `supervision/broadcast` as `broadcast`, as `exam-monitoring/broadcast` is mapped (:59).
- The Origin check, the 64 KiB body limit and 413 apply as for every Operator route.

### 4.4 Teacher, Proctor and Student surfaces

- **Subject Teacher** (E2):
  - `exam-monitoring`, `exam-monitoring/participant-lock`, `exam-monitoring/add-time` and `exam-monitoring/broadcast` give 403 for an institution exam, unless the Teacher holds an active Proctor assignment there (then PROCTOR scope).
  - `teacher-exams/transition` keeps `institution_managed` for every action except finalize.
  - `teacher-readiness` returns no progress for an institution exam while ACTIVE or PAUSED, and the counts from ENDED (E2, F3). The card shows the running line of E2 instead of the counts, never shows "Pantau Peserta" for an institution exam, and keeps "Finalisasi Hasil" with its counts from ENDED.
  - Finalize, essays, essay grading, results and export are unchanged.
- **Proctor** (OC-1): unchanged. An assigned Proctor monitors, locks, unlocks and sends messages in their rooms, with the existing reason rule. Pause, end and added time stay unavailable. Every Operator route gives a Proctor 403.
- **Student:** a paused exam, a lock, added time and messages appear exactly as they do for teacher-managed exams. The only change is the role-neutral copy of E20, for both kinds of exam.
- **Shared supervisor screen:** the role-neutral copy of E20 for every viewer.

### 4.5 Room writes (R14, `institution-rooms.ts`)

Only `lockSessionExams` changes (E13):
1. Read the session's exams and states without a lock.
2. Take FOR UPDATE, in id order, only the exams that were SCHEDULED or READY.
3. Read the states again.

`requireEditable` and every other step of ASSESS-INSTITUTION-002 §4.3 are unchanged, so the outcomes of I-1 to I-18 there are unchanged. `lockSession` is exported unchanged.

### 4.6 Client

**Entry** (`InstitutionExamView.tsx`):
- A session heading gains the action "Pelaksanaan Sesi" when the session has a non-cancelled exam that is READY, ACTIVE, PAUSED or ENDED.
- It replaces the period view with `SchoolExamMonitoringView`. "Kembali ke Ujian Sekolah" restores the period view, refreshes it, and returns focus to the trigger.

**Session screen** (`SchoolExamMonitoringView`, new), in the shared `Page`:
- **Header:**
  - the back action "Kembali ke Ujian Sekolah" above the header (the shared back-button pattern, whitespace-normal, at least 44 px; ASSESS-INSTITUTION-002 §11 departure 3);
  - title "Pelaksanaan Sesi" (`tabIndex=-1`, focused on entry);
  - description "Jadwal Sesi: <tanggal>, <jam mulai> sampai <jam selesai>. Pantau setiap ujian, ruang dan peserta di sesi ini. Setiap tindakan memerlukan alasan dan dicatat.";
  - "Diperbarui <jam>. Diperbarui otomatis." and the action "Perbarui".
- **Summary:** `MetricList layout="narrowFirst"` with "Ujian", "Berlangsung", "Dijeda" and "Peserta mengerjakan".
- **"Tindakan untuk Seluruh Sesi"** (`ActionGroup`): "Buka Semua Ujian", "Jeda Semua Ujian", "Lanjutkan Semua Ujian" and "Akhiri Semua Ujian", each shown when at least one exam qualifies.
- **"Ujian di Sesi Ini"** (`ExamListCard`, `h2` section, `h3` cards), in a `grid-cols-1` list whose items take `min-w-0`:
  - title: the subject; facts: "<rombel> · <n> peserta · <m> mengerjakan · <k> dikumpulkan", and "Dijeda sejak <jam>" when paused;
  - status: the lifecycle badge;
  - one line per room: "<ruang>: <n> peserta, <m> mengerjakan, <k> dikunci. Pengawas: <ELLIGBLE ID>, …";
  - for a READY exam, the readiness line from `readinessBlockerMessage`, or "Siap dibuka.";
  - actions by state: READY "Buka Ujian"; ACTIVE "Jeda Ujian" and "Akhiri Ujian"; PAUSED "Lanjutkan Ujian"; ACTIVE, PAUSED and ENDED "Pantau Peserta".
- **"Pantau Peserta"** replaces the session screen with `ExamMonitoringView` and the Operator adapter, back label "Kembali ke Pelaksanaan Sesi"; returning restores focus to that trigger.
- **Dialogs** (each: `permissionDialogClass`, `ActionReasonField`, one action key kept on retries, retry focus via `useRetryFocus`; on success focus goes to the success notice, because the refresh may remove the trigger; otherwise back to the trigger):
  - "Buka Ujian <mapel> · <rombel>?": "Peserta dapat mulai mengerjakan sampai <jam selesai>. Kesiapan diperiksa ulang saat ujian dibuka."; action "Buka Ujian".
  - "Jeda Ujian <mapel> · <rombel>?": "Sisa waktu setiap peserta berhenti dan jawaban tidak dapat diubah sampai ujian dilanjutkan."; action "Jeda Ujian".
  - "Lanjutkan Ujian <mapel> · <rombel>?": "Peserta melanjutkan dengan sisa waktu masing-masing saat dijeda."; action "Lanjutkan Ujian".
  - "Akhiri Ujian <mapel> · <rombel>?": "Peserta baru tidak dapat mulai. Peserta yang sedang mengerjakan tetap dapat menyelesaikan sampai waktunya habis. Tidak ada hasil yang ditampilkan."; action "Akhiri Ujian".
  - The session dialogs ("Buka Semua Ujian di Sesi Ini?" and the three others) list "Akan terkena:" and "Tidak terkena:" with "<mapel> · <rombel>" and the cause, then one reason field (OC-3, OC-4).
- **Participant level** (`ExamMonitoringView` with the Operator adapter): the same list, filters, lock dialog, "Tambah Waktu" and message composer as for supervisors, whole-exam (E15). Under OC-4 the message composer shows the reason field. An addition by another actor is listed without its reason.
- **Teacher card** (`TeacherReadinessView.tsx`, E2): for an institution exam in ACTIVE or PAUSED, the lifecycle badge, the pause notice when paused, and "Ujian ini sedang dilaksanakan. Pemantauan dilakukan operator sekolah dan pengawas ruang. Kemajuan peserta tampil setelah ujian berakhir."; no counts and no "Pantau Peserta". From ENDED, the counts and "Finalisasi Hasil" as today. The pause notice (`TeacherReadinessView.tsx:334–341`) moves outside the `DELIVERY_STATES.has(lifecycle) && exam.progress` condition, so it shows for a PAUSED exam whenever `pausedAt` or the PAUSED state is known, also when `progress` is null; for teacher-managed exams it renders exactly as today.
- **Role-neutral copy:** the eight lines of E20.
- **Success notices:**
  - "Ujian <mapel> · <rombel> dibuka." / "… dijeda." / "… dilanjutkan." / "… diakhiri."
  - session: "<n> ujian dibuka." (and "dijeda", "dilanjutkan", "diakhiri"), followed by "<m> ujian tidak terkena." when some were skipped.
  - lock, unlock, added time and message: the existing supervisor notices.
- **Refusal and skip copy:**

| Code | Copy |
|---|---|
| `not_ready` | "Ujian belum siap dibuka: <pesan kesiapan>." |
| `window_not_started` | "Ujian baru dapat dibuka mulai <jam>." |
| `window_closed` | "Waktu sesi sudah berakhir, jadi ujian tidak dapat dibuka." |
| `room_setup_required` | "Ruang dan pengawas ujian ini belum diatur. Atur lewat Ruang dan Pengawas." |
| `invalid_state` | "Status ujian sudah berubah. Pilih Perbarui untuk melihat status terbaru." |
| `nothing_applicable` | "Tidak ada ujian di sesi ini yang dapat dikenai tindakan ini." |
| skip `invalid_state` per exam | "<mapel> · <rombel>: status ujian tidak sesuai (<status>)." |
| skip `room_setup_required`, `window_not_started`, `window_closed`, `not_ready` per exam | "<mapel> · <rombel>: " followed by the copy of the same code above |
| `no_active_attempt`, `not_started`, `time_up`, `rate_limited`, `no_recipients` | The existing supervisor copy |
| `invalid_request`, `action_key_reused`, `state_changed`, `forbidden`, network or 503 | The frozen ASSESS-INSTITUTION-001 copy (§4.6 there) |

**Layout lessons applied** (ASSESS-INSTITUTION-002 §11.0.1 and §11.0.2): card and room grids are `grid-cols-1` (two columns only from `md`) with `min-w-0` items; card actions and badges wrap (`h-auto min-h-11 whitespace-normal`, `max-w-full whitespace-normal`); notice descriptions take `min-w-0 break-words`; metric labels never use `overflow-wrap: anywhere`.

### 4.7 Invariants

- **Authority:** every Operator route requires an active School Operator assignment of the tenant, re-checked at commit; only institution exams of that tenant are reachable. Subject Teachers have no supervision and no live progress of a running institution exam (D04.4-26D); Proctors keep exactly A05.
- **Assessment state** (V07): the Operator's pause, resume, end, lock and added time go through the same cores as the Teacher's, so remaining time, capture-time rules, pause boundaries and lock boundaries are identical. END publishes nothing; no attempt is reopened.
- **Audit:** every applied or no-op Operator control writes exactly one action row with its entries; every refusal writes nothing.
- **Locks:** the lock order of existing actions is unchanged. Room writes no longer lock exams outside SCHEDULED and READY (E13).
- **Data:** no Operator response, log or audit row carries a name, NIS, NISN, birth date, prompt, option, key, rubric, score or answer; no reason of another actor is returned; no member directory.
- **Teacher-managed exams** behave as today on every route.
- **UI:** Bahasa Indonesia with no em dash in UI copy; times in the school zone; only shared primitives and tokens; 44 px targets; focus never falls to BODY after a send or after a control removes itself.

### 4.8 Existing assertions that change (only these)

- **`runtime/secure-assessment/test/route-parity.test.ts` CALLS:** gains `getInstitutionSupervision`, `getInstitutionSupervisionExam`, `postInstitutionSupervisionTransition`, `postInstitutionSupervisionLock`, `postInstitutionSupervisionTime` and `postInstitutionSupervisionBroadcast`.
- **The role-neutral copy of E20** (F4), exactly these assertions and no others (found by searching every test and spec for each replaced text):
  - `frontend/web/src/__tests__/startAttempt.test.tsx:74`: "Menunggu guru atau pengawas membuka ujian." becomes "Menunggu petugas ujian membuka ujian.";
  - `frontend/web/src/__tests__/participantTime.test.tsx:153`: the `forbidden` copy becomes "Anda tidak berwenang menambah waktu untuk ujian ini.";
  - `e2e/tests/7-teacher-cancel.spec.ts:49`: the filter `/Ujian dibuka .+ setelah guru atau pengawas membukanya\./` becomes `/Ujian dibuka .+ setelah petugas ujian membukanya\./`.

  No test or spec asserts the other five replaced lines (`StudentExamWorkstation.tsx:814`, `AssignedExamDiscovery.tsx:217`, `ExamMonitoringView.tsx:184`, :217 and :352).

The following stay unchanged and must pass as they are:
- every other runtime suite, including `exam-monitoring`, `participant-lock`, `participant-time`, `exam-broadcast`, `exam-pause`, `teacher-operations`, `teacher-readiness`, `permission-enforcement`, `institution-exams` and `institution-rooms`. No existing test uses the subject Teacher's supervision of an institution exam (`institution-rooms.test.ts:488` uses the Proctor) or the progress of an institution exam while ACTIVE or PAUSED;
- every other web suite, including `examMonitoring`, `examMessages`, `examPause`, `TeacherReadinessView`, `teacherOperations`, `institutionExams` and `institutionRooms`;
- every other E2E spec, `99h` and `99i` included. Captures differ only as C07 lists.

### 4.9 Negative coverage (P5 trace)

The P5 enforcement table names for A06 the negatives N01, N02, N03, N04, N07, N08 and N10 (:126), and for A10 N01, N02, N03, N04, N07 and N08 (:130).

| Route | P5 row | N-ids asserted (C03) |
|---|---|---|
| GET `institution-exams/supervision` | A06, A10 | N01, N02 (foreign `sessionId` → 403), N03, N04, N10 |
| GET `institution-exams/supervision/exam` | A06 | N01, N02 (foreign or teacher-managed exam → 403), N03, N04, N07, N10 |
| POST `institution-exams/supervision/transition` | A10 | N01, N02 (foreign exam or session → 403), N03, N04, N07, N08, N10 |
| POST `institution-exams/supervision/participant-lock` | A06 | N01, N02 (a participant of another exam or tenant → 403), N03, N04, N07, N08, N10 |
| POST `institution-exams/supervision/add-time` | A06 | N01, N02, N03, N04, N07, N08, N10 |
| POST `institution-exams/supervision/broadcast` | A06 | N01, N02 (a room or participant of another exam → 403), N03, N04, N07, N08, N10 |
| The four existing supervision routes, subject Teacher of an institution exam | A05, A06 | N04 (403), and N07 (a Teacher assigned as Proctor keeps only the room scope) |
| GET `teacher-readiness`, subject Teacher of an institution exam | A10, A11 | P01: no `progress` while ACTIVE or PAUSED |
| The Teacher and supervisor routes, School Operator without a Teacher or Proctor assignment (F6) | A04, A05, A06, A11 | N04: 403 with zero mutation on `teacher-exams/results` (GET) and its export (POST `format` `csv` and `print`), `teacher-exams/essays`, `teacher-exams/essays/grade`, `teacher-exams/transition` with `finalize`, and the four `exam-monitoring` routes, for an institution exam and for a teacher-managed exam |

What each N-id means here:
- **N01:** anonymous gives 401; no membership or another tenant gives 403; an unavailable database gives 503 with nothing written.
- **N02:** ids swapped across tenants, sessions, exams, rooms and participants; a foreign and a nonexistent id get byte-identical bodies.
- **N03:** the other tenant's Operator, an Operator whose assignment is revoked, and actor A, a person signed in with a membership of the school but no school-role assignment (no School Operator, Teacher, Proctor, Homeroom or Student role), on every Operator route: 403 with zero mutation. The platform operator of P5 N03 "Platform Admin attempting school action" (:53) and A13 exists only as the provisioning CLI's `authorize` callback (`kind: 'platform_operator'`, `identity-allocation.test.ts:25`); it has no product session and no product route, so N03 is covered for it by that absence. Platform CLI authority is never inherited.
- **N04:**
  - a Teacher (the subject Teacher included), a Proctor, a Homeroom Teacher and a Student on every Operator route: 403;
  - the School Operator, holding no Teacher or Proctor assignment, on the Teacher result, essay and finalize routes and the four `exam-monitoring` routes: 403 with zero mutation (F6). No Operator score, grade edit or verdict route exists.
- **N07:** authority at commit.
  - An Operator assignment revoked while a control waits on its lock gives 403, with nothing written.
  - A Proctor removed before opening gets 403 on `exam-monitoring` after opening; the per-request scope is re-read on every call (A04-3).
- **N08:**
  - `actorPersonId`, `tenantId` or any key outside the exact body gives 400; a missing reason or `confirmed` other than `true` gives 400.
  - Altered replay input, or one key reused on another Operator control route or on the Teacher's added-time route, gives `action_key_reused`.
  - Every refusal leaves equal before/after counts in the action, entry, lifecycle event, pause, lock, timer adjustment and broadcast tables.
- **N10:**
  - A disallowed Origin on the POST paths gives 403 `origin_not_allowed`; a body over 64 KiB gives 413 `payload_too_large`. Both come before any database effect.
  - The GET paths follow the accepted reading of ASSESS-INSTITUTION-001 §11.1 (SameSite=Strict, no CORS).

## 5. Expected vectors

**Fixture:**
- **Tenant 1** (Asia/Jakarta):
  - session S1, its window moved to the current time by fixture SQL, holding E1 (Matematika × X, three students, "Ruang 1" with Proctors P1 and P3) and E2 (Fisika × Y, two students, "Ruang 1" with P1, and "Ruang 2" with P2), both READY with questions and the deadline passed;
  - session S2 on a later day holding E3 (READY);
  - teacher-managed exam TM of Teacher T2, ACTIVE;
  - Teacher T (subject Teacher of E1), Student s1 of X, Operators O and O', Homeroom Teacher H, and actor A, signed in with a membership of the school but holding no school-role assignment (N03).
- **Tenant 2:** Operator O2 with an ACTIVE institution exam.

| # | Case | Expected |
|---|---|---|
| I-1 | Drill-down and tenant scope | O's session read of S1 lists E1 and E2 with rooms, counts and Proctor ELLIGBLE IDs; TM is absent. O2 gets 403 on S1; O gets 403 on tenant 2's session, byte-identical with a nonexistent id |
| I-2 | Open one exam (OC-2) | O opens E1 with a reason: ACTIVE, a lifecycle event by O, one action row and one `APPLIED` entry. Refusals, each writing nothing:<br>• E3 (window not started): `window_not_started`;<br>• the D04.2-68 re-check, before E1 is opened: fixture SQL sets `revoked_at` on both Proctor assignments of E1 while it is READY (restored afterwards), skipping the RP-3 re-check of the room route (`institution-rooms.ts:494–509`), so E1 stays READY with incomplete coverage; opening gives `not_ready` with the room blocker. (Removing them through the room route would demote E1 under RP-3, and opening would give `invalid_state`.);<br>• a READY exam with FALSE/FALSE: `room_setup_required`;<br>• the E7 order: a READY FALSE/FALSE exam before its window gives `room_setup_required`, not `window_not_started` |
| I-3 | Session shortcut (OC-3) | With E1 READY and E2 SCHEDULED, "activate" on S1 applies E1 and skips E2 with `invalid_state`; one action row, two entries, one reason. A shortcut where every exam is skipped gives 409 `nothing_applicable` and writes nothing |
| I-4 | Pause, resume, end (V07) | Pause by O freezes every running attempt's remaining time at the boundary (0044 `paused_by` O); answers after the boundary are refused; resume continues from the frozen remaining time; end stops new starts while a running attempt finishes at its own expiry. A repeat is `NO_OP`; END of a PAUSED exam gives `invalid_state` |
| I-5 | Lock and unlock | O locks s1 with a reason: the 0046 row by O, writes refused while locked, time still running; unlock restores. A missing reason gives 400 with nothing written |
| I-6 | Added time | O adds 10 minutes to s1: the 0050 row by O with the reason and key, remaining time +600 s. P1 sees the total; O sees the reason of its own addition; O' sees the addition without its reason. 121 minutes gives 400; an expired attempt gives `time_up` |
| I-7 | Messages | O sends to E2, to E2 "Ruang 2" and to one participant: recipients fixed at send, 0047 sender O, one action row with `broadcast_id`. A room id of E1 sent with E2 gives 403. The rate limit gives 429 |
| I-8 | Subject Teacher (D04.4-26D) | T gets 403 on `exam-monitoring`, lock, add-time and broadcast of E1; `teacher-exams/transition` keeps `institution_managed`. T's `teacher-readiness` carries no `progress` for E1 while ACTIVE or PAUSED, and the counts once ENDED. T assigned as Proctor of "Ruang 1" sees only "Ruang 1" with no added-time control. After END, T still finalizes E1 |
| I-9 | Proctor unchanged | P2 monitors only "Ruang 2" of E2, locks with a reason and sends messages there; P2 gets 403 on every Operator route, on added time and on the Teacher transition |
| I-10 | Target substitution and roles | Every Operator route with a foreign session, exam, room or participant gives 403, byte-identical with a nonexistent id; TM through the Operator routes gives 403. T, P1, s1, H, O2 and actor A get 403 with zero mutation on every Operator route (N03, N04); the CLI-only platform operator has no product session to test (§4.9). O, holding no Teacher or Proctor assignment, gets 403 with zero mutation on `teacher-exams/results` and its CSV and print export, `teacher-exams/essays`, `teacher-exams/essays/grade`, `teacher-exams/transition` with `finalize`, and the four `exam-monitoring` routes, for E1 and for TM (F6) |
| I-11 | Stale state and revoked role | O's assignment revoked while a pause waits on the exam lock gives 403 with nothing written. P3 removed from "Ruang 1" through the room route while E1 is READY (P1 still covers the room, so RP-3 demotes nothing) gets 403 on `exam-monitoring` of E1 once O has opened it, while P1 keeps "Ruang 1". A second tab pausing an already paused exam gets `NO_OP`; a second "Buka Ujian" gets `invalid_state` |
| I-12 | Duplicate control and replay | The same key and body replays with no new row. The same key with another body, or on another Operator route, or on the Teacher's added-time route, gives `action_key_reused`. O and O' pausing E1 at once: one `APPLIED`, one `NO_OP`. A session pause racing a per-exam end serializes on the exam lock |
| I-13 | Audit evidence | Every applied control has one action row (actor, time, reason, `confirmed`, key, digest) and its entries, and the business ledger names O. UPDATE and DELETE on both 0064 tables are refused. Every refusal of I-2 to I-12 leaves equal before/after counts |
| I-14 | Running exams are not locked (R14, F5) | With E1 ACTIVE and E2 READY in S1, while another connection holds E1 FOR KEY SHARE (as an answer save does), each case below completes without waiting under a 1 s lock timeout:<br>• a room write affecting only E2 succeeds; a room write affecting E1 gives `invalid_state` with nothing written;<br>• the "activate" shortcut on S1 opens E2 and skips E1 with `invalid_state` (ACTIVE) without locking it.<br>A "pause" shortcut does take E1 FOR UPDATE, as the Teacher's pause does, and waits for the holder |
| I-15 | Freshness and per-request scope | After O pauses E1, the next exam read shows PAUSED with `pausedAt` and a later `serverTime`; no cached scope survives a revocation (I-11) |
| I-16 | Minimization | No Operator response contains `fullName`, `name`, `nis`, `nisn`, `birthDate`, `membershipId`, `prompt`, `options`, `correct`, `rubric`, `score` or `answer` keys, or another actor's reason |
| I-17 | Teacher-managed regression | T2 opens, pauses, locks, adds time and sends messages on TM exactly as before, with the SEC-001 rows; every existing suite passes with only the §4.8 changes. The Student and supervisor screens of TM show the role-neutral copy of E20 and nothing else new |
| I-18 | Migration 0064 | Upgrade on a populated database creates both tables and both guards; a repeat is a no-op; a synthetic rollback leaves nothing. Raw inserts refused with their named constraint:<br>• an action naming an exam of another session, or TM: `ck_sa_institution_control_session`;<br>• an entry whose exam belongs to another session or is TM, an entry of E2 under an action naming E1, an entry naming a participant the action does not name, a `SKIPPED` entry under an exam action, or a lock entry with lifecycle states: `ck_sa_institution_control_entry_scope`;<br>• an entry with s1's participant and another participant's attempt: the `(attempt_id, tenant_id, participant_id)` foreign key;<br>• an entry state outside the domain: `ck_sa_institution_control_entry_previous` or `…_resulting` |
| I-19 | Edge (N10) | A disallowed Origin on each POST path gives 403 `origin_not_allowed`; a 65 KiB body gives 413; zero mutation |

## 6. Exact proposed file scopes (to be frozen at READY)

| # | Path | Purpose |
|---|---|---|
| 1 | docs/production/tasks/ASSESS-INSTITUTION-003.md | Contract, history, evidence (Task-flow) |
| 2 | docs/production/TASK_PLAN.md | Status, counters, ASSESS-INSTITUTION-002 landing (Task-flow) |
| 3 | docs/production/PRODUCTION_COMPLETION_PLAN.md | Status (Task-flow) |
| 4 | docs/DOCUMENT_MANIFEST.md | Index (Task-flow) |
| 5 | docs/production/CBT_ARCHITECTURE_DELTA_REVIEW.md | Appended checkpoint: the 0064 control ledger and its two guards |
| 6 | database/migrations/0064_secure_assessment_institution_controls.sql | §4.1 |
| 7 | runtime/secure-assessment/src/school-exam-monitoring.ts | Session and exam reads, the four controls, `keyShareInstitutionExam` (E21), `institutionControlFailure` (new) |
| 8 | runtime/secure-assessment/src/exam-lifecycle-operations.ts | Exported transition core, teacher behaviour unchanged (E3) |
| 9 | runtime/secure-assessment/src/participant-lock.ts | Exported lock core (E3) |
| 10 | runtime/secure-assessment/src/participant-time.ts | Exported added-time core (E3) |
| 11 | runtime/secure-assessment/src/exam-broadcast.ts | Exported send core (E3) |
| 12 | runtime/secure-assessment/src/exam-monitoring.ts | Exported participant projection with an Operator viewer (E5) |
| 13 | runtime/secure-assessment/src/supervision-scope.ts | Teaching assignment counts only for teacher-managed exams (E2) |
| 14 | runtime/secure-assessment/src/teacher-readiness.ts | No `progress` for an institution exam while ACTIVE or PAUSED (E2, F3) |
| 15 | runtime/secure-assessment/src/institution-rooms.ts | `lockSessionExams` narrowed (E13); `lockSession` exported |
| 16 | runtime/secure-assessment/src/server.ts | Six routes |
| 17 | runtime/secure-assessment/src/metrics.ts | Six `COMPONENT_BY_PATH` entries: five `monitoring`, one `broadcast` |
| 18 | frontend/web/src/types/assessment.ts | Supervision view, control and result types; `scope: 'OPERATOR'`; optional `TimeAddition.reason` |
| 19 | frontend/web/src/api/assessment-client.ts | Six client functions |
| 20 | frontend/web/src/components/InstitutionExamView.tsx | "Pelaksanaan Sesi" entry and return focus |
| 21 | frontend/web/src/components/SchoolExamMonitoringView.tsx | Session screen and control dialogs (new) |
| 22 | frontend/web/src/components/ExamMonitoringView.tsx | Optional `source` adapter; `OPERATOR` whole-exam; role-neutral copy :184, :217, :352 (E15, E20) |
| 23 | frontend/web/src/components/ParticipantTime.tsx | Adapter for `AddTimeDialog`; an addition without a reason; role-neutral `forbidden` copy :51 |
| 24 | frontend/web/src/components/ExamBroadcast.tsx | Adapter and reason field for `BroadcastComposer` (OC-4) |
| 25 | frontend/web/src/components/TeacherReadinessView.tsx | Institution exam in ACTIVE or PAUSED: running line, no counts, no "Pantau Peserta" (E2) |
| 26 | frontend/web/src/components/StudentExamWorkstation.tsx | Role-neutral pause copy :814 (E20) |
| 27 | frontend/web/src/components/AssignedExamDiscovery.tsx | Role-neutral opening and pause copy :216–217 (E20) |
| 28 | runtime/secure-assessment/test/school-exam-monitoring.test.ts | Units (new) |
| 29 | runtime/secure-assessment/test/integration/school-exam-monitoring.test.ts | I-1 to I-19 and the §4.9 map on real PostgreSQL (new) |
| 30 | runtime/secure-assessment/test/route-parity.test.ts | §4.8 only |
| 31 | frontend/web/src/__tests__/schoolExamMonitoring.test.tsx | Session screen, entry, dialogs, focus, copy, adapters, the Teacher card of a running institution exam (new) |
| 32 | frontend/web/src/__tests__/startAttempt.test.tsx | §4.8 only (:74) |
| 33 | frontend/web/src/__tests__/participantTime.test.tsx | §4.8 only (:153) |
| 34 | e2e/tests/7-teacher-cancel.spec.ts | §4.8 only (:49) |
| 35 | e2e/tests/99j-institution-supervision.spec.ts | Five-browser journey and captures (new) |

Rows 1–4 are Task-flow paths; the allowlist is rows 5–35, 31 paths. No row depends on an open point.

**Forbidden:**
- every other file, including `institution-exams.ts`, `permission-action-audit.ts`, `proctor-monitoring.ts`, `managed-exam.ts`, `assigned-exams.ts`, the readiness preflights, `App.tsx`, `lib/status.ts`, `ActionReasonField.tsx`, `TeacherExamCancel.tsx`, `TeacherExamParticipants.tsx`, `TeacherExamReschedule.tsx`, the shared `ui/` primitives, `helpers.ts`, `global-setup.ts` and the test fixtures;
- every existing test file other than rows 30, 32, 33 and 34;
- completed Task records;
- other migrations, 0054 included;
- lockfiles, dependencies and workflows;
- production resources.

## 7. Acceptance gates (DEFINED / NOT EXECUTED)

| Gate | Expected outcome |
|---|---|
| C01 | Units:<br>• the exact-body parsers of the six routes, the reason and `confirmed` rules, the session-or-exam body shapes;<br>• the E7 check order and the E9 table: from-state and `NO_OP` state per action, which exams are locked, each outcome and skip code, and the `nothing_applicable` rule;<br>• the E11 replay bodies;<br>• `institutionControlFailure` over every named constraint and core result;<br>• the projection filters of E5 (no other actor's reason; no forbidden key);<br>• the N10 edge of every new path before any database work |
| C02 | The extracted cores leave every Teacher and Proctor result identical: the `participant-lock`, `participant-time`, `exam-broadcast`, `exam-pause`, `exam-monitoring`, `teacher-operations`, `teacher-readiness` and `permission-enforcement` suites pass unchanged. `ExamMonitoringView`, `AddTimeDialog`, `BroadcastComposer`, `AssignedExamDiscovery` and `StudentExamWorkstation` render every existing call site as before except the E20 copy |
| C03 | Real PostgreSQL: I-1 to I-19 and every N-id of the §4.9 map through the production-wired server, with before/after table counts for every refusal (V07, V11) |
| C04 | Regression with only the §4.8 changes; teacher-managed exams unchanged apart from the E20 copy (I-17) |
| C05 | Client:<br>• entry, return focus and the participant-level round trip;<br>• the session screen states (loading, empty, refused, failed, stale, success);<br>• each control dialog with reason, retry focus and notice focus;<br>• the session dialogs with the affected and unaffected lists;<br>• refusal and skip copy, `invalid_state` with "Perbarui";<br>• the Operator adapter in the shared supervision components: whole-exam scope, the reason field on messages, an addition without a reason;<br>• the Teacher card of an institution exam in ACTIVE, PAUSED (the pause notice shown with `progress` null) and ENDED;<br>• the E20 copy;<br>• the `narrowFirst` summary without `overflow-wrap: anywhere` |
| C06 | Five-browser E2E (`99j`). Setup: a session placed through the product on a later day; questions, deadline and window by fixture SQL (E16); rooms and Proctors through the product; `pengawas.e2e` given and later revoked the School Operator assignment, as `99h` and `99i` do; `guru.e2e` as subject Teacher.<br>Journey:<br>• the Operator opens "Pelaksanaan Sesi" and opens the exam with a reason;<br>• the Student starts; the Operator's drill-down shows "Mengerjakan" after the in-app refresh;<br>• the Operator locks and unlocks the Student, adds time and sends a message, and the Student sees each;<br>• the Operator pauses the whole session and resumes it; the Student sees the pause with "Soal tampil kembali setelah ujian dilanjutkan.";<br>• the subject Teacher's card shows the running line, no counts and no "Pantau Peserta";<br>• the Proctor sees only their room;<br>• a stale second tab gets `invalid_state` on a repeated "Buka Ujian";<br>• the Operator ends the exam, and the Teacher card shows the counts and "Finalisasi Hasil".<br>Shared helpers and the in-app refresh only |
| C07 | Rendered evidence (`workspace-institution-supervision-*`):<br>• **Baseline:** the five `workspace-visual-*` artifacts of the post-merge `main` CI of PR #36, fetched with the resumable, size- and `unzip -t`-checked transfer; manifest recorded at READY step 1.<br>• **After:** the session screen (READY, running, paused, ended), each control dialog, a session dialog with skipped exams, a refusal, the participant level as Operator, and the Teacher card of a running institution exam.<br>• **Conditions:** the frozen widths 360, 390, 430, 768, 1024, 1280, 1440 and 640×360, and 200 % text at 390×844 and 1280×800.<br>• **Pass criteria:** no page overflow; targets ≥ 44 px; visible and managed focus (never BODY after a send or after a control removes itself); no mid-word breaks in metric labels; buttons and badges wrap at 200 % text; rendered review PASS.<br>• **Earlier captures** (F4): compared by screenshot dimensions and hashes. Differences are limited to the "Pelaksanaan Sesi" session action, the E20 copy where a capture shows it (Student discovery and workstation pause, the supervisor list notes, the paused alert, the added-time refusal), times and generated IDs. Teacher-managed captures may change only in that copy; every other earlier capture is pixel-identical.<br>• **Budget:** at most ten scenarios, so the E2E job keeps its budget (R7) |
| C08 | Scope inside rows 1–35; 33 Tasks and 78 edges; exact-SHA attempt-1 eight-job CI; no re-run |
| C09 | Independent contract, implementation and rendered review PASS; Delegated Acceptance; evidence commit; delegated merge |

**CI-first order,** as ASSESS-INSTITUTION-002 §7:
1. Registration, carrying the ASSESS-INSTITUTION-002 landing and the baseline manifest.
2. Implementation, whose exact-SHA CI passes before review.
3. Implementation and rendered review by the same reviewer.
4. Delegated Acceptance and the evidence commit.
5. PR-head CI, the delegated squash merge, then post-merge main CI.

No re-runs, and no push while the previous commit's CI runs.

**Honest limits and risks:**
- **R1, O09 coverage.** P5 approval excluded the O05 institution composition (:96, :142) and left the Operator control composition unresolved (:105). The Owner's OC-1 to OC-6 cover this Task's controls and projection. A reviewer is never a §8 authority (00.13 §4.1). PB05 stays OPEN.
- **R2, first real opening.** This Task makes institution exams openable. Nothing is deployed (G7); no real student data before LEGAL-001.
- **R3, the subject Teacher loses a latent capability** (E2): supervision and live progress of a running institution exam. Neither was reachable, because no institution exam could open.
- **R4, the session shortcut's locks** (§4.2, E9, F5). It takes FOR UPDATE only the exams in the action's from-state or `NO_OP` state. An activate shortcut never locks an ACTIVE exam. A pause or end shortcut locks the ACTIVE exams it acts on, which is the lock the Teacher's per-exam pause and end take; answer saves of those exams wait for the shortcut's transaction, which spans every such exam of the session.
- **R5, added time past the session end:** as for teacher-managed exams, added time may let an attempt run past the session's end (existing 120-minute bound). Nothing ends exams automatically (E19). The D04.2-41 room double-booking check of ASSESS-INSTITUTION-002 compares session windows, not extended attempts, so an attempt running past its session can overlap a later session in the same physical room without a warning.
- **R6, no Proctor change after opening** (OC-6): an absent Proctor is covered by the Operator's own supervision.
- **R7, E2E budget:** `99h` and `99i` already need long capture runs; `99j` is bounded to ten scenarios and its set is recorded at READY.
- **R8, reasons are kept without a retention rule** (O03/O08 unresolved, :105), as SEC-001 and ASSESS-INSTITUTION-001 keep theirs.
- **R9, drill-down cost** is bounded (E5: one session, readiness only for READY exams) but not measured against the P6 budgets (PERF-001).
- **R10, READY moves:** ASSESS-INSTITUTION-002 R12 is unchanged; ASSESS-ROOM-001 decides.
- **R11, END of a PAUSED exam needs a resume first,** for the Operator as for teachers (`exam-lifecycle-operations.ts:20`, "not decided" there). An Operator who wants to end a paused session resumes it, then ends it; a session-wide end skips paused exams with `invalid_state`.

## 8. History

- **2026-11-09, contract drafted** under DEC-048 on c11ab1f (task/assess-institution-002, tree equal to `main` after PR #36), after ASSESS-INSTITUTION-002 reached Delegated Acceptance (its §12.4).
  - Approved inputs: O05-1 to O05-4 and A04-1 to A04-3 (ASSESS-QUESTION-001 §4); OP-1 to OP-9 and OB-1 (ASSESS-INSTITUTION-001 §3.1); OB-2, RP-1 to RP-5 and OB-3 (ASSESS-INSTITUTION-002 §3.1); ASSESS-INSTITUTION-002 R2, R5, R6, R12 and R14.
  - Open: OC-1 to OC-6, raised with recommended defaults. Migration 0064 proposed, not reserved.
  - Not reviewed; NOT READY; BLOCKED.
- **2026-11-09, Owner decisions in chat,** quoted in §3.1:
  - OC-1: "Operator penuh, pengawas ruang (Recommended)".
  - OC-2: "Operator membuka (Recommended)".
  - OC-3 to OC-6: "Setujui semua default (Recommended)".
- **2026-11-09, contract review 1 returned STOP** (F1–F7 and non-material notes 1–11, §9).
  - F7 raised OC-6 again with the missing alternatives; the Owner answered "Tidak di tugas ini (Recommended)" (§3.1).
  - Corrections and notes are applied in this revision. All Owner decisions of this Task are decided.
  - Status: NOT READY, BLOCKED, re-review pending.
- **2026-11-09, contract review 2 returned PASS** (§9). Notes 1 and 2 applied after it, with no further round per the reviewer. Status: contract review chain STOP → PASS; formal READY pending (§10).

## 9. Independent contract review

- **Reviewer:** a fresh-context, read-only subagent under the standing Owner designation. The same reviewer reviews the corrections, the implementation and the rendered evidence.
- **Review 1: STOP,** with findings F1–F7. Each correction:
  - **F1, the 0064 guard covered only the actions table.** A BEFORE INSERT guard on entries now requires the entry's exam to belong to the action's session, and to equal the action's exam when one is named, with the participant, state-kind and skip rules. Entries carry `participant_id`, and `attempt_id` is tied to it by the FK `(attempt_id, tenant_id, participant_id)` → attempts `(id, tenant_id, exam_participant_id)`, as 0054 does. Both guards use `IS DISTINCT FROM`, so the statement that no teacher-managed exam can appear is now true for both tables (§4.1; I-18).
  - **F2, two vectors were unreachable.** I-2 now produces the D04.2-68 `not_ready` with fixture SQL that revokes the Proctor assignments, skipping the RP-3 re-check; removal through the room route would demote E1 (`institution-rooms.ts:494–509`, :746) and opening would give `invalid_state`. I-11 now uses "Ruang 1" with two Proctors, so removing P3 demotes nothing (§5).
  - **F3, the Teacher card's live counts** while ACTIVE or PAUSED (`TeacherReadinessView.tsx:334–347`) conflicted with D04.4-26D and OC-1. `teacher-readiness.ts` now omits `progress` for an institution exam until ENDED, and the card shows a running line instead. The earlier reading "counts are not participant monitoring" is withdrawn (E2, §4.4, §4.6; rows 14 and 25; I-8).
  - **F4, copy naming the Teacher** became untrue for institution exams. Eight lines become role-neutral, accurate for both kinds of exam. The two Student files are added, the three affected assertions are listed, and the C07 identity claim now allows that copy only (E20, §4.8, C07; rows 22, 23, 26, 27, 32–34).
  - **F5, the activate shortcut locked ACTIVE exams.** The shortcut now locks only exams in the action's from-state or `NO_OP` state and skips the rest from an unlocked read, by the E13 argument. R4 is restated and I-14 covers it (E9, §4.2, R4, I-14).
  - **F6, the P5 negative trace was incomplete.** N04 now asserts the Operator's 403 with zero mutation on the Teacher result, export, essay, essay grading and finalize routes and on the four `exam-monitoring` routes; N03 adds a Platform Admin or platform-CLI actor (P5 N03 :53, A13) (§4.9; I-10).
  - **F7, OC-6 lacked the alternative of adding a substitute Proctor.** The Owner was asked again with both alternatives and chose "Tidak di tugas ini (Recommended)". Both other options would have amended OB-2 (§3.1).
- **Option-set notes, recorded:** OC-1's alternative in which Proctors only watch would have removed P5 A05 rights; OC-4's alternative would have amended O05-3, and the Owner chose the option that follows O05-3 (§3.1).
- **Non-material notes, each applied:**
  1. `supervision/broadcast` maps to `broadcast` in `metrics.ts`, as :59 does (§4.3).
  2. The replay body of a session-wide action, and of every other control, is defined (E11, §4.3).
  3. The activation check order is state, room flags, window, readiness, and the skip codes follow it (E7, E9, §4.1; I-2).
  4. The Operator adapter counts `OPERATOR` as whole-exam (`ExamMonitoringView.tsx:198`; E15).
  5. `TimeAddition.reason` is optional in the shared types and in `ParticipantTime`; both are in scope (E15; rows 18, 23).
  6. The `invalid_state` copy says "Perbarui" instead of "Muat ulang halaman" (§4.6).
  7. Entries `previous_state` and `resulting_state` have CHECKs (§4.1).
  8. END of a PAUSED exam needing a resume first is a recorded residual (E8, R11).
  9. The §4.2 lock order is recorded as the engineering detail of O05's serialized-transition design, per the ASSESS-INSTITUTION-001/002 precedent.
  10. The D04.2-41 room overlap is added to R5.
  11. The new module has its own FOR KEY SHARE variant, `keyShareInstitutionExam`; `institution-exams.ts` stays forbidden (E21, §4.2; row 7).
- **Review 2: PASS** on the corrected contract, with no further round required by the reviewer. Notes applied after it, as the reviewer listed:
  1. Actor A of N03 and I-10 is concrete: a person signed in with a school membership and no school-role assignment, refused with 403 and zero mutation. The platform operator exists only as the CLI `authorize` callback (`kind: 'platform_operator'`, `identity-allocation.test.ts:25`), has no product session or route, and is covered by that absence (§4.9; fixture and I-10 of §5).
  2. The Teacher card's pause notice moves outside the `DELIVERY_STATES.has(lifecycle) && exam.progress` condition (`TeacherReadinessView.tsx:334–341`), so it shows when `progress` is null (§4.6; C05).

## 10. Formal READY and Build start under DEC-048 — 2026-11-09

- **Eligibility (00.13 §4.1):**
  - ASSESS-INSTITUTION-002 is DONE and landed: PR #36, main e1f2ec46826930862bc69ce76a55c2b251a9cd25, PR-head CI #236, post-merge main CI #237 (run 42620215564) attempt 1 eight SUCCESS.
  - O05 (O05-1 to O05-4) and A04 are approved in [ASSESS-QUESTION-001 §4](ASSESS-QUESTION-001.md); O09 rests on P5, and its O05 exclusion (CBT_PERMISSION_MATRIX.md:96, :142, :105) and the participant detail shown are covered by the Owner's OC-1 to OC-6 (§3.1).
  - Every open point was decided by the Owner (§3.1). No earlier-row or P0 Task is eligible.
- **Review chain:** STOP → PASS (§9). The two notes the reviewer listed with the PASS are applied; the reviewer required no further round.
- **Frozen allowlist:** §6 rows 5–35, 31 paths; rows 1–4 are Task-flow paths. Migration 0064 reserved. No dependency, workflow or production resource.
- **Rendered baseline (step 1):** the five `workspace-visual-*` artifacts of exact-main CI #237 (run 42620215564, e1f2ec4).
  - They were fetched in parallel with the resumable, size- and `unzip -t`-checked transfer.
  - 3450 pairs (2050 `workspace-question-*` from `99`–`99g`, 950 `workspace-institution-*` from `99h` and 450 `workspace-institution-rooms-*` from `99i`), all with frontend tree 4fe5237b74d383e53f6459d037d3cd3f34e2f520.
  - Every screenshot hash matches its JSON; zero overflow; zero targets under 44 px.
  - Manifest, built as in ASSESS-QUESTION-004 §10 over the `workspace-question-*` and `workspace-institution-*` captures: SHA-256 f9aa59d5435d795e648ee0e334d2614e81fae070f880d82f9143fb2c1d16445e.
- **CI-first order:** as frozen in §7. This registration is step 1. No re-runs.
- **Status:** BLOCKED → IN_PROGRESS. Counters: DONE 16, IN_PROGRESS 1, VERIFYING 0, BLOCKED 16.

## 11. Implementation checkpoint — 2026-11-09

- **Registration CI:** CI #238 (run 42634196523, 89515a0) attempt 1 eight SUCCESS.
- **Candidate:** every changed path is in §6 rows 5–35 (31 paths, the frozen allowlist exactly). Status IN_PROGRESS → VERIFYING. 99j records the §10 baseline (run 237, commit, frontend tree, manifest).
- **Local checks** (8 GB executor; typechecks and targeted units only):
  - secure-assessment, web and e2e typecheck clean;
  - runtime units: school-exam-monitoring 10/10, route-parity, metrics, teacher-readiness, institution-rooms and institution-exams, all passing;
  - web units: schoolExamMonitoring 19/19, plus participantTime, startAttempt, examMonitoring, examMessages, examPause, TeacherReadinessView, institutionExams, institutionRooms, assignedExamDiscovery, teacherOperations and designSystemGuard, all passing.
  - The real-PostgreSQL integration file (I-1 to I-19, the §4.9 N-ids, migration 0064) and the 99j journey and captures run in CI only.
- **Implementer departures, for the implementation review:**
  1. The 0064 entry guard lets a state outside the allowed set reach its named CHECK (`…entry_previous` / `…_resulting`), so I-18 sees those constraint names.
  2. E16 fixture: only the exam windows move to now; the session rows stay append-only, so the session times shown remain the placed later day. 99j's fixture SQL also ends any earlier-spec exam overlapping now that shares the students or Proctors (otherwise opening is refused for a schedule conflict), and inserts a second SCHEDULED exam so the session dialog has an unaffected exam.
  3. The 44 px targets, the narrowFirst summary and wrapping rows in ExamMonitoringView, AddTimeDialog and BroadcastComposer apply with the Operator source only, so the earlier supervisor captures stay pixel-identical. Retry focus after a failed message send is also Operator-only.
  4. The broadcast target object must carry exactly its scope's keys.
  5. I-14 asserts "never waits" as finishing within 5 s, not with a 1 s `lock_timeout`.
  6. The session dialog's "Akan terkena / Tidak terkena" lists are predicted on the client; the server decides, and the success notice lists the actual skips.

### 11.0 Implementation review of the working tree (before the first push)

- **Implementation review by the same reviewer: PASS**, with no material finding, on the uncommitted tree over 89515a0 that this commit publishes unchanged apart from §11. Departures 1 to 6 accepted. The reviewer re-ran the runtime units (16) and seven web unit files (84) and the three typechecks, all green; the integration suite and 99j rest on the exact-SHA CI.
- **Notes recorded:**
  - **R15, role-dependent supervision styling** (departure 3): the 44 px targets, narrowFirst summary and wrapping rows are a documented Operator-source prop of the shared supervision screen, forced by the C07 pixel identity of earlier captures. The Teacher and Proctor rendering keeps its existing targets under 44 px; this existing gap is proposed as a UI-SYSTEM follow-up outside this Task.
  - **R16, a contrived same-key deadlock:** a subject Teacher's SEC-001 TIME_ADD on a teacher-managed exam takes the attempt row before `sa-add-time:K`, while the Operator's added time takes `sa-add-time:K` first. With the same random key on the same participant, PostgreSQL detects the deadlock and the loser gets 409 `state_changed` with nothing written. No change.
  - **99j fixture dependency** (departure 2): the fixture ends overlapping SCHEDULED or READY exams by SQL. This is test-only and safe because 99j sorts last in a single-project run.
  - **I-14** asserts "never waits" as finishing within 5 s; the same test proves the pause shortcut does wait on the held lock.
  - **N03 actor A** is a signed-in member with no school role, standing in for "Platform Admin": platform CLI authority has no product session.

### 11.0.1 Exact-content CI of the first candidate

- **CI #239** (run 42640119322, b9cf99f, attempt 1): FAILURE in Runtime. Three subtests of the real-PostgreSQL integration file failed; the rest of C03 passed, Web passed, and the browser and container jobs were skipped.
  - **I-12, a product defect:** the lock replay found its original 0046 row by comparing with the action row time read through a JavaScript `Date`, which drops microseconds. The lock written in the same transaction looked later than the cut-off, so the replay returned an older lock (from I-5) instead of the original receipt E11 requires.
  - **I-13:** a knock-on of I-12, which stopped before its fourth Operator message; the assertion stays.
  - **I-8, a test sequencing error:** the 409 was `stale_write_version` from the answer save, not from ending the exam. The test re-saved an answer already saved in I-5 without its write version. Ending behaves as E8 and I-8 require: running attempts continue and nothing is force-submitted.
- **Correction** (rows school-exam-monitoring.ts and the integration file):
  - the lock replay compares inside the database, joined to the action row by its id, at full precision;
  - the test save helper takes an optional expected write version (default null, so other calls are unchanged), and I-8 sends the stored one; the assertion that the save returns 200 after END is unchanged.
  - Local: runtime typecheck clean; school-exam-monitoring units 10/10.

### 11.0.2 CI #240 diagnosis and controlled executor continuation — 2026-11-10

- **Governance landing and activation:** Owner-approved GOV-EXEC-002 (outside baseline counters), PR #37, squash main 40c8a53d0d0918e0ec9a7f00c08fb4d79c7716b9; content f85a5dcd3a04717fb477e3818790533609747c66 / CI #241 (42657154363) and sole record-only evidence e1d29c7c91d59ed5a18f1d46ee76c25dbc3d8d57 / exact-head CI #242 (42675866491), every job SUCCESS attempt 1. Exact-main CI #243 (42681365739) also eight SUCCESS attempt 1, directly verified 2026-11-10 02:43 WIB. Main author/raw explicit message/no attribution and tree equality to PR head verified. Temporary 00.13 §11 assignment is now EFFECTIVE; no production or release authority changes.
- **Preservation and normal merge:** the existing Task branch/worktree resumed from 5409e847d2debbb40a2aa76153e2d82fa3f6dc34 without repeating contract preparation, READY, Build or completed reviews. Normal merge 72b963206b3f6c7ab13b18ac9f00fb23cf23a341 incorporates current main. Its only conflicts were top checkpoint insertions in the living plan/manifest; both histories were retained. No implementation change in the merge. The original 31-path allowlist, OC-1–OC-6 and migration 0064 remain frozen. Four unrelated AUTH-002 documents in the main checkout and all prior worktrees remain preserved.
- **Exact-content CI #240:** run 42651185452, corrected content 5409e847d2debbb40a2aa76153e2d82fa3f6dc34, attempt 1, terminal FAILURE. Web, Runtime (including real PostgreSQL) and Container SUCCESS. Each of the five browsers passed the earlier 40 tests then failed 99j at line 370 before its first capture. All five job logs show expected Ruang A 5 versus actual 6, with total 7 and Ruang B 1. No cancellation or rerun. This is one failed C06 candidate round, not five correction rounds.
- **Source-grounded test defect:** global-setup.ts seeds six Students; the earlier AUTH-002 journey approves/activates another Student in X-E2E, whose owning Academic enrollment writer is called by claims.ts:366 (student-identity.ts:136–141). Institution placement deliberately includes every current enrollment on the future session date (institution-exams.ts:675–680, :699–704). 99j places all seven in Ruang A then moves its named Student to Ruang B. The new test incorrectly assumed only the six initial Students.
- **Bounded correction, row 35 only:** exact room and running-summary assertions now require Ruang A 6 / Ruang B 1 / total 7, with the independent fixture rationale recorded next to them. No expected value is taken from the product display. All assertions, timeouts, refusals, focus checks, journeys, capture conditions and the ten-scenario budget remain. No runtime/frontend/migration/fixture/helper/workflow/test-gate change. Frontend tree remains ca20fd6748af320e0f76113558b547db05ca10e5.
- **Reviewer continuity:** the Owner expressly designated RENDERED-ASSESS-INSTITUTION-003-CODEX-01, actual fresh-context read-only agent /root/rendered_institution_003, separate from executor/governance reviewer. It found no material STOP left open in the preserved ledger, and verified the pinned web-design-reviewer skill. §§9/11.0 verdicts remain at their original working-tree/publication anchors. The handoff-reported correction PASS is not relabelled as a durable exact-SHA attestation; required final-content delta and rendered reviews remain PENDING on the final verified candidate. No gate waived.
- **Frozen rendered baseline revalidated:** all five #237 artifacts downloaded resumably, exact GitHub sizes/digests and unzip -t PASS. All 3450 PNG/JSON pairs match their screenshot hashes and exact e1f2ec46826930862bc69ce76a55c2b251a9cd25/frontend tree 4fe5237b74d383e53f6459d037d3cd3f34e2f520; 690 pairs per browser, zero metadata overflow/targets below 44 px. Sorted lines "project scenario WIDTHxHEIGHT text1|text2 sha256" plus final LF reproduce frozen manifest f9aa59d5435d795e648ee0e334d2614e81fae070f880d82f9143fb2c1d16445e exactly. This is baseline metadata/hash verification, not a rendered verdict.
- **Current state:** VERIFYING; DONE 16/33 (48.48%), VERIFYING 1, BLOCKED 16, other counters 0; 78 edges unchanged. CI-first continues with this genuine correction's automatic exact-SHA eight-job attempt-1 CI, then the same designated reviewer's final delta/rendered review. No new registration CI, CI re-run, successor, evidence finalization or production action. PB05/PB12 OPEN; CBT-R1 NOT production-ready.

- **Observed local verification before correction publication:** npm --prefix e2e run typecheck PASS (tsc --noEmit); git diff --check and deterministic scope/history/hash guards PASS. Exactly the five expected working paths, cumulative 35 frozen Task paths (31 implementation + four Task-flow), unchanged runtime/frontend/migration content versus 5409e847, unchanged §4/§8 rules and all 33 rows/78 edges, and preserved raw hashes of all four unrelated main-checkout documents. No local PostgreSQL/browser/heavy suite.

### 11.0.3 Return of execution control, CI #244 diagnosis and correction — 2026-11-10

- **Return of execution control (00.13 §11.5):** the Owner ended the temporary Codex assignment ("I am ending the temporary Codex executor assignment and returning exclusive execution control to Claude Code, effective immediately") after Codex reached its usage limit. Claude Code reconstructed the actual Git state under 00.04: branch head = upstream = 1af11ad286dfc64e9d5dd1cc0412766246370536, main 40c8a53d0d0918e0ec9a7f00c08fb4d79c7716b9, five modified allowlisted paths uncommitted, no untracked file; the four AUTH-002 documents of the main checkout and every other worktree untouched. The Codex checkpoint (outside the repository) was used only as a reconstruction aid. Nothing was reset, cleaned, stashed or overwritten.
- **Reviewer designation:** RENDERED-ASSESS-INSTITUTION-003-CODEX-01 prepared its ledger and verified the pinned skill but gave no verdict on any candidate; its context ended with Codex. Under §11.3 the Owner designated, in chat on 2026-11-10, the original Claude reviewer ("Reviewer Claude asli (Recommended)"), the same fresh-context read-only reviewer of the contract (§9), the implementation (§11.0) and the 5409e84 correction (§11.0.1), for the final-content delta and rendered review. Every earlier verdict keeps its anchor; no STOP is open.
- **CI #244** (run 42686933488, 1af11ad, attempt 1): FAILURE in the five browser jobs; Web, Runtime (unit and real PostgreSQL integration) and Container SUCCESS; the 99j journey now passes its room and count checks (the §11.0.2 correction holds). In every browser only the 99j test failed:
  - **Focus after adding time:** after the Operator's added time, the refresh could remove the "Tambah Waktu" opener, and focus fell to BODY.
  - **Capture overflow at 200 % text:** dialog-refusal at 390x844 and 1280x800, and participant-operator at 1280x800 (mobile-360, tablet-768, webkit-390). The capture's text step read each element's computed size after its ancestors had already been doubled, and doubled the root font too, so nested inherited text compounded far beyond 200 % (as the reviewer noted for 99h/99i in ASSESS-INSTITUTION-002 §11.1).
- **Correction** (uncommitted Codex work, preserved, checked and published here; rows 22 ExamMonitoringView.tsx, 23 ParticipantTime.tsx, 26 ExamBroadcast.tsx, 31 schoolExamMonitoring.test.tsx and 35 99j):
  - With the Operator source only, add-time and message dialogs return focus to their opener, or, when the refresh removed it, to "Perbarui" or the back button; a completed action restores focus after the refresh only when focus is on BODY. Three unit tests cover the opener, the removed opener and cancellation.
  - The 99j text step snapshots every element's computed size and line height before any change, sets each to exactly twice its original once, leaves the root unchanged, asserts that every captured element is exactly 200 % and that every original inline style is restored, and records the calibration in each capture JSON. Overflow, 44 px, focus and metric assertions are unchanged. This 99j method differs from the compounding 99h/99i step, for the rendered review to judge.
  - Local: web typecheck clean; schoolExamMonitoring, participantTime, examMonitoring and examMessages 50/50; e2e typecheck clean.

### 11.0.4 Final-content delta review and the exact-content CI of eb7a490

- **Final-content delta review by the Owner-designated original reviewer: PASS** on `git diff 5409e84 eb7a490`. The merge 72b9632 changed documents only; the 1af11ad counts are exact and fixture-grounded (global-setup.ts:15, :101; 9-identity.spec.ts:227); the focus restoration is Operator-only and never overrides focus the user placed; the single-pass 200 % calibration is a legitimate correction of the measurement, not a weakening of C07 (it asserts exact 200 %, restores every inline style, and tests 44 px targets at their real size).
  - **Residual R17:** 99h and 99i still use the compounding 200 % step, so their text2 captures are not measured as 99j; both specs are outside this Task. Proposed as a later UI-SYSTEM or verification follow-up.
  - **Possible flake:** an Operator screen's 20 s self-refresh adding an element during a text2 capture would fail the calibration's snapshot assertion; to be diagnosed as a flake if it occurs.
  - **Focus levels:** at the participant level focus returns to the opener, at the session level to the notice (§4.6).
- **CI #245** (run 42763357265, eb7a490, attempt 1): FAILURE in the five browser jobs; Web, Runtime (unit and real PostgreSQL integration) and Container SUCCESS. In every browser the 99j journey passed the focus and capture steps up to the session pause, then stopped at 99j:377: after signing in, guru.e2e did not show "Pelaksanaan Ujian". guru.e2e is also the Proctor of "Ruang B" in this running exam, so its first workspace is "Ruang Ujian" (AppShell `availableWorkspaces` lists proctor before teacher), existing behaviour this Task does not change.
- **Correction** (row 35 only): the Teacher context opens "Pelaksanaan Ujian" from the "Ruang kerja" navigation before asserting its heading. No assertion removed; local e2e typecheck clean.

### 11.0.5 Rendered review of ced45b3 and its correction

- **CI #246** (run 42768878511, ced45b3, attempt 1): eight SUCCESS. The ced45b3 change (the Teacher context opens "Pelaksanaan Ujian" from the navigation) was reviewed as sound.
- **Rendered review, part 1 (mobile-360, 100 supervision pairs): STOP** on one finding. Calibration and restoration were exact in every text2 capture (ratio 2.00, zero mismatches, root unchanged), and every earlier-capture change was allowed by C07 or pre-existing (the "Pelaksanaan Sesi" action, time and data differences on earlier teacher cards, and the known full-page swings of the compounding 99h step).
  - **F1:** "Perbarui" on "Pelaksanaan Sesi" (SchoolExamMonitoringView.tsx:443) is disabled while it reads, so the browser dropped focus to BODY; all 10 `session-running` captures recorded BODY after 99j's `refreshSupervision`. The same pattern exists on the Operator's participant level (ExamMonitoringView.tsx:304).
- **Correction** (rows 21, 22, 31 and 35): a manual refresh that started from "Perbarui" gives focus back to it once it is enabled again, when focus is on BODY; on the participant level for the Operator source only, so supervisor behaviour and captures are unchanged. Two unit tests cover both screens; 99j's `refreshSupervision` now asserts that "Perbarui" is focused after the refresh. Local: web typecheck clean; schoolExamMonitoring, examMonitoring and participantTime 46/46; e2e typecheck clean.
- **Residual R18:** the same disabled-while-refreshing pattern exists on "Muat Ulang" in InstitutionExamView, on InstitutionRoomManagementView and on the supervisor refresh (ASSESS-INSTITUTION-001/002 and earlier); outside this Task, proposed as a UI-SYSTEM follow-up.
- **Note:** the `session-running` full-page capture is taken while scrolled, so the sticky header is drawn over the page (a capture artifact).

### 11.1 Reviews of the candidate

- **Implementation review by the same reviewer:** PASS on the working tree over 89515a0, published unchanged as b9cf99f (§11.0); PASS on the 5409e84 correction (§11.0.1); after the Owner's re-designation (§11.0.3), PASS on the final-content delta 5409e84 → eb7a490 (§11.0.4). The ced45b3 change is test-only (row 35); the 0da10b3 F1 correction PASS (§11.0.5); both checked in the rendered review.
- **Rendered review by the same reviewer:** STOP (F1, focus after Perbarui) on ced45b3 (§11.0.5), then PASS on 0da10b3 (CI #247 artifacts, all five browsers), with no material finding: exact 200 % calibration and restoration in every text2 capture, zero overflow, zero targets under 44 px, focus on Perbarui in all 50 session-running captures, five WebKit teacher-card-running captures on the documented viewport fallback, and only allowed earlier-capture changes. Residuals R15, R17 and R18 recorded.

## 12. Final evidence and Delegated Acceptance — 2026-11-10

### 12.1 Content and CI

**Final content:** 0da10b3d59d242ec6de5f397ae3061b7f418425b. The registration was 89515a0. Every commit has the Owner as author and committer, with no trailers or AI/tool attribution.

**Exact-content CI:** CI #247 (run 42776097884), push, attempt 1, eight SUCCESS.
- **Runtime:** typecheck, units, and real PostgreSQL 16 integration I-1 to I-19 with the §4.9 N-ids, migration 0064 upgrade, rollback and repeat, the ledger guards, the narrowed locks, replay and the opening preconditions.
- **Web:** typecheck, tests and build. **Container:** image build and smoke test.
- **E2E:** every spec in each of mobile-360, tablet-768, desktop-1280, firefox-1280 and webkit-390, including the 99j journey (C06) and its captures (C07), and the 7-teacher-cancel copy change.

**Rendered evidence:** the five `workspace-visual-*` artifacts of run 42776097884, fetched in parallel with the resumable, size- and `unzip -t`-checked transfer.
- 500 `workspace-institution-supervision-*` pairs, all at commit 0da10b3 (frontend tree 5775c18fd7de4f64796937466a92a5c38251631b). Every screenshot hash matches its JSON; zero page overflow; zero targets under 44 px; every text2 capture calibrated to exactly 200 % and restored. Manifest SHA-256 2c24034590e580dd1a148855d409647c27fdc5cbc2b99cba6684b2dbe29a6141.
- Earlier captures against the #237 baseline differ only where §4.8 and E20 allow (the "Pelaksanaan Sesi" action, the role-neutral copy and the Teacher card running line), plus times, generated IDs and WebKit full-page/viewport fallbacks.

**All runs, preserved without re-run:**

| Run | Result |
|---|---|
| CI #238 (89515a0, registration) | attempt 1, eight SUCCESS |
| CI #239 (b9cf99f) | attempt 1, FAILURE: three PostgreSQL subtests (§11.0.1) |
| CI #240 (5409e84) | attempt 1, FAILURE: 99j count oracle (§11.0.2) |
| CI #244 (1af11ad, Codex) | attempt 1, FAILURE: 99j focus after adding time and the compounding 200 % step (§11.0.3) |
| CI #245 (eb7a490) | attempt 1, FAILURE: 99j Teacher workspace (§11.0.4) |
| CI #246 (ced45b3) | attempt 1, eight SUCCESS; rendered STOP F1, focus after "Perbarui" (§11.0.5) |
| CI #247 (0da10b3) | attempt 1, eight SUCCESS |

CI #241 to #243 belong to GOV-EXEC-002 (§11.0.2).

### 12.2 Independent review

1. **Contract:** STOP (F1–F7), then PASS (§9).
2. **Implementation:** PASS (§11.0), correction PASS (§11.0.1), final-content delta PASS (§11.0.4).
3. **Rendered:** STOP (F1) on ced45b3, then PASS on 0da10b3 (§11.0.5, §11.1).

The same original reviewer, re-designated by the Owner after the temporary executor transfer (§11.0.3); RENDERED-ASSESS-INSTITUTION-003-CODEX-01 gave no candidate verdict. No STOP was bypassed.

### 12.3 Acceptance gates

| Gate | Disposition |
|---|---|
| C01 | PASS: parsers, the opening order and skip codes, replay bodies, reasons and the projection rules (units) |
| C02 | PASS: shared action functions; teacher-managed behaviour unchanged apart from §4.8 |
| C03 | PASS on real PostgreSQL (CI #247): I-1 to I-19, the §4.9 N-ids, migration 0064, the guards, locks, replay and audit evidence |
| C04 | PASS: regression with only the §4.8 assertions changed |
| C05 | PASS: the Operator screens, dialogs and states, focus never on BODY, the Teacher card per D04.4-26D, E20 copy |
| C06 | PASS: the five-browser 99j journey: open, Student, lock, time, message, session pause and resume, Teacher card, Proctor scope, stale tab, end |
| C07 | PASS: the #237 baseline and the after captures across the frozen conditions; exact 200 % text; no overflow; 44 px targets; rendered review PASS |
| C08 | PASS: every changed path is within §6 rows 1–35; 33 Tasks and 78 edges; exact-SHA attempt-1 CI with no re-run |
| C09 | PASS: review chains PASS; Delegated Acceptance below |

### 12.4 Delegated Acceptance (DEC-048, 00.13 §5.4)

Every gate C01–C09 has PASSED with recorded evidence. The independent contract, implementation and rendered reviews PASSED on the final content SHA. ASSESS-INSTITUTION-003 is accepted under DEC-048 and is DONE under 00.12 §5. The Owner may reopen it at any time.

**Residual risks and limits:** R15 (role-dependent supervision styling; the Teacher and Proctor rendering keeps existing targets under 44 px), R16 (the contrived same-key deadlock), R17 (99h and 99i still use the compounding 200 % step), R18 (the disabled-while-refreshing focus pattern in earlier screens), END of a PAUSED exam needs a resume first, and the reason-retention item of A06. Room transfer during running exams belongs to ASSESS-ROOM-001. PB05 and PB12 are OPEN. G7 comes before real data. There is no deployment or release claim.

**Landing:** a delegated squash merge under 00.13 §6, after PR-head CI (this evidence commit) shows eight SUCCESS on attempt 1, followed by post-merge main CI. The next Task's first change records the landing, with DONE 17/33 (51.52%).

### 12.5 PR-head CI of the evidence commit and its correction — 2026-11-10

- **PR #38** opened on evidence head 061009e. **PR-head CI #248** (run 42790115737, attempt 1): FAILURE in webkit-390 only; Web, Runtime (real PostgreSQL), Container and the four other browser jobs SUCCESS. Not merged; no re-run.
- **Cause:** the flake the reviewer foresaw in §11.0.4. During a 200 % capture (99j:457), the Operator screen's 20 s self-refresh replaced three elements, so the calibration's exact assertion "No calibrated element was replaced before capture" received 3. No product behaviour is involved; the same frontend tree passed every browser in CI #247.
- **Correction** (row 35 only): when a text2 snapshot finds replaced or unscaled elements, the variant starts again from a fresh snapshot, at most three times, after restoring every inline style; the exact calibration, restoration, overflow, target and focus assertions are unchanged and decide the final attempt. Local: e2e typecheck clean.
- **Consequence:** §12.1–§12.4 describe content 0da10b3. The final content becomes this correction commit; its exact-content CI, the reviewer's delta and rendered confirmation, and a new evidence entry are recorded below before the merge.
