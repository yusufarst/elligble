# RESULT-003 — Teacher publication and Student own finalized score

## 1. Control state and authority

| Field | Disposition |
|---|---|
| Classification | Active P11 Task; P1 / result delivery; HIGH risk; R27, R26; P8 V09, V11, V12 |
| Status | **IN_PROGRESS under DEC-048: formal READY PASS (§10). Owner decisions RP-1 and RP-2 decided (§3.1); contract review chain STOP → PASS (§9)** |
| Objective | Let the Teacher who holds an exam's teaching assignment publish its finalized result, withdraw the publication and publish it again, each with reason, confirmation and an append-only record; and let each Student see only their own published result of each exam, never a peer's, a ranking or a key. Reuse the delivered finalization, frozen rows, authority and reason/confirmation pattern:<br>• publication is per exam (per subject ExamInstance for an institution exam) and only of a FINALIZED exam; END and finalization never publish (OD-09, D04.8-21);<br>• withdrawal hides the result again and the Student sees "Hasil belum tersedia"; republication shows the same frozen result (O05-6);<br>• a finalized result is never corrected (O02-10);<br>• replay, stale-state, role, tenant, subject, peer and not-finalized negatives are proven on real PostgreSQL and in a five-browser journey, with cache, DOM, storage and export privacy evidence.<br>No new scoring, grading, finalization or correction rule; no School Operator, Proctor or Homeroom result access; no notification, ranking, analytics, per-question review or Student export |
| Owner decisions | **Approved inputs:**<br>• OD-09, OD-07, OD-07b (00.11 §12);<br>• O02-10, O05-1 and O05-6, decided 2026-11-07 ([ASSESS-QUESTION-001 §4](ASSESS-QUESTION-001.md));<br>• RS-2 and E6 of [RESULT-004 §3](RESULT-004.md) (running institution exams; not reached here, since publication needs FINALIZED).<br>**Decided in chat, 2026-11-12:** RP-1 "Nilai akhir saja (Recommended)" and RP-2 "Setujui (Recommended)" (§3.1).<br>**Reviewer:** the Owner-designated standing read-only subagent reviewer of RESULT-004, which also holds the O05 reviewer half of this Task (RP-2) |
| Execution authority | DEC-048 (00.13). Eligible; formal READY §10 |
| Base and branch | Drafted on f15fa1f (branch task/result-004), whose tree equals `main` deee8a6. Registered on `main` deee8a66d8518544a82b011c5070745a475cc153 (the RESULT-004 squash merge, PR #40), branch task/result-003, worktree `C:\Projects\ELLIGBLE-result-003` |
| Parallel safe / cost | No parallel baseline Task; no dependency, vendor, service or cost |

**Eligibility under 00.13 §4.1** (00.13:64–68; checked at drafting, re-checked at READY):
- **Internal dependency** (TASK_PLAN:185, :480): RESULT-004 only.
  - In this checkout TASK_PLAN still shows RESULT-004 VERIFYING (:184, :220) because its landing is recorded by the next Task's first change (00.13 §4.5).
  - `main` holds the RESULT-004 squash merge deee8a6. Its post-merge `main` CI result must be read and recorded, with every job SUCCESS on attempt 1, before this Task becomes READY. Not verified at drafting.
- **One active Task** (00.13 §4.2): none other once RESULT-004 is recorded DONE.
- **External gate O05** (TASK_PLAN:648, "Owner + assessment/security reviewer"):
  - **Owner half:** O05-6 (ASSESS-QUESTION-001:82) approves withdrawal and republication; O05-1 (:77) fixes per-subject results; OD-09 (00.11:159) fixes per-exam publication by the teacher and own-score-only visibility.
  - **"Unprovided publication withdrawal/correction behavior"** (P2 CBT_DOMAIN_RULES_SPECIFICATION:139; card TASK_PLAN:481 "withdrawal/correction behavior must be approved before implementation"):
    - withdrawal: O05-6, quoted in §3;
    - correction: O02-10 (ASSESS-QUESTION-001:74), "Not available in CBT-R1. A finalized result is immutable", which RESULT-004 RS-3 confirmed (RESULT-004:150–152);
    - so only a finalized result is published and a published result is never corrected. Nothing further is open for these two words.
  - **"Review disclosure"** (P2:53, "Exact withdrawal/correction/review disclosure is O02/O05, not silently granted") is not settled by any O02 or O05 row. It decides what the Student sees: RP-1.
  - **Reviewer half:** the Owner granted the reviewer half of O02 and O05 to the RESULT-004 reviewer "for this Task" only (RESULT-004:23). This Task needs its own grant: RP-2. Until it is decided, O05 is not satisfied under 00.13 §4.1 (the approval of every responsible authority).
- **External gate O09** (TASK_PLAN:652): P5 is approved content under GOV-POLICY-001 (CBT_PERMISSION_MATRIX.md:4–7), as every earlier Task read it (RESULT-004:27). This Task uses:
  - A11 (:40, :110): "Managing/assigned subject Teacher grade/finalize/export/publish; Student read only own published score"; "P02 reason/confirmation/audit for high-risk finalize/publish"; "Student own published score, no peers/ranking/keys or bulk export"; "No implicit publication on END";
  - A10 (:39, :109): no School Operator scores;
  - the data rule (:45), P01, P02, P03, P04 (:84–90), N01–N10 (:51–60) and the A11 negative set (:131).
  - The A11 C column "O05 institution/publication withdrawal/correction" (:110) and the exclusion "O05 institution/transfer/publication composition" (:142) are covered by O05-1, O05-6 and O02-10, plus RP-1 for the disclosure.
  - PB05 stays OPEN; its closure is release evidence, not an entry input.
- **A01** is not a gate of this Task (TASK_PLAN:185). The publication table touches no content, answer or result version (§4.1).
- **OPEN policy inputs:** RP-1 and RP-2 only. None of O03, O04, O06, O07 or O08 is used.
- **Selection** (as RESULT-004:35–38): ASSESS-STUDENT-001 (P0) waits on O04; ASSESS-MEDIA-001 waits on O06, O07 and A02; ASSESS-QUESTION-009 and -010 wait on ASSESS-MEDIA-001 and O06; ASSESS-PROCTOR-003 waits on O08 and A05; OPS-STAGING-001, OPS-001, PERF-001, DEVICE-001, VERIFY-INTEGRITY-001, LEGAL-001, SEC-RELEASE-001 and RELEASE-001 are prepare-only (00.13 §7). Once RESULT-004 is recorded DONE and RP-1 and RP-2 are decided, RESULT-003 is the first eligible row.

**Authority:**
- **Governance:**
  - [DEC-044](../../00-governance/00.11_CBT_RELEASE_SCOPE_REALIGNMENT.md): the Results row (:40, "publication (§12, OD-09)"), the School Operator boundary (:51), OD-07 (:156), OD-07b (:157) and OD-09 (:159, "Scores stay hidden until the teacher publishes a finalized result, per exam; a student sees only their own score, no ranking");
  - [DEC-045 §4–§5](../../00-governance/00.12_AICWDF_ADOPTION_AND_TASK_EXECUTION.md);
  - [DEC-048](../../00-governance/00.13_STANDING_EXECUTION_DELEGATION.md) §4.1, §5.1 and §7.
- **Plan and rules:**
  - [TASK_PLAN RESULT-003/§8](../TASK_PLAN.md): the card :477–485, with acceptance at :481, tests at :482, impacts at :483 and proposed paths at :485; O05 :648 and O09 :652;
  - [P1 CBT_RELEASE_DEFINITION](../CBT_RELEASE_DEFINITION.md) R26 (:94), R27 (:95, "Only teacher publishes finalized results per exam; Student sees own score only; no ranking/peer scores or premature disclosure") and the Student journey (:54);
  - [P2 CBT_DOMAIN_RULES_SPECIFICATION](../CBT_DOMAIN_RULES_SPECIFICATION.md) §3.1 (:49, :53), R27 (:123), O05 (:139), the O02/O05 approval note (:176);
  - [P3 ROUTE_INTERACTION_MATRIX](../ROUTE_INTERACTION_MATRIX.md) W14 (:35) and F09 (:54: POST `/api/v1/assessment/result-publications`, GET `/api/v1/assessment/my-results`);
  - [P5 CBT_PERMISSION_MATRIX](../CBT_PERMISSION_MATRIX.md) as above;
  - [CBT_UX_SCREEN_AND_INTERACTION_INVENTORY](../CBT_UX_SCREEN_AND_INTERACTION_INVENTORY.md) U04 (:23, "No optimistic ... result publication claim"), U05 (:24), C12 (:45), C21 (:54), C22 (:55, "Hidden until Teacher publishes finalized exam; no peers/ranking, no cached unpublished score; unavailable/refused distinct from zero"), R27 (:91);
  - [CBT_VERIFICATION_AND_RELEASE_DOD_PLAN](../CBT_VERIFICATION_AND_RELEASE_DOD_PLAN.md) V09 (:35), V11 (:37), V12 (:38).
- **Locked discovery rules** ([04.01_SECURE_ASSESSMENT.md](../../01-discovery/04.01_SECURE_ASSESSMENT.md); D04.4 and D04.8 are "REVIEWED & LOCKED"):
  - D04.4-12 (:4381): ABSENT is not a zero score;
  - D04.8-16 (:10018): Student result visibility is separately controlled;
  - D04.8-20 (:10081): a finalized result is stable against source edits;
  - D04.8-21 (:10100): FINALIZED is not PUBLISHED, "participant is allowed to see configured result information";
  - D04.8-22 (:10118): publication can be delayed;
  - D04.8-23 (:10133): a published result must not leak correct answers early;
  - D04.8-49 (:10485): simple school-friendly display;
  - D04.8-50, D04.8-51 (:10503, :10511): no peer results, no ranking.
- **Earlier records:**
  - [ASSESS-QUESTION-001](ASSESS-QUESTION-001.md) §4 (O02-10, O05-1, O05-6) and :44 (publication is RESULT-003);
  - [ASSESS-INSTITUTION-003](ASSESS-INSTITUTION-003.md):91 (publication belongs to the subject Teacher; RESULT-003);
  - [RESULT-004](RESULT-004.md) §1, §3.1 (RS-2, RS-3, the reviewer-half pattern), E1, E6, E10, E12, E14 and §4.4 ("no result is visible before RESULT-003");
  - [GOV-REALIGN-001](GOV-REALIGN-001.md):431 (OD-09 implementation is RESULT-003).
- **Design:** FRONTEND_DESIGN_SYSTEM §58 (docs/design/FRONTEND_DESIGN_SYSTEM.md:411), §59, §60; plan §10.1 (one design system; shared primitives).
- **Schema:** migrations 0045 (finalization, append-only) and 0054 (permission-action audit) are reused. One new migration is proposed: `0066_secure_assessment_result_publications.sql` (§4.1); 0066 is unused on `main` (the highest is 0065, ASSESS-ROOM-001; RESULT-004 reserved none, RESULT-004:256).

No LOCKED decision or PB status changes.

## 2. Reuse and bounded gaps

`src/` = `runtime/secure-assessment/src/`; `web/` = `frontend/web/src/`.

**Reused unchanged:**
- **Frozen result:** `secure_assessment_exam_result_finalizations` (one per exam, `uq_sa_result_finalization_exam UNIQUE (tenant_id, exam_instance_id)`) and `secure_assessment_attempt_results`, append-only (0045:22–110; the unique key at 0045:36); `readFinalizedResults` (`src/result-finalization.ts:230–269`). The Student value is read from these rows only, never recomputed (D04.8-20).
- **Authority:** `lockManagedExam` (`src/managed-exam.ts:70–77`): the active teaching assignment of the exam, exam row FOR UPDATE and the authority rows FOR SHARE, for teacher-managed and institution exams alike (RESULT-004 E1). It is the lock of every lifecycle transition, so publication and finalization serialize on it.
- **Reason, digest and replay helpers:** `normalizePermissionReason` and `permissionDigest` (`src/permission-action-audit.ts:45`, :65), exported and imported unchanged. 0054 is not widened (the 0064 precedent, 0064:8).
- **Edge guards:** the Origin check (`src/server.ts:282–286`), the JSON body limit, and `Cache-Control: no-store` on every API response (`src/server.ts:252`, `src/http/http-utils.ts:102–103`).
- **Re-authentication inside the transaction:** `buildAuthenticatedContext(..., { mutation: true })`, as `executePermissionAction` does (`src/permission-action-audit.ts:103`, :240).
- **Client:** `ActionReasonField`, `validActionReason` and `permissionDialogClass` (`web/components/ActionReasonField.tsx`); `useActionKey` and `useRetryFocus` (`web/hooks/useDialogAction.ts`); the shared `Dialog`, `Button`, `Alert`, `StatusBadge`, `ExamListCard`/`ExamFact`; `useFocusRestore`, `useEntryTitleFocus` and `WRAPPING_BUTTON` (`web/components/TeacherResultsView.tsx:43–98`).

**Gaps closed:**
1. **No publication state or action exists.** Students see no score anywhere (RESULT-004:292; `src/assigned-exams.ts` carries none). No route, table or audit records a publication.
2. **No Student result read.** P3 F09 `GET /api/v1/assessment/my-results` is missing.
3. **Teacher copy becomes false after publication.** "Nilai tidak ditampilkan kepada siswa." (`web/components/TeacherReadinessView.tsx:316`) and "Hasil ini tidak ditampilkan kepada siswa." (`web/components/TeacherResultsView.tsx:216`) must follow the publication state.
4. **Evidence gaps** named by the card (:482): unpublished, not-finalized, foreign-exam and peer-score denials; replay and visibility transitions; cache, DOM and export privacy.

**Excluded:**
- any correction, regrade, item void or full-credit remedy after finalization (O02-10, RS-3);
- per-question review, correct answers, rubric or explanations for the Student (D04.8-23, A11 "no keys"; RP-1 does not offer it);
- totals across subjects, rankings, class statistics and official grades (O05-1, D04.8-50, D04.8-51, D04.8-54);
- notifications, scheduled or automatic publication (OD-09, A11);
- School Operator, Proctor or Homeroom publication or result access (A10, N04);
- Student export, print or download (A11 "no ... bulk export");
- susulan, retake and effective-result selection;
- load evidence (PERF-001).

## 3. Settled inputs, Owner decisions and engineering readings

**Approved before this Task (quoted):**
- **OD-09** (00.11:159): "Scores stay hidden until the teacher publishes a finalized result, per exam; a student sees only their own score, no ranking."
- **OD-07b** (:157): "Subject teachers prepare and preview the questions before a deadline, grade essays and finalize the results of their subject."
- **O02-10** (ASSESS-QUESTION-001.md:74): "Not available in CBT-R1. A finalized result is immutable, as today (one finalization per exam)."
- **O05-1** (:77): "Finalization happens per subject ExamInstance, by its subject Teacher. There is no total across subjects in CBT-R1 (an assessment result is not an official grade)."
- **O05-6** (:82): "The Teacher can withdraw a publication with reason, confirmation and audit. Scores are hidden again, and the Student sees "Hasil belum tersedia". Republishing shows the same frozen result."
- **P5 A11** (:110): "writes assigned grades/finalize/publish only at allowed revision/lifecycle"; "Student own published score, no peers/ranking/keys or bulk export"; "P02 reason/confirmation/audit for high-risk finalize/publish"; "No implicit publication on END, mutable finalized result or unaudited correction".
- **P5 N04** (:54): "Proctor ... grade/publish denied". **N05** (:55): "unpublished/self-foreign result denied; own published score only".
- **Card acceptance** (TASK_PLAN:481): "Explicit authorized Teacher publishes finalized results per exam; Student sees own score only, no ranking/peer results. END/finalize never auto-publishes; withdrawal/correction behavior must be approved before implementation. OD-09 is settled and not reopened."
- **Card tests** (:482): "unpublished/not-finalized/foreign exam/peer score denials, replay and visibility transitions; cache/DOM/export privacy".

**Settled by these inputs, so not asked:**
- **Who publishes:** the Teacher holding the exam's active teaching assignment: the managing Teacher of a teacher-managed exam, the subject Teacher of an institution subject exam (OD-09 "the teacher", A11 "Managing/assigned subject Teacher ... publish", ASSESS-INSTITUTION-003:91). The School Operator, Proctor and Homeroom Teacher cannot (A10, N04, OD-07).
- **What is published and when:** only a FINALIZED exam, all its participants at once, per exam (OD-09, A11 "publication finalized/per exam"). For an institution session each subject ExamInstance is published on its own; nothing is summed (O05-1).
- **Withdrawal and republication:** with reason, confirmation and an attributable append-only record; the Student then sees "Hasil belum tersedia"; republication shows the same frozen values (O05-6, P02).
- **Correction:** none (O02-10).
- **Never automatic:** END and finalization do not publish (OD-09, D04.8-21, A11).
- **No peers, ranking or keys** for the Student (OD-09, D04.8-50, D04.8-51, A11, N05).
- **Absent is not zero:** an ABSENT participant of a published exam sees no score (D04.4-12, C22 "unavailable/refused distinct from zero").

### 3.1 Owner decisions (raised with recommended defaults; decided in chat, 2026-11-12)

Each point either decides what Students see (00.13 §7, "any choice between materially different outcomes") or is a §8 responsible authority (00.13 §4.1, §7 "any reviewer ... that TASK_PLAN §8 names as a gate authority"). Nothing else is asked.

**Decisions (Owner, in chat, 2026-11-12, after the contract PASS of §9.2):**
- **RP-1:** "Nilai akhir saja (Recommended)". The `my-results` entry is exactly `{examInstanceId, publishedAt, standing, scaledScore}` (E5, §4.3); the alternative's points and counts are not part of this Task, and every bracketed alternative value below is void.
- **RP-2:** "Setujui (Recommended)". The contract PASS of this Task's standing reviewer (§9.2, reviewed SHA-256 2aa63dab…) and its confirmation of this registration are the O05 reviewer half (C10).

- **RP-1, what a published result shows the Student.**
  - **Why open:** OD-09 says "only their own score"; D04.8-21 leaves "configured result information" to configuration; P2:53 says "Exact ... review disclosure is O02/O05, not silently granted"; no O02 or O05 row decides it (ASSESS-QUESTION-001:63–82). The stored row has the scaled score, the raw and maximum points and the outcome counts (0045:50–61), so "score" can mean materially different disclosures.
  - **Proposed question:** "RESULT-003, RP-1: setelah guru mempublikasikan hasil, apa yang dilihat siswa untuk ujiannya sendiri?"
  - **Options:**
    - **"Nilai akhir saja (Recommended)"**: the scaled score 0 to 100 (for example "90"), hidden by default and revealed by the Student with "Tampilkan Nilai" (E7a), the time of publication, and for an absent Student "tidak mengerjakan, tidak ada nilai". No points, counts, per-question outcome or key.
    - "Nilai akhir dengan poin dan jumlah jawaban": the same, plus "Poin 9 dari 10" and the counts Benar, Salah, Tidak dijawab and Dinilai guru, all behind the same reveal control.
  - **Not part of the question:** masking by default (E7a) follows the LOCKED FRONTEND_DESIGN_SYSTEM §58 under either answer; it is not an Owner choice.
  - **Not offered:** per-question review or correct answers. No review policy exists (D04.8-23) and A11 forbids keys to the Student.
  - **What it fixes:** E5, the `my-results` entry shape (§4.3), the Student copy (§4.5), S-1 to S-3 and C06.
- **RP-2, the reviewer half of O05 for this Task.**
  - **Why open:** TASK_PLAN:648 names "Owner + assessment/security reviewer" for O05. The Owner granted that half to "the fixed independent contract reviewer of RESULT-004" for that Task only (RESULT-004:23, §3.1 "Setujui (Recommended)").
  - **Proposed question:** "RESULT-003, RP-2: gerbang O05 meminta persetujuan reviewer di samping Owner. Setujui bahwa reviewer independen tetap untuk tugas ini (reviewer kontrak RESULT-003) memegang bagian reviewer O05, seperti pada RESULT-004?"
  - **Options:**
    - **"Setujui (Recommended)"**: the contract PASS of the standing Owner-designated read-only reviewer, recorded with its reviewed SHA, is the O05 reviewer half (C10).
    - "Owner menunjuk reviewer lain": the Owner names another assessment/security reviewer, whose approval is recorded before READY.
  - **What it fixes:** §1 eligibility and C10.

### 3.2 Engineering readings (for the contract review)

- **E1, authority** (OD-07, OD-07b, A11, P03).
  - Publish and withdraw use `lockManagedExam` (FOR UPDATE on the exam, FOR SHARE on the authority rows), re-read per request inside the transaction. Every other actor gets 403 `forbidden`, byte-identical with a nonexistent or foreign exam id.
  - A person with combined roles publishes only through that teaching assignment (P03).
  - `my-results` is the authenticated person's own data only: participants with `person_id` = the session's person in the session's tenant. It takes no exam, participant or person id, so there is nothing to substitute (N02). A staff person with no participation gets `{results: []}`, as `assigned-exams` returns their own (empty) assignments.
- **E2, the state model** (D04.8-21, O05-6, A11 "at allowed revision").
  - Publication is not a lifecycle state; `lifecycle_state` stays FINALIZED. It is an append-only sequence of events per exam: PUBLISH, WITHDRAW, PUBLISH, ... The latest event decides; an exam with none is unpublished.
  - `revision` is the number of events so far (0 when never published). Every command carries `expectedRevision`. A stale screen or a second concurrent command gets 409 `publication_changed` with the current `{published, revision}`; it never becomes a silent no-op.
  - `publish` is allowed only when the latest event is absent or WITHDRAW, `withdraw` only when it is PUBLISH; any other pair at the current revision is also `publication_changed`.
- **E3, only finalized** (OD-09, A11). The exam must be FINALIZED (409 `invalid_state` with `currentState` otherwise). The 0066 foreign key to the finalization (§4.1) makes an unfinalized publication impossible at the database too.
- **E4, replay** (P02, N08). Each command carries an `actionKey` (UUID). The same key with the same request digest returns the stored receipt with `replayed: true`, even if the state moved on later; the same key with another digest or another actor gives 409 `action_key_reused`. The digest is `permissionDigest` over `{version: 1, tenantId, actorPersonId, examInstanceId, action, expectedRevision, reason}`.
- **E5, the Student value** (RP-1, D04.8-20, D04.4-12).
  - Read only from the frozen `secure_assessment_attempt_results` row of the Student's own participant in the exam's one finalization, never recomputed.
  - **RP-1 default:** `{examInstanceId, publishedAt, standing: 'SUBMITTED' | 'ABSENT', scaledScore: number | null}`; ABSENT has `scaledScore: null`.
  - Republication returns the same `standing` and `scaledScore` (O05-6), since both come from immutable rows.
- **E6, what never reaches the Student** (A11, N05, P04, D04.8-23, D04.8-50): no other person's row, ELLIGBLE ID or name; no rank, average, count of participants, points of others or class statistics; no key, rubric, item outcome, answer text, `finalizedBy`, reason or actor. An exam that is unpublished, withdrawn, not finalized, cancelled or in another tenant has no entry at all.
- **E7, where the Student sees it** (C22, D04.8-49).
  - On the existing exam card of "Daftar Ujian Siswa" (`web/components/AssignedExamDiscovery.tsx`), as one result line in the shared `ExamListCard`. No new screen or navigation entry, and `assigned-exams` is unchanged.
  - **Recorded departure:** TASK_PLAN:483 names a "Student result screen", and :485 proposes `StudentResultsView.tsx` and `App.tsx`. Proposed paths are "impact proposals, **not write authorization or complete frozen execution allowlists**" (TASK_PLAN §4 item 4, :241). This contract realises the Student result screen as the result line on the existing exam card. The reviewer confirms the departure. It changes no acceptance item of :481–482.
  - **When the line appears:** keyed on the exam's lifecycle state FINALIZED and the `my-results` entry, never on the Attempt.
    - Only a FINALIZED exam has a finalization, so only it can have a publication (the §4.1 foreign key).
    - An Attempt that exists but never started its timer stays unsubmitted after END. Finalization freezes it ABSENT (`result-finalization.ts:50–58`, :121–128). Its card keeps the existing attempt row, and the result line follows the `my-results` entry alone.
    - In a FINALIZED exam, once `my-results` has settled successfully:
      - an entry with SUBMITTED shows the RP-1 content behind the E7a mask;
      - an entry with ABSENT shows the absent copy (§4.5);
      - no entry shows "Hasil belum tersedia." (O05-6).
    - ENDED, ACTIVE, PAUSED, SCHEDULED and READY exams get no result line; their card is unchanged.
    - **ARCHIVED** shows no result line and is never treated as published (conservative reading, recorded for the reviewer).
      - The card groups ARCHIVED with ENDED and FINALIZED as "closed" (`AssignedExamDiscovery.tsx:44–47`).
      - No ARCHIVED exam can carry a published result. ARCHIVED is reached only by cancelling a SCHEDULED or READY exam (`teacher-exam-cancel.ts:44`, :88), and the lifecycle has no transition out of FINALIZED (`exam-lifecycle-operations.ts:56–63`).
      - A cancelled exam is excluded from `assigned-exams` (`assigned-exams.ts:130–135`) and from `my-results` (§4.2).
  - **Load:**
    - `my-results` is fetched only when at least one assignment is FINALIZED.
    - Until it settles, no card shows any result line, so there is no premature "Hasil belum tersedia.".
    - If it fails, no card shows a result line or a value, and one `Alert` says results could not be loaded, with "Coba Lagi". A failure never reads as "Hasil belum tersedia" or as zero (U05, C22).
- **E7a, masking by default.** No Owner decision is needed; this follows a LOCKED rule.
  - **The rule:** FRONTEND_DESIGN_SYSTEM §58 (docs/design/FRONTEND_DESIGN_SYSTEM.md:413) says "grade information is masked by default on shared screens", and Students use lab and shared devices (04.01_SECURE_ASSESSMENT.md:5829, D04.5-08).
  - **Mask:** a published SUBMITTED value is hidden by default. In its place the card shows the Teacher's masked mark (`Hidden`, `TeacherResultsView.tsx:38–40`): "••••" with `aria-label="Disembunyikan"`.
  - **Reveal control:** the Teacher's "Tampilkan Nilai" control (`TeacherResultsView.tsx:244–247`): `Button variant="secondary"`, `aria-pressed`, `IconEye` / `IconEyeOff`, labels "Tampilkan Nilai" and, once revealed, "Sembunyikan Nilai".
  - **Shared, not copied** (plan §10.1, "a pattern used twice becomes a shared primitive"):
    - the mark and the toggle move from `TeacherResultsView.tsx` into a new shared file `web/components/ScoreReveal.tsx` (`HiddenScore`, `ScoreRevealToggle`);
    - `TeacherResultsView.tsx` imports them, with rendering and behaviour unchanged;
    - the Student bundle therefore imports no Teacher screen (WEB-001).
  - **Scope:** one toggle per card with a published SUBMITTED value, so revealing one exam reveals no other.
  - **DOM:** before reveal, the value element is not rendered at all; the DOM holds only the mask.
  - **State:** the reveal state is component state only, never in `localStorage`, `sessionStorage`, IndexedDB or the URL. It resets to hidden on every load and reload.
- **E8, Teacher surfaces.**
  - The results screen of a FINAL exam shows the publication state and one action, "Publikasikan Hasil" or "Tarik Publikasi", which opens `ResultPublicationDialog` (reason, confirmation, action key per opening). No optimistic claim: the state line changes only after the server's 200 (U04).
  - The Teacher card of a FINALIZED exam shows "Hasil dipublikasikan kepada siswa <waktu>." while published; otherwise its current line stays byte-identical.
  - PROVISIONAL screens and every other card state are unchanged.
- **E9, the results projection** (RESULT-004 E10 precedent).
  - `teacher-exams/results` GET and the export POST gain top-level `publication`: `null` while PROVISIONAL; `{published, revision, changedAt}` when FINAL (`changedAt` is the time of the latest event, null when there is none).
  - GET and export keep one projection, so `permission-enforcement.test.ts:316–339` (GET equals export) holds.
  - The export digest now covers `publication`: a key issued before deployment, or before a publish or withdraw, and retried after it answers `export_data_changed`, the existing safe refusal (R2). The CSV and print builders ignore the field.
- **E10, privacy of the client** (C22, N05, card "cache/DOM/export privacy").
  - All responses are `no-store` (existing). The Student value lives only in component state: never in `localStorage`, `sessionStorage`, IndexedDB, the URL or a log.
  - An unpublished value is never sent, so it can never be in the DOM, a cache or a response body.
  - A value already on an open page stays there until the next load after a withdrawal (no push; R1).
  - The Student has no export or print.
- **E11, focus and layout** (V12; RESULT-004 E12).
  - "Publikasikan Hasil" and "Tarik Publikasi" take `WRAPPING_BUTTON` and join `useFocusRestore` with the existing fallbacks.
  - The dialog follows the shared reason-dialog pattern (`permissionDialogClass`, `useRetryFocus`). On success it closes and focus returns to the action button, whose label has changed; on failure focus goes to the enabled retry control.
  - The Student "Coba Lagi" keeps focus on retry. All targets use the default `Button` (44 px, `ui/button.tsx:21`).
- **E12, copy** (UI_CONTENT_AND_COPY_STYLE): Bahasa Indonesia, no em dash, role-neutral, times in the school zone.
  - The Student copy without a published value contains neither "Nilai" with a capital N nor any number. The reveal control, whose label contains "Nilai", appears only beside a published value. So the Student-page oracles keep passing:
    - `4-results.spec.ts:65` (`/Nilai|66,67|\b0\/3\b/` count 0): the exam is still running there, so there is no result line;
    - `5-lifecycle.spec.ts:546` (`/Nilai|66,67/` count 0): the exam is FINALIZED and unpublished, so the card now shows "Hasil belum tersedia.".
  - `5-lifecycle.spec.ts:462` ("Waktu pelaksanaan ujian telah berakhir." visible) holds with the result line beside it.
  - `4-results.spec.ts:83` is on the Proctor page (:68–83) and is unaffected.
- **E13, E2E.**
  - The new spec `99m-result-publication.spec.ts` sorts after `99l`. It copies the final 99l capture step unchanged except its prefix and task value; `helpers.ts` stays forbidden.
  - The Teacher side uses the in-app "Perbarui Data" (never a browser reload).
  - The Student page has no in-app refresh. Each Student check therefore uses the shared `reloadPage` helper while that page is idle, with no request in flight. That avoids the race of ASSESS-INSTITUTION-002 §11.0.3, which was a reload during an in-flight refresh.
  - The journey uses a teacher-managed exam; the institution actor rule is proven on real PostgreSQL (I-1, I-2).
- **E14, number format.**
  - The Student value uses the existing shared helper `formatScore` in `web/lib/question-import.ts:130` (`toLocaleString('id-ID', { maximumFractionDigits: 2 })`), already imported by `TeacherExamPreviewView.tsx:10`.
  - Its output equals the Teacher screen's own `formatScore` (`TeacherResultsView.tsx:26–28`, `Intl.NumberFormat('id-ID', { maximumFractionDigits: 2 })`).
  - `AssignedExamDiscovery.tsx` imports the shared helper. `question-import.ts` imports only types, so the Student bundle gains no screen.
  - Moving the Teacher copy onto the shared helper would also touch `teacherResults.test.tsx:3`, which imports `formatScore` from `TeacherResultsView`. To keep the allowlist minimal, the Teacher copy stays as it is (residual R10), and `web/lib/format.ts` is not in scope.

**Recorded deviations from proposed (not locked) documents:**
- The card's `StudentResultsView.tsx` and `App.tsx` are not used. The "Student result screen" of TASK_PLAN:483 is realised as the result line on the existing exam card (E7, with its recorded departure under TASK_PLAN §4 item 4, :241). It needs no new route state.
- The card's `17-result-publication.spec.ts` becomes `99m-result-publication.spec.ts`, so that it runs after the fixture students of `9-identity` exist (as 99k, 99l).
- The card's `test/integration/result-publication.test.ts` is kept; units go to `test/result-publication.test.ts`.

## 4. Contract

### 4.1 Schema

**Migration `0066_secure_assessment_result_publications.sql`** (Secure Assessment-owned, guarded by `elligble_migration_history`, one transaction, no backfill):

`public.secure_assessment_result_publication_events`:

| Column | Type and rule |
|---|---|
| `id` | UUID PRIMARY KEY DEFAULT gen_random_uuid() |
| `tenant_id`, `exam_instance_id` | UUID NOT NULL; FOREIGN KEY (`tenant_id`, `exam_instance_id`) REFERENCES `secure_assessment_exam_result_finalizations` (`tenant_id`, `exam_instance_id`) ON DELETE RESTRICT (only a finalized exam) |
| `sequence` | INTEGER NOT NULL CHECK (`sequence` > 0) |
| `action` | TEXT NOT NULL CHECK (`action` IN ('PUBLISH', 'WITHDRAW')) |
| `actor_person_id` | UUID NOT NULL REFERENCES `identity_persons` (`id`) ON DELETE RESTRICT (a reference, as 0054 does; no write to Identity) |
| `reason` | TEXT NOT NULL CHECK (char_length 1 to 200 AND `btrim(reason) = reason`) |
| `confirmed` | BOOLEAN NOT NULL CHECK (`confirmed`) |
| `action_key` | UUID NOT NULL |
| `request_digest` | TEXT NOT NULL CHECK (`request_digest ~ '^[0-9a-f]{64}$'`) |
| `occurred_at` | TIMESTAMPTZ NOT NULL DEFAULT statement_timestamp() |

- **Constraints:** UNIQUE (`tenant_id`, `exam_instance_id`, `sequence`), which also serves the latest-event lookup; UNIQUE (`tenant_id`, `action_key`).
- **BEFORE INSERT trigger:** `sequence` must be the previous maximum + 1 for the exam; the first event must be PUBLISH; an event must differ from the previous one.
- **BEFORE UPDATE OR DELETE trigger:** "Result publication events are append-only."
- **Not changed:** 0045 tables, 0054 and its constraints, `secure_assessment_exam_instances` (no lifecycle state added).
- **Compatibility:** additive. An older server ignores the table; a database without 0066 is never served by this code (migrations precede deployment).

### 4.2 Authority, transactions and errors

**POST `/api/v1/assessment/result-publications`** (`src/result-publication.ts`):

- **Body:** exactly the key set `{actionKey, action, confirmed, examInstanceId, expectedRevision, reason}`, parsed as `parseGradeRequest` does (`essay-grading.ts:256`, :258–268: sorted keys compared with a fixed list, then each type checked):
  - `examInstanceId` and `actionKey`: UUID strings;
  - `action`: `'publish'` or `'withdraw'`;
  - `expectedRevision`: a safe integer ≥ 0;
  - `reason`: a string;
  - `confirmed`: exactly `true`.
  - Any other key (for example `actorPersonId` or `tenantId`), a missing key or a wrong type gives 400 `invalid_request`.
  - `PRIVATE_FIELDS` (`permission-action-audit.ts:35`) is not used: it is not exported, and that file stays outside the allowlist.
- **Order in one transaction:**
  1. 400 on body shape; `normalizePermissionReason` (1 to 200 characters) and `confirmed === true`;
  2. `BEGIN`; `pg_advisory_xact_lock(hashtext('sa-publication:<tenant>:<actionKey>'))`;
  3. re-authentication (`mutation: true`), same person and tenant, else 403;
  4. `lockManagedExam` (exam FOR UPDATE, authority FOR SHARE), else 403 `forbidden`;
  5. the event by `(tenant_id, action_key)`: same actor and digest → replay receipt (E4); otherwise 409 `action_key_reused`;
  6. `lifecycle_state <> 'FINALIZED'` → 409 `invalid_state` `{currentState}`;
  7. the latest event; a revision or action mismatch → 409 `publication_changed` `{published, revision}`;
  8. INSERT the event (`sequence = revision + 1`);
  9. re-authentication again, then COMMIT.
- Every refusal rolls back and writes nothing.
- **Success 200:** `{examInstanceId, published: boolean, revision: number, changedAt: string, replayed: boolean}`. No reason, actor or score.
- **Database errors:** 40001 and 40P01 → 409 `state_changed`; 23505 → 409 `action_key_reused`; unavailable → 503 `persistence_unavailable`.
- **Edge:** 403 `origin_not_allowed`, 413 on an oversized body, 405 on another method, 401 anonymous (existing).

**GET `/api/v1/assessment/my-results`:**
- No query parameters; any parameter → 400 `invalid_request`. 405 on another method; 401 anonymous; 403 no membership; 503 database unavailable.
- One `REPEATABLE READ READ ONLY` transaction:
  - participants of the session person in the session tenant;
  - excluding cancelled exams (as `assigned-exams.ts:130–135`);
  - joined to the exam's finalization;
  - the latest publication event, which must be PUBLISH;
  - the Student's own frozen row.
- Ordered by `exam_instance_id`.

**`teacher-exams/results` (GET, export POST):** unchanged order and errors; the FINAL branch reads the latest publication event inside the same snapshot (E9).

**Lock order:** the publication command takes the advisory key lock, then the exam row and the authority rows in the `lockManagedExam` order already used by finalize, reschedule and cancel. It takes no Attempt, answer or grade lock, so no new cycle is possible. Finalize and publish on one exam serialize on the exam row.

### 4.3 Projections

- **`my-results` 200:** `{results: Array<{examInstanceId, publishedAt, standing: 'SUBMITTED' | 'ABSENT', scaledScore: number | null}>}` under the RP-1 default.
- **Teacher `publication`** (E9): `null` | `{published: boolean, revision: number, changedAt: string | null}`.
- **Teacher card** (`teacher-readiness.ts`): `publishedAt: string | null`, non-null only for a FINALIZED exam whose latest event is PUBLISH.

**Invariants of the projections:**
- every `my-results` entry belongs to a participant whose `person_id` is the caller's;
- its `scaledScore` equals that participant's frozen `scaled_score` (null when ABSENT);
- no entry exists for an exam whose latest event is not PUBLISH;
- the Teacher `publication.published` equals "an entry would exist" for each participant of that exam.

### 4.4 Teacher, School Operator, Proctor and Student surfaces

- **Teacher holding the assignment:** publish, withdraw and republish from the FINAL results screen; state on the results screen and the card.
- **School Operator, Proctor, Homeroom Teacher:** nothing changes; 403 on the command; their projections carry no `publication`, score or `my-results` data of others. The School Operator session view keeps "Hasil Final" and gains nothing (A10).
- **Student:** their own published value on their own exam card (E7, RP-1).

### 4.5 Client

**Results screen** (`TeacherResultsView.tsx`), FINAL only and only when `publication` is an object (an older server or a fixture without it shows no publication controls):
- **State line** (`role="status"`):
  - never published: "Belum dipublikasikan. Siswa belum dapat melihat nilai.";
  - published: "Dipublikasikan kepada siswa <waktu>. Setiap siswa hanya melihat nilainya sendiri.";
  - withdrawn: "Publikasi ditarik <waktu>. Siswa melihat "Hasil belum tersedia".".
- **The FINAL note at :216:** unchanged while unpublished. While published, its last sentence "Hasil ini tidak ditampilkan kepada siswa." becomes "Setiap siswa dapat melihat nilainya sendiri.". The PROVISIONAL note at :224 is unchanged.
- **Action:** "Publikasikan Hasil" when unpublished or withdrawn, "Tarik Publikasi" when published; both `WRAPPING_BUTTON` (E11).

**`ResultPublicationDialog.tsx`** (shared `Dialog`, `ActionReasonField`, `permissionDialogClass`, `useActionKey`, `useRetryFocus`):
- **Publish:**
  - title "Publikasikan Hasil Ujian?";
  - text "Setiap siswa peserta ujian ini dapat melihat nilainya sendiri. Siswa tidak melihat nilai siswa lain, peringkat, atau kunci jawaban. Publikasi dapat ditarik kembali.";
  - confirm "Publikasikan Hasil".
- **Withdraw:**
  - title "Tarik Publikasi Hasil?";
  - text "Nilai disembunyikan kembali dari siswa, dan siswa melihat "Hasil belum tersedia". Hasil yang difinalisasi tidak berubah dan dapat dipublikasikan lagi.";
  - confirm "Tarik Publikasi".
- "Batal" in both. The confirm button is enabled only with a valid reason.
- **Refusals** (in the dialog, `Alert` with `AlertDescription min-w-0 break-words`):
  - `publication_changed`: "Status publikasi telah berubah. Data diperbarui; periksa lalu ulangi bila perlu." (the screen reloads in-app);
  - `invalid_state`: "Hasil harus difinalisasi sebelum dipublikasikan.";
  - 403: "Hanya guru mata pelajaran ujian ini yang dapat mempublikasikan hasil.";
  - `action_key_reused` or `state_changed`: "Permintaan bertabrakan dengan perubahan lain. Tutup lalu coba lagi.";
  - 503 or network: "Gagal terhubung ke server. Periksa koneksi internet Anda, lalu coba lagi.".

**Teacher card** (`TeacherReadinessView.tsx:315–317`): while `publishedAt` is set, "Hasil difinalisasi <waktu>. Hasil dipublikasikan kepada siswa <waktu>."; otherwise byte-identical to today (`5-lifecycle.spec.ts:498` holds).

**Student exam card** (`AssignedExamDiscovery.tsx`, E7, E7a, RP-1 default), FINALIZED exams only, after `my-results` has settled:
- published SUBMITTED: `ExamFact` "Nilai" with `HiddenScore` ("••••", "Disembunyikan") until the Student presses "Tampilkan Nilai"; then the value (for example "90" or "33,33") and "Sembunyikan Nilai"; then "Dipublikasikan <waktu>.";
- published ABSENT: "Anda tercatat tidak mengerjakan ujian ini, sehingga tidak ada nilai." (no value, so no reveal control);
- no entry: "Hasil belum tersedia.";
- while loading: no result line;
- load failure: no result line on any card, and one `Alert` "Hasil ujian belum dapat dimuat. Periksa koneksi internet Anda, lalu coba lagi." with "Coba Lagi".

**Shared component** `ScoreReveal.tsx` (E7a): `HiddenScore` and `ScoreRevealToggle`, moved from `TeacherResultsView.tsx:38–40` and :244–247 with identical markup, classes, labels and `aria-pressed`.

**API and types:** `postResultPublication(input)` and `getMyResults()` in `api/assessment-client.ts`; `ResultPublicationInput`, `ResultPublicationReceipt`, `MyResultEntry`, optional `publication` on `TeacherExamResultsResponse` and optional `publishedAt` on the readiness exam in `types/assessment.ts`.

Shared primitives and tokens only (plan §10.1); no new colour, font, size or component family.

### 4.6 Invariants

- **Truth:** no stored row of 0003, 0004, 0041, 0045, 0054 or 0061 changes; publication writes only 0066.
- **Visibility:** a Student value is returned only when its exam's latest event is PUBLISH and the participant is the caller's own; END and finalize write no 0066 row.
- **Stability:** the value shown after any number of withdrawals and republications equals the frozen row (O05-6, D04.8-20).
- **Authority:** only the exam's teaching-assignment Teacher writes 0066. Every refusal writes nothing.
- **Data:** no response, log or row carries a name, NIS, NISN, birth date, answer text, key, rubric, another person's value, a rank or an aggregate.
- **Per exam:** no route sums or compares exams.

### 4.7 Existing assertions that change (only these)

None expected. These are expected to stay unchanged and passing:
- **Runtime:**
  - `teacher-results.test.ts` (it compares named fields, not whole responses);
  - `permission-enforcement.test.ts:316–339` (GET and export both carry `publication`; a PROVISIONAL exam carries `null` on both);
  - `complete-results.test.ts` (its before/after comparisons carry `publication` on both sides);
  - `result-finalization.test.ts` (finalize writes no 0066 row);
  - `teacher-readiness.test.ts` (`publishedAt` is additive);
  - `metrics.test.ts` (both new paths are classified);
  - `route-parity.test.ts`, changed only by its CALLS entries (§6 row 21).
- **Web:**
  - `teacherResults.test.tsx` (its FINAL fixture has no `publication`, so no controls; :109 still matches);
  - `completeResults.test.tsx`;
  - `assignedExamDiscovery.test.tsx`, `session.test.tsx`, `schoolTimeZone.test.tsx`, `startAttempt.test.tsx` (no FINALIZED assignment, so `getMyResults` is never called and their module mocks need no new export);
  - `teacherResults.test.tsx` and `4-results.spec.ts:36` (`getByLabel('Disembunyikan')` count 4) also cover the moved `HiddenScore` and toggle, whose rendering is unchanged;
  - `teacherOperations.test.tsx:168`, :217 (finalize and end copy unchanged).
- **E2E:**
  - the Student-page oracles `4-results.spec.ts:65` and `5-lifecycle.spec.ts:546`, and the closed-card text `5-lifecycle.spec.ts:462` (E12);
  - the Proctor-page oracle `4-results.spec.ts:83` (:68–83), unaffected;
  - `5-lifecycle.spec.ts:498` (Teacher card);
  - `99f`, `99l` and the other journeys (no publication happens in them).

If implementation proves any of these wrong, the change is a reviewed amendment of this section, never a silent edit.

**Rendered differences expected:** earlier captures of a FINAL results screen gain the state line and the action; earlier Student-list captures with a FINALIZED exam gain "Hasil belum tersedia."; ENDED exams are unchanged. Each difference is recorded and reviewed (C08).

### 4.8 Negative coverage (P5 trace)

P5 names for A11 N01, N02, N03, N04, N05, N06 and N08 (:131); N10 is added for the POST edge.

| Route | P5 row | N-ids asserted (C03) |
|---|---|---|
| POST `result-publications` | A11 | N01, N02, N03, N04, N05, N06, N08, N10 |
| GET `my-results` | A11 | N01, N02, N05, N10 (Origin).<br>Not applicable:<br>• N03: no assignment-scoped object; the read is the caller's own Person only (E1);<br>• N04: no role widens or narrows it; every role reads only its own participations;<br>• N06: a read with no version, session write or lifecycle effect;<br>• N08: no sensitive action, reason or audit |
| GET and POST `teacher-exams/results` (`publication` field) | A11 | N03, N04, N05 (regression of the RESULT-004 set) |
| School Operator session and exam projections | A10 | N04 (no `publication`, score or `my-results` data) |

What each N-id means here:
- **N01:** anonymous 401; no membership or another tenant 403; database unavailable 503 with nothing written.
- **N02:** an exam of another tenant on POST gives 403, byte-identical with a nonexistent id; on GET any `examInstanceId`, `personId` or `participantId` query parameter gives 400 and nothing else is returned.
- **N03:** another subject's Teacher (T3 on E1), the Teacher of tenant 2, actor A and T1 after revocation get 403 with zero rows written.
- **N04:** School Operator O, Proctor P, Homeroom H and every Student get 403 on POST, for TM and E1.
- **N05:** a Student receives only their own entries; no peer, rank, key or aggregate key exists in any response; an unpublished, withdrawn, not-finalized or foreign exam has no entry; the Teacher receipt carries no score; responses are `no-store`; the client stores nothing (D-1).
- **N06:** not FINALIZED gives `invalid_state`; a stale `expectedRevision` or a wrong action gives `publication_changed`.
- **N08:** missing or blank reason, a reason over 200 characters, or `confirmed` not `true` gives 400; a replayed key with another body gives `action_key_reused`; actor and time come from the server; every refusal leaves 0066, 0045, 0054 and lifecycle-event counts equal before and after.
- **N10:** a disallowed Origin gives 403 `origin_not_allowed`; a body over the limit gives 413; both before any database effect.

## 5. Expected vectors

Values follow the RP-1 decision ("Nilai akhir saja").

**Fixture:**
- **Tenant 1** (Asia/Jakarta).
  - **TM:** a teacher-managed exam of T1 (Ekonomi × X) with three questions: Q1 PG max 2 (key B), Q2 PGK max 3 (key {A, C}), Q3 ES max 5. Total 10.
    - s1: B; {A, C}; essay graded 4 → raw 9, scaled 90 [correct 2, incorrect 0, unanswered 0, graded 1];
    - s2: A; {A, C}; essay graded 2,5 → raw 5,5, scaled 55 [1, 1, 0, 1];
    - s3: never starts → ABSENT.
  - **Institution session S:**
    - E1, Matematika × X, subject Teacher T2, two PG (Q1 max 1 key A, Q2 max 2 key B): s1 answers A, C → raw 1, max 3, scaled 33,33; s2 answers A, B → 100;
    - E2, Fisika × X, subject Teacher T3, ENDED and not finalized, s1 submitted.
  - School Operator O (no Teacher assignment), Proctor P of E1's room, Homeroom H of X, actor A (member, no role).
- **Tenant 2:** Teacher T9, Student s9 with exam TM9 FINALIZED and published (s9 scaled 100).

| # | Case | Expected |
|---|---|---|
| P-1 | Not finalized | T1 publishes TM while ENDED, and T3 publishes E2 (ENDED): 409 `invalid_state` `{currentState: 'ENDED'}`; no 0066 row |
| P-2 | Publish | T1 finalizes TM, then publishes with `expectedRevision: 0`: 200 `{published: true, revision: 1, replayed: false}`; one 0066 row (sequence 1, PUBLISH, T1, reason, key, digest); no 0045 or lifecycle change |
| P-3 | Replay | the same key and body: 200, the same receipt with `replayed: true`, still one row. The same key with another reason, or sent by T2: 409 `action_key_reused` |
| P-4 | Stale | a new key, publish with `expectedRevision: 0`: 409 `publication_changed` `{published: true, revision: 1}`; withdraw with `expectedRevision: 0`: the same |
| P-5 | Withdraw | withdraw at revision 1: 200 `{published: false, revision: 2}` |
| P-6 | Republish | publish at revision 2: 200 `{published: true, revision: 3}`; s1's entry equals P-2's except `publishedAt` |
| P-7 | Malformed | no reason, "   ", 201 characters, `confirmed` false or missing, `actionKey` "x", `action` "unpublish", `expectedRevision` -1, 1.5 or "1", an extra body key such as `actorPersonId` or `tenantId`, or a missing key (the exact key set of §4.2): each 400, nothing written |
| S-1 | Own only | after P-2, with E1 finalized but unpublished: s1 `{results: [{TM, SUBMITTED, 90}]}`; the entry's keys are exactly `examInstanceId`, `publishedAt`, `standing`, `scaledScore` |
| S-2 | Peers and absent | s2 gets only `{TM, SUBMITTED, 55}`; s3 gets `{TM, ABSENT, null}`; no response holds another person's value or ID |
| S-3 | Transitions | after P-5 s1 gets `[]` and the card reads "Hasil belum tersedia."; after P-6 `[{TM, SUBMITTED, 90}]` again |
| S-4 | Per subject | T2 publishes E1: s1 gets TM 90 and E1 33,33, two entries, no total; E2 (ENDED) has none |
| S-5 | Edges | `?examInstanceId=<E1>` gives 400; POST gives 405; anonymous 401; s9 gets only TM9; T1 (no participation) gets `{results: []}` |
| V-1 | Masked by default (E7a) | s1's TM card after load: the value element is absent; the mask "Disembunyikan" and "Tampilkan Nilai" (`aria-pressed` false) are present |
| V-2 | Reveal | pressing "Tampilkan Nilai" shows "90", and the control reads "Sembunyikan Nilai" (`aria-pressed` true); s1's E1 card stays masked; pressing again hides the value |
| V-3 | Reload re-masks | after V-2 and a reload, V-1 holds again; no storage key or URL parameter records the reveal |
| V-4 | Settled load only | while `my-results` is pending, no result line exists; on failure there is no result line and no "Hasil belum tersedia.", only the load Alert with "Coba Lagi" |
| I-1 | Institution actor | T2 publishes E1: 200. O, P, H, A, s1 and T9: 403; T3 on E1: 403, byte-identical with a nonexistent id; T1 after its TM assignment is revoked: 403 on TM |
| I-2 | Combined roles (P03) | a person who is both O and T2 publishes E1 as Teacher; with its T2 assignment revoked: 403 |
| I-3 | Teacher views | TM results GET while PROVISIONAL: `publication: null`; FINAL: `{published: true, revision: 1, changedAt}`; the TM card `publishedAt` is set, and null after P-5 |
| I-4 | School Operator (A10) | O's session and exam projections have no `publication`, `scaledScore` or result key, before and after publication |
| K-1 | Concurrent publishes | two publishes at revision 0 with different keys: one 200, one `publication_changed`; one row |
| K-2 | Finalize and publish | publish waits on the exam row held by finalize, then succeeds; publish first, while ENDED: `invalid_state` |
| K-3 | Revocation and publish | a revocation of T1's assignment waits on the FOR SHARE or makes the publish 403; no row by T1 after the revocation commits |
| K-4 | Read during publish | a `my-results` read taken during a publish commit sees the state wholly before or wholly after it |
| T-1 | Append-only | UPDATE and DELETE on 0066 are refused; raw inserts of a first WITHDRAW, two PUBLISH in a row, a sequence gap, an unfinalized exam (foreign key) or a duplicate key are refused |
| T-2 | Frozen | after P-2, fixture SQL changes an answer, adds a grade revision and changes a snapshot `maxScore` (trigger disabled, then re-enabled): s1's entry is byte-identical |
| M-1 | Migration 0066 | applied after 0001–0065 on a populated database with finalized exams: succeeds, writes no row; a re-run is a no-op; an injected failure leaves no table and no history row (the 0065 I-21 pattern) |
| D-1 | Client privacy | every response has `Cache-Control: no-store`; after the Student page loads, no `localStorage`, `sessionStorage` or IndexedDB value contains a score; no response the Student page receives carries a value of an unpublished exam; after P-5 and a reload the result value element is absent and the card shows "Hasil belum tersedia."; before reveal (E7a) the value element is absent and only the mask is rendered |
| X-1 | Export | the TM CSV after P-2 has the RESULT-004 columns only (no publication column); an export key issued before P-2 and retried after it gives `export_data_changed`; a new key exports |
| R-1 | Regression | every existing suite passes with §4.7 unchanged |

## 6. Exact proposed file scopes (to be frozen at READY)

| # | Path | Purpose |
|---|---|---|
| 1 | docs/production/tasks/RESULT-003.md | Contract, history, evidence (Task-flow) |
| 2 | docs/production/TASK_PLAN.md | Status, counters, RESULT-004 landing (Task-flow) |
| 3 | docs/production/PRODUCTION_COMPLETION_PLAN.md | Status and continuity (Task-flow) |
| 4 | docs/DOCUMENT_MANIFEST.md | Index (Task-flow) |
| 5 | docs/production/CBT_DOMAIN_RULES_SPECIFICATION.md | Appended pointer to the RP-1 and RP-2 decisions |
| 6 | database/migrations/0066_secure_assessment_result_publications.sql | §4.1 (new) |
| 7 | runtime/secure-assessment/src/result-publication.ts | Command, `my-results` read, latest-state read (new) |
| 8 | runtime/secure-assessment/src/server.ts | The two routes |
| 9 | runtime/secure-assessment/src/teacher-results.ts | `publication` (E9) |
| 10 | runtime/secure-assessment/src/teacher-readiness.ts | `publishedAt` on the card |
| 11 | runtime/secure-assessment/src/metrics.ts | Two `COMPONENT_BY_PATH` entries (`reporting`) |
| 12 | frontend/web/src/types/assessment.ts | New types; optional fields |
| 13 | frontend/web/src/api/assessment-client.ts | `postResultPublication`, `getMyResults` |
| 14 | frontend/web/src/components/ScoreReveal.tsx | `HiddenScore` and `ScoreRevealToggle`, moved from the Teacher screen (E7a) (new) |
| 15 | frontend/web/src/components/ResultPublicationDialog.tsx | Publish and withdraw dialog (new) |
| 16 | frontend/web/src/components/TeacherResultsView.tsx | State line, action, note branch, focus; imports `HiddenScore` and `ScoreRevealToggle` |
| 17 | frontend/web/src/components/TeacherReadinessView.tsx | The FINALIZED line branch |
| 18 | frontend/web/src/components/AssignedExamDiscovery.tsx | The Student result line, its load and the E7a mask; imports `formatScore` from `lib/question-import.ts` |
| 19 | runtime/secure-assessment/test/result-publication.test.ts | Units (new) |
| 20 | runtime/secure-assessment/test/integration/result-publication.test.ts | §5 and §4.8 on real PostgreSQL, M-1 (new) |
| 21 | runtime/secure-assessment/test/route-parity.test.ts | CALLS gains the two client functions only |
| 22 | frontend/web/src/__tests__/resultPublication.test.tsx | Screens, dialog, copy, focus, Student card, storage (new) |
| 23 | e2e/tests/99m-result-publication.spec.ts | Five-browser journey and captures (new) |

Rows 1–4 are Task-flow paths. The allowlist is rows 5–23, 19 paths. Rows 7, 18 and 22 depend on RP-1 only in the entry shape and copy; no row is added or removed by either RP-1 answer. Migration 0066 is to be reserved at READY after a re-check that it is unused on current `main`.

**Forbidden:**
- every other file, including:
  - runtime: `scoring.ts`, `result-finalization.ts`, `essay-grading.ts`, `exam-lifecycle-operations.ts`, `permission-action-audit.ts`, `managed-exam.ts`, `assigned-exams.ts`, `institution-exams.ts`, `school-exam-monitoring.ts`, `question-contract.ts`, `question-types/*`;
  - frontend: `App.tsx`, `AppShell.tsx`, `TeacherEssayGradingView.tsx`, `InstitutionExamView.tsx`, `SchoolExamMonitoringView.tsx`, `lib/results-export.ts`, `lib/status.ts`, `lib/format.ts`, `lib/question-import.ts`, the `ui/` primitives, `hooks/`;
  - tests: `helpers.ts`, `global-setup.ts`, and every existing spec and test other than row 21;
- completed Task records;
- migrations other than row 6;
- lockfiles, dependencies and workflows;
- production resources.

## 7. Acceptance gates (DEFINED / NOT EXECUTED)

| Gate | Expected outcome |
|---|---|
| C01 | Units:<br>• body parsing and every 400 of P-7;<br>• the digest of E4 (stable across key order and UUID case);<br>• the state machine of E2 over every (latest event, action, expectedRevision) combination;<br>• the `my-results` row mapping (SUBMITTED, ABSENT, the RP-1 shape);<br>• the Teacher `publication` mapping;<br>• the shared `formatScore` output for 90, 33,33 and 55 |
| C02 | Real PostgreSQL: P-1 to P-7 and S-1 to S-5 with every value of §5 exact, and before/after counts for every refusal |
| C03 | Real PostgreSQL through the production-wired server: I-1 to I-4 and every N-id of §4.8. Covers V09 and V11 |
| C04 | Real PostgreSQL concurrency, tamper and migration: K-1 to K-4, T-1, T-2 and M-1; each race with a 5 s bound and no 40P01 |
| C05 | Regression with §4.7 unchanged: every runtime, web and E2E suite passing |
| C06 | Client:<br>• the results state lines, action labels and note branch;<br>• the dialog copy, reason validation, confirmation and every refusal of §4.5, with no em dash;<br>• focus after publish and withdraw (success and failure), never on BODY;<br>• the Student card for published, absent, unavailable and failed loads; no result line before `my-results` settles; a failure state distinct from "Hasil belum tersedia." and from zero (V-4);<br>• E7a: masked by default with the value element absent; reveal shows the value; hide masks it again; one card's reveal leaves the others masked; a remount masks it again; no storage or URL write (V-1 to V-3);<br>• an ARCHIVED or ENDED assignment shows no result line;<br>• `TeacherResultsView` renders the moved `HiddenScore` and toggle exactly as before;<br>• no `getMyResults` call without a FINALIZED assignment;<br>• no storage write of a value (D-1);<br>• unchanged rendering without `publication` or `publishedAt` |
| C07 | Five-browser E2E (`99m`). guru.e2e is the managing Teacher; pengawas.e2e is the School Operator.<br>Journey:<br>• guru.e2e creates a teacher-managed exam from a v2 file (PG, PGK, ES) for X-E2E; the window is set by fixture SQL; two Students answer, the others stay absent; guru.e2e ends the exam, grades the essays and finalizes;<br>• each Student's card reads "Hasil belum tersedia." and the page carries no value;<br>• guru.e2e opens "Lihat Hasil", sees "Belum dipublikasikan.", publishes with a reason, and sees the published state line;<br>• each answering Student's card is masked after load (value element absent); "Tampilkan Nilai" reveals only their own value; a reload masks it again; an absent Student sees the absent copy; no page holds another Student's value or ID;<br>• guru.e2e withdraws; after a reload the Student sees "Hasil belum tersedia." and no value in DOM or storage; guru.e2e republishes and the same value returns;<br>• in-page requests: a Student's POST to `result-publications` and pengawas.e2e's gets 403; a Student's `my-results?examInstanceId=...` gets 400.<br>Shared helpers only; the Teacher side uses the in-app refresh |
| C08 | Rendered evidence (`workspace-result-publication-*`):<br>• **Baseline:** the five `workspace-visual-*` artifacts of the post-merge `main` CI of RESULT-004, fetched with the resumable, size- and `unzip -t`-checked transfer; manifest recorded at READY.<br>• **After:** at most five scenarios: FINAL results unpublished with the action; the publish dialog with a reason; FINAL results published; the Student card masked and revealed (one scenario, two states); the Student card "Hasil belum tersedia." after withdrawal.<br>• **Conditions:** widths 360, 390, 430, 768, 1024, 1280, 1440 and 640×360, and 200 % text at 390×844 and 1280×800 with the single-pass calibration.<br>• **Pass criteria:** no page overflow; targets ≥ 44 px; focus never on BODY; rendered review PASS.<br>• **Earlier captures:** pixel-identical except times and IDs and the §4.7 differences, each recorded and reviewed |
| C09 | Scope inside rows 1–23; 33 Tasks and 78 edges; exact-SHA attempt-1 eight-job CI; no re-run |
| C10 | Independent contract, implementation and rendered review PASS. The reviewer's contract approval is, by the Owner's answer to RP-2, the O05 reviewer half, anchored to the registration commit SHA; Delegated Acceptance; evidence commit; delegated merge |

**CI-first order,** as RESULT-004 §7:
1. Registration, carrying the RESULT-004 landing, the 0066 reservation and the baseline manifest.
2. Implementation, whose exact-SHA CI passes before review.
3. Implementation and rendered review.
4. Delegated Acceptance and the evidence commit.
5. PR-head CI, the delegated squash merge, then post-merge main CI.

No re-runs, and no push while the previous commit's CI runs. Integration and E2E run in CI only (8 GB workstation).

**Honest limits and risks:**
- **R1, an open page after withdrawal:** a value already shown stays on an open Student page until its next load. There is no push channel, and none is proposed (E10).
- **R2, export digest:** an export key retried across deployment, a publish or a withdrawal gets `export_data_changed`; a new key works (E9).
- **R3, no notification:** Students learn of a publication only by opening their list.
- **R4, no correction:** a published result cannot be corrected (O02-10); withdrawal only hides it.
- **R5, staff persons** receive `{results: []}` from `my-results` rather than 403 (E1).
- **R6, authority follows the assignment:** a Teacher who takes over the teaching assignment can withdraw or republish an earlier Teacher's publication; the 0066 actor column keeps who did what.
- **R7, PB05 stays OPEN;** G7 still bars real student data.
- **R8, E2E budget:** 99h to 99l already run long; 99m is bounded to five capture scenarios, recorded at READY.
- **R9, institution journey in a browser:** the institution actor rule is proven on real PostgreSQL (I-1, I-2), not in 99m (E13).
- **R10, two score formatters:** `TeacherResultsView.tsx:26–28` keeps its own `formatScore` beside the shared `lib/question-import.ts:130`. Both give the same output (C01). Consolidation is left out to keep the allowlist minimal (E14).
- **R11, a revealed value on an open page:** a revealed value stays visible until the Student hides it or the page reloads (E7a).

## 8. History

- **2026-11-12, contract drafted** under DEC-048 on f15fa1f (task/result-004, tree equal to `main` deee8a6, the RESULT-004 squash merge, PR #40).
  - Approved inputs: OD-07, OD-07b, OD-09; O02-10, O05-1, O05-6; P5 A10, A11, N01–N10 (GOV-POLICY-001); D04.4-12, D04.8-16, D04.8-20 to D04.8-23, D04.8-49 to D04.8-51 (LOCKED); RESULT-004 RS-2, RS-3 and E6.
  - "Withdrawal/correction behavior" recorded as settled by O05-6 and O02-10; "review disclosure" (P2:53) raised as RP-1.
  - Open: RP-1 and RP-2, raised with recommended defaults.
  - Migration 0066 proposed, not yet reserved.
  - Precondition: the RESULT-004 post-merge `main` CI is not yet verified or recorded.
  - Not reviewed; NOT READY; BLOCKED.
- **2026-11-12, contract review 1 returned STOP** on the draft with SHA-256 eb902ce0… (F1 to F4 and non-material notes). Corrections applied in this revision:
  - F1: E7a masks the Student value by default under LOCKED §58, using the shared Teacher reveal pattern (new `ScoreReveal.tsx`). RP-1 is reworded. The card-line realisation of the "Student result screen" is recorded as a departure. V-1 to V-3, C06, C07 and C08 cover it.
  - F2: §4.2 uses an exact body key set, following `parseGradeRequest`; P-7 follows from it.
  - F3: the result line is keyed on FINALIZED plus the `my-results` entry, and appears only after the load settles. A failed load has its own state. ARCHIVED shows no line (conservative reading). V-4 and C06 cover it.
  - F4: the E12 and §4.7 oracle lines are corrected (`4-results:65`, `5-lifecycle:546`, `5-lifecycle:462`; `4-results:83` is the Proctor page).
  - Non-material: E14 reuses `lib/question-import.ts:130`, so `lib/format.ts` leaves the scope (R10). D-1 asserts element absence. §4.8 marks N03, N04, N06 and N08 not applicable to GET `my-results`.
  - Status: STOP corrected; re-review by the same reviewer pending; NOT READY; BLOCKED.
- **2026-11-12, contract re-review PASS** by the same reviewer on SHA-256 2aa63dabd6cc91fa2707cbb2ff68288dac31666349c1d262333fcdd7a8825f0c (§9.2). Owner decisions RP-1 and RP-2 taken in chat (§3.1).
- **2026-11-12, registration** on `main` deee8a6 after the RESULT-004 landing (§10). Changes from the reviewed draft, all mechanical: the control rows of §1; the §3.1 decisions; the RP-1 alternative removed from §4.3 and §5 (S-1); C06 "ENDED or FINALIZED" corrected to "FINALIZED" (review note 1, §9.2); this entry and §9–§10.

## 9. Independent contract review

Reviewer: the Owner-designated standing read-only subagent reviewer of RESULT-004, kept for this Task's review chain; by RP-2 also the O05 reviewer half.

### 9.1 Review 1: STOP

On SHA-256 eb902ce084095b8fa30c5ecfb610e7d6db3d063256f5b3f3917c63f99b334550 (497 lines), against f15fa1f (tree = `main` deee8a6).
- **F1 (material):** E7 "not masked" decided a design rule; LOCKED FRONTEND_DESIGN_SYSTEM §58 (:413) masks grades on shared screens and D04.5-08 (04.01:5829) expects lab and shared devices. Corrected by E7a (masked by default, shared reveal pattern, no stored state).
- **F2:** the §4.2 body rule used the unexported `PRIVATE_FIELDS` (permission-action-audit.ts:35, outside the allowlist). Corrected to the exact six-key set, as `parseGradeRequest`.
- **F3:** no state for a Student card while `my-results` loads, and the result line keyed on a submitted Attempt, hiding the ABSENT copy for a never-started Attempt (result-finalization.ts:50–58, :121–128). Corrected: no line until the load settles, a distinct failure state, the line keyed on FINALIZED plus the entry, ARCHIVED read conservatively.
- **F4:** the E12 and §4.7 oracle list misplaced 4-results:83 and missed 5-lifecycle:546 and :462. Corrected.
- Non-material: the duplicate `formatScore` (E14, R10), D-1 by element absence, §4.8 N03/N04/N06/N08 not applicable to GET `my-results`. Applied.

### 9.2 Review 2: PASS

On SHA-256 2aa63dabd6cc91fa2707cbb2ff68288dac31666349c1d262333fcdd7a8825f0c (553 lines). F1 to F4 confirmed; the ARCHIVED reading verified (ARCHIVED only by cancelling SCHEDULED or READY, teacher-exam-cancel.ts:44, :88; nothing leaves FINALIZED, exam-lifecycle-operations.ts:56–63; cancelled exams excluded, assigned-exams.ts:130–135). Moving `Hidden` and the toggle to `ScoreReveal.tsx` keeps every existing assertion (neither is exported; 4-results:36 asserts markup); the toggle takes `pressed`, `onToggle` and `disabled` and keeps its classes exactly. The `formatScore` reuse adds no screen to the Student bundle. Non-material notes:
1. C06 said "ENDED or FINALIZED" where E7 fetches only for FINALIZED: corrected at registration.
2. The shared masked value puts `aria-label` on a plain `span` (pre-existing): the implementation's rendered and accessibility review confirms how the Student card announces the masked state.
3. A FINALIZED card with a never-started Attempt still shows "Mulai Pengerjaan" beside the ABSENT copy: pre-existing, not introduced here; recorded as an observation.

## 10. Formal READY and Build start under DEC-048 — 2026-11-12

- **Eligibility (00.13 §4.1):**
  - The internal dependency RESULT-004 is DONE: PR #40, main deee8a66d8518544a82b011c5070745a475cc153, PR-head CI #264 (run 43041390018) attempt 1 FAILURE in the five E2E jobs at "Install suite and browser" (runner DNS; no test ran), escalated under 00.13 §5.3/§8, attempt 2 of only those jobs authorized by the Owner by name, eight SUCCESS; post-merge main CI #265 (run 43182301352) attempt 1 eight SUCCESS.
  - O05: the Owner half is O05-1, O05-6, O02-10 and OD-09 plus RP-1; the reviewer half is this Task's standing reviewer by RP-2. O09 rests on P5 (GOV-POLICY-001). PB05 stays OPEN as release evidence.
  - No earlier-row or P0 Task is eligible (§1 Selection).
- **Review chain:** STOP → PASS (§9).
- **Frozen allowlist:** §6 rows 5–23, 19 paths; rows 1–4 are Task-flow paths. Migration 0066 reserved (`database/migrations/0066_secure_assessment_result_publications.sql`; the highest on `main` deee8a6 is 0065). No dependency, workflow or production resource.
- **Rendered baseline (step 1):** the five `workspace-visual-*` artifacts of exact-main CI #265 (run 43182301352, deee8a6), fetched in parallel with the resumable, size- and `unzip -t`-checked transfer.
  - 4400 pairs (ASSESS-QUESTION-002 450, -003 200, -004 225, -005 200, -006 325, -007 225, -008 425; ASSESS-INSTITUTION-001 950, -002 450, -003 500; ASSESS-ROOM-001 250; RESULT-004 200), all with frontend tree 6851be1471d706593b43d6a844fe4d815c4aeb4d.
  - Every screenshot hash matches its JSON; zero overflow; zero targets under 44 px.
  - Manifest, built as in ASSESS-QUESTION-004 §10 over the `workspace-question-*`, `workspace-institution-*`, `workspace-room-transfer-*` and `workspace-complete-results-*` captures: SHA-256 2705bbe681110fb241baa47ec16c8f7b78e39653b64037c7a94454a857f5f7dc.
- **CI-first order:** as frozen in §7. This registration is step 1. No re-runs without the Owner's authorization naming the run, and no push while the previous commit's CI runs.
- **Status:** BLOCKED → IN_PROGRESS. Counters: DONE 19, IN_PROGRESS 1, VERIFYING 0, BLOCKED 13.
