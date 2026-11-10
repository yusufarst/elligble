# ASSESS-ROOM-001 — Atomic participant room transfer during running exams

## 1. Control state and authority

| Field | Disposition |
|---|---|
| Classification | Active P11 Task; P0 / transfer integrity; HIGH risk; R03, R04, R06, R22, R23; P8 V03, V05, V06, V07, V11, V15 |
| Status | **IN_PROGRESS under DEC-048: formal READY PASS (§10). Owner decisions OR-1 to OR-5 decided 2026-11-10 (§3.1); contract review chain STOP → STOP → PASS (§9); A04 Owner and reviewer halves recorded** |
| Objective | During a running institution exam (ACTIVE or PAUSED), the School Operator moves one participant from their current exam room to another room of the same exam that has an active Proctor. The move:<br>• needs a reason and an on-screen confirmation;<br>• compares the participant's `assignment_version` and is safe to replay;<br>• changes only the current room row and appends one attributable history entry.<br>Person, Participant, Attempt, question snapshot and randomization, accepted and pending answers, server time, device session and submission are untouched. The old room's Proctor loses the participant at commit and the new room's Proctor gains them. Teacher-managed exams are unchanged |
| Owner decisions | **Approved inputs:**<br>• O05-1 to O05-6 and A04-1 to A04-3, decided 2026-11-07 ([ASSESS-QUESTION-001 §4](ASSESS-QUESTION-001.md)); this Task uses O05-4, O05-5, A04-2 and A04-3;<br>• OP-1 to OP-9 and OB-1 ([ASSESS-INSTITUTION-001 §3.1](ASSESS-INSTITUTION-001.md));<br>• OB-2, RP-1 to RP-5 and OB-3 ([ASSESS-INSTITUTION-002 §3.1](ASSESS-INSTITUTION-002.md));<br>• OC-1 to OC-6 ([ASSESS-INSTITUTION-003 §3.1](ASSESS-INSTITUTION-003.md));<br>• OR-1 to OR-5 and the OR-3 supplement, decided 2026-11-10 (§3.1).<br>**Open:** none. The Owner confirmed the corrected OR-5 case list I-6 to I-15 on 2026-11-10 (§3.1).<br>Reviewer: the standing Owner-designated read-only subagent reviewer, a fresh one for this Task. It is also the A04 assessment/security reviewer named in ASSESS-QUESTION-001:57 (F8) |
| Execution authority | DEC-048 (00.13). Not eligible yet (below) |
| Base and branch | Drafted on ced45b3 (branch task/assess-institution-003, worktree `C:\Projects\ELLIGBLE-institution-003`), whose code equals `main` after ASSESS-INSTITUTION-003 lands. Proposed branch task/assess-room-001 from `main` after that landing |
| Parallel safe / cost | No parallel baseline Task; no dependency, vendor, service or cost |

**Eligibility under 00.13 §4.1** (checked at drafting; re-checked at READY):
- **Internal dependencies** (TASK_PLAN:170, :438):
  - ASSESS-INSTITUTION-002 is DONE (PR #36, main e1f2ec4, CI #237).
  - ASSESS-INSTITUTION-003 is VERIFYING. It must be DONE and landed with passing post-merge `main` CI.
- **External gate O05** (TASK_PLAN §8 :636, Owner + assessment/security reviewer): approved for this Task as O05-4 (eligibility) and O05-5 (session continuity). The Owner decided the rest as OR-1 to OR-3 (§3.1).
- **External gate O09** (:640):
  - The P5 A07 row (CBT_PERMISSION_MATRIX.md:36, :106) is approved K/P content.
  - Its C column says "O05 exact target eligibility/session continuity, P4 A04. Until accepted technical contract, no room-transfer implementation grant". O05-4, O05-5 and A04-2/A04-3 settle the named inputs; the accepted technical contract is this record at review PASS.
  - The :142 exclusion "O05 institution/transfer/publication composition" is covered by O05-4, O05-5 and OR-1 to OR-3.
- **External gate A04** (:644): it needs an "Approved lock-order/assignment-revision/session-transition contract and defined concurrency cases", from the Owner and the assessment/security reviewer. The parts:
  - **Assignment revision, session transition and scope:** approved as A04-2 (`assignment_version`, idempotent `actionKey`), O05-5 and A04-3, Owner 2026-11-07.
  - **Lock order:**
    - Owner half: OR-4, decided 2026-11-10 (§3.1). It corrects the literal "Attempt first" of A04-2.
    - Reviewer half: the standing reviewer's PASS on §4.2 (F8).
  - **Defined concurrency cases** (I-6 to I-15 of §5, the list as corrected by F3):
    - Owner half: OR-5, decided 2026-11-10, effective at contract review PASS.
    - Reviewer half: the same PASS (F8).
  - **Recording (F8):** the PASS verdict, with its reviewed SHA, is recorded in §9 as the reviewer half of A04. A04 is §7-reserved, and the executor never resolves it alone.
- **OPEN policy inputs:** none of O01 to O08 is used. OPEN-05 (participant removal) is not touched.
- **Selection:** once eligible, this is the first eligible row in TASK_PLAN order.
  - ASSESS-STUDENT-001 (P0, above it) waits on O04 (OPEN).
  - OPS-STAGING-001, OPS-001, PERF-001, DEVICE-001, VERIFY-INTEGRITY-001, LEGAL-001, SEC-RELEASE-001 and RELEASE-001 are prepare-only (00.13 §7).

**Authority:**
- **Governance:**
  - [DEC-044](../../00-governance/00.11_CBT_RELEASE_SCOPE_REALIGNMENT.md): §5A (:75–96, Owner requirement), OD-07 (:156) and OD-07b (:157);
  - [DEC-045 §5](../../00-governance/00.12_AICWDF_ADOPTION_AND_TASK_EXECUTION.md);
  - [DEC-048](../../00-governance/00.13_STANDING_EXECUTION_DELEGATION.md).
- **Plan and rules:**
  - [TASK_PLAN ASSESS-ROOM-001/§4/§8](../TASK_PLAN.md):
    - the card :435–443, with acceptance at :439 and tests at :440;
    - O05 :636, O09 :640 and A04 :644 of §8;
  - [P2 CBT_DOMAIN_RULES_SPECIFICATION](../CBT_DOMAIN_RULES_SPECIFICATION.md) §5: the proposed command (:79) and the mandatory invariants (:81);
  - [P3 ROUTE_INTERACTION_MATRIX](../ROUTE_INTERACTION_MATRIX.md) F07 (:52) and W03 (:24);
  - [P4 CBT_ARCHITECTURE_DELTA_REVIEW](../CBT_ARCHITECTURE_DELTA_REVIEW.md) A04 (:29): "Inspect existing exam→Attempt lock acquisition before choosing ordering; all involved writers must use compatible ordering";
  - [P5 CBT_PERMISSION_MATRIX](../CBT_PERMISSION_MATRIX.md):
    - the data rule :45 and P02 :86;
    - rows A05 (:34, :104), A06 (:35, :105) and A07 (:36, :106, :127);
    - N01–N10 (:50–60): N03 at :53, N06 at :56 and N07 at :57;
    - the exclusions :142;
  - [CBT_UX_SCREEN_AND_INTERACTION_INVENTORY](../CBT_UX_SCREEN_AND_INTERACTION_INVENTORY.md) C19 (:52), R22 (:86);
  - [CBT_VERIFICATION_AND_RELEASE_DOD_PLAN](../CBT_VERIFICATION_AND_RELEASE_DOD_PLAN.md) V03 (:29), V05 (:31), V06 (:32), V07 (:33), V11 (:37), V15 (:41).
- **Locked discovery rules** ([04.01_SECURE_ASSESSMENT.md](../../01-discovery/04.01_SECURE_ASSESSMENT.md); D04.1 and D04.4 are "REVIEWED & LOCKED", :20 and :4222):
  - D04.1-23B (:396): a transfer keeps participant, Attempt, answers, remaining time, snapshot and evidence. It records "from room, to room, reason, authorized actor, timestamp" and "related incident/risk context where applicable";
  - D04.1-23C (:426) and D04.4-30 (:4762): a transfer is not a cheating verdict;
  - D04.2-67 (:2295): a runtime room transfer "changes supervision context only";
  - D04.4-26 (:4578): Proctor scope follows the room assignment;
  - D04.4-27 (:4719): one current room, "Historical room transfers remain recorded";
  - D04.4-28 (:4727): same participant, Attempt, exam snapshot, answers and randomization; only the room may change;
  - D04.4-31 (:4770): from room, to room, reason, actor, timestamp, "related incident/risk reference where applicable";
  - D04.4-45 (:5178): time during a transfer "Follows Explicit Policy", "No implicit reset" (O05-5 chose "No … timer change");
  - D04.4-59 (:5527): before ACTIVE an allocation is corrected; "After ACTIVE, changes become governed transfers";
  - D04.4-65 (:5585): a mistaken transfer is reversible with audit;
  - D04.4-67 (:5601): "move room" must be atomic and leave no half-updated state.
- **Earlier records:**
  - [ASSESS-INSTITUTION-002](ASSESS-INSTITUTION-002.md): E4, E5, E6, E9, E18, the residual risk R12 and the 0063 tables;
  - [ASSESS-INSTITUTION-003](ASSESS-INSTITUTION-003.md):
    - E1, E3, E11, E13 (R14), E15, E21 and OC-1 to OC-6;
    - the N03/N07 tests (`school-exam-monitoring.test.ts:894–906`);
    - the rendered lessons of §11.0.2 to §11.0.4: focus fallback, the single-pass 200 % calibration, R17, and guru.e2e landing on "Ruang Ujian".
- **Schema:** migrations 0008, 0031–0034, 0044, 0046, 0047, 0054, 0062, 0063 and 0064 are reused. One new migration, 0065, extends 0032 and 0063 (§4.1).

No LOCKED decision or PB status changes. OPEN-05 stays OPEN.

## 2. Reuse and bounded gaps

**Reused:**
- **The room model:**
  - one current room per participant: 0032 `uq_sa_exam_participant_room_assignment_participant`;
  - room rows per exam (0031), Proctor assignments and their room mapping (0008, 0033), and the room policy flags (0034);
  - the per-exam room guard of 0063, which keeps every room row of an opened institution exam.
- **The room history of ASSESS-INSTITUTION-002** (0063): the action table with its session revision, and the entry table with `from_room_label` and `room_label`. ASSESS-INSTITUTION-002 E18 requires this Task to reuse them, extending the entry kinds rather than adding a parallel history.
- **The Operator frame:**
  - `operatorWrite` with the `rooms` action-key namespace (`institution-exams.ts:303–338`). It takes the Operator assignment FOR SHARE before the run and re-checks it before commit (:298, :328);
  - `institutionFailure`, `hasExactKeys`, `digestOf` and `refuse`;
  - `lockSession` and `institutionRoomFailure` (`institution-rooms.ts:321`, :267);
  - `keyShareInstitutionExam` (`school-exam-monitoring.ts:311`, E21 there).
- **The attempt writers' order:**
  - save: exam FOR KEY SHARE, then Attempt FOR UPDATE (`answer.ts:145–158`);
  - submit: the same order (`submission.ts:123–128`), and a second path that takes the Attempt alone (:390–393). Submission only inserts a submission row (`submission.ts:18–24`);
  - session activation and takeover: Attempt FOR UPDATE (`session.ts:80–84`);
  - start: the participant row FOR UPDATE, then the exam FOR SHARE (`attempt-start.ts:52–57`, :86–96);
  - the expiry finalizer: Attempt FOR UPDATE SKIP LOCKED, then the submission insert (`expiry-finalization.ts:22–37`);
  - remaining time: `secure_assessment_attempt_remaining_seconds` (0044:106).

  None of these writers reads or locks a room row.
- **The re-read pattern after the Attempt lock** (`participant-time.ts`, "Read after the attempt lock, in a statement of its own"; `participant-lock.ts:91–98`): a submission committed while the request waited is seen.
- **The per-request supervision scope** (`supervision-scope.ts`): `resolveSupervisionScope` and `participantInScope` join the current 0032 row on every request (A04-3). No cached scope exists.
- **The Operator participant level of ASSESS-INSTITUTION-003:**
  - `readMonitoringProjection` with the `OPERATOR` viewer;
  - `ExamMonitoringView` with `OPERATOR_SOURCE`;
  - `ActionReasonField`, `permissionDialogClass`, `NativeSelect` and `useActionKey`;
  - the Operator-only 44 px targets and focus fallback (§11.0.3 there).

**Gaps closed:**
- No product path moves a participant once an exam is open: room writes refuse any affected exam that is not SCHEDULED or READY (ASSESS-INSTITUTION-002 E10).
- The 0032 row has no version (A04-2), so a stale move cannot be refused per participant.
- The 0063 history has no reason, no confirmation and no transfer kind.
- The Operator participant projection carries no current room id, version or room coverage, so the client cannot offer a valid target.

**Excluded:**
- moves while the exam is SCHEDULED, READY, ENDED or later:
  - SCHEDULED and READY moves stay with the room screen of ASSESS-INSTITUTION-002 (OR-1);
  - ENDED and later are outside O05-4;
- creating a room row, or changing or adding Proctors, after opening (OR-2, OC-6, OB-2);
- seat moves (D04.6-43), stricter-room designation (D04.4-29), device transfer (D04.4-39 to D04.4-46);
- risk signals, incidents and the incident or risk reference of D04.1-23B and D04.4-31. That reference is not applicable until ASSESS-PROCTOR-003 provides incidents;
- any change to answers, timers, sessions, submissions, locks, snapshots or the broadcast history query (OR-3 supplement);
- participant removal (OPEN-05);
- teacher-managed exams (E2);
- load evidence under P6 budgets, the load part of V15 (PERF-001).

## 3. Settled inputs, Owner decisions and engineering readings

**Approved before this Task (quoted):**
- **00.11 §5A** (:77, Owner requirement): "An authorized School Operator can move a participant's room assignment from one exam room to another, including while the exam is running, with a mandatory reason, explicit confirmation and an append-only audit trail."
  - It preserves "the Student identity; the Participant; the Attempt; accepted answers; the local and server reconciliation semantics; the authoritative remaining time; the submission state".
  - It never "creates a retake; creates a new Attempt; deletes or resets answers; resets the timer" (:79–94).
- **OD-07** (:156): the School Operator's participant operations include "room reassignment per §5A". The Proctor's rights are "monitor, signal feed, lock and unlock, messages, incident notes; no added time", with no reassignment.
- **O05-4** (ASSESS-QUESTION-001.md:80): "Allowed only within the same tenant and ExamInstance, for a participant who has not submitted or expired, while the exam is READY, ACTIVE or PAUSED. The target room must be covered by a Proctor when the exam's policy requires one. Not allowed after submission."
- **O05-5** (:81): "The same active session continues. No logout, takeover or timer change. Room scope is checked again on every request."
- **A04-2** (:93): "Lock the Attempt `FOR UPDATE` first, in the same order as save, submit and session. Then lock the room assignment, compare a new `assignment_version`, insert an append-only history row and update the current row, all in one transaction. Retries are idempotent through `actionKey`." OR-4 corrects the lock order.
- **A04-3** (:94): "Keep the per-request join to the current room, with no cached scope. The old room's Proctor loses access at commit."
- **P5 A07** (:106):
  - actor: "School Operator, same tenant/exam, current participant/source-room revision and authorized target room; no new identity/Attempt";
  - reads "minimized source/target assignment/status" and writes the "atomic authorized room move only", with "No answers/scores/session secret/fingerprint";
  - requires "Mandatory reason/confirmation/audit; replay/version and scope-at-commit; deny old room's Proctor after committed transfer".
- **P2 §5** (:79): "Proposed transfer command: `{examInstanceId, participantId, targetRoomId, reason, actionKey, expectedAssignmentVersion}`"; "Actor from authenticated context, never payload".
- **ASSESS-INSTITUTION-002 E18** (:236–241): "ASSESS-ROOM-001 must use the same 0032 current row and these 0063 entries for its READY and later transfers, extending the entry kinds rather than adding a parallel history. It must also add its `assignment_version` over the moves made here, with a defined initial version for rows created by this Task." R12 (:710–714) leaves the READY overlap to this contract, "with the Owner where it is a policy choice".
- **OB-2** (ASSESS-INSTITUTION-002 §3.1): room, participant and Proctor writes "hanya sebelum ujian dibuka". **RP-3 and RP-5:** READY allocation changes need no reason and re-check readiness.
- **OC-6** (ASSESS-INSTITUTION-003 §3.1): "Pengawas tidak dapat diubah setelah ujian dibuka; tetap sesuai OB-2 (hanya sebelum ujian dibuka)."
- **ASSESS-INSTITUTION-003 E13 (R14):** room writes lock only SCHEDULED or READY exams; an opened exam is refused without a lock.
- **Card acceptance** (TASK_PLAN:439): "Reason/confirmation/replay/revision guarded School Operator move preserves Person, Participant, Attempt, snapshot/randomization, accepted/pending answers, time and submission. Exactly one current room plus append-only history; old-room Proctor loses access at committed boundary. Session continuity follows approved A04, never guessed."
- **Card tests** (:440): "simultaneous save/submit/expiry/lock/takeover/opposed transfers, lost ACK/replay, lock ordering and server-before/after comparison".

**Settled by these inputs, so not asked:**
- **Who moves:** only the School Operator (§5A, OD-07, P5 A07, card). Proctors and Teachers get 403. An Operator who is also a Proctor moves as Operator on this route (P03).
- **When:** ACTIVE and PAUSED are allowed (O05-4). ENDED and later are refused, even though an attempt may still run after END (R3).
- **Effect on the attempt:**
  - no pause and no timer change: server time keeps running during the physical move, or stays frozen while PAUSED (O05-5, D04.4-45);
  - no logout and no takeover (O05-5);
  - a lock stays as it is, because O05-4 does not exclude a locked participant.
- **Reason:** mandatory (§5A, P02), in the existing form of 1 to 200 characters (0054, 0064).
- **Target coverage:** every institution exam that can open is TRUE/TRUE (RP-1; ASSESS-INSTITUTION-003 E7 step 2). A target room therefore needs an active Proctor mapped to that room row (O05-4).
- **The reason is never returned (F5):** it is stored in the 0063 action row only. No response, projection or receipt carries it, not even to its author.

### 3.1 Owner decisions (decided 2026-11-10 in chat)

O05-4 and O05-5 leave five points open:
- which command moves a READY participant (ASSESS-INSTITUTION-002 R12);
- which rooms are valid targets;
- what people see after a move;
- the A04-2 lock order, which inspection showed can deadlock;
- the approval of the concurrency cases that §8 A04 requires.

Each point changes what users see or do, or an approved architecture decision, so it went to the Owner (00.13 §7). Review finding F4 added one supplement. The Owner's answers are quoted verbatim:

- **OR-4, the lock order of A04-2.**
  - Question: "Task berikutnya ASSESS-ROOM-001 (pindah ruang peserta saat ujian berjalan), OR-4 urutan kunci: urutan literal A04-2 "Attempt dulu" dapat bentrok (deadlock) dengan jalur kunci pengawas yang mengambil baris ruang sebelum Attempt. Urutan mana yang dipakai?"
  - The Owner chose **"Baris ruang sebelum Attempt (Recommended)"**, whose option text was "Kunci sesi, ujian (KEY SHARE), baris ruang, lalu Attempt; sama dengan jalur pengawas sehingga tidak ada deadlock."
  - **Basis of the finding:**
    - the Proctor lock and unlock go through the SEC-001 wrapper;
    - that wrapper takes the exam FOR KEY SHARE, the Proctor assignment and room mappings FOR SHARE, then every 0032 row of the Proctor's rooms FOR SHARE (`supervision-scope.ts:56–75`, called from `permission-action-audit.ts:144–145`);
    - only after that does it take the Attempt FOR UPDATE (`permission-action-audit.ts:168–172`).
  - **Alternatives considered:**
    - keeping A04-2 literally and accepting a detected deadlock (40P01, answered 409 `state_changed`);
    - changing the SEC-001 wrapper.
  - **Variant recorded, not chosen:** keeping "Attempt first" and taking the 0032 row with `FOR UPDATE NOWAIT`, which would turn the cycle into an immediate 409. A race with a Proctor would still refuse the move rather than order it.
- **OR-1, moves while the exam is Siap (READY).**
  - Question: "ASSESS-ROOM-001, OR-1: bagaimana memindahkan peserta saat ujian sekolah berstatus Siap (belum dibuka)?"
  - The Owner chose **"Lewat Ruang dan Pengawas (Recommended)"**, whose option text was "Tetap memakai layar Ruang dan Pengawas (RP-3/RP-5); perintah pindah dengan alasan hanya untuk ujian Berlangsung atau Dijeda."
- **OR-2 and OR-3, one question.**
  - Question: "ASSESS-ROOM-001, default yang direkomendasikan: OR-2 ruang tujuan hanya ruang yang sudah dipakai ujian itu dan punya pengawas aktif (tanpa membuat ruang baru saat berjalan, sesuai OC-6). OR-3 tanpa pemberitahuan otomatis ke siswa; pindahan tercatat dan tampil di daftar ruang. Setujui keduanya?"
  - The Owner chose **"Setujui keduanya (Recommended)"**.
  - **Reading recorded for OR-3:** "tercatat dan tampil di daftar ruang" means two things:
    - the move is recorded in the 0063 ledger;
    - the participant appears under the new room in the existing lists: the Operator's participant level, the session room counts, and the Proctor lists.
  - It adds no transfer note and no history view. Otherwise OR-3 is the drafted option A: no automatic message to the Student, whose exam-list "Ruang" label changes on its next load.
- **OR-3 supplement, broadcast history (review F4).**
  - Question: "ASSESS-ROOM-001 (temuan reviewer F4): riwayat pesan pengawas mengikuti ruang peserta saat ini. Setelah siswa dipindah, pengawas ruang baru melihat pesan lama yang pernah diterima siswa itu (isi dan pengirim), dan pengawas ruang lama tidak lagi melihat pesan yang ia kirim ke siswa itu. Bagaimana sikapnya?"
  - The Owner chose **"Terima dan catat (Recommended)"**, whose option text was "Perilaku riwayat yang sudah ada dipertahankan dan dicatat sebagai akibat pindah ruang; tanpa perubahan kode riwayat pesan."
- **OR-5, approval of the concurrency cases** (TASK_PLAN §8 A04 :644).
  - Question: "ASSESS-ROOM-001, OR-5: gerbang A04 mensyaratkan persetujuan Owner atas kasus konkurensi (I-8 sampai I-12: pindah bersamaan, pindah vs jawaban, pindah vs kunci pengawas, ulangan permintaan, sesi berakhir). Bagaimana persetujuannya?"
  - The Owner chose **"Setujui setelah review kontrak PASS (Recommended)"**.
  - **Scope of the approval:** the concurrency case list as corrected after review (F3). The final list is **I-6 to I-15** of §5:
    - I-6: stale and opposed transfers;
    - I-7: replay and lost ACK;
    - I-8: save;
    - I-9: submit and expiry, both orders;
    - I-10: Proctor lock;
    - I-11: takeover;
    - I-12: session and exam controls;
    - I-13: the Operator's own lock and added time;
    - I-14: start of a not-started participant;
    - I-15: Operator revocation at commit.
  - **Owner confirmation of the corrected list** (re-review 2 F1, 2026-11-10 in chat):
    - Question: "ASSESS-ROOM-001, konfirmasi OR-5 (reviewer F1): daftar kasus konkurensi yang sudah dikoreksi dan disetujui reviewer adalah I-6 sampai I-15: pindah bersamaan, pindah vs simpan jawaban, pindah vs kumpul dan finalisasi waktu habis (kedua urutan), pindah vs kunci pengawas, pindah vs kunci dan tambah waktu Operator, mulai ujian vs pindah peserta yang belum mulai, pencabutan penugasan Operator, ulangan permintaan, dan sesi berakhir. Setujui daftar I-6 sampai I-15 ini?"
    - The Owner chose **"Setujui I-6 sampai I-15 (Recommended)"**.
  - The Owner's approval therefore covers exactly I-6 to I-15 as written in §5. A change to these cases returns to the Owner.

**What each decision fixes in this contract:**
- **OR-1:** the route refuses READY with 409 `invalid_state` (E6). The room screen keeps READY moves (RP-3, RP-5).
- **OR-2:** the target is an existing room row of the same exam with an active mapped Proctor (E7). No room row and no Proctor assignment is ever created.
- **OR-3:** no message is sent and no Student field is added. The participant is listed under the new room in the existing lists. Only the Operator projection gains `roomId`, `assignmentVersion` and room `supervised` (E10), which the dialog needs.
- **OR-3 supplement:** E15; no change to `readBroadcastHistory`.
- **OR-4:** the lock order of §4.2.
- **OR-5:** §5 I-6 to I-15 are the approved concurrency cases, effective at review PASS.

### 3.2 Engineering readings (for the contract review)

- **E1, authority.**
  - The ASSESS-INSTITUTION-001 E1 reading applies: an active `tenant_school_operator_assignments` row, FOR SHARE before the run and re-checked before commit (`operatorWrite`). Platform CLI authority is never inherited.
  - The exam must be this tenant's institution exam; anything else is 403.
- **E2, teacher-managed exams.** Out of scope:
  - no product or CLI path creates rooms for a teacher-managed exam: rooms exist only through institution room writes and test fixtures (ASSESS-INSTITUTION-002 §2);
  - every Operator route gives 403 for a teacher-managed exam (ASSESS-INSTITUTION-003 E1);
  - OD-07 gives no Teacher a room reassignment.
- **E3, the version** (A04-2, E18).
  - 0032 gains `assignment_version integer NOT NULL DEFAULT 1`. Every existing row, including those written by ASSESS-INSTITUTION-002, reads 1. That is the defined initial version.
  - A BEFORE INSERT OR UPDATE trigger owns the column:
    - an insert always gets 1;
    - an update that changes `exam_room_id` gets the old value plus 1;
    - any other update keeps the old value, so no caller can set it.
  - The room writes of ASSESS-INSTITUTION-002 therefore bump the version on every move without a code change, and a transfer bumps it the same way.
- **E4, the lock order** (OR-4). See §4.2. Why it is compatible with every writer:
  - the only code that locks 0032 rows is `supervision-scope.ts:75` (FOR SHARE, before the Attempt);
  - room writes update 0032 rows only of SCHEDULED or READY exams, under the session lock;
  - no writer takes an Attempt and then a 0032 row.

  The session advisory lock comes first, because the session-wide pause and end of ASSESS-INSTITUTION-003 hold it while they take exam rows FOR UPDATE (`lockSession`, E9 there).
- **E5, scope at commit** (A04-3, N07).
  - A Proctor request that reads its scope after the transfer commits sees the new room, because the scope is a per-request join.
  - A Proctor lock racing the transfer is ordered by the 0032 row lock:
    - **Proctor first:** it holds the row FOR SHARE, the transfer waits, and the lock is ordered before the move.
    - **Transfer first:** the Proctor's FOR SHARE waits. PostgreSQL then re-checks the join on the moved row, which no longer matches the Proctor's room, and `participantInScope` refuses with 403.
  - A monitoring read is a REPEATABLE READ snapshot. A read that started before the commit shows the old room once; the next refresh shows the new one.
- **E6, checks and their order** (O05-4, OR-1, F9). Scope checks run before any object lock where the checked fact cannot change for an opened exam. The first failing check decides the refusal.
  1. **Exam (unlocked read):** the exam is this tenant's institution exam, otherwise 403. Its `institution_session_id` is read here; it is immutable (0062).
  2. **Participant (unlocked read):** the participant is a participant of that exam, otherwise 403. Participants are never removed (OPEN-05).
  3. **Target (unlocked read):** the target is a room row of that exam, otherwise 403. Room rows of an opened institution exam are never deleted (the 0063 guard). A row that was pruned while the exam was still READY, after which the exam was activated, has no active mapped Proctor and is caught at step 10 with `target_room_unsupervised`.
  4. **State,** under the session lock and the exam FOR KEY SHARE: the exam is ACTIVE or PAUSED, otherwise 409 `invalid_state` with `currentState`.
  5. **Room policy:** the exam is TRUE/TRUE, otherwise 409 `room_setup_required`, the code of ASSESS-INSTITUTION-003 E7. Only fixture exams can be FALSE/FALSE while open.
  6. **Current room:** the participant's 0032 row, FOR UPDATE, scoped by `(tenant_id, exam_instance_id, exam_participant_id)`.
     - No row gives 409 `participant_without_room`. It is unreachable through the product, because readiness requires every participant to have a room before opening and OB-2 forbids additions after opening. It is named so a fixture or defect never answers 500.
  7. **Version:** the row's version equals `expectedAssignmentVersion`, otherwise 409 `stale_assignment` with `{assignmentVersion, roomLabel}`.
  8. **Not the same room:** the target is not the current room, otherwise 409 `already_in_room`.
  9. **The Attempt:** the open (first unsubmitted) Attempt is taken FOR UPDATE, scoped by `(tenant_id, exam_participant_id)`. Then a **new statement** re-reads the submission and the remaining time at `statement_timestamp()` (F1, the `participant-time.ts` pattern). A submit or finalizer that committed while the transfer waited is therefore seen.
     - The snapshot taken before the wait is not trusted. That is why `permission-action-audit.ts:168–171`, whose pre-wait query could miss an in-flight submit, is not the pattern.
     - Submitted, or no open Attempt but a submitted one: 409 `attempt_already_submitted`.
     - No Attempt at all: eligible (not started).
     - Remaining time 0 or less: 409 `time_up` (expired, awaiting the finalizer).
     - Remaining time NULL (timer not started): eligible.
     - Otherwise eligible.
  10. **Target coverage:** the target room row and its active mapped Proctor assignments are taken FOR SHARE. With none, 409 `target_room_unsupervised`.

  A locked participant is eligible, and the lock is unchanged.
- **E7, the target.** Only an existing room row of the same exam (OR-2).
  - In ACTIVE and PAUSED the 0063 guard forbids deleting room rows, so a source room may be left empty. It stays, with its Proctors, who then see no one.
  - Nothing is pruned and no readiness is re-checked; readiness is a pre-open gate.
- **E8, history** (E18 of ASSESS-INSTITUTION-002, D04.1-23B, D04.4-27, D04.4-31).
  - Each applied transfer writes one 0063 action row of the new kind `PARTICIPANT_TRANSFER`, with:
    - the session revision plus 1;
    - the reason and `confirmed`;
    - the actor, the time, the key and the digest.
  - It also writes exactly one entry of the new kind `PARTICIPANT_TRANSFER`, with:
    - the participant;
    - the open Attempt, NULL when not started;
    - `from_room_label` and `room_label`;
    - the resulting `assignment_version`.
  - The incident or risk reference of D04.1-23B and D04.4-31 is not applicable until ASSESS-PROCTOR-003 provides incidents.
  - The session revision moves, so a stale room screen gets `stale_assignment` (ASSESS-INSTITUTION-002 E5). Revisions stay unique and dense under the session lock.
  - *Rejected alternative, recorded for the reviewer:* a `ROOM_TRANSFER` kind in the 0064 control ledger with a 0063 entry beside it. It splits one move over two ledgers, against E18's "rather than adding a parallel history".
- **E9, replay** (A04-2; P2 :81, "Lost acknowledgement then retry must return same transfer once").
  - A 0063 action with the key, the kind `PARTICIPANT_TRANSFER`, the same actor and the same digest returns the original receipt with `replayed: true`. The receipt is rebuilt from the action and its entry and never re-evaluated.
  - Another kind, actor or digest gives 409 `action_key_reused`. A transfer key used on a room route gives the same answer through the existing `sameAction` kind check.
  - The digest covers `{examInstanceId, participantId, targetRoomId, expectedAssignmentVersion, reason, confirmed}`.
- **E10, the Operator projection** (OR-3, P01, A07 "minimized source/target assignment/status").
  - With the `OPERATOR` viewer only, `readMonitoringProjection` adds each participant's `roomId` and `assignmentVersion`, and each room's `supervised`.
  - `supervised` is computed in `exam-monitoring.ts` by its own query: an active Proctor assignment mapped to that row. `readScopeRooms` in `exam-broadcast.ts` is unchanged.
  - The Proctor and Teacher projections stay byte-identical. Names, session handles, fingerprints, answers, scores and reasons are still never shown.
- **E11, session continuity** (O05-5, D04.4-28, P2 :81, V03). The transfer writes only the 0032 row and the 0063 rows.
  - The active `secure_assessment_exam_sessions` row, the device, the timer state, additions, pauses, locks, answers and submissions are not touched.
  - The device keeps saving with the same session and write versions, and its local queue keeps syncing.
  - Nothing is sent to the device (OR-3). The Student's "Ruang: …" badge (`AssignedExamDiscovery.tsx:167`) reads the current room per request.
- **E12, routes.**
  - One flat path in the institution supervision namespace, `POST /api/v1/assessment/institution-exams/supervision/room-transfer`, dispatched by `server.ts` to the new module.
  - This is a recorded deviation from P3 F07's proposed `/api/v1/assessment/participant-room-transfers`, as ASSESS-INSTITUTION-003 E14 did.
- **E13, client placement.**
  - The move is a row action of the Operator participant level ("Pantau Peserta" of "Pelaksanaan Sesi").
  - `MonitoringSource` gains an optional `transfer`. Only `OPERATOR_SOURCE` sets it, so every other caller renders as before.
  - The dialog is the card's `ParticipantRoomTransferDialog`, built from the shared primitives under §10.1 of the living plan. It keeps one supervision screen for every role, with the Operator-only targets and focus rules of ASSESS-INSTITUTION-003 §11.0.3.
- **E14, E2E.**
  - The new spec `99k-room-transfer.spec.ts` sorts after `99j`.
  - Its fixture follows 99j: questions, deadline and window set by fixture SQL, and the ending of earlier overlapping exams.
  - It carries the 99j single-pass 200 % calibration step unchanged, copied rather than imported, because `helpers.ts` stays forbidden. A shared extraction is the R17 follow-up of ASSESS-INSTITUTION-003.
  - guru.e2e, also a Proctor, lands on "Ruang Ujian" first (AppShell order, ASSESS-INSTITUTION-003 §11.0.4). 99k uses that as the Proctor view of the new room.
- **E15, broadcast history follows the current room** (F4, OR-3 supplement).
  - `readBroadcastHistory` (`exam-broadcast.ts:261–279`) filters a Proctor's history by `participantInScope` on each recipient's current room.
  - After a move, the new room's Proctor therefore sees the earlier messages the Student received, with their text and sender, and the old room's Proctor no longer sees the messages it sent to that Student.
  - The Owner accepted this as an effect of the move ("Terima dan catat"). No history code changes. Recipients and delivery records (0047) are unchanged.

**Recorded deviations from proposed (not locked) documents:**
- The card's `participant-room-transfer.ts`, `ParticipantRoomTransferDialog.tsx` and `test/integration/participant-room-transfer.test.ts` are kept.
- The card's `supervision-scope.ts`, `answer.ts`, `submission.ts` and `session.ts` are reused unchanged.
- `e2e/tests/15-room-transfer.spec.ts` becomes `99k-room-transfer.spec.ts` (E14).
- P3 F07's path becomes a flat path (E12).

## 4. Contract

### 4.1 Schema (migration `0065_secure_assessment_participant_room_transfer.sql`, new; checked unused and reserved at READY)

- **Pattern:** idempotent, as 0060–0064; history row `0065_secure_assessment_participant_room_transfer`.
- **Ownership:** Secure Assessment.
- **Reason form:** `char_length(reason) BETWEEN 1 AND 200 AND btrim(reason) = reason`.

**0032 `secure_assessment_exam_participant_room_assignments`:**
- `ADD COLUMN assignment_version integer NOT NULL DEFAULT 1`, with `ck_sa_exam_participant_room_assignment_version CHECK (assignment_version >= 1)`.
- Function `public.version_sa_exam_participant_room_assignment()` and trigger `trg_version_sa_exam_participant_room_assignment`, BEFORE INSERT OR UPDATE, as E3 says.
- No other column, constraint or row changes.

**0063 `secure_assessment_institution_room_actions`:**
- `ck_sa_institution_room_action_kind` is replaced by the same name with `kind IN ('ROOM_PARTICIPANTS', 'ROOM_PROCTORS', 'PARTICIPANT_ADDITION', 'PARTICIPANT_TRANSFER')`.
- `ADD COLUMN reason text NULL` and `ADD COLUMN confirmed boolean NULL`.
- New `ck_sa_institution_room_action_transfer`, which accepts either:
  - `kind = 'PARTICIPANT_TRANSFER'` with the reason form, `confirmed IS TRUE` and `demoted_exam_instance_ids = '{}'`; or
  - `kind <> 'PARTICIPANT_TRANSFER' AND reason IS NULL AND confirmed IS NULL`.

**0063 `secure_assessment_institution_room_action_entries`:**
- `ck_sa_institution_room_entry_kind` is replaced by the same name, with `PARTICIPANT_TRANSFER` added.
- `ADD COLUMN assignment_version integer NULL` and `ADD COLUMN exam_attempt_id uuid NULL`.
- New FK `fk_sa_institution_room_entry_attempt`: `(exam_attempt_id, tenant_id, exam_participant_id)` → `secure_assessment_exam_attempts (id, tenant_id, exam_participant_id)` (0054 `uq_sa_attempt_permission_scope`), RESTRICT.
- `ck_sa_institution_room_entry_shape` is replaced by the same name:
  - its two existing branches each also require `assignment_version IS NULL AND exam_attempt_id IS NULL`;
  - a third branch reads `entry_kind = 'PARTICIPANT_TRANSFER' AND exam_participant_id IS NOT NULL AND proctor_assignment_id IS NULL AND from_room_label IS NOT NULL AND lower(from_room_label) <> lower(room_label) AND assignment_version >= 2`.

**Transfer guard:** function `public.guard_sa_institution_room_transfer()` and trigger `trg_guard_sa_institution_room_transfer`, BEFORE INSERT on entries, with a named SQLSTATE as the 0063 and 0064 guards use. It reads the entry's action and raises `check_violation` with `CONSTRAINT = 'ck_sa_institution_room_transfer_scope'` when:
- exactly one of the entry and the action has the kind `PARTICIPANT_TRANSFER`; or
- under a `PARTICIPANT_TRANSFER` action:
  - the entry's exam has an `institution_session_id IS DISTINCT FROM` the action's `session_id`; or
  - the action already has an entry.

For any other pair it returns without a lock, so ASSESS-INSTITUTION-002 writes behave as today.

**Kept:**
- the 0063 append-only triggers and the room guard are untouched;
- ALTER TABLE fires no row trigger, and existing rows satisfy every replaced CHECK;
- no data is migrated, and no other migration changes.

### 4.2 Authority, transactions, lock order and errors (`participant-room-transfer.ts`, new)

Through `operatorWrite(req, pool, cookie, 'rooms', actionKey, …)`:

1. **Exact body,** checked before any connection: `{examInstanceId, participantId, targetRoomId, expectedAssignmentVersion, reason, confirmed, actionKey}`.
   - The three ids and `actionKey` are UUIDs.
   - The version is an integer of at least 1.
   - The reason normalizes into the form.
   - `confirmed` is `true`.

   Anything else is 400 `invalid_request`.
2. **Authentication and authority:** `BEGIN`, the action-key advisory lock `sa-institution:<tenant>:rooms:<key>` (shared with the three room routes), then the Operator assignment FOR SHARE; otherwise 403.
3. **Replay** (E9).
4. **Scope checks** E6 steps 1 to 3, by unlocked reads; otherwise 403.
5. **Locks** (OR-4), each lock query scoped by tenant and exam after the scope checks:
   1. `lockSession` (the session advisory lock);
   2. `keyShareInstitutionExam` (the exam FOR KEY SHARE), then E6 steps 4 and 5;
   3. the participant's 0032 row FOR UPDATE, then E6 steps 6 to 8;
   4. the open Attempt FOR UPDATE, then the new-statement re-read of E6 step 9;
   5. the target room row and its active mapped Proctor assignments FOR SHARE, then E6 step 10.
6. **Writes:**
   - the 0032 row: `UPDATE … SET exam_room_id = target, assigned_at = statement_timestamp()`; the trigger sets the version;
   - the action row, with revision `sessionRevision` plus 1, and its entry.
7. **Commit:** re-authentication with the assignment FOR SHARE, then `COMMIT`.

The Operator assignment is taken before every object lock. A revocation therefore either commits first, and the transfer gets 403, or waits for the transfer (I-15).

**Compatibility with every other writer:**

| Writer | Its order | Interaction with the transfer |
|---|---|---|
| Answer save, submit | exam KEY SHARE, then Attempt | No cycle: neither touches 0032 |
| Submit's second path, session activation and takeover | Attempt only | No cycle |
| Expiry finalizer | Attempt, SKIP LOCKED | Skips an Attempt the transfer holds |
| Start | participant row FOR UPDATE, then exam FOR SHARE | The exam share locks do not conflict. The entry's participant FK takes KEY SHARE on the participant row and waits behind start's FOR UPDATE (I-14) |
| Proctor lock | exam, then 0032 FOR SHARE, then Attempt | The same order as the transfer |
| Operator lock and added time | exam, then Attempt | No cycle (I-13) |
| Per-exam transition | exam FOR UPDATE | Serializes on the exam |
| Session transition, room writes | session lock first | Serialize on the session lock |

**Errors** (`transferFailure`, then the unchanged `institutionRoomFailure` and `institutionFailure`):

| Condition | Answer |
|---|---|
| 23505 on `uq_sa_institution_room_action_key` | 409 `action_key_reused` |
| 23505 on `uq_sa_institution_room_action_revision` | 409 `stale_assignment` (unreachable under the session lock) |
| 23514 on `ck_sa_institution_room_transfer_scope`, `ck_sa_institution_room_action_transfer` or `ck_sa_institution_room_entry_shape` | 403 `forbidden` (unreachable through the route; mapped so a defect never answers 500 or writes) |
| E6 steps 4–10 | 409 with the code of E6 |
| 40P01, 40001 | 409 `state_changed` (the existing mapping) |

**Object scope:** a foreign or nonexistent exam, participant or room gives 403, with byte-identical bodies (N02).

### 4.3 Operator route and projection

**`POST /api/v1/assessment/institution-exams/supervision/room-transfer`:** the body of §4.2.
- Answer 200 `{examInstanceId, participantId, fromRoomLabel, roomLabel, assignmentVersion, transferredAt, revision, replayed}`.
- A replay returns the same body with `replayed: true`.
- No reason, session, device or answer field is ever returned (F5).

**`GET …/supervision/exam`** (ASSESS-INSTITUTION-003) gains, for `scope: 'OPERATOR'` only:
- `participants[].roomId` and `participants[].assignmentVersion` (null without a current room);
- `rooms[].supervised` (E10).

**Route coverage:**
- `route-parity.test.ts` CALLS gains `postInstitutionRoomTransfer`;
- `metrics.ts` `COMPONENT_BY_PATH` gains the path as `monitoring`, like `supervision/participant-lock`;
- the Origin check, the 64 KiB body limit and 413 apply.

### 4.4 Teacher, Proctor and Student surfaces

- **Proctor:** no new control. The scope is re-read per request (A04-3):
  - the old room's Proctor stops seeing the participant, and gets 403 on lock, unlock and messages to them;
  - the new room's Proctor sees them with their unchanged status, answered count and time, never answer content (P5 A05);
  - the broadcast history follows the current room (E15).
- **Teacher:** nothing changes (D04.4-26D; ASSESS-INSTITUTION-003 E2).
- **Student:** nothing changes on the exam screen: same session, no prompt, no takeover, the timer unchanged (O05-5). The exam-list badge shows the new room on its next load (OR-3).

### 4.5 Client

**Row action** (`ExamMonitoringView`, Operator source only):
- "Pindahkan Ruang", with `aria-label` "Pindahkan ruang <ELLIGBLE ID>".
- It is shown when all of these hold, whatever `lockedAt` is:
  - the exam is ACTIVE or PAUSED and room-based;
  - the participant's status is NOT_STARTED or ACTIVE;
  - the participant has a `roomId`;
  - at least one other room is `supervised`.
- It is a 44 px target that wraps.

**Dialog** (`ParticipantRoomTransferDialog`, `permissionDialogClass`, one action key kept on retries, `useRetryFocus`):
- title "Pindahkan <ELLIGBLE ID> ke Ruang Lain?";
- "Ruang saat ini: <ruang>.";
- `NativeSelect` "Ruang tujuan": the other supervised rooms of the exam, ordered by label;
- the state text (F6):
  - ACTIVE: "Peserta tetap mengerjakan ujian yang sama di perangkat yang sama. Jawaban dan sesi ujiannya tidak berubah. Sisa waktunya tetap berjalan selama pindah.";
  - PAUSED: "Peserta tetap mengerjakan ujian yang sama di perangkat yang sama. Jawaban dan sesi ujiannya tidak berubah. Ujian sedang dijeda, jadi sisa waktunya tetap berhenti sampai ujian dilanjutkan.";
- then "Setelah dipindahkan, pengawas <ruang lama> tidak lagi melihat peserta ini." and "Siswa tidak menerima pemberitahuan otomatis. Sampaikan langsung atau kirim pesan." (OR-3);
- `ActionReasonField`;
- actions "Batal" and "Pindahkan Peserta".

**After a send:**
- The success notice (role status) reads "<ELLIGBLE ID> dipindahkan dari <ruang lama> ke <ruang baru>." The view then refreshes itself.
- Focus returns to the row's "Pindahkan Ruang". When the refresh removed it, focus goes to "Perbarui" or the back button.
- Focus is never on BODY after a send or after a self-removing control (ASSESS-INSTITUTION-003 §11.0.3).

**Refusal copy:**

| Code | Copy |
|---|---|
| `stale_assignment` | "Ruang peserta ini baru saja diubah. Pilih Perbarui untuk melihat ruang terbaru." |
| `already_in_room` | "Peserta sudah berada di ruang ini." |
| `target_room_unsupervised` | "Ruang tujuan belum punya pengawas, jadi peserta tidak dapat dipindahkan ke sana." |
| `participant_without_room` | "Peserta ini belum punya ruang, jadi tidak dapat dipindahkan." |
| `attempt_already_submitted` | "Peserta sudah mengumpulkan jawaban, jadi tidak dapat dipindahkan." |
| `time_up` | "Waktu peserta sudah habis, jadi tidak dapat dipindahkan." |
| `room_setup_required`, `invalid_state` | The ASSESS-INSTITUTION-003 copy (§4.6 there) |
| `invalid_request`, `action_key_reused`, `state_changed`, `forbidden`, network or 503 | The frozen ASSESS-INSTITUTION-001 copy (§4.6 there) |

**Layout,** at narrow widths and 200 % text:
- the dialog fields form a `grid-cols-1` grid with `min-w-0` items;
- buttons and badges wrap (`h-auto min-h-11 whitespace-normal`, `max-w-full whitespace-normal`);
- `AlertDescription` takes `min-w-0 break-words`.

Inside the dialog, `permissionDialogClass` already applies `overflow-wrap:anywhere`, as in every permission dialog. No new class adds it, and the participant table's metric labels outside the dialog keep wrapping only at spaces.

Bahasa Indonesia, no em dash, times in the school zone, shared primitives and tokens only.

### 4.6 Invariants

- **Integrity** (§5A, D04.4-28, V03/V05/V06/V07):
  - a transfer changes exactly one 0032 row (`exam_room_id`, `assigned_at`, `assignment_version`) and appends one action and one entry;
  - every Attempt-side row is unchanged: participant, Attempt, snapshots, answers (payload, `write_version`, `updated_at`), timer state and additions, pauses, locks, sessions, submissions and broadcasts.
- **Rooms:** exactly one current room per participant (the 0032 unique key). The history is append-only, and each move bumps the version by exactly 1.
- **Authority:** only an active School Operator of the tenant, re-checked before commit. The old room's Proctor has no access after commit.
- **Audit:** every applied transfer writes exactly one action and one entry. Every refusal and every replay writes nothing.
- **Locks:** the order of every existing writer is unchanged (§4.2).
- **Data:** no session secret, fingerprint, name, NIS, NISN, answer or score appears in any response, log or row. No response returns a reason (F5).
- **Teacher-managed exams** behave as today.

### 4.7 Existing assertions that change (only these)

- `runtime/secure-assessment/test/route-parity.test.ts` CALLS: gains `postInstitutionRoomTransfer`.

**Unchanged and passing as they are:**
- **Every runtime suite,** including `institution-rooms`, `school-exam-monitoring`, `exam-monitoring`, `participant-lock`, `permission-enforcement`, `answer`, `submission`, `session` and `metrics`. No existing assertion deep-compares the full Operator exam projection; they map selected fields (`school-exam-monitoring.test.ts:360–361`, :453).
- **Every web suite:** existing mocks carry no `supervised`, so no new row action renders.
- **Every E2E spec.** The only earlier captures that change are 99j's participant-operator captures, which gain the "Pindahkan Ruang" row actions (C07).
- **`database/verification/verify_bu072_…js`,** a historical BU-072 asset, is not edited (DEC-042). It already fails on current `main`, because at :593 it asserts that 0033 does not exist, and no CI job runs it.

### 4.8 Negative coverage (P5 trace)

The P5 enforcement table names for A07 the negatives N01, N02, N03, N04, N06, N07 and N08 (:127). N10 is added for the edge.

| Route | P5 row | N-ids asserted (C03) |
|---|---|---|
| POST `institution-exams/supervision/room-transfer` | A07 | N01, N02, N03, N04, N06, N07, N08, N10 |
| GET `institution-exams/supervision/exam` (new fields) | A06, A07 | N04 (only `OPERATOR` carries them); minimization I-20 |
| The supervisor routes after a transfer | A05 | N07 (the old Proctor gets 403; the new Proctor is allowed) |

What each N-id means here:
- **N01:** anonymous gives 401; no membership or another tenant gives 403; an unavailable database gives 503 with nothing written.
- **N02:** an exam, participant or room of another exam or tenant gives 403, byte-identical with a nonexistent id.
- **N03** (F7):
  - O2 (another tenant's Operator), a revoked Operator, and actor A get 403 with zero mutation. Actor A is a person signed in with a membership of the school but no school-role assignment, standing in for P5's "Platform Admin attempting school action" (:53).
  - The platform operator exists only as the provisioning CLI's `authorize` callback. It has no product session and no product route, so N03 is covered for it by that absence, as in ASSESS-INSTITUTION-003 §4.9. Platform CLI authority is never inherited.
- **N04:** a Teacher (the subject Teacher included), a Proctor (also for its own room's participant), a Homeroom Teacher and a Student get 403.
- **N06:**
  - a stale `expectedAssignmentVersion`;
  - ENDED, READY, submitted and expired states;
  - a PAUSED exam keeps its time frozen;
  - the Student's superseded device session is still refused after the move, and the current one still saves.
- **N07:**
  - an Operator revocation held before the transfer and committed while it waits gives 403 with nothing written (I-15);
  - the old Proctor's lock or message racing the transfer is ordered by the 0032 lock (E5);
  - after commit the old Proctor gets 403 and the new one succeeds.
- **N08:**
  - an extra key (`actorPersonId`, `tenantId`), a missing reason, or `confirmed` other than `true` gives 400;
  - an altered replay, or the key reused on a room route or by another actor, gives `action_key_reused`;
  - every refusal leaves equal before/after counts in 0032, both 0063 tables and every Attempt-side table.
- **N10:** a disallowed Origin gives 403 `origin_not_allowed` and a body over 64 KiB gives 413, both before any database effect.

## 5. Expected vectors

**Fixture:**
- **Tenant 1** (Asia/Jakarta): session S1, its window moved to now by fixture SQL.
  - E1 (Matematika × X), opened through the Operator route:
    - "Ruang 1" (Proctor P1) holds s1, s2 and s3;
    - "Ruang 2" (Proctor P2) holds s4 and s5.
  - E2 (Fisika × Y) has its own "Ruang 1" row (P1) and "Ruang 3" (P3); "Ruang 3" holds only E2 participants.
  - s1 has started and saved answers with an active session; s2 has not started; s3 has submitted; s4's time is up (fixture timer); s5 is working.
  - E3 is a READY institution exam of S1.
  - TM is a teacher-managed ACTIVE exam.
  - Also: Operators O and O', subject Teacher T, Homeroom Teacher H, and actor A.
- **Tenant 2:** Operator O2 and an ACTIVE institution exam.

**Concurrency cases approved by OR-5:** I-6 to I-15. Each race asserts the server before/after comparison of §4.6 and the absence of 40P01, with a 5 s bound.

**Card coverage** (TASK_PLAN:440):

| Card item | Vector |
|---|---|
| Save | I-8 |
| Submit | I-9 |
| Expiry | I-9 |
| Lock | I-10, I-13 |
| Takeover | I-11 |
| Opposed transfers | I-6 |
| Lost ACK and replay | I-7 |
| Lock ordering | I-10, I-12, I-13, I-14 |
| Server before/after comparison | I-1 and every race |

| # | Case | Expected |
|---|---|---|
| I-1 | Applied move (§5A, D04.4-28) | O moves s1 from "Ruang 1" to "Ruang 2" with a reason and version 1: 200, version 2.<br>• One `PARTICIPANT_TRANSFER` action (reason, `confirmed`, revision plus 1) and one entry (labels, Attempt, version 2).<br>• The server before/after comparison of §4.6 is identical, except remaining time, which is lower by the elapsed time only |
| I-2 | Session continuity (O05-5, V03) | After I-1, s1 saves with the same session id: 200, with no takeover and no new session row. Resume returns the same Attempt. A save queued offline before the move is accepted after it. s1's exam list shows "Ruang: Ruang 2" |
| I-3 | Scope at commit (A04-3, E15) | Before the move, P1 lists s1 and P2 does not. After it:<br>• P1 does not list s1, and gets 403 on lock and on a PARTICIPANTS message to s1;<br>• P2 lists s1 and may lock them;<br>• the drill-down counts move from "Ruang 1" to "Ruang 2";<br>• P2's broadcast history now shows a message s1 received in "Ruang 1" with its sender, and P1's history no longer shows a PARTICIPANTS message P1 sent to s1 alone (OR-3 supplement) |
| I-4 | Eligibility (O05-4, OR-1) | Allowed:<br>• s2 (not started): 200, with a NULL Attempt in the entry;<br>• E1 PAUSED: s5 moves, with remaining time identical before and after;<br>• a locked participant moves and stays locked;<br>• a started Attempt whose timer row has no remaining value (NULL) is eligible.<br>Refused, each writing nothing:<br>• s3: `attempt_already_submitted`; s4: `time_up`;<br>• E1 ENDED: `invalid_state`; E3 (READY): `invalid_state`;<br>• an open exam with FALSE/FALSE flags (fixture): `room_setup_required`;<br>• a participant whose 0032 row was removed by fixture SQL: `participant_without_room` |
| I-5 | Target (OR-2) | The current room gives `already_in_room`.<br>Each of these gives 403, byte-identical with a nonexistent id: E2's "Ruang 1" row id (same label, other exam), E2's "Ruang 3" row id, and a room of tenant 2.<br>A target whose mapped assignment was revoked by fixture SQL gives `target_room_unsupervised` |
| I-6 | Stale and opposed transfers (A04-2) | A stale version gives 409 `stale_assignment` with the current version and room. O and O' move s5 at once, with the same version, to different rooms: one 200, the other `stale_assignment`. After a transfer, a room-screen write carrying the old revision gives `stale_assignment` (ASSESS-INSTITUTION-002 E5) |
| I-7 | Replay and lost ACK | The same key and body: 200 `replayed: true` with the original body and no new row. The same key with another body, on `rooms/participants`, or sent by O': `action_key_reused` |
| I-8 | Save race | A connection holds s1's Attempt as a save does: the transfer waits, then commits, and the answer is accepted and unchanged. In the opposite order, the save completes after the transfer commits |
| I-9 | Submit and expiry, both orders (F1) | • **Submit first:** a submit holding s5's Attempt commits while the transfer waits; the re-read gives `attempt_already_submitted`, and nothing is written.<br>• **Transfer first:** the submit then succeeds.<br>• **Finalizer first:** the finalizer holds an expired Attempt and commits its submission; the waiting transfer's re-read gives `attempt_already_submitted`.<br>• **Transfer first, finalizer second:** the Attempt expires after the transfer's re-read; the finalizer skips the held Attempt (SKIP LOCKED) and submits it on its next run, with the new room. An Attempt already expired at the re-read is refused with `time_up` |
| I-10 | Proctor lock race (OR-4) | P2 locks s5 ("Ruang 2") through the SEC-001 route while s5 moves to "Ruang 1", in both orders.<br>• **Proctor first:** the lock is applied, then the move commits with the lock kept.<br>• **Transfer first:** P2 gets 403 with nothing written |
| I-11 | Takeover race | A session activation with takeover for s1 runs concurrently with its transfer: both commit in either order. The active session is the takeover's; the transfer changed no session row |
| I-12 | Session and exam controls | A session-wide pause shortcut and a transfer serialize on the session lock. A per-exam pause and a transfer serialize on the exam row. Every outcome is consistent |
| I-13 | Operator's own lock and added time | O' locks s5, and in a second run adds 10 minutes to s5, through the ASSESS-INSTITUTION-003 routes while O moves s5, in both orders. Both commit. The lock and the 0050 row are intact, and the move changed neither |
| I-14 | Start race | s2 starts (participant row FOR UPDATE) while O moves s2.<br>• The transfer reads no Attempt. Its entry insert takes the participant FK's KEY SHARE and waits behind start's FOR UPDATE. Start commits, then the transfer commits with a NULL Attempt in its entry.<br>• In the opposite order, start succeeds after the move.<br>• Either way s2 has one Attempt and the new room |
| I-15 | Revocation at commit (F2, N07) | A revocation of O's assignment is held uncommitted, the transfer waits on the assignment lock, then the revocation commits. The answer is 403 with nothing written (the `school-exam-monitoring.test.ts:894–906` pattern) |
| I-16 | Reversal (D04.4-65) | s1 moved back to "Ruang 1" with version 2 gets version 3 and a second entry; both entries remain |
| I-17 | Roles (N01, N03, N04) | Anonymous gives 401. O2, a revoked O, T, P1, P2, H, s1 and actor A get 403 with zero mutation. The CLI-only platform operator has no product session to test (§4.8). TM through the route gives 403. An Operator who is also a Proctor moves as Operator on this route (P03) |
| I-18 | Substitution (N02) | A participant or room of another exam or tenant gives 403, byte-identical with a nonexistent id |
| I-19 | Exact body and evidence (N08) | Extra keys, a missing or 201-character reason, or `confirmed: false` give 400. Every refusal of I-4 to I-18 leaves equal before/after counts in 0032, both 0063 tables and every Attempt-side table |
| I-20 | Minimization (F5) | No transfer response or Operator projection carries `fullName`, `name`, `nis`, `nisn`, `birthDate`, `sessionId`, `activeSessionFingerprint`, `answer`, `score` or `reason` keys, or any reason text. `roomId`, `assignmentVersion` and `supervised` appear only for `OPERATOR`. The Proctor and Teacher projections are unchanged |
| I-21 | Migration 0065 | An upgrade on a populated database leaves every existing 0032 row at version 1. A room-screen move of a READY exam bumps it; an insert gives 1; an explicit version in an UPDATE is ignored. A repeat is a no-op, and a synthetic rollback leaves nothing.<br>Raw inserts refused with their named constraint:<br>• a transfer action without a reason, or a room action with one: `ck_sa_institution_room_action_transfer`;<br>• a transfer entry under a room action, a room entry under a transfer action, an entry for another session's exam, or a second entry: `ck_sa_institution_room_transfer_scope`;<br>• equal labels, or version 1, on a transfer entry: `ck_sa_institution_room_entry_shape`;<br>• another participant's Attempt: the FK.<br>UPDATE and DELETE stay refused on both 0063 tables |
| I-22 | Edge (N10) | A disallowed Origin gives 403, and a 65 KiB body gives 413, with zero mutation |
| I-23 | Regression | ASSESS-INSTITUTION-002 room writes, ASSESS-INSTITUTION-003 controls and teacher-managed supervision behave as before. Every existing suite passes with only the §4.7 change |

## 6. Exact proposed file scopes (to be frozen at READY)

| # | Path | Purpose |
|---|---|---|
| 1 | docs/production/tasks/ASSESS-ROOM-001.md | Contract, history, evidence (Task-flow) |
| 2 | docs/production/TASK_PLAN.md | Status, counters, ASSESS-INSTITUTION-003 landing (Task-flow) |
| 3 | docs/production/PRODUCTION_COMPLETION_PLAN.md | Status (Task-flow) |
| 4 | docs/DOCUMENT_MANIFEST.md | Index (Task-flow) |
| 5 | docs/production/CBT_ARCHITECTURE_DELTA_REVIEW.md | Appended checkpoint: the 0032 version, the 0063 transfer kind and its guard, and the OR-4 lock order |
| 6 | database/migrations/0065_secure_assessment_participant_room_transfer.sql | §4.1 |
| 7 | runtime/secure-assessment/src/participant-room-transfer.ts | Parser, E6 checks, locks, writes, replay, `transferFailure`, route handler (new) |
| 8 | runtime/secure-assessment/src/institution-rooms.ts | Exports `sessionRevision`, `findAction` and `sameAction`; `RoomActionKind` gains `PARTICIPANT_TRANSFER`; room writes unchanged |
| 9 | runtime/secure-assessment/src/exam-monitoring.ts | `OPERATOR`-only `roomId` and `assignmentVersion`, and `supervised` from its own query (E10) |
| 10 | runtime/secure-assessment/src/school-exam-monitoring.ts | `readSupervisionExam` asks for the E10 fields |
| 11 | runtime/secure-assessment/src/server.ts | One route |
| 12 | runtime/secure-assessment/src/metrics.ts | One `COMPONENT_BY_PATH` entry |
| 13 | frontend/web/src/types/assessment.ts | Transfer input and result; optional projection fields |
| 14 | frontend/web/src/api/assessment-client.ts | `postInstitutionRoomTransfer` |
| 15 | frontend/web/src/components/ExamMonitoringView.tsx | Optional `source.transfer`, the row action and focus |
| 16 | frontend/web/src/components/SchoolExamMonitoringView.tsx | `OPERATOR_SOURCE.transfer` |
| 17 | frontend/web/src/components/ParticipantRoomTransferDialog.tsx | Dialog with the state-dependent copy (new) |
| 18 | runtime/secure-assessment/test/participant-room-transfer.test.ts | Units (new) |
| 19 | runtime/secure-assessment/test/integration/participant-room-transfer.test.ts | I-1 to I-23 and §4.8 on real PostgreSQL (new) |
| 20 | runtime/secure-assessment/test/route-parity.test.ts | §4.7 only |
| 21 | frontend/web/src/__tests__/participantRoomTransfer.test.tsx | Row action, dialog, copy per state, focus, other sources unchanged (new) |
| 22 | e2e/tests/99k-room-transfer.spec.ts | Five-browser journey and captures (new) |

Rows 1–4 are Task-flow paths. The allowlist is rows 5–22, 18 paths. No row depends on an open point.

**Forbidden:**
- every other file, including:
  - runtime: `supervision-scope.ts`, `permission-action-audit.ts`, `answer.ts`, `submission.ts`, `session.ts`, `attempt-start.ts`, `expiry-finalization.ts`, `exam-broadcast.ts`, `participant-lock.ts`, `participant-time.ts`, `institution-exams.ts`;
  - frontend: `InstitutionRoomManagementView.tsx`, `AssignedExamDiscovery.tsx`, `StudentExamWorkstation.tsx`, `App.tsx`, `lib/status.ts`, the `ui/` primitives;
  - tests: `helpers.ts`, `global-setup.ts`, and every existing spec and test other than row 20;
- completed Task records;
- other migrations;
- lockfiles, dependencies and workflows;
- production resources.

## 7. Acceptance gates (DEFINED / NOT EXECUTED)

| Gate | Expected outcome |
|---|---|
| C01 | Units:<br>• the exact body, the reason and `confirmed` rules;<br>• the E6 order, including the re-read after the Attempt lock and the NULL remaining case;<br>• the E9 digest and replay body;<br>• `transferFailure` over every named constraint;<br>• the E10 viewer filter;<br>• the N10 edge before any database work |
| C02 | For every non-Operator caller, `ExamMonitoringView`, `SchoolExamMonitoringView` and `readMonitoringProjection` render and return exactly as before; their existing suites pass unchanged |
| C03 | Real PostgreSQL, through the production-wired server:<br>• I-1 to I-23 and every N-id of §4.8;<br>• the server before/after comparison for I-1 and each race vector I-6 to I-15;<br>• before/after counts for every refusal.<br>Covers V03, V05, V06, V07, V11, and the race part of V15 |
| C04 | Regression with only the §4.7 change. The unchanged attempt-writer, supervision and room suites pass, showing their behaviour is unchanged. The lock order itself is proven by the C03 races |
| C05 | Client:<br>• when the row action shows and when it does not, a locked participant included;<br>• the dialog with target choice, the ACTIVE and PAUSED copy, reason, retry focus and focus after success (never BODY);<br>• every refusal copy, with "Perbarui" after `stale_assignment`;<br>• other sources render no new action |
| C06 | Five-browser E2E (`99k`). pengawas.e2e is Operator (given and later revoked) and Proctor of "Ruang A"; guru.e2e is Proctor of "Ruang B".<br>Journey:<br>• the Operator opens the exam through "Pelaksanaan Sesi";<br>• siswa.e2e.06 in "Ruang A" starts and saves an answer, then saves one more while offline;<br>• the Operator moves them to "Ruang B" with a reason;<br>• the Student reconnects without any prompt, the pending answer is accepted, and the timer is not reset;<br>• pengawas.e2e as Proctor no longer lists the Student after the in-app refresh;<br>• guru.e2e, landing on "Ruang Ujian", lists them;<br>• a stale second Operator tab gets `stale_assignment`;<br>• the Operator moves the Student back (D04.4-65);<br>• after submission the row offers no move.<br>Shared helpers and the in-app refresh only, never a browser reload |
| C07 | Rendered evidence (`workspace-room-transfer-*`):<br>• **Baseline:** the five `workspace-visual-*` artifacts of the post-merge `main` CI of ASSESS-INSTITUTION-003, fetched with the resumable, size- and `unzip -t`-checked transfer; manifest recorded at READY.<br>• **After:** the participant level with the action, the dialog (ACTIVE), a refusal, the success notice, and the new room's Proctor list.<br>• **Conditions:** widths 360, 390, 430, 768, 1024, 1280, 1440 and 640×360, and 200 % text at 390×844 and 1280×800 with the 99j single-pass calibration.<br>• **Pass criteria:** no page overflow; targets ≥ 44 px; focus never on BODY; badges and buttons wrap; rendered review PASS.<br>• **Earlier captures:** pixel-identical except 99j's participant-operator captures, which gain the "Pindahkan Ruang" row actions, plus times and IDs. No other earlier capture changes.<br>• **Budget:** at most six scenarios (R7) |
| C08 | Scope inside rows 1–22; 33 Tasks and 78 edges; exact-SHA attempt-1 eight-job CI; no re-run |
| C09 | Independent contract, implementation and rendered review PASS. The reviewer's contract approval, which is also the A04 reviewer half (F8), is anchored to the registration commit SHA (§9.2); Delegated Acceptance; evidence commit; delegated merge |

**CI-first order,** as ASSESS-INSTITUTION-003 §7:
1. Registration, carrying the ASSESS-INSTITUTION-003 landing and the baseline manifest.
2. Implementation, whose exact-SHA CI passes before review.
3. Implementation and rendered review.
4. Delegated Acceptance and the evidence commit.
5. PR-head CI, the delegated squash merge, then post-merge main CI.

No re-runs, and no push while the previous commit's CI runs.

**Honest limits and risks:**
- **R1, A04 and O09 coverage:** OR-4 corrects the literal A04-2 lock order, and OR-5 approves I-6 to I-15. Both are the Owner's decisions; the reviewer half is the contract PASS (F8). A reviewer is never a §8 authority on its own. PB05 stays OPEN.
- **R2, physical move time:** the timer keeps running while the Student walks (O05-5). The Operator may add time separately under OC-1.
- **R3, ENDED exams:** an attempt still running after END cannot be moved (O05-4).
- **R4, emptied rooms:** a source room left empty after opening stays listed with its Proctors (E7).
- **R5, targets limited to the exam's rooms** (OR-2): a stricter room must already hold one of the exam's participants when the exam opens.
- **R6, no Student notice** (OR-3): the Student learns of the move from staff or a message.
- **R7, E2E budget:** 99h, 99i and 99j already run long. 99k is bounded to six scenarios, recorded at READY.
- **R8, reasons kept without a retention rule** (O03/O08), as SEC-001 and ASSESS-INSTITUTION-003 keep theirs.
- **R9, V15 load evidence** under P6 budgets is PERF-001's. This Task proves the races functionally only.
- **R10, 99j captures change** by the new row action, and 99j's own overflow and 44 px checks then run over it.
- **R11, the 99j calibration step is copied** into 99k (E14). The shared extraction stays the R17 follow-up.
- **R12, broadcast history follows the room** (E15, accepted by the Owner): a new room's Proctor sees the earlier messages to a moved Student, and the old room's Proctor loses sight of its own messages to them.
- **R13, start race:** when start and transfer race, the entry may record a NULL Attempt although an Attempt was created in the same instant (I-14). The Attempt itself is unaffected.

## 8. History

- **2026-11-10, contract drafted** under DEC-048 on ced45b3 (task/assess-institution-003, code equal to `main` after ASSESS-INSTITUTION-003 lands), while ASSESS-INSTITUTION-003 was VERIFYING.
  - Approved inputs: §5A, OD-07, O05-4, O05-5, A04-2 and A04-3; OB-2, RP-1 to RP-5 and OB-3; OC-1 to OC-6; ASSESS-INSTITUTION-002 E18 and R12.
  - Open: OR-1 to OR-5, raised with recommended defaults. OR-4 records the A04-2 lock-order finding.
  - Migration 0065 proposed, not reserved.
  - Not reviewed; NOT READY; BLOCKED.
- **2026-11-10, contract review 1 returned STOP** (F1–F9 and non-material notes, §9).
- **2026-11-10, Owner decisions in chat,** quoted in §3.1:
  - OR-4: "Baris ruang sebelum Attempt (Recommended)".
  - OR-1: "Lewat Ruang dan Pengawas (Recommended)".
  - OR-2 and OR-3: "Setujui keduanya (Recommended)".
  - OR-3 supplement (F4): "Terima dan catat (Recommended)".
  - OR-5: "Setujui setelah review kontrak PASS (Recommended)", covering the case list as corrected by F3 (I-6 to I-15).
- **2026-11-10, review 1 corrections applied** in this revision (§9).
  - Status: Owner decisions decided; review 1 STOP corrected; re-review pending; NOT READY; BLOCKED.
- **2026-11-10, contract review 2 returned STOP** on F1: the corrected case list was not yet approved by the Owner (§9.2).
- **2026-11-10, Owner confirmation in chat,** quoted in §3.1 OR-5:
  - Question: "ASSESS-ROOM-001, konfirmasi OR-5 (reviewer F1): daftar kasus konkurensi yang sudah dikoreksi dan disetujui reviewer adalah I-6 sampai I-15: pindah bersamaan, pindah vs simpan jawaban, pindah vs kumpul dan finalisasi waktu habis (kedua urutan), pindah vs kunci pengawas, pindah vs kunci dan tambah waktu Operator, mulai ujian vs pindah peserta yang belum mulai, pencabutan penugasan Operator, ulangan permintaan, dan sesi berakhir. Setujui daftar I-6 sampai I-15 ini?"
  - Answer: "Setujui I-6 sampai I-15 (Recommended)".
  - This closes review 2 F1. The reviewer approved the OR-4 lock order and I-6 to I-15 as written; both approvals are recorded against the registration commit SHA once committed.
  - Status: contract review chain STOP → STOP → closed; formal READY pending (§10); NOT READY; BLOCKED.

## 9. Independent contract review

### 9.1 Review 1: STOP

Review 1 was given by the standing Owner-designated read-only subagent reviewer, on the uncommitted first draft of this record (scratchpad copy; no SHA, since nothing is committed). The verdict was **STOP**, with nine material findings and non-material notes. Each finding and its correction:

| Finding | Evidence | Correction in this revision |
|---|---|---|
| F1, a submit in flight was missed | Submission only inserts a submission row (`submission.ts:18–24`). A check from the snapshot taken before the Attempt lock wait misses a submit that commits during the wait; `participant-lock.ts:91–98` and `permission-action-audit.ts:168–171` show the risk | E6 step 9: after the Attempt lock, a new statement re-reads the submission and the remaining time (the `participant-time.ts` pattern). I-9 covers submit first, transfer first, finalizer first, and transfer then finalizer |
| F2, I-16 (revocation) could not occur as written | `operatorWrite` takes the assignment FOR SHARE first (`institution-exams.ts:298`, :328), so no revocation can arrive while the transfer waits on the Attempt | I-15 uses the existing pattern: the revocation is held uncommitted first, the transfer waits on the assignment lock, and the result is 403 (`school-exam-monitoring.test.ts:894–906`); also §4.2 and §4.8 N07 |
| F3, the concurrency list was inexact | OR-5 named I-8 to I-12 while opposed transfers were in I-6; submit/finalizer orders, the Operator's own controls, start and revocation were missing against TASK_PLAN:440 | The final list is I-6 to I-15 (§3.1 OR-5, §5), with the card coverage table. Added I-13 (Operator's lock and added time) and I-14 (start: NULL Attempt in the entry, FK KEY SHARE behind start's FOR UPDATE, `attempt-start.ts:52–57`). I-9 and I-15 were corrected |
| F4, broadcast history follows the room | `readBroadcastHistory` filters by the recipient's current room (`exam-broadcast.ts:261–279`) | Owner OR-3 supplement "Terima dan catat" (§3.1); E15, §4.4, I-3, R12; no history code change |
| F5, the reason was returned inconsistently | §3 and §4.6 said the reason returns to its author; §4.3 and I-18 said none is returned | No response returns a reason: §3 "Settled", §4.3, §4.6, I-20 |
| F6, the dialog copy was wrong while PAUSED | "waktunya tetap berjalan" is false while PAUSED | §4.5: ACTIVE and PAUSED texts, in Bahasa Indonesia with no em dash; C05 |
| F7, N03 Platform Admin was not covered | CBT_PERMISSION_MATRIX.md:53 | §4.8 N03 and I-17: actor A (signed-in member, no school role) gets 403 with zero mutation; the CLI-only platform operator has no product route, as in ASSESS-INSTITUTION-003 §4.9 |
| F8, the A04 reviewer half was not named | TASK_PLAN:644 names the Owner and the reviewer; ASSESS-QUESTION-001:57 names the standing reviewer as the A04 reviewer | §1 eligibility, C09 and R1: the standing reviewer's PASS on the OR-4 lock order and the final OR-5 list, recorded here with the reviewed SHA, is the reviewer half; OR-4 and OR-5 are the Owner half |
| F9, a participant without a room had no outcome, and the lock queries were unscoped | The 0032 row may be absent (fixtures). The lock queries need tenant and exam scope after the participant check | E6 step 6 adds `participant_without_room` (409) with copy; the scope checks (exam, participant, target) run before any object lock; the lock queries are scoped by tenant and exam; the OR-4 order is kept (§4.2) |

**Non-material notes, all applied:**
- D04.4-28 is cited in the authority list, E11 and §4.6.
- The incident reference is recorded as not applicable until ASSESS-PROCTOR-003 (§2 Excluded, E8).
- `rooms[].supervised` is computed in `exam-monitoring.ts` (E10, §6 row 9).
- The row action tests NOT_STARTED or ACTIVE whatever `lockedAt` is (§4.5, C05).
- The layout rule is reworded: `permissionDialogClass` already applies `overflow-wrap:anywhere` (§4.5).
- §4.4 states that a Proctor never sees answer content.
- I-5 also substitutes E2's "Ruang 1".
- A NULL remaining time is eligible (E6 step 9, I-4).
- The guard's function and trigger are named (§4.1).
- 99j participant-operator is the only changed earlier capture (§4.7, C07).
- C03 and C04 are reworded.
- The NOWAIT variant is recorded under OR-4 (§3.1).

### 9.2 Review 2: STOP, closed

- **Verdict:** STOP on one finding, by the same reviewer, on the uncommitted revision of this record.
- **F1:** the Owner had not approved the corrected case list. OR-5 was asked on the first-draft numbering "I-8 sampai I-12".
- **Closure:** closed by the Owner's confirmation in chat on 2026-11-10, quoted in §3.1 OR-5 ("Setujui I-6 sampai I-15 (Recommended)").
- **Reviewer half of A04** (F8, TASK_PLAN:644; ASSESS-QUESTION-001:57):
  - **The OR-4 lock order:** the reviewer approved it as written in §4.2:
    1. the session lock;
    2. the exam FOR KEY SHARE;
    3. the 0032 row FOR UPDATE;
    4. the Attempt FOR UPDATE;
    5. the target room and its Proctors FOR SHARE.
  - **The concurrency cases:** the reviewer approved I-6 to I-15 as written in §5.
  - **Binding:** both approvals are bound to the reviewed content. They are recorded against the registration commit SHA once it is committed.
- **Non-material notes, applied:**
  - E6 step 3: a target row pruned while READY and then activated is caught at step 10 (`target_room_unsupervised`).
  - I-9 fourth bullet: expiry after the re-read, and `time_up` when already expired.
  - I-3: a PARTICIPANTS message to s1 alone.
  - C09: the SHA anchor.
- **Status:** the contract review chain is STOP → STOP → closed. Formal READY pending (§10).

## 10. Formal READY and Build start under DEC-048 — 2026-11-10

- **Eligibility (00.13 §4.1):**
  - ASSESS-INSTITUTION-002 and ASSESS-INSTITUTION-003 are DONE; ASSESS-INSTITUTION-003 landed by PR #38, main 89a23fa04f7f5f340adfc498ec6bf197c3d79b4e, PR-head CI #251, post-merge main CI #252 (run 42868923995) attempt 1 eight SUCCESS.
  - O05 and A04 inputs are approved in [ASSESS-QUESTION-001 §4](ASSESS-QUESTION-001.md); the remaining composition points are the Owner's OR-1 to OR-3 (§3.1). A04: the Owner's half is OR-4 and OR-5 (cases I-6 to I-15, confirmed in chat); the standing reviewer's half is its PASS on the OR-4 lock order and the cases I-6 to I-15 (§9.2), reviewed as content SHA-256 4264591bbc370ffacef1a0101dcddc49d2e8496bdfdddf0111142bb5fc1a1215 and anchored to this registration commit. O09 rests on P5.
  - No earlier-row or P0 Task is eligible.
- **Review chain:** STOP → STOP → PASS (§9).
- **Frozen allowlist:** §6 rows 5–22, 18 paths; rows 1–4 are Task-flow paths. Migration 0065 reserved. No dependency, workflow or production resource.
- **Rendered baseline (step 1):** the five `workspace-visual-*` artifacts of exact-main CI #252 (run 42868923995, 89a23fa), fetched in parallel with the resumable, size- and `unzip -t`-checked transfer.
  - 3950 pairs (2050 `workspace-question-*` from `99`–`99g`, 950 `workspace-institution-*` from `99h`, 450 `workspace-institution-rooms-*` from `99i` and 500 `workspace-institution-supervision-*` from `99j`), all with frontend tree 5775c18fd7de4f64796937466a92a5c38251631b.
  - Every screenshot hash matches its JSON; zero overflow; zero targets under 44 px.
  - Manifest, built as in ASSESS-QUESTION-004 §10 over the `workspace-question-*` and `workspace-institution-*` captures: SHA-256 a594c3a1b442631f319066c784795d4a050156f9c1b41a60274c01e42dff2cad.
- **CI-first order:** as frozen in §7. This registration is step 1. No re-runs, and no push while the previous commit's CI runs.
- **Status:** BLOCKED → IN_PROGRESS. Counters: DONE 17, IN_PROGRESS 1, VERIFYING 0, BLOCKED 15.
