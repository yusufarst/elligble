# BU-074: Secure Assessment Exam Instance Active Proctor Room Coverage Readiness Preflight Runtime Bootstrap

## PURPOSE
BU-074 implements a bounded READ-ONLY readiness fact/preflight that determines ONLY whether all persisted Exam Rooms for one exact same-tenant SCHEDULED Exam Instance have at least one mapped explicit Proctor Assignment whose parent assignment is ACTIVE under existing canonical semantics (`revoked_at IS NULL`).

BU-074 does NOT determine whether:
- room-based operation is required;
- proctor-per-room coverage is required by policy;
- a minimum greater than one proctor per room is required;
- the Exam Instance is overall READY.

## CANONICAL BASIS
- `docs/00-governance/00.08_BUILD_UNIT_FAST_TRACK_CONTROL.md`
- `docs/00-governance/00.07_DOMAIN_OWNERSHIP_AND_CONTRACTS.md`
- `docs/01-discovery/04.01_SECURE_ASSESSMENT.md`
- `docs/architecture/SECURE_ASSESSMENT_CRITICAL_ARCHITECTURE.md`
- PB05: Permission Matrix (OPEN / CARRIED FORWARD)

## DIRECT PREDECESSORS
- BU-070 — Secure Assessment Exam Instance Active Proctor Assignment Presence Readiness Preflight Runtime Bootstrap
- BU-073 — Secure Assessment Exam Proctor Room Assignment Core State Persistence Bootstrap

## SEQUENCE GATE
BU-073 fully terminal / DONE YES / full repository finalized YES / Stage-5 final physical verification PASS

## COMPOSITION RULE
Reuses and composes BU-070 (`checkExamInstanceActiveProctorAssignmentPresenceReadiness`) rather than inventing separate:
- UUID validation
- capability semantics (called exactly once with exact tenant/exam context)
- SCHEDULED-state semantics
- active Proctor Assignment semantics (`revoked_at IS NULL`)

Deterministic handling of BU-070 results:
- `denied` -> `denied`
- `unavailable` -> `unavailable`
- `invalid_state` -> `invalid_state`
- `not_ready` (`active_proctor_assignment_empty`) -> preserves exact blocker
- `active_proctor_assignment_presence_ready` -> continues to Exam Room coverage query

## ZERO-ROOM SEMANTIC
If BU-070 succeeds and the exact Exam Instance has zero persisted Exam Rooms:
- returns `type: 'no_exam_rooms'`, `examRoomCount: 0`.
- Does NOT claim coverage READY.
- Does NOT claim overall NOT_READY.
- BU-074 does not invent room-mode applicability.

## ROOM COVERAGE DEFINITION
- Scoped by exact `tenant_id` and `exam_instance_id`.
- Reads `public.secure_assessment_exam_rooms`, `public.secure_assessment_exam_proctor_room_assignments`, and `public.secure_assessment_proctor_assignments`.
- A room is covered only if at least one mapping exists whose parent has `revoked_at IS NULL`.
- Revoked-only mappings do NOT count.
- Multiple active proctors on a single room do not inflate covered-room count.
- Computes `examRoomCount`, `coveredExamRoomCount`, and `uncoveredExamRoomCount = examRoomCount - coveredExamRoomCount`.
- If `examRoomCount > 0` and `uncoveredExamRoomCount > 0` -> `not_ready` with blocker `active_proctor_room_coverage_incomplete`.
- If `examRoomCount > 0` and `uncoveredExamRoomCount === 0` -> `active_proctor_room_coverage_ready`.

## EXACT RESULT UNION CONTRACT
```typescript
export type ActiveProctorRoomCoverageReadinessResult =
  | { type: 'denied' }
  | { type: 'unavailable' }
  | { type: 'invalid_state' }
  | { type: 'not_ready'; blocker: 'active_proctor_assignment_empty' }
  | {
      type: 'no_exam_rooms';
      tenantId: string;
      examInstanceId: string;
      examRoomCount: 0;
    }
  | {
      type: 'not_ready';
      blocker: 'active_proctor_room_coverage_incomplete';
      examRoomCount: number;
      coveredExamRoomCount: number;
      uncoveredExamRoomCount: number;
    }
  | {
      type: 'active_proctor_room_coverage_ready';
      tenantId: string;
      examInstanceId: string;
      examRoomCount: number;
      coveredExamRoomCount: number;
      uncoveredExamRoomCount: 0;
    };
```

## AUTHORIZED PATHS
1. `runtime/secure-assessment/src/exam-instance-active-proctor-room-coverage-readiness-preflight.ts`
2. `runtime/secure-assessment/test/exam-instance-active-proctor-room-coverage-readiness-preflight.test.ts`
3. `runtime/secure-assessment/verification/verify_bu074_exam_instance_active_proctor_room_coverage_readiness_preflight.ts`
4. `docs/build/units/BU-074_SECURE_ASSESSMENT_EXAM_INSTANCE_ACTIVE_PROCTOR_ROOM_COVERAGE_READINESS_PREFLIGHT_RUNTIME_BOOTSTRAP.md`

## FOCUSED TEST SUITE
Proves 23 required scenarios:
1. invalid tenant UUID -> denied
2. invalid exam UUID -> denied
3. capability denied -> denied
4. explicit capability unavailable -> unavailable
5. capability evaluator throws -> unavailable
6. unexpected capability decision fails closed -> denied
7. nonexistent exam -> denied
8. wrong tenant -> denied
9. non-SCHEDULED exam -> invalid_state
10. zero active Proctor Assignment preserves active_proctor_assignment_empty
11. active Proctor Assignment + zero rooms -> no_exam_rooms
12. one room + no room mapping -> incomplete 1/0/1
13. one room + one active mapped Proctor -> ready 1/1/0
14. room mapped only to revoked Proctor -> incomplete
15. room mapped to active + revoked Proctors -> covered exactly once
16. two rooms, one covered -> incomplete 2/1/1
17. two rooms, same active Proctor mapped to both -> ready 2/2/0
18. multiple active Proctors on one room do not inflate covered-room count
19. other Exam Instance rooms/mappings excluded
20. other tenant rooms/mappings excluded
21. coverage-query/database failure -> unavailable
22. capability evaluator called exactly once with exact tenant/exam context
23. runtime performs no INSERT / UPDATE / DELETE

## REAL POSTGRESQL VERIFICATION
- Discovers and applies canonical migrations 0001..0033 only.
- Asserts exactly one migration per prefix 0001..0033.
- Asserts migration history is exactly 33.
- Asserts migration 0034 does NOT exist.
- Uses disposable database with prefix `elligble_bu074_`.
- Builds canonical fixture chains (tenant, academic core, exam instances, proctors, rooms, proctor-room mappings).
- Physically exercises all scenarios: zero rooms, uncovered room, active-covered room, revoked-only room, active+revoked proctors on same room, multi-room with same active proctor, multiple proctors on one room without count inflation, other-exam isolation, other-tenant isolation, composed BU-070 preflight responses.
- Proves READ-ONLY runtime: before/after snapshots of all protected state (exam instances, proctor assignments, rooms, proctor room assignments, participant room assignments, participants, attempts, sessions) and Academic Core confirm zero mutation.
- Fail-closed cleanup: closes client, drops disposable database, proves removal from `pg_database`.

## STRICT OUT OF SCOPE
- Room-mode policy
- Deciding whether Exam Rooms are mandatory
- Deciding whether per-room Proctor coverage is mandatory
- Minimum Proctor count > 1
- Proctor scheduling/shift/time-window availability
- Proctor-room mapping creation/update/delete
- Proctor Assignment creation/revocation
- Participant-to-Room assignment changes
- Participant-to-Room completeness readiness
- Room capacity
- Room physical-location taxonomy
- Overall Room readiness composition
- Overall READY evaluator
- SCHEDULED -> READY transition
- READY -> ACTIVE transition
- Attempt creation
- Session creation
- Proctor feed authorization
- Incident feed filtering
- Broadcast authorization
- Anti-cheating policy
- Technical compatibility policy
- Academic Core mutation
- Schema/migration changes (no migration 0034)
- API / Frontend
- Permission Matrix / PB05 closure
- BU-075 selection

## Execution State
- **TITLE:** Secure Assessment Exam Instance Active Proctor Room Coverage Readiness Preflight Runtime Bootstrap
- **STAGE-1:** PASS / FROZEN
- **DIRECT PREDECESSORS:** BU-070, BU-073
- **SEQUENCE GATE:** BU-073 fully terminal / DONE YES / full repository finalized YES / Stage-5 final physical verification PASS
- **PURPOSE:** bounded read-only fact/preflight for active Proctor coverage across persisted Exam Rooms
- **AUTHORIZED PATHS:** exact four paths above
- **RESULT CONTRACT:** exact frozen union above
- **ZERO-ROOM:** no_exam_rooms / does not invent room-mode applicability
- **PB05:** OPEN / CARRIED FORWARD
- **OWNER DECISION REQUIRED:** NO
- **BU-075:** NOT SELECTED / NOT REGISTERED
- **SOURCE AUTHORING:** EXECUTED / COMPLETE
- **STAGE-2 REPOSITORY FINALIZED:** YES
- **STAGE-3 CONTROLLER PHYSICAL AUDIT:** PASS
- **STAGE-3 CONTROLLER PHYSICAL AUDIT FINDING:** PASS / NO MATERIAL DEFECT REMAINS
- **FAST-TRACK STAGE-4 LIFECYCLE CLOSE:** COMPLETE
- **STAGE-4 REPOSITORY FINALIZED:** YES
- **STAGE-5 FINAL PHYSICAL VERIFICATION:** PENDING
- **DONE:** YES
- **FULL BU-074 REPOSITORY FINALIZED:** YES

## Stage-2 Verification / Repository Finalization

- **MINIMAL STATIC SOURCE CONTRACT AUDIT:** PASS / PRESERVED
- **TARGETED TEST-HARNESS LITERAL-TYPE REMEDIATION:** EXECUTED / VERIFIED
- **PACKAGE TYPECHECK:** PASS
- **BU-074 FOCUSED TEST:** PASS / 23
- **VERIFIER STRICT TYPECHECK:** PASS
- **REAL POSTGRESQL VERIFICATION:** PASS
- **MIGRATION HISTORY:** 33 / PASS
- **MIGRATION 0034 ABSENCE:** PASS
- **PRE-RUN ZERO-LEAK:** PASS
- **POST-RUN ZERO-LEAK:** PASS
- **DISPOSABLE DATABASE CLEANUP FAIL-CLOSED:** VERIFIED
- **STAGE-2 REPOSITORY FINALIZED:** YES
- **STAGE-3 CONTROLLER PHYSICAL AUDIT:** PENDING
- **DONE:** NO
- **FULL BU-074 REPOSITORY FINALIZED:** NO
- **PB05:** OPEN / CARRIED FORWARD
- **OWNER DECISION REQUIRED:** NO
- **BU-075:** NOT SELECTED / NOT REGISTERED


## Fast-Track Stage-4 Lifecycle Close

- **STAGE-3 CONTROLLER PHYSICAL AUDIT:** PASS
- **STAGE-3 CONTROLLER PHYSICAL AUDIT FINDING:** PASS / NO MATERIAL DEFECT REMAINS
- **FAST-TRACK STAGE-4 LIFECYCLE CLOSE:** COMPLETE
- **STAGE-4 REPOSITORY FINALIZED:** YES
- **STAGE-5 FINAL PHYSICAL VERIFICATION:** PENDING
- **DONE:** YES
- **FULL BU-074 REPOSITORY FINALIZED:** YES
- **PB05:** OPEN / CARRIED FORWARD
- **OWNER DECISION REQUIRED:** NO
- **BU-075:** NOT SELECTED / NOT REGISTERED
