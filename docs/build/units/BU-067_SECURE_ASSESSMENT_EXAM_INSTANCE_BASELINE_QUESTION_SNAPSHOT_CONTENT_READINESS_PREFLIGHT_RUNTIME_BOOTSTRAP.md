# BU-067: Secure Assessment Exam Instance Baseline Question Snapshot Content Readiness Preflight Runtime Bootstrap

## BU-067 SPEC

**STAGE-1:**
PASS / FROZEN

**STAGE-2 SOURCE AUTHORING:**
EXECUTED / NOT YET VERIFIED

**STAGE-2 ENGINEERING VERIFICATION:**
PENDING

**STAGE-2 REPOSITORY FINALIZED:**
NO

**STAGE-3:**
NOT STARTED

**DONE:**
NO

**FULL BU-067 REPOSITORY FINALIZED:**
NO

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
