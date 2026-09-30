**Status:** LIVING PLAN (DEC-042) — the only live execution tracker
**Canonical:** YES for current production state, gaps, critical path and next work. Does not override LOCKED decisions.
**Last Updated:** 2026-09-30
**Audit Baseline:** `3a69883544ac3750b17fe5e4bdbd0f41b3608b07` (BU-090 terminal)

# ELLIGBLE Production Completion Plan

## 1. Current production state

**Verdict: NOT production-ready.** The Secure Assessment journey now works end to end on this branch against real PostgreSQL (§2): school onboarding through the audited operator CLI with activation cards, account activation, login, school context, teacher readiness and activation, student start, one active exam session per attempt with explicit takeover, local-first durable answers (offline, reload, browser restart), server timer with automatic submission, and idempotent submission. The release is a single container (API and built client from one origin) with startup preflight, structured logs and a verified local restore procedure (§9); CI runs the unit and PostgreSQL integration suites, a browser end-to-end suite against the production process and the image smoke test. What still blocks a production deployment: a production infrastructure with TLS, backups and a restore drill (PB11), and the Owner/legal Production Blockers (§8). The product is ready for a supervised pilot on such an infrastructure once the Owner/legal blockers allow real student data.

Audit baseline findings (`3a69883`), kept for traceability. The repository held strong, well-tested Secure Assessment building blocks (answer persistence, server-authoritative timer, idempotent submission, one-active-session, readiness preflights, rooms/proctors, identity sessions, tenant membership resolution) and browser screens for student, proctor and teacher views, but they were not wired into a usable product:

- There is no login endpoint, no logout, no browser session transport and no login screen. The web client sends no credentials.
- The production server (`runtime/secure-assessment/src/main.ts`) wires `getAuthorizedContext` to `null`, so every attempt route (resume, questions, timer, answer save, submit, expiry finalize, session activate) returns 403 in production. Proctor monitoring and teacher readiness have no production context and also return 403. Only `GET /assigned-exams` resolves a real session (BU-090), but no client can send one.
- Nothing creates Exam Attempts or timer state, and nothing moves an exam beyond `SCHEDULED` (no READY / ACTIVE transition). Questions require `ACTIVE`, so a student can never reach a question.
- The browser answer path keeps answers only in memory. The local-first IndexedDB recovery store, queue and retry controller exist as tested modules but are not used by the web client (LOCKED D04.3-83A/B, D04.5-05/06/15/16).
- There is no migration runner, no provisioning path for tenants/accounts/memberships, no production static hosting of the web client, no deployment configuration and no CI.

## 2. Integrated dependency map

Status on this branch (baseline findings in §4-§5). Rows marked E2E are exercised in CI by the browser suite (`e2e/`) against the production process.

| Journey step | UI | HTTP route | AuthN / AuthZ | Status |
|---|---|---|---|---|
| Login / logout / session | `LoginScreen`, `ReauthDialog`, shell "Keluar" | `/api/v1/auth/login`, `/logout`, `/session` | IdentityRuntime (DEC-041 policy) | **WORKS** (integration-tested) |
| Tenant selection / context | `TenantPicker`, shell label, "Ganti Sekolah" | `/api/v1/me/context` + `X-Tenant-ID` | membership re-validated per request | **WORKS** |
| Assigned exams | `AssignedExamDiscovery` | `GET /assessment/assigned-exams` | session → membership → participant.person_id | **WORKS** |
| Start attempt | "Mulai Ujian" with entry guidance | `POST /assessment/attempts/start` | session → membership → participant; eligibility | **WORKS** (integration + browser; E2E) |
| Launch / session activate, timer, questions, answers, resume, submit | `AttemptLaunch`, `StudentExamWorkstation` | attempt routes | session → membership → participant → attempt | **WORKS** (integration + real-browser journeys incl. refresh; E2E) |
| School onboarding | printable activation cards; "Aktivasi Akun" | operator CLI; `POST /api/v1/auth/activate` | platform operator (audited, case-linked); activation code proves the person | **WORKS** (real PostgreSQL: CLI process, activation, teacher opens the imported exam, student takes it; E2E) |
| Exam session per device / tab | `AttemptLaunch` takeover screen, "Sesi Dipindahkan" notice | `POST /assessment/session/activate`, `GET /assessment/resume?examSessionId=` | active session id never disclosed; takeover needs the fingerprint and explicit confirmation | **WORKS** (real PostgreSQL + real browser: second tab, duplicated tab; E2E) |
| Answers (local-first) | `useAnswerManager` on `AnswerSyncEngine` + IndexedDB | `POST /assessment/answer/save` | write needs the active exam session | **WORKS**: offline answering, reload/browser-restart recovery, retry with backoff, honest save states (real browser; E2E) |
| Proctor monitoring | `ProctorMonitoringView` | `GET /assessment/proctor-monitoring` | session → proctor assignments | **WORKS** (read; E2E) |
| Exam-day participant monitoring | `ExamMonitoringView` ("Pemantauan Peserta", from "Lihat Peserta" and "Pantau Peserta") | `GET /assessment/exam-monitoring` | assigned proctor (their rooms, or the whole exam without room operations) or the managing teacher | **WORKS**: status, accepted answers and time, server time left, device moves, filters and ID search, visible freshness; no scores (integration; E2E) |
| Teacher operations | `TeacherReadinessView` ("Pelaksanaan Ujian") | `GET /assessment/teacher-readiness`, `POST /assessment/teacher-exams/transition` | session → teaching assignment of the exam | **WORKS**: readiness, "Tandai Siap", "Buka Ujian", aggregate progress (integration + browser; E2E) |
| Teacher results | `TeacherResultsView` ("Hasil Ujian", from "Lihat Hasil") | `GET /assessment/teacher-exams/results` | session → teaching assignment of the exam (not proctors, other teachers or participants) | **WORKS** (provisional): per-participant status and auto-score of finalized attempts, scores hidden until shown (integration; E2E) |
| Deep links / refresh | query-string routes under `/` | client served by the runtime with deep-link fallback | session re-checked on load | **WORKS** (production container, real browser) |

## 3. Role journeys (canonical actors, MB-03)

| Role | Works today | Incomplete | Blocks production |
|---|---|---|---|
| Student | activation, login, exam list with entry guidance, start, launch/takeover, workstation with local-first answers, "Ragu-ragu" marks, timer with reminders, submit and automatic submission, paused screen with frozen time and exact resume, ended note (ASSESS-LIFE-002) | seeing results (publication policy, §7) | none in the product (Owner/legal PBs, §8) |
| Teacher (teacher-managed mode, D04.4-26A) | activation, readiness, "Tandai Siap", "Buka Ujian", "Jeda Ujian", "Lanjutkan Ujian", "Akhiri Ujian" (ASSESS-LIFE-001), aggregate progress with who is still working, provisional results ("Hasil Ujian"); exams arrive through the audited operator import (pilot bridge) | exam/question authoring or import in the UI, result finalization, publication and export | none for the pilot; teacher authoring or import for scale |
| Proctor | monitoring read model and screen; exam-day participant list (who is expected, working, finished or moved) | Proctor Feed events, interventions (lock, add time, broadcast) | Feed is P1-11 |
| Platform operations | container release, preflight, logs, CI, runbook, audited provisioning CLI | school-admin self-service, metrics and alerting | PB11 drill on production infrastructure |
| School / tenant administration | onboarding by the platform operator (audited CLI): people with activation cards, academic setup through `runtime/academic-core` | school-admin self-service import (D02.7), academic management UI | none for the pilot; self-service for scale |
| Parent / Guardian | nothing | whole domain (schema, runtime, UI) | Milestone 7 |
| Partner | nothing | whole domain; PB09 policy | Milestone 6-7 |

Track, Care, Passport, Path, Opportunity, Application, Verified Connection, Outcome and Alumni are not started (Milestones 4-6). They are baseline scope but come after Secure Assessment on the critical path.

## 4. P0 gaps (production blockers in the product itself)

| ID | Gap | Evidence | Status |
|---|---|---|---|
| P0-1 | No login/logout/session HTTP endpoints; no login UI | no `/auth` route in `server.ts`; `App.tsx` had no login | **RESOLVED**: `POST /api/v1/auth/login`, `POST /api/v1/auth/logout`, `GET /api/v1/auth/session`; shadcn/ui login screen |
| P0-2 | Browser credential transport and tenant selection absent | `assessment-client.ts` sent no credentials | **RESOLVED**: HttpOnly `SameSite=Strict` cookie (`__Host-` + `Secure` in production), `X-Tenant-ID` via `apiFetch`, tenant picker, `GET /api/v1/me/context` |
| P0-3 | Attempt routes had no production authorization (always 403) | `main.ts` wired `getAuthorizedContext` to `null` | **RESOLVED**: `createAttemptAuthorizer` (session → membership → participant → attempt), real-PostgreSQL negative tests |
| P0-4 | Proctor monitoring and teacher readiness had no production context | `server.ts` passed undefined getters | **RESOLVED** for reads (session-derived person context); teacher operations remain P0-6 |
| P0-5 | No attempt + timer creation; no start eligibility | no insert paths; `timer.ts` start had no checks | **RESOLVED**: `POST /api/v1/assessment/attempts/start` (idempotent, concurrency-safe, eligibility with database time); timer start re-validates eligibility and applies the latest-start policy |
| P0-6 | No SCHEDULED→READY→ACTIVE transition | only `exam-instance-draft-to-scheduled-transition.ts` | **RESOLVED** (teacher-managed mode, D04.4-26A): `POST /api/v1/assessment/teacher-exams/transition` (`mark_ready` after all readiness checks; `activate` with final re-check and window guard), attributed append-only events (migration `0037`), teacher UI with confirmation |
| P0-7 | No way to put questions into an exam except raw SQL | no snapshot creation code | **RESOLVED** as a pilot bridge: `exam import` in the operator CLI creates a scheduled teacher-managed exam from `elligble-exam-v1` JSON and an `elligble-questions-v1` CSV (five-option single choice, random option ids, authored order, participants from enrollments, proctors); the teacher still marks it ready and opens it. Teacher-facing authoring or import in the UI remains to be built |
| P0-8 | Answers are memory-only in the browser (data-loss path) | `useAnswerManager.ts` | **RESOLVED**: every choice is written to IndexedDB before it is sent (`src/exam/answer-store.ts`), `AnswerSyncEngine` keeps one latest intent per question, retries with backoff and jitter, rebases on the latest server version, recovers after reload or browser restart (previous-session intents are replayed only if nobody answered since), reports "Tersimpan" only after the server acknowledgement, and falls back to memory with an explicit "do not close this page" warning when storage is unavailable |
| P0-9 | No production hosting of the web client / deep-link fallback | no static serving in `server.ts` | **RESOLVED**: the runtime serves the built client from memory (`SA_STATIC_DIR`; no filesystem access or traversal at request time), deep-link fallback, immutable hashed assets, gzip, ETag; `Dockerfile` builds one image for API and client |
| P0-10 | No migration runner / verification for real deployments | migrations applied only by one-off verifiers | **RESOLVED**: `npm run migrate` / `migrate:check` (advisory lock, history check, refuses unknown migrations) |
| P0-11 | No provisioning of tenants, persons, accounts, credentials, memberships | no runtime or CLI path | **RESOLVED** for pilot onboarding: account activation (migration `0039`, single-use expiring codes, own password with the DEC-022/DEC-041 policy, "Aktivasi Akun" screen) and the audited operator CLI (`provision-cli.ts`: school, people with printable activation cards, academic setup, exam, activation reissue; append-only `platform_provisioning_events`, migration `0040`; writes through the owning domain modules, including the new `runtime/academic-core`). School-admin self-service import (D02.7) remains to be built |

## 5. P1 gaps

| ID | Gap | Evidence / resolution | Status |
|---|---|---|---|
| P1-1 | One-active-session bypass: `GET /resume` returns the active exam session id, so any tab/device with the attempt id can write as that session (D04.1-42, D04.4-32/35) | **RESOLVED**: resume reports only `ownedByCaller` for the caller's own session id; activation conflicts return an opaque fingerprint; takeover requires it plus confirmation; the session id lives per tab (`sessionStorage`) and a duplicated tab is detected with a Web Lock | RESOLVED |
| P1-2 | Local-first queue replays stale `expectedWriteVersion` forever after two quick changes while offline (would never converge) | **RESOLVED for the product**: the web client uses `AnswerSyncEngine`, which sends with the latest known server version and converges; `client-answer-reconciliation-queue.ts` is not wired (REFERENCE ONLY) | RESOLVED |
| P1-3 | Username enumeration by timing (no password hash work for unknown usernames) | `identity-access/src/index.ts` `authenticate` — **RESOLVED** (constant key-derivation work for unknown/revoked accounts) | RESOLVED |
| P1-4 | No request body size limit (memory DoS) on JSON routes | `answer.ts`, `session.ts`, `submission.ts`, `timer.ts` buffer unbounded bodies — **RESOLVED** (64 KB limit in server pre-dispatch, 8 KB for login, 413) | RESOLVED |
| P1-5 | No security headers (CSP, frame, referrer, nosniff), no Origin/CSRF check | `server.ts` — **RESOLVED** (headers on every response, `no-store` API cache, HSTS when secure, Origin check on state-changing API calls) | RESOLVED |
| P1-6 | `transitionExamInstanceDraftToScheduled` defaulted to `granted` when no capability evaluator was passed (fail-open default) | `exam-instance-draft-to-scheduled-transition.ts`: **RESOLVED**, the evaluator is required and a missing one is denied before any database access | RESOLVED |
| P1-7 | Official `npm test` ran 6 of 46 secure-assessment test files; 2 broken test files never ran | **RESOLVED**: `npm test` runs all unit tests; broken `.js` import (also in `src/client-answer-save-state.ts`) and ordering test fixed | RESOLVED |
| P1-8 | No request/error logging, no metrics; startup logs only | `log.ts`: **RESOLVED** for logging: one JSON line per request (request id, method, path without query, status, duration), 5xx at ERROR, unhandled errors by class and code only, `X-Request-ID` correlation; metrics remain open | RESOLVED |
| P1-9 | Design tokens in code drifted from LOCKED design system v1.1.0 (navy actions/focus, slate neutrals, radii, undefined tokens) | **RESOLVED** in `design-tokens.css` + component CSS; screens still use hand-written CSS (migration to shadcn/ui components is incremental) | RESOLVED |
| P1-10 | Assigned-exam projection had no lifecycle/window/duration | **RESOLVED**: `schedule` + `serverNow` in the projection; the list explains when and why an exam can or cannot be started (D04.2-73) | RESOLVED |
| P1-11 | Proctor Feed (Kejadian/Pelanggaran) not implemented (D01, D04.1-54) | no feed tables/routes. First part done: the exam-day participant list (D04.6-01/02/03/04/10/17/18/60/61) from server facts, including session moves (D04.6-30). Remaining: device-side signals and their policy (D04.6-19..32, D04.7 presets), incidents, control actions, broadcast | OPEN (in progress) |
| P1-13 | Shared-device hygiene: remembered school choice leaked to the next account; re-authentication could accept another account while keeping the previous context | found in rendered checks — **RESOLVED** (logout clears the choice; re-login locked to the same ELLIGBLE ID) | RESOLVED |
| P1-14 | Infrastructure-level login rate limiting (whole schools share one NAT address, so per-IP limits must be generous) | per-account policy exists (DEC-041) | OPEN (configure at the edge) |
| P1-15 | Question order followed random snapshot UUIDs, not the authored order (D04.3-41, D04.2-57..59) | **RESOLVED**: migration `0038` adds a positive, per-exam unique `display_order` written when the snapshot is created (snapshots stay immutable); delivery orders by it, legacy rows follow by id; real-PostgreSQL test with identifier order opposite to the authored order | RESOLVED |
| P1-16 | Tenant/school time zone is not configured (D04.2-36); times display in the device zone | **RESOLVED**: migration `0043` adds an explicit IANA zone per school, required by `school create` and changed only by the audited `school set-time-zone`; `GET /me/context` returns it and the web client formats every date and time in it (WIB, WITA, WIT) whatever the device zone; activation cards use it. Verified with the browser clock in UTC | RESOLVED |
| P1-17 | No ENDED / PAUSED transitions: end-of-exam handling of active attempts (D04.2-81) and timer behaviour during pause (D04.2-77) are policy-open; timer expiry already auto-submits each attempt | **RESOLVED**: server semantics and teacher controls (ASSESS-LIFE-001), student exam screen and pre-pause answer protocol (ASSESS-LIFE-002) | RESOLVED (§6, §7) |
| P1-18 | Readiness preflights accepted only SCHEDULED, so READY could not be re-evaluated (D04.2-25) or re-checked at activation (D04.2-68) | 10 preflight guards | **RESOLVED**: shared `readiness-states.ts` (SCHEDULED or READY) |
| P1-12 | Historical one-off verifiers are point-in-time: 14 of 44 fail on current schema by design | **RESOLVED** as a gate: durable suite `npm run test:integration` (disposable databases); historical verifiers are REFERENCE ONLY | RESOLVED |
| P1-26 | An invalid or expired session without a usable `X-Tenant-ID` was answered 403 instead of 401, so a client could treat an expired session as a permanent refusal (an answer save marked failed instead of prompting re-login) | found by the production-wiring probe in `test/integration/startup.test.ts`: **RESOLVED**, the credential is validated before the tenant locator; the probe asserts 401 on every protected route with and without a tenant locator | RESOLVED |
| P1-19 | Countdown drifted: an interval re-created every second, throttled in background tabs | **RESOLVED**: monotonic deadline from the server's remaining seconds, resync on focus, visibility and reconnect (D04.5-27/28) | RESOLVED |
| P1-20 | Automatic submission was tried once: a network failure left "Waktu Ujian Telah Habis" forever, and a device clock ahead of the server (`timer_not_expired`) got stuck | **RESOLVED**: pending answers are flushed first (D04.5-46), finalization retries with backoff (D04.5-45/49), the exam continues when the server still has time | RESOLVED |
| P1-21 | A failed submission used a blocking `alert()` | **RESOLVED**: inline message in the confirmation dialog, retry is safe (idempotent submit) | RESOLVED |
| P1-22 | Offline answers captured before expiry but delivered after it are rejected by the server | D04.5-48 treats them as an exception case with a deferred reconciliation policy. The student is told honestly how many choices the server did not receive; no silent loss claim. OPEN (policy deferred, not blocking) | OPEN |
| P1-23 | Save did not validate the answer payload against the frozen question (any JSON was stored; option ids unchecked) | **RESOLVED**: `isAnswerForQuestion` in `answer.ts` accepts exactly `{ selectedOptionId }` naming an option of the frozen MULTIPLE_CHOICE_SINGLE question (D04.3-21), otherwise 400 `invalid_answer_payload` and nothing is stored | RESOLVED |
| P1-24 | "Ragu-ragu / Tandai" flag for review (D04.5-34/35) not implemented | **RESOLVED**: migration `0042` stores marks apart from answers; `POST /assessment/review-flag` only for the attempt's active exam session while it is open (not after submission or time expiry); resume returns the marks; the question card has a "Ragu-ragu" checkbox, both navigators show an amber corner and a count, the submit dialog reminds without blocking; unsent marks stay on the device across a reload and retry; teachers, proctors and scoring never read them | RESOLVED |
| P1-27 | An attempt whose time ran out while the student's device was unreachable stayed open indefinitely: only the device triggered expiry finalization (D04.5-45/47/49) | found while designing results: **RESOLVED**, the runtime finalizes such attempts from the server-accepted answers every `SA_EXPIRY_SWEEP_SECONDS`, skipping attempts held by an in-flight save or submit; every finalization path converges on one submission, which records its source (`STUDENT_SUBMIT`, `EXPIRY_CLIENT`, `EXPIRY_SERVER`, migration `0041`) so the D04.5-48 exception case stays visible | RESOLVED |
| P1-28 | No scoring or results: after an exam the teacher saw only counts (D04.8) | **RESOLVED (provisional)**: deterministic rule `BASELINE_SINGLE_CHOICE_V1` (correct option earns the question's maximum, otherwise 0, raw ÷ maximum × 100 rounded half up to two decimals, exact integer arithmetic) computed on read from the frozen snapshots and accepted answers of finalized attempts; `GET /assessment/teacher-exams/results` only for the teacher who manages the exam; "Hasil Ujian" screen lists participants by ELLIGBLE ID (never ranked), absent is not zero, shows how each attempt was finalized, keeps scores hidden until shown (FRONTEND_DESIGN_SYSTEM §58). Students see no score. Finalization, publication, export and corrections remain | RESOLVED (provisional) |
| P1-25 | Time reminders at configured thresholds (D04.5-32) were missing; only warning styling below 5 and 1 minutes | `StudentExamWorkstation`: **RESOLVED** with the decision's default thresholds (30, 15, 5 minutes): a non-blocking status line with the actual remaining minutes, hidden after 10 seconds; school-defined thresholds await tenant settings | RESOLVED |

## 6. Production task graph

Planning aids only: these identifiers are not Build Units and have no lifecycle stages (DEC-042). One coherent, verified product result per task; every active or backlog task carries its scope, dependencies and verification. Status values: BACKLOG, READY, IN_PROGRESS, BLOCKED, VERIFYING, DONE. Priority: P0 blocks safe production or risks data loss or security; P1 blocks a required baseline journey; P2 important reliability, quality or operations; P3 post-baseline. Work-in-progress limit: 3.

### 6.1 Views

**CRITICAL PATH:** ~~ASSESS-LIFE-001~~ → ~~ASSESS-LIFE-002~~ → RESULT-001 → RESULT-002 → PR checkpoint → ASSESS-PROCTOR-001 → ASSESS-PROCTOR-002.

| View | Tasks |
|---|---|
| IN PROGRESS | RESULT-001 |
| READY QUEUE (by value) | RESULT-002 (after RESULT-001), ASSESS-PROCTOR-001, ASSESS-PROCTOR-002, OPS-002, OPS-003, E2E-001, ASSESS-TEACHER-001 |
| BLOCKED | UI-001 (Owner), RESULT-003 (Owner), SEC-001 (Owner), AUTH-001 (Owner), ADMIN-001 (Owner, PB05), ASSESS-STUDENT-001 (Owner, D04.5-48), ASSESS-PROCTOR-003 (canonical review), OPS-001 (external infrastructure) |
| RECENTLY COMPLETED | ASSESS-LIFE-002, ASSESS-LIFE-001, TOOL-001, ASSESS-PROCTOR-000, ASSESS-TEACHER-000, ASSESS-STUDENT-002, ASSESS-SCHOOL-000, ASSESS-TIME-000, E2E-000, PROV-000 (see 6.3) |

### 6.2 Active and backlog tasks

#### ASSESS-LIFE-001 · Exam pause, resume and end on the server, with pause-aware time

| Field | Value |
|---|---|
| Workstream / priority / status | ASSESS-LIFE / P1 / DONE |
| Dependencies / blocks | none / ASSESS-LIFE-002, RESULT-001 |
| Repository evidence | `exam-lifecycle-operations.ts` implements only SCHEDULED→READY→ACTIVE; the schema already allows PAUSED and ENDED (`0025`, `0037`); elapsed time is computed from `started_at` in eight places (answer, submission, timer x2, resume, question delivery, review flag, expiry sweep, monitoring), none aware of pauses |
| Why | Owner decision 2026-09-30 (§7) on D04.2-77/81; D04.2-74 whole-exam pause, D04.2-80/82, D04.6-48 (whole-exam pause at higher scope, not every room proctor) |
| Exact scope | PAUSE (ACTIVE→PAUSED), RESUME (PAUSED→ACTIVE), END (ACTIVE→ENDED) by the teacher who manages a teacher-managed exam; idempotent (a repeat returns `changed: false` and records nothing); audited in lifecycle events plus exact pause boundaries (`secure_assessment_exam_pauses`, closed once by the resume, never deleted); `secure_assessment_attempt_elapsed_seconds` / `_remaining_seconds` subtract pause intervals and are used by every time computation, so remaining time freezes at the boundary and resumes exactly; the boundary is taken under the exam row lock that every attempt write shares, so a write either lands before it or waits and sees the pause; guards: no new attempt or timer start while PAUSED (`exam_paused`) or ENDED (`exam_ended`); while PAUSED no question content, review mark or submission, and an answer is accepted only when its declared capture time is before the boundary (`exam_paused` otherwise, with the boundary); after a resume an answer declared as chosen inside a pause is refused (`captured_during_pause`); expiry follows the frozen time (an attempt whose time ran out before the pause is still finalized); ENDED leaves running attempts to their own deadline (questions, saves and submission keep working); timer and resume report the exam state, pause start and server time; teacher controls "Jeda Ujian", "Lanjutkan Ujian", "Akhiri Ujian" with confirmations, readiness and monitoring show the pause and who is still working; the web client keeps answers and review marks queued while paused (nothing dropped) |
| Out of scope | room-level and participant-level pause (D04.2-75/76, ASSESS-PROCTOR-001); proctor-initiated pause (PB05); forced submission at end (not in the Owner decision); END while PAUSED (resume first: no invented policy) |
| Expected product result | a teacher can pause, resume and end an exam; server time and all enforcement follow the Owner semantics on every path |
| Surfaces | migration `0044`, `exam-lifecycle-operations.ts`, `server.ts`, `attempt-eligibility.ts`, `attempt-start.ts`, `timer.ts`, `answer.ts`, `submission.ts`, `review-flag.ts`, `resume.ts`, `question-delivery.ts`, `expiry-finalization.ts`, `exam-monitoring.ts`, `teacher-readiness.ts`, `TeacherReadinessView.tsx` |
| Verification | focused unit; real-PostgreSQL integration: frozen and exact remaining time across pause and resume, idempotent and audited transitions, every guard, END with running attempts, sweeper never expires a paused attempt, authority refusals; web component tests; E2E in ASSESS-LIFE-002 |
| Owner decision | resolved (§7) |
| Commit / PR | this change (see §11) |

#### ASSESS-LIFE-002 · Student exam screen under pause and end, without losing pre-pause answers

| Field | Value |
|---|---|
| Workstream / priority / status | ASSESS-LIFE / P1 / DONE |
| Dependencies / blocks | ASSESS-LIFE-001 (DONE) / RESULT-001 E2E |
| Repository evidence | the server contract exists (ASSESS-LIFE-001: optional `capturedAt` on answer save, `exam_paused` with the boundary, `captured_during_pause`, `examState`/`pausedAt`/`serverTime` on timer and resume, `exam_paused` on questions, marks and submit); the client sends no capture time, records only a device-clock `capturedAt` (`answer-store.ts`), keeps one latest intent per question (`answer-sync-engine.ts`) and only retries `exam_paused`; the workstation learns server state only on load, focus, visibility and reconnect |
| Why | Owner decision points 4, 6, 7, 8 and 9: clearly paused UI, no edits while paused, no loss of answers captured before the boundary, exact resume, safe across reload, reconnect and takeover |
| Exact scope | server-anchored capture time for every intent (clock offset from server responses); a short per-question intent history so that, when the server refuses an intent captured inside a pause, the latest intent captured before the pause (or after resume) is sent instead; `exam_paused` holds the queue (nothing is dropped) until resume; `captured_during_pause` drops only that intent, with an honest notice; periodic lightweight state check while working; paused screen that hides question content and shows the frozen time; resume restores the workstation with the exact remaining time; ENDED shows a calm note and lets the attempt finish; review marks wait during a pause |
| Out of scope | answers delivered after the attempt's time expired (D04.5-48, ASSESS-STUDENT-001) |
| Expected product result | students see pause and end correctly on every device; no legitimate answer is lost and no edit made during a pause counts |
| Surfaces | `answer-store.ts`, `answer-sync-engine.ts`, `answer-sync-api.ts`, `useAnswerManager.ts`, `useAuthoritativeTimer.ts`, `useReviewFlags.ts`, `StudentExamWorkstation.tsx`, `AssignedExamDiscovery.tsx`, `answer.ts` (capture-time check) |
| Verification | engine unit tests (hold, fallback to pre-pause intent, drop, restart recovery); workstation tests; real-PostgreSQL capture-time refusals; E2E: pause while working, reload while paused, offline device answering through an unannounced pause, resume with identical remaining time, end with a running attempt |
| Owner decision | resolved (§7); pause screen hides question content so no working time is gained (Owner points 3 and 4) |
| Delivered | server-anchored capture time (`server-clock.ts`: offset from the server time in timer, resume and save responses, shortest round trip wins, kept on the device for an offline reload); every save carries it; each waiting intent keeps its earlier unacknowledged choices; `exam_paused` settles every intent against the boundary (the latest choice outside every known pause is sent, even during the pause; otherwise the server answer stays) and switches the screen to "Ujian Dijeda"; `captured_during_pause` does the same with the closed interval; the engine ignores new choices while it knows the exam is paused; dropped choices are named ("Pilihan jawaban pada soal 3 dibuat setelah ujian dijeda sehingga tidak disimpan") until the student confirms; the workstation checks the exam state every 15 s (5 s while paused, with jitter) and on reconnect or visibility; the paused screen hides the questions, shows the frozen time and whether the pre-pause answers are saved, and survives a reload; resume applies the server's remaining time and reloads the questions; ENDED shows "Guru telah mengakhiri ujian. Anda tetap dapat menyelesaikan sampai waktu Anda habis." |
| Known limits | a device learns of a resume within about 5 s and of a pause within about 15 s unless it saves sooner (the server's time is exact either way, so up to about 5 s of the resumed time may pass before the screen shows the questions again); the capture time is accurate to about half a network round trip; a modified client could declare a false capture time, which gains nothing beyond answering right after the resume |
| Commit / PR | this change (see §11) |

#### RESULT-001 · Result finalization after an ended exam

| Field | Value |
|---|---|
| Workstream / priority / status | RESULT / P1 / READY |
| Dependencies / blocks | ASSESS-LIFE-001 / RESULT-002, RESULT-003 |
| Repository evidence | results are provisional and computed on read (`teacher-results.ts`); nothing freezes them; lifecycle has no FINALIZED transition |
| Why | Owner decision point ENDED-5; D04.8-17/18/19/20/57, D04.2-83 |
| Exact scope | ENDED→FINALIZED by the managing teacher only when no attempt is still running; results frozen as stored per-attempt scoring records (rule id, raw, maximum, scaled, per-item outcomes) so later edits cannot change them; audited with actor, time, rule version; results screen shows "Final" |
| Out of scope | publication to students (RESULT-003, Owner); corrections after finalization (D04.8-26+, later) |
| Expected product result | a teacher closes an exam and gets stable, reproducible results |
| Surfaces | migration, `exam-lifecycle-operations.ts`, `scoring.ts`, `teacher-results.ts`, `TeacherResultsView.tsx` |
| Verification | real-PostgreSQL: refused while attempts run, frozen values unchanged by later snapshot or answer edits, idempotent, audited; E2E end to finalize |
| Owner decision | none (student visibility stays separate) |
| Commit / PR | pending |

#### RESULT-002 · Teacher result export

| Field | Value |
|---|---|
| Workstream / priority / status | RESULT / P2 / READY (parallelizable) |
| Dependencies / blocks | ASSESS-LIFE-001 (for the final flag) / none |
| Repository evidence | results only on screen (`TeacherResultsView.tsx`) |
| Why | D04.8-52 (export baseline-useful, formats later), D04.8-53 (provenance) |
| Exact scope | CSV download for the managing teacher with provenance and state (provisional or final); spreadsheet-safe values; printable view |
| Out of scope | Academic Core projection (D04.8-54), E-Rapor |
| Expected product result | a teacher can take results into their own gradebook |
| Surfaces | `TeacherResultsView.tsx`, a CSV builder, tests |
| Verification | unit (escaping, provenance), component, E2E download |
| Owner decision | none |
| Commit / PR | pending |

#### ASSESS-PROCTOR-001 · Participant lock and unlock

| Field | Value |
|---|---|
| Workstream / priority / status | ASSESS-PROCTOR / P2 / READY |
| Dependencies / blocks | ASSESS-LIFE-001 (shared time and guard model) / none |
| Repository evidence | no lock state; monitoring list exists (`exam-monitoring.ts`) |
| Why | D04.6-38 (lock preserves answers), D04.6-39 LOCKED (direct unlock by the authorized proctor, scoped, audited), D04.2-76 |
| Exact scope | lock and unlock of one participant by an assigned proctor within scope or the managing teacher; locked runtime cannot edit; audited |
| Out of scope | participant pause with frozen time (D04.6-40, separate), step-up authentication |
| Expected product result | a proctor can stop and release one student's work without affecting others |
| Surfaces | migration, runtime guard, monitoring screen, workstation locked state |
| Verification | real-PostgreSQL scope and guard tests, E2E |
| Owner decision | none |
| Commit / PR | pending |

#### ASSESS-PROCTOR-002 · Broadcast messages to participants

| Field | Value |
|---|---|
| Workstream / priority / status | ASSESS-PROCTOR / P2 / READY |
| Dependencies / blocks | none / none |
| Repository evidence | no broadcast |
| Why | D04.6-49..55 (scopes, simple composer, templates, non-blocking, delivery state, audit, rate limit) |
| Exact scope | exam-wide and selected-participant messages from the managing teacher or an assigned proctor within scope; quick templates; non-blocking banner in the workstation; audited; rate limited |
| Out of scope | room scope until rooms are used in the pilot; push channels |
| Expected product result | supervisors can inform students without interrupting answering |
| Surfaces | migration, routes, monitoring screen, workstation banner |
| Verification | integration, component, E2E |
| Owner decision | none |
| Commit / PR | pending |

#### ASSESS-PROCTOR-003 · Device signals and incidents in the Proctor Feed

| Field | Value |
|---|---|
| Workstream / priority / status | ASSESS-PROCTOR / P2 / BLOCKED (canonical review) |
| Dependencies / blocks | review of D04.7 presets, privacy and proportionality / none |
| Repository evidence | no client event reporting; P1-11 |
| Why | D04.6-19..37, D04.7 |
| Exact scope | to be fixed after confirming which signals the canonical preset enables for teacher-managed exams without new policy |
| Out of scope | camera or screen evidence (D04.7, permission-limited) |
| Expected product result | proportional, explainable events for supervisors |
| Surfaces | client reporting, feed tables, monitoring screen |
| Verification | integration, E2E, privacy review |
| Owner decision | possibly, if presets need a choice |
| Commit / PR | pending |

#### ASSESS-TEACHER-001 · Teacher question import in the product

| Field | Value |
|---|---|
| Workstream / priority / status | ASSESS-TEACHER / P2 / READY |
| Dependencies / blocks | none / retires the operator exam-import bridge |
| Repository evidence | exams enter only through the operator CLI (`ops/provisioning/exam.ts`) |
| Why | D04.4-26A (teacher creates teacher-managed exams), D04.3 import rules |
| Exact scope | teacher uploads the `elligble-questions-v1` CSV and schedules an exam for their own teaching assignment, reusing the validated import path |
| Out of scope | question bank authoring UI, media |
| Expected product result | teachers prepare exams without platform staff |
| Surfaces | routes, `exam-provisioning.ts`, teacher screens |
| Verification | integration, E2E |
| Owner decision | none |
| Commit / PR | pending |

#### OPS-002 · Metrics and alerting

| Field | Value |
|---|---|
| Workstream / priority / status | OPS / P2 / READY (parallelizable) |
| Dependencies / blocks | none / none |
| Repository evidence | JSON logs only (§9) |
| Why | D04.9 operations, PB12 |
| Exact scope | an internal metrics endpoint (requests, errors, save latency, pending finalizations) protected from the public, and documented alert rules on logs and metrics; no new vendor |
| Out of scope | choosing a hosted monitoring vendor |
| Expected product result | operators see exam-day health |
| Surfaces | runtime, runbook |
| Verification | unit, integration, runbook drill |
| Owner decision | none |
| Commit / PR | pending |

#### OPS-003 · Edge rate limiting guidance and defaults

| Field | Value |
|---|---|
| Workstream / priority / status | OPS / P2 / READY (parallelizable) |
| Dependencies / blocks | none / OPS-001 |
| Repository evidence | P1-14; runtime has per-account login limits only |
| Why | whole schools share one address, so per-IP limits must be generous |
| Exact scope | reference reverse-proxy configuration with TLS, HSTS and generous per-IP limits in the runbook, tested against the container |
| Out of scope | provisioning real infrastructure (OPS-001) |
| Expected product result | a deployable, reviewed edge configuration |
| Surfaces | runbook, `deploy/` example |
| Verification | local proxy smoke test |
| Owner decision | none |
| Commit / PR | pending |

#### E2E-001 · Browser capability evidence beyond Chromium

| Field | Value |
|---|---|
| Workstream / priority / status | E2E / P2 / READY (parallelizable) |
| Dependencies / blocks | none / PB06 artifact |
| Repository evidence | E2E runs Chromium at 360 px only |
| Why | PB06 capability testing, AGENTS split-screen honesty |
| Exact scope | run the critical journeys in Firefox and WebKit projects in CI and a tablet and desktop viewport; record platform limits honestly |
| Out of scope | native apps |
| Expected product result | evidence for the PB06 artifact |
| Surfaces | `e2e/playwright.config.ts`, CI |
| Verification | CI |
| Owner decision | none |
| Commit / PR | pending |

#### Blocked tasks

| ID | Title | Priority | Blocked by | What unblocks it |
|---|---|---|---|---|
| UI-001 | Align the UI with the DesainPakeAI design direction | P2 | OWNER | The DesainPakeAI project holds no ELLIGBLE screens (its pages are a sales-dashboard sample) and its "Provenance Thread" foundation adds a serif display face, a mint brand accent and a thread device that the LOCKED FRONTEND_DESIGN_SYSTEM v1.1.0 does not have (§10). Owner to confirm which parts supersede the locked system, or to add ELLIGBLE screens to the project |
| RESULT-003 | Publish results to students | P1 | OWNER | Student result visibility decision (§7) |
| SEC-001 | Roles beyond explicit assignments | P1 | OWNER | PB05 Permission Matrix |
| AUTH-001 | Final ELLIGBLE ID format and generation | P2 | OWNER | D02.10-C |
| ADMIN-001 | School-administrator self-service import | P2 | OWNER | PB05 (who is a school administrator) |
| ASSESS-STUDENT-001 | Answers delivered after time expiry | P2 | OWNER | D04.5-48 deferred policy (P1-22) |
| ASSESS-PROCTOR-003 | Device signals and incidents | P2 | canonical review | D04.7 preset scope for teacher-managed exams |
| OPS-001 | Production infrastructure: TLS, backups, restore drill | P0 for launch | EXTERNAL | A hosting account and database service chosen by the Owner (PB11); legal blockers PB01/02/03/10 for real student data |

### 6.3 Recently completed

| ID | Result | Evidence |
|---|---|---|
| ASSESS-LIFE-002 | Student exam screen under pause and end; answers chosen before a pause are never lost | this change (§11) |
| ASSESS-LIFE-001 | Exam pause, resume and end on the server with pause-aware time; teacher controls | `a40565e` |
| TOOL-001 | DesainPakeAI CLI authenticated at user level (no repository file holds the key), skill installed, project and context verified (§10) | `2459f48` |
| ASSESS-PROCTOR-000 | Exam-day participant monitoring (P1-11 part 1) | `451c7ed`, CI run 17 |
| ASSESS-SCHOOL-000 | School time zone (P1-16) | `b24dcd0`, CI run 16 |
| ASSESS-STUDENT-002 | "Ragu-ragu" review marks (P1-24) | `8a5b711`, CI run 15 |
| ASSESS-TEACHER-000 | Provisional teacher results (P1-28) | `d940135`, CI run 14 |
| ASSESS-TIME-000 | Server finalization at time expiry (P1-27) | `4ded1ba`, CI run 13 |
| E2E-000 | Browser E2E in CI | `adc6b8a`, `527b969`, CI run 11 |
| PROV-000 | Audited provisioning, activation, authored order, answer contract | `9af8a16`, `8245bc4`, `1b96c61` |
| Foundation | Governance, test gate, auth, start, teacher operations, local-first answers, production operations (critical path steps 1 to 8 of the previous plan) | `ed9125e` … `7b022f2` |

## 7. Owner decisions

| Item | Needed for | Recommended default | Status |
|---|---|---|---|
| DesainPakeAI credentials | Verifying UI against project `b5a22aa4-...` | Key supplied by the Owner for this environment | DONE 2026-09-30: CLI authenticated at user level, no key in the repository (§10) |
| DesainPakeAI design direction versus the LOCKED design system (UI-001) | Aligning screens with the DesainPakeAI project | Keep the LOCKED ELLIGBLE tokens and components until the Owner confirms which parts of the project's "Provenance Thread" foundation supersede them, or adds ELLIGBLE screens to the project | OPEN (§10) |
| PB05 Permission Matrix | Production launch; roles beyond explicit assignments | Keep assignment-scoped least privilege until the matrix is approved | OPEN |
| PB01, PB02, PB03, PB10 (legal allocation, retention, DPIA, classification/consent) | Production launch with real student data | Owner/legal artifacts | OPEN |
| Centralized (institution-managed) exam governance roles (D04.4-26D/E) | Activation of non-teacher-managed exams | Teacher-managed mode first | OPEN (not blocking critical path) |
| End-of-exam handling (D04.2-81) and pause timer behaviour (D04.2-77) | ENDED / PAUSED operations | ENDED: no new attempt starts; active attempts are not force-submitted and keep their own server-authoritative remaining time, finishing by normal submission or automatic submission at their own expiry; finalization only when no active attempt remains; ENDED does not publish results. PAUSED: no new starts; every active attempt's remaining time freezes at the authoritative pause boundary; no extra working time; the exam screen becomes paused and read-only; no new answer edits accepted; answers captured before the boundary are not lost because they had not synced yet; RESUME continues from exactly the pre-pause remaining time; PAUSE/RESUME idempotent, audited, safe across reload, reconnect and the session rules | RESOLVED 2026-09-30 by the Owner; implemented by ASSESS-LIFE-001 and ASSESS-LIFE-002 (§6) |
| ELLIGBLE ID format and generation (D02.10-C) | Account provisioning at scale | Until decided, operators supply IDs in a conservative syntax (3 to 64 lower-case letters, digits, dot, dash, underscore; not e-mail based); the platform only checks uniqueness | OPEN (not blocking the pilot) |
| Activation code validity (D02.3-09 "short-lived") | Activation cards | 7 days by default, operator may choose 1 to 30 days per issue | IMPLEMENTED DEFAULT, adjustable |
| Student result visibility (D04.8-16/21/22: options exist, "exact school-facing options later") | Showing scores to students | Hidden until the teacher publishes a finalized result, per exam; only the student's own score, no ranking or peer results (D04.8-50/51) | OPEN (students see no scores today; teachers see provisional results) |
| Exam content import by platform operators on behalf of teachers | Pilot exams before a teacher authoring or import screen exists | Audited, case-linked operator import; teachers keep readiness and activation | IMPLEMENTED AS PILOT BRIDGE |

## 8. Production Blockers (PB01-PB12)

| PB | Status | Engineering contribution on the critical path |
|---|---|---|
| PB01 Controller/Processor allocation | OPEN (Owner/legal) | none |
| PB02 Retention matrix | OPEN (Owner/legal) | none |
| PB03 DPIA | OPEN (Owner/legal) | none |
| PB04 Authentication policy | CLOSED (DEC-041) | implement the policy in HTTP/session transport (step 3) |
| PB05 Permission Matrix | OPEN | assignment-scoped authorization only; no invented policy |
| PB06 Assessment Capability Testing | OPEN | browser E2E suite in CI DONE (step 9: pilot journey, resilience and refusals at 360 px, Chromium); capability evidence across devices and browsers, split-screen/multi-window limits and the formal test artifact remain |
| PB07 Zero-Lost-Answer Verification | OPEN | local-first answers DONE (step 6); fault-injection E2E in CI DONE (step 9: offline, saves failing across a reload, takeover, session ending mid-exam, each checked against the server's stored answers); the formal verification artifact remains |
| PB08 Care safeguarding | OPEN (conditional) | none until Care |
| PB09 Partner moderation | OPEN (conditional) | none until Partner |
| PB10 Data classification + consent | OPEN (Owner) | none |
| PB11 Backup + restore verification | OPEN | runbook procedure DONE and drilled locally (dump, restore, `migrate:check`, container start, login); the drill on the production infrastructure and retention (PB02) remain |
| PB12 Security / incident response | OPEN | security headers, structured logs with request ids, session revocation path and incident basics in the runbook DONE; incident owner, notification duties and contacts are Owner decisions |

## 9. Production operations readiness

| Area | State |
|---|---|
| Environment config / validation | every variable validated at startup (`.env.example`): PostgreSQL URL scheme (never echoed), environment, port, pool, cookie security (cannot be off in production), allowed origins, migration mode (cannot be `off` in production), bounded database wait |
| Secrets | none committed; `.env*` git-ignored and excluded from the image build context |
| Migrations | 44 idempotent SQL files; runner with advisory lock and history/unknown checks (`npm run migrate`, `migrate:check`); startup preflight `check` (default) or `apply` |
| Build | `Dockerfile`: web client built with Vite, runtime on Node 24 (type stripping), production dependencies only, non-root user, `HEALTHCHECK` |
| Startup / health | preflight (database wait, schema check), `/healthz`, `/readyz`, graceful SIGTERM (verified with the real process) |
| Hosting / TLS / cookies | client and API from one origin; TLS at the reverse proxy (runbook §1); `__Host-` Secure cookie and HSTS in production |
| Logging / monitoring / error reporting | JSON-lines access and error log with request ids; no metrics or alerting yet |
| Backup / restore / incident response / rollback | runbook procedures; local restore drill verified; production drill pending (PB11) |
| Rate limiting | per-account login policy in runtime (DEC-041); infrastructure limits at the proxy (P1-14) |
| Provisioning | audited operator CLI (runbook §7) for schools (with their time zone), people with activation cards, academic setup, exams and activation reissue |
| CI | `.github/workflows/ci.yml`: runtime typecheck, unit and PostgreSQL 16 integration; web typecheck, tests and build; browser end-to-end suite against the production process; image build and smoke test |

## 10. Design and UI status

- DESAINPAKEAI PROJECT: `b5a22aa4-7b38-49d2-9448-443eab6e8075`. CONTEXT REVISION: `sha256-5d0d77796ab574177a840d227a99e7457d623564c9d40160703f32224073c2b8`. CONTEXT VERIFIED: YES (2026-09-30). CLI `dpai` 0.2.2, authenticated at user level against `https://desainpakeai.com` (no repository file, environment file or document holds the key); skill `@desainpakeai/skills` 0.2.0 installed for the `claude-code` harness; MCP not used. Before every substantial UI checkpoint: `dpai auth status --pretty`, `dpai project current --pretty`, `dpai context --pretty`, and compare the revision with the one recorded here.
- Alignment finding (UI-001, Owner decision in §7): the project's pages are a sales-dashboard sample (Dashboard Penjualan, Transaksi, Leads & kontak, Target penjualan, Laporan penjualan, Tim sales, Pengaturan akun, Masuk), not ELLIGBLE screens. Its design system "Provenance Thread" (alpha) matches the locked Warm Monochrome direction in restraint, near-black primary, warm near-white canvas, Inter for UI text and compact radii, but adds a serif display face (Libre Baskerville), a mint brand accent, a "source-to-decision thread" device and a green focus ring that the LOCKED FRONTEND_DESIGN_SYSTEM v1.1.0 does not have. DesainPakeAI never overrides the locked system silently: new screens keep the locked ELLIGBLE tokens and use the project only for layout, hierarchy and interaction guidance where it does not conflict.
- shadcn/ui: configured once (`frontend/web/components.json`, Tailwind CSS v4 via `@tailwindcss/vite`, `src/components/ui/*`, `src/styles/globals.css`) and themed only with ELLIGBLE tokens (DEC-043). The first components were written from the official new-york v4 sources while `ui.shadcn.com` was blocked; it is reachable again (2026-09-30), so further components may come from the registry, themed with the same tokens.
- Tokens aligned to FRONTEND_DESIGN_SYSTEM v1.1.0 (P1-9). New screens (login, school picker, shell, re-login dialog) use shadcn/ui; older screens keep their CSS and migrate incrementally.
- Rendered checks (Playwright, Chromium, 360 px and 1280 px): login, validation, wrong password, student, school picker, no-workspace, proctor and teacher screens render without horizontal overflow.

## 11. Verification evidence

Baseline `3a69883` (Node 24.21.0, PostgreSQL 16.13, disposable databases):

| Check | Result |
|---|---|
| Typecheck: identity-access, tenant-access, secure-assessment (tsc 7.0.2) | PASS |
| identity-access tests | 20/20 PASS |
| tenant-access tests | 11/11 PASS |
| secure-assessment official `npm test` | 153/153 PASS |
| secure-assessment full suite (46 files) | 822/825 (3 failures = 2 broken test files, P1-7) |
| frontend typecheck / vitest / `vite build` | PASS / 88/88 / PASS |
| BU-090 real PostgreSQL verification | PASS |
| Historical real-PostgreSQL verifiers | 30/44 PASS; 14 fail on point-in-time assertions or stale fixtures (P1-12) |

After authentication and browser session (this branch):

| Check | Result |
|---|---|
| Typecheck: 3 runtime packages + frontend | PASS |
| identity-access / tenant-access unit | 20/20 / 11/11 PASS |
| secure-assessment unit (`npm test`, all files) | 845/845 PASS |
| secure-assessment integration (`npm run test:integration`, real PostgreSQL 16, production wiring) | 16/16 PASS: login/logout/session, cookie attributes, `__Host-` + `Secure` mode, header transport, capability discovery, attempt ownership (own / classmate / other tenant / anonymous), Origin refusal, 413 body limit, DEC-041 throttling, migration runner |
| BU-090 real PostgreSQL verifier | PASS |
| frontend vitest / `vite build` | 99/99 / PASS |
| Leaked disposable databases | 0 |

After student start and eligibility (this branch):

| Check | Result |
|---|---|
| secure-assessment unit | 859/859 PASS (timer start eligibility, eligibility rules, projection contract) |
| integration (real PostgreSQL) | 23/23 PASS, stable over 3 consecutive runs: full HTTP journey start → activate → timer → questions (no answer key) → versioned saves → resume → idempotent submit → no writes after submit; refusal reasons (not active, not open, closed, late start); remaining-window truncation; paused before timer start; 8 concurrent starts → 1 attempt; non-participant / other tenant / anonymous |
| frontend vitest | 105/105 PASS |
| real browser (Chromium 360 px, Asia/Jakarta) | login → "Mulai Ujian" → ready screen → workstation (server timer, "Tersimpan" after ACK) → answer → reload → answer restored; no page errors |

After teacher exam operations (this branch):

| Check | Result |
|---|---|
| secure-assessment unit | 860/860 PASS (readiness state guards, teacher read model contract) |
| integration (real PostgreSQL) | 31/31 PASS: SCHEDULED→READY→ACTIVE with events, readiness failures leave state and events untouched, order and window guards, only the exam's teacher (other teacher / student / anonymous refused), 5 concurrent activations → 1, schedule-conflict blocks READY, events append-only |
| frontend vitest | 110/110 PASS |
| real browser (360 px) | student sees "Menunggu guru atau pengawas membuka ujian." → teacher "Tandai Siap" → "Buka Ujian" (confirmation) → student starts → teacher sees progress (1 participant, 1 started, 0 submitted); no page errors; progress tiles no longer overflow |

After local-first answers and exam-session binding (this branch):

| Check | Result |
|---|---|
| secure-assessment unit | 860/860 PASS (resume `ownedByCaller`, fingerprint conflict and takeover) |
| integration (real PostgreSQL) | 37/37 PASS, including session takeover: resume never discloses the active id, second device refused without confirmation and learns only a fingerprint, wrong or missing fingerprint refused, confirmed takeover moves write authority, replaced session cannot write or reactivate, answers carry over, another student refused |
| frontend typecheck / vitest / `vite build` | PASS / 143/143 / PASS (sync engine incl. offline convergence, lost acknowledgement, rebase, supersession, 401 pause, restart recovery, device-transfer rule, loading race; IndexedDB store via fake-indexeddb; session binding with Web Locks; workstation offline, reload, supersession, expiry continuation, unreceived-answer notice, inline submit error) |
| real browser (Chromium, 360 px and 1280 px, Asia/Jakarta) | offline answering shows "Gagal menyimpan" and the durable banner, submit disabled, syncs by itself when online; with saves blocked, a reload restores the unsynced choice from IndexedDB and it syncs after unblocking; a second tab needs "Ya, Pindahkan Sesi" and the first tab then shows "Sesi Dipindahkan"; a duplicated tab (copied `sessionStorage`) is refused its copied session while the active tab keeps saving; server answers match every step; no page errors |

After production operations (this branch):

| Check | Result |
|---|---|
| secure-assessment unit | all PASS incl. static hosting (deep links, immutable assets, gzip, ETag 304, unknown assets 404, unknown file types never served, traversal and encoded traversal refused, symlinks skipped, 405, HEAD, API not swallowed by the fallback), access log (no query strings, cookies or credentials; health probes not logged; 5xx at ERROR), configuration validation |
| integration (real PostgreSQL) | preflight: unmigrated database refused with the pending list, `apply` migrates under the lock, database ahead of the release refused in both modes, unreachable database after the bounded wait; real `node src/main.ts` in production mode serves the client with HSTS and request ids, API and health, JSON logs without secrets, clean SIGTERM, refuses an unmigrated database |
| container image | built locally (base image from a registry mirror; this environment's TLS proxy CA injected only as a build secret for the local build), runs as `node`, healthy; production mode with `apply` migrated 37 files |
| real browser against the container (Chromium 360 px, production cookie) | login, start, offline answering, reload recovery from IndexedDB, second-tab takeover, duplicated-tab refusal; server answers match; no page errors; container logs contain no credentials |
| restore drill (local) | `pg_dump` custom format, `pg_restore` into a new database, `migrate:check` clean, container started on the restored database, real login 200, row counts match |

After provisioning and content (this branch):

| Check | Result |
|---|---|
| identity-access unit | 24/24 PASS (password policy, activation code format and verifier) |
| academic-core unit | 3/3 PASS |
| secure-assessment unit | all PASS incl. provisioning templates and parsers (every example template in `docs/production/provisioning-templates/` parses), frozen content builder, answer payload contract |
| integration (real PostgreSQL) | account activation (single use, weak passwords refused without counting as failures, wrong/unknown/expired/used/revoked indistinguishable, revoked after ten wrong codes, expiry, reissue as administrative reset, login lockout does not block activation); authored question order with identifiers in the opposite order; the operator CLI as a real process: school, people with the printed card sheet, academic setup, exam import, activation by teacher, proctor and students, the teacher opens the exam, a student takes it, idempotent re-runs, audit events without personal data, reissue |
| real browser against the container (Chromium 360 px) | pilot journey provisioned with the CLI inside the container: activation cards, teacher activation and "Buka Ujian", proctor view, student exam and submission |

After browser E2E (this branch):

| Check | Result |
|---|---|
| Typecheck: 4 runtime packages, web client, E2E suite | PASS |
| identity-access / tenant-access / academic-core unit | 24/24 / 11/11 / 3/3 PASS |
| secure-assessment unit / integration (real PostgreSQL 16) | 890/890 / 71/71 PASS |
| web vitest / `vite build` | 149/149 / PASS |
| browser E2E (`e2e/`, Chromium, 360 px, production process, CLI-provisioned database) | 8/8 PASS locally and on GitHub Actions (CI run 11: all four jobs green): teacher activation and opening the exam, proctor view, student answers with reload and one submission (two concurrent repeats return the same receipt), offline answering synced after reconnect, reload while saves fail restored from IndexedDB then synced, second-tab takeover and duplicated-tab refusal, other school 403 and another student's attempt refused, session revoked mid-exam re-authenticates the same student with no answer lost; server answers checked at each step |
| E2E setup failure (forced port conflict) | teardown still stops the process and drops the database; no state file or work directory left |
| workflow lint (actionlint) | clean |
| Leaked disposable databases | 0 |

After server expiry finalization and provisional results (this branch):

| Check | Result |
|---|---|
| Typecheck: 4 runtime packages, web client, E2E suite | PASS |
| identity-access / tenant-access / academic-core unit | 24/24 / 11/11 / 3/3 PASS |
| secure-assessment unit | 898/898 PASS incl. scoring: the decision examples (34/40 = 85, 37/45 = 82.22), exact half-up rounding, fractional weights without drift, unanswered and malformed answers score 0, unscorable content never becomes a zero, determinism |
| integration (real PostgreSQL 16) | 81/81 PASS: server finalization from accepted answers (time left, adjustment, never started and already submitted untouched; idempotent; returning device and late submit get the same receipt; busy attempts left to the next sweep; bounded batches; the production process sweeps on its own); teacher results (scores of finalized attempts only, absent not zero, ordered by ELLIGBLE ID, finalization source; students receive no score or answer key; other teacher, proctor, participant, other school, anonymous, unknown exam and revoked teaching assignment refused). Mutation-checked: a deadline ignoring adjustments and a loosened teacher condition are both caught |
| web vitest / `vite build` | 157/157 / PASS |
| browser E2E | 10/10 PASS: a student away at time expiry is finalized by the server within the sweep; the teacher opens "Hasil Ujian" from "Lihat Hasil", scores hidden until "Tampilkan Nilai", 66,67 for 2 of 3, 0/3 for the timed-out student with the device-away note, "Belum ada nilai" for others; reload and back keep the route; the timed-out student sees the attempt as submitted without a score |
| rendered check (Chromium, 360 px and 1280 px) | results screen without horizontal overflow; participant, status and scores readable at 360 px after moving the status under the ELLIGBLE ID |
| Leaked disposable databases | 0 |

After "Ragu-ragu" review marks (this branch):

| Check | Result |
|---|---|
| secure-assessment unit / integration (real PostgreSQL 16) | 898/898 / 84/84 PASS: marks kept apart from answers (answer and write version unchanged), unanswered questions can be marked, repeats harmless, resume returns them; malformed requests, another session, another exam's question, another student's attempt, expired and submitted attempts refused with nothing written |
| web vitest / `vite build` | 164/164 / PASS: marks from the server shown in the card and navigator, a change sent without any answer save, an unsent mark kept across a remount and sent later, the submit dialog reminder, marks forgotten after submission; the hook sends a change made during a request right after it, stops on a closed attempt and drops requests that can never succeed. A render loop when a caller passes a new array each render was found by these tests and fixed (marks load once per attempt) |
| browser E2E | 11/11 PASS: a mark set at 360 px shows in the "Daftar Soal" sheet with its count, is on the server, survives a reload with the answer unchanged, and removing it reaches the server |
| rendered check (Chromium 360 px) | calm amber mark in the question card and as a corner on the question number; the sheet summary wraps instead of running together (fixed after the first render) |

After the school time zone (this branch):

| Check | Result |
|---|---|
| tenant-access unit | 12/12 PASS incl. zone validation (IANA names the runtime knows; abbreviations such as "WIB", offsets and malformed names refused) |
| integration (real PostgreSQL 16) | provisioning CLI: `school create` refuses a missing or invalid zone and has no dry run that would create a school, stores the zone, `school set-time-zone` needs operator and case, refuses unknown schools and malformed ids, is audited with the previous zone; `/me/context` returns the zone |
| web vitest | WIB, WITA and WIT abbreviations and local hours; a window crossing midnight in UTC shows the school's date; invalid zones fall back to the device zone; the app formats a Jayapura school's exam in WIT |
| browser E2E | 11/11 PASS with the browser clock in UTC: the student's exam list shows the schedule in WIB and never in UTC |

After exam-day participant monitoring (this branch):

| Check | Result |
|---|---|
| integration (real PostgreSQL 16) | 89/89 PASS: the managing teacher sees every participant (submitted, active with accepted answers and server time left, not started, time up awaiting finalization, a takeover counted as a device move) without scores; an assigned proctor sees the whole exam without room operations and only their room with rooms; another teacher, a participant, a proctor of another exam, another school, anonymous and unknown exams refused. Mutation-checked: dropping the room filter is caught |
| web vitest / `vite build` | 173/173 / PASS: statuses and notes, filters and ID search, automatic refresh keeping the last data marked "Pemantauan tertunda" when a refresh fails, refusal, entry points from both views |
| browser E2E | 12/12 PASS: the proctor opens "Lihat Peserta" at 360 px, sees the six participants in the right states with device moves, filters and searches; no scores appear |
| rendered check (Chromium, 360 px and 1280 px) | no horizontal overflow; readable at both widths |

After exam pause, resume and end on the server (ASSESS-LIFE-001, this branch):

| Check | Result |
|---|---|
| runtime unit | 899/899 PASS incl. `exam_paused` and `exam_ended` start refusals |
| integration (real PostgreSQL 16) | 97/97 PASS. Working-time rule exact to the second with closed, open and pre-start pauses and adjustments; one open pause per exam; pause rows closed once and never deleted. Through HTTP: time frozen while paused and identical at pause and resume; new starts and timer starts refused; answers without or after the boundary refused, an answer chosen 1 ms before the boundary saved; marks, submission and questions refused while paused; a move to another device still works; END of a paused exam refused; after resume an answer chosen inside the pause refused with the interval, others accepted; pause and resume idempotent, recorded once with the teacher; the sweep does not finalize an attempt whose wall-clock deadline passed during the pause; a write in flight delays the boundary and a write waiting on a pause sees it; concurrent pauses record one boundary and one event; END refuses new starts, force-submits nothing, lets running attempts save and submit and the sweep finalize only the one that ran out; only the managing teacher can act; readiness and monitoring show the pause, the frozen time and who is still working. Mutation-checked: removing the exam row lock and making the sweep ignore pauses are both caught |
| web vitest / `vite build` | 179/179 / PASS: confirmations for pause, resume and end, pause time in WIB, ended note with who is still working, monitoring notices, marks and answers kept while paused |
| browser E2E | 12/12 PASS (no regression) |
| rendered check (Chromium, 360 px and 1280 px) | teacher card while running, paused and ended, both confirmations and the paused monitoring notice: no page errors, no horizontal overflow, no em dash; DesainPakeAI context revision unchanged (§10) |

After the student exam screen under pause and end (ASSESS-LIFE-002, this branch):

| Check | Result |
|---|---|
| web vitest / `vite build` | 196/196 / PASS. Engine: capture time sent; a choice made before the pause is saved during it and the later one dropped and reported; with nothing before the pause the server answer stays; after a resume a choice made inside the pause falls back to the earlier one and later choices save normally; a known pause settles waiting choices without a request and blocks new ones, a resume closes it; an undecidable refusal backs off instead of looping; earlier choices survive a reload; an acknowledged earlier choice is forgotten. Clock: midpoint offset, shortest round trip wins, unusable samples ignored, estimate kept for 12 h. Screen: a reload while paused shows no question content and the frozen time that does not move, then the questions return with the same time; an answer lost in transit while the teacher pauses is saved during the pause; a save that meets the pause switches to the paused screen and names the dropped question, also after the resume until "Mengerti"; no submission while paused; the ended note |
| runtime unit / integration | 899/899 / 97/97 PASS (no runtime change) |
| browser E2E | 14/14 PASS against the production process: an offline device keeps a choice made before the teacher's pause, then changes another answer during the pause without knowing it; back online the first is saved during the pause and the second refused and named; questions hidden; the time does not move, also after a reload; after "Lanjutkan Ujian" the questions return and the database shows identical remaining time at pause and resume; a new choice saves; "Akhiri Ujian" stops a student who never started and lets the running attempt save and submit |
| rendered check (Chromium, 360 px and 1280 px) | paused screen, resumed screen with the dropped-choice notice, ended note: no page errors, no horizontal overflow, no em dash |

## 12. Friction reducers (automation)

Done: full unit test gate; reusable disposable PostgreSQL harness (`test/support/pg-harness.ts`, migrated or empty) and fixtures; migration runner/verifier; demo seed for local work (`test/support/seed-demo.ts`); environment validation and startup preflight; CI workflow with image smoke test (green on GitHub Actions); route parity check (`test/route-parity.test.ts`: every web client API function is called against the production-wired server and must reach an existing route with an allowed method, every server route must have a client caller or be listed as server-only; mutation-checked with a misspelled path and a wrong method). Browser E2E runner (`e2e/`, `npx playwright test`, runbook §8): starts the production process on a fresh database, provisions it only through the operator CLI, cleans up the database and process even when the setup fails, and runs in CI with the report and server log kept on failure. The workflow is checked with actionlint before pushing (a job-level `runner` context once made GitHub reject the whole workflow). The manifest SHA256 synchronization chore is retired (DEC-042).

## 13. Next engineering work

The production task graph (§6) is the work queue: the critical path and READY queue in §6.1 decide what comes next, at most three tasks in progress at once. Current order: RESULT-001 (finalization), RESULT-002 (teacher export), then the pull-request checkpoint, then the proctor items. Blocked items wait on the Owner or on external infrastructure and are listed with their reason.

Local development and operations: `docs/production/OPERATIONS_RUNBOOK.md`.
