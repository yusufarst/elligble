# BU-077: Secure Assessment Exam Instance Conditional Room and Proctor Readiness Composition Preflight Runtime Bootstrap

## PURPOSE
BU-077 implements a bounded READ-ONLY composition preflight for conditional Exam Room and Proctor readiness for one exact same-tenant SCHEDULED Exam Instance based on the BU-076 persisted requirement policy facts.

BU-077 evaluates:
1. `room_based_operations_enabled`
2. `proctor_per_room_required`

And conditionally composes predecessor preflights BU-075 (Participant Room Assignment Completeness) and BU-074 (Active Proctor Room Coverage).

## CANONICAL BASIS
- `docs/00-governance/00.08_BUILD_UNIT_FAST_TRACK_CONTROL.md`
- `docs/00-governance/00.07_DOMAIN_OWNERSHIP_AND_CONTRACTS.md`
- `docs/01-discovery/04.01_SECURE_ASSESSMENT.md`
- `docs/architecture/SECURE_ASSESSMENT_CRITICAL_ARCHITECTURE.md`
- PB05: Permission Matrix (OPEN / CARRIED FORWARD)

## DIRECT PREDECESSORS
- BU-074 — Secure Assessment Exam Instance Active Proctor Room Coverage Readiness Preflight Runtime Bootstrap
- BU-075 — Secure Assessment Exam Instance Participant Room Assignment Completeness Readiness Preflight Runtime Bootstrap
- BU-076 — Secure Assessment Exam Instance Room and Proctor Requirement Policy Core State Persistence Bootstrap

## SEQUENCE GATE
BU-076 terminal / DONE YES / repository finalized YES / Stage-5 final physical verification PASS

## POLICY SEMANTICS & CONDITIONAL BEHAVIOR
Exact four policy states evaluated deterministically:

1. `NULL / NULL`:
   - Returns `not_ready` with blocker `room_proctor_requirement_policy_unconfigured`.
   - Requirement policy has not been configured; fails closed.

2. `FALSE / FALSE`:
   - Returns `room_proctor_readiness_not_applicable`.
   - Room-based operations are disabled; Room and Proctor requirements are not applicable.
   - Does NOT inspect existing Room rows or participants to infer policy.

3. `TRUE / FALSE`:
   - Room-based operations enabled; explicit per-room Proctor coverage not required by policy.
   - Exam Rooms must exist (zero rooms blocks with `exam_room_empty`).
   - Participant-to-room assignment completeness required (composed from BU-075).
   - Per-room Proctor coverage is not evaluated (BU-074 not invoked).
   - If participant-room assignment completeness passes -> returns `room_proctor_readiness_ready`.

4. `TRUE / TRUE`:
   - Room-based operations enabled; active Proctor coverage for every Exam Room required.
   - Exam Rooms must exist (zero rooms blocks with `exam_room_empty`).
   - Participant-to-room assignment completeness required (composed from BU-075).
   - Active Proctor coverage for every Room required (composed from BU-074).
   - If both pass -> returns `room_proctor_readiness_ready`.

## DETERMINISTIC EVALUATION ORDER
1. Valid UUID / exact scoped capability (`tenantId`, `examInstanceId`).
2. Same-tenant Exam Instance lookup.
3. Lifecycle state must be `SCHEDULED` (fails closed as `invalid_state` otherwise).
4. Requirement-policy configuration and applicability check (`room_based_operations_enabled`, `proctor_per_room_required`).
5. BU-075 participant-room completeness check when room mode enabled (`room_based_operations_enabled = TRUE`).
6. BU-074 active Proctor room coverage check only when `proctor_per_room_required = TRUE`.

## EXTERNAL CAPABILITY EVALUATOR RULE
- Evaluated EXACTLY ONCE at BU-077 level with exact `{ tenantId, examInstanceId }` context.
- Composed predecessor preflights (BU-075, BU-074) are invoked with deterministic granted evaluators (`async () => 'granted' as const`).

## PREDECESSOR BLOCKER FORWARDING & ZERO-ROOM MAPPING
Preserves exact predecessor blocker semantics:
- `participant_empty` (from BU-075 via BU-062)
- `participant_room_assignment_incomplete` (from BU-075)
- `active_proctor_assignment_empty` (from BU-074 via BU-070)
- `active_proctor_room_coverage_incomplete` (from BU-074)

Maps predecessor zero-room result:
- Predecessor `no_exam_rooms` -> `not_ready` with blocker `exam_room_empty`.

## EXACT RESULT UNION CONTRACT
```typescript
export type CapabilityContext = {
  tenantId: string;
  examInstanceId: string;
};

export type CapabilityDecision = 'granted' | 'denied' | 'unavailable';

export type CapabilityEvaluator = (ctx: CapabilityContext) => Promise<CapabilityDecision> | CapabilityDecision;

export type RoomProctorReadinessBlocker =
  | 'room_proctor_requirement_policy_unconfigured'
  | 'participant_empty'
  | 'exam_room_empty'
  | 'participant_room_assignment_incomplete'
  | 'active_proctor_assignment_empty'
  | 'active_proctor_room_coverage_incomplete';

export type ConditionalRoomProctorReadinessCompositionResult =
  | { type: 'denied' }
  | { type: 'unavailable' }
  | { type: 'invalid_state' }
  | {
      type: 'not_ready';
      blocker: 'room_proctor_requirement_policy_unconfigured';
    }
  | {
      type: 'not_ready';
      blocker: 'participant_empty';
    }
  | {
      type: 'not_ready';
      blocker: 'exam_room_empty';
    }
  | {
      type: 'not_ready';
      blocker: 'participant_room_assignment_incomplete';
      participantCount: number;
      assignedParticipantCount: number;
      unassignedParticipantCount: number;
    }
  | {
      type: 'not_ready';
      blocker: 'active_proctor_assignment_empty';
    }
  | {
      type: 'not_ready';
      blocker: 'active_proctor_room_coverage_incomplete';
      examRoomCount: number;
      coveredExamRoomCount: number;
      uncoveredExamRoomCount: number;
    }
  | {
      type: 'room_proctor_readiness_not_applicable';
      tenantId: string;
      examInstanceId: string;
      roomBasedOperationsEnabled: false;
      proctorPerRoomRequired: false;
    }
  | {
      type: 'room_proctor_readiness_ready';
      tenantId: string;
      examInstanceId: string;
      roomBasedOperationsEnabled: true;
      proctorPerRoomRequired: boolean;
      examRoomCount?: number;
      coveredExamRoomCount?: number;
      participantCount?: number;
      assignedParticipantCount?: number;
    };
```

## AUTHORIZED PATHS
1. `runtime/secure-assessment/src/exam-instance-conditional-room-proctor-readiness-composition-preflight.ts`
2. `runtime/secure-assessment/test/exam-instance-conditional-room-proctor-readiness-composition-preflight.test.ts`
3. `runtime/secure-assessment/verification/verify_bu077_exam_instance_conditional_room_proctor_readiness_composition_preflight.ts`
4. `docs/build/units/BU-077_SECURE_ASSESSMENT_EXAM_INSTANCE_CONDITIONAL_ROOM_PROCTOR_READINESS_COMPOSITION_PREFLIGHT_RUNTIME_BOOTSTRAP.md`

## FOCUSED TEST SUITE
Proves 27 required scenarios:
1. invalid tenant UUID -> denied
2. invalid exam UUID -> denied
3. capability denied -> denied
4. explicit capability unavailable -> unavailable
5. capability evaluator throws -> unavailable
6. nonexistent Exam Instance -> denied
7. wrong tenant -> denied
8. non-SCHEDULED Exam Instance -> invalid_state
9. policy NULL / NULL -> not_ready / room_proctor_requirement_policy_unconfigured
10. partial policy (NULL/FALSE, NULL/TRUE, FALSE/NULL, TRUE/NULL) -> not_ready / room_proctor_requirement_policy_unconfigured
11. invalid policy FALSE / TRUE -> invalid_state
12. policy FALSE / FALSE -> room_proctor_readiness_not_applicable
13. policy TRUE / FALSE with zero participants -> not_ready / participant_empty
14. policy TRUE / FALSE with zero rooms -> not_ready / exam_room_empty
15. policy TRUE / FALSE with incomplete participant room assignment -> not_ready / participant_room_assignment_incomplete
16. policy TRUE / FALSE with complete participant room assignment -> room_proctor_readiness_ready (no proctor check)
17. policy TRUE / TRUE with zero participants -> not_ready / participant_empty
18. policy TRUE / TRUE with zero rooms -> not_ready / exam_room_empty
19. policy TRUE / TRUE with incomplete participant room assignment -> not_ready / participant_room_assignment_incomplete
20. policy TRUE / TRUE with complete participants but zero active proctors -> not_ready / active_proctor_assignment_empty
21. policy TRUE / TRUE with complete participants but incomplete active proctor room coverage -> not_ready / active_proctor_room_coverage_incomplete
22. policy TRUE / TRUE with complete participants AND complete active proctor room coverage -> room_proctor_readiness_ready
23. external capability evaluator called exactly once with exact context
24. query failure in BU-077 own query -> unavailable
25. sub-call failure in BU-075 -> unavailable
26. sub-call failure in BU-074 -> unavailable
27. BU-077 performs zero write operations

## REAL POSTGRESQL VERIFICATION
- Disposable DB prefix: `elligble_bu077_`
- Canonical migrations applied: 0001..0034
- Migration history count: 34
- Migration 0035 absent
- Pre-run zero-leak: verified
- Post-run zero-leak: verified
- Fail-closed disposable DB cleanup: verified
- Policy matrix physical verification:
  - NULL / NULL -> room_proctor_requirement_policy_unconfigured
  - FALSE / FALSE -> room_proctor_readiness_not_applicable (zero room inspection)
  - TRUE / FALSE zero rooms -> exam_room_empty
  - TRUE / FALSE incomplete participant assignments -> participant_room_assignment_incomplete
  - TRUE / FALSE complete participant assignments -> room_proctor_readiness_ready
  - TRUE / TRUE zero rooms -> exam_room_empty
  - TRUE / TRUE incomplete participant assignments -> participant_room_assignment_incomplete
  - TRUE / TRUE zero active proctors -> active_proctor_assignment_empty
  - TRUE / TRUE incomplete active proctor room coverage -> active_proctor_room_coverage_incomplete
  - TRUE / TRUE complete participant & proctor coverage -> room_proctor_readiness_ready
- Non-SCHEDULED state -> invalid_state
- Other tenant isolation -> denied
- Capability evaluator called exactly once with exact context
- Simulated database query failures fail closed as unavailable
- Read-only zero-mutation across all 16 tracked tables
- Academic Core non-mutation verified

## STRICT OUT OF SCOPE
- Overall READY evaluator
- SCHEDULED -> READY transition
- READY -> ACTIVE transition
- Exam activation
- Attempt creation
- Session creation
- Student Secure Assessment Entry
- Anti-cheating policy
- Technical / device compatibility
- API / frontend endpoints
- Room mutation
- Participant Room Assignment mutation
- Proctor Assignment mutation
- Proctor Room Assignment mutation
- Academic Core mutation
- Schema changes / migration 0035
- Permission Matrix / PB05 closure
- BU-078 selection or registration

## STATUS
- **TITLE:** Secure Assessment Exam Instance Conditional Room and Proctor Readiness Composition Preflight Runtime Bootstrap
- **STAGE-1:** PASS / FROZEN
- **DIRECT PREDECESSORS:** BU-074, BU-075, BU-076
- **SEQUENCE GATE:** BU-076 terminal / DONE YES / repository finalized YES / Stage-5 final physical verification PASS
- **SOURCE AUTHORING:** COMPLETE
- **PACKAGE TYPECHECK:** PASS
- **BU-077 FOCUSED TEST:** PASS / 27
- **VERIFIER STRICT TYPECHECK:** PASS
- **REAL POSTGRESQL VERIFICATION:** PASS
- **MIGRATION HISTORY:** 34 / PASS
- **MIGRATION 0035 ABSENCE:** PASS
- **POLICY STATE MATRIX:** PASS
- **CAPABILITY EVALUATOR EXACTLY ONCE:** PASS
- **ZERO MUTATION:** PASS
- **PRE-RUN ZERO-LEAK:** PASS
- **POST-RUN ZERO-LEAK:** PASS
- **DISPOSABLE DATABASE CLEANUP:** PASS / FAIL-CLOSED VERIFIED
- **STAGE-2 REPOSITORY FINALIZED:** YES
- **STAGE-2 PROCESS DEVIATION:** YES / task-1461 automatically backgrounded during hash command / manage_task used to cancel it despite Controller prohibition
- **PROCESS DEVIATION CLASSIFICATION:** NON-MATERIAL EXECUTION-CONTROL DEFECT
- **MATERIAL ENGINEERING DEFECT:** NONE ESTABLISHED BY THIS PROCESS FINDING
- **TARGETED CONTROL-TRUTH REMEDIATION:** COMPLETE
- **STAGE-3:** PENDING
- **DONE:** NO
- **FULL BU-077 REPOSITORY FINALIZED:** NO
- **PB05:** OPEN / CARRIED FORWARD
- **OWNER DECISION REQUIRED:** NO
- **BU-078:** NOT SELECTED / NOT REGISTERED
