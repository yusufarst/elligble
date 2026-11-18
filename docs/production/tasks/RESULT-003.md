# RESULT-003 — Teacher publication and Student own finalized score

## 1. Control state and authority

| Field | Disposition |
|---|---|
| Classification | Active P11 Task; P1 / result delivery; HIGH risk; R27, R26; P8 V09, V11, V12 |
| Status | **VERIFYING under DEC-048: implementation candidate (§11); formal READY PASS (§10), RP-1/RP-2 and original STOP → PASS (§9) preserved. Exact-content CI and designated implementation/rendered review pending** |
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

## 11. Implementation and controlled continuity — 2026-11-14

### 11.1 Activation and preserved history

GOV-EXEC-003 effective: approved manifest f409aa92f1179af2b1919a80655a708a7f90eea9f230ce7453f2ee9f41f63bf7; content 8f1c02a7b249c2f0f78b62d799d86fa199ed6625 / CI #267 (43597727336); sole record-only evidence 368ef9e117e64a4c2538ece45da6db0ab973242f / exact PR-head CI #268 (43601358663); PR #41 squash main 0144d6a317cb7964ed94e335c0535a9b42e32fb2 / exact-main CI #269 (43604483479). Each automatic run: attempt 1, eight SUCCESS. Main/PR-head tree 26691b3a7519f65723323daab2d054a0404db598; Owner author, expected committer, explicit raw message/no-attribution checked. Exact-main PASS observed 2026-11-14 22:01 WIB, before baseline edits.

Registration 152a4b365de52f3e334c0d273ab88c7433bf8dd4 / CI #266 (43191912009), attempt 1 eight SUCCESS, and sixteen partial paths were preserved. No repeated contract, formal READY, Build or accepted review. RP-1/RP-2, §9 STOP/PASS exact hashes, nineteen frozen paths, 0066 and baseline manifest remain unchanged. Normal merge 0358f8d899f98b06bf97b42700b767707a0968e7 integrated published governance, resolving only additive live-plan/manifest checkpoint conflicts; Owner author/committer/raw message checked. Main checkout 056a154d4ae2eb9c5a7c7923c6737496f396990d retains its four dirty paths, and all other worktrees including RESULT-004's untracked nul remain preserved.

The Owner designated REVIEW-RESULT-003-CODEX-01, a separate fresh-context read-only reviewer, for implementation, actual rendered evidence and corrections. Its readiness reconstruction is complete; no candidate verdict is claimed. Original fulfilled RP-2/O05 authority and every prior verdict remain preserved; this designation grants no new §8 authority.

### 11.2 Implementation and verification

- Continue the preserved ledger/state machine/routes/metrics/Teacher projections/shared reveal/dialog/Student card implementation; complete the remaining real-PostgreSQL test, 99m journey and decision pointer. No scoring, grading, finalization, dependency, shared helper or older test rewrite; route-parity adds only the two calls.
- Engineering detail P-3/R6: temporarily hand the SAME TM teaching assignment to T2 for actor-only action-key reuse, then restore T1 in finally. An unauthorized Teacher would stop at 403 and not prove actor/digest reuse.
- Real PostgreSQL coverage: P-1–P-7, S-1–S-5, I-1–I-4/applicable N-ids and exact frozen values, before/after write invariants, K-1–K-4 real locks/snapshot with 5 s bounds, T-1/T-2 append-only/order/key/FK/frozen-source tampering, X-1 export digest, M-1 populated 0001–0065 upgrade/rollback/idempotence. Typechecked locally; execution is CI-only and not yet PASS.
- 99m uses shared navigation and the final 99l capture algorithm unchanged except prefix/Task ID (E13). Five conceptual scenarios contain six capture states: published Student masked/revealed are one scenario. Six states × ten frozen conditions × five browser projects = 300 new PNG/JSON pairs. Three synthetic participants yield 90/55/ABSENT. Fixture SQL opens the window and ends only overlapping earlier fixture exams. Teacher uses in-app actions; Student reloadPage only while idle. No local E2E or rendered PASS.
- Existing #265 baseline revalidated read-only: 4400 pairs; five ZIP sizes/GitHub digests, every PNG hash, commit/tree, overflow/target checks and unchanged manifest 2705bbe681110fb241baa47ec16c8f7b78e39653b64037c7a94454a857f5f7dc. Baseline provenance is not new visual quality.
- Installed react-typescript-vite skill verified SHA-256 450285288fba41f497991f074f100a43ed2d714e51818caae3294663e5ccd558. Repository/locked components remain authoritative.
- Local checks: runtime, web and E2E typechecks PASS; runtime publication/route-parity/metrics units 17/17 PASS; corrected publication web suite including CSV 12/12 PASS. Initial new test queried an intentionally aria-hidden background during a modal; corrected only that assertion with hidden:true, retaining modal accessibility and non-optimistic behavior. A root-directory npm exec invocation resolved no web alias and ran no tests; correct npm --prefix frontend/web test passes. New browser helper arguments corrected to the existing zero-based index API.
- Full regression/PostgreSQL/browser CI, exact-content independent implementation/security and rendered review, Delegated Acceptance, sole record-only evidence commit, exact PR-head CI, squash and exact-main CI remain pending. No rerun/cancel/dispatch, gate weakening, production or real data action.

### 11.3 Named prior evidence exception

The preserved prior-executor note dated 2026-11-12 records Owner response "Terima, catat (Recommended)" for the named RESULT-004 f15fa1f10da113a6514f9b918cb3ea639c151ef0 four-file evidence exception, to annotate at the next RESULT-003 change. Note SHA-256 8c77043ee359be5140197412c4d1ebc00d7d5bb0e92955528f0a6b641f6ef648. Preserve that reported acceptance/provenance without history rewrite or a standing exception. The local note alone does not authenticate the original chat; no new RESULT-003 gate relies on it.

### 11.4 Current checkpoint

IN_PROGRESS → VERIFYING; DONE 19/33 (57.58%), VERIFYING 1, BLOCKED 13; 33 IDs/78 edges unchanged. Production NO-GO, PB05/PB12 OPEN. Next: genuine candidate automatic exact-content CI, then the same designated reviewer after eight SUCCESS attempt 1.

### 11.5 CI #270 bounded corrections

Exact-content 80a7a6b31e24d8cce5d387acfbd74ecb4003da3b / automatic CI #270 (43611352739), attempt 1: FAILURE. Web 538 PASS/3 FAIL; Runtime PostgreSQL 404 PASS/1 FAIL, no skipped integration tests. Container and the browser matrix were skipped by dependency gating, not passed. Run retained without rerun/cancel/dispatch.

- The three Web failures assumed device WIB. The new test now explicitly sets fixture school Asia/Jakarta and restores it after each case; every original exact date/time/copy assertion remains. Focused publication suite under TZ=UTC: 12/12 PASS.
- PostgreSQL rejected the new fixture's literal display letter as invalid_answer_payload. Production builders generate opaque option IDs; the new fixture now resolves each display letter from its own frozen snapshot before saving, including the source-tamper vector. Exact 90/55/33.33/100/ABSENT outcomes and production validation remain unchanged. Migration M-1 is not replaced or weakened. No product source change.
- Next candidate is a genuine bounded test correction; no push while #270 was active. Full automatic CI and independent review remain pending.

### 11.6 CI #271 bounded corrections

Exact-content 349baf80020f1035e9627d93e8c4ebdd1307c062 / automatic CI #271 (43611864288), attempt 1: Web SUCCESS, Runtime FAILURE; PostgreSQL 418 PASS and two failed subtests plus their parent (421 counted), zero skipped. Container/browser dependency skips are not PASS. Run preserved without rerun/cancellation. Publication/withdrawal/replay, exact own/ABSENT/tenant/subject values, role denials, all four actual lock/snapshot races, append-only/frozen tamper and migration upgrade/rollback/idempotence PASS.

- N10 exposed a real route defect: the shared Origin predicate normally checks unsafe methods, so GET my-results accepted an untrusted Origin. The route now applies that unchanged predicate to a method/headers view before authenticated database access, leaving the real request and every other route unchanged. Same host/explicitly allowed origins retain the approved policy; absent Origin remains supported for credentialed clients. The original 403/no-write negative stays intact.
- X-1's test incorrectly included the established export envelope in its GET projection comparison. It now separates audit/format/issuedAt as the existing permission-enforcement test does, compares the COMPLETE remaining projection exactly with GET, and additionally verifies the stored audit result_digest against permissionDigest(projection). Exact participant/CSV/digest refusal assertions remain.
- Genuine bounded source/test correction inside the frozen allowlist. Next automatic exact-SHA CI required. No independent verdict, acceptance or release PASS claimed. Runtime has failed twice; a third failed gate must escalate under 00.13 §5.6/§8.

### 11.7 CI #272 and approved test synchronization correction

Exact-content f519a145600d18195ab25d9eac0879f624af36ef / CI #272 (43612473255), automatic push attempt 1: FAILURE preserved. Runtime/PostgreSQL, Web and Container SUCCESS; all 421 PostgreSQL integration checks PASS, zero skipped, including forbidden Origin and complete export projection/digest. Five browser jobs failed only the new 99m journey at initial Buat Ujian navigation; the failure snapshot shows guru.e2e still on Monitoring Ujian with Pelaksanaan Ujian available. The login helper returns before capability navigation settles, so the immediate isVisible condition skipped navigation. Earlier suites remained passing. Runtime's next gate PASSED; the prior two Runtime failures did not recur.

The Owner expressly approved replacing this one conditional navigation line with an auto-waiting click. Only that line changes in 99m, matching the established 99l navigation; all assertions, scenarios, captures, helpers and timeouts stay unchanged. No rerun/cancel/dispatch of #272; next publication is a genuine correction SHA. Focused publication/route-parity tests: 12/12 PASS on f519a14. E2E typecheck verifies the correction; browser execution remains CI-only. Independent exact-content/rendered review, acceptance and landing gates remain pending.

### 11.8 CI #273 and bounded journey sequencing corrections

Exact-content e6e55fdca64436b8aa7ac8c229203f7b5c33e332 / automatic CI #273 (43630843598), attempt 1: FAILURE retained. Runtime/PostgreSQL, Web and Container SUCCESS; all five browser jobs fail only new 99m at the disabled Periksa Lagi action, with 43 earlier journeys passing in each project. The failure snapshots show all seven participants checked. The immediate checkbox .all() ran before the participant list loaded, so its loop selected nobody; the later three check() calls were no-ops against already checked defaults. The first navigation correction worked. No rerun, cancellation or dispatch.

Within the frozen 99m path, await visibility of the first fixture participant before enumerating, as established by 99f, and assert exactly three checked participants before rechecking. Retain every existing assertion, capture, timeout and helper. A source-backed sequencing check also found that submission leaves ?attemptId in the URL (App.tsx:88-89); reloading that URL re-enters AttemptLaunch rather than the assigned-exam list. After the existing successful submission assertion, click the existing Kembali ke Jadwal Ujian action (StudentExamWorkstation.tsx:742) and await the assignment card before the later frozen reload checks. This route issue was not reached by #273; it is recorded as source-derived, not a CI finding. Four added test lines, no product/source/helper change, no new scenario or weakened oracle. E2E typecheck PASS. The Owner's approval expressly covers routine in-scope corrections under DEC-048. Browser gate has failed twice; a third consecutive failure requires escalation under 00.13 §5.6/§8.

### 11.9 CI #274 material blocker and Owner escalation (uncommitted checkpoint)

Exact-content 8c75003dadc4c6a4072319350bf06430b37828b5 / automatic CI #274 (43634530157), attempt 1, completed FAILURE. Runtime/PostgreSQL, Web, Container, mobile-360, tablet-768, desktop-1280 and firefox-1280 SUCCESS. WebKit job 132569281516 failed in new 99m during Student reload after publication: page.evaluate: Target crashed; 43 earlier journeys passed. The log identifies studentList and the post-publication reload. This is a browser target crash; its underlying cause is not established, and no product defect or infrastructure cause is invented. Seven SUCCESS jobs are not relabelled as a full PASS.

WebKit has failed on #272, #273 and #274, so the mandatory 00.13 §5.6 bound and §8 stop apply. No further publication, CI rerun, acceptance, PR or merge. Existing fixes and SHA retained. The requested one-line navigation correction and subsequent in-scope sequencing corrections are already published, with the successful four-browser journeys on this exact SHA. Independent implementation/rendered review has not begun because eight-job CI is unmet.

Proposed Owner decision: authorize exactly one diagnostic rerun of only WebKit job 132569281516 in run 43634530157 / CI #274, same SHA 8c75003dadc4c6a4072319350bf06430b37828b5, as attempt 2; retain attempt-1 FAILURE and all seven successful jobs. This named exception requires explicit Owner authorization under TOOLCHAIN §2 and DEC-048 §5.3/§5.6/§8. Do not manufacture a new SHA or edit tests to retry a crash. If another failure occurs, preserve and escalate again. Subsequent final-content/rendered review, evidence-only publication, exact PR-head and exact-main CI remain mandatory. No delegation/gate waiver or production action.

At verification resumed 2026-11-15 09:38 WIB, the 08:00 WIB deadline had elapsed. The former local monitor/download sessions were unavailable; no matching task monitor/download process was found, and four partial ZIPs were zero bytes. No download completion or visual validation is claimed. Logs and exact terminal run state are saved externally. Current state: VERIFYING with a material Owner-decision blocker, DONE 19/33 (57.58%), VERIFYING 1, BLOCKED 13; PB05/PB12 OPEN, production NO-GO. This checkpoint stays uncommitted until an authorized genuine correction or later evidence publication; it is not the sole final evidence commit.

### 11.10 Owner-authorized diagnostic attempt 2

The Owner explicitly authorizes ONE diagnostic rerun of failed WebKit job 132569281516 only, run 43634530157 / #274, same SHA 8c75003dadc4c6a4072319350bf06430b37828b5, attempt 2 only. Preserve attempt-1 FAILURE and the seven SUCCESS jobs; no code change or other-job rerun, no further rerun without authorization, no automatic merge approval. Mandatory independent review, evidence and merge gates remain. This resolves only the named diagnostic stop, not acceptance or the root cause.

Before the single POST to the named job rerun endpoint, full attempt-1 run/jobs and exact SHA were verified and preserved externally. Request accepted at 2026-11-15 09:43 WIB. Actual rerun WebKit job is 132675043884. GitHub assigns new metadata IDs to all jobs in attempt 2; the seven reused SUCCESS jobs retain their exact original execution/step timestamps, confirming they were not rerun. Only WebKit has a new execution start, 2026-11-15 09:43:56 WIB. Result pending; code remains at the same SHA. A diagnostic PASS alone does not establish a precise crash cause or permit merge.

### 11.11 Authorized diagnostic outcome: attempt 2 FAILURE

CI #274/run 43634530157, exact SHA 8c75003dadc4c6a4072319350bf06430b37828b5, WebKit diagnostic job 132675043884, attempt 2: FAILURE, completed 2026-11-15 10:18:54 WIB. 43 earlier journeys PASS; only new 99m FAIL. The same original seven SUCCESS executions remain unchanged (exact step/start/end timestamps checked despite cloned attempt-2 metadata IDs). Attempt-1 FAILURE and full evidence remain preserved. Exactly one named rerun was initiated; no code modification, other-job execution or additional rerun.

Precise evidence: the native browser target becomes unreadable with page.evaluate: Target crashed during studentList at 99m:341, called from the first post-publication Student reload at :371, matching attempt 1. Publication returned HTTP 200; the trace/server log also contains successful my-results reads before this transition. No native crash stack, OOM kill, signal or allocation-error evidence is present in the captured job log. Therefore a random transient environment failure is not established. The failure is reproducible in the WebKit/test interaction on this exact flow; the available evidence does not distinguish a WebKit engine/runner/resource cause from an implementation-triggered engine defect. No claim of a proven product or infrastructure root cause.

Smallest proposed test correction, NOT APPLIED: await p.bringToFront() immediately before the existing reloadPage(p) in studentList, following the explicit page-activation pattern already used by 99l. This changes only which existing page is active before reload; all document-replacement, HTTP, privacy, score, focus and capture assertions remain. It is an unverified hypothesis to isolate the page-activation interaction, not a proven cure or acceptance. Proposed one-line patch saved externally as proposed-webkit-foreground.diff. A genuine corrected SHA/full CI would require an Owner decision resolving the repeated-gate stop; no further rerun of #274 is authorized. If native crash persists, obtain engine/resource evidence rather than weakening or hiding the failure.

STOP at DEC-048 §5.6/§8. No independent final-content/rendered PASS, acceptance, PR or merge. Source code/HEAD unchanged; only this Task-record evidence is uncommitted. No deadline or release gate waiver.

### 11.12 Owner-conditional foreground correction: local gate PASS

The Owner explicitly approved testing await p.bringToFront() immediately before reloadPage(p), with this condition: first run only focused WebKit 99m locally; commit/push the minimal correction and continue automatic new-SHA CI/review only if it passes; otherwise no hypothesis commit/push. No additional rerun of #274 is authorized. This supplies the bounded correction decision after §11.11. The direct Owner instruction permits this one focused local E2E execution despite the prior CI-only workstation rule; it does not authorize a full local suite or relax any CI/review/release gate.

Local gate PASS on 2026-11-15 at 10:38 WIB: 1/1 WebKit 99m, one worker, zero retries, zero skips, 301485.74 ms; all assertions retained. Sixty local PNG/JSON pairs produced with matching screenshot hashes. E2E typecheck PASS. Working-tree test SHA-256 LF 7a277cc839a522665cfb9d8ca2e173e66ea01a7f097c27345b6903b221a8cb62; committed parent remains 8c75003 until publication. The only test change is the approved foreground line. This is local working-tree evidence, not an exact committed-SHA CI or independent rendered verdict.

Environment/provenance: Windows, pinned Playwright 1.56.1 / WebKit 26.0 build 2215, actual built web client and production-wired server, isolated PostgreSQL 16 disposable container, no real data. A temporary external config selected only 99m and reused the unchanged canonical setup/teardown. Its external bootstrap activated five synthetic accounts through the real activation API and restored the synthetic Teacher/Proctor capability needed for the existing navigation; it did not execute the 43 completed prior journeys or modify repository helpers/config/setup. It uses the fresh six-Student base fixture rather than accumulated CI history. The disposable database/server were cleaned by canonical teardown and the task-labelled container stopped; unrelated Docker containers were untouched. Bootstrap, JSON report, trace policy, hashes and local capture index retained externally in local-webkit-99m/verification.json.

Interpretation: foreground activation passes the complete focused local journey, including the prior crash transition, but Windows/fresh-history differences mean this does not establish the native crash cause or guarantee Ubuntu CI. Preserve #274 attempts 1 and 2 as FAILED and the seven successful original executions. Next: publish this genuine one-line correction plus Task-record evidence only, require automatic complete new-SHA CI and the same independent implementation/rendered reviewer before acceptance, PR/evidence/merge gates. No attempt 3 or source/expectation change beyond the approved line.

### 11.13 CI #275: local PASS did not resolve Ubuntu WebKit failure

Exact-content 9786dda18290209957d446e8492891bfbe42916f / automatic CI #275 (43673357859), attempt 1: FAILURE. Runtime/PostgreSQL, Web, Container, mobile-360, tablet-768, desktop-1280 and firefox-1280 SUCCESS. WebKit job 132688810666: 43 earlier journeys PASS, new 99m FAIL. Exact trace: Bring to front completed at relative 68.6 s, duration 0; the following Reload failed after 17 s with page.reload: Page crashed, through unchanged helpers.ts:247 / studentList at 99m:342, called at :372. Publication POST returned HTTP 200. Captured logs contain no native stack, OOM-kill, signal or allocation-error proof. These facts rule out treating foreground activation as a verified Ubuntu cure; they do not establish the precise native engine/resource or application-triggered cause.

The Owner condition was followed: the focused Windows test passed before commit/push, with all assertions preserved. The one-line hypothesis remains published as 9786dda; no history rewrite, rollback, additional code change or rerun. Both #274 failed attempts and seven original successful jobs remain retained. #275 has not been rerun. The repeated WebKit gate remains a material STOP under 00.13 §5.6/§8, pending an Owner decision; no final-content/rendered review, Delegated Acceptance, PR or merge.

Next root-cause investigation proposed, not executed: one focused local Ubuntu 24.04/Linux WebKit 99m run with the same Playwright 1.56.1 pin and unchanged current test, disposable synthetic PostgreSQL, browser native stderr/debug and process/cgroup memory/OOM evidence. This separates the Windows-versus-Linux variable before another speculative code change. No preceding 43 journeys, global helper/workflow edit, test skip, retry, assertion weakening, production data or new CI rerun. If a cold Linux run passes, the accumulated prior-suite state/resource history remains a separate unproven variable; do not call that a fix. No further correction is proven at this checkpoint.

Four #275 successful-browser visual archives are available locally with original GitHub size/SHA-256 and unzip-test PASS. Direct artifact transport was slow; the authenticated GitHub connector supplied the same archive bytes, curl resumed the existing partial Tablet ZIP, and every final digest matched GitHub before extraction. This is artifact-provenance evidence only, not independent visual PASS or replacement for the failed WebKit gate. No changes to the approved baseline or test gates. Current state remains VERIFYING, DONE 19/33 (57.58%), production NO-GO.

### 11.14 One Owner-authorized focused Ubuntu diagnosis: native assertion reproduced

The Owner authorized exactly one focused local Ubuntu 24.04 WebKit 99m diagnosis at preserved HEAD 9786dda, capturing native stderr/exit and available memory/OOM evidence, with no production-code modification, assertion weakening, commit, push or CI. Ubuntu was available in the existing cached image mcr.microsoft.com/playwright:v1.64.1-noble (Ubuntu 24.04.5 / Node 24.21.0). Its newer bundled browser was not used: repository lockfile dependencies and pinned Playwright 1.56.1 / WebKit 26.0 build 2215 were restored into the temporary diagnostic filesystem. No OS, daemon or new image was installed or pulled. The repository was exported from exact HEAD into an isolated temporary snapshot; test source equality was checked. The same external focused bootstrap recreated five activated synthetic accounts and Teacher/Proctor capability; no prior 43 journeys were executed. Existing built web assets were reused; production sources remained untouched.

Result: ONE test, one worker, no retries, no skips: FAILED, test/container exit 1. Report duration 793111.34 ms including setup/teardown, test-result duration 701287 ms. Same transition as CI #275: helpers.ts:235/247 -> studentList at 99m:342 -> first post-publication Student reload at :372. Thirty Teacher capture states/conditions completed before failure; no Student result capture completed. Local helper ended with the replacement-document poll pending, while native stderr recorded a libstdc++ std::optional<unsigned long>::_M_get assertion (this->_M_is_engaged), followed by WPEWebProcess errors that the UI-process connection closed. The top browser-launcher process later exited 0 during graceful test cleanup; that is not a successful test or proof that its child processes did not fail. Complete native calling stack/exact WebKit function is unavailable.

Memory evidence: isolated diagnostic cap 2304 MiB (2.25 GiB), 2 CPU and 1 GiB shm, within the existing Docker VM's approximately 3.42 GiB total memory. Cgroup peak reached the cap; max-charge events 1132, but oom=0, oom_kill=0, oom_group_kill=0; Docker State.OOMKilled=false. PIDs were unlimited and pids max events=0. Native Mesa/Zink/EGL warnings also occurred during earlier successful steps, so they alone are not identified as the cause. Local resource limits/kernel/library image are not proven identical to CI. Pressure could expose an engine lifecycle defect, but an OS OOM kill is not supported by this run.

Comparison/conclusion: the Linux failure reproduces without the preceding 43 journeys, so that history is not required for this local reproduction. The boundary matches CI #275's post-publication reload crash; CI did not capture the native assertion, so identical underlying native cause there remains unproven. Evidence points to the pinned Linux WebKit/WPE native lifecycle interaction, possibly resource-pressure-sensitive, rather than an established HTTP/scoring/authorization failure. It does not justify calling the event a random transient or claiming a fully proven native root cause.

Smallest proposed mitigation for verification, NOT APPLIED: defer the currently unused Operator browser context/page until just before its negative authorization checks. This reduces simultaneous contexts at the failing reload from five to four while retaining separate role sessions, every original assertion and all scenarios. It is a targeted lifecycle/resource hypothesis, not a proven cure. The two-site test-only diff is retained as linux-webkit-99m/proposed-defer-operator.diff; git apply --check PASS, no application to the repository. Any verification of that change requires a new Owner decision after this one-run diagnostic authorization; no second test, rerun, commit, push or CI was initiated.

Evidence retained under linux-webkit-99m/: test.log with native stderr, result.json, trace ZIP/hash, resources-before/after.log, one-second memory-timeline.log, resource-constraints.log, container state/exit status, exact source snapshot, preparation/version proof and diagnostic-summary.json. Synthetic bootstrap workdir copied out before removing the task-labelled temporary containers; existing unrelated containers were untouched. HEAD remains 9786dda18290209957d446e8492891bfbe42916f; only this Task-record evidence is uncommitted. Mandatory review/acceptance/merge gates remain unmet; production NO-GO.

### 11.15 Owner-authorized deferred Operator mitigation: preflight STOP (2026-11-16 12:48 WIB)

Owner authorized moving Operator tab creation immediately before its existing permission assertion, preserving every assertion, role check and cleanup, followed by two focused Ubuntu WebKit tests under unchanged pins/resource limits without retries. The minimal two-site test-only change is applied but UNCOMMITTED. HEAD remains 9786dda18290209957d446e8492891bfbe42916f.

The first launcher exited 1 during its dependency preflight: Cannot find module /work/e2e/node_modules/@playwright/test. The reused temporary dependency mount was unavailable. The test itself did NOT start: test-started.marker, test.log and result.json are absent. Thus there is no PASS/FAIL verdict for the modified 99m, no new native crash evidence, and no evidence that this mitigation fixes the prior crash. The second test was not started.

Automatic approval review rejected restoring the pinned dependencies and relaunching the first test because it interpreted this as exceeding the Owner's stop/no-retry condition. That rejected command was not executed; no alternative launch or workaround was attempted. Explicit Owner authorization is required to restore lockfile dependencies and start two fresh tests without retries after this preflight failure.

Evidence: temporary gov-exec-003/linux-webkit-mitigation/run-1/preflight-failure.log, preflight-state.json and test-not-started.json. The exited diagnostic container is retained; the task-labelled temporary PostgreSQL container was stopped, and no labelled diagnostic containers remain running. No commit, push, CI trigger, rerun, production-code change or formal review was performed. CI #274 both failed attempts and CI #275 attempt 1 remain preserved. Production NO-GO; all mandatory gates remain outstanding.

### 11.16 Owner-authorized dependency recovery and mitigation test STOP (2026-11-16 13:05 WIB)

Owner explicitly superseded the previous stop only for the missing-dependency prerequisite where 99m never started, authorized lockfile/package-manager recovery, then exactly two fresh focused Ubuntu WebKit executions with zero retries unless the first fails. The prior automatic review refusal remains preserved in section 11.15 and LIVE-HANDOFF; the newly authorized recovery command passed automatic approval review. No substantive review STOP was bypassed and no formal independent Task review is claimed.

Dependency recovery PASS: npm ci for the same five packages, exit 0; SHA-256 checks for all five package.json/package-lock.json pairs unchanged. Pinned Playwright 1.56.1, WebKit build 2215, Node24.21.0 and the existing Ubuntu24.04 image/cache retained. No lockfile, dependency-version or production-code change. The approved uncommitted Operator-tab deferral remains the only test source change; source snapshot and working test byte hashes matched before invocation.

FIRST actual focused test FAILED: one test, one worker, retries0, expected0/unexpected1/flaky0/skipped0; test/container exit1, report duration254532.149ms including setup/teardown. The first post-publication Student reload again failed its replacement-document assertion (pending:true): helpers235/247 -> studentList342 -> caller372. Thirty Teacher scenario captures completed; no Student result capture completed. Native stderr again recorded std::optional<unsigned long>::_M_get assertion this->_M_is_engaged(). This mitigation did not prevent the failure. Exact native calling stack and a causal memory explanation remain unproven.

Unchanged diagnostic limits:2304MiB,2CPU,1GiBshm; synthetic PostgreSQL256MiB,1CPU,64MiBshm/tmpfs512MiB. Memory peak reached2415919104bytes; max-charge events2733, oom0/oom_kill0/oom_group_kill0; DockerOOMKilled=false. Same failure boundary as CI275, whose native stack was unavailable; identical native cause on CI remains unproven. No random-transient or resolved-root-cause claim.

STOP followed: second test NEVER started. No commit/push/CI/rerun/PR/merge/formal review. HEAD9786dda18290209957d446e8492891bfbe42916f unchanged; prior CI274 both failures and CI275 attempt1 preserved. Task-labelled PostgreSQL stopped; no diagnostic containers remain running, exited evidence containers retained. Evidence: temporary gov-exec-003/linux-webkit-mitigation/recovery.log, lockfiles-before.sha256, lockfiles-verified.log, recovery-versions.json, recovery-owner-authorization.txt, recovery-container-state.json; recovery-run-1/test.log, result.json, diagnostic-summary.json, resource snapshots/timeline, container state/constraints/log and trace ZIP with SHA-256. Further diagnostic execution requires a new Owner decision. Production NO-GO; mandatory Task gates remain unmet.

### 11.17 Owner-approved RESULT-003 toolchain exception (2026-11-16)

Under DEC-048 §§5.2 and 7, the Owner added exactly e2e/package.json, e2e/package-lock.json and docs/production/TOOLCHAIN.md (verified versions/evidence only) to this Task's frozen scope. No second Task. Pin @playwright/test to 1.57.0 and verify its bundled WebKit 2227. Preserve all existing assertions, mitigation, historical evidence, workflow and independent gates. One focused Ubuntu WebKit 99m execution, zero retries. A failure stops publication; a pass permits the previously authorized controlled commit/push, automatic eight-job CI and subsequent gated review and landing. Stop on any failed gate. No CI reruns or unrelated upgrades.

Verified the package-lock-only update changes the direct pin and exactly three npm package entries (@playwright/test, playwright, playwright-core), all at 1.57.0. Related upstream evidence: WebKit PR 53102 (c69ce8c) and Playwright issue 37766. Ubuntu 24.04 bundle verified as WebKit 26.0 revision 2227. Focused 99m PASS once at 2304 MiB/2 CPUs/1 GiB shm, one worker, retries 0, 60 captures, expected 1, unexpected/flaky/skipped 0, exit 0; report duration 408184 ms including setup/teardown. The prior post-publication Student reload completed. The snapshot matched the candidate test, package manifest and lockfile byte-for-byte. This local result does not replace CI or rendered review. Prior failures retained. Evidence: result003-pw157/run/{verified-bundle.json,versions.log,test.log,result.json,container-state.json,test-results}. The previously authorized Operator-tab deferral is preserved in the candidate; all assertions and cleanup are unchanged.

RESULT-003 STOP, 2026-11-16 16:28 WIB. Exact candidate e58d0f7ea973bab47d4a24e752456cac55281953, automatic push CI #276 run 43833499145: all eight jobs SUCCESS on attempt 1, including WebKit. C08 is independently checkable from the candidate tablet-768 artifact 14210089772, SHA256 95174991d0ce2df9e8c9706e7997baa9f521236dbe740d108ad2d6d777e84b22. Archive digest and commit field of all 60 RESULT-003 JSON records verified. All ten student-published-masked and all ten student-withdrawn records have metrics.focus.tag=BODY, violating the explicit C08 focus criterion (Task section 7). The focused Ubuntu WebKit artifacts show the same twenty cases. C08 FAIL; this is not an independent reviewer verdict. No further code changes, CI reruns, formal review verdict, evidence commit, PR or merge. Preserve original failures. Evidence index: result003-pw157/ci276-tablet-focus.json. Owner decision on bounded focus correction is next.

### 11.18 Owner-authorized C08 focus correction

CI #276 remains SUCCESS (8/8, attempt 1) at e58d0f7. Following its C08 BODY-focus finding, the Owner authorized a correction within the existing allowlist. AssignedExamDiscovery applies its existing page-title focus behavior after normal finalized-result success and successful retry only when the active element is BODY or documentElement. Failed retries keep the existing retry control. Regression coverage exercises deferred normal loading and preservation of an already focused control. Existing assertions, Playwright version and C08 criteria are preserved. Local verification: resultPublication and assignedExamDiscovery 25/25 PASS; web typecheck PASS. Candidate CI, exact-SHA rendered evidence and independent review remain required.

### 11.19 Exact-content verification and independent rendered STOP (2026-11-16)

Candidate f680d71c7700e4ff9b9fc8d8d88d330528d9cdf1 / frontend tree f246958208d7fce90bd80a60672011aa787085d3. Automatic push CI #277/run43842687007 completed with all eight jobs SUCCESS on attempt1. Secure-assessment units1034 and real PostgreSQL421 PASS, zero fail/skip; Web542 tests across52 files PASS. CI276 remains SUCCESS at its original e58d0f7 SHA. No workflow was rerun.

Five candidate visual archives passed GitHub size/SHA-256 and unzip validation. 4700 PNG/JSON pairs:4400 baseline comparisons and300 new pairs (60 per project). Candidate manifest SHA256 9881f3fa6f40df2e254a84709c67447fb21d59cf34d1d7eaeb6e39d8f0f8561e. All300 new metadata records meet overflow/target/font-calibration/restoration/focus checks; focus150H1/100BUTTON/50TEXTAREA, no BODY. Thus the Owner-authorized normal-load focus correction is verified. Metadata PASS does not discharge actual rendered review. Legacy comparison:705 pixel-identical,3695 changed,728 dimension changes; deltas are not all accepted.

Designated independent reviewer REVIEW-RESULT-003-CODEX-01 retained its context and issued STOP on exact f680d71 at22:54WIB. Report: temporary gov-exec-003/REVIEW-RESULT-003-CODEX-01/review-f680d71-STOP.md, SHA256 5f0332eed8a13b9060e0c85da7e12f5da182671826b75d75363b747c46c0b5f7; supporting material-evidence.json and new-capture-audit.json. Executor verified the report hash and both material findings against actual PNGs:

- R1: baseline265 legacy Desktop teacher-preview-mr-key,1280x800,text2 is1280x6081; candidate277 is1280x1915 with visibly different text scale/layout. Target Soal1 changes176x176 to88x88. This exceeds time/ID and section4.7 exceptions. The older spec and relevant preview source are unchanged; exact cause and legitimate comparison reconciliation remain unproven. Baseline265 remains immutable. No production-source fix is established by this finding.
- R2: WebKit390x844,text2 Student published-masked and published-revealed PNGs share SHA256 f7ab14877cb9ba8fd44f5a3b91567bbfa052235611e0885aaa5a718e90f35474. Both viewport-fallback images show earlier cards, not the target masked value or90. DOM/AX metadata describes the correct target but these images do not visually prove the required states. Reframing after calibration needs a narrow Owner exception to E13's verbatim capture freeze, preserving every security/value/role/privacy assertion and all required conditions.

C08 and consequently C10/Delegated Acceptance remain unmet. No final evidence commit, acceptance, PR or merge. STOP requires Owner direction for the narrow E13 exception and R1 reconciliation, followed by the same reviewer's closure on genuine corrected evidence. No new tests or CI are authorized by this record. All historical reviews, Owner approvals, failures, frozen contract and unrelated worktrees retained. Baseline19/33DONE57.58%,1VERIFYING13BLOCKED; PB05/PB12OPEN; productionNO-GO.

### 11.20 Owner-approved limited E13 exception and prerequisite reconciliation (2026-11-16)

Owner explicitly approved a narrow exception to E13 for 99m Student capture positioning only: place the intended Student card in the viewport AFTER 200% text calibration and BEFORE screenshot capture. Preserve all original capture assertions, integrity checks, conditions, screenshots and privacy checks, and keep the 99l suite unchanged. Modify only existing RESULT-003 allowed paths. First reconcile R1 from existing baseline/current PNG and metadata (fullPage, dimensions, text calibration, browser revision, layout). If R1 remains unexplained or R2 requires weakening evidence, STOP before push. Only otherwise: focused verification, one genuine correction, automatic eight-job CI, and R1/R2/final C08 re-review by the same independent reviewer. No CI reruns, test weakening, merge or new Task. This exception does not waive C08 or accept unexplained baseline deltas.

Read-only R1 audit retained in temporary gov-exec-003/R1-existing-reconciliation.json (ten paired conditions across five projects). Baseline265 vs candidate277 teacher-preview-mr-key at1280x800: all100% Chromium captures1280x1001 and Soal1 44x44. At text2, baseline Desktop6081px/176x176 vs candidate1915px/88x88; Mobile reverses from1915/88 to6081/176; Tablet stays6081/176. All fullPage=true. Firefox stays1909px/88x88; WebKit stays14139 devicepx/88x88 CSS. Chromium141 baseline and Chromium143 candidate each show both scaling regimes. Existing CI275 Desktop PNG already1915/88 at Chromium141, SHA9786dda, so the discrepancy predates the 1.57 upgrade. Older-spec, TeacherExamPreviewView, globals.css, design-tokens.css and App.tsx blobs match baseline exactly.

Legacy metadata labels textScale2 and its calibration method but does not retain original computed-font samples/root font or measured final ratios. The legacy capture reads computed values and mutates inline styles sequentially, allowing inheritance/rem-dependent values to change before later reads. This is a calibration concern, but existing evidence has not established the cause of the observed scale flip or reconciled all unexplained deltas. No R2 positioning change, test, commit, push or new CI has been performed during this reconciliation. Original STOP R1/R2 and CI277 SUCCESS remain preserved; the same reviewer is checking this audit.

Same independent reviewer confirmed the reconciliation on unchanged f680d71: R1 remains OPEN/STOP. Existing evidence isolates a pre-existing 200% instrumentation anomaly but does not establish the scale-flip mechanism or meet C08. The explicit Owner condition therefore applies: STOP before push. R2 code remains unchanged, with no new verification execution or publication. Missing evidence is the original root/computed-font values, actual scaled ratios and restoration state per legacy variant; collecting new runtime evidence requires a separate Owner authorization. Do not replace baseline265 or weaken C08. Continue with the same review context after an authorized resolution.


### 11.21 Owner-approved exact final C08 resolution (2026-11-17)

Owner explicitly approved manifest SHA256 ae033ab0b9e679d221708e917de3586fe565165193a34d86a91d82b91addb068, conditional on exact local verification. The manifest, all three payload file hashes, preserved historical review, fourteen source anchors and pre-existing Task record were verified before execution. Proposal review PASS by the SAME REVIEW-RESULT-003-CODEX-01 confirms necessity/bounds only; actual R1/R2 remain OPEN/STOP until final implementation/rendered re-review.

Approved payload manifest (LF-normalized):
```json
{
  "task": "RESULT-003",
  "purpose": "Exact Owner-approval package for bounded C08 R1+R2 resolution",
  "status": "PENDING_ONE_EXPLICIT_OWNER_DECISION",
  "candidate": "f680d71c7700e4ff9b9fc8d8d88d330528d9cdf1",
  "normalization": "UTF-8; replace CRLF with LF; preserve terminal LF of each file",
  "files": [
    {
      "path": "PROPOSAL.md",
      "sha256_lf": "2ff6298fa36099e9f6bf143b269b9d5e57ee41cf34972a8dd0363d49926b981b"
    },
    {
      "path": "SOURCE-ANCHORS.json",
      "sha256_lf": "983d44de68f4abc49215d38566b4afd10573e065edddb92100a316f83977de96"
    },
    {
      "path": "REVIEW.md",
      "sha256_lf": "4e71530e28d70589a7709610a9a1c282e5a8a1d37591451821c46fe1ecc17ab2"
    }
  ],
  "independentReviewer": "REVIEW-RESULT-003-CODEX-01",
  "proposalReview": "PASS; necessity and boundaries only",
  "actualR1R2": "OPEN/STOP; no execution or closure authorized by review",
  "preservedHistoricalReview": {
    "path": "REVIEW-ac1ae689.md",
    "sha256_raw": "2796d336ef6b51c4f8217330f9c4ab0b04777637481ee401a220f707924ef515",
    "role": "Historical superseded proposal review; not operative payload"
  }
}
```

Explicit supersession of the quoted E13/C08 clauses and the pre-push prerequisite of section11.20 only follows. All original contract text and historical verdicts remain above.

- **E13, E2E (Owner-approved C08 resolution amendment).**
  - The new spec `99m-result-publication.spec.ts` sorts after `99l`. Its capture step retains final 99l behavior and every existing assertion, integrity check, variant, screenshot and privacy check, except its prefix/task value and the Student-only positioning hook below. The 99l suite and `helpers.ts` remain unchanged.
  - For Student captures only, after viewport selection and completed 200% text calibration, and before every screenshot attempt including the existing viewport fallback, position the intended exam card's result area in the viewport. Assert that the intended result state and its reveal control, when present, are visible inside the viewport and not covered by the sticky header. Record the target exam ID, result-state locator and visible bounds. A tall card need not fit entirely, but the masked value/revealed value or unavailable copy and the applicable control must actually appear in the PNG. Keep the existing root metrics, focus behavior, font calibration, post-capture integrity and restoration checks.
  - Only the nine legacy capture paths enumerated in this approved addendum may replace sequential computed-style mutation with the verified two-pass text-only snapshot method described in this addendum. All original journeys, fixtures, assertions, scenario/viewport/text conditions, screenshot outputs, role/security/privacy/value checks and the five browser projects are preserved. Add the specified integrity/evidence checks; do not add test retries, omit conditions or modify completed Task records.
  - The Teacher side uses the in-app "Perbarui Data" (never a browser reload).
  - The Student page has no in-app refresh. Each Student check therefore uses the shared `reloadPage` helper while that page is idle, with no request in flight. That avoids the race of ASSESS-INSTITUTION-002 §11.0.3, which was a reload during an in-flight refresh.
  - The journey uses a teacher-managed exam; the institution actor rule is proven on real PostgreSQL (I-1, I-2).

| C08 | Rendered evidence (`workspace-result-publication-*`):<br>• **Historical baseline:** preserve the five original `workspace-visual-*` artifacts of RESULT-004 post-merge main CI #265, its original product source/tree, PNG/JSON bytes, READY manifest and all review dispositions as immutable historical evidence.<br>• **Companion comparison baseline:** capture the same baseline product source with the candidate's approved Playwright 1.57.0/browser revisions and the identical approved capture-only corrections in the nine legacy paths. Record product-source, capture-patch, fixture, toolchain, environment and artifact manifests separately. Product code at the baseline must remain byte-identical. This companion is an additional comparison reference, not a replacement or rewrite of baseline #265.<br>• **After:** at most five scenarios: FINAL results unpublished with the action; the publish dialog with a reason; FINAL results published; the Student card masked and revealed (one scenario, two states); the Student card "Hasil belum tersedia." after withdrawal.<br>• **Conditions:** retain every historical capture condition and all five browser projects. New RESULT-003 captures retain widths 360, 390, 430, 768, 1024, 1280, 1440 and 640×360, and 200% text at 390×844 and 1280×800. In the nine approved legacy paths, apply factor 2 exactly once from an immutable computed-style snapshot, using separate read and write passes, with unchanged root/rem geometry, pre/post-screenshot numeric font/line-height checks and verified computed-value restoration. The 99m calibration/integrity/restoration behavior remains final99l plus only the approved Student-positioning hook; no additional calibration/restoration changes to 99m or any changes to99l are authorized. Preserve full-page limits and fallback behavior; the Student positioning hook must make the intended result state and applicable control visible in every viewport-fallback PNG.<br>• **Pass criteria:** no page overflow; targets ≥44px; focus never on BODY; all applicable calibration, identity, capture and restoration assertions pass; actual rendered review PASS. Preserve the existing distinction between legacy capture requirements and the RESULT-003 focus criterion; this amendment does not retroactively redefine completed Task acceptance.<br>• **Earlier captures:** every one of the 4,400 earlier capture keys must map one-to-one to original #265, companion before and candidate after evidence, without missing, extra or substituted states. Companion-before versus candidate-after must be pixel-identical except times and IDs and the §4.7 differences, each recorded and reviewed. Also retain the complete original-#265 comparison and an explicit disposition for every changed pair or evidence-backed group. Capture/toolchain differences are not an automatic acceptance category. Preserve only the two exact historical99l WebKit finalize-refused200% limitations identified in this addendum, with their original hashes and approved disposition. Keep them mapped and disclose them in all three comparisons, but do not count them as visual proof of the missing state. They permit no new unexplained delta or alteration of99l and provide no exception for any of the300 RESULT-003 captures. An unexplained delta, inequivalent environment, incorrect applicable calibration, missing required new RESULT-003 target state, missing legacy state without one of those exact historical limitations, omitted condition or unverified exception is STOP.<br>• **Closure:** the same REVIEW-RESULT-003-CODEX-01 reviewer must independently confirm the companion's validity, inspect actual PNGs, review all delta dispositions and explicitly close R1 and R2 on the exact final content SHA before C08/C10 or Delegated Acceptance may PASS. |

For this Owner-approved C08 resolution package only, the Owner explicitly supersedes the section11.20 prerequisite that R1 must be fully reconciled from existing evidence before the correction may be pushed. After approval of the exact package, the executor may implement one bounded R1+R2 capture correction, perform focused verification, create one genuine content-correction commit, and make one normal content push to obtain automatic exact-SHA eight-job CI and the approved new evidence while R1 and R2 remain OPEN/STOP. This permission is evidence-producing execution only: it neither proves the historical cause nor closes either finding. If focused verification, CI or companion-evidence verification fails, STOP without workflow rerun. Acceptance, the final evidence-only commit, PR and gated merge remain forbidden until all required evidence PASSES and the SAME designated reviewer explicitly closes R1 and R2 on the final content SHA. All other section11.20 restrictions and acceptance criteria remain in force except the exact E13/C08/path/operational amendments in this package. This is not a general supersession of section11.20 or permission to bypass any other unresolved STOP. After closure and all remaining gates, the Owner's CBT-R1 completion directive and this package's approved landing sequence govern the evidence commit, PR, delegated squash and exact-main CI under DEC-048.

Additional allowed paths, capture calibration/restoration/integrity/evidence only: `e2e/tests/99-question-types.spec.ts`, `e2e/tests/99b-true-false.spec.ts`, `e2e/tests/99c-matching.spec.ts`, `e2e/tests/99d-ordering.spec.ts`, `e2e/tests/99e-numeric-answer.spec.ts`, `e2e/tests/99f-essay.spec.ts`, `e2e/tests/99g-short-answer.spec.ts`, `e2e/tests/99h-institution-exams.spec.ts`, `e2e/tests/99i-institution-rooms.spec.ts`. Total31 implementation paths plus4 Task-flow paths; no completed Task-record, helpers,99j/99k/99l or workflow changes. Additional computed-restoration/line-height checks apply only to these nine legacy files;99m retains final99l behavior plus the approved Student-positioning hook.

Operational approval is limited to the reviewed proposal: one sequential collection of five baseline projects (43 baseline journeys each, one worker/retries0), after corrective content CI passes, using original baseline product source deee8a66d8518544a82b011c5070745a475cc153 with capture/test-pin overlays declared separately. Original265 remains immutable. Existing Docker Desktop may be started; cached application local imageID sha256:7852dc5a7d72f5fe458a597d690f6c42fbc8e9e26ddfa95f8e6ef552558d9bbf and unique cached PostgreSQL16 selector ca0bd484cb98 must pass the exact preflight; RepoDigests recorded separately. App2304MiB/2CPU/shm1GiB; PG256MiB/1CPU/shm64MiB/tmpfs512MiB. No image pull, new infrastructure, OS install or resource increase. Restore only project lockfile artifacts and approved bundled browser versions (PW1.57.0/Chromium1200/Firefox1497/WebKit2227/ffmpeg1011 if needed) into Temp. Verify capacity/font/library/environment equivalence against CI or STOP. Keep the two exact historical99l viewport limitations, all4400 mappings and300 new conditions without extending those limitations to RESULT-003. No root-cause diagnostics or CI reruns. Owner approval permits one genuine corrective content publication while findings remain OPEN solely to obtain evidence; acceptance/evidence-only/PR/gated merge require the SAME reviewer to close R1/R2 and every mandatory gate PASS.


### 11.22 Owner-authorized C08 harness recovery and failed focused gate

Owner authorized one bounded font-argument/verified-metadata harness recovery and one replacement12-case verification, with mandatory no-browser preflight and STOP on failure. Exactly nine approved collectors gained the fc-match option terminator; all pre-existing assertions and uncommitted changes remain. Preflight PASS:12 cases,10 modules,6 font patterns,syntax/config/fixtures/evidence paths. ReplacementUbuntuWebKit2227/PW1.57.0 executed once with one worker/retries0 and prior resource limits:12FAIL/0PASS/0skip/0flaky,exit1. Nine legacy cases failed exact restoration (59 null-to-empty style-attribute mismatches,rootUnchanged=false; computedfonts/lines restored with0mismatches); Student masked/revealed/withdrawn cases failed their unchanged inline-style restoration assertions with4/4/3 mismatches. This is a failed capture/restoration verification, not proof of application or native-browser root cause. Evidence: temporarygov-exec-003/c08-correction/recovery-01/STOP-summary.json SHA256 6b8b36f3b3924037dcd23d5d6155bafd7ff25658b941f34acfe457f261b13b09, complete JSONreport/containerlog/state/PNGs and source/fixture/toolchain inputs retained. STOP; no further correction/test/commit/push/CI/PR/merge/companion collection. OriginalCI277/f680d71 and all historical evidence remain unchanged. R1/R2OPEN; SAMEreviewer closure still mandatory.


### 11.23 Owner-authorized restoration correction cycle and terminal smoke STOP

Owner explicitly authorized one bounded restoration correction cycle after repeated STOP under DEC-048section5.6: inspect existing diff/recovery-01, preserve exact null/empty/original inline styles, computed text/root/geometry and every assertion; static checks then one representative smoke, then12cases once/retries0 ONLY if every smoke assertion PASSES. Any failed gate requiresSTOP without further execution. The latest Owner directive requires SAMEreviewerR1/R2closure/PASS before any corrective-content CI/publication sequence proceeds. This is not release authority.

The narrow amendment to the earlier99m freeze permits ONLY one synchronization read before existing restoration removal in99m within the already allowed path; no calibration/snapshot/algorithm/assertion changes. The SAMEdesignated reviewer independently assessed this exact narrow boundary as supported by the latest Owner directive, not by section5.6 alone; assessment was not testPASS orR1/R2closure. Nine legacy restorations also settle fonts/two animation frames and expose original/current root components while retaining every prior assertion and strict tolerance. No root style/font/width/height writes or geometry-forcing workaround remain. Frozen99l/helpers/workflows and all historical evidence are unchanged.

Source analysis used the WebKit base revision486de399887bc8fa8a69e2f194ebc9476589a08a declared by pinned Playwright1.57.0: Element.cpp3964-3982 may clear dirty inline CSS without materializing/removing its absent style attribute; StyledElement.cpp64-70/294-299 supports later empty serialization. getAttribute(style) before the existing removal materializes the pending CSSOM value. Rootfalse attribution was not available from recovery-01 boolean-only evidence; no root-cause claim was made. Source files, hashes and inputs are archived in temporarygov-exec-003/c08-correction/restoration-01.

Typecheck and final static preflight PASS (one configured smoke,12 fullcases,10 original metadata modules,6 actual font patterns,syntax/config/fixture/evidence paths). Exactly ONEUbuntuWebKit2227/PW1.57.0 smoke executed with one worker/retries0 and prior2304MiB/2CPU/shm1GiB limits. TerminalFAIL/exit1,OOMKilledfalse,30.553seconds. At390x844text2,calibration/integrity font/line mismatch0; restoration attributes0mismatch,fonts0,lines0,detached0. Null,empty and raw nonempty probe styles restored exactly. Remaining hard mismatch is rootheight1118->1086px(-32),with rootstyleNULL,font16px,line24px,width390 unchanged. Saved original-restoration metadata has rootUnchanged=false; terminal smoke reports its outer geometry invariant failure; exact cause of geometric difference remains unproven. The second viewport was not reached and the complete12-case verification was NOT RUN. STOP; no further patch/test/commit/push/CI/PR/merge/companioncollection/nextTask. R1/R2remainOPEN. Complete evidence/PNGs/JSON/state/logs/inputs:restoration-01/STOP-summary.json SHA256 749228c15a15e3481fb88858bb821ca4e0bf901448171864705c6aff0523839b.


### 11.24 Owner final geometric correction and terminal STOP

Owner authorized a source-supported correction of the existing1118->1086 root-height mismatch without restarting investigation, weakening assertions or changing acceptance. One smoke permitted; full12once/retries0 only afterPASS; failure requiresSTOP with a concrete engineering blocker. All previous work/evidence retained. The SAMEreviewer independently supported aligning the measurement boundary as a source-supported protocol correction, explicitly not a proven cause or closure. Nine legacy snapshots now collect original node/computed styles first and root geometry last, all before calibration; earlier/later original rects are retained. Smoke original measurement follows the same fonts-ready/computed-first boundary. No root/style/width/height writes, reverse-restoration change, assertion/tolerance change, or99m change in this cycle.

Typecheck/static preflightPASS. ExactlyONEsmoke,oneworker/retries0,pinnedPW1.57.0/WebKit2227,prior2304MiB/2CPU/shm1GiB:FAIL,exit1/OOMKilledfalse,54.899seconds. Original rect is1118px both before and after computed-style reads; restored rootheight remains1086px(-32) at390x844text2. Exactnull/empty/rawstyles and computedfont/line restoration remain0mismatch; rootstyleNULL/font16px/line24px/width390 unchanged. Thus read-order alignment is not a fix for this observed geometric mismatch. Engineeringblocker: legacy collector still fails to restore rootgeometry after the calibration/capture/restoration cycle, and no sufficient source-level geometry-restoration fix is established. No native/application rootcause is claimed. Full12NOTRUN; no additional execution,codecorrection,commit,push,CI,companioncollection,PR,merge ornewTask. R1/R2OPEN/STOP. Evidence temporarygov-exec-003/c08-correction/geometry-01/STOP-summary.json SHA256 1f153cfcb6e1529acd08c03eaabfc6a283c55c0912d03777e1b16751a16fe068. Priorrestoration/recoverySTOP-summaryhashes reverified unchanged.


### 11.25 Owner-approved overlay replacement: static PASS, functional STOP

Owner explicitly approved exact engineering proposal OWNER-DECISION-DEC048-5.6.md SHA25673b9898ce21f721970a47a5c9a8a1151508b48ae7687dc6dbaed52e84686e1de for ONE replacement cycle in the exact nine already allowed legacy collector paths. Candidate and STOP evidence were archived before mutation:177 files bound by overlay-01/archive-manifest.json. Original product source,99m/99l/helpers/dependencies/workflows/completed records and all4400legacy+300new capture conditions remain. The implementation replaces inline font/line calibration with immutable-snapshot-derived2x same-origin routed CSS/link, with exact marker/link/route cleanup; no CSP bypass or root dimension forcing. Original assertions/5000ms restoration poll/0.02px geometry tolerance are unchanged.

Typecheck/diff/syntax/preflight PASS. SAME designated reviewer gave STATIC PASS on exact manifest320c661f4000f49a7ab63a569ff2a0973b75b48fde31c9354c3c9ffd4306f6e3 and patchcfa2f1c9a9b0d6aec1b8e98665fa08b31bb1702e6aebdd1447c23c5368c811da. Review SHA2561ec1d88c17749880aaf473c053bf4a612668e249401974d1708a503de91fdc61; scope/177archive hashes/security construction verified. Inherited inputs.workingOverlay/boundary are explicitly historical/non-operative; current source authority is manifest.changed/archive working bytes/inputs.sources. Static PASS remains historical and is not runtime or R1/R2 acceptance.

ExactlyONEfocusedWebKit2227/PW1.57.0 smoke executed with one worker/retries0 and existing2304MiB/2CPU/shm1GiB. TerminalFAIL/exit1/OOMKilledfalse in36.701seconds, at390x844text2. Stylesheet loaded; applications1;font/line/marker calibration mismatches0. Restoration inline/font/line/detached/marker mismatches0; overlayAttachedfalse/remaining0. RootstyleNULL,font16px,line24px,width390 restored, but height1118->1086(-32),rootUnchangedfalse. Thus the alternative still fails the unchanged geometry gate; no native/application cause is established. Full12NOTRUN and second viewport not reached. No additional patch,diagnostic,execution,CI,commit,push,PR,merge,Task orproduction action. STOP escalated underDEC048section5.6 pendingOwnerdecision; R1/R2OPEN/STOP. All177 archived hashes and nine reviewed source hashes reverified unchanged. Task record receives only this authorized append-only approval/evidence addition after failure. Evidence overlay-01/STOP-summary.json SHA256bd22c94bb9ad05aba66aefbec2553da0ed67df3204dd1a3159c755446d6d13b1.

### 11.26 Owner critical recovery: localized fieldset drift and terminal smoke STOP

Owner authorized one bounded engineering-resolution cycle under DEC-048 section5.6: source/evidence inspection, one instrumented synthetic diagnostic if necessary, one source-supported correction in the same nine legacy collectors, SAME-reviewer static assessment, one WebKit smoke and12 cases once/retries0 only if smokePASS. Any failed verification gate requires STOP. No product/dependency/workflow/99m/99l/helper or completed-record changes were authorized.

The single diagnostic executed with retries0 and unchanged pinned Playwright1.57.0/WebKit2227/resource limits. Its successful test result means evidence collection completed, not C08 acceptance: the invoked collector failed its unchanged invariant. No-calibration screenshot control retained root1118 throughout. Treatment retained calibrated2754 through screenshot preparation/capture/cleanup, then became1086 when the overlay was removed. The exact local difference was question-card parent452->420, while its children stayed unchanged; legend26 plus bottom margin6 equals32. At2x the extra parent extent78 equals current legend margin-box110 minus previous32. Viewport390x844/DPR3, font readiness, content and recorded other computed properties were unchanged at the failing boundary. Pinned WebKit sources support a path-dependent intrinsic fieldset-border/flex sizing mechanism; no native stack/internal-value trace or normative CSS height is claimed. Diagnostic evidence SHA2569c069dbde61d488b5f2f2b73ceafb83e8208163b7f15b805a36b8783a620ca41; summarySHAb2dac67df958af2e633568a5dab64d06c1a519670ecbe1ccba50cff109137bd1 in temporary c08-correction/critical-recovery-01.

The one correction pins original fieldset/legend/parent topology before calibration and performs one visible renderer reconstruction only on WebKit/root drift after all non-geometric restoration invariants pass. Exact raw styles, focus and scroll are preserved and checked; no DOM detach, hidden element, dimensions, expected values, baseline normalization or assertion change. All11 prior working files were archived. Exactly nine collectors changed; protected99m and record bytes remained unchanged until this evidence append. Typecheck/diff/preflightPASS; preflight launched no browser and verified12 cases/1smoke/10bindings/6fonts. SAME reviewer STATIC PASS bound manifestf13fadab32c54ffd8ca4716729048b5562eeff22cbaced32e3e23c01075e96e8, patch6e3ab73426f916116bdc82d432a3221ed6668974d3b0a589627fcc6aed3b85a8 and revieweac96467324dbb608f577fe88d425237bdc937f17257758d35d23a3545d38629. Static PASS is retained and is not runtime acceptance.

Exactly one smoke ran, retries0, terminalFAIL/exit1/OOMKilledfalse in47.130seconds. First390x844text2 restored1118->1118 with rootUnchangedtrue. Second1280x800text2 failed1015->1047(+32), rootUnchangedfalse. Both metadata records show native recovery attempted once/count1, focusUnchangedtrue/scrollUnchangedtrue, detached/style/font/line/marker mismatches0 and overlay removed. The outer finally also reported original390 viewport root1118 versus1086 after returning to the entry viewport; this does not replace or conceal the second-variant failure. The correction therefore does not restore arbitrary prior native layout state. Full12NOTRUN. No further patch, diagnostic, test, CI, commit, push, PR, merge or new Task. R1/R2 remain OPEN/STOP. All nine reviewed source hashes and11 archive hashes were reverified; Task record receives only this append-only authorization/evidence addition. STOP-summary.json SHA256f35e362575639f24c1fd80bda031d05715cc22c63e54ffd9eae6d5373d86f03d in temporary c08-correction/critical-fix-01. A proposed capture-preparation boundary amendment is Owner-reserved and NOT effective; no expected/reference change has been made.

### 11.27 Owner-approved capture-boundary amendment

Owner explicitly approved the entire exact OWNER-DECISION-CAPTURE-BOUNDARY.md under DEC-048 section7, SHA2566fb42d32afbc97d952a4f54b7e74766d1393e23ad8cbf34ef3ba8d2f32bb7418; reviewed package manifestSHA3246a1a431176e092a9cc6dad3d76e064effa43553a19f5f7288da4a7de9cbf6 and terminal reviewSHA1bad6edb9334667d513f121343c92c8c256992f261c8bed257ca19f688c17de0. Exact package bytes/hashes verified before execution. The nine enumerated legacy paths only are authorized for one replacement cycle. WebKit200% variants may prepare the original fieldset/flex renderer once before measuring the per-variant reference; untouched/prepared states and every geometry delta remain separately recorded for SAME-reviewer disposition. This prepared reference never replaces the UNTOUCHED collector-entry snapshot. Original viewport, identity, attributes, controls, computed font/line, focus, scroll and root geometry must be restored before helper completion, with the unchanged exact outer smoke assertion and0.02px/5-second gates. One final-entry renderer recovery only after non-geometric PASS and only on remaining entry geometry drift is authorized. No entry normalization, expected-height substitution, assertion weakening, historical artifact/product-source changes or protected99m/99l/helper/dependency/workflow/completed-record edits.

Sequence: static checks and SAME exact review, ONE smoke including both viewports and final untouched entry, then12 focused cases once/retries0 only if smokePASS. AnyfailedgateSTOP, no automatic correction/retry/diagnostic. Subsequent companion evidence, final R1/R2 closure, genuine exact-SHA CI, acceptance/evidence/PR/gated merge/mainCI remain subject to all applicable previously authorized gates. R1/R2 remain OPEN until explicit SAME-reviewer rendered closure; no production or new Task authority. The earlier critical-recovery smokeFAIL and all previous STOP evidence remain intact.

### 11.28 Capture-boundary verification: legacy restoration PASS, Student fixture gate STOP

Owner-approved boundary cycle exactmanifest a8f184b855b08c9a01947271ae18e7482c50487547af286b0ca47ac5eb99591b and patch914631e925d70d3e13f85e5657ad90a5e7f5f73a472a599e572d0ff08c053ab4 obtained SAME-reviewer STATIC PASS, reportSHA73ab746fd4bfc2315a2722f887e1cca0c969495f13588d037a02d09981c9a034. All nine source hashes, two protected files, sixteen archives and ten harness bindings verified before execution and after terminal results. Original and prepared references remain independent; no rebase or assertion weakening.

Exactly ONE smoke PASS:36.651898seconds,retries0,exit0/OOMKilledfalse,both390x844 and1280x800text2,original collector-entry root1118->1118 exact,including raw null/empty/nonempty style/marker assertions. Subsequently the complete twelve-case verification ran exactly ONCE:9PASS/3FAIL,170.983954seconds,retries0,exit1/OOMKilledfalse. Nine legacy collectors passed. All20 legacy metadata records (2smoke+18focused) show prepared-variant and untouched collector-entry restorationPASS. Preparation narrow roots1118->1118/no deltas; wide roots1015->1047(+32),14 affected-node geometry deltas each. Every before/after affected-node state and delta is retained in PREPARATION-DISPOSITION.json SHA25617f071636754b999f243fc136459797a3afd20b034a7fece2a4b12144ae3a54b for SAME-reviewer disposition. This synthetic verification does not establish full4700-condition rendered acceptance or R1 closure.

Three Student synthetic scenarios failed the existing99m:281 assertion expect(cardBounds.y).toBeLessThan(viewport.height): expected y<844; masked/revealed1808.46630859375,withdrawn1863.7484130859375. No successful Student screenshot metadata was produced. The temporary focused.spec.cjs:29 fixture omits viewport meta, while original frontend/web/index.html:5 contains width=device-width,initial-scale=1.0,viewport-fit=cover. This is a verified fixture/source difference, not a proven root cause or authority to relabel FAIL. Protected99m remained unchanged throughout the cycle.

STOP under exact Owner proposal and DEC-048 section5.6. No further patch,test,diagnostic,companioncollection,CI,commit,push,PR,merge,newTask orproduction action. R1/R2 remain OPEN/STOP. SAME reviewer terminal read-only assessment requested; any further correction/execution requires the reserved Owner decision. HistoricalSTATICPASS and all earlier failed evidence remain unchanged. Evidence:temporary gov-exec-003/c08-correction/boundary-final-01/STOP-summary.json SHA256c38d0125e1580c30a236d8c0c8b1ec5825a292b1d8780f791b2c831dd44541ea,with complete original reports/logs/artifact hashes. This is an append-only active-Task evidence update after verification; prior record bytes archived as task-record-before-terminal.md. HEADf680d71 and historical CI277 eightSUCCESS are unchanged. RESULT003VERIFYING,19/33DONE,productionNO-GO.
SAME terminal review now completed: boundary-final-01/TERMINAL-REVIEW.md SHA2569c74be52455af847b7e45d1503a5f5f5c004fde884b2e7afc3e93e42db6a877c. Reviewer confirmed STOP,54artifact hashes/sizes,all20prepared/entryrestorationPASS, and explicitly dispositioned two preparation groups only for this synthetic evidence (10narrow/delta0;10wide/exact14deltas/root+32). No fullrenderedR1/R2closure. One exact proposal OWNER-DECISION-STUDENT-FIXTURE.md SHA256cef56429cf1f2eeca97620eaa3cb2a39d2492dfe71d7a51354072e61146da271 received necessity/boundaryPASS only: add productionviewportmeta to a new TempStudentfixturecopy, preserve all repo source/assertions/old evidence, staticpreflight/SAMEstaticapproval thenONEreplacement12/retries0 only after explicitOwnerapproval. Its cause remains unproven; no fixture correction or execution began. Await Owner reserved decision underDEC0485.6. All six package-file hashes bound in OWNER-DECISION-STUDENT-FIXTURE-MANIFEST.json; proposal remains NOTeffective.
### 11.29 Owner-approved Student fixture correction: preflight STOP before browser

Owner explicitly approved ONE bounded fixture cycle underDEC048section5.6, exactproposalcef56429cf1f2eeca97620eaa3cb2a39d2492dfe71d7a51354072e61146da271/package0c1a106370fa01ab210cdaa5ffc0f1fd3c0dc4398236cc6f18a8cd40f5bafa6d. Separate temporary student-fixture-01 candidate adds only exactproductionviewportmeta beforeexistingStudentHTML. Removingtag recreatesoldfixturebytes. Candidate manifestd3ee3fcdbcdb5a287086a5f00fa3e3cc45a794ff4e754ed0bca1cee5e08db626;fixture0d5a5c598f1b0d2494a4d0597dea5a89ab78f7857c6abe85f716fd1228507469. No trackedsource/product/99m/99l/helper/legacy/dependency/workflow/assertion edits. Original114boundary-finalfiles,24bundlebindings and17protectedrepoinputs verified unchanged before this append.

Preflight terminalFAIL,exit1,OOMKilledfalse,browserLaunchedfalse:24cases listed,mandatory12. Exactly focused.spec.cjs12 and original-harness/focused.spec.cjs12. Executor incorrectly placed historical harness copy inside testDir rather than the already excluded archive directory. This is a packaging defect, not evidence of a product defect or proof of priorStudentbounds cause. Tenmetadata bindings and sixfontpatterns passed before case-countfailure. No browser launched; complete12verification NOTRUN; previousPASSsmoke NOTREPEATED. SAME reviewer STOP, no overallSTATICPASS:STATIC-REVIEW.md SHA2569ab1b6d28e61b2565d2aef51a08443e404de8988f54bbcedf9b7c232dfb0e4a1. R1/R2OPEN/STOP;allpreviousFAIL/PASS preserved.

One reserved resolution: place original-harness under existingexcludedarchive,preserve everybyte andoldprovenance,change no candidate/config/source/assertion. Requires explicitOwnerexception overthispreflightSTOP, thenapplicablepreflight/SAMEstaticreviewbeforetheunexecuted12cases. No automaticpatch/retry/diagnostic/CI/companioncollection/commit/push/PR/merge/production/nextTask. All17protectedinputs were verified before this append-onlyactiveTaskevidence update; formerrecordbytesarchivedasrecord-before-evidence.md. HEADf680d71/CI277original8SUCCESS unchanged;19/33DONE,RESULT003VERIFYING,productionNO-GO.
Terminal evidence: temporary c08-correction/student-fixture-01/STOP-summary.json SHA256d44f7778f580b726d2837f4c1101d89c9844bbe7e1d4d6136c341f424412d85c.

### 11.30 Student fixture packaging and focused verification

Under DEC-048 §5.6 the Owner authorized relocating the duplicate temporary harness into the existing `archive` exclusion. All eight moved files retained their bytes. The 43 candidate file hashes and 17 protected inputs matched the packaging manifest `6204c7dc609f5084e583cdd8c474d083434fde634389195c9dbda97396c058ed`. The original preflight failure and review STOP in §11.29 remain historical evidence. The corrected preflight discovered the 12 intended cases, with 10 metadata bindings and six font patterns. The designated reviewer's STATIC PASS is bound to `f495b5002b859d99899d70f8f436cbbe5bb8ecc3be79a7e82dfb27f710f164bd`.

The single Ubuntu WebKit 2227 run on Playwright 1.57.0 passed 12/12 in 152.318 seconds, with one worker, zero retries, zero skipped and zero flaky. The previously successful smoke was not repeated. The nine legacy collectors and all three Student scenarios produced 24 PNG/JSON pairs. In the six Student viewport fallbacks (390×844 and 1280×800, text 200%), focus remained on H1. The complete local evidence manifest is `student-fixture-packaging-01/FOCUSED-EVIDENCE.json`, SHA-256 `7662c76843c687447db2084bafaf73e7149a0fda5f39298f9bfa8212eaa96612`. The local packaging and fixture are verification artifacts outside Git.

The same independent reviewer inspected all six Student PNGs, confirmed both preparation groups across 18 legacy records and verified both restoration references. FOCUSED-REVIEW.md SHA-256 62afbc1a9bb2cb4c22ab84dbf4e65cc8257e00005ef07621ad68b70022d224ea records PASS for the focused verification and evidence-producing publication under section 11.21. R1/R2 remain OPEN pending exact-content CI, companion collection, and full rendered review. RESULT-003 remains VERIFYING, with 19/33 baseline Tasks DONE.
