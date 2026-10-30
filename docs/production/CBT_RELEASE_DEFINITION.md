**Status:** DERIVED P1 / SUBMITTED FOR REVIEW; NOT APPROVED
**Version:** 0.1.0
**Authority:** Derived from DEC-044, DEC-045 and ADR-001; does not supersede canonical decisions
**Task:** GOV-REALIGN-003 (PRE-P11 / PRE-BASELINE; not counted in P11 baseline)
**Verified implementation baseline:** `8f51c77c081a5aa06ecbeedf054ebb3c310d4fbb`
**Last Verified:** 2026-10-30

# CBT-R1 Release Definition (P1)

## 1. Authority and release boundary

This is the P1 artifact required by [00.12 §3](../00-governance/00.12_AICWDF_ADOPTION_AND_TASK_EXECUTION.md). [DEC-044](../00-governance/00.11_CBT_RELEASE_SCOPE_REALIGNMENT.md) remains the release-scope and G1–G10 authority; [00.02](../00-governance/00.02_DECISION_HIERARCHY.md) resolves authority. P1 approval is pending. Neither this document nor a passing CI declares the P11 baseline or CBT-R1 production-ready.

CBT-R1 is a production-ready mobile-first web Secure Assessment release for one school, planned for about **1,000 concurrent students**, on the school's domain and VPS. ELLIGBLE remains a multi-tenant education platform: one academic tenant in this deployment never permits shortcuts in tenant, membership, assignment or object authorization. [ADR-001](../decisions/ADR-001_AS_BUILT_STACK_AND_SELF_HOSTED_TOPOLOGY.md) selects the existing Node.js/TypeScript modular monolith, React/Vite client, PostgreSQL and Docker/nginx topology. Capacity and actual production readiness remain unproven. P9 fixes the production database major version consistently with staging and CI; current CI uses PostgreSQL 16.

Required scope is **all DEC-044 §3 areas**, not just the delivered single-choice teacher-managed pilot. Scope is not reduced to accelerate release. Engineering priority is answer/data integrity, reliability, security/authorization, correctness, compatibility, operational simplicity, concurrency/performance, maintainability, then polish and novelty (DEC-044 §2).

Deferred domains remain exactly DEC-044 §8: Learn/LMS, Track, Passport, Path, Care, Parent/Guardian, Alumni, Partner/Opportunity/Application/Verified Connection/Outcome, Talent Assurance, AI, social/network, full SIS/ERP, general attendance/timetable, payments/billing, general Search/Messaging/Notification and native apps. Exam broadcasts remain in scope; minimal contextual exam help replaces full role-aware Help/Feedback for this release only. No audio/video or file-upload answers are added by P1. Existing activation cards remain valid. Historical platform-wide baseline classifications are preserved.

## 2. Evidence and status rules

Statuses describe each bounded requirement at the verified baseline, not whole-product readiness:

| Status | Meaning |
|---|---|
| DELIVERED | Implemented integrated slice with named existing verification; applicable release evidence may still be pending separately |
| PARTIAL | Some required behavior exists; the stated remainder is not delivered |
| MISSING | Required product path/artifact not found in the targeted current implementation and canonical records; not a claim that no historical building block exists |
| BLOCKED | Required progress depends on an identified OPEN decision, external access or prerequisite |
| EVIDENCE PENDING | Implementation/design exists or a gate is defined, but required release-grade proof is absent |

Evidence anchors below are repository-relative paths. Existing CI [#79](https://github.com/yusufarst/elligble/actions/runs/40506126353), attempt 1, on the exact baseline: runtime, web, image and all five browser jobs SUCCESS, verified from GitHub on 2026-10-30. This validates the existing tested journeys; it does not prove unimplemented scope, real devices, school UAT or 1,000-student capacity. Current test inventory is 344 web tests and 22 E2E cases per project; this Task must record its own actual CI results. Source evidence is code inspection, not a new executed test. Graphify query was consulted as derived navigation; its old 491-node graph did not establish current scope, so current canonical files and actual source take precedence. No graph rebuild or out-of-scope file change is required for this wording-only alignment.

Source/evidence key:

| Key | Implementation / verification anchor |
|---|---|
| E1 | `runtime/identity-access/`, `runtime/tenant-access/`, `runtime/secure-assessment/src/server.ts`; `e2e/tests/1-pilot-journey.spec.ts`, `3-security.spec.ts`; living plan §2, §4–§5 |
| E2 | `frontend/web/src/components/StudentExamWorkstation.tsx`, `frontend/web/src/exam/answer-sync-engine.ts`, `runtime/secure-assessment/src/timer.ts`; `e2e/tests/2-resilience.spec.ts`, `5-lifecycle.spec.ts` |
| E3 | `runtime/secure-assessment/src/question-import.ts`, `question-snapshot-baseline-frozen-content-contract.ts`, `teacher-exam-import.ts`, `teacher-exam-preview.ts`, `teacher-exam-schedule.ts`, `teacher-exam-participants.ts`, `teacher-exam-cancel.ts`, `exam-lifecycle-operations.ts`; integration tests with corresponding names; `e2e/tests/6-teacher-import.spec.ts`, `7-teacher-cancel.spec.ts`, `8-teacher-add-participants.spec.ts` |
| E4 | `runtime/secure-assessment/src/scoring.ts`, `teacher-results.ts`; `runtime/secure-assessment/test/integration/teacher-results.test.ts`; `e2e/tests/4-results.spec.ts`, `5-lifecycle.spec.ts` |
| E5 | Living plan §6 ASSESS-PROCTOR-001/002/004; `frontend/web/src/components/ExamMonitoringView.tsx`; `e2e/tests/4-results.spec.ts`, `5-lifecycle.spec.ts` |
| E6 | `Dockerfile`, `deploy/`, `runtime/secure-assessment/src/ops/`, `metrics.ts`, `.github/workflows/ci.yml`; [OPERATIONS_RUNBOOK](OPERATIONS_RUNBOOK.md) §1–§8; living plan §9 |
| E7 | [UI-SYSTEM-004 record](tasks/UI-SYSTEM-004.md) §9.5–§9.6: Part 3 DONE, content `dcf6f88e5a34738b12f2f7dfd21b1559b8f790d0`, CI #77, 68 matched pairs, both human reviews PASS; PR #9 landing `8f51c77c081a5aa06ecbeedf054ebb3c310d4fbb`, main CI #79 |

Responsibility in the matrices means the required accountable role/workstream, **not authorization to execute another Task or appointment of a named person**. Executor work always requires its own Owner-authorized contract; school, legal and operational signatories are supplied/confirmed by the Owner.

## 3. Required roles and critical journeys

Canonical actors and authority are DEC-044 §4, §12 (OD-05–OD-09), not UI-role guesses.

| Role / context | Required end-to-end journey | Current coverage / requirement IDs |
|---|---|---|
| Student (STUDENT) | claim/match/verification or activation card → login → assigned exam → readiness/start → answer/recover/timer/flags → safe submit/expiry → own published score | Delivered exam slice; identity and publication gaps R01–R09, R25–R27 |
| Teacher (SCHOOL_STAFF + TEACHER assignment) | own teacher-managed author/import/preview/schedule/participants → readiness/open/pause/resume/end → scoped monitoring/controls → grade/finalize/export/publish | Existing single-choice teacher-managed slice E3–E5; bank/formats/grading/publication gaps R10–R20, R25–R27 |
| Homeroom Teacher (HOMEROOM_TEACHER, own rombel) | verify/activate/reject with reason/recover matched student claims | R08–R09 MISSING/BLOCKED; no exam authority inherited from this assignment |
| Proctor (PROCTOR, assigned exam/room) | scoped room/participant monitoring → signals/human incident review → lock/unlock/message, attributable controls | Read/lock/message slice E5; risk/incident/management gaps R21–R24; no added-time authority under OD-07 |
| School Operator (SCHOOL_OPERATOR, tenant) | authoritative roster import/verification → organize institution exams/sessions/rooms/participants/proctors → school-wide drill-down → reason/confirm/audit sensitive actions and running room moves | R08–R09, R20–R24 gaps; no grading/score edits/cheating verdicts |
| Platform Admin (PLATFORM_STAFF assignment; PLATFORM_OWNER governance) | audited platform provisioning, configuration and operations within platform authority | CLI E1/E6; no automatic academic or day-to-day exam authority |

Teacher authority is not globally Proctor authority. For institution-managed exams, School Operator organizes, subject teachers prepare/preview before the deadline, grade essays and finalize subject results (OD-07b). In code/runbook, unqualified operator means **platform provisioning operator**, not School Operator. All required roles need school UAT under G9; existing teacher-managed tests are not substitutes.

## 4. Capability traceability and measurable acceptance

Every row maps a required capability to actual implementation/evidence, remaining gap, dependency, responsible party and release acceptance. All assertions refer to real persisted authoritative state where relevant; no fake success or production mock is acceptable. Abbreviations P2–P11 refer to §8, PB to §7, G to §6.

| ID / canonical requirement | Status | Implementation → existing evidence | Gap → dependency | Responsible party | Acceptance required for CBT-R1 |
|---|---|---|---|---|---|
| R01 Assigned discovery, readiness and entry (§3 Student) | DELIVERED | AssignedExamDiscovery/AttemptLaunch, start route → E1/E2, pilot E2E | Release/device evidence → P3/P8/P10 | Assessment executor; school UAT | Assigned eligible student starts once; ineligible/other-student/other-tenant starts denied; refresh preserves attempt |
| R02 Local-first autosave and honest pending/saved/error/offline states | DELIVERED | IndexedDB + answer engine + server save → E2 resilience, E1 negatives | Full PB07 artifact → P6/P8 | Assessment executor; independent reviewer | Choice persisted locally before send; saved only after matching server acknowledgement; failures never falsely acknowledged |
| R03 Offline, reconnect, reload, browser restart, session/device takeover | PARTIAL | Existing recovery/takeover → E2, living plan §2/§11 | Complete G3 scenario report; no silent expiry-policy invention → PB07/P8, D04.5-48 | Assessment executor; Owner for OPEN policy | Same attempt resumes, stale sessions cannot write; all accepted/pending outcomes reconciled against stored server answers without silent loss |
| R04 Server timer, expiry and additional-time continuity | DELIVERED | timer/expiry sweep, participant time ledger → E2, E4/E5 | Production load/restart/device proof → P6/P8 | Assessment executor | Client clock never grants time; expiry finalizes once; pause freezes exactly; lock time continues; authorized additions attributed and reflected |
| R05 Ragu-ragu marks | DELIVERED | Review flags separate from answers → E2 resilience | Release/device regression → P8 | Assessment executor | Mark survives recovery, affects neither answer/scoring nor authorized staff results |
| R06 Safe explicit submission and automatic expiry submission | DELIVERED | Server submit/expiry, flush/backoff → E2/E4 | Submission-storm/server-restart evidence → PB07/P6/P8 | Assessment executor | Repeats converge to one submission; final receipt/state from server; pending/refused answers communicated honestly |
| R07 Account login/session/activation cards | DELIVERED | Existing identity + audited provisioning → E1/E6 | Full identity journey below; production security → P5/P9 | Identity executor; platform operator | DEC-041/password minimum 8, scoped membership/session validation, single-use activation, no alternate-account reauth leakage |
| R08 Official roster, student claims, matching and verification (§5, OD-05/06) | MISSING | CLI people/cards exist E1/E6, not School Operator claim workflow | P2 identity; P5/PB05; G7 before real data | Identity executor; School Operator; Homeroom Teacher | Match NISN + birth date, name confirmation; ambiguous review, never auto-merge; verify own rombel or School Operator; reject with reason/audit |
| R09 Identity uniqueness, official attributes and school-assisted recovery | BLOCKED | Existing Account/Person/cards not proof of new claim invariants | AUTH-001 ID format OPEN; P2/P5, PB01/02/03/10 | Owner; identity executor; school verifier | DB-enforced ≤1 active account per official Student and no duplicate-producing active/pending claims under concurrency; recovery never creates another Person/account; audited re-import only, no Person merge |
| R10 Single-choice A–E, frozen authored order and validation | DELIVERED | `MULTIPLE_CHOICE_SINGLE` CSV/frozen contract/scoring → E3/E4 | Regression when other types added → P2/P8 | Assessment executor | Valid options/identity/order frozen; invalid payload/key/import denied; no keys in Student runtime; exact deterministic scoring |
| R11 Multiple response | MISSING | E3/E4 baseline accepts single choice only | P2 payload/scoring, P3/P5/P8 | Assessment executor; subject reviewers | Author/import/preview/answer/save/recover/grade full type; P2-approved exact scoring and boundary examples PASS |
| R12 True/false | MISSING | E3 baseline only | P2/P3/P5/P8 | Assessment executor; subject reviewers | Complete frozen type journey; valid/invalid answer cases and approved scoring examples PASS |
| R13 Matching | MISSING | E3 baseline only | P2/P3/P5/P8 | Assessment executor; subject reviewers | Complete accessible type journey; matching identity/recovery and approved scoring cases PASS |
| R14 Ordering | MISSING | E3 baseline only | P2/P3/P5/P8 | Assessment executor; subject reviewers | Ordered answer persists/reconciles exactly; keyboard/touch access; approved scoring cases PASS |
| R15 Short answer | MISSING | E3/E4 baseline only | P2 normalization/grading rules; P3/P5/P8 | Assessment executor; subject reviewers | Frozen prompt and exact response recover; approved normalization/manual grading rules and boundary cases PASS |
| R16 Numeric answer | MISSING | E3/E4 baseline only | P2 numeric/tolerance/scoring rules; P3/P5/P8 | Assessment executor; subject reviewers | Approved numeric representation/tolerance validated; persistence and deterministic grading cases PASS; no guessed tolerance |
| R17 Essay | MISSING | E3/E4 baseline only | P2 manual grading; P3/P5/P8 | Assessment executor; subject teacher | Full response recovery, authorized manual grading and finalization verified; no upload answer introduced |
| R18 Images in prompts and options | MISSING | Current CSV text-only E3 | P2 content contracts; P4 storage/security ADR if needed; P5/P7/P8 | Assessment/security executors; Owner if new cost | Authorized validated image lifecycle; frozen exam content; accessible readable media without narrow-screen overflow or key leakage |
| R19 Question bank and browser authoring | MISSING | Teacher file import/preview exists E3; not bank/authoring | P2/P3/P4/P5/P7/P8 | Assessment executor; teacher UAT | Create/reuse/edit scoped source questions; preview/validate before publish; later bank edits never mutate exam snapshots |
| R20 Teacher-managed and institution-managed governance | PARTIAL | Teacher schedule/readiness/lifecycle/add/cancel/preview E3 | Institution organizer, sessions, rooms, rombel participants and proctor UI missing → P2/P3/P5/PB05 | Assessment executor; School Operator; subject teacher | Existing teacher flow retained; OD-07b school-wide workflow operable with scoped attribution; schedule/participants/deadline/readiness conflicts refused |
| R21 Rooms and proctor assignment; school-wide drill-down | PARTIAL | Existing room/assignment runtime/read projection E5; product management absent | Institution-managed operations → P2/P3/P5/PB05 | Assessment executor; School Operator | Authorized exam → room → participant view; school-wide operations only School Operator; assigned proctors limited to their scope |
| R22 Running participant room reassignment (§5A) | MISSING | No in-product safe transfer in current journey; building blocks are not delivery | P2 safe transition; P3/P5/P6/P8/PB07 | Assessment executor; School Operator | One current room plus append-only history; mandatory reason/confirmation/audit; same Student/Participant/Attempt/snapshot/answers/randomization/time/submission; no retake or timer reset |
| R23 Live cards/status, locks, messages, added time | PARTIAL | Existing monitoring/lock/broadcast/Teacher added time E5 | School Operator controls and full approved role matrix → P2/P5/PB05 | Assessment executor; assigned supervisor | Server-derived fresh/stale state, scoped actions, confirmations/reasons/audit per high-risk policy; no added time by Proctor; reliable explicit device delivery states |
| R24 STANDAR signal feed and human incident review (§6, OD-08) | MISSING | Session-move facts exist E5; full risk feed/incidents absent | P2 signals; P3/P4/P5/P8/PB06 | Assessment/security executors; Proctor/School Operator | Hidden tab/focus/fullscreen where supported/session-device/offline-reconnect/IP-context signals; neutral warning; only authorized humans open/close incident; no automatic lock/score deduction/forced submit or cheating verdict |
| R25 Per-type scoring and manual grading | PARTIAL | `BASELINE_SINGLE_CHOICE_V1`, frozen results E4 | Other types/manual workflow → P2/P3/P5/P8 | Assessment executor; subject teacher | Reproducible per-type scores against frozen content/accepted answers; authorized manual grade where needed; absent ≠ zero; approved boundary examples PASS |
| R26 Finalization, export and reporting | PARTIAL | Teacher frozen finalization, CSV/print E4 | Full-type/institution reporting coverage → P2/P3/P5/P8 | Assessment executor; subject teacher | No running attempts at finalization; duplicate finalization stable/audited; export matches authorized frozen results/provenance; no cross-scope disclosure |
| R27 Publication (OD-09) | MISSING | E4 keeps results hidden from Students; RESULT-003 not delivered | P2/P3/P5/P8; P11 re-evaluates carried ID | Assessment executor; teacher publisher | Only teacher publishes finalized results per exam; Student sees own score only; no ranking/peer scores or premature disclosure |
| R28 Audit/logs/metrics/alerts (§3 Operations) | PARTIAL | Structured request logs, internal metrics, alert rules E6 | Production collection/delivery and incident readiness → P9/PB12 | Operations/security executor; Owner-appointed responder | Attributable sensitive actions, no secrets/student answers in logs; alerts demonstrably received by responsible operator; noncritical failure cannot silently lose answers |
| R29 Backup/restore, staging/UAT, release/rollback, VPS operations | EVIDENCE PENDING | Container/preflight/migrations/reference nginx/runbook/local drill E6 | School VPS facts, PB11/12, P9/P10; G7 real data | Owner/school infrastructure operator; operations executor | G8/G9 fully evidenced on actual infrastructure, restoration checked for schema/startup/auth/answers; no ad-hoc production SQL or destructive agent intervention |
| R30 Mobile-first accessible Bahasa Indonesia UI and honest capability limits | PARTIAL | Shared approved tokens/shadcn, Student/Teacher slices E7 and UI002 record | All new required screens; real devices → P7/P8/PB06 | UI executor; school/device reviewers | Same product design, WCAG 2.1 AA constraints, keyboard/focus, ≥44px touch targets, no tested-width overflow; no unsupported fullscreen/split-screen claim; neutral status/help |
| R31 1,000-student concurrency and school-network reliability | EVIDENCE PENDING | Five-browser regression/edge smoke and default pool are not load evidence E6 | P6 budgets and production-equivalent infrastructure P9 | Performance/operations executor; Owner/school | Approved P6 workload/budgets met across start/save/reconnect/submit bursts, restart, DB contention, timer/status polling, supervisor dashboards and shared NAT; G3 answer checks remain exact |

Rows R01–R31 cover all eight DEC-044 §3 areas: Student R01–R06/R30; identity R07–R09; questions/exams R10–R20; governance R20–R22; supervision R21–R24; School Operator R08–R09/R20–R24; results R25–R27; operations R28–R31. A DELIVERED slice is reused, not counted as a new P11 DONE Task. No completed UI Task is reopened.

## 5. Binding security, privacy and answer-integrity invariants

1. Default deny on the **server**, for tenant, membership, contextual assignment, exam, room, participant and object. UI visibility never grants authority. Tenant isolation remains even for a single school. No silent cross-domain writes; owning modules and versioned migrations remain authoritative.
2. Student ≠ Participant ≠ Attempt ≠ Session; Question Bank Item ≠ immutable Exam Question Snapshot. Reconnect/takeover/room reassignment never silently creates a retake or changes accepted answers, randomization, timer or submission truth.
3. Pending locally ≠ acknowledged by server. Local durability, capture-time pause/lock rules, reconciliation and refusal feedback remain explicit. Device/session loss does not justify silent discard. D04.5-48 late-delivery exception policy stays deferred/OPEN (living plan P1-22, ASSESS-STUDENT-001), not silently accepted or called loss-free; P8 must classify and verify it honestly against canonical rules before G3 is claimed.
4. Server time is authoritative; reconnect never restarts it. Pause freezes; participant lock does not. Submission duplicates converge to one authoritative result; expiry works when the device is absent. No fabricated timer, acknowledgement, result or evidence.
5. Correct answers/scoring keys never reach Student question runtime. Teacher Preview reveals keys/scores only on request, selects locally and creates zero attempts. Teacher/Proctor/School Operator limits remain §3 and OD-07/07b; high-risk action requires one attributable actor, reason, confirmation and audit; no new maker-checker policy.
6. Registration claim ≠ trusted Person/Account. One official Student has at most one active Account and no concurrent duplicate-producing claims, enforced transactionally at persistence. Recovery reuses identity/account. OD-06 data: full name, NIS, NISN, birth date, rombel; name/NIS/rombel visible to scoped Teacher/Proctor/School Operator, NISN/birth date only Homeroom Teacher/School Operator for verification, never other Students. No real student data before G7.
7. Risk signal ≠ verdict; no automatic guilt, sanction, score deduction, lock or forced submission. Unsupported platform features are recorded as limitations, not violations. Split-screen/multi-window capability must be represented honestly.
8. DEC-041 authentication, minimum 8-character password, safe session/cookie/CSRF/origin/security-header controls persist. No secret/private student data in Git or evidence; no production mock or fake dependency. Active exams must not depend synchronously on deferred/noncritical domains.
9. Ordinary coding agents never reset/truncate/reseed/drop/repair production data with manual SQL. Audited product/CLI intervention only; migrations tested outside production and rehearsed on staging with backup, approval and rollback readiness. Existing manual-SQL session-revocation runbook instruction must be replaced by an audited path before go-live (DEC-044 §11).

## 6. G1–G10 release acceptance and evidence map

All gates are mandatory predicates, not weighted scores. No green CI substitutes for missing legal, load, device, staging or school evidence. These are **release gate states**, separate from this documentation Task's CI/reviews.

| Gate / DEC-044 §9 | Current state and evidence | Measurable exit / missing evidence | Dependency / responsible party |
|---|---|---|---|
| G1 Tasks | BLOCKED: P11 baseline does not exist | Approved finite P11 baseline; every included Task DONE with evidence, zero BLOCKED/IN_PROGRESS/VERIFYING | Sufficient P1–P10 → P11; Owner + authorized executors + reviewers |
| G2 Defects | EVIDENCE PENDING: existing regression passes, required scope incomplete | Zero known P0/P1 release defects, tenant/auth bypass, answer-loss/duplicate-account path; zero production mock/fake or visible unimplemented interaction | R01–R31; P2/P5/P8; executors + independent reviewers |
| G3 Answer integrity / PB07 | EVIDENCE PENDING: E2 existing recovery checks only | Formal server-answer comparison for offline, reload, browser restart, session/device takeover, running room move, server restart, expiry, pause/lock, submission storm; all required cases PASS, no silent mismatch | R02–R06/R22/R31; P2/P6/P8; assessment executor/reviewer |
| G4 Capacity | EVIDENCE PENDING: no production-equivalent load result | Approx. 1,000 concurrent profile including all DEC-044 §10 bursts/contention/shared NAT/dashboards; all approved P6 latency/error/resource/recovery budgets met, answer correctness preserved | R31; P6/P9; performance/ops + Owner budget approval |
| G5 Devices / PB06 | EVIDENCE PENDING: browser engines/widths ≠ real devices | Approved matrix real Android Chrome, iPhone Safari, Android tablet, iPad Safari, desktop Chrome/Edge critical journeys PASS with honest limits, split-screen/multi-window behavior documented | R30; P7/P8; school/device testers + reviewer |
| G6 Security | BLOCKED: PB05/PB12 OPEN | Approved CBT matrix enforced with negative tenant/assignment/exam/room/object tests; production headers/edge limits active, no repository secret; incident owner/contacts recorded | P5/P9; security executor + Owner/incident lead |
| G7 Privacy/legal | BLOCKED: PB01/02/03/10 OPEN | Each applicable artifact approved and blocker closure evidence recorded **before loading real student data** | Owner + qualified legal/privacy authority |
| G8 Operations / PB11 | EVIDENCE PENDING: E6 references/local drill only | School-domain TLS; active monitoring/alerts; automated backups and encrypted off-host copy; production-infrastructure restore drill PASS; audited interventions; current runbook | R28–R29; P9; school infrastructure operator + operations executor |
| G9 Release | EVIDENCE PENDING: no staging/school sign-off | Migration/release rehearsal on staging; Student/Teacher/Homeroom Teacher/Proctor/School Operator school UAT sign-offs; known rollback target; explicit database and recurring-cost changes | R01–R31; P10; school signatories + Owner/release operator |
| G10 Cost | PARTIAL: ADR-001 has no new recurring dependency; actual release declaration pending | Zero unapproved new paid recurring dependencies; explicit release cost delta and Owner approval for any addition | P4/P9/P10; Owner + release operator |

P1 measures correctness through explicit pass/fail predicates above. Numeric latency, failure-rate, test duration, recovery-time and resource budgets are **OPEN for P6 approval**, not invented guarantees. P6 must supply workload, measurement protocol, thresholds and pass/fail evidence before G4 can pass; "about 1,000" is the canonical concurrency target, not measured capacity. P9/P10 must settle backup retention/RPO/RTO with PB02 and infrastructure facts; this document does not choose them. Until these inputs are approved and verified, the associated gates remain unmet.

## 7. Blockers and required decisions

[PRODUCTION_BLOCKERS_BACKLOG](../state/PRODUCTION_BLOCKERS_BACKLOG.md) v0.1.5 is the authoritative status/closure tracker. This Task closes none. Total 12: 1 CLOSED, 11 OPEN including 2 conditional inactive for CBT-R1.

| Blocker | Current status / required artifact | Dependency and responsible party |
|---|---|---|
| PB01 Controller/Processor allocation | OPEN; approved legal allocation | G7; Owner/legal |
| PB02 Retention periods/matrix | OPEN; approved retention matrix | G7/G8; Owner/legal/ops |
| PB03 DPIA | OPEN; required DPIA completed/approved or authoritative documented not-required determination | G7; Owner/qualified privacy authority |
| PB04 Authentication policy | CLOSED, DEC-041; remains closed | Policy implementation/regression still mandatory; identity/security executor |
| PB05 Permission Matrix | OPEN, artifact missing; OD-07 principles are not matrix closure | P5/G6; Owner/security reviewer |
| PB06 Capability testing | OPEN, qualified matrix, not ready for closure | Formal approved capability/device criteria and real evidence; P8/school testers |
| PB07 Zero-Lost-Answer verification | OPEN, formal artifact missing | Full G3 including running-room moves, restart and storms; assessment executor/reviewer |
| PB08 Care safeguarding | OPEN / conditional, inactive for CBT-R1 | No Care launch/work; Owner must reopen scope first |
| PB09 Partner verification/moderation | OPEN / conditional, inactive for CBT-R1 | No Partner launch/work; Owner must reopen scope first |
| PB10 Classification/consent governance | OPEN; approved artifact missing | G7; Owner/legal |
| PB11 Backup/restore verification | OPEN; local procedure/drill does not close production gate | P9/G8; school infrastructure operator/ops |
| PB12 Incident readiness | OPEN; approved readiness, owner, duties and contacts missing | P5/P9/G6; Owner/security/incident lead |

Already LOCKED OD-05–OD-09 are not re-opened: identity matching/recovery/data visibility, role authorities/institution organizer, STANDAR signals and own finalized per-exam publication. Required remaining inputs: final ELLIGBLE ID format (AUTH-001); P2 exact type/scoring/identity/transfer/signal rules; approved P5 detailed matrix; school VPS/domain/access/backup facts (topology already chosen); real-device inventory, school UAT signatories, legal contacts; P6 measurable budgets; P9/P10 operating/release facts. These require their applicable planning approval or Owner/external decision, not guesses here.

OPEN-05 participant removal, D04.5-48 late-answer policy and OD-10 repository-visibility decision stay OPEN as tracked in living plan §7/§14. Do not invent defaults beyond existing documented implementation. P11 re-evaluates carried IDs RESULT-003, SEC-001, AUTH-001, ADMIN-001, ASSESS-STUDENT-001, UI-SYSTEM-005, ASSESS-PROCTOR-003 and OPS-001 under 00.12 §10; decided OD-08/09 do not automatically make Tasks READY. UI-SYSTEM-005 remains BLOCKED on approved-project access, not a release-scope shortcut. Owner's 2026-10-27 deferral of noncritical polish/redesign/cosmetic sticky-header work is preserved (E7 §9.6), without waiving minimum accessibility, functional defects or security/integrity/readiness gates.

## 8. P2–P10 and P11 prerequisites

This dependency map is planning input, not detailed successor specifications, new Task registrations or execution authorization. Existing artifacts are reused before additions. P1 approval alone is insufficient for P11 approval or feature execution.

| Phase | Reuse | Required sufficient output / approval before baseline or release use |
|---|---|---|
| P2 Domain/business | Discovery 02/04, Blueprint 02.01/02.05, academic/assessment runtime | Exact all-type payloads/scoring/manual grading; claim/matching/recovery/uniqueness/data rules; running room transfer safety/session semantics; STANDAR signals/incidents; institution organizer/workflow. Resolve actual OPEN decisions through Owner; no policy guesses |
| P3 Workflow/routes | Living plan §2, route-parity tests | ROUTE_INTERACTION_MATRIX.md mapping every required role/journey/route/interaction/state/error/recovery/auth rule, gaps and tests, covering new scope without dead controls |
| P4 Architecture | Architecture exit artifacts, ADR-001, domain ownership | Confirm reusable boundaries; justified ADRs only where required (e.g. media storage/signal ingestion), compatibility and cost/security impact; no stack rewrite |
| P5 Security | Identity/security architecture, MB-06, DEC-041, OD-07/07b | Approved detailed CBT permission matrix PB05; privacy/identity/negative-test and incident requirements; PB closure remains evidence-controlled |
| P6 Reliability/performance | Critical assessment/reliability architecture, runtime idempotency | PERFORMANCE_AND_LOAD_PLAN.md, approved numeric budgets/workloads for about 1,000 students, contention/recovery/storms/NAT; measured evidence needed at G4 |
| P7 UX/localization | Locked design/copy/token/shadcn system; completed UI Tasks | Required new-screen inventory; mobile/keyboard/touch/error/recovery acceptance using one product system; Bahasa Indonesia; no cosmetic expansion or token supersession |
| P8 Verification/DoD | Existing full CI, PostgreSQL and five E2E projects | All required journey/type/role negative and regression coverage plan; PB06 real-device protocol and PB07 server-answer scenario artifact plan; full release evidence before G3/G5 |
| P9 Infrastructure/ops | ADR-001, runbook/deploy/preflight/monitoring | Confirm school VPS resources/domain/access/database major; backups/encrypted off-host/restore/monitoring/incident plan and audited intervention replacement. No production actions by coding agent; actual evidence before G6/G8 |
| P10 Release/UAT/rollback | Runbook release/rollback procedures | Staging/migration rehearsal, school role UAT protocol/signatories, rollback target/backup readiness, release database and cost declaration; actual evidence before G9 |
| P11 Finite Task baseline | Living plan §6 history and completed pre-baseline Task records | P1–P10 sufficient and approved at applicable gates; dependency-valid bounded contracts, risks/acceptance/evidence and baseline counters; Owner approval. TASK_PLAN.md created only by separately authorized P11 work |

At P11, pre-adoption capabilities are reused with commit/CI evidence and not counted as new baseline DONE. PRE-P11 Tasks remain history, NOT COUNTED IN P11 BASELINE. Missing implementation and release evidence must be represented as remaining dependency-valid work, not erased because P1 documentation passes. No baseline totals/progress percentage is asserted here.

## 9. P1 acceptance and approval boundary

P1 is acceptable only when: every DEC-044 §3 area and §4 role maps to the explicit rows above; G1–G10 and PB01–PB12 are complete and retain actual OPEN states; each row has implementation/evidence/gap/dependency/responsibility and a testable acceptance predicate; P2–P11 inputs and unresolved quantitative budgets are explicit; canonical invariants/OD policies/deferred domains are unchanged; source references resolve; and no claim exceeds evidence. Existing UI Part 1/2/3 completion and production prioritization are retained.

GOV-REALIGN-003 additionally requires its six-file diff/local deterministic guards, exact content-commit automatic attempt-1 eight-job SUCCESS on ubuntu-24.04, **Independent HIGH-risk Review PASS**, and **explicit Owner P1 approval** before one Task-record-only evidence commit may mark it DONE. Execution authorization is not P1 approval. Reviews/status/CI are recorded in [the Task record](tasks/GOV-REALIGN-003.md); this derived document remains submitted until an approved record establishes acceptance. This Task cannot claim release gates passed, deploy, merge or start another Task.
