**Status:** LIVING PLAN (DEC-042) — the only live execution tracker
**Canonical:** YES for current production state, gaps, critical path and next work. Does not override LOCKED decisions.
**Last Updated:** 2026-09-29
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
| Teacher operations | `TeacherReadinessView` ("Pelaksanaan Ujian") | `GET /assessment/teacher-readiness`, `POST /assessment/teacher-exams/transition` | session → teaching assignment of the exam | **WORKS**: readiness, "Tandai Siap", "Buka Ujian", aggregate progress (integration + browser; E2E) |
| Deep links / refresh | query-string routes under `/` | client served by the runtime with deep-link fallback | session re-checked on load | **WORKS** (production container, real browser) |

## 3. Role journeys (canonical actors, MB-03)

| Role | Works today | Incomplete | Blocks production |
|---|---|---|---|
| Student | activation, login, exam list with entry guidance, start, launch/takeover, workstation with local-first answers, timer with reminders, submit and automatic submission | "Ragu-ragu" flag (P1-24), results | none in the product (Owner/legal PBs, §8) |
| Teacher (teacher-managed mode, D04.4-26A) | activation, readiness, "Tandai Siap", "Buka Ujian", aggregate progress; exams arrive through the audited operator import (pilot bridge) | exam/question authoring or import in the UI, ENDED/PAUSED (P1-17) | none for the pilot; teacher authoring or import for scale |
| Proctor | monitoring read model and screen (session-derived context) | Proctor Feed events, interventions | Feed is P1-11 |
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
| P1-11 | Proctor Feed (Kejadian/Pelanggaran) not implemented (D01, D04.1-54) | no feed tables/routes | OPEN |
| P1-13 | Shared-device hygiene: remembered school choice leaked to the next account; re-authentication could accept another account while keeping the previous context | found in rendered checks — **RESOLVED** (logout clears the choice; re-login locked to the same ELLIGBLE ID) | RESOLVED |
| P1-14 | Infrastructure-level login rate limiting (whole schools share one NAT address, so per-IP limits must be generous) | per-account policy exists (DEC-041) | OPEN (configure at the edge) |
| P1-15 | Question order followed random snapshot UUIDs, not the authored order (D04.3-41, D04.2-57..59) | **RESOLVED**: migration `0038` adds a positive, per-exam unique `display_order` written when the snapshot is created (snapshots stay immutable); delivery orders by it, legacy rows follow by id; real-PostgreSQL test with identifier order opposite to the authored order | RESOLVED |
| P1-16 | Tenant/school time zone is not configured (D04.2-36); times display in the device zone | `lib/format.ts` | OPEN |
| P1-17 | No ENDED / PAUSED transitions: end-of-exam handling of active attempts (D04.2-81) and timer behaviour during pause (D04.2-77) are policy-open; timer expiry already auto-submits each attempt | lifecycle ops implement READY/ACTIVE only | OPEN: Owner decision (§7) |
| P1-18 | Readiness preflights accepted only SCHEDULED, so READY could not be re-evaluated (D04.2-25) or re-checked at activation (D04.2-68) | 10 preflight guards | **RESOLVED**: shared `readiness-states.ts` (SCHEDULED or READY) |
| P1-12 | Historical one-off verifiers are point-in-time: 14 of 44 fail on current schema by design | **RESOLVED** as a gate: durable suite `npm run test:integration` (disposable databases); historical verifiers are REFERENCE ONLY | RESOLVED |
| P1-26 | An invalid or expired session without a usable `X-Tenant-ID` was answered 403 instead of 401, so a client could treat an expired session as a permanent refusal (an answer save marked failed instead of prompting re-login) | found by the production-wiring probe in `test/integration/startup.test.ts`: **RESOLVED**, the credential is validated before the tenant locator; the probe asserts 401 on every protected route with and without a tenant locator | RESOLVED |
| P1-19 | Countdown drifted: an interval re-created every second, throttled in background tabs | **RESOLVED**: monotonic deadline from the server's remaining seconds, resync on focus, visibility and reconnect (D04.5-27/28) | RESOLVED |
| P1-20 | Automatic submission was tried once: a network failure left "Waktu Ujian Telah Habis" forever, and a device clock ahead of the server (`timer_not_expired`) got stuck | **RESOLVED**: pending answers are flushed first (D04.5-46), finalization retries with backoff (D04.5-45/49), the exam continues when the server still has time | RESOLVED |
| P1-21 | A failed submission used a blocking `alert()` | **RESOLVED**: inline message in the confirmation dialog, retry is safe (idempotent submit) | RESOLVED |
| P1-22 | Offline answers captured before expiry but delivered after it are rejected by the server | D04.5-48 treats them as an exception case with a deferred reconciliation policy. The student is told honestly how many choices the server did not receive; no silent loss claim. OPEN (policy deferred, not blocking) | OPEN |
| P1-23 | Save did not validate the answer payload against the frozen question (any JSON was stored; option ids unchecked) | **RESOLVED**: `isAnswerForQuestion` in `answer.ts` accepts exactly `{ selectedOptionId }` naming an option of the frozen MULTIPLE_CHOICE_SINGLE question (D04.3-21), otherwise 400 `invalid_answer_payload` and nothing is stored | RESOLVED |
| P1-24 | "Ragu-ragu / Tandai" flag for review (D04.5-34/35) not implemented | student navigation aid | OPEN |
| P1-27 | An attempt whose time ran out while the student's device was unreachable stayed open indefinitely: only the device triggered expiry finalization (D04.5-45/47/49) | found while designing results: **RESOLVED**, the runtime finalizes such attempts from the server-accepted answers every `SA_EXPIRY_SWEEP_SECONDS`, skipping attempts held by an in-flight save or submit; every finalization path converges on one submission, which records its source (`STUDENT_SUBMIT`, `EXPIRY_CLIENT`, `EXPIRY_SERVER`, migration `0041`) so the D04.5-48 exception case stays visible | RESOLVED |
| P1-25 | Time reminders at configured thresholds (D04.5-32) were missing; only warning styling below 5 and 1 minutes | `StudentExamWorkstation`: **RESOLVED** with the decision's default thresholds (30, 15, 5 minutes): a non-blocking status line with the actual remaining minutes, hidden after 10 seconds; school-defined thresholds await tenant settings | RESOLVED |

## 6. Critical path (ordered by dependency and value)

1. **Governance and plan** (DEC-042, DEC-043, this plan). DONE in this change.
2. **Durable test foundation**: full `npm test` gate, fix broken tests, reusable disposable PostgreSQL harness for integration tests (P1-7, P1-12). DONE.
3. **Authentication and browser session** (P0-1, P0-2, P0-3, P0-4 reads, P1-3, P1-4, P1-5, P1-9, P1-13): DONE. Migration `0036_tenant_display_label`; capability discovery uses explicit assignments only (PB05 untouched).
4. **Student attempt authorization and start** (P0-3, P0-5, P1-10): DONE. Ownership check, idempotent concurrency-safe start with eligibility (ACTIVE, window, latest-start policy) using database time, policy re-applied at timer start, schedule projection and entry guidance in the list.
5. **Teacher exam operations** (P0-4, P0-6): DONE for teacher-managed exams. SCHEDULED→READY / READY→ACTIVE with readiness re-checks, window guard, row lock (concurrent activation transitions once), attributed events; teacher UI with lifecycle badges, confirmation dialog and aggregate progress. ENDED/PAUSED await policy (§7).
6. **Local-first answers and exam-session binding** (P0-8, P1-1, P1-2, P1-19..P1-21): DONE. IndexedDB buffer and sync engine (coalescing, backoff with jitter, version rebase, reload and browser-restart recovery), honest save states and offline banner, per-tab exam session with fingerprint-confirmed takeover and duplicated-tab detection, monotonic countdown, retried automatic submission.
7. **Production operations** (P0-9, P0-10, P1-8): DONE. Migration runner; startup preflight (bounded wait for the database, schema `check` or `apply`, refuses a database ahead of the release); single process serving API and built client with deep-link fallback; environment validation; structured request logging; container image (non-root) with health check; CI (typecheck, unit, PostgreSQL integration, web build, image build and smoke test); operations runbook with a verified local restore drill.
8. **Provisioning and content** (P0-11, P0-7, P1-15, P1-23): DONE. Authored question order and answer payload validation; account activation; audited operator CLI for schools, people (activation cards), academic setup (new `runtime/academic-core` module), exams and activation reissue.
9. **Browser E2E** (PB06, PB07 contribution): DONE. Playwright suite `e2e/` against the real production process on a disposable database provisioned only through the operator CLI, run in CI: pilot journey (activation cards, teacher opens the exam, proctor view, student answers, reload, one submission with idempotent receipts), resilience (offline, reload while saves fail, second-tab takeover, duplicated tab) and security (other school, other student's attempt, session ending mid-exam).
10. Then Milestone 2 hardening (Proctor Feed, pause/lock, time adjustments, scoring/results), followed by Academic Core administration UI and the remaining baseline domains.

## 7. Owner decisions

| Item | Needed for | Recommended default | Status |
|---|---|---|---|
| DesainPakeAI credentials (`DPAI_API_KEY` / `DPAI_API_URL` in the environment) | Verifying UI against project `b5a22aa4-...` | Provide a key via environment secret | **BLOCKED: credential missing** |
| PB05 Permission Matrix | Production launch; roles beyond explicit assignments | Keep assignment-scoped least privilege until the matrix is approved | OPEN |
| PB01, PB02, PB03, PB10 (legal allocation, retention, DPIA, classification/consent) | Production launch with real student data | Owner/legal artifacts | OPEN |
| Centralized (institution-managed) exam governance roles (D04.4-26D/E) | Activation of non-teacher-managed exams | Teacher-managed mode first | OPEN (not blocking critical path) |
| End-of-exam handling (D04.2-81) and pause timer behaviour (D04.2-77) | ENDED / PAUSED operations | Each attempt keeps its own server timer and auto-submits at expiry; ENDED only blocks new starts; pause freezes remaining time | OPEN (policy says "exact policy later") |
| ELLIGBLE ID format and generation (D02.10-C) | Account provisioning at scale | Until decided, operators supply IDs in a conservative syntax (3 to 64 lower-case letters, digits, dot, dash, underscore; not e-mail based); the platform only checks uniqueness | OPEN (not blocking the pilot) |
| Activation code validity (D02.3-09 "short-lived") | Activation cards | 7 days by default, operator may choose 1 to 30 days per issue | IMPLEMENTED DEFAULT, adjustable |
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
| Migrations | 41 idempotent SQL files; runner with advisory lock and history/unknown checks (`npm run migrate`, `migrate:check`); startup preflight `check` (default) or `apply` |
| Build | `Dockerfile`: web client built with Vite, runtime on Node 24 (type stripping), production dependencies only, non-root user, `HEALTHCHECK` |
| Startup / health | preflight (database wait, schema check), `/healthz`, `/readyz`, graceful SIGTERM (verified with the real process) |
| Hosting / TLS / cookies | client and API from one origin; TLS at the reverse proxy (runbook §1); `__Host-` Secure cookie and HSTS in production |
| Logging / monitoring / error reporting | JSON-lines access and error log with request ids; no metrics or alerting yet |
| Backup / restore / incident response / rollback | runbook procedures; local restore drill verified; production drill pending (PB11) |
| Rate limiting | per-account login policy in runtime (DEC-041); infrastructure limits at the proxy (P1-14) |
| Provisioning | audited operator CLI (runbook §7) for schools, people with activation cards, academic setup, exams and activation reissue |
| CI | `.github/workflows/ci.yml`: runtime typecheck, unit and PostgreSQL 16 integration; web typecheck, tests and build; browser end-to-end suite against the production process; image build and smoke test |

## 10. Design and UI status

- DesainPakeAI CLI 0.2.2 is installed; `dpai auth status`: not authenticated (`DPAI_API_KEY` absent). Live alignment with project `b5a22aa4-7b38-49d2-9448-443eab6e8075` is **not verified**.
- shadcn/ui: configured once (`frontend/web/components.json`, Tailwind CSS v4 via `@tailwindcss/vite`, `src/components/ui/*`, `src/styles/globals.css`) and themed only with ELLIGBLE tokens (DEC-043). `ui.shadcn.com` is blocked by this environment's network policy, so components were written from the official new-york v4 sources instead of the CLI.
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

## 12. Friction reducers (automation)

Done: full unit test gate; reusable disposable PostgreSQL harness (`test/support/pg-harness.ts`, migrated or empty) and fixtures; migration runner/verifier; demo seed for local work (`test/support/seed-demo.ts`); environment validation and startup preflight; CI workflow with image smoke test (green on GitHub Actions); route parity check (`test/route-parity.test.ts`: every web client API function is called against the production-wired server and must reach an existing route with an allowed method, every server route must have a client caller or be listed as server-only; mutation-checked with a misspelled path and a wrong method). Browser E2E runner (`e2e/`, `npx playwright test`, runbook §8): starts the production process on a fresh database, provisions it only through the operator CLI, cleans up the database and process even when the setup fails, and runs in CI with the report and server log kept on failure. The workflow is checked with actionlint before pushing (a job-level `runner` context once made GitHub reject the whole workflow). The manifest SHA256 synchronization chore is retired (DEC-042).

## 13. Next engineering work

Critical path step 10, Milestone 2 hardening in dependency order: the Proctor Feed (P1-11, events and interventions the proctor needs during a live exam); ENDED and PAUSED operations once the Owner sets the policy (P1-17, §7); scoring and results for teachers and students. Alongside, small student and school items: the "Ragu-ragu" review flag (P1-24), the school time zone (P1-16), school-admin self-service import (D02.7) and teacher-facing exam import. Infrastructure: edge rate limits (P1-14), metrics and alerting, and the PB11 drill on the production infrastructure.

Local development and operations: `docs/production/OPERATIONS_RUNBOOK.md`.
