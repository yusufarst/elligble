# BU-067: Secure Assessment Exam Instance Baseline Question Snapshot Content Readiness Preflight Runtime Bootstrap

## BU-067 SPEC

**BUILD UNIT:**
BU-067 — Secure Assessment Exam Instance Baseline Question Snapshot Content Readiness Preflight Runtime Bootstrap

**STAGE-1:**
PASS / FROZEN

**SOURCE AUTHORING:**
EXECUTED / COMPLETE

**FIRST STAGE-2 FINALIZATION ATTEMPT COMMIT:**
2a1344dfe7236be01b9dff1f3fef96c61befd76d

**FIRST STAGE-2 ENGINEERING VERIFICATION:**
FAIL

**FIRST STAGE-3 CONTROLLER PHYSICAL AUDIT:**
FAIL

**TARGETED STAGE-3 ENGINEERING REMEDIATION:**
EXECUTED

**TARGETED ENGINEERING RE-VERIFICATION:**
PASS

**PACKAGE TYPECHECK:**
PASS

**BU-067 FOCUSED TEST:**
PASS / 28 / 28

**PACKAGE BASELINE REGRESSION:**
PASS / 145 / 145

**BU-065 REGRESSION:**
PASS / 15 / 15

**BU-066 REGRESSION:**
PASS / 23 / 23

**COMBINED REGRESSION:**
PASS / 211 / 211

**VERIFIER STRICT TYPECHECK:**
PASS

**REAL POSTGRESQL VERIFICATION:**
PASS

**DISPOSABLE DATABASE CLEANUP FAIL-CLOSED:**
VERIFIED

**TARGETED ENGINEERING MATERIAL COMMIT:**
f25a4fa041c629a258395bfe7974ea6ebb99c983

**FIRST TARGETED REMEDIATION CONTROL FINALIZATION:**
PARTIAL / FAIL

**FIRST STAGE-3 CONTROLLER PHYSICAL RE-AUDIT:**
FAIL

**TARGETED CONTROL-TRUTH FORWARD CORRECTION COMMIT:**
51ba9308f7fb26de87f441becab71e4bd5da224c

**SECOND STAGE-3 CONTROLLER PHYSICAL RE-AUDIT:**
PASS

**SECOND STAGE-3 CONTROLLER PHYSICAL RE-AUDIT FINDING:**
PASS / NO MATERIAL DEFECT REMAINS

**FAST-TRACK STAGE-4 LIFECYCLE CLOSE:**
COMPLETE

**STAGE-4 REPOSITORY FINALIZED:**
YES

**DONE:**
YES

**FULL BU-067 REPOSITORY FINALIZED:**
YES

**STAGE-4 LIFECYCLE CLOSE COMMIT:**
4e18cec310df1f5a13ec0e904dfcea1a365b2fcb

**STAGE-5 FINAL PHYSICAL VERIFICATION:**
PASS

**FINAL PHYSICAL VERIFICATION:**
PASS

**NEXT BUILD UNIT SELECTION / SCOPE FREEZE:**
AUTHORIZED

**PB05:**
OPEN / CARRIED FORWARD

**OWNER DECISION REQUIRED:**
NO

**BU-068:**
NOT SELECTED / NOT REGISTERED
## Purpose

Implement a bounded read-only readiness preflight for an Exam Instance that validates every existing Exam Question Snapshot frozen_content using the already finalized BU-066 validator.
BU-067 MUST NOT transition SCHEDULED -> READY and MUST NOT claim overall Exam Instance READY.

## Predecessors

- **BU-003**: Exam Question Snapshot persistence.
- **BU-061**: Question Snapshot Presence Readiness Preflight.
- **BU-065**: Existing Readiness Checks Composition Preflight.
- **BU-066**: Baseline Question Snapshot Frozen-Content Contract.

BU-066 truth is reused directly. Its validator is imported and invoked, never duplicated, modified, or reinterpreted.

## Result Contract

- Invalid tenant UUID -> `{ type: 'denied' }`
- Invalid exam UUID -> `{ type: 'denied' }`
- Capability unavailable -> `{ type: 'unavailable' }`
- Capability throws -> `{ type: 'unavailable' }`
- Capability not granted -> `{ type: 'denied' }`
- Exam nonexistent for tenant -> `{ type: 'denied' }`
- Cross-tenant -> `{ type: 'denied' }`
- Lifecycle != SCHEDULED -> `{ type: 'invalid_state' }`
- Zero snapshots -> `{ type: 'not_ready', blocker: 'question_snapshot_empty' }`
- All snapshots valid -> `{ type: 'baseline_question_snapshot_content_ready', examInstanceId, tenantId, questionSnapshotCount }`
- Invalid snapshot -> `{ type: 'not_ready', blocker: 'question_snapshot_content_invalid', snapshotId, contentBlocker }`

## Deterministic Ordering

Snapshot validation order is deterministic, enforced by `ORDER BY snapshot_id ASC`.
The first invalid snapshot in this stable order wins. Later invalid snapshots do not replace the first blocker.
Inside each snapshot, the BU-066 blocker order wins unchanged (the exact validation logic from BU-066).

## Verification Requirements

The preflight guarantees:
- Read-only execution against exact scoped tenant/exam.
- Strict mapping of DB state to output contract variants.
- Deterministic and stable blocker reporting.
- Fail-closed disposable database cleanup in verifier.
- No DB mutations whatsoever (no Exam mutations, no Question Bank item mutations, no Attempt/Session/Academic Core creation, no schema migration/change).

## Exact Four Authorized Paths

BU-067 modifications are strictly confined to these four paths:
1. `runtime/secure-assessment/src/exam-instance-baseline-question-snapshot-content-readiness-preflight.ts`
2. `runtime/secure-assessment/test/exam-instance-baseline-question-snapshot-content-readiness-preflight.test.ts`
3. `runtime/secure-assessment/verification/verify_bu067_exam_instance_baseline_question_snapshot_content_readiness_preflight.ts`
4. `docs/build/units/BU-067_SECURE_ASSESSMENT_EXAM_INSTANCE_BASELINE_QUESTION_SNAPSHOT_CONTENT_READINESS_PREFLIGHT_RUNTIME_BOOTSTRAP.md`

## Strict Out-of-Scope

BU-067 does NOT implement:
- SCHEDULED -> READY transitions
- Overall READY claims
- Modification of BU-065 composition
- Modification of BU-066 validator
- Question Bank authoring/mutation
- Snapshot creation/copy/update/delete
- Scoring engine / Attempt scoring / Total/aggregate score / Negative scoring / Rubrics
- Other question types / Randomization / pooling
- Media fetch/render semantics
- Participant/timing/assessment-type readiness changes
- Exam Room / Proctor / Anti-cheating / Permission Matrix
- Academic Core mutation / Schema/migration changes
- API/frontend
- PB05 closure
- BU-068 selection
