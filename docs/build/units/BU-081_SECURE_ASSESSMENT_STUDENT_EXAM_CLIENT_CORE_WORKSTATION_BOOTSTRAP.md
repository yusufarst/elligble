# BU-081: Secure Assessment Student Exam Client Core Workstation Bootstrap

Version: 1.0.0

## PURPOSE
BU-081 creates the first production ELLIGBLE web frontend foundation in `frontend/web/` (`@elligble/web`) and implements the Secure Assessment Student Exam Client Core Workstation for an already-authorized, already-active Exam Attempt (`?attemptId=<uuid>`).

The Student is able to:
- Validate attemptId locator client-side (no network calls on invalid locator).
- Load authoritative resume state (`/api/v1/assessment/resume?attemptId=<uuid>`).
- Load student-safe questions (`/api/v1/assessment/questions?attemptId=<uuid>`).
- View server-authoritative countdown timer (`/api/v1/assessment/timer?attemptId=<uuid>`).
- Navigate questions (previous, next, question number grid).
- Select single-choice multiple-choice options (baseline single-choice answers).
- Save answers (`/api/v1/assessment/answer/save`) with unique `clientWriteIdentity` and `expectedWriteVersion`.
- Clearly distinguish local selection vs. server-acknowledged save state.
- Handle stale write versions with bounded single-reconciliation retry.
- Block submission during unresolved/saving states.
- Open accessible confirmation dialog displaying answered/unanswered summary.
- Perform idempotent final submission (`/api/v1/assessment/submit`).
- Handle timer expiration and trigger one-time finalization (`/api/v1/assessment/expiry-finalize`).
- Display calm Bahasa Indonesia states without em dashes or raw internal database details.

## CANONICAL BASIS
- `docs/00-governance/00.08_BUILD_UNIT_FAST_TRACK_CONTROL.md`
- `docs/00-governance/00.09_PRODUCT_MILESTONE_DRIVEN_BUILD_CONTROL.md`
- `docs/design/FRONTEND_DESIGN_SYSTEM.md` (v1.0.0, LOCKED)
- `docs/design/UI_CONTENT_AND_COPY_STYLE.md` (v1.0.0, LOCKED)
- `~/.gemini/config/skills/react-typescript-vite/SKILL.md` (v1.0.0, VERIFIED)
- `docs/01-discovery/04.01_SECURE_ASSESSMENT.md`
- `docs/architecture/IDENTITY_ACCESS_AND_SECURITY_ARCHITECTURE.md`
- `docs/architecture/SECURE_ASSESSMENT_CRITICAL_ARCHITECTURE.md`
- `docs/architecture/RUNTIME_RELIABILITY_AND_OPERATIONS_ARCHITECTURE.md`
- `runtime/secure-assessment/src/server.ts`
- `runtime/secure-assessment/src/resume.ts`
- `runtime/secure-assessment/src/question-delivery.ts`
- `runtime/secure-assessment/src/timer.ts`
- `runtime/secure-assessment/src/answer.ts`
- `runtime/secure-assessment/src/submission.ts`
- PB04: Real Browser E2E (OPEN)
- PB05: Permission Matrix (OPEN / CARRIED FORWARD)
- PB06: Production Blocker 06 (OPEN / NOT CLOSED)
- PB07: Durable Offline Recovery (OPEN / NOT CLOSED)

## DIRECT PREDECESSORS
- BU-008 — Secure Assessment Server-Authoritative Timer Start Remaining Time Runtime Bootstrap
- BU-010 — Secure Assessment Idempotent Submission Runtime Bootstrap
- BU-018 — Secure Assessment Governed Session Activation Supersession Runtime Bootstrap
- BU-020 — Secure Assessment Resume Authoritative Active Session Readback Runtime Bootstrap
- BU-066 — Secure Assessment Baseline Question Snapshot Frozen Content Contract Runtime Bootstrap
- BU-080 — Secure Assessment Student Attempt Question Delivery Read API Integration Bootstrap

## SEQUENCE GATE
- BU-080: terminal / DONE YES / full repository finalized YES / Stage-5 final physical verification PASS / final physical verification PASS / DO NOT REOPEN.
- BU-081 Fast-Track Stage-1: PASS / FROZEN by MAIN PROJECT CONTROL 010.
- BU-082: NOT SELECTED / NOT REGISTERED.
- FRONTEND ENTRY GATE: PASS.

## FROZEN SCOPE & INVARIANTS
1. **Frontend Foundation:** Single common web package `@elligble/web` created in `frontend/web/`. Stack: React + TypeScript + Vite. Node 24.12+ compatible.
2. **Authorized Dependencies:** Production dependencies restricted to `react` and `react-dom`. Dev dependencies restricted to `typescript`, `vite`, `@vitejs/plugin-react`, `@types/react`, `@types/react-dom`, `vitest`, `jsdom`, `@testing-library/react`, `@testing-library/user-event`.
3. **Trust & Authorization Boundary:** The browser does NOT implement authentication. `attemptId` is a resource locator only. Relative URLs with same-origin requests used. No custom auth or tenant headers sent (`X-Tenant-ID`, `X-Person-ID`, `X-Participant-ID`, `Bearer`, custom tokens). If unauthorized, 403 access-denied state rendered safely.
4. **Attempt Locator Validation:** Validates `?attemptId=<uuid>` on client side. Invalid or missing attemptId renders safe Indonesian invalid-link notice and makes zero network requests.
5. **Initial Load Sequence:**
   - Calls `GET /api/v1/assessment/resume?attemptId=<uuid>`.
   - If submission exists: renders terminal submitted state.
   - If session is not active: renders safe non-editable state.
   - If timer not started or absent: renders safe non-editable state.
   - For active, non-submitted attempt: calls `GET /api/v1/assessment/questions?attemptId=<uuid>` and renders workstation.
6. **Question Contract & Projection:** Consumes BU-080 student-safe question shape (`snapshotId`, `schemaVersion`, `questionType`, `prompt`, `options`). Deterministic order preserved. Never displays or logs answer keys, scores, or internal IDs.
7. **Answer Save Contract:** Single-choice payload `{ selectedOptionId: string }`. Generates browser `crypto.randomUUID()` `clientWriteIdentity`. Maintains server acknowledged `expectedWriteVersion`. Local selection is never treated as server acknowledgement.
8. **Bounded Stale Write Reconciliation:** If server returns 409 `stale_write_version`, re-fetches resume. If authoritative selection equals desired option, marks saved. Otherwise retries once with latest writeVersion and new clientWriteIdentity. If still failing, marks failed. No infinite loops.
9. **Authoritative Timer Countdown:** Server duration authoritative. Local 1-second monotonic countdown. Resynchronizes on window focus and visibility change. Zero wall-clock cheating.
10. **Expiry Finalization:** When countdown reaches 0, editing is disabled, expired state is shown, and `POST /api/v1/assessment/expiry-finalize` is invoked exactly once.
11. **Submission Flow:** Two-step flow via accessible confirmation modal displaying total, answered, and unanswered counts, plus confirmation declaration checkbox. Final submission calls `POST /api/v1/assessment/submit`. Submission button is disabled if any saves are unresolved/saving.
12. **Zero Em Dash in UI Copy:** Complies strictly with `UI_CONTENT_AND_COPY_STYLE.md`. Bahasa Indonesia language only. Em dash prohibited in UI copy.
13. **Anti-AI-Slop Styling:** Built with canonical CSS custom properties from `FRONTEND_DESIGN_SYSTEM.md`. Zero CSS frameworks, zero arbitrary pill badges, zero decorative gradients.
14. **Offline / Durable Recovery Boundary:** Durable IndexedDB recovery and zero-lost-answer browser integration remain OUT OF SCOPE (PB07 remains OPEN). Full browser E2E is NOT claimed (PB04 remains OPEN).

## CONTROL STATUS
- BUILD UNIT: BU-081
- TITLE: Secure Assessment Student Exam Client Core Workstation Bootstrap
- VERSION: 1.0.0
- STAGE-1: PASS / FROZEN BY MAIN PROJECT CONTROL 010
- STAGE-2: COMPLETE / REPOSITORY FINALIZED
- STAGE-2 IMPLEMENTATION: COMPLETE
- STAGE-2 ENGINEERING VERIFICATION: PASS
- STAGE-2 REPOSITORY FINALIZED: YES
- STAGE-3: PASS
- STAGE-3 CONTROLLER PHYSICAL AUDIT: PASS
- STAGE-3 FINDING: NO MATERIAL ENGINEERING DEFECT REMAINS
- CONTROLLER AUDIT-HARNESS DEFECTS: THREE CLOSED / NON-MATERIAL TO BU-081 ENGINEERING
- STAGE-2 TASKIFICATION DEVIATION: NON-MATERIAL EXECUTION-CONTROL DEFECT
- STAGE-4 FAST-TRACK LIFECYCLE CLOSE: COMPLETE
- STAGE-4 REPOSITORY FINALIZED: YES
- DONE: YES
- FULL BU-081 REPOSITORY FINALIZED: YES
- STAGE-5 FINAL PHYSICAL VERIFICATION: PENDING
- LAST COMPLETED EXECUTABLE BUILD UNIT: BU-081
- ACTIVE BUILD UNIT: NONE
- NEXT BUILD UNIT: NOT YET REGISTERED
- FRONTEND ENTRY GATE: PASS
- PB04: OPEN
- PB05: OPEN / CARRIED FORWARD
- PB06: OPEN / NOT CLOSED
- PB07: OPEN / NOT CLOSED

## STAGE-2 VERIFICATION EVIDENCE
- FRONTEND TYPECHECK: PASS (`tsc --noEmit` exits with code 0)
- FRONTEND UNIT TESTS: PASS (28 / 28 tests pass)
- FRONTEND BUILD: PASS (Vite production bundle built cleanly in 1.33s)
- BACKEND TYPECHECK: PASS (`runtime/secure-assessment/package.json` typecheck passes)
- BACKEND REGRESSION: PASS (147 / 147 canonical tests pass)
- REAL POSTGRESQL PREDECESSOR VERIFIER: PASS (`verify_bu080_student_attempt_question_delivery.ts` passes with zero leaks and disposable DB cleanup)

## CONTROLLER STAGE-3 PHYSICAL AUDIT
- **BU-081 STAGE-3 CONTROLLER PHYSICAL AUDIT:** PASS
- **STAGE-2 COMMIT:** b62da7892cbffc4fd29c11cc985cc69877b40a2a
- **EXACT 22-PATH STAGE-2 SCOPE:** PASS
- **FRONTEND PACKAGE CONTRACT:** PASS
- **PRODUCTION TRUST BOUNDARY:** PASS
- **STUDENT-SAFE NON-DISCLOSURE:** PASS
- **ANSWER / TIMER CONTRACT:** PASS
- **COPY / ACCESSIBILITY:** PASS
- **FRONTEND TYPECHECK:** PASS
- **FRONTEND TEST:** 28 / 28 PASS
- **FRONTEND BUILD:** PASS
- **BACKEND TYPECHECK:** PASS
- **BACKEND REGRESSION:** 147 / 147 PASS
- **BACKEND FAIL:** 0
- **BU-080 REAL POSTGRESQL PREDECESSOR:** PASS
- **MATERIAL ENGINEERING DEFECT:** NONE

## AUDIT-HARNESS FINDINGS
- **FINDING 1:** STATIC AUTH SCANNER INCLUDED NEGATIVE-SECURITY TEST SOURCE
- **STATUS:** CLOSED / NON-MATERIAL TO BU-081 ENGINEERING
- **FINDING 2:** NON-DISCLOSURE SCANNER INCLUDED NEGATIVE-SECURITY TEST SOURCE
- **STATUS:** CLOSED / NON-MATERIAL TO BU-081 ENGINEERING
- **FINDING 3:** BACKEND TEST SUMMARY PARSER WAS REPORTER-PREFIX SENSITIVE
- **STATUS:** CLOSED / NON-MATERIAL TO BU-081 ENGINEERING
- **CLASSIFICATION:** CONTROLLER AUDIT-HARNESS FINDINGS ONLY / NONE ARE FRONTEND OR BU-081 ENGINEERING DEFECTS

## STAGE-2 EXECUTION DEVIATION
- **STAGE-2 TASK-STYLE / BACKGROUND TRACE:** OCCURRED
- **CLASSIFICATION:** NON-MATERIAL EXECUTION-CONTROL DEFECT
- **MATERIAL ENGINEERING IMPACT:** NONE

## FAST-TRACK STAGE-4 LIFECYCLE CLOSE
- **STAGE-4 FAST-TRACK LIFECYCLE CLOSE:** COMPLETE
- **STAGE-4 REPOSITORY FINALIZED:** YES
- **DONE:** YES
- **FULL BU-081 REPOSITORY FINALIZED:** YES
- **STAGE-5 FINAL PHYSICAL VERIFICATION:** PENDING
- **LAST COMPLETED EXECUTABLE BUILD UNIT:** BU-081
- **ACTIVE BUILD UNIT:** NONE
- **NEXT BUILD UNIT:** NOT YET REGISTERED
- **FRONTEND ENTRY GATE:** PASS
- **PB04:** OPEN
- **PB05:** OPEN / CARRIED FORWARD
- **PB06:** OPEN / NOT CLOSED
- **PB07:** OPEN / NOT CLOSED
