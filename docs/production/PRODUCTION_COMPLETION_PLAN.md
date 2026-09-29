**Status:** LIVING PLAN (DEC-042) — the only live execution tracker
**Canonical:** YES for current production state, gaps, critical path and next work. Does not override LOCKED decisions.
**Last Updated:** 2026-09-29
**Audit Baseline:** `3a69883544ac3750b17fe5e4bdbd0f41b3608b07` (BU-090 terminal)

# ELLIGBLE Production Completion Plan

## 1. Current production state

**Verdict: NOT production-ready. The flagship Student exam journey does not work end to end in a production deployment.**

The repository holds strong, well-tested Secure Assessment building blocks (answer persistence, server-authoritative timer, idempotent submission, one-active-session, readiness preflights, rooms/proctors, identity sessions, tenant membership resolution) and browser screens for student, proctor and teacher views. They are not wired into a usable product:

- There is no login endpoint, no logout, no browser session transport and no login screen. The web client sends no credentials.
- The production server (`runtime/secure-assessment/src/main.ts`) wires `getAuthorizedContext` to `null`, so every attempt route (resume, questions, timer, answer save, submit, expiry finalize, session activate) returns 403 in production. Proctor monitoring and teacher readiness have no production context and also return 403. Only `GET /assigned-exams` resolves a real session (BU-090), but no client can send one.
- Nothing creates Exam Attempts or timer state, and nothing moves an exam beyond `SCHEDULED` (no READY / ACTIVE transition). Questions require `ACTIVE`, so a student can never reach a question.
- The browser answer path keeps answers only in memory. The local-first IndexedDB recovery store, queue and retry controller exist as tested modules but are not used by the web client (LOCKED D04.3-83A/B, D04.5-05/06/15/16).
- There is no migration runner, no provisioning path for tenants/accounts/memberships, no production static hosting of the web client, no deployment configuration and no CI.

## 2. Integrated dependency map (as found)

| Journey step | UI | API client | HTTP route | AuthN | AuthZ | Runtime / DB | Status |
|---|---|---|---|---|---|---|---|
| Login | missing | missing | missing | `IdentityRuntime.authenticate` (no HTTP) | n/a | `identity_*` tables | **BROKEN (P0-1)** |
| Session in browser | missing | no credentials sent | header `Authorization: ELLIGBLE-Session` only | BU-088/089/090 | membership | `identity_sessions` | **BROKEN (P0-2)** |
| Tenant selection | missing | no `X-Tenant-ID` | header required | — | membership | `tenant_memberships` (no display name) | **BROKEN (P0-2)** |
| Assigned exams | `AssignedExamDiscovery` | `getAssignedExams` | `GET /api/v1/assessment/assigned-exams` | real | participant.person_id | yes | works only with a manual header |
| Start attempt | "no session available" text | missing | missing | — | — | no attempt/timer creation code | **BROKEN (P0-5)** |
| Exam activation (teacher) | read-only readiness view | `getTeacherReadiness` | readiness GET only; no transition route | none in prod | teaching assignment | DRAFT→SCHEDULED function only | **BROKEN (P0-4, P0-6)** |
| Launch / session activate | `AttemptLaunch` | yes | `POST /session/activate` | none | `null` in prod | yes | **BROKEN (P0-3)** |
| Timer start / read | yes | yes | `POST /timer/start`, `GET /timer` | none | `null` in prod | yes; no eligibility/window/latest-start check at start | **BROKEN (P0-3, P0-5)** |
| Questions | yes | yes | `GET /questions` | none | `null` in prod | requires ACTIVE | **BROKEN (P0-3, P0-6)** |
| Answer save | in-memory only | yes | `POST /answer/save` | none | `null` in prod | idempotent, versioned | **BROKEN (P0-3, P0-8)** |
| Refresh / resume | yes | yes | `GET /resume` | none | `null` in prod | yes | **BROKEN (P0-3)** |
| Submit / expiry | yes | yes | `POST /submit`, `POST /expiry-finalize` | none | `null` in prod | idempotent | **BROKEN (P0-3)** |
| Proctor monitoring | `ProctorMonitoringView` | yes | `GET /proctor-monitoring` | none | not wired | yes | **BROKEN (P0-4)** |
| Deep links / refresh | query-string routing only; no SPA hosting | — | — | — | — | — | **BROKEN (P0-9)** |

## 3. Role journeys (canonical actors, MB-03)

| Role | Works today | Incomplete | Blocks production |
|---|---|---|---|
| Student | screens for discovery, launch, workstation (tested in isolation) | login, session, start attempt, local-first answers, all attempt routes in prod | P0-1..P0-9 |
| Teacher (teacher-managed mode, D04.4-26A) | readiness read model and screen | no production context, no READY/ACTIVE transition, no exam/question authoring | P0-4, P0-6, P0-7 |
| Proctor | monitoring read model and screen | no production context; no Proctor Feed events | P0-4; Feed is P1 |
| School / tenant administration | Academic Core schema + creation functions (no HTTP/UI) | account provisioning, import, academic management UI | P0-11 (minimum: operator CLI) |
| Parent / Guardian | nothing | whole domain (schema, runtime, UI) | Milestone 7 |
| Partner | nothing | whole domain; PB09 policy | Milestone 6-7 |
| Platform operations | nothing | provisioning, migrations, deploy, monitoring, backup | P0-10, P0-11, PB11, PB12 |

Track, Care, Passport, Path, Opportunity, Application, Verified Connection, Outcome and Alumni are not started (Milestones 4-6). They are baseline scope but come after Secure Assessment on the critical path.

## 4. P0 gaps (production blockers in the product itself)

| ID | Gap | Evidence |
|---|---|---|
| P0-1 | No login/logout/session HTTP endpoints; no login UI | no `/auth` route in `server.ts`; `frontend/web/src/App.tsx` has no login |
| P0-2 | Browser credential transport and tenant selection absent; client sends no credentials | `frontend/web/src/api/assessment-client.ts` (`fetch` without auth); `http/authenticated-context.ts` accepts header only |
| P0-3 | Attempt routes have no production authorization (always 403) | `runtime/secure-assessment/src/main.ts:37-41` |
| P0-4 | Proctor monitoring and teacher readiness have no production context (always 403) | `server.ts` passes `deps.getAssignedExamDiscoveryContext` / `getTeacherReadinessContext`, both undefined in `main.ts` |
| P0-5 | No attempt + timer creation; no start eligibility (exam state, window, latest-start policy) at start | no `INSERT INTO secure_assessment_exam_attempts` / `timer_state` in runtime; `timer.ts` start has no eligibility checks (D04.2-72, D04.4-17) |
| P0-6 | No SCHEDULED→READY→ACTIVE transition | only `exam-instance-draft-to-scheduled-transition.ts`; `question-delivery.ts` requires ACTIVE |
| P0-7 | No way to put questions into an exam except raw SQL | no snapshot creation code; baseline content contract exists (`question-snapshot-baseline-frozen-content-contract.ts`) |
| P0-8 | Answers are memory-only in the browser (data-loss path on refresh/offline) | `frontend/web/src/hooks/useAnswerManager.ts`; local-first modules unused |
| P0-9 | No production hosting of the web client, no deep-link fallback, no same-origin API topology | no static serving in `server.ts`; no Vite proxy |
| P0-10 | No migration runner / migration verification for real deployments | migrations applied only inside one-off verifiers |
| P0-11 | No provisioning of tenants, persons, accounts, credentials, memberships | no runtime or CLI path |

## 5. P1 gaps

| ID | Gap | Evidence |
|---|---|---|
| P1-1 | One-active-session bypass: `GET /resume` returns the active exam session id, so any tab/device with the attempt id can write as that session (D04.1-42, D04.4-32/35) | `resume.ts` session projection; `StudentExamWorkstation` uses it |
| P1-2 | Local-first queue replays stale `expectedWriteVersion` forever after two quick changes while offline (would never converge) | `client-answer-reconciliation-queue.ts` keeps failed records with fixed version |
| P1-3 | Username enumeration by timing (no password hash work for unknown usernames) | `identity-access/src/index.ts` `authenticate` |
| P1-4 | No request body size limit (memory DoS) on JSON routes | `answer.ts`, `session.ts`, `submission.ts`, `timer.ts` buffer unbounded bodies |
| P1-5 | No security headers (CSP, frame, referrer, nosniff), no Origin/CSRF check | `server.ts` |
| P1-6 | `transitionExamInstanceDraftToScheduled` defaults to `granted` when no capability evaluator is passed (fail-open default) | `exam-instance-draft-to-scheduled-transition.ts` `defaultCapabilityEvaluator` |
| P1-7 | Official `npm test` runs 6 of 46 secure-assessment test files; the full suite has 2 broken test files (3 failures) that never ran in the gate | `runtime/secure-assessment/package.json`; `test/client-answer-save-state.test.ts` (`.js` import), `test/active-session-resume.test.ts` #10 |
| P1-8 | No request/error logging, no metrics; startup logs only | `log.ts` |
| P1-9 | Design tokens in code drift from LOCKED design system v1.1.0 (navy focus ring, slate neutrals, radii 6/8/12 vs 8/12/16) | `frontend/web/src/styles/design-tokens.css` vs `FRONTEND_DESIGN_SYSTEM.md` §10-§14 |
| P1-10 | Assigned-exam projection has no lifecycle/window/duration, so the student cannot see when an exam opens | `assigned-exams.ts` |
| P1-11 | Proctor Feed (Kejadian/Pelanggaran) not implemented (D01, D04.1-54) | no feed tables/routes |
| P1-12 | Historical one-off verifiers are point-in-time: 14 of 44 fail on current schema by design (e.g. "migration 0035 must not exist"); there is no durable real-PostgreSQL regression suite | `database/verification/*`, `runtime/secure-assessment/verification/*` |

## 6. Critical path (ordered by dependency and value)

1. **Governance and plan** (DEC-042, DEC-043, this plan). DONE in this change.
2. **Durable test foundation**: full `npm test` gate, fix broken tests, reusable disposable PostgreSQL harness for integration tests (P1-7, P1-12).
3. **Authentication and browser session** (P0-1, P0-2, P1-3, P1-4, P1-5): login/logout/session endpoints, HttpOnly cookie transport (header kept for API clients), Origin check, body limits, security headers, tenant display name + membership list, capability discovery from explicit assignments (no invented Permission Matrix), login screen and session-aware shell on the shadcn/ui foundation.
4. **Student attempt authorization and start** (P0-3, P0-5, P1-10): attempt ownership check (session → membership → participant → attempt), idempotent start-attempt with eligibility, latest-start policy applied at timer start, assigned-exam projection with schedule state.
5. **Teacher exam operations** (P0-4, P0-6): production contexts for teacher/proctor views; SCHEDULED→READY (readiness composition) and READY→ACTIVE (final re-check, window) for teacher-managed exams.
6. **Local-first answers** (P0-8, P1-2, P1-1): IndexedDB-backed coalescing queue with retry/backoff, honest save state, offline banner, session binding.
7. **Production operations** (P0-9, P0-10, P1-8): migration runner with lock and history checks, single-process production server serving the built SPA with deep-link fallback, environment validation, preflight, structured request logging, container build, CI.
8. **Provisioning and content** (P0-11, P0-7): operator CLI for tenant/person/account/membership/academic setup and exam content import (baseline MCQ contract).
9. **Browser E2E**: real browser → server → PostgreSQL for student, teacher and proctor journeys, including refresh, offline, duplicate submit and wrong-tenant cases.
10. Then Milestone 2 hardening (Proctor Feed, pause/lock, time adjustments, scoring/results), followed by Academic Core administration UI and the remaining baseline domains.

## 7. Owner decisions

| Item | Needed for | Recommended default | Status |
|---|---|---|---|
| DesainPakeAI credentials (`DPAI_API_KEY` / `DPAI_API_URL` in the environment) | Verifying UI against project `b5a22aa4-...` | Provide a key via environment secret | **BLOCKED: credential missing** |
| PB05 Permission Matrix | Production launch; roles beyond explicit assignments | Keep assignment-scoped least privilege until the matrix is approved | OPEN |
| PB01, PB02, PB03, PB10 (legal allocation, retention, DPIA, classification/consent) | Production launch with real student data | Owner/legal artifacts | OPEN |
| Centralized (institution-managed) exam governance roles (D04.4-26D/E) | Activation of non-teacher-managed exams | Teacher-managed mode first | OPEN (not blocking critical path) |

## 8. Production Blockers (PB01-PB12)

| PB | Status | Engineering contribution on the critical path |
|---|---|---|
| PB01 Controller/Processor allocation | OPEN (Owner/legal) | none |
| PB02 Retention matrix | OPEN (Owner/legal) | none |
| PB03 DPIA | OPEN (Owner/legal) | none |
| PB04 Authentication policy | CLOSED (DEC-041) | implement the policy in HTTP/session transport (step 3) |
| PB05 Permission Matrix | OPEN | assignment-scoped authorization only; no invented policy |
| PB06 Assessment Capability Testing | OPEN | browser E2E + capability evidence (step 9) |
| PB07 Zero-Lost-Answer Verification | OPEN | local-first answers + fault-injection E2E (steps 6, 9) |
| PB08 Care safeguarding | OPEN (conditional) | none until Care |
| PB09 Partner moderation | OPEN (conditional) | none until Partner |
| PB10 Data classification + consent | OPEN (Owner) | none |
| PB11 Backup + restore verification | OPEN | backup/restore runbook + verified restore drill (after step 7) |
| PB12 Security / incident response | OPEN | logging, headers, runbook (step 7) |

## 9. Production operations readiness

| Area | State |
|---|---|
| Environment config / validation | runtime validates `DATABASE_URL`, host, port, pool, timeout only |
| Secrets | none committed; `.env*` git-ignored |
| Migrations | 35 idempotent SQL files; no runner, no lock, no drift check |
| Build | frontend `vite build` PASS; runtime runs TypeScript directly on Node 24 (type stripping) |
| Startup / health | `/healthz`, `/readyz` (DB `SELECT 1`), graceful SIGTERM |
| Hosting / TLS / cookies | none |
| Logging / monitoring / error reporting | startup JSON logs only |
| Backup / restore / incident response / rollback | none |
| Rate limiting | per-account login policy in runtime (DEC-041); no infrastructure limits |
| CI | none |

## 10. Design and UI status

- DesainPakeAI CLI 0.2.2 is installed; `dpai auth status`: not authenticated (`DPAI_API_KEY` absent). Live alignment with project `b5a22aa4-7b38-49d2-9448-443eab6e8075` is **not verified**.
- shadcn/ui: not configured before this plan. Approved by DEC-043; to be set up once, themed with ELLIGBLE tokens.
- Existing screens use hand-written CSS with tokens that drift from the LOCKED design system (P1-9).

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

## 12. Friction reducers (automation)

Planned, in critical-path order: full test gate; reusable disposable PostgreSQL harness; migration runner/verifier; environment validator and production preflight; browser E2E runner; route parity check (client calls vs server routes); CI workflow. The manifest SHA256 synchronization chore is retired (DEC-042).

## 13. Next engineering work

Critical path steps 2 → 9 above, in order.
