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
| Exam-day participant monitoring | `ExamMonitoringView` ("Pemantauan Peserta", from "Lihat Peserta" and "Pantau Peserta") | `GET /assessment/exam-monitoring`, `POST /assessment/exam-monitoring/participant-lock`, `POST /assessment/exam-monitoring/broadcast`, `POST /assessment/exam-monitoring/add-time` | assigned proctor (their rooms, or the whole exam without room operations) or the managing teacher; adding time: the managing teacher only | **WORKS**: status, accepted answers and time, server time left, device moves, filters and ID search, visible freshness; no scores; "Kunci" and "Buka Kunci" for one working participant (ASSESS-PROCTOR-001); "Kirim Pesan" to the exam, a room or chosen participants and "Pesan Terkirim" with delivery to devices (ASSESS-PROCTOR-002); "Tambah Waktu" for one working participant with minutes and a reason, "Waktu ditambah" on the list for every supervisor (ASSESS-PROCTOR-004) (integration; E2E) |
| Supervisor messages on the exam screen | notice in the `StudentExamWorkstation` header, "Pesan Pengawas" in the question list, latest message on the paused and locked screens | `POST /assessment/broadcasts/inbox`; `messageCount` in `GET /assessment/timer` | session → membership → participant → attempt | **WORKS**: fetched when the count grows, receipt confirmed, shown once without taking the focus, kept to reread (integration; E2E) |
| Teacher operations | `TeacherReadinessView` ("Pelaksanaan Ujian") | `GET /assessment/teacher-readiness`, `POST /assessment/teacher-exams/transition` | session → teaching assignment of the exam | **WORKS**: readiness, "Tandai Siap", "Buka Ujian", aggregate progress (integration + browser; E2E) |
| Teacher results | `TeacherResultsView` ("Hasil Ujian", from "Lihat Hasil") | `GET /assessment/teacher-exams/results` | session → teaching assignment of the exam (not proctors, other teachers or participants) | **WORKS**: provisional per-participant status and auto-score of submitted attempts until the exam is finalized, then the frozen final results (RESULT-001); scores hidden until shown (integration; E2E) |
| Deep links / refresh | query-string routes under `/` | client served by the runtime with deep-link fallback | session re-checked on load | **WORKS** (production container, real browser) |

## 3. Role journeys (canonical actors, MB-03)

| Role | Works today | Incomplete | Blocks production |
|---|---|---|---|
| Student | activation, login, exam list with entry guidance, start, launch/takeover, workstation with local-first answers, "Ragu-ragu" marks, timer with reminders, submit and automatic submission, paused screen with frozen time and exact resume, ended note (ASSESS-LIFE-002), locked screen while a supervisor locks the attempt (ASSESS-PROCTOR-001), supervisor messages without interruption (ASSESS-PROCTOR-002), a note when the teacher adds time (ASSESS-PROCTOR-004) | seeing results (publication policy, §7) | none in the product (Owner/legal PBs, §8) |
| Teacher (teacher-managed mode, D04.4-26A) | activation, "Buat Ujian" from a question file (ASSESS-TEACHER-001), "Pratinjau Soal" before opening (ASSESS-TEACHER-002), "Ubah Jadwal", "Batalkan Ujian" (ASSESS-TEACHER-003) and "Tambah Peserta" (ASSESS-TEACHER-004) before opening, readiness, "Tandai Siap", "Buka Ujian", "Jeda Ujian", "Lanjutkan Ujian", "Akhiri Ujian" (ASSESS-LIFE-001), aggregate progress with who is still working, participant lock, messages and "Tambah Waktu" (ASSESS-PROCTOR-004) from "Pantau Peserta", provisional results ("Hasil Ujian"), "Finalisasi Hasil" and final results (RESULT-001), "Unduh CSV" and "Cetak" (RESULT-002) | question authoring in the UI, removing participants (OPEN-05), publication | none for the pilot |
| Proctor | monitoring read model and screen; exam-day participant list (who is expected, working, finished or moved); lock and unlock of one participant, audited (ASSESS-PROCTOR-001); messages to the exam, their rooms or chosen participants with delivery to devices (ASSESS-PROCTOR-002); sees time added to a participant (ASSESS-PROCTOR-004) | Proctor Feed events; adding time stays with the managing teacher until PB05 | Feed is P1-11 |
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
| P0-7 | No way to put questions into an exam except raw SQL | no snapshot creation code | **RESOLVED** as a pilot bridge: `exam import` in the operator CLI creates a scheduled teacher-managed exam from `elligble-exam-v1` JSON and an `elligble-questions-v1` CSV (five-option single choice, random option ids, authored order, participants from enrollments, proctors); the teacher still marks it ready and opens it. Teachers now import and schedule their own exams in the product (ASSESS-TEACHER-001); authoring questions in the UI remains out of scope |
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
| P1-8 | No request/error logging, no metrics; startup logs only | `log.ts`: **RESOLVED** for logging: one JSON line per request (request id, method, path without query, status, duration), 5xx at ERROR, unhandled errors by class and code only, `X-Request-ID` correlation; metrics and alert rules added by OPS-002 (`metrics.ts`, `deploy/monitoring/elligble-alerts.yml`) | RESOLVED |
| P1-9 | Design tokens in code drifted from LOCKED design system v1.1.0 (navy actions/focus, slate neutrals, radii, undefined tokens) | **RESOLVED** in `design-tokens.css` + component CSS; screens still use hand-written CSS (migration to shadcn/ui components is incremental) | RESOLVED |
| P1-10 | Assigned-exam projection had no lifecycle/window/duration | **RESOLVED**: `schedule` + `serverNow` in the projection; the list explains when and why an exam can or cannot be started (D04.2-73) | RESOLVED |
| P1-11 | Proctor Feed (Kejadian/Pelanggaran) not implemented (D01, D04.1-54) | no feed tables/routes. First part done: the exam-day participant list (D04.6-01/02/03/04/10/17/18/60/61) from server facts, including session moves (D04.6-30). Second part done: lock and unlock of one participant (D04.6-38/39/40, ASSESS-PROCTOR-001). Third part done: broadcast messages (D04.1-77A..G, D04.6-49..55, ASSESS-PROCTOR-002). Fourth part done: add time for one participant (D04.6-41, D04.2-78/79, ASSESS-PROCTOR-004). Remaining: device-side signals and their policy (D04.6-19..32, D04.7 presets), incidents, other control actions | OPEN (in progress) |
| P1-13 | Shared-device hygiene: remembered school choice leaked to the next account; re-authentication could accept another account while keeping the previous context | found in rendered checks — **RESOLVED** (logout clears the choice; re-login locked to the same ELLIGBLE ID) | RESOLVED |
| P1-14 | Infrastructure-level login rate limiting (whole schools share one NAT address, so per-IP limits must be generous) | per-account policy exists (DEC-041); **RESOLVED as a reference** by OPS-003: `deploy/nginx/elligble.conf` limits sign-in and API per address with bursts sized for whole schools, tested against the runtime (a 1 500-request storm passes, a sign-in flood is limited); applying it to the production proxy is part of OPS-001 | RESOLVED (reference; deployment with OPS-001) |
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
| P1-28 | No scoring or results: after an exam the teacher saw only counts (D04.8) | **RESOLVED (provisional)**: deterministic rule `BASELINE_SINGLE_CHOICE_V1` (correct option earns the question's maximum, otherwise 0, raw ÷ maximum × 100 rounded half up to two decimals, exact integer arithmetic) computed on read from the frozen snapshots and accepted answers of finalized attempts; `GET /assessment/teacher-exams/results` only for the teacher who manages the exam; "Hasil Ujian" screen lists participants by ELLIGBLE ID (never ranked), absent is not zero, shows how each attempt was finalized, keeps scores hidden until shown (FRONTEND_DESIGN_SYSTEM §58). Students see no score. Finalization DONE (RESULT-001: explicit, audited, frozen, absent is not zero); export DONE (RESULT-002); publication (RESULT-003, Owner) and corrections (D04.8-24+) remain | RESOLVED (provisional, finalization and export DONE) |
| P1-29 | Answers about the exam state arriving out of order could make the answer engine resend a refused choice in a tight loop (a timer answer produced before a pause or lock closed a span the server still held open), or drop a choice made after a resume or unlock (a refusal produced before it arriving late) | found while testing the participant lock: **RESOLVED** (ASSESS-SYNC-001): answers about a pause or lock are ordered by the server time they carry; a stale one changes nothing on the exam screen or in the engine, a newer refusal reopens a span the engine had closed, and a late refusal only proves the span lasted until it was produced | RESOLVED |
| P1-30 | A choice the server refused because of a pause or lock but the answer engine kept (it placed the choice before the span, or the refusal named no boundary) was sent again at once, in a loop: each refusal makes the exam screen check the state, and that answer restarted the queue and cancelled the backoff; a choice queued behind it that the server would accept was never sent | found while verifying UI-SYSTEM-001 (a rare out-of-memory failure of the web suite): **RESOLVED** (ASSESS-SYNC-002): such a choice is held until its backoff elapses, whatever asks to send now, and the other choices go on; it is tried again after the shortest backoff once the pause or lock is seen to end, and at once when the time runs out | RESOLVED |
| P1-25 | Time reminders at configured thresholds (D04.5-32) were missing; only warning styling below 5 and 1 minutes | `StudentExamWorkstation`: **RESOLVED** with the decision's default thresholds (30, 15, 5 minutes): a non-blocking status line with the actual remaining minutes, hidden after 10 seconds; school-defined thresholds await tenant settings | RESOLVED |

## 6. Production task graph

Planning aids only: these identifiers are not Build Units and have no lifecycle stages (DEC-042). One coherent, verified product result per task; every active or backlog task carries its scope, dependencies and verification. Status values: BACKLOG, READY, IN_PROGRESS, BLOCKED, VERIFYING, DONE. Priority: P0 blocks safe production or risks data loss or security; P1 blocks a required baseline journey; P2 important reliability, quality or operations; P3 post-baseline. Work-in-progress limit: 3.

### 6.1 Views

**CRITICAL PATH:** ~~ASSESS-LIFE-001~~ → ~~ASSESS-LIFE-002~~ → ~~RESULT-001~~ → ~~RESULT-002~~ → ~~PR checkpoint~~ ([yusufarst/elligble#1](https://github.com/yusufarst/elligble/pull/1), CI run 21 green, awaiting the Owner's review and squash-merge) → ~~ASSESS-PROCTOR-001~~ → ~~ASSESS-SYNC-001~~ → ~~ASSESS-PROCTOR-002~~ → ~~OPS-002~~ → ~~OPS-003~~ → ~~E2E-001~~ (CI run 30, five browser projects) → ~~ASSESS-TEACHER-001~~ (CI run 31) → ~~ASSESS-TEACHER-002~~ (CI run 32) → ~~ASSESS-PROCTOR-004~~ (CI run 33) → ~~ASSESS-TEACHER-003 rescheduling~~ (CI run 34) → ~~ASSESS-TEACHER-003 cancellation~~ (Owner decision 2026-09-30, CI run 37) → ~~ASSESS-TEACHER-004~~ (CI run 39) → ASSESS-SYNC-002 (a refused choice the engine keeps waits for its backoff; found while verifying UI-SYSTEM-001) → UI-SYSTEM-001 (consistency audit, §10.1). The Owner-blocked items (§6.2 BLOCKED) join the path when decided.

| View | Tasks |
|---|---|
| IN PROGRESS | ASSESS-SYNC-002 (VERIFYING: every local gate passes; CI pending) |
| READY QUEUE (by value) | UI-SYSTEM-001 (existing screen consistency audit, §10.1; its verification found ASSESS-SYNC-002) |
| BLOCKED | RESULT-003 (Owner), SEC-001 (Owner), AUTH-001 (Owner), ADMIN-001 (Owner, PB05), ASSESS-STUDENT-001 (Owner, D04.5-48), ASSESS-PROCTOR-003 (canonical review), OPS-001 (external infrastructure) |
| RECENTLY COMPLETED | ASSESS-TEACHER-004, ASSESS-TEACHER-003 cancellation, ASSESS-TEACHER-003 rescheduling, ASSESS-PROCTOR-004, ASSESS-TEACHER-002, ASSESS-TEACHER-001, E2E-001, OPS-003, OPS-002, ASSESS-PROCTOR-002, ASSESS-SYNC-001, ASSESS-PROCTOR-001, RESULT-002, RESULT-001, ASSESS-LIFE-002, ASSESS-LIFE-001, TOOL-001, ASSESS-PROCTOR-000, ASSESS-TEACHER-000, ASSESS-STUDENT-002, ASSESS-SCHOOL-000, ASSESS-TIME-000, E2E-000, PROV-000 (see 6.3) |

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
| Workstream / priority / status | RESULT / P1 / DONE |
| Dependencies / blocks | ASSESS-LIFE-001 / RESULT-002, RESULT-003 |
| Repository evidence | results are provisional and computed on read (`teacher-results.ts`); nothing freezes them; lifecycle has no FINALIZED transition |
| Why | Owner decision point ENDED-5; D04.8-17/18/19/20/57, D04.2-83 |
| Exact scope | ENDED→FINALIZED by the managing teacher only when no attempt is still running; results frozen as stored per-attempt scoring records (rule id, raw, maximum, scaled, per-item outcomes) so later edits cannot change them; audited with actor, time, rule version; results screen shows "Final" |
| Out of scope | publication to students (RESULT-003, Owner); corrections after finalization (D04.8-26+, later) |
| Expected product result | a teacher closes an exam and gets stable, reproducible results |
| Surfaces | migration, `exam-lifecycle-operations.ts`, `scoring.ts`, `teacher-results.ts`, `TeacherResultsView.tsx` |
| Verification | real-PostgreSQL: refused while attempts run, frozen values unchanged by later snapshot or answer edits, idempotent, audited; E2E end to finalize |
| Owner decision | none (student visibility stays separate); the finalizing role is recorded in §7 as an implemented default |
| Delivered | migration `0045`: `secure_assessment_exam_result_finalizations` (one per exam: who, when, scoring rule, question count, maximum, pending-issue state) and `secure_assessment_attempt_results` (one per participant: SUBMITTED with counts, raw and maximum micro-points, scaled score and per-question outcome with the selected option, or ABSENT without any score), both append-only with consistency checks; action `finalize` (ENDED→FINALIZED) by the managing teacher: attempts whose time ran out are first finalized from their accepted answers as the sweep would, any attempt still running refuses it (`attempts_running`), content that cannot be scored refuses it (`scoring_unavailable`), a repeat changes nothing; the lifecycle event records the actor; every attempt writer now locks the exam row before the attempt row so a finalization never deadlocks with a save; results read the frozen rows once finalized ("Hasil final", "Tidak mengerjakan" for absent participants); the teacher card offers "Finalisasi Hasil" with a confirmation once nobody is still working and shows when the results were finalized |
| Known limits | no maker-checker or second approver (D03.6-26 applies to official academic results and stays governance work); corrections after finalization (D04.8-24 to 29) are not implemented, so a finalized result cannot be changed at all yet |
| Commit / PR | this change (see §11) |

#### RESULT-002 · Teacher result export

| Field | Value |
|---|---|
| Workstream / priority / status | RESULT / P2 / DONE |
| Dependencies / blocks | ASSESS-LIFE-001 (for the final flag) / none |
| Repository evidence | results only on screen (`TeacherResultsView.tsx`) |
| Why | D04.8-52 (export baseline-useful, formats later), D04.8-53 (provenance) |
| Exact scope | CSV download for the managing teacher with provenance and state (provisional or final); spreadsheet-safe values; printable view |
| Out of scope | Academic Core projection (D04.8-54), E-Rapor |
| Expected product result | a teacher can take results into their own gradebook |
| Surfaces | `TeacherResultsView.tsx`, a CSV builder, tests |
| Verification | unit (escaping, provenance), component, E2E download |
| Owner decision | none |
| Delivered | "Unduh CSV" on the results screen (`lib/results-export.ts`, built on the device from the results the teacher is already authorized to see; no new server route): one row per participant carrying its provenance (subject, class, assessment type, provisional or final and when finalized, status, how and when the attempt was submitted, attempt kind "Asli", rule); counts, raw and maximum score and the 0 to 100 score; absent participants with empty score cells; Indonesian spreadsheet form (semicolon columns, decimal comma, UTF-8 with byte-order mark, times as "yyyy-mm-dd hh:mm" in the school zone with its label in the header); values a spreadsheet could run as formulas are prefixed with an apostrophe; file name from subject, class, date and state. "Cetak" prints the screen without controls (scores print as shown on screen) |
| Known limits | exact formats beyond CSV (Excel workbook, integration format) wait for D04.8-52 "formats later"; a spreadsheet set to an English locale may read the decimal comma as text; exports are not logged |
| Commit / PR | this change (see §11) |

#### ASSESS-PROCTOR-001 · Participant lock and unlock

| Field | Value |
|---|---|
| Workstream / priority / status | ASSESS-PROCTOR / P2 / DONE |
| Dependencies / blocks | ASSESS-LIFE-001 (shared time and guard model) / none |
| Why | D04.6-38 (lock preserves answers), D04.6-39 LOCKED (direct unlock by the authorized proctor, scoped, audited, no student-facing code), D04.2-76 (participant level), D04.6-40 (a lock does not stop the time; pause controls timing) |
| Exact scope | lock and unlock of one participant by an assigned proctor within scope or the managing teacher; locked runtime cannot edit; audited |
| Out of scope | participant pause with frozen time (D04.6-40, separate), step-up authentication, locking someone who has not started |
| Delivered | migration `0046`: `secure_assessment_attempt_locks` (one row per lock with who and when it was locked and unlocked; at most one open lock per attempt; closed once, never deleted); `POST /assessment/exam-monitoring/participant-lock` (`lock`, `unlock`) for the assigned proctor of the exam, limited to their rooms when the exam runs with rooms, or the managing teacher, while the exam is ACTIVE, PAUSED or ENDED; idempotent; the boundary is taken after the attempt row lock, so a save in flight lands before it. While locked: questions, answer saves, "Ragu-ragu" marks, submission and timer start are refused with `attempt_locked`; the time keeps running and a locked attempt whose time runs out is still finalized by the server; an answer chosen before the lock is accepted even when it arrives during or after the lock, one chosen during a lock is refused (`captured_during_lock`), the same capture-time rule as a pause. Monitoring lists the lock ("Dikunci", since when) and offers "Kunci" for working participants and "Buka Kunci" for locked ones, each with a confirmation that says what the lock means; the student sees "Pengerjaan Dikunci" with the running time, which answers were kept, and the questions again after the unlock (checked every 5 s while locked) |
| Known limits | the student learns of a lock within about 15 s unless a save meets it first, and of an unlock within about 5 s; a lock does not stop the time, so the supervisor decides when to unlock (a participant-level pause with frozen time is not in scope); found while testing: a stale exam-state answer could make the answer engine resend in a tight loop (pause and lock alike), fixed by ASSESS-SYNC-001 |
| Commit / PR | `9243a85`, CI run 23; part of [yusufarst/elligble#1](https://github.com/yusufarst/elligble/pull/1) |

#### ASSESS-SYNC-001 · Answer engine settles stale exam-state answers without a resend loop

| Field | Value |
|---|---|
| Workstream / priority / status | ASSESS-SYNC / P1 / DONE |
| Dependencies / blocks | ASSESS-LIFE-002, ASSESS-PROCTOR-001 / none |
| Repository evidence | found by a workstation test whose fake server reused a lock boundary: the refused save, the immediate state check and the engine's restart of the queue fed each other until the test process ran out of memory. With the real server the same cycle follows when a timer answer produced before a pause or lock arrives after a save refusal that reported it: the engine closes the pause or lock the server still holds open, keeps a choice the server refuses, and every refusal restarts the send at once |
| Why | D04.5-05/06/15/16 (answers never lost, queue with backoff); a whole room retrying at once must not overload the server |
| Exact scope | order answers about a pause or lock by the server time they carry, in the engine and on the exam screen; a refusal newer than the answer that closed a span reopens it; a stale refusal proves only that the span lasted until it was produced; tests for pause and lock, mutation-checked |
| Out of scope | server changes (every refusal and timer answer already carries the database time) |
| Delivered | the engine keeps, per kind of span (pause, lock), the server time of the newest answer it applied; an older answer is stale: a timer answer produced before a pause or lock began no longer shows the questions again or closes the span, and a refusal produced before a resume or unlock no longer pauses or locks the screen or drops a choice made afterwards (it only marks the span as lasting until then, so the choice it refused is dropped without asking again); a newer refusal reopens a span the engine had closed by estimate, so the refused choice is dropped and reported instead of being resent; a span whose end came from the server's record never opens again. The exam screen applies a timer answer only when it is fresh for both kinds |
| Known limits | a timer answer is dated by the database time at the start of its request, so a resume or unlock recorded while that request runs can be taken as stale and is then seen on the next check (about 5 s while paused or locked) |
| Commit / PR | `3e28d9b`, CI run 24; part of [yusufarst/elligble#1](https://github.com/yusufarst/elligble/pull/1) |

#### ASSESS-SYNC-002 · A refused choice the engine keeps waits for its backoff

| Field | Value |
|---|---|
| Workstream / priority / status | ASSESS-SYNC / P1 / VERIFYING (every local gate passes; CI pending) |
| Dependencies / blocks | ASSESS-SYNC-001 / none |
| Repository evidence | found while verifying UI-SYSTEM-001: the web suite failed rarely under load (the test worker ran out of memory in 2 of 10 shuffled runs of the whole suite and 1 of 12 of the pause file). Instrumented, one lock test of the exam screen had sent the same choice about 1 500 times in 0.26 s, each refusal followed by a state check. Two causes, each reproduced deterministically: the tests shared the page-wide server clock, so the out-of-order answers of an earlier test (server times two minutes off, with instant round trips that win as the shortest) left it two minutes behind and the lock test then stamped its choice before the lock it set (dependent on test order and millisecond timing); and the engine, given a refused choice it keeps, sent it again at once after every state check: the refusal triggers the check and the check's answer restarted the queue, cancelling the backoff (201 requests in about 0.3 s in the reproduction; with a real server one save and one state check per round trip from every such device, for a whole room during a pause), while a choice queued behind it that the server would accept was never sent |
| Why | D04.5-05/06/15/16 (answers never lost, queue with backoff), D04.5-46 (pending answers sent before finalization); a paused room must not flood the server |
| Exact scope | engine: hold a refused choice it keeps until its backoff elapses, let the other choices go on, try it again after the shortest backoff once the pause or lock is seen to end and at once when the time runs out; tests: the page-wide server clock pinned in the pause and lock tests, regression tests for the engine and the exam screen |
| Out of scope | server changes; the capture-time rule (unchanged, the same on both sides) |
| Delivered | `answer-sync-engine.ts`: a choice the server refused because of a pause or lock and the engine keeps is held (per question and write identity) and skipped by the queue; a request to send now (a state check's answer, reconnecting, the tab visible again) no longer cancels the backoff timer while such a choice is held, and the timer releases it; a refusal without a boundary holds the choice the same way instead of a backoff any request cancelled; the other choices are sent meanwhile, and a newer choice for the question is never held; the end of a pause or lock restarts the backoff at its shortest step (about 1 s), never at once, so even answers that contradict each other cannot make a loop; `flushBeforeFinalization`, called by the exam screen when the time runs out, sends a held choice at once. Tests: `examPause.test.tsx` pins the page-wide server clock to the device time its fake server speaks in, and adds two screen tests (a choice refused although the device places it before the lock is never sent again within a second and is kept, not reported as discarded; a held choice is sent at once when the time runs out, before the attempt is finalized); `answerSyncEngine.test.ts` adds, for pause and lock, a refused choice held without a resend loop while another choice saves and tried again after the shortest backoff once the span ends, a held choice sent at once when the time runs out, and a refusal without a boundary with a state check after each refusal; the fake servers are capped so a regression fails instead of never ending |
| Known limits | a held choice waits for its backoff (up to 30 s after repeated refusals) unless the pause or lock is seen to end or the time runs out; until then it stays on the device, marked as not saved |
| Verification | see §11 |
| Commit / PR | this change (see §11); part of [yusufarst/elligble#1](https://github.com/yusufarst/elligble/pull/1) |

#### ASSESS-PROCTOR-002 · Broadcast messages to participants

| Field | Value |
|---|---|
| Workstream / priority / status | ASSESS-PROCTOR / P2 / DONE |
| Dependencies / blocks | none / none |
| Why | D04.1-77A..G and D04.6-49..55, all LOCKED (scopes, simple composer, quick messages, non-blocking, delivery state without "read", audit, rate limit, reviewable history), D04.5-57/58/59 |
| Exact scope | messages to the entire exam, one exam room or chosen participants from the managing teacher or an assigned proctor within scope; quick messages; non-blocking notice on the exam screen and a list to reread; audited; rate limited. The room target is included (the plan first deferred it) because D04.6-49 and D04.1-77B make it baseline and rooms already exist in the schema |
| Out of scope | critical persistent messages (D04.1-77D), push channels, message editing or withdrawal |
| Delivered | migration `0047`: `secure_assessment_exam_broadcasts` (sender, target, message of 1 to 200 characters, time; append-only) and `secure_assessment_exam_broadcast_recipients` (fixed when sent: participants in the target and in the sender's scope who have not submitted; the delivery time is recorded once, when the device confirms). `POST /assessment/exam-monitoring/broadcast`: a proctor limited to rooms reaches only their rooms or participants in them, never the entire exam; nothing is sent when a chosen participant is outside the scope; allowed while the exam is ACTIVE, PAUSED or ENDED; limited per sender and exam. The shared supervision scope (`supervision-scope.ts`) now serves the participant list, the lock and broadcast alike. Students: the timer answer carries `messageCount`; the device fetches its messages (`POST /assessment/broadcasts/inbox`) only when that count grows, confirms the new ones at once, shows a recent new one as a notice in the header area (to the right on wide screens) that closes after 20 s or with "Tutup", never takes the focus and covers nothing of the question, choices, timer, navigation or save state; every message stays in "Pesan Pengawas" in the question list, and the latest one shows on the paused and locked screens. Supervisors: "Kirim Pesan" with target, message and the four quick messages of D04.6-51, and "Pesan Terkirim" with time, target, sender and "Sampai di perangkat X dari Y peserta", explicitly not "read" |
| Known limits | a student sees a message at the next state check (about 15 s, 5 s while paused or locked); a device offline at that time receives it on reconnecting; a message older than 5 minutes when it first reaches a device goes to the list without a notice; rate limit and quick messages are implementation defaults (§7) |
| Commit / PR | `cd69126`, CI run 25; part of [yusufarst/elligble#1](https://github.com/yusufarst/elligble/pull/1) |

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

#### ASSESS-PROCTOR-004 · Add time for one participant

| Field | Value |
|---|---|
| Workstream / priority / status | ASSESS-PROCTOR / P2 / DONE |
| Dependencies / blocks | ASSESS-LIFE-001 (pause-aware working time), ASSESS-PROCTOR-001 (supervision scope) / none |
| Repository evidence | the timing ledger `secure_assessment_timer_adjustments` (`0005`) was summed by every remaining-time computation (`0044`), but nothing in the product wrote it and it had no actor: a student who lost time to a power cut could not be given it back |
| Why | D04.6-41 LOCKED (add time is a first-class controlled action recording minutes, reason, actor and time), D04.2-78 (participant-specific, without changing the duration for everyone), D04.2-79, D04.6-63 and D04.9-09 (high-impact, audited), D04.6-64 (explicit confirmation with a reason), D04.5-31 (it updates the attempt timing ledger: explicit, attributable, reproducible), D04.4-67 (atomic) |
| Exact scope | the teacher who manages the exam adds 1 to 120 whole minutes with a reason to one working participant while the exam is ACTIVE or PAUSED; recorded, idempotent, visible to supervisors and to the student |
| Out of scope | adding time for a room or the whole exam (D04.6-65 limits bulk actions), reducing time, adding time after END or to an attempt whose time ran out, additions by assigned proctors (PB05) |
| Delivered | migration `0050`: every adjustment records its actor and the device's action key (unique per school), a check requires the actor on every new row, and the ledger is append-only. `POST /assessment/exam-monitoring/add-time` (`participant-time.ts`): only the teacher who manages the exam, for a participant of that exam, while it is ACTIVE or PAUSED, on the open attempt whose timer runs and still has time (`not_started`, `no_active_attempt`, `time_up` or `invalid_state` otherwise); taken under the exam and attempt row locks every attempt writer uses, so a submission or expiry in flight lands first and is seen; requests with one action key are decided one at a time, a retry returns the addition already made (`replayed`) and a key never serves another one (`action_key_reused`). Every time computation already sums the ledger, so the student's timer, saves, submission, the device's and the server's expiry follow at once, frozen while paused. Monitoring: "Tambah Waktu" for the managing teacher on every working participant opens a dialog with the time left, earlier additions (when, how much, by whom, why), the minutes, the reason and an explicit "Tambah N Menit"; the dialog keeps one action key, reused when trying again after a lost connection; "Waktu ditambah N menit" on the list for every supervisor, who and why only for the teacher. Student: "Waktu pengerjaan Anda ditambah N menit." once, at the next state check, also on the paused and locked screens, never with the reason; remembered on the device, so a reload does not repeat it |
| Known limits | the student sees an addition at the next state check (about 15 s, 5 s while paused or locked); a device whose countdown reached zero first asks the server, learns the time is not up and continues; the minute bound and the reason length are implementation defaults (§7) |
| Commit / PR | `1215586`, CI run 33 (all eight jobs, the new steps in all five browser projects); part of [yusufarst/elligble#1](https://github.com/yusufarst/elligble/pull/1) |

#### ASSESS-TEACHER-001 · Teacher question import in the product

| Field | Value |
|---|---|
| Workstream / priority / status | ASSESS-TEACHER / P2 / DONE |
| Dependencies / blocks | none / retires the operator exam-import bridge for ordinary teacher-managed exams |
| Repository evidence | exams entered only through the operator CLI (`ops/provisioning/exam.ts`); the teacher workspace had no way to create one |
| Why | D04.4-26A/26C LOCKED (a teacher with a valid teaching assignment creates the exam for that subject and class and supervises it), D04.3-61..66 LOCKED (structured import, canonical template, preview before commit, semantic validation, idempotent retry, batch provenance), D04.4-03/04/05 LOCKED (participants from the class with a preview, individual exclusion, explicit participants), D04.2-26/31/34/36/37..39 LOCKED (assessment type required, explicit window, late-start policy, school time zone, participant-aware conflicts) |
| Exact scope | teacher uploads the `elligble-questions-v1` CSV and schedules an exam for their own teaching assignment, reusing the validated import path |
| Out of scope | question authoring UI, media (D04.3-67), editing or withdrawing a scheduled exam (ASSESS-TEACHER-003), the exam preview before READY (ASSESS-TEACHER-002) |
| Delivered | "Buat Ujian" in "Pelaksanaan Ujian" opens "Buat Ujian dari Berkas Soal": the teacher's own classes (`GET /assessment/teacher-exams/setup`), one of the school's assessment types, start and end in school time, duration, the late-start rule, and the question file ("Unduh Templat CSV"; semicolons or commas, UTF-8). "Periksa" (`POST /assessment/teacher-exams/import/preview`) schedules the exam inside a transaction with the shared provisioning code, runs the same readiness checks as "Tandai Siap" and rolls everything back, so the preview is exactly what a confirmation creates; it lists every file problem with its line (the parser `question-import.ts` is shared with the CLI: header, numbering, empty prompt or option, duplicate options, one key letter only, score above 0 up to 1 000 with at most two decimals, not a text or UTF-8 file) and every setup problem (window, duration, school time zone, type, participants, conflicts), the questions with their key and score, and the students enrolled in the class on the exam day; any student can be left out; a student already expected in another exam at an overlapping time blocks it. Any change needs a new check. "Jadwalkan Ujian" (`POST /assessment/teacher-exams/import`) repeats it on the same file (SHA-256 must match) with an import key chosen by the device: a retry with the key returns the exam already created, the key never serves another file. Migration `0048`: `secure_assessment_question_import_batches` (teacher, key, template, file name, SHA-256, question count, time; append-only) and each question snapshot's batch and source line; the scheduling is recorded as a lifecycle event with the teacher as actor. The exam list shows class and assessment type for every exam. Operators define the school's assessment types at onboarding with `exam types` (migration `0049` audit action); teachers never create one. The reference proxy accepts 1 MB on the two import routes only |
| Known limits | once scheduled, the questions and participants cannot be changed in the app (the confirmation says so); before it opens the schedule can be moved and the exam cancelled (ASSESS-TEACHER-003), and other questions mean cancelling and importing again; two teachers scheduling overlapping exams for the same students at the same moment can both pass the check; both are then held at "Tandai Siap" by the readiness conflict check until one moves; limits are implementation defaults (§7) |
| Commit / PR | `02cb0b1`, CI run 31 (all eight jobs, the new browser journey in all five projects); part of [yusufarst/elligble#1](https://github.com/yusufarst/elligble/pull/1) |

#### ASSESS-TEACHER-002 · Exam preview before READY

| Field | Value |
|---|---|
| Workstream / priority / status | ASSESS-TEACHER / P2 / DONE |
| Dependencies / blocks | none (serves operator-imported and teacher-imported exams alike) / none |
| Repository evidence | no preview existed: a teacher first saw the questions as a student does only by taking the exam; readiness checks the stored content (D04.3-40) but nothing let the teacher look at it |
| Why | D04.3-38 LOCKED (the teacher previews the exam before READY: question rendering, options, navigation), D04.3-39 LOCKED (a preview never creates a real attempt), D04.3-84 (Teacher Preview ≠ Student Attempt) |
| Exact scope | "Pratinjau Soal" for the managing teacher of a SCHEDULED or READY exam: the frozen questions in the delivered order with options A to E, rendered like the exam screen, with the key and score marked for the teacher; read-only; no attempt, timer, answer or participant record is created |
| Out of scope | editing questions (ASSESS-TEACHER-003); media (D04.3-67); randomization (not configured in the baseline) |
| Delivered | `GET /assessment/teacher-exams/preview` (`teacher-exam-preview.ts`) for the teacher who manages the exam, while it is SCHEDULED or READY (409 otherwise), read in a read-only transaction so it cannot write; the questions in the order students receive them (display order, as question delivery), each with the key and score, and content the readiness check would refuse shown as it is and marked invalid. "Pratinjau Soal" on every scheduled or ready exam card opens one question at a time in the exam screen's own question card (options A to E, the question numbers, "Sebelumnya" and "Berikutnya"); the key and score appear only with "Tampilkan kunci jawaban dan skor", marked in words; options can be tried and stay on the screen |
| Known limits | the preview follows the exam screen's question card but not its whole frame (timer, save state, "Ragu-ragu"), which have nothing to show before an attempt; images and formulas do not exist in the baseline (D04.3-67) |
| Commit / PR | `4b3969d`, CI run 32 (all eight jobs); part of [yusufarst/elligble#1](https://github.com/yusufarst/elligble/pull/1) |

#### ASSESS-TEACHER-003 · Correct or withdraw a scheduled exam before it opens

| Field | Value |
|---|---|
| Workstream / priority / status | ASSESS-TEACHER / P2 / DONE (rescheduling and cancellation; Owner decision 2026-09-30, §7) |
| Dependencies / blocks | ASSESS-TEACHER-001 / none |
| Repository evidence | a teacher who scheduled the wrong time, file or participants could not change the exam, and its window kept blocking the same students at that time |
| Why | D04.2-03 (broad editing before operation), D04.2-25 LOCKED (READY re-evaluated after edits to questions, participants, duration or schedule), D04.2-45 LOCKED (moving a scheduled or ready exam before activation: readiness and conflict re-check, participant and proctor notification, audit), D04.2-46 (an ACTIVE exam is not rescheduled), D04.2-47 LOCKED concept (cancellation before ACTIVE is explicit and never hidden by deletion; "exact cancellation state/action representation later"), D04.2-11/12 LOCKED (archive before any controlled delete) |
| Exact scope | for the managing teacher, before the exam is opened: move the window, duration and late-start rule (READY falls back to SCHEDULED and is checked again), with students and proctors told; cancel the exam (SCHEDULED or READY to ARCHIVED, never ACTIVE: ending an opened exam stays END) with a mandatory reason, the actor and the time in append-only history that tells a cancellation apart from an archive after completion; nothing deleted; a cancelled exam leaves student discovery, refuses attempt starts and no longer blocks scheduling; teachers and proctors keep it as "Dibatalkan"; replacing the questions goes through cancellation and a new import |
| Out of scope | any change after the exam was opened (D04.3-73 broken-question procedure); removing participants (OPEN-05 "exact participant removal/void semantics" is open); adding participants after scheduling (D04.2-64, a separate task) |
| Delivered (rescheduling) | migration `0051`: `secure_assessment_exam_schedule_changes` (before and after of window, duration and rule, the lifecycle state it had, who, when, the device's action key unique per school; append-only). `POST /assessment/teacher-exams/reschedule` (`teacher-exam-schedule.ts`): only the teacher who manages the exam, only while SCHEDULED or READY (409 otherwise), the new times entered in school time; checks as "Tandai Siap" checks: the window must end in the future and in order, the duration 1 to 1 440 minutes and within the window under "Tidak boleh terlambat", no participant or proctor expected elsewhere at an overlapping time (422 with every reason, nothing changed); a READY exam becomes SCHEDULED, recorded as a lifecycle event with the teacher; asking for the schedule it already has records nothing; a retry with the key returns the change already made, a key never serves another. "Ubah Jadwal" on every scheduled or ready exam card opens a dialog prefilled with the current schedule in school time, the late-start rule and, for a ready exam, the warning that it must be marked ready again; the card notes when the schedule was changed. Students see on their exam card "Jadwal diubah oleh guru pada ... Jadwal sebelumnya: ..." until they start; proctors see the window and the same note on "Monitoring Ujian" |
| Delivered (cancellation) | migration `0052`: `secure_assessment_exam_cancellations` (one per exam: reason of 1 to 200 characters with its spacing tidied, who, when, the state it had, the device's action key unique per school; append-only); every lifecycle event from SCHEDULED or READY to ARCHIVED names its cancellation and only such an event may (a check), so the history tells a cancellation apart from an archive after completion; a trigger refuses to move a SCHEDULED or READY exam to ARCHIVED without a recorded cancellation and to move a cancelled exam out of ARCHIVED. `POST /assessment/teacher-exams/cancel` (`teacher-exam-cancel.ts`): only the teacher who manages the exam, only while SCHEDULED or READY (409 for every opened state: ending stays END), a reason required (400 otherwise); under the exam row lock the cancellation, the move to ARCHIVED and the lifecycle event are one transaction; a retry with the key returns the cancellation it made, a request for an exam already cancelled changes nothing and returns the first cancellation, a key never serves another exam. Nothing is deleted: participants, question snapshots, import batches and proctor assignments stay. Students no longer find it (`GET /assessment/assigned-exams` leaves it out) and starting it is refused with `exam_cancelled` ("Ujian ini dibatalkan oleh guru dan tidak dapat dikerjakan."); schedule conflicts consider operational states only, so its time is free again. "Batalkan Ujian" on every scheduled or ready exam card (the shared destructive button, as "Akhiri Ujian") opens a confirmation that says what cancelling means and asks for the reason ("Kembali" dismisses it: "Batal" beside "Batalkan Ujian" would be ambiguous); the teacher's list keeps cancelled exams apart under "Ujian Dibatalkan" with a neutral "Dibatalkan" badge, when, by whom and why, and no actions; proctors see "Ujian ini dibatalkan oleh guru pada ..." and nothing to open; no screen shows the stored state name. A shared helper (`managed-exam.ts`) now locks the managing teacher's exam for rescheduling and cancellation alike |
| Known limits | the note reaches students and proctors in the product only (no message outside it); a teacher who wants other questions or another class cancels the exam and imports again; a cancelled exam's record is shown to its teacher and proctors, a school-level history view waits on the school administration surfaces (PB05) |
| Owner decision | RESOLVED 2026-09-30 (§7): SCHEDULED or READY to ARCHIVED, no CANCELLED state; cancellation semantics kept in append-only lifecycle history (reason, actor, time) so an ARCHIVED exam shows unambiguously whether it was cancelled before opening or archived after completion; never for ACTIVE exams; idempotent or safe against duplicates; participants, attempts, question snapshots and audit evidence preserved; students never see implementation words such as ARCHIVED |
| Verification required by the Owner | SCHEDULED and READY cancellation, ACTIVE refused, mandatory reason, actor attribution, duplicate requests, student discovery exclusion, attempt start refused, scheduling conflicts after cancellation, the teacher's history view, cross-school and unauthorized refusals, PostgreSQL persistence, browser E2E of the real teacher journey, mutation checks on the guards |
| Commit / PR | rescheduling: `ec1d67e`, CI run 34 (all eight jobs); cancellation: `dc95783`, CI run 37 (all eight jobs; run 36 red on an unrelated test defect fixed in `6c5167f`, see §11); part of [yusufarst/elligble#1](https://github.com/yusufarst/elligble/pull/1) |

#### ASSESS-TEACHER-004 · Add participants after scheduling

| Field | Value |
|---|---|
| Workstream / priority / status | ASSESS-TEACHER / P2 / DONE |
| Dependencies / blocks | ASSESS-TEACHER-001 / none |
| Repository evidence | participants are fixed when the exam is scheduled; a student who joins the class later, or one left out by mistake, cannot be added |
| Why | D04.2-64 LOCKED (adding participants after READY needs authorization, a readiness re-check, room assignment where applicable, snapshot creation and audit), D04.4-20 LOCKED (late assignment needs explicit authority; after ACTIVE a stronger exception), D04.4-02/04/05/07/08/09 LOCKED (candidates from Academic Core, a specific eligible student added without editing the enrollment, explicit participants, no duplicates, no injection from another school, provenance kept), D04.2-25 LOCKED (READY re-evaluated after a participant change), D04.2-66 (a class change after READY does not rewrite the participants) |
| Exact scope | the managing teacher adds students enrolled in the exam's class to a SCHEDULED or READY exam, with the conflict and readiness re-checks and an audited record |
| Out of scope | removing participants (OPEN-05 "exact participant removal/void semantics" is open; the dialog says participants cannot be removed in the app), adding after the exam opened (D04.4-20), students outside the class, room assignment |
| Delivered | migration `0053`: `secure_assessment_exam_participant_additions` (one per request: who, when, the state the exam had, the device's action key unique per school) and `secure_assessment_exam_participant_addition_entries` (each participant it created with the enrollment it came from; a participant is added once), both append-only. `GET /assessment/teacher-exams/participants/candidates` (`teacher-exam-participants.ts`): for the teacher who manages a SCHEDULED or READY exam (409 otherwise), the students enrolled in its class on the exam day (the school-zone date of the start) who are not participants yet, once per person, each marked when already expected in another exam at an overlapping time, with the participant count and the reasons nobody can be added (no school time zone, no window, an exam run with rooms). `POST /assessment/teacher-exams/participants/add`: under the exam row lock, everyone in the request or no one (422 with every reason: not in the class that day, already a participant, a schedule conflict); the participants with their enrollment, the request and its entries in one transaction; a READY exam becomes SCHEDULED, recorded as a lifecycle event with the teacher, and is marked ready anew (every readiness check runs again); a retry with the key returns what it added, a key never serves another request. "Tambah Peserta" on every scheduled or ready exam card opens a dialog with the current count, the warning for a ready exam, the students to choose (a conflicting one shown and not choosable) and the statement that participants cannot be removed in the app; a refusal reads the list again and keeps the dialog. The card shows the participant count and when participants were added; the added student finds the exam and can start it once it opens. The student list of "Buat Ujian" and "Tambah Peserta" is one shared component (`ParticipantChoiceList`), and the scheduling confirmation now says which changes remain possible |
| Known limits | an exam run with rooms takes no additions (room assignment is not in the product yet, and no product path creates such an exam today; the dialog says so); two teachers adding the same student to overlapping exams at the same moment can both pass the check, and the readiness conflict check then holds both at "Tandai Siap", as for scheduling; the added student is not notified outside the product; the per-request bound is an implementation default (§7) |
| Verification | see §11 |
| Commit / PR | `e2929e3`, CI run 39 (all eight jobs); part of [yusufarst/elligble#1](https://github.com/yusufarst/elligble/pull/1) |

#### WEB · Client delivery

| ID | Task | Status | Scope |
|---|---|---|---|
| WEB-001 | Keep the student bundle small | BACKLOG (P2) | the client is one 501 kB script (Vite now warns above 500 kB): load the teacher, proctor and import screens on demand so a student's phone on a slow connection fetches only the exam screens; verify the offline and session journeys still pass |

#### UI-SYSTEM · One ELLIGBLE product (§10.1)

| ID | Task | Status | Scope |
|---|---|---|---|
| UI-SYSTEM-001 | Existing screen consistency audit | READY | every implemented screen against the contract (§10.1) and the DesainPakeAI "Provenance Thread" tokens of revision `sha256-5d0d7779…`: hardcoded colors, legacy blue actions, undefined tokens, duplicate components, radii, typography, spacing, button, dialog and navigation conventions, status semantics, loading, error and empty patterns, responsive drift; each finding classified MATERIAL PRODUCT CONSISTENCY DEFECT (fixed at once) or COSMETIC (folded into related work); the token convergence proposal for FRONTEND_DESIGN_SYSTEM (its locked values give way where the DesainPakeAI direction differs, §10.1); known input: at 360 px a scheduled exam card stacks five full-width actions ("Pratinjau Soal", "Ubah Jadwal", "Tambah Peserta", "Tandai Siap", "Batalkan Ujian"), a candidate for one shared action-group pattern |
| UI-SYSTEM-002 | Shell and navigation convergence | BACKLOG | one role-aware shell (brand, school context, account, page title, content width, padding, mobile navigation); the exam focus shell keeps the same tokens and controls |
| UI-SYSTEM-003 | Shared status and state patterns | BACKLOG | one status badge primitive with semantic tones (active, paused, ended, cancelled, pending, offline, saved, unsaved), shared loading, error, empty, offline and retry patterns across roles |
| UI-SYSTEM-004 | Responsive consistency verification | BACKLOG | every critical screen at 360, 768 and 1280 px: overflow, touch targets, focus states, loading, error and empty states |

#### OPS-002 · Metrics and alerting

| Field | Value |
|---|---|
| Workstream / priority / status | OPS / P2 / DONE |
| Dependencies / blocks | none / none |
| Why | D04.9-03 LOCKED (platform health is componentized), D04.9-25 (response persistence failure is critical), D04.9-32 (monitoring below response writes), PB12 |
| Exact scope | an internal metrics endpoint (requests, errors, save latency, pending finalizations) protected from the public, and documented alert rules on logs and metrics; no new vendor |
| Out of scope | choosing a hosted monitoring vendor; dashboards |
| Delivered | `metrics.ts`: in-memory counters, gauges and histograms rendered in the Prometheus text format without any dependency; requests and durations per exam-day component of D04.9-03 (every API route is mapped, a test fails for an unmapped new route), answer saves by outcome (acknowledged, refused by the exam rules, rejected, failed), expiry sweeps with finalized and still pending attempts and the last success time, database readiness and pool state, event loop delay, memory and start time; labels are fixed vocabularies, never ids or paths. A separate listener (`SA_METRICS_PORT`, `SA_METRICS_HOST` default loopback, off unless set, never the public port) serves only `GET /metrics`. `deploy/monitoring/elligble-alerts.yml`: nine alert rules with severities, answer saves failing and the database first; a test keeps every metric they use exported. Runbook §3: metrics, scrape example, alerts with their first action, the same conditions in the logs, and a drill |
| Known limits | thresholds are starting points to tune after the first exam days; metrics are per process (several instances are summed by the collector); no dashboard is shipped |
| Commit / PR | `c45b223`, CI run 26; part of [yusufarst/elligble#1](https://github.com/yusufarst/elligble/pull/1) |

#### OPS-003 · Edge rate limiting guidance and defaults

| Field | Value |
|---|---|
| Workstream / priority / status | OPS / P2 / DONE |
| Dependencies / blocks | none / OPS-001 |
| Why | P1-14; D04.9-42 LOCKED (tell an abusive burst from a legitimate autosave, reconnect or submit storm); whole schools share one address, so per-address limits must be generous |
| Exact scope | reference reverse-proxy configuration with TLS, HSTS and generous per-IP limits in the runbook, tested against the container |
| Out of scope | provisioning real infrastructure (OPS-001) |
| Delivered | `deploy/nginx/elligble.conf` (nginx 1.24 or later): HTTP to HTTPS redirect with the ACME path, TLS 1.2 and 1.3, HTTP/2, one HSTS header on every answer, the original Host forwarded for the runtime's Origin check, `X-Request-ID` for correlation, an access log without query strings, 64 KB body limit, unknown host names closed, sign-in limited to 10 a second per address (burst 200) and the API to 300 a second (burst 2 000), 429 on refusal. `deploy/nginx/smoke-test.sh`: read-only checks of a deployed proxy, with an optional flood test for staging. Runbook §1 |
| Known limits | nginx only (the same rules translate to other proxies); certificates and their renewal come with the real infrastructure (OPS-001); limits are per address, so a very large school behind one address needs a higher `rate` |
| Commit / PR | `72b97f9`, CI run 27; part of [yusufarst/elligble#1](https://github.com/yusufarst/elligble/pull/1) |

#### E2E-001 · Browser capability evidence beyond Chromium

| Field | Value |
|---|---|
| Workstream / priority / status | E2E / P2 / DONE |
| Dependencies / blocks | none / PB06 artifact |
| Why | PB06 capability testing, AGENTS split-screen honesty |
| Exact scope | run the critical journeys in Firefox and WebKit projects in CI and a tablet and desktop viewport; record platform limits honestly |
| Out of scope | native apps; split-screen and multi-window evidence on real devices (PB06 artifact) |
| Delivered | five Playwright projects, one per run on its own database and server: `mobile-360`, `tablet-768`, `desktop-1280` (Chromium), `firefox-1280` (Firefox desktop) and `webkit-390` (WebKit with the iPhone 13 profile: mobile, touch); the whole suite (pilot journey, resilience, security, results, pause, lock, messages, end and finalization) runs in each; steps that differ by layout use the question list as it appears (side panel from 1024 px, "Daftar Soal" sheet below); CI runs the five as a matrix |
| Known limits | Firefox and WebKit cannot be installed in the development container, so their evidence comes from CI only; Playwright's Firefox driver sometimes misses the load event of a page's first navigation (the browsing context group switch caused by the COOP header), so the suite waits for the rendered client instead; WebKit runs with the development cookie (it refuses Secure cookies over plain HTTP on 127.0.0.1; production uses HTTPS); browser engines in CI are not real phones or tablets (no real touch keyboards, battery or network) |
| Commit / PR | `b00fc3a`, `0c67e52`, `78b22d2`, CI run 30 (all five projects 17/17); part of [yusufarst/elligble#1](https://github.com/yusufarst/elligble/pull/1) |

#### Blocked tasks

| ID | Title | Priority | Blocked by | What unblocks it |
|---|---|---|---|---|
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
| ASSESS-TEACHER-004 | The managing teacher adds students of the exam's class to a scheduled or ready exam: conflicts refused, everyone or no one, append-only record with the enrollment, READY marked anew; nobody removed (OPEN-05) | `e2929e3`, CI run 39 |
| ASSESS-TEACHER-003 cancellation | The managing teacher cancels a scheduled or ready exam with a reason (Owner decision 2026-09-30): ARCHIVED with append-only cancellation history, nothing deleted, gone from students' lists and starts, its time free again, "Dibatalkan" for teachers and proctors | `dc95783`, CI run 37 (run 36 stopped by an unrelated test defect, fixed in `6c5167f`) |
| ASSESS-TEACHER-003 rescheduling | The managing teacher moves a scheduled or ready exam before it opens, checked as "Tandai Siap"; READY falls back to SCHEDULED; students and proctors see the change | `ec1d67e`, CI run 34 |
| ASSESS-PROCTOR-004 | The managing teacher adds time for one working participant with a reason: attributed, append-only ledger, idempotent, frozen while paused; the list and the student's screen show it | `1215586`, CI run 33 |
| ASSESS-TEACHER-002 | Teachers preview a scheduled or ready exam as students will see it, key and score on request, nothing written | `4b3969d`, CI run 32 |
| ASSESS-TEACHER-001 | Teachers schedule their own exams from a question file: preview before commit, problems with their lines, participants from the class, conflicts refused, idempotent confirmation, batch provenance | `02cb0b1`, CI run 31 |
| E2E-001 | The whole browser suite in Chromium at 360, 768 and 1280 px, Firefox and WebKit; pages opened without depending on the load event (Firefox driver after the COOP switch); failure details in the CI log | `b00fc3a`, `0c67e52`, `78b22d2`, CI run 30 |
| OPS-003 | Reference nginx configuration and smoke test: TLS, HSTS, correlation, per-address limits sized for schools | `72b97f9`, CI run 27 |
| OPS-002 | Internal metrics listener per exam-day component and alert rules with first actions | `c45b223`, CI run 26 |
| ASSESS-PROCTOR-002 | Messages from supervisors to the exam, a room or chosen participants; non-blocking on the exam screen; delivery to devices, never "read" | `cd69126`, CI run 25 |
| ASSESS-SYNC-001 | Exam-state answers ordered by server time: no resend loop, no choice dropped by a late refusal (P1-29) | `3e28d9b`, CI run 24 |
| ASSESS-PROCTOR-001 | Lock and unlock of one participant by the proctor or the managing teacher, audited; questions hidden while the time runs | `9243a85`, CI run 23 |
| RESULT-002 | Teacher result export (CSV with provenance) and print view | `ce86528`, CI run 21 |
| PR checkpoint | Pull request from `claude/laughing-mendel-p2l9gh` to `main` for the Owner's review | [yusufarst/elligble#1](https://github.com/yusufarst/elligble/pull/1) |
| RESULT-001 | Explicit, audited result finalization with frozen per-participant results | `c5aecdb`, CI run 20 |
| ASSESS-LIFE-002 | Student exam screen under pause and end; answers chosen before a pause are never lost | `1a8e81c`, CI run 19 |
| ASSESS-LIFE-001 | Exam pause, resume and end on the server with pause-aware time; teacher controls | `a40565e`, CI run 18 |
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
| DesainPakeAI design direction versus the LOCKED design system (UI-001) | Aligning screens with the DesainPakeAI project | Keep the LOCKED ELLIGBLE tokens and components until the Owner confirms which parts of the project's "Provenance Thread" foundation supersede them, or adds ELLIGBLE screens to the project | RESOLVED 2026-09-30 by the Owner's UI/UX consistency contract (§10.1): the DesainPakeAI project leads UI and UX, compatible canonical visual decisions remain, and its intent is adapted into shared ELLIGBLE tokens and components (UI-SYSTEM tasks, §6); it never overrides security, authorization, privacy, domain logic, accessibility or responsive correctness (AGENTS.md) |
| PB05 Permission Matrix | Production launch; roles beyond explicit assignments | Keep assignment-scoped least privilege until the matrix is approved | OPEN |
| PB01, PB02, PB03, PB10 (legal allocation, retention, DPIA, classification/consent) | Production launch with real student data | Owner/legal artifacts | OPEN |
| Centralized (institution-managed) exam governance roles (D04.4-26D/E) | Activation of non-teacher-managed exams | Teacher-managed mode first | OPEN (not blocking critical path) |
| End-of-exam handling (D04.2-81) and pause timer behaviour (D04.2-77) | ENDED / PAUSED operations | ENDED: no new attempt starts; active attempts are not force-submitted and keep their own server-authoritative remaining time, finishing by normal submission or automatic submission at their own expiry; finalization only when no active attempt remains; ENDED does not publish results. PAUSED: no new starts; every active attempt's remaining time freezes at the authoritative pause boundary; no extra working time; the exam screen becomes paused and read-only; no new answer edits accepted; answers captured before the boundary are not lost because they had not synced yet; RESUME continues from exactly the pre-pause remaining time; PAUSE/RESUME idempotent, audited, safe across reload, reconnect and the session rules | RESOLVED 2026-09-30 by the Owner; implemented by ASSESS-LIFE-001 and ASSESS-LIFE-002 (§6) |
| ELLIGBLE ID format and generation (D02.10-C) | Account provisioning at scale | Until decided, operators supply IDs in a conservative syntax (3 to 64 lower-case letters, digits, dot, dash, underscore; not e-mail based); the platform only checks uniqueness | OPEN (not blocking the pilot) |
| Activation code validity (D02.3-09 "short-lived") | Activation cards | 7 days by default, operator may choose 1 to 30 days per issue | IMPLEMENTED DEFAULT, adjustable |
| Student result visibility (D04.8-16/21/22: options exist, "exact school-facing options later") | Showing scores to students | Hidden until the teacher publishes a finalized result, per exam; only the student's own score, no ranking or peer results (D04.8-50/51) | OPEN (students see no scores today; teachers see provisional results) |
| Who finalizes the results of a teacher-managed exam (D04.8-17/57; D03.6-25/26 keep finalization capability-based and allow maker-checker, PB05 matrix OPEN) | "Finalisasi Hasil" | The teacher who manages the exam (the same assignment-scoped authority that opens, pauses and ends it, D04.4-26A); one step, audited with actor and time; no second approver | IMPLEMENTED DEFAULT, adjustable when PB05 or a maker-checker rule is decided |
| Broadcast rate limit (D04.1-77F: "exact rate limits remain later implementation policy") | "Kirim Pesan" | One message per sender and exam every 15 s, at most 20 per sender and exam in an hour; the refusal says when to try again | IMPLEMENTED DEFAULT, adjustable |
| Quick broadcast messages ("exact quick broadcast templates" left open by Discovery 04) | "Pesan cepat" in the composer | The four examples of D04.6-51 | IMPLEMENTED DEFAULT, adjustable |
| Exam content import by platform operators on behalf of teachers | Pilot exams before a teacher authoring or import screen exists | Audited, case-linked operator import; teachers keep readiness and activation | IMPLEMENTED AS PILOT BRIDGE; teachers now schedule their own exams (ASSESS-TEACHER-001), the CLI stays for operators |
| Who adds time and how much (D04.6-41 records minutes, reason, actor and time; A41: higher-impact actions need stronger authority; PB05 matrix and OPEN-08 maker-checker open) | "Tambah Waktu" | The teacher who manages the exam (the authority that pauses, resumes and ends it), for one working participant, 1 to 120 whole minutes per addition with a reason of 1 to 200 characters, while the exam runs or is paused; never after END or once the time ran out; assigned proctors see that time was added, not by whom or why; no second approver | IMPLEMENTED DEFAULT, adjustable when PB05 or a maker-checker rule is decided |
| Withdrawing a scheduled exam before it opens (D04.2-47 LOCKED concept: explicit, never hidden by deletion; "exact cancellation state/action representation later"; no cancellation state in the lifecycle) | "Batalkan Ujian" (ASSESS-TEACHER-003) | The managing teacher moves a SCHEDULED or READY exam to ARCHIVED with a mandatory reason, recorded as a lifecycle event with the teacher; it leaves the students' lists and no longer blocks their schedule; nothing is deleted | RESOLVED 2026-09-30 by the Owner: SCHEDULED or READY to ARCHIVED, no new CANCELLED state; reason, actor and time in append-only lifecycle evidence that distinguishes a cancellation from an archive after completion; never for ACTIVE exams (END stays); not physically deleted; idempotent or safe against duplicates; no longer actionable or visible as upcoming for students, no attempt starts, no scheduling conflicts; teachers and administrators keep it as "Dibatalkan"; students never see ARCHIVED |
| Who adds participants after scheduling, and whom (D04.2-64 requires authorization; PB05 matrix open; D04.4-20) | "Tambah Peserta" (ASSESS-TEACHER-004) | The teacher who manages the exam, before it opens; only students enrolled in its class on the exam day and not expected elsewhere at the same time; up to 1 000 per request; a ready exam is marked ready again; exams run with rooms take no additions until room assignment exists in the product (none is created by the product today); nobody is removed (OPEN-05) | IMPLEMENTED DEFAULT, adjustable when PB05 is approved |
| Teacher question import limits and choices (D04.3 leaves exact columns and limits open; D04.2-26 labels configurable) | "Buat Ujian" | At most 200 questions and 512 KB of text per file; a score above 0 up to 1 000 with at most two decimals (scores stay exact in the result arithmetic); the template offered with semicolons and a decimal comma (commas accepted); teachers choose among the school's assessment types defined by the operator and never create one; every student enrolled in the class on the exam day is proposed and may be left out; an overlapping exam for the same students blocks the scheduling | IMPLEMENTED DEFAULT, adjustable |

## 8. Production Blockers (PB01-PB12)

| PB | Status | Engineering contribution on the critical path |
|---|---|---|
| PB01 Controller/Processor allocation | OPEN (Owner/legal) | none |
| PB02 Retention matrix | OPEN (Owner/legal) | none |
| PB03 DPIA | OPEN (Owner/legal) | none |
| PB04 Authentication policy | CLOSED (DEC-041) | implement the policy in HTTP/session transport (step 3) |
| PB05 Permission Matrix | OPEN | assignment-scoped authorization only; no invented policy |
| PB06 Assessment Capability Testing | OPEN | browser E2E suite in CI DONE (step 9: pilot journey, resilience and refusals at 360 px, Chromium); the whole suite now also runs at 768 and 1280 px and in Firefox and WebKit engines (E2E-001, CI matrix); real-device evidence, split-screen/multi-window limits and the formal test artifact remain |
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
| Migrations | 53 idempotent SQL files; runner with advisory lock and history/unknown checks (`npm run migrate`, `migrate:check`); startup preflight `check` (default) or `apply` |
| Build | `Dockerfile`: web client built with Vite, runtime on Node 24 (type stripping), production dependencies only, non-root user, `HEALTHCHECK` |
| Startup / health | preflight (database wait, schema check), `/healthz`, `/readyz`, graceful SIGTERM (verified with the real process) |
| Hosting / TLS / cookies | client and API from one origin; TLS at the reverse proxy with a reviewed reference configuration and smoke test (`deploy/nginx/`, runbook §1); `__Host-` Secure cookie and HSTS in production |
| Logging / monitoring / error reporting | JSON-lines access and error log with request ids; internal metrics listener (`SA_METRICS_PORT`) per exam-day component and alert rules in `deploy/monitoring/` (OPS-002); choosing where the collector and alerting run belongs to OPS-001 |
| Backup / restore / incident response / rollback | runbook procedures; local restore drill verified; production drill pending (PB11) |
| Rate limiting | per-account login policy in runtime (DEC-041); per-address limits at the proxy in the reference configuration `deploy/nginx/elligble.conf` (OPS-003, P1-14) |
| Provisioning | audited operator CLI (runbook §7) for schools (with their time zone), people with activation cards, academic setup, the school's assessment types, exams and activation reissue; teachers schedule their own exams from a question file in the product |
| CI | `.github/workflows/ci.yml`: runtime typecheck, unit and PostgreSQL 16 integration; web typecheck, tests and build; browser end-to-end suite against the production process; image build and smoke test |

## 10. Design and UI status

- DESAINPAKEAI PROJECT: `b5a22aa4-7b38-49d2-9448-443eab6e8075`. CONTEXT REVISION: `sha256-5d0d77796ab574177a840d227a99e7457d623564c9d40160703f32224073c2b8`. CONTEXT VERIFIED: YES (2026-09-30). CLI `dpai` 0.2.2, authenticated at user level against `https://desainpakeai.com` (no repository file, environment file or document holds the key); skill `@desainpakeai/skills` 0.2.0 installed for the `claude-code` harness; MCP not used. Before every substantial UI checkpoint: `dpai auth status --pretty`, `dpai project current --pretty`, `dpai context --pretty`, and compare the revision with the one recorded here.
- Alignment finding (UI-001, resolved by §10.1): the project's pages are a sales-dashboard sample (Dashboard Penjualan, Transaksi, Leads & kontak, Target penjualan, Laporan penjualan, Tim sales, Pengaturan akun, Masuk), not ELLIGBLE screens. Its design system "Provenance Thread" (alpha) matches the locked Warm Monochrome direction in restraint, near-black primary, warm near-white canvas, Inter for UI text and compact radii, but adds a serif display face (Libre Baskerville), a mint brand accent, a "source-to-decision thread" device and a green focus ring that the LOCKED FRONTEND_DESIGN_SYSTEM v1.1.0 does not have. Until UI-SYSTEM-001 records the token convergence, new screens keep the current ELLIGBLE tokens and shared components; from then on the Provenance Thread intent is adapted into the shared tokens and primitives (§10.1), never page by page. Inspected 2026-09-30 at the recorded revision: design system "Provenance Thread" alpha.1 (32 color, 10 typography roles, 13 sections, 11 components: page, primary and secondary button, thread, knowledge shell, source card, evidence row, status chip, search control, navigation item, alert banner); tokens: near-black primary action, mint brand (#0c8c5e) and focus ring (#006b49), warm canvas, Inter for UI, Libre Baskerville for display, Geist Mono for technical text, radii 4/6/12/20 px, semantic info, positive, warning and danger with their surfaces, motion 150 and 300 ms.
- shadcn/ui: configured once (`frontend/web/components.json`, Tailwind CSS v4 via `@tailwindcss/vite`, `src/components/ui/*`, `src/styles/globals.css`) and themed only with ELLIGBLE tokens (DEC-043). The first components were written from the official new-york v4 sources while `ui.shadcn.com` was blocked; it is reachable again (2026-09-30), so further components may come from the registry, themed with the same tokens.
- Tokens aligned to FRONTEND_DESIGN_SYSTEM v1.1.0 (P1-9). New screens (login, school picker, shell, re-login dialog) use shadcn/ui; older screens keep their CSS and migrate incrementally.
- Rendered checks (Playwright, Chromium, 360 px and 1280 px): login, validation, wrong password, student, school picker, no-workspace, proctor and teacher screens render without horizontal overflow.

### 10.1 Global UI/UX consistency contract (Owner, 2026-09-30, permanent)

ELLIGBLE is one product across every module, role, page and journey (Student, Teacher, Proctor, Parent/Guardian, School Admin, Partner, Platform Operations, Track, Care, Passport, Path, Opportunity, Application, Outcome, Alumni/Impact and every other canonical surface): one design system, visual language, interaction language, typography, color, spacing, icon, component and responsive system. Roles may differ in information density and task-specific patterns, never in look.

1. Design authority for UI and UX: (1) the Owner-approved DesainPakeAI project `b5a22aa4-7b38-49d2-9448-443eab6e8075`; (2) ELLIGBLE product, domain and security requirements; (3) canonical visual decisions that remain compatible; (4) shared ELLIGBLE tokens and primitives; (5) shadcn/ui as the implementation foundation; (6) page-specific decisions. Before substantial UI work: `dpai auth status --pretty`, `dpai project current --pretty`, `dpai context --pretty`; alignment is claimed only for a revision actually inspected.
2. No per-page design systems: no arbitrary colors, radii, shadows, font sizes, spacing, icon libraries, page-local buttons, modals or status colors, duplicated components, one-off cards, or divergent tables, navigation, loading, error and empty states. A pattern that appears twice becomes a shared primitive or a documented variant.
3. Shared tokens for colors, foreground and background hierarchy, surfaces, borders, radius, elevation, spacing, typography, weights, line heights, focus ring, interactive and disabled states, success, warning, error and information semantics, motion, breakpoints and touch targets; no repeated hard-coded values in pages.
4. shadcn/ui is the shared substrate (Button, Input, Textarea, Select, Checkbox, Radio, Switch, Dialog, Drawer, Sheet, Popover, Dropdown, Tooltip, Tabs, Badge, Alert, Card, Table, Skeleton, Toast, forms, Pagination, navigation, command search, Progress, status indicators), adapted through central variants and tokens, never shipped with default appearance, never duplicated per role folder without a functional reason.
5. One shell system with role-aware variants: brand, navigation hierarchy, page title, breadcrumbs where useful, school context, account controls, notifications, desktop, tablet and mobile navigation, content width, padding and section spacing. The active exam mode may use a distraction-minimal focus shell with the same typography, tokens, controls, dialogs, status semantics and identity.
6. Equivalent actions look and behave the same everywhere (page and section headers, cards, metric cards, forms, filters, search, tables, lists, status badges, confirmation and destructive dialogs, empty, error, loading, offline and retry states, success confirmation, date and time, identity labels, school context, pagination, responsive data).
7. Semantic color: success, warning, error, information, neutral, active, paused, ended, cancelled, pending, offline, saved and unsaved mean the same in every role, never by color alone.
8. One typography system: display, page title, section title, subsection title, body, secondary body, label, helper text, caption, data.
9. One responsive philosophy for mobile, tablet and desktop, not a shrunk desktop; no page-specific breakpoints without need; every substantial new UI checked at 360, 768 and 1280 px; no horizontal overflow unless a component scrolls on purpose; usable touch targets.
10. Role variation only where the task requires it (student focused, teacher denser, proctor real-time, school admin configuration, parent read-oriented, partner opportunity-oriented), always with the same tokens, typography, components, navigation logic, forms, dialogs, status language, icons, responsive behavior and feedback.
11. Design drift audit (UI-SYSTEM-001): findings are MATERIAL PRODUCT CONSISTENCY DEFECT (fixed at once) or COSMETIC / SAFE TO CONVERGE DURING NORMAL WORK (folded into related tasks); the audit does not stop the critical path.
12. DesainPakeAI patterns are adapted, not copied: design intent → ELLIGBLE tokens → shared shadcn primitives → reusable → applied consistently.
13. Visual verification at major UI checkpoints: DesainPakeAI revision, component and web tests, production build, rendered critical screens at 360, 768 and 1280 px, no overflow, focus states, loading, error and empty states, and the screen visibly belonging to the same product; browser E2E screenshots where useful.
14. UI/UX is complete only with DesainPakeAI alignment verified, shared tokens and components, consistent typography, spacing, color semantics, interaction states, responsive behavior, shells and navigation, no known material drift, no broken mobile layout, no major accessibility regression, no placeholder visuals, and every critical role journey visually coherent.
15. Tracked in the existing task graph as the UI-SYSTEM workstream (§6.2), with tasks only for real engineering work.
16. Every UI task answers: does this look and behave like the same ELLIGBLE product as every other role and module? If not, the shared system is fixed rather than another isolated style added.

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

After result finalization (RESULT-001, this branch):

| Check | Result |
|---|---|
| runtime unit | 899/899 PASS |
| integration (real PostgreSQL 16) | 102/102 PASS. Refused on an ACTIVE exam and while an attempt runs (nothing recorded, the exam stays ENDED); an attempt whose time ran out is finalized from its accepted answers (`EXPIRY_SERVER`) and the exam finalized; the finalization records the teacher, rule `BASELINE_SINGLE_CHOICE_V1`, 3 questions, maximum and an empty pending-issue list; the lifecycle event ENDED→FINALIZED carries the teacher; frozen results: 66.67 and 33.33 with the right sources, the started-but-never-timed and never-started participants ABSENT without a score, per-question outcomes with the selected options; a repeat changes nothing; after editing an answer and an answer key directly in the database the teacher still sees exactly the same results; updates, deletes and inconsistent rows refused; readiness lists the exam as FINALIZED with its time; the student's exam list carries no score; another teacher and a student refused; content that cannot be scored refuses finalization. Mutation-checked: showing recomputed results instead of the frozen ones is caught |
| web vitest / `vite build` | 200/200 / PASS: "Finalisasi Hasil" with its confirmation, disabled with a note while participants are working, refusal explained, finalized card with its time, "Hasil final" view with "Tidak mengerjakan" |
| browser E2E | 15/15 PASS: after the end, finalization stays closed while two students still work; once their time runs out the teacher finalizes; "Hasil final" lists every participant (automatic submissions marked, the absent student "Tidak mengerjakan", 66,67 for the first student) and the database holds six frozen rows with one ABSENT; the student still sees no score |
| rendered check (Chromium, 360 px and 1280 px) | ended card with "Finalisasi Hasil", its confirmation, finalized card and final results: no page errors, no horizontal overflow, no em dash |

After the teacher result export (RESULT-002, this branch):

| Check | Result |
|---|---|
| web vitest / `vite build` | 204/204 / PASS: header and rows in WIB, decimal comma, empty cells for the absent participant, provisional marked, formula-like values neutralized, quoting of separators and quotes, file names; the button hands a UTF-8 CSV to the browser and "Cetak" opens the print dialog |
| browser E2E | 15/15 PASS: the teacher downloads the final results: expected file name, byte-order mark, header and six rows with "Oleh siswa", "66,67" and an absent row of empty cells; in print mode the controls and the sign-out button are hidden and the table stays |
| rendered check (Chromium, 360 px) | results with the new actions and the print rendering: no horizontal overflow |

After participant lock and unlock (ASSESS-PROCTOR-001, this branch):

| Check | Result |
|---|---|
| typecheck (secure-assessment, web, E2E) | PASS |
| runtime unit | 899/899 PASS incl. route parity with the new client call |
| integration (real PostgreSQL 16) | 107/107 PASS. One participant locked: resume, timer and monitoring report the lock, questions, marks, submission and a save without capture time or captured after the lock refused with `attempt_locked`, an answer captured 1 ms before the lock saved, the neighbour unaffected; a repeated lock or unlock changes nothing; after the unlock an answer captured during the lock refused with the interval, others accepted; the row records who locked and unlocked and when; a locked attempt whose time runs out is finalized by the server; the boundary comes after a save in flight; the managing teacher, the assigned proctor of an exam without rooms and the room proctor for their room may act; another room, a proctor not assigned to the exam, a participant of another exam, another teacher, a student and another school are refused with nothing written, as is a finalized exam; a participant who has not started has nothing to lock. Mutation-checked: dropping the room filter is caught |
| web vitest / `vite build` | 216/216 / PASS: "Kunci" only for working participants, both confirmations, outcome and refusal messages, no action after finalization; lock codes read from refusals; the engine keeps a choice made before the lock, drops and reports one made during it, takes no choice while locked and again after the unlock, and a resume of the exam does not lift a lock; the locked screen with running time after a reload and the questions back after the unlock; a save or a submission that meets the lock switches to it and names the dropped question; marks wait while locked. Mutation-checked (engine capture guard, mark retry, lock offer, locked screen, lock refusal parsing): all caught |
| browser E2E | 16/16 PASS against the production process: an offline student chooses an answer, the proctor locks them from "Lihat Peserta" at 360 px with the confirmation, the student changes another answer still offline; back online the first is saved and the second refused and named on "Pengerjaan Dikunci"; the time keeps running, also after a reload; "Buka Kunci" returns the questions with the kept answer; the database records the proctor as the one who locked and unlocked |
| rendered check (Chromium, 360 px and 1280 px) | confirmation, monitoring with "Dikunci" and "Buka Kunci", locked student screen: no horizontal overflow, no em dash; DesainPakeAI context revision unchanged (§10) |
| CI GitHub Actions | run 23 green on `9243a85` |

After ordering exam-state answers by server time (ASSESS-SYNC-001, this branch):

| Check | Result |
|---|---|
| reproduction before the fix | engine tests: after an answer closed a span the server still held, one refused choice was sent 21 times (the test stopped the screen's re-checks at 20) instead of once; a refusal produced before a resume or unlock and delivered after it dropped the choice made afterwards; screen tests: a state answer produced before the pause or lock brought the questions back after a save had reported it |
| web vitest / `vite build` | 228/228 / PASS: for pause and lock, a stale "over" answer is ignored and a fresh one applied; a newer refusal after a wrong close reopens the span: one request, the choice dropped and reported, the span held; a late refusal drops only the choice made inside (no second request), the later choice is saved and nothing is paused or locked; a span the server recorded as ended is never reopened by an older answer, whether the record came first or after the span was known; the screen stays paused or locked on a stale answer and continues on a fresh one; the server time is read from refusals. Mutation-checked (16 mutations: staleness in the engine, both refusal branches and both state notes, the reopen, the late-refusal record for pause and lock, the recorded end in three places, the screen check for each kind, the server time in the classifier): all caught |
| runtime unit / integration | 899/899 / 107/107 PASS (no runtime change) |
| browser E2E | 16/16 PASS (no regression: pause, lock, end and finalize journeys) |

After broadcast messages (ASSESS-PROCTOR-002, this branch):

| Check | Result |
|---|---|
| typecheck (4 runtime packages, web, E2E) | PASS |
| runtime unit | 899/899 PASS incl. route parity with both new client calls |
| integration (real PostgreSQL 16) | 115/115 PASS. The teacher's message to the exam reaches the working and the waiting participant, not the one who submitted; sender, target, normalized message and time stored; the timer answer counts it; fetching does not confirm it, the device's confirmation does, once; another participant's ids confirm nothing and another student's attempt is refused; a device confirms only the messages it names. Chosen participants only; one outside the scope and nothing is written. One sender waits 15 s (with Retry-After) while another supervisor is not held back; after 20 messages in an hour the next waits until the oldest leaves the hour. A room proctor cannot address the entire exam, another room or a participant elsewhere, and reaches their room only; the teacher reaches every room; each supervisor's history and counts stay within their scope; a room target on an exam without rooms is refused. Another teacher, a participant, another school and an unassigned member are refused; empty, blank, 201-character and malformed targets refused, 200 characters accepted; a scheduled exam and an exam where everyone submitted refused. Broadcasts cannot be changed or deleted, recipients cannot be deleted or have their delivery cleared. Lock and monitoring suites unchanged on the shared scope. Mutation-checked (10: whole-exam address by a room proctor, another room, chosen participants outside the scope, recipients who submitted, interval, hourly cap, confirmation of all by one, delivery on fetch, history beyond the scope, another participant's inbox): all caught |
| web vitest / `vite build` | 238/238 / PASS: composer with the whole exam for the teacher, only rooms and chosen participants for a room proctor, quick message, counter, no send without a chosen participant, wait time on the rate limit, history with sender, target and "Sampai di perangkat", no composer after finalization; inbox fetched at the start, confirmed at once, a recent message shown once and not after a reload, older ones only listed, fetched again only when the count grows or a confirmation is owed, the notice closes by itself and on "Tutup"; on the exam screen the notice keeps the focus where it was, answers still save, the message stays in the question list, and the paused screen shows the latest one. Mutation-checked (10): all caught |
| browser E2E | 17/17 PASS against the production process: the teacher sends "Ujian tersisa 15 menit." to the entire exam at 360 px; the student's screen shows it with the time, the student changes an answer and it is saved, closes the notice and finds the message in "Daftar Soal"; the teacher's "Pesan Terkirim" shows it reached one device; the database records the teacher, the target and the message |
| rendered check (Chromium, 360 px and 1280 px) | composer (the long quick message wraps inside the dialog after the first render showed it cut off, now asserted), student notice at the top and to the right on a wide screen with the list in the question panel, monitoring history: no horizontal overflow, no em dash; DesainPakeAI context revision unchanged (§10) |
| CI GitHub Actions | run 25 green on `cd69126` |

After operator metrics and alert rules (OPS-002, this branch):

| Check | Result |
|---|---|
| typecheck (secure-assessment) | PASS |
| runtime unit | 905/905 PASS: every API route of the server belongs to a named component; counters, cumulative histogram buckets with +Inf, sum and count, save outcomes and sweep results render in the text format without ids or paths; the listener serves only GET /metrics (404 elsewhere, 405 for POST) with live pool state and a readiness of 0 when the database check fails; the public server counts requests but answers 404 for /metrics; every metric the alert rules use is exported; the metrics port must differ from the public port |
| integration (real PostgreSQL 16) | 118/118 PASS: through the production wiring an acknowledged and a refused save are counted by outcome with their latency, per-component request counts follow the journey, no attempt id appears; an overdue attempt held by another transaction is reported as pending by the sweep, then finalized and counted once released |
| mutation checks | refused saves counted as rejected, non-cumulative buckets, an unmapped route, running attempts counted as pending, a sweep never reported, metrics on the public port: all caught |
| runbook drill (real process, `SA_METRICS_PORT=9464`) | `metrics_listening` logged; the internal listener answers with request counts, a successful sweep, pool state, `elligble_database_ready 1` and the event loop delay; POST answers 405; the public port (serving no web client in this drill) answers 404 for /metrics, and with the web client it answers the client's page, never metrics (OPS-003 smoke test); SIGTERM closes both listeners (`shutdown_complete`) |

After the reference reverse proxy (OPS-003, this branch):

| Check | Result |
|---|---|
| `nginx -t` (nginx 1.24.0) | the reference configuration is valid (with local ports, host name and a self-signed certificate substituted) |
| smoke test (`deploy/nginx/smoke-test.sh`, runtime in production mode with the web client behind the proxy) | readiness through the proxy, one HSTS header, the request id echoed, no metrics on the public side, sign-in reaching the runtime with its Origin (401 for the unknown account), 64 KB limit (413), HTTP to HTTPS (301): all ok; the first run against a stopped runtime failed with 502 as it should, and a first version of the metrics check expecting 404 was corrected (the public side answers /metrics with the web client's page, never metrics) |
| sign-in through TLS | a real sign-in answers 200 with `__Host-elligble_session` marked `Secure`, `HttpOnly`, `SameSite=Strict`; the session is then valid through the proxy; a state change with a foreign Origin answers 403 |
| D04.9-42 | 1 500 API requests from one address in 5.6 s (about 270 a second, more than 1 000 answering students) all reach the runtime without a single 429; 400 rapid sign-ins from one address are partly refused by the proxy with 429, and sign-in works again after the flood |
| correlation and privacy | the proxy's access log line carries the path without the query string (no attempt id) and the request id that the runtime logs for the same request |

After browser and width coverage (E2E-001, this branch):

| Check | Result |
|---|---|
| typecheck (E2E suite) and actionlint (workflow) | PASS |
| browser E2E, Chromium, locally | `mobile-360` 17/17, `tablet-768` 17/17, `desktop-1280` 17/17 (the question list checks follow the layout: sheet below 1024 px, side panel from 1024 px) |
| browser E2E, CI run 28 (`b00fc3a`) | `mobile-360`, `tablet-768`, `desktop-1280` and `webkit-390` 17/17 PASS; `firefox-1280` 16/17: the first navigation of a new student page never reported the load event within the test time |
| browser E2E, CI run 29 (`0c67e52`, failure details in the job log) | the three Chromium widths PASS 17/17; `firefox-1280` failed in another test with the same signature: the first navigation of a new page served the page, script, style sheet and the session check (all 200, the client rendered and called the API) and still never reported the load event; two later tests failed as a consequence (the student of that test never started). Cause: every page sends `Cross-Origin-Opener-Policy: same-origin`, so the first navigation of a page leaves about:blank for a new browsing context group, and Playwright's Firefox driver sometimes loses the load event after that switch. The header stays (it protects the exam window from cross-origin openers); the suite now opens a page with `open()`, which waits for the navigation to commit and for the client to render instead of the load event, and still fails when a navigation really fails |
| browser E2E, Chromium, locally, after `open()` | `mobile-360` 17/17, `desktop-1280` 17/17 |
| rendered check (Chromium, 1280 px) | question list with the "Ragu-ragu" mark in the side panel, locked screen: readable, no overflow |

After teacher question import (ASSESS-TEACHER-001, this branch):

| Check | Result |
|---|---|
| typecheck: runtime and web client | PASS |
| secure-assessment unit (`npm test`) | 911/911 PASS (question file parser: codes and lines for every row problem, semicolon and comma files, not-text and encoding refusals, score bounds, limits) |
| secure-assessment integration (real PostgreSQL) | 130/130 PASS; `teacher-exam-import.test.ts` (11): own classes only, preview writes nothing, file and setup problems together, 400/403/405/413 refusals, confirmation with provenance, source lines, chosen participants and the teacher as lifecycle actor, the result passes readiness and is marked ready, key retry returns the same exam, key reuse for another file and a changed file refused, overlapping exam refused with the students marked, two racing confirmations create one exam, revoked assignment refused, batches append-only; provisioning (15): `exam types` idempotent and audited, operator exam import unchanged |
| mutation checks | server: no advisory lock, no SHA-256 check, no conflict marking, any teacher, a committed preview, key reuse accepted, an ended window accepted: each caught; client: a new key per retry, a participant change not asking for a new check, participants kept for another class: each caught |
| web client | 248/248 PASS (10 new: exact input sent to the check, problems worded with lines, exclusion and new check, another class starts from everyone, retry keeps the import key, problems at confirmation, access refusal, every problem worded without an em dash, "Buat Ujian" and notice in the exam list) |
| browser E2E, Chromium, locally | `mobile-360`, `tablet-768`, `desktop-1280` 18/18 (new: the teacher sees the line of a wrong key, fixes the file, leaves one student out, schedules, marks ready, opens; an included student sees the imported question; provenance and participants checked in the database) |
| rendered check (Chromium, 360, 768 and 1280 px) | the import form, problems, participants and questions with the key marked in words: readable, no horizontal overflow |
| reference proxy (nginx 1.24, local, TLS) | smoke test PASS, including a 200 KB question file reaching the runtime on the import route while other routes keep the 64 KB limit and more than 1 MB is refused |
| DesainPakeAI checkpoint | authenticated, project `b5a22aa4-...`, context revision unchanged; the new screen uses the LOCKED tokens and shadcn/ui components |

After the exam preview (ASSESS-TEACHER-002, this branch):

| Check | Result |
|---|---|
| secure-assessment integration (real PostgreSQL) | `teacher-exam-preview.test.ts` (4): the managing teacher gets the questions in delivered order (ids sorting differently) with key and score, invalid content shown without a key, nothing written; READY too; another teacher, a student, an unknown or malformed id, an open exam (409) and a revoked assignment refused |
| mutation checks | any state allowed, any teacher, insertion order, no key, revoked assignment allowed: each caught |
| web client | 253/253 PASS (5 new: one question at a time in order with the key only on request, trying options requests nothing else, invalid content marked, refusals explained, the card button only before the exam opens) |
| browser E2E, Chromium, locally | 18/18 at 360, 768 and 1280 px: the teacher previews the imported exam, tries an option, shows the key, and no attempt exists afterwards; the check found the navigation buttons too wide at 360 px, fixed |
| rendered check (Chromium, 360 and 1280 px) | question card, key marked in words, navigation: no horizontal overflow |

After adding time (ASSESS-PROCTOR-004, this branch):

| Check | Result |
|---|---|
| secure-assessment unit | 911/911 PASS (route parity calls the new client function; every route has a metrics component) |
| secure-assessment integration (real PostgreSQL) | 141/141 PASS; `participant-time.test.ts` (7): the managing teacher adds time for one participant, recorded with minutes, reason, actor, key and time, followed at once by the student's timer and the list, others untouched; a retry is replayed and a key never serves another addition; additions add up; the ledger is append-only, requires an actor and keeps keys unique; added time carries saves past the old deadline and the sweep leaves the attempt alone, while an attempt whose time ran out is refused and then finalized; while paused the addition waits in the frozen time; not started, no attempt, submitted and ENDED refused; two retries overtaking the original under a save in flight add nothing twice; a submission in flight lands first; a proctor, another teacher, a student, an unknown participant or one of another exam, invalid amounts, reasons or keys and a revoked assignment refused, writing nothing. Monitoring, pause and expiry tests now write attributed adjustments and check the new fields |
| mutation checks (each against a verified passing baseline) | server: proctor authority, time already up, END, replay, key reuse, the advisory lock (four runs), the submission race, timer not started, minute bounds, a participant of another exam, the reasons only for the teacher, the managing-teacher flag; migration: append-only trigger, actor check, unique key; web: key kept on retry, the button only for the managing teacher and not after END, minute bounds, one announcement, the memory fallback, the note on the paused screen, the refusal texts: each caught. One equivalent mutant: reading the history for everyone while the response still omits it |
| web client | 262/262 PASS (9 new: adding minutes with a reason to one working participant, the bounds, one key per dialog kept on retry, refusals explained, who and why only for the teacher, paused and ended exams, the student's note once and not after a reload, on the paused screen, remembered in memory when storage is refused) |
| browser E2E, Chromium, locally | 18/18 at 360, 768 and 1280 px: from "Pantau Peserta" the teacher adds 5 minutes with a reason to one student; the list shows it; the student's screen says so at its next check, the time grows and the reason never appears; the database holds one addition by the teacher with its key |
| rendered check (Chromium, 360 and 1280 px) | the dialog, the row with "Waktu ditambah", "Kunci" and "Tambah Waktu", and the student's note: no horizontal overflow |
| environment | the container restarted during verification and stopped PostgreSQL; checks run while it was down were discarded and repeated after the restart |

After rescheduling before the exam opens (ASSESS-TEACHER-003, this branch):

| Check | Result |
|---|---|
| secure-assessment unit | 911/911 PASS (route parity calls the new client function; the metrics map covers the route; the student list handler keeps the new schedule field) |
| secure-assessment integration (real PostgreSQL) | 147/147 PASS; `teacher-exam-schedule.test.ts` (6): the managing teacher moves a scheduled exam, the exam and the change record hold before and after, actor, key and time; a retry is replayed, a key never serves another change, the same schedule records nothing, the record is append-only with unique keys; retries overtaking the original under a transition in flight change nothing twice, and the key is refused for another exam; a ready exam becomes scheduled (lifecycle event with the teacher), students, proctors and the teacher see the change, and it is marked ready anew; window order, a window already over, an unreal date, duration bounds, a duration longer than the window under "Tidak boleh terlambat", a participant conflict and a missing school time zone refused with their reasons, nothing changed; another teacher, a student, an assigned proctor, an unknown exam, opened exams in every state, malformed requests and a revoked assignment refused |
| mutation checks (each against a verified passing baseline) | server: authority limited to the managing teacher, opened exams refused, READY falling back, its lifecycle event, a window already over, the duration fit, participant conflicts, key reuse, the replay, an unchanged schedule recorded, duration bounds, the school time zone, the student and proctor projections; migration: append-only record, unique key (a direct check, since the exam row lock orders same-exam retries before the key could collide); web: key kept on retry, prefill in school time, the warning for a ready exam, the reasons listed, a final refusal closing the dialog, the student note only before starting, the proctor note, the teacher's card note, the button itself: each caught |
| web client | 269/269 PASS (7 new: prefilled in school time and saved as entered, the ready exam warning and notice, every reason explained with the dialog kept and one key across tries, closed with the reason once opened and no button afterwards, the card note, the student card until starting, the proctor list with the new window) |
| browser E2E, Chromium, locally | 18/18 at 360, 768 and 1280 px: the teacher marks the imported exam ready, moves it with a longer window and duration, sees it scheduled again with the note, marks it ready anew and opens it; the included student's card says the schedule was moved and when it was before; the database holds one change by the teacher from READY and the transitions DRAFT, SCHEDULED, READY, SCHEDULED, READY, ACTIVE in order |
| rendered check (Chromium, 360 and 1280 px) | the dialog (scrolls within the screen at 360 px), the teacher's card and the student's card with the note: no horizontal overflow |

After cancelling an exam before it opens (ASSESS-TEACHER-003, Owner decision 2026-09-30, this branch):

| Check | Result |
|---|---|
| secure-assessment unit | 911/911 PASS (route parity calls the new client function; the metrics map covers the route) |
| secure-assessment integration (real PostgreSQL) | 156/156 PASS; `teacher-exam-cancel.test.ts` (9): a SCHEDULED exam cancelled with the reason tidied, the actor, the key and the time, archived and never deleted, one lifecycle event naming the cancellation, participants, questions and proctors kept; the cancellation record append-only, the exam not deletable, a cancelled exam unable to leave ARCHIVED, a pre-open exam unable to reach ARCHIVED or a lifecycle event to ARCHIVED without its cancellation, an archive after completion unable to carry one; a READY exam cancelled; ACTIVE, PAUSED, ENDED and FINALIZED refused with nothing written; an empty, blank, too long, missing or non-text reason and malformed ids refused; another teacher, a student, an assigned proctor, an unknown exam, a person of another school and a revoked assignment refused; a retry replayed, a second request answered with the first cancellation, a key refused for another exam, requests racing under a transition in flight making exactly one cancellation; the student's list without the exam, a start refused with `exam_cancelled` and no attempt, the same student's other exam blocked by the conflict before and made ready after; the teacher's history with who, when and why, the proctor's list marking it cancelled |
| mutation checks (each against a verified passing baseline) | server: authority limited to the managing teacher, opened exams refused, the exam archived, a second request answered with the first cancellation, a key refused for another exam, the reason required, the student list leaving it out, the start refused with its reason, the teacher's history, the proctor's cancelled mark; migration: the state guard trigger, the lifecycle check naming the cancellation, the append-only record, one cancellation per exam (a direct check, since the exam row lock orders same-exam requests before the constraint could decide): 14 of 14 caught; web: key kept on retry, the reason required, a final refusal closing the dialog, cancelled exams kept apart, the button offered, who and why shown, no implementation word, the history when every exam was cancelled, nothing for a proctor to open, the student told it was cancelled: each caught |
| web client | 276/276 PASS (7 new: the reason and what cancelling means, one key across a lost connection and a refusal after the exam opened, no button once open, the "Ujian Dibatalkan" history with who, when and why and no actions, the history when every exam was cancelled, the student's refusal message, the proctor's cancelled exam without "Lihat Peserta") |
| browser E2E, Chromium, locally | 19/19 at 360, 768 and 1280 px (new `7-teacher-cancel.spec.ts`): the teacher schedules tomorrow's exam from a file, a student finds it, the teacher cancels it with a reason, the history shows it with the reason and no actions, the student no longer finds it, the same class is scheduled again at the same time without a conflict; the database keeps the exam as ARCHIVED with its 6 participants and 2 questions, the reason and the teacher, and the lifecycle event SCHEDULED to ARCHIVED naming the cancellation |
| rendered check (Chromium, 360 and 1280 px) | the cancellation dialog and the "Ujian Dibatalkan" history: no horizontal overflow; the same card, badge, button and dialog components as the rest of the teacher screen |
| UI consistency (§10.1) | the new dialog and history use the shared Dialog, Button (destructive as "Akhiri Ujian"), Textarea, Alert and card patterns; the two schedule-change notes added in the rescheduling change moved from page-local CSS to the shared Alert (info), and the proctor's cancelled note uses the shared Alert; the stored state name never reaches a screen (a safety label covers any other archived exam) |
| DesainPakeAI checkpoint | authenticated; project `b5a22aa4-...`; context revision `sha256-5d0d7779...` inspected (Provenance Thread alpha.1 tokens, §10) and unchanged; token convergence belongs to UI-SYSTEM-001 |
| CI | run 36 (`dc95783`) stopped at the identity-access unit tests: `crypto.test.ts` "tampered" the salt and the derived key by overwriting their last byte with a fixed value, which changes nothing when the byte already has that value (1 in 256 each, so the test failed about once in 128 runs, whatever the change). Reproduced locally (the 291st hash's key ended in `00`: the "tampered" verifier was identical and verified); the test now always changes the last digit and asserts that it changed (the 601st hash's key ended in `00`: rejected); identity-access 24/24 |

After adding participants after scheduling (ASSESS-TEACHER-004, D04.2-64, this branch):

| Check | Result |
|---|---|
| runtime unit | secure-assessment 911/911, identity-access 24/24, tenant-access 12/12, academic-core 3/3 PASS (route parity calls both new client functions; the metrics map covers both routes; the historical teacher projection test keeps refusing the preflights' internal `participantCount`, so the card's count is named `participants`, as progress names it) |
| secure-assessment integration (real PostgreSQL) | 168/168 PASS; `teacher-exam-participants.test.ts` (12): the class on the exam day offered without participants, leavers, later joiners or other classes, a student enrolled twice offered once, a conflict marked; an addition kept with who, when, the enrollment and the key, the student finding the exam, the card's count and time; both records append-only, a participant added once, pre-open states only, one key per school; the exam day taken in school time (an exam at 01.00 WIB takes the class of that day); a ready exam scheduled again with its lifecycle event and marked ready anew; a retry replayed, a key refused for another request or exam, a second request refused as already a participant, racing requests under a transition in flight adding once in any order; students of another class or school, leavers, later joiners, unknown enrollments, participants and conflicts refused with every reason and no one added; malformed requests; exams run with rooms and a school without its time zone; DRAFT, ACTIVE, PAUSED, ENDED, FINALIZED and cancelled exams refused; another teacher, a student, an assigned proctor, an unknown exam, another school and a revoked assignment refused; the added student starting the exam once it opens |
| mutation checks (each against a verified passing baseline) | server: the exam row lock, authority limited to the managing teacher, opened exams refused, READY falling back and its lifecycle event, a key serving one request, the replay, students outside the class, already a participant, schedule conflicts, a ready exam holding its time, exams run with rooms, the school time zone, the exam day in school time, the participant's enrollment, the entries, once per person, participants not offered, candidates of an opened exam, the card's count and note; migration: both append-only triggers, a participant added once, pre-open states only, one key per school: 26 of 26 caught; web: key kept on retry, conflicts not choosable, a disabled row never chosen, the ready warning before and after, the list read again after a refusal, only addable students staying chosen, a refusal after opening closing the dialog, nobody left to add, loading tried again, no removal said, the card's count and note, the button, the import list's exclusions through the shared list: 15 of 15 caught |
| web client | 283/283 PASS (7 new: choosing among the class with a conflict not choosable and one key, the ready exam's warning and notice, a lost connection and a refusal keeping the dialog, the key and a re-read list, a refusal after opening, nobody left to add and an exam run with rooms, loading tried again, no button once open and the card's count and note) |
| browser E2E, Chromium, locally | 20/20 at 360, 768 and 1280 px (new `8-teacher-add-participants.spec.ts`): the teacher schedules an exam for the day after tomorrow leaving one student out and marks it ready; the student does not find it; "Tambah Peserta" warns that the exam must be marked ready again, offers only that student and says participants cannot be removed; after adding, the card is "Terjadwal" with "6 peserta" and the time of the addition, nobody is left to add, the teacher marks it ready, and the student finds it; the database keeps one addition by the teacher from READY with the student's enrollment and the transitions DRAFT, SCHEDULED, READY, SCHEDULED, READY |
| rendered check (Chromium, 360, 768 and 1280 px) | the dialog and the card after adding: no horizontal overflow; the dialog uses the shared Dialog, Alert (warning for a ready exam), Button and the shared student list of "Buat Ujian" |
| UI consistency (§10.1) | the student list of "Buat Ujian" became the shared `ParticipantChoiceList` used by both screens (a pattern repeated twice becomes a shared primitive); the dismiss button reads "Batal" as in the other dialogs; the five stacked actions of a scheduled exam card at 360 px are recorded as an input for UI-SYSTEM-001 |
| DesainPakeAI checkpoint | authenticated; project `b5a22aa4-...`; context revision `sha256-5d0d7779...` inspected and unchanged |

After holding refused choices (ASSESS-SYNC-002, this branch):

| Check | Result |
|---|---|
| reproduction before the fix | a scratch copy of the lock test with the page clock two minutes behind, as an earlier test left it: with the previous engine the choice was sent 201 times in about 0.3 s (the fake server capped it) and the test's assertion failed; with the fixed engine one request, while the test's own assertion still failed (its premise, a choice made after the lock, is false on that clock); with the clock pinned to the device time the assertion holds on both engines (3 of 3 runs each). One seed of the shuffled pause file hung the previous engine |
| web typecheck / vitest | PASS / 291/291 PASS (8 new: 6 engine tests, pause and lock alike, and 2 screen tests) |
| mutation checks (each against a verified passing baseline) | engine: a request to send now cancelling the backoff while a choice is held, held choices sent, the timer keeping them held, no shorter retry after the span, a hold without a retry, a refusal stopping the queue, a refusal without a boundary not held, the final flush keeping them held; screen: the plain flush at time expiry: 9 of 9 caught (the new tests fail with 21 or 50 requests instead of 1 against the previous engine) |
| shuffled runs under CPU load (3 of 4 cores busy) | pause file 30 of 30 runs (before the fix 1 of 12 ended with the test worker out of memory); the whole web suite runs with UI-SYSTEM-001 (next change) |
| browser E2E | run on the branch with UI-SYSTEM-001, which carries the same engine (§11 of the following change) |

## 12. Friction reducers (automation)

Done: full unit test gate; reusable disposable PostgreSQL harness (`test/support/pg-harness.ts`, migrated or empty) and fixtures; migration runner/verifier; demo seed for local work (`test/support/seed-demo.ts`); environment validation and startup preflight; CI workflow with image smoke test (green on GitHub Actions); route parity check (`test/route-parity.test.ts`: every web client API function is called against the production-wired server and must reach an existing route with an allowed method, every server route must have a client caller or be listed as server-only; mutation-checked with a misspelled path and a wrong method). Browser E2E runner (`e2e/`, `npx playwright test`, runbook §8): starts the production process on a fresh database, provisions it only through the operator CLI, cleans up the database and process even when the setup fails, and runs in CI with the report and server log kept on failure; `e2e/ci-failure-details.sh` also prints the page at the failure, the step timeline, the requests and the end of the server log into the job log, for readers who cannot fetch the uploaded report. The workflow is checked with actionlint before pushing (a job-level `runner` context once made GitHub reject the whole workflow). The manifest SHA256 synchronization chore is retired (DEC-042).

## 13. Next engineering work

The production task graph (§6) is the work queue: the critical path and READY queue in §6.1 decide what comes next, at most three tasks in progress at once. Current order: ASSESS-SYNC-002 until CI confirms it, then UI-SYSTEM-001 (the consistency audit of §10.1, whose verification found it); every UI change answers the §10.1 question; the pull request [yusufarst/elligble#1](https://github.com/yusufarst/elligble/pull/1) waits for the Owner's review and squash-merge, and later commits on the branch join it. Blocked items wait on the Owner or on external infrastructure and are listed with their reason.

Local development and operations: `docs/production/OPERATIONS_RUNBOOK.md`.
