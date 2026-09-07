# BU-068: Secure Assessment Exam Instance Baseline Readiness Checks Composition Preflight Runtime Bootstrap

## BU-068 SPEC

**BUILD UNIT:** BU-068
**TITLE:** Secure Assessment Exam Instance Baseline Readiness Checks Composition Preflight Runtime Bootstrap

**STAGE-1:** PASS / FROZEN
**SOURCE AUTHORING:** EXECUTED / COMPLETE
**FIRST STAGE-2 FINALIZATION ATTEMPT COMMIT:** dfb449e992f752e60ff599e1b1f0a74dc6196963
**FIRST STAGE-2 ENGINEERING VERIFICATION:** FAIL
**FIRST FOCUSED TEST:** FAIL / 20 PASS / 2 FAIL
**FIRST REAL POSTGRESQL VERIFICATION:** FAIL / NONCANONICAL VERIFIER FIXTURE RELATION
**FIRST CONTROL STATE SYNC:** FAIL
**FIRST STAGE-3 CONTROLLER PHYSICAL AUDIT:** FAIL
**BU-068 RUNTIME DEFECT ESTABLISHED:** NO
**TARGETED TEST / VERIFIER REMEDIATION:** EXECUTED
**FIRST TARGETED RE-VERIFICATION CONTROL RUN:** STOP / CONTROLLER NODE-TEST SUMMARY PARSER DEFECT ONLY / NO REPOSITORY FINALIZATION
**SECOND TARGETED RE-VERIFICATION:** FOCUSED 22/22 PASS / VERIFIER STRICT TYPECHECK PASS / REAL POSTGRESQL FAIL
**SECOND TARGETED RE-VERIFICATION FAILURE:** DETERMINISTIC MULTI-SNAPSHOT VERIFIER EXPECTATION DEFECT / STABLE ID ORDER NOT FIXTURE-CONTROLLED
**DETERMINISTIC SNAPSHOT-ORDER VERIFIER REMEDIATION:** EXECUTED
**PACKAGE TYPECHECK:** PASS / PRESERVED
**BU-068 FOCUSED TEST:** PASS / 22 / 22 / PRESERVED
**PACKAGE BASELINE REGRESSION:** PASS / 145 / 145 / PRESERVED
**BU-065 REGRESSION:** PASS / 15 / 15 / PRESERVED
**BU-066 REGRESSION:** PASS / 23 / 23 / PRESERVED
**BU-067 REGRESSION:** PASS / 28 / 28 / PRESERVED
**COMBINED VERIFIED REGRESSION COVERAGE:** PASS / 233 / 233
**TARGETED ENGINEERING RE-VERIFICATION:** PASS
**VERIFIER STRICT TYPECHECK:** PASS
**DETERMINISTIC SNAPSHOT-ID ORDER PROOF:** PASS
**REAL POSTGRESQL VERIFICATION:** PASS
**PRE-RUN ZERO-LEAK:** PASS
**POST-RUN ZERO-LEAK:** PASS
**DISPOSABLE DATABASE CLEANUP FAIL-CLOSED:** VERIFIED
**STAGE-2 REPOSITORY FINALIZED:** YES
**STAGE-3 CONTROLLER PHYSICAL RE-AUDIT:** PASS
**STAGE-3 CONTROLLER PHYSICAL RE-AUDIT FINDING:** PASS / NO MATERIAL DEFECT REMAINS
**FAST-TRACK STAGE-4 LIFECYCLE CLOSE:** COMPLETE
**STAGE-4 REPOSITORY FINALIZED:** YES
**DONE:** YES
**FULL BU-068 REPOSITORY FINALIZED:** YES
**STAGE-5 FINAL PHYSICAL VERIFICATION:** PENDING
**NEXT BUILD UNIT SELECTION / SCOPE FREEZE:** NOT YET AUTHORIZED
**PB05:** OPEN / CARRIED FORWARD
**OWNER DECISION REQUIRED:** NO
**BU-069:** NOT SELECTED / NOT REGISTERED
## Purpose

Create one bounded READ-ONLY Secure Assessment Exam Instance baseline readiness composition preflight.
It composes the already-finalized BU-065 (Existing Readiness Checks Composition Preflight) and, only after BU-065 passes, BU-067 (Baseline Question Snapshot Content Readiness Preflight).
Produces one deterministic baseline-readiness composition result without changing Exam Instance lifecycle state.

## Direct Predecessors

- **BU-065**: Secure Assessment Exam Instance Existing Readiness Checks Composition Preflight Runtime Bootstrap
- **BU-067**: Secure Assessment Exam Instance Baseline Question Snapshot Content Readiness Preflight Runtime Bootstrap

Transitive predecessor truth from BU-060..064 and BU-066 remains preserved through these finalized predecessor functions.

## Deterministic Readiness Order

The effective baseline readiness order is deterministic. The first blocker wins:

1. `assessment_type`
2. `question_snapshot_presence`
3. `participant_presence`
4. `timing_configuration_presence`
5. `duration_window_policy_compatibility`
6. `question_snapshot_content`

BU-065 owns ordering 1..5. BU-067 owns content validation behavior for item 6. These are not duplicated in BU-068.

## Result Contract

**SUCCESS:**
```typescript
{
  type: 'baseline_readiness_checks_pass',
  examInstanceId: string,
  tenantId: string
}
```

**EXISTING READINESS BLOCKER:**
```typescript
{
  type: 'not_ready',
  category:
    | 'assessment_type'
    | 'question_snapshot_presence'
    | 'participant_presence'
    | 'timing_configuration_presence'
    | 'duration_window_policy_compatibility',
  blocker: string
}
```

**CONTENT EMPTY:**
```typescript
{
  type: 'not_ready',
  category: 'question_snapshot_content',
  blocker: 'question_snapshot_empty'
}
```

**CONTENT INVALID:**
```typescript
{
  type: 'not_ready',
  category: 'question_snapshot_content',
  blocker: 'question_snapshot_content_invalid',
  snapshotId: string,
  contentBlocker: BaselineQuestionSnapshotBlocker
}
```

**OTHER:**
- `{ type: 'invalid_state' }`
- `{ type: 'denied' }`
- `{ type: 'unavailable' }`

## Authorized Paths (Exactly Four)

1. `runtime/secure-assessment/src/exam-instance-baseline-readiness-checks-composition-preflight.ts`
2. `runtime/secure-assessment/test/exam-instance-baseline-readiness-checks-composition-preflight.test.ts`
3. `runtime/secure-assessment/verification/verify_bu068_exam_instance_baseline_readiness_checks_composition_preflight.ts`
4. `docs/build/units/BU-068_SECURE_ASSESSMENT_EXAM_INSTANCE_BASELINE_READINESS_CHECKS_COMPOSITION_PREFLIGHT_RUNTIME_BOOTSTRAP.md`

## Verification Requirements

- Read-only execution against exact scoped tenant/exam.
- Capability evaluated once.
- Deterministic order (BU-065 first, then BU-067).
- Proper forwarding of specific blockers (snapshot presence preserved, content mapped correctly).
- Fail-closed disposable database cleanup in verifier.
- No DB mutations whatsoever (no Exam mutations, no participant mutation, no Question Bank item mutations, no Attempt/Session/Academic Core creation, no schema migration/change).

## Strict Out of Scope

BU-068 does NOT implement:
- Overall READY evaluator
- SCHEDULED -> READY lifecycle transition
- READY -> ACTIVE lifecycle transition
- Exam activation
- Attempt/Session creation
- Student Secure Assessment Entry
- Question Bank authoring/mutation
- Snapshot creation/copy/update/delete
- Scoring engine / result calculation / publication
- Randomization / media semantics
- Exam Room / Proctor readiness
- Anti-cheating / Permission Matrix
- Academic Core mutation
- Schema / migration
- API / frontend
- PB05 closure
- BU-069 selection
