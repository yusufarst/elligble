# BU-070: Secure Assessment Exam Instance Active Proctor Assignment Presence Readiness Preflight Runtime Bootstrap

## PURPOSE
BU-070 is a bounded READ-ONLY presence preflight that determines ONLY whether one same-tenant SCHEDULED Exam Instance has at least one active explicit Proctor Assignment where revoked_at IS NULL.

It does NOT determine whether proctoring is required.
It does NOT claim overall READY.
It does NOT claim per-room Proctor coverage.
It does NOT transition SCHEDULED -> READY.
It does NOT transition READY -> ACTIVE.

## CANONICAL BASIS
- PB05: Permission Matrix
- BU-069: Secure Assessment Exam Instance Baseline Scoring Readiness Preflight Runtime Bootstrap

## DIRECT PREDECESSORS
- BU-034 — Secure Assessment Explicit Proctor Assignment Core State Persistence Bootstrap
- BU-053 — Secure Assessment Exam Instance Lifecycle State Persistence Bootstrap
- BU-069 — Secure Assessment Exam Instance Baseline Scoring Readiness Preflight Runtime Bootstrap

## EXACT RUNTIME CONTRACT
- Checks if `tenantId` and `examInstanceId` are valid UUIDs.
- Evaluates the provided capability context (`tenantId` and `examInstanceId`).
- Ensures exact literal returns for `granted`, `denied`, and `unavailable`.
- Verifies the requested exam instance exists, matches tenant, and is in `SCHEDULED` state.
- Counts active proctor assignments via `public.secure_assessment_proctor_assignments`.
- Uses `revoked_at IS NULL` to exclude revoked assignments.
- Excludes assignments from other Exam Instances or tenants.

## RESULT UNION
```typescript
export type ActiveProctorAssignmentPresenceReadinessResult =
  | { type: 'denied' }
  | { type: 'unavailable' }
  | { type: 'invalid_state' }
  | { type: 'not_ready'; blocker: 'active_proctor_assignment_empty' }
  | { type: 'active_proctor_assignment_presence_ready'; tenantId: string; examInstanceId: string; activeProctorAssignmentCount: number };
```

## READ BOUNDARY
1. `public.secure_assessment_exam_instances` (for `lifecycle_state`)
2. `public.secure_assessment_proctor_assignments` (for active assignment count)

## FOCUSED TEST REQUIREMENTS
Must prove at least 19 scenarios:
1. invalid tenant UUID
2. invalid exam UUID
3. capability denied
4. explicit unavailable
5. evaluator throws
6. unexpected capability decision fails closed
7. nonexistent exam
8. wrong tenant
9. non-SCHEDULED
10. zero active assignments
11. one active assignment -> count 1
12. two active assignments -> count 2
13. revoked-only -> zero/not_ready
14. active + revoked -> active count only
15. other-exam assignment excluded
16. other-tenant assignment excluded
17. database failure -> unavailable
18. capability called exactly once with exact context
19. no INSERT / UPDATE / DELETE

## POSTGRESQL REQUIREMENTS
- Apply canonical migrations 0001..0030 ONLY.
- Prove migration history count exactly 30.
- Disposable database prefix: `elligble_bu070_`
- Creates exact required fixture chain for exam instances and proctor assignments.
- Verifies SCHEDULED lifecycle, active counts, excluded revoked, and physical invariants.
- Fails closed on database cleanup.

## AUTHORIZED PATHS
- `runtime/secure-assessment/src/exam-instance-active-proctor-assignment-presence-readiness-preflight.ts`
- `runtime/secure-assessment/test/exam-instance-active-proctor-assignment-presence-readiness-preflight.test.ts`
- `runtime/secure-assessment/verification/verify_bu070_exam_instance_active_proctor_assignment_presence_readiness_preflight.ts`
- `docs/build/units/BU-070_SECURE_ASSESSMENT_EXAM_INSTANCE_ACTIVE_PROCTOR_ASSIGNMENT_PRESENCE_READINESS_PREFLIGHT_RUNTIME_BOOTSTRAP.md`

## STRICT OUT-OF-SCOPE
- Deciding whether proctoring is required
- Claiming overall Proctor readiness
- Claiming per-room coverage
- Creating Exam Room semantics or persistence
- Implementing proctor-per-room policy or conflict policy
- Creating assignment/revocation mutation
- Reading Identity Person content
- Implementing Proctor authorization
- Changing BU-034/BU-035 semantics
- Implementing anti-cheating policy or device compatibility
- Implementing overall READY or lifecycle state transitions
- Creating Attempt or Session
- Modifying Academic Core
- Adding schema/migrations
- Modifying project config (`package.json`, `tsconfig`)

## STOP CONDITIONS
- EXACT 4 files modified.
- No terminal usage.
- Execution state MUST REMAIN unchanged (BU-070 Done: NO, PB05: OPEN, BU-071: NO).

## Execution State
- **BUILD UNIT:** BU-070 — Secure Assessment Exam Instance Active Proctor Assignment Presence Readiness Preflight Runtime Bootstrap
- **STAGE-1:** PASS / FROZEN
- **STAGE-2 SOURCE AUTHORING:** EXECUTED / NOT YET VERIFIED
- **STAGE-2 REPOSITORY FINALIZED:** NO
- **STAGE-3:** NOT STARTED
- **DONE:** NO
- **FULL BU-070 REPOSITORY FINALIZED:** NO
- **PB05:** OPEN / CARRIED FORWARD
- **OWNER DECISION REQUIRED:** NO
- **BU-071:** NOT SELECTED / NOT REGISTERED



## Stage-2 Finalization State

- **STAGE-1:** PASS / FROZEN
- **STAGE-2 SOURCE AUTHORING:** EXECUTED / COMPLETE
- **FIRST REAL POSTGRESQL VERIFICATION:** FAIL / VERIFIER FIXTURE REFERENCED NONCANONICAL `teacher_assignment_id`
- **BU-070 RUNTIME DEFECT ESTABLISHED BY FIRST PG FAILURE:** NO
- **TARGETED VERIFIER FIXTURE REMEDIATION:** EXECUTED
- **PACKAGE TYPECHECK:** PASS / PRESERVED / NOT RERUN
- **BU-070 FOCUSED TEST:** PASS / 19 / 19 / PRESERVED / NOT RERUN
- **VERIFIER STRICT TYPECHECK:** PASS
- **REAL POSTGRESQL VERIFICATION:** PASS
- **PRE-RUN ZERO-LEAK:** PASS
- **POST-RUN ZERO-LEAK:** PASS
- **DISPOSABLE DATABASE CLEANUP FAIL-CLOSED:** VERIFIED
- **STAGE-2 REPOSITORY FINALIZED:** YES
- **STAGE-3 CONTROLLER PHYSICAL AUDIT:** PENDING
- **DONE:** NO
- **FULL BU-070 REPOSITORY FINALIZED:** NO
- **PB05:** OPEN / CARRIED FORWARD
- **OWNER DECISION REQUIRED:** NO
- **BU-071:** NOT SELECTED / NOT REGISTERED

## Stage-3 Targeted Remediation State

- STAGE-2 REPOSITORY FINALIZED: YES
- STAGE-2 COMMIT: 479b54688067713007c62846fc5f40d7f6cc2088
- STAGE-3 CONTROLLER PHYSICAL AUDIT: FAIL / MATERIAL VERIFIER-COVERAGE + SPEC-TRUTH GAP
- BU-070 RUNTIME DEFECT ESTABLISHED: NO
- TARGETED STAGE-3 REMEDIATION: EXECUTED / NOT YET VERIFIED
- PACKAGE TYPECHECK: PASS / PRESERVED / NOT RERUN
- BU-070 FOCUSED TEST: PASS / 19 / 19 / PRESERVED / NOT RERUN
- DONE: NO
- FULL BU-070 REPOSITORY FINALIZED: NO
- PB05: OPEN / CARRIED FORWARD
- OWNER DECISION REQUIRED: NO
- BU-071: NOT SELECTED / NOT REGISTERED


## Targeted Stage-3 Remediation Verification / Finalization

- **STAGE-2 COMMIT:** 479b54688067713007c62846fc5f40d7f6cc2088
- **STAGE-3 CONTROLLER PHYSICAL AUDIT:** FAIL / MATERIAL VERIFIER-COVERAGE + SPEC-TRUTH GAP
- **BU-070 RUNTIME DEFECT ESTABLISHED:** NO
- **TARGETED STAGE-3 REMEDIATION:** EXECUTED / VERIFIED
- **PACKAGE TYPECHECK:** PASS / PRESERVED / NOT RERUN
- **BU-070 FOCUSED TEST:** PASS / 19 / 19 / PRESERVED / NOT RERUN
- **VERIFIER STRICT TYPECHECK:** PASS
- **REAL POSTGRESQL VERIFICATION:** PASS
- **PRE-RUN ZERO-LEAK:** PASS
- **POST-RUN ZERO-LEAK:** PASS
- **DISPOSABLE DATABASE CLEANUP FAIL-CLOSED:** VERIFIED
- **TARGETED STAGE-3 REMEDIATION REPOSITORY FINALIZED:** YES
- **STAGE-3 CONTROLLER PHYSICAL RE-AUDIT:** PENDING
- **DONE:** NO
- **FULL BU-070 REPOSITORY FINALIZED:** NO
- **PB05:** OPEN / CARRIED FORWARD
- **OWNER DECISION REQUIRED:** NO
- **BU-071:** NOT SELECTED / NOT REGISTERED


## Fast-Track Stage-4 Lifecycle Close

- **STAGE-3 CONTROLLER PHYSICAL RE-AUDIT:** PASS
- **STAGE-3 CONTROLLER PHYSICAL RE-AUDIT FINDING:** PASS / NO MATERIAL DEFECT REMAINS
- **FAST-TRACK STAGE-4 LIFECYCLE CLOSE:** COMPLETE
- **STAGE-4 REPOSITORY FINALIZED:** YES
- **DONE:** YES
- **FULL BU-070 REPOSITORY FINALIZED:** YES
- **STAGE-5 FINAL PHYSICAL VERIFICATION:** PENDING
- **NEXT BUILD UNIT SELECTION / SCOPE FREEZE:** NOT YET AUTHORIZED
- **PB05:** OPEN / CARRIED FORWARD
- **OWNER DECISION REQUIRED:** NO
- **BU-071:** NOT SELECTED / NOT REGISTERED
