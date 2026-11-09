# ASSESS-INSTITUTION-002 — In-product rooms, participants and Proctor assignments

## 1. Control state and authority

| Field | Disposition |
|---|---|
| Classification | Active P11 Task; P1 / school-scale exam setup; HIGH risk; R20, R21; P8 V07, V10, V11, V12 |
| Status | **VERIFYING under DEC-048: implementation candidate (§11); formal READY PASS (§10). All Owner decisions are decided: OB-2, RP-1 to RP-5 and OB-3, on 2026-11-09 (§3.1). Contract review chain STOP → PASS (§9)** |
| Objective | Before an institution exam opens, the School Operator, for one session (Jadwal Sesi) at a time:<br>• puts every participant of the session's exams into exactly one physical room;<br>• sets the Proctors of each physical room;<br>• adds students of the exam's rombel who were enrolled after placement.<br>Readiness is re-checked in the same transaction as every change. Coverage gaps, schedule conflicts and room double-booking prevent readiness. Every change is kept as attributable history. No participant is removed (OPEN-05). Teacher-managed exams are unchanged |
| Owner decisions | **Approved inputs:**<br>• O05-1 to O05-4 and A04-1 to A04-3, decided 2026-11-07 ([ASSESS-QUESTION-001 §4](ASSESS-QUESTION-001.md));<br>• OP-1 to OP-9 and OB-1, decided 2026-11-09 ([ASSESS-INSTITUTION-001 §3.1](ASSESS-INSTITUTION-001.md));<br>• OB-2, RP-1 to RP-5 and OB-3, decided 2026-11-09 (§3.1).<br>**Open:** none.<br>Reviewer: the standing Owner-designated read-only subagent reviewer, a fresh one for this Task |
| Execution authority | DEC-048 (00.13).<br>• Internal dependency ASSESS-INSTITUTION-001 is DONE / MERGED: PR #35, main 30a74562b4946a08311de369a96d50eaaa5d6b46. Its PR-head CI #228 (run 42539982836, head 94bd93a) and post-merge main CI #229 (run 42542313684) each passed on attempt 1 with eight jobs SUCCESS. They were read from GitHub on 2026-11-09 and are recorded again in this Task's first change.<br>• O05 is approved (O05-1 to O05-6). O09 rests on the approved P5 content, whose approval excludes "O05 institution … composition" (CBT_PERMISSION_MATRIX.md:96, :142). The Owner closed that gap for rooms, participants and Proctors with OB-2 (§3.1).<br>• The identity fields the Operator sees, which P5 does not settle, are decided by the Owner as OB-3 (§3.1, F9). With every Owner input decided and the independent contract review chain at PASS (§9, 00.13 §4.3), the formal READY transition is pending (§10) |
| Base and branch | main 30a7456; branch task/assess-institution-002; worktree `C:\Projects\ELLIGBLE-institution-002` |
| Parallel safe / cost | No parallel baseline Task; no dependency, vendor, service or cost |

**Authority:**
- **Governance:** [DEC-044](../../00-governance/00.11_CBT_RELEASE_SCOPE_REALIGNMENT.md) (OD-07, OD-07b), [DEC-045 §5](../../00-governance/00.12_AICWDF_ADOPTION_AND_TASK_EXECUTION.md) and [DEC-048](../../00-governance/00.13_STANDING_EXECUTION_DELEGATION.md).
- **Plan and rules:**
  - [TASK_PLAN ASSESS-INSTITUTION-002/§4/§8](../TASK_PLAN.md) (:399–407; O05 and O09 rows of §8; ASSESS-ROOM-001 acceptance :423);
  - [P2 §5 and rows R20/R21](../CBT_DOMAIN_RULES_SPECIFICATION.md) (:73–81, :116–117);
  - [CBT_PERMISSION_MATRIX](../CBT_PERMISSION_MATRIX.md):
    - data rules :45, P04 :90 and :152;
    - rows A04 (:33, :103), A06 (:35, :105), A07 (:36), A09 (:108) and A10 (:39, :109, :130);
    - P01–P03 (:84–88) and N01–N10 (:50–60);
  - [ROUTE_INTERACTION_MATRIX](../ROUTE_INTERACTION_MATRIX.md) F06 (:51), F07 (:52), W10 (:31), W11 (:32);
  - [CBT_UX_SCREEN_AND_INTERACTION_INVENTORY](../CBT_UX_SCREEN_AND_INTERACTION_INVENTORY.md) C18 (:51), U04 (:23);
  - [CBT_VERIFICATION_AND_RELEASE_DOD_PLAN](../CBT_VERIFICATION_AND_RELEASE_DOD_PLAN.md) V07 (:33), V10 (:36), V11 (:37), V12 (:38).
- **Locked discovery rules** ([04.01_SECURE_ASSESSMENT.md](../../01-discovery/04.01_SECURE_ASSESSMENT.md)):
  - D04.1-06 (:91, an exam room is not the rombel) and D04.1-07 (:101, a Teacher is a Proctor only with a separate assignment);
  - D04.2-22 (:1715) and D04.2-23 (:1723): required Proctor coverage and room assignment block READY;
  - D04.2-25 (:1749): READY is re-evaluated after room, Proctor or participant changes;
  - D04.2-40 (:1948): no incompatible simultaneous Proctor assignment "unless explicitly supported";
  - D04.2-41 (:1956): physical room double-booking is detected;
  - D04.2-64 (:2257): a participant added after READY needs authorization, a readiness re-check, a room assignment and audit;
  - D04.4-22 to D04.4-27 (:4517–4719): the operational room, explicit room assignment, manual assignment as the baseline, Proctor scope by room, one current room with recorded history;
  - D04.4-59 (:5527–5531): "Bulk Room Assignment Must Be Reversible Before ACTIVE … After ACTIVE, changes become governed transfers";
  - D04.9-16 (:10956): a mistaken room assignment is reversible with audit.
- **Earlier records:** [ASSESS-INSTITUTION-001](ASSESS-INSTITUTION-001.md) (Operator authority pattern, E1–E17, the record layout, residual risk R4); [ASSESS-QUESTION-001 §4](ASSESS-QUESTION-001.md) (decision text, O05-4 at :80); [ADMIN-001](ADMIN-001.md) D2 (:50, the Operator's roster projection); [AUTH-002](AUTH-002.md) :96 and [AUTH-003](AUTH-003.md) :78 (an ELLIGBLE ID entered by the verifier, resolved through `findAccountByElligbleId`).
- **Schema:** migrations 0008, 0024, 0031–0034, 0052, 0053 and 0062 are reused, and none of them changes (§4.1).

No LOCKED decision or PB status changes. OPEN-05 (participant removal) stays OPEN and is not touched.

## 2. Reuse and bounded gaps

**Reused:**
- **The room model:**
  - exam rooms per ExamInstance (0031);
  - one current room per participant (0032 `uq_sa_exam_participant_room_assignment_participant`);
  - Proctor assignments with `revoked_at` (0008, active-unique index `uq_sa_proctor_assignment_active`);
  - the Proctor room mapping (0033 `uq_sa_exam_proctor_room_assignment_mapping`);
  - the room policy flags and their CHECK (0034).
- **The readiness preflights, unchanged in meaning:**
  - participant room completeness (`exam-instance-participant-room-assignment-completeness-readiness-preflight.ts`);
  - Proctor presence and room coverage (`exam-instance-active-proctor-assignment-presence-readiness-preflight.ts`, `exam-instance-active-proctor-room-coverage-readiness-preflight.ts`);
  - their composition (`exam-instance-conditional-room-proctor-readiness-composition-preflight.ts`) and `evaluateExamReadiness` (`exam-lifecycle-operations.ts:66–80`);
  - the participant and Proctor schedule-conflict check (`exam-instance-participant-proctor-schedule-conflict-readiness-preflight.ts`), extended only for RP-2 (§4.5).
- **The participant addition rule and its provenance tables:**
  - students enrolled in the rombel on the exam day (`exam-provisioning.ts:233–251` `listEnrolledStudents`);
  - the overlap query `overlappingPersonIds` (`teacher-exam-import.ts:283–297`);
  - the append-only 0053 addition and entry rows, written with the statements of `teacher-exam-participants.ts:334–354`;
  - the READY → SCHEDULED re-evaluation with its lifecycle event (`teacher-exam-participants.ts:355–367`, D04.2-25).
- **The Operator frame of ASSESS-INSTITUTION-001,** exported rather than copied: `operatorWrite`, `operatorRead`, `institutionFailure`, `hasExactKeys`, `digestOf` and `lockInstitutionExam` (`institution-exams.ts:74–80`, :251–377, :721–731).
- **The ELLIGBLE ID lookup** `findAccountByElligbleId` (`identity-access/src/provisioning.ts:31`), as the AUTH-002/003 verifiers use it.
- **The per-request supervision scope** (`supervision-scope.ts`): a moved participant or a revoked Proctor leaves the Proctor's scope at commit (A04-3).
- **The projections that already show rooms:**
  - the Student's "Ruang: …" badge (`assigned-exams.ts:99–151`, `AssignedExamDiscovery.tsx:167`);
  - the Proctor's exam list with its room (`proctor-monitoring.ts:85–130`).
- **The shared UI:**
  - the primitives `Page`, `Card`, `Dialog`, `Input`, `NativeSelect`, `Button`, `StatusBadge`, `ExamListCard`, `MetricList`, `ParticipantChoiceList` and `permissionDialogClass`;
  - `roomProctorBlockerText` (`lib/status.ts:99–109`);
  - the dialog hooks `useActionKey` and `useRetryFocus` (`InstitutionExamView.tsx:127`, :139), moved to a shared module (E15).

**Gaps closed:**
- No product path writes a room, a room assignment or a room Proctor. Rooms exist only in test fixtures; Proctors exist only through the platform provisioning CLI (`ops/provisioning/exam.ts:155–176`), exam-wide and without rooms.
- Institution exams are placed with `room_based_operations_enabled = FALSE` and `proctor_per_room_required = FALSE` (`institution-exams.ts:686–692`), so readiness ignores rooms and Proctors.
- When a physical room is shared by several ExamInstances of one session (A04-1), the existing check counts its Proctor as a schedule conflict with themself (`…-schedule-conflict-readiness-preflight.ts:136–160`).
- There is no room or Proctor assignment history and no attribution (A10 :109): the 0032 room assignment keeps only the current row, and the 0033 mapping has no actor.
- Room labels are not unique per exam: the BU-071 verification asserts duplicates are allowed (`database/verification/verify_bu071_…js:238–240`).
- A student enrolled after placement can never join: the subject Teacher's participant addition refuses institution exams (`institution_managed`, ASSESS-INSTITUTION-001 §4.5), and OP-6 A left additions to this Task.

**Excluded:**
- open, pause, resume, end, the session-wide shortcut, Operator lock, unlock, messages and added time, and the Operator drill-down (O05-3, OP-5 A: ASSESS-INSTITUTION-003);
- room changes once an exam is ACTIVE or later (D04.4-59: a governed transfer, ASSESS-ROOM-001), and the reasoned, versioned transfer command of O05-4 (§3.2 E18);
- participant removal (OPEN-05);
- room capacity (D04.4-25 "may be configured"), seats, room renaming and stricter-supervision rooms (D04.4-29);
- assisted allocation beyond a whole-rombel selection (D04.4-24 keeps manual assignment as the baseline);
- any change to teacher-managed exams, to the platform provisioning CLI, or to the Teacher and Proctor monitoring controls.

## 3. Settled inputs, Owner decisions and engineering readings

**Approved before this Task (quoted):**
- **A04-1** ([ASSESS-QUESTION-001 §4](ASSESS-QUESTION-001.md)): "Rooms stay per ExamInstance, and the UI writes one room row per ExamInstance for each physical room."
- **O05-3:** "Open, pause, resume and end per ExamInstance, plus a session-wide shortcut … Teachers and Proctors cannot pause or end institution exams." It is assigned to ASSESS-INSTITUTION-002/003, and OP-5 A placed open, pause, resume and end in ASSESS-INSTITUTION-003. This Task adds no running control and gives Teachers and Proctors nothing. The Proctor already has no pause or end, and the subject Teacher is refused them (`exam-lifecycle-operations.ts:124–130`).
- **O05-4** (ASSESS-QUESTION-001.md:80, assigned to ASSESS-ROOM-001): transfer is "Allowed only within the same tenant and ExamInstance, for a participant who has not submitted or expired, while the exam is READY, ACTIVE or PAUSED. The target room must be covered by a Proctor when the exam's policy requires one." The overlap on READY is read in E18.
- **A04-2 / A04-3** (assigned to ASSESS-ROOM-001): the running transfer updates the current row, writes an append-only history row and compares an `assignment_version`, and supervisor scope stays a per-request join. This Task keeps both possible (E18).
- **OP-6 A** ([ASSESS-INSTITUTION-001 §3.1](ASSESS-INSTITUTION-001.md)): "Tidak ada pengubahan peserta di tugas ini; penambahan peserta di ASSESS-INSTITUTION-002."
- **OP-4 A:** an extension is allowed "selama ujian belum ditandai siap". OP-5 A's "Tandai Siap?" dialog says "tenggat tidak dapat diperpanjang".
- **OP-7 A:** placing an exam and marking it ready take an on-screen confirmation and record actor and time, without a reason; only extension and cancellation carry a reason.
- **ASSESS-INSTITUTION-001 R4:** "a READY institution exam meeting ASSESS-INSTITUTION-002: adding rooms there must re-check readiness, as rescheduling does today."
- **OD-07b:** the School Operator organizes "rooms, participants by rombel, proctor assignment, readiness".
- **P5:**
  - A10 (:109): the Operator writes "room/participant assignments in scope", with "attributable room/Proctor assignment history, no global-admin fallback" and "No Operator keys, scores, grading, score edits or cheating verdicts". P5 :96 and :142 exclude the O05 institution composition from that approval.
  - Data rule :45: "Name/NIS/rombel may be viewed by scoped Teacher/Proctor/School Operator; NISN/birth date only scoped Homeroom Teacher/School Operator in verification (OD-06)".
  - :152: "No new account directory, identity export, raw proof storage or cross-tenant lookup is permitted."

### 3.1 Owner decisions (decided 2026-11-09 in chat)

The Owner answered four questions, quoted verbatim:
- **OB-2, the authority boundary.**
  - Question: "ASSESS-INSTITUTION-002 (ruang, peserta, pengawas ujian sekolah) butuh keputusan Owner. Batas wewenang OB-2: Operator boleh membuat ruang di setiap sesi, menempatkan peserta ke ruang, menambah peserta dari rombel, serta menetapkan dan mencabut pengawas, hanya sebelum ujian dibuka dan tanpa melihat isi soal atau nilai. Guru dan pengawas tidak mendapat wewenang baru. Tidak ada penghapusan peserta. Setuju?"
  - The Owner chose **"Setuju batas ini (Recommended)"**.
- **RP-1, RP-2, RP-4 and RP-5.**
  - Question: "Default yang direkomendasikan untuk ASSESS-INSTITUTION-002: RP-1 setiap ujian sekolah wajib punya ruang dan minimal satu pengawas per ruang (juga ujian yang sudah ditempatkan). RP-2 satu ruang boleh berisi peserta beberapa ujian di sesi yang sama; satu pengawas satu ruang per sesi. RP-4 pengawas adalah anggota sekolah yang bukan siswa dan bukan peserta pada waktu yang sama. RP-5 tidak ada alasan wajib sebelum ujian dibuka; perubahan dikonfirmasi di layar, pelaku dan waktu dicatat. Setujui semua?"
  - The Owner chose **"Setujui semua default (Recommended)"**.
- **RP-3.**
  - Question: "RP-3 untuk ASSESS-INSTITUTION-002: apa yang terjadi bila ruang, peserta, atau pengawas pada ujian sekolah yang sudah Siap diubah?"
  - The Owner chose **"Periksa ulang (Recommended)"**, whose option text was "Tetap Siap bila masih lengkap, kembali ke Terjadwal bila tidak. Tenggat tidak dapat diperpanjang untuk ujian yang pernah Siap."

What each decision fixes in this contract:
- **OB-2:**
  - The routes, refusals and negatives of §4.2–§4.4 and §4.9 implement this boundary.
  - It names the Operator's actions. It does not name the identity fields the Operator sees; those are OB-3.
- **RP-1:**
  - Placement writes TRUE/TRUE.
  - Migration 0063 writes TRUE/TRUE on the institution exams that are SCHEDULED.
  - The first room write that affects any institution exam that is not TRUE/TRUE (a READY exam placed before 0063) sets TRUE/TRUE in its own transaction, then re-checks readiness (E7). No READY exam is left with failing readiness. A pre-0063 READY exam that no room write ever touches keeps FALSE/FALSE, so "juga ujian yang sudah ditempatkan" is met for it only at its first room write; the remaining gap is R6 (F6).
- **RP-2:**
  - A physical room may hold the participants of several ExamInstances of one session, and its Proctor is not a schedule conflict across them (§4.5). This is the "explicitly supported" case of D04.2-40.
  - The approved text includes **"satu pengawas satu ruang per sesi"**. 0033 itself allows one Proctor assignment mapped to several rooms; this Task enforces one physical room per Proctor per session as an application rule, the refusal `proctor_other_room` (F3).
- **RP-3:**
  - E7 applies.
  - The extension route refuses an exam that was ever marked ready, so a demotion never reopens the questions (OP-4 A).
  - O05-4 lets ASSESS-ROOM-001 move a READY participant with a reason. RP-3 is the rule for this Task's READY allocation changes and leaves that transfer command unchanged (E18, R12).
- **RP-4:**
  - A Proctor is a member of the school who is not a Student enrolled in the session's academic period on the session date, and who is not a participant of an exam overlapping the session.
  - Membership has no staff kind (0001 `tenant_memberships`; `ops/provisioning/people.ts:140` stores only a teacher assignment), so the enrollment is the test.
- **RP-5:**
  - No write of this Task needs a reason. Each write is confirmed on screen and recorded with actor, time, action key and digest (E9).
  - On a READY exam this differs from the reason that ASSESS-ROOM-001's transfer will need (TASK_PLAN:423). The difference is the pre-ACTIVE allocation of D04.4-59 against the governed transfer (E18, R12).

**OB-3. Identitas yang dilihat Operator** (raised by F9; decided 2026-11-09 in chat):
- **Finding:**
  - P5 :45 and P04 :90 allow the School Operator scoped "Name/NIS/rombel" of Students, and A10 :109 allows "operational roster/readiness/assignment data".
  - ADMIN-001 D2 (:50) shows the Operator "row number, own-source key, name/NIS/rombel".
  - No P5 line names the ELLIGBLE ID (the sign-in name) as an Operator-visible field, for Students or for staff.
  - P5 :152 forbids a "new account directory", so a list of every non-student member as Proctor candidates is not covered.
  - ASSESS-INSTITUTION-001 already shows the Operator each subject Teacher's ELLIGBLE ID (§4.3 there). That is a precedent, not a P5 approval.
- **Question,** quoted verbatim: "ASSESS-INSTITUTION-002, keputusan OB-3 (temuan reviewer): untuk mengatur ruang dan pengawas, Operator perlu mengenali siswa dan pengawas, tetapi P5 hanya menyebut nama, NIS dan rombel siswa. Apa yang ditampilkan kepada Operator?"
- **Answer:** the Owner chose **"ELLIGBLE ID (Recommended)"**, whose option text was "ELLIGBLE ID dan rombel setiap peserta, serta ELLIGBLE ID pengawas yang ditugaskan. Pengawas ditambahkan dengan mengetik ELLIGBLE ID, tanpa daftar anggota sekolah. Nama, NISN, tanggal lahir, jawaban, nilai dan isi soal tidak ditampilkan."
- **What it fixes:**
  - the Operator sees each participant's ELLIGBLE ID and rombel and the ELLIGBLE IDs of assigned Proctors (E12, §4.3, §4.6);
  - Proctors are added by typing an ELLIGBLE ID, as the AUTH-002/003 verifiers do; there is no list of school members, so the :152 "new account directory" is never built;
  - names, NISN, birth dates, answers, scores and question content are not shown.

### 3.2 Engineering readings (for the contract review)

- **E1, authority.**
  - The ASSESS-INSTITUTION-001 E1 reading applies unchanged: an active `tenant_school_operator_assignments` row, FOR SHARE on writes, re-checked at commit.
  - Platform CLI authority is never inherited (A13).
  - A Teacher, a Proctor, a Homeroom Teacher or a Student gains nothing.
  - Combined roles act per assignment (P03), so the Operator may also be a Proctor (D04.1-07).
- **E2, the physical room (A04-1).**
  - **Identity:** within one session, a physical room is identified by its normalized label. Normalization collapses inner whitespace runs to one space, trims, allows 1 to 60 characters, and compares case-insensitively. The database enforces the same form (§4.1), so the application and the trigger cannot disagree (F5 c).
  - **Display label:** a new row for an existing physical room copies that room's existing display label (the label of its earliest non-cancelled row in the session), so all rows of one room carry identical text (F5 b).
  - **Per-exam rows:** the rows of the session's non-cancelled exams are kept in sync with their participants. The row (exam E, room R) exists exactly while at least one participant of E is in R.
    - It is created with the first such participant.
    - When the last one leaves, before the exam opens, the row and its Proctor mappings are deleted and those Proctor assignments of E are revoked; the history keeps the labels (E9).
  - An empty physical room therefore disappears from the list.
  - **Cancelled exams (F1):** their rows, room assignments, Proctor assignments and mappings are frozen. They are never pruned, moved or synced. They are excluded from every count, from `room_unknown`, from `proctor_other_room` and from the label conflict.
  - No other row of 0031–0033 is ever deleted.
  - No participant can leave every room: this follows from E2 and E4 (a move always has a target), independently of OPEN-05.
- **E3, the Proctors of a physical room.**
  - The Operator sets the full Proctor set of R in one request, additions and removals together.
  - For every non-cancelled exam with a row R, each Proctor of R holds one active 0008 assignment, mapped (0033) to that row.
  - Removing a Proctor sets `revoked_at` on those assignments. The mapping rows stay, and coverage already ignores revoked assignments.
  - A row created later for R receives R's current Proctors in the same transaction.
  - R's current Proctors are computed from non-cancelled exams only.
  - A request whose set equals the current set writes nothing: no action row and no revision bump. It answers `changed: false`, also on a retry with the same key.
- **E4, single current room** (D04.4-27). The 0032 unique constraint stays the guarantee. A move updates `exam_room_id` of the current row (A04-2's "update the current row") and writes one history entry.
- **E5, stale changes.**
  - Every write of a session carries `expectedRevision`, the session's room revision returned by the read: the number of room actions recorded for the session (0063, E9).
  - A different value gives 409 `stale_assignment` with the current revision, and nothing is written. There is no silent last-write-wins.
  - Placement and cancellation (ASSESS-INSTITUTION-001) do not bump the revision: they change no room state of a non-cancelled exam.
- **E6, lock order,** after the action-key lock and re-authentication of `operatorWrite`:
  1. `pg_advisory_xact_lock(hashtext('sa-institution-rooms:' || tenant || ':' || session))`;
  2. one advisory lock per affected room, `'sa-institution-room-label:' || tenant || ':' || lower(normalized label)`, sorted (F5 a);
  3. one advisory lock per added Proctor person, `'sa-institution-proctor:' || tenant || ':' || person`, and one per added student, `'sa-institution-participant:' || tenant || ':' || person`, all sorted;
  4. every affected exam row FOR UPDATE, sorted by id. This is the lock every lifecycle change takes first, so mark ready, extension, cancellation and content import serialize with it;
  5. the Proctor memberships FOR SHARE.

  The existing supervision order (the exam FOR KEY SHARE, then the assignment, mapping and room rows) is compatible with step 4.
- **E7, readiness re-check (RP-3).**
  - After the writes, `evaluateExamReadiness` runs in the same transaction for every affected exam that is READY.
  - A passing exam stays READY.
  - A failing one moves READY → SCHEDULED with a lifecycle event (actor the Operator) and is listed in the response.
  - The extension route (ASSESS-INSTITUTION-001 §4.3) gains the refusal 409 `marked_ready_before` for an exam with any SCHEDULED → READY event, and the period read gains `markedReadyBefore` for each exam, so the client hides "Perpanjang Tenggat" (note a).
  - The writes do not evaluate SCHEDULED exams; mark ready evaluates them as today and refuses an incomplete room setup with 409 `not_ready` and a room blocker.
- **E8, conflicts.**
  - **Participants:** an added student expected in another exam at an overlapping time gives `schedule_conflict` with `count` (`overlappingPersonIds`). The person locks of E6 step 3 serialize concurrent additions of one student, so two concurrent additions in overlapping sessions cannot both pass. A placement of ASSESS-INSTITUTION-001 takes no person lock, so a placement racing an addition is caught at mark ready by `participant_schedule_conflict`, as ASSESS-INSTITUTION-001 E16 accepted for placements (R13).
  - **Proctors:**
    - A Proctor expected in another exam at an overlapping time gives `proctor_schedule_conflict` with `count`. The exception is another exam of this session in the same physical room (RP-2).
    - A Proctor already in another room of this session gives `proctor_other_room`.
    - E6 step 3 serializes concurrent assignments of one person.
  - **Rooms** (D04.2-41): a label already used by a non-cancelled SCHEDULED, READY, ACTIVE or PAUSED exam of another institution session of the same tenant whose time overlaps gives `room_conflict`. E6 step 2 serializes it. Another tenant's rooms are never compared or disclosed. Teacher-managed exams have no rooms and are not compared.
  - **Readiness** still catches every conflict that reaches mark ready (`participant_schedule_conflict`, `proctor_schedule_conflict`).
- **E9, history and attribution.**
  - Each Operator write that changes something writes one append-only action row: actor, time, kind, action key, request digest, session revision and demoted exams.
  - Each changed participant room or Proctor assignment writes one append-only entry. Entries store labels rather than room ids, so the pruning of E2 never breaks them.
  - Participant additions also write the 0053 rows, as the Teacher's addition does.
  - The SEC-001 table is not widened (ASSESS-INSTITUTION-001 E9).
  - A04-2's transfer history extends these entries (E18).
- **E10, lifecycle bounds.**
  - Every write applies only to exams that are SCHEDULED or READY and not cancelled.
  - An affected exam in any other state gives 409 `invalid_state` with `{examInstanceId, currentState}`, and nothing is written.
  - A cancelled exam is never affected (E2). Its participants give `participant_unknown`.
- **E11, participant addition** (OP-6 A, D04.2-64).
  - The candidates are the students enrolled in the exam's rombel on the session's school-zone date who are not participants yet.
  - The request names the target room, so a room-based exam never has a participant outside every room.
  - One request adds everyone or no one.
- **E12, projection** (P01, A10, OB-3):
  - Shown: subject, rombel, participant ELLIGBLE IDs, room labels, the ELLIGBLE IDs of assigned Proctors, counts, lifecycle and room readiness.
  - Never shown: names, NIS, NISN, birth dates, contact data, session handles or fingerprints, prompts, options, keys, rubrics, scores or answers.
  - There is no directory of members. The Operator adds a Proctor by typing an ELLIGBLE ID handed over in person, and the server resolves it within the tenant only.
  - An ELLIGBLE ID that is foreign or nonexistent gets a byte-identical `proctor_unknown`. An own-tenant member who is a Student or a participant gets `proctor_ineligible`. This discloses nothing beyond the Operator's own roster scope (A09 :108).
- **E13, room view cost.** The room view evaluates only the room part of readiness (`checkExamInstanceConditionalRoomProctorReadinessCompositionPreflight`), for each SCHEDULED or READY exam of one session, not the full composition.
- **E14, routes.** Flat paths in the `institution-exams` namespace, with ids in the body or query (ASSESS-INSTITUTION-001 E10). The proposed P3 F06 "operations under that resource" become flat paths (a recorded deviation).
- **E15, client placement.**
  - The room screen `InstitutionRoomManagementView` (the card's proposed name) opens from a session of `InstitutionExamView` as an in-view screen, without a new URL parameter, so `App.tsx` is unchanged.
  - `ParticipantChoiceList` gains an optional choice id and note, so the same primitive lists students and room members.
  - `useActionKey` and `useRetryFocus` move unchanged to `frontend/web/src/hooks/useDialogAction.ts`, used by both screens (note i).
  - The narrow-first metric grid becomes a documented `MetricList` variant (F7, §4.6).
  - These follow the Global UI/UX Consistency Contract (§10.1 of the living plan): a pattern used twice is a shared primitive or a documented variant.
- **E16, E2E file names.** The new spec is `99i-institution-rooms.spec.ts`, so it sorts after `99h` (Playwright orders files with localeCompare). Under RP-1, `99h` assigns a room and its Proctor before each "Tandai Siap" (§4.8).
- **E17, the room label trigger.**
  - Uniqueness and the label form apply to institution exams only, by trigger. The BU-071 behaviour of teacher-managed rooms (duplicates allowed, a historical asset) stays as verified.
  - The trigger raises with named SQLSTATEs and constraint names, which the rooms error mapper translates (§4.2, F4).
- **E18, this Task and ASSESS-ROOM-001** (F2).
  - D04.4-59 (:5527–5531) puts allocation before ACTIVE, READY included, with this Task: "Authorized users can correct room allocation before protected runtime. After ACTIVE, changes become governed transfers."
  - O05-4 (ASSESS-QUESTION-001.md:80) also makes a READY participant eligible for the governed transfer of ASSESS-ROOM-001. That transfer is guarded by reason, confirmation, replay and revision (TASK_PLAN:423).
  - This Task gives READY exams the unreasoned allocation approved in RP-3 and RP-5. It adds no transfer command.
  - ASSESS-ROOM-001 must use the same 0032 current row and these 0063 entries for its READY and later transfers, extending the entry kinds rather than adding a parallel history. It must also add its `assignment_version` over the moves made here, with a defined initial version for rows created by this Task.
  - Which command applies to a READY move once both exist is for the ASSESS-ROOM-001 contract (R12).

**Recorded deviations from proposed (not locked) documents:**
- The card's `runtime/secure-assessment/src/exam-participant-academic-enrollment-assignment.ts` is not changed: it is the BU-048 enrollment-context preflight, and the addition reuses `listEnrolledStudents` instead.
- The card's `e2e/tests/13-institution-exams.spec.ts` becomes `99i-institution-rooms.spec.ts` (E16). The card's names `test/integration/institution-rooms.test.ts` and `institution-rooms.ts` are kept.
- P3 F06 nested resource paths become flat paths (E14).

## 4. Contract

### 4.1 Schema (migration `0063_secure_assessment_institution_rooms.sql`, new)

- **Pattern:** idempotent, as 0060–0062; history row `0063_secure_assessment_institution_rooms`.
- **Ownership:** Secure Assessment.
- **Person columns** have no DB foreign key, as in 0061 and 0062.
- **Label form** used below: `L = regexp_replace(btrim(L), '\s+', ' ', 'g') AND char_length(L) BETWEEN 1 AND 60`.

**`secure_assessment_institution_room_actions`:**

| Column | Definition |
|---|---|
| `id` | `uuid` primary key, default `gen_random_uuid()` |
| `tenant_id` | `uuid NOT NULL` |
| `session_id` | `uuid NOT NULL`; FK `(session_id, tenant_id)` → `secure_assessment_institution_exam_sessions (id, tenant_id)`, RESTRICT |
| `kind` | `text NOT NULL`, `ck_sa_institution_room_action_kind`: `kind IN ('ROOM_PARTICIPANTS', 'ROOM_PROCTORS', 'PARTICIPANT_ADDITION')` |
| `revision` | `integer NOT NULL CHECK (revision >= 1)` |
| `demoted_exam_instance_ids` | `uuid[] NOT NULL DEFAULT '{}'` |
| `actor_person_id` | `uuid NOT NULL` |
| `acted_at` | `timestamptz NOT NULL DEFAULT statement_timestamp()` |
| `action_key` | `uuid NOT NULL` |
| `request_digest` | `text NOT NULL`, `ck_sa_institution_room_action_digest`: `request_digest ~ '^[0-9a-f]{64}$'` |

**Constraints:**
- `uq_sa_institution_room_action_ref` UNIQUE `(id, tenant_id)`;
- `uq_sa_institution_room_action_key` UNIQUE `(tenant_id, action_key)`, shared by the three kinds, so one key cannot serve two routes;
- `uq_sa_institution_room_action_revision` UNIQUE `(tenant_id, session_id, revision)`: the session revision of E5, and also the read index.

**`secure_assessment_institution_room_action_entries`:**

| Column | Definition |
|---|---|
| `id` | `uuid` primary key |
| `tenant_id` | `uuid NOT NULL` |
| `action_id` | `uuid NOT NULL`; FK `(action_id, tenant_id)` → actions `(id, tenant_id)`, RESTRICT |
| `exam_instance_id` | `uuid NOT NULL`; FK `(exam_instance_id, tenant_id)` → `secure_assessment_exam_instances (id, tenant_id)`, RESTRICT |
| `entry_kind` | `text NOT NULL CHECK (entry_kind IN ('PARTICIPANT_ROOM', 'PROCTOR_ASSIGNED', 'PROCTOR_REVOKED'))` |
| `exam_participant_id` | `uuid NULL`; FK `(exam_participant_id, tenant_id, exam_instance_id)` → `secure_assessment_exam_participants (id, tenant_id, exam_instance_id)` (0032 `uq_sa_exam_participant_id_tenant_instance`), RESTRICT |
| `proctor_assignment_id` | `uuid NULL`; FK `(proctor_assignment_id, tenant_id, exam_instance_id)` → `secure_assessment_proctor_assignments (id, tenant_id, exam_instance_id)` (0033 `uq_sa_proctor_assignment_id_tenant_instance`), RESTRICT |
| `from_room_label` | `text NULL`, in the label form when present |
| `room_label` | `text NOT NULL`, in the label form |

**Constraints:**
- `ck_sa_institution_room_entry_shape`:
  - either `entry_kind = 'PARTICIPANT_ROOM' AND exam_participant_id IS NOT NULL AND proctor_assignment_id IS NULL AND (from_room_label IS NULL OR lower(from_room_label) <> lower(room_label))`,
  - or `entry_kind IN ('PROCTOR_ASSIGNED', 'PROCTOR_REVOKED') AND proctor_assignment_id IS NOT NULL AND exam_participant_id IS NULL AND from_room_label IS NULL`;
- index `(tenant_id, exam_instance_id)`.

**Append-only:** both tables refuse UPDATE and DELETE with triggers, following 0053 and 0062.

**Institution room guard (E2, E17, F1, F4)** on `secure_assessment_exam_rooms`. It first reads the exam's `institution_session_id`, which is immutable (0062). When that is NULL (a teacher-managed exam), the guard returns at once and takes no lock. Otherwise:
- **Lock:** it takes `pg_advisory_xact_lock(hashtext('sa-institution-exam-rooms:' || tenant || ':' || exam))`.
- **BEFORE INSERT:**
  - A label not in the label form raises with `ERRCODE = 'check_violation'` and `CONSTRAINT = 'ck_sa_institution_exam_room_label'`.
  - A second room of the exam with the same `lower(display_label)` raises with `ERRCODE = 'unique_violation'` and `CONSTRAINT = 'uq_sa_institution_exam_room_label'`.
- **BEFORE UPDATE OF display_label:** any change raises `ck_sa_institution_exam_room_label`. Institution room labels never change.
- **BEFORE DELETE:** it raises unless the exam is SCHEDULED or READY, with `ERRCODE = 'check_violation'` and `CONSTRAINT = 'ck_sa_institution_exam_room_frozen'`. A cancelled (ARCHIVED, 0052) or opened exam keeps its rooms.

The 0032 and 0033 rows are not guarded by trigger: ASSESS-ROOM-001 will update 0032 rows while ACTIVE. Their pre-open rules are enforced by the routes.

**Room policy (RP-1):** `UPDATE secure_assessment_exam_instances SET room_based_operations_enabled = TRUE, proctor_per_room_required = TRUE WHERE institution_session_id IS NOT NULL AND lifecycle_state = 'SCHEDULED'`.
- READY institution exams are left alone, so no READY exam has failing readiness after the upgrade. The first room write that touches one sets the flags in its transaction (§4.3).
- Teacher-managed rows and institution exams in any other state are untouched. No lifecycle row is written.

Nothing else in the schema changes: 0008, 0024 and 0031–0034 keep every column, constraint and trigger.

### 4.2 Authority, transactions and errors (`institution-rooms.ts`, new)

The §4.2 frame of ASSESS-INSTITUTION-001 applies unchanged, through the exported `operatorWrite` and `operatorRead`:
1. Exact body keys and shapes are checked before any connection; otherwise 400 `invalid_request`.
2. Authentication, `BEGIN`, the action-key advisory lock, and re-authentication with the Operator assignment FOR SHARE; otherwise 403 `forbidden`.
3. Replay: an action row with this key, the same kind, actor and digest returns the original outcome with `replayed: true` (200). Another kind, actor or digest gives 409 `action_key_reused`.
4. The locks of E6, then the session check: a session that is not this tenant's gives 403 `forbidden`.
5. `expectedRevision` is compared with the current session revision (E5).
6. The checks are reported together as 422 `room_invalid` with `problems: [{code, count?, elligbleIds?}]`. Then come the writes, then the readiness re-check (E7).
7. Re-authentication, then `COMMIT`.

**Rooms error mapper** `institutionRoomFailure(error)` runs first; anything it does not match falls through to the unchanged `institutionFailure` (F4):

| Database error | Answer |
|---|---|
| 23505 on `uq_sa_institution_room_action_key` or 0053 `uq_sa_participant_addition_action_key` | 409 `action_key_reused` |
| 23505 on `uq_sa_institution_room_action_revision`, 0032 `uq_sa_exam_participant_room_assignment_participant`, 0033 `uq_sa_exam_proctor_room_assignment_mapping` or 0008 `uq_sa_proctor_assignment_active` | 409 `stale_assignment` (unreachable under the session lock; mapped so a race never answers 500) |
| 23505 on 0024 `uq_sa_exam_participants_tenant_instance_person` (as `teacher-exam-participants.ts:378` maps it) or 0053 `uq_sa_participant_addition_entry_participant` | 422 `room_invalid` with `already_participant` |
| 23505 on `uq_sa_institution_exam_room_label`, or 23514 on `ck_sa_institution_exam_room_label` | 422 `room_invalid` with `room_label_invalid` |
| 23514 on `ck_sa_institution_exam_room_frozen` | 409 `invalid_state` |

`institutionFailure` itself is unchanged: 40001 and 40P01 give 409 `state_changed`, connection failures 503 `persistence_unavailable`, an unknown 23505 409 `state_changed`, anything else 500.

**Object scope:**
- A session or exam that is not this tenant's institution object, including a teacher-managed exam, gives 403 `forbidden`.
- Foreign or unknown ids inside a body give 422, byte-identical for a foreign and a nonexistent id (the ASSESS-INSTITUTION-001 review ruling, §9 there):
  - a participant gives `participant_unknown`;
  - an enrollment gives `not_enrolled`;
  - a Proctor ELLIGBLE ID gives `proctor_unknown`.

### 4.3 Operator routes

**`GET /api/v1/assessment/institution-exams/rooms?sessionId=`** (exactly one query key):
`{session: {sessionId, periodLabel, startsAt, endsAt}, revision, rooms: [Room], exams: [RoomExam]}`.
- **`Room`** = `{label, participantCount, groups: [{examInstanceId, subjectLabel, groupLabel, count}], proctors: [{elligbleId}]}`, ordered by label.
- **`RoomExam`** = `{examInstanceId, subjectLabel, groupLabel, lifecycleState, editable, roomBased, roomReadiness: {status, blocker?, …counts} | null, participants: [{participantId, elligbleId, roomLabel | null}], candidates: [{enrollmentId, elligbleId, conflict}]}`.
  - It covers every non-cancelled exam of the session, ordered by subject then rombel.
  - `editable` is true for SCHEDULED or READY.
  - `roomBased` is false for any institution exam that is not TRUE/TRUE until its first room write.
  - `roomReadiness` comes from the room preflight only (E13), null when the exam is not editable.
  - `candidates` (E11) are listed only when the exam is editable.
- Rooms, counts and Proctors are computed from non-cancelled exams only (E2).

**`POST /api/v1/assessment/institution-exams/rooms/participants`:** body exactly `{sessionId, roomLabel, participantIds, expectedRevision, actionKey}`. `participantIds` holds 1 to 1000 distinct UUIDs (the `MAX_ADDED_PARTICIPANTS` bound).
- **Problem codes:**
  - `room_label_invalid`;
  - `participant_unknown`: not a participant of a non-cancelled exam of this session;
  - `already_in_room`: every chosen participant is already there;
  - `room_conflict`.
- **Refusals:** 409 `invalid_state` for an exam that is not editable; 409 `stale_assignment` with `{revision}`.
- **Writes:**
  1. TRUE/TRUE on any affected institution exam that is not TRUE/TRUE (RP-1, §4.8);
  2. room rows created as needed, copying the room's display label (E2), with R's current Proctors (E3);
  3. each participant's current row inserted or updated (E4), with one `PARTICIPANT_ROOM` entry;
  4. emptied rows pruned (E2), with `PROCTOR_REVOKED` entries;
  5. the action row;
  6. then E7.
- **Answer:** 200 `{sessionId, revision, moved, demoted: [examInstanceId], replayed}`.

**`POST /api/v1/assessment/institution-exams/rooms/proctors`:** body exactly `{sessionId, roomLabel, proctorElligbleIds, expectedRevision, actionKey}`.
- `proctorElligbleIds` holds 0 to 20 strings, each 1 to 64 characters after trimming. 20 is an input bound, not a policy value.
- **Normalization:** each ID is trimmed, then normalized exactly as `identity_identifier_key` does (0055:18–23): lowercased when it has the generated `elg-xxxx-xxxx-xxxx` form, otherwise unchanged, because a legacy username matches only exactly. Two equal normalized strings give 400 `invalid_request` before any connection.
- **Resolution:** each ID is resolved through `findAccountByElligbleId` (`identity-access/src/provisioning.ts:31`, the exact username or the GENERATED identifier key), then to a membership of this tenant.
- **De-duplication by person:** IDs that still resolve to the same person (for example a legacy username and the generated ID of one account) are collapsed silently to one Proctor before any write, keeping the first typed spelling for the response. A person therefore never reaches `uq_sa_proctor_assignment_active` twice, and never gets a misleading `stale_assignment`.
- **Problem codes:**
  - `room_unknown`: no participant of a non-cancelled exam of the session is in that room;
  - `proctor_unknown`;
  - `proctor_ineligible` (RP-4);
  - `proctor_other_room` (RP-2);
  - `proctor_schedule_conflict`, with `count`.

  `proctor_unknown`, `proctor_ineligible`, `proctor_other_room` and `proctor_schedule_conflict` carry the failing `elligbleIds` as the Operator typed them; the echo of `proctor_unknown` is byte-identical for a foreign and a nonexistent ID. `invalid_state` and `stale_assignment` apply as above.
- **An unchanged set** returns 200 with `changed: false` and writes nothing (E3, note g).
- **Writes:**
  1. TRUE/TRUE on any affected institution exam that is not TRUE/TRUE (RP-1, §4.8);
  2. assignments and mappings for added Proctors on every non-cancelled exam with a row R (`PROCTOR_ASSIGNED`);
  3. `revoked_at = statement_timestamp()` for removed ones (`PROCTOR_REVOKED`);
  4. the action row;
  5. then E7.
- **Answer:** 200 `{sessionId, revision, changed, proctors: [{elligbleId}], demoted, replayed}`.

**`POST /api/v1/assessment/institution-exams/participants`:** body exactly `{examInstanceId, enrollmentIds, roomLabel, expectedRevision, actionKey}`. `enrollmentIds` holds 1 to 1000 distinct UUIDs.
- 403 for an exam that is not this tenant's institution exam; then the exam's session takes the E6 locks.
- **Problem codes:** `not_enrolled`, `already_participant` and `schedule_conflict`, each with `count`; `room_label_invalid`; `room_conflict`. `invalid_state` and `stale_assignment` apply.
- **Writes:**
  1. TRUE/TRUE on any affected institution exam that is not TRUE/TRUE (RP-1, §4.8);
  2. the participants;
  3. the 0053 addition (`previous_lifecycle_state` the exam's state, `added_by_person_id` the Operator, `action_key`) and its entries;
  4. their room rows (E2, E3) and `PARTICIPANT_ROOM` entries with `from_room_label` NULL;
  5. the action row;
  6. then E7.
- **Answer:** 201 `{examInstanceId, revision, added: [{enrollmentId, elligbleId}], demoted, replayed}`; 200 when replayed.

**Changed ASSESS-INSTITUTION-001 behaviour (only these):**
- Placement writes `room_based_operations_enabled = TRUE, proctor_per_room_required = TRUE` (RP-1).
- The deadline extension refuses with 409 `marked_ready_before` for an exam with a SCHEDULED → READY event (RP-3), checked after `invalid_state`.
- The period read's `ExamItem` gains `markedReadyBefore` (note a).
- `operatorWrite`, `operatorRead`, `institutionFailure`, `hasExactKeys`, `digestOf`, `lockInstitutionExam` and the refusal helpers are exported unchanged.

**Route coverage:**
- `route-parity.test.ts` CALLS gains the four client functions (§4.8).
- `metrics.ts` `COMPONENT_BY_PATH` gains the four paths as `exam_setup`.
- The Origin check, the 64 KiB body limit and 413 apply as for every Operator route.

### 4.4 Teacher, Proctor and Student surfaces

- **Teacher:** no new action.
  - The subject Teacher's card keeps its existing "Kesiapan Ruangan & Pengawas" line (`TeacherReadinessView.tsx:402`), which now reports the room blockers of an institution exam.
  - `teacher-exams/participants/add` and `…/candidates` keep refusing institution exams with `institution_managed`.
- **Proctor:** no control is added.
  - An assigned Proctor sees the exam in the existing Proctor list with its room (`proctor-monitoring.ts`).
  - In `exam-monitoring` they see only the participants of their room (the `supervision-scope.ts` room filter).
  - A revoked Proctor gets 403 there.
- **Student:** a participant sees "Ruang: <label>" on the scheduled exam (`AssignedExamDiscovery.tsx:167`); the code is unchanged.

### 4.5 The schedule-conflict preflight (RP-2)

In `checkExamInstanceParticipantProctorScheduleConflictReadiness`, only the Proctor query (:136–160) changes.
- **The exemption:** a pair of rows is not a conflict when both exams carry the same non-null `institution_session_id`, and the person's active assignments in both are mapped to rooms with the same `lower(display_label)`.
- **The query keeps** its aliases and its four parameters. The participant query and the target query are unchanged.
- **The unit test stays valid:** the mock of `test/exam-instance-participant-proctor-schedule-conflict-readiness-preflight.test.ts` matches on the text `other_proc` (:71–77), so that file is unchanged.
- **Unchanged cases:** teacher-managed exams (NULL session) and exams of different sessions are compared exactly as today.

### 4.6 Client

**Entry** (`InstitutionExamView.tsx`):
- Each "Jadwal Sesi" heading gains the action "Ruang dan Pengawas" beside "Tempatkan Ujian".
- It replaces the period view with `InstitutionRoomManagementView` for that session. "Kembali ke Ujian Sekolah" restores the period view and returns focus to the trigger.
- "Perpanjang Tenggat" is hidden when `markedReadyBefore` is true.
- The extension dialog maps `marked_ready_before` (table below).
- The dialog hooks are imported from `hooks/useDialogAction.ts`.

**Room screen** (`InstitutionRoomManagementView`, new), in the shared `Page`:
- **Header:**
  - title "Ruang dan Pengawas";
  - description "Jadwal Sesi: <tanggal>, <jam mulai> sampai <jam selesai>. Tempatkan setiap peserta di satu ruang dan tetapkan pengawas untuk setiap ruang sebelum ujian dibuka.";
  - actions "Kembali ke Ujian Sekolah" and "Muat Ulang".

  On entry, focus moves to the title (`tabIndex=-1`).
- **Summary:** `MetricList layout="narrowFirst"` with "Peserta", "Belum punya ruang", "Ruang" and "Ruang tanpa pengawas".
- **"Daftar Ruang":**
  - action "Tambah Ruang";
  - empty state "Belum ada ruang di sesi ini. Tambahkan ruang, lalu tempatkan peserta.";
  - room card:
    - title: the label;
    - facts: "<n> peserta", then one line per exam "<mapel> · <rombel>: <n> peserta", then "Pengawas: <ELLIGBLE ID>, …" or the warning badge "Belum ada pengawas";
    - actions: "Tempatkan Peserta" and "Atur Pengawas".
- **"Peserta per Ujian"** (`ExamListCard`, `h3`):
  - title: the subject;
  - facts: "<rombel> · <n> peserta · <m> belum punya ruang";
  - status: the lifecycle badge;
  - the room readiness message from `roomProctorBlockerText`, or "Ruang dan pengawas lengkap.";
  - action "Tambah Peserta" when editable;
  - a non-editable exam shows "Ujian ini sudah dibuka, jadi ruang dan pengawasnya tidak dapat diubah di sini."
- **Dialogs:**
  - **Behaviour of every dialog:**
    - `permissionDialogClass`;
    - one action key per dialog, kept on retries;
    - on a failed send, focus moves to the enabled retry action (`useRetryFocus`);
    - on success, focus moves to the success notice, because the refresh may remove the trigger;
    - otherwise focus returns to the trigger.
  - **"Tambah Ruang":** "Nama ruang", then the participants without a room, grouped by "<mapel> · <rombel>", each group with "Pilih semua <rombel>"; action "Simpan Ruang".
  - **"Tempatkan Peserta di <ruang>":** a filter "Tampilkan" with "Belum punya ruang" and "Semua peserta"; the participants not in this room, each noted "Ruang <label>" or "Belum punya ruang"; action "Tempatkan Peserta".
  - **"Atur Pengawas <ruang>":**
    - the text "Pengawas hanya melihat peserta di ruang ini. Satu pengawas bertugas di satu ruang pada sesi ini.";
    - the current Proctors, each with "Hapus <ELLIGBLE ID>";
    - the field "ELLIGBLE ID pengawas" with "Tambahkan";
    - action "Simpan Pengawas".

    When "Hapus" removes its own row, focus moves to the field.
  - **"Tambah Peserta <mapel> · <rombel>":**
    - the candidates (`ParticipantChoiceList`, conflicts disabled);
    - "Ruang" (`NativeSelect` of the session's rooms, required), or, without rooms, the text "Tambahkan ruang lebih dulu.";
    - action "Tambah Peserta".
  - **The READY notice:** each write dialog that affects a READY exam shows "Ujian yang sudah ditandai siap akan diperiksa ulang. Bila belum lengkap, ujian kembali ke Terjadwal dan perlu ditandai siap lagi."
- **Success notices:**
  - "Peserta ditempatkan di <ruang>: <n> peserta."
  - "Pengawas <ruang> tersimpan."
  - "Peserta ditambahkan: <n> siswa."
  - for each demoted exam: "Ujian <mapel> · <rombel> kembali ke Terjadwal dan perlu ditandai siap lagi."
- **Problem and refusal copy:**

| Code | Copy |
|---|---|
| `room_label_invalid` | "Nama ruang wajib diisi, paling banyak 60 karakter." |
| `room_conflict` | "Ruang ini sudah dipakai sesi lain pada waktu yang sama." |
| `room_unknown` | "Ruang ini belum berisi peserta. Muat ulang halaman." |
| `already_in_room` | "Peserta yang dipilih sudah berada di ruang ini." |
| `participant_unknown` | "Data pilihan sudah berubah. Muat ulang halaman, lalu pilih lagi." |
| `proctor_unknown` | One ID: "ELLIGBLE ID ini tidak ditemukan di sekolah ini: <ELLIGBLE ID>." Several: "<n> ELLIGBLE ID tidak ditemukan di sekolah ini: <ELLIGBLE ID>, <ELLIGBLE ID>." |
| `proctor_ineligible` | "Pengawas harus anggota sekolah yang bukan siswa dan bukan peserta ujian pada waktu yang sama: <ELLIGBLE ID>." |
| `proctor_other_room` | "Pengawas ini sudah bertugas di ruang lain pada sesi ini: <ELLIGBLE ID>." |
| `proctor_schedule_conflict` | "<n> pengawas sudah bertugas di ujian lain pada waktu yang sama." |
| `not_enrolled` | "<n> siswa tidak terdaftar di rombel ini pada tanggal sesi." |
| `already_participant` | "<n> siswa sudah menjadi peserta ujian ini." |
| `schedule_conflict` | "<n> siswa sudah dijadwalkan di ujian lain pada waktu yang sama." |
| `stale_assignment` | "Penempatan ruang baru saja diubah. Muat ulang untuk melihat penempatan terbaru." |
| `marked_ready_before` | "Ujian ini pernah ditandai siap, jadi tenggat tidak dapat diperpanjang." |
| `invalid_state` | "Status ujian sudah berubah. Muat ulang halaman." |
| `invalid_request`, `action_key_reused`, `state_changed`, `forbidden`, network or 503 | The frozen ASSESS-INSTITUTION-001 copy (§4.6 there) |

**Recorded copy mismatch (note f):** `roomProctorBlockerText` says "ruangan" while this screen and the Student badge say "ruang". The readiness texts are shared and stay unchanged in `lib/status.ts`; aligning them is proposed as a UI-SYSTEM follow-up outside this Task.

**Shared primitives (F7, E15):**
- `ui/metric.tsx`: `MetricList` gains a documented `layout` prop.
  - `'default'` keeps today's classes.
  - `'narrowFirst'` gives one column below 480 px, two from 480 px and four from `sm`, with labels wrapping only at spaces and no `overflow-wrap: anywhere` (the 11.0.5 lesson of ASSESS-INSTITUTION-001).
  - The existing override at `TeacherExamImportView.tsx:653` moves onto `layout="narrowFirst"`. Through `cn` (tailwind-merge), the call site produces the same class set and the same CSS, so the assertion at `institutionExams.test.tsx:473` stays unchanged and passing. The per-item `min-w-0` and `min-[480px]:col-span-2` stay at the call site.
- `ParticipantChoiceList`: `ParticipantChoice` gains an optional `id` (the choice key, falling back to `enrollmentId`) and an optional `note` (muted text where "Bentrok jadwal" sits).
  - Existing call sites and their rendering are unchanged.
  - ELLIGBLE IDs keep their mono style; room labels wrap at spaces only.
- `hooks/useDialogAction.ts`: `useActionKey` and `useRetryFocus`, moved unchanged.

### 4.7 Invariants

- **Rooms:** every participant of a room-based exam has exactly one current room. No participant is removed (OPEN-05), and none can leave every room (E2, E4).
- **Deletion:**
  - The only rows ever deleted are emptied institution room rows and their mappings, of SCHEDULED or READY exams (E2, enforced by the guard).
  - A 0008 assignment is revoked, never deleted.
  - Cancelled exams keep all their rows.
- **Teacher-managed exams** behave as today on every route, including the schedule-conflict preflight and the BU-071 room behaviour.
- **Locks:** the lock order of existing actions is unchanged. New writes take exam rows FOR UPDATE in id order after their advisory locks (E6).
- **Data:**
  - No Operator response, log or audit row carries a name, NIS, NISN, birth date, prompt, option, key, rubric, score or answer.
  - There is no member directory (E12).
- **Assessment state** (V07): room changes never touch Attempts, answers, timers or snapshots; no Attempt can exist while an exam is SCHEDULED or READY.
- **UI:**
  - Bahasa Indonesia, with no em dash in UI copy;
  - times in the school zone; numbers per UI_CONTENT_AND_COPY_STYLE.md:148;
  - E2E navigation only through the shared helpers;
  - the new screen uses only shared primitives and tokens.

### 4.8 Existing assertions that change (only these)

- **`runtime/secure-assessment/test/route-parity.test.ts` CALLS:** gains `getInstitutionRooms`, `postInstitutionRoomParticipants`, `postInstitutionRoomProctors` and `postInstitutionParticipants`.
- **`runtime/secure-assessment/test/integration/institution-exams.test.ts` :357–358** (RP-1):
  - The I-1 assertions on `room_based_operations_enabled` and `proctor_per_room_required` become true.
  - Nothing else changes. Every mark-ready success in that file uses `fixtureExam` (:282–288), raw SQL with FALSE/FALSE, which the routes of ASSESS-INSTITUTION-001 still mark ready (room policy not applicable), and no room write of this Task touches those exams.
- **`e2e/tests/99h-institution-exams.spec.ts`** (RP-1):
  - Before each "Tandai Siap" (:317, :417), the Operator opens "Ruang dan Pengawas", adds room "Ruang E2E" with every participant and sets `pengawas.e2e` as its Proctor.
  - The 99h capture pairs then also differ by the "Ruang dan Pengawas" action and the room readiness lines.

The following stay unchanged:
- `test/exam-instance-participant-proctor-schedule-conflict-readiness-preflight.test.ts`;
- `test/integration/permission-enforcement.test.ts` and `test/integration/teacher-exam-participants.test.ts`;
- `frontend/web/src/__tests__/institutionExams.test.tsx`, including :473 (F7). Its mocks omit `markedReadyBefore`, which is optional in the client type;
- every teacher screen test and every other E2E spec.

**An institution exam that is not TRUE/TRUE** (F6): fixture exams, and READY exams placed before 0063.
- Readiness treats it as today (`room_proctor_readiness_not_applicable`).
- The room view shows it with `roomBased: false`.
- The first room write that affects it sets TRUE/TRUE in the same transaction, then applies E7.

### 4.9 Negative coverage (P5 trace)

The P5 enforcement table names for A10 the negatives N01, N02, N03, N04, N07 and N08 (CBT_PERMISSION_MATRIX.md:130). N10 (:60) is added for the edge checks.

| Route | P5 row | N-ids asserted (C03) |
|---|---|---|
| GET `institution-exams/rooms` | A10 | N01, N02 (foreign `sessionId` → 403), N03, N04, N10 |
| POST `institution-exams/rooms/participants` | A10 | N01, N02 (foreign session → 403; foreign participant → 422 `participant_unknown`), N03, N04, N07, N08, N10 |
| POST `institution-exams/rooms/proctors` | A10 | N01, N02 (foreign session → 403; a foreign tenant's ELLIGBLE ID → 422 `proctor_unknown`, byte-identical with a nonexistent one), N03, N04, N07, N08, N10 |
| POST `institution-exams/participants` | A10 | N01, N02 (foreign or teacher-managed exam → 403; foreign enrollment → 422 `not_enrolled`), N03, N04, N07, N08, N10 |

What each N-id means here:
- **N01:** anonymous gives 401; another tenant's session or no membership gives 403; an unavailable database gives 503 with nothing written.
- **N02:** body and query ids are swapped across tenants, sessions and exams; a foreign and a nonexistent id get byte-identical bodies.
- **N03:** the other tenant's Operator and an Operator whose assignment is revoked: 403.
- **N04:** a Teacher (the subject Teacher included), a Proctor, a Homeroom Teacher and a Student on every route: 403. The Proctor and Teacher routes gain nothing (§4.4).
- **N07:** authority at commit.
  - An Operator assignment revoked while a write waits on its lock gives 403, with nothing written.
  - After a committed move, the old room's Proctor no longer lists the participant in `exam-monitoring` and the new room's Proctor does.
  - After a committed removal, the Proctor gets 403 there (A04-3, per-request scope).
- **N08:**
  - `actorPersonId`, `tenantId` or any key outside the exact body gives 400.
  - Altered replay input, or one key reused on another of the three routes, gives `action_key_reused`.
  - A stale revision gives `stale_assignment`.
  - Every refusal leaves equal before/after counts in the room, assignment, mapping, participant, 0053, action, entry and lifecycle tables.
- **N10:**
  - A disallowed Origin on the POST paths gives 403 `origin_not_allowed`; a body over 64 KiB gives 413 `payload_too_large`. Both come before any database effect.
  - The GET path follows the accepted reading of ASSESS-INSTITUTION-001 §11.1 (SameSite=Strict, no CORS).

## 5. Expected vectors

**Fixture:**
- **Tenant 1** (Asia/Jakarta):
  - a period with session S1 (D+2 08:00–10:00) holding E1 (Matematika × X, three students) and E2 (Fisika × Y, two students), both placed through the ASSESS-INSTITUTION-001 route;
  - session S2 of another period, overlapping S1, holding E3;
  - staff members P1, P2 and P3 (no enrollment);
  - Teacher T of E1, Student s1 of X, and School Operator O.
- **Tenant 2:** Operator O2 and a session overlapping S1.

| # | Case | Expected |
|---|---|---|
| I-1 | Placement and upgrade (RP-1) | A new placement has TRUE/TRUE. With content and the deadline passed and no room, mark ready of E1 gives 409 `not_ready` with the room blocker `exam_room_empty`. Teacher-managed exams keep their flags |
| I-2 | O puts all five students of S1 into "Ruang 1" (`expectedRevision` 0) | Rows (E1, Ruang 1) and (E2, Ruang 1) with identical labels; five current assignments; five `PARTICIPANT_ROOM` entries with `from_room_label` NULL; revision 1. Mark ready of E1 gives 409 `not_ready` with `active_proctor_assignment_empty` |
| I-3 | O sets {P1} for "Ruang 1" | One active assignment of P1 on E1 and one on E2, each mapped to its row; two `PROCTOR_ASSIGNED` entries; room readiness ready. With content and the deadline passed, E1 and E2 mark ready without `proctor_schedule_conflict` (RP-2) |
| I-4 | Move and prune | One E1 student moved to "Ruang 2": row (E1, Ruang 2) is created, the entry runs from "Ruang 1" to "Ruang 2", and E1 reports `active_proctor_room_coverage_incomplete`. Moved back: row (E1, Ruang 2) is deleted, the entry is kept, and no other row is deleted |
| I-5 | Proctor rules | Each refusal leaves zero mutation:<br>• P1 for "Ruang 2" while in "Ruang 1": `proctor_other_room`;<br>• s1: `proctor_ineligible`;<br>• a tenant 2 or unknown ELLIGBLE ID: `proctor_unknown`, byte-identical;<br>• P2 while assigned to E3: `proctor_schedule_conflict` with count 1 |
| I-6 | Rooms across sessions and tenants | "ruang  1" (two spaces, lower case) in S1 is the same room as "Ruang 1" and is stored as "Ruang 1". "Ruang 1" for E3 in S2 gives `room_conflict`. In a non-overlapping session it is accepted. Tenant 2's overlapping "Ruang 1" is accepted and appears in no tenant 1 response (F5 d) |
| I-7 | Room guard | Refused by the trigger with its named constraint:<br>• a raw INSERT of "RUANG 1" for E1;<br>• "Ruang  2" (double space);<br>• an UPDATE of an institution room label;<br>• a DELETE of a room of a cancelled exam.<br>Two rooms "A" on a teacher-managed exam are still accepted (BU-071) |
| I-8 | Participant addition | A student enrolled in X after placement is a candidate. Added into "Ruang 1": the participant, the 0053 rows, the room assignment and the entry are written. `not_enrolled`, `already_participant` and `schedule_conflict` refuse with zero mutation. No route removes a participant or clears a room |
| I-9 | READY re-check (RP-3) | With E1 and E2 READY:<br>• adding P3 (no conflict) to "Ruang 1" keeps both READY;<br>• setting "Ruang 1" to no Proctor demotes both, with READY → SCHEDULED events by O, and lists them in `demoted`;<br>• mark ready again succeeds after P1 is set back;<br>• the extension of E1 then gives 409 `marked_ready_before`, and the period read shows `markedReadyBefore: true` |
| I-10 | Stale and replay | A stale `expectedRevision` gives 409 `stale_assignment` with the current revision. The same key and body replays with no new row. The same key with another body, or on another of the three routes, gives `action_key_reused`. An unchanged Proctor set writes no action, keeps the revision, and answers `changed: false` again on retry |
| I-11 | Lifecycle bounds and cancelled exams | With E1 ACTIVE by fixture SQL, every write touching E1 gives 409 `invalid_state` with zero mutation. After E2 is cancelled (0052, ARCHIVED) while in "Ruang 1" with P1:<br>• E2 is absent from the view and from the room counts;<br>• its participants give `participant_unknown`;<br>• its rows, assignment and mapping are unchanged by a later move or Proctor change of "Ruang 1";<br>• it does not count for `room_unknown`, `proctor_other_room` or `room_conflict` (F1) |
| I-12 | Authority denials (§4.9) | Every route gives 403 to T, P1, s1, a Homeroom Teacher, O2 and O after revocation; 401 unauthenticated; 403 for a foreign session or exam; 403 for a teacher-managed exam |
| I-13 | Scope after commit (N07) | P1's `exam-monitoring` of E1 lists only "Ruang 1" participants. After a move, the moved student leaves P1's list. After P1's removal, 403. P1's Proctor list shows E1 with "Ruang 1"; s1's "Jadwal Ujian" shows "Ruang: Ruang 1" |
| I-14 | Minimization | No response contains `fullName`, `name`, `nis`, `nisn`, `birthDate`, `membershipId`, `prompt`, `options`, `correct`, `rubric` or `score` keys, or any question text. There is no list of members |
| I-15 | Concurrency | Each case serializes to one consistent outcome:<br>• two writes with the same `expectedRevision`: one succeeds, the other gets `stale_assignment`;<br>• a room write racing mark ready, extension or cancellation serializes on the exam lock;<br>• the same label taken concurrently in S1 and S2: one `room_conflict`;<br>• P2 assigned concurrently in S1 and S2: one `proctor_schedule_conflict`;<br>• the same new student added concurrently to overlapping exams of S1 and S2: one `schedule_conflict` (F8) |
| I-16 | Teacher-managed regression | Two overlapping teacher-managed exams with one Proctor still give `proctor_schedule_conflict`. The same Proctor and label in two overlapping sessions still conflict. Every existing suite passes with only the §4.8 changes |
| I-17 | Migration 0063 | Upgrade on a populated database: SCHEDULED institution exams become TRUE/TRUE; READY, ARCHIVED and teacher-managed exams are unchanged. A repeat is a no-op, and a synthetic rollback leaves nothing. UPDATE and DELETE are refused on both new tables. A READY pre-0063 exam gets TRUE/TRUE at its first room write and is re-checked (E7) |
| I-18 | Edge (N10) | A disallowed Origin on each POST path gives 403 `origin_not_allowed`; a 65 KiB body gives 413; zero mutation |

## 6. Exact proposed file scopes (to be frozen at READY)

| # | Path | Purpose |
|---|---|---|
| 1 | docs/production/tasks/ASSESS-INSTITUTION-002.md | Contract, history, evidence (Task-flow) |
| 2 | docs/production/TASK_PLAN.md | Status, counters, ASSESS-INSTITUTION-001 landing (Task-flow) |
| 3 | docs/production/PRODUCTION_COMPLETION_PLAN.md | Status (Task-flow) |
| 4 | docs/DOCUMENT_MANIFEST.md | Index (Task-flow) |
| 5 | docs/production/CBT_ARCHITECTURE_DELTA_REVIEW.md | Appended checkpoint: the 0063 action and entry tables, the room guard and the RP-1 policy update |
| 6 | database/migrations/0063_secure_assessment_institution_rooms.sql | §4.1 |
| 7 | runtime/secure-assessment/src/institution-rooms.ts | Room view, the three writes, `institutionRoomFailure` (new) |
| 8 | runtime/secure-assessment/src/institution-exams.ts | Exports of the Operator frame; placement TRUE/TRUE; `marked_ready_before`; `markedReadyBefore` |
| 9 | runtime/secure-assessment/src/exam-instance-participant-proctor-schedule-conflict-readiness-preflight.ts | Same-session same-room exemption (§4.5) |
| 10 | runtime/secure-assessment/src/server.ts | Four routes |
| 11 | runtime/secure-assessment/src/metrics.ts | Four `COMPONENT_BY_PATH` entries |
| 12 | frontend/web/src/types/assessment.ts | Room view and result types; optional `markedReadyBefore` |
| 13 | frontend/web/src/api/assessment-client.ts | Four client functions |
| 14 | frontend/web/src/components/InstitutionExamView.tsx | "Ruang dan Pengawas" entry; hidden extension; `marked_ready_before` copy; hooks imported |
| 15 | frontend/web/src/components/InstitutionRoomManagementView.tsx | Room screen (new) |
| 16 | frontend/web/src/components/ParticipantChoiceList.tsx | Optional `id` and `note` |
| 17 | frontend/web/src/components/ui/metric.tsx | Documented `layout` variant (F7) |
| 18 | frontend/web/src/components/TeacherExamImportView.tsx | :653 moves onto `layout="narrowFirst"`, same rendered output (F7) |
| 19 | frontend/web/src/hooks/useDialogAction.ts | `useActionKey`, `useRetryFocus` moved unchanged (new) |
| 20 | runtime/secure-assessment/test/institution-rooms.test.ts | Units (new) |
| 21 | runtime/secure-assessment/test/integration/institution-rooms.test.ts | I-1 to I-18 and the §4.9 map on real PostgreSQL (new) |
| 22 | runtime/secure-assessment/test/integration/institution-exams.test.ts | §4.8 only (:357–358) |
| 23 | runtime/secure-assessment/test/route-parity.test.ts | §4.8 only |
| 24 | frontend/web/src/__tests__/institutionRooms.test.tsx | Room screen, entry, dialogs, focus, copy, `ParticipantChoiceList`, `MetricList` variant (new) |
| 25 | e2e/tests/99i-institution-rooms.spec.ts | Five-browser journey and captures (new) |
| 26 | e2e/tests/99h-institution-exams.spec.ts | §4.8 only |

Rows 1–4 are Task-flow paths; the allowlist is rows 5–26, 22 paths. No row depends on an open point.

**Forbidden:**
- every other file, including `helpers.ts`, `global-setup.ts`, `teacher-exam-participants.ts`, `supervision-scope.ts`, the other readiness preflights, `App.tsx`, `lib/status.ts` and the test fixtures;
- completed Task records;
- other migrations;
- lockfiles, dependencies and workflows;
- production resources.

## 7. Acceptance gates (DEFINED / NOT EXECUTED)

| Gate | Expected outcome |
|---|---|
| C01 | Units:<br>• the exact-body parsers, label normalization and comparison, the problem codes and the session revision rule;<br>• the sync rules of E2/E3 as pure functions (rows to create, update and prune; assignments to add and revoke; cancelled exams excluded);<br>• the E7 decision;<br>• `institutionRoomFailure` over every named constraint;<br>• Proctor ID normalization and de-duplication: "  ELG-ABCD-EFGH-JKMN " and "elg-abcd-efgh-jkmn" are one normalized string (400 `invalid_request`); a legacy username and the generated ID of the same account collapse to one Proctor with one assignment per exam, and no `stale_assignment`;<br>• the N10 edge of every new path before any database work |
| C02 | `ParticipantChoiceList` and `MetricList` render every existing call site exactly as before; the `teacherExamImport`, `teacherOperations` and `institutionExams` suites pass unchanged |
| C03 | Real PostgreSQL: I-1 to I-18 and every N-id of the §4.9 map through the production-wired server, with before/after table counts for every refusal (V07, V10, V11) |
| C04 | Regression with only the §4.8 assertions changed |
| C05 | Client:<br>• entry and return focus;<br>• the room screen states (loading, empty, refused, failed, stale, success);<br>• each dialog with retry and notice focus, and the focus after "Hapus";<br>• the READY notice and the demotion notices;<br>• problem copy;<br>• non-editable exams and the hidden "Perpanjang Tenggat";<br>• the `narrowFirst` summary without `overflow-wrap: anywhere` |
| C06 | Five-browser E2E (`99i`). Setup: sessions on later days; `pengawas.e2e` given and later revoked the School Operator assignment, as `99h` does; `guru.e2e` as subject Teacher and a second Proctor.<br>Journey:<br>• the Operator places one exam, adds "Ruang A" with all participants and types `pengawas.e2e` as its Proctor;<br>• the Operator moves one student to "Ruang B" (the coverage blocker shows) and types `guru.e2e` for "Ruang B";<br>• the Student sees "Ruang: Ruang B";<br>• `pengawas.e2e` as Proctor sees the exam with "Ruang A";<br>• a stale second tab gets `stale_assignment`.<br>Shared helpers only |
| C07 | Rendered evidence (`workspace-institution-rooms-*`):<br>• **Baseline:** the five `workspace-visual-*` artifacts of exact-main CI #229, fetched with the resumable, size- and `unzip -t`-checked transfer; manifest recorded at READY step 1.<br>• **After:** the room screen (empty, rooms with and without Proctors, each dialog, a refusal, the READY notice, a demotion notice, a non-editable exam).<br>• **Conditions:** the frozen widths 360, 390, 430, 768, 1024, 1280, 1440 and 640×360, and 200 % text at 390×844 and 1280×800.<br>• **Pass criteria:** no page overflow; targets ≥ 44 px; visible and managed focus (never BODY after a send or after a control removes itself); no mid-word breaks in metric labels; rendered review PASS.<br>• **Earlier captures:** compared by screenshot dimensions and hashes, not only accessibility text. Differences are limited to the §4.8 items, times and generated IDs; the preparation summary of `TeacherExamImportView` is pixel-identical (F7).<br>• **Budget:** the scenario count is bounded so the E2E job keeps its budget (R7) |
| C08 | Scope inside rows 1–26; 33 Tasks and 78 edges; exact-SHA attempt-1 eight-job CI; no re-run |
| C09 | Independent contract, implementation and rendered review PASS; Delegated Acceptance; evidence commit; delegated merge |

**CI-first order,** as ASSESS-INSTITUTION-001 §7:
1. Registration, carrying the ASSESS-INSTITUTION-001 landing and the #229 manifest.
2. Implementation, whose exact-SHA CI passes before review.
3. Implementation and rendered review by the same reviewer.
4. Delegated Acceptance and the evidence commit.
5. PR-head CI, the delegated squash merge, then post-merge main CI.

No re-runs, and no push while the previous commit's CI runs.

**Honest limits and risks:**
- **R1, O09 coverage.**
  - P5 approval excluded the O05 institution composition (:96, :142). OB-2 covers this Task's actions.
  - OB-3 settles the identity fields shown to the Operator: ELLIGBLE IDs and rombel, no member directory, no names (§3.1).
  - A reviewer is never a §8 authority (00.13 §4.1). PB05 stays OPEN.
- **R2, institution exams still cannot open** until ASSESS-INSTITUTION-003 (OP-5 A).
- **R3, pruning** deletes emptied institution room rows and their mappings while the exam is SCHEDULED or READY (E2, the guard).
  - History is kept by label in the append-only entries.
  - Nothing delivered, answered or supervised can be pruned: while an exam is SCHEDULED or READY there is no Attempt, no broadcast (0047 runs only for ACTIVE, PAUSED or ENDED) and no lock.
- **R4, room identity by label** (A04-1): a typo creates a second room; normalization covers case and spacing only.
- **R5, the subject Teacher's monitoring scope** of an institution exam stays exam-wide (`supervision-scope.ts` TEACHER scope) until ASSESS-INSTITUTION-003, as ASSESS-INSTITUTION-001 R3 recorded. Nothing can be monitored while no institution exam can open.
- **R6, READY institution exams placed before 0063** keep FALSE/FALSE and stay consistently READY until their first room write, which sets TRUE/TRUE and re-checks them (E7).
  - They exist only in test databases: there is no production deployment (G7).
  - An untouched one could be opened by ASSESS-INSTITUTION-003 without rooms, so that Task's activation must refuse an institution exam that is not TRUE/TRUE. This is a stated input to its contract, not decided here.
- **R7, E2E budget:** the 99h capture test already needs about 25 minutes. 99i adds captures, so its scenario set is bounded and recorded at READY.
- **R8, room view cost** is bounded by E13 but not measured against the P6 budgets (PERF-001).
- **R9, Proctors are entered and listed by ELLIGBLE ID** only (OB-3): staff names are not stored, and there is no member directory, so the Operator needs each Proctor's ELLIGBLE ID in hand.
- **R10, the Proctors of a cancelled exam** keep their active assignment, because the ASSESS-INSTITUTION-001 cancellation is unchanged. The conflict checks and this Task ignore ARCHIVED exams (F1), and the Proctor list shows the exam as cancelled.
- **R11, a student who changes rombel after placement** stays a participant of the old exam (no removal, OPEN-05).
- **R12, two paths for a READY move once ASSESS-ROOM-001 exists:**
  - this Task's unreasoned allocation (D04.4-59, RP-3, RP-5);
  - ASSESS-ROOM-001's reasoned and versioned transfer (O05-4, TASK_PLAN:423).

  Both share the 0032 current row and the 0063 entries (E18). Which applies to READY is for the ASSESS-ROOM-001 contract, with the Owner where it is a policy choice.
- **R13, a placement racing an addition of the same student:** ASSESS-INSTITUTION-001 placement takes no person lock, so both can commit. Mark ready catches the double-booking with `participant_schedule_conflict`, as ASSESS-INSTITUTION-001 E16 accepted.

## 8. History

- **2026-11-09, contract drafted** under DEC-048 on main 30a7456, after ASSESS-INSTITUTION-001 landed (PR #35; PR-head CI #228 and post-merge main CI #229, attempt 1, eight SUCCESS).
  - Approved inputs: O05-1 to O05-4 and A04-1 to A04-3 (ASSESS-QUESTION-001 §4), OP-1 to OP-9 and OB-1 (ASSESS-INSTITUTION-001 §3.1), and ASSESS-INSTITUTION-001 R4.
  - Open: OB-2 and RP-1 to RP-5, raised with recommended defaults. Migration 0063 proposed, not reserved.
  - Not reviewed; NOT READY; BLOCKED.
- **2026-11-09, Owner decisions in chat,** quoted in §3.1:
  - OB-2: "Setuju batas ini (Recommended)".
  - RP-1, RP-2, RP-4 and RP-5: "Setujui semua default (Recommended)".
  - RP-3: "Periksa ulang (Recommended)".
- **2026-11-09, contract review 1 returned STOP** (F1–F9 and non-material notes a–i, §9).
  - Corrections are applied in this revision.
  - F9 raised OB-3 (the identity fields shown to the Operator).
  - Status: NOT READY, BLOCKED, re-review pending.
- **2026-11-09, Owner decision OB-3 in chat,** quoted in §3.1: "ELLIGBLE ID (Recommended)". All Owner decisions of this Task are now decided. Status: NOT READY, BLOCKED until the contract re-review PASS.
- **2026-11-09, contract review 2 returned PASS** (§9). Corrections 1–3 and notes a–c applied after it, with no further round per the reviewer. Status: contract review chain STOP → PASS; formal READY pending (§10).

## 9. Independent contract review

- **Reviewer:** a fresh-context, read-only subagent under the standing Owner designation. The same reviewer reviews the corrections, the implementation and the rendered evidence.
- **Review 1: STOP,** with findings F1–F9. Each correction:
  - **F1, cancelled exams.** ARCHIVED exams (0052:65–82) keep their rooms and Proctors (`institution-exams.ts:775–797`). They are now never affected, are excluded from sync, counts, `room_unknown`, `proctor_other_room` and the label conflict, and are frozen by the room guard (E2, E10, §4.1, §4.3; I-7, I-11).
  - **F2, the READY overlap with ASSESS-ROOM-001** (O05-4, TASK_PLAN:423). D04.4-59 (:5527–5531) is cited for pre-ACTIVE allocation. ASSESS-ROOM-001 must share the 0032 current row and these entries and must add `assignment_version` over these moves. The overlap is in the RP-3/RP-5 rationale (§3.1, E18, R12).
  - **F3, "satu pengawas satu ruang per sesi".** Recorded as part of the approved RP-2 text and enforced as an application rule (`proctor_other_room`), because 0033 allows several rooms (§3.1, E8).
  - **F4, error mapping.** `institutionRoomFailure` now has named constraints, including 0024 `uq_sa_exam_participants_tenant_instance_person`, and the guard raises named SQLSTATEs and constraints (§4.1, §4.2).
  - **F5, room identity.**
    - (a) the label lock key uses `lower(normalized label)` (E6);
    - (b) a new row copies the room's existing label (E2);
    - (c) the label form is enforced in the database (§4.1);
    - (d) the tenant 2 case is added to I-6.
  - **F6, §4.8.** Only :357–358 and 99h change, because `fixtureExam` is FALSE/FALSE. The treatment of exams that are not TRUE/TRUE is defined. The data update now applies to SCHEDULED exams only, so no READY exam is left inconsistent (§4.1, §4.8, R6).
  - **F7, the metric layout.** `ui/metric.tsx` gains the documented `narrowFirst` variant; `TeacherExamImportView.tsx:653` moves onto it with the same rendered output (§4.6, rows 17–18).
  - **F8, vector gaps.**
    - mark ready refused with room blockers (I-1, I-2);
    - a Proctor without a conflict in I-9 (P3);
    - person locks for concurrent additions (E6, I-15), with the placement race recorded as R13;
    - a key reused across routes (I-10).
  - **F9, identity shown to the Operator.** P5 covers Students' name/NIS/rombel for the Operator (:45, :90) and operational roster and assignment data (:109). It names no ELLIGBLE ID and forbids a new account directory (:152). The Proctor candidate directory is removed: Proctors are typed by ELLIGBLE ID. No name is shown. The remaining exposure, participant and Proctor ELLIGBLE IDs, was put to the Owner as OB-3, decided 2026-11-09 as "ELLIGBLE ID (Recommended)" (§3.1, E12).
- **Non-material notes, each applied:**
  - a: `markedReadyBefore` hides "Perpanjang Tenggat" (E7, §4.6);
  - b: "no way to leave every room" now follows from E2/E4 (E2, §4.7);
  - d: §1 and §8 list the same inputs;
  - e: the I-1 line is :357–358 (§4.8);
  - f: the "ruangan"/"ruang" mismatch is recorded, and `lib/status.ts` is untouched (§4.6);
  - g: an unchanged Proctor write records nothing (E3, I-10);
  - h: A04-2 extends these entries (E9, E18);
  - i: the dialog hooks move to `hooks/useDialogAction.ts` (row 19).
- **Review 2: PASS** on the corrected contract, with no further round required by the reviewer. Corrections applied after it, as the reviewer listed:
  1. Proctor IDs are normalized as `identity_identifier_key` does, equal normalized strings give 400, and IDs resolving to the same person collapse silently before any write (§4.3; C01 vector).
  2. The RP-1 reading now matches R6: an untouched pre-0063 READY exam keeps FALSE/FALSE (§3.1).
  3. The upgrade wording is "any affected institution exam that is not TRUE/TRUE" throughout §4.3, as in §4.8.
  - Notes: a, `proctor_unknown` echoes the failing `elligbleIds`; b, the display label comes from the earliest non-cancelled row (E2); c, plural copy for `proctor_unknown` (§4.6).

## 10. Formal READY and Build start under DEC-048 — 2026-11-09

- **Eligibility (00.13 §4.1):**
  - ASSESS-INSTITUTION-001 is DONE and landed: PR #35, main 30a74562b4946a08311de369a96d50eaaa5d6b46, PR-head CI #228, post-merge main CI #229 (run 42542313684) attempt 1 eight SUCCESS.
  - O05 (O05-1 to O05-4) and A04 (A04-1) are approved in [ASSESS-QUESTION-001 §4](ASSESS-QUESTION-001.md); O09 rests on P5, and its O05 exclusion (CBT_PERMISSION_MATRIX.md:96, :142) and the identity fields shown are covered by the Owner's OB-2 and OB-3 (§3.1).
  - Every open point was decided by the Owner (§3.1). No earlier-row or P0 Task is eligible.
- **Review chain:** STOP → PASS (§9). The three wording and specification corrections the reviewer listed with the PASS are applied; the reviewer required no further round.
- **Frozen allowlist:** §6 rows 5–26, 22 paths; rows 1–4 are Task-flow paths. Migration 0063 reserved. No dependency, workflow or production resource.
- **Rendered baseline (step 1):** the five `workspace-visual-*` artifacts of exact-main CI #229 (run 42542313684, 30a7456).
  - They were fetched with the resumable, size- and `unzip -t`-checked transfer.
  - 3000 pairs (2050 `workspace-question-*` from `99`–`99g` and 950 `workspace-institution-*` from `99h`), all with frontend tree 2f2318bc79799f9515e9d1c469b179b6bf978ed2.
  - Every screenshot hash matches its JSON; zero overflow; zero targets under 44 px.
  - Manifest, built as in ASSESS-QUESTION-004 §10 over the `workspace-question-*` and `workspace-institution-*` captures: SHA-256 da598b6e79c9f4a6f1f841d809387a14817e68e12d5922af0af65983bc2fc66e.
- **CI-first order:** as frozen in §7. This registration is step 1. No re-runs.
- **Status:** BLOCKED → IN_PROGRESS. Counters: DONE 15, IN_PROGRESS 1, VERIFYING 0, BLOCKED 17.

## 11. Implementation checkpoint — 2026-11-09

- **Registration CI:** CI #230 (run 42549222789, f28eeb2, attempt 1): eight SUCCESS.
- **Candidate:** every changed path is in §6 rows 5–26 (22 paths, the frozen allowlist exactly). Status IN_PROGRESS → VERIFYING.
- **Local checks** (8 GB executor; typechecks and targeted units only):
  - secure-assessment and web typecheck clean; the e2e specs typecheck clean;
  - runtime units 57/57 (institution-rooms, institution-exams, route-parity, metrics, the schedule-conflict preflight);
  - web units 74/74 (institutionRooms, institutionExams including :473 unchanged, teacherExamImport, teacherExamParticipants, teacherOperations, designSystemGuard).
  - The real-PostgreSQL integration file (I-1 to I-18, N01 to N10) and the 99i and 99h browser journeys and captures run in CI only.
- **Implementer departures, for the implementation review:**
  1. `markedReadyBefore` is sent only when true. The frozen I-1 assertion compares the whole period item with `deepEqual` (§4.8).
  2. "Tambah Ruang" has the same "Tampilkan" filter as "Tempatkan Peserta" (default "Belum punya ruang"), so C06 can move a student into a new room.
  3. "Kembali ke Ujian Sekolah" uses the shared back-button pattern above the header (whitespace-normal, at least 44 px), not a header action, so it does not overflow at 200 % text.
  4. The 99h journey timeout is 300 s instead of 240 s, for the room and Proctor steps of §4.8.
  5. The participant addition route reads the exam unlocked and then follows the E6 lock order instead of calling `lockInstitutionExam`; taking the exam row first would deadlock against a room write on the same session. Room writes lock every exam row of the session in id order, a superset of E6 step 4 in the same order.
  6. Extra copy: "Tidak ada peserta untuk ditampilkan." (an empty dialog list), "Semua siswa yang terdaftar di rombel ini pada tanggal sesi sudah menjadi peserta." (no candidates), and an `already_participant` line without a number for the race answer that carries no count.
  - 99i uses fixture SQL to store exam R's synthetic questions and to set exam A to ACTIVE and back for the non-editable capture.

### 11.0 Implementation review of d896bfd and its correction

- **Implementation review by the same reviewer: STOP** on one finding. The schema, lock order, readiness re-check, error mapper, duplicate Proctor IDs, cancelled-exam exclusion, OB-3 projection, P5 trace, vectors I-1 to I-18 and N-ids, UI and E2E otherwise match the frozen contract.
  - **F1:** "Pilih semua <rombel>" (InstitutionRoomManagementView.tsx:166) and "Hapus <ELLIGBLE ID>" (:328) used `size="sm"`, a fixed `h-9` (36 px, ui/button.tsx:22), below the 44 px targets that C07 and the 99i capture check require.
  - **Departures 1 to 6 of §11:** accepted. On departure 5 the reviewer recorded risk R14 below.
- **Correction:** both buttons take `h-auto min-h-11`, the pattern already used for the back button. Web units institutionRooms 14/14.
- **R14, room writes lock every exam of the session FOR UPDATE.** No institution exam can open before ASSESS-INSTITUTION-003 (R2), so this costs nothing today. Once a session holds ACTIVE and SCHEDULED exams together, a room write would briefly block answer saves, which take the exam row FOR KEY SHARE. Input to ASSESS-INSTITUTION-003: lock FOR UPDATE only the exams that are SCHEDULED or READY; an exam that has left those states never returns to them and can be refused without a lock.

### 11.0.1 Exact-content CI of the first candidate

- **CI #231** (run 42571511398, d896bfd, attempt 1): FAILURE in the five browser jobs. Web, Runtime (unit and real PostgreSQL 16 integration, I-1 to I-18 and the N-ids, first run) and Container passed.
  - Every journey passed, including 99h with its rooms and Proctor steps and the 99i journey, and so did every earlier capture test.
  - Only the 99i capture test failed, on page overflow with 200 % text:
    - at 390x844 (scrollWidth 438) in rooms-mixed and every capture taken over it. The room list grid had no column template and its items no `min-w-0`, so each room card widened to the min-content of its no-wrap "Tempatkan Peserta" and "Atur Pengawas" buttons;
    - at 1280x800 (scrollWidth 1295, Chromium and WebKit). In the two-column room list, the no-wrap "Belum ada pengawas" badge ran 15 px past its card.
  - Diagnosed from the `e2e-report-mobile-360` and `e2e-report-desktop-1280` artifacts (capture JSON and screenshots); not re-run.
- **Correction** (rows InstitutionRoomManagementView.tsx and 99i):
  - the room list is `grid-cols-1 md:grid-cols-2`, and its items and cards take `min-w-0`;
  - the two card actions wrap (`h-auto min-h-11 whitespace-normal py-2`);
  - the badge wraps within its card (`max-w-full whitespace-normal`); the shared primitive is unchanged;
  - with the F1 correction of §11.0, both buttons are now at least 44 px;
  - the 99i capture reports the outermost unclipped overflowing elements with their right edge and text, and adds them to the overflow message.
  - Local: web typecheck clean; institutionRooms and designSystemGuard 23/23.

### 11.0.2 Exact-content CI of the second candidate

- **CI #232** (run 42581025113, 19ee35e, attempt 1): FAILURE in firefox-1280 only. Web, Runtime (unit and real PostgreSQL integration), Container and the mobile-360, tablet-768, desktop-1280 and webkit-390 browser jobs passed, including every 99i capture there.
  - In Firefox, the 99i capture test reported page overflow at 390x844 with 200 % text (scrollWidth 412) in rooms-mixed and notice-demotion.
  - The new diagnostic named the element: the success notice description (`div.col-start-2 leading-relaxed`, "Peserta ditempatkan di Ruang D: 1 peserta."), a grid item whose `1fr` track kept its min-content width.
- **Correction** (row InstitutionRoomManagementView.tsx): the notice description takes `min-w-0 break-words`. Its track can shrink, and a word breaks only when it alone is wider than the notice. The shared Alert is unchanged.
  - Local: web typecheck clean; institutionRooms 14/14.
