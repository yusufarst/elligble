# BU-075: Secure Assessment Exam Instance Participant Room Assignment Completeness Readiness Preflight Runtime Bootstrap

## PURPOSE
BU-075 implements a bounded READ-ONLY readiness fact/preflight that determines ONLY whether every persisted Exam Participant for one exact same-tenant SCHEDULED Exam Instance has a persisted Participant-to-Room assignment.

BU-075 does NOT determine whether:
- room-mode applicability policy is required;
- overall Room readiness is satisfied;
- the Exam Instance is overall READY;
- participant room assignments should be mutated or reassigned.

## CANONICAL BASIS
- `docs/00-governance/00.08_BUILD_UNIT_FAST_TRACK_CONTROL.md`
- `docs/00-governance/00.07_DOMAIN_OWNERSHIP_AND_CONTRACTS.md`
- `docs/01-discovery/04.01_SECURE_ASSESSMENT.md`
- `docs/architecture/SECURE_ASSESSMENT_CRITICAL_ARCHITECTURE.md`
- PB05: Permission Matrix (OPEN / CARRIED FORWARD)

## DIRECT PREDECESSORS
- BU-062 — Secure Assessment Exam Instance Participant Presence Readiness Preflight Runtime Bootstrap
- BU-072 — Secure Assessment Exam Participant Room Assignment Core State Persistence Bootstrap (transitive BU-071)

## SEQUENCE GATE
BU-074 terminal / DONE YES / repository finalized YES / Stage-5 final physical verification PASS

## COMPOSITION RULE
Composes BU-062 (`checkExamInstanceParticipantPresenceReadiness`) exactly once rather than duplicating:
- UUID validation
- capability evaluation (called exactly once with exact tenant/exam context)
- SCHEDULED-state validation
- participant-presence semantics

Participant count is inherited directly from BU-062 (`participantCount` from `participant_presence_ready`).

Deterministic forwarding of BU-062 non-ready results:
- `denied` -> `denied`
- `unavailable` -> `unavailable`
- `invalid_state` -> `invalid_state`
- `not_ready` (`participant_empty`) -> forwarded directly preserving exact blocker

## ZERO-ROOM SEMANTIC
After `participant_presence_ready` from BU-062:
- If exact same-tenant Exam Instance has zero persisted Exam Rooms:
  - returns `type: 'no_exam_rooms'`, `participantCount`, `assignedParticipantCount: 0`, `unassignedParticipantCount: participantCount`.
  - NEUTRAL FACT: Does NOT claim completeness READY.
  - Does NOT claim overall NOT_READY.
  - BU-075 does not invent room-mode applicability.

## PARTICIPANT ROOM ASSIGNMENT COMPLETENESS DEFINITION
- Scoped strictly by exact `tenant_id` and `exam_instance_id`.
- Reads `public.secure_assessment_exam_rooms` and `public.secure_assessment_exam_participant_room_assignments`.
- `assignedParticipantCount` is exact persisted assignment-row count scoped by `tenant_id` and `exam_instance_id`.
- BU-072 uniqueness remains authoritative: maximum one assignment per participant in the same tenant/exam.
- Multiple participants may share one room.
- `unassignedParticipantCount = participantCount - assignedParticipantCount`.
- If rooms exist and `unassignedParticipantCount > 0` -> `not_ready` with blocker `participant_room_assignment_incomplete`.
- If all participants assigned (`unassignedParticipantCount === 0`) -> `participant_room_assignment_completeness_ready`.

## EXACT RESULT UNION CONTRACT
```typescript
export type ParticipantRoomAssignmentCompletenessReadinessResult =
  | { type: 'denied' }
  | { type: 'unavailable' }
  | { type: 'invalid_state' }
  | { type: 'not_ready'; blocker: 'participant_empty' }
  | {
      type: 'no_exam_rooms';
      tenantId: string;
      examInstanceId: string;
      participantCount: number;
      assignedParticipantCount: 0;
      unassignedParticipantCount: number;
    }
  | {
      type: 'not_ready';
      blocker: 'participant_room_assignment_incomplete';
      participantCount: number;
      assignedParticipantCount: number;
      unassignedParticipantCount: number;
    }
  | {
      type: 'participant_room_assignment_completeness_ready';
      tenantId: string;
      examInstanceId: string;
      participantCount: number;
      assignedParticipantCount: number;
      unassignedParticipantCount: 0;
    };
```

## AUTHORIZED PATHS
1. `runtime/secure-assessment/src/exam-instance-participant-room-assignment-completeness-readiness-preflight.ts`
2. `runtime/secure-assessment/test/exam-instance-participant-room-assignment-completeness-readiness-preflight.test.ts`
3. `runtime/secure-assessment/verification/verify_bu075_exam_instance_participant_room_assignment_completeness_readiness_preflight.ts`
4. `docs/build/units/BU-075_SECURE_ASSESSMENT_EXAM_INSTANCE_PARTICIPANT_ROOM_ASSIGNMENT_COMPLETENESS_READINESS_PREFLIGHT_RUNTIME_BOOTSTRAP.md`

## FOCUSED TEST SUITE
Proves 21 required scenarios:
1. invalid tenant UUID -> denied
2. invalid exam UUID -> denied
3. capability denied -> denied
4. explicit capability unavailable -> unavailable
5. capability evaluator throws -> unavailable
6. nonexistent Exam Instance -> denied
7. wrong tenant -> denied
8. non-SCHEDULED -> invalid_state
9. zero participants -> participant_empty
10. participants + zero rooms -> no_exam_rooms with exact counts
11. room exists + zero assignments -> incomplete
12. partial assignments -> incomplete with exact counts
13. all participants assigned -> completeness_ready
14. multiple participants sharing same room -> supported
15. other Exam Instance excluded
16. other tenant excluded
17. BU-075 completeness-query failure -> unavailable
18. capability evaluator called exactly once
19. capability evaluator receives exact tenantId + examInstanceId
20. participantCount originates from BU-062 result
21. runtime performs no INSERT / UPDATE / DELETE

## REAL POSTGRESQL VERIFICATION
- zero participants
- zero rooms
- zero assignments
- partial assignments
- full assignments
- multiple participants sharing one room
- same-tenant / other-exam isolation
- other-tenant isolation
- BU-075-owned query failure -> unavailable
- exact capability context
- capability evaluator exactly once
- Secure Assessment protected-state pre/post equality
- Academic Core pre/post equality
- canonical migrations 0001..0033
- history 33
- migration 0034 absent
- fail-closed disposable database cleanup

## STRICT OUT OF SCOPE
- Room-mode applicability policy
- Overall Room readiness evaluator
- Overall READY evaluator
- SCHEDULED -> READY transition
- READY -> ACTIVE transition
- Participant assignment mutation
- Reassignment / deassignment
- Room capacity / seating policy
- Proctor mutation
- BU-074 reimplementation
- Attempt / Session creation
- Secure Assessment Entry
- Academic Core mutation
- Schema/migration changes (no migration 0034)
- API / Frontend
- Permission Matrix / PB05 closure
- BU-076 selection

## Execution State
- **TITLE:** Secure Assessment Exam Instance Participant Room Assignment Completeness Readiness Preflight Runtime Bootstrap
- **STAGE-1:** PASS / FROZEN
- **DIRECT PREDECESSORS:** BU-062, BU-072
- **SEQUENCE GATE:** BU-074 terminal / DONE YES / repository finalized YES / Stage-5 final physical verification PASS
- **PURPOSE:** bounded read-only fact/preflight for participant room assignment completeness across persisted Exam Rooms
- **AUTHORIZED PATHS:** exact four paths above
- **RESULT CONTRACT:** exact frozen union above
- **ZERO-ROOM:** no_exam_rooms / neutral fact / does not invent room-mode applicability
- **PB05:** OPEN / CARRIED FORWARD
- **OWNER DECISION REQUIRED:** NO
- **BU-076:** NOT SELECTED / NOT REGISTERED
- **SOURCE AUTHORING:** COMPLETE
- **PACKAGE TYPECHECK:** PASS
- **BU-075 FOCUSED TEST:** PASS / 21
- **VERIFIER STRICT TYPECHECK:** PASS
- **REAL POSTGRESQL VERIFICATION:** PASS
- **MIGRATION HISTORY:** 33 / PASS
- **MIGRATION 0034 ABSENCE:** PASS
- **PRE-RUN ZERO-LEAK:** PASS
- **POST-RUN ZERO-LEAK:** PASS
- **DISPOSABLE DATABASE CLEANUP FAIL-CLOSED:** VERIFIED
- **STAGE-2 REPOSITORY FINALIZED:** YES
- **STAGE-3 CONTROLLER PHYSICAL AUDIT:** PASS
- **STAGE-3 CONTROLLER PHYSICAL AUDIT FINDING:** PASS / NO MATERIAL ENGINEERING DEFECT
- **FAST-TRACK STAGE-4 LIFECYCLE CLOSE:** COMPLETE
- **STAGE-4 REPOSITORY FINALIZED:** YES
- **STAGE-4 LIFECYCLE CLOSE COMMIT:** 193947a3cb8e20d3db1446be71ba76694983e293
- **STAGE-5 FINAL PHYSICAL VERIFICATION:** PASS
- **FINAL PHYSICAL VERIFICATION:** PASS
- **NEXT BUILD UNIT SELECTION / SCOPE FREEZE:** AUTHORIZED
- **DONE:** YES
- **FULL BU-075 REPOSITORY FINALIZED:** YES
- **PB05:** OPEN / CARRIED FORWARD
- **OWNER DECISION REQUIRED:** NO
- **BU-076:** NOT SELECTED / NOT REGISTERED

## Fast-Track Stage-4 Lifecycle Close

- **STAGE-3 CONTROLLER PHYSICAL AUDIT:** PASS
- **STAGE-3 CONTROLLER PHYSICAL AUDIT FINDING:** PASS / NO MATERIAL ENGINEERING DEFECT
- **FAST-TRACK STAGE-4 LIFECYCLE CLOSE:** COMPLETE
- **STAGE-4 REPOSITORY FINALIZED:** YES
- **STAGE-5 FINAL PHYSICAL VERIFICATION:** PENDING
- **DONE:** YES
- **FULL BU-075 REPOSITORY FINALIZED:** YES
- **PB05:** OPEN / CARRIED FORWARD
- **OWNER DECISION REQUIRED:** NO
- **BU-076:** NOT SELECTED / NOT REGISTERED

## Stage-5 Final Physical Verification

- **STAGE-4 LIFECYCLE CLOSE COMMIT:** 193947a3cb8e20d3db1446be71ba76694983e293
- **STAGE-5 FINAL PHYSICAL VERIFICATION:** PASS
- **FINAL PHYSICAL VERIFICATION:** PASS
- **DONE:** YES
- **FULL BU-075 REPOSITORY FINALIZED:** YES
- **NEXT BUILD UNIT SELECTION / SCOPE FREEZE:** AUTHORIZED
- **PB05:** OPEN / CARRIED FORWARD
- **OWNER DECISION REQUIRED:** NO
- **BU-076:** NOT SELECTED / NOT REGISTERED
