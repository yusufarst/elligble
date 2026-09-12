# BU-080: Secure Assessment Student Attempt Question Delivery Read API Integration Bootstrap

Version: 1.0.0

## PURPOSE
BU-080 implements the student-safe, read-only HTTP GET question delivery API route (`GET /api/v1/assessment/questions`) for exactly one authorized Attempt, integrating existing tenant-bound authorization (`AuthorizedAssessmentContext`), active exam lifecycle validation, active session presence, authoritative timer validation, submission guards, deterministic snapshot ordering, BU-066 frozen content validation, and student-safe response projection without disclosure of answer keys, scores, or internal identities.

## CANONICAL BASIS
- `docs/00-governance/00.08_BUILD_UNIT_FAST_TRACK_CONTROL.md`
- `docs/00-governance/00.07_DOMAIN_OWNERSHIP_AND_CONTRACTS.md`
- `docs/01-discovery/04.01_SECURE_ASSESSMENT.md`
- `docs/build/PRODUCT_COMPLETION_ROADMAP.md`
- `runtime/secure-assessment/src/server.ts`
- `runtime/secure-assessment/src/answer.ts`
- `runtime/secure-assessment/src/timer.ts`
- `runtime/secure-assessment/src/session.ts`
- `runtime/secure-assessment/src/submission.ts`
- `runtime/secure-assessment/src/question-snapshot-baseline-frozen-content-contract.ts`
- `database/migrations/0002_bu002_secure_assessment_core_state.sql`
- `database/migrations/0003_bu003_secure_assessment_question_core_state.sql`
- `database/migrations/0005_bu007_secure_assessment_timer_core_state.sql`
- `database/migrations/0007_bu017_secure_assessment_one_active_session_core_state.sql`
- `database/migrations/0025_bu053_secure_assessment_exam_instance_lifecycle_state.sql`
- PB05: Permission Matrix (OPEN / CARRIED FORWARD)
- PB06: Production Blocker 06 (OPEN / NOT CLOSED)

## DIRECT PREDECESSORS
- BU-002 — Secure Assessment Core State Persistence Bootstrap
- BU-003 — Secure Assessment Question Core State Persistence Bootstrap
- BU-007 — Secure Assessment Server-Authoritative Timer Core State Persistence Bootstrap
- BU-008 — Secure Assessment Server-Authoritative Timer Start Remaining Time Runtime Bootstrap
- BU-010 — Secure Assessment Idempotent Submission Runtime Bootstrap
- BU-017 — Secure Assessment One-Active-Session Core State Persistence Bootstrap
- BU-018 — Secure Assessment Governed Session Activation Supersession Runtime Bootstrap
- BU-020 — Secure Assessment Resume Authoritative Active Session Readback Runtime Bootstrap
- BU-066 — Secure Assessment Baseline Question Snapshot Frozen Content Contract Runtime Bootstrap
- BU-079 — Secure Assessment Exam Instance Participant and Proctor Schedule Conflict Readiness Preflight Integration Bootstrap

## SEQUENCE GATE
- BU-079: terminal / DONE YES / repository finalized YES / Stage-5 final physical verification PASS.
- BU-080 Fast-Track Stage-1: PASS / FROZEN by MAIN PROJECT CONTROL 010.
- BU-081: NOT SELECTED / NOT REGISTERED.
- Frontend Entry Gate: DEFERRED / NOT YET TRIGGERED.

## FROZEN SCOPE & INVARIANTS
1. **Existing Trusted Context Reused:** Reuses existing `AuthorizedAssessmentContext` (`tenantId`, `authorizedAttemptId`). No new auth format created.
2. **Input Parameter:** Query parameter `attemptId` (valid UUID required).
3. **Tenant-Scoped Resolution:** Resolves Attempt -> Participant -> Exam Instance strictly tenant-scoped (`a.tenant_id = context.tenantId`).
4. **Active Exam Gate:** Exam Instance must be in `lifecycle_state = 'ACTIVE'`. Otherwise 409 `exam_not_active`.
5. **Active Session Gate:** Active Exam Session required (`activated_at IS NOT NULL AND ended_at IS NULL`). Otherwise 409 `session_not_active`.
6. **Authoritative Submission Gate:** If submission exists, 409 `attempt_already_submitted`.
7. **Authoritative Timer Gate:**
   - Missing timer state -> 404 `assessment_context_not_found`.
   - Timer `started_at` is NULL -> 409 `timer_not_started`.
   - `effectiveRemainingSeconds <= 0` -> 409 `timer_expired`.
   - Authoritative persisted timer calculation used (never client time).
8. **Deterministic Question Ordering:** Snapshots read for tenant + resolved Exam Instance with deterministic `ORDER BY id ASC`.
9. **BU-066 Validation Reused:** Every snapshot validated with `validateBaselineQuestionSnapshotFrozenContent()`. Invalid persisted content returns 500 `internal_error` without leaking blocker details.
10. **Student-Safe Response Projection:** 200 JSON with `{ attemptId, questions: [ { snapshotId, schemaVersion: 1, questionType, prompt, options: [ { id, content } ] } ] }`.
11. **Strict Non-Disclosure:** Prohibits disclosing `correctOptionId`, `maxScore`, `source_question_bank_item_id`, `tenant_id`, `person_id`, `exam_participant_id`, answer keys, scoring truth, or internal DB info.
12. **Zero Mutation:** Pure read-only operation within `REPEATABLE READ READ ONLY` transaction. No writes, zero database mutation.
13. **Existing Server Integration:** Integrated into existing `runtime/secure-assessment/src/server.ts` on exact route `/api/v1/assessment/questions`.

## ERROR & STATUS CODE MATRIX
| Condition | HTTP Status | Error Payload |
|---|---|---|
| Unsupported HTTP method (e.g. POST) | 405 | `{"error": "method_not_allowed"}` |
| Missing or invalid UUID `attemptId` | 400 | `{"error": "invalid_request"}` |
| Missing authorized context | 403 | `{"error": "forbidden"}` |
| `attemptId` does not match `context.authorizedAttemptId` | 403 | `{"error": "forbidden"}` |
| Context provider throws exception | 500 | `{"error": "internal_error"}` |
| Pool connection failure | 503 | `{"error": "persistence_unavailable"}` |
| Missing or wrong-tenant Attempt | 404 | `{"error": "assessment_context_not_found"}` |
| Exam Instance lifecycle state != 'ACTIVE' | 409 | `{"error": "exam_not_active"}` |
| Absent active Exam Session | 409 | `{"error": "session_not_active"}` |
| Attempt already submitted | 409 | `{"error": "attempt_already_submitted"}` |
| Missing timer state row | 404 | `{"error": "assessment_context_not_found"}` |
| Timer not started (`started_at IS NULL`) | 409 | `{"error": "timer_not_started"}` |
| Timer expired (`effectiveRemainingSeconds <= 0`) | 409 | `{"error": "timer_expired"}` |
| Invalid snapshot frozen content (BU-066 check fails) | 500 | `{"error": "internal_error"}` |
| Database query failure | 503 | `{"error": "persistence_unavailable"}` |
| Valid active attempt & runtime | 200 | `{ "attemptId": "...", "questions": [...] }` |

## CONTROL STATUS
- BUILD UNIT: BU-080
- TITLE: Secure Assessment Student Attempt Question Delivery Read API Integration Bootstrap
- VERSION: 1.0.0
- STAGE-1: PASS / FROZEN BY MAIN PROJECT CONTROL 010
- STAGE-2 IMPLEMENTATION: COMPLETE
- STAGE-2 ENGINEERING VERIFICATION: PASS
- STAGE-2 REPOSITORY FINALIZED: YES
- STAGE-3 CONTROLLER PHYSICAL AUDIT: PASS
- STAGE-3 FINDING: NO MATERIAL ENGINEERING DEFECT REMAINS
- CONTROLLER AUDIT-HARNESS DEFECTS: SERVER TEST COUNT PARSER DEFECT + VERIFIER TSC MISSING --ignoreConfig / BOTH CLOSED / NON-MATERIAL TO BU-080 ENGINEERING
- STAGE-2 GRAPHIFY DEVIATION: NON-MATERIAL EXECUTION-CONTROL DEFECT
- STAGE-4 FAST-TRACK LIFECYCLE CLOSE: COMPLETE
- STAGE-4 LIFECYCLE CLOSE COMMIT: dc17161afc3bf3398ba5c4ae70fb8dad7b100ae6
- STAGE-4 REPOSITORY FINALIZED: YES
- STAGE-5 FINAL PHYSICAL VERIFICATION: PASS
- FINAL PHYSICAL VERIFICATION: PASS
- DONE: YES
- FULL BU-080 REPOSITORY FINALIZED: YES
- TERMINAL: YES / DO NOT REOPEN
- NEXT BUILD UNIT SELECTION / SCOPE FREEZE: AUTHORIZED
- LAST COMPLETED EXECUTABLE BUILD UNIT: BU-080
- ACTIVE BUILD UNIT: NONE
- NEXT BUILD UNIT: NOT YET REGISTERED
- FRONTEND ENTRY GATE: DEFERRED / NOT YET TRIGGERED
- PB05: OPEN / CARRIED FORWARD
- PB06: OPEN / NOT CLOSED

## CONTROLLER STAGE-3 PHYSICAL AUDIT
- **BU-080 STAGE-3 CONTROLLER PHYSICAL AUDIT:** PASS
- **STAGE-2 COMMIT:** ef388ec1efc1af0f57f9e242547ae1f29fa070ef
- **COMMIT IDENTITY:** PASS
- **EXACT TEN-PATH STAGE-2 SCOPE:** PASS
- **FORBIDDEN SCOPE:** PASS
- **CONTROL STATE / VERSION GATE:** PASS
- **MANIFEST HASH CONSISTENCY:** PASS
- **STATIC QUESTION DELIVERY CONTRACT:** PASS
- **DATABASE_URL STAGE-3 ENVIRONMENT GATE:** PASS
- **PACKAGE TYPECHECK:** PASS
- **BU-080 FOCUSED TEST:** 21 / 21 PASS
- **SERVER REGRESSION:** 15 explicit nested test cases
- **SERVER NODE PHYSICAL SUMMARY:** 16 / 16 PASS
- **PACKAGE REGRESSION:** 147 / 147 PASS
- **VERIFIER STRICT TYPECHECK:** PASS
- **REAL POSTGRESQL VERIFICATION:** PASS
- **MIGRATION HISTORY:** 34
- **MIGRATION 0035:** ABSENT
- **TENANT ISOLATION:** PASS
- **ATTEMPT RESOLUTION:** PASS
- **ACTIVE EXAM GATE:** PASS
- **ACTIVE SESSION GATE:** PASS
- **AUTHORITATIVE TIMER GATE:** PASS
- **SUBMITTED ATTEMPT GATE:** PASS
- **BU-066 CONTENT VALIDATION REUSED:** YES
- **DETERMINISTIC QUESTION ORDER:** PASS
- **STUDENT-SAFE PROJECTION:** PASS
- **CORRECT ANSWER LEAK:** NO
- **MAX SCORE LEAK:** NO
- **INTERNAL ID LEAK:** NO
- **DATABASE FAILURE FAIL-CLOSED:** PASS
- **ZERO MUTATION:** PASS
- **PRE-RUN ZERO-LEAK:** PASS
- **POST-RUN ZERO-LEAK:** PASS
- **DISPOSABLE DATABASE CLEANUP:** PASS
- **REPOSITORY PRESERVATION:** PASS
- **MATERIAL ENGINEERING DEFECT:** NONE

## AUDIT-HARNESS INCIDENTS
- **FIRST STAGE-3 STOP:** CONTROLLER SERVER TEST COUNT PARSER DEFECT
- **DETAIL:** server.test.ts contains 15 explicit nested test cases, while Node physically reports 16 tests because the parent test('server tests', ...) is also counted.
- **ENGINEERING DEFECT:** NONE
- **SECOND STAGE-3 STOP:** CONTROLLER VERIFIER TSC COMMAND DEFECT / MISSING --ignoreConfig
- **FINAL RE-PROOF:** PASS
- **VERIFIER STRICT TYPECHECK:** PASS
- **NOTE:** Both incidents are Controller audit-harness defects only. Neither is a BU-080 engineering defect.

## STAGE-2 PROCESS DEVIATION
- **STAGE-2 GRAPHIFY INVOCATION:** OCCURRED
- **CLASSIFICATION:** NON-MATERIAL EXECUTION-CONTROL DEFECT
- **MATERIAL ENGINEERING IMPACT:** NONE

## FAST-TRACK STAGE-4 LIFECYCLE CLOSE
- **STAGE-4 FAST-TRACK LIFECYCLE CLOSE:** COMPLETE
- **STAGE-4 REPOSITORY FINALIZED:** YES
- **STAGE-4 LIFECYCLE CLOSE COMMIT:** dc17161afc3bf3398ba5c4ae70fb8dad7b100ae6
- **STAGE-5 FINAL PHYSICAL VERIFICATION:** PASS
- **FINAL PHYSICAL VERIFICATION:** PASS
- **DONE:** YES
- **FULL BU-080 REPOSITORY FINALIZED:** YES
- **TERMINAL:** YES / DO NOT REOPEN
- **NEXT BUILD UNIT SELECTION / SCOPE FREEZE:** AUTHORIZED
- **LAST COMPLETED EXECUTABLE BUILD UNIT:** BU-080
- **ACTIVE BUILD UNIT:** NONE
- **NEXT BUILD UNIT:** NOT YET REGISTERED
- **FRONTEND ENTRY GATE:** DEFERRED / NOT YET TRIGGERED
- **PB05:** OPEN / CARRIED FORWARD
- **PB06:** OPEN / NOT CLOSED

## STAGE-5 FINAL PHYSICAL VERIFICATION
- **STAGE-4 LIFECYCLE CLOSE COMMIT:** dc17161afc3bf3398ba5c4ae70fb8dad7b100ae6
- **STAGE-5 FINAL PHYSICAL VERIFICATION:** PASS
- **FINAL PHYSICAL VERIFICATION:** PASS
- **DONE:** YES
- **FULL BU-080 REPOSITORY FINALIZED:** YES
- **TERMINAL:** YES / DO NOT REOPEN
- **NEXT BUILD UNIT SELECTION / SCOPE FREEZE:** AUTHORIZED
- **LAST COMPLETED EXECUTABLE BUILD UNIT:** BU-080
- **ACTIVE BUILD UNIT:** NONE
- **NEXT BUILD UNIT:** NOT YET REGISTERED
- **FRONTEND ENTRY GATE:** DEFERRED / NOT YET TRIGGERED
- **PB05:** OPEN / CARRIED FORWARD
- **PB06:** OPEN / NOT CLOSED
